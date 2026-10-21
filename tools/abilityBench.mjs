// Ability bench (ABILITIES_SPEC §11): what a girl's ⚡ ability adds when it auto-casts, measured in the
// real Sim. One girl at her ⚡ tier-3 build and her tier-5 build (the ⚡ path plus a tier-2 crosspath;
// heroes at Lv 7 and Lv 17) on her best-covered spot of stage 4-5, a partner girl in her reach (an
// un-upgraded Aoi; Kage for Aoi) so rallies show up, and targets that never die (1e9 HP, healed every
// step) pinned to the road in her reach: a crowd (a column of 10 Orc Grunts along 2 tiles), a lone boss
// (the Ashwing Matriarch) and, for girls whose auto rule waits for veiled enemies or casters, a mixed
// column (veiled wraiths and shield casters). 120 s of wave time each, auto-cast Off vs On.
//
//   node --import ./tools/simLoader.mjs tools/abilityBench.mjs [girls…] [--targets crowd,boss,mixed]
//        [--preset strong|L25] [--seed 9] [--time 120] [--hp 1e9,1e9] [--json] [--out tools/baselines/abilities-a1.jsonl]
//
// --hp crowd,boss: the targets' HP (default 1e9 both, the spec's). A share-of-max-HP burn or poison
// (pct) meets 1e9 HP as absurd numbers; --hp 5e4,3e7 (bench.mjs's late-Freeplay HP) keeps them real.
// Crits (the strong preset's 25 %) draw from the battle's one random stream, so a girl's extra attacks
// shift her partner's rolls: a partner gain within ±5 % of 1 for a girl without a rally is that noise.
//
// Per row: own damage Off / On and the gain (On / Off), the partner's gain (rallies), casts, coins
// (econ), and the control share (enemy-steps frozen, stunned or shocked, Off / On). Gates (§11, owner:
// the balance pass comes LAST, so they may be red today): crowd and single-target gain ≤ 1.35×
// (specialists ≤ 1.6×: Shiro and Kaede vs the boss, Midori vs the crowd), control share ≤ today's best
// control build with Auto off.
import { writeFileSync } from 'node:fs';
import { Sim } from '../src/sim/Sim.js';
import { defaultData } from '../src/sim/data.js';
import { samplePath } from '../src/sim/path.js';
import { placeOnPath } from '../src/sim/enemies.js';
import { isImmobile } from '../src/sim/status.js';
import { xpToReach, gainHeroXp } from '../src/sim/hero.js';
import { abilityPathOf } from '../src/sim/abilities.js';

const args = process.argv.slice(2);
const VALUED = ['--targets', '--preset', '--seed', '--time', '--out', '--stage', '--hp'];
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const names = args.filter((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]));
const STAGE = opt('stage', '4-5');
const SEED = Number(opt('seed', 9));
const TIME = Number(opt('time', 120));
const d = defaultData();

// the girl's account (bench.mjs presets): strong = L60, awakened, gear; Lnn = an early account
const lv = (L, bt, st) => 1 + 0.018 * (L - 1) + 0.02 * bt + 0.05 * st;
const rt = (L) => 1 + 0.004 * (L - 1);
const PRESET = opt('preset', 'strong');
const early = (L) => {
  const bt = Math.max(0, Math.ceil((L - 10) / 10));
  return { damageMul: +lv(L, bt, 0).toFixed(4), rateMul: +rt(L).toFixed(4), rangeMul: 1, critChance: 0, critMul: 1, armorPen: 0, costMul: 1, ultHaste: 0, awakenPassive: false, level: L, awaken: 0 };
};
const STRONG = { damageMul: +(lv(60, 5, 3) * 1.45).toFixed(4), rateMul: +(rt(60) * 1.2).toFixed(4), rangeMul: 1, critChance: 0.25, critMul: 1.3, armorPen: 1, costMul: 1, ultHaste: 0, awakenPassive: true, level: 60, awaken: 3 };
const STATS = PRESET === 'strong' ? STRONG : early(Number(PRESET.slice(1)));
const [HP_CROWD, HP_BOSS] = opt('hp', '1e9,1e9').split(',').map(Number);
const TARGETS = {
  crowd: Array.from({ length: 10 }, () => 'orc_grunt'),
  boss: ['dragon_ashwing'],
  mixed: Array.from({ length: 10 }, (_, i) => (i % 2 ? 'oni_shield' : 'ghost_veilwraith')),
};
const CROSS = [2, 0, 0];
/** Girls whose auto rule waits for veiled enemies or casters (they also get the mixed column). */
const NEEDS_MIXED = (def) => ['veiled', 'caster'].includes(def.auto?.when) || !!def.auto?.orCaster || !!def.auto?.orVeiled;

