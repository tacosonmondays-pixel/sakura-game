// Hero rework, battle side (docs/specs/HERO_REWORK.md §2, §10): the hero levels 1–25 inside the
// battle. This module holds what the controller needs for it, so controller.js only wires it in:
//   - actions: buy a level (sends the level and price the player SAW, so a delayed tap can only be
//     refused 'stale', never charge more) and move her (solo: direct; co-op: hlv / hmv commands);
//   - the feed for hero events, attributed by towerUid (co-op: your hero gets the toast / banner,
//     the ally's hero a small chip at most every 3 s);
//   - the level texts the widget, panel and scout share.
import { fmtCoins } from './util.js';
import { quantize } from '../../online/coop/commands.js';
import { BATTLE } from '../../data/types.js';
import { HERO_LEVEL_PRICES } from '../../data/heroTracks.js';
import { abilityText, abilityUnlockLine, abilityUpgradeLine, abilityValues } from '../../data/abilityText.js';
import { skillAtLevel } from '../../data/abilities.js';
import { boltText } from '../kit.js';

/** The widget and panel re-read the price at most this often (seconds): passive XP moves it every frame. */
export const PRICE_TICK = 0.5;
const ALLY_CHIP_MS = 3000;

/** Track row for a level: { level, from, desc, mods } or null. */
export function trackLevel(def, level) {
  return def?.hero?.levels?.find((l) => l.level === level) || null;
}

/** What her Lv 7 skill does at a level (UI only): { kind: 'unlock' | 'rank', skill } or null. */
export function skillAt(def, level) {
  const s = def?.hero?.skill;
  if (!s) return null;
  if (level === (s.unlockLevel ?? 7)) return { kind: 'unlock', skill: s };
  return (s.ranks || []).some((r) => r.level === level) ? { kind: 'rank', skill: s } : null;
}

/**
 * A track level's words with her skill added (ABILITIES_SPEC §5.1 heroes; UI only, no ModSet): "Wider Sweep: +1 target
 * per sweep, +0.2 range … and unlocks ⚡ Morning Rally" at Lv 7, "… and ⚡ Morning Rally ranks up" at Lv 17.
 */
export function trackDesc(def, level) {
  const row = trackLevel(def, level);
  if (!row) return '';
  const k = skillAt(def, level);
  if (!k) return row.desc;
  const name = abilityText(k.skill.id)?.name || k.skill.id;
  const base = row.desc.replace(/[.\s]+$/, '');
  return k.kind === 'unlock' ? `${base} … and unlocks ⚡ ${name}` : `${base} … and ⚡ ${name} ranks up`;
}

/** The skill's long line for the full track (Details): the unlock sentence, or the rank's numbers. */
export function trackSkillLine(def, level) {
  const k = skillAt(def, level);
  if (!k) return '';
  if (k.kind === 'unlock') return abilityUnlockLine(k.skill.id);
  try {
    return abilityUpgradeLine(k.skill.id, abilityValues(skillAtLevel(k.skill, level), def.base || null));
  } catch {
    return '';
  }
}

/** "Radiant Edge T3" / "old Lv 5" for a level's `from` (the panel's small source line). */
export function sourceText(def, from) {
  if (!from || from === 'base') return 'From the start';
  if (/^L\d+$/.test(from)) return `Was the Lv ${from.slice(1)} milestone`;
  const [key, tier] = from.split('.');
  const name = PATH_NAMES[def?.id]?.[key] || key;
  return `Was ${name} T${tier}`;
}

/** The old path names (the tracks keep their tier names; the paths themselves are gone). */
const PATH_NAMES = {
  hikari: { radiant: 'Radiant Edge', sanctuary: 'Sanctuary', lightbringer: 'Lightbringer' },
  luna: { lances: 'Lunar Lances', gravity: 'Night Gravity', court: 'Astral Court' },
  nami: { frostbrand: 'Frostbrand', undertow: 'Undertow', harbor: 'Harbor Watch' },
};

/** Ult rank reached at exactly this level (2 or 3), else 0. */
export function rankAt(def, level) {
  const ranks = def?.hero?.ult?.ranks || [];
  const i = ranks.findIndex((r) => r.level === level);
  return i >= 0 ? i + 2 : 0;
}

