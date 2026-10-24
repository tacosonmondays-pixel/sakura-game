// Drawn lobby stage ("memorial lobby" style): the secretary is a full-screen
// illustration instead of a 3D chibi (owner: "could it be a drawn background instead like blue
// archive?"). Same API as the old createSecretaryStage so lobby.js barely changes:
//   await stage.show(unitDef, { direction, background })   swap art (slide + fade)
//   stage.react('head' | 'body', at)           tap bounce + hearts
//   stage.say(text)                            speech bubble near her face (her stand only)
//   stage.look(nx, ny)                         parallax (-1..1)
//   stage.hideBubble(), stage.dispose()
// The picture is a lobby background (src/data/lobbyArt.js), drawn in one of two modes (stageModeOf), the picker's
// two categories:
//   stand  Backdrops: her drawn stand over the painted academy in a day / sunset / night tint, with her speech
//          bubble beside her face. Every girl's default.
//   full   Full illustrations (src/data/lobbyIllustrations.js): the picture IS the whole lobby, full bleed, with no
//          stand, no academy behind it and NO speech bubble (owner: "you dont need the speech bubbles for these full
//          illustration ones"). The crop is anchored on her face so it stays clear of the menus (sceneLayout.js),
//          and head pats (hearts only) use her real face; a `tall` row shows her 3:4 full art on a portrait screen.
// Every girl has drawn art (src/art/portraits.js); the SVG card stays only as a fallback for unknown ids.
import { h } from '../dom.js';
import { cardArtSVG } from '../../art/cardArt.js';
import { portraitUrl, portraitHTML } from '../../art/portraits.js';
import { lobbyArtUrl, bgArtUrl, stageModeOf, LOBBY_BG_MAP, defaultBackgroundFor } from '../../data/lobbyArt.js';
import { fullArt } from '../../data/lobbyIllustrations.js';
import { anchorFace, headHit } from './sceneLayout.js';

/** Where the bubble/head zone sits for stands (her stand is centred at ~55%, head under the HUD). */
const CUT_FACE = [55, 25];
/** The room the bubble leaves between itself and the HUD pieces it keeps clear of (px). */
const BUBBLE_GAP = 8;
/** Narrower than this, the bubble may step closer to her face instead (px). */
const BUBBLE_MIN_W = 168;

/** An element's box as laid out (its transforms aside: the HUD's entrance slide, the bubble's pop), in page px. */
function laidOut(el) {
  let x = 0;
  let y = 0;
  for (let e = el; e; e = e.offsetParent) {
    x += e.offsetLeft;
    y += e.offsetTop;
  }
  return { left: x, top: y, right: x + el.offsetWidth, bottom: y + el.offsetHeight };
}

/**
 * @param {HTMLElement} host
 * @param {{ reduceMotion?: boolean, lowGfx?: boolean, onTap?: Function|null, avoid?: (() => Element[])|null,
 *   obstacles?: (() => object[])|null, onLayout?: ((at: { face: {x:number,y:number}, r: number }|null) => void)|null,
 *   backdrop?: { file: string, thumb: string }|null }} [opts]
 *   lowGfx: the Low graphics setting (a full illustration then holds still: no breathing, no parallax);
 *   avoid: the HUD pieces at her left her speech bubble keeps clear of (the lobby's tray and sticker row);
 *   backdrop: a painted backdrop behind every stand instead of the academy (an event's, eventLobbyBackdrop), with
 *   its own lighting, so no day / sunset / night tint is laid over it;
 *   obstacles(): the menu boxes { l, t, r, b } in host px, kept clear of her face (full illustrations);
 *   onLayout(at): after a full illustration is shown or re-cropped, where her face is in host px (null when the
 *   picture on screen is her stand), so the screen can keep its decor off her head
 */
