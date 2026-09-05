// Real stock-footage clips (Pexels / Mixkit, free commercial licenses), shipped in-repo under
// clips/ so they are served same-origin with inline disposition. (The earlier Vercel Blob copy
// was served as Content-Disposition: attachment, which browsers divert to the download path -
// the <video> element never received bytes, so every step silently fell back to the canvas.)
//
// Clips are preloaded per drink (fetch -> object URL) so playback starts instantly from memory
// and steps crossfade with no network stalls. Canvas rendering stays underneath as fallback:
// if a clip is missing or fails, the layer still draws.
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const CLIPS = {
  espresso: 'clips/espresso.mp4',
  milk: 'clips/milk.mp4',
  water: 'clips/water.mp4',
  spirit: 'clips/spirit.mp4',
  juice: 'clips/juice.mp4',
  coldbrew: 'clips/coldbrew.mp4',
  strain: 'clips/strain.mp4',
  syrup: 'clips/syrup.mp4',
  foam: 'clips/foam.mp4',
  frappefoam: 'clips/foam.mp4',
  ice: 'clips/ice.mp4',
  iceblock: 'clips/ice.mp4',
  shake: 'clips/shake.mp4',
  stir: 'clips/stir.mp4',
  fizz: 'clips/fizz.mp4',
  sugar: 'clips/sugar.mp4',
  scoop: 'clips/scoop.mp4',
  art: 'clips/art.mp4',
  'garnish-orange': 'clips/garnish-orange.mp4',
  'garnish-mint': 'clips/garnish-mint.mp4',
  'garnish-lime': 'clips/garnish-lime.mp4',
};
export const STEAM_CLIP = 'clips/steam.mp4';

// ---- preload cache: source path -> Promise<objectURL|null> ----
const cache = new Map();
const waiters = new Map(); // path -> Set<fn(objectURL)>

function load(path) {
  if (cache.has(path)) return cache.get(path);
  const p = (async () => {
    try {
      const r = await fetch(path);
      if (!r.ok) throw new Error('http ' + r.status);
      const buf = await r.arrayBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: 'video/mp4' }));
      const fns = waiters.get(path);
      if (fns) { fns.forEach(fn => fn(url)); waiters.delete(path); }
      return url;
    } catch (e) {
      cache.delete(path); // allow a later retry
      const fns = waiters.get(path);
      if (fns) { fns.forEach(fn => fn(null)); waiters.delete(path); }
      return null;
    }
  })();
  cache.set(path, p);
  return p;
}

// Preload the clips a drink will need. Call when the build page renders.
export function preloadClips(types, withSteam) {
  if (REDUCED) return;
  const paths = new Set(types.map(t => CLIPS[t]).filter(Boolean));
  if (withSteam) paths.add(STEAM_CLIP);
  paths.forEach(load);
}

export function releaseClips() {
  cache.forEach(p => p.then(url => { if (url) URL.revokeObjectURL(url); }));
  cache.clear();
  waiters.clear();
}

function makeVideo(container, cls) {
  const v = document.createElement('video');
  v.className = cls;
  v.muted = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.preload = 'auto';
  v.addEventListener('error', () => v.remove());
  container.appendChild(v);
  return v;
}

// Show a clip over the vessel stage for one build step. The video's lifetime is locked to the
// step window: it fades in when the step starts and is pulled when the step ends (hideClip).
// Plays once at natural speed - every clip is trimmed to its action and outlasts the step.
// Returns the video element (null when the step has no clip or motion is reduced).
export function showClip(container, type) {
  const path = CLIPS[type];
  if (!path || !container || REDUCED) return null;
  const v = makeVideo(container, 'step-clip');
  const cached = cache.get(path);
  if (cached) {
    cached.then(url => { if (url && v.isConnected) { v.src = url; v.play().catch(() => {}); } else if (!url) fallback(); });
  } else {
    fallback(); // not preloaded: stream direct, and warm the cache for the replay
    load(path);
  }
  function fallback() {
    if (!v.isConnected) return;
    v.src = path;
    v.play().catch(() => {});
  }
  requestAnimationFrame(() => v.classList.add('on'));
  return v;
}

export function hideClip(v) {
  if (!v) return;
  v.classList.remove('on');
  setTimeout(() => { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); }, 600);
}

// Ambient steam loop for hot drinks - runs for the whole build view.
export function showSteam(container) {
  if (!container || REDUCED) return null;
  const v = makeVideo(container, 'step-clip steam-clip');
  v.loop = true;
  const cached = cache.get(STEAM_CLIP);
  if (cached) cached.then(url => { if (url && v.isConnected) { v.src = url; v.play().catch(() => {}); } });
  else { v.src = STEAM_CLIP; v.play().catch(() => {}); load(STEAM_CLIP); }
  requestAnimationFrame(() => v.classList.add('on'));
  return v;
}
