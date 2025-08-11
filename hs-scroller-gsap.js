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
  
  // Check for GSAP and required elements
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.error('[HS-Scroller] GSAP or ScrollTrigger not found');
    return;
  }
  
  const section = document.querySelector('.hs-section');
  const stage = document.querySelector('.hs-stage');
  const track = document.querySelector('.hs-track');
  const panels = document.querySelectorAll('.hs-panel');
  const svgPath = document.querySelector('#hs-path');
  
  if (!section || !stage || !track || !panels.length || !svgPath) {
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
  
  // Check if mobile
  const isMobile = () => window.innerWidth <= CONFIG.mobileBreakpoint;
  
  // Global references
  let mainTimeline;
  let svgLength;
  let activePanel = 0;
  
  /**
   * Initialize SVG path
   */
  function initSVG() {
    svgPath.setAttribute('d', CONFIG.svgPath);
    svgPath.style.strokeWidth = CONFIG.svgStrokeWidth;
    
    // Measure path length for animation
    svgLength = svgPath.getTotalLength();
    log('SVG path length:', svgLength);
    
    if (prefersReducedMotion) {
      // Show full path immediately for reduced motion
      svgPath.style.strokeDasharray = 'none';
      svgPath.style.strokeDashoffset = '0';
    } else {
      // Set up for dash animation
      svgPath.style.strokeDasharray = svgLength;
      svgPath.style.strokeDashoffset = svgLength;
    }
  }
  
  /**
   * Create horizontal scroll animation with GSAP
   */
  function createScrollAnimation() {
    if (isMobile() || prefersReducedMotion) {
      log('Skipping GSAP animation for mobile or reduced motion');
      return;
    }
    
    const panelCount = panels.length;
    log('Panel count:', panelCount);
    log('Panel IDs in order:', Array.from(panels).map(p => p.id));
    
    // Mark stage as pinned to allow GSAP transforms
    stage.setAttribute('data-pinned', 'true');
    
    // Force track to start at position 0 (show first panel)
    gsap.set(track, { x: 0, force3D: true });
    
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
          
          // Manual transform calculation to ensure accuracy
          const targetX = -(progress * (panelCount - 1) * window.innerWidth); // px units
          gsap.set(track, { x: targetX, force3D: true });
          
          if (window.__HS_DEBUG__) {
            console.log('[HS-Scroller] Progress:', progress.toFixed(3), 'Active panel:', activePanel, 'Panel ID:', getPanelId(activePanel), 'Target X:', targetX + 'px');
          }
          
          // Update SVG animation
          if (!prefersReducedMotion && svgPath) {
            const dashOffset = svgLength * (1 - progress);
            svgPath.style.strokeDashoffset = dashOffset;
          }
          
          // Update browser hash without triggering scroll
          updateHashWithoutScroll(getPanelId(activePanel));
        },
        onRefresh: () => {
          log('ScrollTrigger refreshed');
          // Ensure we start at the correct position after refresh
          gsap.set(track, { x: 0, force3D: true });
        }
      }
    });
    
    log('GSAP animation created with manual transforms');
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
    if (isMobile() || prefersReducedMotion || !mainTimeline) {
      log('Seeking disabled for mobile/reduced motion');
      return;
    }
    
    const index = getPanelIndex(panelId);
    const progress = index / (panels.length - 1);
    
    log('Seeking to panel:', panelId, 'Index:', index, 'Progress:', progress);
    
    if (animate) {
      gsap.to(mainTimeline, {
        progress: progress,
        duration: CONFIG.snapDuration,
        ease: 'power2.inOut'
      });
    } else {
      mainTimeline.progress(progress);
    }
    
    activePanel = index;
  }
  
  /**
   * Handle navigation clicks
   */
  function initNavigation() {
    const navItems = document.querySelectorAll('[data-panel]');
    
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const panelId = item.getAttribute('data-panel');
        
        // Only intercept on index.html with working scroller
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
          if (mainTimeline && !isMobile()) {
            e.preventDefault();
            seekToPanel(panelId);
            log('Nav click intercepted for panel:', panelId);
          }
        }
        // Otherwise, let the link navigate normally to the standalone page
      });
    });
    
    log('Navigation initialized');
  }
  
  /**
   * Handle deep linking from URL hash
   */
  function handleDeepLink() {
    const hash = window.location.hash.slice(1);
    if (hash && CONFIG.panelMap.hasOwnProperty(hash)) {
      log('Deep link detected:', hash);
      // Small delay to ensure GSAP is ready
      gsap.delayedCall(0.1, () => seekToPanel(hash, false));
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
    
    // Blog
    const blogEl = document.getElementById('hs-blog-bouncy');
    if (blogEl) {
      loadBlogContent(blogEl);
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
    
    // Debug: Log panel information
    log('Panel debugging:', {
      panelCount: panels.length,
      panelIds: Array.from(panels).map(p => p.id),
      trackWidth: track.style.width || getComputedStyle(track).width
    });
    
    // Initialize SVG
    initSVG();
    
    // Create scroll animation (unless mobile/reduced motion)
    if (!isMobile() && !prefersReducedMotion) {
      createScrollAnimation();
    } else {
      log('Using native scroll mode');
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
    setTimeout(init, 100);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', delayedInit);
  } else {
    delayedInit();
  }
  
})();
