// Vice Bay — the city itself: roads, blocks, buildings, beach and park.
// Generated once from a fixed seed, so the map is identical every run.

import { BAY_X, BAY_Y, WORLD_H, WORLD_W } from './config.js';
import { clamp, pushCircleOutOfRect } from './math.js';
import { RNG } from './random.js';

export const ROAD_HALF = 34;
export const SIDEWALK = 15;
export const WORLD_SEED = 20261122;

const ROOFS = ['#b0563a', '#7d8aa0', '#c2a15a', '#8a5a7d', '#5a7d8a', '#a08a5a'];

export function buildWorld(seed = WORLD_SEED) {
  const rng = new RNG(seed);
  const avenues = [];
  for (let x = 240; x < WORLD_W - 120; x += 400) avenues.push(x);
  const streets = [];
  for (let y = 200; y < WORLD_H - 120; y += 360) streets.push(y);

  const buildings = [];
  const trees = [];
  // Park block: between avenue 3 and 4, street 2 and 3 (centre of town).
  const park = {
    x: avenues[3] + ROAD_HALF + SIDEWALK,
    y: streets[2] + ROAD_HALF + SIDEWALK,
    w: 400 - 2 * (ROAD_HALF + SIDEWALK),
    h: 360 - 2 * (ROAD_HALF + SIDEWALK),
  };
  for (let ci = 0; ci < avenues.length - 1; ci++) {
    for (let ri = 0; ri < streets.length - 1; ri++) {
      const bx = avenues[ci] + ROAD_HALF + SIDEWALK;
      const by = streets[ri] + ROAD_HALF + SIDEWALK;
      const bw = 400 - 2 * (ROAD_HALF + SIDEWALK);
      const bh = 360 - 2 * (ROAD_HALF + SIDEWALK);
      const isPark = bx === park.x && by === park.y;
      const inBay = bx + bw > BAY_X && by + bh > BAY_Y;
      if (isPark) {
        for (let i = 0; i < 14; i++) {
          trees.push({
            x: bx + rng.range(24, bw - 24),
            y: by + rng.range(24, bh - 24),
            r: rng.range(10, 18),
          });
        }
        continue;
      }
      if (inBay) continue; // the bay shore stays open sand
      const n = rng.int(1, 3);
      if (n === 1) {
        buildings.push({
          x: bx + 18, y: by + 18, w: bw - 36, h: bh - 36,
          roof: rng.pick(ROOFS), height: rng.int(14, 42),
        });
      } else if (n === 2) {
        const splitV = rng.chance(0.5);
        if (splitV) {
          buildings.push({ x: bx + 14, y: by + 14, w: bw / 2 - 22, h: bh - 28, roof: rng.pick(ROOFS), height: rng.int(12, 36) });
          buildings.push({ x: bx + bw / 2 + 8, y: by + 14, w: bw / 2 - 22, h: bh - 28, roof: rng.pick(ROOFS), height: rng.int(12, 36) });
        } else {
          buildings.push({ x: bx + 14, y: by + 14, w: bw - 28, h: bh / 2 - 22, roof: rng.pick(ROOFS), height: rng.int(12, 36) });
          buildings.push({ x: bx + 14, y: by + bh / 2 + 8, w: bw - 28, h: bh / 2 - 22, roof: rng.pick(ROOFS), height: rng.int(12, 36) });
        }
      } else {
        // Four small shops around a courtyard.
        const qw = bw / 2 - 20;
        const qh = bh / 2 - 20;
        buildings.push({ x: bx + 10, y: by + 10, w: qw, h: qh, roof: rng.pick(ROOFS), height: rng.int(10, 22) });
        buildings.push({ x: bx + bw / 2 + 10, y: by + 10, w: qw, h: qh, roof: rng.pick(ROOFS), height: rng.int(10, 22) });
        buildings.push({ x: bx + 10, y: by + bh / 2 + 10, w: qw, h: qh, roof: rng.pick(ROOFS), height: rng.int(10, 22) });
        buildings.push({ x: bx + bw / 2 + 10, y: by + bh / 2 + 10, w: qw, h: qh, roof: rng.pick(ROOFS), height: rng.int(10, 22) });
      }
    }
  }
  // A few palm trees along the beach.
  for (let y = 220; y < WORLD_H - 200; y += 130) {
    trees.push({ x: BAY_X - 60 + rng.range(-14, 14), y: y + rng.range(-30, 30), r: 13, palm: true });
  }
  for (let x = 300; x < BAY_X - 100; x += 150) {
    trees.push({ x: x + rng.range(-30, 30), y: BAY_Y - 60 + rng.range(-14, 14), r: 13, palm: true });
  }

  const world = {
    seed,
    avenues,
    streets,
    buildings,
    trees,
    park,
    water: { x: BAY_X, y: BAY_Y, w: WORLD_W - BAY_X, h: WORLD_H - BAY_Y },
    depot: { x: avenues[1] + 90, y: streets[1] + 90 },
    hideout: { x: avenues[7] - 60, y: streets[0] + 60 },
    plaza: { x: avenues[4], y: streets[3] },
  };
  return world;
}

