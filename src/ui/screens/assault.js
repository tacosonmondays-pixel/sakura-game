// Total Assault (owner: meta-a). Route: #/assault?boss=boss-lych
// Three boss arenas. Each card shows the boss (3D model — a black silhouette until the
// boss is discovered), stats, telegraphed phases, counters, and the crown-heavy drop
// table, then teleports into stage prep.
import '../styles/meta-a.css';
import { h, clear, screen, svgEl, button, toast } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { stagesOfKind } from '../../data/stages.js';
import { getMap } from '../../data/maps.js';
import { ENEMY_MAP, FAMILIES, enemyTraits } from '../../data/enemies.js';
import { TRAITS, ARMOR_CLASSES, CAPABILITIES, DIFFICULTIES } from '../../data/types.js';
import { themeBackdropSVG } from '../../art/backdrops.js';
import { traitIcon, armorClassIcon, capabilityIcon, uiIcon } from '../../art/icons.js';
import { isStageUnlocked, stageMedals } from '../../systems/unlocks.js';
import { canSweep, sweep, MAX_SWEEPS } from '../../systems/rewards.js';
import { medalRow, dropGrid, requirementText, showRewardsModal, uiRng, rememberParams } from './stage.js';

/** The boss a Total Assault stage is built around. */
function bossOf(stage) {
  const id = (stage.introduces || []).find((x) => ENEMY_MAP[x]?.tier === 'boss')
    || stage.waveGen.fixed.map((f) => f.enemy).find((x) => ENEMY_MAP[x]?.tier === 'boss');
  return ENEMY_MAP[id] || null;
}

function themeOf(stage) {
  try {
    return getMap(stage.mapId).theme;
  } catch {
    return 'night';
  }
}

