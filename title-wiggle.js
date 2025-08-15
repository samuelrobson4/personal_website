/* Subtle per-letter wiggle for all h1 elements site-wide */
(function () {
  'use strict';

  // Ensure GSAP
  function ensureGSAP(cb) {
    if (window.gsap) return cb();
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/gsap@3.12.5/dist/gsap.min.js';
    s.onload = cb; document.head.appendChild(s);
  }

  function wrapLetters(el) {
    if (!el || el.__wiggleWrapped) return;
    el.__wiggleWrapped = true;
    const text = el.textContent || '';
    el.textContent = '';
    for (const ch of text) {
      const span = document.createElement('span');
      span.textContent = ch === ' ' ? '\u00A0' : ch; // preserve spaces
      span.style.display = 'inline-block';
      span.style.pointerEvents = 'none';
      el.appendChild(span);
    }
  }

  function init() {
    const headers = document.querySelectorAll('h1:not(.sr-only), .about-intro, .sr-h');
    headers.forEach(wrapLetters);

    let mouse = { x: 0, y: 0 };
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      headers.forEach((h) => {
        const letters = h.querySelectorAll('span');
        letters.forEach((letter) => {
          const rect = letter.getBoundingClientRect();
          const dx = mouse.x - (rect.left + rect.width / 2);
          const dy = mouse.y - (rect.top + rect.height / 2);
          const dist = Math.hypot(dx, dy);
          if (dist < 80) {
            const moveX = (dx / Math.max(1, dist)) * 4;
            const moveY = (dy / Math.max(1, dist)) * 4;
            gsap.to(letter, {
              x: moveX, y: moveY, duration: 0.15, ease: 'power2.out',
              onComplete: () => gsap.to(letter, { x: 0, y: 0, duration: 0.5, ease: 'power2.out' })
            });
          }
        });
      });
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ensureGSAP(init));
  } else {
    ensureGSAP(init);
  }
})();


