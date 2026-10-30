// Teams and gear loadouts (docs/specs/GEAR_UPDATE.md §7, milestone M1).
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile, serializeProfile, deserializeProfile } from '../../src/systems/save.js';
import { saveText } from '../../src/core/store.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { addGear, rollGear, equipGear, unequipGear, salvageGear } from '../../src/systems/gear.js';
import { createRng } from '../../src/core/rng.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { salvagePreview, salvageMany, salvageBlock } from '../../src/systems/salvage.js';
import {
  TEAM_COUNT, getTeams, getPresets, usePreset, selectTeam, planTeam, teamClashes, copyTeam, clearTeam, renameTeam,
  copyPreset, restoreLoadouts, presetsNaming, loadoutUseText, takeLines, syncTeams, teamName, ensureTeams, ensurePresets, lentPieces, lenderOf,
} from '../../src/systems/teams.js';
import { writeTeamMarks } from '../../src/systems/teamsSave.js';

const NOW = 1_800_000_000_000;
const clone = (x) => JSON.parse(JSON.stringify(x));
const reload = (p) => migrateProfile(JSON.parse(saveText(p, 1)));

function setup() {
  const p = createProfile();
  for (const id of ['kage', 'yuki', 'momo', 'luna']) grantUnit(p, id, NOW);
  const piece = (slot, seed) => addGear(p, rollGear(createRng(seed), { slot, rarity: 'epic', level: 3 }));
  const g = { c1: piece('charm', 1), c2: piece('charm', 2), r1: piece('ribbon', 3), s1: piece('shoes', 4) };
  equipGear(p, 'kage', g.c1);
  equipGear(p, 'kage', g.r1);
  equipGear(p, 'aoi', g.c2);
  return { p, g };
}

/** What an older build does: it keeps formation, gear and counters, and drops the blocks it does not know. */
function oldBuild(p) {
  const raw = JSON.parse(saveText(p, 1));
  delete raw.teams;
  for (const u of Object.values(raw.units)) { delete u.presets; delete u.preset; }
  return raw;
}

describe('migration', () => {
  it('nothing is written until teams or loadouts are used: Team 1 is the formation, loadout A what she wears', () => {
    const { p, g } = setup();
    const m = reload(p);
    expect(m.teams).toBeUndefined();
    expect(m.units.kage.presets).toBeUndefined();
    expect(Object.keys(m.missions.counters).filter((k) => /^(tm|gp):/.test(k))).toEqual([]);
    const view = getTeams(m);
    expect(view.active).toBe(0);
    expect(view.list).toHaveLength(TEAM_COUNT);
    expect(view.list[0]).toMatchObject({ hero: 'hikari', towers: ['aoi', 'rei'] });
    for (let i = 1; i < TEAM_COUNT; i++) expect(view.list[i]).toMatchObject({ hero: null, towers: [] });
    expect(getPresets(m, 'kage')).toEqual({ presets: [{ charm: g.c1, ribbon: g.r1, shoes: null, hair: null, necklace: null }], preset: 0 });
    // the views write nothing
    expect(m.teams).toBeUndefined();
    expect(m.units.kage.presets).toBeUndefined();
  });

  it('first use makes the blocks: Team 1 = the formation, five teams; loading is idempotent', () => {
    const { p } = setup();
    ensureTeams(p);
    expect(p.teams.list).toHaveLength(TEAM_COUNT);
    expect(p.teams.list[0]).toMatchObject({ name: 'Team 1', hero: 'hikari', towers: ['aoi', 'rei'] });
    usePreset(p, 'kage', 1);
    selectTeam(p, 2);
    const a = reload(p);
    expect(a.teams.active).toBe(2);
    expect(a.units.kage.presets).toHaveLength(2);
    expect(migrateProfile(clone(a))).toEqual(a);
  });

  it('round-trips through the stored save and an export', () => {
    const { p, g } = setup();
    usePreset(p, 'kage', 1);
    unequipGear(p, 'kage', 'charm');
    equipGear(p, 'kage', g.c2);
    renameTeam(p, 0, 'Bosses');
    const a = reload(p);
    expect(a.units.kage.presets).toHaveLength(2);
    expect(a.units.kage.presets[0].charm).toBe(g.c1);
    expect(a.units.kage.presets[1].charm).toBe(g.c2);
    expect(a.teams.list[0].name).toBe('Bosses');
    const b = deserializeProfile(serializeProfile(a));
    expect(b.units.kage.presets).toEqual(a.units.kage.presets);
    expect(b.teams).toEqual(a.teams);
  });

  it('hostile blocks are cleaned', () => {
    const { p } = setup();
    const raw = clone(p);
    raw.teams = { active: 9, list: [{ name: 'x'.repeat(99), hero: 'aoi', towers: ['aoi', 'aoi', 'nobody', 'hikari'], use: { aoi: 7, kage: 2 } }, 'junk'] };
    raw.units.kage.presets = [{ charm: 'g999', ribbon: 42 }, null, {}, {}, {}];
    raw.units.kage.preset = 12;
    const m = migrateProfile(raw);
    expect(m.teams.active).toBe(0);
    expect(m.teams.list.length).toBeLessThanOrEqual(TEAM_COUNT);
    // the active team = the formation (present fields win)
    expect(m.teams.list[0]).toMatchObject({ hero: 'hikari', towers: ['aoi', 'rei'] });
    expect(m.teams.list[0].name.length).toBeLessThanOrEqual(16);
    expect(m.units.kage.presets.length).toBeLessThanOrEqual(3);
    expect(m.units.kage.preset).toBe(0);
  });
});

