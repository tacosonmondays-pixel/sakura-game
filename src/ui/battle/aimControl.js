// Aim mode on the board (roster B3, ROSTER_SPEC §6.11): a girl with an aim point (a mortar's
// centre, a mirror panel's spot, Seiran's Dragonflight) gets "Set aim" / "Auto" in her panel.
// Set aim waits for one tap on the map (a banner says so), then sends it: solo straight to the
// Sim, co-op as the `aim` command (ctx.act.aim). Auto clears it (automatic aim). The renderer
// draws the reticle from the sim's 'aim' event.
//
// The 'ability' mode (the ability bar, ABILITIES_SPEC §4 "Aimed abilities", §7.2): an ability whose cast reads an
// aim (src/data/abilityText.js `aim`) waits for one board tap before it fires —
//   'girl'  (Wakaba's Time Out!): the girls it may go to are ringed (the buff-pick highlight); a tap on a girl casts
//           at her spot (the sim gives the rally to the girl nearest the aim), a tap on empty ground cancels;
//   'point' (Yuzuha's Emergency Deploy): her reach ring is drawn; a tap on the map casts there.
// Tapping the same ⚡ again casts with no aim (her own pick); Esc cancels. Auto-cast never aims.
import { h } from './util.js';
import { aimMode } from '../../sim/towers.js';
import { abilityDef, abilityReach } from '../../sim/abilities.js';

const WHAT = {
  mortar: (n) => `Tap where ${n}'s shells should land`,
  mirror: (n) => `Tap where ${n}'s mirror panel should stand`,
  ult: (n) => `Tap where ${n}'s dragon should enter the road`,
  checkpoint: (n) => `Tap the road where ${n} should set up her checkpoint`,
  banner: (n) => `Tap where ${n} should plant a council banner (up to 5 tiles away)`,
};

/** The ability aim banner's words (pure). */
export function abilityAimText(kind, girl, ability) {
  if (kind === 'girl') return `Tap the girl ${girl} should coach — or tap ⚡ again for her pick`;
  if (kind === 'point') return `Tap the road for the ${ability === 'Emergency Deploy' ? 'sentries' : `${ability}`} — or tap ⚡ again`;
  return `Tap where ${girl} should use ${ability} — or tap ⚡ again`;
}

/** The girls an ability on one girl may go to: every other girl on the field (any player's; never the caster). */
export function aimCandidates(sim, casterUid) {
  return sim.towers.filter((o) => !o.removed && o.uid !== casterUid).map((o) => o.uid);
}

export function createAimControl(ctx) {
  const { sim } = ctx;
  let picking = null; // uid
  let abil = null; // { uid, id, kind: 'girl'|'point', name }
  const text = h('span');
  const banner = h('div.bt-dr-banner', { 'data-testid': 'aim-banner', role: 'status' }, text,
    h('button.bt-dr-link', { 'data-testid': 'aim-banner-cancel', onclick: () => cancel() }, 'Cancel'));
  banner.hidden = true;
  ctx.layer.append(banner);

  function show() {
    banner.hidden = picking == null && !abil;
    banner.classList.toggle('bt-aim-ability', !!abil);
    if (abil) {
      const t = sim.getTower(abil.uid);
      text.textContent = abilityAimText(abil.kind, t?.def.name || 'She', abil.name);
      return;
    }
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
    cancel();
    ctx.placement?.cancel?.();
    ctx.cancelPick?.();
    if (ctx.flight?.active) ctx.flight.cancel();
    picking = uid;
    show();
  }

  /**
   * The ability bar / panel: the next board tap aims this cast. `o`: { uid (the caster), id (the ability), kind
   * ('girl' | 'point'), name (the ability's) }.
   */
  function startAbility(o) {
    if (ctx.ended || !o || !mine(o.uid)) return;
    const t = sim.getTower(o.uid);
    if (!t) return;
    cancel();
    ctx.placement?.cancel?.();
    ctx.cancelPick?.();
    if (ctx.flight?.active) ctx.flight.cancel();
    abil = { uid: o.uid, id: o.id, kind: o.kind, name: o.name || 'her ability' };
    if (o.kind === 'girl') {
      ctx.renderer?.setBuffPick?.(o.uid, aimCandidates(sim, o.uid));
      ctx.shell?.classList.add('bt-picking');
    } else {
      const def = abilityDef(t);
      const r = def ? abilityReach(t, def) : 0;
      ctx.renderer?.setAbilityReach?.(Number.isFinite(r) && r > 0 ? { x: t.x, y: t.y, r } : null);
      ctx.shell?.classList.add('bt-picking');
    }
    show();
  }

  /** Panel "Auto": back to automatic aim. */
  function clear(uid) {
    if (ctx.ended || !mine(uid)) return;
    cancel();
    send(uid, null, null);
  }

  function cancel() {
    if (picking == null && !abil) return;
    if (abil) {
      ctx.renderer?.setBuffPick?.(null);
      ctx.renderer?.setAbilityReach?.(null);
      ctx.shell?.classList.remove('bt-picking');
    }
    picking = null;
    abil = null;
    show();
  }

  /** An ability aim tap: cast at the girl or point, or cancel on empty ground (girl mode). */
  function abilityTap(p) {
    const a = abil;
    if (!sim.getTower(a.uid)) {
      cancel();
      return false;
    }
    if (a.kind === 'girl') {
      const tapped = p.towerUid != null ? sim.getTower(p.towerUid) : null;
      cancel();
      if (!tapped || tapped.uid === a.uid) return true; // empty ground (or herself): cancelled
      ctx.castAbility?.(a.uid, { group: false, aim: [tapped.x, tapped.y], id: a.id });
      return true;
    }
    if (!p.inBounds || p.x == null) {
      ctx.feed?.push('Tap a point on the map.', 'warn', { key: 'aim-out', ms: 1200 });
      return true;
    }
    cancel();
    ctx.castAbility?.(a.uid, { group: false, aim: [p.x, p.y], id: a.id });
    return true;
  }

  /** A tap on the board while aiming. @returns {boolean} consumed */
  function handleTap(p) {
    if (abil) return abilityTap(p);
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
    start, startAbility, clear, cancel, handleTap,
    get active() { return picking != null || !!abil; },
    /** The girl whose aim point the panel's Set aim is picking (not an ability aim). */
    get uid() { return picking; },
    /** The ability being aimed, or null. */
    get abilityId() { return abil ? abil.id : null; },
    destroy() {
      cancel();
      banner.remove();
    },
  };
}