export function createArtStage(host, { reduceMotion = false, lowGfx = false, onTap = null, avoid = null, obstacles = null, onLayout = null, backdrop = null } = {}) {
  host.classList.add('lb-art-host');
  const frame = h('div.lb-art', { 'data-testid': 'secretary-art' });
  const hearts = h('div.lb-art-fx');
  const bubble = h('div.lb-bubble', { 'aria-live': 'polite', 'data-testid': 'secretary-bubble' }, h('span.lb-bubble-text'));
  host.append(frame, hearts, bubble);
  let face = CUT_FACE;
  let bubbleRight = 100 - CUT_FACE[0] + 9;
  let bubbleTimer = 0;
  let disposed = false;
  let current = null;
  /** the full illustration on screen: { layer, img, id, art, fit } (null for her stand) */
  let full = null;
  const still = reduceMotion || lowGfx;

  const portraitScreen = () => (host.clientHeight || 0) > (host.clientWidth || 0);
  const hudBoxes = () => {
    try {
      return (obstacles && obstacles()) || [];
    } catch {
      return [];
    }
  };
  /** onLayout: her face on screen now (full illustration), or null */
  const notify = () => {
    try {
      onLayout?.(full?.fit ? { face: full.fit.face, r: full.fit.r } : null);
    } catch (e) {
      console.warn('[lobby] onLayout failed', e);
    }
  };

  /** Crops a full illustration on her face for the current screen size (and swaps wide ↔ 3:4 art when the screen turns). */
  function layoutFull(f) {
    const W = host.clientWidth;
    const H = host.clientHeight;
    if (!W || !H) return null;
    const art = fullArt(f.id, { portrait: H > W });
    if (art.src !== f.art.src) {
      f.art = art;
      f.img.width = art.w;
      f.img.height = art.h;
      f.img.src = art.src;
      f.layer.dataset.variant = art.variant;
    }
    const fr = { x: frame.offsetLeft, y: frame.offsetTop, w: frame.clientWidth || W, h: frame.clientHeight || H };
    const fit = anchorFace({ W, H, frame: fr, iw: art.w, ih: art.h, fx: art.fx, fy: art.fy, obstacles: hudBoxes(), headR: art.headR });
    f.img.style.objectPosition = `${fit.posX.toFixed(2)}% ${fit.posY.toFixed(2)}%`;
    const fpx = ((fit.face.x - fr.x) / fr.w) * 100;
    f.img.style.transformOrigin = `${fpx.toFixed(1)}% 100%`;
    f.fit = { ...fit, frame: fr, W, H };
    face = [fpx, ((fit.face.y - fr.y) / fr.h) * 100];
    host.dataset.face = `${Math.round(fit.face.x)},${Math.round(fit.face.y)},${Math.round(fit.r)}`;
    return f.fit;
  }

  function build(u, bg) {
    const layer = h('div.lb-art-layer', { dataset: { bg: bg?.id || '' } });
    const art = stageModeOf(bg) === 'full' ? fullArt(bg.id, { portrait: portraitScreen() }) : null;
    if (art) {
      layer.classList.add('full');
      if (still) layer.classList.add('still');
      layer.dataset.variant = art.variant;
      // the box is reserved (full bleed, intrinsic size known) and the crop set before the file arrives: no shift on load
      const img = h('img.lb-art-full', { src: art.src, width: art.w, height: art.h, alt: bg.name || u.name, draggable: false, decoding: 'async' });
      layer.append(img);
      return { layer, full: { layer, img, id: bg.id, art, fit: null } };
    }
    layer.classList.add('stand', backdrop ? 'tint-event' : `tint-${bg?.tint || 'day'}`);
    layer.append(h('img.lb-art-bg', { src: lobbyArtUrl(backdrop?.file || bg?.file || 'academy.webp'), alt: '', draggable: false, decoding: 'async' }), h('div.lb-art-tint'));
    const girl = h('div.lb-art-girl');
    // her drawn stand (half-body stands fade where the frame cut them — portraits.js)
    if (portraitUrl(u, 'cut')) girl.innerHTML = portraitHTML(u, 'cut', { eager: true });
    else {
      girl.classList.add('card');
      girl.innerHTML = cardArtSVG(u, { variant: 'full' });
    }
    layer.append(girl);
    face = CUT_FACE;
    return { layer, full: null };
  }

  async function show(u, { direction = 0, background = null } = {}) {
    if (!u || disposed) return;
    const bg = background || LOBBY_BG_MAP[defaultBackgroundFor(u.id)];
    const built = build(u, bg);
    const next = built.layer;
    if (direction && !reduceMotion) next.classList.add(direction > 0 ? 'enter-r' : 'enter-l');
    if (built.full) {
      layoutFull(built.full);
      bubble.classList.remove('show'); // a full illustration has no speech bubble
    }
    // first picture: its small painted thumb sits behind at once, so the lobby never shows an
    // empty backdrop while the full art (usually already preloaded by the title) decodes
    if (!current && bg?.thumb) {
      if (!built.full) frame.style.backgroundImage = `url("${lobbyArtUrl(backdrop?.thumb || bg.thumb)}")`;
      else if (built.full.art.variant === 'wide') {
        // the thumb has the picture's aspect, so the same position lines it up with the art
        frame.style.backgroundImage = `url("${bgArtUrl(bg, 'thumb')}")`;
        frame.style.backgroundPosition = built.full.img.style.objectPosition;
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
    full = built.full;
    host.classList.toggle('lb-illustration', !!full);
    if (full) {
      layoutFull(full); // the menus may have moved while the art decoded
      bubble.classList.remove('show');
      if (lowGfx) look0();
    } else delete host.dataset.face;
    notify();
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
    if (full?.fit) {
      const f = full.fit;
      // her face in the same frame-local px as the tap
      const local = { x: f.face.x - f.frame.x, y: f.face.y - f.frame.y };
      head = headHit(((e.clientX - r.left) / r.width) * f.frame.w, ((e.clientY - r.top) / r.height) * f.frame.h, local, f.r);
    } else head = Math.abs(x - face[0]) < 12 && Math.abs(y - face[1]) < 14;
    onTap?.(head ? 'head' : 'body', { x, y });
  });

  function react(part, at = null) {
    if (!current || reduceMotion) return;
    // her stand bounces; a full illustration stays put (the whole screen would squash) and only the hearts rise
    const target = current.querySelector('.lb-art-girl');
    if (target) {
      target.classList.remove('bounce');
      void target.offsetWidth;
      target.classList.add('bounce');
    }
    const n = part === 'head' ? 3 : 1;
    const f = full?.fit;
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

  /** Her speech bubble, to the left of her stand's face. A full illustration has none: the call does nothing. */
  function say(text, ms = 6500) {
    if (disposed || !text) return;
    if (full) {
      bubble.classList.remove('show');
      return;
    }
    const span = bubble.firstElementChild;
    bubble.classList.remove('show');
    void bubble.offsetWidth;
    span.textContent = text;
    // bubble to the left of her face (tail pointing at her), kept on screen
    bubble.style.left = 'auto';
    bubbleRight = Math.min(70, 100 - face[0] + 9);
    bubble.style.top = `${Math.max(14, face[1] - 6)}%`;
    fit();
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    if (ms) bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
  }

  /**
   * UI M5d review: the bubble never slides under the HUD at her left (the lobby's tray, the sticker row under it). Its
   * left edge stops BUBBLE_GAP px right of whatever shares its rows and it narrows into more lines instead (a narrower
   * bubble grows downward, so the rows are checked again until nothing beside it is left). Narrowed, it takes slimmer
   * padding, and below BUBBLE_MIN_W it may come closer to her face (to 4% of the width and its tail) rather than turn
   * into a thin column on the smallest phones.
   */
  function fit() {
    bubble.style.maxWidth = '';
    bubble.style.right = `${bubbleRight}%`;
    bubble.classList.remove('tight');
    const els = (avoid?.() || []).filter((e) => e?.offsetWidth);
    if (!els.length) return;
    const hb = laidOut(host);
    const nearest = hb.left + (host.offsetWidth * (face[0] - 4)) / 100 - 9;
    for (let pass = 0; pass < 4; pass++) {
      const b = laidOut(bubble);
      let left = -Infinity;
      for (const el of els) {
        const r = laidOut(el);
        if (r.bottom + BUBBLE_GAP <= b.top || r.top >= b.bottom + BUBBLE_GAP || r.left >= b.right) continue;
        left = Math.max(left, r.right + BUBBLE_GAP);
      }
      if (left <= b.left) return;
      let right = b.right;
      if (right - left < BUBBLE_MIN_W && right < nearest) {
        right = Math.min(nearest, left + BUBBLE_MIN_W);
        bubble.style.right = `${Math.round(hb.right - right)}px`;
      }
      bubble.classList.add('tight');
      bubble.style.maxWidth = `${Math.max(0, Math.floor(right - left))}px`;
    }
  }
  function look(nx, ny) {
    if (reduceMotion || (full && lowGfx)) return;
    host.style.setProperty('--ax', nx.toFixed(3));
    host.style.setProperty('--ay', ny.toFixed(3));
  }
  /** back to the centre (a full illustration on Low graphics holds still) */
  function look0() {
    host.style.removeProperty('--ax');
    host.style.removeProperty('--ay');
  }

  // the screen turned or resized: her stand's speech bubble is fitted again while it shows (a turned phone, a resized
  // window); a full illustration is cropped again on her face
  let resizeRaf = 0;
  const onResize = () => {
    if (!full && bubble.classList.contains('show')) fit();
    if (resizeRaf || !full) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (!full || disposed || (full.fit && full.fit.W === host.clientWidth && full.fit.H === host.clientHeight)) return;
      layoutFull(full);
      notify();
    });
  };
  globalThis.addEventListener?.('resize', onResize);

  function dispose() {
    disposed = true;
    clearTimeout(bubbleTimer);
    cancelAnimationFrame(resizeRaf);
    globalThis.removeEventListener?.('resize', onResize);
    host.classList.remove('lb-art-host', 'lb-illustration');
    delete host.dataset.face;
    host.replaceChildren();
  }

  return { show, react, say, look, dispose, hideBubble: () => bubble.classList.remove('show') };
}
