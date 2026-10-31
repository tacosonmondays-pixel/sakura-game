# Co-op feel — independent review r1 (Oct 31, 2026)

Targets, both off `release/v0.1.66` @ d315d38 (the release tip has since moved to 26dd6ab; both merge clean):

| Branch | Commits | Sim id | Verdict |
|--------|---------|--------|---------|
| `feature/coop-feel` (display only) | 69832b1, c6e68e2 | 36cba1c215b0 (= base, unchanged ✔) | **OK with one fix (F1)** |
| `feature/coop-feel-net` (COOP 15) | 6fc8dff, 4b0417d, merge ed3ff65 | f1bff1b35e09 | **OK** (the netcode is safe); carries F1 too, and needs the M1 re-pin when merged |

## Runs

- `npm test`: coop-feel **6647 passed / 11 skipped (421 files)**; coop-feel-net **6649 passed / 11 skipped (421 files)**. 0 failures.
- e2e on coop-feel-net: `coop-rejoin` all 19 ok; `multiplayer` 85 ok; `engines` OK (V8 + JSC, 3 runs; Firefox/WebKit not installed here);
  `coop-freeplay` 57 ok / 1 FAIL ("the crossing: the glitch banner shows on both screens") — **pre-existing**: the base
  d315d38 fails the same check the same way (re-run alone, 57 ok / 1 FAIL on both). Not caused by these branches; worth its own ticket.
- Merged tree (release tip + coop-feel-net, sim id 79ca7fe0384d): `engines.test.js` fails 3 (returning abilities, Tenka, gear sets) —
  **the release tip alone fails the same 3** (its Sim/status/enemies change after d315d38 was not re-pinned). See M1.

## Latency (`tools/coopLatency.mjs`, COOP_NET.supabase, 150 s per row; own = tap → my screen, ms, median / p90)

