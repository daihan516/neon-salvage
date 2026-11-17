// Neon Salvage — tuning constants. Everything gameplay-shaping lives here so
// the simulation modules stay free of magic numbers.

export const FIELD = { W: 1280, H: 800 };

export const SHIP = {
  RADIUS: 14,        // collision radius, px
  ROT: 3.6,          // turn rate, rad/s
  THRUST: 300,       // engine acceleration, px/s^2
  DAMP: 0.45,        // passive velocity damping, 1/s
  BRAKE_DAMP: 3.4,   // damping while the brake is held, 1/s
  MAX_SPEED: 420,    // soft speed cap, px/s
};

export const HULL_MAX = 3;
export const INVULN_S = 2; // seconds of blinking invulnerability after a hit

export const BLAST = {
  RADIUS: 160,       // pulse blast reach, px
  START: 3,          // charges at the start of a run
  MAX: 6,            // charge cap
  PODS_PER_CHARGE: 4,// +1 charge per this many pods hauled
  COOLDOWN: 0.35,    // seconds between blasts
};

export const POD = {
  RADIUS: 11,
  FIELD_COUNT: 5,    // normal pods kept on the field
  SCORE: 50,
  RICH_SCORE: 250,
  RICH_LIFE: 8,      // seconds before a rich pod expires
  COMBO_WINDOW: 3,   // seconds to chain the next pod
  MAX_MULT: 8,
};

export const ROCK = {
  BIG_CHANCE: 0.45,  // fraction of spawns that are big rocks
  BIG_R: [30, 46],
  SMALL_R: [14, 22],
  BIG_SPEED: [14, 34],
  SMALL_SPEED: [26, 55],
};

export const WAVE = {
  PODS_PER: 5,       // pods hauled per wave
  BASE: 5,           // rocks on wave 1
  PER_WAVE: 2,       // extra rocks per wave
  MAX: 24,           // rock population cap
  SPEED_PER: 0.12,   // +12% rock speed per wave
  BANNER_S: 2,       // wave banner display time
};
