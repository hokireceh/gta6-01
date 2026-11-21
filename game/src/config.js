// VICE BAY — config: world layout, palette, tuning. Written fresh for the rebuild.
export const WORLD = { w: 2600, h: 1800 };

// Road grid: avenues (vertical) and streets (horizontal). Road width in world units.
export const AVENUES = [200, 500, 800, 1100, 1400, 1700, 2000, 2300];
export const STREETS = [200, 500, 800, 1100, 1400, 1700];
export const ROAD_W = 72;

// Named places (mission targets). Points sit just off the road, inside a block edge.
export const ZONES = {
  spawn: { x: 500, y: 560, label: 'Start' },
  garage: { x: 560, y: 140, label: 'Garage' },
  package: { x: 2060, y: 440, label: 'Paket' },
  dropoff: { x: 860, y: 1460, label: 'Drop-off' },
  store: { x: 1460, y: 740, label: 'Toko' },
  safehouse: { x: 2240, y: 1460, label: 'Safehouse' },
  docks: { x: 2450, y: 450, label: 'Dermaga' },
  penthouse: { x: 140, y: 1640, label: 'Penthouse' },
};

// Sun-soaked modern city palette.
export const COLORS = {
  ground: '#79a05e',
  groundAlt: '#6f9455',
  road: '#33373d',
  roadEdge: '#454a51',
  dash: '#e8d44d',
  sidewalk: '#a8adb3',
  water: '#2e86ab',
  sand: '#e8d8a0',
  building: ['#e07856', '#f2b134', '#4ecdc4', '#ff6b9d', '#a78bfa', '#f4f1ea', '#5b8def', '#f08a24'],
  roofLine: 'rgba(0,0,0,0.25)',
  playerCar: '#e63946',
  goldCar: '#ffd700',
  policeCar: '#f5f5f5',
  policeTrim: '#1c2733',
  ped: ['#f4d35e', '#ee964b', '#8ecae6', '#ffb4a2', '#b5e48c', '#c77dff'],
  bullet: '#ffe66d',
  hudBg: 'rgba(10,14,20,0.62)',
  hudText: '#ffffff',
  hudAccent: '#ffd700',
  toastBg: 'rgba(10,14,20,0.78)',
};

export const TUNING = {
  walkSpeed: 175,
  sprintSpeed: 295,
  carAccel: 430,
  carBrake: 700,
  carMaxSpeed: 470,
  carReverseMax: 170,
  carSteer: 2.6,
  carFriction: 0.9, // per-second damping factor applied as speed *= exp(-friction*dt) when coasting
  trafficSpeed: 120,
  trafficSpeedMax: 170,
  pedSpeed: 55,
  pedFleeSpeed: 165,
  copCarSpeed: 430,
  copFootSpeed: 205,
  bulletSpeed: 920,
  bulletLife: 0.85,
  bulletDamage: 34,
  copBulletSpeed: 640,
  copBulletDamage: 8,
  copFireInterval: 0.95,
  playerHp: 100,
  hpRegen: 2.2, // per second, up to 50
  hpRegenCap: 50,
  carHp: 100,
  wantedDecayUnseen: 10, // seconds unseen before wanted drops by 1
  bustedHold: 1.1, // seconds a cop must touch the player to bust
  interactRadius: 78,
  missionRadius: 80,
  pickupRespawn: 20,
  explosionRadius: 130,
  explosionDamage: 55,
};
