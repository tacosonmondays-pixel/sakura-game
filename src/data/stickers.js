// Stickers (docs/specs/STICKERS.md): small chibi pictures with one short word, sent in co-op battles and in clan /
// friend messages. v1 has 16: a free starter set of Mochi, the loading slime (4; players read "Slime", never the
// name), one sticker per girl that owning her unlocks (10), and two earned ones (the first co-op win, the Halloween
// 2026 event). Never sold.
// The art is our own (tools/stickers/: NovelAI from the game's own descriptions, cut out and captioned here), in
// public/art/stickers/<id>-256.webp and <id>-128.webp. The caption is baked into the picture; `label` is the same
// word for screen readers and for a build or a setting that shows text instead.
// Every id travels over the network (the co-op 'stk' message, a chat line's sticker token): a receiver only ever
// draws a sticker from this table and drops an id it does not know, so nothing but an id is trusted.
// Plain data, no DOM.

/** The id rule (the same as frames and titles): what a message may carry. */
export const STICKER_ID_RE = /^[a-z][a-z0-9_]{0,23}$/;

/**
 * how: 'starter' (everyone) · 'girl' (own `girl`) · 'coop' (win a co-op battle) · 'event' (clear `stage`, any
 * difficulty). `hint` says how to get it, on the locked tile.
 */
export const STICKERS = Object.freeze([
  { id: 'mochi_hi', label: 'Hi!', who: 'Slime', how: 'starter' },
  { id: 'mochi_thanks', label: 'Thanks!', who: 'Slime', how: 'starter' },
  { id: 'mochi_oops', label: 'Oops!', who: 'Slime', how: 'starter' },
  { id: 'mochi_gg', label: 'GG!', who: 'Slime', how: 'starter' },
  { id: 'hikari_go', label: 'Let\'s go!', who: 'Hikari', how: 'girl', girl: 'hikari' },
  { id: 'aoi_nice', label: 'Nice!', who: 'Aoi', how: 'girl', girl: 'aoi' },
  { id: 'kage_onit', label: 'On it!', who: 'Kage', how: 'girl', girl: 'kage' },
  { id: 'momo_yay', label: 'Yay!', who: 'Momo', how: 'girl', girl: 'momo' },
  { id: 'akane_wow', label: 'Wow!', who: 'Akane', how: 'girl', girl: 'akane' },
  { id: 'yuki_help', label: 'Help!', who: 'Yuki', how: 'girl', girl: 'yuki' },
  { id: 'miko_thanks', label: 'Thank you!', who: 'Miko', how: 'girl', girl: 'miko' },
  { id: 'ena_luck', label: 'Good luck!', who: 'Ena', how: 'girl', girl: 'ena' },
  { id: 'iroha_ready', label: 'Ready?', who: 'Iroha', how: 'girl', girl: 'iroha' },
  { id: 'tenka_charge', label: 'Charge!', who: 'Tenka', how: 'girl', girl: 'tenka' },
  { id: 'chigusa_bravo', label: 'Bravo!', who: 'Chigusa', how: 'coop' },
  { id: 'hotaru_boo', label: 'Boo!', who: 'Hotaru', how: 'event', stage: 'ev-halloween-boss', event: 'Halloween 2026' },
].map((s) => Object.freeze(s)));

export const STICKER_MAP = Object.freeze(Object.fromEntries(STICKERS.map((s) => [s.id, s])));

/** How to unlock a sticker, in a few words (the locked tile's line). */
export function stickerHint(s) {
  if (!s) return '';
  if (s.how === 'starter') return 'Everyone has this one.';
  if (s.how === 'girl') return `Recruit ${s.who}.`;
  if (s.how === 'coop') return 'Win a co-op battle.';
  if (s.how === 'event') return `Calm the Gourdlight Golem (${s.event} event).`;
  return '';
}

/** Screen-reader text: "Aoi sticker: Nice!". */
export const stickerAlt = (s) => (s ? `${s.who} sticker: ${s.label}` : '');

/**
 * Co-op sending limits (spec §4): one sticker per 2 s per player, at most 5 per 20 s. The sender's button waits them
 * out; the receiver drops anything over them. A bubble stays up showMs.
 */
export const STICKER_LIMITS = Object.freeze({ gapMs: 2000, burst: 5, windowMs: 20000, showMs: 3000 });
