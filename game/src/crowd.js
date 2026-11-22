// Vice Bay's crowd: pedestrians strolling the sidewalks and the parked cars
// waiting to be stolen. Pedestrians wander, scatter when a gunshot goes off
// nearby, and stay down a while when hit. Parked cars sit at the roadside
// with their doors unlocked — the player's first wheels.

import { pick, randFloat } from './tools.js';
import { ROADS_H, ROADS_V, resolveCircleBuildings } from './baycity.js';
import { makeVehicle } from './drive.js';

const PED_COLORS = ['#c96a5a', '#5a8ac9', '#6ac95a', '#c9b45a', '#9b5ac9', '#e0e0e0', '#3a3a3a'];

/** Makes n pedestrians spread over the sidewalks. */
export function makePedestrians(city, rng, n) {
  const peds = [];
  for (let i = 0; i < n; i++) {
    const vertical = rng() < 0.5;
    let x, y;
    if (vertical) {
      const rx = pick(rng, ROADS_V);
      x = rx + (rng() < 0.5 ? -62 : 62);
      y = randFloat(rng, 80, city.h - 80);
    } else {
      const ry = pick(rng, ROADS_H);
      x = randFloat(rng, 80, city.w - 80);
      y = ry + (rng() < 0.5 ? -62 : 62);
    }
    peds.push({
      x, y,
      angle: rng() * Math.PI * 2,
      speed: randFloat(rng, 40, 80),
      color: pick(rng, PED_COLORS),
      state: 'walk',
      down: 0,
      turnTimer: randFloat(rng, 2, 6),
      wobble: rng() * Math.PI * 2, // per-pedestrian phase for lazy turns
      r: 13,
      hp: 100,
    });
  }
  return peds;
}

/**
 * Steps pedestrians. danger {x, y} (a recent gunshot) makes nearby ones flee.
 * A down pedestrian stays down until down hits 0, then gets up and walks on.
 */
export function stepPedestrians(peds, dt, city, danger) {
  for (const p of peds) {
    if (p.down > 0) {
      p.down -= dt;
      if (p.down <= 0) p.state = 'walk';
      continue;
    }
    if (danger) {
      const dx = p.x - danger.x;
      const dy = p.y - danger.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 320 * 320) {
        p.state = 'flee';
        p.angle = Math.atan2(dy, dx);
      }
    }
    p.turnTimer -= dt;
    if (p.state === 'walk' && p.turnTimer <= 0) {
      // A lazy turn driven by the pedestrian's own wobble phase.
      p.wobble += 1.7;
      p.angle += Math.sin(p.wobble) * 1.1;
      p.turnTimer = 2 + (Math.sin(p.wobble * 1.3) * 0.5 + 0.5) * 4;
    }
    const speed = p.state === 'flee' ? 190 : p.speed;
    p.x += Math.cos(p.angle) * speed * dt;
    p.y += Math.sin(p.angle) * speed * dt;
    if (p.state === 'flee') {
      p.fleeTimer = (p.fleeTimer ?? 0) + dt;
      if (p.fleeTimer > 2.5) { p.state = 'walk'; p.fleeTimer = 0; }
    }
    resolveCircleBuildings(city, p);
  }
}

/** Draws one pedestrian, or a lying one when down. */
export function drawPedestrian(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.down > 0) {
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 12, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Parks n stealable cars along the roadsides. */
export function makeParkedCars(city, rng, n) {
  const cars = [];
  const kinds = ['sedan', 'sedan', 'taxi', 'speedster', 'sedan', 'truck', 'bike'];
  for (let i = 0; i < n; i++) {
    const vertical = rng() < 0.5;
    let car;
    if (vertical) {
      const rx = pick(rng, ROADS_V);
      const side = rng() < 0.5 ? -58 : 58;
      car = makeVehicle(pick(rng, kinds), rx + side, randFloat(rng, 100, city.h - 100), rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    } else {
      const ry = pick(rng, ROADS_H);
      const side = rng() < 0.5 ? -58 : 58;
      car = makeVehicle(pick(rng, kinds), randFloat(rng, 100, city.w - 100), ry + side, rng() < 0.5 ? 0 : Math.PI);
    }
    car.parked = true;
    car.driver = null;
    cars.push(car);
  }
  return cars;
}
