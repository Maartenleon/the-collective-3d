# Visual comparison: one screenshot per stop (all STOPS) at 1440x900 and 390x844, against a stored reference.
#   python3 bron/build.py test && (serve the folder above the repo on :8099)
#   python3 bron/test/compare.py shoot --out bron/test/ref          make the reference (bron/test/ref/ is in .gitignore)
#   python3 bron/test/compare.py check --label phase3              shoot into bron/test/out/cmp-phase3/ and compare with the reference
#   python3 bron/test/compare.py diff A B                          compare two existing shot folders
# Uses test.html: fixed randomness and a fixed time for what keeps moving (conductor, wind, chaos lines, brass sway),
# so two shots of the same build match. Per stop it prints the mean difference (0-255) and the share of pixels that
# differ by more than 16, and writes an amplified diff image next to the shots.
import argparse, base64, json, os, sys
from playwright.sync_api import sync_playwright

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
URL = "http://127.0.0.1:8099/the-collective-3d/test.html"
VIEWS = {"desktop": {"viewport": {"width": 1440, "height": 900}},
         "phone": {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 1, "is_mobile": True, "has_touch": True}}
SETTLE_MS = 4500   # fades (.9 s + delay), the beat texts, the Orchestration arrow, the diagram FLIP and the tension in t5 are done by then
FIXED_T = 10.0

def shoot(out):
    os.makedirs(out, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"])
        for vname, opts in VIEWS.items():
            pg = b.new_page(**opts); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(URL); pg.wait_for_function("window.__people && document.body.classList.contains('is-ready')", timeout=600000)
            pg.wait_for_timeout(2500)   # the interface fade-in after loading
            pg.evaluate("t => { window.__perfT = t; __story.pause(true); }", FIXED_T)
            ids = pg.evaluate("__story.stops.map(s => s.id)")
            for i, sid in enumerate(ids):
                pg.evaluate("i => __story.go(i)", i); pg.wait_for_timeout(SETTLE_MS)
                pg.screenshot(path=os.path.join(out, "%s-%02d-%s.png" % (vname, i, sid)))
            print(vname, len(ids), "stops", "errors:", errs or "none"); pg.close()
        b.close()

DIFF_JS = """async ([a, b]) => {
  const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; }); const A = await load(a), B = await load(b);
  const W = A.width, H = A.height, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.drawImage(A, 0, 0); const da = x.getImageData(0, 0, W, H).data; x.clearRect(0, 0, W, H); x.drawImage(B, 0, 0, W, H); const db = x.getImageData(0, 0, W, H).data;
  const out = x.createImageData(W, H), o = out.data; let sum = 0, over = 0, max = 0;
  for (let i = 0; i < da.length; i += 4) { const d = (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3;
    sum += d; if (d > 16) over++; if (d > max) max = d; const g = (da[i] + da[i + 1] + da[i + 2]) / 9;   // the reference, dimmed, with the differences in red on top
    o[i] = Math.min(255, g + d * 6); o[i + 1] = g; o[i + 2] = g; o[i + 3] = 255; }
  x.putImageData(out, 0, 0); const n = da.length / 4;
  return { mean: +(sum / n).toFixed(2), over16: +(100 * over / n).toFixed(3), max: Math.round(max), img: c.toDataURL('image/png') }; }"""

def diff(ref, cur):
    rows = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome"); pg = b.new_page()
        for f in sorted(os.listdir(ref)):
            if not f.endswith(".png") or f.startswith("diff-"): continue
            if not os.path.exists(os.path.join(cur, f)): rows.append((f, None)); continue
            uri = lambda d: "data:image/png;base64," + base64.b64encode(open(os.path.join(d, f), "rb").read()).decode()
            r = pg.evaluate(DIFF_JS, [uri(ref), uri(cur)])
            open(os.path.join(cur, "diff-" + f), "wb").write(base64.b64decode(r.pop("img").split(",", 1)[1])); rows.append((f, r))
        b.close()
    rows.sort(key=lambda r: -(r[1]["mean"] if r[1] else 1e9))
    print("%-34s %8s %10s %5s" % ("shot", "mean", ">16 (%)", "max"))
    for f, r in rows: print("%-34s %8s %10s %5s" % (f[:-4], r["mean"], r["over16"], r["max"]) if r else "%-34s missing" % f[:-4])
    json.dump({f: r for f, r in rows}, open(os.path.join(cur, "diff.json"), "w"), indent=1)
    return rows

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("mode", choices=["shoot", "check", "diff"]); ap.add_argument("dirs", nargs="*")
    ap.add_argument("--out"); ap.add_argument("--label", default="check"); ap.add_argument("--ref", default=os.path.join(REPO, "bron/test/ref")); a = ap.parse_args()
    if a.mode == "shoot": shoot(a.out or a.ref)
    elif a.mode == "check": cur = os.path.join(REPO, "bron/test/out", "cmp-" + a.label); shoot(cur); diff(a.ref, cur)
    else: diff(*a.dirs)
