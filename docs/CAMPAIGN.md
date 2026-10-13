# Campaign, Bounty, Total Assault & Challenge

Source of truth: `src/data/stages.js` (stages), `src/data/maps.js` (49 maps), `src/data/enemies.js`
(74 enemies, see `docs/BESTIARY.md`). Owner: world.

## Design principles

* **One mechanic family per chapter.** Each stage introduces at most a handful of new enemies
  (listed in `introduces`, shown as "New!" on stage prep) and the stage scenery reflects them
  (lanterns + fog when veils arrive, brambles for thornroots, barrier pylons for aegis automatons…).
* **Free recruits arrive one stage before the mechanic they counter.** Clearing the stage grants
  the girl (any difficulty), so every essential counter is available without gacha luck.
* **Readable waves.** Ordinary enemies have one rule; depth comes from combining roles inside a
  wave — the sim orders groups slowest-first and lets fast groups catch up, so armored orcs escort
  field oni while goblins slip through.
* **Gentle openings, steep finishes.** Every stage starts with cheap fodder (wave budgets start at
  6–8 and big enemies are skipped until the budget can afford several), then ramps to the
  chapter's showcase. `hpScale` rises smoothly from 1.0 (1-1) to 6.5 (8-5); waves grow from 12 to 30.
* **Every family farmable.** Each campaign stage drops coins, books and two material families;
  across the campaign all seven families appear at common and rare (and better on later chapters /
  harder difficulties). Reroll dice drop occasionally from chapter 3 on.

## Chapter flow

| Ch | Name | Theme | Teaches | Free recruit (granted on clear) |
|---|---|---|---|---|
| 1 | Sakura Gardens | sakura | Placement, upgrades, runners, **hasty** sprinters, plain tanks. Finale: **Slime Prince** (splits into Royal Guards). | **Yuki** after 1-2 (slow, before dashers in 1-3) · **Nami** + **Sango** after 1-5 (water placement) |
| 2 | Moonlit Lakeshore | lake | **Water placement** (maps are 40–75% water), **regen** (pearl slimes, marsh hunters), **splitters** (prism slimes), **fire ward** (sunscales). Finale: Bog Basilisk elites. | **Kage** after 2-5 (Veil Sight) |
| 3 | Moonveil Shrine | shrine | **Veiled** enemies (wraiths, smoke throwers, violet slimes), spectral bodies, **phasing**, veiled **summoners**. Foggy, lantern-lit, night. | **Umeko** after 3-2 (Veil Sight aura from the water) · **Shiro** after 3-5 (armor pierce) |
| 4 | Ironhold Pass | mountain | **Armored** columns, **guardian** shieldbearers, **pack fury** wolves & berserkers. Finale: **Orc General** (armor 10 shield phase, then a berserk charge). | **Midori** after 4-5 (poison stops healing) |
| 5 | Gloomfen Marsh | marsh | **Siphon** (leech ghouls, rose slimes), **blink** (fog skulkers), **brood** seed pods, bark-armored thornroots, regrowing mosslings. Finale: the Drowned Willow spiral. | **Suzu** after 5-5 (traps vs sappers) |
| 6 | Clockwork Foundry | foundry | **Crystal shells** (many small hits), **barriers** (blast), **sabotage** (traps, cleanse), **volatile** death blasts. Finale: **Goblin Machine** (barrier reboot, sapper overdrive). | — |
| 7 | Oni Festival | festival | **Fields** (haste / shield / regen; holy hits silence them), **illusionist decoys**. Finale: **Oni Champion** rotating stances. | — |
| 8 | Ashwing Peaks | snow / volcano | **Airborne** enemies (anti-air), **fire-warded** dragons. Finale: **Ashwing Matriarch** (flight → armored landing → final flight with summons). | — |

## Stage list

