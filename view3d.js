/* view3d.js — interactive massing: the trimmed plates, the envelope ghost, balconies and roof access, plus context.
   Context parcels are real City geometry; the buildings on them are a stated guess of existing condition (see CONTEXT.method);
   street and lane widths are the measured gaps; trees are placed along the measured street edges (guessed positions). */
window.VIEW3D = (function () {
  const T = window.THREE; let renderer, scene, camera, controls, group, host, ro, raf;
  const opts = { context: true, trees: true };
  const COL = { paper: 0xf4f4f1, parcel: 0xf9f9f7, street: 0xdcdde0, lane: 0xe6e7ea, ctx: 0xe9eaec, ctxEdge: 0x9a9ea5, mass: 0xffffff, edge: 0x1c1f24, ghost: 0x8a8f96, acc: 0x1f4fd8, tree: 0x9fb8a0, trunk: 0x8b7d6b, pad: 0xf7f7f8 };
  const V = (x, y, z) => new T.Vector3(x, z, -y); // local (x along frontage, y depth, z up) → three

  function ensure() {
    if (renderer) return;
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(36, 1, 0.5, 2000);
    const hemi = new T.HemisphereLight(0xffffff, 0xd8d8d4, 0.95); scene.add(hemi);
    const dir = new T.DirectionalLight(0xffffff, 0.35); dir.position.set(-60, 120, 80); scene.add(dir);
    controls = new T.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI / 2 - 0.05; controls.minDistance = 15; controls.maxDistance = 400; controls.screenSpacePanning = false;
    resetCamera();
    const loop = () => { raf = requestAnimationFrame(loop); if (!host || !host.isConnected) return; controls.update(); renderer.render(scene, camera); };
    loop();
  }
  let sceneScale = 60;
  function resetCamera(target) {
    const t = target || new T.Vector3(0, 8, 0); const k = sceneScale / 60;
    camera.position.copy(t.clone().add(new T.Vector3(-70 * k, 62 * k, 96 * k)));
    controls.target.copy(t); controls.update();
  }
  function mount(el) {
    ensure(); host = el; el.innerHTML = ''; el.appendChild(renderer.domElement);
    const bar = document.createElement('div'); bar.className = 'v3d-bar';
    bar.innerHTML = `<label><input type="checkbox" id="v3d-ctx" ${opts.context ? 'checked' : ''}> context</label><label><input type="checkbox" id="v3d-trees" ${opts.trees ? 'checked' : ''}> trees</label><button id="v3d-reset" class="btn small">Reset view</button><span class="v3d-hint">drag to orbit · scroll to zoom · right-drag to pan</span>`;
    el.appendChild(bar);
    bar.querySelector('#v3d-ctx').onchange = e => { opts.context = e.target.checked; window.APP.refresh(); };
    bar.querySelector('#v3d-trees').onchange = e => { opts.trees = e.target.checked; window.APP.refresh(); };
    bar.querySelector('#v3d-reset').onclick = () => resetCamera();
    const cap = document.createElement('div'); cap.className = 'v3d-cap'; cap.id = 'v3d-cap'; el.appendChild(cap);
    if (ro) ro.disconnect(); ro = new ResizeObserver(fit); ro.observe(el); fit();
  }
  function fit() { if (!host) return; const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px'; camera.aspect = w / h; camera.updateProjectionMatrix(); }

  // ---- geometry helpers ----
  function shapeOf(ring) { const s = new T.Shape(); ring.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); s.closePath(); return s; }
  /** extrude a plan polygon (x,y) between z0 and z1; returns group with mesh + edges */
  function prism(ring, z0, z1, color, edgeColor, edgeW, opacity) {
    const g = new T.Group(); if (!ring || ring.length < 3 || z1 - z0 <= 0) return g;
    const geo = new T.ExtrudeGeometry(shapeOf(ring), { depth: z1 - z0, bevelEnabled: false });
    // ExtrudeGeometry extrudes along +Z of shape space; rotate so shape (x,y) maps to (x, -y) ground and extrusion to up
    const mat = new T.MeshLambertMaterial({ color, transparent: opacity != null, opacity: opacity == null ? 1 : opacity });
    const mesh = new T.Mesh(geo, mat); mesh.rotation.x = -Math.PI / 2; mesh.position.y = z0; g.add(mesh);
    if (edgeColor != null) { const eg = new T.EdgesGeometry(geo, 20); const ln = new T.LineSegments(eg, new T.LineBasicMaterial({ color: edgeColor, linewidth: edgeW || 1 })); ln.rotation.x = -Math.PI / 2; ln.position.y = z0; g.add(ln); }
    return g;
  }
  function flat(ring, z, color, edgeColor) {
    const g = new T.Group(); if (!ring || ring.length < 3) return g;
    const geo = new T.ShapeGeometry(shapeOf(ring)); const mesh = new T.Mesh(geo, new T.MeshBasicMaterial({ color })); mesh.rotation.x = -Math.PI / 2; mesh.position.y = z; g.add(mesh);
    if (edgeColor != null) { const pts = ring.map(p => V(p[0], p[1], z + 0.01)); pts.push(pts[0].clone()); g.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: edgeColor }))); }
    return g;
  }
  function dashedBox(ring, z0, z1, color) {
    const g = new T.Group(); const pts = [];
    const n = ring.length;
    for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; pts.push(V(a[0], a[1], z1), V(b[0], b[1], z1)); pts.push(V(a[0], a[1], z0), V(a[0], a[1], z1)); }
    const geo = new T.BufferGeometry().setFromPoints(pts); const ln = new T.LineSegments(geo, new T.LineDashedMaterial({ color, dashSize: 1.2, gapSize: 0.8 })); ln.computeLineDistances(); g.add(ln); return g;
  }

  /** rebuild the scene for a model */
  function update(m, site, I, r) {
    ensure(); if (group) { scene.remove(group); group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose && o.material.dispose(); }); }
    group = new T.Group(); scene.add(group);
    if (!m || !m.ok) { if (host) document.getElementById('v3d-cap').textContent = m ? m.error : ''; return; }
    const fr = m.Env.fr, lot = fr.local;
    // ground and lot
    group.add(flat([[-200, -200], [200, -200], [200, 200], [-200, 200]], -0.05, COL.paper));
    group.add(flat(lot, 0, COL.parcel, COL.edge));
    // streets and lanes: strips outward from the site's classified edges by the measured gap
    const sides = site.sides || [];
    const n = lot.length; let si = 0;
    for (let i = 0; i < n; i++) {
      const cls = fr.ecls[i]; if (cls !== 'street' && cls !== 'lane' && cls !== 'open') continue;
      const a = lot[i], b = lot[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 3) continue;
      const nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L;
      const sd = sides.find(s => s.cls === cls && s.gap != null); const gap = sd ? sd.gap : (cls === 'lane' ? 6.1 : 20.1);
      const ext = 60; const A = [a[0] - (b[0] - a[0]) / L * ext, a[1] - (b[1] - a[1]) / L * ext], B = [b[0] + (b[0] - a[0]) / L * ext, b[1] + (b[1] - a[1]) / L * ext];
      group.add(flat([A, B, [B[0] + nx * gap, B[1] + ny * gap], [A[0] + nx * gap, A[1] + ny * gap]], -0.03, cls === 'lane' ? COL.lane : COL.street));
      // trees along streets: boulevard 2.5 m out, every 9 m
      if (opts.trees && cls === 'street') for (let t = 4.5; t < L - 2; t += 9) {
        const px = a[0] + (b[0] - a[0]) / L * t + nx * 2.5, py = a[1] + (b[1] - a[1]) / L * t + ny * 2.5;
        const trunk = new T.Mesh(new T.CylinderGeometry(0.15, 0.2, 3.2, 6), new T.MeshLambertMaterial({ color: COL.trunk })); trunk.position.copy(V(px, py, 1.6)); group.add(trunk);
        const can = new T.Mesh(new T.SphereGeometry(2.3, 10, 8), new T.MeshLambertMaterial({ color: COL.tree })); can.position.copy(V(px, py, 5.2)); group.add(can);
      }
    }
    // context parcels and guessed buildings
    if (opts.context && window.CONTEXT) {
      const C = window.CONTEXT, [ox, oy] = C.origin; const siteIds = new Set(site.ids); const sitePoly = lot;
      const inside = (p) => { let c = false; for (let i = 0, j = sitePoly.length - 1; i < sitePoly.length; j = i++) { const pi = sitePoly[i], pj = sitePoly[j]; if (((pi[1] > p[1]) !== (pj[1] > p[1])) && (p[0] < (pj[0] - pi[0]) * (p[1] - pi[1]) / (pj[1] - pi[1]) + pi[0])) c = !c; } return c; };
      C.items.forEach(it => {
        const ring = it.ring.map(q => fr.T([ox + q[0] / 10, oy + q[1] / 10]));
        const cx = ring.reduce((s, q) => s + q[0], 0) / ring.length, cy = ring.reduce((s, q) => s + q[1], 0) / ring.length;
        if (Math.hypot(cx, cy) > 95) return; if (inside([cx, cy])) return;
        group.add(flat(ring, -0.01, COL.parcel, 0xc9ccd1));
        if (it.fp) group.add(prism(it.fp.map(q => fr.T([ox + q[0] / 10, oy + q[1] / 10])), 0, it.h, COL.ctx, COL.ctxEdge));
      });
    }
    // envelope ghost
    const gN = m.ghost ? m.ghost.N : m.N; const topZ = (m.ghost ? m.ghost.plates : m.plates)[gN - 1].z1;
    group.add(dashedBox(m.Env.env, 0, topZ, COL.ghost));
    // plates
    m.plates.forEach(p => group.add(prism(p.poly, p.z0, p.z1, COL.mass, COL.edge)));
    // balconies
    if (m.balcony) m.balcony.pads.forEach(q => group.add(prism([[q.x0, q.y0], [q.x1, q.y0], [q.x1, q.y1], [q.x0, q.y1]], q.z - 0.15, q.z, COL.pad, COL.edge)));
    // roof access
    const mv = window.MASS.moves;
    if (mv.roofAccess.on) { const top = m.plates[m.N - 1]; const c = top.poly.reduce((a, q) => [a[0] + q[0] / top.poly.length, a[1] + q[1] / top.poly.length], [0, 0]); const w = mv.roofAccess.w / 2, d = mv.roofAccess.d / 2; group.add(prism([[c[0] - w, c[1] - d], [c[0] + w, c[1] - d], [c[0] + w, c[1] + d], [c[0] - w, c[1] + d]], top.z1, top.z1 + mv.roofAccess.h, COL.mass, COL.edge)); }
    // caption
    if (host) document.getElementById('v3d-cap').textContent = `${m.N} storeys · ${Math.round(m.gross).toLocaleString('en-CA')} m² gross${m.fit ? ' · trimmed to permitted floor area; dashed = envelope' : ''}${opts.context ? ' · context buildings are a guess of existing condition (heights by zoning); street and lane widths measured' : ''}${opts.trees ? ' · trees guessed at 9 m along the street' : ''}`;
    fit();
    const newScale = Math.max(55, 1.35 * Math.max(m.Env.width, m.Env.depth, topZ)); const changed = Math.abs(newScale - sceneScale) > 1e-6; sceneScale = newScale;
    if (changed || !update.seen) { update.seen = true; resetCamera(new T.Vector3(0, Math.min(8, topZ / 2), 0)); }
  }
  return { mount, update, opts, get renderer() { return renderer; } };
})();
