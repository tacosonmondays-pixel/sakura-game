import './ui/styles/base.css';
import './ui/styles/components.css'; // UI condense shared components (docs/specs/UI_DIRECTION.md §5)
import { registerRoute, startRouter, currentRoute, prefetchRoutes } from './ui/router.js';
import { whenSettled, txLog, transitionBusy } from './ui/transitions/index.js';
import { store } from './core/store.js';
import { onAppStart } from './systems/missions.js';
import { ensureBetaGift, ensurePotentialLetter, ensureEssenceLetter } from './systems/mail.js';
import { ensureCatchUpJoins, joinToastText } from './systems/catchUpJoins.js';
import { createRng, hashString } from './core/rng.js';
import { settleEvents, markEventLogin } from './systems/events.js';
import { eventNow } from './ui/events/clock.js';
import { formationSkins } from './systems/skins.js';
import { applyLoadingLook } from './ui/loading/mochi.js';

const TITLE_SEEN_KEY = 'sakura-title-seen'; // same key as src/ui/screens/title.js (kept tiny here)

// Every screen module exports render(root, params) => cleanup?
registerRoute('title', () => import('./ui/screens/title.js')); // [first impressions] load-up / Tap to Start
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
registerRoute('titans', () => import('./ui/screens/titans.js')); // [ascension] Titan Trials, the weekly bosses
registerRoute('challenge', () => import('./ui/screens/challenge.js'));
registerRoute('sandbox', () => import('./ui/screens/sandbox.js')); // solo test range (any map, any girl, no rewards)
registerRoute('mall', () => import('./ui/screens/mall.js'));
registerRoute('commissions', () => import('./ui/screens/commissions.js'));
registerRoute('rewards', () => import('./ui/screens/rewards.js'));
registerRoute('event', () => import('./ui/screens/event.js')); // [events] limited event page: #/event/<id>?tab=…
registerRoute('bestiary', () => import('./ui/screens/bestiary.js'));
registerRoute('wiki', () => import('./ui/screens/wiki.js'));
registerRoute('settings', () => import('./ui/screens/settings.js'));
registerRoute('missions', () => import('./ui/screens/missions.js')); // [ui-v2] mission hub (Campaign button)
// [online] global chat, clans (+ clan boss, dev Supply Bot), real-time co-op rooms
registerRoute('chat', () => import('./ui/screens/chat.js'));
registerRoute('clan', () => import('./ui/screens/clan.js'));
registerRoute('coop', () => import('./ui/screens/coop.js'));
// [social] private messages, friends, blocks (#/messages[/<threadId>|/new][?tab=…])
registerRoute('messages', () => import('./ui/screens/messages.js'));
registerRoute('soundtest', () => import('./audio/soundTest.js')); // [audio] jukebox + SFX pads + loop-seam check
registerRoute('scene', () => import('./ui/story/scene.js')); // [story] scene player: #/scene/<id>?next=…
registerRoute('story', () => import('./ui/story/archive.js')); // [story] Story archive
registerRoute('journal', () => import('./ui/story/journal.js')); // [story] Captain's Journal
registerRoute('profile', () => import('./ui/screens/profile.js')); // [profile] Sensei Profile: #/profile (yours)

