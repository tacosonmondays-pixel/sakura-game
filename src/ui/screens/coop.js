// #/coop — real-time 2-player co-op. Without a code: create a room (stage + difficulty) or join
// one by code / from a clan invite. #/coop/<CODE>[?host=1] — the room lobby: both players with
// their colour, level and girls, the stage, ready checks, Start (host). When the host starts,
// both screens open #/battle?coop=<CODE>, which runs the room's lockstep battle.
import { h, screen, button, svgEl, toast, modal } from '../components.js';
import { navigate, buildHash } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../data/types.js';
import { STAGE_MAP, stageEnemies } from '../../data/stages.js';
import { ENEMY_MAP } from '../../data/enemies.js';
import { enemyToken } from '../battle/util.js';
import { getMap } from '../../data/maps.js';
import { UNIT_MAP } from '../../data/units.js';
import { COOP, coopStages, coopStartCash } from '../../data/coop.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { isStageUnlocked } from '../../systems/unlocks.js';
import { ensureOnline, onlinePill, avatar, levelChip, showError, connecting, storedName, localNotice, PEOPLE_GLYPH } from '../online/common.js';
import { profileCard } from '../../online/identity.js';
import { openSession, getSession, makeRoomCode, normalizeCode } from '../../online/coop/session.js';
import { pickLoadout } from '../../online/coop/loadout.js';
import { resolveFormation } from '../battle/setup.js';
import { unitBattleStats } from '../../systems/progression.js';
import { formatRetry } from '../../online/limits.js';
import { toOnlineError } from '../../online/errors.js';
import { APP_VERSION, versionLabel, compareVersions } from '../../core/buildInfo.js';
import { checkForUpdate, updateAvailable, reloadFresh } from '../../core/updates.js';

const PREF_KEY = 'ss-coop-pref';

function readPref() {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) || 'null') || {};
  } catch {
    return {};
  }
}
function writePref(p) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ ...readPref(), ...p }));
  } catch {
    /* ignore */
  }
}

/** Stages the host may pick: every campaign stage unlocked on their own map. */
function hostStages(profile) {
  return coopStages((id) => isStageUnlocked(profile, id));
}

function defaultStage(profile) {
  const list = hostStages(profile);
  const pref = readPref().stageId;
  if (pref && list.some((s) => s.id === pref)) return pref;
  return list[0]?.id || '1-1';
}

function stageLabel(id) {
  const s = STAGE_MAP[id];
  return s ? `${s.id} · ${s.name}` : id;
}

function thumb(stageId, cls = 'ol-stage-thumb') {
  const s = STAGE_MAP[stageId];
  const map = s && getMap(s.mapId);
  return h(`div.${cls}`, { html: map ? stageThumbSVG(map, { width: 320, height: 200 }) : '' });
}

function unitChip(unitId, { hero = false } = {}) {
  const u = UNIT_MAP[unitId];
  if (!u) return null;
  return h(`span.ol-unit${hero ? '.hero' : ''}`, { title: `${u.name} — hold for her info`, 'data-unit': unitId }, avatar(unitId, 30), h('small', u.name));
}

/** Stage + difficulty picker modal. Resolves { stageId, difficulty } or null. */
function pickStage(current, difficulty) {
  return new Promise((resolve) => {
    const profile = store.profile;
    const stages = hostStages(profile);
    let pick = current;
    let diff = difficulty;
    const list = h('div.ol-stage-grid');
    const diffs = h('div.ol-seg');
    const paint = () => {
      list.replaceChildren(...stages.map((s) => h(`button.ol-stage-opt${s.id === pick ? '.on' : ''}`, { type: 'button', 'data-stage': s.id, onclick: () => { pick = s.id; paint(); } },
        thumb(s.id, 'ol-stage-opt-thumb'), h('span', h('b', s.id), ` ${s.name}`))));
      diffs.replaceChildren(...DIFFICULTY_ORDER.map((d) => h(`button.ol-seg-btn${d === diff ? '.on' : ''}`, { type: 'button', onclick: () => { diff = d; paint(); } }, DIFFICULTIES[d].name)));
    };
    paint();
    let done = false;
    modal({
      title: 'Co-op stage',
      wide: true,
      body: h('div.ol-pick', h('p.muted', `Every campaign stage you unlocked. Enemies have ×${COOP.hpMul} HP; each player starts with ${Math.round(COOP.cashShare * 100)}% of the coins.`), diffs, list),
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: 'Choose', kind: 'yellow', testid: 'coop-stage-ok', onClick: (close) => { done = true; close(); resolve({ stageId: pick, difficulty: diff }); } },
      ],
      onClose: () => {
        if (!done) resolve(null);
      },
    });
  });
}

