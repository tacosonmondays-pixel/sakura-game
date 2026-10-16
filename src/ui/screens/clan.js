// #/clan — clans. Without a clan: browse / search, create, join by code (the developer clan's
// private code, set by the owner in the database, opens the developer clan), and "Donations
// waiting for you" when a former clan left some. With a clan
// (#/clan or #/clan/<id>?tab=…): header with level and XP, and tabs Members · Chat · Requests
// (tab id 'donate': material requests + donations) · Clan Boss · Applicants (leaders/officers;
// tab id 'requests' — the old join-requests tab keeps its id for old links) · Supply Bot (dev clan).
import { h, screen, button, toast, confirmDialog, tabs as tabBar } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { ensureOnline, avatar, levelChip, showError, connecting, localNotice, PEOPLE_GLYPH } from '../online/common.js';
import { createChatPanel } from '../online/chatPanel.js';
import { createSupplyBot } from '../online/supplyBot.js';
import {
  EMBLEMS, JOIN_MODES, ROLE_NAMES, CLAN_MAX_MEMBERS, BOSS_HITS_PER_DAY, BOSS_REWARDS, levelFromXp, can, validateClan, agoText, msToWeekReset,
  bossHitCap,
} from '../../online/clanRules.js';
import { addItems } from '../../systems/inventory.js';
import { itemTile } from '../components.js';
import { enemyToken } from '../battle/util.js';
import { bossPortrait } from '../online/bossArt.js';
import { makeRoomCode } from '../../online/coop/session.js';
import { onlineHeadExtra } from '../online/inboxButton.js';
import { openPlayerCard } from '../online/playerCard.js';
import { createDonatePanel, collectCard } from '../online/donatePanel.js';
import { hub } from '../online/socialHub.js';
import { clanEmblem as emblem, recruitSlot, clanInviteRows } from '../online/clanInvite.js';

