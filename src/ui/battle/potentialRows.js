// Potential's live rows in the battle panel (docs/specs/POTENTIAL.md, v3 §11 and v2 §7.5): her
// rhythm's pips ("<rhythm name> ●●●○○○ every 6th"), Kage's tempo pips (6, with the bonus they give
// now), her shuriken per throw with the carry of her projScale step ("2 → 2.24 / throw") and
// Chika's drone overclock timer ("<step name> in 12 s"). Step names come from the data, never from
// this folder (tests/data/potential.test.js keeps them out of the battle UI's own strings). Pure:
// the panel (towerPanel.js) draws them and refreshes
// them every frame from the same sim fields the battle uses, so an ally's girl in co-op shows her
// own owner's counts. A girl at P1 has none of these fields and gets no rows.
import { potentialSteps } from '../../systems/potential.js';

/** 1st, 2nd, 3rd, 4th … */
export function ordinal(n) {
  const k = Math.floor(n);
  const t = k % 100;
  if (t >= 11 && t <= 13) return `${k}th`;
  return `${k}${{ 1: 'st', 2: 'nd', 3: 'rd' }[k % 10] || 'th'}`;
}

/** The name of the first of her steps whose mods match (her rhythm and timers keep the name of the step that brought them). */
function stepName(def, pick) {
  for (const s of potentialSteps(def)) if (s.mods && pick(s.mods)) return s.name || null;
  return null;
}

/**
 * @param {object} t the sim tower (reads potCount through towerStats, tempo, potOc)
 * @param {object} st sim.towerStats(t.uid)
 * @returns {({ key: 'rhythm', name: string, every: number, count: number, of: string }
 *   | { key: 'tempo', name: string, stacks: number, max: number, bonus: number }
 *   | { key: 'shots', label: string, base: number, avg: number }
 *   | { key: 'overclock', name: string, left: number, next: number, rateMul: number })[]}
 */
export function potentialRows(t, st) {
  const rows = [];
  if (!t || !st) return rows;
  const def = t.def;
  if (st.proc && st.proc.every > 0) {
    rows.push({ key: 'rhythm', name: st.proc.name || stepName(def, (m) => !!m.proc) || 'Rhythm', every: st.proc.every, count: (st.proc.count || 0) % st.proc.every, of: st.proc.of || 'attack' });
  }
  if (st.tempo && st.tempo.max > 0) {
    rows.push({ key: 'tempo', name: stepName(def, (m) => !!m.tempo) || 'Tempo', stacks: st.tempo.stacks || 0, max: st.tempo.max, bonus: (st.tempo.stacks || 0) * st.tempo.per });
  }
  if (st.projScale > 0 && st.projectiles > 0) {
    rows.push({ key: 'shots', label: def?.id === 'kage' ? 'Shuriken' : 'Per attack', base: st.projectiles, avg: st.projectiles * (1 + st.projScale) });
  }
  const oc = t.stats?.turret?.overclock;
  if (oc && oc.every > 0) {
    const o = t.potOc;
    rows.push({ key: 'overclock', name: stepName(def, (m) => !!m.turret?.overclock) || 'Overclock', left: o ? o.left : 0, next: o ? Math.max(0, o.cd) : Math.max(0, oc.every - (oc.time ?? 0)), rateMul: oc.rateMul });
  }
  return rows;
}

const num = (v, d = 2) => {
  const s = Number(v).toFixed(d);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
};

/**
 * A row's words beside its pips: rhythm "every 6th" (a trap rhythm "every 4th trap"), tempo "+4%",
 * shots "2 → 2.24 / throw", overclock "+75% · 3 s left" while it runs, else "in 12 s".
 */
export function potentialRowText(row) {
  if (row.key === 'rhythm') return `every ${ordinal(row.every)}${row.of === 'trap' ? ' trap' : ''}`;
  if (row.key === 'tempo') return `+${Math.round(row.bonus * 100)}%`;
  if (row.key === 'shots') return `${num(row.base)} → ${num(row.avg)} / throw`;
  if (row.key === 'overclock') return row.left > 0 ? `+${Math.round((row.rateMul - 1) * 100)}% · ${Math.ceil(row.left)} s left` : `in ${Math.ceil(row.next)} s`;
  return '';
}
