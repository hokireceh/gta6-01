// Vice Bay — boot: the game itself. It builds the city, owns the loop, reads
// the keyboard and mouse, and coordinates every module. One Game instance;
// window.__VICEBAY__ exposes it for the maker's own play-tests.
//
// States: title → play → paused → play; play → busted | wasted → play;
// play → win → play (free roam). The story drives the missions; the wanted
// system drives the police; the clock drives the sky.

import { buildBayCity, drawCity } from './baycity.js';
import { SkyClock } from './clock.js';
import { drawVehicle, makeTraffic, makeVehicle, stepTraffic, stepVehicle } from './drive.js';
import { makeWalker, stepWalker, drawWalker } from './walker.js';
import { Wanted, drawFootCop, maintainPolice, makeFootCop, makePoliceCar, stepFootCops, stepPoliceCars } from './cops.js';
import { Story } from './story.js';
import { drawBullets, drawPickups, makeArsenal, makePickups, startReload, stepArsenal, stepBullets, stepPickups, tryFire } from './fight.js';
import { drawPedestrian, makeParkedCars, makePedestrians, stepPedestrians } from './crowd.js';
import { drawCaught, drawHud, drawMarkerArrow, drawMinimap, drawPause, drawTitle, drawWin, drawWorldMarker } from './interface.js';
import { SoundBank } from './sound.js';
import { applyShotPreset, shotFromUrl } from './presets.js';
import { loadSave, storeSave } from './save.js';
import { clamp, dist, lerp, makeRng } from './tools.js';

const VIEW_W = 1280;
const VIEW_H = 720;

