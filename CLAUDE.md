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

Wide horizon, small ensemble, only the conductor bright orange-red (long red coat), white plaster stage with texture and shadow in a smooth red earth bowl, low lavender hills, muted sky, film grain. No saturated blue or green, no pure grey or #000, no stock photos, no heavy card borders. Musicians in black concert dress on black chairs; audience in muted evening wear. No grain field in the opening shot.

## Files

```
site/3d.html              built website (open in a browser; ~14 MB, everything inlined)
site/orkest-model.html    built model only, free orbit camera + isolation panel (for checking the scene)
bron/build.py             builds both files from the sources below
bron/model/               the 3D scene (shared by both builds)
  head.html               page shell + scene config (STAGE, BOARD, colours, camera presets)
  body.js                 renderer, film-look post pass, materials, stage/bowl/hills/board/rehearsal geometry, hierarchy
  _dress_src.js           concert dress helpers
  _people_rest.js         Rocketbox loading, seated poses (IK), baking to static meshes, dress, the live conductor
  tail.js                 model-only UI: isolation, scene tree, click-to-select, cameras
  layout-gen.py           older generator for the seating layout (reference)
bron/site/                the scroll story (replaces tail.js in the site build)
  head.html               site CSS (tokens), all text panels, loader with inlined poster photo
  story.js                STOPS (frames), camera moves, focus/fade, melody lines, glow, tension, input
bron/assets/rocketbox/    pre-processed Microsoft Rocketbox avatars (FBX + textures), MIT licence
bron/assets/heads.json, prefix.json   head geometry used to give musicians varied faces
bron/assets/pipeline/     scripts that produced the processed assets (reference; originals from github.com/microsoft/Microsoft-Rocketbox)
bron/test/                Playwright screenshot scripts
docs/                     story line, scan, change list, part 4 text, model purchase research, inputs from Kai
beelden/                  latest reference screenshots
```

## Build and test

```
python3 bron/build.py          # -> site/3d.html
python3 bron/build.py model    # -> site/orkest-model.html
```

No npm needed for the build. three.js r147 loads from cdn.jsdelivr.net (UMD build, legacy colour mode: hex colours are linear).

Screenshots (headless, software GL):
```
cd bron/test && npm install
PFX=out/a STOPS='["open","t5","c0"]' WAIT=4000 node story10.js ../../site/3d.html     # MOB=1 for a 390x844 phone
```
`story10.js` reads `STOPS` (indices or stop ids) and saves one PNG per stop. `poster.js` makes the loader photo (UI hidden). `ten.js` screenshots the tension stop at given times. Loading takes ~2 minutes under software rendering. `window.__story` exposes `go(i|id)`, `stops`, `pause(bool)`. Without Node, Python Playwright with the installed Chrome works too (`channel="chrome"`, loads in seconds with the GPU).

## How the story code works (bron/site/story.js)

- `STOPS` array: one entry per stop. Fields: `id`, `name` (timeline name; on the first stop of each segment, and on `d1` where the label changes mid-segment), `ch` (part index, informational), `cam` (`K(pos,target,fov)` or `frame(box,dir,fov,k,lift)`), `seq`/`bar`/`hold`/`dur` (stops with the same `seq` auto-play as one frame; `bar` groups steps for the fill timing), `beats` (centred texts), `panel` (left panel id), `fw` ("big"/"side"/"coll") + `show` (framework figure), `focus(tags,t)` + `fallen` (what stays lit), `glow`, `chaos`, `off` (tension), `booth`, `late`, `coll` (part 4), `shade`, `top`, `caption`, `labels`, `line`, `problems`.
- Scrolling during a sequence jumps past the whole sequence; Skip does the same.
- Framework miniature: the Plan, Blueprint, Means and Orchestration panels carry a 64px copy of the framework figure next to their kicker (52px on phones; same geometry as `#fw`, shapes only, the panel's part in `--color-text`, the rest and Run/Change in `--color-line`). Nothing in the top-right corner of the film. Between a stop with the big diagram and one of these panels, the big diagram shrinks into the miniature (FLIP), driven by the camera move's progress; `FW_FLIP` sets which part of the move. Reduced motion: crossfade.
- Timeline (bottom left, `<nav data-timeline>`) is the only progress UI: no dots, nothing in the bottom middle. One segment per scroll step (a stop on its own or a whole sequence, built from `STOPS` into `SEGS`), passed segments full, the active one fills with the progress through its steps, cream playhead, never vermilion. Segments are buttons (32px hit area, 1px line, 3px on hover/focus); hover or focus previews "05 Blueprint" in the number and label; roving tabindex (one tab stop, arrows move, Enter/Space jumps). Play/pause icon before the number: Play story also carries on to the next segments (`STORY.hold` seconds on a stop without its own `hold`); scrolling, swiping, a key or a segment click stops it. Skip is a quiet link bottom right, visible only in a sequence. Phone (<=720px): two rows, number + label + Skip above, play + full-width bar below. Labels and timings live in `STORY` next to `STOPS`; knobs (`--timeline-bar-width` etc.) at the top of the `.timeline` rule; JS finds these elements via `data-timeline-*`.
- Merged frames: `orch`/`d1`/`d2` share seq "dims" (frame 7 into 8); `question`/`problems` share seq "you" (frame 9 into 10).
- Tension (stop `t5`): brass players rotate away (`rotation.y`), conductor arms lowered via `poseArms`, see `tension()`.
- Mesh tags (`tagsOf`): section, player, stand, conductor, audience, env, booth, grass; litOf decides opacity per stop.
- Gotcha: a `//` comment in the middle of a line swallows the rest of the line once built; keep comments at line end.

## Licences and publishing

- Rocketbox avatars: MIT. three.js: MIT.
- If paid models are bought later (`docs/modellen-kopen.md`): email the seller first, never put purchased source files in a public GitHub repo, only publish the packed build.

## Open work (priority order suggested to Kai)

1. Client quote + one result with a number in part 4 (Kai supplies).
2. Final email address (placeholder soundcheck@thecollective.nu) and where "Let's talk" links.
3. Smaller file: compress models (FBX to compressed GLB), expected 3-5x smaller; lazy-load audience/rehearsal/box office.
4. Programme board text (frame 4) to confirm with Kai.
5. Phone: Means section labels overlap; problems list overlaps the stage in frame 10.
6. The 8 problem cards are placeholders; routes after frame 10 are on hold until Kai says otherwise.
