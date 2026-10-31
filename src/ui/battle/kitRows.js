// MORE › Details: the rows that say what her kit does, beyond her plain attack numbers (v0.1.68, the More page audit:
// docs/review/more-page-audit.md). One row per kit piece in her effective stats: the attack shapes (S1 to S5), Iroha's
// mirrors and Ruri's familiar, Kaede's blade arts, Kinu's ring, Azami's strips, Chigusa's vines, Marumi's balls,
// Yuzuha's sentries, the duo's prism beam, Norika's barricades, Tenka's lab and well, Midori's brews, Wakaba's drinks,
// Shiro's execution shot, and her ⚡ ability. Plus `dealsDamage`, which decides whether her DPS cells show, and
// `damageSplit`, her damage by source where the sim already credits it apart (shape damage, drones).
//
// Display only: reads t.eff (her effective stats) and a few live counts on the tower (t.mirrors, t.sentries, t.vines,
// t.bars, t.lab, t.shapeDealt, t.droneDmg), never writes them. Not part of the co-op hash. Pure (no DOM): tested in
// tests/battle-ui/kitRows.test.js.
import { fmtNum } from '../format.js';
import { abilityText, abilityLrText } from '../../data/abilityText.js';
import { mirrorsReflect } from '../../sim/mirrors.js'; // (a read: do her mirrors reflect now)

/** Sim steps a second (src/sim/constants.js STEP = 1 / 60), for the kit numbers kept in steps. */
const STEPS_PER_SECOND = 60;
/** One direction-table step in degrees (src/sim/constants.js RING_DIRS = 240 steps a turn). */
const DEG_PER_STEP = 1.5;

const pct = (x) => `${Math.round((Number(x) || 0) * 100)}%`;
const plusPct = (mul) => `+${Math.round(((Number(mul) || 1) - 1) * 100)}%`;
const tiles = (r) => `${fmtNum(Number(r) || 0, 'range')} tiles`;
/** Seconds: "0.2s", "2.5s", "8s"; a minute and up as fmtNum's "2:00". */
const secs = (s) => {
  const v = Number(s) || 0;
  return v >= 60 ? fmtNum(v, 'time') : `${Math.round(v * 10) / 10}s`;
};
const stepSecs = (n) => secs((Number(n) || 0) / STEPS_PER_SECOND);
const deg = (steps) => `${Math.round((Number(steps) || 0) * DEG_PER_STEP)}°`;
const n = (v) => fmtNum(Number(v) || 0, 'count');
const plural = (k, one, many = `${one}s`) => `${n(k)} ${Number(k) === 1 ? one : many}`;
const join = (parts) => parts.filter(Boolean).join(' · ');

/** The attack-shape kits whose damage the sim credits apart (t.shapeDealt: S5 rule 6), with the name the split uses. */
export const SHAPE_NAMES = Object.freeze({ charms: 'Charms', cres: 'Crescent', toll: 'Bells', mist: 'Mist', moon: 'Moonbeam', web: 'Web' });

/** Kit pieces that deal damage of their own (a girl with one of these has a damage source even at st.dps 0). */
const DAMAGE_KITS = ['charms', 'cres', 'toll', 'mist', 'moon', 'web', 'wheel', 'spin', 'halo', 'stream', 'sweep', 'spike', 'quake', 'ret',
  'tether', 'blade', 'ring', 'strip', 'ball', 'sentry', 'duo', 'hpPct', 'trap', 'turret'];

/**
 * Does she have a damage source? Then the drawer shows her DPS (live) and DPS (avg) cells. True when the paper DPS is
 * above 0, she lays traps or strips, carries poison or burn, has a damage kit (a shape, sentries, a lashing vine or thorn
 * beds, a towel), or has dealt any damage at all (the sim's own credit: whatever the paper formula misses).
 * A pure support (Ouka, Wakaba without her towel) has none and shows "Boost to allies" instead.
 * @param {object} t the tower (t.eff, t.damageDealt)
 * @param {object} st towerStats
 */
