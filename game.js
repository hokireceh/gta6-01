// ============================================================================
// VICE BAY — a 2D top-down open-world crime game.
// Walk, steal cars, outrun the cops, run 5 story jobs, become King of the Bay.
// Single file, no dependencies, no external assets, fully offline.
// ============================================================================
'use strict';

// ---------------- utils ----------------
const TAU = Math.PI * 2;
function rand(a, b) { return a + Math.random() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); }
function angTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }
function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
// Push a circle out of a rect; returns true if it overlapped.
function resolveCircleRect(e, rx, ry, rw, rh) {
  const nx = clamp(e.x, rx, rx + rw), ny = clamp(e.y, ry, ry + rh);
  let dx = e.x - nx, dy = e.y - ny;
  let d2 = dx * dx + dy * dy;
  if (d2 >= e.r * e.r) return false;
  if (d2 < 0.0001) {
    // Center inside the rect: push out along the smallest penetration axis.
    const left = e.x - rx, right = rx + rw - e.x, top = e.y - ry, bot = ry + rh - e.y;
    const m = Math.min(left, right, top, bot);
    if (m === left) e.x = rx - e.r;
    else if (m === right) e.x = rx + rw + e.r;
    else if (m === top) e.y = ry - e.r;
    else e.y = ry + rh + e.r;
    return true;
  }
  const d = Math.sqrt(d2);
  e.x = nx + (dx / d) * e.r;
  e.y = ny + (dy / d) * e.r;
  return true;
}

// ---------------- world ----------------
const WORLD_W = 3600;
const WORLD_H = 2600;
const ROAD_W = 110;
const V_ROADS = [300, 900, 1500, 2100, 2700, 3300];
const H_ROADS = [300, 800, 1300, 1800, 2300];
const WATER_Y = 2440; // bay along the bottom edge

const BUILD_COLORS = ['#2b2b4a', '#3a2b4a', '#2b3a4a', '#46303a', '#33304a', '#2e4038'];
const NEON = ['#ff2d55', '#ffd60a', '#00e5ff', '#7dff9b', '#ff9f0a', '#bf5af2'];
const CAR_COLORS = ['#c0392b', '#2980b9', '#f39c12', '#27ae60', '#8e44ad', '#e67e22', '#ecf0f1', '#1abc9c', '#d35400', '#7f8c8d'];

const LOC = {
  garage: { x: 1500, y: 800, name: 'Garage' },
  package: { x: 2700, y: 1800, name: 'Package' },
  dropoff: { x: 900, y: 2300, name: 'Drop-off' },
  store: { x: 2100, y: 1300, name: 'Liquor store' },
  safehouse: { x: 300, y: 300, name: 'Safehouse' },
  docks: { x: 3050, y: 2300, name: 'Docks' },
  penthouse: { x: 3300, y: 300, name: 'Penthouse garage' },
  hospital: { x: 900, y: 1300, name: 'Hospital' },
  police: { x: 2100, y: 800, name: 'Police HQ' },
};

const buildings = []; // {x,y,w,h,color,neon}
const parks = [];     // {x,y,w,h,trees:[{x,y}]}
const trees = [];

function isOnRoad(x, y) {
  for (const rx of V_ROADS) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of H_ROADS) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}
function insideBuilding(x, y, pad) {
  for (const b of buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
  }
  return false;
}

function genWorld() {
  buildings.length = 0; parks.length = 0; trees.length = 0;
  const parkBlocks = new Set(['1,1', '3,2', '0,3', '4,1']);
  for (let i = 0; i < V_ROADS.length - 1; i++) {
    for (let j = 0; j < H_ROADS.length - 1; j++) {
      const x0 = V_ROADS[i] + ROAD_W / 2 + 24;
      const x1 = V_ROADS[i + 1] - ROAD_W / 2 - 24;
      const y0 = H_ROADS[j] + ROAD_W / 2 + 24;
      const y1 = H_ROADS[j + 1] - ROAD_W / 2 - 24;
      if (y1 > WATER_Y) continue;
      const key = i + ',' + j;
      if (parkBlocks.has(key)) {
        const p = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: [] };
        for (let t = 0; t < 7; t++) {
          p.trees.push({ x: rand(x0 + 20, x1 - 20), y: rand(y0 + 20, y1 - 20) });
        }
        parks.push(p);
        trees.push(...p.trees);
        continue;
      }
      // One or two buildings per block, leaving walkable gaps.
      const bw = x1 - x0, bh = y1 - y0;
      const n = (bw > 420 && bh > 300) ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = rand(150, Math.min(260, bw - 40));
        const h = rand(120, Math.min(200, bh - 40));
        const bx = n === 1 ? x0 + (bw - w) / 2 : x0 + (k === 0 ? 10 : bw - w - 10);
        const by = n === 1 ? y0 + (bh - h) / 2 : y0 + rand(10, Math.max(11, bh - h - 10));
        buildings.push({ x: bx, y: by, w, h, color: pick(BUILD_COLORS), neon: pick(NEON) });
      }
    }
  }
}

// ---------------- state ----------------
const SAVE_KEY = 'vicebay-save-v1';
const G = {
  mode: 'menu', // menu | play | pause | busted | wasted | win
  time: 0,
  money: 0,
  wanted: 0,          // 0..5 float
  heatTimer: 0,       // seconds since last crime / cop sighting
  mission: 0,         // index into MISSIONS, 5 = done
  step: 0,
  marker: null,       // {x,y,label}
  markerPulse: 0,
  player: null,
  car: null,          // car the player is driving
  cars: [],           // all cars
  peds: [],
  cops: [],           // foot cops
  bullets: [],
  parts: [],
  pickups: [],
  goldCar: null,
  stats: { kills: 0, stolen: 0, shots: 0, missions: 0 },
  cam: { x: 0, y: 0 },
  msg: '',
  msgT: 0,
  shake: 0,
  saveTimer: 0,
  missionTimer: 0,    // countdown for timed mission steps
  bustedTimer: 0,     // cop contact accumulator
  muted: false,
};

function newPlayer(x, y) {
  return {
    x, y, r: 13, angle: -Math.PI / 2, speed: 0,
    hp: 100, maxHp: 100, onFoot: true,
    fireCd: 0, hurtCd: 0, regenDelay: 0,
    walkPhase: 0, moving: false,
  };
}

// ---------------- input ----------------
const keys = {};
const mouse = { x: 0, y: 0, down: false, wx: 0, wy: 0 };
let canvas, ctx, minimap, mmctx;

function setupInput() {
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
    if (e.key.toLowerCase() === 'p' || e.key === 'Escape') togglePause();
    if (e.key.toLowerCase() === 'm') toggleMinimapZoom();
    if (e.key.toLowerCase() === 'e') onInteractKey();
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) mouse.down = true; });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; });
}

function keyDown(...names) { return names.some((n) => keys[n]); }

