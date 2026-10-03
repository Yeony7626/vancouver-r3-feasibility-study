/* export-study.js: one "Export study" menu, on Review and on Presentation. Four outputs from the live study, nothing
   recomputed here:
   - Client report: summary and key figures, the typical and ground floor plans, the code summary and the unit schedule;
     printed from the browser (Save as PDF in the print dialog), Letter portrait.
   - Plan · SVG: the floor on screen.
   - Image · PNG: the 3D view, when Presentation has one open.
   - Study · JSON: inputs and result, for reopening or audit.
   Titles carry the address and the option name, never the internal revision hash. */
(function (root) {
  'use strict';
  const doc = root.document;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const study = () => root.UNITS_UI?.study?.() || null;
  const ready = st => !!(st?.r?.ok && st.r.count && st.o?.unitsGenerated);
  // the option's own name: the saved option, else the layout the brief asked for
  const LAYOUT = { double: 'Double-loaded corridor', gallery: 'Single-loaded corridor', point: 'Central core' };
  function name(st) { return st?.option || LAYOUT[st?.o?.brief?.layout || st?.o?.layoutType] || 'Current design'; }
  const title = st => `${st.ctx.addr} · ${name(st)}`;
  const slug = st => `${st.ctx.addr} ${name(st)}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'r3-study';
  function save(blob, file) { const a = doc.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

  function json() { const st = study(); if (!st?.r) return;
    save(new Blob([JSON.stringify({ format: 'r3-spatial-study-v2', title: title(st), site: { address: st.site?.addr, area: st.site?.area, zone: st.site?.zone }, inputs: st.o, result: st.r, disclaimer: 'Schematic study. Not a certified zoning or building-code calculation.' }, null, 2)], { type: 'application/json' }), slug(st) + '.json'); }
  function svg() { const st = study(); if (!ready(st)) return; const l = st.r.levels?.[st.floor - 1] || st.r;
    save(new Blob([root.EXPLORE_DRAW.plan(l, { title: `${title(st).toUpperCase()} · FLOOR ${st.floor}` })], { type: 'image/svg+xml' }), `${slug(st)}-floor-${st.floor}.svg`); }
  function png() { root.PRESENTATION?.exportImage?.(); }

  // ---------- the client report ----------
  // A document for a client, not a print of the review screen: Letter portrait, summary first, then the plans, the code
  // summary and the unit schedule. Real headings and tables, a text alternative on every drawing, status in words, and the
  // address and page number on every page, so the saved PDF reads in order with a screen reader.
  const f0 = v => Number(v).toLocaleString('en-CA', { maximumFractionDigits: 0 }), f1 = v => Number(v).toLocaleString('en-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), f2 = v => Number(v).toFixed(2);
  const TYPE = { S: 'Studio', '1B': '1 bedroom', '2B': '2 bedroom', '3B': '3 bedroom' };
  const STATUS = { pass: ['Meets', 'ok'], fail: ['Does not meet', 'no'], verify: ['To verify', 'open'], unknown: ['To verify', 'open'] };
  const status = st => { const [t, k] = STATUS[st] || ['Note', 'open']; return `<span class="cr-st cr-${k}"><span aria-hidden="true">${k === 'ok' ? '✓' : k === 'no' ? '✕' : '○'}</span> ${t}</span>`; };
  // each drawing gets its own pattern and marker ids: the app's own plans stay in the page, hidden, and a repeated id
  // resolves to the hidden copy (units then print solid black)
  let fig = 0;
  function drawing(svg, label) { const p = 'cr' + (++fig) + '-'; return String(svg).replace(/\bid="([^"]+)"/g, (m, id) => `id="${p}${id}"`).replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${p}${id})`).replace(/href="#([^"]+)"/g, (m, id) => `href="#${p}${id}"`).replace(/<svg\b([^>]*?)\saria-label="[^"]*"/, '<svg$1').replace(/<svg\b/, `<svg aria-label="${esc(label)}"`); }
  function floorText(l) { const us = (l.units || []).slice().sort((p, q) => p.id - q.id); return us.length ? `${us.length} home${us.length === 1 ? '' : 's'}: ${us.map(u => `${root.EXPLORE?.unitNo ? root.EXPLORE.unitNo(l.level, u.id) : u.id} ${(TYPE[u.type] || u.type).toLowerCase()} ${f1(u.net)} m²`).join(', ')}.` : 'No homes on this floor.'; }
  function sheet() {
    const st = study(); if (!ready(st) || !root.REVIEW) return;
    const { r, ctx, o } = st, rep = root.REVIEW.summary(r, ctx, o, { sprinklered: o.sprinklered !== false }), V = root.EXPLORE_DRAW, M = rep.M;
    const date = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
    const levels = r.levels || [], typical = levels.find(l => l.level > 1 && l.units?.length) || levels[0];
    const same = levels.filter(l => l.level > 1 && (l.units || []).length === (typical.units || []).length).map(l => l.level), span = same.length > 1 ? `levels ${same[0]}–${same[same.length - 1]}` : `level ${typical.level}`;
    const gross = levels.reduce((t, l) => t + (l.ledger?.built || 0), 0), net = levels.reduce((t, l) => t + (l.ledger?.net || 0), 0);
    const fails = rep.rows.filter(q => q.status === 'fail'), studyFails = (rep.study || []).filter(q => q.status === 'fail');
    const head = fails.length ? `Not feasible as drawn` : studyFails.length ? `Feasible as drawn, with ${studyFails.length} design check${studyFails.length === 1 ? '' : 's'} to resolve` : 'Feasible as drawn';
    const bind = root.SUMMARY_SHEET?.binding ? root.SUMMARY_SHEET.binding(r, ctx, o) : null, height = rep.rows.find(q => q.item === 'Building height')?.value || '';
    const t = rep.tally, tally = `${t.meet} code check${t.meet === 1 ? '' : 's'} met · ${t.fail} not met · ${t.verify} item${t.verify === 1 ? '' : 's'} to verify`;
    const figure = (label, value, note) => `<div class="cr-fig"><dt>${label}</dt><dd><b>${value}</b>${note ? `<span>${note}</span>` : ''}</dd></div>`;
    const mixReq = ctx.mix || {}, two = (M.tot['2B'] || 0) + (M.tot['3B'] || 0), three = M.tot['3B'] || 0, pct = v => `${f1(v * 100)}%`;
    const mixRows = ['S', '1B', '2B', '3B'].map(k => `<tr><th scope="row">${TYPE[k]}</th><td>${M.tot[k] || 0}</td><td>${M.count ? pct((M.tot[k] || 0) / M.count) : '—'}</td><td>${M.avg[k] ? f1(M.avg[k]) + ' m²' : '—'}</td></tr>`).join('');
    const plan = (l, title, caption) => `<figure class="cr-plan"><figcaption><b>${esc(title)}</b> ${esc(caption)}</figcaption>${drawing(V.plan(l, { title: title.toUpperCase() }), `${title}. ${caption}`)}</figure>`;
    // notes written for the tool's screens, said without pointing at them
    const plain = t => String(t || '').replace(/;? shown on the Review plan \(red over the limit\)/, '').replace(/,? set in the side panel/, '');
    const codeRow = q => `<tr><th scope="row">${esc(q.item)}${q.note ? `<small>${esc(plain(q.note))}</small>` : ''}</th><td class="cr-clause">${esc(q.clause || '')}</td><td>${esc(q.req || '')}</td><td>${esc(q.value || '')}</td><td>${status(q.status)}</td></tr>`;
    const groups = [...new Set(rep.rows.map(q => q.group))];
    const codeBody = groups.map(g => `<tbody><tr class="cr-group"><th scope="rowgroup" colspan="5">${esc(g)}</th></tr>${rep.rows.filter(q => q.group === g).map(codeRow).join('')}</tbody>`).join('')
      + ((rep.study || []).length ? `<tbody><tr class="cr-group"><th scope="rowgroup" colspan="5">Design checks set by this study</th></tr>${rep.study.map(q => `<tr><th scope="row">${esc(q.item)}</th><td class="cr-clause">${esc(q.source || '')}</td><td colspan="2">${esc(q.message || '')}</td><td>${status(q.status)}</td></tr>`).join('')}</tbody>` : '');
    const matrixRows = M.rows.map(q => `<tr><th scope="row">${q.level === 1 ? 'Ground' : 'Level ' + q.level}</th>${['S', '1B', '2B', '3B'].map(k => `<td>${q.c[k] || '—'}</td>`).join('')}<td>${q.total}</td><td>${f1(q.net)}</td></tr>`).join('');
    const box = doc.getElementById('sheet'); if (!box) return;
    box.innerHTML = `<style>@page report{@bottom-left{content:"${esc(ctx.addr).replace(/"/g, '')} · ${esc(name(st)).replace(/"/g, '')} · schematic study";font:7.5pt Geist,Arial,sans-serif;color:#4a5059}@bottom-right{content:"Page " counter(page) " of " counter(pages);font:7.5pt Geist,Arial,sans-serif;color:#4a5059}}</style>
    <article class="cr" aria-label="Client report">
      <section class="cr-page" aria-labelledby="cr-title">
        <header class="cr-mast"><p>R3 site feasibility study</p><p>${esc(date)}</p></header>
        <h1 id="cr-title">${esc(ctx.addr)}</h1>
        <p class="cr-sub">${esc([ctx.zone, ctx.area ? f0(ctx.area) + ' m² site' : '', name(st), o.floors + ' storeys'].filter(Boolean).join(' · '))}</p>
        <div class="cr-verdict ${fails.length ? 'cr-verdict-no' : ''}"><h2>${esc(head)}</h2>${bind ? `<p>${esc(bind.head)} ${esc(bind.note)}</p>` : ''}<p class="cr-tally">${tally}.</p></div>
        <h2 class="cr-h">Key figures</h2>
        <dl class="cr-figs">${figure('Homes', f0(M.count), `${M.count ? f0(net / M.count) : 0} m² average`)}${figure('Storeys', o.floors, height ? height + ' high' : '')}${figure('Floor space ratio', f2(r.achieved), `of ${f2(ctx.permitted)} permitted`)}
          ${figure('Gross floor area', f0(gross) + ' m²', 'all floors')}${figure('Net home area', f0(net) + ' m²', 'inside the homes')}${figure('Efficiency', gross ? f1(net / gross * 100) + '%' : '—', 'net ÷ gross')}</dl>
        <h2 class="cr-h">Homes by size</h2>
        <table class="cr-table cr-mix"><caption>Homes by number of bedrooms, all floors</caption><thead><tr><th scope="col">Type</th><th scope="col">Homes</th><th scope="col">Share</th><th scope="col">Average size</th></tr></thead><tbody>${mixRows}</tbody>
          <tfoot><tr><th scope="row">Total</th><td>${M.count}</td><td>100%</td><td>${M.count ? f1(M.net / M.count) + ' m²' : '—'}</td></tr></tfoot></table>
        <p class="cr-note">R3 unit mix (${esc(mixReq.clause || '§2.2.6')}): 2 or more bedrooms ${M.count ? pct(two / M.count) : '—'} against ${pct(mixReq.two || 0)} required; 3 bedrooms ${M.count ? pct(three / M.count) : '—'} against ${pct(mixReq.three || 0)} required.</p>
      </section>
      <section class="cr-page" aria-labelledby="cr-plans"><h2 class="cr-h" id="cr-plans">Floor plans</h2>
        ${plan(typical, `Typical floor, ${span}`, floorText(typical))}
        ${typical !== levels[0] ? plan(levels[0], 'Ground floor', floorText(levels[0])) : ''}
      </section>
      <section class="cr-page" aria-labelledby="cr-code"><h2 class="cr-h" id="cr-code">Code and zoning summary</h2>
        <p class="cr-lede">${tally}. Zoning limits from the R3 district schedule; building code limits from VBBL 2025, Division B, Part 3${rep.sprinklered ? '; sprinklered throughout is assumed' : ''}.</p>
        <table class="cr-table cr-code"><caption>Requirements checked against the drawn plan</caption><thead><tr><th scope="col">Requirement</th><th scope="col">Clause</th><th scope="col">Required</th><th scope="col">This design</th><th scope="col">Result</th></tr></thead>${codeBody}</table>
        <h3>Not checked by this study</h3><p class="cr-lede">To confirm with the design team and the City before relying on this study.</p>
        <ul class="cr-verify">${(rep.verify || []).map(v => `<li><b>${esc(v.item)}</b> ${esc(v.note || '')}</li>`).join('')}</ul>
      </section>
      <section class="cr-page cr-flow" aria-labelledby="cr-sched"><h2 class="cr-h" id="cr-sched">Unit schedule</h2>
        <table class="cr-table cr-matrix"><caption>Homes on each floor by number of bedrooms, with net home area</caption><thead><tr><th scope="col">Floor</th><th scope="col">Studio</th><th scope="col">1 bed</th><th scope="col">2 bed</th><th scope="col">3 bed</th><th scope="col">Homes</th><th scope="col">Net m²</th></tr></thead>
          <tbody>${matrixRows}</tbody><tfoot><tr><th scope="row">Total</th>${['S', '1B', '2B', '3B'].map(k => `<td>${M.tot[k] || 0}</td>`).join('')}<td>${M.count}</td><td>${f1(M.net)}</td></tr></tfoot></table>
        <h3>About this study</h3>
        <p class="cr-lede">A schematic feasibility study generated from the City of Vancouver's parcel data and the R3 zoning rules, read from the drawn plan. It is not a zoning or building code determination, a survey, or a permit review. Areas are measured to the inside of the drawn walls; site area and dimensions come from assessment-based parcel data.</p>
      </section>
    </article>`;
    box.hidden = false; doc.body.classList.add('printing'); const t0 = doc.title; doc.title = title(st);
    const done = () => { doc.body.classList.remove('printing'); box.hidden = true; doc.title = t0; root.removeEventListener('afterprint', done); };
    root.addEventListener('afterprint', done); root.print(); setTimeout(() => { if (!root.matchMedia?.('print').matches) done(); }, 400);
  }

  // ---------- the menu ----------
  let open = null;
  function close() { if (!open) return; open.menu.remove(); open.btn.setAttribute('aria-expanded', 'false'); doc.removeEventListener('pointerdown', outside, true); doc.removeEventListener('keydown', key, true); open = null; }
  const outside = e => { if (open && !open.menu.contains(e.target) && e.target !== open.btn) close(); };
  const key = e => { if (!open) return; const items = [...open.menu.querySelectorAll('button:not([disabled])')], i = items.indexOf(doc.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); const b = open.btn; close(); b.focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); } };
  function menu(btn) {
    if (open) { const same = open.btn === btn; close(); if (same) return; }
    const st = study(), ok = ready(st), shot = !!root.PRESENTATION?.canExport?.();
    const items = [['sheet', 'Client report', 'Print, or Save as PDF', ok], ['svg', 'Plan · SVG', `Floor ${st?.floor || 1}, as drawn`, ok], ['png', 'Image · PNG', shot ? 'The 3D view on screen' : 'Open Presentation for the 3D view', shot], ['json', 'Study · JSON', 'Inputs and result', !!st?.r]];
    const m = doc.createElement('div'); m.className = 'xs-menu'; m.setAttribute('role', 'menu'); m.setAttribute('aria-label', 'Export study');
    m.innerHTML = items.map(([k, label, note, on]) => `<button type="button" role="menuitem" data-xs="${k}" ${on ? '' : 'disabled'}><b>${label}</b><span>${note}</span></button>`).join('');
    doc.body.appendChild(m); const r = btn.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.right - w))}px`; m.style.top = `${r.top - h - 6 > 8 ? r.top - h - 6 : r.bottom + 6}px`;
    m.querySelectorAll('[data-xs]').forEach(b => b.onclick = () => { const k = b.dataset.xs; close(); ({ sheet, svg, png, json })[k](); });
    open = { menu: m, btn }; btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'true');
    doc.addEventListener('pointerdown', outside, true); doc.addEventListener('keydown', key, true);
    m.querySelector('button:not([disabled])')?.focus();
  }
  // the workspace footer button: {label, onClick} for WORKSPACE_SHELL secondary actions
  const action = () => ({ label: 'Export study ▾', onClick: e => menu(e.currentTarget), title: 'Client report, plan, image or data' });
  root.EXPORT_STUDY = { menu, action, sheet, svg, json, png, title, name };
})(typeof window !== 'undefined' ? window : globalThis);
