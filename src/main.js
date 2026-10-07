import './ui/styles/base.css';
import { registerRoute, startRouter, currentRoute } from './ui/router.js';
import { store } from './core/store.js';
import { onAppStart } from './systems/missions.js';

// Every screen module exports render(root, params) => cleanup?
registerRoute('lobby', () => import('./ui/screens/lobby.js'));
registerRoute('campaign', () => import('./ui/screens/campaign.js'));
registerRoute('stage', () => import('./ui/screens/stage.js'));
registerRoute('battle', () => import('./ui/screens/battle.js'));
registerRoute('students', () => import('./ui/screens/students.js'));
registerRoute('student', () => import('./ui/screens/student.js'));
registerRoute('formation', () => import('./ui/screens/formation.js'));
registerRoute('recruit', () => import('./ui/screens/recruit.js'));
registerRoute('backpack', () => import('./ui/screens/backpack.js'));
registerRoute('bounty', () => import('./ui/screens/bounty.js'));
registerRoute('assault', () => import('./ui/screens/assault.js'));
registerRoute('challenge', () => import('./ui/screens/challenge.js'));
registerRoute('mall', () => import('./ui/screens/mall.js'));
registerRoute('commissions', () => import('./ui/screens/commissions.js'));
registerRoute('rewards', () => import('./ui/screens/rewards.js'));
registerRoute('bestiary', () => import('./ui/screens/bestiary.js'));
registerRoute('wiki', () => import('./ui/screens/wiki.js'));
registerRoute('settings', () => import('./ui/screens/settings.js'));
registerRoute('missions', () => import('./ui/screens/missions.js')); // [ui-v2] mission hub (Campaign button)

store.load();
// Debug/test hook (used by e2e tests). Not a cheat menu: read-only plus store access.
window.__sakura = { store };
try {
  onAppStart(store.profile); // daily/weekly resets, login bonus bookkeeping
  store.commit('app-start');
} catch (e) {
  console.error('[main] onAppStart failed', e);
}

document.querySelector('.boot')?.remove();
try {
  startRouter(document.getElementById('app'));
} catch (e) {
  // never leave a blank page: the hashchange listener is already up, so the lobby renders
  console.error('[main] first route failed, opening the lobby', e);
  location.replace('#/lobby');
}

// A stored save that could not load as it was (unreadable, from a newer build, or with students /
// items this build does not know) was copied to a backup key before anything saved over it.
const saveNotice = store.takeNotice();
if (saveNotice) {
  import('./ui/components.js')
    .then(({ modal }) => modal({ title: saveNotice.kept ? 'Save backup kept' : 'Saving paused', body: saveNotice.message, actions: [{ label: 'OK', kind: 'yellow', testid: 'save-notice-ok' }] }))
    .catch((e) => console.warn('[main] save notice failed', e));
}

// [ui-v2] landscape-first: rotate prompt on phone/tablet portrait + orientation lock in fullscreen/PWA.
// The first route's 'screenchange' may fire before this import resolves: pass the route in, so a
// cold load into battle still words the dismiss button for battle.
import('./ui/orientation.js').then((o) => { o.initOrientation({ route: currentRoute().name }); window.__sakura.orientation = o; }).catch((e) => console.warn('[main] orientation helper failed', e));

// Warm up the character GLBs in the background once the first screen is up: the secretary at
// full detail (lobby close-up), then the formation at the detail the quality setting needs
// (chibis-v2: no-arg preloadModels() would fetch all 19 full models ≈ 7.7 MB).
const warmModels = () => import('./models/index.js').then(async (m) => {
  const p = store.profile || {};
  const f = p.formation || {};
  const detail = m.detailFor(p.settings?.quality || 'high');
  if (p.secretary) await m.preloadModels([p.secretary], { detail: 'full' });
  const ids = [f.hero, ...(f.towers || [])].filter(Boolean);
  if (ids.length) await m.preloadModels(ids, { detail });
  else await m.preloadModels([], { detail });
}).catch((e) => console.warn('[main] model preload failed', e));
if ('requestIdleCallback' in window) requestIdleCallback(warmModels, { timeout: 2500 });
else setTimeout(warmModels, 1200);