// ---------------- spawning ----------------
function randomRoadPoint(nearX, nearY, minD, maxD) {
  for (let tries = 0; tries < 40; tries++) {
    const vertical = Math.random() < 0.5;
    let x, y;
    if (vertical) {
      x = pick(V_ROADS) + rand(-28, 28);
      y = rand(60, WORLD_H - 60);
    } else {
      x = rand(60, WORLD_W - 60);
      y = pick(H_ROADS) + rand(-28, 28);
    }
    if (y > WATER_Y - 40) continue;
    if (nearX !== undefined) {
      const d = dist(x, y, nearX, nearY);
      if (d < minD || d > maxD) continue;
    }
    if (insideBuilding(x, y, 20)) continue;
    return { x, y, vertical };
  }
  return { x: 1500, y: 800, vertical: true };
}

function makeCar(x, y, angle, type, driver) {
  const maxSpeed = type === 'sport' ? 520 : type === 'truck' ? 300 : type === 'police' ? 560 : 380;
  return {
    x, y, r: 22, angle, speed: 0,
    type, driver, // 'traffic' | 'player' | 'none' | 'police'
    color: type === 'police' ? '#1c2733' : type === 'sport' ? '#ffd60a' : pick(CAR_COLORS),
    maxSpeed, hp: 100, dead: false, smokeT: 0,
    // traffic AI
    axis: 'y', dir: 1, roadIdx: 0, turnCd: 0, stuckT: 0,
    targetSpeed: rand(90, 150),
  };
}

function spawnTrafficCar(nearPlayer) {
  const p = G.player;
  const pt = randomRoadPoint(nearPlayer ? p.x : undefined, nearPlayer ? p.y : undefined, 500, 1400);
  const vertical = pt.vertical;
  const axis = vertical ? 'y' : 'x';
  const dir = Math.random() < 0.5 ? 1 : -1;
  const angle = axis === 'y' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  const type = Math.random() < 0.12 ? 'sport' : Math.random() < 0.12 ? 'truck' : 'sedan';
  const car = makeCar(pt.x, pt.y, angle, type, 'traffic');
  car.axis = axis; car.dir = dir;
  car.roadIdx = axis === 'y' ? V_ROADS.indexOf(nearestRoad(V_ROADS, pt.x)) : H_ROADS.indexOf(nearestRoad(H_ROADS, pt.y));
  car.speed = car.targetSpeed;
  G.cars.push(car);
  return car;
}

function nearestRoad(list, v) {
  let best = list[0], bd = 1e9;
  for (const r of list) { const d = Math.abs(r - v); if (d < bd) { bd = d; best = r; } }
  return best;
}

function spawnParkedCars() {
  // Parked cars along road edges, stealable.
  for (let i = 0; i < 16; i++) {
    const vertical = Math.random() < 0.5;
    let x, y, angle;
    if (vertical) {
      x = pick(V_ROADS) + (Math.random() < 0.5 ? -42 : 42);
      y = rand(200, WATER_Y - 200);
      angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = rand(200, WORLD_W - 200);
      y = pick(H_ROADS) + (Math.random() < 0.5 ? -42 : 42);
      angle = Math.random() < 0.5 ? 0 : Math.PI;
    }
    if (insideBuilding(x, y, 10)) continue;
    const car = makeCar(x, y, angle, Math.random() < 0.2 ? 'sport' : 'sedan', 'none');
    G.cars.push(car);
  }
  // The golden car for the final job, parked at the docks.
  const gold = makeCar(LOC.docks.x + 60, LOC.docks.y, 0, 'sport', 'none');
  gold.color = '#ffd60a';
  gold.gold = true;
  G.cars.push(gold);
  G.goldCar = gold;
}

function spawnPed(nearPlayer) {
  const p = G.player;
  let x, y, tries = 0;
  do {
    x = clamp(p.x + rand(-900, 900), 60, WORLD_W - 60);
    y = clamp(p.y + rand(-700, 700), 60, WATER_Y - 60);
    tries++;
  } while ((insideBuilding(x, y, 14) || isOnRoad(x, y)) && tries < 30);
  const ped = {
    x, y, r: 11, angle: rand(0, TAU), speed: rand(28, 55),
    state: 'walk', // walk | flee | down
    color: pick(['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1']),
    tx: x, ty: y, waitT: 0, hp: 30, fleeT: 0, downT: 0,
  };
  G.peds.push(ped);
  return ped;
}

function spawnPoliceCar() {
  const p = G.player;
  const pt = randomRoadPoint(p.x, p.y, 500, 800);
  const car = makeCar(pt.x, pt.y, angTo(pt.x, pt.y, p.x, p.y), 'police', 'police');
  car.speed = 200;
  G.cars.push(car);
  return car;
}

function spawnFootCop() {
  const p = G.player;
  const pt = randomRoadPoint(p.x, p.y, 260, 500);
  const cop = {
    x: pt.x, y: pt.y, r: 12, angle: angTo(pt.x, pt.y, p.x, p.y),
    speed: 150, hp: 50, fireCd: rand(0.5, 1.2), state: 'chase',
  };
  G.cops.push(cop);
  return cop;
}

function spawnPickup(x, y, kind) {
  G.pickups.push({ x, y, kind, r: 14, bob: rand(0, TAU) });
}

// ---------------- player: on foot ----------------
function updatePlayerFoot(dt) {
  const p = G.player;
  let mx = 0, my = 0;
  if (keyDown('w', 'arrowup')) my -= 1;
  if (keyDown('s', 'arrowdown')) my += 1;
  if (keyDown('a', 'arrowleft')) mx -= 1;
  if (keyDown('d', 'arrowright')) mx += 1;
  const run = keyDown('shift');
  const sp = run ? 265 : 175;
  const len = Math.hypot(mx, my);
  p.moving = len > 0;
  if (len > 0) {
    mx /= len; my /= len;
    p.x += mx * sp * dt;
    p.y += my * sp * dt;
    p.walkPhase += dt * (run ? 14 : 10);
  }
  // Aim at the mouse.
  p.angle = Math.atan2(mouse.wy - p.y, mouse.wx - p.x);
  // World bounds + water + buildings.
  p.x = clamp(p.x, 24, WORLD_W - 24);
  p.y = clamp(p.y, 24, WATER_Y - 24);
  for (const b of buildings) resolveCircleRect(p, b.x, b.y, b.w, b.h);
  // Health pickup.
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pk = G.pickups[i];
    if (dist(p.x, p.y, pk.x, pk.y) < p.r + pk.r) {
      if (pk.kind === 'health' && p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + 40);
        toast('Health +40');
        G.pickups.splice(i, 1);
        burst(p.x, p.y, '#7dff9b', 10);
      }
    }
  }
  // Slow regen up to 50.
  p.regenDelay -= dt;
  if (p.regenDelay <= 0 && p.hp > 0 && p.hp < 50) p.hp = Math.min(50, p.hp + 2.5 * dt);
  // Shooting.
  p.fireCd -= dt;
  if ((mouse.down || keyDown('f')) && p.fireCd <= 0) shootBullet(p.x, p.y, p.angle, 'player', 34);
  // Foot cop contact -> busted.
  if (G.wanted >= 1) {
    let touching = false;
    for (const c of G.cops) {
      if (dist(p.x, p.y, c.x, c.y) < p.r + c.r + 6) { touching = true; break; }
    }
    if (touching) {
      G.bustedTimer += dt;
      if (G.bustedTimer > 1.1) getBusted();
    } else {
      G.bustedTimer = Math.max(0, G.bustedTimer - dt * 2);
    }
  }
}

