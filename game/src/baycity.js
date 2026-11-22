// Vice Bay's map: a hand-laid-out coastal city generated from one seed.
// The layout is fixed by design (roads, beach, harbor, districts, landmarks);
// the seed only shuffles building colours, heights and tree placement, so a
// screenshot seed reproduces the same streets every time.
//
// Districts: Old Town (west), Downtown (centre), Neon Strip (mid-east),
// Bayside (the beach), Harbor (south). The bay is the water along the east
// edge; the harbor basin sits at the south-west with wooden piers.

import { makeRng, pick, randFloat, randInt } from './tools.js';

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 90;

/** The vertical roads' centre x coordinates. */
export const ROADS_V = [400, 900, 1400, 1900, 2400, 2900];
/** The horizontal roads' centre y coordinates. */
export const ROADS_H = [350, 800, 1250, 1700, 2050];

const DISTRICT_PALETTES = {
  oldtown: ['#b5673f', '#a05a4a', '#c08a4e', '#8f6b4a'],
  downtown: ['#5d7d99', '#6e8ca8', '#4e6b84', '#7d94a8'],
  strip: ['#c65d9b', '#9b5dc6', '#d4697a', '#b05dc6'],
  bayside: ['#e0b48a', '#d9a06b', '#c98f7a', '#e8c89a'],
  harbor: ['#7a7f85', '#6b7076', '#8a8f94', '#5f6469'],
};

/** Which district a point belongs to, for palette and naming. */
export function districtAt(x, y) {
  if (y > 2100) return 'harbor';
  if (x > 2800) return 'bayside';
  if (y > 650 && y < 950 && x > 1100 && x < 1800) return 'strip';
  if (x > 1000 && x < 2300 && y > 900 && y < 1900) return 'downtown';
  return 'oldtown';
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Builds the whole city from a seed. */
export function buildBayCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const parks = [
    { x: 1500, y: 850, w: 280, h: 300, name: 'Palmetto Park' },
    { x: 2000, y: 1350, w: 300, h: 280, name: 'Coral Green' },
  ];
  const beach = { x: 2960, y: 0, w: 120, h: WORLD_H };
  const waterEast = { x: 3080, y: 0, w: 120, h: WORLD_H };
  const harbor = { x: 300, y: 2260, w: 1200, h: 140 };
  const piers = [
    { x: 480, y: 2220, w: 40, h: 180 },
    { x: 880, y: 2220, w: 40, h: 180 },
    { x: 1280, y: 2220, w: 40, h: 180 },
  ];

  // City blocks are the gaps between neighbouring roads (and the edges).
  const xs = [0, ...ROADS_V, WORLD_W];
  const ys = [0, ...ROADS_H, WORLD_H];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const bx = xs[i] + (i === 0 ? 20 : ROAD_W / 2 + 12);
      const bx2 = xs[i + 1] - (i === xs.length - 2 ? 20 : ROAD_W / 2 + 12);
      const by = ys[j] + (j === 0 ? 20 : ROAD_W / 2 + 12);
      const by2 = ys[j + 1] - (j === ys.length - 2 ? 20 : ROAD_W / 2 + 12);
      const block = { x: bx, y: by, w: bx2 - bx, h: by2 - by };
      if (block.w < 90 || block.h < 90) continue;
      if (block.x + block.w > 2940) continue; // beach side stays open
      if (block.y + block.h > 2240 && block.x < 1550) continue; // harbor basin
      if (parks.some((p) => rectsOverlap(block, p))) continue;
      const count = randInt(rng, 1, 3);
      for (let k = 0; k < count; k++) {
        const w = randFloat(rng, 90, Math.min(220, block.w - 20));
        const h = randFloat(rng, 90, Math.min(200, block.h - 20));
        const x = block.x + 10 + rng() * Math.max(1, block.w - w - 20);
        const y = block.y + 10 + rng() * Math.max(1, block.h - h - 20);
        const cand = { x, y, w, h };
        if (buildings.some((b) => rectsOverlap(cand, { x: b.x - 14, y: b.y - 14, w: b.w + 28, h: b.h + 28 }))) continue;
        const district = districtAt(x + w / 2, y + h / 2);
        buildings.push({
          x, y, w, h,
          color: pick(rng, DISTRICT_PALETTES[district]),
          roof: rng() > 0.5,
          stories: randInt(rng, 1, 6),
          district,
        });
      }
    }
  }

  for (const park of parks) {
    const n = randInt(rng, 6, 9);
    for (let i = 0; i < n; i++) {
      trees.push({
        x: park.x + 20 + rng() * (park.w - 40),
        y: park.y + 20 + rng() * (park.h - 40),
        r: randFloat(rng, 12, 20),
      });
    }
  }
  // Palm rows along the beach.
  for (let y = 120; y < WORLD_H - 100; y += 170) {
    trees.push({ x: 3000 + rng() * 40, y: y + randFloat(rng, -20, 20), r: 15, palm: true });
  }

  return {
    w: WORLD_W,
    h: WORLD_H,
    roadsV: ROADS_V,
    roadsH: ROADS_H,
    buildings,
    trees,
    parks,
    beach,
    waterEast,
    harbor,
    piers,
    districts: [
      { name: 'Old Town', x: 60, y: 60, w: 800, h: 500 },
      { name: 'Downtown', x: 1050, y: 1000, w: 1200, h: 800 },
      { name: 'Neon Strip', x: 1150, y: 660, w: 620, h: 280 },
      { name: 'Bayside', x: 2700, y: 200, w: 420, h: 1800 },
      { name: 'Harbor', x: 350, y: 2120, w: 1100, h: 260 },
    ],
    // Story landmarks (see story.js).
    garage: { x: 700, y: 2140, label: "Sable's Garage" },
    marinaCrate: { x: 900, y: 2340, label: 'Marina Crate' },
    stripDrop: { x: 1450, y: 800, label: 'Neon Strip Drop' },
    hideout: { x: 250, y: 250, label: 'Hideout' },
    bankVan: { x: 1400, y: 1250, label: 'Bank Van' },
    docksEscape: { x: 500, y: 2340, label: 'Docks Escape' },
    spawn: { x: 900, y: 600 }, // on the x=900 road, never inside a building
  };
}

