// Neon Salvage — world simulation. Pure fixed-step sim: no rendering, no DOM,
// no Math.random. Every random choice flows through world.rng (mulberry32),
// so a world built from a seed evolves identically every time.
//
// stepWorld(world, ctrl, dt) advances one step. ctrl is
//   { rotate: -1|0|1, thrust: bool, brake: bool, blast: bool }
// which lets keyboard/mouse input and the screenshot autopilots share the
// exact same rules. Sound cues are queued as strings in world.events and
// drained by the caller.

import { FIELD, SHIP, HULL_MAX, INVULN_S, BLAST, POD, ROCK, WAVE } from './config.js';
import { mulberry32, range, angle } from './random.js';

const IDLE = { rotate: 0, thrust: false, brake: false, blast: false };

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function wrap(o, m) {
  if (o.x < -m) o.x += FIELD.W + 2 * m;
  if (o.x > FIELD.W + m) o.x -= FIELD.W + 2 * m;
  if (o.y < -m) o.y += FIELD.H + 2 * m;
  if (o.y > FIELD.H + m) o.y -= FIELD.H + 2 * m;
}

// A position at least minDist from the ship (best effort after retries).
function farPos(w, minDist) {
  let x = FIELD.W / 2;
  let y = FIELD.H / 2;
  for (let i = 0; i < 10; i++) {
    x = range(w.rng, 30, FIELD.W - 30);
    y = range(w.rng, 30, FIELD.H - 30);
    if (Math.hypot(x - w.ship.x, y - w.ship.y) >= minDist) break;
  }
  return { x, y };
}

function spawnPod(w, rich = false) {
  const p = farPos(w, 170);
  const a = angle(w.rng);
  const speed = rich ? range(w.rng, 30, 46) : range(w.rng, 8, 20);
  w.pods.push({
    x: p.x,
    y: p.y,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    r: POD.RADIUS + (rich ? 2 : 0),
    rich,
    life: rich ? POD.RICH_LIFE : Infinity,
  });
}

function spawnRock(w, anywhere = false) {
  const big = w.rng() < ROCK.BIG_CHANCE;
  const r = big ? range(w.rng, ROCK.BIG_R[0], ROCK.BIG_R[1]) : range(w.rng, ROCK.SMALL_R[0], ROCK.SMALL_R[1]);
  const p = anywhere ? farPos(w, 200) : farPos(w, 260);
  const a = angle(w.rng);
  const speed =
    (big ? range(w.rng, ROCK.BIG_SPEED[0], ROCK.BIG_SPEED[1]) : range(w.rng, ROCK.SMALL_SPEED[0], ROCK.SMALL_SPEED[1])) *
    w.waveScale;
  const n = 8 + Math.floor(w.rng() * 4);
  const verts = [];
  for (let i = 0; i < n; i++) verts.push({ a: (i / n) * Math.PI * 2, f: range(w.rng, 0.72, 1.12) });
  w.rocks.push({
    x: p.x,
    y: p.y,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    r,
    big,
    rot: angle(w.rng),
    rotV: range(w.rng, -0.9, 0.9),
    verts,
  });
}

function burst(w, x, y, n, color, speed = 190, life = 0.7, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = angle(w.rng);
    const sp = range(w.rng, speed * 0.25, speed);
    const lf = range(w.rng, life * 0.4, life);
    w.parts.push({
      kind: 'dot',
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: lf,
      maxLife: lf,
      size: range(w.rng, size * 0.5, size * 1.4),
      color,
    });
  }
  if (w.parts.length > 420) w.parts.splice(0, w.parts.length - 420);
}

function rockTarget(w) {
  return Math.min(WAVE.BASE + (w.wave - 1) * WAVE.PER_WAVE, WAVE.MAX);
}

function setBanner(w, text) {
  w.bannerText = text;
  w.banner = WAVE.BANNER_S;
}

export function createWorld(seed) {
  const rng = mulberry32(seed);
  const w = {
    seed,
    rng,
    time: 0,
    state: 'title', // 'title' | 'playing' | 'over'
    ship: {
      x: FIELD.W / 2,
      y: FIELD.H / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      hull: HULL_MAX,
      invuln: 0,
      blastReadyAt: 0,
      thrusting: false,
      alive: true,
    },
    pods: [],
    rocks: [],
    parts: [],
    score: 0,
    best: 0,
    mult: 1,
    combo: 0,
    podsHauled: 0,
    wave: 1,
    waveScale: 1,
    charges: BLAST.START,
    banner: 0,
    bannerText: '',
    flash: 0,
    shake: 0,
    richTimer: range(rng, 8, 14),
    spawnTimer: 0,
    alarmTimer: 0,
    events: [],
  };
  // Ambient field drifting behind the title screen.
  for (let i = 0; i < POD.FIELD_COUNT; i++) spawnPod(w);
  for (let i = 0; i < 7; i++) spawnRock(w, true);
  return w;
}