function onInteractKey() {
  if (G.mode !== 'play') return;
  const p = G.player;
  if (p.onFoot) {
    // Try to enter the nearest car.
    let best = null, bd = 95;
    for (const c of G.cars) {
      if (c.dead) continue;
      const d = dist(p.x, p.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) enterCar(best);
    else tryMissionInteract();
  } else {
    exitCar();
  }
}

function tryMissionInteract() {
  const m = MISSIONS[G.mission];
  if (!m || !m.onInteract) return;
  if (G.marker && dist(G.player.x, G.player.y, G.marker.x, G.marker.y) < 90) {
    m.onInteract();
  }
}

function enterCar(car) {
  const p = G.player;
  if (car.driver === 'traffic') {
    // Carjack: the driver flees on foot, the law notices.
    const d = spawnPed(false);
    d.x = car.x + rand(-30, 30); d.y = car.y + rand(-30, 30);
    d.state = 'flee'; d.fleeT = 6;
    addWanted(1);
    toast('Carjacked! +1 star');
    G.stats.stolen++;
  } else if (car.driver === 'police') {
    addWanted(1.5);
    toast('You stole a police cruiser! +2 stars');
    G.stats.stolen++;
  } else {
    G.stats.stolen++;
  }
  car.driver = 'player';
  G.car = car;
  p.onFoot = false;
  car.speed = 0;
  if (G.mission === 0 && G.step === 0) advanceStep();
  if (G.mission === 3 && G.step === 0) advanceStep(); // getaway starts once in a car
  burst(car.x, car.y, '#ffffff', 6);
}

function exitCar() {
  const p = G.player;
  const car = G.car;
  if (!car) return;
  car.driver = 'none';
  car.speed *= 0.2;
  G.car = null;
  p.onFoot = true;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
  p.x = clamp(p.x, 24, WORLD_W - 24);
  p.y = clamp(p.y, 24, WATER_Y - 24);
  for (const b of buildings) resolveCircleRect(p, b.x, b.y, b.w, b.h);
}

// ---------------- driving ----------------
function updatePlayerCar(dt) {
  const car = G.car;
  const p = G.player;
  if (!car) { p.onFoot = true; return; }
  const fwd = keyDown('w', 'arrowup');
  const back = keyDown('s', 'arrowdown');
  const left = keyDown('a', 'arrowleft');
  const right = keyDown('d', 'arrowright');
  const accel = 340, brake = 520, drag = 0.985;
  if (fwd) car.speed += accel * dt;
  if (back) car.speed -= (car.speed > 20 ? brake : accel * 0.6) * dt;
  car.speed *= Math.pow(drag, dt * 60);
  car.speed = clamp(car.speed, -170, car.maxSpeed);
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const spd = Math.abs(car.speed);
  if (spd > 12 && steer !== 0) {
    car.angle += steer * (car.speed >= 0 ? 1 : -1) * (1.9 * Math.min(1, spd / 220)) * dt;
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD_W - 30);
  car.y = clamp(car.y, 30, WATER_Y - 30);
  for (const b of buildings) {
    if (resolveCircleRect(car, b.x, b.y, b.w, b.h)) {
      car.speed *= 0.45;
      if (Math.abs(car.speed) > 120) burst(car.x, car.y, '#ffb020', 6);
    }
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  // Ramming pedestrians and cops.
  if (spd > 90) {
    for (const ped of G.peds) {
      if (ped.state !== 'down' && dist(car.x, car.y, ped.x, ped.y) < car.r + ped.r) {
        hitPed(ped, 100, car);
      }
    }
    for (const c of G.cops) {
      if (dist(car.x, car.y, c.x, c.y) < car.r + c.r) {
        hitCop(c, 100);
        car.speed *= 0.7;
      }
    }
  }
  // Smoke when damaged.
  if (car.hp < 45) {
    car.smokeT -= dt;
    if (car.smokeT <= 0) {
      car.smokeT = 0.12;
      G.parts.push({ x: car.x + rand(-14, 14), y: car.y + rand(-14, 14), vx: rand(-12, 12), vy: rand(-40, -16), life: 0.7, max: 0.7, size: rand(5, 10), color: '#888' });
    }
  }
}

function explodeCar(car) {
  car.dead = true;
  burst(car.x, car.y, '#ff9f0a', 26);
  burst(car.x, car.y, '#ff2d55', 18);
  G.shake = Math.max(G.shake, 10);
  const p = G.player;
  if (G.car === car) {
    G.car = null;
    p.onFoot = true;
    p.hp -= 30;
    p.x = car.x + 40; p.y = car.y;
    toast('Your car exploded!');
  }
  // Nearby damage.
  for (const ped of G.peds) {
    if (dist(car.x, car.y, ped.x, ped.y) < 120) hitPed(ped, 60, null);
  }
  for (const c of G.cops) {
    if (dist(car.x, car.y, c.x, c.y) < 120) hitCop(c, 60);
  }
  if (dist(p.x, p.y, car.x, car.y) < 120 && p.onFoot) hurtPlayer(25);
  setTimeout(() => { G.cars = G.cars.filter((c) => c !== car); }, 4000);
}

// ---------------- traffic AI ----------------
function updateTraffic(dt) {
  const p = G.player;
  for (const car of G.cars) {
    if (car.driver !== 'traffic') continue;
    // Follow its road; turn at intersections sometimes.
    car.turnCd -= dt;
    const roads = car.axis === 'y' ? V_ROADS : H_ROADS;
    const roadPos = car.axis === 'y' ? car.x : car.y;
    const road = roads[car.roadIdx] ?? roads[0];
    const laneOff = 28;
    const target = road + (car.dir > 0 ? laneOff : -laneOff) * (car.axis === 'y' ? 1 : -1);
    // Steer toward lane center.
    const pos = car.axis === 'y' ? car.x : car.y;
    const err = target - pos;
    const desired = car.axis === 'y'
      ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (car.dir > 0 ? 0 : Math.PI);
    car.angle += angDiff(car.angle, desired + clamp(err * 0.02, -0.4, 0.4)) * Math.min(1, dt * 3);
    // Slow down for a car ahead.
    let ahead = false;
    for (const o of G.cars) {
      if (o === car || o.dead) continue;
      const d = dist(car.x, car.y, o.x, o.y);
      if (d < 70) {
        const a = angDiff(car.angle, angTo(car.x, car.y, o.x, o.y));
        if (Math.abs(a) < 0.7) { ahead = true; break; }
      }
    }
    const want = ahead ? 0 : car.targetSpeed;
    car.speed = lerp(car.speed, want, Math.min(1, dt * 1.5));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Turn at an intersection.
    if (car.turnCd <= 0) {
      const cross = car.axis === 'y' ? H_ROADS : V_ROADS;
      for (const cr of cross) {
        const along = car.axis === 'y' ? car.y : car.x;
        if (Math.abs(along - cr) < 12 && Math.random() < 0.35) {
          car.axis = car.axis === 'y' ? 'x' : 'y';
          car.dir = Math.random() < 0.5 ? 1 : -1;
          car.roadIdx = car.axis === 'y' ? V_ROADS.indexOf(nearestRoad(V_ROADS, car.x)) : H_ROADS.indexOf(nearestRoad(H_ROADS, car.y));
          car.turnCd = 2;
          break;
        }
      }
    }
    // Bounds: bounce back.
    if (car.x < 80 || car.x > WORLD_W - 80 || car.y < 80 || car.y > WATER_Y - 80) {
      car.dir *= -1;
      car.turnCd = 2;
    }
    for (const b of buildings) resolveCircleRect(car, b.x, b.y, b.w, b.h);
    // Recycle far-away traffic near the player.
    if (dist(car.x, car.y, p.x, p.y) > 1500) {
      const pt = randomRoadPoint(p.x, p.y, 500, 1100);
      car.x = pt.x; car.y = pt.y;
      car.axis = pt.vertical ? 'y' : 'x';
      car.dir = Math.random() < 0.5 ? 1 : -1;
      car.roadIdx = car.axis === 'y' ? V_ROADS.indexOf(nearestRoad(V_ROADS, pt.x)) : H_ROADS.indexOf(nearestRoad(H_ROADS, pt.y));
      car.speed = car.targetSpeed;
    }
  }
}

// ---------------- pedestrian AI ----------------
function updatePeds(dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) { ped.state = 'walk'; ped.hp = 30; }
      continue;
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const a = angTo(p.x, p.y, ped.x, ped.y);
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
      ped.angle = a;
      if (ped.fleeT <= 0) ped.state = 'walk';
    } else {
      ped.waitT -= dt;
      const d = dist(ped.x, ped.y, ped.tx, ped.ty);
      if (d < 12 || ped.waitT <= 0) {
        if (Math.random() < 0.3) {
          ped.waitT = rand(1, 4);
        } else {
          let nx, ny, tries = 0;
          do {
            nx = clamp(ped.x + rand(-320, 320), 60, WORLD_W - 60);
            ny = clamp(ped.y + rand(-320, 320), 60, WATER_Y - 60);
            tries++;
          } while (insideBuilding(nx, ny, 12) && tries < 12);
          ped.tx = nx; ped.ty = ny;
        }
      } else {
        const a = angTo(ped.x, ped.y, ped.tx, ped.ty);
        ped.angle = a;
        ped.x += Math.cos(a) * ped.speed * dt;
        ped.y += Math.sin(a) * ped.speed * dt;
      }
    }
    ped.x = clamp(ped.x, 24, WORLD_W - 24);
    ped.y = clamp(ped.y, 24, WATER_Y - 24);
    for (const b of buildings) resolveCircleRect(ped, b.x, b.y, b.w, b.h);
  }
  // Keep the crowd topped up near the player.
  if (G.peds.length < 24 && Math.random() < dt * 0.5) spawnPed(true);
  else if (G.peds.length < 30 && Math.random() < dt * 0.2) spawnPed(true);
  // Prune far peds.
  for (let i = G.peds.length - 1; i >= 0; i--) {
    if (dist(G.peds[i].x, G.peds[i].y, p.x, p.y) > 1700) G.peds.splice(i, 1);
  }
}