export function render(root, params = {}) {
  const { el, body } = screen('Clan', { cls: 'ol-screen', extra: onlineHeadExtra() });
  root.append(el);
  let destroyed = false;
  const cleanups = [];
  const cleanup = () => {
    for (const fn of cleanups.splice(0)) fn();
  };

  async function start() {
    const backend = await ensureOnline();
    if (destroyed) return;
    const mine = await backend.myClan();
    if (destroyed) return;
    cleanup();
    if (mine) home(backend, mine);
    else browse(backend);
  }

  // ---------------------------------------------------------------------------------------
  // No clan: browse / create / code
  // ---------------------------------------------------------------------------------------
  function browse(backend) {
    const search = h('input.ol-input', { type: 'search', placeholder: 'Search clans by name or tag', 'data-testid': 'clan-search' });
    // a recruiting card's "View clan" opens this list on that clan (#/clan?find=TAG)
    if (params.find) search.value = String(params.find).slice(0, 20);
    // [clan invites] invites waiting for me (also in Messages → Requests)
    const invitesBox = h('div.ol-clan-invites', { 'data-testid': 'clan-invites' });
    const paintInvites = async () => {
      try {
        const rows = await clanInviteRows({ onChange: paintInvites, onJoined: () => start() });
        if (!destroyed) invitesBox.replaceChildren(...rows);
      } catch {
        /* the list stays as it was */
      }
    };
    paintInvites();
    const list = h('div.ol-clan-list', { 'data-testid': 'clan-list' });
    let timer = 0;
    const refresh = async () => {
      try {
        const clans = await backend.listClans({ query: search.value });
        if (destroyed) return;
        list.replaceChildren(...(clans.length ? clans.map(clanCard) : [h('div.ol-empty', h('b', 'No clans yet'), h('p.muted', 'Create the first one — friends can find it here or join with its code.'))]));
      } catch (e) {
        showError(e);
      }
    };
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 250);
    });

    function clanCard(c) {
      const full = c.memberCount >= c.maxMembers;
      const act = c.joinMode === 'open'
        ? button('Join', { kind: 'yellow', small: true, testid: `join-${c.tag}`, disabled: full, onClick: () => run(() => backend.joinClan(c.id), `Welcome to ${c.name}!`) })
        : c.joinMode === 'request'
          ? button('Request', { kind: 'primary', small: true, testid: `request-${c.tag}`, disabled: full, onClick: () => run(() => backend.requestJoin(c.id), 'Request sent — an officer will answer soon.', false) })
          : h('span.chip', 'Invite code');
      return h('article.ol-clan-card', { 'data-testid': 'clan-card' },
        emblem(c.emblem, 52),
        h('div.ol-clan-info',
          h('div.ol-clan-name', h('b', c.name), h('span.ol-tag', `[${c.tag}]`)),
          h('div.ol-clan-meta', h('span.ol-lv', `Lv ${c.level}`), h('span', `${c.memberCount}/${c.maxMembers} members`), h('span.ol-mode', JOIN_MODES[c.joinMode])),
          c.description ? h('p.ol-clan-desc', c.description) : null),
        act);
    }

    async function run(fn, msg, reload = true) {
      try {
        await fn();
        toast(msg, 'good');
        if (reload) start();
      } catch (e) {
        showError(e);
      }
    }

    // create form
    let pick = 'assault';
    let mode = 'open';
    const name = h('input.ol-input', { type: 'text', maxlength: 20, placeholder: 'Clan name (3–20)', 'data-testid': 'clan-name' });
    const tag = h('input.ol-input.ol-input-tag', { type: 'text', maxlength: 4, placeholder: 'TAG', 'data-testid': 'clan-tag' });
    tag.addEventListener('input', () => {
      tag.value = tag.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
    const desc = h('input.ol-input', { type: 'text', maxlength: 140, placeholder: 'Description (optional)', 'data-testid': 'clan-desc' });
    const emblems = h('div.ol-emblems');
    const paintEmblems = () => emblems.replaceChildren(...EMBLEMS.map((e) => h(`button.ol-emblem-btn${e === pick ? '.on' : ''}`, { type: 'button', title: e, onclick: () => { pick = e; paintEmblems(); } }, emblem(e, 34))));
    paintEmblems();
    const modes = h('div.ol-seg');
    const paintModes = () => modes.replaceChildren(...Object.entries(JOIN_MODES).map(([k, v]) => h(`button.ol-seg-btn${k === mode ? '.on' : ''}`, { type: 'button', onclick: () => { mode = k; paintModes(); } }, v)));
    paintModes();
    const err = h('p.ol-error');
    const create = button('Create clan', {
      kind: 'yellow',
      icon: 'plus',
      testid: 'clan-create',
      onClick: async () => {
        const spec = { name: name.value, tag: tag.value, emblem: pick, joinMode: mode, description: desc.value };
        const bad = validateClan(spec);
        if (bad) {
          err.textContent = bad;
          return;
        }
        err.textContent = '';
        await run(() => backend.createClan(spec), `${spec.name} is founded!`);
      },
    });

    const code = h('input.ol-input', { type: 'text', maxlength: 16, placeholder: 'Invite code', 'data-testid': 'clan-code', autocomplete: 'off' });
    const joinCode = button('Join', { kind: 'primary', small: true, testid: 'clan-code-join', onClick: () => code.value.trim() && run(() => backend.joinByCode(code.value.trim()), 'Joined!') });

    body.replaceChildren(h('div.ol-layout',
      h('div.ol-main',
        h('section.panel.ol-browse',
          h('h3.panel-title', 'Find a clan'),
          h('div.ol-browse-body', ...[localNotice('clan'), invitesBox, search, list].filter(Boolean)))),
      h('aside.ol-side',
        collectCard(backend), // [social] donations from a clan you left
        h('section.panel.ol-create', { 'data-testid': 'clan-create-panel' },
          h('h3.panel-title', 'Create a clan'),
          h('div.ol-form',
            h('div.ol-form-row', name, tag),
            h('label.ol-label', 'Emblem'), emblems,
            h('label.ol-label', 'Who can join'), modes,
            desc, err, create)),
        h('section.panel',
          h('h3.panel-title', 'Join with a code'),
          h('div.ol-form', h('div.ol-form-row', code, joinCode), h('p.muted', 'Leaders of invite-only clans share a code.'))))));
    refresh();
    // new / disbanded clans and member counts refresh the list live
    const off = backend.subscribeClan('_list', () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 250);
    });
    cleanups.push(off, () => clearTimeout(timer));
  }

  // ---------------------------------------------------------------------------------------
  // In a clan
  // ---------------------------------------------------------------------------------------
  function home(backend, mine) {
    let clan = mine.clan;
    let role = mine.role;
    // Tab ids vs labels: 'donate' is labelled "Requests" (material requests, everyone) and
    // 'requests' is labelled "Applicants" (join requests, officers) — the ids stay stable for links.
    let hubDot = hub.badges.donationsReady > 0; // donations arrived for me
    let panelDot = false; // the Requests tab saw requests I can help with
    let donateBadge = hubDot;
    const tabsList = () => {
      const t = [{ id: 'members', label: 'Members' }, { id: 'chat', label: 'Chat' }];
      if (!clan.isDev) t.push({ id: 'donate', label: 'Requests', badge: donateBadge });
      t.push({ id: 'boss', label: 'Clan Boss' });
      if (can(role, 'answer') && !clan.isDev) t.push({ id: 'requests', label: 'Applicants' });
      if (clan.isDev) t.push({ id: 'supply', label: 'Supply Bot' });
      return t;
    };
    const tabItems = tabsList();
    let tab = tabItems.some((t) => t.id === params.tab) ? params.tab : clan.isDev ? 'supply' : 'members';
    const header = h('section.panel.ol-clan-head', { 'data-testid': 'clan-home' });
    const pane = h('div.ol-pane');
    const tabsEl = tabBar(tabItems, tab, (id) => {
      tab = id;
      navigate('clan', { tab: id }, { replace: true });
      paintTab();
    });
    const setDonateBadge = () => {
      const on = hubDot || panelDot;
      if (on === donateBadge) return;
      donateBadge = on;
      const it = tabItems.find((t) => t.id === 'donate');
      if (it) it.badge = on;
      tabsEl.setActive(tab);
    };
    body.replaceChildren(h('div.ol-clan-wrap', ...[header, localNotice('clan'), tabsEl, pane].filter(Boolean)));
    let paneCleanup = null;
    let paneRefresh = null;

    function paintHeader() {
      const lv = levelFromXp(clan.xp);
      header.replaceChildren(
        emblem(clan.emblem, 64),
        h('div.ol-clan-id',
          h('div.ol-clan-name', h('b', { 'data-testid': 'clan-title' }, clan.name), h('span.ol-tag', `[${clan.tag}]`), clan.isDev ? h('span.ol-dev-badge', 'DEV') : null),
          h('div.ol-clan-meta',
            h('span.ol-role', ROLE_NAMES[role] || role),
            h('span', { 'data-testid': 'clan-count' }, `${clan.memberCount}/${clan.maxMembers} members`),
            h('span.ol-mode', JOIN_MODES[clan.joinMode]),
            clan.joinCode ? h('span.ol-code', 'Code ', h('b', { 'data-testid': 'clan-join-code' }, clan.joinCode)) : null),
          clan.description ? h('p.ol-clan-desc', clan.description) : null,
          recruitSlot({ clan, role })), // [clan invites] the daily recruiting post (leader / officers)
        h('div.ol-clan-level',
          h('div.ol-lvl-big', h('small', 'CLAN LV'), h('b', String(lv.level))),
          h('div.ol-xp', h('i', { style: { width: `${Math.round(lv.pct * 100)}%` } })),
          h('small.muted', lv.need ? `${formatNumber(lv.into)}/${formatNumber(lv.need)} XP` : 'Max level')),
        button('Leave', { kind: 'ghost', small: true, testid: 'clan-leave', onClick: leave }),
      );
    }

    async function leave() {
      const last = clan.memberCount <= 1 && !clan.isDev;
      if (!(await confirmDialog(last ? `You are the last member: leaving disbands ${clan.name}.` : `Leave ${clan.name}?`, { title: 'Leave clan', ok: 'Leave', danger: true }))) return;
      try {
        await backend.leaveClan();
        toast('You left the clan.', 'info');
        start();
      } catch (e) {
        showError(e);
      }
    }

    function paintTab() {
      paneCleanup?.();
      paneCleanup = null;
      paneRefresh = null;
      pane.dataset.tab = tab;
      if (tab === 'donate' && !clan.isDev) {
        const panel = createDonatePanel({ backend, onBadge: (n) => { panelDot = n > 0; setDonateBadge(); } });
        pane.replaceChildren(panel.el);
        paneCleanup = () => panel.destroy();
        paneRefresh = () => panel.refresh();
      } else if (tab === 'chat') {
        const chat = createChatPanel({ channel: `clan:${clan.id}`, emptyText: 'Your clan chat is quiet. Plan this week\'s boss!' });
        pane.replaceChildren(chat.el);
        paneCleanup = () => chat.destroy();
      } else if (tab === 'boss') {
        paneCleanup = bossTab(backend, clan, pane);
      } else if (tab === 'requests') {
        paneCleanup = requestsTab(backend, clan, pane);
      } else if (tab === 'supply' && clan.isDev) {
        const bot = createSupplyBot();
        pane.replaceChildren(bot.el);
        paneCleanup = () => bot.destroy();
      } else {
        paneCleanup = membersTab(backend, clan, role, pane);
      }
    }

    paintHeader();
    paintTab();
    let t = 0;
    const off = backend.subscribeClan(clan.id, () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        try {
          const now = await backend.myClan();
          if (destroyed) return;
          if (!now) {
            toast('You are no longer in this clan.', 'info');
            start();
            return;
          }
          clan = now.clan;
          role = now.role;
          paintHeader();
          tabsEl.setActive(tab);
          if (tab === 'donate') paneRefresh?.();
          else if (tab === 'members' || tab === 'requests' || tab === 'boss') paintTab();
        } catch {
          /* keep showing what we have */
        }
      }, 120);
    });
    // [social] donations that arrived for me (Requests tab dot)
    const offBadges = hub.on('badges', (b) => { hubDot = b.donationsReady > 0; setDonateBadge(); });
    cleanups.push(off, offBadges, () => paneCleanup?.(), () => clearTimeout(t));
    backend.touch().catch(() => {});
  }

  connecting(body, start);
  return () => {
    destroyed = true;
    cleanup();
  };
}

