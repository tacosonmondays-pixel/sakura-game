// Selected-girl panel: portrait, role, target mode, effective stats, 3 upgrade paths with
// tier pips / next tier / crosspath locks / buy buttons, sell, close. Heroes instead: level, XP
// bar, Level up, the next levels and the full 25-level track, the ultimate and its rank, and
// Move (heroes cannot be sold). Landscape: right-side card; portrait: bottom sheet. Girls with
// roaming drones (Chika) also get a split bar, a Flight row and tabs (chikaPanel.js).
import { h, icon, fmtCoins, fmtNum, setVar } from './util.js';
import { createDronePanel, hasDroneTabs } from './chikaPanel.js';
import { crosspathReason, pathCap } from './rules.js';
import { svgEl } from '../components.js';
import { portraitHTML } from '../../art/portraits.js';
import { roleIcon, attackTypeIcon, elementIcon, capabilityIcon, currencyIcon } from '../../art/icons.js';
import { ROLES, ATTACK_TYPES, ELEMENTS, TARGET_MODES, STATUSES } from '../../data/types.js';
import { isUR, rarityColor, urBadge, applyUrFrame } from '../rarity.js';
import { roundCost } from '../../sim/Sim.js';
import { tagChips, TREE_GLYPH } from '../tagChips.js'; // [unit-info] Self / Allies / Enemies chips + tree button
import { tierTags } from '../upgradeTags.js';
import { HERO_GROWTH } from '../../data/heroTracks.js';
import { PRICE_TICK, trackLevel, sourceText, rankAt } from './heroLevels.js';

const TARGETABLE = new Set(['projectile', 'beam', 'chain', 'duel', 'turret']);
const MODE_HELP = {
  first: 'Closest to the exit',
  last: 'Furthest from the exit',
  strong: 'Highest HP',
  close: 'Nearest to her',
  elite: 'Casters, siphoners, elites, bosses first',
};

function statusLabel(s) {
  const name = STATUSES[s.type]?.name || s.type;
  const parts = [];
  if (s.amount) parts.push(`${Math.round(s.amount * 100)}%`);
  if (s.dps) parts.push(`${fmtNum(s.dps, 1)}/s`);
  if (s.bonus) parts.push(`+${Math.round(s.bonus * 100)}%`);
  if (s.duration) parts.push(`${fmtNum(s.duration, 1)}s`);
  if (s.chance != null && s.chance < 1) parts.push(`${Math.round(s.chance * 100)}% chance`);
  return `${name}${parts.length ? ` (${parts.join(', ')})` : ''}`;
}

