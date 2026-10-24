
  /* ---------- pose helpers: aim bones in world space ---------- */
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const wpos = o => o.getWorldPosition(V(0, 0, 0));
  function setWorldQuat(bone, wq) { bone.parent.getWorldQuaternion(_q2); bone.quaternion.copy(_q2.invert().multiply(wq)); bone.updateWorldMatrix(false, true); }
  function aim(bone, child, dirW) {   // rotate bone so the line to its child points along dirW
    bone.updateWorldMatrix(true, true);
    const cur = wpos(child).sub(wpos(bone)).normalize();
    const wq = bone.getWorldQuaternion(new THREE.Quaternion());
    setWorldQuat(bone, _q.setFromUnitVectors(cur, dirW.clone().normalize()).multiply(wq));
  }
  function twist(bone, axisW, curW, tgtW) {   // spin bone around axisW so curW lines up with tgtW
    const a = axisW.clone().normalize(), c = curW.clone().projectOnPlane(a).normalize(), t = tgtW.clone().projectOnPlane(a).normalize();
    const ang = Math.atan2(a.dot(new THREE.Vector3().crossVectors(c, t)), c.dot(t));
    const wq = bone.getWorldQuaternion(new THREE.Quaternion());
    setWorldQuat(bone, new THREE.Quaternion().setFromAxisAngle(a, ang).multiply(wq));
  }
  function turn(bone, axisW, ang) { const wq = bone.getWorldQuaternion(new THREE.Quaternion()); setWorldQuat(bone, new THREE.Quaternion().setFromAxisAngle(axisW, ang).multiply(wq)); }

  // Quaternius / Unreal-style skeleton names
  const RIG = { Hips: "pelvis", Spine: "spine_01", Spine1: "spine_02", Spine2: "spine_03", Neck: "neck_01", Head: "Head" };
  const side = (s, n) => n + (s === "Left" ? "_l" : "_r");
  const LIMB = { UpLeg: "thigh", Leg: "calf", Foot: "foot", Toe: "ball", ToeEnd: "ball_leaf", Arm: "upperarm", ForeArm: "lowerarm", Hand: "hand" };

  /* ---------- dressing (once per body type): cloth shaping and per-pixel clothes in the rest pose ---------- */
  const MAKEMAT = new Map();   // body geometry -> material factory (skin, suit colour)
  const GET = [THREE.BufferAttribute.prototype.getX, THREE.BufferAttribute.prototype.getY, THREE.BufferAttribute.prototype.getZ, THREE.BufferAttribute.prototype.getW];
  const _bm = new THREE.Matrix4(), _base = new THREE.Vector3(), _acc = new THREE.Vector3(), _tmp = new THREE.Vector3();
  function skinned(o, i, out) {   // world position of a skinned vertex, as the GPU computes it
    const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bm = o.skeleton.boneMatrices;
    _base.fromBufferAttribute(g.attributes.position, i).applyMatrix4(o.bindMatrix); _acc.set(0, 0, 0);
    for (let k = 0; k < 4; k++) { const w = GET[k].call(sw, i); if (!w) continue; _bm.fromArray(bm, GET[k].call(si, i) * 16); _acc.addScaledVector(_tmp.copy(_base).applyMatrix4(_bm), w); }
    return out.copy(_acc).applyMatrix4(o.bindMatrixInverse).applyMatrix4(o.matrixWorld);
  }
  function refresh(root) { root.updateWorldMatrix(true, false); root.updateMatrixWorld(true);   // parents first: the page may not have rendered yet
    root.traverse(o => { if (o.isSkinnedMesh) { o.skeleton.update(); } }); }
  function dominant(o, i) { const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight; let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = GET[k].call(sw, i); if (w > bw) { bw = w; best = GET[k].call(si, i); } } return o.skeleton.bones[best].name; }

  // Soften muscles into cloth: Laplacian smoothing on the clothed vertices, welded across UV seams.
  function smoothCloth(g, clothed, iters) {
    const pos = g.attributes.position, n = pos.count, idx = g.index.array, key = new Map(), weld = new Int32Array(n);
    for (let i = 0; i < n; i++) { const k = pos.getX(i).toFixed(3) + "," + pos.getY(i).toFixed(3) + "," + pos.getZ(i).toFixed(3); if (!key.has(k)) key.set(k, i); weld[i] = key.get(k); }
    const nb = new Map(); const link = (a, b) => { a = weld[a]; b = weld[b]; if (a === b) return; (nb.get(a) || nb.set(a, new Set()).get(a)).add(b); };
    for (let f = 0; f < idx.length; f += 3) { const [a, b, c] = [idx[f], idx[f + 1], idx[f + 2]]; link(a, b); link(b, a); link(b, c); link(c, b); link(c, a); link(a, c); }
    const P = new Float32Array(n * 3); for (let i = 0; i < n; i++) { P[i * 3] = pos.getX(i); P[i * 3 + 1] = pos.getY(i); P[i * 3 + 2] = pos.getZ(i); }
    for (let it = 0; it < iters; it++) {
      const Q = P.slice();
      for (const [v, set] of nb) { if (!clothed[v]) continue; let x = 0, y = 0, z = 0; for (const u of set) { x += P[u * 3]; y += P[u * 3 + 1]; z += P[u * 3 + 2]; } const k = 1 / set.size;
        Q[v * 3] = P[v * 3] * 0.5 + x * k * 0.5; Q[v * 3 + 1] = P[v * 3 + 1] * 0.5 + y * k * 0.5; Q[v * 3 + 2] = P[v * 3 + 2] * 0.5 + z * k * 0.5; }
      P.set(Q);
    }
    for (let i = 0; i < n; i++) { const w = weld[i]; pos.setXYZ(i, P[w * 3], P[w * 3 + 1], P[w * 3 + 2]); }
    pos.needsUpdate = true; return weld;
  }


  // World matrix that carries geometry vertex i to its skinned place (to move cloth in model space and write it back).
  function skinMat(o, i, out) {
    const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight, bm = o.skeleton.boneMatrices, e = new Array(16).fill(0);
    for (let k = 0; k < 4; k++) { const w = GET[k].call(sw, i); if (!w) continue; const j = GET[k].call(si, i) * 16; for (let q = 0; q < 16; q++) e[q] += w * bm[j + q]; }
    return out.fromArray(e).premultiply(o.bindMatrixInverse).multiply(o.bindMatrix).premultiply(o.matrixWorld);
  }
  const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // Tailoring in the rest (T-) pose: trousers and sleeves become straight tubes, the jacket front hangs straight
  // down from the chest, feet are tucked into the shoes. R = rest positions (model space), returns new positions.
  function tailor(R, n, b) {
    const T = R.slice(), zmax = new Map(), xb = x => Math.round(x / 0.015), yb = y => Math.round(y / 0.01);
    const front = (x, y, z) => Math.abs(x) < b.shX - 0.02 && y > b.crotch - 0.04 && y < b.chestTop && z > b.midZ;
    for (let i = 0; i < n; i++) { const x = R[i * 3], y = R[i * 3 + 1], z = R[i * 3 + 2];
      if (front(x, y, z)) { const k = yb(y) * 1000 + xb(x); zmax.set(k, Math.max(zmax.get(k) ?? -9, z)); } }
    const drape = new Map();                                                       // cloth may fall back at most 25 cm per metre
    for (let y = yb(b.chestTop); y >= yb(b.crotch - 0.04); y--) for (let x = xb(-b.shX); x <= xb(b.shX); x++) {
      const k = y * 1000 + x, up = drape.get(k + 1000); drape.set(k, Math.max(zmax.get(k) ?? -9, up === undefined ? -9 : up - 0.0025)); }
    const rowSum = new Map();                                                      // mean depth of the chest per row, to soften the bust under the jacket
    for (let i = 0; i < n; i++) { const x = R[i * 3], y = R[i * 3 + 1], z = R[i * 3 + 2]; if (front(x, y, z) && Math.abs(x) < 0.16) { const r = rowSum.get(yb(y)) || [0, 0]; r[0] += z; r[1]++; rowSum.set(yb(y), r); } }
    for (let i = 0; i < n; i++) {
      let x = R[i * 3], y = R[i * 3 + 1], z = R[i * 3 + 2]; const ax = Math.abs(x), sx = Math.sign(x) || 1;
      if (front(x, y, z) && Math.abs(x) < 0.16 && y > b.chestTop - 0.32) { const r = rowSum.get(yb(y)), mz = r[0] / r[1]; if (z > mz) z = mz + (z - mz) * 0.45; }
      if (front(x, y, z)) { let best = -9; const row = yb(y) * 1000;               // fill the hollows across the chest too: the jacket bridges them
        for (let q = xb(x) - 8; q <= xb(x) + 8; q++) { const dz = drape.get(row + q); if (dz !== undefined) best = Math.max(best, dz - 2.5 * ((q - xb(x)) * 0.015) ** 2); }
        z = Math.max(z, best - 0.002); }
      if (ax > b.shX + 0.02 && ax < b.wrist + 0.004) {                             // sleeve
        const t = (ax - b.shX) / (b.wrist - b.shX), cy = b.armY + (b.wristY - b.armY) * t, cz = b.armZ + (b.wristZ - b.armZ) * t;
        const dy = y - cy, dz = z - cz, r = Math.hypot(dy, dz) || 1e-4, Rt = 0.058 - 0.012 * t;
        const rn = r + (Math.max(Rt, r + (Rt - r) * 0.5) - r) * smooth01(b.shX + 0.02, b.shX + 0.09, ax);
        y = cy + dy / r * rn; z = cz + dz / r * rn;
      }
      if (y < b.crotch + 0.04 && y > b.ankle + 0.015 && ax < 0.3 && ax < b.shX) { // trouser leg
        const t = Math.min(1, Math.max(0, (b.crotch - y) / (b.crotch - b.ankle))), cx = sx * b.legX, cz = b.legZ + (b.footZ - b.legZ) * t;
        const dx = x - cx, dz = z - cz, r = Math.hypot(dx, dz) || 1e-4, Rt = 0.1 - 0.032 * t;
        const w = smooth01(b.crotch + 0.04, b.crotch - 0.06, y);
        const rn = r + (Math.max(Rt, r + (Rt - r) * 0.5) - r) * w;
        x = cx + dx / r * rn; z = cz + dz / r * rn;
      }
      if (y < b.ankle + 0.015) { const k = 0.8; x = sx * b.legX + (x - sx * b.legX) * k; y = y * 0.9; z = 0.015 + (z - 0.015) * k; }   // inside the shoe
      T[i * 3] = x; T[i * 3 + 1] = y; T[i * 3 + 2] = z;
    }
    return T;
  }

  // Concert clothes are drawn per pixel from the rest (T-) pose position, so edges are crisp:
  // suit everywhere, skin on head and hands, white shirt V with satin lapels, white cuffs, black shoes.
  function dress(model, c) {
    refresh(model);
    const B = n => model.getObjectByName(n), bp = n => wpos(B(n));
    const toModel = model.matrixWorld.clone().invert(), mp = n => bp(n).applyMatrix4(toModel);
    const neck = mp("neck_01"), head = mp("Head"), sp3 = mp("spine_03"), sp2 = mp("spine_02"), wrist = Math.abs(mp("hand_l").x), ankle = mp("foot_l").y;
    const ua = mp("upperarm_l"), hl = mp("hand_l"), th = mp("thigh_l"), ft = mp("foot_l");
    const bones = { shX: ua.x, armY: ua.y, armZ: ua.z, wrist, wristY: hl.y, wristZ: hl.z, legX: th.x, legZ: th.z, footZ: ft.z, crotch: th.y - 0.1,
      ankle, chestTop: sp3.y + 0.1, midZ: sp3.z - 0.02 };
    const U = {
      legX: { value: th.x }, legZ: { value: th.z }, footZ: { value: ft.z }, crotchY: { value: th.y - 0.1 },
      collarY: { value: neck.y + 0.06 }, wristX: { value: wrist - 0.01 }, ankleY: { value: ankle + 0.03 },
      vTop: { value: neck.y + 0.03 }, vBot: { value: sp2.y - 0.02 }, vHalf: { value: 0.085 }, frontZ: { value: sp3.z },
      cShirt: { value: new THREE.Color(0xF4F0E8) },
      cLapel: { value: new THREE.Color(0x0b0a0a) }, cShoe: { value: new THREE.Color(0x0b0807) },
    };
    const p = V(0, 0, 0); let neckFront = -9;
    model.traverse(o => {
      if (!o.isSkinnedMesh || !/Superhero/.test(o.material.name)) return;
      const g = o.geometry, n = g.attributes.position.count, rest = new Float32Array(n * 3), clothed = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        skinned(o, i, p).applyMatrix4(toModel); rest.set([p.x, p.y, p.z], i * 3);
        const skin = (Math.abs(p.x) < 0.2 && p.y > neck.y + 0.05) || Math.abs(p.x) > wrist + 0.02;
        clothed[i] = skin ? 0 : 1;
        if (Math.abs(p.y - (neck.y + 0.03)) < 0.02 && Math.abs(p.x) < 0.03) neckFront = Math.max(neckFront, p.z);
      }
      const weld = smoothCloth(g, clothed, 8);
      const feet = new Uint8Array(n); for (let i = 0; i < n; i++) feet[i] = rest[i * 3 + 1] < ankle + 0.06 ? 1 : 0;
      smoothCloth(g, feet, 25);                                                // toes melt into a shoe
      const face = new Uint8Array(n); for (let i = 0; i < n; i++) face[i] = rest[i * 3 + 1] > neck.y + 0.08 && Math.abs(rest[i * 3]) < 0.15 ? 1 : 0;
      smoothCloth(g, face, 3);                                                 // softer, more neutral faces (art direction: no portraits)
      { const pg = g.attributes.position, Mi = new THREE.Matrix4(), M3 = new THREE.Matrix3(), d = V(0, 0, 0);
        for (let i = 0; i < n; i++) { skinned(o, i, p).applyMatrix4(toModel); rest.set([p.x, p.y, p.z], i * 3); }
        const T = tailor(rest, n, bones);
        for (let i = 0; i < n; i++) { const j = i * 3; d.set(T[j] - rest[j], T[j + 1] - rest[j + 1], T[j + 2] - rest[j + 2]); if (d.lengthSq() < 1e-12) continue;
          M3.setFromMatrix4(skinMat(o, i, Mi).premultiply(toModel)).invert(); d.applyMatrix3(M3); pg.setXYZ(i, pg.getX(i) + d.x, pg.getY(i) + d.y, pg.getZ(i) + d.z); } }
      const chest = new Uint8Array(n); for (let i = 0; i < n; i++) chest[i] = clothed[i] && rest[i * 3 + 1] > bones.crotch && rest[i * 3 + 1] < bones.chestTop + 0.05 && Math.abs(rest[i * 3]) < bones.shX ? 1 : 0;
      smoothCloth(g, chest, 12);                                               // the jacket front falls smooth, no anatomy
      const pos = g.attributes.position; g.computeVertexNormals(); const nor = g.attributes.normal, N = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const w = weld[i] * 3; N[w] += nor.getX(i); N[w + 1] += nor.getY(i); N[w + 2] += nor.getZ(i); }   // one normal per welded point, so seams stay closed
      for (let i = 0; i < n; i++) if (clothed[i]) { const w = weld[i] * 3, l = Math.hypot(N[w], N[w + 1], N[w + 2]) || 1, k = 0.01 / l; pos.setXYZ(i, pos.getX(i) + N[w] * k, pos.getY(i) + N[w + 1] * k, pos.getZ(i) + N[w + 2] * k); }
      g.computeVertexNormals();
      for (let i = 0; i < n; i++) { skinned(o, i, p).applyMatrix4(toModel); rest.set([p.x, p.y, p.z], i * 3); }   // rest positions of the smoothed cloth
      g.setAttribute("rest", new THREE.BufferAttribute(rest, 3));
      const mk = (skin, suit, pants) => { const Uc = { ...U, cSkin: { value: new THREE.Color(skin) }, cSuit: { value: new THREE.Color(suit) }, cPants: { value: pants === undefined ? new THREE.Color(suit).multiplyScalar(0.62) : new THREE.Color(pants) } };
      const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.9, envMapIntensity: 0.12, specularIntensity: 0.35, sheen: 0.4, sheenRoughness: 0.7, sheenColor: new THREE.Color(0x2a2a2e) });   // wool: matte with a soft sheen
      m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, Uc);
        sh.vertexShader = "attribute vec3 rest;\nvarying vec3 vRest;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vRest = rest;");
        sh.fragmentShader = "varying vec3 vRest;\nuniform float collarY, wristX, ankleY, vTop, vBot, vHalf, frontZ, legX, legZ, footZ, crotchY;\nuniform vec3 cSuit, cSkin, cShirt, cLapel, cShoe, cPants;\n" +
          sh.fragmentShader.replace("#include <color_fragment>", `
            vec3 cc = cSuit; float ax = abs(vRest.x); float lap = 0.0;
            float hw = vHalf * clamp((vRest.y - vBot) / (vTop - vBot), 0.0, 1.0);
            bool front = vRest.z > frontZ - 0.03 && ax < 0.2;
            if (front && vRest.y > vBot && vRest.y < vTop + 0.05) { if (ax < hw) cc = cShirt; else if (ax < hw + 0.05 && vRest.y > vBot + 0.03) { cc = cLapel; lap = 1.0; } }
            if (ax < 0.2 && vRest.y > vTop && vRest.y < collarY) cc = cShirt;
            if (ax < 0.2 && vRest.y >= collarY) cc = cSkin;
            if (ax > wristX - 0.045 && ax <= wristX) cc = cShirt;
            if (ax > wristX) cc = cSkin;
            float hemY = crotchY + 0.03;
            bool trousers = vRest.y < hemY || (vRest.z > frontZ - 0.03 && vRest.y < vBot && ax < (vBot - vRest.y) * 0.55);   // jacket opens below the button
            if (trousers) cc = cPants;
            if (abs(vRest.y - hemY) < 0.006 && ax < legX + 0.12) cc = cSuit * 0.25;   // jacket hem
            float lt = clamp((crotchY - vRest.y) / (crotchY - ankleY), 0.0, 1.0);
            if (vRest.y < crotchY && ax > legX + 0.04 && abs(vRest.z - mix(legZ, footZ, lt)) < 0.008) { cc = cLapel; lap = 1.0; }   // satin stripe on the trousers
            if (vRest.y < ankleY) cc = cShoe;
            diffuseColor.rgb *= cc;`).replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.45, lap);   // satin lapels");
      };
      return m; };
      MAKEMAT.set(o.geometry, mk); o.material = mk(c.skin, c.suit);
    });
    model.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; if (/Hair/.test(o.material.name)) o.material.color.set(c.hair_c);
      if (/Eyes/.test(o.material.name)) o.material = new THREE.MeshStandardMaterial({ color: 0x2a1d18, roughness: 0.7, envMapIntensity: 0.2 }); } });
    // bow tie and collar wings, parented to the neck so they follow the pose (positions in world space)
    const add = (geo, key, parent, m) => { const mesh = new THREE.Mesh(geo, material(key)); mesh.applyMatrix4(m); mesh.castShadow = true; scene.add(mesh); mesh.updateMatrixWorld(); B(parent).attach(mesh); return mesh; };
    const nw = bp("neck_01"), fz = neckFront + model.matrixWorld.elements[14] + 0.012, tieY = nw.y + 0.035;
    for (const s of [-1, 1]) add(new THREE.ConeGeometry(0.022, 0.044, 12), "ebony", "neck_01", M(nw.x + s * 0.022, tieY, fz, 0, 0, s * Math.PI / 2));
    add(new THREE.SphereGeometry(0.01, 10, 8), "ebony", "neck_01", M(nw.x, tieY, fz + 0.004));
    // polished shoes on the foot bones: rounded upper, thin sole, a heel
    for (const sd of ["l", "r"]) {
      const f = bp("foot_" + sd), up = new THREE.SphereGeometry(1, 16, 10), pa = up.attributes.position;
      for (let i = 0; i < pa.count; i++) { let x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
        x *= 0.05 * (1 - 0.18 * Math.max(0, z)); y = y < 0 ? y * 0.022 : y * 0.072 * (1 - 0.45 * Math.max(0, z)); z *= 0.145; pa.setXYZ(i, x, y, z); }
      up.computeVertexNormals();
      const ox = f.x, oz = model.matrixWorld.elements[14] + 0.015, oy = model.matrixWorld.elements[13];
      add(up, "shoe", "foot_" + sd, M(ox, oy + 0.03, oz));
      const sole = new THREE.SphereGeometry(1, 16, 4); sole.scale(0.054, 0.007, 0.152); add(sole, "ebony", "foot_" + sd, M(ox, oy + 0.009, oz + 0.002));
      add(new THREE.BoxGeometry(0.062, 0.026, 0.06), "ebony", "foot_" + sd, M(ox, oy + 0.013, oz - 0.1));
    }
    return { ankle, neck };
  }
