// Whole-scene lobby art (owner, Oct 23: "instead of the default backgrounds just show the entire art",
// "imagine you got rid of the backdrop for their actual entire scene art"). For these girls the lobby screen IS her
// scene illustration: full bleed, no painted academy behind her and no cut-out stand (src/ui/lobby/artStage.js).
// Their stands were cut out of dynamic scene portraits, so over the backdrop the frame cut props with a straight
// edge (Marumi's ball) and halos floated free; the whole picture has none of that.
//
// Files (public/art/scenes/, made by notes-side make_assets.py; see CONTRACTS "Lobby scenes"):
//   <id>-scene.webp          the wide scene (about 2.16:1), 1688-1920 px wide, webp q90 like the portraits
//   thumbs/<id>-scene.webp   480 px wide, same aspect (background picker tile; blurred first paint behind the art)
// On a portrait screen the lobby shows her 3:4 full illustration (<id>-full.webp, src/art/portraits.js) instead:
// the scenes' middle IS that art at 1:1, so her head is the same size against the picture height either way.
//
// faceX / faceY: the point between her eyes as a fraction of the scene (measured on the masters; Marumi's on her
// landscape). The stage anchors the crop on it, puts the speech bubble beside it and uses it for head pats.
// Plain data + pure helpers (no DOM).
import { portraitUrl, portraitFace, PORTRAIT_KINDS } from '../art/portraits.js';

function baseUrl() {
  let base = './';
  try {
    base = import.meta.env?.BASE_URL ?? './';
  } catch {
    base = './';
  }
  return String(base).replace(/\/?$/, '/');
}

/** Folder of the scene files (with the deploy base). */
export const SCENE_ART_BASE = `${baseUrl()}art/scenes/`;

/** Her head's half-width as a share of the shown picture's height (same in both variants; used for hit zone + bubble gap). */
export const SCENE_HEAD_R = 0.12;

/** Girls whose lobby screen is their whole scene. w × h = the file's pixel size. */
export const LOBBY_SCENES = Object.freeze({
  azami: { file: 'azami-scene.webp', thumb: 'thumbs/azami-scene.webp', w: 1920, h: 889, faceX: 0.6103, faceY: 0.2953, name: 'Gate Duty', desc: 'Morning checkpoint at the academy gate under the cherry trees.' },
  chigusa: { file: 'chigusa-scene.webp', thumb: 'thumbs/chigusa-scene.webp', w: 1920, h: 887, faceX: 0.6029, faceY: 0.3398, name: 'Greenhouse Morning', desc: 'Watering the seedlings in the academy greenhouse.' },
  kinu: { file: 'kinu-scene.webp', thumb: 'thumbs/kinu-scene.webp', w: 1920, h: 887, faceX: 0.6039, faceY: 0.21, name: 'Sewing Club', desc: 'Twirling her giant needle in the club room.' },
  marumi: { file: 'marumi-scene.webp', thumb: 'thumbs/marumi-scene.webp', w: 1688, h: 780, faceX: 0.6517, faceY: 0.2137, name: 'Strike Lane', desc: 'Rolling for a strike at the bowling alley.' },
  ouka: { file: 'ouka-scene.webp', thumb: 'thumbs/ouka-scene.webp', w: 1920, h: 887, faceX: 0.565, faceY: 0.3301, name: 'Council Room', desc: 'The council banner raised in the student council room.' },
  wakaba: { file: 'wakaba-scene.webp', thumb: 'thumbs/wakaba-scene.webp', w: 1920, h: 889, faceX: 0.6195, faceY: 0.3068, name: 'Track Practice', desc: 'A water break for the team on the running track.' },
  yuzuha: { file: 'yuzuha-scene.webp', thumb: 'thumbs/yuzuha-scene.webp', w: 1920, h: 889, faceX: 0.62, faceY: 0.26, name: 'Tech Workshop', desc: 'Checking her sentry bot in the security workshop.' },
});

/** @returns {object|null} her whole-scene row, or null for a girl without one */
export function lobbySceneOf(girlId) {
  return Object.prototype.hasOwnProperty.call(LOBBY_SCENES, girlId || '') ? LOBBY_SCENES[girlId] : null;
}

/** @returns {string} URL of a file in public/art/scenes/ */
export function sceneArtUrl(file) {
  return `${SCENE_ART_BASE}${file}`;
}

/**
 * What the lobby draws for her whole scene: the wide scene on a landscape screen, her 3:4 full illustration on a
 * portrait one. fx / fy = her face as fractions of that picture.
 * @param {string} girlId
 * @param {{ portrait?: boolean }} [opts]
 * @returns {{ variant: 'scene'|'full', src: string, w: number, h: number, fx: number, fy: number }|null}
 */
export function wholeSceneArt(girlId, { portrait = false } = {}) {
  const s = lobbySceneOf(girlId);
  if (!s) return null;
  if (portrait) {
    const src = portraitUrl(girlId, 'full');
    if (src) {
      const [x, y] = portraitFace(girlId);
      return { variant: 'full', src, w: PORTRAIT_KINDS.full.w, h: PORTRAIT_KINDS.full.h, fx: x / 100, fy: y / 100 };
    }
  }
  return { variant: 'scene', src: sceneArtUrl(s.file), w: s.w, h: s.h, fx: s.faceX, fy: s.faceY };
}
