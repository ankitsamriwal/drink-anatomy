// Synthesized sound design - no audio assets, everything is Web Audio.
// Hyper-real ASMR direction: per-liquid pour textures, real ice physics,
// steam under hot pours, carbonation crackle tails.

let ctx = null, master = null, muted = localStorage.getItem('aod-muted') === '1';

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.55;
    // gentle glue: keeps layered ASMR textures from clipping
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 22; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.24;
    master.connect(comp).connect(ctx.destination);
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

// ---- shared textures ----

// airy steam hiss (hot liquid meeting air)
function steamHiss(c, t, dur, peak = 0.05) {
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5200;
  const g = c.createGain(); env(g, t, dur * 0.4, peak, dur * 0.6);
  src.connect(hp).connect(g).connect(master); src.start(t); src.stop(t + dur + 0.1);
}

// discrete bottle-glug events (thick liquids)
function glugs(c, t, dur, count, base = 110, peak = 0.12) {
  for (let i = 0; i < count; i++) {
    const dt = (i / count) * dur * (0.75 + Math.random() * 0.3);
    const o = c.createOscillator(); o.type = 'sine';
    const f = base * (0.9 + Math.random() * 0.25);
    o.frequency.setValueAtTime(f, t + dt);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t + dt + 0.09);
    const g = c.createGain(); env(g, t + dt, 0.008, peak, 0.1);
    o.connect(g).connect(master); o.start(t + dt); o.stop(t + dt + 0.15);
  }
}

// tiny carbonation pops, decaying density
function crackle(c, t, dur, count, peak = 0.05) {
  for (let i = 0; i < count; i++) {
    const dt = Math.pow(Math.random(), 1.6) * dur; // denser early
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.value = 2600 + Math.random() * 4600;
    const g = c.createGain(); env(g, t + dt, 0.002, peak * (0.5 + Math.random() * 0.5), 0.03);
    o.connect(g).connect(master); o.start(t + dt); o.stop(t + dt + 0.05);
  }
}

// one ice cube striking glass: transient crack + metallic ping + glass ring + thunk
function iceImpact(c, t, hard = 1) {
  // crack transient
  const n = c.createBufferSource(); n.buffer = noise(c);
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4200;
  const ng = c.createGain(); env(ng, t, 0.002, 0.14 * hard, 0.03);
  n.connect(hp).connect(ng).connect(master); n.start(t); n.stop(t + 0.05);
  // metallic body (detuned partials)
  [1, 2.76].forEach((m, i) => {
    const o = c.createOscillator(); o.type = 'triangle';
    const f = (1700 + Math.random() * 900) * m;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.82, t + 0.07);
    const g = c.createGain(); env(g, t, 0.003, (i ? 0.05 : 0.13) * hard, i ? 0.1 : 0.14);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.22);
  });
  // glass ring
  const ring = c.createOscillator(); ring.type = 'sine';
  ring.frequency.value = 2500 + Math.random() * 700;
  const rg = c.createGain(); env(rg, t + 0.012, 0.004, 0.045 * hard, 0.4, 0.0001);
  ring.connect(rg).connect(master); ring.start(t + 0.012); ring.stop(t + 0.5);
  // low thunk against the wall
  const th = c.createOscillator(); th.type = 'sine';
  th.frequency.setValueAtTime(210, t); th.frequency.exponentialRampToValueAtTime(95, t + 0.09);
  const tg = c.createGain(); env(tg, t, 0.004, 0.1 * hard, 0.1);
  th.connect(tg).connect(master); th.start(t); th.stop(t + 0.16);
}

// ice crackling as it chills (thermal stress ticks)
function iceCrackle(c, t, dur = 1.2) {
  const n = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const dt = Math.random() * dur;
    const src = c.createBufferSource(); src.buffer = noise(c);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3400 + Math.random() * 2400; bp.Q.value = 3;
    const g = c.createGain(); env(g, t + dt, 0.002, 0.045, 0.025);
    src.connect(bp).connect(g).connect(master); src.start(t + dt); src.stop(t + dt + 0.05);
  }
}

// ---- step sounds ----

