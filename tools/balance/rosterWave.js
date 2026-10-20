// Roster wave (track 5) balance bench: every tower at tier 3/2, 4/2 and 5/2 (best main / cross split)
// on the in-sim crowd and single-target bench (tools/balance/bench.js, docs/BALANCE.md "Power"), each
// returning girl beside her rarity's band (the min … max of the live girls of that rarity, damage
// dealers only), and the three returning heroes on the hero bench with the hero-rework guards.
// Engine-free like bench.js: the caller passes the tree's Sim, data and helpers.
//
//   BALANCE=roster BALANCE_OUT=/tmp/table.md npx vitest run tests/integration/rosterWave.balance.test.js
import { benchDps, towerBest, median } from './bench.js';

/**
 * A stream bench: like bench.js (stage 4-5's map, a column of `count` stationary enemies), but every
 * enemy has `hp` HP and a fallen one is replaced at once, so kills matter (curse bursts, splash on
 * a crowd that thins and refills). `air`: the column is a plain flyer instead (the flyer bonus,
 * grounding). Damage dealt ÷ seconds, curse bursts included (credited to the curser).
 */
export function benchStream({ Sim, xpToReach, enemies }, { unitId, tiers = [0, 0, 0], count = 10, seconds = 20, hp = 400, air = false, stageId = '4-5' }) {
  const pick = (want) => Object.values(enemies).find((e) => e.tier === 'normal' && !(e.armor > 0) && !e.phases?.length
    && Object.keys(e.traits || {}).filter((k) => e.traits[k]).join() === want);
  const def = air ? pick('airborne') : pick('');
  if (!def) return 0;
  const sim = new Sim({ stageId, loadout: [{ unitId }], seed: 1, options: { autoStart: false } });
  sim.cash = 1e9;
  const path = sim.pathData[0];
  const mid = Math.min(path.length * 0.5, 12);
  const pts = [];
  for (let i = 0; i < count; i++) pts.push(mid - 1 + (count > 1 ? (2 * i) / (count - 1) : 1));
  const probe = sim.spawnEnemy(def.id, { dist: mid, hpMul: 1 });
  const cx = probe.x;
  const cy = probe.y;
  probe.dead = true;
  sim._removeDead();
  let best = null;
  for (let y = 0.25; y < sim.map.height; y += 0.25) {
    for (let x = 0.25; x < sim.map.width; x += 0.25) {
      if (!sim.canPlace(unitId, x, y).ok) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  if (!best) return 0;
  const t = sim.placeTower(unitId, best.x, best.y);
  for (let p = 0; p < 3; p++) for (let k = 0; k < (tiers[p] || 0); k++) sim.upgradeTower(t.uid, p);
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [];
  sim._spawnIndex = 0;
  const slots = pts.map((d) => null);
  const fill = () => {
    for (let i = 0; i < pts.length; i++) {
      if (slots[i] && !slots[i].dead) continue;
      const e = sim.spawnEnemy(def.id, { dist: pts[i] });
      // exactly `hp` HP (the stage's HP scale would multiply it)
      e.hp = hp;
      e.maxHp = hp;
      e.baseSpeed = 0;
      slots[i] = e;
    }
  };
  fill();
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    sim.update(1 / 60);
    fill();
  }
  return t.damageDealt / seconds;
}

/** Best stream DPS at main tier `main` with a tier-`cross` second path. */
function streamBest(deps, unitId, main, cross, o = {}) {
  let best = 0;
  for (let p = 0; p < 3; p++) {
    for (let q = 0; q < 3; q++) {
      if (q === p) continue;
      const tiers = [0, 0, 0];
      tiers[p] = main;
      tiers[q] = cross;
      best = Math.max(best, benchStream(deps, { unitId, tiers, ...o }));
    }
  }
  return best;
}

/** @returns {string} the markdown tables */
export function rosterWaveTables({ Sim, xpToReach, ENEMY_MAP, UNITS, EXPANSION_IDS }, { only = null, log = () => {} } = {}) {
  const deps = { Sim, xpToReach, enemies: ENEMY_MAP };
  // supports and income girls are measured, but never part of a damage band
  const SUPPORT = new Set(['momo', 'umeko', 'miko', 'noa']);
  // % of max HP burns / poison read the bench's 1e9 HP: those girls never set a band on the 1e9 bench
  const PCT_DOT = new Set(['akane', 'midori']);
  const r0 = (v) => Math.round(v);

  const towers = UNITS.filter((u) => u.kind === 'tower' && (!only || only.has(u.id) || !EXPANSION_IDS.includes(u.id)));
  const rows = {};
  for (const u of towers) {
    const t0 = Date.now();
    rows[u.id] = {
      u,
      c32: towerBest(deps, u.id, 3, 2),
      c42: towerBest(deps, u.id, 4, 2),
      c52: towerBest(deps, u.id, 5, 2),
      s52: towerBest(deps, u.id, 5, 2, { count: 1 }),
      // finite HP, refilled (kills matter): 3/2 at 400 HP, 5/2 at 4,000 HP; and 3/2 against flyers
      st32: streamBest(deps, u.id, 3, 2, { hp: 400 }),
      st52: streamBest(deps, u.id, 5, 2, { hp: 4000 }),
      air32: u.base.canHitAir || u.paths.some((p) => p.tiers.some((tr) => tr.mods.canHitAir)) ? streamBest(deps, u.id, 3, 2, { hp: 400, air: true }) : 0,
      perCoin: 0,
    };
    // crowd DPS per 1,000 coins spent (placement + the 3/2 build), at tier 3/2
    const cost = u.base.cost + Math.min(...[0, 1, 2].map((p) => u.paths[p].tiers.slice(0, 3).reduce((a, t) => a + t.cost, 0)))
      + Math.min(...[0, 1, 2].map((p) => u.paths[p].tiers.slice(0, 2).reduce((a, t) => a + t.cost, 0)));
    rows[u.id].perCoin = (rows[u.id].c32 / cost) * 1000;
    log(`${u.id} ${Date.now() - t0} ms`);
  }

  const out = [];
  const band = (rar, key) => {
    const v = towers.filter((u) => u.rarity === rar && !SUPPORT.has(u.id) && !EXPANSION_IDS.includes(u.id) && (key.startsWith('st') || key.startsWith('air') || !PCT_DOT.has(u.id))).map((u) => rows[u.id][key]).filter((x) => x > 0);
    return [Math.min(...v), median(v), Math.max(...v)];
  };
  const verdict = (id, key) => {
    const [lo, md, hi] = band(rows[id].u.rarity, key);
    const x = rows[id][key];
    return `${(x / md).toFixed(2)}×${x >= lo * 0.85 && x <= hi * 1.15 ? '' : '!'}`;
  };
  out.push('| Girl | Rarity | Crowd 3/2 | Crowd 5/2 | Single 5/2 | Stream 3/2 (400 HP) | Stream 5/2 (4,000 HP) | Flyers 3/2 | vs her rarity median: crowd 5/2 · stream 3/2 · stream 5/2 · flyers | In band? |');
  out.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const id of EXPANSION_IDS) {
    const r = rows[id];
    if (!r) continue;
    const vs = ['c52', 'st32', 'st52', 'air32'].map((k) => (r[k] > 0 ? verdict(id, k) : '—'));
    const inBand = SUPPORT.has(id) ? 'support (aura; not banded)' : vs.slice(1).some((v) => v !== '—' && !v.endsWith('!')) ? 'yes' : 'NO';
    out.push(`| ${r.u.name} | ${r.u.rarity} | ${r0(r.c32)} | ${r0(r.c52)} | ${r0(r.s52)} | ${r0(r.st32)} | ${r0(r.st52)} | ${r0(r.air32)} | ${vs.join(' · ')} | ${inBand} |`);
  }
  out.push('');
  out.push('Bands: the live girls of her rarity, damage dealers only (min … max; "!" = outside min × 0.85 … max × 1.15). Akane and Midori are left out of the 1e9-HP crowd band (their % of max HP burns read the bench\'s 1e9 HP).');
  for (const rar of ['R', 'SR', 'SSR']) {
    out.push(`- ${rar}: ` + ['c52', 'st32', 'st52', 'air32'].map((k) => { const [lo, md, hi] = band(rar, k); return `${k} ${r0(lo)} · ${r0(md)} · ${r0(hi)}`; }).join(' | '));
  }
  out.push('');
  out.push('Live girls (crowd 5/2 / stream 3/2 / stream 5/2 / flyers 3/2): ' + towers.filter((u) => !EXPANSION_IDS.includes(u.id)).map((u) => `${u.name} ${r0(rows[u.id].c52)}/${r0(rows[u.id].st32)}/${r0(rows[u.id].st52)}/${r0(rows[u.id].air32)}`).join(' · '));

  // heroes: Lv 1 / 5 / 10 / 15 / 20 / 25 crowd, Lv 25 single, with the hero-rework guards
  const all52 = towers.filter((u) => !EXPANSION_IDS.includes(u.id) && !SUPPORT.has(u.id) && !PCT_DOT.has(u.id));
  const best52 = Math.max(...all52.map((u) => rows[u.id].c52));
  const bestS52 = Math.max(...all52.map((u) => rows[u.id].s52));
  const med32 = median(all52.map((u) => rows[u.id].c32));
  const med42 = median(all52.map((u) => rows[u.id].c42));
  const med52 = median(all52.map((u) => rows[u.id].c52));
  out.push('');
  out.push('| Hero | Lv 1 | Lv 5 | Lv 10 | Lv 15 | Lv 20 | Lv 25 crowd | Lv 25 single | Guards |');
  out.push('|---|---|---|---|---|---|---|---|---|');
  for (const u of UNITS.filter((x) => x.kind === 'hero' && (!only || only.has(x.id) || !EXPANSION_IDS.includes(x.id)))) {
    const lv = [1, 5, 10, 15, 20, 25].map((heroLevel) => benchDps(deps, { unitId: u.id, heroLevel }));
    const single = benchDps(deps, { unitId: u.id, heroLevel: 25, count: 1 });
    const g = [
      lv[5] <= 1.4 * best52 ? 'crowd ≤ 1.4× best' : 'CROWD > 1.4× BEST',
      single <= bestS52 ? 'single ≤ best' : 'SINGLE > BEST',
      lv[5] >= med52 ? 'Lv25 ≥ 5/2 median' : 'Lv25 < 5/2 median',
      lv[4] >= med42 ? 'Lv20 ≥ 4/2 median' : 'Lv20 < 4/2 median',
      lv[2] >= med32 / 2 ? 'Lv10 ≥ ½ 3/2 median' : 'Lv10 < ½ 3/2 median',
    ];
    out.push(`| ${u.name} | ${lv.map(r0).join(' | ')} | ${r0(single)} | ${g.join(' · ')} |`);
  }
  out.push('');
  out.push(`Tower references: 3/2 median ${r0(med32)} · 4/2 median ${r0(med42)} · 5/2 median ${r0(med52)} · best 5/2 crowd ${r0(best52)} · best 5/2 single ${r0(bestS52)}.`);
  return out.join('\n');
}