| Stage | Name | Map (tier) | New | Recommended |
|---|---|---|---|---|
| 1-1 | First Petals | Academy Terrace (beginner) | Green Slime | – |
| 1-2 | Petal Thieves | Petal Lane (beginner) | Goblin Runner | Rapid Hits |
| 1-3 | Sprinting Gold | Blossom Loop (beginner) | Goblin Dasher, Gold Slime, *hasty* | Slow |
| 1-4 | Heavy Footsteps | Sakura Creek (beginner) | Orc Grunt, Boar Charger | Slow |
| 1-5 | The Jelly Throne | Blossom Court (intermediate) | Royal Guard Slime, **Slime Prince**, *splitter* | Slow, Rapid Hits |
| 2-1 | Moonlit Landing | Moonlit Shore (beginner) | Reed Skink, Pearl Slime, *regen* | Water |
| 2-2 | Through the Reeds | Reed Maze (intermediate) | Marsh Hunter | Water |
| 2-3 | Prism Tide | Lantern Isles (intermediate) | Prism Slime, Slime Droplet | Water, Rapid Hits |
| 2-4 | Sunscale Ferry | Twin Ferry (intermediate, 2 lanes) | Sunscale Warrior, *ward* | Water |
| 2-5 | Basilisk Moon | Moonlight Pier (advanced) | Bog Basilisk | Water, Armor Break |
| 3-1 | Torii of Mist | Torii Corridor (intermediate) | Shrine Wisp, Veil Wraith, *veiled* | Veil Sight |
| 3-2 | Smoke on the Steps | Thousand Steps (intermediate) | Smoke Thrower, Violet Slime | Veil Sight |
| 3-3 | Between Worlds | Moonveil Spiral (intermediate) | Phantom, *phasing* | Veil Sight, Silence |
| 3-4 | Lantern Procession | Koi Garden (advanced, figure-8) | Lantern Bearer, *summoner* | Veil Sight, Priority |
| 3-5 | Hollow Guard | Inner Sanctum (advanced, 2 lanes) | Hollow Samurai | Veil Sight, Priority |
| 4-1 | Iron Column | Ironhold Switchbacks (intermediate) | Ironhide Orc, Iron Slime, *armored* | Armor Pierce, Armor Break |
| 4-2 | Wolves on the Bridge | Sky Bridge (advanced) | Dusk Wolf, Orc Berserker, Moss Bear, *pack fury* | Armor Pierce, Slow |
| 4-3 | Shield Wall | Stone Bastion (advanced, tight corners) | Orc Shieldbearer, *guardian* | Armor Break, Armor Pierce, Priority |
| 4-4 | Howl of the Alpha | Twin Gorge (advanced, merging lanes) | Orc Warlord, Alpha Wolf | Armor Break, Armor Pierce, Priority |
| 4-5 | The Iron General | Ironhold Gate (advanced, 2 lanes) | **Orc General** | Armor Break, Armor Pierce, Slow |
| 5-1 | Leeches in the Fog | Gloomfen Boardwalk (intermediate) | Bonewalker, Bog Shambler, Leech Ghoul, Rose Slime, *siphon* | Anti-Heal, Priority |
| 5-2 | Blink and Bloom | Lantern Mire (advanced, crossing lanes) | Fog Skulker, Seed Pod, Bog Sprout, *blink*, *brood* | Slow, Anti-Heal |
| 5-3 | Thorn and Moss | Witchroot Tangle (advanced, 2 crossing lanes) | Thornroot, Mossling | Anti-Heal, Armor Break |
| 5-4 | Congregation | Sunken Hollow (advanced) | Grave Priest, Elder Treant | Anti-Heal, Priority |
| 5-5 | The Drowned Willow | Drowned Willow (expert, spiral) | – (everything returns) | Anti-Heal, Priority, Slow |
| 6-1 | Crystal Vats | Crystal Vats (intermediate) | Cogling, Shellback, Quartz Slime, *crystal* | Rapid Hits |
| 6-2 | Barrier Line | Conveyor Line (intermediate, long straights) | Aegis Automaton, *barrier* | Barrier Break, Rapid Hits |
| 6-3 | Sabotage! | Gearworks Crossing (advanced, X crossing) | Goblin Sapper, Iron Sentry, *sabotage* | Traps, Cleanse, Armor Pierce |
| 6-4 | Powder Kegs | Furnace Core (expert, serpentine) | Goblin Bomber, Ember Slime, Prism Warden, *volatile* | Cleanse, Barrier Break, Rapid Hits |
| 6-5 | The Goblin Machine | Machine Hangar (expert, self-crossing loop) | Goblin Chieftain, **Goblin Machine** | Barrier Break, Armor Pierce, Traps, Cleanse |
| 7-1 | Festival Wind | Lantern Street (intermediate, 2 lanes) | Oni Brute, Wind Oni, *field* | Silence, Priority |
| 7-2 | Fireworks Square | Fireworks Square (advanced, triple crossing) | Ward Oni | Silence, Priority |
| 7-3 | Mirror Parade | Moon Bridge (advanced, figure-8) | Lantern Sprite, Fae Illusionist, Mirage, Mimic Slime, Glimmer Copy, *decoy* | Rapid Hits, Priority |
| 7-4 | Drums of the Taiko | Shrine Maze (expert, tight corners) | Bloom Oni, Taiko Oni, Mirror Queen | Silence, Priority, Anti-Heal, Veil Sight |
| 7-5 | Champion of the Festival | Champion's Stage (expert, merging lanes) | **Oni Champion** | Silence, Priority, Anti-Heal, Slow |
| 8-1 | Wings over the Ascent | Ashwing Ascent (advanced) | Bubble Slime, Ash Wyvern, *airborne* | Anti-Air |
| 8-2 | Frozen Falls | Frozen Falls (advanced) | Goblin Glider, Wind Sylph | Anti-Air |
| 8-3 | Caldera Rim | Caldera Rim (expert, lava lake loop) | Ashdrake | Anti-Air, Armor Pierce |
| 8-4 | Dragonback Ridge | Dragonback Ridge (expert, merging lanes) | Cinder Wyvern | Anti-Air, Armor Break, Priority |
| 8-5 | The Ashwing Matriarch | Matriarch's Nest (expert, 3 converging trails) | **Ashwing Matriarch** | Anti-Air, Armor Break, Priority |

