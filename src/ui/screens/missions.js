// Missions hub (owner: ui). Route: #/missions — opened by the lobby's Campaign button.
// Academy-style mission-menu layout: the secretary's drawn stand bottom-left (bleeding off the
// edge) over the painted academy (dimmed, blurred), and a grid of slanted tiles on the right, each
// filled with a scenic backdrop (no girls on the tiles): Mission (the painted academy · chapter,
// next stage, quick start), Bounty (this week's double-drop arena), Total Assault, Tactical
// Challenge, Co-op (online), Sandbox (solo test range) and a small Story tile (episodes, a NEW dot).
// Commissions live on the lobby (Tasks / dock), sweeps on stage prep, Bounty and Total Assault.
// Locked tiles keep their colour and wear a small lock chip (big tiles) or a lock line in their
// name plate (small tiles).
// UI M5b: the secretary is the hub's host girl (docs/specs/UI_DIRECTION.md §5.10 E1): her stand in the left 35%
// with a speech bubble (the Missions lines of hostLines.js, picked by the state; a tap shows the next), never over
// the tiles. Under 800 px of width (the collapse rule, host.js) she is a bust chip in a strip over the tiles and the
// tiles take the whole width. Quick start is the screen's one primary (data-primary: Space on desktop).
import '../styles/meta-a.css';
import '../styles/hubs.css';
import { h, clear, screen, svgEl, toast } from '../components.js';
import { countdownChip, kbdHint } from '../kit.js';
import { hubHost, hubMode, placeHost, viewport, watchHostMode } from '../hubHost.js';
import { missionsState } from '../hubStates.js';
import { dot, inProgress, openSticker, openModes, markOpenSeen } from '../badges.js';
import { modesOpenNow } from '../modesOpen.js';
import { msToLocalWeekEnd } from '../countdown.js';
import { nextWeeklyReset } from '../../core/reset.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { STAGE_MAP } from '../../data/stages.js';
import { MAP_MAP } from '../../data/maps.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { themeBackdropSVG } from '../../art/backdrops.js';
import { hubBackdrop } from '../hubArt.js';
import { uiIcon } from '../../art/icons.js';
import { isStageUnlocked } from '../../systems/unlocks.js';
import { currentEvent } from '../../systems/missions.js';
import { titansUnlocked, TIER_STAGE } from '../../systems/titans.js';

const TITAN_STAGE = TIER_STAGE.normal;
import { isSandboxUnlocked, sandboxLockText, SANDBOX_UNLOCK_CLEARS } from '../../systems/sandbox.js';
import { requirementText } from './stage.js';
import { campaignStatus } from './lobby.js';

/** Tile art: a painted landscape (public/art/lobby), or a scenic theme backdrop (src/art/backdrops.js). */
const paint = (file) => ({ src: lobbyArtUrl(file), kind: 'paint' });
const scene = (theme) => ({ svg: themeBackdropSVG(theme), kind: 'scene', theme });

/** The scenery of this week's double-drop Bounty arena. */
function arenaTheme(event) {
  const stage = STAGE_MAP[event.stageIds?.[0]];
  return MAP_MAP?.[stage?.mapId]?.theme || 'sakura';
}

export function render(root) {
  const { el, body } = screen('Missions', { cls: 'ma-hub-screen' });
  el.insertBefore(hubBackdrop(), el.firstChild);
  root.appendChild(el);

  let drawn = null; // the host mode on screen
  const draw = () => {
    clear(body);
    drawn = hubMode(viewport());
    body.appendChild(build(draw, drawn));
  };
  draw();
  const off = store.on('change', (e) => { if (e?.reason === 'replace' || e?.reason === 'secretary') draw(); });
  // a resize that flips the collapse rule (a phone turned, a window resized) draws her in her other place
  const offResize = watchHostMode(el, () => drawn, () => hubMode(viewport()), draw);
  return () => {
    off();
    offResize();
  };
}

/**
 * @param {() => void} redraw the hub again (a weekly chip that reaches zero on screen: the new week's tiles)
 * @param {'stand'|'chip'} mode the host's place (the collapse rule)
 */
