// Text rules shared by chat, DMs and display names (no imports: clanRules.js and socialRules.js
// both use it). Every set is spelled out as code points, exactly like the SQL functions
// valid_dm_body() / visible_name() / name_key() of supabase/migrations/20261013000000_social.sql
// (tests/online/socialFixes.test.js compares them on the same strings).

/**
 * Characters a message may not contain (SQL: valid_dm_body; the same set in the chat guard
 * trigger): controls, bidi overrides, zero-width spaces / word joiners that hide text, BOM, tag
 * characters, line / paragraph separators that fake a new line, and the fillers that render blank
 * (Hangul fillers, Braille blank), and invisible marks (combining grapheme joiner, Khmer inherent
 * vowels, the null notehead). ZWJ / ZWNJ and variation selectors stay allowed so emoji sequences
 * (and Japanese ideographic variants) work.
 */
export const MESSAGE_INVISIBLE = /[\u0001-\u001f\u007f-\u009f\u00ad\u034f\u0600-\u0605\u061c\u06dd\u070f\u0890-\u0891\u08e2\u115f\u1160\u17b4\u17b5\u180e\u200b\u200e\u200f\u2028-\u202e\u2060-\u2064\u2066-\u206f\u2800\u3164\ufeff\uffa0\ufff9-\ufffb\u{110bd}\u{110cd}\u{13430}-\u{1343f}\u{1bca0}-\u{1bca3}\u{1d159}\u{1d173}-\u{1d17a}\u{e0000}-\u{e007f}]/u;
/**
 * A VISIBLE character: anything but a space of any kind (NBSP, U+2000–U+200A, the ideographic
 * space…), a joiner, a variation selector or an accent. A message or name needs at least one.
 * Spelled out as code points like the SQL (valid_dm_body / visible_name), never \s or a locale class.
 */
export const VISIBLE_CHAR = /[^\u0009-\u000d\u0020\u0085\u00a0\u0300-\u036f\u1680\u180b-\u180f\u1ab0-\u1aff\u1dc0-\u1dff\u2000-\u200f\u2028\u2029\u202f\u205f\u20d0-\u20ff\u3000\ufe00-\ufe0f\ufe20-\ufe2f\u{e0100}-\u{e01ef}]/u;
const VISIBLE = VISIBLE_CHAR;
/** Spaces at either end of a name (SQL visible_name; btrim() only trims ASCII spaces). */
const NAME_EDGE_SPACE = /^[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]|[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]$/u;
/** Stacked combining marks ("Zalgo"): at most 4 in a row. SQL: the same ranges. */
export const COMBINING_RUN = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]{5,}/u;
/** Characters that make a display name look empty (SQL: visible_name, the profiles_name_rules trigger). */
export const NAME_BLANKS = /[\u034f\u115f\u1160\u17b4\u17b5\u2028\u2029\u2800\u3164\uffa0\u{1d159}]/u;

/** Display names may not look empty either (SQL visible_name; clanRules.validateName uses it). */
export function nameLooksBlank(name) {
  const n = String(name ?? '');
  return NAME_BLANKS.test(n) || COMBINING_RUN.test(n) || !VISIBLE.test(n) || NAME_EDGE_SPACE.test(n);
}


/**
 * Look-alike letters mapped to Latin before reserved names are compared (SQL name_key(): the same
 * two strings, character for character): Cyrillic and Greek capitals and small letters that pass
 * for a–z, plus a few Latin ones (dotless i, script a / g).
 */
export const LOOKALIKE_FROM = 'АВСЕНІЈКМОРЅТХУҮҺԀԚԜӀѴавсеніјкморѕтхуүһԁԛԝӏѵΑΒΕΖΗΙΚΜΝΟΡΤΥΧαβεζηικμνορτυχϳıɑɡɩ';
export const LOOKALIKE_TO = 'abcehijkmopstxyyhdqwlvabcehijkmopstxyyhdqwlvabezhikmnoptyxabezhikmnoptyxjiagi';
const LOOKALIKE = new Map([...LOOKALIKE_FROM].map((ch, i) => [ch, LOOKALIKE_TO[i]]));

/**
 * What a name is compared by for the reserved list (SQL name_key()): NFKD (fullwidth → ASCII,
 * accents split off), look-alikes → Latin, lower case, then only a–z and 0–9.
 * 'Ѕystem' (Cyrillic Ѕ), 'Ｓｙｓｔｅｍ', 'Sýstem', 'Supply Bоt' → 'system' / 'supplybot'.
 */
export function nameKey(name) {
  return [...String(name ?? '').normalize('NFKD')].map((ch) => LOOKALIKE.get(ch) ?? ch).join('').toLowerCase().replace(/[^a-z0-9]/g, '');
}
