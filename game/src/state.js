// VICE BAY — shared mutable game state. Every module imports this one object.
// main.js initialises it; other modules read and mutate it.
import { makeRng } from './random.js';

export const G = {
  time: 0,
  mode: 'menu', // 'menu' | 'playing' | 'paused' | 'busted' | 'win'
  seed: 1,
  rng: null, // set by main.js (makeRng)
  money: 0,
  missionIndex: 0,
  missionStep: 0,
  missionState: {}, // per-mission runtime (timers, flags)
  player: null, // { x, y, angle, hp, onFoot, car, speed, aimX, aimY, fireCd }
  cars: [], // traffic + parked + police cars + gold car
  peds: [],
  footCops: [],
  bullets: [], // { x, y, vx, vy, life, damage, fromCop }
  parts: [], // particles { x, y, vx, vy, life, maxLife, color, size }
  pickups: [], // health { x, y, taken, respawnAt }
  wanted: 0,
  lastSeenAt: -999, // last time any cop was near the player
  bustedTouch: 0, // seconds a cop has touched the player continuously
  cam: { x: 0, y: 0, zoom: 1 },
  toast: { text: '', until: 0 },
  objective: { text: '', x: 0, y: 0 },
  roads: [],
  buildings: [],
  zones: {},
  shotMode: '', // set by shots.js when a ?shot= scene is active
  saveExists: false,
  stats: { shotsFired: 0, carsStolen: 0, pedsHit: 0 },
  muted: false,
};

export function createState(seed) {
  G.seed = seed >>> 0;
  G.rng = makeRng(G.seed);
  return G;
}

export function resetRun() {
  G.time = 0;
  G.money = 0;
  G.missionIndex = 0;
  G.missionStep = 0;
  G.missionState = {};
  G.cars = [];
  G.peds = [];
  G.footCops = [];
  G.bullets = [];
  G.parts = [];
  G.pickups = [];
  G.wanted = 0;
  G.lastSeenAt = -999;
  G.bustedTouch = 0;
  G.toast = { text: '', until: 0 };
  G.objective = { text: '', x: 0, y: 0 };
  G.shotMode = '';
  G.stats = { shotsFired: 0, carsStolen: 0, pedsHit: 0 };
}
