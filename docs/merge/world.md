# World, meta systems, menus and assets: OLD (Codex Alpha 1.3.1) vs NEW (/home/user/sakura-game)

Scope: everything outside the battle sim and the character models. That covers the hub/city, menus, gacha,
growth, live-ops, codes, tutorial and journal, events, cinematics, audio, post-processing and lighting, PWA,
fonts and 2D assets. Character models are covered in `merge/characters.md` and combat in `merge/combat.md`.
Owner-request IDs (N-xx, C-xx, O7 hh:mm) refer to `merge/requests.md`.

## How this was produced (paths for the lead)

* **Old code, readable copy.** I pretty-printed every old module with esbuild into
  `merge/pretty/*.js`. The originals are minified to one line per statement. **All OLD line numbers below are
  for `merge/pretty/<file>.js`.**
* **Old app tour.** The old app talks to a server (`/api/collection`, `/api/run`, `/api/wish`, `/api/redeem`,
  `/api/train` …; see `api()` at `pretty/app.js` L536). Served statically, it stops at "The garden could not be
  reached". The tour script `merge/world-scratch/tools/worldtour.mjs` stubs `/api/**` with Playwright
  `page.route`. It builds a mid-progress collection with the old game's own `gacha.newCollection()` plus
  `growth.js`, and answers `wish` with the real `gacha.summon()`. Run it as
  `node worldtour.mjs <outDir> 1280 720 <steps…>`. Steps are a selector, `eval:`, `shot:name`, `close`,
  `key:` or `actions`.
* **Screenshots.** Old: 59 shots in `merge/world-shots/old/` (`o01…o42`, `p01…p04`, `battle/*`). Each was
  opened and reviewed through the 2×2 contact sheets `merge/world-sheets/old00…old14.png`.
  New: `merge/world-shots/new/n01…n17` plus fresh ones in `merge/world-shots/new2/{lobby,recruit,missions,students}.png`
  (re-taken at 23:1x today; unchanged since 18:2x). Sheets: `world-sheets/new00…04.png` and `new2.png`.
  Assets: `world-sheets/assets.png` (academy.webp, roster.webp, summer renders, three map thumbs) and
  `world-shots/old/maps-contact.png` (all old map thumbs).
* **New-game tour.** `merge/world-scratch/tools/newtour.mjs <outDir> 1280x720 'name|/route|delayMs' …` runs one
  Vite server with its cache outside the repo.

## 0. TL;DR for planning

1. **Keep the NEW meta base.** That means the BA-style screens, local save (`src/systems/save.js`), missions,
   commissions, mall, bounty, backpack, wiki, rewards overview, gacha engine with pity, 10× SR guarantee and
   spark. They are more structured, offline and tested. OLD meta logic is written against a server (anti-cheat
   `/api/*`). Port its **data and ideas** into `src/systems`, not its code paths.
2. **Port from OLD what NEW lacks entirely.** In priority order:
   * **3D city hub** (`city-scene.js` + `village.js`). Owner O7 17:07: "What is missing is the city… make it
     look more interesting". It is the biggest old-only feature.
   * **Wish cinematic** (`cinematics.js`): 3D portal and meteor coloured by rarity, then a reveal of each pull.
   * **Hero ultimate cut-in** (same class, `mode:"hero"`, 7 bespoke signature scenes).
   * **"Meet Hikari" title screen, tutorial battle and Captain's Journal** (`feature-progress.js` `LESSONS`):
     12 feature unlocks gated by chapters cleared, plus a free welcome 10-pull at 3 clears.
   * **Banner rotation**: 11 banners, 5 daily pairs swapping at 7 PM Central (`live-ops.js` `bannerRotation`).
   * **Energy** for resource stages.
   * **Knowledge tree** (account-wide passives) and **city decor** presets.
   * **Audio.** NEW has **no audio code at all**, so its Music and SFX toggles are dead
     (`src/ui/screens/settings.js` L84-85). OLD `audio.js` is a 2.4 KB WebAudio synth.
   * **Service worker / PWA update flow** (`sw.js`, `pwa.js`).
   * **Self-hosted fonts.**
3. **Replace the NEW lobby backdrop with `assets/academy.webp`.** It is a 1536×1024 painted fantasy-academy
   landscape (cherry trees, academy gate, fountain plaza, waterfalls). It fits the owner's "drawn landscape
   memorial lobby, no 3D girl, no SVG room" (requests.md P0 #3) better than anything in NEW. It needs a wider
   crop or outpaint for 19.5:9 phones.
4. **Skip shipping these in their old form:**
   * Old map thumbnails (`assets/maps/*.webp`). The 49 NEW maps differ; NEW draws thumbnails with
     `src/art/stageThumb.js`.
   * The summer event's outfits and its Marina and Amane base designs (swimwear-like on chibi bodies: content
     rule). The event's *structure* (10 VN episodes, 5 ops, a shell-ticket exchange, affection/gifts) is
     reusable with new non-swimwear outfits.
   * `roster.webp` as student art (fanservice framing, see characters.md).
5. **Old bugs not to port:**
   * The "Whole City" and "Moonwater Canal" district cameras render a clipped close-up of a wall or canal
     instead of the city (`o04-city-whole.png`, `o05-city-canal.png`).
   * Expansion girls have **no illustrations**: Fuu, Suzu, Ruri, Hana, Kohaku banner art and wish-result cards
     show broken images or grey placeholders (`o15`, `o19b`).
   * 54 of 80 bestiary entries show broken thumbnails, because only 2 of the enemy webps exist (`o38`).
   * Gacha banner art is a blurred placeholder (`o15`).

## 1. Old feature inventory (what is there, where, how good)

