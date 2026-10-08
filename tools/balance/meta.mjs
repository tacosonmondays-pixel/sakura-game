// Out-of-battle economy audit for the balance probe: what levels, breakthroughs and awakening
// cost, what a free player earns per stage clear / per day, and where the expected levels the
// balance test assumes (EXPECTED_LEVEL) run into a wall. Pure data math (expected values of the
// drop tables, no RNG, no sim).

import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  totalExpToLevel, breakthroughCost, awakenCost, COINS_PER_EXP, MAX_LEVEL,
} from '../../src/systems/progression.js';
import { ITEMS } from '../../src/data/items.js';
import { STAGES, STAGE_MAP } from '../../src/data/stages.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { DAILY_MISSIONS, WEEKLY_MISSIONS, LOGIN_REWARDS, REDEEM_CODES } from '../../src/data/missions.js';
import { SHOP_OFFERS } from '../../src/data/shop.js';
import { createProfile } from '../../src/systems/save.js';
import { DIFFICULTY_COIN_MUL } from '../../src/systems/rewards.js';
import { DIFFICULTY_ORDER, ITEM_RARITY_ORDER } from '../../src/data/types.js';
import { EXPECTED_LEVEL, f2pSetup } from './f2p.mjs';

const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
const diffIndex = (d) => Math.max(0, DIFFICULTY_ORDER.indexOf(d));
const bookXp = (id) => (ITEMS[id]?.category === 'book' ? ITEMS[id].xp : 0);

/** Breakthrough gates needed to reach `level` (cap = 10 + 10 × gates). */
export const gatesFor = (level) => Math.max(0, Math.ceil((level - 10) / 10));

/** Adds `count` of item `id` to a bag {coins, exp, items:{}} (books also count as EXP). */
function add(bag, id, count) {
  if (!(count > 0)) return bag;
  if (id === 'coins') bag.coins += count;
  else if (id === 'gems') bag.gems += count;
  else {
    bag.items[id] = (bag.items[id] || 0) + count;
    if (bookXp(id)) bag.exp += bookXp(id) * count;
  }
  return bag;
}
const emptyBag = () => ({ coins: 0, gems: 0, exp: 0, items: {} });
const addBag = (a, b, mul = 1) => {
  a.coins += b.coins * mul;
  a.gems += b.gems * mul;
  a.exp += b.exp * mul;
  for (const [k, v] of Object.entries(b.items)) a.items[k] = (a.items[k] || 0) + v * mul;
  return a;
};
const bagOf = (list) => list.reduce((bag, r) => add(bag, r.id, r.count), emptyBag());

/** Expected drops of ONE clear of a stage at a difficulty (chance × mean count, coin multiplier). */
export function expectedDrops(stageId, difficulty) {
  const stage = STAGE_MAP[stageId];
  const bag = emptyBag();
  for (const d of stage?.drops || []) {
    if (d.difficulty && diffIndex(d.difficulty) > diffIndex(difficulty)) continue;
    let n = d.chance * (d.min + d.max) / 2;
    if (d.item === 'coins') n *= DIFFICULTY_COIN_MUL[difficulty] ?? 1;
    add(bag, d.item, n);
  }
  return bag;
}

/** Cost to take one unit from level a to level b (EXP, level coins, breakthrough gates in between). */
export function levelCost(unitId, from, to) {
  const exp = totalExpToLevel(to) - totalExpToLevel(from);
  const bag = { coins: Math.ceil(exp * COINS_PER_EXP), gems: 0, exp, items: {} };
  for (let g = gatesFor(from) + 1; g <= gatesFor(to); g++) {
    for (const c of breakthroughCost(unitId, g)) {
      if (c.id === 'coins') bag.coins += c.count;
      else bag.items[c.id] = (bag.items[c.id] || 0) + c.count;
    }
  }
  return bag;
}

