// The Friendship tab's Friend Support bits (docs/specs/BANNERS.md §E.2): the lender's "Collect N FP" (a tap; the
// server keeps the lender's FP until then, up to 7 days) and the check that turns the Friendship tab on while Friend
// Support is available (online, signed in, the server has the SQL).
import '../styles/support.css';
import { h, button, toast } from '../components.js';
import { store } from '../../core/store.js';
import { errorText } from '../../online/errors.js';
import { isFriendshipLive } from '../../systems/banners.js';
import { wentOnline } from './common.js';

const STATE_TTL_MS = 60 * 1000;
let cached = null; // { at, uid, state }

async function client() {
  const { supportClient } = await import('../../online/supportClient.js');
  return supportClient();
}

/**
 * Asks once whether Friend Support is available and calls `onChange` when the Friendship tab must appear or go.
 * Never signs in by itself.
 */
export function refreshFriendshipTab(onChange) {
  if (!wentOnline()) return;
  const before = isFriendshipLive();
  client().then((sc) => sc.refreshLive()).then((live) => {
    if (live !== before) onChange?.();
  }).catch(() => {});
}

/** "Collect N FP" for the Friendship tab (fills in once the server answered; empty while offline). */
export function supportCollectRow() {
  const row = h('div.sp-collect', { 'data-testid': 'fp-collect', hidden: true });
  const show = (st) => {
    const n = Number(st?.uncollected) || 0;
    row.hidden = false;
    row.replaceChildren(...[
      h('span', n ? h('span', 'Friends earned you ', h('b', `${n} FP`)) : h('span.muted', `Lent today: ${st?.lentToday || 0} / ${st?.lendCap || 100} FP`)),
      n ? button(`Collect ${n} FP`, { kind: 'yellow', small: true, testid: 'fp-collect-btn', onClick: collect }) : null,
      h('span.muted.sp-foot', 'Uncollected FP expires after 7 days.'),
    ].filter(Boolean)); // (replaceChildren writes a null child as the text "null")
  };
  async function collect() {
    try {
      const sc = await client();
      const r = await sc.collect();
      cached = null;
      toast(r.added ? `+${r.added} Friend Points` : 'Your Friend Points wallet is full (5,000).', r.added ? 'good' : 'info');
      store.commit('support');
    } catch (e) {
      toast(errorText(e), 'bad');
    }
  }
  if (!wentOnline()) return row;
  (async () => {
    try {
      const sc = await client();
      if ((await sc.status()) !== 'ready') return;
      const { getBackend } = await import('../../online/backend.js');
      const uid = getBackend().uid;
      if (cached && cached.uid === uid && Date.now() - cached.at < STATE_TTL_MS) {
        show(cached.state);
        return;
      }
      const state = await getBackend().supportState();
      cached = { at: Date.now(), uid, state };
      show(state);
    } catch {
      /* offline: nothing to show */
    }
  })();
  return row;
}
