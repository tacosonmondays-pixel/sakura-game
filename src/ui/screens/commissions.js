// Commissions (owner: meta-a). Route: #/commissions?tab=daily|weekly|login|achievements|codes
// Daily / weekly commissions with progress, claim and "Go" shortcuts, the 7-day login
// calendar, one-time achievements and redemption codes.
// UI M5b (docs/specs/UI_DIRECTION.md §5.10): a hub with a host. Miko stands in the left 35% on Daily, Weekly, Login
// and Codes with a line for the state (hostLines.js); Achievements takes the whole width without her (notes Q9).
// The staff room behind (E6, the academy with a warm tint for now), the list under an ink plate header (E2), one
// yellow Claim all (data-primary) with an ink Claim per row (P2), the reset as a countdown chip (§5.9), and a
// "complete!" stamp on the login days already claimed (display only). The five tabs stay on top, where they never move.
// The M5b review: the tabs are the §5.3 rail (an icon and a CAPS word, the open one an ink plate with a yellow bar;
// narrow portrait screens show the open tab's word only); under 800 px of width Miko is a chip in the list's plate
// header and the list takes the whole width (the collapse rule, host.js); a reward's count sits under its tile.
import '../styles/meta-a.css';
import '../styles/hubs.css';
import { h, clear, screen, svgEl, toast, button } from '../components.js';
import { countdownChip, plateHead, inkBtn, kbdHint, iconBtn, rail, btnCount } from '../kit.js';
import { msToLocalMidnight, msToLocalWeekEnd } from '../countdown.js';
import { hubBackdrop } from '../hubArt.js';
import { hubHost, hubMode, placeHost, viewport, watchHostMode } from '../hubHost.js';
import { commissionsState, loginState } from '../hubStates.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { DAILY_MISSIONS, WEEKLY_MISSIONS } from '../../data/missions.js';
import { uiIcon } from '../../art/icons.js';
import {
  onAppStart, missionList, claimMission, claimAllMissions, loginCalendar, claimLogin,
  achievementNotice, redeemCode,
} from '../../systems/missions.js';
import { achievementsView } from './achievements/list.js';
import { tabSwap } from '../motion.js';
import { tile, showRewardsModal, ask, rememberParams } from './stage.js';

const TAB_IDS = ['daily', 'weekly', 'login', 'achievements', 'codes'];
/** The rail's icons (§5.3: an icon and one word per tab). */
const TAB_ICON = { daily: 'mission', weekly: 'calendar', login: 'gift', achievements: 'trophy', codes: 'sparkle' };

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

/** Time to the next daily (local midnight) or weekly (Monday) reset. */
const msUntil = (kind) => (kind === 'weekly' ? msToLocalWeekEnd() : msToLocalMidnight());