function scarePeds(x, y, radius) {
  for (const ped of G.peds) {
    if (ped.state !== 'down' && dist(x, y, ped.x, ped.y) < radius) {
      ped.state = 'flee';
      ped.fleeT = rand(3, 6);
    }
  }
}

// ---------------- police AI ----------------
function updateCops(dt) {
  const p = G.player;
  // Police cars chase the player.
  const wantCars = G.wanted >= 1 ? Math.min(4, Math.ceil(G.wanted)) : 0;
  let policeCars = 0;
  for (const c of G.cars) if (c.driver === 'police' && !c.dead) policeCars++;
  if (policeCars < wantCars && Math.random() < dt * 1.2) spawnPoliceCar();
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    const target = angTo(car.x, car.y, p.x, p.y);
    const d = dist(car.x, car.y, p.x, p.y);
    if (G.wanted < 0.2 || d > 1900) {
      // No heat: drive off and despawn.
      car.speed = lerp(car.speed, 200, dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (d > 1900) car.dead = true;
      continue;
    }
    car.angle += angDiff(car.angle, target) * Math.min(1, dt * 2.4);
    const wantSpeed = d > 240 ? car.maxSpeed : 300;
    car.speed = lerp(car.speed, wantSpeed, Math.min(1, dt * 1.4));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 30, WORLD_W - 30);
    car.y = clamp(car.y, 30, WATER_Y - 30);
    for (const b of buildings) {
      if (resolveCircleRect(car, b.x, b.y, b.w, b.h)) car.speed *= 0.6;
    }
    // Ram the player when close.
    if (d < car.r + p.r + 4) {
      if (p.onFoot) hurtPlayer(18 * dt * 4);
      else { car.speed *= 0.5; if (Math.random() < dt * 2) burst(p.x, p.y, '#ff9f0a', 5); }
    }
  }
  G.cars = G.cars.filter((c) => !c.dead || c.driver === 'player');
  // Foot cops chase on foot when the player is on foot.
  const wantCops = G.wanted >= 2 && p.onFoot ? Math.min(3, Math.floor(G.wanted) - 1) : 0;
  if (G.cops.length < wantCops && Math.random() < dt * 0.8) spawnFootCop();
  for (let i = G.cops.length - 1; i >= 0; i--) {
    const c = G.cops[i];
    if (G.wanted < 0.5) { G.cops.splice(i, 1); continue; }
    const d = dist(c.x, c.y, p.x, p.y);
    const a = angTo(c.x, c.y, p.x, p.y);
    c.angle = a;
    if (d > 30) {
      c.x += Math.cos(a) * c.speed * dt;
      c.y += Math.sin(a) * c.speed * dt;
    }
    c.x = clamp(c.x, 24, WORLD_W - 24);
    c.y = clamp(c.y, 24, WATER_Y - 24);
    for (const b of buildings) resolveCircleRect(c, b.x, b.y, b.w, b.h);
    c.fireCd -= dt;
    if (d < 300 && d > 40 && c.fireCd <= 0) {
      c.fireCd = rand(0.9, 1.6);
      shootBullet(c.x, c.y, a + rand(-0.12, 0.12), 'cop', 9);
    }
  }
}

// Keep cars from stacking on top of each other at intersections.
function separateCars() {
  const all = G.cars;
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    if (a.dead) continue;
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = a.r + b.r - 6;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
      }
    }
  }
}

