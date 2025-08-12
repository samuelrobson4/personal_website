/* Water Dots – fixed bottom particle band with scroll + mouse interaction */
(function() {
  'use strict';

  const HEIGHT_PX = 96; // approx bottom inch
  const DOT_COLOR = 'rgba(0,0,0,0.65)';
  const DOT_RADIUS = 1.8; // base radius in CSS px
  const CELL_X = 4; // denser grid
  const CELL_Y = 6;
  const DAMPING = 0.92;
  const MOUSE_INFLUENCE = 90; // px
  const MOUSE_STRENGTH = 0.16;

  let canvas, ctx, dpr, width, height, particles = [], rafId = 0;
  let lastScrollY = window.pageYOffset || 0;
  let scrollVelocity = 0;
  let mouse = { x: -9999, y: -9999 };
  let hasRecentInteraction = false;

  function setupCanvas() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'water-dots-canvas';
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
    }
    dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    width = Math.floor(window.innerWidth);
    height = Math.floor(Math.min(HEIGHT_PX, window.innerHeight * 0.14));
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createParticles() {
    particles = [];
    const cols = Math.ceil(width / CELL_X);
    const rows = Math.ceil(height / CELL_Y);
    for (let ry = 0; ry < rows; ry++) {
      for (let cx = 0; cx < cols; cx++) {
        const x = cx * CELL_X + (Math.random() - 0.5) * 1.5;
        const y = ry * CELL_Y + (Math.random() - 0.5) * 1.5;
        particles.push({ x, y, vx: 0, vy: 0, baseX: x, baseY: y, phase: Math.random() * Math.PI * 2 });
      }
    }
  }

  function onResize() {
    setupCanvas();
    createParticles();
  }

  function onScroll() {
    const y = window.pageYOffset || 0;
    scrollVelocity = (y - lastScrollY);
    lastScrollY = y;
    hasRecentInteraction = true;
    clearTimeout(onScroll._t);
    onScroll._t = setTimeout(() => { hasRecentInteraction = false; }, 180);
  }

  function onMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    hasRecentInteraction = true;
    clearTimeout(onMouseMove._t);
    onMouseMove._t = setTimeout(() => { hasRecentInteraction = false; }, 180);
  }
  function onTouchMove(e) {
    if (e.touches && e.touches[0]) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
    }
  }

  function step(time) {
    rafId = requestAnimationFrame(step);
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const t = (time || 0) * 0.0015;
    const scrollAbs = Math.abs(scrollVelocity);
    // Only add wave when scrolling; otherwise dots settle to base
    const waveAmp = scrollAbs > 0.2 ? Math.min(14, scrollAbs * 0.5 + 2) : 0;
    const waveLen = 120;

    // Simple value noise and curl to create divergence-free flow
    const scale = 0.02; // spatial scale
    const eps = 0.001;
    function smoothstep(a, b, x) {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function rand2(ix, iy) {
      const s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
      return s - Math.floor(s);
    }
    function valueNoise(x, y, tm) {
      const nx = x * scale + tm;
      const ny = y * scale + tm * 0.7;
      const x0 = Math.floor(nx), y0 = Math.floor(ny);
      const xf = nx - x0, yf = ny - y0;
      const u = smoothstep(0, 1, xf), v = smoothstep(0, 1, yf);
      const n00 = rand2(x0, y0);
      const n10 = rand2(x0 + 1, y0);
      const n01 = rand2(x0, y0 + 1);
      const n11 = rand2(x0 + 1, y0 + 1);
      const nx0 = lerp(n00, n10, u);
      const nx1 = lerp(n01, n11, u);
      return lerp(nx0, nx1, v) * 2 - 1; // [-1,1]
    }
    function curl(x, y, tm) {
      const n1 = valueNoise(x, y + eps, tm);
      const n2 = valueNoise(x, y - eps, tm);
      const n3 = valueNoise(x + eps, y, tm);
      const n4 = valueNoise(x - eps, y, tm);
      const dx = (n1 - n2) / (2 * eps);
      const dy = (n3 - n4) / (2 * eps);
      return { x: dy, y: -dx }; // rotate gradient 90° to get divergence-free field
    }

    for (let p of particles) {
      // baseline vertical wave (0 when not scrolling)
      const targetY = p.baseY + (waveAmp === 0 ? 0 : Math.sin((p.x + t * 140) / waveLen + p.phase) * waveAmp);
      // spring towards target
      const ay1 = (targetY - p.y) * 0.06;
      p.vy = (p.vy + ay1) * DAMPING;

      // advect in curl-noise flow opposite to scroll direction when scrolling
      let ax = 0, ay2 = 0;
      if (scrollAbs > 0.2 || hasRecentInteraction) {
        const tm = t * (1 + scrollAbs * 0.4);
        const f = curl(p.x, p.y, tm);
        // oppose scroll predominantly along x, but maintain fluid y
        const flowScale = Math.min(3, 0.6 + scrollAbs * 0.12);
        ax += (f.x - Math.sign(scrollVelocity) * Math.abs(f.x)) * flowScale;
        ay2 += f.y * (flowScale * 0.6);
      }
      // restore towards base when idle
      if (scrollAbs <= 0.2 && !hasRecentInteraction) {
        ax += -(p.x - p.baseX) * 0.08;
        ay2 += -(p.y - p.baseY) * 0.06;
      }
      p.vx = (p.vx + ax) * DAMPING;
      p.vy = (p.vy + ay2) * DAMPING;

      // mouse repel (only if within band vertically)
      const cy = window.innerHeight - height + p.y; // canvas y to page y
      const dx = p.x - mouse.x;
      const dy = cy - mouse.y;
      const dist2 = dx*dx + dy*dy;
      const rad = MOUSE_INFLUENCE;
      if (dist2 < rad * rad) {
        const dist = Math.max(8, Math.sqrt(dist2));
        const strength = (1 - dist / rad) * MOUSE_STRENGTH;
        p.vx += (dx / dist) * strength * 6;
        p.vy += (dy / dist) * strength * 6;
      }

      // integrate
      p.x += p.vx; p.y += p.vy;
      p.vx *= DAMPING; p.vy *= DAMPING;
      // soft bounds
      if (p.x < 0) { p.x = 0; p.vx *= -0.5; }
      if (p.x > width) { p.x = width; p.vx *= -0.5; }
      if (p.y < 0) { p.y = 0; p.vy *= -0.5; }
      if (p.y > height) { p.y = height; p.vy *= -0.5; }

      // draw
      ctx.fillStyle = DOT_COLOR;
      ctx.beginPath();
      ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    // decay scroll velocity
    scrollVelocity *= 0.9;
  }

  function init() {
    setupCanvas();
    createParticles();
    step(0);
  }

  // Mount once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Events
  const passive = { passive: true };
  window.addEventListener('resize', onResize, passive);
  window.addEventListener('scroll', onScroll, passive);
  window.addEventListener('mousemove', onMouseMove, passive);
  window.addEventListener('touchmove', onTouchMove, passive);

  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('touchmove', onTouchMove);
  });
})();