/** Daily income of an active free player: all dailies + login calendar / 7 + weeklies / 7. */
export function dailyIncome() {
  const bag = emptyBag();
  for (const m of DAILY_MISSIONS) for (const r of m.rewards) add(bag, r.id, r.count);
  for (const d of LOGIN_REWARDS) for (const r of d.rewards) add(bag, r.id, r.count / 7);
  for (const m of WEEKLY_MISSIONS) for (const r of m.rewards) add(bag, r.id, r.count / 7);
  return bag;
}

/** What the General shop sells per day for coins (books and materials). */
export function shopPerDay() {
  return SHOP_OFFERS.filter((o) => o.tab === 'general' && o.resets === 'daily').map((o) => ({
    id: o.item, count: o.count * o.stock, coins: o.price * o.stock,
    coinsPerExp: bookXp(o.item) ? round(o.price / (o.count * bookXp(o.item)), 2) : null,
  }));
}

const fmtQty = (n) => (n >= 0.1 || n === 0 ? String(round(n, 1)) : n.toFixed(2));
const fmtMats = (items) => Object.entries(items).filter(([id]) => id.startsWith('mat_')).map(([id, n]) => `${fmtQty(n)} ${id.replace('mat_', '')}`).join(', ');

/**
 * Full audit.
 * @param {{ durations?: Object<string, number>, mailModule?: string }} o
 *   durations: stageId -> battle seconds at 1× (from probe runs), for "minutes per clear";
 *   mailModule: path to a src/systems/mail.js exporting BETA_GIFT (another worktree) — defaults to this tree's
 */
