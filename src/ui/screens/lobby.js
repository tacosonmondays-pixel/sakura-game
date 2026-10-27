// The home (lobby) at night: UI v2 "Ink & Paper", home layout C (the owner, Oct 27: "keep the new wallpaper concepts
// but change the layout"; Oct 24: "it just looks busy the homescreen is kinda packed now"). Layers and the host:
// src/ui/lobby/artStage.js. Where every piece goes: src/ui/lobby/homeLayout.js. Look: src/ui/styles/home.css.
//
//   · the scene (unchanged): the player's lobby background in the night grade, her stand over the academy (over an
//     event's painted backdrop while it runs), or one of her full illustrations, or Marumi's living scene; her bubble on
//     a tap only. Her face at 0.30 of the width, the controls on the right; a picture whose girl stands right of centre
//     (every full illustration, the living scene) mirrors it: the controls on the left, her face at 0.70
//   · the floating top bar: the avatar with the account level's cyan EXP arc, the name and LV; tickets (shown only),
//     coins and gems in their colour art (the gems' "+"); chat, mail (a red count) and the menu (a red dot when something
//     inside is new)
//   · one block on the controls' side: the ticker (one page at a time: the event, the objective with its cyan play
//     square, the weekly bosses or the notice board; "›" pages it, and so does a 6 s timer unless Reduce Motion is on,
//     held while a pointer, a finger or the keys are on it), then the mosaic of -8 degree ink tiles leaning as one
//     shape: STUDENTS (the girl who joined last, framed on her face), RECRUIT (the banner's three girls, a cyan FREE PULL
//     chip), CO-OP (the red number of open invites), COMMISSIONS (a red dot), MALL and BATTLE, the biggest tile at the
//     bottom of the block in thumb reach: the home's one yellow (its play edge) and its one heavy italic; its lower band
//     opens the chapter
//   · on her side: a vertical caption (her name, the screen's one decorative serial) and the corner tools (hide the UI,
//     background and secretary)
//   · the main menu: a side sheet from the right (src/ui/lobby/menuSheet.js; Clan is its Social row)
// The pure models: src/ui/lobbyTray.js (the objective's first-match order, the news pages), homeLayout.js (the boxes,
// the ticker's pages, the Students girl and her crop).
// Motion (UI v2 motion layer, src/ui/motion.js): homeEntrance() brings the home in on its first open (from the boot
// loader or a battle's cut) and on every return from a sub-screen (shorter): the block's pieces from their side 40 ms
// apart, the caption and the tools fade in last; the balances count when they change; a red dot or count pops when it
// appears; the ticker's page comes in with a tick wipe (240 ms; a 120 ms fade under Reduce Motion).
// Hooks kept: tile-mission on BATTLE (it opens Missions, with its "Open!" chip campaign-open), lobby-chapter on its band
// (the campaign), dock-students, dock-recruit (recruit-free), dock-commissions, dock-mall, lobby-multiplayer(-count),
// lobby-news / lobby-news-next on the ticker with event-card / event-strip / banner-titans / banner-assault on its pages,
// lobby-objective (lobby-continue / login-claim on its play square) on the objective page, top-mail, top-menu, top-chat,
// account-level, tickets / coins / gems / gems-plus, lobby-hide / lobby-bg / lobby-restore, secretary-art /
// secretary-bubble, lobby-live; dock-clan is the menu sheet's Clan row. New: home-block, home-caption, news-notice,
// students-face.
import '../styles/meta-a.css';
import '../styles/hubs.css';
import '../styles/home.css';
import { h, clear, toast, applyMotionPreference, accountLevel } from '../components.js';
import { countdownChip, curArt } from '../kit.js';
import { homeEntrance, enter, countTo, badge, reduced as motionReduced } from '../motion.js';
import { whenSettled } from '../transitions/index.js';
import { openModes } from '../badges.js';
import { modesOpenNow } from '../modesOpen.js';
import { homeObjective, homeNews, multiplayerLabel } from '../lobbyTray.js';
import { openInvites, lastInvites } from '../online/openInvites.js';
import { msToLocalWeekEnd, countdownState } from '../countdown.js';
import { chatButton } from '../online/lobbyChat.js';
import { storedName } from '../online/common.js';
import { hub } from '../online/socialHub.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { STAGE_MAP, CHAPTERS } from '../../data/stages.js';
import { UNIT_MAP, getUnit } from '../../data/units.js';
import { GACHA } from '../../data/types.js';
import { ITEMS } from '../../data/items.js';
import { PATCH_NOTES } from '../../data/patchNotes.js';
import { openBackgroundPicker } from '../lobby/bgPicker.js';
import { openMailbox, maybeShowBetaGift } from '../lobby/mailbox.js';
import { eventLobbyBackdrop, lobbyEventVisit } from '../events/lobby.js'; // [events]
import { eventNow } from '../events/clock.js';
import '../styles/events.css';
import { portraitUrl, hasPortrait } from '../../art/portraits.js';
import { lobbyBackgroundFor, stageModeOf, LOBBY_BG_MAP } from '../../data/lobbyArt.js';
import { FULL_ILLUSTRATION_MAP } from '../../data/lobbyIllustrations.js';
import { ensureBetaGift, ensurePotentialLetter, unclaimedMailCount } from '../../systems/mail.js';
import { ensureCatchUpJoins } from '../../systems/catchUpJoins.js';
import { nextStage, chapterProgress, isStageUnlocked, stageMedals } from '../../systems/unlocks.js';
import { missionList, loginCalendar, achievementNotice, claimLogin, currentEvent } from '../../systems/missions.js';
import { featuredEvent, eventWindow } from '../../systems/events.js';
import { itemCount } from '../../systems/inventory.js';
import { canSpark } from '../../systems/gacha.js';
import { listBattleSaves, saveSummary, saveTitle } from '../../systems/battleSave.js';
import { showRewardsModal, requirementText } from './stage.js';
import { createArtStage } from '../lobby/artStage.js';
import { secretaryOf } from '../lobby/secretaryOf.js';
import { showNoticeModal, noticeUnread, RECRUIT_FEATURED } from '../lobby/notice.js';
import { openMenuSheet, closeMenuSheet, menuSheetOpen } from '../lobby/menuSheet.js';
import { liveSceneFor, canWebGL2 } from '../lobby/liveSlot.js';
import { homeLayout, uiSideFor, tickerPages, tickerEdge, latestRecruit, cardCrop } from '../lobby/homeLayout.js';
import { faceAnchor } from '../faceAnchors.js';
import { lineGlyph } from '../lineGlyphs.js';
import { onboardingRoute, journalDot } from '../../systems/story.js';
import { titansUnlocked, titanOfWeek } from '../../systems/titans.js'; // [ascension]
import { TITAN_MAP } from '../../data/titans.js';
import { shownTips } from '../../data/unitTips.js';

