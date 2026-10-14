// Battle saver (docs/BATTLE_SAVE.md): keeps a solo battle's save record up to date while it is
// played, so Save & quit, the back gesture, a closed tab or a killed app can all Continue later.
//
// - The record is created on first progress (a girl placed, upgraded, sold or retargeted, the
//   ult, or the first wave start): opening a battle and backing out leaves nothing behind.
// - Every wave start (the Start button and auto-start inside Sim._step both go through the
//   instance wrapper below) snapshots the calm state just before the wave and switches to that
//   wave's random stream; the snapshot is written synchronously right after the step / tap.
// - A command between waves writes a fresh snapshot (quiet, debounced commit). During a wave
//   nothing new is written: leaving mid-wave continues from the start of that wave.
// - Hidden / pagehide / freeze / leaving the screen flush at once.
// - A closed saver (the battle ended, Restart, Retry) never writes again, and no write ever
//   brings back a record that something else deleted (a payout, a New game, a Restart).
import { store } from '../../core/store.js';
import { APP_VERSION, SIM_ID } from '../../core/buildInfo.js';
import {
  RECORD_V, slotKey, getBattleSave, putBattleSave, clearBattleSave, newRunId, saveSummary,
} from '../../systems/battleSave.js';
import { snapshotSim, useWaveStream } from './snapshot.js';

/** Between-wave commands are batched this long before the profile is written. */
const COMMAND_SAVE_MS = 150;

const calm = (sim) => sim.state === 'prep' || sim.state === 'between';

/**
 * @param {{ sim: object, req: { stageId: string, endless?: boolean }, cfg?: { seed: number, loadout: object[], hero: object|null },
 *   record?: object|null, mountedAt?: number, onCreate?: (rec: object) => void, onStorageFull?: () => void, isEnded?: () => boolean }} o
 *   cfg: a New game's frozen team and seed (setup.js createBattleSim); record: the save a Continue restored
 */
export function createBattleSaver({ sim, req, cfg = null, record = null, mountedAt = Date.now(), onCreate = null, onStorageFull = null, isEnded = () => false }) {
  const slot = slotKey(req.stageId, !!req.endless);
  const seed = (record ? record.seed : cfg?.seed ?? sim.seed) >>> 0;
  let rec = record;
  let pending = null;
  let closed = false;
  let timer = null;
  let warned = false;

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
    if (!ok && !warned) {
      warned = true;
      onStorageFull?.();
    }
    return ok;
  }

  /** Puts `snap` in the record (creating it on the first write). @returns {boolean} written */
  function put(snap) {
    if (!writable() || !stillMine()) return false;
    const now = Date.now();
    const created = !rec;
    if (created) {
      rec = {
        v: RECORD_V,
        id: newRunId(now),
        slot,
        stageId: req.stageId,
        endless: !!req.endless,
        difficulty: sim.difficulty,
        seed,
        loadout: cfg?.loadout || [],
        hero: cfg?.hero || null,
        createdAt: mountedAt,
        updatedAt: now,
        build: { app: APP_VERSION, sim: SIM_ID },
        resumes: 0,
      };
    }
    rec.snap = snap;
    rec.updatedAt = now;
    const s = saveSummary(rec, now);
    rec.view = { next: s.next, of: s.of, lives: s.lives, difficulty: s.difficulty };
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
        store.commit('battle-save', { quiet: true });
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
