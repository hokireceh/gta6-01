// VICE BAY — the non-player minds: traffic that follows the road grid,
// pedestrians that wander and flee, and police that hunt the player. Each
// step function takes the game state, the city and the RNG, and mutates the
// state in place. Nothing here draws anything.

import { WORLD_SIZE, ROAD_WIDTH, TUNING } from "./config.js";
import { clamp, distance, angleTo, steerToward } from "./math.js";
import { makeCar, makeBullet } from "./entities.js";
import { flash } from "./combat.js";

export function stepTraffic(g, city, random, dt) {
  for (const car of g.cars) {
    if (car.dead || car.police) continue;
    if (g.player.inCar === car) continue;
    if (car.parked) continue;
    car.turnTimer -= dt;
    const vertical = car.road === "v";
    const center = city.nearestRoad(vertical ? car.x : car.y);
    const laneTarget = center + car.lane * 22;
    const along = vertical ? car.x : car.y;
    const laneError = laneTarget - along;
    const heading = vertical
      ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (car.dir > 0 ? 0 : Math.PI);
    const desired = heading + clamp(laneError * 0.02, -0.5, 0.5);
    car.angle = steerToward(car.angle, desired, TUNING.trafficSteer * dt);

    let blocked = false;
    for (const other of g.cars) {
      if (other === car || other.dead) continue;
      if (distance(car.x, car.y, other.x, other.y) >= 70) continue;
      const ahead = Math.cos(angleTo(car.x, car.y, other.x, other.y) - car.angle);
      if (ahead > 0.5) { blocked = true; break; }
    }
    const cruise = blocked ? 0 : random.range(TUNING.trafficSpeedMin, TUNING.trafficSpeedMax);
    car.speed += clamp(cruise - car.speed, -300 * dt, 200 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!city.hitsBuilding(nx, ny, 24)) {
      car.x = nx;
      car.y = ny;
    } else {
      car.speed = 0;
      car.turnTimer = 0;
    }
    if (car.turnTimer <= 0) {
      const cross = vertical ? car.y : car.x;
      const nearCrossing = Math.abs(cross - city.nearestRoad(cross)) < 60;
      if (nearCrossing && random.chance(0.5)) {
        car.road = vertical ? "h" : "v";
        car.dir = random.chance(0.5) ? 1 : -1;
        car.lane = random.chance(0.5) ? -1 : 1;
      }
      car.turnTimer = random.range(2, 6);
    }
    if (car.x < 60 || car.x > WORLD_SIZE - 60 || car.y < 60 || car.y > WORLD_SIZE - 60) {
      const goVertical = random.chance(0.5);
      const line = random.pick(city.roads);
      car.x = goVertical ? line : random.range(100, WORLD_SIZE - 100);
      car.y = goVertical ? random.range(100, WORLD_SIZE - 100) : line;
      car.road = goVertical ? "v" : "h";
    }
  }
}

export function stepPedestrians(g, city, random, dt) {
  for (const ped of g.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      if (ped.down <= 0) ped.state = "walk";
      continue;
    }
    let threat = null;
    let threatDist = Infinity;
    for (const car of g.cars) {
      if (car.dead) continue;
      const d = distance(ped.x, ped.y, car.x, car.y);
      if (d < TUNING.pedFleeRadius && Math.abs(car.speed) > 80 && d < threatDist) {
        threat = car;
        threatDist = d;
      }
    }
    if (threat) {
      ped.state = "flee";
    } else if (ped.state === "flee") {
      ped.state = "walk";
    }
    if (ped.state === "flee" && threat) {
      const away = angleTo(threat.x, threat.y, ped.x, ped.y);
      ped.angle = away;
      const nx = ped.x + Math.cos(away) * TUNING.pedFleeSpeed * dt;
      const ny = ped.y + Math.sin(away) * TUNING.pedFleeSpeed * dt;
      if (!city.hitsBuilding(nx, ped.y, 12)) ped.x = nx;
      if (!city.hitsBuilding(ped.x, ny, 12)) ped.y = ny;
    } else {
      ped.driftLeft -= dt;
      if (ped.driftLeft <= 0) {
        ped.angle = random.range(0, Math.PI * 2);
        ped.driftLeft = random.range(1.5, 5);
      }
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (!city.hitsBuilding(nx, ny, 12) && nx > 40 && nx < WORLD_SIZE - 40 && ny > 40 && ny < WORLD_SIZE - 40) {
        ped.x = nx;
        ped.y = ny;
      } else {
        ped.angle = random.range(0, Math.PI * 2);
      }
    }
  }
}

