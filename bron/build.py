# Bouwt de HTML-bestanden (de scène zit erin verpakt; de zittende mensen komen uit site/orchestra.glb en site/audience.glb):
#   python3 bron/build.py          -> index.html              (website met scrollverhaal, in de hoofdmap: de hoofd-URL van GitHub Pages)
#                                     site/styles.css         (de stylesheet waar index.html naar linkt)
#                                     site/orchestra.glb      (de gebakken muzikanten met hun textures, gekopieerd uit bron/assets/baked/)
#                                     site/audience.glb       (het gebakken publiek; laadt na het orkest)
#                                     site/3d.html            (klein doorverwijsbestand naar ../, zodat oude links blijven werken)
#   python3 bron/build.py model    -> site/orkest-model.html  (alleen het 3D-model, vrij rondkijken)
#   python3 bron/build.py test     -> test.html               (testbuild voor bron/test/perf.py en compare.py: vast toeval, vaste tijd voor wat
#                                                               blijft bewegen, en window.__perf met renderer, scène, camera en film; staat in .gitignore)
#   python3 bron/build.py bake     -> bron/bake/bake.html     (de volledige pijplijn die de mensen bouwt; bron/bake/bake.py draait hem en maakt de .glb's)
# Muzikanten: Microsoft Rocketbox avatars (MIT-licentie), voorbewerkt in bron/assets.
import json, base64, glob, hashlib, os, shutil, struct, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "assets")
M, S = os.path.join(ROOT, "model"), os.path.join(ROOT, "site")
r = lambda *p: open(os.path.join(*p), encoding="utf-8").read()
target = sys.argv[1] if len(sys.argv) > 1 else "site"

A, T = {}, {}
for f in sorted(glob.glob(os.path.join(ASSETS, "rocketbox", "*.fbx"))): A[os.path.basename(f)[:-4]] = base64.b64encode(open(f, "rb").read()).decode()
for f in sorted(glob.glob(os.path.join(ASSETS, "rocketbox", "*.jpg")) + glob.glob(os.path.join(ASSETS, "rocketbox", "*.png"))):
    n = os.path.basename(f).rsplit(".", 1)[0]; mime = "image/jpeg" if f.endswith(".jpg") else "image/png"
    T[n] = "data:" + mime + ";base64," + base64.b64encode(open(f, "rb").read()).decode()
def pk(arr, fmt): return base64.b64encode(struct.pack("<%d%s" % (len(arr), fmt), *arr)).decode()
def heads():
    H = json.load(open(os.path.join(ASSETS, "heads.json"))); PRE = json.load(open(os.path.join(ASSETS, "prefix.json"))); out = {}
    for k, v in H.items():
        if k.startswith("Business") or k not in PRE or k == "Female_Adult_10": continue
        out[k] = {"pre": PRE[k], "nv": v["nv"], "bones": v["boneNames"], "pos": pk(v["pos"], "h"), "nor": pk(v["nor"], "b"), "uv": pk([round(x / 65535 * 8192) for x in v["uv"]], "h"),
                  "si": pk(v["si"], "B"), "sw": pk(v["sw"], "B"), "ih": pk(v["idxHead"], "H"), "ia": pk(v["idxHair"], "H") if v["idxHair"] else None}
    return out
