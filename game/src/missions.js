// Vice Bay — the three-job story: objectives, progress and rewards.

import { MISSION_NAMES, TUNING } from './config.js';
import { dist } from './math.js';
import { makePickup } from './entities.js';

function corner(world, avenueIdx, streetIdx) {
  return { x: world.avenues[avenueIdx], y: world.streets[streetIdx] };
}

export class MissionManager {
  constructor(world) {
    this.world = world;
    this.index = 0;
    this.step = 0;
    this.steps = [];
    this.chaseHold = 0;
    this.done = false;
  }

  get name() {
    return MISSION_NAMES[this.index] || 'Bebas';
  }

  /** Build the step list for mission `index` inside `game`. */
  loadMission(game, index) {
    this.index = index;
    this.step = 0;
    this.chaseHold = 0;
    this.done = false;
    const w = this.world;
    const depot = { x: w.depot.x, y: w.depot.y };
    if (index === 0) {
      this.steps = [
        { type: 'goto', label: 'Ambil paket 1/3 di persimpangan barat', pos: corner(w, 2, 1), radius: 70 },
        { type: 'goto', label: 'Ambil paket 2/3 di persimpangan tengah', pos: corner(w, 5, 4), radius: 70 },
        { type: 'goto', label: 'Ambil paket 3/3 di persimpangan selatan', pos: corner(w, 1, 5), radius: 70 },
        { type: 'goto', label: 'Antar semua paket ke depot Marisol', pos: depot, radius: 80 },
      ];
    } else if (index === 1) {
      const courier = game.spawnCourier();
      this.steps = [
        { type: 'chase', label: 'Kejar kurir itu — tempel mobilnya 3 detik!', pos: { x: courier.x, y: courier.y }, radius: 110 },
        { type: 'goto', label: 'Ambil tas kurir yang jatuh', pos: { x: courier.x, y: courier.y }, radius: 70 },
        { type: 'goto', label: 'Bawa tasnya ke depot Marisol', pos: depot, radius: 80 },
      ];
    } else if (index === 2) {
      game.setWanted(3, 'Razia besar-besaran! Kabur!');
      this.steps = [
        { type: 'goto', label: 'Kabur ke tempat persembunyian di timur laut!', pos: { x: w.hideout.x, y: w.hideout.y }, radius: 90 },
      ];
    } else {
      this.steps = [];
      this.done = true;
    }
  }

  current() {
    if (this.done || this.index > 2) return null;
    return this.steps[this.step] || null;
  }

  objectiveLabel() {
    const s = this.current();
    if (!s) return this.done ? 'Semua pekerjaan selesai.' : 'Jelajahi Vice Bay sesukamu.';
    return `Misi ${this.index + 1}/3 — ${this.name}: ${s.label}`;
  }

  /**
   * Advance the mission. Returns 'done' when the mission finished,
   * 'failed' when the chase target escaped too far, else null.
   */
  update(game, dt) {
    const s = this.current();
    if (!s) return null;
    const p = game.playerPos();
    if (s.type === 'goto') {
      if (dist(p.x, p.y, s.pos.x, s.pos.y) < s.radius) {
        this.step++;
        game.onObjectiveReached(s);
        if (this.step >= this.steps.length) return 'done';
      }
      return null;
    }
    if (s.type === 'chase') {
      const c = game.courier;
      if (!c) return null;
      s.pos.x = c.x;
      s.pos.y = c.y;
      const d = dist(p.x, p.y, c.x, c.y);
      if (d < s.radius) {
        this.chaseHold += dt;
        if (this.chaseHold >= 3) {
          // The courier gives up: the car stops and the bag drops.
          c.driver = 'parked';
          c.speed = 0;
          c.cruise = 0;
          game.pickups.push(makePickup(c.x + 30, c.y, 'cash'));
          game.flashMessage('Kurir menyerah! Ambil tasnya.', 2.5);
          this.step++;
        }
      } else {
        this.chaseHold = Math.max(0, this.chaseHold - dt * 0.5);
        if (d > 1600) return 'failed';
      }
      return null;
    }
    return null;
  }

  /** Cash reward for the mission that just finished. */
  reward() {
    return TUNING.missionReward[this.index] || 0;
  }
}
