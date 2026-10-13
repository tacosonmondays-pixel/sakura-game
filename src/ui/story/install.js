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
// The scene text is one lazy chunk (src/data/story/index.js), loaded only when a scene may play.
import { navigate, currentRoute } from '../router.js';
import {
  onboardingRoute, skipOnboarding, clearedCampaign, storyOf, tutorialPromptDue, tutorialRoute, setTutorial,
} from '../../systems/story.js';
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

  // ---- first clears → after-scenes -----------------------------------------------------------
  let cleared = clearedCampaign(store.profile);
  let queueing = Promise.resolve();
  let queuePending = 0;
  store.on('change', (e) => {
    const reason = e?.reason;
    if (reason === 'story' || reason === 'story-prefs') return;
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
    const s = storyOf(store.profile);
    if (!s.queue.length && !queuePending && name !== 'stage') return;
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