function skillOf(u) {
  if (u.kind === 'hero') return u.hero?.skill || null;
  const p = abilityPathOf(u);
  return p >= 0 ? u.paths[p].ability : null;
}

/**
 * One run: the girl (and her partner) on the bench, `TIME` s of wave, Auto on or off.
 * @returns {{ dmg: number, partner: number|null, casts: number, coins: number, held: number, tiers: string }}
 */
function run(unitId, build, target, auto) {
  const u = d.units[unitId];
  const hero = u.kind === 'hero';
  const partnerId = unitId === 'aoi' ? 'kage' : 'aoi';
  const loadout = [...(hero ? [] : [{ unitId, stats: STATS }]), { unitId: partnerId, stats: STATS }];
  const sim = new Sim({ stageId: STAGE, loadout, hero: hero ? { unitId, stats: STATS } : null, seed: SEED, options: { autoAbilities: auto } });
  sim.cash = 1e15;
  sim.lives = 1e15;
  const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
  const lattice = [];
  for (let y = 0.3; y < sim.map.height; y += 0.25) for (let x = 0.3; x < sim.map.width; x += 0.25) lattice.push({ x: x + 0.013, y: y + 0.007 });
  const cov = (c, r) => samples.reduce((a, s) => a + ((s.x - c.x) * (s.x - c.x) + (s.y - c.y) * (s.y - c.y) <= r * r ? 1 : 0), 0);
  const r0 = Math.min(4, u.base.range || 3);
  const spot = lattice.map((c) => ({ ...c, cov: cov(c, r0) })).sort((a, b) => b.cov - a.cov).find((c) => sim.canPlace(unitId, c.x, c.y).ok);
  if (!spot) return { error: 'no spot' };
  const t = sim.placeTower(unitId, spot.x, spot.y);
  if (hero) gainHeroXp(sim, t, xpToReach(u.hero, build), 'restore');
  else {
    const p = abilityPathOf(u);
    for (let i = 0; i < 2; i++) sim.upgradeTower(t.uid, CROSS[p]);
    for (let i = 0; i < build; i++) sim.upgradeTower(t.uid, p);
  }
  const ps = lattice.filter((c) => (c.x - spot.x) * (c.x - spot.x) + (c.y - spot.y) * (c.y - spot.y) < 2.2 * 2.2)
    .map((c) => ({ ...c, cov: cov(c, 3.2) })).sort((a, b) => b.cov - a.cov).find((c) => sim.canPlace(partnerId, c.x, c.y).ok);
  const partner = ps ? sim.placeTower(partnerId, ps.x, ps.y) : null;
  // the column: on path 0 around the sample nearest her, 2 tiles long
  const near = samples.filter((s) => s.pathIndex === 0).reduce((b, s) => {
    const dd = (s.x - spot.x) * (s.x - spot.x) + (s.y - spot.y) * (s.y - spot.y);
    return dd < b.dd ? { dd, s } : b;
  }, { dd: Infinity }).s;
  const ids = TARGETS[target];
  const anchors = ids.map((_, i) => Math.max(0.1, near.d - 1 + (ids.length > 1 ? (2 * i) / (ids.length - 1) : 1)));
  sim.state = 'wave';
  sim.wave = Math.max(1, sim.wave);
  sim._spawnQueue = [];
  sim._spawnIndex = 0;
  const HP = target === 'boss' ? HP_BOSS : HP_CROWD;
  const foes = ids.map((id, i) => {
    const e = sim.spawnEnemy(id, { pathIndex: 0, dist: anchors[i], hpMul: HP / (d.enemies[id]?.hp || 1) });
    e.baseSpeed = 0;
    return e;
  });
  // a summoner's adds and split children are bench noise: only the column stays
  const keep = new Set(foes);
  const earned0 = sim.stats.cashEarned;
  const dmg0 = t.damageDealt;
  const pd0 = partner ? partner.damageDealt : 0;
  let held = 0;
  let seen = 0;
  const path = sim.pathData[0];
  for (let step = 0; step < TIME * 60; step++) {
    sim.update(1 / 60);
    sim.drainEvents();
    for (const e of sim.enemies) if (!keep.has(e)) e.dead = true;
    foes.forEach((e, i) => {
      if (e.dead) {
        // (never with 1e9 HP; a stand-in keeps the column whole if it happens)
        const n = sim.spawnEnemy(e.id, { pathIndex: 0, dist: anchors[i], hpMul: HP / (d.enemies[e.id]?.hp || 1) });
        n.baseSpeed = 0;
        keep.add(n);
        foes[i] = n;
        return;
      }
      e.hp = e.maxHp;
      if (e.dist !== anchors[i]) {
        e.dist = anchors[i];
        placeOnPath(e, path);
      }
      seen++;
      if (isImmobile(e)) held++;
    });
    if (sim.state !== 'wave') sim.state = 'wave';
  }
  return {
    dmg: t.damageDealt - dmg0,
    partner: partner ? partner.damageDealt - pd0 : null,
    casts: sim.stats.abilitiesUsed || 0,
    coins: sim.stats.cashEarned - earned0,
    held: seen ? held / seen : 0,
    tiers: hero ? `Lv${t.level}` : t.tiers.join('-'),
  };
}