store.load();
// the in-game "Reduce motion" setting, before the first screen moves (CSS + src/ui/transitions read it)
try {
  document.documentElement.toggleAttribute('data-reduce-motion', !!store.profile.settings?.reduceMotion);
} catch {
  /* no DOM */
}
// the loading screen's look (Settings → Loading screen): index.html's inline script already put the
// saved one on <html>; this keeps it right after a migration, an import, a reset or another tab's save
applyLoadingLook(store.profile.settings);
store.on('change', () => applyLoadingLook(store.profile.settings));
// Debug/test hook (used by e2e tests). Not a cheat menu: read-only plus store access.
window.__sakura = { store, transitions: { log: txLog, busy: transitionBusy } };
let caughtUp = [];
try {
  onAppStart(store.profile); // daily/weekly resets, login bonus bookkeeping
  ensureBetaGift(store.profile); // Beta Tester Thank-You mail (accounts up to 2026-11-07 CST), once
  ensurePotentialLetter(store.profile); // "Potential grew!" once, to a save from an older build with a girl at P2+ (Potential v3)
  settleEvents(store.profile, eventNow()); // [events] ended events: unclaimed rewards + leftover currency → coins by mail (once)
  markEventLogin(store.profile, eventNow()); // [events] the day's event visit: login mission + the daily gift letter
  ensureEssenceLetter(store.profile); // [ascension] "Duplicates are now Essence!" once, to a save the switch-over ran on
  caughtUp = ensureCatchUpJoins(store.profile); // Azami / Yuzuha / Noa / Wakaba / Hana join once (a letter each) when 2-2 / 4-2 / 6-2 / 6-5 / 7-5 was cleared before they existed
  store.commit('app-start');
} catch (e) {
  console.error('[main] onAppStart failed', e);
}
// the girls who just joined because their stage was already cleared: one toast on the first lobby
// naming them all ("Azami, Yuzuha and Wakaba joined your academy!"), never one per girl on top of each other
if (caughtUp.length) {
  const text = joinToastText(caughtUp);
  const onLobby = () => {
    if (currentRoute().name !== 'lobby') return;
    window.removeEventListener('lobby-stage-ready', onLobby);
    import('./ui/components.js').then(({ toast }) => toast(text, 'good', 6000)).catch(() => {});
  };
  window.addEventListener('lobby-stage-ready', onLobby);
}
// [achievements] Honor Ribbon masks, the unlock toasts (the first check is the baseline: nothing toasts on app start)
// and the one-time update-day notice on the lobby
import('./ui/achToast.js').then(async (m) => {
  (await import('./ui/honorFx.js')).installHonorMasks();
  m.installAchievementToasts(store);
  const intro = await import('./ui/achIntro.js');
  const tryIntro = () => {
    try {
      intro.maybeShowAchievementIntro(store);
      if (intro.allIntrosSeen(store.profile)) window.removeEventListener('hashchange', later);
    } catch (e) {
      console.warn('[main] achievements notice failed', e);
    }
  };
  const later = () => setTimeout(tryIntro, 600);
  window.addEventListener('hashchange', later);
  later();
}).catch((e) => console.warn('[main] achievements install failed', e));
// [story] opening hand-off, after-scene queue, stage-prep scenes (lazy: the scene text is its own chunk)
import('./ui/story/install.js').then((m) => m.installStory({ store })).catch((e) => console.warn('[main] story install failed', e));

// A co-op freeplay run this browser could not pay (reloaded, closed, or the phone threw the tab
// away mid-run): its freeplay part is paid now, from the last wave it saved.
if (store.profile.progress?.freeplayPending) {
  import('./online/coop/rewards.js')
    .then((r) => {
      const paid = r.payPendingFreeplayRuns(store.profile, (seed) => createRng(hashString(`fp-pending:${seed}:${Date.now()}`)));
      store.commit('freeplay-pending');
      store.saveNow();
      if (!paid.length) return;
      return import('./ui/components.js').then(({ toast }) => {
        for (const o of paid) {
          const f = o.freeplay;
          toast(`Freeplay run paid: ${o.stageId} · ${f.tierName} · ${f.cleared}/${f.goal}${f.coins ? ` · +${f.coins.toLocaleString('en-US')} coins` : ''}${f.caches ? ` · ${f.caches} cache${f.caches > 1 ? 's' : ''}` : ''}`, 'good', 6000);
        }
      });
    })
    .catch((e) => console.warn('[main] pending freeplay payout failed', e));
}

