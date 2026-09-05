import { DRINKS, ADDONS, MODE_META } from './data.js';
import { createVessel } from './vessel.js';
import * as SFX from './audio.js';
import { showClip, hideClip, showSteam, preloadClips } from './clips.js';

const app = document.getElementById('app');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- sound toggle ----------
const soundBtn = document.getElementById('sound-toggle');
function paintSound() { soundBtn.classList.toggle('muted', SFX.isMuted()); }
soundBtn.addEventListener('click', () => { SFX.setMuted(!SFX.isMuted()); paintSound(); if (!SFX.isMuted()) SFX.blip(); });
paintSound();

// ---------- router ----------
let current = { cleanup: null };
function route() {
  if (current.cleanup) { current.cleanup(); current.cleanup = null; }
  const hash = location.hash || '#/';
  const parts = hash.replace(/^#\//, '').split('/').filter(Boolean);
  document.querySelectorAll('[data-mode-link]').forEach(a => {
    a.classList.toggle('active', parts[0] === a.dataset.modeLink);
  });
  if (parts.length === 0) renderHero();
  else if (parts.length === 1 && MODE_META[parts[0]]) renderMenu(parts[0]);
  else if (parts.length === 2 && MODE_META[parts[0]]) {
    const drink = DRINKS[parts[0]].find(d => d.id === parts[1]);
    if (drink) renderBuild(parts[0], drink); else renderMenu(parts[0]);
  } else renderHero();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

// ---------- hero ----------
function renderHero() {
  document.title = 'Anatomy of a Drink - What goes into every coffee and cocktail';
  app.innerHTML = `
    <section class="hero">
      <p class="eyebrow">AN INTERACTIVE FIELD GUIDE</p>
      <h1 class="hero-title">ANATOMY<br><span class="of">of a</span> DRINK</h1>
      <p class="hero-sub">Every layer. Every pour. Exactly what goes in - built in front of you, with sound.</p>
      <div class="mode-cards">
        <a href="#/coffee" class="mode-card coffee" data-nav>
          <div class="mode-glyph">${glyphMug('#e09543')}</div>
          <h2>COFFEE</h2>
          <p>Espresso to affogato. What is a cappuccino, actually?</p>
          <span class="mode-count">${DRINKS.coffee.length} drinks</span>
        </a>
        <a href="#/cocktails" class="mode-card cocktails" data-nav>
          <div class="mode-glyph">${glyphMartini('#c6f24e')}</div>
          <h2>COCKTAILS</h2>
          <p>The right glass, the shake, the pour, the garnish.</p>
          <span class="mode-count">${DRINKS.cocktails.length} drinks</span>
        </a>
      </div>
      <p class="hero-hint">Turn sound on. It is half the point.</p>
    </section>`;
}

function glyphMug(color) {
  return `<svg viewBox="0 0 100 100"><circle cx="46" cy="50" r="34" fill="none" stroke="${color}" stroke-width="5"/><circle cx="46" cy="50" r="25" fill="${color}" opacity=".25"/><circle cx="46" cy="50" r="12" fill="${color}"/><path d="M 80 38 A 14 14 0 0 1 80 62" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/></svg>`;
}
function glyphMartini(color) {
  return `<svg viewBox="0 0 100 100"><circle cx="50" cy="42" r="34" fill="none" stroke="${color}" stroke-width="5"/><circle cx="50" cy="42" r="24" fill="${color}" opacity=".25"/><circle cx="50" cy="42" r="8" fill="${color}"/><line x1="50" y1="76" x2="50" y2="92" stroke="${color}" stroke-width="5" stroke-linecap="round"/></svg>`;
}

// ---------- menu ----------
function renderMenu(mode) {
  const meta = MODE_META[mode];
  const drinks = DRINKS[mode];
  document.title = `${meta.title} - Anatomy of a Drink`;
  app.innerHTML = `
    <section class="menu" style="--accent:${meta.accent}">
      <p class="eyebrow">${meta.filterPrompt}</p>
      <h1 class="menu-title">${meta.headline}</h1>
      <p class="menu-sub">${meta.sub}</p>
      <div class="filter-row" id="filters">
        ${meta.filters.map((f, i) => `<button class="chip ${i === 0 ? 'active' : ''}" data-filter="${f.id}">${f.label}</button>`).join('')}
      </div>
      <div class="drink-grid" id="grid">
        ${drinks.map(d => `
          <a href="#/${mode}/${d.id}" class="drink-card" data-nav data-fkey="${d[meta.filterKey]}">
            <div class="drink-glyph">${miniVessel(d)}</div>
            <h3>${d.name}</h3>
            <p>${d.tagline}</p>
            <span class="drink-tag">${d[meta.filterKey].toUpperCase()}</span>
          </a>`).join('')}
      </div>
    </section>`;
  const grid = document.getElementById('grid');
  document.getElementById('filters').addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    SFX.blip();
    document.querySelectorAll('#filters .chip').forEach(c => c.classList.toggle('active', c === btn));
    const f = btn.dataset.filter;
    grid.querySelectorAll('.drink-card').forEach(card => {
      const show = f === 'all' || card.dataset.fkey === f;
      if (show) { card.classList.remove('wiped'); }
      else { card.classList.add('wiped'); }
    });
  });
}