/** Whether a point is in water (the bay or the harbor basin). */
export function pointInWater(city, x, y) {
  if (x >= city.waterEast.x && y >= city.waterEast.y && y < city.waterEast.y + city.waterEast.h) return true;
  const hb = city.harbor;
  const onPier = city.piers.some((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
  if (!onPier && x >= hb.x && x <= hb.x + hb.w && y >= hb.y && y <= hb.y + hb.h) return true;
  return false;
}

/** Whether a point is on a road (within the asphalt). */
export function pointOnRoad(city, x, y) {
  for (const rx of ROADS_V) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

/**
 * Pushes a circle body {x, y, r} out of every building rect and the world
 * edge. Returns true when anything was pushed.
 */
export function resolveCircleBuildings(city, body) {
  let pushed = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= body.r * body.r) continue;
    pushed = true;
    if (d2 > 0.01) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * body.r;
      body.y = cy + (dy / d) * body.r;
    } else {
      // Centre inside the rect: push out along the smallest overlap.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) body.x = b.x - body.r;
      else if (m === right) body.x = b.x + b.w + body.r;
      else if (m === top) body.y = b.y - body.r;
      else body.y = b.y + b.h + body.r;
    }
  }
  const r = body.r;
  if (body.x < r) { body.x = r; pushed = true; }
  if (body.x > city.w - r) { body.x = city.w - r; pushed = true; }
  if (body.y < r) { body.y = r; pushed = true; }
  if (body.y > city.h - r) { body.y = city.h - r; pushed = true; }
  return pushed;
}

