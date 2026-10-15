// Plays one story scene with the profile wired in (owner: story): text speed / Auto from story.prefs, the choice
// log, "seen" bookkeeping with the first-read reward, and the busy flag other screens check
// (window.__sakura.storyBusy). Used by the scene route (screen host), the queue (overlay host) and the archive.
import { store } from '../../core/store.js';
import { toast } from '../components.js';
import { UNIT_MAP } from '../../data/units.js';
import { storyOf, setStoryPrefs } from '../../systems/story.js';
import { markSeen, recordChoice, episodeNumber } from '../../systems/storyTriggers.js';

export const hasUnit = (id) => !!UNIT_MAP[id];

function setBusy(on) {
  try {
    window.__sakura ||= {};
    window.__sakura.storyBusy = on;
  } catch {
    /* no window */
  }
}

/** "+20 gems · first read" toast (nothing on replays). */
export function announceFirstRead(rewards) {
  const gems = (rewards || []).filter((r) => r.id === 'gems').reduce((n, r) => n + r.count, 0);
  if (gems > 0) toast(`First read · +${gems} gems`, 'good', 2400);
}

/**
 * Play a scene and record it. Resolves with the player's result ('done' | 'skipped' | 'closed'); a closed scene
 * (route left mid-scene) is not marked seen, so a queued one plays again later.
 * @param {object} scene
 * @param {{ host?: HTMLElement, overlay?: boolean, scenes?: object[], skipNote?: string|null, onStart?: (run) => void }} [opts]
 */
export async function playStoryScene(scene, { host = document.body, overlay = false, scenes = [], skipNote = null, onStart = null } = {}) {
  const { playScene } = await import('./player.js');
  const profile = store.profile;
  const s = storyOf(profile);
  setBusy(true);
  try {
    const run = playScene(scene, {
      host,
      overlay,
      episode: episodeNumber(scene, scenes, hasUnit),
      prefs: s.prefs,
      reduceMotion: !!profile.settings?.reduceMotion,
      skipNote,
      hasUnit,
      onPrefs: (prefs) => {
        setStoryPrefs(store.profile, prefs);
        store.commit('story-prefs');
      },
      onChoice: (index) => {
        recordChoice(store.profile, scene.id, index);
        store.commit('story');
      },
    });
    onStart?.(run);
    const how = await run;
    if (how !== 'closed') {
      const r = markSeen(store.profile, scene, { skipped: how === 'skipped' });
      store.commit('story');
      announceFirstRead(r.rewards);
    }
    return how;
  } finally {
    setBusy(false);
  }
}