/** Anything claimable in Commissions? */
export function commissionsNotice(profile) {
  try {
    const ml = missionList(profile);
    const all = [...ml.daily, ...ml.weekly];
    const missions = all.some((m) => m.claimable);
    const claimable = all.filter((m) => m.claimable).length;
    const login = loginCalendar(profile).claimable;
    const ach = achievementNotice(profile).ready; // cached: asked a few times per home draw
    const dailyDone = ml.daily.filter((m) => m.claimed || m.claimable).length;
    return { any: missions || login || ach > 0, missions, login, ach: ach > 0, achCount: ach, missionCount: claimable, count: claimable + ach + (login ? 1 : 0), dailyDone, dailyTotal: ml.daily.length };
  } catch {
    return { any: false, missions: false, login: false, ach: false, achCount: 0, missionCount: 0, count: 0, dailyDone: 0, dailyTotal: 0 };
  }
}

/** A recruit ticket waits (a pull that costs no gems), or the spark is ready. */
function recruitTag(profile) {
  if (itemCount(profile, 'ticket_recruit') > 0 || itemCount(profile, 'ticket_recruit10') > 0) return 'Free pull';
  return canSpark(profile) ? 'Spark ready' : null;
}

/** Chapter / next-stage summary used by the BATTLE tile and the missions hub. */
export function campaignStatus(profile) {
  const next = nextStage(profile);
  const nextDef = next ? STAGE_MAP[next] : null;
  const chapter = CHAPTERS.find((c) => c.id === (nextDef?.chapter || CHAPTERS[CHAPTERS.length - 1].id));
  const prog = chapter ? chapterProgress(profile, chapter.id) : null;
  return { next, nextDef, chapter, prog, complete: !nextDef };
}

/** The lobby secretary: profile.secretary when owned, else the hero, else the first girl. */
export function secretaryId(profile) {
  return secretaryOf(profile);
}

const HEAD_PAT_LINES = [
  'E-eh? My halo is not a button, Sensei…',
  'Hehe… one more pat? Just one!',
  'W-what are you doing, Sensei?! …I don\'t mind.',
  'If you keep patting me, I\'ll forget my work!',
];

/** Line glyph markup as an element. */
const g = (name, cls = '') => {
  const t = document.createElement('template');
  t.innerHTML = lineGlyph(name, cls);
  return t.content.firstElementChild;
};

/** The living scenes that failed in this session (each falls back to her still portrait until a reload). */
const liveFailed = new Set();
/** The engine module's stats, once it has been loaded (e2e: one context at most). */
let engineStats = null;
/** The ticker's page in this session (a redraw or a return keeps it). */
let tickerPage = 0;

/** The ticker turns a page on its own this often (ms) unless Reduce Motion is on (the Oct 27 motion study). */
export const TICKER_MS = 6000;
/** A touch on the ticker holds its timer this long (ms). */
const TICKER_HOLD_MS = 10000;

const sysReduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function render(root) {
  applyMotionPreference();
  let alive = true;
  const reduceMotion = () => !!store.profile.settings?.reduceMotion || sysReduced() || motionReduced();
  // the home brings its own entrance (data-mo-own: the screen change only fades it in): its first open comes from a
  // cover (the boot loader, a battle's cut), a return from a menu slide
  const txKind = globalThis.document?.documentElement?.dataset?.tx || '';
  const firstOpen = !txKind || txKind === 'boot' || txKind === 'cut';
  const el = h('div.screen.lb.home.home-c', { 'data-testid': 'lobby', 'data-mo-own': '', 'data-entrance': firstOpen ? 'first' : 'return' });
  const stageHost = h('div.home-stage-host');
  const top = h('header.ui-topbar.float.home-top');
  const tickerHost = h('div.home-ticker-host');
  const tiles = {
    students: h('button.c-tile.c-students', { type: 'button', 'data-testid': 'dock-students', 'aria-label': 'Students', onclick: () => navigate('students') }),
    recruit: h('button.c-tile.c-recruit', { type: 'button', 'data-testid': 'dock-recruit', onclick: () => navigate('recruit') }),
    coop: h('button.c-tile.c-coop', { type: 'button', 'data-testid': 'lobby-multiplayer', onclick: () => navigate('multiplayer') }),
    commissions: h('button.c-tile.c-comm', { type: 'button', 'data-testid': 'dock-commissions' }),
    mall: h('button.c-tile.c-mall', { type: 'button', 'data-testid': 'dock-mall', 'aria-label': 'Mall', onclick: () => navigate('mall') }),
    battle: h('div.c-tile.c-battle'),
  };
  const block = h('nav.home-block', { 'aria-label': 'Main', 'data-testid': 'home-block' }, tickerHost, ...Object.values(tiles));
  const caption = h('div.home-caption', { 'aria-hidden': 'true', 'data-testid': 'home-caption' }, h('i.cap-rule'), h('span.cap-t'));
  const tools = h('div.home-tools');
  const ui = h('div.home-ui', block, caption, tools);
  const restore = h('button.ui-ibtn.home-restore', { type: 'button', 'aria-label': 'Show the menus', title: 'Show the menus', 'data-testid': 'lobby-restore' }, g('image'));
  el.append(stageHost, ui, top, restore);
  let eventBackdrop = null;
  try {
    lobbyEventVisit(); // [events] today's event gift / settle, before the ticker reads the state
    eventBackdrop = eventLobbyBackdrop(); // [events] its painted backdrop behind every stand while it runs (no overlay)
  } catch (e) {
    console.warn('[lobby] event backdrop failed', e);
  }
  root.appendChild(el);

  // ---- the layout: which side the block takes, every piece's box (homeLayout.js) ------------------------------
  let side = 'r';
  let lay = null;
  const screenWH = () => [el.clientWidth || innerWidth, el.clientHeight || innerHeight];
  /** The block's side for what she shows now: a full illustration or her living scene by its face, her stand 'r'. */
  const sideNow = () => {
    const [W, H] = screenWH();
    if (W < H) return 'r';
    const p = store.profile;
    const id = secretaryId(p);
    const bg = LOBBY_BG_MAP[currentBg] || lobbyBackgroundFor(p, id);
    if (stageModeOf(bg) === 'full') return uiSideFor(FULL_ILLUSTRATION_MAP[bg.id]?.faceX);
    // (her living scene, from before it loads: the block is on its side when she appears; a scene that fails gives
    // her still stand, and the block its usual side)
    return liveWant()?.side || 'r';
  };
  const px = (n) => `${Math.round(n * 100) / 100}px`;
  const put = (node, r) => {
    if (!node) return;
    Object.assign(node.style, { left: px(r.x), top: px(r.y), width: px(r.w), height: px(r.h) });
    if (r.lean != null) node.style.setProperty('--lean', px(r.lean));
  };
  function applyLayout() {
    side = sideNow();
    const [W, H] = screenWH();
    lay = homeLayout(W, H, { side });
    el.dataset.side = lay.side;
    el.dataset.layout = lay.kind;
    put(tickerHost, lay.ticker);
    for (const [k, node] of Object.entries(tiles)) put(node, lay.tiles[k]);
    tiles.battle.style.setProperty('--band', px(lay.battleBand));
    caption.hidden = !lay.caption;
    if (lay.caption) put(caption, lay.caption);
    put(tools, lay.tools);
    Object.assign(restore.style, { left: px(lay.tools.x), top: px(lay.tools.y), right: 'auto' });
    paintStudentsFace();
    fitLabels(el);
  }

  // ---- the stage: scene, scrims, the secretary ---------------------------------------------------------------
  let lineIndex = 0;
  let patIndex = 0;
  /**
   * The controls' boxes the secretary keeps 8 px clear of (5.5), as laid out: their entrance slide and the screen
   * change's own motion aside (a box read mid-slide would place her against where a control is passing through).
   */
  const laidOut = (e) => {
    let x = 0;
    let y = 0;
    for (let p = e; p && p !== document.body; p = p.offsetParent) {
      x += p.offsetLeft;
      y += p.offsetTop;
    }
    return { x, y, w: e.offsetWidth, h: e.offsetHeight };
  };
  const boxesOf = (els) => {
    const o = laidOut(el);
    return els.filter((e) => e && e.offsetParent !== null).map((e) => {
      const b = laidOut(e);
      // (a tile's drawn parallelogram pokes half its lean past its box at two corners)
      const lean = parseFloat(e.style.getPropertyValue('--lean')) || 0;
      return { x: b.x - o.x - lean / 2, y: b.y - o.y, w: b.w + lean, h: b.h };
    }).filter((b) => b.w > 0 && b.h > 0);
  };
  const blockEls = () => [tickerHost.firstElementChild, ...Object.values(tiles)];
  const sideEls = () => [...tools.children, caption.hidden || caption.classList.contains('off') ? null : caption];
  /** The boxes her art always keeps 8 px clear of: the top bar (and on a phone held upright, the block under her). */
  const uiBoxes = () => {
    if (el.classList.contains('ui-hidden')) return [];
    return boxesOf([...top.children, ...(lay?.kind === 'tall' ? blockEls() : [])]);
  };
  /** The block and her side's pieces: her art stays 8 px clear of them too when she can; her face box always does. */
  const underBoxes = () => {
    if (el.classList.contains('ui-hidden')) return [];
    return boxesOf(lay?.kind === 'tall' ? sideEls() : [...blockEls(), ...sideEls()]);
  };
  const stage = createArtStage(stageHost, {
    reduceMotion: reduceMotion(),
    boxes: uiBoxes,
    under: underBoxes,
    side: () => side,
    backdrop: eventBackdrop,
    onTap: (part) => {
      if (part === 'head') stage.say(HEAD_PAT_LINES[patIndex++ % HEAD_PAT_LINES.length]);
      else {
        const l = secretaryLines(store.profile);
        stage.say(l[lineIndex % l.length]);
        lineIndex++;
      }
    },
  });
  /** Her caption steps aside when her stand needs its strip (a wide girl on a 4:3 screen): it is only a serial. */
  const fitCaption = () => {
    if (!lay?.caption || caption.hidden) return;
    const was = caption.classList.contains('off');
    caption.classList.remove('off');
    const over = stage.artOver?.(lay.caption, 6);
    caption.classList.toggle('off', !!over);
    if (!!over !== was) stage.relayout();
  };

  let currentSec = null;
  let currentBg = null;
  const showSecretary = async () => {
    const p = store.profile;
    const id = secretaryId(p);
    const bg = lobbyBackgroundFor(p, id);
    if (id === currentSec && bg.id === currentBg) return;
    currentSec = id;
    currentBg = bg.id;
    lineIndex = 0;
    caption.querySelector('.cap-t').textContent = (getUnit(id)?.name || '').toUpperCase();
    relayoutAll();
    await stage.show(getUnit(id), { background: bg });
    syncLive();
    fitCaption();
  };

  // ---- the living scene (Marumi): one WebGL context at most, her still portrait otherwise ---------------------
  let live = null; // { id, handle, def }
  let liveToken = 0;
  let liveState = 'static';
  let loadingFor = '';
  const liveWant = () => {
    const p = store.profile;
    const id = secretaryId(p);
    const [W, H] = screenWH();
    if (stageModeOf(LOBBY_BG_MAP[currentBg] || lobbyBackgroundFor(p, id)) === 'full') return null;
    return liveSceneFor(id, { quality: p.settings?.quality || 'high', reduceMotion: !!p.settings?.reduceMotion, prefersReduced: sysReduced(), webgl2: canWebGL2(), failed: liveFailed.has(id), portrait: W < H });
  };
  const liveLayout = (def) => {
    const [W, H] = screenWH();
    return { W, H, side, place: def.place(W, H, uiBoxes(), { side, under: underBoxes() }) };
  };
  const disposeLive = () => {
    liveToken++;
    if (live) {
      live.handle?.dispose();
      live = null;
    }
    stage.liveHost().replaceChildren();
    if (stage.isLive()) stage.setLive(false);
    liveState = 'static';
    loadingFor = '';
    relayoutAll();
  };
  const failLive = (id, e) => {
    if (e) console.warn('[lobby] the living scene failed; her still portrait shows', e);
    liveFailed.add(id);
    disposeLive();
  };
  async function syncLive() {
    if (!alive) return;
    const p = store.profile;
    const id = secretaryId(p);
    const quality = p.settings?.quality || 'high';
    const want = liveWant();
    if (!want) {
      if (live || liveState === 'loading') disposeLive();
      return;
    }
    if (live?.id === id && live.quality === quality) return;
    if (liveState === 'loading' && loadingFor === `${id}:${quality}`) return; // (already on its way)
    disposeLive();
    const token = ++liveToken;
    liveState = 'loading';
    loadingFor = `${id}:${quality}`;
    relayoutAll(); // (her scene's side: the block moves before she shows)
    try {
      const [mod, eng] = await Promise.all([want.load(), import('../lobby/live/engine.js')]);
      engineStats = eng.liveStats;
      if (token !== liveToken || !alive) return;
      const def = mod.default;
      const canvas = h('canvas.home-live-canvas', { 'data-live': id, 'aria-hidden': 'true' });
      stage.liveHost().replaceChildren(canvas);
      const lay0 = liveLayout(def);
      const handle = await eng.createLiveScene(canvas, def, { quality, base: import.meta.env?.BASE_URL || './', layout: lay0, onLost: () => failLive(id) });
      if (token !== liveToken || !alive) {
        handle.dispose();
        canvas.remove();
        return;
      }
      live = { id, quality, handle, def };
      handle.renderAt(0);
      stage.setLive(true);
      stage.setLivePlacement(lay0.place);
      handle.start();
      liveState = 'live';
    } catch (e) {
      if (token === liveToken) failLive(id, e);
    }
  }
  const relayoutLive = () => {
    if (!live) return;
    const l = liveLayout(live.def);
    live.handle.layout(l);
    stage.setLivePlacement(l.place);
  };
  /** Every piece placed again, then her (the block's side may have changed with her picture). */
  function relayoutAll() {
    if (!alive) return;
    applyLayout();
    stage.relayout();
    relayoutLive();
  }
  const onResize = () => {
    relayoutAll();
    fitCaption();
    syncLive(); // (a phone turned upright shows her still; turned back, her scene again)
  };
  window.addEventListener('resize', onResize);

  // ---- the UI --------------------------------------------------------------------------------------------------
  const hideBtn = h('button.ui-ibtn', { type: 'button', 'aria-label': 'Hide the menus', title: 'Hide the menus', 'data-testid': 'lobby-hide', onclick: () => setHidden(true) }, g('eyeoff'));
  const bgBtn = h('button.ui-ibtn', { type: 'button', 'aria-label': 'Background and secretary', title: 'Background and secretary', 'data-testid': 'lobby-bg', onclick: () => openBackgroundPicker() }, g('image'));
  tools.append(hideBtn, bgBtn);

  // the ticker: a page by hand ("›"), or on its own every 6 s unless Reduce Motion is on; held while a pointer is
  // over it, it has the keys, or for 10 s after a touch; never while the menu is open, the UI is hidden or the page is
  // in the background
  let tickerTimer = 0;
  let hover = false;
  let focusIn = false;
  let heldUntil = 0;
  const tickerHeld = () => hover || focusIn || Date.now() < heldUntil || menuSheetOpen() || el.classList.contains('ui-hidden') || document.hidden;
  const scheduleTicker = () => {
    clearTimeout(tickerTimer);
    if (!alive || reduceMotion()) return;
    tickerTimer = setTimeout(() => {
      if (!alive) return;
      if (!tickerHeld() && tickerHost.querySelector('[data-testid="lobby-news-next"]')) pageTicker(tickerPage + 1, { auto: true });
      scheduleTicker();
    }, TICKER_MS);
  };
  tickerHost.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hover = true; });
  tickerHost.addEventListener('pointerleave', () => { hover = false; });
  tickerHost.addEventListener('pointerdown', () => { heldUntil = Date.now() + TICKER_HOLD_MS; });
  tickerHost.addEventListener('focusin', () => { focusIn = true; });
  tickerHost.addEventListener('focusout', () => { focusIn = false; });
  function pageTicker(n, { auto = false } = {}) {
    tickerPage = n;
    buildTicker(tickerHost, { page: tickerPage, onPage: (i) => pageTicker(i), wipe: true });
    if (!auto) scheduleTicker(); // (a page turned by hand starts the 6 s again)
  }

  function openMenu() {
    const p = store.profile;
    stage.hideBubble();
    openMenuSheet({
      reduced: reduceMotion(),
      dots: { backpack: hasBox(p), journal: journalDot(p), notice: noticeUnread(), clan: clanDot() },
      go: (row) => {
        if (row.id === 'notice') {
          showNoticeModal();
          drawAll();
          return;
        }
        navigate(row.route);
      },
    });
  }
  const drawAll = () => {
    buildTop(top, { onMenu: openMenu });
    buildTicker(tickerHost, { page: tickerPage, onPage: (i) => pageTicker(i) });
    buildTiles(tiles);
    applyLayout();
  };
  drawAll();
  // the entrance: the block's pieces from its own side (the right: the tiles slide in leftwards; mirrored, from the
  // left), the caption and the corner tools fade in last (motion.js homeEntrance; Reduce Motion: a 120 ms fade)
  const entrance = () => homeEntrance(side === 'l'
    ? { first: firstOpen, scene: stageHost.querySelector('.home-scene'), live: stageHost.querySelector('.home-live'), girl: stageHost.querySelector('.home-host'), top, rail: block, tools }
    : { first: firstOpen, scene: stageHost.querySelector('.home-scene'), live: stageHost.querySelector('.home-live'), girl: stageHost.querySelector('.home-host'), top, stack: [block], tools });
  entrance();
  enter(caption, 'fade', { base: firstOpen ? 420 : 120, dur: firstOpen ? 240 : 200 });
  const firstLayout = requestAnimationFrame(() => relayoutAll());
  scheduleTicker();
  // the entrance's window: from the render until it has played (the screen change settled, then 760 ms on a first
  // open, whose reveal began with the boot loader's 240 ms fade, so 1 s after the reveal: the wallpaper's settle; 540
  // ms on a return). Then .static: whatever has not finished (a starved phone that drew few frames) is shown as it
  // ends, and a redraw never plays it again.
  let entering = true;
  let staticTimer = 0;
  whenSettled().then(() => {
    if (!alive) return;
    staticTimer = setTimeout(() => {
      entering = false;
      el.classList.add('static');
    }, firstOpen ? 760 : 540);
  });

  // ---- the CO-OP tile's red number: open invites (read only once the social hub is ready) ----
  const paintInvites = () => setCoopCount(tiles.coop, lastInvites().count);
  const refreshInvites = () => openInvites().then(() => { if (alive) paintInvites(); }).catch(() => {});
  refreshInvites();
  const offHub = [hub.on('invites', refreshInvites), hub.on('status', refreshInvites), hub.on('badges', () => { refreshInvites(); if (alive) buildTop(top, { onMenu: openMenu }); })];
  // (the webfonts change the words' widths: she is placed again once they are in)
  document.fonts?.ready?.then(() => {
    if (!alive) return;
    relayoutAll();
    fitCaption();
  });

  // ---- hide the UI ----
  const setHidden = (on) => {
    el.classList.toggle('ui-hidden', on);
    restore.hidden = !on;
    stage.hideBubble();
    stage.relayout();
    relayoutLive();
  };
  restore.hidden = true;
  restore.addEventListener('click', () => setHidden(false));

  // ---- keys: Space plays the objective (desktop; never while a sheet, a dialog or a field has the keys) ----
  const onKey = (e) => {
    if (e.code !== 'Space' || e.repeat || menuSheetOpen() || document.querySelector('.modal-overlay, .ui-layer')) return;
    const t = e.target;
    if (t && (t.closest?.('input, textarea, select, button, a, [contenteditable]'))) return;
    if (el.classList.contains('ui-hidden')) return;
    e.preventDefault();
    objectivePlay(store.profile)();
  };
  window.addEventListener('keydown', onKey);

  const off = store.on('change', () => {
    drawAll();
    // (a redraw while the entrance still runs: the rebuilt pieces come in too, never popping in)
    if (entering) entrance();
    stage.relayout();
    showSecretary().catch(() => {});
    syncLive();
  });

  // the title screen (and the boot splash) stay over the lobby until her art has decoded
  showSecretary().catch(() => {}).finally(() => window.dispatchEvent(new CustomEvent('lobby-stage-ready')));

  // Beta Tester Thank-You: delivered on app start (main.js), also after a reset/import here, celebrated once a session
  if (ensureBetaGift(store.profile)) store.commit('mail');
  if (ensurePotentialLetter(store.profile)) store.commit('mail');
  if (ensureCatchUpJoins(store.profile).length) store.commit('mail'); // the catch-up girls after a reset or an import too
  // [story] never over a story scene or before a new player has met Hikari: try again when the scene ends
  const betaGift = () => {
    if (!el.isConnected) return;
    if (window.__sakura?.storyBusy || onboardingRoute(store.profile)) {
      window.addEventListener('story-end', () => setTimeout(betaGift, 400), { once: true });
      return;
    }
    maybeShowBetaGift();
  };
  const betaTimer = setTimeout(betaGift, reduceMotion() ? 50 : 700);

  // [ui-ink] the living scene's test hook (dev builds): a frame at t, her layers on or off, the scene's state
  if (import.meta.env?.DEV) {
    window.__sakura ||= {};
    // her still picture's placement (the face box, her scale and slide) and the controls' boxes she keeps clear of
    window.__sakura.home = { placement: () => stage.placement(), boxes: () => [...uiBoxes(), ...underBoxes()], current: () => stage.current()?.u?.id || null, layout: () => lay, side: () => side };
    window.__sakura.live = {
      get state() { return liveState; },
      get stats() { return engineStats ? { ...engineStats } : null; },
      canvases: () => document.querySelectorAll('canvas[data-live]').length,
      placement: () => (live ? live.handle.place : null),
      renderAt: (t) => live?.handle.renderAt(t),
      setGirlVisible: (on) => live?.handle.setGirlVisible(on),
      start: () => live?.handle.start(),
    };
  }

  // leaving: timers, listeners and her clock stop at once; her scene is disposed with the screen (router cleanup)
  const stop = () => {
    alive = false;
    offHub.forEach((fn) => fn());
    clearTimeout(betaTimer);
    clearTimeout(staticTimer);
    clearTimeout(tickerTimer);
    cancelAnimationFrame(firstLayout);
    off();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKey);
    closeMenuSheet();
    live?.handle.stop();
  };
  return Object.assign(() => {
    stop();
    disposeLive();
    stage.dispose();
  }, { stop });
}