describe('loadouts', () => {
  it('a new loadout starts as a copy, and switching puts its pieces on', () => {
    const { p, g } = setup();
    const res = usePreset(p, 'kage', 1);
    expect(res.ok && res.created).toBe(true);
    expect(p.units.kage.gear).toMatchObject({ charm: g.c1, ribbon: g.r1, shoes: null });
    // change B: the shoes go on, the ribbon comes off
    equipGear(p, 'kage', g.s1);
    unequipGear(p, 'kage', 'ribbon');
    syncTeams(p);
    expect(p.units.kage.presets[1]).toMatchObject({ charm: g.c1, ribbon: null, shoes: g.s1 });
    expect(p.units.kage.presets[0]).toMatchObject({ charm: g.c1, ribbon: g.r1, shoes: null });
    usePreset(p, 'kage', 0);
    expect(p.units.kage.gear).toMatchObject({ charm: g.c1, ribbon: g.r1, shoes: null });
    expect(p.gear[g.s1].equippedBy).toBe(null);
    expect(p.gear[g.r1].equippedBy).toBe('kage');
  });

  it('pieces move, never copy: a loadout takes a piece another girl wears, and says so first', () => {
    const { p, g } = setup();
    usePreset(p, 'kage', 1);
    equipGear(p, 'kage', g.c2); // from Aoi
    expect(p.units.aoi.gear.charm).toBe(null);
    usePreset(p, 'kage', 0);
    equipGear(p, 'aoi', g.c2);
    const res = usePreset(p, 'kage', 1);
    expect(res.takes).toEqual([{ uid: g.c2, slot: 'charm', from: 'aoi', to: 'kage' }]);
    expect(takeLines(p, res.takes)[0]).toMatch(/^Takes .+ from Aoi/);
    expect(p.units.aoi.gear.charm).toBe(null);
    expect(p.gear[g.c2].equippedBy).toBe('kage');
    // Undo puts every piece back
    restoreLoadouts(p, res.undo);
    expect(p.units.aoi.gear.charm).toBe(g.c2);
    expect(p.units.kage.gear.charm).toBe(g.c1);
    expect(p.units.kage.preset).toBe(0);
    expect(p.gear[g.c2].equippedBy).toBe('aoi');
  });

  it('copy loadout A to B, and up to 3 loadouts', () => {
    const { p, g } = setup();
    usePreset(p, 'kage', 1);
    unequipGear(p, 'kage', 'charm');
    usePreset(p, 'kage', 0);
    expect(copyPreset(p, 'kage', 0, 1).ok).toBe(true);
    expect(p.units.kage.presets[1]).toMatchObject({ charm: g.c1, ribbon: g.r1, shoes: null });
    expect(usePreset(p, 'kage', 2).ok).toBe(true);
    expect(usePreset(p, 'kage', 3).ok).toBe(false);
    expect(getPresets(p, 'kage').presets).toHaveLength(3);
  });

  it('salvage: a piece only an inactive loadout names is skipped by multi-salvage and asked about singly', () => {
    const { p, g } = setup();
    usePreset(p, 'kage', 1);
    unequipGear(p, 'kage', 'ribbon'); // the ribbon now lives in loadout A only
    syncTeams(p);
    expect(presetsNaming(p, g.r1)).toEqual([{ unitId: 'kage', n: 0 }]);
    expect(salvageBlock(p.gear[g.r1], p)).toBe('loadout');
    expect(loadoutUseText(p, g.r1)).toBe("Kage's Loadout A");
    const pv = salvagePreview(p, [g.r1, g.s1]);
    expect(pv.uids).toEqual([g.s1]);
    expect(pv.skipped).toEqual([{ uid: g.r1, why: 'loadout' }]);
    expect(salvageMany(p, [g.r1]).count).toBe(0);
    // single salvage (after the question) leaves the slot empty with the red dot
    expect(salvageGear(p, g.r1).ok).toBe(true);
    syncTeams(p);
    expect(p.units.kage.presets[0].ribbon).toBe(null);
    expect(p.units.kage.presets[0].gone).toBe(1);
    usePreset(p, 'kage', 0);
    expect(p.units.kage.presets[0].gone).toBeUndefined();
  });
});

