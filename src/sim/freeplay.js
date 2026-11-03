// Freeplay waves (co-op rooms with Freeplay on): what comes after a campaign stage's last wave.
// Like waves.js a pure function of (stage, wave): independent of the battle seed, safe to call from
// UI previews outside withDetMath. Only + − × ÷, Math.floor/ceil/min/max, powInt and per-wave seeded
// rngs — never sim.rng, never the power operator or the Math power, exponential and logarithm
// functions (tests/sim/freeplay.test.js greps for them) — so V8, JavaScriptCore and SpiderMonkey
// build bit-identical waves. stage.freeplay is the tier's table (src/data/freeplay.js).
import { createRng, hashString } from '../core/rng.js';
import { powInt, groupSpacing, openLanes, laneFor, longestLane } from './waves.js';
import { WAVE_HP_RAMP, GROUP_OVERLAP, DEFAULT_SPACING, FREEPLAY_ARMOR_FLOOR } from './constants.js';

/**
 * HP multiplier of freeplay wave `wave` (excludes stage hpScale and difficulty): the goal wave's
 * in-stage ramp × Π growth(k) for k = goal+1 … wave, growth from the absolute-wave band table.
 */
export function freeplayHpRamp(stage, wave) {
  const fp = stage.freeplay;
  const G = stage.waves;
  let m = 1 + WAVE_HP_RAMP * (G - 1);
  const bands = fp.hpBands;
  for (let i = 0; i < bands.length; i++) {
    const a = Math.max(G + 1, bands[i][0]);
    const b = Math.min(wave, i + 1 < bands.length ? bands[i + 1][0] - 1 : wave);
    if (b >= a) m *= powInt(bands[i][1] / 1000, b - a + 1);
  }
  return Math.min(m, fp.hpMax);
}

/** Walk-speed multiplier of freeplay pool enemies. */
export function freeplaySpeed(stage, wave) {
  const s = stage.freeplay.speed;
  return Math.min(s.max, 1 + s.slope * Math.max(0, wave - stage.waves));
}

/**
 * Pressure every enemy entering during this wave carries: + flat armor (fractional: it grows a
 * little every wave instead of in +1 steps) and the Resolve budgets (whole numbers).
 */
export function freeplayPressure(stage, wave) {
  const fp = stage.freeplay;
  const d = Math.max(0, wave - stage.waves);
  const r = fp.resolve;
  const armor = Math.min(fp.armor.max, d / fp.armor.every);
  return {
    armor,                                              // normal and elite enemies
    bossArmor: armor * fp.armor.bossMul,                // minibosses, bosses, titans (0 = exempt)
    cc: Math.max(1, r.cc - Math.floor(d / r.ccEvery)),
    bossCc: r.bossCc,                                   // minibosses, bosses, titans: a fixed budget
    kb: Math.max(1, r.kb - Math.floor(d / r.kbEvery)),
  };
}

function sharesAt(fp, d) {
  for (const row of fp.shares) if (d <= row[0]) return row;
  return fp.shares[fp.shares.length - 1];
}

/**
 * The elite share the smoothing target uses: the shares table's elite column as a ramp (it reaches
 * the next row's share where a row ends) instead of steps, so a new row never makes a wave jump.
 */
function eliteShareRamp(fp, d) {
  const rows = fp.shares;
  const pts = [[0, rows[0][3]]];
  for (let i = 0; i + 1 < rows.length; i++) pts.push([rows[i][0], rows[i + 1][3]]);
  return lerpTable(pts, d);
}

/** Visiting chapters for a stage: nearest to the home chapter first (ties: lower first). */
function chapterOrder(stage) {
  const hc = stage.chapter ?? 1;
  return stage.freeplay.chapters.map((c) => c.chapter).filter((c) => c !== hc && inList(stage.freeplay, c))
    .sort((a, b) => Math.abs(a - hc) - Math.abs(b - hc) || a - b);
}