| Mode | RTT/jit | Before (COOP 14) own | stall h/g | After (15) own | stall h/g | After + `--nudge 800` own | msg/s before → after |
|------|---------|------|------|------|------|------|------|
| busy | 0/0 | 517 / 517 | 0/0 % | 517 / 517 | 0/0 % | 517 / 517 | 4.1 → 4.1 |
| busy | 100/30 | 517 / 517 | 0/0.1 | 517 / 517 | 0/0.1 | 517 / 517 | 4.0 → 4.0 |
| busy | 200/60 | 517 / 517 | 0.1/0.1 | 517 / 517 | 0.1/0.1 | 517 / 517 | 4.1 → 4.1 |
| busy | 200/200 | 517 / **1517** | 0.2/**11.5** | 550 / 700 | 0.3/2.1 | 550 / 700 | 3.6 → 3.9 |
| busy | 300/300 | 683 / **1517** | 0.5/**30.7** | 733 / 900 | 3.1/3.7 | 733 / 900 | 3.6 → 3.5 |
| pause | 0/0 | 967 / 1017 | 0/0 | 767 / 1000 | 0/0 | **517 / 517** | 3.5 → 3.5 |
| pause | 100/30 | 1017 / 1017 | 0/0.1 | 750 / 933 | 0/0.1 | **517 / 517** | 3.5 → 3.5 |
| pause | 200/60 | 1000 / 1017 | 0.1/0.1 | 850 / 1000 | 0.1/0.1 | **517 / 517** | 3.5 → 3.5 |
| pause | 200/200 | 1017 / 1517 | 0.2/8.6 | 667 / 917 | 0.3/2.0 | 550 / 683 | 2.8 → 3.4 |
| pause | 300/300 | 1017 / 1517 | 0.5/22.8 | 867 / 967 | 2.7/3.7 | 700 / 933 | 2.7 → 2.9 |

Final delays before 30/90 (the stalling guest punished itself) → after 43/35, 55/37. All rows hash-ok. Reproduces the
branch's claims; the jittery p90 drops from ~1.5 s to ≤ 0.9 s, the guest's stall from 31 % to 4 %, at about the same message rate.
(No loss/reorder in the tool: Realtime is one ordered websocket; the lockstep tests cover loss.)

## Netcode (coop-feel-net) — safe

- **Horizon promises never broken.** `queue()` stamps at `max(tick + delay, sentHorizon + 1)`. `sentHorizon` is set in the
  only place a horizon is sent (`beat`, lockstep.js:398) to the exact value sent, and only grows; an unsent `promised` binds
  nobody. Any later beat whose horizon covers the new cmd carries it (unacked cmds ride on every beat), and the peer applies
  horizon and cmds from one message synchronously, so it can never run tick t without the cmd. Reorder: `peer.horizon = max`.
- **Rejoin**: guest resets `promised` and `sentHorizon` to `tick − 1` (lockstep.js:835-836) while the host sets that peer's
  horizon to `T − 1`; old-epoch packets (incl. their `st`) are dropped by the `ep` check before `stalledBy`. Correct.
- **`st` abuse**: bounded — at most one delay step per beat, capped at `maxDelay` (3×), and it only slows the *receiver's own*
  orders (no sim effect: the delay only picks the stamp tick, which travels in the cmd). A hostile client could hold my delay
  at 1.5 s; it could already stall the game. Low (L1).
- **`nudge()`**: only moves `lastQueued` forward; horizons never shrink, sends nothing. Not abusable.
- **Old clients**: COOP_PROTOCOL 15 + new sim id → `sameVersion` refuses 14 both ways (coopFreeplay.test.js, coopSession.test.js
  hello/start refusal). ✔
- **Harness changes are legitimate**: `alignTicks` only runs ticks both horizons already cover (no orders, no promises) so the
  final hashes compare one tick; the abilities ordering and the staff guest's "ult only mid-wave" avoid refusals the new
  timing exposes; every pinned *outcome* (state, wave, lives) is unchanged. No assertion was loosened.

## Findings

**F1 (Medium, both branches) — the 6 s cap re-opens double upgrades during a stall.** `coopPending.js:31-38` expires by wall
clock. When the ally freezes for 6–12 s (under `COOP.timeoutMs` 12 s, so no drop), the order is still queued but "Ordered"
reverts to the price and `upgrading()` is false, so a second tap queues a second `upg` of the same path; both run when the ally
is back and buy two tiers. Reproduced in the browser (link held 6.6 s: `stillOrdered:false`, second tap `'queued'`, 2 `upg` in
the log). The old `pendingUpg` Set had no expiry. **Fix**: store `cmd.t` in the entry and expire on the lockstep tick, not the
clock — stale only when `ls.tick > o.t` (the tick ran and `onApplied` never came, i.e. voided by a rejoin); or skip `expire()`
while `ls.stalled || ls.job`. Add a test: pending upgrade + stalled lockstep for 10 s → still "Ordered", `act.upgrade` → 'queued' without a second command.

**F2 (Low) — affordability ignores coins on hold.** Tower-bar cards and buy buttons test `sim.cash`, not `cash − reserved()`:
at 1280×720 two orders held 440 of 328 coins, the HUD read **0** while the 200/220 cards and the 90/80 upgrades stayed lit; one
order was refused on landing (rollback correct: HUD back to 109, no dots). Fix: pass `cash − reserved()` to the bar's/panel's
afford state in co-op.

**F3 (Low)** `clear()` (coopPending.js:65) is never called; a resync remounts the screen (fresh ctx) so it is harmless, but an
in-place rejoin keeps entries up to the cap. Call it from the session `resync`/rejoin path or drop it and its doc line.

**F4 (Low)** The "Ordered" button is 92×30 px at 844×390 (102×44 at 1280×720) — same as the buy button it replaces, and disabled,
so not a regression; the phone buy row is under 44 px tall generally.

**L1 (Low, net)** `st` counts stalled *frames* (lockstep.js:963, one per `advance`), not ticks: a 120 Hz phone raises its ally's
delay twice as fast as a 60 Hz one. Optionally clamp a reported rise by the beat interval and count in ticks.

**M1 (merge)** Release tip 26dd6ab already fails 3 `engines.test.js` fixtures; after merging coop-feel-net those 3 need one
re-pin against the merged sim (79ca7fe0384d). Protocol 15 then covers the release's sim change too.

## Spec (COOP_SHARING.md)

- **S1 (must fix before building)**: §3.1 "The Sim needs no change … `ownerCash` is credited by the command layer to
  `ctrlOf(t.uid)`" is not possible: `Sim._gainCashFor(owner, …)` (Sim.js:523) pools by **owner slot** inside the step; the
  command layer cannot tell which girl earned it. D5 needs the Sim to credit `t.ctrl ?? t.owner` (a sim change, hashed).
- **S2**: the spec calls players "she/her" (§0, D12, §3.3); house rule is they/them for players.
- **S3**: who writes the `gone[why]` marker when the **host** leaves (only the host's log is authoritative today)? Spell out the
  guest-alone timeline and that no deal-out depends on a marker the survivor never receives.
- **S4**: a lend → controller upgrades → owner takes back → owner sells moves the controller's coins to the owner. Harmless while
  rewards ignore wallets (D13); add a test that mission/achievement counters (upgrades bought, coins earned) are not credited by
  gifts or someone else's purchases.
- Determinism otherwise sound: every change is a command or a tick-scheduled deal in the CoopSim; snapshot v2 + `hashSim`
  folding only non-default state keeps old battles' hashes.

## Screenshots (this folder; the ally's packets held so the orders stay in flight, "Waiting for ally…" visible)

`ordered-844x390.jpg`, `ordered-1280x720.jpg` — "Ordered" spinner on Piercing Arrows, dotted balance (title "320 on its way").
`ghost-844x390.jpg`, `ghost-1280x720.jpg` — Aoi's ghost on her spot with her range ring, dotted balance (200 held).
