# Co-op feel — independent review r2 (delta on the r1 fixes, Oct 31, 2026)

Fresh clone. Targets:

| Branch | Tip | Protocol | Sim id (tools/simId.mjs) | Verdict |
|--------|-----|----------|--------------------------|---------|
| `feature/coop-feel` (display only) | a3bc4b9b | 14 | 5ba58b3fc229 (= `release/v0.1.66` @ 26dd6ab6 ✔) | **OK**: F1–F3 and L1 are closed. One test fix is needed before merge (R2-1: the F1 e2e step is flaky) |
| `feature/coop-feel-net` | f4923f46 | 15 | 92f3c17bbd2c (= KNOWN[15] ✔) | **OK**, same R2-1 (the step is shared) |

## Runs

- `npm test` (vitest, 424 files):
  - coop-feel: **6649 passed / 4 failed / 11 skipped**. The failures are exactly the known reds: `itemArtRuntime` KNOWN[14]
    (36cba1c215b0 against the release's 5ba58b3fc229, left for the release assembly) and the 3 `engines.test.js` fixtures
    (returning abilities, Tenka, gear sets).
  - coop-feel-net: **6653 passed / 3 failed / 11 skipped**. The failures are the same 3 engines fixtures; KNOWN[15] is green.
- e2e:

  | Script | coop-feel | coop-feel-net |
  |--------|-----------|---------------|
  | `coop-rejoin.mjs` | run 1: 20 ok / **1 FAIL** (the new F1 step, see R2-1); run 2 with the R2-1 wait: 21/21 ok | 21/21 ok |
  | `multiplayer.mjs` | 85 ok | 85 ok |
  | `coop-freeplay.mjs` | 58/58 ok (the known glitch-banner check passed this time: flaky) | 57 ok / 1 FAIL ("the crossing: the glitch banner shows on both screens", pre-existing) |

- Pre-fix proof: on a scratch copy, the coop-feel tip with `coopPending.js` from ce720339~1:
  - `coop-rejoin` gave 20 ok / 1 FAIL **twice** (once as shipped, once with the R2-1 wait).
  - Tap 6 (about 6 s into the stall, the old `STALE_MS`) read `ordered:false, res:'queued'`, and **`sent: 2`** upg
    commands went out.
  - So step 1b does catch the old double-buy.
  - Its second check ("the tier is bought exactly once") **passed** on the old code. The second upg was refused on
    landing because the wallet only covered one tier. Only the first check (`sent === 1`) catches the bug.
- `tools/coopLatency.mjs` (coop-feel-net, 150 s):

  | Row | own med / p90 (ms) | stall h/g | delays | hash |
  |-----|--------------------|-----------|--------|------|
  | busy 200/200 | 550 / 700 | 0.3 / 2.1 % | 43 / 35 | ok |
  | pause 0/0 | 767 / 1000 | 0 / 0 % | | ok |
  | pause 0/0, `--nudge 800` | 517 / 517 | | | |

  These are identical to r1. At `--fps 120`, busy 200/200 gives 550/683 with stall 0.3/1.8 %, against 558/700 and
  0.4/1.0 % on the pre-L1 lockstep: no regression.

## 1. F1 — closed on both branches

The code is `coopPending.js:36-48`, and the controller passes `tick: () => ls.tick` and
`paused: () => ls.stalled || ls.job` at `controller.js:452`.

`ls.tick` is `coop.tick`, which `step()` increments after the tick's commands are applied. `onApplied → landed()` runs
synchronously inside `runTick` before that. So `tick > o.t` can only be true for one of two kinds of order:

- **(a)** an order that ran without `onApplied`. This happens in a rebuild or catch-up replay (`replayTick` calls no
  hook) or in a `silent` runTick. The tier is already in the sim, so a new tap buys the *next* tier, which is correct.
- **(b)** an order that never ran: it was voided by a rejoin. It is gone from `pending`, and the host never had it.

Neither kind allows a duplicate. The paths I walked:

- **Two taps in one tick:** the entry is added synchronously in the first tap, so the second tap sees `upgrading()`
  and returns `'queued'`. A different path is limited by `spendable`.
- **An order at the horizon edge:** `t ≥ sentHorizon + 1`, and `tick` cannot pass `t` without running it.
- **Stall:** `paused` is true, and `tick` is frozen anyway. The wall clock is never consulted in co-op, because every
  cmd has an integer `t`.
- **Tab hidden:** the RAF stops, so neither `advance` nor `tick` moves. On return, either the order runs, or the host
  dropped us and the rejoin path applies.
- **Resync while pending:** a job runs (paused), then `onResync` fires the session `'resync'` event, which calls
  `clear()` (`controller.js:1483`) and remounts.
- **Rejoin mid-order:**
  - Rebuild: same as resync (`lockstep.js:846`).
  - In place: see §2.
- **Keys:** `seq` never resets, so `${p}:${s}` cannot collide.
- **Hero level-up (`hlv`):** carries the target level, so a second `hlv` comes back `'stale'`.

**The reverse problem (an order that stays "Ordered" forever):**

- Going solo (the peer is gone, for timeout, lost or desync): `canRun` skips gone peers, so ticks run and the order
  lands. The guest's `lost` wait is bounded by `REJOIN_WAIT_MS`. `resyncPending` is bounded by `loadTimeoutMs`, after
  which the second strike sends the client solo.
- The battle ends (`finished` or `ctx.ended`): ticks stop and an entry can stay. The results sheet is up and nothing can
  be bought, so this is harmless.
- I found no path that holds coins indefinitely while the battle is still being played.

## 2. F3's reasoning — holds, with one small gap (R2-3)

On an in-place catch-up (`startCatchUp`, `lockstep.js:693`), the guest's own orders for ticks ≥ G are handled in two
ways:

- **The host has them:** they are kept and replayed. During the job, `paused` holds the entry. Afterwards
  `tick = T > o.t`, so the entry goes stale while the tier is already bought. They land silently: no `onUpgraded` toast.
- **The host never got them:** they are voided (removed from `known`, `pending` and `log`), and the entry *does* still
  refer to a command that will never run. If `o.t < T` it goes stale on the first frame after the catch-up. If
  `o.t ≥ T` it stays until the tick passes `o.t`. That is at most the lead the order was stamped with: delay up to 3×,
  or the idle lead of 60 ticks × speed, so about 1.5 s of play. It is not the 6 s cap, and it is not forever.

## 3. F2 — consistent for place / upg / sell; hero level-up missed (R2-2)

`ctx.spendable()` is used by:

- the tower bar (`towerBar.js:151`);
- the upgrade rows' state and signature (`towerPanel.js` `upgradeStatus`; "Ordered" still takes precedence over
  "poor");
