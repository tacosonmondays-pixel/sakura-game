// The co-op room each player of this browser was last in (code, host or guest, stage, freeplay), for two
// hours: the co-op menu offers it again ("Your last room" → Rejoin) and a battle page that lost
// its session (a reload) leads back to it, so nobody retypes a code or makes a new room after a
// battle (owner, Oct 14: "make it so the room stays and you can rejoin the room"). Kept per
// player: in local test mode two tabs of one browser are two players sharing this storage.
// Not in the co-op compatibility id (tools/simId.mjs): the lockstep never reads it.
const LAST_KEY = 'ss-coop-last';
const LAST_MS = 2 * 60 * 60 * 1000;

const valid = (r, at) => !!r && typeof r === 'object' && /^[A-Z0-9]{4,8}$/.test(r.code) && at - r.at < LAST_MS;

/** uid → { code, host, stageId, difficulty, freeplay, at } (an unreadable or old-format store is empty). */
function readAll() {
  try {
    const all = JSON.parse(localStorage.getItem(LAST_KEY) || 'null');
    return all && typeof all === 'object' && !Array.isArray(all) && !('code' in all) ? all : {};
  } catch {
    return {};
  }
}

function writeAll(all) {
  try {
    if (Object.keys(all).length) localStorage.setItem(LAST_KEY, JSON.stringify(all));
    else localStorage.removeItem(LAST_KEY);
  } catch {
    /* ignore */
  }
}

/** Remembers a room the server let this player into (call once the seat is confirmed). */
export function rememberRoom(s, at = Date.now()) {
  const all = readAll();
  for (const [uid, r] of Object.entries(all)) if (!valid(r, at)) delete all[uid];
  all[s.me?.uid || '-'] = { code: s.code, host: !!s.isHost, stageId: s.stageId, difficulty: s.difficulty, freeplay: s.freeplay ?? null, mode: s.mode || 'standard', at };
  writeAll(all);
}

/** This player's last room, if it is recent: { code, host, stageId, difficulty, freeplay, at } or null. */
export function lastRoom(uid, at = Date.now()) {
  const r = readAll()[uid || '-'];
  return valid(r, at) ? r : null;
}

/**
 * The newest recent room with this code (for a page that does not know its player yet: a
 * reloaded battle page), or null.
 */
export function roomByCode(code, at = Date.now()) {
  const list = Object.values(readAll()).filter((r) => valid(r, at) && r.code === code);
  return list.sort((a, b) => b.at - a.at)[0] || null;
}

/** Forgets this player's last room, but only if it is `code` (a refused other code leaves it alone). */
export function forgetRoom(code, uid) {
  const all = readAll();
  const key = uid || '-';
  if (!code || all[key]?.code !== code) return;
  delete all[key];
  writeAll(all);
}

/**
 * The route params of a room: the host opens it again with its stage (and its freeplay setting,
 * when it had one), a guest joins it (and takes the host's).
 */
export function roomRoute(r) {
  if (!r.host) return { id: r.code };
  const route = { id: r.code, host: '1', stage: r.stageId, difficulty: r.difficulty };
  if (r.freeplay) route.freeplay = r.freeplay;
  if (r.mode && r.mode !== 'standard') route.mode = r.mode;
  return route;
}
