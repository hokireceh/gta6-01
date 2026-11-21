// VICE BAY — entities: player, cars, traffic, pedestrians, police, bullets.
// Written fresh for the rebuild. All updates take G (state) and dt (seconds).
import { TUNING, AVENUES, STREETS, ROAD_W, WORLD, ZONES, COLORS } from './config.js';
import { clamp, dist, angDiff, turnToward, TAU } from './random.js';
import { resolveCollision, pointBlocked, onRoad, nearestRoadPoint } from './world.js';
import { input } from './input.js';

let prevE = false;
let prevF = false;
let shotWantedCd = 0;

function carColor(rng, police) {
  if (police) return COLORS.policeCar;
  const palette = ['#e63946', '#457b9d', '#f4a261', '#90be6d', '#f9c74f', '#b5838d', '#6d6875', '#e0e0e0'];
  return rng.pick(palette);
}

export function makeCar(G, x, y, angle, kind, opts = {}) {
  return {
    x, y, angle,
    speed: opts.speed || 0,
    color: opts.color || carColor(G.rng, kind === 'police'),
    hp: TUNING.carHp,
    kind, // 'traffic' | 'parked' | 'police' | 'gold' | 'player'
    road: opts.road || 'v',
    dir: opts.dir || 1,
    driver: opts.driver !== undefined ? opts.driver : true,
    playerDriven: false,
    fireCd: 0,
    turnCd: 0,
    dead: false,
    gold: kind === 'gold',
  };
}

export function spawnWorld(G) {
  const rng = G.rng;
  G.player = {
    x: ZONES.spawn.x, y: ZONES.spawn.y, angle: -Math.PI / 2,
    hp: TUNING.playerHp, onFoot: true, car: null, speed: 0, fireCd: 0,
  };
  G.cars = [];
  // Traffic: 14 cars spread over the road grid.
  for (let i = 0; i < 14; i++) {
    const vertical = rng.chance(0.5);
    let x, y, road, dir;
    if (vertical) {
      const ax = rng.pick(AVENUES);
      dir = rng.chance(0.5) ? 1 : -1;
      x = ax + (dir === 1 ? 16 : -16);
      y = rng.range(100, WORLD.h - 100);
      road = 'v';
    } else {
      const sy = rng.pick(STREETS);
      dir = rng.chance(0.5) ? 1 : -1;
      y = sy + (dir === 1 ? 16 : -16);
      x = rng.range(100, WORLD.w - 100);
      road = 'h';
    }
    const angle = road === 'v' ? (dir === 1 ? Math.PI / 2 : -Math.PI / 2) : (dir === 1 ? 0 : Math.PI);
    G.cars.push(makeCar(G, x, y, angle, 'traffic', { road, dir, speed: rng.range(90, TUNING.trafficSpeed) }));
  }
  // Parked cars along road edges (empty, stealable without a driver to scare off).
  const parkedSpots = [
    [560, 200, 0], [860, 500, Math.PI / 2], [1160, 800, 0], [1760, 1100, -Math.PI / 2],
    [2060, 1400, Math.PI], [360, 1100, Math.PI / 2], [1460, 1700, 0], [660, 1400, Math.PI],
  ];
  for (const [x, y, a] of parkedSpots) {
    G.cars.push(makeCar(G, x, y, a, 'parked', { driver: false, speed: 0 }));
  }
  // The gold car at the docks.
  G.cars.push(makeCar(G, 2420, 450, -Math.PI / 2, 'gold', { driver: false, speed: 0, color: COLORS.goldCar }));
  // Pedestrians on the sidewalks.
  G.peds = [];
  for (let i = 0; i < 16; i++) {
    const vertical = rng.chance(0.5);
    let x, y;
    if (vertical) {
      x = rng.pick(AVENUES) + rng.pick([-46, 46]);
      y = rng.range(80, WORLD.h - 80);
    } else {
      y = rng.pick(STREETS) + rng.pick([-46, 46]);
      x = rng.range(80, WORLD.w - 80);
    }
    G.peds.push({
      x, y, angle: rng.range(0, TAU), speed: rng.range(40, TUNING.pedSpeed),
      color: rng.pick(COLORS.ped), hp: 100, down: 0, fleeUntil: 0, fleeX: 0, fleeY: 0,
      counted: false, walkPhase: rng.range(0, TAU),
    });
  }
  // Health pickups.
  G.pickups = [
    { x: 536, y: 300, taken: false, respawnAt: 0 },
    { x: 1136, y: 900, taken: false, respawnAt: 0 },
    { x: 1736, y: 1500, taken: false, respawnAt: 0 },
    { x: 836, y: 300, taken: false, respawnAt: 0 },
  ];
}

