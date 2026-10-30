# v0.1.65 go/no-go, round 2: "The Summoning Gate Opens"

Target: `release/v0.1.65` @ c34f7bd3 (off main c6d06118). Round 1 (`review/v0.1.65` f7d33d99, `review.md`) was NO-GO on the set-look promise in the patch note and on a flaky `e2e/item-art.mjs --expect-art` fallback probe at 1280x720. Delta `ba13dcf7..c34f7bd3`: the patch-note rewording, the probe's wait, and a new fix where a Mailbox-gifted ribbon reads "a gift" (`honors.ribbonEarnedNote` + `achievements/case.js` + `tests/systems/ribbonEarnedNote.test.js`). Reviewed 2026-10-30 (Central).

## Verdict: GO

## Findings

1. **Round 1 finding 1 is fixed.** The gear line now reads "chunkier 3D-style pieces whose shape and trim grow fancier with rarity." It makes no set-look promise.
2. **Round 1 finding 2 is fixed.** `item-art.mjs --expect-art --viewport 1280x720` passed **3 of 3** runs (145 ok each, all 4 fallback checks ok). The new wait cannot hide a real failure:
   - Both waits are bounded: the cinematic gets at most 5 s, and the page gets at most 6 s to go quiet.
   - When a wait runs out, the script prints a note and goes on to the probe. It does not skip anything. None of the 3 runs printed a note.
   - The probe's own assertions and its 0.3 s and 0.9 s timings are unchanged.
   - It closes the results through the real `reveal-close` button and only then waits for the cinematic to go.
3. **The honors fix works in a browser.** I seeded a late veteran save with the Starlight Vigil ribbon gifted (`hgift:`) and not claimed, plus a claimed Valedictorian, and opened all 37 ribbons at 1280x720 and at 390x844 (the modal). I compared every detail's text against main c6d06118:
   - Only the gifted ribbon changed: main shows "Yes · came with the title ✦ Starlight Guardian", and release shows **"Yes · a gift"**.
   - All 72 other detail texts are identical.
   - A claimed achievement still shows "came with the title ★ Valedictorian".
   - Gifted and claimed together shows "came with the title ✦ Starlight Guardian".
   - Screenshots: `shots-r2/case-gift-*.jpg`.
4. **The patch note passes.** It has 6 bullets (3 added, 2 changed, 1 fixed), friendly and accurate. Every promise is visible in the build. It names no players and no other games, and it is dated 2026-10-30, today in Central time.

## Gates

| Check | Result |
|---|---|
| Sim id | be940ecb2087 ✔ |
| `COOP_PROTOCOL` | 13 ✔ |
| `src/sim`, `src/online` vs main | no diff ✔ |
| FULL `npm test` | 392 files passed, 2 skipped. 6255 tests passed, 1 expected fail, 11 skipped ✔ (the first run hit a 5 s timeout in the unchanged `tests/sim/rules.test.js` while my browser checks ran in parallel. That file passed alone, and the full rerun with nothing else running was clean) |
| `e2e/smoke.mjs` | 678 ok, 0 fail (226 × 3 viewports) ✔ |
| `vite build` + secret scan | ok. Only the known `assets/dist-*.js` false positive ✔ |
| `item-art.mjs --expect-art` | 1280x720: 3/3 runs pass. 390x844: passes ✔ |
| 390x844 spot-check | 10× recruit: `recruit-cinematic.mjs` 46 ok, and the results show 10 cards. Pep Talks: every list check in `tryout.mjs` is ok, and the same 5 layout fails that round 1 traced to main are still there (not new). Gear: 95 icons baked, 0 failed, no sideways scroll, no page errors, and the UR, SSR and rarity looks are right. `ur-gear.mjs` 72 ok ✔ |

Screenshots: `docs/review/v0.1.65/shots-r2/`.
