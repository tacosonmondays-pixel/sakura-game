// Stand-in chibis: roster girls whose art the owner has not approved yet (BUILD_PLAN 6.8).
// None today: Tenka, the last one, now ships her imported Meshy figure (tenka.glb + the separate
// tenka-coilgun.glb prop). The path stays for a future girl who lands before her model.
//
// These units have no character GLB yet: until the owner approves their real art, the battle,
// the student 3D view and the formation / lobby show the procedural chibi (src/models/chibi.js)
// built from the unit's own palette + look. Menus show her drawn portraits once they have a PORTRAIT_DATA
// row in src/art/portraits.js, else the SVG portrait. The ids are model asset keys (= unit ids, the asset of their
// '<id>_default' skin row). For a stand-in, preloadCharacters / preloadModels / loadCharacter never
// request a .glb (no 404s) and buildChibi keeps the procedural figure without an upgrade hook
// (userData.standIn = true).
//
// A GLB girl still shows the same procedural chibi in her palette while her GLB loads, and keeps it
// if the file fails to load (src/models/index.js buildChibi); a stand-in simply never asks for one.
//
// When a girl's GLB lands in public/models/characters (file + manifest entry), remove her id here:
// tests/models/glb.test.js then checks her file like every other girl's, and it fails while a
// stand-in id also has a manifest entry so the list cannot go stale.
//
// Plain data, no three.js import (tests/data can read it cheaply).

/** Unit ids (= model asset keys) that are deliberately procedural stand-ins. */
export const STANDIN_UNITS = Object.freeze([]);

const STANDIN_SET = new Set(STANDIN_UNITS);

/**
 * True when a model asset key has no GLB on purpose and is drawn procedurally.
 * @param {string} assetKey manifest key (= unit id, a SkinDef's `asset`), e.g. 'tenka'
 */
export function isStandIn(assetKey) {
  return STANDIN_SET.has(assetKey);
}
