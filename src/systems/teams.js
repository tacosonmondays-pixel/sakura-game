// Teams and gear loadouts: the switching rules (docs/specs/GEAR_UPDATE.md §7, milestone M1). Players see "Team" and
// "Loadout"; in code they are teams and presets, because "loadout" already means a co-op loadout
// (src/online/coop/loadout.js). The save shape, its cleaning and its 'tm:' / 'gp:' mirrors are M0's
// (src/systems/teamsSave.js):
//
//   profile.teams = { active: 0…4, list: [{ name, hero, towers, use: { [unitId]: 0…2 } }] }
//   unit.presets  = [{ charm, ribbon, shoes, hair, necklace, gone? }] (1–3), unit.preset = the one she wears
//
// Both blocks are made only when a player first uses them (a team chip, a loadout chip); until then the screens read
// a view: Team 1 is the formation, loadout A is what she wears. Two invariants every reader keeps relying on:
// `profile.formation` is the active team's hero and towers, and `unit.gear` is `unit.presets[unit.preset]` except for
// a slot whose piece another girl took ("lent", teamsSave.js wornLoadout: it comes back when her loadout or team is put
// on again). Every
// writer of the formation and of worn gear stays as it is: syncTeams() folds both back, at every write (store.js
// saveText, before the mirrors) and before every switch. A piece is never copied: it is worn by one girl, and a
// loadout that names a piece another girl wears takes it when it is put on ("Takes Keen Charm from Aoi"). `gone` is
// the red dot on a loadout whose piece was salvaged (kept in the save, never mirrored).
//
// Pure functions on the profile; nothing here is co-op hashed and the battle never reads it.
import { BATTLE } from '../data/types.js';
import { UNIT_MAP } from '../data/units.js';
import { SLOT_IDS, emptySlots } from '../data/gearSlots.js';
import { TEAMS_MAX, PRESETS_MAX, wornLoadout } from './teamsSave.js';
import { equipGear, unequipGear } from './gear.js';

export const TEAM_COUNT = TEAMS_MAX;
export const PRESET_COUNT = PRESETS_MAX;
export const PRESET_LETTERS = ['A', 'B', 'C'];
export const TEAM_NAME_MAX = 16;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const defaultName = (i) => `Team ${i + 1}`;

/** "Team 3", or the name the player gave it on this device. */
export const teamName = (team, i) => (team && typeof team.name === 'string' && team.name.trim()) || defaultName(i);
export const presetLetter = (n) => PRESET_LETTERS[n] || 'A';

export function emptyTeam(i = 0) {
  return { name: defaultName(i), hero: null, towers: [], use: {} };
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

/** The teams block, made on first use: Team 1 = the formation, Teams 2–5 empty. */
export function ensureTeams(p) {
  if (!isObj(p.teams) || !Array.isArray(p.teams.list) || !p.teams.list.length) {
    p.teams = { active: 0, list: [{ ...emptyTeam(0), ...cleanSquad(p, p.formation?.hero, p.formation?.towers) }] };
  }
  for (let i = p.teams.list.length; i < TEAM_COUNT; i++) p.teams.list.push(emptyTeam(i));
  if (!Number.isInteger(p.teams.active) || p.teams.active < 0 || p.teams.active >= p.teams.list.length) p.teams.active = 0;
  syncTeams(p);
  return p.teams;
}

/** Her loadouts, made on first use: loadout A = what she wears. */
export function ensurePresets(p, unitId) {
  const u = p.units[unitId];
  if (!u) return null;
  if (!Array.isArray(u.presets) || !u.presets.length) {
    u.presets = [{ ...emptySlots(), ...u.gear }];
    u.preset = 0;
  }
  foldGear(p, unitId);
  return u.presets;
}

/** Her active loadout = what she wears (+ lent pieces); a loadout naming a piece that is gone gets the red dot. */
function foldGear(p, unitId) {
  const u = p.units[unitId];
  if (!u || !Array.isArray(u.presets) || !u.presets.length) return;
  if (u.presets.length > PRESET_COUNT) u.presets.length = PRESET_COUNT;
  if (!Number.isInteger(u.preset) || u.preset < 0 || u.preset >= u.presets.length) u.preset = 0;
  u.presets.forEach((pr, n) => {
    if (n === u.preset) return;
    delete pr.wish;
    for (const s of SLOT_IDS) {
      if (pr[s] && !(p.gear[pr[s]] && p.gear[pr[s]].slot === s)) {
        pr[s] = null;
        pr.gone = 1;
      }
      // a loadout she took off keeps its `lent` claim while another girl wears (or nobody wears) the piece it names
      // (review r4 M1); the claim ends when the slot no longer names it, the piece is gone, or she wears it
      const bit = bitOf(s);
      if ((pr.lent | 0) & bit && (!pr[s] || u.gear?.[s] === pr[s])) clearBit(pr, 'lent', bit);
    }
  });
  u.presets[u.preset] = wornLoadout(p, unitId, u.presets[u.preset]);
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
    const n = p.units[id]?.presets ? p.units[id].preset || 0 : 0;
    if (n > 0) use[id] = n;
  }
  team.use = use;
}

