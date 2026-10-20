// Titan Trials rewards and state (docs/specs/ASCENSION.md §C.4–§C.9, §B.6, §C.10): notches, the
// damage table, the Victory Chest, first clears, keys, sweeps, the Rainbow Meter, the Titan of the
// Week, the Craft Room and the weekly stores.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { addItems, itemCount } from '../../src/systems/inventory.js';
import { createRng } from '../../src/core/rng.js';
import { gameWeekNumber } from '../../src/core/reset.js';
import {
  applyTitanResult, sweepTitan, refreshKeys, keyState, tierOpen, tierLock, titanOfWeek, setTargetFamily, targetFamily, bestStep, WEEKLY_KEYS,
} from '../../src/systems/titans.js';
import { rollTitanRewards, notchFor, victoryChest, damageTable, firstClearTable, RAINBOW_METER, METER_KEY, chestOdds } from '../../src/systems/titanRewards.js';
import { craft, craftPreview, COMBINE_FEE, WEEKLY_CAP } from '../../src/systems/craft.js';
import { shopTabs, buyOffer, refreshShop, ASC_SHOP_MARK } from '../../src/systems/shop.js';
import { SHOP_OFFERS } from '../../src/data/shop.js';
import { grantUnit } from '../../src/systems/unlocks.js';

const T0 = Date.UTC(2026, 9, 21, 12); // a Wednesday
const DAY = 86400000;

/** A save with every campaign gate to Titan Trials cleared. */
function ready() {
  const p = createProfile();
  for (const id of ['3-5', '6-5', '8-5']) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  p.currencies.coins = 1e8;
  return p;
}
const win = { share: 1, victory: true, damage: 1, pool: 1, leaked: false };
const at = (share) => ({ share, victory: false, damage: share, pool: 1, leaked: false });
const fight = (p, titanId, tier, read, o = {}) => applyTitanResult(p, { titanId, tier, rank: o.rank || 0, seed: o.seed ?? 7, read, kills: { [titanId]: 1 }, encountered: ['fp_eclipse_wyrm'], ...o }, { now: o.now ?? T0 });

describe('notches (§C.5)', () => {
  it('25 / 50 / 75 % pay 35 / 60 / 85 % of the table; a Victory pays all of it and the chest', () => {
    expect(notchFor(0.24)).toBeNull();
    expect(notchFor(0.25).pays).toBe(0.35);
    expect(notchFor(0.6).pays).toBe(0.6);
    expect(notchFor(0.9).pays).toBe(0.85);
    expect(notchFor(0.99, true)).toMatchObject({ id: 'victory', pays: 1 });
  });
});