/** A random point on a road, with the road's driving angle. */
export function randomRoadSpot(city, rng) {
  if (rng() < 0.5) {
    const rx = pick(rng, ROADS_V);
    return { x: rx + (rng() < 0.5 ? -22 : 22), y: randFloat(rng, 60, city.h - 60), angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
  }
  const ry = pick(rng, ROADS_H);
  return { x: randFloat(rng, 60, city.w - 60), y: ry + (rng() < 0.5 ? -22 : 22), angle: rng() < 0.5 ? 0 : Math.PI };
}

// ---------------------------------------------------------------- drawing

/** Draws the whole city: ground, water, beach, parks, roads, buildings, trees. */
export function drawCity(ctx, city, time) {
  // Ground.
  ctx.fillStyle = '#4a6b41';
  ctx.fillRect(0, 0, city.w, city.h);
  // Water: the bay (east) and the harbor basin (south-west).
  ctx.fillStyle = '#2e6f9e';
  ctx.fillRect(city.waterEast.x, city.waterEast.y, city.waterEast.w, city.waterEast.h);
  ctx.fillRect(city.harbor.x, city.harbor.y, city.harbor.w, city.harbor.h);
  // Animated wave strokes.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const y = 140 + i * 280 + Math.sin(time * 0.8 + i) * 8;
    ctx.beginPath();
    ctx.moveTo(city.waterEast.x + 14, y);
    ctx.quadraticCurveTo(city.waterEast.x + 60, y - 10, city.waterEast.x + 106, y);
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const x = 420 + i * 300 + Math.sin(time * 0.7 + i * 2) * 6;
    ctx.beginPath();
    ctx.moveTo(x, city.harbor.y + 30);
    ctx.quadraticCurveTo(x + 14, city.harbor.y + 44, x + 28, city.harbor.y + 30);
    ctx.stroke();
  }
  ctx.restore();
  // Beach sand.
  ctx.fillStyle = '#d9c48a';
  ctx.fillRect(city.beach.x, city.beach.y, city.beach.w, city.beach.h);
  // Parks.
  for (const park of city.parks) {
    ctx.fillStyle = '#3f7a3f';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.strokeStyle = '#2f5d2f';
    ctx.lineWidth = 3;
    ctx.strokeRect(park.x, park.y, park.w, park.h);
  }
  // City blocks (concrete) — the gaps between roads.
  ctx.fillStyle = '#767c86';
  const xs = [0, ...ROADS_V, city.w];
  const ys = [0, ...ROADS_H, city.h];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const bx = xs[i] + (i === 0 ? 0 : ROAD_W / 2);
      const bx2 = xs[i + 1] - (i === xs.length - 2 ? 0 : ROAD_W / 2);
      const by = ys[j] + (j === 0 ? 0 : ROAD_W / 2);
      const by2 = ys[j + 1] - (j === ys.length - 2 ? 0 : ROAD_W / 2);
      if (bx2 - bx < 10 || by2 - by < 10) continue;
      ctx.fillRect(bx, by, bx2 - bx, by2 - by);
    }
  }
  // Roads (asphalt) with dashed centre lines.
  ctx.fillStyle = '#2e3138';
  for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, city.h);
  for (const ry of ROADS_H) ctx.fillRect(0, ry - ROAD_W / 2, city.w, ROAD_W);
  ctx.save();
  ctx.strokeStyle = 'rgba(240,220,120,0.75)';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const rx of ROADS_V) {
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, city.h);
    ctx.stroke();
  }
  for (const ry of ROADS_H) {
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.lineTo(city.w, ry);
    ctx.stroke();
  }
  ctx.restore();
  // Piers.
  ctx.fillStyle = '#8a6f4d';
  for (const p of city.piers) ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.strokeStyle = '#6b543a';
  ctx.lineWidth = 2;
  for (const p of city.piers) {
    for (let y = p.y + 18; y < p.y + p.h; y += 22) {
      ctx.beginPath();
      ctx.moveTo(p.x, y);
      ctx.lineTo(p.x + p.w, y);
      ctx.stroke();
    }
  }
  // Buildings: body, roof edge, windows.
  for (const b of city.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    if (b.roof) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, Math.min(26, b.h - 12));
    }
    if (b.w > 110 && b.h > 110) {
      ctx.fillStyle = 'rgba(20,30,45,0.55)';
      const cols = Math.floor((b.w - 24) / 26);
      const rows = Math.floor((b.h - 24) / 26);
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          ctx.fillRect(b.x + 14 + cx * 26, b.y + 14 + cy * 26, 12, 14);
        }
      }
    }
  }
  // Trees and palms.
  for (const t of city.trees) {
    if (t.palm) {
      ctx.strokeStyle = '#7a5a3a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y + 8);
      ctx.lineTo(t.x, t.y - 6);
      ctx.stroke();
      ctx.fillStyle = '#2f7a3f';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(t.x + Math.cos(a) * 10, t.y - 6 + Math.sin(a) * 6, 11, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#2f7a3f';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f9e4d';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // District names, faint on the ground.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  for (const d of city.districts) {
    ctx.fillText(d.name.toUpperCase(), d.x + d.w / 2, d.y + d.h / 2);
  }
  ctx.restore();
}
