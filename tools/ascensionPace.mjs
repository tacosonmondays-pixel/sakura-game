// Ascension pace model (docs/specs/ASCENSION.md §E, gates E1, E4, E5): what a free player and a spender
// earn a week from Titan Trials on the BUILT tables (src/systems/titanRewards.js expected values, the gate
// costs of src/systems/progression.js, the Titan shelf of src/data/shop.js, the Craft Room caps), and when
// their girls reach level 75 / 85. Expected values, not rolls; one week at a time; every currency spent
// once (tokens: the shelf; coins: gates, then levels). Prints the E1 timeline, Star Fragments a week (E4)
// and a Rainbow Meter Monte Carlo (E5).
//
//   node --import ./tools/simLoader.mjs tools/ascensionPace.mjs [--weeks 40]
//
// Assumptions (§E.1): base income 395k coins a week, 300k of it to other sinks (free) / 630k gem coins a
// week on top (spender); the free carries (Shiro, Kage, Aoi: feathers; Sango: embers) reach L60 at gate 5
// in week 9 with every R/SR girl at P6 by then; the spender's nine girls at week 1. Titans: free Normal
// weeks 1–4 (Silver then Victory), Hard 5–9, Nightmare from 10, Mayhem once three carries are L85 (8
// Victories + 4 Gold); spender Hard 1–2, Nightmare 3–8, Mayhem 9–14, Mayhem +2 after. All 12 keys on the
// titan that drops the family the next girl needs; tokens 108.5 a week from other sources go to the Boss
// ticket and fragment packs first, the titans' tokens to the shelf (crown shard, Zenith, legendary ×4).
// Levels between gates cost 12k coins each (Tomes never bind in the spec's model).
import { damageTable, victoryChest, notchFor, RAINBOW_METER } from '../src/systems/titanRewards.js';
import { breakthroughCost } from '../src/systems/progression.js';
import { createRng } from '../src/core/rng.js';

const args = process.argv.slice(2);
const WEEKS = Number(args.includes('--weeks') ? args[args.indexOf('--weeks') + 1] : 40);
const GATE_CAPS = [10, 20, 30, 40, 50, 60, 63, 67, 72, 78, 85];
const LEVEL_COINS = 12000;

/** Expected per fight of a tier at a share (Victory adds the chest). target / other family + extras. */
function fightEV(tier, rank, share, victory) {
  const t = damageTable(tier, rank);
  const out = { coins: t.coins * share, fragments: t.star_fragment * share, tokens: t.token_boss * share, target: {}, other: {}, zenith: 0, shards: 0, crowns: 0 };
  for (const [r, x] of t.target) out.target[r] = (out.target[r] || 0) + x * share;
  for (const [r, x] of t.other) out.other[r] = (out.other[r] || 0) + x * share;
  if (victory) {
    const c = victoryChest(tier, rank);
    for (const [r, x] of c.target) out.target[r] = (out.target[r] || 0) + x;
    out.zenith += c.zenith || 0;
    out.shards += c.crownShard || 0;
    out.crowns += c.crown || 0;
  }
  return out;
}

function weekPlan(kind, week, carriesAt85) {
  if (kind === 'free') {
    if (week <= 2) return [['normal', 0, 6, 1, true], ['normal', 0, 6, notchFor(0.55).pays, false]];
    if (week <= 4) return [['normal', 0, 12, 1, true]];
    if (week <= 9) return [['hard', 0, 12, 1, true]];
    if (carriesAt85 < 3) return [['nightmare', 0, 12, 1, true]];
    return [['mayhem', 0, 8, 1, true], ['mayhem', 0, 4, notchFor(0.8).pays, false]];
  }
  if (week <= 2) return [['hard', 0, 12, 1, true]];
  if (week <= 8) return [['nightmare', 0, 12, 1, true]];
  if (week <= 14) return [['mayhem', 0, 12, 1, true]];
  return [['mayhem', 2, 12, 1, true]];
}

