/* drawing-motion.js: the one authored moment in the sheet. When a plan is generated (or on Replay), the drawing is drafted
   in front of the user in the order a designer builds it: the walls are pen-drawn, the stairs and lifts drop into place, the
   corridor opens from its centre, the units wipe in band by band in revision blue, then settle to hatch, then the
   windows, labels and dimensions land. The massing stacks floor by floor from the ground. About two seconds; any click or
   key finishes it at once; edits and drags never replay it. Reduced motion gets a short fade unless the user asks for a
   replay. Content is fully visible if this script never runs. */
(function (root) {
  'use strict';
  const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)', PEN = 'cubic-bezier(0.65, 0, 0.35, 1)';
  let running = [], cleanups = [];

  const reduced = () => root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const go = (el, frames, delay, duration, easing = EASE) => {
    if (!el.animate) return null;
    const a = el.animate(frames, { delay, duration, easing, fill: 'backwards' });
    running.push(a);
    return a;
  };
  function finish() {
    for (const a of running) { try { a.finish(); } catch (e) {} }
    running = [];
    for (const f of cleanups) { try { f(); } catch (e) {} }
    cleanups = [];
  }

  const EXCLUDE = '[data-unit],[data-core-select],[data-corridor-network],[data-window],[data-annotation],[data-dimension],[data-site-label],[data-unserved],defs,pattern';
  function plan(svg) {
    const all = sel => [...svg.querySelectorAll(sel)];
    const fit = el => { el.style.transformBox = 'fill-box'; el.style.transformOrigin = 'center'; };
    // 1. walls: every stroked outline of the plan frame is drawn like a pen line
    const frame = svg.querySelector('[data-plan-frame]');
    const walls = frame ? [...frame.querySelectorAll('line,polyline,polygon,path,rect')].filter(el => !el.closest(EXCLUDE) && el.getAttribute('stroke') !== 'none' && typeof el.getTotalLength === 'function').slice(0, 700) : [];
    walls.forEach((el, i) => {
      let L = 0; try { L = el.getTotalLength(); } catch (e) {}
      if (!(L > 0)) return;
      const prev = el.style.strokeDasharray;
      el.style.strokeDasharray = `${L} ${L}`;
      cleanups.push(() => { el.style.strokeDasharray = prev; });
      const a = go(el, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], Math.min(i * 4, 260), 760, PEN);
      if (a) a.onfinish = () => { el.style.strokeDasharray = prev; };
    });
    // 2. stairs and lifts drop in
    all('[data-core-select]').forEach((el, i) => { fit(el); go(el, [{ opacity: 0, transform: 'scale(1.35)' }, { opacity: 1, transform: 'none' }], 340 + i * 110, 480); });
    // 3. the corridor opens from its centre
    all('[data-corridor-network]').forEach(el => go(el, [{ opacity: 0, clipPath: 'inset(0 50% 0 50%)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }], 640, 560));
    // 4. units wipe in band by band in revision blue, then settle to their hatch (a filter on the unit itself, no extra nodes)
    const units = all('[data-unit]'), gap = Math.min(110, 720 / Math.max(1, units.length));
    units.forEach((el, i) => go(el, [
      { opacity: 0, clipPath: 'inset(0 0 100% 0)', filter: 'sepia(1) saturate(9) hue-rotate(175deg) brightness(.9)' },
      { opacity: 1, clipPath: 'inset(0 0 0 0)', filter: 'sepia(1) saturate(9) hue-rotate(175deg) brightness(.9)', offset: .45 },
      { opacity: 1, clipPath: 'inset(0 0 0 0)', filter: 'sepia(0) saturate(1) hue-rotate(175deg) brightness(1)' }], 900 + i * gap, 1100));
    // 5. windows, then labels and dimensions land
    all('[data-window]').forEach((el, i) => go(el, [{ opacity: 0 }, { opacity: 1 }], 1500 + Math.min(i * 14, 260), 280));
    all('[data-annotation],[data-dimension],[data-site-label]').forEach((el, i) => go(el, [{ opacity: 0, transform: 'translate(0,6px)' }, { opacity: 1, transform: 'none' }], 1700 + Math.min(i * 20, 240), 360));
  }

  function massing(svg) {
    const floors = [...svg.querySelectorAll('[data-floor]')], top = Math.max(1, ...floors.map(el => +el.dataset.floor || 1));
    const step = Math.min(160, 1100 / top);
    floors.forEach(el => { const n = (+el.dataset.floor || 1) - 1; go(el, [{ opacity: 0, transform: 'translate(0,-46px)' }, { opacity: 1, transform: 'translate(0,3px)', offset: .78 }, { opacity: 1, transform: 'none' }], 250 + n * step, 620); });
  }

  // Play over a container holding the freshly drawn plan and massing SVGs. {force:true} is an explicit replay.
  function play(container, { force = false } = {}) {
    if (!container) return;
    finish();
    // a hidden page has a frozen animation clock: the drawing would sit invisible, so it simply appears
    if (root.document?.hidden) return;
    const svgs = [...container.querySelectorAll('svg')].filter(s => s.querySelector('[data-plan-frame],[data-floor]'));
    if (!svgs.length) return;
    if (reduced() && !force) { svgs.forEach(s => go(s, [{ opacity: 0 }, { opacity: 1 }], 0, 200)); return; }
    // start on the next frame, so every layer is laid out before its first keyframe applies
    const start = () => { for (const s of svgs) { if (s.querySelector('[data-plan-frame]')) plan(s); if (s.querySelector('[data-floor]')) massing(s); } };
    const hide = svgs.map(s => s.animate ? s.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1000 }) : null);
    root.requestAnimationFrame(() => { hide.forEach(a => a && a.cancel()); start(); });
    const stop = e => {
      if (e?.target?.closest?.('[data-replay-drawing]')) return;
      finish(); container.removeEventListener('pointerdown', stop, true); root.removeEventListener('keydown', stop, true); root.document?.removeEventListener('visibilitychange', away);
    };
    const away = () => { if (root.document?.hidden) stop(); };
    container.addEventListener('pointerdown', stop, true); root.addEventListener('keydown', stop, true); root.document?.addEventListener('visibilitychange', away);
  }

  // The Replay drawing control, wherever the workspace toolbar is drawn.
  root.document?.addEventListener('click', e => {
    const b = e.target.closest?.('[data-replay-drawing]');
    if (!b) return;
    e.preventDefault();
    play(b.closest('#u-stage') || root.document.getElementById('u-stage'), { force: true });
  });

  root.DRAWING_MOTION = { play, finish };
})(typeof window !== 'undefined' ? window : globalThis);
