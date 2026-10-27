// Campaign map picker (owner: meta-a). Route: #/campaign?chapter=3
// Chapter tabs grouped by map tier, a themed chapter banner and
// stage cards with stageThumbSVG, a medals row in the corner, lock states with the
// requirement and free-recruit badges.
// UI M5b (docs/specs/UI_DIRECTION.md §7 M5, P3): the tier names sit on plates (the tier's fill with navy letters,
// like the banner's), and a stage card holds at most 2 numbers: its id, its name, its medals, its tier and what it
// unlocks. The waves, the ribbon count, the map rule and the new mechanic leave the card: stage prep shows them all.
// Gate Arc (docs/CAMPAIGN.md "Act II"): a chapter draws one row per act (src/ui/screens/campaignActs.js); a chapter
// with Act I alone draws the plain grid with no header, exactly as before. A chapter whose Act II is open and
// untouched wears a yellow dot on its tab (something new inside) and a NEW sticker on the act's header.
import '../styles/meta-a.css';
import '../styles/hubs.css';
import { h, clear, screen, svgEl } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { CHAPTERS, STAGE_MAP, CAMPAIGN_IDS } from '../../data/stages.js';
import { getMap } from '../../data/maps.js';
import { withRuleMarks } from './stageModes.js';
import { chapterRibbons } from '../../systems/unlocks.js';
import { UNIT_MAP } from '../../data/units.js';
import { DIFFICULTY_ORDER, DIFFICULTIES } from '../../data/types.js';
import { MAP_TIER_VIEW } from '../../data/mapTierNames.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { themeBackdropSVG } from '../../art/backdrops.js';
import { uiIcon, medalIcon } from '../../art/icons.js';
import { portraitHTML } from '../../art/portraits.js';
import { isStageUnlocked, chapterProgress, nextStage, stageMedals } from '../../systems/unlocks.js';
import { medalRow, requirementText, cssVar, rememberParams, savedBadge } from './stage.js';
import { actRows, actRowHeader, chapterHasNewAct, actNewDot } from './campaignActs.js';

const TIER_KEYS = Object.keys(MAP_TIER_VIEW);

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
      // [ui-m5] the tier's name on its plate (the fill, navy letters: .ma-tier-badge)
      const group = h('div.ma-tier-group', h('div.ma-tier-label', h('span.ma-tier-badge.ma-tier-plate', { style: { background: MAP_TIER_VIEW[tier].color } }, MAP_TIER_VIEW[tier].name)));
      const list = h('div.ma-tier-tabs');
      for (const c of chapters) {
        const prog = chapterProgress(profile, c.id);
        const locked = !isStageUnlocked(profile, c.stages[0]);
        const active = c.id === chapterId;
        const newAct = !locked && chapterHasNewAct(profile, c);
        const tab = h(
          `button.ma-chapter-tab${active ? '.active' : ''}${locked ? '.locked' : ''}${newAct ? '.has-new-act' : ''}`,
          { role: 'tab', 'aria-selected': active ? 'true' : 'false', 'data-testid': `chapter-${c.id}`, onclick: () => select(c.id) },
          newAct ? actNewDot({ testid: `chapter-new-act-${c.id}` }) : null,
          h('span.ma-ct-num', `${c.id}`),
          // [ui-m5] say it once (P7): a cleared chapter shows its medal, a started one "n/m", an untouched one "New"
          h('span.ma-ct-text', h('span.ma-ct-name', c.name), h('span.ma-ct-prog', locked ? 'Locked' : prog.cleared === prog.total ? 'Cleared' : prog.cleared ? `${prog.cleared}/${prog.total} cleared` : 'New')),
          locked ? svgEl(uiIcon('lock'), 'ma-ct-lock') : prog.cleared === prog.total ? svgEl(medalIcon(bestChapterMedal(prog)), 'ma-ct-medal') : null,
        );
        cssVar(tab, '--tier', MAP_TIER_VIEW[tier].color);
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
    const rows = actRows(profile, chapter);
    let n = 0;
    const grid = (ids) => {
      const g = h('div.ma-stage-grid');
      ids.forEach((id) => {
        const card = stageCard(profile, id, { isNext: id === next });
        card.style.animationDelay = `${n++ * 45}ms`;
        g.appendChild(card);
      });
      return g;
    };
    // one act: the plain grid, no header (the screen as it always was); two: a header above each act's grid
    if (rows.length <= 1) content.appendChild(grid(rows[0]?.ids || chapter.stages));
    else for (const row of rows) content.appendChild(h(`section.ma-act-row.act-${row.act}`, { 'data-testid': `act-row-${chapter.id}-${row.act}` }, actRowHeader(row, chapter.id), grid(row.ids)));
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
    // [ui-m5] a medal not earned yet shows no "0" (P7)
    h('div.ma-cs-medals', DIFFICULTY_ORDER.map((d) => h('span.ma-cs-medal', svgEl(medalIcon(d, { earned: counts[d] > 0 }), 'ma-cs-medal-icon'), counts[d] ? `${counts[d]}` : null))),
  );
}

