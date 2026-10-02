/* plan-wait.js: the panel shown while Generate plan runs (up to a minute). Left, a line drawing of each layout the generator
   tries, in the plans' own language (ink outline, grey corridor, stair and lift symbols, thin unit walls), crossfading as new
   candidates arrive. Right, the stage, a progress bar, the best result so far and a short fact about R3, single egress or this
   site, changing every 7 seconds. Underneath, the three stages tick off. Every number comes from the search or from the rules
   and data the tool already encodes; nothing is invented for the wait. */
(function (root) {
  'use strict';
  const doc = root.document;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 0) => Number.isFinite(n) ? n.toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const still = () => root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const STAGES = ['Stairs and lift', 'Corridor and units', 'Refining the best'];
  const INK = '#111417', LINE = '#8b9097', RULE = '#c9ccd0', CORR = '#e6e8eb';

  // facts, from the encoded rules and data, plus one about the site being planned
  function facts(ctx) {
    const R = root.RULES || {}, V = R.VBBL || {}, S = V.singleExit || {}, sc = V.scissor || {}, meta = root.R3_META || {}, mix = ctx?.mix, out = [];
    if (ctx?.area && ctx?.permitted) out.push(['This site', `${esc(ctx.addr || 'This lot')}: ${fmt(ctx.area)} m² at FSR ${fmt(ctx.permitted, 2)} gives ${fmt(ctx.area * ctx.permitted)} m² of floor area to plan.`]);
    if (meta.r3_parcels) out.push(['R3 zoning', `${fmt(+meta.r3_parcels)} parcels in Vancouver are zoned R3, the city's new low-rise apartment districts.`]);
    out.push(['Missing middle', 'The missing middle is the housing between a house and a tower: low-rise apartments of the kind R3 allows.']);
    if (S.clause) out.push(['Single egress', `Since 20 January 2026, Vancouver allows one exterior exit stair in residential buildings up to ${S.storeyCap ?? 6} storeys (VBBL ${esc(S.clause)}, ${esc(S.bylaw || '')}).`]);
    if (S.unitsLow) out.push(['Single egress', `With one exit stair: up to ${S.unitsLow} homes per floor on storeys 1–3 and ${S.unitsHigh} above, and travel of ${S.travel} m or less.`]);
    if (sc.sepCap) out.push(['Scissor stair', `A scissor stair stacks two exits in one core. Up to ${sc.storeyCap} storeys and ${fmt(sc.areaCap)} m², its two doors need be no more than ${sc.sepCap} m apart.`]);
    if (mix?.two) out.push(['Unit mix', `R3 asks that at least ${fmt(mix.two * 100)}% of homes have 2 or more bedrooms${mix.three ? `, and ${fmt(mix.three * 100)}% have 3` : ''}.`]);
    if (V.travel) out.push(['Exit routes', `From any suite door, the walk to an exit stair can be up to ${V.travel.sprinklered} m when the building is sprinklered, ${V.travel.other} m when not.`]);
    return out;
  }

  // the sketch: plate outline as the union of built rectangles (a stroke under a white fill hides the seams)
  function sketch(k) {
    if (!k) return '';
    const pad = 8, W = 260, H = 190, s = Math.min((W - 2 * pad) / k.W, (H - 2 * pad) / k.D), ox = (W - k.W * s) / 2, oy = (H - k.D * s) / 2;
    const R = (q, a) => `<rect x="${(ox + q.x * s).toFixed(1)}" y="${(oy + q.y * s).toFixed(1)}" width="${(q.w * s).toFixed(1)}" height="${(q.h * s).toFixed(1)}" ${a}/>`;
    let g = k.built.map(q => R(q, `fill="none" stroke="${INK}" stroke-width="2.6"`)).join('') + k.built.map(q => R(q, 'fill="#fff"')).join('');
    g += k.voids.map(q => R(q, `fill="url(#pw-hatch)" stroke="${LINE}" stroke-width=".8"`)).join('');
    g += k.corridors.map(q => R(q, `fill="${CORR}"`)).join('');
    g += k.units.map(q => R(q, `fill="none" stroke="${RULE}" stroke-width=".8"`)).join('');
    for (const c of k.cores) {
      g += R(c, `fill="#fff" stroke="${INK}" stroke-width="1.1"`);
      const x0 = ox + c.x * s, y0 = oy + c.y * s, w = c.w * s, h = c.h * s;
      if (c.kind === 'elevator') g += `<path d="M${x0} ${y0}L${x0 + w} ${y0 + h}M${x0 + w} ${y0}L${x0} ${y0 + h}" stroke="${LINE}" stroke-width=".7"/>`;
      else { const along = w >= h, n = Math.max(3, Math.round((along ? w : h) / 3)); let t = ''; for (let i = 1; i < n; i++) t += along ? `M${x0 + i * w / n} ${y0 + 1}V${y0 + h - 1}` : `M${x0 + 1} ${y0 + i * h / n}H${x0 + w - 1}`; g += `<path d="${t}" stroke="${LINE}" stroke-width=".6"/>`; }
    }
    return g;
  }

  let el = null, timer = 0, factAt = 0, list = [], lastSketch = '';
  function build(ctx) {
    list = facts(ctx); factAt = 0;
    el = doc.createElement('div'); el.id = 'ws-busy'; el.className = 'ws-busy pw';
    el.innerHTML = `<div class="pw-card" role="status" aria-live="polite" aria-label="Generating the plan">
      <figure class="pw-draw"><svg class="pw-svg" viewBox="0 0 260 190" aria-hidden="true"><defs><pattern id="pw-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V5" stroke="${RULE}" stroke-width=".8"/></pattern></defs><g class="pw-g"></g></svg><figcaption class="pw-cap">Typical floor · the layout being tried</figcaption></figure>
      <div class="pw-side"><p class="pw-eyebrow">Generating the plan</p><p class="pw-step"></p><div class="pw-bar"><i></i></div>
        <dl class="pw-best"><div><dt>Best so far</dt><dd><b class="pw-homes">—</b> homes</dd></div><div><dt>Net to gross</dt><dd><b class="pw-ng">—</b></dd></div></dl>
        <div class="pw-fact"><p class="pw-tag"></p><p class="pw-text"></p><div class="pw-dots">${list.map(() => '<i></i>').join('')}</div></div></div>
      <ol class="pw-steps">${STAGES.map((t, i) => `<li data-s="${i}"><span>${String(i + 1).padStart(2, '0')}</span>${t}</li>`).join('')}</ol></div>`;
    doc.body.appendChild(el); showFact();
    timer = setInterval(() => { factAt = (factAt + 1) % Math.max(1, list.length); showFact(); }, 7000);
  }
  function showFact() {
    if (!el || !list.length) return; const [tag, text] = list[factAt], box = el.querySelector('.pw-fact');
    const put = () => { box.querySelector('.pw-tag').textContent = tag; box.querySelector('.pw-text').innerHTML = text; el.querySelectorAll('.pw-dots i').forEach((d, i) => d.classList.toggle('on', i === factAt)); box.classList.remove('pw-out'); };
    if (still()) put(); else { box.classList.add('pw-out'); setTimeout(put, 220); }
  }
  // text: the generator's progress line ("Laying the corridor and fitting units · 3 of 8 · best so far …"); info: {stage, sketch, best}
  function show(text, info, ctx) {
    if (!el) build(ctx);
    const [head, ...rest] = String(text || '').split(' · '), m = /(\d+) of (\d+)/.exec(text || ''), stage = info?.stage ?? (/Placing/.test(head) ? 0 : /Refining/.test(head) ? 2 : /Laying|fitting/i.test(head) ? 1 : null);
    el.querySelector('.pw-step').textContent = head.replace(/…$/, '') + (m ? ` · ${m[1]} of ${m[2]}` : '');
    if (stage != null) {
      const frac = m ? Math.min(1, +m[1] / +m[2]) : 0;
      el.querySelector('.pw-bar i').style.transform = `scaleX(${((stage + frac) / STAGES.length).toFixed(3)})`;
      el.querySelectorAll('.pw-steps li').forEach(li => { const k = +li.dataset.s; li.className = k < stage ? 'done' : k === stage ? 'now' : ''; });
    }
    if (info?.best) { el.querySelector('.pw-homes').textContent = info.best.count; el.querySelector('.pw-ng').textContent = fmt(info.best.ng * 100, 1) + '%'; }
    if (info?.sketch) { const g = sketch(info.sketch); if (g !== lastSketch) { lastSketch = g; const host = el.querySelector('.pw-g'); host.innerHTML = g; if (!still()) { host.classList.remove('pw-in'); void host.getBBox?.(); host.classList.add('pw-in'); } } }
  }
  function hide() { clearInterval(timer); timer = 0; el?.remove(); el = null; lastSketch = ''; }
  root.PLAN_WAIT = { show, hide, facts, sketch };
})(typeof window !== 'undefined' ? window : globalThis);
