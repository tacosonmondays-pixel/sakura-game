// Sensei Profile: the client mirror of supabase/migrations/20261016000000_profile.sql (docs/specs/PROFILE.md §7.1).
// Pure; no DOM, no game imports. The text constants below are inlined until feature/social ships
// src/online/textRules.js (M2 then imports MESSAGE_INVISIBLE / VISIBLE_CHAR / COMBINING_RUN / MARK_SET /
// LOOKALIKE_* from there instead).

export const MARK_SET = String.raw`\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0ebc\u0ec8-\u0ece\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f`;
const LOOKALIKE_FROM = 'АВСЕНІЈКМОРЅТХУҮҺԀԚԜӀѴавсеніјкморѕтхуүһԁԛԝӏѵΑΒΕΖΗΙΚΜΝΟΡΤΥΧαβεζηικμνορτυχϳıɑɡɩ';
const LOOKALIKE_TO = 'abcehijkmopstxyyhdqwlvabcehijkmopstxyyhdqwlvabezhikmnoptyxabezhikmnoptyxjiagi';
const MESSAGE_INVISIBLE = /[\u0001-\u001f\u007f-\u009f\u00ad\u034f\u0600-\u0605\u061c\u06dd\u070f\u0890-\u0891\u08e2\u115f\u1160\u17b4\u17b5\u180e\u200b\u200e\u200f\u2028-\u202e\u2060-\u2064\u2066-\u206f\u2800\u3164\ufeff\uffa0\ufff9-\ufffb\u{110bd}\u{110cd}\u{13430}-\u{1343f}\u{1bca0}-\u{1bca3}\u{1d159}\u{1d173}-\u{1d17a}\u{e0000}-\u{e007f}]/u;
const VISIBLE = /[^\u0009-\u000d \u0085\u00a0\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0ebc\u0ec8-\u0ece\u1680\u180b-\u180f\u1ab0-\u1aff\u1dc0-\u1dff\u2000-\u200f\u2028\u2029\u202f\u205f\u20d0-\u20ff\u3000\ufe00-\ufe0f\ufe20-\ufe2f\u{e0100}-\u{e01ef}]/u;
const COMBINING_RUN = new RegExp(`[${MARK_SET}]{5,}`, 'u');

// ---- numbers repeated in the SQL (M2: tests/online/profileSchema.test.js compares them) -------
export const BIO_MAX = 80;
export const SHOWCASE_MAX = 8;
export const GEAR_MAX = 4; // ceiling (today 3 slots)
export const SUBS_MAX = 6; // ceiling (today ≤ 4)
export const PINS_MAX = 4;
export const FP_TIERS_MAX = 4;
export const RIBBON_MODES_MAX = 8; // ceiling (today 5)
/** Server ceiling: octet_length(card::text) — jsonb text, which adds a space after ':' and ','. */
export const CARD_TEXT_MAX = 8192;
/** Client budget for JSON.stringify(card): jsonb text runs ~13% longer (4,452 → 5,029 measured). */
export const CARD_JSON_BUDGET = 6000;
export const PROFILE_VISIBILITY = ['everyone', 'friends_clan', 'nobody'];
export const PROFILE_VISIBILITY_DEFAULT = 'everyone';
/** Auto-hide (SQL profile_maybe_hide). */
export const BIO_HIDE = Object.freeze({ reporters: 3, minAccountHours: 24, strikeWindowDays: 30, lockStrikes: 2, lockDays: 7 });

// ---- id patterns (SQL valid_profile_card) ------------------------------------------------------
export const ID_RE = /^[a-z][a-z0-9_]{0,23}$/;
export const SKIN_RE = /^[a-z][a-z0-9_]{0,31}$/;
export const BANNER_RE = /^[a-z]{1,12}:[a-z0-9_-]{1,24}$/;
/** 'stage:difficulty' (medal) · 'stage:difficulty:mode' (ribbon) · 'stage:perfect' · 'ach:<id>' */
export const PIN_RE = /^([a-z0-9-]{1,24}:((easy|normal|hard|nightmare)(:[a-z]{1,16})?|perfect)|ach:[a-z][a-z0-9_]{0,31})$/;
const STAT_RE = /^[a-zA-Z]{1,16}$/;
const TIER_RE = /^[a-z]{1,16}$/;
const STAGE_RE = /^[a-z0-9-]{1,24}$/;