| # | Feature | Old location (pretty line numbers) | What it does | Quality (from screenshots) |
|---|---|---|---|---|
| 1 | Title screen "The Moonpetal Chronicles · Alpha 1.3.1" | `index.html` `#entry-screen`; app.js `finishProgressReset` L594-645 sets the "MEET HIKARI" label | Logo over a blurred 3D city. One CTA: "MEET HIKARI" for new players, "ENTER MOONPETAL CITY" afterwards | Clean but plain; the logo is text in Baloo 2 (`o01`, `p01`) |
| 2 | **3D city hub "Moonpetal City"** | `city-scene.js`: `CITY_BUILDINGS` L3-9, `CITY_DISTRICTS` L203-210, `buildCity` L316, `buildInterior` (5 rooms); `village.js` `class Village` L10; app.js `setupCity` L1203 | Orthographic three.js city, ~64×49 units. Canal at z≈10 with bridges, fountain plaza, blocks of houses, kiosks, sakura trees, lamps, benches. **5 enterable buildings, each with an interior and an action:** Petal Café (cafe), Starlight Academy (growth), Wish Observatory (summon), Adventure Guild (sorties), Ribbon Workshop (shop). **6 district camera presets:** Petal Plaza, Ribbon Quarter, Academy Heights, Moonwater Canal, Sakura Gardens, Whole City. Recruited girls live in the city as 3D chibis that walk a waypoint graph (BFS `route()`), visit buildings and appear as portrait pins on building labels. **Play mode** lets you pick up and drop girls (spring/fall physics in `motion.js`) with rotate and zoom. Pinch, wheel and drag camera | Charming pastel diorama, readable labels. Low detail and boxy; the girls are tiny at default zoom. Two district cameras are broken (§0.5). Owner wants it "more interesting" (`o02`-`o09`, `p02`) |
| 3 | Building interiors | `city-scene.js` `buildInterior(scene,id)`: academy (desks, globe, chalkboard), observatory (orrery), cafe, guild, workshop | Residents stand at occupant spots and wave when visited. The side card has one CTA (e.g. "Train your squad", "Make a wish") | Nice touch; rooms are sparse (`o06`, `o06b`) |
| 4 | City decor | `progression.js` `DECOR` L43-52 (8 presets: fountain, tea, cherry, lanterns, crystals, stage, mushrooms, stars), `DEFAULT_DECOR` L53; `props.js` `makeDecor`; `village.setDecor` | 3 plaza slots (left, back, right) × 8 free presets | Cute and cheap (`o09`) |
| 5 | City lighting moods | `lighting.js` `MOODS` L2 (day, sunset, night), `LightingRig` | Hemi + sun + rim light presets; the setting is under Graphics | Works; mostly a tint change |
| 6 | Bottom dock + top bar | `index.html`, `style.css`, `polish.css` | City · Units · Upgrade · Battle · Summon · Shop. The top bar shows energy, Credits and Starlight, plus a ☰ command menu with 14 tiles (Backpack, Wiki, Upgrade, Team builder, Heroes, Knowledge tree, City decor, Play mode, Bestiary, Wallet history, Settings, Gift codes, Field guide, Progress, Alpha 1.3.1 notes) and "Visit the neighbourhood" building shortcuts | Clean, generic mobile-web look; not Blue Archive (`o07`) |
| 7 | Units / roster | app.js `showUnits`, `showRoster` L161, `showHero` L165, `showModel` L169 (3D viewer with 8 poses: idle, wave, attack, cheer, walk, held, shy, curious) | Illustration cards with rarity and Lv; a per-girl 3D model viewer | Good; the illustrations carry it (`o10`) |
| 8 | Growth ("Character development") | `growth.js` (`trainUnit` L72, `awakenUnit` L80, gear `craftGear` L90, `equipGear` L98, `upgradeGear` L111, `GEAR` L13, level cap 30 from chapter clears `unitLevelCap` L31); `progression.js` `UNIT_TREES` per-girl talent "constellation" (2 branches × 3 nodes, costs in petals), `COPY_THRESHOLDS` [1,2,4,7,11,16] → copy rank (+8% damage per rank); `items.js` 5 book tiers, 4 material families, crowns, `GEAR_STATS` + reroll | Tabs: Level up, Awaken, Equipment (weapon, accessory, charm), Tree. Toggle between card art and 3D chibi | Solid, readable. Similar depth to NEW (`o11`-`o14`) |
| 9 | Knowledge tree (account-wide) | `progression.js` `KNOWLEDGE` L32-42: 3 branches × 3 nodes, costs 1/2/3 Knowledge Stars, earned 3 per first chapter clear | +100 start coins, +15 coins/wave, +10% bounty; +15 hearts, +0.3 range, +10% damage; +5% haste, −10% ult cooldown, +2 hearts/wave | Good, and **NEW has no equivalent** (`o36`) |
| 10 | Gacha "Moonlit Wishes" | `gacha.js` `BANNERS` L14-41 (5 base + 6 limited = 11), `summon()`; `live-ops.js` `bannerRotation` L17-28 | **Standard "Academy Recruitment"** costs **1500 Credits** per pull (a soft currency). **Limited banners cost 100 Starlight** each, 1.5% SSR, featured unit guaranteed within 90, **per-banner pity that persists while a banner is resting**. 5 pairs (tower banner + hero banner) rotate **daily at 7 PM America/Chicago**: lantern+moon, storm+dawn, prism+festival, reflection+theater, hex+tempest. Duplicates give shards (R 3 / SR 10 / SSR 25). Shard exchange "A star you can count on" buys a guaranteed first recruit (`exchange()`). `welcomeMulti()` gives a free 10-pull at 3 clears. History and wallet ledger | Strong system. UI is a plain modal; banner art is missing (`o15`, `o18c`, `o19`, `p03`) |
| 11 | **Wish cinematic** | `cinematics.js` `class Cinematic` L5. Constructor L40-73: the portal colour is gold `#ffdb85` for SSR, violet `#d5adff` for SR, cyan `#9cdfff` otherwise; torus rings, orbiting octahedra, starfield `Points`, meteor with a 28-point trail, floor disc. `reveal()` L290, `next()` L304 recolours per pull | Full-screen night sky. "The stars are listening…" → a meteor dives into a rotating ring portal → the chibi appears in the portal with name, title and "NEW RECRUIT!" / "+1 copy · bond grows · +3 shards" → NEXT REVEAL → results grid. A Skip button is always present | **The best old screen** and Genshin-like as the owner asked (`o16`-`o18d`). It reveals a 3D chibi, so it inherits whatever chibi look ships |
| 12 | Hero ultimate cut-in | `cinematics.js` `buildSignature` L84-230 (7 bespoke mini-scenes, e.g. a taiko drum, a curtain, dancers, a sea serpent, lightning, an eclipse); app.js `playHeroCinema`; setting `cinematics` | When a hero casts her signature skill in battle, a short 3D sequence plays, then the game resumes. "Skipping never changes damage" | Not screenshotted (combat); code is complete |
| 13 | Tutorial "Meet Hikari" | app.js `TUTORIAL_LINES` L1291-1300 (8 steps: hero, aoi, wave1, upgrade, wave2, ability, wave3, finish), `tutorialWelcome` L1301, `beginTutorialGuide`, `tutorialVictory`; `adventure-expansion.js` map category `tutorial` | Scripted 3-wave battle. Hikari speaks in a kawaii voice ("A little light, just for you ♡"), guides placement, upgrade and ult, and Yuki joins on win. Replayable from Settings → Gameplay | Owner asked for it (Codex C-requests). **NEW has no tutorial** |
| 14 | Captain's Journal / feature gating | `feature-progress.js` `LESSONS` L2-15, `featureOpen` L19, `nextLesson` L32; app.js `showJournal`, `showMilestone`, `showFeatureLocked` | 12 lessons unlock systems by **distinct chapter clears**: city 0, bestiary 1, teams 2, free 10-pull + Academy 3, talents 4, resources 5, gear and event 6, sandbox 7, boss 8, awakening 10. A Hikari pop-up "HIKARI HAS A NEW LESSON ♡" appears after a win | Good onboarding pacing (`o24`). NEW opens everything at once, with lock badges on Missions tiles only |
| 15 | Daily login | `summer-event.js` `LOGIN_REWARDS` L6 (7 days: 100 Starlight, 3000 Credits, 12 notes, 150 Starlight, 4 cores, 8 prism dust, 300 Starlight), `claimLogin` L19; resets 7 PM Central; missed days never reset | 7-tile modal from the gift button | Fine (`o25`). NEW has the same idea in Commissions → Login |
| 16 | Resource operations + energy | `live-ops.js` `ENERGY_CAP` 120, +1 per 6 min (`syncEnergy` L5), `FARM_TIERS` L35 (10/15/20 energy, unlock 0/12/18 clears), `FARM_STAGES` L40 (Market Patrol → Credits, Academy Field Study → notes, Starlight Excavation → alloy, Moonweaver Trail → silk, Astral Resonance → cores; 5 waves each) | Map-select "Resources" tab with thumbnail cards | OK (`o35`). NEW's Bounty already covers this, better, without energy |
| 17 | Boss stages ("raids") | `growth.js` `RAIDS` L23; `special-maps.js` 3 arenas (ironwood, thorns, eclipse) | 5-wave boss fights dropping crowns and legendary gear | NEW Total Assault covers this |
| 18 | Sandbox | app.js `showSandbox`; Game mode `sandbox` | Any girl, map or enemy with infinite coins; no rewards | Useful test tool. NEW lacks it |
| 19 | Map select "A world of little wonders" | app.js `showPlay`, `showStageDetails`, `showMapPreview` (live 3D preview with rotate and zoom, `o34`), `battle-modes.js` modifiers (Standard, Reverse Route, Goblin Rush …), 3 difficulties (Cozy 150♥, Standard 100♥, Challenge 60♥), 18 medals per map, wave scout (`showWaveScout`) | Adventure, Resources, Boss stages and Sandbox tabs; Beginner to Expert filters; stage briefing with free recruits, matchup chevrons and drops | Rich but text-heavy (`o32`, `o33`, `old-mapselect`, `old-stagedetail`, `old-wave-scout`). **Wave scout and the 3D map preview are worth porting** |
| 20 | Teams | app.js `showTeams`; growth `defaultTeam`, `activeTeam` | 3 saved teams of 1 hero + 6 towers, a name field, "Recommend squad" and counter chevrons | Good (`o37`). NEW Formation is equivalent |
| 21 | Shop "Moonpetal Market" | growth `shopRotation`; app.js `showShop` | 6 daily offers bought with Credits, resetting at 7 PM Central | Basic (`o20`). NEW Mall is far richer |
| 22 | Backpack | app.js `showBackpack`, `showItemSource` | Rarity filter; tap an item to see where it drops | Good (`o31`). NEW equivalent |
| 23 | Wiki "Moonpetal Archive" | app.js `showWiki`, `showWikiUnit`; `combat-ui.js` | Tabs: Characters, Counters (16 role archetypes), Type chart (7 damage types × 6 traits), Growth, Stages, Recruitment | Good (`o21`-`o23`). NEW Wiki is searchable and broader |
| 24 | Bestiary | app.js `showBestiary`; `enemy-viewer.js` (rotating animated 3D model) | 80 enemies by family, discovered by winning | Broken thumbnails in the mirror (`o38`). The NEW bestiary plus NEW enemies stay (owner) |
| 25 | Gift codes | `progression.js` `redeemCode` L88-94 (client copy: only `verity777` → +999,999 Starlight, once); `reset-code.js` `isResetCode` ("reset 67" → server wipes progress → `finishProgressReset` app.js L594 → title "MEET HIKARI" + tutorial). Server-side codes are not in the mirror | Settings → Gift codes tab | NEW already has `VERITY777` (999,999 gems) and `RESET67` (resetProgress) in `src/data/missions.js` L85-91, normalised by `normalizeCode` (`src/systems/missions.js` L262). **NEW reset goes to "the title screen", but NEW has no title screen.** "Rosie777" appears nowhere in OLD or NEW code; check the owner's request list before adding it |
| 26 | Settings "Your cozy corner" | app.js `showSettings` L186-198 | Tabs: Graphics (quality, post, bloom, city lighting, exposure, bloom strength, contact shading), Audio (master, music, sfx sliders), Gameplay (reduce motion, hero cinematics, field guide, replay tutorial), Gift codes, Save & install (recovery code, install, update) | Good (`o39`-`o41`) |
| 27 | Release notes | app.js `showRelease` | "Alpha 1.3.1" notes modal | Nice for an owner who reads changelogs (`o42`) |
| 28 | **Summer event "The Beach Day That Got Away"** | `summer-content.js` (`SUMMER` L1: 2026-10-03 → 11-03, shop until 11-10; `SUMMER_UNITS` L2-5 Marina SR 23 and Amane SSR 26; `BEACH_SKINS` L6-10; `EVENT_STAGES` 5 ops; `EVENT_BOSS` Seaglass Leviathan; `SUMMER_SHOP`; `BEACH_STORY` L32-43, 10 VN episodes gated by clears); `summer-event.js` (`readBeachStory`, `summerOperation`, `rewardSummer`, `buySummer`, `giveBeachGift`, `BOND_CHATS`, `beachChat`, `equipBeachSkin`); `season-ui.js` `createSeasonUI` | Tabs: Story (VN reader, illustration or chibi + dialogue box, `o26`-`o27b`), Stages (5 beach maps + boss), Exchange (Shell Tickets), Beach bonds (gifts and chats → affection 100 unlocks a cosmetic outfit) | Good structure. **Content problem:** the outfits are swimwear on chibi bodies (`assets/summer/*.webp`, `world-sheets/assets.png`) and the story leans on "adult lifeguard" framing. Must be re-dressed before reuse |
| 29 | Wallet history / ledger | app.js `showWallet`; `p.ledger` | Every currency change with its source | Nice transparency |
| 30 | Audio | `audio.js` `GardenAudio` (2.4 KB) | WebAudio-only, no sound files. A 16-note sine melody over a triangle bass (0.65 s/step); 8 SFX: click, place, attack (throttled to 150 ms), clear, bloom, leak, upgrade, summon (arpeggios on bloom, summon and clear); master, music and sfx gain buses | Functional placeholder; thin music |
| 31 | Post FX | `postfx.js` `PostFX` L17 (custom bright-pass, separable blur ×2 (glow + wide glow), composite with depth-based contact shading, colour grade and vignette, FXAA) | Used by the city and battle | Good. NEW has UnrealBloom only (`BattleRenderer.js` L159-204) |
| 32 | PWA | `sw.js` (offline cache), `pwa.js` (`setupInstall`, `promptInstall`, `checkUpdate`, `applyUpdate`), `manifest.webmanifest`, app icons 192/512 | Install button and "update ready" flow in Settings | NEW has a manifest, an orientation lock and an Electron desktop build (`desktop/`), but **no service worker** |
| 33 | Save model | Server collection plus recovery key (`X-Sakura-Player`), pending-action retry, idempotent request IDs | Online-only | NEW local save with versioned migration and 3 backups is better for the owner's static and desktop build. Keep NEW |

