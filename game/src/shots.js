// Deterministic screenshot scenes: ?shot=start|play|end&seed=N.
//
// In shot mode the game builds a fresh world from the seed, advances it with
// fixed 1/60 steps synchronously (no rAF, no wall-clock timing), renders
// exactly one final frame, then sets window.__shotReady = true. Because the
// sim is seeded end to end, a scene renders identically on every run.
//
// The autopilots drive the real rules through the same ctrl object the
// keyboard uses — nothing about the physics is faked for the camera.

import { BLAST, SHIP } from './config.js';
import { createWorld, startRun, stepWorld } from './world.js';
import { draw } from './render.js';

const DT = 1 / 60;
const IDLE = { rotate: 0, thrust: false, brake: false, blast: false };

function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function nearestPod(w) {
  const s = w.ship;
  let best = null;
  let bestD = Infinity;
  for (const p of w.pods) {
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (p.rich) return p;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function carefulCtrl(w) {
  const s = w.ship;
  const ctrl = { rotate: 0, thrust: false, brake: false, blast: false };
  const target = nearestPod(w);
  if (!target) return ctrl;

  let dx = target.x - s.x;
  let dy = target.y - s.y;
  const td = Math.max(60, Math.hypot(dx, dy));
  dx /= td;
  dy /= td;

  let nearestRockD = Infinity;
  for (const r of w.rocks) {
    const rx = r.x - s.x;
    const ry = r.y - s.y;
    const d = Math.hypot(rx, ry);
    if (d < nearestRockD) nearestRockD = d;
    if (d > r.r + 130) continue;
    const rvx = r.vx - s.vx;
    const rvy = r.vy - s.vy;
    const vv = Math.max(1, rvx * rvx + rvy * rvy);
    const t = Math.max(0, Math.min(0.8, -(rx * rvx + ry * rvy) / vv));
    const cx = rx + rvx * t;
    const cy = ry + rvy * t;
    const cd = Math.hypot(cx, cy);
    if (cd < r.r + 58) {
      const wgt = (1 - cd / (r.r + 58)) * 2.6;
      const il = 1 / Math.max(20, cd);
      dx += -cx * il * wgt;
      dy += -cy * il * wgt;
    }
    if (d < 108 + r.r && w.charges > 0) ctrl.blast = true;
  }

  const desired = Math.atan2(dy, dx);
  const diff = angleDiff(desired, s.angle);
  ctrl.rotate = diff > 0.07 ? 1 : diff < -0.07 ? -1 : 0;
  ctrl.thrust = Math.abs(diff) < 0.65;
  const speed = Math.hypot(s.vx, s.vy);
  if (nearestRockD < 74 && speed > 170) ctrl.brake = true;
  return ctrl;
}

function recklessCtrl(w, pilot) {
  const s = w.ship;
  const ctrl = { rotate: 0, thrust: false, brake: false, blast: false };
  pilot.tick++;
  const target = nearestPod(w);
  if (!target) return ctrl;
  if (pilot.targetAngle === undefined || pilot.tick % 30 === 0) {
    pilot.targetAngle = Math.atan2(target.y - s.y, target.x - s.x);
  }
  const diff = angleDiff(pilot.targetAngle, s.angle);
  ctrl.rotate = diff > 0.05 ? 1 : diff < -0.05 ? -1 : 0;
  ctrl.thrust = Math.abs(diff) < 1.9;
  return ctrl;
}

export function runShot(ctx, scene, seed) {
  const w = createWorld(seed);
  if (scene === 'start') {
    for (let i = 0; i < 5 * 60; i++) stepWorld(w, IDLE, DT);
  } else if (scene === 'play') {
    startRun(w);
    for (let i = 0; i < 24 * 60 && w.state === 'playing'; i++) {
      stepWorld(w, carefulCtrl(w), DT);
    }
  } else {
    startRun(w);
    const pilot = { tick: 0, targetAngle: undefined };
    let steps = 0;
    while (w.state === 'playing' && steps < 600 * 60) {
      stepWorld(w, recklessCtrl(w, pilot), DT);
      steps++;
    }
    for (let i = 0; i < 50; i++) stepWorld(w, IDLE, DT);
  }
  draw(ctx, w);
  window.__shotReady = true;
}

export const SHOT_CONSTANTS = { DT, BLAST_RADIUS: BLAST.RADIUS, SHIP_RADIUS: SHIP.RADIUS };