// ---- the contact rules (SQL profile_flat / profile_contact_free, pattern for pattern) ----------
const FLAT_MARKS = new RegExp(`[${MARK_SET}\\ufe00-\\ufe0f\\u200c\\u200d]`, 'gu');
const FLAT_MAP = new Map([...(LOOKALIKE_FROM + '。․‧·')].map((ch, i) => [ch, (LOOKALIKE_TO + '....')[i]]));
export function profileFlat(text) {
  return [...String(text ?? '').normalize('NFKD').replace(FLAT_MARKS, '')].map((ch) => FLAT_MAP.get(ch) ?? ch).join('').toLowerCase();
}
const TLD = 'com|net|org|gg|io|me|tv|ly|co|uk|us|ca|au|xyz|app|dev|link|live|to|be|gl|info|biz|site|online|club|ru|de|fr|jp|cn|kr|tk|ml|ga|cf|gq|page|top|store|shop|fun|chat|social|games';
/** Each one is also a literal substring of the SQL (the lint test checks it). */
export const CONTACT_PATTERNS = Object.freeze([
  String.raw`(https?|ftp) *:|://|(^|[^a-z0-9])w ?w ?w ?\.[a-z0-9]`,
  String.raw`[a-z0-9]\.(${TLD})([^a-z0-9]|$)`,
  String.raw`[a-z0-9] *(\( *dot *\)|\[ *dot *\]|\{ *dot *\}| dot ) *(com|net|org|gg|io|me|tv|ly|co|uk|us|xyz|app)([^a-z0-9]|$)`,
  String.raw`\.[a-z]{2,}/`,
  '@',
  String.raw`# *[0-9]{4}`,
  String.raw`[0-9]([^0-9a-z]{0,2}[0-9]){6,}`,
]);
export const CONTACT_APPS = '(discord|snapchat|instagram|tiktok|whatsapp|telegram|facebook|twitter|youtube|gmail|hotmail|icloud|venmo|cashapp|paypal|skype|reddit|onlyfans)';
export const CONTACT_WORDS = '(^| )(kik|insta|snap|yt|fb|dc|ig|twitch)( |$)';
const RES = CONTACT_PATTERNS.map((p) => new RegExp(p));
const APPS = new RegExp(CONTACT_APPS);
const WORDS = new RegExp(CONTACT_WORDS);
const leet = (s) => s.replace(/[013457]/g, (d) => 'oieast'['013457'.indexOf(d)]);

/** SQL profile_contact_free(p). */
export function contactFree(text) {
  const t = profileFlat(text);
  if (RES.some((re) => re.test(t))) return false;
  if (APPS.test(leet(t.replace(/[^a-z0-9]/g, '')))) return false;
  if (WORDS.test(leet(t.replace(/[^a-z0-9]+/g, ' ')))) return false;
  return true;
}

/** The player-facing reason a bio is refused, or null. '' (no bio) is fine. Trimmed first. */
export function bioError(text) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  if ([...t].length > BIO_MAX) return `Bios are up to ${BIO_MAX} characters.`;
  if (MESSAGE_INVISIBLE.test(t)) return 'Bios can\'t contain invisible characters.';
  if (!VISIBLE.test(t)) return 'Type something first.';
  if (COMBINING_RUN.test(t)) return 'Too many stacked accents in one place.';
  if (!contactFree(t)) return 'Keep links, e-mails, @names, phone numbers and other apps out of your bio.';
  return null;
}

// ---- the card's shape (SQL valid_profile_card) -------------------------------------------------
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const onlyKeys = (o, keys) => Object.keys(o).every((k) => keys.includes(k));
const num = (v, lo, hi, whole) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi && (!whole || Number.isInteger(v));
const optId = (v, re) => v === undefined || v === null || (typeof v === 'string' && re.test(v));
/** SQL profile_stat_ok(p, p_ups): [stat, value] — or [stat, value, upgrades 0–9] for a substat. */
const statOk = (s, ups = false) => Array.isArray(s) && (s.length === 2 || (ups && s.length === 3)) && (s.length === 2 || num(s[2], 0, 9, true))
  && typeof s[0] === 'string' && STAT_RE.test(s[0]) && num(s[1], 0, 100000, false);