export function dealsDamage(t, st) {
  if (!st) return false;
  if (st.dps > 0 || (t?.damageDealt || 0) > 0) return true;
  if (st.behavior === 'trap' || st.behavior === 'strip') return true;
  if ((st.status || []).some((x) => x.type === 'poison' || x.type === 'burn')) return true;
  const e = t?.eff || {};
  if (DAMAGE_KITS.some((k) => !!e[k])) return true;
  if (e.vine && ((e.vine.dps || 0) > 0 || (e.vine.beds || 0) > 0)) return true;
  if (e.drink?.towel) return true;
  if (e.lab?.rounds > 0) return true;
  return false;
}

/**
 * Her damage by source, from what the sim credits apart: her shape's damage (t.shapeDealt) and her drones'
 * (t.droneDmg); the rest is her attack. Null when there is nothing to split (one source, or no damage yet).
 * @returns {{ parts: { key: string, label: string, dealt: number, share: number }[], text: string }|null}
 */
export function damageSplit(t) {
  const total = Math.max(0, t?.damageDealt || 0);
  const e = t?.eff || {};
  const shapeKey = Object.keys(SHAPE_NAMES).find((k) => e[k]);
  const shape = Math.max(0, t?.shapeDealt || 0);
  const drone = Math.max(0, t?.droneDmg || 0);
  if (!shapeKey && !(shape > 0)) return null;
  if (!(total > 0)) return { parts: [], text: '—' };
  const parts = [{ key: 'attack', label: 'Attack', dealt: Math.max(0, total - shape - drone) }];
  if (shapeKey || shape > 0) parts.push({ key: 'shape', label: SHAPE_NAMES[shapeKey] || 'Shape', dealt: shape });
  if (drone > 0) parts.push({ key: 'drones', label: 'Drones', dealt: drone });
  for (const p of parts) p.share = p.dealt / total;
  return { parts, text: parts.map((p) => `${p.label} ${pct(p.share)}`).join(' · ') };
}

/** Her ⚡ ability's row: its name (her LR form's when she has one), and when it unlocks or its recharge. */
function abilityRow(t, st) {
  const a = st?.ability;
  if (!a || st.isHero) return null; // (a hero's skill has its own SKILL section)
  // (her LR form's name only while her battle stats carry it: src/sim/abilities.js isLr)
  const lr = a.unlocked && t?.unitStats?.lr === true && abilityLrText(a.id);
  const name = (lr && lr.name) || abilityText(a.id)?.name || a.id;
  const path = a.path != null ? t?.def?.paths?.[a.path]?.name : null;
  const when = !a.unlocked ? (a.unlockTier ? `${path ? `${path} ` : ''}tier ${a.unlockTier}` : 'locked') : a.cooldown > 0 ? `${secs(a.cooldown)} recharge` : null;
  return { key: 'ability', label: '⚡ Ability', value: join([name, when]), wide: true };
}

/**
 * Her kit rows, in a fixed order: { key, label, value, wide } (wide: the row spans the drawer's grid).
 * @param {object} t the tower
 * @param {object} st towerStats
 * @returns {{ key: string, label: string, value: string, wide: boolean }[]}
 */
