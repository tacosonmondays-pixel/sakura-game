// scratch: builds notes/balance/MEASURE.csv and the per-girl table from the measure/*.jsonl runs
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

const M = process.argv[2] || '../notes/balance/measure';
const read = (f) => (existsSync(`${M}/${f}`) ? readFileSync(`${M}/${f}`, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const kit = read('kit.jsonl');
const soloA = read('solo-A.jsonl');
const soloB = read('solo-B.jsonl');
const soloC = read('solo-C.jsonl');
const solF = read('solo-F.jsonl');
const panel = read('panel-full.jsonl');
const bench = existsSync('../notes/balance/bench-max-4-5.jsonl') ? readFileSync('../notes/balance/bench-max-4-5.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];

// what holds her back, from her kit at max investment (tools/_kit.mjs) and the runs; and how far to trust the row
const LIMITS = {
  hotaru: 'nothing in these runs; boss damage leans on holy vs the undead and construct bosses (Matriarch test target only 17%); her DPS cell reads 6% of Kage\'s (pulse targets and crits not counted)',
  shiro: 'nothing; map-wide reach makes her the boss outlier (boss waves 432%, Matriarch target 447%)',
  akane: 'nothing in solo; crowd map flatters her splash (sky waves 272%); fire is halved on fire-warded dragons',
  tenka: 'nothing; slightly lower single-target (Matriarch target 79%)',
  kage: 'reference; her ability (kage.doubles) is still locked, so the reference moves up when A4 lands',
  sango: 'boss damage (55%); 3 of 6 builds ground-only',
  rei: 'ground-only (0 air damage); short reach 4.3',
  midori: 'own damage is %-max-HP poison, so it swings with enemy HP (4-5 46%, 8-2 202%); value is her brew',
  suzu: 'traps never crit (crit lines fill in as half ATK), ground-only, almost no boss damage (9%), ability locked',
  aoi: 'low single-target on her best crowd build; nothing structural',
  kinu: 'very short reach (2.78: 5 tiles of road), almost no boss damage (6.5%); strong on crowds (8-2 140%)',
  iroha: 'short reach (3.19), low damage per hit (153) against deep armour, no boss damage (10%), ability locked (mirror rework #156)',
  marumi: 'ground-only (lob only: 18% air), knockback pushes the wave out of her reach, no boss damage (8%)',
  raika: 'low damage per jump (233) against deep armour; weak on bosses (24%)',
  chika: 'damage builds are weak (her value is the link); ability locked',
  yuki: 'low damage; freezes capped by Freeplay Resolve; weak as a support too',
  kaede: 'single-target duelist with mid single-target numbers (Matriarch target 37%); weak on crowds (8-2 17.5%); 4 of 6 builds ground-only',
  yuzuha: 'sentries have low numbers and are ground-only (4% air on 8-2); nets are kill-only',
  ruri: 'short reach (3.75), low numbers, almost no boss damage (6%); two of her three ability forms locked',
  chigusa: 'vines and thorn beds are ground-only and never crit; beds are kill-only; low numbers',
  momo: 'economy girl: only 2-0-5 deals damage; no combat uplift (coins not measured)',
  fuu: 'low numbers; ability locked (move); utility girl (grounding)',
  ena: 'curse bursts are kill-only (alone she rarely kills, so x28 when buffed); one hit per shot (no pierce or splash)',
  hana: 'low numbers on every build; weak on bosses (10%)',
  azami: 'strips are ground-only (0 air) and touch bosses almost never (0.8%); low numbers; strip cap rework pending (#160)',
  umeko: 'support (aura)', miko: 'support (aura)', noa: 'support (aura; adds nothing next to Umeko)', wakaba: 'support (drink)', ouka: 'support (office rules)',
};
const CONF = {
  hotaru: 'medium: boss number depends on boss type', shiro: 'high', akane: 'medium: map-dependent (crowds)', tenka: 'high', kage: 'reference; ability locked',
  sango: 'medium: map-dependent', rei: 'medium: ground-only, 8-2 is only 25% air', midori: 'low for own damage (%HP)', suzu: 'low: ability locked, map-dependent',
  aoi: 'high', kinu: 'medium: map-dependent', iroha: 'low: ability locked, rework pending', marumi: 'medium', raika: 'high', chika: 'low as damage (ability locked)',
  yuki: 'medium', kaede: 'high', yuzuha: 'medium: kill-only nets', ruri: 'medium: forms locked', chigusa: 'medium: kill-only beds', momo: 'high (damage only)',
  fuu: 'low: ability locked', ena: 'medium: kill-only bursts play better in a team that kills', hana: 'high', azami: 'medium: rework pending',
  umeko: 'see supports', miko: 'see supports', noa: 'see supports', wakaba: 'see supports', ouka: 'see supports',
};
const PURE = new Set(['umeko', 'miko', 'noa', 'wakaba', 'ouka']);
const HYBRID = new Set(['midori', 'chika', 'yuki']);
const girls = [...new Set(kit.map((k) => k.id))];
const kitOf = (id, b) => kit.find((k) => k.id === id && k.build === b);
const best = (rows, id, key) => rows.filter((r) => r.unitId === id).sort((a, b) => b[key] - a[key])[0] || null;
const fRow = (id, buffed) => solF.find((r) => r.unitId === id && !!r.buff === buffed) || null;

const K = {
  A: best(soloA, 'kage', 'total'),
  B: best(soloB, 'kage', 'total'),
  C: best(soloC, 'kage', 'boss'),
  F: fRow('kage', true),
  F0: fRow('kage', false),
  tt: Math.max(...(bench.find((b) => b.unitId === 'kage')?.builds || []).map((b) => b.boss || 0)),
  panel: panel.find((p) => p.core?.[0]?.startsWith('kage'))?.panel?.max || null,
};
const pc = (v, ref) => (v != null && ref ? Math.round((v / ref) * 1000) / 10 : null);
const geo = (xs) => {
  const v = xs.filter((x) => x != null && x > 0);
  return v.length ? Math.round(Math.exp(v.reduce((a, x) => a + Math.log(x), 0) / v.length) * 10) / 10 : null;
};
const BAND = { SSR: [75, 100], SR: [55, 80], R: [40, 60] };
const rows = [];
for (const id of girls) {
  const k0 = kit.find((k) => k.id === id);
  const a = best(soloA, id, 'total');
  const b = best(soloB, id, 'total');
  const c = best(soloC, id, 'boss');
  const f = fRow(id, true);
  const f0 = fRow(id, false);
  const tt = Math.max(0, ...(bench.find((x) => x.unitId === id)?.builds || []).map((x) => x.boss || 0));
  const pf = panel.find((p) => p.core?.[0]?.startsWith(`${id} `))?.panel?.max ?? null;
  const ka = a ? kitOf(id, a.build) : null;
  const r = {
    girl: id, rarity: k0.rarity, role: k0.role, kind: PURE.has(id) ? 'support' : HYBRID.has(id) ? 'hybrid' : 'damage',
    bestA: a?.build ?? null, A_total: a?.total ?? null, A_pct: pc(a?.total, K.A?.total), A_peakWave: a?.peakWaveDmg ?? null, A_peak_pct: pc(a?.peakWaveDmg, K.A?.peakWaveDmg),
    A_boss: a?.boss ?? null, A_air: a?.air ?? null,
    bestB: b?.build ?? null, B_total: b?.total ?? null, B_pct: pc(b?.total, K.B?.total), B_air: b?.air ?? null, B_air_pct: pc(b?.air, K.B?.air), B_airShare: b && b.total ? Math.round((b.air / b.total) * 1000) / 10 : null,
    bestC: c?.build ?? null, C_boss: c?.boss ?? null, C_boss_pct: pc(c?.boss, K.C?.boss), C_total_pct: pc(c?.total, K.C?.total),
    F_alone: f0?.total ?? null, F_buffed: f?.total ?? null, F_pct: pc(f?.total, K.F?.total), F_peak_pct: pc(f?.peakWaveDmg, K.F?.peakWaveDmg), buffMul: f && f0 && f0.total ? Math.round((f.total / f0.total) * 100) / 100 : null,
    tt_boss_dps: tt || null, tt_pct: pc(tt, K.tt), panel_full: pf, panel_pct: pc(pf, K.panel),
    air: ka?.air ?? null, crit: ka ? `${Math.round(ka.crit[0] * 100)}% x${ka.crit[1]}` : null, range: ka?.range ?? null, beh: ka?.beh ?? null, abil: ka?.abil ?? null,
  };
  r.overall = geo([r.A_pct, r.B_pct, r.C_boss_pct, r.F_pct]);
  const band = BAND[r.rarity];
  r.band = band ? `${band[0]}-${band[1]}` : null;
  r.vsBand = id === 'kage' ? 'reference' : r.kind === 'support' || r.overall == null || !band ? null : r.overall < band[0] ? 'below' : r.overall > band[1] ? 'above' : 'inside';
  r.limits = LIMITS[id] || '';
  r.confidence = CONF[id] || '';
  rows.push(r);
}
rows.sort((x, y) => (y.overall ?? -1) - (x.overall ?? -1));
const cols = Object.keys(rows[0]);
const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
writeFileSync(`${M}/../MEASURE.csv`, [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n');
// ---- supports: uplift on the core (Kage 5-2-0, Hotaru 5-2-0, Akane 5-0-2), scenario D (4-5 waves 152–230) and
// its deep part (203–230, where the core alone handles 12% of the HP), plus BENCH's one-carry test-target uplift
const team = [...read('team-D.jsonl'), ...read('team-D-heroes.jsonl')];
const base = team.find((t) => !t.extra.length && !t.hero);
const deep = (t) => t.waves.filter((w) => w.w >= 203).reduce((a, w) => a + w.dmg, 0);
const deepHp = (t) => t.waves.filter((w) => w.w >= 203).reduce((a, w) => a + w.hp, 0);
const sup = [];
for (const t of team) {
  if (t === base) continue;
  const extra = t.extra.join(' + ');
  const one = t.extra.length === 1 && !t.hero ? t.extra[0].split(' ')[0] : null;
  const b = one ? bench.find((x) => x.unitId === one) : null;
  const bb = b ? b.builds.find((x) => x.build === t.extra[0].split(' ')[1]) : null;
  sup.push({
    setup: (t.hero ? `hero ${t.hero}${extra ? ' + ' : ''}` : '') + (extra === 'umeko 2-5-0 + midori 5-0-2 + chika 2-5-0 + wakaba 5-0-2' ? 'full four (umeko, midori, chika, wakaba)' : extra.replace('umeko 2-5-0 + midori 5-0-2 + chika 2-5-0 + wakaba 5-0-2', 'full four')),
    coreUplift: Math.round((t.coreDmg / base.coreDmg) * 100) / 100,
    teamUplift: Math.round((t.teamDmg / base.teamDmg) * 100) / 100,
    deepUplift: Math.round((deep(t) / deep(base)) * 100) / 100,
    deepShare: Math.round((deep(t) / deepHp(t)) * 100),
    ownDmgM: Math.round(t.placed.filter((p) => !['kage', 'hotaru', 'akane'].includes(p.unitId)).reduce((a, p) => a + p.dmg, 0) / 1e6),
    benchUpliftCrowd: bb?.uplift_crowd ?? null, benchUpliftBoss: bb?.uplift_boss ?? null,
  });
}
sup.sort((a, b) => b.deepUplift - a.deepUplift);
const csv = (rs) => {
  const c = Object.keys(rs[0]);
  return [c.join(','), ...rs.map((r) => c.map((k) => esc(r[k])).join(','))].join('\n') + '\n';
};
writeFileSync(`${M}/../MEASURE-supports.csv`, csv(sup));
for (const s of sup) console.error(JSON.stringify(s));
// ---- heroes: alone at Lv 25 + full Mastery (A, B, C) as % of Kage's best
const hs = read('heroes-solo.jsonl').filter((h) => h.level === 'Lv25+25%');
const heroes = [...new Set(hs.map((h) => h.unitId))].map((id) => {
  const g = (s) => hs.find((h) => h.unitId === id && h.scen === s);
  const a = g('A');
  const b = g('B');
  const c = g('C');
  return { hero: id, rarity: a.rarity, A_pct: pc(a.total, K.A.total), A_peak_pct: pc(a.peakWaveDmg, K.A.peakWaveDmg), B_pct: pc(b.total, K.B.total), B_air_pct: pc(b.air, K.B.air), C_boss_pct: pc(c.boss, K.C.boss), overall3: geo([pc(a.total, K.A.total), pc(b.total, K.B.total), pc(c.boss, K.C.boss)]) };
});
writeFileSync(`${M}/../MEASURE-heroes.csv`, csv(heroes));
for (const h of heroes) console.error(JSON.stringify(h));
console.log(JSON.stringify({ kage: { A: K.A?.build, B: K.B?.build, C: K.C?.build, A_total: K.A?.total, B_total: K.B?.total, C_boss: K.C?.boss, F: K.F?.total, F0: K.F0?.total, tt: K.tt, panel: K.panel } }));
for (const r of rows) console.log(JSON.stringify(r));