export function render(root, params = {}) {
  const { el, body } = screen('Commissions', { cls: 'ma-commissions-screen hb-screen' });
  el.insertBefore(hubBackdrop('commissions'), el.firstChild);
  root.appendChild(el);
  // Midnight rollover while the game stayed open (idempotent).
  const rollover = () => {
    const reset = onAppStart(store.profile);
    if (reset.dailyReset || reset.weeklyReset) store.commit('missions');
  };
  rollover();

  let active = TAB_IDS.includes(params.tab) ? params.tab : 'daily';
  const tabHost = h('div.cm-tabs');
  const content = h('div.ma-comm-content.cm-panel');
  const main = h('div.hb-main', content);
  const hub = h('div.hb.cm-hb', main);
  body.append(h('div.cm-wrap', tabHost, hub));

  const badges = () => {
    const p = store.profile;
    const ml = missionList(p);
    return {
      daily: ml.daily.some((m) => m.claimable),
      weekly: ml.weekly.some((m) => m.claimable),
      login: loginCalendar(p).claimable,
      achievements: achievementNotice(p).dot, // gate-locked rows never light it
      codes: false,
    };
  };
  const labels = { daily: 'Daily', weekly: 'Weekly', login: 'Login', achievements: 'Achievements', codes: 'Codes' };

  const drawTabs = () => {
    clear(tabHost);
    const b = badges();
    // [ui-m5] the §5.3 rail: an icon and a CAPS word; a red dot only; the tab ids and test ids are the old ones
    const bar = rail(TAB_IDS.map((id) => ({ id, label: labels[id], icon: TAB_ICON[id], dot: b[id], dotTitle: 'something to claim' })), active, (id) => {
      active = id;
      rememberParams('commissions', { tab: id, cat: null, view: null, highlight: null });
      draw();
      tabSwap(content.firstElementChild); // (the new tab's list: a crossfade and a 12 px shift, motion.js)
    }, { label: 'Commissions', cls: 'cm-rail' });
    // (each word in its own span: a narrow portrait screen shows the open tab's word only; the tab's name stays in
    // its aria-label)
    for (const sp of bar.querySelectorAll('.ui-tab > span')) {
      for (const n of [...sp.childNodes]) if (n.nodeType === 3 && n.nodeValue.trim()) sp.replaceChild(h('span.cm-tab-word', n.nodeValue), n);
    }
    tabHost.appendChild(bar);
  };

  // [ui-m5] Miko on every tab but Achievements (the long list needs the width): her stand in the left column, or (the
  // collapse rule) her chip at the start of the list's plate header, with no column
  let drawn = null; // the host mode on screen
  const drawHost = (panelEl) => {
    hub.querySelector(':scope > .ui-host')?.remove();
    drawn = hubMode(viewport());
    if (active === 'achievements') {
      hub.classList.add('no-host');
      return;
    }
    const p = store.profile;
    const host = active === 'login' ? hubHost('login', p, { state: loginState(p), mode: drawn }) : hubHost('commissions', p, { state: commissionsState(p), mode: drawn });
    placeHost(host, drawn, { hb: hub, slot: panelEl.querySelector('.ui-plate-head') });
  };

  let achView = null;
  const draw = () => {
    drawTabs();
    achView?.cleanup?.();
    achView = null;
    clear(content);
    // the achievements tab fills the screen (its list scrolls inside)
    el.classList.toggle('ach-mode', active === 'achievements');
    content.dataset.tab = active;
    const panelEl = h('div.ma-comm-panel');
    // [ui-m5] a reset chip that reaches zero on screen rolls the day (or week) over and redraws
    const onReset = () => {
      if (!el.isConnected) return;
      rollover();
      draw();
    };
    if (active === 'daily' || active === 'weekly') panelEl.appendChild(missionsView(active, draw, onReset));
    else if (active === 'login') panelEl.appendChild(loginView(draw, onReset));
    else if (active === 'achievements') panelEl.appendChild((achView = achievementsView({ params: first ? params : {}, onChange: drawTabs })));
    else panelEl.appendChild(codesView());
    first = false;
    content.appendChild(panelEl);
    drawHost(panelEl);
  };
  let first = true;
  draw();
  const off = store.on('change', (e) => { if (e?.reason === 'replace') draw(); });
  // a resize that flips the collapse rule (a phone turned, a window resized) draws Miko in her other place
  const offResize = watchHostMode(el, () => (active === 'achievements' ? hubMode(viewport()) : drawn), () => hubMode(viewport()), draw);
  return () => {
    off();
    offResize();
    achView?.cleanup?.();
  };
}

/**
 * A row's rewards on M3's item tile, each count in its tile's corner like every other tile in the game (the tile form
 * fmtItemCount: "x3000", "x10K"; never "x1", P7; UI_DIRECTION §5.7, owner #108). The tile is M3's, untouched: this
 * screen only sets its width (hubs.css: 62 px wherever the text floor is 13 px, so the count reads at M3's 13 px).
 */
function rewardStack(rewards, size) {
  return h('div.reward-row.cm-rwds', rewards.map((r) => h('div.cm-rwd', tile(r.id, r.count > 1 ? r.count : null, { size }))));
}

/** A plate title that shrinks to one word on narrow screens ("Daily commissions" → "Daily"). */
const plateTitle = (long, short) => [h('span.cm-title-long', long), h('span.cm-title-short', short)];

function progressBar(progress, goal) {
  const pct = goal ? Math.min(100, Math.round((progress / goal) * 100)) : 0;
  return h(`div.ma-progress${progress >= goal ? '.done' : ''}`, h('i', { style: { width: `${pct}%` } }));
}

/**
 * The one yellow button of a tab (data-primary: Space presses it on desktop), with its key hint. `count`: how many it
 * claims, in the one count pill every Claim all wears (kit.js btnCount; Achievements' is the same).
 */
function primary(label, o, count = null) {
  const b = button(label, { kind: 'yellow', ...o });
  if (count != null) b.appendChild(btnCount(count));
  if (!o.disabled) {
    b.setAttribute('data-primary', '');
    b.appendChild(kbdHint('Space'));
  }
  return b;
}

