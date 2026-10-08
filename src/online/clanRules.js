// Pure clan rules shared by both backend adapters, the UI and tests: roles and permissions,
// clan level from XP, the weekly clan boss, reward tiers and the developer clan code.
// (supabase/schema.sql mirrors the numbers marked "SQL".)

export const ROLES = ['leader', 'officer', 'member'];
export const ROLE_NAMES = { leader: 'Leader', officer: 'Officer', member: 'Member' };
/** SQL: clans.max_members default. */
export const CLAN_MAX_MEMBERS = 30;
export const JOIN_MODES = { open: 'Open', request: 'By request', code: 'Invite code' };
/** Developer clan join code (owner request): its members get the Supply Bot sandbox. */
export const DEV_CODE = 'Rosie777';
export const DEV_CLAN = Object.freeze({ name: 'Sakura Dev Lab', tag: 'DEV', emblem: 'wiki', description: 'Developer sandbox. The Supply Bot here grants any item — for testing only.' });
/** Emblems = existing illustrated lobby icon names (src/art/lobbyIcons.js). */
export const EMBLEMS = ['assault', 'gems', 'recruit', 'students', 'formation', 'bestiary', 'wiki', 'mall', 'gift', 'chest', 'tasks', 'calendar'];

/** Name 3–20 characters, tag 2–4 of A–Z / 0–9 (SQL check constraints). */
export function validateClan({ name, tag, description = '' } = {}) {
  const n = String(name ?? '').trim();
  const t = String(tag ?? '').trim().toUpperCase();
  if (n.length < 3 || n.length > 20) return 'Clan names are 3–20 characters.';
  if (!/^[A-Z0-9]{2,4}$/.test(t)) return 'Tags are 2–4 letters or digits.';
  if (String(description).length > 140) return 'Keep the description under 140 characters.';
  return null;
}

/** Display names: 2–16 characters (SQL: profiles.name). */
export function validateName(name) {
  const n = String(name ?? '').trim();
  if (n.length < 2 || n.length > 16) return 'Names are 2–16 characters.';
  if (/[<>]/.test(n)) return 'Names cannot contain < or >.';
  return null;
}

/**
 * What `role` may do. Leaders: everything. Officers: answer requests, kick members.
 * @param {'leader'|'officer'|'member'|null} role
 * @param {'answer'|'kick'|'setRole'|'edit'|'invite'} action
 * @param {'leader'|'officer'|'member'} [targetRole] role of the member acted upon
 */
export function can(role, action, targetRole = 'member') {
  if (!role) return false;
  switch (action) {
    case 'invite': return true;
    case 'answer': return role === 'leader' || role === 'officer';
    case 'kick': return role === 'leader' ? targetRole !== 'leader' : role === 'officer' && targetRole === 'member';
    case 'setRole':
    case 'edit': return role === 'leader';
    default: return false;
  }
}

/** XP needed to go from level `l` to `l + 1` (SQL: clan_level()). */
export function xpForLevel(l) {
  return 500 * l;
}
export const CLAN_MAX_LEVEL = 20;

/** @returns {{ level: number, into: number, need: number, pct: number }} */
export function levelFromXp(xp) {
  let level = 1;
  let rest = Math.max(0, Math.floor(Number(xp) || 0));
  while (level < CLAN_MAX_LEVEL && rest >= xpForLevel(level)) {
    rest -= xpForLevel(level);
    level++;
  }
  const need = level >= CLAN_MAX_LEVEL ? 0 : xpForLevel(level);
  return { level, into: rest, need, pct: need ? rest / need : 1 };
}

/** Clan XP sources (SQL: same constants in the RPCs). */
export const CLAN_XP = Object.freeze({ chat: 2, join: 20, bossHitBase: 50, bossPerDamage: 1 / 2000, bossHitMax: 500 });
export function bossHitXp(damage) {
  return Math.min(CLAN_XP.bossHitMax, CLAN_XP.bossHitBase + Math.floor(Math.max(0, damage) * CLAN_XP.bossPerDamage));
}

