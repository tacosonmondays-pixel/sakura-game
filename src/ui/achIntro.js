// The one-time achievements notice on update day (docs/specs/ACHIEVEMENTS.md §3.6): "86 new achievements, Honor
// Ribbons and titles. You've already earned N!" with up to 6 ribbon minis and a button to the tab. Gated by
// seenIntro 'ach2' (a string list every build keeps). A brand-new player is marked without a notice: the tab and
// the toasts introduce everything as they play.

import { h } from './dom.js';
import { modal } from './components.js';
import { navigate, currentRoute } from './router.js';
import { achievementList } from '../systems/missions.js';
import { ownedRibbons } from '../systems/honors.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { ribbonArt } from './honorFx.js';

export const ACH_INTRO_MARK = 'ach2';
/** The rows this notice announces: the launch wave (each later wave gets its own one-line notice). */
const LAUNCH_NEW = ACHIEVEMENTS.filter((a) => !a.shipped && a.wave === 'launch').length;

/** Show the notice once, on the lobby. @returns {boolean} shown now */
export function maybeShowAchievementIntro(store) {
  const p = store.profile;
  p.seenIntro ||= [];
  if (p.seenIntro.includes(ACH_INTRO_MARK)) return false;
  if (currentRoute().name !== 'lobby') return false;
  // never on top of another notice (patch notes, a gift): it waits for the next lobby visit
  if (document.querySelector('.modal-overlay, .ach-fanfare')) return false;
  p.seenIntro.push(ACH_INTRO_MARK);
  const veteran = (p.stats?.battles || 0) > 0 || Object.keys(p.missions?.achievements || {}).length > 0;
  store.commit('settings', { quiet: true });
  if (!veteran) return false;
  const list = achievementList(p);
  const ready = list.filter((a) => a.claimable || a.locked);
  const ribbons = [...ownedRibbons(p), ...ready.filter((a) => a.honor).map((a) => a.id)].slice(0, 6);
  const body = h('div.ach-intro', { 'data-testid': 'ach-intro' },
    h('p.ach-intro-lead', `${LAUNCH_NEW} new achievements, Honor Ribbons and titles!`),
    h('p', ready.length ? `You've already earned ${ready.length}. Everything you earned before is yours to claim, in full.` : 'Your progress so far already counts toward them.'),
    ribbons.length ? h('div.ach-intro-minis', ribbons.map((id) => ribbonArt(id, 40, { still: true }))) : null,
    h('p.muted', 'Some achievements give gear boxes and gems; special Honor Ribbons have their own effects.'));
  modal({
    title: 'Achievements',
    body,
    cls: 'ach-modal',
    actions: [{ label: 'Later', testid: 'ach-intro-later' }, { label: 'Open Achievements', kind: 'yellow', testid: 'ach-intro-open', onClick: (close) => { close(); navigate('commissions', { tab: 'achievements' }); } }],
  });
  return true;
}
