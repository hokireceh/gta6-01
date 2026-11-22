// Vice Bay — entity factories and pure kinematics.
// Entities are plain objects; the world and the game loop move them.

import { TUNING } from './config.js';
import { clamp } from './math.js';

export const CAR_COLORS = [
  '#d94f3d', '#3d7dd9', '#e8e8e8', '#2f2f33', '#e8a13d',
  '#7dd93d', '#9b59d0', '#3dd9c2', '#d9d93d', '#b8b8b8',
];

export const PED_SHIRTS = [
  '#e86a92', '#5aa9e6', '#7bc96f', '#f2a541', '#9b59d0',
  '#e8e8e8', '#ff8a5c', '#4ecdc4',
];

export function makePlayer(x, y) {
  return {
    kind: 'player',
    x,
    y,
    angle: -Math.PI / 2,
    speed: 0,
    radius: TUNING.playerRadius,
    health: TUNING.playerHealth,
    maxHealth: TUNING.playerHealth,
    ammo: TUNING.pistolAmmo,
    maxAmmo: 90,
    onFoot: true,
    car: null,
    walkPhase: 0,
    fireCooldown: 0,
    hurtFlash: 0,
    bustHold: 0,
  };
}

export function makeCar(x, y, angle, color, driver) {
  return {
    kind: 'car',
    x,
    y,
    angle,
    speed: 0,
    radius: TUNING.carRadius,
    color,
    driver, // 'traffic' | 'parked' | 'player' | 'police' | 'courier'
    hp: 100,
    maxSpeed: TUNING.carMaxSpeed,
    axis: 'v',
    road: x,
    dir: 1,
    lane: 8,
    cruise: 150,
    stuck: 0,
    brakeLight: false,
    sirenPhase: 0,
  };
}

export function makePed(x, y, shirt) {
  return {
    kind: 'ped',
    x,
    y,
    angle: 0,
    speed: 0,
    radius: 11,
    shirt,
    state: 'walk', // 'walk' | 'flee' | 'down'
    hp: 30,
    axis: 'v',
    dir: 1,
    wander: 0,
    downTimer: 0,
  };
}

export function makeFootCop(x, y) {
  return {
    kind: 'cop',
    x,
    y,
    angle: 0,
    speed: 0,
    radius: 13,
    hp: 50,
    state: 'chase',
    shootCooldown: 0.6,
    touchTimer: 0,
  };
}

export function makeBullet(x, y, angle, from, damage) {
  return {
    kind: 'bullet',
    x,
    y,
    angle,
    from, // 'player' | 'cop'
    speed: TUNING.bulletSpeed,
    damage,
    travelled: 0,
    range: TUNING.bulletRange,
  };
}

export function makePickup(x, y, type) {
  return {
    kind: 'pickup',
    x,
    y,
    type, // 'health' | 'ammo' | 'cash'
    bob: 0,
    taken: false,
  };
}

export function makeParticle(x, y, vx, vy, life, color, size) {
  return { x, y, vx, vy, life, maxLife: life, color, size };
}

/** Walk `e` forward along its angle at `speed` for `dt` seconds. */
export function stepWalker(e, dt, speed) {
  e.speed = speed;
  e.x += Math.cos(e.angle) * speed * dt;
  e.y += Math.sin(e.angle) * speed * dt;
}

/**
 * Arcade car kinematics: throttle -1..1, steer -1..1.
 * Mutates `car` (speed, angle, x, y) and returns nothing.
 */
export function driveCar(car, throttle, steer, dt) {
  const t = TUNING;
  if (throttle > 0) {
    car.speed += t.carAccel * throttle * dt;
  } else if (throttle < 0) {
    if (car.speed > 5) car.speed -= t.carBrake * dt;
    else car.speed += t.carAccel * 0.55 * dt; // reversing
  } else {
    car.speed -= car.speed * 0.9 * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  // Rolling drag grows with speed.
  car.speed -= car.speed * 0.25 * dt;
  car.speed = clamp(car.speed, -t.carReverseMax, car.maxSpeed);
  const grip = clamp(Math.abs(car.speed) / 140, 0, 1);
  car.angle += steer * t.carTurn * grip * dt * (car.speed < 0 ? -1 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.brakeLight = throttle < 0 && car.speed > 5;
}
