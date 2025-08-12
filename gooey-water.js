/* Gooey Water Band – bottom-fixed SVG with Matter.js droplets site-wide */
(function () {
  'use strict';

  const BAND_HEIGHT = 96; // px ~ bottom inch
  const Z_INDEX = 900;    // below header/nav (1000+)

  // Lazy load Matter.js if not present
  function ensureMatter(ready) {
    if (window.Matter) return ready();
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/matter-js@0.20.0/build/matter.min.js';
    s.onload = ready; document.head.appendChild(s);
  }

  function mount() {
    const H = Math.min(BAND_HEIGHT, Math.floor(window.innerHeight * 0.16));

    // SVG fixed to bottom
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'gooey-band');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Gooey water band');
    Object.assign(svg.style, {
      position: 'fixed', left: '0', right: '0', bottom: '0', height: H + 'px', width: '100vw',
      zIndex: String(Z_INDEX), pointerEvents: 'none'
    });
    document.body.appendChild(svg);

    const defs = document.createElementNS(svg.namespaceURI, 'defs');
    defs.innerHTML = `
      <filter id="gw-goo">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
        <feColorMatrix in="blur" mode="matrix" values="
          1 0 0 0 0
          0 1 0 0 0
          0 0 1 0 0
          0 0 0 16 -7" result="goo"/>
        <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
      </filter>`;
    svg.appendChild(defs);
    const group = document.createElementNS(svg.namespaceURI, 'g');
    // No goo filter so dots remain visually separate
    svg.appendChild(group);

    let W = window.innerWidth;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const Matter = window.Matter;
    const { Engine, World, Bodies, Body, Composite, Runner } = Matter;
    const COLLISION_GROUP = 1; // positive -> always collide with same group (stack more)

    const engine = Engine.create({ enableSleeping: true });
    engine.world.gravity.scale = 0.0012;
    engine.world.gravity.y = 1;

    // Boundaries just outside edges so goo doesn't bleed
    let walls = [];
    function makeWalls() {
      walls.forEach(w => Composite.remove(engine.world, w));
      const pad = 10;
      walls = [
        Bodies.rectangle(W / 2, H + pad, W, 40, { isStatic: true }), // floor
        Bodies.rectangle(W / 2, -pad, W, 40, { isStatic: true }),     // ceiling (keep in band)
        Bodies.rectangle(-pad, H / 2, 40, H, { isStatic: true }),     // left
        Bodies.rectangle(W + pad, H / 2, 40, H, { isStatic: true })   // right
      ];
      Composite.add(engine.world, walls);
    }
    makeWalls();

    // Droplets
    // Halve the count
    const DROPS = Math.min(240, Math.max(120, Math.floor(W / 6)));
    const bodies = []; const nodes = [];
    function spawn(x, y, r) {
      const b = Bodies.circle(x, y, r, {
        friction: 0.02,
        frictionAir: 0.03,
        restitution: 0.2, // less bounce, piles better
        density: 0.0016,
        collisionFilter: { group: COLLISION_GROUP }
      });
      bodies.push(b); Composite.add(engine.world, b);
      const c = document.createElementNS(svg.namespaceURI, 'circle');
      c.setAttribute('r', String(r));
      c.setAttribute('fill', '#000');
      c.setAttribute('stroke', 'none');
      group.appendChild(c); nodes.push(c);
    }
    for (let i = 0; i < DROPS; i++) {
      const r = 2 + Math.random() * 4; // smaller radius
      const x = (i / DROPS) * W + (Math.random() - 0.5) * (W / DROPS) * 1.2; // spread across width
      const y = 8 + Math.random() * Math.max(8, H - 16); // anywhere in band
      spawn(x, y, r);
    }

    // Interactions
    // Disable mouse gravity & stirring; droplets react only to scroll/tilt

    // Scroll slosh (wheel + scroll delta)
    let scrollT, scrollTX; let lastSY = window.pageYOffset || 0;
    function sloshFromDelta(dy) {
      const s = Math.sign(dy) || 0;
      engine.world.gravity.y += s * 0.14; // slightly more sensitive
      engine.world.gravity.x += s * 0.18;
      clearTimeout(scrollT); scrollT = setTimeout(() => (engine.world.gravity.y = 1), 160);
      clearTimeout(scrollTX); scrollTX = setTimeout(() => (engine.world.gravity.x = 0), 160);
    }
    window.addEventListener('wheel', (e) => sloshFromDelta(e.deltaY), { passive: true });
    window.addEventListener('scroll', () => { const y = window.pageYOffset || 0; sloshFromDelta(y - lastSY); lastSY = y; }, { passive: true });

    window.addEventListener('deviceorientation', (e) => {
      if (e.beta == null || e.gamma == null) return;
      engine.world.gravity.x = (e.gamma || 0) / 35;
      engine.world.gravity.y = 1 + (e.beta || 0) / 60;
    });

    // Runner + render
    const runner = Runner.create(); Runner.run(runner, engine);
    function render() {
      // Turn off artificial repulsion so stacks form naturally
      const REPULSE_K = 0;
      for (let i = 0; i < bodies.length; i++) {
        const bi = bodies[i];
        for (let j = i + 1; j < bodies.length; j++) {
          const bj = bodies[j];
          const dx = bj.position.x - bi.position.x;
          const dy = bj.position.y - bi.position.y;
          const d2 = dx * dx + dy * dy;
          const minD = (bi.circleRadius + bj.circleRadius) * 0.9;
          if (d2 > 0 && d2 < minD * minD) {
            const d = Math.max(1, Math.sqrt(d2));
            const overlap = (minD - d) / minD;
            const fx = (dx / d) * overlap * REPULSE_K;
            const fy = (dy / d) * overlap * REPULSE_K;
            Body.applyForce(bi, bi.position, { x: -fx, y: -fy });
            Body.applyForce(bj, bj.position, { x: fx, y: fy });
          }
        }
      }
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i], n = nodes[i];
        n.setAttribute('cx', b.position.x.toFixed(1));
        n.setAttribute('cy', b.position.y.toFixed(1));
        const sp = Math.min(2, Math.hypot(b.velocity.x, b.velocity.y));
        n.setAttribute('r', (b.circleRadius * (1 + sp * 0.05)).toFixed(1));
      }
      requestAnimationFrame(render);
    }
    render();

    function onResize() {
      W = window.innerWidth; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); makeWalls();
    }
    window.addEventListener('resize', onResize);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ensureMatter(mount));
  } else {
    ensureMatter(mount);
  }
})();


