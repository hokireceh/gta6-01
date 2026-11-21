// VICE BAY — scripted scenes for screenshots (?shot=...&seed=...).
// Written fresh for the rebuild.
import { makeCar } from './entities.js';
import { startMission } from './missions.js';

export function setupShot(G, name) {
  const p = G.player;
  if (name === 'menu') {
    G.mode = 'menu';
    return;
  }
  if (name === 'drive') {
    G.mode = 'playing';
    const car = G.cars.find((c) => c.kind === 'parked');
    car.x = 516; car.y = 500; car.angle = Math.PI / 2; car.speed = 240;
    car.playerDriven = true;
    car.kind = 'player';
    p.car = car;
    p.onFoot = false;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    startMission(G, 0);
    return;
  }
  if (name === 'chase') {
    G.mode = 'playing';
    const car = G.cars.find((c) => c.kind === 'parked');
    car.x = 1160; car.y = 800; car.angle = 0; car.speed = 200;
    car.playerDriven = true;
    car.kind = 'player';
    p.car = car;
    p.onFoot = false;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    G.cars.push(makeCar(G, 1080, 700, 0.4, 'police', { speed: 180 }));
    G.cars.push(makeCar(G, 1260, 920, -2.6, 'police', { speed: 180 }));
    G.footCops.push({ x: 1100, y: 760, angle: 0, hp: 100, speed: 160, fireCd: 1 });
    startMission(G, 3);
    G.wanted = 3;
    G.lastSeenAt = G.time;
    return;
  }
  if (name === 'win') {
    G.mode = 'win';
    G.money = 3350;
    return;
  }
  G.mode = 'menu';
}
