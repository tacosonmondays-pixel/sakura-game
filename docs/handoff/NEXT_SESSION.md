# Next session: start here (updated Oct 28, 2026, evening)

This page is for a session that only has the GitHub repo (a cloud session), not the owner's PC. Read `docs/HANDOFF.md` too; it has the rules (§6), the shipping flow (§7) and the branch table (§3). Check out the coordination branch `claude/sakura-sentinels`; `main` is the live build (every push to `main` deploys).

## What is live
v0.1.58 "Brighter Details" (the EVENTS tab on the home, Marumi in colour) on top of v0.1.57 "Ultimates", v0.1.56 "Brighter Home", v0.1.55 "Rush Hour and Hilltop After Dark" (Gate Arc Acts 1–2) and v0.1.54 "Quiet Home", all shipped Oct 28. `main` is `aa0281de`, sim id `2c3c74708a2c`, `COOP_PROTOCOL` 10. Check with `curl -s https://tacosonmondays-pixel.github.io/sakura-game/version.json`. The next deploy is v0.1.59, the next GitHub Pages run number: one combined release of the banners (the duo launching now), Tryout Day and the honest DPS readout on `COOP_PROTOCOL` 11 (`release/duo-tryout`; HANDOFF §1).

## UPDATE Oct 28 (afternoon): v0.1.56 and v0.1.57 SHIPPED
- **v0.1.56 "Brighter Home"** (run #56, main `24881956`): the home art in full colour and a Clan button beside chat and mail (owner: "it looks a little dead … bland"). Independent go/no-go GO, live check LIVE_OK. Display only.
- **v0.1.57 "Ultimates"** (run #57, main `793dfcfa`): tower abilities and ultimates, Tenka, the tactical drawer, the Seiran fix; `COOP_PROTOCOL` 10. Two releases claimed v0.1.56; the home took run #56, so the Ultimates note was renumbered to v0.1.57 in the merge commit. The only `0.1.56` on each branch was its own patch note, so the renumber was one line. Final release review GO, go/no-go GO (full, then a delta check on the exact commit), live check LIVE_OK.
- **Ship pattern that worked:** pre-merge the next release onto the about-to-ship commit in a separate worktree, run the full go/no-go there while waiting for the session's final sha, then re-merge the final sha and run a delta go/no-go (only the files that changed since). This machine has 4 CPUs and a slow software GPU: run heavy jobs one at a time; frame-rate-bound e2e checks can fail here and pass on a faster runner (compare with the previous release before calling a regression).
- **Next, in order:** v0.1.58 = whichever passes first of `fix/display-polish` (owner's yes pending on its board) and `fix/honest-dps` (owner already said yes: "I jsut want the dps to properly show"); then `fix/after-ultimates`; the banners (`feature/banners`, COOP 11, SQL paste by the owner); Tryout Day; Gate Arc Acts 3+; the menus. The balance pass ships after Nov 1, 7 PM Central (the Halloween event ends then), on top of the ultimates. Never ship 18:00–20:00 Central.
- **Owner answers Oct 28:** "default all" (every girl faces the camera; the banners' PR #30 questions, the Gate Arc Steps 3–4 questions and Tryout's 21 decisions take the defaults; balance direction "no cap, everyone close to Kage"); "Midori can come with everyone else, I jsut want the dps to properly show" (no Midori-only change; honest DPS for every girl).

## UPDATE Oct 28: v0.1.54 and v0.1.55 SHIPPED
- **v0.1.54 "Quiet Home"** (run #54): the UI v2 display update. Independent go/no-go GO, after one NO-GO on copy. Independent live check LIVE_OK.
- **v0.1.55 "Rush Hour and Hilltop After Dark"** (run #55): Gate Arc Acts 1–2. Independent pre-ship review, then an independent go/no-go GO on the exact merge. Independent live check LIVE_OK: smoke 678/678 at three viewports and the Gate Arc e2e 34/34 against the live files (served through a localhost relay), and all 1,528 live requests returned 200. Lows: transient toasts over UI, the old 390x844 title overlap, and compact-layout text cut-offs at 844x390 (partly the sandbox's fallback font).
- **Live checks from a cloud sandbox:** Chromium here cannot open the live https site (the agent proxy re-signs TLS; never change certificate stores or turn off checks). Serve the live files on localhost with a small Node relay: `fetch` with `NODE_USE_ENV_PROXY=1`, which uses the proxy CA from `NODE_EXTRA_CA_CERTS`. Then point the e2e scripts at it with `?online=local`. The sandbox also cannot reach Google Fonts, so screenshots show a fallback font.
- **(Superseded by the afternoon update above.) Next, in order:** the ultimates as v0.1.56 (`release/ultimates`, COOP 10, owner board first); then the banners (`feature/banners`, merges main after the ultimates ship, COOP bump, real dates, patch note, SQL paste by the owner); the menus (`feature/ui-v2-menus`); Tryout Day (`feature/tryout-day`); Gate Arc Step 3 (`feature/gate-arc`). The balance pass ships after Nov 1, 7 PM Central (the Halloween event ends then).
- **Owner questions (answered Oct 28: "default all"):** the battle facing (every girl faces the camera); the balance direction (no cap, everyone close to Kage).

## Earlier: Oct 24, the hubs SHIPPED as v0.1.53 "Hubs and Hosts"
The owner said "just send out hubs no last review", so review round 2 was skipped on the owner's call. An independent go/no-go then passed every gate (full vitest, sim id, cssFloor, contrast, build + secret grep, smoke, `e2e/hubs.mjs` at 4 sizes, `e2e/lobby-illustrations.mjs`, patch notes) and a visual pass. The same release removed the lobby's lantern string and pumpkin stickers; the owner said "theyre ugly". The painted Halloween backdrop stays.
- **Live check: OK.** An independent agent checked the lobby and every hub at 844x390, 1280x720 and 1024x768 on the live site: 485 checks, no page errors, no failed requests. It found two new lows. The Campaign subtitle "Chase Sakura medals" is cut at 844x390 for a player who cleared every chapter (`.lb-camp-label small` grew to 12 px in `hubs.css`). The carousel's "4 titans this week" runs under the shield at 1280x720 and 1024x768 (`.lb-slide-text` widened to 72%).
- **The owner on the home screen:** "it just looks busy the homescreen is kinda packed now". They chose to leave it for UI v2 ("if the entire main menu hub is going to change it doesnt make sense to waste credits editing it"). Don't restyle the home screen on its own; do it in UI v2's home milestone. That means fewer, calmer pieces: the tray box, the Multiplayer plate with two stands, and the Assault and Multiplayer column over the girl.
- **What's next, by the owner's order:** the ultimates (`feature/abilities`), then UI v2 (`feature/ui-v2` must merge `main` first: it is built on M5, which is now live), then balance. Players' balance requests from Oct 26 (strikers up to Kage, Chigusa's lives, Fuu's push-back, hero base DPS) and what the owner told players is coming are in HANDOFF §10.
- **Open lows from v0.1.53:**
  - Titan Trials at 1280x720 has no "Titan of the Week" kicker. Its `@container tt-cards (min-width: 838px)` keeps the kicker off the token, so lowering it brings back the overlap.
  - The Missions Bounty subtitle sits on dark art at 1024-1280.
  - The Profile showcase cuts names at 1024x768.
  - The carousel's Titan Trials title is cut at 844x390 (also on the old build).

## Job 1 (DONE, kept for reference): ship the hubs (UI M5) on their own as v0.1.53
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
2. **Prepare the release on `release/next`:** fast-forward to `main`, `git merge --no-ff origin/feature/ui-m5`, and add the v0.1.53 patch note at the top of `src/data/patchNotes.js`. Its id must equal the next Pages run number. Write 2-5 player-facing bullets about the hubs.
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
   - Wait for `version.json` to show 0.1.53.
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
