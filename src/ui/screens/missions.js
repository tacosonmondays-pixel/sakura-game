// Missions hub (owner: ui). Route: #/missions — opened by the lobby's Campaign button.
// Blue Archive mission-menu layout: the secretary on the left, a grid of slanted tiles on
// the right: Mission (chapter · next stage, quick start), Story (coming soon), Bounty,
// Total Assault, Tactical Challenge, Commissions ("In Progress"), Sweep (instant farm).
import '../styles/meta-a.css';
import { h, clear, screen, svgEl, modal, toast, button, glyph } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { STAGE_MAP, CHAPTERS, CAMPAIGN_IDS, bountyArenas, stagesOfKind } from '../../data/stages.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../data/types.js';
import { UNIT_MAP } from '../../data/units.js';
import { lobbyBackdropSVG, themeBackdropSVG } from '../../art/backdrops.js';
import { cardArtSVG } from '../../art/cardArt.js';
import { uiIcon } from '../../art/icons.js';
import { isStageUnlocked, stageMedals, ownedUnits } from '../../systems/unlocks.js';
import { canSweep, sweep, MAX_SWEEPS } from '../../systems/rewards.js';
import { currentEvent } from '../../systems/missions.js';
import { requirementText, showRewardsModal, uiRng } from './stage.js';
import { commissionsNotice, campaignStatus } from './lobby.js';

function secretary(profile) {
  const id = profile.secretary && profile.units?.[profile.secretary] ? profile.secretary : profile.formation?.hero || ownedUnits(profile)[0] || 'hikari';
  return UNIT_MAP[id] || UNIT_MAP.hikari;
}

export function render(root) {
  const { el, body } = screen('Missions', { cls: 'ma-hub-screen' });
  const bg = h('div.ma-hub-bg', { html: lobbyBackdropSVG(), 'aria-hidden': 'true' });
  bg.querySelector('svg')?.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  el.insertBefore(bg, el.firstChild);
  root.appendChild(el);

  const draw = () => {
    clear(body);
    body.appendChild(build());
  };
  draw();
  const off = store.on('change', (e) => { if (e?.reason === 'replace' || e?.reason === 'sweep' || e?.reason === 'secretary') draw(); });
  return () => off();
}

function build() {
  const profile = store.profile;
  const u = secretary(profile);
  const { next, nextDef, chapter, prog, complete } = campaignStatus(profile);
  const notice = commissionsNotice(profile);
  const event = currentEvent();
  const lockFor = (stageId) => (isStageUnlocked(profile, stageId) ? null : requirementText(profile, stageId));
  const sweepable = CAMPAIGN_IDS.filter((id) => canSweep(profile, id)).length + bountyArenas().flatMap((a) => a.stages).filter((id) => canSweep(profile, id)).length;

  const wrap = h('div.ma-hub');
  const char = h('div.ma-hub-char', { 'aria-hidden': 'true', html: cardArtSVG(u, { variant: 'portrait' }) });
  char.querySelector('svg')?.setAttribute('preserveAspectRatio', 'xMidYMax meet');
  char.appendChild(h('div.ma-hub-char-name', h('b', u.name), h('span', u.title)));
  wrap.appendChild(char);

  const mission = tile({
    id: 'mission',
    title: 'Mission',
    art: themeBackdropSVG(chapter?.theme || 'sakura'),
    kicker: complete ? 'All chapters cleared' : `Chapter ${chapter?.id} · ${chapter?.name}`,
    sub: nextDef ? `Next: ${nextDef.id} ${nextDef.name}` : 'Chase Sakura medals',
    meta: prog ? `${prog.cleared}/${prog.total}` : null,
    onClick: () => navigate('campaign', nextDef ? { chapter: nextDef.chapter } : {}),
  });
  if (next) {
    mission.appendChild(h('span.ma-hub-go', { role: 'button', tabindex: 0, 'data-testid': 'hub-quick-start', onclick: (e) => { e.stopPropagation(); navigate('stage', { id: next }); } }, svgEl(uiIcon('play'), 'ma-inline-icon'), 'Quick start'));
  }

  const grid = h('div.ma-hub-grid',
    mission,
    tile({ id: 'story', title: 'Story', art: themeBackdropSVG('festival'), kicker: 'Coming soon', sub: 'Visual-novel episodes with the girls', soon: true, onClick: () => toast('Story episodes arrive in a future update — the girls are rehearsing!', 'info') }),
    tile({ id: 'bounty', title: 'Bounty', art: themeBackdropSVG('shrine'), sub: `${event.arenaName} · ${event.dropMul}× this week`, lockText: lockFor('res-books-1'), onClick: () => navigate('bounty') }),
    tile({ id: 'assault', title: 'Total Assault', art: themeBackdropSVG('night'), sub: 'Bosses drop crowns', lockText: lockFor('boss-lych'), onClick: () => navigate('assault') }),
    tile({ id: 'challenge', title: 'Tactical Challenge', art: themeBackdropSVG('arena'), sub: bestWaveLine(profile), lockText: lockFor('challenge'), onClick: () => navigate('challenge') }),
    tile({ id: 'commissions', title: 'Commissions', art: themeBackdropSVG('sakura'), sub: `${notice.dailyDone}/${notice.dailyTotal} daily done`, ribbon: notice.any ? 'In Progress' : null, dot: notice.any, onClick: () => navigate('commissions', notice.login ? { tab: 'login' } : {}) }),
    tile({ id: 'sweep', title: 'Sweep', art: themeBackdropSVG('mountain'), sub: sweepable ? `${sweepable} stage${sweepable === 1 ? '' : 's'} ready` : 'Clear a stage on Hard first', onClick: () => openSweep() }),
  );
  wrap.appendChild(grid);
  return wrap;
}

