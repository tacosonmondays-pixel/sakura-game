// Campaign map picker (owner: meta-a). Route: #/campaign?chapter=3
// UI v2 M1 (docs/specs/UI_V2_MENUS.md §5 M1, the Campaign row of §3): the Ink & Paper kit.
//   - The chapter rail: every chapter as one slanted tab (its number and its state: a lock, the best medal held on all
//     five stages, or five progress pips), grouped under the map tiers' plates (the tier's fill, navy letters). It fits
//     the width at 844 px and up, so it never scrolls sideways.
//   - The chapter panel: the tier plate and "Chapter N", the chapter's name, its one-line mechanic, the cleared count
//     with five pips, the four medals lit when held, and the chapter's painting at the right (decorative).
//   - Stage cards as kit tiles: the map, the stage id on an ink plate, NEXT (the cyan "open" chip) or the lock chip
//     with its requirement, a saved battle's badge, then the name, the tier on its plate, the four medals and what the
//     first clear unlocks. At most 2 numbers a card (P3): the waves, ribbons, map rule and new mechanic are stage
//     prep's. No yellow on this screen: the card is itself the action (P2).
// Gate Arc (docs/CAMPAIGN.md "Act II"): a chapter draws one row per act (src/ui/screens/campaignActs.js); a chapter
// with Act I alone draws the plain grid with no header, exactly as before. A chapter whose Act II is open and
// untouched wears a yellow dot on its tab (something new inside) and a NEW sticker on the act's header. An echo
// stage's card (1-10) shows the stage it echoes faintly through its map, with a chip naming it.
import '../styles/meta-a.css';
import '../styles/hubs.css';
import '../styles/v2-stage.css';
import { h, clear, screen, svgEl } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { CHAPTERS, STAGE_MAP } from '../../data/stages.js';
import { getMap } from '../../data/maps.js';
import { withRuleMarks } from './stageModes.js';
import { UNIT_MAP } from '../../data/units.js';
import { DIFFICULTY_ORDER, DIFFICULTIES } from '../../data/types.js';
import { MAP_TIER_VIEW } from '../../data/mapTierNames.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { themeBackdropSVG } from '../../art/backdrops.js';
import { medalIcon } from '../../art/icons.js';
import { portraitHTML } from '../../art/portraits.js';
import { isStageUnlocked, chapterProgress, nextStage, stageMedals } from '../../systems/unlocks.js';
import { ico } from '../kit.js';
import { requirementText, rememberParams, savedBadge } from './stage.js';
import { actRows, actRowHeader, chapterHasNewAct, actNewDot, echoGhost } from './campaignActs.js';

const TIER_KEYS = Object.keys(MAP_TIER_VIEW);

