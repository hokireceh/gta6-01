// Vice Bay — shooting, bullets, and the wanted-level consequences of crime.

import { TUNING } from './config.js';
import { circleHitsRect, dist } from './math.js';
import { makeBullet } from './entities.js';
import { buildingAt } from './world.js';

/** Spawn one bullet from `from` toward the angle `angle`. */
export function fireBullet(bullets, from, x, y, angle, damage = TUNING.bulletDamage) {
  const spread = from === 'player' ? 0.035 : 0.16;
  const a = angle + (Math.random() - 0.5) * 2 * spread;
  bullets.push(makeBullet(x + Math.cos(a) * 22, y + Math.sin(a) * 22, a, from, damage));
}

/**
 * Move bullets, spark them off buildings, and apply hits.
 * `targets` are {x, y, radius, hp, kind} objects; `onHit(target, bullet)`
 * runs for every hit and may remove the target. Returns nothing.
 */
export function updateBullets(world, bullets, targets, dt, onHit) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.travelled += b.speed * dt;
    let dead = b.travelled > b.range;
    if (!dead && buildingAt(world, b.x, b.y, 2)) dead = true;
    if (!dead) {
      for (const t of targets) {
        if (t.hp !== undefined && t.hp <= 0) continue;
        if (dist(b.x, b.y, t.x, t.y) < t.radius + 3) {
          onHit(t, b);
          dead = true;
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

/** Raise the wanted level and restart the decay clock. */
export function addWanted(game, stars, reason) {
  const before = game.wanted;
  game.wanted = Math.min(TUNING.wantedMax, game.wanted + stars);
  game.wantedTimer = 0;
  game.seenTimer = 0;
  if (game.wanted > before) {
    game.flashMessage(reason, 2.4);
  }
}

/** A foot cop fires at the player when close enough and its timer is up. */
export function copShoot(cop, player, bullets, dt) {
  cop.shootCooldown -= dt;
  const d = dist(cop.x, cop.y, player.x, player.y);
  if (cop.shootCooldown > 0 || d > 420 || d < 40) return false;
  cop.shootCooldown = TUNING.copShotInterval * (0.8 + Math.random() * 0.5);
  const aim = Math.atan2(player.y - cop.y, player.x - cop.x);
  fireBullet(bullets, 'cop', cop.x, cop.y, aim, TUNING.copShotDamage);
  return true;
}

/** Point-vs-building test for a bullet's next step (cheap early-out). */
export function bulletHitsBuilding(world, x, y) {
  return buildingAt(world, x, y, 2) !== null || circleHitsRect(x, y, 2, {
    x: world.water.x + 46, y: world.water.y + 46, w: world.water.w, h: world.water.h,
  });
}
