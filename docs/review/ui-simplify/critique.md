# UI simplify: critique of the six family audits

Read only. I read all six audit-*.json files (199 screens, 707 non-keep items), checked the shots in shots/, and checked
the source and docs listed below. Nothing in /home/user/wt-ship was edited.

Two rules come up again and again below:

- **Owner E1 (approved Oct 20, UI_DIRECTION §5.10; UI_V2_MENUS M5 "Owner sees: … the host girl with her line").** Hub
  and list screens have a host girl, and her bubble is visible and "picked by state". The home is different: there the
  secretary's bubble is already tap-only (owner, Oct 27, "Quiet Home", lobby.js:9), and secretaryLines() puts the urgent
  line first. So the home needs no change. On the hubs, "show the bubble only on tap" goes against E1. The fix that keeps
  E1 is to make the line say something the screen does not already say, and to make it follow the open tab.
- **The co-op data hash.** src/online/coop/version.js hashes `JSON.stringify([UNITS, ENEMIES, STAGES, MAPS, BATTLE,
  DIFFICULTIES, …])`, and that includes text fields. Any cut or shortening done by editing stages.js, units.js, types.js or
  event stage data changes the hash, so players on two builds can no longer co-op and the fast lane is lost. Do all of
  those in the display layer only (inventory.js, stage.js, campaign.js, girlFrame.js). items.js and missions.js are not
  hashed.

## 1. Corrections

Format: **screen · item** — audit verdict → my verdict. Why.

### A. Cuts that lose information a player needs

