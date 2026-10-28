// Brigade barks (Gate Arc S3a, STORY §7.3 "How the Brigade sounds"): short UI lines over the
// Brigade's units on the road, render only (src/ui/battle/barks.js shows them as chips). At most
// six words each, like the monster rule; one chip at a time per side of the board, ≤ 1.6 s.
// No bark describes a wound or a body: a unit that is beaten is "down", a Gnat's little screen
// reads LINK LOST. Keyed by unit id (a variant id `brigade_gnat_*` uses its base unit's lines) and
// event: `spawn` over a group as it comes on, `beaten` over a unit as it falls.
//
// Step 3 fields only the Gnat (3-9's spotter groups); the other units' lines arrive with them.

/** Longest bark in words (the monster rule). */
export const BARK_MAX_WORDS = 6;
/** How long a chip stays up (seconds). */
export const BARK_SECONDS = 1.6;

/** unit id → { spawn: string[], beaten: string[] } */
export const BARKS = Object.freeze({
  brigade_gnat: Object.freeze({
    spawn: Object.freeze(['Gnats up!', 'Channel 9, moving up!']),
    // the screen text, as a chip (the stand-in model has no screen of its own)
    beaten: Object.freeze(['LINK LOST']),
  }),
});

/** Bestiary lines for the Brigade's units (the Gnat's ships with its def, S3c). */
export const BRIGADE_LORE = Object.freeze({
  brigade_gnat: 'Watches everything. Understands nothing. Reports both.',
});

/** The unit whose lines an enemy id uses (its own, or its base unit's for a variant id), or null. */
export function barkUnit(enemyId) {
  const id = String(enemyId || '');
  if (BARKS[id]) return id;
  for (const key of Object.keys(BARKS)) if (id.startsWith(`${key}_`)) return key;
  return null;
}

/**
 * The bark for an enemy and event, or null when it has none.
 * @param {string} enemyId
 * @param {'spawn'|'beaten'} event
 * @param {number} [n] which line (cycles through the event's lines)
 */
export function barkFor(enemyId, event, n = 0) {
  const unit = barkUnit(enemyId);
  const lines = unit ? BARKS[unit][event] : null;
  if (!lines || !lines.length) return null;
  return lines[((n % lines.length) + lines.length) % lines.length];
}
