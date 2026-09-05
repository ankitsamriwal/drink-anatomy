// Real stock-footage clips (Pexels / Mixkit, free commercial licenses) hosted on Vercel Blob.
// Each maps a build-step type to a short looping clip shown over the vessel stage.
// Canvas rendering stays underneath as fallback - if a clip 404s or stalls, the layer still draws.
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

// Show a clip over the vessel stage. Returns the video element (null on failure).
export function showClip(container, type) {
  const src = CLIPS[type];
  if (!src || !container) return null;
  const v = document.createElement('video');
  v.className = 'step-clip';
  v.src = src;
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.preload = 'auto';
  v.addEventListener('error', () => v.remove());
  container.appendChild(v);
  requestAnimationFrame(() => v.classList.add('on'));
  v.play().catch(() => {});
  return v;
}

export function hideClip(v) {
  if (!v) return;
  v.classList.remove('on');
  setTimeout(() => v.remove(), 450);
}

// Ambient steam loop for hot drinks - runs for the whole build view.
export function showSteam(container) {
  if (!container) return null;
  const v = document.createElement('video');
  v.className = 'step-clip steam-clip';
  v.src = STEAM_CLIP;
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.preload = 'auto';
  v.addEventListener('error', () => v.remove());
  container.appendChild(v);
  requestAnimationFrame(() => v.classList.add('on'));
  v.play().catch(() => {});
  return v;
}