export class Game {
  constructor(canvas, seed) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.seed = seed;
    this.rng = makeRng(seed);
    this.city = buildBayCity(seed);
    this.clock = new SkyClock(seed);
    this.story = new Story(this.city);
    this.wanted = new Wanted();
    this.arsenal = makeArsenal();
    this.player = makeWalker(this.city.spawn.x, this.city.spawn.y);
    this.car = null;
    this.inCar = false;
    this.traffic = makeTraffic(this.city, this.rng, 14);
    this.parked = makeParkedCars(this.city, this.rng, 10);
    this.peds = makePedestrians(this.city, this.rng, 22);
    this.cops = [];
    this.cruisers = [];
    this.bullets = [];
    this.pickups = makePickups(this.city, this.rng, 16);
    this.sparks = [];
    this.sound = new SoundBank();
    this.cash = 150;
    this.bestCash = 150;
    this.state = 'title';
    this.time = 0;
    this.cam = { x: 0, y: 0 };
    this.shake = 0; // camera shake magnitude, decays every frame
    this.banner = '';
    this.bannerTimer = 0;
    this.keys = new Set();
    this.mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false };
    this.interactPressed = false;
    this.lastShot = null;
    this.save = loadSave();
    this.hasSave = !!this.save;
    this.playSeconds = 0;
    this.bindInput();
  }

  // ------------------------------------------------------------ input

  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.sound.ensure();
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.onInteractKey();
      if (e.code === 'KeyR') this.onReloadKey();
      if (e.code === 'KeyM') this.sound.setMuted(!this.sound.muted);
      if (e.code === 'Escape') this.onEscapeKey();
      if (e.code === 'Enter') this.onEnterKey();
      if (e.code === 'KeyC') this.onContinueKey();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - rect.left) * (VIEW_W / rect.width);
      this.mouse.y = (e.clientY - rect.top) * (VIEW_H / rect.height);
    });
    this.canvas.addEventListener('mousedown', (e) => {
      this.sound.ensure();
      if (e.button === 0) {
        this.mouse.down = true;
        if (this.state === 'title') this.startGame(true);
      }
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
  }

  onEnterKey() {
    if (this.state === 'title') this.startGame(true);
    else if (this.state === 'win') { this.state = 'play'; }
  }

  onContinueKey() {
    if (this.state !== 'title' || !this.save) return;
    this.cash = this.save.cash;
    this.bestCash = Math.max(this.bestCash, this.save.bestCash);
    this.startGame(false);
    this.story.index = clamp(this.save.mission, 0, 3);
    this.story.finished = false;
    this.story.start(this.storyCtx());
  }

  onEscapeKey() {
    if (this.state === 'play') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'play';
  }

  onReloadKey() {
    if (this.state === 'busted' || this.state === 'wasted') { this.respawn(); return; }
    if (this.state === 'paused') { this.restartMission(); return; }
    if (this.state === 'play') startReload(this.arsenal);
  }

  onInteractKey() {
    if (this.state !== 'play') return;
    this.interactPressed = true;
    if (this.inCar) this.exitCar();
    else this.tryEnterCar();
  }

  // ------------------------------------------------------------ flow

  startGame(fresh) {
    this.state = 'play';
    this.time = 0;
    this.playSeconds = 0;
    if (fresh) {
      this.cash = 150;
      this.story = new Story(this.city);
      this.wanted = new Wanted();
      this.arsenal = makeArsenal();
      this.player = makeWalker(this.city.spawn.x, this.city.spawn.y);
      this.car = null;
      this.inCar = false;
      this.cops = [];
      this.cruisers = [];
      this.bullets = [];
    }
    this.story.start(this.storyCtx());
    this.setBanner('Welcome to Vice Bay. Sable is waiting.', 5);
  }

  restartMission() {
    this.story.start(this.storyCtx());
    this.state = 'play';
  }

  respawn() {
    this.cash = Math.max(0, this.cash - 200);
    this.arsenal.health = this.arsenal.maxHealth;
    this.arsenal.ammo = this.arsenal.magSize;
    this.wanted = new Wanted();
    this.cops = [];
    this.cruisers = [];
    this.bullets = [];
    if (this.inCar) {
      this.parked.push(this.car);
      this.car.driver = null;
      this.car.parked = true;
      this.car = null;
      this.inCar = false;
    }
    this.player.x = this.city.spawn.x;
    this.player.y = this.city.spawn.y;
    this.story.start(this.storyCtx());
    this.state = 'play';
    this.setBanner('Back on the street. The jobs wait.', 5);
    this.persist();
  }

  winGame() {
    this.state = 'win';
    this.bestCash = Math.max(this.bestCash, this.cash);
    this.sound.jingle();
    this.persist();
  }

  persist() {
    storeSave({ cash: this.cash, mission: this.story.index, bestCash: this.bestCash });
  }

  setBanner(text, secs) {
    this.banner = text;
    this.bannerTimer = secs;
  }

  addCash(n) {
    this.cash += n;
    this.bestCash = Math.max(this.bestCash, this.cash);
  }

  storyCtx() {
    return {
      px: this.px,
      py: this.py,
      inCar: this.inCar,
      interact: this.interactPressed,
      wanted: this.wanted,
      addCash: (n) => this.addCash(n),
      banner: (t, s) => this.setBanner(t, s),
      onMissionDone: () => { this.sound.jingle(); this.persist(); },
      onWin: () => this.winGame(),
    };
  }

  get px() { return this.inCar && this.car ? this.car.x : this.player.x; }
  get py() { return this.inCar && this.car ? this.car.y : this.player.y; }

  // ------------------------------------------------------------ cars

  nearestEnterableCar() {
    const px = this.player.x;
    const py = this.player.y;
    let best = null;
    let bestD = 78;
    const consider = (car) => {
      const d = dist(px, py, car.x, car.y);
      if (d < bestD && Math.abs(car.speed || 0) < 60) { bestD = d; best = car; }
    };
    for (const car of this.parked) consider(car);
    for (const car of this.traffic) consider(car);
    return best;
  }

  tryEnterCar() {
    const car = this.nearestEnterableCar();
    if (!car) return;
    if (car.driver === 'traffic') {
      this.traffic = this.traffic.filter((c) => c !== car);
      this.wanted.addHeat(6);
    } else {
      this.parked = this.parked.filter((c) => c !== car);
    }
    car.driver = 'player';
    car.parked = false;
    this.car = car;
    this.inCar = true;
    this.sound.pickup();
  }

  exitCar() {
    if (!this.car) return;
    const a = this.car.angle + Math.PI / 2;
    this.player.x = this.car.x + Math.cos(a) * 44;
    this.player.y = this.car.y + Math.sin(a) * 44;
    this.player.angle = this.car.angle;
    this.car.driver = null;
    this.car.parked = true;
    this.car.speed = 0;
    this.parked.push(this.car);
    this.car = null;
    this.inCar = false;
  }

  spawnCop(x, y) {
    const cop = makeFootCop(x, y);
    this.cops.push(cop);
    return cop;
  }

  spawnCruiser(x, y) {
    const car = makePoliceCar(x, y, Math.atan2(this.py - y, this.px - x));
    this.cruisers.push(car);
    return car;
  }

  /** Extra traffic around the player (used by the cover preset). */
  spawnStreetTraffic() {
    for (let i = 0; i < 5; i++) {
      const a = this.rng() * Math.PI * 2;
      const x = clamp(this.px + Math.cos(a) * (220 + this.rng() * 300), 80, this.city.w - 80);
      const y = clamp(this.py + Math.sin(a) * (220 + this.rng() * 300), 80, this.city.h - 80);
      const car = makeVehicle('sedan', x, y, this.rng() * Math.PI * 2);
      car.driver = 'traffic';
      car.cruise = 150;
      car.speed = 150;
      car.lane = { vertical: true, fixed: x, dir: 1 };
      this.traffic.push(car);
    }
  }

  // ------------------------------------------------------------ combat

  damagePlayer(n, cause) {
    if (this.state !== 'play') return;
    this.arsenal.health -= n;
    this.shake = 9;
    this.sound.punch();
    if (this.arsenal.health <= 0) {
      this.arsenal.health = 0;
      this.state = cause === 'crash' ? 'wasted' : 'busted';
      this.sound.setEngine(false, 0);
      this.sound.setSiren(false);
      this.persist();
    }
  }

  addSpark(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 120 + Math.random() * 220;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35, color });
    }
  }

  // ------------------------------------------------------------ loop

  inputState() {
    const k = this.keys;
    return {
      up: k.has('KeyW') || k.has('ArrowUp'),
      down: k.has('KeyS') || k.has('ArrowDown'),
      left: k.has('KeyA') || k.has('ArrowLeft'),
      right: k.has('KeyD') || k.has('ArrowRight'),
      sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      aimX: this.mouse.x + this.cam.x,
      aimY: this.mouse.y + this.cam.y,
    };
  }

  tick(dt) {
    this.time += dt;
    this.clock.tick(dt);
    this.sound.tick(dt);
    if (this.bannerTimer > 0) this.bannerTimer -= dt;
    if (this.state !== 'play') {
      if (this.state === 'title') {
        // Slow orbit over downtown behind the title.
        const a = this.time * 0.045;
        this.cam.x = clamp(1600 + Math.cos(a) * 320 - VIEW_W / 2, 0, this.city.w - VIEW_W);
        this.cam.y = clamp(1200 + Math.sin(a) * 220 - VIEW_H / 2, 0, this.city.h - VIEW_H);
      }
      return;
    }
    this.playSeconds += dt;
    const input = this.inputState();
    const grip = this.clock.grip();

    // Player: drive or walk.
    if (this.inCar && this.car) {
      stepVehicle(this.car, input, dt, this.city, grip);
      this.player.x = this.car.x;
      this.player.y = this.car.y;
      this.player.angle = this.car.angle;
      if (this.car.crashHit) {
        this.car.crashHit = false;
        this.damagePlayer(10, 'crash');
        this.addSpark(this.car.x, this.car.y, '#ff9a3d');
      }
      this.sound.setEngine(true, Math.abs(this.car.speed) / this.car.topSpeed);
    } else {
      stepWalker(this.player, input, dt, this.city);
      this.sound.setEngine(false, 0);
    }

    // Shooting (on foot or drive-by).
    if (this.mouse.down) {
      const aim = Math.atan2(input.aimY - this.py, input.aimX - this.px);
      const b = tryFire(this.arsenal, this.px, this.py, aim);
      if (b) {
        this.bullets.push(b);
        this.sound.shot();
        this.lastShot = { x: this.px, y: this.py };
        this.wanted.addHeat(2);
      } else if (this.arsenal.ammo === 0) {
        startReload(this.arsenal);
      }
    }
    stepArsenal(this.arsenal, dt);

    // World life.
    stepTraffic(this.traffic, dt, this.city);
    stepPedestrians(this.peds, dt, this.city, this.lastShot);
    stepBullets(this.bullets, [...this.cops, ...this.peds], dt, this.city, (target, dmg) => {
      this.addSpark(target.x, target.y, '#ffe27a');
      if (target.hp <= 0) {
        if (target.state !== undefined) {
          // A pedestrian went down.
          target.down = 12;
          target.hp = 100;
          this.wanted.addHeat(8);
        } else {
          // A cop went down.
          target.down = 20;
          target.hp = 100;
          this.wanted.addHeat(20);
          this.addCash(50);
        }
      }
    });
    stepPickups(this.pickups, this.px, this.py, dt, this.city, this.rng, (kind, value) => {
      this.sound.pickup();
      if (kind === 'medkit') this.arsenal.health = Math.min(this.arsenal.maxHealth, this.arsenal.health + 40);
      else if (kind === 'ammo') this.arsenal.reserve += 60;
      else this.addCash(value);
    });

    // Police.
    maintainPolice({
      wanted: this.wanted, cops: this.cops, cruisers: this.cruisers,
      playerPos: { x: this.px, y: this.py }, city: this.city, rng: this.rng,
    });
    stepFootCops(this.cops, { x: this.px, y: this.py }, dt, this.city, (dmg) => this.damagePlayer(dmg, 'cop'));
    stepPoliceCars(this.cruisers, { x: this.px, y: this.py }, this.inCar, dt, this.city, grip, (dmg) => this.damagePlayer(dmg, 'cop'));
    let nearestOfficer = Infinity;
    for (const c of this.cops) nearestOfficer = Math.min(nearestOfficer, dist(c.x, c.y, this.px, this.py));
    for (const c of this.cruisers) nearestOfficer = Math.min(nearestOfficer, dist(c.x, c.y, this.px, this.py));
    this.wanted.decay(dt, nearestOfficer, 520);
    this.sound.setSiren(this.cruisers.length > 0 && this.wanted.stars > 0);

    // Story.
    this.story.update(this.storyCtx());
    this.interactPressed = false;

    // Sparks.
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }

    // Camera follows the player.
    const tx = clamp(this.px - VIEW_W / 2, 0, this.city.w - VIEW_W);
    const ty = clamp(this.py - VIEW_H / 2, 0, this.city.h - VIEW_H);
    this.cam.x = lerp(this.cam.x, tx, clamp(6 * dt, 0, 1));
    this.cam.y = lerp(this.cam.y, ty, clamp(6 * dt, 0, 1));
    this.shake = Math.max(0, this.shake - dt * 26);
  }

  // ------------------------------------------------------------ render

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    const shx = this.shake > 0 ? (Math.random() * 2 - 1) * this.shake : 0;
    const shy = this.shake > 0 ? (Math.random() * 2 - 1) * this.shake : 0;
    ctx.translate(-Math.round(this.cam.x) + shx, -Math.round(this.cam.y) + shy);
    drawCity(ctx, this.city, this.time);
    drawWorldMarker(ctx, this.story.marker, this.time);
    drawPickups(ctx, this.pickups, this.time);
    for (const car of this.parked) drawVehicle(ctx, car);
    for (const car of this.traffic) drawVehicle(ctx, car);
    for (const p of this.peds) drawPedestrian(ctx, p);
    for (const c of this.cops) drawFootCop(ctx, c);
    for (const car of this.cruisers) drawVehicle(ctx, car);
    if (this.inCar && this.car) drawVehicle(ctx, this.car);
    else drawWalker(ctx, this.player, this.arsenal.ammo > 0);
    drawBullets(ctx, this.bullets);
    // Sparks.
    ctx.save();
    for (const s of this.sparks) {
      ctx.globalAlpha = clamp(s.life / 0.35, 0, 1);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();

    // Sky tint + weather.
    const tint = this.clock.skyTint();
    ctx.save();
    ctx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${tint.a})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.clock.drawRain(ctx, VIEW_W, VIEW_H);
    ctx.restore();

    // Screens and HUD.
    if (this.state === 'title') {
      drawTitle(ctx, { hasSave: this.hasSave });
    } else if (this.state === 'paused') {
      drawHud(ctx, this.hudState());
      drawPause(ctx);
    } else if (this.state === 'busted' || this.state === 'wasted') {
      drawHud(ctx, this.hudState());
      drawCaught(ctx, this.state, this.cash);
    } else if (this.state === 'win') {
      drawHud(ctx, this.hudState());
      const mm = Math.floor(this.playSeconds / 60);
      const ss = String(Math.floor(this.playSeconds % 60)).padStart(2, '0');
      drawWin(ctx, { cash: this.cash, jobs: 4, time: `${mm}:${ss}` });
    } else {
      drawHud(ctx, this.hudState());
      drawMinimap(ctx, this.hudState());
      drawMarkerArrow(ctx, this.cam, this.story.marker, this.px, this.py);
    }
  }

  hudState() {
    return {
      cash: this.cash,
      arsenal: this.arsenal,
      wanted: this.wanted,
      clock: this.clock,
      story: this.story,
      inCar: this.inCar,
      car: this.car,
      banner: this.banner,
      bannerTimer: this.bannerTimer,
      city: this.city,
      cops: this.cops,
      cruisers: this.cruisers,
      px: this.px,
      py: this.py,
    };
  }

  /** A small JSON snapshot for the maker's play-tests. */
  debugState() {
    return {
      state: this.state,
      cash: this.cash,
      stars: this.wanted.stars,
      heat: Math.round(this.wanted.heat),
      mission: this.story.finished ? 'done' : this.story.current().id,
      stage: this.story.stage,
      px: Math.round(this.px),
      py: Math.round(this.py),
      inCar: this.inCar,
      health: Math.round(this.arsenal.health),
      ammo: this.arsenal.ammo,
      cops: this.cops.length,
      cruisers: this.cruisers.length,
      traffic: this.traffic.length,
      weather: this.clock.weather,
      minutes: Math.round(this.clock.minutes),
    };
  }
}

// ------------------------------------------------------------ entry

const canvas = document.getElementById('game');
const { shot, seed } = shotFromUrl();
const game = new Game(canvas, seed);
applyShotPreset(game, shot);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.tick(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__VICEBAY__ = { game, version: '1.3.0' };