/** True when (x,y) is in the bay water. */
export function isWater(world, x, y) {
  return x > world.water.x && y > world.water.y;
}

/** True when (x,y) lies on a road surface (not sidewalk). */
export function isOnRoad(world, x, y) {
  for (const ax of world.avenues) {
    if (Math.abs(x - ax) <= ROAD_HALF) return true;
  }
  for (const sy of world.streets) {
    if (Math.abs(y - sy) <= ROAD_HALF) return true;
  }
  return false;
}

/** Snap (x,y) to the centre line of the nearest road. */
export function nearestRoadPoint(world, x, y) {
  let bestA = world.avenues[0];
  let bestAd = Infinity;
  for (const ax of world.avenues) {
    const d = Math.abs(x - ax);
    if (d < bestAd) { bestAd = d; bestA = ax; }
  }
  let bestS = world.streets[0];
  let bestSd = Infinity;
  for (const sy of world.streets) {
    const d = Math.abs(y - sy);
    if (d < bestSd) { bestSd = d; bestS = sy; }
  }
  if (bestAd <= bestSd) return { x: bestA, y: clamp(y, 60, WORLD_H - 60), axis: 'v', road: bestA };
  return { x: clamp(x, 60, WORLD_W - 60), y: bestS, axis: 'h', road: bestS };
}

/** A random point on a random road, for traffic and pedestrian spawns. */
export function randomRoadPoint(world, rng) {
  if (rng.chance(0.5)) {
    const ax = rng.pick(world.avenues);
    return { x: ax, y: rng.range(80, WORLD_H - 80), axis: 'v', road: ax };
  }
  const sy = rng.pick(world.streets);
  return { x: rng.range(80, WORLD_W - 80), y: sy, axis: 'h', road: sy };
}

/**
 * Resolve collisions for a circle at `pos` (mutated): buildings, the
 * water, and the map edge. Returns true when anything pushed it.
 */
export function collideCircle(world, pos, radius) {
  let hit = false;
  pos.x = clamp(pos.x, radius, WORLD_W - radius);
  pos.y = clamp(pos.y, radius, WORLD_H - radius);
  for (const b of world.buildings) {
    if (pushCircleOutOfRect(pos, radius, b)) hit = true;
  }
  const w = world.water;
  if (pos.x + radius > w.x && pos.y + radius > w.y) {
    // Shallow shore: allow the sand strip, block the deep water.
    const deep = { x: w.x + 46, y: w.y + 46, w: w.w, h: w.h };
    if (pushCircleOutOfRect(pos, radius, deep)) hit = true;
  }
  return hit;
}

/** The nearest building overlapping a circle, or null. */
export function buildingAt(world, x, y, radius) {
  for (const b of world.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) {
      return b;
    }
  }
  return null;
}
