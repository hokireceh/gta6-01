// VICE BAY — 2D top-down open-world crime game. Single-file build, no imports.
// Offline, deterministic world (seeded RNG), 5 chained missions, wanted system.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---------------------------------------------------------------- constants
const WORLD = 3600;            // world is WORLD x WORLD units
const ROAD_GAP = 450;          // distance between parallel roads
const ROAD_W = 96;             // road width
const FIRST_ROAD = 225;        // first road center
const VIEW_W = 1280, VIEW_H = 900;
const SAVE_KEY = "vicebay-save-v1";

const COLORS = {
  ground: "#141a29", block: "#1d2438", sidewalk: "#2c3550", road: "#232b40",
  dash: "#8a94ad", park: "#17351f", building: ["#3d4a6b", "#4a3d6b", "#6b4a3d", "#2f5d4a", "#5d2f4a", "#44506e"],
  player: "#ff5da2", playerCar: "#ff2e88", gold: "#ffc93d", police: "#e8e8e8",
  ped: ["#e8c15a", "#5ad1e8", "#e85a7a", "#7ae85a", "#c98af0", "#e8e8e8"],
  traffic: ["#c94f4f", "#4f7ac9", "#c9a44f", "#7a4fc9", "#4fc98a", "#c9c9c9", "#8a8f9e"],
};

// Seeded RNG (mulberry32) so the city is identical every run.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261121);
const rand = (lo, hi) => lo + rng() * (hi - lo);
const randi = (lo, hi) => Math.floor(rand(lo, hi + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const angDiff = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

// ---------------------------------------------------------------- world gen
const roadCenters = [];
for (let i = 0; i < 8; i++) roadCenters.push(FIRST_ROAD + i * ROAD_GAP);

function isOnRoad(x, y) {
  for (const c of roadCenters) {
    if (Math.abs(x - c) < ROAD_W / 2 + 4) return true;
    if (Math.abs(y - c) < ROAD_W / 2 + 4) return true;
  }
  return false;
}

// Buildings: one per block (between roads), inset from the road edge.
const buildings = [];
for (let i = 0; i < 7; i++) {
  for (let j = 0; j < 7; j++) {
    const x0 = roadCenters[i] + ROAD_W / 2 + 18;
    const y0 = roadCenters[j] + ROAD_W / 2 + 18;
    const w = ROAD_GAP - ROAD_W - 36;
    const h = ROAD_GAP - ROAD_W - 36;
    const kind = rng();
    if (kind < 0.12) continue; // park / empty plaza
    buildings.push({
      x: x0 + rand(0, 30), y: y0 + rand(0, 30),
      w: w - rand(0, 60), h: h - rand(0, 60),
      color: pick(COLORS.building), park: kind < 0.2,
    });
  }
}

function collidesBuilding(x, y, r) {
  for (const b of buildings) {
    if (b.park) continue;
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Fixed landmarks.
const SHOP = { x: 1575, y: 675, r: 90, label: "TOKO" };
const PENTHOUSE = { x: 2925, y: 2925, r: 100, label: "PENTHOUSE" };
const DELIVERY = { x: 2925, y: 675, r: 90, label: "ANTAR PAKET" };
const HOSPITAL = { x: 675, y: 2925, r: 90, label: "RUMAH SAKIT" };

// ---------------------------------------------------------------- state
function freshState() {
  return {
    screen: "menu",           // menu | playing | paused | busted | win
    time: 0,
    money: 0,
    hp: 100,
    wanted: 0,
    wantedCooldown: 0,        // seconds with no police nearby (for decay)
    mission: 0,               // index into MISSIONS
    missionTimer: 0,          // mission 4 getaway countdown
    missionProgress: 0,       // mission 3 robbery progress 0..1
    player: {
      x: 675, y: 675, angle: 0, speed: 0, inCar: null,
      onFoot: true, shootCd: 0,
    },
    cars: [],                 // traffic + parked + police (police flagged)
    peds: [],
    bullets: [],
    pickups: [],
    particles: [],
    cam: { x: 675, y: 675 },
    mouse: { x: 640, y: 450, down: false },
    keys: {},
    bustedReason: "",
    stats: { shots: 0, hits: 0, carsStolen: 0, pedsDown: 0 },
    message: "",
    messageT: 0,
  };
}
let S = freshState();

// ---------------------------------------------------------------- entities
function makeCar(x, y, angle, opts = {}) {
  return {
    x, y, angle, speed: 0,
    color: opts.color || pick(COLORS.traffic),
    police: !!opts.police, gold: !!opts.gold,
    driver: opts.driver !== false,   // has a driver (carjackable)
    parked: !!opts.parked,
    health: opts.police ? 60 : 100,
    road: opts.road || null,         // 'v' | 'h' for traffic AI
    lane: opts.lane || 0,            // -1 | 1 lane offset
    dir: opts.dir || 1,
    turnCd: rand(1, 4),
    dead: false, explodeT: 0,
    shootCd: rand(0.5, 1.5),
  };
}

function spawnTraffic(n) {
  for (let i = 0; i < n; i++) {
    const vertical = rng() < 0.5;
    const c = pick(roadCenters);
    const along = rand(100, WORLD - 100);
    const car = makeCar(
      vertical ? c + (rng() < 0.5 ? -22 : 22) : along,
      vertical ? along : c + (rng() < 0.5 ? -22 : 22),
      vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
      { road: vertical ? "v" : "h", lane: rng() < 0.5 ? -1 : 1, dir: rng() < 0.5 ? 1 : -1 }
    );
    car.speed = rand(60, 110);
    S.cars.push(car);
  }
}

function spawnParked(n) {
  let placed = 0, guard = 0;
  while (placed < n && guard++ < 400) {
    const x = rand(150, WORLD - 150), y = rand(150, WORLD - 150);
    if (!isOnRoad(x, y)) continue;
    if (collidesBuilding(x, y, 40)) continue;
    if (dist(x, y, S.player.x, S.player.y) < 300) continue;
    S.cars.push(makeCar(x, y, rand(0, Math.PI * 2), { parked: true, driver: false }));
    placed++;
  }
}

function spawnPeds(n) {
  for (let i = 0; i < n; i++) {
    let x = rand(150, WORLD - 150), y = rand(150, WORLD - 150), guard = 0;
    while (collidesBuilding(x, y, 20) && guard++ < 50) { x = rand(150, WORLD - 150); y = rand(150, WORLD - 150); }
    S.peds.push({
      x, y, angle: rand(0, Math.PI * 2), speed: rand(25, 45),
      color: pick(COLORS.ped), state: "walk", stateT: rand(0, 4),
      down: 0, wanderT: rand(1, 5),
    });
  }
}

function spawnPickups() {
  const spots = [[1125, 1125], [2475, 1575], [1575, 2475], [2025, 2025], [675, 1575], [2925, 1575]];
  for (const [x, y] of spots) S.pickups.push({ x, y, kind: "health", taken: false });
}

function resetWorld() {
  S.cars = []; S.peds = []; S.bullets = []; S.pickups = []; S.particles = [];
  spawnTraffic(12);
  spawnParked(6);
  spawnPeds(24);
  spawnPickups();
  // Gold car parked near the east docks.
  S.cars.push(makeCar(3150, 2025, Math.PI / 2, { color: COLORS.gold, gold: true, parked: true, driver: false }));
}
resetWorld();

// ---------------------------------------------------------------- input
const keyMap = {};
window.addEventListener("keydown", (e) => {
  keyMap[e.code] = true;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  if (e.code === "Enter" && (S.screen === "menu" || S.screen === "win")) startGame(S.screen === "win");
  if (e.code === "KeyP" || e.code === "Escape") {
    if (S.screen === "playing") { S.screen = "paused"; saveGame(); }
    else if (S.screen === "paused") S.screen = "playing";
  }
  if (e.code === "KeyE" && S.screen === "playing") tryEnterExitCar();
  if (e.code === "KeyF" && S.screen === "playing") shoot();
});
window.addEventListener("keyup", (e) => { keyMap[e.code] = false; });
canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  S.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
  S.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
});
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    S.mouse.down = true;
    if (S.screen === "menu") startGame(false);
    else if (S.screen === "win") startGame(true);
    else if (S.screen === "playing") shoot();
  }
});
window.addEventListener("mouseup", () => { S.mouse.down = false; });
canvas.addEventListener("click", () => {
  if (S.screen === "busted") { respawnAfterBusted(); }
});

