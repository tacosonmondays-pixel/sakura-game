# Next session: start here (written Oct 24, 2026, at a handoff to a cloud session)

This page is for a session that only has the GitHub repo (a cloud session), not the owner's PC. Read `docs/HANDOFF.md` too; it has the rules (§6), the shipping flow (§7) and the branch table (§3). Check out the coordination branch `claude/sakura-sentinels`; `main` is the live build (every push to `main` deploys).

## What is live
v0.1.51 "Spooky Courtyard" (main `2015dc5`, sim id `92e2e22527cf`, `COOP_PROTOCOL` 8). Check with `curl -s https://tacosonmondays-pixel.github.io/sakura-game/version.json`. The next deploy is v0.1.52, which is the next GitHub Pages run number.

## Job 1: ship the hubs (UI M5) on their own as v0.1.52
The owner said, Oct 24: "ship the hubs on their own with the full gate". This is NOT a fast-lane change. It needs:
- two independent reviewers (look and logic);
- fresh re-reviews until no blocker, high or medium finding remains (at most 3 rounds, then stop and report "not approved");
- an independent go/no-go;
- an independent live check.

The reviewer and go/no-go agents must not be the agent that built or fixed the work.

**Branch:** `feature/ui-m5` at `1d6f86f`. It is pushed, 0 commits behind `main` and 23 ahead.

**What is built on it:**
- **UI M5:**
  - M5a: one countdown chip and one badge vocabulary.
  - M5b-d: hub screens with host girls (Missions, Titan Trials, Story, Achievements, the campaign cards); left-rail lists; the Multiplayer hub; condensed Achievements.
- **Merged with `main` (v0.1.51).** The lobby keeps everything from v0.1.47-v0.1.51:
  - the two background groups (`src/data/lobbyIllustrations.js`);
  - full illustrations with no stand or bubble, and the lantern string cut beside her head;
  - the Halloween event backdrop behind every stand (`eventLobbyBackdrop`, artStage `backdrop`, `.tint-event`, `.on-stand`);
  - the greeting after switching back from a full illustration.
- **The four layout findings from M5's last final review, fixed** (in `0324846`):
  - **M5-1:** Titan Trials names were truncated, and "★ Titan of the Week" ran under the token at 1024-1180 px.
    - A new `WIDE_GRID_VW = 1240` rule in `src/ui/hubHost.js` shows the host as her chip on Missions and Titan Trials. It applies when the screen is taller than a phone and narrower than 1240 px.
    - The kicker and the large names now follow the card's own width (a container query in `titans.css`).
  - **M5-2:** the Titan Trials slanted cards and shelf button had their corners sliced flat. The scroller in `hubs.css` now clips 6 px further out.
  - **M5-3:** the Missions Bounty line was truncated and Story's "Episodes" ran past its plate at 915x412, 932x430 and 1180x820. `fitTiles` in `missions.js` now picks the long or short subtitle by measuring.
  - **M5-4:** the Missions bottom tiles were unreadable at 1024x768. They are fixed by the host chip, and the tall tile steps in from the edge.
- **The seven academy girls may host** (`hosts.js` `PLACEHOLDER_ART` is empty; their art shipped in v0.1.47).
- **Profile at tablet widths:** the showcase stars and the online-name pill fit now.
- **Test coverage:** `e2e/hubs.mjs` and `e2e/ui-shots.mjs` cover 10 sizes and check for sliced slanted corners.

**Review round 1 (two reviewers) found, and `1d6f86f` fixed:**
- **HIGH:** the lobby's right next-secretary arrow ignored taps at 844x390. M5's bottom-right cluster box `.lb-br` sat over it, and the carousel dots too.
  - Fix in `hubs.css`: `.lb-hud > .lb-br, .lb-br-side, .lb-campaign > .lb-camp-next { pointer-events: none }`, with their buttons set back to `auto`.
  - `e2e/lobby-illustrations.mjs` now checks with `elementFromPoint` that every lobby control is on top, and that a real tap on each arrow changes the secretary (`--tap-sizes`).
  - Known and unchanged from live: below 760 px wide in landscape, the carousel and Campaign already cover the arrow.
- **MEDIUM:** `e2e/lobby-illustrations.mjs` crashed at 667x375, because its fixed body-tap point hit the new Multiplayer button. The body tap now searches for a free point on the picture. The script passes at all 7 default sizes (951 checks).

