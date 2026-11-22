// Small helpers shared by every Vice Bay module: a seeded random stream and
// the arithmetic a top-down city game reaches for constantly. Nothing here
// touches the DOM; everything is a pure function of its arguments.

/** A deterministic random stream (mulberry32) from one integer seed. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Clamps v into [lo, hi]. */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Linear interpolation between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Squared distance between two points (no square root needed for compares). */
export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Distance between two points. */
export function dist(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

/** The smallest signed turn from angle a to angle b, in (-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Picks one element of an array with the given stream. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** An integer in [lo, hi] from the given stream. */
export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** A float in [lo, hi) from the given stream. */
export function randFloat(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

/** Formats a cash amount as $1,234. */
export function cashString(n) {
  const whole = Math.floor(Math.abs(n));
  const text = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-$' : '$') + text;
}

/** Formats game-clock minutes since midnight as 19:42. */
export function clockString(minutes) {
  const m = Math.floor(minutes) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
