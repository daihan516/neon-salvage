// Neon Salvage — all canvas drawing: starfield/nebula background, entities,
// particles, HUD, title and game-over screens. Rendering never mutates the
// world and never touches the sim RNG; decorative randomness (the starfield)
// comes from its own fixed-seed generator built once at module load.

import { FIELD, SHIP, BLAST, POD, HULL_MAX } from './config.js';
import { mulberry32 } from './random.js';

const FONT = 'ui-monospace, Menlo, Consolas, monospace';

// --- decorative starfield (own seed; not part of the simulation) ----------
const starLayers = (() => {
  const rng = mulberry32(20261);
  const defs = [
    { n: 110, par: 0.05, size: 1.1, drift: 1.5 },
    { n: 70, par: 0.13, size: 1.7, drift: 3.5 },
    { n: 42, par: 0.24, size: 2.5, drift: 6 },
  ];
  return defs.map((d) => {
    const stars = [];
    for (let i = 0; i < d.n; i++) {
      stars.push({ x: rng() * FIELD.W, y: rng() * FIELD.H, p: rng() * Math.PI * 2 });
    }
    return { ...d, stars };
  });
})();

let bgGrad = null;

function mod(v, m) {
  return ((v % m) + m) % m;
}

function neonText(ctx, text, x, y, size, color, align = 'left', alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function plainText(ctx, text, x, y, size, color, align = 'left', alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// --- background -------------------------------------------------------------

function drawBackground(ctx, w) {
  if (!bgGrad) {
    bgGrad = ctx.createLinearGradient(0, 0, 0, FIELD.H);
    bgGrad.addColorStop(0, '#070b24');
    bgGrad.addColorStop(0.55, '#04060f');
    bgGrad.addColorStop(1, '#0a0518');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, FIELD.W, FIELD.H);

  // Nebula blobs.
  for (const [x, y, r, color] of [
    [290, 170, 330, 'rgba(88, 40, 160, 0.20)'],
    [990, 630, 380, 'rgba(10, 90, 110, 0.18)'],
  ]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // The dying star, top-right: a hot core inside a wide red-orange glow.
  const sg = ctx.createRadialGradient(1175, 105, 0, 1175, 105, 300);
  sg.addColorStop(0, 'rgba(255, 190, 90, 0.55)');
  sg.addColorStop(0.25, 'rgba(255, 110, 50, 0.22)');
  sg.addColorStop(1, 'rgba(255, 80, 40, 0)');
  ctx.fillStyle = sg;
  ctx.fillRect(875, -195, 600, 600);
  ctx.save();
  ctx.shadowColor = '#ffb340';
  ctx.shadowBlur = 42;
  ctx.fillStyle = '#ffd9a0';
  ctx.beginPath();
  ctx.arc(1175, 105, 26 + Math.sin(w.time * 1.7) * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Parallax star layers: drift with time, shift against the ship.
  for (const layer of starLayers) {
    ctx.fillStyle = '#cfe9ff';
    for (const st of layer.stars) {
      const sx = mod(st.x - w.ship.x * layer.par - w.time * layer.drift, FIELD.W);
      const sy = mod(st.y - w.ship.y * layer.par * 0.6, FIELD.H);
      ctx.globalAlpha = 0.3 + 0.55 * Math.abs(Math.sin(w.time * 0.7 + st.p));
      ctx.fillRect(sx, sy, layer.size, layer.size);
    }
  }
  ctx.globalAlpha = 1;
}

// --- entities ---------------------------------------------------------------

function drawPod(ctx, w, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  let alpha = 1;
  if (p.rich) {
    alpha = p.life < 2.5 ? (Math.floor(w.time * 8) % 2 === 0 ? 0.3 : 1) : 0.78 + 0.22 * Math.sin(w.time * 10);
  }
  ctx.globalAlpha = alpha;
  const color = p.rich ? '#4df3ff' : '#ffb340';
  const s = p.rich ? 21 : 18;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(16, 14, 8, 0.9)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-s / 2, -s / 2, s, s, 3);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(-s / 2, -s / 2);
  ctx.lineTo(s / 2, s / 2);
  ctx.moveTo(s / 2, -s / 2);
  ctx.lineTo(-s / 2, s / 2);
  ctx.stroke();
  if (p.rich) {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.95 + Math.sin(w.time * 6) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRock(ctx, r) {
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.beginPath();
  r.verts.forEach((v, i) => {
    const px = Math.cos(v.a + r.rot) * r.r * v.f;
    const py = Math.sin(v.a + r.rot) * r.r * v.f;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(18, 14, 28, 0.92)';
  ctx.strokeStyle = r.big ? '#ff5da2' : '#9fb2c8';
  ctx.lineWidth = 2;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 9;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawShip(ctx, w) {
  const s = w.ship;
  if (!s.alive) return;
  if (s.invuln > 0 && Math.floor(w.time * 10) % 2 === 0) ctx.globalAlpha = 0.3;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.angle);
  if (s.thrusting) {
    const fl = 15 + Math.sin(w.time * 42) * 5;
    ctx.beginPath();
    ctx.moveTo(-11, 5);
    ctx.lineTo(-11 - fl, 0);
    ctx.lineTo(-11, -5);
    ctx.closePath();
    ctx.fillStyle = '#ff9a3c';
    ctx.shadowColor = '#ff9a3c';
    ctx.shadowBlur = 14;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(19, 0);
  ctx.lineTo(-12, 11);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-12, -11);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8, 22, 34, 0.95)';
  ctx.strokeStyle = '#59f7ff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#59f7ff';
  ctx.shadowBlur = 13;
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#dffaff';
  ctx.beginPath();
  ctx.arc(4, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawParticles(ctx, w) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of w.parts) {
    const f = Math.max(0, p.life / p.maxLife);
    if (p.kind === 'ring') {
      ctx.globalAlpha = f;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - f) + 8, 0, Math.PI * 2);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.globalAlpha = f;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * f), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// --- HUD & screens ------------------------------------------------------------

function drawHullIcons(ctx, w) {
  for (let i = 0; i < HULL_MAX; i++) {
    const x = FIELD.W - 36 - i * 34;
    const y = 34;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-8, 7);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, -7);
    ctx.closePath();
    if (i < w.ship.hull) {
      ctx.fillStyle = '#59f7ff';
      ctx.shadowColor = '#59f7ff';
      ctx.shadowBlur = 8;
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(120, 140, 160, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawHUD(ctx, w) {
  neonText(ctx, 'SCORE ' + String(w.score).padStart(6, '0'), 24, 32, 22, '#59f7ff');
  plainText(ctx, 'WAVE ' + w.wave, FIELD.W / 2, 32, 20, '#cfe9ff', 'center');
  plainText(ctx, 'PODS ' + w.podsHauled, FIELD.W - 24, 66, 16, '#cfe9ff', 'right');
  drawHullIcons(ctx, w);

  // Multiplier + shrinking combo bar.
  if (w.mult > 1 || w.combo > 0) {
    neonText(ctx, 'x' + w.mult, 24, 66, 24, '#ffcf6e');
    ctx.save();
    ctx.fillStyle = 'rgba(255, 207, 110, 0.25)';
    ctx.fillRect(74, 60, 110, 7);
    ctx.fillStyle = '#ffcf6e';
    ctx.fillRect(74, 60, 110 * Math.max(0, w.combo / POD.COMBO_WINDOW), 7);
    ctx.restore();
  }

  // Pulse-blast charge pips.
  plainText(ctx, 'PULSE', 24, FIELD.H - 28, 14, '#7df9ff');
  for (let i = 0; i < BLAST.MAX; i++) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(84 + i * 22, FIELD.H - 28, 7, 0, Math.PI * 2);
    if (i < w.charges) {
      ctx.fillStyle = '#7df9ff';
      ctx.shadowColor = '#7df9ff';
      ctx.shadowBlur = 9;
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(125, 249, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }
  plainText(ctx, 'P PAUSE · M MUTE', FIELD.W - 24, FIELD.H - 28, 13, 'rgba(160,190,220,0.6)', 'right');
}

function drawBanner(ctx, w) {
  if (w.banner <= 0) return;
  const alpha = Math.min(1, w.banner / 0.6);
  neonText(ctx, w.bannerText, FIELD.W / 2, 150, 44, '#ffcf6e', 'center', alpha);
}

function drawTitle(ctx, w) {
  ctx.fillStyle = 'rgba(3, 6, 16, 0.45)';
  ctx.fillRect(0, 0, FIELD.W, FIELD.H);
  neonText(ctx, 'NEON SALVAGE', FIELD.W / 2, 218, 86, '#59f7ff', 'center');
  plainText(
    ctx,
    'Haul cargo pods out of the debris field of a dying star. Dodge the rocks. Chain the combo.',
    FIELD.W / 2,
    292,
    19,
    '#cfe9ff',
    'center',
  );
  const lines = [
    'A/D or ←/→  rotate      W/↑  thrust      S/↓  brake',
    'SPACE  pulse blast      P  pause      M  mute',
    'Mouse: hold to thrust toward the pointer',
    'Pods score 50 × multiplier — chain within 3 s to raise it (max ×8)',
    'Cyan rich pods are worth 250 × — grab them before they blink out',
  ];
  lines.forEach((ln, i) => plainText(ctx, ln, FIELD.W / 2, 372 + i * 32, 17, '#9fc6e8', 'center'));
  const blink = 0.55 + 0.45 * Math.sin(w.time * 4);
  neonText(ctx, 'PRESS ENTER OR CLICK TO LAUNCH', FIELD.W / 2, 596, 24, '#ffcf6e', 'center', blink);
}

function drawGameOver(ctx, w) {
  ctx.fillStyle = 'rgba(12, 3, 10, 0.55)';
  ctx.fillRect(0, 0, FIELD.W, FIELD.H);
  neonText(ctx, 'THE STAR CLAIMS ANOTHER', FIELD.W / 2, 268, 52, '#ff5da2', 'center');
  const rows = [
    ['FINAL SCORE', w.score],
    ['BEST', w.best],
    ['PODS HAULED', w.podsHauled],
    ['WAVES SURVIVED', w.wave],
  ];
  rows.forEach(([label, val], i) => {
    plainText(ctx, label, FIELD.W / 2 - 150, 356 + i * 40, 20, '#9fc6e8', 'right');
    neonText(ctx, String(val), FIELD.W / 2 - 120, 356 + i * 40, 22, '#ffcf6e', 'left');
  });
  const blink = 0.55 + 0.45 * Math.sin(w.time * 4);
  neonText(ctx, 'PRESS R TO FLY AGAIN', FIELD.W / 2, 580, 24, '#59f7ff', 'center', blink);
}

// --- frame --------------------------------------------------------------------

export function draw(ctx, w) {
  ctx.clearRect(0, 0, FIELD.W, FIELD.H);
  drawBackground(ctx, w);

  ctx.save();
  if (w.shake > 0) {
    ctx.translate(Math.sin(w.time * 47) * w.shake * 0.55, Math.cos(w.time * 39) * w.shake * 0.55);
  }
  for (const p of w.pods) drawPod(ctx, w, p);
  for (const r of w.rocks) drawRock(ctx, r);
  drawParticles(ctx, w);
  drawShip(ctx, w);
  ctx.restore();

  // Hit flash.
  if (w.flash > 0) {
    ctx.fillStyle = `rgba(255, 40, 60, ${w.flash * 0.45})`;
    ctx.fillRect(0, 0, FIELD.W, FIELD.H);
  }
  // Low-hull warning vignette.
  if (w.state === 'playing' && w.ship.hull === 1) {
    ctx.strokeStyle = `rgba(255, 50, 70, ${0.35 + 0.2 * Math.sin(w.time * 6)})`;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, FIELD.W - 10, FIELD.H - 10);
  }

  if (w.state === 'title') drawTitle(ctx, w);
  else if (w.state === 'playing') {
    drawHUD(ctx, w);
    drawBanner(ctx, w);
  } else if (w.state === 'over') drawGameOver(ctx, w);
}
