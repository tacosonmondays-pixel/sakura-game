// Teams and gear loadouts (docs/specs/GEAR_UPDATE.md §7, milestone M1). Players see "Team" and "Loadout"; in code
// they are teams and presets, because "loadout" already means a co-op loadout (src/online/coop/loadout.js).
//
//   profile.teams = { active: 0…4, list: [{ name, hero, towers, use: { [unitId]: 0…2 } }] } (always 5 entries)
//   unit.presets  = [{ charm, ribbon, shoes, …, gone? }] (1–3), unit.preset = the one she wears
//
// Two invariants every reader keeps relying on: `profile.formation` is the active team's hero and towers, and
// `unit.gear` is `unit.presets[unit.preset]`. Every writer of the formation and of worn gear stays as it is:
// syncTeams() folds both back into the teams and presets, and runs at every load (migrateProfile) and every write
// (store.js saveText). A piece is never copied: it is worn by one girl, and a loadout that names a piece another
// girl wears takes it when it is put on ("Takes Keen Charm from Aoi").
//
// Old-build safety (§7.5, §9.2): an older build drops `teams` and `presets` but keeps missions.counters word for
// word, so both are mirrored there. Present fields win: the formation and the gear an older build left become the
// active team and the active loadout; the other teams and loadouts come back from the mirrors.
//   tm:a                 the active team (0…4)
//   tm:<t>:<unitId>      a member of team t: 1 + loadout used + 10 × place (0 the hero, 1…8 the students)
//   gp:<unitId>          her loadouts: count × 10 + the one she wears (absent: one loadout, A)
//   gp:<unitId>:<n>:<slot>  n of the piece (gear uid 'g<n>') loadout n names in that slot, for loadouts she does not
//                        wear (the one she wears is her gear, mirrored by 'own:<id>:<slot>', src/systems/rosterSave.js)
// Custom team names are kept on this device and never mirrored or sent online.
//
// Pure functions on the profile; nothing here is co-op hashed and the battle never reads it.
import { GEAR_SLOTS, BATTLE } from '../data/types.js';
import { UNIT_MAP } from '../data/units.js';
import { equipGear, unequipGear } from './gear.js';

export const TEAM_COUNT = 5;
export const PRESET_COUNT = 3;
export const PRESET_LETTERS = ['A', 'B', 'C'];
export const TEAM_NAME_MAX = 16;
export const TEAM_MARK = 'tm:';
export const PRESET_MARK = 'gp:';

/** The gear slots a loadout holds (GEAR_UPDATE M0 moves this to src/data/gearSlots.js SLOT_IDS). */
export const slotIds = () => Object.keys(GEAR_SLOTS);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const counters = (p) => ((p.missions ||= {}).counters ||= {});
const gearNumber = (uid) => {
  const m = typeof uid === 'string' ? /^g([1-9]\d{0,14})$/.exec(uid) : null;
  return m ? Number(m[1]) : 0;
};

/** "Team 3", or the name the player gave it on this device. */
export const teamName = (team, i) => (team && typeof team.name === 'string' && team.name.trim()) || `Team ${i + 1}`;
export const presetLetter = (n) => PRESET_LETTERS[n] || 'A';

export function emptyTeam() {
  return { name: '', hero: null, towers: [], use: {} };
}

export function emptyPreset() {
  const out = {};
  for (const s of slotIds()) out[s] = null;
  return out;
}

/** A team's members in team order: the hero first, then the students. */
export const teamMembers = (team) => [team?.hero, ...(team?.towers || [])].filter(Boolean);

function cleanSquad(p, hero, towers) {
  const h = typeof hero === 'string' && p.units[hero] && UNIT_MAP[hero]?.kind === 'hero' ? hero : null;
  const t = (Array.isArray(towers) ? towers : [])
    .filter((id, i, a) => typeof id === 'string' && p.units[id] && UNIT_MAP[id]?.kind === 'tower' && a.indexOf(id) === i)
    .slice(0, BATTLE.maxTowers);
  return { hero: h, towers: t };
}

