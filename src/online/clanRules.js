// Pure clan rules shared by both backend adapters, the UI and tests: roles and permissions,
// clan level from XP, the weekly clan boss, reward tiers and the offline test backend's developer clan code.
// (supabase/migrations/*_online.sql mirrors the numbers marked "SQL".)
import { nameLooksBlank, nameKey, nameWords, nameCamel, mixesLookalikes, MESSAGE_INVISIBLE, VISIBLE_CHAR, COMBINING_RUN } from './textRules.js';

export const ROLES = ['leader', 'officer', 'member'];
export const ROLE_NAMES = { leader: 'Leader', officer: 'Officer', member: 'Member' };
/** SQL: clans.max_members default. */
export const CLAN_MAX_MEMBERS = 30;
export const JOIN_MODES = { open: 'Open', request: 'By request', code: 'Invite code' };
/**
 * The developer clan's join code for the OFFLINE TEST BACKEND ONLY (adapters/localDb.js, which
 * keeps everything in this browser), and only in dev builds and tests. It is public on purpose
 * and opens nothing on the live server: the live developer clan's code is set by the owner in
 * the database (docs/ONLINE.md, "Rotate the developer clan code") and is never in the repo.
 */
export const LOCAL_DEV_CODE = 'LOCAL-DEV-LAB';
export const DEV_CLAN = Object.freeze({ name: 'Sakura Dev Lab', tag: 'DEV', emblem: 'wiki', description: 'Developer sandbox. The Supply Bot here grants any item — for testing only.' });
/**
 * Emblems a player clan may pick = existing illustrated lobby icon names (src/art/lobbyIcons.js).
 * 'wiki' is the developer clan's (RESERVED_EMBLEMS): the picker never offers it and the server
 * refuses it for new clans (SQL clans_text_rules); old clans that took it keep it.
 */
export const EMBLEMS = ['assault', 'gems', 'recruit', 'students', 'formation', 'bestiary', 'mall', 'gift', 'chest', 'tasks', 'calendar'];
export const RESERVED_EMBLEMS = ['wiki'];
/** Tags of staff and of the developer clan, digits read as letters ('D3V', 'M0D'). SQL: reserved_clan_tag(). */
export const RESERVED_TAGS = ['DEV', 'DEVS', 'GM', 'GMS', 'MOD', 'MODS', 'ADM', 'ADMN', 'ADMI', 'STAF', 'SYS', 'SYST', 'BOT', 'BOTS'];

/** SQL btrim() / trim(): ASCII spaces only (a fullwidth space at an edge stays and is refused). */
const trimSpaces = (x) => String(x ?? '').replace(/^ +| +$/g, '');
/** SQL valid_dm_body(): no invisible characters, something visible, at most 4 stacked marks. */
const textOk = (x) => !MESSAGE_INVISIBLE.test(x) && VISIBLE_CHAR.test(x) && !COMBINING_RUN.test(x);

/**
 * A new clan (SQL: the clans check constraints + the social migration's clans_text_rules trigger):
 * a name of 3–20 characters with visible letters (the DM text rule: no zero-width or right-to-left
 * tricks), Latin letters not mixed with look-alike ones ('ᎠEV Lab': mixesLookalikes), not reserved
 * and not staff-looking (reservedClanName), a tag of 2–4 A–Z / 0–9 that is
 * not reserved, no 'wiki' emblem, a description of at most 140 characters with no invisible
 * characters. (A look-alike of an existing clan's name is refused by the server / localDb.)
 */
export function validateClan({ name, tag, emblem = 'assault', description = '' } = {}) {
  const n = String(name ?? '').trim();
  const t = String(tag ?? '').trim().toUpperCase();
  if (n.length < 3 || n.length > 20) return 'Clan names are 3–20 characters.';
  if (!/^[A-Z0-9]{2,4}$/.test(t)) return 'Tags are 2–4 letters or digits.';
  if (String(description ?? '').length > 140) return 'Keep the description under 140 characters.';
  const raw = trimSpaces(name);
  if (/[<>]/.test(raw) || !textOk(raw) || nameLooksBlank(raw)) return 'Clan names need visible letters.';
  if (mixesLookalikes(raw)) return 'Clan names can\'t mix in look-alike letters from other alphabets.';
  if (reservedClanName(raw)) return 'That clan name is reserved.';
  if (reservedClanTag(t)) return 'That tag is reserved.';
  if (RESERVED_EMBLEMS.includes(emblem)) return 'That emblem is reserved.';
  const d = trimSpaces(String(description ?? '').slice(0, 140));
  if (d && !textOk(d)) return 'Clan descriptions can\'t contain invisible characters.';
  return null;
}

/**
 * Names nobody may take: they would pass for a system notice, the developer bot or staff
 * (compared by nameKey(): without case, spaces, punctuation or accents, with fullwidth letters and
 * Cyrillic / Greek look-alikes mapped to Latin — "Supply-Bot", "Ѕystem", "Ｓｙｓｔｅｍ" all count).
 * SQL: valid_display_name() + reserved_name() of the social migration.
 */
