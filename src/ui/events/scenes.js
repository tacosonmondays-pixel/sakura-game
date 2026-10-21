// Lazy loaders of the event episode scenes (one chunk per event; not in the story's SCENE_LIST).
const LOADERS = {
  halloween: () => import('../../data/events/scenes/halloween.js').then((m) => m.HALLOWEEN_SCENES),
};

/** @returns {Promise<object[]>} the event's scenes ([] when it has none) */
export function loadEventScenes(ev) {
  return LOADERS[ev.key] ? LOADERS[ev.key]() : Promise.resolve([]);
}
