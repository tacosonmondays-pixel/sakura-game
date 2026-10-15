// Story wiring for the running app (owner: story; STORY_SPEC §5.3). main.js loads this lazily after the save:
//   installStory({ store })
// 1. `?onboarding=0` in the page URL marks a pending opening and tutorial skipped (e2e / screenshots only).
// 2. On every screen change: a new player on the lobby is sent to the "Meet Hikari" opening (deep links to other
//    screens still render); then queued after-scenes play as an overlay in campaign order, then stage prep's
//    `before` scene. Never on battle, title or scene screens, and never over an open modal (waits up to 10 s).
//    On 1-1 stage prep, a new player who left the coached battle unfinished is asked once more
//    ("Shall we finish our first lesson together?" → the tutorial battle, or Not now → skipped for good).
// 3. On a store change with reason 'battle-result', newly cleared campaign stages queue their after-scenes
//    (story.queue is saved, so closing the app mid-scene plays it again next session).
// 4. Captain's Journal: checkLessons runs at start, after every battle result and on every screen change
//    (unlocks lessons, mails the welcome 10-pull once). New lessons show Hikari's toast on the next calm
//    non-battle screen; a legacy save gets one summary toast on its first lobby visit instead.
// The scene text is one lazy chunk (src/data/story/index.js), loaded only when a scene may play.
import { navigate, currentRoute } from '../router.js';
import {
  onboardingRoute, skipOnboarding, clearedCampaign, storyOf, markAnnounced, tutorialPromptDue, tutorialRoute, setTutorial,
  checkLessons, legacyAnnounceDue,
} from '../../systems/story.js';
import { JOURNAL_TEXT } from '../../data/story/lessons.js';
import { queueAfterClears, nextQueued, beforeSceneFor } from '../../systems/storyTriggers.js';
import { playStoryScene, hasUnit } from './play.js';

/** Screens a queued scene never plays over. */
export const BLOCKED_SCREENS = new Set(['battle', 'title', 'scene']);
const MODAL_POLL_MS = 400;
const MODAL_WAIT_MS = 10000;
const SETTLE_MS = 260;

