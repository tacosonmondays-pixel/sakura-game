// Brigade barks (Gate Arc S3a, STORY §7.3 "How the Brigade sounds"): short UI lines over the
// Brigade's units on the road, render only (src/ui/battle/barks.js shows them as chips). At most
// six words each, like the monster rule; one chip at a time per side of the board, ≤ 1.6 s.
// No bark describes a wound or a body: a unit that is beaten is "down", a Gnat's little screen
// reads LINK LOST. Keyed by unit id (a variant id `brigade_gnat_*` uses its base unit's lines) and
// event: `spawn` over a group as it comes on, `beaten` over a unit as it falls.
//
// Step 3 fielded only the Gnat (3-9's spotter groups); Step 4 adds the troopers, the Tortoise and the Badger.

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
  // Gate Arc Step 4 (STEP4_BUILD_PLAN decision 4): a beaten trooper is "down", a van's crew climbs out
  brigade_trooper: Object.freeze({
    spawn: Object.freeze(['Contact front!']),
    beaten: Object.freeze(['Trooper down!']),
  }),
  brigade_shieldline: Object.freeze({
    spawn: Object.freeze(['Shields! Form a line!']),
    beaten: Object.freeze(['Close up! Close up!']),
  }),
  brigade_tortoise: Object.freeze({
    spawn: Object.freeze(['Tortoise rolling!']),
    beaten: Object.freeze(['Crew out! Crew out!']),
  }),
  // (the Badger rolls on in silence; only its crew's call when it is beaten)
  brigade_badger: Object.freeze({
    beaten: Object.freeze(['Fall back! Fall back!']),
  }),
});

/** Bestiary lines for the Brigade's units (the Gnat's ships with its def, S3c). */
export const BRIGADE_LORE = Object.freeze({
  brigade_gnat: 'Watches everything. Understands nothing. Reports both.',
  brigade_trooper: 'Signed up for floods and fires. Got a gate instead. Still says sorry.',
  brigade_shieldline: 'Holds the line because the line is holding them.',
  brigade_tortoise: 'Slow, loud and full of people who would rather be home.',
  brigade_badger: 'Somebody painted a badger on it. Everyone salutes the badger.',
});

/** The unit whose lines an enemy id uses (its own, or its base unit's for a variant id), or null. */
export function barkUnit(enemyId) {
  const id = enemyId || '';
  if (BARKS[id]) return id;
  if (!id.startsWith('brigade_')) return null; // every shipped monster leaves here (this runs on every spawn / defeat)
  for (const key in BARKS) if (id.startsWith(`${key}_`)) return key;
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
