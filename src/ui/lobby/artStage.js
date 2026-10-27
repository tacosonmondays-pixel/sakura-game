// The home's stage (UI v2 "Ink & Paper" V2, notes/ui-v2/UI_V2_DIRECTION.md 12.1 and 5.5): the night scene, the scrims,
// the secretary and her speech bubble, in the direction's layers:
//   scene 0 (the baked "-home" painting, or her living scene's canvas) · scrims left, top and right 1 · the host 2 ·
//   the bottom scrim 3 · the home's UI 4 (src/ui/screens/lobby.js) · its top bar 10 · sheets 20+.
// So her art can never cover a control, and the scrims seat the UI on the scene.
//
//   const stage = createArtStage(host, { reduceMotion, onTap, boxes, backdrop })
//   await stage.show(unitDef, { background })   her picture (her stand over a painting, or a full illustration)
//   stage.relayout()                            placed again (a resize, the UI drawn again)
//   stage.say(text) / stage.hideBubble()        her bubble: on a tap only, 2.4 s, under her face, never over a control
//   stage.liveHost()                            the slot her living scene's canvas goes in (src/ui/lobby/live/)
//   stage.setLive(on)                           the canvas shown in place of the painting and her still picture
//   stage.dispose()
//
// The picture is a lobby background (src/data/lobbyArt.js), drawn in one of the picker's two categories (stageModeOf):
//   stand  Backdrops: her drawn stand over the painted academy (the baked night copy), in her day / sunset / night
//          tint; while an event runs, over its painted backdrop instead (backdrop: eventLobbyBackdrop, v0.1.51), with
//          no tint (it has its own lighting). Every girl's default.
//   full   Full illustrations (src/data/lobbyIllustrations.js, v0.1.48): the picture IS the whole scene, with no stand
//          and NO speech bubble (owner: "you dont need the speech bubbles for these full illustration ones"); a `tall`
//          row shows her 3:4 full art on a portrait screen.
// Where she stands: her face anchor (src/ui/faceAnchors.js) on the home's face spot, her art 8 px clear of every
// control (src/ui/lobby/hostPlace.js placeHost; boxes() gives the controls' boxes). A full illustration cannot move her
// alone: the whole picture is zoomed and panned so her face (the row's face point) lands on the spot (placeFull over
// hostPlace.js placeScene), between the rail and the right stack, a little lower when a control would stand over her
// hair there, so no control covers her face. Her still stand breathes at 1 % over 4.5 s (the
// direction's Q10; off under Reduce motion).
// A painting with a baked night copy (HOME_BAKED, tools/art/bakeHome.mjs) shows that copy; any other picture (the event
// backdrop, the newer full illustrations, her 3:4 full art) takes the kit's night grade in CSS instead (home.css
// .graded), so the text over the scene keeps its contrast.
import { h } from '../dom.js';
import { cardArtSVG } from '../../art/cardArt.js';
import { portraitUrl, portraitHTML } from '../../art/portraits.js';
import { lobbyArtUrl, stageModeOf, LOBBY_BG_MAP, defaultBackgroundFor } from '../../data/lobbyArt.js';
import { fullArt, FULL_ILLUSTRATION_MAP } from '../../data/lobbyIllustrations.js';
import { faceAnchor, cutExtents } from '../faceAnchors.js';
import { placeHost, placeScene, homeTarget } from './hostPlace.js';

/** Her bubble: shown for this long after a tap (12.1). */
export const BUBBLE_MS = 2400;
/** The bubble's width (phone, desktop). */
const BUBBLE_W = { phone: 222, desk: 300 };

/** The lobby paintings (public/art/lobby/) that have a baked night copy beside them (<name>-home.webp). */
export const HOME_BAKED = Object.freeze(['academy.webp', 'hikari.webp', 'aoi.webp', 'sango.webp']);

/** The baked night copy of a lobby painting (tools/art/bakeHome.mjs): academy.webp → academy-home.webp. */
export function homeArt(file) {
  return String(file || 'academy.webp').replace(/\.webp$/, '-home.webp');
}

/**
 * The picture behind her stand: the baked night copy of a lobby painting, or (no copy: an event's backdrop) the
 * painting itself, graded in CSS.
 * @param {string} file a picture in public/art/lobby/
 * @returns {{ src: string, baked: boolean }}
 */
export function homeBackdropArt(file = 'academy.webp') {
  return HOME_BAKED.includes(file) ? { src: lobbyArtUrl(homeArt(file)), baked: true } : { src: lobbyArtUrl(file), baked: false };
}

