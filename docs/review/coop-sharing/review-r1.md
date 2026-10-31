# Co-op sharing — independent review r1

Reviewed `feature/coop-sharing` @ `44aa36b8` (on main `a3d97a38`, v0.1.68, COOP 16 → 17, sim id `6236af328f25`). I used a fresh
clone and compared it against a `main` worktree at `a3d97a38`. I read CLAUDE.md, `docs/specs/COOP_SHARING.md` (§9 is as built), `docs/ONLINE.md`,
and the whole diff (`commands.js`, `ctrl.js`, `Sim.js`, `abilities.js`, `hubs.js`, `lab.js`, `simHash.js`, `version.js`, and the UI).

## Verdict: NOT OK (two medium findings; everything else holds)

Lockstep safety, solo bit-identity, the leave / grace / hand-out flow, old-build refusal and the UI all hold up. Two
economy/ability exploits come from a lend changing which player's ability bookkeeping a girl counts under. Both are
small fixes. Ship once they are fixed (or the owner accepts them).

## Findings

### M1: Lending a copy skips her group's shared map-ability cooldown (Medium)
`src/sim/abilities.js:166` keys `groupKey` by `ctrlOf(t)`. A lend moves her into the receiver's group key, which usually has no
entry and so is ready. `lend` is allowed during a wave, and `give` is allowed at any time.
Probe (`probes/probe.test.js`, "map-scope shared cooldown"), with the host owning two Shiro copies at tier 3 (Verdict, a map strike):
cast copy 1 → ok; cast copy 2 → `cooldown`; `lend` copy 2 → ok; the guest casts copy 2 → **ok**; `give` → ok.
All four steps fit in one tick. The team gets a map ultimate once per copy instead of once per group cooldown. Both views agree, so this is
not a desync, but it doubles (or more) the map-wide ultimates.
**Fix:** when control changes (`commands.js:241` `setCtrl`, and in `handOut` / `giveBack`, which call it), carry the old group's
remaining cooldown onto her: `if (t.abil?.scope === 'map') t.abil.cd = Math.max(t.abil.cd, sim.abilGroups.get(oldKey)?.cd || 0)`. Do it before
`t.ctrl` changes. It is deterministic, and `a.cd` is already in the snapshot. Alternatively, refuse `lend` / `give` while her group cooldown is above 0.
Add a test: cast, lend, try to cast → `cooldown`.

