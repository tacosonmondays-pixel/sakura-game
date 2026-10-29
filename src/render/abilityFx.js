// Generic ability FX (ABILITIES_SPEC §8.5; display only): what a cast looks like until a girl gets her bespoke look
// from the attack-FX work. Called from BattleRenderer.handleEvents for the sim's ability events (spec §6.6):
//   ability        a cue ring on the caster, then by kind: strike = lines from her to her targets; burst = a blast
//                  ring; rally = a rising glow on the buffed girls; debuff = a status pulse over the targets;
//                  deploy = a spawn-in puff; econ = a coin fountain; boost / runner = a ring and puff on her
//   abilityWarn    warning rings before delayed shells, a reticle on each target of a delayed strike
//   abilityShell   a shock ring where a shell lands (the blast itself is the sim's `explode` event); Event Horizon's
//                  second detonation (`horizon`) adds a white ring and a soft glow
//   abilityHorizon Tenka's LR Event Horizon: a gentle collapsing ring over the pull's area for its 1.5 s (two thin
//                  rings closing on the centre and a small spark growing there); Reduce motion: one still ring that fades
//   abilityFizzle  a small puff (a queued hit or shell found nothing)
//   abilityUnlock  a sparkle on the girl (abilityUpgrade: a brighter one at her tier 5)
//   lifeRestored   a heart pop over the girl who brought the life back (Noa's First Aid Call; Chigusa's harvest and
//                  Wakaba's Recovery Plan too)
// Bespoke looks on top of the generic ones (A3 M3): Moon Pounce belongs to Kon (src/render/companions.js), so while he
// is drawn this layer only marks its target (the generic line is the fallback); Storm Lance is a chain through its
// targets in strike order. Kaze's Swoop (M3 review round 2) is Hana's own look in her colours: her call (a gold streak
// up from her), then every target Kaze's figure does not dive on himself (the ones beyond her reach, all of them on
// Reduce motion or without his figure) takes a feather strike from the sky — a gold streak dropping onto it with Kaze's
// silhouette at its head, a gold burst and a spray of his feathers; his own dives get the gold burst only.
// Per-frame caps keep a busy frame cheap. Reduce motion: opacity fades only — every ring keeps its size, nothing
// flies, rises or spins, and there is no shake (the owner is motion-sensitive).
// Colours: the caster's own (the renderer's towerColor), so each girl reads as herself; the Swoop's are Hana's.
import * as THREE from 'three';

/** Per-frame budgets (ability events, target lines, rings, puffs / sparkles, Swoop feather strikes). */
export const ABILITY_FX_CAPS = Object.freeze({ events: 10, lines: 16, rings: 24, puffs: 8, strikes: 8 });
/** The event types this layer draws. */
export const ABILITY_FX_EVENTS = new Set(['ability', 'abilityWarn', 'abilityShell', 'abilityHorizon', 'abilityFizzle', 'abilityUnlock', 'abilityUpgrade', 'lifeRestored']);
/** Event Horizon's colours: Tenka's coil violet and her cyan halo (src/data/units.js palette), a white core. */
export const HORIZON_COLORS = Object.freeze({ ring: '#7a5cff', inner: '#9fe8ff', core: '#ffffff' });
/** Strikes a companion performs (src/render/companions.js): no lines from her while he is drawn. */
export const COMPANION_STRIKES = new Set(['hana.swoop', 'ruri.moonPounce']);
/** Strikes drawn as one chain through their targets, in strike order. */
export const CHAIN_STRIKES = new Set(['seiran.stormLance']);
/** Kaze's Swoop: Hana's call and the feather strikes (her own look, whether Kaze's figure is drawn or not). */
export const SWOOP_ID = 'hana.swoop';
/** The Swoop's colours: Hana's arrow gold (attackFx styles/hana.js), Kaze's tan, his white dive. */
export const SWOOP_COLORS = Object.freeze({ gold: '#f2dc96', kaze: '#d9b48a', dive: '#ffffff', glint: '#ffe7a3' });
/** A feather strike: how high above its target the streak starts (tiles), and the dive's seconds (his own dive out). */
export const STRIKE_DROP = 2.4;
export const STRIKE_TIME = 0.26;
const WARN = '#ffb703';
const GOLD = '#ffd84d';
const COIN = '#ffd43b';
const HEART = '#ff6b9a';
const TAU = Math.PI * 2;

