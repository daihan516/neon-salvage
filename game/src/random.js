// mulberry32: a tiny seeded PRNG. Every random choice in the simulation goes
// through an instance of this, so a run (and every screenshot scene) is fully
// reproducible from its seed. No Math.random anywhere in sim code.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Uniform float in [lo, hi).
export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

// Uniform angle in radians, [0, 2*pi).
export function angle(rng) {
  return rng() * Math.PI * 2;
}
