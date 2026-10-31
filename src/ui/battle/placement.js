// Placement controller (free placement): drag a card from the bar and release ANYWHERE on the
// board to deploy, or tap a card then tap the board. Nothing snaps — the girl stands exactly
// where the finger lets go. There is no zone shading: a small circle under the dragged girl is
// white where she can stand and red where she can't, and releasing on a red spot simply returns
// her to the bar (a short toast only explains non-obvious reasons such as water-only girls or
// missing coins). Move mode (a hero's Move button) reuses the same ghost: tap where she should
// stand and she walks over (during a wave she pauses for 3 s).
import { heroMoveDowntime } from '../../sim/hero.js';
import { h, icon } from './util.js';
import { fmtNum } from '../format.js';
import { cue } from '../../audio/cue.js'; // [audio]

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
/** Reasons the red circle alone already explains (no toast). */
const SILENT_REASONS = new Set(['occupied', 'path', 'blocked', 'outOfBounds']);

/**
 * A card armed (or Move mode): every other board-tap mode steps aside — an ability aim or Set aim (aimControl.js),
 * a Midori / Chika pick, a flight point — so the next board tap places her (ABILITIES_SPEC §8.1: a placement tap
 * never fires an ability; the board tap asks aim, then flight, then placement).
 */
export function clearBoardModes(ctx) {
  if (ctx.aim?.active) ctx.aim.cancel();
  ctx.cancelPick?.();
  if (ctx.flight?.active) ctx.flight.cancel();
}

