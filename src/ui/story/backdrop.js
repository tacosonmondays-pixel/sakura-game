// Scene backgrounds for the story player (owner: story; STORY_SPEC §1.2.4). Resolves a background id from
// src/data/story/backgrounds.js to a layer element and crossfades between layers:
//   paint  a painted picture (the academy or a story place) under one of the lobby's tints (day / sunset / night;
//          soft = blurred + dimmed); a story place carries its focal point (object-position)
//   cg     a painted lobby scene with a girl in it (the player hides portraits while it is up)
//   solid  a flat colour (black for fades and title cards)
//   stage  `stage:<id>` — that stage's painted place (STAGE_PLACE); an Act II stage without one shows its map
//          theme's painted skyline (svg: the Gate Arc's Noon city, not the academy); else the chapter's academy
//          tint (CHAPTER_FALLBACK_BG). `stage:<id>@dusk` / `@night`: the skyline re-lit for that time of day
//          (themeBackdropSVG `time`), or the painted place's `-sunset` / `-night` picture when one is listed. A still from the stage-still hook would replace any of these; nothing
//          registers one. A still is never a reason to delay text.
import { h } from '../dom.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { BACKGROUNDS, CHAPTER_FALLBACK_BG, placeOfStage, stageOfBackground, timeOfBackground } from '../../data/story/backgrounds.js';
import { STAGE_MAP } from '../../data/stages.js';
import { MAP_MAP } from '../../data/maps.js';
import { themeBackdropSVG } from '../../art/backdrops.js';

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


/** Act II stage maps whose story background shows a place of its own (src/art/backdrops.js themeBackdropSVG variant). */
const PLACE_VARIANT = {
  noon_rowing_jetty: 'jetty', noon_boathouse_lamp: 'lamp',
  // Act 3 (the Bell Festival): Old Town at night, then the night it burns
  noon_old_town: 'oldtown', noon_takoyaki_row: 'oldtown', noon_shrine_steps: 'oldtown',
  noon_old_town_burning: 'burning', noon_lakeside_shrine: 'burning',
  // Act 4 (the Checkpoint): the mountain highway, its tunnel mouth in snow, then the far north: the frozen
  // villages, and the snow bridge over the ravine in a blizzard
  noon_toll_plaza: 'highway', noon_checkpoint: 'highway', noon_tunnel_mouth: 'highwaySnow',
  north_frozen_villages: 'north', north_snow_bridge: 'northBridge',
};

/** A painted place's own picture for a time of day (`<place>-sunset` / `<place>-night`), when one is listed. */
const PLACE_TIME_SUFFIX = { dusk: 'sunset', night: 'night' };

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
    const time = timeOfBackground(id);
    const painted = placeOfStage(stageId);
    if (painted) {
      const timed = time ? `${painted}-${PLACE_TIME_SUFFIX[time]}` : null;
      const place = timed && BACKGROUNDS[timed] ? timed : painted;
      return { ...resolveBackground(place, chapter), id, stageId, place, time, fallback: true };
    }
    // an Act II stage (Gate Arc: the Noon city, not the academy) without a painted place shows its map theme's skyline
    const st = STAGE_MAP[stageId];
    const theme = st?.act === 2 ? MAP_MAP[st.mapId]?.theme : null;
    if (theme) return { id, kind: 'svg', html: themeBackdropSVG(theme, { variant: PLACE_VARIANT[st.mapId] ?? null, time }), stageId, time, fallback: true };
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

/** How long a new background may keep the scene waiting before it fades in anyway (its picture still decoding). */
export const BG_READY_CAP_MS = 2500;

/**
 * Resolves true once an <img> has loaded and decoded, false if it failed (no img, e.g. a solid layer: true at
 * once). No time cap (callers race it against one when they must not wait). Never rejects.
 * @param {{ decode?: () => Promise<void>, complete?: boolean, naturalWidth?: number, addEventListener?: Function } | null} img
 * @returns {Promise<boolean>}
 */
export function imageDecoded(img) {
  if (!img) return Promise.resolve(true);
  const painted = () => !!(img.complete && img.naturalWidth > 0);
  if (img.decode) return img.decode().then(() => true, () => painted());
  return new Promise((r) => {
    if (img.complete) return r(painted());
    img.addEventListener('load', () => r(true), { once: true });
    img.addEventListener('error', () => r(false), { once: true });
  });
}

/** Safety net after the 'on' class: a layer counts as faded in even if its transitionend never comes. */
export const FADE_FALLBACK_MS = FADE_MS + 250;

/**
 * The layers that can go: every layer beneath the topmost one that fully covers the screen (faded in and its
 * picture decoded). Nothing goes while no layer covers, so the screen always has a layer at full opacity, and a
 * second swap that arrives mid-fade just becomes the new top: whichever layer finishes first only clears what is
 * beneath it, never a layer above it.
 * @template T
 * @param {T[]} layers bottom to top (DOM order)
 * @param {(layer: T) => boolean} covers
 * @returns {T[]}
 */
export function layersToDrop(layers, covers) {
  for (let i = layers.length - 1; i >= 0; i--) if (covers(layers[i])) return layers.slice(0, i);
  return [];
}

/**
 * Resolves once `layer` has finished its opacity fade: its own transitionend for opacity (not a child's, not
 * another property), or `fallbackMs` later if that event never comes (tab hidden, transition cancelled). Call it
 * when the 'on' class is added, so the fallback counts from the start of the fade.
 * @param {{ addEventListener: Function, removeEventListener: Function }} layer
 * @param {{ fallbackMs?: number, setTimer?: Function, clearTimer?: Function }} [o]
 * @returns {Promise<void>}
 */
export function fadedIn(layer, { fallbackMs = FADE_FALLBACK_MS, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  return new Promise((resolve) => {
    let timer = null;
    const done = () => {
      layer.removeEventListener('transitionend', onEnd);
      clearTimer(timer);
      resolve();
    };
    const onEnd = (e) => {
      if (e.target === layer && e.propertyName === 'opacity') done();
    };
    layer.addEventListener('transitionend', onEnd);
    timer = setTimer(done, fallbackMs);
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

  /** Layers that are fully in (faded in and decoded): the ones that may cover what is beneath them. */
  const covering = new WeakSet();
  function prune() {
    for (const o of layersToDrop([...el.children], (l) => covering.has(l))) o.remove();
  }

  function swap(layer, instant) {
    layer.classList.add('sp-bg-in');
    if (instant) layer.classList.add('sp-bg-instant');
    el.appendChild(layer);
    // every place is its own picture now. The new layer fades in once its picture has decoded, or after
    // BG_READY_CAP_MS so a slow picture never holds the scene up. The layers beneath it go only once it has really
    // faded in (its opacity transitionend, or FADE_FALLBACK_MS after 'on') and its picture has decoded, so the
    // screen always has a layer at full opacity and a slow frame never shows black between two places. A picture
    // that fails keeps the old one under it (the next swap clears both).
    const decoded = imageDecoded(layer.querySelector('img'));
    let faded;
    if (instant) faded = Promise.resolve();
    else {
      faded = Promise.race([decoded, new Promise((r) => setTimeout(r, BG_READY_CAP_MS))]).then(
        () =>
          new Promise((resolve) => {
            // two frames so the opacity transition runs; the fallback timer starts with the fade, not before
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                layer.classList.add('on');
                fadedIn(layer).then(resolve);
              }),
            );
          }),
      );
    }
    Promise.all([decoded, faded]).then(([ok]) => {
      if (!ok || !layer.isConnected) return;
      covering.add(layer);
      prune();
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