**Round-1 low findings, still open:**
- **Fix in round 2:** Titan Trials at 1280x720 lost the tall-card kicker and the 19 px names that v0.1.51 has. The `@container tt-cards (min-width: 838px)` threshold was computed from skewed bounding widths. The layout width at 1280x720 is about 804 px. Use a threshold of about 800 px, measured as layout width.
- **Owner decision; don't block on it:** on full illustrations at 667x375 and 1024x768, M5's Assault and Multiplayer buttons sit over the girl's body (Yoriko's Summer Breeze, Marumi's Strike Lane). The face rule still holds. The default plan is to move or shrink that column on full illustrations after the hubs ship (HANDOFF §6: adult heroes are never framed around their bodies).
- **Accepted trade-off:** Titan Trials at 1024x768 and 1180x820 leaves the lower part of the screen empty, with the host shown as a chip.
- **Polish:**
  - The ★ week sticker's ring is cut at its top by its card (`titans.css` `.tt-star`).
  - At 667x375 the sticky action bar covers the Mayhem tier chip.
  - The Profile showcase cuts "Marumi" at 844x390 and 1024x768.
  - At 1280x720 the two "Hard+" drop labels in Total Assault nearly touch.
- **Same on live, no change needed:**
  - the inbox badge ring is cut 2 px at its top;
  - top-bar titles overflow on a 390x844 portrait phone;
  - the lobby greeting bubble is cut at the left on a 390x844 portrait phone.

**Next steps:**
1. **Fresh two-lens re-review of `1d6f86f`:**
   - Verify the HIGH and MEDIUM above, and M5-1..M5-4.
   - Check every screen M5 touches and the lobby next to live, at 844x390, 667x375, 915x412, 932x430, 1280x720, 1024x768, 1180x820 and 390x844. Zoom 3x on panel edges and corners.
   - Fix the Titan kicker low in the same round.
2. **Prepare the release on `release/next`:** fast-forward to `main`, `git merge --no-ff origin/feature/ui-m5`, and add the v0.1.52 patch note at the top of `src/data/patchNotes.js`. Its id must equal the next Pages run number. Write 2-5 player-facing bullets about the hubs.
3. **Independent go/no-go** on `release/next` merged into `claude/sakura-sentinels`:
   - full vitest;
   - sim id `92e2e22527cf` and COOP 8;
   - vite build plus a secret grep of `dist` (one known false positive in the bundled Supabase library);
   - smoke at 844x390 and 1280x720;
   - `e2e/hubs.mjs`;
   - `e2e/lobby-illustrations.mjs`;
   - the patch-notes e2e.
   
   Never ship between 18:00 and 20:00 US Central.
4. **Ship (§7):**
   - Update HANDOFF §1/§3 in a docs commit.
   - Merge `release/next` into `claude/sakura-sentinels`.
   - Run `git push --atomic origin claude/sakura-sentinels claude/sakura-sentinels:main release/next`, fast-forward only and never forced.
   - Wait for `version.json` to show 0.1.52.
5. **Independent live check** of the hubs and the lobby on the live site.
6. **After it ships:** `feature/ui-v2` must merge `main` (UI v2 is built on M5).

**Gates and tools:**
- cssFloor and contrast: `tools/cssFloor.mjs` and `tools/contrast.mjs`.
- `e2e/hubs.mjs` takes `--viewport` (a list) and `--port`.
- `e2e/lobby-illustrations.mjs` takes `--sizes`, `--tap-sizes`, `--port` and `--gpu`.
- `e2e/browser.mjs` finds Playwright through `PLAYWRIGHT_MODULE` or `NODE_PATH`, and Chromium through `CHROME_PATH`, `PLAYWRIGHT_CHANNEL` or Playwright's own install.
- `e2e/halloween.mjs` hardcodes `/opt/node22` and `/opt/pw-browsers/chromium`.

## Other branches (not for this job)
- **`feature/abilities` `a2a20fe`:** the ultimates, COOP 9. Milestones 1-3 are approved. Milestone 4 (the tactical battle panel) is mid-way through its third fix round, and `a2a20fe` is a WIP commit.
- **`feature/ui-v2` `b6e30cc`:** UI v2. Milestone 1 is approved; milestone 2 (the home screen) is a WIP commit.
- **Don't merge:**
  - `wip/balance-measure` (measurement tooling only);
  - `fix/lobby-polish` (rejected by the owner);
  - `fix/illustration-zoom` (reverted in v0.1.50).

## Owner reminders
- Rotate the Supabase secret key and the database password.
- For anything players will see, send the owner real screenshots before and after, and get a yes before review and shipping. On Oct 24 they reversed two visual changes right after seeing them.
