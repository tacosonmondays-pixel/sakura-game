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

/** The pill's words: solo "Home Time"; co-op says who has voted (`short`: a narrow screen's shorter words). */
export function homeTimeLabel(st, allyName = HOME_TEXT.ally, { short = false } = {}) {
  if (!st?.coop) return HOME_TEXT.button;
  if (st.mine) return st.ally ? (short ? HOME_TEXT.bothShort : HOME_TEXT.both) : short ? HOME_TEXT.votedShort : HOME_TEXT.voted(allyName);
  if (st.ally) return short ? HOME_TEXT.allyVotedShort(allyName) : HOME_TEXT.allyVoted(allyName);
  return HOME_TEXT.vote;
}

/**
 * The pill's words in three parts, [before, name, after], so the wave control can ellipsize a long ally name alone and
 * keep the pill on one line (name '' when the words carry none).
 */
export function homeTimeParts(st, allyName = HOME_TEXT.ally, o = {}) {
  const MARK = '\u0000';
  const text = homeTimeLabel(st, MARK, o);
  const i = text.indexOf(MARK);
  if (i < 0) return [text, '', ''];
  return [text.slice(0, i), String(allyName), text.slice(i + MARK.length)];
}

/**
 * The solo question's Escape and focus (local to Home Time, the shared dialog keeps its own keys): "Stay Late" takes
 * the focus when the question opens, and Escape answers it ("Stay Late"), through `onEscape` (src/ui/hold.js, the
 * capture-phase Escape stack, so the battle's own Escape never sees the key). @returns {() => void} undo
 */
export function stayLateKeys(onEscape) {
  if (typeof document === 'undefined') return () => {};
  const box = [...document.querySelectorAll('.modal-overlay')].pop() || null;
  const stay = () => box?.querySelector('[data-testid="confirm-cancel"]') || null;
  const focus = () => stay()?.focus?.({ preventScroll: true });
  focus();
  // (the dialog may move the focus once it has painted: Stay Late takes it back then)
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(focus) : 0;
  const off = typeof onEscape === 'function' ? onEscape(() => stay()?.click()) : null;
  return () => {
    if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    off?.();
  };
}

/**
 * The battle side: `ctx.homeTime` for the wave control. Solo asks (the game held still meanwhile) and ends the run;
 * co-op queues this player's vote (a second tap takes it back). A feed line says when the ally votes.
 * @param {object} ctx battle context (controller.js): sim, feed, coop?, paused
 * @param {{ mySlot?: number, confirm?: (text: string, o: object) => Promise<boolean>, onEscape?: (fn: () => void) => () => void }} o
 *   onEscape: src/ui/hold.js's Escape stack (Escape answers the solo question with Stay Late)
 */
export function createHomeTime(ctx, { mySlot = 0, confirm = null, onEscape = null } = {}) {
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
    let keys = null;
    try {
      const answer = confirm ? confirm(HOME_TEXT.ask(sim.wavesCleared), { title: HOME_TEXT.title, ok: HOME_TEXT.ok, cancel: HOME_TEXT.cancel }) : true;
      // (the dialog is in the page now: Stay Late takes the focus, Escape answers Stay Late)
      if (confirm) keys = stayLateKeys(onEscape);
      ok = await answer;
    } finally {
      keys?.();
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

  return { state, tap, update, label: (st, o) => homeTimeLabel(st, allyName(), o), parts: (st, o) => homeTimeParts(st, allyName(), o), get asking() { return asking; } };
}
