// The home (lobby) at night: UI v2 "Ink & Paper" (notes/ui-v2/UI_V2_DIRECTION.md 12.1 and 12.2), home layout A (the
// owner, Oct 27: "keep the new wallpaper concepts but change the layout"; Oct 24: "the homescreen is kinda packed"):
// fewer, calmer pieces, one obvious primary (BATTLE), the wallpaper and the girl are the show. Layers and the host:
// src/ui/lobby/artStage.js. Coordinates: src/ui/styles/home.css.
//
//   · the scene: the player's lobby background in the cooler night grade (public/art/lobby/<id>-home.webp, or the
//     kit's CSS grade): her stand over the academy (over an event's painted backdrop while it runs), or one of her full
//     illustrations (src/data/lobbyIllustrations.js: no stand, no bubble); the scrims, the secretary placed by her face
//     anchor (src/ui/faceAnchors.js) at 0.42 of the width on a phone, 0.40 on desktop (hostPlace.js homeTarget), her
//     bubble on a tap only; Marumi's living scene when she is the secretary on High or Medium graphics and no full
//     illustration is picked (src/ui/lobby/liveSlot.js)
//   · the floating top bar: the avatar with the account level's cyan EXP arc, the name and LV; tickets (a line glyph),
//     coins and gems (their colour art; gems keep their "+"); chat, mail (a red count) and the menu (a red dot when
//     something inside is new)
//   · two chips under the account: the news (paged by hand: the event, the weekly bosses, the notice) and the
//     objective (its play square cyan: the home's one yellow is BATTLE's)
//   · the right column, three slanted ink tiles, the biggest at the bottom in thumb reach: MULTIPLAYER (the red number
//     of open invites), RECRUIT (the pick-up girl's card art, a cyan FREE PULL chip), BATTLE (the one heavy italic and
//     the one yellow: its play edge; it opens Missions, with its OPEN chip) over the chapter band (the campaign)
//   · the dock in the bottom-left corner: STUDENTS, FORMATION, COMMISSIONS (a red dot), CLAN (a red dot), MALL: line
//     glyphs and labels on the bottom scrim, no plate at rest, a slanted plate on press; the corner tools (hide the UI,
//     background and secretary) in the bottom-right corner
//   · the main menu: a side sheet from the right (src/ui/lobby/menuSheet.js): what the home does not show
// The pure model (the objective's first-match order, the news card's pages): src/ui/lobbyTray.js.
// Motion (UI v2 motion layer, src/ui/motion.js, owner Oct 27): homeEntrance() brings the home in on its first open
// (from the boot loader or a battle's cut: waiting under the cover, playing from the reveal) and on every return from a
// sub-screen (shorter): the chips from the left, the tiles from the right, the dock up from the bottom; the balances
// count when they change; a red dot or count pops when it appears.
// Hooks: tile-mission on BATTLE (it opens Missions, with its "Open" chip, campaign-open), lobby-chapter on the chapter
// band, dock-recruit / recruit-free on RECRUIT, lobby-multiplayer(-count) on MULTIPLAYER, dock-students,
// dock-formation (new), dock-commissions, dock-clan, dock-mall on the dock, top-mail, top-menu, top-chat, tickets /
// coins / gems / gems-plus, account-level, lobby-hide / lobby-bg / lobby-restore, secretary-art / secretary-bubble,
// lobby-news / lobby-news-next with event-card / event-strip / banner-titans / banner-assault / news-notice pages,
// lobby-objective with lobby-continue / login-claim on its play square, lobby-live. Gone from the home: the tickets'
// "+" (the Mall still sells them), the recruit news page (RECRUIT is a tile now).
import '../styles/meta-a.css';
import '../styles/hubs.css';
import '../styles/home.css';
import { h, clear, toast, applyMotionPreference, accountLevel } from '../components.js';
import { countdownChip, curArt } from '../kit.js';
import { homeEntrance, countTo, badge, tabSwap, stagger, MOTION_UI } from '../motion.js';
import { whenSettled } from '../transitions/index.js';
import { openModes } from '../badges.js';
import { modesOpenNow } from '../modesOpen.js';
import { homeObjective, homeNews, multiplayerLabel, NEWS_MAX } from '../lobbyTray.js';
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
import { openBackgroundPicker } from '../lobby/bgPicker.js';
import { openMailbox, maybeShowBetaGift } from '../lobby/mailbox.js';
import { eventLobbyBackdrop, lobbyEventVisit } from '../events/lobby.js'; // [events]
import { eventNow } from '../events/clock.js';
import '../styles/events.css';
import { portraitUrl } from '../../art/portraits.js';
import { lobbyBackgroundFor, stageModeOf, LOBBY_BG_MAP } from '../../data/lobbyArt.js';
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
import { faceAnchor } from '../faceAnchors.js';
import { lineGlyph } from '../lineGlyphs.js';
import { onboardingRoute, journalDot } from '../../systems/story.js';
import { titansUnlocked, titanOfWeek } from '../../systems/titans.js'; // [ascension]
import { TITAN_MAP } from '../../data/titans.js';
import { shownTips } from '../../data/unitTips.js';
import { PATCH_NOTES } from '../../data/patchNotes.js';

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

