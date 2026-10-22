// Titan Trials, the weekly bosses (docs/specs/ASCENSION.md §C, §D.3). Route: #/titans[?id=<titan>]
// Four titans: pick one, tap the family you need, pick a tier, then Fight (a Trial Key), Sweep (a
// key, pays your best solo Victory) or Practice (no key, no rewards). Built from the existing panels,
// chips and buttons; the numbers stay one short line each.
import '../styles/meta-a.css';
import '../styles/titans.css';
import '../styles/hubs.css';
import { h, clear, screen, svgEl, button, toast } from '../components.js';
import { navigate, rememberParams } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { countdownChip } from '../kit.js';
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

export function render(root, params = {}) {
  const { el, body } = screen('Titan Trials', { cls: 'tt-screen' });
  root.appendChild(el);
  warmBattle(); // [transitions] Fight / Practice then cut to a battle whose code is already here, like stage prep
  const profile = () => store.profile;
  let selected = TITAN_MAP[params.id] ? params.id : suggestedTitan(profile()).titanId;
  const pick = {}; // titanId → { tier, rank }

  const draw = () => {
    clear(body);
    const p = profile();
    if (!titansUnlocked(p)) {
      body.appendChild(h('div.tt-wrap', h('section.panel.tt-locked', { 'data-testid': 'titans-locked' },
        svgEl(uiIcon('lock'), 'ma-inline-icon'), h('b', `Clear ${TIER_STAGE.normal} to open Titan Trials`),
        h('p.muted', 'Four giant titans, a new fight every week: their drops open level gates past 60.'))));
      return;
    }
    const keys = keyState(p);
    const now = Date.now();
    const top = h('div.tt-top',
      h('span.tt-chip', { 'data-testid': 'titan-keys', title: 'Trial Keys: 12 a week, up to 6 unused carry over' }, svgEl(uiIcon('key'), 'ma-inline-icon'), h('b', `${keys.left}`), `/${keys.weekly}${keys.saved ? ` (+${keys.saved} saved)` : ''}`),
      countdownChip(keys.resetsAt - now, { label: 'Resets in', testid: 'titan-reset' }), // [ui-m5] the countdown chip (§5.9)
      h('span.tt-chip', svgEl(itemIcon('token_boss'), 'tt-chip-ico'), h('b', formatNumber(itemCount(p, 'token_boss')))),
      button('Titan shelf', { kind: 'ghost', small: true, icon: 'mall', testid: 'titan-shelf', onClick: () => navigate('mall', { tab: 'boss' }) }),
    );
    const cards = h('div.tt-cards', TITANS.map((t) => titanCard(p, t, now)));
    body.appendChild(h('div.tt-wrap', top, cards, detail(p, selected)));
  };

  function titanCard(p, t, now) {
    const s = titanSummary(p, t.id, now);
    const weak = t.weak[0];
    return h(`button.tt-card${t.id === selected ? '.active' : ''}${s.ofWeek ? '.week' : ''}`, { 'data-testid': `titan-${t.id}`, onclick: () => { selected = t.id; rememberParams('titans', { id: t.id }); draw(); } },
      h('div.tt-card-art', { html: themeBackdropSVG(themeOf(t)) }),
      h('div.tt-card-token', enemyToken(t.enemy, { size: 34 })),
      h('div.tt-card-text',
        s.ofWeek ? h('span.tt-week', '★ Titan of the Week') : null,
        h('b.tt-card-name', t.name),
        h('span.tt-card-sub', `Weak: ${ATTACK_TYPES[weak[0]]?.name || weak[0]} ×${weak[1]}${s.best ? ` · Best ${s.best.label}` : ''}`)),
    );
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
    const weakTypes = t.weak.map(([k]) => k);
    const shining = UNITS.filter((u) => p.units?.[u.id] && weakTypes.includes(u.attackType)).slice(0, 4)
      .map((u) => `${u.name} P${potentialLevel(p.units[u.id])}`);
    const need = autoTarget(p, id).need;
    const fam = s.target;

    const art = h('div.tt-show',
      h('div.tt-show-bg', { html: themeBackdropSVG(themeOf(t)) }),
      h('div.tt-show-token', enemyToken(t.enemy, { size: 96 })),
      h('div.tt-show-plate', h('b', t.name), h('span', t.arena)),
    );
    const info = h('div.tt-facts',
      h('p.tt-line', h('b', 'Weak: '), t.weak.map(([k, m]) => `${ATTACK_TYPES[k]?.name || k} ×${m}`).join(' · '), h('span.muted', ` · Resists ${t.resists.map(([k, m]) => `${ATTACK_TYPES[k]?.name || k} ×${m}`).join(', ')}`)),
      h('p.tt-line.muted', shining.length ? `Your girls: ${shining.join(' · ')}` : 'None of your girls hits her weakness yet.'),
      h('p.tt-line.muted', t.blurb),
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

    const meter = s.meter.open
      ? h('div.tt-meter', { 'data-testid': 'titan-meter', title: 'A Rainbow Gear Box at the latest on the 40th Mayhem win' },
        h('span', 'Rainbow Meter'), h('span.tt-meter-bar', h('span', { style: { width: `${(s.meter.value / RAINBOW_METER) * 100}%` } })), h('b', `${s.meter.value}/${RAINBOW_METER}`))
      : h('p.tt-line.muted', { 'data-testid': 'titan-meter' }, 'Rainbow Meter opens at Mayhem');
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
    const actions = h('div.tt-actions',
      button(fightLabel, { kind: 'yellow', icon: 'assault', testid: 'titan-fight', onClick: () => go(!open || keys.left < 1) }),
      button(sweepOk.ok ? `Sweep · ${s.best.label}` : 'Sweep', {
        kind: 'primary', icon: 'ff2', testid: 'titan-sweep', disabled: !sweepOk.ok, title: sweepOk.ok ? '' : sweepOk.reason,
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
      open ? button('Practice', { kind: 'ghost', small: true, testid: 'titan-practice', onClick: () => go(true) }) : null,
    );
    const side = h('div.tt-side',
      chips, needLine, tierRow,
      h('p.tt-line', { 'data-testid': 'titan-hp' }, h('b', `HP ${big(pool)}`), s.best ? ` · Best ${s.best.label}` : '', open ? '' : h('span.tt-lock', ` · ${lock}`)),
      h('p.tt-line.muted', 'Bronze 25% · Silver 50% · Gold 75% of her HP pay part of the rewards; a win adds the Victory Chest.'),
      chest ? h('p.tt-line', { 'data-testid': 'titan-chest' }, h('b', 'Victory Chest: '), chest) : null,
      fc ? h('p.tt-line.muted', fcDone ? 'First clear: done' : `First clear: ${[fc.gems ? `${fc.gems} gems` : null, ...fc.items.map(([iid, n]) => fcLine(iid, n))].filter(Boolean).join(', ')}`) : null,
      meter,
      actions,
    );
    return h('div.tt-detail', h('div.tt-main', art, info), side);
  }

  draw();
  const off = store.on('change', (e) => { if (e?.reason === 'replace') draw(); });
  return () => off();
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
