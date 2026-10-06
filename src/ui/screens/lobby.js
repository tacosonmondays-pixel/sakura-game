// Lobby (owner: ui / meta-a). Blue Archive–style home, landscape-first:
//   · full-bleed seaside-classroom backdrop
//   · top-left account level badge, top-right slanted currency pills + mail / menu icons
//   · left column of square shortcuts (Notice, Tasks, Login gift) with badges
//   · the secretary girl large, centre-left (3D chibi, card art fallback) with a speech bubble
//   · bottom-right: the current Event card and the tall "Campaign" button ("In Progress")
//   · bottom dock: Students, Formation, Backpack, Mall, Recruit, Bestiary, Wiki
//   · "Menu Tab" modal (Options, Account, Equipment, Items, Bestiary, Wiki, Fullscreen)
import '../styles/meta-a.css';
import { h, clear, svgEl, modal, toast, levelBadge, currencyPills, iconButton, menuTabModal, glyph, applyMotionPreference } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { STAGE_MAP, CHAPTERS } from '../../data/stages.js';
import { UNIT_MAP, getUnit } from '../../data/units.js';
import { GACHA } from '../../data/types.js';
import { lobbyBackdropSVG, themeBackdropSVG } from '../../art/backdrops.js';
import { cardArtSVG } from '../../art/cardArt.js';
import { uiIcon } from '../../art/icons.js';
import { nextStage, ownedUnits, chapterProgress } from '../../systems/unlocks.js';
import { missionList, loginCalendar, achievementList, claimLogin, currentEvent } from '../../systems/missions.js';
import { itemCount } from '../../systems/inventory.js';
import { canSpark } from '../../systems/gacha.js';
import { showRewardsModal, card } from './stage.js';

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

export function render(root) {
  applyMotionPreference();
  const el = h('div.screen.ma-lobby', { 'data-testid': 'lobby' });
  const bg = h('div.ma-lobby-bg', { html: lobbyBackdropSVG(), 'aria-hidden': 'true' });
  bg.querySelector('svg')?.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  const hud = h('div.ma-lobby-hud');
  el.append(bg, h('div.ma-lobby-petals', { 'aria-hidden': 'true' }, Array.from({ length: 10 }, (_, i) => h(`i.p${i}`))), hud);
  root.appendChild(el);

  const topHost = h('header.ma-lobby-top');
  const shortcutsHost = h('aside.ma-shortcuts');
  const secretaryHost = h('section.ma-secretary');
  const plateHost = h('div.ma-sec-plate');
  const rightHost = h('section.ma-lobby-right');
  const dockHost = h('nav.ma-dock', { 'aria-label': 'Main menu' });
  hud.append(topHost, shortcutsHost, secretaryHost, plateHost, rightHost, dockHost);

  const sec = mountSecretary(secretaryHost, plateHost);
  const draw = () => {
    clear(topHost);
    clear(shortcutsHost);
    clear(rightHost);
    clear(dockHost);
    buildTop(topHost);
    buildShortcuts(shortcutsHost);
    buildRight(rightHost);
    buildDock(dockHost);
    sec.refreshLines();
  };
  draw();
  const off = store.on('change', (e) => {
    if (e?.reason === 'secretary' || e?.reason === 'replace') sec.reload();
    draw();
  });
  return () => {
    off();
    sec.dispose();
  };
}

// ---------------------------------------------------------------------------
// Top row: level badge · currency pills · mail / menu
// ---------------------------------------------------------------------------

