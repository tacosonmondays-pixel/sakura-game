// Player-facing analysis computed from sim state: pre-wave warnings ("Armored enemies
// incoming — bring Armor Pierce or Armor Break") and evidence-based debriefs ("Most leaks
// were Goblin Runners on wave 12"). Pure functions over a Sim; no rendering.

import { TRAITS, CAPABILITIES } from '../data/types.js';
import { enemyTraitKeys } from './enemies.js';

function attacks(s) {
  return s.behavior !== 'none' && (s.damage > 0 || !!s.trap || !!s.turret);
}

function statusTypes(s) {
  const set = new Set();
  for (const list of [s.status, s.trap?.status, s.turret?.status]) for (const x of list || []) set.add(x.type);
  return set;
}

/** How a placed tower's effective stats satisfy each capability key. */
const CAP_TESTS = {
  detection: (s) => !!s.detection,
  reveal: (s, st) => s.reveal > 0 || st.has('reveal'),
  antiAir: (s) => s.canHitAir && attacks(s) && s.behavior !== 'trap',
  armorPen: (s) => s.armorPen > 0,
  armorShred: (s, st) => st.has('shred'),
  barrierBreak: (s) => attacks(s) && (s.attackType === 'blast' || s.barrierMul > 1),
  multiHit: (s) => attacks(s) && (['pulse', 'chain', 'beam'].includes(s.behavior) || s.rate * s.projectiles >= 2 || (s.turret?.max || 0) > 0),
  slow: (s, st) => st.has('slow') || st.has('freeze'),
  stun: (s, st) => st.has('stun') || st.has('freeze') || st.has('shock') || s.knockback > 0,
  silence: (s, st) => s.silence > 0 || st.has('silence') || (attacks(s) && s.attackType === 'holy'),
  antiHeal: (s, st) => st.has('poison'),
  priority: (s) => attacks(s) && s.range >= 6,
  trap: (s) => s.behavior === 'trap',
  cleanse: (s) => !!s.aura?.cleanse,
  buff: (s) => !!s.aura && (s.aura.dmgMul > 1 || s.aura.rateMul > 1 || s.aura.rangeMul > 1),
  income: (s) => !!s.income,
  summon: (s) => (s.turret?.max || 0) > 0,
};

/** Capability keys provided by the girls currently on the field. */
export function fieldCapabilities(sim) {
  const caps = new Set();
  for (const t of sim.towers) {
    const s = t.eff;
    const st = statusTypes(s);
    for (const [cap, test] of Object.entries(CAP_TESTS)) if (test(s, st)) caps.add(cap);
  }
  return caps;
}

/** Can the field already answer this trait? */
function traitAnswered(trait, caps, sim) {
  if (trait === 'phasing') {
    return caps.has('silence') || sim.towers.some((t) => attacks(t.eff) && (t.eff.attackType === 'holy' || t.eff.attackType === 'mystic'));
  }
  const counters = TRAITS[trait]?.counters || [];
  return counters.some((c) => caps.has(c));
}

const SEVERE = { veiled: true, airborne: true, phasing: true };

/** Formation units (not necessarily placed) that bring one of the capabilities. */
function suggestUnits(sim, capabilities) {
  const ids = [...sim.loadout.keys()];
  if (sim.heroConfig) ids.push(sim.heroConfig.unitId);
  const base = [];
  const viaPath = [];
  for (const id of ids) {
    const def = sim.data.unit(id);
    if (!def) continue;
    if ((def.capabilities || []).some((c) => capabilities.includes(c))) base.push(id);
    else if ((def.pathCapabilities || []).some((c) => capabilities.includes(c))) viaPath.push(id);
  }
  return [...base, ...viaPath];
}