// --- Wanted ---------------------------------------------------------------
export function addWanted(G, n) {
  const before = G.wanted;
  G.wanted = clamp(G.wanted + n, 0, 5);
  if (G.wanted > before) G.lastSeenAt = G.time;
}

function nearestCopDist(G) {
  let best = Infinity;
  for (const c of G.cars) {
    if (c.kind !== 'police' || c.dead) continue;
    best = Math.min(best, dist(c.x, c.y, G.player.x, G.player.y));
  }
  for (const c of G.footCops) best = Math.min(best, dist(c.x, c.y, G.player.x, G.player.y));
  return best;
}

export function updateWanted(G, dt) {
  const d = nearestCopDist(G);
  if (d < 520) G.lastSeenAt = G.time;
  if (G.wanted > 0 && G.time - G.lastSeenAt > TUNING.wantedDecayUnseen) {
    G.wanted -= 1;
    G.lastSeenAt = G.time;
    toast(G, G.wanted === 0 ? 'Bersih! Polisi kehilangan jejakmu.' : `Wanted turun ke ${G.wanted} bintang.`);
  }
  // Keep police numbers matched to the wanted level.
  const wantCars = Math.min(G.wanted, 3);
  const wantFoot = G.wanted >= 2 ? 2 : G.wanted >= 1 ? 1 : 0;
  const haveCars = G.cars.filter((c) => c.kind === 'police' && !c.dead).length;
  if (haveCars < wantCars) spawnPoliceCar(G);
  if (haveCars > wantCars) {
    const cops = G.cars.filter((c) => c.kind === 'police' && !c.dead)
      .sort((a, b) => dist(b.x, b.y, G.player.x, G.player.y) - dist(a.x, a.y, G.player.x, G.player.y));
    cops[0].dead = true;
    G.cars = G.cars.filter((c) => !c.dead || c.playerDriven);
  }
  if (G.footCops.length < wantFoot) spawnFootCop(G);
  if (G.footCops.length > wantFoot) G.footCops.pop();
}

function spawnPoliceCar(G) {
  const rng = G.rng;
  // Spawn on a road 450–650 away from the player.
  for (let tries = 0; tries < 12; tries++) {
    const vertical = rng.chance(0.5);
    let x, y;
    if (vertical) {
      x = rng.pick(AVENUES);
      y = clamp(G.player.y + rng.pick([-1, 1]) * rng.range(450, 650), 60, WORLD.h - 60);
    } else {
      y = rng.pick(STREETS);
      x = clamp(G.player.x + rng.pick([-1, 1]) * rng.range(450, 650), 60, WORLD.w - 60);
    }
    if (dist(x, y, G.player.x, G.player.y) > 420) {
      G.cars.push(makeCar(G, x, y, 0, 'police', { speed: 120 }));
      return;
    }
  }
}

function spawnFootCop(G) {
  const p = nearestRoadPoint(G.player.x + 300, G.player.y);
  G.footCops.push({
    x: p.x, y: p.y, angle: 0, hp: 100, speed: TUNING.copFootSpeed, fireCd: 1,
  });
}

export function toast(G, text) {
  G.toast = { text, until: G.time + 3.2 };
}