export function stepPolice(g, city, random, dt, onBusted) {
  const player = g.player;
  const wanted = Math.min(g.wanted, 4);
  const active = g.cars.filter((c) => c.police && !c.dead).length;
  if (active < wanted && random.next() < dt * 0.8) {
    const bearing = random.range(0, Math.PI * 2);
    const sx = clamp(player.x + Math.cos(bearing) * TUNING.policeSpawnDistance, 100, WORLD_SIZE - 100);
    const sy = clamp(player.y + Math.sin(bearing) * TUNING.policeSpawnDistance, 100, WORLD_SIZE - 100);
    const unit = makeCar(city.nearestRoad(sx), sy, 0, {
      police: true, color: "#1c1c22", road: "v",
    }, random);
    unit.speed = 200;
    g.cars.push(unit);
  }
  for (const unit of g.cars) {
    if (!unit.police || unit.dead) continue;
    const d = distance(unit.x, unit.y, player.x, player.y);
    unit.speed = Math.min(TUNING.policeTopSpeed, unit.speed + TUNING.policeAccel * dt);
    const chaseAngle = angleTo(unit.x, unit.y, player.x, player.y);
    // Probe the direct chase line: if a building sits 40 units ahead in
    // that direction, do not steer toward it at all — steer only along the
    // road grid, or the two steerings fight and the unit hovers in place.
    const probeX = unit.x + Math.cos(chaseAngle) * 40;
    const probeY = unit.y + Math.sin(chaseAngle) * 40;
    const chaseBlocked = city.hitsBuilding(probeX, probeY, 24);
    if (!chaseBlocked) {
      unit.angle = steerToward(unit.angle, chaseAngle, TUNING.policeSteer * dt);
      const nx = unit.x + Math.cos(unit.angle) * unit.speed * dt;
      const ny = unit.y + Math.sin(unit.angle) * unit.speed * dt;
      if (!city.hitsBuilding(nx, ny, 24)) {
        unit.x = clamp(nx, 50, WORLD_SIZE - 50);
        unit.y = clamp(ny, 50, WORLD_SIZE - 50);
      }
    } else {
      // Straight chase is blocked by a building: follow the road grid
      // instead. Drive along the road the unit is on toward the player's
      // axis, turning at intersections — that routes the chaser around
      // blocks instead of letting it grind against a corner for seconds.
      unit.speed *= 0.85;
      const onVertical = city.roads.some((line) => Math.abs(unit.x - line) < ROAD_WIDTH / 2);
      const onHorizontal = city.roads.some((line) => Math.abs(unit.y - line) < ROAD_WIDTH / 2);
      let followAngle;
      if (onVertical && onHorizontal) {
        followAngle = Math.abs(player.x - unit.x) > Math.abs(player.y - unit.y)
          ? (player.x > unit.x ? 0 : Math.PI)
          : (player.y > unit.y ? Math.PI / 2 : -Math.PI / 2);
      } else if (onVertical) {
        followAngle = player.y > unit.y ? Math.PI / 2 : -Math.PI / 2;
      } else if (onHorizontal) {
        followAngle = player.x > unit.x ? 0 : Math.PI;
      } else {
        const roadX = city.nearestRoad(unit.x);
        const roadY = city.nearestRoad(unit.y);
        followAngle = Math.abs(roadX - unit.x) < Math.abs(roadY - unit.y)
          ? angleTo(unit.x, unit.y, roadX, unit.y)
          : angleTo(unit.x, unit.y, unit.x, roadY);
      }
      unit.angle = steerToward(unit.angle, followAngle, TUNING.policeSteer * dt);
      const fx = unit.x + Math.cos(unit.angle) * unit.speed * dt;
      const fy = unit.y + Math.sin(unit.angle) * unit.speed * dt;
      if (!city.hitsBuilding(fx, fy, 24)) {
        unit.x = clamp(fx, 50, WORLD_SIZE - 50);
        unit.y = clamp(fy, 50, WORLD_SIZE - 50);
      } else {
        unit.angle += TUNING.policeSteer * dt * 0.5;
      }
    }
    unit.gunTimer -= dt;
    if (unit.gunTimer <= 0 && d < TUNING.policeShootRange) {
      unit.gunTimer = random.range(0.7, 1.1);
      const aim = angleTo(unit.x, unit.y, player.x, player.y) + random.range(-0.14, 0.14);
      g.bullets.push(makeBullet(unit.x, unit.y, aim, TUNING.policeBulletSpeed, TUNING.policeBulletLife, false));
    }
    if (player.onFoot && d < 34) {
      onBusted("Polisi menangkapmu!");
      return;
    }
    if (player.inCar && d < 46) {
      player.inCar.health -= TUNING.policeRamDamage * dt;
      unit.speed *= 0.6;
    }
  }
  const policeNear = g.cars.some(
    (c) => c.police && !c.dead && distance(c.x, c.y, player.x, player.y) < TUNING.wantedDecayRadius,
  );
  if (g.wanted > 0 && !policeNear) {
    g.wantedCooldown += dt;
    if (g.wantedCooldown > TUNING.wantedDecaySeconds) {
      g.wanted -= 1;
      g.wantedCooldown = 0;
      flash(g, "Wanted turun: " + g.wanted + " bintang");
    }
  } else {
    g.wantedCooldown = 0;
  }
}
