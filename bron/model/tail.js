  /* ---------- isolation ---------- */
  const meshes = []; scene.traverse(o => { if (o.isMesh && o !== skyMesh) { meshes.push(o); o.material.transparent = true; o.userData.goal = 1; } });
  const keepAlways = new Set(); omg.traverse(o => keepAlways.add(o));
  let selected = null;
  const pathOf = o => { const p = []; for (let n = o; n && n !== root; n = n.parent) p.unshift(n.name); return p; };
  function isolate(obj, frame = true) {
    selected = obj;
    const keep = new Set(keepAlways);
    if (obj) obj.traverse(o => keep.add(o));
    meshes.forEach(m => { m.userData.goal = !obj || keep.has(m) ? 1 : GHOST; });
    document.querySelectorAll(".node").forEach(n => n.classList.toggle("on", obj && n._obj === obj));
    const sel = document.getElementById("sel");
    if (!obj) sel.textContent = "Niets geïsoleerd";
    else {
      const count = countLeaves(obj) || obj.userData.count || 0;
      sel.innerHTML = pathOf(obj).slice(0, -1).join(" › ") + (pathOf(obj).length > 1 ? " › " : "") + "<b>" + obj.name + "</b>" + (count > 1 ? " · " + count : "");
    }
    if (obj && frame && !obj.userData.empty) {
      const box = new THREE.Box3().setFromObject(obj); if (box.isEmpty()) return;
      const c = box.getCenter(new THREE.Vector3()), rad = Math.max(1.2, box.getSize(new THREE.Vector3()).length() / 2);
      const dirv = camera.position.clone().sub(controls.target).normalize();
      const dist = rad / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
      const pos = c.clone().add(dirv.multiplyScalar(dist)); pos.y = Math.max(pos.y, c.y + 0.6);
      flyTo(pos, c, camera.fov);
    }
  }

  /* ---------- tree panel, built from the actual scene graph ---------- */
  const treeEl = document.getElementById("tree");
  function countLeaves(o) { let n = 0; o.traverse(c => { if (c !== o) n += c.userData.count || 0; }); return n; }
  function build(o, el, depth) {
    const kids = o.children.filter(c => c.userData.iso);
    const btn = document.createElement("button"); btn.className = "node"; btn._obj = o;
    const n = countLeaves(o);
    btn.innerHTML = "<span></span>" + (o.userData.empty ? '<span class="n">leeg</span>' : n > 1 ? '<span class="n">' + n + "</span>" : "");
    btn.firstChild.textContent = o.name;
    btn.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); isolate(o); });
    if (!kids.length) { const d = document.createElement("div"); d.className = "leaf"; d.innerHTML = '<span class="tw">▸</span>'; d.appendChild(btn); el.appendChild(d); return; }
    const det = document.createElement("details"); if (depth < 2) det.open = true;
    const sum = document.createElement("summary"); sum.innerHTML = '<span class="tw" aria-hidden="true">▸</span>'; sum.appendChild(btn);
    sum.firstChild.addEventListener("click", e => { e.preventDefault(); det.open = !det.open; });
    det.appendChild(sum); el.appendChild(det);
    kids.forEach(k => build(k, det, depth + 1));
  }
  root.children.forEach(c => build(c, treeEl, 0));

  /* ---------- click in the scene ---------- */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  canvas.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener("pointerup", e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const r = canvas.getBoundingClientRect();
    ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(meshes.filter(m => m.material.opacity > 0.5), false).find(h => !keepAlways.has(h.object));
    if (!hit) { isolate(null, false); return; }
    let o = hit.object; while (o && !o.userData.iso) o = o.parent;
    // first click: the section; clicking again inside it: the individual
    let sec = o; while (sec.parent && sec.parent.userData.iso && sec.parent !== RUN && !["Orkest", "Lessenaars", "Publiek"].includes(sec.parent.name)) sec = sec.parent;
    isolate(selected && (selected === sec || sec.parent === selected) ? o : sec);
  });

  /* ---------- cameras ---------- */
  let fly = null;
  function flyTo(pos, target, fov) { fly = { pos: pos.clone(), target: target.clone(), fov }; }
  function setCam(k, instant) {
    const c = CAMS[k], pos = new THREE.Vector3(...c.pos), t = new THREE.Vector3(...c.target);
    if (instant) { camera.position.copy(pos); controls.target.copy(t); camera.fov = c.fov; camera.updateProjectionMatrix(); }
    else flyTo(pos, t, c.fov);
    document.querySelectorAll("[data-cam]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cam === String(k))));
  }
  document.getElementById("cams").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.all) { isolate(null, false); return; }
    setCam(+b.dataset.cam);
  });
  controls.addEventListener("start", () => { fly = null; document.querySelectorAll("[data-cam]").forEach(b => b.setAttribute("aria-pressed", "false")); });
  setCam(1, true);

  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); film.setSize(w, h); camera.aspect = w / h; camera.zoom = Math.min(1, camera.aspect / 1.2); camera.updateProjectionMatrix(); }  // portrait screens: widen the view so the whole stage fits
  addEventListener("resize", resize); resize();

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.1, clock.getDelta()), t = clock.elapsedTime;
    windU.value = t;
    tickPeople(t);
    if (!reduce) { armParts[1].rotation.x = Math.sin(t * 2.2) * 0.22; armParts[0].rotation.x = Math.sin(t * 2.2 + 1) * 0.14; }
    meshes.forEach(m => { const g = m.userData.goal; if (Math.abs(m.material.opacity - g) > 0.002) { m.material.opacity += (g - m.material.opacity) * (reduce ? 1 : 1 - Math.exp(-dt * 8)); m.material.depthWrite = m.material.opacity > 0.5; } });
    if (fly) {
      const k = reduce ? 1 : 1 - Math.exp(-dt * 3.2);
      camera.position.lerp(fly.pos, k); controls.target.lerp(fly.target, k);
      camera.fov += (fly.fov - camera.fov) * k; camera.updateProjectionMatrix();
      if (camera.position.distanceTo(fly.pos) < 0.02) fly = null;
    }
    controls.update(); film.render(t);
  });
  window.__scene = { root, isolate, setCam, view: (pos, target) => { fly = null; camera.position.copy(pos); controls.target.copy(target); camera.fov = 40; camera.updateProjectionMatrix(); } };
})();
</script>
