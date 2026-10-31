# Co-op sharing: delta review r2 (44aa36b8 → 3004a1d7)

This is a delta review of `feature/coop-sharing` `44aa36b8` → `3004a1d7`, with sim id `868e4a3d10f3` and COOP 17. It covers commits `46673dd0` (the r1 fixes) and
`3004a1d7` (L3, the e2e gift wait). I read the full diff (`commands.js`, `abilities.js`, `controller.js`, `coopHud.js`, `battle.css`, the
tests, the spec and `coop-rejoin.mjs`) and re-ran my r1 probes, plus new ones (`probes/probe.test.js`, the `r2 probes` block).

## Verdict: NOT OK (one Medium left, a one-line fix)

The r1 findings M2, L1, L2, L3, L4, the §9 doc and the coop-rejoin check are all fixed and verified. M1 is fixed only for the order it
was reported in. Lending *first* and then casting still gives the team two independent map-ability cooldowns.

## M1-residual: a lent copy still forms its own map-ability group (Medium)

`carryGroupCooldown` (`src/sim/abilities.js:179`, called from `commands.js` `setCtrl`) carries the *old* group's remaining cooldown
onto a girl when she changes hands. That closes "cast → lend → cast", which I re-ran: the lent copy is now refused with `cooldown`.
But `groupKey` (`abilities.js:166`) is still `${ctrlOf(t)}|${id}`, so a lent girl lives in her controller's group:

- Probe `lend FIRST`: the host has two Shiro copies at T3, both ready. The host lends copy 2 → ok. The guest casts copy 2 → ok. The host casts copy 1 →
  **ok**, where it should be `cooldown`. Then give → ok, and copy 2 comes home carrying the guest group's cooldown.
- So with two or more copies the team still gets one map ultimate per group *per controller* instead of one per group cooldown.
  It is legal mid-wave (lend is allowed in a wave, give at any time), it fits in one tick, and it repeats every cooldown. Both views
  agree, so there is no desync.

**Fix (verified in a scratch worktree):** key the shared map group by her owner, the same choice M2 made for the econ cap:

```js
// abilities.js:166
const groupKey = (t, id) => `${t.owner ?? 0}|${id}`;
```

With this one line, `lend FIRST` → the home copy is refused with `cooldown`. The r1 order, the wave-boundary probe and the hand-out-on-cooldown probe
still behave correctly, and `coopSharing.test.js` + `coopAbilities.test.js` + my probes pass (50/50). Solo is unaffected (`t.owner` is
`ctrlOf(t)` there). `carryGroupCooldown` then becomes a no-op and can stay or go. For consistency, also switch the two other
"that player's copies of this ability" scans to the owner: `groupCut` (`abilities.js:200`, the office cut a shared entry charges
with) and the first-bell charge in `startAbilityWave` (`:1651`). `pickCaster` (`:1315`) and `abilitySlots` (`:1773`) stay on the
controller (who can press the button). Add `lend FIRST` as a test. The sim id moves again; COOP 17 is still unreleased, so no bump is
needed (see Info).

## Re-checks of the r1 fixes

| r1 | Check | Result |
|---|---|---|
| M1 (as reported) | cast copy 1 → lend copy 2 → the guest casts copy 2 | `cooldown` ✔. The **lend-first order is not covered**: see above |
| M2 | three Market Days: two casts, then lend the third → the guest casts | `cap` ✔. Lend-first order: the guest casts the lent one, the host's 2nd is ok, the 3rd is `cap` ✔ (2 per owner) |
| L1 | speed 1→3→2→1 during the grace, two views plus a **fresh client restored from a mid-grace checkpoint** (`JSON` round trip) | Every step's hash is identical on all three. `left` 7200 → 6600 (100 steps @1×) → 6400 (100 @3×) → 6250 (50 @2×) → 5650 (100 @1×), and the hand-out lands at tick 1293, exactly as computed. Integers throughout, folded into `shareDigest` and the checkpoint ✔ |
| L1, two pages | see "Two-page probe" below | |
| L2 | `controller.js` lobby / left / lost lines | All three say "in 20 s they and their coins are yours" (`GRACE_S`) ✔ |
| L3 | coop-sharing e2e with shots, `r2-shots/share-04-grace-countdown-844x390.jpg`, `share-02…844x390` | The toast now docks below the CO-OP strip and the "Ally left — …" line. Nothing overlaps ✔ |
| L4 | the S4 test's ping-pong and lend → controller-sell legs | Present and green ✔ |
| §9 | spec doc | Updated ✔ |
| coop-rejoin | accepts `catchup` when the hashes agree afterwards | ✔ Matches what r1 found on main |

## New lend paths probed (both views: identical results and hashes)

- **Cast, lend, give, back, re-lend across a wave boundary:**
  - mid-wave: the lent copy is on `cooldown`;
  - give → ok; back after give → `already`;
  - the home cast is still on `cooldown`;
  - between waves: re-lend → ok, back → ok, re-lend → ok;
  - next wave: both copies show 44 s left and the lent cast is refused (`cooldown`).

  Nothing gets reset across the boundary ✔.
- **Hand-out of a girl on cooldown.** The leaver cast copy 1, then left. After the grace both copies are the guest's, both still on
  cooldown (25.95 s left), and both are refused ✔ (`setCtrl` carries the cooldown in `handOut`).
- **Econ, lend first:** see M2 above ✔.

## Two-page probe (my Playwright script, local adapter)

The two-page probe is the r1 script plus speed changes in both graces. It shows identical per-command results on both pages and agreeing hashes in every window:
- the r1 edge set (gift spam, the lend / sell / upg races, double lend, back in a wave);
- cut the guest, then **speed 3 → 2 during the grace** (`left` 6708), then **join inside the grace**: the guest rebuilds from the host's
  mid-grace checkpoint, the hand-out is cancelled, and the hashes agree;
- cut again, then **speed 3 → 1 → 2 during the grace** (`left` 6684): the hand-out happened 28 s after the last speed change (about 18.6 s of
  grace was left; this sandbox's software-GL pages run lockstep below real time under load), then **join after the hand-out**: the
  girls are the guest's again on both pages and the hashes agree.

The only failing check in that run is my own setup wait (host wallet ≥ 900), which timed out; it is not a game check.

## Proofs and runs (3004a1d7)

| What | Result |
|---|---|
| `npm test` | 439 files, **6961 passed**, 11 skipped, 0 failed |
| Solo `MODES_*` (15 battles, a bundle built from the tree) | **identical to main** and to `solo-proof.json` (digest `964d4bf0`) |
| noNerfGate `--support none`, branch vs main (`a3d97a38`) | 4455 cells, **0 under**, 0 missing, output **byte-identical** |
| `e2e/coop-sharing.mjs` (with shots) | 40/40 |

## Info
- **COOP stays 17 while the sim id moved** (`6236af328f25` → `868e4a3d10f3`). That is fine: 17 has never shipped (main is 16), and
  `sameVersion` compares sim ids, so the two 17 builds refuse each other anyway. The M1 fix above moves the sim id once more, with the
  same reasoning.
- **The gift limit (120 ticks) still scales with game speed:** one gift every 0.67 s of real time at 3×. Harmless, and not a finding.
- At 844x390 the open drawer covers the right end of the CO-OP strip (the ally's coins / your own coins). This predates the branch and is cosmetic.
