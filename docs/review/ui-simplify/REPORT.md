# UI simplicity audit (Nov 3) — board notes

**Files**
- `board/summary.jpg`: 1600x1302. The top 10 with before-thumbnails, clutter score, corrected cut/fold/shorten counts and a one-line fix. 299,288 bytes; this one is saved at JPEG quality 74 because quality 80 came to about 327 KB.
- `board/stage-prep.jpg`: #1 Stage prep (19 states), 205 KB.
- `board/formation.jpg`: #2 Formation, 184 KB.
- `board/girl-info.jpg`: #3 Girl page frame (24 states), 224 KB.
- `board/recruit.jpg`: #4 Recruit, 224 KB.
- `board/coop-room.jpg`: #5 Co-op room, 255 KB.
- `board/tryout-setup.jpg`: #6 Tryout Before Class, plus notes on Marble Jar and the four Yearbook tabs, 243 KB.
- `board/event-halloween.jpg`: #7 Event pages (7 states), 219 KB.
- `board/clan-requests.jpg`: #8 Clan (6 states), 267 KB.
- `board/workbench.jpg`: #9 Workbench, 176 KB.
- `board/bounty.jpg`: #10 Bounty + Titans + Assault, 251 KB.
- `./board-src/build.py`, `data.py`, `corrected.json`: the PIL build script, the top-10 data with the critique's corrections, and the corrected verdicts per item. Rebuild with `python3 -I board-src/build.py`.

**How the per-screen boards read:** each 844x390 shot has numbered red/amber/blue boxes that match the side panel ("What goes" and "What stays"). A ★ marks a verdict the critique changed. Items that exist only at 390x844 or 1280x720, or sit covered or below the fold, are listed in the panel but not boxed.

Nothing in `/home/user/wt-ship` was touched. No PNGs were created. One choice to know about: the word "Codex" may be the name of another game, so I left it out of every image and of the report. The test `e2e/codex-modes.mjs:161` is written as "battle-modes e2e, line 161" everywhere.

---

# REPORT.md (content)

## UI simplicity audit: owner board (v0.1.73)

Read only. The inputs were the six family audits, the critique, the shots at three sizes and the text dumps. Where they disagree, the critique wins. Section 6 lists where the critique is plainly wrong.

Words used here:
- **cut** = remove.
- **fold** = move behind a tap, sheet or tab that already exists, or one built first where marked.
- **shorten** = keep the same fact in fewer words.

Two rules frame every verdict below:
- **Owner E1 (UI_DIRECTION §5.10, M5):** hub and list screens keep a visible host bubble. The fix is a better line in hostLines.js that adds news and follows the open tab, not hiding the bubble until a tap. The home secretary is already tap-only, so the home needs no change.
- **Co-op data hash (src/online/coop/version.js):** stage, unit, type and event-stage text is part of the hash. Every cut or shortening of that text happens in the display layer (inventory.js, stage.js, campaign.js, girlFrame.js), never in the hashed data. items.js and missions.js are not hashed. Every batch checks that the hash is unchanged.

### 1. Screen families

There are 177 audited states: 176 captured at three sizes, plus battle results judged from source. Before corrections that is 2,232 keeps and 851 non-keep items.

| Family | States | Score range | Mean | Cut | Fold | Shorten | Keep |
|---|---|---|---|---|---|---|---|
| events (events, Tryout, achievements, bestiary, wiki) | 19 | 4-9 | 5.8 | 69 | 9 | 54 | 177 |
| girls (girl page, formation, students, roster) | 34 | 2-7 | 5.2 | 56 | 46 | 17 | 426 |
| home (title, lobby, notice, happening, mail, commissions, journal, missions) | 24 | 3-7 | 5.4 | 123 | 15 | 18 | 470 |
| items (backpack, mall, recruit, workbench) | 32 | 2-9 | 5.5 | 43 | 12 | 50 | 487 |
| play (hubs, campaign, story, battle, stage prep) | 33 | 1-8 | 6.5 | 81 | 19 | 43 | 252 |
| social (chat, clan, co-op, messages, multiplayer, profile, settings) | 35 | 1-8 | 5.0 | 87 | 24 | 85 | 420 |