// ---------------------------------------------------------------------------------------------
// Secretary lines (her bubble, one per tap)
// ---------------------------------------------------------------------------------------------

function greeting(now = new Date()) {
  const hr = now.getHours();
  if (hr < 5) return 'Still up, Sensei? Don\'t push yourself too hard.';
  if (hr < 11) return 'Good morning, Sensei! The sea is sparkling today.';
  if (hr < 17) return 'Welcome back, Sensei! I kept your desk tidy.';
  if (hr < 21) return 'Good evening, Sensei. One more mission before dinner?';
  return 'It\'s getting late, Sensei. Let\'s finish up together.';
}

/** Ordered lines the secretary says, one a tap (first = greeting / most urgent). */
export function secretaryLines(profile) {
  const u = getUnit(secretaryId(profile));
  const notice = commissionsNotice(profile);
  const next = nextStage(profile);
  const event = currentEvent();
  const lines = [];
  if (notice.login) lines.push('Your daily login gift is ready, Sensei!');
  else if (notice.missions) lines.push('Some commissions are finished. Let\'s collect the rewards!');
  else lines.push(greeting());
  lines.push(u.quote);
  if (next) lines.push(`Next mission: ${next} ${STAGE_MAP[next].name}. Shall we go?`);
  lines.push(`This week is ${event.name}! ${event.arenaName} Bounty drops are doubled.`);
  lines.push(...shownTips(u).slice(0, 2)); // (no ⚡ tips until the ability bar ships)
  return lines;
}

