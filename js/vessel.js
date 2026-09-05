// Top-down vessel renderer. Layers are concentric discs: first poured = outer ring,
// last poured = center disc. Radii are equal-area by ratio and recompute as steps land.

const SVGNS = 'http://www.w3.org/2000/svg';
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const VESSELS = {
  mug:        { wall: 190, liquid: 164, wallColor: '#3a332a', wallWidth: 10, handle: true },
  demitasse:  { wall: 148, liquid: 126, wallColor: '#3a332a', wallWidth: 9,  handle: true },
  'glass-small': { wall: 158, liquid: 140, wallColor: '#5a5a52', wallWidth: 4, handle: false },
  highball:   { wall: 148, liquid: 130, wallColor: '#5a5a52', wallWidth: 5, handle: false },
  martini:    { wall: 196, liquid: 180, wallColor: '#5a5a52', wallWidth: 3, handle: false },
  margarita:  { wall: 186, liquid: 168, wallColor: '#5a5a52', wallWidth: 4, handle: false },
  copper:     { wall: 168, liquid: 148, wallColor: '#8a5a2e', wallWidth: 9, handle: true },
  rocks:      { wall: 158, liquid: 136, wallColor: '#5a5a52', wallWidth: 9, handle: false },
  bomb:       { wall: 178, liquid: 158, wallColor: '#5a5a52', wallWidth: 5, handle: false },
  wine:       { wall: 182, liquid: 166, wallColor: '#5a5a52', wallWidth: 3, handle: false },
  hurricane:  { wall: 172, liquid: 154, wallColor: '#5a5a52', wallWidth: 5, handle: false },
};

export const STEP_MS = REDUCED ? 60 : 0; // computed per type below
const DUR = REDUCED
  ? new Proxy({}, { get: () => 60 })
  : { espresso: 2300, pour: 1400, froth: 1200, clink: 1000, shake: 1800, fizz: 1700, stir: 1500,
      syrup: 1000, dust: 900, splash: 1000, thud: 800, blip: 600, chime: 900 };

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}
const rnd = (a, b) => a + Math.random() * (b - a);

