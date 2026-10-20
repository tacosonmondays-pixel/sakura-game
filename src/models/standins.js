// Stand-in chibis: roster girls whose art the owner has not approved yet (Tenka; BUILD_PLAN 6.8).
//
// These units have no character GLB yet: until the owner approves their real art, the battle,
// the student 3D view and the formation / lobby show the procedural chibi (src/models/chibi.js)
// built from the unit's own palette + look, and menus show the SVG portrait (src/art/portraits.js
// has no PORTRAIT_DATA row for them). For a stand-in, preloadCharacters / loadCharacter never
// request a .glb (no 404s), so buildChibi keeps the procedural figure.
//
// When a girl's GLB lands in public/models/characters (file + manifest entry), remove her id here:
// tests/models/glb.test.js then checks her file like every other girl's, and it fails while a
// stand-in id also has a manifest entry so the list cannot go stale.
//
// Plain data, no three.js import (tests/data can read it cheaply).

/** Unit ids (= model asset keys) that are deliberately procedural stand-ins. */
export const STANDIN_UNITS = Object.freeze(['tenka']);

const STANDIN_SET = new Set(STANDIN_UNITS);

/**
 * True when a model asset key has no GLB on purpose and is drawn procedurally.
 * @param {string} assetKey manifest key (= unit id), e.g. 'tenka'
 */
export function isStandIn(assetKey) {
  return STANDIN_SET.has(assetKey);
}