## 2. New game equivalents (for comparison)

Hash routes are registered in `src/main.js`; screens live in `src/ui/screens/`:
`lobby` (557 lines), `missions`, `campaign`, `stage` (prep), `battle`, `bounty`, `assault`, `challenge`,
`recruit` (412), `students` / `student` (760), `formation`, `backpack`, `bestiary`, `wiki`, `commissions`, `mall`,
`rewards` (event + F2P income overview), `settings`.

| Area | NEW location | Notes from screenshots |
|---|---|---|
| Lobby | `screens/lobby.js`, `src/ui/lobby/secretary.js` (3D girl), `src/art/lobbyRoom.js` (SVG office) | BA layout (`n01`, `new2/lobby.png`): top bar (Lv, tickets, coins, gems, settings, mail, menu), left shortcuts (Notice, Tasks, Login gift, Buy gems), event banner bottom-left, F2P-guide carousel, "Campaign" folder, dock (Students, Formation, Backpack, Bestiary, Wiki, Commissions, Mall, Recruit) and a clock. The **3D secretary girl over an SVG office is exactly what the owner rejected** (requests.md P0 #3). Her feet are clipped by the dock |
| Missions hub | `screens/missions.js` | BA tiles (Mission, Story "coming soon", Bounty, Total Assault, Tactical Challenge, Commissions, Sweep) with a tall unit illustration on the left (`n03`). Good |
| Campaign | `screens/campaign.js`, `src/data/stages.js` `CHAPTERS` L148 | 40 stages across 8 chapters; Beginner / Intermediate / Advanced chips; stage cards with mechanic tags (`n06`). Good |
| Recruit | `screens/recruit.js`, `src/systems/gacha.js` | **One** banner "Sakura Academy Open Enrollment". SSR 1.5%, pity 90, 10× guarantees SR+, recruit points 200 → spark, tickets spent first (`n02`, `new2/recruit.png`). Reveal L277: anticipation halo → card flips → results grid (`n14`-`n17`). Functional, but **no featured or rotating banners and no 3D cinematic** |
| Students / Student | `screens/students.js`, `student.js` | Filter by role, type, rarity, owned; locked girls greyed; Info, Level Up, Awakening, Equipment, Tree; card art or 3D chibi (`n04`, `n05`). Better than OLD |
| Commissions | `screens/commissions.js`, `systems/missions.js` | Daily, Weekly, Login (7-day `loginCalendar` L167), Achievements, Codes (`n07`). Better than OLD |
| Mall | `screens/mall.js`, `systems/shop.js` | General, Gem Shop, Recruit Exchange, Boss Exchange, Bounty Exchange (`n08`). Better than OLD |
| Bounty | `screens/bounty.js` | Location select, tiers, drop table, weekly 2× arena (`WEEKLY_EVENTS` data/missions.js L94) (`n13`). Better than OLD resource ops; no energy |
| Events / rewards | `screens/rewards.js` | "Shrine Blessing" weekly event plus an F2P income table (`n12`). No story event |
| Backpack, Bestiary, Wiki, Settings | respective screens | All equal or better than OLD. Settings has Display (fullscreen, landscape, install), Graphics (quality, shadows, bloom, reduce motion), Lighting (exposure), Audio toggles with **no audio engine**, Battle and Save (`n09`) |
| Battle themes | `src/render/themes.js` `THEMES` (12: sakura, lake, shrine, mountain, marsh, foundry, festival, snow, volcano, night, arena + base); `src/data/maps.js` (49 maps; theme use: foundry 7, sakura 6, lake 6, mountain 6, marsh 5, shrine 5, festival 5, volcano 4, snow 2, night 2, arena 1) | Painted ground, ribbon road, water, ambient life. The NEW battle terrain is better than OLD `biomes.js` / `scenery.js` |
| Missing in NEW | — | Title screen, tutorial, feature gating / journal, city hub, decor, knowledge tree, banner rotation / limited banners, wish cinematic, hero cut-in, audio, service worker, sandbox, wave scout, 3D map preview, release notes, story event |

## 3. Feature-by-feature merge table

Effort: S < ½ day, M 1-2 days, L 3-5 days, XL > 1 week (one builder with a screenshot critic).

| Feature | OLD (where / how good) | NEW (where / how good) | Recommendation | Effort |
|---|---|---|---|---|
| Title / boot screen | `#entry-screen`; plain text logo over the 3D city; "MEET HIKARI" CTA ★★☆ | none (only `.boot` spinner, `main.js` L37) ✗ | **Adopt OLD concept, NEW style.** Title over `academy.webp` with the logo, "Tap to start", a version string and a first-run "MEET HIKARI" CTA. Needed so `RESET67` has somewhere to return to | S |
| Home / lobby | 3D city is the home ★★☆ | BA HUD ★★★★, 3D secretary + SVG room ✗ (owner rejected) | **Merge.** Keep the NEW HUD. Swap the backdrop for a drawn landscape: `academy.webp` now, a commissioned art set later. Remove the 3D secretary (requests P0 #3). Add a "City" entry on the dock or the left shortcuts that opens the ported 3D city | M |
| 3D city hub + districts + interiors + residents + play mode | `city-scene.js` 28.8 KB + `village.js` 13.5 KB + `props.js` + `motion.js` + `lighting.js` ★★★ (charming, sparse, 2 broken cameras) | none ✗ | **Adopt OLD (port to `src/city/`).** Then expand per the owner (task #63: districts, canals, academy hill, harbour). Rebuild buildings with the NEW `src/render/props.js` / `textures.js` look (painted ground, toon + outline) so city and battle match. Map buildings to NEW routes: Academy → `#/students`, Observatory → `#/recruit`, Guild → `#/missions`, Workshop → `#/mall`, Café → story/bond, plus a new Harbour → events | L (port) + L (expand) |
| City decor | `DECOR` 8 presets × 3 slots ★★★ | ✗ | Adopt with the city | S |
| City lighting moods | `lighting.js` day/sunset/night ★★ | battle `themes.js` `light` + exposure ★★★ | Merge: reuse NEW light presets and add an old-style time-of-day toggle for the city (could follow the clock) | S |
| Gacha engine | per-banner pity, credits standard banner, shard exchange ★★★ | pity 90 + 10× SR guarantee + 200-point spark + tickets + tests ★★★★ | **Keep NEW engine** and add **banner definitions with a featured unit and rate-up** from OLD `BANNERS` (featured weight 1.0, the others share 0.5 of the 1.5% SSR, `expandedWeights` gacha.js L22-33). Pity is per banner but shares spark points | M |
| Banner rotation | daily pairs at 7 PM Central, 5-cycle (`live-ops.js` L17-28) ★★★ | ✗ (one banner) | **Adopt OLD.** Owner asked for multiple banners. A weekly cadence fits NEW's weekly events better than daily; let the owner choose. Keep the Chicago-time reset (owner's timezone) | S-M |
| Wish cinematic | `cinematics.js` portal/meteor, rarity colours, per-pull 3D reveal ★★★★ | card flip reveal ★★★ | **Merge.** OLD night-sky portal plus meteor as the anticipation phase, coloured by best rarity. Then a per-pull reveal of the **illustration** (or the new BA-style chibi once approved; the owner rates the Codex chibi 3/10, N-05). Then the NEW results grid. Keep Skip. Port the `Cinematic` class nearly as-is (three.js r186 compatible: Torus, Octahedron, Points, Line, additive blending) | M |
| Hero ultimate cut-in | `buildSignature` 7 scenes ★★★ | ✗ | Adopt for heroes; add a 2D illustration slash-in for the non-hero ult if wanted. Toggle in Settings → Battle | M |
| Tutorial "Meet Hikari" | 8-step scripted 3-wave battle ★★★ | ✗ | **Adopt OLD script** (`TUTORIAL_LINES`, app.js L1291) on a NEW tutorial stage. Needs a battle-UI coach-mark overlay (NEW `src/ui/screens/battle.js` + overlay layer) | M |
| Captain's Journal / gated unlocks | `LESSONS` 12 entries, `featureOpen`, `nextLesson` ★★★ | lock badges only (Missions tiles "Clear 1-5 first") ★★ | **Adopt.** Map OLD lesson gates to NEW stage IDs (e.g. bestiary at 1-1, teams at 1-2, free 10-pull at 1-3, Bounty at 1-5, gear at 2-1, Total Assault at 5-5). Store `lessonsSeen` in the save | M |
| Free welcome 10-pull at 3 clears | `welcomeMulti` ★★★ | starter gift gives 10× ticket on new account ★★★ | Keep NEW, but **move** the ticket grant to a 3-clear lesson for pacing | S |
| Knowledge tree | `KNOWLEDGE` 9 nodes ★★★ | ✗ | **Adopt.** Stars from first clears; hook into NEW `unitBattleStats` (`systems/progression.js` L265) as account-wide modifiers. Rebalance (NEW HP and coins scale differently) | M |
| Per-unit talent tree | `UNIT_TREES` (constellation, 2×3) ★★★ | Student → Tree tab ★★★ | Keep NEW; import OLD node names and flavour for the old girls | S |
| Copy rank / bond | `COPY_THRESHOLDS` → +8% damage per rank ★★ | awaken stars from shards ★★★ | Keep NEW | — |
| Level / awaken / gear | `growth.js`, `items.js` ★★★ | `systems/progression.js` / `gear.js` / `inventory.js` ★★★★ | Keep NEW. Map OLD material families to NEW item IDs when importing old girls (characters.md) | — |
| Daily login | 7 days, missed days kept ★★★ | `loginCalendar` / `claimLogin` ★★★ | Keep NEW | — |
| Daily / weekly missions, achievements | ✗ | Commissions ★★★★ | Keep NEW | — |
| Energy | 120 cap, +1/6 min ★★ | ✗ (no stamina) | **Skip** unless the owner asks; NEW Bounty has daily limits. If wanted, gate only Bounty and Assault | S |
| Resource operations | 5 farms × 3 tiers ★★ | Bounty ★★★★ | Keep NEW. Reuse OLD names (Market Patrol, Moonweaver Trail, Astral Resonance) as Bounty arena flavour | S |
| Boss raids | `RAIDS`, 3 arenas ★★ | Total Assault ★★★ | Keep NEW | — |
| Sandbox | any girl, map or enemy, infinite coins ★★★ | ✗ | Adopt as a dev/owner tool behind a Missions tile or a code. NEW sim already supports custom setups (`src/sim` headless) | S-M |
| Map select / stage prep | difficulties, modifiers, medals, wave scout, 3D map preview ★★★ | campaign + stage prep ★★★★ | Keep NEW. **Port wave scout** ("Wave 2 reconnaissance" modal) and **3D map preview** (rotate and zoom the real battlefield before deploying) into `screens/stage.js` | M |
| Battle modifiers (Reverse Route, Goblin Rush, …) | `battle-modes.js` ★★★ | partial (challenge / endless) | See combat.md; meta side is a mode picker in stage prep | M |
| Teams | 3 named teams ★★★ | Formation ★★★ | Keep NEW (check that it supports 3 presets and names) | — |
| Shop | 6 daily offers ★★ | Mall 5 tabs ★★★★ | Keep NEW | — |
| Backpack | ★★★ | ★★★★ | Keep NEW | — |
| Wiki | 6 tabs incl. type chart, counters ★★★ | searchable wiki ★★★★ | Keep NEW. Port the OLD "Counters" archetype cards and the type-chart table layout if the NEW wiki lacks a matrix view | S |
| Bestiary | 3D rotating model ★★★ (broken thumbs) | NEW bestiary + 74 NEW enemies ★★★★ | Keep NEW (owner: keep enemies) | — |
| Gift codes | `verity777` (client), `reset 67`; server-side rest | `REDEEM_CODES` incl. VERITY777, RESET67, SAKURA2026, WELCOME, TACOTUESDAY ★★★ | Keep NEW. **Fix:** RESET67 must return to the new title → "MEET HIKARI" → tutorial, as OLD did (`finishProgressReset` L594-645). Ask the owner about "Rosie777" (not in either codebase) | S |
| Settings | 5 tabs incl. exposure and bloom sliders, recovery ★★★ | ★★★★ | Keep NEW; wire the audio sliders to the ported audio | S |
| Release notes | modal ★★ | ✗ | Adopt (Notice button already exists in the NEW lobby) | S |
| Wallet history | ledger ★★ | gacha history only | Optional | S |
| Summer / story event | full VN event, 10 episodes, shop, affection, skins ★★★ (content issues) | ✗ (Story tile "coming soon") | **Merge structure, redo content.** Use the OLD VN reader + episodes + exchange + affection systems to fill NEW's "Story" tile. Re-dress Marina and Amane in non-swimwear outfits (e.g. lifeguard hoodie and shorts, captain's coat) and **drop all three beach skins**. Event window 10-03 → 11-03 is now; ask the owner whether to ship this season | L |
| Audio | WebAudio synth ★★ | ✗ (dead toggles) | **Adopt OLD `GardenAudio` now** (S), then commission or compose real BGM and SFX files later | S |
| Post-processing | custom bloom + wide glow + contact shading + grade + vignette + FXAA ★★★ | UnrealBloom + Output ★★★ | Keep NEW. Optionally add OLD vignette / colour-grade composite as a final pass for the city and lobby | S |
| PWA / offline | `sw.js` + install/update UI ★★★ | manifest only, Electron build | **Adopt** a service worker (Vite: generate the asset list at build) plus the OLD update toast | S-M |
| Save | server + recovery key ★★ | local versioned save + backups ★★★★ | Keep NEW; add OLD-style export/import code text in Settings → Save (may already exist) | — |
| Fonts | self-hosted Nunito 600-900 + Baloo 2 700/800 woff2 ★★★ | Google Fonts CDN (Nunito, M PLUS Rounded 1c) ★★ (fails offline and in the desktop build) | **Self-host.** Copy OLD Nunito woff2 files; add an M PLUS Rounded 1c subset; Baloo 2 is optional for the title logo | S |

## 4. Asset reuse list (old → new)

All sizes are measured from `oldgame/assets`. "Ship" means copy to `public/…` in the new repo.

| Asset | Size | What it is | Where to use in NEW | Verdict |
|---|---|---|---|---|
| `assets/academy.webp` | 1536×1024, 497 KB | Painted fantasy academy landscape: cherry trees, a gate with a clock tower, fountain plaza, waterfalls, floating island | **Lobby backdrop** (BA memorial-lobby style, slow parallax and petals), **title screen**, Missions hub header, loading screen | **SHIP.** Needs a 2340×1080 crop or outpaint for wide phones; layer petals and a breathing effect in CSS or canvas |
| `assets/hikari.webp` | 820×1230, 335 KB | Hikari full illustration | Student card, Missions-hub left art, tutorial dialogue portrait | Ship after the crop/repaint flagged in characters.md §7 (bust-focused framing) |
| `assets/luna.webp`, `hotaru.webp` | 810×1080, 221 / 188 KB | Single illustrations | Student cards, banner art for featured banners | Ship (check framing per characters.md) |
| `assets/nami.webp`, `sango.webp`, `umeko.webp` | 768×1024, 224 / 201 / 193 KB | Pair portraits (two girls per sheet; OLD crops halves via `portraitPair`, app.js L152) | Student cards (crop halves to separate files) | Ship as crops |
| `assets/roster.webp` | 1983×793, 791 KB | 5×2 sprite of 10 base girls (Aoi, Rei, Yuki, Akane, Shiro, Kage, Raika, Miko, Midori, Momo) | Reference only | **Do not ship** (framing and fanservice per requests.md P0 #6); regenerate as student-appropriate art |
| `assets/summer/amane.webp`, `marina.webp`, `amane-beach.webp`, `marina-beach.webp`, `nami-beach.webp` | 500×600, 14-16 KB each | 3D chibi renders in swimwear-like outfits (`world-sheets/assets.png`) | — | **Do not ship** (content rule). Reference for colour palettes only |
| `assets/maps/*.webp` (17) | 480×320, 3-10 KB each | Top-down renders of OLD battle maps, used as **map-select card thumbnails, stage-detail images, resource-op cards and beach-stage cards** (`<img src="/assets/maps/${id}.webp">` in app.js `showPlay`, `showStageDetails`, `showResourceStages`, `season-ui`). Files present: arena_eclipse, arena_ironwood, arena_thorns, garden, glade, shrine, summer_boardwalk, summer_festival, summer_islands, summer_leviathan, summer_night, summer_shore, supply_academy, supply_astral, supply_loom, supply_market, supply_quarry. The live site had ~40 (see `world-shots/old/maps-contact.png`); the mirror only has these 17, so other cards show broken images | — | **Skip.** NEW maps differ and NEW draws thumbnails procedurally (`src/art/stageThumb.js`). Useful only as layout inspiration (e.g. `supply_astral` hexagon fork, `summer_islands` comb) for the tracks-v3 work |
| `assets/enemies/armored.webp`, `boss.webp` | 256×230, 10 KB | Enemy thumbnails | — | Skip (NEW enemies stay) |
| `assets/models/*.glb` (35) + `face-atlas.png` (1254², 345 KB) | 9.1 MB total, Draco | OLD chibis | Covered in characters.md / integration.md. Owner now rates them 3/10 (N-05): stopgap only. `amane*`, `marina*`, `nami-beach` must not ship | See characters.md |
| `assets/nunito-600/700/800/900.woff2` | 16-20 KB each (~76 KB) | Nunito (SIL OFL) | Self-host the NEW `--font-head` (`'Nunito'`) | **SHIP** (keep OFL notice) |
| `assets/baloo-2-700/800.woff2` | 20 KB each | Baloo 2 (SIL OFL) | Title logo / big numerals only | Optional |
| `assets/app-icon-192.png`, `app-icon-512.png` | 4 / 12 KB | PWA icons | — | Skip; make new icons from the approved art |
| Sounds | none | OLD has no audio files; `audio.js` synthesises everything | Port `GardenAudio` as code | Ship code |
| `vendor/` (three + Draco decoder) | — | — | NEW already has three 0.186 via npm; it needs `DRACOLoader` + decoder only if old GLBs are used | Only if old GLBs ship |

Code worth lifting nearly verbatim (three r186-compatible; replace `./vendor/three.module.min.js` with `three`):
* `cinematics.js` (14.7 KB): wish and hero cinematics.
* `city-scene.js` (28.8 KB) + `village.js` (13.5 KB) + `props.js` (5.2 KB) + `motion.js` (0.7 KB) + `lighting.js` (1.5 KB): the city.
* `audio.js` (2.4 KB).
* `postfx.js` (7.1 KB): only if the custom grade or vignette is wanted.
* `feature-progress.js` `LESSONS` data and the `TUTORIAL_LINES` data.
* `progression.js` `KNOWLEDGE` and `DECOR` data.
* `live-ops.js` `bannerRotation`.
* `gacha.js` `BANNERS` names and featured IDs.
* `summer-content.js` story text (after a content edit).
* `pwa.js` + `sw.js`.

## 5. Old features that would make the "super game" better (with porting notes)

1. **3D city hub "Moonpetal City" → NEW `#/city` (task #63)**
   * Create `src/city/{cityScene.js,village.js,interiors.js}` from OLD `city-scene.js` / `village.js`. Replace
     `propBuilder` boxes with NEW `src/render/props.js` builders and toon + outline materials, and use NEW
     `textures.js` painted ground so the city matches battle maps. Keep the orthographic camera, district
     presets, waypoint graph (`city.waypoints`, BFS `route()`), resident wandering, building pins with
     resident portraits, interiors and play mode.
   * Fix the "Whole City" (zoom 29) and "Moonwater Canal" presets. In OLD they frame a clipped close-up; the
     near plane or camera height is wrong for large zooms (`CITY_DISTRICTS` L203-210, `Village.resize`).
   * Residents come from `profile.units` (owned only, as OLD). Their models come from whichever chibi set
     ships, with skins via the new skin system (integration.md). Cap visible residents at ~12 on phones and
     use LOD.
   * Expansion per owner: harbour district (events), academy hill (story), market canal (Mall),
     observatory (Recruit), guild (Missions), café (bond chats, later), dorm (Students).
   * Perf: OLD batches static parts (`batchProps`); keep that, plus one shadow map at 1024 on Medium.
   * Effort: L for the port, L for the expansion.
2. **Wish cinematic → NEW `recruit.js` reveal**
   * Wrap OLD `Cinematic` (mode `wish`) in `src/ui/fx/wishCinema.js`. Run its portal and meteor phase before
     NEW's flip grid. Colour = best rarity (`#ffdb85` / `#d5adff` / `#9cdfff`). Per-pull reveal shows the
     **illustration** (or the approved chibi), name, title and NEW / +shards. Skip goes straight to the grid.
   * Respect `settings.reduceMotion`. Dispose the renderer on close (OLD `dispose()` L379).
   * Effort: M.
3. **Hero ultimate cut-in**
   * Port `buildSignature`. Trigger it from the battle UI when the sim emits the hero-ult event; pause the
     render, not the sim, or play during a sim pause. Add a Settings → Battle toggle "Hero cinematics" (OLD
     default on).
   * Effort: M.
4. **Title screen + "Meet Hikari" tutorial + Captain's Journal**
   * New `#/title` route before `#/lobby` on first boot and after RESET67.
   * Tutorial stage: 3 waves, Hikari + Aoi, scripted lines from OLD `TUTORIAL_LINES` (kawaii tone the owner
     liked), coach marks pointing at the NEW battle dock.
   * Journal: a `lessons` array in `src/data/`, `nextLesson(profile)` after each win, a Hikari pop-up modal, a
     Journal list behind the lobby "Notice" button.
   * Effort: M-L in total.
5. **Limited banners with rotation and featured units**
   * Extend NEW `systems/gacha.js` with `BANNERS` (featured unit, rate-up, own pity counter, shared spark) and
     `bannerRotation(now)` (OLD algorithm, America/Chicago 19:00). The Recruit screen gets banner tabs like
     OLD `o15` (Tower banners / Hero banners) in NEW BA style.
   * Banner art: use the illustrations (`luna.webp`, `hotaru.webp`, `hikari.webp` …) instead of OLD's blank
     placeholder.
   * Effort: M.
6. **Knowledge tree (account-wide passives)**
   * A new tab in Students or Formation; stars from first clears. Apply in `unitBattleStats` and at battle
     start (cash, lives).
   * Effort: M.
7. **Audio**
   * Port `GardenAudio` to `src/audio/audio.js`. Unlock on first pointerdown. Hook SFX to existing UI (`click`)
     and sim events (`place`, `attack`, `clear`, `leak`, `upgrade`), plus `summon` in recruit and `bloom` on
     ult. Make the NEW Settings toggles live and add volume sliders.
   * Later: real BGM per screen (lobby, battle, gacha).
   * Effort: S.
8. **Story / VN event framework (fills NEW's "Story – coming soon" tile)**
   * Port the reader (`season-ui.js` `createSeasonUI`, `summer-event.js` `readBeachStory`, `beachChat`,
     `giveBeachGift`) as a generic `src/systems/story.js` + `screens/story.js`.
   * Content: rewrite the beach episodes with non-swimwear outfits. Remove the "twenty-three, lifeguard" age
     framing and keep it wholesome. Marina and Amane need new outfits before their models or art are made.
   * Effort: L.
9. **Stage-prep extras: wave scout + live 3D map preview**
   * In `screens/stage.js`, add a "Scout" modal listing wave composition (NEW sim has the wave tables) and a
     small `BattleRenderer` preview with rotate and zoom (OLD `showMapPreview`, `o34`).
   * Effort: M.
10. **Sandbox mode**
    * Owner and dev testing (any girl, map or enemy, infinite coins, no rewards).
    * Effort: S-M.
11. **Decor + time-of-day in the city.** Effort: S once the city exists.
12. **PWA service worker + update toast; self-hosted fonts.** Effort: S each.
13. **Release-notes modal** behind the lobby Notice button. Effort: S.

## 6. Risks and decisions for the lead

* **Owner taste conflict.** The brief says "old characters become the main roster", but the owner's latest
  rating (N-05, 18:26) calls the Codex chibi "3/10 … ugly". The wish cinematic, city residents and hero cut-ins
  all display chibis. Port the **systems** now and plug in whatever chibi set is approved; don't polish them
  around the old GLBs.
* **Server vs local.** OLD meta functions mutate a server collection, with anti-cheat replay in
  `battle-session.js` `VerifiedGame`. In NEW everything is local, so port the data and pure functions only.
* **Timezone.** OLD resets are hard-coded to America/Chicago 19:00 (`live-ops.js`, login, shop). NEW uses
  local or ISO week keys (`missions.js` `onAppStart`). Pick one; the owner is in Central time.
* **Content.** No swimwear on chibi bodies: do not ship `amane*.glb`, `marina*.glb`, `nami-beach.glb` or
  `assets/summer/*`, nor the beach-skin affection rewards as written. Do not ship `roster.webp` for students.
* **Missing source art.** The mirror lacks ~23 map thumbs, ~78 enemy thumbs and illustrations for 13+ expansion
  girls. The owner's 368 MB Codex package (requests.md) may have them. Don't plan on assets the mirror does not
  contain.
* **Bundle size.** City + cinematics add about 60 KB of JS and no textures. `academy.webp` adds 0.5 MB (lazy-load
  it after first paint; serve a 1024-wide variant for phones).
