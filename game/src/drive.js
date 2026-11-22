// Vice Bay's vehicles: arcade driving physics, the traffic that fills the
// roads, and parked cars the player can steal. A vehicle is a rectangle with
// a heading and a speed; steering bites harder the faster it goes, and grip
// (from the sky clock) decides how much of the velocity follows the heading.
//
// Traffic cars cruise their road's lane and wrap at the map edge; they brake
// for the car ahead in the same lane. Police cruisers are driven by cops.js,
// not by the traffic step.

import { angleDelta, clamp, makeRng, pick, randFloat, randInt } from './tools.js';
import { ROADS_H, ROADS_V, ROAD_W, resolveCircleBuildings } from './baycity.js';

export const VEHICLE_KINDS = {
  sedan: { name: 'Sedan', length: 64, width: 30, accel: 300, topSpeed: 480, grip: 5.5, color: '#c8ccd4' },
  taxi: { name: 'Taxi', length: 64, width: 30, accel: 300, topSpeed: 460, grip: 5.5, color: '#f2c230' },
  truck: { name: 'Truck', length: 92, width: 34, accel: 200, topSpeed: 380, grip: 4.5, color: '#8a6f4d' },
  bike: { name: 'Bike', length: 48, width: 18, accel: 380, topSpeed: 560, grip: 7.0, color: '#c23b3b' },
  speedster: { name: 'Speedster', length: 66, width: 30, accel: 420, topSpeed: 640, grip: 6.5, color: '#e33e7f' },
  cruiser: { name: 'Police Cruiser', length: 66, width: 30, accel: 360, topSpeed: 540, grip: 6.0, color: '#2b3a55' },
};

const TRAFFIC_COLORS = ['#b8bec8', '#7a8ba0', '#a03d3d', '#3d7aa0', '#c9a13b', '#5d7a4a', '#8a6f9b', '#d0d0d0'];

/** Makes a vehicle of a kind at a position. */
export function makeVehicle(kind, x, y, angle) {
  const spec = VEHICLE_KINDS[kind];
  return {
    kind,
    name: spec.name,
    x, y,
    angle,
    speed: 0,
    length: spec.length,
    width: spec.width,
    accel: spec.accel,
    topSpeed: spec.topSpeed,
    grip: spec.grip,
    color: kind === 'taxi' ? spec.color : pick(makeRng((x | 0) * 31 + (y | 0)), TRAFFIC_COLORS),
    brakeLight: false,
    parked: false,
    driver: null, // 'traffic' | 'player' | 'police' | null
  };
}

/**
 * Steps one driven vehicle: input {up, down, left, right}, dt seconds,
 * gripFactor from the weather. Collides with buildings and the world edge.
 */
export function stepVehicle(v, input, dt, city, gripFactor) {
  const spec = v;
  if (input.up) v.speed += spec.accel * dt;
  else if (input.down) v.speed -= spec.accel * 0.9 * dt;
  else {
    // Engine braking / drag.
    v.speed -= v.speed * 0.6 * dt;
    if (Math.abs(v.speed) < 4) v.speed = 0;
  }
  v.speed = clamp(v.speed, -170, spec.topSpeed);
  const steerAuthority = clamp(Math.abs(v.speed) / 140, 0, 1);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  v.angle += steer * 2.1 * steerAuthority * dt * (v.speed < 0 ? -1 : 1);
  // Velocity follows the heading with a grip-dependent lag (drift on rain).
  const vx = Math.cos(v.angle) * v.speed;
  const vy = Math.sin(v.angle) * v.speed;
  const blend = clamp(spec.grip * gripFactor * dt, 0, 1);
  v.vx = v.vx === undefined ? vx : v.vx + (vx - v.vx) * blend;
  v.vy = v.vy === undefined ? vy : v.vy + (vy - v.vy) * blend;
  v.x += v.vx * dt;
  v.y += v.vy * dt;
  v.brakeLight = !!input.down;
  const body = { x: v.x, y: v.y, r: Math.max(v.length, v.width) / 2 - 4 };
  const hitWall = resolveCircleBuildings(city, body);
  v.x = body.x;
  v.y = body.y;
  // A hard hit on a building at speed is a crash: flag it (boot.js turns it
  // into damage and sparks) and bleed off the speed.
  if (hitWall && Math.abs(v.speed) > 380) {
    v.crashHit = true;
    v.speed *= 0.45;
    v.vx *= 0.45;
    v.vy *= 0.45;
  }
}