/**
 * "A new version is out" inside co-op (both players need compatible versions to pair): empty
 * until the update check finds a newer deploy.
 */
function updateNotice() {
  const box = h('div', { 'data-testid': 'coop-update' });
  const paint = (info) => {
    if (!info) return;
    box.replaceChildren(h('div.ol-banner.ol-banner-row',
      h('span', `A new version${info.version ? ` (${versionLabel(info.version)})` : ''} is out. Update before you play so you and your ally match.`),
      button('Update', { kind: 'yellow', small: true, icon: 'refresh', testid: 'coop-update-now', onClick: () => reloadFresh(info.build) })));
  };
  paint(updateAvailable());
  checkForUpdate({ force: true }).then(paint).catch(() => {});
  return box;
}

/**
 * Two clients that cannot play together: say who is behind and what to do. An ally without a
 * version label runs a build from before version numbers existed, so theirs is the older one.
 */
function mismatchBanner(m) {
  const theirs = m.theirs?.label || null;
  const cmp = theirs ? compareVersions(theirs, APP_VERSION) : -1;
  const upd = updateAvailable();
  const you = versionLabel(APP_VERSION);
  let text;
  let action = null;
  if (upd || cmp === 1) {
    text = `${m.name} is on ${theirs ? versionLabel(theirs) : 'a newer version'} and you're on ${you}. Tap Update to get the newest version — then you can play together.`;
    action = button('Update', { kind: 'yellow', small: true, icon: 'refresh', testid: 'coop-version-update', onClick: () => reloadFresh(upd?.build) });
  } else if (cmp === -1) {
    text = `${m.name} is on ${theirs ? versionLabel(theirs) : 'an older version'} and you're on ${you}, the newest. Ask ${m.name} to reload the page (the game updates itself), then try again.`;
  } else if (cmp === 0) {
    // same version, yet the battle data or engine id differ: a game bug, not something to reload away
    text = `You and ${m.name} are both on ${you}, but your devices don't agree on the battle data, so co-op can't start. That's a game bug — please send the developer a screenshot of this.`;
  } else {
    text = `${m.name} runs a different build${theirs ? ` (${versionLabel(theirs)})` : ''} than you (${you}), so you cannot play together yet. Whoever is behind should reload the page.`;
    action = button('Reload', { kind: 'yellow', small: true, icon: 'refresh', testid: 'coop-version-reload', onClick: () => reloadFresh() });
  }
  return h('div.ol-banner.bad.ol-banner-row', { 'data-testid': 'coop-version' }, h('span', text, h('small.ol-version-diag', ` (${versionDiff(m.mine, m.theirs)})`)), action);
}

/** What the lobby says when the server refused the room (or it closed): by error code. */
export function roomErrorText(err) {
  switch (err?.code) {
    case 'not_found': return 'No room uses that code. Check it, or ask your ally for a new one.';
    case 'name_taken': return 'That room code is already in use. Create a new room.';
    case 'rate_limited': return `Too many rooms — try again in ${formatRetry(err.retryMs || 2000)}.`;
    case 'offline': return 'The co-op server cannot be reached right now.';
    case 'idle': return `This room closed after ${err.minutes || 30} minutes without a battle. Open a new one when you are both ready.`;
    default: return 'This room could not be opened.';
  }
}

/** Which parts of two co-op versions differ, for bug reports: "data 785f763b≠c0bb331a". */
function versionDiff(mine, theirs) {
  const parts = ['proto', 'sim', 'data', 'build'].filter((k) => String(mine?.[k] ?? '') !== String(theirs?.[k] ?? ''));
  return parts.map((k) => `${k} ${String(mine?.[k] ?? '–').slice(0, 8)}≠${String(theirs?.[k] ?? '–').slice(0, 8)}`).join(' · ') || 'no difference';
}

