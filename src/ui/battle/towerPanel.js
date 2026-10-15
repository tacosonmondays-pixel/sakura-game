// Selected-girl panel: portrait, role, target mode, effective stats, who buffs her ("Buffed by")
// and whom she buffs ("Buffing", with Midori's / Chika's pick), 3 upgrade paths with tier pips /
// next tier / crosspath locks / buy buttons, sell, close. Hero extras: level, XP bar and
// ultimate. Landscape: right-side card; portrait: bottom sheet.
import { h, icon, fmtCoins, fmtNum, setVar } from './util.js';
import { crosspathReason, pathCap, onePerPathReason, heldPipTitle, whereOnMap, finalHolderLine, ONE_PER_PATH_COOP } from './rules.js';
import { svgEl } from '../components.js';
import { portraitHTML } from '../../art/portraits.js';
import { roleIcon, attackTypeIcon, elementIcon, capabilityIcon, currencyIcon } from '../../art/icons.js';
import { ROLES, ATTACK_TYPES, ELEMENTS, TARGET_MODES, STATUSES } from '../../data/types.js';
import { isUR, rarityColor, urBadge, applyUrFrame } from '../rarity.js';
import { roundCost } from '../../sim/Sim.js';
import { buffedByRows, kindLabel, weakerAurasText, limitedText, tintOf, LIMITED_KINDS } from './buffs.js';

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
  if (s.pct) parts.push(`+${fmtNum(s.pct * 100, 2)}% max HP/s`);
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
  /** Girls whose "Buffed by" list is expanded on a short screen ("Show all (N)"). */
  const expanded = new Set();

  /** What the buff sections show, without timers (they update live): re-render when it changes. */
  function buffSig(t) {
    const src = (sim.buffSources?.(t.uid) || []).map((r) => `${r.kind}${r.src}${r.key}`).join('.');
    const tg = (sim.buffTargets?.(t.uid) || []).map((r) => `${r.uid}${r.kinds.join('')}`).join('.');
    const short = typeof window !== 'undefined' && window.innerHeight <= 500 ? 1 : 0;
    return `${src}/${tg}/${t.buffPick ?? -1}/${ctx.picking ?? ''}/${expanded.has(t.uid) ? 1 : 0}${short}`;
  }

  function signature(t) {
    const afford = [0, 1, 2].map((p) => {
      const st = sim.upgradeStatus(t.uid, p);
      // a final tier held by another copy: her build and spot are in the lock line
      const hold = st.holder != null ? sim.getTower(st.holder) : null;
      return `${st.tier}${st.reason || 'ok'}${st.cost}${hold ? `h${hold.uid}:${hold.tiers.join('')}` : ''}`;
    }).join(',');
    return `${t.uid}|${t.tiers.join('')}|${t.targetMode}|${afford}|${t.level || 0}|${sim.state}|${sellArmed}|${t.ultUnlocked ? 1 : 0}|${t.turrets?.length || 0}|${buffSig(t)}`;
  }

  function open(towerUid) {
    uid = towerUid;
    sig = '';
    sellArmed = 0;
    el.hidden = false;
    el.classList.remove('bt-panel-in');
    void el.offsetWidth;
    el.classList.add('bt-panel-in');
    update(true);
  }

  function close() {
    uid = null;
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
      h('button.bt-x.bt-panel-close', { 'data-testid': 'panel-close', title: 'Close', onclick: () => ctx.select(null) }, icon('close')),
    );

    // ---- hero block
    let heroBlock = null;
    if (t.isHero) {
      const xpFill = h('span.bt-xp-fill');
      const xpText = h('span.bt-xp-text');
      const ultBtn = h('button.bt-ult-btn', { 'data-testid': 'panel-ult', onclick: () => ctx.fireUlt() });
      live.xpFill = xpFill;
      live.xpText = xpText;
      live.ult = ultBtn;
      const ult = def.hero?.ult;
      heroBlock = h(
        'div.bt-hero-block',
        h('div.bt-xp', h('span.bt-xp-lv', `Lv ${t.level}`), h('span.bt-xp-bar', xpFill), xpText),
        ult ? h('div.bt-ult-row', h('div.bt-ult-info', h('b', ult.name), h('div.bt-ult-desc', ult.desc)), ultBtn) : null,
      );
    }

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
    const add = (label, value, cls = '') => rows.push(h(`div.bt-stat-cell${cls}`, h('span', label), h('b', value)));
    // Drone carriers (Chika): the drones do the shooting (her own shots only start once every
    // drone is out), so her DPS is the full drone wing plus her own; her "attack rate" is how
    // fast she builds drones
    const drones = st.turret && t.turretSpec ? { each: t.turretSpec.damage * t.turretSpec.rate, rate: t.turretSpec.rate } : null;
    const dps = st.dps + (drones ? drones.each * st.turret.max : 0);
    if (dps > 0) add('DPS', fmtNum(dps, 1), '.bt-stat-main');
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
    if (st.crit?.chance > 0) add('Crit', `${Math.round(st.crit.chance * 100)}% ×${fmtNum(st.crit.mul, 2)}`, '.bt-stat-wide2');
    if (st.eliteMul > 1) add('vs Elite', `×${fmtNum(st.eliteMul, 2)}`);
    if (st.bossMul > 1) add('vs Boss', `×${fmtNum(st.bossMul, 2)}`);
    if (st.barrierMul > 1) add('vs Barrier', `×${fmtNum(st.barrierMul, 2)}`);
    if (st.trap) add('Traps', `${st.trap.placed ?? 0}/${st.trap.max} · ${fmtNum(st.trap.damage, 0)} dmg`, '.bt-stat-wide2');
    if (st.turret) add('Drones', `${st.turret.active ?? 0}/${st.turret.max} · ${fmtNum(st.turret.damage, 0)} dmg × ${fmtNum(drones?.rate ?? 0, 2)}/s each`, '.bt-stat-wide');
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
      add('Aura', `${fmtNum(a.range, 1)} tiles${bits.length ? ` · ${bits.join(', ')}` : ''}`, '.bt-stat-wide');
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
    if (st.disabled > 0) chips.push(h('span.bt-cap.bt-cap-bad', `Disabled ${fmtNum(st.disabled, 1)}s`));
    const stats = h('div.bt-stats-grid', rows);
    const caps = chips.length ? h('div.bt-caps', chips) : null;

    // ---- upgrade paths
    const paths = h('div.bt-paths', def.paths.map((p, i) => pathRow(t, p, i, pathNames)));

    // ---- footer
    const value = sim.sellValue(t.uid);
    const sell = h(
      `button.bt-sell${sellArmed ? '.armed' : ''}`,
      { 'data-testid': 'sell', onclick: () => onSell(t) },
      icon('sell', 'bt-ico-sm'),
      sellArmed ? `Confirm · +${fmtCoins(value)}` : `Sell · ${fmtCoins(value)}`,
    );
    const foot = h('div.bt-panel-foot', h('span.bt-spent', `Invested ${fmtCoins(t.spent)}`), sell);

    // co-op: an ally's girl can be inspected but only her owner upgrades, retargets or sells her
    const ally = ctx.coop && !ctx.coop.isMine(t.uid);
    el.classList.toggle('bt-panel-ally', !!ally);
    const owner = ally ? ctx.coop.ownerName(t.uid) : '';
    const allyNote = ally ? h('div.bt-ally-note', { 'data-testid': 'ally-note', style: { '--ally': ctx.coop.colorOf(t.uid) } }, `${owner}'s girl — only ${owner} can upgrade, retarget or sell her.`) : null;
    const prevScroll = el.querySelector('.bt-panel-scroll')?.scrollTop || 0;
    const scroll = h(
      'div.bt-panel-scroll',
      head,
      allyNote,
      heroBlock,
      target,
      h('div.bt-section-label', icon('upgrade', 'bt-ico-sm'), 'Upgrades'),
      paths,
      h('div.bt-section-label', icon('info', 'bt-ico-sm'), 'Stats'),
      stats,
      caps,
      buffedBy(t),
      buffing(t, ally),
    );
    el.replaceChildren(scroll, foot);
    if (prevScroll && el.dataset.uid === String(t.uid)) scroll.scrollTop = prevScroll;
    el.dataset.uid = String(t.uid);
    updateLive(t, st);
  }

  /** A girl's name, with her owner's in co-op when she is an ally's ("Rosie's Miko"). */
  function whoName(o) {
    if (!o) return '';
    if (ctx.coop && !ctx.coop.isMine(o.uid)) return `${ctx.coop.ownerName(o.uid)}'s ${o.def.name}`;
    return o.def.name;
  }

  /** "Buffed by": one row per source girl (limited first), her keys and amounts, tap to select her. */
  function buffedBy(t) {
    const sources = sim.buffSources?.(t.uid) || [];
    if (!sources.length) return null;
    const rows = buffedByRows(sources);
    const short = typeof window !== 'undefined' && window.innerHeight <= 500;
    const all = !short || expanded.has(t.uid) || rows.length <= 2;
    const shown = all ? rows : rows.slice(0, 2);
    live.buffKinds = [];
    const items = shown.map((r) => {
      const src = r.src >= 0 ? sim.getTower(r.src) : null;
      const name = r.kind === 'map' ? 'Map rule' : r.kind === 'ult' && !src ? 'Hero ultimate' : whoName(src);
      const kind = h('span.bt-buff-kind', kindLabel(r.kind, r.left));
      if (r.left != null) live.buffKinds.push({ node: kind, src: r.src, kind: r.kind });
      return h(
        `button.bt-buff-row${r.limited ? '.limited' : ''}`,
        {
          'data-testid': `buffed-by-${r.kind}`,
          style: { '--tint': r.kind === 'map' ? '#adb5bd' : tintOf(src?.unitId, src?.def) },
          title: src ? `Select ${src.def.name}` : '',
          onclick: () => { if (src) ctx.select(src.uid); },
        },
        src ? svgEl(portraitHTML(src.def, 'thumb', { eager: true }), 'bt-buff-face') : h('span.bt-buff-face.bt-buff-face-none', icon(r.kind === 'map' ? 'map' : 'trophy', 'bt-ico-sm')),
        h('span.bt-buff-info', h('b', name), h('span.bt-buff-what', r.texts.join(', '))),
        kind,
      );
    });
    const weaker = weakerAurasText(sim.aurasCovering?.(t.uid) || []);
    return h(
      'div.bt-buffs',
      { 'data-testid': 'buffed-by' },
      h('div.bt-section-label', icon('buff', 'bt-ico-sm'), 'Buffed by'),
      items,
      all ? null : h('button.bt-buffs-more', { 'data-testid': 'buffed-by-more', onclick: () => { expanded.add(t.uid); sig = ''; update(true); } }, `Show all (${rows.length})`),
      weaker ? h('div.bt-buffs-foot', weaker) : null,
    );
  }

  /**
   * "Buffing": the girls she buffs. Midori / Chika: her brew or tune-up (amounts), the girls holding
   * it first, and her pick control (Auto / Pick a girl).
   */
  function buffing(t, ally) {
    const targets = sim.buffTargets?.(t.uid) || [];
    const lim = t.stats?.brew ? 'brew' : t.stats?.link ? 'link' : null;
    if (!targets.length && !lim) return null;
    const l = lim ? t.stats[lim] : null;
    const held = targets.filter((r) => r.kinds.some((k) => LIMITED_KINDS.has(k)));
    const faces = targets.slice(0, 8).map((r) => {
      const o = sim.getTower(r.uid);
      return o ? h('button.bt-buffing-face', { title: whoName(o), onclick: () => ctx.select(o.uid) }, svgEl(portraitHTML(o.def, 'thumb', { eager: true }), 'bt-buff-face')) : null;
    });
    let control = null;
    if (lim) {
      const pick = t.buffPick >= 0 ? sim.getTower(t.buffPick) : null;
      const picking = ctx.picking === t.uid;
      control = h(
        'div.bt-buff-pick',
        { 'data-testid': 'buff-pick-row' },
        h('span.bt-buff-pick-now', 'Target: ', h('b', pick ? `${pick.def.name} (picked)` : 'Auto (strongest)')),
        ally ? null : h(`button.bt-btn.bt-buff-pick-btn${picking ? '.on' : ''}`, {
          'data-testid': 'buff-pick',
          onclick: () => (picking ? ctx.cancelPick?.() : ctx.startPick?.(t.uid)),
        }, picking ? 'Cancel' : 'Pick a girl'),
        !ally && pick ? h('button.bt-btn.bt-buff-auto', { 'data-testid': 'buff-auto', onclick: () => ctx.sendPick?.(t.uid, -1) }, 'Auto') : null,
      );
    }
    const what = lim === 'brew' ? 'Brew' : 'Tune-up';
    return h(
      'div.bt-buffs.bt-buffing',
      { 'data-testid': 'buffing' },
      h('div.bt-section-label', icon('support', 'bt-ico-sm'), targets.length ? `Buffing ${targets.length} girl${targets.length === 1 ? '' : 's'}` : 'Buffing'),
      l ? h('div.bt-buff-lim', h('b', `${what} · ${l.targets} girl${l.targets === 1 ? '' : 's'}: `), limitedText(l),
        l.overclock ? h('span.bt-buff-oc', ` · Overclock +${Math.round((l.overclock.rateMul - 1) * 100)} % attack speed`) : null) : null,
      held.length ? h('div.bt-buff-held', held.map((r) => whoName(sim.getTower(r.uid))).filter(Boolean).join(', ')) : null,
      faces.length ? h('div.bt-buffing-faces', faces, targets.length > 8 ? h('span.bt-buffing-more', `+${targets.length - 8}`) : null) : null,
      control,
    );
  }

  /** A tier's price before gear Cost Reduction and cost-cut auras (difficulty still applies). */
  const fullCost = (tier) => roundCost((tier.cost || 0) * (sim.diff?.costMul ?? 1));

  /** The holder of a locked final tier: name + build + where she stands, and a Show button. */
  function finalLock(t, p, i, st) {
    const hold = st.holder != null ? sim.getTower(st.holder) : null;
    const show = hold ? h(
      'button.bt-final-show',
      {
        'data-testid': `final-show-${i}`,
        title: `Select ${hold.def.name}`,
        onclick: () => {
          ctx.select(hold.uid);
          ctx.renderer?.pulseTower?.(hold.uid);
        },
      },
      finalHolderLine(hold, whereOnMap(hold.x, hold.y, sim.map?.width, sim.map?.height)),
      h('b', ' · Show ›'),
    ) : null;
    return h(
      'div.bt-lock.bt-lock-final',
      { 'data-testid': `final-lock-${i}`, title: ctx.coop ? ONE_PER_PATH_COOP : '' },
      h('div.bt-lock-line', icon('lock', 'bt-ico-sm'), h('span', onePerPathReason(t.def.name, p.name))),
      show,
    );
  }

  function pathRow(t, p, i, names) {
    const st = sim.upgradeStatus(t.uid, i);
    const cur = t.tiers[i];
    const cap = pathCap(t.tiers, i);
    // one final tier per path: the last pip shows a lock when another copy holds it
    const held = !t.isHero && cur < p.tiers.length && sim.finalTierHolder?.(t.uid, i) ? p.tiers.length - 1 : -1;
    const pips = h('div.bt-pips', p.tiers.map((tier, k) => h(
      `span.bt-pip${k < cur ? '.on' : ''}${k >= cap ? '.capped' : ''}${k === held ? '.held' : ''}${k === cur && !st.locked ? '.next' : ''}`,
      { title: k === held ? heldPipTitle(tier.name, t.def.name) : `T${k + 1} ${tier.name}` },
    )));
    let body;
    if (st.reason === 'max' || !st.next) {
      body = h('div.bt-path-max', h('b', 'MAX'), ` ${p.tiers[cur - 1]?.name || ''}`);
    } else {
      const next = st.next;
      const desc = h('div.bt-path-next', h('div.bt-path-tname', `T${cur + 1} · ${next.name}`), h('div.bt-path-desc', next.desc));
      let action;
      if (st.reason === 'crosspath') {
        action = h('div.bt-lock', icon('lock', 'bt-ico-sm'), crosspathReason(t.tiers, i, names));
      } else if (st.reason === 'onePerPath') {
        action = finalLock(t, p, i, st);
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
                if (ctx.coop && !ctx.coop.isMine(t.uid)) return;
                const now = sim.upgradeStatus(t.uid, i);
                // the holder may have taken the final tier since the panel was drawn
                if (now.reason === 'onePerPath') ctx.feed.push(onePerPathReason(t.def.name, p.name), 'warn', { key: 'upg-final', ms: 2200 });
                else ctx.feed.push(`Need ${fmtCoins(st.cost - sim.cash)} more coins.`, 'warn', { key: 'upg-cash', ms: 1500 });
                sig = '';
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
      body = h(`div.bt-path-body${st.reason === 'onePerPath' ? '.bt-path-body-final' : ''}`, desc, action);
    }
    return h(
      `div.bt-path${st.reason === 'crosspath' || st.reason === 'onePerPath' ? '.locked' : ''}${cur >= 3 ? '.main' : ''}`,
      { 'data-path': i },
      h('div.bt-path-head', h('span.bt-path-name', p.name), h('span.bt-path-focus', p.focus || ''), pips),
      body,
    );
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
    if (live.buffKinds?.length) {
      // brew / ultimate seconds tick down without a re-render
      const now = sim.buffSources?.(t.uid) || [];
      for (const k of live.buffKinds) {
        const r = now.find((x) => x.src === k.src && x.kind === k.kind);
        if (r) k.node.textContent = kindLabel(r.kind, r.left);
      }
    }
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
    destroy() {
      clearTimeout(sellTimer);
      el.remove();
    },
  };
}
