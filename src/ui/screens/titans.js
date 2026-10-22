// Titan Trials, the weekly bosses (docs/specs/ASCENSION.md §C, §D.3). Route: #/titans[?id=<titan>]
// Four titans: pick one, tap the family you need, pick a tier, then Fight (a Trial Key), Sweep (a
// key, pays your best solo Victory) or Practice (no key, no rewards). Built from the existing panels,
// chips and buttons; the numbers stay one short line each.
// UI M5b (docs/specs/UI_DIRECTION.md §5.10 E1, P1): Kaede hosts on the collapse rule. The screen is dense, so on
// phones (the content under the titan row is under 300 px) and under 800 px of width she is a bust chip with her
// bubble at the start of the top row (the review: no chip under the art, which ran off small phones); on desktop she
// stands in the left 35%. The week's countdown chip; Fight is the one primary (data-primary), Sweep the secondary
// (§5.5: a lock and the reason when it can't run). The titan's weaknesses, resistances, your girls, her blurb and the
// reward rules move behind MORE.
import '../styles/meta-a.css';
import '../styles/titans.css';
import '../styles/hubs.css';
import { h, clear, screen, svgEl, button, toast } from '../components.js';
import { navigate, rememberParams } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { countdownChip, moreSticker, kbdHint, secondaryBtn } from '../kit.js';
import { openSheet } from '../sheet.js';
import { hubBackdrop } from '../hubArt.js';
import { hubHost, hubMode, placeHost, viewport, watchHostMode } from '../hubHost.js';
import { titansState } from '../hubStates.js';
import { UNIT_MAP, UNITS } from '../../data/units.js';
import { MATERIAL_FAMILIES, ATTACK_TYPES } from '../../data/types.js';
import { ITEMS, zenithId } from '../../data/items.js';
import { TITANS, TITAN_MAP, TITAN_TIERS, tierLabel, tierStep, titanPoolHp, MAX_RANK } from '../../data/titans.js';
import { getMap } from '../../data/maps.js';
import { themeBackdropSVG } from '../../art/backdrops.js';
import { uiIcon, itemIcon } from '../../art/icons.js';
import { enemyToken } from '../battle/util.js';
import { potentialLevel } from '../../systems/potential.js';
import { itemCount } from '../../systems/inventory.js';
import { keyState, titanSummary, setTargetFamily, suggestedTitan, titansUnlocked, tierOpen, tierLock, sweepTitan, canSweepTitan, titanOfWeek, autoTarget, TIER_STAGE } from '../../systems/titans.js';
import { chestOdds, firstClearTable, RAINBOW_METER } from '../../systems/titanRewards.js';
import { showRewardsModal, warmBattle } from './stage.js';

/** "2 Kindred Essence (R)", "20 Star Fragments", "1 Legendary box", "2 Zenith". */
function fcLine(id, n) {
  if (id === 'zenith') return `${n} Zenith`;
  if (id.startsWith('gearbox:')) return `${n} ${ITEMS[`gearbox_${id.slice(8)}`]?.name || 'Gear Box'}`;
  const name = ITEMS[id]?.name || id;
  return `${n} ${n > 1 && !/[s)]$/.test(name) ? `${name}s` : name}`;
}
const pct = (x) => `${Math.round(x * 1000) / 10}%`;
const big = (n) => (n >= 1e6 ? `${Math.round(n / 1e5) / 10}M` : n >= 1e3 ? `${Math.round(n / 100) / 10}k` : String(n));

/** The rows above the titan detail (the key row and the titan cards), for the collapse rule: phone / desktop. */
const HEADER_H = { phone: 112, desk: 150 };
/** Kaede's stand or bust chip at this viewport (host.js collapse rule on the content left under the titan row). */
export function titanHostMode({ vw, vh } = viewport()) {
  return hubMode({ vw, vh, headerH: vh <= 480 ? HEADER_H.phone : HEADER_H.desk });
}

