# Sakura Sentinels

**Sakura Sentinels** is an original anime chibi tower-defense game with gacha recruiting, gear and a
bestiary. Cute academy girls, each with a floating halo, defend garden paths, lakeshores, shrines,
foundries and dragon peaks from slimes, goblins, orcs, ghosts, oni and dragons. The depth is meant to feel
like Bloons TD6: 3 upgrade paths × 5 tiers with crosspathing, a type chart and enemy traits that each
need the right counter. The menus take after Blue Archive: sky blue, slanted white panels, navy italic
headings and yellow buttons.

It runs in the browser (desktop and phone, landscape first, portrait still works). It is plain JavaScript,
built with Vite and three.js, and needs no server: your progress is saved in the browser. The girls and
monsters are real rigged 3D chibis built by a Blender pipeline that lives in this repository.

▶ **Web version:** https://tacosonmondays-pixel.github.io/sakura-game/ — served by GitHub Pages once the
Deploy workflow has run on `main` (see [Deploy to GitHub Pages](#deploy-to-github-pages)).

---

## How to play

1. **Lobby → Mission**. Pick a stage on the campaign map. Each stage card shows its medals (Easy
   bronze, Normal silver, Hard gold, Nightmare sakura), any new enemy mechanic, and the girls you
   recruit for free by clearing it.
2. **Stage prep**. Check which enemies are coming (new ones are marked **New!**), see the recommended
   counters and add them with one tap, choose a difficulty, then press **Start**.
3. **Battle**. Place girls next to the path and start the wave. Every kill and wave clear earns
   coins; spend them on upgrades. Enemies that reach the exit cost lives.
4. **Grow your team**. Level up with books, break through level caps with your girls' family
   materials, awaken them with boss crowns, equip gear, and recruit more girls in **Recruit**.

### Battle controls

| Action | Mouse / keyboard | Touch |
|---|---|---|
| Place a girl | Drag her card anywhere on the board and let go (she stands exactly where you release, no grid), or click the card and then the ground | Drag the card and let go, or tap the card and then the ground |
| Select a girl (upgrades, sell, targeting) | Click her | Tap her |
| Cancel placing / deselect / pause | `Esc` | Tap empty ground, or ⏸ |
| Start the next wave | `Space` or **Start wave** | **Start wave** button |
| Game speed 1× / 2× / 3× | `F` or the speed button | Speed button |
| Pick a card from the tower bar | `1`–`9` | — |
| Pan / zoom the camera | Drag / mouse wheel | Drag / pinch |
| Reset the camera | Double-click empty ground | Double-tap empty ground |
| Hero ultimate | Ult button on the hero portrait (unlocks at hero level 3) | Same |

Placement is free, like Bloons: every girl has a round footprint and can stand anywhere that is not the
road, an obstacle or another girl. While you hold a card the forbidden zones are shaded red; an invalid
spot shows a red ghost that shakes and tells you why. Water girls (Sango, Umeko and the hero Nami) can
only stand on water. The strip at the top shows what the next wave holds and warns you about dangerous
enemies. Phones: play in landscape (the game asks you to rotate and can go fullscreen); you can add it to
the home screen as an app.

---

## Features

- **Drawn art everywhere:** every girl has a hand-drawn illustration, card, bust and transparent
  full-figure stand in `public/art/portraits/` (`src/art/portraits.js`), used by the student list and
  detail, formation, recruit banner / results / SSR splash, SSR Select picker, missions hub, lobby, title,
  battle bar and deploy tag, victory MVP, mall exchange and wiki. The old SVG doll is only a fallback.
- **Title screen:** a painted load-up screen (`#/title`) with three drawn girls, a loading bar that really
  preloads the lobby, then TAP TO START, plus Notice, Settings, Account and Code buttons. Shown once per
  session on a cold start, and it hands off to the lobby without a blink.
- **Drawn lobby (Blue Archive memorial-lobby style):** your secretary is a full-screen illustration that
  breathes and reacts to taps, not a 3D model in an SVG room.
- **Lobby backgrounds:** every background belongs to one girl and picking it makes her the secretary:
  her painted scene (Hikari, Aoi, Sango), or her stand over the academy by day, at sunset or by night.
  Each girl also has two bond memories (café date, festival night, sunset walk, study session…). They
  are shown locked until the coming City dates and gifts raise her bond to 5 and 10.
- **Missions hub and events:** the painted academy behind the panels, drawn tiles with name plates and
  your secretary's stand. Events has a painted hero and a host girl.
- **Mail + beta thank-you:** a Blue Archive-style mailbox. Accounts created on or before 2026-11-07
  (America/Chicago), and every save from before the mailbox, get a one-time Beta Tester gift: five 10×
  Recruit Tickets, an SSR Select Ticket (choose any SSR), a bundle of materials and books, 300,000 coins
  and 3,000 gems. One "Gifts received!" dialog then offers the SSR pick right away (or later from the
  Backpack).
- **Blender-built chibis:** the 19 girls are rigged, skinned GLB models (full detail + LOD) generated by
  the Blender pipeline in `tools/blender/` from the roster data: cage-and-subdivision bodies, painted face
  atlases with expressions, broad curved hair, costume pieces, weapons and halos, with idle, walk, attack,
  cheer, victory, hurt and pick-up clips. Toon shading with outlines. The 74 monsters ship as one rigged
  GLB per family (12 files, 2.27 MB in all) with move, idle, hit, death and special clips; killed monsters
  act out their death. Models load in the background and upgrade in place, so the game never waits.
- **Free placement:** no grid. Every girl has a round footprint; drag a card and release anywhere that is
  not the road band, an obstacle, wrong terrain or another girl. The forbidden zones are shaded while you
  hold a card, invalid drops shake a red ghost and explain why.
- **Lively maps:** painted ground per map (clover, flowers, worn dirt by the road, wet sand by water), a
  ribbon road with rounded corners, framed boards with props cycled around the edge, animated entrance and
  exit arrows, flowing water with koi and ripples, butterflies, bird flocks, cloud shadows, wind gusts and
  lantern light pools at night.
- **Landscape UI:** a Blue Archive-style lobby with your secretary's drawn art, a missions hub, slanted panels
  and pill tabs, press/panel/screen motion timings, and every screen laid out for landscape phones
  (844×390) as well as desktop. Portrait still works; the game asks to rotate and offers fullscreen.
- **PWA install:** a web manifest (fullscreen, landscape) and iOS home-screen metas, so the game can be
  added to a phone's home screen. There is no service worker yet, so it needs a connection.
- **Tower defense:** 40 campaign stages in 8 chapters, 15 Bounty resource stages, 3 Total Assault boss
  arenas and an endless Tactical Challenge. There are 49 maps: loops, figure-8s, spirals, two- and
  three-lane maps, lakes, islands and bridges.
- **Upgrades:** 3 paths × 5 tiers per girl, with BTD6 crosspathing (two paths at most, and only one above
  tier 2). Tier 3 and up changes how she plays.
- **Type chart:** 5 attack types (blast, pierce, slash, mystic, holy) against 5 armor classes. There are
  also elements and statuses: burn, poison, slow, freeze, shock, shred, mark, soak, silence and reveal.
- **Enemies:** 74 enemies in 12 families, each normal enemy with one readable rule. Slime mimics copy one
  trait from another family. Goblins are fast, orcs are armored, ghosts phase, ghouls siphon or blink,
  oni project fields, constructs carry crystal shells and barriers, and fae make decoys. There are 4
  minibosses and 3 bosses, each with announced phases.
- **Free counters:** every counter you need comes from a free girl, and she arrives one stage before the
  mechanic she counters.
- **Heroes:** one per battle. Each levels from 1 to 10 during the fight and has an ultimate: Celestial
  Bloom, Moonfall or Tidal Wave.
- **Recruiting:** SSR rate 1.5% with guaranteed pity on the 90th pull, at least one SR in every 10-pull,
  and 200 recruit points let you pick any SSR (spark). The reveal is a drawn sealed letter whose seal is
  tinted by rarity; it can be skipped, and results are saved before it plays.
- **Growth:**
  - Books for levels.
  - 7 material families in 5 rarities for breakthroughs.
  - Crowns from bosses for awakening.
  - Gear with a main stat and substats, enhance up to +10, and rerolls where you can lock one substat.
- **Backpack and teleport:** the backpack sorts items by category. Every item shows where it drops, and
  **Teleport** jumps straight to that stage.
- **Bestiary and wiki:** the bestiary shows 3D models, but enemies stay black silhouettes until you win a
  stage that contains them. The built-in wiki has 17 searchable articles.
- **Live features:**
  - Daily and weekly commissions and a 7-day login calendar.
  - Achievements and redemption codes.
  - A weekly double-drop event.
  - The Mall with five exchange tabs.
  - A free-to-play income overview showing pulls per 28 days.
- **Battle quality of life:**
  - Warnings before each wave and an explanation after a defeat ("Most leaks were Goblin Runner on wave
    12").
  - Sweeping after a Hard clear.
  - Auto-start for waves.
- **Settings:** graphics quality, lighting, and save export/import.

## Roster

| Girl | Kind · Rarity | Role | Attack | Placement | How to get | In one line |
|---|---|---|---|---|---|---|
| Hikari | Hero · SSR | Vanguard | Holy | Land | Starter | Holy cleaves with Veil Sight; ult *Celestial Bloom* |
| Luna | Hero · SSR | Mystic | Mystic | Land | Recruit | Three piercing moon beams; ult *Moonfall* slows enemies, speeds allies |
| Nami | Hero · SR | Tideguard | Mystic (frost) | **Water** | Free after 1-5 | Frost strikes from the water; ult *Tidal Wave* pushes enemies back |
| Aoi | Tower · R | Marksman | Pierce | Land | Starter | Cheap, reliable arrows; good vs crystal shells |
| Rei | Tower · R | Cleaver | Slash | Land | Starter | Melee sweep for crowds at corners |
| Yuki | Tower · R | Controller | Mystic (frost) | Land | Free after 1-2 | Slowing snowballs, freezes, Brittle |
| Momo | Tower · R | Economy | Pierce | Land | Recruit | Coins every wave |
| Akane | Tower · SR | Bombardment | Blast (fire) | Land | Recruit | Fireworks that burn dense swarms |
| Sango | Tower · SR | Artillery | Blast (water) | **Water** | Free after 1-5 | Long-range shells that break armor and barriers |
| Kage | Tower · SR | Skirmisher | Pierce | Land | Free after 2-5 | Rapid shuriken with innate Veil Sight |
| Umeko | Tower · SR | Support | Mystic (water) | **Water** | Free after 3-2 | Veil Sight aura for the whole team |
| Shiro | Tower · SR | Sniper | Pierce | Land | Free after 3-5 | Map-wide rifle for casters, elites and bosses |
| Midori | Tower · SR | Alchemist | Mystic (poison) | Land | Free after 4-5 | Poison that ignores armor and stops healing |
| Suzu | Tower · SR | Trapper | Blast | Land | Free after 5-5 | Rune traps near the exit; stops sappers |
| Raika | Tower · SR | Chain | Mystic (lightning) | Land | Recruit | Lightning that jumps between enemies |
| Miko | Tower · SR | Enchanter | Holy | Land | Recruit | Damage aura, talismans, cleanse |
| Hotaru | Tower · SSR | Exorcist | Holy | Land | Recruit | Holy pulses that reveal and silence |
| Kaede | Tower · SSR | Duelist | Slash | Land | Recruit | Damage builds on one tough target |
| Chika | Tower · SSR | Engineer | Pierce (lightning) | Land | Recruit | Sentry drones plus a cleanse aura against sabotage |

The full roster, every upgrade path and the counter coverage map are in [docs/ROSTER.md](docs/ROSTER.md).

---

## Run it locally

You need Node.js 22.12 or newer on an LTS line (22 or 24): the locked Vite 8 needs ≥ 22.12 on the 22
line and Vitest 5 supports only 22.12+, 24 and 26+ (`engines` in `package.json`).

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN, so you can open it on a phone)
```

Other scripts:

```bash
npm test           # vitest: data, systems, sim, renderer and integration tests
npm run build      # production build into dist/
npm run preview    # serve the production build
npm run e2e        # browser smoke test (needs Playwright + Chrome/Edge/Chromium; see e2e/smoke.mjs)
BALANCE=full BALANCE_OUT=balance.md npx vitest run tests/integration/balance.test.js   # campaign balance table (~2 min)
```

Dev preview pages for single parts live in `previews/` (for example `/previews/renderer.html?stage=1-5`,
`/previews/models-v2.html?view=lineup`, `/previews/enemies-v2.html?view=sheet`,
`/previews/terrain-v2.html?theme=shrine`, `/previews/placement-v2.html`, `/previews/ui-v2.html` and
`/previews/art.html?s=cards`). Screenshots of any route: `node e2e/shot.mjs "/#/lobby" out.png --viewport 844x390`.

The e2e scripts find Playwright as the `playwright` or `playwright-core` package (in `node_modules` or
a folder on `NODE_PATH`), or at `PLAYWRIGHT_MODULE=<its folder>`. They drive Playwright's own Chromium
when it is installed, otherwise the system Chrome, then Edge; `CHROME_PATH=<exe>` or
`PLAYWRIGHT_CHANNEL=chrome|msedge` picks one. No browser download is needed. The smoke test covers
1280×720 (mouse), 844×390 (landscape phone, touch) and 390×844 (portrait), including a real
drag-and-release from the tower bar; `--viewport 844x390` runs one size (about 2 minutes under
SwiftShader).

### Regenerate the models

The girls and monsters in `public/models/` are generated, not hand-edited. The generators run headless
Blender 4.2 as the Python module `bpy`, plus numpy and Pillow (face atlases, GLB packing). bpy 4.2 only
exists for **CPython 3.11**, so use a Python 3.11 environment:
`pip install -r tools/blender/requirements.txt` (the file shows the venv commands). They read the roster
and bestiary straight from `src/data/` through `node`, so Node must be on `PATH`:

```bash
python3 tools/blender/build_characters.py              # all 19 girls: <id>.glb (full) + <id>.lod.glb, ≈1.5 s each
python3 tools/blender/build_characters.py hikari aoi    # just these two
python3 tools/blender/build_characters.py hikari --blend /tmp/hikari.blend   # also save a .blend to inspect
python3 tools/blender/enemies/build_enemies.py         # all 12 monster families (~15 s), one rigged GLB per family
python3 tools/blender/enemies/build_enemies.py orc dragon
npx vitest run tests/models                            # checks every GLB: clips, rig, materials, atlas, size budgets
```

Budgets: ≤ 480 KB per girl (LOD ≤ 240 KB), ≤ 320 KB per monster family and ≤ 2.5 MB for all twelve.
`docs/MODELS.md` explains the construction method and how to add a character or a family. The runtime
keeps a procedural fallback, so the game (and the Node tests) still work with no GLB files at all.

## Deploy to GitHub Pages

The workflow is already in `.github/workflows/deploy.yml`. On every push to `main` (or when you run it
by hand from the Actions tab), it installs dependencies, runs the tests, builds the game and publishes
`dist/`.

1. Push the repository to GitHub as `sakura-game` and merge your work into `main`.
2. On GitHub, open **Settings → Pages** and set **Source: GitHub Actions**.
3. Wait for the **Deploy to GitHub Pages** workflow to finish (Actions tab).
4. Play at **https://tacosonmondays-pixel.github.io/sakura-game/**

The build uses relative paths (`base: './'` in `vite.config.js`), so it also works from any other folder
or static host.

## Screenshots

Reviewed stills from the V2 build (`docs/reference/`, `V2final-<screen>-<viewport>.jpg`, each at 1280×720
and at the landscape-phone size 844×390):

| File | What it shows |
|---|---|
| `V2final-lobby-*` | Lobby (V2, since replaced by the drawn lobby): 3D secretary (Hikari GLB), login gift, campaign card, dock |
| `V2final-missions-*` | Missions hub: Mission, Story, Bounty, Total Assault, Tactical Challenge, Commissions, Sweep |
| `V2final-campaign-*` | Campaign map: chapter tabs, stage cards with medals, "New mechanic" and free-recruit tags |
| `V2final-stage-1-1-*` | Stage prep: map preview, difficulty medals, recommended counters, formation, drops, Sweep / Start |
| `V2final-battle-1-1-midwave-*` | Battle 1-1 wave 2: Aoi, Rei and Yuki standing at free (continuous) spots on the painted sakura map, GLB slimes on the road |
| `V2final-battle-3-2-midwave-*` | Battle 3-2 wave 3 at night: lanterns, fog, veiled smoke throwers, the "new enemy" warning |
| `V2final-student-card-*` / `V2final-student-3d-*` | Student detail: card art, then the 3D chibi with Idle / Attack / Cheer / Victory |
| `V2final-bestiary-discovered-*` | Bestiary: discovered slimes in 3D, black silhouettes for the rest |
| `V2final-recruit-results-*` | Recruit: results of a 10-pull |
| `V2final-backpack-*` | Backpack by category with rarity filters and "used by" portraits |

Older sets in the same folder: `V2-*` (first V2 integration), `V2b-before-*` / `V2b-after-*` (landscape
polish), `V2-enemies-*` (every monster), `OLD-v1-*` (the previous version).

## Project structure

```
index.html, src/main.js     app shell, screen routes
src/core/                   store (save/load to localStorage), events, seeded RNG, utils
src/data/                   game data: types (vocabulary), units, enemies, maps, stages, items, shop, missions, wiki
src/sim/                    deterministic battle simulation (no DOM): Sim, combat, enemies, towers, hero, waves, headless runner + autoPlan bot
src/systems/                save, progression, gear, inventory, gacha, rewards, unlocks, missions, shop (pure, tested)
src/models/                 GLB runtime for girls (glbChibi) and monsters (glbEnemy), procedural fallbacks, viewer, silhouettes
src/render/                 3D battle renderer: painted terrain, ribbon roads, props, ambient life, actors, effects, overlays, camera
src/art/                    drawn portrait URLs (portraits.js), SVG fallback card art, item/trait/UI icons, stage thumbnails, backdrops
src/ui/                     router, DOM helpers, shared components, orientation (rotate / fullscreen), screens/ (incl. title), lobby/ (drawn stage, background picker, mail, notice), battle/, styles/
public/art/                 drawn art: portraits/ (6 files per girl), lobby/ (academy, scenes, thumbs), ui/ (mail envelope)
public/models/characters/   19 girls as <id>.glb + <id>.lod.glb + manifest.json (generated)
public/models/enemies/      12 monster families as <family>.glb + manifest.json (generated)
public/models/chibi_base.glb  the owner's chibi base mesh (V1 fallback body)
public/manifest.webmanifest PWA manifest (fullscreen, landscape)
tools/blender/              Blender (bpy) generators: build_characters.py, lib/, enemies/
tests/                      vitest suites per area + models (GLB checks) + integration (consistency, balance)
e2e/                        Playwright smoke test and screenshot helper
previews/                   dev pages for each area
docs/                       roster, bestiary, campaign, economy, models, placement, integration notes, owner requests, reference stills
CONTRACTS.md                module APIs and data schemas
```

## Credits

- **Chibi base mesh** (`public/models/chibi_base.glb`): made by the owner of this project.
- Game design, from the owner's long design conversations: the chibi girls with halos, BTD6-style depth,
  enemy families, gacha rules, gear and rerolls, the bestiary and everything listed in
  `docs/OWNER_REQUESTS.md`.
- Built with [three.js](https://threejs.org/) and [Vite](https://vitejs.dev/). The models are generated
  with [Blender](https://www.blender.org/) (bpy) and Pillow. Fonts: Nunito and M PLUS Rounded 1c
  (Google Fonts).
- All characters, art and names are original. The game is inspired by Bloons TD6, Blue Archive and
  Arknights, but uses none of their assets.

## Desktop version (Windows .exe)

A single-file desktop build — no installer, no Electron — made with Node's Single
Executable Application feature. The exe embeds the whole web build, serves it on
`http://127.0.0.1:47333/` and opens the game in an app window (Edge/Chrome/Brave `--app` mode when
available, otherwise your default browser).

Saves are kept between launches in that window's own browser profile,
`%APPDATA%\SakuraSentinels\window` (when none of those browsers is found: your default browser's storage for
`http://127.0.0.1:47333/`). They are **separate from the web version's saves**: to move progress
either way, use **Settings → Save data → Export & copy** in one and paste the code into **Import** in
the other.

```bash
npm install
node desktop/build.mjs                   # → desktop/out/SakuraSentinels.exe (on Windows; downloads node.exe 22.12.0 once)
node desktop/build.mjs --platform linux  # → desktop/out/sakura-sentinels
```

The SEA blob is generated by the same node.exe that is embedded, so the exe never mixes Node
versions; building the Windows exe on Linux/macOS therefore needs that exact Node version.

Or on GitHub: **Actions → "Desktop build (Windows exe)" → Run workflow**, then download the
`SakuraSentinels-windows` artifact. Pushing a tag like `v1.0.0` also attaches the exe to a release.

The exe is unsigned, so Windows SmartScreen may ask once ("More info → Run anyway").
