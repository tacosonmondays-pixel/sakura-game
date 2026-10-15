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
 * Combining marks that stack on a letter (a regex class body): Latin / Greek / Cyrillic accents,
 * Hebrew points and cantillation, Arabic harakat, Thai and Lao vowel and tone marks, and the other
 * combining blocks. SQL: the same set in valid_dm_body / visible_name / name_words.
 */
export const MARK_SET = String.raw`\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0ebc\u0ec8-\u0ece\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f`;
/**
 * A VISIBLE character: anything but a space of any kind (NBSP, U+2000–U+200A, the ideographic
 * space…), a joiner, a variation selector or a mark. A message or name needs at least one.
 * Spelled out as code points like the SQL (valid_dm_body / visible_name), never \s or a locale class.
 */
export const VISIBLE_CHAR = /[^\u0009-\u000d\u0020\u0085\u00a0\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0ebc\u0ec8-\u0ece\u1680\u180b-\u180f\u1ab0-\u1aff\u1dc0-\u1dff\u2000-\u200f\u2028\u2029\u202f\u205f\u20d0-\u20ff\u3000\ufe00-\ufe0f\ufe20-\ufe2f\u{e0100}-\u{e01ef}]/u;
const VISIBLE = VISIBLE_CHAR;
/** Spaces at either end of a name (SQL visible_name; btrim() only trims ASCII spaces). */
const NAME_EDGE_SPACE = /^[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]|[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]$/u;
/** Stacked combining marks ("Zalgo", a wall of Thai tone marks): at most 4 in a row. SQL: the same ranges. */
export const COMBINING_RUN = new RegExp(`[${MARK_SET}]{5,}`, 'u');
const MARKS_G = new RegExp(`[${MARK_SET}]`, 'gu');
/** Characters that make a display name look empty (SQL: visible_name, the profiles_name_rules trigger). */
export const NAME_BLANKS = /[\u034f\u115f\u1160\u17b4\u17b5\u2028\u2029\u2800\u3164\uffa0\u{1d159}]/u;

/** Display names may not look empty either (SQL visible_name; clanRules.validateName uses it). */
export function nameLooksBlank(name) {
  const n = String(name ?? '');
  return NAME_BLANKS.test(n) || COMBINING_RUN.test(n) || !VISIBLE.test(n) || NAME_EDGE_SPACE.test(n);
}


/**
 * Look-alike letters mapped to Latin before names are compared (SQL name_fold(): the same two
 * strings, character for character), case kept (nameCamel() needs it): Cyrillic and Greek
 * capitals and small letters that pass for a–z, a few Latin ones (dotless i, script a / g), then
 * Cherokee ('ᎠEV'), Lisu ('ꓢtaff'), small capitals ('ᴅᴇᴠ'), Armenian ('Տystem'), Coptic, the
 * syllabics of "fancy text" ('ᗪᗴᐯ'), letters with a stroke or a hook ('Đev') and boxed letters.
 */
export const LOOKALIKE_FROM = 'АВСЕНІЈКМОРЅТХУҮҺԀԚԜӀѴавсеніјкморѕтхуүһԁԛԝӏѵΑΒΕΖΗΙΚΜΝΟΡΤΥΧαβεζηικμνορτυχϳıɑɡɩᎠᎡᎢᎥᎩᎪᎫᎬᎳᎷᎻᎾᏀᏂᏃᏏᏒᏔᏙᏚᏞᏟᏢᏦᏴꭰꭱꭲꭵꭹꭺꭻꭼꮃꮇꮋꮎꮐꮒꮓꮟꮢꮤꮩꮪꮮꮯꮲꮶᏼꓐꓑꓒꓓꓔꓖꓗꓙꓚꓜꓝꓟꓠꓡꓢꓣꓦꓧꓪꓫꓬꓮꓰꓲꓳꓴᴀᴄᴅᴇᴊᴋᴍᴏᴘᴛᴜᴠᴡᴢʙɢʜɪʟɴʀʏꜰꜱꞯՏՕՍԼօսհոցզաⲀⲁⲂⲎⲒⲔⲕⲘⲚⲞⲟⲢⲣⲤⲥⲦⲨⲬⲭᗩᗷᑕᗪᗴᕮᖴᘜᕼᒍᒪᗰᑎᑭᑫᖇᔕᑌᐯᗯ᙭ĐđĦħŁłØøŦŧƀƁƊɗƑƒƓƗɨƘƙƝƤƥƬƭƲʋƵƶǤǥȻȼɆɇɌɍɎɏɃß🅐🅑🅒🅓🅔🅕🅖🅗🅘🅙🅚🅛🅜🅝🅞🅟🅠🅡🅢🅣🅤🅥🅦🅧🅨🅩🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉';
export const LOOKALIKE_TO = 'ABCEHIJKMOPSTXYYHDQWlVabcehijkmopstxyyhdqwlvABEZHIKMNOPTYXabezhikmnoptyxjiagiDRTiYAJEWMHOGhZbRWVSLCPKBdrtiyajewmhoghzbrwvslcpkbBPdDTGKJCZFMNLSRVHWXYAEIOUacdejkmoptuvwzbghilnryfsqSOULouhngqwAaBHIKkMNOoPpCcTYXxABCDEEFGHJLMNPQRSUVWXDdHhLlOoTtbBDdFfGIiKkNPpTtVvZzGgCcEeRrYyBsABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOOKALIKE = new Map([...LOOKALIKE_FROM].map((ch, i) => [ch, LOOKALIKE_TO[i]]));
/**
 * Invisible characters dropped before names are compared (SQL name_fold()): soft hyphen, combining
 * grapheme joiner, bidi marks and embeddings, zero-width spaces and joiners, word joiners,
 * variation selectors, BOM, tags — 'D' + U+FE0F + 'ev' is 'Dev', never 'D ev'.
 */