export function createPlacement(ctx) {
  const { sim } = ctx;
  let unitId = null;
  let mode = null; // 'tap' | 'drag'
  let last = null; // { x, y, ok, reason }
  let moving = false; // Move mode: the ghost is the placed hero, the drop moves her
  let padHint = null;
  // when a board tap (or a drag's release) last ended the placement: the ability bar keeps ignoring taps a moment
  // longer, because a phone's click lands a frame or two after the touch (abilityBar.js placingNow)
  let tapEndedAt = null;
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
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
    if (moving) {
      const wave = sim.state === 'wave';
      hint.classList.toggle('bt-place-water', def.placement === 'water');
      hint.replaceChildren(...[
        h('span.bt-place-text', `Tap ${where} to move `, h('b', def.name), h('span.bt-place-cost', wave ? ` · she pauses ${heroMoveDowntime(sim.hero)}s` : ' · free')),
        padHint ? h('span.bt-place-pad', { 'data-testid': 'place-pad' }, padHint) : null,
        h('button.bt-place-cancel', { 'data-testid': 'place-cancel', onclick: () => cancel() }, icon('close'), 'Cancel'),
      ].filter(Boolean));
      return;
    }
    hint.classList.toggle('bt-place-water', def.placement === 'water');
    hint.replaceChildren(...[
      h('span.bt-place-text', mode === 'drag' ? `Release anywhere on ${where} to deploy ` : `Tap anywhere on ${where} to deploy `, h('b', def.name), h('span.bt-place-cost', cost > 0 ? ` · ${fmtNum(cost, 'money', { round: 'up' })}` : ' · free')),
      padHint ? h('span.bt-place-pad', { 'data-testid': 'place-pad' }, padHint) : null,
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
    const cash = ctx.spendable ? ctx.spendable() : sim.cash; // (co-op: less the coins my orders in flight hold)
    if (cash < cost) {
      ctx.feed.push(`Need ${fmtNum(cost - cash, 'money', { round: 'up' })} more coins for ${def.name}.`, 'warn', { key: `poor-${id}`, ms: 1800 });
      ctx.bump?.('cash');
      return false;
    }
    ctx.select(null);
    clearBoardModes(ctx);
    unitId = id;
    mode = how;
    last = null;
    ctx.renderer.setPlacementRange?.(ctx.settings.showRanges !== false);
    renderHint();
    return true;
  }

  function end() {
    padHint = null;
    unitId = null;
    mode = null;
    last = null;
    moving = false;
    showPending();
    renderHint();
  }

  /**
   * Co-op: a girl ordered onto the board stands there as her ghost until the order runs (the input
   * delay, coopPending.js); with nothing on its way (and solo) the ghost goes. Placing another girl
   * takes the ghost over, and her ghost comes back if that one ends while she is still on her way.
   */
  function showPending() {
    if (unitId) return;
    const p = ctx.coopPending?.placements().at(-1);
    if (p) ctx.renderer.setGhost(p.unitId, p.x, p.y, true);
    else ctx.renderer.setGhost(null);
  }

  function cancel() {
    end();
  }

  /** Moves the ghost to a world point and returns the sim's verdict. */
  function ghostAt(x, y) {
    const chk = moving ? sim.canMoveHero(x, y) : sim.canPlace(unitId, x, y);
    last = { x, y, ok: chk.ok, reason: chk.reason };
    ctx.renderer.setGhost(unitId, x, y, chk.ok);
    // crystal pads (map rule): "+25% damage · +0.7 range" on a free pad, "Pad taken by Aoi" on a taken one
    const ph = ctx.modes?.padHint(chk.x ?? x, chk.y ?? y, moving ? sim.hero?.uid ?? null : null) ?? null;
    if (ph !== padHint) {
      padHint = ph;
      renderHint();
    }
    return chk;
  }

  /** Rejected spot: the red circle says it all; only non-obvious reasons get a short toast. */
  function reject(x, y, reason) {
    ghostAt(x, y);
    cue('battle.deny', { reason }); // [audio]
    if (!SILENT_REASONS.has(reason)) ctx.feed.push(PLACE_REASONS[reason] || 'Cannot place there.', 'warn', { key: `place-${reason}`, ms: 1600 });
  }

  /**
   * Attempts to deploy the current unit with her footprint centred at world (x, y)
   * (two integers are read as a tile centre, legacy). Returns the tower or null.
   */
  function tryPlace(x, y) {
    const id = unitId;
    if (!id) return null;
    if (moving) {
      const mv = sim.canMoveHero(x, y);
      if (!mv.ok) {
        if (mv.reason === 'same') cancel();
        else reject(x, y, mv.reason);
        return null;
      }
      const ok = ctx.heroLevels?.move(x, y);
      if (ok) end();
      return ok ? 'moved' : null;
    }
    const chk = sim.canPlace(id, x, y);
    if (!chk.ok) {
      reject(chk.x ?? x, chk.y ?? y, chk.reason);
      return null;
    }
    // ctx.act routes through co-op lockstep when this is a co-op battle (the girl appears a few
    // frames later on both screens); in solo it places right away
    const t = ctx.act ? ctx.act.place(id, x, y) : sim.placeTower(id, x, y);
    if (t) {
      end();
      if (t !== 'queued') ctx.onPlaced(t);
    }
    return t;
  }

  /** Renderer tap while placing. Returns true when the tap was consumed. */
  function handleTap(p) {
    if (!unitId) return false;
    const used = boardTap(p);
    if (!unitId) tapEndedAt = clock();
    return used;
  }

  function boardTap(p) {
    if (!p.inBounds) {
      cancel();
      return true;
    }
    const chk = moving ? sim.canMoveHero(p.x, p.y) : sim.canPlace(unitId, p.x, p.y);
    if (chk.ok) {
      tryPlace(p.x, p.y);
      return true;
    }
    if (moving && p.towerUid != null && p.towerUid === sim.hero?.uid) {
      cancel(); // tapping her again: she stays
      return true;
    }
    if (chk.reason === 'occupied' && p.towerUid != null) {
      // tapping another girl cancels placement and selects her
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
    /** Co-op: one of my orders ran (controller onApplied): the ghost shows what is still on its way. */
    landed: () => showPending(),
    get moving() {
      return moving;
    },
    /** Move mode for the player's own placed hero (her panel's Move button). */
    startMove() {
      const hero = sim.hero;
      if (!hero || sim.state === 'won' || sim.state === 'lost') return false;
      const mv = ctx.heroLevels?.moveState(hero);
      if (mv?.disabled) {
        if (mv.reason === 'cooldown') ctx.feed.push(`Move recharging · ${Math.ceil(hero.moveCd)}s`, 'warn', { key: 'move-cd', ms: 1400 });
        return false;
      }
      ctx.select(null);
      clearBoardModes(ctx);
      unitId = hero.unitId;
      moving = true;
      mode = 'tap';
      last = null;
      renderHint();
      return true;
    },
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
      tapEndedAt = clock();
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
      // released on a red spot: she just goes back to the bar
      if (!t && unitId) cancel();
    },
    /** performance.now() of the board tap or drag release that last ended a placement (null: none yet). */
    get tapEndedAt() {
      return tapEndedAt;
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