// --- Shooting ---------------------------------------------------------------
export function shoot(G, fromX, fromY, angle, fromCop) {
  const b = {
    x: fromX + Math.cos(angle) * 22,
    y: fromY + Math.sin(angle) * 22,
    vx: Math.cos(angle) * (fromCop ? TUNING.copBulletSpeed : TUNING.bulletSpeed),
    vy: Math.sin(angle) * (fromCop ? TUNING.copBulletSpeed : TUNING.bulletSpeed),
    life: TUNING.bulletLife,
    damage: fromCop ? TUNING.copBulletDamage : TUNING.bulletDamage,
    fromCop,
  };
  G.bullets.push(b);
  G.parts.push({ x: b.x, y: b.y, vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60, life: 0.08, maxLife: 0.08, color: '#fff2a0', size: 5 });
  if (!fromCop) G.stats.shotsFired++;
}

export function explodeCar(G, car) {
  car.dead = true;
  for (let i = 0; i < 26; i++) {
    const a = G.rng.range(0, TAU);
    const sp = G.rng.range(60, 340);
    G.parts.push({
      x: car.x, y: car.y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: G.rng.range(0.3, 0.9), maxLife: 0.9,
      color: G.rng.pick(['#ff9f1c', '#ff6b35', '#ffd166', '#7f7f7f']),
      size: G.rng.range(3, 8),
    });
  }
  G.shake = 9;
  // Splash damage.
  for (const c of G.cars) {
    if (c === car || c.dead) continue;
    const d = dist(c.x, c.y, car.x, car.y);
    if (d < TUNING.explosionRadius) {
      c.hp -= TUNING.explosionDamage * (1 - d / TUNING.explosionRadius);
      if (c.hp <= 0) explodeCar(G, c);
    }
  }
  for (const p of G.peds) {
    if (p.down > 0) continue;
    if (dist(p.x, p.y, car.x, car.y) < TUNING.explosionRadius) p.down = 4;
  }
  const pl = G.player;
  if (dist(pl.x, pl.y, car.x, car.y) < TUNING.explosionRadius) {
    pl.hp -= car.playerDriven ? 25 : 35;
    if (pl.hp <= 0) {
      pl.hp = 0;
      G.mode = 'busted';
      toast(G, 'Kamu terkena ledakan! BUSTED.');
    }
  }
  if (car.playerDriven) {
    car.playerDriven = false;
    pl.car = null;
    pl.onFoot = true;
    pl.x = car.x + 30;
    pl.y = car.y;
    toast(G, 'Mobilmu meledak! Kamu terlempar keluar.');
  }
}

// --- Player ---------------------------------------------------------------
export function updatePlayer(G, dt) {
  const p = G.player;
  if (p.fireCd > 0) p.fireCd -= dt;
  if (shotWantedCd > 0) shotWantedCd -= dt;
  const ePressed = input.interact && !prevE;
  prevE = input.interact;
  const fPressed = input.fire && !prevF;
  prevF = input.fire;

  if (p.onFoot) {
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    const sp = input.sprint ? TUNING.sprintSpeed : TUNING.walkSpeed;
    p.x += mx * sp * dt;
    p.y += my * sp * dt;
    if (len > 0) p.angle = Math.atan2(my, mx);
    // Aim at the mouse.
    const wx = G.cam.x + input.mouse.x / G.cam.zoom;
    const wy = G.cam.y + input.mouse.y / G.cam.zoom;
    p.aimAngle = Math.atan2(wy - p.y, wx - p.x);
    resolveCollision(G, p, 12);
    if (p.hp < TUNING.hpRegenCap) p.hp = Math.min(TUNING.hpRegenCap, p.hp + TUNING.hpRegen * dt);
    // Shoot with mouse or F.
    if ((input.fire || fPressed) && p.fireCd <= 0) {
      p.fireCd = 0.22;
      shoot(G, p.x, p.y, p.aimAngle, false);
      if (shotWantedCd <= 0) { addWanted(G, 1); shotWantedCd = 3; }
    }
    if (ePressed) tryEnterCar(G);
  } else if (p.car) {
    const car = p.car;
    driveCar(G, car, dt, true);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (fPressed && p.fireCd <= 0) {
      p.fireCd = 0.3;
      shoot(G, car.x, car.y, car.angle, false);
      if (shotWantedCd <= 0) { addWanted(G, 1); shotWantedCd = 3; }
    }
    if (ePressed) exitCar(G);
  }
  // Health pickups.
  for (const pk of G.pickups) {
    if (pk.taken) {
      if (G.time >= pk.respawnAt) pk.taken = false;
      continue;
    }
    if (dist(p.x, p.y, pk.x, pk.y) < 28) {
      pk.taken = true;
      pk.respawnAt = G.time + TUNING.pickupRespawn;
      p.hp = Math.min(TUNING.playerHp, p.hp + 40);
      toast(G, '+40 HP');
    }
  }
}

