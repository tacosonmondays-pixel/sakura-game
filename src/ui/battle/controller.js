// Battle controller: builds the Sim from the profile (or a battle save: Continue), creates the
// renderer, runs the RAF loop (paused while the tab is hidden), wires HUD / tower bar / panels /
// results, keeps the battle save up to date (battleSaver.js) and cleans everything up on leave.
// Exposes window.__battle = { sim, renderer, ui, save } for e2e.
import { h } from '../dom.js';
import { store } from '../../core/store.js';
import { navigate, rememberParams } from '../router.js';
import { preloadModels, preloadEnemies, detailFor } from '../../models/index.js';
import { createBattleRenderer } from '../../render/BattleRenderer.js';
import { cameraModeOf } from '../../render/cameraPolicy.js';
import { STAGE_MAP, stageEnemies } from '../../data/stages.js';
import { ENEMY_MAP } from '../../data/enemies.js';
import { TRAITS, BATTLE } from '../../data/types.js';
import { createBattleSim, resumeBattleSim, parseBattleParams, parseTitanParams, mapRouteFor, resolveFormation, createTryoutSim } from './setup.js';
import { createTitanTracker } from '../../data/titans.js';
import { applyTitanResult } from '../../systems/titans.js';
import { createBattleSaver } from './battleSaver.js';
import { createTryoutSaver } from './tryoutSaver.js';
import { createTryoutBattle } from './tryout.js';
import { MODE_NAME as TRYOUT_MODE_NAME, EXTENDED_TEXT } from '../text/tryout.js';
import { buildTryoutPlan, buildTryoutStage } from '../../sim/tryout/index.js';
import { getTryoutRun, markResume, continueKind, clearTryoutRun } from '../../systems/tryoutRuns.js';
import { applyTryoutResult, applyTryoutRecord } from '../../systems/tryoutRewards.js';
import { SIM_ID as TRYOUT_SIM_ID } from '../../core/buildInfo.js';
import { isSavableRun, slotKey, getBattleSave, clearBattleSave, saveSummary, runStartedAt, MAX_BATTLE_SAVES } from '../../systems/battleSave.js';
import { createHud } from './hud.js';
import { createTowerBar } from './towerBar.js';
import { createPlacement } from './placement.js';
import { createTowerPanel } from './towerPanel.js';
import { createHeroWidget, paintUltButton, skillKeyAction } from './heroWidget.js';
import {
  createAbilityBar, battleKeyAction, refusalText, createAbilityNotes, unlockText, allyChipText, lifeText, clearPendingFor, REFUSED_MS,
  soloAbilityActs, coopAbilityActs, abilityAutoControls,
} from './abilityBar.js';
import { boltText, ico, KIT_SVG } from '../kit.js';
import { abilityText } from '../../data/abilityText.js';
import { createHeroLevels, heroWarnText } from './heroLevels.js';
import { createBossBar } from './bossBar.js';
import { createFeed } from './feed.js';
import { createWaveControl } from './waveControl.js';
import { createPauseMenu } from './pauseMenu.js';
import { createResults } from './results.js';
import { createUpgradeTree } from './upgradeTree.js'; // [unit-info] hold-to-view upgrade tree
import { createSandboxPanel } from './sandboxPanel.js';
import { sandboxOutcome } from '../../systems/sandbox.js';
import { enemyDef, traitBadge, icon } from './util.js';
import { fmtNum } from '../format.js';
import { finalRaceText } from './rules.js';
import { PICK_REFUSED, pickText } from './buffs.js';
import { limitedRange } from '../../sim/buffs.js';
import { svgEl, toast } from '../components.js';
import { portraitHTML } from '../../art/portraits.js';
import { quantize, flyArgs } from '../../online/coop/commands.js';
import { STEP } from '../../sim/constants.js';
import { battleLockstep, normalizeCode } from '../../online/coop/session.js';
import { roomByCode, roomRoute } from '../../online/coop/lastRoom.js';
import { applyCoopResult, freeplayLedger, payFreeplayEnd, applyCoopTryoutResult } from '../../online/coop/rewards.js';
import { normalizeList } from '../../systems/inventory.js';
import { createCoopHud } from '../online/coopHud.js';
import { createFreeplayBattle } from './freeplay.js';
import { createFlightControl } from './chikaFlight.js';
import { createAimControl } from './aimControl.js';
import { sampleDroneRates } from './chikaPanel.js';
import { createRateMeter, buildErrorContext } from './util.js';
import { createModesBattle } from './modes.js';
import { COOP } from '../../data/coop.js';
import { UNIT_MAP } from '../../data/units.js';
import { applyBattleResult } from '../../systems/rewards.js';
import { track } from '../../systems/missions.js';
import { countCoopWin } from '../../systems/achievementCounters.js';
import { soloFreeplayLedger, bankSoloClear, paySoloFreeplay, soloWaveCoins } from '../../systems/freeplayRewards.js';
import { continueIntoFreeplay, rememberSoloTier } from './soloFreeplay.js';
import { createRng, hashString } from '../../core/rng.js';
import { attachBattleAudio } from '../../audio/battle.js'; // [audio]
import { holdLoader, setLoaderProgress, frames } from '../transitions/index.js';
import { eventNow } from '../events/clock.js'; // [events]
import { formationSkins } from '../../systems/skins.js';
import { supportAllowed, clampSupportUnit, supportLoadoutEntry, supportMiniProfile } from '../../systems/friendSupport.js'; // [friend support]
import { supportPays } from '../../online/supportRules.js';
import { newKey } from '../../online/donateLedger.js';
import { pickFor } from './supportPick.js';
import { extendedPast, isExtendedRun } from './tryout/adapters.js';
import { createCoopPending } from './coopPending.js';

const RESULT_DELAY_MS = 1700;
const MODEL_TIMEOUT_MS = 5000;

/** Resolves after `promise` or `ms`, whichever comes first (never rejects). */
function settle(promise, ms) {
  return Promise.race([Promise.resolve(promise).catch(() => false), new Promise((r) => setTimeout(() => r(false), ms))]);
}

/** Runs `fn` over `items`, at most `limit` at a time (the same concurrency the model loaders use). */
function pool(items, limit, fn) {
  const queue = [...items];
  const worker = async () => {
    while (queue.length) await fn(queue.shift());
  };
  return Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
}

/**
 * Mounts a battle into `root`.
 * @param {HTMLElement} root
 * @param {object} params route params ({ stage, difficulty, freeplay?, endless?, resume?, coop?, clanBoss? })
 *   resume = a battle save's run id (Continue); freeplay = a solo freeplay tier (never saved)
 * @param {{ restart(opts?: { fresh?: boolean }): void, coop?: object|null }} hooks  coop = the co-op session
 *   (online/coop/session.js); restart({ fresh: true }) = a new battle (Restart / Retry), without `resume`
 * @returns {{ destroy(): void, ready: Promise<void> }}
 */
