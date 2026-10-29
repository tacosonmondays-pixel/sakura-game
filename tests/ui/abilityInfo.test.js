// The ⚡ ability outside the battle bar (ABILITIES_SPEC §10): the girl page's Info chip and Details sheet
// (src/ui/girlView.js abilityInfoView), the one "runs today" rule (abilityRuns, src/data/abilities.js; it replaced M1's
// UI helper) pinned to the sim's own teaser rule for every girl, the ⚡ sticker on the Tree tab's path (treeModel /
// treeGrid), and the hero track's Lv 7 / Lv 17 skill lines.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { abilityInfoView } from '../../src/ui/girlView.js';
import { abilityRuns as abilityLive } from '../../src/data/abilities.js';
import * as girlView from '../../src/ui/girlView.js';
import { abilityStatus, abilityPathOf } from '../../src/sim/abilities.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { buildTreeModel } from '../../src/ui/treeModel.js';
import { treeGridView } from '../../src/ui/treeGrid.js';
import { trackDesc, trackSkillLine, skillAt, trackLevel } from '../../src/ui/battle/heroLevels.js';

const withAbility = UNITS.filter((u) => (u.kind === 'hero' ? !!u.hero?.skill : abilityPathOf(u) >= 0));
const entryOf = (u) => (u.kind === 'hero' ? u.hero.skill : u.paths[abilityPathOf(u)].ability);
/** A girl as the sim sees her before her ability exists (no t.abil): abilityStatus gives the teaser. */
const tower = (u, tier = 0, level = 1) => {
  const tiers = [0, 0, 0];
  if (u.kind !== 'hero') tiers[abilityPathOf(u)] = tier;
  return { uid: 1, def: u, unitId: u.id, tiers, isHero: u.kind === 'hero', level };
};
const nums = (s) => (s.match(/\d+(?:\.\d+)?/g) || []).length;

describe('abilityRuns: the girl page\'s "runs today" rule equals the sim\'s', () => {
  it('the M1 UI helper is gone: the page reads the data rule', () => {
    expect(girlView.abilityLive).toBeUndefined();
    for (const u of withAbility) expect(abilityInfoView(u).live, u.id).toBe(abilityLive(entryOf(u)));
  });

  it.each(withAbility.map((u) => [u.id, u]))('%s', (id, u) => {
    for (const [tier, level] of [[0, 1], [3, 7], [5, 17]]) {
      const st = abilityStatus(null, tower(u, tier, level));
      expect(st, id).toBeTruthy();
      expect(abilityLive(entryOf(u)), `${id} at ${tier}/${level}`).toBe(!st.later);
    }
  });

  it('the kinds that wait: Fuu and Kanna (A5), Iroha (A6); Kage, Suzu and Chika run since A4 — every girl has one since M3', () => {
    expect(withAbility.filter((u) => !abilityLive(entryOf(u))).map((u) => u.id).sort()).toEqual(['fuu', 'iroha', 'kanna']);
    expect(withAbility.length).toBe(UNITS.length);
  });
});