/** Fold the formation and the worn gear back into the teams and loadouts that exist (every write, every switch). */
export function syncTeams(p) {
  if (!p?.units || !p.gear) return [];
  // a lent piece its borrower let go goes home first (settleLent), then every worn loadout follows what she wears
  const returns = settleLent(p);
  for (const id of Object.keys(p.units)) foldGear(p, id);
  if (!isObj(p.teams) || !Array.isArray(p.teams.list) || !p.teams.list.length) return returns;
  if (!Number.isInteger(p.teams.active) || p.teams.active < 0 || p.teams.active >= p.teams.list.length) p.teams.active = 0;
  foldFormation(p);
  return returns;
}

// ---------------------------------------------------------------------------
// Lending (M1 reviews r1 H1, r2 H1/M1): one way, one owner
// ---------------------------------------------------------------------------

const bitOf = (slot) => 1 << SLOT_IDS.indexOf(slot);
const wornOf = (p, id) => {
  const u = p.units[id];
  return Array.isArray(u?.presets) && u.presets.length ? u.presets[u.preset || 0] : null;
};
const setBit = (w, key, bit) => { w[key] = (w[key] | 0) | bit; };
const clearBit = (w, key, bit) => {
  if (!w?.[key]) return;
  w[key] &= ~bit;
  if (!w[key]) delete w[key];
};

/** The girl a piece was lent by (her worn loadout's `lent` flag names it), or null. Unit ids in order: one answer. */
export function lenderOf(p, uid) {
  const g = p.gear?.[uid];
  if (!g) return null;
  // (any of her loadouts: a loadout she took off keeps its claim, review r4 M1)
  for (const id of Object.keys(p.units).sort()) {
    for (const pr of p.units[id]?.presets || []) if (pr[g.slot] === uid && ((pr.lent | 0) & bitOf(g.slot))) return id;
  }
  return null;
}

/**
 * Lent pieces go home: a piece a girl lent (her worn loadout's `lent` flag) goes back on her, in the same operation,
 * when its borrower lets it go (it is spare: an unequip, another loadout, a salvage guard) or, on a team switch
 * (`members`: the new active team), when no member of the new team wears it. The borrower keeps a `wish` (no claim:
 * only her loadout or team being put on takes it again). A lender who wears another piece in that slot let it go; a
 * piece that is gone frees the flag. Lenders in unit-id order and each piece once, so the result never depends on
 * the save's key order, and a returned piece never travels back in the same pass.
 * @returns {{ uid, slot, from: string|null, to: string }[]}
 */
export function settleLent(p, members = null) {
  const out = [];
  const seen = new Set();
  for (const id of Object.keys(p.units).sort()) {
    const u = p.units[id];
    const w = wornOf(p, id);
    if (!w?.lent) continue;
    for (const slot of SLOT_IDS) {
      const bit = bitOf(slot);
      if (!(w.lent & bit)) continue;
      const uid = w[slot];
      const g = uid ? p.gear[uid] : null;
      if (!g || g.slot !== slot || seen.has(uid) || g.equippedBy === id || (u.gear?.[slot] && u.gear[slot] !== uid)) {
        clearBit(w, 'lent', bit);
        if (!g) w[slot] = null;
        continue;
      }
      seen.add(uid);
      const b = g.equippedBy;
      if (b && (!members || members.has(b))) continue; // still lent: its borrower wears it
      if (b) {
        const bw = wornOf(p, b);
        if (bw && bw[slot] === uid) setBit(bw, 'wish', bit);
      }
      equipGear(p, id, uid);
      clearBit(w, 'lent', bit);
      out.push({ uid, slot, from: b || null, to: id });
    }
  }
  return out;
}

