// Settings → Online → Friend Support (docs/specs/BANNERS.md §E.1): "Lend my Support Student to: Friends · Nobody"
// (default Friends) and which girl is lent (default: the first girl of the profile showcase). Both are local
// settings (systems/friendSupport.js); the profile sync publishes them when they change.
import '../styles/support.css';
import { h, button, modal, unitCard, toast } from '../components.js';
import { store } from '../../core/store.js';
import { UNIT_MAP } from '../../data/units.js';
import { supportLend, setSupportLend, supportUnitId, setSupportUnit } from '../../systems/friendSupport.js';
import { LEND } from '../../online/supportRules.js';

const LEND_LABELS = { friends: 'Friends', nobody: 'Nobody' };
const LEND_HELP = {
  friends: 'Your friends can bring your Support Student into their battles. You both earn Friend Points for the Friendship banner.',
  nobody: 'Nobody can borrow your Support Student. You can still borrow your friends\' girls.',
};

/** Publish the change at the next sync step (quietly; it waits for the profile SQL like the card). */
function publishSoon() {
  import('../../online/profileSync.js').then(async (m) => {
    const ps = await m.profileSync();
    ps.markDirty();
    await ps.sync({ reason: 'online' });
  }).catch(() => {});
}

function pickGirl(onDone) {
  const p = store.profile;
  const ids = Object.keys(p.units || {}).filter((id) => UNIT_MAP[id]?.kind === 'tower')
    .sort((a, b) => (p.units[b]?.level || 1) - (p.units[a]?.level || 1) || a.localeCompare(b));
  const cur = supportUnitId(p);
  const grid = h('div.sp-picker', { 'data-testid': 'support-picker' }, ids.map((id) => unitCard(id, {
    variant: 'square', level: p.units[id]?.level, selected: id === cur,
    onClick: () => {
      setSupportUnit(p, id);
      store.commit('settings');
      dlg.close();
      onDone();
    },
  })));
  const dlg = modal({
    title: 'Support Student',
    body: h('div', h('p.muted', 'Friends borrow her at their own level range. Heroes are never lent.'), grid),
    actions: [
      { label: 'Automatic', kind: 'ghost', onClick: (close) => { setSupportUnit(p, null); store.commit('settings'); close(); onDone(); } },
      { label: 'Close', kind: 'primary' },
    ],
  });
}

/** The two rows (always shown: they are this save's settings, online or not). */
export function supportRows() {
  const box = h('div.sc-settings', { 'data-testid': 'settings-support' });
  const paint = () => {
    const p = store.profile;
    const value = supportLend(p);
    const id = supportUnitId(p);
    const seg = h('div.ol-seg.sc-set-seg', LEND.map((v) => h(`button.ol-seg-btn${v === value ? '.on' : ''}`, {
      type: 'button', 'data-testid': `settings-support-${v}`,
      onclick: () => {
        if (!setSupportLend(store.profile, v)) return;
        store.commit('settings');
        toast(`Lend my Support Student to: ${LEND_LABELS[v]}`, 'good');
        paint();
        publishSoon();
      },
    }, LEND_LABELS[v])));
    box.replaceChildren(
      h('div.ma-set-row',
        h('div.ma-set-text', h('div.ma-set-label', 'Lend my Support Student to'), h('div.ma-set-desc', LEND_HELP[value])),
        h('div.ma-set-control', seg)),
      h('div.ma-set-row',
        h('div.ma-set-text', h('div.ma-set-label', 'Support Student'), h('div.ma-set-desc', p.settings?.supportUnit ? 'Your pick.' : 'Automatic: the first girl of your profile showcase.')),
        h('div.ma-set-control.sp-set-girl',
          id ? unitCard(id, { variant: 'square', level: p.units[id]?.level }) : h('span.muted', 'No student yet'),
          button('Change', { kind: 'ghost', small: true, testid: 'settings-support-change', onClick: () => pickGirl(() => { paint(); publishSoon(); }) }))),
    );
  };
  paint();
  return box;
}
