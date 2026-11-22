// Vice Bay combat: shooting, health, ammo and the pickups scattered around
// the city. Bullets fly straight, die on buildings, and hurt whoever they
// touch. Pickups (medkit, ammo box, cash) respawn elsewhere a while after
// they are taken, so the city never runs dry.

import { makeRng, pick, randFloat, randInt } from './tools.js';
import { randomRoadSpot } from './baycity.js';

export const BULLET_SPEED = 950;
export const BULLET_RANGE = 620;
export const BULLET_DAMAGE = 34;

/** The player's fighting state. */
export function makeArsenal() {
  return {
    health: 100,
    maxHealth: 100,
    ammo: 30,
    magSize: 30,
    reserve: 120,
    fireCooldown: 0,
    reloadTimer: 0,
    reloading: false,
  };
}

/** Fires one bullet if the arsenal allows it; returns the bullet or null. */
export function tryFire(arsenal, fromX, fromY, angle) {
  if (arsenal.reloadTimer > 0 || arsenal.fireCooldown > 0) return null;
  if (arsenal.ammo <= 0) {
    startReload(arsenal);
    return null;
  }
  arsenal.ammo--;
  arsenal.fireCooldown = 0.13;
  return {
    x: fromX + Math.cos(angle) * 26,
    y: fromY + Math.sin(angle) * 26,
    angle,
    travelled: 0,
  };
}

/** Starts a reload (takes 1.1s, pulls from the reserve). */
export function startReload(arsenal) {
  if (arsenal.reloading || arsenal.ammo >= arsenal.magSize || arsenal.reserve <= 0) return;
  arsenal.reloading = true;
  arsenal.reloadTimer = 1.1;
}

/** Ticks cooldowns and finishes reloads. */
export function stepArsenal(arsenal, dt) {
  arsenal.fireCooldown = Math.max(0, arsenal.fireCooldown - dt);
  if (arsenal.reloadTimer > 0) {
    arsenal.reloadTimer -= dt;
    if (arsenal.reloadTimer <= 0) {
      const need = arsenal.magSize - arsenal.ammo;
      const take = Math.min(need, arsenal.reserve);
      arsenal.ammo += take;
      arsenal.reserve -= take;
      arsenal.reloading = false;
    }
  }
  // Slow health regen while the player is calm.
  if (arsenal.health > 0 && arsenal.health < arsenal.maxHealth) {
    arsenal.health = Math.min(arsenal.maxHealth, arsenal.health + 1.5 * dt);
  }
}

/**
 * Steps bullets: moves them, kills them on buildings, and tests them against
 * targets [{x, y, r, hp, kind, down}]. onHit(target, damage, bullet) reports
 * every hit; a target whose hp drops to 0 is left for the caller to handle.
 */
export function stepBullets(bullets, targets, dt, city, onHit) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += Math.cos(b.angle) * BULLET_SPEED * dt;
    b.y += Math.sin(b.angle) * BULLET_SPEED * dt;
    b.travelled += BULLET_SPEED * dt;
    let dead = b.travelled > BULLET_RANGE;
    if (!dead) {
      for (const bd of city.buildings) {
        if (b.x >= bd.x && b.x <= bd.x + bd.w && b.y >= bd.y && b.y <= bd.y + bd.h) { dead = true; break; }
      }
    }
    if (!dead) {
      for (const t of targets) {
        if (t.hp <= 0 || t.down > 0) continue;
        const dx = b.x - t.x;
        const dy = b.y - t.y;
        if (dx * dx + dy * dy < (t.r + 5) * (t.r + 5)) {
          t.hp -= BULLET_DAMAGE;
          onHit(t, BULLET_DAMAGE, b);
          dead = true;
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

/** Draws bullets as bright tracers. */
export function drawBullets(ctx, bullets) {
  ctx.save();
  ctx.strokeStyle = '#ffe27a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const b of bullets) {
    ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- pickups

const PICKUP_KINDS = ['medkit', 'ammo', 'cash'];

/** Scatters pickups around the city. */
export function makePickups(city, rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(spawnPickup(city, rng, pick(rng, PICKUP_KINDS)));
  }
  return out;
}

function spawnPickup(city, rng, kind) {
  const spot = randomRoadSpot(city, rng);
  return {
    kind,
    x: spot.x + randFloat(rng, -40, 40),
    y: spot.y + randFloat(rng, -40, 40),
    bob: rng() * Math.PI * 2,
    respawnIn: 0,
    value: kind === 'cash' ? randInt(rng, 25, 100) : 0,
  };
}

/**
 * Picks up whatever the player walks over. onTake(kind, value) reports it.
 * Taken pickups respawn elsewhere after 25 seconds.
 */
export function stepPickups(pickups, px, py, dt, city, rng, onTake) {
  for (const p of pickups) {
    p.bob += dt * 3;
    if (p.respawnIn > 0) {
      p.respawnIn -= dt;
      if (p.respawnIn <= 0) {
        const fresh = spawnPickup(city, rng, p.kind);
        p.x = fresh.x;
        p.y = fresh.y;
        p.value = fresh.value;
      }
      continue;
    }
    const dx = px - p.x;
    const dy = py - p.y;
    if (dx * dx + dy * dy < 38 * 38) {
      onTake(p.kind, p.value);
      p.respawnIn = 25;
    }
  }
}

/** Draws pickups: a floating cross, a bullet box, or a cash stack. */
export function drawPickups(ctx, pickups, time) {
  for (const p of pickups) {
    if (p.respawnIn > 0) continue;
    const bob = Math.sin(p.bob) * 3;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 10 - bob, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.kind === 'medkit') {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = '#d43a3a';
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillRect(-8, -3, 16, 6);
    } else if (p.kind === 'ammo') {
      ctx.fillStyle = '#3a6fd4';
      ctx.fillRect(-11, -8, 22, 16);
      ctx.fillStyle = '#ffd94a';
      ctx.fillRect(-7, -4, 4, 8);
      ctx.fillRect(-1, -4, 4, 8);
      ctx.fillRect(5, -4, 4, 8);
    } else {
      ctx.fillStyle = '#3f9e4d';
      ctx.fillRect(-11, -7, 22, 14);
      ctx.fillStyle = '#e8e8e8';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 0);
    }
    ctx.restore();
  }
}
