// Keyboard + mouse state for the interactive game. `keys` holds what is
// currently down; `pressed` holds one-shot presses for the current frame
// (main clears it via endFrame after handling). Mouse coordinates are mapped
// into the game's logical 1280x800 space.

import { FIELD } from './config.js';

const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: FIELD.W / 2, y: FIELD.H / 2 - 140, down: false, clicked: false };

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (!e.repeat) pressed.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });

  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * FIELD.W;
    mouse.y = ((e.clientY - r.top) / r.height) * FIELD.H;
  }
  canvas.addEventListener('mousemove', toLogical);
  canvas.addEventListener('mousedown', (e) => {
    toLogical(e);
    mouse.down = true;
    mouse.clicked = true;
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });

  return {
    keys,
    pressed,
    mouse,
    down: (...codes) => codes.some((c) => keys.has(c)),
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