// Cold start (no route in the URL): the title / load-up screen, once per browser session.
let titleSeen = false;
try {
  titleSeen = sessionStorage.getItem(TITLE_SEEN_KEY) === '1';
} catch {
  titleSeen = false;
}
if (!location.hash.replace(/^#\/?/, '') && !titleSeen) history.replaceState(null, '', '#/title');

// The boot loader (index.html: black or colour, Mochi bottom-right) stays until the first screen is really
// drawn: the router's first change holds it (src/ui/transitions), the lobby until its art has decoded.
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
    .then(({ modal }) => modal({ title: saveNotice.title || (saveNotice.kept ? 'Save backup kept' : 'Saving paused'), body: saveNotice.message, actions: [{ label: 'OK', kind: 'yellow', testid: 'save-notice-ok' }] }))
    .catch((e) => console.warn('[main] save notice failed', e));
}

// Another tab finished, restarted or replaced a saved battle this tab still holds (src/core/store.js):
// this tab stopped saving so it never brings that battle back or erases the other tab's rewards.
// Any other save by another tab only shows the "Open in another tab" pill (ui/staleBanner.js).
store.on('stale', ({ reason } = {}) => {
  if (reason !== 'battle-save') return;
  import('./ui/components.js')
    .then(({ modal }) => modal({
      title: 'Opened in another tab',
      body: 'Sakura Sentinels was played in another tab, so this tab stopped saving. Reload to carry on with your latest progress.',
      dismissable: false,
      actions: [{ label: 'Reload', kind: 'yellow', icon: 'refresh', testid: 'stale-reload', onClick: () => location.reload() }],
    }))
    .catch((e) => console.warn('[main] stale-tab notice failed', e));
});

// [ui-v2] landscape-first: rotate prompt on phone/tablet portrait + orientation lock in fullscreen/PWA.
// The first route's 'screenchange' may fire before this import resolves: pass the route in, so a
// cold load into battle still words the dismiss button for battle.
import('./ui/orientation.js').then((o) => { o.initOrientation({ route: currentRoute().name }); window.__sakura.orientation = o; }).catch((e) => console.warn('[main] orientation helper failed', e));

// Once the first screen is uncovered: warm up the character GLBs (the secretary at full detail for the
// lobby close-up, then the formation at the detail the quality setting needs; chibis-v2: no-arg
// preloadModels() would fetch all 19 full models ≈ 7.7 MB), and download the common menu screens'
// code in idle time, so their first visit opens as fast as the second (no loading chip).
const warmModels = () => import('./models/index.js').then(async (m) => {
  const p = store.profile || {};
  const f = p.formation || {};
  const detail = m.detailFor(p.settings?.quality || 'high');
  if (p.secretary) await m.preloadModels([p.secretary], { detail: 'full', skins: formationSkins(p, [p.secretary]) });
  const ids = [f.hero, ...(f.towers || [])].filter(Boolean);
  if (ids.length) await m.preloadModels(ids, { detail, skins: formationSkins(p, ids) });
  else await m.preloadModels([], { detail });
}).catch((e) => console.warn('[main] model preload failed', e));
const idle = (fn, timeout) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, Math.min(timeout, 1200)));
whenSettled().then(() => {
  idle(warmModels, 2500);
  idle(() => prefetchRoutes(['missions', 'campaign', 'stage', 'students', 'student', 'formation', 'recruit', 'titans']), 4000);
});

// [social] badges, live DMs and invite pop-ups for players who already went online (a stored
// online name, or a kept sign-in after "Not now"; the hub never creates an account). It also publishes
// their Sensei Profile card (ensureOnline → profileSync) without the Profile screen ever being opened.
// Lazy, after the first screen.
try {
  // (local mode keeps the name and the account per tab; startSocialHub() checks the right one)
  if ([localStorage, sessionStorage].some((st) => st.getItem('ss-online-v1')?.includes('"name"'))
    || localStorage.getItem('ss-online-auth') || sessionStorage.getItem('ss-online-tab')) {
    setTimeout(() => import('./ui/online/socialHub.js').then((m) => m.startSocialHub()).catch((e) => console.warn('[main] social hub unavailable', e)), 1500);
  }
} catch {
  /* storage blocked: no hub until the player opens an online screen */
}

// [audio] music + SFX engine (docs/AUDIO.md): lazy, never blocks the first screen
import('./audio/index.js').then((a) => a.initAudio({ store })).catch((e) => console.warn('[main] audio unavailable', e));

// New deploys: version.json is checked now and then; a "New version ready" pill offers the
// update (never during a battle), and a stale tab missing screen files reloads itself once.
import('./ui/updateBanner.js').then((u) => u.initUpdateBanner()).catch((e) => console.warn('[main] update check unavailable', e));
// [unit-info] hold a girl's card (or right-click it) on a menu screen → her info sheet (request #152)
import('./ui/hold.js').then((m) => m.installHoldInfo()).catch((e) => console.warn('[main] hold info unavailable', e));
// two tabs share one save: a tab another tab saved over stops saving and says "reload" (store.js)
import('./ui/staleBanner.js').then((b) => b.initStaleBanner()).catch((e) => console.warn('[main] stale-save banner unavailable', e));
