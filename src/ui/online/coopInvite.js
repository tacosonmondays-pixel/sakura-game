// "Invite to co-op" from a player card or a DM conversation: reuse my open room when I already host
// one with a free seat, otherwise pick a stage and open a new room; the invite goes out as soon as
// the server has registered the room (session 'seated'), from the room lobby (screens/coop.js).
import { toast } from '../components.js';
import { navigate } from '../router.js';
import { getBackend } from '../../online/backend.js';
import { errorText } from '../../online/errors.js';
import { addPendingInvite } from './socialHub.js';

/**
 * Sends one DM invite into a room I host (the server checks it is mine and has a free seat).
 * @returns {Promise<object|null>} the invite message, or null (the toast says why)
 */
export async function sendRoomInvite(peer, session) {
  try {
    const m = await getBackend().sendCoopInvite(peer.userId, { room: session.code, stage: session.stageId, difficulty: session.difficulty });
    toast(`Invite sent to ${peer.name}`, 'good');
    return m;
  } catch (e) {
    toast(errorText(e), 'bad', 3200);
    return null;
  }
}

/** @param {{ userId: string, name: string, level?: number, avatar?: string }} peer */
export async function startCoopInvite(peer) {
  const { getSession, makeRoomCode } = await import('../../online/coop/session.js');
  const s = getSession();
  if (s && s.isHost && s.phase === 'lobby' && !s.peer) {
    if (s.seated) {
      const m = await sendRoomInvite(peer, s);
      if (m) (s.dmInvites ||= []).push({ userId: peer.userId, name: peer.name, expires: Number(m.meta?.expires) || Date.now() + 15 * 60000 });
    } else addPendingInvite(s.code, peer);
    navigate('coop', { id: s.code, host: '1' });
    return;
  }
  const coop = await import('../screens/coop.js');
  const pick = await coop.pickCoopStage();
  if (!pick) return;
  if (s && s.phase === 'lobby') s.close();
  const code = makeRoomCode();
  addPendingInvite(code, peer);
  navigate('coop', { id: code, host: '1', stage: pick.stageId, difficulty: pick.difficulty });
}
