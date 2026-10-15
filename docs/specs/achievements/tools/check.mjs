// Checks final/catalog.mjs against the LIVE game (read-only imports; writes only final/out.json):
//   1. validation (ids, names, rewards, caps, cosmetics, content words)
//   2. totals (count, gems, tickets, boxes by rarity, ribbons, titles) by release wave and category
//   3. pacing for a NEW player (hour 1 / day 5 / day 25 / day 60)
//   4. update day: what veteran saves (early / mid / late, research-economy §4.1) can claim at once
// Archetypes extend _cat/eval.mjs; boss / miniboss / elite and rare-slime kills are set explicitly
// instead of spreading every kill evenly (that made "defeat X n times" look met on update day).
// usage: node docs/specs/achievements/tools/check.mjs [--quiet]
//   5. shipped data: since the build (feature/achievements), src/data/achievements.js holds the 30 shipped rows AND
//      the expansion. The "existing" archetype figures read only the shipped 30, and every catalogue row must be in
//      the game data with the same fields, so the totals of the shipped data equal the catalogue's (exit 1 if not).
const LIVE = new URL('../../../../', import.meta.url).pathname.replace(/\/$/, '');
const fs = await import('node:fs');
const { createProfile } = await import(`${LIVE}/src/systems/save.js`);
const { achievementList, discoverableEnemies } = await import(`${LIVE}/src/systems/missions.js`);
const { STAGES, CAMPAIGN_IDS, CHAPTERS, stageEnemies } = await import(`${LIVE}/src/data/stages.js`);
const { UNITS } = await import(`${LIVE}/src/data/units.js`);
const { ENEMIES } = await import(`${LIVE}/src/data/enemies.js`);
const { ITEMS } = await import(`${LIVE}/src/data/items.js`);
const { ACHIEVEMENTS: GAME_ROWS, DAILY_MISSIONS, WEEKLY_MISSIONS } = await import(`${LIVE}/src/data/missions.js`);
const { rollGear, addGear } = await import(`${LIVE}/src/systems/gear.js`);
const { createRng } = await import(`${LIVE}/src/core/rng.js`);
const { CATALOG, EXISTING, FREEPLAY_TITLES, NO_COSMETIC } = await import('./catalog.mjs');
// the shipped 30: every game row that is not a catalogue row (before the build, that is every row)
const CATALOG_IDS = new Set(CATALOG.map((a) => a.id));
const ACHIEVEMENTS = GAME_ROWS.filter((a) => !CATALOG_IDS.has(a.id));
const SHIPPED_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));

const DIFFS = ['easy', 'normal', 'hard', 'nightmare'];
const range = (a, b) => CAMPAIGN_IDS.slice(CAMPAIGN_IDS.indexOf(a), CAMPAIGN_IDS.indexOf(b) + 1);
const ORDER = ['hikari', 'aoi', 'rei', 'yuki', 'nami', 'sango', 'kage', 'umeko', 'shiro', 'midori', 'suzu', 'momo', 'akane', 'miko', 'raika', 'luna', 'hotaru', 'kaede', 'chika'];
const E = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
const DISC = discoverableEnemies();
const FAMILIES = [...new Set(DISC.map((id) => E[id].family))];
const BIGS = ENEMIES.filter((e) => ['boss', 'miniboss', 'elite'].includes(e.tier)).map((e) => e.id);

