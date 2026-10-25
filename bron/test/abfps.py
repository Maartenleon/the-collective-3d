# Interleaved fps comparison: variants take turns, a fresh browser each time, so a busy moment on the Mac does not favour one of them.
#   python3 bron/test/abfps.py --rounds 3 before=test.html#every now=test.html
# A variant is label=page[#every]: the page under http://127.0.0.1:8099/the-collective-3d/ (or a full URL); #every switches the shadow map
# back to redrawing every frame (as before phase 5). Uncapped fps, desktop and phone.
import argparse, statistics
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8099/the-collective-3d/"
ARGS = ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit"]
VIEWS = {"desktop": {"viewport": {"width": 1440, "height": 900}},
         "phone": {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True}}
FPS = """ms => new Promise(res => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(tick); })"""

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("variants", nargs="+"); ap.add_argument("--rounds", type=int, default=3)
    ap.add_argument("--stops", default="open,t5,orch,problems"); ap.add_argument("--ms", type=int, default=4000); a = ap.parse_args()
    variants = []
    for v in a.variants:
        label, page = v.split("=", 1); page, _, shadow = page.partition("#")
        variants.append((label, page if page.startswith("http") else BASE + page, shadow or None))
    stops = a.stops.split(","); res = {}
    with sync_playwright() as p:
        for vname, opts in VIEWS.items():
            for _ in range(a.rounds):
                for label, url, shadow in variants:
                    b = p.chromium.launch(channel="chrome", args=ARGS); pg = b.new_page(**opts)
                    pg.goto(url); pg.wait_for_function("window.__people && document.body.classList.contains('is-ready')", timeout=600000)
                    if shadow == "every": pg.evaluate("window.__perf.renderer.shadowMap.autoUpdate = true")
                    pg.evaluate("__story.pause(true)"); pg.wait_for_timeout(4000)
                    for sid in stops:
                        pg.evaluate("i => __story.go(i)", sid); pg.wait_for_timeout(3500); res.setdefault((vname, sid, label), []).append(pg.evaluate(FPS, a.ms))
                    b.close()
    for vname in VIEWS:
        print(vname)
        for sid in stops:
            print("  %-9s " % sid + " | ".join("%s %s median %.0f" % (l, [round(x) for x in res[(vname, sid, l)]], statistics.median(res[(vname, sid, l)])) for l, _, _ in variants))

if __name__ == "__main__": main()