- the buy-tap message;
- placement (`placement.js:101`);
- `coopActions.place` and `upgrade`.

Other spend sites:

- **No coin cost:** abilities (`abil`, which only earns), lab (not a command, it is income), tryout `tr`. Gifts do not
  exist yet.
- **Sale:** the refund is not counted until the sale lands. That is the same as before the fix and safe, since a sale
  can be refused.
- **Phantom poor:** none after landing. `landed()` runs in the same call as `apply`, which has already debited the
  wallet. After a catch-up replay the debit and the stale-clear fall in the same frame's `reserved()`.
- **Gap:** hero level-ups still read `sim.cash`, and their coins are never reserved (R2-2).

## 4. L1 — deterministic-safe

- `stallFrac` / `stallTicks` come from `dt` (real time). They only feed `st` on the beat, which feeds the receiver's
  `stalledBy`, which changes `this.delay`, which only picks the stamp tick of *future* local orders. That tick travels
  inside the cmd.
- `CoopSim.hash()` is `hashSim(sim, { tick, wallets })`, and none of these fields are in it. A frame-0 miss (acc < 1)
  is harmless.
- `git diff origin/release/v0.1.66 -- src/sim` is **empty on both branches**.
- coop-feel-net's change to the hashed sim-id inputs is only `src/online/coop/lockstep.js` (`st`, `stalledBy`,
  `nudge`, `sentHorizon` stamping, the rejoin `sentHorizon` reset) and `version.js` (15 plus its history line). This
  explains the id change 5ba58b3fc229 → 92f3c17bbd2c.
