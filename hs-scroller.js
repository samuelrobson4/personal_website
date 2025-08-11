/**
 * hs-scroller.js
 * Scroll-driven horizontal narrative with a hand-drawn SVG line.
 *
 * TO ADJUST PANEL COUNT:
 * 1. Update config.panels array below (add/remove { key: 'name' } objects)
 * 2. Add corresponding cases in panelMarkup() function
 * 3. Update the authored HTML panels in index.html to match
 * 4. The scroll math will automatically adapt to the new panel count
 *
 * Config options:
 * - panels: array of { key } objects defining panel order
 * - pathD: SVG path data string (single path segment, will be repeated)
 * - snapBreakpointPx: below this width, degrade to native horizontal scroll with snap
 */
(function () {
  const root = document.querySelector('.hs-section');
  if (!root) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Config
  const config = {
    panels: [
      { key: 'home' },
      { key: 'about' },
      { key: 'projects' },
      { key: 'blog' },
      { key: 'contact' },
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

  // Progressive enhancement: build panels mirroring page content
  function panelMarkup(key) {
    switch (key) {
      case 'home':
        return `<div class="hs-inner"><h1 class="hero-title"><a href="about.html">made by samuel robson</a></h1><p class="hero-subtitle">I focus on building high quality, value first products which try and bring joy to those who use them</p><div id="hs-home-bouncy" style="margin-top:12px"></div></div>`;
      case 'about':
        return `<div class="hs-inner"><h1>about</h1><p class="muted">As a product creator, I believe that technology should amplify what makes us human. My approach is rooted in a core set of principles that guide every project I work on.</p><div class="section"><h2 style="font-family:'Baskervville',serif;font-size:24px;font-weight:600">product principles</h2><ol class="principles"><li>simple → cut through the noise</li><li>impactful → solve real and important problems</li><li>human first → designed for people and our planet</li><li>elegant → refined, with intention and care</li><li>joyful → make it feel good to use</li></ol></div></div>`;
      case 'projects':
        return `<div class="hs-inner"><h1>projects</h1><p class="lead">A selection of my latest work...</p><div id="hs-projects-bouncy"></div></div>`;
      case 'blog':
        return `<div class="hs-inner"><h1>studio log</h1><p class="lead">New thoughts and ideas related to my work...</p><div id="hs-blog-bouncy" style="margin-top:12px"></div></div>`;
      case 'contact':
        return `<div class="hs-inner"><h1>contact</h1><p class="muted">Send me a message and I’ll reply soon.</p><form id="hs-contact-form"><div><label for="hs-name">name</label><input id="hs-name" name="name" type="text" placeholder="your name" required /></div><div><label for="hs-email">email</label><input id="hs-email" name="email" type="email" placeholder="your@email.com" required /></div><div><label for="hs-message">message</label><textarea id="hs-message" name="message" placeholder="how can I help?" required></textarea></div><div class="actions"><button type="submit">send</button><span id="hs-status" class="muted" aria-live="polite"></span></div></form></div>`;
      default:
        return `<div class="hs-inner"><h2>${key}</h2></div>`;
    }
  }

  // Do not overwrite authored panels; just ensure the panel count CSS var is set
  root.style.setProperty('--hs-panel-count', String(config.panels.length));

  // Path setup
  // Single continuous path spanning all panels
  // Base curve in viewBox units; we scale offsets by a factor tied to panel count
  const unit = 300; // widen segment to better span each 100vw panel
  let d = '';
  for (let i = 0; i < config.panels.length; i++) {
    const ox = i * unit;
    if (i === 0) {
      d += `M ${40 + ox} 520`;
    }
    d += ` C ${180 + ox} 480 ${240 + ox} 420 ${320 + ox} 420`;
    d += ` C ${460 + ox} 420 ${520 + ox} 520 ${640 + ox} 520`;
    d += ` C ${760 + ox} 520 ${800 + ox} 460 ${880 + ox} 420`;
  }
  pathEl.setAttribute('d', d);
  pathEl.setAttribute('vector-effect', 'non-scaling-stroke');
  // Normalize by pathLength so 0..1 maps to entire length
  pathEl.setAttribute('pathLength', '1');
  pathEl.style.strokeDasharray = '1';
  pathEl.style.strokeDashoffset = prefersReduced ? '0' : '1';

  // Sizing cache
  let viewportW = 0;
  let viewportH = 0;
  let panelCount = config.panels.length;
  let sectionTop = 0; // absolute position of section in document
  let scrollRange = 0; // total scroll range for horizontal movement

  function recalc() {
    viewportW = window.innerWidth;
    viewportH = window.innerHeight;
    panelCount = config.panels.length;
    
    // SCROLL RANGE CALCULATION:
    // We need to scroll through (panelCount - 1) panel widths to see all panels
    // because the first panel is visible without any horizontal translation
    scrollRange = Math.max(0, (panelCount - 1) * viewportW);
    
    // SECTION HEIGHT CALCULATION:
    // Total section height = viewport height (for the sticky stage) + scroll range
    // This ensures we have enough scroll distance to move through all panels
    const totalSectionHeight = viewportH + scrollRange;
    root.style.setProperty('--hs-section-height', `${totalSectionHeight}px`);
    
    // Cache section's document position for scroll calculations
    sectionTop = root.offsetTop;
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
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

      if (isSnapMode() || prefersReduced) {
        // In snap mode or reduced motion: no transform, show full path
        track.style.transform = 'translate3d(0,0,0)';
        pathEl.style.strokeDashoffset = '0';
        return;
      }

      // PROGRESS CALCULATION:
      // start = when the section top hits the viewport top
      // end = when we've scrolled enough to see the last panel
      // scrollY = current scroll position from document top
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      const sectionStart = sectionTop; // section top in document
      const sectionEnd = sectionStart + scrollRange; // when horizontal scroll should complete
      
      // How far we've scrolled into the section's scroll range
      const scrollIntoSection = scrollY - sectionStart;
      
      // Progress: 0 at section start, 1 when we've scrolled through all panels
      const progress = clamp(scrollIntoSection / scrollRange, 0, 1);
      
      // TRANSFORM CALCULATION:
      // translateX moves from 0 (first panel visible) to scrollRange (last panel visible)
      const translateX = progress * scrollRange;
      track.style.transform = `translate3d(${-translateX}px, 0, 0)`;
      
      // SVG reveal: progress 0 -> strokeDashoffset 1 (hidden), progress 1 -> strokeDashoffset 0 (fully shown)
      pathEl.style.strokeDashoffset = String(1 - progress);
    });
  }

  function onResize() {
    recalc();
    onScroll();
  }

  // Dynamic mounts for projects, blog, and contact form
  function initDynamic() {
    // Projects
    const projectsEl = document.getElementById('hs-projects-bouncy');
    if (projectsEl && typeof window !== 'undefined') {
      const mountProjectsIfReady = () => {
        if (window.mountProjects) {
          window.mountProjects(projectsEl);
        } else {
          // simple progressive fallback
          projectsEl.innerHTML = '<p class="muted">loading projects…</p>';
          window.addEventListener('load', () => window.mountProjects?.(projectsEl), { once: true });
        }
      };
      mountProjectsIfReady();
    }
    // Home single bouncy card representing the hero as a card
    const homeBouncy = document.getElementById('hs-home-bouncy');
    if (homeBouncy && typeof window !== 'undefined') {
      const cards = [
        { id: 'home', title: 'made by samuel robson', subtitle: 'about', url: 'about.html' },
      ];
      if (window.bouncyMount) {
        window.bouncyMount(homeBouncy, cards);
      } else {
        window.addEventListener('load', () => window.bouncyMount?.(homeBouncy, cards), { once: true });
      }
    }
    // Blog
    const blogEl = document.getElementById('hs-blog-bouncy');
    if (blogEl) {
      (async () => {
        try {
          const res = await fetch('dist/substack.json', { cache: 'no-store' });
          if (res.ok) {
            const posts = await res.json();
            const cards = posts.slice(0, 8).map((p, i) => ({
              id: String(i + 1),
              title: (p.title || '').toLowerCase(),
              subtitle: new Date(p.date || Date.now()).toLocaleDateString(),
              url: p.url,
            }));
            if (window.bouncyMount) {
              window.bouncyMount(blogEl, cards);
            } else {
              window.addEventListener('load', () => window.bouncyMount?.(blogEl, cards), { once: true });
            }
          } else {
            throw new Error('no feed');
          }
        } catch (e) {
          const fallback = [
            { id: 'b1', title: 'designing for delight', subtitle: 'writing', url: '#' },
            { id: 'b2', title: 'simple > complex', subtitle: 'writing', url: '#' },
            { id: 'b3', title: 'human-first tech', subtitle: 'writing', url: '#' },
          ];
          if (window.bouncyMount) window.bouncyMount(blogEl, fallback);
        }
      })();
    }
    // Contact form (mailto)
    const form = document.getElementById('hs-contact-form');
    const statusEl = document.getElementById('hs-status');
    if (form && statusEl) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        statusEl.textContent = 'sending…';
        const data = new FormData(form);
        const subject = encodeURIComponent('Portfolio contact');
        const body = encodeURIComponent(`name: ${data.get('name')}\nemail: ${data.get('email')}\n\n${data.get('message')}`);
        window.location.href = `mailto:L28094@gmail.com?subject=${subject}&body=${body}`;
        statusEl.textContent = 'opening your email app…';
      }, { passive: false });
    }
  }

  // Initialize
  // INITIAL STATE: Always start at panel 1 (progress = 0)
  function initializeState() {
    track.style.transform = 'translate3d(0,0,0)';
    if (isSnapMode() || prefersReduced) {
      pathEl.style.strokeDashoffset = '0'; // show full path
    } else {
      pathEl.style.strokeDashoffset = '1'; // hide path initially
    }
  }
  
  // Recalc and set initial state
  recalc();
  initializeState();
  initDynamic();
  
  // Run scroll once to ensure correct state on load
  onScroll();

  const opts = { passive: true };
  window.addEventListener('scroll', onScroll, opts);
  window.addEventListener('resize', onResize, opts);

  // Teardown if needed (not SPA, but safe)
  window.addEventListener('beforeunload', () => {
    window.removeEventListener('scroll', onScroll, opts);
    window.removeEventListener('resize', onResize, opts);
  });
})();


