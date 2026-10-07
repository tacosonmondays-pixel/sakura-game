// Lobby V3 (owner: ui / meta-a). Blue Archive–style home screen, landscape-first:
//   · a painted club office by the sea in three parallax layers (sky/sea · room · foreground)
//   · the secretary as the hero: a large full-detail 3D chibi (~83% of the screen height) with
//     idle + breathing, pointer follow, tap reactions and a speech bubble; ‹ › swap her
//   · UI hugging the edges: level badge (top-left), dark slanted currency pills, a dark pill with
//     Settings / Mail / Menu (top-right), ⤢ hide-UI, a 2×2 column of illustrated shortcuts
//     (Notice, Tasks, Login gift, Buy gems), an event/banner carousel, the bottom-left EVENT
//     card, Total Assault + the big Campaign folder (bottom-right) and a thin translucent dock
//     of illustrated icons (Students … Recruit) with the clock at its right end
import '../styles/meta-a.css';
import { h, clear, svgEl, modal, toast, levelBadge, menuTabModal, glyph, applyMotionPreference } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { STAGE_MAP, CHAPTERS } from '../../data/stages.js';
import { UNIT_MAP, getUnit } from '../../data/units.js';
import { GACHA } from '../../data/types.js';
import { lobbyRoomSVG, themeBackdropSVG } from '../../art/backdrops.js';
import { lobbyIcon, campaignFolderSVG } from '../../art/lobbyIcons.js';
import { cardArtSVG } from '../../art/cardArt.js';
import { itemIcon, currencyIcon } from '../../art/icons.js';
import { nextStage, ownedUnits, chapterProgress, isStageUnlocked } from '../../systems/unlocks.js';
import { missionList, loginCalendar, achievementList, claimLogin, currentEvent, f2pIncomeSummary } from '../../systems/missions.js';
import { itemCount } from '../../systems/inventory.js';
import { canSpark } from '../../systems/gacha.js';
import { showRewardsModal, card, requirementText } from './stage.js';
import { createSecretaryStage } from '../lobby/secretary.js';
import { showNoticeModal, noticeUnread, eventDaysLeft, ARENA_THEME, RECRUIT_FEATURED } from '../lobby/notice.js';

/** Anything claimable in Commissions? */
export function commissionsNotice(profile) {
  try {
    const ml = missionList(profile);
    const all = [...ml.daily, ...ml.weekly];
    const missions = all.some((m) => m.claimable);
    const claimable = all.filter((m) => m.claimable).length;
    const login = loginCalendar(profile).claimable;
    const ach = achievementList(profile).filter((a) => a.claimable).length;
    const dailyDone = ml.daily.filter((m) => m.claimed || m.claimable).length;
    return { any: missions || login || ach > 0, missions, login, ach: ach > 0, count: claimable + ach + (login ? 1 : 0), dailyDone, dailyTotal: ml.daily.length };
  } catch {
    return { any: false, missions: false, login: false, ach: false, count: 0, dailyDone: 0, dailyTotal: 0 };
  }
}

function recruitNotice(profile) {
  return itemCount(profile, 'ticket_recruit') > 0 || itemCount(profile, 'ticket_recruit10') > 0 || canSpark(profile);
}

/** Chapter / next-stage summary used by the Campaign button and the missions hub. */
export function campaignStatus(profile) {
  const next = nextStage(profile);
  const nextDef = next ? STAGE_MAP[next] : null;
  const chapter = CHAPTERS.find((c) => c.id === (nextDef?.chapter || CHAPTERS[CHAPTERS.length - 1].id));
  const prog = chapter ? chapterProgress(profile, chapter.id) : null;
  return { next, nextDef, chapter, prog, complete: !nextDef };
}

/** The lobby secretary: profile.secretary when owned, else the hero, else the first girl. */
export function secretaryId(profile) {
  const id = profile.secretary;
  if (id && UNIT_MAP[id] && profile.units?.[id]) return id;
  if (profile.formation?.hero && profile.units?.[profile.formation.hero]) return profile.formation.hero;
  return ownedUnits(profile)[0] || 'hikari';
}