export function mountBattle(root, params, hooks) {
  const profile = store.profile;
  // Co-op: the Sim comes from the session's Lockstep (same start message on both clients)
  const session = params.coop ? hooks.coop || null : null;
  const ls = battleLockstep(params, session);
  // a co-op battle page without its battle (reloaded, or reached again later): the room itself
  // is still there, so lead back into it (no code to retype, no new room)
  const coopRoom = params.coop && !ls ? roomByCode(normalizeCode(params.coop)) : null;
  // Tryout Day (docs/specs/TRYOUT_DAY.md): solo plays the open run (profile.tryoutRun); co-op's comes in the start message
  const tryRec = !ls && params.tryout ? getTryoutRun(profile) : null;
  const tryKind = tryRec && tryRec.id === params.tryout ? continueKind(tryRec, TRYOUT_SIM_ID) : null;
  const req = ls
    ? { stageId: ls.start.stageId, difficulty: ls.start.difficulty, endless: false, freeplay: null, keepGoing: false, practice: false, error: null, ...(ls.start.tryout ? { stageDef: { ...ls.sim.stage, name: TRYOUT_MODE_NAME }, tryout: ls.start.tryout } : null) }
    : params.tryout
      ? (tryKind && tryKind !== 'stale'
        ? { stageId: 'tryout', stageDef: { ...buildTryoutStage(buildTryoutPlan(tryRec)), name: TRYOUT_MODE_NAME }, difficulty: 'normal', endless: false, freeplay: null, keepGoing: false, practice: !!tryRec.practice, error: null, tryout: tryRec }
        : { error: tryKind === 'stale' ? 'This Tryout Day run was made by an older version of the game and has been closed.' : 'This Tryout Day run has ended.', tryoutGone: true })
    : params.coop
      ? { error: coopRoom ? `This battle is over (or the page was reloaded). Room ${coopRoom.code} is still open: go back in and play again.` : 'This co-op battle has ended (or this page was reloaded). Open a new room to play again.' }
      : params.titan ? parseTitanParams(params, profile) : parseBattleParams(params, profile);
  const shell = h('div.bt-root', { 'data-testid': 'battle' });
  root.append(shell);

  if (req.error) {
    if (req.tryoutGone && tryKind === 'stale') {
      // an update closed the run: paid for the periods its last calm point banked (§12.5), in the same write
      try {
        applyTryoutRecord(profile, tryRec);
      } catch (e) {
        console.error('[tryout] paying a closed run failed', e);
      }
      clearTryoutRun(profile, tryRec.id);
      store.commit('tryout-run');
      store.saveNow();
    }
    const back = coopRoom ? () => navigate('coop', roomRoute(coopRoom)) : params.coop ? () => navigate('coop') : params.titan ? () => navigate('titans') : params.tryout ? () => navigate('tryout') : () => navigate('campaign');
    const label = coopRoom ? 'Back to the room' : params.coop ? 'Back to co-op' : 'Back to the map';
    shell.append(h('div.bt-error', h('div.bt-sheet', h('div.bt-sheet-title', 'Battle unavailable'), h('p', req.error), h('button.bt-cta', { 'data-testid': coopRoom ? 'coop-room-again' : 'battle-unavailable-back', onclick: back }, label))));
    return { destroy: () => shell.remove(), ready: Promise.resolve() };
  }

  // a Titan Trials battle brings its own stage (src/data/titans.js; not in STAGE_MAP)
  const stage = req.stageDef || STAGE_MAP[req.stageId];
  // a campaign map opened from Tactical Challenge (endless=1): its prep and its map are Tactical
  // Challenge's (endless=1 on a campaign map is a freeplay run now: it still belongs there)
  const endlessMap = !ls && !params.clanBoss && (params.endless === '1' || params.endless === 1 || params.endless === 'true') && stage.kind !== 'challenge';
  // the prep this battle came from (Quit, Save & quit, the battle-save notices); a solo freeplay
  // run's prep comes back with its tier picked
  const prepRoute = { id: stage.id, ...(endlessMap ? { endless: 1 } : {}), ...(req.freeplay ? { freeplay: req.freeplay } : {}) };

  // ---- battle save: Continue (&resume=<run id>), or a New game ----------------------------------
  // (never co-op, the clan boss, the tutorial, a practice run or a solo freeplay run: src/systems/battleSave.js)
  const savable = !ls && !req.tryout && isSavableRun(params, req);
  // a mid-wave Continue spends the Make-up Test, a later one makes the run practice: written before the battle restarts
  if (tryRec && tryKind && tryKind !== 'calm' && tryKind !== 'stale') {
    markResume(tryRec);
    store.commit('tryout-run');
    store.saveNow();
    if (tryRec.practice) req.practice = true;
  }
  const slot = savable ? slotKey(req.stageId, req.endless) : null;
  const saved = savable ? getBattleSave(profile, slot) : null;
  /** A sheet instead of the battle: back to the stage (or, with `cont`, straight into the save that is there now). */
  const notice = (title, text, testid, cont = null) => {
    shell.append(h('div.bt-error', h('div.bt-sheet.bt-notice',
      h('div.bt-sheet-title', title),
      h('p', text),
      h('div.bt-notice-actions',
        h(`button.${cont ? 'bt-btn' : 'bt-cta'}`, { 'data-testid': testid, onclick: () => navigate('stage', prepRoute) }, icon('back', 'bt-ico-sm'), 'Back to the stage'),
        cont ? h('button.bt-cta', { 'data-testid': 'save-gone-continue', onclick: () => navigate('battle', cont.route, { replace: true }) }, icon('play', 'bt-ico-sm'), cont.label) : null))));
    return { destroy: () => shell.remove(), ready: Promise.resolve() };
  };
  if (savable && !req.resume && saved) {
    // a battle link for a stage with a saved battle never overwrites it: prep asks first
    const t = setTimeout(() => {
      navigate('stage', prepRoute, { replace: true });
      toast('You have a saved battle here. Continue it or start a new game.', 'info', 3200);
    }, 0);
    return { destroy: () => { clearTimeout(t); shell.remove(); }, ready: Promise.resolve() };
  }
  if (savable && req.resume && saved?.id !== req.resume) {
    // a newer run took the slot (another New game): offer that one rather than a dead end
    const cont = saved ? {
      label: `Continue saved battle · Wave ${saveSummary(saved).next}`,
      // (the save's own mode: a resume link never carries freeplay, setup.js parseBattleParams)
      route: { stage: stage.id, difficulty: saved.difficulty, resume: saved.id },
    } : null;
    return notice('Battle not found', saved ? 'This battle is already finished or was replaced by a newer one on this stage.' : 'This battle is already finished or was replaced.', 'save-gone-back', cont);
  }
  let restored = null;
  if (savable && req.resume) {
    try {
      restored = resumeBattleSim(profile, saved);
    } catch (e) {
      console.warn('[battle] saved battle could not be restored', e);
      clearBattleSave(profile, slot, saved.id);
      store.commit('battle-save');
      store.saveNow();
      return notice('Saved battle removed', 'This saved battle couldn\'t be restored after an update, so it was removed.', 'save-broken-back');
    }
  }

  const stageEl = h('div.bt-canvas');
  const layer = h('div.bt-layer');
  shell.append(stageEl, layer);
  // the loading screen (src/ui/transitions: "Loading" + Mochi, nothing else): up until this battle's
  // first frame is drawn (behind the cut from stage prep, the lobby or a co-op room; on its own for a
  // restart or a co-op rebuild in place), its progress line counting the girls' and enemies' models
  let markShown = () => {};
  const shown = new Promise((r) => {
    markShown = r;
  });
  const loader = holdLoader(shown, { progress: 0, immediate: true });

  let destroyed = false;
  let raf = 0;
  const cleanups = [];
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, ms);
    timers.add(id);
    return id;
  };

  // [friend support] a friend's Support Student (BANNERS §E.1): picked in stage prep for a New game (campaign, Bounty,
  // solo Freeplay), clamped to this save's range; a Continue keeps the one in its record. Never co-op, Titan Trials,
  // Sandbox, the tutorial, a practice run or the clan boss.
  let supportMark = restored ? saved?.support || null : null;
  let support = null;
  const supportOk = !ls && !params.coop && !params.clanBoss && !req.titan && !req.sandbox && !req.practice && params.tutorial !== '1'
    && supportAllowed(profile, stage, { difficulty: req.difficulty, endless: req.endless && stage.kind === 'challenge' });
  if (!restored && supportOk && typeof params.sup === 'string') {
    const pick = pickFor(params.sup);
    const card = pick ? clampSupportUnit(pick.unit, profile) : null;
    if (card && !resolveFormation(profile).towers.includes(card.id)) {
      supportMark = { unitId: card.id, owner: pick.owner, key: newKey(), card };
      support = { entry: supportLoadoutEntry(card), mark: supportMark };
    }
  }
  if (!supportOk && !restored) supportMark = null;

  // Continue preloads and plays the team frozen in the save, not today's formation
  const made = ls
    ? {
      sim: ls.sim,
      // (a Tryout Day run: each player's drafted three; girls who join later load as they join)
      towers: [...new Set(ls.start.players.flatMap((p) => [...(p.loadout || []).map((e) => e.unitId), ...(Array.isArray(p.draft) ? p.draft : [])]))],
      // every player's hero (each brings her own); preloaded like the girls
      hero: null,
      heroes: ls.start.players.map((p) => p.hero?.unitId).filter(Boolean),
    }
    // (a Tryout Day run builds its own sim from its draft and takes no Support Student: the check under it drops the mark)
    : restored || (req.tryout && !ls ? createTryoutSim(profile, req.tryout) : createBattleSim(profile, req, { support }));
  const { sim, towers, hero, heroes: heroIds } = made;
  if (supportMark && !sim.loadout.has(supportMark.unitId)) supportMark = null;
  if (supportMark) {
    // every result of this battle says it had a Support Student (rewards.js, limitBreak.js, freeplay payouts)
    const baseResult = sim.result;
    const mark = { unitId: supportMark.unitId, owner: supportMark.owner };
    sim.result = function supportResult(...args) {
      return { ...baseResult.apply(this, args), support: { ...mark } };
    };
  }
  // a Continue plays the saved run's own battle mode (the record's, whatever the link says), and a
  // mode run is never offered Keep going (setup.js parseBattleParams)
  if (restored) {
    req.mode = sim.mode?.id || 'standard';
    if (req.mode !== 'standard') req.keepGoing = false;
  }
  const settings = profile.settings || {};

  /** Enemy model families this stage can spawn (pool + fixed + split/brood/summon children). */
  function stageFamilies() {
    const fams = new Set();
    try {
      // (the stage the Sim runs: an event difficulty with its own waves brings its own enemies)
      for (const x of stageEnemies(sim?.stage || stage) || []) {
        const def = typeof x === 'string' ? ENEMY_MAP[x] : x;
        if (def) fams.add(def.model?.base || def.family);
      }
    } catch (e) {
      console.warn('[battle] stage enemy list failed', e);
    }
    return [...fams].filter(Boolean);
  }
  const knownEnemies = new Set(Object.entries(profile.bestiary || {}).filter(([, b]) => b?.seen || b?.discovered).map(([id]) => id));

  const ctx = {
    sim,
    stage,
    req,
    // [events] a limited-event battle pays by its start time (EVENT_SPEC §3.2): a Continue keeps the
    // saved run's (src/systems/battleSave.js runStartedAt), never the time it was resumed
    startedAt: restored ? runStartedAt(saved) : eventNow(),
    profile,
    settings,
    layer,
    shell,
    renderer: null,
    knownEnemies,
    speed: [1, 2, 3].includes(Number(settings.defaultSpeed)) ? Number(settings.defaultSpeed) : 1,
    paused: false,
    ended: false,
    selectedUid: null,
    saver: null,
    // [story] the coached first battle: no hold-to-view tree there (src/ui/battle/upgradeTree.js)
    tutorial: params.tutorial === '1',
    selectedDrone: null,
    rates: createRateMeter(5), // live damage rates of drone owners (chikaPanel.js)
    // [friend support] the borrowed girl, and whose save a card's look comes from (her own mini profile for her)
    support: supportMark,
    profileFor: null,
  };
  const supportMini = supportMark ? supportMiniProfile(supportMark.card) : null;
  ctx.profileFor = (unitId) => (supportMark && unitId === supportMark.unitId ? supportMini : profile);
  // the borrow itself: recorded at once, asked in the background, settled at wave 3 (or a shorter stage won)
  let supportBorrow = null;
  let supportSettled = false;
  if (supportMark) {
    supportBorrow = import('../../online/supportClient.js').then((m) => m.supportClient()).then((sc) => {
      if (support) return { sc, done: sc.startBorrow({ owner: supportMark.owner, unitId: supportMark.unitId, key: supportMark.key }).done };
      return { sc, done: null }; // a Continue: its borrow is in the ledger already
    }).catch(() => null);
  }
  const settleSupport = () => {
    if (!supportBorrow || supportSettled || !supportMark?.key) return;
    supportSettled = true;
    supportBorrow.then((b) => b?.sc.settle(supportMark.key, b.done)).then((r) => {
      if (r?.points > 0 && !destroyed) ctx.feed?.push(`Friend Support · +${r.points} Friend Points`, 'good', { ms: 2600 });
    }).catch(() => {});
  };

  // a battle-save warning raised before the feed exists (the first write can come before build())
  let saveWarning = null;
  const warnSave = (text) => {
    if (!ctx.feed) {
      saveWarning = text;
      return true;
    }
    ctx.feed.push(text, 'bad', { key: 'save-warn', ms: 5200, sticky: true });
    return true;
  };
  // the save of this run (null for runs that never save): created on first progress
  const saver = req.tryout && !ls
    ? createTryoutSaver({ sim, rec: req.tryout, isEnded: () => ctx.ended, onStorageFull: () => warnSave('Couldn\'t save this run on this device (storage is full).') })
    : savable
    ? createBattleSaver({
      sim,
      req,
      cfg: made.cfg || null,
      record: restored ? saved : null,
      startedAt: ctx.startedAt,
      // stage prep's "Saved battles full" sheet: the save the player chose to delete for this one
      evict: !restored && typeof params.evict === 'string' ? params.evict : null,
      isEnded: () => ctx.ended,
      // from now on a reload of this page continues the run
      onCreate: (rec) => rememberParams('battle', { resume: rec.id, evict: null }),
      onStorageFull: (reason) => warnSave(reason === 'held'
        ? 'Saving is paused on this device (see the notice from start-up), so this battle isn\'t being saved.'
        : 'Couldn\'t save this battle on this device (storage is full).'),
      onFull: () => warnSave(`You already keep ${MAX_BATTLE_SAVES} saved battles, so this one isn't being saved. Finish or delete one from its stage screen to make room.`),
    }).install()
    : null;
  ctx.saver = saver;
  if (restored) saver.resumed();

  const ready = (async () => {
    // chibis-v2: only the formation (+ hero) at the detail this quality needs (phones get the
    // LODs); enemies-v2: the stage's enemy families (procedural fallback when a GLB is missing).
    // One model per call (same concurrency as one batch call) so the loader can count them.
    const ids = [...new Set([...towers, ...(hero ? [hero] : []), ...(heroIds || [])])];
    const detail = detailFor(settings.quality || 'high');
    // [roster] each girl in her outfit: every preload and the renderer take the same skins
    ctx.skins = formationSkins(profile, ids);
    const fams = stageFamilies();
    const total = ids.length + fams.length + 1; // + building the scene
    let loaded = 0;
    const tick = () => {
      loaded++;
      if (!destroyed) setLoaderProgress(loaded / total);
    };
    await settle((async () => {
      await preloadModels([], { detail, skins: ctx.skins }); // (the loaders and the manifest, once)
      await Promise.all([
        pool(ids, 6, (id) => preloadModels([id], { detail, skins: ctx.skins }).catch(() => false).finally(tick)),
        pool(fams, 4, (f) => preloadEnemies([f]).catch(() => false).finally(tick)),
      ]);
    })(), MODEL_TIMEOUT_MS);
    if (destroyed) return;
    setLoaderProgress((total - 1) / total);
    // let the loader (and its progress line) draw before the long synchronous scene build
    await frames(2);
    if (destroyed) return;
    build();
  })();
  // a battle that never draws (no WebGL, an error in the build, left first) lets the loader go; a build that
  // threw says so in the console, with which battle it was (it used to vanish here)
  ready.catch((e) => {
    console.error('[battle] the battle scene failed to build', buildErrorContext({ req, params, quality: settings.quality, coop: !!ls }), e);
  }).then(() => {
    if (!ctx.renderer || destroyed) markShown();
  });

  // [story] the coached first battle (#/battle?…&tutorial=1, STORY_SPEC §2.3): Hikari's tips over this UI
  if (params.tutorial === '1') {
    ready.then(() => import('../story/coach.js')).then((m) => {
      if (!destroyed && ctx.renderer) cleanups.push(m.attachCoach(ctx));
    }).catch((e) => console.warn('[battle] tutorial coach failed', e));
  }

  function build() {
    const feed = createFeed(layer);
    ctx.feed = feed;
    if (saveWarning) warnSave(saveWarning);
    const tree = createUpgradeTree(ctx); // [unit-info] before the bar: its cards bind tree holds
    ctx.tree = tree;
    // battle modes + map rules (src/ui/battle/modes.js): the HUD chip and pill, toasts, banners
    const modesUi = createModesBattle(ctx);
    ctx.modes = modesUi;
    const hud = createHud(ctx);
    const bar = createTowerBar(ctx);
    ctx.bar = bar;
    layer.prepend(hud.el);
    layer.append(bar.el);
    const placement = createPlacement(ctx);
    ctx.placement = placement;
    // hero rework: level buys, Move, hero event toasts (src/ui/battle/heroLevels.js)
    const heroLevels = createHeroLevels(ctx, ls);
    ctx.heroLevels = heroLevels;
    ctx.levelUpHero = (shown) => heroLevels.levelUp(shown);
    ctx.startHeroMove = () => placement.startMove();
    const heroW = createHeroWidget(ctx);
    layer.append(heroW.el);
    // the ability bar (bottom right; src/ui/battle/abilityBar.js): co-op casts wait in abilityPending until their
    // command comes back; a tap refused with nothing in reach dims its slot for a moment (abilityRefused)
    ctx.abilityPending = new Map();
    ctx.abilityRefused = new Map();
    // co-op orders in flight: placements, upgrades and sales on their way (src/ui/battle/coopPending.js)
    ctx.coopPending = ls ? createCoopPending() : null;
    const abilityNotes = createAbilityNotes();
    // (a Continue already has its unlocked abilities: no "learned" toast for those)
    abilityNotes.seed(sim.towers.filter((t) => t.abil).map((t) => t.abil.id));
    const abar = createAbilityBar(ctx);
    ctx.abilityBar = abar;
    const boss = createBossBar(ctx);
    const wave = createWaveControl(ctx);
    const panel = createTowerPanel(ctx);
    ctx.panel = panel;
    const pause = createPauseMenu(ctx);
    const results = createResults(ctx);
    const modules = [hud, bar, placement, heroW, abar, boss, wave, panel, pause, results, feed, tree, modesUi];
    ctx.wave = wave;
    let sandbox = null;
    if (req.sandbox) {
      // Sandbox: spawn controls + unlimited lives; nothing from this battle is ever saved
      ctx.preloadEnemies = (fams) => settle(preloadEnemies(fams), MODEL_TIMEOUT_MS);
      ctx.applyResult = () => sandboxOutcome();
      ctx.endSandbox = () => endBattle(false);
      ctx.extraActions = () => [
        { label: 'Back', testid: 'sandbox-back', cta: true, icon: 'back', onClick: () => ctx.quit() },
        { label: 'Retry', testid: 'retry', icon: 'refresh', onClick: () => ctx.restart() },
      ];
      sandbox = createSandboxPanel(ctx);
      modules.push(sandbox);
    }
    if (ls) {
      coopHud = createCoopHud(ctx);
      modules.push(coopHud);
    }
    if (sim.tryout) {
      // Tryout Day (src/ui/battle/tryout.js): tracker, picks, breaks, the Class Photo
      // the run's rewards (src/systems/tryoutRewards.js, §10.1, §12.4): Marbles, the Lunchbox, coins, the Grade, the
      // achievement counters and the Yearbook, once; co-op pays each player from their own save (§11)
      ctx.applyResult = (prof, result, rng) => (ls
        ? applyCoopTryoutResult(prof, result, { slot: ls.mySlot, seed: ls.start.seed, rng })
        : applyTryoutResult(prof, result, { rec: req.tryout, rng }));
      ctx.tryoutAgain = ls ? () => ctx.quit() : () => navigate('tryout', { id: 'class', again: 1 }); // (Back: the hub)
      // Replay this seed: a practice run of the same seed, Grade, length and map (§10.4); solo only
      ctx.tryoutReplay = ls ? null : (code) => navigate('tryout', { id: 'class', code });
      const send = ls
        ? (kind, args) => {
          ls.queue(kind, args);
          return 'queued';
        }
        : (kind, args) => {
          const r = kind === 'mv' ? sim.tryoutMove(0, args[0], args[1] / 1024, args[2] / 1024) : sim.tryoutCommand(0, args[0], args.slice(1));
          if (r?.ok) saver?.markProgress?.({ now: true });
          return r;
        };
      ctx.tryoutUi = createTryoutBattle(ctx, { mySlot: ls ? ls.mySlot : 0, send });
      modules.push(ctx.tryoutUi);
    }
    // (an Extended Day run is not freeplay for the rewards or the banners: its own UI comes with the run, TRYOUT_DAY §20.8)
    if (ls && sim.freeplay && !sim.tryout) {
      // co-op freeplay: banners, the bank at the goal, the Finish vote (src/ui/battle/freeplay.js)
      fpBattle = createFreeplayBattle(ctx, { session, lockstep: ls, homeFamilies: stageFamilies() });
      modules.push(fpBattle);
      ctx.freeplay = fpBattle;
    } else if (soloLedger && sim.freeplay) {
      // solo freeplay from stage prep: the same banners; the bank is a normal solo win
      startSoloFreeplay(modules);
    }

    let renderer;
    try {
      // isPlacing: a bar drag or a tapped card waiting for the board tap holds the camera still
      renderer = createBattleRenderer(stageEl, sim, {
        quality: settings.quality, settings, insets: insets(), isPlacing: () => !!ctx.placement?.unitId, skins: ctx.skins,
        // how far between two sim steps this frame is (drones are drawn between their positions)
        renderAlpha: () => (ls ? Math.min(1, ls.acc) : Math.min(1, sim._acc / STEP)),
      });
    } catch (e) {
      console.error('[battle] renderer failed', e);
      layer.append(h('div.bt-error', h('div.bt-sheet', h('div.bt-sheet-title', 'Graphics unavailable'), h('p', 'WebGL could not start on this device. Try lowering the quality in Settings.'), h('button.bt-cta', { onclick: () => navigate('settings') }, 'Settings'))));
      markShown();
      return;
    }
    ctx.renderer = renderer;
    cleanups.push(renderer.onLongPress((p) => tree.onLongPress(p))); // [unit-info] hold a placed girl → her tree
    // Settings → Battle → Camera (or the pause menu) applies to the open battle at once
    cleanups.push(store.on('change', () => {
      renderer.setCameraMode(cameraModeOf(store.profile.settings));
      renderer.setBuffIcons?.(store.profile.settings.buffIcons);
    }));
    renderer.setBuffIcons?.(settings.buffIcons);
    // keep the toast feed off the spawn gates and the first tiles of road behind them (and,
    // as a tie-break, off the exit gates and the last tiles of road before them)
    const tracks = sim.map?.tracks || [];
    const spawnRuns = tracks.filter((t) => !t.fork).map((t) => t.points.filter((_, i) => i % 5 === 0 && t.cum[i] <= 5.5));
    const exitRuns = tracks.filter((t) => !t.join).map((t) => t.points.filter((_, i) => i % 5 === 0 && t.cum[i] >= t.length - 3.5));
    // the gate props themselves (their feet: a far-edge gate stands up to 2 tiles in from where its lane starts; the
    // lane's ends where the renderer has none), each with the screen depth of its foot and spawn arrow: when both top corners cover a
    // spawn, the feed drops below them
    const propGates = renderer.gates || [];
    const gateFeet = (kind, runEnds) => {
      const own = propGates.filter((g) => g.kind === kind).map((g) => [g.x, g.z]);
      return own.length ? own : runEnds;
    };
    const spawnGates = gateFeet('spawn', tracks.filter((t) => !t.fork).map((t) => t.points[0]));
    const exitGates = gateFeet('goal', tracks.filter((t) => !t.join).map((t) => t.points[t.points.length - 1]));
    feed.setAvoid(() => {
      const L = layer.getBoundingClientRect();
      const out = [];
      // the live spawn gates: a reversed route (Reverse Route, an ambush wave) comes in at the exits
      const pairs = sim.routeReversed ? [[exitRuns, exitGates, 1], [spawnRuns, spawnGates, 0.2]] : [[spawnRuns, spawnGates, 1], [exitRuns, exitGates, 0.2]];
      for (const [runs, gates, w] of pairs) {
        for (const run of runs) {
          for (const [x, y] of run) {
            const p = renderer.worldToScreen(x, y, 0);
            out.push({ x: p.clientX - L.left, y: p.clientY - L.top, w });
          }
        }
        for (const [x, y] of gates) {
          const p = renderer.worldToScreen(x, y, 0);
          const q = renderer.worldToScreen(x, y + 1.4, 0);
          out.push({ x: p.clientX - L.left, y: p.clientY - L.top, w, gate: true, r: Math.abs(q.clientY - p.clientY) });
        }
      }
      return out;
    });

    // ---- context actions -------------------------------------------------------------
    // ---- actions: direct Sim calls in solo, lockstep commands in co-op ----------------------
    // (a successful command is progress: the battle save keeps it)
    const progress = (v) => {
      if (v) saver?.markProgress();
      return v;
    };
    ctx.act = ls ? coopActions() : {
      place: (id, x, y) => progress(sim.placeTower(id, x, y)),
      upgrade: (uid, path) => progress(sim.upgradeTower(uid, path)),
      sell: (uid) => progress(sim.sellTower(uid)),
      target: (uid, mode) => progress(sim.setTargetMode(uid, mode)),
      fly: (uid, mode, a, b) => progress(sim.setFlight(uid, mode, a?.[0], a?.[1], b?.[0], b?.[1])),
      // an aim point (x, y), or null to go back to automatic aim
      aim: (uid, x, y, k = null) => progress(x == null ? sim.clearAim(uid) : sim.setAim(uid, x, y, k)),
      pick: (uid, target) => {
        const r = sim.setBuffPick(uid, target);
        if (r?.ok) saver?.markProgress();
        return r;
      },
      // abilities: a cast ({ ok, reason, casterUid }), one girl's Auto switch, the Auto-cast setting for all of mine
      // (abilityBar.js soloAbilityActs: tests/battle-ui/abilityAuto.test.js)
      ...soloAbilityActs(sim, { mark: () => saver?.markProgress() }),
    };
    ctx.flight = createFlightControl(ctx);
    modules.push(ctx.flight);
    // aim mode (roster B3): a mortar / mirror girl's or Seiran's aim point, one board tap
    ctx.aim = createAimControl(ctx);
    modules.push(ctx.aim);

    // ---- pick mode: choose who Midori brews / Chika tunes up first (spec §4.4) ------------
    ctx.picking = null;
    ctx.startPick = (srcUid) => {
      const src = sim.getTower(srcUid);
      if (!src || ctx.ended) return;
      if (ctx.coop && !ctx.coop.isMine(srcUid)) {
        feed.push(PICK_REFUSED.notYours, 'warn', { key: 'pick-refused', ms: 1600 });
        return;
      }
      if (ctx.flight.active) ctx.flight.cancel();
      // one board-tap mode at a time: an ability aim (or Set aim) ends, so the pick tap is never an ability's
      if (ctx.aim?.active) ctx.aim.cancel();
      const r = limitedRange(src);
      const cands = sim.towers.filter((o) => o.uid !== srcUid && !o.removed && (o.x - src.x) ** 2 + (o.y - src.y) ** 2 <= r * r).map((o) => o.uid);
      ctx.picking = srcUid;
      renderer.setBuffPick?.(srcUid, cands);
      shell.classList.add('bt-picking');
      feed.push(cands.length ? `Tap the girl ${src.def.name} should ${src.stats?.brew ? 'brew' : 'tune up'} first.` : 'No girl in her reach yet.', 'info', { key: 'pick-mode', ms: 2000 });
      panel.update();
    };
    ctx.cancelPick = () => {
      if (ctx.picking == null) return;
      ctx.picking = null;
      renderer.setBuffPick?.(null);
      shell.classList.remove('bt-picking');
      panel.update();
    };
    /** Sends a pick (solo: at once; co-op: the 'pick' command) and says what happened. */
    ctx.sendPick = (srcUid, targetUid) => {
      const src = sim.getTower(srcUid);
      const tgt = targetUid >= 0 ? sim.getTower(targetUid) : null;
      const res = ctx.act.pick?.(srcUid, targetUid);
      if (res === 'queued') return true;
      if (!res?.ok) {
        feed.push(PICK_REFUSED[res?.reason] || 'She cannot pick that girl.', 'warn', { key: 'pick-refused', ms: 1800 });
        return false;
      }
      if (src && tgt) feed.push(pickText(src, tgt), 'good', { key: 'pick-ok', ms: 1800 });
      else if (src) feed.push(`${src.def.name} picks the strongest girl again.`, 'info', { key: 'pick-ok', ms: 1600 });
      panel.update();
      return true;
    };

    // select(girl, { drone }): a drone of hers can be shown too (tapped on the field or in her list)
    ctx.select = (uid, { drone = null } = {}) => {
      if (ctx.ended && uid != null) return;
      if (ctx.picking != null && uid !== ctx.selectedUid) ctx.cancelPick();
      if (uid != null && placement.unitId) placement.cancel();
      ctx.selectedUid = uid ?? null;
      ctx.selectedDrone = ctx.selectedUid != null ? drone : null;
      renderer.setSelected(ctx.selectedUid, ctx.selectedDrone);
      if (ctx.selectedUid == null) panel.close();
      else panel.open(ctx.selectedUid, { drone: ctx.selectedDrone });
      shell.classList.toggle('bt-has-panel', ctx.selectedUid != null);
      renderer.setPanelCover?.(panelCover());
    };
    /**
     * The part of the board the info panel covers (CSS px from the board's right / bottom edge):
     * the renderer slides the view so the selected girl's range ring stays beside the panel.
     * Offsets, not getBoundingClientRect: the panel's slide-in animation must not count.
     */
    function panelCover() {
      const el = panel.el;
      if (ctx.selectedUid == null || el.hidden || !el.offsetParent) return { right: 0, bottom: 0 };
      const board = renderer.canvas.getBoundingClientRect();
      const host = el.offsetParent.getBoundingClientRect();
      const left = host.left + el.offsetLeft;
      const top = host.top + el.offsetTop;
      // a side panel (landscape) covers the right; a bottom sheet (narrow screens) the bottom
      if (el.offsetWidth < board.width * 0.75) return { right: Math.max(0, board.right - left), bottom: 0 };
      return { right: 0, bottom: Math.max(0, board.bottom - top) };
    }
    ctx.selectDrone = (d) => {
      ctx.selectedDrone = d ?? null;
      renderer.setSelected(ctx.selectedUid, ctx.selectedDrone);
    };
    ctx.onCardTap = (unitId) => {
      if (ctx.ended || ctx.paused) return;
      if (placement.unitId === unitId) placement.cancel();
      else placement.start(unitId);
      bar.update();
    };
    ctx.onPlaced = (t) => {
      navigator.vibrate?.(12);
      if (t.isHero) feed.push(`${t.def.name} takes the field! She levels up through the battle. Tap her to buy levels.`, 'good', { ms: 2600 });
      bar.update();
      // connect the drawn card to her chibi: the card glows and a name tag with her drawn bust
      // pops over the spot where she landed
      bar.flash?.(t.def?.id);
      deployTag(t);
    };
    const deployTag = (t) => {
      try {
        const p = ctx.renderer?.worldToScreen?.(t.x, t.y, 1.25);
        if (!p?.visible || !t.def) return;
        const lr = layer.getBoundingClientRect();
        const tag = h('div.bt-deploy-tag', { 'aria-hidden': 'true', style: { left: `${Math.round(p.clientX - lr.left)}px`, top: `${Math.round(p.clientY - lr.top)}px` } },
          svgEl(portraitHTML(t.def, 'thumb', { eager: true }), 'bt-deploy-art'), h('b', t.def.name));
        layer.append(tag);
        setTimeout(() => tag.remove(), 1800);
      } catch (e) {
        console.warn('[battle] deploy tag failed', e);
      }
    };
    ctx.onUpgraded = (t, path) => {
      const tier = t.tiers[path];
      const name = t.def.paths[path]?.tiers[tier - 1]?.name;
      feed.push(`${t.def.name} · ${name}`, 'good', { ms: 1600, key: `upg-${t.uid}-${path}-${tier}` });
      navigator.vibrate?.(8);
    };
    ctx.cycleSpeed = () => {
      const speeds = BATTLE.speeds || [1, 2, 3];
      const next = speeds[(speeds.indexOf(ctx.speed) + 1) % speeds.length];
      if (ls) ls.queue('speed', [next]); // shared: both players switch at the same tick
      else ctx.speed = next;
    };
    // a set speed (the Sandbox panel's 0.5-5×); attachBattleAudio follows it like cycleSpeed
    ctx.setSpeed = (s) => {
      if (ls) ls.queue('speed', [s]);
      else ctx.speed = s;
    };
    ctx.setAutoStart = (v) => {
      store.profile.settings.autoStart = !!v;
      store.commit('settings');
      if (ls) {
        ls.queue('auto', [!!v]);
        return;
      }
      sim.options.autoStart = !!v;
      if (v && sim.state === 'between') ctx.startWave();
      wave.update();
    };
    ctx.startWave = () => {
      if (ctx.ended) return;
      if (ls) {
        // one 'wave' order in flight at a time (a double tap must not send two waves); once its
        // tick has run it is spent, so a wave that started and ended between two frames (a hidden
        // tab, a slow page) never leaves NEXT WAVE / GO BEYOND dead
        const inFlight = pendingWave && ls.tick <= pendingWave.t;
        if ((sim.state === 'prep' || sim.state === 'between') && !inFlight) pendingWave = ls.queue('wave', []);
        if (ctx.paused) ctx.closePause();
        return;
      }
      saver?.beforeWave?.(); // (a run: the exact calm state just before the wave)
      if (sim.startNextWave()) {
        if (ctx.paused) ctx.closePause();
      }
      saver?.persistPending(); // the calm state just before this wave: what Continue gets
      wave.update();
    };
    ctx.fireUlt = () => {
      const st = sim.heroUltStatus();
      if (!sim.hero) return;
      if (!st.unlocked) {
        feed.push(`Ultimate unlocks at hero level ${st.unlockLevel ?? 3}.`, 'warn', { key: 'ult-locked', ms: 1600 });
        return;
      }
      if (!st.ready) {
        feed.push(sim.state === 'wave' ? `Recharging — ${Math.ceil(st.cooldownLeft)}s` : 'The ultimate only charges during waves.', 'warn', { key: 'ult-cd', ms: 1400 });
        return;
      }
      // Norika's Hold the Line works only during a wave (src/sim/hero.js): say so instead of a silent tap
      if (sim.state !== 'wave' && sim.hero?.def?.hero?.ult?.effect?.type === 'barricade') {
        feed.push(`${sim.hero.def.hero.ult.name} works during a wave.`, 'warn', { key: 'ult-wave', ms: 1600 });
        return;
      }
      if (ls) {
        ls.queue('ult', []); // each player fires her own hero's ult
        return;
      }
      if (sim.activateUlt()) saver?.markProgress();
    };
    ctx.paintUltButton = (btn, opts) => paintUltButton(btn, sim.heroUltStatus(), opts);

    // ---- abilities (ABILITIES_SPEC §8): cast, refusal toasts, Auto, the hero's Lv 7 skill ----------------
    const hoverDevice = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
    /** A refused cast's quiet toast (one per reason at a time); nothing in reach also dims the slot a moment. */
    ctx.abilityRefusal = (reason, casterUid = null, uid = null) => {
      const t = sim.getTower(casterUid ?? uid);
      const st = t ? sim.abilityStatus(t.uid) : null;
      const name = st ? abilityText(st.id)?.name : null;
      const unlock = st && !st.unlocked ? (st.unlockLevel ? `hero LV ${st.unlockLevel}` : `tier ${st.unlockTier}`) : null;
      feed.push(refusalText(reason, { secondsLeft: st?.cooldownLeft, name, unlock }), 'info', { key: `abil-${reason}`, ms: 1400 });
      if (reason === 'noTarget' && st?.id) ctx.abilityRefused.set(st.id, { reason, until: performance.now() + REFUSED_MS });
      abar.refresh();
    };
    /**
     * Fires girl `uid`'s ability: { group } = the best ready copy of hers (the bar), { aim } = [x, y] in tiles (an
     * aimed ability). Solo: at once; co-op: the `abil` command (the slot spins until it comes back). Your own casts
     * show no toast: the FX speak.
     */
    ctx.castAbility = (uid, { group = true, aim = null } = {}) => {
      if (ctx.ended || !sim.getTower(uid)) return null;
      const res = ctx.act.ability?.(uid, { group, aim });
      abar.refresh();
      if (res === 'queued') return res;
      if (!res?.ok) {
        ctx.abilityRefusal(res?.reason, res?.casterUid, uid);
        return res;
      }
      navigator.vibrate?.(10);
      panel.update();
      return res;
    };
    // ctx.setAbilityAuto(uids, on): one slot's copies (the hold card) or one girl's panel row; ctx.setAutoAbilities(on):
    // Settings → Auto-cast abilities, live from the pause menu (every girl of mine and the ones that unlock later)
    Object.assign(ctx, abilityAutoControls(ctx, {
      store,
      refresh: () => {
        abar.refresh();
        panel.update();
      },
    }));
    /** E / the skill button: the hero's Lv 7 skill (heroWidget skillKeyAction: a skill that waits never promises a level). */
    ctx.fireSkill = () => {
      const hero = sim.hero;
      if (!hero || ctx.ended) return;
      const act = skillKeyAction(sim.abilityStatus(hero.uid));
      if (act.toast) feed.push(act.toast, 'warn', { key: 'skill-locked', ms: 1600 });
      if (act.cast) ctx.castAbility(hero.uid, { group: false });
    };
    ctx.bump = () => {
      const c = hud.el.querySelector('.bt-cash');
      if (!c) return;
      c.classList.remove('bt-poor-flash');
      void c.offsetWidth;
      c.classList.add('bt-poor-flash');
    };
    ctx.openPause = () => {
      if (ctx.ended) return;
      placement.cancel();
      ctx.paused = true;
      pause.show();
      shell.classList.add('bt-paused');
    };
    ctx.closePause = () => {
      ctx.paused = false;
      pause.hide();
      shell.classList.remove('bt-paused');
      lastT = performance.now();
    };
    // Restart / Retry: a new battle from wave 1 (this run's save is deleted first)
    ctx.restart = () => {
      saver?.discard();
      hooks.restart({ fresh: true });
    };
    // a run cannot restart: Restart gives it up and goes back to Tryout Day
    if (req.tryout && !ls) ctx.restart = () => {
      // giving up pays what the run banked (§12.4): results.apply() pays and deletes the run in one write
      // (idempotent: a run already paid at its end is not paid again)
      ctx.ended = true;
      saver?.close();
      results.apply();
      navigate('tryout');
    };
    // endless runs save, so they can also be cashed out: the same payout as a defeat right now
    ctx.endRun = saver && sim.endless ? () => endBattle(false, { endedRun: true }) : null;
    // every way out of a battle goes through navigate(), which never leaves the battle's history
    // entry behind (src/ui/router.js): neither the back arrow nor the back gesture returns here.
    // Leaving saves the battle (destroy() → saver.flush()); a solo freeplay run is never saved and
    // is paid on the way out once past its goal (destroy() → payIfLeavingRun()). A Sandbox run
    // (never saved) goes back to its squad screen.
    ctx.quit = () => (ls ? leaveCoop() : req.tryout ? navigate('tryout') : req.sandbox ? navigate('sandbox', { id: 'team' }) : params.clanBoss ? navigate('clan', { tab: 'boss' }) : req.titan ? navigate('titans', { id: req.titan.id }) : navigate('stage', prepRoute));
    ctx.goNext = (id) => navigate('stage', { id });
    ctx.goMap = () => {
      if (req.sandbox) return navigate('sandbox');
      if (req.titan) return navigate('titans', { id: req.titan.id });
      if (req.tryout) return navigate('tryout');
      const r = mapRouteFor(stage, { endless: endlessMap });
      navigate(r.name, r.params);
    };
    ctx.goHome = () => navigate('lobby');

    // ---- input ------------------------------------------------------------------------
    cleanups.push(renderer.onTap((p) => {
      if (ctx.paused || ctx.ended) return;
      hud.scout.destroy();
      const drone = p.droneUid != null ? sim.findDrone(p.droneUid) : null;
      const tapped = drone ? drone.tower.uid : p.towerUid != null ? p.towerUid : null;
      if (ctx.picking != null) {
        // pick mode: a girl (or one of her drones) → she is the pick; empty ground → leave pick mode
        const src = ctx.picking;
        ctx.cancelPick();
        if (tapped != null && tapped !== src) ctx.sendPick(src, tapped);
        else if (tapped === src) feed.push(PICK_REFUSED.self, 'warn', { key: 'pick-refused', ms: 1400 });
        return;
      }
      if (ctx.tryoutUi?.handleTap(p)) return;
      if (ctx.aim.handleTap(p) || ctx.flight.handleTap(p) || placement.handleTap(p)) return;
      ctx.select(tapped, { drone: drone ? p.droneUid : null });
    }));
    const onCanvasMove = (e) => {
      if (e.pointerType === 'mouse' && !e.buttons) placement.hover(e.clientX, e.clientY);
    };
    renderer.canvas.addEventListener('pointermove', onCanvasMove);
    cleanups.push(() => renderer.canvas.removeEventListener('pointermove', onCanvasMove));
    let keyNav = false; // the keyboard (Tab) put the focus where it is, not a pointer
    ctx.keyFocus = () => keyNav;
    const onKey = (e) => {
      // typing in a field or choosing in a list (the Sandbox enemy picker) is not a battle shortcut
      const typing = !!e.target?.closest?.('input, select, textarea') || !!document.querySelector('.modal-overlay');
      // (the upgrade tree open: only Esc; in co-op it does not pause, and nothing may fire blind behind it)
      // (Space on a drawer control the keyboard focused presses it, never the wave as well: the M4 review. After a
      // click on one, Space still starts the wave, and its preventDefault keeps the clicked button from a second press)
      const control = e.defaultPrevented || (keyNav && !!e.target?.closest?.('.bt-panel button, .bt-panel [role="button"], .bt-panel [tabindex]'));
      const act = battleKeyAction(e, { paused: ctx.paused, typing, blocked: !!ctx.tree?.isOpen, control });
      if (!act) return;
      switch (act.do) {
        case 'escape':
          if (ctx.picking != null) ctx.cancelPick();
          else if (ctx.aim.active) ctx.aim.cancel();
          else if (ctx.flight.active) ctx.flight.cancel();
          else if (placement.unitId) placement.cancel();
          else if (ctx.selectedUid != null) ctx.select(null);
          else if (ctx.paused) ctx.closePause();
          else ctx.openPause();
          break;
        case 'wave':
          e.preventDefault();
          ctx.startWave();
          break;
        case 'speed':
          ctx.cycleSpeed();
          break;
        case 'ult':
          ctx.fireUlt();
          break;
        case 'level':
          // L buys the level the pill shows (its level and price), so a held key cannot overshoot
          if (sim.hero) ctx.levelUpHero(heroW.shown);
          break;
        case 'skill':
          ctx.fireSkill();
          break;
        case 'ability':
          // 1–9: ability slots (a key is deliberate: it fires even while a card is armed)
          abar.fireSlot(act.slot, { key: true });
          break;
        case 'card': {
          // Shift+1–9: arm tower-bar cards (they used to be 1–9)
          const ids = [...bar.el.querySelectorAll('.bt-card')].map((c) => c.dataset.unit);
          const id = ids[act.index];
          if (id) ctx.onCardTap(id);
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    cleanups.push(() => window.removeEventListener('keydown', onKey));
    // how the focus last arrived: Tab (the keyboard) or a pointer (ctx.keyFocus; the drawer's rows read it too)
    const onNavKey = (e) => {
      if (e.key === 'Tab') keyNav = true;
    };
    const onNavPointer = () => {
      keyNav = false;
    };
    window.addEventListener('keydown', onNavKey, true);
    window.addEventListener('pointerdown', onNavPointer, true);
    cleanups.push(() => {
      window.removeEventListener('keydown', onNavKey, true);
      window.removeEventListener('pointerdown', onNavPointer, true);
    });

    // ---- layout: keep the map framed between HUD and tower bar --------------------------
    function insets() {
      const r = shell.getBoundingClientRect();
      const top = (hud.el.getBoundingClientRect().bottom - r.top) || 56;
      const bottom = (r.bottom - bar.el.getBoundingClientRect().top) || 90;
      return { top: Math.max(0, top + 4), bottom: Math.max(0, bottom + 2), left: 0, right: 0 };
    }
    const ro = new ResizeObserver(() => {
      renderer.setInsets(insets());
      renderer.setPanelCover?.(panelCover());
    });
    ro.observe(hud.el);
    ro.observe(bar.el);
    ro.observe(shell);
    ro.observe(panel.el);
    cleanups.push(() => ro.disconnect());

    // ---- tab visibility: stop the loop while hidden ---------------------------------------
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        if (sim.state === 'wave' && !ctx.ended && !ctx.paused && !ls) ctx.openPause();
        // the store's own listener ran first (registered at boot): write the battle save now
        if (!ctx.ended) saver?.flush();
      } else if (!raf && !destroyed) {
        lastT = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    cleanups.push(() => document.removeEventListener('visibilitychange', onVis));
    if (saver) {
      // closing the tab, a phone killing the app, the page frozen in the background
      const onHide = () => {
        if (!ctx.ended) saver.flush();
      };
      window.addEventListener('pagehide', onHide);
      document.addEventListener('freeze', onHide);
      cleanups.push(() => {
        window.removeEventListener('pagehide', onHide);
        document.removeEventListener('freeze', onHide);
      });
    }

    // ---- events from the sim (via renderer.update) ------------------------------------------
    // (Continue: enemies met before the save are not "new" again)
    const announcedNew = new Set(restored ? sim.encountered : []);
    let lastWaveEnd = 0;
    /** map rule warnings that matter most (route, mode) lead; affinity follows the sim's */
    const ruleFirst = (ws) => ws.filter((w) => w.kind !== 'affinity').concat(ws.filter((w) => w.kind === 'affinity'));
    function warnFor(n) {
      let list = [];
      try {
        list = sim.waveWarnings(n);
      } catch {
        return;
      }
      for (const w of list) if (w.kind === 'new') for (const id of [w.enemyId, ...(w.enemyIds || [])]) if (id) announcedNew.add(id);
      list = [...ruleFirst(ctx.modes?.warnings(n) || []), ...list];
      for (const w of list.slice(0, 3)) {
        const kind = w.severity === 'danger' ? 'bad' : w.severity === 'warn' ? 'warn' : 'info';
        feed.push(heroWarnText(sim, w.text), kind, { key: `warn-${n}-${w.kind}-${w.enemyId || w.trait || ''}`, ms: 5200, icon: w.trait && TRAITS[w.trait] ? traitBadge(w.trait, 'bt-toast-ico') : null });
      }
    }

    function handle(events) {
      heroLevels.handle(events);
      abar.handle(events);
      for (const ev of events) {
        fpBattle?.handle(ev);
        ctx.modes?.handle(ev);
        switch (ev.type) {
          case 'abilityUnlock': {
            // the first time each ability unlocks in this battle: say how to fire it (your own girls only)
            const t = sim.getTower(ev.towerUid);
            if (!t || (ctx.coop && !ctx.coop.isMine(t.uid)) || !abilityNotes.firstUnlock(ev.id)) break;
            const name = abilityText(ev.id)?.name || 'a new ability';
            const slot = t.isHero ? -1 : sim.abilitySlots(ctx.coop ? ctx.coop.mySlot : 0).findIndex((s) => s.id === ev.id);
            const key = slot >= 0 && slot < 9 ? String(slot + 1) : null;
            // one line led by the bolt: "Skyfall Volley: tap Aoi, bottom right" (the name in bold; a ⚡ in the words
            // is the kit bolt, never the colour emoji). On a phone the feed docks left of an open panel (battle.css).
            const words = unlockText(t.def.name, name, { hover: hoverDevice, key, hero: !!t.isHero });
            feed.push([h('b', name), ...boltText(words.slice(name.length))], 'good', { key: `abil-unlock-${ev.id}`, ms: 2400, icon: ico(KIT_SVG.bolt, 'bt-toast-ico.bt-toast-bolt') });
            break;
          }
          case 'ability': {
            // co-op: the ally's cast is a small chip (at most one per 3 s); your own casts: no toast
            if (!ctx.coop) break;
            const t = sim.getTower(ev.towerUid);
            if (!t || ctx.coop.isMine(t.uid) || !abilityNotes.allyChip()) break;
            feed.push(allyChipText(ctx.coop.ownerName(t.uid), t.def.name, abilityText(ev.id)?.name || 'her ability'), 'info', { key: 'ally-abil', ms: 1600 });
            break;
          }
          case 'lifeRestored': {
            // a life an ability brought back (Noa's First Aid Call; both players see it: lives are shared). The other
            // lives (Chigusa's harvest, Wakaba's Recovery Plan) keep their quiet heart in the HUD.
            if (!ev.id) break;
            const t = sim.getTower(ev.towerUid);
            feed.push(lifeText(t?.def.name || 'A girl', abilityText(ev.id)?.name || 'her ability', ev.n || 1), 'good', { key: `life-${ev.towerUid}`, merge: true, ms: 1800 });
            break;
          }
          case 'leak': {
            const name = enemyDef(ev.id)?.name || ev.id;
            feed.push(`${name} slipped through`, 'bad', { key: `leak-${ev.id}`, merge: true, ms: 2600 });
            if (ev.lives > 0) navigator.vibrate?.(20);
            break;
          }
          case 'spawn': {
            const def = enemyDef(ev.id);
            if (!def) break;
            // freeplay: the big ribbon only on a boss's first appearance (then "… returns!")
            if ((def.tier === 'boss' || def.tier === 'miniboss') && !fpBattle?.onBossSpawn(def)) {
              feed.announce(def.tier === 'boss' ? 'BOSS INCOMING' : 'MINIBOSS', def.name, 'boss', 2600);
            }
            if (!knownEnemies.has(ev.id) && !announcedNew.has(ev.id) && def.leak !== 0) {
              announcedNew.add(ev.id);
              const traits = Object.keys(def.traits || {}).filter((k) => def.traits[k]);
              // the enemy's defining rule: its first trait, else visible armour
              const trait = traits.find((k) => TRAITS[k]) || (def.armor > 0 && TRAITS.armored ? 'armored' : null);
              feed.push([`New enemy: `, h('b', def.name), trait && TRAITS[trait] ? ` — ${TRAITS[trait].name}` : ''], 'new', { ms: 4200, icon: trait && TRAITS[trait] ? traitBadge(trait, 'bt-toast-ico') : null });
            }
            break;
          }
          case 'waveStart':
            if (supportPays({ wave: ev.wave })) settleSupport(); // [friend support] FP once the run reached wave 3
            // freeplay waves past the goal: their own banners (freeplay.js)
            if (fpBattle && ev.wave > sim.totalWaves) break;
            // (Tryout Day's Extended Day past wave 48: "Stay Late", never "of 48", §20.8)
            feed.announce(`WAVE ${ev.wave}`, ctx.modes?.waveSub(ev) ?? (extendedPast(sim, ev.wave) ? EXTENDED_TEXT.waveSub : isExtendedRun(sim) && ev.wave === sim.totalWaves ? EXTENDED_TEXT.fullLast : Number.isFinite(sim.totalWaves) ? (ev.wave === sim.totalWaves ? (fpBattle ? 'The last stage wave — clear it to go beyond!' : 'Final wave!') : `of ${sim.totalWaves}`) : 'Endless'), ev.flipped ? 'warn' : 'wave', ev.flipped ? 2200 : 1300);
            break;
          case 'waveEnd':
            // a sandbox spawn between waves runs as a wave of its own (the counter stays)
            if (req.sandbox && ev.wave === lastWaveEnd) feed.push('Sandbox group cleared', 'good', { key: 'sbx-group', ms: 1600 });
            else feed.push(`Wave ${ev.wave} cleared · +${fmtNum(ev.bonus || 0, 'money')} coins`, 'good', { ms: 2200 });
            lastWaveEnd = ev.wave;
            if (sim.state !== 'won') later(() => warnFor(sim.wave + 1), 400);
            break;
          case 'goal':
            // Tryout Day's Extended Day cleared the Full Day's 48 waves: the Stay Late banner (the day goes on, §20.8)
            if (ev.stayLate) feed.announce(EXTENDED_TEXT.stayLate.toUpperCase(), EXTENDED_TEXT.stayLateSub, 'free', 2600);
            break;
          case 'bossPhase':
            feed.announce('PHASE SHIFT', ev.announce || '', 'phase', 3200);
            break;
          // heroLevel / heroBuy / heroMastery / ult: heroLevels.handle (attributed by towerUid)
          case 'teleportWarn':
            feed.push('A ghoul is about to blink forward — slow or stun it!', 'warn', { key: 'blink', ms: 2000 });
            break;
          case 'sabotage': {
            const t = sim.getTower(ev.towerUid);
            if (ev.turretUid != null) feed.push(`A saboteur jammed one of ${t?.def.name || 'her'}'s drones!`, 'warn', { key: 'jam', ms: 1800 });
            else feed.push(`${t?.def.name || 'A girl'} was sabotaged! Cleanse auras protect.`, 'warn', { key: 'sabotage', ms: 2200 });
            break;
          }
          case 'sell':
            if (ctx.selectedUid === ev.towerUid) ctx.select(null);
            break;
          case 'won':
            endBattle(true);
            break;
          case 'lost':
            endBattle(false);
            break;
          default:
            break;
        }
      }
    }

    /** Ends the battle when the Sim is over but endBattle never ran (see frame()). */
    function settleFinished() {
      if (!ctx.ended && (sim.state === 'won' || sim.state === 'lost')) endBattle(sim.state === 'won');
    }
    ctx.settleFinished = settleFinished;

    /** @param {{ endedRun?: boolean }} [o] endedRun: the player cashed out an endless run (End run) */
    function endBattle(won, { endedRun = false } = {}) {
      if (ctx.ended) return;
      ctx.ended = true;
      if (won) settleSupport(); // [friend support] a shorter stage won
      ctx.endedRun = endedRun;
      saver?.close(); // no more save writes: results.apply() pays out and deletes the save at once
      placement.cancel();
      ctx.select(null);
      pause.hide();
      ctx.paused = false;
      shell.classList.add('bt-ended');
      if (req.sandbox) {
        // ended from the panel, or the lives ran out with lives switched on (nothing is saved)
        results.apply();
        feed.announce('SANDBOX', sim.state === 'lost' ? `Fell on wave ${sim.wave}` : 'Session over', 'wave', 900);
        later(() => results.showSandbox(), 700);
        return;
      }
      // co-op freeplay past the goal: its own sheet (finishing right at the goal is a plain victory)
      const fpEnd = isFreeplayRun();
      if (fpEnd) fpBattle?.onEnd();
      if (fpEnd) feed.announce(won ? 'FREEPLAY COMPLETE' : 'FREEPLAY OVER', `${sim.wavesCleared}/${sim.totalWaves} · ${sim.stage.freeplay.name}`, won ? 'good' : 'free', RESULT_DELAY_MS - 200);
      else if (endedRun) feed.announce('RUN OVER', `Ended on wave ${sim.wave}`, 'bad', RESULT_DELAY_MS - 200);
      // (an Extended Day past the Full Day ends as Home Time, never a defeat)
      else if (sim.tryout && (sim.finished || extendedPast(sim))) feed.announce(EXTENDED_TEXT.homeTime.toUpperCase(), EXTENDED_TEXT.reachedWave(sim.wave, sim.tryout.periods.length), 'free', RESULT_DELAY_MS - 200);
      else feed.announce(won ? 'STAGE CLEAR!' : 'DEFEAT', won ? `${sim.lives}/${sim.maxLives} lives left` : `Fell on wave ${sim.wave}`, won ? 'good' : 'bad', RESULT_DELAY_MS - 200);
      if (req.tryout) {
        // the Make-up Test (solo, once a run, §7): at 0 hearts the defeat sheet offers the wave again from its start
        // (the record keeps the calm snapshot before it and the open wave: the Continue spends the Make-up Test)
        // (never after Home Time: sim.finish() ends a run as 'lost' with sim.finished, by choice, not by hearts)
        if (!ls && !won && !sim.finished && tryRec && !tryRec.makeUpUsed && !tryRec.practice && tryRec.snap && tryRec.waveOpen === sim.wave) {
          ctx.saver?.close();
          ctx.makeUpOffered = true;
          later(() => ctx.tryoutUi?.showMakeUp({
            wave: sim.wave,
            retry: () => navigate('tryout', { makeup: tryRec.id }), // (the hub opens it as Continue does)
            giveUp: () => {
              ctx.makeUpOffered = false;
              const out = results.apply(); // (pays the run and closes its record: saver.finish)
              ctx.tryoutUi?.showPhoto({ practice: !!req.practice, outcome: out });
            },
          }), RESULT_DELAY_MS);
          return;
        }
        // Tryout Day: the run is paid (src/systems/tryoutRewards.js) and its record goes in the same write
        const out = results.apply();
        later(() => ctx.tryoutUi?.showPhoto({ practice: !!req.practice, outcome: out }), RESULT_DELAY_MS);
        return;
      }
      if (req.titan) {
        // Titan Trials: the result is the titan's damage notch, read outside the sim
        titanTracker.consume(sim.drainEvents(), sim);
        results.apply();
        later(() => results.showTitan(), RESULT_DELAY_MS);
        return;
      }
      results.apply();
      if (params.clanBoss) submitClanBoss();
      later(() => (fpEnd ? results.showFreeplay() : won ? results.showVictory() : results.showDefeat()), RESULT_DELAY_MS);
    }

    // ---- solo: Keep going (a won normal run goes on as freeplay on `tier`) --------------------
    ctx.canKeepGoing = () => !!soloLedger && req.keepGoing && !sim.freeplay && sim.state === 'won' && sim.wavesCleared === sim.totalWaves;
    ctx.keepGoing = (tier) => {
      if (!ctx.canKeepGoing()) return false;
      const out = results.outcome || results.apply();
      if (out?.practice || out?.error) return false;
      if (!continueIntoFreeplay(sim, tier)) return false;
      rememberSoloTier(tier);
      // the win deleted this run's battle save (results.apply → saver.finish) and freeplay runs are
      // never saved: from here the pause menu offers a plain Quit (which pays the freeplay part) and
      // the run's end rolls its own drops, not the saved run's seeded ones
      ctx.saver = null;
      // the win just paid is the freeplay bank: the run's end pays only the freeplay part
      soloLedger.bank = { ...out, clear: true, banked: { goal: sim.totalWaves, kills: { ...sim.kills }, encountered: [...sim.encountered] } };
      soloLedger.fx.add('goal');
      results.reset();
      ctx.ended = false;
      shell.classList.remove('bt-ended');
      startSoloFreeplay(ctx.modules);
      // the victory ended the music: start it again for the run
      try {
        ctx.audio?.destroy();
        ctx.audio = attachBattleAudio(ctx);
      } catch (e) {
        console.warn('[battle] audio restart failed', e);
      }
      lastT = performance.now();
      feed.announce('KEEP GOING', `Freeplay · ${sim.stage.freeplay.name} — ${sim.totalWaves + 1}/${sim.totalWaves} next`, 'free', 2200);
      wave.update();
      hud.update();
      return true;
    };

    // ---- main loop ----------------------------------------------------------------------
    let lastT = performance.now();
    /** The first frame is drawn: the loading screen may go (its progress line is full). */
    let firstFrame = () => {
      firstFrame = null;
      setLoaderProgress(1);
      markShown();
    };
    function frame(now) {
      raf = requestAnimationFrame(frame);
      // a finished Sim whose 'won' / 'lost' event never reached handle() (a render or handler
      // error dropped it) still ends the battle: paid, and its save deleted, never left to rewind
      settleFinished();
      const frameT = lastT;
      const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
      lastT = now;
      // co-op never pauses: both clients advance the shared Lockstep (its own speed + horizons)
      const running = ls ? !ctx.ended : !ctx.paused && !ctx.ended;
      if (ls) {
        // real elapsed time (up to 0.25 s): a slow device keeps pace with its ally instead of
        // running the shared battle in slow motion (Lockstep caps its own catch-up per frame)
        if (!ctx.ended) ls.advance(Math.min(0.25, Math.max(0, (now - frameT) / 1000)));
        ctx.speed = ls.coop.speed;
        coopHud?.update();
        // an order that never came back (voided by a rejoin) stops waiting after a while: its ghost goes too
        const rev = ctx.coopPending?.rev;
        ctx.coopPending?.reserved();
        if (ctx.coopPending && ctx.coopPending.rev !== rev) ctx.placement?.landed?.();
      } else if (running) {
        sim.update(dt * ctx.speed);
        saver?.persistPending(); // a wave auto-started inside that step: save its calm start
        saver?.persistCalm(); // a wave ended in that step: keep it (once per wave)
      }
      let events = [];
      // while a full-screen sheet (results / pause) covers the map, skip the 3D frame (battery)
      if (results.open || (pause.open && !ls) || ctx.tree?.pausedByTree) return firstFrame?.(); // [unit-info] solo tree: frozen frame
      try {
        renderer.setTimeScale?.(ctx.speed); // [attackFx] drones keep pace at 2×/3× (co-op: shared speed)
        events = renderer.update(running ? dt : ctx.ended ? dt : 0);
      } catch (e) {
        console.error('[battle] render failed', e);
      }
      firstFrame?.();
      ctx.audio?.events(events); // [audio]
      // (before handle(): a 'won' / 'lost' in this batch ends the battle and pays the titan's notch)
      titanTracker?.consume(events, sim);
      handle(events);
      fpBattle?.update();
      sampleDroneRates(sim, ctx.rates);
      ctx.flight.update();
      ctx.modes?.update();
      hud.update();
      bar.update();
      panel.update();
      heroW.update();
      // a card armed or dragged: the ability bar fades and ignores taps (battle.css .bt-placing)
      shell.classList.toggle('bt-placing', !!placement.unitId);
      abar.update();
      boss.update(dt);
      wave.update();
      sandbox?.update();
      if (ctx.tryoutUi) {
        ctx.tryoutUi.update();
        bar.sync?.();
      }
    }
    raf = requestAnimationFrame(frame);

    // first-wave scouting + practice notice (Continue: a welcome back first, kept on screen
    // (sticky), then the next wave's scouting once it has been read; the NEXT strip has it too)
    later(() => warnFor(restored ? sim.wave + 1 : 1), restored ? 4600 : 600);
    // wave 0: her card is armed, so one tap on the grass places her (co-op: once the room ticks).
    // Not in the coached tutorial (its coach places Aoi first and Hikari after wave 1).
    const heroId = sim.heroConfig?.unitId;
    const armHero = () => {
      if (!heroId || sim.hero || ctx.ended || ctx.tutorial || sim.wave > 0 || placement.unitId) return;
      if (ls && ls.tick <= 0) {
        later(armHero, 300);
        return;
      }
      if (placement.start(heroId)) {
        bar.update();
        feed.push(`${sim.data.unit(heroId)?.name || 'Your hero'} deploys free — tap the grass!`, 'info', { key: 'hero-free', ms: 3400 });
      }
    };
    later(armHero, 700);
    if (req.practice) feed.push(req.practiceNote || 'Practice run: this stage is still locked on your map, so nothing from this battle is saved.', 'info', { ms: 4200 });
    if (restored) {
      // a hero saved before the hero rework: back at her level, what she cost back as coins
      const heroBack = (restored.heroRefunds || []).reduce((a, x) => a + x.refunded, 0);
      if (restored.dropped.length) {
        const names = [...new Set(restored.dropped.map((id) => UNIT_MAP[id]?.name || id))];
        const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
        feed.push(`After the update, ${who} couldn't return to ${names.length > 1 ? 'their spots' : 'her spot'}. ${fmtNum(restored.refunded - heroBack, 'money')} coins refunded.`, 'warn', { key: 'save-refund', ms: 8000, sticky: true });
      }
      for (const x of restored.heroRefunds || []) {
        const name = UNIT_MAP[x.unitId]?.name || x.unitId;
        const coins = x.refunded > 0 ? ` and her upgrades came back as ${fmtNum(x.refunded, 'money')} coins` : '';
        feed.push(`Heroes changed: ${name} keeps Lv ${x.level}${coins}.`, 'info', { key: 'save-hero', ms: 8000, sticky: true });
      }
      if (restored.potentialNew) feed.push('This run continues with Potential\'s new effects.', 'info', { key: 'save-potential', ms: 6000, sticky: true });
      feed.push(`Welcome back! Wave ${sim.wave + 1} is next. Tap Start when you're ready.`, 'good', { key: 'welcome-back', ms: 4200, sticky: true });
    }

    ctx.modules = modules;
    ctx.results = results;
    ctx.audio = attachBattleAudio(ctx); cleanups.push(() => ctx.audio.destroy()); // [audio]
    window.__battle = { sim, renderer, ui: ctx, coop: ctx.coop || null, save: saver };
  }

  // ---- co-op -----------------------------------------------------------------------------
  /** co-op: my last 'wave' order (its cmd; in flight until the lockstep has run its tick) */
  let pendingWave = null;
  let coopHud = null;
  /** co-op freeplay presentation + vote (src/ui/battle/freeplay.js), null otherwise */
  let fpBattle = null;
  /** a resync rebuilds this battle screen: its destroy() must not count as leaving the run */
  let remounting = false;
  /** A freeplay run past its goal (not a plain victory at exactly the goal). */
  function isFreeplayRun() {
    // (a Tryout Day Extended Day is a run, not freeplay: the Class Photo ends it, §20.8)
    if (!sim.freeplay || sim.tryout || sim.wavesCleared < sim.totalWaves) return false;
    return !(sim.state === 'won' && sim.wavesCleared === sim.totalWaves);
  }
  // ---- solo freeplay (src/systems/freeplayRewards.js) ---------------------------------------
  /** the battle's payout ledger: a solo campaign run that is (or may become) a freeplay run */
  const soloLedger = !ls && !params.clanBoss && !req.practice && (req.freeplay || req.keepGoing) ? soloFreeplayLedger(sim.seed) : null;
  if (soloLedger) {
    ctx.applyResult = (p, result, rng) => (result.freeplay && result.goalReached
      ? paySoloFreeplay(soloLedger, p, result, rng)
      // a normal run (Keep going not taken yet) pays as results.apply() does without a ledger: a
      // saved run gets the event bonus of the week it started in
      : applyBattleResult(p, result, rng, { now: new Date(eventNow()), eventAt: ctx.saver ? new Date(ctx.saver.createdAt) : null, startedAt: ctx.startedAt ?? null }));
    // Finish: solo ends the run at once (the pause menu and the clear card's pill)
    ctx.voteFinish = (v) => fpBattle?.vote(v);
    ctx.myFinishVote = () => false;
    ctx.freeplayAfterGoal = () => !!fpBattle?.afterGoal();
  }
  /** Solo: banners, the clear card and the bank for a freeplay battle (built or continued). */
  function startSoloFreeplay(modules) {
    if (fpBattle || !soloLedger || !sim.freeplay) return;
    // what a run cut off by a reload is paid at the next app start (the solo coin cap of this tier)
    soloLedger.payout.waveCoins = soloWaveCoins(sim.stageId, sim.difficulty, sim.stage.freeplay.id);
    fpBattle = createFreeplayBattle(ctx, {
      ledger: soloLedger,
      homeFamilies: stageFamilies(),
      bank: () => {
        try {
          const rng = createRng(hashString(`${sim.stage.id}:${sim.difficulty}:${sim.seed}:fp-bank:${Date.now()}`));
          const out = bankSoloClear(soloLedger, store.profile, sim.result(), rng);
          store.commit('battle-result');
          store.saveNow?.();
          return out;
        } catch (e) {
          console.error('[battle] solo freeplay bank failed', e);
          return null;
        }
      },
    });
    modules?.push(fpBattle);
    ctx.freeplay = fpBattle;
  }

  if (ls) {
    ls.note('mount');
    const mySlot = ls.mySlot;
    ctx.coop = {
      session,
      lockstep: ls,
      mySlot,
      ownerOf: (uid) => ls.coop.ownerOf(uid),
      isMine: (uid) => ls.coop.ownerOf(uid) === mySlot,
      ownerName: (uid) => session.player(ls.coop.ownerOf(uid))?.name || 'Your ally',
      colorOf: (uid) => COOP.colors[ls.coop.ownerOf(uid)] || '#fff',
      get hashes() {
        return ls.hashPairs();
      },
      get tick() {
        return ls.tick;
      },
    };
    ctx.applyResult = (p, result, rng) => {
      let out;
      if (result.freeplay && result.freeplay !== 'tryout' && result.goalReached) {
        // freeplay: the clear was banked at the goal; this pays the run (once per battle, see
        // rewards.js payFreeplayEnd), and the sheet shows both parts
        const ledger = freeplayLedger(session, ls.start.seed);
        const end = payFreeplayEnd(ledger, p, result, rng);
        out = { ...end, bank: ledger.bank, freeplayRewards: end.rewards, rewards: normalizeList([...(ledger.bank?.rewards || []), ...end.rewards]) };
        countCoopWin(p, session, `coop:${ls.start.seed}`); // the clear was won (achievements; once per battle)
      } else {
        out = applyCoopResult(p, result, rng);
        if (result.won) countCoopWin(p, session, `coop:${ls.start.seed}`);
      }
      out.note = `Co-op with ${session.player(1 - mySlot)?.name || 'your ally'} — drops for both, medals stay solo.`;
      return out;
    };
    // freeplay: my Finish vote (an 'end' lockstep command; the run ends when everyone left agrees)
    ctx.voteFinish = (v) => fpBattle?.vote(v);
    ctx.myFinishVote = () => !!fpBattle?.myVote();
    ctx.freeplayAfterGoal = () => !!fpBattle?.afterGoal();
    ctx.leaveToRoom = () => backToRoom();
    // the room stays after the battle: both land back in its lobby with the same code. One tap
    // only: the screen changes a moment later (a second tap must not leave the room it kept)
    let acted = false;
    const once = (fn) => () => {
      if (acted) return;
      acted = true;
      fn();
    };
    ctx.extraActions = () => [
      { label: 'Back to the room', testid: 'coop-back', cta: true, icon: 'play', onClick: once(() => backToRoom()) },
      { label: 'Leave room', testid: 'coop-leave-room', icon: 'back', onClick: once(() => leaveCoop()) },
      { label: 'Home', testid: 'home', icon: 'home', onClick: once(() => { leaveCoop(false); navigate('lobby'); }) },
    ];
    // where my ally is once the battle is over: a line on the results sheet (the feed sits under it)
    const allyLine = h('p.bt-coop-ally', { 'data-testid': 'coop-ally-status' });
    allyLine.hidden = true;
    ctx.resultLine = () => allyLine;
    const allyName = () => session.player(1 - mySlot)?.name || 'Your ally';
    const offs = [
      session.on('applied', ({ cmd, res }) => onApplied(cmd, res)),
      session.on('peerGone', (reason) => {
        const ally = allyName();
        const text = reason === 'desync' ? 'Lost sync with your ally — you continue solo.'
          : reason === 'lobby' ? (ctx.ended ? `${ally} is back in the room.` : `${ally} went back to the room. Their girls stay and keep fighting.`)
            : reason === 'left' ? (ctx.ended ? `${ally} left the room.` : `${ally} left. Their girls stay and keep fighting; their income is yours now.`)
            : `Lost contact with ${ally}. Play on — their girls keep fighting, and they rejoin as soon as they are back.`;
        ctx.feed?.push(text, 'warn', { ms: 5200 });
      }),
      session.on('ally', (where) => {
        allyLine.textContent = where === 'room' ? `${allyName()} is back in the room — tap "Back to the room" to play again.` : `${allyName()} left the room.`;
        allyLine.hidden = false;
      }),
      session.on('peerBack', () => ctx.feed?.push(`${session.player(1 - mySlot)?.name || 'Your ally'} is back — defending together again.`, 'good', { ms: 3600 })),
      session.on('resync', () => {
        remounting = true;
        hooks.restart();
      }),
    ];
    cleanups.push(() => offs.forEach((off) => off()));
  }
  // ---- Titan Trials (docs/specs/ASCENSION.md §C) -----------------------------------------
  /** reads the titan's damage from the event stream (the titan and her splitter children) */
  const titanTracker = req.titan ? createTitanTracker(req.titan.battle) : null;
  if (req.titan) {
    ctx.titan = { ...req.titan, tracker: titanTracker, practice: !!req.practice };
    ctx.applyResult = (p, result) => applyTitanResult(p, {
      titanId: req.titan.id, tier: req.titan.tier, rank: req.titan.rank, seed: sim.seed, read: titanTracker.read(),
      kills: result.kills, encountered: result.encountered, practice: !!req.practice,
    });
    ctx.extraActions = () => [
      { label: 'Titan Trials', testid: 'titan-back', cta: true, icon: 'back', onClick: () => navigate('titans', { id: req.titan.id }) },
      { label: 'Retry', testid: 'retry', icon: 'refresh', onClick: () => ctx.restart() },
      { label: 'Home', testid: 'home', icon: 'home', onClick: () => navigate('lobby') },
    ];
  }
  if (params.clanBoss) {
    ctx.extraActions = () => [
      { label: 'Back to the clan', testid: 'clan-back', cta: true, icon: 'play', onClick: () => navigate('clan', { tab: 'boss' }) },
      { label: 'Home', testid: 'home', icon: 'home', onClick: () => navigate('lobby') },
    ];
  }

  /**
   * Leaving a freeplay run after the goal pays its freeplay part with the waves cleared so far (the
   * clear is already banked); the ally plays on with my girls.
   */
  function payIfLeavingRun() {
    if (!ctx.ended && ctx.results && !ctx.results.outcome && (ls || soloLedger) && sim.freeplay && !sim.tryout && sim.wavesCleared >= sim.totalWaves) ctx.results.apply();
  }

  function leaveCoop(go = true) {
    payIfLeavingRun();
    session?.close();
    if (go) navigate('coop');
  }

  /** Results → the same room's lobby (same code, same ally); a dead session falls back to the co-op menu. */
  function backToRoom() {
    payIfLeavingRun();
    // (already back in the lobby: the back gesture got there first)
    if (session?.phase !== 'lobby' && !session?.backToLobby()) {
      leaveCoop();
      return;
    }
    navigate('coop', session.isHost ? { id: session.code, host: '1' } : { id: session.code });
  }

  /** The co-op `aim` command's arguments: a world point in 1/1024 tiles, or null (automatic aim). */
  const aimArgs = (uid, x, y, k = null) => (x == null || y == null ? [uid, null]
    : k == null ? [uid, Math.round(x * 1024), Math.round(y * 1024)] : [uid, Math.round(x * 1024), Math.round(y * 1024), k]);

  function coopActions() {
    const mine = (uid) => {
      if (ls.coop.ownerOf(uid) === ls.mySlot) return true;
      ctx.feed?.push(`That is ${ctx.coop.ownerName(uid)}'s girl.`, 'warn', { key: 'not-mine', ms: 1400 });
      return false;
    };
    return {
      place(id, x, y) {
        if (ls.job) return null; // rebuilding (a resync / rejoin): orders wait until it is done
        const chk = sim.canPlace(id, x, y);
        if (!chk.ok) return null;
        const [qx, qy] = quantize(chk.x ?? x, chk.y ?? y);
        // (the ghost stays on her spot and her price is spoken for until the order runs: coopPending.js)
        ctx.coopPending.place(ls.queue('place', [id, qx, qy]), id, qx / 1024, qy / 1024, sim.placeCost(id));
        return 'queued';
      },
      upgrade(uid, path) {
        if (ls.job || !mine(uid)) return false;
        const st = sim.upgradeStatus(uid, path);
        if (st.locked) return false;
        if (ctx.coopPending.upgrading(uid, path)) return 'queued';
        ctx.coopPending.upgrade(ls.queue('upg', [uid, path]), uid, path, st.cost);
        return 'queued';
      },
      sell(uid) {
        if (ls.job || !mine(uid)) return false;
        const v = sim.sellValue(uid);
        if (!ctx.coopPending.selling(uid)) ctx.coopPending.sell(ls.queue('sell', [uid]), uid);
        return v;
      },
      target(uid, mode) {
        if (ls.job || !mine(uid)) return false;
        ls.queue('tgt', [uid, mode]);
        return true;
      },
      fly(uid, mode, a, b) {
        if (ls.job || !mine(uid)) return false;
        ls.queue('fly', flyArgs(uid, mode, a, b));
        return true;
      },
      aim(uid, x, y, k = null) {
        if (ls.job || !mine(uid)) return false;
        ls.queue('aim', aimArgs(uid, x, y, k));
        return true;
      },
      pick(uid, target) {
        if (ls.job) return { ok: false, reason: 'busy' };
        if (!mine(uid)) return { ok: false, reason: 'notYours' };
        ls.queue('pick', [uid, target]);
        return 'queued';
      },
      // a cast (the `abil` command, ABILITIES_SPEC §7.2–§7.3), one girl's Auto switch and the Auto-cast setting (the
      // `acast` command): abilityBar.js coopAbilityActs (tests/battle-ui/abilityBar.test.js, abilityAuto.test.js)
      ...coopAbilityActs(ctx, ls),
    };
  }

  /** A lockstep command just ran on this client (mine or my ally's). */
  function onApplied(cmd, res) {
    if (destroyed || !ctx.feed) return;
    fpBattle?.onApplied(cmd, res);
    ctx.heroLevels?.onApplied(cmd, res);
    const minePlayer = cmd.p === ls.mySlot;
    // (my order in flight ran, ok or refused: its ghost, "Ordered" button and reserved coins go)
    if (minePlayer && ctx.coopPending?.landed(cmd)) ctx.placement?.landed?.();
    if (cmd.k === 'place') {
      if (res.ok && minePlayer) ctx.onPlaced(res.tower);
      else if (res.ok) ctx.feed.push(`${session.player(cmd.p)?.name || 'Ally'} deployed ${res.tower.def.name}`, 'info', { key: `ally-${res.tower.uid}`, ms: 1400 });
      else if (minePlayer) ctx.feed.push(res.reason === 'occupied' ? 'Your ally got to that spot first.' : 'She could not deploy there any more.', 'warn', { key: 'place-late', ms: 1600 });
    } else if (cmd.k === 'upg' && res.ok && minePlayer) {
      const t = sim.getTower(cmd.a[0]);
      if (t) ctx.onUpgraded(t, cmd.a[1]);
    } else if (cmd.k === 'upg' && !res.ok && minePlayer && res.reason === 'onePerPath') {
      // two copies ordered the same final tier: the first order won on every client
      const t = sim.getTower(cmd.a[0]);
      if (t) ctx.feed.push(finalRaceText(t.def.name, t.def.paths[cmd.a[1]]?.name || ''), 'warn', { key: 'final-race', ms: 1800 });
    } else if (cmd.k === 'pick' && minePlayer) {
      // my pick ran on every client: say what happened (a refusal comes back the same everywhere)
      const src = sim.getTower(cmd.a[0]);
      const tgt = cmd.a[1] >= 0 ? sim.getTower(cmd.a[1]) : null;
      if (!res.ok) ctx.feed.push(PICK_REFUSED[res.reason] || 'She cannot pick that girl.', 'warn', { key: 'pick-refused', ms: 1800 });
      else if (src && tgt) ctx.feed.push(pickText(src, tgt), 'good', { key: 'pick-ok', ms: 1800 });
    } else if (cmd.k === 'speed' && res.ok && !minePlayer) {
      ctx.feed.push(`${session.player(cmd.p)?.name || 'Ally'} set the speed to ${cmd.a[0]}×`, 'info', { key: 'ally-speed', ms: 1400 });
    } else if (cmd.k === 'abil' && minePlayer) {
      // my cast ran on every client: the slot stops waiting; a refusal says why (the same everywhere)
      clearPendingFor(ctx.abilityPending, cmd, ls.mySlot);
      if (!res.ok) ctx.abilityRefusal?.(res.reason, res.casterUid, cmd.a[0]);
      else navigator.vibrate?.(10);
      ctx.abilityBar?.refresh();
    } else if (cmd.k === 'acast' && minePlayer && !res.ok) {
      ctx.feed.push(refusalText(res.reason), 'info', { key: 'acast-refused', ms: 1400 });
    }
  }

  /**
   * Clan boss: everything this battle dealt counts against the clan's shared HP pool. The
   * attempt id comes from start_boss_attempt (the clan screen starts it before opening this
   * battle); the server caps what one battle of this length can count.
   */
  function submitClanBoss() {
    const dmg = Math.round(Object.values(sim.stats.damageByTower || {}).reduce((a, b) => a + b, 0));
    ctx.clanBossDamage = dmg;
    import('../../online/backend.js').then(({ getBackend }) => {
      const backend = getBackend();
      const before = backend.lastBoss?.myDamage || 0;
      return backend.submitBossDamage(params.clanBoss, dmg).then((state) => ({ state, counted: Math.max(0, (state.myDamage || 0) - before) }));
    })
      .then(({ state, counted }) => {
        ctx.clanBossResult = state;
        // achievements: one clan boss attempt resolved (the server accepted it)
        track(store.profile, 'clanBossHit', 1);
        store.commit('clan-boss-hit');
        const text = counted >= dmg || !dmg ? `${fmtNum(dmg)} damage counted` : `${fmtNum(counted)} of ${fmtNum(dmg)} damage counted`;
        ctx.feed?.push(`Clan boss: ${text} · ${fmtNum(Math.ceil(state.hp))} HP left`, 'good', { ms: 4200 });
      })
      .catch((e) => {
        ctx.clanBossResult = { error: e };
        ctx.feed?.push(`Clan boss damage was not saved: ${e.message || e}`, 'bad', { ms: 4200 });
      });
  }

  return {
    ready,
    destroy() {
      if (destroyed) return;
      // a Sim that is over but was never ended (its event got lost) pays out now, never rewinds
      // (a co-op resync rebuild is not leaving: the rebuilt screen ends that battle itself)
      if (!remounting) ctx.settleFinished?.();
      // a finished battle always pays out, even if the player leaves before the modal
      // (a Make-up Test still offered keeps the run: its Continue spends it)
      if (ctx.ended && ctx.results && !ctx.results.outcome && !ctx.makeUpOffered) ctx.results.apply();
      else if (!ctx.ended) {
        // a freeplay run (co-op or solo: never saved) left after its goal pays its freeplay part
        // (a resync rebuild is not leaving)
        if (!remounting) payIfLeavingRun();
        // any other way out of a solo battle (Save & quit, the back arrow or gesture, Home …) keeps it
        saver?.flush();
        // leaving mid-wave without the Save & quit sheet (which says so): say what Continue gets
        if (saver?.hasProgress && !saver.closed && sim.state === 'wave' && !ctx.leaveExplained) {
          toast(`Battle saved at the start of wave ${sim.wave}. Anything built during that wave was undone.`, 'info', 4200);
        }
      }
      destroyed = true;
      loader.release();
      cancelAnimationFrame(raf);
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const fn of cleanups.splice(0)) {
        try {
          fn();
        } catch (e) {
          console.warn('[battle] cleanup failed', e);
        }
      }
      for (const m of ctx.modules || []) {
        try {
          m.destroy?.();
        } catch (e) {
          console.warn('[battle] module cleanup failed', e);
        }
      }
      try {
        ctx.renderer?.dispose();
      } catch (e) {
        console.warn('[battle] renderer dispose failed', e);
      }
      shell.remove();
      if (window.__battle?.sim === sim) delete window.__battle;
    },
  };
}