Highest-scoring states and the main repeats, per family:
- **events:** tryout-setup 9 and tryout-setup-weekly 9, then event-operations 7.
  - The event header names the event twice, with a kicker and dates on top. One fix in drawHeader covers seven states.
  - Section bands repeat the open tab.
  - There are two tab label sets, chosen by width.
  - The Tryout rail is broken at 390x844.
  - "Yours" chips appear on most tiles.
  - Bestiary shows two different totals (0/92 and 0/96).
- **girls:** six states score 7 (info-detailed, p6, ruri, level-detailed, level-manual, potential); formation scores 6.
  - What she is gets said three times: epithet, role name and role sticker.
  - Her level cap appears four times.
  - Formation names its team three times.
- **home:** notice, invite-toast, commissions-daily and missions score 7.
  - The rail tab is repeated as the plate title on the list hubs.
  - Host bubbles restate the screen. Fix the lines, keep the bubbles.
  - One deadline appears in three formats.
- **items:** recruit 9, then backpack-item-material 8 and workbench 8.
  - Coins and gems are shown twice.
  - The weekly limit is worded four ways.
  - "Standard" means two things on Recruit.
- **play:** bounty, titans and four stage-prep states score 8.
  - The locked Sweep and its reason line appear on every hub and prep.
  - Prep says the difficulty three times and the saved battle three ways.
  - The campaign list says "Mission" but its prep says "Campaign".
- **social:** clan-requests 8 and coop-room 8.
  - Offline status is said three ways.
  - The clan header takes y 57–150 on all five tabs.
  - Co-op is offered in two places.

The critique says these screens are worse than their scores:
- tryout-jar and the four Yearbook tabs are broken at 390x844.
- Awaken sits below the fold or touches the edge at 844x390.
- On the gear tab, the gear rows push the totals off screen.
- Formation starts its picker only after a full scroll.
- The title screen's side buttons overlap TAP TO START at 390x844.
- needs-update shows the loader stuck over the finished card.
- coop-room's score is right, but the cause is a layout bug, not wording.

### 2. Top 10 screens to fix first (critique order)

Counts are for the screen shown on its board, after corrections.

| # | Screen | Score | Cut / fold / shorten | Effort | Layout fix |
|---|---|---|---|---|---|
| 1 | Stage prep (19 states) | 6 (6-8) | 2/1/2 | M | Start says only "Start"; the mission line goes behind an ⓘ on the map plate; one locked Sweep chip; no tier plate. |
| 2 | Formation | 6 | 2/0/2 | M | Picker right under the Squad; Recommended becomes one "needs" line; "Deploy 2,800" and "Free" on the hero slot. |
| 3 | Girl page frame (24 states) | 6 (3-7) | 1/2/0 | M | One chip row (role, attack, +N); Awaken cost and button pinned; five gear slots in one row. |
| 4 | Recruit | 9 | 3/3/4 | M | No side gems or ticket pill, no kicker; "SSR pity 90 to go", "/ 200"; every rate and the guarantee stay. |
| 5 | Co-op room | 8 | 5/5/4 | M | One-row head plus a read-only Freeplay chip, so both player cards and Start sit above the fold. |
| 6 | Tryout Before Class + Jar + Yearbook | 9 (4-9) | 4/1/5 | M | Fix the 390 rail CSS (5 states); no head title or "Yours" chips; Random Class help only when it is on. |
| 7 | Event pages (7 states) | 6 (6-7) | 6/1/3 | S | One header row with a countdown that names its deadline; one tab label set; no section bands. |
| 8 | Clan (6 states) | 8 (5-8) | 3/1/9 | M | One 44 px header row; Requests becomes Donate; the donate rate and 7-day rule stay. |
| 9 | Workbench | 8 | 8/0/4 | M | Fix the 390 overflow; three equal slots with "+", a timer or a lock + "6-5"; "3/3 left". |
| 10 | Bounty + Titans + Assault | 8 (7-8) | 7/1/2 | M | No plate title or Tier/Drops labels; enemy list to the prep info sheet; one locked Sweep; Practice stays. |

### 3. Corrected verdicts, tests and effort

