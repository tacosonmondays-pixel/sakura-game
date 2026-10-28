// The home (lobby) at night: UI v2 "Ink & Paper", home layout B "Quiet Home" (owner, Oct 27: keep the new wallpapers,
// change the layout: the home was "kinda packed"; the Oct 27 layout study, notes/ui-v2). Fewer, calmer pieces; the
// wallpaper and the girl are the show; one obvious primary (Battle). Layers and the host: src/ui/lobby/artStage.js.
// Coordinates: src/ui/styles/home.css.
//
//   · the scene: the player's lobby background in the cooler night grade (public/art/lobby/<id>-home.webp, or the
//     kit's CSS grade): her stand over the academy (over an event's painted backdrop while it runs), or one of her full
//     illustrations (src/data/lobbyIllustrations.js: no stand, no bubble); her face in the middle of the screen
//     (src/ui/lobby/hostPlace.js homeTarget), her bubble on a tap only; Marumi's living scene when she is the secretary
//     on High or Medium graphics and no full illustration is picked (src/ui/lobby/liveSlot.js). Scrims: the bottom one
//     and a soft wash in each top corner only (her side stays ungraded)
//   · the floating top bar: the avatar with the account level's cyan EXP arc, the name and LV; tickets (shown only),
//     coins (shown only) and gems (with its "+"), the coin and gem in their colour art; chat, mail (a red count) and the
//     menu (a red dot when something inside is new, Clan donations too)
//   · one news chip, top left: up to three pages, turned by hand only by its "›" (a 240 ms wipe; nothing on the home turns
//     on its own: UI v2 rule 11, P8). A running event leads, so its name and countdown show at landing; a saved battle
//     leads before it; otherwise the objective (the login gift, commissions) leads; then the weekly bosses, the Notice or
//     the recruit banner fill a free page (src/ui/lobbyTray.js homeChipPages)
//   · four icons, bottom left: STUDENTS, RECRUIT (a FREE sticker for a free pull), COMMISSIONS (a red dot), MALL; no plates
//   · the Battle plate, bottom right in thumb reach (the home's one yellow: its play edge; the one heavy italic): its
//     upper zone opens Missions (with its OPEN chip), its lower band the campaign's chapter; CO-OP rides on its top-left
//     corner as a tab (the red number of open invites)
//   · the corners never swap: Battle stays bottom right in thumb reach for every girl and picture; a full illustration
//     shows whole, as painted (never zoomed), panned toward the middle where the picture allows (artStage.js placeFull)
//   · the main menu: a side sheet from the right, in groups (src/ui/lobby/menuSheet.js); its head carries hide the UI
//     and the background picker; a long press (600 ms) on the wallpaper hides the UI too
// The pure model (the objective's first-match order, the news pages): src/ui/lobbyTray.js.
// Motion (UI v2 motion layer, src/ui/motion.js, owner Oct 27): homeEntrance() brings the scene, the girl and the bar in
// on the first open (from the boot loader or a battle's cut: waiting under the cover, playing from the reveal) and on
// every return from a sub-screen (shorter); its stagger() brings the chip, the icons and the plate in from their own
// edges; the balances count when they change; a red dot or count pops when it appears.
// Keys (src/ui/keys.js, data-keys="on"): Space presses Battle, Esc closes the top dismissable window (the Notice, the
// background picker, a rewards modal) as a tap outside it would; Tab reads the top bar first; a redraw (a store change,
// the hub's badges, a page turn) gives the focus back to the control that had it.
// Hooks kept from UI M5 and V2: tile-mission on the Battle plate (it opens Missions) with its "Open!" chip
// (campaign-open), lobby-chapter on its band, lobby-multiplayer(-count) on CO-OP, dock-students / dock-recruit /
// dock-commissions / dock-mall on the icons (recruit-free on the FREE sticker), dock-clan in the menu, top-mail, top-menu,
// top-chat, tickets / coins / gems, gems-plus, account-level, lobby-hide / lobby-bg in the menu's head, lobby-restore,
// secretary-art / secretary-bubble, lobby-news / lobby-news-next on the chip, event-card / event-strip(-time),
// banner-titans / banner-assault / banner-recruit on its pages, lobby-objective (lobby-continue / login-claim on its play
// square) on the objective's page; lobby-live. New: home-battle, home-dock, lobby-news-notice.
import '../styles/meta-a.css';
import '../styles/hubs.css';
import '../styles/home.css';
import { h, clear, toast, applyMotionPreference, accountLevel } from '../components.js';
import { countdownChip, curArt } from '../kit.js';
import { homeEntrance, stagger, countTo, badge, MOTION_UI } from '../motion.js';
import { whenSettled } from '../transitions/index.js';
import { openModes } from '../badges.js';
import { modesOpenNow } from '../modesOpen.js';
import { homeObjective, homeNews, homeChipPages, multiplayerLabel } from '../lobbyTray.js';
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
import { itemIcon } from '../../art/icons.js';
import { nextStage, chapterProgress, isStageUnlocked, stageMedals } from '../../systems/unlocks.js';
import { missionList, loginCalendar, achievementNotice, claimLogin, currentEvent } from '../../systems/missions.js';
import { featuredEvent, eventWindow } from '../../systems/events.js';
import { itemCount } from '../../systems/inventory.js';
import { canSpark } from '../../systems/gacha.js';
import { listBattleSaves, saveSummary, saveTitle } from '../../systems/battleSave.js';
import { showRewardsModal, requirementText } from './stage.js';
import { createArtStage } from '../lobby/artStage.js';
import { secretaryOf } from '../lobby/secretaryOf.js';
import { showNoticeModal, noticeUnread } from '../lobby/notice.js';
import { openMenuSheet, closeMenuSheet, menuSheetOpen } from '../lobby/menuSheet.js';
import { liveSceneFor, canWebGL2 } from '../lobby/liveSlot.js';
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

