// VICE BAY — a small deterministic PRNG so the city, the traffic and the
// skyline look the same on every load for a given seed. Same seed in,
// same sequence out, every run, on every machine.

export class SeededRandom {
  constructor(seed) {
    // Normalise any number into an unsigned 32-bit state.
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  // Next float in [0, 1). Mulberry32: a tiny state, a good spread, and
  // cheap enough to call thousands of times while the city is built.
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Float between low (inclusive) and high (exclusive).
  range(low, high) {
    return low + this.next() * (high - low);
  }

  // Whole number between low and high, both ends included.
  integer(low, high) {
    return Math.floor(this.range(low, high + 1));
  }

  // One element of the list, picked uniformly.
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  // True with probability p (0 never, 1 always).
  chance(p) {
    return this.next() < p;
  }
}

// Short factory for call sites that just need a fresh generator.
export function makeRandom(seed) {
  return new SeededRandom(seed);
}