function cleanUse(p, raw, members) {
  const use = {};
  if (!isObj(raw)) return use;
  for (const id of members) {
    const n = raw[id];
    if (Number.isInteger(n) && n > 0 && n < PRESET_COUNT) use[id] = n;
  }
  return use;
}

function cleanTeam(p, raw) {
  if (!isObj(raw)) return emptyTeam();
  const sq = cleanSquad(p, raw.hero, raw.towers);
  const name = typeof raw.name === 'string' ? raw.name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, TEAM_NAME_MAX) : '';
  return { name, ...sq, use: cleanUse(p, raw.use, teamMembers(sq)) };
}

/** Teams from their tm: mirrors (an older build dropped the block). */
function teamsFromMarks(p, c) {
  const list = Array.from({ length: TEAM_COUNT }, emptyTeam);
  let any = false;
  const placed = list.map(() => []);
  for (const [k, v] of Object.entries(c)) {
    const m = /^tm:([0-4]):([a-z0-9_]{1,40})$/.exec(k);
    if (!m || !(whole(v) >= 1)) continue;
    const t = Number(m[1]);
    const id = m[2];
    if (!p.units[id] || !UNIT_MAP[id]) continue;
    any = true;
    const val = whole(v) - 1;
    placed[t].push({ id, use: val % 10, place: Math.floor(val / 10) });
  }
  if (!any) return null;
  placed.forEach((rows, t) => {
    rows.sort((a, b) => a.place - b.place || (a.id < b.id ? -1 : 1));
    const hero = rows.find((r) => r.place === 0 && UNIT_MAP[r.id].kind === 'hero')?.id || null;
    const towers = rows.filter((r) => r.place > 0).map((r) => r.id);
    const sq = cleanSquad(p, hero, towers);
    const use = {};
    for (const r of rows) if (r.use > 0 && r.use < PRESET_COUNT && teamMembers(sq).includes(r.id)) use[r.id] = r.use;
    list[t] = { name: '', ...sq, use };
  });
  return list;
}

/**
 * The teams block of a loaded save (migrateProfile, after the formation, units, gear and missions are clean).
 * Present fields win: the formation the save holds is the active team.
 */
export function cleanTeams(raw, p) {
  const c = counters(p);
  let list = null;
  let active = 0;
  if (isObj(raw) && Array.isArray(raw.list)) {
    list = Array.from({ length: TEAM_COUNT }, (_, i) => cleanTeam(p, raw.list[i]));
    active = Number.isInteger(raw.active) && raw.active >= 0 && raw.active < TEAM_COUNT ? raw.active : 0;
  } else {
    list = teamsFromMarks(p, c);
    if (list) active = Math.min(TEAM_COUNT - 1, whole(c[`${TEAM_MARK}a`]));
    // Team 1 = today's formation (the migration)
    else list = Array.from({ length: TEAM_COUNT }, emptyTeam);
  }
  p.teams = { active, list };
  foldFormation(p);
  return p.teams;
}

/** Her loadouts from a stored unit, or her gp: mirrors (an older build dropped them). */
function cleanPresetList(p, unitId, raw) {
  const slots = slotIds();
  const piece = (uid, slot) => {
    if (typeof uid !== 'string' || !uid) return null;
    const g = p.gear[uid];
    return g && g.slot === slot ? uid : undefined; // undefined: named, but gone
  };
  const fromRaw = (r) => {
    const out = emptyPreset();
    if (!isObj(r)) return out;
    for (const s of slots) {
      const v = piece(r[s], s);
      if (v === undefined) out.gone = 1;
      else out[s] = v;
    }
    if (r.gone === 1 || r.gone === true) out.gone = 1;
    return out;
  };
  if (Array.isArray(raw?.presets) && raw.presets.length) {
    const presets = raw.presets.slice(0, PRESET_COUNT).map(fromRaw);
    const preset = Number.isInteger(raw.preset) && raw.preset >= 0 && raw.preset < presets.length ? raw.preset : 0;
    return { presets, preset };
  }
  const c = counters(p);
  const head = whole(c[`${PRESET_MARK}${unitId}`]);
  const count = Math.max(1, Math.min(PRESET_COUNT, Math.floor(head / 10)));
  const preset = Math.min(count - 1, head % 10);
  const presets = Array.from({ length: count }, (_, n) => {
    const out = emptyPreset();
    if (n === preset) return out;
    for (const s of slots) {
      const num = whole(c[`${PRESET_MARK}${unitId}:${n}:${s}`]);
      if (!num) continue;
      const v = piece(`g${num}`, s);
      if (v === undefined) out.gone = 1;
      else out[s] = v;
    }
    return out;
  });
  return { presets, preset };
}

