// Aim mode on the board (roster B3, ROSTER_SPEC §6.11): a girl with an aim point (a mortar's
// centre, a mirror panel's spot, Seiran's Dragonflight) gets "Set aim" / "Auto" in her panel.
// Set aim waits for one tap on the map (a banner says so), then sends it: solo straight to the
// Sim, co-op as the `aim` command (ctx.act.aim). Auto clears it (automatic aim). The renderer
// draws the reticle from the sim's 'aim' event.
import { h } from './util.js';
import { aimMode } from '../../sim/towers.js';

const WHAT = {
  mortar: (n) => `Tap where ${n}'s shells should land`,
  mirror: (n) => `Tap where ${n}'s mirror panel should stand`,
  ult: (n) => `Tap where ${n}'s dragon should enter the road`,
};

export function createAimControl(ctx) {
  const { sim } = ctx;
  let picking = null; // uid
  const text = h('span');
  const banner = h('div.bt-dr-banner', { 'data-testid': 'aim-banner', role: 'status' }, text,
    h('button.bt-dr-link', { 'data-testid': 'aim-banner-cancel', onclick: () => cancel() }, 'Cancel'));
  banner.hidden = true;
  ctx.layer.append(banner);

  function show() {
    banner.hidden = picking == null;
    if (picking == null) return;
    const t = sim.getTower(picking);
    text.textContent = (WHAT[aimMode(t)] || WHAT.mortar)(t?.def.name || 'her');
  }

  function mine(uid) {
    if (!ctx.coop || ctx.coop.isMine(uid)) return true;
    ctx.feed?.push(`Only ${ctx.coop.ownerName(uid)} aims her.`, 'warn', { key: 'aim-ally', ms: 1600 });
    return false;
  }

  function send(uid, x, y) {
    const ok = ctx.act?.aim ? ctx.act.aim(uid, x, y) : x == null ? sim.clearAim(uid) : sim.setAim(uid, x, y);
    if (!ok) ctx.feed?.push('She cannot aim there right now.', 'warn', { key: 'aim-bad', ms: 1400 });
    ctx.panel?.update?.();
    return ok;
  }

  /** Panel "Set aim": the next board tap aims her (tapping it again cancels). */
  function start(uid) {
    if (ctx.ended || !mine(uid) || !aimMode(sim.getTower(uid))) return;
    if (picking === uid) {
      cancel();
      return;
    }
    ctx.placement?.cancel?.();
    ctx.cancelPick?.();
    if (ctx.flight?.active) ctx.flight.cancel();
    picking = uid;
    show();
  }

  /** Panel "Auto": back to automatic aim. */
  function clear(uid) {
    if (ctx.ended || !mine(uid)) return;
    cancel();
    send(uid, null, null);
  }

  function cancel() {
    if (picking == null) return;
    picking = null;
    show();
  }

  /** A tap on the board while aiming. @returns {boolean} consumed */
  function handleTap(p) {
    if (picking == null) return false;
    if (!sim.getTower(picking)) {
      cancel();
      return false;
    }
    if (!p.inBounds || p.x == null) {
      ctx.feed?.push('Tap a point on the map.', 'warn', { key: 'aim-out', ms: 1200 });
      return true;
    }
    const uid = picking;
    cancel();
    send(uid, p.x, p.y);
    return true;
  }

  return {
    start, clear, cancel, handleTap,
    get active() { return picking != null; },
    get uid() { return picking; },
    destroy() { banner.remove(); },
  };
}
