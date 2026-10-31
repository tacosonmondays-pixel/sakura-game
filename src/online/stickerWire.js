// Stickers on the wire (docs/specs/STICKERS.md §4). Pure helpers, no DOM, no network.
//
// Co-op: a side message on the room's channel, never a sim input and never in the lockstep stream:
//   { type: 'stk', uid, id, n }    uid = the sender, id = a STICKERS id, n = the sender's sequence number
// It is sent and heard by src/online/coop/socialRoom.js, outside session.js, so the co-op id (tools/simId.mjs) and
// COOP_PROTOCOL stay the same; an older build's session ignores a message type it does not know.
//
// Clan chat and private messages: an ordinary text line, `[sticker:<id>] <label>`. A build that knows the id draws
// the picture (from its own table, never the line's text); an older build, or an id this build does not know,
// just shows the line as text, which still reads fine ("[sticker:aoi_nice] Nice!").
import { STICKER_ID_RE, STICKER_MAP, STICKER_LIMITS } from '../data/stickers.js';

/** A co-op sticker message, cleaned: { uid, id, n } for a known id, else null (dropped without a trace). */
export function cleanStickerMsg(msg) {
  if (!msg || typeof msg !== 'object' || msg.type !== 'stk') return null;
  const { uid, id, n } = msg;
  if (typeof uid !== 'string' || !uid || uid.length > 64) return null;
  if (typeof id !== 'string' || !STICKER_ID_RE.test(id) || !Object.prototype.hasOwnProperty.call(STICKER_MAP, id)) return null;
  return { uid, id, n: Number.isInteger(n) && n >= 0 ? n : 0 };
}

/**
 * The co-op limit (one per gapMs, at most `burst` per windowMs), per player. The sender asks `wait(now)` before it
 * sends (0 = go); the receiver asks `take(now)` for every sticker it hears and drops it when that says no.
 */
export function createStickerLimiter(limits = STICKER_LIMITS) {
  let times = [];
  const prune = (now) => {
    times = times.filter((t) => now - t < limits.windowMs);
  };
  const wait = (now) => {
    prune(now);
    const last = times[times.length - 1];
    let w = last == null ? 0 : Math.max(0, limits.gapMs - (now - last));
    if (times.length >= limits.burst) w = Math.max(w, limits.windowMs - (now - times[0]));
    return w;
  };
  return {
    wait,
    take(now) {
      if (wait(now) > 0) return false;
      times.push(now);
      return true;
    },
  };
}

const TOKEN_RE = /^\[sticker:([a-z][a-z0-9_]{0,23})\] (.{1,24})$/;

/** The chat line for a sticker (null for an unknown id). */
export function stickerLine(id) {
  const s = STICKER_MAP[id];
  return s ? `[sticker:${s.id}] ${s.label}` : null;
}

/** The sticker a chat line carries (its table entry), or null: an ordinary line, or an id this build does not know. */
export function lineSticker(body) {
  const m = typeof body === 'string' ? TOKEN_RE.exec(body) : null;
  return m && Object.prototype.hasOwnProperty.call(STICKER_MAP, m[1]) ? STICKER_MAP[m[1]] : null;
}