/**
 * @param {{ sim: object, fx: object, actors?: object|null, colorOf?: (uid: number) => string, reduceMotion?: boolean,
 *   flash?: ((color: string, strength: number, decay: number) => void)|null, shake?: ((amount: number) => void)|null,
 *   companionOn?: (uid: number) => boolean, companionDives?: ((uid: number) => number[]|null)|null }} o
 *   companionOn: is this girl's companion figure drawn (Kaze, Kon)? companionDives: the targets of her Swoop just cast
 *   that Kaze's figure dives on himself (src/render/companions.js swoopTargets; asked right after he saw the event)
 * @returns {{ frame(): void, handle(ev: object): boolean, readonly used: object }}
 */
export function createAbilityFx({ sim, fx, actors = null, colorOf = () => GOLD, reduceMotion = false, flash = null, shake = null, companionOn = () => false, companionDives = null }) {
  const rm = !!reduceMotion;
  const used = { events: 0, lines: 0, rings: 0, puffs: 0, strikes: 0 };
  const can = (k, n = 1) => {
    if (used[k] + n > ABILITY_FX_CAPS[k]) return false;
    used[k] += n;
    return true;
  };
  const R = fx.R || {};

  /** A glow sprite: Reduce motion = the same size the whole time, fading out. */
  function glow(x, y, z, color, size, life, uv = R.glow) {
    if (rm) fx.spawn({ batch: 'bbA', uv, x, y, z, s0: size, s1: size, life, color, a0: 0.85, a1: 0 });
    else fx.flash(x, y, z, color, size, life);
  }
  /**
   * A ground ring of radius r: it grows from a third (Reduce motion: it keeps its size and fades). A wide ring (an
   * area's edge: a rally's or a reach's) is thin and half bright, never a glowing disc over the map.
   */
  function ring(x, z, r, life, color, { grow = true, uv = 'ringSoft', a0 = 1 } = {}) {
    if (!(r > 0) || !can('rings')) return;
    const wide = r >= 2;
    // (a dashed or soft texture stretched that wide turns blotchy: wide rings are the thin plain ring)
    const o = { uv: wide ? 'ring' : uv, a0: wide ? Math.min(a0, 0.5) : a0 };
    if (rm || !grow) fx.ring(x, z, r, r, life, color, o);
    else fx.ring(x, z, r * 0.3, r, life, color, o);
  }
  /** A straight line from (a) to (b) at heights ay / by, with a white core (no growth either way: a line that fades). */
  function line(ax, ay, az, bx, by, bz, color, life = 0.45) {
    if (!can('lines')) return;
    if (Array.isArray(fx.segments)) fx.segments.push({ ax, ay, az, bx, by, bz, w: 0.22, color: new THREE.Color(color), life, t: 0, core: true });
    glow(bx, by, bz, color, 0.55, life + 0.05);
  }
  function puff(x, y, z, color, n = 6) {
    if (!can('puffs')) return;
    if (rm) glow(x, y, z, color, 0.7, 0.45, R.smoke || R.glow);
    else fx.puff(x, y, z, color, n, 0.4, 0.38);
  }
  function sparkle(x, z, color, count = 12, height = 1) {
    if (!can('puffs')) return;
    if (rm) {
      ring(x, z, 0.6, 0.6, color, { grow: false });
      glow(x, 0.7, z, color, 0.9, 0.5);
    } else fx.sparkle(x, z, color, { count, height });
  }

  const girl = (uid) => (uid != null ? sim.getTower?.(uid) || null : null);
  /** An enemy's drawn position (its view, else the sim's), or null. */
  function enemyAt(uid) {
    const p = actors?.enemyPos?.(uid);
    if (p) return { x: p.x, y: p.y + (p.height || 0.6) * 0.55, z: p.z };
    const e = sim.enemies?.find?.((v) => v.uid === uid);
    return e && !e.dead ? { x: e.x, y: 0.45, z: e.y } : null;
  }

  /**
   * A chain from (sx, sz) through the targets in order (Storm Lance): one bright line per link that fades over half a
   * second, plus in full motion the layer's crackling chain lightning on top (her base attack's look, only 0.2 s).
   * Reduce motion: the lines alone. One link = one line of budget.
   */
  function chainThrough(sx, sz, targets, color) {
    let ax = sx;
    let ay = 0.95;
    let az = sz;
    const pts = [[sx, sz]];
    for (const uid of targets) {
      const p = enemyAt(uid);
      if (!p) continue;
      line(ax, ay, az, p.x, p.y, p.z, color, 0.55);
      pts.push([p.x, p.z]);
      ax = p.x;
      ay = p.y;
      az = p.z;
    }
    if (!rm && pts.length > 1 && typeof fx.chain === 'function') fx.chain(pts, color);
  }

  /** A streak (a fading line, no growth) from a to b with a white core; one line of budget. */
  function streak(ax, ay, az, bx, by, bz, color, w, life) {
    if (!can('lines')) return false;
    if (Array.isArray(fx.segments)) fx.segments.push({ ax, ay, az, bx, by, bz, w, color: new THREE.Color(color), life, t: 0, core: true });
    return true;
  }

  /**
   * Hana's call on a Swoop: a gold streak up from her hand into the sky (where the strikes come from) and a glint on
   * her. A still line that fades either way (Reduce motion too: nothing moves).
   */
  function swoopCall(x, z) {
    const C = SWOOP_COLORS;
    streak(x, 0.95, z, x + 0.3, 0.95 + STRIKE_DROP + 0.4, z - 0.4, C.gold, 0.2, rm ? 0.4 : 0.3);
    glow(x, 1, z, C.glint, 0.8, 0.3);
  }

  /** The hit landing on a Swoop target: a gold burst that peaks as the dive arrives (Reduce motion: still, fading). */
  function swoopBurst(p) {
    const C = SWOOP_COLORS;
    if (rm) {
      fx.spawn({ batch: 'bbA', uv: R.glow, x: p.x, y: p.y, z: p.z, s0: 1, s1: 1, life: 0.45, color: C.gold, a0: 0.9, a1: 0 });
      return;
    }
    // (shaped and short: a gold glow with a small white core, never a white-out)
    fx.spawn({ batch: 'bbA', uv: R.glow, x: p.x, y: p.y, z: p.z, s0: 1.35, s1: 0.5, life: STRIKE_TIME + 0.3, color: C.gold, a0: 0.9, a1: 0, fadeIn: STRIKE_TIME });
    fx.spawn({ batch: 'bbA', uv: R.glow, x: p.x, y: p.y, z: p.z, s0: 0.45, s1: 0.15, life: STRIKE_TIME + 0.15, color: C.dive, a0: 0.8, a1: 0, fadeIn: STRIKE_TIME });
  }

  /**
   * A feather strike on a Swoop target Kaze's figure does not dive on himself: a gold streak dropping from the sky onto
   * it with his silhouette at its head (STRIKE_TIME), the gold burst, and a spray of his feathers that drift down.
   * Reduce motion: the streak still and fading, his silhouette still over the target, three still feathers — fades only.
   * One strike of budget (the streak is a line).
   */
  function featherStrike(p) {
    if (!can('strikes')) return;
    const C = SWOOP_COLORS;
    // from above and a little behind (the camera looks down from the south): it reads as a drop from the sky
    const sx = p.x - 0.45;
    const sy = p.y + STRIKE_DROP;
    const sz = p.z - 0.35;
    streak(sx, sy, sz, p.x, p.y, p.z, C.gold, 0.34, rm ? 0.5 : STRIKE_TIME + 0.2);
    swoopBurst(p);
    const hawk = R.hawk || R.glow;
    const feather = R.feather || R.glow;
    if (rm) {
      fx.spawn({ batch: 'bbN', uv: hawk, x: p.x, y: p.y + 0.95, z: p.z, s0: 1, s1: 1, life: 0.55, color: C.kaze, a0: 1, a1: 0, rot: Math.PI });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.5;
        fx.spawn({ batch: 'bbN', uv: feather, x: p.x + Math.cos(a) * 0.4, y: p.y + 0.1, z: p.z + Math.sin(a) * 0.32, s0: 0.32, s1: 0.32, asp: 2, life: 0.6, color: i % 2 ? C.dive : C.kaze, a0: 1, a1: 0, rot: a });
      }
      return;
    }
    // Kaze's silhouette dives along the streak, head first (about a tile wide: it reads on a phone at 844)
    const T = STRIKE_TIME;
    fx.spawn({ batch: 'bbN', uv: hawk, x: sx, y: sy, z: sz, vx: (p.x - sx) / T, vy: (p.y - sy) / T, vz: (p.z - sz) / T, s0: 1.1, s1: 0.9, life: T, color: C.kaze, a0: 1, a1: 1, rot: Math.PI });
    // his feathers burst off the hit and drift down (they show as the dive lands)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.4;
      const sp = 1.3 + (i % 3) * 0.25;
      fx.spawn({
        batch: 'bbN', uv: feather, x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * sp, vy: 1.1 + (i % 2) * 0.5, vz: Math.sin(a) * sp,
        g: -2.6, drag: 2.2, s0: 0.36, s1: 0.26, asp: 2, life: T + 0.8, color: i % 2 ? C.dive : C.kaze, a0: 1, a1: 0, fadeIn: T,
        rot: a, vrot: i % 2 ? 5 : -5,
      });
    }
  }

  /**
   * Kaze's Swoop: Hana's call, then each target — the ones Kaze's figure dives on get the gold burst (his dive is the
   * look), every other one a feather strike (beyond her reach; all of them on Reduce motion or without his figure).
   */
  function swoop(ev, tx, tz, targets) {
    const dives = companionOn(ev.towerUid) ? companionDives?.(ev.towerUid) || [] : [];
    swoopCall(tx, tz);
    for (const uid of targets) {
      const p = enemyAt(uid);
      if (!p) continue;
      if (dives.includes(uid)) swoopBurst(p);
      else featherStrike(p);
    }
  }

  /** A heart over a girl (a life came back): it rises and grows a little; Reduce motion: still, fading. */
  function heart(x, z, n) {
    if (!can('puffs')) return;
    const uv = R.heart || R.glow;
    // (over her head: the figures stand about a tile tall)
    if (rm) {
      fx.spawn({ batch: 'bbN', uv, x, y: 1.6, z, s0: 0.62, s1: 0.62, life: 1.1, color: HEART, a0: 1, a1: 0 });
      return;
    }
    fx.spawn({ batch: 'bbN', uv, x, y: 1.45, z, vy: 0.55, s0: 0.5, s1: 0.72, life: 1.3, color: HEART, a0: 1, a1: 0, fadeIn: 0.1 });
    fx.text?.(`+${n || 1}`, x + 0.42, 1.7, z, HEART, 0.28, 1.1, 0.5);
  }

  function cast(ev) {
    const t = girl(ev.towerUid);
    const col = colorOf(ev.towerUid) || GOLD;
    const tx = t ? t.x : ev.x;
    const tz = t ? t.y : ev.y;
    // the cue on her: she just did something
    ring(tx, tz, 0.75, 0.45, col);
    glow(tx, 0.65, tz, col, 0.9, 0.3);
    const targets = Array.isArray(ev.targets) ? ev.targets : [];
    switch (ev.kind) {
      case 'strike': {
        if (CHAIN_STRIKES.has(ev.id)) {
          chainThrough(ev.x ?? tx, ev.y ?? tz, targets, col);
          break;
        }
        if (ev.id === SWOOP_ID) {
          swoop(ev, tx, tz, targets);
          break;
        }
        if (COMPANION_STRIKES.has(ev.id) && companionOn(ev.towerUid)) {
          // Kon carries the look: a mark on the target, no line from her
          for (const uid of targets) {
            const p = enemyAt(uid);
            if (p) ring(p.x, p.z, 0.5, 0.55, col);
          }
          break;
        }
        // (the lines are the look: no reach ring, a dashed texture stretched over a whole reach reads as blotches);
        // they start where the strike comes from (Moon Pounce without Kon drawn: his spot)
        const sx = ev.x ?? tx;
        const sz = ev.y ?? tz;
        for (const uid of targets) {
          const p = enemyAt(uid);
          if (p) line(sx, 0.95, sz, p.x, p.y, p.z, col);
        }
        break;
      }
      case 'burst':
        ring(ev.x, ev.y, Math.max(0.6, ev.radius || 0), 0.55, col);
        if (!rm) shake?.(0.12);
        break;
      case 'rally':
        if (ev.radius > 0) ring(ev.x, ev.y, ev.radius, 0.6, col, { grow: false });
        for (const uid of targets) {
          const o = girl(uid);
          if (o) sparkle(o.x, o.y, col, 6, 0.8);
        }
        break;
      case 'debuff':
        for (const uid of targets) {
          const p = enemyAt(uid);
          if (p) ring(p.x, p.z, 0.5, 0.42, col);
        }
        if (ev.scope === 'map') flash?.(col, 0.15, 2.2);
        else if (ev.radius > 0) ring(tx, tz, ev.radius, 0.5, col, { grow: false });
        break;
      case 'deploy':
        puff(ev.x, 0.3, ev.y, '#ffffff', 8);
        ring(ev.x, ev.y, 0.6, 0.45, col);
        break;
      case 'econ': {
        const coins = Math.round(ev.coins || 0);
        if (rm) {
          // (no "+N": the floating number pops in size; the HUD's coins count it)
          glow(tx, 0.9, tz, COIN, 0.8, 0.6, R.coin || R.glow);
        } else {
          fx.coin?.(tx, 0.3, tz, coins);
          if (can('puffs')) {
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * Math.PI * 2;
              fx.spawn({ batch: 'bbN', uv: R.coin || R.glow, x: tx, y: 0.5, z: tz, vx: Math.cos(a) * 0.9, vy: 2.6 + i * 0.15, vz: Math.sin(a) * 0.9, g: -7, s0: 0.2, s1: 0.16, life: 0.75, color: '#ffffff', a0: 1, a1: 0 });
            }
          }
        }
        break;
      }
      default: // boost, runner
        puff(tx, 0.3, tz, col, 5);
        break;
    }
  }

  /**
   * Event Horizon's pull (abilityHorizon): over its whole time, a thin violet ring closes from the blast's edge to the
   * centre and a cyan one follows inside it, while a small spark grows at the centre. Gentle: thin rings at half
   * brightness, no flash, no shake. Reduce motion: the edge ring holds its size and fades; the spark stays still.
   */
  function horizon(ev) {
    const C = HORIZON_COLORS;
    const r = Math.max(0.6, ev.radius || 0);
    const life = Math.max(0.3, ev.time || 1.5);
    // (normal blending, not additive: a violet ring added onto the bright road and lawns would not show)
    const o = { uv: 'ring', additive: false };
    if (rm) {
      if (can('rings')) fx.ring(ev.x, ev.y, r, r, life, C.ring, { ...o, a0: 0.55 });
      glow(ev.x, 0.4, ev.y, C.inner, 0.5, life);
      return;
    }
    if (can('rings')) fx.ring(ev.x, ev.y, r, 0.15, life, C.ring, { ...o, a0: 0.55 });
    if (can('rings')) fx.ring(ev.x, ev.y, r * 0.7, 0.1, life * 0.85, C.inner, { ...o, a0: 0.5 });
    fx.spawn({ batch: 'bbA', uv: R.glow, x: ev.x, y: 0.4, z: ev.y, s0: 0.2, s1: 0.75, life, color: C.inner, a0: 0.25, a1: 0.8 });
  }

  /** Event Horizon's second detonation: a violet ring out to the blast's edge, a white one inside it, a soft glow. */
  function horizonBlast(ev) {
    const C = HORIZON_COLORS;
    const r = Math.max(0.6, ev.radius || 0);
    if (can('rings')) fx.ring(ev.x, ev.y, rm ? r : r * 0.3, r, 0.55, C.ring, { uv: 'ring', additive: false, a0: 0.8 });
    ring(ev.x, ev.y, r * 0.6, 0.45, C.core, { uv: 'ring' });
    glow(ev.x, 0.45, ev.y, C.ring, r * 0.9, 0.32);
    if (!rm) shake?.(0.1);
  }

  function warn(ev) {
    const life = (ev.delay || 0) + (ev.shells > 1 ? ev.shells * 0.25 : 0) + 0.3;
    if (Array.isArray(ev.targets) && ev.targets.length && !(ev.radius > 0)) {
      // a delayed strike: a reticle on each marked enemy
      for (const uid of ev.targets) {
        const p = enemyAt(uid);
        if (p) ring(p.x, p.z, 0.55, life, WARN, { grow: false, uv: 'ringDashed' });
      }
      return;
    }
    const r = Math.max(0.6, ev.radius || 0);
    ring(ev.x, ev.y, r, life, WARN, { grow: false, uv: 'ringDashed' });
    ring(ev.x, ev.y, r * 0.55, life, WARN, { grow: false });
  }

  return {
    /** Starts a new frame's budgets (call before the frame's events). */
    frame() {
      used.events = 0;
      used.lines = 0;
      used.rings = 0;
      used.puffs = 0;
      used.strikes = 0;
    },
    /** Draws an ability event. @returns {boolean} true when the event is this layer's (drawn or capped). */
    handle(ev) {
      if (!ev || !ABILITY_FX_EVENTS.has(ev.type)) return false;
      if (!can('events')) return true;
      switch (ev.type) {
        case 'ability':
          cast(ev);
          break;
        case 'abilityWarn':
          warn(ev);
          break;
        case 'abilityShell': {
          const col = colorOf(ev.towerUid) || GOLD;
          ring(ev.x, ev.y, Math.max(0.5, ev.radius || 0), 0.35, col);
          glow(ev.x, 0.35, ev.y, col, Math.max(0.6, ev.radius || 0), 0.22);
          if (ev.horizon) horizonBlast(ev);
          break;
        }
        case 'abilityHorizon':
          horizon(ev);
          break;
        case 'abilityFizzle': {
          const p = ev.uid >= 0 ? enemyAt(ev.uid) : null;
          const t = girl(ev.towerUid);
          const at = p || (t ? { x: t.x, y: 0.4, z: t.y } : null);
          if (at) puff(at.x, at.y, at.z, '#cfd8e6', 4);
          break;
        }
        case 'abilityUnlock':
        case 'abilityUpgrade': {
          const t = girl(ev.towerUid);
          if (t) sparkle(t.x, t.y, GOLD, ev.type === 'abilityUpgrade' ? 18 : 14, 1.2);
          break;
        }
        case 'lifeRestored': {
          const t = girl(ev.towerUid);
          if (t) heart(t.x, t.y, ev.n);
          break;
        }
        default:
          break;
      }
      return true;
    },
    get used() {
      return { ...used };
    },
  };
}
