// Buffs on girls (owner, Oct 15: "icons so we know who is getting buffed and from where", and "limited
// buffs but make the buff really strong"):
//   - aura pen / crit join the effective stats (applyBuffExtras, end of refreshEffective);
//   - limited buffs: Midori's brews (a few girls in her range, re-brewed every BREW_EVERY s) and Chika's
//     tune-up links (1-2 girls in her aura, held while they stay in it; tier 5 overclocks them every
//     `every` s for `time` s). One brew and one link per girl at most; they multiply on top of auras;
//   - who gives what, for the UI (read-only): sim.buffSources(uid) / sim.buffTargets(uid) /
//     sim.aurasCovering(uid) (Sim.js), from t.buffBy (aura winners per key, recomputeBuffs), t.limIn
//     (the brew / link a girl holds) and t.lim (what a brewer / linker is doing).
// Deterministic: fixed-step timers, sim.towers order (placement order), explicit tie breaks (uid); nothing
// reads a view slot, the clock or Math.random. The pick command (setBuffPick) is the only player input.
import { BREW_EVERY, BREW_TIME, BREW_DROP, DPS_WINDOW, LINK_SCAN } from './constants.js';

/** Aura winner uid per buff key (-1: none); `rally`: the girl whose ability rally reaches her. */
export function emptyBuffBy() {
  return { dmg: -1, rate: -1, range: -1, pen: -1, crit: -1, det: -1, cost: -1, cleanse: -1, rally: -1 };
}

/** What a girl holds: the brew (source uid, seconds left), the link (source uid) and overclock. */
export function emptyLimIn() {
  return { brew: -1, brewLeft: 0, link: -1, oc: false };
}

/**
 * End of refreshEffective: aura / brew / link armor pen and crit chance join the effective stats and the
 * trap and drone hit specs. A girl without them keeps every number bit-identical.
 */
export function applyBuffExtras(t, b) {
  if (b.armorPen > 0) {
    t.eff.armorPen = t.stats.armorPen + b.armorPen;
    if (t.trapSpec) t.trapSpec.armorPen += b.armorPen;
    if (t.turretSpec) t.turretSpec.armorPen += b.armorPen;
  }
  if (b.critChance > 0) {
    t.eff.critChance = Math.min(1, t.stats.crit.chance + b.critChance);
    if (t.turretSpec) t.turretSpec.critChance = Math.min(1, t.turretSpec.critChance + b.critChance);
  }
}

/** Range in which a girl's limited buff reaches (brew: her attack range; link: her aura). */
export function limitedRange(t) {
  if (t.stats?.brew) return t.eff?.range ?? t.stats.range;
  if (t.stats?.link) return t.stats.aura?.range || t.eff?.range || t.stats.range;
  return 0;
}

function inReach(src, o, range) {
  const dx = o.x - src.x;
  const dy = o.y - src.y;
  return dx * dx + dy * dy <= range * range;
}

/** DPS a girl would deal on paper (tie break for picks before any damage has been dealt). */
export function projectedDps(t) {
  const e = t.eff;
  if (!e) return 0;
  let d = e.behavior === 'none' || e.behavior === 'trap' ? 0 : e.damage * e.rate * (e.behavior === 'pulse' ? 1 : e.projectiles);
  if (t.turretSpec && t.turrets?.length) d += t.turretSpec.damage * t.turretSpec.rate * t.turrets.length;
  if (t.trapSpec) d += t.trapSpec.damage * e.rate;
  return d;
}

/**
 * Up to `n` girls for `src`'s limited buff: her pin first (if in reach and allowed), then the highest
 * recentDps, then the highest projected DPS, then the lower uid. Girls that cannot attack are never
 * auto-picked (a pin may still name one). `allow(o, pinned)` filters (another source's brew / link).
 */
function pickTargets(sim, src, range, n, allow) {
  const out = [];
  const pin = src.buffPick >= 0 ? sim.getTower(src.buffPick) : null;
  if (pin && pin !== src && !pin.removed && inReach(src, pin, range) && allow(pin, true)) out.push(pin);
  if (out.length >= n) return out;
  const cands = [];
  for (const o of sim.towers) {
    if (o === src || o === pin || o.removed || !o.eff || o.eff.behavior === 'none') continue;
    if (!inReach(src, o, range) || !allow(o, false)) continue;
    cands.push(o);
  }
  cands.sort((a, b) => (b.recentDps || 0) - (a.recentDps || 0) || projectedDps(b) - projectedDps(a) || a.uid - b.uid);
  for (const o of cands) {
    if (out.length >= n) break;
    out.push(o);
  }
  return out;
}

