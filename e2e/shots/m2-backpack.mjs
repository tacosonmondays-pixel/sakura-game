// M2 (docs/specs/UI_V2_MENUS.md): the Backpack and the gear grid. e2e/menus.mjs --milestone m2.
import { isScreen, clickOpen, scrollBody } from './_util.mjs';

export const milestone = 'm2';
const bp = (tab, extra = {}) => ({ hash: `#/backpack?tab=${tab}`, ready: isScreen('backpack'), kind: 'list', ...extra });
export const shots = {
  'backpack-all': bp('all'),
  'backpack-enhancement': bp('enhancement'),
  'backpack-awakening': bp('awakening'),
  'backpack-tickets': bp('tickets'),
  'backpack-tokens': bp('tokens'),
  'backpack-equipment-end': bp('equipment', { open: scrollBody('end') }),
  // (backpack-equipment and backpack-salvage are ui-shots' own shots; salvage: salvage mode with a piece picked beside a Mythic one)
  'backpack-item-sheet': bp('all', { open: clickOpen('#app .item-tile') }),
};
export const list = ['backpack-all', 'backpack-enhancement', 'backpack-awakening', 'backpack-tickets', 'backpack-tokens', 'backpack-equipment',
  'backpack-equipment-end', 'backpack-item-sheet', 'backpack-salvage'];
