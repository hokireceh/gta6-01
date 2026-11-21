// VICE BAY — the city: a road grid, the blocks between the roads, and the
// population that lives on it (traffic, parked cars, pedestrians, pickups,
// the gold car). The layout is deterministic for a given seed.

import {
  WORLD_SIZE, ROAD_COUNT, ROAD_SPACING, ROAD_WIDTH, FIRST_ROAD, LANDMARKS,
} from "./config.js";
import { makeCar, makePed, makePickup } from "./entities.js";

const PICKUP_SPOTS = [
  [1125, 1125], [2475, 1575], [1575, 2475],
  [2025, 2025], [675, 1575], [2925, 1575],
];

export class City {
  constructor(random) {
    this.roads = [];
    for (let i = 0; i < ROAD_COUNT; i++) {
      this.roads.push(FIRST_ROAD + i * ROAD_SPACING);
    }
    this.blocks = this.growBlocks(random);
  }

  growBlocks(random) {
    const blocks = [];
    const inner = ROAD_SPACING - ROAD_WIDTH - 36;
    for (let col = 0; col < ROAD_COUNT - 1; col++) {
      for (let row = 0; row < ROAD_COUNT - 1; row++) {
        if (random.chance(0.12)) continue; // empty lot
        const park = random.chance(0.08);
        const bx = this.roads[col] + ROAD_WIDTH / 2 + 18 + random.range(0, 30);
        const by = this.roads[row] + ROAD_WIDTH / 2 + 18 + random.range(0, 30);
        blocks.push({
          x: bx,
          y: by,
          w: inner - random.range(0, 60),
          h: inner - random.range(0, 60),
          park,
          color: park ? null : random.pick([
            "#46587e", "#5a4a7e", "#7e5a4a", "#3a6b57", "#6b3a57", "#525f82",
          ]),
        });
      }
    }
    return blocks;
  }

  onRoad(x, y) {
    const half = ROAD_WIDTH / 2 + 4;
    for (const line of this.roads) {
      if (Math.abs(x - line) < half) return true;
      if (Math.abs(y - line) < half) return true;
    }
    return false;
  }

  // First solid building overlapping the circle, or null.
  hitsBuilding(x, y, radius) {
    for (const b of this.blocks) {
      if (b.park) continue;
      const overlap =
        x + radius > b.x && x - radius < b.x + b.w &&
        y + radius > b.y && y - radius < b.y + b.h;
      if (overlap) return b;
    }
    return null;
  }

  nearestRoad(value) {
    let best = this.roads[0];
    let bestDist = Infinity;
    for (const line of this.roads) {
      const d = Math.abs(value - line);
      if (d < bestDist) { bestDist = d; best = line; }
    }
    return best;
  }
}

// Fill a fresh state with the starting population.
export function populate(state, city, random) {
  state.cars = [];
  state.peds = [];
  state.bullets = [];
  state.pickups = [];
  state.particles = [];

  for (let i = 0; i < 12; i++) spawnTrafficCar(state, city, random);
  for (let i = 0; i < 6; i++) spawnParkedCar(state, city, random);
  for (let i = 0; i < 24; i++) spawnPedestrian(state, city, random);
  for (const [x, y] of PICKUP_SPOTS) {
    state.pickups.push(makePickup(x, y, "health"));
  }
  const gold = makeCar(LANDMARKS.goldCarSpot.x, LANDMARKS.goldCarSpot.y, Math.PI / 2, {
    color: "#ffd23d", gold: true, parked: true, driver: false,
  }, random);
  state.cars.push(gold);
}

function spawnTrafficCar(state, city, random) {
  const vertical = random.chance(0.5);
  const line = random.pick(city.roads);
  const along = random.range(100, WORLD_SIZE - 100);
  const side = random.chance(0.5) ? -22 : 22;
  const forward = random.chance(0.5);
  const car = makeCar(
    vertical ? line + side : along,
    vertical ? along : line + side,
    vertical ? (forward ? Math.PI / 2 : -Math.PI / 2) : (forward ? 0 : Math.PI),
    {
      road: vertical ? "v" : "h",
      lane: random.chance(0.5) ? -1 : 1,
      dir: random.chance(0.5) ? 1 : -1,
    },
    random,
  );
  car.speed = random.range(60, 110);
  state.cars.push(car);
}

function spawnParkedCar(state, city, random) {
  let placed = 0;
  let guard = 0;
  while (placed < 6 && guard < 400) {
    guard++;
    const x = random.range(150, WORLD_SIZE - 150);
    const y = random.range(150, WORLD_SIZE - 150);
    if (!city.onRoad(x, y)) continue;
    if (city.hitsBuilding(x, y, 40)) continue;
    const dx = x - state.player.x;
    const dy = y - state.player.y;
    if (Math.hypot(dx, dy) < 300) continue;
    state.cars.push(makeCar(x, y, random.range(0, Math.PI * 2), {
      parked: true, driver: false,
    }, random));
    placed++;
  }
}

function spawnPedestrian(state, city, random) {
  let x = random.range(150, WORLD_SIZE - 150);
  let y = random.range(150, WORLD_SIZE - 150);
  let tries = 0;
  while (city.hitsBuilding(x, y, 20) && tries < 50) {
    tries++;
    x = random.range(150, WORLD_SIZE - 150);
    y = random.range(150, WORLD_SIZE - 150);
  }
  state.peds.push(makePed(x, y, random));
}
