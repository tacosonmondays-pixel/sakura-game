// Chika's flight modes on the board (docs/specs/CHIKA_REWORK.md §16): the panel's Flight row calls
// choose(); Hover and Pursuit apply at once, Hold and Patrol wait for one or two taps on the map
// (a rally point, not a live cursor, so co-op stays one `fly` command per choice). While a point
// is being picked the renderer shows her signal ring and the points so far, and a banner says
// what the next tap does. The sim pulls points that lie too far inside her signal range.
import { h } from './util.js';

export function createFlightControl(ctx) {
  const { sim } = ctx;
  let picking = null; // { uid, mode, step, a }
  const text = h('span');
  const banner = h('div.bt-dr-banner', { 'data-testid': 'flight-banner', role: 'status' }, text,
    h('button.bt-dr-link', { 'data-testid': 'flight-banner-cancel', onclick: () => cancel() }, 'Cancel'));
  banner.hidden = true;
  ctx.layer.append(banner);

  function preview() {
    ctx.renderer?.setFlightPreview?.(picking ? { uid: picking.uid, mode: picking.mode, a: picking.a } : null);
    banner.hidden = !picking;
    if (picking) {
      const name = sim.getTower(picking.uid)?.def.name || 'her';
      text.textContent = picking.mode === 'hold'
        ? `Tap where ${name}'s drones should hold`
        : picking.step === 0 ? `Patrol: tap the first point` : `Patrol: tap the second point`;
    }
  }

  function mine(uid) {
    if (!ctx.coop || ctx.coop.isMine(uid)) return true;
    ctx.feed?.push(`Only ${ctx.coop.ownerName(uid)} flies her drones.`, 'warn', { key: 'fly-ally', ms: 1600 });
    return false;
  }

  function send(uid, mode, a = null, b = null) {
    const ok = ctx.act?.fly ? ctx.act.fly(uid, mode, a, b) : sim.setFlight(uid, mode, a?.[0], a?.[1], b?.[0], b?.[1]);
    if (!ok) ctx.feed?.push('Her drones cannot fly that way right now.', 'warn', { key: 'fly-bad', ms: 1400 });
    return ok;
  }

  function choose(uid, mode) {
    if (ctx.ended || !mine(uid)) return;
    if (mode === 'hover' || mode === 'pursuit') {
      cancel();
      send(uid, mode);
      return;
    }
    if (picking && picking.uid === uid && picking.mode === mode) {
      cancel();
      return;
    }
    ctx.placement?.cancel?.();
    ctx.cancelPick?.(); // a brew / tune-up pick in progress ends: one board tap mode at a time
    picking = { uid, mode, step: 0, a: null };
    preview();
  }

  function cancel() {
    if (!picking) return;
    picking = null;
    preview();
  }

  /** A tap on the board while a point is being picked. @returns {boolean} consumed */
  function handleTap(p) {
    if (!picking) return false;
    if (!sim.getTower(picking.uid)) {
      cancel();
      return false;
    }
    if (!p.inBounds || p.x == null) {
      ctx.feed?.push('Tap a point on the map.', 'warn', { key: 'fly-out', ms: 1200 });
      return true;
    }
    const pt = [p.x, p.y];
    const { uid, mode } = picking;
    if (mode === 'patrol' && picking.step === 0) {
      picking.a = pt;
      picking.step = 1;
      preview();
      return true;
    }
    const a = mode === 'patrol' ? picking.a : pt;
    const b = mode === 'patrol' ? pt : null;
    picking = null;
    preview();
    send(uid, mode, a, b);
    navigator.vibrate?.(8);
    return true;
  }

  return {
    choose,
    cancel,
    handleTap,
    /** The mode whose points are being picked for this girl, else null. */
    pickingFor: (uid) => (picking && picking.uid === uid ? picking.mode : null),
    pickStep: () => picking?.step ?? 0,
    get active() {
      return !!picking;
    },
    update() {
      if (picking && (!sim.getTower(picking.uid) || ctx.selectedUid !== picking.uid)) cancel();
    },
    destroy() {
      banner.remove();
    },
  };
}
