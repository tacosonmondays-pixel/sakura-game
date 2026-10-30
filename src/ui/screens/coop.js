// #/coop — real-time 2-player co-op. Without a code: create a room (stage + difficulty) or join
// one by code / from a clan invite. #/coop/<CODE>[?host=1] — the room lobby: both players with
// their colour, level and girls, the stage, ready checks, Start (host). When the host starts,
// both screens open #/battle?coop=<CODE>, which runs the room's lockstep battle.
// Freeplay (co-op past the stage's last wave, src/data/freeplay.js) is a room setting next to the
// difficulty: the host picks Off / Blossom / Tempest / Crimson Moon, the guest sees a chip and
// their Ready is consent. The Battlefield panel says what freeplay brings and the best wave so far.
// Tryout Day (docs/specs/TRYOUT_DAY.md §11; the run panel in the kit since M3) is a room setting too: the host turns a
// run on instead of a stage (locked until the Spring Term clear), picks one of the seed's two maps,
// and each player drafts 3 of their own six (one Redraw) and picks the hero they bring.
import '../styles/coop-modes.css';
import '../styles/tryout.css';
import { h, screen, button, svgEl, toast, modal, girlTile } from '../components.js';
import { segRow, secondaryBtn } from '../kit.js';
import { navigate, buildHash } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, CAPABILITIES } from '../../data/types.js';
import { STAGE_MAP, stageEnemies } from '../../data/stages.js';
import { ENEMY_MAP } from '../../data/enemies.js';
import { enemyToken } from '../battle/util.js';
import { getMap } from '../../data/maps.js';
import { UNIT_MAP } from '../../data/units.js';
import { COOP, coopStages, coopStartCash } from '../../data/coop.js';
import { freeplayTier, freeplayTable, FREEPLAY_TIERS } from '../../data/freeplay.js';
import { TIER_PITCH, freeplaySummary } from '../freeplayText.js';
import { coopBestWaves } from '../../online/coop/rewards.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { isStageUnlocked, modesUnlocked, isOwned } from '../../systems/unlocks.js';
import { MODE_ORDER, modeId } from '../../data/modes.js';
import { MODE_TEXT } from '../text/modes.js';
import { ruleTextFor } from '../text/rules.js';
import { modeIcon } from '../../art/icons.js';
import { ensureOnline, avatar, levelChip, showError, connecting, storedName, localNotice, PEOPLE_GLYPH } from '../online/common.js';
import { miniMochi } from '../loading/loader.js';
import { profileCard } from '../../online/identity.js';
import { getSession, makeRoomCode, normalizeCode, draftReady } from '../../online/coop/session.js';
import { draftOf, frozenPool, heroChoices, heroEntry, tryoutUnlocked, newRunSeed, TRYOUT_UNLOCK, TRYOUT_GRADES, gradeOpen, RUN_LENGTHS, lengthOpen, fullCleared } from '../../systems/tryoutRuns.js';
import { mapChoices } from '../../sim/tryout/plan.js';
import { TRYOUT } from '../../data/tryout.js';
import { CLASS_TEXT, LENGTH_NAMES, EXTENDED_TEXT, RANDOM_TEXT, gradeTwist, gradeWhy } from '../text/tryout.js';
import { runOptions } from '../battle/tryout/adapters.js';
import { fullTag } from './tryoutTag.js';
import { openSocialSession } from '../../online/coop/socialRoom.js';
import { rememberRoom, lastRoom, forgetRoom, roomRoute } from '../../online/coop/lastRoom.js';
import { pickLoadout } from '../../online/coop/loadout.js';
import { teamChip, activeTeamName } from '../teamBar.js';
/** [teams] The team name the open room brings (its girls are sent when the room opens). */
let roomTeam = null;
import { setHoldSheet } from '../hold.js';
import { allySheet } from '../allySheet.js';
import { resolveFormation } from '../battle/setup.js';
import { unitBattleStats } from '../../systems/progression.js';
import { formatRetry } from '../../online/limits.js';
import { toOnlineError } from '../../online/errors.js';
import { APP_VERSION, versionLabel, compareVersions } from '../../core/buildInfo.js';
import { checkForUpdate, updateAvailable, reloadFresh } from '../../core/updates.js';
import { onlineHeadExtra } from '../online/inboxButton.js';
import { openPlayerCard } from '../online/playerCard.js';
import { hub as social, takePendingInvites, addPendingInvite, joinInvite, liveInvites, forgetInvite } from '../online/socialHub.js';
import { getBackend } from '../../online/backend.js';
import { sendRoomInvite } from '../online/coopInvite.js';
import { INVITE_TTL_MS } from '../../online/socialRules.js';

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

/** The freeplay chip ("FREEPLAY · TEMPEST"), or null when freeplay is off. */
function freeplayChip(tier, { testid = null } = {}) {
  const t = freeplayTable(tier);
  return t ? h(`span.ol-chip-fp.ol-fp-${t.id}`, { 'data-testid': testid, title: TIER_PITCH[t.id] }, `Freeplay · ${t.name}`) : null;
}

/** The battle-mode chip ("Rush"), or null for Standard (docs/specs/CODEX_MODES.md §8.5). */
function modeChip(mode, { testid = 'coop-mode-chip' } = {}) {
  const id = modeId(mode);
  if (id === 'standard') return null;
  const chip = h('span.ol-chip-mode', { 'data-testid': testid, title: MODE_TEXT[id].name }, MODE_TEXT[id].short);
  chip.style.background = MODE_TEXT[id].color;
  return chip;
}

/**
 * The Mode segment of the stage picker: six chips, disabled until the host cleared the stage
 * (and while Freeplay is on: freeplay runs in Standard in v1).
 */
function modeSeg(stageId, value, freeplay, onPick) {
  const unlocked = modesUnlocked(store.profile, stageId);
  const off = !unlocked || !!freeplay;
  const why = freeplay ? 'Freeplay runs in Standard' : unlocked ? null : `Clear ${stageId} once to unlock modes`;
  return h('div.ol-mode-row',
    h('span.ol-fp-label', 'Mode'),
    h(`div.ol-seg.ol-mode-seg${off ? '.off' : ''}`, { 'data-testid': 'coop-mode' },
      ...MODE_ORDER.map((id) => h(`button.ol-seg-btn.ol-mode-btn${value === id ? '.on' : ''}`, {
        type: 'button', 'data-mode': id, disabled: off && id !== 'standard', title: why || MODE_TEXT[id].name, onclick: () => onPick(id),
      }, svgEl(modeIcon(id), 'ol-mode-ico'), MODE_TEXT[id].short))),
    why ? h('small.muted.ol-fp-hint', { 'data-testid': 'coop-mode-note' }, why) : null);
}

/** How hard each tier is, in words (the pips say it at a glance). */
const TIER_LEVEL = { blossom: 'Classic', tempest: 'Harder', crimson: 'Hardest' };

/** "Hardest — Under the red moon nothing holds for long. Freeplay rewards ×2." */
function tierLine(id) {
  const t = freeplayTable(id);
  if (!t) return '';
  const mul = t.rewardMul ?? 1;
  return `${TIER_LEVEL[id] || t.name} — ${TIER_PITCH[id]}${mul > 1 ? ` Freeplay rewards ×${mul}.` : ''}`;
}

