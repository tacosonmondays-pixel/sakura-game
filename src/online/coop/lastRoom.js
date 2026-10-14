// The co-op room this browser was last in (code, host or guest, stage), for two hours: the co-op
// menu offers it again ("Your last room" → Rejoin) and a battle page that lost its session (a
// reload) leads back to it, so nobody retypes a code or makes a new room after a battle (owner,
// Oct 14: "make it so the room stays and you can rejoin the room"). Not in the co-op
// compatibility id (tools/simId.mjs): the lockstep never reads it.
const LAST_KEY = 'ss-coop-last';
const LAST_MS = 2 * 60 * 60 * 1000;

/** Remembers a room the server let this player into (call once the seat is confirmed). */
export function rememberRoom(s, at = Date.now()) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ code: s.code, host: !!s.isHost, stageId: s.stageId, difficulty: s.difficulty, at }));
  } catch {
    /* ignore */
  }
}

/** The last room, if it is recent: { code, host, stageId, difficulty, at } or null. */
export function lastRoom(at = Date.now()) {
  try {
    const r = JSON.parse(localStorage.getItem(LAST_KEY) || 'null');
    if (r && /^[A-Z0-9]{4,8}$/.test(r.code) && at - r.at < LAST_MS) return r;
  } catch {
    /* ignore */
  }
  return null;
}

/** Forgets the last room, but only if it is `code` (a refused other code leaves it alone). */
export function forgetRoom(code) {
  try {
    if (code && lastRoom()?.code === code) localStorage.removeItem(LAST_KEY);
  } catch {
    /* ignore */
  }
}

/** The route params of a room: the host opens it again with its stage, a guest joins it. */
export function roomRoute(r) {
  return r.host ? { id: r.code, host: '1', stage: r.stageId, difficulty: r.difficulty } : { id: r.code };
}