export function render(root, params = {}) {
  const { el, body } = screen('Mission', { cls: 'ma-campaign-screen cp-screen' });
  root.appendChild(el);
  const profile = store.profile;
  const next = nextStage(profile);
  const defaultChapter = next ? STAGE_MAP[next].chapter : CHAPTERS[CHAPTERS.length - 1].id;
  let chapterId = CHAPTERS.some((c) => c.id === Number(params.chapter)) ? Number(params.chapter) : defaultChapter;

  const railHost = h('div.cp-rail-host');
  const content = h('div.cp-content');
  body.append(railHost, content);

  const select = (id) => {
    chapterId = id;
    // Keep the URL (and the router's back stack) on the chosen chapter.
    rememberParams('campaign', { chapter: String(id) });
    drawRail();
    drawChapter();
  };

  const drawRail = () => {
    clear(railHost);
    const rail = h('nav.cp-rail', { role: 'tablist', 'aria-label': 'Chapters' });
    for (const tier of TIER_KEYS) {
      const chapters = CHAPTERS.filter((c) => c.tier === tier);
      if (!chapters.length) continue;
      const view = MAP_TIER_VIEW[tier];
      const tabs = h('div.cp-tabs');
      for (const c of chapters) {
        const prog = chapterProgress(profile, c.id);
        const locked = !isStageUnlocked(profile, c.stages[0]);
        const done = prog.cleared === prog.total;
        const active = c.id === chapterId;
        const newAct = !locked && chapterHasNewAct(profile, c);
        // say it once (P7): a cleared chapter shows its best medal, a started or new one its pips, a locked one a lock
        const state = locked ? ico('lock', 'ui-ico.cp-tab-lock')
          : done ? svgEl(medalIcon(bestChapterMedal(prog)), 'cp-tab-medal')
            : h('span.cp-pips', { 'aria-hidden': 'true' }, Array.from({ length: prog.total }, (_, i) => h(`i${i < prog.cleared ? '.on' : ''}`)));
        tabs.appendChild(h(`button.ui-opt.ma-chapter-tab.cp-tab${active ? '.on.active' : ''}${locked ? '.locked' : ''}${newAct ? '.has-new-act' : ''}`, {
          type: 'button', role: 'tab', 'aria-selected': active ? 'true' : 'false', 'data-testid': `chapter-${c.id}`,
          'aria-label': `Chapter ${c.id}, ${c.name}: ${locked ? 'locked' : done ? 'cleared' : prog.cleared ? `${prog.cleared} of ${prog.total} cleared` : 'new'}${newAct ? ', a new act is open' : ''}`,
          title: `${c.id} · ${c.name}`,
          onclick: () => select(c.id),
        }, newAct ? actNewDot({ testid: `chapter-new-act-${c.id}` }) : null, h('span.num.cp-tab-n', String(c.id)), state));
      }
      const group = h('div.cp-group', { style: { '--n': String(chapters.length) } },
        h('span.cp-tier', { style: { '--tier': view.color } }, view.name), tabs);
      rail.appendChild(group);
    }
    railHost.appendChild(rail);
  };

  const drawChapter = () => {
    clear(content);
    const chapter = CHAPTERS.find((c) => c.id === chapterId);
    content.appendChild(chapterPanel(profile, chapter));
    // a side stage's small card right after its anchor (Gate Arc Step 6: the Starfall Trial after 6-10)
    const grid = (ids, sides = []) => h('div.cp-grid', ids.flatMap((id) => [
      stageCard(profile, id, { isNext: id === next }),
      ...sides.filter((x) => x.anchor === id).map((side) => sideCard(profile, side)),
    ]));
    // one act: the plain grid, no header; two: a header above each act's grid
    const rows = actRows(profile, chapter);
    if (rows.length <= 1) content.appendChild(grid(rows[0]?.ids || chapter.stages, rows[0]?.sides));
    else for (const row of rows) content.appendChild(h(`section.ma-act-row.cp-act.act-${row.act}`, { 'data-testid': `act-row-${chapter.id}-${row.act}` }, actRowHeader(row, chapter.id), grid(row.ids, row.sides)));
  };

  drawRail();
  drawChapter();
}

function bestChapterMedal(prog) {
  const full = [...DIFFICULTY_ORDER].reverse().find((d) => prog.medals[d] >= prog.total);
  return full || 'easy';
}

function chapterPanel(profile, chapter) {
  const prog = chapterProgress(profile, chapter.id);
  const locked = !isStageUnlocked(profile, chapter.stages[0]);
  const tier = MAP_TIER_VIEW[chapter.tier];
  return h(`section.ui-panel.cp-chapter${locked ? '.locked' : ''}`, { 'data-testid': 'chapter-panel' },
    h('div.cp-ch-text',
      h('div.cp-ch-head', h('span.cp-tier', { style: { '--tier': tier.color } }, tier.name), h('span.lbl.ink', `Chapter ${chapter.id}`), h('h2.cp-ch-name', chapter.name)),
      h('p.cp-ch-mech', chapter.mechanic)),
    h('div.cp-ch-side',
      h('div.cp-ch-art', { 'aria-hidden': 'true', html: themeBackdropSVG(chapter.theme) }),
      h('div.cp-ch-prog',
        locked
          ? h('span.cp-ch-lock', ico('lock'), requirementText(profile, chapter.stages[0]))
          : [
            h('span.cp-ch-count', h('span.num', `${prog.cleared}/${prog.total}`), h('span.lbl', 'Cleared')),
            // a panel holds ≤ 4 numbers (P3): the medals light up here, each stage card shows its own
            h('span.cp-ch-medals', DIFFICULTY_ORDER.map((d) => h('span.cp-ch-medal', { title: `${DIFFICULTIES[d].name}: ${prog.medals[d]}/${prog.total}` },
              svgEl(medalIcon(d, { earned: prog.medals[d] > 0 }), 'cp-medal')))),
          ])));
}

