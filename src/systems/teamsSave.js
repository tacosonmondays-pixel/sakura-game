// Saved teams and gear loadouts in the save (docs/specs/GEAR_UPDATE.md §7.4, §7.5, §9.2): the reader's half. The
// screens and the switching rules come with teams and loadouts (M1); this file only keeps the two blocks, makes them
// agree with what the save already says, and mirrors them so an older build that drops them cannot lose them.
//
//   profile.teams = { active: 0…4, list: [{ name, hero, towers, use: { [unitId]: 0…2 } }] }   (1–5 teams)
//   unit.presets  = [{ charm, ribbon, shoes, hair, necklace }] (1–3 loadouts) and unit.preset (the active one)
//
// Present fields win: an older build can change `profile.formation` and `unit.gear` while it drops `teams` and
// `presets`, so on load the formation becomes the active team and what she wears becomes her active loadout.
// Mirrors (missions.counters; custom team names are not mirrored):
//   tm:a                active team + 10 × team count
//   tm:<t>:<unitId>     1 + her place (0 the hero, 1… the students in order) + 10 × the loadout the team gives her
//   gp:<unitId>         1 + active loadout + 10 × loadout count
//   gp:<unitId>:<n>:<slot>  the number of the piece loadout n names in that slot (gear uid 'g<n>')
// Pure functions on the profile; nothing here is co-op hashed.

import { UNIT_MAP } from '../data/units.js';
import { BATTLE } from '../data/types.js';
import { SLOT_IDS, emptySlots } from '../data/gearSlots.js';
import { MARK } from '../data/gearAwaken.js';

export const TEAMS_MAX = 5;
export const PRESETS_MAX = 3;
const NAME_MAX = 16;

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const index = (v, max) => (Number.isInteger(v) && v >= 0 && v < max ? v : 0);
const gearNumber = (uid) => {
  const m = typeof uid === 'string' ? /^g([1-9]\d{0,14})$/.exec(uid) : null;
  return m ? Number(m[1]) : 0;
};
const teamName = (i) => `Team ${i + 1}`;

/**
 * Her gear loadouts as stored: up to 3, each a piece uid (or null) per slot. Pieces are checked against the bag in
 * restoreTeams, once the gear is clean.
 * @returns {{}|{ presets: object[], preset: number }}
 */
export function cleanPresets(raw, rawPreset) {
  if (!Array.isArray(raw) || !raw.length) return {};
  const presets = raw.slice(0, PRESETS_MAX).map((l) => {
    const out = emptySlots();
    if (isObj(l)) for (const s of SLOT_IDS) out[s] = typeof l[s] === 'string' ? l[s] : null;
    // [M1] the red dot: a piece this loadout named was salvaged (teams.js; never mirrored)
    if (isObj(l) && (l.gone === 1 || l.gone === true)) out.gone = 1;
    return out;
  });
  return { presets, preset: index(rawPreset, presets.length) };
}

/** One team: an owned hero (or none) and up to 8 owned students, unique; `use` only for its members. */
function cleanTeam(raw, units, i) {
  const t = isObj(raw) ? raw : {};
  const hero = typeof t.hero === 'string' && units[t.hero] && UNIT_MAP[t.hero]?.kind === 'hero' ? t.hero : null;
  const towers = [...new Set(Array.isArray(t.towers) ? t.towers : [])].filter((id) => typeof id === 'string' && units[id] && UNIT_MAP[id]?.kind === 'tower').slice(0, BATTLE.maxTowers);
  const use = {};
  if (isObj(t.use)) for (const id of [hero, ...towers]) if (id && Number.isInteger(t.use[id]) && t.use[id] > 0 && t.use[id] < PRESETS_MAX) use[id] = t.use[id];
  const name = typeof t.name === 'string' && t.name.trim() ? t.name.trim().slice(0, NAME_MAX) : teamName(i);
  return { name, hero, towers, use };
}

/** @returns {null|{ active: number, list: object[] }} the saved teams, or null when the save has none */
export function cleanTeams(raw, units) {
  if (!isObj(raw) || !Array.isArray(raw.list) || !raw.list.length) return null;
  const list = raw.list.slice(0, TEAMS_MAX).map((t, i) => cleanTeam(t, units, i));
  return { active: index(raw.active, list.length), list };
}

