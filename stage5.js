/* stage5.js — one exit versus two. Eligibility with pass / fail / not testable, then a like-for-like comparison
   holding lot, envelope, storeys and floor-to-floor constant; only core and circulation vary. */
window.EGRESS = (function () {
  const D = window.DRAW, R = window.RULES, $ = id => document.getElementById(id);
  const fmt = (v, d = 0) => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d });
  // design parameters — all editable; sources noted
  const P = {
    unitDepth: { v: 11.0, label: 'Single-aspect unit depth', src: 'CDDG S2.11.2 — 10.7 to 12.2 m (STANDARD)' },
    corridor: { v: 1.7, label: 'Interior corridor width', src: 'VBBL §3.3.1 — NOT IN SOURCE; TIP' },
    passage: { v: 1.5, label: 'Exterior passageway width', src: 'VBBL 3.2.10 exit passageway — NOT IN SOURCE; TIP' },
    stairW: { v: 2.6, label: 'Exit stair enclosure width', src: 'VBBL §3.4.3 — NOT IN SOURCE; TIP' },
    stairL: { v: 6.0, label: 'Exit stair enclosure length', src: 'VBBL §3.4.3 — NOT IN SOURCE; TIP' },
    scissorW: { v: 3.2, label: 'Scissor stair core width', src: 'VBBL 3.2.10 space-efficient scissor stair — dimensions NOT IN SOURCE; TIP' },
    scissorL: { v: 7.5, label: 'Scissor stair core length', src: 'TIP' },
    elev: { v: 12, label: 'Elevator + lobby area per floor (m²)', src: 'TIP' },
    courtyard: { v: 7.3, label: 'Courtyard clear width', src: 'CDDG S1.4.3 (STANDARD)' }
  };
  const A = { noncomb: null, sprinklered: null }; // assumptions: null = not stated

  const SCHEMES = {
    two: { key: 'two', label: 'Two exits', sub: 'interior double-loaded corridor, two exit stairs', exits: 2 },
    scissor: { key: 'scissor', label: 'Two exits — scissor', sub: 'interior double-loaded corridor, one scissor-stair core', exits: 2 },
    one: { key: 'one', label: 'One exit', sub: 'single-loaded bar, exterior exit stair and exterior passageway', exits: 1 }
  };

  P.through = { v: 16.0, label: 'Dual-aspect (through) unit depth, one-exit bar', src: 'CDDG S2.11.2 limits single-aspect units only; §10.39 permits inboard rooms (Oct) — TIP' };
  P.travelLimit = { v: 0, label: 'Travel distance limit to the exit (0 = not set)', src: 'VBBL 3.2.10 / §3.4.2 — NOT IN SOURCE; enter if known' };
  const CFG = { auto: 'auto — largest that fits', bar_x: 'single-aspect bars along the street', through_x: 'through-unit bars along the street', bar_y: 'single-aspect bars down the depth', through_y: 'through-unit bars down the depth', L_x: 'L-plan, bar along the street', L_y: 'L-plan, bar down the depth' };
  const oneCfg = { v: 'auto' };

  /** Block model for a scheme on the current massing. The envelope plate is treated as a rectangle Wb (along the frontage) × Db (depth).
      Layouts are generated in both orientations and repeated down the long dimension with the required separation; the largest net plate wins.
      Coordinates: x along frontage, y depth from the street. */
  function scheme(key, m, I, site, cfgOverride) {
    const S = SCHEMES[key]; const poly = m.typicalPoly; const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]);
    const Wb = Math.max(...xs) - Math.min(...xs), Db = Math.max(...ys) - Math.min(...ys), x0 = Math.min(...xs), y0 = Math.min(...ys);
    const u = P.unitDepth.v, pass = P.passage.v, cor = P.corridor.v, sw = P.stairW.v, sl = P.stairL.v, court = P.courtyard.v;
    const sepTwo = m.N >= 5 ? 18.3 : 9.1; // CDDG Table 1.4 primary–primary; by-law minimum 7.3 (§3.1.2.6(b))
    const avg0 = I.mix.reduce((s, x) => s + x.share * x.size, 0), resStoreys = I.commGF ? m.N - 1 : m.N, eg = R.EGRESS[key];
    // local frame: a = along the bar, c = across (depth of the bar); map to x,y by axis
    const map = (axis, a0, c0, a1, c1) => axis === 'x' ? { x0: x0 + a0, y0: y0 + c0, x1: x0 + a1, y1: y0 + c1 } : { x0: x0 + c0, y0: y0 + a0, x1: x0 + c1, y1: y0 + a1 };
    const fin = r => Object.assign(r, { w: r.x1 - r.x0, h: r.y1 - r.y0, area: (r.x1 - r.x0) * (r.y1 - r.y0) });
    const R_ = (axis, a0, c0, a1, c1, extra) => Object.assign(fin(map(axis, a0, c0, a1, c1)), extra || {});
    const finish = (o) => {
      o.gross = o.blocks.reduce((s, r) => s + r.area, 0); o.corridorArea = o.strips.reduce((s, r) => s + r.area, 0);
      o.core = o.stairs.reduce((s, r) => s + (r.exterior ? 0 : r.area), 0) + P.elev.v * o.buildings;
      o.circ = o.core + o.corridorArea + o.stairs.reduce((s, r) => s + (r.exterior ? r.area : 0), 0);
      o.net = Math.max(0, o.gross - o.circ); o.n2g = o.gross ? o.net / o.gross : 0;
      o.perFloor = Math.floor(o.net / avg0); o.units = o.perFloor * resStoreys; o.capped = false;
      const cap = eg.unitCap ? eg.unitCap * o.buildings : null;
      if (cap && o.units > cap) { o.units = cap; o.capped = true; }
      o.avg = o.units ? o.net * resStoreys / o.units : 0; o.avg0 = avg0; o.resStoreys = resStoreys; o.unitCap = cap; o.footprint = o.gross;
      o.unused = Math.max(0, 1 - o.gross / (Wb * Db)); o.stranded = o.unused * Db;
      o.drawnDepth = o.blocks.length ? Math.max(...o.blocks.map(r => r.y1)) - y0 : 0;
      return Object.assign(o, { key, S, Wb, Db, x0, y0 });
    };
    const cands = {}; const axisLabel = ax => ax === 'x' ? 'along the street' : 'down the depth';

    // ---- two exits / scissor: double-loaded bars, either orientation, repeated with separation ----
    if (key !== 'one') {
      ['x', 'y'].forEach(axis => {
        const L = axis === 'x' ? Wb : Db, X = axis === 'x' ? Db : Wb; // L along the bar, X across (available for depth + separation)
        let d, loaded;
        if (X >= 2 * u + cor) { d = Math.min(X, 2 * 12.2 + cor); loaded = 'double'; } else if (X >= 6 + cor) { d = Math.min(X, u + cor); loaded = 'single'; } else return;
        const n = Math.max(1, Math.floor((X + sepTwo) / (d + sepTwo)));
        const blocks = [], strips = [], stairs = [], elev = [];
        for (let i = 0; i < n; i++) {
          const c0 = i * (d + sepTwo); blocks.push(R_(axis, 0, c0, L, c0 + d));
          const k0 = loaded === 'double' ? c0 + (d - cor) / 2 : c0 + d - cor; strips.push(R_(axis, 0, k0, L, k0 + cor));
          if (key === 'two') { stairs.push(R_(axis, 0, k0 - sl / 2, sw, k0 + sl / 2 + cor / 2)); stairs.push(R_(axis, L - sw, k0 - sl / 2, L, k0 + sl / 2 + cor / 2)); elev.push(R_(axis, L / 2 - 1.5, k0 + cor, L / 2 + 1.5, k0 + cor + 3)); }
          else { const cw = P.scissorW.v, cl = P.scissorL.v; stairs.push(R_(axis, L / 2 - cw / 2 - 1.6, k0 - cl / 2, L / 2 + cw / 2 - 1.6, k0 + cl / 2 + cor / 2, { scissor: true })); elev.push(R_(axis, L / 2 + cw / 2 - 1.4, k0 + cor, L / 2 + cw / 2 + 1.6, k0 + cor + 3)); }
        }
        const notes = [];
        if (loaded === 'single') notes.push(`Only ${fmt(X, 1)} m across — cannot take a double-loaded corridor (needs ${fmt(2 * u + cor, 1)} m). Drawn single-loaded.`);
        if (n > 1) notes.push(`${n} bars separated by ${sepTwo} m (CDDG Table 1.4 primary façades, ${m.N} storeys; by-law minimum 7.3 m, §3.1.2.6(b)).`);
        cands[axis] = finish({ blocks, strips, stairs, elev, buildings: n, loaded, depthNeeded: 2 * u + cor, travel: L / 2, notes, cfg: axis, cfgLabel: `${n > 1 ? n + ' bars' : 'bar'} ${axisLabel(axis)}, ${loaded}-loaded` });
      });
    } else {
      // ---- one exit: single-loaded bars with exterior passageway, either orientation, repeated across courts; plus L-plans ----
      const mkBars = (axis, ud, cfg) => {
        const L = axis === 'x' ? Wb : Db, X = axis === 'x' ? Db : Wb;
        const d = Math.min(ud, X - pass); if (d < 6) return { invalid: `No room for a bar ${axisLabel(axis)}: ${fmt(X, 1)} m across.` };
        const pitch = d + pass + court; const n = Math.max(1, Math.floor((X + court) / pitch));
        const blocks = [], strips = [], stairs = [], elev = [];
        for (let i = 0; i < n; i++) {
          const c0 = i * pitch; blocks.push(R_(axis, 0, c0, L, c0 + d)); strips.push(R_(axis, 0, c0 + d, L, c0 + d + pass));
          stairs.push(R_(axis, L / 2 - sw / 2, c0 + d + pass, L / 2 + sw / 2, c0 + d + pass + sl, { exterior: true }));
          elev.push(R_(axis, L / 2 + sw / 2 + 0.3, c0 + d - 3, L / 2 + sw / 2 + 3.3, c0 + d));
        }
        const notes = [];
        notes.push('Exterior exit stair drawn at the passageway. ZDB §10.8.2(a) permits open fire escapes to project into a rear yard — whether an exterior exit stair qualifies is NOT IN SOURCE; if it does, the stair could sit in the rear yard and free the plate.'); if (false) notes.push(' ZDB §10.8.2(a) permits open fire escapes to project into a rear yard — whether an exterior exit stair qualifies is NOT IN SOURCE; if it does, the stair could sit in the rear yard and free the plate.');
        if (n > 1) notes.push(`${n} buildings, each with its own exit stair and — on this tool's reading of the draft — its own 30-unit cap (more than one principal building: DoP discretion, §2.2.7). Courts ${court} m clear (CDDG S1.4.3).`);
        return finish({ blocks, strips, stairs, elev, buildings: n, loaded: 'single', depthNeeded: 6 + pass, travel: L / 2, notes, cfg, cfgLabel: `${n > 1 ? n + ' bars' : 'bar'} ${axisLabel(axis)}, ${cfg.startsWith('through') ? 'through-unit' : 'single-aspect'} ${fmt(d, 1)} m deep` });
      };
      cands.bar_x = mkBars('x', 12.2, 'bar_x'); cands.through_x = mkBars('x', P.through.v, 'through_x');
      cands.bar_y = mkBars('y', 12.2, 'bar_y'); cands.through_y = mkBars('y', P.through.v, 'through_y');
      // L-plan: bar along axis at c=0, wing along the other axis at the far end, passageways inside, stair at the inner corner
      const mkL = (axis, cfg) => {
        const L = axis === 'x' ? Wb : Db, X = axis === 'x' ? Db : Wb;
        const d = Math.max(Math.min(u, X - pass), Math.min(P.through.v, X - pass - 6)); const ww = u + pass; const courtW = L - ww; const wingL = X - d - pass;
        if (d < 6 || wingL < 6) return { invalid: `L-plan ${axisLabel(axis)}: not enough room for a wing.` };
        if (courtW < court) return { invalid: `L-plan ${axisLabel(axis)} needs a ${court} m clear court; leaves ${fmt(courtW, 1)} m.` };
        const blocks = [R_(axis, 0, 0, L, d), R_(axis, L - u, d + pass, L, X)];
        const strips = [R_(axis, 0, d, L, d + pass), R_(axis, L - ww, d + pass, L - u, X)];
        const stairs = [R_(axis, L - ww - sw, d + pass, L - ww, d + pass + sl, { exterior: true })];
        const elev = [R_(axis, L - ww - 3.3, d - 3, L - ww - 0.3, d)];
        return finish({ blocks, strips, stairs, elev, buildings: 1, loaded: 'single', depthNeeded: d + pass + 6, travel: Math.max(courtW, wingL), notes: [`Side court ${fmt(courtW, 1)} m clear (CDDG S1.4.3 ≥ ${court} m, applied by analogy).`], cfg, cfgLabel: `L-plan, bar ${axisLabel(axis)} ${fmt(d, 1)} m deep + wing` });
      };
      cands.L_x = mkL('x', 'L_x'); cands.L_y = mkL('y', 'L_y');
    }
    const want = cfgOverride || oneCfg.v;
    const valid = Object.values(cands).filter(c => c && !c.invalid);
    if (!valid.length) return finish({ blocks: [], strips: [], stairs: [], elev: [], buildings: 1, loaded: 'single', depthNeeded: 6 + pass, travel: 0, notes: [`No ${S.label.toLowerCase()} layout fits: envelope ${fmt(Wb, 1)} × ${fmt(Db, 1)} m.`], cfg: null, cfgLabel: 'none fits', empty: true });
    // auto rule: largest net plate among layouts whose unit cap does not inflate the average unit beyond 1.5× your mix average; else largest net
    const realistic = valid.filter(c => !c.capped || c.avg <= 1.5 * avg0);
    const best = (realistic.length ? realistic : valid).reduce((b, c) => c.net > b.net ? c : b);
    let pick = (key === 'one' && want !== 'auto' && cands[want] && !cands[want].invalid) ? cands[want] : best;
    pick.cands = cands; pick.autoPick = pick === best;
    if (pick === best && realistic.length && realistic.length < valid.length) pick.notes = pick.notes.concat([`Auto rule: largest plate among layouts whose 30-unit cap keeps the average unit within 1.5× your mix average (${fmt(1.5 * avg0)} m²). Force another layout in the parameters.`]);
    const mostUnits = valid.reduce((b, c) => c.units > b.units ? c : b);
    pick.notes = pick.notes.concat([`Largest floor area: ${valid.reduce((b, c) => c.net > b.net ? c : b).cfgLabel}${mostUnits !== pick && mostUnits.units > pick.units ? `; most units: ${mostUnits.cfgLabel} (${mostUnits.units})` : ''}. ${pick.unused > 0.02 ? `${Math.round(pick.unused * 100)}% of the envelope plate unused` : 'Envelope plate fully used'}.`]);
    if (P.travelLimit.v && pick.travel > P.travelLimit.v) pick.notes.push(`Travel distance ${fmt(pick.travel, 1)} m exceeds your ${P.travelLimit.v} m limit.`);
    return pick;
  }

  /** eligibility tests for the selected scheme */
  function tests(key, m, r, sc) {
    const t = [];
    const one = key !== 'two';
    if (!one) { t.push(['Two exits — conventional', 'VBBL Div. B Part 3 (two exits baseline)', 'pass', 'No single-egress provisions engaged.']); return t; }
    t.push(['Building height ≤ 6 storeys', 'VBBL 3.2.10 (By-law 14576); RTS 17862', m.N <= 6 ? 'pass' : 'fail', `${m.N} storeys drawn.`]);
    t.push(['Non-combustible construction (concrete or fire-resistant mass timber)', 'VBBL 3.2.10; RTS 17862', A.noncomb == null ? 'na' : A.noncomb ? 'pass' : 'fail', A.noncomb == null ? 'State the construction type in the panel.' : A.noncomb ? 'Stated as non-combustible.' : 'Stated as combustible — typology not available.']);
    t.push(['Sprinklered throughout', 'VBBL 3.2.10; RTS 17862', A.sprinklered == null ? 'na' : A.sprinklered ? 'pass' : 'fail', A.sprinklered == null ? 'State in the panel.' : '']);
    if (key === 'one') t.push(['Not more than 30 dwelling units per building', 'draft §3.2.10.1.(1)(c), RTS 17862 App. A — enacted text NOT IN SOURCE', sc ? 'pass' : 'na', sc ? (sc.capped ? `Plan supports ${sc.perFloor * sc.resStoreys} units across ${sc.buildings} building${sc.buildings > 1 ? 's' : ''}; capped at 30 each — larger units, not fewer.` : `${sc.units} units in ${sc.buildings} building${sc.buildings > 1 ? 's' : ''}.`) : '']);
    t.push(['Dwelling units per floor / occupant load per floor', 'VBBL §3.1.17; 3.2.10 — limits NOT IN SOURCE for Vancouver (BCBC 4 units / 24 persons is provincial context only)', 'na', 'No occupant load derivation.']);
    t.push(['Travel distance to the exit', 'VBBL 3.2.10 / §3.4.2 — limit NOT IN SOURCE', P.travelLimit.v && sc ? (sc.travel <= P.travelLimit.v ? 'pass' : 'fail') : 'na', sc ? `Worst case in the drawn plan ${fmt(sc.travel, 1)} m (door to stair, along the passageway).${P.travelLimit.v ? '' : ' Enter a limit in the parameters to test it.'}` : 'Needs a plan.']);
    t.push(['Exit facility: exterior exit stair, exterior passageway, separation', key === 'one' ? 'VBBL 3.2.10 single exterior exit stair; §3.4.3' : 'VBBL 3.2.10 space-efficient scissor stair; §3.4.3', 'na', 'Dimensions NOT IN SOURCE — drawn at TIP values.']);
    t.push(['Exterior passageway excluded from floor area?', 'ZDB §4.1.2(a) / §10.41.3(a) — "similar appurtenance"', 'na', 'OPEN QUESTION for Planning. Tool counts it.']);
    return t;
  }

  // ---------- drawings ----------
  function drawAxon(sc, m, Wd = 360, Hd = 300, k) {
    const s = D.svg(Wd, Hd, 'dwg axon');
    const ob = D.oblique(Wd, Hd, 40); const top = m.plates[m.N - 1].z1;
    const pts3 = []; const all = sc.blocks.concat(sc.strips, sc.stairs, sc.elev);
    all.forEach(r => [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]].forEach(q => { pts3.push([q[0], q[1], 0]); pts3.push([q[0], q[1], top]); }));
    pts3.push([sc.x0, sc.y0 + sc.Db, 0]); pts3.push([sc.x0 + sc.Wb, sc.y0, 0]);
    ob.fit(pts3, k); s.dataset.k = ob.k; const Pp = q => ob.p(q);
    const rect = r => [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]];
    const prism = (poly, z0, z1, fill, stroke, sw, sideFill) => {
      const g = D.el('g', {}, s); const n = poly.length;
      D.el('polygon', { points: D.pts(D.hull(poly.flatMap(q => [Pp([q[0], q[1], z0]), Pp([q[0], q[1], z1])]))), fill, stroke, 'stroke-width': sw, 'stroke-linejoin': 'round' }, g);
      for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); const nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L; if (!ob.faces(nx, ny)) continue; D.el('polygon', { points: D.pts([Pp([a[0], a[1], z0]), Pp([b[0], b[1], z0]), Pp([b[0], b[1], z1]), Pp([a[0], a[1], z1])]), fill: sideFill || fill, stroke, 'stroke-width': 0.5 }, g); }
      D.el('polygon', { points: D.pts(poly.map(q => Pp([q[0], q[1], z1]))), fill, stroke, 'stroke-width': 0.6 }, g);
      return g;
    };
    // envelope footprint on the ground, hatched where unused
    const env = { x0: sc.x0, y0: sc.y0, x1: sc.x0 + sc.Wb, y1: sc.y0 + sc.Db };
    D.el('polygon', { points: D.pts(rect(env).map(q => Pp([q[0], q[1], 0]))), fill: 'url(#hatch)', stroke: D.INK3, 'stroke-width': 0.5, 'stroke-dasharray': '3 2' }, s);
    // plates per block, farthest block first; top plate of the front block cut back
    const order = sc.blocks.slice().sort((a, b) => b.y0 - a.y0);
    m.plates.forEach((pl, i) => {
      order.forEach(bl => {
        const cut = i === m.N - 1 && bl === sc.blocks[0] && bl.h > 6;
        const body = cut ? { x0: bl.x0, y0: bl.y0 + bl.h * 0.45, x1: bl.x1, y1: bl.y1 } : bl;
        prism(rect(body), pl.z0, pl.z1, '#fff', D.INK, 1.3, '#f1f2f4');
      });
      sc.strips.forEach(st => D.el('polygon', { points: D.pts(rect(st).map(q => Pp([q[0], q[1], pl.z0 + 0.05]))), fill: D.ACC, 'fill-opacity': 0.28, stroke: D.ACC, 'stroke-width': 0.4 }, s));
    });
    sc.elev.forEach(e => prism(rect(e), 0, top, '#8a93a3', D.INK, 1.0, '#6f7887'));
    sc.stairs.forEach(st => {
      const g = prism(rect(st), 0, top, D.ACC, D.INK, 1.1, '#173fb0');
      const a = [st.x0, st.y0], b = [st.x1, st.y0]; const runs = m.N * 2;
      for (let k = 0; k < runs; k++) { const z0 = top * k / runs, z1 = top * (k + 1) / runs; const p0 = Pp([k % 2 ? b[0] : a[0], a[1], z0]), p1 = Pp([k % 2 ? a[0] : b[0], a[1], z1]); D.el('line', { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], stroke: '#fff', 'stroke-width': 0.9 }, g); }
    });
    D.dim(s, Pp([sc.x0, sc.y0, 0]), Pp([sc.x0, sc.y0 + sc.Db, 0]), -16, `${fmt(sc.Db, 1)} m envelope depth`);
    if (sc.blocks[0]) { const bl = sc.blocks[0]; const horiz = bl.w >= bl.h; D.dim(s, Pp([bl.x1, bl.y0, 0]), Pp([bl.x1, bl.y1, 0]), 14, `${fmt(bl.h, 1)}`, { size: 8 }); }
    if (sc.unused > 0.02) D.text(s, Wd - 12, Hd - 10, `${Math.round(sc.unused * 100)}% OF PLATE UNUSED`, { anchor: 'end', size: 7.5, fill: D.INK3, attrs: { 'letter-spacing': '0.08em' } });
    D.title(s, `${sc.S.label} · cutaway`, sc.cfgLabel || '');
    return s;
  }
  function drawPlan(sc, m, Wd = 360, Hd = 260, k) {
    const s = D.svg(Wd, Hd, 'dwg egplan');
    const all = sc.blocks.concat(sc.strips, sc.stairs, sc.elev);
    const bx0 = Math.min(sc.x0, ...all.map(r => r.x0)), bx1 = Math.max(sc.x0 + sc.Wb, ...all.map(r => r.x1)), by0 = sc.y0, by1 = Math.max(sc.y0 + sc.Db, ...all.map(r => r.y1));
    const bb = [bx0 - 2, by0 - 2, bx1 + 2, by1 + 2]; const F = k ? D.fitterK(bb, Wd, Hd, k) : D.fitter(bb, Wd, Hd, 40); s.dataset.k = F.k; const p = q => F.p(q); k = F.k; const wall = 0.25 * k;
    const R2 = (r, attrs) => D.el('rect', Object.assign({ x: p([r.x0, r.y1])[0], y: p([r.x0, r.y1])[1], width: r.w * k, height: r.h * k }, attrs), s);
    // envelope hatched, blocks white with poché walls
    R2({ x0: sc.x0, y0: sc.y0, x1: sc.x0 + sc.Wb, y1: sc.y0 + sc.Db, w: sc.Wb, h: sc.Db }, { fill: 'url(#hatch)', stroke: D.INK3, 'stroke-width': 0.5, 'stroke-dasharray': '3 2' });
    sc.blocks.forEach(b => R2(b, { fill: '#fff', stroke: D.INK, 'stroke-width': wall }));
    sc.strips.forEach(st => { R2(st, { fill: D.ACC_SOFT, stroke: D.INK, 'stroke-width': 0.5 }); });
    // units: each block split into bands by any strip inside or touching it; partitions run across the band, doors open onto the strip
    const unitW = Math.max(3.5, sc.avg0 / P.unitDepth.v); const eps = 0.05;
    const bands = [];
    sc.blocks.forEach(b => {
      const horiz = b.w >= b.h;
      sc.strips.forEach(t => {
        if (horiz) { const ov = Math.min(b.x1, t.x1) - Math.max(b.x0, t.x0); if (ov < 1) return;
          if (t.y0 > b.y0 + eps && t.y1 < b.y1 - eps) { bands.push({ r: { x0: b.x0, y0: b.y0, x1: b.x1, y1: t.y0 }, horiz, side: 'top' }); bands.push({ r: { x0: b.x0, y0: t.y1, x1: b.x1, y1: b.y1 }, horiz, side: 'bottom' }); }
          else if (Math.abs(t.y0 - b.y1) < eps) bands.push({ r: b, horiz, side: 'top' }); else if (Math.abs(t.y1 - b.y0) < eps) bands.push({ r: b, horiz, side: 'bottom' }); }
        else { const ov = Math.min(b.y1, t.y1) - Math.max(b.y0, t.y0); if (ov < 1) return;
          if (t.x0 > b.x0 + eps && t.x1 < b.x1 - eps) { bands.push({ r: { x0: b.x0, y0: b.y0, x1: t.x0, y1: b.y1 }, horiz, side: 'right' }); bands.push({ r: { x0: t.x1, y0: b.y0, x1: b.x1, y1: b.y1 }, horiz, side: 'left' }); }
          else if (Math.abs(t.x0 - b.x1) < eps) bands.push({ r: b, horiz, side: 'right' }); else if (Math.abs(t.x1 - b.x0) < eps) bands.push({ r: b, horiz, side: 'left' }); }
      });
    });
    bands.forEach(({ r: b, horiz, side }) => {
      const len = horiz ? b.x1 - b.x0 : b.y1 - b.y0; const n = Math.max(1, Math.floor(len / unitW)), w = len / n;
      for (let i = 1; i < n; i++) { const a = horiz ? [b.x0 + i * w, b.y0] : [b.x0, b.y0 + i * w], c = horiz ? [b.x0 + i * w, b.y1] : [b.x1, b.y0 + i * w]; D.el('line', { x1: p(a)[0], y1: p(a)[1], x2: p(c)[0], y2: p(c)[1], stroke: D.INK, 'stroke-width': 0.5 }, s); }
      for (let i = 0; i < n; i++) {
        if (horiz) { const hx = b.x0 + i * w + 0.5, hy = side === 'top' ? b.y1 : b.y0; D.door(s, p([hx, hy])[0], p([hx, hy])[1], 0.9 * k, side === 'top' ? -90 : 90, side === 'top' ? 1 : -1); }
        else { const hy = b.y0 + i * w + 0.5, hx = side === 'right' ? b.x1 : b.x0; D.door(s, p([hx, hy])[0], p([hx, hy])[1], 0.9 * k, side === 'right' ? 0 : 180, side === 'right' ? -1 : 1); }
      }
    });
    sc.elev.forEach(e => { R2(e, { fill: '#e3e6ea', stroke: D.INK, 'stroke-width': 0.6 }); D.el('line', { x1: p([e.x0, e.y1])[0], y1: p([e.x0, e.y1])[1], x2: p([e.x1, e.y0])[0], y2: p([e.x1, e.y0])[1], stroke: D.INK, 'stroke-width': 0.4 }, s); D.el('line', { x1: p([e.x1, e.y1])[0], y1: p([e.x1, e.y1])[1], x2: p([e.x0, e.y0])[0], y2: p([e.x0, e.y0])[1], stroke: D.INK, 'stroke-width': 0.4 }, s); });
    sc.stairs.forEach(st => D.stairPlan(s, p([st.x0, st.y1])[0], p([st.x0, st.y1])[1], st.w * k, st.h * k, { treads: 12, scissor: !!st.scissor, fill: '#fff' }));
    // dims outside
    D.dim(s, p([sc.x0, sc.y0]), p([sc.x0 + sc.Wb, sc.y0]), 18, `${fmt(sc.Wb, 1)} m`);
    D.dim(s, p([bx1, sc.y0]), p([bx1, sc.y0 + sc.Db]), 18, `${fmt(sc.Db, 1)} m`);
    const fb = sc.blocks[0]; if (fb) { if (fb.w >= fb.h) D.dim(s, p([sc.x0, fb.y0]), p([sc.x0, fb.y1]), -18, `${fmt(fb.h, 1)}`, { size: 8 }); else D.dim(s, p([fb.x0, sc.y0]), p([fb.x1, sc.y0]), -18, `${fmt(fb.w, 1)}`, { size: 8 }); }
    const st0 = sc.strips[0]; if (st0) { if (st0.w >= st0.h) D.dim(s, p([sc.x0, st0.y0]), p([sc.x0, st0.y1]), -18, `${fmt(st0.h, 1)}`, { size: 8 }); else D.dim(s, p([st0.x0, sc.y0]), p([st0.x1, sc.y0]), -18, `${fmt(st0.w, 1)}`, { size: 8 }); }
    D.title(s, `${sc.S.label} · typical floor`, sc.cfgLabel || '');
    D.scaleBar(s, 12, Hd - 12, k, { units: [0, 5, 10] });
    return s;
  }

  function numbersTable(list) {
    const rows = [['Core + corridor per floor', x => fmt(x.circ) + ' m²'], ['Gross plate', x => fmt(x.gross) + ' m²'], ['Net-to-gross (drawn plate)', x => Math.round(x.n2g * 100) + '%'], ['Units per floor / per-floor limit', x => `${x.perFloor} / —`], ['Unit count', x => `${x.units}${x.capped ? ' (cap)' : ''}`], ['Average unit size', x => fmt(x.avg) + ' m²'], ['Minimum dimension across a bar', x => fmt(x.depthNeeded, 1) + ' m'], ['Envelope plate unused', x => Math.round((x.unused || 0) * 100) + '%'], ['Configuration', x => x.cfgLabel || (x.loaded + '-loaded')], ['Worst travel to the exit (plan)', x => fmt(x.travel, 1) + ' m' + (P.travelLimit.v ? ` / ${P.travelLimit.v}` : ' / —')], ['Buildings', x => x.buildings]];
    return `<table class="cmp num5"><thead><tr><th></th>${list.map(x => `<th>${x.S.label}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]}</td>${list.map(x => `<td class="num">${r[1](x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function renderParams() {
    const box = $('eg-params'); if (box.children.length) return;
    box.innerHTML = `<label>One-exit configuration <select id="eg-cfg">${Object.entries(CFG).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>` + Object.entries(P).map(([k, p]) => `<label>${p.label} <span><input type="number" step="0.1" data-k="${k}" value="${p.v}"> m</span></label><p class="src2">${p.src}</p>`).join('') +
      `<label>Construction <select id="eg-noncomb"><option value="">not stated</option><option value="1">non-combustible (concrete / fire-resistant mass timber)</option><option value="0">combustible (wood frame)</option></select></label>
       <label>Sprinklers <select id="eg-spr"><option value="">not stated</option><option value="1">sprinklered throughout</option><option value="0">not sprinklered</option></select></label>`;
    box.querySelectorAll('input').forEach(i => i.onchange = () => { P[i.dataset.k].v = +i.value; window.APP.refresh(); });
    $('eg-cfg').onchange = e => { oneCfg.v = e.target.value; window.APP.refresh(); };
    $('eg-noncomb').onchange = e => { A.noncomb = e.target.value === '' ? null : e.target.value === '1'; window.APP.refresh(); };
    $('eg-spr').onchange = e => { A.sprinklered = e.target.value === '' ? null : e.target.value === '1'; window.APP.refresh(); };
  }
  return { P, A, SCHEMES, CFG, oneCfg, scheme, tests, drawAxon, drawPlan, numbersTable, renderParams };
})();
