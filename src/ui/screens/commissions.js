// Commissions (owner: meta-a). Route: #/commissions?tab=daily|weekly|login|achievements|codes
// Daily / weekly commissions with progress, claim and "Go" shortcuts, the 7-day login
// calendar, one-time achievements and redemption codes.
import '../styles/meta-a.css';
import { h, clear, screen, svgEl, toast, button, tabs } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber, dayKey } from '../../core/util.js';
import { DAILY_MISSIONS, WEEKLY_MISSIONS } from '../../data/missions.js';
import { uiIcon } from '../../art/icons.js';
import {
  onAppStart, missionList, claimMission, claimAllMissions, loginCalendar, claimLogin,
  achievementList, claimAchievement, redeemCode,
} from '../../systems/missions.js';
import { rewardTiles, showRewardsModal, ask, rememberParams } from './stage.js';

const TAB_IDS = ['daily', 'weekly', 'login', 'achievements', 'codes'];

/** Where to go to make progress on a mission, from its tracked events. */
const EVENT_ROUTE = {
  battleWin: ['campaign', 'Missions'],
  battleWinHard: ['campaign', 'Missions'],
  sweep: ['campaign', 'Missions'],
  kill: ['campaign', 'Missions'],
  bossKill: ['assault', 'Total Assault'],
  pull: ['recruit', 'Recruit'],
  levelUp: ['students', 'Students'],
  spendCoins: ['mall', 'Mall'],
  gearReroll: ['backpack', 'Backpack'],
  login: null,
  dailyDone: null,
};
const MISSION_EVENTS = Object.fromEntries([...DAILY_MISSIONS, ...WEEKLY_MISSIONS].map((m) => [m.id, m.events]));

function msUntil(kind) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  if (kind === 'weekly') {
    const day = now.getDay() || 7; // Monday = 1
    next.setDate(next.getDate() + (7 - day));
  }
  return next - now;
}

function formatDuration(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440);
  const hh = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  return d ? `${d}d ${hh}h` : `${hh}h ${String(mm).padStart(2, '0')}m`;
}

export function render(root, params = {}) {
  const { el, body } = screen('Commissions', { cls: 'ma-commissions-screen' });
  root.appendChild(el);
  // Midnight rollover while the game stayed open (idempotent).
  const reset = onAppStart(store.profile);
  if (reset.dailyReset || reset.weeklyReset) store.commit('missions');

  let active = TAB_IDS.includes(params.tab) ? params.tab : 'daily';
  const tabHost = h('div');
  const content = h('div.ma-comm-content.ma-tab-body');
  body.append(h('div.ma-wrap', tabHost, content));

  const badges = () => {
    const p = store.profile;
    const ml = missionList(p);
    return {
      daily: ml.daily.some((m) => m.claimable),
      weekly: ml.weekly.some((m) => m.claimable),
      login: loginCalendar(p).claimable,
      achievements: achievementList(p).some((a) => a.claimable),
      codes: false,
    };
  };
  const labels = { daily: 'Daily', weekly: 'Weekly', login: 'Login', achievements: 'Achievements', codes: 'Codes' };

  const drawTabs = () => {
    clear(tabHost);
    const b = badges();
    const bar = tabs(TAB_IDS.map((id) => ({ id, label: labels[id], badge: b[id] })), active, (id) => {
      active = id;
      rememberParams('commissions', { tab: id });
      draw();
    });
    bar.classList.add('ma-tabs');
    tabHost.appendChild(bar);
  };

  const draw = () => {
    drawTabs();
    clear(content);
    const panelEl = h('div.ma-comm-panel');
    if (active === 'daily' || active === 'weekly') panelEl.appendChild(missionsView(active, draw));
    else if (active === 'login') panelEl.appendChild(loginView(draw));
    else if (active === 'achievements') panelEl.appendChild(achievementsView(draw));
    else panelEl.appendChild(codesView());
    content.appendChild(panelEl);
  };
  draw();
  const off = store.on('change', (e) => { if (e?.reason === 'replace') draw(); });
  return () => off();
}

function progressBar(progress, goal) {
  const pct = goal ? Math.min(100, Math.round((progress / goal) * 100)) : 0;
  return h(`div.ma-progress${progress >= goal ? '.done' : ''}`, h('i', { style: { width: `${pct}%` } }));
}

