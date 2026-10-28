// Monte Carlo of the Tryout Day pick-rarity rules (docs/specs/TRYOUT_DAY.md §3.4). Check script; numbers only.
// usage: node tools/tryoutOdds.mjs [runs]
const RUNS = +(process.argv[2] || 200000);
const T = ['R', 'SR', 'SSR', 'UR', 'LR'];
// rows = credits k 0..4; columns R SR SSR UR LR (percent)
const TABLE = {
  early: [[60, 32, 8, 0, 0], [40, 45, 14, 1, 0], [0, 72, 24, 4, 0], [0, 0, 85, 13, 2], [0, 0, 70, 24, 6]],
  mid:   [[45, 38, 15, 2, 0], [28, 47, 21, 4, 0], [0, 62, 31, 6, 1], [0, 0, 78, 18, 4], [0, 0, 60, 30, 10]],
  late:  [[30, 42, 22, 5, 1], [15, 45, 30, 8, 2], [0, 50, 36, 11, 3], [0, 0, 68, 24, 8], [0, 0, 50, 35, 15]],
};
const LENGTHS = {
  half: { picks: 6, band: (i) => (i < 2 ? 'early' : i < 4 ? 'mid' : 'late'), lrCap: 1 },
  full: { picks: 11, band: (i) => (i < 4 ? 'early' : i < 8 ? 'mid' : 'late'), lrCap: 2 },
};
// p1 Full Hearts, p2 skill slot, p3 style slot, dd = chance to take a Double Dare (which costs 15 % on each assignment)
const PLAYERS = {
  casual: { p1: 0.4, p2: 0.35, p3: 0.45, dd: 0.1 },
  average: { p1: 0.6, p2: 0.55, p3: 0.6, dd: 0.25 },
  strong: { p1: 0.8, p2: 0.75, p3: 0.78, dd: 0.5 },
  // expert: takes every Double Dare; the Dare's 15 % cost means each assignment clears 85 % of the time
  expert: { p1: 1, p2: 1, p3: 1, dd: 1 },
};
let s = 0x9e3779b9; // mulberry32
const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function roll(row, floor, lrOff) {
  const w = row.slice();
  for (let i = 0; i < floor; i++) w[i] = 0;
  if (lrOff) { w[3] += w[4]; w[4] = 0; }
  let tot = w.reduce((a, b) => a + b, 0);
  if (tot === 0) { w[floor] = 1; tot = 1; }
  let r = rnd() * tot;
  for (let i = 0; i < 5; i++) { r -= w[i]; if (r < 0) return i; }
  return 4;
}
function sim(len, pl) {
  const L = LENGTHS[len];
  const out = { tiers: [0, 0, 0, 0, 0], ssrPlus: 0, urPlus: 0, lrRuns: 0, pity: 0, k: 0 };
  for (let run = 0; run < RUNS; run++) {
    let rStreak = 0, sinceSsr = 0, lr = 0, ssr = 0, ur = 0;
    for (let i = 0; i < L.picks; i++) {
      const dd = rnd() < pl.dd;
      const m = dd ? 0.85 : 1;
      let k = (rnd() < pl.p1 * m) + (rnd() < pl.p2 * m) + (rnd() < pl.p3 * m) + (dd ? 1 : 0);
      k = Math.min(4, k);
      out.k += k;
      let floor = k >= 3 ? 2 : k === 2 ? 1 : 0;
      let pf = floor;
      if (rStreak >= 2) pf = Math.max(pf, 1);
      if (sinceSsr >= 4) pf = Math.max(pf, 2);
      if (i === L.picks - 1) pf = Math.max(pf, 1); // Exam Prep
      if (pf > floor) out.pity++;
      const t = roll(TABLE[L.band(i)][k], pf, lr >= L.lrCap);
      out.tiers[t]++;
      if (t === 4) lr++;
      if (t >= 2) { ssr++; sinceSsr = 0; } else sinceSsr++;
      if (t >= 3) ur++;
      rStreak = t === 0 ? rStreak + 1 : 0;
    }
    out.ssrPlus += ssr; out.urPlus += ur; if (lr) out.lrRuns++;
  }
  const n = RUNS * L.picks;
  return {
    mix: out.tiers.map((c) => Math.round((100 * c) / n)).join(' / '),
    ssrPlus: (out.ssrPlus / RUNS).toFixed(1), urPlus: (out.urPlus / RUNS).toFixed(2), lrRuns: Math.round((100 * out.lrRuns) / RUNS) + '%',
    pity: (out.pity / RUNS).toFixed(2), avgK: (out.k / n).toFixed(2),
  };
}
for (const len of ['half', 'full']) {
  console.log(`\n${len.toUpperCase()} DAY (${LENGTHS[len].picks} picks), ${RUNS} runs`);
  console.log('player  | avg credits | R / SR / SSR / UR / LR % | SSR+ picks | UR+ picks | runs with LR | pity fires');
  for (const [name, pl] of Object.entries(PLAYERS)) {
    const r = sim(len, pl);
    console.log(`${name.padEnd(7)} | ${r.avgK} | ${r.mix} | ${r.ssrPlus} | ${r.urPlus} | ${r.lrRuns} | ${r.pity}`);
  }
}
