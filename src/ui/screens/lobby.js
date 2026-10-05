// Lobby (owner: meta-a). Blue Archive–style home: classroom-by-the-sea backdrop, the
// secretary girl on the left (3D chibi, card art fallback) and big slanted glass tiles on
// the right, plus a dock with every other menu. Notification dots show claimable
// commissions / login rewards and free recruits.
import '../styles/meta-a.css';
import { h, clear, screen, svgEl, modal, toast } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { STAGE_MAP, CHAPTERS } from '../../data/stages.js';
import { UNIT_MAP, getUnit } from '../../data/units.js';
import { GACHA } from '../../data/types.js';
import { lobbyBackdropSVG, themeBackdropSVG } from '../../art/backdrops.js';
import { cardArtSVG } from '../../art/cardArt.js';
import { uiIcon } from '../../art/icons.js';
import { nextStage, isStageUnlocked, ownedUnits } from '../../systems/unlocks.js';
import { missionList, loginCalendar, achievementList, claimLogin, currentEvent } from '../../systems/missions.js';
import { itemCount } from '../../systems/inventory.js';
import { canSpark } from '../../systems/gacha.js';
import { requirementText, showRewardsModal, card } from './stage.js';

/** Anything claimable in Commissions? */
export function commissionsNotice(profile) {
  try {
    const ml = missionList(profile);
    const missions = [...ml.daily, ...ml.weekly].some((m) => m.claimable);
    const login = loginCalendar(profile).claimable;
    const ach = achievementList(profile).some((a) => a.claimable);
    return { any: missions || login || ach, missions, login, ach };
  } catch {
    return { any: false, missions: false, login: false, ach: false };
  }
}

function recruitNotice(profile) {
  return itemCount(profile, 'ticket_recruit') > 0 || itemCount(profile, 'ticket_recruit10') > 0 || canSpark(profile);
}

