// Vice Bay's wanted system and police. Heat rises when the player is seen
// doing crime (shooting, killing, stealing in view) and falls when no officer
// is close for a while. Stars follow heat. Foot cops run the player down and
// punch; police cruisers chase and ram. Lose them all and the heat cools.
//
// The module never owns the game: it takes a small context {player, car,
// city, rng, wanted, cops, cruisers} so boot.js stays the only coordinator.

import { angleDelta, clamp, dist, makeRng, randFloat } from './tools.js';
import { makeVehicle, stepVehicle } from './drive.js';
import { resolveCircleBuildings } from './baycity.js';

/** Heat bands for each star level. */
const STAR_HEAT = [0, 10, 28, 50, 72, 92];

export class Wanted {
  constructor() {
    this.stars = 0;
    this.heat = 0;
    this.quiet = 0; // seconds with no officer near
  }

  /** Adds heat and recomputes stars. */
  addHeat(n) {
    this.heat = clamp(this.heat + n, 0, 100);
    this.recompute();
    this.quiet = 0;
  }

  setStars(stars) {
    this.stars = clamp(stars, 0, 5);
    this.heat = this.stars === 0 ? 0 : STAR_HEAT[this.stars];
  }

  recompute() {
    let stars = 0;
    for (let s = 5; s >= 1; s--) {
      if (this.heat >= STAR_HEAT[s]) { stars = s; break; }
    }
    this.stars = stars;
  }

  /** Cools down when no officer is within sightRange. */
  decay(dt, nearestOfficerDist, sightRange) {
    if (nearestOfficerDist > sightRange) {
      this.quiet += dt;
      if (this.quiet > 5) this.heat = Math.max(0, this.heat - 7 * dt);
    } else {
      this.quiet = 0;
    }
    this.recompute();
  }
}

/** Makes a foot cop at a position. */
export function makeFootCop(x, y) {
  return {
    x, y,
    angle: 0,
    hp: 100,
    speed: 235,
    punchTimer: 0,
    r: 14,
    down: 0, // seconds lying down after being shot
  };
}

/** Makes a police cruiser at a position. */
export function makePoliceCar(x, y, angle) {
  const car = makeVehicle('cruiser', x, y, angle);
  car.driver = 'police';
  car.ramCooldown = 0;
  car.sirenPhase = Math.random() * Math.PI * 2;
  return car;
}

/**
 * Keeps the police presence matched to the wanted level: spawns officers at
 * the map edge near the player, despawns ones that fell far behind.
 */
export function maintainPolice(ctx) {
  const { wanted, cops, cruisers, playerPos, city, rng } = ctx;
  const wantFoot = wanted.stars * 2;
  const wantCars = wanted.stars;
  if (cops.length < wantFoot) {
    const spot = edgeSpotNear(city, rng, playerPos, 650);
    cops.push(makeFootCop(spot.x, spot.y));
  }
  if (cruisers.length < wantCars) {
    const spot = edgeSpotNear(city, rng, playerPos, 800);
    cruisers.push(makePoliceCar(spot.x, spot.y, Math.atan2(playerPos.y - spot.y, playerPos.x - spot.x)));
  }
  for (let i = cops.length - 1; i >= 0; i--) {
    if (dist(cops[i].x, cops[i].y, playerPos.x, playerPos.y) > 1500) cops.splice(i, 1);
  }
  for (let i = cruisers.length - 1; i >= 0; i--) {
    if (dist(cruisers[i].x, cruisers[i].y, playerPos.x, playerPos.y) > 1700) cruisers.splice(i, 1);
  }
}

function edgeSpotNear(city, rng, pos, range) {
  for (let tries = 0; tries < 12; tries++) {
    const a = rng() * Math.PI * 2;
    const x = clamp(pos.x + Math.cos(a) * range, 60, city.w - 60);
    const y = clamp(pos.y + Math.sin(a) * range, 60, city.h - 60);
    return { x, y };
  }
  return { x: 60, y: 60 };
}

/**
 * Steps foot cops toward the player; they punch at close range.
 * onPunch(damage) is called when a punch lands.
 */
export function stepFootCops(cops, playerPos, dt, city, onPunch) {
  for (const cop of cops) {
    if (cop.down > 0) {
      cop.down -= dt;
      continue;
    }
    cop.punchTimer -= dt;
    const d = dist(cop.x, cop.y, playerPos.x, playerPos.y);
    if (d > 30) {
      const a = Math.atan2(playerPos.y - cop.y, playerPos.x - cop.x);
      cop.angle = a;
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
      resolveCircleBuildings(city, cop);
    } else if (cop.punchTimer <= 0) {
      cop.punchTimer = 0.9;
      onPunch(9);
    }
  }
}

/**
 * Steps police cruisers: they steer at the player and ram.
 * onRam(damage) is called on a hard hit.
 */
export function stepPoliceCars(cars, playerPos, playerInCar, dt, city, grip, onRam) {
  for (const car of cars) {
    car.ramCooldown -= dt;
    const want = Math.atan2(playerPos.y - car.y, playerPos.x - car.x);
    const turn = angleDelta(car.angle, want);
    const input = {
      up: true,
      down: false,
      left: turn < -0.08,
      right: turn > 0.08,
    };
    // Ease off when almost on top of the player, so the cruiser can turn.
    if (dist(car.x, car.y, playerPos.x, playerPos.y) < 90) input.up = Math.abs(turn) < 0.5;
    stepVehicle(car, input, dt, city, grip);
    const d = dist(car.x, car.y, playerPos.x, playerPos.y);
    const hitR = playerInCar ? 46 : 34;
    if (d < hitR && car.ramCooldown <= 0 && Math.abs(car.speed) > 120) {
      car.ramCooldown = 1.1;
      onRam(playerInCar ? 14 : 18);
    }
  }
}

/** Draws a foot cop: navy uniform, cap, baton. */
export function drawFootCop(ctx, cop) {
  if (cop.down > 0) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = '#1d2a44';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(cop.x, cop.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 14, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d2a44';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d8c040';
  ctx.fillRect(-6, -3, 12, 6);
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(Math.cos(cop.angle) * 4, Math.sin(cop.angle) * 4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#101828';
  ctx.fillRect(Math.cos(cop.angle) * 10 - 2, Math.sin(cop.angle) * 10 - 2, 4, 4);
  ctx.restore();
}