export function render(root, params = {}) {
  const { el, body } = screen('Titan Trials', { cls: 'tt-screen hb-screen' });
  el.insertBefore(hubBackdrop('titans'), el.firstChild);
  root.appendChild(el);
  warmBattle(); // [transitions] Fight / Practice then cut to a battle whose code is already here, like stage prep
  const profile = () => store.profile;
  let selected = TITAN_MAP[params.id] ? params.id : suggestedTitan(profile()).titanId;
  const pick = {}; // titanId → { tier, rank }
  let drawn = null; // the host mode on screen

  const draw = () => {
    clear(body);
    const p = profile();
    const mode = titanHostMode();
    drawn = mode;
    if (!titansUnlocked(p)) {
      // (her stand, or as a chip the row over the lock panel: the same place as on the open screen)
      const host = hubHost('titans', p, { state: titansState(p), mode });
      const top = h('div.tt-top.tt-top-locked');
      const hb = h('div.hb.tt-hb', h('div.hb-main', h('div.tt-wrap', mode === 'chip' ? top : null, h('section.panel.tt-locked', { 'data-testid': 'titans-locked' },
        svgEl(uiIcon('lock'), 'ma-inline-icon'), h('b', `Clear ${TIER_STAGE.normal} to open Titan Trials`),
        h('p.muted', 'Four giant titans, a new fight every week: their drops open level gates past 60.')))));
      body.appendChild(hb);
      placeHost(host, mode, { hb, slot: mode === 'chip' ? top : null });
      return;
    }
    const keys = keyState(p);
    const now = Date.now();
    // [ui-m5] the host: Kaede, on the collapse rule (the stand beside everything, or the chip at the start of the top row)
    const host = hubHost('titans', p, { state: titansState(p, { now }), mode });
    const top = h('div.tt-top',
      h('span.tt-chip', { 'data-testid': 'titan-keys', title: `Trial Keys: ${keys.weekly} a week, up to 6 unused carry over${keys.saved ? ` (${keys.saved} saved)` : ''}` }, svgEl(uiIcon('key'), 'ma-inline-icon'), h('b.num', `${keys.left}/${keys.weekly}`)),
      // [ui-m5] the countdown chip (§5.9): the weekly key reset is a recurring cycle (never red); at zero, the new week
      countdownChip(keys.resetsAt - now, { label: 'Resets in', urgent: false, doneText: 'Reset!', onDone: draw, testid: 'titan-reset' }),
      h('span.tt-chip', { title: 'Assault Tokens' }, svgEl(itemIcon('token_boss'), 'tt-chip-ico'), h('b.num', formatNumber(itemCount(p, 'token_boss')))),
      button('Titan shelf', { kind: 'ghost', small: true, icon: 'mall', testid: 'titan-shelf', onClick: () => navigate('mall', { tab: 'boss' }) }),
    );
    const cards = h('div.tt-cards', TITANS.map((t) => titanCard(p, t, now)));
    const wrap = h('div.tt-wrap', top, cards, detail(p, selected));
    const hb = h('div.hb.tt-hb', h('div.hb-main', wrap));
    body.appendChild(hb);
    placeHost(host, mode, { hb, slot: top });
  };

  function titanCard(p, t, now) {
    const s = titanSummary(p, t.id, now);
    const weak = t.weak[0];
    // the titan of the week: a yellow ★ on her token on every card size (the "Titan of the Week" kicker only where the
    // card has room for three lines: the M5b review found her name squeezed out on phones)
    return h(`button.tt-card${t.id === selected ? '.active' : ''}${s.ofWeek ? '.week' : ''}`, { 'data-testid': `titan-${t.id}`, title: s.ofWeek ? 'Titan of the Week' : null, onclick: () => { selected = t.id; rememberParams('titans', { id: t.id }); draw(); } },
      h('div.tt-card-art', { html: themeBackdropSVG(themeOf(t)) }),
      h('div.tt-card-token', enemyToken(t.enemy, { size: 34 }), s.ofWeek ? h('span.tt-star', { role: 'img', 'aria-label': 'Titan of the Week' }, '★') : null),
      h('div.tt-card-text',
        s.ofWeek ? h('span.tt-week', '★ Titan of the Week') : null,
        h('b.tt-card-name', t.name),
        h('span.tt-card-sub', `Weak: ${ATTACK_TYPES[weak[0]]?.name || weak[0]} ×${weak[1]}`)),
    );
  }

  /** Details (P1): everything about the titan and the rules that is not needed to pick and fight. */
  function titanSheet(p, t) {
    const weakTypes = t.weak.map(([k]) => k);
    const shining = UNITS.filter((u) => p.units?.[u.id] && weakTypes.includes(u.attackType)).slice(0, 4)
      .map((u) => `${u.name} P${potentialLevel(p.units[u.id])}`);
    openSheet({
      title: t.name,
      testid: 'titan-details',
      cls: 'tt-sheet',
      body: h('div.tt-sheet-body',
        h('p.tt-line', h('b', 'Weak: '), t.weak.map(([k, m]) => `${ATTACK_TYPES[k]?.name || k} ×${m}`).join(' · ')),
        h('p.tt-line', h('b', 'Resists: '), t.resists.map(([k, m]) => `${ATTACK_TYPES[k]?.name || k} ×${m}`).join(' · ')),
        h('p.tt-line', shining.length ? `Your girls: ${shining.join(' · ')}` : 'None of your girls hits her weakness yet.'),
        h('p.tt-line.muted', t.blurb),
        h('p.tt-line', 'Bronze 25% · Silver 50% · Gold 75% of her HP pay part of the rewards; a win adds the Victory Chest.'),
        h('p.tt-line.muted', `The Rainbow Meter opens at Mayhem: a Rainbow Gear Box at the latest on the ${RAINBOW_METER}th Mayhem win.`),
      ),
    });
  }

  function detail(p, id) {
    const t = TITAN_MAP[id];
    const s = titanSummary(p, id);
    const cur = pick[id] || (s.top ? { tier: s.top.tier, rank: s.top.rank } : { tier: 'normal', rank: 0 });
    pick[id] = cur;
    const open = tierOpen(p, id, cur.tier, cur.rank);
    const lock = tierLock(p, id, cur.tier, cur.rank);
    const keys = keyState(p);
    const pool = titanPoolHp(id, cur.tier, cur.rank);
    const odds = chestOdds(cur.tier, cur.rank);
    const fc = firstClearTable(cur.tier, cur.rank);
    const fcDone = !!p.missions?.counters?.[`tfc:${id}:${tierStep(cur.tier, cur.rank)}`];
    const need = autoTarget(p, id).need;
    const fam = s.target;

    const art = h('div.tt-show',
      h('div.tt-show-bg', { html: themeBackdropSVG(themeOf(t)) }),
      h('div.tt-show-token', enemyToken(t.enemy, { size: 96 })),
      h('div.tt-show-plate', h('b', t.name), h('span', t.arena)),
      h('div.tt-show-more', moreSticker(() => titanSheet(p, t), { testid: 'titan-more', label: `More about ${t.name}` })),
    );

    // target family chips (the girl whose next gate needs it is named)
    const chips = h('div.tt-row', h('span.tt-label', 'Target'), t.families.map((f) => h(`button.chip.tt-fam${f === fam ? '.on' : ''}`, {
      'data-testid': `titan-target-${f}`,
      onclick: () => { setTargetFamily(p, id, f); store.commit('titan-target'); draw(); },
    }, svgEl(itemIcon(zenithId(f)), 'tt-chip-ico'), MATERIAL_FAMILIES[f]?.name || f)));
    const needLine = need ? h('p.tt-need', { 'data-testid': 'titan-need' }, `${UNIT_MAP[need.unitId].name} · Gate ${need.gate} needs ${need.missing.slice(0, 2).map((m) => `${m.need - m.have} ${ITEMS[m.id]?.name || m.id}`).join(', ')}`) : null;

    // tier chips (+ the Mayhem rank stepper)
    const tierRow = h('div.tt-row.tt-tiers', TITAN_TIERS.map((tier) => {
      const o = tierOpen(p, id, tier, tier === 'mayhem' ? Math.min(cur.rank, Math.max(0, (s.top?.rank) || 0)) : 0);
      const won = s.best && s.best.step >= tierStep(tier);
      return h(`button.chip.tt-tier${cur.tier === tier ? '.on' : ''}${o ? '' : '.locked'}`, {
        'data-testid': `titan-tier-${tier}`,
        title: o ? '' : tierLock(p, id, tier, 0) || '',
        onclick: () => { pick[id] = { tier, rank: tier === 'mayhem' ? Math.max(0, (s.top?.tier === 'mayhem' ? s.top.rank : 0)) : 0 }; draw(); },
      }, won ? '✓ ' : '', tierLabel(tier), o ? null : svgEl(uiIcon('lock'), 'ma-inline-icon'));
    }),
    cur.tier === 'mayhem' ? h('span.tt-rank',
      h('button.chip', { onclick: () => { cur.rank = Math.max(0, cur.rank - 1); draw(); }, disabled: cur.rank <= 0 }, '−'),
      h('b', `+${cur.rank}`),
      h('button.chip', { onclick: () => { cur.rank = Math.min(MAX_RANK, cur.rank + 1); draw(); }, disabled: cur.rank >= MAX_RANK }, '+')) : null);

    // the Rainbow Meter only once it runs (P7: an irrelevant state is hidden; the sheet says when it opens)
    const meter = s.meter.open
      ? h('div.tt-meter', { 'data-testid': 'titan-meter', title: 'A Rainbow Gear Box at the latest on the 40th Mayhem win' },
        h('span', 'Rainbow Meter'), h('span.tt-meter-bar', h('span', { style: { width: `${(s.meter.value / RAINBOW_METER) * 100}%` } })), h('b', `${s.meter.value}/${RAINBOW_METER}`))
      : null;
    const chest = odds ? [
      odds.legendary ? `Legendary ${odds.legendary >= 1 ? '×1' : pct(odds.legendary)}` : null,
      odds.zenith ? `Zenith ${pct(odds.zenith)}` : null,
      odds.crownShards ? `Crown Shard ${odds.crownShards >= 1 ? `×${odds.crownShards}` : pct(odds.crownShards)}` : null,
      odds.crown ? `Rainbow Crown ${pct(odds.crown)}` : null,
      odds.rainbow ? `Rainbow box ${pct(odds.rainbow)}` : null,
      odds.celestial ? `Legendary box ${pct(odds.celestial)}` : null,
    ].filter(Boolean).join(' · ') : '';
    const sweepOk = canSweepTitan(p, id);
    const fightLabel = !open ? 'Practice' : keys.left < 1 ? 'No keys · Practice' : 'Fight · 1 key';
    const go = (practice) => navigate('battle', { titan: id, tier: cur.tier, ...(cur.tier === 'mayhem' ? { rank: cur.rank } : {}), ...(practice ? { practice: 1 } : {}) });
    const fight = button(fightLabel, { kind: 'yellow', icon: 'assault', testid: 'titan-fight', onClick: () => go(!open || keys.left < 1) });
    fight.setAttribute('data-primary', '');
    fight.appendChild(kbdHint('Space'));
    // the actions: a row under the detail that stays in view (sticky at the bottom of the scroll, as Bounty's and Total
    // Assault's footers; the review found Practice and Sweep under the fold on small phones): Practice, Sweep (the
    // secondary button, §5.5; when it can't run, its lock and the reason on one line) and Fight, the one yellow
    const actions = h('div.tt-actions', { 'data-testid': 'titan-actions' },
      open ? button('Practice', { kind: 'ghost', small: true, testid: 'titan-practice', onClick: () => go(true) }) : null,
      secondaryBtn(sweepOk.ok ? `Sweep · ${s.best.label}` : 'Sweep', {
        icon: 'ff2', testid: 'titan-sweep', disabled: !sweepOk.ok, reason: sweepOk.ok ? null : sweepOk.reason,
        onClick: () => {
          const r = sweepTitan(store.profile, id, { seed: Date.now() });
          if (!r.ok) {
            toast(r.error || 'Sweep unavailable', 'bad');
            return;
          }
          store.commit('titan-sweep');
          for (const f of r.fused || []) toast(f.id === 'crown_rainbow' ? 'A Rainbow Crown! Gate 9 or 10 can open.' : `${ITEMS[f.id]?.name} fused!`, 'good', 4200);
          showRewardsModal({ title: `Sweep · ${t.name} ${r.label}`, rewards: r.rewards, gear: r.gear, note: r.box === 'rainbow' ? 'A Rainbow Gear Box! It waits in your Backpack.' : `Trial Keys left: ${r.keysLeft}` });
          draw();
        },
      }),
      fight,
    );
    const side = h('div.tt-side',
      chips, needLine, tierRow,
      h('p.tt-line', { 'data-testid': 'titan-hp' }, h('b', `HP ${big(pool)}`), s.best ? ` · Best ${s.best.label}` : '', open ? '' : h('span.tt-lock', ` · ${lock}`)),
      chest ? h('p.tt-line', { 'data-testid': 'titan-chest' }, h('b', 'Victory Chest: '), chest) : null,
      fc && !fcDone ? h('p.tt-line.muted', `First clear: ${[fc.gems ? `${fc.gems} gems` : null, ...fc.items.map(([iid, n]) => fcLine(iid, n))].filter(Boolean).join(', ')}`) : null,
      meter,
    );
    // (her weakness is on her card above: said once, P7; the rest is behind MORE)
    return [h('div.tt-detail', h('div.tt-main', art), side), actions];
  }

  draw();
  const off = store.on('change', (e) => { if (e?.reason === 'replace') draw(); });
  // a resize that flips the collapse rule (a phone turned, a window resized) draws Kaede in her other place
  const offResize = watchHostMode(el, () => drawn, () => titanHostMode(), draw);
  return () => {
    off();
    offResize();
  };
}

function themeOf(t) {
  try {
    return getMap(t.mapId).theme;
  } catch {
    return 'night';
  }
}

/** Lobby / hub line: "4 titans · ★ Gloom Regent". */
export function titansTileSub(now = Date.now()) {
  return `4 titans · ★ ${TITAN_MAP[titanOfWeek(now)].name}`;
}