// -------------------------------------------------------------------------------------------
// Tabs
// -------------------------------------------------------------------------------------------

function membersTab(backend, clan, role, pane) {
  let alive = true;
  const list = h('div.ol-members', { 'data-testid': 'member-list' });
  pane.replaceChildren(list);
  (async () => {
    try {
      const members = await backend.members(clan.id);
      if (!alive) return;
      list.replaceChildren(...members.map((m) => {
        const me = m.userId === backend.uid;
        const acts = [];
        if (!me && can(role, 'setRole') && !clan.isDev) {
          if (m.role === 'member') acts.push(button('Promote', { kind: 'ghost', small: true, onClick: () => act(() => backend.setRole(m.userId, 'officer')) }));
          if (m.role === 'officer') {
            acts.push(button('Make leader', { kind: 'ghost', small: true, onClick: async () => { if (await confirmDialog(`Hand leadership to ${m.name}? You become an officer.`, { title: 'New leader', ok: 'Hand over' })) act(() => backend.setRole(m.userId, 'leader')); } }));
            acts.push(button('Demote', { kind: 'ghost', small: true, onClick: () => act(() => backend.setRole(m.userId, 'member')) }));
          }
        }
        if (!me && can(role, 'kick', m.role) && !clan.isDev) acts.push(button('Remove', { kind: 'danger', small: true, testid: 'member-remove', onClick: async () => { if (await confirmDialog(`Remove ${m.name} from the clan?`, { title: 'Remove member', ok: 'Remove', danger: true })) act(() => backend.kick(m.userId)); } }));
        if (!me) acts.push(button('Co-op', { kind: 'yellow', small: true, icon: 'play', testid: 'member-coop', onClick: () => navigate('coop', { id: makeRoomCode(), host: '1', invite: 'clan' }) }));
        const recent = Date.now() - m.lastActive < 5 * 60000;
        // [social] tap a member: their player card (Message, Invite to co-op, Add friend, Block, Report)
        const card = () => openPlayerCard(m.userId, { name: m.name, level: m.level, avatar: m.avatar }, { context: 'clan', clanmate: !me });
        return h(`div.ol-member${me ? '.me' : ''}`, { 'data-testid': 'member-row', 'data-user': m.userId },
          h('button.ol-member-tap', { type: 'button', 'data-testid': 'member-card', onclick: card, 'aria-label': `${m.name}: player card` },
            avatar(m.avatar, 40),
            h('div.ol-member-info',
              h('div.ol-member-name', h('b', m.name), levelChip(m.level), h(`span.ol-role-badge.ol-role-${m.role}`, ROLE_NAMES[m.role])),
              h('small.muted', recent ? h('span.ol-online-dot', 'Online') : `Active ${agoText(m.lastActive)}`))),
          h('div.ol-member-acts', acts));
      }));
    } catch (e) {
      showError(e);
    }
  })();
  async function act(fn) {
    try {
      await fn();
    } catch (e) {
      showError(e);
    }
  }
  return () => {
    alive = false;
  };
}

