// Real stock-footage clips (Pexels / Mixkit, free commercial licenses) hosted on Vercel Blob.
// Each maps a build-step type to a short looping clip shown over the vessel stage.
// Canvas rendering stays underneath as fallback - if a clip 404s or stalls, the layer still draws.
//
// Clips are fetched ONCE per drink page, as soon as the page mounts, and cached as in-memory
// blob: URLs. Playing from memory is what makes each step's own clip paint the instant the
// step starts - a fresh network fetch per step used to arrive too late (or stall entirely),
// so the only footage visibly playing was whatever had managed to load first.
const BASE = 'https://sof3wdyy3sm20bjl.public.blob.vercel-storage.com';
export const CLIPS = {
  espresso: `${BASE}/espresso.mp4`,
  milk: `${BASE}/milk.mp4`,
  water: `${BASE}/water.mp4`,
  spirit: `${BASE}/spirit.mp4`,
  juice: `${BASE}/juice.mp4`,
  coldbrew: `${BASE}/coldbrew.mp4`,
  strain: `${BASE}/strain.mp4`,
  syrup: `${BASE}/syrup.mp4`,
  foam: `${BASE}/foam.mp4`,
  frappefoam: `${BASE}/foam.mp4`,
  ice: `${BASE}/ice.mp4`,
  iceblock: `${BASE}/ice.mp4`,
  shake: `${BASE}/shake.mp4`,
  stir: `${BASE}/stir.mp4`,
  fizz: `${BASE}/fizz.mp4`,
  sugar: `${BASE}/sugar.mp4`,
  scoop: `${BASE}/scoop.mp4`,
  art: `${BASE}/art.mp4`,
  'garnish-orange': `${BASE}/garnish-orange.mp4`,
  'garnish-mint': `${BASE}/garnish-mint.mp4`,
  'garnish-lime': `${BASE}/garnish-lime.mp4`,
};
export const STEAM_CLIP = `${BASE}/steam.mp4`;

// url -> Promise resolving to a blob: object URL (or the remote URL itself as fallback).
const clipCache = new Map();
function clipURL(url) {
  if (!clipCache.has(url)) {
    clipCache.set(url, fetch(url)
      .then(r => { if (!r.ok) throw new Error(`clip ${r.status}`); return r.blob(); })
      .then(b => URL.createObjectURL(b))
      .catch(() => url));
  }
  return clipCache.get(url);
}

// Start downloading the clips this drink will need. Call when the build view mounts.
export function preloadClips(types, { steam = false } = {}) {
  const urls = new Set();
  (types || []).forEach(t => { if (CLIPS[t]) urls.add(CLIPS[t]); });
  if (steam) urls.add(STEAM_CLIP);
  urls.forEach(u => clipURL(u));
}

function makeClip(container, className, urlPromise) {
  if (!container) return null;
  const v = document.createElement('video');
  v.className = className;
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.preload = 'auto';
  v.addEventListener('error', () => v.remove());
  container.appendChild(v);
  urlPromise.then(url => {
    if (!v.isConnected) return;
    v.src = url;
    v.play().catch(() => {});
    requestAnimationFrame(() => v.classList.add('on'));
  });
  return v;
}

// Show a clip over the vessel stage. Returns the video element (null on failure).
export function showClip(container, type) {
  const src = CLIPS[type];
  if (!src) return null;
  return makeClip(container, 'step-clip', clipURL(src));
}

export function hideClip(v) {
  if (!v) return;
  v.classList.remove('on');
  setTimeout(() => v.remove(), 450);
}

// Ambient steam loop for hot drinks - runs for the whole build view.
export function showSteam(container) {
  return makeClip(container, 'step-clip steam-clip', clipURL(STEAM_CLIP));
}
