/* presentation-drawing.js: the axonometric drawing language for the presentation view (after the reference sheets and the
   graphic designer's spec): a quiet off-white context in light grey line, calm ground surfaces, the proposal the only toned
   object (a subtle building colour, not a material sample) with crisp parapets, roofs and core overruns, and illustrative
   entourage for scale: branching line trees, grey silhouette people, simple sedans and slim street lights, each with a soft
   ground shadow. Everything is placed from the design and the site polygon: nothing here edits the design, and nothing is
   invented that the data does not hold (no balconies, no roof plant). */
(function (root) {
  'use strict';
  const random = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const cache = {};
  // line hierarchy: proposal darkest, context light grey, entourage lightest (drawn into its own textures)
  const INK = 0x3a3836, CONTEXT_INK = 0xa3a29d, CAR_INK = 0xb3b2ad;
  // the sun used by the renderer, as a plan direction: shadows fall away from it
  const SHADOW_DIR = (() => { const x = 60, y = 40, l = Math.hypot(x, y); return [x / l, y / l]; })();

  // ---------- textures, generated once, repeated in world metres (ground and wall UVs are metres) ----------
  function canvas(w, h, draw) { const c = root.document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
  function tex(key, metres, draw, size = 256) {
    const T = root.THREE;
    if (!root.document) return null; // headless tests: flat colour only
    if (!cache[key]) cache[key] = canvas(size, size, (g, s) => draw(g, s));
    const t = new T.CanvasTexture(cache[key]); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1 / metres, 1 / metres);
    t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.anisotropy = 8; t.encoding = T.sRGBEncoding; return t;
  }
  const stipple = (key, bg, dot, n, metres) => tex(key, metres, (g, s) => { g.fillStyle = bg; g.fillRect(0, 0, s, s); const rand = random(key.length * 977); g.fillStyle = dot; for (let i = 0; i < n; i++) { const r = .45 + rand() * .7; g.beginPath(); g.arc(rand() * s, rand() * s, r, 0, 7); g.fill(); } });
  const grid = (key, bg, line, metres) => tex(key, metres, (g, s) => { g.fillStyle = bg; g.fillRect(0, 0, s, s); g.strokeStyle = line; g.lineWidth = 1.2; g.beginPath(); g.moveTo(.6, 0); g.lineTo(.6, s); g.moveTo(0, .6); g.lineTo(s, .6); g.stroke(); });
  const hatch = (key, bg, line, metres, gap) => tex(key, metres, (g, s) => { g.fillStyle = bg; g.fillRect(0, 0, s, s); g.strokeStyle = line; g.lineWidth = 1; for (let x = -s; x < 2 * s; x += gap) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + s, s); g.stroke(); } });
  // about 2% luminance noise, so a painted wall is not CG-flat; multiplied by the wall colour
  const grain = key => tex(key, 3, (g, s) => { const img = g.createImageData(s, s), rand = random(53); for (let i = 0; i < s * s; i++) { const v = 250 + Math.round((rand() - .5) * 10); img.data.set([v, v, v, 255], i * 4); } g.putImageData(img, 0, 0); }, 128);

  // Surfaces. Lambert keeps shading flat and honest; no environment reflections in a drawing.
  function surfaces() {
    const T = root.THREE, lam = (color, map) => new T.MeshLambertMaterial({ color, map: map || null }), off = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, side: T.DoubleSide };
    return {
      asphalt: lam(0xebeae5),
      lawn: lam(0xffffff, stipple('lawn', '#f4f3ef', '#a9a8a2', 300, 3)),
      lawnSite: lam(0xffffff, stipple('lawn-site', '#f2f1ed', '#9a9993', 520, 3)),
      paving: lam(0xffffff, grid('paving', '#f3f2ee', '#dddcd6', 1.2)),
      path: lam(0xffffff, grid('path', '#eceae5', '#cfcdc7', .6)),
      terrace: lam(0xffffff, grid('terrace', '#efede8', '#d2d0ca', .6)),
      contextWall: new T.MeshLambertMaterial({ color: 0xf7f6f2, ...off }),
      contextRoof: new T.MeshLambertMaterial({ color: 0xffffff, map: hatch('roof', '#f1f0ec', '#cfceC8', 3, 34), ...off }),
      contextFlat: new T.MeshLambertMaterial({ color: 0xf3f2ee, ...off }),
      curb: lam(0xdddcd6), fence: lam(0xf6f5f1), ink: new T.LineBasicMaterial({ color: INK }), contextInk: new T.LineBasicMaterial({ color: CONTEXT_INK }), carInk: new T.LineBasicMaterial({ color: CAR_INK }),
      shadow: new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    };
  }
  // The proposal's colour: a quiet building tone with a darker base, a light coping and dark frames. Not a material sample.
  const PALETTES = {
    clay: { label: 'Warm clay', wall: 0xcbbcab, base: 0xab9b8c, coping: 0xebe5dc, glass: 0xc4ccce, frame: 0x5c534c, roof: 0xe6e2da },
    sage: { label: 'Sage stone', wall: 0xb9bfb3, base: 0x949b90, coping: 0xe4e6e0, glass: 0xc4ccce, frame: 0x4e544e, roof: 0xe1e2dc },
    charcoal: { label: 'Soft charcoal', wall: 0x76726d, base: 0x5d5955, coping: 0xaaa59e, glass: 0xb6c0c3, frame: 0x2e2c2a, roof: 0xdcdad4 },
    white: { label: 'White study model', wall: 0xf5f4f0, base: 0xe6e4de, coping: 0xffffff, glass: 0xc9cfd0, frame: 0x8d8f8c, roof: 0xeeede9 }
  };
  function cladding(kind) {
    const T = root.THREE, c = PALETTES[kind] || PALETTES.clay, map = grain('grain'), face = color => new T.MeshLambertMaterial({ color, map, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const wall = face(c.wall), plinth = face(c.base);
    wall.userData.finish = plinth.userData.finish = 'paint';
    return { wall, plinth, frame: new T.MeshLambertMaterial({ color: c.frame }), coping: new T.MeshLambertMaterial({ color: c.coping }), roof: new T.MeshLambertMaterial({ color: c.roof, map }), glass: new T.MeshLambertMaterial({ color: c.glass, side: T.DoubleSide }), label: c.label };
  }

  // ---------- geometry helpers (plan x, y and height z to three's x, z-up, -y) ----------
  const V = p => new root.THREE.Vector3(p[0], p[2], -p[1]);
  function prism(poly, z, h, mat, parent, tag) { const T = root.THREE, shape = new T.Shape(); poly.forEach((p, i) => i ? shape.lineTo(...p) : shape.moveTo(...p)); shape.closePath(); const mesh = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }), mat); mesh.rotation.x = -Math.PI / 2; mesh.position.y = z; mesh.castShadow = mesh.receiveShadow = true; if (tag) mesh.userData.detail = tag; parent.add(mesh); return mesh; }
  const rectPts = q => [[q.x, q.y], [q.x + q.w, q.y], [q.x + q.w, q.y + q.h], [q.x, q.y + q.h]];
  function box(q, z, h, mat, parent, tag) { return prism(rectPts(q), z, h, mat, parent, tag); }
  // ---------- linework: real line weights in screen pixels ----------
  // WebGL draws every line one pixel wide, so the drawing had one weight for everything. Each segment here is a quad
  // expanded in screen space by a tiny shader, so weights are set in pixels like a pen set, and scale with the image
  // height (defined at 900 px) so an exported sheet keeps the same hierarchy.
  const STYLE = {
    profile: { width: 2.6, color: 0x2b2a28 },   // the building's outline: corners, roof and terrace edges, ground line
    edge: { width: 1.6, color: 0x33312f },      // steps and solids: setbacks, parapet ends, overruns, canopy
    detail: { width: 1.0, color: 0x5a5753 },    // windows, coping, rails
    fine: { width: .6, color: 0xb2b0aa },       // the parapet's inner edge: wall thickness, only legible up close
    context: { width: .9, color: 0x9d9c97 },    // neighbouring buildings
    property: { width: 1.3, color: 0x3a3836 }   // the property line, dashed
  };
  const FAT = new Set();
  const FAT_VS = `attribute vec3 aEnd; attribute float aSide; attribute float aT; uniform vec2 uRes; uniform float uWidth; varying float vA;
    void main(){ vec4 va=modelViewMatrix*vec4(position,1.0), vb=modelViewMatrix*vec4(aEnd,1.0);
      // lift the line 5 cm toward the eye so it never fights its own face, yet a wall (a parapet, ~0.3 m) still hides what lies behind it
      if(projectionMatrix[2][3]<-0.5){va.xyz*=1.0-0.05/max(length(va.xyz),0.1);vb.xyz*=1.0-0.05/max(length(vb.xyz),0.1);}else{va.z+=0.05;vb.z+=0.05;}
      vec4 a=projectionMatrix*va; vec4 b=projectionMatrix*vb;
      vec2 sa=a.xy/a.w, sb=b.xy/b.w; vec2 d=(sb-sa)*uRes; float L=length(d); vec2 dir=L>1e-6?d/L:vec2(1.0,0.0); vec2 n=vec2(-dir.y,dir.x);
      float w0=uWidth*uRes.y/900.0, w=max(w0,1.0); vA=min(1.0,w0); vec4 p=aT<0.5?a:b; p.xy+=(n*aSide+dir*(aT<0.5?-0.5:0.5))*w/uRes*p.w; gl_Position=p; }`;
  // a weight under a pixel is drawn one pixel wide and proportionally fainter, so it never drops out between pixels
  const FAT_FS = `uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ gl_FragColor=vec4(uColor,uOpacity*vA); }`;
  // flat: three-space coordinates, two points (six numbers) per segment
  function fat(flat, style, tag) {
    const T = root.THREE, n = flat.length / 6, P = new Float32Array(n * 12), E = new Float32Array(n * 12), S = new Float32Array(n * 4), Tt = new Float32Array(n * 4), idx = [];
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { const v = i * 4 + k; for (let j = 0; j < 3; j++) { P[v * 3 + j] = flat[i * 6 + j]; E[v * 3 + j] = flat[i * 6 + 3 + j]; } S[v] = k % 2 ? 1 : -1; Tt[v] = k < 2 ? 0 : 1; if (k === 3) idx.push(v - 3, v - 2, v - 1, v - 1, v - 2, v); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('aEnd', new T.BufferAttribute(E, 3)); g.setAttribute('aSide', new T.BufferAttribute(S, 1)); g.setAttribute('aT', new T.BufferAttribute(Tt, 1)); g.setIndex(idx);
    const m = new T.ShaderMaterial({ vertexShader: FAT_VS, fragmentShader: FAT_FS, uniforms: { uRes: { value: new T.Vector2(1600, 900) }, uWidth: { value: style.width }, uColor: { value: new T.Color(style.color) }, uOpacity: { value: style.opacity ?? 1 } }, transparent: true, side: T.DoubleSide });
    FAT.add(m); const mesh = new T.Mesh(g, m); mesh.frustumCulled = false; mesh.userData.detail = tag; mesh.userData.fatLine = true; return mesh;
  }
  // the renderer's drawing-buffer size, for every line material (call before each render and before an export)
  function resolution(renderer) { const T = root.THREE, s = renderer.getDrawingBufferSize(new T.Vector2()); for (const m of FAT) m.uniforms.uRes.value.copy(s); }
  const flatOf = list => list.flatMap(([a, b]) => [...V(a).toArray(), ...V(b).toArray()]);
  // Edges of meshes, in three space. dropBottom leaves out edges lying along a solid's base (a parapet sits on the wall:
  // its base is not a line on the facade).
  function edgesOf(meshes, angle = 20, dropBottom = false) {
    const T = root.THREE, v = [];
    for (const m of meshes) { m.updateMatrixWorld(true); const e = new T.EdgesGeometry(m.geometry, angle), p = e.attributes.position, pts = []; for (let i = 0; i < p.count; i++) pts.push(new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)); e.dispose();
      const low = Math.min(...pts.map(q => q.y)); for (let i = 0; i < pts.length; i += 2) { const a = pts[i], b = pts[i + 1]; if (dropBottom && a.y < low + 1e-3 && b.y < low + 1e-3) continue; v.push(a.x, a.y, a.z, b.x, b.y, b.z); } }
    return v;
  }
  function outline(meshes, mat, tag, angle = 20) { const T = root.THREE, g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(edgesOf(meshes, angle), 3)); const l = new T.LineSegments(g, mat); l.userData.detail = tag; return l; }
  // swap a LineSegments child (by tag) for weighted linework
  function fatten(parent, tag, style) { const old = parent.children.find(q => q.isLineSegments && q.userData.detail === tag); if (!old) return null; const mesh = fat([...old.geometry.attributes.position.array], style, tag); parent.remove(old); old.geometry.dispose(); parent.add(mesh); return mesh; }
  // the property line: a long-dash, short-gap line on the lot boundary, just above the ground
  function propertyLine(lot, parent) {
    if (!lot?.length) return null; const list = [];
    for (let i = 0; i < lot.length; i++) { const a = lot[i], b = lot[(i + 1) % lot.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let t = 0; t < L; t += 2.4) { const t1 = Math.min(L, t + 1.6), f = s => [a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L, .12]; list.push([f(t), f(t1)]); } }
    const mesh = fat(flatOf(list), STYLE.property, 'property-line'); parent.add(mesh); return mesh;
  }
  // a soft ground shadow: a flat ellipse, rotated to lie along the plan direction (dx, dy)
  function groundShadow(parent, mats, x, y, rx, ry, opacity, dir = SHADOW_DIR) {
    const T = root.THREE, m = mats.shadow.clone(); m.opacity = opacity;
    const mesh = new T.Mesh(new T.CircleGeometry(1, 32), m); mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = Math.atan2(dir[1], dir[0]); mesh.scale.set(rx, ry, 1); mesh.position.copy(V([x, y, .1])); mesh.userData.detail = 'ground-shadow'; mesh.renderOrder = 1; parent.add(mesh); return mesh;
  }

  // ---------- the proposal's roofs, parapets, terraces, overruns, canopy and its own linework ----------
  const FLIP = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
  const allEdges = l => root.CORRIDOR_NETWORK.boundaries(l.g.built, { ...l.o, edges: { front: true, rear: true, left: true, right: true } });
  // The parts of a plate edge with open roof behind them (not under the floor above), as [from, to] along the edge.
  function openSpans(e, above) {
    const horizontal = ['top', 'bottom'].includes(e.side), inward = ['top', 'left'].includes(e.side) ? 1 : -1, off = e.v + inward * .3, cover = [];
    for (const q of above) { const inn = horizontal ? off > q.y && off < q.y + q.h : off > q.x && off < q.x + q.w; if (!inn) continue; const lo = horizontal ? q.x : q.y, hi = lo + (horizontal ? q.w : q.h), a = Math.max(e.a, lo), b = Math.min(e.z, hi); if (b > a) cover.push([a, b]); }
    cover.sort((p, q) => p[0] - q[0]); const out = []; let x = e.a;
    for (const [lo, hi] of cover) { if (lo > x + .05) out.push([x, lo]); x = Math.max(x, hi); }
    if (e.z > x + .05) out.push([x, e.z]); return out;
  }
  // The top roof gets a parapet with a coping. A terrace (open roof below a higher floor) gets pavers and a guard: posts, a
  // top rail and a light glass infill, on every open edge including the short sides against the floor above.
  function roofs(r, levels, mats, parent, zOf, hOf) {
    const F = root.FLOOR_DESIGN, T = root.THREE, added = [], rails = [], outer = [], inner = [], last = levels.length - 1;
    const glass = new T.MeshBasicMaterial({ color: 0xdde4e5, transparent: true, opacity: .4, side: T.DoubleSide, depthWrite: false });
    levels.forEach((l, i) => {
      const z = zOf(l) + hOf(l), above = levels[i + 1]?.g.built || [], terrace = i < last;
      let exposed = l.g.built; for (const q of above) exposed = exposed.flatMap(p => F.subtract(p, q));
      // roof surfaces stop 3 cm short of the walls so their edges never sit on the facade plane (a light seam)
      for (const p of exposed) if (p.w > .1 && p.h > .1) added.push(box({ x: p.x + .03, y: p.y + .03, w: p.w - .06, h: p.h - .06 }, z, .03, terrace ? mats.terrace : mats.gravel, parent, terrace ? 'terrace' : 'roof-gravel'));
      for (const e of allEdges(l)) for (let [s0, s1] of openSpans(e, above)) {
        const horizontal = ['top', 'bottom'].includes(e.side), inward = ['top', 'left'].includes(e.side) ? 1 : -1;
        if (!terrace) {
          const t = .2, q = horizontal ? { x: s0, y: inward > 0 ? e.v : e.v - t, w: s1 - s0, h: t } : { x: inward > 0 ? e.v : e.v - t, y: s0, w: t, h: s1 - s0 };
          added.push(box(q, z, 1.07, mats.wall, parent, 'parapet'));
          added.push(box(q, z + 1.07, .06, mats.coping, parent, 'coping'));
          // one line for the parapet's outer top edge and a fine one for its inner edge (the wall's thickness), the inner
          // one stopped short at corners so the two edges of a corner do not cross into stubs
          const top = z + 1.13, at = (a, off) => horizontal ? [a, e.v + inward * off, top] : [e.v + inward * off, a, top], i0 = s0 <= e.a + .01 ? s0 + t : s0, i1 = s1 >= e.z - .01 ? s1 - t : s1;
          outer.push([at(s0, 0), at(s1, 0)]); if (i1 > i0) inner.push([at(i0, t), at(i1, t)]);
          continue;
        }
        // the guard sits 8 cm in; at a plate corner both runs stop at the same point, so the corner has one post
        const at = e.v + inward * .08, pt = (a, h) => horizontal ? [a, at, z + h] : [at, a, z + h];
        if (s0 <= e.a + .01) s0 += .08; if (s1 >= e.z - .01) s1 -= .08; const n = Math.max(1, Math.ceil((s1 - s0) / 1.5));
        rails.push([pt(s0, 1.07), pt(s1, 1.07)]);
        for (let k = 0; k <= n; k++) { const a = s0 + (s1 - s0) * k / n; rails.push([pt(a, .03), pt(a, 1.07)]); }
        const pane = new T.Mesh(new T.PlaneGeometry(s1 - s0, .95), glass); pane.position.copy(V(pt((s0 + s1) / 2, .58))); if (!horizontal) pane.rotation.y = Math.PI / 2; pane.userData.detail = 'terrace-guard'; parent.add(pane);
      }
    });
    // stair and lift overruns on the top roof
    const top = levels[last], zt = zOf(top) + hOf(top);
    for (const c of top.g.cores.filter(q => !q.exterior)) added.push(box(c, zt, c.kind === 'elevator' ? 1.8 : 3.0, mats.wall, parent, 'overrun'));
    added.rails = rails; added.parapetOuter = outer; added.parapetInner = inner; return added;
  }
  function canopy(entrance, mats, parent) {
    if (!entrance) return [];
    const s = entrance.side, w = 3.6, d = 1.5, q = s === 'top' ? { x: entrance.x - w / 2, y: entrance.y - d, w, h: d } : s === 'bottom' ? { x: entrance.x - w / 2, y: entrance.y, w, h: d } : s === 'left' ? { x: entrance.x - d, y: entrance.y - w / 2, w: d, h: w } : { x: entrance.x, y: entrance.y - w / 2, w: d, h: w };
    return [box(q, 3.0, .15, mats.coping, parent, 'canopy')];
  }
  // The proposal's ink, in three weights. Profile: plate corners, the ground line and terrace edges (the parapet carries the
  // roof outline). Edge: where a face steps out over the floor below, parapet and overrun solids, the canopy. Detail: the
  // band over the ground floor, the parapet's inner edge, terrace rails. Windows are carried by their frames, not outlined twice. No line at every floor: it reads as stacked boxes.
  // Where two solids merge on one flat face (a stair overrun flush with the facade and its parapet, a parapet running into
  // an overrun) their own outlines would draw a seam across a plain wall. Each line is sampled along its length; at each
  // sample the four quadrants around it are tested for solid. One solid quadrant is an outside corner and three an inside
  // crease (an overrun meeting the roof): kept. Two side by side is a flat face, and none or all four is no edge: dropped.
  // Solids: every floor's built rectangles over its height, and the parapet, overrun and canopy boxes. In three space.
  function merged(levels, zOf, hOf, extra) {
    const T = root.THREE, boxes = [], E = .06;
    for (const l of levels) { const z0 = zOf(l), z1 = z0 + hOf(l); for (const b of l.g.built || []) boxes.push([b.x, z0, -(b.y + b.h), b.x + b.w, z1, -b.y]); }
    for (const m of extra) if (['parapet', 'overrun', 'canopy'].includes(m.userData?.detail)) { const k = new T.Box3().setFromObject(m); boxes.push([k.min.x, k.min.y, k.min.z, k.max.x, k.max.y, k.max.z]); }
    const solid = (x, y, z) => boxes.some(b => x > b[0] && x < b[3] && y > b[1] && y < b[4] && z > b[2] && z < b[5]);
    const seen = (p, u, w) => { let n = 0, a = false, c = false; for (const [s, t] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) { const q = solid(p[0] + E * (s * u[0] + t * w[0]), p[1] + E * (s * u[1] + t * w[1]), p[2] + E * (s * u[2] + t * w[2])); n += q; } return n === 1 || n === 3; };
    return flat => {
      const out = [];
      for (let i = 0; i < flat.length; i += 6) {
        const a = flat.slice(i, i + 3), b = flat.slice(i + 3, i + 6), d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d); if (L < 1e-6) continue;
        const ax = Math.abs(d[0]) / L > .99 ? 0 : Math.abs(d[1]) / L > .99 ? 1 : Math.abs(d[2]) / L > .99 ? 2 : -1;
        if (ax < 0) { out.push(...a, ...b); continue; } // not axis-aligned (none in a plate-built proposal): left as drawn
        const u = [0, 0, 0], w = [0, 0, 0]; u[(ax + 1) % 3] = 1; w[(ax + 2) % 3] = 1;
        // sample every ~0.25 m, keep the runs that read as an edge
        const n = Math.max(2, Math.ceil(L / .25)); let start = null;
        for (let k = 0; k <= n; k++) {
          const t = (k === n ? n - .5 : k + .5) / n, p = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t], keep = k < n && seen(p, u, w);
          if (keep && start == null) start = k / n;
          if ((!keep || k === n) && start != null) { const t0 = start, t1 = k / n; out.push(a[0] + d[0] * t0, a[1] + d[1] * t0, a[2] + d[2] * t0, a[0] + d[0] * t1, a[1] + d[1] * t1, a[2] + d[2] * t1); start = null; }
        }
      }
      return out;
    };
  }
  function proposalLines(r, levels, zOf, hOf, extra) {
    const profile = [], edge = [], detail = [], last = levels.length - 1;
    levels.forEach((l, i) => {
      const z = zOf(l), h = hOf(l), above = levels[i + 1]?.g.built || [], below = levels[i - 1]?.g.built || [];
      for (const e of allEdges(l)) {
        const horizontal = ['top', 'bottom'].includes(e.side), pt = (a, zz) => horizontal ? [a, e.v, zz] : [e.v, a, zz];
        const rise = i === last ? 1.13 : 0; profile.push([pt(e.a, z), pt(e.a, z + h + rise)], [pt(e.z, z), pt(e.z, z + h + rise)]);
        if (i < last) for (const [s0, s1] of openSpans(e, above)) profile.push([pt(s0, z + h), pt(s1, z + h)]);
        if (i === 0) { profile.push([pt(e.a, z), pt(e.z, z)]); if (last > 0) detail.push([pt(e.a, z + h), pt(e.z, z + h)]); }
        else {
          // a face stepping out past the floor below: an edge; a face set back behind a terrace: the crease where wall meets terrace
          for (const [s0, s1] of openSpans(e, below)) edge.push([pt(s0, z), pt(s1, z)]);
          const out = openSpans({ ...e, side: FLIP[e.side] }, below); let x = e.a; for (const [o0, o1] of out.concat([[e.z, e.z]])) { if (o0 > x + .05) edge.push([pt(x, z), pt(o0, z)]); x = Math.max(x, o1); }
        }
      }
    });
    const group = new root.THREE.Group(), by = tag => extra.filter(m => m.userData.detail === tag); group.userData.detail = 'project-outline';
    const clean = merged(levels, zOf, hOf, extra);
    group.add(fat(clean(flatOf(profile.concat(extra.parapetOuter || []))), STYLE.profile, 'project-outline'));
    group.add(fat(clean(flatOf(edge).concat(edgesOf(by('overrun').concat(by('canopy'))))), STYLE.edge, 'project-outline'));
    group.add(fat(flatOf(detail.concat(extra.rails || [])), STYLE.detail, 'project-outline'));
    if (extra.parapetInner?.length) group.add(fat(clean(flatOf(extra.parapetInner)), STYLE.fine, 'project-outline'));
    return group;
  }

  // ---------- entourage: trees, people, cars, street lights ----------
  // A billboard drawn once on a canvas of the given pixel size; w x h metres, standing on its base.
  function sprite(key, px, draw, w, h, parent, at, tag, flip) {
    const T = root.THREE; let t = null;
    if (root.document) { if (!cache[key]) { const big = canvas(px[0] * 2, px[1] * 2, draw); cache[key] = canvas(px[0], px[1], g => { g.imageSmoothingQuality = 'high'; g.drawImage(big, 0, 0, px[0], px[1]); }); } t = new T.CanvasTexture(cache[key]); t.encoding = T.sRGBEncoding; t.minFilter = T.LinearMipmapLinearFilter; }
    const m = new T.SpriteMaterial({ map: t, transparent: true, alphaTest: .1, depthWrite: true }), s = new T.Sprite(m);
    s.center.set(.5, 0); s.scale.set(flip ? -w : w, h, 1); s.position.copy(V(at)); s.userData.detail = tag; parent.add(s); return s;
  }
  // A deciduous street tree: a recursive branching structure in grey line, tapering, with small irregular leaf clusters at
  // the tips that leave a third of the branches showing. Drawn on a canvas of width W, height H (2x, downsampled).
  const drawTree = seed => (g, W, H) => {
    const rand = random(seed), r = (a, b) => a + rand() * (b - a), segs = [], tips = [];
    const grow = (x, y, ang, len, width, depth) => { const x1 = x + Math.sin(ang) * len, y1 = y - Math.cos(ang) * len; segs.push([x, y, x1, y1, width]); if (depth <= 2) tips.push([x1, y1]); if (!depth) return; const n = rand() < .45 ? 3 : 2; for (let k = 0; k < n; k++) { const spread = r(.38, .72) * (n === 3 ? [-1, 0, 1][k] : k ? 1 : -1); grow(x1, y1, ang + spread + r(-.12, .12), len * r(.7, .78), Math.max(.8, width * .62), depth - 1); } };
    segs.push([0, 0, 0, -.62, 7]); grow(0, -.62, r(-.08, .08), .5, 5, 4);
    const blobs = []; for (const [x, y] of tips) { if (rand() < .28) continue; const n = 1 + Math.floor(rand() * 2); for (let k = 0; k < n; k++) { const bx = x + r(-.12, .12), by = y + r(-.12, .1), circles = []; const m = 6 + Math.floor(rand() * 4); for (let j = 0; j < m; j++) circles.push([bx + r(-.09, .09), by + r(-.07, .07), r(.035, .075)]); blobs.push({ circles, x: bx, y: by }); } }
    // fit the drawing to the canvas
    const xs = segs.flatMap(s => [s[0], s[2]]).concat(blobs.flatMap(b => b.circles.flatMap(c => [c[0] - c[2], c[0] + c[2]]))), ys = segs.flatMap(s => [s[1], s[3]]).concat(blobs.flatMap(b => b.circles.flatMap(c => [c[1] - c[2], c[1] + c[2]])));
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), k = Math.min((W * .96) / (x1 - x0), (H * .97) / (0 - y0)), ox = W / 2 - (x0 + x1) / 2 * k, oy = H, P = (x, y) => [ox + x * k, oy + y * k], u = W / 512;
    g.lineCap = 'round'; g.strokeStyle = '#7a7974';
    for (const [ax, ay, bx, by, w] of segs) { const [p, q] = [P(ax, ay), P(bx, by)]; g.lineWidth = w * u; g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.stroke(); }
    const cx = (x0 + x1) / 2;
    blobs.sort((a, b) => a.y - b.y);
    for (const b of blobs) { const shade = b.x > cx + .05 || b.y > -1.05 ? rand() < .55 : rand() < .15; g.beginPath(); for (const [x, y, rr] of b.circles) { const [px, py] = P(x, y); g.moveTo(px + rr * k, py); g.arc(px, py, rr * k, 0, 7); } g.lineWidth = 1.6 * u; g.strokeStyle = '#9d9c96'; g.stroke(); g.fillStyle = shade ? '#efeee9' : '#ffffff'; g.fill(); }
  };
  // A narrow conifer spire: a central stem with short drooping strokes, denser toward the base, on a light grey fill.
  const drawConifer = seed => (g, W, H) => {
    const rand = random(seed), cx = W / 2, u = W / 512, top = H * .02, base = H * .9;
    g.fillStyle = '#f2f1ec'; g.beginPath(); g.moveTo(cx, top); for (let i = 0; i <= 20; i++) { const t = i / 20, y = top + t * (base - top), half = W * .46 * Math.pow(t, .85) * (1 + (rand() - .5) * .12); g.lineTo(cx + half, y); } for (let i = 20; i >= 0; i--) { const t = i / 20, y = top + t * (base - top), half = W * .46 * Math.pow(t, .85); g.lineTo(cx - half * (1 + (rand() - .5) * .12), y); } g.closePath(); g.fill();
    g.strokeStyle = '#8a8984'; g.lineCap = 'round'; g.lineWidth = 2 * u; g.beginPath(); g.moveTo(cx, top); g.lineTo(cx, H); g.stroke();
    g.lineWidth = 1.1 * u; const n = 46; for (let i = 0; i < n; i++) { const t = Math.pow(i / n, .75), y = top + t * (base - top), half = W * .44 * Math.pow(t, .85); for (const side of [-1, 1]) { const len = half * (.7 + rand() * .3); g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo(cx + side * len * .6, y - H * .004, cx + side * len, y + H * .018 * (1 + t)); g.stroke(); } }
  };
  // People: slim grey silhouettes without outlines, from capsules (head, torso, limbs), in ten variants.
  const PERSON_TONE = '#a6a5a0';
  function figure(g, x, base, h, { stride = 0, swing = 0, lean = 0, bag = false, phone = false } = {}) {
    g.strokeStyle = g.fillStyle = PERSON_TONE; g.lineCap = 'round';
    const hip = base - h * .48, neck = base - h * .82, sh = h * .12;
    g.lineWidth = h * .085; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x + s * h * .035 + lean * .5, hip); g.lineTo(x + s * stride * h * .13, base - h * .02); g.stroke(); }
    g.lineWidth = h * .19; g.beginPath(); g.moveTo(x + lean, neck + h * .07); g.lineTo(x + lean * .5, hip + h * .02); g.stroke();
    g.lineWidth = h * .055; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x + lean + s * sh * .8, neck + h * .06); g.lineTo(x + lean * .6 + s * (sh * .9 + swing * s * h * .06), hip + h * .03); g.stroke(); }
    if (phone) { g.beginPath(); g.moveTo(x + lean + sh * .8, neck + h * .06); g.lineTo(x + lean + h * .05, neck + h * .02); g.stroke(); }
    if (bag) g.fillRect(x + lean * .6 + sh * 1.1, hip - h * .02, h * .1, h * .13);
    g.beginPath(); g.arc(x + lean * 1.1, base - h * .93, h * .065, 0, 7); g.fill();
  }
  // each variant draws into a canvas that stands for SPAN x SPAN metres, so every figure keeps a true 1.55–1.85 m height
  const SPAN = 2.4, PEOPLE = [
    (g, W, H, m) => figure(g, W * .5, H, m(1.75), { stride: 1, swing: 1, bag: true }),
    (g, W, H, m) => figure(g, W * .5, H, m(1.68), { stride: -1, swing: -1 }),
    (g, W, H, m) => figure(g, W * .5, H, m(1.8), { phone: true }),
    (g, W, H, m) => { figure(g, W * .38, H, m(1.78), { stride: .6, swing: .5 }); figure(g, W * .62, H, m(1.62), { stride: .6, swing: .5 }); },
    (g, W, H, m) => { figure(g, W * .42, H, m(1.72), { stride: .8, swing: .6 }); figure(g, W * .64, H, m(1.1), { stride: .8, swing: .8 }); },
    (g, W, H, m) => { figure(g, W * .36, H, m(1.66), { stride: .7, lean: m(.06) }); g.fillStyle = PERSON_TONE; const x = W * .58, y = H - m(.95); g.beginPath(); g.ellipse(x, y, m(.32), m(.22), 0, 0, 7); g.fill(); g.lineWidth = m(.035); g.strokeStyle = PERSON_TONE; g.beginPath(); g.moveTo(W * .44, H - m(1.0)); g.lineTo(x - m(.2), y); g.stroke(); for (const d of [-.22, .22]) { g.beginPath(); g.arc(x + m(d), H - m(.12), m(.12), 0, 7); g.stroke(); } },
    (g, W, H, m) => { g.strokeStyle = PERSON_TONE; g.lineWidth = m(.04); for (const d of [-.55, .55]) { g.beginPath(); g.arc(W * .5 + m(d), H - m(.34), m(.33), 0, 7); g.stroke(); } g.beginPath(); g.moveTo(W * .5 - m(.55), H - m(.34)); g.lineTo(W * .5, H - m(.36)); g.lineTo(W * .5 + m(.45), H - m(.9)); g.lineTo(W * .5 + m(.55), H - m(.34)); g.moveTo(W * .5, H - m(.36)); g.lineTo(W * .5 - m(.15), H - m(.95)); g.stroke(); figure(g, W * .5 - m(.05), H - m(.42), m(1.3), { lean: m(.18), stride: .3 }); },
    (g, W, H, m) => { figure(g, W * .38, H, m(1.74), { stride: .8, swing: .4 }); g.fillStyle = PERSON_TONE; const x = W * .66, y = H - m(.36); g.beginPath(); g.ellipse(x, y, m(.28), m(.1), 0, 0, 7); g.fill(); g.beginPath(); g.arc(x + m(.3), y - m(.1), m(.08), 0, 7); g.fill(); g.lineWidth = m(.04); g.strokeStyle = PERSON_TONE; for (const d of [-.2, -.1, .14, .22]) { g.beginPath(); g.moveTo(x + m(d), y); g.lineTo(x + m(d), H); g.stroke(); } g.lineWidth = m(.012); g.beginPath(); g.moveTo(W * .44, H - m(.95)); g.lineTo(x + m(.28), y - m(.08)); g.stroke(); },
    (g, W, H, m) => { g.fillStyle = PERSON_TONE; figure(g, W * .5, H - m(.45), m(1.3), {}); g.fillRect(W * .5 - m(.3), H - m(.47), m(.6), m(.06)); g.fillRect(W * .5 - m(.28), H - m(.45), m(.05), m(.45)); g.fillRect(W * .5 + m(.23), H - m(.45), m(.05), m(.45)); },
    (g, W, H, m) => figure(g, W * .5, H, m(1.58), { stride: .5, swing: .3, bag: true })
  ];
  const drawPerson = k => (g, W, H) => PEOPLE[k % PEOPLE.length](g, W, H, metres => metres / SPAN * H);
  function person(k, parent, mats, x, y, z, flip) { const s = sprite('person-' + (k % PEOPLE.length), [256, 256], drawPerson(k), SPAN, SPAN, parent, [x, y, z], 'person', flip); groundShadow(parent, mats, x + SHADOW_DIR[0] * .5, y + SHADOW_DIR[1] * .5, .5, .2, .12); return s; }
  // a sedan: an extruded side profile with a tapered cabin, light fill, grey edges, dark wheels and a ground shadow
  function car(x, y, along, parent, mats, lines) {
    const T = root.THREE, shape = new T.Shape(), pts = [[-2.25, .3], [2.25, .3], [2.25, .72], [1.95, .9], [1.0, .95], [.45, 1.45], [-1.15, 1.45], [-1.75, .98], [-2.2, .92], [-2.25, .72]];
    pts.forEach((p, i) => i ? shape.lineTo(...p) : shape.moveTo(...p)); shape.closePath();
    const g = new T.Group(), body = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: 1.8, bevelEnabled: false }), mats.fence); body.position.z = -.9; body.castShadow = true; body.add(new T.LineSegments(new T.EdgesGeometry(body.geometry, 30), mats.carInk)); g.add(body);
    const wheel = new T.MeshLambertMaterial({ color: 0x6b6a66 }); for (const wx of [-1.45, 1.4]) for (const wz of [-.82, .82]) { const w = new T.Mesh(new T.CylinderGeometry(.33, .33, .2, 14), wheel); w.rotation.x = Math.PI / 2; w.position.set(wx, .33, wz); g.add(w); }
    g.position.copy(V([x, y, 0])); g.rotation.y = along; g.userData.detail = 'car'; parent.add(g);
    groundShadow(parent, mats, x + SHADOW_DIR[0] * .6, y + SHADOW_DIR[1] * .6, 2.5, 1.15, .12, [Math.cos(along), Math.sin(along)]);
  }
  // a slim street light: a thin pole and a small luminaire head over the road
  function streetLight(x, y, nx, ny, parent) { const T = root.THREE, m = new T.MeshLambertMaterial({ color: 0x8f8e89 }), pole = new T.Mesh(new T.CylinderGeometry(.035, .05, 7.5, 6), m); pole.position.copy(V([x, y, 3.75])); const arm = new T.Mesh(new T.BoxGeometry(.04, .04, 1.1), m); arm.position.copy(V([x + nx * .55, y + ny * .55, 7.45])); arm.lookAt(V([x + nx * 2, y + ny * 2, 7.45])); const head = new T.Mesh(new T.BoxGeometry(.5, .12, .22), m); head.position.copy(V([x + nx * 1.1, y + ny * 1.1, 7.4])); head.lookAt(V([x + nx * 3, y + ny * 3, 7.4])); for (const q of [pole, arm, head]) { q.userData.detail = 'street-light'; parent.add(q); } }
  function tree(parent, mats, x, y, h, seed, conifer) {
    const w = conifer ? h * .3 : h * (.6 + (seed % 4) * .05), key = conifer ? 'conifer-' + (seed % 2) : 'tree-' + (seed % 5);
    sprite(key, conifer ? [160, 512] : [384, 512], conifer ? drawConifer(seed % 2 + 41) : drawTree(seed % 5 * 17 + 3), w, h, parent, [x, y, 0], 'tree', seed % 2 === 1);
    groundShadow(parent, mats, x + SHADOW_DIR[0] * h * .6, y + SHADOW_DIR[1] * h * .6, w * .45, w * .36, .08);
  }

  // The Vancouver street section outside every street edge of the site: sidewalk, boulevard with street trees, curb,
  // parked cars and street lights, carried 30 m beyond the lot each way; an entry path from the lobby to the sidewalk.
  function streetscape(r, entrance, mats, context, trees, lines) {
    const lot = r.context?.sitePoly, edges = r.context?.siteEdges; if (!lot?.length) return;
    const centre = lot.reduce((a, p) => [a[0] + p[0] / lot.length, a[1] + p[1] / lot.length], [0, 0]), rand = random(4201);
    let n = 0, moving = false;
    for (let i = 0; i < lot.length; i++) {
      if (edges?.[i] !== 'street') continue;
      const a = lot[i], b = lot[(i + 1) % lot.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 3) continue;
      const ux = dx / L, uy = dy / L; let nx = -uy, ny = ux; if (nx * ((a[0] + b[0]) / 2 - centre[0]) + ny * ((a[1] + b[1]) / 2 - centre[1]) < 0) { nx = -nx; ny = -ny; }
      const ext = 30, P = (t, o) => [a[0] + ux * t + nx * o, a[1] + uy * t + ny * o], band = (o0, o1, z, h, mat, tag) => prism([P(-ext, o0), P(L + ext, o0), P(L + ext, o1), P(-ext, o1)], z, h, mat, context, tag), along = Math.atan2(uy, ux);
      band(0, 1.8, .02, .06, mats.paving, 'sidewalk'); band(1.8, 4.0, .02, .05, mats.lawn, 'boulevard'); band(4.0, 4.15, .02, .12, mats.curb, 'curb');
      const entryT = entrance ? ((entrance.x - a[0]) * ux + (entrance.y - a[1]) * uy) : null, nearEntry = t => entryT != null && Math.abs(t - entryT) < 3 && Math.abs((entrance.x - a[0]) * nx + (entrance.y - a[1]) * ny) < 25;
      // street trees 7–10 m apart, irregular, now and then a slot skipped
      for (let t = -ext + 4; t < L + ext - 2; t += 7 + rand() * 3) { if (nearEntry(t) || rand() < .12) continue; const [x, y] = P(t, 2.9); tree(trees, mats, x, y, 9 * (.85 + rand() * .3), n++, false); }
      for (let t = -ext + 10; t < L + ext; t += 36) { const [x, y] = P(t, 3.7); streetLight(x, y, nx, ny, context); }
      for (let t = -ext + 6; t < L + ext - 4; t += 9 + rand() * 6) if (rand() > .45 && !nearEntry(t)) { const [x, y] = P(t, 5.2); car(x, y, along + (rand() < .3 ? Math.PI : 0), context, mats, lines); }
      if (!moving) { const [x, y] = P(L * .3, 8.2); car(x, y, along + Math.PI, context, mats, lines); moving = true; }
      for (let t = -ext + 5; t < L + ext; t += 12 + rand() * 4) { if (nearEntry(t)) continue; const [x, y] = P(t, .5 + rand() * .9); person(Math.floor(rand() * 10), trees, mats, x, y, .08, rand() < .5); }
      if (entryT != null && entryT > -1 && entryT < L + 1) {
        const off = (entrance.x - a[0]) * nx + (entrance.y - a[1]) * ny, d0 = Math.min(0, off);
        prism([P(entryT - .75, d0), P(entryT + .75, d0), P(entryT + .75, 0), P(entryT - .75, 0)], .08, .02, mats.path, context, 'entry-path');
        // a small group at the entry
        [[-1.6, .7, 3], [1.4, 1.1, 0], [2.4, .4, 4]].forEach(([k, o, v]) => { const [x, y] = P(entryT + k, o); person(v, trees, mats, x, y, .1, k > 0); });
      }
    }
    // feature trees on the site, as far from the building and the street as the lot allows: one conifer, one deciduous
    const built = r.levels[0].g.built, xs = lot.map(p => p[0]), ys = lot.map(p => p[1]), pts = [];
    for (let x = Math.min(...xs) + 2; x < Math.max(...xs) - 2; x += 1.5) for (let y = Math.min(...ys) + 2; y < Math.max(...ys) - 2; y += 1.5) { if (!root.EXPLORE.inPoly([x, y], lot)) continue; const clear = Math.min(...built.map(q => Math.max(q.x - x, 0, x - q.x - q.w) + Math.max(q.y - y, 0, y - q.y - q.h))); if (clear > 3.5) pts.push([x, y, clear]); }
    pts.sort((p, q) => q[2] - p[2]);
    const picks = []; for (const p of pts) { if (picks.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) > 7)) picks.push(p); if (picks.length >= 2) break; }
    picks.forEach((p, i) => tree(trees, mats, p[0], p[1], i ? 10 : 12, i ? 2 : 0, !i));
  }

  root.PRESENTATION_DRAWING = { surfaces, cladding, PALETTES, roofs, canopy, proposalLines, streetscape, outline, prism, box, fat, fatten, propertyLine, resolution, STYLE };
})(typeof window !== 'undefined' ? window : globalThis);