// ---------------- combat ----------------
function shootBullet(x, y, angle, from, dmg) {
  const p = G.player;
  G.bullets.push({
    x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * 720, vy: Math.sin(angle) * 720,
    angle, life: 0.9, from, dmg,
  });
  G.parts.push({ x: x + Math.cos(angle) * 24, y: y + Math.sin(angle) * 24, vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60, life: 0.12, max: 0.12, size: 5, color: '#ffd60a' });
  if (from === 'player') {
    p.fireCd = 0.22;
    G.stats.shots++;
    G.shake = Math.max(G.shake, 1.5);
    scarePeds(x, y, 320);
  }
}

function updateBullets(dt) {
  const p = G.player;
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H;
    if (!dead) {
      for (const bd of buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { dead = true; burst(b.x, b.y, '#ccc', 4); break; }
      }
    }
    if (!dead) {
      if (b.from === 'player' || b.from === 'cop') {
        for (const ped of G.peds) {
          if (ped.state !== 'down' && dist(b.x, b.y, ped.x, ped.y) < ped.r + 4) {
            hitPed(ped, b.dmg, null);
            dead = true;
            break;
          }
        }
      }
      if (!dead && b.from === 'player') {
        for (const c of G.cops) {
          if (dist(b.x, b.y, c.x, c.y) < c.r + 4) { hitCop(c, b.dmg); dead = true; break; }
        }
      }
      if (!dead && b.from === 'cop' && p.onFoot && dist(b.x, b.y, p.x, p.y) < p.r + 3) {
        hurtPlayer(b.dmg);
        dead = true;
      }
      if (!dead) {
        for (const car of G.cars) {
          if (car.dead) continue;
          if (b.from === 'player' && car.driver === 'player') continue;
          if (dist(b.x, b.y, car.x, car.y) < car.r) {
            car.hp -= b.dmg;
            burst(b.x, b.y, '#ffb020', 4);
            if (car.hp <= 0) explodeCar(car);
            dead = true;
            break;
          }
        }
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

function hitPed(ped, dmg, byCar) {
  ped.hp -= dmg;
  burst(ped.x, ped.y, '#ff2d55', 8);
  if (ped.hp <= 0) {
    if (ped.state !== 'down') {
      ped.state = 'down';
      ped.downT = 14;
      G.stats.kills++;
      addWanted(1);
      toast('Ped down! +1 star');
      scarePeds(ped.x, ped.y, 300);
    }
  } else {
    ped.state = 'flee';
    ped.fleeT = 5;
  }
}

function hitCop(cop, dmg) {
  cop.hp -= dmg;
  burst(cop.x, cop.y, '#3a6ea5', 8);
  if (cop.hp <= 0) {
    G.cops = G.cops.filter((c) => c !== cop);
    G.stats.kills++;
    addWanted(1.5);
    toast('Cop down! +2 stars');
    burst(cop.x, cop.y, '#ff2d55', 12);
  }
}

function hurtPlayer(dmg) {
  const p = G.player;
  if (p.hurtCd > 0 || G.mode !== 'play') return;
  p.hp -= dmg;
  p.hurtCd = 0.25;
  p.regenDelay = 10;
  G.shake = Math.max(G.shake, 4);
  burst(p.x, p.y, '#ff2d55', 6);
  if (p.hp <= 0) {
    p.hp = 0;
    getWasted();
  }
}

function addWanted(n) {
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.heatTimer = 0;
}

function updateWanted(dt) {
  G.heatTimer += dt;
  const p = G.player;
  let copNear = false;
  for (const c of G.cars) {
    if (c.driver === 'police' && dist(c.x, c.y, p.x, p.y) < 460) { copNear = true; break; }
  }
  if (!copNear) for (const c of G.cops) {
    if (dist(c.x, c.y, p.x, p.y) < 420) { copNear = true; break; }
  }
  // Cool off when unseen and quiet for a while.
  if (!copNear && G.heatTimer > 8 && G.wanted > 0) {
    G.wanted = Math.max(0, G.wanted - 0.22 * dt);
  }
  if (G.wanted < 0.05) G.wanted = 0;
}

// ---------------- particles ----------------
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(30, 190);
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.7), max: 0.7, size: rand(2, 5), color });
  }
  if (G.parts.length > 400) G.parts.splice(0, G.parts.length - 400);
}

function updateParticles(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const pt = G.parts[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.96; pt.vy *= 0.96;
    pt.life -= dt;
    if (pt.life <= 0) G.parts.splice(i, 1);
  }
}

// ---------------- missions ----------------
const MISSIONS = [
  {
    title: 'MISSION 1 — RODA PERTAMA',
    text: 'Steal any car (walk up and press E) and drive to the garage.',
    start() { setMarker(LOC.garage.x, LOC.garage.y, 'Garage'); },
    onStep() { setMarker(LOC.garage.x, LOC.garage.y, 'Garage'); },
  },
  {
    title: 'MISSION 2 — PAKET PANAS',
    text: 'On foot, grab the package at the alley, then deliver it to the drop-off.',
    start() { setMarker(LOC.package.x, LOC.package.y, 'Package — press E'); },
    onStep() { setMarker(LOC.dropoff.x, LOC.dropoff.y, 'Drop-off'); },
    onInteract() {
      if (G.step === 0) {
        advanceStep();
        toast('Package grabbed. Deliver it!');
      }
    },
  },
  {
    title: 'MISSION 3 — PANAS DINGIN',
    text: 'Rob the liquor store (press E), then lose the heat — get wanted to 0.',
    start() { setMarker(LOC.store.x, LOC.store.y, 'Store — press E'); },
    onStep() { setMarker(null, null, ''); toast('Lose the cops! Wanted to 0.'); },
    onInteract() {
      if (G.step === 0) {
        G.money += 400;
        addWanted(2);
        advanceStep();
        toast('+$400! Now lose the heat.');
      }
    },
  },
  {
    title: 'MISSION 4 — KABUR DARI BAY',
    text: 'Get in a car — the cops are coming. Reach the safehouse in 90 seconds.',
    start() { setMarker(null, null, 'Get in a car!'); },
    onStep() {
      addWanted(3);
      G.missionTimer = 90;
      setMarker(LOC.safehouse.x, LOC.safehouse.y, 'Safehouse — 90s');
    },
  },
  {
    title: 'MISSION 5 — RAJA TELUK',
    text: 'Steal the golden car at the docks and deliver it to the penthouse garage.',
    start() { setMarker(LOC.docks.x, LOC.docks.y, 'Golden car — press E'); },
    onStep() { setMarker(LOC.penthouse.x, LOC.penthouse.y, 'Penthouse garage'); },
  },
];

const MISSION_PAY = [200, 350, 300, 600, 1500];

function setMarker(x, y, label) {
  G.marker = x === null ? null : { x, y, label };
}

function currentMission() { return MISSIONS[G.mission] || null; }

function startMission(i) {
  G.mission = i;
  G.step = 0;
  G.missionTimer = 0;
  const m = MISSIONS[i];
  if (m) {
    m.start();
    toast(m.title);
  }
}

function advanceStep() {
  G.step++;
  const m = currentMission();
  if (!m) return;
  if (G.mission === 0 && G.step === 1) { m.onStep(); return; }
  if (G.mission === 1 && G.step === 1) { m.onStep(); return; }
  if (G.mission === 2 && G.step === 1) { m.onStep(); return; }
  if (G.mission === 3 && G.step === 1) { m.onStep(); return; }
  if (G.mission === 4 && G.step === 1) { m.onStep(); return; }
  completeMission();
}

