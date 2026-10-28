// Campaign act rows (owner: meta-a; docs/CAMPAIGN.md "Act II", docs/specs/GATE_ARC.md §20). A chapter shows one row
// per act that has stages in this build: Act I (the Morning, `chapter.stages`) and, once that chapter's Act II ships,
// Act II (the Noon, `chapter.act2`). A chapter with one act draws no header at all, so the campaign screen looks as
// it always did until the first Act II stage exists.
//
// Pure helpers first (actRows, actIsNew, chapterHasNewAct: tests/ui/campaignActs.test.js, no DOM), then small DOM
// builders for campaign.js (actRowHeader, actNewBadge, actNewDot). Kept out of campaign.js and meta-a.css (its own
// campaign-acts.css) so the UI v2 restyle can own the look.
import '../styles/campaign-acts.css';
import { h } from '../dom.js';
import { newSticker, dot } from '../badges.js';
import { stageRequires, STAGES, sideStagesAfter } from '../../data/stages.js';
import { MAP_MAP } from '../../data/maps.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { isStageUnlocked, isStageCleared } from '../../systems/unlocks.js';

/**
 * The Act I stage an echo stage's map re-skins (MapDef.echoOf, Gate Arc: 1-10's Dry Fountain is 1-5's Blossom Court a
 * thousand years later): { stageId, map } of the first campaign stage on that map, or null.
 * @param {object} map MapDef
 */
export function echoSource(map) {
  const orig = map?.echoOf ? MAP_MAP[map.echoOf] : null;
  if (!orig) return null;
  const st = STAGES.find((s) => s.kind === 'campaign' && s.mapId === orig.id);
  return st ? { stageId: st.id, map: orig } : null;
}

/** The stage card's ghost of the echoed stage: its thumbnail, faint over the new one (the same roads line up), and a chip. */
export function echoGhost(map, { width = 320, height = 200 } = {}) {
  const src = echoSource(map);
  if (!src) return null;
  return [
    h('div.ma-sc-ghost', { 'aria-hidden': 'true', html: stageThumbSVG(src.map, { width, height }) }),
    h('span.ma-sc-echo', { 'data-testid': 'stage-echo', title: `The same place as ${src.stageId}, a thousand years later` }, `Echo of ${src.stageId}`),
  ];
}

/** Act I's subtitle (Act II takes its chapter's `act2Name`). */
export const ACT1_NAME = 'The Morning';
/** Act II's subtitle while a chapter has no `act2Name` yet. */
export const ACT2_FALLBACK_NAME = 'The Noon';
const ROMAN = { 1: 'I', 2: 'II', 3: 'III' };

/** A chapter row's stage ids for one act (Act I: `stages`; Act II: `act2`), read from the row it is given. */
export function actIds(chapter, act) {
  if (!chapter) return [];
  return act === 1 ? chapter.stages || [] : act === 2 ? chapter.act2 || [] : [];
}

/** "Act I · The Morning" / "Act II · Rush Hour". */
export function actTitle(chapter, act) {
  const name = act === 1 ? ACT1_NAME : chapter?.act2Name || ACT2_FALLBACK_NAME;
  return `Act ${ROMAN[act] || act} · ${name}`;
}

/**
 * The act is open and untouched: its first stage is unlocked and none of its stages is cleared (the NEW badge).
 * @param {object} profile
 * @param {{ id: number }} chapter a CHAPTERS row
 * @param {number} act
 * @returns {boolean}
 */
export function actIsNew(profile, chapter, act) {
  const ids = actIds(chapter, act);
  return ids.length > 0 && isStageUnlocked(profile, ids[0]) && !ids.some((id) => isStageCleared(profile, id));
}

/** A chapter's tab wears NEW while one of its later acts is new (Act I keeps its own "New" line). */
export function chapterHasNewAct(profile, chapter) {
  return actIds(chapter, 2).length > 0 && actIsNew(profile, chapter, 2);
}