// ---- archetypes ---------------------------------------------------------------------------------
// journey = a NEW player after launch (new counters and train A data counted from day one)
// retro   = a veteran save on update day (new counters 0; train A shipped one release earlier)
const ARCH = {
  hour1: {
    label: 'New player, ~1 hour (chapter 1 done, before 2-1)', normal: range('1-1', '1-5'), easy: [], hard: [], nightmare: [], bounty: {}, boss: {},
    units: 10, unitLevels: [12, 10, 10, 8, 6, 5, 5, 3, 1, 1], awaken: [], pulls: 10, battles: 7, wins: 6, kills: 600, bigKills: 1,
    counters: { login: 1, battleWin: 6, levelUp: 40, pull: 10, bossKill: 1, kill: 600, spendCoins: 20000 }, gear: {},
    journey: { lessons: 5, storyChapters: 1, formation: 8, 'c.ults': 8, freeplayExtra: 10 }, retro: {},
  },
  early: {
    label: 'Early (day ~5, chapter 2-3)', normal: range('1-1', '2-5'), easy: [], hard: range('1-1', '1-3'), nightmare: [],
    bounty: { 'res-books-1': ['normal'], 'res-gear-1': ['normal'] }, boss: {},
    units: 12, unitLevels: [18, 16, 15, 14, 12, 12, 10, 10, 8, 8, 5, 5], awaken: [], pulls: 90, battles: 45, wins: 38, kills: 6500, bigKills: 2, slimeGold: 5,
    counters: { login: 5, dailyDone: 3, battleWin: 38, battleWinHard: 6, sweep: 20, levelUp: 120, gearReroll: 1, pull: 90, bossKill: 4, spendCoins: 250000, kill: 6500 },
    gear: { common: 14, rare: 6 },
    journey: { lessons: 8, storyChapters: 2, formation: 8, 'c.ults': 120, 'c.coopWin': 2, 'c.flawless': 1, 'c.eventWin': 2, challengeWave: 12, freeplayExtra: 10, fullSets: 1 },
    retro: { lessons: 8, formation: 8, challengeWave: 8, fullSets: 1 },
  },
  mid: {
    label: 'Mid (day ~25, chapter 6)', normal: range('1-1', '6-3'), easy: range('1-1', '1-5'), hard: range('1-1', '4-2'), nightmare: ['1-1'],
    bounty: { 'res-books-1': ['normal', 'hard'], 'res-coins-1': ['normal', 'hard'], 'res-gear-1': ['normal', 'hard'], 'res-mats-a-1': ['normal', 'hard'], 'res-mats-b-1': ['normal', 'hard'], 'res-books-2': ['normal'], 'res-gear-2': ['normal'] },
    boss: { 'boss-lych': ['normal'] }, arenaRunsPerStage: 25,
    units: 17, unitLevels: [38, 36, 35, 34, 33, 32, 30, 28, 26, 25, 22, 20, 18, 15, 12, 10, 8], awaken: [2, 1, 1], pulls: 220, battles: 260, wins: 220, kills: 38000, bigKills: 5, slimeGold: 40,
    counters: { login: 25, dailyDone: 18, battleWin: 220, battleWinHard: 60, sweep: 420, levelUp: 420, gearReroll: 14, pull: 220, bossKill: 45, spendCoins: 3200000, kill: 38000 },
    gear: { common: 40, rare: 45, superRare: 18, mythic: 1 }, gearPlus10: { rare: 3, superRare: 2 },
    journey: { lessons: 11, storyChapters: 6, formation: 8, 'c.ults': 700, 'c.coopWin': 8, 'c.flawless': 4, 'c.weeklyDone': 3, 'c.eventWin': 6, 'c.salvage': 40, 'c.clanBossHit': 10, challengeWave: 25, freeplayExtra: 40, fpBest: { blossom: 70 }, fullSets: 9, lobbyBgs: 1 },
    retro: { lessons: 11, formation: 8, challengeWave: 25, freeplayExtra: 25, fpBest: { blossom: 45 }, fullSets: 9, lobbyBgs: 1 },
  },
  late: {
    label: 'Late (day ~60, campaign done)', normal: CAMPAIGN_IDS, easy: range('1-1', '3-5'), hard: CAMPAIGN_IDS, nightmare: range('1-1', '2-5'),
    bounty: Object.fromEntries(STAGES.filter((s) => s.kind === 'resource').map((s) => [s.id, ['normal', 'hard']])),
    boss: { 'boss-lych': ['normal', 'hard'], 'boss-colossus': ['normal', 'hard'], 'boss-ashwing': ['normal'] }, arenaRunsPerStage: 60,
    units: 19, unitLevels: [60, 58, 55, 52, 50, 50, 48, 46, 45, 44, 42, 40, 40, 38, 35, 32, 30, 28, 25], awaken: [5, 3, 3, 2, 2, 1, 1, 1], pulls: 480, battles: 700, wins: 620, kills: 140000, bigKills: 12, slimeGold: 150, slimeMimic: 60, fae: 15,
    counters: { login: 60, dailyDone: 50, battleWin: 620, battleWinHard: 300, sweep: 2500, levelUp: 900, gearReroll: 70, pull: 480, bossKill: 180, spendCoins: 14000000, kill: 140000 },
    gear: { common: 60, rare: 90, superRare: 80, mythic: 18, legendary: 3 }, gearPlus10: { superRare: 10, mythic: 8, legendary: 2 },
    journey: { lessons: 11, storyChapters: 8, formation: 8, 'c.ults': 2000, 'c.coopWin': 25, 'c.flawless': 15, 'c.squad3': 1, 'c.weeklyDone': 8, 'c.eventWin': 15, 'c.salvage': 150, 'c.clanBossHit': 30, 'c.donate': 10, challengeWave: 45, freeplayExtra: 95, fpBest: { blossom: 120, tempest: 70 }, coopBest: 60, fpm: ['blossom:w100'], fpBossKilled: ['fp_foundry_titan'], fullSets: 9, lobbyBgs: 2 },
    retro: { lessons: 11, formation: 8, challengeWave: 45, freeplayExtra: 95, fpBest: { blossom: 110, tempest: 60 }, coopBest: 40, fpm: ['blossom:w100'], fullSets: 9, lobbyBgs: 2 },
  },
};

