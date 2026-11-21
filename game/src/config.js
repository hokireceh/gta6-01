// VICE BAY — every tunable number in one place: the city grid, the palette,
// the fixed landmarks, the driving/combat tuning and the mission script.
// Landmark coordinates and mission rewards are part of the game's contract
// (the automated checks drive to these exact spots), so they stay put while
// everything around them was rewritten.

export const WORLD_SIZE = 3600;
export const ROAD_COUNT = 8;
export const ROAD_SPACING = 450;
export const ROAD_WIDTH = 96;
export const FIRST_ROAD = 225;
export const VIEW_W = 1280;
export const VIEW_H = 900;
export const ZOOM = 0.9;
export const SAVE_KEY = "vicebay-save-v1";
export const CITY_SEED = 20261121;
export const SKYLINE_SEED = 7;

// Fixed points of interest (world coordinates). Never move these: the
// mission chain drives the player to each of them in turn.
export const LANDMARKS = {
  shop: { x: 1575, y: 675, r: 90, label: "TOKO" },
  delivery: { x: 2925, y: 675, r: 90, label: "PAKET" },
  penthouse: { x: 2925, y: 2925, r: 100, label: "PENTHOUSE" },
  hospital: { x: 675, y: 2925, r: 90, label: "RUMAH SAKIT" },
  goldCarSpot: { x: 3150, y: 2025 },
};

export const PALETTE = {
  ground: "#10141f",
  block: "#1a2133",
  sidewalk: "#2a3350",
  road: "#20283d",
  dash: "#7e8aa8",
  park: "#14301c",
  building: ["#46587e", "#5a4a7e", "#7e5a4a", "#3a6b57", "#6b3a57", "#525f82"],
  hero: "#ff6fb1",
  heroCar: "#ff3d9a",
  gold: "#ffd23d",
  policeCar: "#f0f0f0",
  ped: ["#e8c15a", "#5ad1e8", "#e85a7a", "#7ae85a", "#c98af0", "#e8e8e8"],
  traffic: ["#d05555", "#5580d0", "#d0aa55", "#8055d0", "#55d095", "#d0d0d0", "#949aa8"],
};

// Driving, combat and wanted tuning.
export const TUNING = {
  walkSpeed: 175,
  sprintSpeed: 300,
  carTopSpeed: 520,
  carReverseSpeed: -160,
  carAccel: 420,
  carBrake: 380,
  carDrag: 240,
  carSteer: 2.1,
  carSteerSpeed: 220,
  trafficSpeedMin: 60,
  trafficSpeedMax: 110,
  trafficSteer: 2.4,
  pedWalkMin: 25,
  pedWalkMax: 45,
  pedFleeSpeed: 130,
  pedFleeRadius: 160,
  policeTopSpeed: 430,
  policeAccel: 260,
  policeSteer: 2.8,
  policeSpawnDistance: 700,
  policeShootRange: 520,
  policeRamDamage: 4, // round 4: 4/s (was 12) — road-following police now sustain contact, so the old rate ground a car to death in ~3s; 4/s keeps rams dangerous without an instant explosion
  playerBulletSpeed: 950,
  playerBulletLife: 0.8,
  policeBulletSpeed: 780,
  policeBulletLife: 1.2, // round 4: 1.2s (was 0.9) so police fire stays visible mid-flight
  shootCooldown: 0.28,
  bulletDamage: 25,
  policeBulletDamage: 10,
  carBulletDamage: 8,
  wantedDecaySeconds: 8,
  wantedDecayRadius: 650,
  bustedFine: 100,
  robberySeconds: 3,
  getawaySeconds: 90,
  explosionRadius: 130,
  explosionCarDamage: 50,
  carWreckLifetime: 0.6,
  healthPickupAmount: 40,
  cashPickupAmount: 50,
  pedDownSeconds: 4,
};

// The five chained missions. Rewards are fixed ($150 / $300 / $500 / $900 /
// $1500 = $3,250 total); the wording was rewritten for this rebuild.
export const MISSION_DEFS = [
  {
    title: "Misi 1 — Cari Roda",
    text: "Bajak atau ambil mobil apa pun (tekan E saat dekat mobil).",
    reward: 150,
  },
  {
    title: "Misi 2 — Paket Kilat",
    text: "Antar paket ke penanda kuning di ujung timur kota.",
    reward: 300,
  },
  {
    title: "Misi 3 — Rampok Toko",
    text: "Masuk ke toko, tahan 3 detik sampai rampok selesai, lalu kabur sampai wanted hilang.",
    reward: 500,
  },
  {
    title: "Misi 4 — Pelarian 90 Detik",
    text: "Bertahan 90 detik di wanted 3. Jangan ketangkap!",
    reward: 900,
  },
  {
    title: "Misi 5 — Mobil Emas",
    text: "Curi mobil emas di timur, bawa ke penthouse.",
    reward: 1500,
  },
];
