// The battle sim id pinned for each COOP_PROTOCOL (tools/simId.mjs). A protocol bump (a real sim change) adds its line
// here; tests/art/itemArtRuntime.test.js explains each one. Shared so a change outside the sim (gear, boxes) can prove the
// sim did not move without a literal that drifts when main moves on.
export const KNOWN_SIM_IDS = Object.freeze({
  8: '92e2e22527cf', 9: '4d7b235077a8', 10: '2c3c74708a2c', 11: '35748b1b58db', 12: 'd35092f141d3', 13: 'be940ecb2087', 14: 'b2ff5e0e884b', 15: '0fe7c5c04aec', 16: 'e3c222f3ad44', 17: '59785dd417a6',
});