/** Owned girls in a stable order (roster order of UNIT_MAP) for the ‹ › chevrons. */
export function secretaryCycle(profile, dir = 1) {
  const owned = Object.keys(UNIT_MAP).filter((id) => profile.units?.[id]);
  if (!owned.length) return secretaryId(profile);
  const i = owned.indexOf(secretaryId(profile));
  return owned[(Math.max(0, i) + dir + owned.length) % owned.length];
}

// Room layers are generated once per session and kept as blob URLs (an <img> rasterises the
// SVG once; cheap to move for parallax, no thousands of DOM nodes).
const layerUrls = {};
function roomLayerUrl(layer) {
  if (!layerUrls[layer]) {
    const svg = lobbyRoomSVG(layer);
    try {
      layerUrls[layer] = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    } catch {
      layerUrls[layer] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }
  }
  return layerUrls[layer];
}

let iconSeq = 0;
/** Illustrated lobby icon wrapped in a span (unique gradient ids per instance). */
function icon(name, cls = 'lb-ico') {
  return svgEl(lobbyIcon(name, { uid: `${name}-${++iconSeq}` }), cls);
}

const HEAD_PAT_LINES = [
  'E-eh? My halo is not a button, Sensei…',
  'Hehe… one more pat? Just one!',
  'W-what are you doing, Sensei?! …I don\'t mind.',
  'If you keep patting me, I\'ll forget my work!',
];