describe('drop tables (§C.6)', () => {
  it('Normal pays no mythic or legendary; Hard pays 1 mythic a Victory and legendary at 25 %', () => {
    const n = damageTable('normal');
    expect([...n.target, ...n.other].some(([r]) => r === 'mythic' || r === 'legendary')).toBe(false);
    expect(victoryChest('normal').target.some(([r]) => r === 'legendary' || r === 'mythic')).toBe(false);
    expect(damageTable('hard').target).toContainEqual(['mythic', 1]);
    expect(victoryChest('hard').target).toEqual([['legendary', 0.25]]);
  });

  it('box odds: Rainbow 0.5 % Nightmare, 4 % Mayhem (+0.25 % a rank, cap 6 %); legendary 25 / 45 %', () => {
    expect(chestOdds('nightmare')).toMatchObject({ rainbow: 0.005, celestial: 0.25, radiant: 0.595 });
    expect(chestOdds('mayhem')).toMatchObject({ rainbow: 0.04, celestial: 0.45, crown: 0.01, kindredShard: 0.04 });
    expect(chestOdds('mayhem', 4).rainbow).toBeCloseTo(0.05);
    expect(chestOdds('mayhem', 30).rainbow).toBe(0.06);
    expect(chestOdds('mayhem', 30).crown).toBe(0.03);
    // every box table sums to 1
    for (const tier of ['normal', 'hard', 'nightmare', 'mayhem']) expect(victoryChest(tier, 3).box.reduce((a, [, x]) => a + x, 0)).toBeCloseTo(1);
  });

  it('the same attempt rolls the same drops; the target family gets the target lines', () => {
    const roll = (seed) => rollTitanRewards(createRng(seed), { titanId: 'wyrm', tier: 'mayhem', rank: 1, target: 'feather', share: 1, victory: true, meter: 3 });
    expect(roll(42)).toEqual(roll(42));
    const r = roll(42);
    expect(r.items.some((i) => i.id === 'mat_feather_legendary')).toBe(true);
    expect(r.items.some((i) => i.id === 'mat_feather_mythic')).toBe(true);
    expect(r.items.find((i) => i.id === 'token_boss').count).toBe(27);
  });

  it('Titan of the Week pays ×1.5 Assault Tokens', () => {
    const base = rollTitanRewards(createRng(1), { titanId: 'wyrm', tier: 'nightmare', target: 'feather', share: 1, victory: false });
    const totw = rollTitanRewards(createRng(1), { titanId: 'wyrm', tier: 'nightmare', target: 'feather', share: 1, victory: false, totw: true });
    expect(totw.items.find((i) => i.id === 'token_boss').count).toBe(base.items.find((i) => i.id === 'token_boss').count * 1.5);
  });

  it('the Rainbow Meter guarantees a Rainbow Gear Box by the 40th Mayhem chest and resets on one', () => {
    for (let seed = 0; seed < 50; seed++) {
      let meter = 0;
      let got = false;
      for (let i = 1; i <= RAINBOW_METER; i++) {
        const r = rollTitanRewards(createRng(seed * 1000 + i), { titanId: 'wyrm', tier: 'mayhem', target: 'feather', share: 1, victory: true, meter });
        meter = r.meterAfter;
        if (r.box === 'rainbow') {
          got = true;
          expect(meter).toBe(0);
          break;
        }
      }
      expect(got).toBe(true);
    }
    // Nightmare chests never move the meter
    const nm = rollTitanRewards(createRng(5), { titanId: 'wyrm', tier: 'nightmare', target: 'feather', share: 1, victory: true, meter: 12 });
    expect(nm.meterAfter === null || nm.meterAfter === 0).toBe(true);
  });

  it('first clears never pay a Rainbow Gear Box or SSR Kindred; Mayhem pays a whole Rainbow Crown', () => {
    for (const tier of ['normal', 'hard', 'nightmare', 'mayhem']) {
      const ids = firstClearTable(tier).items.map(([id]) => id);
      expect(ids).not.toContain('gearbox:rainbow');
      expect(ids).not.toContain('kindred_shard_ssr');
    }
    expect(firstClearTable('mayhem').items).toContainEqual(['crown_rainbow', 1]);
    const gems = ['normal', 'hard', 'nightmare', 'mayhem'].reduce((a, t) => a + firstClearTable(t).gems, 0) * 4;
    expect(gems).toBe(3600);
  });
});

