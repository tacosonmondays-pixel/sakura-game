// Freeplay difficulty curve: what every freeplay wave of a stage and tier asks of a team, read
// straight from the wave generator (no battle is played).
//
//   node --import ./tools/simLoader.mjs tools/freeplayCurve.mjs <stage> <tier> [--coop] [--json]
//        [--from 31] [--to 200] [--hit 30] [--rows 5] [--save <file>] [--base <file>]
//
// Per wave: spawns, total / boss / elite HP, the pressure armor and the elites' extra armor, the
// effective HP a `hit`-damage attack meets at armor pen 0 / 10 / 20 (barriers, affix armor,
// pressure armor, the elite band and elite modifiers all counted; armor takes at most hit − 1, or
// (1 − FREEPLAY_ARMOR_FLOOR) of it where the tree has the floor),
// the required DPS (effective HP at pen 10 ÷ 60 s), the biggest single enemy and the smoothing
// factor k. Then the curve check (target (d) of the path-cap pass): for each non-boss wave n in
// [from, to], its per-wave growth over the previous non-boss wave m,
//   g = (E_n / E_m)^(1 / (n − m)) − 1,   E = effective HP at pen 10,
// how many waves grow more than 8 % / 12 % / 13 % a wave, and the worst ones. With --base (a file
// written by --save from an older tree): the mean effective HP ratio over [from, to] and the big
// enemy HP at the tens from wave 166.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const VALUED = ['--from', '--to', '--hit', '--rows', '--save', '--base', '--root'];
const pos = args.filter((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]));
const [stageId = '4-5', tier = 'blossom'] = pos;
const coop = args.includes('--coop');
const HIT = Number(opt('hit', 30));
const FROM = Number(opt('from', 31));
const TO = Number(opt('to', 200));
const STEP = Number(opt('rows', 5));
// --root lets the same tool read an older checkout (e.g. `git archive fddf01c src` unpacked)
const ROOT = resolve(opt('root', '.'));
const imp = (p) => import(`${ROOT}/${p}`);

const { Sim } = await imp('src/sim/Sim.js');
// armor takes at most (1 − floor) of a hit in freeplay (0 on a tree without the floor)
const FLOOR = (await imp('src/sim/constants.js')).FREEPLAY_ARMOR_FLOOR ?? 0;
const stage = coop
  ? (await imp('src/data/coop.js')).coopStage(stageId, { freeplay: tier })
  : (await imp('src/data/freeplaySolo.js')).soloFreeplayStage(stageId, tier);
if (!stage?.freeplay) {
  console.error(`no freeplay for ${stageId} ${tier}`);
  process.exit(1);
}
const sim = new Sim({ stageId, difficulty: 'normal', seed: 1, loadout: [], options: { freeplay: true }, data: { stage } });
const base = (stage.hpScale ?? 1) * sim.diff.hpMul;
const G = stage.waves;

const rows = [];
for (let n = G + 1; n <= Math.max(TO, 200) + 10; n++) {
  const w = sim._getWave(n);
  const fp = w.freeplay;
  const press = fp.pressure || { armor: 0, bossArmor: 0 };
  let hp = 0, bossHp = 0, eliteHp = 0, barrier = 0, big = 0, bigId = '', maxEliteArmor = 0;
  const eff = { 0: 0, 10: 0, 20: 0 };
  const effReg = { 0: 0, 10: 0, 20: 0 };
  for (const s of w.spawns) {
    const def = sim.data.enemy(s.enemyId);
    const mul = base * (s.hpMul ?? w.hpMul);
    const h = Math.max(1, def.hp * mul);
    const tierE = def.tier || 'normal';
    const isBoss = tierE === 'miniboss' || tierE === 'boss';
    const armor = (def.armor || 0) + (s.mods?.armor || 0) + (isBoss ? press.bossArmor || 0 : press.armor);
    let bar = 0;
    if (def.traits?.barrier) bar = Math.max(1, def.traits.barrier.hp * mul);
    else if (s.mods?.barrierPct) bar = def.hp * s.mods.barrierPct * mul;
    hp += h;
    barrier += bar;
    if (h > big) { big = h; bigId = s.enemyId; }
    if (isBoss) bossHp += h;
    else if (tierE === 'elite') { eliteHp += h; maxEliteArmor = Math.max(maxEliteArmor, armor); }
    for (const pen of [0, 10, 20]) {
      const f = HIT / Math.max(1, HIT - Math.max(0, armor - pen), HIT * FLOOR);
      eff[pen] += (h + bar) * f;
      if (!isBoss) effReg[pen] += (h + bar) * f;
    }
  }
  rows.push({
    n, count: w.spawns.length, ramp: w.hpMul, hp, bossHp, eliteHp, barrier, armor: press.armor, eliteArmor: fp.eliteArmor ?? 0,
    maxEliteArmor, affix: fp.affix || '', boss: fp.boss ? `${fp.boss.small ? 'small ' : ''}${fp.boss.kind}:${fp.boss.bosses.join('+')}` : '',
    eliteMods: (fp.eliteMods || []).map((m) => `${m.mod}:${m.enemyId}`).join(' '),
    eff0: eff[0], eff10: eff[10], eff20: eff[20], reg10: effReg[10], dps10: eff[10] / 60, big, bigId, k: fp.k ?? 1,
  });
}

