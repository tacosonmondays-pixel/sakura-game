# Sensei Profile: Design A, the player experience (Oct 15, 2026)

**Owner's request (Oct 15):** "In your profile, it'll be your username, bio, maybe you can set favorite units, and then it can be like Genshin or Honkai where you can display your top 8 units… if you press and hold it'll bring up their info so you can see others builds. Whoever you set as your favorite girl, she'll be on the left side as her portrait. What else? Profile picture and a banner? Ribbon and medal showcase!"

This design gives him all of it on one screen, `#/profile`:
- the favorite girl's full stand on the left;
- banner, picture and frame, name, level, title, clan and bio at the top;
- an 8-girl showcase you can add to, remove from and reorder;
- press and hold a showcase girl to see her **build**: level and cap, awakening and UR, Potential, the 3 gear pieces with stats, gear totals, battle stats and outfit;
- a **Medals & Ribbons** showcase: automatic totals plus 4 pinned trophies;
- Freeplay records with titles and frames;
- a few safe stats.

The same screen opens for other players from chat, clan, co-op and friends, with Message, Co-op, Add friend and Cheer in the top bar.

**Mock-up** (static HTML using the game's real `base.css` and `ur.css`, real fonts and real portrait art):
- File: `docs/specs/profile/mock/profile.html`
- States: `?state=own | build | visit | vbuild | edit | editp`
- Screenshots: `docs/specs/profile/mock/shots/` (sizes `1280x720` and `844x390`):

| File | What it shows |
|---|---|
| `*-own.png` | My profile |
| `*-own-scrolled.png` | My profile, scrolled down (phone) |
| `*-build.png` | The hold-for-build sheet on my profile |
| `*-visit.png` / `*-visit-scrolled.png` | Someone else's profile |
| `*-vbuild.png` | Their girl's build, with "Your Luna" for comparison |
| `*-edit.png` | The Edit Showcase sheet |
| `*-editp.png` | The Edit Profile sheet, Bio tab |

To regenerate: `node shoot.mjs [states…]` in the mock folder.
Reference shots of the real train-a build, used to match the look, are in `docs/specs/profile/ref/`.

---

## 1. Where it opens

| From | What happens |
|---|---|
| **Lobby top-left level badge.** It reads "Sensei" today and opens Achievements (`lobby.js:328`). | It shows **your online name** and opens `#/profile`. Achievements moves to an "All achievements →" link in the profile's Medals & Ribbons panel, and stays in the Missions hub. |
| Player card (social: chat, clan roster, friends list, co-op room) | A new **View profile** button at the top of the card. Tapping the card's avatar does the same. The card stays as the quick modal. |
| Co-op room, the ally's chip | View profile. **Holding the ally's girl chips opens the ally's build.** This fixes today's bug, where holding shows your own copy of the girl or "Recruit". |
| Messages thread header | View profile. |
| Route | `#/profile` (mine) and `#/profile/<userId>` (someone else's). Back returns to wherever it was opened from. |

## 2. Layout

The layout is the same at both sizes, and the second size only compacts it. The Blue Archive look is kept throughout: white translucent panels, blue→white headers with a yellow underline, slanted pills, and italic navy Nunito headings. The numbers below were measured in the mock.

```
┌─ top bar ── ‹ Sensei Profile ─────────────────────────────── [Preview] [Edit profile] ┐
│ BANNER (full width, under the translucent top bar, fades into sky)          [✎Banner] │
│ ┌─────────────┐   ┌──────────────────────────────────────────────────────────────────┐ │
│ │  FAVORITE   │   │(AVATAR+FRAME) Mika [Lv.47]   ✦Ashwing Slayer  [SKR] Sakura Club │ │
│ │  GIRL       │   │  Eclipse frame “Luna main! Chasing every ribbon…”  │ 4 stat tiles │ │
│ │  full stand │   └──────────────────────────────────────────────────────────────────┘ │
│ │  (cut art)  │   ┌ Showcase 8/8 ─────────────────────── ⊙ Tap to swap · hold for build ┐
│ │             │   │ [Luna][Hikari][Kaede][Chika][Nami][Sango][Miko][Raika]            │ │
│ │ ♥Favorite   │   └──────────────────────────────────────────────────────────────────┘ │
│ │ UR Luna     │   ┌ Medals & Ribbons ───────────── [Pin] ┐ ┌ Freeplay Records ──────┐ │
│ │ Lv60 ★★★★★ P4│  │ medals 4×   │ ribbons 5×             │ │ Blossom  5-4   Wave 212│ │
│ └─────────────┘   │ [pin][pin][pin][pin]                 │ │ … titles · frame chips │ │
└───────────────────┴──────────────────────────────────────┴─┴────────────────────────┘─┘
```

| Region | PC 1280×720 | Phone 844×390 |
|---|---|---|
| Top bar | 50 px (the game's standard) | 42 px |
| Favorite column | 372 px wide, full height. The stand is about 600 px tall and the plate is 347×91. | 236 px wide. The stand is about 300 px tall and the plate is 220×54. |
| Banner | 214 px tall at full width. About 92 px shows above the identity panel. | 150 px tall. About 56 px shows. |
| Identity panel | 882×147. The 104 px avatar rises 44 px into the banner. | 583×117. The avatar is 70 px. **The stat tiles move down** into a "Records" panel. |
| Showcase | 8 cards in **one row**, 99×124 px each (4:5) | 8 in one row, 66×82 px each (stars hidden; name at 0.62 rem) |
| Bottom row | Medals & Ribbons (517 px) next to Freeplay (the rest) | Stacked, scrolling |
| Fits without scrolling | Everything (the main column scrolls 2 px) | The banner, identity, bio and the full showcase. Trophies, Freeplay and Records are one scroll down. |

- **Only the right column scrolls.** The favorite girl stays put, like Genshin's character pane.
- On the phone, nothing needed for the owner's ask sits below the fold except the trophy shelf.

## 3. The favorite girl (left)

- **One girl**, chosen from girls you own. A new profile starts with the **lobby secretary**, so it never opens empty.
- **Art:**
  - The girl is drawn with her transparent `cut` stand, in front of a soft white-violet halo and ring, with a few sakura petals.
  - All 19 girls have a cut stand. A future girl without one falls back to `full` with the existing `pt-edge` fade.
  - Her **nameplate** is a slanted white plate with a pink "♥ Favorite" ribbon, plus her UR badge or rarity, name, title, level, stars and Potential pill.
- **Own profile:**
  - The round pink ⟳ button on her plate opens the girl picker.
  - Tapping her opens her student page; holding her opens her build.
- **Someone else's profile:** tapping or holding her opens her build, the same sheet as the showcase.
- **"Favorite units":**
  - The unused `units[id].favorite` flag becomes a ♥ toggle on the student page.
  - Hearted girls sort first in Students and in the Showcase picker.
  - The heart is only a sorting aid; the profile shows the showcase and the favorite girl.

## 4. Showcase: your top 8

- **Up to 8 girls you own, in your order.** The order matters (it is "your top 8") and all cards are the same size.
- **Each card shows:**
  - the `card` art, cropped to the face;
  - the rarity, or a rainbow UR badge with the UR ring and sweep;
  - the Potential pill from P2 up (P6 in the sakura style, per POTENTIAL.md §7);
  - name, level and stars;
  - a small ♥ before the favorite girl's name.
- **Never empty:**
  - A new profile auto-fills with the 8 highest-Power girls.
  - Players with fewer than 8 girls see dashed "+" slots on their own profile. Visitors see only the filled cards.
- **On your own profile:**
  - **Tap** a card opens **Edit Showcase** with that slot selected.
  - **Hold** a card opens the **build sheet**, live from your save.
  - The hint reads "Tap to swap · hold for build".
- **On someone else's profile:**
  - **Hold or tap** opens the build sheet. The hint reads "Hold a girl to see her build".
  - Tap is allowed too because it has no other meaning here, and younger players may never discover the hold.
  - The cards carry `data-hold-info="off"` and use their own handlers (see the research, §2.1), so the global hold never opens *your* copy of the girl.
- **Edit Showcase sheet** (`*-edit.png`):
  - Top: the 8 numbered slots, each with a × to remove it and a drag grip.
  - Below: "Your students", sorted by Power, Rarity or Level. Girls already placed are dimmed and show their slot number.
  - **Adding:** tap a girl to put her in the first empty slot (or the selected one).
  - **Reordering**, two ways: **drag**, or the kid-friendly way of **tapping one slot, then another, to swap them**.
  - Footer: **Auto-fill by power**, Cancel, **Save showcase**.
  - Holding a girl in the picker opens her build, so you can check before you choose.
- **When builds are captured:**
  - Your own view always reads your save live.
  - Other players see the **snapshot taken when you save your showcase, and re-taken on every online sync** (`ensureOnline`). So they see your current gear soon after you change it.
  - A visitor's view shows "Updated 2 days ago" when the snapshot is more than a day old.

## 5. The build sheet (press and hold)

The frame is the same as the train-a Unit Sheet: a 1000×650 modal on PC (828×374 on the phone), a gradient header, a left art column and tabs on the right. Screenshots: `*-build.png` and `*-vbuild.png`.

**Header:** UR badge, name and title, then an **owner chip** ("Hoshino's build", with their avatar), then level / cap, stars, Potential pill, Power and ✕.

**Left column:**
- The card art in her rarity or UR frame.
- An **Outfit** chip.
- The **P6 signature box** (e.g. "✦ Silver Thread: +5% damage to elites · unlocks at P6"), on PC only.
- One button. On your own profile it is "Open her page". On someone else's profile it is **"Compare with mine"**: your own values appear in small type under each stat. If you don't own her, it reads "Not in your roster yet", **with no Recruit button**. That keeps gacha pressure out of social comparison.

**Tabs:** **Build** (default) | Info | Upgrades.
- **Info** is the student page's info tab without the "yours" column, or with "theirs" when it is fed the snapshot.
- **Upgrades** is the static 3×5 tree, the same as on the Unit Sheet.

**The Build tab:**
1. **Growth.** Four tiles:
   - Breakthrough · Level: "60 / 60" with 5 breakthrough pips.
   - Awakening: ★★★★★, plus the UR badge and "Fully awakened".
   - Potential: P4 / 6 on a six-node track, with the signature node hatched.
   - Power: 1,312. On someone else's profile it adds "Your Luna: Lv.40 · 940".
2. **Equipment.** Three gear cards (charm, ribbon, shoes). Each shows a gear icon in its rarity colour, slot, rarity pill and +level, the main stat in a band, and up to 4 substats with ▲ upgrade marks.
   - **No gear names.** They are stored free-text strings, and showing them would be a text-injection path.
   - An empty slot shows "No charm equipped".
3. **Gear totals.** Chips such as ATK +35.9%, Crit Rate +21.8%, and so on (`gearStatTotals`).
4. **Battle stats.** Damage, Attack speed, Range, Crit and Cost, before in-battle upgrades, each with its % over base. They are computed **by the viewer's client** from the snapshot (`unitBattleStats`).
5. A footnote: "Shared from Hoshino's save on Oct 15 · numbers are what her game reported." This is honest about trust: the server only checks shape and ranges.

**Phone:**
- The art column is 142 px. The four growth tiles and the three gear cards each fit in one row.
- Totals and stats are one scroll down.
- The signature box moves to the Info tab.

## 6. Picture, frame and banner

**Picture:**
- Any girl you own, using her **drawn thumbnail** in place of today's procedural doll.
- It is separate from the lobby secretary. When the profile first ships, it defaults to the secretary, so nothing jumps.
- It shows in the profile, player card, chat, clan roster and co-op room.

**Frame:**
- A ring drawn around the picture, shown wherever the picture is 40 px or larger. In chat it is a 2 px coloured rim.
- The first set:

| Frame | How you earn it | Notes |
|---|---|---|
| Default | Everyone | Plain white ring |
| Eclipse | The freeplay Eclipse Wyrm (already earned and stored) | Drawn as a placeholder SVG in the mock; needs final art |
| Sakura | 10 Sakura medals | Needs art |
| Laurel | Gold on all 40 campaign stages | Needs art |
| Rosette | All 20 ribbons on any stage | Needs art |
| UR Rainbow | Own a UR girl | Reuses `ur-ring` |

- The name of the equipped frame shows under the avatar ("Eclipse frame") so people know it can be earned.

**Banner:**
- 2.75:1 art behind the top of the screen, with a fixed crop (centre, 58% down) and a fade into the sky.
- The first set:
  - the academy painting in its 3 tints;
  - the 3 scene paintings (Hikari, Aoi, Sango);
  - the 11 theme scenes from `themeBackdropSVG`.
- Proposed unlocks:
  - Theme scenes unlock when you clear a chapter with that theme.
  - Scene paintings unlock when you own that girl.
  - The academy is free.
  - Unlocked lobby backgrounds count too.
- Edit with the "✎ Banner" pill on the banner, or in Edit Profile → Banner.

## 7. Name, level, title, clan, "Sensei since"

- **Name:** the existing online name, 2–16 characters, using the same rules and the same prompt as today, limited to 3 changes a day. "Change name" lives in Edit Profile.
- **Level:** the account level on the navy slanted badge, the same style as the lobby `lvl-badge`.
- **Title:**
  - One earned title on a violet→pink slanted ribbon under the name, or "None".
  - Sources: freeplay titles (Ashwing Slayer, Crimson Slayer) and **achievement names as titles** (Valedictorian, Sakura Sentinel, Monster Scholar… from the 30 achievements).
  - Stored as **ids**, never strings. A title the player hasn't earned can't be picked.
- **Clan chip:** "[SKR] Sakura Club". Tap it to see the clan. It is hidden for the dev clan unless the viewer is in it, as `player_card` does today.
- **"Sensei since Oct 2026":** the month from `profiles.created_at`. Never the exact date. Hidden on the phone.

## 8. Bio (kid-safe)

- **0–80 characters**, one line of plain text. It is rendered as text only (`h()`), never as HTML.
- **Rules** (both client and SQL; Design B owns the exact patterns): everything in the message-body rules, **plus**:
  - no links or domain-like text (`www`, `http`, `.com`/`.net`/… after a word);
  - no emails or `@handles`;
  - no runs of 5 or more digits (phone numbers);
  - no "discord", "insta", "snap" or similar contact hints;
  - the reserved names.
  - A word filter is an open question: none exists today.
- **When a rule blocks the text**, the inline message says what is wrong in kid language: "Bios can't have links or contact info."
- **Quick lines.** One tap fills a preset: "Looking for co-op buddies!", "Collecting every ribbon ✦", "Say hi in clan chat!", "Nightmare grinder", "New Sensei, be nice ♥", "Freeplay forever". A settings option, **Quick lines only**, could make these the only choice for younger players (open question).
- **Muted players** can't edit their bio. The editor says when they can.
- A **reported** bio goes into the report evidence: the bio text is copied, because it can be edited after the report.
- A bio **hidden by moderation** shows "Bio hidden" to everyone.

## 9. Medals & Ribbons showcase

**1. Tally (automatic, always shown):**
- **Medals:** the four medal icons (bronze, silver, gold, sakura), each with its count out of 59. 59 is all stages: 40 campaign, 15 resource, 3 boss and 1 challenge. Total out of 236.
- **Ribbons:** the five mode badges (Reverse, Rush, Ironclad, Half Income, Last Petal), each with its count out of 160 (40 stages × 4 difficulties). Total out of 800.
  - Until codex-modes merges, the Ribbons half is hidden and Medals takes the full width.

**2. Pinned shelf: 4 plaques you choose.** On PC they sit in one row of 118×77 px plaques; on the phone they form a 2×2 grid. Each plaque has a pin, an icon, a title and one small line. The kinds:

| Kind | Icon | Example |
|---|---|---|
| **Stage medal** (best medal on one stage) | The medal | "Sakura Medal · Stage 8-5" |
| **Perfect stage** (all 20 ribbons on one stage) | A new **rosette**: the five mode colours around a gold star (drawn in the mock) | "All 20 Ribbons · Stage 3-2" |
| **Mode ribbon** (one difficulty × mode) | The mode badge | "Last Petal · Nightmare 7-3" |
| **Achievement** | Achievement badge (today one generic trophy; badges per achievement are on the art list) | "Valedictorian" |

- **Choosing pins:** the **Pin** button opens a picker with Medals | Ribbons | Achievements tabs. It lists only what you have earned, best first: Sakura → Gold → … and Last Petal → … .
- **New profiles get 4 automatic pins** (best medals first), so the shelf is never bare.
- **Tapping a stage plaque** opens a small popover with:
  - the stage thumbnail and name;
  - its 4 medals;
  - a 5×4 ribbon grid (modes × difficulties).
- "All achievements →" (own profile) opens the Achievements screen.

## 10. Freeplay records

- **Three rows, one per tier** (Blossom, Tempest, Crimson Moon). Each row shows the tier pill, the **stage with the best wave**, and "Wave N".
  - The value is the maximum of `freeplayBest` and `coopBestWave` over all stages; a small "co-op" tag marks one set in co-op.
  - A tier you've never played shows "—".
- **Earned chips:** titles (violet chips) and frames (dark chip with the frame's mini icon).
  - Titles and frames are **derived from the `fpm:` milestone keys**, so an older tab can't wipe them (see the research §0.7). They are shown by id, mapped to display names.

## 11. Stats

**Shown** (PC: four tiles in the identity panel; phone: the "Records" panel):
- Students owned X / 19
- Stages cleared X / 59
- Bestiary %
- Enemies defeated (`stats.kills`, shown as e.g. 25.3k)

**Optional later:** Battles won (`stats.wins`) and co-op wins (needs a new counter).

**Never shown:**
- gems, gems earned, pulls, spending;
- mail, friend code, transfer codes;
- login streak;
- last active (except to friends and clanmates, as `player_card` does today);
- anything from settings.

## 12. Someone else's profile

The same screen, title "Hoshino's Profile". Screenshots: `*-visit.png` and `*-vbuild.png`.

- **Top-bar actions** keep the identity panel the same height, so the showcase stays above the fold on a phone:

| Button | PC | Phone |
|---|---|---|
| Message | Message (primary) | Message |
| Invite to co-op | Invite to co-op (yellow) | Co-op |
| Add friend | Add friend (ghost) | Icon only |
| Cheer | Cheer (pink) | Icon only |
| More | ⋯ (Block, Report) | ⋯ |

- These buttons follow the social branch's rules and disabled states (`whyText`): DMs closed, already friends, and so on.
- **Cheer** opens 6 preset stamps: "Nice build!", "Wow, UR!", "Let's co-op!", "Cute team!", "GG!", "Teach me!".
  - They are delivered as a stamp in Messages.
  - Limit: 1 per profile per day.
  - **There is no public counter**, to avoid popularity pressure.
- **Report** gets the context `'profile'` with reasons including "Bio" and "Picture/name". The evidence copies the bio, name and title.
- **Blocked** (either direction): the profile route returns "This Sensei isn't available", and the entry points hide View profile.
- **Private**:
  - Edit Profile → Privacy offers "Who can see my profile: **Everyone** / **Friends & clan** / **Only me**".
  - Outside that circle, visitors see only the basic player card (name, level, picture), which is already public, with the line "This Sensei keeps their profile private."
  - The default is an owner decision; I suggest Everyone, since all content is game data plus a filtered bio.
- **Their server row is older than this feature**, or they never published: the basic card plus "Hoshino hasn't set up a profile yet."

## 13. Edit Profile sheet

Opened from "Edit profile" in the top bar (`*-editp.png`). Sections in a left nav:
- **Bio:** text field with an 80-character counter, rules note, Quick lines, and Name with "Change name".
- **Picture:** grid of girls you own, plus the frame row (locked frames show how to earn them).
- **Banner:** grid with lock reasons.
- **Title:** earned titles, plus "None".
- **Favorite:** the girl picker.
- **Privacy:** who can see the profile; Cheer stamps on/off.

**PC** adds a live **Preview** card on the right, with the line "Your gems, pulls, mail, friend code and saves are never shown."

**Save** writes to the save first. The server copy is published when online, and the footer says so. **Preview** in the top bar shows your own profile exactly as a visitor sees it, using the published snapshot.

## 14. States and edge cases

| Situation | What the player sees |
|---|---|
| No online name yet | The profile works locally. A strip at the top reads "Pick an online name to share your profile" and opens the existing name prompt. |
| Server lacks the profile migration (`profile_version()` missing) | Your own profile works. A note says "Other Senseis will see your profile after the next server update." Visitors get the basic card. |
| Offline or local mode | Your own profile from the save; visiting is unavailable, with the game's usual offline pill. |
| Fewer than 8 girls | Dashed "+" slots (own); hidden (visitor). |
| Ribbons not merged yet | The Ribbons tally is hidden, and the ribbon pin kinds are unavailable. |
| Reset, Import or transfer replaces the save | Showcase, pins, title, frame and banner are re-checked against the new save. Anything no longer owned or earned is dropped (auto-fill refills), and the profile republishes on the next sync. |
| Snapshot fails the viewer's checks (unknown girl, out-of-range level, awaken, P, gear or stats) | That card shows without numbers ("Build unavailable"). The rest of the profile still renders. No accusation is shown. |
| Stale snapshot | "Updated N days ago" under the showcase title (visitor). |
| Reduced motion | The UR ring, sweep and glints stand still. Nothing else animates. |

## 15. "What else?": the ranked answer for the owner

1. **Title picker.** Your earned title under your name: freeplay titles plus achievement names. The data exists.
2. **Profile frame.** A ring around your picture (Eclipse now; Sakura, Laurel, Rosette and UR to earn). It shows in chat too.
3. **Pinned trophies.** 4 medals, ribbons or achievements on a shelf. This is the "ribbon and medal showcase" with a personal touch, and it covers "favorite stage".
4. **Freeplay records.** Best wave per tier, plus earned titles and frames.
5. **Social buttons on the profile.** Message, Invite to co-op, Add friend (built on the social branch).
6. **Clan tag chip.** Tap to see their clan.
7. **Collection stats.** Students owned, stages cleared, bestiary %, enemies defeated.
8. **"Sensei since".** Join month only.
9. **Cheer stamps.** Six preset reactions, no free text, no public like counter.
10. **"Compare with mine"** in the build sheet.

Later: favorite girl's voice line or theme, 3D chibi on the profile, event frames and banners, co-op stats (needs a new counter).

**Not recommended** for a game with kids: birthday or age, location, photo upload, links or socials, public like or follower counts, gems or pull counts.

## 16. What the UI needs from the server (handoff to Design B)

One published card per player, read through a SECURITY DEFINER view that respects blocks and privacy. **Ids and numbers only, apart from the bio.**

```
name, level            (from profiles, as today)
avatar: unitId         frame: frameId        banner: bannerId      title: titleId|null
bio: string 0–80       fav: unitId           privacy: 'all'|'circle'|'me'   cheers: bool
showcase: ≤8 × { id, lv, bt, aw, pot, skin, gear: ≤3 × { slot, rar, lv, main:[stat,val], subs: ≤4 × [stat,val,ups] } }
medals:  { easy, normal, hard, nightmare }              (counts)
ribbons: { reverse, rush, ironclad, frugal, laststand } (counts; empty until codex-modes)
pins: ≤4 × { kind:'medal'|'perfect'|'ribbon'|'ach', stage?, diff?, mode?, ach? }
freeplay: { blossom|tempest|crimson: { wave, stage, coop } }
stats: { units, stages, bestiaryPct, kills }
since: 'YYYY-MM' (server)    updatedAt (server)
```

- Size: about 4–5 KB (the research measured 4,173 bytes for 8 fully geared girls in compact form).
- **Never include:** gear uid, lock state or name; gems; pulls; mail; codes.

## 17. Art needed

| Item | Status |
|---|---|
| **Eclipse frame** | A placeholder SVG is in the mock |
| Sakura, Laurel and Rosette frames | Needed |
| **Perfect-stage rosette** | A placeholder SVG is in the mock |
| Badges for pinnable achievements | Needed. Today all 30 share one trophy; at least the medal and collection ones need their own. |
| Banner picker thumbnails | Needed (or render `themeBackdropSVG` small) |

Everything else in the mock is the game's own art or CSS: portraits (`card`, `cut`, `thumb`), the academy painting, `medalIcon`, `modeIcon` and `gearIcon` (codex-modes branch), the UI glyphs, the UR ring and badge, and the Potential pill.

## 18. Questions for the owner

1. **Who sees profiles by default:** Everyone, or Friends & clan?
2. **Bio:** free text with filters plus Quick lines (my pick), or Quick lines only for everyone?
3. **Cheer stamps:** yes or no? (No public counts either way.)
4. Should the **lobby badge open the Profile**, with Achievements reached from there and from the Missions hub?
5. Switch everyone's chat and clan avatar from the drawn doll to the **girl's portrait thumbnail**?
6. **Banners:** unlocked by chapter clears and owned girls (my pick), or all free?

## 19. Files

| File | What it is |
|---|---|
| `mock/profile.html` | The mock-up page |
| `mock/css/profile.css` | New styles. `base.css` and `ur.css` are copied unchanged from `src/ui/styles`. |
| `mock/css/fonts.css` + `mock/fonts/` | M PLUS Rounded 1c and Nunito, latin subset |
| `mock/js/glyphs.js` | The game's UI glyphs, plus 7 new ones: edit, hold, chat, friend, more, share, stamp |
| `mock/icons/*.svg` | Generated from the game's `icons.js` on the codex-modes branch (`gen-assets.mjs`) |
| `mock/art/` | Copies of the real portraits and the academy painting |
| `mock/shoot.mjs` | Playwright screenshots (`/opt/pw-browsers/chromium`) |
| `refshots.mjs`, `measure.mjs` | Reference shots of the train-a build and layout measurements |

All paths above are under `docs/specs/profile/`.
