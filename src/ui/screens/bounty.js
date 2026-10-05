// Bounty (owner: meta-a). Route: #/bounty?arena=res-books&tier=2
// Five resource arenas (books, coins, gear, two material lines) × tiers I–III. Pick an
// arena and tier to see the drops, enemy roster and counters, then teleport into stage
// prep — or sweep straight from here once the tier is cleared on Hard.
import '../styles/meta-a.css';
import { h, clear, screen, svgEl, button, toast } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { bountyArenas, STAGE_MAP, stageEnemies } from '../../data/stages.js';
import { getMap } from '../../data/maps.js';
import { CAPABILITIES, DIFFICULTIES, DIFFICULTY_ORDER, MAP_TIERS } from '../../data/types.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { themeBackdropSVG } from '../../art/backdrops.js';
import { capabilityIcon, uiIcon, itemIcon } from '../../art/icons.js';
import { isStageUnlocked, stageMedals } from '../../systems/unlocks.js';
import { canSweep, sweep, MAX_SWEEPS } from '../../systems/rewards.js';
import { currentEvent } from '../../systems/missions.js';
import { medalRow, dropGrid, enemyChip, requirementText, showRewardsModal, uiRng, rememberParams } from './stage.js';

const ARENA_ICON = { 'res-books': 'book_rare', 'res-coins': 'coins', 'res-gear': 'gearbox_superRare', 'res-mats-a': 'mat_feather_superRare', 'res-mats-b': 'mat_rune_superRare' };
const ARENA_TAG = { 'res-books': 'Level-up books', 'res-coins': 'Coins', 'res-gear': 'Gear boxes · dice', 'res-mats-a': 'Feather · Blade · Ember · Rime', 'res-mats-b': 'Charm · Rune · Cog' };

