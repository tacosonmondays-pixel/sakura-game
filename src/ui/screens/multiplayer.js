// The Multiplayer hub (owner decisions #79 and #108; notes/ui-m5/PLAN.md §5 M5d). Route: #/multiplayer, opened by the
// lobby's Multiplayer button, the Missions tile (hub-coop) and the Menu (menu-coop).
// Momo hosts it (§5.10 E1: her stand in the left 35%, or by the collapse rule her chip in the Co-op plate header) over
// the academy with the hub's own tint (E6). The Co-op card under its ink plate header (E2):
//   - the open invites from friends and clanmates with an ink Join each (read only once the social hub is ready: this
//     screen never signs in or creates an online account; #/coop keeps its own sign-in), and "Your last room": 2 rows
//     on phones, 4 larger, so the tiles stay in view; the rest behind "n more", in a sheet;
//   - Create room, the screen's one yellow (Space on desktop), opens a room on the remembered co-op stage
//     (ss-coop-pref); the stage chip beside it opens #/coop, where the stage, freeplay and mode are picked;
//   - Quick join: the newest open invite from a friend or a clanmate (strangers are off), else off with its reason;
//   - a room code + Join.
// Under it: PvP LOCKED "Coming soon" with Rival Run inside (a sheet that explains it and does nothing else), Friends
// (Messages › Friends, a red number for friend requests), Titan Co-op "Soon" and Clan Boss (the boss tab, or the clan
// search with no clan). src/ui/screens/coop.js and the hashed co-op files are not edited: this screen only navigates
// into #/coop and calls joinInvite().
import '../styles/meta-a.css';
import '../styles/hubs.css';
import '../styles/v2-hubs.css';
import { h, screen, button, toast } from '../components.js';
import { plateHead, kbdHint, inkBtn, secondaryBtn, lockedTile, countdownChip, ico, fillIn, KIT_SVG, hubTile } from '../kit.js';
import { countBadge, soonSticker } from '../badges.js';
import { openSheet } from '../sheet.js';
import { hubBackdrop } from '../hubArt.js';
import { hubHost, hubMode, placeHost, viewport, watchHostMode } from '../hubHost.js';
import { linesFor } from '../hostLines.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { COOP, coopStages } from '../../data/coop.js';
import { STAGE_MAP } from '../../data/stages.js';
import { DIFFICULTIES } from '../../data/types.js';
import { freeplayTable } from '../../data/freeplay.js';
import { themeBackdropSVG } from '../../art/backdrops.js';
import { isStageUnlocked, modesUnlocked } from '../../systems/unlocks.js';
import { makeRoomCode, normalizeCode } from '../../online/coop/session.js';
import { lastRoom, roomRoute } from '../../online/coop/lastRoom.js';
import { msToWeekReset } from '../../online/clanRules.js';
import { getBackend } from '../../online/backend.js';
import { avatar, PEOPLE_GLYPH } from '../online/common.js';
import { hub, joinInvite } from '../online/socialHub.js';
import { inboxButton } from '../online/inboxButton.js';
import { openInvites, lastInvites } from '../online/openInvites.js';
import { hubTiles, quickJoin, roomChoice, roomChipText, stageWords, RIVAL_RUN, inviteRows, inviteRowBudget } from '../multiplayerModel.js';

/** The co-op hub's memory of the last stage, difficulty, freeplay and mode (src/ui/screens/coop.js writes it). */
export const PREF_KEY = 'ss-coop-pref';

function readPref() {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) || 'null') || {};
  } catch {
    return {};
  }
}

/** The room Create room opens: the remembered choice, checked against what this save may host now. */
function currentChoice(profile) {
  const stageIds = coopStages((id) => isStageUnlocked(profile, id)).map((s) => s.id);
  return roomChoice(readPref(), { stageIds, modesUnlocked: (id) => modesUnlocked(profile, id) });
}

/** The Rival Run sheet: one sentence, the rule chips and the rewards. Nothing in it acts (owner #108). */
export function openRivalRun() {
  return openSheet({
    title: RIVAL_RUN.title,
    testid: 'mp-rival-sheet',
    cls: 'mp-rival-sheet',
    head: soonSticker({ testid: 'mp-rival-soon' }),
    body: h('div.mp-rival',
      h('p.mp-rival-line', RIVAL_RUN.line),
      h('div.mp-rival-chips', { role: 'list', 'aria-label': 'Rules' }, RIVAL_RUN.chips.map((c) => h('span.mp-rival-chip', { role: 'listitem' }, c))),
      h('p.mp-rival-rewards', RIVAL_RUN.rewards)),
  });
}