function tryEnterCar(G) {
  const p = G.player;
  let best = null;
  let bestD = 58;
  for (const c of G.cars) {
    if (c.dead || c.kind === 'police') continue;
    const d = dist(p.x, p.y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best) return;
  if (best.driver) {
    // Carjack: the driver bails out and flees.
    best.driver = false;
    G.peds.push({
      x: best.x + 26, y: best.y, angle: 0, speed: TUNING.pedFleeSpeed,
      color: '#f4d35e', hp: 100, down: 0,
      fleeUntil: G.time + 3, fleeX: best.x, fleeY: best.y, counted: false,
      walkPhase: 0,
    });
    addWanted(G, 1);
    G.stats.carsStolen++;
    toast(G, 'Carjack! Wanted +1');
  }
  best.playerDriven = true;
  best.kind = best.kind === 'gold' ? 'gold' : 'player';
  p.car = best;
  p.onFoot = false;
  p.speed = 0;
}

function exitCar(G) {
  const p = G.player;
  const car = p.car;
  car.playerDriven = false;
  if (car.kind === 'player') car.kind = 'parked';
  const side = car.angle + Math.PI / 2;
  const nx = car.x + Math.cos(side) * 34;
  const ny = car.y + Math.sin(side) * 34;
  p.x = pointBlocked(G, nx, ny, 12) ? car.x - Math.cos(side) * 34 : nx;
  p.y = pointBlocked(G, nx, ny, 12) ? car.y - Math.sin(side) * 34 : ny;
  p.car = null;
  p.onFoot = true;
}

// Player / police driving model: arcade, top-down.
export function driveCar(G, car, dt, isPlayer) {
  let throttle = 0;
  let steer = 0;
  if (isPlayer) {
    throttle = (input.up ? 1 : 0) - (input.down ? 0.7 : 0);
    steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  } else if (car.ai) {
    throttle = car.ai.throttle;
    steer = car.ai.steer;
  }
  if (throttle > 0) car.speed += TUNING.carAccel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 5) car.speed -= TUNING.carBrake * dt;
    else car.speed += TUNING.carAccel * 0.6 * throttle * dt; // reverse
  } else {
    car.speed -= car.speed * 1.6 * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = clamp(car.speed, -TUNING.carReverseMax, TUNING.carMaxSpeed);
  const spdN = clamp(Math.abs(car.speed) / TUNING.carMaxSpeed, 0, 1);
  car.angle += steer * TUNING.carSteer * spdN * dt * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx;
  car.y = ny;
  if (resolveCollision(G, car, 17)) {
    car.speed *= 0.45;
    if (isPlayer && Math.abs(car.speed) > 200) {
      G.parts.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.25, maxLife: 0.25, color: '#cccccc', size: 7 });
    }
  }
}

// --- Traffic + police cars --------------------------------------------------
export function updateCars(G, dt) {
  for (const car of G.cars) {
    if (car.dead) continue;
    if (car.kind === 'traffic') {
      updateTraffic(G, car, dt);
    } else if (car.kind === 'police') {
      updatePoliceCar(G, car, dt);
    }
    // Simple car-car separation.
    for (const other of G.cars) {
      if (other === car || other.dead) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d > 0.01 && d < 36) {
        const push = (36 - d) / 2;
        const ux = (car.x - other.x) / d;
        const uy = (car.y - other.y) / d;
        car.x += ux * push;
        car.y += uy * push;
        other.x -= ux * push;
        other.y -= uy * push;
        car.speed *= 0.92;
        other.speed *= 0.92;
      }
    }
    // Run over pedestrians.
    if (Math.abs(car.speed) > 150) {
      for (const ped of G.peds) {
        if (ped.down > 0) continue;
        if (dist(car.x, car.y, ped.x, ped.y) < 26) {
          ped.down = 3.5;
          G.stats.pedsHit++;
          if (car.playerDriven) { addWanted(G, 1); toast(G, 'Kamu menabrak pejalan kaki! Wanted +1'); }
        }
      }
    }
    if (car.hp <= 0 && !car.dead) explodeCar(G, car);
  }
  G.cars = G.cars.filter((c) => !c.dead || c.playerDriven);
}

