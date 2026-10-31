# Cosmetics 2 — independent review r2 (delta)

Target: `origin/feature/cosmetics-2` @ `58a71365`. This is the merge of `release/v0.1.66` @ `26dd6ab6` into the fix commit
`2e5d5808`. Round 1 (`review-r1.md`) reviewed `6d271600`. I used a fresh clone. Release was checked out side by side as a
worktree for comparison.

## Verdict: NOT OK. One fix needed (N1). Fixes M2 and L2 are good. M1 is fixed in Edit Profile, but the same secrets still leak in two other places.

## Findings

**N1 (MED): new secret rewards still give away the secret in the Achievements tab.** I checked a fresh save (empty
localStorage) and a late veteran without the secrets, at 390x844 and 844x390.

- **Secret row → ladder sheet.** `src/ui/screens/achievements/list.js:152-153` draws the ribbon chip and the title chip
  even when the step is `hidden`. The step text reads `???` / `Hint · …`. Next to it, the chips show the "Bravest of Them
  All" plate and carry `title="Honor Ribbon · Looking-Glass Ribbon"` / `title="Title · Bravest of Them All"`.
- **Tapping either chip gives the whole secret away.** `ribbonInfo` (`claim.js:197-209`) and `titleInfo`
  (`claim.js:216-229`) print `From <name> · <desc>` with no secret check. Probe output on a fresh save:
  `Looking-Glass Ribbon · From Mirror, Mirror · Defeat the Mirror Queen 25 times.` This works for all four secrets that
  this branch gives a ribbon (`a_close_call`, `a_gold_rush`, `a_not_fooled`, `a_mirror_mirror`). On release none of them
  had a ribbon, and only `a_close_call` had a title.
- **Case → Titles sheet.** `claim.js:241-244` (`titlesSheet`) renders `titlePlate(t.id, { small, locked })`. Its plate text
  and `aria-label` are the real name ("Cool Under Pressure", "Bravest of Them All"). The `How:` line under it is already
  hint-safe (`systems/honors.js:166`).

Release already leaks "Cool Under Pressure" here (my probe on `26dd6ab6` shows it in the Titles sheet and in Edit
Profile). This branch adds "Bravest of Them All" and the four ribbon names, plus their exact requirements via the chip
sheets.

Fix:
1. In `ladderSheet` stepEl, when `hidden` is true, skip both chips, or draw a grey secret ribbon (`ribbonArt(id, 34, { secret: true })`)
   and a `???` plate (`titlePlate(id, { small: true, text: '???' })`), with no `title=` attribute and no onclick.
2. In `titlesSheet`, pass `text: '???'` when `a?.hidden && !t.owned`. Add an `owned` guard to `ribbonInfo`/`titleInfo`
   too: for a hidden, unclaimed achievement, show `???` and the hint.
3. Extend the e2e leak check (`e2e/cosmetics.mjs` §3b). Right now it reads only the picker's `textContent`. Make it scan
   `document.body.outerHTML`, which includes attributes, after opening the Titles sheet and the secret ladder sheet and
   tapping its chips.

**N2 (LOW, note): the hidden hint wraps badly in the ladder sheet at 390x844.** The text column is about 40 px wide, so
the hint wraps one word per line (`r2/390x844-fresh-secret-ladder.png`). It goes away once the chips are dropped (N1
fix 1).

## Verified OK

- **M1, Edit Profile:** with no secrets earned, both titles show `✦ ???` and `Hint: …`, the button is disabled and
  `aria-label="Title: ???"`. `data-title` holds only the id. Once the secrets are earned, both names show and both can be
  picked. Screenshots: `r2/pick-390x844-nosecrets.png`, `r2/pick-844x390-nosecrets.png`, `r2/pick-390x844-secrets.png`.
  The probe found no leak on the profile card, the achievements list, the Secrets category or the Case.
- **Published JSON / friend cards / toast:** `profileCard.js:246` publishes only the worn title. A title can only be
  worn once earned (the picker is disabled, and restore is gated by `titleKeepable`). Showing a friend's earned secret
  title is intended. `achToast` fires only on claim.
- **L2:** `isFreeplayFrame` checks `FRAMES[id].group === 'freeplay'` (eclipse, tide, endless), on both your own card and
  others'. On live main, `freeplayEarned` was true for any earned frame: UR Rainbow and the event frames such as pumpkin
  showed a Freeplay panel holding only a "UR Rainbow" chip. A player with only Rainbow now sees no Freeplay panel
  unless they have played Freeplay. That matches the panel's rule ("no records and nothing earned: no panel"), so it
  fixes a bug rather than causing a regression. `freeplayEarned` is used only by `profileZero` → `profile.js:335`.
- **M2, merge:** `release/v0.1.66` is an ancestor of the tip.
  - `git diff origin/release/v0.1.66 origin/feature/cosmetics-2 -- src/sim src/online tests/sim` is empty.
  - `simId()` gives `5ba58b3fc229` (91 files) on both the feature branch and release. `COOP_PROTOCOL` stays 14, and no
    bump is needed.
  - Patch notes: v0.1.67 (2026-10-31) sits above v0.1.66 (2026-10-31), and the v0.1.66 entry is unchanged.
- **Content:** the delta has no other games' names and nothing sexualised.

## Runs (at 58a71365)

- `npm test`: 420 files passed, 3 failed, 2 skipped; 6654 tests passed, 5 failed, 11 skipped.
  - 4 of the failures are the known ones: itemArtRuntime sim-id pin and 3 engines.test.js checkpoints. All 4 also fail
    on clean `26dd6ab6` (4 failed / 41 passed).
  - The 5th failure was `tests/sim/perf.mirror.test.js`, a wall-time budget test. It failed while e2e browsers were
    running at the same time. Re-run alone, it passes (2/2).
- `node e2e/cosmetics.mjs`: ALL OK (60 checks, 3 viewports).
- `node e2e/smoke.mjs`: 676 ok, 2 failures. Both are the known "drag (touch): releasing places aoi…" failures, which
  also fail on release.
