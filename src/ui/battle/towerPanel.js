// Selected-girl panel: portrait, role, target mode, effective stats, who buffs her ("Buffed by")
// and whom she buffs ("Buffing", with Midori's / Chika's pick), 3 upgrade paths with tier pips /
// next tier / crosspath and final-tier locks / buy buttons, sell, close. Heroes instead: level, XP
// bar, Level up, the next levels and the full 25-level track, the ultimate and its rank, and Move
// (heroes cannot be sold). Landscape: right-side card; portrait: bottom sheet. Girls with roaming
// drones (Chika) also get a split bar, a Flight row and tabs (chikaPanel.js); her buff sections sit
// on her own tab.
import { h, icon, fmtCoins, fmtNum, setVar } from './util.js';
import { createDronePanel, hasDroneTabs } from './chikaPanel.js';
import { crosspathReason, pathCap, onePerPathReason, heldPipTitle, whereOnMap, finalHolderLine, ONE_PER_PATH_COOP } from './rules.js';
import { svgEl } from '../components.js';
import { portraitHTML } from '../../art/portraits.js';
import { roleIcon, attackTypeIcon, elementIcon, capabilityIcon, currencyIcon } from '../../art/icons.js';
import { ROLES, ATTACK_TYPES, ELEMENTS, TARGET_MODES, STATUSES } from '../../data/types.js';
import { isUR, rarityColor, urBadge, applyUrFrame } from '../rarity.js';
import { potPill } from '../potential.js';
import { potentialSummary } from '../../systems/potential.js';
import { potentialRows, potentialRowText } from './potentialRows.js';
import { roundCost } from '../../sim/Sim.js';
import { tagChips, TREE_GLYPH } from '../tagChips.js'; // [unit-info] Self / Allies / Enemies chips + tree button
import { tierTags } from '../upgradeTags.js';
import { HERO_GROWTH } from '../../data/heroTracks.js';
import { PRICE_TICK, trackLevel, sourceText, rankAt } from './heroLevels.js';
import { aimMode } from '../../sim/towers.js';
import { buffedByRows, kindLabel, weakerAurasText, limitedText, tintOf, LIMITED_KINDS } from './buffs.js';

