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
// Tapping the same button again (her portrait in the bar, or FIRE in her panel) casts with no aim (her own pick); Esc
// cancels. Auto-cast never aims. The board-tap modes never stack: arming a card (placement.js), a pick (Midori /
// Chika) or Set aim ends an ability aim, and an ability aim ends them, so a placement tap never fires an ability.
import { h } from './util.js';
import { aimMode } from '../../sim/towers.js';
import { abilityDef, abilityReach, abilityOrigin } from '../../sim/abilities.js';

const WHAT = {
  mortar: (n) => `Tap where ${n}'s shells should land`,
  mirror: (n) => `Tap where ${n}'s mirror should stand`,
  ult: (n) => `Tap where ${n}'s dragon should enter the road`,
  checkpoint: (n) => `Tap the road where ${n} should set up her checkpoint`,
  banner: (n) => `Tap where ${n} should plant a council banner (up to 5 tiles away)`,
};

/**
 * The ability aim banner's words (pure). `from`: where the aim started — 'bar' (her portrait at the bottom right) or
 * 'panel' (the FIRE button in her panel): tapping that again lets her pick.
 */
export function abilityAimText(kind, girl, ability, { from = 'bar' } = {}) {
  const again = from === 'panel' ? 'tap FIRE again' : 'tap her portrait again';
  if (kind === 'girl') return `Tap the girl ${girl} should coach — or ${again} for her pick`;
  if (kind === 'point') return `Tap the road for the ${ability === 'Emergency Deploy' ? 'sentries' : `${ability}`} — or ${again}`;
  return `Tap where ${girl} should use ${ability} — or ${again}`;
}

/**
 * What a board tap does while an ability aims (pure): 'pass' (a card is armed: the tap is the placement's; the aim
 * ends), 'gone' (the caster left: the aim ends, the tap goes on), 'cancel' (girl mode: empty ground or the caster
 * herself), 'cast' (at `aim`), 'outside' (point mode: off the map; the aim stays).
 * @param {{ uid: number, kind: string }} abil
 * @param {{ inBounds?: boolean, x?: number|null, y?: number|null, towerUid?: number|null }} p
 * @param {{ placing?: boolean, caster?: object|null, tapped?: object|null }} o
 * @returns {{ do: 'pass'|'gone'|'cancel'|'cast'|'outside', aim?: number[] }}
 */
export function abilityTapAction(abil, p, { placing = false, caster = null, tapped = null } = {}) {
  if (placing) return { do: 'pass' };
  if (!caster) return { do: 'gone' };
  if (abil.kind === 'girl') {
    if (!tapped || tapped.uid === abil.uid) return { do: 'cancel' };
    return { do: 'cast', aim: [tapped.x, tapped.y] };
  }
  if (!p.inBounds || p.x == null) return { do: 'outside' };
  return { do: 'cast', aim: [p.x, p.y] };
}

/** The girls an ability on one girl may go to: every other girl on the field (any player's; never the caster). */
export function aimCandidates(sim, casterUid) {
  return sim.towers.filter((o) => !o.removed && o.uid !== casterUid).map((o) => o.uid);
}

/**
 * The banner for placing Iroha's mirror `slot` (0-based) of `n` (pure). `all`: PLACE walks them in order.
 */
export function mirrorAimText(girl, slot, n, { all = false } = {}) {
  return all ? `Mirror ${slot + 1} of ${n}: tap where it should stand` : `Tap where ${girl}'s mirror ${slot + 1} should stand`;
}

