// Brigade bark chips (Gate Arc S3a, STEP3_BUILD_PLAN decision 10): a short line (src/ui/text/barks.js)
// in a small navy-and-amber chip over a Brigade group as it comes on and over a unit as it is
// beaten. Render only: the battle renderer feeds it the sim's spawn / death events and the screen
// point of the unit each frame. One chip at a time per side of the board (left / right half), each
// up for BARK_SECONDS; a bark for a side that already shows one is dropped, never queued, so the
// chips never stack over the column. Text ≥ BARK_FONT_PX on a phone.
//
// createBarkQueue is the pure logic (node-tested: tests/ui/barks.test.js); createBarkChips is its
// DOM view, two reusable chips in the renderer's overlay layer (no per-frame allocation).
import { BARK_SECONDS, barkFor, barkUnit } from '../text/barks.js';

/** Smallest bark text (CSS px, phone). */
export const BARK_FONT_PX = 12;
/** A group's spawn bark again only after this many seconds (one bark per group, not per unit). */
export const GROUP_GAP = 4;
/** The two sides, hoisted so the per-frame update / draw allocate nothing. */
const SIDES = Object.freeze(['left', 'right']);

/**
 * The bark logic: which chip shows what, per side.
 * @param {{ seconds?: number }} [o]
 */
export function createBarkQueue({ seconds = BARK_SECONDS } = {}) {
  const sides = { left: null, right: null };
  const lastSpawn = new Map();
  const counts = new Map();
  let now = 0;
  const q = {
    sides,
    /**
     * Offers a bark. @returns {boolean} whether it shows (false: that side already has one up).
     * @param {{ side: 'left'|'right', text: string, uid?: number|null, x?: number, z?: number }} b
     */
    push(b) {
      if (!b || !b.text || (b.side !== 'left' && b.side !== 'right')) return false;
      const cur = sides[b.side];
      if (cur && now - cur.t0 < seconds) return false;
      sides[b.side] = { text: b.text, uid: b.uid ?? null, x: b.x ?? 0, z: b.z ?? 0, t0: now };
      return true;
    },
    /**
     * A sim event (spawn / death) for an enemy def: offers that unit's bark when it has one.
     * @param {object} ev sim event ({ type, uid, id, x, y })
     * @param {'left'|'right'} side which half of the screen the unit is on
     * @returns {string|null} the text shown, or null
     */
    onEvent(ev, side) {
      if (!ev || (ev.type !== 'spawn' && ev.type !== 'death')) return null;
      const unit = barkUnit(ev.id);
      if (!unit) return null;
      const event = ev.type === 'spawn' ? 'spawn' : 'beaten';
      if (event === 'spawn') {
        // one bark per group: a unit of the same kind that came on moments ago belongs to it
        const last = lastSpawn.get(unit);
        lastSpawn.set(unit, now);
        if (last != null && now - last < GROUP_GAP) return null;
      }
      const key = `${unit}:${event}`;
      const n = counts.get(key) || 0;
      const text = barkFor(ev.id, event, n);
      if (!text) return null;
      if (!q.push({ side, text, uid: event === 'spawn' ? ev.uid : null, x: ev.x, z: ev.y })) return null;
      counts.set(key, n + 1);
      return text;
    },
    /** Advances the clock and retires chips that have been up long enough. */
    update(dt) {
      now += Math.max(0, dt || 0);
      for (const k of SIDES) if (sides[k] && now - sides[k].t0 >= seconds) sides[k] = null;
    },
    /** How far through its time a side's chip is (0…1), or -1 when none. */
    progress(side) {
      const c = sides[side];
      return c ? Math.min(1, (now - c.t0) / seconds) : -1;
    },
    clear() {
      sides.left = null;
      sides.right = null;
      lastSpawn.clear();
    },
  };
  return q;
}

/**
 * The chips' DOM: two absolutely placed elements in `layer`, moved each frame.
 * @param {HTMLElement} layer the renderer's overlay layer
 * @param {{ document?: Document }} [o]
 */
export function createBarkChips(layer, { document: doc = globalThis.document } = {}) {
  const make = (side) => {
    const el = doc.createElement('div');
    el.className = `bt-bark bt-bark-${side}`;
    el.setAttribute('role', 'status');
    el.dataset.testid = `bark-${side}`;
    el.style.cssText = [
      'position:absolute', 'left:0', 'top:0', 'display:none', 'pointer-events:none', 'white-space:nowrap',
      `font:italic 800 ${BARK_FONT_PX + 1}px/1.15 system-ui,sans-serif`, 'letter-spacing:0.02em',
      'color:#ffd27a', 'background:#1f2b47', 'border:2px solid #f4a62a', 'border-radius:7px',
      'padding:3px 9px', 'box-shadow:0 2px 6px rgba(0,0,0,0.45)', 'transform:translate(-50%,-100%)',
      'will-change:transform,opacity',
    ].join(';');
    layer.appendChild(el);
    return el;
  };
  const els = { left: make('left'), right: make('right') };
  const shown = { left: '', right: '' };
  return {
    els,
    /**
     * Draws the queue's chips at their screen points (CSS px within the layer).
     * @param {ReturnType<typeof createBarkQueue>} queue
     * @param {(c: object) => { x: number, y: number }|null} where screen point of a chip (null: hide)
     */
    draw(queue, where) {
      for (const side of SIDES) {
        const el = els[side];
        const c = queue.sides[side];
        const p = c ? where(c) : null;
        if (!c || !p) {
          if (shown[side]) {
            el.style.display = 'none';
            shown[side] = '';
          }
          continue;
        }
        if (shown[side] !== c.text) {
          el.textContent = c.text;
          el.style.display = 'block';
          shown[side] = c.text;
        }
        const k = queue.progress(side);
        el.style.opacity = String(k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1);
        el.style.left = `${Math.round(p.x)}px`;
        el.style.top = `${Math.round(p.y)}px`;
      }
    },
    dispose() {
      els.left.remove();
      els.right.remove();
    },
  };
}