// ---------------------------------------------------------------------------------------------
// The top bar (floating): avatar + name + LV · tickets, coins, gems · chat, mail, menu
// ---------------------------------------------------------------------------------------------

/** A box to open in the Backpack (the menu's Backpack row wears a red dot). */
function hasBox(profile) {
  return Object.values(ITEMS).some((i) => i.category === 'gearbox' && itemCount(profile, i.id) > 0);
}

/** Clan donations to collect (the menu's Clan row wears a red dot). */
const clanDot = () => (hub.badges?.donationsReady || 0) > 0;

/**
 * A balance on the floating bar (12.1): its icon (coins and gems their colour art, kit.js curArt, owner Oct 27; tickets a
 * line glyph) and the number; its "+" (a 44 px tap) opens where to get more. Home layout C: only the gems keep a "+"
 * (the Mall sells tickets; coins come from battles).
 */
function pill({ glyph = null, art = null, amount, testid, label, onPlus = null, plusLabel = '', np = false }) {
  const value = formatNumber(amount);
  const num = h('span.num', { 'data-testid': testid });
  const el = h(`span.ui-pill${np ? '.np' : ''}`, { 'aria-label': `${label}: ${value}`, title: label, 'data-wallet': testid },
    art ? curArt(art) : g(glyph), num,
    onPlus ? h('button.ui-plus', { type: 'button', 'aria-label': plusLabel, title: plusLabel, 'data-testid': `${testid}-plus`, onclick: (e) => { e.stopPropagation(); onPlus(); } }, g('plus')) : null);
  // (a change since this balance was last on show counts there: motion.js countTo, shared with the day bar's wallets)
  countTo(num, amount, { key: testid });
  return el;
}

