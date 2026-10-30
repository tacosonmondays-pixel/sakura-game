// Next-wave scouting: compact strip of enemy chips (count, trait icons, "New!") in the HUD,
// plus a detail popover with names, trait explanations and the sim's pre-wave warnings.
// Co-op freeplay: the label reads "NEXT 16/15" in the tier's colours, and a pressure chip at the
// end of the strip sums up what the coming wave carries (HP ×, armor, speed, Resolve).
import { h, icon, traitBadge, enemyToken, enemyDef } from './util.js';
import { fmtNum } from '../format.js';
import { TRAITS } from '../../data/types.js';
import { freeplayHpRamp } from '../../sim/freeplay.js';
import { heroWarnText } from './heroLevels.js';
import { EXTENDED_TEXT } from '../text/tryout.js';

/** What each freeplay affix (src/data/freeplay.js) does, for the scout and the visitor toast. */
export const AFFIX_TEXT = {
  swift: ['Swift', 'they move 20 % faster'],
  regen: ['Regenerating', 'they heal 2 % a second when not hit for 2 s'],
  armored: ['Armored', '+3 armor'],
  shielded: ['Shielded', 'a barrier of 30 % of their HP'],
  fortified: ['Fortified', '+5 armor and a barrier'],
};

/** What each elite modifier (src/data/freeplay.js eliteMods) does: [name, explanation]. */
export const ELITE_MOD_TEXT = {
  ironclad: ['Ironclad', '+4 armor — armor pierce or shred'],
  bulwark: ['Bulwark', 'a barrier of 40 % of its HP — blast breaks barriers'],
  quickened: ['Quickened', 'moves 25 % faster — slow it'],
  vampiric: ['Vampiric', 'heals 1.5 % a second when not hit for 2 s — poison stops it'],
  unyielding: ['Unyielding', 'shrugs off stuns in half the time — more damage'],
};

/** How to hurt a boss, by its armor class (the type chart) or its elemental ward. */
export const BOSS_COUNTER = {
  spectral: 'Spectral: holy or mystic hits hard, others ×0.5',
  heavy: 'Heavy: blast or mystic',
  scaled: 'Scaled: pierce or mystic',
  warded: 'Warded: holy hits hard, mystic ×0.5',
  light: 'Light: slash or pierce',
  ward: 'Ward: off-element',
};

/** Armor in the UI: fractional pressure armor rounds to 0.1 ("+2.4"). */
export const fmtArmor = (a) => fmtNum(Math.max(0, a || 0), 'flat').replace(/^\+/, '');

/** Resolve at or below this many seconds turns the pressure chip orange. */
const RESOLVE_WARN = 4;

/** "Ironclad Orc Warlord" when the wave's group of this elite carries a modifier, else its name. */
export function eliteName(info, enemyId, name) {
  const m = info?.eliteMods?.find((x) => x.enemyId === enemyId);
  return m ? `${ELITE_MOD_TEXT[m.mod]?.[0] || m.mod} ${name}` : name;
}

/**
 * The boss telegraph of freeplay wave n: the first boss of wave n ("BOSS NEXT") or else of wave
 * n + 1 ("BOSS IN 2"), with its HP and its counter; null when neither is a boss wave. Pure reads.
 * @returns {null|{ inWaves: 1|2, wave: number, enemyId: string, name: string, hp: number,
 *   counter: string, small: boolean, kind: string }}
 */
export function freeplayBossTelegraph(sim, n) {
  if (!sim.freeplay) return null;
  for (const [w, inWaves] of [[n, 1], [n + 1, 2]]) {
    if (w <= sim.totalWaves || (!sim.endless && w > (sim.lastWave ?? Infinity))) continue;
    let info = null;
    try {
      info = sim.freeplayInfo?.(w) || null;
    } catch {
      info = null;
    }
    const b = info?.boss;
    if (!b?.bosses?.length) continue;
    const id = b.bosses[0];
    const def = sim.data?.enemy?.(id);
    if (!def) continue;
    const mul = info.bossHpMul?.[0] ?? 1;
    const hp = (def.hp || 0) * (sim.stage.hpScale ?? 1) * (sim.diff?.hpMul ?? 1) * mul;
    const counter = def.traits?.ward ? BOSS_COUNTER.ward : BOSS_COUNTER[def.armorClass] || '';
    return { inWaves, wave: w, enemyId: id, name: def.name || id, hp, counter, small: !!b.small, kind: b.kind };
  }
  return null;
}

