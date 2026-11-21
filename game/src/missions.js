// VICE BAY — the mission chain: five jobs that must be finished in order,
// plus the save/continue persistence. The mission table is built from the
// definitions in config.js; each entry gains a target (where the yellow
// marker points) and a completion test.

import { LANDMARKS, MISSION_DEFS, SAVE_KEY, TUNING } from "./config.js";
import { distance } from "./math.js";
import { flash } from "./combat.js";

export { flash };

function nearestCarSpot(g) {
  let best = null;
  let bestDist = Infinity;
  for (const car of g.cars) {
    if (car.dead || car.police) continue;
    const d = distance(g.player.x, g.player.y, car.x, car.y);
    if (d < bestDist) { bestDist = d; best = car; }
  }
  return best ? { x: best.x, y: best.y } : { x: 1125, y: 675 };
}

function goldCarSpot(g) {
  const gold = g.cars.find((c) => c.gold && !c.dead);
  return gold ? { x: gold.x, y: gold.y } : LANDMARKS.penthouse;
}

function ridingGold(g) {
  return !!(g.player.inCar && g.player.inCar.gold);
}

export const MISSIONS = MISSION_DEFS.map((def, index) => {
  const checks = [
    (g) => !!g.player.inCar,
    (g) => !!g.player.inCar && distance(g.player.x, g.player.y, LANDMARKS.delivery.x, LANDMARKS.delivery.y) < LANDMARKS.delivery.r,
    () => false,
    () => false,
    (g) => ridingGold(g) && distance(g.player.x, g.player.y, LANDMARKS.penthouse.x, LANDMARKS.penthouse.y) < LANDMARKS.penthouse.r,
  ];
  return {
    id: index,
    title: def.title,
    text: def.text,
    reward: def.reward,
    target: (g) => {
      if (index === 0) return nearestCarSpot(g);
      if (index === 1) return LANDMARKS.delivery;
      if (index === 2) return LANDMARKS.shop;
      if (index === 3) return { x: g.player.x, y: g.player.y };
      return goldCarSpot(g);
    },
    done: checks[index],
  };
});

export function finishMission(g) {
  const mission = MISSIONS[g.mission];
  if (!mission) return;
  g.money += mission.reward;
  flash(g, mission.title + " SELESAI! +$" + mission.reward);
  g.mission++;
  g.missionProgress = 0;
  g.missionTimer = 0;
  if (g.mission === 3) {
    g.wanted = 3;
    g.missionTimer = TUNING.getawaySeconds;
  }
  saveGame(g);
  if (g.mission >= MISSIONS.length) {
    g.screen = "win";
  }
}

export function stepMissions(g, dt) {
  const mission = MISSIONS[g.mission];
  if (!mission || g.screen !== "playing") return;
  if (g.mission === 2) {
    const inside = g.player.onFoot &&
      distance(g.player.x, g.player.y, LANDMARKS.shop.x, LANDMARKS.shop.y) < LANDMARKS.shop.r;
    if (inside && g.missionProgress < 1) {
      g.missionProgress += dt / TUNING.robberySeconds;
      if (g.missionProgress >= 1) g.wanted = Math.max(g.wanted, 2);
    }
    if (g.missionProgress >= 1 && g.wanted === 0) finishMission(g);
    return;
  }
  if (g.mission === 3) {
    if (g.wanted >= 2) g.missionTimer -= dt;
    if (g.missionTimer <= 0) finishMission(g);
    return;
  }
  if (mission.done(g)) finishMission(g);
}

export function saveGame(g) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: g.money,
      mission: Math.min(g.mission, MISSIONS.length - 1),
      px: Math.round(g.player.x),
      py: Math.round(g.player.y),
    }));
  } catch (error) {
    // Storage unavailable (private mode) — non-fatal.
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

export function applySave(g, save) {
  if (!save) return;
  g.money = save.money || 0;
  g.mission = save.mission || 0;
  g.player.x = save.px || 675;
  g.player.y = save.py || 675;
  if (g.mission === 3) {
    g.wanted = 3;
    g.missionTimer = TUNING.getawaySeconds;
  }
}
