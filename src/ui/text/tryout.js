// Tryout Day display text (docs/specs/TRYOUT_DAY.md): every name and description, outside the hashed run table
// (src/data/tryout.js), so a wording fix never forces a co-op update. Players are "they".
import { PEP_CARDS, RARITIES } from '../../data/tryout.js';
import { TRYOUT_META } from '../../data/tryoutMeta.js';
import { cardMods } from '../../sim/tryout/pep.js';
import { UNIT_MAP } from '../../data/units.js';
import { fmtNum } from '../format.js';
import { getItem } from '../../data/items.js';

export const MODE_NAME = 'Tryout Day';

export const RARITY_NAMES = RARITIES;

const pct = (v) => `${Math.round(v * 1000) / 10}%`.replace('.0%', '%');
const tiles = (v) => `${Math.round(v * 100) / 100} tiles`;

const SET_NAMES = { pierce: 'Pierce', blast: 'Blast', slash: 'Slash', mystic: 'Mystic', holy: 'Holy', control: 'Control', support: 'Support' };
/** A Group card's set as a word ("Slash"); an element list reads "Elemental". */
function setName(id) {
  const set = PEP_CARDS[id]?.set || {};
  if (Array.isArray(set.element)) return 'Elemental';
  const k = set.attackType || set.category || set.element || '';
  return SET_NAMES[k] || k.charAt(0).toUpperCase() + k.slice(1);
}

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
  B04: { name: 'Sunny Window', line: (m, u, r) => `Window Seats give +${pct(PEP_CARDS.B04.seatDmg[r])} damage${PEP_CARDS.B04.seatAdd[r] ? '; one more seat' : ''} (the whole team)` },
  B05: { name: 'Spare Pass', line: () => '+1 Hall Pass at every break from now on (the whole team)' },
  B06: { name: 'Rainy-Day Fund', line: () => 'At every period end, +10% of your unspent coins (at most 300 × the coin rate)' },
  B07: { name: 'Multiple Choice', line: () => `Every later pick shows ${3 + PEP_CARDS.B07.cards} cards and +${PEP_CARDS.B07.erasers} Eraser; Hand it in no longer pays coins` },
  B08: { name: 'Extra Desk', line: () => `+${PEP_CARDS.B08.squad} squad spot and your next pick is a Tryout pick; max hearts −${-PEP_CARDS.B08.draw.maxHearts}` },
  G01: { name: 'Sharp Pencils', line: (m) => `${setName('G01')} girls +${pct(m.damageMul)} damage${m.pierce ? `, +${m.pierce} pierce` : ''}` },
  G02: { name: 'Science Fair', line: (m) => `${setName('G02')} girls +${pct(m.damageMul)} damage, +${tiles(m.splash)} splash` },
  G03: { name: 'Sword Drills', line: (m) => `${setName('G03')} girls +${pct(m.damageMul)} damage, +${Math.round(m.critChance * 100)} crit points` },
  G04: { name: 'Library Hour', line: (m) => `${setName('G04')} girls +${pct(m.damageMul)} damage, +${pct(m.classMul.warded)} vs warded` },
  G05: { name: 'Shrine Visit', line: (m) => `${setName('G05')} girls +${pct(m.damageMul)} damage; hits reveal veiled foes for ${m.reveal} s` },
  G06: { name: 'Weather Report', line: (m) => `${setName('G06')} girls +${pct(m.damageMul)} damage; burns and poisons +${pct(m.dotMul)}` },
  G07: { name: 'Crossing Guards', line: (m) => `${setName('G07')} girls +${pct(m.rateMul)} attack speed, +${tiles(m.range)} reach` },
  G08: { name: 'Backstage Crew', line: (m) => `${setName('G08')} girls: aura and office reach +${tiles(m.auraRange)}, aura bonuses +${Math.round(m.auraPoints * 100)} points` },
  L01: { name: 'Desk Partners', line: (m) => `+${pct(m.rateMul)} attack speed for girls with another girl within ${tiles(PEP_CARDS.L01.near)}` },
  L02: { name: 'Quiet Corner', line: (m) => `+${pct(m.damageMul)} damage for girls with no other girl within ${tiles(PEP_CARDS.L02.alone)}` },
  T_aoi: { name: 'Blessed Arrows', line: (m, u) => `${u}'s arrows become holy (×2 vs spectral) and she gains Veil Sight` },
  T_rei: { name: 'Flying Slash', line: (m, u) => `${u} can hit flyers; sweep +0.5 tiles` },
  T_yuki: { name: 'Snowball Fight', line: (m, u) => `25% of ${u}'s snowballs freeze for 0.5 s; splash +0.3 tiles` },
  T_akane: { name: 'Sparkler Rain', line: (m, u) => `${u} throws 3 fireballs at 55% each, spread wide` },
  T_kage: { name: 'Ambidextrous', line: (m, u) => `${u} +2 shuriken per throw, +1 pierce` },
  T_shiro: { name: 'Piercing Round', line: (m, u) => `${u}'s shots pass through 1 more foe` },
  T_raika: { name: 'Lightning Round', line: (m, u) => `${u} +3 jumps; shock 0.3 s` },
  T_hotaru: { name: 'Parade of Lights', line: (m, u) => `${u} +4 targets, +0.5 tiles reach` },
  T_kaede: { name: 'Focused Mind', line: (m, u) => `${u} keeps 60% of her focus when her target falls; can hit flyers` },
  T_chika: { name: 'Tinker Time', line: (m, u) => `${u} +2 drones` },
  T_fuu: { name: 'Gather Round', line: (m, u) => `${u}'s gusts gather the wave into a clump for splash girls` },
  T_marumi: { name: 'Bonus Frame', line: (m, u) => `${u}'s balls ricochet to 2 more walkers` },
  U01: { name: 'School Spirit', line: (m) => `Everyone +${pct(m.damageMul)} damage, +${pct(m.rateMul)} attack speed, +${tiles(m.range)} reach; −1 Hall Pass at every later break` },
  U02: { name: 'Fire and Ice', line: () => 'Fire hits leave foes Brittle (+10% damage from everyone for 3 s); frost girls +30% damage; −10% damage for girls who are neither' },
  U03: { name: 'Thunder and Rain', line: () => 'Water hits Soak for 3 s; lightning girls +1 jump, +30% damage; −10% damage for girls who are neither' },
  U04: { name: 'Light and Shadow', line: () => 'Holy hits reveal for 3 s; pierce girls +12 crit points; −10% damage for girls who are neither' },
  U05: { name: 'Varsity Letter', line: (m, u) => `${u || 'A squad girl'} gains Varsity (+15% damage, +10% attack speed, copies 10% cheaper); your next pick shows ${PEP_CARDS.U05.draw.nextCards} cards` },
  X01: { name: 'Hundred Points', line: (m) => `Everyone +${pct(m.damageMul)} damage, +${pct(m.rateMul)} attack speed; foes +${pct(PEP_CARDS.X01.draw.foeHp)} HP for the rest of the run` },
  X02: { name: 'Whole Class Turns Up', line: () => `Take ${PEP_CARDS.X02.girls} of ${PEP_CARDS.X02.of} girls, both with the SSR arrival package; +${PEP_CARDS.X02.squad} squad spot; your next pick is skipped` },
  X03: { name: 'Golden Chalk', line: () => `Window Seats +${PEP_CARDS.X03.seatAdd} and the seat bonus to its cap (+50% damage); −1 Hall Pass at every later break` },
  X04: { name: 'Final Bell', line: () => `Last wave of every period: all girls +${pct(PEP_CARDS.X04.lastWave.rateMul)} attack speed, +${pct(PEP_CARDS.X04.lastWave.damageMul)} damage; first wave: −${pct(-PEP_CARDS.X04.firstWave.damageMul)} damage` },
};

