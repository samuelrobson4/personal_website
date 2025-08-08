import React from 'react';
import { createRoot } from 'react-dom/client';
import BouncyProjectCards from '../components/BouncyProjectCards';
import type { Card } from '../types';

declare global { interface Window { bouncyMount?: (el: HTMLElement, cards: Card[]) => void; renderSubstack?: (el: HTMLElement) => void; mountProjects?: (el: HTMLElement) => void } }

function mount(el: HTMLElement, cards: Card[]) {
  const root = createRoot(el);
  root.render(
    <BouncyProjectCards
      cards={cards}
      width="100%"
      height={520}
      restitution={0.9}
      airFriction={0.02}
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