/**
 * The pressure of freeplay wave n, for the chip and its explanation (null outside freeplay).
 * Pure UI reads: the wave's own freeplay info and the HP ramp function (never sim state).
 */
export function freeplayPressureInfo(sim, n) {
  let info = null;
  try {
    info = sim.freeplayInfo?.(n) || null;
  } catch {
    info = null;
  }
  if (!info) return null;
  const fp = sim.stage.freeplay;
  const p = info.pressure || {};
  return {
    tier: fp.id,
    tierName: fp.name,
    hp: freeplayHpRamp(sim.stage, n),
    armor: p.armor || 0,
    eliteArmor: info.eliteArmor || 0,
    eliteMods: info.eliteMods || [],
    speedPct: Math.round(((info.speed || 1) - 1) * 100),
    cc: p.cc,
    kb: p.kb,
    bossCc: p.bossCc,
    warn: p.cc != null && p.cc <= RESOLVE_WARN,
    affix: info.affix,
    boss: info.boss,
  };
}

/** "×2.5", "×353", "×3,004", "×2.2M": the one number style (a multiplier below 10, then a count) */
const fmtMul = (x) => (x < 10 ? fmtNum(x, 'mul') : `×${fmtNum(Math.round(x))}`);

/** The chip's form: the same as the explanation's ("×353", "×16k", "×2.2M"). */
export function fmtMulShort(x) {
  return fmtMul(x);
}

/** The plain-language explanation of a pressure (popover, tooltip). */
export function pressureText(pr) {
  const elite = pr.eliteArmor ? ` (elites +${fmtArmor(pr.eliteArmor)} more)` : '';
  return `Freeplay pressure (${pr.tierName}): enemies have ${fmtMul(pr.hp).slice(1)}× their base HP, +${fmtArmor(pr.armor)} armor${elite}, and move ${pr.speedPct} % faster. `
    + `Resolve: each enemy shrugs off stuns after ${pr.cc} s in total and knockback after ${pr.kb} tile${pr.kb === 1 ? '' : 's'} (bosses after ${pr.bossCc} s of stuns). `
    + 'Armor never stops more than 75 % of a hit here.';
}

/** "Boss in 2 waves: Grave Lych, 1.2M HP. Spectral: …" (the popover and the pill's tooltip). */
export function telegraphText(tg) {
  const when = tg.inWaves === 1 ? 'Boss next wave' : 'Boss in 2 waves';
  return `${when}: ${tg.name}, ${fmtNum(Math.round(tg.hp))} HP.${tg.counter ? ` ${tg.counter}.` : ''}`;
}

const MAX_CHIPS = 6;
const TIER_ORDER = { boss: 0, miniboss: 1, elite: 2, normal: 3 };

/** Sorts preview rows so bosses/elites/new enemies come first. */
function sortRows(rows, isNew) {
  return [...rows].sort((a, b) => (TIER_ORDER[a.tier] ?? 3) - (TIER_ORDER[b.tier] ?? 3)
    || Number(isNew(b.enemyId)) - Number(isNew(a.enemyId)) || b.count - a.count);
}

