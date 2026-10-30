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
  copyPreset, restoreLoadouts, presetsNaming, loadoutUseText, takeLines, syncTeams, teamName, ensureTeams, ensurePresets, lentPieces,
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

describe('review r1', () => {
  it('H1: a piece shared by two teams through two girls goes back and forth, and neither loadout forgets it', () => {
    const { p, g } = setup();
    // Team 1: Aoi wears c2. Team 2: Kage, whose loadout A names c2 too.
    p.formation = { hero: null, towers: ['aoi'] };
    ensureTeams(p);
    equipGear(p, 'kage', g.c2); // (Kage takes it by hand once so her loadout A names it)
    usePreset(p, 'kage', 0);
    equipGear(p, 'aoi', g.c2);
    p.teams.list[1] = { name: 'Team 2', hero: null, towers: ['kage'], use: {} };
    ensurePresets(p, 'kage');
    p.units.kage.presets[0].charm = g.c2;
    const to2 = selectTeam(p, 1);
    expect(to2.takes).toEqual([{ uid: g.c2, slot: 'charm', from: 'aoi', to: 'kage' }]);
    expect(p.gear[g.c2].equippedBy).toBe('kage');
    // Aoi's worn loadout still names it (lent)
    expect(p.units.aoi.presets[p.units.aoi.preset].charm).toBe(g.c2);
    const to1 = selectTeam(p, 0);
    expect(to1.takes).toEqual([{ uid: g.c2, slot: 'charm', from: 'kage', to: 'aoi' }]);
    expect(p.gear[g.c2].equippedBy).toBe('aoi');
    expect(p.units.kage.presets[p.units.kage.preset].charm).toBe(g.c2);
    // and again, after a reload in between
    const m = reload(p);
    expect(m.units.kage.presets[m.units.kage.preset].charm).toBe(g.c2);
    expect(selectTeam(m, 1).takes.length).toBe(1);
    expect(m.gear[g.c2].equippedBy).toBe('kage');
  });

  it('M1: the active team\'s clash shows when two members name one piece', () => {
    const { p, g } = setup();
    p.formation = { hero: null, towers: ['aoi'] };
    ensureTeams(p);
    p.teams.list[1] = { name: 'Team 2', hero: null, towers: ['kage'], use: {} };
    unequipGear(p, 'kage', 'charm');
    ensurePresets(p, 'kage');
    p.units.kage.presets[0].charm = g.c2;
    expect(selectTeam(p, 1).takes.length).toBe(1); // Kage takes Aoi's charm: Aoi lends it
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

describe('lent pieces (coordinator ruling on review r1 H1)', () => {
  function shared() {
    const { p, g } = setup();
    p.formation = { hero: null, towers: ['aoi'] };
    ensureTeams(p);
    unequipGear(p, 'kage', 'charm');
    ensurePresets(p, 'kage');
    p.units.kage.presets[0].charm = g.c2;
    p.teams.list[1] = { name: 'Team 2', hero: null, towers: ['kage'], use: {} };
    p.teams.list[2] = { name: 'Team 3', hero: null, towers: ['yuki'], use: {} };
    return { p, g };
  }

  it('goes home when the new team does not use it, and says so', () => {
    const { p, g } = shared();
    selectTeam(p, 1);
    expect(p.gear[g.c2].equippedBy).toBe('kage');
    expect(lentPieces(p, 'aoi')).toEqual([{ uid: g.c2, slot: 'charm', to: 'kage' }]);
    // Team 3 has neither girl: the charm goes back to Aoi
    const res = selectTeam(p, 2);
    expect(res.returns).toEqual([{ uid: g.c2, slot: 'charm', from: 'kage', to: 'aoi' }]);
    expect(p.gear[g.c2].equippedBy).toBe('aoi');
    expect(lentPieces(p, 'aoi')).toEqual([]);
    // and Kage's loadout lends it in turn (she is off the active team, so it stays with Aoi)
    expect(p.units.kage.presets[p.units.kage.preset].charm).toBe(g.c2);
    expect(selectTeam(p, 1).takes).toEqual([{ uid: g.c2, slot: 'charm', from: 'aoi', to: 'kage' }]);
  });

  it('stays lent while a member of the new team wears it; the mirrors keep the mark', () => {
    const { p, g } = shared();
    selectTeam(p, 1);
    p.teams.list[2] = { name: 'Team 3', hero: null, towers: ['kage', 'yuki'], use: {} };
    const res = selectTeam(p, 2);
    expect(res.returns).toEqual([]);
    expect(p.gear[g.c2].equippedBy).toBe('kage');
    // an older build drops the blocks: the lent mark comes back from 'gp:'
    const raw = JSON.parse(saveText(p, 1));
    delete raw.teams;
    for (const u of Object.values(raw.units)) { delete u.presets; delete u.preset; }
    const m = migrateProfile(raw);
    expect(lentPieces(m, 'aoi')).toEqual([{ uid: g.c2, slot: 'charm', to: 'kage' }]);
  });

  it('fuzz: switches, loadouts, equips, salvage, Undo and reloads never duplicate or lose a piece', () => {
    for (let seed = 1; seed <= 40; seed++) {
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
        if (r < 0.2) undo = selectTeam(p, Math.floor(rng.next() * TEAM_COUNT)).undo;
        else if (r < 0.35) undo = usePreset(p, pick(girls), Math.floor(rng.next() * 3)).undo || undo;
        else if (r < 0.55 && uids.length) equipGear(p, pick(girls), pick(uids));
        else if (r < 0.62) unequipGear(p, pick(girls), pick(['charm', 'ribbon', 'shoes']));
        else if (r < 0.7) p.formation = { hero: null, towers: [...new Set([pick(girls), pick(girls)])] };
        else if (r < 0.75 && uids.length) { const u = pick(uids); if (!p.gear[u].equippedBy) salvageGear(p, u); }
        else if (r < 0.8 && undo) { restoreLoadouts(p, undo); undo = null; }
        else if (r < 0.85) p = reload(p);
        syncTeams(p);
        // invariants: one wearer per piece, wearers and slots agree, the formation is the active team
        for (const [id, u] of Object.entries(p.units)) {
          for (const s of ['charm', 'ribbon', 'shoes']) if (u.gear[s]) expect(p.gear[u.gear[s]]?.equippedBy, `seed ${seed} step ${step}`).toBe(id);
        }
        for (const g of Object.values(p.gear)) if (g.equippedBy) expect(p.units[g.equippedBy].gear[g.slot]).toBe(g.uid);
        const t = getTeams(p);
        expect([t.list[t.active].hero, ...t.list[t.active].towers].filter(Boolean)).toEqual([p.formation.hero, ...p.formation.towers].filter(Boolean));
        // a worn loadout is what she wears, or a piece another girl wears (lent)
        for (const [id, u] of Object.entries(p.units)) {
          if (!u.presets) continue;
          const worn = u.presets[u.preset];
          for (const s of ['charm', 'ribbon', 'shoes']) if (worn[s] !== (u.gear[s] || null)) expect(!u.gear[s] && p.gear[worn[s]]?.equippedBy && p.gear[worn[s]].equippedBy !== id).toBe(true);
        }
      }
    }
  });
});
