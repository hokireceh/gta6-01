// VICE BAY — the orchestrator. The Game class owns the state, the city, the
// input pad and the frame loop, and delegates every subsystem to its module:
// world building to world.js, minds to ai.js, fighting to combat.js,
// missions to missions.js and all drawing to render.js.
//
// The automated checks drive the game through window.VB, so that hook keeps
// the exact same shape as the earlier builds: state, missions, start,
// startContinue, teleport, setMission, setTimer, setWanted, enterNearestCar,
// damagePlayer, save and load.

import {
  WORLD_SIZE, VIEW_W, VIEW_H, ZOOM, CITY_SEED, LANDMARKS, TUNING,
} from "./config.js";
import { clamp, distance } from "./math.js";
import { SeededRandom } from "./random.js";
import { City, populate } from "./world.js";
import { makePlayer, makeFleeingPed, makePickup } from "./entities.js";
import { InputPad } from "./input.js";
import { stepTraffic, stepPedestrians, stepPolice } from "./ai.js";
import {
  flash, playerShoot, stepBullets, sweepWrecks, spawnSparks, stepParticles,
} from "./combat.js";
import {
  MISSIONS, finishMission, stepMissions, saveGame, loadGame, applySave,
} from "./missions.js";
import { drawFrame } from "./render.js";