/**
 * Optional `chapterList` (Tryout Day's Extended Day, docs/specs/TRYOUT_DAY.md §20.2): visitors, elites and the prelude
 * come only from these chapters. No freeplay tier sets it, so their waves are untouched.
 */
const inList = (fp, c) => !fp.chapterList || fp.chapterList.includes(c);

/** Chapter cap of freeplay wave `wave`: visitors and the miniboss ladder open one chapter at a time. */
export function freeplayChapterCap(stage, wave) {
  const fp = stage.freeplay;
  const d = wave - stage.waves;
  const r = Math.floor((d - 1) / fp.rotateEvery);
  return Math.min(fp.chapters.length, (stage.chapter ?? 1) + 1 + Math.floor((r * fp.rotateEvery) / fp.chapterEvery));
}

/** First boss wave of a stage: the first multiple of 10 at least bossMinDepth past the goal. */
export function freeplayFirstBossWave(stage) {
  return Math.ceil((stage.waves + stage.freeplay.bossMinDepth) / 10) * 10;
}

/**
 * Boss-wave content (absolute wave numbers), or null. Ladder level L = wave + tier bossShift.
 * The tens: L < 100 one miniboss · 100–149 boss / two minibosses alternating · 150–159 both
 * bosses · 160–199 boss + miniboss · 200+ a titan (+ a boss from 260).
 * Boss waves every 10, every 5 once L ≥ fastFrom. The fives are smaller visitors (`small: true`,
 * HP from bossHpSmall): L < 100 the next miniboss on the ladder · 100–149 a miniboss ·
 * 150–199 the other boss or a titan, alternating · 200+ a boss.
 * Wave 200: the Ashwing Matriarch on every tier; after it every finale.every waves Matriarch + titan,
 * and from calamity.wave every calamity.every waves the Eclipse Wyrm + titan.
 * @returns {null|{ kind: 'miniboss'|'boss'|'titan'|'finale'|'calamity', bosses: string[], small?: true }}
 */
export function freeplayBosses(stage, wave) {
  const fp = stage.freeplay;
  const fin = fp.finale;
  const cal = fp.calamity;
  const first = freeplayFirstBossWave(stage);
  const n = Math.floor(wave / 10);
  const j = Math.max(0, n - first / 10);
  const salt = hashString(stage.id);
  const cap = freeplayChapterCap(stage, wave);
  const open = fp.minibosses.filter((m) => m[1] <= cap).map((m) => m[0]);
  const mini = (k) => open[k % open.length];
  const boss = (k) => fp.bosses[(k + (salt & 1)) % fp.bosses.length];
  const titan = (k) => fp.titans[(k + (salt % 3)) % fp.titans.length];
  if (wave === fin.wave) return { kind: 'finale', bosses: [fin.enemy] };
  if (wave > fin.wave) {
    if (cal && wave >= cal.wave && (wave - cal.wave) % cal.every === 0) return { kind: 'calamity', bosses: [cal.enemy, titan(n)] };
    if ((wave - fin.wave) % fin.every === 0) return { kind: 'finale', bosses: [fin.enemy, titan(n)] };
  }
  if (fp.bossPlan) return planBosses(fp, wave, salt, cap);
  const L = wave + fp.bossShift;
  const period = L >= fp.fastFrom ? 5 : 10;
  if (wave % period !== 0 || wave < first) return null;
  if (wave % 10 !== 0) {
    if (L >= 200) return { kind: 'boss', bosses: [boss(n)], small: true };
    if (L >= 150) return n % 2 === 0 ? { kind: 'boss', bosses: [boss(n + 1)], small: true } : { kind: 'titan', bosses: [titan(n)], small: true };
    return { kind: 'miniboss', bosses: [mini(L >= 100 ? j + 1 : j + 2)], small: true };
  }
  if (L < 100) return { kind: 'miniboss', bosses: [mini(j)] };
  if (L < 150) return n % 2 === 0 ? { kind: 'boss', bosses: [boss(n >> 1)] } : { kind: 'miniboss', bosses: [mini(j), mini(j + 1)] };
  if (L < 160) return { kind: 'boss', bosses: [...fp.bosses] };
  if (L < 200) return { kind: 'boss', bosses: [boss(n), mini(j)] };
  if (L < 260) return { kind: 'titan', bosses: [titan(n)] };
  return { kind: 'titan', bosses: [titan(n), boss(n)] };
}