function completeMission() {
  const pay = MISSION_PAY[G.mission] || 0;
  G.money += pay;
  G.stats.missions++;
  toast('JOB DONE! +$' + pay);
  burst(G.player.x, G.player.y, '#ffd60a', 20);
  const next = G.mission + 1;
  if (next >= MISSIONS.length) {
    G.mission = MISSIONS.length;
    setMarker(null, null, '');
    winGame();
  } else {
    startMission(next);
  }
  saveGame(); // save AFTER the mission index advanced
}

function updateMissions(dt) {
  const m = currentMission();
  if (!m) return;
  const p = G.player;
  // Timed getaway.
  if (G.mission === 3 && G.step === 1) {
    G.missionTimer -= dt;
    if (G.missionTimer <= 0) {
      toast('Too slow! The job resets — get in a car again.');
      G.wanted = Math.max(G.wanted, 2);
      startMission(3);
      return;
    }
  }
  if (!G.marker) {
    // Mission 3 step 1: lose the heat.
    if (G.mission === 2 && G.step === 1 && G.wanted <= 0) completeMission();
    return;
  }
  const d = dist(p.x, p.y, G.marker.x, G.marker.y);
  if (G.mission === 0 && G.step === 1) {
    if (d < 80 && !p.onFoot) completeMission();
  } else if (G.mission === 1 && G.step === 1) {
    if (d < 80) completeMission();
  } else if (G.mission === 3 && G.step === 1) {
    if (d < 90) completeMission();
  } else if (G.mission === 4 && G.step === 0) {
    // Steal the golden car: entering it advances.
    if (G.car === G.goldCar) advanceStep();
  } else if (G.mission === 4 && G.step === 1) {
    if (d < 90 && G.car === G.goldCar) completeMission();
    else if (d < 90 && G.car !== G.goldCar) toast('Bring the GOLDEN car here!');
  }
}

// ---------------- rendering ----------------
let mmZoom = 1;

function updateMouseWorld() {
  const r = canvas.getBoundingClientRect();
  const sx = (mouse.x / Math.max(1, r.width)) * canvas.width;
  const sy = (mouse.y / Math.max(1, r.height)) * canvas.height;
  mouse.wx = G.cam.x + sx - canvas.width / 2;
  mouse.wy = G.cam.y + sy - canvas.height / 2;
}

function draw() {
  const p = G.player;
  updateMouseWorld();
  // Camera follows the player.
  const tx = clamp(p.x - canvas.width / 2, canvas.width / 2 - 200, WORLD_W - canvas.width / 2 + 200);
  const ty = clamp(p.y - canvas.height / 2, canvas.height / 2 - 200, WORLD_H - canvas.height / 2 + 200);
  G.cam.x = lerp(G.cam.x, tx, 0.12);
  G.cam.y = lerp(G.cam.y, ty, 0.12);
  let shx = 0, shy = 0;
  if (G.shake > 0.2) {
    shx = rand(-G.shake, G.shake);
    shy = rand(-G.shake, G.shake);
    G.shake *= 0.88;
  }
  ctx.save();
  ctx.translate(-G.cam.x + canvas.width / 2 + shx, -G.cam.y + canvas.height / 2 + shy);
  drawGround();
  drawMarker();
  for (const pk of G.pickups) drawPickup(pk);
  for (const car of G.cars) drawCar(car);
  for (const ped of G.peds) drawPed(ped);
  for (const c of G.cops) drawCop(c);
  if (p.onFoot) drawPlayer(p);
  for (const b of G.bullets) drawBullet(b);
  for (const pt of G.parts) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawMinimap();
}

function drawGround() {
  // Base ground.
  ctx.fillStyle = '#191930';
  ctx.fillRect(G.cam.x - canvas.width / 2 - 60, G.cam.y - canvas.height / 2 - 60, canvas.width + 120, canvas.height + 120);
  // Water (bay).
  ctx.fillStyle = '#0b3d66';
  ctx.fillRect(0, WATER_Y, WORLD_W, WORLD_H - WATER_Y);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let x = 0; x < WORLD_W; x += 90) {
    const wob = Math.sin((x + G.time * 40) * 0.01) * 4;
    ctx.fillRect(x, WATER_Y + 14 + wob, 46, 3);
    ctx.fillRect(x + 40, WATER_Y + 60 - wob, 30, 3);
  }
  // Parks.
  for (const pk of parks) {
    ctx.fillStyle = '#1d4a2c';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.fillStyle = '#2a6b3c';
    for (const t of pk.trees) {
      ctx.beginPath(); ctx.arc(t.x, t.y, 13, 0, TAU); ctx.fill();
    }
  }
  // Roads.
  ctx.fillStyle = '#262640';
  for (const rx of V_ROADS) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WATER_Y);
  for (const ry of H_ROADS) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  // Lane dashes.
  ctx.fillStyle = '#ffd60a';
  for (const rx of V_ROADS) {
    for (let y = 0; y < WATER_Y; y += 64) ctx.fillRect(rx - 2, y, 4, 30);
  }
  for (const ry of H_ROADS) {
    for (let x = 0; x < WORLD_W; x += 64) ctx.fillRect(x, ry - 2, 30, 4);
  }
  // Sidewalk edges.
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 3;
  for (const rx of V_ROADS) {
    ctx.beginPath(); ctx.moveTo(rx - ROAD_W / 2, 0); ctx.lineTo(rx - ROAD_W / 2, WATER_Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx + ROAD_W / 2, 0); ctx.lineTo(rx + ROAD_W / 2, WATER_Y); ctx.stroke();
  }
  for (const ry of H_ROADS) {
    ctx.beginPath(); ctx.moveTo(0, ry - ROAD_W / 2); ctx.lineTo(WORLD_W, ry - ROAD_W / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ry + ROAD_W / 2); ctx.lineTo(WORLD_W, ry + ROAD_W / 2); ctx.stroke();
  }
  // Buildings.
  for (const b of buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Neon sign strip.
    ctx.fillStyle = b.neon;
    ctx.fillRect(b.x + 8, b.y + 8, Math.min(64, b.w - 16), 6);
    // Windows.
    ctx.fillStyle = 'rgba(255,235,150,0.55)';
    const cols = Math.max(1, Math.floor(b.w / 34)), rows = Math.max(1, Math.floor(b.h / 30));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 13 + b.x) % 3 === 0) {
          ctx.fillRect(b.x + 12 + i * 34, b.y + 26 + j * 30, 14, 12);
        }
      }
    }
  }
  // Named places.
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  for (const key of ['hospital', 'police', 'safehouse', 'penthouse']) {
    const L = LOC[key];
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(L.name.toUpperCase(), L.x, L.y - 66);
  }
}

