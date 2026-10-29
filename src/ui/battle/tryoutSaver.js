// Tryout Day's run save (docs/specs/TRYOUT_DAY.md §8.6, §12): the open run lives in profile.tryoutRun, outside the
// battle saves, and stores the generic battle snapshot (src/sim/snapshot.js) of its last calm point. Writes: every
// wave end, every run command and every between-wave command (batched), and the wave start, which marks the record
// `waveOpen` so a Continue that finds it set is a mid-wave resume (the Make-up Test, then practice; §12.3). Nothing
// is written mid-wave: leaving then replays the wave from its start with the same enemies and luck.
import { store } from '../../core/store.js';
import { getTryoutRun, clearTryoutRun } from '../../systems/tryoutRuns.js';

const COMMAND_SAVE_MS = 150;
const calm = (sim) => sim.state === 'prep' || sim.state === 'between';

/**
 * @param {{ sim: object, rec: object, isEnded?: () => boolean, onStorageFull?: (reason: string) => void }} o
 */
export function createTryoutSaver({ sim, rec, isEnded = () => false, onStorageFull = null }) {
  let closed = false;
  let timer = null;
  let warned = false;
  let lastCalm = null; // wave + state of the last calm snapshot written

  const mine = () => {
    const cur = getTryoutRun(store.profile);
    if (cur && cur.id === rec.id) return true;
    closed = true;
    return false;
  };
  const writable = () => !closed && !isEnded() && sim.state !== 'won' && sim.state !== 'lost' && mine();

  function saveNow() {
    clearTimeout(timer);
    timer = null;
    store.commit('tryout-run', { quiet: true });
    const ok = store.saveNow();
    if (!ok && !warned && store.lastSaveError !== 'stale') {
      warned = true;
      onStorageFull?.(store.lastSaveError || 'quota');
    }
    return ok;
  }

  /** The calm state now into the record (not yet written). */
  function take() {
    rec.snap = sim.snapshot();
    rec.squad = sim.tryout.players[0].squad.slice();
    rec.period = sim.tryout.started || 1;
    rec.wave = sim.wave;
    rec.lives = sim.lives;
    rec.updatedAt = Date.now();
    delete rec.voidPeriod; // (the snapshot carries the resumed period from here on)
  }

  const saver = {
    get id() {
      return rec.id;
    },
    get record() {
      return rec;
    },
    /** A calm point: written now (a run command) or batched (other between-wave commands). */
    markProgress({ now = false } = {}) {
      if (!writable() || !calm(sim)) return;
      take();
      rec.waveOpen = null;
      lastCalm = `${sim.state}:${sim.wave}`;
      if (now) saveNow();
      else {
        clearTimeout(timer);
        timer = setTimeout(saveNow, COMMAND_SAVE_MS);
      }
    },
    /** The Start tap: the exact calm state just before the wave, then the wave is marked open. */
    beforeWave() {
      if (!writable() || !calm(sim)) return;
      take();
    },
    /**
     * Every frame: a wave just ended is written once; a wave that started (the Start tap or Auto) marks the record
     * open with the last calm snapshot (the state just before it).
     */
    tick() {
      if (!writable()) return;
      if (calm(sim)) {
        if (lastCalm !== `${sim.state}:${sim.wave}`) saver.markProgress({ now: true });
      } else if (sim.state === 'wave' && rec.waveOpen !== sim.wave) {
        if (!rec.snap || rec.wave !== sim.wave - 1) return;
        rec.waveOpen = sim.wave;
        saveNow();
      }
    },
    /** Hidden, pagehide, leaving: what Continue should get, now. */
    flush() {
      if (!writable()) return;
      if (calm(sim)) take();
      saveNow();
    },
    // the battle saver's names (controller.js calls them for every saving battle)
    persistPending() {
      saver.tick();
    },
    persistCalm() {},
    resumed() {},
    discard() {
      saver.finish();
      store.commit('tryout-run');
      store.saveNow();
    },
    get hasProgress() {
      return true;
    },
    get full() {
      return false;
    },
    get closed() {
      return closed;
    },
    get seed() {
      return rec.seed >>> 0;
    },
    get createdAt() {
      return rec.createdAt;
    },
    close() {
      closed = true;
      clearTimeout(timer);
      timer = null;
    },
    /** The run is over (paid or abandoned): the record goes, in the same write as anything paid. */
    finish(p = store.profile) {
      saver.close();
      return clearTryoutRun(p, rec.id);
    },
  };
  return saver;
}