export const RESERVED_NAMES = ['system', 'supplybot', 'admin', 'administrator', 'moderator', 'mod', 'developer', 'dev', 'staff', 'official', 'gm', 'sakurasentinels', 'sakuradevlab'];
/** Staff words refused anywhere in a name ('Staff Hana', 'Adm1n', 'SupplyB0t'). SQL: reserved_name(). */
export const RESERVED_PARTS = ['admin', 'moderator', 'staff', 'official', 'developer', 'supplybot', 'system', 'sakurasentinel', 'devlab'];
/** Refused as a word of their own ('GM Rosie', 'Dev Rosie', 'D.E.V. Team', 'GMRosie'; 'Devi', 'Devon', 'Modé' are fine). SQL: reserved_name(). */
export const RESERVED_WORDS = ['gm', 'gms', 'dev', 'devs', 'mod', 'mods'];
/** Digits read as letters (SQL translate(…, '013457', 'oieast') and, for 1, 'oleast' too). */
const asLetters = (x, one = 'i') => x.replace(/[013457]/g, (d) => ({ 0: 'o', 1: one, 3: 'e', 4: 'a', 5: 's', 7: 't' })[d]);

/**
 * Is this name reserved (SQL reserved_name())? A reserved name itself (by nameKey), a staff word
 * anywhere in it with digits read as letters ('badminton' is no 'admin'), or gm / dev / mod as a
 * word of its own — in the words as written or split where the case starts a word ('GMRosie',
 * 'DevTeam'; 'dEV Rosie' is still 'dev rosie').
 */
export function reservedName(name) {
  const k = nameKey(name);
  if (RESERVED_NAMES.includes(k)) return true;
  const part = k.replaceAll('badminton', '');
  if (RESERVED_PARTS.some((w) => asLetters(part).includes(w) || asLetters(part, 'l').includes(w))) return true;
  const word = (w) => RESERVED_WORDS.includes(w);
  return asLetters(nameWords(name)).split(' ').some(word) || asLetters(nameWords(nameCamel(name))).split(' ').some(word);
}

/** A clan name nobody may take (SQL reserved_clan_name()): a reserved name, or one that reads as the developer clan. */
export function reservedClanName(name) {
  return reservedName(name) || /sakura.*dev/.test(asLetters(nameKey(name)));
}

/** SQL reserved_clan_tag(). */
export function reservedClanTag(tag) {
  return RESERVED_TAGS.includes(String(tag ?? '').trim().toUpperCase().replace(/[013457]/g, (d) => 'OIEAST'['013457'.indexOf(d)]));
}
const INVISIBLE = /[\p{Cf}\p{Cc}]/u; // bidi overrides, zero-width joiners, soft hyphens, control characters

/**
 * Display names: 2–16 characters (SQL: valid_display_name(), the profiles.name check) that look
 * like a name — visible letters, no blank fillers or stacked accents (SQL visible_name(), the
 * social migration's profiles_name_rules trigger), Latin letters not mixed with look-alike ones
 * (SQL lookalike_mix()) — and no reserved name or look-alike of one.
 */
export function validateName(name) {
  const n = String(name ?? '').trim();
  if (n.length < 2 || n.length > 16) return 'Names are 2–16 characters.';
  if (/[<>]/.test(n)) return 'Names cannot contain < or >.';
  if (INVISIBLE.test(n)) return 'Names cannot contain invisible or control characters.';
  if (nameLooksBlank(n)) return 'Names need visible letters.';
  if (mixesLookalikes(n)) return 'Names can\'t mix in look-alike letters from other alphabets.';
  if (reservedName(n)) return 'That name is reserved.';
  return null;
}

/**
 * The automatic name of a new account before the player picks one: "Sensei" + 4 digits taken
 * from the account id (stable for that account, digits only so it reads as a number).
 * @param {string} uid
 */