function bestWaveLine(profile) {
  const best = profile.progress?.stages?.challenge?.bestWave;
  return best ? `Best wave ${formatNumber(best)}` : 'Endless waves';
}

function tile({ id, title, art, kicker = null, sub = null, meta = null, lockText = null, ribbon = null, dot = false, soon = false, onClick }) {
  const locked = !!lockText;
  const el = h(
    `button.ma-hub-tile.ma-hub-${id}${locked ? '.locked' : ''}${soon ? '.soon' : ''}`,
    { onclick: () => (locked ? toast(lockText, 'info') : onClick()), 'data-testid': `hub-${id}` },
    h('div.ma-hub-art', { html: art }),
    h('div.ma-hub-shade'),
    h('div.ma-hub-text',
      kicker ? h('span.ma-hub-kicker', kicker) : null,
      h('span.ma-hub-title', title),
      sub ? h('span.ma-hub-sub', sub) : null,
    ),
    meta ? h('span.ma-hub-meta', meta) : null,
    ribbon ? h('span.tag-ribbon.ma-hub-ribbon', h('span', ribbon)) : null,
    dot ? h('span.notif-dot') : null,
    locked ? h('div.ma-hub-lock', svgEl(uiIcon('lock'), 'ma-inline-icon'), lockText) : null,
  );
  return el;
}

// ---------------------------------------------------------------------------
// Quick sweep: every stage cleared on Hard+, one tap to sweep ×10 at its best difficulty
// ---------------------------------------------------------------------------

function openSweep() {
  const profile = store.profile;
  const list = h('div.ma-sweep-list');
  const candidates = [
    ...CAMPAIGN_IDS.map((id) => STAGE_MAP[id]),
    ...bountyArenas().flatMap((a) => a.stages.map((id) => STAGE_MAP[id])),
    ...stagesOfKind('boss'),
  ].filter((s) => s && canSweep(profile, s.id));
  const m = modal({
    title: 'Sweep',
    wide: true,
    body: candidates.length
      ? h('div', h('p.muted', `Instant ×${MAX_SWEEPS} runs at the best difficulty you cleared. No battle, full drops.`), list)
      : h('div.ma-empty-state', svgEl(uiIcon('ff2')), h('p', 'Sweeping unlocks for every stage you clear on Hard or Nightmare.'), button('Open the campaign', { kind: 'yellow', icon: 'map', onClick: () => { m.close(); navigate('campaign'); } })),
    actions: [{ label: 'Close', kind: 'ghost' }],
  });
  const row = (s) => {
    const medals = stageMedals(profile, s.id);
    const diff = medals.nightmare ? 'nightmare' : 'hard';
    const chapter = s.chapter ? CHAPTERS.find((c) => c.id === s.chapter) : null;
    return h('div.ma-sweep-row',
      h('div.ma-sweep-name', h('b', s.kind === 'campaign' ? `${s.id} ${s.name}` : s.name), h('span.muted', chapter ? chapter.name : s.kind === 'resource' ? 'Bounty' : 'Total Assault')),
      h('span.chip', DIFFICULTIES[diff].name),
      button(`Sweep ×${MAX_SWEEPS}`, {
        kind: 'yellow', small: true, icon: 'ff2', testid: `hub-sweep-${s.id}`,
        onClick: () => {
          const r = sweep(profile, s.id, diff, MAX_SWEEPS, uiRng());
          if (!r.ok) return toast(r.error === 'difficulty' ? 'Clear that difficulty first' : 'Sweep is locked', 'bad');
          store.commit('sweep');
          showRewardsModal({ title: `Sweep ×${r.runs.length} · ${s.name}`, rewards: r.rewards, gear: r.gear, note: `${DIFFICULTIES[diff].name} · ${DIFFICULTY_ORDER.indexOf(diff) + 1}/4` });
        },
      }),
    );
  };
  for (const s of candidates) list.appendChild(row(s));
  return m;
}

export { glyph as _glyph };
