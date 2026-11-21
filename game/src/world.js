// VICE BAY — city generation + collision helpers. Written fresh for the rebuild.
import { AVENUES, STREETS, ROAD_W, WORLD, ZONES, COLORS } from './config.js';

// Build the city into G: road list, building rects, zone points.
export function buildCity(G) {
  const rng = G.rng;
  G.roads = [];
  for (const x of AVENUES) G.roads.push({ x1: x, y1: 0, x2: x, y2: WORLD.h, vertical: true });
  for (const y of STREETS) G.roads.push({ x1: 0, y1: y, x2: WORLD.w, y2: y, vertical: false });

  G.buildings = [];
  const zonePts = Object.values(ZONES);
  const nearZone = (cx, cy, pad) =>
    zonePts.some((z) => Math.abs(z.x - cx) < pad && Math.abs(z.y - cy) < pad);

  // Blocks are the rectangles between neighbouring roads.
  const xs = [0, ...AVENUES, WORLD.w];
  const ys = [0, ...STREETS, WORLD.h];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const bx0 = xs[i] + ROAD_W / 2 + 12;
      const bx1 = xs[i + 1] - ROAD_W / 2 - 12;
      const by0 = ys[j] + ROAD_W / 2 + 12;
      const by1 = ys[j + 1] - ROAD_W / 2 - 12;
      const bw = bx1 - bx0;
      const bh = by1 - by0;
      if (bw < 60 || bh < 60) continue;
      // East strip is beach + water: no buildings past x = 2400.
      if (bx0 > 2380) continue;
      // One or two buildings per block, keeping clear of mission zones.
      const count = rng.chance(0.45) ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const w = count === 1 ? bw * rng.range(0.45, 0.7) : bw * rng.range(0.35, 0.45);
        const h = count === 1 ? bh * rng.range(0.45, 0.7) : bh * rng.range(0.4, 0.55);
        const x = count === 1
          ? bx0 + (bw - w) / 2
          : bx0 + (k === 0 ? 0 : bw - w);
        const y = count === 1
          ? by0 + (bh - h) / 2
          : by0 + rng.range(0, bh - h);
        const cx = x + w / 2;
        const cy = y + h / 2;
        if (nearZone(cx, cy, 150)) continue;
        G.buildings.push({
          x, y, w, h,
          color: rng.pick(COLORS.building),
          windows: rng.int(2, 5),
        });
      }
    }
  }
  G.zones = ZONES;
}

// True when the point is inside the world bounds (with a small margin).
export function inWorld(x, y) {
  return x > 12 && x < WORLD.w - 12 && y > 12 && y < WORLD.h - 12;
}

// True when the circle (x, y, r) overlaps any building. Water (x > 2500) also blocks.
export function pointBlocked(G, x, y, r) {
  if (x > 2500 - r) return true;
  if (!inWorld(x, y)) return true;
  for (const b of G.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// Push a circle out of buildings (and the world edge). Returns true if it hit something.
export function resolveCollision(G, obj, r) {
  let hit = false;
  if (obj.x > 2500 - r) { obj.x = 2500 - r; hit = true; }
  if (obj.x < 12 + r) { obj.x = 12 + r; hit = true; }
  if (obj.y < 12 + r) { obj.y = 12 + r; hit = true; }
  if (obj.y > WORLD.h - 12 - r) { obj.y = WORLD.h - 12 - r; hit = true; }
  for (const b of G.buildings) {
    const nx = Math.max(b.x, Math.min(obj.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(obj.y, b.y + b.h));
    let dx = obj.x - nx;
    let dy = obj.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      let d = Math.sqrt(d2);
      if (d < 0.001) { dx = 0; dy = -1; d = 1; }
      const push = r - d;
      obj.x += (dx / d) * push;
      obj.y += (dy / d) * push;
    }
  }
  return hit;
}

// Is the point on (or very near) a road?
export function onRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_W / 2 + 6) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < ROAD_W / 2 + 6) return true;
  return false;
}

// Nearest point on the road grid to (x, y): snaps to the closest avenue or street.
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y }; }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { x, y: sy }; }
  }
  return best;
}