/** Chapter / next-stage summary used by the chapter entry and the missions hub. */
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

/** Home layout A's left scrim ramp (home.css .home-a .ui-scrim.l): alpha 0.5 at the edge, 0.26 at 16 %, none from 28 %. */
export const HOME_A_SCRIM_L = Object.freeze([0.5, 0.16, 0.26, 0.28]);

/** The living scenes that failed in this session (each falls back to her still portrait until a reload). */
const liveFailed = new Set();
/** The engine module's stats, once it has been loaded (e2e: one context at most). */
let engineStats = null;

const sysReduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function render(root) {
  applyMotionPreference();
  let alive = true;
  const reduceMotion = () => !!store.profile.settings?.reduceMotion || sysReduced();
  // the home brings its own entrance (data-mo-own: the screen change only fades it in): its first open comes from a
  // cover (the boot loader, a battle's cut), a return from a menu slide
  const txKind = globalThis.document?.documentElement?.dataset?.tx || '';
  const firstOpen = !txKind || txKind === 'boot' || txKind === 'cut';
  const el = h('div.screen.lb.home.home-a', { 'data-testid': 'lobby', 'data-home-layout': 'a', 'data-mo-own': '', 'data-entrance': firstOpen ? 'first' : 'return' });
  const stageHost = h('div.home-stage-host');
  const top = h('header.ui-topbar.float.home-top');
  // home layout A: the two chips under the account, the right column of tiles, the dock, the corner tools. Each piece
  // sits in a host that stays for the screen's life (its entrance plays on the host, so a redraw mid-entrance never
  // pops a piece in); the dock's buttons are built once and only their dots are redrawn.
  const newsHost = h('div.home-news-host');
  const objHost = h('div.home-obj-host');
  const left = h('div.home-left', newsHost, objHost);
  const mpHost = h('div.home-mp-host');
  const recHost = h('div.home-rec-host');
  const battleHost = h('div.home-battle-host');
  const col = h('div.home-col', mpHost, recHost, battleHost);
  const dock = h('nav.home-dock', { 'aria-label': 'Main' });
  const tools = h('div.home-tools');
  const ui = h('div.home-ui', left, col, dock, tools);
  const restore = h('button.ui-ibtn.home-restore', { type: 'button', 'aria-label': 'Show the menus', title: 'Show the menus', 'data-testid': 'lobby-restore' }, g('image'));
  el.append(stageHost, ui, top, restore);
  let eventBackdrop = null;
  try {
    lobbyEventVisit(); // [events] today's event gift / settle, before the news card reads the state
    eventBackdrop = eventLobbyBackdrop(); // [events] its painted backdrop behind every stand while it runs (no overlay)
  } catch (e) {
    console.warn('[lobby] event backdrop failed', e);
  }
  root.appendChild(el);

  // ---- the stage: scene, scrims, the secretary ---------------------------------------------------------------
  let lineIndex = 0;
  let patIndex = 0;
  /**
   * The controls' boxes the secretary keeps 8 px clear of (5.5), as laid out: their entrance slide and the screen
   * change's own motion aside (a box read mid-slide would place her against where a control is passing through).
   * Home layout A leaves the dock out: it runs along the bottom edge on the bottom scrim, over her legs (no plates, line
   * glyphs and labels only), as a dock does; her face and everything above her knees stay clear of every control.
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
  const uiBoxes = () => {
    if (el.classList.contains('ui-hidden')) return [];
    const sel = [...top.children, ...left.querySelectorAll('.ui-obj, .ui-news'), ...col.querySelectorAll('.home-tile'), ...tools.children];
    const o = laidOut(el);
    return sel.filter((e) => e.offsetParent !== null).map((e) => {
      const b = laidOut(e);
      return { x: b.x - o.x, y: b.y - o.y, w: b.w, h: b.h };
    }).filter((b) => b.w > 0 && b.h > 0);
  };
  const stage = createArtStage(stageHost, {
    reduceMotion: reduceMotion(),
    boxes: uiBoxes,
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
    await stage.show(getUnit(id), { background: bg });
    syncLive();
  };

  // ---- the living scene (Marumi): one WebGL context at most, her still portrait otherwise ---------------------
  let live = null; // { id, handle, def }
  let liveToken = 0;
  let liveState = 'static';
  let loadingFor = '';
  // (home layout A's left scrim is a corner wash behind the chips, home.css: her scene draws the same ramp)
  const liveLayout = (def) => {
    const W = el.clientWidth || innerWidth;
    const H = el.clientHeight || innerHeight;
    return { W, H, place: def.place(W, H, uiBoxes()), scrimL: HOME_A_SCRIM_L };
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
    const portrait = (el.clientWidth || innerWidth) < (el.clientHeight || innerHeight);
    const want = liveSceneFor(id, { quality, reduceMotion: !!p.settings?.reduceMotion, prefersReduced: sysReduced(), webgl2: canWebGL2(), failed: liveFailed.has(id), portrait });
    // (her living scene stands in for her stand; a full illustration the player picked shows as it is)
    const illustration = stageModeOf(LOBBY_BG_MAP[currentBg]) === 'full';
    if (!want || illustration) {
      if (live || liveState === 'loading') disposeLive();
      return;
    }
    if (live?.id === id && live.quality === quality) return;
    if (liveState === 'loading' && loadingFor === `${id}:${quality}`) return; // (already on its way)
    disposeLive();
    const token = ++liveToken;
    liveState = 'loading';
    loadingFor = `${id}:${quality}`;
    try {
      const [mod, eng] = await Promise.all([want.load(), import('../lobby/live/engine.js')]);
      engineStats = eng.liveStats;
      if (token !== liveToken || !alive) return;
      const def = mod.default;
      const canvas = h('canvas.home-live-canvas', { 'data-live': id, 'aria-hidden': 'true' });
      stage.liveHost().replaceChildren(canvas);
      const lay = liveLayout(def);
      const handle = await eng.createLiveScene(canvas, def, { quality, base: import.meta.env?.BASE_URL || './', layout: lay, onLost: () => failLive(id) });
      if (token !== liveToken || !alive) {
        handle.dispose();
        canvas.remove();
        return;
      }
      live = { id, quality, handle, def };
      handle.renderAt(0);
      stage.setLive(true);
      stage.setLivePlacement(lay.place);
      handle.start();
      liveState = 'live';
    } catch (e) {
      if (token === liveToken) failLive(id, e);
    }
  }
  const relayoutLive = () => {
    if (!live) return;
    const lay = liveLayout(live.def);
    live.handle.layout(lay);
    stage.setLivePlacement(lay.place);
  };
  const onResize = () => {
    relayoutLive();
    syncLive(); // (a phone turned upright shows her still; turned back, her scene again)
  };
  window.addEventListener('resize', onResize);

  // ---- the UI --------------------------------------------------------------------------------------------------
  let newsPage = 0;
  const hideBtn = h('button.ui-ibtn', { type: 'button', 'aria-label': 'Hide the menus', title: 'Hide the menus', 'data-testid': 'lobby-hide', onclick: () => setHidden(true) }, g('eyeoff'));
  const bgBtn = h('button.ui-ibtn', { type: 'button', 'aria-label': 'Background and secretary', title: 'Background and secretary', 'data-testid': 'lobby-bg', onclick: () => openBackgroundPicker() }, g('image'));
  tools.append(hideBtn, bgBtn);

  // (the pager rebuilds only the news card)
  const pageNews = (n) => {
    newsPage = n;
    buildNews(newsHost, { page: newsPage, onPage: pageNews });
    tabSwap(newsHost.firstElementChild, 1); // (the next card: a 120 ms crossfade, 12 px in from the right)
  };
  function openMenu() {
    const p = store.profile;
    stage.hideBubble();
    openMenuSheet({
      reduced: reduceMotion(),
      dots: { backpack: hasBox(p), journal: journalDot(p), notice: noticeUnread() },
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
  buildDock(dock);
  const drawAll = () => {
    buildTop(top, { onMenu: openMenu });
    buildNews(newsHost, { page: newsPage, onPage: pageNews });
    buildObjective(objHost);
    buildMultiplayer(mpHost);
    buildRecruit(recHost);
    buildBattle(battleHost);
    paintDock(dock);
  };
  drawAll();
  // the entrance (motion.js homeEntrance): the wallpaper settles, the girl rises in, the bar comes down, the chips in
  // from the left and the tiles from the right 40 ms apart, the dock up from the bottom 30 ms apart, the tools last
  homeEntrance({ first: firstOpen, scene: stageHost.querySelector('.home-scene'), live: stageHost.querySelector('.home-live'),
    girl: stageHost.querySelector('.home-host'), top, rail: left, stack: [col], tools });
  stagger(dock.children, 'up', firstOpen
    ? { base: MOTION_UI.pieceFirstBase + MOTION_UI.pieceFirstStep, step: 30, dur: MOTION_UI.pieceFirst }
    : { base: MOTION_UI.pieceReturnBase + MOTION_UI.pieceReturnStep, step: 20, dur: MOTION_UI.pieceReturn });
  const firstLayout = requestAnimationFrame(() => stage.relayout());
  // the entrance's window: from the render until it has played (the screen change settled, then 760 ms on a first
  // open, whose reveal began with the boot loader's 240 ms fade, so 1 s after the reveal: the wallpaper's settle; 540
  // ms on a return). Then .static: whatever has not finished (a starved phone that drew few frames) is shown as it
  // ends, and a redraw never plays it again.
  let staticTimer = 0;
  whenSettled().then(() => {
    if (!alive) return;
    staticTimer = setTimeout(() => {
      el.classList.add('static');
    }, firstOpen ? 760 : 540);
  });

  // ---- the Multiplayer row's red number: open invites (read only once the social hub is ready) ----
  const paintInvites = () => {
    const row = col.querySelector('[data-testid="lobby-multiplayer"]');
    if (row) setMultiplayerCount(row, lastInvites().count);
  };
  const refreshInvites = () => openInvites().then(() => { if (alive) paintInvites(); }).catch(() => {});
  refreshInvites();
  const offHub = [hub.on('invites', refreshInvites), hub.on('status', refreshInvites), hub.on('badges', refreshInvites)];
  // (the webfonts change the words' widths, so the stack's and the rail's boxes: she is placed again once they are in)
  document.fonts?.ready?.then(() => {
    if (!alive) return;
    stage.relayout();
    relayoutLive();
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
    const obj = objHost.querySelector('[data-testid="lobby-objective"]');
    if (!obj || el.classList.contains('ui-hidden')) return;
    e.preventDefault();
    obj.click();
  };
  window.addEventListener('keydown', onKey);

  const off = store.on('change', () => {
    // (a redraw while the entrance still runs: the pieces are redrawn inside their hosts, which keep coming in)
    drawAll();
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
    window.__sakura.home = { placement: () => stage.placement(), boxes: uiBoxes, current: () => stage.current()?.u?.id || null };
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

/**
 * A balance on the floating bar (12.1): its icon (coins and gems their colour art, kit.js curArt, owner Oct 27; tickets a
 * line glyph) and the number; its "+" (a 44 px tap) opens where to get more.
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
  av, h('span.who-t', h('span.body.who-name', name), h('span.lv', h('span.lbl', 'LV'), h('span.num', String(a.level)))), h('span.serial', { 'aria-hidden': 'true' }, 'SNT-HQ'));
  const chat = chatButton(); // [online] global / clan chat drawer, its unread dot and the unread messages count
  chat.classList.remove('lb-tr-btn');
  chat.classList.add('ui-ibtn');
  (chat.querySelector('.lb-glyph') || chat.querySelector('svg'))?.replaceWith(g('chat'));
  const mail = h('button.ui-ibtn', { type: 'button', 'data-testid': 'top-mail', title: 'Mail', 'aria-label': mailCount ? `Mail, ${mailCount} unread` : 'Mail', onclick: () => openMailbox() },
    g('mail'), badge(mailCount ? h('span.ui-count', { 'data-testid': 'top-mail-count' }, formatNumber(mailCount)) : null, 'home:mail'));
  const newInside = noticeUnread() || journalDot(profile) || hasBox(profile);
  const menu = h('button.ui-ibtn', { type: 'button', 'data-testid': 'top-menu', title: 'Menu', 'aria-label': newInside ? 'Menu, something new inside' : 'Menu', 'aria-haspopup': 'dialog', onclick: onMenu },
    g('grid'), badge(newInside ? h('i.ui-dot', { 'data-testid': 'top-menu-dot' }) : null, 'home:menu'));
  host.append(
    who,
    h('span.sp'),
    // (home layout A: no "+" on tickets, the Mall still sells them; coins and gems wear their colour art)
    pill({ glyph: 'ticket', amount: tickets, testid: 'tickets', label: 'Recruit tickets', np: true }),
    pill({ art: 'coins', amount: profile.currencies.coins, testid: 'coins', label: 'Coins', np: true }),
    pill({ art: 'gems', amount: profile.currencies.gems, testid: 'gems', label: 'Gems', onPlus: () => navigate('mall', { tab: 'gems' }), plusLabel: 'Get gems' }),
    h('span.ui-vr', { 'aria-hidden': 'true' }),
    chat, mail, menu,
  );
}

// ---------------------------------------------------------------------------------------------
// The dock (home layout A): STUDENTS · FORMATION · COMMISSIONS · CLAN · MALL, along the bottom
// ---------------------------------------------------------------------------------------------

/** The dock's buttons (built once; paintDock() redraws their red dots). */
const DOCK = Object.freeze([
  Object.freeze({ id: 'students', label: 'Students', glyph: 'cap', testid: 'dock-students', route: 'students' }),
  Object.freeze({ id: 'formation', label: 'Formation', glyph: 'shield', testid: 'dock-formation', route: 'formation' }),
  Object.freeze({ id: 'commissions', label: 'Commissions', glyph: 'clipboard', testid: 'dock-commissions', route: 'commissions' }),
  Object.freeze({ id: 'clan', label: 'Clan', glyph: 'flag', testid: 'dock-clan', route: 'clan' }),
  Object.freeze({ id: 'mall', label: 'Mall', glyph: 'bag', testid: 'dock-mall', route: 'mall' }),
]);

function buildDock(host) {
  clear(host);
  for (const d of DOCK) {
    const go = () => {
      if (d.id !== 'commissions') return navigate(d.route);
      const notice = commissionsNotice(store.profile);
      return navigate('commissions', notice.ach && !notice.missions && !notice.login ? { tab: 'achievements' } : {});
    };
    host.appendChild(h('button.home-dk', { type: 'button', 'data-testid': d.testid, 'data-dock': d.id, 'aria-label': d.label, onclick: go },
      h('span.dk-ico', g(d.glyph)), h('span.lbl.dk-lbl', d.label)));
  }
}

/** The dock's red dots: Commissions (something to claim), Clan (a donation ready). */
function paintDock(host) {
  const profile = store.profile;
  const dots = { commissions: commissionsNotice(profile).any, clan: hub.badges.donationsReady > 0 };
  const aria = { commissions: 'Commissions, something to claim', clan: 'Clan, a donation is ready' };
  for (const btn of host.children) {
    const id = btn.dataset.dock;
    const on = !!dots[id];
    const had = btn.querySelector(':scope > .dk-ico > .ui-dot');
    btn.setAttribute('aria-label', on ? aria[id] : DOCK.find((d) => d.id === id)?.label || id);
    if (on === !!had) continue;
    had?.remove();
    badge(on ? btn.firstElementChild.appendChild(h('i.ui-dot')) : null, `home:dock:${id}`);
  }
}

// ---------------------------------------------------------------------------------------------
// The right column (home layout A): MULTIPLAYER · RECRUIT · BATTLE over the chapter band
// ---------------------------------------------------------------------------------------------

function buildMultiplayer(host) {
  const invites = lastInvites().count;
  clear(host);
  host.appendChild(h('button.home-tile.home-mp', { type: 'button', 'data-testid': 'lobby-multiplayer', 'aria-label': multiplayerLabel(invites), onclick: () => navigate('multiplayer') },
    g('users'), h('span.menu-lbl', 'Multiplayer'),
    badge(invites ? h('span.ui-count', { 'data-testid': 'lobby-multiplayer-count', title: multiplayerLabel(invites) }, String(invites)) : null, 'home:count:multiplayer')));
}

/** The Multiplayer tile's red number, in place (a new invite, one that ended). */
function setMultiplayerCount(row, n) {
  row.setAttribute('aria-label', multiplayerLabel(n));
  const had = row.querySelector('.ui-count');
  if (had && had.textContent === String(n)) return;
  had?.remove();
  badge(n > 0 ? row.appendChild(h('span.ui-count', { 'data-testid': 'lobby-multiplayer-count', title: multiplayerLabel(n) }, String(n))) : null, 'home:count:multiplayer');
}

/** The Recruit tile's girl: the first of the banner's pick-ups who is not the secretary (never her face twice). */
export function recruitPickup(secretary, featured = RECRUIT_FEATURED) {
  return featured.find((id) => id !== secretary && UNIT_MAP[id]) || null;
}

function buildRecruit(host) {
  const profile = store.profile;
  const tag = recruitTag(profile);
  const id = recruitPickup(secretaryId(profile));
  const url = id ? portraitUrl(UNIT_MAP[id], 'card') : null;
  // her card art in the tile's right part, framed on her face by her -card anchor (src/ui/faceAnchors.js): the words
  // stay in the left part, never over her face
  const a = id ? faceAnchor(id, 'card') : null;
  const art = url ? h('span.rec-art', { 'aria-hidden': 'true', style: { '--cx': String(a?.cx ?? 0.5), '--eye': String(a?.eye ?? 0.26) } },
    h('img', { src: url, alt: '', draggable: false, decoding: 'async', loading: 'eager' })) : null;
  clear(host);
  host.appendChild(h('button.home-tile.home-rec', { type: 'button', 'data-testid': 'dock-recruit', 'data-pickup': id || '', 'aria-label': tag ? `Recruit, ${tag.toLowerCase()}` : 'Recruit', onclick: () => navigate('recruit') },
    h('span.rec-t', g('sparkles'), h('span.menu-lbl', 'Recruit'), tag ? h('span.ui-chip.cy', { 'data-testid': 'recruit-free' }, tag) : null),
    art));
}

function buildBattle(host) {
  const profile = store.profile;
  const fresh = openModes(modesOpenNow(profile)).length > 0;
  const { chapter, prog, complete } = campaignStatus(profile);
  let medals = 0;
  if (complete) for (const c of CHAPTERS) for (const sid of c.stages) medals += Object.values(stageMedals(profile, sid)).filter(Boolean).length;
  // BATTLE opens Missions (as the Campaign tile did): its hook and its "Open" chip stay with it; the band under it is
  // the chapter entry (the campaign)
  const go = h('button.bt-go', { type: 'button', 'data-testid': 'tile-mission', 'aria-label': fresh ? 'Battle: missions, something new is open' : 'Battle: missions', onclick: () => navigate('missions') },
    h('span.bt-t',
      h('span.lbl.cy.bt-k', chapter && !complete ? `Campaign · Ch.${chapter.id}` : 'Campaign'),
      h('span.bt-title', 'Battle'),
      fresh ? h('span.ui-chip.cy.bt-open', { 'data-testid': 'campaign-open' }, 'Open') : null),
    h('span.bt-play', g('play'))); // (no aria-hidden: the probe counts it as the home's one yellow; the button has its name)
  const segs = chapter && !complete ? h('span.ui-seg', { style: { '--n': prog.total } }, Array.from({ length: prog.total }, (_, k) => h(`i${k < prog.cleared ? '.on' : ''}`))) : null;
  const band = chapter ? h('button.bt-chap', { type: 'button', 'data-testid': 'lobby-chapter', 'data-chapter': chapter.id,
    'aria-label': complete ? `Campaign, all clear: ${medals} medals` : `Campaign, chapter ${chapter.id}: ${chapter.name}, ${prog.cleared} of ${prog.total} stages cleared`,
    onclick: () => navigate('campaign', { chapter: chapter.id }) },
  h('span.lbl.ink.bt-name', complete ? 'All clear' : chapter.name), segs, h('span.num', complete ? `${medals} medals` : `${prog.cleared}/${prog.total}`), g('chevR')) : null;
  clear(host);
  host.appendChild(h('div.home-tile.home-battle', go, band));
}

// ---------------------------------------------------------------------------------------------
// The objective (the home's one yellow): first match wins (src/ui/lobbyTray.js homeObjective)
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

function buildObjective(host) {
  const profile = store.profile;
  const s = objectiveState(profile);
  const o = homeObjective(s);
  const play = () => {
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
  clear(host);
  // (home layout A: its words alone, two lines at most: they say what it is (a saved battle says "Continue"); the play
  // square is cyan ink: the home's one yellow is BATTLE's)
  const text = o.kind === 'continue' ? `${o.kicker}: ${o.text}` : o.text;
  host.appendChild(h('button.ui-obj.home-obj', { type: 'button', 'data-testid': 'lobby-objective', 'data-kind': o.kind, 'aria-label': `${o.kicker}: ${o.text}. Play`, title: `${o.kicker}: ${o.text}`, onclick: play },
    h('span.obj-t', h('span.body', text)),
    h('span.ui-play.cy', { 'data-testid': o.testid, title: o.kind === 'continue' ? `Continue your saved battle: ${s.save.name}` : null }, g('play'))));
}

// ---------------------------------------------------------------------------------------------
// The news card: up to three pages, paged by hand (src/ui/lobbyTray.js homeNews)
// ---------------------------------------------------------------------------------------------

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
    recruit: { pity: Math.max(0, GACHA.pity - (profile.gacha?.pity || 0)) },
    bosses: { titans: { open: titansOpen, name: titansOpen ? TITAN_MAP[titanOfWeek()]?.name : null }, assault: { open: assaultOpen }, msLeft: msToLocalWeekEnd() },
  };
}

