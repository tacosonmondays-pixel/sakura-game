// Tactical Challenge (owner: meta-a). Endless mode: the Colosseum challenge stage plus
// endless runs on every campaign map you have cleared, each with its best wave.
// Endless map runs open stage prep with `endless=1` (battle receives ?endless=1).
import '../styles/meta-a.css';
import { h, clear, screen, svgEl, button } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { STAGE_MAP, CHAPTERS } from '../../data/stages.js';
import { getMap } from '../../data/maps.js';
import { MAP_TIERS } from '../../data/types.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { themeBackdropSVG } from '../../art/backdrops.js';
import { uiIcon, medalIcon } from '../../art/icons.js';
import { isStageUnlocked, canPlayEndless } from '../../systems/unlocks.js';
import { dropGrid, requirementText } from './stage.js';

const CHALLENGE_ID = 'challenge';

function safeMap(id) {
  try {
    return getMap(id);
  } catch {
    return null;
  }
}

/** Best endless wave on a stage (only counts runs that went past the normal wave count). */
export function endlessBest(profile, stage) {
  const best = profile.progress?.stages?.[stage.id]?.bestWave || 0;
  if (stage.kind === 'challenge') return best;
  return best > stage.waves ? best : 0;
}

export function render(root) {
  const { el, body } = screen('Tactical Challenge', { cls: 'ma-challenge-screen' });
  root.appendChild(el);
  const draw = () => {
    clear(body);
    body.appendChild(build());
  };
  draw();
  const off = store.on('change', (e) => { if (e?.reason === 'replace') draw(); });
  return () => off();
}

function build() {
  const profile = store.profile;
  const wrap = h('div.ma-wrap.ma-challenge');
  const stage = STAGE_MAP[CHALLENGE_ID];

  if (stage) {
    const map = safeMap(stage.mapId);
    const unlocked = isStageUnlocked(profile, stage.id);
    const best = endlessBest(profile, stage);
    wrap.appendChild(h('section.ma-colosseum',
      h('div.ma-col-art', { html: themeBackdropSVG(map?.theme || 'arena') }),
      h('div.ma-col-shade'),
      h('div.ma-col-text',
        h('span.ma-endless-badge', 'ENDLESS'),
        h('h2.ma-col-name', map?.name || stage.name),
        h('p.ma-col-desc', stage.desc),
        h('div.ma-col-actions',
          unlocked
            ? button('Prepare', { kind: 'yellow', icon: 'challenge', testid: 'challenge-go', onClick: () => navigate('stage', { id: stage.id }) })
            : h('span.ma-locked-note.ma-col-lock', svgEl(uiIcon('lock'), 'ma-inline-icon'), requirementText(profile, stage.id)),
        ),
      ),
      h('div.ma-col-best',
        h('div.ma-col-best-label', 'Best wave'),
        h('div.ma-col-best-val', { 'data-testid': 'challenge-best' }, best ? formatNumber(best) : '—'),
        h('div.ma-col-best-sub', best ? milestone(best) : 'No run yet'),
      ),
      map ? h('div.ma-col-map', { html: stageThumbSVG(map, { width: 320, height: 200 }) }) : null,
    ));
    wrap.appendChild(h('section.panel',
      h('h3.panel-title', 'Rewards per run'),
      dropGrid(stage, 'normal', { compact: true }),
      h('p.muted.ma-hint', 'Minibosses join every 10 waves (Slime Prince at 10, Orc General at 20 … the Ashwing Matriarch at 70). Losing still pays coins for every wave you held.'),
    ));
  }

  // Endless on campaign maps.
  const grid = h('div.ma-endless-grid');
  let any = false;
  for (const ch of CHAPTERS) {
    for (const id of ch.stages) {
      const s = STAGE_MAP[id];
      if (!s) continue;
      const cleared = canPlayEndless(profile, id); // = cleared on any difficulty (same rule as battle)
      any ||= cleared;
      const map = safeMap(s.mapId);
      const best = endlessBest(profile, s);
      const tier = MAP_TIERS[s.tier];
      grid.appendChild(h(`button.ma-endless-card${cleared ? '' : '.locked'}`,
        { onclick: () => cleared && navigate('stage', { id, endless: 1 }), disabled: !cleared, 'data-testid': `endless-${id}` },
        h('div.ma-ec-thumb', { html: map ? stageThumbSVG(map, { width: 240, height: 150 }) : '' }),
        h('span.ma-ec-id', id),
        best ? h('span.ma-ec-best', svgEl(medalIcon(best >= 50 ? 'nightmare' : best >= 40 ? 'hard' : best >= 30 ? 'normal' : 'easy'), 'ma-ec-medal'), `Wave ${best}`) : null,
        h('div.ma-ec-info', h('b', map?.name || s.name), h('span.muted', cleared ? (best ? `Endless best · wave ${best}` : `${tier?.name || ''} · no endless run yet`) : `Clear ${id} to unlock`)),
        cleared ? null : h('div.ma-ec-lock', svgEl(uiIcon('lock'), 'ma-inline-icon')),
      ));
    }
  }
  wrap.appendChild(h('section',
    h('h3.ma-section-title', 'Endless on campaign maps'),
    h('p.muted', 'Every map you clear can be replayed endlessly: the waves keep scaling past the last one. Your best wave on each map is recorded here.'),
    any ? grid : h('div.ma-empty-state', svgEl(uiIcon('map')), h('p', 'Clear your first campaign stage to unlock endless runs on its map.')),
  ));
  return wrap;
}

function milestone(best) {
  if (best >= 70) return 'Matriarch slayer';
  if (best >= 50) return 'Past the Grave Lych';
  if (best >= 30) return 'Past the Goblin Machine';
  if (best >= 10) return 'Past the Slime Prince';
  return 'Keep going!';
}