function missionsView(kind, redraw) {
  const profile = store.profile;
  const list = missionList(profile)[kind];
  const claimable = list.filter((m) => m.claimable).length;
  const done = list.filter((m) => m.claimed).length;
  const gemsTotal = list.reduce((a, m) => a + m.rewards.filter((r) => r.id === 'gems').reduce((x, r) => x + r.count, 0), 0);
  const wrap = h('div');
  wrap.appendChild(h('div.ma-comm-head',
    h('div', h('h3.ma-section-title', kind === 'daily' ? 'Daily commissions' : 'Weekly commissions'),
      h('div.muted', `${done}/${list.length} claimed · ${gemsTotal} gems in total · resets in ${formatDuration(msUntil(kind))}`)),
    button(claimable ? `Claim all (${claimable})` : 'Claim all', {
      kind: 'yellow',
      icon: 'gift',
      disabled: !claimable,
      testid: 'claim-all',
      onClick: () => {
        const r = claimAllMissions(profile, kind);
        if (!r.ok) return;
        store.commit('missions');
        showRewardsModal({ title: 'Commission rewards', rewards: r.rewards });
        redraw();
      },
    }),
  ));
  const sorted = [...list].sort((a, b) => Number(b.claimable) - Number(a.claimable) || Number(a.claimed) - Number(b.claimed));
  const rows = h('div.ma-mission-list');
  sorted.forEach((m, i) => {
    const events = MISSION_EVENTS[m.id] || [];
    const go = events.map((e) => EVENT_ROUTE[e]).find(Boolean);
    const row = h(`div.ma-mission${m.claimable ? '.ready' : ''}${m.claimed ? '.claimed' : ''}`,
      h('div.ma-mission-main',
        h('div.ma-mission-name', m.name),
        h('div.muted.ma-mission-desc', m.desc),
        h('div.ma-mission-prog', progressBar(m.progress, m.goal), h('span.ma-mission-count', `${formatNumber(m.progress)}/${formatNumber(m.goal)}`)),
      ),
      h('div.ma-mission-rewards', rewardTiles(m.rewards, { size: 46 })),
      h('div.ma-mission-act',
        m.claimed
          ? h('span.ma-claimed', svgEl(uiIcon('check'), 'ma-inline-icon'), 'Claimed')
          : m.claimable
            ? button('Claim', {
              kind: 'yellow',
              small: true,
              testid: `claim-${m.id}`,
              onClick: () => {
                const r = claimMission(profile, kind, m.id);
                if (!r.ok) return;
                store.commit('missions');
                showRewardsModal({ title: m.name, rewards: r.rewards });
                redraw();
              },
            })
            : go
              ? button('Go', { kind: 'ghost', small: true, icon: 'teleport', onClick: () => navigate(go[0]) })
              : h('span.muted', 'In progress'),
      ),
    );
    row.style.animationDelay = `${i * 30}ms`;
    rows.appendChild(row);
  });
  wrap.appendChild(rows);
  return wrap;
}

function loginView(redraw) {
  const profile = store.profile;
  const cal = loginCalendar(profile);
  const wrap = h('div');
  wrap.appendChild(h('div.ma-comm-head',
    h('div', h('h3.ma-section-title', 'Login calendar'), h('div.muted', `7-day cycle · ${cal.streak} total check-ins · missed days never reset your progress`)),
    button(cal.claimable ? 'Claim today' : 'Come back tomorrow', {
      kind: 'yellow',
      icon: 'gift',
      disabled: !cal.claimable,
      testid: 'login-claim-btn',
      onClick: () => {
        const r = claimLogin(profile);
        if (!r.ok) return;
        store.commit('login');
        showRewardsModal({ title: `Day ${r.day} reward`, rewards: r.rewards });
        redraw();
      },
    }),
  ));
  const grid = h('div.ma-calendar');
  cal.days.forEach((d) => {
    const isToday = d.today && cal.claimable;
    grid.appendChild(h(`div.ma-cal-day${d.claimed ? '.claimed' : ''}${isToday ? '.today' : ''}${d.day === 7 ? '.big' : ''}`,
      h('div.ma-cal-num', `Day ${d.day}`),
      rewardTiles(d.rewards, { size: d.day === 7 ? 56 : 48 }),
      d.claimed ? h('div.ma-cal-stamp', svgEl(uiIcon('check'))) : null,
      isToday ? h('div.ma-cal-today', 'Today') : null,
    ));
  });
  wrap.appendChild(grid);
  wrap.appendChild(h('p.muted.ma-hint', `Next reset in ${formatDuration(msUntil('daily'))} (local midnight, ${dayKey()}).`));
  return wrap;
}

