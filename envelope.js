/* envelope.js — envelope from the real polygon. Each boundary edge is clipped inward by its own yard depth.
   Half-plane clipping is exact for convex lots and over-constrains concave ones; that case is detected and reported. */
window.ENV = (function () {
  const R = window.RULES;
  function bearing(a, b) { return Math.atan2(b[1] - a[1], b[0] - a[0]); }
  function dang(x, y) { let d = Math.abs(x - y) % Math.PI; return Math.min(d, Math.PI - d); }

  /** Build local frame: origin at centroid, frontage edge along +x with the lot on the +y side. Returns {ring, ecls, sides, front, rot, cx, cy} */
  function frame(site) {
    let ring = site.utm.map(p => p.slice()), ecls = site.ecls.slice();
    if (window.DRAW.area(ring) < 0) { ring.reverse(); ecls = ecls.slice().reverse(); ecls.unshift(ecls.pop()); } // keep CCW; edge i = ring[i]→ring[i+1]
    const n = ring.length;
    // chain street edges into sides
    const sides = []; let cur = null;
    for (let i = 0; i < n; i++) {
      const c = ecls[i]; const a = ring[i], b = ring[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), br = bearing(a, b);
      if (cur && cur.cls === c && dang(cur.br, br) < Math.PI / 6 && c !== 'chamfer') { cur.edges.push(i); cur.len += L; }
      else { cur = { cls: c, edges: [i], len: L, br }; sides.push(cur); }
    }
    if (sides.length > 1 && sides[0].cls === sides[sides.length - 1].cls && dang(sides[0].br, sides[sides.length - 1].br) < Math.PI / 6 && sides[0].cls !== 'chamfer') { const last = sides.pop(); sides[0].edges = last.edges.concat(sides[0].edges); sides[0].len += last.len; }
    let streets = sides.filter(s => s.cls === 'street' && s.len >= 6); if (!streets.length) streets = sides.filter(s => s.cls === 'street'); if (!streets.length) streets = sides.filter(s => s.cls === 'open');
    if (!streets.length) return null;
    const front = streets.reduce((m, s) => s.len < m.len ? s : m);
    // rotate so front side runs along +x and outward normal is -y
    const i0 = front.edges[0], i1 = front.edges[front.edges.length - 1];
    const a = ring[i0], b = ring[(i1 + 1) % n], br = bearing(a, b), rot = -br;
    const cx = ring.reduce((s, p) => s + p[0], 0) / n, cy = ring.reduce((s, p) => s + p[1], 0) / n;
    const T = p => { const x = p[0] - cx, y = p[1] - cy; return [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)]; };
    const local = ring.map(T);
    // front is CCW edge with lot to its left; after rotation the edge runs +x so interior is +y. good.
    const frontEdges = new Set(front.edges);
    // assign yard type per edge
    const ytype = ecls.map((c, i) => {
      if (frontEdges.has(i)) return 'front';
      if (c === 'street' || c === 'open') return site.corner ? 'exterior' : 'front';
      if (c === 'lane') return 'rear';
      if (c === 'interior') { const e = bearing(local[i], local[(i + 1) % n]); return dang(e, 0) < Math.PI / 6 ? 'rear' : 'side'; }
      return 'chamfer';
    });
    for (let i = 0; i < n; i++) if (ytype[i] === 'chamfer') { const p = ytype[(i - 1 + n) % n], q = ytype[(i + 1) % n]; ytype[i] = (p === 'front' || q === 'front') ? 'front' : (p === 'exterior' || q === 'exterior') ? 'exterior' : (p === 'rear' || q === 'rear') ? 'rear' : 'side'; }
    // convexity
    let concave = false;
    for (let i = 0; i < n; i++) { const p = local[(i - 1 + n) % n], q = local[i], s = local[(i + 1) % n]; const cr = (q[0] - p[0]) * (s[1] - q[1]) - (q[1] - p[1]) * (s[0] - q[0]); const L1 = Math.hypot(q[0] - p[0], q[1] - p[1]), L2 = Math.hypot(s[0] - q[0], s[1] - q[1]); if (cr < -0.15 * L1 * L2 && L1 > 1 && L2 > 1) concave = true; }
    const north = -rot; // angle of true north in local frame: north is +y in UTM
    return { local, ecls, ytype, sides, front, rot, cx, cy, concave, north, T };
  }

  function clipHalf(poly, a, nx, ny, d) { // keep points with (p-a)·n <= -d ; n outward unit normal
    const out = []; const n = poly.length; if (!n) return out;
    const f = p => (p[0] - a[0]) * nx + (p[1] - a[1]) * ny + d; // <=0 inside
    for (let i = 0; i < n; i++) {
      const p = poly[i], q = poly[(i + 1) % n], fp = f(p), fq = f(q);
      if (fp <= 0) out.push(p);
      if ((fp <= 0) !== (fq <= 0)) { const t = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    return out;
  }
  function clean(poly) { const o = []; for (const p of poly) { const l = o[o.length - 1]; if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 0.02) o.push(p); } if (o.length > 1 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) < 0.02) o.pop(); return o; }

  /** clip a polygon inward by per-edge distance function dist(i, ytype) using the frame's edges */
  function offsetByEdges(fr, poly, dist) {
    const n = fr.local.length; let out = poly;
    for (let i = 0; i < n; i++) {
      const a = fr.local[i], b = fr.local[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) continue;
      const nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L; // outward for CCW
      const d = dist(i, fr.ytype[i]); if (d == null) continue;
      out = clipHalf(out, a, nx, ny, d); if (out.length < 3) return [];
    }
    return clean(out);
  }

  /** envelope for site under regime, given storeys at the rear (for the CDDG rear standard) */
  function envelope(site, regime, rearStoreys) {
    const fr = frame(site); if (!fr) return { error: 'No street frontage — no envelope.' };
    const y = R.yards(site, regime, rearStoreys);
    const rear = y.rearStd ? y.rearStd.m : y.rear.m;
    const yardOf = t => t === 'front' ? y.front.m : t === 'exterior' ? 3.7 : t === 'rear' ? rear : y.side2.m;
    const env = offsetByEdges(fr, fr.local, (i, t) => yardOf(t));
    const envArea = Math.abs(window.DRAW.area(env));
    const rect = Math.max(0, (site.frontage - y.side1.m - y.side2.m)) * Math.max(0, (site.depth - y.front.m - rear));
    let error = null;
    if (fr.concave && (envArea < 0.7 * rect || env.length < 3)) error = `This site's shape can't be massed by the tool: it is irregular, and setting back its yards edge by edge leaves ${Math.round(envArea)} m² to build on, against ${Math.round(rect)} m² for a plain rectangle of the same frontage and depth. Pick another combination or a single lot. The capacity figures use the plain rectangle.`;
    if (!fr.concave && env.length < 3) error = 'Yards consume the whole lot.';
    const ys = env.map(p => p[1]), xs = env.map(p => p[0]);
    return { fr, y, rear, env, envArea, rect, error, yardOf, depth: env.length ? Math.max(...ys) - Math.min(...ys) : 0, width: env.length ? Math.max(...xs) - Math.min(...xs) : 0, yMin: env.length ? Math.min(...ys) : 0, yMax: env.length ? Math.max(...ys) : 0, xMin: env.length ? Math.min(...xs) : 0, xMax: env.length ? Math.max(...xs) : 0 };
  }

  /** plates for N storeys with articulation moves. moves: {setback4:{on,d}, roofSet:{on,d}, stepDown:{on,depth,storeys}, recess:{on,w,d}, roofAccess:{on,w,d,h}, balcony:{on,d}} */
  function plates(E, N, ftf, commFtf, moves) {
    const out = []; let z = 0;
    for (let k = 1; k <= N; k++) {
      const h = (k === 1 && commFtf) ? commFtf : ftf;
      let poly = E.env;
      if (moves.setback4.on && k >= 5) poly = offsetByEdges(E.fr, poly, (i, t) => t === 'front' ? E.yardOf(t) + moves.setback4.d : null);
      if (moves.roofSet.on && k === N && N > 1) poly = offsetByEdges(E.fr, poly, (i, t) => E.yardOf(t) + moves.roofSet.d);
      if (moves.stepDown.on && k > moves.stepDown.storeys) poly = clipHalf(poly, [0, E.yMax - moves.stepDown.depth], 0, 1, 0);
      poly = clean(poly);
      let frontY = poly.length ? Math.min(...poly.map(q => q[1])) : 0, recess = 0;
      const rStoreys = Math.min(moves.recess.storeys, N);
      if (moves.recess.on && k <= rStoreys && poly.length) {
        // cut a rectangular notch into the front edge; position runs 0 (left) to 1 (right) across the front
        const yF = frontY, d = Math.min(moves.recess.d, 0.8 * (Math.max(...poly.map(q => q[1])) - yF));
        const front = poly.filter(q => Math.abs(q[1] - yF) < 0.05).map(q => q[0]);
        if (front.length >= 2) {
          const fx0 = Math.min(...front), fx1 = Math.max(...front), w = Math.min(moves.recess.w, (fx1 - fx0) - 1.0);
          if (w > 0.5) {
            const cx = fx0 + 0.5 * w + moves.recess.pos * ((fx1 - fx0) - w), nx0 = cx - w / 2, nx1 = cx + w / 2, notched = [];
            for (let i = 0; i < poly.length; i++) {
              const a = poly[i], b = poly[(i + 1) % poly.length]; notched.push(a);
              const onFront = Math.abs(a[1] - yF) < 0.05 && Math.abs(b[1] - yF) < 0.05;
              if (onFront && Math.min(a[0], b[0]) <= nx0 + 0.01 && Math.max(a[0], b[0]) >= nx1 - 0.01) {
                const fwd = b[0] > a[0];
                const seq = [[nx0, yF], [nx0, yF + d], [nx1, yF + d], [nx1, yF]];
                notched.push(...(fwd ? seq : seq.slice().reverse()));
              }
            }
            if (notched.length > poly.length) { poly = notched; recess = w * d; }
          }
        }
      }
      const a = Math.abs(window.DRAW.area(poly));
      out.push({ k, z0: z, z1: z + h, poly, area: a, recess, net: a, frontY, notch: recess ? { d: moves.recess.d } : null });
      z += h;
    }
    return out;
  }
  /** balconies on the plates: discrete pads projecting (or recessed) on the front and/or rear face of each upper storey.
      ZDB §10.8.1(c): ≤1.8 m into a required yard, ≥2.1 m from an interior side property line. Returns pads[] and totals. */
  function balconies(E, plates, b, site) {
    if (!b.on) return null;
    const fr = E.fr, lot = fr.local; const lotX0 = Math.min(...lot.map(q => q[0])), lotX1 = Math.max(...lot.map(q => q[0]));
    // interior side property lines: a side edge is 'side' (interior) or 'exterior'; find which x-extreme is interior
    const leftInterior = fr.ytype.some((t, i) => t === 'side' && Math.min(lot[i][0], lot[(i + 1) % lot.length][0]) < lotX0 + 0.5);
    const rightInterior = fr.ytype.some((t, i) => t === 'side' && Math.max(lot[i][0], lot[(i + 1) % lot.length][0]) > lotX1 - 0.5);
    const pads = []; let area = 0, storeys = 0, longest = 0;
    plates.forEach(p => {
      if (p.k === 1 || !p.poly.length) return;
      const ys = p.poly.map(q => q[1]), xs = p.poly.map(q => q[0]);
      const faces = [];
      if (b.face !== 'rear') faces.push({ y: Math.min(...ys), dir: -1 });
      if (b.face !== 'front') faces.push({ y: Math.max(...ys), dir: 1 });
      let any = false;
      faces.forEach(f => {
        const onFace = p.poly.filter(q => Math.abs(q[1] - f.y) < 0.05).map(q => q[0]); if (onFace.length < 2) return;
        let x0 = Math.min(...onFace), x1 = Math.max(...onFace);
        // §10.8.1(c)(i): keep ≥2.1 m from an interior side property line
        if (b.type === 'project') { if (leftInterior) x0 = Math.max(x0, lotX0 + 2.1); if (rightInterior) x1 = Math.min(x1, lotX1 - 2.1); }
        const run = x1 - x0; if (run < 2) return;
        const n = Math.max(1, Math.round(run / b.pitch)), each = Math.min(run / n, b.len), gap = (run - n * each) / n;
        for (let i = 0; i < n; i++) {
          const px0 = x0 + gap / 2 + i * (each + gap), px1 = px0 + each;
          const py0 = b.type === 'project' ? (f.dir < 0 ? f.y - b.d : f.y) : (f.dir < 0 ? f.y : f.y - b.d);
          pads.push({ k: p.k, x0: px0, x1: px1, y0: py0, y1: py0 + b.d, z: p.z0, face: f.dir < 0 ? 'front' : 'rear', type: b.type });
          area += each * b.d; any = true; longest = Math.max(longest, each);
        }
      });
      if (any) storeys++;
    });
    return { pads, area, storeys, longest, perStorey: storeys ? area / storeys : 0 };
  }
  return { frame, envelope, plates, balconies, offsetByEdges, clipHalf };
})();
