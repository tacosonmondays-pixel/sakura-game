# v0.1.64 "A Ribbon for the Night Watch": go/no-go, round 2

Target: `fix/wyrm-ribbon` at c6d06118 (off main a741aef7, v0.1.63). Delta reviewed: `git diff b563516f c6d06118`, one commit. Round 1 (review 5b75df1d, `review.md`) was NO-GO on one HIGH. Reviewer: independent; did not build it.

## Verdict: GO

The round 1 HIGH is fixed end to end. No new HIGH or MEDIUM findings.

## Gates

- `npm test` (full): 389 files passed, 2 skipped; 6205 tests passed, 1 expected fail (the Wyrm reach repro), 11 skipped. Exit 0.
- `node e2e/smoke.mjs`: ALL SMOKE CHECKS PASSED (678 ok lines, 3 viewports), exit 0.
- Sim id: `be940ecb2087`, unchanged. None of the changed files is in the sim's import graph. `COOP_PROTOCOL` stays 13. The only change under src/sim and src/data against main is `patchNotes.js`.
- Patch note: v0.1.64 is at the top, dated 2026-10-30 (today's Central deploy day), with 3 friendly bullets and no names.
- The full diff from main has no keys, no players' names and no other games' names.

## The round 1 HIGH, re-checked in Chromium (390x844 and 1280x720, vite dev)

| Step | Result at both sizes |
|---|---|
| Save with `freeplayBest {blossom: 210}`, then reload | The letter arrives with `rewards [honor:a_fp_bosses_4 ×1]` and expires 2026-12-01 01:00 UTC. |
| Reload without claiming | The rewards survive in memory and in localStorage. |
| Edit localStorage the way an old build would (`rewards: []`, `expiresAt: 9e15`, saveRev +50), then reload | Repaired: the reward is back and `expiresAt` is clamped to `VIGIL_GIFT_UNTIL`. The clamp proves the repair ran on the tampered data. There is still exactly 1 letter. |
| Mailroom: Claim | The toast reads "Starlight Vigil Ribbon added to your Honor Ribbon Case!". `hgift:a_fp_bosses_4 = 1`, `earnedHonors` includes the ribbon, gems stay 2400 → 2400, and the achievement is still unclaimed. |
| Reload, then lobby (the ensure runs again) | Still 1 letter, claimed. A second `claimMail` gives `{ok:false, error:'claimed'}`. |

There was no horizontal overflow and no page errors.

The code agrees with what the browser showed:
- `repairVigilLetter` (`src/systems/vigilRibbonGift.js:60`) runs only when `vigilGiftEligible` is true: window open, best wave ≥ 200, ribbon not owned.
- It never touches a claimed letter, and it only rewrites `rewards` on the one existing letter, so it can't add a letter.
- After a claim the ribbon is owned, the save is no longer eligible, and the repair can't run. So it can't pay twice.

## Findings

### HIGH: none. MEDIUM: none.

### LOW

1. **A crafted import can carry honor rewards** (`src/systems/save.js:382`). I imported a save holding a letter with an `honor:` reward for every ribbon, plus `honor:nope`. The load kept the 37 known ribbons and dropped the unknown one, and `claimMail` paid all 37 (`honorCount` 37). This adds no new abuse surface: a crafted save with `missions.counters['hgift:<id>'] = 1` gives the same 37 with no letter at all. Old builds keep counters word for word, and `missions.achievements` can be forged the same way. Profile honor counts are client-reported today either way. Leave as is; if honors ever matter for ranking, they need checking on the server.
2. **profileSync can stay paused for one tick** (`src/online/profileSync.js:48`, `:134`). Syncs run one after another. Suppose an `auto` sync is already waiting on `profileStatus()` when the player comes online:
   - the `online` sync clears `paused`;
   - the queued `auto` run then finishes 'skipped' and sets `paused` again;
   - the `online` run still publishes, but auto-watch stays off until the next non-auto sync.

   That next sync is the social hub tick, at most 5 minutes later (`socialHub.js:18`, `REFRESH_MS`), or the next going-online event, or a Save in the profile editor. So a player who is online always publishes again; they are never stuck. Optional fix: clear `paused` in `run` when the status is 'ready'.
3. **The single-row claim path still gives the fanfare** (`src/ui/screens/achievements/claim.js:135`). `claimOne` still plays the special fanfare and the hero strip for a ribbon the letter already gave. Only `claimAllAchievements` (`src/systems/missions.js:317`) filters it out, and that change is correct: it only narrows `honors`, while `ids`, `rewards`, `titles` and `skipped` are unchanged. This is cosmetic and pays correctly. It needs a real Wyrm clear, which nobody can do yet.

## Screenshots (this folder)

- `r2-letter-repaired-{390x844,1280x720}.png`: the repaired letter with its Claim button, after the localStorage strip.
- `r2-claimed-{390x844,1280x720}.png`: after the claim, with the toast showing.