def data(assets, textures, hd): return "\n  const HEADS = " + json.dumps(hd) + ";\n  const ASSETS = " + json.dumps(assets) + ";\n  const TEXTURES = " + json.dumps(textures) + ";\n"
# the conductors are still built in the browser (one live, one at the rehearsal): only their avatar and its textures stay in the page (Business_Male_01 = m005)
CONDUCTOR_FBX, CONDUCTOR_TEX = ["Business_Male_01"], ["m005_body", "m005_body_red", "m005_head", "m005_opacity"]
REPO = os.path.dirname(ROOT); out_dir = os.path.join(REPO, "site"); os.makedirs(out_dir, exist_ok=True)
REDIRECT = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Collective</title>
<meta http-equiv="refresh" content="0; url=../">
<link rel="canonical" href="../">
<link rel="icon" href="icons/favicon.svg" type="image/svg+xml">
</head>
<body style="background:#1A0E0A;color:#FAF8F6;font:14px/1.6 system-ui,sans-serif">
<p>The website moved to <a href="../" style="color:#FCE8D8">the main address</a>.</p>
</body>
</html>
"""
def runtime(prefix, head):   # site and model page: the baked people next to the pages (a hash in each link, so a new bake never sticks in a cache)
    people = {}
    for name in ["orchestra", "audience"]:
        src = os.path.join(ASSETS, "baked", name + ".glb"); b = open(src, "rb").read(); shutil.copyfile(src, os.path.join(out_dir, name + ".glb"))
        people[name] = {"url": prefix + name + ".glb?v=" + hashlib.md5(b).hexdigest()[:8], "bytes": len(b)}
    icon = 'apple-touch-icon.png">\n'; assert head.count(icon) == 1   # the orchestra is preloaded right after the icons, early in the head; the audience comes after it
    head = head.replace(icon, icon + '<link rel="preload" href="%s" as="fetch" crossorigin>\n' % people["orchestra"]["url"])
    return head, data({k: A[k] for k in CONDUCTOR_FBX}, {k: T[k] for k in CONDUCTOR_TEX}, {}) + "  const PEOPLE = " + json.dumps(people) + ";\n"

if target == "bake":
    head = r(M, "head.html"); a = "<script>\n(() => {"; assert head.count(a) == 1
    head = head.replace(a, '<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/exporters/GLTFExporter.js"></script>\n' + a)
    s = head + r(M, "body.js") + r(M, "_dress_src.js") + data(A, T, heads()) + r(M, "_people_common.js") + r(M, "_people_bake.js") + "})();\n</script>\n</body>\n</html>\n"
    out = os.path.join(ROOT, "bake", "bake.html")
elif target == "model":
    head, d = runtime("", r(M, "head.html"))
    s = head + r(M, "body.js") + r(M, "_dress_src.js") + d + r(M, "_people_common.js") + r(M, "_people_rest.js") + r(M, "tail.js")
    out = os.path.join(out_dir, "orkest-model.html")
else:
    test = target == "test"
    cfg = r(M, "head.html").split('  "use strict";\n', 1)[1]          # scène-instellingen uit het model
    body = r(M, "body.js")
    for line in ['  const controls = new THREE.OrbitControls(camera, canvas);\n',
                 '  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 1.2; controls.maxDistance = 140;\n']:
        assert line in body; body = body.replace(line, "")             # op de site stuurt het verhaal de camera
    people = r(M, "_people_rest.js")
    for a, b in [('"Muzikanten laden… "', '"Musicians arriving… "'), ('" van "', '" / "'),
                 ("De muzikanten konden niet laden in deze browser.", "The musicians could not load in this browser.")]:
        assert a in people, a; people = people.replace(a, b)
    story = r(S, "story.js")
    if test:   # alleen in de testbuild: herhaalbare beelden en toegang tot de renderer
        for a, b in [('    drawMelody(now, dt); drawChaos(now, dt);', '    drawMelody(window.__perfT ?? now, dt); drawChaos(window.__perfT ?? now, dt);'),
                     ('    windU.value = now; tickPeople(now); tension(now, dt);', '    windU.value = window.__perfT ?? now; tickPeople(window.__perfT ?? now); tension(window.__perfT ?? now, dt);'),
                     ('    frameLoop.drawn = now; shadowTick(now); film.render();', '    frameLoop.drawn = now; shadowTick(window.__perfT ?? now); film.render();'),
                     ('  window.__scene = { root, camera,', '  window.__perf = { renderer, scene, camera, film, groups: { orkest, lessen, dir, pub, heuvels, graan, pod, bord, kassa, CHG, omg } };\n  window.__scene = { root, camera,')]:
            assert a in story, a; story = story.replace(a, b)
    head, d = runtime("site/", r(S, "head.html"))
    s = head + cfg + body + r(M, "_dress_src.js") + d + r(M, "_people_common.js") + people + r(S, "content.js") + story
    if test:   # vast toeval (mulberry32), zodat korrel, graan en gezichten bij elke lading gelijk zijn
        a = '(() => {\n  "use strict";\n'; assert s.count(a) == 1
        s = s.replace(a, a + '  Math.random = (() => { let a = 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();\n')
    out = os.path.join(REPO, "test.html" if test else "index.html")
    css = r(S, "styles.css"); open(os.path.join(out_dir, "styles.css"), "w", encoding="utf-8").write(css)   # index.html linkt naar site/styles.css
    link = '<link rel="stylesheet" href="site/styles.css">'; assert link in s
    s = s.replace(link, '<link rel="stylesheet" href="site/styles.css?v=' + hashlib.md5(css.encode()).hexdigest()[:8] + '">')   # nieuwe versie = nieuwe link, dus de browser haalt nooit een oude stylesheet uit zijn cache
    if not test: open(os.path.join(out_dir, "3d.html"), "w", encoding="utf-8").write(REDIRECT)   # oude links naar site/3d.html sturen door naar de hoofd-URL
open(out, "w", encoding="utf-8").write(s); print(out, round(len(s) / 1e6, 2), "MB")
