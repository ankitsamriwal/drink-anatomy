// Top-down vessel renderer. Layers are concentric discs: first poured = outer ring,
// last poured = center disc. Radii are equal-area by ratio and recompute as steps land.
// Rendering aims for hyper-real: graded liquid surfaces with meniscus, organic wobble,
// specular sheen, ripples, steam off hot drinks, condensation on cold glass, refractive ice.

const SVGNS = 'http://www.w3.org/2000/svg';
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const VESSELS = {
  mug:        { wall: 190, liquid: 164, wallColor: '#3a332a', wallWidth: 10, handle: true,  material: 'ceramic' },
  demitasse:  { wall: 148, liquid: 126, wallColor: '#3a332a', wallWidth: 9,  handle: true,  material: 'ceramic' },
  'glass-small': { wall: 158, liquid: 140, wallColor: '#5a5a52', wallWidth: 4, handle: false, material: 'glass' },
  highball:   { wall: 148, liquid: 130, wallColor: '#5a5a52', wallWidth: 5, handle: false, material: 'glass' },
  martini:    { wall: 196, liquid: 180, wallColor: '#5a5a52', wallWidth: 3, handle: false, material: 'glass' },
  margarita:  { wall: 186, liquid: 168, wallColor: '#5a5a52', wallWidth: 4, handle: false, material: 'glass' },
  copper:     { wall: 168, liquid: 148, wallColor: '#8a5a2e', wallWidth: 9, handle: true,  material: 'copper' },
  rocks:      { wall: 158, liquid: 136, wallColor: '#5a5a52', wallWidth: 9, handle: false, material: 'glass' },
  bomb:       { wall: 178, liquid: 158, wallColor: '#5a5a52', wallWidth: 5, handle: false, material: 'glass' },
  wine:       { wall: 182, liquid: 166, wallColor: '#5a5a52', wallWidth: 3, handle: false, material: 'glass' },
  hurricane:  { wall: 172, liquid: 154, wallColor: '#5a5a52', wallWidth: 5, handle: false, material: 'glass' },
};

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

