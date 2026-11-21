// VICE BAY — small math helpers shared by every module.
// Pure functions only; nothing here touches the DOM or the game state.

export function clamp(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// True when the segment (x1,y1)->(x2,y2) passes within r of (cx,cy).
// A fast bullet moves up to ~48 units per frame at low frame rates, so a
// point check alone can jump clean over a small target (tunneling).
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) {
    t = clamp(((cx - x1) * dx + (cy - y1) * dy) / lenSq, 0, 1);
  }
  return distance(x1 + t * dx, y1 + t * dy, cx, cy) < r;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Shortest signed turn from angle `from` toward angle `to`, in [-PI, PI].
export function angleDiff(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Steer `current` toward `target` by at most `maxStep` radians.
export function steerToward(current, target, maxStep) {
  return current + clamp(angleDiff(current, target), -maxStep, maxStep);
}