function requestsTab(backend, clan, pane) {
  let alive = true;
  const list = h('div.ol-members');
  pane.replaceChildren(list);
  (async () => {
    try {
      const reqs = await backend.listRequests(clan.id);
      if (!alive) return;
      list.replaceChildren(...(reqs.length ? reqs.map((r) => h('div.ol-member', avatar(r.avatar, 40),
        h('div.ol-member-info', h('div.ol-member-name', h('b', r.name), levelChip(r.level)), h('small.muted', `Asked ${agoText(r.at)}`)),
        h('div.ol-member-acts',
          button('Accept', { kind: 'yellow', small: true, onClick: () => answer(r, true) }),
          button('Decline', { kind: 'ghost', small: true, onClick: () => answer(r, false) })))) : [h('div.ol-empty', h('b', 'No requests'), h('p.muted', clan.joinMode === 'open' ? 'Your clan is open: players join directly.' : 'New requests appear here.'))]));
    } catch (e) {
      showError(e);
    }
  })();
  async function answer(r, yes) {
    try {
      await backend.answerRequest(clan.id, r.userId, yes);
      toast(yes ? `${r.name} joined!` : 'Request declined.', yes ? 'good' : 'info');
    } catch (e) {
      showError(e);
    }
  }
  return () => {
    alive = false;
  };
}