/**
 * A side stage's card (Gate Arc Step 6), drawn right after its anchor's card: its thumbnail, "Side", its name and
 * medals; locked ("Clear 6-10") until the anchor is cleared. Opens the stage screen like any stage card.
 * @param {object} profile
 * @param {{ id: string, anchor: string, unlocked: boolean, cleared: boolean, lockText: string|null }} side campaignActs.js
 */
function sideCard(profile, side) {
  const stage = STAGE_MAP[side.id];
  let map = null;
  try {
    map = getMap(stage.mapId);
  } catch {
    map = null;
  }
  const medals = stageMedals(profile, side.id);
  const order = stage.difficulties || DIFFICULTY_ORDER;
  return h(`button.ma-stage-card.cp-card.cp-side${side.unlocked ? '' : '.locked'}${side.cleared ? '.cleared' : ''}`, {
    type: 'button', 'data-testid': `side-${side.id}`, onclick: () => navigate('stage', { id: side.id }),
    'aria-label': `Side stage ${stage.name}${side.unlocked ? '' : `, locked: ${side.lockText}`}`,
  },
  h('span.cp-card-map',
    h('span.cp-thumb', { 'aria-hidden': 'true', html: map ? withRuleMarks(stageThumbSVG(map, { width: 320, height: 200, ruined: stage.scenery?.ruined }), map, stage.rule, 320, 200) : '' }),
    h('span.cp-id.num', 'Side'),
    side.unlocked ? savedBadge(profile, side.id) : h('span.cp-lock', ico('lock'), h('span', side.lockText)),
    h('span.cp-medals', { title: order.map((d) => `${DIFFICULTIES[d].name}: ${medals[d] ? 'cleared' : '—'}`).join(' · ') },
      order.map((d) => svgEl(medalIcon(d, { earned: medals[d] }), `cp-medal${medals[d] ? '.on' : ''}`)))),
  h('span.cp-card-cap', h('span.cp-name', stage.name)));
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
  const unlocks = cleared ? [] : (stage.unlocks?.units || []).filter((id) => UNIT_MAP[id]);
  const isFinale = !!stage.finale;
  const order = stage.difficulties || DIFFICULTY_ORDER;
  // an echo stage (Gate Arc 1-10): the stage it echoes shows through the map faintly; its chip sits with the tags
  const [ghost = null, echoChip = null] = (map?.echoOf && echoGhost(map)) || [];

  return h(`button.ma-stage-card.cp-card${unlocked ? '' : '.locked'}${isNext ? '.next' : ''}${cleared ? '.cleared' : ''}${isFinale ? '.finale' : ''}`, {
    type: 'button', 'data-testid': `stage-${stageId}`, onclick: () => navigate('stage', { id: stageId }),
    'aria-label': `${stage.id} ${stage.name}${isNext ? ', next' : ''}${unlocked ? '' : `, locked: ${requirementText(profile, stageId)}`}`,
  },
  h('span.cp-card-map',
    h('span.cp-thumb', { 'aria-hidden': 'true', html: map ? withRuleMarks(stageThumbSVG(map, { width: 320, height: 200, ruined: stage.scenery?.ruined }), map, stage.rule, 320, 200) : '' }),
    ghost,
    h('span.cp-id.num', stage.id),
    unlocked
      ? (savedBadge(profile, stageId) || (isNext ? h('span.ui-bdg.open.cp-next', 'Next') : null))
      : h('span.cp-lock', ico('lock'), h('span', requirementText(profile, stageId))),
    // the medals on the map's corner plate, so the caption keeps one line of tags at every width
    h('span.cp-medals', { title: order.map((d) => `${DIFFICULTIES[d].name}: ${medals[d] ? 'cleared' : '—'}`).join(' · ') },
      order.map((d) => svgEl(medalIcon(d, { earned: medals[d] }), `cp-medal${medals[d] ? '.on' : ''}`)))),
  h('span.cp-card-cap',
    h('span.cp-name', stage.name),
    h('span.cp-meta',
      tier ? h('span.cp-tier.s', { style: { '--tier': tier.color } }, tier.name) : null,
      isFinale ? h('span.ui-chip.ink.cp-boss', 'Boss') : null,
      echoChip,
      unlocks.map((id) => h('span.cp-unlock', { title: `${UNIT_MAP[id].name} joins on the first clear` }, h('span.cp-unlock-face', { html: portraitHTML(UNIT_MAP[id], 'thumb') }), h('span', `+${UNIT_MAP[id].name}`))))));
}