export function render(root) {
  const { el, body } = screen('Sakura Academy', { showBack: false, showHome: false, cls: 'ma-lobby' });
  el.insertBefore(h('div.ma-lobby-bg', { html: lobbyBackdropSVG(), 'aria-hidden': 'true' }), el.firstChild);
  const svg = el.querySelector('.ma-lobby-bg svg');
  svg?.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  root.appendChild(el);

  const secretaryHost = h('section.ma-secretary');
  const tilesHost = h('section.ma-tiles');
  const dockHost = h('nav.ma-dock');
  body.append(h('div.ma-lobby-main', secretaryHost, tilesHost), dockHost);

  const sec = mountSecretary(secretaryHost);
  const draw = () => {
    clear(tilesHost);
    clear(dockHost);
    buildTiles(tilesHost);
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
// Secretary
// ---------------------------------------------------------------------------

function secretaryId(profile) {
  const id = profile.secretary;
  if (id && UNIT_MAP[id] && profile.units?.[id]) return id;
  if (profile.formation?.hero && profile.units?.[profile.formation.hero]) return profile.formation.hero;
  return ownedUnits(profile)[0] || 'hikari';
}

function mountSecretary(host) {
  let viewer = null;
  let model = null;
  let models = null;
  let disposed = false;
  let lines = [];
  let lineIndex = 0;
  let token = 0;

  const stageEl = h('div.ma-sec-stage');
  const bubble = h('div.ma-sec-bubble', { 'aria-live': 'polite' });
  const plate = h('div.ma-sec-plate');
  host.append(h('div.ma-sec-glow'), stageEl, bubble, plate);

  const say = (i) => {
    if (!lines.length) return;
    lineIndex = (i + lines.length) % lines.length;
    bubble.classList.remove('show');
    void bubble.offsetWidth;
    bubble.textContent = lines[lineIndex];
    bubble.classList.add('show');
  };
  stageEl.addEventListener('pointerup', () => say(lineIndex + 1));

  const refreshLines = () => {
    const profile = store.profile;
    const u = getUnit(secretaryId(profile));
    const next = nextStage(profile);
    const notice = commissionsNotice(profile);
    lines = [u.quote];
    if (notice.login) lines.unshift('Your daily login gift is ready — tap the gift banner, Sensei!');
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
// Tiles & dock
// ---------------------------------------------------------------------------

function glassTile({ id, title, sub, icon, onClick, lockText = null, dot = false, cls = '', art = null, badge = null }) {
  const locked = !!lockText;
  return h(
    `button.ma-tile.ma-tile-${id}${locked ? '.locked' : ''}${cls ? `.${cls}` : ''}`,
    { onclick: () => (locked ? toast(lockText, 'info') : onClick()), 'data-testid': `tile-${id}` },
    art ? h('div.ma-tile-art', { html: art }) : null,
    h('div.ma-tile-inner',
      h('div.ma-tile-icon', svgEl(uiIcon(icon))),
      h('div.ma-tile-text', h('div.ma-tile-title', title), sub ? h('div.ma-tile-sub', sub) : null),
    ),
    badge ? h('span.ma-tile-badge', badge) : null,
    locked ? h('div.ma-tile-lock', svgEl(uiIcon('lock'), 'ma-inline-icon'), lockText) : null,
    dot ? h('span.ma-dot') : null,
  );
}

function buildTiles(host) {
  const profile = store.profile;
  const next = nextStage(profile);
  const nextDef = next ? STAGE_MAP[next] : null;
  const chapter = CHAPTERS.find((c) => c.id === (nextDef?.chapter || CHAPTERS.length));
  const event = currentEvent();
  const login = loginCalendar(profile);

  if (login.claimable) {
    const today = login.days.find((d) => d.today) || login.days[0];
    host.appendChild(h(
      'button.ma-login-banner',
      {
        'data-testid': 'login-claim',
        onclick: () => {
          const r = claimLogin(profile);
          if (!r.ok) return;
          store.commit('login');
          showRewardsModal({ title: `Login Day ${r.day}`, rewards: r.rewards, note: 'See you tomorrow, Sensei!' });
        },
      },
      svgEl(uiIcon('gift'), 'ma-login-icon'),
      h('span', h('b', `Day ${today.day} login gift`), h('span.muted', ' — tap to claim')),
      h('span.ma-dot.static'),
    ));
  }

  const mission = glassTile({
    id: 'mission',
    title: 'Mission',
    sub: nextDef ? `Next: ${nextDef.id} ${nextDef.name}` : 'Campaign complete — chase Sakura medals!',
    icon: 'mission',
    cls: 'big',
    art: themeBackdropSVG(chapter?.theme || 'sakura'),
    badge: nextDef ? `Chapter ${nextDef.chapter}` : 'All clear',
    onClick: () => navigate('campaign', nextDef ? { chapter: nextDef.chapter } : {}),
  });
  if (nextDef) {
    mission.appendChild(h('span.ma-tile-go', { onclick: (e) => { e.stopPropagation(); navigate('stage', { id: next }); } }, svgEl(uiIcon('play'), 'ma-inline-icon'), 'Quick start'));
  }

  const lockFor = (stageId) => (isStageUnlocked(profile, stageId) ? null : requirementText(profile, stageId));
  const grid = h('div.ma-tile-grid',
    mission,
    glassTile({ id: 'bounty', title: 'Bounty', sub: `${event.arenaName} · 2× drops`, icon: 'bounty', lockText: lockFor('res-books-1'), onClick: () => navigate('bounty'), badge: '2×' }),
    glassTile({ id: 'assault', title: 'Total Assault', sub: 'Bosses drop crowns', icon: 'assault', lockText: lockFor('boss-lych'), onClick: () => navigate('assault') }),
    glassTile({ id: 'challenge', title: 'Tactical Challenge', sub: bestWaveLine(profile), icon: 'challenge', lockText: lockFor('challenge'), onClick: () => navigate('challenge') }),
    glassTile({
      id: 'recruit',
      title: 'Recruit',
      sub: `SSR in ≤ ${GACHA.pity - (profile.gacha?.pity || 0)} pulls`,
      icon: 'gacha',
      cls: 'pink',
      art: recruitArt(),
      dot: recruitNotice(profile),
      onClick: () => navigate('recruit'),
    }),
  );
  host.appendChild(grid);
  host.appendChild(h(
    'button.ma-event-strip',
    { onclick: () => navigate('rewards'), 'data-testid': 'event-strip' },
    h('span.ma-event-badge', 'EVENT'),
    h('span.ma-es-text', h('b', event.name), h('span.muted', ` · ${event.desc}`)),
    svgEl(uiIcon('back'), 'ma-es-arrow'),
  ));
}

function bestWaveLine(profile) {
  const best = profile.progress?.stages?.challenge?.bestWave;
  return best ? `Best wave ${formatNumber(best)}` : 'Endless waves';
}

function recruitArt() {
  const feature = ['luna', 'hotaru', 'kaede'].map((id) => UNIT_MAP[id]).filter(Boolean);
  return `<div class="ma-recruit-fan">${feature.map((u) => `<div class="ma-fan-card">${cardArtSVG(u, { variant: 'portrait' })}</div>`).join('')}</div>`;
}

function buildDock(host) {
  const profile = store.profile;
  const notice = commissionsNotice(profile);
  const items = [
    { id: 'students', label: 'Students', icon: 'students' },
    { id: 'formation', label: 'Formation', icon: 'formation' },
    { id: 'backpack', label: 'Backpack', icon: 'backpack' },
    { id: 'mall', label: 'Mall', icon: 'mall' },
    { id: 'commissions', label: 'Commissions', icon: 'mission', dot: notice.any, params: notice.login ? { tab: 'login' } : notice.missions ? {} : notice.ach ? { tab: 'achievements' } : {} },
    { id: 'bestiary', label: 'Bestiary', icon: 'bestiary' },
    { id: 'wiki', label: 'Wiki', icon: 'wiki' },
    { id: 'rewards', label: 'Events', icon: 'gift' },
  ];
  for (const it of items) {
    host.appendChild(h(
      `button.ma-dock-btn`,
      { onclick: () => navigate(it.id, it.params || {}), 'data-testid': `dock-${it.id}` },
      svgEl(uiIcon(it.icon), 'ma-dock-icon'),
      h('span.ma-dock-label', it.label),
      it.dot ? h('span.ma-dot') : null,
    ));
  }
}
