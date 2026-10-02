/* draw.js — shared drawing library. All drawings are SVG built in metres and fitted to a viewport.
   Conventions: poché fills for cut walls/slabs, dimension strings with witness lines and slash ticks, level datums,
   stairs as treads with a direction arrow, door swings, hatched ground, graphic scale bar, north arrow,
   and a 30° plan-oblique projector that fits itself to the content bounding box. */
window.DRAW = (function () {
  const NS = 'http://www.w3.org/2000/svg';
  const INK = '#111417', INK2 = '#3d434b', INK3 = '#6a7079', LW = { cut: 1.4, heavy: 1.1, edge: 0.7, fine: 0.5, hidden: 0.5 }, ACC = '#1a56db', ACC_SOFT = '#e7eefb', WARN = '#8a5a10', FAIL = '#b3261e';
  const FONT = '"Geist", system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function svg(w, h, cls) {
    const s = el('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: '100%', class: cls || 'dwg', 'font-family': FONT, 'font-size': 10 });
    s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    defs(s); return s;
  }
  function defs(s) {
    const d = el('defs', {}, s);
    // poché: solid for cut elements at these scales (convention for plans and sections under 1:200)
    const p = el('pattern', { id: 'poche', width: 4, height: 4, patternUnits: 'userSpaceOnUse' }, d);
    el('rect', { width: 4, height: 4, fill: INK }, p);
    // hatch: sparse 45° for ground and unallocated areas
    const h = el('pattern', { id: 'hatch', width: 9, height: 9, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, d);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 9, stroke: '#b4b8bf', 'stroke-width': 0.6 }, h);
    const m = el('marker', { id: 'arr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, d);
    el('path', { d: 'M0,1 L9,5 L0,9 z', fill: INK }, m);
  }
  const pts = a => a.map(p => `${r(p[0])},${r(p[1])}`).join(' ');
  const r = v => Math.round(v * 100) / 100;
  // a drawing authored on a wider viewBox declares data-text-scale (its width over the 360-unit sheet drawings), so its
  // annotation reads at the same screen size as the site plan beside it; titles size themselves (o.fixed)
  function text(s, x, y, t, o = {}) { const svg = s.ownerSVGElement || s, k = o.fixed ? 1 : +(svg.getAttribute?.('data-text-scale') || 1); const e = el('text', Object.assign({ x: r(x), y: r(y), fill: o.fill || INK, 'font-size': r((o.size || 10) * k), 'text-anchor': o.anchor || 'middle', 'dominant-baseline': o.base || 'middle', 'font-weight': o.weight || 400, transform: o.transform }, o.attrs || {}), s); e.textContent = t; return e; }

  /** drawing title: uppercase tracked label at top-left, optional note under it */
  // one title style for every drawing: 13px tracked caps and an 11px note, in screen pixels whatever the viewBox (the group is
  // scaled by --u, the drawing's units per screen pixel, set by WORKSPACE_VIEW; without it, 1 unit = 1 px)
  function title(s, t, note) { const g = el('g', { class: 'dwg-title' }, s); text(g, 14, 16, t.toUpperCase(), { anchor: 'start', size: 13, weight: 600, fill: INK, fixed: true, attrs: { 'letter-spacing': '0.06em' } }); if (note) text(g, 14, 33, note, { anchor: 'start', size: 11, fill: INK3, fixed: true }); return g; }
  /** Fitter: maps metre coords → screen with margin; keeps aspect. */
  function fitter(bbox, W, H, margin) {
    const [minx, miny, maxx, maxy] = bbox, sw = maxx - minx || 1, sh = maxy - miny || 1;
    const k = Math.min((W - 2 * margin) / sw, (H - 2 * margin) / sh);
    const ox = margin + ((W - 2 * margin) - sw * k) / 2, oy = margin + ((H - 2 * margin) - sh * k) / 2;
    return { k, x: mx => ox + (mx - minx) * k, y: my => oy + (maxy - my) * k, p: pt => [ox + (pt[0] - minx) * k, oy + (maxy - pt[1]) * k], px: pt => [ox + (pt[0] - minx) * k, oy + (pt[1] - miny) * k] };
  }
  /** fitter at a fixed scale k (px per metre), content centred */
  function fitterK(bbox, W, H, k) {
    const [minx, miny, maxx, maxy] = bbox, sw = maxx - minx || 1, sh = maxy - miny || 1;
    const ox = (W - sw * k) / 2, oy = (H - sh * k) / 2;
    return { k, x: mx => ox + (mx - minx) * k, y: my => oy + (maxy - my) * k, p: pt => [ox + (pt[0] - minx) * k, oy + (maxy - pt[1]) * k], px: pt => [ox + (pt[0] - minx) * k, oy + (pt[1] - miny) * k] };
  }
  function kFor(bbox, W, H, margin) { const sw = bbox[2] - bbox[0] || 1, sh = bbox[3] - bbox[1] || 1; return Math.min((W - 2 * margin) / sw, (H - 2 * margin) / sh); }
  function bboxOf(ptsArr) { let a = [Infinity, Infinity, -Infinity, -Infinity]; for (const p of ptsArr) { if (p[0] < a[0]) a[0] = p[0]; if (p[1] < a[1]) a[1] = p[1]; if (p[0] > a[2]) a[2] = p[0]; if (p[1] > a[3]) a[3] = p[1]; } return a; }
  function expand(b, d) { return [b[0] - d, b[1] - d, b[2] + d, b[3] + d]; }

  /** Dimension string between screen points a,b, offset perpendicular by `off` px (positive = left of a→b). */
  function dim(s, a, b, off, label, o = {}) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const a2 = [a[0] + nx * off, a[1] + ny * off], b2 = [b[0] + nx * off, b[1] + ny * off];
    const g = el('g', { class: 'dim', stroke: INK2, 'stroke-width': 0.5, fill: 'none' }, s);
    const ext = Math.sign(off) * 3;
    el('line', { x1: r(a[0] + nx * ext), y1: r(a[1] + ny * ext), x2: r(a2[0] + nx * ext), y2: r(a2[1] + ny * ext) }, g); // witness
    el('line', { x1: r(b[0] + nx * ext), y1: r(b[1] + ny * ext), x2: r(b2[0] + nx * ext), y2: r(b2[1] + ny * ext) }, g);
    el('line', { x1: r(a2[0]), y1: r(a2[1]), x2: r(b2[0]), y2: r(b2[1]) }, g);
    const tick = (p) => { const t = 2.6, ux = (dx / L + nx) / Math.SQRT2, uy = (dy / L + ny) / Math.SQRT2; el('line', { x1: r(p[0] - ux * t), y1: r(p[1] - uy * t), x2: r(p[0] + ux * t), y2: r(p[1] + uy * t), stroke: INK, 'stroke-width': 0.9 }, g); };
    tick(a2); tick(b2);
    const mx = (a2[0] + b2[0]) / 2, my = (a2[1] + b2[1]) / 2;
    let ang = Math.atan2(dy, dx) * 180 / Math.PI; if (ang > 90 || ang < -90) ang += 180;
    const side = o.textSide == null ? Math.sign(off) || 1 : o.textSide;
    const tx = mx + nx * 4.5 * side, ty = my + ny * 4.5 * side;
    text(g, tx, ty, label, { size: o.size || 8, transform: `rotate(${r(ang)} ${r(tx)} ${r(ty)})`, attrs: { stroke: 'none' }, fill: INK });
    return g;
  }
  /** Level datum: horizontal line with a target circle and label, at screen y. */
  function datum(s, x0, x1, y, label, o = {}) {
    const g = el('g', { stroke: INK2, 'stroke-width': 0.5 }, s);
    el('line', { x1: r(x0), y1: r(y), x2: r(x1), y2: r(y), 'stroke-dasharray': o.dash || null }, g);
    el('circle', { cx: r(x1), cy: r(y), r: 3, fill: '#fff', stroke: INK }, g);
    el('path', { d: `M${r(x1 - 3)},${r(y)} A3,3 0 0 1 ${r(x1)},${r(y - 3)} L${r(x1)},${r(y)} Z M${r(x1 + 3)},${r(y)} A3,3 0 0 1 ${r(x1)},${r(y + 3)} L${r(x1)},${r(y)} Z`, fill: INK, stroke: 'none' }, g);
    text(g, x1 + 6, y - 1, label, { anchor: 'start', size: o.size || 8, attrs: { stroke: 'none' }, fill: o.fill || INK });
    return g;
  }
  /** Stair in plan: rectangle at screen (x,y,w,h), treads across the short dimension, arrow along the run. */
  function stairPlan(s, x, y, w, h, o = {}) {
    const g = el('g', { class: 'stair', stroke: INK, 'stroke-width': 0.6, fill: o.fill || '#fff' }, s);
    el('rect', { x: r(x), y: r(y), width: r(w), height: r(h) }, g);
    const along = w >= h ? 'x' : 'y', n = o.treads || 12, len = along === 'x' ? w : h, step = len / n;
    for (let i = 1; i < n; i++) along === 'x' ? el('line', { x1: r(x + i * step), y1: r(y), x2: r(x + i * step), y2: r(y + h) }, g) : el('line', { x1: r(x), y1: r(y + i * step), x2: r(x + w), y2: r(y + i * step) }, g);
    if (o.scissor) { // second flight indicated by a diagonal break line
      el('line', { x1: r(x), y1: r(y), x2: r(x + w), y2: r(y + h), stroke: INK, 'stroke-width': 0.8 }, g);
    }
    const mid = along === 'x' ? [x + 3, y + h / 2, x + w - 3, y + h / 2] : [x + w / 2, y + h - 3, x + w / 2, y + 3];
    el('line', { x1: r(mid[0]), y1: r(mid[1]), x2: r(mid[2]), y2: r(mid[3]), 'marker-end': 'url(#arr)', stroke: INK, 'stroke-width': 0.9 }, g);
    return g;
  }
  /** Door swing: hinge at (hx,hy), leaf length L, direction angle a0 deg, opening 90°, dir ±1 */
  function door(s, hx, hy, L, a0, dir = 1) {
    const g = el('g', { stroke: INK, 'stroke-width': 0.6, fill: 'none' }, s);
    const a = a0 * Math.PI / 180, ex = hx + Math.cos(a) * L, ey = hy + Math.sin(a) * L;
    el('line', { x1: r(hx), y1: r(hy), x2: r(ex), y2: r(ey) }, g);
    const a1 = a + dir * Math.PI / 2, fx = hx + Math.cos(a1) * L, fy = hy + Math.sin(a1) * L;
    el('path', { d: `M${r(ex)},${r(ey)} A${r(L)},${r(L)} 0 0 ${dir > 0 ? 1 : 0} ${r(fx)},${r(fy)}`, 'stroke-width': 0.4 }, g);
    return g;
  }
  function scaleBar(s, x, y, k, o = {}) { // k = px per metre
    const g = el('g', { stroke: INK, 'stroke-width': 0.8 }, s);
    const units = o.units || [0, 5, 10, 20]; const total = units[units.length - 1];
    el('line', { x1: r(x), y1: r(y), x2: r(x + total * k), y2: r(y) }, g);
    units.forEach(u => { el('line', { x1: r(x + u * k), y1: r(y - 3), x2: r(x + u * k), y2: r(y + 3) }, g); text(g, x + u * k, y + 10, u === total ? `${u} m` : `${u}`, { size: 8, attrs: { stroke: 'none' } }); });
    for (let i = 0; i + 1 < units.length; i += 2) el('rect', { x: r(x + units[i] * k), y: r(y - 2), width: r((units[i + 1] - units[i]) * k), height: 4, fill: INK, stroke: 'none' }, g);
    return g;
  }
  function northArrow(s, x, y, angleDeg = 0) {
    const g = el('g', { transform: `translate(${r(x)} ${r(y)}) rotate(${r(angleDeg)})`, stroke: INK, 'stroke-width': 0.8 }, s);
    el('path', { d: 'M0,-14 L5,6 L0,3 L-5,6 Z', fill: '#fff' }, g); el('path', { d: 'M0,-14 L5,6 L0,3 Z', fill: INK }, g);
    text(g, 0, -20, 'N', { size: 9, weight: 600, attrs: { stroke: 'none' } });
    return g;
  }

  /** 30° plan-oblique projector. Plan rotated so its x axis runs at 30°; heights vertical, true scale.
      project([x,y,z]) → screen; fit(points3) builds the fitter from projected bbox. */
  function oblique(W, H, margin, rotDeg = 30) {
    const a = rotDeg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const raw = p => [p[0] * ca - p[1] * sa, -(p[0] * sa + p[1] * ca) * 0.82 - (p[2] || 0)]; // 0.82: mild plan compression so heights read
    let F = null;
    return {
      raw,
      fit(points3, k) { const pr = points3.map(raw); const bb = bboxOf(pr); F = k ? fitterK(bb, W, H, k) : fitter(bb, W, H, margin); F.pxy = pt => F.px(pt); return F; },
      p(p3) { const q = raw(p3); return F.px(q); },
      get k() { return F.k; },
      /** outward-facing test for an edge with plan outward normal (nx,ny): visible if it points toward the viewer (screen-down) */
      faces(nx, ny) { return (nx * sa + ny * ca) < 0; }
    };
  }
  /** polygon area (signed) & helpers */
  function area(poly) { let a = 0; for (let i = 0, n = poly.length; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function hull(points) { const P = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = []; for (const p of P) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); }

  return { NS, INK, INK2, INK3, LW, ACC, ACC_SOFT, WARN, FAIL, el, svg, pts, r, text, title, fitter, fitterK, kFor, bboxOf, expand, dim, datum, stairPlan, door, scaleBar, northArrow, oblique, area, hull };
})();
