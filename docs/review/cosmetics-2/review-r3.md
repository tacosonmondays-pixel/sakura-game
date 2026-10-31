# Cosmetics 2: independent review r3 (final round)

Target: `feature/cosmetics-2` @ `3ccc7847`, a normal commit on top of `58a71365`. I used a fresh clone. For baselines,
`release/v0.1.66` @ `26dd6ab6` was checked out side by side as a worktree.

## Verdict: OK

N1 is fixed. I found no remaining leak of a secret's reward, name or requirement on a save that hasn't found the
secret. N2 is fixed. Two LOW items are below. Neither blocks shipping.

## Findings

**L1 (LOW, theoretical today): a ribbon-only gift makes `isSecretLocked` treat the whole secret as found.**
`src/systems/missions.js:271` returns false when `ribbonGifted(profile, id)`. Consider a save that has an `hgift:` mark
for a secret it hasn't met or claimed. That save would see the secret's title name ("Bravest of Them All"), its
requirement ("Defeat the Mirror Queen 25 times.") and its achievement name in all of these places:

- the Titles sheet;
- the ladder sheet;
- the chip sheets;
- Edit Profile → Title.

Meanwhile its list row still reads "Secret achievement", because `src/ui/screens/achievements/model.js:14` uses only
`a.hidden && !a.met`. My extended sweep confirms this ("giftmirror" state, `r3/390x844-giftmirror-secret-sheet.png`).

Live behaves differently. On release, `titleGroups` used `a.hidden && !owned` and so kept the title secret in this case.
No letter gifts a secret ribbon today: the only `honor:` gift is the Starlight Vigil ribbon, which is not hidden. So no
player can reach this state now.

Fix: drop `|| ribbonGifted(profile, id)` from `isSecretLocked`. The ribbon views (`ribbonInfo`, the Case's
`secretUnfound`) already check `owned` first, so a gifted ribbon still shows as itself. The title, requirement and name
would then follow the same rule as the list row (claimed or met).

**L2 (LOW): the e2e sweep's word list is generated from data but misses some words.**
`e2e/cosmetics.mjs:51-54` makes three choices:

- it keeps only `a.hidden && a.cat === 'secret'`, so a hidden row added in another category would be skipped;
- it checks reward names and `desc`, but not the achievement names ("Mirror, Mirror", "Where It All Began", …);
- it does not check the secret frames' `how` lines ("Secret: Where It All Began.").

Today the list covers all 6 secrets and their 7 reward names. Nothing was added in this branch outside it.

I ran a local copy with the wider list: every hidden row's `name`, `desc`, ribbon and title, and every secret frame's
`name` and `how`, 23 strings in all. It found **no leak** in all 17 views at 390x844 and 844x390.

Fix: filter on `a.hidden` only, and add `a.name` and secret `FRAMES[*].how` to the list for the fresh-save check.

## Leak audit (1)

I grepped every use of `HONOR_MAP`, `TITLE_MAP`, `TITLES`, `FRAMES`, `ACHIEVEMENT_MAP`, `.honor.name`, `.title.text`, `how`
and `desc` in `src/ui`, `src/online` and `src/art`.

- **Ladder sheet** (`list.js:140-155`): the step uses `isSecretLocked`. The chips become plain spans with a grey "?"
  ribbon and a "✦ ???" plate, with no `title` and no onclick. Each aria-label reads "Secret …".
- **List row** (`list.js:82,103-126`): the rewards column is empty, and the icon is a `secret` ribbon (honorSVG draws a
  "?", not the emblem).
- **`ribbonInfo` / `titleInfo`** (`claim.js:203,228`): both are guarded. They are unreachable while the secret is
  locked anyway, because the chips are not buttons.
- **Titles sheet**: `titleGroups` gives `name`, `source` = "???", and `how` = the hint. The item's `title` attribute is
  the hint, and the plate's aria-label is "Title: ???".
- **Case**: the cell, the detail view and their aria-labels all go through `secretUnfound`. The legend shows specials
  only, and every secret is plain.
- **Edit Profile**: `secretTitleHint` and `secretFrameHint` both go through `isSecretLocked`.
- **Toast** (`achToast.js`): fires only at met, when the row already shows the name. It shows "Secret found!" and the
  generic "Honor Ribbon · Title" line.
