# Bouwt de twee losse HTML-bestanden (alles erin verpakt, geen server nodig):
#   python3 bron/build.py          -> site/3d.html            (website met scrollverhaal)
#   python3 bron/build.py model    -> site/orkest-model.html  (alleen het 3D-model, vrij rondkijken)
# Muzikanten: Microsoft Rocketbox avatars (MIT-licentie), voorbewerkt in bron/assets.
import json, base64, glob, os, struct, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "assets")
M, S = os.path.join(ROOT, "model"), os.path.join(ROOT, "site")
r = lambda *p: open(os.path.join(*p), encoding="utf-8").read()

A, T = {}, {}
for f in sorted(glob.glob(os.path.join(ASSETS, "rocketbox", "*.fbx"))): A[os.path.basename(f)[:-4]] = base64.b64encode(open(f, "rb").read()).decode()
for f in sorted(glob.glob(os.path.join(ASSETS, "rocketbox", "*.jpg")) + glob.glob(os.path.join(ASSETS, "rocketbox", "*.png"))):
    n = os.path.basename(f).rsplit(".", 1)[0]; mime = "image/jpeg" if f.endswith(".jpg") else "image/png"
    T[n] = "data:" + mime + ";base64," + base64.b64encode(open(f, "rb").read()).decode()
H = json.load(open(os.path.join(ASSETS, "heads.json"))); PRE = json.load(open(os.path.join(ASSETS, "prefix.json")))
def pk(arr, fmt): return base64.b64encode(struct.pack("<%d%s" % (len(arr), fmt), *arr)).decode()
HEADS = {}
for k, v in H.items():
    if k.startswith("Business") or k not in PRE or k == "Female_Adult_10": continue
    HEADS[k] = {"pre": PRE[k], "nv": v["nv"], "bones": v["boneNames"], "pos": pk(v["pos"], "h"), "nor": pk(v["nor"], "b"), "uv": pk([round(x / 65535 * 8192) for x in v["uv"]], "h"),
                "si": pk(v["si"], "B"), "sw": pk(v["sw"], "B"), "ih": pk(v["idxHead"], "H"), "ia": pk(v["idxHair"], "H") if v["idxHair"] else None}
data = "\n  const HEADS = " + json.dumps(HEADS) + ";\n  const ASSETS = " + json.dumps(A) + ";\n  const TEXTURES = " + json.dumps(T) + ";\n"
out_dir = os.path.join(os.path.dirname(ROOT), "site"); os.makedirs(out_dir, exist_ok=True)

if len(sys.argv) > 1 and sys.argv[1] == "model":
    s = r(M, "head.html") + r(M, "body.js") + r(M, "_dress_src.js") + data + r(M, "_people_rest.js") + r(M, "tail.js")
    out = os.path.join(out_dir, "orkest-model.html")
else:
    cfg = r(M, "head.html").split('  "use strict";\n', 1)[1]          # scène-instellingen uit het model
    body = r(M, "body.js")
    for line in ['  const controls = new THREE.OrbitControls(camera, canvas);\n',
                 '  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 1.2; controls.maxDistance = 140;\n']:
        assert line in body; body = body.replace(line, "")             # op de site stuurt het verhaal de camera
    people = r(M, "_people_rest.js")
    for a, b in [('"Muzikanten laden… " + done + " van " + MUS.length', '"Musicians arriving… " + done + " / " + MUS.length'),
                 ('"Publiek laden… " + (done - MUS.length) + " van " + AUD.length', '"Audience arriving… " + (done - MUS.length) + " / " + AUD.length'),
                 ("De muzikanten konden niet laden in deze browser.", "The musicians could not load in this browser.")]:
        assert a in people, a; people = people.replace(a, b)
    s = r(S, "head.html") + cfg + body + r(M, "_dress_src.js") + data + people + r(S, "content.js") + r(S, "story.js")
    out = os.path.join(out_dir, "3d.html")
    open(os.path.join(out_dir, "styles.css"), "w", encoding="utf-8").write(r(S, "styles.css"))   # 3d.html linkt naar styles.css
open(out, "w", encoding="utf-8").write(s); print(out, round(len(s) / 1e6, 2), "MB")
