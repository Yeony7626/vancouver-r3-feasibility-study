/* help.js: the Help & glossary sheet. Plain-language definitions of the terms the tool uses, each read from what the
   tool actually encodes (rules.js, stage3.js, plan-setup.js, site.js), so a number here never disagrees with a check.
   HELP.open(term?) opens the sheet at a term; any [data-help="term"] element opens it too (the site panel's § buttons). */
(function (root) {
  'use strict';
  const doc = root.document, R = () => root.RULES || {};
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (v, d = 0) => Number(v).toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = v => Math.round(v * 100) + '%';
  const method = () => root.R3_META?.method ? `<details><summary>How the tool derives it</summary><p class="hp-pre">${esc(root.R3_META.method)}</p></details>` : '';
  const mixLine = () => { const F = R().FA; if (!F) return ''; const a = F.now.mix('R3-2', 'rental'), b = F.now.mix('R3-1', 'rental'), c = F.oct.mix();
    return `At least ${pct(a.two)} of homes need 2 or more bedrooms and at least ${pct(a.three)} need 3 or more (R3 ${a.clause}; R3-1 strata ${F.now.mix('R3-1', 'other').clause}). R3-1 rental needs only the ${pct(b.two)} two-bedroom share (${b.clause}). From 27 Oct 2026 the rule becomes ${pct(c.two)} and ${pct(c.three)} (${c.clause}).`; };
  // [id, term, definition (html)]; definitions are functions so they read the live rules
  const TERMS = [
    ['fsr', 'FSR (floor space ratio)', () => 'Floor area divided by site area. An FSR of 2.40 on a 1,000 m² site allows 2,400 m² of floor area, spread over as many storeys as the height limit allows.'],
    ['permitted-achieved', 'Permitted vs achieved FSR', () => 'Permitted FSR is the ceiling from the R3 table (§3.1.1): it depends on the site-area column (460, 613, 920 or 1,470 m²+), the depth or corner row, tenure, and the 3.00 or 2.70 bonuses when their conditions are met. Achieved FSR is what your plan actually builds: its countable floor area divided by the site area.'],
    ['countable', 'Countable vs gross floor area', () => 'Gross floor area is all enclosed floor area plus exterior galleries and exterior stairs, over every floor; courtyards are voids. Countable area is the part that counts against FSR. This tool claims no exclusions, so countable equals gross, which is conservative; the site estimate on step 1 lists the exclusions the by-law would allow (amenity, storage, balconies and others).'],
    ['zones', 'R3-1, R3-2, R3-3', () => 'The three R3 sub-districts, coloured light to dark on the map. R3-2 must be 100% residential rental (§3.1.1.4(a)); R3-1 has a lower FSR table for strata (§3.1.1.3); R3-3 uses one table for all tenures (§3.1.1.5(b)).'],
    ['toa', 'TOA (transit-oriented area) and its tiers', () => `A site is in a TOA if any part of it lies within ${num(root.TOA_RADIUS || 800)} m of a rapid-transit station. The tool labels Tier 1 within 200 m, Tier 2 within 400 m and Tier 3 within ${num(root.TOA_RADIUS || 800)} m. These are circles from the City's station points, not the enacted By-law 14090 map, so confirm a site near the edge.`],
    ['bmr', 'BMR (below-market rental)', () => 'Homes let below market rent. With 20% below-market rental in a TOA, or 100% social housing, the height limit rises from 23.0 m to 27.5 m (§3.1.2.7), and a rental project on a shallow site of 920 m² or more, or a wide corner of 1,470 m² or more, can reach 3.00 FSR.'],
    ['height', 'Height limit', () => 'The R3 height is 23.0 m (§3.1.2.2), or 27.5 m with below-market rental in a TOA or 100% social housing (§3.1.2.7).'],
    ['roof', 'Roof allowance', () => { const r = root.CAP?.inputs?.roofAllow ?? 0.6, f = root.CAP?.inputs?.ftfRes ?? 3; return `Height kept for the roof build-up above the top floor, ${num(r, 1)} m by default. Storeys = (height limit − roof allowance) ÷ floor-to-floor height (${num(f, 1)} m by default). The Review height check includes it.`; }],
    ['mix', 'Unit mix (R3 §2.2.6)', mixLine],
    ['site-area', 'Site area and the 460 m² minimum', () => `The planar area of the City parcel polygon (an assessment parcel, not a legal survey); for combined lots, the area of the merged polygon. R3 needs at least ${num(root.SITE?.MIN_AREA || 460)} m² for apartments (§3.1.2.1). Larger sites move into the 613, 920 and 1,470 m² FSR columns.${method()}`],
    ['frontage', 'Frontage', () => `The length of the site's street side. On a corner it is the shorter street side (ZDB §10.26.1(b)). A right-of-way 10.1 m or wider is a street, narrower is a lane (ZDB §2). A corner site with 40.2 m or more of frontage uses the wide-corner FSR row. You can type over the derived figure.${method()}`],
    ['depth', 'Depth', () => `The extent of the site measured at right angles to the frontage: the full depth the building envelope can take, not an average. A site 33.5 m deep or less uses the shallow-site FSR row. You can type over the derived figure.${method()}`],
    ['pmt', 'PMT (pad-mounted transformer)', () => 'The BC Hydro electrical transformer that sits on a concrete pad on the site, usually at a lane corner. Plan setup can reserve a pad with an editable size and study buffer; vehicle access, utility routing and fire exposure are not checked.'],
    ['vbbl', 'VBBL (Vancouver Building By-law)', () => { const V = R().VBBL || {}; return `Vancouver's building code. The Review checks use ${esc(V.source || 'the VBBL')}: at least ${V.exitsMin?.v ?? 2} exits per floor (${esc(V.exitsMin?.clause || '')}), travel distance, dead-end corridors of ${V.deadEnd?.v ?? 6} m or less, and public corridors at least ${num((V.corridorWidth?.v ?? 1.1) * 1000)} mm wide.`; }],
    ['cddg', 'CDDG (design guidelines)', () => 'The design guidelines the tool reads beside the R3 schedule. They are guidance, not by-law, so the tool cites them as a standard, not a zoning limit. Some are applied by analogy: the 7.3 m courtyard clear width (CDDG S1.4.3), where a narrower court is kept as a light well and flagged for review.'],
    ['scissor', 'Scissor stair', () => { const S = R().VBBL?.scissor || {}; return `Two exit stairs interlocked in one shaft, so one core gives two exits. VBBL 2025 ${esc(S.clause || '3.4.2.3.(5)–(6)')} allows it in buildings residential throughout, up to ${S.storeyCap ?? 6} storeys, with a building area of ${num(S.areaCap ?? 600)} m² or less: the distance between the two exit doors need not exceed ${num(S.sepCap ?? 4.5)} m, and an air-leakage barrier separates the two stairways.`; }],
    ['single-exit', 'Single exit (one stair)', () => { const S = R().VBBL?.singleExit || {}; return `One exit stair for the whole building, under VBBL 2025 Subsection ${esc(S.clause || '3.2.10')} (${esc(S.bylaw || 'By-law 14576')}, in force 20 January 2026). In Vancouver the one exit is an exterior stair reached by an exterior exit passageway, not an interior stair. Limits: ${S.storeyCap ?? 6} storeys and ${S.height ?? 18} m or less; ${S.unitsLow ?? 6} homes per floor on storeys 1–3 and ${S.unitsHigh ?? 4} above; ${S.persons ?? 24} persons per floor; travel ${S.travel ?? 25} m or less; sprinklered throughout. The tool checks storeys, homes per floor and travel; it draws the stair inside the plate, so the exterior stair and passageway stay unresolved, never a pass.`; }],
    ['travel', 'Travel distance', () => { const T = R().VBBL?.travel || {}; return `The walk from a suite door to the nearest exit stair: at most ${T.sprinklered ?? 45} m when the floor is sprinklered throughout, otherwise ${T.other ?? 30} m (VBBL ${esc(T.clause || '3.4.2.5')}). The tool measures it along the corridor as a screen, not full exit compliance.`; }],
    ['dead-end', 'Dead-end corridor', () => { const D = R().VBBL?.deadEnd || {}; return `A stretch of corridor with an exit in only one direction. VBBL ${esc(D.clause || '3.3.1.9.(5)')} allows at most ${D.v ?? 6} m. The tool measures from the closed end to the first junction or exit and draws any over the limit in red on the Review plan.`; }]
  ];
  const STEPS = [
    ['Site', 'Click an R3 parcel on the map, or shift-click neighbours to combine lots. The panel shows the permitted FSR.'],
    ['1 Massing', 'The largest massing the yards, height and FSR allow. Confirm it to continue.'],
    ['2 Plan setup', 'Answer a few questions (stairs, lift, corridor, ground floor), then Generate plan.'],
    ['3 Units', 'Homes placed on every floor. Merge, split and move walls by hand.'],
    ['4 Review', 'Zoning and building-code checks, exit routes and unit mix, with a verdict.'],
    ['5 Presentation', 'The design drawn in context, ready to print.']
  ];
  // which FSR applies to the site in view: the same computation the site panel uses
  function siteLine() {
    try {
      const s = root.SITE?.current?.(), I = root.CAP?.inputs, RF = root.REFERENCE; if (!s || !I || !RF) return '';
      if (root.SITE.verdictFor(s)[0] === 'fail') return `<p>${esc(s.addr)} does not meet the site minimum, so no FSR applies yet.</p>`;
      const r = RF.compute(s, I), f = r?.fsr; if (!f || f.fsr == null) return f?.steps?.length ? `<p>${esc(f.steps.join(' '))}</p>` : '';
      return `<p><b>${esc(s.addr)}</b> · ${esc(s.zone)}: permitted FSR <b class="hp-num">${num(f.fsr, 2)}</b> (${esc(f.clause)}).</p><p class="hp-sub">${esc(f.steps.join(' '))}</p>`;
    } catch (e) { return ''; }
  }

  let sheet = null, opener = null;
  function build() {
    const el = doc.createElement('div'); el.className = 'hp'; el.hidden = true;
    el.innerHTML = `<div class="hp-scrim" data-hp="close"></div><section class="hp-sheet" role="dialog" aria-modal="true" aria-labelledby="hp-title" tabindex="-1">
      <header class="hp-head"><h2 id="hp-title">Help &amp; glossary</h2><button class="btn small" type="button" data-hp="close">Close</button></header>
      <div class="hp-body"><label class="hp-find"><span>Find a term</span><input type="search" autocomplete="off" placeholder="FSR, TOA, scissor…"></label>
      <section class="hp-site" aria-labelledby="hp-site-h" hidden><h3 id="hp-site-h">Which FSR applies to this site</h3><div></div></section>
      <section class="hp-how" aria-labelledby="hp-how-h"><h3 id="hp-how-h">How the tool works</h3><ol>${STEPS.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol></section>
      <section aria-labelledby="hp-gl-h"><h3 id="hp-gl-h">Glossary</h3><dl class="hp-terms"></dl><p class="hp-none" hidden>No term matches.</p></section>
      <section class="hp-legal" aria-labelledby="hp-legal-h"><h3 id="hp-legal-h">Terms &amp; credits</h3><p>© 2026 Yeoneui Kim. All rights reserved. You may use this tool to study sites; copying or reusing its code needs written permission.</p><p>A schematic study, not a zoning or building code determination, a permit review or professional advice. Check every result with the City of Vancouver and qualified professionals.</p><p>Contains information licensed under the Open Government Licence – Vancouver. Map tiles © Esri. Built with Leaflet (BSD-2-Clause) and three.js (MIT); fonts Geist and IBM Plex Sans (SIL Open Font License).</p></section>
      <p class="hp-note">Schematic feasibility only: not a zoning or building code determination.</p></div></section>`;
    doc.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target.closest('[data-hp="close"]')) close(); });
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return; // keep focus inside the sheet
      const f = [...el.querySelectorAll('button, input, summary, [href]')].filter(n => n.getClientRects().length); if (!f.length) return;
      if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); } else if (!e.shiftKey && doc.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    });
    el.querySelector('.hp-find input').addEventListener('input', e => filter(e.target.value));
    return el;
  }
  function filter(q) {
    q = q.trim().toLowerCase(); let n = 0;
    sheet.querySelectorAll('.hp-term').forEach(d => { const on = !q || d.textContent.toLowerCase().includes(q); d.hidden = !on; n += on; });
    sheet.querySelector('.hp-none').hidden = n > 0;
  }
  function open(term) {
    if (!sheet) sheet = build();
    if (sheet.hidden) opener = doc.activeElement;
    sheet.querySelector('.hp-terms').innerHTML = TERMS.map(([id, t, d]) => `<div class="hp-term" id="hp-${id}" data-term="${id}"><dt>${esc(t)}</dt><dd>${d()}</dd></div>`).join('');
    const line = siteLine(), sb = sheet.querySelector('.hp-site'); sb.hidden = !line; sb.querySelector('div').innerHTML = line;
    const input = sheet.querySelector('.hp-find input'); input.value = ''; filter('');
    sheet.hidden = false; doc.body.classList.add('hp-on');
    const hit = term && sheet.querySelector(`[data-term="${CSS.escape(term)}"]`), body = sheet.querySelector('.hp-body');
    sheet.querySelectorAll('.hp-term.on').forEach(d => d.classList.remove('on'));
    if (hit) { hit.classList.add('on'); body.scrollTop = hit.offsetTop - body.offsetTop - 12; } else body.scrollTop = 0;
    (hit ? sheet.querySelector('.hp-sheet') : input).focus({ preventScroll: true });
  }
  function close() {
    if (!sheet || sheet.hidden) return; sheet.hidden = true; doc.body.classList.remove('hp-on');
    if (opener && opener.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true }); opener = null;
  }
  // the § buttons in the site panel carry data-help; .why[data-why] is mapped too in case the markup changes
  const WHY = { area: 'site-area', frontage: 'frontage', depth: 'depth', fsr: 'permitted-achieved' };
  doc.addEventListener('click', e => {
    const b = e.target.closest?.('[data-help], .why[data-why]'); if (!b || b.closest('.hp')) return;
    const term = b.dataset.help || WHY[b.dataset.why]; if (!term) return;
    e.preventDefault(); e.stopPropagation(); open(term); // capture phase: the panel's own handler does not also scroll the page
  }, true);
  // "?" opens help from anywhere outside a text field (the stage bar, and its Help button, is hidden in the workspace)
  doc.addEventListener('keydown', e => { if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable]') || doc.querySelector('.intro')) return; e.preventDefault(); open(); });
  root.HELP = { open, close, terms: () => TERMS.map(t => t[0]) };
})(typeof window !== 'undefined' ? window : globalThis);