/** A card instance's name and effect line. */
export function cardText(inst) {
  const t = CARD_TEXT[inst.id];
  const c = PEP_CARDS[inst.id];
  if (!t || !c) return { name: inst.id, line: '' };
  // The battle's own numbers (scaling cards × SCALE[r]; talents, build cards and capstones as written).
  const m = cardMods(c, inst.r) || {};
  const who = inst.unit ? UNIT_MAP[inst.unit]?.name || inst.unit : '';
  // a Hidden Talent at UR also adds +20 % damage (pep.js familySums): the card says so
  const ur = c.group === 'talent' && inst.r >= 3 ? '; UR: +20% damage' : '';
  return { name: t.name, line: t.line(m, who, inst.r) + ur };
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

/** The class choice's Subjects (§2.4): name, the period's twist, and `short`, the twist in one phone line. */
export const SUBJECT_TEXT = {
  subj_science: { name: 'Science', line: 'Poison ×1.4; heavy foes slower', short: 'Poison ×1.4; heavy foes slower' },
  subj_pe: { name: 'P.E.', line: 'In pulses: foes faster; pierce, slash and blast ×1.25', short: 'Pulses: fast foes; pierce/slash/blast ×1.25' },
  subj_music: { name: 'Music', line: 'In pulses: all damage ×1.25', short: 'Pulses: all damage ×1.25' },
  subj_festival: { name: 'Festival Prep', line: 'Every 3rd wave clear: +120 coins and ult charge', short: 'Every 3rd clear: +120 coins, ult' },
  subj_shop: { name: 'Shop Class', line: 'Every 4th wave clear: +150 coins; lightning ×1.2', short: 'Every 4th clear: +150 coins; lightning ×1.2' },
  subj_homeec: { name: 'Home Ec', line: '+3 hearts at every wave clear', short: '+3 hearts every wave clear' },
  subj_night: { name: 'Night Class', line: 'In pulses: holy ×1.5; spectral foes faster', short: 'Pulses: holy ×1.5; spirits faster' },
  subj_lit: { name: 'Literature', line: 'In pulses: holy ×1.3', short: 'Pulses: holy ×1.3' },
  subj_geo: { name: 'Geography', line: 'In pulses: slimes slower; lightning ×1.35', short: 'Pulses: slimes slower; lightning ×1.35' },
  subj_winter: { name: 'Winter Sports', line: 'In pulses: foes ×0.7 speed, reach ×0.85', short: 'Pulses: foes ×0.7 speed, reach ×0.85' },
  subj_history: { name: 'History', line: 'The Back Gate: even waves come in by the exit road', short: 'Back Gate: even waves by the exit road' },
  subj_art: { name: 'Art Class', line: '+1 Window Seat this period', short: '+1 Window Seat this period' },
};

/** Double Dare's reward, in one phone line. */
export const DARE_GAIN = '+1 credit, Period Score ×1.1';

/** Double Dare curses, short (the toggle's label). */
export const DARE_SHORT = { swift: 'swift foes', regen: 'regenerating foes', armored: 'armoured foes', shielded: 'shielded foes' };

/** Double Dare curses (§8.3). */
export const DARE_TEXT = {
  swift: 'foes ×1.2 speed',
  regen: 'foes regenerate 2 %/s',
  armored: 'foes +3 armour',
  shielded: 'foes carry a 30 % barrier',
};

// ---- M3 battle pieces (src/ui/battle/tryout.js, src/ui/battle/tryout/timetable.js) ----------------------------

/** A Subject in a timetable cell (§13.4): a few letters. */
export const SUBJECT_ABBR = {
  subj_science: 'Sci', subj_pe: 'P.E.', subj_music: 'Music', subj_festival: 'Fest', subj_shop: 'Shop', subj_homeec: 'H.Ec',
  subj_night: 'Night', subj_lit: 'Lit', subj_geo: 'Geo', subj_winter: 'Winter', subj_history: 'Hist', subj_art: 'Art',
};

/** A break in a timetable cell. */
export const BREAK_SHORT = { recess: 'Recess', lunch: 'Lunch', cleaning: 'Cleaning' };

/** The timetable strip and its thin battle band (§13.4). */
export const TIMETABLE_TEXT = {
  label: 'Timetable',
  final: 'Final',
  cell: (p) => `P${p}`,
  backGate: 'History: the Back Gate opens',
  affix: (t) => `Grade twist: ${t}`,
  dare: 'Double Dare',
  next: 'Next',
  stamp: 'stamped',
  strike: 'missed',
  open: 'in play',
  resumed: 'resumed',
};

/** The Class Photo and the Make-up sheet (§13.9). */
export const PHOTO_TEXT = {
  title: 'Class Photo',
  defeat: 'Early Dismissal',
  practice: 'Practice',
  teacher: 'Teacher',
  loaner: 'Loaner',
  varsity: 'Varsity',
  allPeriods: (n, hearts) => `All ${n} periods · ${hearts} ♥ left`,
  reached: (p) => `Reached period ${p}`,
  score: 'Run Score',
  stamps: 'Assignments',
  picks: 'Picks',
  handed: 'handed in',
  again: 'Again',
  hub: 'Tryout Day',
  best: 'New best score!',
  bestIs: (n) => `Best ${n}`,
  makeupTitle: 'Out of hearts',
  makeupLine: (w) => `The Make-up Test replays wave ${w} from its start, with the hearts and coins you had then. Once a run; that period's assignments won't count.`,
  makeupGo: 'Make-up Test',
  makeupNo: 'Early Dismissal',
};

/** A girl card in a pick (§13.7). */
export const GIRL_CARD_TEXT = {
  yours: 'Yours · plays in the band',
  loaner: (lv) => `Loaner · Run Level ${lv}`,
  joins: 'Joins the squad',
  freeAt: (tier) => `first copy free at tier ${tier}`,
  free: 'first copy free',
  varsity: 'Varsity',
  talent: 'her Hidden Talent',
  againTitle: 'Tries out again',
  againLine: (dmg, rate, cut) => `Varsity: +${dmg}% damage, +${rate}% attack speed, copies ${cut}% cheaper`,
};

/** A timetable cell's preview (§13.4: tap a cell): the period's foes, their traits, the big foe, the class, the twist. */
export const PREVIEW_TEXT = {
  hint: 'Tap a period for its preview',
  close: 'Close the preview',
  period: (p) => `Period ${p}`,
  final: 'Final Period',
  waves: (a, b) => `waves ${a}-${b}`,
  foes: 'Foes',
  traits: { flyers: 'flyers', veiled: 'veiled', heavy: 'heavy armour', regen: 'regenerating', spectral: 'spectral' },
  noTraits: 'no tricks',
  miniboss: (w) => `Miniboss · wave ${w}`,
  boss: (w) => `Boss · wave ${w}`,
  noSubject: 'No Subject (the first period)',
  subjectPair: 'Class: one of',
  subject: 'Class',
  or: ' or ',
  backGate: 'History opens the Back Gate: even waves come in by the exit road',
  affix: 'Grade twist',
  pick: (n) => `Pick ${n}`,
  tryoutPick: 'Tryouts',
  examPrep: 'Exam Prep: at least SR',
  breakAfter: 'Then',
  breakLine: 'Seat Change, Hall Passes, Snack or Brush Up',
  bossCell: 'Final boss',
};

/** The cap bar on a Pep Talk card (§4.4, §13.6): "Kage · Damage +36% → +52% / 100%". */
export const CAP_TEXT = {
  fam: {
    damageMul: 'Damage', rateMul: 'Attack speed', range: 'Reach', critChance: 'Crit', critMul: 'Crit damage', pierce: 'Pierce',
    projectiles: 'Projectiles', chain: 'Chain jumps', splash: 'Splash', airMul: 'vs flyers', eliteMul: 'vs elites', bossMul: 'vs bosses',
    barrierMul: 'vs barriers', dotMul: 'Burns and poisons', costCut: 'Cost cut', auraRange: 'Aura reach', auraPoints: 'Aura bonus',
  },
  cls: (c) => `vs ${c}`,
  all: (n) => `All ${n}`,
  fully: (n, of) => `full for ${n} of ${of}`,
  atCap: 'at its cap',
  label: (fam, now, after, cap) => `${fam} ${now} → ${after} / ${cap}`,
  /** A Team or Group card that adds in full to everyone it reaches: only what it adds. */
  toAll: (fam, add, n) => `${fam} ${add} to all ${n}`,
  /** The bar's spoken words for "to all": what it adds and the cap each girl has. */
  toAllBar: (fam, add, n, cap) => `${fam}: adds ${add} to all ${n}, cap ${cap} each`,
};

/** The pick sheet's MORE (§13.6): the odds table for this pick and the per-girl caps (§3.4, §4.4). */
export const MORE_TEXT = {
  label: 'Odds and caps',
  title: 'Odds and caps',
  back: 'Back to the pick',
  odds: 'This pick\'s odds',
  oddsLine: (pick, band, credits) => `Pick ${pick} · ${band} picks · ${credits} credit${credits === 1 ? '' : 's'} now`,
  bands: { early: 'Early', mid: 'Mid', late: 'Late' },
  credits: 'Credits',
  floor: (r) => `Teacher's Note: at least ${r}`,
  lrOff: 'LR already taken: an LR roll becomes UR',
  caps: 'Caps per girl',
  capsLine: 'Cards add inside these caps (all run sources together); drawbacks count after the cap.',
  family: 'Family',
  cap: 'Cap',
  top: 'Highest now',
  rows: {
    damageMul: 'Damage', rateMul: 'Attack speed', range: 'Reach', crit: 'Crit chance / crit damage', hits: 'Pierce / projectiles / chain',
    splash: 'Splash', vs: 'Each "vs" bonus', costCut: 'Cost cuts', runDamage: 'Run damage (cards × seat)',
  },
  none: '—',
};

// ---------------------------------------------------------------------------
// Meta (§10): Marbles, the Lunchbox, the Marble Jar, the Yearbook, the Weekly Timetable, share codes
// ---------------------------------------------------------------------------

export const LENGTH_NAMES = { half: 'Half Day', full: 'Full Day' };
export const MARBLES = 'Marbles';

const itemName = (id) => getItem(id)?.name || id;
const itemList = (items) => items.map((x) => `${x.count > 1 ? `${x.count}× ` : ''}${itemName(x.id)}`).join(', ');

/**
 * The Class Photo's reward lines from applyTryoutResult's `run` (src/systems/tryoutRewards.js).
 * @returns {{ key: string, text: string }[]}
 */
export function rewardLines(run) {
  if (!run || run.already) return [];
  const out = [];
  const m = run.marbles || {};
  const extra = [];
  if (m.grade) extra.push(`+${m.grade} Grade ${run.grade} first clear`);
  if (m.chest) extra.push(`+${m.chest} Weekly chest`);
  if (m.yearbook) extra.push(`+${m.yearbook} Yearbook`);
  const capNote = m.over > 0 ? ' · weekly cap reached' : '';
  out.push({ key: 'marbles', text: `${MARBLES} +${m.paid || 0} · ${run.week} / ${run.cap} this week${capNote}${extra.length ? ` · ${extra.join(' · ')}` : ''}` });
  const b = run.box;
  if (b?.fill > 0) out.push({ key: 'box', text: `Lunchbox ${b.fill}/7 full: ${b.items.length ? itemList(b.items) : 'crumbs this time'}` });
  else if (b?.weekFull) out.push({ key: 'box', text: 'Lunchbox: this week\'s 3 are already open' });
  const c = run.coins;
  if (c?.coins > 0) out.push({ key: 'coins', text: `+${fmtNum(c.coins, 'count', { detail: true })} coins (${c.paidWaves} waves × ${c.rate})` });
  else if (c?.waves > 0 && c.paidWaves === 0) out.push({ key: 'coins', text: 'Coins: this week\'s 150 waves are paid' });
  if (run.stamps?.length) out.push({ key: 'stamps', text: `Yearbook: ${run.stamps.length} new stamp${run.stamps.length === 1 ? '' : 's'}` });
  if (run.gradeUp) out.push({ key: 'grade', text: run.grade >= 12 ? 'Grade 12 cleared: the whole ladder!' : `Grade ${run.grade} cleared: Grade ${run.grade + 1} is open` });
  return out;
}

/** The Marble Jar's items. */
export const JAR_TEXT = {
  eraser: { name: 'Spare Eraser', line: '+1 Eraser in every run' },
  draft7: { name: 'Bigger Draft', line: '7 girls to choose from at Before Class' },
  coins: { name: 'Pencil Money', line: '+100 coins at the start of a run' },
  pocket: { name: 'Extra Pocket', line: 'hold up to 6 Hall Passes' },
  chalk_pink: { name: 'Pink Chalk', line: 'Window Seat chalk colour' },
  chalk_sky: { name: 'Sky Chalk', line: 'Window Seat chalk colour' },
  chalk_mint: { name: 'Mint Chalk', line: 'Window Seat chalk colour' },
  chalk_gold: { name: 'Gold Chalk', line: 'Window Seat chalk colour' },
  bd_classroom: { name: 'Classroom', line: 'Class Photo backdrop' },
  bd_rooftop: { name: 'Rooftop', line: 'Class Photo backdrop' },
  bd_gate: { name: 'Sakura Gate', line: 'Class Photo backdrop' },
  bd_festival: { name: 'Festival Night', line: 'Class Photo backdrop' },
  frame_bloom: { name: 'Blackboard Bloom', line: 'profile frame' },
  pennant: { name: 'Lobby Pennant', line: 'a Tryout Day pennant for the lobby' },
  sg_bundle: { name: 'Study Guide Bundle', line: '3 Study Guides' },
  fam_pack: { name: 'Material Pack', line: '5 rare materials of one family' },
};
export const JAR_SHELVES = { desk: 'Desk Supplies', cosmetic: 'Cosmetics', material: 'Materials' };
export const JAR_NOTES = {
  desk: 'Bought once. Switch each one on or off; they never apply in the Weekly Timetable or in co-op.',
  cosmetic: 'Bought once, for looks only.',
  material: 'Restocks every week.',
};
export const JAR_ERRORS = { funds: 'Not enough Marbles.', owned: 'Already yours.', soldOut: 'Sold out this week.', family: 'Pick a material family first.', unknown: 'Not in the Jar.' };

export const WEEKLY_TEXT = {
  name: 'Weekly Timetable',
  line: 'One timetable for everyone this week: Grade 5 rules, every girl at the floor, no Desk Supplies.',
  locked: 'Clear Grade 4 to open the Weekly Timetable.',
  reward: 'First clear this week: a 30-Marble chest and a Yearbook stamp.',
  done: 'Cleared this week. Play again for a better score.',
};

export const SHARE_TEXT = {
  title: 'Share code',
  replay: 'Replay this seed',
  note: 'A shared seed plays as practice: no Marbles, Lunchbox, records or achievements.',
  bad: 'That code is not a Tryout Day code.',
  locked: 'That code\'s Grade needs more of the campaign cleared first.',
  enter: 'Play a code',
};

export const YEARBOOK_TEXT = {
  title: 'Yearbook',
  line: (n, next, per, mb) => `${n} stamps · every ${per} stamps give ${mb} Marbles (next at ${next})`,
  girls: 'Students',
  cards: 'Pep Talks taken',
  bosses: 'Bosses beaten',
  records: 'Best scores',
  pencil: 'pencil sketch: she tried out as a Loaner',
  none: 'Nothing here yet: play a run.',
};

// ---------------------------------------------------------------------------
// M3 menus (§13.2, §13.3, §13.10): the hub's tiles, Before Class, the Jar and the Yearbook screens
// ---------------------------------------------------------------------------

/** The hub's tiles and its Continue band. */
export const HUB_TEXT = {
  locked: (stage) => `Clear ${stage} to open`,
  lockedWhy: (stage) => `Clear ${stage} in the campaign to open ${MODE_NAME}.`,
  pitch: 'One school day of defense: Pep Talks after every period, girls who try out, and a Seat Change at Recess.',
  start: 'Start',
  startLine: 'Pick 3 girls, a hero and a map',
  startKicker: (len, grade) => `${len} · Grade ${grade}`,
  weeklyLocked: `Clear Grade ${TRYOUT_META.weekly.unlockGrade} first`,
  weeklyOpen: `Grade ${TRYOUT_META.weekly.grade} rules, everyone at the floor`,
  weeklyDone: (best) => `Cleared this week${best ? ` · best ${fmtNum(best, 'count', { detail: true })}` : ''}`,
  weeklyResets: 'New in',
  jar: 'Marble Jar',
  jarLine: (week, cap) => `${week} / ${cap} Marbles this week`,
  yearbook: 'Yearbook',
  yearbookLine: (girls, total, stamps) => `${girls} / ${total} students · ${stamps} stamps`,
  records: 'Records',
  recordsLine: (grade, best) => (grade ? `Grade ${grade} cleared${best ? ` · best ${fmtNum(best, 'count', { detail: true })}` : ''}` : 'No Grade cleared yet'),
  runOpen: 'Your run is still open: continue it or give it up first.',
  continueTitle: 'Class in session',
  continueLine: (period, wave, hearts) => `Period ${period} · wave ${wave} · ♥ ${hearts}`,
  continueGo: 'Continue',
  giveUp: 'Give up',
  giveUpAsk: 'Give up this run? It ends here, and the periods you finished are paid.',
  makeup: 'uses your Make-up Test',
  makeupLine: 'You left during a wave: continuing replays that wave once, and that period\'s assignments no longer count.',
  practice: 'continues as practice',
  stale: 'closed by an update',
  staleLine: 'An update changed the run rules: this run can only be given up (the periods you finished are paid).',
  codeGo: 'Go',
};

/** Before Class (§13.3). */
export const CLASS_TEXT = {
  title: 'Before Class',
  maps: 'Map',
  roads: (n) => `${n} road${n === 1 ? '' : 's'}`,
  squad: (n, of) => `Squad · ${n} / ${of}`,
  hero: 'Hero',
  grade: 'Grade',
  length: 'Length',
  yours: 'Yours · band cap',
  loaner: 'Loaner',
  floor: 'At the floor',
  // one-line chips for small girl tiles (the full words go in the tooltip): never over her face (M3 review)
  yoursShort: 'Yours',
  floorShort: 'Floor',
  heroYours: 'Yours',
  heroFree: 'Free hero',
  redraw: (n) => `Redraw (${n})`,
  redrawn: 'Redrawn',
  start: 'Start class',
  pickMore: (n) => `Pick ${n} more girl${n === 1 ? '' : 's'} to start.`,
  full: 'Clear a Half Day first',
  normal: 'Normal run',
  perks: (names) => `Desk Supplies: ${names.join(', ')}`,
  facts: (g, len, erasers) => `${g.hearts} hearts · ${g.seats} Window Seats · ${erasers} Eraser${erasers === 1 ? '' : 's'} · ${len.periods} periods of ${len.wavesPerPeriod} waves`,
  loanerNote: 'Loaners are girls you do not own yet: they play at the run\'s floor.',
};

const TERM_NAMES = { spring: 'Spring Term', summer: 'Summer Term', autumn: 'Autumn Term' };
const span = (list) => (list.length > 1 ? `${list[0]}-${list[list.length - 1]}` : String(list[0] ?? ''));

/**
 * What a Grade adds to the one below it, in one line, from the run table itself (so a tuning change never makes the
 * line wrong): a new content window, the hearts, seats, Erasers, passes, foe HP and the rules of Grades 7-12.
 * @param {object[]} grades TRYOUT.grades @param {object} windows TRYOUT.windows @param {number} n
 */
export function gradeTwist(grades, windows, n) {
  const g = grades[n];
  if (!g) return '';
  const p = grades[n - 1] || null;
  const out = [];
  const term = !p || p.window !== g.window;
  if (term) out.push(`${TERM_NAMES[g.window] || g.window}: the maps and foes of chapters ${span(windows[g.window]?.chapters || [])}`);
  // (a new window brings its own foe HP: the Grade's multiplier starts over from it)
  else if (g.hpMul !== p.hpMul) out.push(`foes +${Math.round((g.hpMul - 1) * 100)}% HP`);
  if (p && g.hearts !== p.hearts) out.push(`${g.hearts} hearts`);
  if (p && g.seats !== p.seats) out.push(`${g.seats} Window Seats`);
  if (p && g.erasers !== p.erasers) out.push(`${g.erasers} Eraser${g.erasers === 1 ? '' : 's'}`);
  if (p && g.passes !== p.passes) out.push(`${g.passes} Hall Passes a break`);
  if (p && g.bossLeak !== p.bossLeak) out.push(`a leaking boss costs ${g.bossLeak} hearts`);
  if (g.aceBar && !p?.aceBar) out.push(`Ace the Test needs ${g.aceBar}%`);
  if (g.affixFrom && !p?.affixFrom) out.push(`a foe affix each period from P${g.affixFrom}`);
  if (g.strict && !p?.strict) out.push(`targets ${g.strict}% stricter`);
  if (g.snackHalf && !p?.snackHalf) out.push('Snack heals half');
  if (g.arrivalDown && !p?.arrivalDown) out.push('arrival packages one step lower');
  if (g.escort && !p?.escort) out.push('a second boss escort group');
  if (g.noHeal && !p?.noHeal) out.push('no healing');
  const line = out.join('; ');
  return line ? `${n === 1 ? '' : `New at Grade ${n}: `}${line.charAt(0).toUpperCase()}${line.slice(1)}` : '';
}

/** Why a Grade is locked (gradeOpen's `why`), for the line under the Grade row. */
export function gradeWhy(why, n, unlockStage) {
  if (why === 'window') return `Grade ${n} needs ${unlockStage} cleared in the campaign.`;
  if (why === 'ladder') return `Clear Grade ${n - 1} to open Grade ${n}.`;
  return `Grade ${n} comes in a later update.`;
}

/** The Marble Jar screen. */
export const JAR_SCREEN = {
  title: 'Marble Jar',
  rail: { desk: 'Supplies', cosmetic: 'Cosmetics', material: 'Materials' },
  buy: (price) => `Buy · ${price}`,
  on: 'On',
  off: 'Off',
  use: 'Use',
  inUse: 'In use',
  yours: 'Yours',
  left: (n, of) => `${n} of ${of} left this week`,
  soldOut: 'Sold out this week',
  short: (n) => `${n} more Marbles needed`,
  family: 'Family',
  bought: (name) => `${name}: yours!`,
};

/** The Yearbook screen. */
export const YEARBOOK_SCREEN = {
  sections: { girls: 'Students', cards: 'Pep Talks', bosses: 'Bosses', records: 'Records' },
  pencilRule: 'Not yours yet', // (one line on the tile: a longer rule wrapped over her face, M3 review)
  blankRule: 'Not met yet',
  colourLine: 'Tried out and in your class: her page is in colour.',
  pencilLine: 'Tried out as a Loaner: her page is a pencil sketch until she joins your class.',
  blankLine: 'She has not tried out yet: her page fills in the first time she does.',
  fullPage: 'Her page ›',
  unseen: '?',
};

// ---- Extended Day and Random Class (docs/specs/TRYOUT_DAY.md §20.8; the minimal UI, v1) -----------------------------

// (the third run length's name, beside Half Day and Full Day: internal id 'after')
LENGTH_NAMES.after = 'Extended Day';

/** Extended Day: the length option, its lock, the timetable's open end, the tracker and the Class Photo. */
export const EXTENDED_TEXT = {
  name: 'Extended Day',
  locked: 'Clear a Full Day first',
  line: 'The Full Day, then the day goes on until your hearts run out.',
  more: 'P13+',
  moreLine: 'on and on',
  moreTitle: 'After period 12 the day goes on: 4 waves a period, then a pick, until your hearts run out',
  stayLate: 'Stay Late',
  wave: (n) => `Wave ${n}`,
  waveSub: 'Stay Late · the day goes on',
  stayLateSub: 'The Full Day is done. The day goes on until your hearts run out',
  fullLast: 'The Full Day\'s last wave · then Stay Late',
  homeTime: 'Home Time',
  reachedWave: (n, periods) => `Reached wave ${n} · ${periods} period${periods === 1 ? '' : 's'}`,
  seedOnly: (seed) => `Seed ${seed} (Extended Day has no share code yet)`,
  facts: (g, erasers) => `${g.hearts} hearts · ${g.seats} Window Seats · ${erasers} Eraser${erasers === 1 ? '' : 's'} · 12 periods, then on and on`,
};

/** Random Class: the toggle, its help line (what it promises, in plain words), the drawn six and the pick reveal. */
export const RANDOM_TEXT = {
  name: 'Random Class',
  on: 'On',
  off: 'Off',
  help: 'Random Class: the class draws your 3 girls and every pick. Always a striker and a girl who hits flyers; a Control or Support girl is not promised.',
  helpShort: 'Random Class: always a striker and a flyer-hitter; no Control or Support promise.',
  squad: 'Squad · drawn at the bell',
  six: 'The class draws 3 of these six at the bell.',
  ribbon: 'Random Class',
  drawing: 'The class is choosing…',
  landing: 'Drawn!',
  landed: (name) => `Random Class: ${name}`,
  handed: 'Random Class: nothing fit, handed in',
  room: (on) => `Random Class: ${on ? 'On' : 'Off'}`,
};