function achievementsView(redraw) {
  const profile = store.profile;
  const list = achievementList(profile);
  const done = list.filter((a) => a.claimed).length;
  const claimable = list.filter((a) => a.claimable);
  const wrap = h('div');
  wrap.appendChild(h('div.ma-comm-head',
    h('div', h('h3.ma-section-title', 'Achievements'), h('div.muted', `${done}/${list.length} completed`)),
    button(claimable.length ? `Claim all (${claimable.length})` : 'Claim all', {
      kind: 'yellow',
      icon: 'trophy',
      disabled: !claimable.length,
      onClick: () => {
        const all = [];
        for (const a of claimable) {
          const r = claimAchievement(profile, a.id);
          if (r.ok) all.push(...r.rewards);
        }
        store.commit('achievements');
        showRewardsModal({ title: 'Achievement rewards', rewards: mergeRewards(all) });
        redraw();
      },
    }),
  ));
  const sorted = [...list].sort((a, b) => Number(b.claimable) - Number(a.claimable) || Number(a.claimed) - Number(b.claimed) || (b.progress / b.goal) - (a.progress / a.goal));
  const rows = h('div.ma-mission-list');
  for (const a of sorted) {
    rows.appendChild(h(`div.ma-mission.ach${a.claimable ? '.ready' : ''}${a.claimed ? '.claimed' : ''}`,
      h('div.ma-ach-icon', svgEl(uiIcon('trophy'))),
      h('div.ma-mission-main',
        h('div.ma-mission-name', a.name),
        h('div.muted.ma-mission-desc', a.desc),
        h('div.ma-mission-prog', progressBar(a.progress, a.goal), h('span.ma-mission-count', `${formatNumber(a.progress)}/${formatNumber(a.goal)}`)),
      ),
      h('div.ma-mission-rewards', rewardTiles(a.rewards, { size: 46 })),
      h('div.ma-mission-act',
        a.claimed
          ? h('span.ma-claimed', svgEl(uiIcon('check'), 'ma-inline-icon'), 'Done')
          : a.claimable
            ? button('Claim', {
              kind: 'yellow',
              small: true,
              onClick: () => {
                const r = claimAchievement(profile, a.id);
                if (!r.ok) return;
                store.commit('achievements');
                showRewardsModal({ title: a.name, rewards: r.rewards });
                redraw();
              },
            })
            : h('span.muted', `${Math.floor((a.progress / a.goal) * 100)}%`),
      ),
    ));
  }
  wrap.appendChild(rows);
  return wrap;
}

function mergeRewards(list) {
  const m = new Map();
  for (const r of list) m.set(r.id, (m.get(r.id) || 0) + r.count);
  return [...m].map(([id, count]) => ({ id, count }));
}

function codesView() {
  const input = h('input.ma-input', { type: 'text', placeholder: 'Enter a code', autocomplete: 'off', autocapitalize: 'characters', spellcheck: false, 'data-testid': 'code-input', maxlength: 32 });
  const status = h('div.ma-code-status');
  const submit = async () => {
    const code = input.value.trim();
    if (!code) {
      input.focus();
      return;
    }
    const profile = store.profile;
    const r = redeemCode(profile, code);
    status.className = 'ma-code-status';
    if (!r.ok) {
      status.classList.add('bad');
      status.textContent = r.error === 'redeemed' ? 'You already redeemed this code.' : 'That code is not valid. Codes ignore spaces and capitals.';
      input.classList.remove('shake');
      void input.offsetWidth;
      input.classList.add('shake');
      return;
    }
    if (r.action === 'resetProgress') {
      const ok = await ask(h('div', h('p', h('b', 'This erases ALL progress: '), 'students, items, medals and settings.'), h('p.muted', r.desc || '')), { title: 'Reset all progress?', ok: 'Reset everything', danger: true });
      if (!ok) {
        status.textContent = 'Reset cancelled.';
        return;
      }
      store.reset();
      toast('Progress reset — welcome to Sakura Academy!', 'good');
      navigate('lobby');
      return;
    }
    store.commit('redeem');
    paintRedeemed(); // the list stayed stale until the tab was re-entered
    input.value = '';
    status.classList.add('good');
    status.textContent = r.desc || 'Redeemed!';
    showRewardsModal({ title: 'Code redeemed', rewards: r.rewards, note: r.desc });
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  const redeemedHost = h('div');
  const paintRedeemed = () => {
    const redeemed = store.profile.redeemed || [];
    clear(redeemedHost);
    if (redeemed.length) redeemedHost.appendChild(h('div.ma-redeemed', h('div.ma-sub', 'Redeemed'), h('div.row', redeemed.map((c) => h('span.chip', svgEl(uiIcon('check'), 'ma-inline-icon'), c)))));
  };
  paintRedeemed();
  return h('div.ma-codes',
    h('h3.ma-section-title', 'Redemption codes'),
    h('p.muted', 'Codes are shared in update notes and events. Each code works once per account.'),
    h('div.ma-code-row', input, button('Redeem', { kind: 'yellow', icon: 'gift', testid: 'code-redeem', onClick: submit })),
    status,
    redeemedHost,
  );
}
