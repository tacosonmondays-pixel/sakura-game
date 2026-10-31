// Which stickers a save owns (docs/specs/STICKERS.md §3), derived from what every build already keeps — the roster,
// the co-op win counter, the event stage's medals — so stickers are retroactive and no older build can take one away.
// Nothing new is stored for ownership. The "hide stickers" choice is a setting (profile.settings.showStickers).
import { STICKERS, STICKER_MAP } from '../data/stickers.js';
import { DIFFICULTY_ORDER } from '../data/types.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const RULES = {
  starter: () => true,
  girl: (p, s) => isObj(p?.units) && !!p.units[s.girl],
  coop: (p) => num(p?.missions?.counters?.coopWin) >= 1,
  event: (p, s) => {
    const e = p?.progress?.stages?.[s.stage];
    return isObj(e) && DIFFICULTY_ORDER.some((d) => e[d] === true);
  },
};

/** Is this sticker this save's? (unknown id: no) */
export function ownsSticker(p, id) {
  const s = STICKER_MAP[id];
  return !!s && !!RULES[s.how]?.(p, s);
}

/** The ids this save owns, in table order. */
export function ownedStickers(p) {
  return STICKERS.filter((s) => RULES[s.how]?.(p, s)).map((s) => s.id);
}

/** Settings → Online → "Show stickers from other players" (on unless switched off). */
export const showsStickers = (p) => p?.settings?.showStickers !== false;
