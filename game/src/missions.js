// VICE BAY — mission chain: 5 story missions, each a list of steps.
// Written fresh for the rebuild.
import { ZONES, TUNING } from './config.js';
import { dist } from './random.js';
import { input } from './input.js';
import { addWanted, toast } from './entities.js';

let prevInteract = false;

export const MISSIONS = [
  {
    name: 'Roda Pertama',
    payout: 200,
    steps: [
      { kind: 'getCar', text: 'Curi sebuah mobil (E di dekat mobil)' },
      { kind: 'goto', x: ZONES.garage.x, y: ZONES.garage.y, text: 'Antar mobil ke Garage' },
    ],
  },
  {
    name: 'Paket Panas',
    payout: 350,
    steps: [
      { kind: 'goto', x: ZONES.package.x, y: ZONES.package.y, text: 'Pergi ke titik paket' },
      { kind: 'pressE', x: ZONES.package.x, y: ZONES.package.y, text: 'Tekan E untuk mengambil paket' },
      { kind: 'goto', x: ZONES.dropoff.x, y: ZONES.dropoff.y, text: 'Antar paket ke Drop-off' },
    ],
  },
  {
    name: 'Panas Dingin',
    payout: 300,
    steps: [
      { kind: 'goto', x: ZONES.store.x, y: ZONES.store.y, text: 'Pergi ke toko' },
      { kind: 'pressE', x: ZONES.store.x, y: ZONES.store.y, text: 'Tekan E untuk merampok toko', onDone: (G) => {
        G.money += 400;
        addWanted(G, 2);
        toast(G, 'Rampok berhasil +$400! Wanted 2 — kabur!');
      } },
      { kind: 'loseWanted', text: 'Hilangkan wanted (sembunyi sampai polisi pergi)' },
    ],
  },
  {
    name: 'Kabur dari Bay',
    payout: 600,
    steps: [
      { kind: 'getCar', text: 'Masuk ke mobil, cepat!' },
      { kind: 'timed', x: ZONES.safehouse.x, y: ZONES.safehouse.y, seconds: 90, text: 'Kabur ke Safehouse sebelum waktu habis!' },
    ],
    onStart: (G) => {
      addWanted(G, 3);
      toast(G, 'Wanted 3! Polisi mengejarmu — kabur ke Safehouse!');
    },
  },
  {
    name: 'Raja Teluk',
    payout: 1500,
    steps: [
      { kind: 'goto', x: ZONES.docks.x, y: ZONES.docks.y, text: 'Pergi ke dermaga' },
      { kind: 'getGoldCar', text: 'Curi mobil emas (E di dekat mobil emas)' },
      { kind: 'goto', x: ZONES.penthouse.x, y: ZONES.penthouse.y, text: 'Antar mobil emas ke Penthouse' },
    ],
  },
];

export function startMission(G, index) {
  G.missionIndex = index;
  G.missionStep = 0;
  G.missionState = { timeLeft: 0 };
  const m = MISSIONS[index];
  if (!m) return;
  if (m.onStart) m.onStart(G);
  refreshObjective(G);
}

export function refreshObjective(G) {
  const m = MISSIONS[G.missionIndex];
  if (!m) {
    G.objective = { text: 'Free roam — nikmati kotanya!', x: 0, y: 0 };
    return;
  }
  const step = m.steps[G.missionStep];
  if (!step) {
    G.objective = { text: m.name, x: 0, y: 0 };
    return;
  }
  G.objective = {
    text: `${m.name}: ${step.text}`,
    x: step.x || 0,
    y: step.y || 0,
  };
}

function stepDone(G, step) {
  const p = G.player;
  switch (step.kind) {
    case 'getCar':
      return !p.onFoot && !!p.car;
    case 'getGoldCar':
      return !p.onFoot && !!p.car && !!p.car.gold;
    case 'goto':
      return dist(p.x, p.y, step.x, step.y) < TUNING.missionRadius;
    case 'pressE': {
      const pressed = input.interact && !prevInteract;
      return dist(p.x, p.y, step.x, step.y) < TUNING.interactRadius && pressed;
    }
    case 'loseWanted':
      return G.wanted === 0;
    case 'timed':
      if (G.missionState.timeLeft === 0) G.missionState.timeLeft = step.seconds;
      return dist(p.x, p.y, step.x, step.y) < TUNING.missionRadius;
    default:
      return false;
  }
}

export function updateMission(G, dt) {
  const m = MISSIONS[G.missionIndex];
  if (!m) return;
  const step = m.steps[G.missionStep];
  if (!step) return;
  const pressed = input.interact;
  const done = stepDone(G, step);
  prevInteract = pressed;
  if (step.kind === 'timed') {
    G.missionState.timeLeft -= dt;
    if (G.missionState.timeLeft <= 0) {
      // Out of time: restart this mission.
      toast(G, 'Waktu habis! Misi diulang dari awal.');
      startMission(G, G.missionIndex);
      return;
    }
    G.objective.text = `${m.name}: ${step.text} (${Math.ceil(G.missionState.timeLeft)} dtk)`;
  }
  if (!done) return;
  if (step.onDone) step.onDone(G);
  G.missionStep++;
  if (G.missionStep >= m.steps.length) {
    // Mission complete.
    G.money += m.payout;
    toast(G, `Misi selesai: ${m.name} +$${m.payout}!`);
    if (G.missionIndex + 1 >= MISSIONS.length) {
      G.mode = 'win';
      if (typeof G.onWin === 'function') G.onWin();
    } else {
      startMission(G, G.missionIndex + 1);
    }
  } else {
    refreshObjective(G);
  }
  if (typeof G.onMissionEvent === 'function') G.onMissionEvent();
}
