
  /* ---------- renderer ---------- */
  const small = Math.min(innerWidth, innerHeight) < 640;
  const canvas = document.getElementById("c");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });   // the canvas only gets the film pass's full-screen quad; the scene itself is multisampled in the film target
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x4a2a24, 90, 420);   // warm dark haze inside the bowl; the far ranges carry their own haze   // pale haze, no beige: distant land fades into the AD sky
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2600);   // far enough for the land to run to the horizon
  const controls = new THREE.OrbitControls(camera, canvas);
  /* ---------- film look: the scene renders into an HDR buffer, then one pass gives it the aged, warm photo feel of
     the reference (soft halation around bright parts, lifted warm blacks, softer contrast, slight fade, a vignette low in the frame). No grain or lens fringing: a clean image.
     Phones get the same look with fewer samples. ---------- */
  const film = (() => {
    const HF = THREE.HalfFloatType, q = small ? 4 : 3;
    const mk = (w, h, s = 0) => { const t = new THREE.WebGLRenderTarget(w, h, { type: HF, samples: s, stencilBuffer: s > 0 }); /* stencil forces a 24-bit depth buffer */ t.texture.generateMipmaps = false; return t; };
    let main = mk(1, 1, small ? 2 : 4), A = mk(1, 1), B = mk(1, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); qs.add(quad); quad.frustumCulled = false;
    const VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }";
    const bright = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, exp: { value: 1 } }, vertexShader: VS, depthTest: false, depthWrite: false,
      fragmentShader: "uniform sampler2D t; uniform float exp; varying vec2 vUv; void main(){ vec4 s = texture2D(t, vUv); vec3 c = s.rgb * exp * mix(0.5, 1.0, s.a); float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(0.75, 2.2, l), 1.); }" });
    const blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: VS, depthTest: false, depthWrite: false,
      fragmentShader: "uniform sampler2D t; uniform vec2 dir; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227; c += (texture2D(t, vUv + dir * 1.385).rgb + texture2D(t, vUv - dir * 1.385).rgb) * 0.316; c += (texture2D(t, vUv + dir * 3.231).rgb + texture2D(t, vUv - dir * 3.231).rgb) * 0.070; gl_FragColor = vec4(c, 1.); }" });
    const final = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
      uniforms: { tS: { value: null }, tB: { value: null }, exp: { value: 0.9 } },
      vertexShader: VS, fragmentShader: `
        uniform sampler2D tS, tB; uniform float exp; varying vec2 vUv;
        vec3 fRrtOdt(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
        vec3 fAces(vec3 c){ const mat3 I = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
          const mat3 O = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
          c *= exp / 0.6; c = I * c; c = fRrtOdt(c); c = O * c; return clamp(c, 0.0, 1.0); }
        vec3 fSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        void main(){
          vec2 d = vUv - 0.5; float r2 = dot(d, d);
          vec4 s = texture2D(tS, vUv);
          vec3 c = s.rgb;
          vec3 hal = texture2D(tB, vUv).rgb;
          c += hal * vec3(1.0, 0.62, 0.42) * 0.55;                                     // warm halation, as on film
          vec3 col = mix(c + hal * vec3(1.0, 0.62, 0.42) * 0.25, fSRGB(fAces(c)), s.a);   // the sky is already in screen colour (alpha 0)
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(l), col, 0.84);                                               // slightly faded colour
          col = mix(col, col * mix(vec3(1.04, 0.99, 0.90), vec3(1.06, 0.97, 0.87), s.a), smoothstep(0.35, 1.0, l));   // warm, creamy highlights; golden-hour gold on the lit scene, not on the sky
          col = col * 0.93 + vec3(0.055, 0.038, 0.030) * (1.0 - col);                   // lifted, warm blacks; softer contrast
          col *= mix(1.0, 0.66, smoothstep(0.12, 0.55, r2 * 1.6) * (1.0 - smoothstep(0.3, 0.55, vUv.y)));   // vignette, lower half only: the sky stays clean
          gl_FragColor = vec4(col, 1.0);
        }` });
    const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(qs, qc); };
    return {
      setSize(w, h) { const pr = renderer.getPixelRatio(), W = Math.max(1, Math.floor(w * pr)), H = Math.max(1, Math.floor(h * pr));
        main.setSize(W, H); A.setSize(Math.max(1, W >> q), Math.max(1, H >> q)); B.setSize(Math.max(1, W >> q), Math.max(1, H >> q)); },
      render() {
        renderer.setRenderTarget(main); renderer.render(scene, camera);
        bright.uniforms.t.value = main.texture; bright.uniforms.exp.value = renderer.toneMappingExposure; pass(bright, A);
        const iw = 1 / A.width, ih = 1 / A.height;
        for (const k of small ? [1] : [1, 2.2]) { blur.uniforms.t.value = A.texture; blur.uniforms.dir.value.set(iw * k, 0); pass(blur, B); blur.uniforms.t.value = B.texture; blur.uniforms.dir.value.set(0, ih * k); pass(blur, A); }
        Object.assign(final.uniforms.tS, { value: main.texture }); final.uniforms.tB.value = A.texture; final.uniforms.exp.value = renderer.toneMappingExposure;
        pass(final, null);
      } };
  })();
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 1.2; controls.maxDistance = 140;

  scene.add(new THREE.HemisphereLight(0x9a9cb8, 0x2a140c, 0.22));   // little fill: AD wants deep shadow
  const sun = new THREE.DirectionalLight(SUN.color, SUN.intensity);
  sun.position.set(...SUN.pos); sun.target.position.set(...SUN.target); scene.add(sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(small ? 2048 : 4096, small ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 260 });   // wide: the bowl rim throws one big shadow
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.05;
  scene.add(sun);

  /* ---------- materials (one spec per key; every mesh gets its own copy so it can fade) ---------- */
  const MAT = {
    suit:    { color: 0x221715, roughness: 0.85 },
    collar:  { color: 0xF2EDE4, roughness: 0.9 },
    hair:    { color: 0x2a1a12, roughness: 0.9 },
    skin:    { color: 0xc99470, roughness: 0.75 },
    frame:   { color: 0x040303, roughness: 0.55, metalness: 0.15 },   // black lacquered steel (stands, chair frames)
    plush:   { color: 0x16120f, roughness: 0.7 },
    seatAud: { color: 0x040404, roughness: 0.85 },   // audience chairs: black seat and back, matte so the sun does not turn them brown
    frameAud: { color: 0x050404, roughness: 0.5, metalness: 0.15 },   // black chairs: nothing red competes with the conductor
    wood:    { color: 0x2c0f05, roughness: 0.4 },   // dark antique wood
    ebony:   { color: 0x1c1210, roughness: 0.5 },
    brass:   { color: 0x7a5a26, roughness: 0.3, metalness: 0.85 },   // darker, aged brass
    silver:  { color: 0xcfcac2, roughness: 0.3, metalness: 0.85 },
    copper:  { color: 0x5a2812, roughness: 0.35, metalness: 0.75 },
    drumhead:{ color: 0xEDE4D3, roughness: 0.9 },
    piano:   { color: 0x0b0908, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 },   // gloss black concert grand
    ivory:   { color: 0xF2EDE4, roughness: 0.5 },
    paper:   { color: 0xffffff, roughness: 1 },
    red:     { color: AD.conductor, roughness: 0.8 },
    stage:   { color: 0xF0EBE1, roughness: 0.92, emissive: 0x000000, emissiveIntensity: 0 },   // warm white plaster, no glow of its own
    tier:    { color: 0xF3EFE7, roughness: 0.92, emissive: 0x000000, emissiveIntensity: 0 },
    reveal:  { color: 0x2a201c, roughness: 1 },
    earth:   { color: 0xffffff, roughness: 1, vertexColors: true },   // terrain: colour per vertex from the AD earth tones
    far:     { color: 0xffffff, roughness: 1, vertexColors: true },
    wall:    { color: 0xE3DDD1, roughness: 0.92, emissive: 0x000000, emissiveIntensity: 0 },
    band:    { color: 0xDDD6C9, roughness: 0.92, emissive: 0x000000, emissiveIntensity: 0 },
    earth2:  { color: 0x4e1c10, roughness: 1 },
    earth3:  { color: 0x3f160c, roughness: 1 },
    grain:   { color: AD.grain, roughness: 1 },
    stalk:   { color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.5 },
    board:   { color: 0x303030, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.8 },   // printed board: readable in sun and shade
    podium:  { color: 0x2b1d18, roughness: 0.8 },
    shoe:    { color: 0x060505, roughness: 0.3, metalness: 0.05, envMapIntensity: 0.5 },
    varnish: { color: 0x1f0803, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.15 },   // dark polished varnish
    maple:   { color: 0xd8b07a, roughness: 0.6 },
    gut:     { color: 0xd8d2c4, roughness: 0.4, metalness: 0.6 },
  };
  const SKIN = [0xe0b896, 0xc99470, 0xa8714f, 0x7a4a30, 0x5a3524];
  const HAIR = [0x1A0E0A, 0x3a2418, 0x6b4a2e, 0x8f877f, 0x241510];
  const CLOTHES = [0x2a1d18, 0x3b2a22, 0x4a3a30, 0x5C2414, 0x6b5a4a, 0x2f2a2a, 0x7a6a55];
  const SHEET = (() => {   // staff paper for the music stands
    const cv = document.createElement("canvas"); cv.width = 128; cv.height = 96; const x = cv.getContext("2d");
    x.fillStyle = "#fbf8f2"; x.fillRect(0, 0, 128, 96); x.strokeStyle = "#2a1d18"; x.fillStyle = "#2a1d18";
    for (let s = 0; s < 4; s++) { for (let l = 0; l < 5; l++) { const y = 12 + s * 22 + l * 3; x.beginPath(); x.moveTo(8, y); x.lineTo(120, y); x.stroke(); }
      for (let n = 0; n < 10; n++) { x.beginPath(); x.ellipse(14 + n * 10.5, 12 + s * 22 + ((n * 5 + s * 3) % 5) * 3, 2.2, 1.6, -0.4, 0, 7); x.fill(); } }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
  })();
  const NOISE_GLSL = `
    float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y); }
    float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; } return s / 0.9375; }
    float ridged(vec2 p){ float a = 0.5, s = 0.0; for (int k = 0; k < 5; k++) { s += a * (1.0 - abs(vnoise(p) * 2.0 - 1.0)); p = p * 2.1 + vec2(5.2, 1.3); a *= 0.5; } return s; }
    float swell(vec2 p){ return vnoise(p) * 0.65 + vnoise(p * 2.3 + vec2(3.1, 7.7)) * 0.35; }`;
  const PLASTER = (() => {   // hand-trowelled white plaster: soft clouds, trowel arcs and fine pores (map + bump)
    const N = 512, cv = document.createElement("canvas"); cv.width = cv.height = N; const x = cv.getContext("2d");
    x.fillStyle = "#f3f1ed"; x.fillRect(0, 0, N, N);
    const rnd = (() => { let a = 7; return () => (a = (a * 16807) % 2147483647) / 2147483647; })();
    for (let i = 0; i < 260; i++) { const px = rnd() * N, py = rnd() * N, r = 20 + rnd() * 90, v = rnd() < 0.5 ? 255 : 200;
      const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(${v},${v},${v - 6},.04)`); g.addColorStop(1, "rgba(0,0,0,0)");
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { x.save(); x.translate(ox, oy); x.fillStyle = g; x.fillRect(px - r, py - r, 2 * r, 2 * r); x.restore(); } }
    for (let i = 0; i < 140; i++) { const px = rnd() * N, py = rnd() * N, r = 30 + rnd() * 70, a0 = rnd() * 6.3;
      x.strokeStyle = rnd() < 0.5 ? "rgba(255,255,255,.12)" : "rgba(170,160,150,.06)"; x.lineWidth = 1 + rnd() * 3;
      x.beginPath(); x.arc(px, py, r, a0, a0 + 0.5 + rnd() * 0.9); x.stroke(); }
    x.strokeStyle = "rgba(90,78,66,.28)"; x.lineWidth = 1.6;   // panel joints every 1.5 m (the texture covers 3 m)
    for (const k of [0, N / 2]) { x.beginPath(); x.moveTo(k + 1, 0); x.lineTo(k + 1, N); x.moveTo(0, k + 1); x.lineTo(N, k + 1); x.stroke(); }
    x.strokeStyle = "rgba(255,255,255,.2)"; x.lineWidth = 1; for (const k of [0, N / 2]) { x.beginPath(); x.moveTo(k + 3.5, 0); x.lineTo(k + 3.5, N); x.moveTo(0, k + 3.5); x.lineTo(N, k + 3.5); x.stroke(); }
    const id = x.getImageData(0, 0, N, N); for (let i = 0; i < id.data.length; i += 4) { const n = (rnd() - 0.5) * 9 + (rnd() < 0.002 ? -35 : 0); for (let c = 0; c < 3; c++) id.data[i + c] = Math.max(0, Math.min(255, id.data[i + c] + n)); }
    x.putImageData(id, 0, 0);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.33, 0.33); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    const cb = document.createElement("canvas"); cb.width = cb.height = N; const xb = cb.getContext("2d"); xb.filter = "blur(2px)"; for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) xb.drawImage(cv, ox, oy);   // softened copy for the relief: pixel grain in a bump map sparkles on grazing faces
    const b = new THREE.CanvasTexture(cb); b.wrapS = b.wrapT = THREE.RepeatWrapping; b.repeat.set(0.33, 0.33); return { map: t, bump: b };
  })();
  function material(key, over) {
    const spec = { ...MAT[key], ...(over || {}) };
    const plaster = ["stage", "tier", "wall", "band"].includes(key);
    if (plaster) Object.assign(spec, { map: PLASTER.map, bumpMap: PLASTER.bump, bumpScale: 0.15 });   // warm stone plaster, no glow of its own: the sun makes the shadows
    const m = spec.clearcoat ? new THREE.MeshPhysicalMaterial(spec) : new THREE.MeshStandardMaterial(spec);
    if (plaster) m.onBeforeCompile = sh => {   // weathering: earth-stained foot, soft streaks down the walls, slightly worn edges
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\n varying vec3 vW; varying vec3 vNw;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n vW = (modelMatrix * vec4(transformed, 1.0)).xyz; vNw = normalize(mat3(modelMatrix) * objectNormal);");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n varying vec3 vW; varying vec3 vNw;\n" + NOISE_GLSL).replace("#include <map_fragment>", `#include <map_fragment>
        float side = 1.0 - abs(vNw.y);
        float foot = 1.0 - smoothstep(0.0, 0.18 + 0.12 * vnoise(vW.xz * 2.0), vW.y);                      // earth splashed up the outer edge
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.5, 0.42), foot * side * 0.8);
        float streak = smoothstep(0.55, 0.9, vnoise(vec2(vW.x * 3.0 + vW.z * 3.0, vW.y * 0.35))) * side * smoothstep(0.4, 1.6, vW.y);
        diffuseColor.rgb *= 1.0 - streak * 0.06;                                                           // rain streaks on the back wall
        diffuseColor.rgb *= 0.92 + 0.11 * fbm(vW.xz * 0.35 + vW.y);                                         // uneven, hand-made tone
        diffuseColor.rgb *= 1.0 - 0.05 * smoothstep(0.55, 0.8, fbm(vW.xz * 1.3 + 4.0)) * (1.0 - side);     // scuffed, walked-on patches on the floor
      `);
    };
    if (spec.envMapIntensity === undefined) m.envMapIntensity = (spec.metalness || 0) > 0.5 ? 1 : spec.clearcoat ? 0.55 : 0.2;   // reflections mainly on metal and lacquer
    return m;
  }

  /* ---------- geometry helpers ---------- */
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = V(0, 1, 0);
  function prep(geo) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups(); return g;
  }
  // A Part collects pieces per material and becomes one mesh per material (few draw calls, still one object).
  class Part {
    constructor(name) { this.name = name; this.pieces = new Map(); this.over = new Map(); }
    add(geo, key, matrix, over) {
      const g = prep(geo); if (matrix) g.applyMatrix4(matrix);
      const k = over ? key + JSON.stringify(over, (n, v) => (v && v.isTexture ? v.uuid : v)) : key;
      if (!this.pieces.has(k)) { this.pieces.set(k, []); this.over.set(k, [key, over]); }
      this.pieces.get(k).push(g); return this;
    }
    build(parent, iso = false) {
      const grp = new THREE.Group(); grp.name = this.name; grp.userData.iso = iso;
      for (const [k, list] of this.pieces) {
        const [key, over] = this.over.get(k);
        const geo = THREE.BufferGeometryUtils.mergeBufferGeometries(list, false);
        const m = new THREE.Mesh(geo, material(key, over)); m.name = key; m.castShadow = true; m.receiveShadow = true;
        grp.add(m);
      }
      if (parent) parent.add(grp); return grp;
    }
  }
  const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
  function along(a, b, extra) {   // matrix placing a +Y aligned geometry from a to b
    const d = b.clone().sub(a), L = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(1, 1, 1));
    return extra ? m.multiply(extra) : m;
  }
  function seg(part, a, b, r, key, cap = true) {
    const L = a.distanceTo(b);
    const geo = cap ? new THREE.CapsuleGeometry(r, Math.max(0.001, L), 2, 6) : new THREE.CylinderGeometry(r, r, L, 6);
    part.add(geo, key, along(a, b));
  }
  function basis(yAxis, zHint, pos) {   // y = long axis, z = face normal
    const y = yAxis.clone().normalize(), x = new THREE.Vector3().crossVectors(y, zHint).normalize(), z = new THREE.Vector3().crossVectors(x, y);
    return new THREE.Matrix4().makeBasis(x, y, z).setPosition(pos);
  }
  const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const bell = (r, len, base = 0.012) => lathe(Array.from({ length: 9 }, (_, i) => { const t = i / 8; return [base + (r - base) * Math.pow(t, 3), len * t]; }));

  // Violin family body: a figure-eight outline, extruded. Long axis = y, thickness = z.
  const STRING_BODY = (() => {
    const w = y => Math.max(
      0.105 * Math.sqrt(Math.max(0, 1 - ((y + 0.08) / 0.1) ** 2)),
      0.085 * Math.sqrt(Math.max(0, 1 - ((y - 0.085) / 0.09) ** 2)), 0.055 * (Math.abs(y) < 0.12 ? 1 : 0));
    const pts = []; const N = 40;
    for (let i = 0; i <= N; i++) { const y = -0.18 + 0.355 * i / N; pts.push(new THREE.Vector2(Math.max(w(y), 0.02), y)); }
    for (let i = N; i >= 0; i--) { const y = -0.18 + 0.355 * i / N; pts.push(new THREE.Vector2(-Math.max(w(y), 0.02), y)); }
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 8 });
    g.translate(0, 0, -0.02); return g;
  })();
  function stringInstrument(part, s, origin, yAxis, zHint) {   // s: size factor (violin 1)
    const B = basis(yAxis, zHint, origin);
    part.add(STRING_BODY, "wood", B.clone().multiply(M(0, 0, 0, 0, 0, 0, s, s, s * (s > 1.5 ? 1.7 : 1))));
    part.add(new THREE.BoxGeometry(0.035 * s, 0.30 * s, 0.025 * s), "ebony", B.clone().multiply(M(0, 0.30 * s, 0.02 * s)));
    part.add(new THREE.SphereGeometry(0.025 * s, 8, 6), "wood", B.clone().multiply(M(0, 0.47 * s, 0.02 * s)));
    part.add(new THREE.BoxGeometry(0.03 * s, 0.25 * s, 0.006), "ebony", B.clone().multiply(M(0, 0.05 * s, 0.03 * s * (s > 1.5 ? 1.7 : 1))));
  }
  function bow(part, a, b) { seg(part, a, b, 0.004, "ebony", false); seg(part, a.clone().add(V(0, -0.015, 0)), b.clone().add(V(0, -0.015, 0)), 0.002, "ivory", false); }

  // Refined strings for the real-person musicians: one carved outline at cello size, scaled for violin, viola and double bass.
  const CELLO_BODY = (() => {
    const e = (y, cy, ry, rx) => rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
    const w = y => Math.max(e(y, -0.165, 0.21, 0.22), e(y, 0.19, 0.185, 0.17), 0.012);
    const pts = [], N = 60;
    for (let i = 0; i <= N; i++) { const y = -0.375 + 0.75 * i / N; pts.push(V(w(y), y, 0)); }
    for (let i = N; i >= 0; i--) { const y = -0.375 + 0.75 * i / N; pts.push(V(-w(y), y, 0)); }
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.11, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 3, curveSegments: 8 });
    g.translate(0, 0, -0.055); return g;
  })();
  // base: bottom edge of the body, d: long axis toward the scroll, zHint: where the top plate faces, k: size (cello 1).
  function refinedString(ins, base, d, zHint, k, endpin) {
    d = d.clone().normalize();
    const B = basis(d, zHint, base.clone().add(d.clone().multiplyScalar(0.375 * k))).multiply(new THREE.Matrix4().makeScale(k, k, k));
    const at = (x, y, z) => V(x, y, z).applyMatrix4(B), P = m => B.clone().multiply(m), top = 0.067;
    ins.add(CELLO_BODY, "varnish", P(M(0, 0, 0)));
    ins.add(new THREE.BoxGeometry(0.05, 0.36, 0.05), "varnish", P(M(0, 0.53, top - 0.03)));
    ins.add(new THREE.BoxGeometry(0.06, 0.62, 0.012), "ebony", P(M(0, 0.5, top + 0.022, 0.03)));
    ins.add(new THREE.BoxGeometry(0.045, 0.13, 0.05), "varnish", P(M(0, 0.77, top - 0.025)));
    ins.add(new THREE.TorusGeometry(0.026, 0.012, 8, 16, Math.PI * 1.6), "varnish", P(M(0, 0.86, top - 0.03, 0, Math.PI / 2, 0)));
    for (const [y, sx] of [[0.73, 1], [0.76, -1], [0.79, 1], [0.82, -1]]) ins.add(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), "ebony", P(M(sx * 0.03, y, top - 0.025, 0, 0, Math.PI / 2)));
    ins.add(new THREE.BoxGeometry(0.1, 0.008, 0.07), "maple", P(M(0, -0.06, top + 0.035, Math.PI / 2, 0, 0)));
    ins.add(new THREE.BoxGeometry(0.065, 0.2, 0.012), "ebony", P(M(0, -0.25, top + 0.015)));
    const sr = 0.0016 * Math.max(0.7, Math.sqrt(k));
    for (const x of [-0.021, -0.007, 0.007, 0.021]) {
      const a = at(x * 1.3, -0.17, top + 0.022), b = at(x * 1.15, -0.06, top + 0.07), c = at(x * 0.6, 0.71, top + 0.032);
      ins.add(new THREE.CylinderGeometry(sr, sr, a.distanceTo(b), 4), "gut", along(a, b));
      ins.add(new THREE.CylinderGeometry(sr, sr, b.distanceTo(c), 4), "gut", along(b, c));
    }
    for (const sx of [-1, 1]) {
      ins.add(new THREE.BoxGeometry(0.007, 0.13, 0.004), "ebony", P(M(sx * 0.075, -0.06, top + 0.001, 0, 0, sx * 0.12)));
      for (const y of [-0.125, 0.005]) ins.add(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 8), "ebony", P(M(sx * 0.075 + (y > 0 ? -sx : sx) * 0.008, y, top + 0.001, Math.PI / 2)));
    }
    if (endpin) ins.add(new THREE.CylinderGeometry(0.007 * k, 0.004 * k, endpin + 0.02, 6), "silver", along(base.clone().add(d.clone().multiplyScalar(-endpin)), base.clone().add(d.clone().multiplyScalar(0.02))));
    const X = new THREE.Vector3().setFromMatrixColumn(B, 0).normalize(), Z = new THREE.Vector3().setFromMatrixColumn(B, 2).normalize();
    return { at, neck: at(0, 0.46, top + 0.03), string: at(0, 0.1, top + 0.06), X, Z, d };
  }
  function refinedBow(ins, frog, tip) {
    const mid = frog.clone().lerp(tip, 0.5).add(V(0, 0.012, 0));
    ins.add(new THREE.CylinderGeometry(0.0045, 0.0055, frog.distanceTo(mid), 6), "ebony", along(frog, mid));
    ins.add(new THREE.CylinderGeometry(0.0035, 0.0045, mid.distanceTo(tip), 6), "ebony", along(mid, tip));
    const hf = frog.clone().add(V(0, -0.022, 0)), ht = tip.clone().add(V(0, -0.008, 0));
    ins.add(new THREE.BoxGeometry(0.008, hf.distanceTo(ht), 0.001), "ivory", along(hf, ht));
    ins.add(new THREE.BoxGeometry(0.012, 0.04, 0.026), "ebony", along(frog.clone().add(V(0, -0.012, 0)), frog.clone().lerp(tip, 0.06).add(V(0, -0.012, 0))));
  }
  function twoBone(sh, target, L1, L2, pole) {   // elbow / knee position for a two-segment chain
    const d = target.clone().sub(sh), dist = Math.min(d.length(), L1 + L2 - 0.005), n = d.normalize();
    const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const p = pole.clone().sub(n.clone().multiplyScalar(pole.dot(n))).normalize();
    return sh.clone().add(n.clone().multiplyScalar(a)).add(p.multiplyScalar(h));
  }

  /* ---------- figures ---------- */
  const TORSO = lathe([[0.0, 0], [0.16, 0], [0.18, 0.12], [0.165, 0.3], [0.2, 0.5], [0.19, 0.56], [0.1, 0.62], [0.05, 0.64]], 12);
  const HEAD = new THREE.SphereGeometry(0.1, 12, 9);
  const HAIRCAP = new THREE.SphereGeometry(0.106, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
  function variant(i) { return { skin: SKIN[i % SKIN.length], hair: HAIR[(i * 3 + 1) % HAIR.length], style: i % 4, clothes: CLOTHES[(i * 5) % CLOTHES.length] }; }
  function headAndHair(part, hy, v, back = false) {
    part.add(HEAD, "skin", M(0, hy, 0, 0, 0, 0, 1, 1.15, 1), { color: v.skin });
    part.add(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 8), "skin", M(0, hy - 0.13, 0), { color: v.skin });
    part.add(HAIRCAP, "hair", M(0, hy + 0.01, -0.01, -0.55, 0, 0, 1, 1.12, 1.05), { color: v.hair });
    if (v.style === 1) part.add(new THREE.SphereGeometry(0.055, 10, 8), "hair", M(0, hy + 0.03, -0.11), { color: v.hair });          // bun
    if (v.style === 2) part.add(new THREE.CapsuleGeometry(0.09, 0.14, 4, 10), "hair", M(0, hy - 0.08, -0.06, 0, 0, 0, 1, 1, 0.55), { color: v.hair });            // long
    if (v.style === 3 && back) part.add(new THREE.SphereGeometry(0.12, 12, 10), "hair", M(0, hy + 0.02, -0.02, 0, 0, 0, 1.1, 1, 1.1), { color: v.hair }); // curls
  }
  // Seated figure facing +z. h = seat height. Returns key points for arm targets.
  function seatedFigure(part, h, v, hands, clothKey = "suit", clothOver) {
    const sY = h + 0.58, hy = h + 0.86;
    part.add(TORSO, clothKey, M(0, h + 0.02, -0.04, 0, 0, 0, 1, 1, 0.72), clothOver);
    part.add(new THREE.TorusGeometry(0.05, 0.014, 6, 14), "collar", M(0, h + 0.64, -0.03, Math.PI / 2));
    headAndHair(part, hy, v);
    for (const s of [-1, 1]) {
      const hip = V(s * 0.09, h + 0.06, 0.0), knee = V(s * 0.11, h + 0.07, 0.42), ankle = V(s * 0.12, 0.1, 0.47);
      seg(part, hip, knee, 0.075, clothKey); seg(part, knee, ankle, 0.06, clothKey);
      part.add(new THREE.BoxGeometry(0.1, 0.07, 0.24), "frame", M(s * 0.12, 0.035, 0.53));
    }
    if (hands) for (const s of [-1, 1]) {
      const sh = V(s * 0.19, sY, -0.03), hand = hands[s < 0 ? 0 : 1];
      const mid = sh.clone().add(hand).multiplyScalar(0.5).add(V(s * 0.1, -0.12, -0.05));
      seg(part, sh, mid, 0.055, clothKey); seg(part, mid, hand, 0.045, clothKey);
      part.add(new THREE.SphereGeometry(0.04, 8, 6), "skin", M(hand.x, hand.y, hand.z), { color: v.skin });
    }
    return { sY, hy };
  }
  function chairPart(name, h, plush = "plush", bench = false, frame = "frame") {
    const p = new Part(name);
    p.add(new THREE.BoxGeometry(0.46, 0.06, 0.44), plush, M(0, h - 0.03, 0.02));
    if (!bench) p.add(new THREE.BoxGeometry(0.44, 0.31, 0.05), plush, M(0, h + 0.33, -0.215, -0.08));   // open gap under the back, as on orchestra chairs
    for (const [x, z] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.2], [0.2, 0.2]]) p.add(new THREE.CylinderGeometry(0.015, 0.015, h - 0.06, 6), frame, M(x, (h - 0.06) / 2, z));
    if (!bench) for (const x of [-0.2, 0.2]) p.add(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 6), frame, M(x, h + 0.2, -0.23));
    return p;
  }

  /* ---------- instruments: each returns [handL, handR] and adds geometry to `ins` ---------- */
  const INSTR = {
    "viool": (ins, h) => { const sY = h + 0.58; const chin = V(-0.1, sY + 0.03, 0.06), d = V(-0.35, -0.06, 1).normalize();
      stringInstrument(ins, 1, chin.clone().add(d.clone().multiplyScalar(0.18)), d, V(0.3, 1, 0));
      bow(ins, V(0.32, sY - 0.06, 0.22), V(-0.28, sY + 0.06, 0.26)); return [V(-0.27, sY + 0.0, 0.47), V(0.12, sY - 0.04, 0.24)]; },
    "altviool": (ins, h) => { const sY = h + 0.58; const chin = V(-0.1, sY + 0.03, 0.06), d = V(-0.35, -0.08, 1).normalize();
      stringInstrument(ins, 1.15, chin.clone().add(d.clone().multiplyScalar(0.2)), d, V(0.3, 1, 0));
      bow(ins, V(0.34, sY - 0.07, 0.24), V(-0.28, sY + 0.05, 0.3)); return [V(-0.3, sY - 0.02, 0.53), V(0.13, sY - 0.05, 0.26)]; },
    "cello": (ins, h) => { const pin = V(0, 0.02, 0.62), d = V(0, 1, -0.32).normalize();
      ins.add(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 4), "silver", along(pin, pin.clone().add(d.clone().multiplyScalar(0.12))));
      stringInstrument(ins, 2.1, pin.clone().add(d.clone().multiplyScalar(0.12 + 0.38)), d, V(0, 0, 1));
      bow(ins, V(0.42, h + 0.18, 0.5), V(-0.15, h + 0.26, 0.5)); return [V(-0.05, h + 0.7, 0.4), V(0.25, h + 0.2, 0.5)]; },
    "contrabas": (ins, h) => { const pin = V(0.05, 0.02, 0.6), d = V(-0.04, 1, -0.22).normalize();
      ins.add(new THREE.CylinderGeometry(0.008, 0.008, 0.15, 4), "silver", along(pin, pin.clone().add(d.clone().multiplyScalar(0.15))));
      stringInstrument(ins, 3.0, pin.clone().add(d.clone().multiplyScalar(0.15 + 0.54)), d, V(0, 0, 1));
      bow(ins, V(0.45, h - 0.05, 0.55), V(-0.1, h + 0.0, 0.55)); return [V(-0.08, h + 0.65, 0.42), V(0.28, h - 0.02, 0.52)]; },
    "fluit": (ins, h) => { const hy = h + 0.86; seg(ins, V(-0.08, hy - 0.08, 0.12), V(0.58, hy - 0.13, 0.2), 0.012, "silver", false);
      return [V(0.06, hy - 0.1, 0.15), V(0.4, hy - 0.12, 0.18)]; },
    "hobo": (ins, h) => { const hy = h + 0.86, a = V(0, hy - 0.08, 0.1), b = V(0, h + 0.36, 0.44);
      seg(ins, a, b, 0.012, "ebony", false); ins.add(bell(0.025, 0.06), "ebony", along(b.clone().add(b.clone().sub(a).normalize().multiplyScalar(-0.03)), b.clone().add(b.clone().sub(a).normalize().multiplyScalar(0.03))));
      return [V(0, hy - 0.27, 0.22), V(0, h + 0.56, 0.36)]; },
    "klarinet": (ins, h) => { const hy = h + 0.86, a = V(0, hy - 0.08, 0.1), b = V(0, h + 0.33, 0.46);
      seg(ins, a, b, 0.014, "ebony", false); ins.add(bell(0.035, 0.08, 0.014), "ebony", along(b.clone(), b.clone().add(b.clone().sub(a).normalize().multiplyScalar(0.08))));
      return [V(0, hy - 0.28, 0.23), V(0, h + 0.54, 0.38)]; },
    "fagot": (ins, h) => { const hy = h + 0.86, a = V(0.2, h + 0.02, 0.34), b = V(0.14, hy + 0.32, 0.22);
      seg(ins, a, b, 0.04, "wood", false); seg(ins, V(0.14, hy - 0.04, 0.22), V(0.02, hy - 0.08, 0.1), 0.006, "silver", false);
      return [V(0.15, hy - 0.08, 0.28), V(0.2, h + 0.36, 0.34)]; },
    "hoorn": (ins, h) => { ins.add(new THREE.TorusGeometry(0.15, 0.02, 8, 24), "brass", M(0.16, h + 0.44, 0.22, 0, Math.PI / 2.3, 0));
      const b0 = V(0.24, h + 0.36, 0.12), b1 = V(0.34, h + 0.3, -0.12); ins.add(bell(0.14, 0.26, 0.02), "brass", along(b0, b1, M(0, -0.13)));
      seg(ins, V(0.1, h + 0.56, 0.2), V(0.02, h + 0.78, 0.1), 0.008, "brass", false); return [V(0.06, h + 0.5, 0.3), V(0.3, h + 0.33, 0.0)]; },
    "trompet": (ins, h) => { const hy = h + 0.86, a = V(0, hy - 0.08, 0.1), b = V(0, hy - 0.12, 0.36);
      seg(ins, a, b, 0.011, "brass", false); ins.add(bell(0.06, 0.2), "brass", along(b, b.clone().add(V(0, -0.01, 0.2)), M(0, -0.1)));
      for (const z of [0.2, 0.24, 0.28]) ins.add(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8), "brass", M(0.0, hy - 0.11, z));
      return [V(-0.02, hy - 0.15, 0.3), V(0.02, hy - 0.12, 0.24)]; },
    "trombone": (ins, h) => { const hy = h + 0.86;
      for (const x of [-0.03, 0.03]) seg(ins, V(x, hy - 0.1, 0.1), V(x, hy - 0.2, 0.9), 0.008, "brass", false);
      ins.add(bell(0.1, 0.28, 0.015), "brass", along(V(-0.12, hy - 0.06, 0.32), V(-0.12, hy - 0.09, 0.6), M(0, -0.14)));
      return [V(-0.06, hy - 0.12, 0.22), V(0.03, hy - 0.18, 0.66)]; },
    "tuba": (ins, h) => { ins.add(lathe([[0.06, 0], [0.11, 0.15], [0.12, 0.45], [0.16, 0.7], [0.27, 0.92], [0.28, 0.94]]), "brass", M(0.02, h + 0.12, 0.28, -0.12));
      seg(ins, V(0.0, h + 0.62, 0.2), V(0.0, h + 0.78, 0.1), 0.01, "brass", false); return [V(-0.14, h + 0.62, 0.32), V(0.14, h + 0.55, 0.34)]; },
    "pauken": (ins, h) => { for (const x of [-0.45, 0.45]) {
        ins.add(lathe([[0.02, 0], [0.22, 0.04], [0.33, 0.18], [0.37, 0.42], [0.37, 0.44]]), "copper", M(x, 0.4, 0.62));
        ins.add(new THREE.CylinderGeometry(0.37, 0.37, 0.01, 28), "drumhead", M(x, 0.845, 0.62));
        for (const a of [0, 2.1, 4.2]) ins.add(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 5), "frame", M(x + Math.cos(a) * 0.3, 0.21, 0.62 + Math.sin(a) * 0.3)); }
      for (const s of [-1, 1]) seg(ins, V(s * 0.36, h + 0.22, 0.5), V(s * 0.4, 0.88, 0.75), 0.006, "ebony", false);
      return [V(-0.36, h + 0.22, 0.48), V(0.36, h + 0.22, 0.48)]; },
    "grote trom": (ins, h) => { ins.add(new THREE.CylinderGeometry(0.42, 0.42, 0.36, 28, 1, true), "wood", M(0, 0.82, 0.62, 0, 0, Math.PI / 2), { side: THREE.DoubleSide });
      for (const x of [-0.18, 0.18]) ins.add(new THREE.CylinderGeometry(0.42, 0.42, 0.01, 28), "drumhead", M(x, 0.82, 0.62, 0, 0, Math.PI / 2));
      for (const s of [-1, 1]) seg(ins, V(s * 0.2, 0, 0.45), V(s * 0.05, 0.6, 0.62), 0.015, "frame", false), seg(ins, V(s * 0.2, 0, 0.8), V(s * 0.05, 0.6, 0.62), 0.015, "frame", false);
      seg(ins, V(0.16, h + 0.32, 0.42), V(0.2, 0.9, 0.58), 0.008, "ebony", false); return [V(-0.14, h + 0.28, 0.35), V(0.16, h + 0.32, 0.42)]; },
    "bekkens": (ins, h) => { const sY = h + 0.58;
      for (const s of [-1, 1]) ins.add(lathe([[0.01, 0.03], [0.05, 0.025], [0.2, 0]], 24), "brass", M(s * 0.17, sY - 0.1, 0.33, 0, 0, s * Math.PI / 2), { side: THREE.DoubleSide });
      return [V(-0.15, sY - 0.1, 0.33), V(0.15, sY - 0.1, 0.33)]; },
    "xylofoon": (ins, h) => { ins.add(new THREE.BoxGeometry(1.3, 0.05, 0.42), "frame", M(0, 0.8, 0.65));
      for (const [x, z] of [[-0.6, 0.48], [0.6, 0.48], [-0.6, 0.82], [0.6, 0.82]]) ins.add(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 6), "frame", M(x, 0.4, z));
      for (let i = 0; i < 16; i++) { const L = 0.38 - i * 0.012; ins.add(new THREE.BoxGeometry(0.06, 0.025, L), "wood", M(-0.56 + i * 0.075, 0.84, 0.65)); }
      for (const s of [-1, 1]) seg(ins, V(s * 0.22, h + 0.22, 0.45), V(s * 0.2, 0.86, 0.66), 0.005, "ebony", false);
      return [V(-0.22, h + 0.22, 0.45), V(0.22, h + 0.22, 0.45)]; },
    "harp": (ins, h) => { const base = V(0.32, 0.05, 0.42), top = V(0.22, 1.55, 0.02), col0 = V(0.36, 0.05, 0.78), col1 = V(0.34, 1.78, 0.62);
      seg(ins, base, top, 0.07, "wood"); seg(ins, col0, col1, 0.028, "brass", false); seg(ins, top, col1, 0.04, "wood");
      for (let i = 1; i < 10; i++) { const t = i / 10; const a = base.clone().lerp(top, t), b = col0.clone().lerp(col1, Math.min(1, t * 1.15)); b.y = Math.max(a.y + 0.05, top.clone().lerp(col1, t).y); seg(ins, a, V(a.x + (b.x - a.x) * 0.9, b.y, a.z + (b.z - a.z) * 0.9), 0.003, "ivory", false); }
      return [V(0.22, h + 0.35, 0.42), V(0.3, h + 0.62, 0.22)]; },
    "piano": (ins, h) => {
      const pts = [[-0.74, 0], [0.74, 0], [0.74, 0.55], [0.55, 1.0], [0.2, 1.6], [-0.05, 2.1], [-0.25, 2.25], [-0.74, 2.25]];
      const sh = new THREE.Shape(pts.map(([x, s]) => new THREE.Vector2(x, s)));
      const caseG = new THREE.ExtrudeGeometry(sh, { depth: 0.32, bevelEnabled: false, curveSegments: 12 }); caseG.rotateX(Math.PI / 2);
      ins.add(caseG, "piano", M(0, 1.0, 0.4));
      const lid = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false }); lid.rotateX(Math.PI / 2); lid.translate(0.74, 0, 0);
      ins.add(lid, "piano", M(-0.74, 1.02, 0.4, 0, 0, 0.6).multiply(M(0, 0, 0)));
      ins.add(new THREE.BoxGeometry(1.4, 0.06, 0.16), "ivory", M(0, 0.72, 0.36));
      for (let i = 0; i < 20; i++) ins.add(new THREE.BoxGeometry(0.025, 0.03, 0.09), "piano", M(-0.66 + i * 0.07, 0.765, 0.33));
      for (const [x, z] of [[-0.62, 0.55], [0.62, 0.55], [-0.5, 2.0]]) ins.add(new THREE.CylinderGeometry(0.05, 0.035, 0.68, 8), "piano", M(x, 0.34, z));
      seg(ins, V(0.5, 1.02, 1.3), V(0.62, 1.5, 1.25), 0.01, "piano", false);
      return [V(-0.2, h + 0.3, 0.33), V(0.2, h + 0.3, 0.33)]; },
  };
  const SEAT = { "contrabas": 0.75, "pauken": 0.65, "xylofoon": 0.62, "grote trom": 0.6, "bekkens": 0.55 };

  /* ---------- real-person poses (route B). Frame of the musician: facing +z, the player's left hand on +x.
     Each hand: t = wrist target, dir = where the fingers point, palm = where the palm faces, curl 0 open .. 1 fist, pole = where the elbow goes.
     legs: spread = how far the feet go apart, footZ = how far forward. head: [look down, tilt to the left, turn to the left] in radians. ---------- */
  const mirX = p => V(-p.x, p.y, p.z);
  const RINSTR = {   // strings are rebuilt in this frame (no mirror), with their bows
    "viool": (ins, h) => violinLike(ins, h, 0.48, 0),
    "altviool": (ins, h) => violinLike(ins, h, 0.55, 0.01),
    "cello": (ins, h) => {
      const pin = V(0, 0.02, 0.62), d = V(0.1, 1, -0.6).normalize(), c = refinedString(ins, pin.clone().add(d.clone().multiplyScalar(0.125)), d, V(0, 0, 1), 1, 0.125);
      const frog = c.string.clone().add(V(-0.28, 0.06, 0.04)), tip = c.string.clone().add(V(0.4, -0.06, 0.04)); refinedBow(ins, frog, tip);
      return { L: { t: c.neck.clone().add(V(0.06, -0.07, -0.02)), dir: V(-0.5, 0.6, 0.6), palm: V(-1, 0, -0.3), curl: 0.75, pole: V(1, -0.4, 0.2) },
               R: { t: frog.clone().add(V(-0.02, 0.035, -0.03)), dir: V(0.3, -0.6, 1), palm: V(0.2, -1, 0.3), curl: 0.9 },
               legs: { spread: 0.2, footZ: 0.48 }, head: [0.25, 0, 0] };
    },
    "contrabas": (ins, h) => {
      const k = 1.42, pin = V(0.08, 0.02, 0.5), d = V(0.12, 1, -0.32).normalize(), c = refinedString(ins, pin.clone().add(d.clone().multiplyScalar(0.125 * k)), d, V(-0.25, 0, 1), k, 0.125 * k);
      const frog = c.string.clone().add(V(-0.3, 0.05, 0.05)), tip = c.string.clone().add(V(0.4, -0.08, 0.05)); refinedBow(ins, frog, tip);
      return { L: { t: c.at(0.02, 0.52, 0.0).add(V(0.07, -0.06, -0.04)), dir: V(-0.5, 0.7, 0.5), palm: V(-1, 0, -0.3), curl: 0.75, pole: V(1, -0.6, 0.1) },
               R: { t: frog.clone().add(V(-0.02, 0.035, -0.03)), dir: V(0.3, -0.6, 1), palm: V(0.2, -1, 0.3), curl: 0.9 },
               legs: { spread: 0.12, footZ: 0.42 }, head: [0.2, 0, 0.1] };
    },
  };
  function violinLike(ins, h, k, lower) {   // violin and viola on the left collarbone, scroll forward-left, bow across the strings
    const base = V(0.1, h + 0.655 - lower, 0.0), d = V(0.8, 0.12, 1).normalize(), c = refinedString(ins, base, d, V(-0.5, 1, 0), k);
    const S = c.at(0, -0.02, 0.13), frog = S.clone().add(c.X.clone().multiplyScalar(0.34)).add(c.Z.clone().multiplyScalar(0.01)), tip = S.clone().add(c.X.clone().multiplyScalar(-0.38));
    refinedBow(ins, frog, tip);
    return { L: { t: c.at(0.0, 0.52, -0.06).add(c.X.clone().multiplyScalar(0.02)), dir: c.Z.clone().multiplyScalar(0.8).add(c.d.clone().multiplyScalar(-0.3)).add(c.X.clone().multiplyScalar(-0.3)), palm: c.X.clone().multiplyScalar(-1), curl: 0.6, pole: V(0.2, -1, 0) },
             R: { t: frog.clone().add(c.Z.clone().multiplyScalar(0.06)).add(c.X.clone().multiplyScalar(0.05)), dir: c.Z.clone().multiplyScalar(-0.7).add(c.X.clone().multiplyScalar(-0.6)).add(c.d.clone().multiplyScalar(0.2)), palm: c.Z.clone().multiplyScalar(-1).add(c.d.clone().multiplyScalar(-0.3)), curl: 0.8, pole: V(-1, -0.6, -0.2) },
             legs: { spread: 0.06, footZ: 0.48 }, head: [0.3, 0.3, 0.45] };
  }
  // The other instruments keep their v1 geometry (built mirrored); the hands follow its hand points.
  const POSE = {
    _:          { L: { dir: V(-0.3, -0.4, 1), palm: V(-0.5, -0.8, 0), curl: 0.7 }, R: { dir: V(0.3, -0.4, 1), palm: V(0.5, -0.8, 0), curl: 0.7 }, legs: { spread: 0.06, footZ: 0.48 }, head: [0.2, 0, 0] },
    "fluit":    { L: { dir: V(-0.4, 0.5, 0.8), palm: V(-0.5, 0, -1), curl: 0.5 }, R: { dir: V(0.1, 0.6, 0.8), palm: V(0, 0, -1), curl: 0.5 }, head: [0.05, -0.2, -0.3] },
    "hobo":     { L: { dir: V(-0.8, 0, 0.6), palm: V(0, 0, -1), curl: 0.55 }, R: { dir: V(0.8, 0, 0.6), palm: V(0, 0, -1), curl: 0.55 }, head: [0.15, 0, 0] },
    "klarinet": { L: { dir: V(-0.8, 0, 0.6), palm: V(0, 0, -1), curl: 0.55 }, R: { dir: V(0.8, 0, 0.6), palm: V(0, 0, -1), curl: 0.55 }, head: [0.15, 0, 0] },
    "fagot":    { L: { dir: V(-0.8, 0.2, 0.4), palm: V(-0.4, 0, -1), curl: 0.55 }, R: { dir: V(0.8, 0.1, 0.4), palm: V(0, 0, -1), curl: 0.55 }, head: [0.1, 0, 0] },
    "hoorn":    { L: { dir: V(-0.6, 0.2, 0.8), palm: V(-1, 0, 0), curl: 0.6 }, R: { dir: V(-0.3, 0.3, -1), palm: V(1, 0, 0), curl: 0.2 }, head: [0.15, 0, 0] },
    "trompet":  { L: { dir: V(0, 0.4, 1), palm: V(-1, 0, 0), curl: 0.75 }, R: { dir: V(0.2, -0.5, 1), palm: V(0, -1, 0), curl: 0.4 }, head: [0.05, 0, 0] },
    "trombone": { L: { dir: V(0, 0.6, 0.8), palm: V(-1, 0, 0), curl: 0.8 }, R: { dir: V(0, 0.4, 1), palm: V(1, 0, 0), curl: 0.6 }, head: [0.05, 0, 0] },
    "tuba":     { L: { dir: V(-0.5, 0.2, 1), palm: V(-1, 0, 0), curl: 0.6 }, R: { dir: V(-0.3, -0.4, 1), palm: V(0, -1, 0), curl: 0.5 }, head: [0.1, 0, 0] },
    "pauken":   { L: { dir: V(-0.2, -0.3, 1), palm: V(0, -1, 0), curl: 0.9 }, R: { dir: V(0.2, -0.3, 1), palm: V(0, -1, 0), curl: 0.9 }, legs: { spread: 0.08, footZ: 0.4 }, head: [0.3, 0, 0] },
    "grote trom":{ L: { dir: V(-0.3, -0.2, 1), palm: V(0, -1, 0), curl: 0.6 }, R: { dir: V(0.2, -0.3, 1), palm: V(0, -1, 0), curl: 0.9 }, legs: { spread: 0.08, footZ: 0.4 } },
    "bekkens":  { L: { dir: V(-0.3, 0.2, 1), palm: V(-1, 0, 0), curl: 0.9 }, R: { dir: V(0.3, 0.2, 1), palm: V(1, 0, 0), curl: 0.9 }, head: [0.15, 0, 0] },
    "xylofoon": { L: { dir: V(-0.2, -0.3, 1), palm: V(0, -1, 0), curl: 0.9 }, R: { dir: V(0.2, -0.3, 1), palm: V(0, -1, 0), curl: 0.9 }, legs: { spread: 0.08, footZ: 0.4 }, head: [0.35, 0, 0] },
    "harp":     { L: { dir: V(-0.3, 0.3, 1), palm: V(-1, 0, 0), curl: 0.35 }, R: { dir: V(-0.3, 0.3, 1), palm: V(1, 0, 0), curl: 0.35 }, head: [0.1, 0, -0.2] },
    "piano":    { L: { dir: V(0, -0.35, 1), palm: V(0, -1, 0), curl: 0.45 }, R: { dir: V(0, -0.35, 1), palm: V(0, -1, 0), curl: 0.45 }, legs: { spread: 0.12, footZ: 0.55 }, head: [0.25, 0, 0] },
  };
  function poseFor(part, hands) {   // v1 hand points -> wrist targets in the unmirrored frame
    const P = POSE[part] || {}, D = POSE._, out = { legs: { ...D.legs, ...(P.legs || {}) }, head: P.head || D.head };
    [["L", 0], ["R", 1]].forEach(([s, i]) => { const sp = { ...D[s], ...(P[s] || {}) };
      out[s] = { ...sp, t: mirX(hands[i]).sub(sp.dir.clone().normalize().multiplyScalar(0.07)) }; });
    return out;
  }

  /* ---------- hierarchy ---------- */
  function group(name, parent, iso = true) { const g = new THREE.Group(); g.name = name; g.userData.iso = iso; if (parent) parent.add(g); return g; }
  const toThree = (bx, by) => [bx, -by];
  const inSector = (bx, by, T) => { const dx = bx - CONDUCTOR[0], dy = by - CONDUCTOR[1], r = Math.hypot(dx, dy), d = Math.atan2(dx, dy) * 180 / Math.PI;
    return r >= T.r[0] && r < T.r[1] && d >= T.deg[0] && d <= T.deg[1]; };
  const tierTop = (bx, by) => STAGE.floor + (inSector(bx, by, STAGE.tier2) ? STAGE.tier2.h : inSector(bx, by, STAGE.tier1) ? STAGE.tier1.h : 0);
  function sector(T) {   // annular sector around the conductor, in blueprint coordinates
    const sh = new THREE.Shape(), N = 48, [r0, r1] = T.r, [d0, d1] = T.deg.map(d => d * Math.PI / 180), P = (r, t) => [CONDUCTOR[0] + r * Math.sin(t), CONDUCTOR[1] + r * Math.cos(t)];
    for (let i = 0; i <= N; i++) { const p = P(r1, d0 + (d1 - d0) * i / N); i ? sh.lineTo(...p) : sh.moveTo(...p); }
    for (let i = N; i >= 0; i--) sh.lineTo(...P(r0, d0 + (d1 - d0) * i / N));
    sh.closePath(); return sh;
  }
  function halfRing(s0, s1) {
    const sh = new THREE.Shape(), N = 72, a = STAGE.a, b = STAGE.b;
    for (let i = 0; i <= N; i++) { const t = Math.PI * i / N; const p = [a * s1 * Math.cos(t), b * s1 * Math.sin(t)]; i ? sh.lineTo(...p) : sh.moveTo(...p); }
    if (s0 > 0) for (let i = N; i >= 0; i--) { const t = Math.PI * i / N; sh.lineTo(a * s0 * Math.cos(t), b * s0 * Math.sin(t)); }
    sh.closePath(); return sh;
  }
  function arcRing(s0, s1, t0, t1) {   // part of the stage ring between fractions t0..t1 of the half circle
    const sh = new THREE.Shape(), N = Math.max(4, Math.ceil(72 * (t1 - t0))), a = STAGE.a, b = STAGE.b;
    for (let i = 0; i <= N; i++) { const t = Math.PI * (t0 + (t1 - t0) * i / N); const p = [a * s1 * Math.cos(t), b * s1 * Math.sin(t)]; i ? sh.lineTo(...p) : sh.moveTo(...p); }
    for (let i = N; i >= 0; i--) { const t = Math.PI * (t0 + (t1 - t0) * i / N); sh.lineTo(a * s0 * Math.cos(t), b * s0 * Math.sin(t)); }
    sh.closePath(); return sh;
  }
  function slab(shape, depth, y) { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 }); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; }

  const root = group("Scene", scene, false);
  const RUN = group("RUN · vandaag", root);
  const CHANGE = group("CHANGE · morgen (later)", root); CHANGE.userData.empty = true;

  // Omgeving
  const omg = group("Omgeving", RUN);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x9aa3c2) }, mid: { value: new THREE.Color(0x98a0bf) }, low: { value: new THREE.Color(0x939bbb) } },   // cool lavender blue, a touch darker toward the hills
    vertexShader: "varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying float h; void main(){ vec3 c = mix(low, mid, smoothstep(-0.02, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.7, h)); gl_FragColor = vec4(c, 0.); }"
  });
  { const env = new THREE.Scene(); env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat));
    const gnd = new THREE.Mesh(new THREE.CircleGeometry(9.9, 32), new THREE.MeshBasicMaterial({ color: 0x6a4026 })); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -0.4; env.add(gnd);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshBasicMaterial({ color: 0xfff1de })); glow.position.set(0, 0.6, -9); env.add(glow);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.04).texture; pm.dispose(); }
  const luchtG = group("Lucht", omg); const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat); skyMesh.name = "Lucht"; skyMesh.renderOrder = -10; luchtG.add(skyMesh);   // the sky is drawn first, without depth: the land behind it still covers it
  const heuvels = group("Heuvels", omg);
  // Landscape: the stage sits low in a bowl of earth (art direction); hill ridges layer around it like on the site.
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const bump = (x, z, cx, cz, rx, rz, h) => h * Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));
  const RIDGES = [[-70, 40, 24, 18, 4], [72, 44, 26, 18, 4.5]];   // no ridges beside the field: the audience stays in the sun
  let nextH = null;
  function terrainH(x, z) {   // the bowl, with one flat terrace on its rim for the rehearsal (CHANGE)
    const h = terrainBase(x, z);
    if (nextH === null) nextH = terrainBase(NEXT.x, NEXT.z);
    const k = 1 - sstep(NEXT.r, NEXT.r + 6, Math.hypot(x - NEXT.x, z - NEXT.z));
    return h + (nextH - h) * k;
  }
  function terrainBase(x, z) {
    const r = Math.hypot(x / 31, (z + 3) / (z < -3 ? 25 : 34));
    let h = 11 * sstep(0.48, 1.3, r) + 1.5 * sstep(1.3, 2.6, r);                   // bowl walls, then a gentle rise beyond the rim
    h *= Math.min(1, Math.max(0.55, Math.hypot(x, z - 36) / 71));                 // seen from the opening camera the rim reads as one even line
    h *= 1 - sstep(4, 16, z) * (1 - sstep(30, 58, Math.abs(x)));                   // open toward the grain field and the audience
    for (const R of RIDGES) h += bump(x, z, ...R);
    h *= sstep(1.05, 1.6, Math.hypot(x / 16, z / (z > 0 ? 9.5 : 13.5)));        // flat ground around the pit and the board
    h += (Math.sin(x * 0.045 + z * 0.02) * Math.sin(z * 0.05 - x * 0.013)) * 1.6 * sstep(0.9, 1.6, r);   // slow undulation, far only
    h *= 1 - (1 - sstep(9, 14, Math.abs(x))) * sstep(31, 34, z) * (1 - sstep(46, 50, z));   // level ground under the audience
    return Math.max(0, h - 0.02);
  }
  const noise2 = (x, z) => Math.sin(x * 0.11 + Math.sin(z * 0.07) * 2) * Math.sin(z * 0.09 + Math.sin(x * 0.05) * 2);
  { const N = small ? 150 : 230, S = 420, g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    const E1 = new THREE.Color(AD.earth), E2 = new THREE.Color(0x4a1b0f), E3 = new THREE.Color(0x6b2c17), GR = new THREE.Color(AD.grain), SOIL = new THREE.Color(0x4a3220), DUSTY = new THREE.Color(0xa0644c);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), h = terrainH(x, z); p.setY(i, h);
      c.copy(E1).lerp(E2, 0.5 + 0.5 * noise2(x, z)).lerp(E3, Math.max(0, noise2(x * 0.4 + 30, z * 0.4)) * 0.6);
      c.lerp(GR, sstep(0.5, 1, Math.hypot(x, z + 20) / 210) * 0.55);              // toward the horizon the land turns to dry grass
      c.lerp(DUSTY, 0.45 * (1 - sstep(8, 12, Math.abs(x))) * sstep(33, 36, z) * (1 - sstep(44, 47, z)));   // lighter, dusty red under the audience so black legs read
      c.lerp(SOIL, sstep(6, 12, z) * (1 - sstep(48, 64, Math.abs(x))) * (1 - 0.85 * (1 - sstep(7, 11, Math.abs(x))) * sstep(32, 35, z) * (1 - sstep(44, 48, z))));   // ...but the warm red earth stays under the audience          // darker soil under the grain field
      c.convertSRGBToLinear(); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    // fine soil texture so close-ups are not plastic
    const cv = document.createElement("canvas"); cv.width = cv.height = 256; const x2 = cv.getContext("2d"), id = x2.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = 226 + Math.random() * 29; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    x2.putImageData(id, 0, 0); const soil = new THREE.CanvasTexture(cv); soil.wrapS = soil.wrapT = THREE.RepeatWrapping; soil.repeat.set(640, 640);
    const mat = material("earth", { map: soil });
    mat.onBeforeCompile = sh => {   // smooth velvet earth: soft tone patches, no furrows, rust and dark patches, all in world space
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\n varying vec3 vW;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n vW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n varying vec3 vW;\n" + NOISE_GLSL).replace("#include <map_fragment>", `#include <map_fragment>
        float wob = sin(vW.x * 0.045) * 1.6 + sin(vW.z * 0.06 + vW.x * 0.01) * 1.2 + vnoise(vW.xz * 0.08) * 1.5;
        float big = fbm(vW.xz * 0.025 + 3.0), mid = fbm(vW.xz * 0.12), clod = fbm(vW.xz * 10.0), grit = vnoise(vW.xz * 30.0);
        vec3 rust = vec3(0.16, 0.05, 0.02), deep = vec3(0.03, 0.009, 0.006), dust = vec3(0.16, 0.085, 0.06);
        float lum0 = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, lum0 * vec3(1.45, 0.82, 0.66), 0.6);   // less candy red, more maroon-brown
        diffuseColor.rgb = mix(diffuseColor.rgb, rust, smoothstep(0.5, 0.75, big) * 0.35);          // rusty, sun-baked patches
        diffuseColor.rgb = mix(diffuseColor.rgb, deep, smoothstep(0.52, 0.28, mid) * 0.3);          // damp, darker earth
        diffuseColor.rgb = mix(diffuseColor.rgb, dust, smoothstep(0.62, 0.9, clod) * 0.15);         // dry tops of clods
        float far = smoothstep(16.0, 46.0, length(vW.xz - vec2(0.0, -3.0))) * smoothstep(1.5, 9.0, vW.y);     // up the bowl and toward the rim
        float front = (1.0 - smoothstep(16.0, 22.0, abs(vW.x))) * smoothstep(7.5, 10.0, vW.z) * (1.0 - smoothstep(30.0, 34.0, vW.z));   // the ground in front of the stage
        diffuseColor.rgb *= mix(1.0, (0.97 + 0.06 * clod) * (0.985 + 0.03 * grit), 1.0 - 0.6 * far);    // no furrows, but clods and grit give the soil depth (softer in the haze)
        diffuseColor.rgb *= 0.28 * (1.0 - 0.14 * front);                                              // darker bowl; a little darker in front of the stage
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.075, 0.08), far * 0.4);
        float shade = max(smoothstep(-0.35, 0.35, (5.5 + 0.22 * vW.x) - vW.y), smoothstep(8.0, 13.0, vW.z)) * (1.0 - smoothstep(28.0, 32.0, vW.z));   // below a line that climbs to the right, and all of the ground in front of the stage
        diffuseColor.rgb *= 1.0 - 0.84 * shade;   // a long, sharp-edged shadow over the front of the bowl, like the site photo                 // evening haze: the rim melts toward the hills
      `).replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        { float e = 0.012; float c0 = fbm(vW.xz * 10.0), cx = fbm((vW.xz + vec2(e, 0.0)) * 10.0), cz = fbm((vW.xz + vec2(0.0, e)) * 10.0);
          float far = smoothstep(16.0, 46.0, length(vW.xz - vec2(0.0, -3.0))) * smoothstep(1.5, 9.0, vW.y);
          vec3 dW = vec3(-(cx - c0) / e, 0.0, -(cz - c0) / e) * 0.02 * (1.0 - 0.6 * far);           // fine, flat clods catch the low sun
          normal = normalize(normal + mat3(viewMatrix) * dW); }`).replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        { float front = (1.0 - smoothstep(16.0, 22.0, abs(vW.x))) * smoothstep(7.5, 10.0, vW.z) * (1.0 - smoothstep(30.0, 34.0, vW.z));
          roughnessFactor = mix(roughnessFactor, 0.55, front * 0.35 * smoothstep(0.4, 0.7, fbm(vW.xz * 6.0))); }   // soft sheen on the clod tops in front of the stage`);
    };
    const m = new THREE.Mesh(g, mat); m.name = "Aarde"; m.receiveShadow = true; m.castShadow = true; heuvels.add(m); }
  { // the land beyond the bowl: ONE continuous procedural terrain to the horizon (no layers or bands). A polar grid, dense near the rim and
    // coarser far out, displaced by a heightfield: 6-octave fBm simplex noise with domain warping, shaped for soft, rounded, eroded hills
    // (Palouse, wind-shaped sand hills), many small and medium swells; the ground rises slowly with distance so it reads above the rim.
    const T = Object.assign({}, LAND, window.__landTune || {}), rings = small ? T.ringsPhone : T.rings, segs = small ? T.segsPhone : T.segs;   // __landTune: only set by the tuning script
    const simplex = (() => {   // 2D simplex noise (Gustavson), seeded, range about -1..1
      const perm = new Uint8Array(512), G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
      { let a = T.seed; const p = [...Array(256).keys()]; for (let k = 255; k > 0; k--) { a = (a * 16807) % 2147483647; const r = a % (k + 1); [p[k], p[r]] = [p[r], p[k]]; } for (let k = 0; k < 512; k++) perm[k] = p[k & 255]; }
      const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
      return (x, y) => { const s0 = (x + y) * F2, i0 = Math.floor(x + s0), j0 = Math.floor(y + s0), t0 = (i0 + j0) * G2, x0 = x - i0 + t0, y0 = y - j0 + t0;
        const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1, x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2, ii = i0 & 255, jj = j0 & 255;
        const c = (gx, gy, dx, dy) => { let t = 0.5 - dx * dx - dy * dy; if (t < 0) return 0; t *= t; const g = G[gx & 7]; return t * t * (g[0] * dx + g[1] * dy); };
        return 70 * (c(perm[ii + perm[jj]], 0, x0, y0) + c(perm[ii + i1 + perm[jj + j1]], 0, x1, y1) + c(perm[ii + 1 + perm[jj + 1]], 0, x2, y2)); }; })();
    const fbm = (x, y, oct) => { let a = 1, f = 1, sum = 0, n = 0; for (let k = 0; k < oct; k++) { sum += a * simplex(x * f + k * 31.7, y * f - k * 17.3); n += a; a *= T.gain; f *= T.lacunarity; } return sum / n; };
    const hills = (x, z) => {   // warped fBm, softened: no sharp crests, rounded tops and smooth valleys
      const px = x / T.wavelength, pz = z / T.wavelength;
      const qx = fbm(px * 0.55 + 3.1, pz * 0.55 - 1.7, 4), qz = fbm(px * 0.55 - 8.3, pz * 0.55 + 4.4, 4);
      const n = fbm(px + T.warp * qx, pz + T.warp * qz, T.octaves) * 1.6;
      return n - 0.33 * n * n * n;   // rounds the tops off (an eroded, wind-worn profile)
    };
    const heightAt = (x, z) => { const d = Math.hypot(x, z), k = sstep(T.r0, T.rise, d);
      return T.base + T.slope * Math.max(0, Math.min(d, T.crest) - T.r0) * k - T.fall * Math.max(0, d - T.crest) + (T.ampNear + (T.ampFar - T.ampNear) * k) * hills(x, z); };
    const pos = new Float32Array(rings * (segs + 1) * 3), idx = [];
    for (let r = 0; r < rings; r++) { const rad = T.r0 * Math.pow(T.r1 / T.r0, r / (rings - 1));
      for (let a = 0; a <= segs; a++) { const ang = a / segs * Math.PI * 2, x = Math.cos(ang) * rad, z = Math.sin(ang) * rad; pos.set([x, heightAt(x, z), z], (r * (segs + 1) + a) * 3); } }
    for (let r = 0; r < rings - 1; r++) for (let a = 0; a < segs; a++) { const p0 = r * (segs + 1) + a, p1 = p0 + segs + 1; idx.push(p0, p0 + 1, p1, p0 + 1, p1 + 1, p1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();   // normals from the heightfield
    const fm = material("far", { fog: false, color: T.color, emissive: T.shade, emissiveIntensity: T.shadeAmount, roughness: 1, envMapIntensity: 0 });   // no sky reflection: seen at a grazing angle it turned the hilltops whiter than the sunlit slopes
    const f = v => (+v).toFixed(4);   // numbers into GLSL always as floats (an integer such as 0 would not compile)
    fm.onBeforeCompile = sh => {   // rose where the low sun reaches, slate blue in the shade, fine relief in the light, haze toward the horizon
      sh.uniforms.uHaze = { value: new THREE.Color(T.haze) }; sh.uniforms.uSun = { value: new THREE.Vector3(...SUN.pos).sub(new THREE.Vector3(...SUN.target)).normalize() };
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\n varying vec3 vW;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n vW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n uniform vec3 uHaze, uSun; varying vec3 vW;\n" + NOISE_GLSL).replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
          { vec2 q = vW.xz * ${f(T.reliefScale)}; float e = 0.04, c0 = fbm(q), cx = fbm(q + vec2(e, 0.0)), cz = fbm(q + vec2(0.0, e));   // micro-relief: small folds on the slopes
            normal = normalize(normal + mat3(viewMatrix) * vec3(-(cx - c0) / e, 0.0, -(cz - c0) / e) * ${f(T.relief)}); }`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          { vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz); float sunK = smoothstep(${f(T.sunFrom)}, ${f(T.sunTo)}, dot(nW, uSun));
            totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(${T.rose}), sunK * ${f(T.roseAmount)}); }`)
        .replace("#include <fog_fragment>", `#include <fog_fragment>
          { float d = distance(vW, cameraPosition); gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, smoothstep(${f(T.hazeFrom)}, ${f(T.hazeTo)}, d) * ${f(T.hazeMax)}); }`);
    };
    const m = new THREE.Mesh(g, fm); m.name = "Bergland"; heuvels.add(m);
  }
  const graan = group("Graan", omg);
  // Where the field turns green: soft patches and a few streaks, like the art direction foreground
  const greenAt = (x, z) => { const n = noise2(x * 1.9 + 11, z * 2.6) * 0.65 + noise2(x * 4.3 - 5, z * 5.1 + 2) * 0.35 + 0.25 * Math.sin(x * 0.21 + z * 0.9);
    return sstep(0.12, 0.55, n); };
  const G_OCHRE = [0xc2a57a, 0xb3946a, 0xcdb48c, 0xa3845e], G_SAGE = [0x8f9270, 0x7d8364, 0x9a9c7c, 0x6a7052];
  function grainTint(g, c) {   // ochre clumps; sage-green and a little darker where g is high; small random spread per clump
    const a = new THREE.Color(G_OCHRE[(Math.random() * 4) | 0]), b = new THREE.Color(G_SAGE[(Math.random() * 4) | 0]);
    c.copy(a).lerp(b, Math.min(1, g * (0.9 + Math.random() * 0.4))).convertSRGBToLinear(); return c.multiplyScalar((0.55 + Math.random() * 0.26) * (1 - g * 0.1)); }
  const grainTex = (() => { const cv = document.createElement("canvas"); cv.width = cv.height = 256; const x = cv.getContext("2d");
    x.fillStyle = "#b8955c"; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { const v = Math.random(); x.strokeStyle = v < 0.5 ? "rgba(130,96,52,.5)" : "rgba(226,200,146,.5)"; const px = Math.random() * 256, py = Math.random() * 256; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() - 0.5) * 2, py - 3 - Math.random() * 5); x.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 20); t.encoding = THREE.sRGBEncoding; return t; })();
  const grain = new THREE.Mesh(new THREE.PlaneGeometry(140, 60), material("grain", { map: grainTex, color: 0xc9b48e }));
  grain.name = "Graanveld";   // soil under the stalks is now part of the terrain colour
  // Graanhalmen: clumps of crossed quads with a drawn stalk texture, swaying in the wind; kept clear of the audience and the view line.
  const STALKS = (() => { const cv = document.createElement("canvas"); cv.width = 256; cv.height = 256; const x = cv.getContext("2d");
    for (let i = 0; i < 46; i++) { const bx = 8 + Math.random() * 240, h = 150 + Math.random() * 100, lean = (Math.random() - 0.5) * 30, top = 256 - h;
      x.strokeStyle = ["#b8ae9c", "#cfc6b4", "#a39a88"][i % 3]; x.lineWidth = 1.6; x.beginPath(); x.moveTo(bx, 256); x.quadraticCurveTo(bx, 256 - h * 0.5, bx + lean, top); x.stroke();
      x.fillStyle = ["#e2dccd", "#efe9da", "#cdc5b2"][i % 3]; x.save(); x.translate(bx + lean, top); x.rotate(lean / 120);
      for (let k = 0; k < 7; k++) { x.beginPath(); x.ellipse(k % 2 ? 2.6 : -2.6, 4 + k * 4.4, 2.6, 4.2, k % 2 ? 0.5 : -0.5, 0, 7); x.fill(); }
      x.strokeStyle = "rgba(235,228,212,.8)"; x.lineWidth = 0.8; x.beginPath(); x.moveTo(0, 0); x.lineTo(lean / 10, -16); x.stroke(); x.restore(); }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; })();
  const windU = { value: 0 };
  { const q = new THREE.PlaneGeometry(1.1, 1, 1, 1); q.translate(0, 0.5, 0); const q2 = q.clone(); q2.rotateY(Math.PI / 2);
    const clump = THREE.BufferGeometryUtils.mergeBufferGeometries([q, q2]);
    const spots = [], step = small ? 0.78 : 0.52;
    for (let z = 22; z < 62; z += step) for (let xx = -54; xx < 54; xx += step) {
      const px = xx + (Math.random() - 0.5) * step, pz = z + (Math.random() - 0.5) * step;
      if (Math.abs(px) < 7.5 && pz > 36.2 && pz < 43.5) continue;                 // audience
      if (Math.abs(px) < 1.4 && pz > 34) continue;                                 // centre aisle to the seats
      const strip = pz > 25.5 + 1.5 * noise2(px * 0.7, 9) && pz < 37.6 && Math.abs(px) < 14;                     // low green strip just in front of the first row
      if (strip && Math.abs(px) < 1.1) continue;                                   // open path to the seats
      if (!strip && pz < 37 && Math.abs(px) < 0.8 * (37 - pz) + 4) continue;       // otherwise open red earth in front of the stage
      if (Math.abs(px - BOARD.x) < 2 && Math.abs(pz + BOARD.y) < 2) continue;      // board
      if (terrainH(px, pz) > 1.2) continue;
      if (Math.hypot(px / (STAGE.rx + 1.5), pz / (STAGE.zf + 1.5)) < 1) continue;   // keep the pit clear
      if (Math.abs(px) > 40 + 9 * noise2(pz * 2.2, px) || pz > 56 + 5 * noise2(px * 2, 3)) continue;   // ragged field edge                                       // hidden inside the side hills
      spots.push([px, pz]); }
    const mat = material("stalk", { map: STALKS, color: 0xffffff, emissive: 0x2a1a10, emissiveIntensity: 0.12 });   // tint per clump (instance colour): ochre with sage-green patches   // muted, partly in shadow; only the tips catch the low light   // muted, slightly red grain as in the art direction
    mat.onBeforeCompile = (sh) => { sh.uniforms.wind = windU;
      sh.vertexShader = "uniform float wind;\n" + sh.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\n vec4 ip = instanceMatrix[3]; float sway = sin(wind * 1.3 + ip.x * 0.35 + ip.z * 0.22) * 0.07 + sin(wind * 2.7 + ip.x) * 0.02; transformed.x += sway * uv.y * uv.y; transformed.z += sway * 0.5 * uv.y * uv.y;"); };
    const im = new THREE.InstancedMesh(clump, mat, spots.length); im.name = "Graanhalmen"; im.receiveShadow = true;
    const o = new THREE.Object3D();
    const tc = new THREE.Color();
    spots.forEach(([px, pz], i) => { const low = pz > 20 && pz < 37.6 && Math.abs(px) < 14, g = low ? Math.max(0.8, greenAt(px, pz)) : greenAt(px, pz), hh = low ? 0.3 + Math.random() * 0.14 : (pz < 24 ? 0.5 : 0.62) + Math.random() * 0.25 - g * 0.12;   /* knee-high and greener in front of the audience */ o.position.set(px, terrainH(px, pz), pz); o.rotation.set(0, Math.random() * Math.PI, 0); o.scale.set(1 + Math.random() * 0.4, hh, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      grainTint(g, tc); if (low) tc.lerp(new THREE.Color(0x5f7240).convertSRGBToLinear().multiplyScalar(0.8), 0.55); im.setColorAt(i, tc); });   // the low strip is grassier
    graan.add(im);
    // Low grass and dark tufts between the stalks, mostly in the green patches (as in the art direction)
    const GRASS = (() => { const cv = document.createElement("canvas"); cv.width = 256; cv.height = 128; const x = cv.getContext("2d");
      for (let i = 0; i < 120; i++) { const bx = 4 + Math.random() * 248, h = 50 + Math.random() * 75, lean = (Math.random() - 0.5) * 40;
        x.strokeStyle = ["#8a8e6c", "#9fa080", "#70765a", "#b0a988"][i % 4]; x.lineWidth = 1.2 + Math.random() * 1.4;
        x.beginPath(); x.moveTo(bx, 128); x.quadraticCurveTo(bx + lean * 0.2, 128 - h * 0.6, bx + lean, 128 - h); x.stroke(); }
      const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; })();
    const gspots = [], gstep = small ? 0.9 : 0.6;
    for (const [px, pz] of spots) { const g = greenAt(px, pz); if (Math.random() < 0.18 + g * 0.7) gspots.push([px + (Math.random() - 0.5) * 0.5, pz + (Math.random() - 0.5) * 0.5, g]); }
    if (small) gspots.length = Math.floor(gspots.length * 0.6);
    const gq = new THREE.PlaneGeometry(1.2, 0.5, 1, 1); gq.translate(0, 0.25, 0); const gq2 = gq.clone(); gq2.rotateY(Math.PI / 2);
    const gmat = material("stalk", { map: GRASS, color: 0xffffff, emissive: 0x141a0c, emissiveIntensity: 0.15 }); gmat.onBeforeCompile = mat.onBeforeCompile;
    const gm = new THREE.InstancedMesh(THREE.BufferGeometryUtils.mergeBufferGeometries([gq, gq2]), gmat, gspots.length); gm.name = "Gras"; gm.receiveShadow = true;
    gspots.forEach(([px, pz, g], i) => { o.position.set(px, terrainH(px, pz), pz); o.rotation.set(0, Math.random() * Math.PI, 0); const k = 0.6 + Math.random() * 0.7; o.scale.set(k, k * (0.8 + g * 0.6), k); o.updateMatrix(); gm.setMatrixAt(i, o.matrix);
      tc.set(Math.random() < 0.15 ? 0x4a4632 : 0xa09c84).convertSRGBToLinear(); tc.multiplyScalar(0.6 + Math.random() * 0.3); gm.setColorAt(i, tc); });
    graan.add(gm); }
  group("Licht", omg).userData.note = "zon en hemellicht";

  // Podium
  const pod = group("Podium", RUN);
  // A minimal white plaster pit: one oval floor, two layers that follow the sections, a stepped back wall in two layers.
  const oval = (rx, rzF, rzB) => { const sh = new THREE.Shape(), N = 144;
    for (let i = 0; i <= N; i++) { const t = Math.PI * 2 * i / N, s = Math.sin(t); const p = [rx * Math.cos(t), s * (s > 0 ? rzB : rzF)]; i ? sh.lineTo(...p) : sh.moveTo(...p); }
    return sh; };
  const ovalAt = (k, dk = 0) => oval(STAGE.rx * k + dk, STAGE.zf * k + dk, STAGE.zb * k + dk);
  new Part("Rand").add(slab(ovalAt(1, 0.55), STAGE.band, 0), "band").build(pod, true);
  new Part("Vloer").add(slab(ovalAt(1), STAGE.floor, 0), "stage").build(pod, true);
  const grow = (T, d) => ({ r: [T.r[0] - d, T.r[1] + d], deg: [T.deg[0] - d * 9, T.deg[1] + d * 9] });   // a slightly larger sector for the shadow gap
  new Part("Trede 1 · houtblazers").add(slab(sector(STAGE.tier1), STAGE.tier1.h - 0.03, STAGE.floor + 0.03), "tier").add(slab(sector(grow(STAGE.tier1, -0.03)), 0.031, STAGE.floor), "reveal").build(pod, true);
  new Part("Trede 2 · koper en slagwerk").add(slab(sector(STAGE.tier2), STAGE.tier2.h - 0.03, STAGE.floor + 0.03), "tier").add(slab(sector(grow(STAGE.tier2, -0.03)), 0.031, STAGE.floor), "reveal").build(pod, true);
  { // back: one smooth curved band along the back of the floor; it rises gently to the sides and fades into the floor at its ends
    const W = STAGE.wall, wall = new Part("Achterwand");
    const band = (k0, k1, t0, low, high, key) => {
      const t1 = Math.PI - t0, N = 160, R = 2, C = R + 3, pos = [], uv = [], idx = [];
      const hAt = t => { const u = ((t - t0) / (t1 - t0)) * 2 - 1, end = sstep(1, 0.5, Math.abs(u)); return (low + (high - low) * u * u) * end; };   // the ends taper off gradually over the outer quarter
      const P = (k, t, y) => { const x = STAGE.rx * k * Math.cos(t), z = -STAGE.zb * k * Math.sin(t); pos.push(x, y, z); uv.push(t * STAGE.rx * k, y + (k - k0) * STAGE.zb); };
      for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N, h = Math.max(0.02, hAt(t)), r = Math.min(0.035, h * 0.5);
        P(k0, t, STAGE.floor);
        for (let j = 0; j <= R; j++) { const a = Math.PI * j / R; P((k0 + k1) / 2 - Math.cos(a) * (k1 - k0) / 2, t, STAGE.floor + h - r + Math.sin(a) * r); }
        P(k1, t, STAGE.floor); }
      for (let i = 0; i < N; i++) for (let j = 0; j < C - 1; j++) { const a = i * C + j, b = a + C; idx.push(a, a + 1, b, a + 1, b + 1, b); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); const flat = geo.toNonIndexed(); flat.computeVertexNormals(); wall.add(flat, key); };   // faceted: crisp edges between face and top
    const d = W.t / STAGE.zb;
    band(1 - d, 1.0, 0.04 * Math.PI, W.low * 1.25, W.high * 1.12, "wall");
    wall.build(pod, true); }
  const [cx0, cz0] = toThree(...CONDUCTOR);
  new Part("Dirigentenbok").add(new THREE.BoxGeometry(1, 0.25, 0.8), "tier", M(cx0, STAGE.floor + 0.125, cz0 + 0.4)).build(pod, true);

  // Orkest + Lessenaars
  const orkest = group("Orkest", RUN);
  const lessen = group("Lessenaars", RUN);
  const orkGroups = {}, lesGroups = {}, standSets = {}, counters = {};
  function nested(store, base, path) { let parent = base, key = ""; path.forEach(p => { key += "/" + p; if (!store[key]) store[key] = group(p, parent); parent = store[key]; }); return parent; }
  const BLOBTEX = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "#fff"); g.addColorStop(1, "#000"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  function contactBlob(size, op) {   // soft dark disc on the floor: grounds small objects the sun shadow alone does not
    const b = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: BLOBTEX, transparent: true, opacity: op, depthWrite: false }));
    b.rotation.x = -Math.PI / 2; b.position.y = 0.006; b.name = "Contactschaduw"; b.userData.noShadow = true; b.renderOrder = 1; return b; }
  function standObj(parent, name, owners, x, z, y, ry, opts = {}) {
    const h = opts.h ?? 1.1, p = new Part(name);
    if (!opts.noPole) { p.add(new THREE.CylinderGeometry(0.012, 0.014, h, 6), "frame", M(0, h / 2, 0));
      for (const a of [0, 2.1, 4.2]) p.add(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 4), "frame", M(Math.cos(a) * 0.1, 0.04, Math.sin(a) * 0.1, 0, -a, 1.35)); }
    p.add(new THREE.BoxGeometry(0.5, 0.36, 0.012), "frame", M(0, h, 0, -0.42));
    p.add(new THREE.BoxGeometry(0.5, 0.03, 0.05), "frame", M(0, h - 0.17, 0.04, -0.42));
    p.add(new THREE.PlaneGeometry(0.44, 0.3), "paper", M(0, h + 0.004, 0.01, -0.42), { map: SHEET });
    const g = p.build(parent, true); g.userData.owners = owners; g.userData.count = 1;
    if (!opts.noPole) g.add(contactBlob(0.55, 0.45));
    g.position.set(x, y, z); g.rotation.y = ry; return g;
  }

  let vi = 0; const MUS = [];
  const poseForV1 = p => [mirX(p.L.t), mirX(p.R.t)].map(q => q.clone());   // stand-in figure (mirrored) reaches for the same wrists
  SECTIONS.forEach(([path, part, rows]) => {
    const parent = nested(orkGroups, orkest, path);
    const standPath = path[0] === "Strijkers" ? path : [path[0]];
    const sk = standPath.join("/"); standSets[sk] = standSets[sk] || { path: standPath, members: [] };
    rows.forEach(([r, d0, d1, n]) => {
      for (let i = 0; i < n; i++) {
        const d = n === 1 ? d0 : d0 + (d1 - d0) * i / (n - 1), t = d * Math.PI / 180;
        const bx = CONDUCTOR[0] + r * Math.sin(t), by = CONDUCTOR[1] + r * Math.cos(t);
        const [x, z] = toThree(bx, by), y = tierTop(bx, by);
        counters[part] = (counters[part] || 0) + 1;
        const label = part.charAt(0).toUpperCase() + part.slice(1) + " " + counters[part];
        const m = group("Muzikant · " + label, parent); m.userData.part = part; m.userData.count = 1;
        const h = SEAT[part] || 0.46, v = variant(vi++);
        // v1 instruments were built for the wrong hand, so they (and the chair and stand-in figure) sit in a mirrored subgroup
        const mir = new THREE.Group(); mir.name = "Gespiegeld"; mir.scale.x = -1; m.add(mir);
        chairPart("Stoel", h, "plush", part === "piano").build(mir);
        const ins = new Part("Instrument"); let pose;
        if (RINSTR[part]) { pose = RINSTR[part](ins, h); ins.build(m); }
        else { const hands = INSTR[part](ins, h); pose = poseFor(part, hands); ins.build(mir); }
        const body = new Part("Lichaam"); seatedFigure(body, h, v, poseForV1(pose)); const stand = body.build(mir); stand.userData.standIn = true;
        m.position.set(x, y, z); m.rotation.y = Math.atan2(cx0 - x, cz0 - z);
        MUS.push({ m, part, h, v, vi: vi - 1, pose, standIn: stand });
        standSets[sk].members.push({ m, x, y, z, bx, by, part });
      }
    });
  });
  // Dirigent first in the stand list, then shared stands per four musicians
  const lesDir = group("Dirigent (partituur)", lessen);
  standObj(lesDir, "Lessenaar · Dirigent (partituur)", ["Dirigent"], cx0, cz0 - 0.35, STAGE.floor + 0.25, 0, { h: 1.0 });
  Object.values(standSets).forEach(({ path, members }) => {
    const lparent = nested(lesGroups, lessen, path);
    for (let k = 0; k * STAND_SHARE < members.length; k++) {
      const chunk = members.slice(k * STAND_SHARE, (k + 1) * STAND_SHARE);
      const name = "Lessenaar · " + path[path.length - 1] + " " + (k + 1), owners = chunk.map(c => c.m.name);
      if (chunk[0].part === "piano") {   // music desk on the piano itself
        const { x, y, z, m } = chunk[0], ry = m.rotation.y;
        standObj(lparent, name, owners, x + Math.sin(ry) * 0.42, z + Math.cos(ry) * 0.42, y + 0.95, ry + Math.PI, { h: 0.2, noPole: true });
        continue;
      }
      const cbx = chunk.reduce((a, c) => a + c.bx, 0) / chunk.length, cby = chunk.reduce((a, c) => a + c.by, 0) / chunk.length;
      const dx = CONDUCTOR[0] - cbx, dy = CONDUCTOR[1] - cby, L = Math.hypot(dx, dy) || 1;
      const sbx = cbx + dx / L * 1.0, sby = cby + dy / L * 1.0, [sx, sz] = toThree(sbx, sby);
      standObj(lparent, name, owners, sx, sz, tierTop(sbx, sby), Math.atan2(cx0 - sx, cz0 - sz) + Math.PI);
    }
  });

  // Dirigent: standing, long orange-red coat, arms raised
  const dir = group("Dirigent", RUN); dir.userData.count = 1;
  const dv = { skin: 0xa8714f, hair: 0x1A0E0A, style: 0 };
  const dBody = new Part("Lichaam");
  for (const s of [-1, 1]) dBody.add(new THREE.CylinderGeometry(0.07, 0.06, 0.85, 10), "suit", M(s * 0.09, 0.43, 0)), dBody.add(new THREE.BoxGeometry(0.1, 0.07, 0.26), "frame", M(s * 0.09, 0.035, 0.05));
  dBody.add(lathe([[0.0, 0], [0.3, 0], [0.26, 0.3], [0.2, 0.7], [0.18, 0.95], [0.21, 1.25], [0.2, 1.33], [0.1, 1.4], [0.05, 1.42]], 22), "red", M(0, 0.12, 0, 0, 0, 0, 1, 1, 0.78));
  dBody.add(new THREE.TorusGeometry(0.05, 0.014, 6, 14), "collar", M(0, 1.53, 0, Math.PI / 2));
  headAndHair(dBody, 1.75, dv);
  dBody.build(dir);
  const arms = new THREE.Group(); arms.name = "Armen"; dir.add(arms);
  const armParts = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.2, 1.45, 0); arms.add(pivot); armParts.push(pivot);
    const ap = new Part(s < 0 ? "Arm links" : "Arm rechts");
    seg(ap, V(0, 0, 0), V(s * 0.22, 0.12, 0.18), 0.055, "red"); seg(ap, V(s * 0.22, 0.12, 0.18), V(s * 0.32, 0.32, 0.3), 0.045, "red");
    ap.add(new THREE.SphereGeometry(0.04, 8, 6), "skin", M(s * 0.32, 0.32, 0.3), { color: dv.skin });
    if (s > 0) seg(ap, V(0.32, 0.32, 0.3), V(0.36, 0.62, 0.42), 0.005, "ivory", false);
    ap.build(pivot);
  }
  dir.position.set(cx0, STAGE.floor + 0.25, cz0 + 0.4); dir.rotation.y = Math.PI;

  // Bord: a plaster-white card with bold condensed capitals in a slim black metal frame on two legs
  MAT.iron = { color: 0x16120f, roughness: 0.45, metalness: 0.6 };
  const BW = 1.1, BH = 1.5, BY = 0.45;   // card size and the height of its lower edge above the floor (m)
  const CARD = "#f2ede5", INK = "#1c1512";   // the colour of the stage plaster
  function makeBoard(g, cfg) {
    const CW = 768, CH = Math.round(CW * BH / BW), cv = document.createElement("canvas"); cv.width = CW; cv.height = CH;
    const tx = new THREE.CanvasTexture(cv); tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 8;
    function draw() {
      const x = cv.getContext("2d"), font = n => "700 " + n + "px 'Barlow Condensed', 'DIN Condensed', 'Arial Narrow', sans-serif";
      const fit = (lines, n, w) => { do { x.font = font(n); } while (Math.max(...lines.map(l => x.measureText(l).width)) > w && --n > 20); return n; };
      x.fillStyle = CARD; x.fillRect(0, 0, CW, CH);
      x.fillStyle = INK; x.textAlign = "center"; x.textBaseline = "alphabetic";
      const title = cfg.title.toUpperCase(), lines = cfg.lines.map(l => l.toUpperCase()), foot = cfg.foot.toUpperCase();
      x.font = font(fit([title], 44, CW - 160)); x.fillText(title, CW / 2, CH * 0.16);   // small title, as on the old board
      const big = fit(lines, 150, CW - 140); x.font = font(big);
      lines.forEach((l, i) => x.fillText(l, CW / 2, CH * 0.42 + i * big * 1.0));   // the big lines
      x.font = font(fit([foot], 36, CW - 160)); x.fillText(foot, CW / 2, CH * 0.86);   // small foot line
      tx.needsUpdate = true;
    }
    draw(); document.fonts && document.fonts.load("700 96px 'Barlow Condensed'").then(draw, () => {});
    const plain = document.createElement("canvas"); plain.width = plain.height = 4; plain.getContext("2d").fillStyle = CARD; plain.getContext("2d").fillRect(0, 0, 4, 4);
    const back = new THREE.CanvasTexture(plain); back.encoding = THREE.sRGBEncoding;
    const bp = new Part("Paneel"), cy = BY + BH / 2, fr = 0.03;
    bp.add(new THREE.PlaneGeometry(BW, BH), "board", M(0, cy, 0.006), { map: tx, emissiveMap: tx, color: 0x8a8a8a, emissiveIntensity: 0.18, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });   // drawn in front of the card, also from the far opening camera
    bp.add(new THREE.BoxGeometry(BW, BH, 0.01), "board", M(0, cy, 0), { map: back, emissiveMap: back, color: 0x8a8a8a, emissiveIntensity: 0.18, roughness: 0.95 });   // the card itself: plain on the back and edges
    bp.build(g);
    const iron = new Part("Lijst en poten");
    for (const [w, h, px, py] of [[BW + 2 * fr, fr, 0, BH / 2 + fr / 2], [BW + 2 * fr, fr, 0, -BH / 2 - fr / 2]])
      iron.add(new THREE.BoxGeometry(w, h, 0.03), "iron", M(px, cy + py, 0));                                               // top and bottom of the frame
    for (const s2 of [-1, 1]) {
      iron.add(new THREE.BoxGeometry(fr, cy + BH / 2 + fr, 0.03), "iron", M(s2 * (BW / 2 + fr / 2), (cy + BH / 2 + fr) / 2, 0));   // the sides run down to the floor as legs
      iron.add(new THREE.BoxGeometry(0.035, 0.02, 0.4), "iron", M(s2 * (BW / 2 + fr / 2), 0.01, 0)); }                       // a flat foot under each leg
    iron.build(g);
    return g;
  }
  const bord = makeBoard(group("Bord", RUN), BOARD); bord.userData.count = 1;
  const [bxx, bzz] = toThree(BOARD.x, BOARD.y); bord.position.set(bxx, terrainH(bxx, bzz), bzz); bord.rotation.y = BOARD.rotY;   // on the ground beside the stage

  // CHANGE · morgen: next season's board and a small mixed team rehearsing the next piece, on the terrace at the rim
  const CHG = group("CHANGE · morgen", root);
  const bord2 = makeBoard(group("Bord · volgend seizoen", CHG), NEXT.board); bord2.userData.count = 1;
  bord2.position.set(NEXT.board.at[0], terrainH(...NEXT.board.at), NEXT.board.at[1]); bord2.rotation.y = NEXT.board.rotY;
  const dir2 = group("Dirigent · volgend seizoen", CHG); dir2.userData.count = 1;   // the conductor stands beside the board (placed by the loader)
  { const ry = NEXT.board.rotY, [bx, bz] = NEXT.board.at, sx = Math.cos(ry), sz = -Math.sin(ry), fx = Math.sin(ry), fz = Math.cos(ry);
    const x = bx + sx * 1.15 + fx * 0.35, z = bz + sz * 1.15 + fz * 0.35; dir2.position.set(x, terrainH(x, z), z); dir2.rotation.y = ry - 0.4; }
  const rep = group("Repetitie", CHG);
  { const [rx, rz] = NEXT.rehearsal, gy = terrainH(rx, rz), n = NEXT.players.length;
    NEXT.players.forEach((part, i) => {
      const a = Math.PI * (0.15 + 1.7 * i / (n - 1)) + 0.9, R = NEXT.ring * (part === "piano" ? 1.35 : 1);   // a loose circle, open toward the stage
      const x = rx + Math.cos(a) * R, z = rz + Math.sin(a) * R;
      const m = group("Repetitie · " + part, rep); m.userData.part = part; m.userData.count = 1;
      const h = SEAT[part] || 0.46, v = variant(vi++);
      const mir = new THREE.Group(); mir.name = "Gespiegeld"; mir.scale.x = -1; m.add(mir);
      chairPart("Stoel", h, "plush", part === "piano").build(mir);
      const ins = new Part("Instrument"); let pose;
      if (RINSTR[part]) { pose = RINSTR[part](ins, h); ins.build(m); }
      else { const hands = INSTR[part](ins, h); pose = poseFor(part, hands); ins.build(mir); }
      const body = new Part("Lichaam"); seatedFigure(body, h, v, poseForV1(pose)); const stand = body.build(mir); stand.userData.standIn = true;
      m.position.set(x, gy, z); m.rotation.y = Math.atan2(rx - x, rz - z);
      MUS.push({ m, part, h, v, vi: vi - 1, pose, standIn: stand, outfit: "repetitie" });
      if (part !== "piano") { const ry = m.rotation.y, d = 0.95;   // each player has their own stand in rehearsal
        standObj(m, "Lessenaar", [m.name], 0, d, 0, Math.PI, {}); }
      else standObj(m, "Lessenaar", [m.name], 0, 0.42, 0.95, Math.PI, { h: 0.2, noPole: true });
    }); }

  // Publiek: four rows on the field, seen from behind. Chairs are merged per row; the people are placed by the loader (Rocketbox, like the orchestra).
  const pub = group("Publiek", RUN); const AUD = [];
  for (let r = 0; r < AUDIENCE.rows; r++) {
    const row = group("Rij " + (r + 1), pub); row.userData.count = AUDIENCE.perRow;
    const seats = new Part("Stoelen"), people = new Part("Mensen");
    for (let i = 0; i < AUDIENCE.perRow; i++) {
      const x = (i - (AUDIENCE.perRow - 1) / 2) * AUDIENCE.seatGap, z = AUDIENCE.firstZ + r * AUDIENCE.rowGap;
      const T = M(x, 0, z, 0, Math.PI, 0);
      const c = chairPart("s", 0.46, "seatAud", false, "frameAud"); for (const [k, list] of c.pieces) list.forEach(g => seats.add(g, c.over.get(k)[0], T, c.over.get(k)[1]));
      const v = variant(r * 7 + i * 3 + 2), b = new Part("p");
      const hands = [V(-0.14, 0.62, 0.3), V(0.14, 0.62, 0.3)];
      seatedFigure(b, 0.46, v, hands, "suit", { color: v.clothes });
      for (const [k, list] of b.pieces) list.forEach(g => people.add(g, b.over.get(k)[0], T, b.over.get(k)[1]));
      const m = new THREE.Group(); m.name = "Toeschouwer " + (r + 1) + "." + (i + 1); m.userData.iso = false; m.position.set(x, 0, z); m.rotation.y = Math.PI; row.add(m);
      AUD.push({ m, row: r, seat: i, h: 0.46, vi: 100 + r * AUDIENCE.perRow + i });
    }
    seats.build(row); const st = people.build(row); st.userData.standIn = true; AUD.standIns = (AUD.standIns || []).concat(st);
  }
  group("Verhaal-hulp", RUN).userData.empty = true;

