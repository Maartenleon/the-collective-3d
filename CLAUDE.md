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
index.html                built website, in the repo root so it is the main URL (~14 MB, scene inlined); links site/styles.css and site/icons/
site/styles.css           the website's stylesheet, copied by the build (linked with ?v=<hash> so browsers never keep an old one)
site/3d.html              tiny redirect to ../ (old links keep working); written by the build
site/orkest-model.html    built model only, free orbit camera + isolation panel (for checking the scene; not linked from the website)
site/icons/               favicon (same as the 2D site: dark square, vermilion dot), linked from both pages
bron/build.py             builds both pages from the sources below
bron/model/               the 3D scene (shared by both builds)
  head.html               page shell + scene config (STAGE, BOARD, colours, camera presets)
  body.js                 renderer, film-look post pass, materials, stage/bowl/hills/board/rehearsal geometry, hierarchy
  _dress_src.js           concert dress helpers
  _people_rest.js         Rocketbox loading, seated poses (IK), baking to static meshes, dress, the live conductor
  tail.js                 model-only UI: isolation, scene tree, click-to-select, cameras
  layout-gen.py           older generator for the seating layout (reference)
bron/site/                the scroll story (replaces tail.js in the site build)
  head.html               all text panels and the loader (plain --color-bg screen with the opening text and a serif percentage); paths are relative to the repo root (site/styles.css, site/icons/)
  styles.css              all website CSS
  content.js              the words of the problems (cards + left panel) and framework parts (right panel); edit text here
  story.js                STOPS (frames), camera moves, focus/fade, melody lines, glow, tension, input, side panels