describe('tiers, keys and results', () => {
  it('Normal opens after 3-5; Hard after 6-5 and a Normal Victory; Mayhem +n after +(n − 1)', () => {
    const p = createProfile();
    expect(tierOpen(p, 'wyrm', 'normal')).toBe(false);
    p.progress.stages['3-5'] = { normal: true, clears: 1 };
    expect(tierOpen(p, 'wyrm', 'normal')).toBe(true);
    expect(tierLock(p, 'wyrm', 'hard')).toBe('Clear 6-5 first');
    p.progress.stages['6-5'] = { normal: true, clears: 1 };
    expect(tierLock(p, 'wyrm', 'hard')).toBe('Win Normal first');
    fight(p, 'wyrm', 'normal', win);
    expect(tierOpen(p, 'wyrm', 'hard')).toBe(true);
    expect(tierOpen(p, 'regent', 'hard')).toBe(false); // per titan
    p.missions.counters['tbest:wyrm'] = 4; // Mayhem won
    expect(tierOpen(p, 'wyrm', 'mayhem', 1)).toBe(true);
    expect(tierOpen(p, 'wyrm', 'mayhem', 2)).toBe(false);
  });

  it('12 keys a week; up to 6 unused carry over (18 at most)', () => {
    const p = ready();
    expect(refreshKeys(p, T0)).toBe(WEEKLY_KEYS);
    p.missions.counters['tk:left'] = 10;
    expect(refreshKeys(p, T0 + 7 * DAY)).toBe(18);
    p.missions.counters['tk:left'] = 2;
    expect(refreshKeys(p, T0 + 14 * DAY)).toBe(14);
    expect(refreshKeys(p, T0 + 14 * DAY)).toBe(14); // idempotent
    expect(keyState(p, T0 + 14 * DAY).saved).toBe(2);
  });

  it('a key is used only at Bronze or better; under 25 % pays nothing and keeps it', () => {
    const p = ready();
    const keys = refreshKeys(p, T0);
    const r = fight(p, 'wyrm', 'normal', at(0.2));
    expect(r).toMatchObject({ counted: false, notch: null, rewards: [] });
    expect(refreshKeys(p, T0)).toBe(keys);
    const b = fight(p, 'wyrm', 'normal', at(0.3));
    expect(b.notch.id).toBe('bronze');
    expect(b.counted).toBe(true);
    expect(refreshKeys(p, T0)).toBe(keys - 1);
    expect(b.chest).toBeNull();
    expect(bestStep(p, 'wyrm')).toBe(-1);
  });

  it('a Victory pays the chest, the first clear once, a new best and the mission events', () => {
    const p = ready();
    const r = fight(p, 'wyrm', 'normal', win);
    expect(r.notch.id).toBe('victory');
    expect(r.firstClear.items).toContainEqual({ id: 'gems', count: 100 });
    expect(itemCount(p, 'kindred_r')).toBe(2);
    expect(r.newBest).toBe(true);
    expect(p.missions.counters['tkill:wyrm']).toBe(1);
    expect(p.bestiary.fp_eclipse_wyrm.kills).toBe(0); // titan kills never count toward the bestiary's (Starlight Vigil)
    expect(p.bestiary.fp_eclipse_wyrm.seen).toBe(true);
    expect(p.missions.weekly.w_boss3).toBe(1); // Crown Hunter
    expect(p.missions.daily.d_win3).toBe(1); // Patrol Duty
    const again = fight(p, 'wyrm', 'normal', win);
    expect(again.firstClear).toBeNull();
    // Hard+ Victories count for Elite Training
    fight(p, 'wyrm', 'hard', win);
    expect(p.missions.daily.d_hard).toBe(1);
  });

  it('a co-op Victory pays no first clear and never raises the best (sweep) tier', () => {
    const p = ready();
    const r = fight(p, 'wyrm', 'normal', win, { coop: true });
    expect(r.firstClear).toBeNull();
    expect(bestStep(p, 'wyrm')).toBe(-1);
  });

  it('practice (no key, a closed tier) pays nothing and changes nothing', () => {
    const p = ready();
    p.missions.counters['tk:week'] = gameWeekNumber(T0);
    p.missions.counters['tk:left'] = 0;
    const r = fight(p, 'wyrm', 'normal', win);
    expect(r).toMatchObject({ practice: true, counted: false, rewards: [] });
    expect(bestStep(p, 'wyrm')).toBe(-1);
  });

  it('sweep pays a Victory at the best solo tier for one key, never a first clear', () => {
    const p = ready();
    expect(sweepTitan(p, 'wyrm', { now: T0 }).ok).toBe(false);
    fight(p, 'wyrm', 'normal', win);
    const keys = refreshKeys(p, T0);
    const gems = p.currencies.gems;
    const s = sweepTitan(p, 'wyrm', { now: T0, seed: 3 });
    expect(s).toMatchObject({ ok: true, tier: 'normal', keysLeft: keys - 1 });
    expect(p.currencies.gems).toBe(gems);
    expect(p.missions.daily.d_hard).toBe(1); // Elite Training counts sweeps
  });

  it('the Rainbow Gear Box from a chest goes to the Backpack (never opened as a plain box)', () => {
    const p = ready();
    p.missions.counters['tbest:wyrm'] = 3;
    p.missions.counters[METER_KEY] = RAINBOW_METER - 1;
    const r = fight(p, 'wyrm', 'mayhem', win);
    expect(r.box).toBe('rainbow');
    expect(r.rainbowForced).toBe(true);
    expect(itemCount(p, 'gearbox_rainbow')).toBe(1);
    expect(p.missions.counters[METER_KEY]).toBe(0);
  });

  it('the target family is tappable per titan; the Titan of the Week rotates by game week', () => {
    const p = ready();
    expect(setTargetFamily(p, 'wyrm', 'ember')).toBe(true);
    expect(targetFamily(p, 'wyrm')).toBe('ember');
    expect(setTargetFamily(p, 'wyrm', 'rune')).toBe(false);
    const weeks = [0, 1, 2, 3, 4].map((w) => titanOfWeek(T0 + w * 7 * DAY));
    expect(new Set(weeks.slice(0, 4)).size).toBe(4);
    expect(weeks[4]).toBe(weeks[0]);
  });
});

