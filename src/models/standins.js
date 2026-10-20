// Stand-in chibis for the returning girls (roster wave, track 5; docs/MODELS.md "Stand-ins for the
// returning girls").
//
// These units have no character GLB yet: until the owner approves their real art, the battle,
// the student 3D view and the formation / lobby show the procedural chibi (src/models/chibi.js)
// built from the unit's own palette + look. The ids are model asset keys (= unit ids, the asset of
// their '<id>_default' skin row). For a stand-in, preloadModels / loadCharacter never request a
// .glb (no 404s) and buildChibi returns the procedural figure without an upgrade hook
// (userData.standIn = true).
//
// When a girl's GLB lands in public/models/characters (file + manifest entry), remove her id here:
// tests/models/glb.test.js then checks her file like every other girl's, and it fails while a
// stand-in id also has a manifest entry so the list cannot go stale.
//
// Plain data, no three.js import (tests/data can read it cheaply).

/** Unit ids (= model asset keys) that are deliberately procedural stand-ins. */
export const STANDIN_UNITS = Object.freeze(['kanna', 'yoriko', 'seiran', 'ruri', 'iroha', 'ena']);

const STANDIN_SET = new Set(STANDIN_UNITS);

/**
 * True when a model asset key has no GLB on purpose and is drawn procedurally.
 * @param {string} assetKey manifest key, e.g. 'kanna' (a SkinDef's `asset`)
 */
export function isStandIn(assetKey) {
  return STANDIN_SET.has(assetKey);
}
