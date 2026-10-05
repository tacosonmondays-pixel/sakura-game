// Campaign map picker (owner: meta-a). Route: #/campaign?chapter=3
// Bloons TD6-style: chapter tabs grouped by map tier, a themed chapter banner and
// stage cards with stageThumbSVG, a medals row in the corner, lock states with the
// requirement, "New mechanic" badges and free-recruit badges.
import '../styles/meta-a.css';
import { h, clear, screen, svgEl } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { CHAPTERS, STAGE_MAP, CAMPAIGN_IDS } from '../../data/stages.js';
import { getMap } from '../../data/maps.js';
import { ENEMY_MAP } from '../../data/enemies.js';
import { UNIT_MAP } from '../../data/units.js';
import { MAP_TIERS, TRAITS, DIFFICULTY_ORDER } from '../../data/types.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { themeBackdropSVG } from '../../art/backdrops.js';
import { uiIcon, medalIcon, traitIcon } from '../../art/icons.js';
import { cardArtSVG } from '../../art/cardArt.js';
import { isStageUnlocked, chapterProgress, nextStage, stageMedals } from '../../systems/unlocks.js';
import { medalRow, requirementText, cssVar, rememberParams } from './stage.js';

const TIER_KEYS = Object.keys(MAP_TIERS);

export function render(root, params = {}) {
  const { el, body } = screen('Mission', { cls: 'ma-campaign-screen' });
  root.appendChild(el);
  const profile = store.profile;
  const next = nextStage(profile);
  const defaultChapter = next ? STAGE_MAP[next].chapter : CHAPTERS[CHAPTERS.length - 1].id;
  let chapterId = CHAPTERS.some((c) => c.id === Number(params.chapter)) ? Number(params.chapter) : defaultChapter;

  const tabsHost = h('div.ma-chapter-tabs-host');
  const content = h('div.ma-chapter-content');
  body.append(campaignSummary(profile), tabsHost, content);

  const select = (id) => {
    chapterId = id;
    // Keep the URL (and the router's back stack) on the chosen chapter.
    rememberParams('campaign', { chapter: String(id) });
    drawTabs();
    drawChapter();
  };

  const drawTabs = () => {
    clear(tabsHost);
    const row = h('nav.ma-chapter-tabs', { role: 'tablist' });
    for (const tier of TIER_KEYS) {
      const chapters = CHAPTERS.filter((c) => c.tier === tier);
      if (!chapters.length) continue;
      const group = h('div.ma-tier-group', h('div.ma-tier-label', { style: { color: MAP_TIERS[tier].color } }, MAP_TIERS[tier].name));
      const list = h('div.ma-tier-tabs');
      for (const c of chapters) {
        const prog = chapterProgress(profile, c.id);
        const locked = !isStageUnlocked(profile, c.stages[0]);
        const active = c.id === chapterId;
        const tab = h(
          `button.ma-chapter-tab${active ? '.active' : ''}${locked ? '.locked' : ''}`,
          { role: 'tab', 'aria-selected': active ? 'true' : 'false', 'data-testid': `chapter-${c.id}`, onclick: () => select(c.id) },
          h('span.ma-ct-num', `${c.id}`),
          h('span.ma-ct-text', h('span.ma-ct-name', c.name), h('span.ma-ct-prog', locked ? 'Locked' : `${prog.cleared}/${prog.total} cleared`)),
          locked ? svgEl(uiIcon('lock'), 'ma-ct-lock') : prog.cleared === prog.total ? svgEl(medalIcon(bestChapterMedal(prog)), 'ma-ct-medal') : null,
        );
        cssVar(tab, '--tier', MAP_TIERS[tier].color);
        list.appendChild(tab);
      }
      group.appendChild(list);
      row.appendChild(group);
    }
    tabsHost.appendChild(row);
    queueMicrotask(() => row.querySelector('.active')?.scrollIntoView?.({ block: 'nearest', inline: 'center' }));
  };

  const drawChapter = () => {
    clear(content);
    const chapter = CHAPTERS.find((c) => c.id === chapterId);
    content.appendChild(chapterBanner(profile, chapter));
    const grid = h('div.ma-stage-grid');
    chapter.stages.forEach((id, i) => {
      const card = stageCard(profile, id, { isNext: id === next });
      card.style.animationDelay = `${i * 45}ms`;
      grid.appendChild(card);
    });
    content.appendChild(grid);
  };

  drawTabs();
  drawChapter();
}

function bestChapterMedal(prog) {
  const full = [...DIFFICULTY_ORDER].reverse().find((d) => prog.medals[d] >= prog.total);
  return full || 'easy';
}

function campaignSummary(profile) {
  const cleared = CAMPAIGN_IDS.filter((id) => DIFFICULTY_ORDER.some((d) => stageMedals(profile, id)[d])).length;
  const counts = Object.fromEntries(DIFFICULTY_ORDER.map((d) => [d, CAMPAIGN_IDS.filter((id) => stageMedals(profile, id)[d]).length]));
  return h(
    'div.ma-campaign-summary',
    h('div.ma-cs-main', h('span.ma-cs-big', `${cleared}`), h('span.ma-cs-of', `/ ${CAMPAIGN_IDS.length} stages cleared`)),
    h('div.ma-cs-medals', DIFFICULTY_ORDER.map((d) => h('span.ma-cs-medal', svgEl(medalIcon(d, { earned: counts[d] > 0 }), 'ma-cs-medal-icon'), `${counts[d]}`))),
  );
}