describe('Craft Room (§B.6)', () => {
  it('combines 3 → 1 of the next tier for coins, up to Zenith; swaps 2 → 1 into another family', () => {
    const p = ready();
    addItems(p, [{ id: 'mat_feather_legendary', count: 9 }, { id: 'mat_rune_mythic', count: 4 }]);
    const pv = craftPreview(p, 'combine', 'mat_feather_legendary', 2, null, T0);
    expect(pv).toMatchObject({ ok: true, out: { id: 'mat_feather_zenith', count: 2 }, coins: 2 * COMBINE_FEE.zenith });
    expect(craft(p, 'combine', 'mat_feather_legendary', 2, null, T0).ok).toBe(true);
    expect(itemCount(p, 'mat_feather_zenith')).toBe(2);
    expect(itemCount(p, 'mat_feather_legendary')).toBe(3);
    // Zenith is capped at 3 a week
    expect(craftPreview(p, 'combine', 'mat_feather_legendary', 1, null, T0).ok).toBe(true);
    addItems(p, [{ id: 'mat_feather_legendary', count: 6 }]);
    expect(craftPreview(p, 'combine', 'mat_feather_legendary', 2, null, T0)).toMatchObject({ ok: false, reason: 'weekly' });
    expect(craftPreview(p, 'combine', 'mat_feather_legendary', 2, null, T0 + 7 * DAY).ok).toBe(true);
    expect(craft(p, 'swap', 'mat_rune_mythic', 2, 'charm', T0)).toMatchObject({ ok: true, out: { id: 'mat_charm_mythic', count: 2 } });
    expect(craftPreview(p, 'combine', 'mat_feather_zenith', 1, null, T0).reason).toBe('top');
    expect(WEEKLY_CAP.combine.zenith).toBe(3);
  });

  it('a clock set back a week never clears the weekly caps (W → W-1 → W; ASC-1)', () => {
    const p = ready();
    addItems(p, [{ id: 'mat_feather_legendary', count: 60 }]);
    expect(craft(p, 'combine', 'mat_feather_legendary', 3, null, T0).ok).toBe(true);
    expect(craftPreview(p, 'combine', 'mat_feather_legendary', 1, null, T0)).toMatchObject({ ok: false, reason: 'weekly' });
    for (const t of [T0 - 7 * DAY, T0, T0 - 7 * DAY, T0]) {
      expect(craftPreview(p, 'combine', 'mat_feather_legendary', 1, null, t), new Date(t).toISOString()).toMatchObject({ ok: false, reason: 'weekly' });
      expect(craft(p, 'combine', 'mat_feather_legendary', 1, null, t).ok).toBe(false);
    }
    expect(itemCount(p, 'mat_feather_zenith')).toBe(3);
    expect(p.missions.counters['craft:wk']).toBe(gameWeekNumber(T0));
    // the real next week still opens the caps
    expect(craft(p, 'combine', 'mat_feather_legendary', 3, null, T0 + 7 * DAY).ok).toBe(true);
    expect(itemCount(p, 'mat_feather_zenith')).toBe(6);
  });

  it('never beats the Mall: 3 commons + the fee cost what the Mall asks for one rare', () => {
    expect(3 * 1000 + COMBINE_FEE.rare).toBe(8000);
    const mallRare = SHOP_OFFERS.find((o) => o.id === 'gen_mat_feather_rare');
    expect(mallRare.price).toBe(8000);
  });
});

