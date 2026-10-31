# More Sensei Profile banners (built on `feature/profile-banners`)

The owner asked for "more banners", meaning the **profile banners**: the picture across the top of the Sensei Profile,
which other players see on your profile card. This branch adds **20 new banners**, for **34** in total. They are
cosmetic only, every one unlocks from things the player has already done, and they need **no SQL paste**. The change is
display and data only, and the **sim id is unchanged** (`36cba1c215b0`, `COOP_PROTOCOL` 14).

Board: `docs/specs/profile-banners/board.png`, every new banner drawn by the game's own `bannerArt()`. Rebuild it with
`node e2e/profile-banners-board.mjs`.

---

## 1. Profile cosmetics today (v0.1.66)

| Cosmetic | Where | How it is earned | On the card other players see |
|---|---|---|---|
| **Banner** | `src/data/profileArt.js` `BANNERS` | 14 banners: 3 academy courtyard tints (free); 8 chapter skies (`theme:<theme>`, clear that chapter's Act I); 3 girl scenes (`scene:hikari/aoi/sango`, recruit her) | `ban` |
| **Picture frame** | `FRAMES` | UR Rainbow (a UR SSR), Eclipse (the Eclipse Wyrm in Freeplay), Pumpkin (Halloween exchange). Sakura, Laurel and Rosette have no art yet (`ships: false`) | `frm` |
| **Title** | `TITLES` (`src/systems/profileHonors.js` `TITLE_TABLE`) | achievement titles, Freeplay titles (`fpm:` marks), tag titles (Developer, Alpha / Beta Tester; server tags), event titles (Halloween exchange) | `ttl` |
| Favorite girl (left stand) and Picture | owned girls | own her | `fav` (Picture goes with the online name) |
| Showcase (8 girls with builds), pins (4 medals, ribbons or achievements) | `profile.sensei` | — | `units`, `med.pins` |
| Honor Ribbons | Honor Ribbon Case (`src/data/honors.js`) | achievements | the plaques |
| Bio | server | one-tap Quick lines or free text (text rules) | separate, server-owned |

**How banners worked, and still work.** The pick is saved in `profile.sensei.banner`. `cleanSensei` keeps it only while
`bannerUnlocked()` says yes. It is shadowed in `missions.counters` as `pfs:banner` (a hash). `buildCard()` publishes it
as `ban`. The server checks only the shape of the id (`^[a-z]{1,12}:[a-z0-9_-]{1,24}$`, `valid_profile_card`).
`cleanViewedCard()` shows an id that the viewer's build doesn't know as the default banner. `bannerArt()` draws a
banner as a painted lobby picture with a tint, or as a chapter's SVG sky.

## 2. The 20 new banners

Each banner has the id `pb:<slug>`. The data is in `src/data/profileBanners.js` and the rules in
`src/systems/profileBanners.js`.

| Banner | Group | Art | Unlock |
|---|---|---|---|
| Blossom Court | School life | story place `blossom-court` | claim "Going for Gold" (first Gold medal) |
| Blossom Court at Dusk | School life | `blossom-court-sunset` | claim "Gold Star Student" (Gold on 20 stages) |
| Library Garden | School life | `library-garden` | claim "Story Time" (every scene of a chapter) |
| Common Room | School life | `common-room` | claim "Regular Attendance" (30 days) |
| Workshop Bench | School life | `workshop` | claim "Celestial Craftwork" (Legendary gear +10) |
| Sakura Sanctuary | Sakura | `sakura-sanctuary` | claim "Sakura Sentinel" (Sakura medals on 10 stages) |
| Petal Storm | Sakura | pattern (illustration slot) | claim "Petal Storm" (100,000 enemies) |
| Station Plaza | Chapters | `station-plaza` | claim "Chapter 1 · Act II Complete" |
| Gate After Dark | Chapters | `academy-gate-night` | claim "Chapter 2 · Act II Complete" |
| Moon Pier | Freeplay | `moon-pier` | claim "After-Hours Patrol" (wave 50) |
| Summit Nest | Freeplay | `summit-nest` | claim "Two Hundred Strong" (wave 200) |
| Beacon Gate | Freeplay | `beacon-gate` | claim "Starlight Vigil" (all four Freeplay bosses) |
| Nightglass Sky | LR | pattern (illustration slot) | Limit Break any LR girl (`lr:<unit>`) |
| Festival Street | Co-op | `festival-street` | claim "Team Spirit" (10 co-op wins) |
| Shrine Bell | Secret | `shrine-bell` | the secret achievement "By a Petal" (the picker shows "A secret achievement" and its hint) |
| Pumpkin Lantern Night | Event | the painted Halloween academy (`lobby/halloween.webp`) | clear any Pumpkin Lantern Night operation, on any difficulty |
| Spring Petals | Season | pattern (illustration slot) | visit the academy in March–May |
| Summer Fireworks | Season | pattern (illustration slot) | visit in June–August |
| Autumn Leaves | Season | pattern (illustration slot) | visit in September–November (everyone who plays now gets it) |
| First Snow | Season | pattern (illustration slot) | visit in December–February |

- **Art.** Fourteen banners use the game's own painted story places or the painted Halloween academy. These are places
  with no characters, already in `public/art/lobby/`, so there are no new image files. The other six are patterns drawn
  in code from a fixed seed (`src/ui/profile/pbArt.js`), so every viewer sees the same picture. On
  `feature/profile-banners-art` these six show new scenery illustrations instead, with the patterns kept as the fallback
  (§5). No third-party images were used.
- **Cosmetic only.** No banner has a price, a shop row or a recruit link. Recruiting achievements (`a_pulls_*`) are
  never used as unlocks (there's a test).
- **The picker** (Edit Profile → Banner) shows "n / 34 unlocked". A locked tile shows its lock chip ("Claim
  “Team Spirit”", "Visit in winter", "A secret achievement"). The chip is ellipsised inside the tile, and the full rule
  is in the tile's tooltip.

## 3. Unlocks: retroactive and idempotent

Every unlock is read from what the save already holds, and nothing is granted or stored:

| Rule | Read from | Retroactive |
|---|---|---|
| achievement | `missions.achievements[id] === true` (claimed, the rule achievement titles use) | yes: a veteran with the claim has the banner on first load |
| event | any of the event's stages cleared (`progress.stages`, kept by every build) | yes, also after the event has closed |
| LR | `lr:<unit>` counters (`isLR`) | yes |
| season | `pbs:<season>` = 1, set by `onAppStart` on **every** app start (idempotent) | from now on. Earlier seasons left no record, so nobody gets them backdated |

## 4. The card other players see, and older builds

- **Publishing:** `buildCard()` already publishes `ban`. A `pb:` id passes `validCard()` and the server's id pattern,
  so no SQL is needed.
- **Viewing:** `cleanViewedCard()` keeps a `pb:` id that this build knows. An unknown or malformed one (including a
  future banner shown to an older viewer) falls back to the default banner, so nothing blanks out.
- **A locked banner never reaches the card:** `cleanSensei` resets it to the default before `buildCard` runs.
- **Older-build round trip (the new shadow `pbn:`).** An older build doesn't know a `pb:` id. Its clean-up puts the
  default banner back and rewrites its own `pfs:` shadows. It keeps every counter, though, and never touches `pbn:`,
  which this build writes in `markSensei` as the hash of the equipped `pb:` banner. `restoreSensei` puts the banner
  back on when the save shows the default, the shadow names a `pb:` banner, and that banner is still unlocked. This is
  the same pattern as the `evt:` event-title shadow.
  - Picking any older banner clears `pbn:`, so the shadow never overrides a real choice.
  - If the whole block is dropped, the `pfs:banner` hash is enough, because this build's pool includes the `pb:` ids.
- **Sim and co-op:** none of these files are in the sim's import graph. `simId()` gives `36cba1c215b0` before and after
  the change.

## 5. Illustrations (the six slots)

**On `feature/profile-banners-art`** (on top of `feature/profile-banners`): the six slot banners now show new
illustrations, saved as `public/art/lobby/banners/<slug>.webp` (1280 × 876) with a 320 px thumb, about 1 MB in all.
Each row keeps its `svg` pattern as the fallback; dropping `file` and `thumb` from a row brings the pattern back.
The owner may replace any of them with their own pictures the same way.

- **Generator:** NovelAI (`nai-diffusion-4-5-full`), 1216 × 832, 23 steps, through the session's network secret. No
  Authorization header was written by us, and no key appears anywhere. The account endpoints (`api.novelai.net/user/*`)
  return 400 for every client, so I could not read the Anlas balance. The image endpoint answered normally.
- **Spend:** 7 images (one per banner, plus a second Summer Fireworks because the first had garbled pseudo-lettering
  on the stall awnings). At one Opus-free image size the cost is likely 0; the upper estimate is about 20 Anlas each,
  so **≤ ~140 Anlas**, inside the 300 budget. One more request was refused by the CDN before reaching NovelAI (403, no
  spend). The request log is `docs/specs/profile-banners/novelai-requests.jsonl` (time, model, size, steps, seed,
  status, prompt).
- **Rules followed:** prompts are written only from the game's own descriptions, with no other games', anime or artist
  names. They are scenery only, with a negative prompt against people, text and writing, and no reference images were
  sent. I checked each result by eye: no people, and no text after the Summer Fireworks retry.

The prompts used (Summer Fireworks: the second version, "plain striped festival awnings with no writing"; every prompt
also ended ", scenery, no humans"):

| Banner | Prompt |
|---|---|
| Petal Storm | wide panoramic background, a whirl of cherry blossom petals sweeping across a deep pink evening sky above a school academy rooftop, soft motion streaks, clean cel-shaded anime background art, bright and joyful, no people, no text |
| Nightglass Sky | wide panoramic background, a deep navy night sky over a quiet academy courtyard, countless white-gold stars, a faint arc of golden light across the sky, a glass observatory dome glowing softly, clean cel-shaded anime background art, calm and magical, no people, no text |
| Spring Petals | wide panoramic background, a school academy courtyard in spring, cherry tree branches in full bloom framing the top, petals drifting over a stone path and a fountain, pale blue sky, clean cel-shaded anime background art, no people, no text |
| Summer Fireworks | wide panoramic background, a summer festival evening at the academy, fireworks blooming over the school roof, a string of paper lanterns along a path with food stalls, purple and orange dusk sky, clean cel-shaded anime background art, no people, no text |
| Autumn Leaves | wide panoramic background, the academy grounds in autumn, red and orange maple trees, leaves falling over a covered walkway, warm golden late-afternoon light, clean cel-shaded anime background art, no people, no text |
| First Snow | wide panoramic background, first snow over the academy at dusk, snow on tiled rooftops and a lamp-lit gate, warm yellow windows, soft blue sky, clean cel-shaded anime background art, cosy and quiet, no people, no text |


## 6. Files

| File | Change |
|---|---|
| `src/data/profileBanners.js` (new) | the 20 rows, seasons |
| `src/systems/profileBanners.js` (new) | `pbUnlocked`, `notePbSeason`, `seasonAt`, lock and how text, the `pbn:` shadow |
| `src/ui/profile/pbArt.js` (new) | six seeded SVG patterns, cached (the fallback art) |
| `public/art/lobby/banners/` (new, art branch) | the six illustrations and their thumbs |
| `src/data/profileArt.js` | appends `PB_BANNERS` to `BANNERS`; `bannerLockText` for `pb` |
| `src/systems/profileTrophies.js` | `bannerUnlocked` for `pb` |
| `src/systems/senseiSave.js` | writes `pbn:` in `markSensei`; restores it in `restoreSensei` |
| `src/systems/missions.js` | `onAppStart` notes the season (one line) |
| `src/ui/profile/parts.js` | `bannerArt` draws a `pb:` pattern, or a painted file with `pos` |
| `src/ui/profile/editProfile.js` | the count line and the tooltip |
| `src/ui/styles/profile.css` | the lock chip ellipsises inside its tile |
| `tests/systems/profileBanners.test.js` (new) | the table, art files, unlocks (retroactive, no writes), seasons, the card, the round trip, the patterns |
| `e2e/profile-banners.mjs` (new) | picker, pick + Save, card, Preview, painted banner at 390 × 844, 844 × 390, 1280 × 720 |
| `e2e/profile-banners-board.mjs` (new) | the board image |

The cosmetics session (`feature/cosmetics-2`; not on origin when this was written) works on frames, ribbons and
titles. This branch keeps its data in its own new files. In shared files it adds only an import and one line per
function, so a merge has no real conflicts.

**Draft patch note** (for whichever release takes it): "Twenty new profile banners: painted academy places, Freeplay
milestones, co-op, a secret, Pumpkin Lantern Night, an LR night sky and the four seasons. Each one unlocks from things
you've already done, and other Senseis see it on your profile."

## 7. Open questions (each has a default)

| # | Question | Default |
|---|---|---|
| Q1 | The seasons go by the device's date on the game's 7 PM Central day, so a player who changes their clock can unlock one early. It's cosmetic; accept that? | **Yes** |
| Q2 | Pumpkin Lantern Night needs a Halloween operation cleared before the event closes (Nov 15), and it is a keepsake after that. Later events would get their own banner in the same way | **Yes** |
| Q3 | Achievement banners need the achievement **claimed** (as titles do), not just met | **Yes** |
| Q4 | Ship the six new illustrations (`feature/profile-banners-art`), or keep the patterns until the owner draws their own? | **Ship the illustrations; the patterns stay as the fallback** |
| Q5 | Names and unlocks in §2: any you would swap? (For example, Workshop Bench could unlock with the gear update's "Nightglass Form" instead) | **As listed** |
| Q6 | Should event exchanges later sell a banner too (exchange currency only, never gems)? | **Not now** |