/**
 * A full illustration as the home draws it on this screen (lobbyIllustrations.js fullArt): an older lobby scene's baked
 * night copy when it has one, else its own picture (graded in CSS); fx / fy = her face as fractions of the picture.
 * @param {string} id a FULL_ILLUSTRATIONS id
 * @param {{ portrait?: boolean }} [opts]
 * @returns {{ variant: 'wide'|'tall', src: string, w: number, h: number, fx: number, fy: number, headR: number, baked: boolean }|null}
 */
export function homeFullArt(id, { portrait = false } = {}) {
  const art = fullArt(id, { portrait });
  if (!art) return null;
  const file = FULL_ILLUSTRATION_MAP[id]?.file || '';
  const name = art.variant === 'wide' && file.startsWith('lobby/') ? file.slice('lobby/'.length) : null;
  if (name && HOME_BAKED.includes(name)) return { ...art, src: lobbyArtUrl(homeArt(name)), baked: true };
  return { ...art, baked: false };
}

/**
 * A full illustration on the home: zoomed and panned so her face lands on the face spot (placeScene); when a control
 * stands over her face and hair there (±1.1 head radii across, 1.4 up, 1.0 down, as sceneLayout.js headHit, 8 px
 * clear), her face comes down a little, 4 px at a time, up to 12 % of the height. Pure.
 * @param {number} W
 * @param {number} H
 * @param {{ w: number, h: number, fx: number, fy: number, headR: number }} art
 * @param {{ x: number, y: number, w: number, h: number }[]} [boxes] the controls
 * @returns {ReturnType<typeof placeScene> & { r: number, clear: boolean }}
 */
export function placeFull(W, H, art, boxes = []) {
  const base = { x: homeTarget(W, H).x, y: H * 0.31 };
  const at = (dy) => {
    const p = placeScene({ W, H, aspect: art.w / art.h, face: [art.fx, art.fy], target: { x: base.x, y: base.y + dy } });
    const r = art.headR * p.height;
    const f = { x0: p.faceX - 1.1 * r - 8, x1: p.faceX + 1.1 * r + 8, y0: p.faceY - 1.4 * r - 8, y1: p.faceY + r + 8 };
    const clear = boxes.every((b) => b.x + b.w <= f.x0 || b.x >= f.x1 || b.y + b.h <= f.y0 || b.y >= f.y1);
    return { ...p, r, clear };
  };
  for (let dy = 0; dy <= H * 0.12; dy += 4) {
    const p = at(dy);
    if (p.clear) return p;
  }
  return at(0);
}

/** An element's box in viewport px. */
const rectOf = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

/**
 * @param {HTMLElement} host
 * @param {{ reduceMotion?: boolean, onTap?: ((part: 'head'|'body') => void)|null, boxes?: (() => {x:number,y:number,w:number,h:number}[])|null,
 *   backdrop?: { file: string, thumb?: string }|null }} [o]
 *   backdrop: an event's painted backdrop behind every stand instead of the academy (src/ui/events/lobby.js
 *   eventLobbyBackdrop), with its own lighting, so no day / sunset / night tint is laid over it
 */