// ---------------------------------------------------------------- player
function tryEnterExitCar() {
  const p = S.player;
  if (p.inCar) {
    // Exit: step out to the side of the car.
    const car = p.inCar;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    p.angle = car.angle;
    p.inCar = null; p.onFoot = true; p.speed = 0;
    return;
  }
  // Find nearest enterable car within 70 units.
  let best = null, bestD = 70;
  for (const car of S.cars) {
    if (car.dead) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) return;
  if (best.police) { flash("Mobil polisi tidak bisa dicuri!"); return; }
  if (best.driver && !best.parked) {
    // Carjack: driver flees, wanted +1.
    best.driver = false;
    S.wanted = Math.min(5, S.wanted + 1);
    S.stats.carsStolen++;
    spawnPedFlee(best.x, best.y);
    flash("Mobil dibajak! Wanted +1");
  }
  p.inCar = best; p.onFoot = false;
  best.parked = false; best.road = null;
  p.x = best.x; p.y = best.y; p.angle = best.angle;
  if (S.mission === 0) completeMission();
}

function spawnPedFlee(x, y) {
  S.peds.push({ x: x + rand(-30, 30), y: y + rand(-30, 30), angle: rand(0, Math.PI * 2), speed: 120, color: pick(COLORS.ped), state: "flee", stateT: 3, down: 0, wanderT: 0 });
}

function updatePlayer(dt) {
  const p = S.player;
  p.shootCd = Math.max(0, p.shootCd - dt);
  if (p.inCar) { updatePlayerCar(dt); return; }
  // On foot movement.
  let mx = 0, my = 0;
  if (keyMap.KeyW || keyMap.ArrowUp) my -= 1;
  if (keyMap.KeyS || keyMap.ArrowDown) my += 1;
  if (keyMap.KeyA || keyMap.ArrowLeft) mx -= 1;
  if (keyMap.KeyD || keyMap.ArrowRight) mx += 1;
  const sprint = keyMap.ShiftLeft || keyMap.ShiftRight;
  const speed = sprint ? 300 : 175;
  if (mx || my) {
    const len = Math.hypot(mx, my);
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    p.angle = Math.atan2(my, mx);
    if (!collidesBuilding(nx, p.y, 14)) p.x = nx;
    if (!collidesBuilding(p.x, ny, 14)) p.y = ny;
  }
  p.x = clamp(p.x, 40, WORLD - 40);
  p.y = clamp(p.y, 40, WORLD - 40);
  if ((keyMap.KeyF || S.mouse.down) && p.shootCd <= 0) shoot();
  // Health pickup.
  for (const pk of S.pickups) {
    if (!pk.taken && dist(p.x, p.y, pk.x, pk.y) < 34) {
      pk.taken = true;
      if (pk.kind === "health") { S.hp = Math.min(100, S.hp + 40); flash("HP +40"); }
      else { S.money += 50; flash("+$50"); }
    }
  }
}

