// Battle saver (docs/BATTLE_SAVE.md): keeps a solo battle's save record up to date while it is
// played, so Save & quit, the back gesture, a closed tab or a killed app can all Continue later.
//
// - The record is created on first progress (a girl placed, upgraded, sold or retargeted, the
//   ult, or the first wave start): opening a battle and backing out leaves nothing behind. With
//   MAX_BATTLE_SAVES already kept it is only created when the player chose which save to delete
//   (stage prep's "Saved battles full" sheet → `evict`); otherwise this battle is not saved.
// - Every wave start (the Start button and auto-start inside Sim._step both go through the
//   instance wrapper below) snapshots the calm state just before the wave and switches to that
//   wave's random stream; the snapshot is written synchronously right after the step / tap.
// - Every wave end is written once (persistCalm), so a crash on the between-wave shop never
//   replays a wave the player already won.
// - A command between waves writes a fresh snapshot (debounced). During a wave nothing new is
//   written: leaving mid-wave continues from the start of that wave.
// - Hidden / pagehide / freeze / leaving the screen flush at once.
// - A closed saver (the battle ended, Restart, Retry, another tab moved on) never writes again,
//   and no write ever brings back a record that something else deleted (a payout, a New game, a
//   Restart: the run-id check here, and store.saveNow's check for other tabs).
import { store } from '../../core/store.js';
import { APP_VERSION, SIM_ID } from '../../core/buildInfo.js';
import {
  RECORD_V, slotKey, getBattleSave, putBattleSave, clearBattleSave, newRunId, saveSummary, saveToEvict, listBattleSaves,
} from '../../systems/battleSave.js';
import { snapshotSim, useWaveStream } from './snapshot.js';

/** Between-wave commands are batched this long before the profile is written. */
const COMMAND_SAVE_MS = 150;

const calm = (sim) => sim.state === 'prep' || sim.state === 'between';

/**
 * @param {{ sim: object, req: { stageId: string, endless?: boolean }, cfg?: { seed: number, loadout: object[], hero: object|null },
 *   record?: object|null, evict?: string|null, mountedAt?: number, startedAt?: number|null, onCreate?: (rec: object) => void,
 *   onStorageFull?: (reason: 'quota'|'held') => boolean|void, onFull?: () => void, isEnded?: () => boolean }} o
 *   cfg: a New game's frozen team and seed (setup.js createBattleSim); record: the save a Continue restored;
 *   evict: the run id of the save the player chose to delete to make room (stage prep);
 *   startedAt: when a New game began on the limited-event clock (src/ui/events/clock.js eventNow; the
 *   same as mountedAt in production), kept in the record so a Continue keeps the start time the
 *   event reward gate reads (EVENT_SPEC §3.2);
 *   onStorageFull: a write failed (return true once the player has been told); onFull: the saved
 *   battles are full and this battle is not being saved
 */
