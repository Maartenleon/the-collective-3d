
  /* ---------- posing a seated musician. Directions are given in the musician's own frame (m), facing +z. ---------- */
  function poseSeated(model, m, h, P, rig) {
    const R = rig.R || RIG_Q, b = n => R.bone(model, n), sb = (s, n) => R.limb(model, s, n);
    const G = v => v.clone().transformDirection(m.matrixWorld), W = p => m.localToWorld(p.clone());
    model.updateWorldMatrix(true, true);
    const hipT = W(V(0, h + 0.1, 0.02));                                         // seat the pelvis on the chair
    model.position.add(model.parent.worldToLocal(hipT.clone()).sub(model.parent.worldToLocal(wpos(b("Hips")))));
    model.updateWorldMatrix(true, true);
    const lean = P.lean ?? 0.06;
    aim(b("Spine"), b("Spine1"), G(V(0, 1, lean))); aim(b("Spine1"), b("Spine2"), G(V(0, 1, lean + 0.04))); aim(b("Spine2"), b("Neck"), G(V(0, 1, lean + 0.06)));
    aim(b("Neck"), b("Head"), G(V(0, 1, 0.15)));
    const [down, tilt, yaw] = P.head || [0.2, 0, 0];
    turn(b("Head"), G(V(0, 1, 0)), yaw); turn(b("Head"), G(V(0, 0, 1)), -tilt); turn(b("Head"), G(V(1, 0, 0)), down);
    const legs = P.legs || { spread: 0.06, footZ: 0.48 };
    for (const [s, x] of [["Left", 1], ["Right", -1]]) {
      const th = sb(s, "UpLeg"), ca = sb(s, "Leg"), ft = sb(s, "Foot");
      const L1 = wpos(th).distanceTo(wpos(ca)), L2 = wpos(ca).distanceTo(wpos(ft));
      const ankle = W(V(x * (0.11 + legs.spread), rig.ankle, legs.footZ));
      const knee = twoBone(wpos(th), ankle, L1, L2, G(V(x * legs.spread * 1.5, 1, 1)));
      aim(th, ca, knee.clone().sub(wpos(th))); aim(ca, ft, ankle.clone().sub(wpos(ca)));
      if (sb(s, "Toe")) aim(ft, sb(s, "Toe"), G(V(x * 0.08, -0.3, 1)));
    }
    for (const [s, x] of [["Left", 1], ["Right", -1]]) {
      const arm = sb(s, "Arm"), fore = sb(s, "ForeArm"), hnd = sb(s, "Hand"), sp = P[s === "Left" ? "L" : "R"];
      const L1 = wpos(arm).distanceTo(wpos(fore)), L2 = wpos(fore).distanceTo(wpos(hnd));
      const wristW = W(sp.t);
      const elbow = twoBone(wpos(arm), wristW, L1, L2, G(sp.pole || V(x * 0.7, -1, -0.4)));
      aim(arm, fore, elbow.clone().sub(wpos(arm))); aim(fore, hnd, wristW.clone().sub(wpos(fore)));
      const f = G(sp.dir), n = G(sp.palm).projectOnPlane(f).normalize();
      const fb = (fin, j) => R.finger(model, s, fin, j);
      aim(hnd, fb("middle", 1), f);
      twist(hnd, f, wpos(fb("pinky", 1)).sub(wpos(fb("index", 1))), new THREE.Vector3().crossVectors(f, n).multiplyScalar(-1));
      const axis = new THREE.Vector3().crossVectors(f, n).normalize();
      for (const fin of ["index", "middle", "ring", "pinky"]) {
        let ang = 0;
        for (const j of [1, 2, 3]) { ang += [0.45, 0.85, 0.75][j - 1] * sp.curl + 0.15; const nx = fb(fin, j + 1); if (nx) aim(fb(fin, j), nx, f.clone().applyAxisAngle(axis, ang)); }
      }
      const thumbDir = f.clone().multiplyScalar(0.6).add(n.clone().multiplyScalar(0.5)).add(axis.clone().multiplyScalar(-0.3 * x));
      aim(fb("thumb", 1), fb("thumb", 2), thumbDir); aim(fb("thumb", 2), fb("thumb", 3), thumbDir.clone().add(n.clone().multiplyScalar(0.4)));
    }
  }

  /* ---------- hair: baked once per body type and style, in the frame of the Head bone ---------- */
  function bakeHair(tpl, hairScene) {
    scene.add(hairScene); hairScene.position.copy(tpl.position);
    refresh(tpl); refresh(hairScene);
    const inv = tpl.getObjectByName("Head").matrixWorld.clone().invert(), p = V(0, 0, 0), out = [];
    hairScene.traverse(o => { if (!o.isSkinnedMesh) return;
      const g = o.geometry.clone(), pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) { skinned(o, i, p); p.applyMatrix4(inv); pos.setXYZ(i, p.x, p.y, p.z); }
      ["skinIndex", "skinWeight"].forEach(k => g.deleteAttribute(k)); g.computeVertexNormals(); g.computeBoundingSphere();
      out.push({ g, mat: o.material }); });
    hairScene.removeFromParent(); return out;
  }

  /* ---------- baking a posed body into plain meshes (positions and normals skinned once, on the CPU) ---------- */
  function bakeSkinned(o, inv) {
    const g = o.geometry, pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bm = o.skeleton.boneMatrices, n = pos.count;
    const A = inv.clone().multiply(o.matrixWorld).multiply(o.bindMatrixInverse).elements, C = o.bindMatrix.elements;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), b = new Float32Array(16);
    for (let i = 0; i < n; i++) {
      b.fill(0);
      for (let k = 0; k < 4; k++) { const w = GET[k].call(sw, i); if (!w) continue; const j = GET[k].call(si, i) * 16; for (let q = 0; q < 16; q++) b[q] += w * bm[j + q]; }
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const cx = C[0] * x + C[4] * y + C[8] * z + C[12], cy = C[1] * x + C[5] * y + C[9] * z + C[13], cz = C[2] * x + C[6] * y + C[10] * z + C[14];
      const bx = b[0] * cx + b[4] * cy + b[8] * cz + b[12], by = b[1] * cx + b[5] * cy + b[9] * cz + b[13], bz = b[2] * cx + b[6] * cy + b[10] * cz + b[14];
      P[i * 3] = A[0] * bx + A[4] * by + A[8] * bz + A[12]; P[i * 3 + 1] = A[1] * bx + A[5] * by + A[9] * bz + A[13]; P[i * 3 + 2] = A[2] * bx + A[6] * by + A[10] * bz + A[14];
      const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
      const ux = C[0] * nx + C[4] * ny + C[8] * nz, uy = C[1] * nx + C[5] * ny + C[9] * nz, uz = C[2] * nx + C[6] * ny + C[10] * nz;
      const vx = b[0] * ux + b[4] * uy + b[8] * uz, vy = b[1] * ux + b[5] * uy + b[9] * uz, vz = b[2] * ux + b[6] * uy + b[10] * uz;
      const wx = A[0] * vx + A[4] * vy + A[8] * vz, wy = A[1] * vx + A[5] * vy + A[9] * vz, wz = A[2] * vx + A[6] * vy + A[10] * vz, l = Math.hypot(wx, wy, wz) || 1;
      N[i * 3] = wx / l; N[i * 3 + 1] = wy / l; N[i * 3 + 2] = wz / l;
    }
    const out = new THREE.BufferGeometry(); out.setIndex(g.index);
    out.setAttribute("position", new THREE.BufferAttribute(P, 3)); out.setAttribute("normal", new THREE.BufferAttribute(N, 3));
    for (const k of ["uv", "rest"]) if (g.attributes[k]) out.setAttribute(k, g.attributes[k]);
    g.groups.forEach(gr => out.addGroup(gr.start, gr.count, gr.materialIndex));
    out.computeBoundingSphere(); return out;
  }

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
  // 25 looks: business bodies (suits made black) with faces from the wider Rocketbox set; hands are tinted to match each face.
  const LOOKS = [
    { b: "Business_Female_01" }, { b: "Business_Male_01" }, { b: "Business_Female_03", h: "Female_Adult_02" }, { b: "Business_Male_05", h: "Male_Adult_12" },
    { b: "Business_Female_04", h: "Female_Adult_03" }, { b: "Business_Male_02", h: "Male_Adult_03" }, { b: "Female_Adult_10" }, { b: "Business_Male_04", h: "Male_Adult_09" },
    { b: "Business_Female_02" }, { b: "Business_Male_01", h: "Male_Adult_15" }, { b: "Business_Female_01", h: "Female_Party_02" }, { b: "Business_Male_03", h: "Male_Adult_13" },
    { b: "Business_Female_02", h: "Female_Adult_14" }, { b: "Business_Male_05", h: "Male_Adult_04" }, { b: "Business_Female_03" }, { b: "Business_Male_02", h: "Male_Adult_10" },
    { b: "Business_Female_01", h: "Female_Adult_11" }, { b: "Business_Male_03", h: "Male_Adult_06" }, { b: "Business_Male_04", h: "Male_Adult_14" }, { b: "Business_Female_04" },
    { b: "Business_Male_01", h: "Male_Adult_05" }, { b: "Business_Male_02" }, { b: "Business_Male_03" }, { b: "Business_Male_04" }, { b: "Business_Male_05" } ];
  const AVATARS = [...new Set(LOOKS.map(l => l.b))];
  const dec = (s, T) => new T(b64buf(s));
  function headMesh(key, sm) {   // a face from another avatar, bound to this body's skeleton (same rig, same bind pose)
    const H = HEADS[key], n = H.nv, P = dec(H.pos, Int16Array), N = dec(H.nor, Int8Array), U = dec(H.uv, Int16Array), SI = dec(H.si, Uint8Array), SW = dec(H.sw, Uint8Array);
    const IH = dec(H.ih, Uint16Array), IA = H.ia ? dec(H.ia, Uint16Array) : new Uint16Array(0);
    const inv = sm.bindMatrixInverse, nm3 = new THREE.Matrix3().getNormalMatrix(inv), v = V(0, 0, 0);
    const remap = H.bones.map(nm => Math.max(0, sm.skeleton.bones.findIndex(bb => bb.name === nm)));
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      v.set(P[i * 3] / 10, P[i * 3 + 1] / 10, P[i * 3 + 2] / 10).applyMatrix4(inv); pos.set([v.x, v.y, v.z], i * 3);
      v.set(N[i * 3] / 127, N[i * 3 + 1] / 127, N[i * 3 + 2] / 127).applyMatrix3(nm3).normalize(); nor.set([v.x, v.y, v.z], i * 3);
      uv[i * 2] = U[i * 2] / 8192; uv[i * 2 + 1] = U[i * 2 + 1] / 8192;
      let t = 0; for (let q = 0; q < 4; q++) { si[i * 4 + q] = remap[SI[i * 4 + q]]; t += SW[i * 4 + q]; }
      for (let q = 0; q < 4; q++) sw[i * 4 + q] = t ? SW[i * 4 + q] / t : (q ? 0 : 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
    const idx = new Uint16Array(IH.length + IA.length); idx.set(IH); idx.set(IA, IH.length); g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.addGroup(0, IH.length, 0); if (IA.length) g.addGroup(IH.length, IA.length, 1);
    const hm = new THREE.SkinnedMesh(g, [rbMaterial(H.pre + "_head"), rbMaterial(H.pre + "_opacity")]); hm.name = "Hoofd";
    hm.position.copy(sm.position); hm.quaternion.copy(sm.quaternion); hm.scale.copy(sm.scale); sm.parent.add(hm); hm.bind(sm.skeleton, sm.bindMatrix);
    return hm;
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

  function splitByMaterial(geo, mats, parent, name, skip, bodyMap, drop) {   // one plain mesh per material (fading works per mesh); drop(a,b,c) hides a triangle
    const n = geo.attributes.position.count, byMat = new Map(), ix = i => geo.index ? geo.index.getX(i) : i;
    geo.groups.forEach(gr => { const l = byMat.get(gr.materialIndex) || []; const isBody = /_body$/.test(mats[gr.materialIndex].name);
      for (let i = gr.start; i < gr.start + gr.count; i += 3) { const a = ix(i), b = ix(i + 1), c = ix(i + 2); if (drop && isBody && drop(a, b, c)) continue; l.push(a, b, c); }
      byMat.set(gr.materialIndex, l); });
    for (const [mi, list] of byMat) { if (skip && skip.test(mats[mi].name)) continue; const g = new THREE.BufferGeometry();
      for (const k of Object.keys(geo.attributes)) g.setAttribute(k, geo.attributes[k]);
      g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(list, 1) : new THREE.Uint16BufferAttribute(list, 1)); g.computeBoundingSphere();
      const me = new THREE.Mesh(g, mats[mi].clone()); if (bodyMap && /_body$/.test(mats[mi].name)) me.material.map = bodyMap; me.name = name + " · " + (mats[mi].name.split("_")[1] || "body"); parent.add(me); }
  }

  function bowTie(body, m, parent) {   // white tie: a small white bow tie at the wing collar
    const neck = wpos(body.getObjectByName("Bip01_Neck")), head = wpos(body.getObjectByName("Bip01_Head")), k = body.scale.x / 0.01;
    const up = head.clone().sub(neck).normalize(), fwd = V(0, 0, 1).transformDirection(m.matrixWorld).projectOnPlane(up).normalize(), side = new THREE.Vector3().crossVectors(up, fwd);
    const p = neck.clone().add(fwd.clone().multiplyScalar(0.068 * k)).add(up.clone().multiplyScalar(-0.035 * k));
    const part = new Part("Strik"), c = new THREE.ConeGeometry(0.022, 0.045, 10);
    part.add(c, "collar", M(0.024, 0, 0, 0, 0, Math.PI / 2, 1, 1, 0.45)).add(c, "collar", M(-0.024, 0, 0, 0, 0, -Math.PI / 2, 1, 1, 0.45)).add(new THREE.SphereGeometry(0.009, 8, 6), "collar");
    const g = part.build(null); g.position.copy(parent.worldToLocal(p.clone()));
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, fwd));
    g.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q)); g.children.forEach(o => { o.name = "Strik"; }); parent.add(g);
  }

  /* ---------- concert dress built around the posed body: tails for the men, long dresses and skirts for the women ---------- */
  const CLOTH = { color: new THREE.Color(0x0c0b0c).convertSRGBToLinear(), roughness: 0.62, metalness: 0, side: THREE.DoubleSide };
  function bindY(o) {   // height of every vertex in the bind pose (cm), cached per template geometry
    const g = o.geometry; if (g.userData.bindY) return g.userData.bindY;
    const p = g.attributes.position, out = new Float32Array(p.count), v = V(0, 0, 0);
    for (let i = 0; i < p.count; i++) out[i] = v.fromBufferAttribute(p, i).applyMatrix4(o.bindMatrix).y;
    return (g.userData.bindY = out);
  }
  function loft(rings, segs = 28) {   // rings: [{c: center, rx, rz, f: fold}] -> one tube; cross sections lie across the path, x stays sideways
    const curve = new THREE.CatmullRomCurve3(rings.map(r => r.c)), K = 5, N = (rings.length - 1) * K, pos = [], idx = [];
    for (let j = 0; j <= N; j++) {
      const u = j / N, i = Math.min(rings.length - 2, Math.floor(j / K)), k = (j - i * K) / K, e = k * k * (3 - 2 * k), A = rings[i], B = rings[i + 1];
      const c = curve.getPoint(u), t = curve.getTangent(u), side = V(1, 0, 0), nrm = new THREE.Vector3().crossVectors(side, t).normalize();
      const rx = A.rx + (B.rx - A.rx) * e, rz = A.rz + (B.rz - A.rz) * e, f = (A.f || 0) + ((B.f || 0) - (A.f || 0)) * e;
      for (let q = 0; q <= segs; q++) { const a = q / segs * Math.PI * 2, w = 1 + f * Math.sin(a * 9 + j * 0.15) ;
        pos.push(c.x + side.x * Math.cos(a) * rx * w + nrm.x * Math.sin(a) * rz * w, c.y + side.y * Math.cos(a) * rx * w + nrm.y * Math.sin(a) * rz * w, c.z + side.z * Math.cos(a) * rx * w + nrm.z * Math.sin(a) * rz * w); }
    }
    for (let j = 0; j < N; j++) for (let q = 0; q < segs; q++) { const a = j * (segs + 1) + q, b = a + segs + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function skirtFor(body, m, parent, long, color) {   // a long dress to the floor, or a skirt to just below the knee, over the seated legs
    const inv = m.matrixWorld.clone().invert(), L = n => wpos(body.getObjectByName(n)).applyMatrix4(inv);
    const P = L("Bip01_Pelvis"), hl = L("Bip01_L_Thigh"), hr = L("Bip01_R_Thigh"), kl = L("Bip01_L_Calf"), kr = L("Bip01_R_Calf"), fl = L("Bip01_L_Foot"), fr = L("Bip01_R_Foot");
    const hip = hl.clone().add(hr).multiplyScalar(0.5), knee = kl.clone().add(kr).multiplyScalar(0.5), half = Math.abs(kl.x - kr.x) / 2;
    const rings = [
      { c: V(P.x, P.y + 0.17, P.z - 0.01), rx: 0.135, rz: 0.1 },
      { c: V(P.x, P.y + 0.03, P.z - 0.02), rx: 0.19, rz: 0.15 },
      { c: hip.clone().add(V(0, 0.0, 0.1)), rx: 0.2, rz: 0.115 },
      { c: hip.clone().lerp(knee, 0.55).add(V(0, 0.025, 0)), rx: half + 0.15, rz: 0.095 },
      { c: knee.clone().add(V(0, 0.03, 0.05)), rx: half + 0.105, rz: 0.085 } ];
    if (long) rings.push({ c: knee.clone().add(V(0, -0.13, 0.12)), rx: half + 0.13, rz: 0.13, f: 0.03 },
                         { c: V(knee.x, 0.02, (fl.z + fr.z) / 2 + 0.1), rx: half + 0.23, rz: 0.25, f: 0.06 });
    else rings.push({ c: knee.clone().add(V(0, -0.17, 0.09)), rx: half + 0.12, rz: 0.11, f: 0.035 });
    const me = new THREE.Mesh(loft(rings), new THREE.MeshStandardMaterial({ ...CLOTH, roughness: long ? 0.5 : 0.65, ...(color ? { color: new THREE.Color(color).convertSRGBToLinear() } : {}) }));   // the long dress has a soft satin sheen
    me.material.envMapIntensity = long ? 0.45 : 0.25; me.name = long ? "Avondjurk" : "Rok"; parent.add(me);
  }
  function tailsFor(m, h, parent) {   // the two tails of the tailcoat, through the gap under the chair back and down behind the seat
    const pos = [], idx = [];
    for (const s of [-1, 1]) {
      const path = [[0.085, h + 0.3, -0.115, 0.075], [0.09, h + 0.12, -0.15, 0.075], [0.09, h + 0.03, -0.2, 0.068], [0.088, h - 0.06, -0.235, 0.06], [0.083, h - 0.36, -0.245, 0.035]];
      const b0 = pos.length / 3;
      path.forEach(([x, y, z, w]) => { for (const e of [-1, 0, 1]) pos.push(s * x + e * w, y, z - (e === 0 ? 0.012 : 0)); });
      for (let i = 0; i < path.length - 1; i++) for (let e = 0; e < 2; e++) { const a = b0 + i * 3 + e, b = a + 3; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const me = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ ...CLOTH, roughness: 0.75 })); me.material.envMapIntensity = 0.2; me.name = "Slippen"; parent.add(me);
  }
  let womenSeen = 0;
  function tintBody(mat, color) {   // recolour the concert-black cloth of a body texture (dark, unsaturated texels); skin and shirt stay
    mat.userData.tint = new THREE.Color(color).convertSRGBToLinear();
    mat.onBeforeCompile = sh => { sh.uniforms.tint = { value: mat.userData.tint };
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n uniform vec3 tint;").replace("#include <map_fragment>", `#include <map_fragment>
        { vec3 c = diffuseColor.rgb; float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = (mx - mn) / max(mx, 1e-4);
          float k = (1.0 - smoothstep(0.03, 0.06, mx)) * (1.0 - smoothstep(0.3, 0.5, sat));
          diffuseColor.rgb = mix(c, tint * clamp(mx / 0.009, 0.45, 1.5), k); }`); };
    mat.customProgramCacheKey = () => "tint";
  }
  // audience and rehearsal colours (sRGB): evening wear in muted tones with some garnet and ochre; rehearsal in everyday greys and creams
  const AUD_MEN = [0x45434a, 0x5a4636, 0x3b4656, 0x6b6660, 0x4a3a30, 0x7a6a58, 0x3e3434];
  const AUD_WOMEN = [0x6e1a12, 0x9a6a2a, 0x46202f, 0x2b2a2c, 0xcbb89c, 0x7f3518, 0x141416, 0x5c0f07];
  const REH = [0x8a8078, 0xcfc2ae, 0x4d5563, 0xa89a84, 0x5a5040];
  function audiencePose(i, h) {   // seated, watching the stage; some hands clasped, some turned to a neighbour
    const r = k => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
    const hk = r(1), side = r(5) < 0.5 ? 1 : -1;
    const L = hk < 0.3 ? V(0.04, h + 0.2, 0.3) : hk < 0.8 ? V(0.1, h + 0.16, 0.3) : V(0.2, h + 0.13, 0.36);
    const R = hk < 0.3 ? V(-0.05, h + 0.19, 0.28) : V(-0.11 - r(2) * 0.06, h + 0.16, 0.31 + r(3) * 0.06);
    const yaw = r(4) < 0.3 ? side * (0.3 + r(6) * 0.3) : (r(6) - 0.5) * 0.15;
    return { L: { t: L, dir: V(-0.4, -0.5, 1), palm: V(0.2, -1, 0), curl: 0.5 }, R: { t: R, dir: V(0.4, -0.5, 1), palm: V(-0.2, -1, 0), curl: 0.5 },
      legs: { spread: 0.04 + r(7) * 0.1, footZ: 0.42 + r(8) * 0.12 }, head: [0.05 + r(9) * 0.1, (r(10) - 0.5) * 0.15, yaw], lean: r(11) < 0.2 ? -0.06 : 0.02 + r(11) * 0.08 };
  }
  const BLOB_GEO = new THREE.PlaneGeometry(1, 1), BLOB_TEX = (() => { const cv = document.createElement("canvas"); cv.width = cv.height = 64; const x = cv.getContext("2d");
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgb(150,150,150)"); g.addColorStop(0.55, "rgb(80,80,80)"); g.addColorStop(1, "rgb(0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv); })();
  const OUTFITS = ["avondjurk", "rok", "avondjurk", "pantalon"];   // half long dresses, a quarter skirts, a quarter trousers
  function placeMusician(c, T) {
    const { m, part, h, v, vi, pose } = c, look = LOOKS[(vi * 7 + (c.lookShift || 0)) % LOOKS.length], key = look.b, A = T[key];
    const body = THREE.SkeletonUtils.clone(A.tpl); body.name = "Persoon"; m.add(body);
    body.scale.multiplyScalar(0.94 + ((vi * 37) % 13) / 13 * 0.12);   // a little variety in build
    let sm0 = null; body.traverse(o => { if (o.isSkinnedMesh && !sm0) sm0 = o; });
    const swapped = look.h && HEADS[look.h] ? headMesh(look.h, sm0) : null;
    poseSeated(body, m, h, pose, A); refresh(body);
    const baked = new THREE.Group(); baked.name = "Lichaam"; m.add(baked); m.updateWorldMatrix(true, true);
    const inv = m.matrixWorld.clone().invert();
    const bodyPre = [].concat(sm0.material)[0].name.split("_")[0];
    const bodyMap = swapped ? tex(bodyPre + "_body_" + HEADS[look.h].pre) : null;
    const meshesToBake = []; body.traverse(o => { if (o.isSkinnedMesh) meshesToBake.push(o); });
    const kind = c.outfit || "concert";   // concert (the orchestra), repetitie (CHANGE: rehearsal clothes), publiek (evening wear in colour)
    let outfit = /Business_Male/.test(key) ? (kind === "concert" ? "rokkostuum" : "pak")
      : /Business_Female/.test(key) ? (kind === "repetitie" ? "pantalon" : OUTFITS[womenSeen++ % 4]) : "eigen";
    if (key === "Business_Female_03" && outfit === "pantalon") outfit = "rok";   // this body has a skirt and bare legs
    const yRange = outfit === "avondjurk" ? [13, 99] : outfit === "rok" ? [38, 99] : null;   // legs hidden under the dress or skirt (bind height, cm)
    meshesToBake.forEach(o => { const Y = yRange && o !== swapped ? bindY(o) : null, inR = i => Y[i] > yRange[0] && Y[i] < yRange[1];
      splitByMaterial(bakeSkinned(o, inv), [].concat(o.material), baked, o === swapped ? look.h : key, swapped && o !== swapped ? /_head|_opacity|_glasses/ : null, o === swapped ? null : bodyMap,
        Y ? (a, b, c2) => inR(a) && inR(b) && inR(c2) : null); });
    if (outfit === "rokkostuum") { bowTie(body, m, baked); tailsFor(m, h, baked); }
    if (c.tint && outfit !== "eigen") baked.traverse(o => { if (o.isMesh && /_body$/.test(o.material.name)) tintBody(o.material, c.tint); });
    if (outfit === "avondjurk" || outfit === "rok") skirtFor(body, m, baked, outfit === "avondjurk", c.tint);
    m.userData.outfit = outfit;
    const blob = new THREE.Mesh(BLOB_GEO, new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: BLOB_TEX, transparent: true, depthWrite: false }));   // soft contact shadow under chair and feet
    blob.rotation.x = -Math.PI / 2; blob.position.set(0, 0.006, 0.12); blob.scale.set(0.95, 1.25, 1); blob.name = "Contactschaduw"; blob.userData.noShadow = true; blob.renderOrder = 1; baked.add(blob);
    if (c.outfit === "publiek") blob.material.opacity = 0.65;   // lighter contact shadow, so legs stay apart from the ground
    body.removeFromParent();
    return baked;
  }

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

  (async () => {
    const note = document.getElementById("loading");
    try {
      if (window.__noPeople) { note.hidden = true; window.__people = { skipped: true }; return; }
      await nextFrame(); const t0 = performance.now(); let work = 0, w0 = performance.now();
      const T = {};
      for (const k of AVATARS) { T[k] = rbTemplate(k); await nextFrame(); }
      T.conductor = rbTemplate("Business_Male_01", "red");
      let done = 0, ri = 0;
      for (const c of MUS) if (c.outfit === "repetitie") c.tint = REH[ri++ % REH.length];
      for (const c of MUS) {
        w0 = performance.now(); const baked = placeMusician(c, T); unregister(c.standIn); register(baked); work += performance.now() - w0;
        if (++done % 4 === 0) { note.textContent = "Muzikanten laden… " + done + " van " + MUS.length; await nextFrame(); }
      }
      const cb = placeConductor(T); dir.children.filter(o => o !== cb).forEach(o => unregister(o)); register(cb); register(conductor.baton);
      { // CHANGE: the same conductor, standing beside next season's board and pointing to it with an open hand
        const pr = conductorBody(T, dir2); dir2.children.filter(o => o !== pr.body).forEach(o => unregister(o)); register(pr.body);
        poseArms(pr, dir2, { l: V(0.2, 0.86, 0.06), r: V(-0.52, 1.22, 0.3) }, 0, { l: 0.35, r: 0.05 }, V(-0.25, 1, 0.12)); }
      // the audience: same people, evening wear in colour, placed row by row
      for (const a of AUD) {
        const look = LOOKS[(a.vi * 7 + 3) % LOOKS.length], male = /Male/.test(look.b);
        a.pose = audiencePose(a.vi, a.h); a.outfit = "publiek"; a.lookShift = 3;
        a.tint = (male ? AUD_MEN : AUD_WOMEN)[(a.vi * 5 + a.row) % (male ? AUD_MEN.length : AUD_WOMEN.length)];
        const baked = placeMusician(a, T); register(baked);
        if (++done % 4 === 0) { note.textContent = "Publiek laden… " + (done - MUS.length) + " van " + AUD.length; await nextFrame(); }
      }
      AUD.standIns.forEach(st => unregister(st));
      note.hidden = true;
      window.__people = { T, MUS, total: performance.now() - t0, work };
    } catch (e) { console.error("people", e); note.textContent = "De muzikanten konden niet laden in deze browser."; }
  })();