export function render(root, params = {}) {
  const { el, body } = screen('Total Assault', { cls: 'ma-assault-screen' });
  root.appendChild(el);
  const stages = stagesOfKind('boss');
  let selected = stages.some((s) => s.id === params.boss) ? params.boss : (stages.find((s) => isStageUnlocked(store.profile, s.id)) || stages[0]).id;
  let viewerState = null;

  const cards = h('div.ma-boss-cards');
  const detail = h('div.ma-boss-detail');
  body.append(h('div.ma-wrap', cards, detail));

  const drawCards = () => {
    clear(cards);
    const profile = store.profile;
    stages.forEach((s, i) => {
      const boss = bossOf(s);
      const unlocked = isStageUnlocked(profile, s.id);
      const c = h(`button.ma-boss-card${s.id === selected ? '.active' : ''}${unlocked ? '' : '.locked'}`,
        { onclick: () => select(s.id), 'data-testid': `boss-${s.id}` },
        h('div.ma-boss-card-art', { html: themeBackdropSVG(themeOf(s)) }),
        h('div.ma-boss-card-shade'),
        h('div.ma-boss-card-text',
          h('span.ma-boss-kicker', 'BOSS'),
          h('span.ma-boss-card-name', boss?.name || s.name),
          h('span.ma-boss-card-sub', unlocked ? `HP ${formatNumber(Math.round((boss?.hp || 0) * s.hpScale))}` : requirementText(profile, s.id)),
        ),
        unlocked ? medalRow(profile, s.id, { size: 18, cls: 'ma-boss-card-medals' }) : svgEl(uiIcon('lock'), 'ma-boss-card-lock'),
      );
      c.style.animationDelay = `${i * 60}ms`;
      cards.appendChild(c);
    });
  };

  const select = (id) => {
    selected = id;
    rememberParams('assault', { boss: id });
    drawCards();
    drawDetail();
  };

  const drawDetail = () => {
    const profile = store.profile;
    const stage = stages.find((s) => s.id === selected);
    const boss = bossOf(stage);
    const unlocked = isStageUnlocked(profile, stage.id);
    const discovered = !!profile.bestiary?.[boss?.id]?.discovered;
    clear(detail);
    if (!boss) return;
    const traits = enemyTraits(boss);
    const medals = stageMedals(profile, stage.id);
    const sweepDiff = medals.nightmare ? 'nightmare' : medals.hard ? 'hard' : null;

    const viewerHost = h('div.ma-boss-viewer');
    const show = h('div.ma-boss-show',
      h('div.ma-boss-show-bg', { html: themeBackdropSVG(themeOf(stage)) }),
      viewerHost,
      h('div.ma-boss-plate',
        h('span.ma-boss-family', FAMILIES[boss.family]?.name || boss.family),
        h('span.ma-boss-name', boss.name),
        discovered ? null : h('span.ma-boss-undisc', svgEl(uiIcon('eye'), 'ma-inline-icon'), 'Silhouette until defeated'),
      ),
    );
    mountBoss(viewerHost, boss, discovered);

    const statRow = h('div.ma-facts',
      fact('HP', formatNumber(Math.round(boss.hp * stage.hpScale))),
      fact('Armor', h('span.ma-inline', svgEl(armorClassIcon(boss.armorClass), 'ma-inline-icon'), `${ARMOR_CLASSES[boss.armorClass]?.name || boss.armorClass}${boss.armor ? ` · ${boss.armor}` : ''}`)),
      fact('Speed', `${boss.speed} t/s`),
      fact('Waves', `${stage.waves} · boss on ${Math.max(...stage.waveGen.fixed.filter((f) => f.enemy === boss.id).map((f) => f.wave))}`),
    );

    const info = h('div.ma-boss-info',
      h('section.panel',
        h('h3.panel-title', 'Boss intel'),
        h('p.ma-boss-lore', boss.lore),
        statRow,
        h('div.ma-sub', 'Traits'),
        h('ul.ma-trait-list', traits.map((t) => h('li', svgEl(traitIcon(t), 'ma-trait-lg'), h('div', h('b', TRAITS[t]?.name || t), h('div.muted', TRAITS[t]?.desc || ''))))),
        boss.phases?.length ? h('div', h('div.ma-sub', 'Phases'), h('ol.ma-phase-track', boss.phases.map((p) => h('li', h('span.ma-phase-hp', `${Math.round(p.atHp * 100)}%`), h('span', p.announce))))) : null,
        h('p.ma-counter-tip', svgEl(uiIcon('info'), 'ma-inline-icon'), boss.counters),
        stage.recommended?.length ? h('div.ma-rec-chips', stage.recommended.map((c) => h('span.chip', svgEl(capabilityIcon(c)), CAPABILITIES[c]?.name || c))) : null,
      ),
      h('section.panel',
        h('h3.panel-title', 'Drops'),
        h('p.muted', 'Crowns awaken students. Assault Tokens buy more crowns in the Mall\'s Boss Exchange.'),
        dropGrid(stage, sweepDiff || 'normal'),
      ),
      h('div.ma-prep-actions',
        unlocked && canSweep(profile, stage.id)
          ? button(`Sweep ×${MAX_SWEEPS} · ${DIFFICULTIES[sweepDiff].name}`, {
            kind: 'primary',
            icon: 'ff2',
            onClick: () => {
              const r = sweep(profile, stage.id, sweepDiff, MAX_SWEEPS, uiRng());
              if (!r.ok) {
                toast('Sweep unavailable', 'bad');
                return;
              }
              store.commit('sweep');
              showRewardsModal({ title: `Sweep ×${r.runs.length}`, rewards: r.rewards, gear: r.gear, note: stage.name });
            },
          })
          : null,
        button('Mall · Boss Exchange', { kind: 'ghost', icon: 'mall', onClick: () => navigate('mall', { tab: 'boss' }) }),
        unlocked
          ? button('Challenge', { kind: 'yellow', icon: 'assault', testid: 'assault-go', onClick: () => navigate('stage', { id: stage.id }) })
          : h('span.ma-locked-note', svgEl(uiIcon('lock'), 'ma-inline-icon'), requirementText(profile, stage.id)),
      ),
    );
    detail.append(h('div.ma-boss-layout', show, info));
  };

  function mountBoss(host, boss, discovered) {
    viewerState?.dispose();
    viewerState = null;
    const token = {};
    viewerState = { token, dispose: () => {} };
    import('../../models/index.js').then((models) => {
      if (viewerState?.token !== token) return;
      const viewer = models.createModelViewer(host, { background: null, autoRotate: true });
      const obj = models.buildEnemy(boss, { quality: store.profile.settings?.quality || 'medium' });
      if (!discovered) models.makeSilhouette(obj);
      viewer.setObject(obj);
      viewerState.dispose = () => {
        viewer.dispose();
        models.disposeObject(obj);
      };
    }).catch((e) => {
      console.warn('[assault] boss model unavailable', e);
      host.appendChild(h('div.ma-boss-fallback', svgEl(traitIcon(enemyTraits(boss)[0] || 'summoner'))));
    });
  }

  drawCards();
  drawDetail();
  return () => {
    viewerState?.dispose();
    viewerState = null;
  };
}

function fact(label, value) {
  return h('div.ma-fact', h('div.ma-fact-label', label), h('div.ma-fact-value', value));
}
