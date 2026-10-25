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

## Phase 3: the people baked in advance

### What changed

- The seated people (54 musicians and rehearsal players, 48 in the audience) are no longer built in the browser. `bron/bake/bake.py` runs the old pipeline once (FBX parsing, IK poses, head swaps, dress, baking skinned meshes) in Chrome, exports the result with GLTFExporter, compresses it with gltfpack 0.18 (`-cc -kn -ke -vt 16`: meshopt, 14-bit positions, 8-bit normals, 16-bit UVs) and adds the 69 original JPG/PNG textures as named images (byte for byte). Output: `bron/assets/baked/people.glb`, copied by the build to `site/people.glb?v=<hash>` and preloaded from the head.
- gltfpack 0.18 because three r147's `libs/meshopt_decoder.js` is meshoptimizer 0.18 (newer gltfpack versions may write a format that decoder does not read).
- The site loads people.glb with GLTFLoader and the meshopt decoder, rebuilds every material from the recipe stored per mesh (rbMaterial, tintBody, material(), the contact-shadow material), so colours come from the same code as before, and registers everyone as before (focus, fading, clicking). The loader shows the real progress: bytes in (to 70 %), decoded (80 %), placed (100 %).
- The two conductors stay live: only Business_Male_01's FBX and its four textures remain in index.html; the nine other FBX files and heads.json are gone from the page.
- Re-indexing (mergeVertices) per mesh before export: each piece keeps only its own vertices (5.26 M vertices in the scene before, 1.25 M now; same triangles).

### Size

| | Baseline | Phase 3 |
|---|---|---|
| index.html | 14.18 MB (gzip 8.44) | 1.29 MB (gzip 0.71) |
| site/people.glb | - | 9.52 MB (gzip 7.86): geometry 5.92 MB, textures 3.60 MB |
| What a visitor downloads (gzip) | 8.44 MB | 8.57 MB |

The download is not smaller: the file now holds 102 finished, individually posed people (514,700 vertices) instead of 10 avatars from which the browser posed them. gltfpack `-c` gave 6.51 MB geometry (5.12 MB gzip), `-cc` 5.92 MB (4.41 MB gzip); `-cc` is used.

### Load times (same session; the baseline is served from a worktree of 3f6834c next to this branch)

| | Baseline: scene / people / loader gone | Phase 3: scene / people / loader gone |
|---|---|---|
| desktop 1440x900 (GPU) | 1.37 / 2.85 / 3.20 s | 1.18 / 1.66 / 1.96 s |
| phone 390x844 (GPU) | 1.37 / 2.92 / 3.26 s | 1.11 / 1.54 / 1.80 s |
| software rendering (no GPU, SwiftShader), one cold load | 27.1 / - / 78.6 s | 28.6 / 45.7 / 51.8 s |

Local loading, so without download time; online the download of people.glb (7.86 MB gzip) comes on top, starting right away thanks to the preload.

Without a GPU the old wait was not the building itself but the frames in between: the people code waited one frame after every 4 people, and under software rendering one frame takes over a second (26 frames, about 45 s). Placing is cheap now, so it waits one frame in total. The rest (about 28 s before the scene runs, and frames drawn behind the loader that nobody sees) is for phase 6.

### Per frame and memory

fps per run varies a lot on this Mac (the same build measured 73 and 106 fps at "open" in two sessions), so fps was compared by interleaving: baseline and phase 3 alternately, three rounds, a fresh browser each time, 4 s per stop, desktop:

| Stop | Baseline (3 rounds) | Phase 3 (3 rounds) |
|---|---|---|
| open | 47, 43, 43 (median 43) | 47, 46, 46 (median 46) |
| t5 | 86, 94, 88 (median 88) | 96, 92, 94 (median 94) |
| problems | 50, 52, 52 (median 52) | 51, 55, 89 (median 55) |

So fps is unchanged or slightly better, as expected: the same meshes are drawn (1,305-1,467 draw calls, the same triangles). Memory: the JS heap went from 170-202 MB to 98-139 MB (no FBX, templates or base64 textures kept around). Vertices in the scene: 5.26 M -> 1.25 M (re-indexed per piece).

### Comparison test