function buildTop(host, { onMenu }) {
  const profile = store.profile;
  clear(host);
  const mailCount = unclaimedMailCount(profile);
  const tickets = itemCount(profile, 'ticket_recruit') + 10 * itemCount(profile, 'ticket_recruit10');
  const a = accountLevel(profile);
  const name = storedName() || 'Sensei';
  const pct = a.need ? Math.max(0, Math.min(100, Math.round(a.pct * 100))) : 100;
  const avatarId = profile.sensei?.avatar || secretaryId(profile);
  const thumb = portraitUrl(UNIT_MAP[avatarId] || avatarId, 'thumb');
  const av = h('span.ui-av', thumb ? h('img', { src: thumb, alt: '', draggable: false, decoding: 'async' }) : null);
  av.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 32 32" aria-hidden="true"><circle class="trk" cx="16" cy="16" r="15.5"/><circle class="arc" cx="16" cy="16" r="15.5" pathLength="100" stroke-dasharray="${pct} 100" transform="rotate(-90 16 16)"/></svg>`);
  // [profile] the avatar opens the Sensei Profile (owner, Oct 15)
  const who = h('button.who', { type: 'button', 'data-testid': 'account-level', title: 'Sensei Profile', onclick: () => navigate('profile'),
    'aria-label': `Profile: ${name}, level ${a.level}${a.need ? `, ${pct}% of the way to level ${a.level + 1}` : ''}` },
  av, h('span.who-t', h('span.body.who-name', name), h('span.lv', h('span.lbl', 'LV'), h('span.num', String(a.level)))));
  const chat = chatButton(); // [online] global / clan chat drawer, its unread dot and the unread messages count
  chat.classList.remove('lb-tr-btn');
  chat.classList.add('ui-ibtn');
  (chat.querySelector('.lb-glyph') || chat.querySelector('svg'))?.replaceWith(g('chat'));
  const mail = h('button.ui-ibtn', { type: 'button', 'data-testid': 'top-mail', title: 'Mail', 'aria-label': mailCount ? `Mail, ${mailCount} unread` : 'Mail', onclick: () => openMailbox() },
    g('mail'), badge(mailCount ? h('span.ui-count', { 'data-testid': 'top-mail-count' }, formatNumber(mailCount)) : null, 'home:mail'));
  const newInside = noticeUnread() || journalDot(profile) || hasBox(profile) || clanDot();
  const menu = h('button.ui-ibtn', { type: 'button', 'data-testid': 'top-menu', title: 'Menu', 'aria-label': newInside ? 'Menu, something new inside' : 'Menu', 'aria-haspopup': 'dialog', onclick: onMenu },
    g('grid'), badge(newInside ? h('i.ui-dot', { 'data-testid': 'top-menu-dot' }) : null, 'home:menu'));
  host.append(
    who,
    h('span.sp'),
    pill({ glyph: 'ticket', amount: tickets, testid: 'tickets', label: 'Recruit tickets', np: true }),
    pill({ art: 'coins', amount: profile.currencies.coins, testid: 'coins', label: 'Coins', np: true }),
    pill({ art: 'gems', amount: profile.currencies.gems, testid: 'gems', label: 'Gems', onPlus: () => navigate('mall', { tab: 'gems' }), plusLabel: 'Get gems' }),
    h('span.ui-vr', { 'aria-hidden': 'true' }),
    chat, mail, menu,
  );
}

// ---------------------------------------------------------------------------------------------
// The mosaic: STUDENTS · RECRUIT · CO-OP · COMMISSIONS · MALL · BATTLE
// ---------------------------------------------------------------------------------------------

/** A tile's skin: its fill, ring and tick marks on a -8 degree layer (home.css .c-skin); art goes inside it. */
const skin = (...art) => h('span.c-skin', ...art, h('i.c-ticks'));

function buildTiles(tiles) {
  const profile = store.profile;
  const notice = commissionsNotice(profile);
  const fresh = openModes(modesOpenNow(profile)).length > 0;
  const tag = recruitTag(profile);
  const invites = lastInvites().count;
  const sec = secretaryId(profile);

  // STUDENTS: the girl who joined last (never the secretary), framed on her face (paintStudentsFace)
  const face = latestRecruit(profile, sec, hasPortrait);
  const t = tiles.students;
  t.dataset.face = face || '';
  t.replaceChildren(
    skin(face ? h('span.c-art.c-face', h('img', { src: portraitUrl(face, 'card'), alt: '', draggable: false, decoding: 'async', 'data-testid': 'students-face' })) : null),
    h('span.c-lbl.menu-lbl', face ? null : g('cap'), 'Students'));
  t.classList.toggle('has-face', !!face);

  // RECRUIT: the banner's three girls on the right, the cyan FREE PULL chip under the word
  const r = tiles.recruit;
  r.setAttribute('aria-label', tag ? `Recruit, ${tag.toLowerCase()}` : 'Recruit');
  r.replaceChildren(
    skin(h('span.c-art.c-banner', RECRUIT_FEATURED.map((id, i) => {
      const url = portraitUrl(id, 'cut');
      return url ? h(`img.s${i}`, { src: url, alt: '', draggable: false, decoding: 'async' }) : null;
    }))),
    h('span.c-col', h('span.c-lbl.menu-lbl', g('sparkles'), 'Recruit'), tag ? h('span.ui-chip.cy', { 'data-testid': 'recruit-free' }, tag) : null));

  // CO-OP: the red number of open invites
  const c = tiles.coop;
  c.replaceChildren(skin(), h('span.c-lbl.menu-lbl', g('users'), 'Co-op'));
  setCoopCount(c, invites);

  // COMMISSIONS (a red dot when something waits) and MALL
  const m = tiles.commissions;
  m.setAttribute('aria-label', notice.any ? 'Commissions, something to claim' : 'Commissions');
  m.onclick = () => navigate('commissions', notice.ach && !notice.missions && !notice.login ? { tab: 'achievements' } : {});
  m.replaceChildren(skin(), h('span.c-lbl.menu-lbl', g('clipboard'), h('span.w', 'Commissions'), badge(notice.any ? h('i.ui-dot') : null, 'home:tile:commissions')));
  tiles.mall.replaceChildren(skin(), h('span.c-lbl.menu-lbl', g('bag'), 'Mall'));

  // BATTLE: the biggest tile; its upper part opens Missions (tile-mission), its lower band the chapter (lobby-chapter)
  const { chapter, prog, complete } = campaignStatus(profile);
  let medals = 0;
  if (complete) for (const ch of CHAPTERS) for (const id of ch.stages) medals += Object.values(stageMedals(profile, id)).filter(Boolean).length;
  const b = tiles.battle;
  // (a narrow tile drops "Campaign · " from its kicker: home.css, a container query)
  const kicker = [h('span.kk', 'Campaign · '), chapter ? (complete ? 'All clear' : `Ch.${chapter.id}`) : 'Missions'];
  const go = h('button.c-go', { type: 'button', 'data-testid': 'tile-mission', 'aria-label': `Battle: missions${fresh ? ', something new is open' : ''}`, onclick: () => navigate('missions') },
    h('span.c-kick', h('span.lbl.cy', kicker), fresh ? h('span.ui-chip.cy', { 'data-testid': 'campaign-open' }, 'Open') : null),
    h('span.c-word', h('span.title', 'Battle')));
  const ticks = chapter && !complete ? h('span.c-prog', { 'aria-hidden': 'true', style: { '--n': prog.total } }, Array.from({ length: prog.total }, (_, k) => h(`i${k < prog.cleared ? '.on' : ''}`))) : null;
  const band = chapter ? h('button.c-chap', { type: 'button', 'data-testid': 'lobby-chapter', 'data-chapter': chapter.id,
    'aria-label': complete ? `Campaign, all clear: ${medals} medals` : `Campaign, chapter ${chapter.id}: ${chapter.name}, ${prog.cleared} of ${prog.total} stages cleared`,
    onclick: () => navigate('campaign', { chapter: chapter.id }) },
  h('span.c-chname.lbl', chapter.name), ticks, h('span.num', complete ? `${medals} medals` : `${prog.cleared}/${prog.total}`), g('chevR')) : null;
  b.replaceChildren(skin(h('span.c-yel', g('play'))), go, band);
  b.classList.toggle('no-band', !band);
}