describe('teams', () => {
  it('switching teams swaps the formation and each member\'s loadout; the old team is remembered', () => {
    const { p, g } = setup();
    p.formation = { hero: 'luna', towers: ['kage', 'yuki'] };
    usePreset(p, 'kage', 1);
    unequipGear(p, 'kage', 'charm');
    syncTeams(p);
    expect(getTeams(p).list[0].use).toEqual({ kage: 1 });
    // Team 2: Kage on loadout A
    selectTeam(p, 1);
    expect(p.formation).toEqual({ hero: null, towers: [] });
    p.formation = { hero: 'hikari', towers: ['kage', 'momo'] };
    usePreset(p, 'kage', 0);
    syncTeams(p);
    expect(p.units.kage.gear.charm).toBe(g.c1);
    selectTeam(p, 0);
    expect(p.formation).toEqual({ hero: 'luna', towers: ['kage', 'yuki'] });
    expect(p.units.kage.preset).toBe(1);
    expect(p.units.kage.gear.charm).toBe(null);
    selectTeam(p, 1);
    expect(p.formation).toEqual({ hero: 'hikari', towers: ['kage', 'momo'] });
    expect(p.units.kage.gear.charm).toBe(g.c1);
  });

  it('two members naming one piece: both are marked and the first in team order gets it', () => {
    const { p, g } = setup();
    // Aoi's loadout B names Kage's charm (taking it moves it: Kage gets it back after)
    usePreset(p, 'aoi', 1);
    equipGear(p, 'aoi', g.c1);
    usePreset(p, 'aoi', 0);
    equipGear(p, 'kage', g.c1);
    ensureTeams(p);
    p.teams.list[1] = { name: 'Team 2', hero: null, towers: ['kage', 'aoi'], use: { aoi: 1 } };
    const clashes = teamClashes(p, 1);
    expect(clashes.get(g.c1)).toEqual(['kage', 'aoi']);
    const preview = planTeam(p, 1);
    const res = selectTeam(p, 1);
    expect(res.clashes).toEqual(preview.clashes);
    expect(res.clashes).toEqual([{ uid: g.c1, slot: 'charm', kept: 'kage', lost: 'aoi' }]);
    expect(p.units.kage.gear.charm).toBe(g.c1);
    expect(p.units.aoi.gear.charm).toBe(null);
  });

  it('copy, clear and rename', () => {
    const { p } = setup();
    expect(copyTeam(p, 0)).toBe(1);
    expect(p.teams.list[1]).toMatchObject({ hero: 'hikari', towers: ['aoi', 'rei'] });
    renameTeam(p, 1, '  Rush  ');
    expect(teamName(p.teams.list[1], 1)).toBe('Rush');
    renameTeam(p, 1, '');
    expect(teamName(p.teams.list[1], 1)).toBe('Team 2');
    clearTeam(p, 0);
    expect(p.formation).toEqual({ hero: null, towers: [] });
    expect(p.teams.list[0].towers).toEqual([]);
    for (let i = 0; i < TEAM_COUNT; i++) p.teams.list[i] = { name: `Team ${i + 1}`, hero: 'hikari', towers: [], use: {} };
    expect(copyTeam(p, 0)).toBe(-1);
  });

  it('a Stage Prep Add (any formation writer) lands in the active team', () => {
    const { p } = setup();
    selectTeam(p, 3);
    p.formation.towers.push('kage');
    const m = reload(p);
    expect(m.teams.active).toBe(3);
    expect(m.teams.list[3].towers).toEqual(['kage']);
  });
});