describe('weekly stores (§A.5, §C.10)', () => {
  it('the Memento Exchange has two wallets; Mementos and Moonpearls are never sold for gems', () => {
    const p = ready();
    const tab = shopTabs(p, new Date(T0)).find((t) => t.id === 'memento');
    expect(tab.wallets.map((w) => w.currency)).toEqual(['memento', 'moonpearl']);
    const gemRows = SHOP_OFFERS.filter((o) => (o.currency || 'gems') === 'gems' && o.tab === 'gems');
    for (const o of gemRows) expect(['memento', 'moonpearl', 'crown_rainbow', 'crown_rainbow_shard', 'gearbox_rainbow', 'token_boss']).not.toContain(o.item);
    expect(gemRows.some((o) => o.item?.endsWith('_legendary'))).toBe(false);
  });

  it('choose-family rows share one weekly stock', () => {
    const p = ready();
    addItems(p, [{ id: 'token_boss', count: 1000 }]);
    expect(buyOffer(p, 'ts_zenith_feather', 1, new Date(T0)).ok).toBe(true);
    expect(buyOffer(p, 'ts_zenith_ember', 1, new Date(T0))).toMatchObject({ ok: false, error: 'soldOut' });
    expect(itemCount(p, 'mat_feather_zenith')).toBe(1);
  });

  it('a row with no girl to use it is hidden (Kindred R once every R girl is P6)', () => {
    const p = ready();
    const has = () => shopTabs(p, new Date(T0)).find((t) => t.id === 'memento').offers.some((o) => o.id === 'mem_kindred_r');
    expect(has()).toBe(true);
    for (const st of Object.values(p.units)) st.pl = 6;
    expect(has()).toBe(false);
  });

  it('the SSR shard row opens with a Nightmare clear and is on sale every other game week', () => {
    const p = ready();
    const row = (t) => shopTabs(p, new Date(t)).find((x) => x.id === 'boss').offers.find((o) => o.id === 'ts_kindred_shard');
    expect(row(T0)).toBeUndefined();
    p.missions.counters['tbest:regent'] = 3;
    const a = row(T0);
    const b = row(T0 + 7 * DAY);
    expect([a.away, b.away].sort()).toEqual([false, true]);
  });

  it('the SSR Kindred Shard rows hide once no owned girl can use Kindred SSR (all P6; ASC-3)', () => {
    const p = ready();
    p.missions.counters['tbest:regent'] = 3; // a Nightmare clear
    p.currencies.gems = 1e5;
    const w0 = [T0, T0 + 7 * DAY].find((t) => gameWeekNumber(t) % 2 === 0); // the shard rows' on-week
    const shown = () => shopTabs(p, new Date(w0)).flatMap((t) => t.offers).filter((o) => o.item === 'kindred_shard_ssr').map((o) => o.id).sort();
    expect(shown()).toEqual(['gts_kindred_shard', 'ts_kindred_shard']);
    for (const st of Object.values(p.units)) st.pl = 6;
    expect(shown()).toEqual([]);
    const gems = p.currencies.gems;
    expect(buyOffer(p, 'gts_kindred_shard', 1, new Date(w0))).toMatchObject({ ok: false, error: 'hidden' });
    expect(p.currencies.gems).toBe(gems);
    // the Crown Shard row (the other fusing shard) is not a Kindred row: it still shows
    expect(shopTabs(p, new Date(w0)).flatMap((t) => t.offers).some((o) => o.id === 'ts_crown_shard')).toBe(true);
    // a new girl below P6 brings both rows back
    grantUnit(p, 'kaede');
    expect(shown()).toEqual(['gts_kindred_shard', 'ts_kindred_shard']);
  });

  it('Chosen SSR Essence: one Essence of the SSR you pick, refused at her hold cap', () => {
    const p = ready();
    grantUnit(p, 'kaede');
    addItems(p, [{ id: 'moonpearl', count: 500 }]);
    expect(buyOffer(p, 'mp_chosen_ssr', 1, new Date(T0), { unitId: 'aoi' })).toMatchObject({ ok: false, error: 'pick' });
    const r = buyOffer(p, 'mp_chosen_ssr', 1, new Date(T0), { unitId: 'kaede' });
    expect(r).toMatchObject({ ok: true, essence: { unitId: 'kaede', held: 1, cap: 5 } });
    expect(itemCount(p, 'moonpearl')).toBe(380);
  });

  it('an older tab that rolls the local week first never leaves the new rows sold out (shopwk:asc)', () => {
    const p = ready();
    addItems(p, [{ id: 'token_boss', count: 1000 }]);
    buyOffer(p, 'ts_crown_shard', 1, new Date(T0));
    // a stale tab: rolls shop.week (it does not know ts_crown_shard), keeps its count
    p.shop.week = 'stale-week';
    const next = new Date(T0 + 7 * DAY);
    refreshShop(p, next);
    expect(p.missions.counters[ASC_SHOP_MARK]).toBe(gameWeekNumber(+next));
    expect(buyOffer(p, 'ts_crown_shard', 1, next).ok).toBe(true);
  });

  it('a clock set back a week never restocks the game-week rows (W → W-1 → W; ASC-1)', () => {
    const p = ready();
    p.missions.counters['tbest:regent'] = 3; // a Nightmare clear: the SSR shard row shows
    addItems(p, [{ id: 'token_boss', count: 1e5 }, { id: 'moonpearl', count: 1e5 }]);
    p.currencies.gems = 1e6;
    // gts_kindred_shard is on sale every other game week: start on a week it is
    const w0 = [T0, T0 + 7 * DAY].find((t) => gameWeekNumber(t) % 2 === 0);
    const rows = ['ts_crown_shard', 'mp_ticket10', 'gts_kindred_shard'];
    for (const id of rows) expect(buyOffer(p, id, 1, new Date(w0)).ok, id).toBe(true);
    for (const t of [w0 - 7 * DAY, w0, w0 - 7 * DAY, w0, w0 - 14 * DAY, w0]) {
      for (const id of rows) expect(buyOffer(p, id, 1, new Date(t)).ok, `${id} ${new Date(t).toISOString()}`).toBe(false);
    }
    expect(itemCount(p, 'crown_rainbow_shard')).toBe(1);
    expect(p.missions.counters[ASC_SHOP_MARK]).toBe(gameWeekNumber(w0));
    // the real next week restocks
    expect(buyOffer(p, 'ts_crown_shard', 1, new Date(w0 + 7 * DAY)).ok).toBe(true);
  });

  it('crown shards bought in the shelves fuse at 10', () => {
    const p = ready();
    addItems(p, [{ id: 'crown_rainbow_shard', count: 9 }, { id: 'token_boss', count: 100 }]);
    const r = buyOffer(p, 'ts_crown_shard', 1, new Date(T0));
    expect(r.fused).toEqual([{ id: 'crown_rainbow', count: 1 }]);
    expect(itemCount(p, 'crown_rainbow')).toBe(1);
  });
});