function freshState() {
  return {
    screen: "menu",
    time: 0,
    money: 0,
    hp: 100,
    wanted: 0,
    wantedCooldown: 0,
    mission: 0,
    missionTimer: 0,
    missionProgress: 0,
    player: makePlayer(),
    cars: [],
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

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.random = new SeededRandom(CITY_SEED);
    this.city = new City(this.random);
    this.g = freshState();
    populate(this.g, this.city, this.random);
    this.input = new InputPad(canvas, {
      onConfirm: () => this.confirm(),
      onPause: () => this.togglePause(),
      onEnterCar: () => { if (this.g.screen === "playing") this.toggleCar(); },
      onShoot: () => { if (this.g.screen === "playing") playerShoot(this.g, this.random); },
      onPrimaryDown: () => this.primaryDown(),
      onCanvasClick: () => { if (this.g.screen === "busted") this.respawnAfterBusted(); },
    });
    this.lastT = 0;
    requestAnimationFrame((t) => this.tick(t));
  }

  confirm() {
    if (this.g.screen === "menu") this.start(false);
    else if (this.g.screen === "win") this.start(true);
  }

  primaryDown() {
    if (this.g.screen === "menu") this.start(false);
    else if (this.g.screen === "win") this.start(true);
    else if (this.g.screen === "playing") playerShoot(this.g, this.random);
  }

  togglePause() {
    if (this.g.screen === "playing") {
      this.g.screen = "paused";
      saveGame(this.g);
    } else if (this.g.screen === "paused") {
      this.g.screen = "playing";
    }
  }

  start(freeRoam) {
    if (freeRoam) {
      this.g.screen = "playing";
      return;
    }
    this.g = freshState();
    populate(this.g, this.city, this.random);
    this.g.screen = "playing";
    this.g.message = "Misi 1 — curi sebuah mobil (E)";
    this.g.messageT = 4;
  }

  startContinue() {
    const save = loadGame();
    this.g = freshState();
    populate(this.g, this.city, this.random);
    applySave(this.g, save);
    this.g.screen = "playing";
  }

  bustPlayer(reason) {
    this.g.screen = "busted";
    this.g.bustedReason = reason;
    this.g.money = Math.max(0, this.g.money - TUNING.bustedFine);
    saveGame(this.g);
  }

  respawnAfterBusted() {
    const g = this.g;
    g.player.x = LANDMARKS.hospital.x;
    g.player.y = LANDMARKS.hospital.y;
    g.player.inCar = null;
    g.player.onFoot = true;
    g.player.speed = 0;
    g.hp = 100;
    g.wanted = 0;
    g.wantedCooldown = 0;
    g.cars = g.cars.filter((c) => !c.police);
    g.screen = "playing";
  }

  toggleCar() {
    const g = this.g;
    const player = g.player;
    if (player.inCar) {
      const car = player.inCar;
      player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
      player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
      player.angle = car.angle;
      player.inCar = null;
      player.onFoot = true;
      player.speed = 0;
      return;
    }
    let best = null;
    let bestDist = 70;
    for (const car of g.cars) {
      if (car.dead) continue;
      const d = distance(player.x, player.y, car.x, car.y);
      if (d < bestDist) { best = car; bestDist = d; }
    }
    if (!best) return;
    if (best.police) {
      flash(g, "Mobil polisi tidak bisa dicuri!");
      return;
    }
    if (best.driver && !best.parked) {
      best.driver = false;
      g.wanted = Math.min(5, g.wanted + 1);
      g.stats.carsStolen++;
      g.peds.push(makeFleeingPed(best.x, best.y, this.random));
      flash(g, "Mobil dibajak! Wanted +1");
    }
    player.inCar = best;
    player.onFoot = false;
    best.parked = false;
    best.road = null;
    player.x = best.x;
    player.y = best.y;
    player.angle = best.angle;
    if (g.mission === 0) finishMission(g);
  }

  updatePlayer(dt) {
    const g = this.g;
    const player = g.player;
    player.shootCd = Math.max(0, player.shootCd - dt);
    if (player.inCar) {
      this.driveCar(dt);
      return;
    }
    let mx = 0;
    let my = 0;
    if (this.input.held("KeyW") || this.input.held("ArrowUp")) my -= 1;
    if (this.input.held("KeyS") || this.input.held("ArrowDown")) my += 1;
    if (this.input.held("KeyA") || this.input.held("ArrowLeft")) mx -= 1;
    if (this.input.held("KeyD") || this.input.held("ArrowRight")) mx += 1;
    const sprint = this.input.held("ShiftLeft") || this.input.held("ShiftRight");
    const speed = sprint ? TUNING.sprintSpeed : TUNING.walkSpeed;
    if (mx || my) {
      const len = Math.hypot(mx, my);
      const nx = player.x + (mx / len) * speed * dt;
      const ny = player.y + (my / len) * speed * dt;
      player.angle = Math.atan2(my, mx);
      if (!this.city.hitsBuilding(nx, player.y, 14)) player.x = nx;
      if (!this.city.hitsBuilding(player.x, ny, 14)) player.y = ny;
    }
    player.x = clamp(player.x, 40, WORLD_SIZE - 40);
    player.y = clamp(player.y, 40, WORLD_SIZE - 40);
    if ((this.input.held("KeyF") || this.input.mouse.down) && player.shootCd <= 0) {
      playerShoot(g, this.random);
    }
    for (const pickup of g.pickups) {
      if (!pickup.taken && distance(player.x, player.y, pickup.x, pickup.y) < 34) {
        pickup.taken = true;
        if (pickup.kind === "health") {
          g.hp = Math.min(100, g.hp + TUNING.healthPickupAmount);
          flash(g, "HP +40");
        } else {
          g.money += TUNING.cashPickupAmount;
          flash(g, "+$50");
        }
      }
    }
  }

  driveCar(dt) {
    const g = this.g;
    const player = g.player;
    const car = player.inCar;
    const up = this.input.held("KeyW") || this.input.held("ArrowUp");
    const down = this.input.held("KeyS") || this.input.held("ArrowDown");
    const left = this.input.held("KeyA") || this.input.held("ArrowLeft");
    const right = this.input.held("KeyD") || this.input.held("ArrowRight");
    if (up) car.speed = Math.min(TUNING.carTopSpeed, car.speed + TUNING.carAccel * dt);
    else if (down) car.speed = Math.max(TUNING.carReverseSpeed, car.speed - TUNING.carBrake * dt);
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), TUNING.carDrag * dt);
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    if (Math.abs(car.speed) > 20) {
      car.angle += steer * (car.speed > 0 ? 1 : -1) * TUNING.carSteer * dt *
        Math.min(1, Math.abs(car.speed) / TUNING.carSteerSpeed);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (this.city.hitsBuilding(nx, ny, 26)) {
      if (Math.abs(car.speed) > 140) {
        car.health -= 8;
        spawnSparks(g, car.x, car.y, this.random);
      }
      car.speed *= -0.25;
    } else {
      car.x = clamp(nx, 50, WORLD_SIZE - 50);
      car.y = clamp(ny, 50, WORLD_SIZE - 50);
    }
    for (const ped of g.peds) {
      if (ped.down > 0) continue;
      if (distance(car.x, car.y, ped.x, ped.y) < 30 && Math.abs(car.speed) > 60) {
        ped.down = TUNING.pedDownSeconds;
        ped.state = "down";
        g.stats.pedsDown++;
        g.pickups.push(makePickup(ped.x, ped.y, "cash"));
        spawnSparks(g, ped.x, ped.y, this.random);
      }
    }
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    if ((this.input.held("KeyF") || this.input.mouse.down) && player.shootCd <= 0) {
      playerShoot(g, this.random);
    }
  }

  tick(t) {
    requestAnimationFrame((next) => this.tick(next));
    const dt = Math.min(0.05, (t - this.lastT) / 1000 || 0.016);
    this.lastT = t;
    const g = this.g;
    // The input pad owns the live mouse; mirror it into the state so the
    // pistol aim (which reads g.mouse) follows the real cursor. Without
    // this the aim stays at the spawn-time center and every shot flies east.
    g.mouse.x = this.input.mouse.x;
    g.mouse.y = this.input.mouse.y;
    g.mouse.down = this.input.mouse.down;
    if (g.screen === "playing") {
      g.time += dt;
      this.updatePlayer(dt);
      stepTraffic(g, this.city, this.random, dt);
      stepPedestrians(g, this.city, this.random, dt);
      stepPolice(g, this.city, this.random, dt, (reason) => this.bustPlayer(reason));
      stepBullets(g, this.city, this.random, dt, (reason) => this.bustPlayer(reason));
      sweepWrecks(g, this.random);
      stepParticles(g, this.city, this.random, dt);
      stepMissions(g, dt);
      if (g.messageT > 0) g.messageT -= dt;
      g.cam.x = clamp(g.player.x, VIEW_W / 2 / ZOOM, WORLD_SIZE - VIEW_W / 2 / ZOOM);
      g.cam.y = clamp(g.player.y, VIEW_H / 2 / ZOOM, WORLD_SIZE - VIEW_H / 2 / ZOOM);
    }
    drawFrame(this.ctx, this.canvas, g, this.city);
  }
}

const game = new Game(document.getElementById("game"));

// Round 5 note: the entrypoint now builds dossier.json with the vendored buildDossier and copies screenshots/ into the output.
// Debug hook for automated tests (same contract as the earlier builds).
window.VB = {
  get state() { return game.g; },
  get missions() { return MISSIONS; },
  start(freeRoam) { game.start(!!freeRoam); },
  startContinue() { game.startContinue(); },
  teleport(x, y) {
    const g = game.g;
    g.player.x = x;
    g.player.y = y;
    if (g.player.inCar) { g.player.inCar.x = x; g.player.inCar.y = y; }
  },
  setMission(i) {
    const g = game.g;
    g.mission = i;
    g.missionProgress = 0;
    if (i === 3) { g.wanted = 3; g.missionTimer = TUNING.getawaySeconds; }
  },
  setTimer(n) { game.g.missionTimer = n; },
  setWanted(n) { game.g.wanted = n; },
  enterNearestCar() { game.toggleCar(); },
  damagePlayer(n) { game.g.hp = Math.max(0, game.g.hp - n); },
  save() { saveGame(game.g); },
  load() { return loadGame(); },
};
window.__VB_READY__ = true;
