// Next-wave scouting: compact strip of enemy chips (count, trait icons, "New!") in the HUD,
// plus a detail popover with names, trait explanations and the sim's pre-wave warnings.
import { h, traitBadge, enemyToken, enemyDef } from './util.js';
import { TRAITS } from '../../data/types.js';

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
    return sim.endless || nextWaveNumber() <= sim.totalWaves;
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
    strip.append(h('span.bt-scout-label', h('small', 'NEXT'), ` ${n}`));
    const chips = h('span.bt-scout-chips');
    for (const r of rows.slice(0, MAX_CHIPS)) {
      const chip = h(
        `span.bt-chip.bt-chip-${r.tier}`,
        { title: `${enemyDef(r.enemyId)?.name || r.enemyId} ×${r.count}` },
        enemyToken(r.enemyId, { size: 26 }),
        h('span.bt-chip-count', `×${r.count}`),
        r.traits.length ? h('span.bt-chip-traits', r.traits.slice(0, 2).map((t) => traitBadge(t, 'bt-chip-trait'))) : null,
        isNew(r.enemyId) ? h('span.bt-new', 'New!') : null,
      );
      chips.append(chip);
    }
    if (rows.length > MAX_CHIPS) chips.append(h('span.bt-chip.bt-chip-more', `+${rows.length - MAX_CHIPS}`));
    strip.append(chips);
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
      warnings = hasNext() ? sim.waveWarnings(n) : [];
    } catch (e) {
      console.warn('[battle] waveWarnings failed', e);
    }
    popover.replaceChildren(...[
      h('div.bt-pop-head', h('span.bt-pop-title', hasNext() ? `Scouting · Wave ${n}` : 'Final wave'), h('button.bt-x', { onclick: () => togglePopover(false), title: 'Close' }, '×')),
      warnings.length
        ? h('div.bt-warns', warnings.map((w) => h(`div.bt-warn.bt-warn-${w.severity || 'info'}`, w.text)))
        : null,
      rows.length
        ? h('div.bt-scout-list', rows.map((r) => {
          const def = enemyDef(r.enemyId);
          return h(
            `div.bt-scout-row.bt-chip-${r.tier}`,
            enemyToken(r.enemyId, { size: 34 }),
            h(
              'div.bt-scout-info',
              h('div.bt-scout-name', def?.name || r.enemyId, ' ', h('b', `×${r.count}`), isNew(r.enemyId) ? h('span.bt-new', 'New!') : null,
                r.tier !== 'normal' ? h(`span.bt-tier.bt-tier-${r.tier}`, r.tier === 'miniboss' ? 'Miniboss' : r.tier === 'boss' ? 'Boss' : 'Elite') : null),
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
