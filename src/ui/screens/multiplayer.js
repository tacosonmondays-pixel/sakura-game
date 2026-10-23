// The Multiplayer hub (owner decisions #79 and #108; notes/ui-m5/PLAN.md §5 M5d). Route: #/multiplayer, opened by the
// lobby's Multiplayer button, the Missions tile (hub-coop) and the Menu (menu-coop).
// Momo hosts it (§5.10 E1: her stand in the left 35%, or by the collapse rule her chip in the Co-op plate header) over
// the academy with the hub's own tint (E6). The Co-op card under its ink plate header (E2):
//   - the open invites from friends and clanmates with an ink Join each (read only once the social hub is ready: this
//     screen never signs in or creates an online account; #/coop keeps its own sign-in), and "Your last room";
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
import { h, screen, button, toast } from '../components.js';
import { plateHead, kbdHint, inkBtn, secondaryBtn, lockedTile, countdownChip, ico, fillIn } from '../kit.js';
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
import { hubTiles, quickJoin, roomChoice, roomChipText, stageWords, RIVAL_RUN } from '../multiplayerModel.js';

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
  const { el, body } = screen('Multiplayer', { cls: 'mp-screen hb-screen', extra: inboxButton() });
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
  const codeInput = h('input.ol-input.mp-code', { type: 'text', maxlength: 8, placeholder: 'ROOM CODE', 'aria-label': 'Room code', 'data-testid': 'mp-code', autocomplete: 'off', spellcheck: false });
  codeInput.addEventListener('input', () => { codeInput.value = normalizeCode(codeInput.value); });
  codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinCode(); });
  const actions = h('div.mp-actions', quick, h('div.mp-code-row', codeInput, inkBtn('Join', { testid: 'mp-code-join', onClick: () => joinCode() })));
  const card = h('section.panel.mp-coop', { 'data-testid': 'mp-coop' }, head, invitesBox, actions);
  const tiles = h('div.mp-tiles', { 'data-testid': 'mp-tiles' });
  const hb = h('div.hb.mp-hb', h('div.hb-main.mp-main', card, tiles));
  body.append(hb);
  placeHost(host, drawn, { hb, slot: head });
  const offResize = watchHostMode(el, () => drawn, () => hubMode(viewport()), () => {
    drawn = hubMode(viewport());
    placeHost(host, drawn, { hb, slot: head });
  });

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

  /** "Your last room" (left within the last two hours): one tap back in, as on #/coop. */
  function lastRow() {
    let last = null;
    try {
      last = hub.ready ? lastRoom(getBackend().uid) : null;
    } catch {
      last = null;
    }
    if (!last) return null;
    return h('div.mp-invite.mp-last', { 'data-testid': 'mp-last-room' },
      h('span.mp-last-ico', { 'aria-hidden': 'true' }, ico('play')),
      h('div.mp-inv-text', h('b.mp-inv-name', 'Your last room'), h('span.mp-inv-line', `${last.host ? 'You host' : 'You joined'}${STAGE_MAP[last.stageId] ? ` · ${stageWords(last.stageId)}` : ''}`)),
      inkBtn('Rejoin', { testid: 'mp-rejoin', onClick: () => navigate('coop', roomRoute(last)) }));
  }

  function paintInvites() {
    const rows = state.list.map(inviteRow);
    const last = lastRow();
    let note = null;
    // (offline: no line here, Quick join's reason says it once, P7)
    if (!hub.ready) note = null;
    else if (!state.ready) note = h('p.mp-note', 'Looking for invites…');
    else if (!rows.length) note = h('p.mp-note', { 'data-testid': 'mp-invites-none' }, 'No open invites right now. Make a room and invite a friend!');
    fillIn(invitesBox, rows, last, note);
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
      // a mode that is not out yet: its scenery under a glass veil, "Coming soon" / "Soon", a lock (kit.js lockedTile)
      return lockedTile({
        title: t.title, line: t.line, soon: t.locked, testid: `mp-${t.id}`, cls: `mp-ltile.mp-${t.id}`, art: scenery(t.theme),
        onClick: t.sheet === 'rival' ? () => openRivalRun() : () => toast(`${t.title} is on its way. Stay tuned!`, 'info'),
      });
    }
    const icon = t.id === 'friends' ? PEOPLE_GLYPH : 'assault';
    return h(`button.mp-tile.mp-${t.id}`, { type: 'button', 'data-testid': `mp-${t.id}`, 'aria-label': `${t.title}${t.count ? `, ${t.count} new` : ''}. ${t.line}`, onclick: () => navigate(t.route.name, t.route.params) },
      h('span.mp-tile-art', { 'aria-hidden': 'true' }, scenery(t.theme)),
      h('span.mp-tile-ico', { 'aria-hidden': 'true' }, ico(icon)),
      t.count ? countBadge(t.count, { cls: 'mp-tile-count', testid: `mp-${t.id}-count`, title: `${t.count} friend requests` }) : null,
      // the clan boss's week (a recurring reset: never red)
      t.id === 'clanboss' && state.inClan ? countdownChip(msToWeekReset(), { cls: 's.mp-tile-cd', urgent: false, doneText: 'Reset!', testid: 'mp-clanboss-time' }) : null,
      h('span.mp-tile-text', h('b.mp-tile-title', t.title), h('span.mp-tile-line', t.line)));
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
    offStore();
    offs.forEach((off) => off());
  };
}
