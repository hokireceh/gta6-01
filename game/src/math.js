// Vice Bay — small pure math helpers. No state, no imports.

export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Shortest signed turn from angle `a` to angle `b`, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/** Move angle `a` toward `b` by at most `step` radians. */
export function angleToward(a, b, step) {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Circle-vs-rect test; true when they overlap. */
export function circleHitsRect(cx, cy, radius, r) {
  const nx = clamp(cx, r.x, r.x + r.w);
  const ny = clamp(cy, r.y, r.y + r.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < radius * radius;
}

/**
 * Push a circle out of a rect it overlaps. Mutates and returns `pos`
 * ({x, y}); returns false when there was no overlap.
 */
export function pushCircleOutOfRect(pos, radius, r) {
  const nx = clamp(pos.x, r.x, r.x + r.w);
  const ny = clamp(pos.y, r.y, r.y + r.h);
  let dx = pos.x - nx;
  let dy = pos.y - ny;
  let d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return false;
  if (d2 < 0.0001) {
    // Centre inside the rect: push out along the smallest penetration.
    const left = pos.x - r.x;
    const right = r.x + r.w - pos.x;
    const top = pos.y - r.y;
    const bottom = r.y + r.h - pos.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) pos.x = r.x - radius;
    else if (m === right) pos.x = r.x + r.w + radius;
    else if (m === top) pos.y = r.y - radius;
    else pos.y = r.y + r.h + radius;
    return true;
  }
  const d = Math.sqrt(d2);
  dx /= d;
  dy /= d;
  pos.x = nx + dx * radius;
  pos.y = ny + dy * radius;
  return true;
}

/** Angle of the vector (ax,ay)->(bx,by). */
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a) {
  a = a % TAU;
  if (a > Math.PI) a -= TAU;
  if (a <= -Math.PI) a += TAU;
  return a;
}
