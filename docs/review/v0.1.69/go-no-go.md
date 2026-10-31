# v0.1.69 go/no-go — release/v0.1.69 @ 218c3c16

Independent go/no-go reviewer, 2026-10-31 (21:02–21:45 UTC). Live: main a3d97a38 (v0.1.68, COOP 16).

## Verdict: GO, on one condition: fix one line of the patch note first

Merge integrity, saves, the COOP 16/17 gate, co-op play between two 17 clients, smoke and the unit tests all pass on
218c3c16. The condition: the v0.1.69 patch note says a returning co-op player "gets everything back", but the coins
handed out are not returned (spec D9). Fix that one sentence (wording in §5) before the push to `main`. It is a text
change in `src/data/patchNotes.js` and no test pins the old sentence, so the sim id, COOP and digests stay as they are.
No gate needs re-running after it except `npm test` in the deploy. If the patch note cannot be changed, my verdict is
NO-GO, because the note would promise players something the game does not do.

## 1. Merge integrity — OK

Rebuilt from a3d97a38 by merging the three reviewed SHAs in the release's order
(fix/suzu-azami-boss 3232d2fa → feature/art-v3c f56b7057 → feature/coop-sharing 8b390971). Every auto-merged
file is byte-identical to 218c3c16; `git diff <my merge> 218c3c16` is empty once the conflicted files take the
release's resolution. The conflicted files, and every hunk the release adds beyond the reviewed branches:

| File | Release hunk vs the reviewed branch | Verdict |
|---|---|---|
| `src/data/patchNotes.js` | one combined v0.1.69 entry (the branches each had their own) | expected; see §5 |
| `src/online/coop/version.js` | the 17 comment names both Suzu/Azami-on-bosses and co-op sharing; `COOP_PROTOCOL` 17 on both sides | comment only |
| `tests/fixtures/simIds.js` | `17: 'e4001588f40b'` (suzu had 59785dd417a6, coop-sharing 28f9ca5dd4b1: the combined sim is new) | expected; matches the built `version.json` sim e4001588f40b |
| `tests/art/itemArtRuntime.test.js` | KNOWN-id comment for 17 names both changes | comment only |
| `tests/online/coopFreeplay.test.js` | protocol 17 test title names both | text only |
| `tests/online/engines.test.js` | three `ckDigest`/`finalDigest` pairs re-pinned for the combined sim; ticks, wallets, lives, final, hashes and casts unchanged | expected (snapshot digests fold `bossBellSpec`) |

No other extra hunk. No sim file differs from what the reviewers saw.

## 2. Smoke "SSR Select Ticket" — not reproduced (pre-existing at most)

`node e2e/smoke.mjs` (all three viewports), 3× on 218c3c16 and 3× on a3d97a38, each pair run side by side:

| Run | release 218c3c16 | main a3d97a38 |
|---|---|---|
| 1 | 691 lines, 0 FAIL | 691 lines, 0 FAIL |
| 2 | 0 FAIL | 0 FAIL |
| 3 | 0 FAIL | 0 FAIL |

The SSR Select Ticket steps passed at every viewport in all six runs (9/9 per build). The flake the assembler saw did
not show here on either build, so there is no evidence of a regression; the step (`e2e/smoke.mjs` ~L176–203, timed
waits on a fading confirm dialog) is unchanged by this release.

## 3. Save safety — OK

- `src/core/` and `src/systems/` are untouched by the release; `src/data` changes only `balance.js` (Azami boss row),
  `coop.js` (grace/gift constants) and `patchNotes.js`. The battle-save snapshot (`src/ui/battle/snapshot.js`) adds
  only `bossBellSpec: 'derived'` (recomputed, never written); `RECORD_V`/`SNAP_V` unchanged.
- Round trip (script with both trees' `src/systems/save.js` + `patchGifts.js`): a profile with every girl and every
  patch gift claimed (incl. the v0.1.69 gift) written by v0.1.69 and migrated by v0.1.68 is identical to v0.1.69's own
  migration of it, and the reverse is identical too. No `migrationDropsData`.
- Co-op sharing adds nothing to saves: no added line under `src/` touches `profile`, `store.*`, `commit(` or
  `localStorage`; lend/gift state (`t.ctrl`) lives only in the Sim; rewards still come from `applyCoopResult`.

## 4. COOP gate — OK

Built v0.1.68 (a3d97a38, GITHUB_RUN_NUMBER=68) and v0.1.69 (218c3c16, =69) and served both from one origin
(`/v68/`, `/v69/`) so the local adapter (`?online=local`) pairs a tab of each:

- 16 host + 17 guest: refused. Host: "Bea is on v0.1.69 and you're on v0.1.68. Tap Update to get the newest version —
  then you can play together. (proto 16≠17 · sim e3c222f3≠e4001588 …)". Guest: "Aiko is on v0.1.68 and you're on
  v0.1.69, the newest. Ask Aiko to reload the page …". Start stays disabled, no battle, no page errors.
- 17 host + 16 guest: the same two messages, roles swapped. Clean.
- 17 + 17: paired, no mismatch line.
- 17 + 17 play: `e2e/coop-sharing.mjs` on 218c3c16: first run 29/30. The one FAIL was "the grace over (60 s after the countdown showed)",
  under heavy load (two smoke runs alongside): the hand-out did happen, because the next two checks ("their girls are
  yours now" and an upgrade of a handed-over girl) passed. It was re-run after the smokes finished: **all checks ok
  (30/30, 252 s)**, hashes agree throughout. The grace is counted in sim ticks × speed, so a sim running slower than
  real time takes longer to reach it. The test's 60 s wait is tight on a loaded machine. That is a test-timing low,
  not a game bug.

## 5. Patch note — needs one wording fix

Top entry `v0.1.69`, dated 2026-10-31, player-facing, no other games' or anime names (diff scanned). Checked against
the code and spec:

- **Inaccurate (fix before ship):** "…their girls and coins are shared out to you, and they get everything back if they
  return." After the 20 s grace a returner gets their girls back but **not** the coins (spec D9 "Not returned on a
  rejoin"; `src/online/coop/commands.js:296` "not the coins: D9"). Suggested: "…their girls and coins are shared out
  to you. If they come back, their girls go back to them; the coins they had stay shared."
- Low: "tap your ally's name to send them coins" — it is the coin "+" button on the ally's chip
  (`src/ui/online/coopHud.js:30`). Suggested: "tap the coin button by your ally's name".
- Accurate: lend from her panel, take back between waves (D7); Suzu/Azami bells and strips under bosses, bells ride
  flyers; the 24 names (23 redrawn + Norika's first), stands unchanged; Hikari's teal eyes (art-v3c commit).

## 6. npm test and 390x844 look

- `npm test` on 218c3c16: 6969 passed / 5 failed / 11 skipped (1318 s) on the first run, alongside two smoke
  runs. All 5 failures were wall-clock limits: the `perf.mirror` and `perf` step budgets, and 5 s timeouts in
  `potential` and `rules` "4-1 calm point". Those 4 files re-run alone: **68/68 passed**. The assembler reported
  6974 passed on the same commit.
- 390x844 battle (built v0.1.69, 1-1 Easy, Hikari + Aoi, Suzu, Hana, Noa, Rei): the v3 thumbs show on the tower bar,
  every visible image loaded, no 4xx/5xx, no page errors. `battle-390x844.jpg`.

## Skipped

Nothing from the list was skipped.