describe('after an older build (present fields win)', () => {
  it('teams and loadouts come back from their mirrors; the present formation and gear win', () => {
    const { p, g } = setup();
    p.formation = { hero: 'luna', towers: ['kage'] };
    usePreset(p, 'kage', 1);
    unequipGear(p, 'kage', 'ribbon');
    equipGear(p, 'kage', g.s1);
    selectTeam(p, 2);
    p.formation = { hero: 'hikari', towers: ['yuki', 'momo'] };
    renameTeam(p, 0, 'Mine');
    syncTeams(p);
    const before = clone(p.teams);
    const kageBefore = clone(p.units.kage.presets);
    // an older build loads it, the player changes the formation, it saves without the blocks
    const raw = oldBuild(p);
    raw.formation = { hero: 'hikari', towers: ['yuki'] };
    const m = migrateProfile(raw);
    expect(m.teams.active).toBe(2);
    expect(m.teams.list[2]).toMatchObject({ hero: 'hikari', towers: ['yuki'] });
    expect(m.teams.list[0]).toMatchObject({ hero: before.list[0].hero, towers: before.list[0].towers, use: before.list[0].use });
    // custom names are not mirrored
    expect(teamName(m.teams.list[0], 0)).toBe('Team 1');
    // Kage still wears B (present gear wins), and A comes back from 'gp:'
    expect(m.units.kage.preset).toBe(1);
    expect(m.units.kage.presets[0]).toEqual(kageBefore[0]);
    expect(m.units.kage.presets[1]).toEqual(kageBefore[1]);
  });

  it('an older build that salvaged a piece a loadout named: the slot comes back empty with the red dot', () => {
    const { p, g } = setup();
    usePreset(p, 'kage', 1);
    unequipGear(p, 'kage', 'ribbon');
    const raw = oldBuild(p);
    delete raw.gear[g.r1];
    const m = migrateProfile(raw);
    expect(m.units.kage.presets[0].ribbon).toBe(null);
    expect(m.units.kage.presets[0].gone).toBe(1);
  });

  it('mirrors stay numbers (M0\'s tm: / gp: encoding)', () => {
    const { p } = setup();
    usePreset(p, 'kage', 1);
    selectTeam(p, 1);
    syncTeams(p);
    writeTeamMarks(p);
    const keys = Object.keys(p.missions.counters).filter((k) => /^(tm|gp):/.test(k));
    expect(keys).toContain('tm:a');
    expect(keys).toContain('gp:kage');
    for (const k of keys) expect(Number.isFinite(p.missions.counters[k])).toBe(true);
  });
});

/**
 * The reviewers' fixture: Team 1 = Aoi wearing c2 (loadout A); Team 2 = Kage on her Loadout B, which names c2;
 * Team 3 = Kage on Loadout C (c1) + Yuki; Team 4 = Yuki alone.
 */
function sharedTeams() {
  const { p, g } = setup();
  p.formation = { hero: null, towers: ['aoi'] };
  ensureTeams(p);
  usePreset(p, 'kage', 1); // B, a copy of A
  usePreset(p, 'kage', 2); // C, a copy of A (c1)
  usePreset(p, 'kage', 0);
  p.units.kage.presets[1] = { ...p.units.kage.presets[1], charm: g.c2 };
  syncTeams(p);
  p.teams.list[1] = { name: 'Team 2', hero: null, towers: ['kage'], use: { kage: 1 } };
  p.teams.list[2] = { name: 'Team 3', hero: null, towers: ['kage', 'yuki'], use: { kage: 2 } };
  p.teams.list[3] = { name: 'Team 4', hero: null, towers: ['yuki'], use: {} };
  return { p, g };
}

