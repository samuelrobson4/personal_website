import React from 'react';
import { createRoot } from 'react-dom/client';
import BouncyProjectCards from '../components/BouncyProjectCards';
import BouncyBlogBubbles from '../components/BouncyBlogBubbles';
import type { Card } from '../types';

// Responsive height calculation based on screen size
function getResponsiveHeight(): number {
  const width = window.innerWidth;
  
  // Mobile (up to 768px)
  if (width <= 768) {
    return Math.min(400, window.innerHeight * 0.6); // 60% of viewport height, max 400px
  }
  
  // Tablet (768px - 1024px)
  if (width <= 1024) {
    return Math.min(480, window.innerHeight * 0.65); // 65% of viewport height, max 480px
  }
  
  // Desktop (1024px+) - set to 480px as requested
  return 480;
}

// Responsive width calculation
function getResponsiveWidth(): string {
  const width = window.innerWidth;
  
  // Mobile (up to 768px)
  if (width <= 768) {
    return '100%'; // Full width on mobile
  }
  
  // Tablet and Desktop (768px+)
  return '100%'; // 90% width as requested
}

declare global { interface Window { bouncyMount?: (el: HTMLElement, cards: Card[]) => void; renderSubstack?: (el: HTMLElement) => void; mountProjects?: (el: HTMLElement) => void; mountBlogBubbles?: (el: HTMLElement) => void } }

function mount(el: HTMLElement, cards: Card[]) {
  const root = createRoot(el);
  root.render(
    <BouncyProjectCards
      cards={cards}
      width={getResponsiveWidth()}
      height={getResponsiveHeight()}
      restitution={0.95}
      airFriction={0.015}
      hoverScale={1.03}
    />
  );
}

window.bouncyMount = mount;

async function renderSubstackList(el: HTMLElement) {
  try {
    const res = await fetch('dist/substack.json', { cache: 'no-store' });
    if (!res.ok) return;
    const posts: Array<{ id: string; title: string; url: string; date?: string; excerpt?: string }> = await res.json();
    el.innerHTML = posts
      .map(
        (p) => `
      <article class="post">
        <h3><a href="${p.url}" target="_blank" rel="noopener">${p.title}</a></h3>
        <p class="muted">${p.excerpt || ''}</p>
      </article>
    `
      )
      .join('');
  } catch {}
}

window.renderSubstack = (el: HTMLElement) => { renderSubstackList(el); };

// Projects loader from data/projects.json
async function mountProjects(el: HTMLElement) {
  try {
    const res = await fetch('data/projects.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('projects not found');
    const cards: Card[] = await res.json();
    mount(el, cards);
  } catch (e) {
    // fallback to empty
    el.innerHTML = '<p class="muted">No projects found. Add them to data/projects.json.</p>';
  }
}

window.mountProjects = mountProjects;

// Public mount for blog bubbles
(window as any).mountBlogBubbles = async (el: HTMLElement) => {
  try {
    const res = await fetch('dist/substack.json', { cache: 'no-store' });
    const posts = await res.json();
    const cards: Card[] = posts.slice(0, 8).map((p: any, i: number) => ({
      id: String(i + 1),
      title: p.title || '',
      subtitle: new Date(p.date || Date.now()).toLocaleDateString(),
      url: p.url || '#'
    }));
    const root = createRoot(el);
    root.render(<BouncyBlogBubbles cards={cards} />);
  } catch (e) {
    el.innerHTML = '<p class="muted">Unable to load blog posts.</p>';
  }
};

// Audio UI removed; interaction sounds only are kept within components