/** A tier-5 level (its `from` ends in .5) gets the big banner. */
export function isCapstone(def, level) {
  return /\.5$/.test(trackLevel(def, level)?.from || '');
}

/** Coins to buy every level from her current one up to `target` (current level's share included). */
export function priceToLevel(sim, hero, target) {
  const st = sim.heroLevelStatus();
  if (!hero || st.reason === 'noHero' || hero.level >= target) return 0;
  let total = st.price;
  const prices = hero.def.hero.levelPrices || HERO_LEVEL_PRICES;
  const mul = (sim.diff.costMul ?? 1) * (hero.unitStats?.costMul ?? 1);
  for (let l = hero.level + 1; l < target && l < BATTLE.maxHeroLevel; l++) total += Math.ceil((prices[l - 1] * mul) / 5) * 5;
  return total;
}

/**
 * @param {object} ctx battle context (sim, feed, coop?)
 * @param {object|null} ls co-op Lockstep (null in solo)
 */
export function createHeroLevels(ctx, ls) {
  const { sim } = ctx;
  let allyChipAt = -Infinity;
  let lastLevelToast = { uid: -1, frame: -1 };
  let frame = 0;

  /** Is this hero tower the local player's own? */
  const mine = (t) => !!t && (!ctx.coop || ctx.coop.isMine(t.uid));

  /**
   * Buys her next level at the price the button shows (`shown` = the status the button painted).
   * @returns {boolean} sent / bought
   */
  function levelUp(shown = null) {
    if (ctx.ended) return false;
    const st = shown || sim.heroLevelStatus();
    if (st.reason === 'noHero' || st.reason === 'max' || st.reason === 'ended') return false;
    const cur = sim.heroLevelStatus();
    if (cur.reason === 'cash' || sim.cash < st.price) {
      ctx.feed.push(`Need ${fmtCoins(Math.max(5, st.price - sim.cash))} more coins.`, 'warn', { key: 'lvl-cash', ms: 1500 });
      ctx.bump?.('cash');
      return false;
    }
    const want = { level: st.level + 1, maxPrice: st.price };
    if (ls) {
      if (ls.job) return false;
      ls.queue('hlv', [want.level, want.maxPrice]);
      return true;
    }
    const r = sim.buyHeroLevel(want);
    if (!r.ok) explain(r.reason, cur);
    else ctx.saver?.markProgress(); // a solo command like any other: the battle save keeps it
    return r.ok;
  }

  function explain(reason, st) {
    if (reason === 'stale') ctx.feed.push(`She levelled up first — tap again for Lv ${(st?.level ?? sim.hero?.level ?? 1) + 1}.`, 'info', { key: 'lvl-stale', ms: 1600 });
    else if (reason === 'cash') ctx.feed.push('Not enough coins for that level any more.', 'warn', { key: 'lvl-cash', ms: 1500 });
  }

  /** Moves her to world (x, y) (the Move mode's drop). @returns {boolean} */
  function move(x, y) {
    const chk = sim.canMoveHero(x, y);
    if (!chk.ok) return false;
    if (ls) {
      if (ls.job) return false;
      ls.queue('hmv', quantize(x, y));
      return true;
    }
    const ok = sim.moveHero(x, y).ok;
    if (ok) ctx.saver?.markProgress();
    return ok;
  }

  /** Move button state for her panel: { label, disabled, reason }. */
  function moveState(t) {
    if (!t || ctx.ended) return { label: 'Move', disabled: true };
    if (t.moveCd > 0) return { label: `Move · ${Math.ceil(t.moveCd)}s`, disabled: true, reason: 'cooldown' };
    if (sim.state === 'wave') return { label: 'Move · pauses 3s', disabled: false };
    return { label: 'Move', disabled: false };
  }

  /** A co-op command's result came back (mine only): stale / cooldown explain themselves. */
  function onApplied(cmd, res) {
    if (!ls || cmd.p !== ls.mySlot) return;
    if (cmd.k === 'hlv' && !res.ok) explain(res.reason, null);
    if (cmd.k === 'hmv' && !res.ok) {
      const h = sim.hero;
      if (res.reason === 'cooldown') ctx.feed.push(`Move recharging · ${Math.ceil(h?.moveCd || 0)}s`, 'warn', { key: 'move-cd', ms: 1400 });
      else ctx.feed.push('She could not move there any more.', 'warn', { key: 'move-late', ms: 1400 });
    }
  }

  function allyChip(text) {
    const now = performance.now();
    if (now - allyChipAt < ALLY_CHIP_MS) return;
    allyChipAt = now;
    ctx.feed.push(text, 'info', { key: 'ally-hero', ms: 1600 });
  }

  const allyName = (t) => (ctx.coop ? ctx.coop.ownerName(t.uid) : 'Your ally');

  /**
   * Hero events from the sim (resolved by towerUid, never sim.hero). Several level-ups in one frame
   * (a bought level, a big kill) show one toast for the highest level.
   * @param {object[]} events this frame's events
   */
  function handle(events) {
    frame++;
    let top = null;
    for (const ev of events) {
      if (ev.type === 'heroLevel') {
        const t = sim.getTower(ev.towerUid);
        if (!t) continue;
        if (!top || top.t !== t || ev.level > top.level) top = { t, level: ev.level, prev: top && top.t === t ? top.prev : ev.level - 1 };
      } else if (ev.type === 'heroMastery') {
        const t = sim.getTower(ev.towerUid);
        if (t && mine(t)) ctx.feed.push(`${t.def.name} Mastery +${Math.round(ev.bonus * 100)}% damage`, 'good', { key: 'mastery', ms: 1600 });
      } else if (ev.type === 'ult') {
        const t = sim.getTower(ev.towerUid);
        if (!t) continue;
        const rank = ev.rank > 1 ? ` · rank ${ev.rank}` : '';
        if (mine(t)) ctx.feed.announce(ev.name || 'Ultimate', `${t.def.name}${rank}`, 'good', 1500);
        else allyChip(`${allyName(t)}'s ${t.def.name}: ${ev.name || 'Ultimate'}!`);
      } else if (ev.type === 'heroBuy') {
        const t = sim.getTower(ev.towerUid);
        if (t && mine(t)) ctx.ui?.confirm?.();
      }
    }
    if (top) levelToast(top);
  }

  function levelToast({ t, level }) {
    if (lastLevelToast.uid === t.uid && lastLevelToast.frame === frame) return;
    lastLevelToast = { uid: t.uid, frame };
    const def = t.def;
    if (!mine(t)) {
      allyChip(`${allyName(t)}'s ${def.name} Lv ${level}`);
      return;
    }
    const row = trackLevel(def, level);
    const ult = def.hero?.ult;
    if (level >= BATTLE.maxHeroLevel) {
      ctx.feed.announce(`LV ${level}`, `${def.name} reached Lv ${level} — ${row?.desc.split(':')[0] || 'max level'}!`, 'good', 2400);
      return;
    }
    if (isCapstone(def, level)) ctx.feed.announce(`LV ${level} · ${(row?.desc.split(':')[0] || '').toUpperCase()}`, def.name, 'good', 2000);
    const rank = rankAt(def, level);
    if (rank) ctx.feed.announce(`${ult?.name || 'Ultimate'} rank ${rank}!`, `${def.name} Lv ${level}`, 'good', 1800);
    const text = row ? `${def.name} Lv ${level} · ${trackDesc(def, level)}` : `${def.name} reached Lv ${level}`;
    // (her skill's ⚡ is drawn as the kit bolt, never the colour emoji)
    ctx.feed.push(boltText(text), 'good', { key: `lvl-${t.uid}-${level}`, ms: 2600 });
  }

  return { levelUp, move, moveState, handle, onApplied, mine };
}

/**
 * Scout warnings name a hero source as "Hikari at Lv 9" (src/sim/report.js): for the player's own
 * hero this appends what buying up to that level costs now ("· Level up now 🪙 2,340").
 */
export function heroWarnText(sim, text) {
  const hero = sim.hero;
  if (!hero || typeof text !== 'string') return text;
  const name = hero.def.name;
  return text.replace(new RegExp(`${name} at Lv (\\d+)`), (m, lv) => {
    const price = priceToLevel(sim, hero, Number(lv));
    return price > 0 ? `${m} · Level up now 🪙 ${fmtCoins(price)}` : m;
  });
}
