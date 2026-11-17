// WebAudio-synthesized sound effects — no audio files. The context is created
// lazily on the first user gesture (unlockAudio). Every call is wrapped in
// try/catch: audio must never break the game, including in headless renders
// where no audio device exists.

let ctx = null;
let master = null;
let muted = false;
let thrustNodes = null;

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    /* no audio available — stay silent */
  }
}

export function setMuted(m) {
  muted = m;
  try {
    if (master) master.gain.value = m ? 0 : 0.5;
  } catch {
    /* ignore */
  }
}

export function isMuted() {
  return muted;
}

// One oscillator blip with an exponential decay envelope.
function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
  if (!ctx || !master) return;
  try {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    /* ignore */
  }
}

// A burst of filtered noise (explosions, zaps, thruster).
function noiseBurst(dur, vol, filterFreq, delay = 0) {
  if (!ctx || !master) return;
  try {
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  } catch {
    /* ignore */
  }
}

export const sfx = {
  pickup() {
    tone(660, 0.08, 'square', 0.13);
    tone(990, 0.12, 'square', 0.11, null, 0.05);
  },
  rich() {
    [880, 1174, 1568].forEach((f, i) => tone(f, 0.13, 'triangle', 0.15, null, i * 0.06));
  },
  explosion() {
    noiseBurst(0.5, 0.5, 700);
    tone(90, 0.4, 'sawtooth', 0.22, 38);
  },
  blast() {
    tone(1250, 0.25, 'sawtooth', 0.18, 110);
    noiseBurst(0.18, 0.18, 2400);
  },
  wave() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'triangle', 0.15, null, i * 0.07));
  },
  hit() {
    tone(170, 0.2, 'square', 0.24, 55);
    noiseBurst(0.25, 0.32, 480);
  },
  alarm() {
    tone(440, 0.14, 'square', 0.12);
    tone(440, 0.14, 'square', 0.12, null, 0.19);
  },
};

// Looping thruster noise, started/stopped with the thrust state.
export function setThrust(on) {
  if (!ctx || !master) return;
  try {
    if (on && !thrustNodes) {
      const len = ctx.sampleRate;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      const gain = ctx.createGain();
      gain.gain.value = 0.05;
      src.connect(filter).connect(gain).connect(master);
      src.start();
      thrustNodes = { src, gain };
    } else if (!on && thrustNodes) {
      thrustNodes.src.stop();
      thrustNodes = null;
    }
  } catch {
    thrustNodes = null;
  }
}
