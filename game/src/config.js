// Vice Bay — tuning, palette and key bindings.
// One job: every number the rest of the game reads, in one place.

export const VIEW_W = 1280;
export const VIEW_H = 720;

export const WORLD_W = 3600;
export const WORLD_H = 2600;

// The bay eats the south-east corner of the map; the beach runs along it.
export const BAY_X = 2960;
export const BAY_Y = 1960;

export const SAVE_KEY = 'vicebay-save-v1';

export const PALETTE = {
  grass: '#5d9b4a',
  grassDark: '#4c8440',
  sand: '#e3cd8d',
  water: '#2a7fa8',
  waterDeep: '#1d5f86',
  road: '#3a3a40',
  roadLine: '#e8d44d',
  sidewalk: '#9a9a92',
  buildingRoof: '#b0563a',
  buildingRoof2: '#7d8aa0',
  buildingRoof3: '#c2a15a',
  buildingWall: '#8a6f5c',
  park: '#3f7d33',
  tree: '#2e6b26',
  treeLight: '#4c9a3d',
  player: '#ffcf3f',
  police: '#2b4fd8',
  policeLight: '#ff3b30',
  pedShirt: '#e86a92',
  hud: '#101418',
  hudAccent: '#ffd23f',
  danger: '#ff453a',
  ok: '#34c759',
  marker: '#ffd23f',
};

export const TUNING = {
  // On foot.
  walkSpeed: 185,
  sprintSpeed: 285,
  playerRadius: 15,
  playerHealth: 100,
  // Driving.
  carAccel: 520,
  carBrake: 900,
  carMaxSpeed: 460,
  carReverseMax: 150,
  carTurn: 2.6,
  carRadius: 20,
  // Police.
  copCarSpeed: 430,
  copFootSpeed: 205,
  copRamDamage: 6,
  bustHoldSeconds: 1.4,
  // Wanted.
  wantedDecaySeconds: 14,
  wantedMax: 5,
  // Combat.
  bulletSpeed: 780,
  bulletDamage: 34,
  bulletRange: 620,
  pistolAmmo: 30,
  pistolRefireSeconds: 0.22,
  copShotDamage: 5,
  copShotInterval: 0.9,
  // Traffic and crowd.
  trafficCars: 16,
  pedestrians: 26,
  policeCarsMax: 6,
  // Pickups.
  healthPackHeal: 40,
  ammoPackAmmo: 30,
  cashPickup: 50,
  // Missions.
  missionReward: [400, 700, 1200],
  winCashBonus: 500,
};

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
  shoot: ['MouseLeft'],
  reload: ['KeyR'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  start: ['Enter', 'Space'],
};

export const MISSION_NAMES = [
  'Pesanan Pertama',
  'Kejar Kurir',
  'Kabur dari Razia',
];

export const STORY_INTRO =
  'Vice Bay, Leonida. Kamu baru sampai di kota ini dengan satu tas, ' +
  'satu pistol, dan utang yang harus dibayar. Selesaikan tiga pekerjaan ' +
  'untuk bosmu, Marisol, dan kota ini jadi milikmu.';