/** The freeplay segment: Off · Blossom ★ · Tempest ★★ ×1.5 · Crimson Moon ★★★ ×2 (pips = difficulty). */
function freeplaySeg(value, onPick, testid = 'coop-freeplay') {
  return h('div.ol-seg.ol-fp-seg', { 'data-testid': testid },
    h(`button.ol-seg-btn${!value ? '.on' : ''}`, { type: 'button', 'data-tier': 'off', onclick: () => onPick(null) }, 'Off'),
    ...FREEPLAY_TIERS.map((id) => {
      const t = freeplayTable(id);
      const mul = t.rewardMul ?? 1;
      return h(`button.ol-seg-btn.ol-fp-btn.ol-fp-${id}${value === id ? '.on' : ''}`, { type: 'button', 'data-tier': id, title: tierLine(id), 'aria-label': `${t.name}: ${TIER_LEVEL[id]}${mul > 1 ? `, rewards ×${mul}` : ''}`, onclick: () => onPick(id) },
        h('span', t.name),
        h('small.ol-fp-pips', { 'aria-hidden': 'true' }, '★'.repeat((t.order ?? 0) + 1)),
        mul > 1 ? h('small.ol-fp-mul', `×${mul}`) : null);
    }));
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

/**
 * One girl in a player's card. An ally's girl (`ally`: the player, `stats`: her loadout stats from the ally's game)
 * opens her own sheet when held: the ally's level, stars, gates and Potential, not your copy of her (PROFILE.md §7.4).
 */
function unitChip(unitId, { hero = false, ally = null, stats = null } = {}) {
  const u = UNIT_MAP[unitId];
  if (!u) return null;
  const who = ally ? ally.name || 'Your ally' : null;
  const el = h(`span.ol-unit${hero ? '.hero' : ''}`, { title: `${u.name} — hold for ${who ? `${who}'s build` : 'her info'}`, 'data-unit': unitId }, avatar(unitId, 30), h('small', u.name));
  if (ally) setHoldSheet(el, allySheet(unitId, ally, stats));
  return el;
}

/** Stage + difficulty + freeplay + mode picker modal. Resolves { stageId, difficulty, freeplay, mode } or null. */
export function pickStage(current, difficulty, freeplay = null, mode = 'standard') {
  return new Promise((resolve) => {
    const profile = store.profile;
    const stages = hostStages(profile);
    let pick = current;
    let diff = difficulty;
    let fp = freeplayTier(freeplay);
    let md = modeId(mode);
    const modeRow = h('div.ol-mode-holder');
    const list = h('div.ol-stage-grid');
    const diffs = h('div.ol-seg');
    const fpRow = h('div.ol-fp-row');
    const paint = () => {
      // modes: Standard on a stage the host has not cleared, and while Freeplay is on
      if (fp || !modesUnlocked(profile, pick)) md = 'standard';
      modeRow.replaceChildren(modeSeg(pick, md, fp, (v) => { md = v; paint(); }));
      list.replaceChildren(...stages.map((s) => h(`button.ol-stage-opt${s.id === pick ? '.on' : ''}`, { type: 'button', 'data-stage': s.id, onclick: () => { pick = s.id; paint(); } },
        thumb(s.id, 'ol-stage-opt-thumb'), h('span', h('b', s.id), ` ${s.name}`))));
      diffs.replaceChildren(...DIFFICULTY_ORDER.map((d) => h(`button.ol-seg-btn${d === diff ? '.on' : ''}`, { type: 'button', onclick: () => { diff = d; paint(); } }, DIFFICULTIES[d].name)));
      fpRow.replaceChildren(
        h('span.ol-fp-label', 'Freeplay'),
        freeplaySeg(fp, (v) => { fp = v; paint(); }),
        h('small.muted.ol-fp-hint', fp ? `${tierLine(fp)} Keep going after the last wave until you fall or both finish.${diff === 'nightmare' ? ' 1 life — the first leak ends freeplay.' : ''}` : 'Off: the battle ends at the stage\'s last wave, as usual.'));
    };
    paint();
    let done = false;
    modal({
      title: 'Co-op stage',
      wide: true,
      body: h('div.ol-pick', h('p.muted', `Every campaign stage you unlocked. Enemies have ×${COOP.hpMul} HP; each player starts with ${Math.round(COOP.cashShare * 100)}% of the coins. Modes change the battle for both of you. Ribbons are solo only.`), diffs, fpRow, modeRow, list),
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: 'Choose', kind: 'yellow', testid: 'coop-stage-ok', onClick: (close) => { done = true; close(); resolve({ stageId: pick, difficulty: diff, freeplay: fp, mode: fp ? 'standard' : md }); } },
      ],
      onClose: () => {
        if (!done) resolve(null);
      },
    });
  });
}

/** [social] The stage picker with the player's last choice (Invite to co-op from a card / DM). */
export async function pickCoopStage() {
  const pref = readPref();
  const r = await pickStage(defaultStage(store.profile), DIFFICULTIES[pref.difficulty] ? pref.difficulty : 'normal', freeplayTier(pref.freeplay), modeId(pref.mode));
  if (r) writePref(r);
  return r;
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
      button('Update', { kind: 'primary', small: true, icon: 'refresh', testid: 'coop-update-now', onClick: () => reloadFresh(info.build) })));
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

/**
 * [social] The host left the room lobby: their DM invites into it expire on the server, so the
 * invited player sees "Expired" instead of joining an empty room and waiting for the host.
 */
function expireMyInvites(s) {
  if (!s?.isHost || !social.ready) return;
  getBackend().expireCoopInvites(s.code).catch(() => {});
}

/**
 * [teams] "You bring Team 2" (GEAR_UPDATE §11.1): the team is picked before the room opens (a room sends its girls when
 * it opens; switching inside a room needs the co-op protocol bump of M2, so the room shows the team it brings, locked).
 * The Host panel's foot carries the switch chip.
 */
/** The Host panel's team chip; a switch redraws it and the intro's line in place (the stage picks stay). */
function teamSlot() {
  const slot = h('span.ol-coop-team');
  const fill = () => {
    slot.replaceChildren(teamChip({ testid: 'coop-team', onSwitched: fill }));
    const line = document.querySelector('[data-testid="coop-bring"]');
    if (line) line.replaceWith(bringLine());
  };
  fill();
  return slot;
}

