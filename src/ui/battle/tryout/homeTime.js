// Tryout Day's Home Time (docs/specs/TRYOUT_DAY.md §20.1, Q-A6): an Extended Day run past the Full Day's 48 waves can
// end on purpose. Solo: a button between waves that asks first, then sim.finish() (the run ends 'lost' with
// sim.finished; the controller treats that as Home Time and skips the Make-up Test). Co-op: this player's vote on the
// freeplay Finish command ('end', src/online/coop/commands.js checkEndVotes: the run ends once everyone still in has
// voted, through sim.finish()). The wave control draws the pill (src/ui/battle/waveControl.js) from homeTimeState;
// both pay like running out of hearts (src/systems/tryoutRewards.js). Reads the Sim, never writes it except through
// sim.finish() (solo) or a queued lockstep command (co-op).
import { isExtendedRun, FULL_WAVES } from './adapters.js';
import { HOME_TEXT } from '../../text/tryout.js';

/**
 * Is Home Time on offer for player `slot`: an Extended Day with the Full Day's 48 waves cleared, between waves, the run
 * still on, and that player's own pick or break closed (its sheet would cover the pill anyway).
 */
export function homeTimeOpen(sim, slot = 0) {
  if (!sim || !isExtendedRun(sim)) return false;
  if (!(sim.wavesCleared >= FULL_WAVES) || sim.state !== 'between' || sim.finished) return false;
  return !sim.tryout.players?.[slot]?.win;
}

/**
 * The pill's state (pure). `votes`: the applied Finish votes by player (co-op: lockstep.coop.endVotes()); `pending`:
 * this player's vote queued but not applied yet (null: none).
 * @returns {{ show: boolean, coop: boolean, mine: boolean, ally: boolean }}
 */
export function homeTimeState(sim, { slot = 0, coop = false, votes = null, pending = null } = {}) {
  const v = Array.isArray(votes) ? votes : [];
  return {
    show: homeTimeOpen(sim, slot),
    coop: !!coop,
    mine: coop ? (pending ?? !!v[slot]) : false,
    ally: coop ? v.some((x, i) => i !== slot && !!x) : false,
  };
}

/** The pill's words: solo "Home Time"; co-op says who has voted. */
export function homeTimeLabel(st, allyName = HOME_TEXT.ally) {
  if (!st?.coop) return HOME_TEXT.button;
  if (st.mine) return st.ally ? HOME_TEXT.both : HOME_TEXT.voted(allyName);
  if (st.ally) return HOME_TEXT.allyVoted(allyName);
  return HOME_TEXT.vote;
}

/**
 * The battle side: `ctx.homeTime` for the wave control. Solo asks (the game held still meanwhile) and ends the run;
 * co-op queues this player's vote (a second tap takes it back). A feed line says when the ally votes.
 * @param {object} ctx battle context (controller.js): sim, feed, coop?, paused
 * @param {{ mySlot?: number, confirm?: (text: string, o: object) => Promise<boolean> }} o
 */
export function createHomeTime(ctx, { mySlot = 0, confirm = null } = {}) {
  const { sim } = ctx;
  const ls = ctx.coop?.lockstep || null;
  let pending = null;
  let asking = false;
  let allySaid = false;
  const votes = () => (ls ? ls.coop.endVotes?.() || [] : []);
  const allyName = () => ctx.coop?.session?.player?.(1 - mySlot)?.name || HOME_TEXT.ally;

  function state() {
    const v = votes();
    // (a queued vote is mine until the lockstep applies it; a hidden pill drops a vote that never landed)
    if (pending != null && !!v[mySlot] === pending) pending = null;
    const st = homeTimeState(sim, { slot: mySlot, coop: !!ls, votes: v, pending });
    if (!st.show && !st.mine) pending = null;
    return st;
  }

  async function tap() {
    if (!homeTimeOpen(sim, mySlot) || asking) return false;
    if (ls) {
      const want = !state().mine;
      if (!ls.queue('end', [want])) {
        ctx.feed?.push(HOME_TEXT.resync, 'warn', { key: 'ty-home-wait', ms: 2400 });
        return false;
      }
      pending = want;
      if (want) ctx.feed?.push(HOME_TEXT.castFeed(allyName()), 'info', { key: 'ty-home-vote', ms: 2600 });
      return true;
    }
    // solo: ask first, with the game held still (Auto must not start the next wave under the question)
    asking = true;
    const was = !!ctx.paused;
    ctx.paused = true;
    let ok = false;
    try {
      ok = confirm ? await confirm(HOME_TEXT.ask(sim.wavesCleared), { title: HOME_TEXT.title, ok: HOME_TEXT.ok, cancel: HOME_TEXT.cancel }) : true;
    } finally {
      asking = false;
      ctx.paused = was;
    }
    if (!ok || !homeTimeOpen(sim, mySlot)) return false;
    return sim.finish();
  }

  /** Every frame: the ally's vote (co-op) gets one feed line each time it turns on. */
  function update() {
    if (!ls) return;
    const ally = votes().some((x, i) => i !== mySlot && !!x);
    if (ally && !allySaid && !state().mine) ctx.feed?.push(HOME_TEXT.allyFeed(allyName()), 'info', { key: 'ty-home-ally', ms: 3200 });
    allySaid = ally;
  }

  return { state, tap, update, label: (st) => homeTimeLabel(st, allyName()), get asking() { return asking; } };
}
