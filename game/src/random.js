// VICE BAY — deterministic randomness (sfc32), wrapped in a small class so
// every system draws from an explicit, seedable source. The city layout and
// the traffic behaviour are identical on every run with the same seed.

function sfc32(a, b, c, d) {
  return function () {
    a |= 0; b |= 0; c |= 0; d |= 0;
    let t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return ((t >>> 0) / 4294967296);
  };
}

export class SeededRandom {
  constructor(seed) {
    const s = seed >>> 0;
    this.nextFn = sfc32(s, s ^ 0x9e3779b9, (s << 1) ^ 0x85ebca6b, (s >>> 1) ^ 0xc2b2ae35);
  }

  next() {
    return this.nextFn();
  }

  range(low, high) {
    return low + this.next() * (high - low);
  }

  integer(low, high) {
    return Math.floor(this.range(low, high + 1));
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  chance(probability) {
    return this.next() < probability;
  }
}

export function makeRandom(seed) {
  return new SeededRandom(seed);
}