export function autoName(uid) {
  let h = 0;
  for (const ch of String(uid)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return `Sensei${1000 + (h % 9000)}`;
}

/** Chat message bodies: 1–200 characters (SQL: messages.body). */
export const MESSAGE_MAX = 200;
/** Co-op invite payload: only the room code and the stage id, at most this many bytes (SQL: valid_message_meta()). */
export const INVITE_META_MAX = 256;

/** A recruiting post's clan card, at most this many bytes (SQL: valid_message_meta(), 20261018000000_clan_invites.sql). */
export const RECRUIT_META_MAX = 512;
const RECRUIT_KEYS = ['clan', 'tag', 'name', 'emblem', 'members', 'max', 'mode', 'level'];
const numIn = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/**
 * The `meta` a chat message may carry (SQL: valid_message_meta(), the messages check):
 * none on text, on an invite exactly { room: 5 letters/digits, stage?: up to 16 characters }, and on
 * a clan recruiting post exactly { clan, tag, name, emblem, members, max, mode, level } (the server
 * writes it from the clan row).
 * @returns {boolean}
 */
export function validMessageMeta(kind, meta) {
  if (kind === 'recruit') {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
    if (Object.keys(meta).some((k) => !RECRUIT_KEYS.includes(k))) return false;
    if (typeof meta.clan !== 'string' || !/^[0-9a-z-]{1,36}$/.test(meta.clan)) return false;
    if (typeof meta.tag !== 'string' || !/^[A-Z0-9]{2,4}$/.test(meta.tag)) return false;
    if (typeof meta.name !== 'string' || meta.name.length < 1 || meta.name.length > 20) return false;
    if (typeof meta.emblem !== 'string' || meta.emblem.length > 24) return false;
    if (!numIn(meta.members, 0, 1000) || !numIn(meta.max, 1, 1000) || !numIn(meta.level, 1, 20)) return false;
    if (!['open', 'request', 'code'].includes(meta.mode)) return false;
    return JSON.stringify(meta).length <= RECRUIT_META_MAX;
  }
  if (kind !== 'invite') return meta == null;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  if (Object.keys(meta).some((k) => k !== 'room' && k !== 'stage')) return false;
  if (typeof meta.room !== 'string' || !/^[A-Z0-9]{5}$/.test(meta.room)) return false;
  if ('stage' in meta && (typeof meta.stage !== 'string' || meta.stage.length > 16)) return false;
  return JSON.stringify(meta).length <= INVITE_META_MAX;
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

/**
 * Weekly bosses rotate through the Total Assault arenas. hitCap (SQL: boss_hit_cap()) is the most
 * damage one attempt can count: a full clear of that arena by a maxed team deals ~150k (lych),
 * ~197k (colossus) and ~167k (ashwing) — tests/online/clanBoss.test.js measures it with the sim —
 * plus ~15% headroom. Battle damage comes from the player's own client, so this cap, the
 * started-attempt check and the pool size below are what keep a forged number from ending the week.
 */
export const CLAN_BOSSES = [
  { id: 'lych', name: 'Grave Lych', stageId: 'boss-lych', enemyId: 'grave_lych', theme: 'night', hitCap: 175000 },
  { id: 'colossus', name: 'Iron Colossus', stageId: 'boss-colossus', enemyId: 'iron_colossus', theme: 'forge', hitCap: 230000 },
  { id: 'ashwing', name: 'Ashwing Matriarch', stageId: 'boss-ashwing', enemyId: 'dragon_ashwing', theme: 'summit', hitCap: 195000 },
];
/**
 * SQL: submit_boss_damage. One attempt earns its full cap only after this many real seconds
 * (less time → a proportional share): the fastest full clear measured is ~180 s of game time,
 * i.e. ~60 s at 3× speed.
 */
export const BOSS_FULL_RUN_SECONDS = 50;
/** SQL: submit_boss_damage. A battle shorter than this counts nothing (and uses no attempt). */
export const BOSS_MIN_SECONDS = 10;
/** SQL: ensure_boss(). The weekly pool = hitCap × this × max(BOSS_MIN_MEMBERS, members) × level bonus. */
export const BOSS_POOL_ATTEMPTS = 3;
export const BOSS_MIN_MEMBERS = 2;
/** SQL: attempts per player per rolling 24 h (a scored submit uses one; starting a battle does not). */
export const BOSS_HITS_PER_DAY = 3;
/** SQL: an attempt left open longer than this cannot be scored any more. */
export const BOSS_ATTEMPT_TTL_MS = 2 * 3600 * 1000;

/** @returns {number} the most damage one attempt on `bossId` can count */
export function bossHitCap(bossId) {
  return CLAN_BOSSES.find((b) => b.id === bossId)?.hitCap || 0;
}

/**
 * Damage an attempt may count after `seconds` of battle (SQL: submit_boss_damage).
 * @param {string} bossId
 * @param {number} seconds since start_boss_attempt
 */
export function bossAllowance(bossId, seconds) {
  if (!(seconds >= BOSS_MIN_SECONDS)) return 0;
  return Math.floor(bossHitCap(bossId) * Math.min(1, seconds / BOSS_FULL_RUN_SECONDS));
}

/** @returns {{ id, name, stageId, enemyId, theme, hitCap, maxHp }} the boss for a week key */
export function bossFor(week, clanLevel = 1, members = BOSS_MIN_MEMBERS) {
  const n = Number(String(week).split('-W')[1]) || 0;
  const b = CLAN_BOSSES[n % CLAN_BOSSES.length];
  return { ...b, maxHp: bossMaxHp(clanLevel, members, b.id) };
}
/** SQL: ensure_boss(). The shared HP pool: +20% per clan level, scaled by the member count. */
export function bossMaxHp(clanLevel = 1, members = BOSS_MIN_MEMBERS, bossId = CLAN_BOSSES[0].id) {
  const people = Math.max(BOSS_MIN_MEMBERS, Math.floor(members) || 0);
  return Math.round(bossHitCap(bossId) * BOSS_POOL_ATTEMPTS * people * (1 + 0.2 * (Math.max(1, clanLevel) - 1)));
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
