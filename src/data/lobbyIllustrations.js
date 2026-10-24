// Lobby full illustrations (owner, Oct 23: "There are two categories, like the character with the castle backdrop as a
// default and everyone will have a full illustration alt", "you dont need the speech bubbles for these full
// illustration ones"). The lobby background picker (src/ui/lobby/bgPicker.js) groups a girl's backgrounds in two:
//   Backdrops           her stand on the painted academy (day / sunset / night) with her speech bubble: every girl's
//                       default (src/data/lobbyArt.js)
//   Full illustrations  one picture that IS the whole lobby: no stand, no speech bubble, no academy behind it
//                       (src/ui/lobby/artStage.js 'full' mode)
// This file is the one table of full illustrations: adding one = its picture + a 480 px thumb and one row here
// (tests/systems/lobbyIllustrations.test.js checks the files, their sizes and the face points). Every girl gets one
// in time; a girl with none yet just has the Backdrops.
//
// Row fields:
//   id        background id, saved in profile.lobbyBg (never rename a shipped one: hikari-rampart, aoi-archery and
//             sango-harbour shipped as the older "scene" backgrounds and keep their ids)
//   girl      whose it is (choosing it makes her the secretary)
//   title     the picture's name; the picker shows "<her name>: <title>" (lobbyArt.js)
//   desc      one line for the picker tooltip
//   file      the picture, a path under public/art/; thumb: 480 px wide with the same aspect (picker tile, and the
//             blurred first paint behind the art, lined up by the same crop)
//   w, h      the picture's pixel size: the stage reserves its box before the file arrives (no layout shift)
//   faceX/Y   the point between her eyes as fractions of the picture: the crop keeps it clear of the menus, head
//             pats use it, and an event's lantern string keeps off her head
//   headR     her head's half-width as a share of the picture's height (default HEAD_R)
//   tall      true: a portrait screen shows her 3:4 <id>-full.webp instead (that art is the picture's own middle at
//             1:1, so her head keeps its size); otherwise the wide picture is cropped on her face there too
// Plain data + pure helpers (no DOM).
import { artUrl, portraitUrl, portraitFace, PORTRAIT_KINDS } from '../art/portraits.js';

/** Default head half-width as a share of the picture's height (the academy scenes). */
export const HEAD_R = 0.12;

