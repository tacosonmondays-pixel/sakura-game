// M1 (docs/specs/UI_V2_MENUS.md): Campaign and Stage prep. Owned by the M1 builder; e2e/menus.mjs --milestone m1.
import { isScreen } from './_util.mjs';

export const milestone = 'm1';
export const shots = {
  'campaign-ch4': { hash: '#/campaign?chapter=4', ready: isScreen('campaign') },
  'campaign-ch1': { hash: '#/campaign?chapter=1', ready: isScreen('campaign') },
  // 4-4 not cleared (the ink save's next stage) and 2-3 cleared (Sweep)
  'stage-prep-new': { hash: '#/stage/4-4', ready: isScreen('stage'), kind: 'detail', limit: 11 },
  'stage-prep-cleared': { hash: '#/stage/2-3', ready: isScreen('stage'), kind: 'detail', limit: 11 },
};
export const list = Object.keys(shots);
