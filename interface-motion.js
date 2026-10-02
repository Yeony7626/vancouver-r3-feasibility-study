/* interface-motion.js: motion that guides the early phases. Every effect answers one question for the user:
   where am I (the tab marker slides to the active phase), where did I go (a phase enters from the side it was reached
   from), what matters on this site (the permitted FSR counts up, the storey recommendation follows), what next (the next
   phase tab cues once when it unlocks), and which question am I on (plan-setup questions slide forward or back).
   Transform and opacity only; nothing loops; reduced motion gets the end state at once. */
(function (root) {
  'use strict';
  const doc = root.document, still = () => root.matchMedia?.('(prefers-reduced-motion: reduce)').matches || doc.hidden;
  const order = () => [...doc.querySelectorAll('.tabs .tab')].map(b => b.dataset.tab);
  // restart a CSS animation class on an element
  function play(el, cls, vars = {}) { if (!el) return; el.classList.remove(cls); for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v); void el.offsetWidth; el.classList.add(cls); el.addEventListener('animationend', function done(e) { if (e.target !== el || e.pseudoElement) return; el.classList.remove(cls); el.removeEventListener('animationend', done); }); }

  // ---------- where am I: one marker under the tabs that glides to the active phase ----------
  let marker = null;
  function placeMarker(animate) {
    const bar = doc.querySelector('.tabs'), on = bar?.querySelector('.tab.on'); if (!bar || !on) return;
    if (!marker) { marker = doc.createElement('span'); marker.className = 'tab-marker'; marker.setAttribute('aria-hidden', 'true'); bar.appendChild(marker); bar.classList.add('has-marker'); }
    marker.classList.toggle('tab-marker-still', !animate || still());
    marker.style.transform = `translateX(${on.offsetLeft}px) scaleX(${on.offsetWidth / 100})`;
  }

  // ---------- where did I go: the new phase enters from the side it was reached from ----------
  let current = null;
  function phase(tab) {
    const list = order(), from = list.indexOf(current), to = list.indexOf(tab), dir = from < 0 || to === from ? 0 : to > from ? 1 : -1;
    current = tab; placeMarker(from >= 0);
    if (still() || from < 0 || to === from) return;
    for (const el of [doc.querySelector('.tabpane:not([hidden])'), doc.getElementById('u-stage')]) if (el && !el.hidden) play(el, 'ph-enter', { '--ph-dx': `${dir * 18}px` });
  }

  // ---------- what matters on this site: the permitted FSR counts up, the recommendation follows ----------
  let lastSite = null;
  function site(box, key) {
    if (!box || box.hidden || key === lastSite) return; lastSite = key;
    const num = box.querySelector('.fsr-num'), rec = box.querySelector('.fsr-rec');
    if (still()) return;
    play(box.querySelector('.fsr-main'), 'fsr-in'); if (rec) play(rec, 'fsr-rec-in'); const next = doc.getElementById('s-next'); if (next && !next.disabled) setTimeout(() => cue(next), 900); // then point at the way on
    if (num) { const end = parseFloat(num.textContent), dp = (num.textContent.split('.')[1] || '').length, t0 = performance.now(), T = 700;
      if (Number.isFinite(end)) { const step = now => { const k = Math.min(1, (now - t0) / T), e = 1 - Math.pow(1 - k, 3); num.textContent = (end * e).toFixed(dp); if (k < 1 && num.isConnected) requestAnimationFrame(step); else num.textContent = end.toFixed(dp); }; num.textContent = (0).toFixed(dp); requestAnimationFrame(step); } }
  }

  // ---------- what next: the next phase tab cues once when it unlocks ----------
  let wasOpen = null;
  function tabs() {
    const bs = [...doc.querySelectorAll('.tabs .tab')], open = bs.map(b => !b.disabled);
    if (wasOpen && !still()) { const at = bs.findIndex(b => b.classList.contains('on')), next = bs[at + 1]; if (next && open[at + 1] && !wasOpen[at + 1]) play(next, 'tab-cue'); }
    wasOpen = open;
  }
  // a cue on demand: draw the eye to a button the user should press next (e.g. Generate once the brief is set)
  function cue(el) { if (el && !still()) play(el, 'btn-cue'); }

  // ---------- which question am I on: plan-setup questions slide forward or back ----------
  let lastStep = null;
  function step(box, k) {
    const body = box?.querySelector('.ps-wiz'), dir = lastStep == null || k === lastStep ? 0 : k > lastStep ? 1 : -1; lastStep = k;
    if (!body || still() || !dir) return;
    body.querySelectorAll(':scope > :not(.ps-steps)').forEach((el, i) => play(el, 'ps-enter', { '--ph-dx': `${dir * 28}px`, '--ph-delay': `${i * 40}ms` }));
    const on = body.querySelector('.ps-steps [aria-current="step"]'); play(on, 'ps-step-on');
    // the last question reached going forward: point at Generate
    if (dir > 0 && on && !on.nextElementSibling) { const g = box.querySelector('#ps-generate'); cue(g && g.offsetParent ? g : doc.getElementById('ws-go')); }
  }

  root.addEventListener?.('resize', () => placeMarker(false));
  // first paint: put the marker under whichever tab starts active, and remember it as the current phase
  setTimeout(() => {
    current = doc.querySelector('.tabs .tab.on')?.dataset.tab || null; placeMarker(false); tabs();
    // whatever unlocks a phase (site pick, a confirmed massing), the cue follows the tabs' own disabled state
    let queued = false; const bar = doc.querySelector('.tabs');
    if (bar && root.MutationObserver) new MutationObserver(() => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; tabs(); }); }).observe(bar, { subtree: true, attributes: true, attributeFilter: ['disabled'] });
  }, 0);
  doc.fonts?.ready.then(() => placeMarker(false));
  root.UI_MOTION = { phase, site, tabs, step, cue, placeMarker };
})(typeof window !== 'undefined' ? window : globalThis);