const TARGETABLE = new Set(['projectile', 'beam', 'chain', 'duel', 'turret']);
const MODE_HELP = {
  first: 'Closest to the exit',
  last: 'Furthest from the exit',
  strong: 'Highest HP',
  close: 'Nearest to her',
  elite: 'Casters, siphoners, elites, bosses first',
  air: 'Flyers first, then the leader',
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
    const dv = t.turretSpec?.leash > 0 ? drones.signature(t) : '';
    return `${t.uid}|${t.tiers.join('')}|${t.targetMode}|${afford}|${t.level || 0}|${sim.state}|${sellArmed}|${t.ultUnlocked ? 1 : 0}|${t.turrets?.length || 0}|${dv}${heroSig(t)}|${buffSig(t)}|${t.aim ? `${t.aim.x},${t.aim.y}` : '-'}${ctx.aim?.uid === t.uid ? 'A' : ''}`;
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
    // UR and the Potential pill (display only) show what she FIGHTS at: your save for your own
    // girls; an ally's girl in co-op from her owner's battle stats (t.unitStats travels in the loadout)
    const mine = !ctx.coop || ctx.coop.isMine(t.uid);
    const profile = mine ? ctx.profile : { units: { [def.id]: { awaken: t.unitStats?.awaken || 0 } } };
    const pot = t.unitStats?.potential || 1;
    const potSummary = pot >= 2 ? potentialSummary(def, pot) : '';
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
        h('div.bt-panel-name', h('span.bt-panel-nm', def.name), ur ? urBadge() : null, h('span.bt-panel-tiers', t.isHero ? `Lv ${t.level}` : t.tiers.join('-')),
          pot >= 2 ? potPill(pot, { cls: 'bt-panel-pot', testid: 'panel-pot', title: `Potential ${pot}: ${potSummary}` }) : null),
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
        // (Air only for a girl who can hit flyers)
        h('div.bt-seg', Object.entries(TARGET_MODES).filter(([k]) => k !== 'air' || st.canHitAir).map(([k, name]) => h(
          `button.bt-seg-btn${t.targetMode === k ? '.on' : ''}`,
          { 'data-mode': k, title: MODE_HELP[k], onclick: () => { (ctx.act ? ctx.act.target(t.uid, k) : sim.setTargetMode(t.uid, k)); sig = ''; update(true); } },
          name,
        ))),
      );
    }

    // ---- spike strips (Azami, src/sim/strips.js): where she lays them. Near exit and Spread are her
    // target modes First and Last (the co-op `tgt` command); Checkpoint, from Checkpoint tier 3, is
    // her aim point (the `aim` command). Picking a mode clears a checkpoint.
    const am = aimMode(t);
    if (st.behavior === 'strip') {
      const aiming = ctx.aim?.uid === t.uid;
      const checkpoint = !!t.aim || aiming;
      const mode = (k) => () => {
        if (t.aim || aiming) ctx.aim?.clear(t.uid);
        (ctx.act ? ctx.act.target(t.uid, k) : sim.setTargetMode(t.uid, k));
        sig = '';
        update(true);
      };
      target = h(
        'div.bt-target',
        h('span.bt-section-label', icon('trap', 'bt-ico-sm'), 'Strips'),
        h('div.bt-seg',
          h(`button.bt-seg-btn${!checkpoint && t.targetMode !== 'last' ? '.on' : ''}`, { 'data-mode': 'first', 'data-testid': 'strip-exit', title: 'On the free road spot nearest the exit', onclick: mode('first') }, 'Near exit'),
          h(`button.bt-seg-btn${!checkpoint && t.targetMode === 'last' ? '.on' : ''}`, { 'data-mode': 'last', 'data-testid': 'strip-spread', title: 'Spread along the road', onclick: mode('last') }, 'Spread'),
          am === 'checkpoint' ? h(`button.bt-seg-btn${checkpoint ? '.on' : ''}`, { 'data-testid': 'aim-set', title: 'Tap the road: her strips land around that point', onclick: () => { ctx.aim?.start(t.uid); sig = ''; update(true); } }, aiming ? 'Tap map…' : 'Checkpoint') : null),
      );
    }

    // ---- aim point (roster B3): a mortar's centre, a mirror panel's spot, an aimed hero ult
    if (am && am !== 'checkpoint') {
      const aiming = ctx.aim?.uid === t.uid;
      const aimRow = h(
        'div.bt-target.bt-aim',
        h('span.bt-section-label', icon('target', 'bt-ico-sm'), am === 'mirror' ? 'Mirror' : 'Aim'),
        h('div.bt-seg',
          h(`button.bt-seg-btn${!t.aim && !aiming ? '.on' : ''}`, { 'data-testid': 'aim-auto', title: 'She picks the spot herself', onclick: () => { ctx.aim?.clear(t.uid); sig = ''; update(true); } }, 'Auto'),
          h(`button.bt-seg-btn${t.aim || aiming ? '.on' : ''}`, { 'data-testid': 'aim-set', title: 'Tap the map to aim', onclick: () => { ctx.aim?.start(t.uid); sig = ''; update(true); } }, aiming ? 'Tap map…' : t.aim ? 'Re-aim' : 'Set aim')),
      );
      target = target ? h('div', target, aimRow) : aimRow;
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
    if (st.hub) {
      // Ouka's office rules (src/sim/hubs.js)
      const hb = st.hub;
      const bits = [`-${Math.round(hb.costCut * 100)}% upgrades`, `sell ${Math.round(hb.sellMul * 100)}%`];
      if (hb.freeTiers > 0) bits.push(`${hb.freeTiers === 1 ? '1st tier' : `first ${hb.freeTiers} tiers`} free`);
      if (hb.killBounty > 0) bits.push(`+${fmtNum(hb.killBounty, 0)} coins/kill`);
      if (hb.cdCut > 0) bits.push(`abilities +${Math.round(hb.cdCut * 100)}%`);
      if (hb.rateMul > 1) bits.push(`+${Math.round((hb.rateMul - 1) * 100)}% speed`);
      if (hb.rangeMul > 1) bits.push(`+${Math.round((hb.rangeMul - 1) * 100)}% range`);
      if (hb.dmgMul > 1) bits.push(`+${Math.round((hb.dmgMul - 1) * 100)}% dmg`);
      if (hb.detection) bits.push('Veil Sight');
      if (hb.airGrant) bits.push('hit flyers');
      if (hb.cleanse) bits.push('Cleanse');
      if (hb.typeFloor > 0) bits.push('type floor ×1');
      add('Office', `${fmtNum(hb.radius, 1)} tiles · ${bits.join(', ')}`, '.bt-stat-wide', 'aura');
      if (hb.banners > 0) add('Banners', `${t.banners?.length || 0}/${hb.banners} · ${fmtNum(hb.bannerRange, 1)} tiles`, '.bt-stat-wide2');
    }
    if (t.rules) {
      // a girl inside Ouka's office or by her banner: the rules that are not already shown as buffs
      const ru = t.rules;
      const bits = [];
      if (ru.freeTiers > 0) bits.push(`${ru.freeTiers === 1 ? '1st tier' : `first ${ru.freeTiers} tiers`} free`);
      if (ru.sellMul > 0) bits.push(`sells for ${Math.round(ru.sellMul * 100)}%`);
      if (ru.cdCut > 0) bits.push(`ability +${Math.round(ru.cdCut * 100)}% charge`);
      if (ru.airGrant) bits.push('hits flyers');
      if (ru.typeFloor > 0) bits.push('type floor ×1');
      if (bits.length) add('Council rules', bits.join(', '), '.bt-stat-wide');
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
    // Potential (v3 §11): her rhythm and tempo pips, shuriken per throw, her drones' overclock (live).
    // Mounted right under the head (a drone owner: at the top of her Overall / Chika tab), so the pips
    // tick in view when the panel opens instead of below three upgrade paths
    const potBlock = potentialBlock(t, st);

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
      // drone owner: split bar, Flight row and the tab row on top; the tab's content below. Her
      // "Buffed by" / "Buffing" sections (path cap §4.4) sit on her own tab (chikaPanel chikaTab).
      const rest = rows.filter((c) => c !== keyed.dps && c !== keyed.turret);
      const own = [];
      for (const s0 of st.status || []) own.push(h('span.bt-cap.bt-cap-status', statusLabel(s0)));
      if (st.canHitAir) own.push(h('span.bt-cap', svgEl(capabilityIcon('antiAir'), 'bt-cap-ico'), 'Hits air'));
      const affordable = [0, 1, 2].some((p) => !sim.upgradeStatus(t.uid, p).locked);
      const buffs = () => [buffedBy(t), buffing(t, ally)];
      const dv = drones.sections(t, st, { paths, rest, caps, pot: potBlock, aura: keyed.aura?.cloneNode(true) || null, ownCaps: own.length ? h('div.bt-caps', own) : null, buffs }, { mine: !ally, affordable });
      scroll = h('div.bt-panel-scroll', head, dv.split, allyNote, heroBlock, target, dv.flight, dv.tabs, dv.content);
      toTop = dv.toTop;
    } else {
      scroll = h(
        'div.bt-panel-scroll',
        head,
        potBlock,
        allyNote,
        heroBlock,
        target,
        paths ? h('div.bt-section-label', icon('upgrade', 'bt-ico-sm'), 'Upgrades') : null,
        paths,
        h('div.bt-section-label', icon('info', 'bt-ico-sm'), 'Stats'),
        stats,
        caps,
        buffedBy(t),
        buffing(t, ally),
      );
    }
    el.replaceChildren(scroll, foot);
    if (prevScroll && el.dataset.uid === String(t.uid) && !toTop) scroll.scrollTop = prevScroll;
    el.dataset.uid = String(t.uid);
    updateLive(t, st);
  }

  /**
   * Potential's live rows (src/ui/battle/potentialRows.js): built with the panel, their pips and
   * words refreshed every frame by paintPot. None at P1.
   */
  function potentialBlock(t, st) {
    const rows = potentialRows(t, st);
    if (!rows.length) {
      live.pot = null;
      return null;
    }
    live.pot = rows.map((r) => {
      const n = r.key === 'rhythm' ? r.every : r.key === 'tempo' ? r.max : 0;
      const pips = Array.from({ length: n }, () => h('span.bt-pot-pip'));
      const text = h('small');
      const el = h(`div.bt-pot-row.${r.key}`, { 'data-testid': `pot-${r.key}`, title: r.key === 'rhythm' ? `${r.name}: every ${r.every} ${r.of === 'trap' ? 'traps' : 'attacks'}` : '' },
        h('b', r.key === 'shots' ? r.label : r.name), n ? h(`span.bt-pot-pips${n > 8 ? '.many' : ''}`, pips) : null, text);
      return { key: r.key, el, pips, text };
    });
    paintPot(t, st);
    return h('div.bt-pot', { 'data-testid': 'panel-potential' }, live.pot.map((x) => x.el));
  }

  function paintPot(t, st = null) {
    if (!live?.pot) return;
    const rows = potentialRows(t, st || sim.towerStats(t.uid));
    for (const x of live.pot) {
      const r = rows.find((y) => y.key === x.key);
      if (!r) continue;
      const on = r.key === 'rhythm' ? r.count : r.key === 'tempo' ? r.stacks : 0;
      x.pips.forEach((p, i) => p.classList.toggle('on', i < on));
      const words = potentialRowText(r);
      if (x.text.textContent !== words) x.text.textContent = words;
    }
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

  function pathRow(t, p, i, names, auraR = 0) {
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
      const desc = h('div.bt-path-next', h('div.bt-path-tname', `T${cur + 1} · ${next.name}`, tagChips(tierTags(t.def, i, cur + 1, { current: auraR }), { size: 'xs' })), h('div.bt-path-desc', next.desc));
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
    const row = h(
      `div.bt-path${st.reason === 'crosspath' || st.reason === 'onePerPath' ? '.locked' : ''}${cur >= 3 ? '.main' : ''}`,
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
    if (live.pot) paintPot(t, st);
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
