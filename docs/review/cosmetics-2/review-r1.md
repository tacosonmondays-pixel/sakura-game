# Cosmetics 2 — independent review r1

Target: `origin/feature/cosmetics-2` @ `6d271600` (3 commits on `d315d38`). Display and data only. Reviewed the diff from the
merge base and from `origin/release/v0.1.66`.

## Verdict: NOT OK. Two small fixes needed (M1, M2). Everything else holds.

## Findings

**M1 (MED): the new secret title gives the secret away in Edit Profile.**
`src/ui/profile/editProfile.js:147-148` lists every achievement title from `titleChoices` (`src/systems/profileTrophies.js:70-73`)
and shows its plate text and `How: ${TITLES[id].how}` with no secret check. A fresh save sees "Bravest of Them All" with
"How: Defeat the Mirror Queen 25 times." (I checked this with a probe test.) "Cool Under Pressure" already leaks the same way on
main, but this branch adds a second leak while the secret frames right above it hide theirs correctly.
Fix: when a title's achievement is `hidden` and the title is not earned, draw a `???` plate and show `Hint: ${a.hint}`, as the
frames do (`editProfile.js:121-123`). Add a cosmetics2 test and an e2e check (fresh save: no `a_mirror_mirror`/`a_close_call`
title text in `[data-testid="edit-..."]`).

**M2 (MED, process): the branch is 6 commits behind `release/v0.1.66` (`26dd6ab`).**
Because of that, `git diff origin/release/v0.1.66 origin/feature/cosmetics-2` looks like it reverts the DoT-credit,
Control-Strength and Limit-Break sheet fixes (`src/sim/*`, `e2e/limit-break.mjs`, `tests/sim/dotCredit.test.js`). It doesn't
revert them. `git merge-tree` shows one conflict, in `src/data/patchNotes.js` (both sides edit the top).
Fix: merge `release/v0.1.66` into the branch, keep v0.1.67 above v0.1.66 (which is now dated 2026-10-31), then re-run the tests.

**L1 (LOW): what origin/main shows for an unknown frame or title on someone else's card.** It falls back safely: no crash, no
ring, and `frameName` gives `''`. Two small blemishes remain: an empty `pf-ava-cap` div (`profile.js:266`), and the Freeplay
panel shows a "Default" chip (`profile.js:340` → `frameChip`). An unknown title shows a `—` plate. Old builds can't be patched,
so this is fine as is.

**L2 (LOW): `src/ui/profile/zero.js:51` counts any frame as a Freeplay record.** So Sakura, Laurel, Window Seat and the others
now open the "Freeplay records" panel. On your own profile it lists every earned frame. Fix: filter to
`FRAMES[f].group === 'freeplay'` (plus `ur`/event if wanted) or retitle the panel.

**L3 (note): the bake can't be re-run here (no Blender).** Each `HONOR_BAKED` hash matches sha1(256 + 128 webp)[:8] (spot-checked
`a_ach_75` and `a_ur_1`). The README pins Blender 5.2.3 and the flags, and the bake is the sole author of `honorArt.js`.

## Verified OK

- **Derived and retroactive:** `earnedFrames` reads only claims, medals, Freeplay bests, counters (`coopWin`, `ty:grade`/
  `tryoutGrade`, `lr:<id>`) and units. Nothing is stored, so nothing is granted twice. The secrets' item rewards are unchanged.
- **pfw: abuse:** I tried a crafted save with every `pfw:f:*` mark plus `pfw:t:a_mirror_mirror`/`a_close_call`, and a raw block
  holding `twin_legends`. Restored frame and title come back `null`/`null`, because restoring is gated on `earnedFrames` and
  `titleKeepable`. An earned frame survives a round trip.
- **LR:** `limitBroken` uses the same rule as `limitBreak.js:49` (legend unit, owned, `lr:` ≥ 1). An `lr:` counter on a
  non-LR unit or on an unowned LR is ignored.
- **Lantern Night:** listed during the `active` phase only: Oct 25 and Nov 10 yes, Nov 20 and Dec 1 no. Owners always see it.
  The medal is `progress.stages['ev-halloween-boss'].nightmare`, which every build keeps.
- **Secrets elsewhere:** the Case (`case.js:58-69,129-136`), the list (`list.js:103-126`) and the frame picker all show `???` and
  the hint. Locked and secret ribbons keep the grey SVG.
- **Counts:** 41 ribbons (23/9/9), 48 live titles, TITLES 55. The `NEW`/`LIVE` avail tags are unchanged.
  `e2e/achievements.mjs` now uses `HONOR_TOTAL`.
- **Art:** earned ribbons get the 128 px file in boxes up to 64 px and the 256 px file above. 82 files, all ≤ 18 KB, 1.04 MB
  total. The frames are original SVG drawn around the game's own portraits. Nothing sexualised and no other games' names (the
  board was checked too).
- **Sim id:** `36cba1c215b0`, the same at the merge base and the tip (91 files). No COOP bump is needed.

## Runs (at 6d271600)

- `npm test`: 422 files passed, 2 skipped; 6655 tests passed, 11 skipped.
- `node e2e/cosmetics.mjs`: ALL OK (48 checks, 3 viewports).
- `node e2e/achievements.mjs`: crashes in `lateSave` (`e2e/achievements.mjs:44`). The cause is a fixture gap:
  `veteran('late')` lacks 30 of the 70 campaign stages. It fails the same way on `release/v0.1.66`, so this branch didn't cause
  it. Fix the fixture: `(p.progress.stages[id] ||= {}).nightmare = true`.
- `node e2e/smoke.mjs`: 2 failures, both "drag (touch): releasing places aoi…". The same 2 fail on `release/v0.1.66`.
  Not this branch; needs its own follow-up.