describe('abilityInfoView (the Info chip and its Details)', () => {
  it('Aoi: the chip, her numbers on Rapid Volley at tier 3, the recharge and the tier-5 upgrade', () => {
    const v = abilityInfoView(UNIT_MAP.aoi);
    expect(v.chip).toBe('⚡ Skyfall Volley · Rapid Volley T3');
    expect(v.desc).toBe('Rains arrows on up to 6 enemies within 5.4 tiles, picked by her target mode: 24 damage each and a 0.5s pin.');
    expect(v.cooldown).toBe('Recharges in 35s of wave time');
    expect(v.unlock).toBe('Unlocks at Rapid Volley tier 3');
    expect(v.up.at).toBe('Rapid Volley T5');
    expect(v.up.line).toMatch(/^⚡\+ Skyfall Volley grows to 12 arrows/);
    expect(v.live).toBe(true);
    expect(v.later).toBeNull();
  });

  it('Fuu: "Comes in a later update" (Kage\'s Shadow Doubles runs since A4); a hero: her Lv 7 skill', () => {
    expect(abilityInfoView(UNIT_MAP.fuu)).toMatchObject({ live: false, later: 'Comes in a later update' });
    expect(abilityInfoView(UNIT_MAP.kage)).toMatchObject({ live: true, later: null });
    const h = abilityInfoView(UNIT_MAP.hikari);
    expect(h).toMatchObject({ hero: true, where: 'LV 7', chip: '⚡ Morning Rally · LV 7', unlock: 'Unlocks at hero LV 7', live: true });
    expect(h.up.at).toBe('LV 17');
  });

  it('every girl with one: a one-line chip (≤ 60 characters, one number) and a description with nothing left to fill', () => {
    for (const u of withAbility) {
      const v = abilityInfoView(u);
      expect(v.chip.length, u.id).toBeLessThanOrEqual(60);
      expect(nums(v.chip), `${u.id}: ${v.chip}`).toBe(1);
      for (const f of v.forms) expect(f.desc, `${u.id} ${f.id}`).not.toMatch(/[{}]|NaN|undefined|Infinity/);
      expect(v.forms.length, u.id).toBe(u.id === 'ruri' ? 3 : 1);
    }
    // the returning girls (M3): a live one, one that waits
    expect(abilityInfoView(UNIT_MAP.hana)).toMatchObject({ chip: '⚡ Kaze\'s Swoop · Falconry T3', live: true, multi: false });
    expect(abilityInfoView(UNIT_MAP.fuu)).toMatchObject({ chip: '⚡ Backdraft Fan · Returning Gale T3', live: false, later: 'Comes in a later update' });
    expect(abilityInfoView(UNIT_MAP.seiran)).toMatchObject({ chip: '⚡ Storm Lance · LV 7', live: true, hero: true });
  });

  it('Ruri: one chip naming her three path abilities; the Details hold one section per familiar path, the two that wait marked', () => {
    const v = abilityInfoView(UNIT_MAP.ruri);
    expect(v.multi).toBe(true);
    expect(v.chip).toBe('⚡ Moon Pounce · Star Snatch · River Rush · T3');
    expect(v.live).toBe(true); // (her first: Moonhound's Moon Pounce runs; the chip carries no Later sticker)
    expect(v.forms.map((f) => [f.name, f.pathName, f.where, f.live, f.later])).toEqual([
      ['Moon Pounce', 'Moonhound', 'Moonhound T3', true, null],
      ['Star Snatch', 'Star Falcon', 'Star Falcon T3', false, 'Comes in a later update'],
      ['River Rush', 'Tide Otter', 'Tide Otter T3', false, 'Comes in a later update'],
    ]);
    expect(v.unlock).toBe('Unlocks at tier 3 of the path she raises: Moonhound → Moon Pounce, Star Falcon → Star Snatch, Tide Otter → River Rush');
    expect(v.forms[0].desc).toMatch(/^Kon leaps from his spot at the strongest enemy within 4\.4 tiles of him: 3 bites/);
    expect(v.forms[0].up.at).toBe('Moonhound T5');
  });

  it('the Details facts and the closing "In battle, tap…" sentence speak only of what runs today (M3 review)', () => {
    // one that runs: unlock, recharge, the upgrade; the sentence says "it"
    const aoi = abilityInfoView(UNIT_MAP.aoi);
    expect(aoi.facts.map((x) => x.k)).toEqual(['Unlock', 'Recharge', 'Rapid Volley T5']);
    expect(aoi.facts[0].t).toBe('Unlocks at Rapid Volley tier 3');
    expect(aoi.facts[1].t).toBe('Recharges in 35s of wave time');
    expect(aoi.facts[2].t).toMatch(/^Skyfall Volley grows to 12 arrows/);
    expect(aoi.howTo).toEqual({ hero: false, name: null });
    expect(abilityInfoView(UNIT_MAP.hikari).howTo).toEqual({ hero: true, name: null });
    expect(abilityInfoView(UNIT_MAP.hikari).facts.map((x) => x.k)).toEqual(['Unlock', 'Recharge', 'LV 17']);
    // ones that wait (Fuu, Iroha, Kage, Kanna as a hero): no sentence pointing at a button, only where it is planned
    for (const [id, planned] of [
      ['fuu', 'for Returning Gale tier 3'], ['iroha', 'for Mirror Hall tier 3'], ['kanna', 'for hero LV 7'],
    ]) {
      const v = abilityInfoView(UNIT_MAP[id]);
      expect(v.later, id).toBe('Comes in a later update');
      expect(v.howTo, id).toBeNull();
      expect(v.facts, id).toEqual([{ k: 'Planned', t: planned }]);
    }
    for (const u of withAbility) {
      const v = abilityInfoView(u);
      for (const f of v.forms) {
        if (f.live) continue;
        // no unlock, recharge or upgrade promise for a form that waits
        const words = f.facts.map((x) => `${x.k} ${x.t}`).join(' | ');
        expect(words, `${u.id} ${f.id}`).not.toMatch(/Unlock|Recharg|⚡\+|T5|LV 17/);
      }
      if (!v.forms.some((f) => f.live)) expect(v.howTo, u.id).toBeNull();
      else expect(v.howTo, u.id).toBeTruthy();
    }
    // Ruri: Moon Pounce runs, the other two wait — the sentence names Moon Pounce; each waiting form says where it is planned
    const r = abilityInfoView(UNIT_MAP.ruri);
    expect(r.howTo).toEqual({ hero: false, name: 'Moon Pounce' });
    expect(r.forms.map((f) => f.facts.map((x) => x.k))).toEqual([['Unlock', 'Recharge', 'Moonhound T5'], ['Planned'], ['Planned']]);
    expect(r.forms[1].facts[0].t).toBe('for Star Falcon tier 3');
    expect(r.forms[2].facts[0].t).toBe('for Tide Otter tier 3');
  });

  it('the Details sheet renders the facts and the sentence from the view (student.js openAbility)', () => {
    const src = readFileSync(new URL('../../src/ui/screens/student.js', import.meta.url), 'utf8');
    const body = src.slice(src.indexOf('function openAbility('), src.indexOf('function infoPanel('));
    expect(body).toMatch(/f\.facts\.map\(\(x\) => fact\(x\.k, x\.t\)\)/);
    expect(body).toMatch(/how \? h\('p\.gp-sub'/);
    expect(body).toMatch(/to fire \$\{how\.name \|\| 'it'\}/);
    // nothing in it prints an unlock or recharge fact of its own any more
    expect(body).not.toMatch(/fact\('Unlock'|fact\('Recharge'/);
  });
});

describe('the Tree tab ⚡ sticker', () => {
  it('on the ⚡ path only, naming the ability and its tier (no number shown)', () => {
    const m = buildTreeModel({ def: UNIT_MAP.aoi });
    expect(m.rows.map((r) => r.ability?.name ?? null)).toEqual([null, 'Skyfall Volley', null]);
    expect(m.rows[1].ability).toMatchObject({ unlockTier: 3, live: true });
    const v = treeGridView(m);
    // (a native tooltip: plain words, never the ⚡ emoji)
    expect(v.rows[1].ability.title).toBe('Ability Skyfall Volley: unlocks at tier 3');
    expect(v.rows[0].ability).toBeNull();
    const k = treeGridView(buildTreeModel({ def: UNIT_MAP.fuu }));
    // (one that waits never promises a tier: no "unlocks at tier 3" beside "later")
    expect(k.rows.find((r) => r.ability).ability.title).toBe('Ability Backdraft Fan: comes in a later update');
    expect(treeGridView(buildTreeModel({ def: UNIT_MAP.kage })).rows.find((r) => r.ability).ability.title).toBe('Ability Shadow Doubles: unlocks at tier 3');
  });
});

describe('the hero track\'s skill lines (UI only)', () => {
  const hikari = UNIT_MAP.hikari;
  it('Lv 7 unlocks it, Lv 17 ranks it up; other levels unchanged', () => {
    expect(skillAt(hikari, 7)).toMatchObject({ kind: 'unlock' });
    expect(skillAt(hikari, 17)).toMatchObject({ kind: 'rank' });
    expect(skillAt(hikari, 8)).toBeNull();
    expect(trackDesc(hikari, 7)).toMatch(/ … and unlocks ⚡ Morning Rally$/);
    expect(trackDesc(hikari, 7).startsWith(trackLevel(hikari, 7).desc.replace(/[.\s]+$/, ''))).toBe(true);
    expect(trackDesc(hikari, 17)).toMatch(/ … and ⚡ Morning Rally ranks up$/);
    expect(trackDesc(hikari, 8)).toBe(trackLevel(hikari, 8).desc);
    expect(trackSkillLine(hikari, 7)).toBe('Unlocks ⚡ Morning Rally: a rally that speeds up and protects the girls around her.');
    expect(trackSkillLine(hikari, 17)).toBe('⚡+ Morning Rally reaches 4 tiles with +30% speed for 8s and recharges in 30s.');
    expect(trackSkillLine(hikari, 9)).toBe('');
    // the returning heroes have theirs since M3 (Kanna's waits: it still says what it will be)
    expect(trackDesc(UNIT_MAP.seiran, 7)).toMatch(/ … and unlocks ⚡ Storm Lance$/);
    expect(trackSkillLine(UNIT_MAP.yoriko, 17)).toBe('⚡+ Puppet Hex hexes the 2 strongest enemies for 6s and recharges in 25s.');
    expect(trackDesc(UNIT_MAP.kanna, 8)).toBe(trackLevel(UNIT_MAP.kanna, 8)?.desc || '');
    // a skill that waits (Kanna's Heavy Beat, A5) never promises a button: Lv 7 says it comes later, Lv 17 says nothing
    expect(trackDesc(UNIT_MAP.kanna, 7)).toMatch(/ \(⚡ Heavy Beat comes in a later update\)$/);
    expect(trackSkillLine(UNIT_MAP.kanna, 7)).toBe('⚡ Heavy Beat comes in a later update.');
    expect(skillAt(UNIT_MAP.kanna, 17)).toBeNull();
    expect(trackDesc(UNIT_MAP.kanna, 17)).toBe(trackLevel(UNIT_MAP.kanna, 17)?.desc || '');
  });
});