/**
 * Optional `bossPlan` (Extended Day, §20.2) in place of the tens and fives ladder: from wave `from`, every `miniEvery`
 * waves a miniboss (freeplay's open minibosses, only the plan's), every `bossEvery` waves a boss: the plan's own bosses
 * for the first `windowBosses` boss waves, then those with the freeplay bosses and titans (seeded by the stage id).
 * Marked `plan: true`, so a boss ranks as a boss or titan by the pool it came from (never a finale's HP or leak).
 */
function planBosses(fp, wave, salt, cap) {
  const bp = fp.bossPlan;
  const d = wave - bp.from + 1;
  if (d < 1 || d % bp.miniEvery !== 0) return null;
  if (d % bp.bossEvery === 0) {
    const k = d / bp.bossEvery - 1;
    const pool = k < bp.windowBosses ? bp.bosses : [...new Set([...bp.bosses, ...fp.bosses, ...fp.titans])];
    const id = pool[(k + (salt % pool.length)) % pool.length];
    return { kind: fp.titans.includes(id) ? 'titan' : 'boss', bosses: [id], plan: true };
  }
  const open = fp.minibosses.filter((m) => m[1] <= cap && bp.minibosses.includes(m[0])).map((m) => m[0]);
  const list = open.length ? open : [bp.minibosses[0]];
  return { kind: 'miniboss', bosses: [list[(d / bp.miniEvery) % list.length]], plan: true };
}

