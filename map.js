/* map.js: a figure-ground site plan. The Esri grey base pushed to grey blocks on white streets; R3 land and parcels in one
   red family, the selection in ink, stations as ringed dots with names. */
window.MAP = (function () {
  const P = window.R3_PARCELS, A = window.R3_ASSEMBLIES;
  const COL = { 'R3-1': '#d3dae2', 'R3-2': '#9aa8b8', 'R3-3': '#5d6f83' }; // slate blue-grey, light to dark by sub-district
  const ACC = '#1a56db', R3LAND = '#e6eaef'; // the selection is the one colour on the map: revision blue
  let map, parcelLayers = [], selLayer, adjLayer, comboLayer;

  // Keyless tile sources only, and only ones whose terms allow a local page like this.
  // CARTO basemaps now require an API key ("API KEY REQUIRED" watermark). OpenStreetMap's own tile servers block requests that don't meet their
  // usage policy — a file:// page sends no referer, so they return "Access blocked" 403 tiles. Neither is offered.
  const BASES = {
    'figure': { url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles &copy; Esri — Esri, DeLorme, NAVTEQ', maxZoom: 16, opacity: 1, className: 'base-figure' },
    'esri-gray': { url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles &copy; Esri — Esri, DeLorme, NAVTEQ', maxZoom: 16 },
    'esri-topo': { url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles &copy; Esri — Esri, HERE, Garmin, OpenStreetMap contributors', maxZoom: 19 },
    'esri-street': { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles &copy; Esri — Esri, HERE, Garmin, OpenStreetMap contributors', maxZoom: 19 },
    'esri-imagery': { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles &copy; Esri — Esri, Maxar, Earthstar Geographics', maxZoom: 19 },
    'none': null
  };
  let base = null, tileErrors = 0;
  function setBase(key) {
    if (base) { map.removeLayer(base); base = null; }
    const b = BASES[key]; tileErrors = 0;
    document.getElementById('map')?.classList.toggle('map-figure', key === 'figure' || key === 'none');
    if (!b) return;
    base = L.tileLayer(b.url, { attribution: b.attr, subdomains: b.sub || 'abc', maxZoom: 20, maxNativeZoom: b.maxZoom || 19, opacity: b.opacity ?? 1, className: b.className || '' }).addTo(map);
    base.on('tileerror', () => { if (++tileErrors > 12 && key !== 'none') { console.warn('Tile errors; falling back to no base map'); document.getElementById('basemap').value = 'none'; setBase('none'); } });
  }

  function init() {
    map = L.map('map', { preferCanvas: true, zoomControl: true, attributionControl: true }).setView([49.255, -123.10], 12);
    setBase('esri-gray');
    // zoning districts include road space, so the grey base carries the figure-ground (blocks grey, streets white);
    // only R3 land is tinted, in pale rose
    const zon = L.layerGroup().addTo(map);
    window.ZONING.forEach(z => {
      if (z.d && z.d.startsWith('R3')) z.rings.forEach(r => L.polygon(r, { stroke: false, fillColor: R3LAND, fillOpacity: 0.6, interactive: false }).addTo(zon));
    });
    // parcels
    const pg = L.layerGroup().addTo(map);
    P.forEach((p, i) => {
      const ly = L.polygon(p.ll, { color: '#ffffff', weight: 0.6, fillColor: COL[p.zone], fillOpacity: 0.9 });
      ly.on('mouseover', () => ly.setStyle({ fillOpacity: 1, weight: 1.2, color: ACC })); ly.on('mouseout', () => ly.setStyle({ fillOpacity: 0.9, weight: 0.6, color: '#ffffff' }));
      ly.on('click', ev => { L.DomEvent.stop(ev); window.SITE.select(i, ev.originalEvent.shiftKey); });
      ly.bindTooltip(`${p.addr} · ${p.zone} · ${Math.round(p.area)} m²`, { sticky: true, direction: 'top', opacity: 0.95 });
      parcelLayers[i] = ly; pg.addLayer(ly);
    });
    // TOA: station points and 800 m radii (derived, not the by-law polygon)
    const toaLayer = L.layerGroup();
    (window.STATION_LL || []).forEach((ll, i) => {
      L.circle(ll, { radius: window.TOA_RADIUS || 800, color: '#3d434b', weight: 1, opacity: 0.85, dashArray: '4 4', fill: false, interactive: false }).addTo(toaLayer);
      // a ringed station dot with its name, as transit is drawn on an urban plan
      L.marker(ll, { icon: L.divIcon({ className: 'toa-station', html: '<i></i>', iconSize: [16, 16], iconAnchor: [8, 8] }), keyboard: false, title: `${(window.STATIONS || [])[i]}: ${window.TOA_RADIUS || 800} m transit-oriented area` })
        .bindTooltip(String((window.STATIONS || [])[i] || '').toUpperCase(), { permanent: true, direction: 'right', offset: [6, -5], className: 'toa-name' }).addTo(toaLayer);
    });
    toaLayer.addTo(map);
    document.getElementById('show-toa').onchange = e => { if (e.target.checked) toaLayer.addTo(map); else map.removeLayer(toaLayer); };
    selLayer = L.layerGroup().addTo(map); adjLayer = L.layerGroup().addTo(map); comboLayer = L.layerGroup().addTo(map);
    document.getElementById('basemap').onchange = e => setBase(e.target.value);
    document.addEventListener('site:change', e => draw(e.detail));
    // zoom-dependent parcel visibility to keep the canvas light
    // station names only when zoomed in enough to read them without clutter
    const vis = () => { const z = map.getZoom(); document.getElementById('map')?.classList.toggle('map-far', z < 13); pg.eachLayer(l => l.setStyle({ weight: z >= 16 ? 0.8 : 0.4 })); };
    map.on('zoomend', vis); vis();
  }

  let selSvg = null; // the selected parcel is drawn in SVG (the rest stays on canvas) so its outline can draw itself in
  function draw(detail) {
    selLayer.clearLayers(); adjLayer.clearLayers(); comboLayer.clearLayers();
    if (!detail) return;
    const s = detail.site;
    s.ids.forEach(i => L.polygon(P[i].ll, { color: ACC, weight: 2, fillColor: ACC, fillOpacity: 0.88, interactive: false, className: 'sel-parcel', renderer: selSvg || (selSvg = L.svg({ padding: .5 })) }).addTo(selLayer));
    if (s.kind === 'combined' && s.utm) L.polygon(window.GEO.ringToLatLng(s.utm), { color: ACC, weight: 3, fill: false, dashArray: null, interactive: false }).addTo(comboLayer);
    // neighbours that can combine with the anchor
    const nb = new Set(); s.ids.forEach(i => P[i].adj.forEach(j => nb.add(j)));
    nb.forEach(j => { if (!s.ids.includes(j)) L.polygon(P[j].ll, { color: ACC, weight: 1.5, dashArray: '4 3', fill: false, interactive: false }).addTo(adjLayer); });
    if (detail.fit) {
      const all = s.ids.flatMap(i => P[i].ll);
      map.fitBounds(window.GEO.bounds(all), { padding: [80, 80], maxZoom: 19 });
    }
  }
  function flyTo(i) { window.SITE.select(i, false); }
  return { init, flyTo, get map() { return map; } };
})();