// the curve check (d): non-boss waves in [FROM, TO] vs the previous non-boss wave
const nb = rows.filter((r) => !r.boss);
const jumps = [];
for (let i = 1; i < nb.length; i++) {
  const r = nb[i];
  const p = nb[i - 1];
  if (r.n < FROM || r.n > TO) continue;
  const g = Math.pow(r.eff10 / p.eff10, 1 / (r.n - p.n)) - 1;
  jumps.push({ n: r.n, m: p.n, g, affix: `${p.affix || '-'}→${r.affix || '-'}`, armor: r.armor, k: r.k });
}
const over = (x) => jumps.filter((j) => j.g > x).length;
const summary = {
  stage: stageId, tier, coop, hit: HIT, from: FROM, to: TO, nonBoss: jumps.length,
  over8: over(0.08), over12: over(0.12), over13: over(0.13), worst: [...jumps].sort((a, b) => b.g - a.g).slice(0, 8),
  mean: jumps.reduce((a, j) => a + j.g, 0) / Math.max(1, jumps.length),
};

const basePath = opt('base', null);
if (basePath && existsSync(basePath)) {
  const old = new Map(JSON.parse(readFileSync(basePath, 'utf8')).rows.map((r) => [r.n, r]));
  let sum = 0, cnt = 0, sumAll = 0, cntAll = 0;
  for (const r of rows) {
    const o = old.get(r.n);
    if (!o || r.n < FROM || r.n > TO) continue;
    sumAll += r.eff10 / o.eff10;
    cntAll++;
    if (!r.boss && !o.boss) { sum += r.eff10 / o.eff10; cnt++; }
  }
  summary.vsBase = { meanNonBoss: sum / Math.max(1, cnt), meanAll: sumAll / Math.max(1, cntAll) };
  summary.bigTens = rows.filter((r) => r.n >= 166 && r.n <= 200 && r.n % 10 === 0)
    .map((r) => ({ n: r.n, big: r.big, id: r.bigId, base: old.get(r.n)?.big ?? null, baseId: old.get(r.n)?.bigId ?? null }));
}

const save = opt('save', null);
if (save) {
  const keep = rows.map((r) => ({ n: r.n, eff10: Math.round(r.eff10), big: Math.round(r.big), bigId: r.bigId, boss: r.boss }));
  writeFileSync(save, `${JSON.stringify({ stage: stageId, tier, coop, hit: HIT, rows: keep })}\n`);
}

const fmt = (x) => (x >= 1e9 ? `${(x / 1e9).toFixed(2)}B` : x >= 1e6 ? `${(x / 1e6).toFixed(2)}M` : x >= 1e3 ? `${(x / 1e3).toFixed(1)}k` : x.toFixed(0));
if (args.includes('--json')) {
  console.log(JSON.stringify({ summary, rows }));
} else {
  console.log(`${stageId} ${tier}${coop ? ' co-op' : ''} (${G} waves, hpScale ${stage.hpScale}) · hit ${HIT}`);
  console.log('wave | n | total HP | boss HP | elite HP | +armor | elite +armor | eff pen0 | eff pen10 | eff pen20 | req DPS | k | boss | elite mods');
  for (const r of rows) {
    if (r.n % STEP !== 0 || r.n > TO) continue;
    console.log(`${r.n} | ${r.count} | ${fmt(r.hp)} | ${fmt(r.bossHp)} | ${fmt(r.eliteHp)} | ${r.armor.toFixed(1)} | ${r.eliteArmor.toFixed(1)} | ${fmt(r.eff0)} | ${fmt(r.eff10)} | ${fmt(r.eff20)} | ${fmt(r.dps10)} | ${r.k.toFixed(2)} | ${r.boss} | ${r.eliteMods}`);
  }
  console.log(`curve (d): ${summary.nonBoss} non-boss waves ${FROM}-${TO}; per-wave growth > 8 %: ${summary.over8}, > 12 %: ${summary.over12}, > 13 %: ${summary.over13}; mean ${(summary.mean * 100).toFixed(2)} %`);
  console.log(`worst: ${summary.worst.map((j) => `${j.n} +${(j.g * 100).toFixed(1)}% (${j.affix}, k ${j.k.toFixed(2)})`).join(' · ')}`);
  if (summary.vsBase) {
    console.log(`vs base: mean effective HP (pen 10) non-boss ×${summary.vsBase.meanNonBoss.toFixed(3)}, all waves ×${summary.vsBase.meanAll.toFixed(3)}`);
    console.log(`big enemy at the tens: ${summary.bigTens.map((b) => `${b.n} ${fmt(b.big)} ${b.id} (base ${b.base ? fmt(b.base) : '-'} ${b.baseId || ''})`).join(' · ')}`);
  }
}
