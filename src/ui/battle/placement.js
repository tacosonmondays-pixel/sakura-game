// Placement controller: tap-card-then-tap-tile, drag-from-card, ghost + tile hints.
import { h, icon, fmtCoins } from './util.js';

export const PLACE_REASONS = {
  occupied: 'That tile is taken.',
  path: 'Girls cannot stand on the path.',
  blocked: 'Nothing can be placed there.',
  needsWater: 'She can only stand on water tiles.',
  needsLand: 'She needs solid ground.',
  cash: 'Not enough coins.',
  heroPlaced: 'Your hero is already deployed.',
  notInLoadout: 'She is not in your formation.',
  outOfBounds: 'Outside the battlefield.',
};

/** Finger offset so a touch-dragged ghost is not hidden under the thumb. */
const TOUCH_LIFT = 46;

export function createPlacement(ctx) {
  const { sim } = ctx;
  let unitId = null;
  let mode = null; // 'tap' | 'drag'
  let last = null; // { tx, ty, ok }
  const hint = h('div.bt-place-hint', { 'data-testid': 'place-hint' });
  hint.hidden = true;
  ctx.layer.append(hint);

  function renderHint() {
    if (!unitId) {
      hint.hidden = true;
      return;
    }
    const def = sim.data.unit(unitId);
    const cost = sim.placeCost(unitId);
    const where = def.placement === 'water' ? 'a glowing water tile' : def.placement === 'amphibious' ? 'land or water' : 'a glowing tile';
    hint.hidden = false;
    hint.classList.toggle('bt-place-water', def.placement === 'water');
    hint.replaceChildren(...[
      h('span.bt-place-text', mode === 'drag' ? `Release on ${where} to deploy ` : `Tap ${where} to deploy `, h('b', def.name), h('span.bt-place-cost', ` · ${fmtCoins(cost)}`)),
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
    if (ctx.settings.showRanges !== false) ctx.renderer.showTileHints(id);
    renderHint();
    return true;
  }

  function end() {
    unitId = null;
    mode = null;
    last = null;
    ctx.renderer.setGhost(null);
    ctx.renderer.showTileHints(null);
    renderHint();
  }

  function cancel() {
    end();
  }

  function ghostAt(tx, ty) {
    const chk = sim.canPlace(unitId, tx, ty);
    last = { tx, ty, ok: chk.ok, reason: chk.reason };
    ctx.renderer.setGhost(unitId, tx, ty, chk.ok);
    return chk;
  }

  /** Attempts to place the current unit at a tile; returns the tower or null. */
  function tryPlace(tx, ty) {
    const id = unitId;
    const chk = sim.canPlace(id, tx, ty);
    if (!chk.ok) {
      ctx.feed.push(PLACE_REASONS[chk.reason] || 'Cannot place there.', 'warn', { key: `place-${chk.reason}`, ms: 1600 });
      return null;
    }
    const t = sim.placeTower(id, tx, ty);
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
    const chk = sim.canPlace(unitId, p.tx, p.ty);
    if (chk.ok) {
      tryPlace(p.tx, p.ty);
      return true;
    }
    if (chk.reason === 'occupied' && p.towerUid != null) {
      // tapping another girl cancels placement and selects her (BTD6 behaviour)
      cancel();
      ctx.select(p.towerUid);
      return true;
    }
    ghostAt(p.tx, p.ty);
    ctx.feed.push(PLACE_REASONS[chk.reason] || 'Cannot place there.', 'warn', { key: `place-${chk.reason}`, ms: 1600 });
    return true;
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
    if (last && last.tx === p.tx && last.ty === p.ty) return;
    ghostAt(p.tx, p.ty);
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
      if (!unitId) return;
      if (overBar(clientY)) {
        ctx.renderer.setGhost(null);
        last = null;
        return;
      }
      const p = pickDrag(clientX, clientY, pointerType);
      if (!p.inBounds) {
        ctx.renderer.setGhost(null);
        last = null;
        return;
      }
      if (!last || last.tx !== p.tx || last.ty !== p.ty) ghostAt(p.tx, p.ty);
    },
    dragEnd(clientX, clientY, pointerType) {
      if (!unitId) return;
      if (overBar(clientY)) {
        cancel();
        return;
      }
      const p = pickDrag(clientX, clientY, pointerType);
      if (p.inBounds) tryPlace(p.tx, p.ty);
      if (unitId) cancel();
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
