
  /* ================================================================
     STORY: one scene per scroll, swipe or arrow key. Each stop sets the camera, the text, the panel and what stays lit.
     Blueprint and Means play a short sequence by themselves (with pause and skip).
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
  const sec = n => orkest.getObjectByName(n);
  const player = n => orkest.getObjectByName("Muzikant · " + n);
  const orchBox = box(orkest), standBox = box(lessen), boardBox = box(bord), condBox = box(dir);
  const nextBox = box(bord2).union(box(rep));
  const boardFront = V(Math.sin(BOARD.rotY), 0.12, Math.cos(BOARD.rotY));
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
    x.fillStyle = "#e8b897"; x.fillRect(0, 0, 512, 128); x.strokeStyle = "#5c0f07"; x.lineWidth = 4; x.strokeRect(10, 10, 492, 108);
    x.fillStyle = "#3a120c"; x.font = "500 54px Georgia, serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("BOX  OFFICE", 256, 66);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
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
  const CHAPTERS = ["The concert", "The framework", "Plan", "Blueprint", "Means", "Orchestration", "Run and Change", "Your organisation", "The Collective"];
  const BOWL = orchBox.clone().union(nextBox);
  const NARROW = innerWidth <= 720;
  const shiftCam = (c, kx, ky) => { const f = c.target.clone().sub(c.pos), d = f.length(); f.normalize();   // slide the view so the text has room
    const r = f.clone().cross(V(0, 1, 0)).normalize(), u = r.clone().cross(f).normalize(), off = r.multiplyScalar(kx * d).add(u.multiplyScalar(ky * d));
    return { pos: c.pos.clone().add(off), target: c.target.clone().add(off), fov: c.fov }; };
  const sideOrUp = c => NARROW ? shiftCam(c, 0.04, -0.3) : shiftCam(c, 0, -0.27);
  const CAMC = sideOrUp(frame(BOWL, V(0.1, 0.75, 1), 40, NARROW ? 0.9 : 0.75, -1));            // high over the bowl: both stages
  const ALL4 = ["strings", "woodwinds", "brass", "percussion"];
  const SECT = ["Strijkers", "Houtblazers", "Koper", "Slagwerk"];
  const CAM2 = K([0, 3.2, 25], [0, 2.4, -4], 38);   // the closer view of frame 2, reused by Blueprint, Means and the dimensions
  const oneByOne = (t, s, t0 = 0.3, step = 0.8) => { const i = Math.floor((s - t0) / step); return t.env || t.conductor || (i >= 0 && i <= 3 && (t.section === SECT[i] || (i === 0 && (t.section === "Harp" || t.section === "Piano")))); };
  const condStandBox = box(lessen.getObjectByName("Dirigent (partituur)"));
  const STOPS = [
    { id: "open", ch: 0, cam: K([0, 2.0, 36], [0, 4.4, -10], 34), beats: ["opening"] },
    // Frame 2: It isn't. Roles, skills, views, one performance
    { id: "t0", ch: 0, seq: "twist", bar: 0, hold: 1.4, cam: CAM2, beats: ["twist"], lines: 0 },
    { id: "t1", ch: 0, seq: "twist", bar: 1, hold: 3.4, dur: 0.5, cam: CAM2, beats: ["twist"], lines: 1, focus: (t, s) => oneByOne(t, s) },
    { id: "t2", ch: 0, seq: "twist", bar: 2, hold: 2.8, dur: 0.5, cam: CAM2, beats: ["twist"], lines: 2, glow: 1 },
    { id: "t3", ch: 0, seq: "twist", bar: 3, hold: 3.2, dur: 0.5, cam: CAM2, beats: ["twist"], lines: 3, chaos: 1 },
    { id: "t4", ch: 0, seq: "twist", bar: 4, hold: 1.8, dur: 0.5, cam: CAM2, beats: ["twist"], lines: 4 },
    { id: "t5", ch: 0, seq: "twist", bar: 5, hold: 5.4, dur: 1.6, cam: frame(box(sec("Koper")).union(condBox), V(0.05, 0.42, 1), 30, innerWidth <= 720 ? 0.6 : 0.62, 0.3), beats: ["off"], off: 1 },
    // Frame 3: the framework, built up over the concert
    { id: "f0", ch: 1, seq: "fw", bar: 0, hold: 1.6, cam: K([0, 27, 25], [0, 0, -1.5], 40), beats: ["fw"], fw: "big", show: "", shade: 0.3 },
    { id: "f1", ch: 1, seq: "fw", bar: 1, hold: 1.0, dur: 0.4, cam: K([0, 27, 25], [0, 0, -1.5], 40), beats: ["fw"], fw: "big", show: "p", shade: 0.3 },
    { id: "f2", ch: 1, seq: "fw", bar: 1, hold: 1.0, dur: 0.4, cam: K([0, 27, 25], [0, 0, -1.5], 40), beats: ["fw"], fw: "big", show: "pb", shade: 0.3 },
    { id: "f3", ch: 1, seq: "fw", bar: 1, hold: 1.2, dur: 0.4, cam: K([0, 27, 25], [0, 0, -1.5], 40), beats: ["fw"], fw: "big", show: "pbm", shade: 0.3 },
    { id: "f4", ch: 1, seq: "fw", bar: 2, hold: 1.6, dur: 0.4, cam: K([0, 27, 25], [0, 0, -1.5], 40), beats: ["fw"], fw: "big", show: "pbmo", shade: 0.3 },
    { id: "f5", ch: 1, seq: "fw", bar: 3, hold: 2.8, dur: 0.4, cam: K([0, 27, 25], [0, 0, -1.5], 40), beats: ["fw"], fw: "big", show: "pbmorc", shade: 0.3 },
    // Frame 4: Plan
    { id: "plan", ch: 2, cam: frame(boardBox, boardFront.clone().add(V(0.35, 0, 0)), 40, 1.5), panel: "plan", fw: "mini", on: "p" },
    // Frame 5: Blueprint
    { id: "b1", ch: 3, seq: "bp", bar: 0, hold: 2.2, cam: CAM2, panel: "blueprint", fw: "mini", on: "b", focus: t => t.stand || t.env, caption: ["Blueprint", "The score on every stand"], top: 1 },
    { id: "b2", ch: 3, seq: "bp", bar: 1, hold: 2.8, dur: 1.8, cam: frame(condStandBox, V(0, 0.9, 0.55), 34, 1.15), panel: "blueprint", fw: "mini", on: "b", focus: t => t.env || t.condStand, caption: ["Blueprint", "The conductor’s score"], top: 1 },
    { id: "b3", ch: 3, seq: "bp", bar: 2, hold: 2.6, dur: 1.8, cam: frame(orchBox, V(0, 0.75, 1), 42, 0.74), panel: "blueprint", fw: "mini", on: "b", line: 1, fallen: 0.16, focus: t => t.env || t.stand || LINE1.has(t.player), caption: ["Value stream", "One melody, many hands"], top: 1 },
    { id: "b4", ch: 3, seq: "bp", bar: 3, hold: 3.0, cam: frame(orchBox, V(0.06, 0.72, 1), 42, 0.72), panel: "blueprint", fw: "mini", on: "b", line: 2, fallen: 0.16, focus: t => t.env || t.stand || LINE1.has(t.player) || LINE2.has(t.player), caption: ["Value streams", "Two melodies, eight specialists, four sections"], top: 1 },
    // Frame 6: Means
    { id: "m1", ch: 4, seq: "means", bar: 0, hold: 3.6, cam: CAM2, panel: "means", fw: "mini", on: "m", labels: ALL4, focus: (t, s) => oneByOne(t, s, 0.4, 0.8), caption: ["People", "Four sections, many specialists"], top: 1 },
    { id: "m2", ch: 4, seq: "means", bar: 1, hold: 2.6, dur: 0.5, cam: CAM2, panel: "means", fw: "mini", on: "m", glow: 1, caption: ["Means", "Their instruments"], top: 1 },
    { id: "m3", ch: 4, seq: "means", bar: 2, hold: 3.0, dur: 2.2, cam: frame(kassaBox, V(-0.55, 0.32, 1), 38, 1.7), panel: "means", fw: "mini", on: "m", booth: 1, caption: ["Means", "And the budget that keeps them playing"], top: 1 },
    // Frame 7: Orchestration
    { id: "orch", ch: 5, seq: "dims", bar: 0, hold: 3.6, cam: frame(condBox, V(0.1, 0.22, 1), 34, 1.7, 0.1), panel: "orchestration", fw: "mini", on: "o", focus: t => t.env || t.conductor || (t.stand && t.condStand) },
    // Frame 8: the two dimensions
    { id: "d1", ch: 6, seq: "dims", bar: 1, hold: 3.4, dur: 2.2, cam: CAM2, panel: "dims", fw: "mini", on: "r", top: 1 },
    { id: "d2", ch: 6, seq: "dims", bar: 2, hold: 3.0, dur: 2.6, cam: frame(nextBox, nextFront.clone().add(V(0.6, 0.55, 0.5)), 40, 1.35), panel: "dims", late: 1, fw: "mini", on: "c", top: 1 },
    // Frame 9 and 10: your organisation
    { id: "question", ch: 7, seq: "you", bar: 0, hold: 3.2, cam: K([0, 1.7, 45.5], [0, 3.0, -3], 46), beats: ["question"], shade: 0.25 },
    { id: "problems", ch: 7, seq: "you", bar: 1, dur: 2.4, cam: K([0, 13, 33], [0, 0.6, -3]), problems: true, shade: 0.6, fw: "side", show: "pbmorc" },
    // Part 4: The Collective. The camera rises over the bowl: tonight's concert and next season's rehearsal in one view
    { id: "c0", ch: 8, cam: CAMC, coll: 1, shade: 0.45 },
  ];
  const N = STOPS.length, idx = id => STOPS.findIndex(s => s.id === id);
  const SEQS = {};
  STOPS.forEach((s, i) => { if (!s.seq) return; const q = SEQS[s.seq] || (SEQS[s.seq] = { first: i, last: i, bars: [] }); q.last = i;
    q.bars[s.bar] = (q.bars[s.bar] || 0) + (s.dur || 1.2) + s.hold; });

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
      if (n.name === "Graan") t.grass = true;
    }
    return t;
  }
  scene.traverse(o => { if (o.isMesh && o !== skyMesh) { meshes.push(o); o.material.transparent = true; } });
  const litOf = (s, t, since) => t.grass && s.id === "open" ? -FALLEN / (1 - FALLEN) : t.booth ? (s.booth ? 1 : -FALLEN / (1 - FALLEN)) : s.booth ? (t.env || t.audience ? 1 : 0.6) : !s.focus ? 1 : s.focus(t, since) ? 1 : (s.fallen || 0) / (1 - FALLEN);

  /* ---------- labels anchored to the sections ---------- */
  const labelEls = {}; document.querySelectorAll("[data-label]").forEach(el => (labelEls[el.dataset.label] = { el, a: 0 }));
  const LABEL_AT = { strings: sec("Strijkers"), woodwinds: sec("Houtblazers"), brass: sec("Koper"), percussion: sec("Slagwerk") };
  const labelPos = {}; for (const k in LABEL_AT) { const b = box(LABEL_AT[k]); labelPos[k] = V((b.min.x + b.max.x) / 2, b.max.y + 0.5, (b.min.z + b.max.z) / 2); }
  for (const [k, g] of [["strings", "Eerste violen"], ["brass", "Hoorns"], ["percussion", "Pauken"]]) { const b = box(sec(g)); labelPos[k].x = (b.min.x + b.max.x) / 2; labelPos[k].z = (b.min.z + b.max.z) / 2; }

  /* ---------- elements ---------- */
  const stage = $("#stage"), fx = $("#fx"), fctx = fx.getContext("2d");
  const beats = {}; document.querySelectorAll("[data-beat]").forEach(el => (beats[el.dataset.beat] = el));
  const panels = {}; document.querySelectorAll("[data-panel]").forEach(el => (panels[el.dataset.panel] = el));
  const caption = $("#caption"), capKind = $("#captionKind"), capText = $("#captionText");
  const seqEl = $("#seq"), seqBars = $("#seqBars"), seqBtn = $("#seqBtn"), seqSkip = $("#seqSkip");
  const shade = $("#shade"), topShade = $("#topShade"), problems = $("#problems"), hint = $("#hint");
  const tlNum = $("#tlNum"), tlFill = $("#tlFill"), tlLabel = $("#tlLabel");
  const collEl = $("#coll"), meetBtn = $("#meet");
  const lineEls = [...document.querySelectorAll("[data-line]")], dimsLate = $("#dimsLate"), fwEl = $("#fw");
  { // the framework figure, B2: floating rounded bands inside a circle, two columns, the Orchestration ring with its arrow
    const CX = 320, CY = 262, R = 192, W = "rgba(250,248,246,.14)", WS = "rgba(250,248,246,.8)", O = "rgba(241,64,11,.2)", VER = "#F1400B";
    const pill = (x, y, w, h, fill, stroke) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(Math.min(w, h) / 2).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    const band = (d, k, l, sub) => { const hw = Math.sqrt(R * R - (Math.abs(d) + 32) ** 2);
      return `<g class="k" data-k="${k}">${pill(CX - hw, CY + d - 30, 2 * hw, 60, W, WS)}<text x="${(CX - hw + 26).toFixed(1)}" y="${CY + d + 2}" font-size="21">${l}</text><text class="sub" x="${(CX - hw + 26).toFixed(1)}" y="${CY + d + 20}" font-size="13" font-style="italic" opacity=".75">${sub}</text></g>`; };
    const col = (dx, k, l, sub) => { const hh = Math.sqrt(R * R - (Math.abs(dx) + 30) ** 2);
      return `<g class="k" data-k="${k}">${pill(CX + dx - 28, CY - hh, 56, 2 * hh, O, VER)}<text class="lab" x="${CX + dx}" y="${(CY - hh - 10).toFixed(1)}" text-anchor="middle">${l.toUpperCase()}</text><text class="sub" transform="translate(${CX + dx + 5} ${CY}) rotate(-90)" text-anchor="middle" font-size="13" font-style="italic" opacity=".85">${sub}</text></g>`; };
    const RO = 228, a = 0.62;
    fwEl.innerHTML = `<defs><marker id="fwArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#FAF8F6"/></marker></defs>
      <circle cx="${CX}" cy="${CY}" r="205" fill="rgba(26,14,10,.18)" stroke="rgba(250,248,246,.4)"/>`
      + band(-104, "p", "Plan", "the piece") + band(0, "b", "Blueprint", "the score") + band(104, "m", "Means", "the orchestra") + col(40, "r", "Run", "tonight\u2019s concert") + col(110, "c", "Change", "next season\u2019s symphony")
      + `<g class="k" data-k="o"><path d="M ${CX} ${CY - RO} A ${RO} ${RO} 0 1 1 ${(CX - RO * Math.sin(a)).toFixed(1)} ${(CY - RO * Math.cos(a)).toFixed(1)}" fill="none" stroke="#FAF8F6" stroke-width="2.4" marker-end="url(#fwArrow)"/>
        <text class="lab" x="${CX}" y="${CY + RO + 30}" text-anchor="middle" font-size="16">ORCHESTRATION</text><text class="sub" x="${CX}" y="${CY + RO + 50}" text-anchor="middle" font-size="13" font-style="italic" opacity=".75">the conductor</text></g>`;
  }
  let vw = 0, vh = 0, dpr = 1;
  const toScreen = v => { const q = v.clone().project(camera); return [(q.x + 1) / 2 * vw, (1 - q.y) / 2 * vh, q.z < 1]; };

  /* ---------- moving between stops ---------- */
  const clock = new THREE.Clock();
  let at = 0, from = 0, anim = null, arrived = 0, started = 0, paused = false, seqShown = null, barStart = 0, curBar = -1;
  const camNow = () => ({ pos: camera.position.clone(), target: camTarget.clone(), fov: camera.fov });
  const camTarget = STOPS[0].cam.target.clone();
  function goTo(i, instant) {
    i = clamp(i, 0, N - 1); if (i === at && !anim) return;
    const now = clock.getElapsedTime(), S = STOPS[i], P = STOPS[at];
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
    if (S.caption) { capKind.textContent = S.caption[0]; capText.textContent = S.caption[1]; }
    problems.classList.toggle("is-on", !!S.problems);
    lineEls.forEach(li => li.classList.toggle("is-shown", +li.dataset.line <= (S.lines ?? 4)));
    dimsLate.classList.toggle("is-late", !!S.late); $("#dimsOrgC").classList.toggle("is-late", !!S.late);
    fwEl.classList.toggle("is-on", !!S.fw); fwEl.classList.toggle("is-mini", S.fw === "mini"); fwEl.classList.toggle("is-side", S.fw === "side"); fwEl.classList.toggle("is-coll", S.fw === "coll");
    collEl.classList.toggle("is-on", !!S.coll);
    meetBtn.classList.toggle("is-hidden", S.ch === 8);
    fwEl.querySelectorAll(".k").forEach(g => { const k = g.dataset.k;
      g.style.opacity = S.fw === "mini" ? (k === S.on ? 1 : 0.16) : (S.show || "").includes(k) ? 1 : 0; });
    shade.style.opacity = S.shade || 0; topShade.classList.toggle("is-on", !!S.top);
    hint.style.opacity = at === 0 ? 1 : 0;
    tlNum.textContent = String(S.ch + 1).padStart(2, "0"); tlLabel.textContent = CHAPTERS[S.ch];
    tlFill.style.transform = `scaleX(${(at / (N - 1)).toFixed(3)})`;
    if (S.seq !== seqShown) {   // build the bars of a sequence once it starts
      seqShown = S.seq || null; seqEl.classList.toggle("is-on", !!S.seq); seqBars.innerHTML = "";
      if (S.seq) SEQS[S.seq].bars.forEach(() => { const b = document.createElement("span"); b.className = "seq__bar"; b.appendChild(document.createElement("i")); seqBars.appendChild(b); });
    }
    dots.forEach(d => d.setAttribute("aria-current", d._i === (S.seq ? SEQS[S.seq].first : at) ? "step" : "false"));
  }
  function setPaused(v) {
    paused = v; seqBtn.setAttribute("aria-label", v ? "Play" : "Pause");
    seqBtn.innerHTML = v ? '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 0 L10 5 L1 10 Z"/></svg>'
                         : '<svg viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="0" width="3" height="10"/><rect x="6" y="0" width="3" height="10"/></svg>';
    if (!v) arrived = clock.getElapsedTime() - (STOPS[at].hold || 0) * 0.5;   // resume: a short wait, then on
  }
  seqBtn.addEventListener("click", () => setPaused(!paused));
  seqSkip.addEventListener("click", () => { const q = SEQS[STOPS[at].seq]; if (q) goTo(q.last + 1); });
  function step(d) {   // one gesture = one scene; a running sequence counts as one scene
    if (document.body.classList.contains("is-loading")) return;
    meetFrom = null;
    const q = STOPS[at].seq && SEQS[STOPS[at].seq];
    if (q) { paused = false; setPaused(false); goTo(d > 0 ? q.last + 1 : q.first - 1); return; }
    goTo(at + d);
  }

  /* ---------- input: wheel, keys, swipe, dots ---------- */
  const WHEEL_REST = 0.45; let wheelQuiet = 0, wheelAcc = 0;
  addEventListener("wheel", e => {
    e.preventDefault();
    const now = clock.getElapsedTime(), quiet = now - wheelQuiet; wheelQuiet = now;
    if ((anim && anim.k < 0.85) || quiet < WHEEL_REST && wheelAcc === 0) return;
    wheelAcc += e.deltaY; if (Math.abs(wheelAcc) < 24) return;
    step(Math.sign(wheelAcc)); wheelAcc = 0;
  }, { passive: false });
  addEventListener("keydown", e => {
    if (e.target.closest && e.target.closest("button") && (e.key === " " || e.key === "Enter")) return;
    if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); step(1); }
    if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); step(-1); }
    if (document.body.classList.contains("is-loading")) return;
    if (e.key === "Home") goTo(0); if (e.key === "End") goTo(N - 1);
  });
  let touchY = null;
  stage.addEventListener("touchstart", e => { touchY = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchmove", e => { if (!e.target.closest(".problems, .coll__page")) e.preventDefault(); }, { passive: false });
  stage.addEventListener("touchend", e => { if (touchY === null) return; if (e.target.closest(".coll__page") && $(".coll__page").scrollHeight > $(".coll__page").clientHeight + 4) { touchY = null; return; } const dy = touchY - e.changedTouches[0].clientY; touchY = null; if (Math.abs(dy) > 40) step(Math.sign(dy)); });
  const nav = $("#scenes");
  const dots = [];
  STOPS.forEach((s, i) => { if (s.seq && SEQS[s.seq].first !== i) return;
    const b = document.createElement("button"); b.className = "dot"; b.type = "button"; b._i = i;
    const name = { open: "The concert", t0: "It isn’t", f0: "The framework", plan: "Plan", b1: "Blueprint", m1: "Means", orch: "Orchestration",
      d1: "Run and Change", question: "Your organisation", problems: "Sound familiar?", c0: "The Collective" }[s.id] || s.id;
    b.setAttribute("aria-label", name); b.title = name; b.addEventListener("click", () => goTo(i)); nav.appendChild(b); dots.push(b); });
  if (matchMedia("(pointer: coarse)").matches) hint.textContent = "Swipe";
  // the framework figure is a table of contents: a part of it jumps to its frame
  const FW_TO = { p: "plan", b: "b1", m: "m1", o: "orch", r: "d1", c: "d2" };
  fwEl.addEventListener("click", e => { const g = e.target.closest(".k"); if (!g || !fwEl.classList.contains("is-on")) return; if (!(fwEl.classList.contains("is-mini") || fwEl.classList.contains("is-side"))) return; goTo(idx(FW_TO[g.dataset.k])); });
  { const cf = $("#collFw"); cf.innerHTML = fwEl.innerHTML.replace(/id="fwArrow"/, 'id="collArrow"').replace(/url\(#fwArrow\)/g, "url(#collArrow)");
    cf.addEventListener("click", e => { const g = e.target.closest(".k"); if (g) goTo(idx(FW_TO[g.dataset.k])); }); }
  let meetFrom = null;   // the stop the Meet button was pressed on; a click outside the page goes back there
  meetBtn.addEventListener("click", () => { if (document.body.classList.contains("is-loading")) return; if (!STOPS[at].coll) meetFrom = at; goTo(idx("c0")); });
  document.addEventListener("click", e => {
    if (!STOPS[at].coll || e.target.closest("button, a, .coll__page, .fw, .scenes")) return;
    const back = meetFrom; meetFrom = null; if (back !== null) goTo(back); else step(-1);
  });

  /* ---------- per frame ---------- */
  function placeBeats() {   // beats marked data-anchor sit centred above the conductor, as on the site
    const [, y] = toScreen(V(0, STAGE.floor + STAGE.wall.high + 0.9, -STAGE.zb));   // above the back wall
    for (const k in beats) { const el = beats[k]; if (!el.dataset.anchor || !el.classList.contains("is-on")) continue;
      const h = el.offsetHeight; el.style.top = clamp(y - h - 26, vh < 600 ? 64 : 84, vh * 0.55).toFixed(0) + "px"; }
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
  const GLOW = new THREE.Color(0xff7420), GREY = { value: 0 }; let greyDone = false; let glowK = 0; const glowMats = new Set();
  function glowTick(dt) {
    const want = STOPS[at].glow && (!anim || anim.k > 0.4) ? 1 : 0; glowK += (want - glowK) * (1 - Math.exp(-dt * 4));
    if (!glowMats.size || (window.__people && !glowMats.people && (glowMats.people = true))) for (const m of meshes) { const t = m.userData.tags || (m.userData.tags = tagsOf(m)); if (t.instrument && m.material && m.material.emissive) { if (!m.userData.ownMat) { m.material = m.material.clone(); m.userData.ownMat = true; m.material.userData.e0 = m.material.emissive.clone(); m.material.userData.i0 = m.material.emissiveIntensity; } glowMats.add(m.material); } }
    for (const mt of glowMats) { mt.emissive.copy(mt.userData.e0).lerp(GLOW, glowK); mt.emissiveIntensity = mt.userData.i0 + glowK * 0.4; if (mt.color) { if (!mt.userData.c0) mt.userData.c0 = mt.color.clone(); mt.color.copy(mt.userData.c0).lerp(GLOW, glowK * 0.6); } }
    GREY.value = glowK;
    if (want && !greyDone && window.__people) { greyDone = true; // the musicians lose their colour: a desaturate step in their shaders
      for (const m of meshes) { const t = m.userData.tags || (m.userData.tags = tagsOf(m)); if (!(t.person || t.chair) || t.instrument || t.conductor) continue;
        for (const mt of [].concat(m.material)) { if (mt.userData.grey) continue; mt.userData.grey = true;
          mt.onBeforeCompile = sh => { sh.uniforms.uGrey = GREY; sh.fragmentShader = "uniform float uGrey;\n" + sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(.299, .587, .114)) * 0.45 + 0.16), uGrey);"); };
          mt.needsUpdate = true; } } }
  }
  /* ---------- frame 2: different views, as loose lines in many colours crossing over the orchestra ---------- */
  const CHAOS_RGB = ["241, 64, 11", "222, 170, 72", "252, 232, 216", "196, 160, 214", "232, 132, 96", "176, 196, 214", "240, 200, 150"];
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
      for (const [w, a] of [[6, 0.1], [1.4, 0.75]]) { fctx.strokeStyle = `rgba(${L.rgb}, ${a * chaosK})`; fctx.lineWidth = w; fctx.beginPath(); pts.forEach((p, i) => i ? fctx.lineTo(p[0], p[1]) : fctx.moveTo(p[0], p[1])); fctx.stroke(); }
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
    if (offK < 0.001 && !want) { if (brass.moved) { brass.forEach(n => { n.rotation.y = n.userData.ry; n.rotation.x = n.userData.rx; n.position.y = n.userData.y0; }); brass.moved = false; } return; }
    brass.moved = true;
    brass.forEach((n, i) => { const turn = smoother(clamp((offT - 0.2 - i * 0.12) / 1.4, 0, 1)), play = offK * Math.sin(now * 5.2 + i * 0.6);
      n.rotation.y = n.userData.ry + turn * (i % 2 ? 2.7 : -2.5); n.rotation.x = n.userData.rx + play * 0.035; n.position.y = n.userData.y0 + Math.max(0, play) * 0.02; });
    // the conductor lowers the baton once the brass has turned away
    if (typeof conductor !== "undefined" && conductor && conductor.attached && !reduceMQ.matches) {
      const k = smoother(clamp((offT - 2.0) / 1.2, 0, 1)) * offK, beat = Math.sin(now * 2.2) * (1 - k), sway = Math.sin(now * 1.1) * (1 - k);
      if (k > 0.001) poseArms(conductor, dir, { l: V(lerp(0.32, 0.24, k), lerp(1.32 + Math.sin(now * 2.2 + 1) * 0.05, 0.9, k), lerp(0.36, 0.1, k)), r: V(lerp(-0.34 + sway * 0.06, -0.24, k), lerp(1.36 + beat * 0.1, 0.92, k), lerp(0.4, 0.14, k)) }, beat, { l: 0.25, r: 0.75 }, V(0.25 * k, 1, 0.1 + 0.15 * k));
    }
  }
  function frameLoop() {
    const now = clock.getElapsedTime(), dt = Math.min(0.1, now - (frameLoop.last || now)); frameLoop.last = now;
    let kk = 1;
    if (anim) {
      anim.k = anim.dur ? clamp((now - anim.t0) / anim.dur, 0, 1) : 1; kk = smoother(anim.k);
      const E = STOPS[anim.to].cam, s = anim.start;
      camera.position.lerpVectors(s.pos, E.pos, kk); camTarget.lerpVectors(s.target, E.target, kk); camera.fov = lerp(s.fov, E.fov, kk);
      if (anim.k >= 1) { anim = null; arrived = now; from = at; }
    }
    camera.lookAt(camTarget); camera.updateProjectionMatrix();
    const S = STOPS[at], F = STOPS[from], since = now - started, mix = anim ? kk : 1;
    // auto-advance inside a sequence
    const Q = S.seq && SEQS[S.seq];
    if (Q && !anim && !paused && at < Q.last && now - arrived >= S.hold) goTo(at + 1);
    if (Q) { const bars = seqBars.children, dur = Q.bars[S.bar];
      for (let b = 0; b < bars.length; b++) bars[b].firstChild.style.transform = `scaleX(${b < S.bar ? 1 : b > S.bar ? 0 : clamp((now - barStart) / dur, 0, 1).toFixed(3)})`; }
    if (paused && Q) barStart += dt;
    // focus
    const ease = 1 - Math.exp(-dt * 7);
    for (const m of meshes) {
      const t = m.userData.tags || (m.userData.tags = tagsOf(m));
      const lit = lerp(litOf(F, t, since), litOf(S, t, since), mix);
      const goal = FALLEN + (1 - FALLEN) * lit, op = m.material.opacity + (goal - m.material.opacity) * (anim ? 1 : ease);
      if (Math.abs(m.material.opacity - op) > 0.0005) { m.material.opacity = op; m.material.depthWrite = op > 0.5; m.visible = t.booth || t.grass ? op > 0.02 : op > FALLEN + 0.004 || !!t.env; }
    }
    // labels
    for (const k in labelEls) { const L = labelEls[k], want = (S.labels || []).includes(k) && (!anim || anim.k > 0.5) ? 1 : 0;
      L.a += (want - L.a) * (1 - Math.exp(-dt * 5)); const [x, y] = toScreen(labelPos[k]);
      L.el.style.opacity = L.a.toFixed(3); L.el.style.transform = `translate3d(${(x - L.el.offsetWidth / 2).toFixed(1)}px, ${(y - 30 + (1 - L.a) * 8).toFixed(1)}px, 0)`; }
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0); fctx.clearRect(0, 0, vw, vh);
    drawMelody(now, dt); drawChaos(now, dt); glowTick(dt); placeBeats();
    windU.value = now; tickPeople(now); tension(now, dt);
    film.render(now);
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
  { // loader: follow the people loader (musicians, then audience), then fade in and start the opening
    const loader = $("#loader"), fill = $("#loaderFill"), pct = $("#loaderPct"), note = $("#loading");
    let shown = 0, doneAt = 0, last = performance.now();
    const tick = () => {
      const tNow = performance.now(), dt = Math.min(0.5, (tNow - last) / 1000); last = tNow;
      const txt = note.textContent, m = txt.match(/(\d+) \/ (\d+)/), ready = !!window.__people || /could not/.test(txt);
      let goal = 0.08;
      if (m && /Musicians/.test(txt)) goal = 0.1 + 0.5 * (+m[1] / +m[2]);
      if (m && /Audience/.test(txt)) goal = 0.6 + 0.4 * (+m[1] / +m[2]);
      if (ready) goal = 1;
      shown = Math.min(goal, shown + Math.max(dt * (ready ? 1.5 : 0.05), (goal - shown) * (1 - Math.exp(-dt * 5))));
      fill.style.transform = `scaleX(${shown.toFixed(3)})`; pct.textContent = Math.round(shown * 100) + "%";
      if (ready && shown > 0.995) {
        if (!doneAt) doneAt = performance.now();
        if (performance.now() - doneAt > 250) {
          loader.classList.add("is-done"); document.body.classList.remove("is-loading");
          for (const k in beats) beats[k].classList.remove("is-on"); void document.body.offsetWidth; applyStop(STOPS[at]);   // replay the opening text
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
