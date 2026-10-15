// Route #/scene/<id>?next=… (owner: story; STORY_SPEC §1.1, D10). The screen host for the scene player: the
// forced opening (next=tutorial → the coached 1-1 battle) and every replay from the Story archive
// (next=story&ch=<n>) or the Captain's Journal (next=journal&lesson=<id>). Leaving the route mid-scene closes
// the player without marking the scene seen.
import { h, toast } from '../components.js';
import { navigate, back } from '../router.js';
import { store } from '../../core/store.js';
import { storyOf, tutorialRoute } from '../../systems/story.js';
import { sceneUnlocked } from '../../systems/storyTriggers.js';
import { TUTORIAL_TEXT } from '../../data/story/tutorial.js';
import { playStoryScene, hasUnit } from './play.js';

/** Where the player goes after the scene. */
export function nextRoute(params = {}) {
  const next = params.next;
  if (next === 'tutorial') return { ...tutorialRoute(), replace: true };
  if (next === 'story') return { name: 'story', params: params.ch != null ? { ch: params.ch } : {}, replace: true };
  if (next === 'journal') return { name: 'journal', params: params.lesson ? { id: params.lesson } : {}, replace: true };
  if (next === 'lobby') return { name: 'lobby', params: {}, replace: true };
  return null;
}

export function render(root, params = {}) {
  const host = h('div.screen.sp-host', { 'data-testid': 'scene-screen' });
  root.appendChild(host);
  let run = null;
  let disposed = false;

  const leave = () => {
    if (disposed) return;
    const r = nextRoute(params);
    if (r) navigate(r.name, r.params, { replace: r.replace });
    else back('story');
  };

  (async () => {
    const idx = await import('../../data/story/index.js');
    if (disposed) return;
    const scene = idx.sceneById(params.id);
    const profile = store.profile;
    if (!scene || !idx.sceneAvailable(scene, hasUnit)) {
      toast('That story episode is not available yet.', 'info');
      navigate('story', {}, { replace: true });
      return;
    }
    // archive episodes need their trigger; lesson scenes are opened by the journal, the opening always plays
    if (scene.kind !== 'lesson' && !sceneUnlocked(profile, scene)) {
      toast('Keep playing the campaign to unlock this episode.', 'info');
      navigate('story', { ch: scene.chapter }, { replace: true });
      return;
    }
    const skipNote = scene.trigger?.opening && storyOf(profile).opening === 'pending' ? TUTORIAL_TEXT.openingSkipExtra : null;
    const how = await playStoryScene(scene, { host, overlay: false, scenes: idx.SCENE_LIST, skipNote, onStart: (r) => { run = r; } });
    if (how === 'closed' || disposed) return;
    leave();
  })().catch((e) => {
    console.error('[story] scene route failed', e);
    if (!disposed) leave();
  });

  return () => {
    disposed = true;
    run?.close?.();
  };
}