function miniVessel(d) {
  const layers = d.steps.filter(s => s.ratio > 0);
  const total = layers.reduce((s, l) => s + l.ratio, 0) || 1;
  let rem = total, circles = '';
  layers.forEach(l => {
    const R = 38 * Math.sqrt(rem / total); rem -= l.ratio;
    circles = `<circle cx="50" cy="50" r="${R.toFixed(1)}" fill="${l.color}"/>` + circles;
  });
  return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="3" opacity=".5"/>${circles}</svg>`;
}

// ---------- build stage ----------
function renderBuild(mode, drink) {
  const meta = MODE_META[mode];
  document.title = `${drink.name} - Anatomy of a Drink`;
  const hasAddons = drink.addons && drink.addons.length > 0;
  app.innerHTML = `
    <section class="build" style="--accent:${meta.accent}">
      <div class="build-head">
        <a href="#/${mode}" class="back-link" data-nav>&larr; ${meta.title}</a>
        <h1 class="build-title">${drink.name}</h1>
        <p class="build-tagline">${drink.tagline}</p>
      </div>
      <div class="build-stage">
        <div class="vessel-col">
          <div id="vessel-wrap" class="vessel-wrap"></div>
          <div class="ratio-bar" id="ratio-bar" aria-label="Ingredient proportions"></div>
          <div class="build-controls">
            <button id="build-btn" class="btn-primary">BUILD IT</button>
            <button id="replay-btn" class="btn-ghost" disabled>REPLAY</button>
          </div>
        </div>
        <div class="rail-col">
          <ol class="step-rail" id="step-rail">
            ${drink.steps.map((s, i) => `
              <li class="step-card" data-step="${i}">
                <span class="step-num">${String(i + 1).padStart(2, '0')}</span>
                <div class="step-body">
                  <div class="step-label">${s.label}${s.amount ? ` <span class="step-amount">${s.amount}</span>` : ''}</div>
                  <div class="step-note">${s.note}</div>
                </div>
              </li>`).join('')}
          </ol>
          ${hasAddons ? `
            <div class="addons">
              <p class="addons-title">${meta.addonsTitle || 'ADD-ONS'}</p>
              <div class="addon-row" id="addon-row">
                ${drink.addons.map(a => `<button class="chip addon-chip" data-addon="${a}">+ ${ADDONS[a].label}</button>`).join('')}
              </div>
            </div>` : ''}
          <div class="recipe-card" id="recipe-card" hidden>
            <p class="recipe-kicker">THIS IS A ${drink.name.toUpperCase()}</p>
            <p class="recipe-method">${drink.method}</p>
            <ul class="recipe-list" id="recipe-list"></ul>
            <a href="#/${mode}" class="btn-ghost" data-nav>MAKE ANOTHER</a>
          </div>
        </div>
      </div>
    </section>`;

  const vesselWrap = document.getElementById('vessel-wrap');
  const vessel = createVessel(vesselWrap, drink.vessel, { temp: drink.temp });
  // fetch this drink's clips into memory now so each step's footage paints instantly
  preloadClips(drink.steps.map(s => s.type), { steam: drink.temp === 'hot' });
  let steamVid = null;
  const rail = document.getElementById('step-rail');
  const buildBtn = document.getElementById('build-btn');
  const replayBtn = document.getElementById('replay-btn');
  const recipeCard = document.getElementById('recipe-card');
  const recipeList = document.getElementById('recipe-list');
  const ratioBar = document.getElementById('ratio-bar');
  const chosenAddons = new Set();
  let building = false, built = false, cancelled = false;
  current.cleanup = () => { cancelled = true; hideClip(steamVid); steamVid = null; };

  function paintRatio() {
    const layers = drink.steps.filter(s => s.ratio > 0);
    const total = layers.reduce((s, l) => s + l.ratio, 0) || 1;
    ratioBar.innerHTML = layers.map(l =>
      `<div class="ratio-seg" style="width:${(l.ratio / total) * 100}%;background:${l.color}" title="${l.label}"><span>${Math.round((l.ratio / total) * 100)}%</span></div>`
    ).join('');
  }
  paintRatio();

  function paintRecipe() {
    const items = drink.steps.filter(s => s.ratio > 0 || s.amount).map(s => `<li><span>${s.label}</span><span class="recipe-amount">${s.amount || ''}</span></li>`);
    chosenAddons.forEach(a => items.push(`<li class="recipe-addon"><span>${ADDONS[a].label}</span><span class="recipe-amount">added</span></li>`));
    recipeList.innerHTML = items.join('');
  }

  async function build() {
    if (building) return;
    building = true; cancelled = false; built = false;
    buildBtn.disabled = true; replayBtn.disabled = true;
    recipeCard.hidden = true;
    vessel.reset();
    rail.querySelectorAll('.step-card').forEach(c => c.classList.remove('active', 'done'));
    for (let i = 0; i < drink.steps.length; i++) {
      if (cancelled) return;
      const step = drink.steps[i];
      const card = rail.querySelector(`[data-step="${i}"]`);
      card.classList.add('active');
      card.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
      SFX.play(step.sound, { type: step.type, temp: drink.temp });
      const clipVid = showClip(vesselWrap, step.type);
      if (!steamVid && drink.temp === 'hot' && (step.type === 'espresso' || step.type === 'water')) steamVid = showSteam(vesselWrap);
      const ms = vessel.addStep(step);
      await sleep(ms);
      hideClip(clipVid);
      if (cancelled) return;
      card.classList.remove('active'); card.classList.add('done');
    }
    vessel.finish();
    SFX.chime();
    built = true; building = false;
    replayBtn.disabled = false; buildBtn.disabled = true;
    paintRecipe();
    recipeCard.hidden = false;
    recipeCard.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
  }

  buildBtn.addEventListener('click', build);
  replayBtn.addEventListener('click', build);

  // add-ons: toggle on/off, live on the vessel
  const addonRow = document.getElementById('addon-row');
  if (addonRow) addonRow.addEventListener('click', async e => {
    const btn = e.target.closest('[data-addon]');
    if (!btn) return;
    const id = btn.dataset.addon;
    if (chosenAddons.has(id)) {
      chosenAddons.delete(id); btn.classList.remove('active'); SFX.blip();
      if (built) { paintRecipe(); }
      return;
    }
    chosenAddons.add(id); btn.classList.add('active');
    SFX.play(ADDONS[id].sound, { type: ADDONS[id].visual, temp: drink.temp });
    const ms = vessel.addAddon(ADDONS[id]);
    await sleep(Math.min(ms, 400));
    if (built) paintRecipe();
  });

  // keyboard: space/enter to build or replay
  const keyHandler = e => {
    if (e.key === ' ' && !building) { e.preventDefault(); build(); }
  };
  window.addEventListener('keydown', keyHandler);
  const prevCleanup = current.cleanup;
  current.cleanup = () => { prevCleanup(); window.removeEventListener('keydown', keyHandler); };
}

route();
