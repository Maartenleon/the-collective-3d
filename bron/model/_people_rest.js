
  /* ---------- the seated people: baked once into people.glb (bron/bake/bake.py), loaded here; only the conductors are built in the browser ---------- */
  function bakedMaterial(spec, maps) {   // the same materials the bake started from (rbMaterial, tintBody, material()), so colours stay exactly the same
    if (spec.k === "rb") { const m = rbMaterial(spec.name); m.map = spec.map ? maps[spec.map] : null; if (spec.tint) { tintBody(m, 0); m.userData.tint.fromArray(spec.tint); } return m; }
    if (spec.k === "mat") return material(spec.key);
    if (spec.k === "blob") { const m = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: BLOB_TEX, transparent: true, depthWrite: false }); m.opacity = spec.opacity; return m; }
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color().fromArray(spec.color), roughness: spec.roughness, metalness: spec.metalness, side: spec.side }); m.envMapIntensity = spec.env; return m;
  }
  async function loadPeople(note) {   // download with progress (bytes), then decode; returns one node per person, keyed "mus 3" / "aud 12"
    const res = await fetch(PEOPLE.url); if (!res.ok) throw new Error("people.glb " + res.status);
    const reader = res.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length;
      window.__peopleProgress = 0.7 * Math.min(1, got / PEOPLE.bytes); note.textContent = "Muzikanten laden… " + (got / 1e6).toFixed(1) + " van " + (PEOPLE.bytes / 1e6).toFixed(1) + " MB"; }
    const buf = new Uint8Array(got); let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; }
    const gl = new THREE.GLTFLoader(); gl.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await new Promise((res2, rej) => gl.parse(buf.buffer, "", res2, rej)), parser = gltf.parser;
    const maps = {};   // the original JPG/PNG files, stored as plain buffer views; loaded like before (an <img>, sRGB, anisotropy 4, flipY)
    for (const im of parser.json.images || []) { if (!im.name || im.bufferView === undefined || /^baked/.test(im.name)) continue;
      const bv = await parser.getDependency("bufferView", im.bufferView), t = texLoader.load(URL.createObjectURL(new Blob([bv], { type: im.mimeType })));
      t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; maps[im.name] = t; }
    let uv = null; gltf.scene.traverse(n => { if (!uv && n.isMesh && n.material.map) uv = n.material.map; });   // gltfpack quantized the UVs; its transform sits on the stand-in texture
    if (uv) for (const t of [...Object.values(maps), BLOB_TEX]) { t.offset.copy(uv.offset); t.repeat.copy(uv.repeat); t.rotation = uv.rotation; t.updateMatrix(); }
    const byKey = new Map();
    for (const node of [...gltf.scene.children]) {
      node.name = "Lichaam";
      node.traverse(n => { if (!n.userData.spec) return;   // the recipe sits on the named node; gltfpack put the mesh in a child node that undoes the quantization
        const me = n.isMesh ? n : n.children.find(c => c.isMesh), old = me.material; me.material = bakedMaterial(n.userData.spec, maps); n.name = me.name = n.userData.n;
        if (n.userData.noShadow) me.userData.noShadow = true; if (n.userData.spec.k === "blob") me.renderOrder = 1; old.dispose(); });
      byKey.set(node.userData.list + " " + node.userData.i, node);
    }
    window.__peopleProgress = 0.8;
    return byKey;
  }

  (async () => {
    const note = document.getElementById("loading");
    try {
      if (window.__noPeople) { note.hidden = true; window.__people = { skipped: true }; return; }
      await nextFrame(); const t0 = performance.now();
      const T = { conductor: rbTemplate("Business_Male_01", "red") };
      const baked = await loadPeople(note), place = (c, key) => { const g = baked.get(key); c.m.add(g); c.m.userData.outfit = g.userData.outfit; return g; };
      // placing is cheap now, so it no longer waits a frame every few people (without a GPU one frame took over a second, and those waits were most of the loading)
      for (const [i, c] of MUS.entries()) { const g = place(c, "mus " + i); unregister(c.standIn); register(g); }
      window.__peopleProgress = 0.9; note.textContent = "Muzikanten laden… " + MUS.length + " van " + MUS.length; await nextFrame();
      const cb = placeConductor(T); dir.children.filter(o => o !== cb).forEach(o => unregister(o)); register(cb); register(conductor.baton);
      { // CHANGE: the same conductor, standing beside next season's board and pointing to it with an open hand
        const pr = conductorBody(T, dir2); dir2.children.filter(o => o !== pr.body).forEach(o => unregister(o)); register(pr.body);
        poseArms(pr, dir2, { l: V(0.2, 0.86, 0.06), r: V(-0.52, 1.22, 0.3) }, 0, { l: 0.35, r: 0.05 }, V(-0.25, 1, 0.12)); }
      // the audience, row by row
      for (const [i, a] of AUD.entries()) register(place(a, "aud " + i));
      note.textContent = "Publiek laden… " + AUD.length + " van " + AUD.length;
      AUD.standIns.forEach(st => unregister(st));
      note.hidden = true; window.__peopleProgress = 1;
      window.__people = { T, MUS, total: performance.now() - t0 };
    } catch (e) { console.error("people", e); note.textContent = "De muzikanten konden niet laden in deze browser."; }
  })();
