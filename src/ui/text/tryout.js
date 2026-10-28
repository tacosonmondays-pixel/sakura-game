// Tryout Day display text (docs/specs/TRYOUT_DAY.md): every name and description, outside the hashed run table
// (src/data/tryout.js), so a wording fix never forces a co-op update. Players are "they".
import { PEP_CARDS, SCALE, RARITIES } from '../../data/tryout.js';
import { UNIT_MAP } from '../../data/units.js';
import { fmtNum } from '../format.js';

export const MODE_NAME = 'Tryout Day';

export const RARITY_NAMES = RARITIES;

const pct = (v) => `${Math.round(v * 1000) / 10}%`.replace('.0%', '%');
const tiles = (v) => `${Math.round(v * 100) / 100} tiles`;

/** Card names and one-line effects (`{x}` = the number at that rarity). */
export const CARD_TEXT = {
  E01: { name: 'Big Breakfast', line: (m) => `Everyone +${pct(m.damageMul)} damage` },
  E02: { name: 'Morning Stretch', line: (m) => `Everyone +${pct(m.rateMul)} attack speed` },
  E03: { name: 'Good Posture', line: (m) => `Everyone +${tiles(m.range)} reach` },
  E04: { name: 'Kite Day', line: (m) => `Everyone +${pct(m.airMul)} vs flyers` },
  E05: { name: 'Can Opener', line: (m) => `Everyone +${pct(m.classMul.heavy)} vs heavy and scaled armour` },
  E06: { name: 'Test Prep', line: (m) => `Everyone +${pct(m.eliteMul)} vs elites, minibosses and bosses` },
  E07: { name: 'Bubble Popper', line: (m) => `Everyone +${pct(m.barrierMul)} vs barriers` },
  E08: { name: 'Team Huddle', line: (m) => `Everyone +${pct(m.damageMul)} damage and +${pct(m.rateMul)} attack speed` },
  P01: { name: 'Extra Practice', line: (m, u) => `${u} +${pct(m.damageMul)} damage` },
  P02: { name: 'New Sneakers', line: (m, u) => `${u} +${pct(m.rateMul)} attack speed` },
  P03: { name: 'Step Stool', line: (m, u) => `${u} +${tiles(m.range)} reach` },
  P04: { name: 'Scholarship', line: (m, u) => `${u}'s copies and upgrades cost ${pct(m.costCut)} less` },
  P05: { name: 'Hot Streak', line: (m, u) => `${u} +${Math.round(m.critChance * 100)} crit points, +${Math.round(m.critMul * 100) / 100} crit damage` },
  P06: { name: 'Free Refills', line: (m, u, r) => `${u}'s next ${PEP_CARDS.P06.refills[r]} upgrade${PEP_CARDS.P06.refills[r] > 1 ? 's' : ''} (tiers 1-3) are free` },
  B01: { name: 'Snack Fund', line: (m, u, r) => `+${PEP_CARDS.B01.now[r]} coins now and +${PEP_CARDS.B01.perWave[r]} at each of the next ${PEP_CARDS.B01.waves} wave clears (× this stage's coin rate)` },
  B02: { name: 'Spare Change', line: (m, u, r) => `Every foe gives +${PEP_CARDS.B02.bounty[r]} coin${PEP_CARDS.B02.bounty[r] > 1 ? 's' : ''} (the whole team)` },
  B03: { name: "Nurse's Office", line: (m, u, r) => `Heal ${PEP_CARDS.B03.heal[r]} hearts; max hearts +${PEP_CARDS.B03.maxHearts[r]}` },
  B04: { name: 'Sunny Window', line: (m, u, r) => `Window Seats give +${pct(PEP_CARDS.B04.seatDmg[r])} damage and +${PEP_CARDS.B04.seatReach[r]} reach${PEP_CARDS.B04.seatAdd[r] ? '; one more seat' : ''} (the whole team)` },
  B05: { name: 'Spare Pass', line: () => '+1 Hall Pass at every break from now on (the whole team)' },
  B06: { name: 'Rainy-Day Fund', line: () => 'At every period end, +10% of your unspent coins (at most 300 × the coin rate)' },
};

/** A card instance's name and effect line. */
export function cardText(inst) {
  const t = CARD_TEXT[inst.id];
  const c = PEP_CARDS[inst.id];
  if (!t || !c) return { name: inst.id, line: '' };
  let m = {};
  if (c.steps) m = c.steps[inst.r] || {};
  else if (c.mods) {
    const k = SCALE[inst.r];
    for (const [key, v] of Object.entries(c.mods)) {
      if (typeof v === 'number') m[key] = v * k;
      else if (v && typeof v === 'object') m[key] = Object.fromEntries(Object.entries(v).map(([a, b]) => [a, b * k]));
    }
  }
  const who = inst.unit ? UNIT_MAP[inst.unit]?.name || inst.unit : '';
  return { name: t.name, line: t.line(m, who, inst.r) };
}

/** Slot names on the pick sheet. */
export const SLOT_NAMES = ['Team', 'One girl', 'Wild'];

