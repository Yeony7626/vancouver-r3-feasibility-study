/* site.js — site state and the Site tab. Downstream stages read SITE.current(). */
window.SITE = (function () {
  const P = window.R3_PARCELS, A = window.R3_ASSEMBLIES, MIN_AREA = 460; // R3 §3.1.2.1
  // index assemblies by parcel
  const byParcel = new Map();
  A.forEach((c, k) => c.ids.forEach(i => { if (!byParcel.has(i)) byParcel.set(i, []); byParcel.get(i).push(k); }));
  // fast lookup of a manual set
  const byKey = new Map(); A.forEach((c, k) => byKey.set(c.ids.join(','), k));

  const state = { parcelIdx: null, set: [], comboIdx: null, over: {} };
  const $ = id => document.getElementById(id);
  const SHAPE = /shape can.t be massed/; // ENV.envelope's error for a lot its yard clipping can't handle
  const fmt = (v, d = 1) => v == null ? '—' : Number(v).toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d });

  const WHY = {
    area: 'Planar area of the parcel polygon in EPSG:26910 (metres). Assessment-based City parcel, not a legal survey. For a combined site, the area of the unioned polygon.',
    frontage: 'Frontage is the length of the street side of the polygon. On a corner it is the shortest street boundary (ZDB §10.26.1(b)). Street versus lane is decided by measuring the gap to the facing parcel across the right-of-way: 10.1 m or more is a street, less is a lane (ZDB §2). A curved frontage is the chained length of its consecutive street segments. Corner truncations under 6 m are ignored.',
    depth: 'Depth is the extent of the polygon measured perpendicular to the frontage edge — the full envelope depth the site can take, not the average.'
  };

  function current() {
    if (state.comboIdx != null) {
      const c = A[state.comboIdx];
      return Object.assign(comboSite(c), applyOverrides(c));
    }
    if (state.set.length > 1) return manualSite();
    if (state.parcelIdx == null) return null;
    const p = P[state.parcelIdx];
    return Object.assign({ kind: 'parcel', ids: [state.parcelIdx] }, p, applyOverrides(p));
  }
  // one tax lot is often several parcels with one address: name each address once and count the parcels
  function addrOf(ids) { const u = [...new Set(ids.map(i => P[i].addr))]; return u.join(' + ') + (u.length < ids.length ? ` (${ids.length} parcels)` : ''); }
  const comboSite = c => Object.assign({ kind: 'combined', ids: c.ids, addr: addrOf(c.ids), zone: P[c.ids[0]].zone }, c);
  function applyOverrides(base) {
    const o = {};
    if (state.over.frontage != null) o.frontage = state.over.frontage;
    if (state.over.depth != null) o.depth = state.over.depth;
    return o;
  }
  function manualSite() {
    const ids = state.set.slice().sort((a, b) => a - b);
    const k = byKey.get(ids.join(','));
    if (k != null) { state.comboIdx = k; return current(); }
    // not precomputed: sum area, no derived frontage/depth
    const area = ids.reduce((s, i) => s + P[i].area, 0);
    const reachesStreet = ids.some(i => P[i].frontage != null);
    const sameZone = ids.every(i => P[i].zone === P[ids[0]].zone);
    return { kind: 'manual', ids, addr: addrOf(ids), zone: P[ids[0]].zone, area, frontage: state.over.frontage ?? null, depth: state.over.depth ?? null, corner: null, lane: ids.some(i => P[i].lane), orient: null, fill: null, flags: [reachesStreet ? null : 'no_street_frontage', sameZone ? null : 'mixed_subdistrict', 'not_derived'].filter(Boolean), utm: null, ll: null, sides: [] };
  }

  function select(idx, add) {
    state.over = {};
    if (add && state.parcelIdx != null) {
      if (state.comboIdx != null) { state.set = A[state.comboIdx].ids.slice(); state.comboIdx = null; }
      if (!state.set.length) state.set = [state.parcelIdx];
      const at = state.set.indexOf(idx);
      if (at >= 0) state.set.splice(at, 1); else state.set.push(idx);
      if (state.set.length === 1) { state.parcelIdx = state.set[0]; state.set = []; }
    } else { state.parcelIdx = idx; state.set = []; state.comboIdx = null; }
    render();
  }
  function selectCombo(k) { state.over = {}; state.comboIdx = k; state.set = []; render(); }
  function clearCombo() { state.over = {}; state.comboIdx = null; state.set = []; render(); }
  function setOverride(field, v) { if (v === '' || isNaN(v)) delete state.over[field]; else state.over[field] = Number(v); render(false); }

  const FLAG_TEXT = {
    irregular: ['Irregular lot: fills under 85% of its bounding rectangle. Frontage and depth are best estimates — override them.', 'warn'],
    double_fronting: ['Two street frontages that don\'t meet at a corner (through lot). Frontage taken as the shorter.', 'warn'],
    frontage_on_open_edge: ['No facing parcel within 80 m on the front side (park, water or unknown). Treated as a street; confirm.', 'warn'],
    borderline_street_width: ['A right-of-way here measures 9.5–10.1 m. Classified as a lane by the 10.1 m rule; may actually be a narrow street — override frontage if so.', 'warn'],
    no_street_frontage: ['Does not reach a street. Cannot be a development site on its own.', 'fail'],
    multipolygon: ['Parcel is recorded as more than one polygon; the largest is used.', 'warn'],
    mixed_subdistrict: ['Constituents are in different R3 sub-districts. The tool does not resolve which schedule governs a split site.', 'fail'],
    street_stub_ignored: ['A street side under 6 m (a strip or notch) was ignored when choosing the frontage.', 'warn'],
    not_derived: ['This combination was not precomputed. Area is the sum of parts; frontage and depth are not derived — enter them.', 'warn']
  };

  function verdictFor(s) {
    if (!s) return null;
    if (s.flags.includes('no_street_frontage')) return ['fail', 'Cannot build: no street frontage', ''];
    if (s.flags.includes('mixed_subdistrict')) return ['fail', 'Cannot assess: mixed sub-districts', ''];
    if (s.area < MIN_AREA) return ['fail', `Below minimum site area by ${fmt(MIN_AREA - s.area, 0)} m²`, `R3 §3.1.2.1 requires 460 m². This site is ${fmt(s.area, 0)} m².`];
    const tier = s.area >= 1470 ? 1470 : s.area >= 920 ? 920 : s.area >= 613 ? 613 : 460;
    return ['pass', `Meets the 460 m² minimum site area`, `${fmt(s.area, 0)} m² against 460 m² (R3 §3.1.2.1). Separately, the FSR table (§3.1.1) puts this site in its ${tier} m²+ column.`];
  }

  function render(fit = true) {
    const s = current();
    const V = $('verdict'), vf = $('v-flag');
    if (!s) {
      V.classList.add('empty'); $('v-addr').textContent = 'No site selected'; $('v-zone').textContent = ''; $('v-zone').className = 'zone';
      ['f-area', 'f-front', 'f-depth'].forEach(id => $(id).textContent = '—'); vf.textContent = ''; vf.className = 'v-flag';
      $('site-empty').hidden = false; $('site-body').hidden = true;
      document.dispatchEvent(new CustomEvent('site:change', { detail: null })); return;
    }
    V.classList.remove('empty');
    $('v-addr').textContent = s.addr; $('v-zone').textContent = s.zone; $('v-zone').className = 'zone ' + s.zone;
    $('f-area').textContent = fmt(s.area, 0); $('f-front').textContent = fmt(s.frontage, 2); $('f-depth').textContent = fmt(s.depth, 2);
    const v = verdictFor(s);
    vf.className = 'v-flag ' + v[0]; vf.textContent = v[0] === 'fail' ? 'Stop: ' + v[1] : v[1];

    $('site-empty').hidden = true; $('site-body').hidden = false;
    $('s-addr').textContent = s.addr;
    $('s-kind').innerHTML = (s.kind === 'parcel' ? `Single parcel, ${s.zone}` : `Combined site of ${s.ids.length} parcels, ${s.zone}. Not a legal site until consolidated`) + (s.corner ? ' <span class="s-corner-tag">Corner site</span>' : '');
    const cv = $('s-verdict'); cv.className = 'callout ' + v[0]; cv.innerHTML = `${v[1]}${v[2] ? `<span class="sub">${v[2]}</span>` : ''}`; cv.title = v[0] === 'pass' ? (v[2] || '') : ''; // a pass repeats the top-bar badge: one line here, the clause in the tooltip
    // Permitted density up front, so a lower-density site is not planned at a height that leaves thin floors.
    const RF = window.REFERENCE, I = window.CAP && window.CAP.inputs, ref = v[0] !== 'fail' && RF && I ? RF.compute(s, I) : null, rc = ref && !ref.fail && RF.recommend ? RF.recommend(s, I) : null;
    // the next step, as every later phase has one: open while the site meets the minimum and the massing can be drawn, otherwise say why not
    { const go = $('s-next'), shape = !!(ref && ref.fail && SHAPE.test(ref.fail)), blocked = v[0] === 'fail' || shape; go.disabled = blocked;
      go.title = $('s-next-note').textContent = !blocked ? '' : v[0] === 'fail' ? 'Resolve the site above to continue.' : s.kind === 'parcel' ? "This lot's shape can't be massed by the tool. Pick a combination below or another lot." : "This combined site's shape can't be massed by the tool. Pick another combination or a single lot."; }
    const fh = $('s-fsr'), T0 = window.RULES.toaOf(s);
    fh.hidden = !(ref && !ref.fail && ref.fsr && ref.fsr.fsr != null);
    if (!fh.hidden) fh.innerHTML = `<div class="fsr-main"><span class="fsr-label">Permitted FSR</span><b class="fsr-num">${fmt(ref.fsr.fsr, 2)}</b><span class="fsr-sub">${fmt(ref.FAp, 0)} m² of floor area · ${I.tenure === 'rental' ? 'rental' : 'strata'} · ${T0.toa ? 'in a transit-oriented area' : 'outside a transit-oriented area'}</span></div>`
      + (rc ? `<div class="fsr-rec" role="note"><span class="fsr-label">Recommended massing</span><b>${rc.n} storeys</b><span class="fsr-sub">about ${fmt(rc.plate, 0)} m² per floor, instead of ${fmt(rc.topPlate, 0)} m² at ${rc.top}</span><p>${RF.advice(rc).replace(/ [0-9]+ storeys gives.*$/, '')}</p></div>` : '');

    window.UI_MOTION?.site(fh, (s.ids || [s.i]).join('+') + ':' + (ref?.fsr?.fsr ?? ''));
    $('s-area').textContent = fmt(s.area, 1);
    const fi = $('s-front'), di = $('s-depth');
    fi.value = s.frontage ?? ''; di.value = s.depth ?? '';
    fi.classList.toggle('over', state.over.frontage != null); di.classList.toggle('over', state.over.depth != null);
    $('s-front-src').textContent = state.over.frontage != null ? 'overridden' : ''; $('s-depth-src').textContent = state.over.depth != null ? 'overridden' : '';
    $('s-corner').textContent = s.corner == null ? 'not derived' : s.corner ? 'Corner site: frontage is the shorter street side' : 'Mid-block';
    $('s-lane').textContent = s.lane ? 'Lane adjacent' : 'No lane';
    const T = window.RULES.toaOf(s);
    $('s-toa').innerHTML = T.unknown ? '<span class="muted">not derived</span>' : T.toa ? `<b>In a transit-oriented area</b>${T.tier ? ` · Tier ${T.tier}` : ''} <span class="muted">· ${fmt(T.d, 0)} m from ${T.station}</span>${T.edge ? ' <span class="src">straddles the line</span>' : ''}` : `Not in a transit-oriented area <span class="muted">· ${fmt(T.d, 0)} m from ${T.station}, radius ${T.R} m</span>`;
    $('s-orient').innerHTML = s.orient == null ? '—' : `<span class="num">${fmt(s.orient, 0)}°</span> frontage bearing (0 = north–south street)`;
    $('s-shape').textContent = s.fill == null ? '—' : `${Math.round(s.fill * 100)}% of bounding rectangle`;

    $('s-flags').innerHTML = s.flags.map(f => { const t = FLAG_TEXT[f] || [f, 'warn']; return `<span class="flag ${t[1]}" title="${t[0]}">${f.replace(/_/g, ' ')}</span>`; }).join('') +
      s.flags.map(f => { const t = FLAG_TEXT[f]; return t ? `<p class="muted" style="margin:4px 0 0;flex-basis:100%">${t[0]}</p>` : ''; }).join('');

    $('s-edges').innerHTML = (s.sides || []).map(e => `<tr><td><span class="cls ${e.cls}">${e.cls}</span></td><td class="num">${fmt(e.len, 2)}</td><td class="num">${e.gap == null ? (e.cls === 'interior' ? '0' : e.cls === 'open' ? '> 80' : '') : fmt(e.gap, 2)}</td></tr>`).join('');
    if (!s.sides || !s.sides.length) $('s-edges').innerHTML = '<tr><td colspan="3" class="muted">Not derived for this combination.</td></tr>';

    // assembly offers
    const anchor = state.parcelIdx;
    const list = $('asm-list'), note = $('asm-note');
    // offers: combinations that contain every parcel currently selected
    const cands = (byParcel.get(anchor) || []).filter(k => k !== state.comboIdx && s.ids.every(i => A[k].ids.includes(i))).sort((x, y) => A[x].ids.length - A[y].ids.length || A[x].area - A[y].area);
    if (!cands.length) { note.textContent = s.area < MIN_AREA ? 'No combination of up to four adjacent same-district parcels reaches 460 m² and a street.' : s.ids.length >= 4 ? 'Combinations beyond four parcels are not precomputed; shift-click to add more (area sums, frontage and depth must be entered).' : 'No larger precomputed combinations.'; }
    else note.textContent = (s.area < MIN_AREA ? `Short by ${fmt(MIN_AREA - s.area, 0)} m². ` : '') + `${cands.length} larger combinations reach 460 m² and a street (same sub-district, up to four parcels).`;
    // each offer says what it buys: permitted FSR and the Capacity calculator's home estimate (each compute is well under 1 ms);
    // a shape the massing can't draw (the same check that stops Continue) is said in plain words
    const have = new Set(s.ids.map(i => P[i].addr));
    list.innerHTML = cands.slice(0, 24).map(k => { const c = A[k], cs = comboSite(c), add = new Map();
      c.ids.filter(i => !s.ids.includes(i)).forEach(i => add.set(P[i].addr, (add.get(P[i].addr) || 0) + 1));
      const who = [...add].map(([a, n]) => have.has(a) ? `${a} (${n} more parcel${n > 1 ? 's' : ''})` : n > 1 ? `${a} (${n} parcels)` : a).join(', ');
      const rf = RF && I ? RF.compute(cs, I) : null, bad = !!(rf && rf.fail && SHAPE.test(rf.fail)), cp = window.CAP && I ? window.CAP.compute(cs, I) : null;
      const buy = [rf && rf.fsr && rf.fsr.fsr != null ? `FSR ${fmt(rf.fsr.fsr, 2)}` : '', !bad && cp && !cp.fail && cp.units ? `≈ ${cp.units.units} homes` : ''].filter(Boolean).join(' · ');
      return `<li data-k="${k}"${bad ? ' class="asm-bad"' : ''}><span>${c.ids.length} parcels${c.corner ? ', corner' : ''}</span><span class="n">${fmt(c.area, 0)} m² <small>· ${fmt(c.frontage, 1)} × ${fmt(c.depth, 1)} m</small></span>${buy ? `<span class="asm-buy">${buy}</span>` : ''}<span class="who">+ ${who}</span>${bad ? '<span class="asm-why">Irregular shape: the tool can\'t draw a massing for this combination</span>' : ''}</li>`; }).join('');
    list.querySelectorAll('li').forEach(li => li.onclick = () => selectCombo(+li.dataset.k));
    // Low density here (permitted FSR under 2.0): point at the assemblies, which is where a higher FSR usually is
    { const here = ref && !ref.fail && ref.fsr ? ref.fsr.fsr : null, best = here != null && here < 2 && RF && I ? cands.slice(0, 24).reduce((m, k) => { const rf = RF.compute(comboSite(A[k]), I); return rf && !rf.fail && rf.fsr && rf.fsr.fsr > (m?.fsr || here) + 1e-6 ? { k, fsr: rf.fsr.fsr } : m; }, null) : null;
      $('assembly').classList.toggle('asm-suggest', !!best);
      $('asm-hint').hidden = !best; if (best) $('asm-hint').innerHTML = `<b>Combine lots for more density.</b> This lot allows FSR ${fmt(here, 2)}. A combination below reaches FSR ${fmt(best.fsr, 2)}.`;
      list.querySelector(`li[data-k="${best?.k}"]`)?.classList.add('asm-best');
      // and from the FSR card at the top, where the low number is read, a link down to them
      if (best && !fh.hidden) { const b = document.createElement('button'); b.type = 'button'; b.className = 'fsr-combine'; b.textContent = `Combining lots can reach FSR ${fmt(best.fsr, 2)} ↓`; b.onclick = () => $('assembly').scrollIntoView({ behavior: 'smooth', block: 'start' }); fh.appendChild(b); } }

    const comb = $('combined'); comb.hidden = s.kind === 'parcel';
    $('c-parts').innerHTML = s.ids.map(i => `<li>${P[i].addr} · ${fmt(P[i].area, 0)} m², ${P[i].zone}</li>`).join('');

    document.dispatchEvent(new CustomEvent('site:change', { detail: { site: s, fit } }));
  }

  function init() {
    $('count-r3').textContent = P.length.toLocaleString('en-CA');
    $('why-text').textContent = window.R3_META.method;
    $('prov-text').textContent = `${window.R3_META.source_parcels}\n${window.R3_META.source_zoning}\nProcessed ${window.R3_META.processed}: ${window.R3_META.parcels_total.toLocaleString('en-CA')} parcels citywide, ${P.length.toLocaleString('en-CA')} in R3-1/2/3 by point-in-polygon of a representative point. Parcels are assessment polygons, not legal surveys. TOA designation (By-law 14090) is not in this data.`;
    document.querySelectorAll('.why').forEach(b => b.onclick = () => { const d = $('why-box'); d.open = true; $('why-text').textContent = WHY[b.dataset.why] + '\n\n' + window.R3_META.method; d.scrollIntoView({ block: 'nearest' }); });
    $('s-front').onchange = e => setOverride('frontage', e.target.value);
    $('s-depth').onchange = e => setOverride('depth', e.target.value);
    $('c-clear').onclick = clearCombo;
  }
  return { init, select, selectCombo, clearCombo, current, state, P, A, MIN_AREA, verdictFor };
})();