export function render(root) {
  const { el, body } = screen('Multiplayer', { cls: 'mp-screen hb-screen v2h', extra: inboxButton() });
  el.insertBefore(hubBackdrop('multiplayer'), el.firstChild);
  root.appendChild(el);
  let alive = true;
  let state = lastInvites();

  // ---- Momo, and the Co-op card under its plate header
  let drawn = hubMode(viewport());
  const host = hubHost('multiplayer', store.profile, { state: { invites: state.count }, mode: drawn });
  const create = button('Create room', { kind: 'yellow', icon: 'plus', testid: 'mp-create', onClick: () => createRoom() });
  create.setAttribute('data-primary', '');
  create.appendChild(kbdHint('Space'));
  const chip = h('button.mp-room-chip', { type: 'button', 'data-testid': 'mp-room-chip', onclick: () => navigate('coop') });
  const head = plateHead('Co-op', { right: [chip, create], testid: 'mp-coop-head' });
  const invitesBox = h('div.mp-invites', { 'data-testid': 'mp-invites', 'aria-live': 'polite' });
  const quick = h('div.mp-quick');
  const codeInput = h('input.mp-code', { type: 'text', maxlength: 8, placeholder: 'ROOM CODE', 'aria-label': 'Room code', 'data-testid': 'mp-code', autocomplete: 'off', spellcheck: false });
  codeInput.addEventListener('input', () => { codeInput.value = normalizeCode(codeInput.value); });
  codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinCode(); });
  const actions = h('div.mp-actions', quick, h('div.mp-code-row', h('label.ui-input.mp-code-box', codeInput), inkBtn('Join', { testid: 'mp-code-join', onClick: () => joinCode() })));
  const card = h('section.panel.mp-coop', { 'data-testid': 'mp-coop' }, head, invitesBox, actions);
  const tiles = h('div.mp-tiles', { 'data-testid': 'mp-tiles' });
  const hb = h('div.hb.mp-hb', h('div.hb-main.mp-main', card, tiles));
  body.append(hb);
  placeHost(host, drawn, { hb, slot: head });
  const offResize = watchHostMode(el, () => drawn, () => hubMode(viewport()), () => {
    drawn = hubMode(viewport());
    placeHost(host, drawn, { hb, slot: head });
  });
  // a turned phone or a resized window: the card's row budget again
  let rowBudget = inviteRowBudget(viewport().vh);
  const onRows = () => {
    const b = inviteRowBudget(viewport().vh);
    if (b === rowBudget || !alive) return;
    rowBudget = b;
    paintInvites();
  };
  globalThis.addEventListener?.('resize', onRows);

  function createRoom() {
    const c = currentChoice(store.profile);
    navigate('coop', { id: makeRoomCode(), host: '1', ...c });
  }

  function joinCode() {
    const c = normalizeCode(codeInput.value);
    if (c.length < COOP.codeLength) {
      toast(`Room codes have ${COOP.codeLength} characters.`, 'info');
      codeInput.focus();
      return;
    }
    navigate('coop', { id: c });
  }

  const join = (inv) => (inv.source === 'dm' ? joinInvite(inv.msg) : navigate('coop', { id: inv.room }));

  function paintChip() {
    const c = currentChoice(store.profile);
    const s = STAGE_MAP[c.stage];
    const fp = freeplayTable(c.freeplay);
    chip.title = `Room setup: ${s ? `${s.id} ${s.name}` : c.stage}, ${DIFFICULTIES[c.difficulty]?.name || 'Normal'}${fp ? `, Freeplay ${fp.name}` : ''}. Tap to change the stage.`;
    chip.setAttribute('aria-label', chip.title);
    fillIn(chip, ico('map', 'ui-ico.mp-room-ico'), h('span.mp-room-txt', roomChipText(c)));
  }

  function inviteRow(inv) {
    return h('div.mp-invite', { 'data-testid': 'mp-invite', 'data-room': inv.room, 'data-source': inv.source },
      avatar(inv.avatar, 34),
      h('div.mp-inv-text',
        h('b.mp-inv-name', inv.name),
        h('span.mp-inv-line', inv.stage ? stageWords(inv.stage) : 'Co-op room', inv.source === 'clan' ? ' · clan chat' : '')),
      inkBtn('Join', { testid: 'mp-invite-join', title: `Join ${inv.name}'s room`, onClick: () => join(inv) }));
  }

  /** "Your last room" (left within the last two hours), or null. */
  function lastRoomNow() {
    try {
      return hub.ready ? lastRoom(getBackend().uid) : null;
    } catch {
      return null;
    }
  }

  /** Its row: one tap back in, as on #/coop. */
  function lastRow(last) {
    return h('div.mp-invite.mp-last', { 'data-testid': 'mp-last-room' },
      h('span.mp-last-ico', { 'aria-hidden': 'true' }, ico('play')),
      h('div.mp-inv-text', h('b.mp-inv-name', 'Your last room'), h('span.mp-inv-line', `${last.host ? 'You host' : 'You joined'}${STAGE_MAP[last.stageId] ? ` · ${stageWords(last.stageId)}` : ''}`)),
      inkBtn('Rejoin', { testid: 'mp-rejoin', onClick: () => navigate('coop', roomRoute(last)) }));
  }

  /** "n more": the rows the card has no room for (UI M5d review), in a sheet with their Join / Rejoin. */
  function moreRow(rest, last) {
    const n = rest.filter((x) => x !== last).length;
    const name = n ? `${n} more invite${n === 1 ? '' : 's'}` : 'Your last room';
    const line = n && rest.includes(last) ? 'and your last room' : null;
    const row = (x) => (x === last ? lastRow(x) : inviteRow(x));
    return h('button.mp-invite.mp-more', {
      type: 'button', 'data-testid': 'mp-invites-more', 'aria-label': `${name}${line ? ` ${line}` : ''}`,
      onclick: () => openSheet({ title: n ? 'More invites' : 'Your last room', testid: 'mp-invites-sheet', body: h('div.mp-invites.mp-sheet-rows', rest.map(row)) }),
    },
    h('span.mp-last-ico', { 'aria-hidden': 'true' }, ico(PEOPLE_GLYPH)),
    h('span.mp-inv-text', h('b.mp-inv-name', name), line ? h('span.mp-inv-line', line) : null),
    h('span.mp-more-go', { 'aria-hidden': 'true' }, ico(KIT_SVG.chevR)));
  }

  function paintInvites() {
    const last = lastRoomNow();
    // (the card keeps to its rows, so the four tiles stay in view beside it: 2 on phones, 4 larger)
    const { shown, more } = inviteRows(state.list, last, inviteRowBudget(viewport().vh));
    // (offline: no line here, Quick join's reason says it once; online with no invite, Quick join's reason and Momo say
    // it: no third line, P7. Only while the invites load, a line says so)
    const note = hub.ready && !state.ready ? h('p.mp-note', 'Looking for invites…') : null;
    fillIn(invitesBox, shown.map((x) => (x === last ? lastRow(x) : inviteRow(x))), more.length ? moreRow(more, last) : null, note);
    invitesBox.hidden = !invitesBox.childElementCount;
  }

  function paintQuick() {
    const q = quickJoin(state.list, { ready: hub.ready && state.ready });
    fillIn(quick, q.invite
      ? secondaryBtn('Quick join', { icon: 'play', testid: 'mp-quick', title: `Join ${q.invite.name}'s room`, onClick: () => join(q.invite) })
      : secondaryBtn('Quick join', { testid: 'mp-quick', disabled: true, reason: q.reason }));
  }

  const scenery = (theme) => h('span.mp-tile-scene', { html: themeBackdropSVG(theme) });

  function tileEl(t) {
    if (t.locked) {
      // a mode that is not out yet: its scenery under a glass veil, "Coming soon" / "Soon" with its lock (kit.js lockedTile)
      return lockedTile({
        title: t.title, line: t.line, soon: t.locked, testid: `mp-${t.id}`, cls: `mp-ltile.mp-${t.id}`, art: scenery(t.theme),
        onClick: t.sheet === 'rival' ? () => openRivalRun() : () => toast(`${t.title} is on its way. Stay tuned!`, 'info'),
      });
    }
    // [ui-v2 M5] an open mode: a kit hub tile (V4: its scenery over an ink caption band); the friend requests' red
    // number or the clan boss's week (a recurring reset: never red) in its top-right corner
    return hubTile({
      title: t.title, line: t.line, art: scenery(t.theme), sm: true, testid: `mp-${t.id}`, cls: `mp-tile.mp-${t.id}`,
      label: `${t.title}${t.count ? `, ${t.count} new` : ''}. ${t.line}`,
      corner: [
        t.count ? countBadge(t.count, { cls: 'mp-tile-count', testid: `mp-${t.id}-count`, title: `${t.count} friend requests` }) : null,
        t.id === 'clanboss' && state.inClan ? countdownChip(msToWeekReset(), { cls: 's.mp-tile-cd', urgent: false, doneText: 'Reset!', testid: 'mp-clanboss-time' }) : null,
      ],
      onClick: () => navigate(t.route.name, t.route.params),
    });
  }

  function paintTiles() {
    fillIn(tiles, hubTiles({ friendRequests: hub.ready ? hub.badges.friendRequests : 0, inClan: state.inClan }).map(tileEl));
  }

  function paint() {
    if (!alive) return;
    paintChip();
    paintInvites();
    paintQuick();
    paintTiles();
    host.setLines(linesFor('multiplayer', { invites: state.count }));
  }

  const refresh = (force = false) => openInvites({ force }).then((r) => {
    if (!alive) return;
    state = r;
    paint();
  });

  paint();
  refresh(true);
  const offStore = store.on('change', (e) => { if (e?.reason === 'replace') paint(); });
  const offs = [
    hub.on('invites', () => refresh(true)),
    hub.on('status', () => refresh(true)),
    hub.on('badges', () => refresh(true)),
  ];
  return () => {
    alive = false;
    offResize();
    globalThis.removeEventListener?.('resize', onRows);
    offStore();
    offs.forEach((off) => off());
  };
}