/** A named girl's display name (Star Pupil, Show Her Around), or `fallback` while none is named yet. */
const girlName = (id, fallback) => (id ? UNIT_MAP[id]?.name || id : fallback);

/** Assignments: name and a live line from assignProgress ({ cur, goal, unit? }); shares are whole percents. */
export const ASSIGN_TEXT = {
  a_hearts: { name: 'Full Hearts', live: (p) => `♥ ${p.cur} lost` },
  a_ace: { name: 'Ace the Test', live: (p) => `Score ${fmtNum(p.cur, 'count', { detail: true })} / ${fmtNum(p.goal, 'count', { detail: true })}` },
  a_speed: { name: 'Speed Round', live: (p) => `clear each wave within ${p.goal}s of its last foe` },
  a_quick: { name: 'Quick Answer', live: (p) => `beat the big foe within ${p.goal}s` },
  a_sky: { name: 'Sky Guard', live: (p) => (p.cur > 0 ? `${p.cur} flyer${p.cur > 1 ? 's' : ''} got past halfway` : 'every flyer falls before halfway') },
  a_guest: { name: 'Guest Lecture', live: (p) => `hero damage ${p.cur}% / ${p.goal}%` },
  a_budget: { name: 'Tight Budget', live: (p) => `spent ${fmtNum(p.cur, 'count', { detail: true })} / ${fmtNum(p.goal, 'count', { detail: true })}` },
  a_save: { name: 'Save It Up', live: (p) => `coins kept ${fmtNum(p.cur, 'count', { detail: true })} / ${fmtNum(p.goal, 'count', { detail: true })}` },
  a_star: { name: 'Star Pupil', live: (p) => `${girlName(p.unit, 'Her')} damage ${p.cur}% / ${p.goal}%` },
  a_show: { name: 'Show Her Around', live: (p) => `${girlName(p.unit, 'Your newest girl')}: ${p.cur} / ${p.goal} foes` },
  a_noreturn: { name: 'No Returns', live: (p) => `${p.cur} sold` },
  a_small: { name: 'Small Class', live: (p) => `${p.cur} / ${p.goal} new girl placed` },
  a_window: { name: 'By the Window', live: (p) => `Window Seat damage ${p.cur}% / ${p.goal}%` },
  a_team: { name: 'Team Effort', live: (p) => `${p.cur} / ${p.goal} girls pulling their weight` },
  a_learner: { name: 'Quick Learner', live: (p) => `${p.cur} / ${p.goal} upgrades` },
  a_finish: { name: 'Big Finish', live: (p) => `${p.cur} / ${p.goal} hero ults` },
  a_tell: { name: 'Show and Tell', live: () => 'use abilities' },
};

export const BREAK_NAMES = { recess: 'Recess', lunch: 'Lunch Break', cleaning: 'Cleaning Time' };

export const MOVE_REASONS = {
  notBreak: 'Hall Passes work only during a break.',
  notYours: 'That girl isn\'t yours.',
  hero: 'Heroes move with their own Move button.',
  noPass: 'No Hall Passes left.',
  outOfBounds: 'Outside the classroom.',
  occupied: 'Too close to another girl.',
  path: 'Too close to the road.',
  blocked: 'Something is in the way there.',
  needsWater: 'She can only stand on water.',
  needsLand: 'She needs solid ground.',
};

/** "Next pick: SR 62 · SSR 31 · UR 6 · LR 1" from a row of weights. */
export function oddsLine(w) {
  const tot = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x, i) => (x > 0 ? `${RARITIES[i]} ${Math.round((100 * x) / tot)}` : null)).filter(Boolean).join(' · ');
}

/** The class choice's Subjects (§2.4): name and the period's twist. */
export const SUBJECT_TEXT = {
  subj_science: { name: 'Science', line: 'Poison ×1.4; heavy foes slower' },
  subj_pe: { name: 'P.E.', line: 'In pulses: foes faster; pierce, slash and blast ×1.25' },
  subj_music: { name: 'Music', line: 'In pulses: all damage ×1.25' },
  subj_festival: { name: 'Festival Prep', line: 'Every 3rd wave clear: +120 coins and ult charge' },
  subj_shop: { name: 'Shop Class', line: 'Every 4th wave clear: +150 coins; lightning ×1.2' },
  subj_homeec: { name: 'Home Ec', line: '+3 hearts at every wave clear' },
  subj_night: { name: 'Night Class', line: 'In pulses: holy ×1.5; spectral foes faster' },
  subj_lit: { name: 'Literature', line: 'In pulses: holy ×1.3' },
  subj_geo: { name: 'Geography', line: 'In pulses: slimes slower; lightning ×1.35' },
  subj_winter: { name: 'Winter Sports', line: 'In pulses: foes ×0.7 speed, reach ×0.85' },
  subj_history: { name: 'History', line: 'The Back Gate: even waves come in by the exit road' },
  subj_art: { name: 'Art Class', line: '+1 Window Seat this period' },
};

/** Double Dare curses (§8.3). */
export const DARE_TEXT = {
  swift: 'foes ×1.2 speed',
  regen: 'foes regenerate 2 %/s',
  armored: 'foes +3 armour',
  shielded: 'foes carry a 30 % barrier',
};