describe('review r1', () => {
  it('H1: a piece shared by two teams through two girls goes back and forth, and neither loadout forgets it', () => {
    const { p, g } = sharedTeams();
    const to2 = selectTeam(p, 1);
    expect(to2.takes).toEqual([{ uid: g.c2, slot: 'charm', from: 'aoi', to: 'kage' }]);
    expect(lenderOf(p, g.c2)).toBe('aoi');
    expect(p.units.aoi.presets[p.units.aoi.preset].charm).toBe(g.c2);
    const to1 = selectTeam(p, 0);
    expect(to1.takes).toEqual([{ uid: g.c2, slot: 'charm', from: 'kage', to: 'aoi' }]);
    expect(p.gear[g.c2].equippedBy).toBe('aoi');
    expect(lenderOf(p, g.c2)).toBe(null);
    // Kage's Loadout B still names it: Team 2 takes it again, after a reload too
    const m = reload(p);
    expect(selectTeam(m, 1).takes.length).toBe(1);
    expect(m.gear[g.c2].equippedBy).toBe('kage');
    expect(lenderOf(m, g.c2)).toBe('aoi');
  });

  it('M1: the active team\'s clash shows when two members name one piece', () => {
    const { p, g } = sharedTeams();
    selectTeam(p, 1); // Kage takes Aoi's charm: Aoi lends it
    p.formation = { hero: null, towers: ['kage', 'aoi'] };
    syncTeams(p);
    expect(teamClashes(p, 1).get(g.c2)).toEqual(['kage', 'aoi']);
  });

  it('L1: copying into the worn loadout is refused (it would be folded away)', () => {
    const { p } = setup();
    usePreset(p, 'kage', 1);
    expect(copyPreset(p, 'kage', 0, 1).ok).toBe(false);
  });

  it('L7: Undo puts a piece back on its wearer even when a girl recruited after the snapshot took it', () => {
    const { p, g } = setup();
    const res = usePreset(p, 'kage', 1);
    grantUnit(p, 'shiro', NOW);
    equipGear(p, 'shiro', g.c2); // from Aoi
    restoreLoadouts(p, res.undo);
    expect(p.gear[g.c2].equippedBy).toBe('aoi');
    expect(p.units.aoi.gear.charm).toBe(g.c2);
    expect(p.units.shiro.gear.charm).toBe(null);
  });
});