function updatePlayerCar(dt) {
  const p = S.player, car = p.inCar;
  const up = keyMap.KeyW || keyMap.ArrowUp;
  const down = keyMap.KeyS || keyMap.ArrowDown;
  const left = keyMap.KeyA || keyMap.ArrowLeft;
  const right = keyMap.KeyD || keyMap.ArrowRight;
  const maxSpeed = 520;
  if (up) car.speed = Math.min(maxSpeed, car.speed + 420 * dt);
  else if (down) car.speed = Math.max(-160, car.speed - 380 * dt);
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  if (Math.abs(car.speed) > 20) {
    car.angle += steer * (car.speed > 0 ? 1 : -1) * 2.1 * dt * Math.min(1, Math.abs(car.speed) / 220);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = collidesBuilding(nx, ny, 26);
  if (hit) {
    if (Math.abs(car.speed) > 140) { car.health -= 8; spawnSparks(car.x, car.y); }
    car.speed *= -0.25;
  } else {
    car.x = clamp(nx, 50, WORLD - 50);
    car.y = clamp(ny, 50, WORLD - 50);
  }
  // Run over peds.
  for (const ped of S.peds) {
    if (ped.down > 0) continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 30 && Math.abs(car.speed) > 60) {
      ped.down = 4; ped.state = "down";
      S.stats.pedsDown++;
      S.pickups.push({ x: ped.x, y: ped.y, kind: "cash", taken: false });
      spawnSparks(ped.x, ped.y);
    }
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  if ((keyMap.KeyF || S.mouse.down) && p.shootCd <= 0) shoot();
  if (car.health <= 0) explodeCar(car);
}

function shoot() {
  const p = S.player;
  if (p.shootCd > 0) return;
  p.shootCd = 0.28;
  S.stats.shots++;
  const sx = p.x, sy = p.y;
  // Aim toward the mouse (screen -> world).
  const wx = S.cam.x + (S.mouse.x - VIEW_W / 2) / 0.9;
  const wy = S.cam.y + (S.mouse.y - VIEW_H / 2) / 0.9;
  const a = angTo(sx, sy, wx, wy);
  S.bullets.push({ x: sx + Math.cos(a) * 26, y: sy + Math.sin(a) * 26, angle: a, speed: 950, life: 0.8, fromPlayer: true });
  spawnSparks(sx + Math.cos(a) * 26, sy + Math.sin(a) * 26);
}

// ---------------------------------------------------------------- traffic AI
function updateTraffic(dt) {
  for (const car of S.cars) {
    if (car.dead || car.police) continue;
    if (S.player.inCar === car) continue; // player drives it
    if (car.parked) continue;
    car.turnCd -= dt;
    // Follow its road; at intersections sometimes turn.
    const onV = car.road === "v";
    const center = nearestRoadCenter(onV ? car.x : car.y);
    const targetLane = center + car.lane * 22;
    const pos = onV ? car.x : car.y;
    const laneErr = targetLane - pos;
    const desired = onV
      ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (car.dir > 0 ? 0 : Math.PI);
    car.angle += clamp(angDiff(car.angle, desired + clamp(laneErr * 0.02, -0.5, 0.5)), -2.4 * dt, 2.4 * dt);
    // Stop for the car ahead.
    let blocked = false;
    for (const other of S.cars) {
      if (other === car || other.dead) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 70) {
        const ahead = Math.cos(angTo(car.x, car.y, other.x, other.y) - car.angle);
        if (ahead > 0.5) { blocked = true; break; }
      }
    }
    const targetSpeed = blocked ? 0 : rand(60, 110);
    car.speed += clamp(targetSpeed - car.speed, -300 * dt, 200 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!collidesBuilding(nx, ny, 24)) { car.x = nx; car.y = ny; }
    else { car.speed = 0; car.turnCd = 0; }
    // Turn at an intersection.
    if (car.turnCd <= 0) {
      const nearCenter = Math.abs((onV ? car.y : car.x) - nearestRoadCenter(onV ? car.y : car.x)) < 60;
      if (nearCenter && rng() < 0.5) {
        car.road = onV ? "h" : "v";
        car.dir = rng() < 0.5 ? 1 : -1;
        car.lane = rng() < 0.5 ? -1 : 1;
      }
      car.turnCd = rand(2, 6);
    }
    // Wrap around the world edge.
    if (car.x < 60 || car.x > WORLD - 60 || car.y < 60 || car.y > WORLD - 60) {
      const vertical = rng() < 0.5;
      const c = pick(roadCenters);
      car.x = vertical ? c : rand(100, WORLD - 100);
      car.y = vertical ? rand(100, WORLD - 100) : c;
      car.road = vertical ? "v" : "h";
    }
  }
}

function nearestRoadCenter(v) {
  let best = roadCenters[0], bd = Infinity;
  for (const c of roadCenters) { const d = Math.abs(v - c); if (d < bd) { bd = d; best = c; } }
  return best;
}