- KNOWN[15] = 92f3c17bbd2c is pinned. KNOWN[14] is still 36cba1c215b0 (stale, left for the release assembly, as stated).

## 5. Spec §3.1a — sound

Every `_gainCashFor` / `ownerCash` site in `src` is listed:

- `Sim.js:547` (`_bake`)
- `Sim.js:1069` (the treasurer's lifted interest): the "twice"
- `abilities.js:1034`
- `lab.js:260`
- `hubs.js:104`
- `tryout/pep.js:306,356,370`
- `tryout/index.js:360`
- The command layer (`commands.js:166-231, 396`) only flushes.

Players are they/them throughout. Every she/her in the spec refers to a girl (unit). S3 (each client marks the loss in its own log;
the host-lost case is discarded on adopt) and S4 (the counter tests) are adequate.

Nit (not blocking): `lab.js:132-137` (who a Tenka absorbs: the girls of the same `owner`) and `rings.js` (per-owner
counts) are neither in the "moves to `ctrlOf`" list nor in the "stays by owner" list. Say which.

## Findings

**R2-1 (Medium, test reliability; both branches): the F1 e2e step is timing-dependent.**

- Where: `e2e/coop-rejoin.mjs:316-317` taps right after `L.receive` is swapped. The guest's last beat has already
  promised a horizon about one lead ahead, so the order can land within that horizon before any stall starts.
- What happened: on coop-feel run 1 it did exactly that. Tap 1 had `stalled:false` and the upgrade bought, then taps 2–8
  read `res:false` (no next tier affordable), so the step failed. The code was fine: `sent: 1`.
- Fix: before the first tap, wait until the host really waits.

  ```js
  for (let i = 0; !L.stalled && i < 100; i++) await new Promise((r) => setTimeout(r, 50));
  ```

  With this, the fixed code passed and the old code failed (`sent: 2`).
- Also: the second check (`:333`) cannot tell one tier from two when only one is affordable. Either assert
  `f1.sent === 1` there too, or pick a girl that can afford two tiers.

**R2-2 (Low, both branches): hero level-up ignores held coins.**

- `heroLevels.js:128` and `heroWidget.js:124,133` test `sim.cash`, not `ctx.spendable()`.
- The `hlv` order itself is not entered in `coopPending`, so its price is never reserved. A level-up, followed by an
  upgrade tap within the delay, passes both checks, and one of the two comes back refused on landing.
- No double-buy is possible: `hlv` carries the level.
- Fix: use `ctx.spendable?.() ?? sim.cash` in `levelUp` and in the widget's `poor` toggles, and add
  `coopPending.hero(cmd, price)`, a cost-only entry cleared by `landed()`.
- Cosmetic: `upgradeTree.js:95` also shows `cash: sim.cash`. Pass `ctx.spendable()` there.

**R2-3 (Low, both branches): a voided in-place order can show "Ordered" for up to ~1.5 s after a catch-up.**

- Context: §2, an order the host never got with `o.t ≥ T`.
- Impact: during that window a tap on that path returns `'queued'` and sends nothing (a swallowed tap). Nothing is
  bought twice and nothing is held for long.
- Fix: also treat an entry as stale when the lockstep no longer knows its command (voided). The keys already match
  (`cmdKey = ${p}:${s}`).

  ```js
  createCoopPending({ tick, paused, known: (k) => ls.known.has(k) })
  ```

  In `expire()`: `if (known && !known(k)) → stale`, checked only when not paused.

**Info:** in-place catch-up replays run the guest's kept orders without `onApplied`, so the "upgraded" toast and sound
for those are skipped. This is pre-existing and display only.

## Not changed / not pushed

This review only adds this file on `review/coop-feel-r2`. The R2-1 wait was applied locally for the re-run and is not
pushed to any feature branch.