const PHASE_LABEL = { upcoming: 'Opens in', active: 'Ends in', exchange: 'Exchange closes in' };

/**
 * The news chip's pages (home layout A): the model's pages (src/ui/lobbyTray.js homeNews) without the recruit page
 * (RECRUIT is a tile of its own), then the notice board's latest patch while there is room (it opens the Notice).
 */
export function homeNewsPages(s, latest = PATCH_NOTES[0]) {
  const pages = homeNews(s).filter((p) => p.id !== 'recruit');
  if (latest?.title && pages.length < NEWS_MAX) pages.push({ id: 'notice', kicker: 'Notice', title: latest.title, testid: 'news-notice', timeTestid: null, msLeft: null, phase: null, art: null });
  return pages;
}

function buildNews(host, { page = 0, onPage }) {
  const profile = store.profile;
  const s = newsState(profile);
  const pages = homeNewsPages(s);
  clear(host);
  if (!pages.length) return;
  const i = ((page % pages.length) + pages.length) % pages.length;
  const n = pages[i];
  const redraw = () => { if (host.isConnected) onPage(i); };
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
  // (home layout A: one run of words over two lines at most: a kicker, the countdown, the title (the countdown first, so
  // a long title never pushes it out of the two lines); no thumbnail: the chip stays small. An event's name is its own headline (no kicker); the Titan Trials show the titan's name under
  // their own kicker.)
  const titan = n.testid === 'banner-titans' && s.bosses?.titans?.name ? s.bosses.titans.name : null;
  const kickerText = titan ? 'Titan Trials' : n.kicker;
  const kicker = n.id === 'event' || n.id === 'weekly' ? null : h('span.lbl.cy', kickerText);
  const title = titan || n.title;
  host.appendChild(h('div.ui-news.home-news', { 'data-testid': 'lobby-news', 'data-page': n.id },
    h('button.go', { type: 'button', 'data-testid': n.testid, 'aria-label': `${n.kicker}: ${n.title}${when}`, title: n.title, onclick: go },
      h('span.run', kicker, kicker ? ' ' : null, chip, chip ? ' ' : null, h('span.body', title))),
    pages.length > 1 ? h('button.pager', { type: 'button', 'data-testid': 'lobby-news-next', 'aria-label': `Next card, ${i + 1} of ${pages.length}`, onclick: () => onPage(i + 1) },
      g('chevR'), h('span.ui-pips', pages.map((_, k) => h(`i${k === i ? '.on' : ''}`)))) : null));
}
