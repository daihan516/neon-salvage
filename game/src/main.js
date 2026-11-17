// Neon Salvage — entry point. Wires input, world, renderer and audio together
// behind a fixed-step accumulator loop and the title/playing/over screen
// state machine. If the URL carries ?shot=..., it runs a deterministic
// screenshot scene instead (see shots.js) and never starts the live loop.

import { createWorld, startRun, stepWorld } from './world.js';
import { draw } from './render.js';
import { createInput } from './input.js';
import * as audio from './audio.js';
import { runShot } from './shots.js';
import { FIELD } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
if (params.has('shot')) {
  const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;
  runShot(ctx, params.get('shot') || 'start', seed);
} else {
  startGame();
}

function startGame() {
  const input = createInput(canvas);
  const world = createWorld(20261117);
  const DT = 1 / 60;
  let paused = false;
  let blastQueued = false;
  let acc = 0;
  let last = performance.now();

  function currentCtrl(firstStep) {
    const ctrl = { rotate: 0, thrust: false, brake: false, blast: false };
    if (input.down('KeyA', 'ArrowLeft')) ctrl.rotate -= 1;
    if (input.down('KeyD', 'ArrowRight')) ctrl.rotate += 1;
    if (input.down('KeyW', 'ArrowUp')) ctrl.thrust = true;
    if (input.down('KeyS', 'ArrowDown')) ctrl.brake = true;
    if (input.mouse.down) {
      const s = world.ship;
      const desired = Math.atan2(input.mouse.y - s.y, input.mouse.x - s.x);
      let diff = (desired - s.angle) % (Math.PI * 2);
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      ctrl.rotate = diff > 0.08 ? 1 : diff < -0.08 ? -1 : 0;
      ctrl.thrust = Math.abs(diff) < 0.8;
    }
    if (blastQueued && firstStep) {
      ctrl.blast = true;
      blastQueued = false;
    }
    return ctrl;
  }

  function handlePresses() {
    if (input.pressed.size > 0 || input.mouse.clicked) audio.unlockAudio();
    if (world.state === 'title' && (input.pressed.has('Enter') || input.mouse.clicked)) {
      startRun(world);
      paused = false;
    }
    if (world.state === 'over' && input.pressed.has('KeyR')) {
      startRun(world);
      paused = false;
    }
    if (input.pressed.has('Space') && world.state === 'playing') blastQueued = true;
    if (input.pressed.has('KeyP') && world.state === 'playing') paused = !paused;
    if (input.pressed.has('KeyM')) audio.setMuted(!audio.isMuted());
  }

  function drainEvents() {
    for (const ev of world.events) {
      if (ev === 'pickup') audio.sfx.pickup();
      else if (ev === 'rich') audio.sfx.rich();
      else if (ev === 'explosion') audio.sfx.explosion();
      else if (ev === 'blast') audio.sfx.blast();
      else if (ev === 'wave') audio.sfx.wave();
      else if (ev === 'hit') audio.sfx.hit();
      else if (ev === 'alarm') audio.sfx.alarm();
    }
    world.events.length = 0;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > 0.25) elapsed = 0.25;

    handlePresses();
    if (!paused) {
      acc += elapsed;
      let first = true;
      while (acc >= DT) {
        stepWorld(world, currentCtrl(first), DT);
        first = false;
        acc -= DT;
      }
      drainEvents();
    }
    audio.setThrust(!paused && world.state === 'playing' && world.ship.thrusting);
    draw(ctx, world);
    if (paused) {
      ctx.fillStyle = 'rgba(3, 6, 16, 0.5)';
      ctx.fillRect(0, 0, FIELD.W, FIELD.H);
      ctx.font = '700 44px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#59f7ff';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#59f7ff';
      ctx.fillText('PAUSED', FIELD.W / 2, FIELD.H / 2);
      ctx.shadowBlur = 0;
    }
    input.endFrame();
  }
  requestAnimationFrame(frame);
}