function buildTop(host) {
  const profile = store.profile;
  const notice = commissionsNotice(profile);
  host.append(
    h('div.ma-top-left', levelBadge(profile, { name: 'Sensei', onClick: () => navigate('commissions', { tab: 'achievements' }) })),
    h('div.ma-top-right',
      currencyPills(),
      h('div.ma-top-icons',
        iconButton('mail', { title: 'Commissions', testid: 'top-mail', badge: notice.count || null, onClick: () => navigate('commissions', notice.login ? { tab: 'login' } : {}) }),
        iconButton('settings', { title: 'Settings', testid: 'settings', onClick: () => navigate('settings') }),
        iconButton('menu', { title: 'Menu', testid: 'top-menu', onClick: () => menuTabModal() }),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Left shortcuts: Notice · Tasks · Login gift
// ---------------------------------------------------------------------------

function buildShortcuts(host) {
  const profile = store.profile;
  const notice = commissionsNotice(profile);
  const login = loginCalendar(profile);
  const event = currentEvent();
  const shortcut = (icon, label, { badge = null, dot = false, onClick, testid, cls = '' }) => {
    const b = h(`button.ma-shortcut${cls ? `.${cls}` : ''}`, { onclick: onClick, 'data-testid': testid, title: label },
      h('span.ma-shortcut-icon', svgEl(glyph(icon))),
      h('span.ma-shortcut-label', label),
      badge != null ? h('span.icon-btn-badge', String(badge)) : null,
      dot ? h('span.notif-dot') : null,
    );
    return b;
  };
  host.append(
    shortcut('notice', 'Notice', { onClick: () => navigate('rewards'), testid: 'shortcut-notice', dot: false, cls: 'event' }),
    shortcut('tasks', 'Tasks', { badge: `${notice.dailyDone}/${notice.dailyTotal}`, dot: notice.missions || notice.ach, onClick: () => navigate('commissions', notice.ach && !notice.missions ? { tab: 'achievements' } : {}), testid: 'shortcut-tasks' }),
    shortcut('gift', 'Login gift', {
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
  );
}

// ---------------------------------------------------------------------------
// Secretary
// ---------------------------------------------------------------------------

function secretaryId(profile) {
  const id = profile.secretary;
  if (id && UNIT_MAP[id] && profile.units?.[id]) return id;
  if (profile.formation?.hero && profile.units?.[profile.formation.hero]) return profile.formation.hero;
  return ownedUnits(profile)[0] || 'hikari';
}

function mountSecretary(host, plate) {
  let viewer = null;
  let model = null;
  let models = null;
  let disposed = false;
  let lines = [];
  let lineIndex = 0;
  let token = 0;

  const stageEl = h('div.ma-sec-stage', { 'data-testid': 'secretary-stage' });
  const bubble = h('div.ma-sec-bubble', { 'aria-live': 'polite' });
  host.append(h('div.ma-sec-glow'), stageEl, bubble);

  const say = (i) => {
    if (!lines.length) return;
    lineIndex = (i + lines.length) % lines.length;
    bubble.classList.remove('show');
    void bubble.offsetWidth;
    bubble.textContent = lines[lineIndex];
    bubble.classList.add('show');
  };
  stageEl.addEventListener('pointerup', () => {
    say(lineIndex + 1);
    viewer?.setState('cheer');
    setTimeout(() => viewer?.setState('idle'), 1400);
  });

  const refreshLines = () => {
    const profile = store.profile;
    const u = getUnit(secretaryId(profile));
    const next = nextStage(profile);
    const notice = commissionsNotice(profile);
    lines = [u.quote];
    if (notice.login) lines.unshift('Your daily login gift is ready — tap the gift on the left, Sensei!');
    else if (notice.missions) lines.unshift('Some commissions are finished. Let\'s collect the rewards!');
    if (next) lines.push(`Next mission: ${next} ${STAGE_MAP[next].name}. ${STAGE_MAP[next].desc.split('. ')[0]}.`);
    if (u.tips?.length) lines.push(u.tips[0]);
    if (!bubble.textContent || !lines.includes(bubble.textContent)) say(0);
  };

  const showCardArt = (u) => {
    clear(stageEl);
    stageEl.classList.add('art');
    stageEl.appendChild(h('div.ma-sec-art', { html: cardArtSVG(u, { variant: 'full', awaken: store.profile.units[u.id]?.awaken || 0 }) }));
  };

  const load = async () => {
    const my = ++token;
    const profile = store.profile;
    const u = getUnit(secretaryId(profile));
    clear(plate);
    plate.append(
      h('div.ma-sec-name', h('span.ma-sec-role', 'Secretary'), h('b', u.name), h('span.muted', u.title)),
      h('button.ma-sec-change', { onclick: pickSecretary, 'data-testid': 'secretary-change', title: 'Change secretary' }, svgEl(uiIcon('refresh'), 'ma-inline-icon'), 'Change'),
    );
    try {
      models ||= await import('../../models/index.js');
      await models.preloadModels();
      if (disposed || my !== token) return;
      if (!viewer) {
        clear(stageEl);
        stageEl.classList.remove('art');
        viewer = models.createModelViewer(stageEl, { background: null, autoRotate: false });
      }
      const next = models.buildChibi(u, { quality: profile.settings?.quality || 'medium' });
      const old = model;
      viewer.setObject(next);
      viewer.setState('idle');
      model = next;
      if (old) models.disposeObject(old);
    } catch (e) {
      console.warn('[lobby] 3D secretary unavailable, showing card art', e);
      if (!disposed && my === token) showCardArt(u);
    }
  };

  const pickSecretary = () => {
    const profile = store.profile;
    const grid = h('div.ma-sec-grid');
    const m = modal({ title: 'Choose your secretary', body: h('div', h('p.muted', 'She greets you in the lobby. Tap her for a line.'), grid), actions: [{ label: 'Close', kind: 'ghost' }], wide: true });
    for (const id of ownedUnits(profile)) {
      grid.appendChild(card(id, {
        variant: 'tall',
        level: profile.units[id]?.level,
        selected: id === secretaryId(profile),
        onClick: () => {
          profile.secretary = id;
          store.commit('secretary');
          m.close();
          toast(`${UNIT_MAP[id].name} is your secretary now`, 'good');
        },
      }));
    }
  };

  load();
  return {
    refreshLines,
    reload: () => {
      load();
      bubble.textContent = '';
      refreshLines();
    },
    dispose: () => {
      disposed = true;
      try {
        viewer?.dispose();
        if (model) models?.disposeObject(model);
      } catch (e) {
        console.warn('[lobby] dispose failed', e);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Right stack: event card + Campaign button
// ---------------------------------------------------------------------------

function buildRight(host) {
  const profile = store.profile;
  const event = currentEvent();
  const { nextDef, chapter, prog, complete } = campaignStatus(profile);
  const recruit = h('button.ma-mini-card.ma-recruit-card', { onclick: () => navigate('recruit'), 'data-testid': 'tile-recruit', title: 'Recruit' },
    h('div.ma-mini-art', { html: recruitArt() }),
    h('div.ma-mini-text', h('b', 'Recruit'), h('span', `SSR in ≤ ${GACHA.pity - (profile.gacha?.pity || 0)}`)),
    recruitNotice(profile) ? h('span.notif-dot') : null,
  );
  const eventCard = h('button.ma-mini-card.ma-lobby-event', { onclick: () => navigate('bounty', { arena: event.arena }), 'data-testid': 'event-strip', title: event.desc },
    h('div.ma-mini-art', { html: themeBackdropSVG(eventTheme(event.arena)) }),
    h('span.ma-event-badge.ma-mini-badge', 'EVENT'),
    h('div.ma-mini-text', h('b', event.name), h('span', `${event.dropMul}× drops · ${event.arenaName}`)),
  );
  const campaign = h('button.ma-campaign-btn', { onclick: () => navigate('missions'), 'data-testid': 'tile-mission' },
    h('div.ma-campaign-art', { html: themeBackdropSVG(chapter?.theme || 'sakura') }),
    h('span.tag-ribbon.ma-campaign-ribbon', h('span', complete ? 'All clear' : 'In Progress')),
    h('div.ma-campaign-icon', svgEl(uiIcon('mission'))),
    h('div.ma-campaign-text',
      h('b', 'Campaign'),
      h('span', complete ? 'Chase Sakura medals' : `Ch.${chapter?.id} ${chapter?.name}`),
      nextDef ? h('small', `Next: ${nextDef.id} ${nextDef.name}`) : null,
    ),
    prog ? h('div.ma-campaign-prog', h('i', { style: { width: `${Math.round((prog.cleared / Math.max(1, prog.total)) * 100)}%` } })) : null,
  );
  host.append(h('div.ma-mini-row', recruit, eventCard), campaign);
}

const ARENA_THEME = { 'res-books': 'shrine', 'res-coins': 'festival', 'res-gear': 'foundry', 'res-mats-a': 'mountain', 'res-mats-b': 'night' };
function eventTheme(arena) {
  return ARENA_THEME[arena] || 'sakura';
}

function recruitArt() {
  const feature = ['luna', 'hotaru', 'kaede'].map((id) => UNIT_MAP[id]).filter(Boolean);
  return `<div class="ma-recruit-fan">${feature.map((u) => `<div class="ma-fan-card">${cardArtSVG(u, { variant: 'portrait' })}</div>`).join('')}</div>`;
}

// ---------------------------------------------------------------------------
// Dock
// ---------------------------------------------------------------------------

function buildDock(host) {
  const profile = store.profile;
  const notice = commissionsNotice(profile);
  const items = [
    { id: 'students', label: 'Students', icon: 'students' },
    { id: 'formation', label: 'Formation', icon: 'formation' },
    { id: 'backpack', label: 'Backpack', icon: 'backpack' },
    { id: 'mall', label: 'Mall', icon: 'mall' },
    { id: 'recruit', label: 'Recruit', icon: 'gacha', dot: recruitNotice(profile) },
    { id: 'bestiary', label: 'Bestiary', icon: 'bestiary' },
    { id: 'wiki', label: 'Wiki', icon: 'wiki' },
  ];
  items.forEach((it, i) => {
    const b = h(
      'button.ma-dock-btn',
      { onclick: () => navigate(it.id, it.params || {}), 'data-testid': `dock-${it.id}`, style: { animationDelay: `${120 + i * 40}ms` } },
      h('span.ma-dock-icon', svgEl(uiIcon(it.icon))),
      h('span.ma-dock-label', it.label),
      it.dot ? h('span.notif-dot') : null,
    );
    host.appendChild(b);
  });
  // Commissions keeps a dock entry on wide screens only (it also lives behind Mail / Tasks).
  host.appendChild(h('button.ma-dock-btn.ma-dock-extra', { onclick: () => navigate('commissions'), 'data-testid': 'dock-commissions', style: { animationDelay: '400ms' } },
    h('span.ma-dock-icon', svgEl(uiIcon('mission'))), h('span.ma-dock-label', 'Commissions'), notice.any ? h('span.notif-dot') : null));
  host.dataset.count = String(items.length);
}