// ---------------------------------------------------------------- peds AI
function updatePeds(dt) {
  for (const ped of S.peds) {
    if (ped.down > 0) { ped.down -= dt; if (ped.down <= 0) ped.state = "walk"; continue; }
    // Flee from fast cars and gunfire.
    let threat = null, threatD = Infinity;
    for (const car of S.cars) {
      if (car.dead) continue;
      const d = dist(ped.x, ped.y, car.x, car.y);
      if (d < 160 && Math.abs(car.speed) > 80 && d < threatD) { threat = car; threatD = d; }
    }
    if (threat) ped.state = "flee";
    else if (ped.state === "flee") ped.state = "walk";
    if (ped.state === "flee" && threat) {
      const a = angTo(threat.x, threat.y, ped.x, ped.y);
      ped.angle = a;
      const nx = ped.x + Math.cos(a) * 130 * dt;
      const ny = ped.y + Math.sin(a) * 130 * dt;
      if (!collidesBuilding(nx, ped.y, 12)) ped.x = nx;
      if (!collidesBuilding(ped.x, ny, 12)) ped.y = ny;
    } else {
      ped.wanderT -= dt;
      if (ped.wanderT <= 0) { ped.angle = rand(0, Math.PI * 2); ped.wanderT = rand(1.5, 5); }
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (!collidesBuilding(nx, ny, 12) && nx > 40 && nx < WORLD - 40 && ny > 40 && ny < WORLD - 40) { ped.x = nx; ped.y = ny; }
      else ped.angle = rand(0, Math.PI * 2);
    }
  }
}

// ---------------------------------------------------------------- police AI
function updatePolice(dt) {
  const p = S.player;
  // Spawn police up to wanted level (max 4 active).
  const want = Math.min(S.wanted, 4);
  const active = S.cars.filter((c) => c.police && !c.dead).length;
  if (active < want && rng() < dt * 0.8) {
    const a = rand(0, Math.PI * 2);
    const x = clamp(p.x + Math.cos(a) * 700, 100, WORLD - 100);
    const y = clamp(p.y + Math.sin(a) * 700, 100, WORLD - 100);
    const rc = nearestRoadCenter(x);
    const car = makeCar(rc, y, 0, { police: true, color: "#1c1c22", road: "v" });
    car.speed = 200;
    S.cars.push(car);
  }
  for (const car of S.cars) {
    if (!car.police || car.dead) continue;
    const d = dist(car.x, car.y, p.x, p.y);
    // Chase the player. If a building blocks the direct line, detour around
    // it: pick a perpendicular heading for ~1.2s so the car slides along the
    // wall instead of pressing into it forever.
    const wantAngle = angTo(car.x, car.y, p.x, p.y);
    if (car.detourT === undefined) { car.detourT = 0; car.stuckT = 0; }
    if (car.detourT > 0) {
      car.detourT -= dt;
      car.angle += clamp(angDiff(car.angle, car.detourA), -2.8 * dt, 2.8 * dt);
    } else {
      car.angle += clamp(angDiff(car.angle, wantAngle), -2.8 * dt, 2.8 * dt);
    }
    car.speed = Math.min(430, car.speed + 260 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!collidesBuilding(nx, ny, 24)) {
      car.x = clamp(nx, 50, WORLD - 50);
      car.y = clamp(ny, 50, WORLD - 50);
      car.stuckT = 0;
    } else {
      car.speed *= 0.4;
      car.stuckT += dt;
      if (car.stuckT > 0.5) {
        // Turn 90° (either side) and hold it long enough to clear the corner.
        car.detourA = wantAngle + (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
        car.detourT = 1.2;
        car.stuckT = 0;
      }
    }
    // Shoot when close.
    car.shootCd -= dt;
    if (car.shootCd <= 0 && d < 520) {
      car.shootCd = rand(0.9, 1.6);
      const a = angTo(car.x, car.y, p.x, p.y) + rand(-0.14, 0.14);
      S.bullets.push({ x: car.x, y: car.y, angle: a, speed: 780, life: 0.9, fromPlayer: false });
    }
    // Busted: police touches the player on foot.
    if (p.onFoot && d < 34) { bustPlayer("Polisi menangkapmu!"); return; }
    // Ram the player's car.
    if (p.inCar && d < 46) {
      p.inCar.health -= 12 * dt;
      car.speed *= 0.6;
      if (p.inCar.health <= 0) explodeCar(p.inCar);
    }
  }
  // Wanted decay: no police nearby for 8s.
  const nearPolice = S.cars.some((c) => c.police && !c.dead && dist(c.x, c.y, p.x, p.y) < 650);
  if (S.wanted > 0 && !nearPolice) {
    S.wantedCooldown += dt;
    if (S.wantedCooldown > 8) { S.wanted--; S.wantedCooldown = 0; flash("Wanted turun: " + S.wanted + " bintang"); }
  } else S.wantedCooldown = 0;
}

function bustPlayer(reason) {
  S.screen = "busted";
  S.bustedReason = reason;
  S.money = Math.max(0, S.money - 100);
  saveGame();
}

function respawnAfterBusted() {
  S.player.x = HOSPITAL.x; S.player.y = HOSPITAL.y;
  S.player.inCar = null; S.player.onFoot = true; S.player.speed = 0;
  S.hp = 100; S.wanted = 0; S.wantedCooldown = 0;
  S.cars = S.cars.filter((c) => !c.police);
  S.screen = "playing";
}

// ---------------------------------------------------------------- combat
function updateBullets(dt) {
  for (const b of S.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (collidesBuilding(b.x, b.y, 4)) { b.life = 0; spawnSparks(b.x, b.y); continue; }
    if (b.fromPlayer) {
      // Hit peds.
      for (const ped of S.peds) {
        if (ped.down > 0) continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 14) {
          b.life = 0; ped.down = 4; ped.state = "down";
          S.stats.hits++;
          S.pickups.push({ x: ped.x, y: ped.y, kind: "cash", taken: false });
          break;
        }
      }
      if (b.life <= 0) continue;
      // Hit cars (not the player's own).
      for (const car of S.cars) {
        if (car.dead || S.player.inCar === car) continue;
        if (dist(b.x, b.y, car.x, car.y) < 30) {
          b.life = 0; S.stats.hits++;
          car.health -= 25;
          spawnSparks(b.x, b.y);
          if (car.health <= 0) explodeCar(car);
          break;
        }
      }
    } else {
      // Police bullet vs player.
      const p = S.player;
      const r = p.inCar ? 30 : 14;
      if (dist(b.x, b.y, p.x, p.y) < r) {
        b.life = 0;
        if (p.inCar) { p.inCar.health -= 8; if (p.inCar.health <= 0) explodeCar(p.inCar); }
        else {
          S.hp -= 10;
          if (S.hp <= 0) { S.hp = 0; bustPlayer("Kamu tertembak polisi!"); return; }
        }
      }
    }
  }
  S.bullets = S.bullets.filter((b) => b.life > 0);
}

