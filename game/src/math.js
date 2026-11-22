// VICE BAY — small pure helpers for angles, distances and steering.
// No DOM, no state: the same inputs always give the same outputs, which
// keeps the driving, the aiming and the police chases predictable.

export function clamp(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

export function distance(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

// True when the segment from (x1, y1) to (x2, y2) passes within r of the
// point (cx, cy). Fast bullets are stepped in whole segments per frame, so
// a plain point test would let them jump clean over a small target —
// projecting the centre onto the segment first closes that hole.
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) {
    t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
    t = clamp(t, 0, 1);
  }
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return distance(px, py, cx, cy) < r;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Shortest signed turn from `from` to `to`, wrapped into [-PI, PI].
export function angleDiff(from, to) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Move `current` toward `target` by at most maxStep radians this step,
// taking the short way around the circle.
export function steerToward(current, target, maxStep) {
  const diff = angleDiff(current, target);
  return current + clamp(diff, -maxStep, maxStep);
}
