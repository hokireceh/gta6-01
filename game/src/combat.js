// VICE BAY — everything that shoots, blows up or sparkles: the player's
// pistol, police fire, bullet flight and hits, car explosions and the
// particle system. Wrecks are detonated by sweepWrecks(), which the main
// loop runs once per tick after every other update.

import { VIEW_W, VIEW_H, ZOOM, TUNING } from "./config.js";
import { clamp, distance, angleTo, segmentHitsCircle } from "./math.js";
import { makeBullet, makeParticle, makePickup, makeCar } from "./entities.js";

// Round 5 note: the entrypoint now builds dossier.json with the vendored buildDossier and copies screenshots/ into the output.
export function flash(g, text) {
  g.message = text;
  g.messageT = 2.5;
}

export function playerShoot(g, random) {
  const player = g.player;
  if (player.shootCd > 0) return;
  player.shootCd = TUNING.shootCooldown;
  g.stats.shots++;
  const aimX = g.cam.x + (g.mouse.x - VIEW_W / 2) / ZOOM;
  const aimY = g.cam.y + (g.mouse.y - VIEW_H / 2) / ZOOM;
  const heading = angleTo(player.x, player.y, aimX, aimY);
  g.bullets.push(makeBullet(
    player.x + Math.cos(heading) * 26,
    player.y + Math.sin(heading) * 26,
    heading, TUNING.playerBulletSpeed, TUNING.playerBulletLife, true,
  ));
  spawnSparks(g, player.x + Math.cos(heading) * 26, player.y + Math.sin(heading) * 26, random);
}

export function stepBullets(g, city, random, dt, onBusted) {
  for (const bullet of g.bullets) {
    const prevX = bullet.x;
    const prevY = bullet.y;
    bullet.x += Math.cos(bullet.angle) * bullet.speed * dt;
    bullet.y += Math.sin(bullet.angle) * bullet.speed * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) continue;
    if (city.hitsBuilding(bullet.x, bullet.y, 4)) {
      bullet.life = 0;
      spawnSparks(g, bullet.x, bullet.y, random);
      continue;
    }
    if (bullet.fromPlayer) {
      for (const ped of g.peds) {
        if (ped.down > 0) continue;
        if (segmentHitsCircle(prevX, prevY, bullet.x, bullet.y, ped.x, ped.y, 14)) {
          bullet.life = 0;
          ped.down = TUNING.pedDownSeconds;
          ped.state = "down";
          g.stats.hits++;
          g.pickups.push(makePickup(ped.x, ped.y, "cash"));
          break;
        }
      }
      if (bullet.life <= 0) continue;
      for (const car of g.cars) {
        if (car.dead || g.player.inCar === car) continue;
        if (segmentHitsCircle(prevX, prevY, bullet.x, bullet.y, car.x, car.y, 30)) {
          bullet.life = 0;
          g.stats.hits++;
          car.health -= TUNING.bulletDamage;
          spawnSparks(g, bullet.x, bullet.y, random);
          break;
        }
      }
    } else {
      const player = g.player;
      const hitRadius = player.inCar ? 30 : 14;
      if (distance(bullet.x, bullet.y, player.x, player.y) < hitRadius) {
        bullet.life = 0;
        if (player.inCar) {
          player.inCar.health -= TUNING.carBulletDamage;
        } else {
          g.hp -= TUNING.policeBulletDamage;
          if (g.hp <= 0) {
            g.hp = 0;
            onBusted("Kamu tertembak polisi!");
            return;
          }
        }
      }
    }
  }
  g.bullets = g.bullets.filter((b) => b.life > 0);
}

export function detonateCar(g, car, random) {
  if (car.dead) return;
  car.dead = true;
  car.burnLeft = TUNING.carWreckLifetime;
  spawnBlast(g, car.x, car.y, random);
  const player = g.player;
  if (player.inCar === car) {
    player.inCar = null;
    player.onFoot = true;
    player.speed = 0;
    player.x = car.x + 50;
    player.y = car.y;
    g.hp = Math.max(1, g.hp - 30);
    flash(g, "Mobilmu meledak!");
  }
  for (const other of g.cars) {
    if (other === car || other.dead) continue;
    if (distance(car.x, car.y, other.x, other.y) < TUNING.explosionRadius) {
      other.health -= TUNING.explosionCarDamage;
      if (other.health <= 0) detonateCar(g, other, random);
    }
  }
  for (const ped of g.peds) {
    if (ped.down <= 0 && distance(car.x, car.y, ped.x, ped.y) < TUNING.explosionRadius) {
      ped.down = TUNING.pedDownSeconds;
      ped.state = "down";
    }
  }
}

// Detonate every car whose health has dropped to zero.
export function sweepWrecks(g, random) {
  for (const car of g.cars) {
    if (!car.dead && car.health <= 0) detonateCar(g, car, random);
  }
}

export function spawnSparks(g, x, y, random) {
  for (let i = 0; i < 6; i++) {
    g.particles.push(makeParticle(
      x, y,
      random.range(-120, 120), random.range(-120, 120),
      random.range(0.15, 0.4), 0.4, "#ffd23d", random.range(2, 4),
    ));
  }
}

export function spawnBlast(g, x, y, random) {
  const colors = ["#ff7a1a", "#ff2e2e", "#ffd23d", "#7a7a7a"];
  for (let i = 0; i < 26; i++) {
    const heading = random.range(0, Math.PI * 2);
    const speed = random.range(40, 320);
    g.particles.push(makeParticle(
      x, y,
      Math.cos(heading) * speed, Math.sin(heading) * speed,
      random.range(0.3, 0.9), 0.9, random.pick(colors), random.range(4, 12),
    ));
  }
}

export function stepParticles(g, city, random, dt) {
  for (const particle of g.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.96;
    particle.vy *= 0.96;
    particle.life -= dt;
  }
  g.particles = g.particles.filter((p) => p.life > 0);
  for (const car of g.cars) {
    if (car.dead && car.burnLeft > 0) car.burnLeft -= dt;
  }
  g.cars = g.cars.filter((c) => !(c.dead && c.burnLeft <= 0));
  const rolling = g.cars.filter((c) => !c.police && !c.parked && !c.gold).length;
  if (rolling < 10 && random.next() < dt * 0.5) {
    const vertical = random.chance(0.5);
    const line = random.pick(city.roads);
    const fresh = makeCar(
      vertical ? line : random.range(100, 3500),
      vertical ? random.range(100, 3500) : line,
      0, { road: vertical ? "v" : "h" }, random,
    );
    fresh.speed = random.range(60, 110);
    g.cars.push(fresh);
  }
}
