import React, { useEffect, useLayoutEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Matter, { Engine, World, Bodies, Runner, Mouse, MouseConstraint, Body, Events, Composite } from 'matter-js';
import type { Card } from '../types';
import { audio } from '../web/audio';

type Props = {
  cards: Card[];
  width?: number | string;
  height?: number;
  restitution?: number;
  airFriction?: number;
  hoverScale?: number;
  onCardClick?: (card: Card) => void;
};

export type BouncyProjectCardsRef = {
  shuffle: () => void;
  addCard: (card: Card) => void;
};

function getCssCardSize(container: HTMLElement) {
  const styles = getComputedStyle(container);
  const w = parseFloat(styles.getPropertyValue('--card-w')) || 260;
  const h = parseFloat(styles.getPropertyValue('--card-h')) || 140;
  return { w, h };
}

export const BouncyProjectCards = forwardRef<BouncyProjectCardsRef, Props>(function BouncyProjectCards(
  {
    cards,
    width = '100%',
    height = 520,
    restitution = 0.98,
    airFriction = 0.005,
    hoverScale = 1.03,
    onCardClick,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<{
    engine: Engine;
    runner: Runner;
    mouse?: Mouse;
    mouseConstraint?: MouseConstraint;
    bodiesById: Map<string, Body>;
    isDraggingId?: string;
  } | null>(null);

  // Initialize matter world
  useEffect(() => {
    if (!containerRef.current) return;
    const engine = Engine.create();
    engine.gravity.y = 0;
    const runner = Runner.create();
    Runner.run(runner, engine);

    const container = containerRef.current;
    const bounds = container.getBoundingClientRect();
    let cardSize = getCssCardSize(container);

    // walls
    const thickness = 50;
    const half = thickness / 2;
    const opts = { isStatic: true, restitution } as const;
    const walls = [
      Bodies.rectangle(bounds.width / 2, -half, bounds.width, thickness, opts),
      Bodies.rectangle(bounds.width / 2, bounds.height + half, bounds.width, thickness, opts),
      Bodies.rectangle(-half, bounds.height / 2, thickness, bounds.height, opts),
      Bodies.rectangle(bounds.width + half, bounds.height / 2, thickness, bounds.height, opts),
    ];
    World.add(engine.world, walls);

    const bodiesById = new Map<string, Body>();
    const positions: { x: number; y: number }[] = [];

    function nextFreePosition(index: number) {
      // Centered default layout: two rows around vertical middle, columns centered horizontally
      const gapX = 28;
      const rows = 2;
      const columns = Math.ceil(cards.length / rows);
      const usedWidth = columns * (cardSize.w + gapX) - gapX;
      const startX = Math.max(60, (bounds.width - usedWidth) / 2);
      const col = Math.floor(index / rows);
      const row = index % rows; // 0 or 1
      const x = startX + col * (cardSize.w + gapX) + (Math.random() - 0.5) * 12;

      // Vertical positioning uses a percentage of container height (not fixed px)
      const topBandPercent = 0.14; // 14% from the top for the first row
      const topBand = bounds.height * topBandPercent;
      const rowGapY = cardSize.h + 6;
      const startY = topBand; // row 0
      const yBase = startY + row * rowGapY; // row 1 slightly below
      const margin = Math.max(20, Math.min(60, bounds.height * 0.08));
      const y = Math.min(Math.max(yBase + (Math.random() - 0.5) * 10, margin), bounds.height - margin);
      return { x: Math.min(Math.max(x, 60), bounds.width - 60), y };
    }

    cards.forEach((card, i) => {
      const pos = nextFreePosition(i);
      positions.push(pos);
      const body = Bodies.rectangle(pos.x, pos.y, cardSize.w, cardSize.h, {
        restitution,
        frictionAir: airFriction,
        angle: (Math.random() - 0.5) * 0.06,
      });
      Body.setVelocity(body, { x: (Math.random() - 0.5) * 2.2, y: (Math.random() - 0.5) * 2.2 });
      bodiesById.set(card.id, body);
      World.add(engine.world, body);
    });

    // Mouse drag
    const mouse = Mouse.create(container);
    // Ensure page scrolling works over the canvas area
    // Stop Matter's wheel handler from preventing default scrolling
    container.addEventListener(
      'wheel',
      (e) => {
        // Do not prevent default; just stop Matter's listener
        e.stopImmediatePropagation();
      },
      { capture: true }
    );
    const mouseConstraint = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2 } });
    World.add(engine.world, mouseConstraint);

    Events.on(mouseConstraint, 'startdrag', (e: any) => {
      const body = e.body as Body;
      for (const [id, b] of bodiesById.entries()) {
        if (b === body) {
          worldRef.current!.isDraggingId = id;
          b.frictionAir = Math.max(airFriction, 0.08);
          break;
        }
      }
    });
    Events.on(mouseConstraint, 'enddrag', (e: any) => {
      const body = e.body as Body;
      for (const [id, b] of bodiesById.entries()) {
        if (b === body) {
          worldRef.current!.isDraggingId = undefined;
          b.frictionAir = airFriction;
          break;
        }
      }
    });

    // Collision sounds removed: keep site to click-only SFX

    worldRef.current = { engine, runner, mouse, mouseConstraint, bodiesById };

    // Clean up
    return () => {
      if (worldRef.current) {
        Runner.stop(worldRef.current.runner);
        World.clear(worldRef.current.engine.world, false);
        Engine.clear(worldRef.current.engine);
        (worldRef.current as any) = null;
      }
    };
  }, []);

  // Gentle idle motion so cards settle but remain draggable
  useEffect(() => {
    const interval = window.setInterval(() => {
      const ref = worldRef.current; if (!ref) return;
      for (const [id, body] of ref.bodiesById.entries()) {
        if (ref.isDraggingId === id) continue;
        const speed = Math.hypot(body.velocity.x, body.velocity.y);
        if (speed < 0.4) {
          const angle = Math.random() * Math.PI * 2;
          const magnitude = 0.0006; // tiny nudge
          Body.applyForce(body, body.position, { x: Math.cos(angle) * magnitude, y: Math.sin(angle) * magnitude });
          Body.setAngularVelocity(body, body.angularVelocity + (Math.random() - 0.5) * 0.002);
        }
      }
    }, 1100);
    return () => window.clearInterval(interval);
  }, []);

  // Sync DOM with bodies
  useLayoutEffect(() => {
    let raf = 0;
    function tick() {
      raf = requestAnimationFrame(tick);
      const ref = worldRef.current;
      const container = containerRef.current;
      if (!ref || !container) return;
      const size = getCssCardSize(container);
      const nodes = container.querySelectorAll('[data-card-id]');
      const b = container.getBoundingClientRect();
      nodes.forEach((node) => {
        const id = (node as HTMLElement).dataset.cardId!;
        const body = ref.bodiesById.get(id);
        if (!body) return;
        // Cap velocities tighter
        body.velocity.x = Math.max(Math.min(body.velocity.x, 6), -6);
        body.velocity.y = Math.max(Math.min(body.velocity.y, 6), -6);
        // Clamp bodies strictly inside bounds to avoid drifting off-page
        const halfW = size.w / 2; const halfH = size.h / 2;
        let px = body.position.x; let py = body.position.y;
        if (px < halfW) px = halfW; else if (px > b.width - halfW) px = b.width - halfW;
        if (py < halfH) py = halfH; else if (py > b.height - halfH) py = b.height - halfH;
        if (px !== body.position.x || py !== body.position.y) {
          Body.setPosition(body, { x: px, y: py });
        }
        (node as HTMLElement).style.transform = `translate3d(${body.position.x - size.w / 2}px, ${body.position.y - size.h / 2}px, 0) rotate(${body.angle}rad)`;
      });
    }
    tick();
    return () => cancelAnimationFrame(raf);
  }, [cards.length]);

  // Resize handling
  useEffect(() => {
    if (!containerRef.current || !worldRef.current) return;
    const container = containerRef.current;
    const ref = worldRef.current;
    const ro = new ResizeObserver(() => {
      const b = container.getBoundingClientRect();
      const size = getCssCardSize(container);
      // Recreate walls at new positions
      const all = Composite.allBodies(ref.engine.world);
      // Remove previous walls (static bodies)
      all.forEach((body) => {
        if (body.isStatic) World.remove(ref.engine.world, body);
      });
      const thickness = 50;
      const half = thickness / 2;
      const opts = { isStatic: true, restitution } as const;
      World.add(ref.engine.world, [
        Bodies.rectangle(b.width / 2, -half, b.width, thickness, opts),
        Bodies.rectangle(b.width / 2, b.height + half, b.width, thickness, opts),
        Bodies.rectangle(-half, b.height / 2, thickness, b.height, opts),
        Bodies.rectangle(b.width + half, b.height / 2, thickness, b.height, opts),
      ]);
      // Clamp bodies inside and update body sizes if CSS size changed
      for (const [id, body] of ref.bodiesById.entries()) {
        const x = Math.min(Math.max(body.position.x, 20), b.width - 20);
        const y = Math.min(Math.max(body.position.y, 20), b.height - 20);
        Body.setPosition(body, { x, y });
        // Reset inertia when resizing approximation (cheap): set vertices via scale
        const currentW = body.bounds.max.x - body.bounds.min.x;
        const currentH = body.bounds.max.y - body.bounds.min.y;
        const sx = size.w / currentW;
        const sy = size.h / currentH;
        if (Math.abs(sx - 1) > 0.05 || Math.abs(sy - 1) > 0.05) {
          Body.scale(body, sx, sy);
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [restitution]);

  // Public API
  useImperativeHandle(ref, () => ({
    shuffle() {
      const refW = worldRef.current; if (!refW) return;
      for (const body of refW.bodiesById.values()) {
        Body.setVelocity(body, { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20 });
        Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2);
      }
    },
    addCard(card) {
      const refW = worldRef.current; if (!refW || !containerRef.current) return;
      const b = containerRef.current.getBoundingClientRect();
      const cssSize = getCssCardSize(containerRef.current);
      const body = Bodies.rectangle(Math.random() * b.width * 0.8 + 50, 60, cssSize.w, cssSize.h, {
        restitution,
        frictionAir: airFriction,
      });
      refW.bodiesById.set(card.id, body);
      World.add(refW.engine.world, body);
    },
  }), [restitution, airFriction]);

  // Click vs drag detection on DOM nodes
  useEffect(() => {
    const container = containerRef.current; if (!container) return;
    const downData = new Map<string, { t: number; x: number; y: number }>();
    function onDown(e: PointerEvent) {
      const target = (e.target as HTMLElement).closest('[data-card-id]') as HTMLElement | null;
      if (!target) return;
      const id = target.dataset.cardId!;
      downData.set(id, { t: performance.now(), x: e.clientX, y: e.clientY });
    }
    function onUp(e: PointerEvent) {
      const target = (e.target as HTMLElement).closest('[data-card-id]') as HTMLElement | null;
      if (!target) return;
      const id = target.dataset.cardId!;
      const d = downData.get(id); if (!d) return;
      const dt = performance.now() - d.t;
      const dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (dt < 180 && dist < 5) {
        audio.click();
        const card = cards.find((c) => c.id === id);
        if (!card) return;
        if (onCardClick) onCardClick(card);
        else window.open(card.url, '_blank', 'noopener');
      }
      downData.delete(id);
    }
    container.addEventListener('pointerdown', onDown);
    container.addEventListener('pointerup', onUp);
    return () => {
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointerup', onUp);
    };
  }, [cards, onCardClick]);

  return (
    <div
      ref={containerRef}
      className="bouncy-container full-bleed"
      style={{ width: '100vw', height }}
      aria-label="bouncy project cards"
    >
      {cards.map((card) => (
        <div
          key={card.id}
          data-card-id={card.id}
          role="link"
          tabIndex={0}
          className="bouncy-card"
          style={{ background: card.color || 'transparent' }}
        >
          <div className="bouncy-title">{card.title.toLowerCase()}</div>
          {card.subtitle ? <div className="bouncy-subtitle">{card.subtitle}</div> : null}
        </div>
      ))}
      <ul className="sr-only" aria-hidden="false">
        {cards.map((c) => (
          <li key={c.id}><a href={c.url} target="_blank" rel="noopener">{c.title}</a></li>
        ))}
      </ul>
    </div>
  );
});

export default BouncyProjectCards;