function build(spec, seed = 7) {
  const p = createProfile();
  const rng = createRng(seed);
  const stages = p.progress.stages;
  const mark = (id, d) => { (stages[id] ||= { easy: false, normal: false, hard: false, nightmare: false, clears: 0 })[d] = true; stages[id].clears += 3; };
  for (const d of DIFFS) for (const id of spec[d] || []) mark(id, d);
  for (const [id, ds] of Object.entries({ ...(spec.bounty || {}), ...(spec.boss || {}) })) for (const d of ds) mark(id, d);
  if (spec.arenaRunsPerStage) for (const s of STAGES) if (s.kind === 'resource' && stages[s.id]) stages[s.id].clears = spec.arenaRunsPerStage;
  const ids = ORDER.filter((id) => UNITS.some((u) => u.id === id)).slice(0, spec.units);
  p.units = {};
  ids.forEach((id, i) => {
    const lv = spec.unitLevels[i] ?? spec.unitLevels.at(-1);
    p.units[id] = { level: lv, exp: 0, breakthrough: Math.floor((lv - 1) / 10), awaken: spec.awaken[i] ?? 0, gear: { charm: null, ribbon: null, shoes: null }, obtainedAt: Date.now(), favorite: false };
  });
  const disc = new Set();
  for (const id of Object.keys(stages)) for (const e of stageEnemies(id)) disc.add(e);
  const regular = [...disc].filter((e) => !BIGS.includes(e));
  for (const e of disc) p.bestiary[e] = { seen: true, discovered: true, kills: BIGS.includes(e) ? spec.bigKills : Math.floor(spec.kills / regular.length) };
  const setK = (id, n) => { if (p.bestiary[id]) p.bestiary[id].kills = n; };
  setK('slime_gold', spec.slimeGold ?? 0); setK('slime_mimic', spec.slimeMimic ?? 0); setK('fae_queen', spec.fae ?? 0);
  if (spec === ARCH.late) setK('dragon_ashwing', 4);
  p.gacha.totalPulls = spec.pulls;
  p.stats = { battles: spec.battles, wins: spec.wins, kills: spec.kills, pulls: spec.pulls, gemsEarned: 0 };
  p.missions.counters = { ...spec.counters };
  for (const [r, n] of Object.entries(spec.gear || {})) for (let i = 0; i < n; i++) addGear(p, rollGear(rng, { rarity: r, level: i < (spec.gearPlus10?.[r] || 0) ? 10 : 0 }));
  return p;
}