// Espresso extraction: pump rumble + pressurized hiss that tightens, then dripping tail
export function espresso(dur = 2.2, opts = {}) {
  if (muted) return; const c = ac(), t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(900, t); bp.frequency.linearRampToValueAtTime(2400, t + dur);
  const g = c.createGain(); env(g, t, 0.15, 0.42, dur);
  src.connect(bp).connect(g).connect(master); src.start(t); src.stop(t + dur + 0.1);
  // pump
  const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = 55;
  const og = c.createGain(); env(og, t, 0.1, 0.16, dur);
  osc.connect(og).connect(master); osc.start(t); osc.stop(t + dur + 0.1);
  // steam around the pull
  steamHiss(c, t + dur * 0.15, dur * 0.85, 0.045);
  // dripping tail as the pull finishes
  for (let i = 0; i < 4; i++) {
    const dt = dur * 0.72 + i * (0.09 + Math.random() * 0.07);
    const o = c.createOscillator(); o.type = 'sine';
    const f = 1150 - i * 160 + Math.random() * 120;
    o.frequency.setValueAtTime(f, t + dt);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, t + dt + 0.05);
    const dg = c.createGain(); env(dg, t + dt, 0.003, 0.09 - i * 0.015, 0.06);
    o.connect(dg).connect(master); o.start(t + dt); o.stop(t + dt + 0.12);
  }
}

// Liquid pour - texture varies by liquid kind
export function pour(dur = 1.3, opts = {}) {
  if (muted) return; const c = ac(), t = c.currentTime;
  const kind = opts.type || 'spirit';
  const P = {
    milk:     { f: 850,  q: 0.8, lfoF: 5.5, lfoD: 0.13, peak: 0.4,  glugN: 3, glugB: 95,  glugP: 0.1,  body: 320 },
    water:    { f: 1150, q: 0.6, lfoF: 8,   lfoD: 0.17, peak: 0.34, glugN: 2, glugB: 140, glugP: 0.06, body: 0 },
    spirit:   { f: 1500, q: 0.7, lfoF: 10,  lfoD: 0.2,  peak: 0.3,  glugN: 2, glugB: 130, glugP: 0.06, body: 0 },
    strain:   { f: 1350, q: 0.7, lfoF: 9,   lfoD: 0.18, peak: 0.32, glugN: 2, glugB: 120, glugP: 0.07, body: 0 },
    juice:    { f: 780,  q: 0.8, lfoF: 7,   lfoD: 0.16, peak: 0.4,  glugN: 3, glugB: 105, glugP: 0.1,  body: 380 },
    coldbrew: { f: 460,  q: 0.9, lfoF: 4.5, lfoD: 0.22, peak: 0.42, glugN: 4, glugB: 80,  glugP: 0.13, body: 240 },
  }[kind] || { f: 900, q: 0.7, lfoF: 8, lfoD: 0.16, peak: 0.36, glugN: 2, glugB: 120, glugP: 0.08, body: 0 };

  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = P.q;
  lp.frequency.setValueAtTime(P.f * 0.75, t);
  lp.frequency.linearRampToValueAtTime(P.f * 1.15, t + dur * 0.5);
  lp.frequency.linearRampToValueAtTime(P.f * 0.9, t + dur);
  const g = c.createGain(); env(g, t, 0.08, P.peak, dur);
  const lfo = c.createOscillator(); lfo.frequency.value = P.lfoF;
  const lg = c.createGain(); lg.gain.value = P.lfoD;
  lfo.connect(lg).connect(g.gain);
  src.connect(lp).connect(g).connect(master); src.start(t); src.stop(t + dur + 0.1);
  lfo.start(t); lfo.stop(t + dur + 0.1);

  if (P.body) { // creamy low body for milk / juice / cold brew
    const b = c.createBufferSource(); b.buffer = noise(c); b.loop = true;
    const bf = c.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = P.body; bf.Q.value = 1.4;
    const bg = c.createGain(); env(bg, t, 0.1, 0.12, dur);
    b.connect(bf).connect(bg).connect(master); b.start(t); b.stop(t + dur + 0.1);
  }
  glugs(c, t + 0.1, dur * 0.8, P.glugN, P.glugB, P.glugP);
  if (kind === 'milk') { // steamed-milk silk
    const s = c.createBufferSource(); s.buffer = noise(c); s.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3600;
    const sg = c.createGain(); env(sg, t, 0.14, 0.05, dur);
    s.connect(hp).connect(sg).connect(master); s.start(t); s.stop(t + dur + 0.1);
    if (opts.temp === 'hot') steamHiss(c, t, dur, 0.04);
  }
  if (kind === 'coldbrew' && opts.temp === 'hot') steamHiss(c, t, dur, 0.045); // brewed coffee, hot
  if (kind === 'water' && opts.temp === 'hot') steamHiss(c, t, dur, 0.05); // tea / americano top-up
}