// ---- color helpers ----
function rgb(hex) {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}
function shade(hex, f) {
  const [r, g, b] = rgb(hex);
  const m = v => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
  return `#${[m(r), m(g), m(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
function lum(hex) { const [r, g, b] = rgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

let gradSeq = 0;

export function createVessel(container, vesselType, opts = {}) {
  const spec = VESSELS[vesselType] || VESSELS.mug;
  const HOT = opts.temp === 'hot';
  container.innerHTML = '';
  const svg = el('svg', { viewBox: '0 0 400 400', class: 'vessel-svg', role: 'img' });
  const CX = 200, CY = 200;

  const defs = el('defs', {}, svg);
  const clip = el('clipPath', { id: 'liquid-clip' }, defs);
  el('circle', { cx: CX, cy: CY, r: spec.liquid }, clip);

  // organic liquid edge wobble (slowly breathing)
  const wobble = el('filter', { id: 'wobble', x: '-15%', y: '-15%', width: '130%', height: '130%' }, defs);
  const wobbleTurb = el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.012', numOctaves: '2', seed: '7', result: 'n' }, wobble);
  if (!REDUCED) el('animate', { attributeName: 'baseFrequency', dur: '26s', values: '0.011;0.014;0.011', repeatCount: 'indefinite' }, wobbleTurb);
  el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '7' }, wobble);

  // fine liquid surface grain, masked to the shape it filters
  const liqTex = el('filter', { id: 'liquidTex', x: '-5%', y: '-5%', width: '110%', height: '110%' }, defs);
  el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.55', numOctaves: '3', seed: '11', result: 'n' }, liqTex);
  el('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.9 0.9 0.9 0 -0.55', result: 'tex' }, liqTex);
  el('feComposite', { in: 'tex', in2: 'SourceAlpha', operator: 'in' }, liqTex);

  // coarse bubble texture for foam caps
  const foamTex = el('filter', { id: 'foamTex', x: '-5%', y: '-5%', width: '110%', height: '110%' }, defs);
  el('feTurbulence', { type: 'turbulence', baseFrequency: '0.16', numOctaves: '3', seed: '4', result: 'n' }, foamTex);
  el('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.3  1.6 1.6 1.6 0 -1.1', result: 'tex' }, foamTex);
  el('feComposite', { in: 'tex', in2: 'SourceAlpha', operator: 'in' }, foamTex);

  // sheen gradient (soft directional light on the liquid)
  const sheenGrad = el('radialGradient', { id: 'sheenGrad', cx: '0.5', cy: '0.5', r: '0.5' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '0.9' }, sheenGrad);
  el('stop', { offset: '55%', 'stop-color': '#ffffff', 'stop-opacity': '0.28' }, sheenGrad);
  el('stop', { offset: '100%', 'stop-color': '#ffffff', 'stop-opacity': '0' }, sheenGrad);

  // ice cube body: bright core, bluish translucent rim
  const iceGrad = el('radialGradient', { id: 'iceGrad', cx: '0.38', cy: '0.34', r: '0.95' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '0.72' }, iceGrad);
  el('stop', { offset: '45%', 'stop-color': '#dcecf4', 'stop-opacity': '0.34' }, iceGrad);
  el('stop', { offset: '82%', 'stop-color': '#a8c8d8', 'stop-opacity': '0.30' }, iceGrad);
  el('stop', { offset: '100%', 'stop-color': '#7fa8bc', 'stop-opacity': '0.55' }, iceGrad);

  // condensation droplet
  const dropGrad = el('radialGradient', { id: 'dropGrad', cx: '0.35', cy: '0.3', r: '0.9' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': '0.95' }, dropGrad);
  el('stop', { offset: '45%', 'stop-color': '#cfe2ec', 'stop-opacity': '0.4' }, dropGrad);
  el('stop', { offset: '100%', 'stop-color': '#8fb2c4', 'stop-opacity': '0.12' }, dropGrad);

  // citrus flesh gradients
  const limeGrad = el('radialGradient', { id: 'limeGrad', cx: '0.42', cy: '0.38', r: '0.9' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#d8ec9a' }, limeGrad);
  el('stop', { offset: '55%', 'stop-color': '#a8cc52' }, limeGrad);
  el('stop', { offset: '100%', 'stop-color': '#7a9a34' }, limeGrad);
  const orangeGrad = el('radialGradient', { id: 'orangeGrad', cx: '0.42', cy: '0.38', r: '0.9' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#f8d89a' }, orangeGrad);
  el('stop', { offset: '55%', 'stop-color': '#efa04a' }, orangeGrad);
  el('stop', { offset: '100%', 'stop-color': '#c86e1e' }, orangeGrad);
  const cherryGrad = el('radialGradient', { id: 'cherryGrad', cx: '0.35', cy: '0.3', r: '0.95' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#e04a58' }, cherryGrad);
  el('stop', { offset: '55%', 'stop-color': '#a81c2a' }, cherryGrad);
  el('stop', { offset: '100%', 'stop-color': '#6e1018' }, cherryGrad);

  // drop shadow / counter glow
  el('circle', { cx: CX, cy: CY + 6, r: spec.wall + 8, class: 'vessel-shadow' }, svg);

  // glass / wall
  const glassG = el('g', { class: 'vessel-glass' }, svg);
  el('circle', { cx: CX, cy: CY, r: spec.wall, fill: 'none', stroke: spec.wallColor, 'stroke-width': spec.wallWidth }, glassG);
  el('circle', { cx: CX, cy: CY, r: spec.wall - spec.wallWidth, fill: '#100e0b' }, glassG);
  // specular arc on the wall (rim light, upper left)
  const rimArc = (r, a0, a1, sw, color, op) => {
    const p = (a) => [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    el('path', { d: `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`, fill: 'none', stroke: color, 'stroke-width': sw, 'stroke-linecap': 'round', opacity: op, class: 'rim-light' }, glassG);
  };
  const wallHi = spec.material === 'copper' ? 'rgba(255,214,170,.5)' : spec.material === 'ceramic' ? 'rgba(242,236,225,.16)' : 'rgba(255,255,255,.34)';
  rimArc(spec.wall - spec.wallWidth / 2, -2.5, -1.1, Math.max(spec.wallWidth * 0.5, 2.5), wallHi, 1);
  if (spec.handle) {
    el('path', { d: `M ${CX + spec.wall - 2} ${CY - 34} A 42 42 0 0 1 ${CX + spec.wall - 2} ${CY + 34}`, fill: 'none', stroke: spec.wallColor, 'stroke-width': spec.wallWidth, 'stroke-linecap': 'round' }, glassG);
    el('path', { d: `M ${CX + spec.wall - 2} ${CY - 30} A 38 38 0 0 1 ${CX + spec.wall - 2} ${CY + 30}`, fill: 'none', stroke: 'rgba(255,255,255,.18)', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, glassG);
  }

  const liquidG = el('g', { class: 'vessel-liquid', 'clip-path': 'url(#liquid-clip)', filter: 'url(#wobble)' }, svg);
  const sheenG = el('g', { class: 'vessel-sheen', 'clip-path': 'url(#liquid-clip)' }, svg);
  const fxG = el('g', { class: 'vessel-fx', 'clip-path': 'url(#liquid-clip)' }, svg);
  const garnishG = el('g', { class: 'vessel-garnish' }, svg);
  const steamG = el('g', { class: 'vessel-steam', visibility: 'hidden' }, svg);
  const condG = el('g', { class: 'vessel-condensation' }, svg);
  container.appendChild(svg);

  // drifting specular sheen + top-layer rim light
  const sheen = el('ellipse', { cx: CX - spec.liquid * 0.34, cy: CY - spec.liquid * 0.4, rx: spec.liquid * 0.52, ry: spec.liquid * 0.2, fill: 'url(#sheenGrad)', opacity: 0.16, class: 'sheen', transform: `rotate(-28 ${CX - spec.liquid * 0.34} ${CY - spec.liquid * 0.4})` }, sheenG);
  const topRim = el('path', { d: '', fill: 'none', stroke: 'rgba(255,255,255,.3)', 'stroke-width': 2, 'stroke-linecap': 'round', class: 'top-rim', visibility: 'hidden' }, sheenG);

  // steam wisps (hot drinks)
  const wisps = [];
  for (let i = 0; i < 3; i++) {
    const x = CX - 26 + i * 26;
    const w = el('path', {
      d: `M ${x} ${CY - spec.liquid * 0.25} C ${x - 16} ${CY - spec.liquid * 0.55}, ${x + 16} ${CY - spec.liquid * 0.75}, ${x} ${CY - spec.liquid - 26}`,
      fill: 'none', stroke: 'rgba(238,240,238,.55)', 'stroke-width': 11 - i * 2, 'stroke-linecap': 'round',
      class: 'steam-wisp', style: `animation-delay:${i * 0.9}s`,
    }, steamG);
    wisps.push(w);
  }

  // condensation droplets on cold glass (on the wall ring)
  function seedCondensation(count) {
    condG.innerHTML = '';
    if (HOT) return;
    const rMid = spec.wall - spec.wallWidth / 2;
    for (let i = 0; i < count; i++) {
      const a = rnd(0, Math.PI * 2);
      const r = rMid + rnd(-spec.wallWidth * 0.28, spec.wallWidth * 0.28);
      const s = rnd(2, 4.6);
      const d = el('circle', { cx: CX + Math.cos(a) * r, cy: CY + Math.sin(a) * r, r: s, fill: 'url(#dropGrad)', class: 'cond-drop' }, condG);
      if (i % 3 === 0) d.style.animation = `cond-twinkle ${rnd(3.5, 6).toFixed(1)}s ease-in-out ${rnd(0, 3).toFixed(1)}s infinite alternate`;
    }
  }
  seedCondensation(16);

  const state = { layers: [], iceCubes: [], shotEl: null, finished: false, steamOn: false };

  function radii() {
    const total = state.layers.reduce((s, l) => s + (l.step.ratio || 0), 0) || 1;
    let rem = total;
    return state.layers.map(l => {
      const R = spec.liquid * Math.sqrt(rem / total);
      rem -= (l.step.ratio || 0);
      return R;
    });
  }

  function paintTopRim() {
    const top = state.layers[state.layers.length - 1];
    if (!top) { topRim.setAttribute('visibility', 'hidden'); return; }
    const R = parseFloat(top.node.style.r || top.node.getAttribute('r')) || 0;
    if (R < 8) { topRim.setAttribute('visibility', 'hidden'); return; }
    const p = a => [CX + Math.cos(a) * (R - 1.5), CY + Math.sin(a) * (R - 1.5)];
    const [x0, y0] = p(-2.6), [x1, y1] = p(-1.0);
    topRim.setAttribute('d', `M ${x0} ${y0} A ${R - 1.5} ${R - 1.5} 0 0 1 ${x1} ${y1}`);
    topRim.setAttribute('visibility', 'visible');
  }

  function layout(animate = true) {
    const Rs = radii();
    state.layers.forEach((l, i) => {
      const target = Math.max(Rs[i], 0.1);
      const tr = animate && !REDUCED ? 'r 1.1s cubic-bezier(.22,1,.36,1)' : 'none';
      l.node.style.transition = tr;
      l.node.style.r = target;
      if (l.tex) { l.tex.style.transition = tr; l.tex.style.r = target; }
    });
    clearTimeout(state._rimT);
    state._rimT = setTimeout(paintTopRim, animate && !REDUCED ? 700 : 30);
  }

  function startSteam() {
    if (!HOT || state.steamOn) return;
    state.steamOn = true;
    steamG.setAttribute('visibility', 'visible');
  }

  function ripple(strength = 1) {
    [0, 0.14].forEach((delay, i) => {
      const ring = el('circle', { cx: CX, cy: CY, r: spec.liquid * 0.12, fill: 'none', stroke: `rgba(255,255,255,${0.34 * strength})`, 'stroke-width': 2.5 - i, class: 'ripple-ring' }, fxG);
      ring.style.animationDelay = `${delay}s`;
      setTimeout(() => ring.remove(), REDUCED ? 120 : 1400);
    });
  }

  function liquidGradient(step) {
    const id = `lg-${gradSeq++}`;
    const g = el('radialGradient', { id, cx: '0.44', cy: '0.4', r: '0.72', fx: '0.38', fy: '0.33' }, defs);
    const L = lum(step.color);
    const hi = L > 0.75 ? shade(step.color, 1.08) : shade(step.color, 1.32);
    el('stop', { offset: '0%', 'stop-color': hi }, g);
    el('stop', { offset: '52%', 'stop-color': step.color }, g);
    el('stop', { offset: '86%', 'stop-color': shade(step.color, 0.8) }, g);
    el('stop', { offset: '100%', 'stop-color': shade(step.color, 0.62) }, g);
    return `url(#${id})`;
  }

  function addLiquidLayer(step) {
    const isFoam = step.type === 'foam' || step.type === 'frappefoam' || step.type === 'scoop';
    const node = el('circle', {
      cx: CX, cy: CY, r: 0,
      fill: liquidGradient(step),
      stroke: step.edge || 'none',
      'stroke-width': step.edge ? 3.5 : 0,
      class: 'layer layer-' + step.type,
    }, liquidG);
    // organic surface texture overlay, tracking the layer radius
    const tex = el('circle', {
      cx: CX, cy: CY, r: 0,
      fill: '#000',
      filter: isFoam ? 'url(#foamTex)' : 'url(#liquidTex)',
      opacity: isFoam ? 0.34 : 0.14,
      class: 'layer-tex', style: 'pointer-events:none',
    }, liquidG);
    state.layers.push({ step, node, tex });
    requestAnimationFrame(() => requestAnimationFrame(() => layout(true)));
    if (HOT) startSteam();
    ripple(1);
    return node;
  }

  function dropIceCubes(count, big = false) {
    for (let i = 0; i < count; i++) {
      const size = big ? 64 : rnd(30, 42);
      const ang = rnd(0, Math.PI * 2), dist = rnd(0, spec.liquid - size);
      const x = CX + Math.cos(ang) * dist - size / 2;
      const y = CY + Math.sin(ang) * dist - size / 2;
      const rot = rnd(-18, 18);
      const g = el('g', { class: 'ice-cube' }, fxG);
      g.style.animationDelay = `${i * 0.12}s`;
      const cx = x + size / 2, cy = y + size / 2;
      g.setAttribute('transform', `rotate(${rot.toFixed(1)} ${cx} ${cy})`);
      // body
      el('rect', { x, y, width: size, height: size, rx: big ? 16 : 9, fill: 'url(#iceGrad)', stroke: 'rgba(235,248,252,.8)', 'stroke-width': 1.6 }, g);
      // refracted inner facet
      el('rect', { x: x + size * 0.18, y: y + size * 0.2, width: size * 0.6, height: size * 0.58, rx: big ? 10 : 6, fill: 'rgba(255,255,255,.12)', stroke: 'rgba(255,255,255,.28)', 'stroke-width': 1, transform: `rotate(9 ${cx} ${cy})` }, g);
      // cracks
      el('path', { d: `M ${x + size * 0.3} ${y + size * 0.24} L ${x + size * 0.46} ${y + size * 0.5} L ${x + size * 0.38} ${y + size * 0.72}`, fill: 'none', stroke: 'rgba(255,255,255,.4)', 'stroke-width': 1.1, 'stroke-linecap': 'round' }, g);
      el('path', { d: `M ${x + size * 0.62} ${y + size * 0.3} L ${x + size * 0.56} ${y + size * 0.52}`, fill: 'none', stroke: 'rgba(255,255,255,.3)', 'stroke-width': 1, 'stroke-linecap': 'round' }, g);
      // specular highlight
      el('ellipse', { cx: x + size * 0.3, cy: y + size * 0.24, rx: size * 0.16, ry: size * 0.08, fill: 'rgba(255,255,255,.85)', transform: `rotate(-24 ${x + size * 0.3} ${y + size * 0.24})` }, g);
      state.iceCubes.push(g);
    }
    // cold mist over the surface when ice lands
    const mist = el('circle', { cx: CX, cy: CY, r: spec.liquid * 0.92, fill: '#dfeaf0', opacity: 0, class: 'cold-mist', filter: 'url(#liquidTex)' }, fxG);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      mist.style.transition = 'opacity 1.2s ease';
      mist.style.opacity = 0.12;
      setTimeout(() => { mist.style.opacity = 0.05; }, REDUCED ? 60 : 1600);
    }));
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
    const id = `dl-${gradSeq++}`;
    const g = el('radialGradient', { id, cx: '0.4', cy: '0.36', r: '0.85' }, defs);
    el('stop', { offset: '0%', 'stop-color': shade(color, 1.18) }, g);
    el('stop', { offset: '70%', 'stop-color': color }, g);
    el('stop', { offset: '100%', 'stop-color': shade(color, 0.82) }, g);
    const d = el('circle', { cx: CX, cy: CY, r: 0, fill: `url(#${id})`, class: 'dollop' }, fxG);
    el('circle', { cx: CX, cy: CY, r: 0, fill: '#000', filter: 'url(#foamTex)', opacity: 0.3, class: 'dollop-tex', style: 'pointer-events:none' }, fxG);
    const tex = fxG.lastChild;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const tr = 'r 0.6s cubic-bezier(.34,1.56,.64,1)';
      d.style.transition = tr; d.style.r = spec.liquid * scale;
      tex.style.transition = tr; tex.style.r = spec.liquid * scale;
    }));
  }

  function saltRim() {
    el('circle', {
      cx: CX, cy: CY, r: spec.wall - spec.wallWidth / 2, fill: 'none',
      stroke: '#f0ead8', 'stroke-width': spec.wallWidth + 2, 'stroke-dasharray': '3 6', class: 'salt-rim',
    }, garnishG);
  }

  function citrusPulp(g, gx, gy, flesh, spoke) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + 0.2;
      el('circle', { cx: gx + Math.cos(a) * 13, cy: gy + Math.sin(a) * 13, r: 2.6, fill: flesh, opacity: 0.8 }, g);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      el('line', { x1: gx, y1: gy, x2: gx + Math.cos(a) * 22, y2: gy + Math.sin(a) * 22, stroke: spoke, 'stroke-width': 2.6 }, g);
    }
  }

  function garnish(kind) {
    const ang = -Math.PI / 4, gr = spec.liquid * 0.92;
    const gx = CX + Math.cos(ang) * gr, gy = CY + Math.sin(ang) * gr;
    const g = el('g', { class: 'garnish garnish-' + kind }, garnishG);
    if (kind === 'garnish-lime') {
      el('circle', { cx: gx, cy: gy, r: 27, fill: '#6e8a30' }, g);
      el('circle', { cx: gx, cy: gy, r: 24.5, fill: '#e2f0b0' }, g);
      el('circle', { cx: gx, cy: gy, r: 22, fill: 'url(#limeGrad)' }, g);
      citrusPulp(g, gx, gy, '#cfe48a', '#e6f2b8');
    } else if (kind === 'garnish-orange') {
      el('circle', { cx: gx, cy: gy, r: 27, fill: '#b06a1e' }, g);
      el('circle', { cx: gx, cy: gy, r: 24.5, fill: '#f8e2b8' }, g);
      el('circle', { cx: gx, cy: gy, r: 22, fill: 'url(#orangeGrad)' }, g);
      citrusPulp(g, gx, gy, '#f4bc72', '#f8dcae');
    } else if (kind === 'garnish-mint') {
      for (let i = 0; i < 3; i++) {
        const ex = gx + rnd(-14, 14), ey = gy + rnd(-14, 14), rr = rnd(0, 180);
        el('ellipse', { cx: ex, cy: ey, rx: 16, ry: 8, fill: i ? '#3e6a30' : '#548644', transform: `rotate(${rr} ${ex} ${ey})` }, g);
        el('ellipse', { cx: ex, cy: ey, rx: 16, ry: 8, fill: 'none', stroke: '#5c9440', 'stroke-width': 1, transform: `rotate(${rr} ${ex} ${ey})` }, g);
        el('line', { x1: ex - 13, y1: ey, x2: ex + 13, y2: ey, stroke: '#7ab058', 'stroke-width': 1, transform: `rotate(${rr} ${ex} ${ey})` }, g);
      }
    } else if (kind === 'garnish-olive') {
      el('line', { x1: gx - 34, y1: gy - 20, x2: gx + 34, y2: gy + 20, stroke: '#c8b888', 'stroke-width': 3 }, g);
      el('circle', { cx: gx, cy: gy, r: 13, fill: '#7a8a3a' }, g);
      el('ellipse', { cx: gx - 4, cy: gy - 4, rx: 5, ry: 3.4, fill: '#96a84e', transform: `rotate(-30 ${gx - 4} ${gy - 4})` }, g);
      el('circle', { cx: gx, cy: gy, r: 5, fill: '#c85a3a' }, g);
    } else if (kind === 'garnish-cherry') {
      el('path', { d: `M ${gx - 4} ${gy - 24} Q ${gx + 8} ${gy - 32} ${gx + 14} ${gy - 20}`, fill: 'none', stroke: '#6a4a2a', 'stroke-width': 3 }, g);
      el('circle', { cx: gx, cy: gy, r: 13, fill: 'url(#cherryGrad)' }, g);
      el('ellipse', { cx: gx - 4.5, cy: gy - 5, rx: 4, ry: 2.8, fill: 'rgba(255,255,255,.75)', transform: `rotate(-30 ${gx - 4.5} ${gy - 5})` }, g);
    }
    if (kind === 'straw') {
      el('rect', { x: CX + spec.liquid * 0.4, y: CY - spec.liquid - 30, width: 12, height: spec.liquid * 1.4, rx: 6, fill: '#c6f24e', transform: `rotate(18 ${CX} ${CY})` }, g);
    }
  }

  function sugarCube() {
    const s = el('rect', { x: CX - 14, y: CY - 14, width: 28, height: 28, rx: 4, fill: '#f0ead8', class: 'sugar-cube' }, fxG);
    el('rect', { x: CX - 14, y: CY - 14, width: 28, height: 28, rx: 4, fill: '#000', filter: 'url(#liquidTex)', opacity: 0.25, style: 'pointer-events:none' }, fxG);
    setTimeout(() => {
      s.style.transition = 'opacity .8s, transform .8s'; s.style.opacity = 0.25; s.style.transform = 'scale(0.7)'; s.style.transformOrigin = 'center';
    }, REDUCED ? 30 : 500);
  }

  function shotGlassDrop() {
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
      [0.5, 0.75].forEach((f, i) => {
        const ring = el('circle', { cx: CX, cy: CY, r: 62, fill: 'none', stroke: '#c8d44a', 'stroke-width': 3, opacity: 0.8 }, fxG);
        ring.style.transition = `r .6s ${i * 0.1}s ease-out, opacity .6s ${i * 0.1}s`;
        requestAnimationFrame(() => requestAnimationFrame(() => { ring.style.r = spec.liquid * f; ring.style.opacity = 0; }));
      });
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
        fill: 'none', stroke: 'rgba(242,236,225,.4)', 'stroke-width': 2.5, 'stroke-linecap': 'round',
      }, sw);
    }
    sw.style.transformOrigin = 'center';
    sw.style.transition = 'transform 1.3s ease, opacity 1.3s';
    requestAnimationFrame(() => requestAnimationFrame(() => { sw.style.transform = 'rotate(540deg)'; sw.style.opacity = 0; }));
    setTimeout(() => sw.remove(), REDUCED ? 100 : 1500);
  }

  const api = {
    el: svg,
    reset() {
      state.layers = []; state.iceCubes = []; state.shotEl = null; state.finished = false; state.steamOn = false;
      liquidG.innerHTML = ''; fxG.innerHTML = ''; garnishG.innerHTML = '';
      steamG.setAttribute('visibility', 'hidden');
      topRim.setAttribute('visibility', 'hidden');
      seedCondensation(16);
      clearTimeout(state._rimT);
    },
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
        case 'shot': {
          const d = el('circle', { cx: CX, cy: CY, r: 0, fill: liquidGradient({ color: addon.color }), opacity: 0.92 }, liquidG);
          state.layers.push({ step: { ratio: 6, color: addon.color }, node: d, tex: null });
          layout(true);
          ripple(0.8);
          return DUR.espresso;
        }
        case 'tag': return DUR.blip;
        default: return DUR.blip;
      }
    },
    finish() {
      state.finished = true;
      svg.classList.add('finished');
      if (state.steamOn) steamG.classList.add('steam-full');
    },
    unfinish() { state.finished = false; svg.classList.remove('finished'); },
  };
  return api;
}