export function createTowerPanel(ctx) {
  const { sim } = ctx;
  const el = h('aside.bt-panel', { 'data-testid': 'tower-panel', role: 'dialog', 'aria-label': 'Selected girl' });
  el.hidden = true;
  ctx.layer.append(el);
  let uid = null;
  let sig = '';
  let live = null; // nodes updated every frame
  let sellArmed = 0;
  let sellTimer = 0;
  let trackOpen = false;
  let heroShown = null; // the level status the Level up button shows (a tap buys exactly this)
  const drones = createDronePanel(ctx, { rerender: () => { sig = ''; update(true); } });

  /** Hero part of the signature: level, the price bucket (≤ 2 repaints/s), the reason, the move state. */
  function heroSig(t) {
    if (!t.isHero) return '';
    const st = sim.heroLevelStatus();
    const own = sim.hero === t;
    const bucket = Math.floor(performance.now() / 1000 / PRICE_TICK);
    const mv = ctx.heroLevels?.moveState(t);
    return `|h${t.level}:${own ? `${bucket}:${st.reason}` : 'ally'}:${mv?.label}:${trackOpen ? 1 : 0}:${Math.round((t.mastery || 0) * 100)}`;
  }

  function signature(t) {
    const afford = [0, 1, 2].map((p) => {
      const st = sim.upgradeStatus(t.uid, p);
      return `${st.tier}${st.reason || 'ok'}${st.cost}`;
    }).join(',');
    const dv = t.turretSpec?.leash > 0 ? drones.signature(t) : '';
    return `${t.uid}|${t.tiers.join('')}|${t.targetMode}|${afford}|${t.level || 0}|${sim.state}|${sellArmed}|${t.ultUnlocked ? 1 : 0}|${t.turrets?.length || 0}|${dv}${heroSig(t)}`;
  }

  /** @param {{ drone?: number|null }} [opts] a drone of hers to show (tapped on the field) */
  function open(towerUid, opts = {}) {
    if (uid === towerUid && opts.drone != null && el.hidden === false) {
      drones.showDrone(opts.drone, drones.tab === 'drone' ? undefined : drones.tab);
      return;
    }
    uid = towerUid;
    drones.open(towerUid, opts);
    sig = '';
    sellArmed = 0;
    trackOpen = false;
    el.hidden = false;
    el.classList.remove('bt-panel-in');
    void el.offsetWidth;
    el.classList.add('bt-panel-in');
    update(true);
  }

  function close() {
    uid = null;
    drones.close();
    el.hidden = true;
    live = null;
    clearTimeout(sellTimer);
  }

  function render(t) {
    const st = sim.towerStats(t.uid);
    const def = t.def;
    const role = ROLES[def.role];
    const pathNames = def.paths.map((p) => p.name);
    // UR (display only) comes from YOUR save: your own girls show it; an ally's girl in co-op
    // shows her def rarity (their awakening is not sent over the network)
    const profile = !ctx.coop || ctx.coop.isMine(t.uid) ? ctx.profile : null;
    const ur = isUR(def, profile);
    const portrait = svgEl(portraitHTML(def, 'thumb', { eager: true }), 'bt-panel-portrait');
    setVar(portrait, '--rarity', rarityColor(def, profile));
    if (ur) applyUrFrame(portrait, def, profile);
    if (ctx.tree) Object.assign(portrait, { title: 'Upgrade tree', onclick: () => ctx.tree.open({ uid: t.uid }) }); // [unit-info]

    const kills = h('b');
    const dmg = h('b');
    live = { kills, dmg, xpFill: null, xpText: null, ult: null };

    // ---- header
    const head = h(
      'div.bt-panel-head',
      portrait,
      h(
        'div.bt-panel-id',
        h('div.bt-panel-name', def.name, ur ? urBadge() : null, h('span.bt-panel-tiers', t.isHero ? `Lv ${t.level}` : t.tiers.join('-'))),
        h('div.bt-panel-role', svgEl(roleIcon(def.role), 'bt-role-ico'), role?.name || def.role,
          h('span.bt-dot', '·'), svgEl(attackTypeIcon(st.attackType), 'bt-role-ico'), ATTACK_TYPES[st.attackType]?.name || st.attackType,
          st.element ? [h('span.bt-dot', '·'), svgEl(elementIcon(st.element), 'bt-role-ico'), ELEMENTS[st.element]?.name] : null),
        h('div.bt-panel-meta', h('span', 'Kills ', kills), h('span', 'Damage ', dmg)),
      ),
      ctx.tree ? h('button.bt-x.bt-panel-tree', { 'data-testid': 'panel-tree', title: 'Upgrade tree (T)', 'aria-label': 'Upgrade tree', onclick: () => ctx.tree.open({ uid: t.uid }) }, svgEl(TREE_GLYPH, 'bt-ico')) : null,
      h('button.bt-x.bt-panel-close', { 'data-testid': 'panel-close', title: 'Close', onclick: () => ctx.select(null) }, icon('close')),
    );

    // ---- hero block
    const heroBlock = t.isHero ? heroSection(t, st) : null;

    // ---- target mode
    let target = null;
    if (TARGETABLE.has(st.behavior)) {
      target = h(
        'div.bt-target',
        h('span.bt-section-label', icon('target', 'bt-ico-sm'), 'Target'),
        h('div.bt-seg', Object.entries(TARGET_MODES).map(([k, name]) => h(
          `button.bt-seg-btn${t.targetMode === k ? '.on' : ''}`,
          { 'data-mode': k, title: MODE_HELP[k], onclick: () => { (ctx.act ? ctx.act.target(t.uid, k) : sim.setTargetMode(t.uid, k)); sig = ''; update(true); } },
          name,
        ))),
      );
    }

    // ---- stats
    const rows = [];
    const keyed = {};
    const add = (label, value, cls = '', key = null) => {
      const c = h(`div.bt-stat-cell${cls}`, h('span', label), h('b', value));
      rows.push(c);
      if (key) keyed[key] = c;
    };
    // Roaming drones (Chika): her split bar and Overall / Chika / Drones tabs show her own DPS and
    // the wing's apart (chikaPanel.js), so the DPS row is hers. An anchored drone kit (none in the
    // roster today; the old turret behaviour) keeps the summed row: the wing plus her own, and her
    // "attack rate" is how fast she builds drones.
    const anchored = st.turret && !hasDroneTabs(st) && t.turretSpec ? { each: t.turretSpec.damage * t.turretSpec.rate, rate: t.turretSpec.rate } : null;
    const dps = st.dps + (anchored ? anchored.each * st.turret.max : 0);
    if (dps > 0) add('DPS', fmtNum(dps, 1), '.bt-stat-main', 'dps');
    if (st.behavior === 'turret') {
      if (st.rate > 0) add('New drone', `every ${fmtNum(1 / st.rate, 1)}s`);
    } else {
      if (st.damage > 0) add('Damage', fmtNum(st.damage, 1));
      if (st.rate > 0 && st.behavior !== 'none') add(st.behavior === 'trap' ? 'Traps/s' : 'Attacks/s', fmtNum(st.rate, 2));
    }
    if (st.range > 0) add('Range', fmtNum(st.range, 1));
    if (st.behavior === 'projectile' && st.projectiles > 1) add('Targets', st.projectiles);
    if (st.behavior === 'beam' && st.projectiles > 1) add('Beams', st.projectiles);
    if (st.pierce > 1) add('Pierce', st.pierce);
    if (st.behavior === 'pulse' && st.maxTargets < 99) add('Max hits', st.maxTargets);
    if (st.splash > 0) add('Splash', fmtNum(st.splash, 1));
    if (st.chain > 0) add('Jumps', st.chain);
    if (st.armorPen > 0) add('Armor pen', fmtNum(st.armorPen, 1));
    if (t.isHero && t.level > 1) {
      const g = Math.round((t.def.hero?.growth ?? HERO_GROWTH).damage * (t.level - 1) * 100);
      add('Level bonus', `+${g}% damage${t.mastery > 0 ? ` · Mastery +${Math.round(t.mastery * 100)}%` : ''}`, '.bt-stat-wide2');
    }
    if (t.isHero && (t.unitStats?.costMul ?? 1) < 1) add('Level prices', `−${Math.round((1 - t.unitStats.costMul) * 100)}%`, '.bt-stat-wide2');
    if (st.crit?.chance > 0) add('Crit', `${Math.round(st.crit.chance * 100)}% ×${fmtNum(st.crit.mul, 2)}`, '.bt-stat-wide2');
    if (st.eliteMul > 1) add('vs Elite', `×${fmtNum(st.eliteMul, 2)}`);
    if (st.bossMul > 1) add('vs Boss', `×${fmtNum(st.bossMul, 2)}`);
    if (st.barrierMul > 1) add('vs Barrier', `×${fmtNum(st.barrierMul, 2)}`);
    if (st.trap) add('Traps', `${st.trap.placed ?? 0}/${st.trap.max} · ${fmtNum(st.trap.damage, 0)} dmg`, '.bt-stat-wide2');
    if (st.turret) add('Drones', `${st.turret.active ?? 0}/${st.turret.max} · ${fmtNum(st.turret.damage, 0)} dmg × ${fmtNum(anchored?.rate ?? t.turretSpec?.rate ?? 0, 2)}/s each`, '.bt-stat-wide', 'turret');
    // gear Cost Reduction (and cost-cut auras) make her upgrades cheaper: say so, with the total
    const gearCut = 1 - (t.unitStats?.costMul ?? 1);
    const auraCut = Math.min(0.5, t.buff?.costCut || 0);
    const cut = 1 - (1 - gearCut) * (1 - auraCut);
    if (cut > 0.004) {
      const from = [gearCut > 0.004 ? `gear ${Math.round(gearCut * 100)}%` : null, auraCut > 0.004 ? `aura ${Math.round(auraCut * 100)}%` : null].filter(Boolean).join(' + ');
      add('Upgrades', `${Math.round(cut * 100)}% cheaper (${from})`, '.bt-stat-wide');
    }
    if (st.income) add('Income', `${fmtCoins(st.income.perWave || 0)}/wave${st.income.interest ? ` +${Math.round(st.income.interest * 100)}%` : ''}`, '.bt-stat-wide2');
    if (st.ramp) add('Ramp', `+${Math.round(st.ramp.per * 100)}%/hit (max ${Math.round(st.ramp.max * 100)}%)`, '.bt-stat-wide');
    if (st.mark) add('Mark', `+${Math.round(st.mark.bonus * 100)}% · ${fmtNum(st.mark.duration, 1)}s`, '.bt-stat-wide2');
    if (st.aura) {
      const a = st.aura;
      const bits = [];
      if (a.dmgMul > 1) bits.push(`+${Math.round((a.dmgMul - 1) * 100)}% dmg`);
      if (a.rateMul > 1) bits.push(`+${Math.round((a.rateMul - 1) * 100)}% speed`);
      if (a.rangeMul > 1) bits.push(`+${Math.round((a.rangeMul - 1) * 100)}% range`);
      if (a.costCut > 0) bits.push(`-${Math.round(a.costCut * 100)}% cost`);
      if (a.detection) bits.push('Veil Sight');
      if (a.cleanse) bits.push('Cleanse');
      add('Aura → allies', `${fmtNum(a.range, 1)} tiles${bits.length ? ` · ${bits.join(', ')}` : ''}`, '.bt-stat-wide', 'aura');
    }
    const chips = [];
    const cap = (key, label) => chips.push(h('span.bt-cap', svgEl(capabilityIcon(key), 'bt-cap-ico'), label));
    if (st.detection) cap('detection', 'Veil Sight');
    if (st.canHitAir) cap('antiAir', 'Hits air');
    else chips.push(h('span.bt-cap.bt-cap-no', 'Ground only'));
    if (st.silence > 0) cap('silence', `Silence ${fmtNum(st.silence, 1)}s`);
    if (st.reveal > 0) cap('reveal', `Reveal ${fmtNum(st.reveal, 1)}s`);
    if (st.knockback > 0) cap('stun', `Knockback ${fmtNum(st.knockback, 2)}`);
    for (const s of st.status || []) chips.push(h('span.bt-cap.bt-cap-status', statusLabel(s)));
    if (st.buffed || (st.buff && (st.buff.dmgMul > 1 || st.buff.rateMul > 1 || st.buff.rangeMul > 1))) chips.push(h('span.bt-cap.bt-cap-buff', { title: 'A girl\'s aura (Allies) is making her stronger.' }, 'Buffed by an ally'));
    if (st.disabled > 0) chips.push(h('span.bt-cap.bt-cap-bad', `Disabled ${fmtNum(st.disabled, 1)}s`));
    const stats = h('div.bt-stats-grid', rows);
    const caps = chips.length ? h('div.bt-caps', chips) : null;

    // ---- upgrade paths (heroes have none: they level along their track)
    const paths = def.paths.length ? h('div.bt-paths', def.paths.map((p, i) => pathRow(t, p, i, pathNames, st.aura?.range || 0))) : null;

    // ---- footer: heroes Move instead of Sell (they deploy for free)
    let foot;
    if (t.isHero) {
      const mv = ctx.heroLevels?.moveState(t) || { label: 'Move', disabled: true };
      const own = !ctx.coop || ctx.coop.isMine(t.uid);
      const moveBtn = own ? h('button.bt-sell.bt-move', { 'data-testid': 'hero-move', disabled: mv.disabled, onclick: () => ctx.startHeroMove?.() }, icon('target', 'bt-ico-sm'), mv.label) : null;
      foot = h('div.bt-panel-foot', h('span.bt-spent', `Levels bought ${fmtCoins(t.levelSpent || 0)}`), moveBtn);
    } else {
      const value = sim.sellValue(t.uid);
      const sell = h(
        `button.bt-sell${sellArmed ? '.armed' : ''}`,
        { 'data-testid': 'sell', onclick: () => onSell(t) },
        icon('sell', 'bt-ico-sm'),
        sellArmed ? `Confirm · +${fmtCoins(value)}` : `Sell · ${fmtCoins(value)}`,
      );
      foot = h('div.bt-panel-foot', h('span.bt-spent', `Invested ${fmtCoins(t.spent)}`), sell);
    }

    // co-op: an ally's girl can be inspected but only her owner upgrades, retargets or sells her
    const ally = ctx.coop && !ctx.coop.isMine(t.uid);
    el.classList.toggle('bt-panel-ally', !!ally);
    const owner = ally ? ctx.coop.ownerName(t.uid) : '';
    const allyNote = ally ? h('div.bt-ally-note', { 'data-testid': 'ally-note', style: { '--ally': ctx.coop.colorOf(t.uid) } }, t.isHero ? `${owner}'s hero — only ${owner} can level her up, retarget or move her.` : `${owner}'s girl — only ${owner} can upgrade, retarget or sell her.`) : null;
    const prevScroll = el.querySelector('.bt-panel-scroll')?.scrollTop || 0;
    let scroll;
    let toTop = false;
    el.classList.toggle('bt-panel-drones', hasDroneTabs(st));
    if (hasDroneTabs(st)) {
      // drone owner: split bar, Flight row and the tab row on top; the tab's content below
      const rest = rows.filter((c) => c !== keyed.dps && c !== keyed.turret);
      const own = [];
      for (const s0 of st.status || []) own.push(h('span.bt-cap.bt-cap-status', statusLabel(s0)));
      if (st.canHitAir) own.push(h('span.bt-cap', svgEl(capabilityIcon('antiAir'), 'bt-cap-ico'), 'Hits air'));
      const affordable = [0, 1, 2].some((p) => !sim.upgradeStatus(t.uid, p).locked);
      const dv = drones.sections(t, st, { paths, rest, caps, aura: keyed.aura?.cloneNode(true) || null, ownCaps: own.length ? h('div.bt-caps', own) : null }, { mine: !ally, affordable });
      scroll = h('div.bt-panel-scroll', head, dv.split, allyNote, heroBlock, target, dv.flight, dv.tabs, dv.content);
      toTop = dv.toTop;
    } else {
      scroll = h(
        'div.bt-panel-scroll',
        head,
        allyNote,
        heroBlock,
        target,
        paths ? h('div.bt-section-label', icon('upgrade', 'bt-ico-sm'), 'Upgrades') : null,
        paths,
        h('div.bt-section-label', icon('info', 'bt-ico-sm'), 'Stats'),
        stats,
        caps,
      );
    }
    el.replaceChildren(scroll, foot);
    if (prevScroll && el.dataset.uid === String(t.uid) && !toTop) scroll.scrollTop = prevScroll;
    el.dataset.uid = String(t.uid);
    updateLive(t, st);
  }

  /** A tier's price before gear Cost Reduction and cost-cut auras (difficulty still applies). */
  const fullCost = (tier) => roundCost((tier.cost || 0) * (sim.diff?.costMul ?? 1));

  /** Hero block: Lv + XP, Level up, the next levels, the full track, the ultimate and its rank. */
  function heroSection(t, st) {
    const def = t.def;
    const own = sim.hero === t;
    const xpFill = h('span.bt-xp-fill');
    const xpText = h('span.bt-xp-text');
    const ultBtn = own ? h('button.bt-ult-btn', { 'data-testid': 'panel-ult', onclick: () => ctx.fireUlt() }) : null;
    live.xpFill = xpFill;
    live.xpText = xpText;
    live.ult = ultBtn;
    const max = st.heroLevel?.max ?? 25;
    const lvLabel = t.level >= max ? (t.mastery > 0 ? `MAX · +${Math.round(t.mastery * 100)}%` : 'MAX') : `Lv ${t.level}`;
    // Level up (own hero, not at max): sends the level and the price it shows
    let buy = null;
    if (own) {
      heroShown = sim.heroLevelStatus();
      const hs = heroShown;
      if (hs.reason !== 'max' && hs.reason !== 'noHero') {
        buy = h(
          `button.bt-buy.bt-hero-lvup${hs.reason === 'cash' ? '.poor' : ''}`,
          { 'data-testid': 'hero-levelup', disabled: hs.reason === 'ended', onclick: () => { if (ctx.levelUpHero?.(heroShown)) { sig = ''; update(true); } } },
          h('span', `▲ Level up · `),
          svgEl(currencyIcon('coins'), 'bt-buy-coin'),
          fmtCoins(hs.price),
        );
      }
    }
    const next = [];
    for (let l = t.level + 1; l <= Math.min(max, t.level + 3); l++) {
      const row = trackLevel(def, l);
      if (!row) continue;
      next.push(h(`div.bt-track-next${l === t.level + 1 ? '.first' : ''}`, h('b', `${l === t.level + 1 ? 'Next' : 'Then'}: Lv ${l}`), ` · ${row.desc}`));
    }
    const rows = (def.hero?.levels || []).map((row) => h(
      `div.bt-track-row${row.level <= t.level ? '.on' : ''}${row.level === t.level + 1 ? '.next' : ''}${rankAt(def, row.level) ? '.rank' : ''}`,
      { 'data-level': row.level },
      h('span.bt-track-lv', row.level <= t.level ? `✓ ${row.level}` : String(row.level)),
      h('span.bt-track-desc', row.desc, h('small', sourceText(def, row.from))),
    ));
    const track = trackOpen ? h('div.bt-track', { 'data-testid': 'hero-track' }, rows) : null;
    const toggle = h('button.bt-track-toggle', { 'data-testid': 'hero-track-toggle', onclick: () => { trackOpen = !trackOpen; sig = ''; update(true); } }, trackOpen ? 'Full track ▴' : 'Full track ▾');
    const ult = def.hero?.ult;
    const rank = st.ultRank || 1;
    const nextRank = (ult?.ranks || []).find((r) => t.level < r.level);
    return h(
      'div.bt-hero-block',
      h('div.bt-xp', h('span.bt-xp-lv', lvLabel), h('span.bt-xp-bar', xpFill), xpText),
      buy ? h('div.bt-hero-buy', buy) : null,
      next.length ? h('div.bt-track-nexts', next) : null,
      toggle,
      track,
      ult ? h('div.bt-ult-row', h('div.bt-ult-info', h('b', `${ult.name} · Rank ${rank}`), h('div.bt-ult-desc', ult.desc, nextRank ? h('small', ` (rank ${(ult.ranks.indexOf(nextRank)) + 2} at Lv ${nextRank.level})`) : null)), ultBtn) : null,
    );
  }

  function pathRow(t, p, i, names, auraR = 0) {
    const st = sim.upgradeStatus(t.uid, i);
    const cur = t.tiers[i];
    const cap = pathCap(t.tiers, i);
    const pips = h('div.bt-pips', p.tiers.map((tier, k) => h(
      `span.bt-pip${k < cur ? '.on' : ''}${k >= cap ? '.capped' : ''}${k === cur && !st.locked ? '.next' : ''}`,
      { title: `T${k + 1} ${tier.name}` },
    )));
    let body;
    if (st.reason === 'max' || !st.next) {
      body = h('div.bt-path-max', h('b', 'MAX'), ` ${p.tiers[cur - 1]?.name || ''}`);
    } else {
      const next = st.next;
      const desc = h('div.bt-path-next', h('div.bt-path-tname', `T${cur + 1} · ${next.name}`, tagChips(tierTags(t.def, i, cur + 1, { current: auraR }), { size: 'xs' })), h('div.bt-path-desc', next.desc));
      let action;
      if (st.reason === 'crosspath') {
        action = h('div.bt-lock', icon('lock', 'bt-ico-sm'), crosspathReason(t.tiers, i, names));
      } else {
        const afford = st.reason !== 'cash';
        action = h(
          `button.bt-buy${afford ? '' : '.poor'}`,
          {
            'data-testid': `buy-${i}`,
            disabled: sim.state === 'won' || sim.state === 'lost',
            onclick: () => {
              const done = ctx.act ? ctx.act.upgrade(t.uid, i) : sim.upgradeTower(t.uid, i);
              if (!done) {
                if (!ctx.coop || ctx.coop.isMine(t.uid)) ctx.feed.push(`Need ${fmtCoins(st.cost - sim.cash)} more coins.`, 'warn', { key: 'upg-cash', ms: 1500 });
                return;
              }
              if (done !== 'queued') ctx.onUpgraded(t, i);
              sig = '';
              update(true);
            },
          },
          svgEl(currencyIcon('coins'), 'bt-buy-coin'),
          // the full price struck through when gear / an aura makes it cheaper
          st.cost < fullCost(next) ? h('s.bt-buy-was', fmtCoins(fullCost(next))) : null,
          fmtCoins(st.cost),
        );
      }
      body = h('div.bt-path-body', desc, action);
    }
    const row = h(
      `div.bt-path${st.reason === 'crosspath' ? '.locked' : ''}${cur >= 3 ? '.main' : ''}`,
      { 'data-path': i },
      h('div.bt-path-head', h('span.bt-path-name', p.name), h('span.bt-path-focus', p.focus || ''), pips),
      body,
    );
    ctx.tree?.decoratePathRow?.(row, t.uid, i); // [unit-info] "Upgrade in panel ›" flash
    return row;
  }

  function onSell(t) {
    if (!sellArmed) {
      sellArmed = 1;
      sig = '';
      update(true);
      clearTimeout(sellTimer);
      sellTimer = setTimeout(() => {
        sellArmed = 0;
        sig = '';
        update(true);
      }, 2600);
      return;
    }
    clearTimeout(sellTimer);
    const refund = ctx.act ? ctx.act.sell(t.uid) : sim.sellTower(t.uid);
    if (refund === false) return;
    ctx.feed.push(`${t.def.name} returned to the academy · +${fmtCoins(refund)}`, 'info', { ms: 1800 });
    ctx.select(null);
  }

  function updateLive(t, st = null) {
    if (!live) return;
    live.kills.textContent = fmtCoins(t.kills || 0);
    live.dmg.textContent = fmtCoins(t.damageDealt || 0);
    drones.updateLive();
    if (t.isHero && live.xpFill) {
      const s = st || sim.towerStats(t.uid);
      const xp = s?.xp;
      if (xp) {
        const span = xp.next == null ? 1 : Math.max(1, xp.next - xp.current);
        const frac = xp.next == null ? 1 : Math.min(1, (xp.xp - xp.current) / span);
        live.xpFill.style.width = `${(frac * 100).toFixed(1)}%`;
        live.xpText.textContent = xp.next == null ? 'MAX' : `${fmtCoins(xp.xp - xp.current)}/${fmtCoins(span)} XP`;
      }
      if (live.ult) ctx.paintUltButton(live.ult, { compact: false });
    }
  }

  function update(force = false) {
    if (uid == null) return;
    const t = sim.getTower(uid);
    if (!t) {
      ctx.select(null);
      return;
    }
    const s = signature(t);
    if (force || s !== sig) {
      sig = s;
      render(t);
    } else updateLive(t);
  }

  return {
    el,
    open,
    close,
    update: () => update(false),
    get uid() {
      return uid;
    },
    /** The drone shown on the drone card, or null. */
    get droneUid() {
      return uid != null ? drones.droneUid : null;
    },
    /** 'upgrades' | 'overall' | 'chika' | 'drones' | 'drone' (drone owners only). */
    get tab() {
      return drones.tab;
    },
    destroy() {
      clearTimeout(sellTimer);
      el.remove();
    },
  };
}
