// Who sits at the lobby desk (shared by the lobby, the title preloader and the missions hub;
// kept tiny so the title screen can resolve it without loading the lobby module).
import { UNIT_MAP, UNITS } from '../../data/units.js';
import { isPlaceholderPortrait } from '../../art/portraits.js';

/** May she stand at the desk? Owned, with drawn art (a coming-soon signboard never stands on the home). */
const canStand = (profile, id) => !!(id && UNIT_MAP[id] && profile?.units?.[id] && !isPlaceholderPortrait(id));

/** The lobby secretary: profile.secretary when she may stand, else the hero, else the first owned girl. */
export function secretaryOf(profile) {
  const id = profile?.secretary;
  if (canStand(profile, id)) return id;
  const hero = profile?.formation?.hero;
  if (canStand(profile, hero)) return hero;
  return UNITS.find((u) => canStand(profile, u.id))?.id || 'hikari';
}
