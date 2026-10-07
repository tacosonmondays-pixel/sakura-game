// Placement controller (free placement, Bloons-style): drag a card from the bar and release
// ANYWHERE on the board to deploy, or tap a card then tap the board. Nothing snaps — the
// girl stands exactly where the finger lets go. Like BTD6 there is no zone shading: a small
// circle under the dragged girl is white where she can stand and red where she can't, and
// releasing on a red spot simply returns her to the bar (a short toast only explains
// non-obvious reasons such as water-only girls or missing coins).
import { h, icon, fmtCoins } from './util.js';

export const PLACE_REASONS = {
  occupied: 'Too close to another girl.',
  path: 'Too close to the path — give the enemies room.',
  blocked: 'Something is in the way there.',
  needsWater: 'She can only stand on water.',
  needsLand: 'She needs solid ground, not water.',
  cash: 'Not enough coins.',
  heroPlaced: 'Your hero is already deployed.',
  notInLoadout: 'She is not in your formation.',
  outOfBounds: 'Outside the battlefield.',
};

/** Finger offset so a touch-dragged ghost is not hidden under the thumb. */
const TOUCH_LIFT = 46;
/** Ghost only re-evaluates after the pointer moved this far (tiles) — cheap, still fluid. */
const MOVE_EPS = 0.015;
/** Reasons the red circle alone already explains (no toast, BTD6-style). */
const SILENT_REASONS = new Set(['occupied', 'path', 'blocked', 'outOfBounds']);