export function createVessel(container, vesselType) {
  const spec = VESSELS[vesselType] || VESSELS.mug;
  container.innerHTML = '';
  const svg = el('svg', { viewBox: '0 0 400 400', class: 'vessel-svg', role: 'img' });
  const CX = 200, CY = 200;

  const defs = el('defs', {}, svg);
  const clip = el('clipPath', { id: 'liquid-clip' }, defs);
  el('circle', { cx: CX, cy: CY, r: spec.liquid }, clip);

  // drop shadow / counter glow
  el('circle', { cx: CX, cy: CY + 6, r: spec.wall + 8, class: 'vessel-shadow' }, svg);

  const glassG = el('g', { class: 'vessel-glass' }, svg);
  el('circle', { cx: CX, cy: CY, r: spec.wall, fill: 'none', stroke: spec.wallColor, 'stroke-width': spec.wallWidth }, glassG);
  el('circle', { cx: CX, cy: CY, r: spec.wall - spec.wallWidth, fill: '#100e0b' }, glassG);
  if (spec.handle) {
    el('path', { d: `M ${CX + spec.wall - 2} ${CY - 34} A 42 42 0 0 1 ${CX + spec.wall - 2} ${CY + 34}`, fill: 'none', stroke: spec.wallColor, 'stroke-width': spec.wallWidth, 'stroke-linecap': 'round' }, glassG);
  }

  const liquidG = el('g', { class: 'vessel-liquid', 'clip-path': 'url(#liquid-clip)' }, svg);
  const fxG = el('g', { class: 'vessel-fx', 'clip-path': 'url(#liquid-clip)' }, svg);
  const garnishG = el('g', { class: 'vessel-garnish' }, svg);
  container.appendChild(svg);

  const state = { layers: [], iceCubes: [], shotEl: null, finished: false };

  function radii() {
    const total = state.layers.reduce((s, l) => s + (l.step.ratio || 0), 0) || 1;
    let rem = total;
    return state.layers.map(l => {
      const R = spec.liquid * Math.sqrt(rem / total);
      rem -= (l.step.ratio || 0);
      return R;
    });
  }

  function layout(animate = true) {
    const Rs = radii();
    state.layers.forEach((l, i) => {
      const target = Math.max(Rs[i], 0.1);
      if (animate && !REDUCED) {
        l.node.style.transition = 'r 1.1s cubic-bezier(.22,1,.36,1)';
      } else {
        l.node.style.transition = 'none';
      }
      l.node.style.r = target;
    });
  }

  function addLiquidLayer(step) {
    const node = el('circle', {
      cx: CX, cy: CY, r: 0,
      fill: step.color,
      stroke: step.edge || 'none',
      'stroke-width': step.edge ? 3 : 0,
      class: 'layer layer-' + step.type,
    }, liquidG);
    state.layers.push({ step, node });
    // grow new disc from center, then settle all radii
    requestAnimationFrame(() => requestAnimationFrame(() => layout(true)));
    return node;
  }

  function dropIceCubes(count, big = false) {
    for (let i = 0; i < count; i++) {
      const size = big ? 64 : rnd(30, 42);
      const ang = rnd(0, Math.PI * 2), dist = rnd(0, spec.liquid - size);
      const x = CX + Math.cos(ang) * dist - size / 2;
      const y = CY + Math.sin(ang) * dist - size / 2;
      const cube = el('rect', {
        x, y, width: size, height: size, rx: big ? 14 : 8,
        class: 'ice-cube', transform: `rotate(${rnd(-18, 18)} ${x + size / 2} ${y + size / 2})`,
      }, fxG);
      cube.style.animationDelay = `${i * 0.12}s`;
      state.iceCubes.push(cube);
    }
  }

  function bubbles(count = 22) {
    for (let i = 0; i < count; i++) {
      const ang = rnd(0, Math.PI * 2), dist = rnd(0, spec.liquid * 0.9);
      el('circle', {
        cx: CX + Math.cos(ang) * dist, cy: CY + Math.sin(ang) * dist,
        r: rnd(1.5, 4.5), class: 'bubble',
      }, fxG).style.animationDelay = `${rnd(0, 1.2)}s`;
    }
  }

  function sprinkle(color, count = 34) {
    for (let i = 0; i < count; i++) {
      const ang = rnd(0, Math.PI * 2), dist = rnd(0, spec.liquid * 0.8);
      el('circle', {
        cx: CX + Math.cos(ang) * dist, cy: CY + Math.sin(ang) * dist,
        r: rnd(1.2, 2.6), fill: color, class: 'sprinkle',
      }, fxG).style.animationDelay = `${rnd(0, 0.7)}s`;
    }
  }

  function rosetta(color) {
    // zigzag leaves + pull-through, drawn on the center disc
    const w = spec.liquid * 0.62;
    let d = `M ${CX} ${CY + w * 0.72}`;
    const n = 6;
    for (let i = 1; i <= n; i++) {
      const y = CY + w * 0.72 - (i * w * 1.3) / n;
      const x = CX + (i % 2 ? -1 : 1) * (w * 0.34) * (1 - i / (n + 2));
      d += ` Q ${CX + (i % 2 ? -1 : 1) * w * 0.5} ${y + w * 0.1}, ${x} ${y}`;
    }
    const leaves = el('path', { d, fill: 'none', stroke: color, 'stroke-width': 7, 'stroke-linecap': 'round', class: 'latte-art' }, fxG);
    const pull = el('path', { d: `M ${CX} ${CY + w * 0.8} L ${CX} ${CY - w * 0.72}`, fill: 'none', stroke: color, 'stroke-width': 4, 'stroke-linecap': 'round', class: 'latte-art' }, fxG);
    [leaves, pull].forEach(p => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        p.style.transition = 'stroke-dashoffset 1.4s ease';
        p.style.strokeDashoffset = 0;
      }));
    });
  }

  function syrupRings(color) {
    [0.55, 0.3].forEach((f, i) => {
      const r = spec.liquid * f;
      const ring = el('circle', { cx: CX, cy: CY, r: 0, fill: 'none', stroke: color, 'stroke-width': 5, class: 'syrup-ring', opacity: 0.85 }, fxG);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        ring.style.transition = `r 0.7s ${i * 0.15}s cubic-bezier(.22,1,.36,1)`;
        ring.style.r = r;
      }));
    });
  }

  function dollop(color, scale = 0.34) {
    const d = el('circle', { cx: CX, cy: CY, r: 0, fill: color, class: 'dollop' }, fxG);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      d.style.transition = 'r 0.6s cubic-bezier(.34,1.56,.64,1)';
      d.style.r = spec.liquid * scale;
    }));
  }

  function saltRim() {
    el('circle', {
      cx: CX, cy: CY, r: spec.wall - spec.wallWidth / 2, fill: 'none',
      stroke: '#f0ead8', 'stroke-width': spec.wallWidth + 2, 'stroke-dasharray': '3 6', class: 'salt-rim',
    }, garnishG);
  }

  function garnish(kind) {
    const ang = -Math.PI / 4, gr = spec.liquid * 0.92;
    const gx = CX + Math.cos(ang) * gr, gy = CY + Math.sin(ang) * gr;
    const g = el('g', { class: 'garnish garnish-' + kind }, garnishG);
    if (kind === 'garnish-lime') {
      el('circle', { cx: gx, cy: gy, r: 26, fill: '#9ec24a', stroke: '#d8e8a8', 'stroke-width': 4 }, g);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        el('line', { x1: gx, y1: gy, x2: gx + Math.cos(a) * 22, y2: gy + Math.sin(a) * 22, stroke: '#d8e8a8', 'stroke-width': 3 }, g);
      }
    } else if (kind === 'garnish-orange') {
      el('circle', { cx: gx, cy: gy, r: 26, fill: '#e8963a', stroke: '#f4c88a', 'stroke-width': 4 }, g);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        el('line', { x1: gx, y1: gy, x2: gx + Math.cos(a) * 22, y2: gy + Math.sin(a) * 22, stroke: '#f4c88a', 'stroke-width': 3 }, g);
      }
    } else if (kind === 'garnish-mint') {
      for (let i = 0; i < 3; i++) {
        el('ellipse', {
          cx: gx + rnd(-14, 14), cy: gy + rnd(-14, 14), rx: 16, ry: 8,
          fill: '#4a7a3a', transform: `rotate(${rnd(0, 180)} ${gx} ${gy})`,
        }, g);
      }
    } else if (kind === 'garnish-olive') {
      el('line', { x1: gx - 34, y1: gy - 20, x2: gx + 34, y2: gy + 20, stroke: '#c8b888', 'stroke-width': 3 }, g);
      el('circle', { cx: gx, cy: gy, r: 13, fill: '#7a8a3a' }, g);
      el('circle', { cx: gx, cy: gy, r: 5, fill: '#c85a3a' }, g);
    } else if (kind === 'garnish-cherry') {
      el('path', { d: `M ${gx - 4} ${gy - 24} Q ${gx + 8} ${gy - 32} ${gx + 14} ${gy - 20}`, fill: 'none', stroke: '#6a4a2a', 'stroke-width': 3 }, g);
      el('circle', { cx: gx, cy: gy, r: 13, fill: '#a81c2a', stroke: '#6e1018', 'stroke-width': 2 }, g);
      el('circle', { cx: gx - 4, cy: gy - 4, r: 4, fill: '#d86a72' }, g);
    }
    // straw for tall drinks
    if (kind === 'straw') {
      el('rect', { x: CX + spec.liquid * 0.4, y: CY - spec.liquid - 30, width: 12, height: spec.liquid * 1.4, rx: 6, fill: '#c6f24e', transform: `rotate(18 ${CX} ${CY})` }, g);
    }
  }

  function sugarCube() {
    const s = el('rect', { x: CX - 14, y: CY - 14, width: 28, height: 28, rx: 4, fill: '#f0ead8', class: 'sugar-cube' }, fxG);
    setTimeout(() => { s.style.transition = 'opacity .8s, transform .8s'; s.style.opacity = 0.25; s.style.transform = 'scale(0.7)'; s.style.transformOrigin = 'center'; }, REDUCED ? 30 : 500);
  }

  function shotGlassDrop() {
    // shot glass hovers above, then drops in
    const g = el('g', { class: 'shot-glass' }, fxG);
    el('circle', { cx: CX, cy: CY, r: 62, fill: 'none', stroke: '#5a5a52', 'stroke-width': 5 }, g);
    el('circle', { cx: CX, cy: CY, r: 54, fill: '#3a1c10' }, g);
    g.style.transform = 'translateY(-420px)';
    g.style.transition = 'none';
    state.shotEl = g;
    return g;
  }
  function dropShot() {
    if (!state.shotEl) return;
    const g = state.shotEl;
    requestAnimationFrame(() => {
      g.style.transition = 'transform .45s cubic-bezier(.55,-0.2,.7,1.2)';
      g.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      // splash rings
      [0.5, 0.75].forEach((f, i) => {
        const ring = el('circle', { cx: CX, cy: CY, r: 62, fill: 'none', stroke: '#c8d44a', 'stroke-width': 3, opacity: 0.8 }, fxG);
        ring.style.transition = `r .6s ${i * 0.1}s ease-out, opacity .6s ${i * 0.1}s`;
        requestAnimationFrame(() => requestAnimationFrame(() => { ring.style.r = spec.liquid * f; ring.style.opacity = 0; }));
      });
      // darken outer liquid slightly (mixed)
      if (state.layers[0]) state.layers[0].node.style.fill = '#8a8a2a';
    }, REDUCED ? 60 : 480);
  }

  function shakeVessel() {
    svg.classList.add('shaking');
    setTimeout(() => svg.classList.remove('shaking'), REDUCED ? 80 : 1500);
  }
  function stirSwirl() {
    const sw = el('g', { class: 'swirl' }, fxG);
    for (let i = 0; i < 3; i++) {
      el('path', {
        d: `M ${CX - spec.liquid * (0.3 + i * 0.2)} ${CY} A ${spec.liquid * (0.3 + i * 0.2)} ${spec.liquid * (0.3 + i * 0.2)} 0 0 1 ${CX + spec.liquid * (0.3 + i * 0.2)} ${CY}`,
        fill: 'none', stroke: 'rgba(242,236,225,.35)', 'stroke-width': 3, 'stroke-linecap': 'round',
      }, sw);
    }
    sw.style.transformOrigin = 'center';
    sw.style.transition = 'transform 1.3s ease, opacity 1.3s';
    requestAnimationFrame(() => requestAnimationFrame(() => { sw.style.transform = 'rotate(540deg)'; sw.style.opacity = 0; }));
    setTimeout(() => sw.remove(), REDUCED ? 100 : 1500);
  }

  const api = {
    el: svg,
    reset() { state.layers = []; state.iceCubes = []; state.shotEl = null; state.finished = false; liquidG.innerHTML = ''; fxG.innerHTML = ''; garnishG.innerHTML = ''; },
    // returns animation duration in ms
    addStep(step) {
      const t = step.type;
      switch (t) {
        case 'espresso': addLiquidLayer(step); return DUR.espresso;
        case 'milk': case 'water': case 'spirit': case 'juice': case 'coldbrew': case 'strain':
          addLiquidLayer(step); return DUR.pour;
        case 'foam': case 'frappefoam': addLiquidLayer(step); bubbles(10); return DUR.froth;
        case 'ice': dropIceCubes(6); return DUR.clink;
        case 'iceblock': dropIceCubes(1, true); return DUR.clink;
        case 'shake': shakeVessel(); return DUR.shake;
        case 'stir': stirSwirl(); return DUR.stir;
        case 'fizz': addLiquidLayer(step); bubbles(24); return DUR.fizz;
        case 'syrup': addLiquidLayer(step); syrupRings(step.color); return DUR.syrup;
        case 'sugar': sugarCube(); return DUR.dust;
        case 'art': rosetta(step.color); return DUR.chime;
        case 'rim': saltRim(); return DUR.dust;
        case 'scoop': dollop(step.color, 0.5); return DUR.thud;
        case 'shotglass': shotGlassDrop(); return DUR.pour;
        case 'drop': dropShot(); return DUR.splash;
        case 'garnish-lime': case 'garnish-orange': case 'garnish-mint': case 'garnish-olive': case 'garnish-cherry':
          garnish(t); return DUR.blip;
        default: addLiquidLayer(step); return DUR.pour;
      }
    },
    addAddon(addon) {
      switch (addon.visual) {
        case 'sprinkle': sprinkle(addon.color); return DUR.dust;
        case 'dust': sprinkle(addon.color, 20); return DUR.dust;
        case 'dollop': dollop(addon.color, 0.34); return DUR.froth;
        case 'scoop': dollop(addon.color, 0.42); return DUR.thud;
        case 'syrup': syrupRings(addon.color); return DUR.syrup;
        case 'shot': { // darken center
          const d = el('circle', { cx: CX, cy: CY, r: 0, fill: addon.color, opacity: 0.9 }, fxG);
          requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transition = 'r .8s cubic-bezier(.22,1,.36,1)'; d.style.r = spec.liquid * 0.3; }));
          return DUR.espresso;
        }
        case 'tag': return DUR.blip;
        default: return DUR.blip;
      }
    },
    finish() {
      state.finished = true;
      svg.classList.add('finished');
    },
    unfinish() { state.finished = false; svg.classList.remove('finished'); },
  };
  return api;
}
