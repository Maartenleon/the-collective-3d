# Measures the website: file size, load times, draw calls, triangles, scene counts, JS heap and fps.
#   python3 bron/build.py && python3 bron/build.py test
#   cd ~/Downloads && python3 -m http.server 8099          (in another terminal)
#   python3 bron/test/perf.py [--runs 3] [--label baseline]          (fps: median of three 5 s windows per stop)
# Runs Chrome with the GPU (Python Playwright, channel="chrome"). Load times come from cold loads of the public index.html;
# everything that needs the renderer comes from test.html (window.__perf exists only there).
# Writes bron/test/out/perf-<label>.json and prints a summary.
import argparse, gzip, json, os, statistics, sys
from playwright.sync_api import sync_playwright

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = "http://127.0.0.1:8099/the-collective-3d/"
FPS_STOPS = ["open", "t5", "problems"]
ARGS = ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit"]   # no 60 fps cap: the fps shows the headroom

def sizes(repo):
    out = {}
    for rel in ["index.html", "site/styles.css", "site/people.glb", "site/orchestra.glb", "site/audience.glb"]:
        f = os.path.join(repo, rel)
        if not os.path.exists(f): continue
        raw = open(f, "rb").read()
        out[rel] = {"raw": len(raw), "gzip": len(gzip.compress(raw, 6))}
    return out

def cold_load(b, url, opts):
    ctx = b.new_context(**opts); pg = ctx.new_page()
    cdp = ctx.new_cdp_session(pg); cdp.send("Network.enable"); cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(url)
    pg.wait_for_function("window.__story", timeout=600000, polling=50); t_story = pg.evaluate("performance.now()")
    pg.wait_for_function("window.__people", timeout=600000, polling=50); t_people = pg.evaluate("performance.now()"); people = pg.evaluate("window.__people.total")
    pg.wait_for_function("!document.body.classList.contains('is-loading')", timeout=600000, polling=50); t_ready = pg.evaluate("performance.now()")
    pg.wait_for_function("window.__audience || !document.querySelector('link[href*=\"orchestra.glb\"]')", timeout=600000, polling=50); t_aud = pg.evaluate("window.__audience ? performance.now() : null")   # baked audience (phase 6); older builds have none
    ctx.close()
    return t_people / 1000, t_ready / 1000, errs, t_story / 1000, people / 1000, (t_aud or t_ready) / 1000

# counts and triangles of the whole scene, per group; drawn calls and triangles of one frame, with and without the shadow pass
SCENE_JS = """() => {
  const P = window.__perf, R = P.renderer, tris = m => { const g = m.geometry; if (!g) return 0; const n = (g.index ? g.index.count : g.attributes.position.count) / 3; return n * (m.isInstancedMesh ? m.count : 1); };
  const verts = m => m.geometry && m.geometry.attributes.position ? m.geometry.attributes.position.count * (m.isInstancedMesh ? m.count : 1) : 0;
  const meshes = []; P.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  const mats = new Set(), texs = new Set(); let casters = 0, visible = 0;
  for (const m of meshes) { for (const mt of [].concat(m.material)) { mats.add(mt); for (const k in mt) { const v = mt[k]; if (v && v.isTexture) texs.add(v); } }
    let vis = true; for (let n = m; n; n = n.parent) if (!n.visible) { vis = false; break; }
    if (vis) { visible++; if (m.castShadow) casters++; } }
  const owner = m => { for (let n = m; n; n = n.parent) { for (const [k, g] of Object.entries(P.groups)) if (n === g && k !== 'omg') return k; } return 'other'; };
  const by = {}; for (const m of meshes) { let k = owner(m); if (k === 'heuvels') k = /^Berg/.test(m.name) ? 'hills (far land)' : 'bowl terrain';
    by[k] = by[k] || { meshes: 0, triangles: 0 }; by[k].meshes++; by[k].triangles += tris(m); }
  const frame = shadow => { R.info.autoReset = false; R.shadowMap.autoUpdate = shadow; R.shadowMap.needsUpdate = shadow; R.info.reset(); P.film.render(); const r = { calls: R.info.render.calls, triangles: R.info.render.triangles }; R.shadowMap.autoUpdate = true; R.info.autoReset = true; return r; };
  const withShadow = frame(true), noShadow = frame(false);
  return { meshes: meshes.length, visibleMeshes: visible, shadowCasters: casters, materials: mats.size, textures: texs.size,
    sceneTriangles: meshes.reduce((a, m) => a + tris(m), 0), sceneVertices: meshes.reduce((a, m) => a + verts(m), 0), byGroup: by,
    gpu: { geometries: R.info.memory.geometries, textures: R.info.memory.textures, programs: R.info.programs ? R.info.programs.length : null },
    frame: { calls: withShadow.calls, triangles: withShadow.triangles, shadowCalls: withShadow.calls - noShadow.calls, shadowTriangles: withShadow.triangles - noShadow.triangles },
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
}"""

