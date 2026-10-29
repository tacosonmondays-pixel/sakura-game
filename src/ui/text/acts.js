// Display-only Act II blurbs for the stage prep hint (kept out of src/data so the sim id does not move).
// `CHAPTERS[c].mechanic` describes Act I; an Act II stage shows its chapter's line here instead.
export const ACT2_MECHANIC = {
  1: 'Rush Hour: city streets, rooftops for girls, a level crossing that closes a lane. Finale: the Frostbitten Heir splits into its guard.',
};

export function mechanicFor(chapter, stage) {
  if (!chapter) return null;
  return stage?.act === 2 ? ACT2_MECHANIC[chapter.id] || null : chapter.mechanic;
}