describe('co-op titans (M2 rules, §C.11)', () => {
  it('a co-op Victory pays the Together Chest, at most 3 a week', async () => {
    const p = ready();
    p.missions.counters['tbest:wyrm'] = 2; // Hard won solo
    const got = [];
    for (let i = 0; i < 4; i++) got.push(fight(p, 'wyrm', 'hard', win, { coop: true, seed: i }).together);
    expect(got.slice(0, 3).every((t) => t && t.some((x) => x.id === 'token_boss' && x.count === 10))).toBe(true);
    expect(got[3]).toBeUndefined();
    expect(bestStep(p, 'wyrm')).toBe(1); // co-op never raises it
  });

  it('a guest may join at most one step above their own solo best; the host only what is open solo', async () => {
    const { coopTierAllowed } = await import('../../src/systems/titans.js');
    const p = ready();
    expect(coopTierAllowed(p, 'wyrm', 'normal')).toBe(true);
    expect(coopTierAllowed(p, 'wyrm', 'hard')).toBe(false);
    p.missions.counters['tbest:wyrm'] = 1; // Normal won
    expect(coopTierAllowed(p, 'wyrm', 'hard')).toBe(true);
    expect(coopTierAllowed(p, 'wyrm', 'nightmare')).toBe(false);
    expect(coopTierAllowed(p, 'wyrm', 'nightmare', 0, { host: true })).toBe(false);
  });

  it('a guest the co-op rule lets in is paid by it: one step above her best without that tier\'s stage clear (ASC-4)', async () => {
    const { coopTierAllowed } = await import('../../src/systems/titans.js');
    const p = createProfile();
    p.progress.stages['3-5'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 }; // not 6-5
    p.missions.counters['tbest:wyrm'] = 1; // Normal won solo
    expect(tierOpen(p, 'wyrm', 'hard')).toBe(false);
    expect(coopTierAllowed(p, 'wyrm', 'hard')).toBe(true);
    const r = fight(p, 'wyrm', 'hard', win, { coop: true });
    expect(r).toMatchObject({ practice: false, counted: true, firstClear: null });
    expect(r.rewards.length).toBeGreaterThan(0);
    expect(r.together?.length).toBeGreaterThan(0);
    expect(bestStep(p, 'wyrm')).toBe(0); // co-op never raises it
    // two steps above her best: the co-op rule refuses it, and so does the result
    expect(coopTierAllowed(p, 'wyrm', 'nightmare')).toBe(false);
    expect(fight(p, 'wyrm', 'nightmare', win, { coop: true })).toMatchObject({ practice: true, counted: false });
    // solo, the stage gate still holds
    expect(fight(p, 'wyrm', 'hard', win)).toMatchObject({ practice: true, counted: false });
  });

  it('the clan board pays by rank (#1 30 tokens, #2 20, #3 10, a Bronze 5)', async () => {
    const { boardReward, boardSubmission } = await import('../../src/online/titanBoardRules.js');
    expect(boardReward(1, true)).toEqual({ tokens: 30, title: 'Titan Ace' });
    expect(boardReward(3, false).tokens).toBe(10);
    expect(boardReward(7, true).tokens).toBe(5);
    expect(boardReward(null, false).tokens).toBe(0);
    expect(boardSubmission({ titanId: 'wyrm', tier: 'mayhem', rank: 2, damage: 1e8, seconds: 9 })).toBeNull();
    expect(boardSubmission({ titanId: 'wyrm', tier: 'mayhem', rank: 2, damage: 1e8, seconds: 90 })).toMatchObject({ titan: 'wyrm', step: 5 });
  });
});