describe('lending is one way (M1 review r2)', () => {
  it('r2-H1: the borrower switching team lets it go: it goes home in the same switch (T2 → T3 → T1)', () => {
    const { p, g } = sharedTeams();
    selectTeam(p, 1);
    const to3 = selectTeam(p, 2); // Kage on C (c1): c2 is spare at once and goes home
    expect(to3.returns).toEqual([{ uid: g.c2, slot: 'charm', from: null, to: 'aoi' }]);
    expect(p.gear[g.c2].equippedBy).toBe('aoi');
    selectTeam(p, 0);
    expect(p.units.aoi.gear.charm).toBe(g.c2);
  });

  it('r2-H1: the borrower switching loadout on her page lets it go: it goes home', () => {
    const { p, g } = sharedTeams();
    selectTeam(p, 1);
    const res = usePreset(p, 'kage', 0);
    expect(res.returns).toEqual([{ uid: g.c2, slot: 'charm', from: null, to: 'aoi' }]);
    expect(p.gear[g.c2].equippedBy).toBe('aoi');
  });

  it('r2-H1: a manual unequip lets it go: it goes home at the next sync (every save write); never salvaged unwarned', () => {
    const { p, g } = sharedTeams();
    selectTeam(p, 1);
    unequipGear(p, 'kage', 'charm');
    // before the sync, the piece is spare but its lender's loadout names it: the salvage guard holds
    expect(salvageBlock(p.gear[g.c2], p)).toBe('loadout');
    expect(salvageMany(p, [g.c2]).count).toBe(0);
    const back = syncTeams(p);
    expect(back).toEqual([{ uid: g.c2, slot: 'charm', from: null, to: 'aoi' }]);
    expect(p.gear[g.c2].equippedBy).toBe('aoi');
    // the same through a save write
    selectTeam(p, 1);
    unequipGear(p, 'kage', 'charm');
    expect(reload(p).gear[g.c2].equippedBy).toBe('aoi');
  });

  it('r2-M1: no ping-pong: Team 3 / Team 4 switches leave the charm with Aoi', () => {
    const { p, g } = sharedTeams();
    selectTeam(p, 1);
    selectTeam(p, 2);
    for (let i = 0; i < 4; i++) {
      const r = selectTeam(p, 3 - (i % 2)); // T4, T3, T4, T3
      expect(r.returns, `switch ${i}`).toEqual([]);
      expect(p.gear[g.c2].equippedBy).toBe('aoi');
    }
  });

  it('goes home when the new team does not use it (the borrower keeps only a wish), stays lent while a member wears it', () => {
    const { p, g } = sharedTeams();
    selectTeam(p, 1);
    expect(lentPieces(p, 'aoi')).toEqual([{ uid: g.c2, slot: 'charm', to: 'kage' }]);
    // Team 3 with Kage on B instead: she still wears c2 → stays lent
    p.teams.list[2].use = { kage: 1 };
    expect(selectTeam(p, 2).returns).toEqual([]);
    expect(lenderOf(p, g.c2)).toBe('aoi');
    // Team 4 (Yuki only): it goes home; Kage's worn loadout keeps a wish, no claim
    const r = selectTeam(p, 3);
    expect(r.returns).toEqual([{ uid: g.c2, slot: 'charm', from: 'kage', to: 'aoi' }]);
    expect(lentPieces(p, 'aoi')).toEqual([]);
    expect(p.units.kage.presets[p.units.kage.preset].wish).toBe(1);
    expect(lenderOf(p, g.c2)).toBe(null);
  });

  it('a borrower passing it on never becomes its lender; order of the save\'s keys does not matter', () => {
    const { p, g } = sharedTeams();
    selectTeam(p, 1); // Aoi lends c2 to Kage
    equipGear(p, 'momo', g.c2); // Kage passes it on by hand
    syncTeams(p);
    // still Aoi's: it is worn, so it stays lent
    expect(lenderOf(p, g.c2)).toBe('aoi');
    // a second save with the units in reverse order settles the same way
    const q = JSON.parse(JSON.stringify(p));
    q.units = Object.fromEntries(Object.entries(q.units).reverse());
    unequipGear(p, 'momo', 'charm');
    unequipGear(q, 'momo', 'charm');
    expect(syncTeams(p)).toEqual(syncTeams(q));
    expect(p.gear[g.c2].equippedBy).toBe('aoi');
  });

  it('r3-H1: the borrower lets it go while a later step takes another piece from the lender (team switch)', () => {
    const { p, g } = sharedTeams();
    const rA = addGear(p, rollGear(createRng(9), { slot: 'ribbon', rarity: 'epic', level: 1 }));
    equipGear(p, 'aoi', rA); // Aoi: c2 + rA
    selectTeam(p, 1); // Kage B borrows c2
    // Team 3: Kage on C (c1), then Yuki on a loadout that names rA
    usePreset(p, 'yuki', 1);
    usePreset(p, 'yuki', 0);
    p.units.yuki.presets[1] = { ...p.units.yuki.presets[1], ribbon: rA };
    p.teams.list[2] = { name: 'Team 3', hero: null, towers: ['kage', 'yuki'], use: { kage: 2, yuki: 1 } };
    const r = selectTeam(p, 2);
    expect(r.returns).toEqual([{ uid: g.c2, slot: 'charm', from: null, to: 'aoi' }]);
    expect(p.gear[g.c2].equippedBy).toBe('aoi');
    expect(p.gear[rA].equippedBy).toBe('yuki');
    expect(lenderOf(p, rA)).toBe('aoi');
    selectTeam(p, 0);
    expect(p.units.aoi.gear.charm).toBe(g.c2);
  });

  it('r3-H1: the same on the girl page (Kage puts on a loadout naming a piece Aoi wears)', () => {
    const { p, g } = sharedTeams();
    const rA = g.r1;
    unequipGear(p, 'kage', 'ribbon');
    equipGear(p, 'aoi', rA);
    p.units.kage.presets[1] = { ...p.units.kage.presets[1], ribbon: null }; // B: c2 only
    selectTeam(p, 1); // Kage B borrows c2
    expect(p.gear[rA].equippedBy).toBe('aoi');
    p.units.kage.presets[2] = { ...p.units.kage.presets[2], charm: g.c1, ribbon: rA };
    const res = usePreset(p, 'kage', 2);
    expect(res.returns).toEqual([{ uid: g.c2, slot: 'charm', from: null, to: 'aoi' }]);
    expect(p.gear[g.c2].equippedBy).toBe('aoi');
    expect(lenderOf(p, rA)).toBe('aoi');
  });

  it('r4-M1: a loadout she took off keeps her claim, so the lending never flips direction', () => {
    const { p, g } = sharedTeams();
    // Aoi: c2 on A; her loadout B has no charm
    usePreset(p, 'aoi', 1);
    unequipGear(p, 'aoi', 'charm');
    usePreset(p, 'aoi', 0);
    expect(p.units.aoi.gear.charm).toBe(g.c2);
    selectTeam(p, 1); // Kage borrows c2
    usePreset(p, 'aoi', 1); // on her page Aoi puts on B (no charm)
    expect(lenderOf(p, g.c2)).toBe('aoi');
    selectTeam(p, 0); // Team 1: Aoi on A takes c2 back from Kage
    expect(p.gear[g.c2].equippedBy).toBe('aoi');
    expect(lenderOf(p, g.c2)).toBe(null);
    const r = selectTeam(p, 3); // Team 4 (Yuki only): c2 stays with Aoi
    expect(r.returns).toEqual([]);
    expect(p.gear[g.c2].equippedBy).toBe('aoi');
    expect(lenderOf(p, g.c2)).toBe(null);
  });

  it('r4-M1: the taken-off loadout\'s claim rides the mirrors through an older build', () => {
    const { p, g } = sharedTeams();
    usePreset(p, 'aoi', 1);
    unequipGear(p, 'aoi', 'charm'); // her Loadout B: no charm
    usePreset(p, 'aoi', 0);
    selectTeam(p, 1); // Kage borrows c2
    usePreset(p, 'aoi', 1); // Aoi puts on B: A keeps the claim
    expect(lenderOf(p, g.c2)).toBe('aoi');
    const raw = JSON.parse(saveText(p, 1));
    delete raw.teams;
    for (const u of Object.values(raw.units)) { delete u.presets; delete u.preset; }
    const m = migrateProfile(raw);
    expect(lenderOf(m, g.c2)).toBe('aoi');
  });

  it('the lend flags ride the gp:/gpf: mirrors through an older build', () => {
    const { p, g } = sharedTeams();
    selectTeam(p, 1);
    const raw = JSON.parse(saveText(p, 1));
    delete raw.teams;
    for (const u of Object.values(raw.units)) { delete u.presets; delete u.preset; }
    const m = migrateProfile(raw);
    expect(lenderOf(m, g.c2)).toBe('aoi');
    unequipGear(m, 'kage', 'charm');
    syncTeams(m);
    expect(m.gear[g.c2].equippedBy).toBe('aoi');
  });

  // (600 seeds take about 6 s: past vitest's 5 s default, review r4 H1)
  it('fuzz: switches, loadouts, equips, salvage, Undo and reloads never duplicate or lose a piece', { timeout: 60_000 }, () => {
    for (let seed = 1; seed <= 600; seed++) {
      const rng = createRng(seed);
      let { p } = setup();
      for (const id of ['shiro', 'midori']) grantUnit(p, id, NOW);
      for (let i = 0; i < 6; i++) addGear(p, rollGear(rng, { slot: ['charm', 'ribbon', 'shoes'][i % 3], rarity: 'epic', level: 1 }));
      ensureTeams(p);
      const girls = Object.keys(p.units).filter((id) => UNIT_MAP[id].kind === 'tower');
      const pick = (a) => a[Math.floor(rng.next() * a.length)];
      let undo = null;
      for (let step = 0; step < 60; step++) {
        const r = rng.next();
        const uids = Object.keys(p.gear);
        // the lent pieces before this step (lender by piece), and what this step touches by hand
        const lentBefore = {};
        for (const uid of uids) { const l = lenderOf(p, uid); if (l) lentBefore[uid] = l; }
        const touched = new Set();
        let wholeSave = false;
        let op = '';
        if (r < 0.2) { op = 'team'; undo = selectTeam(p, Math.floor(rng.next() * TEAM_COUNT)).undo; }
        else if (r < 0.35) { op = 'preset'; undo = usePreset(p, pick(girls), Math.floor(rng.next() * 3)).undo || undo; }
        else if (r < 0.55 && uids.length) { const who = pick(girls); const u = pick(uids); touched.add(u).add(who); equipGear(p, who, u); }
        else if (r < 0.62) { const who = pick(girls); touched.add(who); unequipGear(p, who, pick(['charm', 'ribbon', 'shoes'])); }
        else if (r < 0.7) p.formation = { hero: null, towers: [...new Set([pick(girls), pick(girls)])] };
        else if (r < 0.75 && uids.length) { const u = pick(uids); touched.add(u); if (!p.gear[u].equippedBy) salvageGear(p, u); }
        else if (r < 0.8 && undo) { wholeSave = true; restoreLoadouts(p, undo); undo = null; }
        else if (r < 0.85) p = reload(p);
        else if (r < 0.88) salvageMany(p, uids);
        else if (r < 0.94) {
          // build teams and loadouts that share pieces (the paths a lend takes): a team of two with loadouts, and an
          // inactive loadout naming a random piece of its slot
          const t = Math.floor(rng.next() * TEAM_COUNT);
          const a = pick(girls);
          const b = pick(girls);
          if (t !== p.teams.active) p.teams.list[t] = { name: `Team ${t + 1}`, hero: null, towers: [...new Set([a, b])], use: { [a]: Math.floor(rng.next() * 3), [b]: Math.floor(rng.next() * 3) } };
          ensurePresets(p, a);
          const u = p.units[a];
          while (u.presets.length < 3) u.presets.push({ ...u.presets[0], lent: undefined, wish: undefined });
          for (const pr of u.presets) { delete pr.lent; delete pr.wish; }
          const n = [0, 1, 2].find((k) => k !== u.preset);
          const piece = pick(uids.length ? uids : [null]);
          if (piece && p.gear[piece]) u.presets[n][p.gear[piece].slot] = piece;
          touched.add(a);
        }
        else if (r < 0.91) {
          // an older build: drops teams and loadouts, keeps counters
          const raw = JSON.parse(saveText(p, 1));
          delete raw.teams;
          for (const u of Object.values(raw.units)) { delete u.presets; delete u.preset; }
          p = migrateProfile(raw);
        }
        syncTeams(p);
        // a lent piece nobody touched by hand keeps its lender: still lent by the same girl (on whichever of her
        // loadouts names it: a loadout she took off keeps its claim, review r4 M1) or back on her (review r3 H1); the
        // lender never changes without a hand action
        if (!wholeSave) {
          for (const [uid, l] of Object.entries(lentBefore)) {
            if (touched.has(uid) || touched.has(l) || !p.gear[uid]) continue;
            const now = lenderOf(p, uid);
            expect(now === l || now === null, `seed ${seed} step ${step} (${op || r.toFixed(2)}): ${uid}'s lender ${l} became ${now}`).toBe(true);
            expect(now === l || p.gear[uid].equippedBy === l, `seed ${seed} step ${step} (${op || r.toFixed(2)}): ${uid} lent by ${l} is lost (now ${p.gear[uid].equippedBy}, lender ${lenderOf(p, uid)})`).toBe(true);
          }
        }
        // invariants: one wearer per piece, wearers and slots agree, the formation is the active team
        for (const [id, u] of Object.entries(p.units)) {
          for (const s of ['charm', 'ribbon', 'shoes']) if (u.gear[s]) expect(p.gear[u.gear[s]]?.equippedBy, `seed ${seed} step ${step}`).toBe(id);
        }
        for (const g of Object.values(p.gear)) if (g.equippedBy) expect(p.units[g.equippedBy].gear[g.slot]).toBe(g.uid);
        const t = getTeams(p);
        expect([t.list[t.active].hero, ...t.list[t.active].towers].filter(Boolean)).toEqual([p.formation.hero, ...p.formation.towers].filter(Boolean));
        // every lent piece is worn by its borrower or back with its lender; one lender per piece
        const lenders = {};
        for (const [id, u] of Object.entries(p.units)) {
          const worn = u.presets?.[u.preset];
          if (!worn?.lent) continue;
          for (const s of ['charm', 'ribbon', 'shoes']) {
            if (!((worn.lent >> ['charm', 'ribbon', 'shoes', 'hair', 'necklace'].indexOf(s)) & 1)) continue;
            const by = p.gear[worn[s]]?.equippedBy;
            expect(by && by !== id, `seed ${seed} step ${step}: ${id}'s lent ${s}`).toBe(true);
            expect(lenders[worn[s]], `seed ${seed} step ${step}: two lenders`).toBeUndefined();
            lenders[worn[s]] = id;
          }
        }
        // a worn loadout is what she wears, or a flagged piece another girl wears (lent / wish)
        for (const [id, u] of Object.entries(p.units)) {
          if (!u.presets) continue;
          const worn = u.presets[u.preset];
          for (const s of ['charm', 'ribbon', 'shoes']) if (worn[s] !== (u.gear[s] || null)) expect(!u.gear[s] && p.gear[worn[s]]?.equippedBy && p.gear[worn[s]].equippedBy !== id).toBe(true);
        }
      }
    }
  });
});
