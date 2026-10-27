// Scene backgrounds for the story player (owner: story; STORY_SPEC §1.2.4). Resolves a background id from
// src/data/story/backgrounds.js to a layer element and crossfades between layers:
//   paint  a painted picture (the academy or a story place) under one of the lobby's tints (day / sunset / night;
//          soft = blurred + dimmed); a story place carries its focal point (object-position)
//   cg     a painted lobby scene with a girl in it (the player hides portraits while it is up)
//   solid  a flat colour (black for fades and title cards)
//   stage  `stage:<id>` — that stage's painted place (STAGE_PLACE), else the chapter's academy tint
//          (CHAPTER_FALLBACK_BG). A still from the stage-still hook would replace either; nothing registers one.
//          A still is never a reason to delay text.
import { h } from '../dom.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { BACKGROUNDS, CHAPTER_FALLBACK_BG, placeOfStage, stageOfBackground } from '../../data/story/backgrounds.js';
import { STAGE_MAP } from '../../data/stages.js';

const FADE_MS = 420;

/**
 * Optional provider of stage stills: (stageId) => Promise<string|null> (an image URL). Planned for renderer
 * stills of the battle maps; nothing in src/ registers one (Oct 27: every campaign stage shows its painted place,
 * STAGE_PLACE, instead). Kept as a hook: a registered still crossfades over the place once it is ready.
 * @type {null | ((stageId: string) => Promise<string|null>)}
 */
let stillProvider = null;
const stillCache = new Map();

/** Register the stage-still provider (see above). */
export function setStageStillProvider(fn) {
  stillProvider = typeof fn === 'function' ? fn : null;
  stillCache.clear();
}

/**
 * What a background id draws. Stage backgrounds resolve to their painted place (STAGE_PLACE), or to their
 * chapter's academy tint when the stage has none (with the stage id kept, so a still can replace either).
 * @param {string} id
 * @param {number} [chapter] the scene's chapter (fallback tint for stage stills)
 * @returns {{ id: string, kind: string, url?: string, thumb?: string, tint?: string, blur?: number, dim?: number, focus?: string|null, color?: string, stageId?: string, place?: string, cg?: boolean }}
 */
export function resolveBackground(id, chapter = 0) {
  const stageId = stageOfBackground(id);
  if (stageId) {
    const place = placeOfStage(stageId);
    if (place) return { ...resolveBackground(place, chapter), id, stageId, place, fallback: true };
    const ch = STAGE_MAP[stageId]?.chapter ?? chapter;
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
    focus: bg.focus || null,
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

/** Resolve once an <img> has loaded and decoded (or failed, or after `timeout` ms). Never rejects. */
function imageReady(img, timeout = 2500) {
  if (!img) return Promise.resolve();
  const loaded = img.decode
    ? img.decode().catch(() => {})
    : new Promise((r) => {
      if (img.complete) return r();
      img.addEventListener('load', r, { once: true });
      img.addEventListener('error', r, { once: true });
    });
  return Promise.race([loaded, new Promise((r) => setTimeout(r, timeout))]);
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
  const img = h('img.sp-bg-img', { src: spec.url, alt: '', draggable: false, decoding: 'async', style: spec.focus ? { objectPosition: spec.focus } : null });
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
    // every place is its own picture now: keep the old layer until the new one has decoded (capped), so a slow
    // phone never flashes black between two backgrounds
    imageReady(layer.querySelector('img')).then(() => {
      // two frames so the opacity transition runs
      requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('on')));
      setTimeout(() => old.forEach((o) => o.remove()), instant ? 0 : FADE_MS + 60);
    });
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