function chapterBanner(profile, chapter) {
  const prog = chapterProgress(profile, chapter.id);
  const locked = !isStageUnlocked(profile, chapter.stages[0]);
  const tier = MAP_TIER_VIEW[chapter.tier];
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
      // [ui-m5] a panel holds ≤ 4 numbers (P3): the medals light up here, their counts are on the stage cards below
      h('div.ma-cb-medals', DIFFICULTY_ORDER.map((d) => h('span.ma-cb-medal', { title: `${DIFFICULTIES[d].name}: ${prog.medals[d]}/${prog.total}` }, svgEl(medalIcon(d, { earned: prog.medals[d] > 0 }), 'ma-cb-medal-icon')))),
      // (the ribbon count is progress: hidden at 0 on a Glance surface, P7)
      (() => { const r = chapterRibbons(profile, chapter.id); return r.have ? h('span.ma-chapter-ribbons', { 'data-testid': `chapter-ribbons-${chapter.id}` }, `Ribbons ${r.have}/${r.total}`) : null; })(),
    ),
    locked ? h('div.ma-cb-lock', svgEl(uiIcon('lock'), 'ma-inline-icon'), requirementText(profile, chapter.stages[0])) : null,
  );
  return banner;
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
  const tier = MAP_TIER_VIEW[stage.tier];
  const unlocks = (stage.unlocks?.units || []).filter((id) => UNIT_MAP[id]);
  const isFinale = !!stage.finale;

  const card = h(
    `button.ma-stage-card${unlocked ? '' : '.locked'}${isNext ? '.next' : ''}${cleared ? '.cleared' : ''}${isFinale ? '.finale' : ''}`,
    { 'data-testid': `stage-${stageId}`, onclick: () => navigate('stage', { id: stageId }) },
    h('div.ma-sc-top',
      h('div.ma-sc-thumb', { html: map ? withRuleMarks(stageThumbSVG(map, { width: 320, height: 200 }), map, stage.rule, 320, 200) : '' }),
      h('span.ma-sc-id', stage.id),
      isNext ? h('span.ma-sc-next', 'NEXT') : null,
      medalRow(profile, stageId, { size: 22, cls: 'ma-sc-medals' }),
      unlocked ? savedBadge(profile, stageId) : null,
    ),
    h('div.ma-sc-info',
      h('div.ma-sc-name', stage.name),
      // [ui-m5] the tier on its plate and the boss tag; the waves, ribbons, rule and new mechanic are stage prep's
      h('div.ma-sc-meta',
        tier ? h('span.ma-tier-badge.ma-sc-tier', { style: { background: tier.color } }, tier.name) : null,
        isFinale ? h('span.ma-sc-boss', 'BOSS') : null,
      ),
      unlocks.length ? h('div.ma-sc-badges',
        unlocks.map((id) => h('span.ma-sc-unlock', { title: `${UNIT_MAP[id].name} joins on first clear` }, h('span.ma-sc-unlock-art', { html: portraitHTML(UNIT_MAP[id], 'thumb') }), `+${UNIT_MAP[id].name}`)),
      ) : null,
    ),
    unlocked ? null : h('div.ma-sc-lock', svgEl(uiIcon('lock'), 'ma-sc-lock-icon'), h('span', requirementText(profile, stageId))),
  );
  return card;
}