function explodeCar(car) {
  if (car.dead) return;
  car.dead = true;
  car.explodeT = 0.6;
  spawnExplosion(car.x, car.y);
  const p = S.player;
  if (p.inCar === car) {
    p.inCar = null; p.onFoot = true; p.speed = 0;
    p.x = car.x + 50; p.y = car.y;
    S.hp = Math.max(1, S.hp - 30);
    flash("Mobilmu meledak!");
  }
  // Blast damages nearby cars and peds.
  for (const other of S.cars) {
    if (other === car || other.dead) continue;
    if (dist(car.x, car.y, other.x, other.y) < 130) {
      other.health -= 50;
      if (other.health <= 0) explodeCar(other);
    }
  }
  for (const ped of S.peds) {
    if (ped.down <= 0 && dist(car.x, car.y, ped.x, ped.y) < 130) { ped.down = 4; ped.state = "down"; }
  }
}

function spawnSparks(x, y) {
  for (let i = 0; i < 6; i++) {
    S.particles.push({ x, y, vx: rand(-120, 120), vy: rand(-120, 120), life: rand(0.15, 0.4), max: 0.4, color: "#ffd23d", size: rand(2, 4) });
  }
}
function spawnExplosion(x, y) {
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(40, 320);
    S.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.9), max: 0.9, color: pick(["#ff7a1a", "#ff2e2e", "#ffd23d", "#7a7a7a"]), size: rand(4, 12) });
  }
}
function updateParticles(dt) {
  for (const pt of S.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.96; pt.vy *= 0.96; pt.life -= dt;
  }
  S.particles = S.particles.filter((pt) => pt.life > 0);
  for (const car of S.cars) if (car.dead && car.explodeT > 0) car.explodeT -= dt;
  S.cars = S.cars.filter((c) => !(c.dead && c.explodeT <= 0));
  // Keep traffic topped up.
  const traffic = S.cars.filter((c) => !c.police && !c.parked && !c.gold).length;
  if (traffic < 10 && rng() < dt * 0.5) {
    const vertical = rng() < 0.5, c = pick(roadCenters);
    const car = makeCar(vertical ? c : rand(100, WORLD - 100), vertical ? rand(100, WORLD - 100) : c, 0, { road: vertical ? "v" : "h" });
    car.speed = rand(60, 110);
    S.cars.push(car);
  }
}

// ---------------------------------------------------------------- missions
const MISSIONS = [
  { id: 0, title: "Misi 1 — Roda Pertama", text: "Curi sebuah mobil (tekan E di dekat mobil).", reward: 150,
    target: () => nearestCarPos(), done: () => !!S.player.inCar },
  { id: 1, title: "Misi 2 — Antar Paket", text: "Antar paket ke titik kuning di timur kota.", reward: 300,
    target: () => DELIVERY, done: () => S.player.inCar && dist(S.player.x, S.player.y, DELIVERY.x, DELIVERY.y) < DELIVERY.r },
  { id: 2, title: "Misi 3 — Rampok Toko", text: "Masuk ke toko dan rampok (tahan 3 detik di dalam), lalu hilangkan wanted.", reward: 500,
    target: () => SHOP, done: () => S.missionProgress >= 1 && S.wanted === 0 },
  { id: 3, title: "Misi 4 — Kabur dari Bay", text: "Bertahan 90 detik dengan wanted 3. Jangan sampai tertangkap!", reward: 900,
    target: () => ({ x: S.player.x, y: S.player.y }), done: () => S.missionTimer <= 0 },
  { id: 4, title: "Misi 5 — Mobil Emas", text: "Curi mobil emas di timur, antar ke penthouse.", reward: 1500,
    target: () => goldCarPos(), done: () => inGoldCar() && dist(S.player.x, S.player.y, PENTHOUSE.x, PENTHOUSE.y) < PENTHOUSE.r },
];

