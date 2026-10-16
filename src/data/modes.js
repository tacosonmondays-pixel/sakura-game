// Battle modes (docs/specs/CODEX_MODES.md §2, §5.1): one battle option (`options.mode`) the sim
// reads from this table. Numbers and ids only: names, card text and colours live in
// src/ui/text/modes.js, outside the co-op id, so a wording fix never forces a co-op update.

export const BATTLE_MODES = Object.freeze({
  standard: Object.freeze({ id: 'standard', order: 0 }),
  // every path walked backwards (XOR with the Rear Ambush map rule)
  reverse: Object.freeze({ id: 'reverse', order: 1, reverse: true }),
  // × walk speed on every spawn, × spacing between spawns of every wave group
  rush: Object.freeze({ id: 'rush', order: 2, speedMul: 1.3, spacingMul: 0.7 }),
  // flat armor by chapter (index = chapter 1-8); minibosses and bosses get bossArmorMul × that
  ironclad: Object.freeze({
    id: 'ironclad',
    order: 3,
    bossArmorMul: 2,
    armorByChapter: Object.freeze([0, 3, 3, 1, 3, 3, 6, 6, 6]), // Easy, Normal
    armorByDifficulty: Object.freeze({
      hard: Object.freeze([0, 2, 2, 1, 2, 2, 4, 4, 4]),
      nightmare: Object.freeze([0, 2, 2, 1, 2, 2, 4, 4, 4]),
    }),
  }),
  // × kill bounties, the wave-clear bonus, rule coin bonuses and girl income; start cash unchanged
  frugal: Object.freeze({ id: 'frugal', order: 4, incomeMul: 0.5 }),
  // one heart, and nothing heals
  laststand: Object.freeze({ id: 'laststand', order: 5, oneLife: true, noHeal: true }),
});

export const MODE_ORDER = Object.freeze(['standard', 'reverse', 'rush', 'ironclad', 'frugal', 'laststand']);

/** The five modes that earn ribbons (every mode but Standard). */
export const RIBBON_MODES = Object.freeze(MODE_ORDER.slice(1));

/** A valid mode id ('standard' for anything unknown). */
export function modeId(id) {
  return typeof id === 'string' && Object.hasOwn(BATTLE_MODES, id) ? id : 'standard';
}

/** Ironclad's flat armor for a stage and difficulty (0 for any other mode). */
export function modeArmor(mode, stage, difficulty) {
  if (!mode || !mode.armorByChapter) return 0;
  const table = mode.armorByDifficulty?.[difficulty] ?? mode.armorByChapter;
  const ch = Math.max(1, Math.min(8, Math.floor(stage?.chapter ?? 4)));
  return table[ch] || 0;
}