export function render(root, params = {}) {
  const { el, body } = screen('Bounty', { cls: 'ma-bounty-screen' });
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

  const list = h('div.ma-arena-list');
  const detail = h('div.ma-arena-detail');
  body.append(h('div.ma-wrap.ma-bounty', list, detail));

  const remember = () => {
    rememberParams('bounty', { arena: arenaId, tier: stageId.slice(-1) });
  };

  const drawList = () => {
    clear(list);
    arenas.forEach((a, i) => {
      const isEvent = a.id === event.arena;
      const unlocked = isStageUnlocked(profile, a.stages[0]);
      let map = null;
      try { map = getMap(a.mapId); } catch { map = null; }
      const cleared = a.stages.filter((id) => DIFFICULTY_ORDER.some((d) => stageMedals(profile, id)[d])).length;
      const b = h(`button.ma-arena${a.id === arenaId ? '.active' : ''}${unlocked ? '' : '.locked'}`,
        { onclick: () => { arenaId = a.id; pickTier(a); remember(); drawList(); drawDetail(); }, 'data-testid': `arena-${a.id}` },
        h('div.ma-arena-thumb', { html: map ? stageThumbSVG(map, { width: 200, height: 125 }) : '' }, svgEl(itemIcon(ARENA_ICON[a.id] || 'coins'), 'ma-arena-item')),
        h('div.ma-arena-text',
          h('div.ma-arena-name', a.name),
          h('div.ma-arena-tag', ARENA_TAG[a.id] || ''),
          h('div.ma-arena-prog.muted', unlocked ? `${cleared}/3 tiers cleared` : requirementText(profile, a.stages[0])),
        ),
        isEvent ? h('span.ma-event-badge.ma-arena-event', `${event.dropMul}×`) : null,
        unlocked ? null : svgEl(uiIcon('lock'), 'ma-arena-lock'),
      );
      b.style.animationDelay = `${i * 40}ms`;
      list.appendChild(b);
    });
    queueMicrotask(() => {
      const active = list.querySelector('.ma-arena.active');
      if (active && list.scrollWidth > list.clientWidth) list.scrollLeft = active.offsetLeft - 16;
    });
  };

  const drawDetail = () => {
    clear(detail);
    const arena = arenas.find((a) => a.id === arenaId);
    const stage = STAGE_MAP[stageId];
    const isEvent = arena.id === event.arena;
    const dropMul = isEvent ? event.dropMul : 1;
    let map = null;
    try { map = getMap(arena.mapId); } catch { map = null; }
    const unlocked = isStageUnlocked(profile, stageId);
    const medals = stageMedals(profile, stageId);
    const best = [...DIFFICULTY_ORDER].reverse().find((d) => medals[d]);
    const sweepDiff = medals.nightmare ? 'nightmare' : medals.hard ? 'hard' : null;

    const tiers = h('div.ma-tier-select', arena.stages.map((id, i) => {
      const s = STAGE_MAP[id];
      const un = isStageUnlocked(profile, id);
      const tierInfo = MAP_TIERS[s.tier];
      return h(`button.ma-tier-btn${id === stageId ? '.active' : ''}${un ? '' : '.locked'}`,
        { onclick: () => { stageId = id; remember(); drawDetail(); }, 'data-testid': `tier-${i + 1}` },
        h('span.ma-tier-num', ['I', 'II', 'III'][i]),
        h('span.ma-tier-meta', h('b', tierInfo?.name || ''), h('span.muted', un ? `HP ×${s.hpScale} · ${s.waves} waves` : requirementText(profile, id))),
        un ? medalRow(profile, id, { size: 16, cls: 'ma-tier-medals' }) : svgEl(uiIcon('lock'), 'ma-inline-icon'),
      );
    }));

    const enemies = stageEnemies(stage).slice(0, 14).map((id) => enemyChip(id, { hpScale: stage.hpScale }));

    detail.append(
      h('div.ma-arena-hero',
        h('div.ma-arena-hero-art', { html: themeBackdropSVG(map?.theme || 'sakura') }),
        map ? h('div.ma-arena-hero-map', { html: stageThumbSVG(map, { width: 320, height: 200 }) }) : null,
        h('div.ma-arena-hero-text',
          h('div.ma-arena-hero-name', arena.name),
          h('div.ma-arena-hero-desc', arena.desc),
          isEvent ? h('div.ma-event-note', h('span.ma-event-badge', `${event.dropMul}×`), `${event.name} — double drops this week`) : null,
        ),
      ),
      h('section.panel', h('h3.panel-title', 'Tier'), tiers),
      h('section.panel',
        h('h3.panel-title', `Drops · ${best ? DIFFICULTIES[best].name : 'Normal'}`),
        dropGrid(stage, best || 'normal', { dropMul }),
        h('p.muted.ma-hint', 'Hard and Nightmare add extra rolls with rarer items. Gear boxes open into real gear instantly.'),
      ),
      h('section.panel',
        h('h3.panel-title', 'Enemies & counters'),
        h('div.ma-enemy-list', enemies),
        stage.recommended?.length ? h('div.ma-rec-chips', stage.recommended.map((c) => h('span.chip', svgEl(capabilityIcon(c)), CAPABILITIES[c]?.name || c))) : null,
      ),
      h('div.ma-prep-actions',
        unlocked && canSweep(profile, stageId)
          ? button(`Sweep ×${MAX_SWEEPS} · ${DIFFICULTIES[sweepDiff].name}`, {
            kind: 'primary',
            icon: 'ff2',
            testid: 'bounty-sweep',
            onClick: () => {
              const r = sweep(profile, stageId, sweepDiff, MAX_SWEEPS, uiRng());
              if (!r.ok) {
                toast('Sweep unavailable', 'bad');
                return;
              }
              store.commit('sweep');
              showRewardsModal({ title: `Sweep ×${r.runs.length}`, rewards: r.rewards, gear: r.gear, note: `${stage.name} · ${DIFFICULTIES[sweepDiff].name}${isEvent ? ' · 2× event' : ''}` });
              drawDetail();
            },
          })
          : unlocked ? h('span.ma-sweep-lock', svgEl(uiIcon('lock'), 'ma-inline-icon'), 'Clear on Hard to unlock sweep') : null,
        unlocked
          ? button('Prepare', { kind: 'yellow', icon: 'teleport', testid: 'bounty-prepare', onClick: () => navigate('stage', { id: stageId }) })
          : h('span.ma-locked-note', svgEl(uiIcon('lock'), 'ma-inline-icon'), requirementText(profile, stageId)),
      ),
    );
    detail.querySelector('.ma-sweep-lock')?.setAttribute('title', `${formatNumber(MAX_SWEEPS)} instant runs once cleared on Hard`);
  };

  drawList();
  drawDetail();
  const off = store.on('change', (e) => { if (e?.reason === 'replace') { drawList(); drawDetail(); } });
  return () => off();
}