function missionsView(kind, redraw, onReset = null) {
  const profile = store.profile;
  const list = missionList(profile)[kind];
  const claimable = list.filter((m) => m.claimable).length;
  const wrap = h('div.cm-list');
  // [ui-m5] E2: the list's ink plate header: the title, the reset chip (a recurring cycle, never red; at zero the
  // list rolls over) and the one yellow Claim all
  wrap.appendChild(plateHead(kind === 'daily' ? plateTitle('Daily commissions', 'Daily') : plateTitle('Weekly commissions', 'Weekly'), {
    testid: `comm-head-${kind}`,
    right: [
      countdownChip(msUntil(kind), { label: 'Resets in', cls: 's', urgent: false, doneText: 'Reset!', onDone: onReset, testid: `comm-reset-${kind}` }),
      claimable ? primary('Claim all', {
        icon: 'gift',
        testid: 'claim-all',
        onClick: () => {
          const r = claimAllMissions(profile, kind);
          if (!r.ok) return;
          store.commit('missions');
          showRewardsModal({ title: 'Commission rewards', rewards: r.rewards });
          redraw();
        },
      }, claimable) : null,
    ],
  }));
  const sorted = [...list].sort((a, b) => Number(b.claimable) - Number(a.claimable) || Number(a.claimed) - Number(b.claimed));
  const rows = h('div.ma-mission-list');
  sorted.forEach((m, i) => {
    const events = MISSION_EVENTS[m.id] || [];
    const go = events.map((e) => EVENT_ROUTE[e]).find(Boolean);
    // a ready row shows a full bar and Claim, never "1/1" (P7); a claimed row says so once
    const count = !m.claimable && !m.claimed ? h('span.ma-mission-count', `${formatNumber(m.progress)}/${formatNumber(m.goal)}`) : null;
    const row = h(`div.ma-mission${m.claimable ? '.ready' : ''}${m.claimed ? '.claimed' : ''}`,
      h('div.ma-mission-main',
        h('div.ma-mission-name', m.name),
        h('div.muted.ma-mission-desc', m.desc),
        h('div.ma-mission-prog', progressBar(m.progress, m.goal), count),
      ),
      h('div.ma-mission-rewards', rewardStack(m.rewards, 46)),
      h('div.ma-mission-act',
        m.claimed
          ? h('span.ma-claimed', svgEl(uiIcon('check'), 'ma-inline-icon'), 'Claimed')
          : m.claimable
            ? inkBtn('Claim', {
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

function loginView(redraw, onReset = null) {
  const profile = store.profile;
  const cal = loginCalendar(profile);
  const wrap = h('div.cm-login');
  // the rule sentence lives behind "i" (P1); after today's claim the plate shows when the next gift comes
  const rule = iconBtn('info', { label: 'How the login calendar works', cls: 'small.cm-info', testid: 'login-info', onClick: () => toast('A 7-day cycle: one gift a day. Missed days never reset your progress.', 'info', 4200) });
  wrap.appendChild(plateHead(plateTitle('Login calendar', 'Login'), {
    testid: 'login-head',
    right: [
      rule,
      cal.claimable
        ? primary('Claim today', {
          icon: 'gift',
          testid: 'login-claim-btn',
          onClick: () => {
            const r = claimLogin(profile);
            if (!r.ok) return;
            store.commit('login');
            showRewardsModal({ title: `Day ${r.day} reward`, rewards: r.rewards });
            redraw();
          },
        })
        // [ui-m5] a recurring cycle, never red; at midnight the calendar rolls over and the new gift is claimable
        : countdownChip(msUntil('daily'), { label: 'Next gift', cls: 's', urgent: false, doneText: 'Ready!', onDone: onReset, testid: 'login-reset' }),
    ],
  }));
  const grid = h('div.ma-calendar.cm-calendar');
  cal.days.forEach((d) => {
    const isToday = d.today && cal.claimable;
    grid.appendChild(h(`div.ma-cal-day${d.claimed ? '.claimed' : ''}${isToday ? '.today' : ''}${d.day === 7 ? '.big' : ''}`, { 'data-testid': `login-day-${d.day}` },
      h('div.ma-cal-num', `Day ${d.day}`),
      rewardStack(d.rewards, d.day === 7 ? 52 : 46),
      // [ui-m5] a claimed day wears the "complete!" stamp (display only)
      d.claimed ? h('div.cm-stamp', { 'data-testid': `login-stamp-${d.day}`, 'aria-label': `Day ${d.day} claimed` }, h('span', 'complete!')) : null,
      isToday ? h('div.ma-cal-today', 'Today') : null,
    ));
  });
  wrap.appendChild(grid);
  return wrap;
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
      // [story] a fresh profile starts from the title: TAP TO START → the opening → the first battle (K-02)
      try {
        sessionStorage.removeItem('sakura-title-seen');
      } catch { /* private mode */ }
      navigate('title');
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
    plateHead('Redemption codes', { testid: 'codes-head' }),
    h('p.muted.cm-codes-line', 'Codes come with update notes and events. Each works once.'),
    h('div.ma-code-row', input, primary('Redeem', { icon: 'gift', testid: 'code-redeem', onClick: submit })),
    status,
    redeemedHost,
  );
}