function chapterBanner(profile, chapter) {
  const prog = chapterProgress(profile, chapter.id);
  const locked = !isStageUnlocked(profile, chapter.stages[0]);
  const tier = MAP_TIERS[chapter.tier];
  const banner = h(
    `section.ma-chapter-banner${locked ? '.locked' : ''}`,
    h('div.ma-cb-art', { html: themeBackdropSVG(chapter.theme) }),
    h('div.ma-cb-shade'),
    h('div.ma-cb-text',
      h('div.ma-cb-kicker', h('span.ma-tier-badge', { style: { background: tier.color } }, tier.name), h('span', `Chapter ${chapter.id}`)),
      h('h2.ma-cb-name', chapter.name),
      h('p.ma-cb-desc', chapter.desc),
      h('div.ma-cb-mech', svgEl(uiIcon('info'), 'ma-inline-icon'), chapter.mechanic),
    ),
    h('div.ma-cb-progress',
      h('div.ma-cb-count', h('b', `${prog.cleared}`), `/${prog.total}`),
      h('div.ma-cb-medals', DIFFICULTY_ORDER.map((d) => h('span.ma-cb-medal', svgEl(medalIcon(d, { earned: prog.medals[d] > 0 }), 'ma-cb-medal-icon'), `${prog.medals[d]}`))),
    ),
    locked ? h('div.ma-cb-lock', svgEl(uiIcon('lock'), 'ma-inline-icon'), requirementText(profile, chapter.stages[0])) : null,
  );
  return banner;
}

/** New-mechanic label for a stage: first new trait, else first new enemy. */
function newMechanic(stage) {
  const intro = stage.introduces || [];
  const trait = intro.find((k) => TRAITS[k]);
  if (trait) return { icon: traitIcon(trait), text: TRAITS[trait].name };
  const enemy = intro.find((k) => ENEMY_MAP[k]);
  if (enemy) {
    const e = ENEMY_MAP[enemy];
    const t = Object.keys(e.traits || {})[0];
    return { icon: t && TRAITS[t] ? traitIcon(t) : null, text: e.name, enemy: true, boss: e.tier === 'boss' || e.tier === 'miniboss' };
  }
  return null;
}

function stageCard(profile, stageId, { isNext }) {
  const stage = STAGE_MAP[stageId];
  let map = null;
  try {
    map = getMap(stage.mapId);
  } catch {
    map = null;
  }
  const unlocked = isStageUnlocked(profile, stageId);
  const medals = stageMedals(profile, stageId);
  const cleared = DIFFICULTY_ORDER.some((d) => medals[d]);
  const mech = newMechanic(stage);
  const tier = MAP_TIERS[stage.tier];
  const unlocks = (stage.unlocks?.units || []).filter((id) => UNIT_MAP[id]);
  const isFinale = stage.id.endsWith('-5');

  const card = h(
    `button.ma-stage-card${unlocked ? '' : '.locked'}${isNext ? '.next' : ''}${cleared ? '.cleared' : ''}${isFinale ? '.finale' : ''}`,
    { 'data-testid': `stage-${stageId}`, onclick: () => navigate('stage', { id: stageId }) },
    h('div.ma-sc-top',
      h('div.ma-sc-thumb', { html: map ? stageThumbSVG(map, { width: 320, height: 200 }) : '' }),
      h('span.ma-sc-id', stage.id),
      isNext ? h('span.ma-sc-next', 'NEXT') : null,
      medalRow(profile, stageId, { size: 22, cls: 'ma-sc-medals' }),
    ),
    h('div.ma-sc-info',
      h('div.ma-sc-name', stage.name),
      h('div.ma-sc-meta',
        tier ? h('span.ma-sc-tier', { style: { color: tier.color } }, tier.name) : null,
        h('span.muted', `${stage.waves} waves`),
        isFinale ? h('span.ma-sc-boss', 'BOSS') : null,
      ),
      h('div.ma-sc-badges',
        mech ? h(`span.ma-sc-mech${mech.boss ? '.boss' : ''}`, mech.icon ? svgEl(mech.icon, 'ma-trait') : null, h('span', mech.enemy ? `New: ${mech.text}` : `New mechanic: ${mech.text}`)) : null,
        unlocks.map((id) => h('span.ma-sc-unlock', { title: `${UNIT_MAP[id].name} joins on first clear` }, h('span.ma-sc-unlock-art', { html: cardArtSVG(UNIT_MAP[id], { variant: 'thumb' }) }), `+${UNIT_MAP[id].name}`)),
      ),
    ),
    unlocked ? null : h('div.ma-sc-lock', svgEl(uiIcon('lock'), 'ma-sc-lock-icon'), h('span', requirementText(profile, stageId))),
  );
  return card;
}