const girls = names.length ? names : Object.values(d.units).map((u) => u.id);
const rows = [];
const r2 = (x) => Math.round(x * 100) / 100;
for (const id of girls) {
  const u = d.units[id];
  const skill = skillOf(u);
  if (!skill) continue;
  const builds = u.kind === 'hero' ? [skill.unlockLevel, ...(skill.ranks || []).map((r) => r.level)] : [3, 5];
  const targets = opt('targets', null)?.split(',') || ['crowd', 'boss', ...(NEEDS_MIXED(skill) ? ['mixed'] : [])];
  for (const build of builds) {
    for (const target of targets) {
      const t0 = Date.now();
      const off = run(id, build, target, false);
      const on = run(id, build, target, true);
      if (off.error || on.error) {
        rows.push({ unitId: id, build, target, error: off.error || on.error });
        continue;
      }
      const row = {
        unitId: id, id: skill.id, kind: skill.kind, build: u.kind === 'hero' ? `Lv${build}` : `T${build}`, tiers: on.tiers, target,
        dmgOff: Math.round(off.dmg), dmgOn: Math.round(on.dmg), gain: off.dmg > 0 ? r2(on.dmg / off.dmg) : null,
        partnerGain: off.partner > 0 ? r2(on.partner / off.partner) : null,
        casts: on.casts, coins: on.coins - off.coins, heldOff: r2(off.held), heldOn: r2(on.held),
        preset: PRESET, seed: SEED, stage: STAGE, time: TIME, hp: target === 'boss' ? HP_BOSS : HP_CROWD, ms: Date.now() - t0,
      };
      rows.push(row);
      if (args.includes('--json')) console.log(JSON.stringify(row));
    }
  }
}

const out = opt('out', null);
if (out) writeFileSync(out, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
if (!args.includes('--json')) {
  const SPECIAL = { shiro: ['boss'], kaede: ['boss'], midori: ['crowd'] };
  const bestHeld = Math.max(0, ...rows.filter((r) => !r.error).map((r) => r.heldOff));
  console.log(`| Girl | Ability | Build | Target | Own dmg Off → On | Gain | Partner | Casts | Coins | Held Off → On | Gate |`);
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    if (r.error) {
      console.log(`| ${r.unitId} | – | ${r.build} | ${r.target} | ${r.error} | | | | | | |`);
      continue;
    }
    const cap = SPECIAL[r.unitId]?.includes(r.target) ? 1.6 : 1.35;
    const gate = r.kind === 'econ' ? 'coins' : r.gain == null ? '–' : r.gain <= cap && r.heldOn <= Math.max(bestHeld, r.heldOff) ? 'ok' : `RED (≤ ${cap}×${r.heldOn > bestHeld ? ', held' : ''})`;
    console.log(`| ${r.unitId} | ${r.id} | ${r.build} ${r.tiers} | ${r.target} | ${r.dmgOff} → ${r.dmgOn} | ${r.gain ?? '–'}× | ${r.partnerGain ?? '–'}× | ${r.casts} | ${r.coins} | ${Math.round(r.heldOff * 100)}% → ${Math.round(r.heldOn * 100)}% | ${gate} |`);
  }
  console.log(`\nToday's best control share with Auto off on this bench: ${Math.round(bestHeld * 100)}%.`);
}
