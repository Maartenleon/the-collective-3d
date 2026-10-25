# Performance: measurements per phase

Branch `perf`. Measured on Kai's Mac (Apple GPU) with Chrome through Python Playwright (`channel="chrome"`), served locally under the subpath (`/the-collective-3d/`). Loading is local, so download time is not in these numbers; the size table shows what a visitor downloads.

## How to measure

```
python3 bron/build.py && python3 bron/build.py test     # index.html (public) and test.html (test build, in .gitignore)
cd ~/Downloads && python3 -m http.server 8099            # in another terminal
python3 bron/test/perf.py --runs 3 --label <name>        # sizes, load times, draw calls, triangles, counts, heap, fps
python3 bron/test/compare.py check --label <name>        # screenshot per stop at 1440x900 and 390x844, compared with bron/test/ref/
```

- `test.html` differs from `index.html` in three ways only: `Math.random` is seeded (mulberry32, seed 1), so soil grain, grain stalks and their colours are the same on every load; what keeps moving (conductor, wind, the coloured lines of frame 2, the brass sway in t5) runs on a fixed time `window.__perfT`; and `window.__perf` gives the renderer, scene, camera, film pass and the main groups. The public build has none of this.
- Load times: median of 3 cold loads of the public `index.html` (cache off). "Scene" = the scene and story are running (`window.__story`); "people" = all musicians and audience are built (`window.__people`); "building them" = the part of that spent in `_people_rest.js` (`__people.total`); "ready" = the loader is gone (`body.is-loading` removed).
- Draw calls and triangles: one frame rendered through the film pass with `renderer.info` (no auto reset), once with the shadow pass and once without; the difference is the shadow pass. Counts include the 5 small post passes (bright, blur, final).
- fps: median of three 5 s windows per stop, with Chrome's 60 fps cap and vsync off, so it shows headroom. Phone = 390x844 at pixel ratio 2.
- Run-to-run spread on this Mac is large (a cold load took 3.1 s in one run and 8.0 s in another, depending on what else the Mac was doing). Compare phases measured in the same session; later phases re-measure the baseline build alongside.

### Comparison test: noise floor

Two shoots of the same build, compared with each other (mean difference on a 0-255 scale; share of pixels that differ by more than 16):

- 41 of 54 shots: mean 0.00 (identical or a handful of pixels).
- Highest: `m1` (desktop 0.16 / 0.26 %, phone 0.15 / 0.29 %). In m1 the sections light up one by one on a timer since the stop started, so the moment of the shot matters; the section labels STRINGS and BRASS also overlap there (an existing layout issue, not part of this work).
- Next: phone `b1`-`b4`, `t1` (0.05-0.08): a few anti-aliased pixels on the panel kicker and the miniature.

So a difference of about 0.2 or less on a stop counts as "the same".

## Phase 2: baseline (main as of commit 6c621ef, plus phase 1 which changes no pixels)

### Size

| File | Raw | gzip |
|---|---|---|
| index.html | 14.18 MB | 8.44 MB |
| site/styles.css | 0.03 MB | 0.01 MB |

What is inside index.html:

| Part | Raw | gzip |
|---|---|---|
| FBX models (10 Rocketbox avatars, base64) | 7.35 MB | 3.87 MB |
| Textures (73 JPG/PNG, base64; 3.9 MB decoded) | 5.18 MB | 3.77 MB |
| Head geometry (HEADS from heads.json) | 1.44 MB | 0.73 MB |
| Everything else (HTML and all code) | 0.21 MB | 0.07 MB |

### Load times (local, median of 3 cold loads)

| | Scene running | People built | of which building them | Loader gone |
|---|---|---|---|---|
| desktop 1440x900 | 1.51 s | 3.16 s | 2.41 s | 3.54 s |
| phone 390x844 | 1.51 s | 3.09 s | 2.36 s | 3.45 s |

### Per frame (one stop each)

| | Stop | fps | Draw calls | of which shadow | Triangles | of which shadow | Visible meshes | Shadow casters | JS heap |
|---|---|---|---|---|---|---|---|---|---|
| desktop | open | 73 | 1307 | 599 | 1,570,690 | 658,764 | 678 | 599 | 183 MB |
| desktop | t5 | 101 | 1412 | 755 | 1,999,480 | 1,046,928 | 884 | 755 | 186 MB |
| desktop | problems | 57 | 1467 | 755 | 2,029,710 | 1,046,928 | 884 | 755 | 192 MB |
| phone | open | 133 | 1305 | 599 | 1,322,366 | 597,964 | 678 | 599 | 192 MB |
| phone | t5 | 116 | 1284 | 755 | 1,611,018 | 986,128 | 884 | 755 | 197 MB |
| phone | problems | 84 | 1465 | 755 | 1,738,954 | 986,128 | 884 | 755 | 200 MB |

fps per stop is the median of three windows: desktop open [78.6, 65.2, 72.9]; desktop t5 [100.7, 98.9, 101.5]; desktop problems [53.1, 56.7, 57.6]; phone open [136.9, 133.4, 124.0]; phone t5 [119.2, 113.9, 116.2]; phone problems [83.5, 82.0, 84.6].

### Scene totals (desktop, stop "open")

- 888 meshes, 888 materials (one per mesh), 83 textures in materials; on the GPU 1148 geometries, 88 textures, 29 shader programs
- 1,337,050 triangles and 5,258,218 vertices in the scene

Triangles in the scene per group (geometry, including instances; not all of it is drawn in every frame):

| Group | Triangles | Meshes |
|---|---|---|
| musicians (incl. instruments, chairs) | 484,932 | 540 |
| audience (incl. chairs) | 388,260 | 204 |
| far hills (4 ranges) | 253,440 | 4 |
| bowl terrain | 105,800 | 1 |
| rehearsal on the rim (Change) | 54,957 | 66 |
| grain field (instanced) | 35,428 | 2 |
| conductor (live) | 7,515 | 5 |
| stage | 3,996 | 8 |
| music stands | 1,626 | 50 |
| sky | 960 | 1 |
| programme board | 86 | 3 |
| box office | 50 | 4 |

Observations for the next phases:
- Every mesh has its own material (888 meshes, 888 materials), which is what makes per-mesh fading possible but also costs a draw call each.
- The shadow pass is about half of all draw calls (599-755 of 1300-1470) and half of the triangles, every frame.
- Building the people takes most of the load: about 2.4 s of the 3.5 s here (and 5.8 s of 8.4 s in a busier run); far more without a GPU (about 165 s of 180 s in the earlier software-GL measurement).
- The far hills are 253k triangles in 4 meshes, the bowl terrain 106k in 1: few draw calls, many triangles.
- The draw calls are much the same per stop (1300-1470), so the fps differences between stops come from what fills the screen: switching off the far hills in "open" raised it from 80 to 114 fps, the terrain to 89, the shadow pass to 87, the people only to 78 (one quick test, desktop).
- Measurement artefact found and fixed: right after the three cold loads, the first stop measured 12 fps (instead of about 75). The fps is now measured in a fresh browser after 5 s of warming up.
