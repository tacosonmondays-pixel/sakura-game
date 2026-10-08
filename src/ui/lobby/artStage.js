// Drawn lobby stage (Blue Archive "memorial lobby" style): the secretary is a full-screen
// illustration instead of a 3D chibi (owner: "could it be a drawn background instead like blue
// archive?"). Same API as the old createSecretaryStage so lobby.js barely changes:
//   await stage.show(unitDef, { direction, background })   swap art (slide + fade)
//   stage.react('head' | 'body', at)           tap bounce + hearts
//   stage.say(text)                            speech bubble near her face
//   stage.look(nx, ny)                         parallax (-1..1)
//   stage.hideBubble(), stage.dispose()
// The picture is a lobby background (src/data/lobbyArt.js): a full landscape scene with her in
// it, or her drawn stand over the painted academy in a day / sunset / night tint. Every girl has
// drawn art (src/art/portraits.js); the SVG card stays only as a fallback for unknown ids.
import { h } from '../dom.js';
import { cardArtSVG } from '../../art/cardArt.js';
import { portraitUrl } from '../../art/portraits.js';
import { lobbyArtUrl, LOBBY_BG_MAP, defaultBackgroundFor } from '../../data/lobbyArt.js';

/** Where the bubble/head zone sits for stands (art box on the right). */
const CUT_FACE = [60, 22];

export function createArtStage(host, { reduceMotion = false, onTap = null } = {}) {
  host.classList.add('lb-art-host');
  const frame = h('div.lb-art', { 'data-testid': 'secretary-art' });
  const hearts = h('div.lb-art-fx');
  const bubble = h('div.lb-bubble', { 'aria-live': 'polite', 'data-testid': 'secretary-bubble' }, h('span.lb-bubble-text'));
  host.append(frame, hearts, bubble);
  let face = CUT_FACE;
  let bubbleTimer = 0;
  let disposed = false;
  let current = null;

  function build(u, bg) {
    const layer = h('div.lb-art-layer', { dataset: { bg: bg?.id || '' } });
    if (bg?.kind === 'scene') {
      layer.classList.add('scene');
      layer.append(h('img.lb-art-scene', { src: lobbyArtUrl(bg.file), alt: `${u.name}`, draggable: false, decoding: 'async' }));
      face = bg.face || CUT_FACE;
    } else {
      layer.classList.add('stand', `tint-${bg?.tint || 'day'}`);
      layer.append(h('img.lb-art-bg', { src: lobbyArtUrl(bg?.file || 'academy.webp'), alt: '', draggable: false, decoding: 'async' }), h('div.lb-art-tint'));
      const girl = h('div.lb-art-girl');
      const cut = portraitUrl(u, 'cut');
      if (cut) girl.append(h('img', { src: cut, alt: `${u.name}`, draggable: false, decoding: 'async' }));
      else {
        girl.classList.add('card');
        girl.innerHTML = cardArtSVG(u, { variant: 'full' });
      }
      layer.append(girl);
      face = CUT_FACE;
    }
    return layer;
  }

  async function show(u, { direction = 0, background = null } = {}) {
    if (!u || disposed) return;
    const bg = background || LOBBY_BG_MAP[defaultBackgroundFor(u.id)];
    const next = build(u, bg);
    if (direction && !reduceMotion) next.classList.add(direction > 0 ? 'enter-r' : 'enter-l');
    const imgs = [...next.querySelectorAll('img')].filter((img) => !img.complete);
    if (imgs.length) await Promise.all(imgs.map((img) => new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 1500); })));
    if (disposed) return;
    const prev = current;
    frame.append(next);
    current = next;
    requestAnimationFrame(() => next.classList.remove('enter-r', 'enter-l'));
    if (prev) {
      prev.classList.add('leaving');
      setTimeout(() => prev.remove(), reduceMotion ? 0 : 420);
    }
  }

  frame.addEventListener('click', (e) => {
    const r = frame.getBoundingClientRect();
    if (!r.width) return;
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    const head = Math.abs(x - face[0]) < 12 && Math.abs(y - face[1]) < 14;
    onTap?.(head ? 'head' : 'body', { x, y });
  });

  function react(part, at = null) {
    if (!current || reduceMotion) return;
    const target = current.querySelector('.lb-art-girl') || current;
    target.classList.remove('bounce');
    void target.offsetWidth;
    target.classList.add('bounce');
    const n = part === 'head' ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const heart = h('i.lb-art-heart', '♥');
      heart.style.left = `${(at?.x ?? face[0]) + (i - 1) * 3}%`;
      heart.style.top = `${(at?.y ?? face[1]) - 4}%`;
      heart.style.animationDelay = `${i * 90}ms`;
      hearts.append(heart);
      setTimeout(() => heart.remove(), 1200);
    }
  }

  function say(text, ms = 6500) {
    if (disposed || !text) return;
    const span = bubble.firstElementChild;
    bubble.classList.remove('show');
    void bubble.offsetWidth;
    span.textContent = text;
    // bubble to the left of her face, kept on screen
    bubble.style.left = `${Math.max(4, face[0] - 34)}%`;
    bubble.style.top = `${Math.max(14, face[1] - 6)}%`;
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    if (ms) bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
  }

  function look(nx, ny) {
    if (reduceMotion) return;
    host.style.setProperty('--ax', nx.toFixed(3));
    host.style.setProperty('--ay', ny.toFixed(3));
  }

  function dispose() {
    disposed = true;
    clearTimeout(bubbleTimer);
    host.classList.remove('lb-art-host');
    host.replaceChildren();
  }

  return { show, react, say, look, dispose, hideBubble: () => bubble.classList.remove('show') };
}
