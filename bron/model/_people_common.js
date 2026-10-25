
  /* ---------- people shared by the site, the model page and the bake: Rocketbox materials, registration, the live conductor ---------- */
  /* ---------- loading: Microsoft Rocketbox avatars (MIT), suits recoloured to concert black ---------- */
  const b64buf = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0)).buffer;
  const texLoader = new THREE.TextureLoader(), texCache = {};
  const tex = (k, srgb = true) => { if (!TEXTURES[k]) return null; if (!texCache[k]) { const t = texLoader.load(TEXTURES[k]); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; texCache[k] = t; } return texCache[k]; };
  const RBF = { thumb: 0, index: 1, middle: 2, ring: 3, pinky: 4 };
  const RB_SPINE = { Hips: "Bip01_Pelvis", Spine: "Bip01_Spine", Spine1: "Bip01_Spine1", Spine2: "Bip01_Spine2", Neck: "Bip01_Neck", Head: "Bip01_Head" };
  const RB_LIMB = { UpLeg: "Thigh", Leg: "Calf", Foot: "Foot", Toe: "Toe0", Arm: "UpperArm", ForeArm: "Forearm", Hand: "Hand" };
  const RIG_RB = {
    bone: (m, n) => m.getObjectByName(RB_SPINE[n] || n),
    limb: (m, s, n) => m.getObjectByName("Bip01_" + (s === "Left" ? "L" : "R") + "_" + RB_LIMB[n]),
    finger: (m, s, fin, j) => j > 3 ? null : m.getObjectByName("Bip01_" + (s === "Left" ? "L" : "R") + "_Finger" + RBF[fin] + (j === 1 ? "" : String(j - 1))),
  };
  function ue2rb(n) {   // Unreal-style names used by the conductor code -> Rocketbox biped names
    const S = /_l$/.test(n) ? "L" : "R", f = n.match(/^([a-z]+)_(\d\d)_(l|r)$/);
    if (f) { const j = +f[2]; return "Bip01_" + S + "_Finger" + RBF[f[1]] + (j === 1 ? "" : String(j - 1)); }
    const l = n.match(/^([a-z]+)_(l|r)$/), T = { upperarm: "UpperArm", lowerarm: "Forearm", hand: "Hand", thigh: "Thigh", calf: "Calf", foot: "Foot" };
    if (l && T[l[1]]) return "Bip01_" + S + "_" + T[l[1]];
    return { pelvis: "Bip01_Pelvis", spine_01: "Bip01_Spine", spine_02: "Bip01_Spine1", spine_03: "Bip01_Spine2", neck_01: "Bip01_Neck", Head: "Bip01_Head" }[n] || n;
  }
  function rbMaterial(name, variant) {
    const kind = /opacity/.test(name) ? "opacity" : /head/.test(name) ? "head" : "body";
    const m = new THREE.MeshStandardMaterial({ name, roughness: kind === "body" ? 0.82 : 0.62, metalness: 0 });
    m.map = tex(kind === "body" && variant ? name + "_" + variant : name) || tex(name);
    if (kind === "opacity") { m.alphaTest = 0.45; m.side = THREE.DoubleSide; m.roughness = 0.7; }
    if (kind === "body") { m.sheen = 0.3; }
    m.envMapIntensity = 0.25; return m;
  }

  function rbTemplate(key, variant) {
    const o = new THREE.FBXLoader().parse(b64buf(ASSETS[key]), ""); o.scale.setScalar(0.01); o.name = key;
    const lamps = []; o.traverse(n => { if (n.isLight) lamps.push(n); }); lamps.forEach(n => n.parent.remove(n));   // FBX files carry their own ambient light, which flattened the whole scene
    o.traverse(c => { if (!c.isSkinnedMesh) return; c.material = [].concat(c.material).map(m => rbMaterial(m.name, variant)); c.frustumCulled = false; });
    scene.add(o); refresh(o);
    const box = new THREE.Box3().setFromObject(o), foot = o.getObjectByName("Bip01_L_Foot");
    o.position.y -= box.min.y; refresh(o);
    const ankle = wpos(foot).y; o.removeFromParent();
    return { tpl: o, ankle, R: RIG_RB };
  }
  const SUIT = 0x111113, PANTS = SUIT;
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

  function register(root) {   // new meshes join the fade / click machinery of the scene
    root.traverse(o => { if (!o.isMesh) return; o.castShadow = !o.userData.noShadow;   // people cast shadows on phones too
      o.receiveShadow = true; o.material.transparent = true;
      let inside = !selected; for (let n = o; n && !inside; n = n.parent) if (n === selected) inside = true;
      o.userData.goal = inside ? 1 : GHOST; o.material.opacity = o.userData.goal; o.material.depthWrite = o.userData.goal > 0.5; meshes.push(o); });
  }
  function unregister(root) { const gone = new Set(); root.traverse(o => gone.add(o)); for (let i = meshes.length - 1; i >= 0; i--) if (gone.has(meshes[i])) meshes.splice(i, 1); root.removeFromParent(); }

  function tintBody(mat, color) {   // recolour the concert-black cloth of a body texture (dark, unsaturated texels); skin and shirt stay
    mat.userData.tint = new THREE.Color(color).convertSRGBToLinear();
    mat.onBeforeCompile = sh => { sh.uniforms.tint = { value: mat.userData.tint };
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n uniform vec3 tint;").replace("#include <map_fragment>", `#include <map_fragment>
        { vec3 c = diffuseColor.rgb; float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = (mx - mn) / max(mx, 1e-4);
          float k = (1.0 - smoothstep(0.03, 0.06, mx)) * (1.0 - smoothstep(0.3, 0.5, sat));
          diffuseColor.rgb = mix(c, tint * clamp(mx / 0.009, 0.45, 1.5), k); }`); };
    mat.customProgramCacheKey = () => "tint";
  }
  const BLOB_GEO = new THREE.PlaneGeometry(1, 1), BLOB_TEX = (() => { const cv = document.createElement("canvas"); cv.width = cv.height = 64; const x = cv.getContext("2d");
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgb(150,150,150)"); g.addColorStop(0.55, "rgb(80,80,80)"); g.addColorStop(1, "rgb(0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv); })();

  /* ---------- the conductor: a live (skinned) model in the red coat, arms moving with the music ---------- */
  let conductor = null;
  function conductorBody(T, parent) {   // the conductor figure in the red coat, one skinned mesh per material
    const body = THREE.SkeletonUtils.clone(T.conductor.tpl); body.name = "Persoon"; parent.add(body);
    const multi = []; body.traverse(o => { if (o.isSkinnedMesh) multi.push(o); });
    multi.forEach(o => {   // one skinned mesh per material, all on the same skeleton (so each can fade on its own)
      const geo = o.geometry, mats = [].concat(o.material), byMat = new Map();
      geo.groups.forEach(gr => { const l = byMat.get(gr.materialIndex) || []; for (let i = gr.start; i < gr.start + gr.count; i++) l.push(geo.index ? geo.index.getX(i) : i); byMat.set(gr.materialIndex, l); });
      for (const [mi, list] of byMat) { const g = new THREE.BufferGeometry(); for (const k of Object.keys(geo.attributes)) g.setAttribute(k, geo.attributes[k]);
        g.setIndex(new THREE.Uint32BufferAttribute(list, 1));
        const sm = new THREE.SkinnedMesh(g, mats[mi].clone()); sm.name = "Dirigent · " + mi; sm.frustumCulled = false;
        sm.position.copy(o.position); sm.quaternion.copy(o.quaternion); sm.scale.copy(o.scale); o.parent.add(sm); sm.bind(o.skeleton, o.bindMatrix); }
      o.removeFromParent(); });
    const b = n => body.getObjectByName(ue2rb(n));
    { body.updateWorldMatrix(true, true); const pel = body.getObjectByName("Bip01_Pelvis"), pp = wpos(pel);   // long red coat to the knee (AD)
      const g = new THREE.CylinderGeometry(0.2, 0.29, 0.66, 28, 1, true); g.scale(1, 1, 0.78);
      const coat = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: new THREE.Color(0xB02832).convertSRGBToLinear(), roughness: 0.9, side: THREE.DoubleSide, envMapIntensity: 0.2 })); coat.name = "Jas";
      coat.position.set(pp.x, pp.y + 0.1 - 0.33, pp.z); coat.castShadow = true; scene.add(coat); coat.updateMatrixWorld(); pel.attach(coat); }
    const rest = []; body.traverse(o => { if (o.isBone) rest.push([o, o.quaternion.clone()]); });
    return { body, b, rest };
  }
  function placeConductor(T) {
    const { body, b, rest } = conductorBody(T, dir);
    const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.005, 0.38, 6), material("ivory")); baton.name = "Dirigeerstok";
    conductor = { body, b, baton, rest, attached: false };
    poseConductor(0);
    return body;
  }
  function poseConductor(t) {
    const beat = Math.sin(t * 2.2), sway = Math.sin(t * 1.1);
    poseArms(conductor, dir, { l: V(0.32, 1.32 + Math.sin(t * 2.2 + 1) * 0.05, 0.36), r: V(-0.34 + sway * 0.06, 1.36 + beat * 0.1, 0.4) }, beat, { l: 0.25, r: 0.75 }, V(0, 1, 0.1));
    poseBaton();
  }
  function poseArms(cd, frame, hands, beat, curls, look) {   // spine upright, arms by two-bone IK to the given hand points (frame-local)
    const { body, b } = cd, G = v => v.clone().transformDirection(frame.matrixWorld), W = p => frame.localToWorld(p.clone());
    cd.rest.forEach(([o, q]) => o.quaternion.copy(q));   // start every frame from the rest pose
    body.updateWorldMatrix(true, true);
    aim(b("spine_01"), b("spine_02"), G(V(0, 1, 0.03))); aim(b("spine_02"), b("spine_03"), G(V(0, 1, 0.05))); aim(b("spine_03"), b("neck_01"), G(V(0, 1, 0.06)));
    aim(b("neck_01"), b("Head"), G(look));
    for (const [s, x] of [["l", 1], ["r", -1]]) {
      const arm = b("upperarm_" + s), fore = b("lowerarm_" + s), hnd = b("hand_" + s);
      const L1 = wpos(arm).distanceTo(wpos(fore)), L2 = wpos(fore).distanceTo(wpos(hnd)), wr = W(hands[s]);
      const el = twoBone(wpos(arm), wr, L1, L2, G(V(x * 1, -0.8, -0.3)));
      aim(arm, fore, el.clone().sub(wpos(arm))); aim(fore, hnd, wr.clone().sub(wpos(fore)));
      aim(hnd, b("middle_01_" + s), G(V(-x * 0.2, 0.25 + (s === "r" ? beat * 0.2 : 0), 1)));
      const curl = curls[s];
      for (const fin of ["index", "middle", "ring", "pinky"]) for (const j of [1, 2]) { const bone = b(fin + "_0" + j + "_" + s); turn(bone, G(V(1, 0, 0)), curl * 0.6); }
    }
  }
  function poseBaton() {
    const { b, baton } = conductor;
    if (!conductor.attached) {   // the baton sits in the right fist and follows it
      const hr = b("hand_r"), tip = wpos(b("middle_01_r")), base = wpos(hr), d = tip.clone().sub(base).normalize();
      const p0 = tip.clone().add(d.clone().multiplyScalar(0.02)), p1 = p0.clone().add(d.clone().multiplyScalar(0.38));
      baton.applyMatrix4(along(p0, p1)); scene.add(baton); baton.updateMatrixWorld(); hr.attach(baton); conductor.attached = true;
    }
  }
  function tickPeople(t) { if (conductor && !reduceMotion) poseConductor(t); }
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
