// Vice Bay on foot: the player as a walker. WASD moves, Shift sprints, and
// the walker slides around buildings and cannot wade into the bay or the
// harbor basin. The walker carries the aim direction for shooting (the
// mouse), and E near a car hands the player to drive.js.

import { clamp } from './tools.js';
import { pointInWater, resolveCircleBuildings } from './baycity.js';

export const WALK_SPEED = 205;
export const SPRINT_SPEED = 325;
export const WALK_RADIUS = 14;

/** Makes the on-foot player at a spawn point. */
export function makeWalker(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    speed: 0,
    moving: false,
    sprinting: false,
    r: WALK_RADIUS,
  };
}

/**
 * Steps the walker: input {up, down, left, right, sprint, aimX, aimY}.
 * Returns nothing; the walker is mutated in place.
 */
export function stepWalker(p, input, dt, city) {
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(dx, dy);
  p.moving = len > 0;
  p.sprinting = !!input.sprint && len > 0;
  if (len > 0) {
    dx /= len;
    dy /= len;
    const speed = p.sprinting ? SPRINT_SPEED : WALK_SPEED;
    const nx = p.x + dx * speed * dt;
    const ny = p.y + dy * speed * dt;
    // Slide: try the full move, then each axis alone, so walls do not stick.
    if (!pointInWater(city, nx, ny)) { p.x = nx; p.y = ny; }
    else if (!pointInWater(city, nx, p.y)) { p.x = nx; }
    else if (!pointInWater(city, p.x, ny)) { p.y = ny; }
    p.angle = Math.atan2(dy, dx);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  if (input.aimX !== undefined && input.aimY !== undefined) {
    p.aimAngle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  }
  resolveCircleBuildings(city, p);
}

/** Draws the walker: shadow, body, head, and the gun pointing at the aim. */
export function drawWalker(ctx, p, armed) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 15, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = '#2f6fb2';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  // Jacket stripe.
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 9, p.angle - 0.6, p.angle + 0.6);
  ctx.stroke();
  // Head.
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4, 6, 0, Math.PI * 2);
  ctx.fill();
  // Gun arm.
  if (armed) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(p.aimAngle) * 8, Math.sin(p.aimAngle) * 8);
    ctx.lineTo(Math.cos(p.aimAngle) * 24, Math.sin(p.aimAngle) * 24);
    ctx.stroke();
  }
  ctx.restore();
}
