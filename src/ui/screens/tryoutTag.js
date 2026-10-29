// The full words of a Tryout girl tile's tag (Before Class, src/ui/screens/tryoutSetup.js; the co-op room's Tryout
// draft, src/ui/screens/coop.js). Its own small module, so the co-op chunk does not pull Before Class in.

/**
 * The kit's tag chip says the short word ("Yours"); its title and the tile's spoken name say the full words ("Yours ·
 * band cap").
 * @param {HTMLElement} t a girlTile with `tag: short`
 */
export function fullTag(t, short, full) {
  const chip = t.querySelector('[data-testid="card-tag"]');
  if (chip) chip.title = full;
  const aria = t.getAttribute('aria-label');
  if (aria && full !== short) t.setAttribute('aria-label', aria.replace(`, ${short}`, `, ${full}`));
}
