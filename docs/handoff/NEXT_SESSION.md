# Next session: start here (updated Oct 30, 2026)

**Read `docs/handoff/HANDOFF_2026-10-29.md` first** (detailed state, next steps, and how to split the work into sessions with suggested effort).

This page is for a session that only has the GitHub repo (a cloud session), not the owner's PC. Read `docs/HANDOFF.md` too; it has the rules (§6), the shipping flow (§7) and the branch table (§3). Check out the coordination branch `claude/sakura-sentinels`; `main` is the live build (every push to `main` deploys).

## UPDATE Oct 30, 23:10 UTC: v0.1.65 LIVE; v0.1.66 (battle + gear, COOP 14) assembling; owner's standing OK to ship
- **Owner (Oct 30): "you don't need my permission to ship"** — ship any release that passes its independent go/no-go, then tell the owner. Keep every other rule (no 18:00–20:00 CT, patch note, live check).
- **v0.1.65 "The Summoning Gate Opens"** pushed c34f7bd3 at 21:44 UTC, live 21:53; live check LIVE_OK (smoke 678/678, cinematic 139/139). Follow-up queued: defer recruit music (~660 KB) for slow phones; two transient toasts overlap panels.
- **S5 attack shapes** all six approved (S5a ec18813, S5b 73d89d6) on feature/attack-shapes-s5 6156f08a (merged balance-r5 024b7532).
- **v0.1.66** assembling on release/v0.1.66 (session_01Ayo4er2sMN7BYpFieFCFi6): S5+balance-r5, Ena, Iroha, gear-lr (incl. Kogane 260d8d08), build-coach (incl. loadouts), v0.1.65 merged; COOP 14. Decisions taken during assembly: (A) S1–S4 shape behaviors join SET_ATTACK_BEHAVIORS so set passives keep working (S5 hits stay clean); (2) dead-crit "better of" only takes avgCrit when her kit has damage that reads it (Wakaba/Ouka back to live; Suzu per-source ≥ live). Next: final gates → multi-reviewer audit → ship.

## UPDATE Oct 30, 18:15 UTC: v0.1.64 LIVE; everything for the battle + gear release approved; S5 building
- **v0.1.64** pushed c6d06118 (owner yes), live 16:44 UTC, live check LIVE_OK (ribbon flow 16/16).
- **Owner decisions (Oct 30):** LRs must beat EVERY character (done: LR rows raised, gate tools/balance/lrBar.mjs + tests/sim/lrBar.test.js, bar = best non-LR ×1.25); Tenka's full-lab LR stays; ship v0.1.64; 4th rounds approved; gear icons approved; six more attack reworks (S5) approved with defaults.
- **Approved for the combined battle release (COOP 14):** feature/balance-r5 04bcc258 (+ follow-ups in progress: bar support pairs/crosspaths, Akane-beside-Iroha check, Iroha 6.13M re-pin), feature/ena-contagion 4855bc3b, feature/iroha-mirrors 0af63fdb (r4 f0bd73f2), gear M0 8e8aeae1 / M2 9d94b3c5 / M3 feature/gear-lr b68b79a4 (r4 d337fcac; Kogane level-aware follow-up in progress), loadouts feature/gear-loadouts 450e2641 (r5 604b051a; L2/L3 UI polish in progress), Build Coach feature/build-coach ee1b0020 (r3/r4 OK).
- **v0.1.65 display release** on release/v0.1.65 ba13dcf7: go/no-go NO-GO on a patch-note line + an e2e wait; fixes + the gifted-ribbon "came with the title" copy fix in progress, then a fresh go/no-go and the owner's yes.
- **S5 attack shapes** (Midori Spore Mist, Raika Static Web, Rei Crescent Return, Luna Moonbeam Sweep, Miko Charm Wheel, Suzu Bell Toll): spec approved (spec/attack-shapes-s5 01d86b7f, r3 f065472); S5a (Miko/Rei/Suzu + shared base) building on feature/attack-shapes-s5.

