// The dead-trick rule (src/data/gearStats.js trickIdle; A3 M2 review look-1, owner default Q3: never promise what is
// not there): a 3-piece club trick that does nothing for her kit is never shown as on. Only Bell's First Bell needs
// something (a running ability that Skill Haste reaches: not a rally or a debuff); every other trick works on every
// kit, Tea's Second Cup included (no aura: the 2 girls nearest her). The rule must say exactly what the sim does.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { autoPlan } from '../../src/sim/headless.js';
import { abilityPathOf, waveStartCharge } from '../../src/sim/abilities.js';
import { xpToReach, gainHeroXp } from '../../src/sim/hero.js';
import { trickIdle, skillHasteCounts } from '../../src/data/gearStats.js';
import { CLUBS, CLUB_IDS } from '../../src/data/clubs.js';
import { UNITS } from '../../src/data/units.js';

const BELL = Object.freeze({ club: 'bell', clubN: 3 });

/** A real girl alone on 1-1 wearing `stats`, her ⚡ path bought to `tiers` (a hero levelled to `level`). */
function real(u, stats, { tiers = 3, level = 7 } = {}) {
  const hero = u.kind === 'hero';
  const sim = new Sim({ stageId: '1-1', loadout: hero ? [] : [{ unitId: u.id, stats }], hero: hero ? { unitId: u.id, stats } : null, seed: 1 });
  sim.cash = 1e9;
  const spot = autoPlan('1-1', [u.id]).find((a) => a.action === 'place');
  const t = sim.placeTower(u.id, spot.x, spot.y);
  if (hero) { if (level > 1) gainHeroXp(sim, t, xpToReach(u.hero, level), 'restore'); }
  else for (let i = 0; i < tiers; i++) sim.upgradeTower(t.uid, abilityPathOf(u));
  return { sim, t };
}

describe('First Bell: the menu\'s view (girl page, Club Armband picker)', () => {
  it('today: idle for the girls whose ability waits and for the rallies and debuffs; on for everyone else', () => {
    const by = { later: [], kind: [], on: [] };
    for (const u of UNITS) by[trickIdle('bell', u.id) || 'on'].push(u.id);
    // "Comes in a later update": the deploys that wait (Kage, Suzu, Chika), Iroha's mirror, Kanna's Heavy Beat
    expect(by.later.sort()).toEqual(['chika', 'iroha', 'kage', 'kanna', 'suzu']);
    // team rallies and debuffs (Skill Haste and First Bell skip them), the heroes' too (Hikari, Luna, Yoriko)
    expect(by.kind.sort()).toEqual(['chigusa', 'ena', 'hikari', 'hotaru', 'luna', 'miko', 'noa', 'ouka', 'umeko', 'wakaba', 'yoriko']);
    // a strike, burst, boost, econ, strips, sentries, the giant ball or Fuu's push; Nami's Frost Net and Seiran's Storm Lance
    for (const id of ['fuu', 'aoi', 'rei', 'yuki', 'momo', 'akane', 'sango', 'shiro', 'midori', 'raika', 'kaede', 'tenka', 'azami', 'kinu', 'yuzuha', 'marumi', 'hana', 'ruri', 'nami', 'seiran']) {
      expect(by.on, id).toContain(id);
    }
    expect(by.later.length + by.kind.length + by.on.length).toBe(UNITS.length);
  });

  it('a tower girl\'s First Bell works exactly when her Skill Haste is real (the one GEAR_FIT rule)', () => {
    for (const u of UNITS.filter((x) => x.kind !== 'hero')) expect(trickIdle('bell', u.id) === null, u.id).toBe(skillHasteCounts(u.id));
  });

  it('every other club\'s trick is never idle, for any girl, in the menu or in battle', () => {
    for (const club of CLUB_IDS.filter((c) => c !== 'bell')) {
      for (const u of UNITS) {
        expect(trickIdle(club, u.id), `${club} ${u.id}`).toBeNull();
        expect(trickIdle(club, u.id, null), `${club} ${u.id} battle`).toBeNull();
        expect(trickIdle(club, u.id, { kind: 'rally' }), `${club} ${u.id} rally`).toBeNull();
      }
    }
  });
});