/** Chapter / next-stage summary used by the Battle plate and the missions hub. */
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

const sysReduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A press this long on the wallpaper (not on her, not on a control) hides the UI, or brings it back (ms). */
export const LONG_PRESS_MS = 600;

export function render(root) {
  applyMotionPreference();
  let alive = true;
  const reduceMotion = () => !!store.profile.settings?.reduceMotion || sysReduced();
  // the home brings its own entrance (data-mo-own: the screen change only fades it in): its first open comes from a
  // cover (the boot loader, a battle's cut), a return from a menu slide
  const txKind = globalThis.document?.documentElement?.dataset?.tx || '';
  const firstOpen = !txKind || txKind === 'boot' || txKind === 'cut';
  const el = h('div.screen.lb.home', { 'data-testid': 'lobby', 'data-layout': 'b', 'data-mo-own': '', 'data-keys': 'on', 'data-entrance': firstOpen ? 'first' : 'return' });
  const stageHost = h('div.home-stage-host');
  const top = h('header.ui-topbar.float.home-top');
  const newsHost = h('div.home-news-host');
  const dock = h('nav.home-dock', { 'aria-label': 'Main', 'data-testid': 'home-dock' });
  const battleHost = h('div.home-battle', { 'data-testid': 'home-battle' });
  const ui = h('div.home-ui', newsHost, dock, battleHost);
  const restore = h('button.ui-ibtn.home-restore', { type: 'button', 'aria-label': 'Show the menus', title: 'Show the menus', 'data-testid': 'lobby-restore' }, g('image'));
  // (the bar first: Tab reads it before the corners, as the eye does; the layers' z-index does the stacking)
  el.append(stageHost, top, ui, restore);
  // [online] the chat button, made once for this home: its hub listeners and its watch live as long as the home does,
  // and every redraw of the bar puts the same button back (src/ui/online/lobbyChat.js)
  const chat = homeChat();
  let eventBackdrop = null;
  try {
    lobbyEventVisit(); // [events] today's event gift / settle, before the news chip reads the state
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
  // each box says what it is (kind): 'ctl' a control, 'pill' a wallet's plate (shown only), 'gap' the bar's spacer and
  // rule, 'soft' the words and icon inside a wallet. Her stand keeps clear of all of them; a full illustration keeps her
  // hair clear of the controls first and of the wallets' words and icons where the picture allows (artStage.js placeFull)
  const kindOf = (e) => (e.classList.contains('ui-spacer') || e.classList.contains('ui-vr') ? 'gap' : e.classList.contains('ui-pill') ? 'pill' : 'ctl');
  // (all: the controls' boxes while the UI is hidden too: whether her living scene can stand here at all)
  const uiBoxes = ({ all = false } = {}) => {
    if (!all && el.classList.contains('ui-hidden')) return [];
    const sel = [...top.children, ...dock.children, ...newsHost.querySelectorAll('.ui-news'), ...battleHost.querySelectorAll('.home-plate, .home-coop')];
    const inner = [...top.querySelectorAll(':scope > .ui-pill > *')];
    const o = laidOut(el);
    // (the news chip counts at its two-line height on every page: a page turn never brings it over her)
    const ncs = getComputedStyle(newsHost);
    const tall = parseFloat(ncs.getPropertyValue('--news-tall')) || 0;
    const up = ncs.getPropertyValue('--news-up').trim() === '1';
    return [
      ...sel.filter((e) => e.offsetParent !== null).map((e) => {
        const b = laidOut(e);
        const grow = e.classList.contains('ui-news') ? Math.max(0, tall - b.h) : 0;
        return { x: b.x - o.x, y: b.y - o.y - (up ? grow : 0), w: b.w, h: b.h + grow, kind: kindOf(e) };
      }),
      // (a wallet's icon may be an SVG, which has no offset box: its place inside its pill, from the pill's laid-out box)
      ...inner.map((e) => {
        const pill = e.parentElement;
        const pb = laidOut(pill);
        const pr = pill.getBoundingClientRect();
        const r = e.getBoundingClientRect();
        return { x: pb.x - o.x + r.left - pr.left, y: pb.y - o.y + r.top - pr.top, w: r.width, h: r.height, kind: e.matches('button') ? 'ctl' : 'soft' };
      }),
    ].filter((b) => b.w > 0 && b.h > 0);
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

  /**
   * A girl whose art reaches into the icons' corner where she stands (Marumi's ball, a wide stand on a narrow screen):
   * the four icons fold two by two (.fold) and she is placed again. Tried afresh for each girl and screen.
   */
  const placedFits = () => {
    const pl = live ? live.handle.place : stage.placement();
    return !pl || pl.fits !== false;
  };
  const refold = () => {
    const wide = (el.clientWidth || innerWidth) > (el.clientHeight || innerHeight);
    if (el.classList.contains('fold')) {
      el.classList.remove('fold');
      stage.relayout();
      relayoutLive();
    }
    if (wide && !placedFits()) {
      el.classList.add('fold');
      stage.relayout();
      relayoutLive();
    }
    lowerNews();
  };
  /**
   * A full illustration never zooms (owner: the whole picture as it is), so where the picture cannot pan her face away
   * from the news chip (a 3:4 picture exactly filling an upright tablet, 768x1024), the chip moves instead: down, above
   * the four icons (.news-down), and she is placed again.
   */
  const lowerNews = () => {
    const had = el.classList.contains('news-down');
    el.classList.remove('news-down');
    if (had) stage.relayout();
    const sc = !live && stage.placement()?.scene;
    const chip = newsHost.querySelector('.ui-news');
    if (!sc || !chip || el.classList.contains('ui-hidden')) return;
    const r = sc.r;
    const core = { x0: sc.faceX - 0.85 * r - 4, x1: sc.faceX + 0.85 * r + 4, y0: sc.faceY - 0.6 * r - 4, y1: sc.faceY + 0.95 * r + 4 };
    // (the chip's resting box, not its slide-in, at its two-line height: as uiBoxes counts it)
    const hb = newsHost.getBoundingClientRect();
    const tall = parseFloat(getComputedStyle(newsHost).getPropertyValue('--news-tall')) || hb.height;
    const up = getComputedStyle(newsHost).getPropertyValue('--news-up').trim() === '1';
    const h = Math.max(hb.height, tall);
    const b = { left: hb.left, right: hb.right, top: up ? hb.bottom - h : hb.top, bottom: up ? hb.bottom : hb.top + h };
    if (b.right > core.x0 && b.left < core.x1 && b.bottom > core.y0 && b.top < core.y1) {
      // (above the icons as they stand now: one row, or two by two on a narrow screen)
      el.style.setProperty('--dock-h', `${Math.round(dock.getBoundingClientRect().height)}px`);
      el.classList.add('news-down');
      stage.relayout();
    }
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
    // (the chip waits unseen until she is placed, so a chip that moves for her face never jumps: lowerNews)
    el.classList.add('news-wait');
    const timer = setTimeout(() => el.classList.remove('news-wait'), 1500);
    try {
      await stage.show(getUnit(id), { background: bg });
      refold();
      syncLive();
    } finally {
      clearTimeout(timer);
      if (currentBg === bg.id) el.classList.remove('news-wait');
    }
  };

  // ---- the living scene (Marumi): one WebGL context at most, her still portrait otherwise ---------------------
  let live = null; // { id, handle, def }
  let liveToken = 0;
  let liveState = 'static';
  let loadingFor = '';
  let liveWhy = ''; // why her still portrait shows while her scene could play: 'fit' (it would reach a control)
  const liveLayout = (def) => {
    const W = el.clientWidth || innerWidth;
    const H = el.clientHeight || innerHeight;
    return { W, H, place: def.place(W, H, uiBoxes()) };
  };
  /**
   * Her living scene plays only where all of her art (the ball and both hands too) can keep 8 px clear of every control
   * (5.5, C5), with the four icons in a row or folded two by two, at 80 % of the cover fit or more (live/marumi.js). Where
   * neither does (a small phone: 667x375), her still portrait shows instead, as it does on Low graphics. Asked with the
   * controls' boxes even while the UI is hidden, so hiding the UI never swaps her picture.
   */
  const liveFits = (def) => {
    const W = el.clientWidth || innerWidth;
    const H = el.clientHeight || innerHeight;
    const was = el.classList.contains('fold');
    let ok = false;
    for (const fold of [false, true]) {
      el.classList.toggle('fold', fold);
      if (def.place(W, H, uiBoxes({ all: true })).fits !== false) {
        ok = true;
        break;
      }
    }
    el.classList.toggle('fold', was);
    return ok;
  };
  const disposeLive = () => {
    liveToken++;
    if (live) {
      live.handle?.dispose();
      live = null;
    }
    stage.liveHost().replaceChildren();
    if (stage.isLive()) {
      stage.setLive(false);
      if (alive) refold(); // (her still portrait may stand clear of the icons in a row)
    }
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
      liveWhy = '';
      return;
    }
    if (live?.id === id && live.quality === quality) {
      // (the screen or its controls changed under her: where her scene would reach a control now, her still portrait)
      if (!liveFits(live.def)) {
        disposeLive();
        liveWhy = 'fit';
      }
      return;
    }
    if (liveState === 'loading' && loadingFor === `${id}:${quality}`) return; // (already on its way)
    disposeLive();
    const token = ++liveToken;
    liveState = 'loading';
    loadingFor = `${id}:${quality}`;
    try {
      const def = (await want.load()).default;
      if (token !== liveToken || !alive) return;
      if (!liveFits(def)) {
        // her still portrait stays (no engine, no WebGL context)
        liveState = 'static';
        loadingFor = '';
        liveWhy = 'fit';
        return;
      }
      const eng = await import('../lobby/live/engine.js');
      engineStats = eng.liveStats;
      if (token !== liveToken || !alive) return;
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
      liveWhy = '';
      refold();
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
    fitTexts();
    relayoutLive();
    refold();
    syncLive(); // (a phone turned upright shows her still; turned back, her scene again)
  };
  window.addEventListener('resize', onResize);

  // ---- the UI --------------------------------------------------------------------------------------------------
  /**
   * A redraw keeps the keyboard where it was: when a control of the home had the focus and the redraw took it away (the
   * control was made again, or put back), the control with the same hook gets it back, else the first control of the
   * same corner. (A pager pressed twice, a store change on a focused icon, the hub's badges under a focused button.)
   */
  const keepFocus = (draw) => {
    const had = document.activeElement;
    const mine = had && had !== document.body && el.contains(had) ? had : null;
    const id = mine?.getAttribute('data-testid');
    const zone = mine ? [top, newsHost, dock, battleHost].find((z) => z.contains(mine)) : null;
    draw();
    if (!mine || document.activeElement === mine) return;
    if (document.activeElement && document.activeElement !== document.body) return; // (it moved on by itself)
    const next = (mine.isConnected && mine) || (id && el.querySelector(`[data-testid="${CSS.escape(id)}"]`))
      || zone?.querySelector('button:not([disabled]), a[href]');
    next?.focus({ preventScroll: true });
  };

  let newsPage = 0;
  // the news chip turns by hand only, by its "›" (UI v2 rule 11, P8: nothing on the home turns on its own); the pager
  // rebuilds only the chip: the old words wipe out to the left, the new in from the right
  const pageNews = (n) => {
    const old = newsHost.querySelector('.ui-news');
    newsPage = n;
    keepFocus(() => buildNews(newsHost, { page: newsPage, onPage: (k) => pageNews(k) }));
    wipeNews(newsHost, old, reduceMotion());
    fitTexts();
  };

  // the menu sheet: Hide the UI and the background picker ride in its head. Upright or on a narrow landscape screen
  // her stage slides aside under it as far as her face box needs (src/ui/styles/home.css .menu-shift)
  const shiftForSheet = (sheet) => {
    const pl = stage.placement();
    const W = el.clientWidth || innerWidth;
    const H = el.clientHeight || innerHeight;
    if (!pl?.face || W < H) return;
    const edge = sheet.getBoundingClientRect().left - 16;
    const right = pl.face.x + pl.face.w;
    const dx = Math.max(-pl.face.x + 8, Math.min(0, edge - right));
    if (dx < -0.5) {
      stageHost.style.setProperty('--sheet-dx', `${Math.round(dx)}px`);
      el.classList.add('menu-shift');
    }
  };
  /** A window opened from the menu (the Notice, the background picker): once it closes, the keys go back to the menu
   * button (the sheet closed itself first), unless something else took them meanwhile. */
  function focusMenuAfterWindow() {
    let seen = false;
    const mo = new MutationObserver(() => {
      const openNow = !!document.querySelector('.modal-overlay:not(.closing)');
      if (openNow) { seen = true; return; }
      if (!seen) return;
      mo.disconnect();
      const a = document.activeElement;
      if (alive && (!a || a === document.body)) top.querySelector('[data-testid="top-menu"]')?.focus({ preventScroll: true });
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    // (never left watching: a window that never opened, or the home gone)
    setTimeout(() => { if (!seen) mo.disconnect(); }, 2000);
    offWatch.push(() => mo.disconnect());
  }
  const offWatch = [];
  function openMenu() {
    const p = store.profile;
    stage.hideBubble();
    const sh = openMenuSheet({
      reduced: reduceMotion(),
      opener: () => top.querySelector('[data-testid="top-menu"]'),
      dots: { backpack: hasBox(p), journal: journalDot(p), notice: noticeUnread(), clan: clanDot() },
      tools: [
        { id: 'hide', label: 'Hide UI', aria: 'Hide the menus', glyph: 'eyeoff', testid: 'lobby-hide', go: () => setHidden(true) },
        { id: 'bg', label: 'Background', aria: 'Background and secretary', glyph: 'image', testid: 'lobby-bg', go: () => { openBackgroundPicker(); focusMenuAfterWindow(); } },
      ],
      onClose: () => el.classList.remove('menu-shift'),
      go: (row) => {
        if (row.id === 'notice') {
          showNoticeModal();
          drawAll();
          focusMenuAfterWindow();
          return;
        }
        navigate(row.route);
      },
    });
    shiftForSheet(sh.el);
  }
  const drawAll = () => {
    keepFocus(() => {
      buildTop(top, { onMenu: openMenu, chat });
      buildDock(dock);
      buildNews(newsHost, { page: newsPage, onPage: (k) => pageNews(k) });
      buildBattle(battleHost);
    });
    fitTexts();
    lowerNews();
  };
  drawAll();
  /** The pieces come in from their own edges (the kit's stagger, 40 ms apart on a first open, 30 on a return): the chip
   * from the left, the four icons up from the bottom one by one, then CO-OP and the plate from the right. */
  const pieceEntrance = () => {
    const M = MOTION_UI;
    const o = firstOpen ? { base: M.pieceFirstBase, step: M.pieceFirstStep, dur: M.pieceFirst } : { base: M.pieceReturnBase, step: M.pieceReturnStep, dur: M.pieceReturn };
    let i = stagger(newsHost.querySelectorAll('.ui-news'), 'left', o);
    i += stagger(dock.children, 'up', { ...o, start: i });
    stagger(battleHost.querySelectorAll('.home-coop, .home-plate'), 'right', { ...o, start: i });
  };
  homeEntrance({ first: firstOpen, scene: stageHost.querySelector('.home-scene'), live: stageHost.querySelector('.home-live'),
    girl: stageHost.querySelector('.home-host'), top });
  pieceEntrance();
  const firstLayout = requestAnimationFrame(() => stage.relayout());
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

  // ---- CO-OP's red number: open invites (read only once the social hub is ready) ----
  const paintInvites = () => {
    const row = battleHost.querySelector('[data-testid="lobby-multiplayer"]');
    if (row) setMultiplayerCount(row, lastInvites().count);
  };
  const refreshInvites = () => openInvites().then(() => { if (alive) paintInvites(); }).catch(() => {});
  refreshInvites();
  const offHub = [hub.on('invites', refreshInvites), hub.on('status', refreshInvites), hub.on('badges', () => {
    refreshInvites();
    if (alive) keepFocus(() => buildTop(top, { onMenu: openMenu, chat }));
  })];
  // (the webfonts change the words' widths, so the controls' boxes: she is placed again once they are in)
  document.fonts?.ready?.then(() => {
    if (!alive) return;
    fitTexts();
    stage.relayout();
    relayoutLive();
    refold();
    syncLive();
  });

  // ---- hide the UI (the menu's Hide UI, a long press on the wallpaper; the restore button or a long press again) ----
  const setHidden = (on) => {
    el.classList.toggle('ui-hidden', on);
    restore.hidden = !on;
    stage.hideBubble();
    stage.relayout();
    relayoutLive();
    if (!on) lowerNews(); // (a resize while hidden may have changed where the chip must stand)
  };
  restore.hidden = true;
  restore.addEventListener('click', () => setHidden(false));
  let press = null;
  let pressFired = false;
  const endPress = () => {
    if (press) clearTimeout(press.timer);
    press = null;
  };
  el.addEventListener('pointerdown', (e) => {
    endPress();
    pressFired = false;
    if (e.button > 0 || !e.isPrimary) return;
    // (the wallpaper only: not her, not a control, not the bar)
    if (e.target.closest?.('button, a, [role="button"], input, .home-host, .home-top, .home-ui > *, .home-bubble')) return;
    press = { x: e.clientX, y: e.clientY, timer: setTimeout(() => {
      press = null;
      pressFired = true;
      setHidden(!el.classList.contains('ui-hidden'));
    }, LONG_PRESS_MS) };
  });
  el.addEventListener('pointermove', (e) => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) endPress(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, endPress);
  // (a long press on a phone would open the picture's own menu: the wallpaper has none)
  stageHost.addEventListener('contextmenu', (e) => { if (pressFired || press) e.preventDefault(); });

  // ---- keys: Space presses Battle, the home's primary (desktop; never while a sheet, a dialog or a field has the keys) ----
  const onKey = (e) => {
    if (e.code !== 'Space' || e.repeat || menuSheetOpen() || document.querySelector('.modal-overlay, .ui-layer, .ol-drawer')) return;
    const t = e.target;
    if (t && (t.closest?.('input, textarea, select, button, a, [contenteditable]'))) return;
    const go = battleHost.querySelector('[data-testid="tile-mission"]');
    if (!go || el.classList.contains('ui-hidden')) return;
    e.preventDefault();
    go.click();
  };
  window.addEventListener('keydown', onKey);

  const off = store.on('change', () => {
    drawAll();
    // (a redraw while the entrance still runs: the rebuilt pieces come in too, never popping in)
    if (entering) pieceEntrance();
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
    window.__sakura.home = {
      placement: () => stage.placement(), boxes: uiBoxes, current: () => stage.current()?.u?.id || null,
    };
    window.__sakura.live = {
      get state() { return liveState; },
      get why() { return liveWhy; },
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
    endPress();
    cancelAnimationFrame(firstLayout);
    off();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKey);
    closeMenuSheet();
    for (const off of offWatch.splice(0)) off();
    chat.release?.();
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
 * line glyph) and the number; its "+" (a 44 px tap) opens where to get more. Home layout B: only the gems keep a "+"
 * (the Mall is one tap away for tickets and coins).
 */
function pill({ glyph = null, art = null, amount, testid, label, onPlus = null, plusLabel = '' }) {
  const value = formatNumber(amount);
  const num = h('span.num', { 'data-testid': testid });
  const el = h(`span.ui-pill${onPlus ? '' : '.np'}`, { 'aria-label': `${label}: ${value}`, title: label, 'data-wallet': testid },
    art ? curArt(art) : g(glyph), num,
    onPlus ? h('button.ui-plus', { type: 'button', 'aria-label': plusLabel, title: plusLabel, 'data-testid': `${testid}-plus`, onclick: (e) => { e.stopPropagation(); onPlus(); } }, g('plus')) : null);
  // (a change since this balance was last on show counts there: motion.js countTo, shared with the day bar's wallets)
  countTo(num, amount, { key: testid });
  return el;
}

/**
 * The home's chat button (src/ui/online/lobbyChat.js) in the kit's look: made once per home render (lobby.js render),
 * its counts kept up by its own hub listeners; release() lets them go with the home.
 */
function homeChat() {
  const chat = chatButton(); // [online] global / clan chat drawer, its unread dot and the unread messages count
  chat.classList.remove('lb-tr-btn');
  chat.classList.add('ui-ibtn');
  (chat.querySelector('.lb-glyph') || chat.querySelector('svg'))?.replaceWith(g('chat'));
  return chat;
}

function buildTop(host, { onMenu, chat }) {
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
  const mail = h('button.ui-ibtn', { type: 'button', 'data-testid': 'top-mail', title: 'Mail', 'aria-label': mailCount ? `Mail, ${mailCount} unread` : 'Mail', onclick: () => openMailbox() },
    g('mail'), badge(mailCount ? h('span.ui-count', { 'data-testid': 'top-mail-count' }, formatNumber(mailCount)) : null, 'home:mail'));
  // (Clan lives in the menu on this home: its donations ready light the menu's dot too)
  const newInside = noticeUnread() || journalDot(profile) || hasBox(profile) || hub.badges.donationsReady > 0;
  const menu = h('button.ui-ibtn', { type: 'button', 'data-testid': 'top-menu', title: 'Menu', 'aria-label': newInside ? 'Menu, something new inside' : 'Menu', 'aria-haspopup': 'dialog', onclick: onMenu },
    g('grid'), badge(newInside ? h('i.ui-dot', { 'data-testid': 'top-menu-dot' }) : null, 'home:menu'));
  const clan = HOME_CLAN === 'top' ? clanButton(h('button.ui-ibtn', { type: 'button', title: 'Clan' }), g('flag')) : null;
  host.append(
    who,
    // (the spacer is .ui-spacer, never .sp: that is the story scene player's root, a fixed full-screen layer, story.css)
    h('span.ui-spacer'),
    pill({ glyph: 'ticket', amount: tickets, testid: 'tickets', label: 'Recruit tickets' }),
    pill({ art: 'coins', amount: profile.currencies.coins, testid: 'coins', label: 'Coins' }),
    pill({ art: 'gems', amount: profile.currencies.gems, testid: 'gems', label: 'Gems', onPlus: () => navigate('mall', { tab: 'gems' }), plusLabel: 'Get gems' }),
    h('span.ui-vr', { 'aria-hidden': 'true' }),
    chat, clan, mail, menu,
  );
}

/**
 * Clans on the home (owner, Oct 28: "add an icon for clans"): the Menu's flag glyph, a red dot when donations are ready
 * to collect or a clan invite waits (as the Menu's Clan row), opening the clan screen. Where it stands: 'top' an icon
 * button in the top right cluster beside chat, mail and the menu (the recommended one: the four icons keep their row),
 * or 'dock' a fifth shortcut CLAN after MALL.
 */
export const HOME_CLAN = 'top';
const clanDot = () => hub.badges.donationsReady > 0 || hub.badges.clanInvites > 0;
function clanButton(btn, glyph) {
  const dot = clanDot();
  btn.dataset.testid = 'home-clan';
  btn.setAttribute('aria-label', dot ? 'Clan, something new' : 'Clan');
  btn.addEventListener('click', () => navigate('clan'));
  btn.append(...[glyph, badge(dot ? h('i.ui-dot', { 'data-testid': 'home-clan-dot' }) : null, 'home:clan')].filter(Boolean));
  return btn;
}

// ---------------------------------------------------------------------------------------------
// The four icons, bottom left: STUDENTS · RECRUIT · COMMISSIONS · MALL (a glyph over a caps label; no plates; RECRUIT
// wears a small FREE sticker for a free pull, inside its own cell, COMMISSIONS a red dot for something to claim)
// ---------------------------------------------------------------------------------------------

function buildDock(host) {
  const profile = store.profile;
  const notice = commissionsNotice(profile);
  const tag = recruitTag(profile);
  const items = [
    { id: 'students', label: 'Students', glyph: 'cap', testid: 'dock-students', go: () => navigate('students') },
    { id: 'recruit', label: 'Recruit', glyph: 'sparkles', testid: 'dock-recruit', aria: tag ? `Recruit, ${tag.toLowerCase()}` : null, go: () => navigate('recruit'),
      // (a free pull or a spark says so in words: the badge vocabulary's ink sticker, 5.10)
      sticker: tag ? { testid: 'recruit-free', title: tag, text: tag === 'Free pull' ? 'Free' : 'Spark' } : null },
    { id: 'commissions', label: 'Commissions', glyph: 'clipboard', testid: 'dock-commissions', dot: notice.any, aria: notice.any ? 'Commissions, something to claim' : null,
      go: () => navigate('commissions', notice.ach && !notice.missions && !notice.login ? { tab: 'achievements' } : {}) },
    { id: 'mall', label: 'Mall', glyph: 'bag', testid: 'dock-mall', go: () => navigate('mall') },
  ];
  if (HOME_CLAN === 'dock') items.push({ id: 'clan', label: 'Clan', glyph: 'flag', testid: 'home-clan', dot: clanDot(), aria: clanDot() ? 'Clan, something new' : 'Clan', go: () => navigate('clan') });
  clear(host);
  for (const r of items) {
    host.appendChild(h('button.home-ico', { type: 'button', 'data-testid': r.testid, 'data-dock': r.id, 'aria-label': r.aria || r.label, onclick: r.go },
      h('span.ico', g(r.glyph), badge(r.dot ? h('i.ui-dot') : null, `home:dock:${r.id}`)),
      h('span.lbl', r.label),
      // (the sticker sits in the cell's own top right corner, never across the hairline into the next cell)
      badge(r.sticker ? h('span.ui-bdg.new.home-free', { 'data-testid': r.sticker.testid, title: r.sticker.title, 'aria-hidden': 'true' }, r.sticker.text) : null, `home:dock:${r.id}:free`)));
  }
}

// ---------------------------------------------------------------------------------------------
// The Battle plate (bottom right; the home's one yellow and its one heavy italic) and CO-OP on its corner
// ---------------------------------------------------------------------------------------------

function buildBattle(host) {
  const profile = store.profile;
  const fresh = openModes(modesOpenNow(profile)).length > 0;
  const { chapter, prog, complete } = campaignStatus(profile);
  const invites = lastInvites().count;
  clear(host);
  const coop = h('button.home-coop', { type: 'button', 'data-testid': 'lobby-multiplayer', 'aria-label': multiplayerLabel(invites), onclick: () => navigate('multiplayer') },
    g('users'), h('span.lbl', 'Co-op'),
    badge(invites ? h('span.ui-count', { 'data-testid': 'lobby-multiplayer-count', title: multiplayerLabel(invites) }, String(invites)) : null, 'home:count:multiplayer'));
  // the upper zone opens Missions (as the Campaign tile did), its "Open!" chip with it; its right edge is the yellow play
  // (a narrow plate drops the kicker's first word: "Ch.4")
  const kicker = chapter ? [h('span.kl', 'Campaign · '), complete ? 'All clear' : `Ch.${chapter.id}`] : 'Missions';
  const go = h('button.home-go', { type: 'button', 'data-testid': 'tile-mission', 'aria-label': `Battle${fresh ? ', a new mode is open' : ''}: missions`, onclick: () => navigate('missions') },
    h('span.txt',
      h('span.k', h('span.lbl.cy', kicker), fresh ? h('span.ui-bdg.open.home-open', { 'data-testid': 'campaign-open' }, 'Open') : null),
      h('span.title', 'Battle')),
    h('span.ui-kbd', { 'aria-hidden': 'true' }, 'Space'),
    h('span.home-play', g('play')));
  const plate = h('div.home-plate', go);
  if (chapter) {
    let medals = 0;
    if (complete) for (const c of CHAPTERS) for (const id of c.stages) medals += Object.values(stageMedals(profile, id)).filter(Boolean).length;
    const segs = complete ? null : h('span.ui-seg', { style: { '--n': prog.total } }, Array.from({ length: prog.total }, (_, k) => h(`i${k < prog.cleared ? '.on' : ''}`)));
    plate.appendChild(h('button.home-chapter', { type: 'button', 'data-testid': 'lobby-chapter', 'data-chapter': chapter.id,
      'aria-label': complete ? `Campaign, all clear: ${medals} medals` : `Campaign, chapter ${chapter.id}: ${chapter.name}, ${prog.cleared} of ${prog.total} stages cleared`,
      onclick: () => navigate('campaign', { chapter: chapter.id }) },
    h('span.txt', h('span.body.chap-name', chapter.name), h('span.prog', segs, h('span.num', complete ? `${medals} medals` : `${prog.cleared}/${prog.total}`))), g('chevR')));
  }
  host.append(coop, plate);
}

/** CO-OP's red number, in place (a new invite, one that ended). */
function setMultiplayerCount(row, n) {
  row.setAttribute('aria-label', multiplayerLabel(n));
  const had = row.querySelector('.ui-count');
  if (had && had.textContent === String(n)) return;
  had?.remove();
  badge(n > 0 ? row.appendChild(h('span.ui-count', { 'data-testid': 'lobby-multiplayer-count', title: multiplayerLabel(n) }, String(n))) : null, 'home:count:multiplayer');
}

// ---------------------------------------------------------------------------------------------
// The objective: first match wins (src/ui/lobbyTray.js homeObjective); on this home a page of the news chip when there
// is something to act on (a saved battle, the login gift, commissions, an event that asks; lobbyTray.js
// CHIP_OBJECTIVES): the next story stage and medals are the Battle plate's own job
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

/** What the objective's play does. */
function playObjective(o, s) {
  const profile = store.profile;
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
}

// ---------------------------------------------------------------------------------------------
// The news chip: up to three pages (a running event or the objective first, then the other, the weekly bosses; the
// Notice or the recruit banner fill a free page), turned by its "›" only (src/ui/lobbyTray.js homeChipPages)
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

/** The chip's pages in order (src/ui/lobbyTray.js homeChipPages): a saved battle, else a running event, else the
 * objective first; then the event or the objective, the weekly bosses, the unread Notice and the recruit banner while a
 * page is free; three at most. */
function chipPages(profile) {
  const s = objectiveState(profile);
  const notice = noticeUnread() ? { id: 'notice', kicker: 'Notice', title: 'Patch notes and news', testid: 'lobby-news-notice', timeTestid: null, msLeft: null, phase: null, art: null } : null;
  return homeChipPages({ objective: homeObjective(s), news: homeNews(newsState(profile)), notice }).map((pg) => (pg.id === 'objective' ? { ...pg, s } : pg));
}

const PHASE_LABEL = { upcoming: 'Opens in', active: 'Ends in', exchange: 'Exchange closes in' };

function buildNews(host, { page = 0, onPage }) {
  const profile = store.profile;
  const pages = chipPages(profile);
  clear(host);
  if (!pages.length) return;
  const i = ((page % pages.length) + pages.length) % pages.length;
  const n = pages[i];
  const redraw = () => { if (host.isConnected) onPage(i); };
  let body;
  if (n.id === 'objective') {
    // the objective's page: its play square (cyan ink: the home's one yellow is Battle's) carries the old chip's hook
    const { o, s } = n;
    body = h('button.go.obj', { type: 'button', 'data-testid': 'lobby-objective', 'data-kind': o.kind, 'aria-label': `${o.kicker}: ${o.text}. Play`, onclick: () => playObjective(o, s) },
      h('span.ui-play.cy', { 'data-testid': o.testid, title: o.kind === 'continue' ? `Continue your saved battle: ${s.save.name}` : null }, g('play')),
      h('span.col', h('span.k', h('span.lbl', o.kicker)), h('span.body', o.text)));
  } else {
    let chip = null;
    if (n.msLeft != null) {
      const urgent = n.id === 'event' && n.phase !== 'upcoming';
      chip = countdownChip(n.msLeft, { cls: 's', testid: n.timeTestid, urgent, now: n.id === 'event' ? eventNow : undefined, doneText: n.id === 'event' ? 'Ended' : 'New week!', onDone: redraw });
    }
    const st = n.id === 'event' || n.id === 'weekly' ? newsState(profile) : null;
    const go = () => {
      if (n.id === 'event') return navigate('event', { id: st.limited.id });
      if (n.id === 'weekly') return navigate('bounty', { arena: st.weekly.arena });
      if (n.id === 'recruit') return navigate('recruit');
      if (n.id === 'notice') {
        showNoticeModal();
        return store.commit('notice');
      }
      if (n.testid === 'banner-titans') return navigate('titans');
      if (n.testid === 'banner-assault') return isStageUnlocked(profile, 'boss-lych') ? navigate('assault') : toast(requirementText(profile, 'boss-lych'), 'info');
      return null;
    };
    const when = n.msLeft != null && n.id === 'event' ? `, ${(PHASE_LABEL[n.phase] || 'Ends in').toLowerCase()} ${countdownState(n.msLeft).text}` : '';
    const thumb = n.art ? h('span.ui-thumb', { html: itemIcon(n.art, { px: 34 }) }) : h('span.ui-thumb', g(n.id === 'weekly' ? 'map' : n.id === 'notice' ? 'megaphone' : 'sparkles'));
    // (a page with a short kicker carries both: fitTexts shows the short one where the long one would wrap)
    const kicker = n.short ? [h('span.kl', n.kicker), h('span.ks', n.short)] : n.kicker;
    body = h('button.go', { type: 'button', 'data-testid': n.testid, 'aria-label': `${n.kicker}: ${n.title}${when}`, title: n.title, onclick: go },
      thumb,
      h('span.col', h('span.k', h('span.lbl', kicker), chip), h('span.body', n.title)));
  }
  host.appendChild(h('div.ui-news.home-news', { 'data-testid': 'lobby-news', 'data-page': n.id, 'data-pages': pages.length },
    body,
    pages.length > 1 ? h('button.pager', { type: 'button', 'data-testid': 'lobby-news-next', 'aria-label': `Next card, ${i + 1} of ${pages.length}`, onclick: () => onPage(i + 1) },
      h('span.num', `${i + 1}/${pages.length}`), g('chevR')) : null));
}

/**
 * A page turn's wipe (240 ms): the old words leave 12 px to the left as they fade (120 ms), the new come in from 12 px
 * right (200 ms, 40 ms after). Reduce Motion: a 120 ms fade, nothing moves. Opacity and transforms only (WAAPI).
 * @param {HTMLElement} host the chip's host (the new card is in it)
 * @param {HTMLElement|null} old the card that was there
 * @param {boolean} reducedNow
 */
function wipeNews(host, old, reducedNow) {
  const card = host.querySelector('.ui-news');
  const next = card?.querySelector('.go');
  if (!next || typeof next.animate !== 'function') return;
  try {
    if (reducedNow) {
      next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'linear' });
      return;
    }
    next.animate([{ opacity: 0, transform: 'translateX(12px)' }, { opacity: 1, transform: 'none' }], { duration: 200, delay: 40, easing: 'cubic-bezier(0.3, 0, 0, 1)', fill: 'backwards' });
    const was = old?.querySelector('.go');
    if (!was) return;
    // (the old words, a still copy with no hooks, laid over the new card while they leave)
    const ghost = was.cloneNode(true);
    for (const e of [ghost, ...ghost.querySelectorAll('[data-testid]')]) e.removeAttribute('data-testid');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    ghost.classList.add('ghost');
    ghost.style.width = `${was.offsetWidth}px`;
    card.appendChild(ghost);
    ghost.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-12px)' }], { duration: 120, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' })
      .finished.then(() => ghost.remove(), () => ghost.remove());
  } catch {
    /* a card that left the page */
  }
}

/**
 * Long words step down instead of clipping (6, 12.1): a kicker that would wrap takes its short form (WEEKLY BOSSES →
 * BOSSES beside the countdown on a phone), and the news chip's line wraps to a second line and the chip grows (46 → 60 px
 * on phones).
 */
function fitTexts() {
  const lines = (e) => {
    const cs = getComputedStyle(e);
    const lh = cs.lineHeight.endsWith('px') ? parseFloat(cs.lineHeight) : parseFloat(cs.fontSize) * 1.2;
    return e.getBoundingClientRect().height / lh;
  };
  for (const card of document.querySelectorAll('.home .home-news')) {
    const body = card.querySelector('.go:not(.ghost) .body');
    if (!body) continue;
    card.classList.remove('two', 'kshort');
    const k = card.querySelector('.go:not(.ghost) .k .lbl');
    if (k?.querySelector('.ks') && lines(k) > 1.5) card.classList.add('kshort');
    if (lines(body) > 1.5) card.classList.add('two');
  }
}
