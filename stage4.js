/* stage4.js — parametric massing. MASS.model() is the single source of the built form; CAP.compute() reads it. */
window.MASS = (function () {
  const D = window.DRAW, E = window.ENV, R = window.RULES, $ = id => document.getElementById(id);
  const fmt = (v, d = 0) => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d });
  const moves = {
    recess: { on: false, w: 4.0, d: 1.5, pos: 0.5, storeys: 6, label: 'Entry recess / front slot', kind: 'GUIDELINE', src: 'CDDG S3.1.2 / G3.1.1 — individual entries from the public realm; entries and porches may also project up to 1.8 m into the front yard (ZDB §10.8.3). Dimensions, position and extent are TIPs.' },
    setback4: { on: false, d: 2.4, label: 'Upper-storey setback above the 4th storey (front)', kind: 'STANDARD', src: 'CDDG S2.2.3 — 2.4–3.0 m where height:ROW exceeds 1:1.1 (S2.2.2)' },
    roofSet: { on: false, d: 1.5, label: 'Roof-level setback (top storey, all sides)', kind: 'TIP', src: 'not in by-law or CDDG — massing device' },
    roofAccess: { on: false, w: 6.0, d: 4.0, h: 3.0, label: 'Roof access enclosure', kind: 'RULE', src: 'ZDB §10.36.1 — roof-top access structures (stairs, elevators) excluded from floor area at roof level if they serve private or common outdoor amenity; §10.1.1(f) — may exceed the height limit at DoP discretion. Dimensions are TIPs.' },
    stepDown: { on: false, depth: 8.0, storeys: 4, label: 'Step-down toward the rear', kind: 'STANDARD', src: 'CDDG Table 1.3 — rear yard 3.1 / 4.6 / 6.1 m by storeys at the rear; S2.2.4 rear building ~13.7 m' },
    balcony: { on: false, d: 1.8, len: 4.0, pitch: 7.0, face: 'both', type: 'project', label: 'Balconies', kind: 'RULE', src: 'ZDB §10.8.1(c): may project ≤1.8 m into a required yard, ≥2.1 m from an interior side property line, railing ≤1.07 m. Excluded from floor area — today capped at 12% of permitted FA (R3 §4.1.2(a)(i)); from 27 Oct uncapped (§10.41.3(a)). CDDG S2.14.1 standard: ≥1.8 m deep, ≥4.5 m² per unit. Pad length and spacing are TIPs; continuous full-width balconies are discouraged (RM-11 guideline, by analogy).' }
  };

  /** storeys allowed: mirrors CAP.compute's first block so massing and calculator agree */
  function storeysFor(site, I) {
    const trig = { bmrInToa: I.bmr && (I.toaOverride == null ? R.toaOf(site).toa : I.toaOverride), social: I.social };
    const H = R.height(trig); const usable = H.m - I.roofAllow;
    let N = I.commGF ? Math.floor((usable - I.ftfComm) / I.ftfRes) + 1 : Math.floor(usable / I.ftfRes);
    if (I.storeyCap && I.storeyCap < N) N = I.storeyCap;
    const eg = R.EGRESS[I.egress]; if (eg.storeyCap && eg.storeyCap < N) N = eg.storeyCap;
    return { N, H };
  }
  const fit = { mode: 'depth', minDepth: 12 }; // how the drawn mass is brought down to the permitted floor area when density binds
  /** trim a model to a target gross floor area. depth: pull the rear face forward (all storeys), dropping storeys only if the bar would fall under minDepth;
      storeys: remove top plates, partial top plate cut from the rear. Returns a new model; the untrimmed envelope is kept as m.ghost. */
  function trim(m, target, mode) {
    if (!m.ok || m.gross <= target + 0.5) return Object.assign({}, m, { fit: null });
    const E = m.Env;
    const withRecess = pl => { if (!(moves.balcony.on && moves.balcony.type === 'recess')) return pl; const b = window.ENV.balconies(E, pl, moves.balcony, null); pl.forEach(p => { const a = b ? b.pads.filter(q => q.k === p.k).reduce((s, q) => s + (q.x1 - q.x0) * (q.y1 - q.y0), 0) : 0; p.net = Math.max(0, p.area - a); p.recessedBalcony = a; }); return pl; };
    const cutAll = (plates, ycut) => withRecess(plates.map(p => { const poly = window.ENV.clipHalf(p.poly, [0, ycut], 0, 1, 0); const a = Math.abs(D.area(poly)); return Object.assign({}, p, { poly, area: a, net: a }); }));
    const gross = pl => pl.reduce((s, p) => s + p.net, 0);
    let plates = m.plates.slice(), dropped = 0, ycut = null;
    const search = (pl, lo, hi, f, tgt = target) => { for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (gross(f(pl, mid)) > tgt) hi = mid; else lo = mid; } return lo; };
    if (mode === 'depth') {
      const minY = E.yMin + fit.minDepth;
      if (gross(cutAll(plates, minY)) <= target) { ycut = search(plates, minY, E.yMax, cutAll); plates = cutAll(plates, ycut); }
      else { plates = cutAll(plates, minY); ycut = minY; while (plates.length > 1 && gross(plates) - plates[plates.length - 1].net >= target) { plates.pop(); dropped++; }
        if (gross(plates) > target && plates.length > 1) { const top = plates[plates.length - 1], rest = plates.slice(0, -1); const y2 = search([top], E.yMin + 3, E.yMax, cutAll, target - gross(rest)); plates = rest.concat(cutAll([top], y2)); } }
    } else {
      while (plates.length > 1 && gross(plates) - plates[plates.length - 1].net >= target) { plates.pop(); dropped++; }
      if (gross(plates) > target && plates.length > 1) { const top = plates[plates.length - 1], rest = plates.slice(0, -1); const y2 = search([top], E.yMin + 3, E.yMax, cutAll, target - gross(rest)); plates = rest.concat(cutAll([top], y2)); }
    }
    const g = gross(plates); const N = plates.length;
    const fitInfo = { mode, removed: m.gross - g, dropped, ycut, depthDrawn: ycut != null ? ycut - E.yMin : E.depth, partialTop: plates[N - 1].area < E.envArea - 0.5 && plates[N - 1].area < (plates[N - 2] ? plates[N - 2].area : Infinity) - 0.5 };
    const bal2 = window.ENV.balconies(E, plates, moves.balcony, null);
    return Object.assign({}, m, { balcony: bal2, plates, N, gross: g, footprint: plates[0].net, typicalPlate: plates[Math.min(1, N - 1)].area, typicalPoly: plates[Math.min(1, N - 1)].poly, fit: fitInfo, ghost: { plates: m.plates, N: m.N }, costs: m.costs.concat([{ key: 'fit', m2: m.gross - g }]) });
  }
  const cache = new Map();
  function model(site, I) {
    const { N, H } = storeysFor(site, I);
    const rearStoreys = moves.stepDown.on ? Math.min(moves.stepDown.storeys, N) : N;
    const key = JSON.stringify([site.ids, site.frontage, site.depth, site.corner, H.m, I.regime, N, rearStoreys, I.ftfRes, I.ftfComm, I.commGF, moves]);
    if (cache.has(key)) return cache.get(key);
    const Env = E.envelope(site, I.regime, rearStoreys);
    let m;
    if (Env.error) m = { ok: false, error: Env.error, Env, N, H };
    else {
      const pl = E.plates(Env, N, I.ftfRes, I.commGF ? I.ftfComm : null, moves);
      const bal = E.balconies(Env, pl, moves.balcony, site);
      if (bal && moves.balcony.type === 'recess') pl.forEach(p => { const a = bal.pads.filter(q => q.k === p.k).reduce((s, q) => s + (q.x1 - q.x0) * (q.y1 - q.y0), 0); p.net = Math.max(0, p.area - a); p.recessedBalcony = a; });
      const gross = pl.reduce((s, p) => s + p.net, 0);
      const startGross = Env.envArea * N;
      // move costs, attributed in a fixed order (recess, front setback, step-down, roof setback), each as the change it makes to the running total
      const order = ['recess', 'setback4', 'stepDown', 'roofSet']; const costs = [];
      if (bal && moves.balcony.type === 'recess') costs.push({ key: 'balcony', m2: bal.area });
      const off = Object.fromEntries(Object.entries(moves).map(([k, v]) => [k, Object.assign({}, v, { on: false })]));
      let prev = startGross;
      order.forEach(k => { if (!moves[k].on) return; off[k].on = true; const g = E.plates(Env, N, I.ftfRes, I.commGF ? I.ftfComm : null, off).reduce((s, p) => s + p.net, 0); costs.push({ key: k, m2: prev - g }); prev = g; });
      m = { ok: true, Env, N, H, balcony: bal, plates: pl, footprint: pl[0].net, gross, startGross, costs, rearStoreys, typicalPlate: pl[Math.min(1, N - 1)].area, typicalPoly: pl[Math.min(1, N - 1)].poly };
    }
    cache.set(key, m); if (cache.size > 200) cache.delete(cache.keys().next().value);
    return m;
  }

  // ---------- drawings ----------
  const W = 720, Hh = 520;
  function drawMassing(m, opts = {}) {
    const s = D.svg(W, Hh, 'dwg massing'); s.setAttribute('data-text-scale', String(W / 360)); // annotation at the site plan's screen size
    if (!m.ok) { D.text(s, W / 2, Hh / 2, 'No massing for this site — see the note', { size: 12, fill: D.INK2 }); return s; }
    const rot = opts.rot ?? 30, ob = D.oblique(W, Hh, 48, rot);
    const lot = m.Env.fr.local; const pts3 = [];
    lot.forEach(p => pts3.push([p[0], p[1], 0]));
    m.plates.forEach(p => p.poly.forEach(q => { pts3.push([q[0], q[1], p.z0]); pts3.push([q[0], q[1], p.z1]); }));
    if(m.roofAllowance)m.plates[m.N-1].poly.forEach(q=>pts3.push([q[0],q[1],m.plates[m.N-1].z1+m.roofAllowance]));
    if (moves.roofAccess.on) pts3.push([0, 0, m.plates[m.N - 1].z1 + moves.roofAccess.h]);
    if (m.ghost) m.ghost.plates.forEach(p => p.poly.forEach(q => pts3.push([q[0], q[1], p.z1])));
    const cx = opts.context; if (cx) { const b = cx.band; pts3.push([b.x0, b.y0, 0], [b.x1, b.y0, 0], [b.x1, b.y1, 0], [b.x0, b.y1, 0]); }
    ob.fit(pts3);
    const P = p3 => ob.p(p3);
    // surroundings: street and lane surface, neighbouring parcels, then approximate neighbouring buildings sorted far to near
    const ctxBuilding = bld => { let q = bld.poly; if (D.area(q) < 0) q = q.slice().reverse(); const g = D.el('g', {}, s);
      for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) continue; if (!ob.faces((b[1] - a[1]) / L, -(b[0] - a[0]) / L)) continue;
        D.el('polygon', { points: D.pts([P([a[0], a[1], 0]), P([b[0], b[1], 0]), P([b[0], b[1], bld.h]), P([a[0], a[1], bld.h])]), fill: '#e1e4e8', stroke: '#9ea3aa', 'stroke-width': 0.5 }, g); }
      D.el('polygon', { points: D.pts(q.map(v => P([v[0], v[1], bld.h]))), fill: '#eef0f2', stroke: '#9ea3aa', 'stroke-width': 0.5 }, g); };
    const depthOf = poly => ob.raw([poly.reduce((t, v) => t + v[0], 0) / poly.length, poly.reduce((t, v) => t + v[1], 0) / poly.length, 0])[1];
    const lotDepth = depthOf(m.Env.fr.local), near = [];
    if (cx) { const b = cx.band; D.el('polygon', { points: D.pts([[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(v => P([v[0], v[1], 0]))), fill: '#dcdfe3', stroke: 'none' }, s);
      cx.parcels.forEach(q => D.el('polygon', { points: D.pts(q.poly.map(v => P([v[0], v[1], 0]))), fill: '#f7f8f9', stroke: '#d3d6da', 'stroke-width': 0.4 }, s));
      const lc = m.Env.fr.local.reduce((t, v) => [t[0] + v[0] / m.Env.fr.local.length, t[1] + v[1] / m.Env.fr.local.length], [0, 0]);
      (cx.streets || []).forEach(st => { const mid = [(st.a[0] + st.b[0]) / 2, (st.a[1] + st.b[1]) / 2], L = Math.hypot(mid[0] - lc[0], mid[1] - lc[1]) || 1, q = P([mid[0] + (mid[0] - lc[0]) / L * 7, mid[1] + (mid[1] - lc[1]) / L * 7, 0]); const pa = P([st.a[0], st.a[1], 0]), pb = P([st.b[0], st.b[1], 0]); let ang = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang <= -90) ang += 180; // along the street, kept upright
        const t = D.text(s, q[0], q[1], st.name, { size: 9, fill: D.INK2, transform: `rotate(${ang.toFixed(1)} ${q[0].toFixed(1)} ${q[1].toFixed(1)})` }); if (t && t.setAttribute) { t.setAttribute('letter-spacing', '.6'); t.setAttribute('stroke', '#dcdfe3'); t.setAttribute('stroke-width', '3'); t.setAttribute('paint-order', 'stroke'); } });
      cx.buildings.map(bld => ({ bld, d: depthOf(bld.poly) })).sort((x, y) => x.d - y.d).forEach(({ bld, d }) => { if (d < lotDepth) ctxBuilding(bld); else near.push(bld); }); }
    if (m.ghost) { // untrimmed envelope as a dashed ghost
      const gp = m.ghost.plates, top = gp[gp.length - 1], base = gp[0];
      const gG = D.el('g', { stroke: D.INK3, 'stroke-width': 0.7, 'stroke-dasharray': '4 3', fill: 'none' }, s);
      D.el('polygon', { points: D.pts(top.poly.map(q => P([q[0], q[1], top.z1]))) }, gG);
      top.poly.forEach(q => { const a = P([q[0], q[1], 0]), b = P([q[0], q[1], top.z1]); D.el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, gG); });
    }
    // lot & envelope on ground
    D.el('polygon', { points: D.pts(lot.map(p => P([p[0], p[1], 0]))), fill: 'none', stroke: D.INK2, 'stroke-width': 0.8, 'stroke-dasharray': '4 3' }, s);
    D.el('polygon', { points: D.pts(m.Env.env.map(p => P([p[0], p[1], 0]))), fill: 'none', stroke: D.INK3, 'stroke-width': 0.6 }, s);
    const prism = (poly, z0, z1, style) => {
      const n = poly.length; const g = D.el('g', {}, s);
      // silhouette fill: skipped when the plate carries a notch, or the hull would paint across the void
      if (!style.notchD) {
        const hullPts = D.hull(poly.flatMap(q => [P([q[0], q[1], z0]), P([q[0], q[1], z1])]));
        D.el('polygon', { points: D.pts(hullPts), fill: '#fff', stroke: D.INK, 'stroke-width': style.heavy || 1.6, 'stroke-linejoin': 'round' }, g);
      }
      D.el('polygon', { points: D.pts(poly.map(q => P([q[0], q[1], z0]))), fill: style.notchD ? 'none' : '#fff', stroke: D.INK, 'stroke-width': 0.7 }, g);
      // faces: back-facing first (hidden fill only), then visible; notch walls shaded so the void reads
      const faces = [];
      for (let i = 0; i < n; i++) {
        const a = poly[i], b = poly[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) continue;
        const nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L;
        const vis = ob.faces(nx, ny);
        const inNotch = style.notchD && !(Math.abs(a[1] - style.notchY0) < 0.02 && Math.abs(b[1] - style.notchY0) < 0.02) && Math.max(a[1], b[1]) <= style.notchY0 + style.notchD + 0.02 && Math.min(a[1], b[1]) >= style.notchY0 - 0.02;
        faces.push({ a, b, vis, inNotch, back: Math.abs(ny) > 0.9 && inNotch });
      }
      faces.filter(f => !f.vis).forEach(f => { if (style.notchD) D.el('polygon', { points: D.pts([P([f.a[0], f.a[1], z0]), P([f.b[0], f.b[1], z0]), P([f.b[0], f.b[1], z1]), P([f.a[0], f.a[1], z1])]), fill: '#fff', stroke: 'none' }, g); });
      faces.filter(f => f.vis).forEach(f => D.el('polygon', { points: D.pts([P([f.a[0], f.a[1], z0]), P([f.b[0], f.b[1], z0]), P([f.b[0], f.b[1], z1]), P([f.a[0], f.a[1], z1])]), fill: f.inNotch ? (f.back ? '#b9bec6' : '#d3d7dd') : (style.side || '#f1f2f4'), stroke: D.INK, 'stroke-width': 0.6 }, g));
      D.el('polygon', { points: D.pts(poly.map(q => P([q[0], q[1], z1]))), fill: style.top || '#fff', stroke: D.INK, 'stroke-width': style.notchD ? 1.0 : 0.7 }, g);
      return g;
    };
    const padPrism = q => prism([[q.x0, q.y0], [q.x1, q.y0], [q.x1, q.y1], [q.x0, q.y1]], q.z - 0.15, q.z, { heavy: 0.6, side: q.type === 'recess' ? '#e3e6ea' : '#f7f7f8', top: q.type === 'recess' ? '#eceef1' : '#fff' });
    m.plates.forEach(p => {
      if (m.balcony) m.balcony.pads.filter(q => q.k === p.k && q.face === 'rear').forEach(padPrism);   // far side: behind the plate
      prism(p.poly, p.z0, p.z1, p.notch ? { notchY0: Math.min(...p.poly.map(q => q[1])), notchD: p.notch.d } : {});
      if (m.balcony) m.balcony.pads.filter(q => q.k === p.k && q.face === 'front').forEach(padPrism);  // near side: in front
    });
    if(m.roofAllowance){const top=m.plates[m.N-1];prism(top.poly,top.z1,top.z1+m.roofAllowance,{heavy:.6,side:'#e3e5e8',top:'#f6f7f8'});}
    // roof access
    if (moves.roofAccess.on) {
      const top = m.plates[m.N - 1]; const c = top.poly.reduce((a, q) => [a[0] + q[0] / top.poly.length, a[1] + q[1] / top.poly.length], [0, 0]);
      const w = moves.roofAccess.w / 2, d = moves.roofAccess.d / 2, box = [[c[0] - w, c[1] - d], [c[0] + w, c[1] - d], [c[0] + w, c[1] + d], [c[0] - w, c[1] + d]];
      prism(box, top.z1, top.z1 + moves.roofAccess.h, { heavy: 1.2, side: '#e3e6ea' });
      const tp = P([c[0] + w, c[1] - d, top.z1 + moves.roofAccess.h]);
      D.el('line', { x1: tp[0], y1: tp[1], x2: tp[0] + 40, y2: tp[1] - 22, stroke: D.INK2, 'stroke-width': 0.6 }, s);
      D.text(s, tp[0] + 44, tp[1] - 24, `roof access ${moves.roofAccess.w}×${moves.roofAccess.d}×${moves.roofAccess.h} m`, { anchor: 'start', size: 9, fill: D.INK2 });
    }
    near.forEach(ctxBuilding);
    if (cx) { const g = D.el('g', {}, s); D.el('rect', { x: 14, y: Hh - 26, width: 10, height: 10, fill: '#e1e4e8', stroke: '#9ea3aa', 'stroke-width': 0.6 }, g); D.text(g, 28, Hh - 17, 'context · approx. existing buildings, streets and lane within ' + cx.radius + ' m', { anchor: 'start', size: 9, fill: D.INK2 }); }
    // dims: building depth on the near side, height
    const g0 = m.plates[0].poly; const xMin = Math.min(...g0.map(q => q[0])), yMin = Math.min(...g0.map(q => q[1])), yMax = Math.max(...g0.map(q => q[1]));
    D.dim(s, P([xMin, yMin, 0]), P([xMin, yMax, 0]), -18, `${fmt(yMax - yMin, 1)} m depth`);
    const topz = m.plates[m.N - 1].z1+(m.roofAllowance||0); const xMax = Math.max(...g0.map(q => q[0]));
    D.dim(s, P([xMax, yMin, 0]), P([xMax, yMin, topz]), 18, `${fmt(topz, 1)} m${m.roofNote ? ` + ${fmt(m.roofNote, 1)} m roof` : ""} · ${m.N} storeys`);
    D.title(s, 'Massing', `plan oblique ${Math.round(((rot % 360) + 360) % 360)}° · ${opts.label || ''}${m.fit ? ` · trimmed to permitted area · dashed = envelope` : ''}`);
    return s;
  }

  function planBBox(m) { return D.expand(D.bboxOf(m.Env.fr.local), 3); }
  function sectionBBox(m) { const lot = m.Env.fr.local; const y0 = Math.min(...lot.map(q => q[1])), y1 = Math.max(...lot.map(q => q[1])); const topz = m.plates[m.N - 1].z1 + (moves.roofAccess.on ? moves.roofAccess.h : 0); return [y0 - 2, -2.5, y1 + 7, Math.max(m.H.m, topz) + 2]; }
  function drawSitePlan(m, site, I, opts = {}) {
    const Wp = 360, Hp = 300, s = D.svg(Wp, Hp, 'dwg siteplan');
    if (!m.ok) { D.text(s, Wp / 2, Hp / 2, 'No plan — envelope withheld', { size: 11, fill: D.INK2 }); return s; }
    const lot = m.Env.fr.local; const F = opts.k ? D.fitterK(planBBox(m), Wp, Hp, opts.k) : D.fitter(planBBox(m), Wp, Hp, 42); s.dataset.k = F.k;
    const p = q => F.p(q);
    D.el('polygon', { points: D.pts(lot.map(p)), fill: 'none', stroke: D.INK, 'stroke-width': D.LW.edge, 'stroke-dasharray': '6 3 1.5 3' }, s);   // property line: long-short dash
    D.el('polygon', { points: D.pts(m.Env.env.map(p)), fill: 'none', stroke: D.INK3, 'stroke-width': D.LW.fine, 'stroke-dasharray': '3 2' }, s);
    D.el('polygon', { points: D.pts(m.plates[0].poly.map(p)), fill: 'url(#poche)', stroke: D.INK, 'stroke-width': D.LW.cut }, s);
    if (m.N > 1) D.el('polygon', { points: D.pts(m.typicalPoly.map(p)), fill: 'none', stroke: '#fff', 'stroke-width': D.LW.fine, 'stroke-dasharray': '2 2' }, s);
    if (m.balcony) m.balcony.pads.filter(q => q.k === Math.min(2, m.N)).forEach(q => D.el('rect', { x: F.x(q.x0), y: F.y(q.y1), width: (q.x1 - q.x0) * F.k, height: (q.y1 - q.y0) * F.k, fill: 'none', stroke: D.ACC, 'stroke-width': 0.7, 'stroke-dasharray': '2 2' }, s));
    // yards dimensioned: front (bottom), rear (top), sides
    const xs = lot.map(q => q[0]), ys = lot.map(q => q[1]); const e = m.Env;
    const cxm = (e.xMin + e.xMax) / 2;
    D.dim(s, p([cxm, Math.min(...ys)]), p([cxm, e.yMin]), 0, `${m.Env.y.front.m}`, { size: 8 });
    D.dim(s, p([cxm, e.yMax]), p([cxm, Math.max(...ys)]), 0, `${m.Env.rear}`, { size: 8 });
    const cym = (e.yMin + e.yMax) / 2;
    D.dim(s, p([Math.min(...xs), cym]), p([e.xMin, cym]), 0, `${m.Env.y.side1.m}`, { size: 8 });
    D.dim(s, p([e.xMax, cym]), p([Math.max(...xs), cym]), 0, `${m.Env.y.side2.m}`, { size: 8 });
    // overall frontage & depth strings outside
    D.dim(s, p([Math.min(...xs), Math.min(...ys)]), p([Math.max(...xs), Math.min(...ys)]), 22, `${fmt(site.frontage, 2)} m frontage`);
    D.dim(s, p([Math.max(...xs), Math.min(...ys)]), p([Math.max(...xs), Math.max(...ys)]), 22, `${fmt(site.depth, 2)} m depth`);
    // each street, lane or open side labelled where it is, from the same edge classes as the Site tab's Boundary edges table;
    // a street takes the name of the street it faces when the parcel addresses give one
    { const fr = m.Env.fr, n = lot.length, names = window.SITE_CONTEXT ? window.SITE_CONTEXT.streets(site, fr) : [], mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      fr.sides.forEach(sd => { if (!['street', 'lane', 'open'].includes(sd.cls)) return;
        const a = lot[sd.edges[0]], b = lot[(sd.edges[sd.edges.length - 1] + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 3) return;
        const nm = sd.cls === 'street' ? sd.edges.map(i => { const q = mid(lot[i], lot[(i + 1) % n]); return names.find(t => Math.hypot(mid(t.a, t.b)[0] - q[0], mid(t.a, t.b)[1] - q[1]) < 1.5); }).find(Boolean)?.name : null;
        const front = sd === fr.front, label = sd.cls === 'lane' ? 'LANE' : sd.cls === 'open' ? 'OPEN EDGE' : nm || (front ? 'STREET' : 'FLANKING STREET');
        const c = mid(a, b), pc = p(c), po = p([c[0] + (b[1] - a[1]) / L, c[1] - (b[0] - a[0]) / L]), u = [po[0] - pc[0], po[1] - pc[1]], ul = Math.hypot(u[0], u[1]) || 1, off = front ? 36 : u[0] / ul > 0.7 ? 44 : 10;
        const x = pc[0] + u[0] / ul * off, y = pc[1] + u[1] / ul * off, pa = p(a), pb = p(b); let ang = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang <= -90) ang += 180;
        D.text(s, x, y, label, { size: 7.5, fill: D.INK3, transform: `rotate(${ang.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`, attrs: { 'letter-spacing': '0.1em', 'data-edge': sd.cls } }); }); }
    D.northArrow(s, Wp - 26, 30, m.Env.fr.north * 180 / Math.PI); // fr.north = −rot: true north's clockwise screen angle from up (local +y is up)
    D.scaleBar(s, 14, Hp - 14, F.k, { units: [0, 5, 10] });
    D.title(s, 'Site plan', 'footprint poché · envelope dashed · property line');
    return s;
  }

  function drawSection(m, site, I, opts = {}) {
    const Ws = 360, Hs = 300, s = D.svg(Ws, Hs, 'dwg section');
    if (!m.ok) { D.text(s, Ws / 2, Hs / 2, 'No section — envelope withheld', { size: 11, fill: D.INK2 }); return s; }
    const lot = m.Env.fr.local; const y0 = Math.min(...lot.map(q => q[1])), y1 = Math.max(...lot.map(q => q[1]));
    const topz = m.plates[m.N - 1].z1 + (moves.roofAccess.on ? moves.roofAccess.h : 0);
    const Hlim = m.H.m;
    const F = opts.k ? D.fitterK(sectionBBox(m), Ws, Hs, opts.k) : D.fitter(sectionBBox(m), Ws, Hs, 34); s.dataset.k = F.k;
    const p = (y, z) => F.p([y, z]);
    // ground hatch
    const gy = p(y0, 0)[1];
    D.el('rect', { x: 0, y: gy, width: Ws, height: Math.min(Hs - gy, 26), fill: 'url(#hatch)', stroke: 'none' }, s);
    D.el('line', { x1: 0, y1: gy, x2: Ws, y2: gy, stroke: D.INK, 'stroke-width': D.LW.cut }, s);
    // slabs: for each plate, extent along depth axis
    const slab = 0.25;
    m.plates.forEach(pl => {
      const ys = pl.poly.map(q => q[1]); const a = Math.min(...ys), b = Math.max(...ys);
      D.el('rect', { x: p(a, pl.z1)[0], y: p(a, pl.z1)[1], width: p(b, 0)[0] - p(a, 0)[0], height: p(0, pl.z1 - slab)[1] - p(0, pl.z1)[1], fill: 'url(#poche)', stroke: 'none' }, s);
      // walls
      [a, b].forEach(yy => D.el('rect', { x: p(yy, 0)[0] - (yy === b ? 0 : 0) - 1.2, y: p(0, pl.z1)[1], width: 2.4, height: p(0, pl.z0)[1] - p(0, pl.z1)[1], fill: 'url(#poche)', stroke: 'none' }, s));
    });
    D.el('rect', { x: p(Math.min(...m.plates[0].poly.map(q => q[1])), 0)[0], y: gy - 1, width: p(Math.max(...m.plates[0].poly.map(q => q[1])), 0)[0] - p(Math.min(...m.plates[0].poly.map(q => q[1])), 0)[0], height: 2, fill: D.INK }, s);
    if (m.balcony) m.balcony.pads.filter(q => q.type === 'project').forEach(q => D.el('rect', { x: p(q.y0, 0)[0], y: p(0, q.z)[1], width: p(q.y1, 0)[0] - p(q.y0, 0)[0], height: Math.max(1.5, p(0, 0)[1] - p(0, 0.15)[1]), fill: D.INK, stroke: 'none' }, s));
    if (m.plates[0].notch) { const nd = m.plates[0].notch.d, yN = Math.min(...m.plates[0].poly.map(q => q[1])) + nd, zTop = m.plates[m.plates[0].notch ? Math.max(0, m.plates.filter(q => q.notch).length - 1) : 0].z1;
      D.el('line', { x1: p(yN, 0)[0], y1: p(0, 0)[1], x2: p(yN, 0)[0], y2: p(0, zTop)[1], stroke: D.INK2, 'stroke-width': D.LW.hidden, 'stroke-dasharray': '4 3' }, s);
      D.text(s, p(yN, 0)[0] + 4, p(0, zTop)[1] - 6, 'recess beyond', { anchor: 'start', size: 7.5, fill: D.INK3 }); }
    if (moves.roofAccess.on) { const t = m.plates[m.N - 1]; const c = t.poly.reduce((a, q) => a + q[1] / t.poly.length, 0); D.el('rect', { x: p(c - moves.roofAccess.d / 2, t.z1 + moves.roofAccess.h)[0], y: p(0, t.z1 + moves.roofAccess.h)[1], width: p(moves.roofAccess.d, 0)[0] - p(0, 0)[0], height: p(0, t.z1)[1] - p(0, t.z1 + moves.roofAccess.h)[1], fill: '#fff', stroke: D.INK, 'stroke-width': 0.8 }, s); }
    // height limit
    if(m.roofAllowance){const top=m.plates[m.N-1],ys=top.poly.map(q=>q[1]),a=Math.min(...ys),b=Math.max(...ys);D.el('rect',{x:p(a,0)[0],y:p(0,top.z1+m.roofAllowance)[1],width:p(b,0)[0]-p(a,0)[0],height:F.k*m.roofAllowance,fill:'#e3e5e8',stroke:D.INK2,'stroke-width':.5},s);D.text(s,p(b,0)[0],p(0,top.z1+m.roofAllowance)[1]-5,`+${(top.z1+m.roofAllowance).toFixed(1)} m incl. roof allowance`,{anchor:'end',size:7,fill:D.INK2});}
    const yl = p(0, Hlim)[1];
    D.el('line', { x1: p(y0 - 1, 0)[0], y1: yl, x2: p(y1 + 1, 0)[0], y2: yl, stroke: D.INK, 'stroke-width': 0.8, 'stroke-dasharray': '6 3' }, s);
    D.text(s, p(y0 - 1, 0)[0], yl - 6, `${Hlim} m HEIGHT LIMIT · R3 ${m.H.clause}`, { anchor: 'start', size: 7.5, fill: D.INK, attrs: { 'letter-spacing': '0.06em' } });
    // datums
    m.plates.forEach((pl, i) => { if (i === 0 || i === m.N - 1) D.datum(s, p(y1 + 0.3, 0)[0], p(y1 + 1.6, 0)[0], p(0, pl.z1)[1], `${i === m.N - 1 ? 'Roof' : 'L' + (pl.k + 1)} +${pl.z1.toFixed(1)}`, { size: 8 }); });
    D.datum(s, p(y1 + 0.3, 0)[0], p(y1 + 1.6, 0)[0], gy, 'L1 ±0.0', { size: 8 });
    // dims: overall height, one floor-to-floor
    const xd = p(y0 - 1.6, 0)[0];
    D.dim(s, [xd, gy], [xd, p(0, m.plates[m.N - 1].z1+(m.roofAllowance||0))[1]], -14, `${(m.plates[m.N - 1].z1+(m.roofAllowance||0)).toFixed(1)} m`);
    const pl1 = m.plates[Math.min(1, m.N - 1)];
    D.dim(s, [xd, p(0, pl1.z0)[1]], [xd, p(0, pl1.z1)[1]], 8, `${(pl1.z1 - pl1.z0).toFixed(1)}`, { size: 8 });
    // yards labels
    D.dim(s, p(y0, 0), p(Math.min(...m.plates[0].poly.map(q => q[1])), 0), 16, `${m.Env.y.front.m}`, { size: 8 });
    D.dim(s, p(Math.max(...m.plates[0].poly.map(q => q[1])), 0), p(y1, 0), 16, `${fmt(y1 - Math.max(...m.plates[0].poly.map(q => q[1])), 1)}`, { size: 8 });
    D.title(s, 'Section', 'through the depth · street at left · slabs in poché');
    D.scaleBar(s, 14, Hs - 14, F.k, { units: [0, 5, 10] });
    return s;
  }

  // ---------- controls & table ----------
  const SPEC = (k, f) => {
    if (k === 'recess' && f === 'pos') return { label: 'position', min: 0, max: 1, step: 0.05, fmt: v => +v <= 0.02 ? 'left' : +v >= 0.98 ? 'right' : Math.abs(+v - 0.5) < 0.03 ? 'centre' : `${Math.round(v * 100)}% across` };
    if (k === 'recess' && f === 'storeys') return { label: 'extent', min: 1, max: 6, step: 1, fmt: v => +v >= 6 ? 'full height' : +v === 1 ? 'ground floor' : `lowest ${v} storeys` };
    if (k === 'balcony' && f === 'd') return { label: 'depth', min: 1.0, max: 3.0, step: 0.1, fmt: v => `${v} m${+v > 1.8 ? ' — exceeds §10.8.1(c) 1.8 m projection' : ''}` };
    if (k === 'balcony' && f === 'len') return { label: 'pad length', min: 2.0, max: 12, step: 0.5, fmt: v => `${v} m` };
    if (k === 'balcony' && f === 'pitch') return { label: 'spacing', min: 3.0, max: 15, step: 0.5, fmt: v => `every ${v} m` };
    if (f === 'storeys') return { label: 'storeys', min: 1, max: 6, step: 1, fmt: v => `${v}` };
    const L = { d: 'depth', w: 'width', h: 'height', depth: 'depth' }[f] || f;
    return { label: L, min: 0.5, max: f === 'depth' ? 20 : f === 'w' ? 12 : 6, step: 0.1, fmt: v => `${v} m` };
  };
  function renderControls() {
    const box = $('mv-list'); if (box.children.length) return;
    box.innerHTML = Object.entries(moves).map(([k, m]) => {
      const dims = Object.keys(m).filter(f => typeof m[f] === 'number');
      return `<li class="mv" data-k="${k}"><label class="mv-head"><input type="checkbox" data-k="${k}" ${m.on ? 'checked' : ''}> <span>${m.label}</span><span class="kind ${m.kind}">${m.kind}</span></label>
        <div class="mv-dims">${dims.map(f => { const S = SPEC(k, f); return `<label>${S.label} <input type="range" data-k="${k}" data-f="${f}" min="${S.min}" max="${S.max}" step="${S.step}" value="${m[f]}"><output>${S.fmt(m[f])}</output></label>`; }).join('')}</div>
        ${k === 'balcony' ? `<div class="mv-dims"><label>faces <select data-k="balcony" data-f="face"><option value="both">front and rear</option><option value="front">front only</option><option value="rear">rear only</option></select></label><label>type <select data-k="balcony" data-f="type"><option value="project">projecting into the yard</option><option value="recess">recessed into the plate</option></select></label></div>` : ''}
        <p class="src2">${m.src}</p><p class="cost" data-cost="${k}"></p></li>`;
    }).join('');
    box.querySelectorAll('input[type=checkbox]').forEach(c => c.onchange = () => { moves[c.dataset.k].on = c.checked; window.APP.refresh(); });
    box.querySelectorAll('select[data-k]').forEach(se => se.onchange = () => { moves[se.dataset.k][se.dataset.f] = se.value; window.APP.refresh(); });
    box.querySelectorAll('input[type=range]').forEach(rg => rg.oninput = () => { moves[rg.dataset.k][rg.dataset.f] = +rg.value; rg.nextElementSibling.textContent = SPEC(rg.dataset.k, rg.dataset.f).fmt(+rg.value); window.APP.refresh(); });
  }
  function renderTable(m, r) {
    const t = $('mv-table');
    if (!m.ok) { t.innerHTML = `<tr><td colspan="3" class="warn-text">${m.error}</td></tr>`; return; }
    const rows = [[`Starting envelope: ${fmt(m.Env.envArea)} m² × ${m.ghost ? m.ghost.N : m.N}`, m.startGross, '']];
    m.costs.filter(c => c.key !== 'fit').forEach(c => rows.push([c.key === 'balcony' ? 'Recessed balconies (plate area, excluded as balcony)' : moves[c.key].label, -c.m2, moves[c.key].kind]));
    const fc = m.costs.find(c => c.key === 'fit');
    rows.push([`Envelope gross after moves`, m.gross + (fc ? fc.m2 : 0), '']);
    if (m.balcony) rows.push([`Balconies: ${m.balcony.pads.length} pads, ${moves.balcony.type === 'project' ? 'projecting' : 'recessed'} — ${fmt(m.balcony.area)} m² excluded from floor area`, 0, 'RULE']);
    if (fc) { rows.push([`Fit to permitted floor area — ${m.fit.mode === 'depth' ? `rear face pulled forward to ${fmt(m.fit.depthDrawn, 1)} m depth` : `${m.fit.dropped} storey${m.fit.dropped === 1 ? '' : 's'} dropped`}${m.fit.dropped && m.fit.mode === 'depth' ? `, ${m.fit.dropped} storey${m.fit.dropped === 1 ? '' : 's'} dropped` : ''}${m.fit.partialTop ? ', partial top plate' : ''}`, -fc.m2, 'RULE']); rows.push(['Drawn gross', m.gross, '']); }
    t.innerHTML = rows.map(rw => `<tr><td>${rw[0]}</td><td class="num">${rw[1] === 0 ? '—' : (rw[1] < 0 ? '−' : '') + fmt(Math.abs(rw[1])) + ' m²'}</td><td class="clause">${rw[2]}</td></tr>`).join('') +
      (r && !r.fail ? `<tr class="tot"><td>Resulting FSR</td><td class="num">${r.fsrUsed.toFixed(2)}</td><td class="clause">of ${r.fsr.fsr.toFixed(2)} · ${r.binding} binds</td></tr><tr class="tot"><td>Resulting units</td><td class="num">${r.units.units}</td><td class="clause">${fmt(r.units.avg)} m² avg</td></tr>` : '');
    Object.keys(moves).forEach(k => { const c = m.costs.find(x => x.key === k); const el = document.querySelector(`[data-cost="${k}"]`); if (el) el.textContent = moves[k].on ? (c ? `costs ${fmt(c.m2)} m² of floor area` : 'no floor area cost') : ''; });
    if (m.Env.y.rearStd) $('mv-note').textContent = `Rear yard ${m.Env.rear} m: CDDG Table 1.3 standard for ${m.rearStoreys} storeys at the rear (by-law minimum 3.1 m, §3.1.2.5).`; else $('mv-note').textContent = `Rear yard ${m.Env.rear} m (§3.1.2.5). Current-regime guideline standards NOT IN SOURCE.`;
  }
  /** common scale for a plan + section pair */
  function commonK(m) { return Math.min(D.kFor(planBBox(m), 360, 300, 42), D.kFor(sectionBBox(m), 360, 300, 34)); }
  return { moves, fit, model, trim, storeysFor, drawMassing, drawSitePlan, drawSection, commonK, planBBox, sectionBBox, renderControls, renderTable };
})();
