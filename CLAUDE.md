# The Collective: 3D orchestra website (handover brief for Claude)

Read this first. It replaces the project memory of the previous Claude workspace (copied in `docs/claude-geheugen/` for detail).

## What this is

The Collective is a Dutch consultancy (domain thecollective.nu). Its framework is explained with an orchestra analogy. This project turns that analogy into a three.js scene with a scroll story: one scroll = one frame, the camera flies through an outdoor concert in a red earth bowl.

- Owner: Kai. Write to Kai in **Dutch**. Site texts are **English**.
- Existing 2D site: https://kjvcs.github.io/The_Collective/ (repo kjvcs/The_Collective; Kai uploads files himself). Style reference: https://kriss.ai/home/front-desk
- Current story line: `docs/verhaallijn-v3.md` (11 frames, 4 parts, 9 scrolls). Open points: end of that file and `docs/aanpassingen-na-de-scan.md`.

## How Kai likes to work

- Kai is new to this. Spar first: ask short questions answerable with one letter, mark your recommendation with ★, and challenge the direction when it seems off.
- Show example images (screenshots) before building a change into the site, then publish only after Kai picks.
- Kai dislikes endless scrolling and "artificial" effects (a zigzag-line tension effect was rejected; the tension now comes from the orchestra itself).
- Plain language, no jargon, short answers.

## Framework (content rules)

- 3 building blocks: **Plan** (the piece: what we play and the budget), **Blueprint** (the score: design of business, data, tech), **Means** (the orchestra: people, skills, tools, funding).
- 2 dimensions: **Run** (tonight's concert, organised by function) and **Change** (next season's symphony, in rehearsal; multidisciplinary teams around a value stream).
- **Orchestration** = the conductor. The conductor is NOT The Collective; The Collective is not in the picture, it helps the orchestra.
- "The score" = Blueprint only, never the whole framework. Part 4 must not name specific services or products; cheeky tone is wanted.
- Framework figure = round variant "B2" (three bands, two columns, circle with arrow).

## Visual rules (art direction, see `docs/inputs/`)

Wide horizon, small ensemble, only the conductor bright orange-red (long red coat), white plaster stage with texture and shadow in a smooth red earth bowl, low lavender hills, muted sky. No film grain or lens fringing (Kai removed the "video filter" on 25 Oct 2026); the colour grade of the film pass stays. No saturated blue or green, no pure grey or #000, no stock photos, no heavy card borders. Musicians in black concert dress on black chairs; audience in dark evening wear. No grain field in the opening shot.

## Files

```
index.html                built website, in the repo root so it is the main URL (~1.3 MB: scene code and the conductor's avatar inlined); links site/styles.css, site/icons/, site/orchestra.glb, site/audience.glb
site/styles.css           the website's stylesheet, copied by the build (linked with ?v=<hash> so browsers never keep an old one)
site/orchestra.glb        the baked musicians and rehearsal players with all their textures; copied by the build from bron/assets/baked/, linked with ?v=<hash> and preloaded; the loader waits only for this
site/audience.glb         the baked audience (geometry; it reuses the orchestra's textures), loaded in the background after the orchestra and faded in
site/3d.html              tiny redirect to ../ (old links keep working); written by the build
site/orkest-model.html    built model only, free orbit camera + isolation panel (for checking the scene; not linked from the website)
site/icons/               favicon (same as the 2D site: dark square, vermilion dot), linked from both pages
bron/build.py             builds both pages from the sources below
bron/model/               the 3D scene (shared by both builds)
  head.html               page shell + scene config (STAGE, BOARD, colours, camera presets)
  body.js                 renderer, film-look post pass, materials, stage/bowl/board/rehearsal geometry, the land beyond the bowl (one procedural terrain, settings in LAND in head.html), hierarchy
  _dress_src.js           concert dress helpers
  _people_common.js       shared by site, model page and bake: Rocketbox materials (rbMaterial, tintBody), register/unregister, the live conductor
  _people_bake.js         the people pipeline (seated poses by IK, head swaps, baking skinned meshes, dress, audience) and the export; only in the bake page
  _people_rest.js         site and model page: loads orchestra.glb (progress for the loader), then audience.glb in the background; rebuilds the materials from the recipes in the extras, places and registers everyone, builds the two conductors
  tail.js                 model-only UI: isolation, scene tree, click-to-select, cameras
  layout-gen.py           older generator for the seating layout (reference)
bron/site/                the scroll story (replaces tail.js in the site build)
  head.html               all text panels and the loader (plain --color-bg screen with the opening text and a serif percentage); paths are relative to the repo root (site/styles.css, site/icons/)
  styles.css              all website CSS
  content.js              the words of the problems (cards + left panel) and framework parts (right panel); edit text here
  story.js                STOPS (frames), camera moves, focus/fade, melody lines, glow, tension, input, side panels
bron/assets/rocketbox/    pre-processed Microsoft Rocketbox avatars (FBX + textures), MIT licence
bron/assets/heads.json, prefix.json   head geometry used to give musicians varied faces (bake only)
bron/assets/baked/orchestra.glb, audience.glb   output of the bake (committed): meshopt-compressed people + the original JPG/PNG textures as named images (each texture in the first file that needs it)
bron/bake/bake.py         the bake: builds bron/bake/bake.html (build.py bake), runs it in Chrome, GLTFExporter, gltfpack v0.18 (downloaded to bron/bake/.bin/, gitignored), adds the textures
bron/assets/pipeline/     scripts that produced the processed assets (reference; originals from github.com/microsoft/Microsoft-Rocketbox)
bron/test/                Playwright screenshot scripts (open.js: shared launch + open by URL)
docs/                     story line, scan, change list, part 4 text, model purchase research, inputs from Kai
beelden/                  latest reference screenshots
```