function bringLine() {
  const box = h('div.ol-coop-bring', { 'data-testid': 'coop-bring' });
  box.append(h('p.muted', `You bring ${activeTeamName()}: your hero and ${COOP.towersPerPlayer} girls each. Drops go to both; medals stay solo.`));
  return box;
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
  // ([ui-v2 M8] a room's code is on its plate: the bar says Co-op room)
  const { el, body } = screen(code ? 'Co-op room' : 'Co-op Battle', { cls: 'ol-screen', extra: onlineHeadExtra() });
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
    // freeplay: Off on first use, then remembered
    let freeplay = freeplayTier(readPref().freeplay);
    let mode = !freeplay && modesUnlocked(profile, stageId) ? modeId(readPref().mode) : 'standard';
    const stagePane = h('div.ol-coop-stage');
    const paintStage = () => {
      const s = STAGE_MAP[stageId];
      stagePane.replaceChildren(
        thumb(stageId),
        h('div.ol-coop-stage-info',
          h('div.ol-coop-stage-name', h('b', stageLabel(stageId)), h('span.ol-chip-diff', DIFFICULTIES[difficulty].name), modeChip(mode), freeplayChip(freeplay)),
          h('ul.ol-coop-facts',
            h('li', `Enemy HP ×${COOP.hpMul}`),
            h('li', `${formatNumber(coopStartCash(s))} coins each to start`),
            h('li', freeplay ? `Freeplay ${freeplayTable(freeplay).name}: keep going after wave ${s?.waves}` : 'Coins earned are split between you'))),
        // freeplay right here (not only inside Change stage): Off or a difficulty tier
        h('div.ol-fp-row.ol-fp-row-hub',
          h('span.ol-fp-label', 'Freeplay'),
          freeplaySeg(freeplay, (v) => {
            freeplay = v;
            writePref({ stageId, difficulty, freeplay });
            paintStage();
          }, 'coop-hub-freeplay'),
          h('small.muted.ol-fp-hint', freeplay ? `${tierLine(freeplay)} Keep going after wave ${s?.waves} until you fall or both finish.` : 'Off: the battle ends at the stage\'s last wave.')),
      );
    };
    paintStage();
    // [ui-v2 M8] Change stage sits on the panel's foot beside Create room (the stage's lines stay short on a phone)
    const changeStage = button('Change stage', { kind: 'ghost', small: true, icon: 'map', testid: 'coop-change-stage', onClick: async () => {
      const r = await pickStage(stageId, difficulty, freeplay, mode);
      if (!r) return;
      ({ stageId, difficulty, freeplay, mode } = r);
      writePref(r);
      paintStage();
    } });

    // [ui-v2 M8] one yellow: Rejoin when there is a last room to go back to, else Create room
    const hasLast = !!lastRoom(backend.uid);
    const create = button('Create room', {
      kind: hasLast ? 'primary' : 'yellow', icon: 'plus', testid: 'coop-create',
      onClick: () => {
        writePref({ stageId, difficulty, freeplay, mode });
        navigate('coop', { id: makeRoomCode(), host: '1', stage: stageId, difficulty, ...(freeplay ? { freeplay } : {}), ...(mode !== 'standard' ? { mode } : {}) });
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

    /** "Your last room" (left within the last two hours): one tap back in, no code to retype. */
    function lastPanel() {
      const last = lastRoom(backend.uid);
      if (!last) return null;
      return h('section.panel.ol-coop-last', { 'data-testid': 'coop-last-room' },
        h('h3.panel-title', 'Your last room'),
        h('div.ol-form-row',
          h('div.ol-last-room',
            h('b.ol-last-code', last.code),
            h('small.muted', `${last.host ? 'You host' : 'You joined'}${STAGE_MAP[last.stageId] ? ` · ${stageLabel(last.stageId)}` : ''}${freeplayTable(last.freeplay) ? ` · Freeplay ${freeplayTable(last.freeplay).name}` : ''}`)),
          button('Rejoin', { kind: 'yellow', small: true, icon: 'play', testid: 'coop-rejoin', onClick: () => navigate('coop', roomRoute(last)) })));
    }

    const invites = h('div.ol-invites', { 'data-testid': 'coop-invites' }, h('p.muted', 'Loading invites…'));
    // [social] open DM invites (to me) + today's clan-chat invites (unchanged, < 15 min). DM
    // invites this tab remembers are asked about again: only the newest per sender, and only
    // while the server still says "open" (a newer invite, a full or closed room ends one)
    (async () => {
      const rows = [];
      let clanTag = null;
      try {
        if ((await backend.socialStatus()) === 'ready') {
          const seen = new Map(social.invites.map((m) => [m.id, m]));
          const fresh = new Map();
          const inbox = await backend.inbox().catch(() => ({ threads: [] }));
          for (const t of inbox.threads) {
            if (t.last?.kind !== 'invite' || t.last.mine) continue;
            seen.set(t.last.id, t.last);
            fresh.set(t.last.id, t.last.inviteState);
          }
          for (const m of liveInvites([...seen.values()])) {
            const st = fresh.get(m.id) || (await backend.inviteState(m.id).catch(() => null));
            if (destroyed) return;
            if (st !== 'open') {
              forgetInvite(m.id);
              continue;
            }
            rows.push(h('div.ol-invite-row', { 'data-room': m.meta.room, 'data-testid': 'invite-row-dm' }, avatar(m.avatar, 34),
              h('div', h('b', m.name), h('small.muted', ` ${stageLabel(m.meta.stage)} · private invite`)),
              button('Join', { kind: 'primary', small: true, testid: 'invite-row-join', onClick: () => joinInvite(m) })));
          }
        }
        const mine = await backend.myClan();
        if (destroyed) return;
        if (mine) {
          clanTag = mine.clan.tag;
          const msgs = (await backend.history(`clan:${mine.clan.id}`, 50)).filter((m) => m.kind === 'invite' && m.meta?.room && m.userId !== backend.uid && !social.isBlocked(m.userId) && Date.now() - m.createdAt < 15 * 60000).reverse();
          for (const m of msgs.slice(0, 4)) {
            rows.push(h('div.ol-invite-row', { 'data-room': m.meta.room }, avatar(m.avatar, 34), h('div', h('b', m.name), h('small.muted', ` ${stageLabel(m.meta.stage)}`)),
              button('Join', { kind: 'primary', small: true, testid: 'invite-row-join', onClick: () => navigate('coop', { id: m.meta.room }) })));
          }
        }
        if (destroyed) return;
        if (rows.length) invites.replaceChildren(...rows.slice(0, 6));
        else if (clanTag) invites.replaceChildren(h('p.muted', `No open invites right now. Create a room and invite [${clanTag}] or a friend!`));
        else invites.replaceChildren(h('p.muted', 'Invites from friends and clanmates show up here.'), button('Find a clan', { kind: 'ghost', small: true, onClick: () => navigate('clan') }));
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
            bringLine()))),
      h('div.ol-coop-cols',
        h('section.panel.ol-coop-create', { 'data-testid': 'coop-create-panel' },
          h('h3.panel-title', 'Host a room'),
          stagePane,
          // [teams] the team this room will bring, switchable until the room opens (always shown: a short phone hides the intro)
          h('div.ol-row-end.ol-coop-foot', teamSlot(), changeStage, create)),
        h('div.ol-coop-right',
          lastPanel(),
          h('section.panel.ol-coop-join',
            h('h3.panel-title', 'Join with a code'),
            h('div.ol-form-row', codeInput, button('Join', { kind: 'primary', small: true, testid: 'coop-join', onClick: join }))),
          h('section.panel.ol-coop-clan',
            h('h3.panel-title', 'Invites'),
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
      roomTeam = activeTeamName(profile); // [teams] the team this room brings (sent when it opens)
      // a room link may name any campaign stage, never an event stage (EVENT_SPEC E11) nor a solo side stage
      // (Gate Arc's side-6-starfall is single-player)
      const linked = STAGE_MAP[params.stage];
      const stageId = isHost && linked && linked.kind !== 'event' && linked.kind !== 'side' ? params.stage : defaultStage(profile);
      const difficulty = DIFFICULTIES[params.difficulty] ? params.difficulty : 'normal';
      // the host's freeplay setting ("Your last room" reopens a freeplay room as one; a guest takes the host's)
      const freeplay = isHost ? freeplayTier(params.freeplay) : null;
      const mode = isHost ? modeId(params.mode) : 'standard';
      try {
        session = openSocialSession({
          code: roomCode, isHost, backend, stageId, difficulty, freeplay, mode,
          // battle modes need the host's own clear of the stage (docs/specs/CODEX_MODES.md §2)
          modesUnlocked: (id) => modesUnlocked(store.profile, id),
          // (§20.7: the host's ladder opens Extended Day, a Full Day cleared; else the room plays a Full Day)
          afterUnlocked: () => fullCleared(store.profile),
          // autoAbil: my Settings → Auto-cast abilities (only `true` turns it on; the start message carries it)
          me: { uid: backend.uid, name: storedName() || backend.user?.name || 'Sensei', level: card.level, avatar: card.avatar, loadout, hero, ...(profile.settings?.autoCastAbilities ? { autoAbil: true } : null) },
        }, { isBlocked: (uid) => social.isBlocked(uid) }); // [social] never pair with a player I blocked; session.seated
      } catch (e) {
        const err = toOnlineError(e);
        if (err.code === 'rate_limited') throw new Error(`Too many rooms — try again in ${formatRetry(err.retryMs)}.`);
        throw e;
      }
    }

    const view = h('div.ol-room', { 'data-testid': 'coop-room' });
    /** [social] who was blocked when this lobby opened (dropBlockedAlly: who was blocked since). */
    let knownBlocked = social.blockedIds;
    body.replaceChildren(view);

    const copy = async () => {
      try {
        await navigator.clipboard.writeText(roomCode);
        toast('Room code copied', 'good');
      } catch {
        toast(`Room code: ${roomCode}`, 'info');
      }
    };

    // [social] invite a friend or clanmate by DM (sent once the server registered the room)
    async function inviteFriend() {
      const st = await backend.socialStatus();
      if (st !== 'ready') {
        toast(st === 'needs_update' ? 'Private invites need the latest server update — use Invite clan or share the code.' : 'Online features are offline right now.', 'info', 3200);
        return;
      }
      let list = [];
      try {
        list = await backend.inviteCandidates();
      } catch (e) {
        showError(e);
        return;
      }
      const invited = new Set((session.dmInvites || []).filter((x) => x.expires > Date.now()).map((x) => x.userId));
      const m = modal({
        title: 'Invite a friend',
        body: list.length
          ? h('div.sc-cands', { 'data-testid': 'coop-candidates' }, list.map((c) => h('div.sc-cand', { 'data-testid': 'coop-candidate' },
            avatar(c.avatar, 34),
            h('span.sc-row-main', h('span.sc-row-top', h('b', c.name), levelChip(c.level)),
              h('span.sc-row-sub', h(`span${c.online ? '.ol-online-dot' : ''}`, c.online ? 'Online' : c.friend ? 'Friend' : 'Clanmate'), c.canMessage ? '' : ' · can\'t get private invites yet')),
            button(invited.has(c.userId) ? 'Invited' : 'Invite', {
              kind: 'yellow', small: true, testid: 'coop-candidate-invite', disabled: !c.canMessage || invited.has(c.userId),
              onClick: async () => {
                m.close();
                await inviteOne(c);
              },
            }))))
          : h('div.ol-empty', h('b', 'Nobody to invite yet'), h('p.muted', 'Add friends from their player card (tap a name in chat or your clan), or share the room code.')),
        actions: [{ label: 'Close', kind: 'ghost', testid: 'coop-candidates-close' }],
      });
    }

    async function inviteOne(peer) {
      if (!session.seated) {
        addPendingInvite(roomCode, peer);
        toast(`${peer.name} gets the invite as soon as the room is ready.`, 'info');
        return;
      }
      const m = await sendRoomInvite(peer, session);
      if (m) {
        (session.dmInvites ||= []).push({ userId: peer.userId, name: peer.name, avatar: peer.avatar, expires: Number(m.meta?.expires) || Date.now() + INVITE_TTL_MS });
        paint();
      }
    }

    /** Invites waiting for the room to exist (from a card / DM, or before a reload). */
    async function sendPending() {
      if (!session.isHost || !session.seated || session.phase !== 'lobby') return;
      const list = takePendingInvites(roomCode);
      if (!list.length) return;
      if ((await backend.socialStatus()) !== 'ready') {
        toast('Invite not sent — private invites need the latest server update. Share the room code instead.', 'info', 3600);
        return;
      }
      for (const peer of list) await inviteOne(peer);
    }

    function invitedChips(s) {
      const live = (s.dmInvites || []).filter((x) => x.expires > Date.now());
      if (!live.length || s.peer) return null;
      return h('div.sc-invited', { 'data-testid': 'coop-invited' }, h('small.muted', 'Invited:'), live.map((x) => h('span.sc-invited-chip', avatar(x.avatar || 'hikari', 22), x.name,
        h('small', ` · expires in ${Math.max(1, Math.ceil((x.expires - Date.now()) / 60000))} min`))));
    }

    async function inviteClan() {
      try {
        const mine = await backend.myClan();
        if (!mine) {
          toast('You are not in a clan yet — share the room code instead.', 'info');
          return;
        }
        await backend.send(`clan:${mine.clan.id}`, `Co-op room ${roomCode}: ${inviteLine(session)}. Join me!`, { kind: 'invite', meta: { room: roomCode, stage: session.stageId } });
        toast(`Invite posted in [${mine.clan.tag}] chat`, 'good');
      } catch (e) {
        showError(e);
      }
    }

    /** "4-5 Normal · Freeplay Tempest · best 130/26" (the clan invite) */
    function inviteLine(s) {
      const st = STAGE_MAP[s.stageId];
      const t = freeplayTable(s.freeplay);
      const m = modeId(s.mode);
      if (!t) return `${stageLabel(s.stageId)} (${DIFFICULTIES[s.difficulty].name}${m !== 'standard' ? ` · ${MODE_TEXT[m].name}` : ''})`;
      const best = coopBestWaves(profile, s.stageId)[t.id];
      return `${s.stageId} ${DIFFICULTIES[s.difficulty].name} · Freeplay ${t.name}${best ? ` · best ${best}/${st?.waves}` : ''}`;
    }

    /** What the empty seat says while we wait: the link first, then who we wait for. */
    function waitText(s) {
      if (s.link === 'connecting') return ['Connecting to room…', 'This usually takes a second or two.'];
      if (s.link === 'reconnecting') return ['Reconnecting…', 'The connection dropped. Trying again on its own.'];
      if (s.returning) {
        // back from a battle: the ally is still on its battle screen (the results, or a battle
        // that runs on), or already back here and pairing
        if (s.returning.fighting) {
          // a freeplay run my ally plays on after I came back ("Rin is still fighting — wave 87")
          const f = s.returning.fighting;
          return [`${s.returning.name} is still fighting — wave ${f.wave}${f.goal ? `/${f.goal}` : ''}`, 'Your girls are still with them. The room stays open — they come back here when the run ends.'];
        }
        return s.returning.inRoom
          ? [`${s.returning.name} is back too…`, 'Joining you up again.']
          : [`Waiting for ${s.returning.name}…`, 'They are still on the battle screen. The room stays open — same code, no need to retype it.'];
      }
      if (!s.isHost && s.lastPeer?.why === 'left') return [`Waiting for ${s.lastPeer.name || 'the host'}…`, 'The room stays open while they are away.'];
      return s.isHost ? ['Waiting for your ally…', 'Share the code or invite your clan.'] : ['Looking for the host…', 'Your ally\'s room should show up in a moment.'];
    }

    function playerCard(p, slot, me) {
      if (!p) {
        const [title, sub] = waitText(session);
        return h('section.ol-pcard.empty', { style: { '--pc': COOP.colors[slot] } },
          session.mismatch
            ? h('div.ol-pcard-wait', h('b', `${session.mismatch.name} is here`), h('p.muted', 'Your game versions differ — see above.'))
            : h('div.ol-pcard-wait', { 'data-testid': 'coop-wait' }, miniMochi(), h('b', title), h('p.muted', sub)));
      }
      if (!me && !session.paired) {
        // I hear my ally, but it does not hear me yet: no Ready / Start until it does (the
        // lobby fixes a one-way link by itself with a fresh connection)
        return h('section.ol-pcard.empty', { style: { '--pc': COOP.colors[slot] }, 'data-testid': 'coop-connecting', 'data-slot': slot },
          h('div.ol-pcard-wait', miniMochi(), h('b', `Connecting to ${p.name || 'your ally'}…`),
            h('p.muted', 'Making sure you can both hear each other. This fixes itself in a few seconds.')));
      }
      // an ally's chips open the ally's girl, never your own copy of her
      const ally = me ? null : p;
      // a Tryout Day run: the hero they bring and the girls they drafted (their pool's stats)
      const units = session.tryout?.random === true
        ? [p.runHero ? unitChip(p.runHero.unitId, { hero: true, ally, stats: p.runHero.stats }) : null].filter(Boolean)
        : session.tryout
        ? [p.runHero ? unitChip(p.runHero.unitId, { hero: true, ally, stats: p.runHero.stats }) : null, ...(p.draft || []).map((id) => unitChip(id, { ally, stats: p.pool?.[id] || null }))].filter(Boolean)
        : [p.hero ? unitChip(p.hero.unitId, { hero: true, ally, stats: p.hero.stats }) : null, ...(p.loadout || []).map((e) => unitChip(e.unitId, { ally, stats: e.stats }))].filter(Boolean);
      const ready = slot === 0 ? true : !!p.ready;
      // [social] the ally's avatar opens their player card ("Add friend after a good game")
      const face = me || !p.uid ? avatar(p.avatar, 52) : h('button.ol-msg-av', { type: 'button', 'data-testid': 'coop-ally-card', 'aria-label': `${p.name || 'Ally'}: player card`, onclick: () => openPlayerCard(p.uid, p, { context: 'coop' }) }, avatar(p.avatar, 52));
      return h(`section.ol-pcard${me ? '.me' : ''}`, { style: { '--pc': COOP.colors[slot] }, 'data-testid': `coop-player-${slot}` },
        h('div.ol-pcard-head',
          face,
          h('div.ol-pcard-id',
            h('div', h('b.ol-pcard-name', p.name || 'Sensei'), me ? h('small.muted', ' (you)') : null),
            h('div.ol-pcard-tags', levelChip(p.level), h('span.ol-pcard-role', slot === 0 ? 'Host' : 'Guest'))),
          h(`span.ol-ready${ready ? '.on' : ''}`, { 'data-testid': `coop-ready-${slot}` }, slot === 0 ? 'HOST' : ready ? 'READY' : 'NOT READY')),
        h('div.ol-pcard-units', units.length ? units : h('small.muted', session.tryout ? (session.tryout.random === true ? RANDOM_TEXT.squad : 'Still drafting') : 'No girls in formation')));
    }

    /** The big stage card under the players: map, story line, waves, who you will meet. */
    function fieldPanel(s) {
      const st = STAGE_MAP[s.stageId];
      if (!st) return null;
      const rule = ruleTextFor(st); // the map rule, in the stage's own words when it has a skin
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
            // [ui-v2 M8] said once: the stage, its difficulty, the enemy HP and the coins are on the room's head
            h('div.ol-coop-stage-name', h('span.ol-field-waves', h('b', String(st.waves ?? '—')), ' waves'), modeChip(s.mode, { testid: 'coop-field-mode' })),
            st.desc ? h('p.ol-field-desc', st.desc) : null,
            rule ? h('p.ol-field-rule', { 'data-testid': 'coop-field-rule' }, 'Map rule: ', h('b', rule.name), `: ${rule.desc}`) : null,
            freeplayPanel(s, st),
            foes.length ? h('div.ol-field-foes', foes.map((e) => h('span.ol-foe', { title: e.name }, enemyToken(e.id, { size: 26 }), h('small', e.name)))) : null)));
    }

    /** Freeplay on: what it brings, this account's best on this tier, advice, the last run. */
    function freeplayPanel(s, st) {
      const t = freeplayTable(s.freeplay);
      if (!t) return null;
      const best = coopBestWaves(profile, s.stageId)[t.id];
      const last = session.lastRun && session.lastRun.stageId === s.stageId ? session.lastRun : null;
      const caps = ['detection', 'antiAir', 'armorPen'].map((k) => CAPABILITIES[k]?.name).filter(Boolean);
      // (the record and the last run first: the most rewarding part, and on a phone the first read)
      return h(`div.ol-field-fp.ol-fp-${t.id}`, { 'data-testid': 'coop-field-freeplay' },
        h('p.ol-field-fp-best', best ? `Your best: ${best}/${st.waves} (${t.name})` : `No ${t.name} run on ${s.stageId} yet.`),
        last ? h('p.ol-field-fp-last', { 'data-testid': 'coop-last-run' }, `Last run: ${last.wave}/${last.goal} · ${freeplayTable(last.tier)?.name || ''} · ${last.text}`) : null,
        h('p', h('b', `Freeplay · ${t.name}`), ' — ', freeplaySummary(s.stageId, t.id) || ''),
        h('p.muted', `Bring ${caps.join(', ')} and a boss killer.`),
        s.difficulty === 'nightmare' ? h('p.ol-field-fp-warn', '1 life — the first leak ends freeplay.') : null);
    }

    /**
     * The connection line above the players: "Reconnecting…" while the link is down with an ally
     * on screen (the empty seat says it otherwise), and after ~15 s without a link or without a
     * host, what to check and a Retry button.
     */
    function linkBanner(s) {
      const hostGone = !s.isHost && !s.peer && s.lastPeer?.why === 'left' && !s.mismatch;
      if (s.stuck === 'server' || (s.stuck && !hostGone)) {
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
          h('span', `${s.lastPeer.why === 'left' ? `${who} left the room.` : `Lost contact with ${who}.`} The room stays open: they can come back with code ${roomCode}. If they can't get back in (another browser or device), make a new room and send them the new code.`),
          button('New room', { kind: 'yellow', small: true, icon: 'plus', testid: 'coop-new-room', onClick: () => newRoom(s) }));
      }
      if (hostGone) {
        // the host left, but its room stays (same code, same channel): it pairs up again here
        // as soon as the host opens it again ("Your last room" → Rejoin)
        const who = s.lastPeer.name || 'The host';
        return h('div.ol-banner.warn', { 'data-testid': 'coop-host-gone' },
          `${who} left the room. It stays open: wait here and you pair up again as soon as they are back, or ask them for a new code.`);
      }
      return null;
    }

    /** Leave this session and open the same room again from scratch (a fresh join / seat). */
    function reopen(s) {
      s.close();
      cleanup();
      connecting(body, () => room(roomCode));
    }

    /**
     * [social] I blocked my ally (their card, Messages, a report). The server already freed their
     * seat and gave my room a new secret (block_player), so as the host I open the same room again
     * on the new channel, which they cannot reach (join_room answers them "full"); as a guest I
     * leave (my seat in their room is gone too). Also on coming back from a battle with them.
     * `blocked`: the blocked list of a 'blocked' event (who was blocked just now).
     */
    function dropBlockedAlly(blocked = null) {
      const s = session;
      if (destroyed || s.phase !== 'lobby') return;
      const fresh = blocked ? [...blocked].filter((u) => !knownBlocked.has(u)) : [];
      if (blocked) knownBlocked = new Set(blocked);
      const ally = s.peer?.uid || s.returning?.uid || null;
      if (ally && social.isBlocked(ally)) {
        if (s.isHost) {
          toast('The player you blocked is out of your room. Same code, new connection.', 'info', 3200);
          reopen(s);
        } else {
          s.close();
          toast('You left the room.', 'info');
          navigate('coop');
        }
        return;
      }
      // someone who sat in my room earlier still knows its secret: the server gave my empty room a
      // new one (block_player), so I open it again on the new channel (nobody is waiting in it)
      if (fresh.length && s.isHost && !s.peer) reopen(s);
    }

    function newRoom(s) {
      expireMyInvites(s);
      s.close({ keepRoom: false }); // this code is given up for the new one
      navigate('coop', { id: makeRoomCode(), host: '1', stage: s.stageId, difficulty: s.difficulty, ...(s.freeplay ? { freeplay: s.freeplay } : {}) });
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
            s.error?.code === 'offline' ? button('Retry', { kind: 'yellow', small: true, icon: 'refresh', testid: 'coop-retry', onClick: () => reopen(s) }) : null,
            s.isHost ? button('New room', { kind: 'yellow', small: true, icon: 'plus', testid: 'coop-new-room', onClick: () => newRoom(s) }) : null)));
    }

    // -------------------------------------------------------------------------------------
    // Tryout Day (the Off / On row in today's look; the run panel in the Ink & Paper kit, M3)
    // -------------------------------------------------------------------------------------
    const ownedNow = (id) => isOwned(store.profile, id);
    const TRYOUT_WINDOW_UNLOCK = (n) => TRYOUT.windows[TRYOUT.grades[n]?.window]?.unlock || '';

    /** A fresh run for the host: a new seed, Grade 1, Half Day, the seed's first (or second) map; Random Class kept. */
    function newRun(mapPick = 0, grade = 1, length = 'half', random = false) {
      const seed = newRunSeed();
      return { seed, grade, length, mapId: mapChoices(seed, grade)[mapPick], ...(random === true ? { random: true } : null) };
    }

    function mapName(id) {
      try {
        return getMap(id).name;
      } catch {
        return id || '—';
      }
    }

    /** My run's screen state on the session (kept through a battle and back): its seed and the Redraw used. */
    function runUi(s) {
      if (!s.runUi || s.runUi.seed !== s.tryout.seed) s.runUi = { seed: s.tryout.seed, redraw: 0, sent: false };
      return s.runUi;
    }

    /** A run is on and my pool and hero have not gone out for its seed yet: send them (true: the session repainted). */
    function ensureRunPicks(s) {
      if (!s.tryout || s.phase !== 'lobby') return false;
      const ui = runUi(s);
      if (ui.sent) return false;
      ui.sent = true;
      const heroes = heroChoices(store.profile);
      const keep = [s.me.runHero?.unitId, s.me.hero?.unitId].find((id) => heroes.includes(id)) || heroes[0] || null;
      s.setRunPicks({ pool: frozenPool(store.profile), runHero: heroEntry(store.profile, keep), draft: s.me.draft || [] });
      return true;
    }

    /** Host: Tryout Day Off / On (locked until the Spring Term clear). */
    function tryoutRow(s) {
      const open = tryoutUnlocked(store.profile);
      return h('div.ol-fp-row.ol-fp-row-room', { 'data-testid': 'coop-tryout-row' },
        h('span.ol-fp-label', 'Tryout Day'),
        h('div.ol-seg', { 'data-testid': 'coop-tryout' },
          h(`button.ol-seg-btn${!s.tryout ? '.on' : ''}`, { type: 'button', 'data-tryout': 'off', onclick: () => { if (s.tryout) s.setTryout(null); } }, 'Off'),
          h(`button.ol-seg-btn${s.tryout ? '.on' : ''}`, {
            type: 'button', 'data-tryout': 'on', disabled: !open, title: open ? 'A run instead of a stage' : `Clear ${TRYOUT_UNLOCK} to unlock`,
            onclick: () => { if (!s.tryout) s.setTryout(newRun()); },
          }, open ? 'On' : `Locked · Clear ${TRYOUT_UNLOCK}`)));
    }

    /** The run: its map (the host picks one of two), my six (pick 3, one Redraw), my hero, my ally's progress. */
    // [M3] in the kit (docs/specs/TRYOUT_DAY.md §13.10): the six as girl tiles, the Grades as a segRow (a locked one
    // says why), the map and the length as .ui-opt cards, the heroes as .ui-opt rows; the same test ids as M1
    function runPanel(s) {
      if (!s.tryout) return null;
      const run = s.tryout;
      const ui = runUi(s);
      const slot = s.isHost ? 0 : 1;
      // Random Class (§20.4, §20.7): the Sim draws each player's three from their first six (no Redraw), so the six
      // show and nobody picks
      const opts = runOptions(run);
      const six = draftOf(ownedNow, run.seed, slot, opts.random ? 0 : ui.redraw);
      const picked = opts.random ? [] : (s.me.draft || []).filter((id) => six.includes(id));
      const toggle = (id) => {
        if (opts.random) return;
        if (picked.includes(id)) s.setRunPicks({ draft: picked.filter((x) => x !== id) });
        else if (picked.length >= 3) toast('Pick exactly 3. Tap a picked girl to put her back first.', 'info');
        else s.setRunPicks({ draft: [...picked, id] });
      };
      const tile = (id) => {
        const on = picked.includes(id);
        const mine = ownedNow(id);
        const short = mine ? CLASS_TEXT.yoursShort : CLASS_TEXT.loaner;
        // (the kit's tag chip: one short word, the full words in its title; every run tile is drawn as owned, a Loaner too)
        const t = girlTile(id, { owned: true, selected: on, potential: mine ? undefined : 0, tag: short, testid: 'coop-run-girl', cls: 'ty-draft', onClick: () => toggle(id) });
        if (opts.random) {
          t.setAttribute('aria-disabled', 'true');
          t.tabIndex = -1;
        } else t.setAttribute('aria-pressed', String(on));
        fullTag(t, short, mine ? CLASS_TEXT.yours : CLASS_TEXT.loaner);
        return t;
      };
      const heroes = heroChoices(store.profile);
      const myHero = s.me.runHero?.unitId || null;
      const maps = mapChoices(run.seed, run.grade);
      const ally = s.peer;
      const allyN = ally?.draft?.length || 0;
      const mapCard = (id, { on, onClick = null }) => {
        let m = null;
        try {
          m = getMap(id);
        } catch { /* (an unknown map: its id) */ }
        return h(`${onClick ? 'button' : 'div'}.ui-panel.ty-map${on ? '.on' : ''}`, {
          type: onClick ? 'button' : null, 'data-map': id, 'aria-pressed': onClick ? String(on) : null, onclick: onClick,
        },
        h('span.ty-map-thumb', { 'aria-hidden': 'true', html: m ? stageThumbSVG(m, { width: 320, height: 200 }) : '' }),
        h('span.ty-map-txt', h('b.ty-map-name', m?.name || id), h('span.ty-map-line', m?.tracks ? CLASS_TEXT.roads(m.tracks.length) : '')));
      };
      const gradeItems = Array.from({ length: TRYOUT_GRADES }, (_, i) => {
        const n = i + 1;
        const st = gradeOpen(store.profile, n);
        const why = st.open ? null : gradeWhy(st.why, n, TRYOUT_WINDOW_UNLOCK(n));
        return { id: String(n), label: String(n), locked: !st.open, title: why || `Grade ${n}`, why };
      });
      const grades = s.isHost ? segRow(gradeItems, String(run.grade), (id, it) => {
        if (it.locked) return toast(it.why, 'info');
        // (another Grade can change the content window: a new seed's maps come with it)
        if (run.grade !== Number(id)) s.setTryout(newRun(0, Number(id), run.length, opts.random));
      }, { label: 'Grade', testidPrefix: 'coop-run-grade-', min: 36 }) : null;
      if (grades) grades.dataset.testid = 'coop-run-grade';
      // Half Day · Full Day · Extended Day: the host's ladder opens each (§20.7: Extended Day after a Full Day clear)
      const lengths = s.isHost ? segRow(RUN_LENGTHS.map((k) => {
        const st = lengthOpen(store.profile, k);
        const why = st.why === 'full' ? EXTENDED_TEXT.locked : CLASS_TEXT.full;
        return { id: k, label: LENGTH_NAMES[k], locked: !st.open, title: st.open ? LENGTH_NAMES[k] : why, why };
      }), opts.length, (k, it) => {
        if (it.locked) return toast(it.why, 'info');
        if (run.length !== k) s.setTryout({ ...run, length: k });
      }, { label: 'Length', testidPrefix: 'coop-run-length-', min: 84 }) : null;
      if (lengths) lengths.dataset.testid = 'coop-run-length';
      // Random Class: the host's switch (no unlock); its help line says what it promises
      const randomRow = s.isHost ? h('div.ty-coop-row',
        h('span.lbl.ty-coop-lbl', RANDOM_TEXT.name),
        h('div.ty-coop-random',
          h(`button.ui-opt.ty-switch${opts.random ? '.on' : ''}`, {
            type: 'button', 'data-testid': 'coop-run-random', 'aria-pressed': String(opts.random),
            'aria-label': `${RANDOM_TEXT.name}: ${opts.random ? RANDOM_TEXT.on : RANDOM_TEXT.off}`,
            onclick: () => {
              const next = { ...run };
              if (opts.random) delete next.random;
              else next.random = true;
              s.setTryout(next);
            },
          }, h('span.ty-switch-knob', { 'aria-hidden': 'true' }), h('span', opts.random ? RANDOM_TEXT.on : RANDOM_TEXT.off)),
          h('span.ty-coop-note', { 'data-testid': 'coop-run-random-help' }, RANDOM_TEXT.help))) : null;
      // the guest: the host's choices, read-only
      const guestOpts = s.isHost ? null : h('div.ty-coop-row', { 'data-testid': 'coop-run-options' },
        h('span.lbl.ty-coop-lbl', 'Run'),
        h('div.ty-coop-opts',
          h('span.ui-chip.ink', { 'data-testid': 'coop-run-length-ro', 'data-length': opts.length }, LENGTH_NAMES[opts.length]),
          h('span.ui-chip.ink', { 'data-testid': 'coop-run-random-ro', 'data-on': String(opts.random) }, RANDOM_TEXT.room(opts.random))),
        opts.random ? h('span.ty-coop-note', RANDOM_TEXT.help) : null);
      return h('section.panel.ty-coop', { 'data-testid': 'coop-run' },
        h('h3.panel-title', 'Tryout Day'),
        h('div.ty-coop-row',
          h('span.lbl.ty-coop-lbl', 'Map'),
          h('div.ty-coop-maps', { 'data-testid': 'coop-run-map' }, ...(s.isHost
            ? maps.map((id) => mapCard(id, { on: run.mapId === id, onClick: () => { if (run.mapId !== id) s.setTryout({ ...run, mapId: id }); } }))
            : [mapCard(run.mapId, { on: true })]))),
        s.isHost ? h('div.ty-coop-row', h('span.lbl.ty-coop-lbl', 'Grade'), grades) : null,
        s.isHost ? h('div.ty-coop-row', h('span.lbl.ty-coop-lbl', 'Length'), lengths,
          button('New run', { kind: 'ghost', small: true, icon: 'refresh', testid: 'coop-run-new', onClick: () => s.setTryout(newRun(0, run.grade, run.length, opts.random)) })) : null,
        randomRow,
        guestOpts,
        h('p.ty-coop-note', `Grade ${run.grade} · ${LENGTH_NAMES[opts.length]}${opts.random ? ` · ${RANDOM_TEXT.name}` : ''}${s.isHost ? '' : ' (the host picks)'} · ${gradeTwist(TRYOUT.grades, TRYOUT.windows, run.grade)}`),
        h('div.ty-coop-row',
          h('span.lbl.ty-coop-lbl', opts.random ? RANDOM_TEXT.squad : `Your squad: ${picked.length}/3`),
          opts.random ? null : secondaryBtn(ui.redraw ? CLASS_TEXT.redrawn : CLASS_TEXT.redraw(1), {
            icon: 'refresh', testid: 'coop-run-redraw', disabled: ui.redraw >= 1,
            onClick: () => {
              ui.redraw = 1;
              s.setRunPicks({ draft: [] });
            },
          }),
          h('span.ty-coop-note', { 'data-testid': 'coop-run-six-note' }, opts.random ? `${RANDOM_TEXT.six} ${CLASS_TEXT.loanerNote}` : 'Pick 3 of your six. Loaners are girls you do not own yet: they play at the run\'s floor.')),
        h(`div.ty-coop-six${opts.random ? '.random' : ''}`, { 'data-testid': 'coop-run-six' }, ...six.map(tile)),
        h('div.ty-coop-row',
          h('span.lbl.ty-coop-lbl', 'Hero'),
          h('div.ty-bc-heroes', { 'data-testid': 'coop-run-hero', role: 'radiogroup', 'aria-label': 'Hero' }, ...heroes.map((id) => h(`button.ui-opt.ty-hero${myHero === id ? '.on' : ''}`, {
            type: 'button', role: 'radio', 'data-unit': id, 'aria-checked': String(myHero === id),
            onclick: () => { if (myHero !== id) s.setRunPicks({ runHero: heroEntry(store.profile, id) }); },
          }, avatar(id, 34), h('span.ty-hero-txt', h('b', UNIT_MAP[id]?.name || id), h('span.ty-hero-whose', ownedNow(id) ? CLASS_TEXT.heroYours : CLASS_TEXT.heroFree)))))),
        ally ? h('p.ty-coop-note', { 'data-testid': 'coop-run-ally' }, `${ally.name || 'Your ally'}: ${opts.random ? RANDOM_TEXT.squad.toLowerCase() : `${allyN}/3 picked`}${ally.runHero ? ` · hero ${UNIT_MAP[ally.runHero.unitId]?.name || ally.runHero.unitId}` : ''}`) : null);
    }

    function tipsPanel() {
      const tips = [
        ['Your girls, your coins', 'Each of you deploys from your own formation with your own wallet.'],
        ['Two heroes', 'Each of you brings your own hero: free to deploy, levelled with your own coins, and you fire her ult.'],
        ['Kills pay both', 'Every coin the defence earns is split between you.'],
        ['Hands off her girls', 'Only the owner can upgrade, sell or retarget a girl (the coloured pin shows whose).'],
        ['Nobody is left alone', 'If a connection drops, the other keeps playing — her girls keep fighting.'],
      ];
      return h('section.panel.ol-room-tips', h('h3.panel-title', 'How co-op works'),
        h('ol.ol-tips', tips.map(([t, d]) => h('li', h('span.ol-tip-n', { 'aria-hidden': 'true' }), h('div', h('b', t), h('small', d))))));
    }

    const updateCheckedFor = new Set(); // allies whose mismatch already triggered an update check
    let remembered = '';
    let seenFreeplay = session.freeplay; // guest: the setting my Ready was given for
    let seenRun = session.tryout; // guest: the Tryout Day run my Ready was given for
    let wasReady = !!session.me.ready;
    function paint() {
      if (destroyed) return;
      const s = session;
      if (s.phase === 'closed') return;
      if (!s.isHost && s.phase === 'lobby') {
        // the host changed freeplay: Ready is consent, so the session took mine back — say so
        if (s.freeplay !== seenFreeplay && wasReady && !s.me.ready) {
          const t = freeplayTable(s.freeplay);
          toast(`The host set freeplay to ${t ? t.name : 'Off'} — tap Ready again if that suits you.`, 'info');
        }
        // …or the Tryout Day run
        if (s.tryout !== seenRun && wasReady && !s.me.ready && s.freeplay === seenFreeplay) {
          toast(s.tryout ? 'The host changed the Tryout Day run. Tap Ready again if that suits you.' : 'The host turned Tryout Day off. Tap Ready again if that suits you.', 'info');
        }
        seenFreeplay = s.freeplay;
        seenRun = s.tryout;
        wasReady = !!s.me.ready;
      }
      // a run is on: my pool and hero go out once per seed (setRunPicks repaints)
      if (ensureRunPicks(s)) return;
      if (s.error || s.full) {
        // the server refused the room (wrong code, taken, full, too many) or it closed after
        // idling: nothing else to show (no seats, no Ready). A room that will not come back is
        // no longer offered for Rejoin on the co-op menu
        if (s.full || ['not_found', 'name_taken', 'idle', 'invalid'].includes(s.error?.code)) forgetRoom(roomCode, s.me.uid);
        view.replaceChildren(deadEnd(s));
        return;
      }
      // the co-op menu's "Your last room": only once the server let me in (a mistyped or full
      // code must not replace the room I was really in)
      const key = `${s.code}|${s.isHost}|${s.stageId}|${s.difficulty}|${s.freeplay}`;
      if (s.link === 'connected' && key !== remembered) {
        remembered = key;
        rememberRoom(s);
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
        const label = s.canStart ? (s.tryout ? 'Start run' : 'Start battle')
          : s.tryout && s.tryout.random !== true && s.paired && !draftReady(s.me.draft) ? 'Pick your 3 girls'
          : s.tryout && s.tryout.random !== true && s.paired && s.peer.ready && !draftReady(s.peer.draft) ? 'Waiting for their 3…'
          : s.paired ? 'Waiting for ready…' : s.peer ? 'Connecting…' : 'Waiting for ally…';
        action = button(label, {
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
            s.tryout ? h('div.ol-room-thumb', { html: (() => { try { return stageThumbSVG(getMap(s.tryout.mapId), { width: 320, height: 200 }); } catch { return ''; } })() }) : thumb(s.stageId, 'ol-room-thumb'),
            s.tryout ? h('div.ol-room-stage-info',
              h('div.ol-coop-stage-name', h('b', { 'data-testid': 'coop-stage' }, `Tryout Day · ${mapName(s.tryout.mapId)}`)),
              h('small.muted', 'A run instead of a stage: draft below, then Ready.')) : null,
            s.tryout ? null : h('div.ol-room-stage-info',
              h('div.ol-coop-stage-name', h('b', { 'data-testid': 'coop-stage' }, stageLabel(s.stageId)), h('span.ol-chip-diff', DIFFICULTIES[s.difficulty]?.name || ''), modeChip(s.mode), freeplayChip(s.freeplay, { testid: 'coop-freeplay-chip' })),
              h('small.muted', `Enemy HP ×${COOP.hpMul} · ${formatNumber(coopStartCash(st))} coins each`),
              s.isHost ? button('Change', { kind: 'ghost', small: true, icon: 'map', testid: 'coop-room-stage', onClick: async () => {
                const r = await pickStage(s.stageId, s.difficulty, s.freeplay, s.mode);
                if (r) {
                  writePref(r);
                  s.setStage(r.stageId, r.difficulty, r.freeplay, r.mode);
                }
              } }) : null),
            // the host can switch freeplay here too, under the stage (the guest's Ready is taken
            // back: Ready is consent)
            s.isHost && !s.tryout ? h('div.ol-fp-row.ol-fp-row-room', h('span.ol-fp-label', 'Freeplay'), freeplaySeg(s.freeplay, (v) => {
              if (v === s.freeplay) return;
              writePref({ freeplay: v });
              s.setStage(s.stageId, s.difficulty, v);
            }, 'coop-room-freeplay')) : null,
            s.isHost ? tryoutRow(s) : null),
          h('div.ol-room-acts',
            s.isHost && social.ready && !s.peer ? button('Invite a friend', { kind: 'pink', small: true, icon: 'plus', testid: 'coop-invite-friend', onClick: inviteFriend }) : null,
            button('Invite clan', { kind: 'ghost', small: true, icon: 'plus', testid: 'coop-invite', onClick: inviteClan }),
            button('Leave', { kind: 'ghost', small: true, icon: 'back', testid: 'coop-leave', onClick: () => { expireMyInvites(s); s.close(); navigate('coop'); } }))),
        localNotice('coop'),
        linkBanner(s),
        invitedChips(s),
        s.mismatch ? mismatchBanner(s.mismatch) : null,
        h('div.ol-room-players', playerCard(host, 0, s.isHost), h('div.ol-vs', '&', h('small', 'together')), playerCard(guest, 1, !s.isHost)),
        s.tryout ? null : h('p.muted.ol-room-team', { 'data-testid': 'coop-room-team' }, `You bring ${roomTeam || activeTeamName()}.`),
        runPanel(s),
        h('div.ol-room-foot',
          h('p.muted', s.isHost ? 'You start when your ally is ready. Both of you play live — every order lands on both screens a moment later.' : 'Tap Ready when your girls are set. The host starts the battle.'),
          action,
          h('p.ver-line', { 'data-testid': 'coop-my-version' }, `Your game version: ${versionLabel(APP_VERSION)}`)),
        // below the call to action (phones scroll to it): the stage up close and the rules
        h('div.ol-room-more', s.tryout ? null : fieldPanel(s), tipsPanel()),
      ].filter(Boolean)); // replaceChildren(null) would print "null"
      // the room repaints on every session change (hellos, ready, returning…): only the first paint
      // slides the panels in, later ones must not restart that animation (a flicker every few seconds)
      requestAnimationFrame(() => view.classList.add('ol-room-live'));
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
      session.on('seated', () => sendPending()),
      social.on('status', () => paint()),
      social.on('blocked', (set) => dropBlockedAlly(set)),
      session.on('start', () => {
        keepSession = true;
        navigate('battle', { coop: roomCode });
      }),
    ];
    if (session.seated) sendPending();
    cleanup = () => offs.forEach((off) => off());
    dropBlockedAlly();
  }

  return () => {
    destroyed = true;
    globalThis.removeEventListener?.('pageshow', onPageShow);
    cleanup();
    // leaving the lobby screen (not into the battle) leaves the room (and the host's DM invites
    // into it expire: nobody is there to play with)
    const s = getSession();
    if (s && s.code === code && !keepSession && s.phase === 'lobby') {
      expireMyInvites(s);
      s.close();
    }
  };
}