export function createArtStage(host, { reduceMotion = false, onTap = null, boxes = null, backdrop = null } = {}) {
  host.classList.add('home-stage');
  const scene = h('div.ui-scene.home-scene', { 'data-testid': 'lobby-scene' });
  const live = h('div.home-live', { 'data-testid': 'lobby-live', hidden: true });
  const scrims = [h('div.ui-scrim.l'), h('div.ui-scrim.t'), h('div.ui-scrim.r')];
  const frame = h('div.home-host', { 'data-testid': 'secretary-art' });
  const bottom = h('div.ui-scrim.b');
  const bubble = h('div.ui-bubble.home-bubble', { role: 'status', 'aria-live': 'polite', 'data-testid': 'secretary-bubble' }, h('span.home-bubble-text'));
  host.append(scene, live, ...scrims, frame, bottom, bubble);

  let disposed = false;
  let current = null; // { u, bg, kind: 'stand'|'full', sceneImg, fig, aspect, art, anchor, extents }
  let placed = null;
  let bubbleTimer = 0;
  let liveOn = false;

  const portraitScreen = () => (host.clientHeight || globalThis.innerHeight || 0) > (host.clientWidth || globalThis.innerWidth || 0);

  function build(u, bg) {
    const layer = h('div.home-scene-layer', { dataset: { bg: bg?.id || '' } });
    if (stageModeOf(bg) === 'full') {
      // a full illustration: the whole picture is placed (zoomed, panned) so her face is on the spot; no stand
      const art = homeFullArt(bg.id, { portrait: portraitScreen() });
      const img = h(`img.home-scene-art${art.baked ? '.baked' : '.graded'}`, { src: art.src, width: art.w, height: art.h, alt: bg.name || u.name, draggable: false, decoding: 'async' });
      layer.classList.add('full');
      layer.dataset.variant = art.variant;
      layer.append(img, h('div.lift'));
      return { layer, kind: 'full', sceneImg: img, fig: null, art };
    }
    // her stand over the academy (baked at night) in her tint, or over the event's painted backdrop (no tint)
    const back = homeBackdropArt(backdrop?.file || bg?.file || 'academy.webp');
    const img = h(`img${back.baked ? '.baked' : '.graded'}`, { src: back.src, alt: '', draggable: false, decoding: 'async' });
    layer.append(img);
    const tint = !backdrop && bg?.tint && bg.tint !== 'day' ? h(`div.home-tint.tint-${bg.tint}`) : null;
    if (tint) layer.append(tint);
    layer.append(h('div.lift'));
    const fig = h('div.home-fig');
    if (portraitUrl(u, 'cut')) fig.innerHTML = portraitHTML(u, 'cut', { eager: true, alt: `${u.name}, the secretary` });
    else {
      fig.classList.add('card');
      fig.innerHTML = cardArtSVG(u, { variant: 'full' });
    }
    return { layer, kind: 'stand', sceneImg: img, fig, art: null };
  }

  const arrived = (img) => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 1500); }))
    .then(() => (img.decode && img.naturalWidth ? Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 600))]) : null));

  async function show(u, { background = null } = {}) {
    if (!u || disposed) return;
    const bg = background || LOBBY_BG_MAP[defaultBackgroundFor(u.id)];
    const next = build(u, bg);
    const imgs = [next.sceneImg, ...(next.fig ? next.fig.querySelectorAll('img') : [])];
    await Promise.all(imgs.map(arrived));
    if (disposed) return;
    const figImg = next.fig?.querySelector('img');
    const aspect = figImg?.naturalWidth ? figImg.naturalWidth / figImg.naturalHeight : 0.7;
    scene.replaceChildren(next.layer);
    frame.replaceChildren(...(next.fig ? [next.fig] : []));
    frame.classList.toggle('scene-girl', next.kind === 'full');
    host.classList.toggle('home-illustration', next.kind === 'full');
    current = { u, bg, kind: next.kind, sceneImg: next.sceneImg, fig: next.fig, aspect, art: next.art, anchor: faceAnchor(u.id, 'cut'), extents: cutExtents(u.id) };
    hideBubble();
    relayout();
  }

  /** A full illustration on a screen that turned: her wide picture ↔ her 3:4 full art (a `tall` row). */
  function swapFullArt() {
    const art = homeFullArt(current.bg.id, { portrait: portraitScreen() });
    if (!art || art.src === current.art.src) return;
    const im = current.sceneImg;
    im.width = art.w;
    im.height = art.h;
    im.src = art.src;
    im.classList.toggle('baked', art.baked);
    im.classList.toggle('graded', !art.baked);
    im.parentElement.dataset.variant = art.variant;
    current.art = art;
  }

  /** Places her (and her bubble's spot) for the screen and the controls on it now. */
  function relayout() {
    // (her living scene places her itself: the lobby lays it out and calls setLivePlacement)
    if (!current || disposed || liveOn) return;
    const W = host.clientWidth || globalThis.innerWidth || 1;
    const H = host.clientHeight || globalThis.innerHeight || 1;
    const ui = boxes?.() || [];
    if (current.kind === 'full') {
      swapFullArt();
      const im = current.sceneImg;
      const art = current.art;
      const p = placeFull(W, H, art, ui);
      im.style.inset = 'auto';
      Object.assign(im.style, { left: `${p.left}px`, top: `${p.top}px`, width: `${p.width}px`, height: `${p.height}px` });
      // her tap area: around her face and down her figure; her head: ±1.1 head radii across, 1.4 up, 1.0 down (as
      // sceneLayout.js headHit)
      const fx = p.faceX;
      const fw = Math.max(120, W * 0.2);
      const r = art.headR * p.height;
      const frameTop = Math.max(0, p.faceY - Math.max(H * 0.16, 1.5 * r));
      Object.assign(frame.style, { left: `${fx - fw / 2}px`, top: `${frameTop}px`, width: `${fw}px`, height: `${H - frameTop}px` });
      placed = { faceX: fx, faceY: p.faceY, face: { x: fx - 1.1 * r, y: p.faceY - 1.4 * r, w: 2.2 * r, h: 2.4 * r }, scene: p };
      host.dataset.face = `${Math.round(fx)},${Math.round(p.faceY)},${Math.round(r)}`;
      host.style.setProperty('--hx', `${(fx / W) * 100}%`);
      host.style.setProperty('--hy', `${(p.faceY / H) * 100 + 14}%`);
    } else {
      delete host.dataset.face;
      // a phone held upright: the controls stand under her, so her picture fades out 8 px above the first of them
      const lower = W < H ? ui.filter((b) => b.y > H * 0.35).map((b) => b.y) : [];
      const clipY = lower.length ? Math.min(...lower) - 8 : null;
      const p = placeHost({ W, H, aspect: current.aspect, anchor: current.anchor, extents: current.extents, boxes: ui, target: homeTarget(W, H), clipY });
      Object.assign(frame.style, { left: `${p.left}px`, top: `${p.top}px`, width: `${p.width}px`, height: `${p.height}px` });
      frame.classList.toggle('floats', !!p.floats && clipY == null);
      frame.classList.toggle('clipped', clipY != null);
      if (clipY != null) frame.style.setProperty('--clip', `${Math.max(0, clipY - p.top)}px`);
      else frame.style.removeProperty('--clip');
      placed = p;
      host.style.setProperty('--hx', `${(p.faceX / W) * 100}%`);
      host.style.setProperty('--hy', `${((p.top + p.height * 0.42) / H) * 100}%`);
    }
    frame.dataset.fits = String(placed.fits !== false);
    if (bubble.classList.contains('show')) fitBubble();
  }

  frame.addEventListener('click', (e) => {
    if (!placed) return;
    const head = placed.face && e.clientY <= placed.face.y + placed.face.h && Math.abs(e.clientX - placed.faceX) <= placed.face.w / 2;
    onTap?.(head ? 'head' : 'body');
  });

  /** Under her face box, centred on her face, inside the band between the rail and the right stack. */
  function fitBubble() {
    if (!placed) return;
    const W = host.clientWidth || globalThis.innerWidth;
    const H = host.clientHeight || globalThis.innerHeight;
    const phone = H <= 480;
    const ui = boxes?.() || [];
    const fb = placed.face;
    const top = fb.y + fb.h + 10;
    // the free band at the bubble's rows: right of every control on the left, left of every control on the right
    let lo = 8;
    let hi = W - 8;
    for (const b of ui) {
      if (b.y + b.h < top - 4 || b.y > top + 90) continue;
      if (b.x + b.w / 2 < placed.faceX) lo = Math.max(lo, b.x + b.w + 8);
      else hi = Math.min(hi, b.x - 8);
    }
    const w = Math.max(160, Math.min(phone ? BUBBLE_W.phone : BUBBLE_W.desk, hi - lo));
    const left = Math.max(lo, Math.min(hi - w, placed.faceX - w / 2));
    Object.assign(bubble.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, '--tail-x': `${Math.max(16, Math.min(w - 16, placed.faceX - left))}px` });
  }

  /** Her bubble under her stand's face. A full illustration has none: the call does nothing. */
  function say(text, ms = BUBBLE_MS) {
    if (disposed || !text) return;
    if (current?.kind === 'full' && !liveOn) {
      hideBubble();
      return;
    }
    bubble.firstElementChild.textContent = text;
    fitBubble();
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    if (ms) bubbleTimer = setTimeout(hideBubble, ms);
  }
  function hideBubble() {
    clearTimeout(bubbleTimer);
    bubble.classList.remove('show');
  }

  function setLive(on) {
    liveOn = !!on;
    live.hidden = !liveOn;
    host.classList.toggle('is-live', liveOn);
    if (!liveOn) relayout();
  }

  /** Her living scene's placement (src/ui/lobby/live/marumi.js placeMarumi): her tap area and her bubble follow it. */
  function setLivePlacement(p) {
    if (!p) return;
    Object.assign(frame.style, { left: `${p.left}px`, top: `${p.top}px`, width: `${p.width}px`, height: `${p.height}px` });
    placed = p;
    frame.dataset.fits = String(p.fits !== false);
    if (bubble.classList.contains('show')) fitBubble();
  }

  const onResize = () => relayout();
  globalThis.addEventListener?.('resize', onResize);

  function dispose() {
    disposed = true;
    clearTimeout(bubbleTimer);
    globalThis.removeEventListener?.('resize', onResize);
    host.classList.remove('home-stage', 'is-live', 'home-illustration');
    delete host.dataset.face;
    host.replaceChildren();
  }

  return {
    show, relayout, say, hideBubble, setLive, setLivePlacement, dispose,
    isLive: () => liveOn,
    isIllustration: () => current?.kind === 'full',
    liveHost: () => live,
    placement: () => placed,
    current: () => current,
    rectOf,
  };
}