/** Every girl's loadouts (migrateProfile, after gear consistency). Present gear wins: it is her active loadout. */
export function cleanPresets(rawUnits, p) {
  for (const [id, u] of Object.entries(p.units)) {
    const raw = isObj(rawUnits) && isObj(rawUnits[id]) ? rawUnits[id] : null;
    const { presets, preset } = cleanPresetList(p, id, raw);
    u.presets = presets;
    u.preset = preset;
    foldGear(p, id);
  }
}

/** Her active loadout = what she wears; a loadout naming a piece that is gone gets the red dot (`gone`). */
function foldGear(p, unitId) {
  const u = p.units[unitId];
  if (!u) return;
  if (!Array.isArray(u.presets) || !u.presets.length) u.presets = [emptyPreset()];
  if (u.presets.length > PRESET_COUNT) u.presets.length = PRESET_COUNT;
  if (!Number.isInteger(u.preset) || u.preset < 0 || u.preset >= u.presets.length) u.preset = 0;
  u.presets.forEach((pr, n) => {
    if (n === u.preset) return;
    for (const s of slotIds()) {
      if (pr[s] && !(p.gear[pr[s]] && p.gear[pr[s]].slot === s)) {
        pr[s] = null;
        pr.gone = 1;
      }
    }
  });
  const cur = emptyPreset();
  for (const s of slotIds()) cur[s] = u.gear?.[s] || null;
  u.presets[u.preset] = cur;
}

/** The active team = the formation (whoever changed it: Formation, Stage Prep's Add, an older build). */
function foldFormation(p) {
  const t = p.teams;
  const team = t.list[t.active];
  const sq = cleanSquad(p, p.formation?.hero, p.formation?.towers);
  team.hero = sq.hero;
  team.towers = sq.towers;
  // a member's loadout: what she wears now (the team remembers it); non-members are forgotten
  const use = {};
  for (const id of teamMembers(team)) {
    const n = p.units[id]?.preset || 0;
    if (n > 0) use[id] = n;
  }
  team.use = use;
}

/** Fold the formation and the worn gear back into the teams and loadouts (every load and write). */
export function syncTeams(p) {
  if (!p?.units || !p.gear) return;
  if (!isObj(p.teams) || !Array.isArray(p.teams.list) || p.teams.list.length !== TEAM_COUNT) {
    p.teams = { active: 0, list: Array.from({ length: TEAM_COUNT }, (_, i) => cleanTeam(p, p.teams?.list?.[i])) };
  }
  if (!Number.isInteger(p.teams.active) || p.teams.active < 0 || p.teams.active >= TEAM_COUNT) p.teams.active = 0;
  for (const id of Object.keys(p.units)) foldGear(p, id);
  foldFormation(p);
}