const subOk = (s) => statOk(s, true);
/** SQL profile_counts_ok. */
const countsOk = (a, min, max, hi) => Array.isArray(a) && a.length >= min && a.length <= max && a.every((n) => num(n, 0, hi, true));
const distinct = (a) => new Set(a).size === a.length;

export function validCard(c) {
  if (!isObj(c) || !onlyKeys(c, ['v', 'fav', 'ban', 'frm', 'ttl', 'units', 'med', 'fp', 'st']) || c.v !== 1) return false;
  if (!(optId(c.fav, ID_RE) && optId(c.frm, ID_RE) && optId(c.ttl, ID_RE) && optId(c.ban, BANNER_RE))) return false;
  if (c.units !== undefined) {
    if (!Array.isArray(c.units) || c.units.length > SHOWCASE_MAX || !distinct(c.units.map((u) => u?.id))) return false;
    for (const u of c.units) {
      if (!isObj(u) || !onlyKeys(u, ['id', 'lv', 'bt', 'aw', 'p', 'sk', 'g']) || typeof u.id !== 'string' || !ID_RE.test(u.id)) return false;
      if (!(num(u.lv, 1, 999, true) && num(u.bt, 0, 9, true) && num(u.aw, 0, 9, true))) return false;
      if (u.p !== undefined && !num(u.p, 1, 9, true)) return false;
      if (!optId(u.sk, SKIN_RE)) return false;
      if (u.g !== undefined) {
        if (!Array.isArray(u.g) || u.g.length > GEAR_MAX || !distinct(u.g.map((g) => g?.s))) return false;
        for (const g of u.g) {
          if (!isObj(g) || !onlyKeys(g, ['s', 'r', 'l', 'm', 'x']) || typeof g.s !== 'string' || !/^[a-z]{1,12}$/.test(g.s)) return false;
          if (typeof g.r !== 'string' || !/^[a-zA-Z]{1,12}$/.test(g.r) || !num(g.l, 0, 99, true) || !statOk(g.m)) return false;
          if (g.x !== undefined && (!Array.isArray(g.x) || g.x.length > SUBS_MAX || !g.x.every(subOk))) return false;
        }
      }
    }
  }
  if (c.med !== undefined) {
    const m = c.med;
    if (!isObj(m) || !onlyKeys(m, ['a', 'r', 'pins'])) return false;
    if (m.a !== undefined && !countsOk(m.a, 4, 4, 9999)) return false;
    if (m.r !== undefined && !countsOk(m.r, 1, RIBBON_MODES_MAX, 9999)) return false;
    if (m.pins !== undefined && !(Array.isArray(m.pins) && m.pins.length <= PINS_MAX && m.pins.every((p) => typeof p === 'string' && PIN_RE.test(p)) && distinct(m.pins))) return false;
  }
  if (c.fp !== undefined && c.fp !== null) {
    const f = c.fp;
    if (!isObj(f) || Object.keys(f).length > FP_TIERS_MAX) return false;
    for (const [tier, r] of Object.entries(f)) {
      if (!TIER_RE.test(tier) || !isObj(r) || !onlyKeys(r, ['w', 's', 'c']) || !num(r.w, 0, 999999, true)
        || typeof r.s !== 'string' || !STAGE_RE.test(r.s) || (r.c !== undefined && !num(r.c, 0, 1, true))) return false;
    }
  }
  if (c.st !== undefined) {
    const s = c.st;
    // h = Honor Ribbon count (ACHIEVEMENTS.md §6.3, owner default: shown to visitors)
    if (!isObj(s) || !onlyKeys(s, ['u', 's', 'b', 'k', 'h'])) return false;
    const lim = { u: 999, s: 999, b: 100, k: 2000000000, h: 999 };
    for (const k of Object.keys(s)) if (!num(s[k], 0, lim[k], true)) return false;
  }
  return JSON.stringify(c).length <= CARD_JSON_BUDGET;
}

/** FNV-1a 32-bit of the card's JSON, base 36 (SQL accepts ^[0-9a-z]{1,16}$). */
export function cardHash(card) {
  let h = 0x811c9dc5;
  const s = JSON.stringify(card);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
