// Bounty (owner: ui / meta-a). Route: #/bounty?arena=res-books&tier=2
// Blue Archive "Location Select": the secretary on the left, the five resource arenas as a
// list on the right (thumbnail, name, what it drops, Bounty Token yield, 2× event badge).
// Tapping a location expands it: tier I–III picker with medals, drops, enemies, and the
// Prepare / Sweep actions. The footer shows the Bounty Token balance and the Bounty Shop.
import '../styles/meta-a.css';
import { h, clear, screen, svgEl, button, toast, glyph } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { bountyArenas, STAGE_MAP, stageEnemies } from '../../data/stages.js';
import { getMap } from '../../data/maps.js';
import { CAPABILITIES, DIFFICULTIES, DIFFICULTY_ORDER, MAP_TIERS } from '../../data/types.js';
import { UNIT_MAP } from '../../data/units.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { hubBackdrop, hubStand, hubSecretary } from '../hubArt.js';
import { capabilityIcon, uiIcon, itemIcon, currencyIcon } from '../../art/icons.js';
import { isStageUnlocked, stageMedals } from '../../systems/unlocks.js';
import { canSweep, sweep, MAX_SWEEPS } from '../../systems/rewards.js';
import { currentEvent } from '../../systems/missions.js';
import { itemCount } from '../../systems/inventory.js';
import { medalRow, dropGrid, enemyChip, requirementText, showRewardsModal, uiRng, rememberParams } from './stage.js';

const ARENA_ICON = { 'res-books': 'book_rare', 'res-coins': 'coins', 'res-gear': 'gearbox_superRare', 'res-mats-a': 'mat_feather_superRare', 'res-mats-b': 'mat_rune_superRare' };
const ARENA_TAG = { 'res-books': 'Level-up books', 'res-coins': 'Coins', 'res-gear': 'Gear boxes · dice', 'res-mats-a': 'Feather · Blade · Ember · Rime', 'res-mats-b': 'Charm · Rune · Cog' };

/** Bounty Token yield of a stage ("×2–4") from its drop table. */
function tokenYield(stage) {
  const rolls = (stage.drops || []).filter((d) => d.item === 'token_bounty');
  if (!rolls.length) return null;
  const min = Math.min(...rolls.map((r) => r.min));
  const max = rolls.reduce((a, r) => a + r.max, 0);
  return min === max ? `×${min}` : `×${min}–${max}`;
}