| Screen · item | Audit | Mine | Why |
|---|---|---|---|
| bounty, titans, stage-prep (all states), assault · locked Sweep + its reason ("Clear on Hard first", "Win a tier first", "Sweep: clear on Hard / clear it once", the lone locked ×10) | cut (show Sweep only when it can run) | **shorten**: one locked Sweep chip with a lock and "Hard" (or "Win 1"), no separate reason line | This is the only place players learn that Sweep exists and what unlocks it. Sweeps are the payoff of a Hard clear, and the Energy plan and the event daily sweep cap depend on them. Making it one item instead of two still removes the repeat. |
| campaign-ch4 (and every Act II card) · "Clear 4-1 first" | shorten to a lock icon only | **keep the text when the requirement is not the card just before it**; icon only otherwise | Act II x-6 needs c-5 **and** (c-1)-10 (stages.js:820). "The order is obvious" is false there. |
| battle-drawer · "· SHARPENED TIPS" (next upgrade name ×3) | fold into the hold tree | **keep** | It tells them what they are about to spend in-battle coins on. Path + tier + price does not say what the upgrade does. |
| battle-drawer · "Tip: hold a girl (or her card)…" | fold into the tutorial coach | **keep as is** | The fold target does not exist: coachSteps.js has no hold step. The tip is already one-time (localStorage TIP_KEY, upgradeTree.js:586) and deliberately left out of the coached battle ("holds are off there", :593). Folding it would mean building a coach step in a flow where holds are off. |
| clan-requests · "+50 coins and +1 clan XP per point" | fold into "the donate step's quantity picker" | **keep** (shorten to "+50 coins · +1 XP per pt") | There is no picker: Donate is direct +1 / +N buttons (donatePanel.js:311-312). This line is the only place that says what giving items away pays. |
| clan-requests · "New online accounts can donate after 7 days." | shorten to "Can donate in 7 days" | **keep the rule wording** (or "New accounts: 7 days") | It is a static rule (donatePanel.js:66), not a countdown. "In 7 days" is wrong for a 3-day-old account. |
| clan-boss · 50-word rules paragraph (390x844) | cut | **shorten** to one line: "This week: <arena> · 3 tries a day" | The arena name tells them which team to bring, and three tries per 24 h is the spending rule. Neither the bar nor "Fight 3/3" says which arena. |
| event-gifts · "Gifts arrive in your Mailbox and keep until the Exchange closes." | cut | **shorten**: "To Mail · keep until Nov 22" | This is a deadline. Gifts expire with the Exchange (Nov 22), a week after the event (Nov 15). No other place on the tab says so. |
| challenge · "Losing still pays coins for every wave you held." | fold into the prep info sheet | **keep on the hub** (one short line); fold only the miniboss list | The fold target is missing: the rule is hard-coded in challenge.js:83, and infoSheet() prints only stage.desc. It is also economy information that changes how much they risk. |
| titans · Practice | fold into Details | **keep in the footer (ghost)** | Details is info-only (titans.js:119, "P1"). Practice is the only way to fight without spending a Trial Key, so it is a spending choice that should sit beside Fight. "Fight falls back to Practice" only helps when they have no keys. |
| girl-gear-sheet / picker · Reroll subs · Change main · Join a club | fold into the piece's Details sheet | **keep on the sheet** (one compact row) | openPieceDetails (girlGear.js:489) has no actions, so this would have to be built. These actions spend Fortune Dice and materials, and hiding them behind Details makes them harder to find. Four e2e taps would also move (ur-gear.mjs:214, m2Scenes.mjs:115-117). |
| girl-awaken · "+8% damage and Kon reaches 0.3 tiles further." | fold into Details › | **keep in Compact** | It is what the materials buy at the next star, the reason to press Awaken. Instead, cut the "Cost" kicker and pin the cost row and button. |
| girl-level · "Gate 4 · Level cap 40 → 50" | shorten to "Level cap 40 → 50" | **keep "Gate 4"** | The Mall labels its offers with the gate number ("Needed: Hikari · Gate 4", mall.js:228). Without the number on the gate card, players cannot match the two. |
| girl-potential · "Every step makes her stronger; from P3 each one (✦) … opens her next level gate past 60" | cut | **shorten** to one line: "✦ = a new trick · each step opens a level gate" | It is the only place that ties Potential to the 60 → 85 gates (an owner growth decision). The node row does not explain ✦. |
| backpack-all / enhancement · tile item names | fold (name only in the item sheet) | **keep; clamp to one line** | Gate costs, clan requests ("10 × Sparrow Feather") and Mall tags all name items. Same-family tiers share look-alike art until the item-icon redo (HANDOFF §4, "item icons family by family", not done yet). |
| backpack-tokens · Coins / Gems tiles | cut ("a tap on a top-bar wallet can open the item sheet") | **keep until the wallet tap exists** | Those tiles are the only way to open the coin and gem sheets (what a currency is for, where to get it). The top-bar tap does not exist today (gems "+" opens the Mall). |
| backpack-sst · "Choose any SSR student but Tenka and Kohaku & Tsubaki…" | shorten to "Pick one SSR · 1 ticket" | **"Pick one SSR (no LR) · 1 ticket"** | This is spending information: a player hoping to use the ticket on an LR girl will not know why she is missing from the grid. |
| invite-toast / multiplayer · "Do not raise the pop-up on Co-op or Multiplayer" | cut the toast there | **agree, but add the "9 min" countdown to the invite row first** | Today the invite rows show only "1-3 · Sprinting Gold" (multiplayer shot). Without the toast, the expiry disappears from those screens. |
| coop / coop-invites · "Drops go to both; medals stay solo" | fold into the room's "How co-op works" | **agree, but add it as a new tip** | That panel (coop.js:1012-1020) has five tips and none of them is about drops or medals. It shows only inside a room, after they commit. |
| coop-room · Freeplay + Tryout Day rows | move behind the stage's Change sheet | **move the picker, keep a read-only chip** ("Freeplay · Tempest ×1.5") | This is co-op state the guest must see before pressing Ready. A sheet only the host opens hides it. |
| needs-update · "…Chat, clans and co-op work as usual." | cut the whole sentence | **cut only the owner-setup half**; keep "Chat, clans and co-op still work" | The contradiction with the offline pill only happens in the local-mode capture. Live, this card shows with the server up, and that half is true and useful. |
| stage-prep-event · "Pumpkin Candy ×60 per win · sweeps count" | shorten to "×60 per win" | **keep "sweeps count"** | It is how they farm event currency within the daily sweep cap (owner decision), and e2e/halloween.mjs:410 asserts it. |
| commissions-daily · "Win 3 battles (sweeps and Titan Trials wins count)" | shorten to "Win 3 battles" | **"Win 3 battles (sweeps count)"** | It changes how they finish the task. That Titan Trials wins count is a fair cut. |
| stage-prep-mode · "Off: the battle ends at wave 20. You can still Keep going from the victory screen." | cut | **shorten**: "Off · Keep going after a win" | First-time teaching for Keep going. Nothing else on prep mentions it. |
| battle-results (not captured) · "No drops this time — harder difficulties roll more items." | shorten to "No drops" | **keep the hint, short**: "No drops · harder rolls more" | It tells them how to get drops. Capture the screen before deciding anything here. |
| battle-results · Practice line | shorten to "Practice: nothing saved" | **"Practice (stage locked): nothing saved"** | Keep why. Without the reason it reads like a bug. |
| lobby · Events tab "12D" sticker | cut (the event card counts down) | **keep** | The news chip has three pages, turned by hand (lobby.js:15). Once they turn it, the card's countdown is gone, and the tab is the only timer left on the home. |
| mall-gems · layoutFix "Gems can be bought with real money" | (premise) | **wrong premise** | The Gem Shop spends gems, and nothing in src sells for real money (honors.js:45-47). The verdicts stand; the reason does not. |