export function createScout(ctx) {
  const { sim } = ctx;
  const strip = h('button.bt-scout', { 'data-testid': 'scout', title: 'Next wave — tap for details', onclick: () => togglePopover() });
  let popover = null;
  const api = {
    el: strip,
    shownFor: -1,
    refresh,
    destroy() {
      popover?.remove();
      popover = null;
    },
    /** Rows of the next wave (for tests / other modules). */
    rows: [],
  };

  const isNew = (id) => !ctx.knownEnemies.has(id) && !sim.encountered.has(id);

  function nextWaveNumber() {
    return sim.wave + 1;
  }

  function hasNext() {
    return sim.endless || nextWaveNumber() <= (sim.lastWave ?? sim.totalWaves);
  }

  /** The pressure chip at the end of the strip (freeplay waves past the goal only). */
  function pressureChip(n) {
    const pr = freeplayPressureInfo(sim, n);
    if (!pr) return null;
    return h(`span.bt-chip.bt-pressure${pr.warn ? '.warn' : ''}`, { 'data-testid': 'scout-pressure', title: pressureText(pr) },
      h('span.bt-pr', icon('heart', 'bt-pr-ico'), fmtMulShort(pr.hp)),
      pr.armor ? h('span.bt-pr', icon('shield', 'bt-pr-ico'), `+${fmtArmor(pr.armor)}`) : null,
      pr.speedPct ? h('span.bt-pr', icon('ff', 'bt-pr-ico'), `+${pr.speedPct}%`) : null,
      h('span.bt-pr', icon('lock', 'bt-pr-ico'), `${pr.cc}s`));
  }

  function refresh() {
    api.shownFor = sim.wave;
    strip.replaceChildren();
    if (!hasNext()) {
      strip.classList.add('bt-scout-final');
      strip.append(h('span.bt-scout-label', 'FINAL WAVE'), h('span.bt-scout-final-text', sim.state === 'wave' ? 'Hold the line!' : ''));
      api.rows = [];
      return;
    }
    strip.classList.remove('bt-scout-final');
    const rows = sortRows(sim.nextWavePreview(), isNew);
    api.rows = rows;
    const n = nextWaveNumber();
    const boss = rows.some((r) => r.tier === 'boss' || r.tier === 'miniboss');
    strip.classList.toggle('bt-scout-boss', boss);
    // freeplay past the goal: "NEXT 16/15" in the tier's colours
    const over = sim.freeplay && n > sim.totalWaves;
    // (a Tryout Day Extended Day past its 48: the wave alone and "Stay Late", not a freeplay tier's "16/15", §20.8)
    const stayLate = !!over && !!sim.tryout;
    strip.classList.toggle('bt-scout-over', !!over && !stayLate);
    if (over && !stayLate) strip.dataset.tier = sim.stage.freeplay.id;
    else delete strip.dataset.tier;
    // map rule: "NEXT 4 ⇄" when the wave comes in through the goal gate (Rear Ambush)
    const flipped = !!ctx.modes?.flipped(n);
    strip.title = flipped ? 'Comes in through the goal gate' : 'Next wave — tap for details';
    strip.append(h('span.bt-scout-label', { 'data-testid': 'scout-label' }, h('small', 'NEXT'), ` ${n}`, stayLate ? h('small.bt-scout-late', ` · ${EXTENDED_TEXT.stayLate}`) : over ? h('span.bt-scout-goal', `/${sim.totalWaves}`) : null, flipped ? h('span.bt-scout-flip', ' ⇄') : null));
    // freeplay: the boss telegraph from two waves ahead
    const tg = over ? freeplayBossTelegraph(sim, n) : null;
    if (tg) {
      strip.append(h(`span.bt-chip.bt-tele${tg.inWaves === 1 ? '.now' : ''}`, { 'data-testid': 'scout-tele', title: telegraphText(tg) },
        enemyToken(tg.enemyId, { size: 22 }),
        h('b.bt-tele-when', tg.inWaves === 1 ? 'BOSS NEXT' : 'BOSS IN 2'),
        h('span.bt-tele-name', tg.name),
        h('span.bt-tele-hp', `${fmtNum(Math.round(tg.hp))} HP`)));
    }
    const info = over ? freeplayPressureInfo(sim, n) : null;
    const chips = h('span.bt-scout-chips');
    for (const r of rows.slice(0, MAX_CHIPS)) {
      const chip = h(
        `span.bt-chip.bt-chip-${r.tier}`,
        { title: `${eliteName(info, r.enemyId, enemyDef(r.enemyId)?.name || r.enemyId)} ×${r.count}` },
        enemyToken(r.enemyId, { size: 26 }),
        h('span.bt-chip-count', `×${r.count}`),
        r.traits.length ? h('span.bt-chip-traits', r.traits.slice(0, 2).map((t) => traitBadge(t, 'bt-chip-trait'))) : null,
        isNew(r.enemyId) ? h('span.bt-new', 'New!') : null,
      );
      chips.append(chip);
    }
    if (rows.length > MAX_CHIPS) chips.append(h('span.bt-chip.bt-chip-more', `+${rows.length - MAX_CHIPS}`));
    strip.append(chips);
    const pc = over ? pressureChip(n) : null;
    if (pc) strip.append(pc);
    const ac = ctx.modes?.scoutChip(n);
    if (ac) strip.append(ac);
    if (popover) renderPopover();
  }

  function togglePopover(force) {
    const open = force ?? !popover;
    if (!open) {
      popover?.remove();
      popover = null;
      return;
    }
    popover = h('div.bt-scout-pop', { 'data-testid': 'scout-pop' });
    ctx.layer.append(popover);
    renderPopover();
  }

  function renderPopover() {
    if (!popover) return;
    const n = nextWaveNumber();
    const rows = hasNext() ? sortRows(sim.nextWavePreview(), isNew) : [];
    let warnings = [];
    try {
      warnings = hasNext() ? [...sim.waveWarnings(n), ...(ctx.modes?.warnings(n) || [])] : [];
    } catch (e) {
      console.warn('[battle] waveWarnings failed', e);
    }
    const pr = hasNext() && sim.freeplay && n > sim.totalWaves ? freeplayPressureInfo(sim, n) : null;
    const tg = pr ? freeplayBossTelegraph(sim, n) : null;
    popover.replaceChildren(...[
      h('div.bt-pop-head', h('span.bt-pop-title', hasNext() ? `Scouting · Wave ${n}${pr && !sim.tryout ? `/${sim.totalWaves}` : ''}` : 'Final wave'), h('button.bt-x', { onclick: () => togglePopover(false), title: 'Close' }, '×')),
      tg ? h('div.bt-tele-pop', { 'data-testid': 'scout-tele-text' }, telegraphText(tg)) : null,
      pr ? h(`div.bt-pr-pop${pr.warn ? '.warn' : ''}`, { 'data-testid': 'scout-pressure-text' }, pressureText(pr), pr.affix ? h('b', ` ${AFFIX_TEXT[pr.affix]?.[0] || pr.affix}: ${AFFIX_TEXT[pr.affix]?.[1] || ''}.`) : null) : null,
      warnings.length
        ? h('div.bt-warns', warnings.map((w) => h(`div.bt-warn.bt-warn-${w.severity || 'info'}`, heroWarnText(sim, w.text))))
        : null,
      rows.length
        ? h('div.bt-scout-list', rows.map((r) => {
          const def = enemyDef(r.enemyId);
          const mod = pr?.eliteMods.find((x) => x.enemyId === r.enemyId);
          return h(
            `div.bt-scout-row.bt-chip-${r.tier}`,
            enemyToken(r.enemyId, { size: 34 }),
            h(
              'div.bt-scout-info',
              h('div.bt-scout-name', eliteName(pr, r.enemyId, def?.name || r.enemyId), ' ', h('b', `×${r.count}`), isNew(r.enemyId) ? h('span.bt-new', 'New!') : null,
                r.tier !== 'normal' ? h(`span.bt-tier.bt-tier-${r.tier}`, r.tier === 'miniboss' ? 'Miniboss' : r.tier === 'boss' ? 'Boss' : 'Elite') : null),
              mod ? h('div.bt-scout-mod', h('b', ELITE_MOD_TEXT[mod.mod]?.[0] || mod.mod), ` — ${ELITE_MOD_TEXT[mod.mod]?.[1] || ''}`) : null,
              r.traits.length
                ? h('div.bt-scout-traits', r.traits.map((t) => h('span.bt-trait-line', traitBadge(t, 'bt-trait-sm'), h('b', TRAITS[t]?.name || t), ' — ', TRAITS[t]?.desc || '')))
                : h('div.bt-scout-traits.muted', 'No special rule — plain fodder.'),
              def?.counters ? h('div.bt-scout-tip', def.counters) : null,
            ),
          );
        }))
        : h('p.muted', hasNext() ? 'Nothing scouted.' : 'This is the last wave — no more enemies after it.'),
    ].filter(Boolean));
  }

  refresh();
  return api;
}