/** Rewrite the tm: and gp: mirrors (store.js saveText, migrateProfile). */
export function writeTeamMarks(p) {
  if (!p?.teams || !p.units) return;
  const c = counters(p);
  for (const k of Object.keys(c)) if (k.startsWith(TEAM_MARK) || k.startsWith(PRESET_MARK)) delete c[k];
  if (p.teams.active) c[`${TEAM_MARK}a`] = p.teams.active;
  p.teams.list.forEach((team, t) => {
    for (const id of teamMembers(team)) {
      const place = id === team.hero ? 0 : team.towers.indexOf(id) + 1;
      c[`${TEAM_MARK}${t}:${id}`] = 1 + (team.use?.[id] || 0) + 10 * place;
    }
  });
  for (const [id, u] of Object.entries(p.units)) {
    const list = u.presets || [];
    if (list.length <= 1 && !u.preset) continue;
    c[`${PRESET_MARK}${id}`] = list.length * 10 + (u.preset || 0);
    list.forEach((pr, n) => {
      if (n === u.preset) return;
      for (const s of slotIds()) {
        const num = gearNumber(pr[s]);
        if (num) c[`${PRESET_MARK}${id}:${n}:${s}`] = num;
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** The teams, synced (the screens call it before drawing). */
export function getTeams(p) {
  syncTeams(p);
  return p.teams;
}

/** Her loadouts, synced. */
export function getPresets(p, unitId) {
  syncTeams(p);
  const u = p.units[unitId];
  return { presets: u?.presets || [emptyPreset()], preset: u?.preset || 0 };
}

/** The loadout a member of team t uses (0 = A). */
export const teamUse = (team, unitId) => team?.use?.[unitId] || 0;

/**
 * The loadouts that name this piece and are not worn (they would put it on): [{ unitId, n }].
 * A piece named only by such a loadout is skipped by multi-salvage and asked about by single salvage.
 */
export function presetsNaming(p, uid) {
  const g = p.gear?.[uid];
  if (!g) return [];
  const out = [];
  for (const [id, u] of Object.entries(p.units)) {
    (u.presets || []).forEach((pr, n) => {
      if (n !== u.preset && pr[g.slot] === uid) out.push({ unitId: id, n });
    });
  }
  return out;
}

/** "Kage's Loadout B" for the first loadout that names the piece (null: none). */
export function loadoutUseText(p, uid) {
  const first = presetsNaming(p, uid)[0];
  return first ? `${UNIT_MAP[first.unitId]?.name || first.unitId}'s Loadout ${presetLetter(first.n)}` : null;
}

// ---------------------------------------------------------------------------
// Planning a switch (nothing changes)
// ---------------------------------------------------------------------------

/**
 * What putting on these loadouts would do, in order: each girl gets the pieces her loadout names, a piece already
 * claimed by an earlier girl in the list stays with her (the first in team order gets it; the later girl's slot is
 * left empty).
 * @param {object} p
 * @param {{ unitId: string, n: number }[]} wants
 * @returns {{ steps: { unitId, n, slots: { slot, uid: string|null }[] }[], takes: { uid, slot, from, to }[],
 *   clashes: { uid, slot, kept: string, lost: string }[] }}
 */
export function planLoadouts(p, wants) {
  syncTeams(p);
  const claimed = new Map();
  const steps = [];
  const takes = [];
  const clashes = [];
  const wearsAfter = new Map(); // uid → unitId (who will wear it)
  for (const { unitId, n } of wants) {
    const u = p.units[unitId];
    if (!u) continue;
    const pr = u.presets[n] || u.presets[0];
    const slots = [];
    for (const s of slotIds()) {
      let uid = pr[s] && p.gear[pr[s]] ? pr[s] : null;
      if (uid && claimed.has(uid)) {
        clashes.push({ uid, slot: s, kept: claimed.get(uid), lost: unitId });
        uid = null;
      }
      if (uid) {
        claimed.set(uid, unitId);
        wearsAfter.set(uid, unitId);
        const from = p.gear[uid].equippedBy;
        if (from && from !== unitId) takes.push({ uid, slot: s, from, to: unitId });
      }
      slots.push({ slot: s, uid });
    }
    steps.push({ unitId, n: u.presets[n] ? n : 0, slots });
  }
  // a take from a girl who is herself switching in this plan and lets the piece go anyway is still a take: the
  // list says it, so the player sees every piece that moves between girls
  return { steps, takes, clashes };
}

/** planLoadouts for one girl switching to loadout n. */
export const planPreset = (p, unitId, n) => planLoadouts(p, [{ unitId, n }]);

/** planLoadouts for team t: every member, in team order, with the loadout the team remembers. */
export function planTeam(p, t) {
  const team = getTeams(p).list[t];
  if (!team) return { steps: [], takes: [], clashes: [] };
  return planLoadouts(p, teamMembers(team).map((id) => ({ unitId: id, n: teamUse(team, id) })));
}

/**
 * Team t's clashes in the editor: two members whose loadouts name the same piece (both are marked; the first in
 * team order gets it). @returns {Map<string, string[]>} uid → the member ids naming it
 */
export function teamClashes(p, t) {
  const team = getTeams(p).list[t];
  const named = new Map();
  for (const id of teamMembers(team)) {
    const u = p.units[id];
    const pr = u?.presets?.[teamUse(team, id)] || u?.presets?.[0];
    if (!pr) continue;
    for (const s of slotIds()) if (pr[s] && p.gear[pr[s]]) named.set(pr[s], [...(named.get(pr[s]) || []), id]);
  }
  for (const [uid, ids] of named) if (ids.length < 2) named.delete(uid);
  return named;
}

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

/** Everything a switch can change: every girl's gear and loadouts, every wearer, the teams and the formation. */
export function snapshotLoadouts(p) {
  syncTeams(p);
  return JSON.parse(JSON.stringify({
    units: Object.fromEntries(Object.entries(p.units).map(([id, u]) => [id, { gear: u.gear, presets: u.presets, preset: u.preset }])),
    wearers: Object.fromEntries(Object.entries(p.gear).map(([uid, g]) => [uid, g.equippedBy || null])),
    teams: p.teams,
    formation: p.formation,
  }));
}

/** Put a snapshot back. Pieces salvaged since stay gone (their slots empty). */
export function restoreLoadouts(p, snap) {
  if (!snap) return false;
  for (const [id, s] of Object.entries(snap.units)) {
    const u = p.units[id];
    if (!u) continue;
    u.gear = emptyPreset();
    for (const k of slotIds()) u.gear[k] = s.gear?.[k] && p.gear[s.gear[k]] ? s.gear[k] : null;
    u.presets = s.presets;
    u.preset = s.preset;
  }
  for (const [uid, g] of Object.entries(p.gear)) g.equippedBy = uid in snap.wearers ? snap.wearers[uid] : g.equippedBy;
  // a wearer must still name the piece (and a girl only wears what names her)
  for (const g of Object.values(p.gear)) if (g.equippedBy && p.units[g.equippedBy]?.gear?.[g.slot] !== g.uid) g.equippedBy = null;
  for (const [id, u] of Object.entries(p.units)) for (const s of slotIds()) if (u.gear[s] && p.gear[u.gear[s]]?.equippedBy !== id) u.gear[s] = null;
  p.teams = snap.teams;
  p.formation = snap.formation;
  syncTeams(p);
  return true;
}

// ---------------------------------------------------------------------------
// Switching
// ---------------------------------------------------------------------------

function applyStep(p, step) {
  const u = p.units[step.unitId];
  for (const { slot, uid } of step.slots) {
    if (uid) {
      if (u.gear[slot] !== uid) equipGear(p, step.unitId, uid);
    } else if (u.gear[slot]) unequipGear(p, step.unitId, slot);
  }
  u.preset = step.n;
  const pr = u.presets[step.n];
  if (pr) delete pr.gone;
  foldGear(p, step.unitId);
}

/**
 * Put on loadout n for one girl. n = her loadout count adds a new loadout, a copy of the one she wears.
 * The active team remembers it when she is a member.
 * @returns {{ ok: boolean, error?: string, takes?: object[], created?: boolean, undo?: object }}
 */
export function usePreset(p, unitId, n) {
  syncTeams(p);
  const u = p.units[unitId];
  if (!u) return { ok: false, error: 'notOwned' };
  if (!Number.isInteger(n) || n < 0 || n >= PRESET_COUNT || n > u.presets.length) return { ok: false, error: 'badLoadout' };
  const undo = snapshotLoadouts(p);
  let created = false;
  if (n === u.presets.length) {
    u.presets.push({ ...u.presets[u.preset] });
    delete u.presets[n].gone;
    created = true;
  }
  const plan = planPreset(p, unitId, n);
  for (const step of plan.steps) applyStep(p, step);
  syncTeams(p);
  return { ok: true, takes: plan.takes, created, undo };
}

/**
 * Make team t the active team: the formation becomes its squad and every member puts on the loadout the team
 * remembers (the first in team order gets a piece two of them name).
 * @returns {{ ok: boolean, error?: string, takes?: object[], clashes?: object[], undo?: object }}
 */
export function selectTeam(p, t) {
  syncTeams(p);
  if (!Number.isInteger(t) || t < 0 || t >= TEAM_COUNT) return { ok: false, error: 'badTeam' };
  const undo = snapshotLoadouts(p);
  if (t === p.teams.active) return { ok: true, takes: [], clashes: [], undo };
  const team = p.teams.list[t];
  // the loadouts the team remembers, read before it becomes active (from then on it follows what they wear)
  const wants = teamMembers(team).map((id) => ({ unitId: id, n: teamUse(team, id) }));
  p.teams.active = t;
  p.formation = { hero: team.hero, towers: team.towers.slice() };
  const plan = planLoadouts(p, wants);
  for (const step of plan.steps) applyStep(p, step);
  syncTeams(p);
  return { ok: true, takes: plan.takes, clashes: plan.clashes, undo };
}

/** Copy team `from` into the first empty team. @returns {number} its index, or -1 when every team has girls */
export function copyTeam(p, from) {
  const teams = getTeams(p);
  const src = teams.list[from];
  if (!src) return -1;
  const to = teams.list.findIndex((tm, i) => i !== from && !teamMembers(tm).length);
  if (to < 0) return -1;
  teams.list[to] = { name: '', hero: src.hero, towers: src.towers.slice(), use: { ...src.use } };
  return to;
}

/** Empty team t (the active team empties the formation too). */
export function clearTeam(p, t) {
  const teams = getTeams(p);
  if (!teams.list[t]) return false;
  const name = teams.list[t].name;
  teams.list[t] = { ...emptyTeam(), name };
  if (t === teams.active) p.formation = { hero: null, towers: [] };
  syncTeams(p);
  return true;
}

/** Rename team t on this device ('' gives "Team N" back). */
export function renameTeam(p, t, name) {
  const teams = getTeams(p);
  if (!teams.list[t]) return false;
  teams.list[t].name = String(name ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, TEAM_NAME_MAX);
  return true;
}

/**
 * Copy her loadout `from` into `to` (to = her loadout count adds one). Copying into the loadout she wears puts it on.
 * @returns {{ ok: boolean, error?: string, takes?: object[], undo?: object }}
 */
export function copyPreset(p, unitId, from, to) {
  syncTeams(p);
  const u = p.units[unitId];
  if (!u || !u.presets[from] || from === to || to < 0 || to >= PRESET_COUNT || to > u.presets.length) return { ok: false, error: 'badLoadout' };
  const undo = snapshotLoadouts(p);
  const copy = { ...u.presets[from] };
  delete copy.gone;
  if (to === u.presets.length) u.presets.push(copy);
  else u.presets[to] = copy;
  let takes = [];
  if (to === u.preset) {
    const plan = planPreset(p, unitId, to);
    for (const step of plan.steps) applyStep(p, step);
    takes = plan.takes;
  }
  syncTeams(p);
  return { ok: true, takes, undo };
}

/** "Takes Keen Charm from Aoi" lines for a plan's takes. */
export function takeLines(p, takes) {
  return takes.map((t) => `Takes ${p.gear[t.uid]?.name || 'a piece'} from ${UNIT_MAP[t.from]?.name || t.from}${t.to ? ` for ${UNIT_MAP[t.to]?.name || t.to}` : ''}`);
}