All 54 shots (27 stops x desktop and phone) against the phase-2 reference: highest mean difference 0.16 (m1, the timed section lights, same as the noise floor), next t5 0.07 and b4 0.06; median 0.01. Nothing above the noise floor. In t5, the closest view of the musicians, the diff image shows a faint trace on the black trousers (8-bit normals); it is not visible side by side.

### Also in this phase

- The model page's head had no `<meta charset="utf-8">`; over a local server (which sends no charset) names showed as "Muzikant Â· Viool". Added; GitHub Pages was not affected.
- Fixed an existing fade bug that the comparison test kept catching (b2 and orch, alternating): the focus loop skipped opacity steps smaller than 0.0005, so a fade could stall at 0.054, just above the 0.054 cut-off below which a mesh is hidden. Those people stayed "visible" at 5 % and cast full shadows. Whether it happened depended on frame timing, so visitors could see it too. The loop now updates until the opacity is on its goal and snaps the last 0.002 (bron/site/story.js, focus loop).
- compare.py waits until nothing fades any more before each shot (on top of the fixed settle time).
- Clicking in the model page behaves the same as before (checked on the baseline and this branch with the same clicks).

## Phase 4: skipped for now

Step 1 (the map of what fades and moves together) was done and shown to Kai: about 25 units (environment, grass, audience, box office, stands, the conductor's stand, rehearsal, the rest of the strings, harp, piano, the rest of the woodwinds, percussion, 7 brass players and 6 other melody players one by one, the live conductor). Merging per unit and material (option A) would give about 500 draw calls instead of about 1,400, but not below 200, because the people use 69 different textures; that would need texture arrays and shader changes (option B). Kai chose to do phase 5 first and to come back to A if phase 5 brings little.

## Phase 5: the shadow map is not redrawn every frame

### What changed (bron/site/story.js, "shadows")

- `renderer.shadowMap.autoUpdate = false`. The map is redrawn when a shadow caster appears or disappears (the fades switch `visible`), when the people arrive, while the brass turn in t5, and for the live conductor.
- Checked: the shadow camera is fixed (the sun and its 150 m box do not follow the view), so camera moves need no update. The far hills neither cast nor receive shadows; the bowl terrain casts and receives (106k triangles, now only drawn into the map when it is redrawn).
- The conductor moves all the time; two variants were built and shown to Kai, who chose (a); (b) was removed again:
  - (a) the whole map is redrawn 15 times per second while he moves.
  - (b) the map without him is kept; every frame only his part of the map (a small scissor region) is cleared and redrawn with his depth, and the kept map is merged on top wherever it is nearer the sun (his own render layer; three picks shadow casters by the rendering camera's layers).
- The test build runs the 15-per-second rule on the story clock (`window.__perfT`), so frame-by-frame captures show what a 60 Hz visitor sees.

### Result

Still frames: both variants match the reference on all 54 shots (highest 0.16 at m1, the noise floor), and match "every frame" pixel for pixel.

Moving: 90 frames at 60 per second of the conductor's shadow (`bron/test/out/schaduw/`, local only): (a) differs from "every frame" by 0.00-0.01 on three of four frames (his shadow is up to 1/15 s late), (b) by 0 (one frame 0.09).

fps, interleaved (`bron/test/abfps.py`, 3 rounds, fresh browser each, uncapped), median:

| | Stop | Every frame | (a) | (b) |
|---|---|---|---|---|
| desktop | open | 67 | 72 | 76 |
| desktop | t5 | 106 | 107 | 107 |
| desktop | orch | 99 | 96 | 93 |
| desktop | problems | 68 | 75 | 78 |
| phone | open | 132 | 139 | 135 |
| phone | t5 | 128 | 127 | 125 |
| phone | orch | 175 | 176 | 163 |
| phone | problems | 91 | 101 | 104 |

Kai's choice: (a), and phase 6 next, then decide about phase 4.

Gain: about 5-15 % on the wide views (open, problems), nothing in t5 (the brass move every frame, so the map is redrawn every frame anyway) and nothing or slightly less in orch (the conductor close up). Smaller than the share of draw calls suggested (the shadow pass is about half of them): on this Mac the frame time is mostly what fills the screen (see phase 2), not the number of draw calls.
