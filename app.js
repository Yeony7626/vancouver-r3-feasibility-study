/* app.js — orchestration. One refresh() recomputes site → capacity → massing → egress and redraws the stage. */
window.APP = (function () {
  const P = window.R3_PARCELS, $ = id => document.getElementById(id), D = window.DRAW;
  const fmt = (v, d = 0) => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d });
  const state = { tab: 'site', compare: 'off' };
  const panes = { site: 'site-tab', capacity: 'reference-tab', massing: 'units-tab', corridor: 'units-tab', units: 'units-tab', egress: 'units-tab', presentation: 'units-tab' };

  function init() {
    window.SITE.init(); window.MAP.init(); window.CAP.bind(); window.MASS.renderControls(); window.EGRESS.renderParams(); window.UNITS_UI.init();
    $('mv-fit').onchange = e => { window.MASS.fit.mode = e.target.value; refresh(); }; $('mv-mindepth').onchange = e => { window.MASS.fit.minDepth = +e.target.value || 12; refresh(); };
    search();
    document.querySelectorAll('.tab').forEach(b => b.onclick = () => { if (!b.disabled) showTab(b.dataset.tab); });
    document.querySelectorAll('.seg').forEach(b => b.onclick = () => setScheme(b.dataset.scheme));
    $('compare').onchange = e => { state.compare = e.target.value; refresh(); };
    $('map-expand').onclick = () => showTab('site'); $('s-next').onclick = () => showTab('capacity');
    $('print').onclick = () => ['massing','units','egress'].includes(state.tab) ? window.UNITS_UI.print() : printSheet();
    $('open-example').onclick = () => { if (window.INTRO?.example) return window.INTRO.example(); const index=P.findIndex(p=>p.area>=1400 && p.frontage>=32 && p.depth>=30 && !p.irregular); window.SITE.select(index>=0?index:P.findIndex(p=>p.area>=920),false); showTab('capacity'); };
    // a new site starts clean: no ticks, status or revisions carried over from the last one (the next render re-marks them)
    // and its massing starts at the storeys the site panel recommends (the default six when there is no recommendation)
    let lastSite = '';
    document.addEventListener('site:change', () => { const s = window.SITE.current(), key = s ? JSON.stringify(s.ids) : ''; if (key === lastSite) return; lastSite = key;
      document.querySelectorAll('.tab[data-state]').forEach(b => delete b.dataset.state); if ($('u-status')) $('u-status').textContent = ''; if ($('rev-list')) $('rev-list').replaceChildren();
      const I = window.CAP?.inputs; if (s && I && I.massingConfirmed?.site !== key && window.SITE.verdictFor(s)[0] !== 'fail') { I.storeyCap = 6; I.plateTarget = 0; try { const rc = window.REFERENCE?.recommend?.(s, I); if (rc) I.storeyCap = rc.n; } catch (e) {} } });
    document.addEventListener('site:change', () => { const s = window.SITE.current(); const ok = s && window.SITE.verdictFor(s)[0] !== 'fail'; if (!ok && state.tab !== 'site') showTab('site'); else refresh(); });
    // Escape is reserved for cancelling an active drawing edit. Tabs remain explicit.
  }
  function setScheme(k) {
    window.CAP.inputs.egress = k; window.CAP.inputs.coreTouched = false;
    document.querySelectorAll('.seg').forEach(b => { const on = b.dataset.scheme === k; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    refresh();
  }
  function showTab(t) {
    const from = document.activeElement;
    state.tab = t; window.dispatchEvent(new CustomEvent('r3-tab', { detail: t }));
    
    document.querySelectorAll('.tab').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    // controls only where they act
    document.querySelector('.scheme').hidden = true;
    document.querySelector('.cmp-ctl').hidden = true;
    $('print').hidden = ['site','capacity'].includes(t);
    Object.entries(panes).forEach(([k, id]) => $(id).hidden = true); $(panes[t]).hidden=false; $('eg-tab').hidden=true;
    $('stage').classList.toggle('exploring', t !== 'site');
    const isSite = t === 'site';
    $('map-wrap').classList.toggle('locator', !isSite); if ($('rev-strip')) $('rev-strip').hidden = isSite || !$('rev-list').children.length; $('map-expand').hidden = isSite; $('dwg').hidden = true; $('u-stage').hidden = isSite; $('delta').hidden = true;
    $('site-empty').hidden = !(isSite && !window.SITE.current());
    $('stage').classList.toggle('wide', !isSite);
    setTimeout(() => window.MAP.map.invalidateSize(), 60);
    refresh();
    window.UI_MOTION?.phase(t);
    // keyboard: after a Continue (not a tab click), focus lands on the new step's first heading instead of the page top
    if (t !== 'site' && !from?.closest?.('.tab, .ws-steps')) setTimeout(() => { const h = document.querySelector('body.ws-on .ws-steps [aria-current="step"]') || $(panes[t])?.querySelector('h1, h2'); if (h && h.getClientRects().length) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }, 120);
  }

  function refresh() {
    const site = window.SITE.current(); const v = site ? window.SITE.verdictFor(site) : null; const ok = site && v[0] !== 'fail';
    document.querySelectorAll('.tab:not([data-tab="site"])').forEach(t => { t.disabled = !ok; t.title = !site ? 'Select a site first' : !ok ? 'Site fails the minimum — resolve first' : ''; });
    $('print').disabled = !ok; window.UI_MOTION?.tabs();
    document.querySelectorAll('.seg').forEach(b => { const on = b.dataset.scheme === window.CAP.inputs.egress; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    if (!ok) { $('dwg').innerHTML = ''; window.WORKSPACE_SHELL?.hide(); return; }
    const I = window.CAP.inputs; I.regime='now';
    const r = window.REFERENCE.compute(site, I), m = r.mass;
    if (state.tab === 'capacity') { window.REFERENCE.render(site,I,r); return; }
    if (['massing','corridor','units','egress','presentation'].includes(state.tab)) { window.UNITS_UI.render(site, m, I, r); return; }
    // The reference has its own renderer; legacy calculator views are not reused.
  }

  // ---------- panels ----------
  function renderMassingPanel(site, I, r, m) {
    const c = $('mv-conclusion');
    if (!m.ok) { c.className = 'callout fail'; c.textContent = m.error; }
    else if (r.fail) { c.className = 'callout fail'; c.textContent = r.fail; }
    else { c.className = 'callout ' + (r.binding === 'density' ? 'pass' : r.excess > 0.5 ? 'fail' : 'warn'); c.innerHTML = `${m.N} storeys${m.fit && m.fit.partialTop ? ' (top partial)' : ''} · ${fmt(m.footprint)} m² footprint · ${fmt(m.gross)} m² gross · ${r.units.units} units<span class="sub">${r.excess > 0.5 ? 'drawn mass exceeds density' : r.binding + ' binds'} · FSR ${r.fsrUsed.toFixed(2)} of ${r.fsr.fsr.toFixed(2)} · building depth ${fmt(m.fit && m.fit.mode === 'depth' ? m.fit.depthDrawn : m.Env.depth, 1)} m drawn, envelope ${fmt(m.Env.depth, 1)} m, lot ${fmt(site.depth, 1)} m</span>`; }
    window.MASS.renderTable(m, r.fail ? null : r);
  }
  // ---------- stage drawings ----------
  function drawStage(site, I, r, m) {
    const dwg = $('dwg'); dwg.innerHTML = ''; const delta = $('delta'); delta.hidden = true; delta.innerHTML = '';
    const other = state.compare === 'off' ? null : state.compare === 'regime' ? { regime: I.regime === 'oct' ? 'now' : 'oct' } : state.compare === I.egress ? null : { egress: state.compare };
    const labelFor = ov => ov ? (ov.regime ? (ov.regime === 'oct' ? 'from 27 Oct' : 'current regime') : window.EGRESS.SCHEMES[ov.egress].label) : (I.regime === 'oct' ? 'from 27 Oct' : 'current regime') + ' · ' + window.EGRESS.SCHEMES[I.egress].label;
    if (state.tab === 'egress') {
      const A = window.EGRESS.scheme(I.egress, m, I, site);
      let Bkey = other && other.egress ? other.egress : (I.egress === 'two' ? 'one' : 'two'), Bm = m, BI = I;
      if (other && other.regime) { BI = Object.assign({}, I, other); const rB = window.CAP.compute(site, BI); Bm = rB.fail ? window.MASS.model(site, BI) : (rB.mass || window.MASS.model(site, BI)); Bkey = I.egress; }
      const B = Bm.ok ? window.EGRESS.scheme(Bkey, Bm, BI, site) : null;
      dwg.className = 'dwg-area pair';
      // common scale across the pair: probe each drawing's natural fit, take the smaller
      const kAx = Math.min(...[[A, m], B ? [B, Bm] : null].filter(Boolean).filter(([sc, mm]) => mm.ok && !sc.empty).map(([sc, mm]) => +window.EGRESS.drawAxon(sc, mm).dataset.k));
      const kPl = Math.min(...[[A, m], B ? [B, Bm] : null].filter(Boolean).filter(([sc, mm]) => mm.ok && !sc.empty).map(([sc, mm]) => +window.EGRESS.drawPlan(sc, mm).dataset.k));
      const col = (sc, mm, lbl) => { const c = document.createElement('div'); c.className = 'col'; const h = document.createElement('div'); h.className = 'col-h'; h.textContent = lbl; c.appendChild(h); if (!mm.ok) { c.insertAdjacentHTML('beforeend', `<p class="warn-text pad">${mm.error}</p>`); return c; } if (sc.empty) { c.insertAdjacentHTML('beforeend', `<p class="warn-text pad">${sc.notes[0]}</p>`); return c; } c.appendChild(window.EGRESS.drawAxon(sc, mm, 360, 300, kAx)); c.appendChild(window.EGRESS.drawPlan(sc, mm, 360, 260, kPl)); return c; };
      if (m.ok) dwg.appendChild(col(A, m, `${A.S.label} — ${labelFor(null)}`)); else dwg.insertAdjacentHTML('beforeend', `<p class="warn-text pad">${m.error}</p>`);
      if (B) { dwg.appendChild(col(B, Bm, `${B.S.label} — ${other && other.regime ? labelFor(other) : labelFor(null).split(' · ')[0]}`)); deltaStrip(A, B, `${A.S.label} → ${B.S.label}`); }
      return;
    }
    // capacity / massing
    if (!other) {
      dwg.className = 'dwg-area trio';
      const big = document.createElement('div'); big.className = 'big v3d'; dwg.appendChild(big);
      if (window.THREE && window.VIEW3D) { window.VIEW3D.mount(big); window.VIEW3D.update(m, site, I, r); }
      else big.appendChild(window.MASS.drawMassing(m, { label: labelFor(null) }));
      const kc = m.ok ? window.MASS.commonK(m) : null;
      const side = document.createElement('div'); side.className = 'side'; side.appendChild(window.MASS.drawSitePlan(m, site, I, { k: kc })); side.appendChild(window.MASS.drawSection(m, site, I, { k: kc })); dwg.appendChild(side);
      if (!m.ok) dwg.insertAdjacentHTML('beforeend', `<p class="warn-text pad">${m.error}</p>`);
    } else {
      const I2 = Object.assign({}, I, other, { coreTouched: false, core: other.egress ? window.RULES.EGRESS[other.egress].core : I.core });
      const r2 = window.CAP.compute(site, I2), m2 = r2.fail ? window.MASS.model(site, I2) : (r2.mass || window.MASS.model(site, I2));
      dwg.className = 'dwg-area pair';
      [[m, labelFor(null)], [m2, labelFor(other)]].forEach(([mm, lbl]) => { const c = document.createElement('div'); c.className = 'col single'; const h = document.createElement('div'); h.className = 'col-h'; h.textContent = lbl; c.appendChild(h); c.appendChild(window.MASS.drawMassing(mm, { label: lbl })); dwg.appendChild(c); });
      if (m.ok && m2.ok && !r.fail && !r2.fail) {
        const A = window.EGRESS.scheme(I.egress, m, I, site), B = window.EGRESS.scheme(I2.egress, m2, I2, site);
        deltaStrip(A, B, `${labelFor(null)} → ${labelFor(other)}`, [['envelope depth m', m.Env.depth, m2.Env.depth, 1], ['storeys', m.N, m2.N, 0], ['gross m²', r.G, r2.G, 0], ['countable m²', r.countable, r2.countable, 0], ['units (calculator)', r.units.units, r2.units.units, 0]]);
      }
    }
  }
  function deltaStrip(A, B, title, extra) {
    const rows = [['plate used', A.unused != null ? 100 - Math.round(A.unused * 100) : null, B.unused != null ? 100 - Math.round(B.unused * 100) : null, 0, '%'], ['plate m²', A.gross, B.gross, 0], ['net-to-gross', A.n2g * 100, B.n2g * 100, 0, '%'], ['units (plan)', A.units, B.units, 0], ['avg unit m²', A.avg, B.avg, 0]].concat(extra || []);
    const d = $('delta'); d.hidden = false;
    d.innerHTML = `<div class="d-title">${title}</div>` + rows.map(rw => { const dv = rw[2] - rw[1]; const u = rw[4] || ''; return `<div class="d-cell"><span class="d-k">${rw[0]}</span><span class="d-v">${fmt(rw[1], rw[3])}${u} → ${fmt(rw[2], rw[3])}${u}</span><span class="d-d ${dv > 0 ? 'up' : dv < 0 ? 'down' : ''}">${dv > 0 ? '+' : ''}${fmt(dv, rw[3])}${u}</span></div>`; }).join('');
  }

  // ---------- print sheet ----------
  function printSheet() {
    const site = window.SITE.current(), I = window.CAP.inputs; const r = window.CAP.compute(site, I), m = r.fail ? window.MASS.model(site, I) : (r.mass || window.MASS.model(site, I));
    const sheet = $('sheet'); sheet.innerHTML = ''; sheet.hidden = false;
    const clauses = new Set(); (r.steps || []).forEach(s => s[4] && clauses.add(s[4]));
    const sc = m.ok ? window.EGRESS.scheme(I.egress, m, I, site) : null;
    const T = m.ok && !r.fail ? window.EGRESS.tests(I.egress, m, r) : [];
    T.forEach(t => clauses.add(t[1]));
    sheet.innerHTML = `<div class="sh-head"><div><h1>${site.addr}</h1><p>${site.zone} · ${site.kind === 'parcel' ? 'single parcel' : 'combined site — not a legal site until consolidated'} · ${fmt(site.area)} m² · ${fmt(site.frontage, 2)} × ${fmt(site.depth, 2)} m · ${I.regime === 'oct' ? 'regime from 27 Oct 2026' : 'current regime'} · ${I.tenure === 'rental' ? '100% rental' : 'strata / other'} · ${window.EGRESS.SCHEMES[I.egress].label}</p></div><div class="sh-figs">${r.fail ? `<b>${r.fail}</b>` : `<b>${r.units.units}</b> units · <b>${fmt(r.G)}</b> m² gross · <b>${r.fsrUsed.toFixed(2)}</b> FSR of ${r.fsr.fsr.toFixed(2)} · <b>${m.N}</b> storeys · ${r.binding} binds`}</div></div>`;
    const dr = document.createElement('div'); dr.className = 'sh-dwgs'; sheet.appendChild(dr);
    if (m.ok) { const kc = window.MASS.commonK(m); dr.appendChild(window.MASS.drawMassing(m, { label: '' })); dr.appendChild(window.MASS.drawSitePlan(m, site, I, { k: kc })); dr.appendChild(window.MASS.drawSection(m, site, I, { k: kc })); if (sc) dr.appendChild(window.EGRESS.drawPlan(sc, m, 360, 260, kc)); }
    const nums = document.createElement('div'); nums.className = 'sh-nums';
    nums.innerHTML = `<table class="steps"><tbody>${(r.steps || []).map(s => `<tr><td>${s[0]}</td><td class="calc">${s[1]}</td><td class="num">${fmt(s[2])} ${s[3]}</td></tr>`).join('')}</tbody></table>` +
      (T.length ? `<table class="tests">${T.map(t => `<tr><td><span class="st ${t[2]}">${t[2] === 'na' ? 'not testable' : t[2]}</span></td><td>${t[0]}</td></tr>`).join('')}</table>` : '') +
      `<h3>Clauses</h3><p class="cl">${[...clauses].join(' · ')}</p><p class="cl">NOT IN SOURCE: TOA By-law 14090 geometry; Parking By-law stall counts; corridor and stair dimensions (VBBL §3.3.1, §3.4.3); occupant load (§3.1.17). Open question: exterior passageway as a §10.41.3(a) appurtenance. Generated ${new Date().toISOString().slice(0, 10)} from City of Vancouver open data; parcels are assessment polygons, not surveys.</p>`;
    sheet.appendChild(nums);
    document.body.classList.add('printing');
    setTimeout(() => { window.print(); setTimeout(() => { document.body.classList.remove('printing'); sheet.hidden = true; }, 500); }, 100);
  }

  // ---------- search ----------
  function search() {
    const inp = $('search'), ul = $('results'); let hi = -1;
    const norm = s => s.toUpperCase().replace(/\bAVENUE\b/g, 'AV').replace(/\bSTREET\b/g, 'ST').replace(/\bAVE\b/g, 'AV').replace(/\s+/g, ' ').trim();
    function run() {
      const q = norm(inp.value); hi = -1; if (q.length < 2) { ul.hidden = true; return; }
      const hits = []; for (let i = 0; i < P.length && hits.length < 12; i++) if (P[i].addr.startsWith(q) || P[i].addr.includes(q)) hits.push(i);
      if (!hits.length) { ul.innerHTML = '<li class="muted">No R3 parcel matches. Only R3-1, R3-2 and R3-3 parcels are searchable.</li>'; ul.hidden = false; return; }
      ul.innerHTML = hits.map(i => `<li data-i="${i}"><span>${P[i].addr}</span><span class="z">${P[i].zone} · ${Math.round(P[i].area)} m²</span></li>`).join('');
      ul.querySelectorAll('li').forEach(li => li.onclick = () => pick(+li.dataset.i)); ul.hidden = false;
    }
    function pick(i) { ul.hidden = true; inp.value = P[i].addr; window.MAP.flyTo(i); }
    inp.addEventListener('input', run);
    inp.addEventListener('keydown', e => { const lis = ul.querySelectorAll('li[data-i]'); if (e.key === 'ArrowDown') hi = Math.min(hi + 1, lis.length - 1); else if (e.key === 'ArrowUp') hi = Math.max(hi - 1, 0); else if (e.key === 'Enter') { if (lis[hi >= 0 ? hi : 0]) pick(+lis[hi >= 0 ? hi : 0].dataset.i); return; } else if (e.key === 'Escape') { ul.hidden = true; return; } else return; e.preventDefault(); lis.forEach((l, k) => l.classList.toggle('hi', k === hi)); });
    document.addEventListener('click', e => { if (!ul.contains(e.target) && e.target !== inp) ul.hidden = true; });
  }
  init();
  return { refresh, showTab, state };
})();
