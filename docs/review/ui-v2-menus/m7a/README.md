# UI v2 menus · M7a: Profile, Story, Journal and the event page

Plan: `docs/specs/UI_V2_MENUS.md` section 5, M7a. Shots: `e2e/shots/m7-records.mjs` (`node e2e/menus.mjs --milestone m7a`).
New rules: `src/ui/styles/v2-records.css` (all under the menus' surface mode).

## Boards (844x390)

- `m7a-board-1.jpg`: Sensei Profile, Edit Profile, Story archive, Captain's Journal (before / after).
- `m7a-board-2.jpg`: the Halloween event page: Story, Missions, Exchange, Daily Gifts (before / after).
- `m7a-board-3.jpg`: new states, after only: Edit Showcase, Pin trophies, the Profile Preview, the Operations tab (the
  M0 shot list opened the Story tab for "operations": the tab's id is `stages`, fixed in this list).
- `m7a-board-4.jpg`, `m7a-board-5.jpg`: the review round 1 fixes at the sizes the review found them (before = the
  reviewed build, after = now; the visit shots are new).

## What changed

- **Captain's Journal.** The lessons are kit rows on one white panel (their icon, the title or ???, the unlock rule
  while locked, NEW as the ink chip, a red dot for a reward); the list shows whole rows only. The open lesson is a
  kit panel with a bleed ink head ("LESSON 1 · title"), Hikari's face beside her words, the reward, and the actions on
  the panel's foot: Claim is the one yellow, Show me and Hikari explains are secondaries. Tutorial is clear glass in
  the top bar.
- **Story archive.** A kit list screen: Hikari's stand, then one panel with the chapter rail (one row of kit options,
  each chapter's emblem and number; two rows of five on a phone held upright, never a sideways strip), the chapter's
  head (kicker, name, read count, Tutorial) and the episode cards as kit tiles (NEW as the ink chip, first-read gems
  with the colour gem).
- **Event page.** One ink header band over the event painting (kicker, name, the countdown chip, the dates), then the
  kit's folder tabs on the content panel (ids and test ids unchanged; short words on a narrow screen). Episodes,
  operations, offers and the Daily Gifts day cards are kit tiles; missions are kit rows whose ink Claim carries the
  reward (one control a row), Claim all is the page's one yellow; offers buy through the kit's ink cost button.
- **Sensei Profile.** The ink top bar, her nameplate on the kit's night plate with a 44 px swap, square-cut showcase
  cards with ink rarity tags, flat medal cells and plaques (the pin is ink, not pink), ink chips. Edit profile is the
  cyan-edged bar button; the one yellow lives in the sheet it opens (Save).
- **The profile's sheets.** Edit Profile, Edit Showcase and the pin picker are the kit side sheet (`src/ui/sheet.js`)
  worn on paper: Edit Profile with the E3 section rail (`sideRail`) over the sheet's full height, the selection is the
  sakura bar and check (never a ring), the sort and pin tabs are kit options. The Preview is a full-screen layer.

## Gate numbers (844x390, M0's "before" → now)

| Shot | text | taps under 44 | yellow | stray pink | painted over | rounded | sideways |
|---|---|---|---|---|---|---|---|
| profile | 12 → 12 | 4 → 0 (27.75 → 44.5 px) | 1 → 0 | 2 → 0 | 0 | 15 → 0 | no |
| profile-edit | 12 → 12 | 9 → 0 | 3 → 1 | 2 → 0 | 18 → 0 | 46 → 0 | no |
| story | 10.56 → 12 | 4 → 0 | 0 | 2 → 0 | 0 | 12 → 0 | yes → no |
| journal | 9.6 → 12 | 6 → 0 | 6 → 1 | 5 → 0 | 0 | 21 → 0 | no |
| event-story | 12 | 6 → 0 | 0 | 0 | 0 | 4 → 0 | no |
| event-missions | 12 | 9 → 0 | 2 → 1 | 0 | 0 | 1 → 0 | no |
| event-exchange | 12 | 12 → 0 | 0 | 2 → 0 | 0 | 15 → 0 | no |
| event-gifts | 12 | 24 → 0 | 0 | 0 | 0 | 10 → 0 | no |

Numbers with the top bar: 3-6 on every shot (the profile Preview 10), the repeated rows and tiles budgeted per row.
1280x720: text 13 everywhere. 390x844: no sideways scroll (the event tabs and the Story rail scrolled before).
`node e2e/menus.mjs --milestone m7a` (with the side-cut check): 16 shots × 3 sizes, 0 failing (the new shots:
profile-showcase, profile-pins, profile-preview, profile-visit, profile-visit-more, story-mixed, journal-entry).
At 667x375, 915x412 and 1024x768 (read by eye): one probe note left, Edit Showcase at 667x375, whose student picker
scrolls under the slots: the row cut by the scroller's edge reads as 41 px taps.

## Review round 1 fixes (`m7a-board-4.jpg`, `m7a-board-5.jpg`)

1. Daily Gifts at 1024x768 and 1280x720: the 64 px tiles and the wider day card are one rule again (the later
   unconditional rule had reset the card to 124 px): both tiles and their counts sit inside the card.
2. Edit Showcase and Pin trophies at 390x844: under 560 px wide the ghost action (Auto-fill / Use my best medals) takes
   its own row above Cancel and Save, Save says just "Save", the bar notes go.
3. Captain's Journal at 667x375: a title clamps to two lines (a locked one to one), the list column widens on a small
   landscape phone, the rows keep their fixed height (the list still shows whole rows only). The lesson number is back
   ("01" before the icon).
4. The selected Story chapter's emblem takes the on-ink colours (white lines, cyan tick) on its ink fill.
5. Save after a touch drag in Edit Showcase: the cause was Chromium's tap-after-fling suppression, not the press scale.
   A quick drag that lifts while still moving leaves a fling; the next tap only stops the fling and sends no click.
   The slot drag now owns its touchmoves (preventDefault while dragging), so no fling is left. The reviewer's CDP
   probe: before 0/3 Save taps closed the sheet after a fast drag (3/3 after a slow drag that stops before lifting);
   after 9/9. The kit's press scale is back on the M7a buttons (the "no press scale" note is withdrawn).
7. Event header at 390x844: under 560 px wide the lanterns (and the host) go, so nothing paints over the kicker.
8. The visitor's profile: a visit's top bar is the bar's glass buttons (Message, Invite to co-op with the cyan edge,
   the friend control; their glyphs alone on a phone held upright, the title the player's name alone), More is the
   kit's bar icon (46 px), and the More sheet is the kit's bottom sheet (480 px wide). New shots: `profile-visit` and
   `profile-visit-more` (the local test server's friend, `e2e/uiSeed.mjs` seedOnlineInvite).
9. The event host is back: her bust in a square window at the header band's right end, framed on her face.
10. Gift reward tiles are display only (aria-hidden, out of the tab order; the day card's label names the rewards);
    a claimed mission shows what it paid next to "Claimed".
11. `story-ch2` is now `story-mixed`: the first chapter with open and locked episodes, its first episode marked read
    for the shot, so read, NEW and locked cards are all captured. The archive's head button says "Replay tutorial".
    A plaque keeps a stage number whole ("Stage" / "4-3", never "Stage 4-" / "3").
12. 667x375: Edit Showcase keeps one row of eight slots, the Profile showcase one row of eight cards (the four-column
    rules apply to a narrow and tall screen only).

## Notes for the kit

- New here, candidates for the kit: the day card (a single-cut white tile with one ring), the side sheet on paper.
- A drag on a touch screen should preventDefault its touchmoves (or the next tap can be eaten by Chromium's
  tap-after-fling suppression): worth a line in the kit's notes for anything draggable.

## For the owner

- Daily Gifts: a day card is now a calendar entry, its reward tiles show what the day brings (the card's label names
  them) rather than each opening the item sheet. It is M7a's own day card, not a copy of M5's login calendar
  (`.cm-calendar` / `.ma-cal-day` in hubs.css), which M5 is restyling right now: when M5 lands, the two can share one
  look (a follow-up, your call).
- Event missions: the reward rides on the ink Claim button (one control a row), so a mission's reward can no longer be
  tapped for its item info; a claimed row still shows what it paid.
- The visitor's More sheet holds the player card's own buttons (Invite to clan, Block, Report): their look comes with
  the player card's restyle (the online screens, M8), only the sheet around them is M7a's.
- Edit profile is no longer yellow on the profile: the sheet's Save is.
- The showcase still uses today's cards: the girl tiles come with M3.

## Round 2 prep (Oct 30): the merged head (main `60ce9cad`, v0.1.61)

**M7a is live.** Tryout Day merged this branch at `b60f2196` (M7a with the round-1 fixes) into v0.1.59 on Oct 28.
So the round-2 review looks at what players have; this branch's game files are main's.

**What main changed in M7a's files after round 1** (worth the reviewer's look):
- `profile/parts.js`: an LR girl's showcase card wears the banners' Nightglass frame (`.pf-slot.is-lr`, `lrFrame()`
  and the LR sticker). New shot: `profile-lr` (Tenka after her Limit Break).
- `story/archive.js`: a locked episode that waits for a girl the player owns says so in its toast ("Needs Ruri, Iroha,
  Ena or Fuu. Recruit one of them to unlock this episode.").
- `journal.css`: the lesson toast's place on the home (display polish). `story.css`: the scene player only.

**Round-1 findings on the merged head** (shots from `node e2e/menus.mjs --milestone m7a`, at the review's sizes):

| # | Finding | On the merged head |
|---|---|---|
| 1 | Daily Gifts at 1024x768 and 1280x720 | both tiles and their counts sit inside every day card |
| 2 | Edit Showcase and Pin trophies footers at 390x844 | the ghost action has its own row; Cancel and "Save" below it |
| 3 | Journal rows at 667x375 | titles clamp to two lines with their numbers (01-04); whole rows only |
| 4 | the selected Story chapter's emblem | white lines on the ink fill |
| 5 | Save after a touch drag in Edit Showcase | the slot drag cancels its touchmoves (`showcaseEditor.js`); `e2e/profile.mjs` at 844x390 (touch): drag, then Save writes the order |
| 6 | Daily Gifts vs M5's calendar (a note) | in "For the owner" above |
| 7 | the event header at 390x844 | no lanterns or host under 560 px wide; the kicker reads clean |
| 8 | the visitor's profile | glass bar buttons (Invite to co-op with the cyan edge), More as the bar icon, the kit's bottom sheet |
| 9 | the event host | her bust in a square window at the header band's right end |
| 10 | gift tiles; claimed missions | gift tiles are display only (`displayOnly()` in `event.js`); a claimed row says "Claimed" and what it paid |
| 11 | read, NEW and locked cards; Replay tutorial; plaques | `story-mixed` shows all three; "Replay tutorial"; plaques read "Stage" / "4-3" |
| 12 | one row of eight at 667x375 | Edit Showcase and the Profile showcase each keep one row of eight |

At 667x375 the Edit Showcase picker's row cut by its scroller still reads as 41 px taps (the probe note above).

**The new shot fails the gate at all three sizes** (`profile-lr`, for the reviewer to rule on):
- the LR sticker is rounded (`span.lr-badge`, 5 px; lr.css), sits inside the card's ink tag, and its "LR" is 12.48 px
  where the gate wants 13 px (1280x720, 390x844);
- the Nightglass crest is cut by the card's chamfered clip (the kit girl tile moves its crest inside the top edge);
- an earned frame shows as a chip in Freeplay Records (`button.pf-chip-frame`, opens Edit Profile): a 21 px tap at
  1280x720. No shot had an earned frame before (it comes with a ★5 SSR).

**e2e changes (test only):** `e2e/profile.mjs` counted 59 stages, stale since the Gate Arc's Acts (the game has 89);
it reads `STAGE_COUNT` now, and its screenshots wait up to 90 s. `e2e/shots/m7-records.mjs` gains `profile-lr`.

**For the owner (Oct 30, "Profile sensei page should match menus"):** the showcase still uses its own cards, while
M3's kit girl tiles have been live in Students, Formation and Tryout since v0.1.59 (see "the girl tiles come with
M3" above). The plan's target for the Profile is "showcase as girl tiles" (UI_V2_MENUS.md section 3): moving the
showcase onto `girlTile()` would also give an LR girl the kit tile's Nightglass edge and crest.
