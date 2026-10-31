# Review r1 — `feature/profile-banners` @ 8bb2297e (20 new Sensei Profile banners)

Independent reviewer (did not build it). Scope: `git diff origin/release/v0.1.66...origin/feature/profile-banners`
(three-dot; see F1), spec `docs/specs/PROFILE_BANNERS.md`, board `docs/specs/profile-banners/board.png`.

## Verdict: **OK**

No blocking findings. One merge note (F1) and two low notes (L1, L2), none of which needs a code change before merge.

## Gates

| Check | Result |
|---|---|
| `npm test` on the feature branch | 421 files passed, 2 skipped · 6660 tests passed, 11 skipped |
| `npm test` on the merge of the branch into `release/v0.1.66` | 4 failed, 6659 passed, 11 skipped. **The same 4 fail on plain `release/v0.1.66`** (see R0); none comes from this branch |
| `node e2e/profile-banners.mjs` (merged tree) | all ok at 390x844, 844x390 and 1280x720 |
| `node e2e/smoke.mjs` (merged tree) | 2 failures: `drag (touch): releasing places aoi where the pointer let go`. The **same 2 fail on plain `release/v0.1.66`**, so they come from an earlier change |
| Sim id | feature branch `36cba1c215b0` (the merge base); `release/v0.1.66` `5ba58b3fc229`; merge `5ba58b3fc229`. The branch doesn't change the sim |
| No `src/sim/**` file imports the new modules | yes |

## What was checked

- **Unlocks** (`src/systems/profileBanners.js:41`). They read claimed achievements (`=== true`), event stage clears
  (`progress.stages`, which event settle never prunes), the LR marks and the `pbs:` season marks. Nothing is granted
  and nothing is written except the season mark. All 20 achievement ids exist, none are `a_pulls_*`, and only Shrine
  Bell is hidden, so its lock text is "A secret achievement". The unlocks are retroactive and idempotent.
- **A locked banner never reaches the card.** I crafted saves and traced them through `cleanSensei` and `buildCard`:
  - a raw block naming locked `pb:nightglass` publishes `academy:day`;
  - a `pfs:banner` hash of locked `pb:first_snow` gives `academy:day`;
  - `restorePicks` from a server card with locked `pb:first_snow` gives `academy:day`;
  - a claim that was later removed gives `academy:day`.
- **Viewer.** `cleanViewedCard` is byte-identical on `origin/main` (live) and the branch. Live `main` code shows
  `pb:petal_storm`, `pb:not_a_thing`, `PB:Bad!!`, `42`, `null` and a 40-character slug as `academy:day` with no error.
  The live viewer has no other path that reads a raw `ban`. `validCard` and the server pattern
  `^[a-z]{1,12}:[a-z0-9_-]{1,24}$` (profile, profile_gear and friend_support SQL) accept every `pb:` id (the longest
  slug is 16 characters). No SQL is needed.
- **`pbn:` round trip.** Equip `pb:blossom_court` → load in `origin/main` code: it shows `academy:day` and keeps
  `pbn:` → load back in the branch: `pb:blossom_court` again. It also comes back when the old build drops the block
  (the pool includes `pb:` ids). A crafted `pbn:` hash of a locked banner (`pb:petal_storm`) restores nothing. Main's
  `markSensei` clears only the `pfs:`, `tagt:` and `evt:` prefixes, so `pbn:` survives.
- **Halloween keepsake.** The rule is "any `halloween-2026` stage cleared". Event operations refuse to start after the
  window closes (`eventStageStatus` returns `closed`), and stage medals are kept forever, so the banner is a keepsake.
- **Seasons.** `seasonAt` uses `gameDay` (the device clock on the 7 PM Central day), Dec–Feb is winter, and so on. The
  mark is set in `onAppStart`, which runs at boot and at the daily rollover (`commissions.js:62`), so a long session
  crossing a season still gets the mark. A player can change their clock to unlock a season early (accepted in spec Q1).
- **Picker UI.** Screenshots at 390x844, 844x390 and 1280x720: lock chips stay inside their tiles (ellipsised), the
  count line reads "28 / 34 unlocked" and nothing overflows. The lesson toast that covers the count line in two shots
  is the game's own and not from this branch.
- **Art.** Fourteen banners use existing `public/art/lobby` story places and the Halloween academy. Six are seeded SVG
  patterns. The branch adds no image files except the board, which is drawn from the game's own `bannerArt`. No
  third-party art and no generator use (0 spend).
- **Names.** The added text names no other games or anime.

## Findings

**R0 (blocks the v0.1.66 release, NOT this branch).** `release/v0.1.66` alone is red. Its audit commits `b0cb03c2`,
`2b1465ae` and `def77588` change the sim (id `36cba1c215b0` → `5ba58b3fc229`) after `COOP_PROTOCOL` 14 was pinned.
These fail:
- `tests/art/itemArtRuntime.test.js:321`: KNOWN[14] = `36cba1c215b0`;
- three cross-engine sync cases in `tests/online/engines.test.js`: returning abilities, Tenka, and gear sets.

Live `main` is on protocol 13, so 14 has never shipped. **Fix:**
- either re-pin KNOWN[14] = `5ba58b3fc229`, or bump `COOP_PROTOCOL` to 15 (the HANDOFF rule reads as a bump);
- either way, regenerate or confirm the engines fixtures for the new DoT credit and pushes;
- an independent reviewer then re-reviews the sim fixes.

**F1 (merge note, not a defect).** The branch is 4 commits behind `release/v0.1.66` (`b0cb03c2`…`9fa15be0`: DoT credit,
Control Strength, Ena's context reset, and the patch note). A two-dot diff therefore looks like it reverts
`src/sim/Sim.js`, `enemies.js`, `setRules.js` and `status.js`, and deletes `tests/sim/dotCredit.test.js`.
- **Fix:** merge (`git merge --no-ff`) and never copy the branch's tree over a release. The merge is clean, and its sim
  id is release's `5ba58b3fc229`.
- **Fix:** `docs/specs/PROFILE_BANNERS.md` (intro and §4) gives the sim id as `36cba1c215b0`, which is stale. Reword it
  to "unchanged from the base release".

**L1 (low).** `src/systems/senseiSave.js:172`: if the player deliberately picks `academy:day` in an older build, the
`pb:` banner comes back on their next load in this build. The `evt:` / `tagt:` titles behave the same way. Accept it,
and add one line about it to spec §4.

**L2 (low, cosmetic).** At 844x390 a long lock chip is cut off ("Claim “Two Hundred S…"). The full rule is only in
the `title` tooltip (`src/ui/profile/editProfile.js:130`), which touch players can't open. This matches the spec, so it
is optional. A later fix could show `pbHowText` in a toast when a locked tile is tapped.
