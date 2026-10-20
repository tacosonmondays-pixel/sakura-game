// Every girl in gallery order (shared by the attack-FX tests): Chika first, then the roster in roster
// order. Derived from the roster, so a new girl (Tenka, the returning girls) joins the gallery runs.
import { UNIT_IDS } from '../../src/data/units.js';

export const ORDER = ['chika', ...UNIT_IDS.filter((id) => id !== 'chika')];
