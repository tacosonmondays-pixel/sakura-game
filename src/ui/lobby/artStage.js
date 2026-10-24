// The home's stage (UI v2 "Ink & Paper" V2, notes/ui-v2/UI_V2_DIRECTION.md 12.1 and 5.5): the night scene, the scrims,
// the secretary and her speech bubble, in the direction's layers:
//   scene 0 (the baked "-home" painting, or her living scene's canvas) · scrims left, top and right 1 · the host 2 ·
//   the bottom scrim 3 · the home's UI 4 (src/ui/screens/lobby.js) · its top bar 10 · sheets 20+.
// So her art can never cover a control, and the scrims seat the UI on the scene.
//
//   const stage = createArtStage(host, { reduceMotion, onTap, boxes })
//   await stage.show(unitDef, { background })   her picture (the stand over a baked painting, or a scene painting)
//   stage.relayout()                            placed again (a resize, the UI drawn again)
//   stage.say(text) / stage.hideBubble()        her bubble: on a tap only, 2.4 s, under her face, never over a control
//   stage.liveHost()                            the slot her living scene's canvas goes in (src/ui/lobby/live/)
//   stage.setLive(on)                           the canvas shown in place of the painting and her still picture
//   stage.dispose()
//
// Where she stands: her face anchor (src/ui/faceAnchors.js) on the home's face spot, her art 8 px clear of every
// control (src/ui/lobby/hostPlace.js placeHost; boxes() gives the controls' boxes). A painted scene with her inside it
// (the three scene backgrounds) is zoomed and panned instead, so her face lands on the spot (placeScene). Her still
// picture breathes at 1 % over 4.5 s (the direction's Q10; off under Reduce motion).
import { h } from '../dom.js';
import { cardArtSVG } from '../../art/cardArt.js';
import { portraitUrl, portraitHTML } from '../../art/portraits.js';
import { lobbyArtUrl, LOBBY_BG_MAP, defaultBackgroundFor } from '../../data/lobbyArt.js';
import { faceAnchor, cutExtents } from '../faceAnchors.js';
import { placeHost, placeScene, homeTarget } from './hostPlace.js';

/** Her bubble: shown for this long after a tap (12.1). */
export const BUBBLE_MS = 2400;
/** The bubble's width (phone, desktop). */
const BUBBLE_W = { phone: 222, desk: 300 };

/** The baked night copy of a lobby painting (tools/art/bakeHome.mjs): academy.webp → academy-home.webp. */
export function homeArt(file) {
  return String(file || 'academy.webp').replace(/\.webp$/, '-home.webp');
}

/** An element's box in viewport px. */
const rectOf = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

/**
 * @param {HTMLElement} host
 * @param {{ reduceMotion?: boolean, onTap?: ((part: 'head'|'body') => void)|null, boxes?: (() => {x:number,y:number,w:number,h:number}[])|null }} [o]
 */
export function createArtStage(host, { reduceMotion = false, onTap = null, boxes = null } = {}) {
  host.classList.add('home-stage');
  const scene = h('div.ui-scene.home-scene', { 'data-testid': 'lobby-scene' });
  const live = h('div.home-live', { 'data-testid': 'lobby-live', hidden: true });
  const decor = h('div.home-decor');
  const scrims = [h('div.ui-scrim.l'), h('div.ui-scrim.t'), h('div.ui-scrim.r')];
  const frame = h('div.home-host', { 'data-testid': 'secretary-art' });
  const bottom = h('div.ui-scrim.b');
  const bubble = h('div.ui-bubble.home-bubble', { role: 'status', 'aria-live': 'polite', 'data-testid': 'secretary-bubble' }, h('span.home-bubble-text'));
  host.append(scene, live, decor, ...scrims, frame, bottom, bubble);

  let disposed = false;
  let current = null; // { u, bg, kind, img, aspect, anchor, extents, face }
  let placed = null;
  let bubbleTimer = 0;
  let liveOn = false;

  function build(u, bg) {
    const layer = h('div.home-scene-layer');
    const tint = bg?.tint && bg.tint !== 'day' ? h(`div.home-tint.tint-${bg.tint}`) : null;
    if (bg?.kind === 'scene') {
      // a painting with her inside it: the whole painting is placed (zoomed, panned) so her face is on the spot
      const img = h('img.baked.home-scene-art', { src: lobbyArtUrl(homeArt(bg.file)), alt: u.name, draggable: false, decoding: 'async' });
      layer.append(img, h('div.lift'));
      return { layer, kind: 'scene', sceneImg: img, fig: null, face: bg.face || [55, 28] };
    }
    const img = h('img.baked', { src: lobbyArtUrl(homeArt(bg?.file || 'academy.webp')), alt: '', draggable: false, decoding: 'async' });
    layer.append(img);
    if (tint) layer.append(tint);
    layer.append(h('div.lift'));
    const fig = h('div.home-fig');
    if (portraitUrl(u, 'cut')) fig.innerHTML = portraitHTML(u, 'cut', { eager: true, alt: `${u.name}, the secretary` });
    else {
      fig.classList.add('card');
      fig.innerHTML = cardArtSVG(u, { variant: 'full' });
    }
    return { layer, kind: 'stand', sceneImg: img, fig, face: null };
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
    frame.classList.toggle('scene-girl', next.kind === 'scene');
    current = { u, bg, kind: next.kind, sceneImg: next.sceneImg, fig: next.fig, aspect, face: next.face, anchor: faceAnchor(u.id, 'cut'), extents: cutExtents(u.id) };
    hideBubble();
    relayout();
  }

  /** Places her (and her bubble's spot) for the screen and the controls on it now. */
  function relayout() {
    // (her living scene places her itself: the lobby lays it out and calls setLivePlacement)
    if (!current || disposed || liveOn) return;
    const W = host.clientWidth || globalThis.innerWidth || 1;
    const H = host.clientHeight || globalThis.innerHeight || 1;
    const ui = boxes?.() || [];
    if (current.kind === 'scene') {
      const im = current.sceneImg;
      const aspect = im.naturalWidth ? im.naturalWidth / im.naturalHeight : 1376 / 768;
      const p = placeScene({ W, H, aspect, face: [current.face[0] / 100, current.face[1] / 100] });
      im.style.inset = 'auto';
      Object.assign(im.style, { left: `${p.left}px`, top: `${p.top}px`, width: `${p.width}px`, height: `${p.height}px` });
      // her tap area: around her face and down her figure
      const fx = p.faceX;
      const fw = Math.max(120, W * 0.2);
      Object.assign(frame.style, { left: `${fx - fw / 2}px`, top: `${Math.max(0, p.faceY - H * 0.16)}px`, width: `${fw}px`, height: `${H - Math.max(0, p.faceY - H * 0.16)}px` });
      placed = { faceX: fx, faceY: p.faceY, face: { x: fx - W * 0.08, y: p.faceY - H * 0.15, w: W * 0.16, h: H * 0.27 }, scene: p };
      host.style.setProperty('--hx', `${(fx / W) * 100}%`);
      host.style.setProperty('--hy', `${(p.faceY / H) * 100 + 14}%`);
    } else {
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

  function say(text, ms = BUBBLE_MS) {
    if (disposed || !text) return;
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
    host.classList.remove('home-stage', 'is-live');
    host.replaceChildren();
  }

  return {
    show, relayout, say, hideBubble, setLive, setLivePlacement, dispose,
    isLive: () => liveOn,
    liveHost: () => live,
    decorHost: () => decor,
    placement: () => placed,
    current: () => current,
    rectOf,
  };
}
