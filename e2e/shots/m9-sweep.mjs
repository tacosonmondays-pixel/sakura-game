// M9 (docs/specs/UI_V2_MENUS.md): the sweep. e2e/menus.mjs --milestone m9 (and --milestone all: every list).
import { isScreen } from './_util.mjs';

export const milestone = 'm9';
export const shots = {
  title: { hash: '#/title', ready: isScreen('title') },
};
export const list = Object.keys(shots);
