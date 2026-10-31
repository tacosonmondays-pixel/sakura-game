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

/**
 * "Show stickers from other players" off survives an older build: missions.counters 'stk:off' = 1 rides every save
 * while it is off (src/core/store.js saveText). A build from before stickers drops the setting it does not know but
 * keeps counters word for word, so a save whose settings have no showStickers key and that carries the mark gets the
 * setting back off (src/systems/save.js migrateProfile). A save that has the key keeps it: the mark follows it.
 */
export const STICKERS_OFF_MARK = 'stk:off';

/** Writes (or clears) the 'stk:off' mark from the setting. */
export function writeStickerMark(p) {
  const c = p?.missions?.counters;
  if (!c || typeof c !== 'object') return;
  if (p.settings?.showStickers === false) c[STICKERS_OFF_MARK] = 1;
  else delete c[STICKERS_OFF_MARK];
}

/** The setting as loaded: the stored one when the save has it, else the mark's (an older build dropped the key). */
export function restoredShowStickers(rawSettings, counters, cleaned) {
  const had = !!rawSettings && typeof rawSettings === 'object' && Object.prototype.hasOwnProperty.call(rawSettings, 'showStickers');
  if (had) return cleaned;
  return !(Number(counters?.[STICKERS_OFF_MARK]) > 0) && cleaned;
}