// Milk froth / steam wand: pitch-swept airy hiss + milk body + micro bubbles
export function froth(dur = 1.1, opts = {}) {
  if (muted) return; const c = ac(), t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(2600, t);
  bp.frequency.linearRampToValueAtTime(1700, t + dur);
  const g = c.createGain(); env(g, t, 0.12, 0.2, dur);
  src.connect(bp).connect(g).connect(master); src.start(t); src.stop(t + dur + 0.1);
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
  const hg = c.createGain(); env(hg, t, 0.1, 0.07, dur);
  src.connect(hp).connect(hg).connect(master);
  if (opts.temp === 'hot') steamHiss(c, t + dur * 0.5, dur * 0.9, 0.04);
  crackle(c, t + dur * 0.4, dur * 0.6, 6, 0.03);
}

// Ice into the glass: distinct impacts, glass ring, thermal crackle
export function clink() {
  if (muted) return; const c = ac(), t = c.currentTime;
  const n = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) iceImpact(c, t + i * (0.1 + Math.random() * 0.08), 1 - i * 0.15);
  iceCrackle(c, t + 0.25, 1.4);
}

// Cobbler shaker: tin thumps, ice rattling inside, liquid swish
export function shake(dur = 1.6) {
  if (muted) return; const c = ac(), t = c.currentTime;
  const hits = [0, 0.18, 0.36, 0.62, 0.8, 0.98, 1.24, 1.42];
  // liquid swish following the rhythm
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
  const sg = c.createGain(); sg.gain.setValueAtTime(0.0001, t);
  hits.forEach(dt => {
    sg.gain.linearRampToValueAtTime(0.1, t + dt + 0.04);
    sg.gain.linearRampToValueAtTime(0.02, t + dt + 0.14);
  });
  src.connect(bp).connect(sg).connect(master); src.start(t); src.stop(t + dur + 0.1);

  hits.forEach((dt, i) => {
    // tin body thump
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(230, t + dt); o.frequency.exponentialRampToValueAtTime(140, t + dt + 0.07);
    const og = c.createGain(); env(og, t + dt, 0.004, i % 2 ? 0.14 : 0.2, 0.09);
    o.connect(og).connect(master); o.start(t + dt); o.stop(t + dt + 0.14);
    // ice hitting tin
    const ns = c.createBufferSource(); ns.buffer = noise(c);
    const hf = c.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 3400; hf.Q.value = 0.8;
    const ng = c.createGain(); env(ng, t + dt, 0.006, i % 2 ? 0.24 : 0.34, 0.09);
    ns.connect(hf).connect(ng).connect(master); ns.start(t + dt); ns.stop(t + dt + 0.13);
    // rattle: 2-3 small ticks right after
    for (let r = 0; r < 3; r++) {
      const rt = dt + 0.05 + r * (0.03 + Math.random() * 0.02);
      const ro = c.createOscillator(); ro.type = 'triangle'; ro.frequency.value = 3800 + Math.random() * 1600;
      const rg = c.createGain(); env(rg, t + rt, 0.002, 0.05, 0.03);
      ro.connect(rg).connect(master); ro.start(t + rt); ro.stop(t + rt + 0.05);
    }
  });
}

// Soda / tonic / ginger beer: pour body + hiss + long crackle tail
export function fizz(dur = 1.6) {
  if (muted) return; const c = ac(), t = c.currentTime;
  // pour body
  const p = c.createBufferSource(); p.buffer = noise(c); p.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 950;
  const pg = c.createGain(); env(pg, t, 0.07, 0.2, dur * 0.55);
  p.connect(lp).connect(pg).connect(master); p.start(t); p.stop(t + dur);
  glugs(c, t + 0.08, dur * 0.45, 2, 150, 0.05);
  // carbonation hiss
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4500;
  const g = c.createGain(); env(g, t, 0.1, 0.18, dur + 1.2, 0.0001);
  src.connect(hp).connect(g).connect(master); src.start(t); src.stop(t + dur + 1.4);
  crackle(c, t, dur + 2.2, 34, 0.05);
  iceCrackle(c, t + 0.3, 1.2);
}