Every recommended capability is reachable from starters (Hikari, Aoi, Rei) plus free recruits
unlocked by earlier stages — `tests/data/world.test.js` enforces this ("free-counter rule"), along
with detection before any veiled enemy, anti-air before any airborne enemy and a water girl
before chapter 2.

## Miniboss and boss rewards

| Stage | Boss | Crown | Notes |
|---|---|---|---|
| 1-5 | Slime Prince | `crown_slime` (rare) | +1–3 `token_boss` |
| 4-5 | Orc General | `crown_iron` (super rare) | |
| 6-5 | Goblin Machine | `crown_cog` (super rare) | |
| 7-5 | Oni Champion | `crown_oni` (mythic) | |
| 8-5 | Ashwing Matriarch | `crown_dragon` (legendary) | |

Crowns have a base chance plus a second roll on Hard+. Minibosses cost 25 lives if they leak
(bosses always take everything).

## Bounty (resource) arenas

Five arenas × three tiers (`res-<arena>-<tier>`). Tier I unlocks after 1-5, II after 3-5,
III after 5-5. hpScale 1.5 / 3 / 5, 12 / 15 / 18 waves. Every clear gives `token_bounty`.

| Arena | Map | Drops (best rarity rises with tier and difficulty) |
|---|---|---|
| `res-books` Library Courtyard | arena_library | Books: common/rare → rare/super rare → super rare/mythic (legendary on Nightmare) |
| `res-coins` Market Canal | arena_market | Coins 4–6k → 9–14k → 18–28k |
| `res-gear` Workshop Yard | arena_workshop | Gear boxes common → super rare → mythic/legendary, reroll dice, lock pins, prism dice |
| `res-mats-a` Wildflower Meadow | arena_meadow | Feathers, blade shards, embers, rime crystals |
| `res-mats-b` Rune Garden | arena_runegarden | Charms, runes, cogs |

Gear boxes use item ids `gearbox_<rarity>` (resolved to rolled gear by `rollStageDrops`).

## Total Assault (boss arenas)

15 waves of escorts with the boss scripted on wave 15. Expert tier, hpScale 5 / 6 / 7.

| Stage | Boss | Unlock | Signature drops |
|---|---|---|---|
| `boss-lych` | Grave Lych (regen, summons, phasing) | 5-5 | `crown_oni`, mythic rune/charm, legendary rune (Hard+) |
| `boss-colossus` | Iron Colossus (crystal shell phases) | 6-5 | `crown_iron`, mythic cog/blade, legendary cog (Hard+), lock pins |
| `boss-ashwing` | Ashwing Matriarch (flights, fire ward, summons) | 8-5 | `crown_dragon`, mythic/legendary ember & feather, legendary books |

All three also drop `token_boss`, mythic books or gear boxes, prism dice and star fragments.

## Tactical Challenge

`challenge` — endless template on Sakura Colosseum (unlocks after 2-5). The pool rotates in new
families every few waves (`from`/`to`), elites appear from wave 20, and a miniboss or boss is
scripted every 10 waves (Prince 10, General 20, Machine 30, Champion 40, Lych 50, Colossus 60,
Ashwing 70). Rewards are bounty tokens and coins; the UI records the best wave per map.

## Balance notes

* Bounty ≈ 1 coin per 10 *effective* HP in the chapter where an enemy debuts (late monsters carry
  more loot), so the economy keeps pace with `hpScale` the way Bloons pays $1 per RBE. The green
  slime keeps the §5b anchor (14 HP, 1 coin).
* Wave budgets are tuned with the sim's `autoPlan` bot using free units only and modest expected
  levels per chapter. The bot spreads its coins over many low-tier girls, so it is a
  pessimistic stand-in for a player; minibosses and the 8-5 boss are deliberately beyond it and need
  focused tier-4/5 builds (e.g. Kage's Storm of Steel, Shiro's Execution, Sango's Armor-Breaker Shells).
* Tuning results (Normal, autoPlan, free units only): with expected levels per chapter
  (1 / 8 / 14 / 20 / 25 / 30 / 35 / 40) every stage 1-1 … 8-4 is won, most with 40–100 lives; 8-5's
  Matriarch is beyond the bot. With level-1 girls, chapters 1–3 are won and later chapters need
  levelling — progression gates the campaign. On Hard the bot loses many mid/late stages, as intended.
* Difficulty multipliers come from `DIFFICULTIES` in `types.js` (Hard: ×1.35 HP, ×1.1 speed, 50 lives).
