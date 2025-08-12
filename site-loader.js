/* Simple site loading overlay: counts 0..100%, cream background, Baskervville 25pt */
(function () {
  'use strict';

  const LOADER_CLASS = 'site-loader';
  const COUNTER_CLASS = 'site-loader__counter';

  function createLoader() {
    if (document.querySelector('.' + LOADER_CLASS)) return null;
    const el = document.createElement('div');
    el.className = LOADER_CLASS;
    el.setAttribute('aria-live', 'polite');
    const span = document.createElement('span');
    span.className = COUNTER_CLASS;
    span.textContent = '0%';
    el.appendChild(span);
    document.body.appendChild(el);
    // Force render before animating
    getComputedStyle(el).opacity;
    el.style.opacity = '1';
    return { el, span };
  }

  function init() {
    const loader = createLoader();
    if (!loader) return;
    const { el, span } = loader;

    let loaded = false;
    let progress = 0;
    let start = performance.now();

    function tick(t) {
      const dt = t - start;
      // Ease towards 90% over ~1.2s while waiting
      if (!loaded) {
        const target = Math.min(90, (dt / 1200) * 90);
        progress += (target - progress) * 0.15;
      } else {
        // Finish to 100%
        progress += (100 - progress) * 0.2;
      }
      if (progress > 99.6) progress = 100;
      span.textContent = Math.round(progress) + '%';
      if (progress < 100) {
        requestAnimationFrame(tick);
      } else {
        // Fade out and remove
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 400);
      }
    }

    window.addEventListener('load', () => { loaded = true; });
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