// Stirred: swirling liquid around the glass, spoon ticks, ice nudges
export function stir(dur = 1.4) {
  if (muted) return; const c = ac(), t = c.currentTime;
  // continuous swirl
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
  bp.frequency.setValueAtTime(520, t);
  const lfo = c.createOscillator(); lfo.frequency.value = 1.6;
  const lg = c.createGain(); lg.gain.value = 260;
  lfo.connect(lg).connect(bp.frequency);
  const g = c.createGain(); env(g, t, 0.12, 0.12, dur);
  let pan = null;
  if (c.createStereoPanner) {
    pan = c.createStereoPanner();
    const plfo = c.createOscillator(); plfo.frequency.value = 0.8;
    const plg = c.createGain(); plg.gain.value = 0.7;
    plfo.connect(plg).connect(pan.pan);
    plfo.start(t); plfo.stop(t + dur + 0.1);
    src.connect(bp).connect(g).connect(pan).connect(master);
  } else {
    src.connect(bp).connect(g).connect(master);
  }
  src.start(t); src.stop(t + dur + 0.1);
  lfo.start(t); lfo.stop(t + dur + 0.1);
  // spoon on glass
  for (let i = 0; i < 3; i++) {
    const dt = (i + 0.5) * dur / 3 + Math.random() * 0.06;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 3200 + Math.random() * 600;
    const sg = c.createGain(); env(sg, t + dt, 0.002, 0.05, 0.14);
    o.connect(sg).connect(master); o.start(t + dt); o.stop(t + dt + 0.2);
  }
  // ice nudges
  for (let i = 0; i < 2; i++) iceImpact(c, t + (i + 0.7) * dur / 2.4, 0.4);
}

// Syrup: slow thick drizzle with heavy glugs
export function syrup(dur = 0.9) {
  if (muted) return; const c = ac(), t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
  const g = c.createGain(); env(g, t, 0.1, 0.3, dur);
  const lfo = c.createOscillator(); lfo.frequency.value = 3;
  const lg = c.createGain(); lg.gain.value = 0.22;
  lfo.connect(lg).connect(g.gain);
  src.connect(lp).connect(g).connect(master); src.start(t); src.stop(t + dur + 0.1);
  lfo.start(t); lfo.stop(t + dur + 0.1);
  glugs(c, t + 0.15, dur * 0.7, 2, 70, 0.14);
}

// Powder dusting: soft papery scatter + tiny shaker taps
export function dust(dur = 0.7) {
  if (muted) return; const c = ac(), t = c.currentTime;
  for (let i = 0; i < 3; i++) { // shaker taps
    const dt = i * dur / 3;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 900;
    const g = c.createGain(); env(g, t + dt, 0.003, 0.05, 0.05);
    o.connect(g).connect(master); o.start(t + dt); o.stop(t + dt + 0.08);
  }
  for (let i = 0; i < 12; i++) {
    const dt = Math.random() * dur;
    const src = c.createBufferSource(); src.buffer = noise(c);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    const g = c.createGain(); env(g, t + dt, 0.003, 0.045, 0.04);
    src.connect(hp).connect(g).connect(master); src.start(t + dt); src.stop(t + dt + 0.06);
  }
}

// Splash (jagerbomb drop): noise burst + low thump + fizzing aftermath
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
  crackle(c, t + 0.15, 1.6, 20, 0.045);
}

// Scoop / thud: body + a soft high click
export function thud() {
  if (muted) return; const c = ac(), t = c.currentTime;
  const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.22);
  const g = c.createGain(); env(g, t, 0.006, 0.5, 0.28);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.35);
  const k = c.createOscillator(); k.type = 'triangle'; k.frequency.value = 950;
  const kg = c.createGain(); env(kg, t, 0.002, 0.07, 0.05);
  k.connect(kg).connect(master); k.start(t); k.stop(t + 0.08);
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
export function play(name, opts = {}) { const f = SOUNDS[name]; if (f) f(undefined, opts); }