### B. Cuts that break an owner decision

| Screen · item | Audit | Mine | Why |
|---|---|---|---|
| happening ×3, mail ×2, commissions ×4, missions ×2, tryout, multiplayer ×4, mall ×6, assault, bounty, titans · host bubble | fold behind a tap, or cut | **keep visible; rewrite the line table** (hostLines.js) so it adds news and follows the tab | Owner E1 and the M5 "Owner sees". Examples: Mail says what expires soonest; Commissions on Weekly says the weekly reset; Happening on Coming Up says what starts first; Mall idle gives the restock time; Assault when locked shows no bubble (allowed: "a line picked by state"). The test edits then shrink to line text. The home secretary is already tap-only, so leave it. |
| multiplayer ×4 · "Coming soon" → "Soon"; "Rival Run inside" cut | shorten / cut | **keep as is** | Owner #108 (badges.js:65-66, multiplayer.js:12): PvP "Coming soon" with Rival Run inside, Titan Co-op "Soon". The two words are on purpose. |
| multiplayer-pvp · Rival Run sheet sentence, "3 scored runs a day", "a few gems a week" | shorten | **keep** | Owner #108: "one sentence, the rule chips, the rewards". "Scored" (practice runs are free) and "a few … a week" (how much) are information. |
| multiplayer ×4 · Quick join | cut | **owner board first** | It is in the M5d hub the owner approved (#79/#108, multiplayer.js:9). Cutting it rewrites e2e/multiplayer.mjs:350-353, :444-465 and the model tests. |
| journal, journal-entry · "Captain's Journal" → "Journal" | shorten | **keep; rename the Menu row to match instead** | The owner's story request names the feature (OWNER_REQUESTS "Menu → Captain's Journal"). JOURNAL_TEXT also feeds the lesson title card and the "Hikari's Captain's Journal is here" toast (player.test.js:35). |
| notice · intro "Every version… 100 [gem] — claim it once per version" and the "Update" tag | cut | **cut the intro; keep the gem icon in the tab** ("71 ◆", not "71 gifts") | It follows the owner's patch-notes request (dated versions plus a claim button). "71 gifts" drops what the gift is. "Claimed ✓" and "Claim 100 ◆" carry the rest. |
| girl-* (24 states), students-hold · epithet ("Wind Ranger") | fold into Profile | **owner board item, not a silent cut** | The epithet is on the plate in UNIT_INFO_SPEC (owner request #152 mock-ups, lines 470/488) and in ROSTER.md. openProfile() (student.js:642) does not print unit.title, so the "fold" would also have to be built. |
| girl-tree ×3 · "One path to tier 5, a second to tier 2." | fold behind the ⓘ | **keep** | It is the path-cap combat rule (owner standing decision: one final tier per path per girl type), it is one short line, and planning a build is what this tab is for. |
| (not captured) Gate Arc content-note card ("This arc contains war and loss.", before g1.pro at 1-6) | not audited | **protect explicitly** | It is the arc's one content note (GATE_ARC.md:1106, owner default Oct 28, STEP3 "no second note"). No family captured it, so a later "cut cards before scenes" sweep must not touch it. |
| (not captured) lesson pill / journal toast, tutorial coach copy | not audited | **protect** | Owner T-01..T-03 and the toast with Hikari's face (OWNER_REQUESTS story section). The audits' "one mark per row" rule is for Journal rows only. |
| battle · free-hero banner ("<hero> deploys free — tap the grass!", controller.js:1344) and the hero card's FREE | not cut | **keep** | It carries "heroes are free" (owner standing decision) and arms hero placement. Do not let the "one rule for hints" sweep or the Formation shortening remove it. Formation keeps "Free" on the hero slot. |

### C. "Fold" targets that do not exist yet (each needs a build)

1. A tutorial coach step for hold-to-view. It is not in coachSteps.js, and holds are off in the coached battle (see A).
2. A donate quantity picker. It does not exist (see A).
3. Titan Trials Details with actions. Details is info-only.
4. Gear piece Details with Reroll / Change main / Join club. openPieceDetails is info-only.
5. The miniboss and "losing pays" rules in the Challenge prep info sheet. They are hard-coded in challenge.js:83, and infoSheet() prints stage.desc only.
6. The epithet in the Profile sheet. openProfile() has no unit.title.
7. A tap on the offline pill opening a sheet. Today it is a hover title only (common.js:146). Profile has no pill at all (profile.js:350).
8. A top-bar wallet tap opening the coin and gem item sheets (Backpack Tokens).
9. The level number on the home avatar's XP ring.
10. Tappable locked event episodes with a toast. They are disabled today (event.js:267).
11. Messages › Blocked as a sheet from the gear menu.
12. A Clan emblem picker sheet.
13. A Settings › Install control (beforeinstallprompt / How).
14. A gear "vs Ruri" compare toggle chip.
15. A home for Challenge's Freeplay grid ("its own tab").
16. An Assault footer with a disabled yellow Challenge carrying the lock.
17. "How co-op works": it exists, but it needs a drops/medals tip, and the hub never shows it.
18. Multiplayer as the single co-op hub with #/coop cut down to "Host a room". This is a restructure, not a fold.
19. Workbench "+" in empty slots and the Salvage empty pick boxes. Small, but new.

Folds whose targets do exist: the stage prep info sheet (mission, chapter mechanic, enemies with counters; stage.js:1223), Recruit Rates (pool, shared pity, spark; recruit.js:503-519), the bestiary locked-entry sheet, the item sheet, the Select Ticket confirm, mbx-read, the achievements ladder sheet, the girl page "+N" Traits sheet, Base stats › Role, the ⓘ on the Tree, and the Licences sheet.

### D. Test rewrites that are not worth it

| Rewrite | Cost | Verdict |
|---|---|---|
| Host bubble on tap: e2e/hubs.mjs:162, :418, :421, :710; lists.mjs:161-175, :168; multiplayer tests | 6+ checks | **Don't.** It breaks owner E1. Rewrite the line table instead (only the text asserts change). |
| "Coming soon" / "Rival Run inside" / Rival chips: m5-kit.mjs:209, multiplayer.test.js:36, :68-70 | 4 | **Don't.** Owner #108. |
| Quick join removal: multiplayer.mjs:350-353, :444-465; multiplayer.test.js:108-125 | ~25 lines | **Not before an owner yes.** |
| Gate title and level-cap words: potential.mjs:583-591, :616; ascension.mjs:141-144 | 3 files | **Don't.** It breaks the Mall gate cross-reference, and the gain is a few characters. |
| Potential rule lines: potential.mjs:280, :286 | 2 | **Don't.** Only drop the duplicate hint "A duplicate gives 1 Essence" (:289). |
| "Captain's Journal": player.test.js:35, journal-data | 2 | **Don't.** Owner-named feature. |
| Donate strings: social.mjs:500, :561, :563 | 3 regexes | **Not worth it.** The rate stays. "Donated 0/30" plus dropping the time zone saves about 20 characters. |
| "+3 more" invites: multiplayer.mjs:242, :290, :471; ui-shots.mjs:167 | 4 regexes | **Not worth it** for 7 characters. |
| "Find a clan first" → "No clan yet": multiplayer.mjs:490 | 1 | **Not worth it.** A sideways change, and the old words say what to do. |
| Settings Install control: lists.mjs:574-580 plus new beforeinstallprompt code | build + test | **Not worth it** for one Settings row. |
| Disabled-Sweep checks: hubs.mjs:319-322, :391 | 2 | **Unneeded.** The compact locked Sweep stays, so only the reason line changes. |
| Co-op room version line: update-check.mjs:274 | 1 | **Not worth it.** The line helps players debug a co-op mismatch. Keep it at 1280 only. |
| Event candy "sweeps count": halloween.mjs:410 | 1 | **Don't.** See A. |
| Plate titles: hubs.mjs:336, lists.mjs:315, :657 | 3 | **Worth it only** as one plateHead rule at widths of 561 px and up. The items audit keeps plate titles where the rail is icons-only at 390, and the home audit cuts them everywhere, so the two disagree. |

Worth it, with cheap edits: hero card "Lv 1" (hero.mjs:153; it also fixes the known wrap), Journal NEW count (story.mjs:409),
battle-save block (battle-save.mjs:309), Tryout Before Class title and chips (tryout.mjs:199, :476, :523-525; the busiest screen),
Achievements readyN (hubs.mjs:504, :579-587; achievements.mjs:199, :205), and the Students summary row (no tests).

### E. What the audits missed

**Busy or broken screens scored low:**
- tryout-yearbook ×4 (score 4) and tryout-jar (6) are **broken at 390x844**: the 204 px rail beats the 60 px phone rail
  (tryout.css:172 against hubs.css:389). They are flagged in the layout notes but scored as if they were only wordy. Treat
  them as bugs, batch 1.
- girl-awaken-detailed (6), girl-awaken (4): the **primary (Awaken) is below the fold or touching the edge** at 844x390. That
  deserves a higher score than its word count gives it.
- girl-gear / -empty (4-5): the Hair Clip and Necklace row pushes the totals off screen at 844.
- formation (6): the girl picker starts only after a full scroll past Recommended at 844, on a core screen.
- title (3): the side stack overlaps TAP TO START at 390x844. It is a known backlog bug (HANDOFF task #231) and was scored as minor.
- needs-update (3): the Mochi loader is stuck over the finished card at 844. It may be a bug, not only a capture artefact.
- coop-room (8): correct, but its cause (the head pushes both player cards and Start below the fold) is a layout bug, not copy.

**The same thing said twice, not listed:**
- Practice is said three times: the HUD chip, the battle-start toast (controller.js:1347) and the Results line. Keep the
  chip and Results; the toast can go on non-first practice runs.
- Bounty: the "Drops · Normal" qualifier is cut, but the tier names are kept, so after the cut nothing says which
  difficulty's drops are shown. Keep "Normal" as a chip, or show the selected difficulty's drops.
- Mall Gem Shop: the head chip says "Weekly 5d 12h" while the Coins card resets Daily. The audit covered this on Bounty
  only; Gems has it too.
- Messages: the safety line "Be kind — never share your real name, school, address…" (messages.js:354) **never shows at
  390x844** because the empty pane is hidden there (the social notes mention it, but no screen lists it as a fix). That is a
  missing safety line on phones, not a repeat. Show it on the phone Friends or Chats list.
- Player card: if the card's friend-code block goes (cross-screen), its "Only share your code with people you know." and
  "Who can message me" (playerCard.js:126) must stay on the card or move with the code. Messages › Friends already has
  its own tip (messages.js:276).
- The hold sheet's five empty "+" gear tiles look tappable but are not (students-hold). The audit caught it there; the same
  frame shows them on profile showcase holds.
- The event header countdown and the Exchange's own close date are two deadlines (Nov 15 and Nov 22). Once the dates line
  is cut, the head must say which one the chip counts down to.

**Process gaps:**
- Not captured, so not judged and to be protected: the content-note card, the lesson pill, coach bubbles, battle results
  and rewards, the Class Photo, and the Weekly Before Class. Capture them before batch 2 touches results.js or tryoutSetup.js.
- The stage-prep-continue and -new captures show locked stages, so the Continue and new-stage states were judged from
  the source. The coop / coop-invites and settings / settings-display pairs are identical captures.
- The co-op data hash rule (top of this file) is not mentioned in any audit apart from one halloween.js note.

## 2. Top 10 screens to fix first

1. **Stage prep (19 states, 6-8)**: Start reads only "Start"; drop the tier plate and the bold difficulty name; put the
   mission line behind the ⓘ on the map plate; make the saved block faces + time; show one compact locked Sweep; shorten
   "Borrow a girl".
2. **Formation (6)**: Pick girls directly under the Squad, Recommended as one needs line in the Squad head, "Deploy
   2,800" plus "Free" on the hero slot, and one team label.
3. **Girl page frame (24 states)**: one chip row (role name, attack chip, +N) so Matchup and Potential fit; cut the
   role-family sticker; pin Awaken's cost and button; five gear slots in one row. The epithet goes to the owner board.
4. **Recruit (9)**: cut the side gems and ticket pills and the "Student Spotlight" kicker; shorten to "SSR pity 90 to go"
   and "/ 200"; keep every rate and the guarantee.
5. **Co-op room (8)**: one-row head (code, stage chip, invite, leave) plus a read-only Freeplay/Tryout chip, so both cards
   and Start sit above the fold; one "Host"; the local note behind the pill.
6. **Tryout Before Class (9) + Marble Jar + Yearbook**: fix the 390 rail CSS (five states), drop the head title and the
   "Yours" chips, show the Random Class help only when it is on, and put the stamps line on Students only.
7. **Event pages (7 states, one drawHeader)**: one header row (art + countdown), one tab label set, drop the section bands,
   and move the leftover-candy line to the panel head. The beach event after Nov 8 reuses this code.
8. **Clan (6 states)**: one 44 px header row on all five tabs; Applicants/Requests renamed to Donate; keep the donate rate.
9. **Workbench (8)**: the 390x844 overflow bug, "+" in empty slots, a lock plus "6-5", "3/3 left".
10. **Bounty + Titan Trials + Total Assault hubs (7-8)**: enemy list to the prep info sheet, cut the plate titles and the
    "Tier"/"Drops" labels, one compact locked Sweep, Practice stays, and host lines that add news.

## 3. Build order

**Batch 1: fast lane (display only; no hashed data; no owner question; small test edits)**
- Layout bugs: the Tryout 390 rail scope, the Workbench 390 stack, five gear slots in one row, Awaken pinned, the title
  side stack at 390, the needs-update loader check.
- Pure copy, done in the UI layer: Start labels, the rule-line name, hero card "Lv", the Bestiary 0/96 vs 0/92 bug, the
  Achievements double count, the event header, short tab labels and section bands, Notice second lines and intro, Journal
  row numbers and "Lesson N", the Recruit side pills and kicker, Happening chip words, "Clear 5-5 first" in Happening,
  "Open!" everywhere, Backpack empty-state doors (Free pulls / Total Assault), the Mall SSR ribbons, Craft Room labels,
  item flavour in items.js, the Students summary merge, filter kickers, the duplicate Messages "1", and Settings About
  footers.
- Fixes for the gaps in section E: the safety line on phone Messages, the invite-row countdown.

**Batch 2: small builds (full review gate; capture the missing states first)**
- Stage prep (map plate ⓘ, saved block, compact locked Sweep), the Formation reorder, the girl page chip row, the clan
  compact header, the co-op room head with the read-only Freeplay chip plus the new "How co-op works" tip, the offline
  pill sheet in common.js (with localNotice() returning null on menus), the Assault/Titans/Bounty footers, the Tree
  preselected tier, Bestiary first-selected, the shared plateHead title rule for widths of 561 px and up, the host line
  table rewritten to be tab-aware (hostLines.js, visible bubbles kept), and suppressing the invite toast on Co-op and
  Multiplayer once the rows carry the expiry.

**Batch 3: owner board, then build**
- Epithet off the plate, Quick join, Multiplayer as the single co-op hub (#/coop as "Host a room"), Messages Blocked as a
  sheet, the Challenge Freeplay grid move, the Backpack Tokens tab with the wallet sheet built first, the level number
  on the home XP ring, the Settings Install control, and any wording on owner-named surfaces (Captain's Journal, Rival
  Run, "Coming soon", the patch notes). Board defaults: keep everything in section B.