/** Piecewise-linear lookup in [[x, y], …] (flat before the first and after the last point). */
function lerpTable(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x < pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

/** The value of the last [from, value] row with from ≤ x (null below the first row). */
function stepTable(rows, x) {
  let v = null;
  for (const r of rows || []) if (x >= r[0]) v = r[1];
  return v;
}

/** Extra armor elites carry on freeplay wave `wave` (fractional, on top of the pressure armor). */
export function freeplayEliteArmor(stage, wave) {
  const b = stage.freeplay.eliteBand;
  if (!b) return 0;
  const d = Math.max(0, wave - stage.waves);
  return Math.min(b.max, Math.max(0, d - b.from) / b.every);
}

/** HP factor elites carry on freeplay wave `wave` (× the wave's ramp, by depth). */
export function freeplayEliteHp(stage, wave) {
  return stepTable(stage.freeplay.eliteHp, wave - stage.waves) ?? 1;
}

/**
 * The boss bands' share of the wave's ramp (1 before the first band): Π over waves k from the first band's wave to `wave`
 * of the boss growth ÷ the tier's growth at k (+ − × ÷ only, in wave order: the same bits on every engine).
 */
export function freeplayBossDamp(stage, wave) {
  const fp = stage.freeplay;
  const bb = fp.bossBands;
  if (!bb || !bb.length) return 1;
  let m = 1;
  for (let k = Math.max(stage.waves + 1, bb[0][0]); k <= wave; k++) m *= stepTable(bb, k) / stepTable(fp.hpBands, k);
  return m;
}

/**
 * HP factor (× the wave's ramp) of boss-wave enemy `id` of rank `rank`: the finale / calamity's own,
 * the fives' bossHpSmall band, the early tens' bossHpEarly, else bossHp by rank; × the boss bands' damp
 * (freeplayBossDamp) and, off a boss plan, its own bossHpOf factor.
 */
export function freeplayBossFactor(stage, wave, bossWave, rank, id = null) {
  const fp = stage.freeplay;
  const own = (!bossWave?.plan && id && fp.bossHpOf?.[id]) || 1;
  return bossRankFactor(fp, wave, bossWave, rank) * freeplayBossDamp(stage, wave) * own;
}

function bossRankFactor(fp, wave, bossWave, rank) {
  if (rank === 'finale') return fp.finale.hp;
  if (rank === 'calamity') return fp.calamity.hp;
  const L = wave + fp.bossShift;
  if (bossWave?.small) {
    const band = stepTable(fp.bossHpSmall, L);
    if (band && band[rank] != null) return band[rank];
  } else if (fp.bossHpEarly && L < fp.bossHpEarly.until && fp.bossHpEarly[rank] != null) {
    return fp.bossHpEarly[rank];
  }
  return fp.bossHp[rank] ?? 1;
}

/**
 * The modifier an elite group rolls (or null): from depth eliteMods.from, eliteMods.chance per
 * group, from its own rng (`stage|fp-elite|wave|slot`) so the wave's own picks never move. A
 * modifier the enemy (or the rotation's affix) already has is skipped.
 */
function eliteModFor(stage, wave, slot, def, affix) {
  const em = stage.freeplay.eliteMods;
  if (!em || wave - stage.waves < em.from) return null;
  const rng = createRng(hashString(`${stage.id}|fp-elite|${wave}|${slot}`));
  if (rng.next() >= em.chance) return null;
  const open = em.list.filter((m) => !(m.barrierPct && def.traits?.barrier) && !(m.regen && (def.traits?.regen || affix?.traits?.regen)));
  return open.length ? open[Math.floor(rng.next() * open.length)] : null;
}

/** What freeplay wave `wave` is made of (shared by the generator, the scout and the banners). */
export function freeplayInfo(stage, wave) {
  const fp = stage.freeplay;
  const G = stage.waves;
  const d = wave - G;
  const r = Math.floor((d - 1) / fp.rotateEvery);
  const cap = freeplayChapterCap(stage, wave);
  const order = chapterOrder(stage).filter((c) => c <= cap);
  let visitors;
  const fin = fp.finale.wave;
  if (wave >= fin - fp.prelude && wave <= fin) visitors = [fp.chapterList ? Math.max(...fp.chapterList) : fp.chapters.length];
  else {
    visitors = order.length ? [order[r % order.length]] : [];
    if (d > 60 && order.length > 1) {
      const second = order[(r + 3) % order.length];
      if (second !== visitors[0]) visitors.push(second);
    }
  }
  // One affix per rotation, chosen from the affixes open at the rotation's first wave, so it holds
  // for the whole rotation (the visitor toast names it).
  let affix = null;
  const d0 = r * fp.rotateEvery + 1;
  if (d0 >= fp.affixFrom) {
    const open = fp.affixes.filter((a) => d0 >= a.from);
    const rng = createRng(hashString(`${stage.id}|fp-affix|${r}`));
    if (open.length && rng.next() < 0.75) affix = open[Math.floor(rng.next() * open.length)];
  }
  const [, home, visit, elite] = sharesAt(fp, d);
  return {
    depth: d, rotation: r, chapterCap: cap, visitors, affix, shares: [home, visit, elite],
    boss: freeplayBosses(stage, wave), pressure: freeplayPressure(stage, wave), speed: freeplaySpeed(stage, wave),
  };
}

function homePool(stage, lookupEnemy) {
  const G = stage.waves;
  const all = (stage.waveGen?.pool || []).filter((p) => p && lookupEnemy(p.enemy));
  let pool = all.filter((p) => (p.from ?? 1) <= G && G <= (p.to ?? Infinity));
  if (!pool.length && all.length) pool = all;
  return pool.map((p) => ({ enemy: p.enemy, w: p.weight ?? 1 }));
}

/** Rank of a boss-pool id: 'titan' | 'finale' | 'calamity' | the def's tier. */
function rankOf(fp, id, def) {
  if (fp.titans.includes(id)) return 'titan';
  if (id === fp.finale.enemy) return 'finale';
  if (fp.calamity && id === fp.calamity.enemy) return 'calamity';
  return def.tier || 'boss';
}

/**
 * Builds freeplay wave `wave` (> stage.waves). Same WaveData shape as generateWave; every spawn
 * carries its own hpMul (relative, like WaveData.hpMul) and may carry speedMul, leak and mods (affix).
 * No cap on counts (owner, Oct 14): the threat budget grows linearly with depth forever.
 */
export function generateFreeplayWave(stage, wave, lookupEnemy, { pathCount = 1, pathLengths = null } = {}) {
  const fp = stage.freeplay;
  const G = stage.waves;
  const d = wave - G;
  const rng = createRng(hashString(`${stage.id}|freeplay|${wave}`));
  const gen = stage.waveGen || {};
  // the stage's lane schedule runs on in freeplay (waves.js openLanes; null = every lane open)
  const lanes = openLanes(stage, wave, pathCount);
  const start = gen.budget?.start ?? 10;
  const growth = gen.budget?.growth ?? 1.1;
  const budget = start * powInt(growth, G - 1) * (1 + fp.countSlope * d);
  const ramp = freeplayHpRamp(stage, wave);
  const info = freeplayInfo(stage, wave);
  const speed = info.speed;
  const bossWave = info.boss;
  const big = bossWave && (bossWave.kind === 'finale' || bossWave.kind === 'calamity');
  // a boss wave's regular groups keep a share of the budget by what rides with them
  const bw = fp.bossWaveBudget || { big: 0.5, boss: 0.75, titan: 0.75, miniboss: 0.75 };
  const regular = budget * (bossWave ? (big ? bw.big : bw[bossWave.kind] ?? bw.boss) : 1);
  const [homeShare, visitShare, eliteShare] = info.shares;
  const baseSpacing = (gen.spacing ?? DEFAULT_SPACING) * fp.spacingMul;
  const threatOf = (def) => Math.max(0.25, def.threat ?? 1);
  const chap = (c) => fp.chapters[c - 1];

  const home = homePool(stage, lookupEnemy);
  const slots = [];
  const nHome = homeShare >= 0.3 && home.length > 1 ? 2 : 1;
  for (let i = 0; i < nHome; i++) slots.push({ share: homeShare / nHome, cands: home });
  const vis = info.visitors;
  const perVisitor = vis.length === 1 && d > 30 ? 2 : 1;
  for (const c of vis) {
    const cands = chap(c).normals.filter((id) => lookupEnemy(id)).map((id) => ({ enemy: id, w: 2 }));
    for (let i = 0; i < perVisitor; i++) slots.push({ share: visitShare / (vis.length * perVisitor), cands });
  }
  const eliteCands = [];
  for (let c = 1; c <= info.chapterCap; c++) {
    if (!inList(fp, c)) continue;
    for (const id of chap(c).elites) if (lookupEnemy(id)) eliteCands.push({ enemy: id, w: vis.includes(c) ? 4 : 1 });
  }
  const nElite = d > 80 ? 2 : 1;
  for (let i = 0; i < nElite; i++) slots.push({ share: eliteShare / nElite, cands: eliteCands, elite: true });

  const groups = [];
  const used = new Set();
  let carry = 0;
  for (let si = 0; si < slots.length; si++) {
    const slot = slots[si];
    const gb = regular * slot.share * rng.range(0.85, 1.15) + carry;
    const cands = slot.cands.filter((c) => !used.has(c.enemy) && threatOf(lookupEnemy(c.enemy)) <= gb);
    if (!cands.length) {
      carry = gb;
      continue;
    }
    const pick = rng.weighted(cands, (c) => c.w);
    const def = lookupEnemy(pick.enemy);
    const count = Math.floor(gb / threatOf(def));
    carry = gb - count * threatOf(def);
    used.add(pick.enemy);
    const elite = def.tier === 'elite';
    const eliteMod = elite ? eliteModFor(stage, wave, si, def, info.affix) : null;
    groups.push({ enemyId: pick.enemy, def, count, spacing: groupSpacing(baseSpacing, def), start: 0, fixed: false, elite, eliteMod });
  }
  groups.sort((a, b) => (a.def.speed ?? 1) - (b.def.speed ?? 1) || (b.def.threat ?? 1) - (a.def.threat ?? 1));
  // Optional `spawnCap` (Extended Day, docs/specs/TRYOUT_DAY.md §20.2: its goal wave's budget is far past waves.js's
  // spawn cap): the regular groups' counts shrink to the cap and the excess becomes HP (capMul), as waves.js does, so the
  // wave keeps its total HP with a stage-like enemy count. No freeplay tier sets it.
  let capMul = 1;
  if (fp.spawnCap) {
    const total = groups.reduce((a, g) => a + g.count, 0);
    if (total > fp.spawnCap) {
      let kept = 0;
      for (const g of groups) {
        g.full = g.count;
        g.count = Math.max(1, Math.floor((g.count * fp.spawnCap) / total));
        kept += g.count;
      }
      capMul = total / kept;
    }
  }
  // Lay the groups out like waves.js: slow, tough groups lead; each next group starts once the
  // previous one is GROUP_OVERLAP through. `last` = when the last regular spawn enters.
  const layout = () => {
    let t = 0;
    let last = 0;
    for (const g of groups) {
      g.start = t;
      last = Math.max(last, g.start + (g.count - 1) * g.spacing);
      t += Math.max(g.spacing, (g.count - 1) * g.spacing * GROUP_OVERLAP + g.spacing);
    }
    return { t, last };
  };
  let { t, last } = layout();
  // No cap on counts: a bigger wave arrives denser instead of longer — every spacing (and so every
  // start) shrinks by the same factor until the last regular spawn enters by maxWindow seconds.
  if (last > fp.maxWindow) {
    const k = fp.maxWindow / last;
    for (const g of groups) g.spacing *= k;
    ({ t, last } = layout());
  }
  const regularEnd = t;
  const mods = info.affix ? { armor: info.affix.armor || 0, speed: info.affix.speed || 1, traits: info.affix.traits || null, barrierPct: info.affix.barrierPct || 0 } : null;
  // elites: the armor band on top of the pressure armor, and their modifier
  const eliteArmor = freeplayEliteArmor(stage, wave);
  const eliteHp = freeplayEliteHp(stage, wave);
  for (const g of groups) {
    g.mods = mods;
    if (!g.elite || (!eliteArmor && !g.eliteMod)) continue;
    const m = g.eliteMod || {};
    const em = {
      armor: (mods?.armor || 0) + eliteArmor + (m.armor || 0),
      speed: (mods?.speed || 1) * (m.speed || 1),
      traits: m.regen ? { ...(mods?.traits || {}), regen: m.regen } : mods?.traits || null,
      barrierPct: Math.max(mods?.barrierPct || 0, m.barrierPct || 0),
    };
    if (m.ccMul) em.ccMul = m.ccMul;
    if (m.id) em.eliteMod = m.id;
    g.mods = em;
  }
  // Ramp smoothing: the regular groups' effective HP (a refHit hit at refPen pen; barrier, affix,
  // pressure armor, elite band and HP all counted, armor taking at most 1 − FREEPLAY_ARMOR_FLOOR of
  // the hit as in combat) is scaled to the regular budget × refN (swarm) / refE (elite share, as a
  // ramp) × refMul(depth), so a wave's size follows the budget instead of the picks' HP-to-threat
  // ratio, the rotation's affix or the armor. Stronger elites shift HP from the swarm to the
  // elites; the total stays on the curve.
  let k = 1;
  const sm = fp.smooth;
  if (sm && groups.length) {
    const H = sm.refHit;
    const P = sm.refPen;
    const pa = info.pressure.armor;
    let actual = 0;
    for (const g of groups) {
      const tr = g.def.traits || {};
      const hp = (g.def.hp || 1) * (tr.barrier ? 1 : 1 + (g.mods?.barrierPct || 0)) + (tr.barrier?.hp || 0);
      const armor = (g.def.armor || 0) + (g.mods?.armor || 0) + pa;
      actual += ((g.full ?? g.count) * hp * H) / Math.max(1, H - Math.max(0, armor - P), H * FREEPLAY_ARMOR_FLOOR) * (g.elite ? eliteHp : 1);
    }
    const es = eliteShareRamp(fp, d);
    const target = regular * (sm.refN * (1 - es) + sm.refE * es) * lerpTable(sm.refMul, d);
    if (actual > 0) k = Math.min(sm.hi, Math.max(sm.lo, target / actual));
  }
  for (const g of groups) {
    g.hpMul = ramp * k * capMul * (g.elite ? eliteHp : 1);
    g.speedMul = speed;
  }

  const bossHpMul = [];
  if (bossWave) {
    // the longest open lane (the longest lane when every lane is open)
    const longest = pathLengths?.length > 1 ? longestLane(pathLengths, lanes) : null;
    let bt = 2 + regularEnd * 0.35;
    for (const id of bossWave.bosses) {
      const def = lookupEnemy(id);
      if (!def) continue;
      // (a boss-plan boss is a boss or a titan by its pool, never the finale's rank: §20.2)
      const rank = bossWave.plan ? (fp.titans.includes(id) ? 'titan' : def.tier === 'miniboss' ? 'miniboss' : 'boss') : rankOf(fp, id, def);
      const factor = freeplayBossFactor(stage, wave, bossWave, rank, id);
      bossHpMul.push(ramp * factor);
      const leak = fp.leak[rank] ?? null;
      groups.push({ enemyId: id, def, count: 1, spacing: 1, start: bt, fixed: true, path: longest, hpMul: ramp * factor, speedMul: 1, leak, rank });
      for (const [eid, n] of fp.escorts[id] || []) {
        const edef = lookupEnemy(eid);
        if (edef) groups.push({ enemyId: eid, def: edef, count: n, spacing: 1, start: bt + 3, fixed: true, path: null, hpMul: ramp, speedMul: speed });
      }
      bt += 8;
    }
  }

  const spawns = [];
  let counter = 0;
  groups.forEach((g, gi) => {
    for (let k = 0; k < g.count; k++) {
      const pathIndex = laneFor(g, gi + counter, pathCount, lanes, pathLengths);
      counter++;
      const s = { t: g.start + k * g.spacing, enemyId: g.enemyId, pathIndex, hpMul: g.hpMul, speedMul: g.speedMul };
      if (g.leak != null) s.leak = g.leak;
      if (g.mods) s.mods = g.mods;
      spawns.push(s);
    }
  });
  spawns.sort((a, b) => a.t - b.t);
  return {
    wave,
    spawns,
    groups: groups.map(({ enemyId, count, spacing, start, fixed }) => ({ enemyId, count, spacing, start, fixed })),
    hpMul: ramp,
    duration: spawns.length ? spawns[spawns.length - 1].t : 0,
    budget,
    ...(lanes ? { lanes } : {}),
    freeplay: {
      tier: fp.id, depth: d, rotation: info.rotation, chapterCap: info.chapterCap, visitors: vis,
      affix: info.affix?.id ?? null, boss: bossWave, speed, pressure: info.pressure,
      // each boss's HP multiplier (ramp × its factor; aligned with boss.bosses), the smoothing
      // factor of the regular groups, the elites' extra armor and their modifiers
      bossHpMul, k, eliteArmor,
      eliteMods: groups.filter((g) => g.eliteMod).map((g) => ({ enemyId: g.enemyId, mod: g.eliteMod.id })),
    },
  };
}
