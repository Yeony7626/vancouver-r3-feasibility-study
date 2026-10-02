/* summary-sheet.js: the feasibility summary at the top of the review report. Four bands, read top to bottom:
   1. the verdict (does it work, what sets its size, what to check), with the four figures a buyer asks for;
   2. the FSR scale (tiers as ticks, this design as one blue marker; no fill, it is not a score);
   3. units by bedrooms (a pie) beside 4. egress on the floor with the worst route: that route, stair separation and dead ends, dimensioned actual / limit.
   Everything is read from REVIEW.summary() and the generated levels: nothing here is computed that the code table does not
   also report. Blue marks only this design's value and its failures (DESIGN.md, Summary blue). */
(function (root) {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f = (n, d = 1) => Number.isFinite(n) ? n.toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  // FSR to 2 places, or 3 when the design sits within 0.01 of the permitted value (so 2.403 against 2.400 reads as over)
  const fsr2 = (v, other) => f(v, Number.isFinite(other) && Math.abs(v - other) < .01 && Math.abs(v - other) > 1e-6 ? 3 : 2);
  const f0 = n => Number.isFinite(n) ? Math.round(n).toLocaleString('en-CA') : '—';
  const INK = '#111417', INK2 = '#3d434b', INK3 = '#6a7079', LINE = '#8b9097', RULE = '#c9ccd0', RULE2 = '#e4e6e9', BLUE = '#1a56db', CORR = '#e6e8eb';
  const key = item => item.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // the order a failure is named in the headline, with its short phrase
  const PHRASE = [['occupancy-and-construction', 'no construction type fits'], ['sprinklered-throughout', 'not sprinklered above 3 storeys'], ['floor-space-ratio', 'over the permitted FSR'], ['building-height', 'over the height limit'], ['number-of-exits-per-floor', 'fewer than 2 exits'], ['distance-between-exits', 'exit stairs too close'], ['travel-distance-to-an-exit', 'travel to an exit too long'], ['dead-end-corridor', 'dead-end corridor too long'], ['public-corridor-width', 'corridor too narrow'], ['unit-mix-2-or-more-bedrooms', 'short of the 2-bedroom mix'], ['unit-mix-3-or-more-bedrooms', 'short of the 3-bedroom mix'], ['scissor-stairs', 'scissor stairs not allowed here'], ['scissor-stair', 'scissor stair not allowed here'], ['single-exterior-exit-stair', 'outside the single-exit limits']];

  const hatch = (id, angle, pitch, color, w = .8, cross = false) => `<pattern id="${id}" width="${pitch}" height="${pitch}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})"><line x1="0" y1="0" x2="0" y2="${pitch}" stroke="${color}" stroke-width="${w}"/>${cross ? `<line x1="0" y1="0" x2="${pitch}" y2="0" stroke="${color}" stroke-width="${w}"/>` : ''}</pattern>`;
  const DEFS = `<defs>${hatch('sv-b1', 45, 6, INK3, .7)}${hatch('sv-b2', 45, 3, INK3, .7)}${hatch('sv-b3', 45, 3, INK3, .7, true)}${hatch('sv-dead', 45, 2, INK3, .6)}</defs>`;

  // ---------- 1. verdict ----------
  function verdict(rep, r, ctx, o) {
    const rows = rep.rows.map(q => { const k = key(q.item); return k === 'floor-space-ratio' ? { ...q, key: k, value: fsr2(r.achieved, ctx.permitted), req: fsr2(ctx.permitted, r.achieved) } : { ...q, key: k }; });
    const fails = rows.filter(q => q.status === 'fail').sort((a, b) => rank(a.key) - rank(b.key));
    // study checks (limits you entered, the courtyard, ground-floor routes) change the headline without failing the code
    const study = (rep.study || []).filter(q => q.status === 'fail').map(q => ({ item: q.item, value: '', key: 'study-' + q.id })), n = study.length;
    const head = !r?.count ? 'Not yet assessed: generate units to check the plan'
      : fails.length ? `Not feasible as drawn: ${phrase(fails[0].key)}${fails.length > 1 ? ` and ${fails.length - 1} more` : ''}`
        : n ? `Feasible as drawn · ${n} study check${n === 1 ? '' : 's'} not met` : 'Feasible as drawn';
    const b = binding(r, ctx, o), items = (label, list) => list.length ? `<p class="sv-items"><span>${label}</span>${list.map(q => `<button type="button" data-sv-goto="${q.key}">${esc(q.item)}${q.value ? ' ' + esc(q.value) : ''}${q.req ? ' / ' + esc(q.req.replace(/^[≤≥]\s*/, '')) : ''}</button>`).join('<i> · </i>')}</p>` : '';
    const M = rep.M, gross = (r.levels || []).reduce((s, l) => s + (l.ledger?.built || 0), 0), net = (r.levels || []).reduce((s, l) => s + (l.ledger?.net || 0), 0), left = (ctx.permitted || 0) - (r.achieved || 0);
    const fig = (label, value, note) => `<div><span>${label}</span><b>${value}</b><small>${note}</small></div>`;
    return `<section class="sv-band sv-verdict"><p class="sv-notation">04 / REVIEW · FEASIBILITY SUMMARY</p>
      <h2>${esc(head)}</h2>
      <p class="sv-schematic"><b>Schematic:</b> read from the drawn plan, not a zoning or building code determination.</p>
      ${r?.count && rep.tally && root.REVIEW?.tallyHtml ? root.REVIEW.tallyHtml(rep.tally, 'rv-counts sv-tally') : ''}
      ${r?.count ? `<p class="sv-bind">${esc(b.head)}</p><p class="sv-bind-note">${esc(b.note)}</p>` : ''}
      ${items('Does not meet', fails)}${items('Study check not met', study)}${rep.verify?.length ? `<p class="sv-items"><span>To verify</span><button type="button" data-sv-goto="verify">${rep.verify.length} items not checked by this study</button></p>` : ''}
      <div class="sv-figures">${fig('Units', r?.count ? f0(M.count) : '—', r?.count ? ['S', '1B', '2B', '3B'].map(t => `${M.tot[t] || 0} ${t}`).join(' · ') : '')}
      ${fig('FSR', r?.count ? `${fsr2(r.achieved, ctx.permitted)} / ${fsr2(ctx.permitted, r.achieved)}` : '—', r?.count ? (left >= 0 ? `${fsr2(left, 0)} below permitted` : `${fsr2(-left, 0)} over permitted`) : '')}
      ${fig('Net floor area', r?.count ? `${f0(net)} m²` : '—', r?.count ? `of ${f0(gross)} m² gross floor area` : '')}
      ${fig('Net to gross', r?.count && gross ? `${f(net / gross * 100, 1)}%` : '—', 'net units ÷ gross')}</div></section>`;
  }
  const rank = k => { const i = PHRASE.findIndex(p => p[0] === k); return i < 0 ? 99 : i; };
  const phrase = k => (PHRASE.find(p => p[0] === k) || [0, 'a check is not met'])[1];
  function heightOf(o, ctx) { const N = o.floors; return (o.commercial ? o.groundFtf + (N - 1) * o.ftf : N * o.ftf) + (ctx.roof || 0); }
  // What stops the next storey: height, FSR, both, or neither (area left over).
  function binding(r, ctx, o) {
    const H = heightOf(o, ctx), limit = ctx.height, next = H + o.ftf, levels = r.levels || [], typical = levels[Math.min(1, levels.length - 1)]?.ledger?.built || o.W * o.D;
    const area = ctx.area || 1, fsrNext = ((r.countable || 0) + typical) / area, left = (ctx.permitted || 0) - (r.achieved || 0);
    const hBinds = Number.isFinite(limit) && next > limit + 1e-6, fBinds = fsrNext > (ctx.permitted || 0) + 1e-6;
    if (hBinds && fBinds) return { head: 'Height and FSR both set the size.', note: `A ${ordinal(o.floors + 1)} storey would exceed both: ${f(next)} m against the ${f(limit)} m limit, and FSR ${f(fsrNext, 2)} against ${f(ctx.permitted, 2)}.` };
    if (hBinds) return { head: 'Height sets the size, not FSR.', note: `A ${ordinal(o.floors + 1)} storey would reach ${f(next)} m against the ${f(limit)} m limit; FSR has ${f(Math.max(0, left), 2)} left.` };
    if (fBinds) return { head: 'FSR sets the size, not height.', note: `A ${ordinal(o.floors + 1)} storey would exceed the permitted FSR (${f(fsrNext, 2)} against ${f(ctx.permitted, 2)}); height still has ${f(limit - H)} m left.` };
    return { head: `Neither height nor FSR is reached: ${f(Math.max(0, left), 2)} FSR unused.`, note: `The massing or the plate stops short of the limits; height has ${f(limit - H)} m left.` };
  }
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

  // ---------- 2a. FSR scale ----------
  // Tiers hang below the axis (name over value), the permitted tier set in ink; this design is the one blue marker above.
  const TIERS = [[1.6, 'Base'], [2.2, 'Rental tier'], [2.4, 'Rental tier'], [2.7, 'Social, large site'], [3.0, 'TOA or BMR']];
  function fsrScale(r, ctx) {
    const W = 880, L = 24, R = W - 24, x = v => L + (R - L) * v / 3.3, P = ctx.permitted || 0, A = r.achieved || 0, y = 44;
    let s = `<svg class="sv-svg" viewBox="0 0 ${W} 104" role="img" aria-labelledby="sv-fsr-t sv-fsr-d"><title id="sv-fsr-t">Floor space ratio</title><desc id="sv-fsr-d">Achieved FSR ${f(A, 2)} against a permitted ${f(P, 2)}; tiers ${TIERS.map(t => t[0].toFixed(2)).join(', ')}.</desc>`;
    s += `<line x1="${L}" y1="${y}" x2="${x(P)}" y2="${y}" stroke="${INK}" stroke-width="1"/><line x1="${x(P)}" y1="${y}" x2="${R}" y2="${y}" stroke="${LINE}" stroke-dasharray="4 3"/>`;
    s += `<line x1="${L}" y1="${y - 4}" x2="${L}" y2="${y + 4}" stroke="${INK}"/><text x="${L}" y="${y + 18}" text-anchor="middle" class="sv-t-axis">0</text>`;
    const tiers = TIERS.some(t => Math.abs(t[0] - P) < .005) || !P ? TIERS : [...TIERS, [P, 'Permitted']].sort((a, b) => a[0] - b[0]);
    let row = 0, lastX = -99;
    for (const [v, name] of tiers) {
      const X = x(v), on = Math.abs(v - P) < .005; row = X - lastX < 96 ? 1 - row : 0; lastX = X;
      const ty = y + 18 + row * 26;
      s += `<line x1="${X}" y1="${y}" x2="${X}" y2="${y + (on ? 10 : 6)}" stroke="${on ? INK : LINE}"/>${row ? `<line x1="${X}" y1="${y + 6}" x2="${X}" y2="${ty - 10}" stroke="${RULE}"/>` : ''}`;
      s += `<text x="${X}" y="${ty}" text-anchor="middle" class="${on ? 'sv-t-strong' : 'sv-t-tier'}">${on ? 'Permitted' : esc(name)}</text><text x="${X}" y="${ty + 12}" text-anchor="middle" class="${on ? 'sv-t-mono' : 'sv-t-axis'}">${v.toFixed(2)}</text>`;
    }
    if (A) { const X = x(A); s += `<path d="M${X - 5} ${y - 12} L${X + 5} ${y - 12} L${X} ${y - 3} Z" fill="${BLUE}"/><text x="${X}" y="${y - 18}" text-anchor="${X > R - 80 ? 'end' : 'middle'}" class="sv-t-mono">This design ${f(A, 2)}</text>`; }
    return `<section class="sv-band"><h3>Floor space ratio</h3>${s}</svg></section>`;
  }

  // ---------- 3. unit mix by bedrooms: a pie, one hatch per type as in the plan legend ----------
  const TYPES = [['S', 'Studio', '#ffffff'], ['1B', '1 bed', 'url(#sv-b1)'], ['2B', '2 bed', 'url(#sv-b2)'], ['3B', '3 bed', 'url(#sv-b3)']];
  function mixPie(rep) {
    const M = rep.M, mix = rep.mix, n = M.count || 0; if (!n) return '';
    const W = 400, H = 250, cx = 118, cy = 122, rad = 92;
    let s = `<svg class="sv-svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="sv-mix-t sv-mix-d"><title id="sv-mix-t">Units by bedrooms</title><desc id="sv-mix-d">${TYPES.map(([k, label]) => `${label} ${M.tot[k] || 0}`).join(', ')} of ${n} units.</desc>${DEFS}`;
    let a0 = -Math.PI / 2, row = 0;
    for (const [k, label, fill] of TYPES) {
      const c = M.tot[k] || 0; if (!c) continue;
      const a1 = a0 + 2 * Math.PI * c / n, big = a1 - a0 > Math.PI ? 1 : 0, P = a => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)], [x0, y0] = P(a0), [x1, y1] = P(a1);
      s += c === n ? `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${fill}" stroke="${INK}" stroke-width="1"/>` : `<path d="M${cx} ${cy} L${x0} ${y0} A${rad} ${rad} 0 ${big} 1 ${x1} ${y1} Z" fill="${fill}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`;
      // labels sit in a column at the right, keyed by the same hatch
      const ly = 40 + row * 48, lx = 250;
      s += `<rect x="${lx}" y="${ly - 13}" width="12" height="12" fill="${fill}" stroke="${INK}" stroke-width=".8"/><text x="${lx + 20}" y="${ly - 3}" class="sv-t-strong">${label}</text><text x="${lx + 20}" y="${ly + 12}" class="sv-t-mono">${c} · ${f(c / n * 100, 0)}%</text>`;
      a0 = a1; row++;
    }
    const pct = v => f(v * 100, 0) + '%', ok = mix.twoOK && (mix.threeOK || !mix.req.three);
    const line = `2 or more bedrooms ${mix.two} of ${n} · ${pct(mix.twoShare)} / ${pct(mix.req.two)} required${mix.req.three ? ` · 3 bedrooms ${mix.three} · ${pct(mix.threeShare)} / ${pct(mix.req.three)}` : ''} · ${ok ? 'meets' : 'does not meet'}`;
    return `<section class="sv-half sv-mix"><h3>Units by bedrooms</h3>${s}</svg><p class="sv-status">${esc(line)}</p></section>`;
  }

  // ---------- 4. egress on the floor with the worst route ----------
  // a revision cloud: scallops along the box edges, drawn round a failing item
  function arcCloud(b, pad) { const x0 = b.x - pad, y0 = b.y - pad, x1 = b.x + b.w + pad, y1 = b.y + b.h + pad, r = .45, pts = []; const edge = (ax, ay, bx, by) => { const L = Math.hypot(bx - ax, by - ay), n = Math.max(2, Math.round(L / (2 * r))); for (let i = 0; i < n; i++) pts.push([ax + (bx - ax) * i / n, ay + (by - ay) * i / n]); }; edge(x0, y0, x1, y0); edge(x1, y0, x1, y1); edge(x1, y1, x0, y1); edge(x0, y1, x0, y0); let d = `M${pts[0][0]} ${pts[0][1]}`; for (let i = 0; i < pts.length; i++) { const q = pts[(i + 1) % pts.length], rr = Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]) / 2; d += ` A${rr} ${rr} 0 0 1 ${q[0]} ${q[1]}`; } return d + ' Z'; }
  function egress(rep, r, ctx, o) {
    const floors = rep.floors || [], V = root.RULES?.VBBL || {}, deadLim = V.deadEnd?.v || 6;
    const bad = fl => fl.unreached || (fl.worst && fl.worst.near > fl.limit) || (fl.sep != null && fl.sep < fl.sepReq) || (fl.deadEnd || 0) > deadLim;
    const pick = floors.find(bad) || floors.reduce((m, fl) => fl.worst && (!m || fl.worst.near > m.worst.near + .05 || (Math.abs(fl.worst.near - m.worst.near) <= .05 && m.level === 1)) ? fl : m, null);
    if (!pick) return '';
    const l = (r.levels || []).find(q => q.level === pick.level), g = l?.g; if (!g) return '';
    // the same orientation as the plan views: project north up
    const rot = ctx.projectRotation ?? ctx.siteRotation ?? 0, ca = Math.cos(rot), sa = Math.sin(rot), T = p => [ca * p[0] + sa * p[1], sa * p[0] - ca * p[1]];
    const TR = q => { const ps = [[q.x, q.y], [q.x + q.w, q.y], [q.x, q.y + q.h], [q.x + q.w, q.y + q.h]].map(T), xs = ps.map(p => p[0]), ys = ps.map(p => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; };
    const box = g.built.map(TR), X0 = Math.min(...box.map(b => b.x)), Y0 = Math.min(...box.map(b => b.y)), PW = Math.max(...box.map(b => b.x + b.w)) - X0, PD = Math.max(...box.map(b => b.y + b.h)) - Y0;
    const W = 420, pad = 30, k = Math.min((W - 2 * pad) / PW, 260 / PD), H = PD * k + 2 * pad, ox = pad - X0 * k + ((W - 2 * pad) - PW * k) / 2, oy = pad - Y0 * k;
    const px = p => { const q = T(p); return [ox + q[0] * k, oy + q[1] * k]; }, R = q => { const b = TR(q); return `x="${ox + b.x * k}" y="${oy + b.y * k}" width="${b.w * k}" height="${b.h * k}"`; };
    let routeText = '';
    const fails = [], stairs = g.cores.filter(c => c.kind !== 'elevator'), letter = i => String.fromCharCode(65 + i), name = lab => { const m = /(\d+)/.exec(lab || ''); return m ? 'Stair ' + letter(+m[1] - 1) : (lab || 'stair'); };
    let s = DEFS;
    s += g.built.map(b => `<rect ${R(b)} fill="#ffffff" stroke="${LINE}" stroke-width="1"/>`).join('');
    s += (l.units || []).flatMap(u => (u.parts || [u])).map(p => `<rect ${R(p)} fill="none" stroke="${RULE}" stroke-width=".6"/>`).join('');
    s += g.corridors.map(c => `<rect ${R(c)} fill="${CORR}" stroke="none"/>`).join('');
    s += g.cores.map(c => { const lab = c.kind === 'elevator' ? 'Lift' : 'Stair ' + letter(stairs.indexOf(c)), [cx, cy] = px([c.x + c.w / 2, c.y + c.h / 2]); return `<rect ${R(c)} fill="#ffffff" stroke="${INK}" stroke-width="1"/><text x="${cx}" y="${cy + 3}" text-anchor="middle" class="sv-t-small">${lab}</text>`; }).join('');
    // the street edge, named, so the plan reads the right way round
    const side = o.streetSide || 'top', E = { top: [[0, 0], [o.W, 0]], bottom: [[0, o.D], [o.W, o.D]], left: [[0, 0], [0, o.D]], right: [[o.W, 0], [o.W, o.D]] }[side];
    if (E) { const a = px(E[0]), b = px(E[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, cx = ox + (X0 + PW / 2) * k, cy = oy + (Y0 + PD / 2) * k, dx = mx - cx, dy = my - cy, L = Math.hypot(dx, dy) || 1; s += `<text x="${mx + dx / L * 16}" y="${my + dy / L * 16 + 4}" text-anchor="middle" class="sv-t-tier">Street</text>`; }
    // dead ends: hatched along the corridor, length above
    for (const d of l.route?.deadEnds || []) { if (d.length < 1) continue; const over = d.length > deadLim + 1e-6, a = px(d.points[0]), b = px(d.points[d.points.length - 1]), w = Math.max(6, (o.corridor || 1.8) * k * .8); s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="url(#sv-dead)" stroke-width="${w}"/>`; s += `<text x="${a[0]}" y="${a[1] - w / 2 - 4}" text-anchor="middle" class="sv-t-small sv-halo">${over ? `Dead end ${f(d.length)} / ${f(deadLim)} m` : `${f(d.length)} m`}</text>`; if (over) fails.push({ pts: d.points, label: 'Dead end' }); }
    // stair separation: a dimension between the stair doors, labelled under its midpoint
    const exits = (l.route?.exits || []).filter(e => e.point); let sepFail = false;
    if (exits.length >= 2 && pick.sep != null) { let best = null; for (let i = 0; i < exits.length; i++)for (let j = i + 1; j < exits.length; j++) { const d = Math.abs(exits[i].point[0] - exits[j].point[0]) + Math.abs(exits[i].point[1] - exits[j].point[1]); if (!best || d > best.d) best = { d, a: exits[i].point, b: exits[j].point }; } const a = px(best.a), b = px(best.b), off = 14; s += `<line x1="${a[0]}" y1="${a[1] + off}" x2="${b[0]}" y2="${b[1] + off}" stroke="${INK2}" stroke-width=".8"/>${[a, b].map(q => `<line x1="${q[0]}" y1="${q[1] + 4}" x2="${q[0]}" y2="${q[1] + off + 4}" stroke="${INK2}" stroke-width=".6"/><line x1="${q[0] - 3}" y1="${q[1] + off + 3}" x2="${q[0] + 3}" y2="${q[1] + off - 3}" stroke="${INK2}"/>`).join('')}<text x="${(a[0] + b[0]) / 2}" y="${(a[1] + b[1]) / 2 + off + 14}" text-anchor="middle" class="sv-t-small sv-halo">${o.stair === 'scissor' ? `Scissor doors ${f(pick.sep)} m apart / ${f(pick.sepReq)} m min` : `Stairs ${f(pick.sep)} m apart / ${f(pick.sepReq)} m min`}</text>`; if (pick.sep < pick.sepReq - 1e-6) { sepFail = true; fails.push({ pts: [best.a, best.b], label: 'Stair separation' }); } }
    // the worst route, door to stair
    const worst = pick.worst, path = worst && (l.route?.paths || []).find(p => p.unit === worst.id), leg = path && (path.toExits || [path]).filter(t => Number.isFinite(t.distance)).sort((a, b) => a.distance - b.distance)[0];
    if (leg?.points?.length) {
      const pts = leg.points.map(px), a = pts[0], e = pts[pts.length - 1], p2 = pts[pts.length - 2] || a, ang = Math.atan2(e[1] - p2[1], e[0] - p2[0]), unit = root.EXPLORE?.unitNo ? root.EXPLORE.unitNo(pick.level, worst.id) : worst.id;
      s += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${BLUE}" stroke-width="1.5" stroke-dasharray="6 3"/><circle cx="${a[0]}" cy="${a[1]}" r="3" fill="#ffffff" stroke="${BLUE}" stroke-width="1.5"/>`;
      s += `<path d="M${e[0]} ${e[1]} l${-7 * Math.cos(ang - .45)} ${-7 * Math.sin(ang - .45)} M${e[0]} ${e[1]} l${-7 * Math.cos(ang + .45)} ${-7 * Math.sin(ang + .45)}" stroke="${BLUE}" stroke-width="1.5" fill="none"/>`;
      const mid = pts[Math.floor((pts.length - 1) / 2)], mid2 = pts[Math.floor((pts.length - 1) / 2) + 1] || mid, mx = (mid[0] + mid2[0]) / 2, my = (mid[1] + mid2[1]) / 2; routeText = `Unit ${unit} → ${name(leg.label)}`;
      s += `<text x="${mx}" y="${my - 11}" text-anchor="middle" class="sv-t-mono sv-halo" style="fill:${BLUE}">${f(worst.near)} / ${f(pick.limit)} m</text>`;
      if (worst.near > pick.limit + 1e-6) fails.push({ pts: leg.points, label: 'Travel' });
    }
    for (const q of fails) { const ps = q.pts.map(px), xs = ps.map(p => p[0]), ys = ps.map(p => p[1]); s += `<path d="${arcCloud({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }, 10)}" fill="none" stroke="${BLUE}" stroke-width="1.5"/>`; }
    const word = ok => ok ? 'meets' : 'does not meet', figs = [['Travel to exit', worst ? `${f(worst.near)} / ${f(pick.limit)} m` : '—', worst ? word(worst.near <= pick.limit + 1e-6 && !pick.unreached) : 'verify'],
      o.stair === 'scissor' ? ['Scissor door separation', pick.sep != null ? `${f(pick.sep)} / ${f(pick.sepReq)} m` : '—', pick.sep == null ? 'verify' : word(!sepFail)] : ['Stair separation', pick.sep != null ? `${f(pick.sep)} / ${f(pick.sepReq)} m` : '—', pick.sep == null ? 'verify' : word(!sepFail)],
      ['Dead end', `${f(pick.deadEnd || 0)} / ${f(deadLim)} m`, word((pick.deadEnd || 0) <= deadLim + 1e-6)],
      ['Exits on this floor', String(pick.exitCount), pick.exitCount >= 2 ? 'meets' : 'verify']];
    const desc = `Floor ${pick.level}: worst route ${worst ? f(worst.near) : '—'} metres against ${f(pick.limit)}; stairs ${pick.sep != null ? f(pick.sep) : '—'} metres apart against ${f(pick.sepReq)} minimum; longest dead end ${f(pick.deadEnd || 0)} metres.${fails.length ? ' Does not meet: ' + fails.map(q => q.label).join(', ') + '.' : ''}`;
    const why = bad(pick) ? 'the floor with a failing route' : 'the floor with the longest route';
    return `<section class="sv-half sv-egress"><h3>Egress · floor ${pick.level}</h3><p class="sv-status">Shown: ${why}.</p><div class="sv-egress-grid">
      <svg class="sv-svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="sv-eg-t sv-eg-d"><title id="sv-eg-t">Egress on floor ${pick.level}</title><desc id="sv-eg-d">${esc(desc)}</desc>${s}</svg>
      <dl class="sv-egress-figs">${figs.map(([a, b, c], i) => `<div><dt>${a}</dt><dd><b>${b}</b> <span>${c}</span>${i === 0 && routeText ? `<small>${esc(routeText)}</small>` : ''}</dd></div>`).join('')}</dl></div></section>`;
  }
  const bboxPts = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; };

  function html(rep, r, ctx, o) {
    if (!r?.ok || !o) return '';
    return `<div class="sv">${verdict(rep, r, ctx, o)}${r.count ? fsrScale(r, ctx) + `<div class="sv-pair">${mixPie(rep)}${egress(rep, r, ctx, o)}</div>` : ''}</div>`;
  }

  // hover / focus readout and jump to a code-table row; one delegated listener each
  if (root.document) {
    const read = e => { const el = e.target.closest?.('[data-sv-read]'); if (!el) return; const out = el.closest('.sv')?.querySelector('.sv-readout'); if (out) out.textContent = el.getAttribute('data-sv-read'); };
    root.document.addEventListener('mouseover', read); root.document.addEventListener('focusin', read);
    root.document.addEventListener('click', e => {
      const b = e.target.closest?.('[data-sv-goto]'); if (!b) return;
      const row = root.document.getElementById('rv-row-' + b.dataset.svGoto); if (!row) return;
      row.scrollIntoView({ behavior: 'smooth', block: 'center' }); row.classList.remove('rv-cue'); void row.offsetWidth; row.classList.add('rv-cue');
    });
  }
  root.SUMMARY_SHEET = { html, binding, key };
})(typeof window !== 'undefined' ? window : globalThis);