function nearestCarPos() {
  let best = null, bd = Infinity;
  for (const car of S.cars) {
    if (car.dead || car.police) continue;
    const d = dist(S.player.x, S.player.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best ? { x: best.x, y: best.y } : { x: 1125, y: 675 };
}
function goldCarPos() {
  const g = S.cars.find((c) => c.gold && !c.dead);
  return g ? { x: g.x, y: g.y } : PENTHOUSE;
}
function inGoldCar() { return !!(S.player.inCar && S.player.inCar.gold); }

function completeMission() {
  const m = MISSIONS[S.mission];
  if (!m) return;
  S.money += m.reward;
  flash(m.title + " SELESAI! +$" + m.reward);
  S.mission++;
  S.missionProgress = 0; S.missionTimer = 0;
  if (S.mission === 3) { S.wanted = 3; S.missionTimer = 90; }
  if (S.mission >= MISSIONS.length) {
    S.screen = "win";
    saveGame();
    return;
  }
  saveGame();
}

function updateMissions(dt) {
  const m = MISSIONS[S.mission];
  if (!m || S.screen !== "playing") return;
  if (S.mission === 2) {
    if (S.player.onFoot && dist(S.player.x, S.player.y, SHOP.x, SHOP.y) < SHOP.r && S.missionProgress < 1) {
      S.missionProgress += dt / 3;
      if (S.missionProgress >= 1) S.wanted = Math.max(S.wanted, 2);
    }
    if (S.missionProgress >= 1 && S.wanted === 0) completeMission();
  } else if (S.mission === 3) {
    if (S.wanted >= 2) S.missionTimer -= dt;
    if (S.missionTimer <= 0) completeMission();
  } else if (m.done()) {
    completeMission();
  }
}

// ---------------------------------------------------------------- flow
function flash(msg) { S.message = msg; S.messageT = 2.5; }

function startGame(freeRoam) {
  if (freeRoam) {
    S.screen = "playing";
    return;
  }
  const save = loadSave();
  if (save && save.mission > 0) {
    // Continue is handled by the menu click; Enter starts fresh.
    S = freshState();
  } else {
    S = freshState();
  }
  resetWorld();
  S.screen = "playing";
  S.message = "Misi 1: curi sebuah mobil (E)";
  S.messageT = 4;
}

function startContinue() {
  const save = loadSave();
  S = freshState();
  resetWorld();
  if (save) {
    S.money = save.money || 0;
    S.mission = save.mission || 0;
    S.player.x = save.px || 675; S.player.y = save.py || 675;
    if (S.mission === 3) { S.wanted = 3; S.missionTimer = 90; }
  }
  S.screen = "playing";
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: S.money, mission: Math.min(S.mission, MISSIONS.length - 1),
      px: Math.round(S.player.x), py: Math.round(S.player.y),
    }));
  } catch (e) { /* storage unavailable (private mode) — non-fatal */ }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// ---------------------------------------------------------------- main loop
let lastT = 0;
function tick(t) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  if (S.screen === "playing") {
    S.time += dt;
    updatePlayer(dt);
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateBullets(dt);
    updateParticles(dt);
    updateMissions(dt);
    if (S.messageT > 0) S.messageT -= dt;
    // Camera follows the player.
    S.cam.x = clamp(S.player.x, VIEW_W / 2 / 0.9, WORLD - VIEW_W / 2 / 0.9);
    S.cam.y = clamp(S.player.y, VIEW_H / 2 / 0.9, WORLD - VIEW_H / 2 / 0.9);
  }
  render();
}

// ---------------------------------------------------------------- render
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0b0e1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (S.screen === "menu") { renderMenu(); return; }
  const zoom = 0.9;
  const ox = canvas.width / 2 - S.cam.x * zoom;
  const oy = canvas.height / 2 - S.cam.y * zoom;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(zoom, zoom);
  renderWorld();
  renderPickups();
  renderCars();
  renderPeds();
  renderPlayer();
  renderBullets();
  renderParticles();
  renderObjectiveMarker();
  ctx.restore();
  renderHUD();
  if (S.screen === "paused") renderPaused();
  if (S.screen === "busted") renderBusted();
  if (S.screen === "win") renderWin();
}

function renderWorld() {
  // Ground + blocks.
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, 0, WORLD, WORLD);
  ctx.fillStyle = COLORS.block;
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const x = roadCenters[i] + ROAD_W / 2;
      const y = roadCenters[j] + ROAD_W / 2;
      ctx.fillRect(x, y, ROAD_GAP - ROAD_W, ROAD_GAP - ROAD_W);
    }
  }
  // Roads.
  ctx.fillStyle = COLORS.road;
  for (const c of roadCenters) {
    ctx.fillRect(c - ROAD_W / 2, 0, ROAD_W, WORLD);
    ctx.fillRect(0, c - ROAD_W / 2, WORLD, ROAD_W);
  }
  // Center dashes.
  ctx.fillStyle = COLORS.dash;
  for (const c of roadCenters) {
    for (let v = 0; v < WORLD; v += 60) {
      if (isOnRoad(v, c) && isOnRoad(c, v)) continue; // skip intersections
      ctx.fillRect(c - 2, v, 4, 28);
      ctx.fillRect(v, c - 2, 28, 4);
    }
  }
  // Buildings / parks.
  for (const b of buildings) {
    ctx.fillStyle = b.park ? COLORS.park : b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    if (!b.park) {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(b.x, b.y + b.h - 12, b.w, 12);
    }
  }
  // Landmarks.
  drawLandmark(SHOP, "#ffd23d");
  drawLandmark(DELIVERY, "#ffd23d");
  drawLandmark(PENTHOUSE, "#ff5da2");
  drawLandmark(HOSPITAL, "#5ad1e8");
}