function run(kind) {
  const free = kind === 'free';
  const girls = free
    ? [['shiro', 'feather'], ['kage', 'feather'], ['aoi', 'feather'], ['sango', 'ember'], ['akane', 'ember'], ['miko', 'charm'], ['midori', 'rune'], ['momo', 'cog']]
    : [['shiro', 'feather'], ['kage', 'feather'], ['aoi', 'feather'], ['sango', 'ember'], ['akane', 'ember'], ['miko', 'charm'], ['midori', 'rune'], ['momo', 'cog'], ['rei', 'blade']];
  const st = girls.map(([id, fam]) => ({ id, fam, gates: 5, level: 60 }));
  const bank = { coins: 0, shards: 0, crowns: 0 };
  const mat = {}; // `${fam}:${tier}` → count
  const add = (k, n) => { mat[k] = (mat[k] || 0) + n; };
  // income from week 1; the free carries can spend from week 9 (L60, gate 5, P6)
  const startWeek = 1;
  const spendFrom = free ? 9 : 1;
  const timeline = { l75: null, l85First: null, l85Four: null, l85Eight: null, l85All: null };
  const waits = { coins: 0, crowns: 0, items: 0 };
  let fragments = [];
  for (let week = startWeek; week <= startWeek + WEEKS; week++) {
    const at85 = st.filter((g) => g.level >= 85).length;
    // the titan: the family of the next girl in the order (carries first)
    const next = st.find((g) => g.level < 85);
    const target = next ? next.fam : 'feather';
    const other = { feather: 'ember', ember: 'feather', charm: 'rime', rime: 'charm', rune: 'charm', cog: 'blade', blade: 'cog' }[target];
    let tokens = 0;
    let frag = 0;
    for (const [tier, rank, n, share, victory] of weekPlan(kind, week, at85)) {
      const ev = fightEV(tier, rank, share, victory);
      bank.coins += ev.coins * n;
      frag += ev.fragments * n;
      tokens += ev.tokens * n;
      for (const [r, x] of Object.entries(ev.target)) add(`${target}:${r}`, x * n);
      for (const [r, x] of Object.entries(ev.other)) add(`${other}:${r}`, x * n);
      add(`${target}:zenith`, ev.zenith * n);
      bank.shards += ev.shards * n;
      bank.crowns += ev.crowns * n;
    }
    // first clears (§C.9): once per titan per tier, when the tier opens (free: the fed titan only)
    if (free && week === 10) { bank.shards += 3; add(`${target}:zenith`, 2); }
    if (free && at85 >= 3 && !run.mayhemFc) { run.mayhemFc = true; bank.crowns += 1; add(`${target}:zenith`, 2); }
    // the Titan shelf with the titans' tokens: crown shard 40, Zenith 60, legendary ×4 25
    for (const [cost, fn] of [[40, () => { bank.shards += 1; }], [60, () => add(`${target}:zenith`, 1)], ...Array(4).fill([25, () => add(`${target}:legendary`, 1)])]) {
      if (tokens >= cost) { tokens -= cost; fn(); }
    }
    // Craft Room: Zenith from spare legendary (3 a week at most) only when the next gate is short of it
    const zNeed = next && next.gates < 10 ? (breakthroughCost(next.id, next.gates + 1).find((c) => c.id.endsWith('_zenith'))?.count || 0) : 0;
    for (let i = 0; i < 3 && (mat[`${target}:zenith`] || 0) < zNeed && (mat[`${target}:legendary`] || 0) >= 3 + 6 && bank.coins >= 150000; i++) { add(`${target}:legendary`, -3); add(`${target}:zenith`, 1); bank.coins -= 150000; }
    while (bank.shards >= 10) { bank.shards -= 10; bank.crowns += 1; }
    bank.coins += free ? 395000 - 300000 : 395000 + 630000;
    fragments.push(frag + 24 + 10.45 + 20 + (free ? 20 : 80)); // + bridges, other sources, boss + Memento packs (§A.8)
    // spend: gates first for the lowest girl (P6 everywhere: the gate needs only items), then levels
    let progress = week >= spendFrom;
    let waited = null;
    while (progress) {
      progress = false;
      // carries first, in order (§E.1); a later girl only spends what the first one cannot use yet
      for (const g of st) {
        if (g.level >= 85) continue;
        if (g.level < GATE_CAPS[g.gates]) {
          if (bank.coins >= LEVEL_COINS) { bank.coins -= LEVEL_COINS; g.level += 1; progress = true; break; }
          waited ||= 'coins';
          continue;
        }
        const cost = breakthroughCost(g.id, g.gates + 1);
        const fam = g.fam;
        const need = cost.map((c) => {
          if (c.id === 'coins') return ['coins', c.count, bank.coins];
          if (c.id === 'crown_rainbow') return ['crowns', c.count, Math.floor(bank.crowns)];
          const tier = c.id.split('_')[2];
          return [`${fam}:${tier}`, c.count, mat[`${fam}:${tier}`] || 0];
        });
        const short = need.find(([, n, have]) => have < n);
        if (short) { waited ||= short[0] === 'coins' ? 'coins' : short[0] === 'crowns' ? 'crowns' : 'items'; continue; }
        for (const [k, n] of need) {
          if (k === 'coins') bank.coins -= n;
          else if (k === 'crowns') bank.crowns -= n;
          else mat[k] -= n;
        }
        g.gates += 1;
        progress = true;
        break;
      }
    }
    if (waited) waits[waited] += 1;
    const top4 = [...st].sort((a, b) => b.level - a.level).slice(0, 4);
    const l85 = st.filter((g) => g.level >= 85).length;
    if (!timeline.l75 && top4.every((g) => g.level >= 75)) timeline.l75 = week;
    if (!timeline.l85First && l85 >= 1) timeline.l85First = week;
    if (!timeline.l85Four && l85 >= 4) timeline.l85Four = week;
    if (!timeline.l85Eight && l85 >= 8) timeline.l85Eight = week;
    if (!timeline.l85All && l85 >= st.length) timeline.l85All = week;
  }
  return { kind, girls: st.length, timeline, waits, fragments: fragments.slice(0, 26).map((x) => Math.round(x)) };
}

/** E5: the Rainbow Meter. Nobody passes 40 Mayhem chests without a Rainbow Gear Box. */
function meterMC(players = 200000, rank = 0) {
  const p = victoryChest('mayhem', rank).box.find(([k]) => k === 'rainbow')[1];
  const rng = createRng(12345);
  let sum = 0;
  let worst = 0;
  for (let i = 0; i < players; i++) {
    let n = 1;
    while (n < RAINBOW_METER && !(rng.next() < p)) n++;
    sum += n;
    worst = Math.max(worst, n);
  }
  return { p, mean: Math.round((sum / players) * 10) / 10, closedForm: Math.round(((1 - (1 - p) ** RAINBOW_METER) / p) * 10) / 10, worst };
}

const free = run('free');
const spender = run('spender');
console.log(JSON.stringify({ free, spender, meter: [meterMC(200000, 0), meterMC(200000, 2)] }, null, 1));