export async function metaAudit({ durations = {}, mailModule = null } = {}) {
  const out = {};

  // 1. Costs
  const levels = [1, 10, 20, 30, 40, 50, 60].filter((l) => l <= MAX_LEVEL);
  out.levelCosts = levels.slice(1).map((L, i) => {
    const seg = levelCost('aoi', levels[i], L);
    const cum = levelCost('aoi', 1, L);
    return {
      level: L, segExp: seg.exp, segCoins: seg.coins, segMats: fmtMats(seg.items), cumExp: cum.exp, cumCoins: cum.coins,
      cumRareBooks: Math.ceil(cum.exp / bookXp('book_rare')), gate: gatesFor(L),
    };
  });
  out.awaken = [1, 2, 3, 4, 5].map((s) => ({ star: s, cost: awakenCost('aoi', s) }));

  // 2. Start + gifts
  const p = createProfile();
  const start = add(bagOf(Object.entries(p.items).map(([id, count]) => ({ id, count }))), 'coins', p.currencies.coins);
  start.gems = p.currencies.gems;
  const reach = (exp) => {
    let L = 1;
    while (L < 10 && totalExpToLevel(L + 1) <= exp) L++; // books stop at the level-10 cap without a breakthrough
    return L;
  };
  out.start = { ...start, oneUnitReaches: reach(start.exp), threeUnitsReach: reach(start.exp / 3) };
  const codes = Object.entries(REDEEM_CODES).filter(([, c]) => !c.dev).reduce((bag, [, c]) => addBag(bag, bagOf(c.rewards)), emptyBag());
  out.codes = codes;
  let mailPath = mailModule;
  if (!mailPath) {
    const local = new URL('../../src/systems/mail.js', import.meta.url);
    if (existsSync(local)) mailPath = local.pathname;
  }
  out.betaGift = null;
  if (mailPath && existsSync(mailPath)) {
    try {
      const mod = await import(pathToFileURL(mailPath).href);
      if (mod.BETA_GIFT) out.betaGift = { source: mailPath, ...bagOf(mod.BETA_GIFT.rewards) };
    } catch (err) {
      out.betaGift = { source: mailPath, error: String(err.message || err) };
    }
  }

  // 3. Income per clear / per day
  out.daily = dailyIncome();
  out.shop = shopPerDay();
  const campaign = STAGES.filter((s) => s.kind === 'campaign');
  out.perClear = [...campaign, ...STAGES.filter((s) => s.kind === 'resource')].map((s) => {
    const row = { stageId: s.id, kind: s.kind, chapter: s.chapter ?? null, firstClear: bagOf(s.firstClear || []), minutes: durations[s.id] ? round(durations[s.id] / 60, 1) : null };
    for (const d of DIFFICULTY_ORDER) row[d] = expectedDrops(s.id, d);
    return row;
  });

  // 4. Walls: bring the F2P roster to the next chapter's expected level.
  const DIFFS_PER_STAGE = ['easy', 'normal']; // a typical first pass clears each stage on Easy + Normal
  out.walls = [];
  const d = { units: UNIT_MAP, stages: STAGE_MAP };
  let carried = addBag(emptyBag(), start); // resources not yet spent (start profile)
  let carriedNote = 'start profile';
  const unitLevel = {}; // current level per unit (new free recruits join at Lv 1)
  for (let c = 1; c <= 8; c++) {
    const firstStage = `${c}-1`;
    const setup = f2pSetup(d, firstStage);
    const squad = [...setup.towers, ...(setup.hero ? [setup.hero] : [])];
    const from = c === 1 ? 1 : EXPECTED_LEVEL[c - 1];
    const to = EXPECTED_LEVEL[c];
    const fresh = squad.filter((u) => !unitLevel[u]);
    const need = squad.reduce((bag, u) => addBag(bag, levelCost(u, unitLevel[u] || 1, to)), emptyBag());
    for (const u of squad) unitLevel[u] = Math.max(unitLevel[u] || 1, to);
    // income from the PREVIOUS chapter's 5 stages (first clear + one Easy and one Normal drop roll each)
    const earned = emptyBag();
    if (c > 1) {
      for (const s of campaign.filter((x) => x.chapter === c - 1)) {
        addBag(earned, bagOf(s.firstClear || []));
        for (const diff of DIFFS_PER_STAGE) addBag(earned, expectedDrops(s.id, diff));
      }
    }
    const pool = addBag(addBag(emptyBag(), carried), earned);
    const gapExp = Math.max(0, need.exp - pool.exp);
    const gapCoins = Math.max(0, need.coins - pool.coins);
    const daily = out.daily;
    const daysExp = gapExp / Math.max(1, daily.exp);
    // ...or farm the best Library Bounty tier unlocked by then (Normal drops)
    const tier = c >= 6 ? 3 : c >= 4 ? 2 : c >= 2 ? 1 : 0;
    const books = tier ? expectedDrops(`res-books-${tier}`, 'normal') : null;
    const clears = books ? gapExp / Math.max(1, books.exp) : null;
    const minPerClear = tier ? durations[`res-books-${tier}`] / 60 : null;
    const daysCoins = gapCoins / Math.max(1, daily.coins);
    // material gaps by item id
    const matGaps = Object.entries(need.items).map(([id, n]) => ({ id, need: n, have: round(pool.items[id] || 0, 1), gap: round(Math.max(0, n - (pool.items[id] || 0)), 1) }))
      .filter((m) => m.gap > 0);
    out.walls.push({
      chapter: c, levelFrom: from, levelTo: to, squad, fresh: c === 1 ? [] : fresh, gatesNeeded: gatesFor(to),
      need: { exp: need.exp, coins: need.coins, mats: need.items },
      available: { exp: round(pool.exp), coins: round(pool.coins), note: c === 1 ? carriedNote : `leftover + chapter ${c - 1} first clears + 1 Easy & 1 Normal drop roll per stage` },
      gapExp, gapCoins, daysOfDailiesForExp: round(daysExp, 1), daysOfDailiesForCoins: round(daysCoins, 1), matGaps,
      bounty: tier ? { stageId: `res-books-${tier}`, expPerClear: books.exp, clears: Math.ceil(clears), hoursAt1x: Number.isFinite(minPerClear) ? round((clears * minPerClear) / 60, 1) : null } : null,
    });
    // leftover carries over (never negative)
    carried = emptyBag();
    carried.exp = Math.max(0, pool.exp - need.exp);
    carried.coins = Math.max(0, pool.coins - need.coins);
    for (const [id, n] of Object.entries(pool.items)) carried.items[id] = Math.max(0, n - (need.items[id] || 0));
    carriedNote = 'leftover';
  }

  // 5. Where do the breakthrough materials come from?
  const fams = ['feather', 'blade', 'ember', 'rime', 'charm', 'rune', 'cog'];
  out.materialSources = fams.map((f) => {
    const row = { family: f };
    for (const r of ITEM_RARITY_ORDER.slice(0, 4)) {
      const id = `mat_${f}_${r}`;
      const src = [];
      for (const s of STAGES) {
        for (const dr of s.drops || []) if (dr.item === id) src.push(`${s.id}${dr.difficulty ? `(${dr.difficulty}+)` : ''}`);
      }
      row[r] = src;
    }
    return row;
  });
  return out;
}

