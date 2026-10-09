// Who sits at the lobby desk (shared by the lobby, the title preloader and the missions hub;
// kept tiny so the title screen can resolve it without loading the lobby module).
import { UNIT_MAP, UNITS } from '../../data/units.js';

/** The lobby secretary: profile.secretary when owned, else the hero, else the first owned girl. */
export function secretaryOf(profile) {
  const id = profile?.secretary;
  if (id && UNIT_MAP[id] && profile.units?.[id]) return id;
  const hero = profile?.formation?.hero;
  if (hero && UNIT_MAP[hero] && profile.units?.[hero]) return hero;
  return UNITS.find((u) => profile?.units?.[u.id])?.id || 'hikari';
}