export function render(root) {
  applyMotionPreference();
  const profile0 = store.profile;
  const reduceMotion = !!profile0.settings?.reduceMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const el = h('div.screen.lb', { 'data-testid': 'lobby' });

  // ---- room (parallax layers) -------------------------------------------------------------
  const room = h('div.lb-room', { 'aria-hidden': 'true' },
    h('img.lb-layer.lb-far', { src: roomLayerUrl('far'), alt: '', draggable: false }),
    h('img.lb-layer.lb-mid', { src: roomLayerUrl('mid'), alt: '', draggable: false }),
    h('div.lb-shafts'),
  );
  const stageHost = h('div.lb-stage');
  const near = h('img.lb-layer.lb-near', { src: roomLayerUrl('near'), alt: '', draggable: false, 'aria-hidden': 'true' });
  const motes = h('div.lb-motes', { 'aria-hidden': 'true' },
    Array.from({ length: 12 }, (_, i) => h(`i.lb-petal.p${i}`)),
    Array.from({ length: 8 }, (_, i) => h(`i.lb-mote.m${i}`)));
  const hud = h('div.lb-hud');
  const nameplate = h('div.lb-nameplate', { 'aria-live': 'polite' });
  const restore = h('button.lb-restore', { 'aria-label': 'Show the menus', 'data-testid': 'lobby-restore' });
  el.append(room, stageHost, near, motes, nameplate, hud, restore);
  root.appendChild(el);

  // ---- secretary --------------------------------------------------------------------------
  let lineIndex = 0;
  let patIndex = 0;
  const lines = () => secretaryLines(store.profile);
  const stage = createSecretaryStage(stageHost, {
    reduceMotion,
    quality: profile0.settings?.quality || 'medium',
    onTap: (part, at) => {
      stage.react(part, at);
      if (part === 'head') stage.say(HEAD_PAT_LINES[patIndex++ % HEAD_PAT_LINES.length]);
      else {
        const l = lines();
        lineIndex = (lineIndex + 1) % l.length;
        stage.say(l[lineIndex]);
      }
    },
  });
  let currentSec = null;
  const showSecretary = async (direction = 0) => {
    const p = store.profile;
    const id = secretaryId(p);
    if (id === currentSec && !direction) return;
    currentSec = id;
    const u = getUnit(id);
    stage.hideBubble();
    await stage.show(u, { direction, awaken: p.units[id]?.awaken || 0 });
    if (currentSec !== id) return;
    lineIndex = 0;
    setTimeout(() => stage.say(lines()[0]), direction ? 120 : 650);
    if (direction) flashName(u);
  };
  const flashName = (u) => {
    clear(nameplate);
    nameplate.append(h('b', u.name), h('span', u.title));
    nameplate.classList.remove('show');
    void nameplate.offsetWidth;
    nameplate.classList.add('show');
  };
  const swap = (dir) => {
    const p = store.profile;
    const next = secretaryCycle(p, dir);
    if (next === secretaryId(p)) return toast('Recruit more girls to change your secretary!', 'info');
    p.secretary = next;
    swapping = dir;
    store.commit('secretary');
  };
  let swapping = 0;

  // ---- HUD --------------------------------------------------------------------------------
  const top = h('header.lb-top');
  const hideBtn = h('button.lb-hide', { title: 'Hide the menus', 'aria-label': 'Hide the menus', 'data-testid': 'lobby-hide', onclick: () => setHidden(true) }, svgEl(glyph('expand'), 'lb-glyph'));
  const shortcuts = h('nav.lb-shortcuts', { 'aria-label': 'Shortcuts' });
  const chevL = h('button.lb-chev.lb-chev-l', { 'aria-label': 'Previous secretary', title: 'Previous secretary', 'data-testid': 'secretary-prev', onclick: () => swap(-1) }, svgEl(glyph('chevron'), 'lb-glyph'));
  const chevR = h('button.lb-chev.lb-chev-r', { 'aria-label': 'Next secretary', title: 'Next secretary', 'data-testid': 'secretary-next', onclick: () => swap(1) }, svgEl(glyph('chevron'), 'lb-glyph'));
  const carouselHost = h('section.lb-carousel', { 'aria-label': 'Events' });
  const eventHost = h('div.lb-eventcard-host');
  const rightHost = h('div.lb-br');
  const dock = h('nav.lb-dock', { 'aria-label': 'Main menu' });
  hud.append(top, hideBtn, shortcuts, chevL, chevR, carouselHost, eventHost, rightHost, dock);

  const carousel = buildCarousel(carouselHost, { reduceMotion });
  const draw = () => {
    clear(top);
    clear(shortcuts);
    clear(eventHost);
    clear(rightHost);
    clear(dock);
    buildTop(top, { openSecretaryPicker });
    buildShortcuts(shortcuts);
    buildEventCard(eventHost);
    buildRight(rightHost);
    buildDock(dock);
  };
  draw();
  // entrance animations play once; later redraws (store changes) must not replay them
  const staticTimer = setTimeout(() => el.classList.add('lb-static'), 1400);

  // ---- clock ----------------------------------------------------------------------------------
  const clock = h('span.lb-clock', { 'data-testid': 'lobby-clock' });
  const tick = () => {
    try {
      clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      clock.textContent = '';
    }
  };
  tick();
  const clockTimer = setInterval(tick, 20000);
  const clockWrap = h('div.lb-clock-wrap', h('span.lb-clock-deco', '✿ ✦ ✿'), clock);
  hud.appendChild(clockWrap);

  // ---- hide UI ----------------------------------------------------------------------------------
  const setHidden = (on) => {
    el.classList.toggle('ui-hidden', on);
    restore.hidden = !on;
    if (on) stage.hideBubble();
  };
  restore.hidden = true;
  restore.addEventListener('click', () => setHidden(false));

  // ---- parallax + pointer follow ------------------------------------------------------------------
  let raf = 0;
  let px = 0;
  let py = 0;
  const apply = () => {
    raf = 0;
    el.style.setProperty('--px', px.toFixed(3));
    el.style.setProperty('--py', py.toFixed(3));
    stage.look(px, py);
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(apply); };
  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    px = ((e.clientX - r.left) / r.width) * 2 - 1;
    py = ((e.clientY - r.top) / r.height) * 2 - 1;
    queue();
  };
  const onLeave = () => { px = 0; py = 0; queue(); };
  const onTilt = (e) => {
    if (e.gamma == null) return;
    px = Math.max(-1, Math.min(1, e.gamma / 25));
    py = Math.max(-1, Math.min(1, ((e.beta || 0) - 40) / 30));
    queue();
  };
  if (!reduceMotion) {
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    if (typeof window.DeviceOrientationEvent !== 'undefined' && matchMedia?.('(pointer: coarse)').matches) window.addEventListener('deviceorientation', onTilt);
  }

  // ---- secretary picker (Menu Tab → Secretary) ---------------------------------------------------
  function openSecretaryPicker() {
    const profile = store.profile;
    const grid = h('div.lb-sec-grid');
    const m = modal({ title: 'Choose your secretary', body: h('div', h('p.muted', 'She greets you in the club office. Tap her for a line — or pat her head.'), grid), actions: [{ label: 'Close', kind: 'ghost' }], wide: true });
    for (const id of ownedUnits(profile)) {
      grid.appendChild(card(id, {
        variant: 'tall',
        level: profile.units[id]?.level,
        selected: id === secretaryId(profile),
        onClick: () => {
          profile.secretary = id;
          swapping = 1;
          store.commit('secretary');
          m.close();
        },
      }));
    }
  }

  const off = store.on('change', (e) => {
    if (e?.reason === 'secretary' || e?.reason === 'replace') {
      const dir = swapping;
      swapping = 0;
      showSecretary(dir || 0);
    }
    draw();
    if (e?.reason === 'replace') carousel.refresh();
  });

  showSecretary(0);

  return () => {
    off();
    clearTimeout(staticTimer);
    clearInterval(clockTimer);
    cancelAnimationFrame(raf);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('deviceorientation', onTilt);
    carousel.dispose();
    stage.dispose();
  };
}