export function render(root, params = {}) {
  const code = normalizeCode(params.id || '');
  const { el, body } = screen(code ? `Co-op · ${code}` : 'Co-op Battle', { cls: 'ol-screen', extra: onlinePill() });
  root.append(el);
  let destroyed = false;
  let cleanup = () => {};
  let keepSession = false;

  if (code) connecting(body, () => room(code));
  else connecting(body, () => hub());

  // back from the back/forward cache (Safari keeps pages there): leaving the page closed the
  // room (goodbye + seat freed), so open it again instead of showing a dead lobby
  const onPageShow = (ev) => {
    if (!ev.persisted || destroyed || !code) return;
    const s = getSession();
    if (s && s.code === code && s.phase !== 'closed') return;
    cleanup();
    connecting(body, () => room(code));
  };
  globalThis.addEventListener?.('pageshow', onPageShow);

  // -------------------------------------------------------------------------------------
  // Hub: create or join
  // -------------------------------------------------------------------------------------
  async function hub() {
    const backend = await ensureOnline();
    if (destroyed) return;
    const profile = store.profile;
    let stageId = defaultStage(profile);
    let difficulty = DIFFICULTIES[readPref().difficulty] ? readPref().difficulty : 'normal';
    const stagePane = h('div.ol-coop-stage');
    const paintStage = () => {
      const s = STAGE_MAP[stageId];
      stagePane.replaceChildren(
        thumb(stageId),
        h('div.ol-coop-stage-info',
          h('div.ol-coop-stage-name', h('b', stageLabel(stageId)), h('span.ol-chip-diff', DIFFICULTIES[difficulty].name)),
          h('ul.ol-coop-facts',
            h('li', `Enemy HP ×${COOP.hpMul}`),
            h('li', `${formatNumber(coopStartCash(s))} coins each to start`),
            h('li', 'Coins earned are split between you')),
          button('Change stage', { kind: 'ghost', small: true, icon: 'map', testid: 'coop-change-stage', onClick: async () => {
            const r = await pickStage(stageId, difficulty);
            if (!r) return;
            ({ stageId, difficulty } = r);
            writePref(r);
            paintStage();
          } })),
      );
    };
    paintStage();

    const create = button('Create room', {
      kind: 'yellow', icon: 'plus', testid: 'coop-create',
      onClick: () => {
        writePref({ stageId, difficulty });
        navigate('coop', { id: makeRoomCode(), host: '1', stage: stageId, difficulty });
      },
    });

    const codeInput = h('input.ol-input.ol-code-input', { type: 'text', maxlength: 8, placeholder: 'ROOM CODE', 'data-testid': 'coop-code', autocomplete: 'off', spellcheck: false });
    codeInput.addEventListener('input', () => {
      codeInput.value = normalizeCode(codeInput.value);
    });
    const join = () => {
      const c = normalizeCode(codeInput.value);
      if (c.length < COOP.codeLength) {
        toast(`Room codes have ${COOP.codeLength} characters.`, 'info');
        return;
      }
      navigate('coop', { id: c });
    };
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') join();
    });

    const invites = h('div.ol-invites', { 'data-testid': 'coop-invites' }, h('p.muted', 'Loading invites…'));
    (async () => {
      try {
        const mine = await backend.myClan();
        if (destroyed) return;
        if (!mine) {
          invites.replaceChildren(h('p.muted', 'Join a clan to see your clanmates\' co-op invites here.'), button('Find a clan', { kind: 'ghost', small: true, onClick: () => navigate('clan') }));
          return;
        }
        const msgs = (await backend.history(`clan:${mine.clan.id}`, 50)).filter((m) => m.kind === 'invite' && m.meta?.room && m.userId !== backend.uid && Date.now() - m.createdAt < 15 * 60000).reverse();
        if (destroyed) return;
        invites.replaceChildren(...(msgs.length
          ? msgs.slice(0, 4).map((m) => h('div.ol-invite-row', { 'data-room': m.meta.room }, avatar(m.avatar, 34), h('div', h('b', m.name), h('small.muted', ` ${stageLabel(m.meta.stage)}`)),
            button('Join', { kind: 'yellow', small: true, testid: 'invite-row-join', onClick: () => navigate('coop', { id: m.meta.room }) })))
          : [h('p.muted', `No open invites from [${mine.clan.tag}] right now. Create a room and invite them!`)]));
      } catch {
        invites.replaceChildren(h('p.muted', 'Invites are unavailable right now.'));
      }
    })();

    body.replaceChildren(h('div.ol-coop-hub', ...[
      localNotice('coop'),
      updateNotice(),
      h('section.panel.ol-coop-intro',
        h('h3.panel-title', 'Defend together'),
        h('div.ol-coop-intro-body',
          svgEl(PEOPLE_GLYPH, 'ol-coop-big-ico'),
          h('div',
            h('p', 'Two senseis, one map. Each of you places your own girls with your own coins; enemies are tougher to match.'),
            h('p.muted', `You bring your formation: the host brings the hero and ${COOP.towersPerPlayer} girls, the guest ${COOP.towersPerPlayer + 1} girls. Drops go to both; medals stay solo.`)))),
      h('div.ol-coop-cols',
        h('section.panel.ol-coop-create', { 'data-testid': 'coop-create-panel' },
          h('h3.panel-title', 'Host a room'),
          stagePane,
          h('div.ol-row-end', create)),
        h('div.ol-coop-right',
          h('section.panel.ol-coop-join',
            h('h3.panel-title', 'Join with a code'),
            h('div.ol-form-row', codeInput, button('Join', { kind: 'primary', small: true, testid: 'coop-join', onClick: join }))),
          h('section.panel.ol-coop-clan',
            h('h3.panel-title', 'Clan invites'),
            invites))),
    ].filter(Boolean)));
  }

  // -------------------------------------------------------------------------------------
  // Room lobby
  // -------------------------------------------------------------------------------------
  async function room(roomCode) {
    const backend = await ensureOnline();
    if (destroyed) return;
    const profile = store.profile;
    let session = getSession();
    if (session && session.code === roomCode && session.phase === 'battle') {
      // came back from the battle screen with the battle still running
      keepSession = true;
      navigate('battle', { coop: roomCode }, { replace: true });
      return;
    }
    if (!session || session.code !== roomCode || session.phase === 'closed') {
      const isHost = params.host === '1';
      const card = profileCard(profile);
      const { loadout, hero } = pickLoadout(resolveFormation(profile), isHost, (id) => unitBattleStats(profile, id));
      const stageId = isHost && STAGE_MAP[params.stage] ? params.stage : defaultStage(profile);
      const difficulty = DIFFICULTIES[params.difficulty] ? params.difficulty : 'normal';
      try {
        session = openSession({
          code: roomCode, isHost, backend, stageId, difficulty,
          me: { uid: backend.uid, name: storedName() || backend.user?.name || 'Sensei', level: card.level, avatar: card.avatar, loadout, hero },
        });
      } catch (e) {
        const err = toOnlineError(e);
        if (err.code === 'rate_limited') throw new Error(`Too many rooms — try again in ${formatRetry(err.retryMs)}.`);
        throw e;
      }
    }

    const view = h('div.ol-room', { 'data-testid': 'coop-room' });
    body.replaceChildren(view);

    const copy = async () => {
      try {
        await navigator.clipboard.writeText(roomCode);
        toast('Room code copied', 'good');
      } catch {
        toast(`Room code: ${roomCode}`, 'info');
      }
    };

    async function inviteClan() {
      try {
        const mine = await backend.myClan();
        if (!mine) {
          toast('You are not in a clan yet — share the room code instead.', 'info');
          return;
        }
        await backend.send(`clan:${mine.clan.id}`, `Co-op room ${roomCode}: ${stageLabel(session.stageId)} (${DIFFICULTIES[session.difficulty].name}). Join me!`, { kind: 'invite', meta: { room: roomCode, stage: session.stageId } });
        toast(`Invite posted in [${mine.clan.tag}] chat`, 'good');
      } catch (e) {
        showError(e);
      }
    }

    /** What the empty seat says while we wait: the link first, then who we wait for. */
    function waitText(s) {
      if (s.link === 'connecting') return ['Connecting to room…', 'This usually takes a second or two.'];
      if (s.link === 'reconnecting') return ['Reconnecting…', 'The connection dropped. Trying again on its own.'];
      return s.isHost ? ['Waiting for your ally…', 'Share the code or invite your clan.'] : ['Looking for the host…', 'Your ally\'s room should show up in a moment.'];
    }

    function playerCard(p, slot, me) {
      if (!p) {
        const [title, sub] = waitText(session);
        return h('section.ol-pcard.empty', { style: { '--pc': COOP.colors[slot] } },
          session.mismatch
            ? h('div.ol-pcard-wait', h('b', `${session.mismatch.name} is here`), h('p.muted', 'Your game versions differ — see above.'))
            : h('div.ol-pcard-wait', { 'data-testid': 'coop-wait' }, h('i.ol-spinner'), h('b', title), h('p.muted', sub)));
      }
      if (!me && !session.paired) {
        // I hear my ally, but it does not hear me yet: no Ready / Start until it does (the
        // lobby fixes a one-way link by itself with a fresh connection)
        return h('section.ol-pcard.empty', { style: { '--pc': COOP.colors[slot] }, 'data-testid': 'coop-connecting', 'data-slot': slot },
          h('div.ol-pcard-wait', h('i.ol-spinner'), h('b', `Connecting to ${p.name || 'your ally'}…`),
            h('p.muted', 'Making sure you can both hear each other. This fixes itself in a few seconds.')));
      }
      const units = [p.hero ? unitChip(p.hero.unitId, { hero: true }) : null, ...(p.loadout || []).map((e) => unitChip(e.unitId))].filter(Boolean);
      const ready = slot === 0 ? true : !!p.ready;
      return h(`section.ol-pcard${me ? '.me' : ''}`, { style: { '--pc': COOP.colors[slot] }, 'data-testid': `coop-player-${slot}` },
        h('div.ol-pcard-head',
          avatar(p.avatar, 52),
          h('div.ol-pcard-id',
            h('div', h('b.ol-pcard-name', p.name || 'Sensei'), me ? h('small.muted', ' (you)') : null),
            h('div.ol-pcard-tags', levelChip(p.level), h('span.ol-pcard-role', slot === 0 ? 'Host' : 'Guest'))),
          h(`span.ol-ready${ready ? '.on' : ''}`, { 'data-testid': `coop-ready-${slot}` }, slot === 0 ? 'HOST' : ready ? 'READY' : 'NOT READY')),
        h('div.ol-pcard-units', units.length ? units : h('small.muted', 'No girls in formation')));
    }

    /** The big stage card under the players: map, story line, waves, who you will meet. */
    function fieldPanel(s) {
      const st = STAGE_MAP[s.stageId];
      if (!st) return null;
      let foes = [];
      try {
        foes = stageEnemies(st).map((id) => ENEMY_MAP[id]).filter((e) => e && e.tier !== 'normal').slice(0, 5);
        if (foes.length < 3) foes = stageEnemies(st).map((id) => ENEMY_MAP[id]).filter(Boolean).slice(0, 5);
      } catch {
        foes = [];
      }
      return h('section.panel.ol-room-field', { 'data-testid': 'coop-field' },
        h('h3.panel-title', 'Battlefield'),
        h('div.ol-field-body',
          thumb(s.stageId, 'ol-field-thumb'),
          h('div.ol-field-info',
            h('div.ol-coop-stage-name', h('b', stageLabel(s.stageId)), h('span.ol-chip-diff', DIFFICULTIES[s.difficulty]?.name || '')),
            st.desc ? h('p.ol-field-desc', st.desc) : null,
            h('div.ol-field-stats',
              h('span', h('b', String(st.waves ?? '—')), ' waves'),
              h('span', h('b', `×${COOP.hpMul}`), ' enemy HP'),
              h('span', h('b', formatNumber(coopStartCash(st))), ' coins each')),
            foes.length ? h('div.ol-field-foes', foes.map((e) => h('span.ol-foe', { title: e.name }, enemyToken(e.id, { size: 26 }), h('small', e.name)))) : null)));
    }

    /**
     * The connection line above the players: "Reconnecting…" while the link is down with an ally
     * on screen (the empty seat says it otherwise), and after ~15 s without a link or without a
     * host, what to check and a Retry button.
     */
    function linkBanner(s) {
      if (s.stuck) {
        const text = s.stuck === 'server'
          ? 'Cannot reach the co-op server. Check your internet connection, then tap Retry.'
          : `The host of room ${roomCode} has not answered yet. Make sure your ally still has this room open, then tap Retry. If it keeps failing, ask your ally for a new code.`;
        return h('div.ol-banner.warn.ol-banner-row', { 'data-testid': 'coop-stuck' },
          h('span', text),
          button('Retry', { kind: 'yellow', small: true, icon: 'refresh', testid: 'coop-retry', onClick: () => s.retry() }));
      }
      if (s.link === 'reconnecting' && s.peer) return h('div.ol-banner.warn', { 'data-testid': 'coop-link' }, 'Reconnecting… your ally stays in the room.');
      if (s.isHost && !s.peer && s.lastPeer && !s.mismatch) {
        // the ally left or vanished: if they come back from another browser or device, the
        // server may still hold their seat ("room full") — a new room is the quick way out
        const who = s.lastPeer.name || 'Your ally';
        return h('div.ol-banner.warn.ol-banner-row', { 'data-testid': 'coop-ally-gone' },
          h('span', `${s.lastPeer.why === 'left' ? `${who} left the room.` : `Lost contact with ${who}.`} If they can't get back in (another browser or device), make a new room and send them the new code.`),
          button('New room', { kind: 'yellow', small: true, icon: 'plus', testid: 'coop-new-room', onClick: () => newRoom(s) }));
      }
      return null;
    }

    function newRoom(s) {
      s.close();
      navigate('coop', { id: makeRoomCode(), host: '1', stage: s.stageId, difficulty: s.difficulty });
    }

    /** The room cannot be used (refused, full, closed after idling): what happened + a way on. */
    function deadEnd(s) {
      const full = s.full && !s.error;
      const title = full ? 'Room full' : s.error.code === 'not_found' ? 'Room not found' : s.error.code === 'idle' ? 'Room closed' : 'Cannot open this room';
      const text = full ? 'This room already has two players. Ask your ally for a new code.' : roomErrorText(s.error);
      return h('section.panel.ol-room-error', { 'data-testid': full ? 'coop-room-full' : 'coop-room-error' },
        h('div.ol-empty', h('b', title), h('p.muted', text),
          h('div.ol-row-end',
            button('Back', { kind: 'ghost', small: true, icon: 'back', testid: 'coop-back', onClick: () => { s.close(); navigate('coop'); } }),
            // the server could not be reached at all: open the same room again
            s.error?.code === 'offline' ? button('Retry', { kind: 'yellow', small: true, icon: 'refresh', testid: 'coop-retry', onClick: () => { s.close(); cleanup(); connecting(body, () => room(roomCode)); } }) : null,
            s.isHost ? button('New room', { kind: 'yellow', small: true, icon: 'plus', testid: 'coop-new-room', onClick: () => newRoom(s) }) : null)));
    }

    function tipsPanel() {
      const tips = [
        ['Your girls, your coins', 'Each of you deploys from your own formation with your own wallet.'],
        ['Kills pay both', 'Every coin the defence earns is split between you.'],
        ['Hands off her girls', 'Only the owner can upgrade, sell or retarget a girl (the coloured pin shows whose).'],
        ['Nobody is left alone', 'If a connection drops, the other keeps playing — her girls keep fighting.'],
      ];
      return h('section.panel.ol-room-tips', h('h3.panel-title', 'How co-op works'),
        h('ol.ol-tips', tips.map(([t, d], i) => h('li', h('span.ol-tip-n', String(i + 1)), h('div', h('b', t), h('small', d))))));
    }

    const updateCheckedFor = new Set(); // allies whose mismatch already triggered an update check
    function paint() {
      if (destroyed) return;
      const s = session;
      if (s.phase === 'closed') return;
      if (s.error || s.full) {
        // the server refused the room (wrong code, taken, full, too many) or it closed after
        // idling: nothing else to show (no seats, no Ready)
        view.replaceChildren(deadEnd(s));
        return;
      }
      if (s.mismatch && !updateCheckedFor.has(s.mismatch.uid)) {
        // are WE the one behind? (a newer deploy exists → the banner offers Update); once per ally
        updateCheckedFor.add(s.mismatch.uid);
        checkForUpdate({ force: true }).then((info) => { if (info) paint(); }).catch(() => {});
      }
      const host = s.isHost ? s.me : s.peer;
      const guest = s.isHost ? s.peer : s.me;
      const st = STAGE_MAP[s.stageId];
      let action;
      if (s.isHost) {
        action = button(s.canStart ? 'Start battle' : s.paired ? 'Waiting for ready…' : s.peer ? 'Connecting…' : 'Waiting for ally…', {
          kind: 'yellow', icon: 'play', testid: 'coop-start', disabled: !s.canStart,
          onClick: () => {
            if (!s.startBattle()) toast('Your ally is not ready yet.', 'info');
          },
        });
      } else {
        // Ready only once the host can hear me (it would never arrive otherwise)
        action = button(s.me.ready ? 'Ready ✓' : 'Ready', {
          kind: s.me.ready ? 'primary' : 'yellow', icon: 'check', testid: 'coop-ready', disabled: !s.paired,
          onClick: () => s.setReady(!s.me.ready),
        });
      }
      view.replaceChildren(...[
        h('section.panel.ol-room-head',
          h('div.ol-room-code',
            h('small', 'ROOM CODE'),
            h('b', { 'data-testid': 'coop-room-code' }, roomCode),
            h('button.ol-copy', { onclick: copy, title: 'Copy', 'aria-label': 'Copy the room code' }, 'Copy')),
          h('div.ol-room-stage',
            thumb(s.stageId, 'ol-room-thumb'),
            h('div',
              h('div.ol-coop-stage-name', h('b', { 'data-testid': 'coop-stage' }, stageLabel(s.stageId)), h('span.ol-chip-diff', DIFFICULTIES[s.difficulty]?.name || '')),
              h('small.muted', `Enemy HP ×${COOP.hpMul} · ${formatNumber(coopStartCash(st))} coins each`),
              s.isHost ? button('Change', { kind: 'ghost', small: true, icon: 'map', testid: 'coop-room-stage', onClick: async () => {
                const r = await pickStage(s.stageId, s.difficulty);
                if (r) {
                  writePref(r);
                  s.setStage(r.stageId, r.difficulty);
                }
              } }) : null)),
          h('div.ol-room-acts',
            button('Invite clan', { kind: 'ghost', small: true, icon: 'plus', testid: 'coop-invite', onClick: inviteClan }),
            button('Leave', { kind: 'ghost', small: true, icon: 'back', testid: 'coop-leave', onClick: () => { s.close(); navigate('coop'); } }))),
        localNotice('coop'),
        linkBanner(s),
        s.mismatch ? mismatchBanner(s.mismatch) : null,
        h('div.ol-room-players', playerCard(host, 0, s.isHost), h('div.ol-vs', '&', h('small', 'together')), playerCard(guest, 1, !s.isHost)),
        h('div.ol-room-foot',
          h('p.muted', s.isHost ? 'You start when your ally is ready. Both of you play live — every order lands on both screens a moment later.' : 'Tap Ready when your girls are set. The host starts the battle.'),
          action,
          h('p.ver-line', { 'data-testid': 'coop-my-version' }, `Your game version: ${versionLabel(APP_VERSION)}`)),
        // below the call to action (phones scroll to it): the stage up close and the rules
        h('div.ol-room-more', fieldPanel(s), tipsPanel()),
      ].filter(Boolean)); // replaceChildren(null) would print "null"
    }

    paint();
    // "Co-op" next to a clanmate (#/coop/<CODE>?host=1&invite=clan): post the invite right away,
    // once per room. The flag leaves the address bar without a hashchange (that would re-render
    // this screen), so a reload does not post the invite twice.
    if (session.isHost && params.invite === 'clan' && !session.invited) {
      session.invited = true;
      try {
        history.replaceState(history.state, '', buildHash('coop', { id: roomCode, host: '1' }));
      } catch {
        /* ignore */
      }
      inviteClan();
    }
    const offs = [
      session.on('change', paint),
      session.on('start', () => {
        keepSession = true;
        navigate('battle', { coop: roomCode });
      }),
    ];
    cleanup = () => offs.forEach((off) => off());
  }

  return () => {
    destroyed = true;
    globalThis.removeEventListener?.('pageshow', onPageShow);
    cleanup();
    // leaving the lobby screen (not into the battle) leaves the room
    const s = getSession();
    if (s && s.code === code && !keepSession && s.phase === 'lobby') s.close();
  };
}