/** The pieces her worn loadout has lent to other girls: [{ uid, slot, to }] (the "lent to Kage" note). */
export function lentPieces(p, unitId) {
  const w = wornOf(p, unitId);
  if (!w?.lent) return [];
  return SLOT_IDS.filter((s) => (w.lent & bitOf(s)) && w[s] && p.gear[w[s]]?.equippedBy && p.gear[w[s]].equippedBy !== unitId)
    .map((s) => ({ uid: w[s], slot: s, to: p.gear[w[s]].equippedBy }));
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * The 5 teams, synced, for the screens. A save that has never used teams gets a view (nothing is written): Team 1 =
 * the formation, the rest empty.
 */
export function getTeams(p) {
  syncTeams(p);
  if (isObj(p.teams) && Array.isArray(p.teams.list) && p.teams.list.length) {
    const list = p.teams.list.slice(0, TEAM_COUNT);
    for (let i = list.length; i < TEAM_COUNT; i++) list.push(emptyTeam(i));
    return { active: p.teams.active, list };
  }
  const first = { ...emptyTeam(0), ...cleanSquad(p, p.formation?.hero, p.formation?.towers) };
  for (const id of teamMembers(first)) if (p.units[id]?.presets && p.units[id].preset > 0) first.use[id] = p.units[id].preset;
  return { active: 0, list: [first, ...Array.from({ length: TEAM_COUNT - 1 }, (_, i) => emptyTeam(i + 1))] };
}

/** Her loadouts, synced (a girl who never used loadouts: one, A, what she wears). */
export function getPresets(p, unitId) {
  syncTeams(p);
  const u = p.units[unitId];
  if (!u) return { presets: [emptySlots()], preset: 0 };
  return Array.isArray(u.presets) && u.presets.length ? { presets: u.presets, preset: u.preset || 0 } : { presets: [{ ...emptySlots(), ...u.gear }], preset: 0 };
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
      // (her worn loadout too when it lent the piece: it is hers, wherever it is)
      if (pr[g.slot] === uid && (n !== u.preset || ((pr.lent | 0) & bitOf(g.slot)))) out.push({ unitId: id, n });
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
    if (!p.units[unitId]) continue;
    const { presets } = getPresets(p, unitId);
    const pr = presets[n] || presets[0];
    const slots = [];
    for (const s of SLOT_IDS) {
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
    steps.push({ unitId, n: presets[n] ? n : 0, slots });
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
    if (!p.units[id]) continue;
    const { presets } = getPresets(p, id);
    const pr = presets[teamUse(team, id)] || presets[0];
    for (const s of SLOT_IDS) if (pr[s] && p.gear[pr[s]]) named.set(pr[s], [...(named.get(pr[s]) || []), id]);
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
    units: Object.fromEntries(Object.entries(p.units).map(([id, u]) => [id, { gear: u.gear, presets: u.presets ?? null, preset: u.preset ?? 0 }])),
    wearers: Object.fromEntries(Object.entries(p.gear).map(([uid, g]) => [uid, g.equippedBy || null])),
    teams: p.teams ?? null,
    formation: p.formation,
  }));
}

/** Put a snapshot back. Pieces salvaged since stay gone (their slots empty). */
export function restoreLoadouts(p, snap) {
  if (!snap) return false;
  for (const [id, s] of Object.entries(snap.units)) {
    const u = p.units[id];
    if (!u) continue;
    u.gear = emptySlots();
    for (const k of SLOT_IDS) u.gear[k] = s.gear?.[k] && p.gear[s.gear[k]] ? s.gear[k] : null;
    if (s.presets) {
      u.presets = s.presets;
      u.preset = s.preset;
    } else {
      delete u.presets;
      delete u.preset;
    }
  }
  for (const [uid, g] of Object.entries(p.gear)) g.equippedBy = uid in snap.wearers ? snap.wearers[uid] : g.equippedBy;
  // a wearer must still name the piece (and a girl only wears what names her)
  for (const g of Object.values(p.gear)) if (g.equippedBy && p.units[g.equippedBy]?.gear?.[g.slot] !== g.uid) g.equippedBy = null;
  for (const [id, u] of Object.entries(p.units)) for (const s of SLOT_IDS) if (u.gear[s] && p.gear[u.gear[s]]?.equippedBy !== id) u.gear[s] = null;
  if (snap.teams) p.teams = snap.teams;
  else delete p.teams;
  p.formation = snap.formation;
  syncTeams(p);
  return true;
}

// ---------------------------------------------------------------------------
// Switching
// ---------------------------------------------------------------------------

