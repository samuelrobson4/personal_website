import { Engine, World, Bodies, Runner, Composite, Body } from 'matter-js';

export function createEngine() {
  const engine = Engine.create({ enableSleeping: false });
  engine.gravity.y = 0;
  return engine;
}

export function createWalls(width: number, height: number, thickness = 50, restitution = 0.9) {
  const half = thickness / 2;
  const options = { isStatic: true, restitution } as const;
  const walls = [
    Bodies.rectangle(width / 2, -half, width, thickness, options), // top
    Bodies.rectangle(width / 2, height + half, width, thickness, options), // bottom
    Bodies.rectangle(-half, height / 2, thickness, height, options), // left
    Bodies.rectangle(width + half, height / 2, thickness, height, options), // right
  ];
  return walls;
}

export function clampBodyInside(body: Body, width: number, height: number) {
  const x = Math.min(Math.max(body.position.x, 20), width - 20);
  const y = Math.min(Math.max(body.position.y, 20), height - 20);
  Body.setPosition(body, { x, y });
  if (Math.abs(body.velocity.x) < 0.05) body.velocity.x = 0;
  if (Math.abs(body.velocity.y) < 0.05) body.velocity.y = 0;
}

export function startRunner(engine: Engine) {
  const runner = Runner.create();
  Runner.run(runner, engine);
  return runner;
}