function capList(caps) {
  const names = caps.map((c) => CAPABILITIES[c]?.name || c);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

function unitNames(sim, ids) {
  return ids.map((id) => sim.data.unit(id)?.name || id);
}

const SEVERITY_ORDER = { danger: 0, warn: 1, info: 2 };

/**
 * Warnings for wave n.
 * @param {import('./Sim.js').Sim} sim
 */
export function buildWaveWarnings(sim, n) {
  const info = sim.waveInfo(n);
  if (!info.length) return [];
  const caps = fieldCapabilities(sim);
  const introduces = new Set(sim.stage.introduces || []);
  const out = [];
  const byTrait = new Map();

  for (const entry of info) {
    const def = sim.data.enemy(entry.enemyId);
    if (!def) continue;
    const name = def.name || def.id;
    if (def.tier === 'boss' || def.tier === 'miniboss') {
      out.push({
        kind: 'boss', severity: 'danger', enemyId: def.id,
        text: `${name} approaches!${def.counters ? ` ${def.counters}` : ''}`,
      });
    } else if (!sim.encountered.has(def.id) && (introduces.has(def.id) || entry.traits.some((t) => introduces.has(t)))) {
      const t = entry.traits[0];
      const rule = t && TRAITS[t] ? ` — ${TRAITS[t].name}: ${TRAITS[t].desc}` : '';
      out.push({ kind: 'new', severity: 'info', enemyId: def.id, text: `New enemy: ${name}${rule}`, tip: def.counters || '' });
    }
    for (const t of entry.traits) {
      if (!byTrait.has(t)) byTrait.set(t, []);
      byTrait.get(t).push(entry);
    }
  }

  for (const [trait, entries] of byTrait) {
    const counters = TRAITS[trait]?.counters || [];
    if (!counters.length || traitAnswered(trait, caps, sim)) continue;
    const names = entries.map((e) => `${sim.data.enemy(e.enemyId)?.name || e.enemyId} ×${e.count}`).join(', ');
    const suggest = suggestUnits(sim, counters);
    const help = suggest.length ? ` ${unitNames(sim, suggest.slice(0, 3)).join(', ')} can help.` : '';
    out.push({
      kind: 'counter',
      severity: SEVERE[trait] ? 'danger' : 'warn',
      trait,
      enemyIds: entries.map((e) => e.enemyId),
      capabilities: counters,
      suggest,
      text: `${TRAITS[trait].name} enemies incoming (${names}) — bring ${capList(counters)}.${help}`,
    });
  }
  out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return out;
}

/**
 * Battle debrief from recorded events.
 * @param {import('./Sim.js').Sim} sim
 */
export function buildDebrief(sim) {
  const st = sim.stats;
  const enemyName = (id) => sim.data.enemy(id)?.name || id;
  const byEnemy = new Map();
  const byWave = new Map();
  const byTrait = new Map();
  const pairs = new Map();
  for (const l of st.leakLog) {
    const def = sim.data.enemy(l.enemyId);
    const traits = enemyTraitKeys(def);
    const be = byEnemy.get(l.enemyId) || { enemyId: l.enemyId, name: enemyName(l.enemyId), count: 0, lives: 0, traits };
    be.count++;
    be.lives += l.lives;
    byEnemy.set(l.enemyId, be);
    const bw = byWave.get(l.wave) || { wave: l.wave, count: 0, lives: 0 };
    bw.count++;
    bw.lives += l.lives;
    byWave.set(l.wave, bw);
    for (const t of traits) byTrait.set(t, (byTrait.get(t) || 0) + l.lives);
    const key = `${l.enemyId}|${l.wave}`;
    const p = pairs.get(key) || { enemyId: l.enemyId, wave: l.wave, lives: 0, count: 0 };
    p.lives += l.lives;
    p.count++;
    pairs.set(key, p);
  }
  const enemies = [...byEnemy.values()].sort((a, b) => b.lives - a.lives);
  const waves = [...byWave.values()].sort((a, b) => a.wave - b.wave);
  const traits = [...byTrait.entries()].map(([trait, lives]) => ({ trait, lives })).sort((a, b) => b.lives - a.lives);

  const units = st.towerUnits || {};
  const totalDmg = Object.values(st.damageByTower).reduce((a, b) => a + b, 0) || 0;
  const damage = Object.entries(st.damageByTower)
    .map(([uid, dmg]) => {
      const unitId = units[uid] || null;
      return { uid: Number(uid), unitId, name: sim.data.unit(unitId)?.name || unitId || '?', damage: dmg, share: totalDmg ? dmg / totalDmg : 0 };
    })
    .sort((a, b) => b.damage - a.damage);

  const lines = [];
  if (!st.leaks) {
    lines.push(sim.state === 'won' ? 'Flawless defence — no lives lost.' : 'No enemy has slipped through yet.');
  } else {
    const top = [...pairs.values()].sort((a, b) => b.lives - a.lives)[0];
    lines.push(`Most leaks were ${enemyName(top.enemyId)} on wave ${top.wave} (${top.lives} ${top.lives === 1 ? 'life' : 'lives'}).`);
    const bossLeak = st.leakLog.find((l) => {
      const tier = sim.data.enemy(l.enemyId)?.tier;
      return tier === 'boss' || tier === 'miniboss';
    });
    if (bossLeak) lines.push(`${enemyName(bossLeak.enemyId)} broke through on wave ${bossLeak.wave}.`);
    const caps = fieldCapabilities(sim);
    const worst = traits.find((t) => (TRAITS[t.trait]?.counters || []).length);
    if (worst) {
      const pct = Math.round((worst.lives / st.leaks) * 100);
      const counters = TRAITS[worst.trait].counters;
      if (!traitAnswered(worst.trait, caps, sim)) {
        const suggest = suggestUnits(sim, counters);
        const help = suggest.length ? ` Try ${unitNames(sim, suggest.slice(0, 3)).join(', ')}.` : '';
        lines.push(`${TRAITS[worst.trait].name} enemies caused ${pct}% of lost lives and none of your girls had ${capList(counters)}.${help}`);
      } else {
        lines.push(`${TRAITS[worst.trait].name} enemies caused ${pct}% of lost lives — place your ${capList(counters)} girls closer to their path or upgrade them.`);
      }
    }
  }
  if (damage.length && totalDmg > 0) {
    lines.push(`${damage[0].name} dealt the most damage (${Math.round(damage[0].share * 100)}%).`);
  }
  return {
    won: sim.state === 'won',
    lost: sim.state === 'lost',
    wave: sim.wave,
    wavesCleared: sim.wavesCleared,
    livesLost: st.leaks,
    leaks: { total: st.leaks, enemies, waves, traits },
    damage,
    lines,
  };
}
