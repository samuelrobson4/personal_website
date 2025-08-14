/* Gooey dot navigation mounted inside .nav-container (top-right) */
(function () {
  'use strict';

  const PANELS = [
    { key: 'home', label: 'home' },
    { key: 'about', label: 'about' },
    { key: 'projects', label: 'projects' },
    { key: 'blog', label: 'blog' },
    { key: 'contact', label: 'contact' },
  ];

  function ensureGSAP(cb) {
    if (window.gsap) return cb();
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/gsap@3.12.5/dist/gsap.min.js';
    s.onload = cb; document.head.appendChild(s);
  }

  function roundedRect(x, y, w, h, r, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    el.setAttribute('x', x); el.setAttribute('y', y);
    el.setAttribute('width', w); el.setAttribute('height', h);
    el.setAttribute('rx', r); el.setAttribute('ry', r);
    for (const k in (attrs || {})) el.setAttribute(k, attrs[k]);
    return el;
  }

  function setCenter(node, cx, cy, w, h, rx) {
    node.setAttribute('x', cx - w / 2);
    node.setAttribute('y', cy - h / 2);
    node.setAttribute('width', w);
    node.setAttribute('height', h);
    node.setAttribute('rx', rx); node.setAttribute('ry', rx);
  }

  function mount() {
    const host = document.querySelector('.nav-container');
    if (!host) return;
    // Clean old contents
    host.querySelectorAll('.nav-item, .nav-progress-line, .nav-focus').forEach(n => n.remove());

    // Create SVG sized to its content
    const width = 220, height = 32, pad = 10;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('aria-label', 'Navigation');
    svg.style.display = 'block';
    svg.style.pointerEvents = 'auto';

    const defs = document.createElementNS(svg.namespaceURI, 'defs');
    defs.innerHTML = `
      <filter id="nav-goo">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
        <feColorMatrix in="blur" mode="matrix" values="
          1 0 0 0 0
          0 1 0 0 0
          0 0 1 0 0
          0 0 0 18 -10" result="goo"/>
        <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
      </filter>`;
    svg.appendChild(defs);
    const gooLayer = document.createElementNS(svg.namespaceURI, 'g');
    gooLayer.setAttribute('filter', 'url(#nav-goo)');
    const hitLayer = document.createElementNS(svg.namespaceURI, 'g');
    svg.appendChild(gooLayer); svg.appendChild(hitLayer);
    host.appendChild(svg);

    // Label below the row
    let label = host.querySelector('.nav-stack-label');
    if (!label) {
      label = document.createElement('div');
      label.className = 'nav-stack-label';
      host.appendChild(label);
    }
    label.textContent = PANELS[0].label;

    // Layout
    const trackY = height / 2;
    const size = 14, radius = 4, activePad = 6;
    const startX = 18; const gap = 36; // tighter spacing
    const dots = PANELS.map((p, i) => ({ ...p, x: startX + i * gap }));

    // Static dots
    const nodes = dots.map(d => {
      const r = roundedRect(d.x - size/2, trackY - size/2, size, size, radius, { fill: '#0b0b0b' });
      gooLayer.appendChild(r); return r;
    });

    // Active blobs
    const actW = size + activePad, actR = radius + activePad / 2;
    const aA = roundedRect(dots[0].x - actW/2, trackY - actW/2, actW, actW, actR, { fill: '#0b0b0b' });
    const aB = roundedRect(dots[0].x - actW/2, trackY - actW/2, actW, actW, actR, { fill: '#0b0b0b' });
    gooLayer.appendChild(aA); gooLayer.appendChild(aB);

    // Determine initial active index from URL (hash on index, or page path)
    function getInitialIndex() {
      const keyFromHash = (location.hash || '').replace('#', '');
      if (keyFromHash) {
        const j = dots.findIndex(d => d.key === keyFromHash);
        if (j >= 0) return j;
      }
      const p = location.pathname || '';
      if (/about\.html$/i.test(p)) return 1;
      if (/projects\.html$/i.test(p)) return 2;
      if (/blog\.html$/i.test(p)) return 3;
      if (/contact\.html$/i.test(p)) return 4;
      return 0;
    }
    const initialIndex = getInitialIndex();
    const initX = dots[initialIndex].x;
    setCenter(aA, initX, trackY, actW, actW, actR);
    setCenter(aB, initX, trackY, actW, actW, actR);
    updateLabelAt(initX);

    function updateLabelAt(cx) {
      // Center label under the closest dot
      let nearest = 0; let best = 1e9;
      dots.forEach((d, i) => { const dd = Math.abs(cx - d.x); if (dd < best) { best = dd; nearest = i; } });
      label.textContent = dots[nearest].label;
      const hostRect = host.getBoundingClientRect();
      const labelWidth = label.getBoundingClientRect().width;
      const lx = dots[nearest].x - labelWidth / 2;
      label.style.transform = `translate(${lx}px, 0)`;
    }

    function goTo(index, navigate = true) {
      const from = dots[current].x; const to = dots[index].x;
      lastTL && lastTL.kill();
      const tl = gsap.timeline({ defaults: { duration: 0.5, ease: 'power2.out' } });
      const maxStretch = Math.min(42, 16 + Math.abs(to - from) * 0.35);
      tl.to({}, {
        duration: 0.5,
        onUpdate() {
          const p = this.progress();
          const cx = gsap.utils.interpolate(from, to, p);
          const fc = gsap.utils.interpolate(from, to, Math.max(0, p - 0.25));
          const w = gsap.utils.interpolate(actW, maxStretch, Math.sin(p * Math.PI));
          const cxMid = (cx + fc) / 2;
          setCenter(aA, cxMid, trackY, w, actW, w / 2); setCenter(aB, cxMid, trackY, w, actW, w / 2);
          updateLabelAt(cxMid);
        }
      });
      tl.eventCallback('onComplete', () => {
        setCenter(aA, to, trackY, actW, actW, actR); setCenter(aB, to, trackY, actW, actW, actR);
        updateLabelAt(to);
      });
      lastTL = tl; current = index;
      if (!navigate) return;
      // Navigate on user click
      const key = dots[index].key;
      const isIndex = /index\.html$/.test(location.pathname) || location.pathname === '/' || location.pathname === '';
      if (isIndex && window.hsDebug && typeof window.hsDebug.seekToPanel === 'function') {
        history.pushState(null, '', `#${key}`);
        window.hsDebug.seekToPanel(key, true);
      } else {
        location.href = `index.html#${key}`;
      }
    }

    // Click targets
    dots.forEach((d, i) => {
      const t = document.createElementNS(svg.namespaceURI, 'rect');
      t.setAttribute('x', String(d.x - 18)); t.setAttribute('y', String(trackY - 18));
      t.setAttribute('width', '36'); t.setAttribute('height', '36'); t.setAttribute('fill', 'transparent');
      t.style.cursor = 'pointer';
      t.addEventListener('pointerenter', () => {
        const node = nodes[i];
        gsap.fromTo(node, { scale: 1 }, { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1, transformOrigin: `${d.x}px ${trackY}px` });
      });
      t.addEventListener('click', () => goTo(i));
      hitLayer.appendChild(t);
    });

    let current = 0, lastTL = null;
    current = initialIndex;

    // --- Scroll-driven sync (index page with GSAP scroller) ---
    function syncFromScroll(pOverride) {
      const isIndex = /index\.html$/.test(location.pathname) || location.pathname === '/' || location.pathname === '';
      if (!isIndex) return;
      const hs = window.hsDebug;
      let p = (typeof pOverride === 'number') ? pOverride : null;
      if (hs && hs.mainTimeline) {
        // Desktop GSAP timeline
        if (p == null) p = hs.mainTimeline.progress();
      } else {
        // Mobile/native scroll: compute from stage scrollLeft
        const stage = document.querySelector('.hs-stage');
        const track = document.querySelector('.hs-track');
        if (stage && track && stage.scrollWidth > stage.clientWidth) {
          const maxX = track.scrollWidth - stage.clientWidth; // sometimes equals stage.scrollWidth
          const sl = stage.scrollLeft || 0;
          p = Math.max(0, Math.min(1, sl / Math.max(1, maxX)));
        } else {
          // Fallback: estimate using panel centers
          const panels = Array.from(document.querySelectorAll('.hs-panel'));
          if (panels.length > 1) {
            const centers = panels.map((el, idx) => el.getBoundingClientRect().left + el.clientWidth / 2);
            const viewportCenter = window.innerWidth / 2;
            let nearest = 0; let best = Infinity;
            centers.forEach((c, i) => { const d = Math.abs(c - viewportCenter); if (d < best) { best = d; nearest = i; } });
            p = nearest / (panels.length - 1);
          }
        }
      }
      if (p == null) return;
      const span = dots.length - 1;
      const pos = p * span; // continuous position
      const i = Math.floor(pos);
      const frac = Math.min(1, Math.max(0, pos - i));
      const fromX = dots[Math.max(0, Math.min(dots.length - 1, i))].x;
      const toX = dots[Math.max(0, Math.min(dots.length - 1, i + 1))].x;
      const cx = gsap.utils.interpolate(fromX, toX, isFinite(frac) ? frac : 0);
      const actW = size + activePad;
      const maxStretch = Math.min(42, 16 + Math.abs(toX - fromX) * 0.35);
      const w = gsap.utils.interpolate(actW, maxStretch, Math.sin(frac * Math.PI));
      const followerX = gsap.utils.interpolate(fromX, toX, Math.max(0, frac - 0.25));
      // Lead blob stretches toward the next, follower lags to create a gooey bridge
      setCenter(aA, cx, trackY, w, actW, w / 2);
      setCenter(aB, followerX, trackY, actW, actW, actR);
      updateLabelAt((cx + followerX) / 2);
      // update current discrete index for click replays
      const nearest = Math.round(pos);
      current = Math.max(0, Math.min(dots.length - 1, nearest));
    }
    // Use a lightweight ticker so we stay in sync with GSAP even if
    // window scroll events are throttled or not firing while pinned.
    // Prefer event-driven progress but keep a lightweight RAF as fallback
    window.addEventListener('hs:scroll-progress', (e) => {
      const p = e && e.detail && typeof e.detail.progress === 'number' ? e.detail.progress : undefined;
      syncFromScroll(p);
    });
    let lastP = -1;
    function tick() {
      const isIndex = /index\.html$/.test(location.pathname) || location.pathname === '/' || location.pathname === '';
      const hs = window.hsDebug;
      if (isIndex && hs && hs.mainTimeline) {
        const p = hs.mainTimeline.progress();
        if (p !== lastP) { syncFromScroll(p); lastP = p; }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    
    // Listen for external active-panel events from the horizontal scroller
    window.addEventListener('hs:active-panel', (e) => {
      const isIndex = /index\.html$/.test(location.pathname) || location.pathname === '/' || location.pathname === '';
      const hs = window.hsDebug;
      // On the index page with GSAP scroller, our own ticker + syncFromScroll
      // already animates the blob with stretchy motion. Avoid overriding it.
      if (isIndex && hs && hs.mainTimeline) return;

      const idx = (e && e.detail && typeof e.detail.index === 'number') ? e.detail.index : current;
      const safeIdx = Math.max(0, Math.min(dots.length - 1, idx));
      const to = dots[safeIdx].x;
      setCenter(aA, to, trackY, actW, actW, actR);
      setCenter(aB, to, trackY, actW, actW, actR);
      updateLabelAt(to);
      current = safeIdx;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ensureGSAP(mount));
  } else {
    ensureGSAP(mount);
  }
})();