/** The CO-OP tile's red number and its name, in place (a new invite, one that ended). */
function setCoopCount(tile, n) {
  tile.setAttribute('aria-label', `Co-op: ${multiplayerLabel(n)}`);
  const had = tile.querySelector('.ui-count');
  if (had && had.textContent === String(n)) return;
  had?.remove();
  const lbl = tile.querySelector('.c-lbl');
  badge(n > 0 ? (lbl || tile).appendChild(h('span.ui-count', { 'data-testid': 'lobby-multiplayer-count', title: multiplayerLabel(n) }, String(n))) : null, 'home:count:multiplayer');
}

/**
 * Words that do not fit their tile: the glyph steps aside, then the word tightens (13 px, never under the 12 px floor);
 * the chapter's name steps aside from BATTLE's band (its kicker says the chapter).
 */
function fitLabels(root) {
  for (const l of root.querySelectorAll('.c-tile .c-lbl')) {
    l.classList.remove('tight', 'tighter');
    const box = l.closest('.c-tile');
    const fits = () => l.scrollWidth <= l.clientWidth + 0.5 && l.getBoundingClientRect().right <= box.getBoundingClientRect().right - 4;
    if (!fits()) l.classList.add('tight');
    if (!fits()) l.classList.add('tighter');
  }
  for (const b of root.querySelectorAll('.c-battle .c-chap')) {
    b.classList.remove('noname');
    const n = b.querySelector('.c-chname');
    if (n && n.scrollWidth > n.clientWidth + 0.5) b.classList.add('noname');
  }
}

/** The Students tile's girl framed on her face: her eye line at 35 % of the tile, her face 36 px tall (desktop 72). */
function paintStudentsFace() {
  const t = document.querySelector('.home-c .c-students');
  const img = t?.querySelector('.c-face img');
  if (!img) return;
  const id = t.dataset.face;
  const tw = t.offsetWidth;
  const th = t.offsetHeight;
  if (!id || !tw || !th) return;
  const phone = innerHeight <= 480;
  const c = cardCrop(faceAnchor(id, 'card'), tw, th, { eyeAt: 0.35, faceH: phone ? 36 : 72 });
  Object.assign(img.style, { left: `${c.left}px`, top: `${c.top}px`, width: `${c.width}px`, height: `${c.height}px` });
}

// ---------------------------------------------------------------------------------------------
// The objective (first match wins: src/ui/lobbyTray.js homeObjective) and the ticker's pages
// ---------------------------------------------------------------------------------------------

function objectiveState(profile) {
  const rec = listBattleSaves(profile).find((r) => STAGE_MAP[r.stageId]);
  let save = null;
  if (rec) {
    const { name, mode } = saveTitle(rec);
    save = { name, mode, wave: saveSummary(rec).next, rec };
  }
  const login = loginCalendar(profile);
  const notice = commissionsNotice(profile);
  const f = featuredEvent(profile, eventNow());
  let event = null;
  if (f) {
    const w = eventWindow(f.ev);
    const end = f.phase === 'exchange' ? w.exchangeEndAt : f.phase === 'active' ? w.endAt : null;
    event = { name: f.ev.name, phase: f.phase, msLeft: end != null ? end - eventNow() : null, id: f.ev.id };
  }
  const { nextDef, chapter } = campaignStatus(profile);
  return {
    save,
    login: { ready: !!login.claimable, day: login.days?.find((d) => d.today)?.day || null },
    commissions: { count: notice.missionCount + notice.achCount, achOnly: !notice.missionCount && notice.achCount > 0 },
    event,
    next: nextDef ? { id: nextDef.id, name: nextDef.name } : null,
    chapter: chapter ? { id: chapter.id, name: chapter.name } : null,
  };
}

/** What the objective does now (its play square, the Space key). */
function objectivePlay(profile, s = objectiveState(profile), o = homeObjective(s)) {
  return () => {
    if (o.kind === 'continue') {
      const stage = STAGE_MAP[s.save.rec.stageId];
      return navigate('stage', s.save.rec.endless && stage.kind !== 'challenge' ? { id: stage.id, endless: 1 } : { id: stage.id });
    }
    if (o.kind === 'login') {
      const event = currentEvent();
      const r = claimLogin(profile);
      if (!r.ok) return navigate('commissions', { tab: 'login' });
      store.commit('login');
      return showRewardsModal({ title: `Login Day ${r.day}`, rewards: r.rewards, note: `${event.name} week — see you tomorrow, Sensei!` });
    }
    if (o.kind === 'commissions') return navigate('commissions', s.commissions.achOnly ? { tab: 'achievements' } : {});
    if (o.kind === 'event') return navigate('event', { id: s.event.id });
    if (o.kind === 'stage') return navigate('stage', { id: s.next.id });
    return navigate('campaign', s.chapter ? { chapter: s.chapter.id } : {});
  };
}

