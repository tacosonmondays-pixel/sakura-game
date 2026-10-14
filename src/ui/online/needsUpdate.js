// "Needs the latest server update": what every social feature shows while the live project has
// not run supabase/migrations/20261013000000_social.sql yet (the frontend deploys first). Chat,
// clans, the clan boss and co-op keep working as before.
import '../styles/social.css';
import { h, button } from '../components.js';
import { getBackend } from '../../online/backend.js';

const CLOUD = '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="nu-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe6ff"/><stop offset="1" stop-color="#4b9bff"/></linearGradient></defs><path d="M14 36h21a8 8 0 0 0 1.4-15.9A11 11 0 0 0 15.3 18 9 9 0 0 0 14 36z" fill="url(#nu-g)" stroke="#22385c" stroke-width="2.4" stroke-linejoin="round"/><path d="M24 22v8M20.5 26.5L24 30l3.5-3.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * @param {{ what?: string, compact?: boolean, onReady?: () => void }} [opts] what: "Messages" →
 *   "Messages need the latest server update". onReady runs when Retry finds the update installed.
 */
export function needsUpdateCard({ what = 'Messages and friends', compact = false, onReady = null } = {}) {
  const status = h('small.sc-nu-status');
  const retry = button('Retry', {
    kind: 'ghost', small: true, icon: 'refresh', testid: 'needs-update-retry',
    onClick: async () => {
      retry.disabled = true;
      status.textContent = 'Checking…';
      const st = await getBackend().recheckSocial().catch(() => 'offline');
      retry.disabled = false;
      if (st === 'ready') {
        status.textContent = 'Updated!';
        onReady?.();
      } else status.textContent = st === 'offline' ? 'Cannot reach the server right now.' : 'Not yet — try again later.';
    },
  });
  return h(`section.sc-needs-update${compact ? '.compact' : ''}`, { 'data-testid': 'needs-update' },
    h('span.sc-nu-ico', { html: CLOUD }),
    h('div.sc-nu-text',
      h('b', `${what} need${/s$/i.test(what) || / and /.test(what) ? '' : 's'} the latest server update`),
      h('p.muted', 'The game\'s owner has to run one setup step on the server. Chat, clans and co-op work as usual.'),
      h('div.sc-nu-acts', retry, status)));
}