FPS_JS = """() => new Promise(res => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(tick); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(tick); })"""

def runtime(p, opts):   # a fresh browser, warmed up first: right after the cold loads the first stop measured far too low (12 fps instead of 80)
    b = p.chromium.launch(channel="chrome", args=ARGS)
    pg = b.new_page(**opts); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + "test.html"); pg.wait_for_function("window.__people && !document.body.classList.contains('is-loading')", timeout=600000); pg.wait_for_timeout(1000)
    pg.evaluate("__story.pause(true)"); pg.wait_for_timeout(5000); out = {}
    for sid in FPS_STOPS:
        pg.evaluate("i => __story.go(i)", sid); pg.wait_for_timeout(4000)
        m = pg.evaluate(SCENE_JS); runs = [pg.evaluate(FPS_JS) for _ in range(3)]; m["fps"] = round(statistics.median(runs), 1); m["fpsRuns"] = [round(x, 1) for x in runs]; out[sid] = m   # median of three 5 s windows: one window is too noisy
    b.close(); return out, errs

def main():
    global BASE
    ap = argparse.ArgumentParser(); ap.add_argument("--runs", type=int, default=3); ap.add_argument("--label", default="run")
    ap.add_argument("--base", default=BASE, help="site URL (another checkout can be served elsewhere, e.g. a baseline worktree)"); ap.add_argument("--repo", default=REPO, help="checkout whose file sizes are reported"); a = ap.parse_args()
    BASE = a.base
    res = {"label": a.label, "url": BASE, "sizes": sizes(a.repo), "viewports": {}}
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=ARGS)
        for name, opts in [("desktop 1440x900", {"viewport": {"width": 1440, "height": 900}}),
                           ("phone 390x844", {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True})]:
            loads = [cold_load(b, BASE, opts) for _ in range(a.runs)]
            rt, errs = runtime(p, opts)
            res["viewports"][name] = {"timeToPeople_s": round(statistics.median(l[0] for l in loads), 2), "timeToReady_s": round(statistics.median(l[1] for l in loads), 2),
                                      "timeToScene_s": round(statistics.median(l[3] for l in loads), 2), "peopleBuild_s": round(statistics.median(l[4] for l in loads), 2), "timeToAudience_s": round(statistics.median(l[5] for l in loads), 2),
                                      "loads": [[round(l[0], 2), round(l[1], 2)] for l in loads], "stops": rt, "errors": sum((l[2] for l in loads), []) + errs}
        b.close()
    os.makedirs(os.path.join(REPO, "bron/test/out"), exist_ok=True)
    f = os.path.join(REPO, "bron/test/out", "perf-%s.json" % a.label); json.dump(res, open(f, "w"), indent=1)
    for k, v in res["sizes"].items(): print("%-16s %6.2f MB raw  %6.2f MB gzip" % (k, v["raw"] / 1e6, v["gzip"] / 1e6))
    for vp, v in res["viewports"].items():
        print("\n%s: scene %.2f s, people %.2f s (building them %.2f s), ready %.2f s, audience %.2f s (median of %d cold loads: %s), errors: %s" % (vp, v["timeToScene_s"], v["timeToPeople_s"], v["peopleBuild_s"], v["timeToReady_s"], v["timeToAudience_s"], a.runs, v["loads"], v["errors"] or "none"))
        for sid, m in v["stops"].items():
            fr = m["frame"]
            print("  %-9s fps %5.1f | calls %5d (shadow %4d) | triangles %9d (shadow %9d) | meshes %d, visible %d, casters %d, materials %d, textures %d | heap %s MB"
                  % (sid, m["fps"], fr["calls"], fr["shadowCalls"], fr["triangles"], fr["shadowTriangles"], m["meshes"], m["visibleMeshes"], m["shadowCasters"], m["materials"], m["textures"], m["heapMB"]))
    m = res["viewports"]["desktop 1440x900"]["stops"]["open"]
    print("\nscene (desktop): %d triangles, %d vertices; GPU: %s" % (m["sceneTriangles"], m["sceneVertices"], m["gpu"]))
    for k, g in sorted(m["byGroup"].items(), key=lambda kv: -kv[1]["triangles"]): print("  %-20s %8d triangles in %4d meshes" % (k, g["triangles"], g["meshes"]))
    print("\nsaved", f)

if __name__ == "__main__": main()