- **Battle results minis**: these are only for rows that became claimable.
- **Mailroom** (`mailbox.js:33,73`): shows only the ribbons a letter gives. No letter gives a secret.
- **Pins, profile card, published JSON, friend/other-player viewer**: earned items only (`pinEarned` needs claimed;
  `profileCard.js:246` publishes only the worn title, and an unearned one can't be worn). Showing another player's
  earned secret is intended.
- **Search/filter**: the Achievements tab has none.

## Met-but-unclaimed reveal (2)

This is acceptable. `metricValue >= goal` is the same test the list row uses (`model.js:14`, `a.met`). At that moment the
row already shows the achievement name, its requirement and Claim, and the toast says "Secret found!".

A player can only reach "met" by doing the thing, and the claim modal names the rewards one tap later. My
"Mirror met only" sweep shows that only Mirror, Mirror's own strings appear. Every other secret stays hidden in all 17
views.

The rule also reverses correctly. If a met-unclaimed metric drops back below its goal (for example, Room with a View
after its lobby background is removed), the row and the rewards both go back to secret.

The gifted-ribbon case is the one place this differs from live; see L1.

## Regressions (3)

- **Earned secrets** show everywhere. The "found" sweep passes on all 3 viewports. Screenshots:
  `r3/390x844-found-secret-sheet.png`, and the Titles sheet in the found state (plate names, `source` = achievement
  name).
- **Claim flow**: I ran `e2e/achievements.mjs` with a one-line local guard for the pre-existing `lateSave` crash, on
  both trees. Every failure on the feature branch also fails on release (details below).
- **Save round trip**: `save.js`, `senseiSave.js` and `profileHonors.js` are unchanged in this delta. The pfw:f / pfw:t
  older-build tests in `tests/systems/cosmetics2.test.js` pass (15/15).
- **Sim**: `simId()` is `5ba58b3fc229` on both the feature branch and `26dd6ab6`. `release/v0.1.66` is an ancestor of the
  tip. `git diff origin/release/v0.1.66 3ccc7847 -- src/sim src/online tests/sim` is empty. `COOP_PROTOCOL` stays 14.

## Runs (4) at `3ccc7847`

- **`npm test` (vitest)**: 421 files passed, 2 failed, 2 skipped; 6657 tests passed, 4 failed, 11 skipped.
  - The 4 failures are the known ones: itemArtRuntime sim-id pin and 3 engines.test.js checkpoints.
  - The same 4 fail on clean `26dd6ab6` (4 failed / 41 passed in those two files).
- **`node e2e/cosmetics.mjs`**: ALL OK, 75 checks, 3 viewports. That includes both sweeps per viewport.
- **Extended sweep** (my local copy of the sweep with the L2 word list, plus "Mirror met only" and "Mirror gift"
  states): ALL OK at 390x844 and 844x390.
- **`node e2e/achievements.mjs`**: crashes at `:44` `lateSave`. This is pre-existing: release crashes the same way at
  `:43`.
  - I ran a patched local copy (the same `||=` guard that cosmetics.mjs uses).
  - Feature: 80 ok, 3 FAIL. Release: 77 ok, 6 FAIL.
  - The feature's failures are "12 categories" ×2 (the build has 13) and "toast and speech bubble never overlap" at
    844x390. All of them also fail on release, so these are stale assertions, not regressions.
- **`node e2e/smoke.mjs`**: 676 ok, 2 FAIL. Both are the known "drag (touch): releasing places aoi…" failures.
  - My first run gave 14 failures. All were "Failed to fetch dynamically imported module" because it ran at the same
    time as another e2e on a cold Vite server. Re-run alone, it is clean.

## Screenshots (`r3/`)

- `390x844-fresh-secret-sheet.png`, `844x390-fresh-secret-sheet.png`: Mirror, Mirror unfound. "???", the hint, the grey
  "?" ribbon and the "✦ ???" plate. On a phone the rewards sit under the text (N2).
- `390x844-fresh-titles-a_mirror_mirror.png`, `844x390-fresh-titles-a_close_call.png`: the Titles sheet. Both secret
  titles show "✦ ???" with "How: Secret achievement: <hint>".
- `390x844-found-secret-sheet.png`: an earned secret, with its name, requirement, ribbon and "Bravest of Them All" plate.
- `390x844-giftmirror-secret-sheet.png`: the L1 state.