export function render(root, params = {}) {
  const { el, body } = screen('Bounty', { cls: 'ma-bounty-screen ma-char-screen' });
  el.insertBefore(hubBackdrop(), el.firstChild);
  root.appendChild(el);

  const arenas = bountyArenas();
  const event = currentEvent();
  const profile = store.profile;
  let arenaId = arenas.some((a) => a.id === params.arena) ? params.arena : event.arena;
  const highestUnlocked = (a) => [...a.stages].reverse().find((id) => isStageUnlocked(profile, id)) || a.stages[0];
  let stageId = null;
  const pickTier = (a) => {
    const t = Number(params.tier);
    stageId = t >= 1 && t <= 3 && a.id === params.arena ? a.stages[t - 1] : highestUnlocked(a);
  };
  pickTier(arenas.find((a) => a.id === arenaId));

  const char = hubStand(hubSecretary(profile), { cls: 'ma-hub-char' });

  const list = h('div.ma-loc-list');
  const tokens = h('span.ma-loc-balance-val', { 'data-testid': 'bounty-tokens' });
  const footer = h('div.ma-loc-footer',
    h('div.ma-loc-balance', svgEl(currencyIcon('token_bounty'), 'ma-loc-balance-icon'), tokens, h('span.muted', 'Bounty Tokens')),
    button('Bounty Shop', { kind: 'yellow', icon: 'mall', testid: 'bounty-shop', onClick: () => navigate('mall', { tab: 'bounty' }) }),
  );
  const panelEl = h('section.panel.ma-loc-panel',
    h('h3.panel-title', 'Location Select', h('span.ma-loc-title-note', svgEl(glyph('info'), 'ma-inline-icon'), `${event.name} · ${event.dropMul}× drops this week`)),
    list,
    footer,
  );
  body.append(h('div.ma-hub.ma-bounty', char, h('div.ma-loc-col', panelEl)));

  const remember = () => rememberParams('bounty', { arena: arenaId, tier: stageId.slice(-1) });

  const drawList = () => {
    clear(list);
    tokens.textContent = formatNumber(itemCount(store.profile, 'token_bounty'));
    arenas.forEach((a, i) => {
      const active = a.id === arenaId;
      const isEvent = a.id === event.arena;
      const unlocked = isStageUnlocked(profile, a.stages[0]);
      let map = null;
      try { map = getMap(a.mapId); } catch { map = null; }
      const cleared = a.stages.filter((id) => DIFFICULTY_ORDER.some((d) => stageMedals(profile, id)[d])).length;
      const top = STAGE_MAP[a.stages[a.stages.length - 1]];
      const row = h(`button.ma-loc${active ? '.active' : ''}${unlocked ? '' : '.locked'}`,
        { onclick: () => { arenaId = a.id; pickTier(a); remember(); drawList(); }, 'data-testid': `arena-${a.id}`, 'aria-expanded': active ? 'true' : 'false' },
        h('div.ma-loc-thumb', { html: map ? stageThumbSVG(map, { width: 200, height: 125 }) : '' }, svgEl(itemIcon(ARENA_ICON[a.id] || 'coins'), 'ma-loc-item')),
        h('div.ma-loc-text',
          h('div.ma-loc-name', a.name, isEvent ? h('span.ma-event-badge', `${event.dropMul}×`) : null),
          h('div.ma-loc-desc', a.desc),
          h('div.ma-loc-meta',
            h('span.ma-loc-tag', ARENA_TAG[a.id] || ''),
            h('span.ma-loc-ticket', svgEl(currencyIcon('token_bounty'), 'ma-inline-icon'), `Bounty Token ${tokenYield(top) || '×1'}`),
            h('span.muted', unlocked ? `${cleared}/3 tiers cleared` : requirementText(profile, a.stages[0])),
          ),
        ),
        unlocked ? h('span.ma-loc-chev', svgEl(glyph('chevron'))) : svgEl(uiIcon('lock'), 'ma-loc-lock'),
      );
      row.style.animationDelay = `${i * 40}ms`;
      list.appendChild(row);
      if (active) {
        const detail = buildDetail(a);
        list.appendChild(detail);
      }
    });
    queueMicrotask(() => {
      const active = list.querySelector('.ma-loc.active');
      if (active && list.scrollHeight > list.clientHeight) list.scrollTop = Math.max(0, active.offsetTop - list.offsetTop - 6);
    });
  };

  const buildDetail = (arena) => {
    const stage = STAGE_MAP[stageId];
    const isEvent = arena.id === event.arena;
    const dropMul = isEvent ? event.dropMul : 1;
    const unlocked = isStageUnlocked(profile, stageId);
    const medals = stageMedals(profile, stageId);
    const best = [...DIFFICULTY_ORDER].reverse().find((d) => medals[d]);
    const sweepDiff = medals.nightmare ? 'nightmare' : medals.hard ? 'hard' : null;

    const tiers = h('div.ma-tier-select', arena.stages.map((id, i) => {
      const s = STAGE_MAP[id];
      const un = isStageUnlocked(profile, id);
      const tierInfo = MAP_TIERS[s.tier];
      return h(`button.ma-tier-btn${id === stageId ? '.active' : ''}${un ? '' : '.locked'}`,
        { onclick: (e) => { e.stopPropagation(); stageId = id; remember(); drawList(); }, 'data-testid': `tier-${i + 1}` },
        h('span.ma-tier-num', ['I', 'II', 'III'][i]),
        h('span.ma-tier-meta', h('b', tierInfo?.name || ''), h('span.muted', un ? `HP ×${s.hpScale} · ${s.waves} waves` : requirementText(profile, id))),
        un ? medalRow(profile, id, { size: 16, cls: 'ma-tier-medals' }) : svgEl(uiIcon('lock'), 'ma-inline-icon'),
      );
    }));
    const enemies = stageEnemies(stage).slice(0, 10).map((id) => enemyChip(id, { hpScale: stage.hpScale }));
    const actions = h('div.ma-loc-actions',
      unlocked && canSweep(profile, stageId)
        ? button(`Sweep ×${MAX_SWEEPS} · ${DIFFICULTIES[sweepDiff].name}`, {
          kind: 'primary', icon: 'ff2', testid: 'bounty-sweep',
          onClick: () => {
            const r = sweep(profile, stageId, sweepDiff, MAX_SWEEPS, uiRng());
            if (!r.ok) return toast('Sweep unavailable', 'bad');
            store.commit('sweep');
            showRewardsModal({ title: `Sweep ×${r.runs.length}`, rewards: r.rewards, gear: r.gear, note: `${stage.name} · ${DIFFICULTIES[sweepDiff].name}${isEvent ? ' · 2× event' : ''}` });
            drawList();
          },
        })
        : unlocked ? h('span.ma-sweep-lock', svgEl(uiIcon('lock'), 'ma-inline-icon'), 'Clear on Hard to unlock sweep') : null,
      unlocked
        ? button('Prepare', { kind: 'yellow', icon: 'teleport', testid: 'bounty-prepare', onClick: () => navigate('stage', { id: stageId }) })
        : h('span.ma-locked-note', svgEl(uiIcon('lock'), 'ma-inline-icon'), requirementText(profile, stageId)),
    );
    return h('div.ma-loc-detail',
      h('div.ma-loc-detail-grid',
        h('div', h('div.ma-sub', 'Tier'), tiers),
        h('div', h('div.ma-sub', `Drops · ${best ? DIFFICULTIES[best].name : 'Normal'}`), dropGrid(stage, best || 'normal', { dropMul, compact: true })),
      ),
      h('div.ma-loc-enemies', h('div.ma-sub', 'Enemies & counters'), h('div.ma-enemy-list', enemies),
        stage.recommended?.length ? h('div.ma-rec-chips', stage.recommended.map((c) => h('span.chip', svgEl(capabilityIcon(c)), CAPABILITIES[c]?.name || c))) : null),
      actions,
    );
  };

  drawList();
  const off = store.on('change', (e) => { if (e?.reason === 'replace' || e?.reason === 'sweep' || e?.reason === 'secretary') drawList(); });
  return () => off();
}