### M2: Lending an econ girl gets past the econ cap of 2 casts per player per wave (Medium)
`src/sim/abilities.js:1274` (refusal) and `:1346` (count) count `abilUses` under `ctrlOf(t)`.
Probe ("econ cap per wave"): the host has three Market Day Momos. Casts 1 and 2 → ok; cast 3 → `cap`; `lend` Momo 3 → the guest
casts → **ok**. The coins go to the guest, who can gift them straight back. With an econ-less partner, the team gets 4 econ casts a wave
instead of 2, plus Bake Sale on top.
**Fix:** count the cast against her owner as well. Either refuse when `abilUses[t.owner]` **or** `abilUses[ctrlOf(t)]` is at the cap
and increment both, or simply keep the cap on `t.owner` (the cap is about a loadout's econ girls). The coins can still go to the
controller. Add the probe as a test.

### L1: The grace is fixed at the game speed of the moment the player went (Low)
`commands.js:360` `at: tick + graceTicks * speed`. Probe: go at 1×, then switch to 3× → `at` stays 1200, so the grace is about 6.7 s
of real time. Going at 3× and dropping to 1× gives about 60 s. The countdown line (`coopHud.js`) divides by the current speed, so
it stays honest, but "about 20 s at any speed" is only true if the speed does not change.
**Fix (optional):** keep the remaining grace in 1/6-tick units (the LCM of 1, 2 and 3) and subtract `6 / speed` each step.
It stays integer and deterministic, and it goes into `shareDigest`. Or document that the speed is taken when the player goes.

### L2: The 'lobby' drop's feed line does not mention the hand-out (Low, copy)
`src/ui/battle/controller.js:1500`: "went back to the room. Their girls stay and keep fighting." A `lobby` drop
(`session.js:579`) is a `gone` marker, so the girls and coins *are* handed out after 20 s. The `left` and `lost` lines were updated;
this one was not. **Fix:** "… went back to the room. Their girls keep fighting, and in 20 s they and their coins are yours."

### L3: At 844x390, feed toasts overlap the co-op chip strip (Low, UI)
`r1-shots/share-02-lent-out-host-844x390.jpg` and `share-04-grace-countdown-844x390.jpg`: "Bea is …" and "Bea left. … Bea's
coins are yours" are drawn under or over the `CO-OP` strip, which is wider now that it has the gift button. The text is half hidden.
**Fix:** start the feed below the strip in compact layouts (offset by the strip's height), or shorten the strip.
The "Open in another tab / Reload" banner in the shots comes from running two pages in one browser, not from this branch.

### L4: The S4 test proves less than its title says (Low, tests)
`tests/online/coopSharing.test.js:472`: it applies one team `result()` to two fresh profiles. It shows that the shared counters
match with and without sharing. That holds because coop results are team-wide and gifts never go through `_gainCashFor`.
It does not exercise a gift ping-pong loop (only one gift each way) or a controller sell. **Fix:** add ×N gift ping-pong
and a lend → controller sells → refund leg, and assert that `cashEarned` and the payouts are unchanged. I checked both by hand:
a gift is a wallet move, and `sellTower` does not touch `cashEarned`. The refund is `floor(spent × max(0.7, sellMul ≤ 0.9))`,
so it can never exceed what was spent.

### Info (no change needed)
- **Orders from a leaver during the grace still apply.** For example, a gift from the gone slot → ok (probe `leaverGift`). In real lockstep these
  are only the leaver's in-flight orders, applied the same way by every client that runs them. This is harmless.
- **`handOut` with nobody left** (`commands.js:257`) drops the pending deal. If one leaver later returns, the other
  leaver's girls and wallet are never handed out. This cannot happen with two players, because the surviving client never marks itself gone. Only worth a
  comment until rooms grow past two (`COOP.colors` has two entries, and the UI uses `1 - mySlot`).
- **Lend then controller sell** moves about 70 % of the girl's spent value to the controller at once, outside the 2 s gift limit. The owner chose
  to lend, and gifts have no cap other than the limit, so this is acceptable.
- **The deliberate-Leave grace is a sensible reading** of "when someone leaves … after a 20 s grace". It treats a Leave and a lost
  link the same way, which means a mis-tap or a quick return doesn't lose anything. I would keep it.
- **One final tier per path stays per owner, and that is right.** The loadout and stats are the owner's, so a lent copy may not take a path her
  owner's other copy holds. The controller's own copies follow the controller's own rule, as in co-op without sharing.
- **The econ abilities do not double-count.** Bake Sale (`_bake` → `ctrlOf`), Market Day (`econ.cast`), the lab share (`labIncome`)
  and Ouka's bounty (`payHubBounty`) each credit exactly one wallet, the controller's. Per-wave pooled income is unchanged.
- **The hand-out is fair as specified.** It gives one girl at a time in uid order to whoever then commands the least spent value, heroes are excluded from
  both the girls dealt and the spent totals, and girls lent to the leaver go home first (`commands.js:255`). The three-player D10
  test covers it.

## Lockstep probes (both views / both pages: identical results, identical hashes)

The sim-level probes (`probes/probe.test.js`, two CoopSims, one per slot; every command's result and the hash were compared after each
command) covered these cases:
- gift spam (4 in one tick → 1 ok, then `cooldown`);
- a gift over the wallet → `cash`;
- the CASH_MAX clamp (the builder's test);
- lend then owner upg / sell in the same tick → `notYours`;
- sell then lend → `notYours`;
- double lend → `notYours`;
- hero → `hero`;
- Tenka → `lab`;
- lend during a wave → ok;
- back during a wave → `wave`;
- back during a wave with the controller gone → ok;
- give with the owner gone → `gone`;
- orders after the grace → `notYours` / `cash`;
- join after the hand-out (the lent girl stays a lend);
- a speed change during the grace.

My own two-page Playwright probe (`probes/zz-review-probe.mjs`, local adapter, through `ls.queue`) covered these cases, with identical per-command results on both pages:
- 6 gifts in a row, plus gifts of 999,999,999, 2^53, −50 and one to myself;
- sell + lend, and lend + sell, in one tick;
- lend + owner upg + re-lend;
- the guest re-lends, then gives back;
- back during a wave;
- cut the guest → lend to a gone player and back while the controller is gone;
- **join during the grace** (the pending hand-out is cancelled; hashes agree);
- cut again → after the grace, the guest's girls and the lent girl are the host's;
- a stale guest upg and gift while cut;
- **join after the hand-out** (the girls are the guest's again on both pages; hashes agree after the rejoin).

The state hashes agreed in every window. In the run that counts, the only failing check was my own setup wait (wallet ≥ 900) timing out.

## Proofs and runs

| What | Result |
|---|---|
| `npm test` (branch) | 439 files, **6958 passed**, 11 skipped, 0 failed |
| Solo `MODES_*` (15 battles, a bundle built from each tree) | branch ≡ main ≡ `solo-proof.json` (digest `964d4bf0`; every state, wave, lives, steps, 600-step hash and final digest) |
| noNerfGate `--support none` (solo), branch vs main | 4455 cells each, **0 under**, output **byte-identical** |
| `e2e/coop-sharing.mjs` ×3 | 30/30, 30/30, 40/40 (the third with shots; every JPEG ≤ 130 KB) |
| `e2e/coop-rejoin.mjs` ×5 branch / ×5 main | branch 4/5, main 4/5. Both failures take the same route: the guest took the **catch-up path** instead of the checkpoint restore (branch: the rejoin check, `kind: catchup`, 92 ticks; main: the resync check, `kind: catchup`, 305 ticks). Hashes agreed afterwards in both. **Not branch-only**: a pre-existing test expectation flake. A "near" guest legitimately catches up. Suggest the check accept `catchup` when hashes agree. |
| Older builds | `sameVersion` needs `proto` equal, so 17 ↔ 16 is refused both ways (unchanged code, constant bumped). Nothing new is saved: co-op battles are never saved, `t.ctrl` never appears in solo, and the profile writes are identical (S4). |

Other runs (all on the branch):
- `e2e/engines.mjs`: OK, 3 runs on 2 engines (Node V8 and Bun JSC; Firefox and WebKit are not installed here), every battle identical.
- `e2e/multiplayer.mjs`: all checks passed (85 ok).
- `e2e/coop-freeplay.mjs`: all checks ok.
- `e2e/smoke.mjs`: all three viewports, ALL SMOKE CHECKS PASSED (681 ok).
- **The co-op engine scenarios, branch vs main** (`runEngineChecks` bundles from both trees, diffed): every tick, state, wave, wallet,
  hash, hash checkpoint and pick is identical. So a battle without sharing hashes the same as on main. 21 values differ, and every one is
  a digest of a co-op *snapshot* (`ckDigest`, `finalDigest`, the Tryout `lastDigest`), which moved because of checkpoint v 2's new fields,
  plus `lobby` (`coopVersion().data`, which now hashes the new `COOP` constants and adds an extra refusal of old builds). This is expected,
  but spec §9's "only the three checkpoint digests moved" undercounts it: there are 21 snapshot digests across 11 scenarios. **Doc nit:** fix the sentence.

## UI (my run's screenshots, `r1-shots/`)
These are the gift sheet (844), the lent-out drawer "Lent to Bea · Take back · Between waves" (844), the lent-in drawer "Lent by Aiko · Give back"
(1280), the grace line "Ally left — their girls are yours in 20 s" (844), and the handed-over "Bea's girl · yours while they are away" (1280).
They read well, the girls' pins keep the owner's colour, and players are they/them throughout ("their girls", "they give her orders"). No
other game's name appears in the copy, the docs or the commits. The issues are L2 and L3.
