// Drawn lobby stage ("memorial lobby" style): the secretary is a full-screen
// illustration instead of a 3D chibi (owner: "could it be a drawn background instead like blue
// archive?"). Same API as the old createSecretaryStage so lobby.js barely changes:
//   await stage.show(unitDef, { direction, background })   swap art (slide + fade)
//   stage.react('head' | 'body', at)           tap bounce + hearts
//   stage.say(text)                            speech bubble near her face
//   stage.look(nx, ny)                         parallax (-1..1)
//   stage.hideBubble(), stage.dispose()
// The picture is a lobby background (src/data/lobbyArt.js), drawn in one of three modes (stageModeOf):
//   whole  her whole scene IS the screen (src/data/lobbyScenes.js): full bleed, no backdrop, no cut-out; the crop is
//          anchored on her face so it stays clear of the menus (sceneLayout.js), the bubble sits beside her face
//          and head pats use her real face; a portrait screen shows her 3:4 full illustration the same way
//   scene  a full landscape scene with her in it (the older three)
//   stand  her drawn stand over the painted academy in a day / sunset / night tint
// Every girl has drawn art (src/art/portraits.js); the SVG card stays only as a fallback for unknown ids.
import { h } from '../dom.js';
import { cardArtSVG } from '../../art/cardArt.js';
import { portraitUrl, portraitHTML } from '../../art/portraits.js';
import { lobbyArtUrl, bgArtUrl, stageModeOf, LOBBY_BG_MAP, defaultBackgroundFor } from '../../data/lobbyArt.js';
import { wholeSceneArt, SCENE_HEAD_R } from '../../data/lobbyScenes.js';
import { anchorFace, placeBubble, headHit } from './sceneLayout.js';

/** Where the bubble/head zone sits for stands (her stand is centred at ~55%, head under the HUD). */
const CUT_FACE = [55, 25];

/**
 * @param {HTMLElement} host
 * @param {{ reduceMotion?: boolean, lowGfx?: boolean, onTap?: Function|null, obstacles?: (() => object[])|null }} [opts]
 *   lowGfx: the Low graphics setting (a whole scene then holds still: no breathing, no parallax);
 *   obstacles(): the menu boxes { l, t, r, b } in host px, kept clear of her face and the bubble (whole scenes)
 */