const RAR = ['common', 'rare', 'superRare', 'mythic', 'legendary'];
function metric(p, a, x, claimedCount) {
  const st = p.progress.stages;
  const units = Object.values(p.units);
  const gear = Object.values(p.gear);
  const c = p.missions.counters;
  const has = (id, d) => !!st[id]?.[d];
  const cleared = (id) => DIFFS.some((d) => has(id, d));
  switch (a.metric) {
    case 'stagesCleared': return CAMPAIGN_IDS.filter(cleared).length;
    case 'medals': return CAMPAIGN_IDS.filter((id) => has(id, a.param)).length;
    case 'medalsAll': return CAMPAIGN_IDS.filter((id) => DIFFS.every((d) => has(id, d))).length;
    case 'chapterSets': return CHAPTERS.filter((ch) => ch.stages.every((id) => has(id, a.param))).length;
    case 'stageMedals': return DIFFS.filter((d) => has(a.param, d)).length;
    case 'kindClear': return STAGES.filter((s) => s.kind === a.param && cleared(s.id)).length;
    case 'kindMedals': { const [k, d] = a.param.split(':'); return STAGES.filter((s) => s.kind === k && has(s.id, d)).length; }
    case 'bossClears': return STAGES.filter((s) => s.kind === 'boss' && cleared(s.id)).length;
    case 'arenaRuns': return [1, 2, 3].reduce((n, t) => n + (st[`${a.param}-${t}`]?.clears || 0), 0);
    case 'challengeWave': return x.challengeWave || 0;
    case 'counter': return a.param in c ? c[a.param] : (x[`c.${a.param.replace(/^ach:/, '')}`] || 0);
    case 'killsAll': return Math.max(p.stats.kills, c.kill || 0);
    case 'winsAll': return (c.battleWin || 0) + (x['c.coopWin'] || 0);
    case 'familiesFound': return FAMILIES.filter((f) => DISC.filter((id) => E[id].family === f).every((id) => p.bestiary[id]?.discovered)).length;
    case 'familyFound': return DISC.filter((id) => E[id].family === a.param && p.bestiary[id]?.discovered).length;
    case 'familyKills': return Object.entries(p.bestiary).filter(([id]) => E[id]?.family === a.param).reduce((n, [, b]) => n + (b.kills || 0), 0);
    case 'enemyKills': return p.bestiary[a.param]?.kills || 0;
    case 'enemySetKilled': return a.param.split(',').filter((id) => (p.bestiary[id]?.kills || 0) > 0 || (x.fpBossKilled || []).includes(id)).length;
    case 'maxBreakthrough': return Math.max(0, ...units.map((u) => u.breakthrough || 0));
    case 'unitsAtLevel': return units.filter((u) => u.level >= a.param).length;
    case 'unitsOwned': return units.length;
    case 'unitsAwakened': return units.filter((u) => (u.awaken || 0) > 0).length;
    case 'awakenStars': return units.reduce((n, u) => n + (u.awaken || 0), 0);
    case 'urOwned': return UNITS.filter((d) => d.rarity === 'SSR' && (p.units[d.id]?.awaken || 0) >= 5).length;
    case 'gearReceived': return p.seq?.gear || 0;
    case 'gearEver': return gear.filter((gg) => RAR.indexOf(gg.rarity) >= RAR.indexOf(a.param)).length;
    case 'gearMaxEver': return gear.filter((gg) => gg.level >= 10 && (a.param === 'any' || gg.rarity === a.param)).length;
    case 'fullSets': return x.fullSets || 0;
    case 'formationSize': return x.formation || 0;
    case 'freeplayExtra': return x.freeplayExtra || 0;
    case 'freeplayBest': return a.param === 'any' ? Math.max(0, ...Object.values(x.fpBest || {}), x.coopBest || 0) : (x.fpBest?.[a.param] || 0);
    case 'fpTiers100': return ['blossom', 'tempest', 'crimson'].filter((t) => (x.fpBest?.[t] || 0) >= 100).length;
    case 'freeplayMark': return (x.fpm || []).some((k) => k === a.param || k.endsWith(`:${a.param}`)) ? 1 : 0;
    case 'lobbyBgs': return x.lobbyBgs || 0;
    case 'lessons': return x.lessons || 0;
    case 'storyChapters': return x.storyChapters || 0;
    case 'achievementsClaimed': return claimedCount;
    default: return 0; // codex, later
  }
}