function drawLandmark(lm, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 4;
  ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.arc(lm.x, lm.y, lm.r * 0.7, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(lm.label, lm.x, lm.y - lm.r * 0.7 - 10);
  ctx.restore();
}

function drawCarShape(car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const len = car.gold ? 64 : 56, wid = 28;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  ctx.fillStyle = car.police ? "#101014" : car.color;
  roundRect(-len / 2, -wid / 2, len, wid, 8);
  ctx.fill();
  if (car.police) {
    ctx.fillStyle = "#f2f2f2";
    ctx.fillRect(-len / 2 + 8, -wid / 2, len - 16, wid);
    ctx.fillStyle = (Math.floor(S.time * 6) % 2 === 0) ? "#ff2e2e" : "#2e6bff";
    ctx.fillRect(-6, -wid / 2 - 4, 12, 8);
  } else {
    ctx.fillStyle = "rgba(180,220,255,0.85)";
    ctx.fillRect(len * 0.08, -wid / 2 + 4, 14, wid - 8);
    ctx.fillStyle = "#ffe9a8";
    ctx.fillRect(len / 2 - 4, -wid / 2 + 3, 4, 6);
    ctx.fillRect(len / 2 - 4, wid / 2 - 9, 4, 6);
  }
  if (car.gold) {
    ctx.fillStyle = "#fff3b0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("$", 0, 5);
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

function renderCars() {
  for (const car of S.cars) {
    if (car.dead) continue;
    drawCarShape(car);
    if (car.police) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("POLICE", car.x, car.y - 24);
    }
  }
}

function renderPeds() {
  for (const ped of S.peds) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.down > 0) {
      ctx.rotate(1.2);
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#0b0e1a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ped.angle) * 12, Math.sin(ped.angle) * 12); ctx.stroke();
    }
    ctx.restore();
  }
}

