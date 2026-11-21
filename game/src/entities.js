// VICE BAY — entity factories. Every car, pedestrian, bullet, particle and
// pickup in the game is built by one of these, so the rest of the code never
// assembles an entity by hand. Field names that the automated checks read
// (parked, dead, police, driver, gold, health, taken, kind, down, speed)
// are kept exactly; the internal bookkeeping fields got new names.

import { PALETTE, TUNING } from "./config.js";

export function makePlayer() {
  return {
    x: 675, y: 675, angle: 0, speed: 0,
    inCar: null, onFoot: true, shootCd: 0,
  };
}

export function makeCar(x, y, angle, opts, random) {
  const police = !!opts.police;
  return {
    x, y, angle,
    speed: 0,
    color: opts.color || random.pick(PALETTE.traffic),
    police,
    gold: !!opts.gold,
    driver: opts.driver !== false,
    parked: !!opts.parked,
    health: police ? 60 : 100,
    road: opts.road || null,
    lane: opts.lane || 0,
    dir: opts.dir || 1,
    turnTimer: random.range(1, 4),
    gunTimer: random.range(0.5, 1.5),
    dead: false,
    burnLeft: 0,
    detourLeft: 0,
    detourHeading: 0,
    blockedFor: 0,
  };
}

export function makePed(x, y, random) {
  return {
    x, y,
    angle: random.range(0, Math.PI * 2),
    speed: random.range(TUNING.pedWalkMin, TUNING.pedWalkMax),
    color: random.pick(PALETTE.ped),
    state: "walk",
    moodLeft: random.range(0, 4),
    down: 0,
    driftLeft: random.range(1, 5),
  };
}

export function makeFleeingPed(x, y, random) {
  const ped = makePed(x + random.range(-30, 30), y + random.range(-30, 30), random);
  ped.speed = 120;
  ped.state = "flee";
  ped.moodLeft = 3;
  return ped;
}

export function makeBullet(x, y, angle, speed, life, fromPlayer) {
  return { x, y, angle, speed, life, fromPlayer };
}

export function makeParticle(x, y, vx, vy, life, max, color, size) {
  return { x, y, vx, vy, life, max, color, size };
}

export function makePickup(x, y, kind) {
  return { x, y, kind, taken: false };
}