function build(redraw, mode = 'stand') {
  const profile = store.profile;
  const { next, nextDef, chapter, prog, complete } = campaignStatus(profile);
  const event = currentEvent();
  const lockFor = (stageId) => (isStageUnlocked(profile, stageId) ? null : requirementText(profile, stageId));

  const wrap = h('div.ma-hub');
  // [ui-m5] the host: whichever secretary the player picked (the one Missions exception to "students only"); her
  // stand in the left column, or her chip in a strip over the tiles
  const host = hubHost('missions', profile, { state: missionsState(profile), mode });
  const strip = mode === 'chip' ? h('div.ma-hub-hostrow', { 'data-testid': 'hub-hostrow' }) : null;
  if (strip) wrap.appendChild(strip);
  placeHost(host, mode, { hb: wrap, slot: strip });

  const mission = tile({
    id: 'mission',
    title: 'Mission',
    art: paint('academy.webp'),
    kicker: complete ? 'All chapters cleared' : `Chapter ${chapter?.id} · ${chapter?.name}`,
    sub: nextDef ? `Next: ${nextDef.id} ${nextDef.name}` : 'Chase Sakura medals',
    meta: prog ? `${prog.cleared}/${prog.total}` : null,
    onClick: () => navigate('campaign', nextDef ? { chapter: nextDef.chapter } : {}),
  });
  if (next) {
    mission.appendChild(h('span.ma-hub-go', { role: 'button', tabindex: 0, 'data-testid': 'hub-quick-start', 'data-primary': '', onclick: (e) => { e.stopPropagation(); navigate('stage', { id: next }); } }, svgEl(uiIcon('play'), 'ma-inline-icon'), 'Quick start', kbdHint('Space')));
  }
  // [ui-m5] the badge vocabulary: the campaign in progress, "Open!" on a mode that opened since the last look
  if (!complete) mission.appendChild(inProgress({ cls: 'ma-hub-inprog', testid: 'hub-mission-inprog' }));
  const locks = {
    bounty: lockFor('res-books-1'),
    assault: lockFor('boss-lych'),
    titans: titansUnlocked(profile) ? null : `Clear ${TITAN_STAGE}`,
    challenge: lockFor('challenge'),
    sandbox: isSandboxUnlocked(profile) ? null : `Clear ${SANDBOX_UNLOCK_CLEARS} stages`,
  };
  // (modesOpen.js is the one rule for "open": main.js asks it too when a mode is visited by another door)
  const fresh = new Set(openModes(modesOpenNow(profile)));
  const go = (id, route = id) => () => {
    markOpenSeen(id, undefined, { open: true });
    navigate(route);
  };

  const grid = h('div.ma-hub-grid',
    mission,
    tile({ id: 'bounty', title: 'Bounty', art: scene(arenaTheme(event)), sub: `${event.dropMul}× drops in ${event.arenaName}`, short: `${event.dropMul}× drops this week`, lockText: locks.bounty, timer: msToLocalWeekEnd(), onTimer: redraw, onClick: () => navigate('bounty') }),
    tile({ id: 'assault', title: 'Total Assault', art: scene('volcano'), sub: 'Bosses drop crowns', lockText: locks.assault, open: fresh.has('assault'), onClick: go('assault') }),
    // [ascension] Titan Trials, the weekly bosses (opens after 3-5)
    tile({ id: 'titans', title: 'Titan Trials', art: scene('night'), sub: 'Weekly', lockText: locks.titans, timer: nextWeeklyReset() - Date.now(), onTimer: redraw, open: fresh.has('titans'), onClick: go('titans') }),
    tile({ id: 'challenge', title: 'Tactical Challenge', art: scene('arena'), sub: bestWaveLine(profile), lockText: locks.challenge, open: fresh.has('challenge'), onClick: go('challenge') }),
    // [online] 2-player real-time co-op on any unlocked campaign stage
    tile({ id: 'coop', title: 'Co-op', art: scene('festival'), sub: '2 players', ribbon: 'Online', onClick: () => navigate('coop') }),
    // solo test range: any map, any girl, spawn controls, no rewards (opens after 7 campaign clears)
    tile({ id: 'sandbox', title: 'Sandbox', art: scene('snow'), sub: 'No rewards', lockText: locks.sandbox, lockHint: sandboxLockText(profile), open: fresh.has('sandbox'), onClick: go('sandbox') }),
    tile({ id: 'story', title: 'Story', art: scene('shrine'), sub: 'Episodes', short: 'Episodes', onClick: () => navigate('story') }), // [story]
  );
  storyDot(grid.querySelector('[data-testid="hub-story"]'), profile); // [story] NEW dot for unread episodes
  wrap.appendChild(grid);
  return wrap;
}