function newsState(profile) {
  const f = featuredEvent(profile, eventNow());
  let limited = null;
  if (f) {
    const w = eventWindow(f.ev);
    const at = f.phase === 'upcoming' ? w.startAt : f.phase === 'active' ? w.endAt : f.phase === 'exchange' ? w.exchangeEndAt : null;
    limited = { id: f.ev.id, name: f.ev.name, phase: f.phase, msLeft: at != null ? at - eventNow() : null, art: f.ev.currency?.id || null, ev: f.ev };
  }
  const event = currentEvent();
  const assaultOpen = isStageUnlocked(profile, 'boss-lych');
  const titansOpen = titansUnlocked(profile);
  return {
    limited,
    weekly: { name: event.name, arena: event.arena, dropMul: event.dropMul, msLeft: msToLocalWeekEnd() },
    bosses: { titans: { open: titansOpen, name: titansOpen ? TITAN_MAP[titanOfWeek()]?.name : null }, assault: { open: assaultOpen }, msLeft: msToLocalWeekEnd() },
  };
}

const PHASE_LABEL = { upcoming: 'Opens in', active: 'Ends in', exchange: 'Exchange closes in' };

/** The notice board's latest page (shown when no weekly boss is open yet). */
function noticePage() {
  const n = PATCH_NOTES[0];
  return n ? { kicker: `Notice · v${n.version}`, title: n.title, testid: 'news-notice' } : null;
}

/**
 * The ticker: one page (lobbyTray.js homeNews + homeObjective, ordered by homeLayout.js tickerPages), its edge (cyan
 * ticks; amber hazard stripes for a boss), "›" with its pips. A page turned comes in with a tick wipe.
 */
function buildTicker(host, { page = 0, onPage, wipe = false }) {
  const profile = store.profile;
  const s = newsState(profile);
  const os = objectiveState(profile);
  const o = homeObjective(os);
  const pages = tickerPages({ news: homeNews(s), objective: o, notice: noticePage() });
  clear(host);
  if (!pages.length) return;
  const i = ((page % pages.length) + pages.length) % pages.length;
  const n = pages[i];
  const redraw = () => { if (host.isConnected) onPage(i); };
  let main;
  if (n.id === 'objective') {
    main = h('button.go', { type: 'button', 'data-testid': 'lobby-objective', 'data-kind': o.kind, 'aria-label': `${o.kicker}: ${o.text}. Play`, onclick: objectivePlay(profile, os, o) },
      h('span.col', h('span.k', h('span.lbl.cy', o.kicker)), h('span.body', o.text)),
      h('span.ui-kbd', { 'aria-hidden': 'true' }, 'Space'),
      h('span.ui-play.c-sq', { 'data-testid': o.testid, title: o.kind === 'continue' ? `Continue your saved battle: ${os.save.name}` : null }, g('play')));
  } else {
    let chip = null;
    if (n.msLeft != null) {
      const urgent = n.id === 'event' && n.phase !== 'upcoming';
      chip = countdownChip(n.msLeft, { cls: 's', testid: n.timeTestid, urgent, now: n.id === 'event' ? eventNow : undefined, doneText: n.id === 'event' ? 'Ended' : 'New week!', onDone: redraw });
    }
    const go = () => {
      if (n.id === 'event') return navigate('event', { id: s.limited.id });
      if (n.id === 'weekly') return navigate('bounty', { arena: s.weekly.arena });
      if (n.id === 'notice') return showNoticeModal();
      if (n.testid === 'banner-titans') return navigate('titans');
      if (n.testid === 'banner-assault') return isStageUnlocked(profile, 'boss-lych') ? navigate('assault') : toast(requirementText(profile, 'boss-lych'), 'info');
      return null;
    };
    const when = n.msLeft != null && n.id === 'event' ? `, ${(PHASE_LABEL[n.phase] || 'Ends in').toLowerCase()} ${countdownState(n.msLeft).text}` : '';
    main = h('button.go', { type: 'button', 'data-testid': n.testid, 'aria-label': `${n.kicker}: ${n.title}${when}`, title: n.title, onclick: go },
      h('span.col', h('span.k', h('span.lbl.cy', n.kicker), chip), h('span.body', n.title)));
  }
  const edge = tickerEdge(n);
  const card = h('div.ui-news.home-ticker', { 'data-testid': 'lobby-news', 'data-page': n.id, 'data-edge': edge },
    h('i.tk-edge', { 'aria-hidden': 'true' }),
    h('span.tk-page', main),
    pages.length > 1 ? h('button.pager', { type: 'button', 'data-testid': 'lobby-news-next', 'aria-label': `Next card, ${i + 1} of ${pages.length}`, onclick: () => onPage(i + 1) },
      g('chevR'), h('span.ui-pips', pages.map((_, k) => h(`i${k === i ? '.on' : ''}`)))) : null);
  host.appendChild(card);
  if (wipe) tickWipe(card);
}

/** A page turned: the new page in from 12 px right (200 ms) behind a sweep of tick marks (240 ms); RM: a 120 ms fade. */
function tickWipe(card) {
  const pageEl = card.querySelector('.tk-page');
  if (!pageEl || typeof pageEl.animate !== 'function') return;
  try {
    const runs = [];
    if (motionReduced()) runs.push(pageEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'linear' }));
    else {
      runs.push(pageEl.animate([{ opacity: 0, transform: 'translateX(12px)' }, { opacity: 1, transform: 'none' }], { duration: 200, delay: 40, easing: 'cubic-bezier(0.3, 0, 0, 1)', fill: 'backwards' }));
      const sweep = h('i.tk-wipe', { 'aria-hidden': 'true' });
      card.appendChild(sweep);
      const a = sweep.animate([{ transform: 'translateX(-100%)', opacity: 1 }, { transform: 'translateX(250%)', opacity: 0.4 }], { duration: 240, easing: 'cubic-bezier(0.3, 0, 0, 1)' });
      a.onfinish = () => sweep.remove();
      a.oncancel = () => sweep.remove();
      runs.push(a);
    }
    // (a page that never drew a frame of it, a starved phone, shows the page as it ends: no animation outlives 400 ms)
    setTimeout(() => runs.forEach((r) => { if (r.playState !== 'finished') r.cancel(); }), 400);
  } catch {
    /* a card that left the page */
  }
}