const isBox = (r) => r.id.startsWith('gearbox_');
function evaluate(key, mode) {
  const spec = ARCH[key];
  const p = build(spec);
  const x = spec[mode] || {};
  const existing = achievementList(p, { includeHidden: true }).filter((a) => SHIPPED_IDS.has(a.id) && a.progress >= a.goal);
  const pool = CATALOG.filter((a) => {
    if (['CX', 'LATER', 'SO'].includes(a.avail)) return false;
    if (mode === 'retro' && a.avail === 'NEW') return false; // new counters start at 0 on update day
    return a.metric !== 'achievementsClaimed';
  });
  const metNew = pool.filter((a) => metric(p, a, x, 0) >= a.goal);
  let claimed = existing.length + metNew.length;
  for (const a of CATALOG.filter((m) => m.metric === 'achievementsClaimed').sort((u, v) => u.goal - v.goal)) if (claimed >= a.goal) { metNew.push(a); claimed += 1; }
  return { p, existing, metNew };
}

// ---- 1. validation -----------------------------------------------------------------------------
const problems = [];
const ID_RE = /^a_[a-z0-9_]+$/;
const allDefs = [...ACHIEVEMENTS.map((a) => ({ id: a.id, name: EXISTING[a.id]?.rename || a.name, ...EXISTING[a.id] })), ...CATALOG];
for (const a of allDefs) if (!ID_RE.test(a.id) || a.id.length > 24) problems.push(`bad id ${a.id}`);
const ids = allDefs.map((a) => a.id);
ids.forEach((id, i) => { if (ids.indexOf(id) !== i) problems.push(`duplicate id ${id}`); });
const taken = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS].map((m) => m.name.toLowerCase());
const names = allDefs.map((a) => a.name.toLowerCase());
names.forEach((n, i) => { if (names.indexOf(n) !== i) problems.push(`duplicate name ${n}`); if (taken.includes(n)) problems.push(`name clashes with a commission: ${n}`); });
for (const id of Object.keys(EXISTING)) if (!ACHIEVEMENTS.some((a) => a.id === id)) problems.push(`EXISTING has unknown id ${id}`);
for (const a of CATALOG) {
  for (const r of a.rewards) {
    if (!(r.id === 'gems' || r.id === 'coins' || ITEMS[r.id])) problems.push(`unknown reward ${a.id} ${r.id}`);
    if (['ticket_recruit10', 'ticket_ssr_select', 'gearbox_common'].includes(r.id)) problems.push(`forbidden reward ${a.id} ${r.id}`);
    if (r.id === 'gearbox_rare' && a.tier !== 1) problems.push(`Sturdy box above tier 1: ${a.id}`);
    if (r.id === 'gearbox_legendary' && a.tier !== 5) problems.push(`Celestial off a capstone: ${a.id}`);
    if (r.id === 'ticket_recruit' && a.tier !== 5) problems.push(`ticket off a capstone: ${a.id}`);
  }
  const gems = a.rewards.find((r) => r.id === 'gems')?.count || 0;
  if (a.grind && gems) problems.push(`gems on a grind step ${a.id}`);
  if (a.tier === 0 && gems) problems.push(`gems on a tier-0 step ${a.id}`);
  if (a.hidden && !a.hint) problems.push(`hidden without hint ${a.id}`);
  if (a.hidden && a.honor?.cls && a.honor.cls !== 'plain') problems.push(`secret with a non-plain ribbon ${a.id}`);
  if (NO_COSMETIC(a.id) && (a.honor || a.title)) problems.push(`cosmetic on excluded id ${a.id}`);
}
for (const [id, cz] of Object.entries(EXISTING)) if (NO_COSMETIC(id) && (cz.honor || cz.title)) problems.push(`cosmetic on excluded id ${id}`);
const BANNED = /gambl|casino|\bbet\b|\bkill(er|s|ed)?\b|cute|pretty|beautiful|sexy|swim|stupid|loser|noob|dumb|ugly|fat\b|skinny/i;
// Other commercial games' names are checked by hash, so this file never spells them out (critic pass, Oct 15).
const { createHash } = await import('node:crypto');
const OTHER_GAMES = new Set(['d5256e8562e791a8', '6800766e9c216411']);
const wordHashes = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map((w) => createHash('sha256').update(w.replace(/\d+$/, '').replace(/s$/, '')).digest('hex').slice(0, 16));
for (const a of allDefs) for (const s of [a.name, a.desc || '', a.title?.text || '', a.hint || '', a.honor?.name || '']) {
  if (BANNED.test(s)) problems.push(`word check ${a.id}: ${s}`);
  if (wordHashes(s).some((h) => OTHER_GAMES.has(h))) problems.push(`another game's name in ${a.id}`);
}
// box by tier (SPEC §1.1 rule 4): tier 1 = Sturdy and nothing better; Ornate only from tier 0/2 up
for (const a of CATALOG) {
  const boxes = a.rewards.filter((r) => /^gearbox_/.test(r.id)).map((r) => r.id);
  if (a.tier === 1 && boxes.some((id) => id !== 'gearbox_rare')) problems.push(`tier-1 row with a box better than Sturdy: ${a.id}`);
  if (a.tier >= 2 && a.tier <= 3 && boxes.some((id) => id === 'gearbox_legendary')) problems.push(`Celestial below tier 5: ${a.id}`);
}
const honors = allDefs.filter((a) => a.honor).map((a) => ({ id: a.id, avail: a.avail || 'LIVE', ...a.honor }));
const nos = honors.map((h) => h.no).sort((u, v) => u - v);
nos.forEach((n, i) => { if (n !== i + 1) problems.push(`honor numbers not 1..N at ${n}`); });
const specials = honors.filter((h) => h.cls === 'special');
if (specials.length !== 8 || new Set(specials.map((h) => h.fx)).size !== 8) problems.push('need 8 specials with 8 distinct effects');
if (honors.some((h) => (h.cls === 'special') !== !!h.fx)) problems.push('fx only on specials');
const titles = [...allDefs.filter((a) => a.title).map((a) => ({ id: a.id, avail: a.avail || 'LIVE', ...a.title })), ...Object.entries(FREEPLAY_TITLES).map(([id, t]) => ({ id, avail: 'shipped', ...t }))];
for (const t of titles) if (t.text.length > 24 || !/^[a-z][a-z0-9_]{0,23}$/.test(t.id)) problems.push(`title ${t.id} ${t.text}`);
const tx = titles.map((t) => t.text.toLowerCase());
tx.forEach((t, i) => { if (tx.indexOf(t) !== i) problems.push(`duplicate title ${t}`); });