export function startRun(w) {
  const s = w.ship;
  s.x = FIELD.W / 2;
  s.y = FIELD.H / 2;
  s.vx = 0;
  s.vy = 0;
  s.angle = -Math.PI / 2;
  s.hull = HULL_MAX;
  s.invuln = 1;
  s.alive = true;
  s.thrusting = false;
  s.blastReadyAt = 0;
  w.pods.length = 0;
  w.rocks.length = 0;
  w.parts.length = 0;
  w.score = 0;
  w.mult = 1;
  w.combo = 0;
  w.podsHauled = 0;
  w.wave = 1;
  w.waveScale = 1;
  w.charges = BLAST.START;
  w.flash = 0;
  w.shake = 0;
  w.alarmTimer = 0;
  w.richTimer = range(w.rng, 8, 14);
  for (let i = 0; i < POD.FIELD_COUNT; i++) spawnPod(w);
  for (let i = 0, n = rockTarget(w); i < n; i++) spawnRock(w);
  w.state = 'playing';
  setBanner(w, 'WAVE 1');
}

// ---- pulse blast ----------------------------------------------------------

function tryBlast(w) {
  const s = w.ship;
  if (w.charges <= 0 || w.time < s.blastReadyAt) return;
  w.charges--;
  s.blastReadyAt = w.time + BLAST.COOLDOWN;
  w.events.push('blast');
  w.parts.push({
    kind: 'ring',
    x: s.x,
    y: s.y,
    vx: 0,
    vy: 0,
    life: 0.28,
    maxLife: 0.28,
    size: BLAST.RADIUS,
    color: '#7df9ff',
  });
  const victims = w.rocks.filter((r) => dist(r, s) < BLAST.RADIUS + r.r);
  for (const r of victims) {
    w.rocks.splice(w.rocks.indexOf(r), 1);
    if (r.big) {
      burst(w, r.x, r.y, 8, '#ff5da2', 150, 0.55);
      // A blasted big rock splits into two small ones.
      for (let i = 0; i < 2; i++) {
        const a = angle(w.rng);
        const sp = range(w.rng, 30, 56) * w.waveScale;
        const n = 8 + Math.floor(w.rng() * 3);
        const verts = [];
        for (let j = 0; j < n; j++) verts.push({ a: (j / n) * Math.PI * 2, f: range(w.rng, 0.72, 1.12) });
        w.rocks.push({
          x: r.x + Math.cos(a) * 8,
          y: r.y + Math.sin(a) * 8,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          r: range(w.rng, ROCK.SMALL_R[0], ROCK.SMALL_R[1]),
          big: false,
          rot: angle(w.rng),
          rotV: range(w.rng, -1.4, 1.4),
          verts,
        });
      }
    } else {
      burst(w, r.x, r.y, 10, '#ffb3d9', 170, 0.5);
    }
  }
}

// ---- collisions -----------------------------------------------------------

function collectPod(w, pod) {
  w.pods.splice(w.pods.indexOf(pod), 1);
  if (w.combo > 0) w.mult = Math.min(POD.MAX_MULT, w.mult + 1);
  w.combo = POD.COMBO_WINDOW;
  w.score += (pod.rich ? POD.RICH_SCORE : POD.SCORE) * w.mult;
  w.podsHauled++;
  w.events.push(pod.rich ? 'rich' : 'pickup');
  burst(w, pod.x, pod.y, pod.rich ? 22 : 13, pod.rich ? '#4df3ff' : '#ffcf6e', 150, 0.55, 2.6);
  if (w.podsHauled % BLAST.PODS_PER_CHARGE === 0 && w.charges < BLAST.MAX) w.charges++;
  const newWave = 1 + Math.floor(w.podsHauled / WAVE.PODS_PER);
  if (newWave > w.wave) {
    const oldScale = w.waveScale;
    w.wave = newWave;
    w.waveScale = 1 + (w.wave - 1) * WAVE.SPEED_PER;
    const ratio = w.waveScale / oldScale;
    for (const r of w.rocks) {
      r.vx *= ratio;
      r.vy *= ratio;
    }
    setBanner(w, 'WAVE ' + w.wave);
    w.events.push('wave');
  }
  if (!pod.rich) spawnPod(w);
}

function die(w) {
  const s = w.ship;
  s.alive = false;
  s.thrusting = false;
  w.state = 'over';
  w.best = Math.max(w.best, w.score);
  w.shake = 22;
  w.flash = 0.5;
  w.events.push('explosion');
  burst(w, s.x, s.y, 46, '#59f7ff', 260, 1.1, 3.6);
  burst(w, s.x, s.y, 30, '#ff9a3c', 200, 0.9, 3);
  burst(w, s.x, s.y, 18, '#ff5da2', 140, 0.8, 2.6);
}

