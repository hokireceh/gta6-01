// Vice Bay — the game itself: state, loop, driving, crime and police.
// Boots on load: `new Game(canvas)` + `game.start()` at the bottom.

import { SAVE_KEY, TUNING, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config.js';
import { angleTo, clamp, dist, lerp } from './math.js';
import { RNG } from './random.js';
import { Input } from './input.js';
import {
  CAR_COLORS, PED_SHIRTS, driveCar, makeCar, makeFootCop, makeParticle,
  makePed, makePickup, makePlayer,
} from './entities.js';
import { buildWorld, collideCircle, nearestRoadPoint, randomRoadPoint } from './world.js';
import { addWanted, copShoot, fireBullet, updateBullets } from './combat.js';
import { updateFootCop, updatePeds, updatePoliceCar, updateTraffic } from './ai.js';
import { MissionManager } from './missions.js';
import { Renderer } from './render.js';
import { applyShot } from './shots.js';

const COURIER_COLOR = '#ff5c8a';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas);
    this.world = buildWorld();
    this.rng = new RNG(777);
    this.save = this.loadSave();
    this.muted = this.save?.muted || false;
    this.audio = null;
    this.mode = 'menu';
    this.time = 0;
    this.cash = 250;
    this.wanted = 0;
    this.wantedTimer = 0;
    this.seenTimer = 0;
    this.messageText = '';
    this.messageUntil = 0;
    this.dangerUntil = 0;
    this.reloadTimer = 0;
    this.stats = { shots: 0, hits: 0, carsStolen: 0 };
    this.nearCar = null;
    this.courier = null;
    this.camera = { x: 0, y: 0, shake: 0 };
    this.resetWorld();
    this._last = 0;
    this._raf = 0;
  }

  // ------------------------------------------------------------ save

  loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (typeof s !== 'object' || s === null) return null;
      return s;
    } catch {
      return null;
    }
  }

  persistSave() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: Math.floor(this.cash),
        missionIndex: Math.min(this.missions.index, 3),
        muted: this.muted,
      }));
    } catch {
      // Storage may be unavailable; the game still plays.
    }
  }

  // ------------------------------------------------------------ setup

  resetWorld() {
    const w = this.world;
    this.player = makePlayer(w.depot.x + 40, w.depot.y + 40);
    this.cars = [];
    this.peds = [];
    this.cops = [];
    this.bullets = [];
    this.particles = [];
    this.pickups = [];
    this.courier = null;
    this.wanted = 0;
    this.seenTimer = 0;
    this.cash = this.save?.cash ?? 250;
    this.stats = { shots: 0, hits: 0, carsStolen: 0 };
    // Parked cars along the roads, free to take.
    for (let i = 0; i < 7; i++) {
      const p = randomRoadPoint(w, this.rng);
      const car = makeCar(
        p.axis === 'v' ? p.x + 22 : p.x,
        p.axis === 'h' ? p.y + 22 : p.y,
        p.axis === 'v' ? Math.PI / 2 : 0,
        CAR_COLORS[i % CAR_COLORS.length],
        'parked',
      );
      car.axis = p.axis;
      car.road = p.road;
      this.cars.push(car);
    }
    // Traffic.
    for (let i = 0; i < TUNING.trafficCars; i++) {
      const p = randomRoadPoint(w, this.rng);
      const car = makeCar(p.x, p.y, p.axis === 'v' ? Math.PI / 2 : 0, this.rng.pick(CAR_COLORS), 'traffic');
      car.axis = p.axis;
      car.road = p.road;
      car.dir = this.rng.chance(0.5) ? 1 : -1;
      car.lane = 8;
      car.cruise = this.rng.range(120, 210);
      car.speed = car.cruise * 0.6;
      this.cars.push(car);
    }
    // Pedestrians on the sidewalks.
    for (let i = 0; i < TUNING.pedestrians; i++) {
      const p = randomRoadPoint(w, this.rng);
      const ped = makePed(
        p.axis === 'v' ? p.x + 52 : p.x,
        p.axis === 'h' ? p.y + 52 : p.y,
        this.rng.pick(PED_SHIRTS),
      );
      ped.axis = p.axis;
      ped.dir = this.rng.chance(0.5) ? 1 : -1;
      ped.wander = this.rng.range(1, 5);
      this.peds.push(ped);
    }
    // Pickups: health, ammo and cash around town.
    const spots = [
      [w.avenues[2], w.streets[0], 'health'],
      [w.avenues[6], w.streets[3], 'ammo'],
      [w.avenues[0], w.streets[4], 'cash'],
      [w.avenues[4], w.streets[5], 'health'],
      [w.avenues[7], w.streets[1], 'ammo'],
      [w.avenues[3], w.streets[2], 'cash'],
    ];
    spots.forEach(([x, y, type], i) => {
      const pk = makePickup(x + 70, y + 70, type);
      pk.bob = i * 1.3;
      this.pickups.push(pk);
    });
    this.missions = new MissionManager(w);
    if ((this.save?.missionIndex ?? 0) >= 3) {
      // A finished save opens in free roam, not back at the final job.
      this.missions.index = 3;
      this.missions.done = true;
      this.missions.steps = [];
    } else {
      this.missions.loadMission(this, Math.min(this.save?.missionIndex ?? 0, 2));
    }
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.camera.shake = 0;
    this.flashMessage('Selamat datang di Vice Bay', 3);
  }

  playerPos() {
    const p = this.player;
    if (!p.onFoot && p.car) return { x: p.car.x, y: p.car.y };
    return { x: p.x, y: p.y };
  }

  setWanted(n, message) {
    this.wanted = Math.min(TUNING.wantedMax, Math.max(0, n));
    this.wantedTimer = 0;
    this.seenTimer = 0;
    if (message) this.flashMessage(message, 2.6);
  }

  flashMessage(text, seconds = 2.5) {
    this.messageText = text;
    this.messageUntil = this.time + seconds;
  }

  onObjectiveReached(step) {
    this.blip(660, 0.12, 'sine', 0.12);
    const p = this.playerPos();
    for (let i = 0; i < 14; i++) {
      this.particles.push(makeParticle(
        p.x, p.y,
        (Math.random() - 0.5) * 260, (Math.random() - 0.5) * 260,
        0.6, '#ffd23f', 3,
      ));
    }
  }

  spawnCourier() {
    const p = this.playerPos();
    const spot = nearestRoadPoint(this.world, p.x + 500, p.y - 300);
    const courier = makeCar(spot.x, spot.y, spot.axis === 'v' ? Math.PI / 2 : 0, COURIER_COLOR, 'courier');
    courier.axis = spot.axis;
    courier.road = spot.road;
    courier.dir = 1;
    courier.cruise = 250;
    courier.speed = 200;
    this.cars.push(courier);
    this.courier = courier;
    return courier;
  }

  spawnPoliceCarNear() {
    const p = this.playerPos();
    const ang = Math.random() * Math.PI * 2;
    const spot = nearestRoadPoint(this.world, p.x + Math.cos(ang) * 750, p.y + Math.sin(ang) * 750);
    const car = makeCar(spot.x, spot.y, 0, '#2b4fd8', 'police');
    car.axis = spot.axis;
    car.road = spot.road;
    car.speed = 200;
    this.cars.push(car);
    return car;
  }

  spawnFootCopNear() {
    const p = this.playerPos();
    const ang = Math.random() * Math.PI * 2;
    const cop = makeFootCop(
      clamp(p.x + Math.cos(ang) * 420, 40, WORLD_W - 40),
      clamp(p.y + Math.sin(ang) * 420, 40, WORLD_H - 40),
    );
    this.cops.push(cop);
    return cop;
  }

  startPlaying() {
    if (this.mode === 'menu' || this.mode === 'win') this.mode = 'playing';
  }

  teleportPlayer(x, y) {
    this.player.x = x;
    this.player.y = y;
    this.camera.x = x;
    this.camera.y = y;
  }

  giveCarAt(x, y, angle) {
    const car = makeCar(x, y, angle, '#d94f3d', 'player');
    car.speed = 0;
    this.cars.push(car);
    this.enterCar(car, false);
    return car;
  }

  // ------------------------------------------------------------ audio

  ensureAudio() {
    if (this.audio || this.muted) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const engine = ctx.createOscillator();
      const engineGain = ctx.createGain();
      engine.type = 'sawtooth';
      engine.frequency.value = 60;
      engineGain.gain.value = 0;
      engine.connect(engineGain);
      engineGain.connect(ctx.destination);
      engine.start();
      const siren = ctx.createOscillator();
      const sirenGain = ctx.createGain();
      siren.type = 'sine';
      siren.frequency.value = 700;
      sirenGain.gain.value = 0;
      siren.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      siren.start();
      this.audio = { ctx, engine, engineGain, siren, sirenGain };
    } catch {
      this.audio = null;
    }
  }

  blip(freq, dur, type = 'sine', vol = 0.1) {
    if (!this.audio || this.muted) return;
    try {
      const { ctx } = this.audio;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch {
      // Audio is decoration; never break the game.
    }
  }

  gunshot() {
    if (!this.audio || this.muted) return;
    try {
      const { ctx } = this.audio;
      const len = Math.floor(ctx.sampleRate * 0.09);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.22;
      src.connect(g);
      g.connect(ctx.destination);
      src.start();
    } catch {
      // Ignore audio failures.
    }
  }

  updateAudio(dt) {
    if (!this.audio) return;
    const a = this.audio;
    if (this.muted) {
      a.engineGain.gain.value = 0;
      a.sirenGain.gain.value = 0;
      return;
    }
    const driving = !this.player.onFoot && this.player.car;
    const speed01 = driving ? Math.abs(this.player.car.speed) / TUNING.carMaxSpeed : 0;
    a.engine.frequency.value = 55 + speed01 * 160;
    a.engineGain.gain.value = driving ? 0.02 + speed01 * 0.03 : 0;
    if (this.wanted > 0 && this.mode === 'playing') {
      a.siren.frequency.value = Math.floor(this.time * 2.2) % 2 === 0 ? 720 : 960;
      a.sirenGain.gain.value = 0.018;
    } else {
      a.sirenGain.gain.value = 0;
    }
  }

  // ------------------------------------------------------------ loop

  start() {
    const tick = (t) => {
      const dt = Math.min(0.05, (t - this._last) / 1000 || 0.016);
      this._last = t;
      this.update(dt);
      this.renderer.draw(this);
      this.input.endFrame();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this._raf);
  }

  update(dt) {
    this.time += dt;
    if (this.input.anyPressed(['KeyM'])) {
      this.muted = !this.muted;
      this.persistSave();
      this.flashMessage(this.muted ? 'Suara mati' : 'Suara hidup', 1.2);
    }
    if (this.mode === 'menu') {
      this.camera.x = lerp(this.camera.x, this.world.plaza.x, 1 - Math.exp(-0.4 * dt));
      this.camera.y = lerp(this.camera.y, this.world.plaza.y, 1 - Math.exp(-0.4 * dt));
      if (this.input.anyPressed(['Enter', 'Space']) || this.input.mouseClicked) {
        this.ensureAudio();
        this.mode = 'playing';
        this.flashMessage(this.missions.objectiveLabel(), 3.5);
      }
      return;
    }
    if (this.mode === 'paused') {
      if (this.input.anyPressed(['KeyP', 'Escape'])) this.mode = 'playing';
      return;
    }
    if (this.mode === 'busted' || this.mode === 'wasted') {
      if (this.input.anyPressed(['Enter', 'Space'])) this.respawn();
      return;
    }
    if (this.mode === 'win') {
      if (this.input.anyPressed(['Enter', 'Space'])) this.mode = 'playing';
      return;
    }
    this.updatePlaying(dt);
  }

  respawn() {
    const w = this.world;
    this.player.health = TUNING.playerHealth;
    this.player.hurtFlash = 0;
    this.player.bustHold = 0;
    if (this.player.car) {
      this.player.car.driver = 'parked';
      this.player.car = null;
    }
    this.player.onFoot = true;
    this.player.x = w.depot.x + 40;
    this.player.y = w.depot.y + 40;
    this.cops = [];
    this.bullets = [];
    this.wanted = 0;
    this.seenTimer = 0;
    // A failed final mission restarts from its beginning.
    if (this.missions.index === 2 && !this.missions.done) {
      this.missions.loadMission(this, 2);
    }
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.mode = 'playing';
    this.flashMessage('Kembali ke jalanan Vice Bay', 2.5);
  }

  // ------------------------------------------------------------ play

  updatePlaying(dt) {
    const p = this.player;
    const input = this.input;
    if (input.anyPressed(['KeyP', 'Escape'])) {
      this.mode = 'paused';
      return;
    }
    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        p.ammo = TUNING.pistolAmmo;
        this.blip(880, 0.08, 'square', 0.06);
      }
    }

    // Aim: on foot the pistol follows the mouse.
    if (p.onFoot) {
      const wx = this.input.mouseX + this.camera.x - VIEW_W / 2;
      const wy = this.input.mouseY + this.camera.y - VIEW_H / 2;
      p.angle = angleTo(p.x, p.y, wx, wy);
    }

    const axis = input.axis();
    if (p.onFoot) {
      const sprint = input.anyOf(['ShiftLeft', 'ShiftRight']);
      const speed = sprint ? TUNING.sprintSpeed : TUNING.walkSpeed;
      const len = Math.hypot(axis.x, axis.y) || 1;
      if (axis.x !== 0 || axis.y !== 0) {
        p.x += (axis.x / len) * speed * dt;
        p.y += (axis.y / len) * speed * dt;
        p.walkPhase += dt * 11;
        if (Math.random() < dt * 3) {
          this.particles.push(makeParticle(p.x, p.y + 10, 0, 0, 0.4, 'rgba(200,190,160,0.5)', 2));
        }
      }
      collideCircle(this.world, p, p.radius);
    } else if (p.car) {
      const car = p.car;
      const throttle = axis.y < 0 ? 1 : axis.y > 0 ? -1 : 0;
      driveCar(car, throttle, axis.x, dt);
      const hitWall = collideCircle(this.world, car, car.radius);
      if (hitWall && Math.abs(car.speed) > 220) {
        car.speed *= 0.45;
        this.camera.shake = Math.min(10, this.camera.shake + 5);
        this.spark(car.x, car.y, 10, '#ffb347');
      }
      if (Math.abs(car.speed) > 300 && Math.random() < dt * 8) {
        this.particles.push(makeParticle(
          car.x - Math.cos(car.angle) * 22, car.y - Math.sin(car.angle) * 22,
          (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40,
          0.5, 'rgba(190,180,160,0.6)', 3,
        ));
      }
      // Running over a pedestrian is a crime.
      for (const ped of this.peds) {
        if (ped.state !== 'down' && dist(car.x, car.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 60) {
          ped.state = 'down';
          ped.downTimer = 6;
          ped.hp = 0;
          this.spark(ped.x, ped.y, 12, '#ff453a');
          addWanted(this, 1, 'Kamu menabrak pejalan kaki!');
          this.camera.shake = 8;
        }
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
    }

    // Enter / exit cars.
    this.nearCar = null;
    if (p.onFoot) {
      let best = null;
      let bestD = 70;
      for (const car of this.cars) {
        if (car.driver === 'player') continue;
        const d = dist(p.x, p.y, car.x, car.y);
        if (d < bestD) { bestD = d; best = car; }
      }
      this.nearCar = best;
      if (best && input.anyPressed(['KeyE'])) this.enterCar(best, true);
    } else if (input.anyPressed(['KeyE'])) {
      this.exitCar();
    }

    // Shooting: held button fires repeatedly; a quick click still fires once
    // because the mousedown edge survives until the frame ends.
    if (p.onFoot && (input.mouseDown || input.mouseClicked) && p.fireCooldown <= 0 && this.reloadTimer <= 0) {
      if (p.ammo > 0) {
        const wx = input.mouseX + this.camera.x - VIEW_W / 2;
        const wy = input.mouseY + this.camera.y - VIEW_H / 2;
        fireBullet(this.bullets, 'player', p.x, p.y, angleTo(p.x, p.y, wx, wy));
        p.ammo--;
        p.fireCooldown = TUNING.pistolRefireSeconds;
        this.stats.shots++;
        this.gunshot();
        this.dangerUntil = this.time + 2;
        this.camera.shake = Math.min(6, this.camera.shake + 1.5);
        if (p.ammo === 0) this.reloadTimer = 0.8;
      } else {
        this.reloadTimer = 0.8;
      }
    }
    if (input.anyPressed(['KeyR']) && p.ammo < TUNING.pistolAmmo) {
      this.reloadTimer = 0.8;
    }

    // Bullets: the player's shots hit cops, pedestrians and cars.
    const targets = [
      ...this.cops,
      ...this.peds.filter((pd) => pd.state !== 'down'),
      ...this.cars.filter((c) => c.driver !== 'player'),
    ];
    updateBullets(this.world, this.bullets, targets, dt, (t, b) => {
      this.stats.hits++;
      t.hp -= b.damage;
      this.spark(b.x, b.y, 6, '#ffe14d');
      if (t.kind === 'cop' && t.hp <= 0) {
        this.cops = this.cops.filter((c) => c !== t);
        addWanted(this, 1, 'Kamu menembak polisi!');
      } else if (t.kind === 'ped' && t.hp <= 0) {
        t.state = 'down';
        t.downTimer = 8;
        addWanted(this, 1, 'Kamu menembak warga!');
      } else if (t.kind === 'car' && t.hp <= 0) {
        t.speed = 0;
        t.cruise = 0;
        if (t.driver === 'traffic') t.driver = 'parked';
        this.spark(t.x, t.y, 16, '#ff8a3d');
        if (t.driver === 'courier') this.courier = this.courier === t ? t : this.courier;
      }
    });
    // Cop bullets hit only the player.
    const playerTarget = { x: p.x, y: p.y, radius: 15, hp: 9999, kind: 'player' };
    updateBullets(this.world, this.bullets, [playerTarget], dt, (t, b) => {
      p.health -= b.damage;
      p.hurtFlash = 0.35;
      this.camera.shake = Math.min(8, this.camera.shake + 3);
      if (p.health <= 0) this.wasted();
    });

    // The city lives: traffic, pedestrians, police.
    updateTraffic(this.world, this.cars, this.cars, dt, this.rng);
    const danger = this.time < this.dangerUntil || (!p.onFoot && Math.abs(p.car.speed) > 200)
      ? this.playerPos() : null;
    updatePeds(this.world, this.peds, danger, dt, this.rng);

    // Wanted: police presence scales with the stars.
    const wantCars = Math.min(this.wanted, 4);
    const wantFoot = this.wanted >= 2 ? Math.min(this.wanted - 1, 4) : 0;
    const policeCars = this.cars.filter((c) => c.driver === 'police');
    const footCops = this.cops;
    while (policeCars.length < wantCars) {
      const car = this.spawnPoliceCarNear();
      policeCars.push(car);
    }
    while (footCops.length < wantFoot) this.spawnFootCopNear();
    if (this.wanted === 0) {
      for (const car of policeCars) car.driver = 'parked';
      this.cars = this.cars.filter((c) => c.driver !== 'police' || this.wanted > 0);
      this.cops = [];
    }
    const target = this.playerPos();
    for (const car of this.cars.filter((c) => c.driver === 'police')) {
      const d = updatePoliceCar(this.world, car, target, dt);
      if (d < 44) {
        if (!p.onFoot && p.car) {
          p.car.speed *= 0.86;
          this.camera.shake = Math.min(8, this.camera.shake + 2);
        } else if (p.onFoot) {
          p.health -= TUNING.copRamDamage * dt * 2;
          p.hurtFlash = 0.3;
          if (p.health <= 0) this.wasted();
        }
      }
    }
    for (const cop of [...this.cops]) {
      const d = updateFootCop(this.world, cop, p, dt);
      if (copShoot(cop, p, this.bullets, dt)) this.blip(220, 0.06, 'square', 0.05);
      if (p.onFoot && d < 36) {
        p.bustHold += dt;
        if (p.bustHold > TUNING.bustHoldSeconds) this.busted();
      } else {
        p.bustHold = Math.max(0, p.bustHold - dt * 2);
      }
    }

    // Wanted decays when no cop can see the player.
    if (this.wanted > 0) {
      const seen = this.cars.some((c) => c.driver === 'police' && dist(c.x, c.y, target.x, target.y) < 520) ||
        this.cops.some((c) => dist(c.x, c.y, target.x, target.y) < 520);
      if (seen) this.seenTimer = 0;
      else {
        this.seenTimer += dt;
        if (this.seenTimer > TUNING.wantedDecaySeconds) {
          this.wanted--;
          this.seenTimer = 0;
          this.flashMessage(this.wanted > 0 ? 'Polisi kehilangan jejakmu…' : 'Kamu lolos dari polisi.', 2);
        }
      }
    }

    // Pickups.
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      if (dist(p.x, p.y, pk.x, pk.y) < 30) {
        pk.taken = true;
        if (pk.type === 'health') p.health = Math.min(100, p.health + TUNING.healthPackHeal);
        if (pk.type === 'ammo') p.ammo = Math.min(TUNING.pistolAmmo, p.ammo + TUNING.ammoPackAmmo);
        if (pk.type === 'cash') this.cash += TUNING.cashPickup;
        this.blip(990, 0.1, 'sine', 0.1);
        this.spark(pk.x, pk.y, 10, '#7dd93d');
      }
    }

    // Missions.
    const result = this.missions.update(this, dt);
    if (result === 'done') {
      const reward = this.missions.reward();
      this.cash += reward;
      this.flashMessage(`Misi selesai! +$${reward}`, 3);
      this.blip(660, 0.15, 'sine', 0.12);
      this.blip(880, 0.2, 'sine', 0.12);
      if (this.missions.index >= 2) {
        this.cash += TUNING.winCashBonus;
        this.missions.done = true;
        this.missions.index = 3;
        this.persistSave();
        this.mode = 'win';
      } else {
        this.missions.loadMission(this, this.missions.index + 1);
        this.persistSave();
      }
    } else if (result === 'failed') {
      this.flashMessage('Kurir itu kabur… coba lagi.', 3);
      this.missions.loadMission(this, this.missions.index);
    }

    // Particles.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    // Camera follows the player.
    const pos = this.playerPos();
    const k = 1 - Math.exp(-6 * dt);
    this.camera.x = lerp(this.camera.x, pos.x, k);
    this.camera.y = lerp(this.camera.y, pos.y, k);
    this.camera.x = clamp(this.camera.x, VIEW_W / 2 - 200, WORLD_W - VIEW_W / 2 + 200);
    this.camera.y = clamp(this.camera.y, VIEW_H / 2 - 200, WORLD_H - VIEW_H / 2 + 200);
    this.camera.shake = Math.max(0, this.camera.shake - dt * 22);

    this.updateAudio(dt);
  }

  spark(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      this.particles.push(makeParticle(
        x, y,
        (Math.random() - 0.5) * 320, (Math.random() - 0.5) * 320,
        0.5, color, 3,
      ));
    }
  }

  enterCar(car, steal) {
    const p = this.player;
    if (steal && car.driver === 'traffic') {
      addWanted(this, 1, 'Mencuri mobil!');
      this.stats.carsStolen++;
    } else if (steal && car.driver === 'police') {
      addWanted(this, 1, 'Mencuri mobil polisi!');
      this.stats.carsStolen++;
    }
    car.driver = 'player';
    p.car = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    this.blip(330, 0.08, 'square', 0.08);
  }

  exitCar() {
    const p = this.player;
    const car = p.car;
    if (!car) return;
    car.driver = 'parked';
    car.speed = 0;
    p.car = null;
    p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    collideCircle(this.world, p, p.radius);
  }

  busted() {
    this.cash = Math.floor(this.cash * 0.85);
    this.persistSave();
    this.mode = 'busted';
    this.blip(180, 0.4, 'sawtooth', 0.12);
  }

  wasted() {
    this.player.health = 0;
    this.cash = Math.floor(this.cash * 0.9);
    this.persistSave();
    this.mode = 'wasted';
    this.blip(120, 0.5, 'sawtooth', 0.12);
  }
}

// ------------------------------------------------------------ boot

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__VICEBAY__ = game;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) applyShot(game, shot);
game.start();

export { game };