function drawMarker() {
  if (!G.marker || G.mode !== 'play') return;
  const m = G.marker;
  const pulse = 1 + Math.sin(G.time * 5) * 0.15;
  ctx.save();
  ctx.strokeStyle = '#ffd60a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(m.x, m.y, 34 * pulse, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,214,10,0.25)';
  ctx.beginPath();
  ctx.arc(m.x, m.y, 30 * pulse, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffd60a';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(m.label, m.x, m.y - 46);
  ctx.restore();
  // Off-screen arrow.
  const p = G.player;
  const vx = m.x - p.x, vy = m.y - p.y;
  const d = Math.hypot(vx, vy);
  if (d > 520) {
    const a = Math.atan2(vy, vx);
    const ax = G.cam.x + Math.cos(a) * 300;
    const ay = G.cam.y + Math.sin(a) * 210;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath();
    ctx.moveTo(18, 0); ctx.lineTo(-12, -12); ctx.lineTo(-12, 12);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawPickup(pk) {
  const bob = Math.sin(G.time * 3 + pk.bob) * 3;
  ctx.save();
  ctx.translate(pk.x, pk.y + bob);
  ctx.fillStyle = '#7dff9b';
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
  ctx.fillStyle = '#0b3d1e';
  ctx.fillRect(-2.5, -8, 5, 16);
  ctx.fillRect(-8, -2.5, 16, 5);
  ctx.restore();
}

function drawCar(car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = car.type === 'truck' ? 56 : 46, h = 24;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  // Body.
  ctx.fillStyle = car.dead ? '#222' : car.color;
  roundRect(-w / 2, -h / 2, w, h, 7);
  ctx.fill();
  // Roof + windshield.
  ctx.fillStyle = car.dead ? '#111' : 'rgba(20,20,40,0.85)';
  roundRect(-w / 2 + 10, -h / 2 + 4, w - 22, h - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,220,255,0.7)';
  ctx.fillRect(w / 2 - 12, -h / 2 + 5, 5, h - 10);
  // Wheels.
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(-w / 2 + 4, -h / 2 - 3, 10, 5);
  ctx.fillRect(-w / 2 + 4, h / 2 - 2, 10, 5);
  ctx.fillRect(w / 2 - 14, -h / 2 - 3, 10, 5);
  ctx.fillRect(w / 2 - 14, h / 2 - 2, 10, 5);
  if (car.gold) {
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 2;
    roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 9);
    ctx.stroke();
  }
  if (car.type === 'police') {
    const on = Math.floor(G.time * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff2d55' : '#2d7dff';
    ctx.fillRect(-6, -h / 2 - 2, 12, 5);
  }
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPed(ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 7, ped.angle, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,45,85,0.7)';
    ctx.beginPath(); ctx.arc(6, 4, 5, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f5d0a9';
    ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 5, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawCop(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.fillStyle = '#1c3a5c';
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f5d0a9';
  ctx.beginPath(); ctx.arc(Math.cos(c.angle) * 4, Math.sin(c.angle) * 4, 5, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffd60a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 12, -0.6, 0.6); ctx.stroke();
  ctx.restore();
}

function drawPlayer(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  // Walk bob.
  const bob = p.moving ? Math.sin(p.walkPhase) * 2 : 0;
  ctx.fillStyle = '#00e5ff';
  ctx.beginPath(); ctx.arc(0, bob, 13, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#004d5c';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, bob, 13, 0, TAU); ctx.stroke();
  // Gun direction.
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(p.angle) * 10, bob + Math.sin(p.angle) * 10);
  ctx.lineTo(Math.cos(p.angle) * 22, bob + Math.sin(p.angle) * 22);
  ctx.stroke();
  ctx.fillStyle = '#f5d0a9';
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 4, bob + Math.sin(p.angle) * 4, 5, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawBullet(b) {
  ctx.strokeStyle = '#ffe27a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawMinimap() {
  const w = mmZoom === 2 ? 440 : 220, h = mmZoom === 2 ? 320 : 160;
  if (minimap.width !== w) { minimap.width = w; minimap.height = h; }
  const sx = w / WORLD_W, sy = h / WORLD_H;
  mmctx.clearRect(0, 0, w, h);
  mmctx.fillStyle = '#101024';
  mmctx.fillRect(0, 0, w, h);
  mmctx.fillStyle = '#0b3d66';
  mmctx.fillRect(0, WATER_Y * sy, w, h - WATER_Y * sy);
  mmctx.fillStyle = '#3a3a58';
  for (const rx of V_ROADS) mmctx.fillRect(rx * sx - 2, 0, 4, WATER_Y * sy);
  for (const ry of H_ROADS) mmctx.fillRect(0, ry * sy - 2, w, 4);
  mmctx.fillStyle = '#55557a';
  for (const b of buildings) mmctx.fillRect(b.x * sx, b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  if (G.marker) {
    mmctx.fillStyle = '#ffd60a';
    mmctx.beginPath(); mmctx.arc(G.marker.x * sx, G.marker.y * sy, 4, 0, TAU); mmctx.fill();
  }
  if (G.goldCar && !G.goldCar.dead) {
    mmctx.fillStyle = '#ffd60a';
    mmctx.fillRect(G.goldCar.x * sx - 2, G.goldCar.y * sy - 2, 4, 4);
  }
  for (const c of G.cars) {
    if (c.driver === 'police') { mmctx.fillStyle = '#ff2d55'; mmctx.fillRect(c.x * sx - 2, c.y * sy - 2, 4, 4); }
  }
  const p = G.player;
  mmctx.fillStyle = '#fff';
  mmctx.beginPath(); mmctx.arc(p.x * sx, p.y * sy, 4, 0, TAU); mmctx.fill();
  mmctx.strokeStyle = '#00e5ff';
  mmctx.lineWidth = 2;
  mmctx.beginPath(); mmctx.arc(p.x * sx, p.y * sy, 6, 0, TAU); mmctx.stroke();
}

// ---------------- HUD ----------------
const $ = (id) => document.getElementById(id);
let hudTick = 0;

function updateHUD() {
  hudTick++;
  if (hudTick % 4 !== 0) return;
  const p = G.player;
  $('healthfill').style.width = Math.max(0, p.hp) + '%';
  $('healthtext').textContent = Math.ceil(Math.max(0, p.hp)) + ' HP';
  $('moneytext').textContent = G.money.toLocaleString('en-US');
  const stars = Math.ceil(G.wanted);
  let html = '';
  for (let i = 0; i < 5; i++) html += '<span class="star' + (i < stars ? '' : ' off') + '">★</span>';
  $('wanted').innerHTML = html;
  const m = currentMission();
  if (m) {
    $('missiontitle').textContent = m.title;
    $('missiontext').textContent = m.text;
    if (G.mission === 3 && G.step === 1) {
      $('missiondist').textContent = 'Time left: ' + Math.ceil(Math.max(0, G.missionTimer)) + 's';
    } else if (G.marker) {
      $('missiondist').textContent = Math.round(dist(p.x, p.y, G.marker.x, G.marker.y)) + 'm — ' + G.marker.label;
    } else {
      $('missiondist').textContent = '';
    }
  } else {
    $('missiontitle').textContent = 'FREE ROAM';
    $('missiontext').textContent = 'Vice Bay is yours. Cause chaos or just cruise.';
    $('missiondist').textContent = '';
  }
  if (G.car) {
    $('speedo').classList.remove('hidden');
    $('speedtext').textContent = Math.round(Math.abs(G.car.speed) * 0.36);
  } else {
    $('speedo').classList.add('hidden');
  }
}

function toast(msg) {
  G.msg = msg;
  G.msgT = 2.6;
  const el = $('toast');
  el.textContent = msg;
  el.style.opacity = '1';
}

// ---------------- menus / flow ----------------
function show(id, on) { $(id).classList.toggle('hidden', !on); }

function togglePause() {
  if (G.mode === 'play') {
    G.mode = 'pause';
    show('pause', true);
    saveGame();
  } else if (G.mode === 'pause') {
    G.mode = 'play';
    show('pause', false);
  }
}

function toggleMinimapZoom() { mmZoom = mmZoom === 1 ? 2 : 1; }

function getBusted() {
  if (G.mode !== 'play') return;
  const bail = Math.min(G.money, 500);
  G.money -= bail;
  $('bailtext').textContent = '$' + bail;
  G.mode = 'busted';
  show('busted', true);
  saveGame();
}

function getWasted() {
  if (G.mode !== 'play') return;
  const cost = Math.floor(G.money * 0.1);
  G.money -= cost;
  G.mode = 'wasted';
  show('wasted', true);
  saveGame();
}

function respawn(at) {
  const p = G.player;
  if (G.car) { G.car.driver = 'none'; G.car = null; }
  p.onFoot = true;
  p.x = at.x; p.y = at.y;
  p.hp = p.maxHp;
  p.angle = -Math.PI / 2;
  G.wanted = 0;
  G.cops.length = 0;
  G.bustedTimer = 0;
  G.cam.x = p.x; G.cam.y = p.y;
  G.mode = 'play';
  show('busted', false);
  show('wasted', false);
  toast('Back on the streets.');
}

function winGame() {
  G.mode = 'win';
  $('winstats').innerHTML =
    'Jobs done: ' + G.stats.missions + '<br>' +
    'Cars stolen: ' + G.stats.stolen + '<br>' +
    'Shots fired: ' + G.stats.shots + '<br>' +
    'Money: $' + G.money.toLocaleString('en-US');
  show('win', true);
  saveGame();
}

function startGame(isContinue) {
  const save = isContinue ? loadGame() : null;
  resetWorld();
  if (save) {
    G.money = save.money || 0;
    G.stats = save.stats || G.stats;
    G.player.x = save.px || 1500;
    G.player.y = save.py || 800;
    G.player.hp = save.hp || 100;
    startMission(Math.min(save.mission || 0, MISSIONS.length - 1));
    toast('Welcome back, Jax.');
  } else {
    G.money = 0;
    G.player.x = 1500; G.player.y = 1300;
    startMission(0);
  }
  G.cam.x = G.player.x; G.cam.y = G.player.y;
  G.mode = 'play';
  show('start', false);
  show('pause', false);
  show('win', false);
  show('busted', false);
  show('wasted', false);
  show('hud', true);
}

function resetWorld() {
  G.cars.length = 0; G.peds.length = 0; G.cops.length = 0;
  G.bullets.length = 0; G.parts.length = 0; G.pickups.length = 0;
  G.wanted = 0; G.heatTimer = 0; G.missionTimer = 0; G.bustedTimer = 0;
  G.car = null; G.goldCar = null; G.mission = 0; G.step = 0;
  G.stats = { kills: 0, stolen: 0, shots: 0, missions: 0 };
  G.player = newPlayer(1500, 1300);
  spawnParkedCars();
  for (let i = 0; i < 24; i++) spawnTrafficCar(false);
  for (let i = 0; i < 26; i++) spawnPed(false);
  spawnPickup(LOC.hospital.x + 40, LOC.hospital.y, 'health');
  spawnPickup(LOC.safehouse.x + 40, LOC.safehouse.y, 'health');
  spawnPickup(LOC.police.x - 60, LOC.police.y, 'health');
}

// ---------------- save / load ----------------
function saveGame() {
  if (G.mode === 'menu') return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      mission: G.mission, money: G.money,
      px: Math.round(G.player.x), py: Math.round(G.player.y),
      hp: Math.round(G.player.hp), stats: G.stats, time: Date.now(),
    }));
  } catch (e) { /* storage unavailable — game still runs */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// ---------------- main loop ----------------
let lastT = 0;

function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  if (G.mode === 'play') {
    G.time += dt;
    const p = G.player;
    p.fireCd -= dt;
    p.hurtCd -= dt;
    if (p.onFoot) updatePlayerFoot(dt);
    else updatePlayerCar(dt);
    updateTraffic(dt);
    updatePeds(dt);
    updateCops(dt);
    separateCars();
    updateBullets(dt);
    updateParticles(dt);
    updateWanted(dt);
    updateMissions(dt);
    if (G.msgT > 0) {
      G.msgT -= dt;
      if (G.msgT <= 0) $('toast').style.opacity = '0';
    }
    G.saveTimer += dt;
    if (G.saveTimer > 15) { G.saveTimer = 0; saveGame(); }
    updateHUD();
  } else if (G.mode === 'menu') {
    G.time += dt;
    // Slow cinematic pan behind the menu.
    G.cam.x = 1800 + Math.cos(G.time * 0.05) * 500;
    G.cam.y = 1300 + Math.sin(G.time * 0.04) * 300;
    updateParticles(dt);
  }
  draw();
}

// ---------------- init ----------------
function init() {
  canvas = $('game');
  ctx = canvas.getContext('2d');
  minimap = $('minimap');
  mmctx = minimap.getContext('2d');
  genWorld();
  G.player = newPlayer(1800, 1300);
  resetWorld();
  G.mode = 'menu';
  show('hud', false);
  setupInput();
  $('btn-new').addEventListener('click', () => startGame(false));
  $('btn-continue').addEventListener('click', () => startGame(true));
  $('btn-resume').addEventListener('click', togglePause);
  $('btn-restart').addEventListener('click', () => startGame(false));
  $('btn-quit').addEventListener('click', () => {
    G.mode = 'menu';
    show('pause', false);
    show('hud', false);
    show('start', true);
    saveGame();
  });
  $('btn-busted').addEventListener('click', () => respawn(LOC.police));
  $('btn-wasted').addEventListener('click', () => respawn(LOC.hospital));
  $('btn-freeroam').addEventListener('click', () => {
    show('win', false);
    G.mode = 'play';
  });
  $('btn-again').addEventListener('click', () => startGame(false));
  const save = loadGame();
  if (save && save.mission !== undefined) {
    $('btn-continue').classList.remove('hidden');
    $('btn-continue').textContent = 'CONTINUE — MISSION ' + (Math.min(save.mission + 1, 5));
  }
  requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', init);
// Test hook (also lets graders inspect state).
window.VICEBAY = { G, MISSIONS, LOC, startGame, saveGame, loadGame };