let installed = false;
let scenesPromise = null;
const loadScenes = () => (scenesPromise ||= import('../../data/story/index.js'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Something else owns the screen right now: a modal, or the title hand-off still fading out. */
function screenBusy() {
  return !!document.querySelector('.modal-overlay, .tt.tt-handoff, .sp');
}

/** @returns {Promise<boolean>} false when a modal stayed open for 10 s (the next screen change retries) */
async function screenClear() {
  const until = Date.now() + MODAL_WAIT_MS;
  while (screenBusy()) {
    if (Date.now() > until) return false;
    await sleep(MODAL_POLL_MS);
  }
  return true;
}

export function installStory({ store }) {
  if (installed) return;
  installed = true;

  try {
    if (new URLSearchParams(location.search).get('onboarding') === '0' && skipOnboarding(store.profile)) store.commit('story');
  } catch (e) {
    console.warn('[story] onboarding flag failed', e);
  }
  storyOf(store.profile); // a profile from another code path gets its (legacy) block now

  // ---- Captain's Journal: unlocks + welcome mail ---------------------------------------------
  const toastIds = [];
  const lessonsCheck = () => {
    try {
      const r = checkLessons(store.profile);
      if (!r.unlocked.length && !r.mailed) return;
      if (!r.quiet) for (const id of r.unlocked) if (!toastIds.includes(id)) toastIds.push(id);
      store.commit('story');
    } catch (e) {
      console.warn('[story] checking lessons failed', e);
    }
  };
  lessonsCheck();

  // ---- first clears → after-scenes -----------------------------------------------------------
  let cleared = clearedCampaign(store.profile);
  let queueing = Promise.resolve();
  let queuePending = 0;
  store.on('change', (e) => {
    const reason = e?.reason;
    if (reason === 'story' || reason === 'story-prefs' || reason === 'story-claim') return;
    if (reason === 'battle-result' || reason === 'replace') {
      lessonsCheck();
      toastSoon(); // waits for a calm non-battle screen (on battle it waits for the next screen change)
    }
    const now = clearedCampaign(store.profile);
    const fresh = reason === 'battle-result' ? [...now].filter((id) => !cleared.has(id)) : [];
    cleared = now;
    if (!fresh.length) return;
    queuePending++;
    queueing = loadScenes().then((m) => {
      if (queueAfterClears(store.profile, fresh, m.SCENE_LIST, hasUnit).length) store.commit('story');
    }).catch((err) => console.warn('[story] queueing after-scenes failed', err)).finally(() => { queuePending--; });
  });

  // ---- screen changes ------------------------------------------------------------------------
  let pumping = false;
  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      await sleep(SETTLE_MS);
      for (let guard = 0; guard < 12; guard++) {
        const route = currentRoute();
        if (!route.name || BLOCKED_SCREENS.has(route.name)) return;
        await queueing;
        const m = await loadScenes();
        if (!(await screenClear())) return;
        const now = currentRoute();
        if (now.name !== route.name || now.params?.id !== route.params?.id) continue; // moved on: look again
        const scene = nextQueued(store.profile, m.SCENE_LIST, hasUnit)
          || (now.name === 'stage' ? beforeSceneFor(store.profile, now.params?.id, m.SCENE_LIST, hasUnit) : null);
        if (!scene) {
          if (now.name === 'stage' && tutorialPromptDue(store.profile, now.params?.id)) promptTutorial();
          return;
        }
        const how = await playStoryScene(scene, { host: document.body, overlay: true, scenes: m.SCENE_LIST });
        if (how === 'closed') return;
      }
    } catch (e) {
      console.warn('[story] playing a queued scene failed', e);
    } finally {
      pumping = false;
      toastSoon();
    }
  }

  // ---- journal toasts: after scenes, never on battle / title / scene, never over a modal ------
  let toasting = false;
  let toastRetry = null;
  const TOAST_RETRIES = 8;
  const TOAST_RETRY_MS = 1500;
  async function toastSoon(attempt = 0) {
    if (toasting) return;
    clearTimeout(toastRetry);
    const name = currentRoute().name;
    const announce = name === 'lobby' && !onboardingRoute(store.profile) ? legacyAnnounceDue(store.profile) : 0;
    if (!toastIds.length && !announce) return;
    toasting = true;
    try {
      await sleep(SETTLE_MS);
      if (!(await screenClear()) || window.__sakura?.storyBusy || pumping) {
        // something else still owns the screen: look again shortly (the next screen change also retries)
        if (attempt < TOAST_RETRIES) toastRetry = setTimeout(() => toastSoon(attempt + 1), TOAST_RETRY_MS);
        return;
      }
      const now = currentRoute().name;
      if (!now || BLOCKED_SCREENS.has(now) || now === 'journal') return;
      const { showJournalToast } = await import('./toast.js');
      if (announce && now === 'lobby') {
        markAnnounced(store.profile);
        store.commit('story');
        toastIds.length = 0; // the summary covers them
        const { resolveText } = await import('../../data/story/tokens.js');
        showJournalToast({ text: resolveText(JOURNAL_TEXT.legacyAnnounce(announce)), ms: 6000 });
      } else if (toastIds.length) {
        showJournalToast({ ids: toastIds.splice(0) });
      }
    } catch (e) {
      console.warn('[story] journal toast failed', e);
    } finally {
      toasting = false;
    }
  }

  // ---- 1-1 prep: finish the first lesson? ------------------------------------------------------
  let prompting = false;
  function promptTutorial() {
    if (prompting) return;
    prompting = true;
    import('./coach.js').then((m) => m.showTutorialPrompt({
      onStart: () => {
        const r = tutorialRoute();
        navigate(r.name, r.params);
      },
      onLater: () => {
        if (setTutorial(store.profile, 'skipped')) store.commit('story');
      },
    })).catch((e) => console.warn('[story] tutorial prompt failed', e)).finally(() => { prompting = false; });
  }

  const onScreen = (detail) => {
    const name = detail?.name;
    if (name === 'lobby') {
      const r = onboardingRoute(store.profile);
      if (r) {
        navigate(r.name, r.params, { replace: true });
        return;
      }
    }
    if (!name || BLOCKED_SCREENS.has(name)) return;
    lessonsCheck(); // the tutorial ending (done or skipped) opens the first lesson
    if (name === 'journal') toastIds.length = 0; // already reading it
    const s = storyOf(store.profile);
    if (!s.queue.length && !queuePending && name !== 'stage') {
      toastSoon();
      return;
    }
    pump();
  };
  window.addEventListener('screenchange', (e) => onScreen(e.detail));
  // the first route may have rendered before this module loaded
  onScreen(currentRoute());
  // warm the scene chunk once the app is idle (the first stage-prep visit then plays without a wait)
  const warm = () => loadScenes().catch(() => {});
  if (typeof requestIdleCallback === 'function') requestIdleCallback(warm, { timeout: 6000 });
  else setTimeout(warm, 3000);
}