// ---- 2. totals ---------------------------------------------------------------------------------
const sum = (list, id) => list.reduce((n, a) => n + a.rewards.filter((r) => r.id === id).reduce((m, r) => m + r.count, 0), 0);
const totals = (list) => ({ n: list.length, gems: sum(list, 'gems'), tickets: sum(list, 'ticket_recruit'), sturdy: sum(list, 'gearbox_rare'), ornate: sum(list, 'gearbox_superRare'), radiant: sum(list, 'gearbox_mythic'), celestial: sum(list, 'gearbox_legendary'), ribbons: list.filter((a) => a.honor).length, titles: list.filter((a) => a.title).length });
const group = (key) => Object.fromEntries(Object.entries(CATALOG.reduce((o, a) => ((o[a[key]] ||= []).push(a), o), {})).map(([k, v]) => [k, totals(v)]));
const launch = CATALOG.filter((a) => ['LIVE', 'NEW', 'TA'].includes(a.avail));
const BOXVAL = { gearbox_rare: 58, gearbox_superRare: 180, gearbox_mythic: 576, gearbox_legendary: 1440 };
const boxValue = (list) => list.reduce((n, a) => n + a.rewards.filter(isBox).reduce((m, r) => m + BOXVAL[r.id] * r.count, 0), 0);
const recruits = (t) => +(t.gems / 120 + t.tickets).toFixed(1);
const out = {
  problems,
  counts: { shipped: ACHIEVEMENTS.length, new: CATALOG.length, launchNew: launch.length, totalAfterAll: ACHIEVEMENTS.length + CATALOG.length },
  launch: { ...totals(launch), recruits: recruits(totals(launch)), boxGemEq: boxValue(launch) },
  all: { ...totals(CATALOG), recruits: recruits(totals(CATALOG)), boxGemEq: boxValue(CATALOG) },
  byAvail: group('avail'), byCat: group('cat'), byTier: group('tier'),
  honors: { total: honors.length, byCls: honors.reduce((o, h) => ((o[h.cls] = (o[h.cls] || 0) + 1), o), {}), byAvail: honors.reduce((o, h) => ((o[h.avail] = (o[h.avail] || 0) + 1), o), {}), onShipped: honors.filter((h) => EXISTING[h.id]).length, list: honors.sort((u, v) => u.no - v.no).map((h) => `${String(h.no).padStart(2, '0')} ${h.name} [${h.cls}${h.fx ? `:${h.fx}` : ''}] ${h.id} (${h.avail})`) },
  titles: { total: titles.length, byTier: titles.reduce((o, t) => ((o[t.tier] = (o[t.tier] || 0) + 1), o), {}), byAvail: titles.reduce((o, t) => ((o[t.avail] = (o[t.avail] || 0) + 1), o), {}), onShipped: titles.filter((t) => EXISTING[t.id]).length },
  journey: {}, retro: {},
};