function updateTraffic(G, car, dt) {
  // Slow down if a car is right ahead in the same lane.
  let target = TUNING.trafficSpeed;
  for (const other of G.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 58 && side < 20) { target = 30; break; }
  }
  car.speed += (target - car.speed) * Math.min(1, 2.2 * dt);
  car.turnCd -= dt;
  // Follow the road grid; at intersections sometimes turn.
  if (car.road === 'v') {
    car.x += (car.dir === 1 ? 16 : -16) * 0 + 0; // lane offset is baked into x
    car.y += car.dir * car.speed * dt;
    car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    if (car.turnCd <= 0) {
      for (const sy of STREETS) {
        if (Math.abs(car.y - sy) < 12 && G.rng.chance(0.35)) {
          car.road = 'h';
          car.dir = G.rng.chance(0.5) ? 1 : -1;
          car.y = sy + (car.dir === 1 ? 16 : -16);
          car.turnCd = 2.5;
          break;
        }
      }
    }
    if (car.y > WORLD.h - 40) { car.dir = -1; car.y = WORLD.h - 40; }
    if (car.y < 40) { car.dir = 1; car.y = 40; }
  } else {
    car.x += car.dir * car.speed * dt;
    car.angle = car.dir === 1 ? 0 : Math.PI;
    if (car.turnCd <= 0) {
      for (const ax of AVENUES) {
        if (Math.abs(car.x - ax) < 12 && G.rng.chance(0.35)) {
          car.road = 'v';
          car.dir = G.rng.chance(0.5) ? 1 : -1;
          car.x = ax + (car.dir === 1 ? 16 : -16);
          car.turnCd = 2.5;
          break;
        }
      }
    }
    if (car.x > WORLD.w - 40) { car.dir = -1; car.x = WORLD.w - 40; }
    if (car.x < 40) { car.dir = 1; car.x = 40; }
  }
  resolveCollision(G, car, 17);
}

function updatePoliceCar(G, car, dt) {
  const p = G.player;
  const want = Math.atan2(p.y - car.y, p.x - car.x);
  const d = dist(car.x, car.y, p.x, p.y);
  const steer = clamp(angDiff(car.angle, want) * 1.6, -1, 1);
  car.ai = { throttle: d > 60 ? 1 : 0.2, steer };
  driveCar(G, car, dt, false);
  car.fireCd -= dt;
  if (d < 430 && car.fireCd <= 0 && G.wanted > 0) {
    car.fireCd = TUNING.copFireInterval;
    const spread = G.rng.range(-0.14, 0.14);
    shoot(G, car.x, car.y, want + spread, true);
  }
  if (d < 28) G.bustedTouch += dt;
}

