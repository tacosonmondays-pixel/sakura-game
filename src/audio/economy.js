// Economy & progression → sound (docs/AUDIO.md §1.6). Zero-touch: subscribes to store 'change'
// (every commit carries a reason) and turns the before/after difference into cues.

/** Small snapshot of the parts of a profile that make sounds when they change. */
export function snapshot(p) {
  if (!p) return null;
  let items = 0;
  for (const v of Object.values(p.items || {})) items += Number(v) || 0;
  let gearCount = 0;
  let gearLevels = 0;
  for (const g of Object.values(p.gear || {})) {
    gearCount++;
    gearLevels += Number(g?.level) || 0;
  }
  return {
    coins: Number(p.currencies?.coins) || 0,
    gems: Number(p.currencies?.gems) || 0,
    items,
    gearCount,
    gearLevels,
  };
}

const CLAIM_REASONS = new Set(['missions', 'achievements', 'login', 'redeem']);

/**
 * Pure: (prev snapshot, next snapshot, commit reason) → list of { sfx?, music?, delay } actions.
 * `music` actions are jingles (level-up / awaken) that duck menu music.
 */
export function economyCues(prev, next, reason) {
  const out = [];
  if (!next) return out;
  const p = prev || next;
  const up = {
    coins: next.coins > p.coins,
    gems: next.gems > p.gems,
    items: next.items > p.items || next.gearCount > p.gearCount,
  };
  // what went up, staggered 120 ms apart
  const gains = (start) => {
    const list = [];
    let d = start;
    for (const [k, sfx] of [['gems', 'eco.gems'], ['coins', 'eco.coins'], ['items', 'eco.item']]) {
      if (!up[k]) continue;
      list.push({ sfx, delay: d });
      d += 120;
    }
    return list;
  };
  switch (reason) {
    case 'level-up':
      out.push({ music: 'levelup', delay: 0 });
      break;
    case 'breakthrough':
      out.push({ sfx: 'eco.breakthrough', delay: 0 });
      break;
    case 'awaken':
      out.push({ music: 'awaken', delay: 0 });
      break;
    case 'gear-enhance': {
      const lv = Math.max(0, next.gearLevels - p.gearLevels);
      out.push({ sfx: 'gear.enhance', rate: 1 + Math.min(0.5, lv * 0.04), delay: 0 });
      break;
    }
    case 'gear-reroll':
      out.push({ sfx: 'gear.reroll', delay: 0 });
      break;
    case 'gear-equip':
      out.push({ sfx: 'gear.equip', delay: 0 });
      break;
    case 'gear-unequip':
      out.push({ sfx: 'gear.equip', rate: 0.85, delay: 0 });
      break;
    case 'gear-lock':
      out.push({ sfx: 'ui.toggle', delay: 0 });
      break;
    case 'shop':
      out.push({ sfx: 'eco.purchase', delay: 0 });
      if (up.items) out.push({ sfx: 'eco.item', delay: 180 });
      break;
    case 'sweep':
      out.push({ sfx: 'eco.sweep', delay: 0 }, ...gains(500).filter((g) => g.sfx !== 'eco.coins'));
      break;
    case 'gearbox-open':
      out.push({ sfx: 'eco.item', delay: 0 });
      break;
    case 'gear-salvage':
      out.push({ sfx: 'eco.coins', delay: 0 });
      break;
    case 'formation':
      out.push({ sfx: 'ui.slot', delay: 0 });
      break;
    case 'secretary':
      out.push({ sfx: 'ui.select', delay: 0 });
      break;
    default:
      if (CLAIM_REASONS.has(reason)) {
        out.push({ sfx: 'eco.claim', delay: 0 }, ...gains(160));
      }
      break;
  }
  return out;
}

/**
 * Subscribe to the store; `play(action)` receives each action at its delay.
 * @returns {() => void} unsubscribe
 */
export function installEconomy(store, play) {
  let prev = snapshot(store.profile);
  const off = store.on('change', (e) => {
    const next = snapshot(store.profile);
    const reason = e?.reason || 'change';
    const acts = reason === 'replace' || reason === 'app-start' ? [] : economyCues(prev, next, reason);
    prev = next;
    for (const a of acts) {
      if (a.delay) setTimeout(() => play(a), a.delay);
      else play(a);
    }
  });
  return off;
}