function collideRocks(w) {
  const s = w.ship;
  if (s.invuln > 0) return;
  for (const r of [...w.rocks]) {
    if (dist(r, s) < r.r + SHIP.RADIUS - 2) {
      w.rocks.splice(w.rocks.indexOf(r), 1);
      burst(w, r.x, r.y, 20, r.big ? '#ff5da2' : '#c9d4e0', 220, 0.7);
      s.hull--;
      w.shake = 14;
      w.flash = 0.4;
      s.invuln = INVULN_S;
      if (s.hull <= 0) die(w);
      else w.events.push('hit');
      break; // at most one hull hit per step
    }
  }
}

// ---- main step --------------------------------------------------------------

function stepParticles(w, dt) {
  for (let i = w.parts.length - 1; i >= 0; i--) {
    const p = w.parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      w.parts.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'dot') {
      p.vx *= 1 - 1.6 * dt;
      p.vy *= 1 - 1.6 * dt;
    }
  }
}

function drift(w, dt) {
  for (const r of w.rocks) {
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    r.rot += r.rotV * dt;
    wrap(r, r.r);
  }
  for (const p of w.pods) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    wrap(p, p.r + 4);
  }
}

export function stepWorld(w, ctrl = IDLE, dt) {
  w.time += dt;
  stepParticles(w, dt);
  if (w.flash > 0) w.flash = Math.max(0, w.flash - dt);
  if (w.shake > 0) w.shake = Math.max(0, w.shake - dt * 26);
  if (w.banner > 0) w.banner = Math.max(0, w.banner - dt);
  drift(w, dt);

  const s = w.ship;

  if (w.state === 'title') {
    // The skiff idles at the centre of a slowly drifting field.
    s.angle = -Math.PI / 2 + Math.sin(w.time * 0.35) * 0.25;
    s.y = FIELD.H / 2 + Math.sin(w.time * 0.8) * 8;
    return;
  }
  if (w.state === 'over') return;

  // --- playing ---
  if (s.invuln > 0) s.invuln -= dt;

  if (w.combo > 0) {
    w.combo -= dt;
    if (w.combo <= 0) {
      w.combo = 0;
      w.mult = 1;
    }
  }

  if (ctrl.rotate) s.angle += ctrl.rotate * SHIP.ROT * dt;
  s.thrusting = !!ctrl.thrust;
  if (ctrl.thrust) {
    s.vx += Math.cos(s.angle) * SHIP.THRUST * dt;
    s.vy += Math.sin(s.angle) * SHIP.THRUST * dt;
    // Engine trail.
    for (let i = 0; i < 2; i++) {
      const bx = s.x - Math.cos(s.angle) * 16 + range(w.rng, -3, 3);
      const by = s.y - Math.sin(s.angle) * 16 + range(w.rng, -3, 3);
      const lf = range(w.rng, 0.25, 0.45);
      w.parts.push({
        kind: 'dot',
        x: bx,
        y: by,
        vx: -Math.cos(s.angle) * range(w.rng, 40, 95) + s.vx * 0.35,
        vy: -Math.sin(s.angle) * range(w.rng, 40, 95) + s.vy * 0.35,
        life: lf,
        maxLife: lf,
        size: range(w.rng, 1.6, 3.2),
        color: w.rng() < 0.55 ? '#59f7ff' : '#ff9a3c',
      });
    }
  }
  const dampK = Math.max(0, 1 - (ctrl.brake ? SHIP.BRAKE_DAMP : SHIP.DAMP) * dt);
  s.vx *= dampK;
  s.vy *= dampK;
  const sp = Math.hypot(s.vx, s.vy);
  if (sp > SHIP.MAX_SPEED) {
    s.vx *= SHIP.MAX_SPEED / sp;
    s.vy *= SHIP.MAX_SPEED / sp;
  }
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  wrap(s, SHIP.RADIUS);

  if (ctrl.blast) tryBlast(w);

  // Rich pod lifecycle: expiry, then the spawn timer.
  const rich = w.pods.find((p) => p.rich);
  if (rich) {
    rich.life -= dt;
    if (rich.life <= 0) {
      w.pods.splice(w.pods.indexOf(rich), 1);
      burst(w, rich.x, rich.y, 8, '#4df3ff', 90, 0.4, 2);
    }
  } else {
    w.richTimer -= dt;
    if (w.richTimer <= 0) {
      spawnPod(w, true);
      w.richTimer = range(w.rng, 14, 22);
    }
  }

  // Keep the rock population at the wave's target.
  if (w.rocks.length < rockTarget(w)) {
    w.spawnTimer -= dt;
    if (w.spawnTimer <= 0) {
      spawnRock(w);
      w.spawnTimer = 0.7;
    }
  }

  // Pod pickups.
  for (const p of [...w.pods]) {
    if (dist(p, s) < p.r + SHIP.RADIUS + 6) collectPod(w, p);
  }
  collideRocks(w);

  // Low-hull alarm, about once a second.
  if (s.hull === 1) {
    w.alarmTimer -= dt;
    if (w.alarmTimer <= 0) {
      w.events.push('alarm');
      w.alarmTimer = 1.1;
    }
  }
}