// --- Pedestrians + foot cops -------------------------------------------------
export function updatePeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    // Flee from a fast car or a gunshot nearby.
    let flee = G.time < ped.fleeUntil;
    if (!flee) {
      for (const car of G.cars) {
        if (car.dead) continue;
        if (Math.abs(car.speed) > 180 && dist(car.x, car.y, ped.x, ped.y) < 130) {
          flee = true;
          ped.fleeUntil = G.time + 2;
          ped.fleeX = car.x;
          ped.fleeY = car.y;
          break;
        }
      }
    }
    if (flee) {
      const a = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
      ped.x += Math.cos(a) * TUNING.pedFleeSpeed * dt;
      ped.y += Math.sin(a) * TUNING.pedFleeSpeed * dt;
      ped.angle = a;
    } else {
      ped.walkPhase += dt * 2;
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (!onRoad(ped.x, ped.y) && G.rng.chance(0.01)) ped.angle += G.rng.range(-1.2, 1.2);
      if (ped.x < 40 || ped.x > WORLD.w - 40 || ped.y < 40 || ped.y > WORLD.h - 40) {
        ped.angle += Math.PI;
        ped.x = clamp(ped.x, 40, WORLD.w - 40);
        ped.y = clamp(ped.y, 40, WORLD.h - 40);
      }
      if (G.rng.chance(0.002)) ped.angle = G.rng.range(0, TAU);
    }
    resolveCollision(G, ped, 10);
  }
  // Remove fled/downed peds that are far away and old? Keep the crowd stable: top up.
  G.peds = G.peds.filter((ped) => ped.down > 0 || dist(ped.x, ped.y, p.x, p.y) < 1400);
  while (G.peds.length < 14) {
    const pt = nearestRoadPoint(p.x + G.rng.range(-500, 500), p.y + G.rng.range(-500, 500));
    G.peds.push({
      x: clamp(pt.x + G.rng.pick([-46, 46]), 40, WORLD.w - 40),
      y: clamp(pt.y + G.rng.pick([-46, 46]), 40, WORLD.h - 40),
      angle: G.rng.range(0, TAU), speed: G.rng.range(40, TUNING.pedSpeed),
      color: G.rng.pick(COLORS.ped), hp: 100, down: 0, fleeUntil: 0, fleeX: 0, fleeY: 0,
      counted: false, walkPhase: 0,
    });
  }
  // Foot cops chase and shoot.
  for (const cop of G.footCops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    const a = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle = a;
    if (d > 24) {
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
    }
    resolveCollision(G, cop, 11);
    cop.fireCd -= dt;
    if (d < 320 && cop.fireCd <= 0 && G.wanted > 0) {
      cop.fireCd = TUNING.copFireInterval;
      shoot(G, cop.x, cop.y, a + G.rng.range(-0.12, 0.12), true);
    }
    if (d < 26) G.bustedTouch += dt;
  }
}

// --- Bullets + particles ------------------------------------------------------
export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (pointBlocked(G, b.x, b.y, 2)) {
      b.life = 0;
      G.parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.12, maxLife: 0.12, color: '#ffe66d', size: 4 });
      continue;
    }
    if (b.fromCop) {
      const p = G.player;
      if (dist(b.x, b.y, p.x, p.y) < 15) {
        p.hp -= b.damage;
        b.life = 0;
        G.shake = 4;
        if (p.hp <= 0) {
          p.hp = 0;
          G.mode = 'busted';
          G.bustedTouch = 0;
          toast(G, 'Kamu ditembak jatuh! BUSTED.');
        }
      }
      continue;
    }
    // Player bullets: peds, foot cops, cars.
    for (const ped of G.peds) {
      if (ped.down > 0) continue;
      if (dist(b.x, b.y, ped.x, ped.y) < 14) {
        ped.hp -= b.damage;
        b.life = 0;
        if (ped.hp <= 0) {
          ped.down = 4;
          if (!ped.counted) { ped.counted = true; addWanted(G, 1); }
        } else {
          ped.fleeUntil = G.time + 2.5;
          ped.fleeX = G.player.x;
          ped.fleeY = G.player.y;
        }
        break;
      }
    }
    if (b.life <= 0) continue;
    for (const cop of G.footCops) {
      if (dist(b.x, b.y, cop.x, cop.y) < 14) {
        cop.hp -= b.damage;
        b.life = 0;
        if (cop.hp <= 0) {
          G.footCops = G.footCops.filter((c) => c !== cop);
          addWanted(G, 1);
          toast(G, 'Polisi tumbang! Wanted +1');
        }
        break;
      }
    }
    if (b.life <= 0) continue;
    for (const car of G.cars) {
      if (car.dead || car.playerDriven) continue;
      if (dist(b.x, b.y, car.x, car.y) < 26) {
        car.hp -= b.damage;
        b.life = 0;
        if (car.hp <= 0) explodeCar(G, car);
        break;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
}

export function updateParticles(G, dt) {
  for (const pt of G.parts) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
    pt.life -= dt;
  }
  G.parts = G.parts.filter((pt) => pt.life > 0);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - 22 * dt);
}
