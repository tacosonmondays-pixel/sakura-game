// M3 (docs/specs/UI_V2_MENUS.md): the roster and the girl page (V3). e2e/menus.mjs --milestone m3.
import { isScreen, clickOpen, clicks, scrollBody, holdOn } from './_util.mjs';

export const milestone = 'm3';
const girl = (id, tab, extra = {}) => ({ hash: `#/student/${id}?tab=${tab}`, ready: isScreen('student'), kind: 'detail', ...extra });
export const shots = {
  'students-hold': { hash: '#/students', ready: isScreen('students'), kind: 'list', open: holdOn('#app .unit-card[data-unit="aoi"]') },
  'girl-aoi-info': girl('aoi', 'info'),
  'girl-info-scroll': girl('ruri', 'info', { open: scrollBody('end') }),
  'girl-level': girl('ruri', 'level'),
  'girl-level-manual': girl('ruri', 'level', { open: clicks('#app [data-testid="level-manual"]') }),
  'girl-awaken': girl('ruri', 'awaken'),
  'girl-gear-sheet': girl('ruri', 'gear', { open: clickOpen('#app [data-testid="slot-charm"]', '[data-testid="gear-sheet"]') }),
  'girl-gear-totals': girl('ruri', 'gear', { open: clickOpen('#app [data-testid="gear-more"]', '[data-testid="gear-totals-sheet"]', { force: true }) }),
  'girl-tree': girl('ruri', 'tree'),
  'girl-tree-hero': girl('hikari', 'tree'),
  'girl-outfit': girl('ruri', 'info', { open: clickOpen('#app [data-testid="outfit-open"]') }),
};
// (students, roster-end, girl-info, girl-info-ruri, girl-gear, girl-gear-empty, girl-gear-picker, formation and roster-pick
// are ui-shots' own shots)
export const list = ['students', 'roster-end', 'students-hold', 'girl-info', 'girl-info-ruri', 'girl-aoi-info', 'girl-info-scroll', 'girl-level',
  'girl-level-manual', 'girl-awaken', 'girl-gear', 'girl-gear-empty', 'girl-gear-sheet', 'girl-gear-picker', 'girl-gear-totals', 'girl-tree',
  'girl-tree-hero', 'girl-outfit', 'formation', 'roster-pick'];
