// Potential v3 gate B1 / B5 bench (docs/specs/POTENTIAL.md v3; design spec §3.1–§3.5, §13.1): one girl
// on the best-covered spot of 4-5, strong stats, P1…P6, two targets — a crowd (an immortal Orc Grunt
// every 0.1 s) and a held elite (one immortal enemy held at the path point nearest her) — 15 s warm-up
// then 40 s of damage, seeds 9 and 21. E = √(crowd × held), the measure of spec §3.1 and of
// tests/integration/potential.balance.test.js.
//
//   node --import ./tools/simLoader.mjs tools/potentialBench.mjs --girls kage,shiro [--builds ref]
//        [--seeds 9,21] [--out file.jsonl]                     one JSON line per girl × build × kind × P × seed
//   node tools/potentialBench.mjs --report a.jsonl [b.jsonl …]  the B1 / B5 table from such lines
//   --rows file.mjs   tuning: `export const ROWS = { kage: { p5: { name, kind, girl, mods } } }` replaces
//                     those steps of her row for this run only (src/data/potential.js stays as it is)
//
// Reference builds (`ref`): tier 0, every path at 4 and at 5 with a tier-2 crosspath (x-0-2, 2-x-0,
// 2-0-x); or a list such as 5-0-2,2-0-5. The report, per girl: E(P6)/E(P1) (median over her builds)
// against her §3.2 band, every step's E against its slot (±30 % in log, no spike above 2× the slot in
// log, no dead step below ×1.03 on any build), the best / worst build spread (≤ 1.35), and B5: her
// Power (Π potentialText power) against the measured E (±10 %).
import { writeFileSync, appendFileSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);

/** Her §3.2 band on E at P6 (damage girls; the control girls' own E; hybrids' own E). */
export const BANDS = {
  aoi: [1.5, 1.68], rei: [1.5, 1.68], yuki: [1.4, 1.55],
  akane: [1.72, 1.95], sango: [1.72, 1.95], kage: [1.72, 1.95], shiro: [1.72, 1.95], raika: [1.72, 1.95],
  suzu: [1.55, 1.75], midori: [1.5, 1.7], kaede: [2.1, 2.45], hotaru: [1.85, 2.15], chika: [1.85, 2.15],
};
const SLOTS = { R: [1.04, 1.08, 1.09, 1.12, 1.16], SR: [1.04, 1.1, 1.11, 1.17, 1.23], SSR: [1.1, 1.12, 1.15, 1.22, 1.32] };
const REF = ['0-0-0', '4-0-2', '2-4-0', '2-0-4', '5-0-2', '2-5-0', '2-0-5'];

async function bench() {
  const { Sim } = await import('../src/sim/Sim.js');
  const { samplePath } = await import('../src/sim/path.js');
  const { UNIT_MAP } = await import('../src/data/units.js');
  const STRONG = { damageMul: 2.2, rateMul: 1.24, rangeMul: 1.08, critChance: 0.2, critMul: 1.3, armorPen: 1, awakenPassive: true, level: 60, awaken: 3 };
  const girls = opt('girls', 'kage').split(',');
  const builds = (opt('builds', 'ref') === 'ref' ? REF : opt('builds').split(',')).map((b) => b.split('-').map(Number));
  const seeds = opt('seeds', '9,21').split(',').map(Number);
  const ps = opt('ps', '1,2,3,4,5,6').split(',').map(Number);
  const out = opt('out', null);
  if (out) writeFileSync(out, '');
  const { potentialRow } = await import('../src/data/potential.js');
  const rowsFile = opt('rows', null);
  const ROWS = rowsFile ? (await import(new URL(rowsFile, `file://${process.cwd()}/`).href)).ROWS : {};
  const units = Object.fromEntries(Object.entries(ROWS).map(([id, steps]) => [id, { ...UNIT_MAP[id], potential: { ...potentialRow(UNIT_MAP[id]), ...steps } }]));
  const bestSpot = (sim, unitId) => {
    const r = Math.min(6, UNIT_MAP[unitId].base.range || 3);
    const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
    let best = null;
    for (let y = 0.3; y < sim.map.height; y += 0.25) {
      for (let x = 0.3; x < sim.map.width; x += 0.25) {
        const c = { x: x + 0.013, y: y + 0.007 };
        if (!sim.canPlace(unitId, c.x, c.y).ok) continue;
        const cov = samples.reduce((a, s) => a + ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= r * r ? 1 : 0), 0);
        if (!best || cov > best.cov) best = { ...c, cov };
      }
    }
    return best;
  };
  const openWave = (sim) => {
    sim.startNextWave();
    sim._spawnQueue = [];
  };
  const run = (unitId, tiers, kind, potential, seed) => {
    const sim = new Sim({ stageId: '4-5', difficulty: 'normal', seed, loadout: [{ unitId, stats: { ...STRONG, potential } }], hero: null, options: { autoStart: false }, ...(units[unitId] ? { data: { units: { [unitId]: units[unitId] } } } : {}) });
    sim.lives = 1e9;
    sim.cash = 1e9;
    const spot = bestSpot(sim, unitId);
    const t = sim.placeTower(unitId, spot.x, spot.y);
    for (let p = 0; p < 3; p++) for (let k = 0; k < tiers[p]; k++) sim.upgradeTower(t.uid, p);
    openWave(sim);
    let held = null;
    if (kind === 'held') {
      let bestD = Infinity;
      for (let i = 0; i < sim.pathData.length; i++) {
        for (const s of samplePath(sim.pathData[i], 0.1)) {
          const d = (s.x - spot.x) ** 2 + (s.y - spot.y) ** 2;
          if (!s.hidden && d < bestD) {
            bestD = d;
            held = { i, dist: s.d };
          }
        }
      }
    }
    let acc = 0;
    let e = null;
    let start = 0;
    const dt = 0.05;
    for (let time = 0; time < 55; time += dt) {
      if (time >= 15 && !start) start = t.damageDealt || 1e-9;
      if (kind === 'crowd') {
        acc += dt;
        while (acc >= 0.1) {
          acc -= 0.1;
          sim.spawnEnemy('orc_grunt', { hpMul: 1e6 });
        }
      } else if (!e || e.dead || e.removed || !sim.enemies.includes(e)) {
        e = sim.spawnEnemy('slime_courtier', { hpMul: 1e6, pathIndex: held.i, dist: held.dist });
      }
      if (e && kind === 'held') {
        e.speed = 0;
        e.baseSpeed = 0;
      }
      sim.update(dt);
      sim.drainEvents();
      if (sim.state !== 'wave') openWave(sim);
    }
    return { dps: (t.damageDealt - start) / 40, tiers: t.tiers.join('-') };
  };
  for (const id of girls) {
    for (const b of builds) {
      for (const kind of ['crowd', 'held']) {
        for (const p of ps) {
          for (const seed of seeds) {
            const r = run(id, b, kind, p, seed);
            const line = JSON.stringify({ id, build: b.join('-'), tiers: r.tiers, kind, p, seed, dps: Math.round(r.dps * 1000) / 1000 });
            if (out) appendFileSync(out, line + '\n');
            else console.log(line);
          }
        }
      }
    }
  }
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.sqrt(s[m - 1] * s[m]);
};

