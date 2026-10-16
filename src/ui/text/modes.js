// Display text for the battle modes (docs/specs/CODEX_MODES.md §5.1). Outside the co-op id: the
// sim reads only src/data/modes.js, so a wording fix here never forces a co-op update.
import { BATTLE_MODES, modeArmor } from '../../data/modes.js';

export const MODE_TEXT = {
  standard: { name: 'Standard', short: 'Standard', icon: 'modeStandard', color: '#24305e', desc: 'The stage as it was built.' },
  reverse: { name: 'Reverse Route', short: 'Reverse', icon: 'modeReverse', color: '#2bb6a8', desc: 'Enemies walk the stage backwards: they come in where they usually leave.' },
  rush: { name: 'Goblin Rush', short: 'Rush', icon: 'modeRush', color: '#ff9f1c', desc: 'Enemies move 30% faster and arrive 30% closer together.' },
  ironclad: { name: 'Ironclad', short: 'Ironclad', icon: 'modeIronclad', color: '#6c7a96', desc: 'Every enemy gains +{a} armor (bosses +{b}). Bring Armor Pierce and Armor Break.' },
  frugal: { name: 'Half Income', short: 'Half Income', icon: 'modeFrugal', color: '#e0a800', desc: 'Bounties, wave bonuses and girl income are halved. Starting coins stay the same.' },
  laststand: { name: 'Last Petal', short: 'Last Petal', icon: 'modeLastPetal', color: '#ff4d8d', desc: 'One heart, and no hearts come back. Let nothing reach the goal.' },
};

export function modeText(id) {
  return MODE_TEXT[id] || MODE_TEXT.standard;
}

/** Ironclad's armor numbers for a stage and difficulty: { a, b }. */
export function ironcladArmor(stage, difficulty) {
  const m = BATTLE_MODES.ironclad;
  const a = modeArmor(m, stage, difficulty);
  return { a, b: a * m.bossArmorMul };
}

/** The mode's card text, with Ironclad's numbers filled in for this stage and difficulty. */
export function modeDesc(id, stage = null, difficulty = 'normal') {
  const t = modeText(id);
  if (id !== 'ironclad') return t.desc;
  const { a, b } = ironcladArmor(stage, difficulty);
  return t.desc.replace('{a}', a).replace('{b}', b);
}