// ---- 3. pacing and 4. update day ---------------------------------------------------------------
let prev = new Set();
for (const key of ['hour1', 'early', 'mid', 'late']) {
  const j = evaluate(key, 'journey');
  const all = [...j.existing.map((a) => a.id), ...j.metNew.map((a) => a.id)];
  const gated = key === 'hour1' ? j.metNew.filter((a) => a.rewards.some((r) => isBox(r) || r.id.startsWith('crown_'))).map((a) => a.id) : [];
  out.journey[key] = { label: ARCH[key].label, existingMet: j.existing.length, newMet: j.metNew.length, newSinceLast: all.filter((id) => !prev.has(id)), gatedUntil21: gated };
  prev = new Set(all);
}
out.longTerm = launch.filter((a) => !prev.has(a.id)).map((a) => a.id);
const PER_DAY = 243;
for (const key of ['early', 'mid', 'late']) {
  const r = evaluate(key, 'retro');
  const items = {};
  for (const a of r.metNew) for (const rw of a.rewards) items[rw.id] = (items[rw.id] || 0) + rw.count;
  const ribbons = r.metNew.filter((a) => a.honor).length + r.existing.filter((a) => EXISTING[a.id]?.honor).length;
  const ttl = r.metNew.filter((a) => a.title).length + r.existing.filter((a) => EXISTING[a.id]?.title).length;
  out.retro[key] = { label: ARCH[key].label, existingMet: r.existing.length, newMet: r.metNew.length, gems: items.gems || 0, daysOfIncome: +((items.gems || 0) / PER_DAY).toFixed(1), tickets: items.ticket_recruit || 0,
    boxes: { sturdy: items.gearbox_rare || 0, ornate: items.gearbox_superRare || 0, radiant: items.gearbox_mythic || 0, celestial: items.gearbox_legendary || 0 }, boxGemEq: boxValue(r.metNew), items, ribbonsLit: ribbons, titlesUnlocked: ttl, ids: r.metNew.map((a) => a.id) };
}
// ---- 5. shipped data vs the catalogue -------------------------------------------------------------
const WAVE = { LIVE: 'launch', NEW: 'launch', TA: 'launch', SO: 'social', CX: 'codex', LATER: 'later' };
const GAME_MAP = Object.fromEntries(GAME_ROWS.map((a) => [a.id, a]));
const same = (x, y) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
const shipped = { rowsInGame: 0, missing: [], differs: [] };
if (GAME_ROWS.length > ACHIEVEMENTS.length) {
  for (const a of CATALOG) {
    const g = GAME_MAP[a.id];
    if (!g) { shipped.missing.push(a.id); continue; }
    shipped.rowsInGame += 1;
    const want = { name: a.name, desc: a.desc, cat: a.cat, metric: a.metric, param: a.param ?? null, goal: a.goal, tier: a.tier, rewards: a.rewards, wave: WAVE[a.avail], series: a.series ?? null, honor: a.honor ?? null, title: a.title ?? null, hidden: !!a.hidden, hint: a.hint ?? null };
    const have = { name: g.name, desc: g.desc, cat: g.cat, metric: g.metric, param: g.param ?? null, goal: g.goal, tier: g.tier, rewards: g.rewards, wave: g.wave, series: g.series ?? null, honor: g.honor ?? null, title: g.title ?? null, hidden: !!g.hidden, hint: g.hint ?? null };
    for (const k of Object.keys(want)) if (!same(want[k], have[k])) shipped.differs.push(`${a.id}.${k}`);
  }
  // the shipped 30: changes allowed by the spec only (cosmetics, the rename, the goal and metric fixes)
  for (const [id, e] of Object.entries(EXISTING)) {
    const g = GAME_MAP[id];
    if (!g) { shipped.missing.push(id); continue; }
    if (!same(e.honor ?? null, g.honor ?? null)) shipped.differs.push(`${id}.honor`);
    if (!same(e.title ?? null, g.title ?? null)) shipped.differs.push(`${id}.title`);
    if (e.rename && g.name !== e.rename) shipped.differs.push(`${id}.name`);
    if (e.goalFix && g.goal !== e.goalFix) shipped.differs.push(`${id}.goal`);
    if (e.metricFix && g.metric !== e.metricFix) shipped.differs.push(`${id}.metric`);
  }
  const gameNew = GAME_ROWS.filter((a) => CATALOG_IDS.has(a.id));
  const gameLaunch = gameNew.filter((a) => a.wave === 'launch');
  shipped.launch = totals(gameLaunch);
  shipped.all = totals(gameNew);
  shipped.totalsMatch = same(shipped.launch, totals(launch)) && same(shipped.all, totals(CATALOG));
  shipped.ok = !shipped.missing.length && !shipped.differs.length && shipped.totalsMatch;
}
out.shipped = shipped;
fs.writeFileSync(new URL('./out.json', import.meta.url), JSON.stringify(out, null, 1));
if (!process.argv.includes('--quiet')) console.log(JSON.stringify(out, null, 1));
else console.log(JSON.stringify({ problems, shipped: { ok: shipped.ok, rowsInGame: shipped.rowsInGame, missing: shipped.missing, differs: shipped.differs }, counts: out.counts, launch: out.launch, all: out.all, retro: Object.fromEntries(Object.entries(out.retro).map(([k, v]) => [k, { newMet: v.newMet, gems: v.gems, tickets: v.tickets, boxes: v.boxes, ribbons: v.ribbonsLit, titles: v.titlesUnlocked }])) }, null, 1));
if (problems.length || shipped.ok === false) process.exitCode = 1;