function renderPlayer() {
  const p = S.player;
  if (p.inCar) {
    drawCarShape({ ...p.inCar, color: p.inCar.gold ? COLORS.gold : COLORS.playerCar });
    return;
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(6, -3, 12, 6);
  ctx.restore();
}

function renderBullets() {
  ctx.fillStyle = "#ffd23d";
  for (const b of S.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillRect(-8, -2, 16, 4);
    ctx.restore();
  }
}

function renderParticles() {
  for (const pt of S.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function renderPickups() {
  for (const pk of S.pickups) {
    if (pk.taken) continue;
    ctx.save();
    ctx.translate(pk.x, pk.y);
    if (pk.kind === "health") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(-12, -12, 24, 24);
      ctx.fillStyle = "#e83a3a";
      ctx.fillRect(-3, -9, 6, 18);
      ctx.fillRect(-9, -3, 18, 6);
    } else {
      ctx.fillStyle = "#37d67a";
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#07331a";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("$", 0, 5);
    }
    ctx.restore();
  }
}

function renderObjectiveMarker() {
  const m = MISSIONS[S.mission];
  if (!m || S.screen !== "playing") return;
  const t = m.target();
  // Pulsing ring at the target.
  const pulse = 1 + Math.sin(S.time * 4) * 0.15;
  ctx.save();
  ctx.strokeStyle = "#ffd23d"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(t.x, t.y, 46 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#ffd23d";
  ctx.beginPath(); ctx.arc(t.x, t.y, 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Edge arrow pointing at the target.
  const p = S.player;
  const dx = t.x - p.x, dy = t.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d > 320) {
    const a = Math.atan2(dy, dx);
    const ax = canvas.width / 2 + Math.cos(a) * 300;
    const ay = canvas.height / 2 + Math.sin(a) * 220;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = "#ffd23d";
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#ffd23d";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(Math.round(d) + "m", ax, ay + 30);
  }
}

// ---------------------------------------------------------------- HUD & menus
function renderHUD() {
  ctx.save();
  ctx.textAlign = "left";
  // Money + HP.
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(12, 12, 250, 64);
  ctx.fillStyle = "#37d67a";
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.fillText("$" + S.money.toLocaleString("en-US"), 24, 44);
  ctx.fillStyle = "#333";
  ctx.fillRect(24, 54, 180, 10);
  ctx.fillStyle = S.hp > 30 ? "#37d67a" : "#e83a3a";
  ctx.fillRect(24, 54, 180 * (S.hp / 100), 10);
  ctx.fillStyle = "#fff";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText("HP " + Math.round(S.hp), 210, 64);
  // Wanted stars.
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(canvas.width - 212, 12, 200, 44);
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < S.wanted ? "#ffd23d" : "#444";
    ctx.fillText("★", canvas.width - 182 + i * 34, 44);
  }
  // Mission banner.
  const m = MISSIONS[S.mission];
  if (m && S.screen === "playing") {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    const tw = Math.min(640, ctx.measureText(m.text).width + 60);
    ctx.fillRect(canvas.width / 2 - tw / 2, 12, tw, 64);
    ctx.fillStyle = "#ffd23d";
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.fillText(m.title, canvas.width / 2, 36);
    ctx.fillStyle = "#fff";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(m.text, canvas.width / 2, 60);
    if (S.mission === 2 && S.missionProgress > 0 && S.missionProgress < 1) {
      ctx.fillStyle = "#333";
      ctx.fillRect(canvas.width / 2 - 100, 66, 200, 8);
      ctx.fillStyle = "#ffd23d";
      ctx.fillRect(canvas.width / 2 - 100, 66, 200 * S.missionProgress, 8);
    }
    if (S.mission === 3) {
      ctx.fillStyle = "#ff5da2";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.fillText("Sisa: " + Math.ceil(S.missionTimer) + " dtk", canvas.width / 2, 96);
    }
  }
  // Flash message.
  if (S.messageT > 0) {
    ctx.textAlign = "center";
    ctx.globalAlpha = clamp(S.messageT, 0, 1);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillText(S.message, canvas.width / 2, canvas.height - 90);
    ctx.globalAlpha = 1;
  }
  renderMinimap();
  ctx.restore();
}

function renderMinimap() {
  const size = 170, x0 = canvas.width - size - 12, y0 = canvas.height - size - 12;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.fillStyle = "#1d2438";
  ctx.fillRect(x0, y0, size, size);
  const k = size / WORLD;
  ctx.fillStyle = "#2c3550";
  for (const c of roadCenters) {
    ctx.fillRect(x0, y0 + c * k - 2, size, 4);
    ctx.fillRect(x0 + c * k - 2, y0, 4, size);
  }
  const m = MISSIONS[S.mission];
  if (m && S.screen === "playing") {
    const t = m.target();
    ctx.fillStyle = "#ffd23d";
    ctx.beginPath(); ctx.arc(x0 + t.x * k, y0 + t.y * k, 5, 0, Math.PI * 2); ctx.fill();
  }
  for (const car of S.cars) {
    if (car.dead) continue;
    ctx.fillStyle = car.police ? "#2e6bff" : car.gold ? "#ffc93d" : "#8a94ad";
    ctx.fillRect(x0 + car.x * k - 2, y0 + car.y * k - 2, 4, 4);
  }
  ctx.fillStyle = COLORS.player;
  ctx.beginPath(); ctx.arc(x0 + S.player.x * k, y0 + S.player.y * k, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x0 + S.player.x * k, y0 + S.player.y * k, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function renderMenu() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#1a0b2e");
  g.addColorStop(0.55, "#3d1147");
  g.addColorStop(1, "#ff7a1a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Sun.
  ctx.fillStyle = "#ffd23d";
  ctx.beginPath(); ctx.arc(canvas.width / 2, 330, 120, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ff5da2";
  ctx.beginPath(); ctx.arc(canvas.width / 2, 330, 95, 0, Math.PI * 2); ctx.fill();
  // Skyline.
  ctx.fillStyle = "#0b0e1a";
  let x = 0;
  const skyRng = mulberry32(7);
  while (x < canvas.width) {
    const w = 40 + skyRng() * 90, h = 80 + skyRng() * 200;
    ctx.fillRect(x, 560 - h, w, h);
    x += w + 6;
  }
  ctx.fillStyle = "#0b0e1a";
  ctx.fillRect(0, 560, canvas.width, canvas.height - 560);
  // Title.
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 110px system-ui, sans-serif";
  ctx.fillText("VICE BAY", canvas.width / 2, 250);
  ctx.fillStyle = "#ffd23d";
  ctx.font = "bold 28px system-ui, sans-serif";
  ctx.fillText("OPEN-WORLD CRIME • 2D TOP-DOWN", canvas.width / 2, 300);
  // Buttons.
  const save = loadSave();
  drawButton(canvas.width / 2 - 180, 620, 360, 58, "▶  NEW GAME  (Enter)");
  if (save && save.mission > 0) drawButton(canvas.width / 2 - 180, 690, 360, 58, "↻  CONTINUE — Misi " + (save.mission + 1));
  ctx.fillStyle = "#cfd8ec";
  ctx.font = "15px system-ui, sans-serif";
  ctx.fillText("WASD gerak • Shift lari • E masuk/keluar mobil • F / klik tembak • P jeda", canvas.width / 2, 800);
  ctx.fillText("5 misi berantai • wanted 0–5 bintang • polisi, rampok toko, mobil emas • save otomatis", canvas.width / 2, 828);
}

function drawButton(x, y, w, h, label) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#ffd23d";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y + 37);
}

function renderPaused() {
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 56px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("JEDA", canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = "20px system-ui, sans-serif";
  ctx.fillText("Tekan P / Esc untuk lanjut", canvas.width / 2, canvas.height / 2 + 30);
}

function renderBusted() {
  ctx.fillStyle = "rgba(20,0,0,0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ff5d5d";
  ctx.font = "bold 72px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BUSTED!", canvas.width / 2, canvas.height / 2 - 30);
  ctx.fillStyle = "#fff";
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillText(S.bustedReason + "  Denda $100.", canvas.width / 2, canvas.height / 2 + 20);
  ctx.fillText("Klik untuk bangkit di rumah sakit", canvas.width / 2, canvas.height / 2 + 60);
}

function renderWin() {
  ctx.fillStyle = "rgba(0,20,10,0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffd23d";
  ctx.font = "bold 64px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("KAMU MENANG!", canvas.width / 2, canvas.height / 2 - 60);
  ctx.fillStyle = "#fff";
  ctx.font = "26px system-ui, sans-serif";
  ctx.fillText("Semua 5 misi selesai. Total: $" + S.money.toLocaleString("en-US"), canvas.width / 2, canvas.height / 2);
  ctx.font = "20px system-ui, sans-serif";
  ctx.fillText("Enter / klik = free roam • Muat ulang halaman = main lagi", canvas.width / 2, canvas.height / 2 + 50);
}

// ---------------------------------------------------------------- debug hook (for automated tests)
window.VB = {
  get state() { return S; },
  get missions() { return MISSIONS; },
  start(freeRoam) { startGame(!!freeRoam); },
  startContinue() { startContinue(); },
  teleport(x, y) { S.player.x = x; S.player.y = y; if (S.player.inCar) { S.player.inCar.x = x; S.player.inCar.y = y; } },
  setMission(i) { S.mission = i; S.missionProgress = 0; if (i === 3) { S.wanted = 3; S.missionTimer = 90; } },
  setTimer(n) { S.missionTimer = n; },
  setWanted(n) { S.wanted = n; },
  enterNearestCar() { tryEnterExitCar(); },
  damagePlayer(n) { S.hp = Math.max(0, S.hp - n); },
  save() { saveGame(); },
  load() { return loadSave(); },
};
window.__VB_READY__ = true;
requestAnimationFrame(tick);
