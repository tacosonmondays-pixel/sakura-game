# UI v2 menus · M7a: Profile, Story, Journal and the event page

Plan: `docs/specs/UI_V2_MENUS.md` section 5, M7a. Shots: `e2e/shots/m7-records.mjs` (`node e2e/menus.mjs --milestone m7a`).
New rules: `src/ui/styles/v2-records.css` (all under the menus' surface mode).

## Boards (844x390)

- `m7a-board-1.jpg`: Sensei Profile, Edit Profile, Story archive, Captain's Journal (before / after).
- `m7a-board-2.jpg`: the Halloween event page: Story, Missions, Exchange, Daily Gifts (before / after).
- `m7a-board-3.jpg`: new states, after only: Edit Showcase, Pin trophies, the Profile Preview, the Operations tab (the
  M0 shot list opened the Story tab for "operations": the tab's id is `stages`, fixed in this list).

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

## For the owner

- Daily Gifts: a day card is now a calendar entry, its reward tiles show what the day brings (the card's title names
  them) rather than each opening the item sheet.
- Edit profile is no longer yellow on the profile: the sheet's Save is.
- The showcase still uses today's cards: the girl tiles come with M3.