export function createBattleSaver({ sim, req, cfg = null, record = null, evict = null, mountedAt = Date.now(), startedAt = null, onCreate = null, onStorageFull = null, onFull = null, isEnded = () => false }) {
  const slot = slotKey(req.stageId, !!req.endless);
  const seed = (record ? record.seed : cfg?.seed ?? sim.seed) >>> 0;
  let rec = record;
  let pending = null;
  let closed = false;
  let timer = null;
  let warned = false;
  let full = false;
  /** wave + state of the last snapshot put in the record (persistCalm writes a wave end once) */
  let lastSnap = record?.snap ? `${record.snap.state}:${record.snap.wave}` : null;

  const profile = () => store.profile;
  const writable = () => !closed && !isEnded() && sim.state !== 'won' && sim.state !== 'lost';

  /** The slot still holds this run (else it was paid out, restarted or replaced: stop for good). */
  function stillMine() {
    if (!rec) return true;
    const cur = getBattleSave(profile(), slot);
    if (cur && cur.id === rec.id) return true;
    closed = true;
    rec = null;
    return false;
  }

  function saveNow() {
    clearTimeout(timer);
    timer = null;
    const ok = store.saveNow();
    if (!ok) {
      const reason = store.lastSaveError;
      // another tab moved on with this run (or any saved battle): main.js asks for a reload
      if (reason === 'stale') saver.close();
      else if (!warned) warned = onStorageFull?.(reason || 'quota') !== false;
    }
    return ok;
  }

  /**
   * Room for a new record: there is one, or the player chose which save to delete (`evict`,
   * deleted now). Otherwise this battle is not saved (onFull, once).
   */
  function makeRoom() {
    const p = profile();
    if (!saveToEvict(p, slot)) return true;
    const chosen = evict ? listBattleSaves(p).find((r) => r.id === evict && r.slot !== slot) : null;
    if (chosen && clearBattleSave(p, chosen.slot, chosen.id) && !saveToEvict(p, slot)) return true;
    if (!full) {
      full = true;
      onFull?.();
    }
    return false;
  }

  /** Puts `snap` in the record (creating it on the first write). @returns {boolean} written */
  function put(snap) {
    if (!writable() || !stillMine()) return false;
    const now = Date.now();
    const created = !rec;
    if (created && !makeRoom()) return false;
    if (created) {
      rec = {
        v: RECORD_V,
        id: newRunId(now),
        slot,
        stageId: req.stageId,
        endless: !!req.endless,
        difficulty: sim.difficulty,
        // the battle mode (docs/specs/CODEX_MODES.md): Continue rebuilds the run in it (absent = Standard)
        ...(sim.mode && sim.mode.id !== 'standard' ? { mode: sim.mode.id } : {}),
        seed,
        loadout: cfg?.loadout || [],
        hero: cfg?.hero || null,
        createdAt: mountedAt,
        // the event clock's start time (Continue's reward gate for a limited-event stage)
        ...(Number.isFinite(startedAt) && startedAt > 0 ? { startedAt } : {}),
        updatedAt: now,
        build: { app: APP_VERSION, sim: SIM_ID },
        resumes: 0,
      };
    }
    rec.snap = snap;
    rec.updatedAt = now;
    lastSnap = `${snap.state}:${snap.wave}`;
    const s = saveSummary(rec, now);
    rec.view = { next: s.next, of: s.of, lives: s.lives, difficulty: s.difficulty, mode: rec.mode || 'standard' };
    if (created) {
      putBattleSave(profile(), rec);
      onCreate?.(rec);
    } else if (profile().battleSaves[slot] !== rec) profile().battleSaves[slot] = rec;
    return true;
  }

  function freshSnap() {
    try {
      return snapshotSim(sim);
    } catch (e) {
      console.warn('[battle] snapshot failed', e);
      return null;
    }
  }

  const saver = {
    slot,
    seed,
    /** The record (null until the first progress). */
    get record() {
      return rec;
    },
    get runId() {
      return rec?.id || null;
    },
    get hasProgress() {
      return !!rec;
    },
    get closed() {
      return closed;
    },
    /** The saved battles are full and the player did not choose one to delete: not saved. */
    get full() {
      return full && !rec;
    },
    /** When the run began (New game mount time): the event bonus is judged by it. */
    get createdAt() {
      return rec?.createdAt ?? mountedAt;
    },
    /** The wave the player fights next: the one running, else the one after the last. */
    get nextWave() {
      return sim.state === 'wave' ? sim.wave : sim.wave + 1;
    },

    /**
     * Wraps sim.startNextWave on this instance: the calm state just before every wave start is
     * kept for persistPending(), and the wave plays on its own random stream (useWaveStream).
     */
    install() {
      const original = sim.startNextWave.bind(sim);
      sim.startNextWave = () => {
        if (!calm(sim)) return original();
        const snap = closed ? null : freshSnap();
        useWaveStream(sim, seed, sim.wave + 1);
        const ok = original();
        if (ok && snap) pending = snap;
        return ok;
      };
      return saver;
    },

    /** Writes the wave-start snapshot taken by the wrapper (after a sim step or the Start tap). */
    persistPending() {
      if (!pending) return false;
      const snap = pending;
      pending = null;
      return put(snap) && saveNow();
    },

    /**
     * Every frame: a wave just ended (state 'between' at a wave this record has no snapshot of
     * yet) is written once, so a crash or a killed app on the between-wave shop keeps that wave.
     */
    persistCalm() {
      if (!rec || sim.state !== 'between' || lastSnap === `between:${sim.wave}` || !writable()) return false;
      const snap = freshSnap();
      return !!snap && put(snap) && saveNow();
    },

    /** A successful player command: progress. Between waves it is saved (batched). */
    markProgress() {
      if (!writable()) return;
      if (pending) {
        saver.persistPending();
        if (!calm(sim)) return;
      }
      if (!calm(sim)) return; // mid-wave: the wave-start snapshot stands
      const first = !rec;
      const snap = freshSnap();
      if (!snap || !put(snap)) return;
      if (first) saveNow();
      else {
        // one debounced write per batch of commands (the store's own timer is not armed too)
        clearTimeout(timer);
        timer = setTimeout(() => saveNow(), COMMAND_SAVE_MS);
      }
    },

    /** Hidden, pagehide, freeze, leaving the screen: write what Continue should get, now. */
    flush() {
      if (pending) saver.persistPending();
      if (rec && writable() && calm(sim)) {
        const snap = freshSnap();
        if (snap) put(snap);
      }
      if (rec && !closed) saveNow();
    },

    /** Continue: one more resume on the record. */
    resumed() {
      if (!rec || !stillMine()) return;
      rec.resumes = (rec.resumes || 0) + 1;
      rec.updatedAt = Date.now();
      store.commit('battle-save', { quiet: true });
    },

    /** No more writes (the battle ended: results.apply() pays out and finishes the record). */
    close() {
      closed = true;
      pending = null;
      clearTimeout(timer);
      timer = null;
    },

    /** Restart / Retry: the run is thrown away. */
    discard() {
      const id = rec?.id;
      saver.close();
      rec = null;
      if (id && clearBattleSave(profile(), slot, id)) {
        store.commit('battle-save');
        store.saveNow();
      }
    },

    /**
     * Inside results.apply(), in the same synchronous write as the rewards: the finished run's
     * save goes (only this run's: a newer run in the slot is left alone).
     */
    finish(p = profile()) {
      saver.close();
      const id = rec?.id;
      rec = null;
      return id ? clearBattleSave(p, slot, id) : false;
    },
  };
  return saver;
}
