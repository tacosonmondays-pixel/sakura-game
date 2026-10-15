// [social] The social side of a co-op room, kept out of session.js on purpose. session.js is part
// of the co-op compatibility id (tools/simId.mjs): any edit there splits players on the old and
// the new build ("update to play together"). Blocking and DM invites change nothing on the wire,
// so they wrap the session from outside instead, and a deploy that only changes them keeps the id.
//   isBlocked(uid): that player's lobby hellos are dropped before the session hears them, so the
//     two are never paired (someone else can still take the seat)
//   session.seated + a 'seated' event: the server registered my seat (open_room / join_room
//     answered), so a DM co-op invite for this room can be sent now (send_coop_invite checks the
//     room exists and is mine)
import { openSession } from './session.js';

/**
 * openSession(opts) with the social hooks. Same options and return value as openSession, plus:
 * @param {{ isBlocked?: (uid: string) => boolean }} social
 */
export function openSocialSession(opts, { isBlocked = () => false } = {}) {
  const backend = opts.backend;
  let session = null;
  let seatedEarly = false; // an adapter that answers before openSession returns
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
        return backend.openRoom(code, {
          ...handlers,
          onMessage: (msg, from) => {
            if (msg && msg.type === 'hello' && msg.player?.uid && isBlocked(msg.player.uid)) return; // never pair with a player I blocked
            onMessage(msg, from);
          },
          onSeated: (info) => {
            handlers.onSeated?.(info);
            markSeated();
          },
        });
      },
    },
  });
  session = openSession({ ...opts, backend: wrapped });
  session.seated = false;
  if (seatedEarly) markSeated();
  return session;
}