// ---------------------------------------------------------------------------------------------
// Secretary lines
// ---------------------------------------------------------------------------------------------

function greeting(now = new Date()) {
  const hr = now.getHours();
  if (hr < 5) return 'Still up, Sensei? Don\'t push yourself too hard.';
  if (hr < 11) return 'Good morning, Sensei! The sea is sparkling today.';
  if (hr < 17) return 'Welcome back, Sensei! I kept your desk tidy.';
  if (hr < 21) return 'Good evening, Sensei. One more mission before dinner?';
  return 'It\'s getting late, Sensei. Let\'s finish up together.';
}

/** Ordered lines the secretary cycles through when tapped (first = greeting / most urgent). */
export function secretaryLines(profile) {
  const u = getUnit(secretaryId(profile));
  const notice = commissionsNotice(profile);
  const next = nextStage(profile);
  const event = currentEvent();
  const lines = [];
  if (notice.login) lines.push('Your daily login gift is ready — tap the gift on the left, Sensei!');
  else if (notice.missions) lines.push('Some commissions are finished. Let\'s collect the rewards!');
  else lines.push(greeting());
  lines.push(u.quote);
  if (next) lines.push(`Next mission: ${next} ${STAGE_MAP[next].name}. Shall we go?`);
  lines.push(`This week is ${event.name}! ${event.arenaName} Bounty drops are doubled.`);
  if (u.tips?.length) lines.push(...u.tips.slice(0, 2));
  return lines;
}

// ---------------------------------------------------------------------------------------------
// Top bar: level badge · currency pills · Settings / Mail / Menu pill
// ---------------------------------------------------------------------------------------------

function pill({ iconSvg, value, testid, title, onPlus = null, onClick = null }) {
  return h('div.lb-pill', { title, onclick: onClick || undefined, role: onClick ? 'button' : undefined },
    h('span.lb-pill-ico', { html: iconSvg }),
    h('span.lb-pill-val', { 'data-testid': testid }, value),
    onPlus ? h('button.lb-pill-plus', { onclick: (e) => { e.stopPropagation(); onPlus(); }, 'aria-label': `Get more ${title}` }, svgEl(glyph('plus'), 'lb-glyph')) : null,
  );
}

