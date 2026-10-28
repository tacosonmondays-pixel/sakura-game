// M4 (docs/specs/UI_V2_MENUS.md section 6): the Potential Board. e2e/menus.mjs --milestone m4.
import { isScreen, clickOpen } from './_util.mjs';
import { seedPotentialStates } from '../uiSeed.mjs';

export const milestone = 'm4';
export const shots = {
  // today: the Potential sheet from her P sticker (the Board replaces it)
  'girl-potential': { hash: '#/student/ruri?tab=info', ready: isScreen('student'), kind: 'detail', open: clickOpen('#app .gp-p', '[data-testid="potential-sheet"], .ui-sheet') },
  // the Board's states (seedPotentialStates): Aoi at P4 with a Raise she can afford, Kaede at P6, Momo at P1
  'girl-info-p4': { hash: '#/student/aoi?tab=info', ready: isScreen('student'), kind: 'detail', prepare: seedPotentialStates },
  'girl-info-p6': { hash: '#/student/kaede?tab=info', ready: isScreen('student'), kind: 'detail', prepare: seedPotentialStates },
  'girl-info-p1': { hash: '#/student/momo?tab=info', ready: isScreen('student'), kind: 'detail', prepare: seedPotentialStates },
};
export const list = ['girl-info-ruri', ...Object.keys(shots)];
