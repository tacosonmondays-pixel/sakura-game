import './ui/styles/base.css';
import { registerRoute, startRouter } from './ui/router.js';
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

store.load();
try {
  onAppStart(store.profile); // daily/weekly resets, login bonus bookkeeping
  store.commit('app-start');
} catch (e) {
  console.error('[main] onAppStart failed', e);
}

document.querySelector('.boot')?.remove();
startRouter(document.getElementById('app'));

// Warm up the chibi base mesh in the background once the first screen is up, so the
// first 3D girl (lobby secretary, battle) uses the real body instead of the fallback.
const warmModels = () => import('./models/index.js').then((m) => m.preloadModels()).catch((e) => console.warn('[main] model preload failed', e));
if ('requestIdleCallback' in window) requestIdleCallback(warmModels, { timeout: 2500 });
else setTimeout(warmModels, 1200);

// Debug/test hook (used by e2e tests). Not a cheat menu: read-only plus store access.
window.__sakura = { store };