function buildTop(host, { openSecretaryPicker }) {
  const profile = store.profile;
  const notice = commissionsNotice(profile);
  const tickets = itemCount(profile, 'ticket_recruit') + 10 * itemCount(profile, 'ticket_recruit10');
  const sep = () => h('i.lb-tr-sep');
  host.append(
    h('div.lb-top-left', levelBadge(profile, { name: 'Sensei', onClick: () => navigate('commissions', { tab: 'achievements' }) })),
    h('div.lb-pills',
      pill({ iconSvg: itemIcon('ticket_recruit'), value: formatNumber(tickets), testid: 'tickets', title: 'Recruit tickets (pulls)', onPlus: () => navigate('mall', { tab: 'general' }), onClick: () => navigate('recruit') }),
      pill({ iconSvg: currencyIcon('coins'), value: formatNumber(profile.currencies.coins), testid: 'coins', title: 'Coins', onPlus: null }),
      pill({ iconSvg: currencyIcon('gems'), value: formatNumber(profile.currencies.gems), testid: 'gems', title: 'Gems', onPlus: () => navigate('mall', { tab: 'gems' }) }),
    ),
    h('div.lb-tr',
      h('button.lb-tr-btn', { title: 'Settings', 'aria-label': 'Settings', 'data-testid': 'settings', onclick: () => navigate('settings') }, svgEl(glyph('settings'), 'lb-glyph')),
      sep(),
      h('button.lb-tr-btn', { title: 'Mail', 'aria-label': 'Mail', 'data-testid': 'top-mail', onclick: () => navigate('commissions', notice.login ? { tab: 'login' } : {}) },
        svgEl(glyph('mail'), 'lb-glyph'), notice.count ? h('span.lb-badge', String(notice.count)) : null),
      sep(),
      h('button.lb-tr-btn', { title: 'Menu', 'aria-label': 'Menu', 'data-testid': 'top-menu', onclick: () => menuTabModal({ extra: [{ icon: 'secretary', label: 'Secretary', testid: 'menu-secretary', go: openSecretaryPicker }, { icon: 'notice', label: 'Notice', testid: 'menu-notice', go: showNoticeModal }] }) },
        svgEl(glyph('menu'), 'lb-glyph')),
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// Left shortcuts: Notice · Tasks · Login gift · Buy gems (2×2, illustrated)
// ---------------------------------------------------------------------------------------------

function buildShortcuts(host) {
  const profile = store.profile;
  const notice = commissionsNotice(profile);
  const login = loginCalendar(profile);
  const event = currentEvent();
  const sc = (name, label, { badge = null, badgeKind = 'red', dot = false, onClick, testid, cls = '' }) => h(
    `button.lb-sc${cls ? `.${cls}` : ''}`,
    { onclick: onClick, 'data-testid': testid, title: label },
    icon(name, 'lb-sc-ico'),
    h('span.lb-sc-label', label),
    badge != null ? h(`span.lb-sc-badge.${badgeKind}`, String(badge)) : null,
    dot ? h('span.lb-dot') : null,
  );
  host.append(
    sc('notice', 'Notice', { onClick: () => { showNoticeModal(); host.querySelector('[data-testid="shortcut-notice"] .lb-dot')?.remove(); }, testid: 'shortcut-notice', dot: noticeUnread() }),
    sc('tasks', 'Tasks', { badge: `${notice.dailyDone}/${notice.dailyTotal}`, badgeKind: 'blue', dot: notice.missions || notice.ach, onClick: () => navigate('commissions', notice.ach && !notice.missions ? { tab: 'achievements' } : {}), testid: 'shortcut-tasks' }),
    sc('gift', 'Login gift', {
      badge: login.claimable ? '1' : null,
      cls: login.claimable ? 'ready' : '',
      testid: 'login-claim',
      onClick: () => {
        if (!login.claimable) return navigate('commissions', { tab: 'login' });
        const r = claimLogin(profile);
        if (!r.ok) return navigate('commissions', { tab: 'login' });
        store.commit('login');
        showRewardsModal({ title: `Login Day ${r.day}`, rewards: r.rewards, note: `${event.name} week — see you tomorrow, Sensei!` });
      },
    }),
    sc('gems', 'Buy gems', { onClick: () => navigate('mall', { tab: 'gems' }), testid: 'shortcut-gems' }),
  );
}

// ---------------------------------------------------------------------------------------------
// Event / banner carousel (right): weekly event, recruit pick-up, F2P rewards, Total Assault
// ---------------------------------------------------------------------------------------------

function buildCarousel(host, { reduceMotion }) {
  let index = 0;
  let timer = 0;
  let slides = [];
  const pillEl = h('div.lb-car-pill');
  const track = h('div.lb-car-track');
  const dots = h('div.lb-car-dots', { role: 'tablist' });
  const viewport = h('div.lb-car-view', track);
  host.append(pillEl, viewport, dots);

  const build = () => {
    const profile = store.profile;
    const event = currentEvent();
    const days = eventDaysLeft();
    let f2p = 0;
    try {
      f2p = Math.round(f2pIncomeSummary().totals.pulls);
    } catch {
      f2p = 0;
    }
    const pity = Math.max(0, GACHA.pity - (profile.gacha?.pity || 0));
    const assaultLock = isStageUnlocked(profile, 'boss-lych') ? null : requirementText(profile, 'boss-lych');
    slides = [
      { id: 'event', pill: `${days} day${days === 1 ? '' : 's'} remaining`, kicker: 'EVENT', title: event.name, sub: `${event.dropMul}× ${event.arenaName}`, art: themeBackdropSVG(ARENA_THEME[event.arena] || 'sakura'), go: () => navigate('bounty', { arena: event.arena }) },
      { id: 'recruit', pill: 'Pick-up recruitment', kicker: 'PICK UP', title: 'Recruit', sub: `SSR in ≤ ${pity}`, fan: RECRUIT_FEATURED, go: () => navigate('recruit') },
      { id: 'f2p', pill: 'Free-to-play guide', kicker: 'F2P', title: 'Free pulls', sub: `≈${f2p} every 28 days`, iconName: 'chest', art: themeBackdropSVG('festival'), go: () => navigate('rewards') },
      { id: 'assault', pill: assaultLock ? 'Locked' : 'Weekly boss', kicker: 'BOSS', title: 'Total Assault', sub: assaultLock ? 'Clear more stages' : 'Crowns & tokens', iconName: 'assault', art: themeBackdropSVG('night'), lock: assaultLock, go: () => (assaultLock ? toast(assaultLock, 'info') : navigate('assault')) },
    ];
    clear(track);
    clear(dots);
    slides.forEach((s, i) => {
      const slide = h(`button.lb-slide.lb-slide-${s.id}`, { onclick: s.go, 'data-testid': `banner-${s.id}`, title: s.title, tabindex: i === index ? 0 : -1 },
        s.art ? h('div.lb-slide-art', { html: s.art }) : h('div.lb-slide-art.lb-slide-sky'),
        s.fan ? h('div.lb-slide-fan', s.fan.map((id) => UNIT_MAP[id] ? h('div.lb-fan-card', { html: cardArtSVG(UNIT_MAP[id], { variant: 'portrait' }) }) : null)) : null,
        s.iconName ? icon(s.iconName, 'lb-slide-ico') : null,
        h('div.lb-slide-text', h('span.lb-slide-kicker', s.kicker), h('b', s.title), h('small', s.sub)),
        s.lock ? h('span.lb-slide-lock', svgEl(glyph('lock'), 'lb-glyph')) : null,
      );
      track.appendChild(slide);
      dots.appendChild(h('button.lb-car-dot', { 'aria-label': s.title, onclick: () => go(i, true) }));
    });
    go(Math.min(index, slides.length - 1), false);
  };

  const go = (i, user = false) => {
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(${-index * 100}%)`;
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === index));
    [...track.children].forEach((s, k) => { s.tabIndex = k === index ? 0 : -1; });
    pillEl.textContent = slides[index]?.pill || '';
    if (user) restart();
  };
  const restart = () => {
    clearInterval(timer);
    if (!reduceMotion) timer = setInterval(() => go(index + 1), 5200);
  };
  // swipe (a swipe must not also count as a tap on the slide)
  let sx = null;
  let swiped = false;
  viewport.addEventListener('pointerdown', (e) => { sx = e.clientX; swiped = false; });
  viewport.addEventListener('pointerup', (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 30) {
      swiped = true;
      go(index + (dx < 0 ? 1 : -1), true);
    }
  });
  viewport.addEventListener('click', (e) => {
    if (!swiped) return;
    swiped = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
  host.addEventListener('pointerenter', () => clearInterval(timer));
  host.addEventListener('pointerleave', restart);
  build();
  restart();
  return { refresh: build, dispose: () => clearInterval(timer) };
}

// ---------------------------------------------------------------------------------------------
// Bottom-left EVENT card
// ---------------------------------------------------------------------------------------------

function buildEventCard(host) {
  const event = currentEvent();
  const days = eventDaysLeft();
  const guest = UNIT_MAP[{ 'res-books': 'hotaru', 'res-coins': 'chika', 'res-gear': 'kaede', 'res-mats-a': 'luna', 'res-mats-b': 'miko' }[event.arena]] || UNIT_MAP.hikari;
  host.appendChild(h('button.lb-eventcard', { onclick: () => navigate('bounty', { arena: event.arena }), 'data-testid': 'event-strip', title: event.desc },
    h('div.lb-ev-clip',
      h('div.lb-ev-art', { html: themeBackdropSVG(ARENA_THEME[event.arena] || 'sakura') }),
      guest ? h('div.lb-ev-girl', { html: cardArtSVG(guest, { variant: 'portrait' }) }) : null,
      h('div.lb-ev-shade'),
    ),
    h('span.lb-ev-kicker', 'EVENT!'),
    h('div.lb-ev-text', h('b', event.name), h('small', `${event.dropMul}× drops · ${days}d left`)),
  ));
}

// ---------------------------------------------------------------------------------------------
// Bottom-right: Total Assault shortcut + the big Campaign folder
// ---------------------------------------------------------------------------------------------

function buildRight(host) {
  const profile = store.profile;
  const { nextDef, chapter, prog, complete } = campaignStatus(profile);
  const assaultLock = isStageUnlocked(profile, 'boss-lych') ? null : requirementText(profile, 'boss-lych');
  const assault = h(`button.lb-sc.lb-assault${assaultLock ? '.locked' : ''}`, { onclick: () => (assaultLock ? toast(assaultLock, 'info') : navigate('assault')), 'data-testid': 'shortcut-assault', title: 'Total Assault' },
    icon('assault', 'lb-sc-ico'),
    assaultLock ? h('span.lb-lock', svgEl(glyph('lock'), 'lb-glyph')) : null,
    h('span.lb-sc-label', 'Assault'),
  );
  const campaign = h('button.lb-campaign', { onclick: () => navigate('missions'), 'data-testid': 'tile-mission', title: 'Campaign' },
    nextDef ? h('span.lb-tag.yellow.lb-camp-next', `Next ${nextDef.id}`) : h('span.lb-tag.yellow.lb-camp-next', 'All clear!'),
    h('div.lb-camp-folder', { html: campaignFolderSVG({ uid: `camp-${++iconSeq}`, art: themeBackdropSVG(chapter?.theme || 'sakura') }) }),
    h('span.lb-tag.pink.lb-camp-prog', complete ? 'Medals' : 'In Progress'),
    h('div.lb-camp-label', h('b', 'Campaign'), h('small', complete ? 'Chase Sakura medals' : `Ch.${chapter?.id} ${chapter?.name}${prog ? ` · ${prog.cleared}/${prog.total}` : ''}`)),
  );
  host.append(assault, campaign);
}

// ---------------------------------------------------------------------------------------------
// Dock: a thin translucent strip with illustrated icons standing on it
// ---------------------------------------------------------------------------------------------

function buildDock(host) {
  const profile = store.profile;
  const notice = commissionsNotice(profile);
  const items = [
    { id: 'students', label: 'Students', icon: 'students' },
    { id: 'formation', label: 'Formation', icon: 'formation' },
    { id: 'backpack', label: 'Backpack', icon: 'backpack' },
    { id: 'bestiary', label: 'Bestiary', icon: 'bestiary' },
    { id: 'wiki', label: 'Wiki', icon: 'wiki' },
    { id: 'commissions', label: 'Commissions', short: 'Tasks', icon: 'commissions', dot: notice.any },
    { id: 'mall', label: 'Mall', icon: 'mall' },
    { id: 'recruit', label: 'Recruit', icon: 'recruit', dot: recruitNotice(profile), tag: 'Pick Up!' },
  ];
  host.append(h('div.lb-dock-strip'));
  items.forEach((it, i) => {
    host.appendChild(h('button.lb-dock-btn', { onclick: () => navigate(it.id), 'data-testid': `dock-${it.id}`, style: { '--i': i }, title: it.label },
      icon(it.icon, 'lb-dock-ico'),
      h(`span.lb-dock-label${it.short ? '.has-short' : ''}`, h('span.lb-full', it.label), it.short ? h('span.lb-short', it.short) : null),
      it.dot ? h('span.lb-dot') : null,
      it.tag ? h('span.lb-dock-tag', it.tag) : null,
    ));
  });
}