function limIn(o) {
  return o.limIn || (o.limIn = emptyLimIn());
}

/** Midori: re-brews every BREW_EVERY s (or at once after a pin change). @returns {boolean} buffs changed */
function brewTick(sim, t, brew, dt) {
  let lim = t.lim;
  if (!lim || lim.kind !== 'brew') lim = t.lim = { kind: 'brew', cd: 0, repick: false, targets: [] };
  lim.cd -= dt;
  if (lim.cd > 0 && !lim.repick) return false;
  if (t.disabled > 0) return false; // sabotaged: the next brew waits
  lim.cd = BREW_EVERY;
  lim.repick = false;
  const n = Math.max(1, Math.round(brew.targets || 1));
  // one brew per girl: skip a girl brewed by another Midori (a pin overrides a higher-uid brewer only)
  const allow = (o, pinned) => {
    const b = o.limIn?.brew ?? -1;
    if (b < 0 || b === t.uid || !sim.getTower(b)) return true;
    return pinned && b > t.uid;
  };
  const picks = pickTargets(sim, t, limitedRange(t), n, allow);
  const ids = picks.map((o) => o.uid);
  // a girl she no longer brews loses it within BREW_DROP s
  for (const o of sim.towers) {
    const li = o.limIn;
    if (li && li.brew === t.uid && !ids.includes(o.uid)) li.brewLeft = Math.min(li.brewLeft, BREW_DROP);
  }
  for (const o of picks) {
    const li = limIn(o);
    li.brew = t.uid;
    li.brewLeft = BREW_TIME;
  }
  lim.targets = ids;
  if (ids.length) sim._emit('brew', { uid: t.uid, targets: ids.slice() });
  return true;
}