**1. Stage prep.**
- Changed by the critique:
  - "Sweep: clear on Hard": cut → **shorten**, to one locked chip (lock + "Hard").
  - Event prep keeps "sweeps count" (asserted by e2e/halloween.mjs:410).
  - Mode sheet: cut → **shorten**, to "Off · Keep going after a win".
- Unchanged: cut "Bud" and the bold "Hard"; fold the mission line; "Start · Hard" → "Start". On the saved state, the saved block becomes faces + ♥ 33 · 2 h ago, and "Borrow a friend's girl" → "Borrow a girl".
- Tests:
  - battle-modes e2e, line 161 (Start label)
  - tests/data/mapTierNames.test.js:58
  - e2e/shots/m1-stage.mjs:105
  - e2e/battle-save.mjs:309, :554
  - No change needed in hubs.mjs:319-322, :391 or halloween.mjs:410.
- Effort M. Capture the real Continue and new-stage states first; both current captures show a locked stage.

**2. Formation.**
- No verdict changes: cut "Team" and "Hero"; shorten "Team 1" and the squad hint.
- "Free" on the hero slot and the free-hero banner in battle stay.
- Tests: hero.mjs:129-130; teams.mjs:100 still passes.
- Effort M.

**3. Girl page.**
- Changed by the critique:
  - The epithet ("Wind Ranger"): fold → **keep, as an owner board item** (owner request #152; openProfile() does not print it).
  - Awaken effect line: **keep in Compact**; cut the "Cost" kicker and pin the cost row and button.
  - **Keep "Gate 4"**: the Mall labels its offers by gate number.
  - Potential: **shorten** to "✦ = a new trick · each step opens a level gate".
  - **Keep** the Tree path-cap line.
  - **Keep** the gear-sheet actions (Reroll, Change main, Join a club).
- Unchanged: cut "DPS"; fold the capability chips into "+N" and the role sentence into Details ›.
- Tests: girl-page.mjs:306-315 and :285, girlView.test.js:66-70 (all still pass).
- Effort M.

**4. Recruit.**
- No verdict changes.
  - Cut the kicker, the side ticket pill and the side gems pill.
  - Fold the "Standard" chip and two lines that show only at 390x844 into Rates.
  - Shorten four labels.
- Correction to the reasons only: gems are not bought with real money.
- Tests: smoke.mjs:351, recruit-banners.mjs:105.
- Effort M.

**5. Co-op room.**
- Changed by the critique:
  - The Freeplay segment, the multipliers and the Tryout toggle: **fold** into the stage's Change sheet.
  - The "Freeplay" and "Tryout Day" labels: **shorten** to one read-only chip, so the guest sees them before Ready.
  - The version line: cut → **keep at 1280x720 only**.
- Unchanged: cut "(you)", "Host", "together", "You bring Team 1.", "Share the code…". The local note folds behind the pill (needs the C7 build). Add a "drops go to both, medals stay solo" tip to "How co-op works".
- Tests: online.mjs:357, :400, :503; coop-rejoin.mjs:287; update-check.mjs:274 unchanged.
- Effort M.

**6. Tryout Before Class.**
- No verdict changes, and the critique says the test edits are worth it.
- The 390 rail bug comes first: tryout.css:172 beats hubs.css:389. Scope the override to min-width 561 px.
- The Yearbook stamps line goes on the Students tab only.
- Tests:
  - tryout.mjs:181-183, :199, :219, :476, :523-525
  - tryoutMenus.test.js:77
  - tryoutOptions.test.js:62-63
- Effort M.

**7. Event pages.**
- The dates line is still cut, but the countdown chip must name its deadline: the event ends Nov 15, the Exchange closes Nov 22.
- "Read … first" folds into a tap toast only after locked episodes become tappable (they are disabled at event.js:267). Keep the line until then.
- event-gifts: cut → **shorten**, to "To Mail · keep until Nov 22".
- Tests: none assert the cut strings; halloween.mjs:211 stays.
- Effort S.

**8. Clan.**
- Changed by the critique:
  - Donate rate: fold → **shorten**, to "+50 coins · +1 XP per pt" (there is no quantity picker).
  - 7-day rule: **"New accounts: 7 days"** (it is a rule, not a countdown).
  - "Donated today 0/30", the reset line and "You have 10 · 1 pt each": shorten → **keep** (the test rewrites are not worth it).
  - clan-boss rules: cut → **shorten**, to "This week: <arena> · 3 tries a day".
- Header shortenings and "Requests" → "Donate" stand.
- Tests: social.mjs:499-500, :561, :563 stay unchanged. Re-grep e2e for the "Requests" tab label before renaming it.
- Effort M.

**9. Workbench.**
- No verdict changes.
- The 390 overflow is a bug (batch 1). The "+" in empty slots is a small new build.
- Tests: none.
- Effort M.

**10. Bounty, Titans, Assault.**
- Changed by the critique:
  - Host bubble: cut → **keep, with a rewritten line** (E1).
  - Sweep: cut → **one locked chip** ("Hard" on Bounty, "Win 1" on Titans); its reason line stays cut.
  - "Drops · Normal": cut → **a "Normal" chip**.
  - Titans Practice: **keep** as a ghost button in the footer.
- Plate titles are cut only through one plateHead rule at 561 px and up.
- Assault's disabled Challenge carrying the lock is a build (C16).
- Tests: hostLines.test.js:37 (line text only); hubs.mjs:319-322, :391 unchanged; ascension.mjs:221-224 kept.
- Effort M.

### 4. The critique's corrections (summary)

**A. Cuts that lose information a player needs.** Each becomes a keep or a shortening:
- The locked Sweep, as one compact chip.
- The Act II "Clear 4-1 first" text, where the requirement is not the card just before it.
- The battle-drawer upgrade name and the one-time hold tip.
- The donate rate and the 7-day rule.
- The clan-boss rules line.
- The gift deadline.
- Challenge's "losing still pays" line.
- Titans Practice.
- The gear actions.
- The Awaken effect line.
- "Gate 4".
- The Potential ✦ line.
- Backpack tile names.
- The Coins and Gems tiles.
- "No LR" on the Select Ticket.
- The invite-row countdown, added before the invite toast is muted.
- The co-op drops tip.
- The read-only Freeplay chip.
- "Chat, clans and co-op still work".
- "sweeps count".
- "Win 3 battles (sweeps count)".
- "Keep going after a win".
- The two results lines.
- The "12D" Events-tab sticker.

**B. Cuts that break an owner decision:**
- Hub host bubbles stay visible.
- Multiplayer's "Coming soon" / "Soon", "Rival Run inside" and the Rival Run sheet wording stay.
- Quick join and the epithet go to the owner board.
- "Captain's Journal" stays.
- The Notice tab keeps its gem icon.
- The Tree path-cap line stays.
- Protect the content-note card, the lesson pill, the journal toast, the coach copy and the free-hero banner.

**C. Nineteen fold targets do not exist yet.** Each one is a build, so none goes in the fast lane.

**D. Test rewrites not worth it:**
- Not worth it:
  - Host bubble on tap, multiplayer wording, gate titles, Potential lines, "Captain's Journal", donate strings, "+3 more", "Find a clan first", Settings Install, the co-op version line and "sweeps count".
  - Quick join, at least until the owner says yes.
- Worth it, with cheap edits: hero card "Lv", Journal NEW count, the battle-save block, Tryout title and chips, Achievements readyN, the Students summary row.

**E. What the audits missed:**
- The screens scored too low (section 1).
- Practice is said three times.
- Bounty loses "Normal" after the cut.
- The Gem Shop's weekly chip sits beside a daily coins card.
- The Messages safety line never shows on phones.
- The player card's friend-code tip.
- The empty "+" tiles that look tappable but are not.
- Several states were never captured. Capture them before batch 2.

### 5. Batches, e2e and review plan

Every batch is display only and touches no hashed data. Every batch ends with:
- Before/after shots of each touched state at 844x390, 390x844 and 1280x720.
- A text-dump diff.
- A check that the co-op and sim hashes match main.

**Batch 1: fast lane** (about 25 small items, each effort S).
- Layout bugs:
  - The Tryout 390 rail (5 states).
  - The Workbench 390 stack.
  - Five gear slots in one row.
  - Awaken pinned.
  - The title side buttons at 390.
  - The needs-update loader.
- Wording in the UI layer:
  - The "Start" labels and the rule-line name.
  - The Recruit side pills and kicker.
  - The event header and tab labels; no section bands.
  - The Tryout title, chips and Random Class help.
  - Hero card "Lv"; the Bestiary totals; the Achievements double count.
  - Notice and Journal lines.
  - Happening chips; "Open!" everywhere.
  - Backpack empty-state doors; Mall SSR ribbons; Craft Room labels.
  - Item flavour text in items.js.
  - The Students summary row; filter kickers.
  - The duplicate Messages "1"; Settings About footers.
- Gap fixes: the Messages safety line on phones; the countdown on invite rows.
- Tests:
  - tryout.mjs:181-183, :199, :219, :476, :523-525
  - tryoutMenus.test.js:77; tryoutOptions.test.js:62-63
  - battle-modes e2e line 161
  - smoke.mjs:351
  - hero.mjs:153; story.mjs:409
  - hubs.mjs:504, :579-587; achievements.mjs:199, :205
- e2e:
  - The full vitest run and the vite build.
  - Smoke at all three sizes, dev and --prod.
  - tryout, halloween, girl-page, recruit-banners, hubs, lists, story, achievements, ur-gear and potential at 844x390 and 390x844.
- Review: a fast-lane review (display-only diff plus the hash check). The owner gets the board as an FYI.

**Batch 2: small builds** (10–12 items, each effort M). Before starting, capture Continue/new-stage prep, battle results and rewards, the content note, lesson pill, coach bubbles, Class Photo and the Weekly Before Class.
- Scope:
  - Stage prep: the map-plate ⓘ, the saved block and the locked Sweep chip.
  - The Formation reorder and the girl page chip row.
  - The clan header and the Donate tab.
  - The co-op room head, with the read-only chip and the new tip.
  - The offline pill sheet (common.js; localNotice() returns null on menus).
  - The hub footers (Practice stays; Assault's locked Challenge).
  - Workbench "+" slots; tappable locked episodes.
  - The Tree preselected tier; Bestiary first-selected.
  - The plateHead rule at 561 px and up.
  - The host-line table rewrite (bubbles stay visible).
  - Muting the invite toast once the rows carry the expiry.
- Tests:
  - mapTierNames.test.js:58; m1-stage.mjs:105; battle-save.mjs:309, :554
  - hero.mjs:129-130; online.mjs:158-159
  - hostLines.test.js line texts; hubStates.test.js:78
  - hubs.mjs:162, :418-421, :710-712; lists.mjs:161-175 (line text only)
  - Left unchanged on purpose: hubs.mjs:319-322, :391; halloween.mjs:410; social.mjs:499-563; update-check.mjs:274.
- e2e: everything in batch 1, plus the following at 844x390 and 1280x720:
  - online, coop-rejoin, social, multiplayer, battle-save, battle-modes, hero, teams, ascension and update-check.
  - A two-tab co-op check that host and guest both see the Freeplay chip before Ready.
- Review: the full gate. A logic review and a visual review, fixes, then a delta re-check. The owner sees the board before it ships.

**Batch 3: owner board first, then build** (effort M–L once answered).
- Items:
  - The epithet; Quick join.
  - Multiplayer as the single co-op hub (#/coop becomes "Host a room").
  - Messages › Blocked as a sheet.
  - The Challenge Freeplay grid move.
  - Backpack Tokens, with the wallet sheet built first.
  - The level on the home XP ring.
  - Settings Install.
  - Any wording on owner-named surfaces.
- Board default: keep everything in section 4 B.
- Tests once approved:
  - multiplayer.mjs:242, :290, :350-353, :444-465, :471, :490
  - multiplayer.test.js:36, :68-70, :108-125
  - m5-kit.mjs:209; lists.mjs:574-580
- Review: one owner board per item, then the full gate.

### 6. Where the critique is plainly wrong

- It counts 199 screens and 707 non-keep items. The audits hold 177 states and 851 non-keep items, and this report uses the audit counts.
- Nothing else was overturned.
