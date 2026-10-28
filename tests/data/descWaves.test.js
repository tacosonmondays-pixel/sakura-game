// Gate Arc Step 5 review: a stage description's "<enemies> from wave N" must match the waves the generator really
// makes (the first wave each named enemy appears on). Act II stages from chapter 5 on (earlier acts were checked by
// hand in their own reviews).
import { describe, it, expect } from 'vitest';
import { STAGES } from '../../src/data/stages.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { MAPS } from '../../src/data/maps.js';
import { generateWave } from '../../src/sim/waves.js';

const enemy = (id) => ENEMIES.find((e) => e.id === id);
/** Each enemy's name and its plural ("Line Sentry" / "Line Sentries", "Thornroot" / "Thornroots"), longest first. */
const plural = (n) => (/[^aeiou]y$/.test(n) ? `${n.slice(0, -1)}ies` : /(s|x|ch|sh)$/.test(n) ? `${n}es` : `${n}s`);
const NAMES = ENEMIES.flatMap((e) => {
  const n = e.name.toLowerCase();
  return [{ id: e.id, name: plural(n) }, { id: e.id, name: n }];
}).sort((a, b) => b.name.length - a.name.length);

/** First wave each enemy id appears on. */
function firstWaves(st) {
  const map = MAPS.find((m) => m.id === st.mapId);
  const first = {};
  for (let w = 1; w <= st.waves; w++) {
    for (const s of generateWave(st, w, enemy, { pathCount: map.paths.length }).spawns) if (!(s.enemyId in first)) first[s.enemyId] = w;
  }
  return first;
}

/** [{ ids, wave, text }] for every "… from wave N" clause: the enemy names between the previous clause break and it. */
function claims(desc) {
  const out = [];
  const re = /from wave (\d+)/g;
  let m;
  let start = 0;
  while ((m = re.exec(desc))) {
    const before = desc.slice(start, m.index);
    const clause = before.split(/[.;:,]|\bthen\b/).pop().toLowerCase();
    const ids = [];
    let rest = clause;
    for (const { id, name } of NAMES) {
      const i = rest.indexOf(name);
      if (i >= 0) {
        if (!ids.includes(id)) ids.push(id);
        rest = rest.slice(0, i) + ' '.repeat(name.length) + rest.slice(i + name.length);
      }
    }
    out.push({ ids, wave: Number(m[1]), text: clause.trim() });
    start = m.index + m[0].length;
  }
  return out;
}

describe('stage descriptions match the waves (Act II, chapter 5 on)', () => {
  const stages = STAGES.filter((s) => s.act === 2 && Number(s.id.split('-')[0]) >= 5);
  it('covers the chapter-5 Act II stages', () => expect(stages.map((s) => s.id)).toEqual(expect.arrayContaining(['5-6', '5-7', '5-8', '5-9', '5-10'])));
  for (const st of stages) {
    it(`${st.id}: every "from wave N" names enemies that first come on wave N`, () => {
      const first = firstWaves(st);
      for (const c of claims(st.desc)) {
        expect(c.ids.length, `${st.id}: no enemy named in "${c.text}"`).toBeGreaterThan(0);
        for (const id of c.ids) expect(first[id], `${st.id}: ${id} ("${c.text} from wave ${c.wave}")`).toBe(c.wave);
      }
    });
  }
});
