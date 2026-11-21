// VICE BAY — boot, game loop, save/load, mode transitions.
// Written fresh for the rebuild.
import { createState, resetRun } from './state.js';
import { buildCity } from './world.js';
import {
  spawnWorld, updatePlayer, updateCars, updatePeds,
  updateBullets, updateParticles, updateWanted,
} from './entities.js';
import { startMission, updateMission, MISSIONS, refreshObjective } from './missions.js';
import { draw } from './render.js';
import { input } from './input.js';
import { setupShot } from './shots.js';
import { TUNING } from './config.js';

const SAVE_KEY = 'vicebay-save-v1';
const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const seed = seedParam ? (parseInt(seedParam, 10) >>> 0) : ((Date.now() ^ (Math.random() * 1e9)) | 0);
const shotName = params.get('shot');

const G = createState(seed);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
G.ctx = ctx;
G.view = { w: innerWidth, h: innerHeight };
G.showMinimap = true;
G.saveExists = !!localStorage.getItem(SAVE_KEY);
G.onMissionEvent = () => saveGame();
G.onWin = () => saveGame();
input.attach(canvas);

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  G.view.w = innerWidth;
  G.view.h = innerHeight;
}
addEventListener('resize', resize);
resize();

buildCity(G);
spawnWorld(G);
startMission(G, 0);
G.mode = 'menu';
if (shotName) {
  setupShot(G, shotName);
  G.shotMode = true;
}

// --- Save / load ------------------------------------------------------------
function saveGame() {
  if (G.shotMode) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: G.money,
      missionIndex: G.missionIndex,
      missionStep: G.missionStep,
      wanted: G.wanted,
      stats: G.stats,
      savedAt: Date.now(),
    }));
    G.saveExists = true;
  } catch {
    // Storage full or unavailable: play on without saving.
  }
}

function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { s = null; }
  if (!s) return;
  spawnWorld(G);
  G.money = s.money || 0;
  G.wanted = s.wanted || 0;
  G.lastSeenAt = G.time;
  G.stats = s.stats || G.stats;
  startMission(G, Math.min(s.missionIndex || 0, MISSIONS.length - 1));
  G.missionStep = s.missionStep || 0;
  refreshObjective(G);
  G.mode = 'playing';
}

function newGame() {
  resetRun(G);
  spawnWorld(G);
  startMission(G, 0);
  G.mode = 'playing';
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  G.saveExists = false;
}

function respawn() {
  const keepMoney = Math.max(0, G.money - 100);
  const keepMission = G.missionIndex;
  spawnWorld(G);
  G.money = keepMoney;
  G.wanted = 0;
  G.bustedTouch = 0;
  G.bullets = [];
  G.parts = [];
  G.footCops = [];
  startMission(G, keepMission);
  G.mode = 'playing';
}

function freeRoam() {
  G.mode = 'playing';
  G.missionIndex = MISSIONS.length;
  G.objective = { text: 'Free roam — nikmati kotanya!', x: 0, y: 0 };
}

// --- Buttons ----------------------------------------------------------------
function handleClick(x, y) {
  for (const b of G.ui.buttons || []) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      if (b.id === 'new') newGame();
      else if (b.id === 'continue') loadSave();
      else if (b.id === 'resume') G.mode = 'playing';
      else if (b.id === 'quit') { saveGame(); G.mode = 'menu'; }
      else if (b.id === 'roam') freeRoam();
      else if (b.id === 'menu') G.mode = 'menu';
      return;
    }
  }
}

// --- Main loop ---------------------------------------------------------------
let last = performance.now();
let prevPause = false;
let prevMinimap = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  G.mouseX = input.mouse.x;
  G.mouseY = input.mouse.y;

  const pausePressed = input.pause && !prevPause;
  prevPause = input.pause;
  if (pausePressed && G.mode === 'playing') G.mode = 'paused';
  else if (pausePressed && G.mode === 'paused') G.mode = 'playing';

  const minimapPressed = input.minimap && !prevMinimap;
  prevMinimap = input.minimap;
  if (minimapPressed) G.showMinimap = !G.showMinimap;

  const enterPressed = input.enterPressed;
  input.consumeEnter();
  if (enterPressed && G.mode === 'menu') newGame();
  else if (enterPressed && G.mode === 'busted') respawn();
  else if (enterPressed && G.mode === 'win') freeRoam();

  if (G.mode === 'playing') {
    updatePlayer(G, dt);
    updateCars(G, dt);
    updatePeds(G, dt);
    updateBullets(G, dt);
    updateParticles(G, dt);
    updateWanted(G, dt);
    updateMission(G, dt);
    if (G.bustedTouch >= TUNING.bustedTime) {
      G.mode = 'busted';
      G.bustedTouch = 0;
    }
    if (G.player.hp <= 0 && G.mode === 'playing') G.mode = 'busted';
  }

  if (G.mode !== 'playing' && input.mouse.clicked) {
    handleClick(input.mouse.clickX, input.mouse.clickY);
  }
  input.consumeClick();

  draw(G);
  requestAnimationFrame(frame);
}

window.__VICEBAY__ = { G, newGame, loadSave, saveGame, respawn, freeRoam, startMission, MISSIONS };
requestAnimationFrame(frame);
