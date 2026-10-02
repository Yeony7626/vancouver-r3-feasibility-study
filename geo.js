/* geo.js — projection and ring helpers. Data is EPSG:26910 (NAD83 / UTM 10N, metres); Leaflet wants WGS84. */
window.GEO = (function () {
  // Inverse UTM (zone 10 N, GRS80) — standard series, accurate to millimetres over the city.
  const a = 6378137.0, f = 1 / 298.257222101, k0 = 0.9996, E0 = 500000, lon0 = -123 * Math.PI / 180;
  const e2 = f * (2 - f), e = Math.sqrt(e2), ep2 = e2 / (1 - e2);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  function utmToLatLng(x, y) {
    const M = y / k0;
    const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));
    const phi1 = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu)
      + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu)
      + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu);
    const s = Math.sin(phi1), c = Math.cos(phi1), t = Math.tan(phi1);
    const N1 = a / Math.sqrt(1 - e2 * s * s);
    const T1 = t * t, C1 = ep2 * c * c;
    const R1 = a * (1 - e2) / Math.pow(1 - e2 * s * s, 1.5);
    const D = (x - E0) / (N1 * k0);
    const lat = phi1 - (N1 * t / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * Math.pow(D, 4) / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * Math.pow(D, 6) / 720);
    const lon = lon0 + (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6
      + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * Math.pow(D, 5) / 120) / c;
    return [lat * 180 / Math.PI, lon * 180 / Math.PI];
  }
  function ringToLatLng(utm) { return utm.map(p => utmToLatLng(p[0], p[1])); }
  function bounds(ll) {
    let s = 90, n = -90, w = 180, e = -180;
    for (const p of ll) { if (p[0] < s) s = p[0]; if (p[0] > n) n = p[0]; if (p[1] < w) w = p[1]; if (p[1] > e) e = p[1]; }
    return [[s, w], [n, e]];
  }
  function centroid(ll) {
    let la = 0, lo = 0; for (const p of ll) { la += p[0]; lo += p[1]; }
    return [la / ll.length, lo / ll.length];
  }
  return { utmToLatLng, ringToLatLng, bounds, centroid };
})();
