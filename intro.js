/* intro.js: the first-visit cover sheet. One drawing builds itself on a real example lot (577 E 8th Av, run through this
   tool's engine and baked into data/intro-example.js) in five beats that match the five things a user does: pick a site,
   see what is allowed, set the brief, generate the plan, review it. A timeline under the drawing plays on its own and can be
   clicked or dragged to any beat. "Open the example" runs the real tool on that lot (massing confirmed, plan generated)
   and lands on Review with the verdict, then offers a short tour of the finished result.
   The front page on every load (?nointro skips it), reopened from "Replay intro"; the welcome stops on the sheet and the demo runs from Play the demo; reduced motion gets the finished drawing and static beats. */
(function (root) {
  'use strict';
  const doc = root.document, X = () => root.R3_INTRO_EXAMPLE, KEY = 'r3-intro-seen', BEAT = 2.1, STEPS = 5;
  const still = () => root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const REST = .999; // the sheet at rest: the lot drawn and tinted, step 1 current, before the demo
  const clamp = v => Math.max(0, Math.min(1, v)), ease = p => 1 - Math.pow(1 - clamp(p), 3), lerp = (a, b, k) => a + (b - a) * k;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (v, d = 2) => Number(v).toFixed(d);
  const COPY = [
    ['Pick a site', 'Click an R3 parcel on the City map. Shift-click a neighbour to combine lots.'],
    ['See what is allowed', 'The R3 schedule sets the FSR and height. Yards clip the buildable envelope.'],
    ['Set the brief', 'Choose stairs, lifts and corridor. The massing stacks to the storeys allowed.'],
    ['Generate the plan', 'Cores, corridors and homes are placed on every floor, ready to edit by hand.'],
    ['Review and present', 'Exit routes, unit mix and FSR are checked, then shown in context.']
  ];

  // ---------- the drawing ----------
  const pts = ps => ps.map(p => p.join(',')).join(' ');
  const centroid = ps => ps.reduce((a, p) => [a[0] + p[0] / ps.length, a[1] + p[1] / ps.length], [0, 0]);
  const HATCH = { S: 'url(#ih-s)', '1B': 'url(#ih-1)', '2B': 'url(#ih-2)', '3B': 'url(#ih-3)' };
  const RISE = [1.2, -1.9]; // the oblique step of each stacked plate, metres
  function svg(x) {
    const xs = x.lot.map(p => p[0]), ys = x.lot.map(p => p[1]), pad = 13, top = (x.floors - 1) * -RISE[1] + pad;
    const vb = [Math.min(...xs) - pad, Math.min(...ys) - top, Math.max(...xs) - Math.min(...xs) + 2 * pad + (x.floors - 1) * RISE[0], Math.max(...ys) - Math.min(...ys) + pad + top];
    const hatch = (id, gap, cross) => `<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${gap}" height="${gap}" fill="#fff"/>${gap ? `<path d="M0 0V${gap}" stroke="#8b9097" stroke-width=".07"/>` : ''}${cross ? `<path d="M0 0H${gap}" stroke="#8b9097" stroke-width=".07"/>` : ''}</pattern>`;
    const plates = x.levels.map((lv, j) => `<g class="ii-plate" data-j="${j}">${lv.map(p => `<polygon points="${pts(p)}"/>`).join('')}</g>`).join('');
    const units = x.plan.units.map((u, k) => `<g class="ii-unit" data-k="${k}" data-c="${centroid(u.parts.flat()).join(',')}">${u.parts.map(p => `<polygon points="${pts(p)}" fill="${HATCH[u.type] || '#fff'}"/>`).join('')}</g>`).join('');
    const cores = x.plan.cores.map((c, k) => `<polygon class="ii-core" data-k="${k}" data-c="${centroid(c.poly).join(',')}" points="${pts(c.poly)}"/>`).join('');
    const route = x.route ? `<polyline class="ii-route" pathLength="1" points="${pts(x.route.points)}"/><circle class="ii-route-a" cx="${x.route.points[0][0]}" cy="${x.route.points[0][1]}" r=".55"/>` : '';
    const street = x.streets.map(([a, b]) => { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], c = centroid(x.lot), d = [m[0] - c[0], m[1] - c[1]], L = Math.hypot(...d) || 1; return `<text class="ii-street" x="${m[0] + d[0] / L * 4.5}" y="${m[1] + d[1] / L * 4.5 + .6}" text-anchor="middle">STREET</text>`; }).join('');
    return `<svg class="intro-svg" viewBox="${vb.map(v => v.toFixed(2)).join(' ')}" role="img" aria-labelledby="intro-svg-t"><title id="intro-svg-t">${esc(x.addr)}: the lot, its envelope, the stacked massing and the generated plan, drawn by this tool</title>
      <defs>${hatch('ih-s', 0)}${hatch('ih-1', 1.1)}${hatch('ih-2', .55)}${hatch('ih-3', .55, true)}</defs>
      <g class="ii-nb">${x.neighbours.map(p => `<polygon points="${pts(p)}"/>`).join('')}</g>
      <polygon class="ii-lot-fill" points="${pts(x.lot)}"/><polygon class="ii-lot" pathLength="1" points="${pts(x.lot)}"/>${street}
      <polygon class="ii-env" points="${pts(x.lot)}"/>
      <g class="ii-stack">${plates}</g>
      <g class="ii-plan"><g class="ii-corr">${x.plan.corridors.map(p => `<polygon points="${pts(p)}"/>`).join('')}</g>${units}${cores}${x.plan.built.map(p => `<polygon class="ii-wall" pathLength="1" points="${pts(p)}"/>`).join('')}</g>
      ${route}</svg>`;
  }
  // set the drawing to time t in [0, 5]: beat k runs from k to k + 1
  function frame(box, x, t) {
    const p = k => clamp(t - k), q = sel => box.querySelectorAll(sel), one = sel => box.querySelector(sel);
    const lot = x.lot, env = x.env;
    // 1. the lot: neighbours settle, the lot outline is drawn, then tinted
    one('.ii-nb').style.opacity = .35 + .65 * ease(p(0) * 1.6);
    one('.ii-lot').style.strokeDashoffset = 1 - ease(p(0) * 1.4);
    one('.ii-lot-fill').style.opacity = ease((p(0) - .45) * 2) * (1 - .7 * ease((p(3) - .2) * 3));
    q('.ii-street').forEach(s => { s.style.opacity = ease((p(0) - .5) * 2); });
    // 2. the envelope: the lot outline clips inward to the yards
    const k1 = ease(p(1) * 1.3); one('.ii-env').setAttribute('points', pts(lot.map((v, i) => { const e = env[i] || v; return [lerp(v[0], e[0], k1), lerp(v[1], e[1], k1)]; })));
    one('.ii-env').style.opacity = t < 1 ? 0 : 1 - .6 * ease((p(3) - .3) * 3);
    // 3. the massing: plates stack to the storeys allowed. 4. they settle back to the plan
    const F = x.floors, settle = ease(p(3) / .35), stackK = ease(p(2) * 1.15);
    q('.ii-plate').forEach(g => { const j = +g.dataset.j, show = clamp(stackK * F - j), off = j * (1 - settle); g.style.opacity = t < 2 ? 0 : j === 0 ? 1 - ease((p(3) - .3) * 4) : show * (1 - settle); g.setAttribute('transform', `translate(${RISE[0] * off * show} ${RISE[1] * off * show})`); });
    // 4. the plan: walls drawn, corridor opens, cores land, homes fill one by one
    const k4 = clamp((p(3) - .3) / .7);
    q('.ii-wall').forEach(w => { w.style.strokeDashoffset = 1 - ease(k4 * 1.6); w.style.opacity = t < 3.3 ? 0 : 1; });
    one('.ii-corr').style.opacity = ease((k4 - .15) * 3);
    const pop = (el, k) => { const [cx, cy] = el.dataset.c.split(',').map(Number), s = lerp(1.25, 1, ease(k)); el.style.opacity = ease(k); el.setAttribute('transform', `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`); };
    q('.ii-core').forEach(c => pop(c, (k4 - .25 - +c.dataset.k * .06) * 4));
    const nu = q('.ii-unit').length; q('.ii-unit').forEach(u => { const k = +u.dataset.k; u.style.opacity = ease((k4 - .4 - k * (.5 / Math.max(1, nu))) * 5); });
    // 5. the review: the longest exit route is traced, then the verdict lands
    const r = one('.ii-route'); if (r) { r.style.strokeDashoffset = 1 - ease(p(4) * 1.5); r.style.opacity = t < 4 ? 0 : 1; one('.ii-route-a').style.opacity = ease(p(4) * 3); }
    // readouts in the drawing's corner
    const read = box.querySelector('.intro-read'), lines = [];
    if (t >= .5) lines.push(`<span>${esc(x.addr)}</span><b>${esc(x.zone)} · ${x.area.toLocaleString('en-CA')} m² site</b>`);
    if (t >= 1.2) lines.push(`<span>Permitted FSR</span><b class="ir-num">${fmt(x.permitted * ease((t - 1.2) * 1.4))}</b>`);
    if (t >= 2.2) lines.push(`<span>Massing</span><b>${Math.max(1, Math.min(F, Math.ceil(stackK * F)))} storeys</b>`);
    if (t >= 3.6) lines.push(`<span>Plan</span><b>${Math.round(x.count * ease((t - 3.6) * 2))} homes</b>`);
    read.innerHTML = lines.map(l => `<div>${l}</div>`).join('');
    const stamp = box.querySelector('.intro-stamp'), ks = ease((p(4) - .45) * 2.4);
    stamp.style.opacity = ks; stamp.style.transform = `scale(${lerp(1.18, 1, ks)})`;
    // where we are: the beat in the title block and the marker on the timeline
    const beat = Math.min(STEPS - 1, Math.floor(t + 1e-6));
    (box.closest('.intro') || box).querySelectorAll('.intro-steps button').forEach((b, i) => b.setAttribute('aria-current', i === beat ? 'step' : 'false'));
    box.querySelectorAll('.il-tick').forEach((b, i) => b.classList.toggle('on', i <= beat));
    box.querySelector('.il-fill').style.transform = `scaleX(${clamp(t / STEPS)})`;
  }

  // ---------- the welcome: every R3 lot in the city lights up, then the view flies into the example lot ----------
  // Real data only: the parcels and the count are the bundled City of Vancouver R3 parcels; the lot is the example's.
  // the city lights up and the welcome lines are read during a held frame (HOLD seconds at w = PAUSE_AT), then the zoom runs
  const PACE = 3.4, HOLD = 1.7, PAUSE_AT = .54, WELCOME = PACE + HOLD, ZONE = { 'R3-1': '#d3dae2', 'R3-2': '#9aa8b8', 'R3-3': '#5d6f83' };
  function exampleIndex() { const P = root.R3_PARCELS || []; const i = P.findIndex(p => p.area >= 1400 && p.frontage >= 32 && p.depth >= 30 && !p.irregular); return i >= 0 ? i : P.findIndex(p => p.area >= 920); }
  function cityModel() {
    const P0 = root.R3_PARCELS || []; if (!P0.length) return null;
    // shift to a local origin at the city centre: raw UTM northings (5.4 million) lose precision under a canvas transform
    let ux0 = Infinity, uy0 = Infinity, ux1 = -Infinity, uy1 = -Infinity; for (const p of P0) for (const [x, y] of p.utm) { if (x < ux0) ux0 = x; if (y < uy0) uy0 = y; if (x > ux1) ux1 = x; if (y > uy1) uy1 = y; }
    const O = [(ux0 + ux1) / 2, (uy0 + uy1) / 2], P = P0.map(p => ({ zone: p.zone, utm: p.utm.map(q => [q[0] - O[0], q[1] - O[1]]), area: p.area, frontage: p.frontage, depth: p.depth, irregular: p.irregular }));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of P) for (const [x, y] of p.utm) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    const li = exampleIndex(), lot = P[li]?.utm || P[0].utm, lc = lot.reduce((a, q) => [a[0] + q[0] / lot.length, a[1] + q[1] / lot.length], [0, 0]);
    const lx = lot.map(q => q[0]), ly = lot.map(q => q[1]), lotSize = Math.max(Math.max(...lx) - Math.min(...lx), Math.max(...ly) - Math.min(...ly));
    // parcels light up as a ripple outward from the example lot
    const order = P.map((p, i) => ({ i, d: Math.hypot(p.utm[0][0] - lc[0], p.utm[0][1] - lc[1]) })).sort((a, b) => a.d - b.d).map(q => q.i);
    const mid = P.map(p => p.utm.reduce((a, q) => [a[0] + q[0] / p.utm.length, a[1] + q[1] / p.utm.length], [0, 0]));
    return { P, order, li, lc, lotSize, mid, box: [x0, y0, x1, y1] };
  }
  function city(cv, m, w, land) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); if (!m) return;
    const [x0, y0, x1, y1] = m.box, s0 = Math.min(W * .58 / (x1 - x0), H * .8 / (y1 - y0)), s1 = (land?.size || Math.min(W, H) * .5) / m.lotSize, c0 = [(x0 + x1) / 2, (y0 + y1) / 2];
    const kz = ease((w - .58) / .42), s = s0 * Math.pow(s1 / s0, kz), kc = (s / s0 - 1) / (s1 / s0 - 1 || 1), cx = lerp(c0[0], m.lc[0], kc), cy = lerp(c0[1], m.lc[1], kc);
    const ox = lerp(W * .68, land?.cx ?? W / 2, kz), oy = lerp(H / 2, land?.cy ?? H / 2, kz); g.setTransform(s, 0, 0, -s, ox - cx * s, oy + cy * s); // the city sits right of the welcome lines until the zoom // north up: y flips
    const shown = Math.round(m.P.length * ease(w / .5));
    // far out a lot is under a pixel: each parcel is a 2.2 px mark in its zone colour until the zoom brings real outlines into view
    const far = s * 14 < 4, r = 1.1 * (W / cv.clientWidth || 1) / s; g.globalAlpha = .85;
    for (let k = 0; k < shown; k++) { const i = m.order[k], p = m.P[i]; g.fillStyle = ZONE[p.zone] || ZONE['R3-2'];
      if (far) { const c = m.mid[i]; g.fillRect(c[0] - r, c[1] - r, 2 * r, 2 * r); } else { g.beginPath(); p.utm.forEach((q, j) => j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill(); } }
    g.globalAlpha = 1;
    // the example lot, in revision blue, with a ring that holds it as the city falls away
    const lot = m.P[m.li]; g.beginPath(); lot.utm.forEach((q, j) => j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath();
    g.fillStyle = '#1a56db'; g.globalAlpha = 1 - .85 * kz; g.fill(); g.globalAlpha = 1; g.lineWidth = 2.5 / s; // thins to the sheet's tint as it lands g.strokeStyle = '#1a56db'; g.stroke();
    const ring = ease((w - .4) / .2) * (1 - kz); if (ring > 0) { g.beginPath(); g.arc(m.lc[0], m.lc[1], 14 / s * (1 + 2 * (1 - ring)), 0, 7); g.lineWidth = 1.5 / s; g.globalAlpha = ring; g.stroke(); g.globalAlpha = 1; }
    return shown;
  }

  // ---------- the sheet ----------
  let open = null;
  function show() {
    const x = X(); if (!x || open) return;
    const el = doc.createElement('div'); el.className = 'intro'; el.id = 'intro'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'intro-title');
    el.innerHTML = `<div class="intro-sheet">
      <button class="intro-skip" type="button" data-intro="skip">Skip intro</button>
      <div class="intro-draw">${svg(x)}<canvas class="intro-city" aria-hidden="true"></canvas>
        <div class="intro-welcome"><p class="iw-hello">Welcome.</p><p class="iw-line">Every R3 lot in Vancouver, ready to test.</p><p class="iw-for">A feasibility tool for architects and developers: from a City parcel to a coordinated schematic plan, before design starts.</p></div>
        <div class="intro-count" aria-hidden="true"><b>0</b><span>R3 parcels · City of Vancouver open data</span></div>
        <div class="intro-read" aria-hidden="true"></div>
        <button class="intro-hero" type="button"><i aria-hidden="true"></i><b>Play the demo</b><span>See how it works in under 10 seconds</span></button>
        <div class="intro-end" role="group" aria-label="What next"><p>Ready to try it on a real lot?</p><div><button class="btn intro-go" type="button" data-end="pick">Pick a site</button><button class="btn" type="button" data-end="example">Open the example</button><button class="btn" type="button" data-end="replay">Replay</button></div></div>
        <div class="intro-stamp" aria-hidden="true"><b>${esc(x.verdict)}</b><span>${x.count} homes · ${x.floors} storeys · FSR ${fmt(x.achieved)} of ${fmt(x.permitted)}</span></div>
        <div class="intro-line"><button class="il-play" type="button"><i aria-hidden="true"></i><span>Play the demo</span></button><div class="il-rule" role="group" aria-label="Demo steps"><span class="il-fill"></span>${COPY.map((c, i) => `<button class="il-tick" type="button" data-beat="${i}" aria-label="Step ${i + 1}: ${esc(c[0])}" style="left:${i / (STEPS - 1) * 100}%"><i></i><span>${esc(c[0])}</span></button>`).join('')}</div></div>
      </div>
      <aside class="intro-block" aria-label="Welcome">
        <h1 id="intro-title">Welcome to R3 site feasibility</h1>
        <p class="intro-lead">From a City of Vancouver parcel to a coordinated schematic plan, with the R3 rules and the code checks drawn in.</p>
        <ol class="intro-steps">${COPY.map((c, i) => `<li><button type="button" data-beat="${i}" aria-current="false"><em>${i + 1}</em><b>${esc(c[0])}</b><span>${esc(c[1])}</span></button></li>`).join('')}</ol>
        <div class="intro-actions"><button class="btn intro-go" type="button" data-intro="pick">Pick a site</button><button class="btn" type="button" data-intro="example">Open the example</button></div>
        <p class="intro-note">The drawing is this tool's own result for ${esc(x.addr)}. Schematic: not a zoning or building code determination.</p>
        <p class="intro-note intro-legal">© 2026 Yeoneui Kim. All rights reserved. Data: City of Vancouver Open Data, Open Government Licence – Vancouver.</p>
      </aside></div>`;
    doc.body.appendChild(el); doc.body.classList.add('intro-on'); doc.documentElement.classList.add('intro-on');
    const draw = el.querySelector('.intro-draw'), rule = el.querySelector('.il-rule'), playBtn = el.querySelector('.il-play'), hero = el.querySelector('.intro-hero');
    // review hook: ?introt=2.5 pins the drawing at that moment (for screenshots and design review)
    const pin = /[?&]introt=(-?[\d.]+)/.exec(root.location?.search || ''); if (pin) el.classList.add('intro-pinned');
    let demo = !!pin && +pin[1] > 0, t = pin ? +pin[1] : still() ? 0 : -WELCOME, playing = !still() && !pin, last = performance.now(), raf = 0, drag = false;
    const cv = el.querySelector('.intro-city'), model = still() ? null : cityModel(), count = el.querySelector('.intro-count b'), welcomeBox = el.querySelector('.intro-welcome'), countBox = el.querySelector('.intro-count'), fit = () => { const r = draw.getBoundingClientRect(), d = Math.min(2, root.devicePixelRatio || 1); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); };
    // where the sheet draws the lot, in canvas pixels: the fly-in lands exactly there, at that size
    let land = null; const measure = () => { const r = el.querySelector('.ii-lot').getBoundingClientRect(), c = cv.getBoundingClientRect(), d = cv.width / (c.width || 1); land = r.width ? { cx: (r.left + r.width / 2 - c.left) * d, cy: (r.top + r.height / 2 - c.top) * d, size: Math.max(r.width, r.height) * d } : null; };
    const onResize = () => { fit(); measure(); set(t); }; fit(); measure(); root.addEventListener('resize', onResize); // resizing a canvas clears it: redraw
    const set = v => { t = Math.max(-WELCOME, Math.min(STEPS, v)); const e = t + WELCOME, w = t < 0 ? (e < PAUSE_AT * PACE ? e / PACE : e < PAUSE_AT * PACE + HOLD ? PAUSE_AT : (e - HOLD) / PACE) : 1; el.classList.toggle('welcoming', t < 0);
      if (t < 0) { const n = city(cv, model, w, land); count.textContent = (n || 0).toLocaleString('en-CA'); const vis = ease(w / .12) * (1 - ease((w - .54) / .12)); for (const n of [welcomeBox, countBox]) { n.style.opacity = String(vis); n.style.transform = 'translateY(' + (8 * (1 - ease(w / .14))) + 'px)'; } }
      cv.style.opacity = t < 0 ? String(1 - ease((w - .86) / .14)) : '0';
      frame(draw, x, t < 0 || (t === 0 && !demo) ? REST : t); sync(); el.querySelectorAll('.il-tick').forEach((b, i) => b.setAttribute('aria-current', String(i === Math.max(0, Math.min(STEPS - 1, Math.floor(t)))))); };
    // the welcome plays once and stops on the sheet; the demo runs only when asked for
    const tick = now => { const dt = Math.min(.1, (now - last) / 1000); last = now; if (playing && !drag && !doc.hidden) { if (t < 0) { const nt = t + dt; if (nt >= 0) { playing = false; set(0); } else set(nt); } else { set(t + dt / BEAT); if (t >= STEPS) { playing = false; sync(); } } } raf = requestAnimationFrame(tick); };
    set(t); if (!still()) { raf = requestAnimationFrame(tick); }
    // jump to a beat: replay it from its start (reduced motion: show it finished)
    const go = k => { demo = true; if (still()) set(k + .999); else { set(k); playing = true; last = performance.now(); } sync(); };
    // the demo button: play from the start, pause, resume, or replay
    function sync() { if (!playBtn) return; el.classList.toggle('resting', !demo && t >= 0); // the fly-in has stopped: the big Play sits in the middle until the demo runs
      el.classList.toggle('finished', demo && t >= STEPS && !playing); // the demo has run: what next, in the same place
      const label = !demo || (t === 0 && !playing) ? 'Play the demo' : playing && t >= 0 ? 'Pause' : t >= STEPS ? 'Replay the demo' : 'Resume'; if (playBtn.lastChild.textContent !== label) playBtn.lastChild.textContent = label; playBtn.classList.toggle('is-playing', playing && t >= 0); }
    hero.onclick = () => { go(1); playBtn.focus({ preventScroll: true }); };
    playBtn.onclick = () => { if (!demo && t >= 0) go(1); else if (!demo || t < 0 || t >= STEPS) go(0); else if (playing) { playing = false; sync(); } else { playing = true; last = performance.now(); sync(); } };
    sync();
    el.querySelectorAll('[data-beat]').forEach(b => b.onclick = () => go(+b.dataset.beat));
    const at = e => { const r = rule.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width) * STEPS; };
    rule.addEventListener('pointerdown', e => { if (e.target.closest('.il-tick')) return; drag = true; demo = true; rule.setPointerCapture(e.pointerId); set(at(e)); });
    rule.addEventListener('pointermove', e => { if (drag) set(at(e)); });
    rule.addEventListener('pointerup', () => { drag = false; playing = t < STEPS && !still(); last = performance.now(); });
    rule.addEventListener('keydown', e => { const k = Math.min(STEPS - 1, Math.floor(t)); if (e.key === 'ArrowRight') { e.preventDefault(); go(Math.min(STEPS - 1, k + 1)); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(Math.max(0, k - 1)); } });
    const close = then => { cancelAnimationFrame(raf); root.removeEventListener('resize', onResize);  el.classList.add('intro-out'); try { root.localStorage?.setItem(KEY, '1'); } catch (e) {} setTimeout(() => { el.remove(); doc.body.classList.remove('intro-on'); doc.documentElement.classList.remove('intro-on'); open = null; then?.(); }, still() ? 0 : 260); doc.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    doc.addEventListener('keydown', onKey);
    el.querySelector('[data-intro="skip"]').onclick = () => close();
    el.querySelector('[data-intro="pick"]').onclick = () => close(() => { root.APP?.showTab('site'); doc.getElementById('search')?.focus(); });
    el.querySelector('[data-intro="example"]').onclick = () => close(example);
    el.querySelector('[data-end="pick"]').onclick = () => el.querySelector('[data-intro="pick"]').click();
    el.querySelector('[data-end="example"]').onclick = () => close(example);
    el.querySelector('[data-end="replay"]').onclick = () => { go(0); playBtn.focus({ preventScroll: true }); };
    open = el; el.querySelector('.intro-go').focus({ preventScroll: true });
  }

  // ---------- the hand-off: the example lands finished, then a short tour of the result ----------
  // Site, Massing confirmed, plan generated, Review: the same buttons a user presses, so the example is a real run.
  let running = false;
  function example() {
    const A = root.APP, U = root.UNITS_UI; if (running || !A || !root.SITE) return; running = true;
    A.showTab('site'); root.SITE.select(exampleIndex(), false);
    const s = root.SITE.current?.(), addr = s?.addr || 'The example lot', t0 = Date.now(), note = doc.createElement('div');
    note.className = 'intro-progress'; note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite');
    note.innerHTML = `<b>Generating the example plan…</b><small><span class="ip-phase">${esc(addr)}</span> <span class="ip-time" aria-hidden="true"></span></small>`; doc.body.appendChild(note);
    const stop = () => { running = false; note.remove(); };
    const fail = text => { stop(); tour([{ at: ['#ws-go', '.ws-steps', '.tabs'], text }]); };
    const later = (f, ms) => setTimeout(() => { try { f(); } catch (e) { fail('The example could not finish: ' + e.message); } }, ms); // timers, not frames: a background tab still runs
    // 1. Massing, confirmed with the workspace's primary button ("Continue to plan setup")
    A.showTab('capacity');
    later(() => {
      const go = doc.getElementById('ws-go') || doc.getElementById('ref-design'); if (!go || go.disabled) return fail('The example massing could not be confirmed. Press Continue to plan setup to try again.');
      go.click();
      // 2. Plan setup: generate the plan from the default brief (10 to 60 s); the tool moves to Units when it is done
      later(() => { if (A.state.tab !== 'massing') return fail('The example stopped before plan setup. Press Generate plan to continue.'); U.api.generatePlan(); later(poll, 400); }, 150);
    }, 150);
    let phase = '';
    function poll() {
      if (!running) return;
      const tab = A.state.tab, busy = doc.getElementById('ws-busy'), n = U.current?.count, sec = Math.round((Date.now() - t0) / 1000);
      if (tab === 'units' && !busy && n > 0) return land();
      if (!busy && sec > 3) { if (tab === 'massing') return fail('The example plan could not be generated. The note in Plan setup says why; change the brief and press Generate plan.'); if (tab !== 'units') return stop(); } // the user went elsewhere: stop quietly
      if (sec > 240) return fail('The example plan is taking unusually long. Press Generate plan to try again.');
      const p = busy?.querySelector('b')?.textContent || ''; if (p && p !== phase) { phase = p; note.querySelector('.ip-phase').textContent = `${addr} · ${p}`; }
      note.querySelector('.ip-time').textContent = `· ${sec} s`;
      later(poll, 400);
    }
    // 3. Review, report view, then the tour of the finished result
    function land() {
      stop(); const r = U.current; A.showTab('egress'); U.api?.view?.('report');
      later(() => tour([
        { at: '.sv-verdict h2', text: `The verdict for ${addr}: ${r?.count ?? 'the'} homes${r?.achieved ? ` at ${fmt(r.achieved)} FSR` : ''}. Below it: the floor area, the unit mix and every zoning and code check, each with its clause.` },
        { at: ['.ws-steps', '.tabs'], text: 'The steps you just went through: Site, Massing, Plan setup, Units, Review and Presentation. Click any step to go back and change it; a step that needs updating is marked.' },
        { at: ['.ws-steps [data-ws="step:presentation"]', '.tab[data-tab="presentation"]'], text: 'Presentation draws the design in its street context, ready to print.', go: ['Open Presentation', () => A.showTab('presentation')] }
      ]), 300);
    }
  }
  // a stop's target: the first selector in `at` (a string or a list) that is on screen
  const seen = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const target = s => (Array.isArray(s.at) ? s.at : [s.at]).map(q => doc.querySelector(q)).find(seen);
  const hit = (a, b, m = 8) => a.left < b.right + m && a.right > b.left - m && a.top < b.bottom + m && a.bottom > b.top - m;
  function tour(stops) {
    let k = 0; const ring = doc.createElement('div'), note = doc.createElement('div');
    ring.className = 'tour-ring'; note.className = 'tour-note'; note.setAttribute('role', 'dialog'); note.setAttribute('aria-live', 'polite');
    doc.body.append(ring, note);
    const end = () => { ring.remove(); note.remove(); root.removeEventListener('resize', onResize); doc.removeEventListener('keydown', key); };
    const onResize = () => { place(); setTimeout(place, 300); }; // again once the views have re-laid out
    const key = e => { if (e.key === 'Escape') end(); };
    function place() {
      const el = target(stops[k]); if (!el) return;
      const r = el.getBoundingClientRect(), m = 6; Object.assign(ring.style, { left: `${r.left - m}px`, top: `${r.top - m}px`, width: `${r.width + 2 * m}px`, height: `${r.height + 2 * m}px` });
      const w = Math.min(320, innerWidth - 32); note.style.width = `${w}px`; const h = note.offsetHeight, below = r.bottom + 14 + h < innerHeight - 16, big = r.height > innerHeight * .5;
      // a large target (the map, a whole view) carries the note inside its bottom-left corner, clear of the controls along its top
      let top = big ? Math.min(r.bottom, innerHeight) - 24 - h : below ? r.bottom + 14 : r.top - 14 - h, left = big ? r.left + 24 : r.left;
      const fit = () => { left = Math.max(16, Math.min(innerWidth - w - 16, left)); top = Math.max(16, Math.min(innerHeight - h - 16, top)); }; fit();
      // never over the map search box: drop below it, or step to its right where there is no room below
      const sb = doc.getElementById('search'); if (seen(sb)) { const a = sb.getBoundingClientRect(); if (hit({ left, top, right: left + w, bottom: top + h }, a)) { if (a.bottom + 12 + h < innerHeight - 16) top = a.bottom + 12; else left = a.right + 12; fit(); } }
      Object.assign(note.style, { left: `${left}px`, top: `${top}px` });
    }
    function draw() {
      const s = stops[k], lastStop = k === stops.length - 1, next = !s.go && !lastStop;
      note.innerHTML = `<p>${esc(s.text)}</p><div class="tour-acts">${next ? '' : `<span>${k + 1} of ${stops.length}</span>`}<button class="btn small" type="button" data-t="end">${lastStop ? 'Done' : 'Skip tour'}</button>${s.go ? `<button class="btn small intro-go" type="button" data-t="go">${esc(s.go[0])}</button>` : next ? `<button class="btn small intro-go" type="button" data-t="next">Next (${k + 2} of ${stops.length})</button>` : ''}</div>`;
      note.querySelector('[data-t="end"]').onclick = end;
      note.querySelector('[data-t="next"]')?.addEventListener('click', () => { k++; draw(); });
      note.querySelector('[data-t="go"]')?.addEventListener('click', () => { end(); s.go[1](); });
      place(); ring.classList.remove('tour-in'); void ring.offsetWidth; ring.classList.add('tour-in'); (note.querySelector('.intro-go') || note.querySelector('[data-t="end"]')).focus({ preventScroll: true }); // the forward button, not the first in the row
    }
    root.addEventListener('resize', onResize); doc.addEventListener('keydown', key);
    // after the panel has rendered (a timer, so a background tab still gets the tour); stops with nothing on screen are dropped
    setTimeout(() => { stops = stops.filter(target); if (stops.length) draw(); else end(); }, 80);
  }

  // ---------- entry points: first visit, and "Replay intro" in the stage bar ----------
  function boot() {
    const bar = doc.querySelector('.bar'); if (bar && !doc.getElementById('intro-open')) { const b = doc.createElement('button'); b.id = 'intro-open'; b.type = 'button'; b.className = 'btn small intro-open'; b.textContent = 'Replay intro'; b.onclick = show; bar.appendChild(b); }
    if (bar && !doc.getElementById('help-open')) { const b = doc.createElement('button'); b.id = 'help-open'; b.type = 'button'; b.className = 'btn small help-open'; b.textContent = 'Help'; b.title = 'Help & glossary (?)'; b.setAttribute('aria-haspopup', 'dialog'); b.onclick = () => root.HELP?.open(); bar.appendChild(b); }
    // the welcome is the front page of the tool: it opens on every load (?nointro skips it for development)
    if (!/[?&]nointro\b/.test(root.location?.search || '')) show();
  }
  root.INTRO = { show, tour, frame, example };
  // intro.js is the last script the page loads, so the app is wired by now; no need to wait for map tiles
  setTimeout(boot, 0);
})(typeof window !== 'undefined' ? window : globalThis);
