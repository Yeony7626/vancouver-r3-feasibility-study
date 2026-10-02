/* export-study.js: one "Export study" menu, on Review and on Presentation. Four outputs from the live study, nothing
   recomputed here:
   - Client sheet: verdict and figures, the area schedule, the ground and a typical floor plan, the massing, the code
     summary; printed from the browser (Save as PDF in the print dialog).
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

  // ---------- the client sheet ----------
  function sheet() {
    const st = study(); if (!ready(st) || !root.REVIEW) return;
    const { r, ctx, o } = st, rep = root.REVIEW.summary(r, ctx, o, { sprinklered: o.sprinklered !== false }), V = root.EXPLORE_DRAW;
    const date = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
    const typical = r.levels.find(l => l.level > 1 && l.units?.length) || r.levels[0];
    const plan = (l, label) => l ? `<figure class="cs-plan"><figcaption>${esc(label)}</figcaption>${V.plan(l, { title: label.toUpperCase() })}</figure>` : '';
    let massing = ''; try { massing = V.axon(r, { extent: { W: ctx.bounds.w, D: ctx.bounds.h } }); } catch (e) { massing = ''; }
    const box = doc.getElementById('sheet'); if (!box) return;
    box.innerHTML = `<article class="cs">
      <header class="cs-head"><div><p class="cs-eyebrow">R3 site feasibility · client sheet</p><h1>${esc(ctx.addr)}</h1><p>${esc(ctx.zone || '')} · ${esc(name(st))} · ${o.floors} storeys · ${r.count} homes</p></div><p class="cs-date">${esc(date)}</p></header>
      <section class="cs-page">${root.REVIEW.html(rep, ctx, { r, o })}</section>
      <section class="cs-page cs-plans"><h2>Plans</h2>${plan(r.levels[0], 'Ground floor')}${typical !== r.levels[0] ? plan(typical, `Typical floor · level ${typical.level}`) : ''}</section>
      ${massing ? `<section class="cs-page cs-mass"><h2>Massing</h2><figure>${massing}</figure></section>` : ''}
      <footer class="cs-foot">Schematic study. Not a zoning or building code determination; read from the drawn plan. Items not checked are listed under To verify.</footer></article>`;
    // a client reads the verdict, the schedule and the code summary; the per-unit exit table stays in the tool
    box.querySelectorAll('.rv section').forEach(s => { if (/^Exit distances/i.test(s.querySelector('h3')?.textContent || '')) s.remove(); });
    box.querySelectorAll('button').forEach(b => { const s = doc.createElement('span'); s.textContent = b.textContent; b.replaceWith(s); });
    box.hidden = false; doc.body.classList.add('printing'); const t = doc.title; doc.title = title(st);
    const done = () => { doc.body.classList.remove('printing'); box.hidden = true; doc.title = t; root.removeEventListener('afterprint', done); };
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
    const items = [['sheet', 'Client sheet', 'Print, or Save as PDF', ok], ['svg', 'Plan · SVG', `Floor ${st?.floor || 1}, as drawn`, ok], ['png', 'Image · PNG', shot ? 'The 3D view on screen' : 'Open Presentation for the 3D view', shot], ['json', 'Study · JSON', 'Inputs and result', !!st?.r]];
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
  const action = () => ({ label: 'Export study ▾', onClick: e => menu(e.currentTarget), title: 'Client sheet, plan, image or data' });
  root.EXPORT_STUDY = { menu, action, sheet, svg, json, png, title, name };
})(typeof window !== 'undefined' ? window : globalThis);
