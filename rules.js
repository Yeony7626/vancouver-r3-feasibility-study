/* rules.js — R3 Districts Schedule (consolidated July 2026) and RTS 18516 amendments (effective 2026-10-27), as data.
   Every number carries a clause. Anything not in an enacted or Council-approved source is marked NOT IN SOURCE. */
window.RULES = (function () {
  const TIERS = [1470, 920, 613, 460];                                   // §3.1.1 table columns
  const TABLE_RENTAL = { shallow: [2.70, 2.70, 2.40, 1.60], wideCorner: [2.70, 2.40, 2.20, 1.60], other: [2.40, 2.40, 2.20, 1.60] };
  const TABLE_R31_OTHER = { shallow: [2.00, 2.00, 2.00, 1.60], wideCorner: [2.00, 1.75, 1.75, 1.60], other: [1.75, 1.75, 1.75, 1.60] };
  const CLAUSE = { 'R3-1': { rental: '§3.1.1.2(a)', other: '§3.1.1.3', b300: '§3.1.1.2(b)', b270: '§3.1.1.2(c)' }, 'R3-2': { rental: '§3.1.1.4(b)', b300: '§3.1.1.4(c)', b270: '§3.1.1.4(d)' }, 'R3-3': { rental: '§3.1.1.5(b)', other: '§3.1.1.5(b)', b300: '§3.1.1.5(c)', b270: '§3.1.1.5(d)' } };
  const GEO_LABEL = { shallow: 'site depth ≤ 33.5 m (row i)', wideCorner: 'corner site, frontage ≥ 40.2 m (row ii)', other: 'all other sites (row iii)' };

  /** TOA from the derived station distance. Returns {toa, tier, station, d, dc, edge}. NOT the enacted By-law 14090 polygon. */
  function toaOf(site) {
    const t = site.toa; if (!t) return { toa: false, unknown: true };
    const [si, d, dc] = t, R = window.TOA_RADIUS || 800;
    return { toa: d <= R, tier: d <= 200 ? 1 : d <= 400 ? 2 : d <= R ? 3 : null, station: (window.STATIONS || [])[si], d, dc, edge: (d <= R) !== (dc <= R), R };
  }
  function geometryClass(site) {
    if (site.depth != null && site.depth <= 33.5) return 'shallow';
    if (site.corner && site.frontage != null && site.frontage >= 40.2) return 'wideCorner';
    return 'other';
  }
  function tier(area) { for (const t of TIERS) if (area >= t) return t; return null; }

  /** in: site{zone,area,depth,frontage,corner}, tenure 'rental'|'other', trig{bmrInToa,social}; out: {fsr, clause, steps[]} */
  function fsr(site, tenure, trig) {
    const z = site.zone, T = tier(site.area), g = geometryClass(site), steps = [];
    if (!T) return { fsr: null, clause: '§3.1.2.1', steps: ['Site area below 460 m² — no apartment density available.'] };
    if (z === 'R3-2' && tenure !== 'rental') return { fsr: null, clause: '§3.1.1.4(a)', steps: ['R3-2: residential floor area must be secured as 100% residential rental tenure. No non-rental option.'] };
    const table = (z === 'R3-1' && tenure !== 'rental') ? TABLE_R31_OTHER : TABLE_RENTAL;
    const col = TIERS.indexOf(T);
    let v = table[g][col], clause = CLAUSE[z][tenure === 'rental' ? 'rental' : 'other'];
    steps.push(`Site area ${site.area.toFixed(0)} m² → ${T} m² column; ${GEO_LABEL[g]}; ${tenure === 'rental' ? '100% rental' : z === 'R3-3' ? 'R3-3 single table, all tenures' : 'non-rental tenure'} → ${v.toFixed(2)} FSR (${clause}).`);
    // 3.00 bonus
    const geoOK = (g === 'shallow' && site.area >= 920) || (g === 'wideCorner' && site.area >= 1470);
    const affOK = trig.bmrInToa || trig.social;
    const rentalOK = z !== 'R3-3' || tenure === 'rental';
    if (geoOK && affOK && rentalOK && !(z === 'R3-1' && tenure !== 'rental')) { v = 3.00; clause = CLAUSE[z].b300; steps.push(`3.00 FSR: ${g === 'shallow' ? 'shallow site ≥ 920 m²' : 'wide corner ≥ 1,470 m²'} with ${trig.social ? '100% social housing' : '20% below-market rental in a transit-oriented area'} (${clause}).`); }
    else if (g === 'other' && site.area >= 920 && trig.social && !(z === 'R3-1' && tenure !== 'rental')) { v = 2.70; clause = CLAUSE[z].b270; steps.push(`2.70 FSR: ≥ 920 m², 100% social housing (${clause}).`); }
    else if (affOK && !geoOK) steps.push(`3.00 bonus not available: needs ${g === 'shallow' ? 'site ≥ 920 m²' : g === 'wideCorner' ? 'site ≥ 1,470 m²' : 'a shallow (≤ 33.5 m) or wide-corner (≥ 40.2 m) site'}.`);
    return { fsr: v, clause, tier: T, geo: g, steps };
  }

  function height(trig) { return trig.bmrInToa || trig.social ? { m: 27.5, clause: '§3.1.2.7' } : { m: 23.0, clause: '§3.1.2.2(a),(b)' }; }

  /** yards. regime 'now' | 'oct'. Rear yard by-law is 3.1; CDDG Table 1.3 standard (Oct regime only, guideline) by rear storeys. */
  function yards(site, regime, rearStoreys) {
    const wide = site.frontage != null && site.frontage >= 30.1;
    const y = {
      front: { m: 3.7, clause: '§3.1.2.3', kind: 'RULE', vary: '§3.1.2.10(a)' },
      side1: site.corner ? { m: 3.7, clause: '§3.1.2.4(a) exterior', kind: 'RULE', vary: '§3.1.2.10(b)' } : { m: wide && regime === 'oct' ? 3.1 : 1.8, clause: wide && regime === 'oct' ? 'CDDG Table 1.3 (frontage ≥ 30.1 m)' : '§3.1.2.4(b)', kind: wide && regime === 'oct' ? 'STANDARD' : 'RULE', vary: '§3.1.2.10(b)' },
      side2: { m: wide && regime === 'oct' ? 3.1 : 1.8, clause: wide && regime === 'oct' ? 'CDDG Table 1.3 (frontage ≥ 30.1 m)' : '§3.1.2.4(b)', kind: wide && regime === 'oct' ? 'STANDARD' : 'RULE', vary: '§3.1.2.10(b)' },
      rear: { m: 3.1, clause: '§3.1.2.5', kind: 'RULE', vary: 'not in §3.1.2.10 — no DoP variance' }
    };
    if (regime === 'oct' && rearStoreys) {
      const std = rearStoreys >= 6 ? 6.1 : rearStoreys >= 4 ? 4.6 : 3.1;
      y.rearStd = { m: std, clause: 'CDDG Table 1.3', kind: 'STANDARD', note: `By-law minimum 3.1 m (§3.1.2.5); CDDG expects ${std} m with ${rearStoreys} storeys at the rear.` };
    }
    return y;
  }

  /** floor area computation per regime */
  const FA = {
    now: {
      label: 'Current — R3 §4.1 (July 2026 consolidation)',
      balconyCap: 0.12, balconyClause: '§4.1.2(a)(i) ≤ 12% of permitted floor area',
      porchCap: 0.16, porchClause: '§4.1.2(c)(ii) balconies + porches ≤ 16%',
      amenityCap: 0.10, amenityClause: '§4.1.2(i) ≤ 10% of permitted floor area',
      storage: { perUnit: 3.7, clause: '§4.1.2(h) ≤ 3.7 m² per unit above base surface, all-or-nothing per unit' },
      parkingAtGradeExcluded: false, parkingClause: '§4.1.2(e)(i) — excluded only at or below base surface, ≤ 7.3 m per space',
      storageMin: null,
      mix: (zone, tenure) => zone === 'R3-1' && tenure === 'rental' ? { two: 0.35, three: 0, clause: '§2.2.6(a)(i)' } : { two: 0.35, three: 0.10, clause: zone === 'R3-1' ? '§2.2.6(a)(ii)' : '§2.2.6(b)' },
      light: 'Every habitable room needs an exterior window (§4.4). No inboard bedrooms.'
    },
    oct: {
      label: 'From 27 Oct 2026 — ZDB §10.39–10.41, §11.3.1.10 (RTS 18516 App. A, Council 28 Jul 2026)',
      balconyCap: null, balconyClause: '§10.41.3(a) — no cap',
      porchCap: null, porchClause: '§10.41.3(c) — no cap',
      amenityCap: null, amenityClause: '§10.41.4(b) — DoP discretion, no cap',
      storage: { pct: 0.06, clause: '§10.41.5 — up to 6% of residential floor area (above-grade storage otherwise counts)' },
      parkingAtGradeExcluded: true, parkingClause: '§10.41.3(d)(i) — excluded wherever located, ≤ 7.3 m per space',
      storageMin: { m2: 2.3, clause: '§11.3.1.10' },
      mix: () => ({ two: 0.35, three: 0.05, clause: '§10.40.1' }),
      light: 'Windows required only for living rooms and bedrooms counted toward the mix (§10.39). Other inboard rooms permitted.'
    }
  };

  /** egress strategy presets. Core-loss defaults are DESIGN TIPS, not sourced. The one-exit limits are VBBL 2025 Subsection 3.2.10 (By-law 14576). */
  const EGRESS = {
    two: { label: 'Two exits (interior corridor)', core: 0.18, unitCap: null, storeyCap: null, note: 'Baseline. Core + double-loaded corridor loss default 18% — TIP, edit.' },
    scissor: { label: 'Two exits (scissor stair)', core: 0.15, unitCap: null, storeyCap: 6, note: 'Space-efficient scissor stair, VBBL 2025 3.4.2.3.(5)–(6). Two exits in one core. Residential throughout, ≤ 6 storeys, building area ≤ 600 m²; the distance between the exits need not exceed 4.5 m; an air-leakage barrier between the two stairways. Core default 15% — TIP.' },
    one: { label: 'One exit (exterior stair + passageway)', core: 0.10, unitCap: null, storeyCap: 6, note: 'Single exterior exit stair reached by an exterior exit passageway, VBBL 2025 Subsection 3.2.10 (By-law 14576, in force 20 Jan 2026). Residential only, ≤ 6 storeys and ≤ 18 m; ≤ 6 dwelling units per floor on storeys 1–3 and ≤ 4 above; ≤ 24 persons per floor; travel ≤ 25 m; sprinklered throughout (NFPA 13, balconies included); fire alarm. Interior core default 10% — TIP; the exterior stair and passageway count as floor area (§4.1.1(b) / §10.41.2(b)) unless Planning treats the passageway as a similar appurtenance — OPEN QUESTION.' }
  };

  /** Building code checks used by the Review report. Source: Vancouver Building By-law 2025 (By-law No. 14343), Book I
      (General), Division B, Part 3, in effect 15 Sep 2025; read from the City's Volume 1 convenience copy, amended by
      By-laws 14414 to 14688, consolidated to 5 May 2026 (v4). Values are the by-law's; which Article a project uses,
      sprinklering and the actual fire separations are design decisions to confirm. */
  const VBBL = {
    source: 'VBBL 2025, Div. B Part 3, consolidated to 5 May 2026',
    exitsMin: { v: 2, clause: '3.4.2.1.(1)', text: 'Every floor area served by at least 2 exits' },
    oneExitStoreys: { v: 2, clause: '3.4.2.1.(2)', text: 'One exit only in a building of not more than 2 storeys (with occupant load, area and travel limits)' },
    travelFrom: { clause: '3.4.2.4.(2)', text: 'Travel distance may be measured from the suite egress door where the suite opens onto a separated public corridor' },
    travel: { sprinklered: 45, other: 30, clause: '3.4.2.5.(1)(c),(f)', text: 'Travel distance to at least one exit: 45 m in a floor area sprinklered throughout, otherwise 30 m' },
    exitSeparation: { cap: 9, clause: '3.4.2.3.(1)(a)', text: 'Least distance between 2 exits: half the maximum diagonal of the floor area, need not be more than 9 m with a public corridor' },
    deadEnd: { v: 6, clause: '3.3.1.9.(5)', text: 'Dead-end corridor not more than 6 m long' },
    corridorWidth: { v: 1.1, clause: '3.3.1.9.(1)', text: 'Public corridor at least 1 100 mm wide' },
    // Vancouver space-efficient scissor stair amendment (summary provided by the user; enacted clause numbers NOT IN SOURCE).
    // Space-efficient scissor stair, enacted by By-law 14576 (in force 20 Jan 2026): the least distance between the exits (and
    // between exterior stair discharges) need not exceed 4.5 m for a building residential throughout, ≤ 6 storeys, building
    // area ≤ 600 m²; a barrier to air leakage between the two stairways (3.4.2.3.(6)); the smoke-tight separation of 3.4.4.4.(2)–(3).
    scissor: { clause: '3.4.2.3.(5)–(6)', storeyCap: 6, areaCap: 600, sepCap: 4.5, text: 'Scissor stair: residential throughout, ≤ 6 storeys, building area ≤ 600 m²; the distance between the two exits need not exceed 4.5 m; an air-leakage barrier between the stairways and a smoke-tight fire separation (3.4.4.4.(2)–(3)).' },
    // Single exterior exit stair, VBBL 2025 Subsection 3.2.10 (By-law 14576, in force 20 Jan 2026). Vancouver did not adopt the
    // provincial interior single stair: the one exit is an exterior stair reached by an exterior exit passageway.
    singleExit: { clause: '3.2.10', bylaw: 'By-law 14576', storeyCap: 6, height: 18, unitsLow: 6, unitsHigh: 4, persons: 24, travel: 25, unitTravel: 6, text: 'One exterior exit stair reached by an exterior exit passageway (≥ 50% open, ≥ 45 min separation, noncombustible, EMTC or heavy timber). Residential only, ≤ 6 storeys and ≤ 18 m; ≤ 6 dwelling units per floor on storeys 1–3, ≤ 4 above; ≤ 24 persons per floor; travel ≤ 25 m, ≤ 6 m from each dwelling unit; sprinklered throughout (NFPA 13, balconies included); fire alarm.' },
    // Group C construction options, least onerous first. area: maximum building area (m²) by storeys; height: first storey floor to uppermost floor level.
    construction: [
      { article: '3.2.2.52', label: 'combustible or noncombustible', maxStoreys: 4, area: { 1: 7200, 2: 3600, 3: 2400, 4: 1800 } },
      { article: '3.2.2.51', label: 'combustible or noncombustible', maxStoreys: 6, height: 18, area: { 1: 9000, 2: 4500, 3: 3000, 4: 2250, 5: 1800, 6: 1500 } },
      { article: '3.2.2.49', label: 'noncombustible', maxStoreys: 6, area: { 1: Infinity, 2: Infinity, 3: 12000, 4: 9000, 5: 7200, 6: 6000 } },
      { article: '3.2.2.48', label: 'encapsulated mass timber or noncombustible', maxStoreys: 12, height: 50, areaAll: 6000 },
      { article: '3.2.2.47', label: 'noncombustible, any height and area', maxStoreys: Infinity }
    ]
  };

  return { TIERS, fsr, height, yards, FA, EGRESS, VBBL, geometryClass, tier, toaOf };
})();
