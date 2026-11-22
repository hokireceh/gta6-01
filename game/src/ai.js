// Vice Bay — the city's brains: traffic, pedestrians and police pursuit.

import { TUNING } from './config.js';
import { angleDiff, angleTo, angleToward, clamp, dist } from './math.js';
import { driveCar, stepWalker } from './entities.js';
import { collideCircle, isOnRoad, nearestRoadPoint } from './world.js';

/**
 * Traffic cars cruise their road, slow for the car ahead, and sometimes
 * turn at an intersection. `others` is every car, for spacing.
 */
export function updateTraffic(world, cars, others, dt, rng) {
  for (const car of cars) {
    if (car.driver !== 'traffic') continue;
    // Keep the car glued to its lane.
    if (car.axis === 'v') car.x += (car.road + car.lane * car.dir - car.x) * Math.min(1, 4 * dt);
    else car.y += (car.road + car.lane * car.dir - car.y) * Math.min(1, 4 * dt);
    // Slow down for a car ahead on the same road.
    let target = car.cruise;
    for (const o of others) {
      if (o === car || o.driver === 'parked') continue;
      if (car.axis === 'v' && o.axis === 'v' && Math.abs(o.x - car.x) < 46) {
        const ahead = (o.y - car.y) * car.dir;
        if (ahead > 0 && ahead < 110) target = Math.min(target, Math.max(0, o.speed * 0.9));
      }
      if (car.axis === 'h' && o.axis === 'h' && Math.abs(o.y - car.y) < 46) {
        const ahead = (o.x - car.x) * car.dir;
        if (ahead > 0 && ahead < 110) target = Math.min(target, Math.max(0, o.speed * 0.9));
      }
    }
    const wantAngle = car.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.angle = angleToward(car.angle, wantAngle, 3 * dt);
    const throttle = car.speed < target ? 0.7 : 0;
    driveCar(car, throttle, 0, dt);
    car.speed = clamp(car.speed, 0, car.cruise + 40);
    // Maybe turn at an intersection.
    const onCross = isOnRoad(world, car.x, car.y) &&
      world.avenues.some((ax) => Math.abs(car.x - ax) < 40) &&
      world.streets.some((sy) => Math.abs(car.y - sy) < 40);
    if (onCross && rng.chance(dt * 0.25)) {
      if (car.axis === 'v' && rng.chance(0.5)) {
        const p = nearestRoadPoint(world, car.x, car.y);
        car.axis = 'h';
        car.road = p.y;
        car.dir = rng.chance(0.5) ? 1 : -1;
        car.lane = 8;
      } else if (car.axis === 'h' && rng.chance(0.5)) {
        const p = nearestRoadPoint(world, car.x, car.y);
        car.axis = 'v';
        car.road = p.x;
        car.dir = rng.chance(0.5) ? 1 : -1;
        car.lane = 8;
      }
    }
    // Wrap around the map edge instead of driving off it.
    if (car.axis === 'v' && (car.y < 40 || car.y > 2560)) car.dir *= -1;
    if (car.axis === 'h' && (car.x < 40 || car.x > 3560)) car.dir *= -1;
    collideCircle(world, car, car.radius);
  }
}

/** Pedestrians stroll the sidewalks and flee from danger. */
export function updatePeds(world, peds, danger, dt, rng) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) ped.state = 'walk';
      continue;
    }
    const d = danger ? dist(ped.x, ped.y, danger.x, danger.y) : Infinity;
    if (danger && d < 170) {
      ped.state = 'flee';
      ped.angle = angleTo(danger.x, danger.y, ped.x, ped.y);
      stepWalker(ped, dt, 240);
    } else {
      if (ped.state === 'flee' && d > 320) ped.state = 'walk';
      if (ped.state === 'walk') {
        ped.wander -= dt;
        if (ped.wander <= 0) {
          ped.wander = rng.range(2, 6);
          if (rng.chance(0.35)) ped.dir *= -1;
          if (rng.chance(0.2)) {
            ped.axis = ped.axis === 'v' ? 'h' : 'v';
          }
        }
        const want = ped.axis === 'v'
          ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (ped.dir > 0 ? 0 : Math.PI);
        ped.angle = angleToward(ped.angle, want, 5 * dt);
        stepWalker(ped, dt, 62);
        if (ped.axis === 'v' && (ped.y < 60 || ped.y > 2540)) ped.dir *= -1;
        if (ped.axis === 'h' && (ped.x < 60 || ped.x > 3540)) ped.dir *= -1;
      }
    }
    collideCircle(world, ped, ped.radius);
  }
}

/**
 * A police car chases `target` (the player, on foot or in a car):
 * steer hard, ram to slow them down.
 */
export function updatePoliceCar(world, cop, target, dt) {
  const want = angleTo(cop.x, cop.y, target.x, target.y);
  const diff = angleDiff(cop.angle, want);
  const steer = clamp(diff * 1.6, -1, 1);
  const d = dist(cop.x, cop.y, target.x, target.y);
  const throttle = d > 60 ? 1 : 0.4;
  cop.maxSpeed = TUNING.copCarSpeed;
  driveCar(cop, throttle, steer, dt);
  cop.sirenPhase += dt * 6;
  collideCircle(world, cop, cop.radius);
  return d;
}

/** A foot cop runs at the player and tries to hold them for a bust. */
export function updateFootCop(world, cop, player, dt) {
  cop.angle = angleTo(cop.x, cop.y, player.x, player.y);
  stepWalker(cop, dt, TUNING.copFootSpeed);
  collideCircle(world, cop, cop.radius);
  return dist(cop.x, cop.y, player.x, player.y);
}