/** Chika: holds her links while the girls stay in her aura; tier 5 overclocks them. @returns {boolean} */
function linkTick(sim, t, link, dt) {
  let lim = t.lim;
  if (!lim || lim.kind !== 'link') lim = t.lim = { kind: 'link', targets: [], repick: false, scan: 0, ocCd: -1, ocLeft: 0 };
  const range = limitedRange(t);
  const n = Math.max(1, Math.round(link.targets || 1));
  let changed = false;
  const release = (o) => {
    if (o?.limIn && o.limIn.link === t.uid) {
      o.limIn.link = -1;
      o.limIn.oc = false;
    }
  };
  // keep the links that still hold (girl here, in reach, still mine); a pin change re-picks everything
  const keep = [];
  for (const uid of lim.targets) {
    const o = sim.getTower(uid);
    const ok = o && !o.removed && o.limIn?.link === t.uid && inReach(t, o, range) && !lim.repick && keep.length < n;
    if (ok) keep.push(uid);
    else {
      release(o);
      changed = true;
    }
  }
  lim.scan -= dt;
  if ((keep.length < n && lim.scan <= 0) || lim.repick) {
    lim.scan = LINK_SCAN;
    lim.repick = false;
    // one link per girl: never a girl another Chika links (a pin overrides a higher-uid linker only)
    const allow = (o, pinned) => {
      const l = o.limIn?.link ?? -1;
      if (l < 0 || l === t.uid || !sim.getTower(l)) return true;
      return pinned && l > t.uid;
    };
    const picks = pickTargets(sim, t, range, n, allow);
    // a pinned girl comes first; then the links already held, then new ones
    const next = [];
    if (picks.length && t.buffPick === picks[0].uid) next.push(picks[0].uid);
    for (const uid of keep) if (next.length < n && !next.includes(uid)) next.push(uid);
    for (const o of picks) if (next.length < n && !next.includes(o.uid)) next.push(o.uid);
    for (const uid of keep) if (!next.includes(uid)) release(sim.getTower(uid));
    for (const uid of next) {
      const o = sim.getTower(uid);
      const li = limIn(o);
      if (li.link !== t.uid) {
        const prev = li.link >= 0 ? sim.getTower(li.link) : null;
        if (prev?.lim?.targets) prev.lim.targets = prev.lim.targets.filter((x) => x !== uid);
        li.link = t.uid;
        li.oc = lim.ocLeft > 0;
        changed = true;
      }
    }
    if (next.length !== lim.targets.length || next.some((u, i) => lim.targets[i] !== u)) changed = true;
    lim.targets = next;
  } else lim.targets = keep;
  // overclock: counts from the first link; every `every` s her links run at ×rateMul for `time` s
  const oc = link.overclock;
  if (oc) {
    if (lim.ocLeft > 0) {
      lim.ocLeft -= dt;
      if (lim.ocLeft <= 0) {
        lim.ocLeft = 0;
        for (const uid of lim.targets) limIn(sim.getTower(uid)).oc = false;
        sim._emit('overclock', { uid: t.uid, on: false, targets: lim.targets.slice() });
        changed = true;
      }
    } else if (lim.targets.length && !(t.disabled > 0)) {
      if (lim.ocCd < 0) lim.ocCd = oc.every;
      lim.ocCd -= dt;
      if (lim.ocCd <= 0) {
        lim.ocCd += oc.every;
        lim.ocLeft = oc.time;
        for (const uid of lim.targets) limIn(sim.getTower(uid)).oc = true;
        sim._emit('overclock', { uid: t.uid, on: true, targets: lim.targets.slice() });
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * One fixed step of the limited buffs (Sim._updateBuffs, before recomputeBuffs): the recent-DPS window,
 * brew timers, links and overclock. Sets sim._buffsDirty when any girl's limited buff changed.
 */
export function updateLimited(sim, dt) {
  const towers = sim.towers;
  sim._dpsTimer -= dt;
  if (sim._dpsTimer <= 0) {
    sim._dpsTimer += DPS_WINDOW;
    for (const t of towers) {
      t.recentDps = (t.damageDealt - (t._dmgMark || 0)) / DPS_WINDOW;
      t._dmgMark = t.damageDealt;
    }
  }
  let dirty = false;
  for (const t of towers) {
    // a pin on a girl that was sold is cleared (leaving range only skips her)
    if (t.buffPick >= 0 && !sim.getTower(t.buffPick)) t.buffPick = -1;
    const li = t.limIn;
    if (!li) continue;
    if (li.brew >= 0) {
      li.brewLeft -= dt;
      if (li.brewLeft <= 0 || !sim.getTower(li.brew)) {
        li.brew = -1;
        li.brewLeft = 0;
        dirty = true;
      }
    }
    if (li.link >= 0 && !sim.getTower(li.link)?.stats?.link) {
      li.link = -1;
      li.oc = false;
      dirty = true;
    }
  }
  for (const t of towers) {
    const s = t.stats;
    if (s?.brew) dirty = brewTick(sim, t, s.brew, dt) || dirty;
    else if (s?.link) dirty = linkTick(sim, t, s.link, dt) || dirty;
  }
  if (dirty) sim._buffsDirty = true;
}

/**
 * recomputeBuffs, after the aura maxima: the brew and the link a girl holds multiply her damage and
 * attack speed on top of the auras and add armor pen and crit chance. A sabotaged Chika's link is off.
 */
export function applyLimited(sim, t, nb) {
  const li = t.limIn;
  if (!li) return;
  if (li.brew >= 0) {
    const b = sim.getTower(li.brew)?.stats?.brew;
    if (b) {
      nb.dmgMul *= b.dmgMul;
      nb.rateMul *= b.rateMul;
      nb.armorPen += b.armorPen;
      nb.critChance += b.critChance;
    }
  }
  if (li.link >= 0) {
    const src = sim.getTower(li.link);
    const l = src?.stats?.link;
    if (l && !(src.disabled > 0)) {
      nb.dmgMul *= l.dmgMul;
      nb.rateMul *= l.rateMul * (l.overclock && src.lim?.ocLeft > 0 ? l.overclock.rateMul : 1);
      nb.armorPen += l.armorPen;
      nb.critChance += l.critChance;
    }
  }
}

/**
 * The ability rallies that reach a girl (src/sim/abilities.js: Miko's Shrine Chorus, Hikari's Morning
 * Rally, Umeko's Lantern Flare rider), every rally in sim._rallies order: within its radius of its
 * caster (never the caster herself, like an aura), or anywhere for a map rally. Strongest per key
 * wins across both players' rallies.
 * @param {(key: string, value: number|boolean, r: object) => void} [each] called for every key the
 *   winning rallies give (UI rows); absent in recomputeBuffs
 * @returns {{ dmgMul: number, rateMul: number, rangeMul: number, detection: boolean, ward: boolean, src: number }|null}
 */
export function ralliesOn(sim, t) {
  let out = null;
  for (const r of sim._rallies) {
    if (r.src === t.uid) continue;
    const c = sim.getTower(r.src);
    if (!c || c.removed) continue;
    if (!r.map) {
      const dx = c.x - t.x;
      const dy = c.y - t.y;
      if (dx * dx + dy * dy > r.r2) continue;
    }
    if (!out) out = { dmgMul: 1, rateMul: 1, rangeMul: 1, detection: false, ward: false, src: r.src, by: { dmg: -1, rate: -1, range: -1, det: -1, ward: -1 }, left: {} };
    const o = out;
    if (r.dmgMul > o.dmgMul) { o.dmgMul = r.dmgMul; o.by.dmg = r.src; o.left.dmg = r.left; }
    if (r.rateMul > o.rateMul) { o.rateMul = r.rateMul; o.by.rate = r.src; o.left.rate = r.left; }
    if (r.rangeMul > o.rangeMul) { o.rangeMul = r.rangeMul; o.by.range = r.src; o.left.range = r.left; }
    if (r.detection && !o.detection) { o.detection = true; o.by.det = r.src; o.left.det = r.left; }
    if (r.ward && !o.ward) { o.ward = true; o.by.ward = r.src; o.left.ward = r.left; }
  }
  return out;
}

/**
 * recomputeBuffs, after the limited buffs: the strongest rally per key multiplies her damage, attack
 * speed and range, and a rally's Veil Sight and ward (blocks sabotage, like a cleanse aura) are OR-ed in.
 */
export function applyRallies(sim, t, nb, by) {
  const r = ralliesOn(sim, t);
  if (!r) return;
  nb.dmgMul *= r.dmgMul;
  nb.rateMul *= r.rateMul;
  nb.rangeMul *= r.rangeMul;
  if (r.detection) nb.detection = true;
  if (r.ward) nb.cleanse = true;
  if (by) by.rally = r.src;
}

const KEY_OF = { dmgMul: 'dmg', rateMul: 'rate', armorPen: 'pen', critChance: 'crit' };

function limitedRows(sim, src, set, kind, left, rows, oc = 1) {
  if (!src || !set) return;
  for (const [k, key] of Object.entries(KEY_OF)) {
    const v = set[k];
    if (k === 'dmgMul' || k === 'rateMul') {
      const m = v * (k === 'rateMul' ? oc : 1);
      if (m > 1) rows.push({ key, value: m - 1, kind, src: src.uid, unitId: src.unitId, left });
    } else if (v > 0) rows.push({ key, value: v, kind, src: src.uid, unitId: src.unitId, left });
  }
}

/**
 * Every buff a girl has and who gives it (UI, read-only): limited first (brew, link / overclock), then
 * the winning aura per key, then the hero's ultimate.
 * @returns {{ key: 'dmg'|'rate'|'range'|'pen'|'crit'|'det'|'cost'|'cleanse', value: number|boolean,
 *   kind: 'aura'|'brew'|'link'|'overclock'|'ult'|'map', src: number, unitId: string|null, left: number|null }[]}
 */
export function buffSources(sim, uid) {
  const t = sim.getTower(uid);
  if (!t) return [];
  const rows = [];
  const li = t.limIn;
  if (li?.brew >= 0) {
    const src = sim.getTower(li.brew);
    limitedRows(sim, src, src?.stats?.brew, 'brew', li.brewLeft, rows);
  }
  if (li?.link >= 0) {
    const src = sim.getTower(li.link);
    const l = src?.stats?.link;
    if (l && !(src.disabled > 0)) {
      const on = !!(l.overclock && src.lim?.ocLeft > 0);
      limitedRows(sim, src, l, on ? 'overclock' : 'link', on ? src.lim.ocLeft : null, rows, on ? l.overclock.rateMul : 1);
    }
  }
  const by = t.buffBy || emptyBuffBy();
  const aura = (key, uidSrc, value) => {
    if (uidSrc < 0) return;
    const src = sim.getTower(uidSrc);
    if (src) rows.push({ key, value, kind: 'aura', src: uidSrc, unitId: src.unitId, left: null });
  };
  const au = (u) => sim.getTower(u)?.stats?.aura;
  if (by.dmg >= 0) aura('dmg', by.dmg, (au(by.dmg)?.dmgMul ?? 1) - 1);
  if (by.rate >= 0) aura('rate', by.rate, (au(by.rate)?.rateMul ?? 1) - 1);
  if (by.pen >= 0) aura('pen', by.pen, au(by.pen)?.armorPen ?? 0);
  if (by.crit >= 0) aura('crit', by.crit, au(by.crit)?.critChance ?? 0);
  if (by.range >= 0) aura('range', by.range, (au(by.range)?.rangeMul ?? 1) - 1);
  if (by.det >= 0) aura('det', by.det, true);
  if (by.cost >= 0) aura('cost', by.cost, au(by.cost)?.costCut ?? 0);
  if (by.cleanse >= 0) aura('cleanse', by.cleanse, true);
  if (sim.globalRateMul > 1) {
    let best = null;
    for (const g of sim._globalBuffs) if (g.left > 0 && (!best || g.mul > best.mul)) best = g;
    const src = best && best.src >= 0 ? sim.getTower(best.src) : null;
    rows.push({ key: 'rate', value: sim.globalRateMul - 1, kind: 'ult', src: best?.src ?? -1, unitId: src?.unitId ?? null, left: best?.left ?? null });
  }
  if (t.envRangeMul > 1) rows.push({ key: 'range', value: t.envRangeMul - 1, kind: 'map', src: -1, unitId: null, left: null });
  // ability rallies (src/sim/abilities.js), seconds left from their tick countdowns
  const ra = sim._rallies?.length ? ralliesOn(sim, t) : null;
  if (ra) {
    const row = (key, k, value) => {
      const uidSrc = ra.by[k];
      if (uidSrc < 0) return;
      rows.push({ key, value, kind: 'rally', src: uidSrc, unitId: sim.getTower(uidSrc)?.unitId ?? null, left: ra.left[k] / 60 });
    };
    row('dmg', 'dmg', ra.dmgMul - 1);
    row('rate', 'rate', ra.rateMul - 1);
    row('range', 'range', ra.rangeMul - 1);
    row('det', 'det', true);
    row('cleanse', 'ward', true);
  }
  return rows;
}

/**
 * The girls this girl currently buffs (UI, read-only): her brew / link targets first, then the girls
 * whose winning aura of some key is hers. @returns {{ uid: number, kinds: string[], keys: string[] }[]}
 */
export function buffTargets(sim, uid) {
  const t = sim.getTower(uid);
  if (!t) return [];
  const out = new Map();
  const add = (o, kind, key) => {
    let r = out.get(o.uid);
    if (!r) out.set(o.uid, (r = { uid: o.uid, kinds: [], keys: [] }));
    if (!r.kinds.includes(kind)) r.kinds.push(kind);
    if (key && !r.keys.includes(key)) r.keys.push(key);
  };
  const lim = t.stats?.brew ? 'brew' : t.stats?.link ? 'link' : null;
  if (lim) {
    for (const o of sim.towers) {
      const li = o.limIn;
      if (!li) continue;
      if (lim === 'brew' && li.brew === uid) add(o, 'brew', null);
      if (lim === 'link' && li.link === uid) add(o, li.oc ? 'overclock' : 'link', null);
    }
    // limited targets first, in her pick order
    const order = t.lim?.targets || [];
    const rows = [...out.values()].sort((a, b) => {
      const ia = order.indexOf(a.uid);
      const ib = order.indexOf(b.uid);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.uid - b.uid;
    });
    out.clear();
    for (const r of rows) out.set(r.uid, r);
  }
  for (const o of sim.towers) {
    const by = o.buffBy;
    if (!by || o === t) continue;
    for (const key of Object.keys(by)) if (by[key] === uid) add(o, key === 'rally' ? 'rally' : 'aura', key === 'rally' ? null : key);
  }
  return [...out.values()];
}

/**
 * Every aura source in range of a girl, the ones that lost included (a selected girl only: "2 weaker auras
 * here don't stack"). @returns {{ src: number, unitId: string, keys: string[], won: string[] }[]}
 */
export function aurasCovering(sim, uid) {
  const t = sim.getTower(uid);
  if (!t) return [];
  const by = t.buffBy || emptyBuffBy();
  const out = [];
  for (const a of sim.towers) {
    const au = a.stats?.aura;
    if (a === t || !au || a.disabled > 0 || !inReach(a, t, au.range)) continue;
    const keys = [];
    if (au.dmgMul > 1) keys.push('dmg');
    if (au.rateMul > 1) keys.push('rate');
    if (au.armorPen > 0) keys.push('pen');
    if (au.critChance > 0) keys.push('crit');
    if (au.rangeMul > 1) keys.push('range');
    if (au.detection) keys.push('det');
    if (au.costCut > 0) keys.push('cost');
    if (au.cleanse) keys.push('cleanse');
    if (!keys.length) continue;
    out.push({ src: a.uid, unitId: a.unitId, keys, won: keys.filter((k) => by[k] === a.uid) });
  }
  return out;
}