/**
 * The side stages of an act row (Gate Arc Step 6, docs/specs/GATE_ARC.md §20: the Starfall Trial after 6-10), each drawn as
 * a small card right after its anchor's card; a card opens the stage screen (route `stage`, `params.id` the side stage,
 * so its before-scene plays). Locked ("Clear 6-10") until its requirements are cleared. Side stages are not counted in the
 * row's progress.
 * @param {object} profile
 * @param {string[]} ids the row's stage ids
 * @returns {Array<{ id: string, anchor: string, unlocked: boolean, cleared: boolean, lockText: string|null }>}
 */
export function sideCards(profile, ids) {
  return (ids || []).flatMap((anchor) => sideStagesAfter(anchor).map((s) => {
    const unlocked = isStageUnlocked(profile, s.id);
    const missing = unlocked ? [] : stageRequires(s).filter((id) => !isStageCleared(profile, id));
    return { id: s.id, anchor, unlocked, cleared: isStageCleared(profile, s.id), lockText: unlocked ? null : `Clear ${missing.join(' and ') || s.anchor}` };
  }));
}

/**
 * One row per act with stages in this build.
 * @param {object} profile
 * @param {object} chapter a CHAPTERS row ({ id, stages, act2?, act2Name? })
 * @returns {Array<{ act: number, ids: string[], header: string|null, unlocked: boolean, lockText: string|null,
 *   cleared: number, total: number, isNew: boolean, sides: ReturnType<typeof sideCards> }>} `header` is null when the
 *   chapter has a single act; `sides` are the row's side stages (sideCards)
 */
export function actRows(profile, chapter) {
  const acts = [1, 2].map((act) => ({ act, ids: actIds(chapter, act) })).filter((r) => r.ids.length > 0);
  const multi = acts.length > 1;
  return acts.map(({ act, ids }) => {
    const unlocked = isStageUnlocked(profile, ids[0]);
    // the stages its first stage still waits for, by id ("Clear 2-5 and 1-10 first": the stage screen's wording)
    const missing = unlocked ? [] : stageRequires(ids[0]).filter((id) => !isStageCleared(profile, id));
    return {
      act,
      ids: [...ids],
      header: multi ? actTitle(chapter, act) : null,
      unlocked,
      lockText: unlocked ? null : missing.length ? `Clear ${missing.join(' and ')} first` : 'Locked',
      cleared: ids.filter((id) => isStageCleared(profile, id)).length,
      total: ids.length,
      isNew: act > 1 && actIsNew(profile, chapter, act),
      sides: sideCards(profile, ids),
    };
  });
}

// ---------------------------------------------------------------------------
// DOM (campaign.js)
// ---------------------------------------------------------------------------

/** The yellow NEW sticker of a new act, on its row header (src/ui/badges.js: new content). */
export function actNewBadge({ cls = 'ma-act-new', testid = null } = {}) {
  return newSticker({ cls, testid });
}

/** The chapter tab's yellow dot while one of its later acts is new (src/ui/badges.js: something new inside). */
export function actNewDot({ testid = null } = {}) {
  return dot('new', { cls: 'ma-act-newdot', testid, title: 'A new act is open in this chapter' });
}

/**
 * An act row's header: "Act II · Rush Hour", its progress (n/5, hidden at 0), the lock line or the NEW sticker.
 * @param {ReturnType<typeof actRows>[number]} row
 * @param {number} chapterId
 * @returns {HTMLElement}
 */
export function actRowHeader(row, chapterId) {
  return h(`div.ma-act-head.act-${row.act}${row.unlocked ? '' : '.locked'}`, { 'data-testid': `act-head-${chapterId}-${row.act}` },
    h('span.ma-act-title', row.header),
    row.isNew ? actNewBadge({ testid: `act-new-${chapterId}-${row.act}` }) : null,
    row.unlocked && row.cleared ? h('span.ma-act-prog', `${row.cleared}/${row.total}`) : null,
    row.unlocked ? null : h('span.ma-act-lock', row.lockText));
}
