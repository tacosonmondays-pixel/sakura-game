# UI v2 menus · M8 (online half): Co-op, Messages, Chat, Clan, the player card

Plan: `docs/specs/UI_V2_MENUS.md` section 5, M8 (the online half; Settings is lane A's). Shots: `e2e/shots/m8-online.mjs`
(`node e2e/menus.mjs --milestone m8 --screens <the ONLINE list>`). New rules: `src/ui/styles/v2-online.css` (all under the
menus' surface mode, loaded by `src/ui/online/common.js`); `online.css` and `social.css` are unchanged, so the co-op
battle HUD and the night home's chat drawer keep their looks.

## Boards (844x390)

- `m8-online-board-1.jpg`: Co-op, Messages (Chats), a conversation, Friends (before / after).
- `m8-online-board-2.jpg`: Clan find / create, Clan as a member, the player card, Clan Boss (before / after).

## What changed

- **Said once.** The top bar's status pill ("Online features offline", clear glass on the ink band) is the one place
  that says offline; the in-screen line under it says only what that means here ("Rooms only connect tabs of this
  browser."), quietly, without the yellow stripes. Chat's side card lost its second pill; the clan's chat tab shows
  the clan's line only. On an upright phone (no room for the pill) the line says the reason itself.
- **Co-op.** Kit panels; Host a room has the stage, freeplay as kit options on one row, and its foot: Change stage (a
  ghost) and the one yellow, Create room (Rejoin is the yellow when there is a last room). Join with a code is a kit
  field and a secondary Join; the invites are kit rows with a secondary Join (17 px tall before, 46 now). The room's
  lobby says each number once (the code on its plate, not also in the bar; the enemy HP and coins on its head, not
  also in the Battlefield panel); its tips are marked, not numbered.
- **Messages.** The lists sit on the kit's folder tabs (ink strip, the open tab a hole of the white panel, the message
  settings at the strip's end; Blocked opens as a fourth tab), rows are kit rows with the sakura bar on the open
  conversation and the kit's red count. The conversation is a kit panel: who, Invite to co-op (its one yellow), More;
  bubbles are single-cut cards (mine ink); the invite card's Join and Send are ink. Friends: the friend code on a
  single-cut card, Add the one yellow, Message a secondary.
- **Chat.** The channel as a folder tab on the chat's panel; the side: who you are and the links as kit rows.
- **Clan.** Find / create: kit rows for clans, the emblems as 46 px kit tiles, who-can-join as kit options, Create clan
  the one yellow. As a member: the head on one band (emblem, name, role, the daily post, the level bar, Leave), then
  the six tabs as folder tabs; members and applicants are kit rows with secondary Co-op / Accept; Clan Boss is an ink
  card (it was a white card with pale words) with Fight the one yellow; Requests' +1 is a secondary.
- **Dialogs and pop-ups.** The player card: the kit dialog with its 46 px close, one yellow (Invite to co-op), no
  pink ring. The report dialog: the reasons as kit options, a drawn 44 px Also-block box, the note beside it on a
  phone. The social pop-up hangs under the top bar (never over its buttons), white with one hairline, its Join ink.
  The needs-update card is a kit panel.

## Gate numbers (844x390, M0's "before" → now; every M8 online shot passes at 844x390, 1280x720 and 390x844)

| Shot | text px | taps under 44 | yellow | rounded | numbers |
|---|---|---|---|---|---|
| coop | 10.56 → 12 | 9 → 0 (Join 17 → 46 px) | 1 (the audit counted 4 yellow fills) | 11 → 0 | 7 → 5 |
| messages | 10.56 → 12 | 4 → 0 | 0 | 5 → 0 | 3 |
| messages-friends | 9.92 → 12 | 10 → 0 | 1 | 13 → 0 | 2 |
| chat | 10.56 → 12 | 8 → 0 | 1 → 0 | 7 → 0 | 3 → 2 |
| clan | 10.56 → 12 | 16 → 0 | 0 | 21 → 0 | 1 |
| player-card | 10.56 → 12 | 7 → 0 | 1 | 6 → 0 | 4 → 3 |

New shots (all pass): messages-thread, -requests, -blocked, report-dialog, coop-invites, coop-room, invite-toast (limit
12: the pop-up brings two numbers of its own), clan-members, -chat, -requests, -boss, -applicants, needs-update.

## For the owner to decide

- Tabs carry a red dot only, never a count (P7): Messages' tabs keep their count (as the kit's red number) because
  the online tests read it there. Say if the count should become a dot (the tests would change with it).
- The clan's Create panel still scrolls on a phone held sideways (the form is taller than the screen); Find stays on
  screen beside it.
