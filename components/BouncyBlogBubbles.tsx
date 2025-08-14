import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Engine, World, Bodies, Runner, Mouse, MouseConstraint, Body, Composite, Events } from 'matter-js';
import type { Card } from '../types';
import { audio } from '../web/audio';

type Props = {
  cards: Card[];
  height?: number;
};

export default function BouncyBlogBubbles({ cards, height = 420 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<{
    engine: Engine;
    runner: Runner;
    bodiesById: Map<string, Body>;
  } | null>(null);

  // Setup physics world
  useEffect(() => {
    const container = containerRef.current; if (!container) return;
    const engine = Engine.create();
    engine.gravity.y = 1.1;
    const runner = Runner.create();
    Runner.run(runner, engine);

    const bounds = container.getBoundingClientRect();
    const bodiesById = new Map<string, Body>();

    // Walls (left & right) to keep bubbles inside
    const wallThickness = 80;
    const half = wallThickness / 2;
    World.add(engine.world, [
      Bodies.rectangle(-half, bounds.height / 2, wallThickness, bounds.height, { isStatic: true }),
      Bodies.rectangle(bounds.width + half, bounds.height / 2, wallThickness, bounds.height, { isStatic: true }),
    ]);

    // Bowl floor using a large static circle placed below the container
    // Choose a large radius to create a gentle concave arc
    const radius = Math.max(bounds.width * 0.9, bounds.height * 1.2);
    const bowlDepth = Math.min(bounds.height * 0.55, 260); // how far the arc comes up inside
    const cy = bounds.height - bowlDepth + radius;
    const bowl = Bodies.circle(bounds.width / 2, cy, radius, { isStatic: true });
    World.add(engine.world, bowl);

    // Create bubbles
    const minR = 56; const maxR = 84;
    const slots = cards.map((_, i) => ({ x: (i + 1) * (bounds.width / (cards.length + 1)), y: bounds.height * 0.2 }));
    cards.forEach((card, i) => {
      const r = Math.round(minR + Math.random() * (maxR - minR));
      const pos = slots[i] || { x: Math.random() * bounds.width * 0.8 + bounds.width * 0.1, y: bounds.height * 0.2 };
      const body = Bodies.circle(pos.x + (Math.random() - 0.5) * 30, pos.y, r, {
        restitution: 0.8,
        frictionAir: 0.015,
      });
      Body.setVelocity(body, { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 });
      (body as any).radius = r;
      bodiesById.set(card.id, body);
      World.add(engine.world, body);
    });

    // Drag interactions
    const mouse = Mouse.create(container);
    const mouseConstraint = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2 } });
    World.add(engine.world, mouseConstraint);
    // Let page scroll with wheel inside container
    container.addEventListener('wheel', (e) => e.stopImmediatePropagation(), { capture: true });

    // Collision sounds
    Events.on(engine, 'collisionStart', (evt) => {
      const pairs = (evt as any).pairs as Array<any>;
      for (const p of pairs) {
        const a: Body = p.bodyA; const b: Body = p.bodyB;
        const rvx = (a.velocity?.x || 0) - (b.velocity?.x || 0);
        const rvy = (a.velocity?.y || 0) - (b.velocity?.y || 0);
        const impact = Math.hypot(rvx, rvy);
        if (impact > 1.2) audio.collision(Math.min(impact, 20));
      }
    });

    worldRef.current = { engine, runner, bodiesById };
    return () => {
      Runner.stop(runner);
      World.clear(engine.world, false);
      Engine.clear(engine);
      worldRef.current = null;
    };
  }, [cards.length]);

  // Sync DOM nodes with bodies
  useLayoutEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const ref = worldRef.current; const container = containerRef.current; if (!ref || !container) return;
      const nodes = container.querySelectorAll('[data-bubble-id]');
      nodes.forEach((node) => {
        const id = (node as HTMLElement).dataset.bubbleId!;
        const body = ref.bodiesById.get(id); if (!body) return;
        const r = (body as any).radius || 60;
        (node as HTMLElement).style.width = `${r * 2}px`;
        (node as HTMLElement).style.height = `${r * 2}px`;
        (node as HTMLElement).style.transform = `translate3d(${body.position.x - r}px, ${body.position.y - r}px, 0) rotate(${body.angle}rad)`;
      });
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [cards.length]);

  const scrollLeft = () => {
    const container = containerRef.current;
    if (container) {
      container.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    const container = containerRef.current;
    if (container) {
      container.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <div className="blog-container" style={{ position: 'relative' }}>
      <div ref={containerRef} className="blog-bubbles" style={{ width: '100%', height }}>
        {cards.map((c) => (
          <div key={c.id} data-bubble-id={c.id} className="blog-bubble" role="link" tabIndex={0} onClick={() => { audio.click(); window.open(c.url, '_blank', 'noopener'); } }>
            <div className="blog-bubble-title">{(c.title || '').toLowerCase()}</div>
            {c.subtitle ? <div className="blog-bubble-sub">{c.subtitle}</div> : null}
          </div>
        ))}
      </div>
      <button className="blog-arrow blog-arrow-left" onClick={scrollLeft} aria-label="Scroll left">‹</button>
      <button className="blog-arrow blog-arrow-right" onClick={scrollRight} aria-label="Scroll right">›</button>
    </div>
  );
}


