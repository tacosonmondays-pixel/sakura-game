# Sakura Sentinels

**Sakura Sentinels** is an original anime chibi tower-defense game with gacha recruiting, gear and a
bestiary. Cute academy girls, each with a floating halo, defend garden paths, lakeshores, shrines,
foundries and dragon peaks from slimes, goblins, orcs, ghosts, oni and dragons. The depth is meant to feel
like Bloons TD6: 3 upgrade paths × 5 tiers with crosspathing, a type chart and enemy traits that each
need the right counter. The menus take after Blue Archive: sky blue, slanted white panels, navy italic
headings and yellow buttons.

It runs in the browser (desktop and phone, landscape or portrait). It is plain JavaScript, built with
Vite and three.js, and needs no server: your progress is saved in the browser.

▶ **Play it:** https://tacosonmondays-pixel.github.io/sakura-game/

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
| Place a girl | Drag her card onto a tile, or click the card and then a tile | Drag the card, or tap the card and then a tile |
| Select a girl (upgrades, sell, targeting) | Click her | Tap her |
| Cancel placing / deselect / pause | `Esc` | Tap empty ground, or ⏸ |
| Start the next wave | `Space` or **Start wave** | **Start wave** button |
| Game speed 1× / 2× / 3× | `F` or the speed button | Speed button |
| Pick a card from the tower bar | `1`–`9` | — |
| Pan / zoom the camera | Drag / mouse wheel | Drag / pinch |
| Reset the camera | Double-click empty ground | Double-tap empty ground |
| Hero ultimate | Ult button on the hero portrait (unlocks at hero level 3) | Same |

Water girls (Sango, Umeko and the hero Nami) can only stand on water. While you place one, the water
tiles glow. The strip at the top shows what the next wave holds and warns you about dangerous
enemies.

---

## Features

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
  and 200 recruit points let you pick any SSR (spark). The reveal animation can be skipped, and results
  are saved before it plays.
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

You need Node.js 20 or newer (22 recommended).

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN, so you can open it on a phone)
```

Other scripts:

```bash
npm test           # vitest: data, systems, sim, renderer and integration tests
npm run build      # production build into dist/
npm run preview    # serve the production build
npm run e2e        # browser smoke test (needs Playwright + Chromium; see e2e/smoke.mjs)
BALANCE=1 npx vitest run tests/integration/balance.test.js   # campaign balance table (~2 min)
```

Dev preview pages for single parts live in `previews/` (for example `/previews/renderer.html?stage=1-5`,
`/previews/models.html` and `/previews/art.html?s=cards`).

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

## Project structure

```
index.html, src/main.js     app shell, screen routes
src/core/                   store (save/load to localStorage), events, seeded RNG, utils
src/data/                   game data: types (vocabulary), units, enemies, maps, stages, items, shop, missions, wiki
src/sim/                    deterministic battle simulation (no DOM): Sim, combat, enemies, towers, hero, waves, headless runner + autoPlan bot
src/systems/                save, progression, gear, inventory, gacha, rewards, unlocks, missions, shop (pure, tested)
src/models/                 three.js chibi girls (built on the base mesh) and enemy models, viewer, silhouettes
src/render/                 3D battle renderer: terrain, props, actors, effects, camera
src/art/                    SVG card art, item/trait/UI icons, stage thumbnails, backdrops
src/ui/                     router, DOM helpers, shared components, screens/, battle/ (in-battle UI), styles/
public/models/chibi_base.glb  the chibi base mesh
tests/                      vitest suites per area + integration (consistency, balance)
e2e/                        Playwright smoke test and screenshot helper
previews/                   dev pages for each area
docs/                       roster, bestiary, campaign, economy, integration notes, owner requests
CONTRACTS.md                module APIs and data schemas
```

## Credits

- **Chibi base mesh** (`public/models/chibi_base.glb`): made by the owner of this project.
- Game design, from the owner's long design conversations: the chibi girls with halos, BTD6-style depth,
  enemy families, gacha rules, gear and rerolls, the bestiary and everything listed in
  `docs/OWNER_REQUESTS.md`.
- Built with [three.js](https://threejs.org/) and [Vite](https://vitejs.dev/). Fonts: Nunito and
  M PLUS Rounded 1c (Google Fonts).
- All characters, art and names are original. The game is inspired by Bloons TD6, Blue Archive and
  Arknights, but uses none of their assets.