function applyStep(p, step) {
  const u = p.units[step.unitId];
  ensurePresets(p, step.unitId);
  for (const { slot, uid } of step.slots) {
    if (uid) {
      // one-way lending (M1 review r2): taken from a girl who owns it, she becomes its lender; taken back by its
      // lender, the borrower keeps only a wish; passed on by a borrower, the lender stays the lender
      const from = p.gear[uid]?.equippedBy;
      if (from && from !== step.unitId) {
        const lender = lenderOf(p, uid);
        ensurePresets(p, from);
        const fw = wornOf(p, from);
        const bit = bitOf(slot);
        if (lender === step.unitId) {
          if (fw && fw[slot] === uid) setBit(fw, 'wish', bit);
        } else if (lender) {
          if (fw && fw[slot] === uid) setBit(fw, 'wish', bit);
        } else if (fw) {
          fw[slot] = uid;
          setBit(fw, 'lent', bit);
          clearBit(fw, 'wish', bit);
        }
      }
      if (u.gear[slot] !== uid) equipGear(p, step.unitId, uid);
    } else if (u.gear[slot]) unequipGear(p, step.unitId, slot);
  }
  // a loadout she takes off keeps its `lent` claims (review r4 M1; foldGear ends them), never a wish
  if (u.preset !== step.n && u.presets[u.preset]) delete u.presets[u.preset].wish;
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
  const count = getPresets(p, unitId).presets.length;
  if (!Number.isInteger(n) || n < 0 || n >= PRESET_COUNT || n > count) return { ok: false, error: 'badLoadout' };
  const undo = snapshotLoadouts(p);
  ensurePresets(p, unitId);
  let created = false;
  if (n === u.presets.length) {
    u.presets.push({ ...u.presets[u.preset] });
    delete u.presets[n].gone;
    delete u.presets[n].lent; // (a copy names her pieces; it carries no claims)
    delete u.presets[n].wish;
    created = true;
  }
  const plan = planPreset(p, unitId, n);
  for (const step of plan.steps) applyStep(p, step);
  const returns = syncTeams(p);
  return { ok: true, takes: plan.takes, created, returns, undo };
}

/**
 * Make team t the active team: the formation becomes its squad and every member puts on the loadout the team
 * remembers (the first in team order gets a piece two of them name).
 * @returns {{ ok: boolean, error?: string, takes?: object[], clashes?: object[], undo?: object }}
 */
export function selectTeam(p, t) {
  if (!Number.isInteger(t) || t < 0 || t >= TEAM_COUNT) return { ok: false, error: 'badTeam' };
  const undo = snapshotLoadouts(p);
  if (t === getTeams(p).active) return { ok: true, takes: [], clashes: [], returns: [], undo };
  ensureTeams(p);
  if (t === p.teams.active) return { ok: true, takes: [], clashes: [], returns: [], undo };
  const team = p.teams.list[t];
  // the loadouts the team remembers, read before it becomes active (from then on it follows what they wear)
  const wants = teamMembers(team).map((id) => ({ unitId: id, n: teamUse(team, id) }));
  p.teams.active = t;
  p.formation = { hero: team.hero, towers: team.towers.slice() };
  const plan = planLoadouts(p, wants);
  for (const step of plan.steps) applyStep(p, step);
  const returns = settleLent(p, new Set(teamMembers(team)));
  returns.push(...syncTeams(p));
  return { ok: true, takes: plan.takes, clashes: plan.clashes, returns, undo };
}


/** Copy team `from` into the first empty team. @returns {number} its index, or -1 when every team has girls */
export function copyTeam(p, from) {
  const teams = ensureTeams(p);
  const src = teams.list[from];
  if (!src) return -1;
  const to = teams.list.findIndex((tm, i) => i !== from && !teamMembers(tm).length);
  if (to < 0) return -1;
  teams.list[to] = { name: teams.list[to].name || defaultName(to), hero: src.hero, towers: src.towers.slice(), use: { ...src.use } };
  return to;
}

/** Empty team t (the active team empties the formation too). */
export function clearTeam(p, t) {
  const teams = ensureTeams(p);
  if (!teams.list[t]) return false;
  teams.list[t] = { ...emptyTeam(t), name: teams.list[t].name || defaultName(t) };
  if (t === teams.active) p.formation = { hero: null, towers: [] };
  syncTeams(p);
  return true;
}

/** Rename team t on this device ('' gives "Team N" back). */
export function renameTeam(p, t, name) {
  const teams = ensureTeams(p);
  if (!teams.list[t]) return false;
  teams.list[t].name = String(name ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, TEAM_NAME_MAX) || defaultName(t);
  return true;
}

/**
 * Copy her loadout `from` into `to` (to = her loadout count adds one). Copying into the loadout she wears puts it on.
 * @returns {{ ok: boolean, error?: string, takes?: object[], undo?: object }}
 */
export function copyPreset(p, unitId, from, to) {
  const u = p.units[unitId];
  if (!u) return { ok: false, error: 'notOwned' };
  const undo = snapshotLoadouts(p);
  ensurePresets(p, unitId);
  // (into the loadout she wears: refused, the fold would put back what she wears; the UI copies into the next one)
  if (!u.presets[from] || from === to || to === u.preset || to < 0 || to >= PRESET_COUNT || to > u.presets.length) return { ok: false, error: 'badLoadout' };
  const copy = { ...u.presets[from] };
  delete copy.gone;
  delete copy.lent;
  delete copy.wish;
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
