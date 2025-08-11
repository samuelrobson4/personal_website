/**
 * hs-scroller.js
 * Scroll-driven horizontal narrative with a hand-drawn SVG line.
 *
 * Edit config below to change panel content and the SVG path.
 * - panelTexts: array of { title, body }
 * - pathD: SVG path data string (single path)
 * - snapBreakpointPx: below this width, degrade to native horizontal scroll with snap
 */
(function () {
  const root = document.querySelector('.hs-section');
  if (!root) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Config
  const config = {
    panelTexts: [
      { title: 'made by samuel robson', body: 'value-first products that bring joy', href: 'about.html' },
      { title: 'about', body: 'principles and approach', href: 'about.html' },
      { title: 'projects', body: 'a selection of recent work', href: 'projects.html' },
      { title: 'blog', body: 'studio log, notes and ideas', href: 'blog.html' },
      { title: 'contact', body: 'get in touch', href: 'contact.html' },
    ],
    pathD:
      'M 40 520 C 180 480 240 420 320 420 C 460 420 520 520 640 520 C 760 520 800 460 880 420',
    snapBreakpointPx: 680,
  };

  const stage = root.querySelector('.hs-stage');
  const track = root.querySelector('.hs-track');
  const pathEl = root.querySelector('#hs-path');
  const svg = root.querySelector('.hs-svg');
  if (!stage || !track || !pathEl || !svg) return;

  // Progressive enhancement: ensure panels reflect config
  track.innerHTML = '';
  for (const { title, body, href } of config.panelTexts) {
    const art = document.createElement('article');
    art.className = 'hs-panel';
    const safeHref = href ? ` href="${href}"` : '';
    art.innerHTML = `<h2>${href ? `<a${safeHref}>${title}</a>` : title}</h2><p>${body}</p>`;
    track.appendChild(art);
  }
  root.style.setProperty('--hs-panel-count', String(config.panelTexts.length));

  // Path setup
  // Extend the path across panels by scaling its X to the full virtual width
  // Compute a path that spans panelCount widths by adjusting the viewBox via transform
  // Simpler approach: repeat the curve segments across panels
  const segments = [];
  for (let i = 0; i < config.panelTexts.length; i++) {
    const offset = i * 240; // segment base width units in viewBox; tweak to taste
    segments.push(`M ${40 + offset} 520 C ${180 + offset} 480 ${240 + offset} 420 ${320 + offset} 420 C ${460 + offset} 420 ${520 + offset} 520 ${640 + offset} 520 C ${760 + offset} 520 ${800 + offset} 460 ${880 + offset} 420`);
  }
  pathEl.setAttribute('d', segments.join(' '));
  pathEl.setAttribute('vector-effect', 'non-scaling-stroke');
  // Normalize by pathLength so 0..1 maps to entire length
  pathEl.setAttribute('pathLength', '1');
  pathEl.style.strokeDasharray = '1';
  pathEl.style.strokeDashoffset = prefersReduced ? '0' : '1';

  // Sizing cache
  let viewportW = 0;
  let viewportH = 0;
  let panelCount = config.panelTexts.length;
  let totalScroll = 0; // total vertical scroll budget for this section

  function recalc() {
    const r = stage.getBoundingClientRect();
    viewportW = window.innerWidth;
    viewportH = window.innerHeight;
    panelCount = config.panelTexts.length;
    // The total vertical distance over which the stage remains pinned
    // equals the horizontal distance needed to move panels fully into view.
    // Track width = panelCount * viewportW. We need to translate from 0 to (trackW - viewportW)
    const trackDistance = Math.max(0, panelCount * viewportW - viewportW);
    // Add a small buffer so the last panel settles
    totalScroll = trackDistance + viewportH * 0.1; // buffer so line finishes past the last panel edge
    root.style.setProperty('--hs-section-height', `${viewportH + totalScroll}px`);
  }

  // Small screens: snap mode (no pinning transform)
  function isSnapMode() {
    return window.innerWidth <= config.snapBreakpointPx;
  }

  // Scroll logic
  let ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const rect = root.getBoundingClientRect();
      const start = rect.top + window.scrollY; // section top relative to doc
      const current = window.scrollY - start; // how far into the section
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

      if (isSnapMode() || prefersReduced) {
        // In snap mode or reduced motion: no transform, show full path
        track.style.transform = 'translate3d(0,0,0)';
        pathEl.style.strokeDashoffset = '0';
        return;
      }

      const progress = clamp(current / totalScroll, 0, 1);
      const trackW = panelCount * viewportW;
      const maxX = Math.max(0, trackW - viewportW);
      const translateX = progress * maxX;
      track.style.transform = `translate3d(${-translateX}px, 0, 0)`;
      // SVG reveal (pathLength=1): 1 -> 0
      pathEl.style.strokeDashoffset = String(1 - progress);
    });
  }

  function onResize() {
    recalc();
    onScroll();
  }

  // Initialize
  recalc();
  // Snap mode: set path fully drawn
  if (isSnapMode() || prefersReduced) {
    pathEl.style.strokeDashoffset = '0';
  }

  const opts = { passive: true };
  window.addEventListener('scroll', onScroll, opts);
  window.addEventListener('resize', onResize, opts);

  // Teardown if needed (not SPA, but safe)
  window.addEventListener('beforeunload', () => {
    window.removeEventListener('scroll', onScroll, opts);
    window.removeEventListener('resize', onResize, opts);
  });
})();