/**
 * ISO-8601 week key, e.g. '2026-W41' (weeks start Monday, UTC). SQL: to_char(now(), 'IYYY-"W"IW').
 * @param {Date|number} [date]
 */
export function weekKey(date = new Date()) {
  const d = new Date(typeof date === 'number' ? date : date.getTime());
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((thursday - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Week key of the week before `date` (last week's boss rewards stay claimable). */
export function prevWeekKey(date = Date.now()) {
  const t = typeof date === 'number' ? date : date.getTime();
  return weekKey(t - 7 * 86400000);
}

/** Milliseconds until the next Monday 00:00 UTC (boss reset). */
export function msToWeekReset(now = Date.now()) {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7;
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 7);
  return next - now;
}

/** Weekly bosses rotate through the Total Assault arenas. */
export const CLAN_BOSSES = [
  { id: 'lych', name: 'Grave Lych', stageId: 'boss-lych', enemyId: 'grave_lych', theme: 'night' },
  { id: 'colossus', name: 'Iron Colossus', stageId: 'boss-colossus', enemyId: 'iron_colossus', theme: 'forge' },
  { id: 'ashwing', name: 'Ashwing Matriarch', stageId: 'boss-ashwing', enemyId: 'dragon_ashwing', theme: 'summit' },
];
/** SQL: boss_max_hp(). Pool for a level-1 clan; +20% per clan level. One attempt deals ~5k–100k. */
export const BOSS_BASE_HP = 300000;
/** SQL: submit_boss_damage caps one attempt at this much damage. */
export const BOSS_HIT_CAP = 200000;
/** SQL: attempts per player per UTC day. */
export const BOSS_HITS_PER_DAY = 3;

/** @returns {{ id, name, stageId, enemyId, theme, maxHp }} the boss for a week key */
export function bossFor(week, clanLevel = 1) {
  const n = Number(String(week).split('-W')[1]) || 0;
  const b = CLAN_BOSSES[n % CLAN_BOSSES.length];
  return { ...b, maxHp: bossMaxHp(clanLevel) };
}
export function bossMaxHp(clanLevel = 1) {
  return Math.round(BOSS_BASE_HP * (1 + 0.2 * (Math.max(1, clanLevel) - 1)));
}

/** Reward tiers by leaderboard rank once the boss falls (or participation if it survives). */
export const BOSS_REWARDS = {
  S: [{ id: 'gems', count: 300 }, { id: 'token_boss', count: 20 }, { id: 'ticket_recruit', count: 2 }, { id: 'star_fragment', count: 10 }],
  A: [{ id: 'gems', count: 200 }, { id: 'token_boss', count: 14 }, { id: 'ticket_recruit', count: 1 }, { id: 'star_fragment', count: 6 }],
  B: [{ id: 'gems', count: 120 }, { id: 'token_boss', count: 10 }, { id: 'star_fragment', count: 3 }],
  C: [{ id: 'gems', count: 40 }, { id: 'token_boss', count: 4 }],
};

/**
 * @param {number} rank 1-based rank on the boss leaderboard (0 = not on it)
 * @param {number} damage this player's damage this week
 * @param {boolean} defeated the shared HP pool reached 0
 * @returns {'S'|'A'|'B'|'C'|null} null = nothing to claim
 */
export function rewardTier(rank, damage, defeated) {
  if (!(damage > 0) || !(rank >= 1)) return null;
  if (!defeated) return 'C';
  if (rank === 1) return 'S';
  if (rank <= 3) return 'A';
  return 'B';
}

/** "just now", "5 min ago", "3 h ago", "2 d ago" */
export function agoText(ts, now = Date.now()) {
  const s = Math.max(0, (now - new Date(ts).getTime()) / 1000);
  if (!Number.isFinite(s)) return '—';
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
