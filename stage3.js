/* stage3.js — Capacity calculator. Reads SITE.current() and CAP.inputs; writes the Capacity tab. */
window.CAP = (function () {
  const R = window.RULES, $ = id => document.getElementById(id);
  const fmt = (v, d = 0) => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d });

  const inputs = {
    regime: 'now', tenure: 'rental', toaOverride: null, bmr: false, social: false,
    commGF: false, ftfRes: 3.0, ftfComm: 4.0, roofAllow: 0.6, storeyCap: 6,
    egress: 'two', core: 0.18, coreTouched: false,
    balconyPct: 0.08, amenityPct: 0.04, bikeMechPct: 0.03, roofDeck: false, wallExcl: true,
    mix: [{ k: 'Studio', size: 40, share: 0.15 }, { k: '1 bed', size: 55, share: 0.35 }, { k: '2 bed', size: 80, share: 0.40 }, { k: '3 bed', size: 100, share: 0.10 }],
    parking: 'none', stalls: 0, stallArea: 30,
    costPerSf: '', revenuePerSf: ''
  };

  /** the arithmetic. Pure: site + inputs (with tenure/regime possibly overridden) → result with steps. */
  function compute(site, inp, over = {}) {
    const I = Object.assign({}, inp, over), regime = I.regime, tenure = I.tenure;
    const T = R.toaOf(site); const inToa = I.toaOverride == null ? T.toa : I.toaOverride;
    const trig = { bmrInToa: I.bmr && inToa, social: I.social };
    const fa = R.FA[regime], steps = [], warn = [], A = site.area;
    // 1 density
    const d = R.fsr(site, tenure, trig);
    if (d.fsr == null) return { fail: d.steps[0], clause: d.clause, fsr: d };
    const FAp = d.fsr * A;
    d.steps.slice(1).forEach(t => warn.push(t));
    steps.push(['Permitted floor area', `${d.fsr.toFixed(2)} × ${fmt(A)} m²`, FAp, 'm²', d.clause]);
    // 2 height → storeys
    const H = R.height(trig);
    const usable = H.m - I.roofAllow;
    let nByHeight = I.commGF ? Math.floor((usable - I.ftfComm) / I.ftfRes) + 1 : Math.floor(usable / I.ftfRes);
    const eg = R.EGRESS[I.egress];
    let N = nByHeight, storeyLimiter = `height ${H.m} m (${H.clause}) − roof allowance ${I.roofAllow} m ÷ ${I.ftfRes} m`;
    if (I.storeyCap && I.storeyCap < N) { N = I.storeyCap; storeyLimiter = 'storey cap input'; }
    if (eg.storeyCap && eg.storeyCap < N) { N = eg.storeyCap; storeyLimiter = `${eg.label} ≤ ${eg.storeyCap} storeys (VBBL 3.2.10)`; }
    const usedH = (I.commGF ? I.ftfComm + (N - 1) * I.ftfRes : N * I.ftfRes) + I.roofAllow;
    steps.push(['Storeys', `${storeyLimiter}${N < nByHeight ? ` — height alone allows ${nByHeight}` : ''}`, N, '', I.commGF ? 'ground commercial 4.0 m + residential 3.0 m (inputs)' : 'floor-to-floor input']);
    // 3 envelope: polygon-clipped from MASS when available, else rectangular reading of frontage × depth
    let mm = null; if (window.MASS && !I.noMass) { mm = window.MASS.model(site, I); if (!mm.ok) { warn.push(mm.error); mm = null; } }
    const y = R.yards(site, regime, mm ? mm.rearStoreys : N);
    const rear = mm ? mm.Env.rear : (y.rearStd ? y.rearStd.m : y.rear.m);
    const W = site.frontage - y.side1.m - y.side2.m, Dp = site.depth - y.front.m - rear;
    if (!mm && (W <= 0 || Dp <= 0)) return { fail: 'Yards consume the whole site in the rectangular reading.', fsr: d };
    const footprint = mm ? mm.footprint : W * Dp;
    if (mm) steps.push(['Envelope footprint', `polygon clipped by yards ${y.front.m} front, ${y.side1.m}/${y.side2.m} sides, ${rear} rear${mm.costs.some(c => c.key === 'recess') ? ', less entry recess' : ''}`, footprint, 'm²', `${y.front.clause}, ${y.side1.clause}, ${mm.Env.y.rearStd ? mm.Env.y.rearStd.clause + ' standard' : y.rear.clause}`]);
    else steps.push(['Envelope footprint', `(${fmt(site.frontage, 2)} − ${y.side1.m} − ${y.side2.m}) × (${fmt(site.depth, 2)} − ${y.front.m} − ${rear})`, footprint, 'm²', `${y.front.clause}, ${y.side1.clause}, ${y.side2.clause}, ${y.rearStd ? y.rearStd.clause + ' standard' : y.rear.clause} — rectangular reading`]);
    if (mm ? mm.Env.y.rearStd : y.rearStd) warn.push(`Rear yard taken at the CDDG standard ${rear} m for ${mm ? mm.rearStoreys : N} storeys at the rear (Table 1.3, guideline standard). By-law minimum is 3.1 m (§3.1.2.5).`);
    const envGross = mm ? mm.gross : footprint * N;
    steps.push(['Envelope gross', mm ? `${mm.plates.length} plates after articulation moves (${fmt(mm.startGross)} m² before)` : `${fmt(footprint)} × ${N}`, envGross, 'm²', mm ? 'Massing tab moves' : 'no upper setbacks at this stage']);
    // 4 parking
    const parkGrade = I.parking === 'grade' ? I.stalls * I.stallArea : 0;
    if (I.parking !== 'none' && !I.stalls) warn.push('Required stall count is NOT IN SOURCE (Parking By-law not extracted). Enter a count.');
    if (parkGrade > footprint) return { fail: 'At-grade parking exceeds the ground-floor footprint.', fsr: d };
    // 5 density-limited gross: solve G such that countable(G) = FAp
    const commArea = I.commGF ? footprint - parkGrade : 0;
    function excl(G, units) {
      const resGross = G - commArea - parkGrade;
      let am = I.amenityPct * resGross, st = fa.storage.pct != null ? fa.storage.pct * resGross : fa.storage.perUnit * units, bm = I.bikeMechPct * resGross;
      let amCap = null, balCap = null;
      if (fa.amenityCap != null && am > fa.amenityCap * FAp) { amCap = am; am = fa.amenityCap * FAp; }
      const pk = fa.parkingAtGradeExcluded ? parkGrade : 0;
      const wallPct = I.wallExcl ? (N <= 3 ? 0.02 : N <= 6 ? 0.01 : 0) : 0; const wall = wallPct * G;
      return { am, st, bm, pk, wall, wallPct, amCap, total: am + st + bm + pk + wall, resGross };
    }
    let G = Math.min(envGross, FAp * 1.15), units = 0, ex;
    for (let k = 0; k < 12; k++) { ex = excl(G, units); const Gd = FAp + ex.total; G = Math.min(envGross, Gd); units = unitsFor(G, ex, I, eg).units; }
    ex = excl(G, units);
    const densGross = FAp + ex.total;
    const binding = envGross <= densGross + 0.5 ? 'envelope' : 'density';
    // bring the drawn mass to the permitted floor area, or keep the excess and show it
    let mass = mm, excess = 0;
    if (mm && binding === 'density') {
      const fitMode = (I.fitMode || window.MASS.fit.mode);
      if (fitMode === 'none') { G = envGross; ex = excl(G, unitsFor(G, excl(G, units), I, eg).units); excess = (G - ex.total) - FAp; }
      else {
        const capV = fa.balconyCap != null ? fa.balconyCap * FAp : null; const balArea0 = mm.balcony ? mm.balcony.area : I.balconyPct * ex.resGross;
        const exc0 = capV != null && balArea0 > capV ? balArea0 - capV : 0;
        mass = window.MASS.trim(mm, densGross - exc0, fitMode); if (mass.fit) { G = mass.gross; ex = excl(G, units); } steps.push(['Fit to permitted floor area', mass.fit ? (mass.fit.mode === 'depth' ? `rear face pulled forward to ${fmt(mass.fit.depthDrawn, 1)} m depth${mass.fit.dropped ? `, ${mass.fit.dropped} storey(s) dropped` : ''}` : `${mass.fit.dropped} storey(s) dropped${mass.fit.partialTop ? ', partial top plate' : ''}`) : 'no trim needed', mass.gross, 'm²', 'drawn mass = permitted + exclusions']); }
    }
    const drawnBal = mass && mass.balcony ? mass.balcony : null;
    const bal = drawnBal ? drawnBal.area : I.balconyPct * ex.resGross, balCapV = fa.balconyCap != null ? fa.balconyCap * FAp : null;
    const balExcess = balCapV != null && bal > balCapV ? bal - balCapV : 0;
    if (balExcess) warn.push(`Balconies ${fmt(bal)} m² exceed the 12% exclusion cap ${fmt(balCapV)} m² (${fa.balconyClause}); ${fmt(balExcess)} m² counts as floor area.`);
    if (drawnBal) {
      const mvB = window.MASS.moves.balcony;
      steps.push(['Balconies (drawn)', `${drawnBal.pads.length} pads × ${mvB.d} m deep, ${mvB.type === 'project' ? 'projecting into the yard' : 'recessed'}`, bal, 'm²', `excluded — ${fa.balconyClause}${balCapV != null ? `; cap ${fmt(balCapV)} m²` : ''}; ZDB §10.8.1(c) projection ≤ 1.8 m, ≥ 2.1 m from interior side lines`]);
      if (mvB.type === 'project' && mvB.d > 1.8) warn.push(`Balcony projection ${mvB.d} m exceeds the 1.8 m permitted into a required yard (ZDB §10.8.1(c)(i)).`);
    }
    const countable = G - ex.total + balExcess, fsrUsed = countable / A;
    if (excess > 0.5) warn.push(`Drawn mass exceeds the permitted floor area by ${fmt(excess)} m² (FSR ${fsrUsed.toFixed(2)} against ${d.fsr.toFixed(2)}). Choose a fit mode in the Massing tab to trim it.`);
    steps.push(['Exclusions the by-law allows (site estimate only)', `amenity ${fmt(ex.am)} + storage ${fmt(ex.st)} + bike/mech ${fmt(ex.bm)}${ex.pk ? ' + at-grade parking ' + fmt(ex.pk) : ''}${ex.wall ? ` + exterior walls ${fmt(ex.wall)} (${Math.round(ex.wallPct * 100)}%)` : ''}`, ex.total, 'm²', `${fa.amenityClause}; ${fa.storage.clause}; ${fa.parkingClause}${ex.wall ? '; ZDB §10.15.1 wall-thickness exclusion (insulation ≥ ' + (N <= 3 ? '175' : '100') + ' mm)' : ''}`]);
    if (ex.amCap) warn.push(`Amenity input ${fmt(ex.amCap)} m² exceeds the 10% cap (${fa.amenityClause}); ${fmt(ex.am)} m² excluded, remainder counts.`);
    if (I.parking === 'grade' && !fa.parkingAtGradeExcluded) warn.push(`At-grade parking ${fmt(parkGrade)} m² counts toward FSR under the current regime (${fa.parkingClause}). From 27 Oct it is excluded.`);
    steps.push(['Gross buildable, if every exclusion is claimed', binding === 'envelope' ? 'envelope gross (binds)' : 'permitted + exclusions (density binds)', G, 'm²', binding === 'envelope' ? `envelope < ${fmt(densGross)} m² density gross` : `${fmt(FAp)} + ${fmt(ex.total)}`]);
    steps.push(['Countable floor area', `${fmt(G)} − ${fmt(ex.total)}`, countable, 'm²', `FSR used ${fsrUsed.toFixed(2)} of ${d.fsr.toFixed(2)}`]);
    // balconies: outside gross, excluded, capped under 'now'
    // 6 units
    const u = unitsFor(G, ex, I, eg);
    steps.push(['Net saleable (residential)', `(${fmt(ex.resGross)} − ${fmt(ex.am)} − ${fmt(ex.bm)}) × (1 − ${(I.core * 100).toFixed(0)}%)`, u.net, 'm²', `core + corridor ${(I.core * 100).toFixed(0)}% — ${I.coreTouched ? 'your input' : 'TIP default for ' + eg.label}`]);
    steps.push(['Units', u.capped ? `min(${u.raw}, ${eg.unitCap})` : `${fmt(u.net)} ÷ ${fmt(u.avg0, 1)} m² average`, u.units, '', u.capped ? 'VBBL draft §3.2.10.1.(1)(c) 30-unit cap — NOT IN SOURCE as enacted' : 'unit mix inputs']);
    if (u.capped) warn.push(`One-exit 30-unit cap binds: floor area supports ${u.raw} units. Efficiency buys larger units inside the same count — average ${fmt(u.avg, 1)} m² instead of ${fmt(u.avg0, 1)} m².`);
    const resStoreys = I.commGF ? N - 1 : N;
    const perFloor = u.units / resStoreys;
    // mix check
    const mixReq = fa.mix(site.zone, tenure);
    const two = I.mix.filter(m => /2|3/.test(m.k)).reduce((s, m) => s + m.share, 0), three = I.mix.filter(m => /3/.test(m.k)).reduce((s, m) => s + m.share, 0);
    const mixOK = two >= mixReq.two - 1e-9 && three >= mixReq.three - 1e-9;
    if (!mixOK) warn.push(`Unit mix fails ${mixReq.clause}: needs ≥ ${mixReq.two * 100}% two-or-more-bed${mixReq.three ? ` incl. ≥ ${mixReq.three * 100}% three-bed` : ''}; you have ${Math.round(two * 100)}% / ${Math.round(three * 100)}%.`);
    if (drawnBal && u.units) { const perUnit = bal / u.units; steps.push(['Balcony area per unit', `${fmt(bal)} ÷ ${u.units}`, perUnit, 'm²', `CDDG S2.14.1 standard ≥ 4.5 m² and ≥ 1.8 m deep${perUnit < 4.5 || window.MASS.moves.balcony.d < 1.8 ? ' — NOT MET' : ''}`]); if (perUnit < 4.5 || window.MASS.moves.balcony.d < 1.8) warn.push(`Private outdoor space below the CDDG S2.14.1 standard (${fmt(perUnit, 1)} m² per unit at ${window.MASS.moves.balcony.d} m deep; standard 4.5 m² and 1.8 m). Guideline standard, not by-law.`); }
    if (fa.storageMin) steps.push(['Storage minimum', `${u.units} × ${fa.storageMin.m2} m²`, u.units * fa.storageMin.m2, 'm²', fa.storageMin.clause]);
    // binding by name
    let binds = excess > 0.5 ? 'density (exceeded)' : binding;
    if (u.capped || (eg.storeyCap && eg.storeyCap < nByHeight && binding === 'envelope')) binds = 'egress';
    return { fail: null, mass, excess, toa: T, inToa, fsr: d, FAp, H, N, nByHeight, usedH, storeyLimiter, y, rear, W, Dp, footprint, envGross, densGross, G, countable, fsrUsed, ex, bal, balCapV, units: u, perFloor, resStoreys, binding: binds, steps, warn, mixReq, mixOK, two, three, eg, fa, commArea, parkGrade, tenure, regime };
  }
  function unitsFor(G, ex, I, eg) {
    const net = Math.max(0, (ex.resGross - ex.am - ex.bm) * (1 - I.core));
    const avg0 = I.mix.reduce((s, m) => s + m.share * m.size, 0);
    const raw = Math.floor(net / avg0);
    const capped = eg.unitCap != null && raw > eg.unitCap;
    const units = capped ? eg.unitCap : raw;
    return { net, avg0, raw, units, capped, avg: units ? net / units : 0 };
  }

  // ---------- render ----------
  function gauge(id, val, max, label, redPast = true) {
    const el = $(id); const pct = max ? Math.min(100, 100 * val / max) : 0;
    el.querySelector('.gfill').style.transform = `scaleX(${pct / 100})`;
    el.classList.toggle('over', redPast && val > max + 1e-6);
    el.querySelector('.g-val').textContent = label;
  }
  function render() {
    const site = window.SITE.current();
    const body = $('cap-body'), empty = $('cap-empty');
    if (!site || window.SITE.verdictFor(site)[0] === 'fail') { body.hidden = true; empty.hidden = false; return; }
    body.hidden = false; empty.hidden = true;
    if (!inputs.coreTouched) inputs.core = R.EGRESS[inputs.egress].core;
    syncInputs(site);
    const r = compute(site, inputs);
    if (r.fail) { $('cap-conclusion').className = 'callout fail'; $('cap-conclusion').textContent = r.fail + (r.clause ? ` (${r.clause})` : ''); $('cap-gauges').hidden = true; $('cap-steps').innerHTML = ''; $('cap-tenure').innerHTML = ''; $('cap-regime').innerHTML = ''; $('cap-warn').innerHTML = ''; return; }
    $('cap-gauges').hidden = false;
    gauge('g-fsr', r.fsrUsed, r.fsr.fsr, `${r.fsrUsed.toFixed(2)} of ${r.fsr.fsr.toFixed(2)} FSR`);
    gauge('g-height', r.usedH, r.H.m, `${r.usedH.toFixed(1)} of ${r.H.m} m · ${r.N} storeys`);
    gauge('g-units', r.units.units, r.eg.unitCap || Math.max(r.units.raw, 1), r.eg.unitCap ? `≈ ${r.units.units} of ${r.eg.unitCap} units (one-exit cap) · estimate` : `≈ ${r.units.units} units estimated from floor area · the plan counts the real number`, !!r.eg.unitCap);
    const c = $('cap-conclusion');
    const bindText = { 'density (exceeded)': 'Drawn mass exceeds the permitted density — the FSR gauge is over the limit; choose a fit mode in the Massing tab', envelope: 'Envelope binds — the yards and height limit you before the density does', density: 'Density binds — FSR runs out before the envelope is full', egress: 'Egress binds — the one-exit typology caps units or storeys below what the site allows' }[r.binding];
    c.className = 'callout ' + (r.binding === 'density' ? 'pass' : r.excess > 0.5 ? 'fail' : 'warn');
    c.innerHTML = `${bindText}<span class="sub">${fmt(r.G)} m² gross · ${fmt(r.countable)} m² countable · ${r.units.units} units at ${fmt(r.units.avg, 0)} m² average · ${r.N} storeys</span>`;
    $('cap-steps').innerHTML = r.steps.map(s => `<tr><td>${s[0]}</td><td class="calc">${s[1]}</td><td class="num">${fmt(s[2], s[3] === '' ? 0 : 0)} ${s[3]}</td><td class="clause">${s[4]}</td></tr>`).join('');
    $('cap-warn').innerHTML = (r.toa && r.toa.edge && r.inToa ? `<li>Site straddles the ${r.toa.R} m transit-oriented-area line (${fmt(r.toa.d, 0)} m nearest point, ${fmt(r.toa.dc, 0)} m centroid). Confirm against By-law 14090.</li>` : '') + r.warn.map(w => `<li>${w}</li>`).join('') + `<li class="muted">${r.fa.light}</li>` + (site.kind !== 'parcel' ? '<li class="muted">Combined site — figures assume consolidation.</li>' : '') + (r.inToa ? `<li class="muted">Transit-oriented area derived as within ${r.toa.R} m of ${r.toa.station}; the enacted By-law 14090 polygon is NOT IN SOURCE and follows parcel lines, not a circle.</li>` : '');
    // tenure side by side
    const other = inputs.tenure === 'rental' ? 'other' : 'rental';
    const r2 = compute(site, inputs, { tenure: other });
    const tenLabel = t => t === 'rental' ? '100% rental' : 'strata / other';
    if (site.zone === 'R3-2') $('cap-tenure').innerHTML = `<p class="muted">R3-2: rental tenure is mandatory (§3.1.1.4(a)); there is no strata column.</p>`;
    else $('cap-tenure').innerHTML = cmpTable([tenLabel(inputs.tenure), tenLabel(other)], r, r2, site.zone === 'R3-3' ? 'R3-3 uses one FSR table for all tenures (§3.1.1.5(b)); only the 3.00 bonus requires rental.' : 'R3-1: rental and non-rental read different tables (§3.1.1.2 vs §3.1.1.3).');
    // regime delta
    const r3 = compute(site, inputs, { regime: inputs.regime === 'oct' ? 'now' : 'oct' });
    $('cap-regime').innerHTML = cmpTable([inputs.regime === 'oct' ? 'From 27 Oct' : 'Current', inputs.regime === 'oct' ? 'Current' : 'From 27 Oct'], r, r3, 'Envelope, FSR and height are identical in both regimes; the difference is what counts, the unit mix and the CDDG rear-yard standard.');
  }
  function cmpTable(labels, a, b, note) {
    const row = (k, f, d = 0) => `<tr><td>${k}</td><td class="num">${a.fail ? '—' : fmt(f(a), d)}</td><td class="num">${b.fail ? '—' : fmt(f(b), d)}</td></tr>`;
    return `<table class="cmp"><thead><tr><th></th><th>${labels[0]}</th><th>${labels[1]}</th></tr></thead><tbody>
      ${row('Permitted FSR', x => x.fsr.fsr, 2)}${row('Gross m²', x => x.G)}${row('Countable m²', x => x.countable)}${row('Units', x => x.units.units)}${row('Avg unit m²', x => x.units.avg)}${row('Storeys', x => x.N)}
      <tr><td>Binds</td><td>${a.fail ? a.fail : a.binding}</td><td>${b.fail ? b.fail : b.binding}</td></tr></tbody></table><p class="muted">${note}</p>`;
  }

  // ---------- inputs ----------
  function syncInputs(site) {
    $('i-regime').value = inputs.regime; $('i-tenure').value = inputs.tenure; const T = site ? R.toaOf(site) : null;
    if (T) {
      const eff = inputs.toaOverride == null ? T.toa : inputs.toaOverride;
      $('i-toa').value = inputs.toaOverride == null ? 'auto' : inputs.toaOverride ? 'yes' : 'no';
      $('i-toa-state').textContent = eff ? `In a transit-oriented area${T.tier ? ` — Tier ${T.tier}` : ''}` : 'Not in a transit-oriented area';
      $('i-toa-state').className = 'toa-state ' + (eff ? 'yes' : 'no');
      $('i-toa-why').textContent = `${fmt(T.d, 0)} m from ${T.station} (nearest point of the site; ${fmt(T.dc, 0)} m from the centroid). Radius ${T.R} m.` + (T.edge ? ' The site straddles the 800 m line — confirm against the by-law map.' : '') + (inputs.toaOverride != null ? ' Overridden by you.' : '');
    } $('i-bmr').checked = inputs.bmr; $('i-social').checked = inputs.social;
    $('i-comm').checked = inputs.commGF; $('i-ftfres').value = inputs.ftfRes; $('i-ftfcomm').value = inputs.ftfComm; $('i-roof').value = inputs.roofAllow; $('i-cap').value = inputs.storeyCap;
    $('i-egress').value = inputs.egress; $('i-core').value = Math.round(inputs.core * 100); $('i-bal').value = Math.round(inputs.balconyPct * 100); $('i-wall').checked = inputs.wallExcl; $('i-bal').disabled = !!(window.MASS && window.MASS.moves.balcony.on); $('i-bal-note').textContent = window.MASS && window.MASS.moves.balcony.on ? 'Using the balconies drawn in the Massing tab.' : 'Allowance used until balconies are drawn in the Massing tab.'; $('i-am').value = Math.round(inputs.amenityPct * 100); $('i-bm').value = Math.round(inputs.bikeMechPct * 100);
    $('i-park').value = inputs.parking; $('i-stalls').value = inputs.stalls || ''; $('i-stallarea').value = inputs.stallArea;
    $('i-egress-note').textContent = R.EGRESS[inputs.egress].note;
    const mt = $('i-mix'); if (!mt.children.length) mt.innerHTML = inputs.mix.map((m, k) => `<tr><td>${m.k}</td><td><input type="number" data-k="${k}" data-f="size" step="1" value="${m.size}"> m²</td><td><input type="number" data-k="${k}" data-f="share" step="1" value="${Math.round(m.share * 100)}"> %</td></tr>`).join('');
    const sum = inputs.mix.reduce((s, m) => s + m.share, 0); $('i-mix-sum').textContent = `shares sum to ${Math.round(sum * 100)}%` + (Math.abs(sum - 1) > 0.005 ? ' — must be 100%' : '');
    $('i-mix-sum').className = Math.abs(sum - 1) > 0.005 ? 'fail-text' : 'muted';
  }
  function bind() {
    const on = (id, f) => $(id).addEventListener('change', e => { f(e.target); if(window.APP) window.APP.refresh(); else render(); });
    on('i-regime', t => inputs.regime = t.value); on('i-tenure', t => inputs.tenure = t.value); on('i-toa', t => inputs.toaOverride = t.value === 'auto' ? null : t.value === 'yes'); on('i-bmr', t => inputs.bmr = t.checked); on('i-social', t => inputs.social = t.checked);
    on('i-comm', t => inputs.commGF = t.checked); on('i-ftfres', t => inputs.ftfRes = +t.value); on('i-ftfcomm', t => inputs.ftfComm = +t.value); on('i-roof', t => inputs.roofAllow = +t.value); on('i-cap', t => inputs.storeyCap = +t.value || 0);
    on('i-egress', t => { inputs.egress = t.value; inputs.coreTouched = false; }); on('i-core', t => { inputs.core = +t.value / 100; inputs.coreTouched = true; });
    on('i-bal', t => inputs.balconyPct = +t.value / 100); on('i-wall', t => inputs.wallExcl = t.checked); on('i-am', t => inputs.amenityPct = +t.value / 100); on('i-bm', t => inputs.bikeMechPct = +t.value / 100);
    on('i-park', t => inputs.parking = t.value); on('i-stalls', t => inputs.stalls = +t.value || 0); on('i-stallarea', t => inputs.stallArea = +t.value || 30);
    $('i-mix').addEventListener('change', e => { const t = e.target; const m = inputs.mix[+t.dataset.k]; if (t.dataset.f === 'size') m.size = +t.value; else m.share = +t.value / 100; if(window.APP) window.APP.refresh(); else render(); });
    document.addEventListener('site:change', render);
  }
  return { inputs, compute, render, bind };
})();