## UPDATE Oct 30, 16:25 UTC: battle-release parts approved; three items escalated
- **Approved (review OK), waiting for the combined battle release (COOP 14):** `feature/balance-r5` b2f4345c (final r3 2505d624; no-nerf gate `tools/balance/noNerfGate.mjs`: 0 under live except 6 explained seed/rounding cells; duo non-LR ×1.12; Wyrm reachable), `feature/ena-contagion` 4855bc3b, gear M0 `feature/gear-m0` 8e8aeae1 and M2 `feature/gear-sets` 9d94b3c5.
- **Approved display-only, waiting for the next display release:** `feature/recruit-cinematic` 8bbc9fb7 (r2 91dbe61e), `feature/tryout-pep-talks` 2cb3da8d (r2 872f30b8), gear icons `feature/gear-icons` a069d2f1 (needs the owner's yes on the look).
- **Escalated after 3 failed rounds (owner decides on a 4th round; sessions standing by, fixes known):** Iroha mirrors (`feature/iroha-mirrors` ddd4f512, r3 1fb39f99), loadouts M1 (`feature/gear-loadouts` e610e761, r3 dc30459d; fix committed locally as local/m1-r3-fix 16c6c67f in the loadouts session), gear M3 LR gear (`feature/gear-lr` c2eafc35, r3 6aecd632: blastKit must match applyGearReach — Tenka/Marumi lose the 200–300% Pierce band).
- **In review:** Build Coach r3 (final round) on `feature/build-coach` 0a5f053f.
- **v0.1.64** still staged on `release/v0.1.64` c6d06118 (GO); waiting on the owner's yes.

## UPDATE Oct 30, 12:15 UTC: v0.1.64 GO (awaiting owner's yes); approvals and escalations
- **v0.1.64** staged on `release/v0.1.64` = `c6d06118` (fast-forwards from main a741aef7). Go/no-go r2 GO (`06c8a92c` on `review/v0.1.64-r2`). Push to main only after the owner's explicit yes; then poll version.json and run an independent live check.
- **Approved (review OK):** Ena contagion (`feature/ena-contagion` 4855bc3b; r3 d2a03070), recruit cinematic (`feature/recruit-cinematic` 8bbc9fb7; r2 91dbe61e), gear M0 (8e8aeae1) and M2 (`feature/gear-sets` 9d94b3c5; r3 b2ce7201).
- **Escalated to the owner after 3 failed rounds:** Iroha mirrors (`feature/iroha-mirrors` ddd4f512, r3 1fb39f99: Auto only good at one boss spot, placement search ×1.5–1.7, restore moves mirrors, Laser Web T3) and loadouts M1 (`feature/gear-loadouts` e610e761, r3 dc30459d: one lent-piece loss path; reviewer verified a one-line wornLoadout fix). Both sessions are standing by. Recommended: one more round each.
- **In review:** balance r5 final fixes (7b042643, no-nerf gate 0 under live without supports), gear M3 r2 (a3079fb0), Tryout Pep Talks r2 (0abb2d73). Build Coach r2 fixes still being built.
- **Owner questions open:** ship v0.1.64; Iroha/loadouts extra round; keep Tenka's LR lab 176.9M (×72 Kage); should LRs beat Akane's 16.5M crowd; next attack-shape girls; gear icon look.

## UPDATE Oct 30, 10:40 UTC: v0.1.63 SHIPPED; v0.1.64 in its go/no-go; review rounds
- **v0.1.63 "Two More Spooky Weeks"** pushed `a741aef7` to main 09:09 UTC (owner said yes), live 09:23. Independent live check LIVE_OK (all functional smoke checks, every request 200, Halloween 26/26, fake-clock date edges 6/6).
- **v0.1.64 "A Ribbon for the Night Watch"** on `fix/wyrm-ribbon` (off main a741aef7, sim unchanged): a one-time Mailbox gift of the Starlight Vigil Ribbon (honor only) to saves with best Freeplay wave ≥ 200 (window to 2026-12-01 01:00Z), and the profile card now publishes ~8 s after any change (≥ 60 s apart; flush on hide). Go/no-go `5b75df1d` on `review/v0.1.64` was NO-GO: `cleanMail` strips the honor reward on reload (fix: accept honor ids + repair stripped letters). Fix requested; needs a fresh go/no-go, then the owner's yes.
- **Eclipse Wyrm "doesn't show up"**: not a spawn bug. It spawns at 250, but the `[201, 1100]` HP band makes the first Wyrm pool ×246 the wave-200 Matriarch; best builds die ~212–225. Repro `tests/sim/freeplayWyrmReach.test.js` (it.fails) on `fix/wyrm-ribbon`. The tuning (Wyrm stays at 250; reachable on Blossom by today's best team) is on balance r5 (local agent).
- **Review rounds now (fresh reviewer per round; 3 failed rounds → owner):** gear M0 r2 NOT OK (one MEDIUM: `cleanStat` guard), M2 r2 NOT OK (lab joiner's Treasurer cap), M3 r1 NOT OK (cap display, LR stitch preview, tests, Potential ult haste must stack); loadouts M1 r2 NOT OK (lent pieces lost/ping-pong → one-way lending), Build Coach r2 NOT OK (bench crowd never dies → bad Cost Reduction advice); Iroha r2 NOT OK (ally copies, mirror stacking ×4, Second Pane drop; LR crowd rows must be raised above her 6.81M on balance r5); Ena delta r3 running on `e36f551e`; recruit cinematic r1 NOT OK (no dispose on leaving, Skip all 34 px, opening light ignores comfort settings); Tryout Pep Talks r1 NOT OK (Dare line "[object Object]", tap sizes) — fix session running. All findings were forwarded to the build sessions.
- **Attack shapes S1–S4** (ten shapes on Momo, Kage, Hotaru, Akane, Umeko, Chigusa, Yuki, Kanna, Fuu, Ena) are built and merged into `feature/balance-r5`; they ship in the combined battle release. Owner asked who else gets reworks: suggested Midori (poison mist stream), Raika (static tether), Rei (blade wave), Luna (searchlight), Miko (charm wheel), Suzu (bell quake); waiting on the owner's pick.
- **Owner reminder:** rotate the Supabase secret key and DB password (exposed earlier).

## UPDATE Oct 30, morning: v0.1.62 SHIPPED; v0.1.63 staged; cloud sessions per job
- **v0.1.62 "Sharper Details"** (PR #51 `fix/display-polish-2`, release `0b8e234f`, live 08:15 UTC, run #62): display polish (Iroha's panel, Tenka's coilgun, Kaede/Yoriko/props, UI lows). Independent go/no-go GO; independent live check LIVE_OK (smoke 226/226 via relay, 1,058 requests all 200). Sim `be940ecb2087`, COOP 13.
- **v0.1.63 "Two More Spooky Weeks"** staged on `release/v0.1.63` `a741aef7`: Halloween extended (operations to Nov 15, exchange to Nov 22, 7 PM Central; mailbox gifts re-stamped). Reviewed OK. Must deploy before 2026-11-02T01:00Z.
- **Owner, Oct 30:** battle changes ship SOONER, with no wait for the event: one combined battle release (balance r5 + attack shapes + duo map-wide laser + LR floors ≥ 2.5× Kage + Ena contagion + Iroha mirror network + gear sets/LR gear), COOP 14, with an extra ultracode audit before it ships. LR power targets are FLOORS, never caps; no nerfs ever.
- **Work runs as one cloud session per job** (titles "Sakura Sentinels: …"), and this session coordinates and reviews: gear core (M0/M2/M3), teams + loadouts + Build Coach, summoning cinematic, Ena contagion, Iroha mirrors, and the release checks. Every piece gets an independent reviewer; review state is in `docs/review/<topic>/`.
- **Stopped at the 3-round review limit, waiting on the owner:** `spec/ruri-hana-duo` (one test plus wording left) and `spec/gear-update` (the wave-250 gate's difficulty: default Crimson Moon).

## UPDATE Oct 30: new account; the owner's new requests; four workstreams started
- **New account.** The Oct 28–29 sessions (HANDOFF_2026-10-29 §4) belong to another account and cannot be opened from this one. This account's coordinator is `session_01Ayo4emhaccfvZbckwbnYTR`. The NovelAI and Meshy keys are not in this environment yet (both answer 401), so art v3 (§3.2) waits until the owner adds them as network secrets.
- **Tools in this container:** `npm ci`; the bpy 4.2 venv (`tools/blender/.venv`, kept out of git by `.git/info/exclude`); Blender 5.2.3 LTS (`/usr/local/bin/blender`, headless EEVEE through Mesa's software OpenGL; Pillow for its Python in `/home/user/venvs/blender-pylibs`); the audio toolkit (`tools/audio/.venv`, FluidSynth, soundfonts); rembg with `isnet-anime` (`/home/user/venvs/rembg`); `gltf-transform` and `gltfpack`; a mesh venv (`/home/user/venvs/mesh`: pymeshlab, trimesh, Instant Meshes, manifold3d). The KTX2 encoder (`toktx`) is not installed: the session's safety check refused the GitHub .deb. The owner has a setup script that installs all of this in new sessions.
- **Owner requests, Oct 30:**
  1. Tryout Day ("odyssey mode" in the owner's words): let players see which Pep Talks they chose, and make its UI match the rest of the game. Branch `feature/tryout-pep-talks`, display only.
  2. "Certain bosses on nightmare past 100-200 are impossible to kill": balance testing on `feature/balance-r5`, with the round 5 validation (HANDOFF_2026-10-29 §3.1). Ships after Nov 1, 8 PM Central, with `COOP_PROTOCOL` 14.
  3. Flat 3D icons for gear, like the v0.1.46 item icons. Branch `feature/gear-icons`, display only.
  4. New gear sets with custom designs, LR gear, multiple girl loadouts. The spec and owner board come first, on `spec/gear-update` (`docs/specs/GEAR_UPDATE.md`, `docs/review/gear-update/OWNER_BOARD.md`).
- **Not started:** art v3 (needs the NovelAI key), the display lows and e2e hygiene (HANDOFF_2026-10-29 §3.3), the Tripo import (waiting on the owner's files).

## UPDATE Oct 29 (afternoon): v0.1.61 SHIPPED; art v3 in Look B under way
- **v0.1.61 "Five More Ultimates and Academy Flair"** (run #61, main `60ce9cad`): the last five tower ultimates (Kage, Suzu, Chika, Fuu, Iroha), VFX M0/M1 (hit-holds, squash, impact frames, colour grade, halos, the flash guard; Settings "Flashes & shake" and "Impact frames"), visual reworks batch B (Yoriko's strings, Kaede's afterimages, the academy girls' attacks and props), Tryout Day's Extended Day rewards, the DPS round, the Recruit fit; `COOP_PROTOCOL` 13, sim `be940ecb2087`. Go/no-go GO and a delta GO. Details and the lows: `docs/HANDOFF.md` §1.
- **Owner, Oct 29: art v3 = Look B** (the clean academy look with a dynamic camera) for every roster portrait; Hikari's eyes teal (default). The coordinator is generating the 32 portraits (all but the seven academy girls' v2 scenes) with NovelAI under an 1,800 Anlas cap, judging each independently, and will put the before/after board in front of the owner before a display-only `feature/art-v3` ships.
- **Next:** art v3 (display only) when the board is approved; after Nov 1 7 PM Central balance round 5 with the attack shapes (merges `main`, `COOP_PROTOCOL` 14); then the owner's Tripo models.

## UPDATE Oct 29: v0.1.59 and v0.1.60 SHIPPED
- **v0.1.59 "Banners and Tryout Day"** (run #59, main `ccf147ad`): the banners with the Kohaku & Tsubaki duo, LR Limit Break, Friend Support (its SQL is on the server), Tryout Day, the honest DPS readout; `COOP_PROTOCOL` 11. Go/no-go GO, live check LIVE_OK.
- **v0.1.60 "Gate Arc Acts 3–6 and Extended Day"** (run #60, main `4b4388b8`): Gate Arc Acts 3–6, Tenka's LR form, the duo buff with the edge beam, Extended Day + Random Class, the owner's screenshot fixes with Live + Avg DPS, visual reworks batch A; `COOP_PROTOCOL` 12, sim `d35092f141d3`. Go/no-go GO, live check LIVE_OK (one MEDIUM for v0.1.61: Recruit's pull buttons below the screen at 844x390). Details and the branch list: `docs/HANDOFF.md` §1 and §3.
- **Next:** v0.1.61 (`COOP_PROTOCOL` 13): the VFX upgrade and the last five ultimates once reviewed, visual reworks batch B (`5d659609`), the DPS round (`fix/owner-ui-oct29` `71aa68e9`), the Tryout e2e fix (PR #47), Tryout Day rewards, the Recruit fold fix. After Nov 1 7 PM Central: balance round 5 with the attack shapes S1–S4.
- **Owner answers Oct 29:** "Default" on the duo's bio (it stays as written) and on the second Kogane art test (folded into art v3). Art v3: remake every portrait to match the dynamic-camera look; NovelAI is allowed if the result looks like Yoriko's special art or the clean academy look (prompts never name another game; only the game's own art as references). The pilot (Hikari, Tenka, Kogane; 106 Anlas) is with the owner, who picks look A (stage light) or B (clean academy). 3D models: the owner brings Tripo models.

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

## UPDATE 2026-10-31 02:30 UTC (coordinator)

- **v0.1.66** (release/v0.1.66 @ 26dd6ab6): the audit-D Limit Break fix and the lows are in. One thing is left: the Iroha stun-clump fix (session_01Ayo4eoCgrSVLeUAfoteAm8, fix/iroha-stun-clump @ da2f2db2, WIP).
  - What's done: kit changes in src/sim/mirrors.js. The bounce splash lands on the struck enemy. Copies drop knockback and gather. Slots 1 and 2 are re-placed. Glints no longer stun.
  - Sim id 14 re-pinned to 8b09ee77b276. No COOP bump, since 14 hasn't shipped (coordinator confirmed).
  - Still pending: the 12-ally sweep, benches, irohaLayouts vs LR bars, npm test and the engines check.
  - Then: the assembly session (session_01Ayo4er2sMN7BYpFieFCFi6) merges, re-pins KNOWN[14] and the engines fixtures, and runs the full gates. After that, a fresh delta go/no-go, then ship (standing OK).
- **Cosmetics 2 review r1: NOT OK** (review/cosmetics-2-r1 @ f808f33). Two fixes went to the builder session_01Ayo4eqMGbYD6CyGCx9Unp7:
  - M1: secret titles leak their "How" text in editProfile.js:147. The same leak exists on main.
  - M2: merge release/v0.1.66 in. Keep v0.1.67 above v0.1.66 in patchNotes.
  - Also L2: zero.js:51 should filter frames by group.
  - A fresh delta review comes next.
- **Profile banners review r1: OK** (review/profile-banners-r1 @ 00bac5b5). Follow-ups went to session_01Ayo4er3ihBtMtnjuSxdvzv, on feature/profile-banners-art:
  - F1: fix the spec's sim id wording.
  - L1: add a line to spec §4.
  - L2: tapping a locked tile shows pbHowText.
  - Merge release/v0.1.66 in.
  - Then a fresh review of the art commit e30559e7 plus these follow-ups.
- Pre-existing failures on release, not from the branches: the e2e/achievements.mjs:44 lateSave crash, and 2 smoke "drag (touch)" failures. Both need their own follow-up.
- Still waiting on the owner: art v3 (A/B/C/D), the LR rule (A/B), co-op sharing Q1–Q4, stickers, the VFX spike, and the new star unit.

## UPDATE 2026-10-31 03:15 UTC (coordinator)

- **v0.1.66** is still waiting on the Iroha fix (session_01Ayo4eoCgrSVLeUAfoteAm8). Its full balance sweep is running; the Yuki and Marumi cells are at or above live so far. Next steps are unchanged.
- **Cosmetics 2**: r2 (review/cosmetics-2-r2 @ 4a5268e0) is NOT OK on **N1**: secret rewards still leak in the Achievements tab (list.js:152 chips, claim.js:197-244 ribbonInfo, titleInfo and the Titles sheet).
  - Sent to builder session_01Ayo4eqMGbYD6CyGCx9Unp7, with a single isSecretLocked helper and an e2e DOM sweep.
  - r3 reviewer next. This is the 3rd round; if it fails, escalate to the owner.
- **Profile banners**: r2 reviewer session_01Ayo4enMDnrTcERFcyU1Vf9 is checking feature/profile-banners-art @ bc9188b9 (art + merge + follow-ups).
- **Co-op feel**: r1 (review/coop-feel-r1 @ aac5f90). Both branches are OK after **F1**.
  - F1 is a double-buy: coopPending expires by wall clock during a 6–12 s stall.
  - Also requested: F2, F3, L1, and the spec items S1 (D5 needs a sim change), S2 (they/them), S3 and S4.
  - Builder session_01Ayo4eoDNHhkN52WFy65DsA also merges release 26dd6ab6.
  - Latency: busy 200/200 stall went from 11.5% to 2.1%.
- **Stickers**: done and reviewed OK, on feature/stickers @ de66884 (off cosmetics-2 6d271600).
  - 16 stickers, 0 Anlas spent (free tier); balance is 6,713.
  - Board: docs/art/previews/stickers-v1-board.png.
  - Owner questions Q1–Q5 have defaults: later batch; owning unlocks; lobby picker yes; Sensei sticker later; strangers on with mute/block.
- **Tripo batch 1**: r1 OK (review/tripo-batch-1-r1 @ b5c1adb).
  - Follow-ups sent to session_01Ayo4eniSEuWQnvLYk8muWz: revert e1ca6cfe (reference PNGs), M1 e2e bells, and L1–L5.
  - The 54-row Chrome checklist is at docs/art/tripo/chrome-batch-1.md on this branch and was sent to the owner.
  - API credits: 365 left. Spend no more.
- **v0.1.67 contents**:
  - coop-feel-net (COOP 15) + coop-feel UI;
  - cosmetics-2;
  - profile banners (+art);
  - stickers;
  - Tripo batch 1.
  - Assemble after v0.1.66 ships and each piece is OK.

## UPDATE 2026-10-31 04:00 UTC (coordinator)

- **The owner wants the updates out quickly.** v0.1.66 and v0.1.67 are now being worked on in parallel.
  - v0.1.66: the Iroha fix is at its final step (engines re-pin, then push). Assembly session_01Ayo4er2sMN7BYpFieFCFi6 is ready to merge it, re-pin KNOWN[14], run the gates and push. After that comes a fresh delta go/no-go, then ship.
  - **v0.1.67 assembly started:** session_01Ayo4epfyDmmaAdnyhmw81g, branch release/v0.1.67 off release/v0.1.66. It merges each piece once its review is OK. COOP 15, KNOWN[15].
- **Review status**
  - Cosmetics 2: r3 OK (cosmetics-2-r3 @ cb5f2e9d). Two LOW follow-ups are landing; the v0.1.67 go/no-go covers them.
  - Profile banners: r2 OK. Follow-ups are at be2852a8; the r3 delta (session_01Ayo4eqrjtmTR2VPGMB1StX) is running.
  - Tripo: follow-ups are at e7f6479c; the r2 delta (session_01Ayo4enqYsJwdsbiXEsuw5E) is running.
  - Co-op feel: fixes are at a3bc4b9b and f4923f46 (COOP 15 sim 92f3c17bbd2c); the r2 delta (session_01Ayo4enWaMRbmQdJF9K8BhA) is running.
- **NovelAI: the owner has the top tier with plenty of Anlas.** Don't skimp on art; use multiple samples and full steps.
  - Stickers are being regenerated in pastel at 4 samples each, budget about 2,500 Anlas. The owner asked for more pastel colours.
  - For art v3 the coordinator now recommends option C (redo without halos, keep signature props, several tries each). Waiting on the owner.

## UPDATE 2026-10-31 04:20 UTC (coordinator)

- **v0.1.66**: the Iroha fix is done (fix/iroha-stun-clump @ 59702880). All 540 ally cells are at or above live, COOP 14 sim is b2ff5e0e884b, and LR_BAR.boss went 6.13M → 6.46M. Assembly (session_01Ayo4er2sMN7BYpFieFCFi6) is merging it, re-pinning KNOWN[14] and running the gates. After that: a fresh go/no-go, then ship.
- **v0.1.67**: release/v0.1.67 @ 9e680735 has cosmetics-2 (final 1e3f7464), stickers (pastel regen ff4e17da; next tip c8024b6) and profile banners (be2852a8) plus the r3 lows.
  - Waiting on:
    - feature/tripo-batch-1b, a clean squash branch, because the reverted refs PNGs (7.9 MB) are still in tripo-batch-1's history;
    - the coop-feel-net R2-1 test fix and R2-2/R2-3 lows (r2 OK).
  - Then: merge the final release/v0.1.66, re-pin KNOWN[15] and the engines digests last, run full gates, go/no-go, ship.
- **New rule for every branch**: commit boards and screenshots as WebP or JPEG of 300 KB or less. A merge to main keeps them in history forever. v0.1.67 accepts ~5.3 MB of PNG boards already in feature history; we chose not to squash.
- **Stickers**: the pastel set was regenerated on NovelAI (960 Anlas; balance 5,753). Owner flag: Hikari's hair came out pale blonde rather than pink; offered a redo.

## UPDATE 2026-10-31 05:15 UTC (coordinator)

- **v0.1.66** is release/v0.1.66 @ fc978aba (Iroha fix merged; sim b2ff5e0e884b = KNOWN[14]).
  - Green so far: npm test 6647/0 fail; noNerfGate vs live, none = 0 under, um = only the 5 documented L1 cells; lrBar and --bar ok (boss bar 6.46M); smoke clean; limit-break and iroha-mirrors ok.
  - Still running in the assembly: coop/gear e2e, engines, build plus secret scan, blob check.
  - The final go/no-go is running in parallel (session_01Ayo4eoSnvej7uEJVTRTjit).
  - On GO: `git push origin fc978aba:main`, poll version.json, then a live check.
- **v0.1.67** is release/v0.1.67 @ 3c7d863b. It contains every piece:
  - cosmetics-2 1e3f7464
  - stickers ed9b5a9e (likeness redo: NovelAI img2img from each girl's own chibi plus portrait; 1,247 Anlas, balance 4,506)
  - banners be2852a8 plus the r3 lows
  - tripo-batch-1b 219e08eb
  - coop-feel-net 374e4115
  
  The trial merge with fc978aba is clean: npm test 6726/0 fail, noNerf 0 under vs fc978aba, lrBar ok. Assembly is now merging fc978aba for real, re-pinning KNOWN {14: b2ff5e0e884b, 15: 0fe7c5c04aec} plus the engines digests, and running noNerf vs live main. Then: v0.1.67 go/no-go, ship.
- **Owner asked for stickers that look like the characters.** Done with NovelAI references from the game's own art. Tripo isn't suited to 2D, so no Tripo credits were used.

## UPDATE 2026-10-31 06:06 UTC (coordinator): v0.1.66 LIVE

- **v0.1.66 "Mirrors, Curses and the Gear Update" shipped.** main = fc978aba. version.json: 0.1.66, build fc978aba885e, sim b2ff5e0e884b, deployed 06:05:54Z.
  - Go/no-go: GO (review/v0.1.66-go-final @ a59bb70a).
  - Live check is running in session_01Ayo4eqbtBL2j9SWeXTtVEp.
- **v0.1.67 "Ribbons, Frames and Stickers"** is release/v0.1.67 @ 91efe16a (COOP 15, sim 0fe7c5c04aec).
  - Gates are green.
  - The go/no-go is running in session_01Ayo4eothACitNJFzaqtizA.
  - The assembly session is adding a test-only coop-rejoin wait fix.
  - On GO: push to main, poll, live check.

## UPDATE 2026-10-31 06:45 UTC (coordinator)

- **v0.1.66** is live. Its live check (session_01Ayo4eqbtBL2j9SWeXTtVEp) is running; 1280x720 passes so far.
- **v0.1.67**: release/v0.1.67 @ eb0b1ab9. Its go/no-go (session_01Ayo4eothACitNJFzaqtizA) is running.
- **New: v0.1.68, item icons 3D-flat and set identity.** Builder: session_01Ayo4eqMGbYD6CyGCx9Unp7, branch feature/item-icons-3d off main.
  - The owner reported that the new item icons aren't flat 3D. On live, 17 items have no baked art: tie_pin, collar_pin, lens_nightglass, and 14 setbox_*. Hair Clip and Necklace fall back to the charm art.
  - The owner also reported that every set box looks the same. The logic is already set-specific (setBoxSets), but there are no gear_<set>_<slot> looks at all and the modal is generic.
  - Scope:
    - 30 set looks (6 sets × 5 slots);
    - 14 set-box icons;
    - 3 tools;
    - Hair Clip and Necklace ladders;
    - setBoxModal redesign, with the set header, the five pieces shown and the set bonus;
    - backpack copy;
    - a guard test so no item ships without baked art.
- **Tripo website batch**: the owner says Claude in Chrome generated all 54 checklist rows on the Tripo website. Waiting for the owner to upload a GLB zip. The API can't list website-made models, and the owner's computer folder isn't offered to cloud sessions. Process it like batch 1 when it arrives.

## OWNER DECISION 2026-10-31 ~06:55 UTC

- **Tie Pin and Collar Pin stay Supply Bot only for now.** Owner: "keep it in supply bot for now". Don't add player sources (Titan shop / Bounty Exchange / drops) until the owner asks. UR Set Boxes are likewise Supply Bot only (SET_BOXES_V2 default).
- The Tripo website batch is about 900 MB. The owner will upload it as a **draft GitHub release** with tag `tripo-raw-batch-2`. Delete the draft after processing.

## UPDATE 2026-10-31 07:12 UTC (coordinator)

- **v0.1.66**: live check PASS (review/v0.1.66-live @ 337e77d0). About 1,600 requests, all 200, with no errors; a v0.1.65 save loads with no loss.
  - Follow-up logged: the lobby reload blocks for ~30 s on software GL at 1280x720. This is pre-existing.
- **v0.1.67**: the go/no-go (session_01Ayo4eothACitNJFzaqtizA) is still running on eb0b1ab9. Smoke shows only the known failures.
- **v0.1.68 pieces in progress:**
  - **item icons:** feature/item-icons-3d @ 9a66575e has 41 icons. Still to do: 18 more set looks, the modal and the backpack (session_01Ayo4eqMGbYD6CyGCx9Unp7).
  - **set-boxes-v2 + LR awakening:** feature/set-boxes-v2 (session_01Ayo4eqpJHzAuKCjFySULet); the spec is spec/set-boxes-v2 @ 59175f96.
  - **sandbox catch-up:** feature/sandbox-catchup (session_01Ayo4eqKEZMVKDHYpn5m6yk).
- **Tripo batch 2**: the owner shared a Google Drive folder with 5 zip parts, about 900 MB. drive.usercontent.google.com downloads work from cloud sessions.
  - The Tripo session (session_01Ayo4eniSEuWQnvLYk8muWz) is processing them into feature/tripo-batch-2.
  - Drive file ids are in that session's brief. No GitHub release was needed.

## UPDATE 2026-10-31 07:26 UTC (coordinator): v0.1.67 LIVE

- **v0.1.67 "Ribbons, Frames and Stickers" shipped.** main = eb0b1ab9. version.json reports 0.1.67, build eb0b1ab9c2a5, sim 0fe7c5c04aec (COOP 15), deployed 07:25:30Z.
  - The go/no-go said GO (review/v0.1.67-go @ 313af715).
  - The live check is running in session_01Ayo4eqvsSc9sAZx6NDAzRZ.
- **v0.1.68 candidates** (each one needs a fresh review before assembly):
  - feature/item-icons-3d (session_01Ayo4eqMGbYD6CyGCx9Unp7)
  - feature/set-boxes-v2, including the LR awakening (session_01Ayo4eqpJHzAuKCjFySULet)
  - feature/sandbox-catchup (session_01Ayo4eqKEZMVKDHYpn5m6yk)
  - feature/more-page-dps (session_01Ayo4er7JW8s4hvHWF54K76)
  - fix/stickers-setting-shadow @ 5886ac20, which still needs its review
  - Patch-note line: "Turning off other players' stickers now stays off even after opening the game in an older tab."
- **Tripo batch 2** (feature/tripo-batch-2, session_01Ayo4eniSEuWQnvLYk8muWz) is processing.

## UPDATE 2026-10-31 07:40 UTC (coordinator)

- v0.1.67 is live. Its live check is running in session_01Ayo4eqvsSc9sAZx6NDAzRZ.
- **Set Boxes v2 + LR awakening** are on feature/set-boxes-v2 @ fbe3b3b2 (session_01Ayo4eqpJHzAuKCjFySULet).
  - Built: random and preset boxes (preset is Supply Bot only), batch open of 20, and UR boxes that are Supply Bot only.
  - D5: an ✦ Awaken flow to LR, plus a free "Unbind to Blank LR".
  - Waiting on:
    - a full npm rerun;
    - the 28 SET_BOX_V2_IDS icons (session_01Ayo4eqMGbYD6CyGCx9Unp7), which must also remove the RELEASE BLOCKER test exception;
    - then a fresh reviewer.
- **The LR bar on set gear fails for kohaku_tsubaki p2t5: crowd is ×1.02** of the urset bar (Akane 53.21M crowd, Aoi 13.26M boss with Geometry).
  - The coordinator applied the owner's rule ("LRs beat every character", no nerfs). Fix: buff that path's crowd output on **fix/duo-p2t5-lr-bar** off main.
  - It is a sim change: COOP_PROTOCOL 16, KNOWN[16]. `lrBar --gear urset` becomes part of the official gate.
  - Ships in v0.1.68.
- Owner defaults recorded: no UR box sources; pins stay Supply Bot only; batch cap 20; "Preset" rename; uniform random mains; free unbind.

## UPDATE 2026-10-31 08:02 UTC (coordinator)

- **v0.1.67 live check: PASS** (review/v0.1.67-live @ 1e495770).
  - All requests returned 200; no errors.
  - Cosmetics, banners and stickers e2e passed against the live files.
  - COOP 15: two clients, hashes match.
  - A v0.1.66 save loads with no loss.
  - The one failure is the pre-existing coop-freeplay glitch-banner test-timing check. It is test-only, fixed on fix/coop-freeplay-banner-wait (session_01Ayo4eoDNHhkN52WFy65DsA).
- **Reviews running for v0.1.68:**
  - set-boxes-v2: session_01Ayo4en9LvX9W63UgZjtsWs
  - more-page-dps: session_01Ayo4eoeiXQw2BGEY4sgfFu
  - tripo-batch-2 @ 7fcd93eb: session_01Ayo4engqFstYBNjKgbsNUu
- **Reviewed OK:** stickers setting shadow.
- **Still building:**
  - item-icons 28 box ids on set-boxes-v2: session_01Ayo4eqMGbYD6CyGCx9Unp7
  - duo p2t5 option B (gate at 8M crowd HP, plus a refraction buff; COOP 16): session_01Ayo4eqpJHzAuKCjFySULet
  - sandbox catch-up: session_01Ayo4eqKEZMVKDHYpn5m6yk
- **Tripo batch 2:** 47/54 rows done.
  - Missing: Seiran and the Grave Lych.
  - Partial: the dragon tail.
  - Rejected: the scoreboard (it has text).
  - Not imported, by content rules: wolf, cat and fox girl figures in leotard or bodysuit looks from the owner's Tripo library.

## UPDATE 2026-10-31 08:42 UTC (coordinator): v0.1.68 pieces

| Piece | Branch @ sha | Review |
|---|---|---|
| Set Boxes v2 + LR awaken | feature/set-boxes-v2 @ fbe3b3b2 | r1 OK, pending fixes M1/L1/I1/I2. The fix round merges icons 77ae365d and main. |
| Item icons 3D (187 keys, 42 boxes) | feature/item-icons-3d @ 77ae365d (contains set-boxes-v2) | r1 running: session_01Ayo4enLhY2aBZ4nJ1yEqNM |
| Duo p2t5 LR bar (COOP 16, sim e3c222f3ad44) | fix/duo-p2t5-lr-bar @ 47bf83b5 | r1 running. Use **this** branch's tools/balance files when merging. |
| More page DPS + kit rows | feature/more-page-dps @ 7467f96f | r1 running: session_01Ayo4eoeiXQw2BGEY4sgfFu |
| Sandbox catch-up | feature/sandbox-catchup @ e30311ca | r1 running: session_01Ayo4eqeaQJvJqiaACLAQwT. Follow-ups queued. |
| Tripo batch 2 | feature/tripo-batch-2 @ 7fcd93eb | r1 running: session_01Ayo4engqFstYBNjKgbsNUu |
| Stickers setting shadow | fix/stickers-setting-shadow @ 5886ac20 | OK |
| coop-freeplay banner wait (test only) | fix/coop-freeplay-banner-wait @ 25ea080d | Go/no-go covers it |
| Drag (touch) placement offset | fix/drag-touch-placement | Building: session_01Ayo4enwChBzRMnbgGSVo4D |

The v0.1.68 assembly starts once most of these reviews are OK. It is COOP 16 because of the duo fix.

## UPDATE 2026-10-31 09:13 UTC (coordinator)

- **v0.1.68 assembly started**: session_01Ayo4epijedhWS24eX5TLBq, release/v0.1.68 off main, COOP 16.
  - Merge order: the duo fix 47bf83b5 (review OK), stickers shadow 5886ac20 (OK), coop-freeplay test 25ea080d, then set-boxes-v2 @ 6d2e5716.
  - set-boxes-v2 @ 6d2e5716 includes the r1 fixes, icons 77ae365d and main. Its 6806 serial tests are green.
  - KNOWN sim ids now live in tests/fixtures/simIds.js. Keep the duo branch's tools/balance files.
- **Reviewed OK, with fix rounds still running:**
  - item icons: polish L1-L4/N1/N2, session_01Ayo4eqMGbYD6CyGCx9Unp7
  - tripo-batch-2: M1 glow plus L1-L4, session_01Ayo4eniSEuWQnvLYk8muWz
- **Reviews still running:**
  - more-page-dps: session_01Ayo4eoeiXQw2BGEY4sgfFu
  - sandbox: session_01Ayo4eqeaQJvJqiaACLAQwT. Its follow-ups are on feature/sandbox-catchup-next @ 03070e8.
- **Building:** drag touch fix, session_01Ayo4enwChBzRMnbgGSVo4D.
- **Next:** one delta reviewer covering the set-boxes r1 fixes plus the icon polish once that lands. Then the v0.1.68 go/no-go, ship, and live check.

## UPDATE 2026-10-31 09:44 UTC (coordinator)

- **release/v0.1.68 @ a1b160f** (assembly session_01Ayo4epijedhWS24eX5TLBq), COOP 16, sim e3c222f3ad44. Already merged:
  - duo fix;
  - stickers shadow;
  - coop-freeplay test;
  - set-boxes-v2 6d2e5716;
  - icons 1b0e2603;
  - patch note "Set Boxes and Awakening", dated 2026-10-31.
  - Gates are running.
- **Pending merges:**
  - **tripo-batch-2 @ 19c69bf8:** delta r2 is running (session_01Ayo4eoUWNFhiGviW9NFTj3). Main risk is forceContextLoss.
  - **sandbox:** r1 OK. The lows and follow-ups are going onto -next and then fast-forward; a delta review follows.
  - **more-page-dps:** r1 review still running (session_01Ayo4eoeiXQw2BGEY4sgfFu).
  - **drag touch fix:** session_01Ayo4enwChBzRMnbgGSVo4D.
- **Delta review of the set-boxes r1 fixes plus icons polish:** session_01Ayo4emiMG3L3FMopwoRCy4.

## UPDATE 2026-10-31 10:15 UTC (coordinator)

**release/v0.1.68** is at 5db1cf3 plus the bigger stickers (assembly session_01Ayo4epijedhWS24eX5TLBq).
- Merged: duo fix, stickers shadow, coop test, set-boxes+icons (delta OK), drag-touch test fix (smoke 681/681), the L2/I1 box tweaks, and fix/stickers-bigger 3db8c68c.
- Gates on a1b160f:
  - noNerf: 0 under.
  - lrBar default and urset: all ≥1.32.
  - engines, coop and build: OK.

**Still to merge:**
- more-page-dps: r1 OK. Fix round in progress: M1 stale live counts plus L1–L5 (session_01Ayo4er7JW8s4hvHWF54K76).
- sandbox-catchup @ 9fea5a42: delta r2 running (session_01Ayo4epHrgkW1Z1pB6zNeCW).
- tripo-batch-2 @ 19c69bf8: delta r2 running (session_01Ayo4eoUWNFhiGviW9NFTj3).

**Owner asks this hour:**
- Bigger stickers: done.
- A kobra.systems link ("better taste in UI"). I proposed a UI polish pass after v0.1.68; waiting on the owner.

## UPDATE 2026-10-31 11:19 UTC (coordinator)

All v0.1.68 pieces have passed review and are merged, or merging, into release/v0.1.68 (assembly session_01Ayo4epijedhWS24eX5TLBq). It's COOP 16, sim e3c222f3ad44.

Pieces:
- duo p2t5 fix 47bf83b5
- stickers shadow 5886ac20
- coop-freeplay test 25ea080d
- set-boxes-v2 6d2e5716, plus L2/I1 tweaks
- icons 1b0e2603
- drag-touch test fc049543
- stickers-bigger 3db8c68c
- tripo-batch-2 19c69bf8, plus L1-r2/L2-r2/I1-r2/I2-r2
- sandbox-catchup 9fea5a42, plus R3/R4 CSS
- more-page-dps 768da799, plus L7/L8 test hardening

Deferred follow-ups:
- sandbox R1/R2 precision (Resonance rounding, Armor Pierce typical mean)
- UR box band colours on the teal and pastel boxes
- DUO_T5 engines scenario
- damage-source split for mirrors, tether and DoT (needs a sim change)

Next: final gates, a fresh go/no-go, ship (not between 23:00 and 01:00 UTC), live check.

Owner decisions still pending:
- art v3: C recommended
- co-op sharing defaults
- Suzu/Azami boss damage
- UR box sources
- the shieldline shield
- UI polish pass (kobra link)

## UPDATE 2026-10-31 12:01 UTC (coordinator)

- **release/v0.1.68 @ a3d97a3.** Every piece is merged.
  - **Luna more-page test:** it was a test-timing flake (frame-rate dependent burst). The placement grids are identical across trees and across quality settings: 118,800 samples hash to d01c66d39a03829d. No gameplay or co-op risk.
  - **Gates done:** noNerf vs live (0 under) and lrBar default + urset (OK).
  - **Still running:** e2e, npm test and build (assembly session_01Ayo4epijedhWS24eX5TLBq).
- **Go/no-go launched in parallel:** session_01Ayo4eovQc5waR8iBPmtsjF, on a3d97a3.
- **On GO:** push to main (COOP 16), poll, live check.

## UPDATE 2026-10-31 13:56 UTC (coordinator): v0.1.68 LIVE

- **v0.1.68 "Set Boxes and Awakening" shipped.** main = a3d97a38. version.json: 0.1.68, build a3d97a387a4b, sim e3c222f3ad44 (COOP 16), deployed 13:56:03Z.
  - The go/no-go said GO (review/v0.1.68-go @ 7fbde5d). 6933 tests pass and all 16 e2e are green.
  - The live check is running in session_01Ayo4eq9ZQ5UZf8CbNXT1xg.
- **Follow-ups (deferred, low):**
  - e2e/smoke.mjs:189-203: the SSR Select Ticket step needs waitForFunction (it flakes).
  - Sandbox R1/R2 precision.
  - UR box band colours on teal and pastel boxes.
  - A DUO_T5 engines scenario.
  - A damage-source split for mirrors, tether and DoT (needs a sim change).
  - Lobby 30 s block on software GL.
  - Defer the recruit music.
- **Owner decisions pending:**
  - Art v3 (C recommended).
  - Co-op sharing defaults.
  - Suzu/Azami boss damage.
  - UR box sources.
  - The shieldline shield.
  - A UI polish pass (inspired by the kobra link).
  - Tripo re-rolls (Seiran, Grave Lych, dragon tail, scoreboard).
- **Usage:** sessions showed a seven_day "allowed_warning". Pace new sessions.