/** Teams back from the 'tm:' mirrors (an older build dropped the block). */
function teamsFromMarks(c, units) {
  const a = whole(c[`${MARK.team}a`]);
  if (!a) return null;
  const count = Math.min(TEAMS_MAX, Math.max(1, Math.floor((a - 1) / 10)));
  const list = Array.from({ length: count }, (_, i) => ({ name: teamName(i), hero: null, towers: [], use: {} }));
  const places = list.map(() => []);
  for (const [k, v] of Object.entries(c)) {
    const m = /^tm:(\d):([a-z][a-z0-9_]{0,23})$/.exec(k);
    const n = whole(v);
    if (!m || !n || Number(m[1]) >= count || !units[m[2]]) continue;
    places[Number(m[1])].push({ id: m[2], at: (n - 1) % 10, use: Math.floor((n - 1) / 10) });
  }
  places.forEach((ps, i) => {
    ps.sort((x, y) => x.at - y.at || x.id.localeCompare(y.id));
    const raw = { hero: ps.find((x) => x.at === 0)?.id ?? null, towers: ps.filter((x) => x.at > 0).map((x) => x.id), use: Object.fromEntries(ps.map((x) => [x.id, x.use])) };
    list[i] = cleanTeam(raw, units, i);
  });
  return { active: index(((a - 1) % 10), count), list };
}

/** Her loadouts back from the 'gp:' mirrors. */
function presetsFromMarks(c, unitId) {
  const v = whole(c[`${MARK.preset}${unitId}`]);
  if (!v) return null;
  const count = Math.min(PRESETS_MAX, Math.max(1, Math.floor((v - 1) / 10)));
  const presets = Array.from({ length: count }, (_, n) => {
    const out = emptySlots();
    for (const s of SLOT_IDS) {
      const g = whole(c[`${MARK.preset}${unitId}:${n}:${s}`]);
      if (g) out[s] = `g${g}`;
    }
    return out;
  });
  return { presets, preset: index((v - 1) % 10, count) };
}

/** Rewrite the 'tm:' and 'gp:' mirrors from the profile (nothing for a save without teams or loadouts). */
export function writeTeamMarks(p) {
  const c = ((p.missions ||= {}).counters ||= {});
  for (const k of Object.keys(c)) if (k.startsWith(MARK.team) || k.startsWith(MARK.preset)) delete c[k];
  if (p.teams?.list?.length) {
    c[`${MARK.team}a`] = 1 + p.teams.active + 10 * p.teams.list.length;
    p.teams.list.forEach((t, i) => {
      [t.hero, ...t.towers].forEach((id, at) => {
        if (id) c[`${MARK.team}${i}:${id}`] = 1 + at + 10 * (t.use?.[id] || 0);
      });
    });
  }
  for (const [id, u] of Object.entries(p.units || {})) {
    if (!Array.isArray(u.presets) || !u.presets.length) continue;
    c[`${MARK.preset}${id}`] = 1 + (u.preset || 0) + 10 * u.presets.length;
    u.presets.forEach((l, n) => {
      for (const s of SLOT_IDS) {
        const g = gearNumber(l[s]);
        if (g) c[`${MARK.preset}${id}:${n}:${s}`] = g;
      }
    });
  }
}

/**
 * Runs in migrateProfile once gear, units, the formation and missions are clean: teams and loadouts an older build
 * dropped come back from their mirrors; present fields win; loadouts name only pieces of their slot still in the bag;
 * then the mirrors are rewritten. Idempotent.
 */
export function restoreTeams(p) {
  const c = ((p.missions ||= {}).counters ||= {});
  if (!p.teams) {
    const t = teamsFromMarks(c, p.units);
    if (t) p.teams = t;
  }
  if (p.teams) {
    const team = p.teams.list[p.teams.active];
    team.hero = p.formation.hero;
    team.towers = [...p.formation.towers];
    for (const id of Object.keys(team.use)) if (id !== team.hero && !team.towers.includes(id)) delete team.use[id];
  }
  for (const [id, u] of Object.entries(p.units)) {
    if (!u.presets) {
      const back = presetsFromMarks(c, id);
      if (back) Object.assign(u, back);
    }
    if (!u.presets) continue;
    for (const l of u.presets) {
      for (const s of SLOT_IDS) {
        if (l[s] && p.gear[l[s]]?.slot !== s) {
          l[s] = null;
          l.gone = 1; // [M1] the red dot on its chip
        }
      }
    }
    u.presets[u.preset] = { ...emptySlots(), ...u.gear }; // (the one she wears: no red dot)
  }
  writeTeamMarks(p);
}
