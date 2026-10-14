// Upgrade-tree view model (pure, no DOM): 3 paths × 5 tiers with owned / next / later / blocked
// states, the crosspath cap per path, costs and Self / Allies / Enemies / Coins tags. Shared by
// the Unit Sheet (static mode) and the in-battle Upgrade Tree (live / ally / preview modes).
import { pathCap } from './battle/rules.js';
import { tierTags, shortEffect, tierIcon, pathSummary, tierNote, modsTags, ultTags, passiveTags } from './upgradeTags.js';

export const RULE_TEXT = 'Pick one path up to T5 and one other up to T2 — the third path locks.';

/** @typedef {'owned'|'next'|'later'|'blocked'} CellState */

/** Why a path is capped (null when it is open to T5). */
export function capReason(tiers, path, names) {
  const cap = pathCap(tiers, path);
  if (cap === 5) return null;
  const others = [0, 1, 2].filter((p) => p !== path);
  if (cap === 0) {
    const used = others.filter((p) => tiers[p] > 0).map((p) => names[p]);
    return `Locked — two paths in use (${used.join(' + ')}).`;
  }
  const high = others.find((p) => tiers[p] > 2);
  return `Capped at T2 — ${names[high]} is already T${tiers[high]}.`;
}

/**
 * @param {{ def: object, mode?: 'static'|'preview'|'live'|'ally', tiers?: number[],
 *   costOf?: ((tierDef: object) => number)|null, cash?: number|null, auraRange?: number,
 *   heroLevel?: number|null, passiveActive?: boolean|null, ownerName?: string|null,
 *   deployCost?: number|null }} o
 */
export function buildTreeModel({
  def, mode = 'static', tiers = [0, 0, 0], costOf = null, cash = null, auraRange = 0,
  heroLevel = null, passiveActive = null, ownerName = null, deployCost = null,
}) {
  const live = mode === 'live' || mode === 'ally';
  const t3 = [0, 1, 2].map((p) => (live ? tiers[p] || 0 : 0));
  const names = def.paths.map((p) => p.name);
  const costKind = mode === 'static' ? 'base' : mode === 'preview' ? 'stage' : mode === 'ally' ? 'owner' : 'live';
  const rows = def.paths.map((p, pi) => {
    const cap = live ? pathCap(t3, pi) : 5;
    const current = t3[pi];
    const reason = live ? capReason(t3, pi, names) : null;
    const cells = p.tiers.slice(0, 5).map((td, k) => {
      let state;
      if (!live) state = 'later';
      else if (k < current) state = 'owned';
      else if (k >= cap) state = 'blocked';
      else if (k === current) state = 'next';
      else state = 'later';
      const cost = costOf ? costOf(td) : td.cost;
      const afford = mode === 'live' && state === 'next' && cash != null ? cash >= cost : null;
      return {
        path: pi,
        tier: k + 1,
        name: td.name,
        desc: td.desc,
        mods: td.mods,
        capstone: k === 4,
        state,
        cost,
        costKind,
        afford,
        tags: tierTags(def, pi, k + 1, { current: live ? auraRange : 0 }),
        short: shortEffect(td.mods),
        icon: tierIcon(td.mods),
        note: tierNote(def, pi, k + 1),
        reason: state === 'blocked' ? reason : null,
      };
    });
    return { index: pi, id: p.id, name: p.name, focus: p.focus || '', cap, current, reason, summary: pathSummary(def, pi), cells };
  });
  const hero = def.hero
    ? {
      level: heroLevel,
      levels: def.hero.levels.map((l) => ({ level: l.level, desc: l.desc, tags: modsTags(l.mods), reached: heroLevel != null ? l.level <= heroLevel : null })),
      ult: {
        name: def.hero.ult.name,
        desc: def.hero.ult.desc,
        tags: ultTags(def.hero.ult),
        unlockLevel: def.hero.ult.unlockLevel ?? 3,
        cooldown: def.hero.ult.cooldown ?? null,
        unlocked: heroLevel != null ? heroLevel >= (def.hero.ult.unlockLevel ?? 3) : null,
      },
    }
    : null;
  return {
    unitId: def.id,
    name: def.name,
    mode,
    tiers: t3,
    tiersLabel: t3.join('-'),
    rows,
    rule: RULE_TEXT,
    ownerName,
    deployCost,
    cash: mode === 'live' ? cash : null,
    hero,
    passive: def.awakenPassive
      ? { name: def.awakenPassive.name, desc: def.awakenPassive.desc, tags: passiveTags(def), active: passiveActive }
      : null,
  };
}

/** Cheap change detector for live polling: tiers, states, costs, affordability, hero level. */
export function treeSignature(model) {
  if (!model) return '';
  let s = `${model.unitId}|${model.mode}|${model.tiersLabel}|${model.hero?.level ?? ''}|${model.passive?.active ?? ''}|${model.deployCost ?? ''}`;
  for (const r of model.rows) {
    s += `|${r.cap}`;
    for (const c of r.cells) {
      const ally = c.tags.find((t) => t.id === 'allies');
      s += `${c.state[0]}${c.cost}${c.afford == null ? '' : c.afford ? '+' : '-'}${ally?.radius || ''}`;
    }
  }
  return s;
}
