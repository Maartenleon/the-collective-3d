
  /* ================================================================
     STORY: one scene per scroll, swipe or arrow key. Each stop sets the camera, the text, the panel and what stays lit.
     Some frames play a short sequence by themselves; Next (or a scroll) jumps past it.
     ================================================================ */
  const $ = s => document.querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);
  const reduceMQ = matchMedia("(prefers-reduced-motion: reduce)");
  const box = o => new THREE.Box3().setFromObject(o);
  function frame(b, from, fov, k = 1, lift = 0) {   // look at a box from a direction, close enough to fill the view
    const c = b.getCenter(V(0, 0, 0)), r = b.getSize(V(0, 0, 0)).length() / 2; c.y += lift;
    const d = r / Math.sin(THREE.MathUtils.degToRad(fov / 2)) * k;
    return { pos: c.clone().add(from.clone().normalize().multiplyScalar(d)), target: c, fov };
  }
  const K = (pos, target, fov = 40) => ({ pos: V(...pos), target: V(...target), fov });
  const abovePanel = (c, panelH) => {   // phones: the framed subject moves into the middle of the free space above a panel (header 80 px, panel bottom 92 px up), pulled back to fit when that space is small
    const H = innerHeight, free = Math.max(120, H - 92 - panelH - 80), k = Math.max(1, 0.49 * H / free) / 1.15, tanHalf = Math.tan(THREE.MathUtils.degToRad(c.fov / 2)) / Math.min(1, innerWidth / H / 1.2);   // with the portrait zoom (see resize)
    c.pos.sub(c.target).multiplyScalar(k).add(c.target);
    const a = Math.atan((H / 2 - (80 + free / 2)) / (H / 2) * tanHalf), dir = c.target.clone().sub(c.pos), right = dir.clone().cross(V(0, 1, 0)).normalize();
    c.target.copy(c.pos).add(dir.applyAxisAngle(right, -a)); return c; };   // an exact tilt: the subject, on the axis before, ends up a above it
  const sec = n => orkest.getObjectByName(n);
  const player = n => orkest.getObjectByName("Muzikant · " + n);
  const orchBox = box(orkest), standBox = box(lessen), boardBox = box(bord), condBox = box(dir);
  const nextBox = box(bord2).union(box(rep));
  const nextFront = V(Math.sin(NEXT.board.rotY), 0.0, Math.cos(NEXT.board.rotY));

  /* ---------- the two melody lines (value streams), each through four players in different sections ---------- */
  const MELODY = [
    { rgb: "241, 64, 11", players: ["Viool 1", "Fluit 1", "Hoorn 1", "Cello 1"] },          // vermilion
    { rgb: "222, 170, 72", players: ["Klarinet 1", "Altviool 1", "Trompet 1", "Contrabas 1"] },  // gold
  ];
  MELODY.forEach(L => { L.anchors = L.players.map(n => { const m = player(n); const p = m.getWorldPosition(V(0, 0, 0)); p.y += 1.18; return p; }); L.draw = 0; });
  const LINE1 = new Set(MELODY[0].players), LINE2 = new Set(MELODY[1].players);

  /* ---------- the box office: only seen in the Means frame ---------- */
  const kassa = group("Kassa", root); kassa.userData.booth = true;
  { const p = new Part("Kassa");
    p.add(new THREE.BoxGeometry(1.7, 2.1, 1.3), "stage", M(0, 1.05, 0));
    p.add(new THREE.BoxGeometry(2.0, 0.12, 1.6), "tier", M(0, 2.16, 0.08));
    p.add(new THREE.BoxGeometry(1.1, 0.7, 0.02), "frameAud", M(0, 1.35, 0.66));
    p.add(new THREE.BoxGeometry(1.25, 0.06, 0.32), "tier", M(0, 0.98, 0.78));
    p.build(kassa, true);
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128; const x = cv.getContext("2d");
    x.fillStyle = CARD; x.fillRect(0, 0, 512, 128); x.strokeStyle = INK; x.lineWidth = 4; x.strokeRect(10, 10, 492, 108);   // white card and dark ink, like the programme board
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
    const draw = () => { x.fillStyle = CARD; x.fillRect(14, 14, 484, 100);
      x.fillStyle = INK; x.font = "700 64px 'Barlow Condensed', 'DIN Condensed', 'Arial Narrow', sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("BOX OFFICE", 256, 68); t.needsUpdate = true; };   // the same sans as the programme board
    draw(); document.fonts && document.fonts.load("700 64px 'Barlow Condensed'").then(draw, () => {});
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.375), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, emissive: 0x3a2014, emissiveIntensity: 0.3 }));
    sign.position.set(0, 2.5, 0.75); kassa.add(sign);
    const KX = 11.5, KZ = 45.5; kassa.position.set(KX, terrainH(KX, KZ), KZ); kassa.rotation.y = -0.75;
    kassa.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); }
  const kassaBox = box(kassa);
  { // a small clearing in the field around the booth: stalks thin out toward it
    const KC = new THREE.Vector3(), mm = new THREE.Matrix4(), pp = new THREE.Vector3(), qq = new THREE.Quaternion(), ss = new THREE.Vector3(); kassa.getWorldPosition(KC);
    scene.traverse(o => { if (!o.isInstancedMesh || !/^(Graanhalmen|Gras)$/.test(o.name)) return;
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, mm); mm.decompose(pp, qq, ss); const d = Math.hypot(pp.x - KC.x, pp.z - KC.z);
        if (d < 4.2) { ss.multiplyScalar(d < 2.6 ? 0 : (d - 2.6) / 1.6); mm.compose(pp, qq, ss); o.setMatrixAt(i, mm); } }
      o.instanceMatrix.needsUpdate = true; }); }

  /* ---------- the stops ---------- */
  const BOWL = orchBox.clone().union(nextBox);
  const NARROW = innerWidth <= 720;
  const shiftCam = (c, kx, ky) => { const f = c.target.clone().sub(c.pos), d = f.length(); f.normalize();   // slide the view so the text has room
    const r = f.clone().cross(V(0, 1, 0)).normalize(), u = r.clone().cross(f).normalize(), off = r.multiplyScalar(kx * d).add(u.multiplyScalar(ky * d));
    return { pos: c.pos.clone().add(off), target: c.target.clone().add(off), fov: c.fov }; };
  const sideOrUp = c => NARROW ? shiftCam(c, 0.04, -0.3) : shiftCam(c, 0, -0.27);
  const CAMC = sideOrUp(frame(BOWL, V(0.1, 0.75, 1), 40, NARROW ? 0.9 : 0.75, -1));            // high over the bowl: both stages
  const SECT = ["Strijkers", "Houtblazers", "Koper", "Slagwerk"];
  const CAM2 = NARROW ? frame(orchBox, V(0, 0.62, 1), 40, 0.84) : K([0, 3.2, 25], [0, 2.4, -4], 38);   // the closer view of frame 2, reused by Blueprint, Means and the dimensions; phones look down a little more, so the orchestra fills the width instead of a thin strip
  const oneByOne = (t, s, t0 = 0.6, step = 0.8) => { const i = Math.floor((s - t0) / step); return t.env || t.conductor || i < 0 || i > 3 || t.section === SECT[i] || (i === 0 && (t.section === "Harp" || t.section === "Piano")); };   // the whole orchestra first, then section by section (harp and piano with the strings), then all again: never the conductor alone
  const condStandBox = box(lessen.getObjectByName("Dirigent (partituur)"));
  const FW_STEP = 0.4;   // the framework builds up one part every 0.4 s (frame 3)
  const LINE_GAP = 0.9, BEAT = LINE_GAP / 2, TW_DUR = 0.3, TENSION_GAP = 1.9;   // "It isn't": a line every LINE_GAP, a section every BEAT (two per line), the tension TENSION_GAP after the last line, so the coloured lines can be seen; the holds of t1-t3 follow from these (t2 and t3 move in TW_DUR, t3's line comes halfway)
  const STOPS = [
    { id: "open", name: "The concert", ch: 0, cam: NARROW ? K([0, 5.5, 90], [0, 7.0, -20], 6.8) : K([0, 3.2, 90], [0, 5.95, -20], 11.2), beats: ["opening"] },   // a long lens from far back: flat stage, high rim, big hills; phones zoom in further, the orchestra a little wider than the screen and low in it
    // Frame 2: It isn't. Roles, skills, views, one performance
    { id: "t1", name: "The complexity", ch: 0, seq: "twist", bar: 0, hold: 2 * LINE_GAP, dur: 0.5, cam: CAM2, beats: ["twist"], lines: 1, linesTo: 2, focus: (t, s) => oneByOne(t, s, 0, BEAT) },   // straight from the opening to "Different roles": the rest of the orchestra dims with the flight, the sections light up after arriving
    { id: "t2", ch: 0, seq: "twist", bar: 1, hold: LINE_GAP - 1.5 * TW_DUR, dur: TW_DUR, cam: CAM2, beats: ["twist"], lines: 3, glow: 1 },
    { id: "t3", ch: 0, seq: "twist", bar: 2, hold: TENSION_GAP - TW_DUR / 2, dur: TW_DUR, cam: CAM2, beats: ["twist"], lines: 4, chaos: 1 },
    { id: "t5", ch: 0, seq: "twist", bar: 3, hold: 5.4, dur: 1.6, cam: frame(box(sec("Koper")).union(condBox), V(0.05, 0.42, 1), 30, innerWidth <= 720 ? 0.6 : 0.62, 0.3), beats: ["off"], off: 1 },
    // Frame 3: the framework, built up over the concert
    { id: "f0", name: "The framework", ch: 1, seq: "fw", bar: 0, hold: FW_STEP, cam: K([0, 27, 25], [0, 0, -1.5], 40), beats: ["fw"], fw: "big", show: "", shade: 0.3 },   // one part every FW_STEP seconds
    { id: "f1", ch: 1, seq: "fw", bar: 1, hold: FW_STEP, dur: 0.15, cam: K([0, 27, 25], [0, 0, -1.5], 40), beats: ["fw"], fw: "big", show: "p", shade: 0.3 },
    { id: "f2", ch: 1, seq: "fw", bar: 1, hold: FW_STEP, dur: 0.15, cam: K([0, 27, 25], [0, 0, -1.5], 40), beats: ["fw"], fw: "big", show: "pb", shade: 0.3 },
    { id: "f3", ch: 1, seq: "fw", bar: 1, hold: FW_STEP, dur: 0.15, cam: K([0, 27, 25], [0, 0, -1.5], 40), beats: ["fw"], fw: "big", show: "pbm", shade: 0.3 },
    { id: "f4", ch: 1, seq: "fw", bar: 2, hold: FW_STEP, dur: 0.15, cam: K([0, 27, 25], [0, 0, -1.5], 40), beats: ["fw"], fw: "big", show: "pbmo", shade: 0.3 },
    { id: "f5", ch: 1, seq: "fw", bar: 2, hold: FW_STEP, dur: 0.15, cam: K([0, 27, 25], [0, 0, -1.5], 40), beats: ["fw"], fw: "big", show: "pbmor", shade: 0.3 },
    { id: "f6", ch: 1, seq: "fw", bar: 3, hold: 2.8, dur: 0.15, cam: K([0, 27, 25], [0, 0, -1.5], 40), beats: ["fw"], fw: "big", show: "pbmorc", shade: 0.3 },
    // Frame 4: Plan
    { id: "plan", name: "Plan", ch: 2, cam: frame(boardBox, V(0.62, 0.2, 1), 40, NARROW ? 2.3 : 1.9, 0.2), panel: "plan" },
    // Frame 5: Blueprint
    { id: "b1", name: "Blueprint", ch: 3, seq: "bp", bar: 0, hold: 2.2, cam: CAM2, panel: "blueprint", focus: t => t.stand || t.env, caption: "The score on every stand" },
    { id: "b2", ch: 3, seq: "bp", bar: 1, fadeLate: 1, hold: 2.8, dur: 1.8, cam: frame(condStandBox, V(0, 0.9, 0.55), 34, 1.15), panel: "blueprint", focus: t => t.env || t.condStand, caption: "The conductor’s score" },
    { id: "b3", ch: 3, seq: "bp", bar: 2, hold: 2.6, dur: 1.8, cam: frame(orchBox, V(0, 0.75, 1), 42, 0.74), panel: "blueprint", line: 1, fallen: 0.16, focus: t => t.env || t.stand || LINE1.has(t.player), caption: "One melody, many hands" },
    { id: "b4", ch: 3, seq: "bp", bar: 3, hold: 3.0, cam: frame(orchBox, V(0.06, 0.72, 1), 42, 0.72), panel: "blueprint", line: 2, fallen: 0.16, focus: t => t.env || t.stand || LINE1.has(t.player) || LINE2.has(t.player), caption: "Two melodies, eight specialists, four sections" },
    // Frame 6: Means
    { id: "m1", name: "Means", ch: 4, seq: "means", bar: 0, hold: 3.6, cam: CAM2, panel: "means", focus: (t, s) => oneByOne(t, s, 0.4, 0.8), caption: "Four sections, many specialists" },
    { id: "m2", ch: 4, seq: "means", bar: 1, hold: 2.6, dur: 0.5, cam: CAM2, panel: "means", glow: 1, caption: "Their instruments" },
    { id: "m3", ch: 4, seq: "means", bar: 2, hold: 3.0, dur: 2.2, cam: frame(kassaBox, V(-0.55, 0.32, 1), 38, 1.7), panel: "means", booth: 1, caption: "And the budget that keeps them playing" },
    // Frame 7: Orchestration
    { id: "orch", name: "Orchestration", ch: 5, seq: "dims", bar: 0, hold: 3.6, cam: frame(condBox, V(0.1, 0.22, 1), 34, 1.7, 0.1), panel: "orchestration", focus: t => t.env || t.conductor || (t.stand && t.condStand) },
    // Frame 8: the two dimensions
    { id: "d1", name: "Run and Change", ch: 6, seq: "dims", bar: 1, hold: 3.4, dur: 2.2, cam: CAM2, panel: "dims" },
    { id: "d2", ch: 6, seq: "dims", bar: 2, hold: 3.0, dur: 2.6, cam: NARROW ? abovePanel(frame(nextBox, nextFront.clone().add(V(0.6, 0.55, 0.5)), 40, 1.15), 310) : frame(nextBox, nextFront.clone().add(V(0.6, 0.55, 0.5)), 40, 1.35), panel: "dims", late: 1 },
    // Frame 9 and 10: your organisation
    { id: "question", name: "Your organisation", ch: 7, seq: "you", bar: 0, hold: 3.2, cam: NARROW ? K([0, 2.2, 46], [0, 2.2, -3], 28) : K([0, 1.7, 45.5], [0, 3.0, -3], 46), beats: ["question"], shade: 0.25, fore: 1 },
    { id: "problems", ch: 7, seq: "you", bar: 1, dur: 2.4, cam: K([0, 13, 33], [0, 0.6, -3]), problems: true, shade: 0.72, fw: "side", show: "pbmorc" },
    // Part 4: The Collective. The camera rises over the bowl: tonight's concert and next season's rehearsal in one view
    { id: "c0", name: "The Collective", ch: 8, cam: CAMC, coll: 1, shade: 0.45 },
  ];
  const STORY = { goTo: "Go to", next: "Next" };   // the segment and button labels
  const N = STOPS.length, idx = id => STOPS.findIndex(s => s.id === id);
  const SEQS = {};
  STOPS.forEach((s, i) => { if (!s.seq) return; const q = SEQS[s.seq] || (SEQS[s.seq] = { first: i, last: i, bars: [] }); q.last = i;
    q.bars[s.bar] = (q.bars[s.bar] || 0) + (s.dur || 1.2) + (s.hold || 0); });
  const SEGS = [];   // the timeline: one segment per scroll step, a stop on its own or a whole sequence
  STOPS.forEach((s, i) => { if (!s.seq || SEQS[s.seq].first === i) SEGS.push({ first: i, last: s.seq ? SEQS[s.seq].last : i }); });
  const segOf = i => SEGS.findIndex(g => i >= g.first && i <= g.last), nameAt = i => { while (!STOPS[i].name) i--; return STOPS[i].name; };

  /* ---------- focus: tag every mesh by what it belongs to, then fade what is not in the scene's focus ---------- */
  const meshes = []; let selected = null;   // the people loader adds its meshes here
  const FALLEN = 0.05;
  function tagsOf(o) {
    const t = {};
    for (let n = o; n; n = n.parent) {
      if (n === lessen) t.stand = true;
      if (n.name === "Dirigent (partituur)") t.condStand = true;
      if (n === dir) t.conductor = t.person = true;
      if (n === pub) t.audience = true;
      if (n === omg || n === pod || n === CHG || n === bord) t.env = true;
      if (n.name === "Lichaam" || n.name === "Persoon") t.person = true;
      if (n.name === "Instrument") t.instrument = true;
      if (n.name === "Stoel") t.chair = true;
      if (n.name === "Eerste violen") t.firstViolins = true;
      if (/^Muzikant · /.test(n.name)) t.player = n.name.slice(11);
      if (n.parent === orkest) t.section = n.name;
      if (n === kassa) t.booth = true;
      if (n === bord) t.board = true;
      if (n.name === "Graan") t.grass = true;
    }
    return t;
  }
  scene.traverse(o => { if (o.isMesh && o !== skyMesh) { meshes.push(o); o.material.transparent = true; } });

  /* ---------- shadows: the sun's shadow map is redrawn only when something that casts a shadow changes ---------- */
  // What changes it: a caster appearing or disappearing (fades), the people arriving, the brass turning in t5, and the live conductor, who moves all
  // the time: while he does, the whole map is redrawn SHADOW_RATE times per second (his shadow is at most 1/15 s late, not visible; Kai's choice "a").
  // The shadow camera is fixed (the sun's 150 m box does not follow the view), so camera moves need no redraw.
  const SHADOW_RATE = 15;
  renderer.shadowMap.autoUpdate = false;
  const shadows = { dirty: true, last: -1, count: 0 };
  function shadowTick(now) {
    if (meshes.length !== shadows.count) { shadows.count = meshes.length; shadows.dirty = true; }   // the people arrived
    const live = typeof conductor !== "undefined" && conductor && conductor.attached && !reduceMQ.matches;
    if (live && now - shadows.last >= 1 / SHADOW_RATE - 1e-3) shadows.dirty = true;
    if (shadows.dirty) { renderer.shadowMap.needsUpdate = true; shadows.dirty = false; shadows.last = now; }
  }
  const AUDIENCE_FROM = STOPS.findIndex(s => s.id === "question");   // the audience is there from "So, how does your organisation sound?" on
  const litOf = (s, t, since) => (t.grass || t.board) && s.id === "open" || t.audience && STOPS.indexOf(s) < AUDIENCE_FROM ? -FALLEN / (1 - FALLEN) : t.booth ? (s.booth ? 1 : -FALLEN / (1 - FALLEN)) : s.booth ? (t.env || t.audience ? 1 : 0.6) : !s.focus ? 1 : s.focus(t, since) ? 1 : (s.fallen || 0) / (1 - FALLEN);

  /* ---------- elements ---------- */
  const stage = $("#stage"), fx = $("#fx"), fctx = fx.getContext("2d");
  const beats = {}; document.querySelectorAll("[data-beat]").forEach(el => (beats[el.dataset.beat] = el));
  const panels = {}; document.querySelectorAll("[data-panel]").forEach(el => (panels[el.dataset.panel] = el));
  const caption = $("#caption"), capText = $("#captionText");
  const shade = $("#shade"), fore = $("#fore"), problems = $("#problems");
  let scrollRest = 0; const setProblemsScroll = () => { document.documentElement.style.setProperty("--problems-scroll", problems.scrollTop + "px");   // phones: the framework above the list scrolls along
    fwEl.classList.add("is-scrolling"); clearTimeout(scrollRest); scrollRest = setTimeout(() => fwEl.classList.remove("is-scrolling"), 150); };
  problems.addEventListener("scroll", setProblemsScroll, { passive: true });
  const tlNav = $("[data-timeline]"), tlBar = $("[data-timeline-bar]"), tlLabel = $("[data-timeline-label]"), tlSkip = $("[data-timeline-skip]");
  const collEl = $("#coll"), meetBtn = $("#meet");
  const fwGlass = $("[data-fw-glass]");
  // "It isn't": the sections light up one by one while "Different roles" and "Different capabilities" appear (t1, the second after LINE_GAP);
  // "Different perspectives" comes with the glow (t2), "One performance" together with the coloured lines (t3), each LINE_GAP after the last
  let lineT = 0; const showLines = S => { let n = S.lines ?? 4; if (S.linesTo) n = anim ? 0 : Math.min(S.linesTo, n + Math.floor(lineT / LINE_GAP)); if (S.chaos && anim && anim.k <= 0.5) n--; lineEls.forEach(li => li.classList.toggle("is-shown", +li.dataset.line <= n)); };   // t1: only "It isn't." during the flight, the first line once the camera has arrived
  const lineEls = [...document.querySelectorAll("[data-line]")], dimsLate = $("#dimsLate"), fwEl = $("#fw");
  { // the framework figure, B2: floating rounded bands inside a circle, two columns, the Orchestration ring with its arrow
    const CX = 320, CY = 262, R = 192;   // all colours and the text sizes come from styles.css (.fw .part, .fw .ring, .fw .arc, .fw .sub): the parts look like the panels
    const pill = (x, y, w, h) => `<rect class="part" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(Math.min(w, h) / 2).toFixed(1)}"/>`;
    const band = (d, k, l, sub) => { const hw = Math.sqrt(R * R - (Math.abs(d) + 32) ** 2);
      return `<g class="k" data-k="${k}">${pill(CX - hw, CY + d - 30, 2 * hw, 60)}<text class="lab band" x="${(CX - hw + 26).toFixed(1)}" y="${CY + d + 2}">${l.toUpperCase()}</text><text class="sub" x="${(CX - hw + 26).toFixed(1)}" y="${CY + d + 20}">${sub}</text></g>`; };
    const SPAN = 104 + 30;   // Run and Change reach from the top of Plan to the bottom of Means, so their labels line up
    const col = (dx, k, l) => { const hh = SPAN;
      return `<g class="k" data-k="${k}">${pill(CX + dx - 28, CY - hh, 56, 2 * hh)}<text class="lab" x="${CX + dx}" y="${(CY - hh - 10).toFixed(1)}" text-anchor="middle">${l.toUpperCase()}</text></g>`; };   // RUN and CHANGE only: no text down the columns
    const RO = 228, a = 0.2;   // the arrow ends just before its start: almost a full circle
    fwEl.innerHTML = `<defs><marker id="fwArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="tip" d="M0 0L10 5L0 10z"/></marker></defs>
      <circle class="ring" cx="${CX}" cy="${CY}" r="205"/>`
      + band(-104, "p", "Plan", "the piece") + band(0, "b", "Blueprint", "the score") + band(104, "m", "Means", "the orchestra") + col(40, "r", "Run") + col(110, "c", "Change")
      + `<g class="k" data-k="o"><path d="M ${CX} ${CY - RO} A ${RO} ${RO} 0 1 1 ${(CX - RO * Math.sin(a)).toFixed(1)} ${(CY - RO * Math.cos(a)).toFixed(1)}" class="arc" pathLength="1" marker-end="url(#fwArrow)"/>
        <text class="lab lab--big" x="${CX}" y="${CY + RO + 30}" text-anchor="middle">ORCHESTRATION</text><text class="sub" x="${CX}" y="${CY + RO + 50}" text-anchor="middle">the conductor</text></g>`;
  }
  { // the Orchestration arrow: the line draws itself clockwise and its head rides on the drawn end, so the head appears and moves with the line.
    // Once elsewhere; on the framework frame it loops: drawn, held, then the tail runs after the head until both are gone, and again.
    // The head is a separate path, set up on first use.
    const g = fwEl.querySelector('[data-k="o"]'), arc = g.querySelector(".arc"), ARC = { draw: 0.9, loop: 4.2, drawn: 0.4, hold: 0.65 };
    let tip = null, L = 0, mode = "off", t0 = 0, idle = false;
    const show = (tail, head) => { const a = Math.max(0, head - tail);
      arc.style.strokeDasharray = (a * L).toFixed(2) + " " + (2 * L).toFixed(2); arc.style.strokeDashoffset = (-tail * L).toFixed(2);
      if (a < 0.002) { tip.style.opacity = "0"; return; }
      const p = arc.getPointAtLength(head * L), q = arc.getPointAtLength(Math.max(0, head * L - 2));
      tip.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${(Math.atan2(p.y - q.y, p.x - q.x) * 180 / Math.PI).toFixed(1)})`);
      tip.style.opacity = Math.min(1, a / 0.05).toFixed(3); };   // a tiny arrow fades rather than pops
    var arcTick = now => {
      if (!tip || (mode === "off" && idle)) return;
      if (mode === "off") { show(0, 0); idle = true; return; } idle = false;
      if (reduceMQ.matches) return show(0, 1);
      if (mode === "once") return show(0, smoother(clamp((now - t0) / ARC.draw, 0, 1)));
      const u = ((now - t0) % ARC.loop) / ARC.loop;
      if (u < ARC.drawn) show(0, smoother(u / ARC.drawn)); else if (u < ARC.hold) show(0, 1); else show(smoother((u - ARC.hold) / (1 - ARC.hold)), 1);
    };
    var drawArc = (on, loop) => {
      if (!tip) { arc.removeAttribute("marker-end"); arc.removeAttribute("pathLength"); L = arc.getTotalLength();
        tip = document.createElementNS("http://www.w3.org/2000/svg", "path"); tip.setAttribute("class", "tip"); tip.setAttribute("d", "M-6 -5.5L6 0L-6 5.5z"); g.appendChild(tip); }
      const now = clock.getElapsedTime(), next = !on ? "off" : loop && !reduceMQ.matches ? "loop" : "once";
      if (next === mode) return;
      if (next === "loop") t0 = mode === "once" ? now - ARC.loop * ARC.drawn : now;   // already drawn: go on from the drawn state
      else if (next === "once") t0 = mode === "loop" ? -1e9 : now;
      mode = next; idle = false; g.classList.toggle("is-shown", on); arcTick(now);
    };
  }
  let vw = 0, vh = 0, dpr = 1;
  const toScreen = v => { const q = v.clone().project(camera); return [(q.x + 1) / 2 * vw, (1 - q.y) / 2 * vh, q.z < 1]; };

  /* ---------- moving between stops ---------- */
  const clock = new THREE.Clock();
  let at = 0, from = 0, anim = null, arrived = 0, started = 0, paused = false, preview = -1, barStart = 0, curBar = -1;
  const camNow = () => ({ pos: camera.position.clone(), target: camTarget.clone(), fov: camera.fov });
  const camTarget = STOPS[0].cam.target.clone();
  const sameCam = (a, b) => a.pos.equals(b.pos) && a.target.equals(b.target) && a.fov === b.fov;
  // The audience loads after the opening has started. A visitor who jumps straight to a stop that shows it before it is in waits there a moment:
  // the camera leaves once the audience has arrived (it then fades in during the move), or after AUDIENCE_WAIT seconds if it cannot load.
  const AUDIENCE_WAIT = 8, pubBox = box(pub), seeCam = new THREE.PerspectiveCamera(), seeFrustum = new THREE.Frustum(), seeM = new THREE.Matrix4();
  let waitGo = null;
  const grassBox = new THREE.Box3(); { const M4 = new THREE.Matrix4(), P = V(0, 0, 0);   // the grain field's extent, from its instances (Box3 ignores instances)
    graan.updateMatrixWorld(true); graan.traverse(o => { if (!o.isInstancedMesh) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const top = o.geometry.boundingBox.max.y;
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M4); M4.premultiply(o.matrixWorld); P.setFromMatrixPosition(M4); grassBox.expandByPoint(P); grassBox.expandByPoint(P.clone().setY(P.y + top * 1.5)); } }); }
  function showsAudience(S) {
    if (litOf(S, { audience: true }, 99) < 0.5) return false;   // hidden or faded there
    Object.assign(seeCam, { fov: S.cam.fov, aspect: camera.aspect, zoom: camera.zoom, near: camera.near, far: camera.far }); seeCam.position.copy(S.cam.pos); seeCam.lookAt(S.cam.target);
    seeCam.updateMatrixWorld(); seeCam.updateProjectionMatrix(); seeFrustum.setFromProjectionMatrix(seeM.multiplyMatrices(seeCam.projectionMatrix, seeCam.matrixWorldInverse));
    return seeFrustum.intersectsBox(pubBox);
  }
  function goTo(i, instant) {
    i = clamp(i, 0, N - 1); if (i === at && !anim) return;
    if (!window.__audience && clock.getElapsedTime() - (waitGo ? waitGo.since : clock.getElapsedTime()) < AUDIENCE_WAIT && showsAudience(STOPS[i])) {
      waitGo = { i, instant, since: waitGo ? waitGo.since : clock.getElapsedTime() }; return; }   // the latest wish wins; see frameLoop
    waitGo = null;
    const now = clock.getElapsedTime(), S = STOPS[i], P = STOPS[at];
    if (anim && !instant && sameCam(S.cam, STOPS[anim.to].cam)) {   // same view as where the camera is heading: let that move run on
      anim.to = i; at = i; started = now;
      if (S.seq && S.bar !== curBar) { curBar = S.bar; barStart = now; }
      applyStop(S); return;
    }
    const inSeq = S.seq && P.seq === S.seq && i === at + 1;
    const dist = camera.position.distanceTo(S.cam.pos);
    const dur = reduceMQ.matches || instant ? 0 : inSeq ? (S.dur || 1.2) : clamp(1.1 + dist * 0.022, 1.2, 2.8);
    from = anim ? (anim.k > 0.5 ? anim.to : from) : at;
    anim = { start: camNow(), to: i, t0: now, dur, k: 0 }; at = i; started = now;
    if (!dur) { anim.k = 1; }
    if (S.seq && S.bar !== curBar) { curBar = S.bar; barStart = now; }
    if (!S.seq) curBar = -1;
    applyStop(S);
  }
  function applyStop(S) {
    for (const k in beats) beats[k].classList.toggle("is-on", (S.beats || []).includes(k));
    for (const k in panels) panels[k].classList.toggle("is-on", S.panel === k);
    caption.classList.toggle("is-on", !!S.caption);
    if (S.caption) capText.textContent = S.caption;
    problems.classList.toggle("is-on", !!S.problems); if (!S.problems && problems.scrollTop) { problems.scrollTop = 0; setProblemsScroll(); } if (!S.problems) closeDrawers();
    showLines(S);
    dimsLate.classList.toggle("is-late", !!S.late); $("#dimsOrgC").classList.toggle("is-late", !!S.late);
    fwEl.classList.toggle("is-on", !!S.fw); fwEl.classList.toggle("is-side", S.fw === "side"); fwEl.classList.toggle("is-coll", S.fw === "coll");
    collEl.classList.toggle("is-on", !!S.coll);
    meetBtn.classList.toggle("is-hidden", !!S.coll);
    fwEl.querySelectorAll(".k").forEach(g => { const k = g.dataset.k;
      g.style.opacity = (S.show || "").includes(k) ? 1 : 0; if (k === "o") drawArc(!!S.fw && (S.show || "").includes("o"), S.fw === "big"); });
    shade.style.opacity = S.shade || 0; fore.classList.toggle("is-on", !!S.fore);
    const n = segOf(at), lastSeg = n === SEGS.length - 1;
    segBtns.forEach((b, k) => { b.setAttribute("aria-current", k === n ? "step" : "false"); b.tabIndex = k === n ? 0 : -1; segFills[k].style.transform = `scaleX(${k < n ? 1 : 0})`; });
    if (tlBar.contains(document.activeElement) && document.activeElement !== segBtns[n]) segBtns[n].focus({ preventScroll: true });   // focus follows only if it is already in the bar
    segFills[n].parentNode.appendChild(tlDot);
    if (preview < 0) showSeg(nameAt(at));
    tlSkip.classList.toggle("is-on", !lastSeg);   // Next: everywhere but the last part
  }
  function setPaused(v) {   // only the screenshot scripts pause a sequence (__story.pause)
    paused = v;
    if (!v) arrived = clock.getElapsedTime() - (STOPS[at].hold || 0) * 0.5;   // resume: a short wait, then on
  }
  tlSkip.textContent = STORY.next;
  tlSkip.addEventListener("click", () => { const n = segOf(at); if (n < SEGS.length - 1) goTo(SEGS[n + 1].first); });   // Next: the first step of the next part (a running sequence is passed as a whole)
  function step(d) {   // one gesture = one scene; a running sequence counts as one scene
    if (document.body.classList.contains("is-loading")) return;
    meetFrom = null;
    const q = STOPS[at].seq && SEQS[STOPS[at].seq];
    if (q) { paused = false; setPaused(false); goTo(d > 0 ? q.last + 1 : q.first - 1); return; }
    goTo(at + d);
  }

  /* ---------- input: wheel, keys, swipe, timeline ---------- */
  const WHEEL_REST = 0.45; let wheelQuiet = 0, wheelAcc = 0;
  addEventListener("wheel", e => {
    if (e.target.closest && e.target.closest("[data-drawer]")) return;   // an open side panel scrolls itself
    e.preventDefault();
    const now = clock.getElapsedTime(), quiet = now - wheelQuiet; wheelQuiet = now;
    if ((anim && anim.k < 0.85) || quiet < WHEEL_REST && wheelAcc === 0) return;
    wheelAcc += e.deltaY; if (Math.abs(wheelAcc) < 24) return;
    step(Math.sign(wheelAcc)); wheelAcc = 0;
  }, { passive: false });
  addEventListener("keydown", e => {
    if (e.key === "Escape" && (openProblem >= 0 || openPart)) { closeDrawers(true); return; }
    if (e.target.closest && e.target.closest("[data-drawer]")) return;   // arrows and space scroll the open side panel
    if (e.target.closest && e.target.closest("button") && (e.key === " " || e.key === "Enter")) return;
    if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); step(1); }
    if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); step(-1); }
    if (document.body.classList.contains("is-loading")) return;
    if (e.key === "Home") goTo(0); if (e.key === "End") goTo(N - 1);
  });
  let touchY = null;
  stage.addEventListener("touchstart", e => { touchY = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchmove", e => { if (!e.target.closest(".problems, .coll__page, [data-drawer]")) e.preventDefault(); }, { passive: false });
  stage.addEventListener("touchend", e => { if (touchY === null) return; if (e.target.closest("[data-drawer]")) { touchY = null; return; } for (const sel of [".coll__page", ".problems"]) { const el = e.target.closest(sel); if (el && el.scrollHeight > el.clientHeight + 4) { touchY = null; return; } } const dy = touchY - e.changedTouches[0].clientY; touchY = null; if (Math.abs(dy) > 40) step(Math.sign(dy)); });   // a list that scrolls (About, problems on phones) is scrolled, not swiped away
  const segBtns = SEGS.map((g, n) => { const b = document.createElement("button");
    b.type = "button"; b.className = "timeline__seg"; b.dataset.timelineSeg = n; b.tabIndex = -1;
    b.setAttribute("aria-label", `${STORY.goTo} ${STOPS[g.first].name}`);
    b.innerHTML = '<span class="timeline__line"><i class="timeline__fill"></i></span>'; tlBar.appendChild(b); return b; });
  const segFills = segBtns.map(b => b.querySelector(".timeline__fill"));
  const tlDot = document.createElement("span"); tlDot.className = "timeline__dot";
  function showSeg(name) { tlLabel.textContent = name; }
  segBtns.forEach((b, n) => {   // hover or focus previews a segment's name; leaving shows the active one again
    const peek = () => { preview = n; showSeg(STOPS[SEGS[n].first].name); }, back = () => { preview = -1; showSeg(nameAt(at)); };
    b.addEventListener("pointerenter", peek); b.addEventListener("focus", peek); b.addEventListener("pointerleave", back); b.addEventListener("blur", back);
    b.addEventListener("click", () => { if (document.body.classList.contains("is-loading")) return; paused = false; meetFrom = null; goTo(SEGS[n].first); });
  });
  tlBar.addEventListener("keydown", e => {   // roving tabindex: one tab stop, the arrows move between segments
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key], n = +e.target.dataset.timelineSeg; if (!d || Number.isNaN(n)) return;
    e.preventDefault(); e.stopPropagation(); const k = clamp(n + d, 0, SEGS.length - 1);
    segBtns.forEach((b, j) => (b.tabIndex = j === k ? 0 : -1)); segBtns[k].focus();
  });
  $("[data-brand]").addEventListener("click", () => {   // the logo: back to the opening
    if (document.body.classList.contains("is-loading")) return; paused = false; meetFrom = null; goTo(0); });
  /* ---------- side panels: a problem slides in from the left, a framework part from the right; words in content.js ---------- */
  const drawers = { problem: $("[data-drawer='problem']"), part: $("[data-drawer='part']") };
  let openProblem = -1, openPart = null, drawerFrom = null;
  const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const pills = list => `<ul class="pills" aria-label="${esc(LABELS.concepts)}">${list.map(c => `<li class="pill">${esc(c)}</li>`).join("")}</ul>`;   // the part panel's related concepts
  const section = (label, html) => `<h3 class="drawer__h">${esc(label)}</h3>${html}`;
  function problemHTML(n) { const P = PROBLEMS[n];   // the title is the recognition; the figure beside it lights the parts and opens them
    return `<h2 class="drawer__title">${esc(P.line)}</h2>`
      + section(LABELS.wrong, `<p class="drawer__text">${esc(P.wrong)}</p>`) + section(LABELS.solve, `<p class="drawer__text">${esc(P.solve)}</p>`); }
  function partHTML(k) { const T = PARTS[k], related = PROBLEMS.map((P, n) => [P, n]).filter(([P]) => P.parts.includes(k));
    return `<p class="drawer__kicker">${esc(T.name)} · ${esc(T.sub)}</p><h2 class="drawer__title">${esc(T.title)}</h2><p class="drawer__question">${esc(T.question)}</p><p class="drawer__text">${esc(T.text)}</p>`
      + section(LABELS.org, `<p class="drawer__text">${esc(T.org)}</p>`)
      + (related.length ? section(LABELS.problems, `<div class="drawer__problems">${related.map(([P, n]) => `<button class="drawer__problem" type="button" data-open-problem="${n}">${esc(P.short)}</button>`).join("")}</div>`) : "")
      + section(LABELS.concepts, pills(T.concepts)); }
  function showDrawer(kind, html) {
    const d = drawers[kind], other = drawers[kind === "problem" ? "part" : "problem"];
    if (!drawerFrom || !drawerFrom.isConnected) drawerFrom = document.activeElement;
    if (innerWidth <= 720 && other.classList.contains("is-on")) { other.classList.remove("is-on"); other.inert = true; if (kind === "problem") openPart = null; else openProblem = -1; }   // one at a time on a phone
    d.querySelector("[data-drawer-body]").innerHTML = html; d.scrollTop = 0; d.inert = false; d.classList.add("is-on"); d.focus({ preventScroll: true });
    markDrawers();
  }
  function closeDrawers(back) {
    if (openProblem < 0 && !openPart) return;
    for (const k in drawers) { drawers[k].classList.remove("is-on"); drawers[k].inert = true; }
    openProblem = -1; openPart = null; markDrawers();
    if (back && drawerFrom && drawerFrom.isConnected) drawerFrom.focus({ preventScroll: true }); drawerFrom = null;
  }
  function closeDrawer(kind) {   // close one panel; if it was the only one open, close all and give focus back
    if (!(kind === "problem" ? openPart : openProblem >= 0)) return closeDrawers(true);
    drawers[kind].classList.remove("is-on"); drawers[kind].inert = true;
    if (kind === "problem") openProblem = -1; else openPart = null;
    markDrawers();
  }
  const openProblemFn = n => { openProblem = n; showDrawer("problem", problemHTML(n)); }, openPartFn = k => { openPart = k; showDrawer("part", partHTML(k)); };
  function markDrawers() {   // the open problem's card; in the figure, the parts that problem (or the open part) is about
    cards.forEach((c, n) => { c.classList.toggle("is-active", n === openProblem); c.setAttribute("aria-expanded", n === openProblem); });
    const lit = openPart ? [openPart] : openProblem >= 0 ? PROBLEMS[openProblem].parts : [];
    fwEl.classList.toggle("has-focus", lit.length > 0); fwEl.querySelectorAll(".k").forEach(g => g.classList.toggle("is-lit", lit.includes(g.dataset.k)));
  }
  const cards = PROBLEMS.map((P, n) => { const b = document.createElement("button");
    b.type = "button"; b.className = "prob glass"; b.dataset.problem = n; b.style.setProperty("--i", n); b.setAttribute("aria-controls", "drawerProblem"); b.setAttribute("aria-expanded", "false");
    b.innerHTML = `<span class="prob__line">${esc(P.short)}</span>`; $("[data-problems-list]").appendChild(b); return b; });
  document.addEventListener("click", e => {
    if (!STOPS[at].problems || !e.target.closest) return;
    const card = e.target.closest("[data-problem]"), part = e.target.closest("[data-open-part]") || (fwEl.classList.contains("is-side") && e.target.closest("#fw .k"));
    const prob = e.target.closest("[data-open-problem]"), close = e.target.closest("[data-drawer-close]");
    if (card) { const n = +card.dataset.problem; n === openProblem ? closeDrawer("problem") : openProblemFn(n); return; }
    if (part) { const k = part.dataset.openPart || part.dataset.k; k === openPart ? closeDrawer("part") : openPartFn(k); return; }
    if (prob) { openProblemFn(+prob.dataset.openProblem); return; }
    if (close) { closeDrawer(close.closest("[data-drawer]").dataset.drawer); return; }
    if (!e.target.closest("[data-drawer], [data-timeline], .meet, .brand")) closeDrawers(false);   // a click anywhere else closes them
  });
  let meetFrom = null;   // the stop the Meet button was pressed on; a click outside the page goes back there
  meetBtn.addEventListener("click", () => { if (document.body.classList.contains("is-loading")) return; if (!STOPS[at].coll) meetFrom = at; goTo(idx("c0")); });
  const leaveColl = () => { const back = meetFrom; meetFrom = null; if (back !== null) goTo(back); else step(-1); };
  document.addEventListener("click", e => {
    if (!STOPS[at].coll || e.target.closest("button, a, .coll__page, .fw, [data-timeline]")) return;
    leaveColl();
  });
  $("[data-coll-close]").addEventListener("click", () => { if (STOPS[at].coll) leaveColl(); });   // the small cross does the same as a click beside the page
  document.querySelectorAll("[data-coll-go]").forEach(b => b.addEventListener("click", () => { meetFrom = null; goTo(idx(b.dataset.collGo)); }));   // About page: to the problems and the framework
  { // contact: one address (CONTACT in content.js) for the text, the copy button and Let's talk
    const mail = $("[data-mailto]"), copyBtn = $("[data-copy-email]"), label = $("[data-copy-label]"), COPY = { idle: "Copy", done: "Copied" };
    $("[data-email]").textContent = CONTACT.email; mail.href = "mailto:" + CONTACT.email + (CONTACT.subject ? "?subject=" + encodeURIComponent(CONTACT.subject) : "");
    let reset = 0;
    copyBtn.addEventListener("click", () => {
      const done = () => { label.textContent = COPY.done; copyBtn.classList.add("is-copied"); clearTimeout(reset); reset = setTimeout(() => { label.textContent = COPY.idle; copyBtn.classList.remove("is-copied"); }, 1800); };
      (navigator.clipboard ? navigator.clipboard.writeText(CONTACT.email) : Promise.reject()).then(done, () => {   // older browsers: select and copy
        const t = document.createElement("textarea"); t.value = CONTACT.email; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch (_) {} t.remove(); }); });
  }

  /* ---------- per frame ---------- */
  const OPEN_TOP = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--open-top")) / 100 || 0.55;   // read once: the opening text sits no lower than this, where the loader text is (--open-top in styles.css)
  function placeBeats() {   // beats marked data-anchor sit centred above the conductor, as on the site
    const [, y] = toScreen(V(0, STAGE.floor + STAGE.wall.high + 0.9, -STAGE.zb));   // above the back wall
    for (const k in beats) { const el = beats[k]; if (!el.dataset.anchor || !el.classList.contains("is-on")) continue;
      const h = el.offsetHeight; el.style.top = clamp(y - h - 26, vh < 600 ? 64 : 84, vh * OPEN_TOP).toFixed(0) + "px"; }
  }
  function drawMelody(now, dt) {
    const S = STOPS[at], live = !anim || anim.k > 0.6;
    MELODY.forEach((L, li) => {
      const want = (S.line || 0) > li && live ? 1 : 0;
      L.draw = want ? Math.min(1, L.draw + dt / (reduceMQ.matches ? 0.01 : 1.8)) : Math.max(0, L.draw - dt * 2.5);
      L.alpha = want ? 1 : L.draw;
      if (L.draw <= 0.001) return;
      const P = L.anchors.map(a => toScreen(a)), pts = [];
      for (let i = 0; i < P.length - 1; i++) {   // arcs from player to player, lifted above the heads
        const A = P[i], B = P[i + 1], d = Math.hypot(B[0] - A[0], B[1] - A[1]), C = [(A[0] + B[0]) / 2, Math.min(A[1], B[1]) - d * 0.28 - 12];
        for (let k = 0; k <= 30; k++) { const u = k / 30, m = 1 - u; if (i && !k) continue; pts.push([m * m * A[0] + 2 * m * u * C[0] + u * u * B[0], m * m * A[1] + 2 * m * u * C[1] + u * u * B[1]]); }
      }
      const n = Math.max(2, Math.round(pts.length * smoother(L.draw)));
      fctx.lineCap = "round"; fctx.lineJoin = "round";
      for (const [w, a] of [[9, 0.12], [4, 0.28], [1.8, 0.95]]) {
        fctx.strokeStyle = `rgba(${L.rgb}, ${a * L.alpha})`; fctx.lineWidth = w; fctx.beginPath();
        for (let i = 0; i < n; i++) i ? fctx.lineTo(pts[i][0], pts[i][1]) : fctx.moveTo(pts[i][0], pts[i][1]); fctx.stroke();
      }
      const glow = (x, y, r, a) => { const g = fctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255, 240, 215, ${a})`); g.addColorStop(0.4, `rgba(${L.rgb}, ${a * 0.6})`); g.addColorStop(1, `rgba(${L.rgb}, 0)`);
        fctx.fillStyle = g; fctx.beginPath(); fctx.arc(x, y, r, 0, 7); fctx.fill(); };
      P.forEach((p, i) => { if (i / (P.length - 1) <= L.draw + 0.01) glow(p[0], p[1], 9, 0.75 * L.alpha); });
      if (L.draw >= 1 && !reduceMQ.matches) { const u = ((now * 0.32 + li * 0.5) % 1), q = pts[Math.floor(u * (pts.length - 1))]; glow(q[0], q[1], 13, 0.95 * L.alpha); }
    });
  }
  /* ---------- frame 2 and Means: the instruments glow while the musicians go grey ---------- */
  const GLOW = new THREE.Color(0xff7420), GLOW_SELF = 1.6, GLOW_AMOUNT = 0.06, glowTmp = new THREE.Color(); let glowK = 0; const glowMats = new Set();   // the instruments glow; the musicians keep their own colours (no grey step: Kai)
  function glowTick(dt) {
    const want = STOPS[at].glow && (!anim || anim.k > 0.4) ? 1 : 0; glowK += (want - glowK) * (1 - Math.exp(-dt * 4));
    if (!glowMats.size || (window.__people && !glowMats.people && (glowMats.people = true))) for (const m of meshes) { const t = m.userData.tags || (m.userData.tags = tagsOf(m)); if (t.instrument && m.material && m.material.emissive) { if (!m.userData.ownMat) { m.material = m.material.clone(); m.userData.ownMat = true; m.material.userData.e0 = m.material.emissive.clone(); m.material.userData.i0 = m.material.emissiveIntensity; } glowMats.add(m.material); } }
    for (const mt of glowMats) { glowTmp.copy(mt.color).multiplyScalar(GLOW_SELF).lerp(GLOW, GLOW_AMOUNT); mt.emissive.copy(mt.userData.e0).lerp(glowTmp, glowK); }   // they light up in their own colour (dark wood stays wood, brass stays brass), with a touch of warmth
  }
  /* ---------- frame 2: different views, as loose lines in many colours crossing over the orchestra ---------- */
  const CHAOS_RGB = ["250, 248, 246", "252, 232, 216", "241, 64, 11", "250, 248, 246", "232, 186, 160", "252, 232, 216", "214, 196, 214"];   // paper, cream, one vermilion, warm and lavender greys: the palette of the panels
  const allPlayers = []; orkest.traverse(n => { if (/^Muzikant · /.test(n.name)) allPlayers.push(n); });
  const CHAOS = Array.from({ length: 11 }, (_, i) => { const A = allPlayers[(i * 7 + 3) % allPlayers.length], B = allPlayers[(i * 13 + 11) % allPlayers.length];
    const pa = A.getWorldPosition(V(0, 0, 0)), pb = B.getWorldPosition(V(0, 0, 0)); pa.y += 1.3; pb.y += 1.3;
    return { a: pa, b: pb, rgb: CHAOS_RGB[i % CHAOS_RGB.length], ph: i * 1.7, lift: 1.2 + (i % 4) * 0.6, delay: i * 0.12 }; });
  let chaosK = 0, chaosT = 0;
  function drawChaos(now, dt) {
    const want = STOPS[at].chaos && (!anim || anim.k > 0.5) ? 1 : 0;
    chaosK += (want - chaosK) * (1 - Math.exp(-dt * (want ? 3 : 5))); chaosT = want ? chaosT + dt : 0;
    if (chaosK < 0.01) return;
    fctx.lineCap = "round";
    CHAOS.forEach(L => {
      const P = toScreen(L.a), Q = toScreen(L.b), d = Math.hypot(Q[0] - P[0], Q[1] - P[1]), w1 = Math.sin(now * 0.9 + L.ph), w2 = Math.cos(now * 0.7 + L.ph * 1.3);
      const c1 = [P[0] + (Q[0] - P[0]) * 0.3 + w1 * 40, Math.min(P[1], Q[1]) - d * 0.35 * L.lift + w2 * 30], c2 = [P[0] + (Q[0] - P[0]) * 0.7 - w2 * 40, Math.min(P[1], Q[1]) - d * 0.2 * L.lift - w1 * 30];
      const grow = reduceMQ.matches ? 1 : clamp((chaosT - L.delay) / 1.2, 0, 1), n = 40, pts = [];
      for (let k = 0; k <= n * smoother(want ? grow : 1); k++) { const u = k / n, m = 1 - u; pts.push([m*m*m*P[0] + 3*m*m*u*c1[0] + 3*m*u*u*c2[0] + u*u*u*Q[0], m*m*m*P[1] + 3*m*m*u*c1[1] + 3*m*u*u*c2[1] + u*u*u*Q[1]]); }
      if (pts.length < 2) return;
      for (const [w, a] of [[4, 0.06], [1, 0.62]]) { fctx.strokeStyle = `rgba(${L.rgb}, ${a * chaosK})`; fctx.lineWidth = w; fctx.beginPath(); pts.forEach((p, i) => i ? fctx.lineTo(p[0], p[1]) : fctx.moveTo(p[0], p[1])); fctx.stroke(); }
    });
  }
  /* ---------- tension: the brass turns away and plays for itself; the conductor gives up ---------- */
  const inSect = (n, name) => { for (let p = n; p; p = p.parent) if (p.parent === orkest) return p.name === name; return false; };
  const brass = allPlayers.filter(n => inSect(n, "Koper"));
  brass.forEach(n => { n.userData.ry = n.rotation.y; n.userData.rx = n.rotation.x; n.userData.y0 = n.position.y; });
  let offK = 0, offT = 0;
  window.__offT = () => offT;
  function tension(now, dt) {
    const want = STOPS[at].off && (!anim || anim.k > 0.6) ? 1 : 0;
    offT = want ? offT + dt : Math.max(0, offT - dt * 3); offK += (want - offK) * (1 - Math.exp(-dt * (want ? 2 : 6)));
    if (offK < 0.001 && !want) { if (brass.moved) { brass.forEach(n => { n.rotation.y = n.userData.ry; n.rotation.x = n.userData.rx; n.position.y = n.userData.y0; }); brass.moved = false; shadows.dirty = true; } return; }
    brass.moved = true; shadows.dirty = true;
    brass.forEach((n, i) => { const turn = smoother(clamp((offT - 0.2 - i * 0.12) / 1.4, 0, 1)), play = offK * Math.sin(now * 5.2 + i * 0.6);
      n.rotation.y = n.userData.ry + turn * (i % 2 ? 2.7 : -2.5); n.rotation.x = n.userData.rx + play * 0.035; n.position.y = n.userData.y0 + Math.max(0, play) * 0.02; });
    // the conductor lowers the baton once the brass has turned away
    if (typeof conductor !== "undefined" && conductor && conductor.attached && !reduceMQ.matches) {
      const k = smoother(clamp((offT - 2.0) / 1.2, 0, 1)) * offK, beat = Math.sin(now * 2.2) * (1 - k), sway = Math.sin(now * 1.1) * (1 - k);
      if (k > 0.001) poseArms(conductor, dir, { l: V(lerp(0.32, 0.24, k), lerp(1.32 + Math.sin(now * 2.2 + 1) * 0.05, 0.9, k), lerp(0.36, 0.1, k)), r: V(lerp(-0.34 + sway * 0.06, -0.24, k), lerp(1.36 + beat * 0.1, 0.92, k), lerp(0.4, 0.14, k)) }, beat, { l: 0.25, r: 0.75 }, V(0.25 * k, 1, 0.1 + 0.15 * k));
    }
  }
  /* ---------- fewer draw calls: meshes that always fade together are merged per material (site only; the model page keeps every part clickable) ---------- */
  // Units (what fades or moves as one; docs/perf.md, phase 4): each brass player and each melody player on its own, every other section as a whole,
  // the stands without the conductor's, his stand, the audience, the rehearsal (without its live conductor), the box office and the stage.
  // Inside a unit, meshes merge per kind (body, instrument, chair: glow and grey work per kind) and per identical material. The first material of
  // each group is kept as it is (a copy would lose its shader hooks); tinted clothes move their tint from the material to the vertices.
  const merged = { orch: false, aud: false }, KIND = { Instrument: "Instrument", Stoel: "Stoel", Lichaam: "Lichaam", Persoon: "Lichaam" };
  const matKey = o => { const x = o.material; return [x.type, x.map && x.map.uuid, x.alphaMap && x.alphaMap.uuid, x.color && x.color.getHexString(), x.emissive && x.emissive.getHexString(), x.emissiveIntensity,
    x.roughness, x.metalness, x.side, x.alphaTest, x.envMapIntensity, !!x.userData.tint, x.onBeforeCompile.toString(), o.castShadow, o.renderOrder, !!o.geometry.attributes.uv].join("|"); };
  function tintPerVertex(mat) {   // the tintBody recolouring, with the tint read from the vertices (one material for many people)
    mat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\n attribute vec3 tintC; varying vec3 vTint;").replace("#include <begin_vertex>", "#include <begin_vertex>\n vTint = tintC;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n varying vec3 vTint;").replace("#include <map_fragment>", `#include <map_fragment>
        { vec3 c = diffuseColor.rgb; float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = (mx - mn) / max(mx, 1e-4);
          float k = (1.0 - smoothstep(0.03, 0.06, mx)) * (1.0 - smoothstep(0.3, 0.5, sat));
          diffuseColor.rgb = mix(c, vTint * clamp(mx / 0.009, 0.45, 1.5), k); }`); };
    mat.customProgramCacheKey = () => "tintv"; mat.needsUpdate = true;
  }
  function flatGeometry(o, M, tint) {   // float copy of position, normal and uv in the unit's space; mirrored parts get their triangles turned back
    const g = o.geometry, out = new THREE.BufferGeometry(), n = g.attributes.position.count;
    for (const k of ["position", "normal", "uv"]) { const a = g.attributes[k]; if (!a) continue; const f = new Float32Array(n * a.itemSize);
      for (let i = 0; i < n; i++) { f[i * a.itemSize] = a.getX(i); f[i * a.itemSize + 1] = a.getY(i); if (a.itemSize > 2) f[i * a.itemSize + 2] = a.getZ(i); }
      out.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); }
    if (tint) { const c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set([tint.r, tint.g, tint.b], i * 3); out.setAttribute("tintC", new THREE.BufferAttribute(c, 3)); }
    const idx = g.index ? Array.from(g.index.array) : Array.from({ length: n }, (_, i) => i);
    if (M.determinant() < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    out.setIndex(idx); out.applyMatrix4(M); return out;
  }
  function mergeUnit(root, skip) {
    root.updateMatrixWorld(true); const inMeshes = new Set(meshes), groups = new Map(), toRoot = root.matrixWorld.clone().invert();
    root.traverse(o => { if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(o.material) || !inMeshes.has(o) || (skip && skip(o))) return;
      let kind = ""; for (let n = o.parent; n && n !== root && !kind; n = n.parent) kind = KIND[n.name] || "";
      const key = kind + "|" + matKey(o); if (!groups.has(key)) groups.set(key, { kind, list: [] }); groups.get(key).list.push(o); });
    const gone = new Set();
    for (const { kind, list } of groups.values()) {
      if (list.length < 2) continue;
      const mat = list[0].material, tinted = !!mat.userData.tint;
      const geo = THREE.BufferGeometryUtils.mergeBufferGeometries(list.map(o => flatGeometry(o, toRoot.clone().multiply(o.matrixWorld), tinted && o.material.userData.tint)), false);
      if (!geo) continue;
      if (tinted) tintPerVertex(mat);
      const c = V(0, 0, 0); list.forEach(o => c.add(V(0, 0, 0).setFromMatrixPosition(o.matrixWorld))); c.divideScalar(list.length).applyMatrix4(toRoot);   // transparent meshes are sorted by their position: keep the parts' average,
      geo.translate(-c.x, -c.y, -c.z);                                                                                                                       // so the merged mesh is drawn in the same order (faded players behind the floor)
      const me = new THREE.Mesh(geo, mat); me.position.copy(c); me.name = (kind || root.name) + " · samengevoegd"; me.castShadow = list[0].castShadow; me.receiveShadow = true; me.renderOrder = list[0].renderOrder; me.visible = list[0].visible;
      let holder = root; if (kind) { holder = root.children.find(c => c.name === kind && c.userData.merged) || Object.assign(new THREE.Group(), { name: kind }); holder.userData.merged = true; if (!holder.parent) root.add(holder); }
      holder.add(me); meshes.push(me); if (list[0].userData.ownMat) me.userData.ownMat = true;   // the glow already keeps this material's own colours (glowMats)
      list.forEach(o => { gone.add(o); o.removeFromParent(); if (o.geometry !== BLOB_GEO) o.geometry.dispose(); if (o.material !== mat) { glowMats.delete(o.material); o.material.dispose(); } });
    }
    for (let i = meshes.length - 1; i >= 0; i--) if (gone.has(meshes[i])) meshes.splice(i, 1);
  }
  function mergeTick() {
    if (!merged.orch && window.__people && window.__people.MUS) {
      merged.orch = true;
      const solo = new Set(); orkest.traverse(n => { if (/^Muzikant · /.test(n.name)) { const name = n.name.slice(11); if (inSect(n, "Koper") || LINE1.has(name) || LINE2.has(name)) solo.add(n); } });
      const inside = (o, set) => { for (let n = o; n; n = n.parent) if (set.has(n)) return true; return false; };
      solo.forEach(n => mergeUnit(n)); orkest.children.forEach(sec => mergeUnit(sec, o => inside(o, solo)));
      const condStand = lessen.getObjectByName("Dirigent (partituur)"); mergeUnit(condStand); mergeUnit(lessen, o => inside(o, new Set([condStand])));
      mergeUnit(CHG, o => inside(o, new Set([dir2]))); mergeUnit(kassa); mergeUnit(pod);
    }
    if (!merged.aud && window.__audience && !window.__audience.failed) { merged.aud = true; mergeUnit(pub); }
  }
  function frameLoop() {
    const now = clock.getElapsedTime(), dt = Math.min(0.1, now - (frameLoop.last || now)); frameLoop.last = now;
    let kk = 1;
    if (anim) {
      anim.k = anim.dur ? clamp((now - anim.t0) / anim.dur, 0, 1) : 1; kk = smoother(anim.k);
      const E = STOPS[anim.to].cam, s = anim.start;
      camera.position.lerpVectors(s.pos, E.pos, kk); camTarget.lerpVectors(s.target, E.target, kk);
      { // the lens follows the framed size, not the angle: what is in view grows or shrinks steadily, without zooming out and back in between a long and a wide lens
        const ds = s.pos.distanceTo(s.target), de = E.pos.distanceTo(E.target), d = camera.position.distanceTo(camTarget), tn = f => Math.tan(THREE.MathUtils.degToRad(f / 2));
        if (Math.max(s.fov, E.fov) / Math.min(s.fov, E.fov) < 1.6) camera.fov = lerp(s.fov, E.fov, kk);   // a small lens change: as before
        else { const h = Math.exp(lerp(Math.log(ds * tn(s.fov)), Math.log(de * tn(E.fov)), kk)); camera.fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(h / Math.max(d, 1e-3))), Math.min(s.fov, E.fov), Math.max(s.fov, E.fov)); } }
      if (anim.k >= 1) { anim = null; arrived = now; from = at; }
    }
    camera.lookAt(camTarget); camera.updateProjectionMatrix();
    const S = STOPS[at], F = STOPS[from], since = anim ? 0 : now - arrived, mix = anim ? kk : 1;
    if (S.seq === "twist") { lineT = anim ? 0 : now - arrived; showLines(S); }   // timed focus (sections one by one) counts from arriving: during a flight the rest dims with the camera
    if (waitGo && (window.__audience || now - waitGo.since >= AUDIENCE_WAIT)) goTo(waitGo.i, waitGo.instant);   // the audience is in (or will not come): go now
    // auto-advance inside a sequence
    const Q = S.seq && SEQS[S.seq];
    if (Q && !paused && at < Q.last && (anim ? S.fw && sameCam(STOPS[at + 1].cam, STOPS[anim.to].cam) && now - started >= S.hold : now - arrived >= S.hold)) goTo(at + 1);   // the framework's steps don't wait for the camera; every other sequence goes on once it has arrived ("It isn't" dimmed the orchestra mid-flight)
    if (paused && Q) barStart += dt;
    { // the glass disc behind the diagram follows its circle: place, size and fade
      const o = +getComputedStyle(fwEl).opacity;
      if (o > 0.005) { const c = fwEl.querySelector(":scope > circle").getBoundingClientRect(), p = fwGlass.offsetParent.getBoundingClientRect();
        fwGlass.style.transform = `translate(${(c.left - p.left).toFixed(1)}px, ${(c.top - p.top).toFixed(1)}px)`; fwGlass.style.width = c.width.toFixed(1) + "px"; fwGlass.style.height = c.height.toFixed(1) + "px"; }
      fwGlass.style.opacity = o.toFixed(3);
    }
    { // the active segment fills with the progress through its steps
      let f = anim ? anim.k : 1;
      if (Q) { let done = 0, all = 0; Q.bars.forEach((d, b) => { all += d; if (b < S.bar) done += d; }); f = (done + clamp((now - barStart) / Q.bars[S.bar], 0, 1) * Q.bars[S.bar]) / all; }
      segFills[segOf(at)].style.transform = `scaleX(${f.toFixed(3)})`; tlDot.style.left = (f * 100).toFixed(2) + "%"; }
    // focus
    const ease = 1 - Math.exp(-dt * 7);
    // the audience and the grass (hidden in the opening) change only where nobody sees it: while the camera still sees their place during a move
    // they keep their opacity; out of view they switch at once; in view after arriving they fade
    seeFrustum.setFromProjectionMatrix(seeM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const inView = { audience: seeFrustum.intersectsBox(pubBox), grass: seeFrustum.intersectsBox(grassBox), board: seeFrustum.intersectsBox(boardBox) };
    for (const m of meshes) {
      const t = m.userData.tags || (m.userData.tags = tagsOf(m));
      const lit = anim && S.fadeLate ? litOf(F, t, since) : lerp(litOf(F, t, since), litOf(S, t, since), mix);   // fadeLate: the rest stays until the camera has arrived, then fades
      const fresh = m.userData.fadeIn, goal = FALLEN + (1 - FALLEN) * lit; let op = m.material.opacity + (goal - m.material.opacity) * (anim && !fresh ? 1 : ease);   // the late audience fades in, also during a camera move
      if (t.audience || t.grass || t.board) { const seen = t.audience ? inView.audience : t.grass ? inView.grass : inView.board;   // things that come and go between stops:
        const gF = FALLEN + (1 - FALLEN) * litOf(F, t, since), gS = FALLEN + (1 - FALLEN) * litOf(S, t, since);
        if (!seen) op = goal;                                                                                   // out of view: switch at once
        else if (anim && gS > gF) op = m.material.opacity;                                                      // appearing in view: wait until out of view or arrived
        else if (anim && gS < gF) op = lerp(gF, gS, smoother(clamp(anim.k * 2, 0, 1))); }                       // leaving in view: gone in the first half of the flight, while the camera moves fastest
      if (Math.abs(goal - op) < 0.002) { op = goal; m.userData.fadeIn = false; }   // land exactly on the goal; the old "skip steps under 0.0005" could stall a fade at 0.054, just above the cut-off, leaving people "visible" at 5 % and casting full shadows
      if (op !== m.material.opacity || fresh) { const was = m.visible, cast = m.castShadow; m.material.opacity = op; m.material.depthWrite = op > 0.5; m.visible = t.booth || t.grass ? op > 0.02 : op > FALLEN + 0.004 || !!t.env;
        if (m.userData.cast0 === undefined) m.userData.cast0 = m.castShadow; m.castShadow = m.userData.cast0 && op > 0.5;   // a faded figure leaves no shadow behind
        if ((m.visible !== was && cast) || m.castShadow !== cast) shadows.dirty = true; }   // late arrivals (fresh) always get their visibility set once: at opacity 0 with a goal of 0 nothing else would
    }
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0); fctx.clearRect(0, 0, vw, vh);
    drawMelody(now, dt); drawChaos(now, dt); glowTick(dt); placeBeats(); arcTick(now);
    windU.value = now; tickPeople(now); tension(now, dt);
    if (document.body.classList.contains("is-loading") && now - (frameLoop.drawn || -1) < 0.25) return;   // behind the loader nobody sees the scene: draw it 4 times a second, so slow devices load sooner
    mergeTick(); frameLoop.drawn = now; shadowTick(now); film.render();
  }

  function resize() {
    vw = stage.clientWidth; vh = stage.clientHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    renderer.setSize(vw, vh, false); film.setSize(vw, vh);
    fx.width = Math.round(vw * dpr); fx.height = Math.round(vh * dpr);
    camera.aspect = vw / vh; camera.zoom = Math.min(1, camera.aspect / 1.2);   // portrait screens: widen the view
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize); resize();
  camera.position.copy(STOPS[0].cam.pos); camera.fov = STOPS[0].cam.fov; applyStop(STOPS[0]);
  renderer.setAnimationLoop(frameLoop);
  { // loader: follow the people loader (people.glb in, then placed), then fade in and start the opening
    const loader = $("#loader"), pct = $("#loaderPct"), note = $("#loading");
    let shown = 0, doneAt = 0, last = performance.now();
    const tick = () => {
      const tNow = performance.now(), dt = Math.min(0.5, (tNow - last) / 1000); last = tNow;
      const ready = !!window.__people || /could not/.test(note.textContent);
      let goal = 0.04 + 0.96 * (window.__peopleProgress || 0);   // people.glb: bytes in (to 70 %), decoded (80 %), placed (100 %)
      if (ready) goal = 1;
      shown = Math.min(goal, shown + Math.max(dt * (ready ? 1.5 : 0.05), (goal - shown) * (1 - Math.exp(-dt * 5))));
      pct.textContent = Math.round(shown * 100) + "%";
      if (ready && shown > 0.995) {
        if (!doneAt) doneAt = performance.now();
        if (performance.now() - doneAt > 250) {
          loader.classList.add("is-done"); document.body.classList.remove("is-loading"); document.body.classList.add("is-ready");
          // no replay of the opening text: it already sits exactly under the loader text, so the hand-over is seamless
          return;
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
  }
  // tuning hook: __story.go(i) jumps to a stop, __story.stops lists them
  window.__story = { go: i => goTo(typeof i === "string" ? idx(i) : i, true), stops: STOPS, pause: setPaused };
  window.__scene = { root, camera, view: (pos, target) => { anim = null; camera.position.copy(pos); camTarget.copy(target); } };
})();
</script>
</body>
</html>
