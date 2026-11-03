// [social] The social side of a co-op room, kept out of session.js on purpose. session.js is part
// of the co-op compatibility id (tools/simId.mjs): any edit there splits players on the old and
// the new build ("update to play together"). Blocking and DM invites change nothing on the wire,
// so they wrap the session from outside instead, and a deploy that only changes them keeps the id.
//   isBlocked(uid): that player's lobby hellos are dropped before the session hears them, so the
//     two are never paired (someone else can still take the seat)
//   session.seated + a 'seated' event: the server registered my seat (open_room / join_room
//     answered), so a DM co-op invite for this room can be sent now (send_coop_invite checks the
//     room exists and is mine)
//   stickers (docs/specs/STICKERS.md §4): session.sendSticker(id) puts a { type: 'stk', uid, id, n } on the room's
//     channel, and a 'sticker' event { uid, id, mine } comes for every sticker sent or heard. Never a sim input, never
//     in the lockstep stream; session.js never sees one (an older build's session would ignore it anyway). The
//     receiver keeps only known ids from the player it is paired with, under the spec's rate limit.
import { openSession } from './session.js';
import { cleanStickerMsg, createStickerLimiter } from '../stickerWire.js';

/**
 * openSession(opts) with the social hooks. Same options and return value as openSession, plus:
 * @param {{ isBlocked?: (uid: string) => boolean }} social
 */
export function openSocialSession(opts, { isBlocked = () => false } = {}) {
  const backend = opts.backend;
  let session = null;
  let seatedEarly = false; // an adapter that answers before openSession returns
  let room = null; // the room the session opened last (a fresh channel replaces it)
  let stickerSeq = 0;
  const mySends = createStickerLimiter();
  const heard = new Map(); // uid → its limiter
  const now = opts.now || (() => Date.now());
  const markSeated = () => {
    if (!session) {
      seatedEarly = true;
      return;
    }
    session.seated = true;
    session.emit('seated', session);
    session.emit('change', session);
  };
  // the backend as the session sees it: the same object, except its room handlers
  const wrapped = Object.create(backend, {
    openRoom: {
      value(code, handlers = {}) {
        const onMessage = handlers.onMessage || (() => {});
        room = backend.openRoom(code, {
          ...handlers,
          onMessage: (msg, from) => {
            if (msg && msg.type === 'hello' && msg.player?.uid && isBlocked(msg.player.uid)) return; // never pair with a player I blocked
            if (msg && msg.type === 'stk') {
              hearSticker(msg, from);
              return;
            }
            onMessage(msg, from);
          },
          onSeated: (info) => {
            handlers.onSeated?.(info);
            markSeated();
          },
        });
        return room;
      },
    },
  });

  /** The other player of this room or of its battle (a sticker from anyone else is dropped). */
  const isPartner = (uid) => !!uid && uid !== session?.me?.uid
    && (session.peer?.uid === uid || !!session.start?.players?.some((p) => p?.uid === uid));

  function hearSticker(msg, from) {
    const m = cleanStickerMsg(msg);
    if (!m || !session || session.phase === 'closed') return;
    if ((from && from !== m.uid) || !isPartner(m.uid) || isBlocked(m.uid)) return;
    let lim = heard.get(m.uid);
    if (!lim) heard.set(m.uid, (lim = createStickerLimiter()));
    if (!lim.take(now())) return; // over the limit: dropped
    session.emit('sticker', { uid: m.uid, id: m.id, mine: false });
  }

  session = openSession({ ...opts, backend: wrapped });
  session.seated = false;
  /**
   * Send a sticker (the caller checks the player owns it). { ok: true } when it went out, else { ok: false, waitMs }
   * (the rate limit: try again in waitMs) or { ok: false } (no room or no link right now).
   */
  session.sendSticker = (id) => {
    if (!room || session.phase === 'closed' || !session.me?.uid) return { ok: false, waitMs: 0 };
    const w = mySends.wait(now());
    if (w > 0) return { ok: false, waitMs: w };
    const sent = room.send({ type: 'stk', uid: session.me.uid, id, n: ++stickerSeq }, { drop: true });
    if (sent === false) return { ok: false, waitMs: 0 };
    mySends.take(now());
    session.emit('sticker', { uid: session.me.uid, id, mine: true });
    return { ok: true, waitMs: 0 };
  };
  /** How long until the next sticker may go (0: now). */
  session.stickerWait = () => mySends.wait(now());
  if (seatedEarly) markSeated();
  return session;
}
