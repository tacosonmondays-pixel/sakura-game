// Tryout Day display text (docs/specs/TRYOUT_DAY.md): every name and description, outside the hashed run table
// (src/data/tryout.js), so a wording fix never forces a co-op update. Players are "they".
import { PEP_CARDS, SCALE, RARITIES } from '../../data/tryout.js';
import { UNIT_MAP } from '../../data/units.js';

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
  B05: { name: 'Spare Pass', line: () => '+1 Hall Pass now and at every later break' },
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

/** Assignments: name and a live line from assignProgress ({ cur, goal }). */
export const ASSIGN_TEXT = {
  a_hearts: { name: 'Full Hearts', live: (p) => `♥ ${p.cur} lost` },
  a_ace: { name: 'Ace the Test', live: (p) => `Score ${p.cur.toLocaleString('en-US')} / ${p.goal.toLocaleString('en-US')}` },
  a_speed: { name: 'Speed Round', live: (p) => `clear each wave within ${p.goal}s of its last foe` },
  a_quick: { name: 'Quick Answer', live: (p) => `beat the big foe within ${p.goal}s` },
  a_sky: { name: 'Sky Guard', live: () => 'flyers fall before halfway' },
  a_guest: { name: 'Guest Lecture', live: () => 'your hero deals 20% of the damage' },
  a_budget: { name: 'Tight Budget', live: (p) => `spent ${p.cur.toLocaleString('en-US')} / ${p.goal.toLocaleString('en-US')}` },
  a_save: { name: 'Save It Up', live: () => 'keep coins unspent' },
  a_star: { name: 'Star Pupil', live: () => 'the named girl carries' },
  a_show: { name: 'Show Her Around', live: () => 'your newest girl defeats foes' },
  a_noreturn: { name: 'No Returns', live: (p) => `${p.cur} sold` },
  a_small: { name: 'Small Class', live: (p) => `${p.cur} / ${p.goal} new girl placed` },
  a_window: { name: 'By the Window', live: () => 'seat girls carry' },
  a_team: { name: 'Team Effort', live: () => '4 girls share the work' },
  a_learner: { name: 'Quick Learner', live: (p) => `${p.cur} / ${p.goal} upgrades` },
  a_finish: { name: 'Big Finish', live: () => 'use your ult twice' },
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