export function createArtStage(host, { reduceMotion = false, lowGfx = false, onTap = null, obstacles = null } = {}) {
  host.classList.add('lb-art-host');
  const frame = h('div.lb-art', { 'data-testid': 'secretary-art' });
  const hearts = h('div.lb-art-fx');
  const bubble = h('div.lb-bubble', { 'aria-live': 'polite', 'data-testid': 'secretary-bubble' }, h('span.lb-bubble-text'));
  host.append(frame, hearts, bubble);
  let face = CUT_FACE;
  let bubbleTimer = 0;
  let disposed = false;
  let current = null;
  /** the whole scene on screen: { layer, img, girl, art, fit } (null in the other modes) */
  let whole = null;
  const still = reduceMotion || lowGfx;

  const portraitScreen = () => (host.clientHeight || 0) > (host.clientWidth || 0);
  const hudBoxes = () => {
    try {
      return (obstacles && obstacles()) || [];
    } catch {
      return [];
    }
  };

  /** Crops a whole scene on her face for the current screen size (and swaps scene ↔ 3:4 art when the screen turns). */
  function layoutWhole(w) {
    const W = host.clientWidth;
    const H = host.clientHeight;
    if (!W || !H) return null;
    const art = wholeSceneArt(w.girl, { portrait: H > W });
    if (art.src !== w.art.src) {
      w.art = art;
      w.img.width = art.w;
      w.img.height = art.h;
      w.img.src = art.src;
      w.layer.dataset.variant = art.variant;
    }
    const fr = { x: frame.offsetLeft, y: frame.offsetTop, w: frame.clientWidth || W, h: frame.clientHeight || H };
    const fit = anchorFace({ W, H, frame: fr, iw: art.w, ih: art.h, fx: art.fx, fy: art.fy, obstacles: hudBoxes(), headR: SCENE_HEAD_R });
    w.img.style.objectPosition = `${fit.posX.toFixed(2)}% ${fit.posY.toFixed(2)}%`;
    const fpx = ((fit.face.x - fr.x) / fr.w) * 100;
    w.img.style.transformOrigin = `${fpx.toFixed(1)}% 100%`;
    w.fit = { ...fit, frame: fr, W, H };
    face = [fpx, ((fit.face.y - fr.y) / fr.h) * 100];
    host.dataset.face = `${Math.round(fit.face.x)},${Math.round(fit.face.y)},${Math.round(fit.r)}`;
    return w.fit;
  }

  function build(u, bg) {
    const layer = h('div.lb-art-layer', { dataset: { bg: bg?.id || '' } });
    const mode = stageModeOf(bg);
    if (mode === 'whole' && wholeSceneArt(u.id, { portrait: portraitScreen() })) {
      const art = wholeSceneArt(u.id, { portrait: portraitScreen() });
      layer.classList.add('whole');
      if (still) layer.classList.add('still');
      layer.dataset.variant = art.variant;
      // the box is reserved (full bleed, intrinsic size known) and the crop set before the file arrives: no shift on load
      const img = h('img.lb-art-whole', { src: art.src, width: art.w, height: art.h, alt: `${u.name}`, draggable: false, decoding: 'async' });
      layer.append(img);
      return { layer, whole: { layer, img, girl: u.id, art, fit: null } };
    }
    if (mode === 'scene') {
      layer.classList.add('scene');
      layer.append(h('img.lb-art-scene', { src: lobbyArtUrl(bg.file), alt: `${u.name}`, draggable: false, decoding: 'async' }));
      face = bg.face || CUT_FACE;
    } else {
      layer.classList.add('stand', `tint-${bg?.tint || 'day'}`);
      layer.append(h('img.lb-art-bg', { src: lobbyArtUrl(bg?.file || 'academy.webp'), alt: '', draggable: false, decoding: 'async' }), h('div.lb-art-tint'));
      const girl = h('div.lb-art-girl');
      // her drawn stand (half-body stands fade where the frame cut them — portraits.js)
      if (portraitUrl(u, 'cut')) girl.innerHTML = portraitHTML(u, 'cut', { eager: true });
      else {
        girl.classList.add('card');
        girl.innerHTML = cardArtSVG(u, { variant: 'full' });
      }
      layer.append(girl);
      face = CUT_FACE;
    }
    return { layer, whole: null };
  }

  async function show(u, { direction = 0, background = null } = {}) {
    if (!u || disposed) return;
    const bg = background || LOBBY_BG_MAP[defaultBackgroundFor(u.id)];
    const built = build(u, bg);
    const next = built.layer;
    if (direction && !reduceMotion) next.classList.add(direction > 0 ? 'enter-r' : 'enter-l');
    if (built.whole) layoutWhole(built.whole);
    // first picture: its small painted thumb sits behind at once, so the lobby never shows an
    // empty backdrop while the full art (usually already preloaded by the title) decodes
    if (!current && bg?.thumb) {
      if (!built.whole) frame.style.backgroundImage = `url("${lobbyArtUrl(bg.thumb)}")`;
      else if (built.whole.art.variant === 'scene') {
        // the thumb has the scene's aspect, so the same position lines it up with the art
        frame.style.backgroundImage = `url("${bgArtUrl(bg, 'thumb')}")`;
        frame.style.backgroundPosition = built.whole.img.style.objectPosition;
      }
    }
    // wait for every picture to be fetched AND decoded (a preloaded URL decodes in a frame or two)
    const arrived = (img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 1500); }))
      .then(() => (img.decode && img.naturalWidth ? Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 600))]) : null));
    await Promise.all([...next.querySelectorAll('img')].map(arrived));
    if (disposed) return;
    const prev = current;
    frame.append(next);
    current = next;
    whole = built.whole;
    host.classList.toggle('lb-whole', !!whole);
    if (whole) {
      layoutWhole(whole); // the menus may have moved while the art decoded
      if (lowGfx) look0();
    } else delete host.dataset.face;
    requestAnimationFrame(() => next.classList.remove('enter-r', 'enter-l'));
    if (prev) {
      prev.classList.add('leaving');
      setTimeout(() => prev.remove(), reduceMotion ? 0 : 420);
    }
  }

  /** A tap in frame px (the frame may be shifted by the parallax): head or body. */
  frame.addEventListener('click', (e) => {
    const r = frame.getBoundingClientRect();
    if (!r.width) return;
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    let head;
    if (whole?.fit) {
      const f = whole.fit;
      // her face in the same frame-local px as the tap
      const local = { x: f.face.x - f.frame.x, y: f.face.y - f.frame.y };
      head = headHit(((e.clientX - r.left) / r.width) * f.frame.w, ((e.clientY - r.top) / r.height) * f.frame.h, local, f.r);
    } else head = Math.abs(x - face[0]) < 12 && Math.abs(y - face[1]) < 14;
    onTap?.(head ? 'head' : 'body', { x, y });
  });

  function react(part, at = null) {
    if (!current || reduceMotion) return;
    const target = current.querySelector('.lb-art-girl') || current;
    target.classList.remove('bounce');
    void target.offsetWidth;
    target.classList.add('bounce');
    const n = part === 'head' ? 3 : 1;
    const f = whole?.fit;
    for (let i = 0; i < n; i++) {
      const heart = h('i.lb-art-heart', '♥');
      if (f) {
        // hearts in host px: where she was tapped (frame %), or over her head
        const hx = at ? f.frame.x + (at.x / 100) * f.frame.w : f.face.x;
        const hy = at ? f.frame.y + (at.y / 100) * f.frame.h : f.face.y;
        heart.style.left = `${Math.round(hx + (i - 1) * 0.3 * f.r)}px`;
        heart.style.top = `${Math.round(hy - 0.4 * f.r)}px`;
      } else {
        heart.style.left = `${(at?.x ?? face[0]) + (i - 1) * 3}%`;
        heart.style.top = `${(at?.y ?? face[1]) - 4}%`;
      }
      heart.style.animationDelay = `${i * 90}ms`;
      hearts.append(heart);
      setTimeout(() => heart.remove(), 1200);
    }
  }

  /** Whole scene: the bubble beside her face (sceneLayout.placeBubble), clear of her face and the menus. */
  function placeWholeBubble() {
    const f = whole.fit || layoutWhole(whole);
    if (!f) return;
    bubble.style.maxWidth = '';
    const measure = (maxW) => {
      bubble.style.maxWidth = maxW ? `${maxW}px` : '';
      return { w: bubble.offsetWidth, h: bubble.offsetHeight };
    };
    const plan = placeBubble({ face: f.face, r: f.r, W: f.W, H: f.H, obstacles: hudBoxes(), measure });
    bubble.style.maxWidth = plan.maxW ? `${plan.maxW}px` : '';
    bubble.style.right = 'auto';
    bubble.style.left = `${Math.round(plan.x)}px`;
    bubble.style.top = `${Math.round(plan.y)}px`;
    bubble.style.setProperty('--tail', `${Math.round(plan.tail)}px`);
    bubble.classList.remove('side-left', 'side-right', 'side-below');
    bubble.classList.add(`side-${plan.side}`);
  }

  function say(text, ms = 6500) {
    if (disposed || !text) return;
    const span = bubble.firstElementChild;
    bubble.classList.remove('show');
    void bubble.offsetWidth;
    span.textContent = text;
    if (whole) placeWholeBubble();
    else {
      // bubble to the left of her face (tail pointing at her), kept on screen
      bubble.classList.remove('side-left', 'side-right', 'side-below');
      bubble.style.maxWidth = '';
      bubble.style.left = 'auto';
      bubble.style.right = `${Math.min(70, 100 - face[0] + 9)}%`;
      bubble.style.top = `${Math.max(14, face[1] - 6)}%`;
    }
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    if (ms) bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
  }

  function look(nx, ny) {
    if (reduceMotion || (whole && lowGfx)) return;
    host.style.setProperty('--ax', nx.toFixed(3));
    host.style.setProperty('--ay', ny.toFixed(3));
  }
  /** back to the centre (a whole scene on Low graphics holds still) */
  function look0() {
    host.style.removeProperty('--ax');
    host.style.removeProperty('--ay');
  }

  // the screen turned or resized: crop her scene again and move a shown bubble with her face
  let resizeRaf = 0;
  const onResize = () => {
    if (resizeRaf || !whole) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (!whole || disposed || (whole.fit && whole.fit.W === host.clientWidth && whole.fit.H === host.clientHeight)) return;
      layoutWhole(whole);
      if (bubble.classList.contains('show')) placeWholeBubble();
    });
  };
  globalThis.addEventListener?.('resize', onResize);

  function dispose() {
    disposed = true;
    clearTimeout(bubbleTimer);
    cancelAnimationFrame(resizeRaf);
    globalThis.removeEventListener?.('resize', onResize);
    host.classList.remove('lb-art-host', 'lb-whole');
    delete host.dataset.face;
    host.replaceChildren();
  }

  return { show, react, say, look, dispose, hideBubble: () => bubble.classList.remove('show') };
}
