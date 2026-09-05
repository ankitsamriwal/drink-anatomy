// Synthesized sound design - no audio assets, everything is Web Audio.
let ctx = null, master = null, muted = localStorage.getItem('aod-muted') === '1';

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function isMuted() { return muted; }
export function setMuted(m) { muted = m; localStorage.setItem('aod-muted', m ? '1' : '0'); if (master) master.gain.value = m ? 0 : 0.55; }

function noiseBuffer(c, seconds = 2) {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
let _noise = null;
function noise(c) { if (!_noise) _noise = noiseBuffer(c); return _noise; }

function env(g, t0, a, peak, d, sustain = 0.0001) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t0 + a + d);
}

// Espresso extraction: pump rumble + pressurized hiss that tightens as the pull finishes
export function espresso(dur = 2.2) {
  if (muted) return; const c = ac(), t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(900, t); bp.frequency.linearRampToValueAtTime(2400, t + dur);
  const g = c.createGain(); env(g, t, 0.15, 0.5, dur);
  src.connect(bp).connect(g).connect(master); src.start(t); src.stop(t + dur + 0.1);
  const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = 55;
  const og = c.createGain(); env(og, t, 0.1, 0.18, dur);
  osc.connect(og).connect(master); osc.start(t); osc.stop(t + dur + 0.1);
}

// Liquid pour: low rumble noise with a glug LFO
export function pour(dur = 1.3) {
  if (muted) return; const c = ac(), t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
  const g = c.createGain(); env(g, t, 0.08, 0.42, dur);
  const lfo = c.createOscillator(); lfo.frequency.value = 9;
  const lg = c.createGain(); lg.gain.value = 0.16;
  lfo.connect(lg).connect(g.gain);
  src.connect(lp).connect(g).connect(master); src.start(t); src.stop(t + dur + 0.1);
  lfo.start(t); lfo.stop(t + dur + 0.1);
}

// Milk froth / steam: airy high noise
export function froth(dur = 1.1) {
  if (muted) return; const c = ac(), t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2800;
  const g = c.createGain(); env(g, t, 0.12, 0.22, dur);
  src.connect(hp).connect(g).connect(master); src.start(t); src.stop(t + dur + 0.1);
}

// Ice clink: metallic FM ping
export function clink() {
  if (muted) return; const c = ac(), t = c.currentTime;
  [0, 0.09, 0.21].forEach((dt, i) => {
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.value = [2350, 3100, 2700][i] * (0.95 + Math.random() * 0.1);
    const g = c.createGain(); env(g, t + dt, 0.004, 0.16, 0.16);
    o.connect(g).connect(master); o.start(t + dt); o.stop(t + dt + 0.25);
  });
}

// Shaker: rhythmic cha-cha-cha
export function shake(dur = 1.6) {
  if (muted) return; const c = ac(), t = c.currentTime;
  const hits = [0, 0.18, 0.36, 0.62, 0.8, 0.98, 1.24, 1.42];
  hits.forEach((dt, i) => {
    const src = c.createBufferSource(); src.buffer = noise(c);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.8;
    const g = c.createGain(); env(g, t + dt, 0.008, i % 2 ? 0.3 : 0.42, 0.1);
    src.connect(bp).connect(g).connect(master); src.start(t + dt); src.stop(t + dt + 0.15);
  });
}

// Soda / tonic / ginger beer fizz
export function fizz(dur = 1.6) {
  if (muted) return; const c = ac(), t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4500;
  const g = c.createGain(); env(g, t, 0.1, 0.2, dur);
  src.connect(hp).connect(g).connect(master); src.start(t); src.stop(t + dur + 0.1);
  for (let i = 0; i < 14; i++) {
    const dt = Math.random() * dur;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 3000 + Math.random() * 4000;
    const pg = c.createGain(); env(pg, t + dt, 0.002, 0.05, 0.03);
    o.connect(pg).connect(master); o.start(t + dt); o.stop(t + dt + 0.05);
  }
}

// Stirred: ice swirling in a glass
export function stir(dur = 1.4) {
  if (muted) return; const c = ac(), t = c.currentTime;
  for (let i = 0; i < 6; i++) {
    const dt = (i / 6) * dur + Math.random() * 0.05;
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 1800 + Math.random() * 1200;
    const g = c.createGain(); env(g, t + dt, 0.005, 0.08, 0.12);
    o.connect(g).connect(master); o.start(t + dt); o.stop(t + dt + 0.2);
  }
}

// Syrup: slow thick drizzle
export function syrup(dur = 0.9) {
  if (muted) return; const c = ac(), t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
  const g = c.createGain(); env(g, t, 0.1, 0.3, dur);
  src.connect(lp).connect(g).connect(master); src.start(t); src.stop(t + dur + 0.1);
}

// Powder dusting: soft papery scatter
export function dust(dur = 0.7) {
  if (muted) return; const c = ac(), t = c.currentTime;
  for (let i = 0; i < 10; i++) {
    const dt = Math.random() * dur;
    const src = c.createBufferSource(); src.buffer = noise(c);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    const g = c.createGain(); env(g, t + dt, 0.003, 0.05, 0.04);
    src.connect(hp).connect(g).connect(master); src.start(t + dt); src.stop(t + dt + 0.06);
  }
}

// Splash (jagerbomb drop): noise burst + low thump
export function splash() {
  if (muted) return; const c = ac(), t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noise(c);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
  const g = c.createGain(); env(g, t, 0.005, 0.5, 0.35);
  src.connect(lp).connect(g).connect(master); src.start(t); src.stop(t + 0.5);
  const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.3);
  const og = c.createGain(); env(og, t, 0.005, 0.4, 0.35);
  o.connect(og).connect(master); o.start(t); o.stop(t + 0.45);
}

// Scoop / thud
export function thud() {
  if (muted) return; const c = ac(), t = c.currentTime;
  const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.22);
  const g = c.createGain(); env(g, t, 0.006, 0.5, 0.28);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.35);
}

// Finish chime
export function chime() {
  if (muted) return; const c = ac(), t = c.currentTime;
  [523.25, 784.99].forEach((f, i) => {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = c.createGain(); env(g, t + i * 0.12, 0.01, 0.14, 0.9);
    o.connect(g).connect(master); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 1);
  });
}

// UI blip
export function blip() {
  if (muted) return; const c = ac(), t = c.currentTime;
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 660;
  const g = c.createGain(); env(g, t, 0.004, 0.08, 0.09);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.12);
}

export const SOUNDS = { espresso, pour, froth, clink, shake, fizz, stir, syrup, dust, splash, thud, chime, blip };
export function play(name) { const f = SOUNDS[name]; if (f) f(); }