## Build and test

```
python3 bron/bake/bake.py      # -> bron/assets/baked/orchestra.glb + audience.glb; only after changing the people (poses, clothes, colours, faces, seating, _people_bake.js/_people_common.js)
python3 bron/build.py          # -> index.html (+ site/styles.css, site/orchestra.glb, site/audience.glb, site/3d.html redirect)
python3 bron/build.py model    # -> site/orkest-model.html
python3 bron/build.py test     # -> test.html (in .gitignore): seeded Math.random, fixed time for what keeps moving (window.__perfT), window.__perf (renderer, scene, camera, film, groups)
```

Performance and visual checks (Python Playwright with the installed Chrome and the GPU; see docs/perf.md):
```
python3 bron/test/perf.py --label <name>                  # sizes, load times, draw calls, triangles, counts, heap, fps
python3 bron/test/compare.py shoot                        # reference screenshots of every stop at 1440x900 and 390x844 -> bron/test/ref/ (in .gitignore)
python3 bron/test/compare.py check --label <name>         # shoot again and compare with the reference (mean difference, diff images)
```

No npm needed for the build. three.js r147 loads from cdn.jsdelivr.net (UMD build, legacy colour mode: hex colours are linear), including GLTFLoader and libs/meshopt_decoder.js (meshoptimizer 0.18, which is why the bake uses gltfpack 0.18).
The pages fetch site/orchestra.glb and site/audience.glb, so they only work over http (a local server or online), not by opening the file (file:// blocks the fetch).
Baked people: each person is a node "Lichaam" with extras { list: "mus"|"aud", i, outfit } and is attached to MUS[i].m / AUD[i].m; every mesh has extras { n: name, spec: material recipe }. gltfpack puts each mesh in a child node that undoes the quantization (the recipe stays on the named parent) and quantizes the UVs with one texture transform per file, which the loader copies onto the textures (the audience gets clones of the orchestra's textures with its own transform). The late audience is registered at opacity 0 with userData.fadeIn, so the focus loop fades it in even during a camera move. While the loader is up, the scene is drawn 4 times a second (nobody sees it). goTo waits (waitGo, at most AUDIENCE_WAIT = 8 s) when the target stop would show the audience before it has loaded; the rehearsal tint is one dark charcoal (REH in _people_bake.js), Kai's choice. The glow stops (t2, m2) only light the instruments; the musicians keep their colours (the old grey step is gone, Kai). The bake must reproduce the old pipeline exactly: same MUS/AUD order, same womenSeen counting.

Screenshots: serve the folder above the repo first (`cd ~/Downloads && python3 -m http.server 8099`). The scripts open the site by URL (default http://127.0.0.1:8099/the-collective-3d/; pass another URL or a file path as the first argument), never by pasting the HTML into an empty page, because the site uses relative paths.
```
cd bron/test && npm install
PFX=out/a STOPS='["open","t5","c0"]' WAIT=4000 node story10.js     # MOB=1 for a 390x844 phone
```
`open.js` uses the Chromium of the earlier sandbox (software GL) when it exists, otherwise the installed Chrome.
`story10.js` reads `STOPS` (indices or stop ids) and saves one PNG per stop. `poster.js` made the old loader photo (no longer used: the loader is a plain dark screen, and the brand, About button, timeline and scroll hint fade in once loading is done, class `is-ready`). `ten.js` screenshots the tension stop at given times. Loading takes ~2 minutes under software rendering. `window.__story` exposes `go(i|id)`, `stops`, `pause(bool)`. Without Node, Python Playwright with the installed Chrome works too (`channel="chrome"`, loads in seconds with the GPU).

## How the story code works (bron/site/story.js)

- `STOPS` array: one entry per stop. Fields: `id`, `name` (timeline name; on the first stop of each segment, and on `d1` where the label changes mid-segment), `ch` (part index, informational), `cam` (`K(pos,target,fov)` or `frame(box,dir,fov,k,lift)`), `seq`/`bar`/`hold`/`dur` (stops with the same `seq` auto-play as one frame; `bar` groups steps for the fill timing), `beats` (centred texts), `panel` (left panel id), `fw` ("big"/"side"/"coll") + `show` (framework figure), `focus(tags,t)` + `fallen` (what stays lit), `glow`, `chaos`, `off` (tension), `booth`, `late`, `coll` (part 4), `shade`, `fore` (dark, blurred foreground over the audience), `caption` (one italic line, no label above it), `line`, `problems`.
- Scrolling during a sequence jumps past the whole sequence; Next does the same.
- The two melody lines (b3, b4) use the panel palette (vermilion and cream) with the same fine strokes as the lines in "It isn't"; leaving Blueprint they are gone at once.
- The Orchestration arrow is driven by story.js (`drawArc` / `arcTick`): the line draws itself and a separate head path rides on its end. On the framework frame (`fw: "big"`) it loops (drawn, held, then the tail runs after the head until both are gone); elsewhere it draws once; reduced motion shows it whole.
- Story panels (Plan, Blueprint, Means, Orchestration, Run and Change): kicker "Part · the metaphor", a serif sentence as title, then what it means in an organisation as body text without a heading.
- Body text in panels and on the About page uses the tokens `--text-body`, `--leading-body` and `--color-body` (one place to change size and colour; smaller on phones). Problems view: headings "Problems we see" and "Our framework" share one line at `--problems-top`; the framework (`--problems-fw-size`) sits level with the first problem. On desktop `--problems-top` centres the block (headings plus framework) vertically; the camera puts the stage below it (phones: up behind the framework), so the list stands on dark ground.
- Problems stop: a card (only its sentence; the `theme` in content.js is not shown) opens a panel from the left: the full sentence as title (it is the recognition), "Where it goes wrong" and "How the framework solves it"; no kicker, no part links, no concepts: the figure beside it lights the parts and opens them. A part in the figure opens a panel from the right (title, question, text, in your organisation, the problems it helps solve; no concepts). Both are built from `PROBLEMS`, `PARTS` and `LABELS` in content.js. The panels are as tall as their content and scroll only beyond the room above the timeline; on phones they sit centred on the screen both ways. Esc, the close button, a click elsewhere or leaving the stop closes them; on phones one at a time. On phones the list scrolls: a swipe inside a scrollable list (problems, About) scrolls it instead of changing the stop.
- The story panels carry no copy of the framework: between the big diagram and a panel stop the diagram simply fades out (`.fw` opacity transition). The big figure shows RUN and CHANGE above their columns, no text down them.
- Timeline (bottom left, `<nav data-timeline>`) is the only progress UI: no number, no dots, no play button, no Scroll hint, nothing in the bottom middle. One segment per scroll step (a stop on its own or a whole sequence, built from `STOPS` into `SEGS`), passed segments full, the active one fills with the progress through its steps, cream playhead, never vermilion. Segments are buttons (32px hit area, 1px line, 3px on hover/focus); hover or focus previews the segment's name in the label; roving tabindex (one tab stop, arrows move, Enter/Space jumps). Order: bar, label, Next. The bar is as wide as the panels (`--timeline-bar-width` = `--panel-width`). Sequences still play by themselves; Next is the only button: it goes to the first step of the next part (a running sequence counts as one part) and shows everywhere but the last part, the opening included. Phone (<=720px): two rows, label and Next above, the bar full width below; panels use the same gutters as the bar. Labels live in `STORY` next to `STOPS`; knobs (`--timeline-bar-width` etc.) at the top of the `.timeline` rule; JS finds these elements via `data-timeline-*`. `__story.pause` (screenshot scripts only) still pauses a sequence.
- Phones: the opening uses a longer lens (orchestra a little wider than the screen, with ground between the stage and the timeline); the opening text and the loader text share `--open-top` (55%, phones 47%; story.js reads it once); the rehearsal shot (d2) and the Plan board use `abovePanel`, which tilts and pulls back the camera so the subject sits in the free space above the panel on any phone height; on the problems stop the framework scrolls with the list (`--problems-scroll`). The audience's dark foreground ends in `--color-ground-deep`, the deepest shadow on the red bowl.
- "The complexity" (t1-t5): the whole orchestra stays seated and lit (no sections one by one, Kai); "Different roles" and "Different capabilities" come in t1 (`linesTo`, `LINE_GAP`), "Different perspectives" with the glow (t2), "One performance" together with the coloured lines (t3, panel palette). During the flight only "It isn't." shows; from arriving a line every `LINE_GAP` (0.9 s), the tension `TENSION_GAP` (1.9 s) after the last line; the holds of t1-t3 are derived from these. `fadeLate` on a stop (b2) keeps the rest visible until the camera has arrived. Big lens changes (fov ratio > 1.6) interpolate the framed size, so the flight never zooms out and back in.
- Framework build-up (frame 3, f0-f6): one part every `FW_STEP` (0.4 s); Run and Change come one after the other. The figure has no colours of its own: every part uses the panel tokens (`--panel-fill`, `--panel-border`), text sizes are in styles.css (`.fw .sub`, `.fw .lab--big`).
- Panels, problem cards (hover), the framework-parts and the diagram share `--panel-fill` / `--panel-border`; every close cross is `.close` (`.close--corner`, `.close--sticky`). The contact address lives once, in `CONTACT` (content.js): shown on the About page, copied by a click ("Copy" / "Copied"), and opened by Let's talk (mailto). The About page: title, a two-sentence intro, three columns (the second with a text link "The problems we solve" to the problems stop, `data-coll-go`) and a contact row ("Sounds familiar?", Let's talk and the address); no kicker. Its close cross shows only when the page lies over another stop, opened with the button (`.coll.is-overlay`, from `meetFrom`); on its own stop (c0) there is none. It fits a 390x844 phone without scrolling inside.
- The audience appears from "question" on (`AUDIENCE_FROM`); the programme board stands on the ground beside the stage, just outside the opening shot (and hidden in `open` on very wide screens). Faded figures cast no shadow (focus loop: `castShadow` only above opacity 0.5). The glow lights the instruments in their own colour (`GLOW_SELF`) with a touch of warmth.
- The audience, the grass and the board (hidden early on) change visibility only out of view: during a camera move they hold while their place is on screen, switch at once off screen, and fade after arriving (focus loop, `inView`).
- Merged frames: `orch`/`d1`/`d2` share seq "dims" (frame 7 into 8); `question`/`problems` share seq "you" (frame 9 into 10).
- Frame 2 ("The complexity" on the timeline) starts at `t1` (Different roles); its lines count from arriving. `oneByOne` (section by section) is used by Means (m1) only.
- Things that come and go between stops (audience, grass, board): out of view they switch at once; appearing in view they wait until out of view or arrival; leaving in view they fade in the first half of the flight.
- Tension (stop `t5`): brass players rotate away (`rotation.y`), conductor arms lowered via `poseArms`, see `tension()`.
- Mesh tags (`tagsOf`): section, player, stand, conductor, audience, env, booth, grass; litOf decides opacity per stop. The focus loop updates opacity until it is exactly on its goal (an older skip of small steps let fades stall just above the cut-off, leaving faded people casting shadows).
- Shadows: `renderer.shadowMap.autoUpdate` is false; `shadowTick` redraws the map when a caster's `visible` changes, when the people arrive, while the brass turn (t5), and 15 times per second while the live conductor moves. Anything new that moves and casts a shadow must set `shadows.dirty = true`.
- Gotcha: a `//` comment in the middle of a line swallows the rest of the line once built; keep comments at line end.

## Performance rules (keep these on every change; background in docs/perf.md)

Measure before and after any change to the scene, the people or the frame loop: `python3 bron/build.py test`, then `bron/test/compare.py check` (must stay at the noise floor, about 0.2 or less per stop) and `bron/test/perf.py` / `bron/test/abfps.py` (interleaved, fresh browser per run; single fps runs on this Mac vary by 30 % or more).

1. No building in the browser. People are baked (`bron/bake/bake.py` -> orchestra.glb, audience.glb). A change to poses, clothes, colours, faces or seating means a rebake, never runtime code. Only the two conductors are built live.
2. Nothing large inlined in index.html. New models, textures or data go in their own file under site/, linked with a `?v=<hash>` (build.py does this) so caches never serve an old one. The loader waits only for what the opening shot shows; everything else loads behind it and fades in (see the audience).
3. Shadows are not redrawn every frame (`renderer.shadowMap.autoUpdate = false`). Anything new that moves and casts a shadow sets `shadows.dirty = true` (or a rate like the conductor's 15 per second). Static things never need to.
4. Draw calls: on the site, meshes that always fade together are merged per material after loading (`mergeUnit` in story.js). A new unit that fades or moves on its own (a stop's `focus`, a melody player, something that turns) must be kept out of its section's merge, like the brass and LINE1/LINE2 players. Don't give a mesh its own material copy unless it must change on its own; share materials otherwise.
5. Material colours that change at runtime (glow) keep their original values in `glowMats`; never clone such a material without carrying that over. Shader hooks (onBeforeCompile) must be per material and must not replace another effect's hook (the tint was once lost that way); give each variant its own customProgramCacheKey.
6. Fades: the focus loop must always land exactly on the goal and update `visible` (a fade that stalls above the cut-off keeps casting full shadows). Late arrivals start at opacity 0 with `userData.fadeIn`.
7. Transparent meshes are sorted by their position: a merged or moved mesh keeps the average position of its parts, or faded players start showing through the floor.
8. Per frame: no DOM reads (getComputedStyle, getBoundingClientRect) unless something is actually animating; while the loader is up the scene is drawn 4 times a second only.
9. The canvas has `antialias: false` (the film target is multisampled); don't lower the pixel ratio, shadow map size or model detail to gain speed: the look must stay the same.
10. Test on phone size too (390x844) and without a GPU once in a while (Chrome with `--disable-gpu --use-angle=swiftshader`): slow devices show problems the Mac hides.

## Deployment (GitHub Pages)

Public repo github.com/Maartenleon/the-collective-3d, served by GitHub Pages from branch `main`, folder `/ (root)`, no GitHub Actions and no build on GitHub (the token has no Workflows rights; ask before adding Actions).

- Website: http://thecollective.nu/ (custom domain since 26 Oct 2026: `CNAME` in the root, set via GitHub; keep that file. maartenleon.github.io/the-collective-3d/ redirects there. Root `index.html` is the website itself; `site/3d.html` redirects there)
- Model builder: https://maartenleon.github.io/the-collective-3d/site/orkest-model.html
- Built files are committed: run `python3 bron/build.py` (and `model`) before committing; `index.html`, `site/styles.css` and `site/3d.html` are written by the build.
- All paths relative (no leading `/`, no localhost): the site lives under the subpath `/the-collective-3d/`. Pages is case-sensitive, macOS is not: keep file names and references lowercase and identical.
- `.nojekyll` in the root stays (no Jekyll processing). Do not move or rename folders without asking.
- Test before pushing: serve the parent folder (`cd ~/Downloads && python3 -m http.server 8099`) and open http://127.0.0.1:8099/the-collective-3d/; there must be no 404s.
- The repo is public: no tokens, keys, client names or internal documents. `docs/` holds internal notes and inputs (see the check of 24 Oct 2026 in the chat); decide with Kai what stays public.

## Licences and publishing

- Rocketbox avatars: MIT. three.js: MIT.
- If paid models are bought later (`docs/modellen-kopen.md`): email the seller first, never put purchased source files in a public GitHub repo, only publish the packed build.

## Open work (priority order suggested to Kai)

1. Client quote + one result with a number in part 4 (Kai supplies).
2. Final email address (placeholder soundcheck@thecollective.nu) and where "Let's talk" links.
3. Performance work on branch `perf` (see docs/perf.md): people baked into site/orchestra.glb + audience.glb, shadow map redrawn only on change, the loader waits only for the orchestra. Open: phase 4 (merging meshes, about 500 draw calls instead of 1,400).
4. Programme board text (frame 4) to confirm with Kai.
5. Phone: problems list overlaps the stage in frame 10.
6. The 8 problems now come from docs/SYMPTOMS.md of the 2D site (bron/site/content.js); the panel texts (recognise, wrong, solve) are first drafts to check with Kai. Routes after frame 10 are on hold until Kai says otherwise.
