// Tryout Day's Random Class (docs/specs/TRYOUT_DAY.md §20.4): nobody drafts and nobody picks. Each player's starting
// three are drawn from their own seeded six, and every pick (Pep Talk or Tryout girl) lands by itself inside the Sim
// TRYOUT.random.revealTicks ticks after its offer opens, drawn from the run seed (`auto:<pick>:<owner>:<seq>`). No
// command carries a pick, so it is lockstep-safe; the reveal clock (`p.winTicks`) lives in run state, so a Continue or
// a rejoin mid-reveal lands on the same card. Every function here is pure (reads only) except where it says so; the
// landing itself is tryoutTick's (src/sim/tryout/index.js), which owns resolvePick.
import { TRYOUT } from '../../data/tryout.js';
import { stream } from './plan.js';
import { draftOf, isStriker, hitsAir, isCtrlSup } from './draft.js';
import { squadRoom } from './offers.js';

/** Run commands a Random Class run refuses (reason 'random'): the Sim chooses, and Erasers and Double Dare are off. */
export const RANDOM_REFUSED = Object.freeze(['take', 'hand', 'erase', 'dare']);

/**
 * A player's starting three from their six (§20.4), on stream `random:start:<slot>`: a striker; then a girl who hits
 * flyers if the first doesn't, else a Control or Support girl; then any of the rest. Always keeps a striker and a girl
 * who hits flyers (draftOf's six has both); a Control or Support girl is not guaranteed.
 * @param {string[]} six
 * @returns {string[]}
 */
export function randomThree(six, seed, slot = 0) {
  const rng = stream(seed, `random:start:${slot}`);
  const out = [];
  const any = () => true;
  const take = (test) => {
    const free = six.filter((id) => !out.includes(id) && test(id));
    if (!free.length) return false;
    out.push(free[Math.floor(rng.next() * free.length)]);
    return true;
  };
  if (!take(isStriker)) take(any);
  if (!take(out.length && hitsAir(out[0]) ? isCtrlSup : hitsAir)) take(any);
  while (out.length < TRYOUT.squad.start && take(any));
  return out;
}

/**
 * The constructor's players for a run config (Sim._initTryout): in Random Class each player's squad is their random
 * three from their own six (`draftOf(owned, seed, slot, 0)`, owned = in their frozen pool); any draft is ignored.
 * Otherwise the players as given.
 */
export function randomPlayers(cfg, players) {
  if (cfg?.random !== true) return players;
  const seed = cfg.seed >>> 0;
  return players.map((p, i) => {
    const pool = cfg.pools?.[i];
    const owned = (id) => !!pool && typeof pool === 'object' && Object.prototype.hasOwnProperty.call(pool, id);
    return { ...p, squad: randomThree(draftOf(owned, seed, i, 0), seed, i) };
  });
}

/**
 * The card and path the Sim will take for player `owner`'s open pick (pure: the same answer every call, on every
 * client): uniform over the offer's allowed cards (the `take` op's tests: a girl card needs squad room), then, for a
 * girl, uniform over her paths (at most 3). index -1: nothing allowed (the pick is handed in). null: no random pick open.
 * @returns {{ index: number, path: number }|null}
 */
export function autoChoice(sim, owner) {
  const ty = sim.tryout;
  const p = ty?.players[owner];
  const o = p?.offer;
  if (!ty.random || p.win !== 'pick' || !o) return null;
  const room = squadRoom(sim, owner) > 0;
  const allowed = [];
  o.cards.forEach((c, i) => { if (!c.girl || room) allowed.push(i); });
  if (!allowed.length) return { index: -1, path: 0 };
  const rng = stream(ty.seed, `auto:${o.pick}:${owner}:${o.seq}`);
  const index = allowed[Math.floor(rng.next() * allowed.length)];
  const girl = o.cards[index].girl;
  const n = girl ? Math.max(1, Math.min(3, sim.data.unit(girl)?.paths?.length || 1)) : 1;
  return { index, path: girl ? Math.floor(rng.next() * n) : 0 };
}

/** Steps left before player `owner`'s open random pick lands (0: it lands on the next step's tick). */
function ticksLeft(p) {
  return Math.max(0, TRYOUT.random.revealTicks + 1 - (p.winTicks || 0));
}

/**
 * The UI's reveal (pure read): player `owner`'s pending auto-pick, or null when none is open.
 * `{ owner, pick, seq, rarity, kind, follow, index, path, card, ticksLeft, revealTicks }`: `card` a copy of the offer
 * card that will be taken (index -1: none, the pick is handed in), `ticksLeft` the Sim steps until it lands (it lands
 * exactly revealTicks steps after the step its offer opened; ticks run faster at 2× and 3×).
 */
export function pendingAutoPick(sim, owner = 0) {
  const ch = autoChoice(sim, owner);
  if (!ch) return null;
  const p = sim.tryout.players[owner];
  const o = p.offer;
  return {
    owner, pick: o.pick, seq: o.seq, rarity: o.rarity, kind: o.kind, follow: !!o.follow, index: ch.index, path: ch.path,
    card: ch.index >= 0 ? { ...o.cards[ch.index] } : null, ticksLeft: ticksLeft(p), revealTicks: TRYOUT.random.revealTicks,
  };
}

/** Is player `owner`'s random reveal due on this step? (tryoutTick has counted the step in p.winTicks.) */
export function autoDue(p) {
  return p.win === 'pick' && !!p.offer && p.winTicks > TRYOUT.random.revealTicks;
}