/** Spawns n traffic cars spread over the roads. */
export function makeTraffic(city, rng, n) {
  const cars = [];
  const kinds = ['sedan', 'sedan', 'taxi', 'truck', 'sedan', 'bike', 'sedan', 'speedster'];
  for (let i = 0; i < n; i++) {
    const vertical = rng() < 0.5;
    const kind = pick(rng, kinds);
    let car;
    if (vertical) {
      const rx = pick(rng, ROADS_V);
      const down = rng() < 0.5;
      car = makeVehicle(kind, rx + (down ? 22 : -22), randFloat(rng, 80, city.h - 80), down ? Math.PI / 2 : -Math.PI / 2);
      car.lane = { vertical: true, fixed: rx, dir: down ? 1 : -1 };
    } else {
      const ry = pick(rng, ROADS_H);
      const right = rng() < 0.5;
      car = makeVehicle(kind, randFloat(rng, 80, city.w - 80), ry + (right ? 22 : -22), right ? 0 : Math.PI);
      car.lane = { vertical: false, fixed: ry, dir: right ? 1 : -1 };
    }
    car.speed = randFloat(rng, 130, 210);
    car.cruise = car.speed;
    car.driver = 'traffic';
    car.pause = 0;
    cars.push(car);
  }
  return cars;
}

/** Steps traffic: cruise, brake for the car ahead, wrap at the map edge. */
export function stepTraffic(cars, dt, city) {
  for (const car of cars) {
    if (car.driver !== 'traffic') continue;
    if (car.pause > 0) {
      car.pause -= dt;
      car.speed = Math.max(0, car.speed - 300 * dt);
      continue;
    }
    // Brake when a car is close ahead in the same lane.
    let ahead = null;
    let aheadGap = Infinity;
    for (const other of cars) {
      if (other === car || !other.lane || other.lane.vertical !== car.lane.vertical || other.lane.fixed !== car.lane.fixed || other.lane.dir !== car.lane.dir) continue;
      const along = car.lane.vertical ? (other.y - car.y) * car.lane.dir : (other.x - car.x) * car.lane.dir;
      if (along > 0 && along < aheadGap) { aheadGap = along; ahead = other; }
    }
    const want = ahead && aheadGap < 90 ? Math.max(0, ahead.speed - 40) : car.cruise;
    car.speed += clamp(want - car.speed, -320 * dt, 200 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the map edge.
    const m = 70;
    if (car.lane.vertical) {
      if (car.y < -m) car.y = city.h + m;
      if (car.y > city.h + m) car.y = -m;
      car.x = car.lane.fixed + (car.lane.dir === 1 ? 22 : -22);
    } else {
      if (car.x < -m) car.x = city.w + m;
      if (car.x > city.w + m) car.x = -m;
      car.y = car.lane.fixed + (car.lane.dir === 1 ? 22 : -22);
    }
  }
}

/** Draws a vehicle as a top-down car with windows, lights and a shadow. */
export function drawVehicle(ctx, v) {
  ctx.save();
  ctx.translate(v.x, v.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-v.length / 2 + 3, -v.width / 2 + 4, v.length, v.width);
  ctx.rotate(v.angle);
  const r = 8;
  ctx.fillStyle = v.color;
  roundRect(ctx, -v.length / 2, -v.width / 2, v.length, v.width, r);
  ctx.fill();
  // Cabin / windshield.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  const cab = v.length * 0.42;
  roundRect(ctx, -cab / 2 - 2, -v.width / 2 + 5, cab, v.width - 10, 5);
  ctx.fill();
  // Headlights and tail lights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(v.length / 2 - 3, -v.width / 2 + 3, 3, 7);
  ctx.fillRect(v.length / 2 - 3, v.width / 2 - 10, 3, 7);
  ctx.fillStyle = v.brakeLight ? '#ff2e2e' : '#a02020';
  ctx.fillRect(-v.length / 2, -v.width / 2 + 3, 3, 7);
  ctx.fillRect(-v.length / 2, v.width / 2 - 10, 3, 7);
  if (v.kind === 'taxi') {
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(-8, -v.width / 2 + 2, 16, 6);
  }
  if (v.kind === 'cruiser') {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-v.length / 2 + 10, -v.width / 2 + 2, v.length - 20, 5);
    ctx.fillStyle = '#c02020';
    ctx.fillRect(-4, -v.width / 2 - 2, 8, 5);
    ctx.fillStyle = '#2040c0';
    ctx.fillRect(-4, v.width / 2 - 3, 8, 5);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
