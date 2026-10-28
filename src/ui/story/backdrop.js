// Scene backgrounds for the story player (owner: story; STORY_SPEC §1.2.4). Resolves a background id from
// src/data/story/backgrounds.js to a layer element and crossfades between layers:
//   paint  the painted academy under one of the lobby's tints (day / sunset / night; soft = blurred + dimmed)
//   cg     a painted lobby scene with a girl in it (the player hides portraits while it is up)
//   solid  a flat colour (black for fades and title cards)
//   stage  `stage:<id>` — a still of that stage's battle map when one is available (stageStill hook), else the
//          chapter's academy tint (CHAPTER_FALLBACK_BG). A still is never a reason to delay text.
import { h } from '../dom.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { BACKGROUNDS, CHAPTER_FALLBACK_BG, stageOfBackground } from '../../data/story/backgrounds.js';
import { STAGE_MAP } from '../../data/stages.js';
import { MAP_MAP } from '../../data/maps.js';
import { themeBackdropSVG } from '../../art/backdrops.js';

const FADE_MS = 420;

/**
 * Optional provider of stage stills: (stageId) => Promise<string|null> (an image URL). Set by a later build
 * step (renderer stills); until then stage backgrounds use the chapter's academy tint.
 * @type {null | ((stageId: string) => Promise<string|null>)}
 */
let stillProvider = null;
const stillCache = new Map();

/** Register the stage-still provider (see above). */
export function setStageStillProvider(fn) {
  stillProvider = typeof fn === 'function' ? fn : null;
  stillCache.clear();
}


/** Act II stage maps whose story background shows a place of its own (src/art/backdrops.js themeBackdropSVG variant). */
const PLACE_VARIANT = { noon_rowing_jetty: 'jetty', noon_boathouse_lamp: 'lamp' };

/**
 * What a background id draws. Stage backgrounds resolve to their chapter's academy tint (with the stage id
 * kept, so a still can replace it).
 * @param {string} id
 * @param {number} [chapter] the scene's chapter (fallback tint for stage stills)
 * @returns {{ id: string, kind: string, url?: string, thumb?: string, tint?: string, blur?: number, dim?: number, color?: string, stageId?: string, cg?: boolean }}
 */
export function resolveBackground(id, chapter = 0) {
  const stageId = stageOfBackground(id);
  if (stageId) {
    // an Act II stage (Gate Arc: the Noon city, not the academy) falls back to its map theme's painted skyline
    const st = STAGE_MAP[stageId];
    const theme = st?.act === 2 ? MAP_MAP[st.mapId]?.theme : null;
    if (theme) return { id, kind: 'svg', html: themeBackdropSVG(theme, { variant: PLACE_VARIANT[st.mapId] ?? null }), stageId, fallback: true };
    const ch = st?.chapter ?? chapter;
    const fb = resolveBackground(CHAPTER_FALLBACK_BG[ch] || CHAPTER_FALLBACK_BG[chapter] || 'academy-day', chapter);
    return { ...fb, id, stageId, fallback: true };
  }
  const bg = BACKGROUNDS[id] || BACKGROUNDS['academy-day'];
  if (bg.kind === 'solid') return { id, kind: 'solid', color: bg.color };
  return {
    id,
    kind: bg.kind,
    url: lobbyArtUrl(bg.file),
    thumb: bg.thumb ? lobbyArtUrl(bg.thumb) : null,
    tint: bg.tint || null,
    blur: bg.blur || 0,
    dim: bg.dim || 0,
    cg: bg.kind === 'cg',
  };
}

/** Resolve when an image URL has loaded (or failed, or timed out). Never rejects. */
export function preloadImage(url, timeout = 2500) {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const img = new Image();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      resolve(ok);
    };
    img.decoding = 'async';
    img.onload = () => (img.decode ? img.decode().then(() => finish(true), () => finish(true)) : finish(true));
    img.onerror = () => finish(false);
    img.src = url;
    setTimeout(() => finish(false), timeout);
  });
}

function stillFor(stageId) {
  if (!stillProvider || !stageId) return Promise.resolve(null);
  if (!stillCache.has(stageId)) {
    const p = Promise.race([
      Promise.resolve().then(() => stillProvider(stageId)).catch(() => null),
      new Promise((r) => setTimeout(() => r(null), 2500)),
    ]);
    stillCache.set(stageId, p);
  }
  return stillCache.get(stageId);
}

function layerFor(spec) {
  if (spec.kind === 'solid') return h('div.sp-bg-layer.solid', { style: { background: spec.color } });
  if (spec.kind === 'svg') return h('div.sp-bg-layer.svg', { html: spec.html });
  const img = h('img.sp-bg-img', { src: spec.url, alt: '', draggable: false, decoding: 'async' });
  const cls = spec.kind === 'cg' ? '.cg' : `.paint.tint-${spec.tint || 'day'}${spec.blur ? '.soft' : ''}`;
  const layer = h(`div.sp-bg-layer${cls}`, img, spec.kind === 'cg' ? null : h('div.sp-bg-tint'));
  if (spec.blur) layer.style.setProperty('--sp-bg-blur', `${spec.blur}px`);
  if (spec.dim) layer.style.setProperty('--sp-bg-dim', String(1 - spec.dim));
  return layer;
}

/**
 * A crossfading background stack inside `el`.
 * @param {HTMLElement} el container (absolutely filled)
 * @param {{ chapter?: number }} [opts]
 */
export function createBackdrop(el, { chapter = 0 } = {}) {
  let current = null;
  let token = 0;

  function swap(layer, instant) {
    const old = [...el.children];
    layer.classList.add('sp-bg-in');
    if (instant) layer.classList.add('sp-bg-instant');
    el.appendChild(layer);
    // two frames so the opacity transition runs
    requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('on')));
    setTimeout(() => old.forEach((o) => o.remove()), instant ? 0 : FADE_MS + 60);
  }

  return {
    /** @returns {object|null} the resolved spec on screen */
    get current() {
      return current;
    },
    /** True while a CG (girl painted in) is up. */
    get isCg() {
      return !!current?.cg;
    },
    /**
     * Show a background. Resolves once the new layer is in place (images may still be decoding).
     * @param {string} id
     * @param {{ instant?: boolean }} [o]
     */
    show(id, { instant = false } = {}) {
      const spec = resolveBackground(id, chapter);
      current = spec;
      const my = ++token;
      swap(layerFor(spec), instant);
      if (spec.stageId) {
        stillFor(spec.stageId).then((url) => {
          if (!url || my !== token) return;
          const layer = h('div.sp-bg-layer.still', h('img.sp-bg-img', { src: url, alt: '', draggable: false }), h('div.sp-bg-tint'));
          swap(layer, false);
        });
      }
      return spec;
    },
    dispose() {
      token++;
      el.replaceChildren();
    },
  };
}

/** URLs worth preloading before a scene starts (its first background). */
export function backgroundUrls(id, chapter = 0) {
  const spec = resolveBackground(id, chapter);
  return spec.url ? [spec.url] : [];
}