export function createAimControl(ctx) {
  const { sim } = ctx;
  let picking = null; // uid
  let slot = -1; // Iroha: the mirror being placed (-1: not a mirror girl)
  let all = false; // Iroha's PLACE: each tap places the next mirror
  let abil = null; // { uid, id, kind: 'girl'|'point', name }
  const text = h('span');
  const banner = h('div.bt-dr-banner', { 'data-testid': 'aim-banner', role: 'status' }, text,
    h('button.bt-dr-link', { 'data-testid': 'aim-banner-cancel', onclick: () => cancel() }, 'Cancel'));
  banner.hidden = true;
  ctx.layer.append(banner);

  function show() {
    paint();
    // the feed steps below the banner while it is up (battle.css .bt-feed: --bt-aim-h), so no toast hides under it
    const tall = banner.hidden ? 0 : banner.offsetHeight || 0;
    ctx.shell?.style?.setProperty?.('--bt-aim-h', tall ? `${tall + 8}px` : '0px');
  }

  function paint() {
    banner.hidden = picking == null && !abil;
    banner.classList.toggle('bt-aim-ability', !!abil);
    if (abil) {
      const t = sim.getTower(abil.uid);
      text.textContent = abilityAimText(abil.kind, t?.def.name || 'She', abil.name, { from: abil.from });
      return;
    }
    if (picking == null) return;
    const t = sim.getTower(picking);
    if (slot >= 0 && t?.mirrors) {
      text.textContent = mirrorAimText(t.def.name, slot, t.mirrors.length, { all });
      return;
    }
    text.textContent = (WHAT[aimMode(t)] || WHAT.mortar)(t?.def.name || 'her');
  }

  function mine(uid) {
    if (!ctx.coop || ctx.coop.isMine(uid)) return true;
    ctx.feed?.push(`Only ${ctx.coop.ownerName(uid)} aims her.`, 'warn', { key: 'aim-ally', ms: 1600 });
    return false;
  }

  function send(uid, x, y, k = null) {
    const ok = ctx.act?.aim ? ctx.act.aim(uid, x, y, k) : x == null ? sim.clearAim(uid) : sim.setAim(uid, x, y, k);
    if (!ok) ctx.feed?.push('She cannot aim there right now.', 'warn', { key: 'aim-bad', ms: 1400 });
    ctx.panel?.update?.();
    return ok;
  }

  /**
   * Panel "Set aim": the next board tap aims her (tapping it again cancels). Iroha: `o.slot` the mirror the tap places;
   * `o.all` (PLACE) walks on to the next mirror after each tap until the last.
   */
  function start(uid, o = {}) {
    const t = sim.getTower(uid);
    if (ctx.ended || !mine(uid) || !aimMode(t)) return;
    const k = t.mirrors && Number.isInteger(o.slot) ? o.slot : -1;
    if (picking === uid && slot === k) {
      cancel();
      return;
    }
    cancel();
    ctx.placement?.cancel?.();
    ctx.cancelPick?.();
    if (ctx.flight?.active) ctx.flight.cancel();
    picking = uid;
    slot = k;
    all = k >= 0 && !!o.all;
    if (k >= 0) ctx.renderer?.setMirrorPick?.(uid, k);
    show();
  }

  /**
   * The ability bar / panel: the next board tap aims this cast. `o`: { uid (the caster), id (the ability), kind
   * ('girl' | 'point'), name (the ability's), from ('bar' | 'panel': what the banner says to tap again) }.
   */
  function startAbility(o) {
    if (ctx.ended || !o || !mine(o.uid)) return;
    const t = sim.getTower(o.uid);
    if (!t) return;
    cancel();
    ctx.placement?.cancel?.();
    ctx.cancelPick?.();
    if (ctx.flight?.active) ctx.flight.cancel();
    abil = { uid: o.uid, id: o.id, kind: o.kind, name: o.name || 'her ability', from: o.from === 'panel' ? 'panel' : 'bar' };
    if (o.kind === 'girl') {
      ctx.renderer?.setBuffPick?.(o.uid, aimCandidates(sim, o.uid));
      ctx.shell?.classList.add('bt-picking');
    } else {
      const def = abilityDef(t);
      const r = def ? abilityReach(t, def) : 0;
      // (centred where the sim looks from: abilityOrigin, e.g. a familiar's spot for a fromOrigin ability)
      const o = def ? abilityOrigin(t, def) : t;
      ctx.renderer?.setAbilityReach?.(Number.isFinite(r) && r > 0 ? { x: o.x, y: o.y, r } : null);
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
    if (slot >= 0) ctx.renderer?.setMirrorPick?.(null);
    picking = null;
    slot = -1;
    all = false;
    abil = null;
    show();
  }

  /**
   * An ability aim tap (abilityTapAction): cast at the girl or point, or cancel on empty ground (girl mode). A card
   * armed meanwhile owns the tap: the aim ends and the placement gets it (a placement tap never fires an ability).
   */
  function abilityTap(p) {
    const a = abil;
    const act = abilityTapAction(a, p, {
      placing: !!ctx.placement?.unitId,
      caster: sim.getTower(a.uid) || null,
      tapped: a.kind === 'girl' && p.towerUid != null ? sim.getTower(p.towerUid) || null : null,
    });
    switch (act.do) {
      case 'pass':
      case 'gone':
        cancel();
        return false;
      case 'cancel':
        cancel();
        return true;
      case 'outside':
        ctx.feed?.push('Tap a point on the map.', 'warn', { key: 'aim-out', ms: 1200 });
        return true;
      default:
        cancel();
        ctx.castAbility?.(a.uid, { group: false, aim: act.aim, id: a.id });
        return true;
    }
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
    const t = sim.getTower(uid);
    if (slot >= 0 && t?.mirrors) {
      // Iroha: this mirror there; PLACE walks on to the next one (the drawer redraws with the new spot)
      const k = slot;
      const more = all && k + 1 < t.mirrors.length;
      send(uid, p.x, p.y, k);
      if (more) {
        slot = k + 1;
        ctx.renderer?.setMirrorPick?.(uid, slot);
        show();
      } else cancel();
      ctx.panel?.update?.();
      return true;
    }
    cancel();
    send(uid, p.x, p.y);
    return true;
  }

  return {
    start, startAbility, clear, cancel, handleTap,
    get active() { return picking != null || !!abil; },
    /** The girl whose aim point the panel's Set aim is picking (not an ability aim). */
    get uid() { return picking; },
    /** Iroha: the mirror being placed (-1: none). */
    get slot() { return slot; },
    /** The ability being aimed, or null. */
    get abilityId() { return abil ? abil.id : null; },
    destroy() {
      cancel();
      banner.remove();
    },
  };
}