export function kitRows(t, st) {
  const e = t?.eff || {};
  const rows = [];
  const add = (key, label, value, wide = true) => { if (value) rows.push({ key, label, value, wide }); };
  // --- the attack shapes, S5 (src/sim/s5shapes.js)
  if (e.charms) add('charms', 'Charm Wheel', join([`${plural(e.charms.n, 'charm')} a throw`, `${pct(e.charms.mul)} of her hit`]));
  if (e.cres) add('cres', 'Crescent', join([`${n(e.cres.cuts)} cuts a leg`, `${pct(e.cres.mul)} of her hit`, `+${tiles(e.cres.out)}`]));
  if (e.toll) add('toll', 'Bell Toll', join([`every ${stepSecs(e.toll.every)}`, `${tiles(e.toll.r)} ring`, `${pct(e.toll.mul)} of a trap hit`]));
  if (e.mist) add('mist', 'Spore Mist', join([`${deg(e.mist.half * 2)} cone`, `up to ${n(e.mist.cap)}`, `${pct(e.mist.mul)} of her DPS each`, e.mist.dot > 0 ? `spores ${pct(e.mist.dot)} of her poison` : null]));
  if (e.moon) add('moon', 'Moonbeam', join([plural(e.moon.beams, 'beam'), `±${deg(e.moon.arc)} sweep`, `${pct(e.moon.mul)} of her hit`]));
  if (e.web) add('web', 'Static Web', join([`links ${secs(e.web.dur)}`, `zaps every ${stepSecs(e.web.every)}`, `${pct(e.web.share)} of her DPS`]));
  // --- S1 to S4 (wheels.js, held.js, ground.js, links.js)
  if (e.wheel) add('wheel', 'Coin Wheel', join([plural(e.wheel.spokes, 'spoke'), `lead coin ${fmtNum(e.wheel.lead, 'mul', { detail: true })}`, `spokes ${pct(e.wheel.mul)}`]));
  if (e.spin) add('spin', 'Pinwheel', join([plural(e.spin.arms, 'arm'), `arms ${fmtNum(e.spin.mul, 'mul', { detail: true })}`, `folded ${fmtNum(e.spin.fold, 'mul', { detail: true })}`]));
  if (e.halo) add('halo', 'Petal Halo', join([plural(e.halo.pieces, 'petal'), `${pct(e.halo.mul)} of her DPS a cut`]));
  if (e.stream) add('stream', 'Stream', join([`${deg(e.stream.half * 2)} cone`, e.stream.cap > 0 ? `up to ${n(e.stream.cap)}` : null, fmtNum(e.stream.mul, 'mul', { detail: true })]));
  if (e.sweep) add('sweep', 'Sweep', join([`±${deg(e.sweep.arc)} arc`, `up to ${n(e.sweep.cap > 0 ? e.sweep.cap : st?.maxTargets || 0)} a pass`, fmtNum(e.sweep.mul, 'mul', { detail: true })]));
  if (e.spike) add('spike', 'Rising Spikes', join([plural(e.spike.count, 'spike'), `${tiles(e.spike.gap)} apart`, `others ${pct(e.spike.mul)}`]));
  if (e.quake) add('quake', 'Ripple Quake', join([plural(e.quake.rings, 'ring'), `first ${pct(e.quake.mul)} of her hit`, e.quake.rings > 1 ? `later ${pct(e.quake.later)}` : null]));
  if (e.ret) add('ret', 'Homecoming', join([`${fmtNum(Math.max(1, Math.round((st?.projectiles || 1) * e.ret.per)), 'count')} fans a throw`, `${pct(e.ret.mul)} a cut`, e.ret.pierce > 0 ? `+${n(e.ret.pierce)} cuts × ${pct(e.ret.cut)}` : null]));
  if (e.tether) add('tether', 'Spirit Tether', join([plural(e.tether.links, 'link'), tiles(e.tether.reach), secs(e.tether.dur), `${pct(e.tether.share)} shared`]));
  // --- the mirror network and the familiar (mirrors.js)
  if (e.relay?.kind === 'mirror') {
    const r = e.relay;
    add('mirrors', 'Mirrors', join([`${fmtNum(t?.mirrors?.length ?? r.mirrors, 'progress', { of: r.mirrors })} placed`, plural(r.bounces, 'bounce'), r.bounceMul > 0 ? `+${pct(r.bounceMul)} a bounce` : null, r.bounceSplash > 0 ? `splash ${fmtNum(r.bounceSplash, 'range')}` : null, r.shards > 0 ? plural(r.shards, 'shard') : null]));
    if (r.allyBounces > 0) add('allyBounces', 'Allies\' shots', `${plural(r.allyBounces, 'bounce')} · ${t?.mirrors && t.abil && mirrorsReflect(t) ? 'reflecting now' : 'while her ⚡ runs'}`);
    add('mirrorReach', 'Mirror reach', tiles(r.reach), false);
  } else if (e.relay) add('relay', 'Familiar', `reach ${tiles(e.relay.reach)}`, false);
  // --- signature kits
  if (e.blade) {
    const b = e.blade;
    add('blade', 'Blade arts', join([`every ${n(b.every)} hits`, `cleave ${n(b.targets)} × ${pct(b.share)}`, b.crescents > 0 ? `${n(b.crescents)} crescents` : null, b.storm > 0 ? `storm ${tiles(b.storm)}` : null, b.wave > 0 ? `shockwave ${tiles(b.wave)}` : null, b.maple > 0 ? `maple ${tiles(b.maple)}` : null]));
  }
  if (e.ring) {
    const r = e.ring;
    add('ring', 'Pin ring', join([r.turn ? 'turns' : null, r.heat ? 'heat ring' : null, r.double ? 'double' : null, r.sparks ? 'sparks' : null, r.scissors > 0 ? `${plural(r.scissors, 'scissor')} ${fmtNum(r.scissorMul, 'mul', { detail: true })}` : null]) || 'pins all round');
  }
  if (e.strip) {
    const s = e.strip;
    add('strip', 'Strips', join([`${n(s.hits)} hits each`, s.forever ? 'until used' : secs(s.ttl), s.carry ? 'carry over' : null, s.boom > 0 ? `boom ${fmtNum(s.boom, 'stat')}` : null, s.air > 0 ? `flyers ${pct(s.air)}` : null, s.rain > 0 ? `rain ${n(s.rainCount)}` : null]));
  }
  if (e.vine) {
    const v = e.vine;
    add('vine', 'Vines', join([`${fmtNum((t?.vines || []).length, 'progress', { of: v.max })}`, `every ${secs(v.every)}`, `${tiles(v.len)}`, v.hold > 0 ? `hold ${secs(v.hold)}` : null, v.slow > 0 ? `slow ${pct(v.slow)}` : null, v.dps > 0 ? `lash ${fmtNum(v.dps, 'stat')}/s` : null]));
    if (v.beds > 0) add('beds', 'Thorn beds', join([`${n(v.beds)} hits × ${fmtNum(v.bedDmg, 'stat')}`, secs(v.bedTtl)]));
    if (v.bloom > 0) add('bloom', 'Bloom Rush', `+${pct(v.bloomPer)} speed a second, up to +${pct(v.bloom)}`);
    if (v.lives > 0) add('lives', 'Harvest', `+${plural(v.lives, 'life', 'lives')} a wave`);
  }
  if (e.ball) {
    const b = e.ball;
    add('ball', 'Bowl', join([`${tiles(b.travel)}`, `others ${pct(b.share)}`, b.through > 0 ? `through ${n(b.through)}` : null, b.pins > 0 ? `${n(b.pins)} pins × ${fmtNum(t?.pinSpec?.damage ?? b.pinDmg, 'stat')}` : null, b.bounce > 0 ? plural(b.bounce, 'bounce') : null, b.finish > 0 && b.bounce > 0 ? `finale ${fmtNum(b.finish, 'mul', { detail: true })}` : null, b.hook ? 'hook' : null]));
  }
  if (e.sentry) {
    const s = e.sentry;
    add('sentry', 'Sentries', join([fmtNum((t?.sentries || []).length, 'progress', { of: s.max }), `${fmtNum(s.damage, 'stat')} × ${fmtNum(s.rate, 'rate')}`, `${secs(s.ttl)} each`, s.burst > 0 ? `burst ${fmtNum(s.burst, 'stat')}` : null]));
    if (s.nets > 0) add('nets', 'Capture nets', join([plural(s.nets, 'net'), `${fmtNum(s.netBudget, 'stat')} HP a wave`]));
  }
  if (e.duo) {
    const d = e.duo;
    const beam = t?.beamSpec;
    add('duoBeam', 'Prism beam', join([plural(d.beams, 'beam'), `${fmtNum(beam?.damage ?? d.beamDmg, 'stat')} dmg`, `${tiles(beam?.range ?? d.beamRange)}`, `pierce ${n(d.beamPierce)}`, d.rampMax > 0 ? `ramp +${pct(d.rampMax)}` : null]));
    add('duoShards', 'Refraction', join([`every ${plural(d.every, 'shell')}`, plural(d.shards, 'shard'), d.shardSlow > 0 ? `slow ${pct(d.shardSlow)}` : null, d.shardVuln > 0 ? `+${pct(d.shardVuln)} taken` : null]));
  }
  if (e.barricade) {
    const b = e.barricade;
    const up = (t?.bars || []).filter((x) => !x.down).length;
    add('barricade', 'Barricades', join([fmtNum(up, 'progress', { of: b.count }), `hold ${fmtNum(b.budget * (b.budgetMul || 1), 'stat')}`, `rebuild ${secs(b.rebuild)}`, b.held > 0 ? `held +${pct(b.held)} dmg` : null]));
  }
  if (e.lab) add('lab', 'Lab team', join([`round ${n(t?.lab?.rounds || 0)} of ${n(e.lab.rounds)}`, t?.lab ? `${n(Object.values(t.lab.members || {}).reduce((a, b) => a + b, 0))} girls` : null, e.lab.power > 1 ? `weapons ${fmtNum(e.lab.power, 'mul', { detail: true })}` : null]));
  if (e.well) add('well', 'Gravity well', join([`every ${secs(e.well.every)}`, tiles(e.well.radius), secs(e.well.time), e.well.slow > 0 ? `slow ${pct(e.well.slow)}` : null, e.well.vuln > 0 ? `+${pct(e.well.vuln)} taken` : null]));
  if (e.lastLine) add('lastLine', 'Last Line', join([`up to ${n(e.lastLine.max)}`, secs(e.lastLine.time), `${secs(e.lastLine.cooldown)} recharge`]));
  if (e.hpPct) add('hpPct', 'Execution', join([`${pct(e.hpPct.pct)} of current HP`, e.hpPct.boss > 0 ? `bosses ${(e.hpPct.boss * 100).toFixed(1)}%` : null]));
  // --- limited buffs (her picked girls; Chika's link is on her own tab)
  if (e.brew) {
    const b = e.brew;
    add('brew', 'Brew', join([plural(b.targets, 'girl'), b.dmgMul > 1 ? `${plusPct(b.dmgMul)} dmg` : null, b.rateMul > 1 ? `${plusPct(b.rateMul)} speed` : null, b.armorPen > 0 ? `pen ${fmtNum(b.armorPen, 'flat')}` : null, b.critChance > 0 ? `+${pct(b.critChance)} crit` : null]));
  }
  if (e.link && !(t?.turretSpec?.leash > 0)) {
    const l = e.link;
    add('link', 'Tune-up', join([plural(l.targets, 'girl'), l.dmgMul > 1 ? `${plusPct(l.dmgMul)} dmg` : null, l.rateMul > 1 ? `${plusPct(l.rateMul)} speed` : null]));
  }
  if (e.drink) {
    const d = e.drink;
    add('drink', 'Drink', join([`${n(d.shots)} charges`, d.dmg > 0 ? `+${pct(d.dmg)} dmg` : null, d.rate > 0 ? `+${pct(d.rate)} speed` : null, d.range > 0 ? `+${pct(d.range)} range` : null, d.permanent ? 'permanent' : null, d.detection ? 'Veil Sight' : null, d.cleanse ? 'cleanse' : null]));
    if (d.towel) add('towel', 'Towel Snap', `${fmtNum(d.towelDmg, 'stat')} dmg`, false);
  }
  const ab = abilityRow(t, st);
  if (ab) rows.push(ab);
  return rows;
}