function bossTab(backend, clan, pane) {
  let alive = true;
  pane.replaceChildren(h('div.ol-empty', 'Loading the boss…'));
  let timer = 0;
  (async () => {
    try {
      const s = await backend.bossState(clan.id);
      if (!alive) return;
      const pct = s.maxHp ? s.hp / s.maxHp : 0;
      const left = BOSS_HITS_PER_DAY - s.myHitsToday;
      const reset = h('span');
      const paintReset = () => {
        const ms = msToWeekReset();
        const d = Math.floor(ms / 86400000);
        const hh = Math.floor((ms % 86400000) / 3600000);
        reset.textContent = `Resets in ${d}d ${hh}h`;
      };
      paintReset();
      timer = setInterval(paintReset, 60000);
      const fight = button(s.defeated ? 'Defeated!' : left > 0 ? `Fight (${left}/${BOSS_HITS_PER_DAY} left)` : 'Attempts recharge within 24 h', {
        kind: 'yellow', icon: 'sword', testid: 'boss-fight', disabled: s.defeated || left <= 0,
        onClick: async () => {
          // the server times the battle from here (start_boss_attempt): starting uses no attempt
          try {
            const a = await backend.startBossAttempt();
            if (alive) navigate('battle', { stage: s.stageId, difficulty: 'normal', clanBoss: a.attemptId });
          } catch (e) {
            showError(e);
          }
        },
      });
      const canClaim = !s.claimed && s.tier && s.defeated;
      const claim = button(s.claimed ? 'Reward claimed' : canClaim ? `Claim tier ${s.tier}` : 'Rewards when the boss falls', {
        kind: canClaim ? 'pink' : 'ghost', icon: 'gift', testid: 'boss-claim', disabled: !canClaim,
        onClick: () => claimWeek(s.week),
      });
      async function claimWeek(week) {
        try {
          // the server pays a week once: the reward goes into the NEWEST save (another tab may have
          // saved since this one loaded it, M5) and is written at once — never into an old copy
          // this tab can no longer save
          store.refresh();
          const r = await backend.claimBossReward(week);
          store.refresh();
          addItems(store.profile, r.rewards);
          store.commit('clan-boss');
          store.saveNow();
          toast(`Tier ${r.tier} rewards claimed!`, 'good');
          if (alive) bossTab(backend, clan, pane);
        } catch (e) {
          showError(e);
        }
      }
      const myTier = s.tier || 'C';
      // last week's boss: its reward stays claimable for the whole next week
      const prev = s.prev && s.prev.tier && !s.prev.claimed
        ? h('div.ol-prev-claim', { 'data-testid': 'boss-prev' },
          h('span', `Last week (${s.prev.week.split('-W')[1]}): rank ${s.prev.rank} · ${formatNumber(s.prev.damage)} damage → tier ${s.prev.tier}`),
          button(`Claim tier ${s.prev.tier}`, { kind: 'pink', small: true, icon: 'gift', testid: 'boss-prev-claim', onClick: () => claimWeek(s.prev.week) }))
        : null;
      // the boss's own 3D model as a still (the token stands in until it is drawn)
      const token = enemyToken(s.enemyId, { size: 96 });
      const art = h(`div.ol-boss-art${s.defeated ? '.down' : ''}`, { 'data-testid': 'boss-art' }, ...[token,
        s.defeated ? h('span.ol-boss-stamp', 'DEFEATED') : null].filter(Boolean));
      bossPortrait(s.enemyId).then((url) => {
        if (!url || !alive || !art.isConnected) return;
        token.replaceWith(h('img.ol-boss-img', { src: url, alt: s.name, draggable: false }));
        art.classList.add('has-img');
      });
      pane.replaceChildren(h('div.ol-boss', { 'data-testid': 'boss-panel' }, prev,
        h(`section.panel.ol-boss-card${s.defeated ? '.down' : ''}`,
          art,
          h('div.ol-boss-info',
            h('div.ol-boss-kicker', `Week ${s.week.split('-W')[1]} · Clan Boss`, reset),
            h('div.ol-boss-name', s.name),
            h('div.ol-hp', { 'data-testid': 'boss-hp' }, h('i', { style: { width: `${(pct * 100).toFixed(1)}%` } }), h('span', `${formatNumber(s.hp)} / ${formatNumber(s.maxHp)} HP`)),
            h('p.muted', `Every clan member's battle damage drains this shared HP pool. Three attempts per 24 hours on this week's Total Assault arena (up to ${formatNumber(bossHitCap(s.bossId))} damage counts per battle); the boss resets every Monday (UTC).`),
            h('div.ol-boss-acts', fight, claim)),
        ),
        h('div.ol-boss-cols',
          h('section.panel.ol-board',
            h('h3.panel-title', 'Damage ranking'),
            s.board.length
              ? h('ol.ol-board-list', s.board.map((r, i) => h(`li${r.userId === backend.uid ? '.me' : ''}`, h('span.ol-rank', String(i + 1)), h('b', r.name), h('span.muted', `${r.hits}×`), h('span.ol-dmg', formatNumber(r.damage)))))
              : h('p.muted', 'Nobody has fought yet this week. Be the first!')),
          h('section.panel.ol-rewards',
            h('h3.panel-title', 'Rewards'),
            h('p.muted', 'When the boss falls: 1st place S, 2nd–3rd A, everyone else who hit it B. If it survives the week, every attacker earns C.'),
            h('div.ol-tier-row', h('b.ol-tier', s.tier ? `Your tier: ${myTier}` : 'Hit the boss to earn a tier')),
            h('div.ol-tiles', (BOSS_REWARDS[s.tier || 'B'] || []).map((r) => itemTile(r.id, r.count, { size: 48 })))))));
    } catch (e) {
      pane.replaceChildren(h('div.ol-empty', 'The boss could not be loaded.'));
      showError(e);
    }
  })();
  return () => {
    alive = false;
    clearInterval(timer);
  };
}

export { PEOPLE_GLYPH, CLAN_MAX_MEMBERS };