describe('First Bell: the battle view says what the sim does', () => {
  it('every girl at her unlock (⚡ tier 3, Lv 7) with the 3-piece set: the wave-start charge is > 0 exactly when the rule says on', () => {
    for (const u of UNITS) {
      const { t } = real(u, BELL);
      const charge = waveStartCharge(null, t);
      const idle = trickIdle('bell', u.id, t.abil || null);
      expect(charge > 0, `${u.id}: charge ${charge}, idle ${idle}`).toBe(idle === null);
      // the menu agrees with the battle once she has it: a running ability or "comes later"
      expect(t.abil ? idle : 'later', u.id).toBe(trickIdle('bell', u.id));
    }
  });

  it('before her unlock: no charge and "locked" for a girl it will help; Kage stays "later", Miko "kind"', () => {
    const U = Object.fromEntries(UNITS.map((u) => [u.id, u]));
    const aoi = real(U.aoi, BELL, { tiers: 2 }).t;
    expect(aoi.abil).toBeUndefined();
    expect(waveStartCharge(null, aoi)).toBe(0);
    expect(trickIdle('bell', 'aoi', null)).toBe('locked');
    const nami = real(U.nami, BELL, { level: 1 }).t;
    expect(nami.abil).toBeUndefined();
    expect(trickIdle('bell', 'nami', null)).toBe('locked');
    expect(trickIdle('bell', 'kage', null)).toBe('later');
    expect(trickIdle('bell', 'miko', null)).toBe('kind');
    expect(trickIdle('bell', 'miko', real(U.miko, BELL).t.abil)).toBe('kind');
    expect(trickIdle('bell', 'aoi', real(U.aoi, BELL).t.abil)).toBeNull();
  });
});

describe('Second Cup tells the truth for a girl without an aura', () => {
  it('a Tea girl with no aura serves the 2 girls nearest her within 2 tiles (×1.02), and her card says so', () => {
    // Kage (Tea, no aura), then girls on tiles 1 tile, at most 2 tiles and over 2.5 tiles from her (girls stand on tile
    // centres): the first Kage tile on 1-1 where all three fit
    const board = () => {
      const sim = new Sim({ stageId: '1-1', loadout: [{ unitId: 'kage', stats: { club: 'tea', clubN: 3 } }, { unitId: 'aoi' }, { unitId: 'rei' }, { unitId: 'yuki' }], seed: 1 });
      sim.cash = 1e9;
      return sim;
    };
    const probe = board();
    const tiles = [];
    for (let y = 0.5; y < probe.map.height; y += 1) for (let x = 0.5; x < probe.map.width; x += 1) tiles.push({ x, y });
    /** The free tile nearest `from` whose distance is in (lo, hi], placed for `id`. */
    const put = (sim, id, from, lo, hi) => {
      const p = tiles.map((q) => ({ ...q, d: Math.hypot(q.x - from.x, q.y - from.y) }))
        .filter((q) => q.d > lo && q.d <= hi && sim.canPlace(id, q.x, q.y).ok).sort((a, b) => a.d - b.d)[0];
      return p ? sim.placeTower(id, p.x, p.y) : null;
    };
    let got = null;
    for (const home of tiles) {
      if (!probe.canPlace('kage', home.x, home.y).ok) continue;
      const sim = board();
      const k = sim.placeTower('kage', home.x, home.y);
      const near = put(sim, 'aoi', k, 0, 1);
      const mid = near && put(sim, 'rei', k, 1, 2);
      const far = mid && put(sim, 'yuki', k, 2.5, 99);
      if (far) { got = { k, near, mid, far }; break; }
    }
    expect(got).toBeTruthy();
    const { k, near, mid, far } = got;
    expect(k.stats.aura).toBeFalsy();
    // (placeTower rebuilds every girl's buffs at once)
    expect(near.buff.tea, 'nearest').toBe(1.02);
    expect(mid.buff.tea, 'second nearest').toBe(1.02);
    expect(far.buff.tea || 1, 'past 2 tiles').toBe(1);
    expect(CLUBS.tea.trick.text).toBe('Girls in her aura (no aura: the 2 nearest) attack 2% faster.');
    expect(CLUBS.tea.trick.text.length).toBeLessThanOrEqual(60); // VAULT_BRIEF §2.4: one card sentence, up to 60 letters
  });
});