/** [story] Red dot on the Story tile while an unlocked episode is unread (the scene list is a lazy chunk). */
function storyDot(tileEl, profile) {
  if (!tileEl) return;
  Promise.all([import('../../data/story/index.js'), import('../../systems/storyTriggers.js'), import('../../data/units.js')])
    .then(([idx, trig, units]) => {
      const n = trig.unseenEpisodeCount(profile, idx.SCENE_LIST, (id) => !!units.UNIT_MAP[id]);
      if (n > 0 && tileEl.isConnected && !tileEl.querySelector('.notif-dot')) tileEl.appendChild(dot('claim', { cls: 'notif-dot', testid: 'hub-story-dot' }));
    })
    .catch((e) => console.warn('[missions] story dot failed', e));
}

function bestWaveLine(profile) {
  const best = profile.progress?.stages?.challenge?.bestWave;
  return best ? `Best wave ${formatNumber(best)}` : 'Endless waves';
}

/** Bottom-row tiles: full-colour scenery with a name plate at the bottom. */
const SMALL_TILES = new Set(['challenge', 'coop', 'sandbox', 'story', 'titans']);

/**
 * One slanted hub tile. sub/short: the subtitle, and a shorter one for phone widths (CSS picks).
 * Small tiles show a locked state as a lock line in their name plate; big tiles as a chip.
 * lockHint: a longer line for the tap toast (default: lockText).
 */
function tile({ id, title, art, kicker = null, sub = null, short = null, meta = null, lockText = null, lockHint = null, ribbon = null, dot: hasDot = false, soon = false, timer = null, onTimer = null, open = false, onClick }) {
  const locked = !!lockText;
  const small = SMALL_TILES.has(id);
  let subEl = sub ? h('span.ma-hub-sub', short ? [h('span.ma-sub-long', sub), h('span.ma-sub-short', short)] : sub) : null;
  // small tiles: the lock is a line in the name plate (no chip over the art)
  if (locked && small) subEl = h('span.ma-hub-sub.ma-hub-lockline', { title: lockText }, svgEl(uiIcon('lock'), 'ma-inline-icon'), h('span', lockText));
  const el = h(
    `button.ma-hub-tile.ma-hub-${id}${locked ? '.locked' : ''}${soon ? '.soon' : ''}`,
    { onclick: () => (locked ? toast(lockHint || lockText, 'info') : onClick()), 'data-testid': `hub-${id}`, title: locked ? lockHint || lockText : null },
    art?.svg
      ? h(`div.ma-hub-art.scene.scene-${art.theme}`, { html: art.svg, 'aria-hidden': 'true' })
      : h(`div.ma-hub-art.${art?.kind || 'paint'}`, art?.src ? h('img', { src: art.src, alt: '', loading: 'lazy', decoding: 'async', draggable: false }) : null),
    h('div.ma-hub-shade'),
    h('div.ma-hub-text',
      kicker ? h('span.ma-hub-kicker', kicker) : null,
      h('span.ma-hub-title', title),
      subEl,
    ),
    meta ? h('span.ma-hub-meta', meta) : null,
    ribbon ? h('span.tag-ribbon.ma-hub-ribbon', h('span', ribbon)) : null,
    hasDot ? dot('claim', { cls: 'notif-dot' }) : null,
    // [ui-m5] a weekly mode's time left (the countdown chip: a recurring cycle, never red) and the "Open!" sticker,
    // top corners; at zero the hub redraws with the new week
    timer != null && !locked ? countdownChip(timer, { cls: 's.ma-hub-timer', urgent: false, doneText: 'New week!', onDone: onTimer, testid: `hub-${id}-time` }) : null,
    open && !locked ? openSticker({ cls: 'ma-hub-open', testid: `hub-${id}-open` }) : null,
    locked && !small ? h('div.ma-hub-lock', { title: lockText }, svgEl(uiIcon('lock'), 'ma-inline-icon'), h('span', lockText)) : null,
  );
  return el;
}