bron/assets/rocketbox/    pre-processed Microsoft Rocketbox avatars (FBX + textures), MIT licence
bron/assets/heads.json, prefix.json   head geometry used to give musicians varied faces
bron/assets/pipeline/     scripts that produced the processed assets (reference; originals from github.com/microsoft/Microsoft-Rocketbox)
bron/test/                Playwright screenshot scripts (open.js: shared launch + open by URL)
docs/                     story line, scan, change list, part 4 text, model purchase research, inputs from Kai
beelden/                  latest reference screenshots
```

## Build and test

```
python3 bron/build.py          # -> index.html (+ site/styles.css, site/3d.html redirect)
python3 bron/build.py model    # -> site/orkest-model.html
```

No npm needed for the build. three.js r147 loads from cdn.jsdelivr.net (UMD build, legacy colour mode: hex colours are linear).

Screenshots: serve the folder above the repo first (`cd ~/Downloads && python3 -m http.server 8099`). The scripts open the site by URL (default http://127.0.0.1:8099/the-collective-3d/; pass another URL or a file path as the first argument), never by pasting the HTML into an empty page, because the site uses relative paths.
```
cd bron/test && npm install
PFX=out/a STOPS='["open","t5","c0"]' WAIT=4000 node story10.js     # MOB=1 for a 390x844 phone
```
`open.js` uses the Chromium of the earlier sandbox (software GL) when it exists, otherwise the installed Chrome.
`story10.js` reads `STOPS` (indices or stop ids) and saves one PNG per stop. `poster.js` made the old loader photo (no longer used: the loader is a plain dark screen, and the brand, About button, timeline and scroll hint fade in once loading is done, class `is-ready`). `ten.js` screenshots the tension stop at given times. Loading takes ~2 minutes under software rendering. `window.__story` exposes `go(i|id)`, `stops`, `pause(bool)`. Without Node, Python Playwright with the installed Chrome works too (`channel="chrome"`, loads in seconds with the GPU).

## How the story code works (bron/site/story.js)

- `STOPS` array: one entry per stop. Fields: `id`, `name` (timeline name; on the first stop of each segment, and on `d1` where the label changes mid-segment), `ch` (part index, informational), `cam` (`K(pos,target,fov)` or `frame(box,dir,fov,k,lift)`), `seq`/`bar`/`hold`/`dur` (stops with the same `seq` auto-play as one frame; `bar` groups steps for the fill timing), `beats` (centred texts), `panel` (left panel id), `fw` ("big"/"side"/"coll") + `show` (framework figure), `focus(tags,t)` + `fallen` (what stays lit), `glow`, `chaos`, `off` (tension), `booth`, `late`, `coll` (part 4), `shade`, `fore` (dark, blurred foreground over the audience), `caption`, `labels`, `line`, `problems`.
- Scrolling during a sequence jumps past the whole sequence; Skip does the same.
- Body text in panels and on the About page uses the tokens `--text-body`, `--leading-body` and `--color-body` (one place to change size and colour; smaller on phones). Problems view: headings "Problems we see" and "Our framework that helps solve these" share one line at `--problems-top`; the framework (`--problems-fw-size`) sits level with the first problem.
- Problems stop: a card opens a panel from the left (recognise, where it goes wrong, how the framework solves it with links to the parts, concept pills); a part in the figure (or a link) opens a panel from the right. Both are built from `PROBLEMS`, `PARTS` and `LABELS` in content.js; the figure lights the parts the open panel is about. Esc, the close button, a click elsewhere or leaving the stop closes them; on phones one at a time.
- Framework miniature: the Plan, Blueprint, Means and Orchestration panels carry a 64px copy of the framework figure top right, its top level with the kicker (52px on phones; same geometry as `#fw`, shapes only, the panel's part in `--color-text`, the rest and Run/Change in `--color-line`). Nothing in the top-right corner of the film. Between a stop with the big diagram and one of these panels, the big diagram shrinks into the miniature (FLIP), driven by the camera move's progress; `FW_FLIP` sets which part of the move. Reduced motion: crossfade.
- Timeline (bottom left, `<nav data-timeline>`) is the only progress UI: no dots, nothing in the bottom middle. One segment per scroll step (a stop on its own or a whole sequence, built from `STOPS` into `SEGS`), passed segments full, the active one fills with the progress through its steps, cream playhead, never vermilion. Segments are buttons (32px hit area, 1px line, 3px on hover/focus); hover or focus previews "05 Blueprint" in the number and label; roving tabindex (one tab stop, arrows move, Enter/Space jumps). Order: number, bar, label, a thin divider, play/pause, Skip. The bar ends where the panels end (`--timeline-bar-width` follows `--panel-width`). Play story also carries on to the next segments (`STORY.hold` seconds on a stop without its own `hold`); scrolling, swiping, a key or a segment click stops it. Skip is a quiet link after play, visible only in a sequence. Phone (<=720px): two rows, number, label, divider, play and Skip above, the bar full width below; panels use the same gutters as the bar. Below 1100px the Scroll hint is hidden (the timeline reaches the middle). Labels and timings live in `STORY` next to `STOPS`; knobs (`--timeline-bar-width` etc.) at the top of the `.timeline` rule; JS finds these elements via `data-timeline-*`.
- Merged frames: `orch`/`d1`/`d2` share seq "dims" (frame 7 into 8); `question`/`problems` share seq "you" (frame 9 into 10).
- Tension (stop `t5`): brass players rotate away (`rotation.y`), conductor arms lowered via `poseArms`, see `tension()`.
- Mesh tags (`tagsOf`): section, player, stand, conductor, audience, env, booth, grass; litOf decides opacity per stop.
- Gotcha: a `//` comment in the middle of a line swallows the rest of the line once built; keep comments at line end.

## Deployment (GitHub Pages)

Public repo github.com/Maartenleon/the-collective-3d, served by GitHub Pages from branch `main`, folder `/ (root)`, no GitHub Actions and no build on GitHub (the token has no Workflows rights; ask before adding Actions).

- Website: https://maartenleon.github.io/the-collective-3d/ (root `index.html` is the website itself; `site/3d.html` redirects there)
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
3. Smaller file: compress models (FBX to compressed GLB), expected 3-5x smaller; lazy-load audience/rehearsal/box office.
4. Programme board text (frame 4) to confirm with Kai.
5. Phone: Means section labels overlap; problems list overlaps the stage in frame 10.
6. The 8 problems now come from docs/SYMPTOMS.md of the 2D site (bron/site/content.js); the panel texts (recognise, wrong, solve) are first drafts to check with Kai. Routes after frame 10 are on hold until Kai says otherwise.