/** Markdown section for the report. */
export function metaMarkdown(m) {
  const L = [];
  const n = (v) => (v == null ? '—' : Math.round(v).toLocaleString('en-US'));
  L.push('### Student levelling costs (per student)');
  L.push('');
  const lib = (t) => m.perClear.find((r) => r.stageId === `res-books-${t}`)?.normal.exp || null;
  L.push('Segment = from the previous row\'s level. "Days" = segment EXP ÷ the active-player daily book income below; "clears" = segment EXP ÷ one Normal clear of Library Bounty I / III.');
  L.push('');
  L.push('| Reach level | EXP (segment) | Coins (segment, incl. gate) | Gate materials | Days of dailies | Library I / III clears | Total EXP from Lv 1 | Total coins | = rare books (500 EXP) |');
  L.push('|---|---:|---:|---|---:|---|---:|---:|---:|');
  for (const r of m.levelCosts) {
    L.push(`| ${r.level} | ${n(r.segExp)} | ${n(r.segCoins)} | ${r.segMats || '—'} | ${(r.segExp / m.daily.exp).toFixed(1)} | ${lib(1) ? n(r.segExp / lib(1)) : '—'} / ${lib(3) ? n(r.segExp / lib(3)) : '—'} | ${n(r.cumExp)} | ${n(r.cumCoins)} | ${n(r.cumRareBooks)} |`);
  }
  L.push('');
  L.push(`Awakening: ${m.awaken.map((a) => `★${a.star} ${a.cost.map((c) => `${n(c.count)} ${c.id}`).join(' + ')}`).join(' · ')}.`);
  L.push('');
  L.push('### What a new player starts with');
  L.push('');
  L.push(`* Start profile: ${n(m.start.coins)} coins, ${n(m.start.gems)} gems, ${n(m.start.exp)} EXP of books (${Object.entries(m.start.items).map(([k, v]) => `${v} ${k}`).join(', ')}). `
    + `That takes ONE student to Lv ${m.start.oneUnitReaches} (Lv 10 needs ${n(m.levelCosts[0].cumExp)} EXP), or the three starters to Lv ${m.start.threeUnitsReach} each.`);
  L.push(`* Public codes (SAKURA2026, WELCOME, TACOTUESDAY): ${n(m.codes.coins)} coins, ${n(m.codes.gems)} gems, ${n(m.codes.exp)} EXP of books.`);
  if (m.betaGift?.error) L.push(`* Beta gift (${m.betaGift.source}): could not load (${m.betaGift.error}).`);
  else if (m.betaGift) L.push(`* Beta gift (${m.betaGift.source}): ${n(m.betaGift.coins)} coins, ${n(m.betaGift.gems)} gems, ${n(m.betaGift.exp)} EXP of books, materials: ${fmtMats(m.betaGift.items)}.`);
  else L.push('* Beta gift: not in this tree (pass --mail <path to src/systems/mail.js> to include it).');
  L.push('');
  L.push('### Income');
  L.push('');
  const dl = m.daily;
  L.push(`* Active free player per day (all dailies + login calendar/7 + weeklies/7): ${n(dl.coins)} coins, ${n(dl.gems)} gems, ${n(dl.exp)} EXP of books.`);
  L.push(`* General shop per day: ${m.shop.map((s) => `${s.count} ${s.id} for ${n(s.coins)} coins${s.coinsPerExp ? ` (${s.coinsPerExp} coins/EXP + 0.4 to apply)` : ''}`).join('; ')}.`);
  L.push('');
  L.push('Expected drops of ONE clear (chance × mean count; coins × difficulty multiplier) and first-clear bonus:');
  L.push('');
  L.push('Easy pays ×0.8 the Normal coins, Nightmare ×1.5; minutes are battle time at 1× speed from the probe (— = not simulated).');
  L.push('');
  L.push('| Stage | min/clear (1×) | First clear | Normal | Hard |');
  L.push('|---|---:|---|---|---|');
  const cell = (b) => `${n(b.coins)}c · ${n(b.exp)} EXP${fmtMats(b.items) ? ` · ${fmtMats(b.items)}` : ''}`;
  for (const r of m.perClear) {
    if (r.kind === 'campaign' && !/^\d-(1|5)$/.test(r.stageId) && r.chapter > 2) continue;
    if (r.kind === 'resource' && r.stageId.startsWith('res-gear')) continue;
    L.push(`| ${r.stageId} | ${r.minutes ?? '—'} | ${n(r.firstClear.coins)}c · ${n(r.firstClear.exp)} EXP${r.firstClear.gems ? ` · ${n(r.firstClear.gems)} gems` : ''} | ${cell(r.normal)} | ${cell(r.hard)} |`);
  }
  L.push('');
  L.push('### Walls: bringing the free roster to the level the balance test assumes (EXPECTED_LEVEL)');
  L.push('');
  L.push('Squad = every free tower + hero the balance test fields at the chapter\'s first stage. Available = leftovers + the previous chapter\'s first clears + one Easy and one Normal drop roll per stage. Days = gap ÷ the active-player daily income above. * = new free recruit, levelled from Lv 1.');
  L.push('');
  L.push('| Ch | Lv | Squad | Need EXP | Have EXP | Days of dailies (EXP) | …or Library Bounty clears (hours at 1×) | Need coins | Have coins | Days (coins) | Material gaps (have/need) |');
  L.push('|---|---|---|---:|---:|---:|---|---:|---:|---:|---|');
  for (const w of m.walls) {
    const b = w.bounty && w.gapExp > 0 ? `${n(w.bounty.clears)} × ${w.bounty.stageId} (${w.bounty.hoursAt1x ?? '?'} h)` : '—';
    L.push(`| ${w.chapter} | ${w.levelFrom}→${w.levelTo} | ${w.squad.length} (${w.squad.map((u) => (w.fresh.includes(u) ? `${u}*` : u)).join(', ')}) | ${n(w.need.exp)} | ${n(w.available.exp)} | ${w.daysOfDailiesForExp} | ${b} | ${n(w.need.coins)} | ${n(w.available.coins)} | ${w.daysOfDailiesForCoins} | ${w.matGaps.map((g) => `${g.id.replace('mat_', '')} ${g.have}/${g.need}`).join(', ') || '—'} |`);
  }
  L.push('');
  L.push('Breakthrough material sources (stage drops only; the General shop also sells 3 common/day for 3,000 and 1 rare/day for 8,000 coins per family; the Gem shop 2 super rare/week):');
  L.push('');
  L.push('| Family | Common | Rare | Super rare | Mythic |');
  L.push('|---|---|---|---|---|');
  const short = (list) => (list.length > 6 ? `${list.slice(0, 6).join(' ')} … (${list.length})` : list.join(' ') || '—');
  for (const r of m.materialSources) L.push(`| ${r.family} | ${short(r.common)} | ${short(r.rare)} | ${short(r.superRare)} | ${short(r.mythic)} |`);
  return L.join('\n');
}