async function report(files) {
  const { UNIT_MAP } = await import('../src/data/units.js');
  const { potentialRarity } = await import('../src/data/potential.js');
  const { potentialTextRow } = await import('../src/data/potentialText.js');
  const rows = files.flatMap((f) => readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
  const by = new Map(); // id → build → kind → p → [dps…]
  for (const r of rows) {
    if (r.tiers !== r.build) continue; // a build the girl cannot take (crosspath rules)
    const g = by.get(r.id) || by.set(r.id, new Map()).get(r.id);
    const b = g.get(r.build) || g.set(r.build, { crowd: {}, held: {} }).get(r.build);
    (b[r.kind][r.p] ||= []).push(r.dps);
  }
  const lines = ['| girl | E P6/P1 (band) | crowd · held | steps (slot) | spread | Power (B5) | flags |', '|---|---|---|---|---|---|---|'];
  const fails = [];
  for (const [id, builds] of by) {
    const def = UNIT_MAP[id];
    const slot = SLOTS[potentialRarity(def)];
    const per = []; // per build: E[1..6], crowd ratio, held ratio
    for (const [build, k] of builds) {
      const avg = (kind, p) => {
        const v = k[kind][p];
        return v && v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
      };
      if (!(avg('crowd', 1) > 0 && avg('held', 1) > 0)) continue;
      const E = [1, 2, 3, 4, 5, 6].map((p) => Math.sqrt(avg('crowd', p) * avg('held', p)));
      per.push({ build, E, crowd: avg('crowd', 6) / avg('crowd', 1), held: avg('held', 6) / avg('held', 1) });
    }
    if (!per.length) continue;
    const ratio = median(per.map((x) => x.E[5] / x.E[0]));
    const steps = [1, 2, 3, 4, 5].map((i) => median(per.map((x) => x.E[i] / x.E[i - 1])));
    const spread = Math.max(...per.map((x) => x.E[5] / x.E[0])) / Math.min(...per.map((x) => x.E[5] / x.E[0]));
    const flags = [];
    const band = BANDS[id];
    if (band && (ratio < band[0] - 1e-9 || ratio > band[1] + 1e-9)) flags.push('band');
    steps.forEach((s, i) => {
      const r = Math.log(s) / Math.log(slot[i]);
      if (r > 2) flags.push(`P${i + 2} spike`);
      else if (r < 0.7 || r > 1.3) flags.push(`P${i + 2} ±30%`);
    });
    for (const x of per) x.E.slice(1).forEach((e, i) => { if (e / x.E[i] < 1.03) flags.push(`P${i + 2} dead on ${x.build}`); });
    if (spread > 1.35) flags.push('spread');
    const text = potentialTextRow(def);
    const power = text ? text.reduce((a, s) => a * s.power, 1) : null;
    if (power && Math.abs(power / ratio - 1) > 0.1) flags.push('B5');
    const mm = (f) => `×${Math.min(...per.map(f)).toFixed(2)}–${Math.max(...per.map(f)).toFixed(2)}`;
    lines.push(`| ${id} | ×${ratio.toFixed(2)}${band ? ` (${band[0]}–${band[1]})` : ''} | ${mm((x) => x.crowd)} · ${mm((x) => x.held)} | ${steps.map((s, i) => `${s.toFixed(2)} (${slot[i]})`).join(' · ')} | ${spread.toFixed(2)} | ${power ? `${power.toFixed(2)} (${((power / ratio - 1) * 100).toFixed(0)}%)` : '—'} | ${[...new Set(flags)].join(', ') || 'ok'} |`);
    if (flags.length) fails.push(id);
    if (args.includes('--builds-detail')) for (const x of per) lines.push(`|  ${x.build} | ×${(x.E[5] / x.E[0]).toFixed(2)} | ×${x.crowd.toFixed(2)} · ×${x.held.toFixed(2)} | ${x.E.slice(1).map((e, i) => (e / x.E[i]).toFixed(2)).join(' · ')} | | | |`);
  }
  console.log(lines.join('\n'));
  return fails;
}

if (args.includes('--report')) await report(args.slice(args.indexOf('--report') + 1).filter((a) => !a.startsWith('--')));
else await bench();
