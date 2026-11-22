// VICE BAY — the factories that build every actor: the player, the cars,
// the pedestrians, the bullets, the sparks and the pickups. Plain objects
// with fixed field names — the AI, combat and render modules all read
// these exact names, so a rename here breaks the whole game.

import { PALETTE, TUNING } from "./config.js";

export function makePlayer() {
  return {
    x: 675,
    y: 675,
    angle: 0,
    speed: 0,
    inCar: null,
    onFoot: true,
    shootCd: 0,
  };
}

export function makeCar(x, y, angle, opts, random) {
  const options = opts ?? {};
  return {
    x,
    y,
    angle,
    speed: 0,
    color: options.color ?? random.pick(PALETTE.traffic),
    police: !!options.police,
    gold: !!options.gold,
    // A car has a driver unless the caller says otherwise; a driverless
    // car is parked or abandoned, and stealing a driven one raises wanted.
    driver: options.driver !== false,
    parked: !!options.parked,
    health: options.police ? 60 : 100,
    road: options.road ?? null,
    lane: options.lane ?? 0,
    dir: options.dir ?? 1,
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
    x,
    y,
    angle: random.range(0, Math.PI * 2),
    speed: random.range(TUNING.pedWalkMin, TUNING.pedWalkMax),
    color: random.pick(PALETTE.ped),
    state: "walk",
    moodLeft: random.range(0, 4),
    down: 0,
    driftLeft: random.range(1, 5),
  };
}

// A pedestrian who just watched their car get stolen: same shape as a
// normal walker, but already running, starting a few steps off the spot.
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