export const FULL_ILLUSTRATIONS = Object.freeze([
  // the older landscape scenes (public/art/lobby/, 1376×768); the stage used to put a bubble beside them
  { id: 'hikari-rampart', girl: 'hikari', title: 'Rampart at Dawn', desc: 'Her sword raised over the academy walls.', file: 'lobby/hikari.webp', thumb: 'lobby/thumbs/hikari.webp', w: 1376, h: 768, faceX: 0.655, faceY: 0.185, headR: 0.094 },
  { id: 'aoi-archery', girl: 'aoi', title: 'Archery Range', desc: 'Morning practice among the training targets.', file: 'lobby/aoi.webp', thumb: 'lobby/thumbs/aoi.webp', w: 1376, h: 768, faceX: 0.568, faceY: 0.219, headR: 0.07 },
  { id: 'sango-harbour', girl: 'sango', title: 'Harbour Festival', desc: 'Waving from the pier as the ships come in.', file: 'lobby/sango.webp', thumb: 'lobby/thumbs/sango.webp', w: 1376, h: 768, faceX: 0.523, faceY: 0.238, headR: 0.1 },
  // the owner's own picture, as is (byte copy; notes make_full_illustrations.py)
  { id: 'yoriko-summer-breeze', girl: 'yoriko', title: 'Summer Breeze', desc: 'A warm wind and a blue summer sky.', file: 'scenes/yoriko-summer-breeze.webp', thumb: 'scenes/thumbs/yoriko-summer-breeze.webp', w: 1216, h: 832, faceX: 0.641, faceY: 0.282, headR: 0.105 },
  // the seven academy girls' wide scenes (public/art/scenes/, about 2.16:1, webp q90 like the portraits; notes make_assets.py)
  { id: 'azami-scene', girl: 'azami', title: 'Gate Duty', desc: 'Morning checkpoint at the academy gate under the cherry trees.', file: 'scenes/azami-scene.webp', thumb: 'scenes/thumbs/azami-scene.webp', w: 1920, h: 889, faceX: 0.6103, faceY: 0.2953, tall: true },
  { id: 'chigusa-scene', girl: 'chigusa', title: 'Greenhouse Morning', desc: 'Watering the seedlings in the academy greenhouse.', file: 'scenes/chigusa-scene.webp', thumb: 'scenes/thumbs/chigusa-scene.webp', w: 1920, h: 887, faceX: 0.6029, faceY: 0.3398, tall: true },
  { id: 'kinu-scene', girl: 'kinu', title: 'Sewing Club', desc: 'Twirling her giant needle in the club room.', file: 'scenes/kinu-scene.webp', thumb: 'scenes/thumbs/kinu-scene.webp', w: 1920, h: 887, faceX: 0.6039, faceY: 0.21, tall: true },
  { id: 'marumi-scene', girl: 'marumi', title: 'Strike Lane', desc: 'Rolling for a strike at the bowling alley.', file: 'scenes/marumi-scene.webp', thumb: 'scenes/thumbs/marumi-scene.webp', w: 1688, h: 780, faceX: 0.6517, faceY: 0.2137, tall: true },
  { id: 'ouka-scene', girl: 'ouka', title: 'Council Room', desc: 'The council banner raised in the student council room.', file: 'scenes/ouka-scene.webp', thumb: 'scenes/thumbs/ouka-scene.webp', w: 1920, h: 887, faceX: 0.565, faceY: 0.3301, tall: true },
  { id: 'wakaba-scene', girl: 'wakaba', title: 'Track Practice', desc: 'A water break for the team on the running track.', file: 'scenes/wakaba-scene.webp', thumb: 'scenes/thumbs/wakaba-scene.webp', w: 1920, h: 889, faceX: 0.6195, faceY: 0.3068, tall: true },
  { id: 'yuzuha-scene', girl: 'yuzuha', title: 'Tech Workshop', desc: 'Checking her sentry bot in the security workshop.', file: 'scenes/yuzuha-scene.webp', thumb: 'scenes/thumbs/yuzuha-scene.webp', w: 1920, h: 889, faceX: 0.62, faceY: 0.26, tall: true },
].map((row) => Object.freeze(row)));

/** id → row */
export const FULL_ILLUSTRATION_MAP = Object.freeze(Object.fromEntries(FULL_ILLUSTRATIONS.map((r) => [r.id, r])));

/** @returns {object[]} one girl's full illustrations (table order) */
export function fullIllustrationsOf(girlId) {
  return FULL_ILLUSTRATIONS.filter((r) => r.girl === girlId);
}

/** @returns {string} base-path-safe URL of a row's picture ('file') or thumb ('thumb') */
export function illustrationUrl(row, key = 'file') {
  return artUrl(key === 'thumb' ? row.thumb || row.file : row.file);
}

/**
 * What the lobby draws for a full illustration on this screen: the wide picture, or (a `tall` row on a portrait
 * screen) her 3:4 full art. fx / fy = her face as fractions of that picture; headR = her head half-width / its height.
 * @param {object|string} rowOrId a FULL_ILLUSTRATIONS row or its id
 * @param {{ portrait?: boolean }} [opts]
 * @returns {{ variant: 'wide'|'tall', src: string, w: number, h: number, fx: number, fy: number, headR: number }|null}
 */
export function fullArt(rowOrId, { portrait = false } = {}) {
  const row = typeof rowOrId === 'string' ? FULL_ILLUSTRATION_MAP[rowOrId] : rowOrId;
  if (!row?.file) return null;
  if (portrait && row.tall) {
    const src = portraitUrl(row.girl, 'full');
    if (src) {
      const [x, y] = portraitFace(row.girl);
      return { variant: 'tall', src, w: PORTRAIT_KINDS.full.w, h: PORTRAIT_KINDS.full.h, fx: x / 100, fy: y / 100, headR: HEAD_R };
    }
  }
  return { variant: 'wide', src: illustrationUrl(row), w: row.w, h: row.h, fx: row.faceX, fy: row.faceY, headR: row.headR || HEAD_R };
}
