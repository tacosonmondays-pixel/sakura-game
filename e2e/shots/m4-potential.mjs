// M4 (docs/specs/UI_V2_MENUS.md section 6): the Potential Board. e2e/menus.mjs --milestone m4.
import { isScreen, clickOpen } from './_util.mjs';

export const milestone = 'm4';
export const shots = {
  // today: the Potential sheet from her P sticker (the Board replaces it)
  'girl-potential': { hash: '#/student/ruri?tab=info', ready: isScreen('student'), kind: 'detail', open: clickOpen('#app .gp-p', '[data-testid="potential-sheet"], .ui-sheet') },
};
export const list = ['girl-info-ruri', ...Object.keys(shots)];
