/**
 * hs-scroller-gsap.js
 * GSAP + ScrollTrigger powered horizontal scroller
 * 
 * Features:
 * - Professional scroll-driven animation with GSAP
 * - Progressive navigation enhancement
 * - Deep linking support with hash URLs
 * - SVG line reveal animation
 * - Mobile fallback to native horizontal scroll
 * - Reduced motion support
 * - Debug logging (set window.__HS_DEBUG__ = true)
 */

(function() {
  'use strict';
  
  // Debug flag - set window.__HS_DEBUG__ = true to enable logging
  const DEBUG = window.__HS_DEBUG__ || false;
  const log = (...args) => DEBUG && console.log('[HS-Scroller]', ...args);
  
  /**
   * Initialize and run world clock
   */
  function initWorldClock() {
    function updateClocks() {
      const now = new Date();
      
      // San Francisco (PST/PDT - UTC-8/-7)
      const sfTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
      
      // London (GMT/BST - UTC+0/+1)
      const londonTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/London"}));
      
      // Format time as HH:MM:SS
      const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
      };
      
      // Update DOM elements
      const sfElement = document.getElementById('time-sf');
      const londonElement = document.getElementById('time-london');
      
      if (sfElement) sfElement.textContent = formatTime(sfTime);
      if (londonElement) londonElement.textContent = formatTime(londonTime);
    }
    
    // Update immediately and then every second
    updateClocks();
    setInterval(updateClocks, 1000);
    
    log('World clock initialized');
  }
  
  // Start the world clock immediately
  initWorldClock();
  
  // Expose navigation functions for debugging and external access
  window.hsDebug = {
    seekToPanel: null, // Will be set when function is defined
    mainTimeline: null, // Will be set when timeline is created
    testNavigation: function(panelId) {
      console.log('[TEST] Testing navigation to:', panelId);
      const element = document.getElementById(panelId);
      console.log('[TEST] Panel element found:', !!element);
      if (this.seekToPanel) {
        this.seekToPanel(panelId);
      } else {
        console.log('[TEST] seekToPanel function not available');
      }
    }
  };
  
  // Check for GSAP and required elements
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.error('[HS-Scroller] GSAP or ScrollTrigger not found');
    return;
  }
  
  const section = document.querySelector('.hs-section');
  const stage = document.querySelector('.hs-stage');
  const track = document.querySelector('.hs-track');
  const panels = document.querySelectorAll('.hs-panel');
  const progressLine = document.querySelector('.nav-progress-line');
  const navItems = document.querySelectorAll('.nav-item');
  
  if (!section || !stage || !track || !panels.length) {
    log('Required elements not found, aborting');
    return;
  }
  
  // Configuration
  const CONFIG = {
    // SVG path configuration
    svgPath: "M 50 300 Q 200 200 350 300 Q 500 400 650 300 Q 800 200 950 300 Q 1100 400 1250 300 Q 1400 200 1450 300",
    svgStrokeWidth: 2.5,
    
    // Animation settings
    snapDuration: 0.8,
    mobileBreakpoint: 768,
    
    // Panel mapping for navigation
    panelMap: {
      'home': 0,
      'about': 1, 
      'projects': 2,
      'blog': 3,
      'contact': 4
    }
  };
  
  // Register ScrollTrigger
  gsap.registerPlugin(ScrollTrigger);
  
  // Check for reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // Check if mobile and handle mobile initialization
  const isMobile = () => {
    const width = window.innerWidth;
    const mobile = width <= CONFIG.mobileBreakpoint;
    log('Mobile check:', { width, breakpoint: CONFIG.mobileBreakpoint, isMobile: mobile });
    
    if (mobile && stage) {
      // Mobile: vertical stacking handled by CSS. Just clear transforms.
      stage.removeAttribute('data-pinned');
      gsap.set(track, { clearProps: 'transform' });
      track.style.scrollSnapType = '';
      Array.from(panels).forEach(panel => {
        panel.style.scrollSnapAlign = '';
        panel.style.scrollSnapStop = '';
        panel.style.minWidth = '';
      });
    }
    
    return mobile;
  };
  
  // Global references
  let mainTimeline;
  let svgLength;
  let activePanel = 0;
  let heroOffsetPx = 140; // target top offset to match inner pages
  let heroStartOffsetPx = 0; // center-aligned start
  
  /**
   * Update navigation progress line - grows like status indicator
   */
  function updateNavProgress(activePanel) {
    if (!navItems.length) return;

    // Remove and set active state
    navItems.forEach(item => item.classList.remove('active'));
    const panelId = getPanelId(activePanel);
    const activeNavItem = document.querySelector(`[data-panel="${panelId}"]`);
    if (activeNavItem) activeNavItem.classList.add('active');

    // Update optional label near the stack and moving focus outline
    const parentEl = document.querySelector('.nav-container');
    if (!parentEl) return;

    let label = document.querySelector('.nav-stack-label');
    if (!label) {
      label = document.createElement('div');
      label.className = 'nav-stack-label';
      parentEl.appendChild(label);
    }
    label.textContent = panelId;
    // Default label color matches clock text; keep highlight logic simple
    label.style.color = '#666';

    // Ensure focus square exists
    let focus = document.querySelector('.nav-focus');
    if (!focus) {
      focus = document.createElement('div');
      focus.className = 'nav-focus';
      parentEl.appendChild(focus);
    }
    // If the DOM anchors are the fancy gooey SVG, skip focus-box alignment but
    // still broadcast the active panel so gooey nav can mirror it via window.hsDebug
    if (!activeNavItem) {
      try { window.dispatchEvent(new CustomEvent('hs:active-panel', { detail: { index: activePanel, id: panelId } })); } catch (e) {}
      return;
    }
    const targetRect = activeNavItem.getBoundingClientRect();
    const parentRect = parentEl.getBoundingClientRect();
    const x = targetRect.left - parentRect.left - 4;
    const y = targetRect.top - parentRect.top - 4;
    focus.style.transform = `translate(${x}px, ${y}px)`;

    // Align label horizontally centered under the active dot (row at top-right)
    const labelX = targetRect.left - parentRect.left + targetRect.width / 2;
    const labelEl = label;
    const labelWidth = labelEl.getBoundingClientRect().width;
    labelEl.style.transform = `translate(${labelX - labelWidth / 2}px, 0)`;
    // Ensure color remains the standard dark grey under the active dot
    labelEl.style.color = '#666';

    // Notify external nav (gooey) about the active panel
    try { window.dispatchEvent(new CustomEvent('hs:active-panel', { detail: { index: activePanel, id: panelId } })); } catch (e) {}
  }
  
  /**
   * Create horizontal scroll animation with GSAP
   */
  function createScrollAnimation() {
    log('createScrollAnimation called');
    
    if (isMobile() || prefersReducedMotion) {
      log('Skipping GSAP animation for mobile or reduced motion');
      return;
    }
    
    log('Environment check passed, creating GSAP animation');
    
    const panelCount = panels.length;
    log('Panel count:', panelCount);
    log('Panel IDs in order:', Array.from(panels).map(p => p.id));
    
    // Mark stage as pinned to allow GSAP transforms
    stage.setAttribute('data-pinned', 'true');
    
    // Force initial positioning to show first panel
    // The track naturally positions with an offset due to flexbox layout
    // We need to calculate and apply a correction to show the home panel at x=0
    
    // First, clear any existing transforms
    gsap.set(track, { clearProps: "transform" });
    
    // Get the track's natural position without any transforms
    const naturalRect = track.getBoundingClientRect();
    const naturalOffset = naturalRect.x;
    log('Natural track offset:', naturalOffset);

    // Calculate correction needed to position home panel at x=0
    let correctionOffset = -naturalOffset;
    gsap.set(track, { x: correctionOffset, force3D: true });
    log('Applied correction offset:', correctionOffset);
    
    // Verify the correction worked
    const correctedRect = track.getBoundingClientRect();
    log('After correction - track position:', correctedRect.x);
    
    // Compute hero vertical offsets
    const heroPanel = document.querySelector('.hs-panel--hero .hs-inner');
    const stageRect = stage.getBoundingClientRect();
    const heroRect = heroPanel ? heroPanel.getBoundingClientRect() : null;
    // center start: (viewportH - heroHeight)/2 relative to stage top
    if (heroRect) {
      const viewportH = window.innerHeight;
      const heroHeight = heroRect.height;
      heroStartOffsetPx = Math.max(0, (viewportH - heroHeight) / 2);
    } else {
      heroStartOffsetPx = 0;
    }

    // Create main timeline
    mainTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${(panelCount - 1) * window.innerHeight}`,
        scrub: 1,
        pin: stage,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const progress = self.progress;
          activePanel = Math.round(progress * (panelCount - 1));
          
          // Transform calculation with correction offset
          const scrollOffset = -(progress * (panelCount - 1) * window.innerWidth);
          const targetX = correctionOffset + scrollOffset;
          gsap.set(track, { x: targetX, force3D: true });

          // During the first panel portion of progress, ease hero from centered to 140px top
          if (heroPanel) {
            const panelsSpan = (panelCount - 1);
            const perPanelProgress = panelsSpan > 0 ? (progress * panelsSpan) : 0; // 0..N panels
            const heroPhase = Math.max(0, Math.min(1, perPanelProgress)); // clamp to first panel [0,1]
            const eased = gsap.parseEase('power2.out')(heroPhase);
            const currentTop = heroStartOffsetPx + (heroOffsetPx - heroStartOffsetPx) * eased;
            gsap.set(heroPanel, { paddingTop: 0 });
            gsap.set(heroPanel.parentElement, { alignItems: 'flex-start' });
            gsap.set(heroPanel, { y: currentTop });
          }
          
          if (window.__HS_DEBUG__) {
            console.log('[HS-Scroller] Progress:', progress.toFixed(3), 'Active panel:', activePanel, 'Panel ID:', getPanelId(activePanel), 'Target X:', targetX + 'px');
          }
          
          // Update navigation progress
          updateNavProgress(activePanel);
          // Broadcast smooth progress for gooey nav animation
          try { window.dispatchEvent(new CustomEvent('hs:scroll-progress', { detail: { progress } })); } catch (e) {}
          
          // Update browser hash without triggering scroll
          updateHashWithoutScroll(getPanelId(activePanel));
        },
        onRefresh: () => {
          log('ScrollTrigger refreshed');
          // Recalculate correction offset
          gsap.set(track, { clearProps: "transform" });
          const refreshRect = track.getBoundingClientRect();
          const refreshOffset = refreshRect.x;
          correctionOffset = -refreshOffset;
          gsap.set(track, { x: correctionOffset, force3D: true });
          log('Refresh correction applied:', correctionOffset);

          // Recalculate hero start offset on resize/refresh
          const heroPanelNow = document.querySelector('.hs-panel--hero .hs-inner');
          const heroRectNow = heroPanelNow ? heroPanelNow.getBoundingClientRect() : null;
          if (heroRectNow) {
            const viewportH = window.innerHeight;
            const heroHeight = heroRectNow.height;
            heroStartOffsetPx = Math.max(0, (viewportH - heroHeight) / 2);
          } else {
            heroStartOffsetPx = 0;
          }
        }
      }
    });
    
    log('GSAP animation created with offset correction');
    
    // Expose timeline for debugging
    window.hsDebug.mainTimeline = mainTimeline;
  }
  
  /**
   * Get panel ID by index
   */
  function getPanelId(index) {
    const panel = panels[index];
    return panel ? panel.id : 'home';
  }
  
  /**
   * Get panel index by ID
   */
  function getPanelIndex(id) {
    return CONFIG.panelMap[id] || 0;
  }
  
  /**
   * Update hash without triggering scroll
   */
  function updateHashWithoutScroll(panelId) {
    if (history.replaceState) {
      const newUrl = `${window.location.pathname}#${panelId}`;
      history.replaceState(null, null, newUrl);
    }
  }
  
  /**
   * Seek to specific panel
   */
  function seekToPanel(panelId, animate = true) {
    console.log('[HS-Scroller] seekToPanel called with:', panelId, 'animate:', animate);
    console.log('[HS-Scroller] Current state:', {
      isMobile: isMobile(),
      prefersReducedMotion,
      mainTimelineExists: !!mainTimeline,
      panelsLength: panels ? panels.length : 0
    });

    const index = getPanelIndex(panelId);
    const clampedIndex = Math.max(0, Math.min(panels.length - 1, index));
    const totalPanels = Math.max(1, panels.length - 1);
    const progress = clampedIndex / totalPanels;

    // Compute the document Y position that corresponds to desired progress
    const sectionRect = section.getBoundingClientRect();
    const sectionTop = sectionRect.top + window.pageYOffset;
    const scrollDistance = totalPanels * window.innerHeight; // matches ScrollTrigger end
    const targetY = sectionTop + progress * scrollDistance;

    console.log('[HS-Scroller] Calculated scroll targetY:', targetY, 'sectionTop:', sectionTop, 'scrollDistance:', scrollDistance);

    // Always drive navigation by scrolling the document.
    // This ensures ScrollTrigger's onUpdate runs and applies transforms.
    try {
      if (animate && !prefersReducedMotion) {
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      } else {
        window.scrollTo(0, targetY);
      }
    } catch (e) {
      // Fallback for older browsers
      window.scrollTo(0, targetY);
    }

    activePanel = clampedIndex;
  }
  
  // Expose seekToPanel for external access
  window.hsDebug.seekToPanel = seekToPanel;
  
  /**
   * Handle navigation clicks
   */
  function initNavigation() {
    const navItems = document.querySelectorAll('[data-panel]');
    log('Found nav items:', navItems.length);
    
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const panelId = item.getAttribute('data-panel');
        log('Nav item clicked:', panelId);
        
        // Prevent default navigation when the horizontal scroller exists on the page
        // (works regardless of hosting path, e.g. subfolders or static hosting)
        const hasHorizontalScroller = !!document.querySelector('.hs-section');
        if (hasHorizontalScroller) {
          e.preventDefault();
          
          // Update the URL hash first
          const newUrl = `${window.location.pathname}#${panelId}`;
          window.history.pushState(null, null, newUrl);
          log('Updated URL to:', newUrl);
          
          // Then navigate to the panel
          log('Navigation check:', {
            mainTimelineExists: !!mainTimeline,
            isMobile: isMobile(),
            prefersReducedMotion,
            panelId
          });
          
          if (mainTimeline && !isMobile()) {
            console.log('[HS-Scroller] Using GSAP navigation for:', panelId);
            seekToPanel(panelId);
          } else {
            log('Using mobile/fallback scroll navigation');
            const targetPanel = document.getElementById(panelId);
            if (targetPanel) {
              // On mobile (vertical stack), use vertical scrollIntoView
              targetPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
              log('Vertical scroll into view:', panelId);
            } else {
              log('Target panel not found:', panelId);
            }
          }
        }
        // On other pages, let the link navigate normally
      });
    });
    
    log('Navigation initialized with', navItems.length, 'items');
  }
  
  /**
   * Handle deep linking from URL hash
   */
  function handleDeepLink() {
    const hash = window.location.hash.slice(1);
    if (hash && CONFIG.panelMap.hasOwnProperty(hash)) {
      log('Deep link detected:', hash);
      // Wait until the timeline is ready (or fall back to native)
      const maxWaitMs = 2000;
      const stepMs = 100;
      let waited = 0;
      const trySeek = () => {
        if (mainTimeline || isMobile() || prefersReducedMotion) {
          seekToPanel(hash, false);
        } else if (waited < maxWaitMs) {
          waited += stepMs;
          setTimeout(trySeek, stepMs);
        } else {
          // Last resort fallback
          const target = document.getElementById(hash);
          target?.scrollIntoView({ behavior: 'smooth' });
        }
      };
      trySeek();
    }
  }
  
  /**
   * Handle browser back/forward
   */
  function initPopState() {
    window.addEventListener('popstate', () => {
      const hash = window.location.hash.slice(1) || 'home';
      log('Popstate event, navigating to:', hash);
      seekToPanel(hash, true);
    });
  }
  
  /**
   * Initialize dynamic content (projects, blog, contact)
   */
  function initDynamicContent() {
    // Projects
    const projectsEl = document.getElementById('hs-projects-bouncy');
    if (projectsEl) {
      const mountProjectsIfReady = () => {
        if (window.mountProjects) {
          window.mountProjects(projectsEl);
          log('Projects mounted');
        } else {
          // Fallback: wait for window load
          projectsEl.innerHTML = '<p class="muted">loading projects…</p>';
          window.addEventListener('load', () => {
            if (window.mountProjects) {
              window.mountProjects(projectsEl);
              log('Projects mounted after load');
            }
          }, { once: true });
        }
      };
      mountProjectsIfReady();
    }
    
    // Blog: prefer 3D books shelf if available
    const blogEl = document.getElementById('hs-blog-bouncy');
    if (blogEl) {
      (async () => {
        // Build cards first
        let cards = [];
        try {
          const res = await fetch('dist/substack.json', { cache: 'no-store' });
          const posts = res.ok ? await res.json() : [];
          cards = posts.slice(0, 12).map((p, i) => ({
            id: String(i + 1),
            title: (p.title || '').toLowerCase(),
            subtitle: new Date(p.date || Date.now()).toLocaleDateString(),
            url: p.url || '#',
          }));
        } catch (e) {
          cards = [
            { id: 'b1', title: 'designing for delight', subtitle: 'writing', url: '#' },
            { id: 'b2', title: 'simple > complex', subtitle: 'writing', url: '#' },
            { id: 'b3', title: 'human-first tech', subtitle: 'writing', url: '#' },
          ];
        }

        const mountShelf = () => window.mountBooksShelf?.(blogEl, cards);

        if (window.mountBooksShelf) {
          mountShelf();
        } else {
          // Wait until after window load (script order) then try
          window.addEventListener('load', () => {
            setTimeout(() => {
              if (window.mountBooksShelf) mountShelf();
              else if (window.mountBlogBubbles) window.mountBlogBubbles(blogEl);
              else loadBlogContent(blogEl);
            }, 0);
          }, { once: true });
        }
      })();
    }
    
    // Contact form
    const contactForm = document.getElementById('hs-contact-form');
    if (contactForm) {
      initContactForm(contactForm);
    }
  }
  
  /**
   * Load blog content
   */
  async function loadBlogContent(container) {
    try {
      const response = await fetch('dist/substack.json');
      const posts = await response.json();
      
      const cards = posts.slice(0, 8).map((post, i) => ({
        id: String(i + 1),
        title: (post.title || '').toLowerCase(),
        subtitle: new Date(post.date || Date.now()).toLocaleDateString(),
        url: post.url
      }));
      
      if (window.bouncyMount) {
        window.bouncyMount(container, cards);
        log('Blog content mounted');
      } else {
        // Fallback: wait for window load
        window.addEventListener('load', () => {
          if (window.bouncyMount) {
            window.bouncyMount(container, cards);
            log('Blog content mounted after load');
          }
        }, { once: true });
      }
    } catch (error) {
      log('Blog loading failed, using fallback');
      const fallback = [
        { id: 'b1', title: 'designing for delight', subtitle: 'writing', url: '#' },
        { id: 'b2', title: 'simple > complex', subtitle: 'writing', url: '#' },
        { id: 'b3', title: 'human-first tech', subtitle: 'writing', url: '#' }
      ];
      
      if (window.bouncyMount) {
        window.bouncyMount(container, fallback);
      } else {
        window.addEventListener('load', () => {
          if (window.bouncyMount) window.bouncyMount(container, fallback);
        }, { once: true });
      }
    }
  }
  
  /**
   * Initialize contact form
   */
  function initContactForm(form) {
    const statusEl = document.getElementById('hs-status');
    
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      if (statusEl) statusEl.textContent = 'sending…';
      
      const formData = new FormData(form);
      const subject = encodeURIComponent('Portfolio contact');
      const body = encodeURIComponent(
        `name: ${formData.get('name')}\nemail: ${formData.get('email')}\n\n${formData.get('message')}`
      );
      
      window.location.href = `mailto:L28094@gmail.com?subject=${subject}&body=${body}`;
      
      if (statusEl) statusEl.textContent = 'opening your email app…';
    });
    
    log('Contact form initialized');
  }
  
  /**
   * Handle resize
   */
  function handleResize() {
    // Refresh ScrollTrigger on resize
    if (!isMobile() && ScrollTrigger) {
      ScrollTrigger.refresh();
      log('ScrollTrigger refreshed on resize');
    }
  }
  
  /**
   * Initialize everything
   */
  function init() {
    log('Initializing HS Scroller with GSAP');
    
    try {
      // Debug: Log panel information
      log('Panel debugging:', {
        panelCount: panels.length,
        panelIds: Array.from(panels).map(p => p.id),
        trackWidth: track.style.width || getComputedStyle(track).width
      });
      
      log('Setting up navigation progress tracking');
      
      // Create scroll animation (unless mobile/reduced motion)
      log('Checking mobile/reduced motion:', { isMobile: isMobile(), prefersReducedMotion });
      if (!isMobile() && !prefersReducedMotion) {
        log('Calling createScrollAnimation');
        createScrollAnimation();
        log('createScrollAnimation completed');
      } else {
        log('Using native scroll mode');
      }
    } catch (error) {
      console.error('[HS-Scroller] Error in animation setup:', error);
    }
    
    // Initialize navigation
    initNavigation();
    
    // Handle deep links
    handleDeepLink();
    
    // Handle popstate
    initPopState();
    
    // Initialize dynamic content
    initDynamicContent();
    
    // Handle resize
    window.addEventListener('resize', handleResize);
    
    log('HS Scroller initialized successfully');
  }
  
  // Initialize when DOM is ready, with a small delay to ensure bundle.js is loaded
  function delayedInit() {
    // Small delay to ensure dist/bundle.js has loaded and defined global functions
    setTimeout(() => {
      console.log('[HS-Scroller] Starting delayed initialization...');
      init();
    }, 100);
  }
  
  // Expose init for debugging
  window.hsInit = init;
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', delayedInit);
  } else {
    delayedInit();
  }
  
})();