export const NAME_INVISIBLE = String.raw`\u00ad\u034f\u061c\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufe00-\ufe0f\ufeff\u{e0000}-\u{e0fff}`;
const INVISIBLE_G = new RegExp(`[${NAME_INVISIBLE}]`, 'gu');
/**
 * Alphabets made mostly of look-alikes of Latin letters (SQL lookalike_mix()): IPA and small
 * capitals, Armenian, Georgian capitals, Cherokee, Canadian syllabics, Coptic, Lisu, Latin
 * Extended-D, boxed letters. A NEW name may not mix them with Latin letters.
 */
export const LOOKALIKE_BLOCKS = String.raw`\u0250-\u02af\u0530-\u058f\u10a0-\u10cf\u13a0-\u13ff\u1400-\u167f\u1d00-\u1dbf\u2c80-\u2cff\ua4d0-\ua4ff\ua720-\ua7ff\uab70-\uabbf\u{1f130}-\u{1f189}`;
const LOOKALIKE_BLOCK = new RegExp(`[${LOOKALIKE_BLOCKS}]`, 'u');
/** What clan names are compared without (SQL clan_name_key()): spaces, punctuation, symbols, emoji. */
export const NAME_DECOR = String.raw`\u0001-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u00bf\u00d7\u00f7\u02b0-\u02ff\u1680\u2000-\u2bff\u2e00-\u2e7f\u3000-\u303f\u30fb\u3164\ufe10-\ufe6f\uff00-\uff0f\uffa0\u{1f000}-\u{1faff}`;
const CLAN_DROP_G = new RegExp(`[${MARK_SET}${NAME_DECOR}]`, 'gu');
/** Letters spelled one by one are one word ('d e v team' → 'dev team'; SQL name_words()). */
const SINGLE_LETTERS = /(?<=(?:^| )[a-z0-9]) (?=[a-z0-9](?: |$))/g;

/**
 * NFKD (fullwidth → ASCII, accents split off), invisible characters dropped, look-alikes → Latin
 * (case kept). SQL name_fold().
 */
export function nameFold(name) {
  return [...String(name ?? '').normalize('NFKD').replace(INVISIBLE_G, '')].map((ch) => LOOKALIKE.get(ch) ?? ch).join('');
}

/**
 * What a name is compared by for the reserved list (SQL name_key()): nameFold(), lower case, then
 * only a–z and 0–9. 'Ѕystem' (Cyrillic Ѕ), 'Ｓｙｓｔｅｍ', 'Sýstem', 'Supply Bоt', 'Ꭺdmin' →
 * 'system' / 'supplybot' / 'admin'.
 */
export function nameKey(name) {
  return nameFold(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * nameKey() with the word breaks kept (one space between words) for whole-word checks; marks are
 * dropped, never a break, and letters spelled one by one are one word (SQL name_words()):
 * 'GM Rosie' → 'gm rosie', 'Modé' → 'mode', 'D.E.V. Team' → 'dev team'.
 */
export function nameWords(name) {
  return nameFold(name).toLowerCase().replace(MARKS_G, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(SINGLE_LETTERS, '');
}

/** nameFold() with a word break where the case starts one ('GMRosie' → 'GM Rosie', 'DevTeam' → 'Dev Team'). SQL name_camel(). */
export function nameCamel(name) {
  return nameFold(name).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
}

/** Latin letters mixed with letters of a look-alike alphabet ('ᎠEV Lab', 'ꓢtaff'; SQL lookalike_mix()). */
export function mixesLookalikes(name) {
  const n = String(name ?? '');
  return /[A-Za-z]/.test(n.normalize('NFKD')) && LOOKALIKE_BLOCK.test(n);
}

/**
 * What two clan names are compared by (SQL clan_name_key()): nameFold(), lower case, without
 * marks, spaces, punctuation, symbols or emoji, every other letter kept: 'Moon-Clan' = 'Moon Clan',
 * 'さくら組' = 'さくら' + U+200D + '組', but 'さくら Clan' ≠ 'ひまわり Clan'.
 */
export function clanNameKey(name) {
  return nameFold(name).toLowerCase().replace(CLAN_DROP_G, '');
}