export function createPlacement(ctx) {
  const { sim } = ctx;
  let unitId = null;
  let mode = null; // 'tap' | 'drag'
  let last = null; // { x, y, ok, reason }
  const hint = h('div.bt-place-hint', { 'data-testid': 'place-hint' });
  hint.hidden = true;
  ctx.layer.append(hint);

  function whereText(def) {
    if (def.placement === 'water') return 'open water';
    if (def.placement === 'amphibious') return 'open ground or water';
    return 'open ground';
  }

  function renderHint() {
    if (!unitId) {
      hint.hidden = true;
      return;
    }
    const def = sim.data.unit(unitId);
    const cost = sim.placeCost(unitId);
    const where = whereText(def);
    hint.hidden = false;
    hint.classList.toggle('bt-place-water', def.placement === 'water');
    hint.replaceChildren(...[
      h('span.bt-place-text', mode === 'drag' ? `Release anywhere on ${where} to deploy ` : `Tap anywhere on ${where} to deploy `, h('b', def.name), h('span.bt-place-cost', ` · ${fmtCoins(cost)}`)),
      mode === 'drag' ? null : h('button.bt-place-cancel', { 'data-testid': 'place-cancel', onclick: () => cancel() }, icon('close'), 'Cancel'),
    ].filter(Boolean));
  }

  function begin(id, how) {
    if (sim.state === 'won' || sim.state === 'lost') return false;
    const def = sim.data.unit(id);
    if (!def) return false;
    const isHero = sim.heroConfig?.unitId === id;
    if (isHero && sim.hero) {
      ctx.select(sim.hero.uid);
      return false;
    }
    const cost = sim.placeCost(id);
    if (sim.cash < cost) {
      ctx.feed.push(`Need ${fmtCoins(cost - sim.cash)} more coins for ${def.name}.`, 'warn', { key: `poor-${id}`, ms: 1800 });
      ctx.bump?.('cash');
      return false;
    }
    ctx.select(null);
    unitId = id;
    mode = how;
    last = null;
    ctx.renderer.setPlacementRange?.(ctx.settings.showRanges !== false);
    renderHint();
    return true;
  }

  function end() {
    unitId = null;
    mode = null;
    last = null;
    ctx.renderer.setGhost(null);
    renderHint();
  }

  function cancel() {
    end();
  }

  /** Moves the ghost to a world point and returns the sim's verdict. */
  function ghostAt(x, y) {
    const chk = sim.canPlace(unitId, x, y);
    last = { x, y, ok: chk.ok, reason: chk.reason };
    ctx.renderer.setGhost(unitId, x, y, chk.ok);
    return chk;
  }

  /** Rejected spot: the red circle says it all; only non-obvious reasons get a short toast. */
  function reject(x, y, reason) {
    ghostAt(x, y);
    if (!SILENT_REASONS.has(reason)) ctx.feed.push(PLACE_REASONS[reason] || 'Cannot place there.', 'warn', { key: `place-${reason}`, ms: 1600 });
  }

  /**
   * Attempts to deploy the current unit with her footprint centred at world (x, y)
   * (two integers are read as a tile centre, legacy). Returns the tower or null.
   */
  function tryPlace(x, y) {
    const id = unitId;
    if (!id) return null;
    const chk = sim.canPlace(id, x, y);
    if (!chk.ok) {
      reject(chk.x ?? x, chk.y ?? y, chk.reason);
      return null;
    }
    const t = sim.placeTower(id, x, y);
    if (t) {
      end();
      ctx.onPlaced(t);
    }
    return t;
  }

  /** Renderer tap while placing. Returns true when the tap was consumed. */
  function handleTap(p) {
    if (!unitId) return false;
    if (!p.inBounds) {
      cancel();
      return true;
    }
    const chk = sim.canPlace(unitId, p.x, p.y);
    if (chk.ok) {
      tryPlace(p.x, p.y);
      return true;
    }
    if (chk.reason === 'occupied' && p.towerUid != null) {
      // tapping another girl cancels placement and selects her (BTD6 behaviour)
      cancel();
      ctx.select(p.towerUid);
      return true;
    }
    reject(p.x, p.y, chk.reason);
    return true;
  }

  function moved(x, y) {
    return !last || Math.abs(last.x - x) > MOVE_EPS || Math.abs(last.y - y) > MOVE_EPS;
  }

  /** Mouse hover over the canvas while tap-placing: ghost follows the cursor. */
  function hover(clientX, clientY) {
    if (!unitId || mode !== 'tap') return;
    const p = ctx.renderer.pick(clientX, clientY);
    if (!p.inBounds) {
      ctx.renderer.setGhost(null);
      last = null;
      return;
    }
    if (moved(p.x, p.y)) ghostAt(p.x, p.y);
  }

  function pickDrag(clientX, clientY, pointerType) {
    const lift = pointerType === 'touch' || pointerType === 'pen' ? TOUCH_LIFT : 0;
    return ctx.renderer.pick(clientX, clientY - lift);
  }

  function overBar(clientY) {
    const r = ctx.bar.el.getBoundingClientRect();
    return clientY >= r.top;
  }

  return {
    get unitId() {
      return unitId;
    },
    get mode() {
      return mode;
    },
    get last() {
      return last;
    },
    start: (id) => begin(id, 'tap'),
    beginDrag: (id) => begin(id, 'drag'),
    dragMove(clientX, clientY, pointerType) {
      if (!unitId || mode !== 'drag') return;
      if (overBar(clientY)) {
        ctx.renderer.setGhost(null);
        last = null;
        return;
      }
      const p = pickDrag(clientX, clientY, pointerType);
      if (!p.inBounds) {
        // keep showing her (red) just outside the board so the drag never "loses" the girl
        if (p.x != null && moved(p.x, p.y)) ghostAt(p.x, p.y);
        return;
      }
      if (moved(p.x, p.y)) ghostAt(p.x, p.y);
    },
    dragEnd(clientX, clientY, pointerType) {
      if (!unitId || mode !== 'drag') return;
      if (overBar(clientY)) {
        cancel();
        return;
      }
      const p = pickDrag(clientX, clientY, pointerType);
      if (!p.inBounds) {
        cancel();
        return;
      }
      const t = tryPlace(p.x, p.y);
      // released on a red spot: she just goes back to the bar (BTD6)
      if (!t && unitId) cancel();
    },
    handleTap,
    hover,
    tryPlace,
    cancel,
    refresh: renderHint,
    destroy() {
      hint.remove();
    },
  };
}
