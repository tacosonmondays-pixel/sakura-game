# Bestiary

> Generated from `src/data/enemies.js` (owner: world). Numbers are before stage `hpScale` and difficulty.

74 enemies in 12 families: 13 elites, 4 minibosses, 3 bosses.

## Readability rules

* **Ordinary enemies have exactly one rule** (one trait, or none for plain fodder). Flat armor counts as the *Armored* rule.
* **Elites combine at most two familiar rules.**
* **Minibosses and bosses telegraph every phase** with an on-screen announcement.
* **Slimes are coloured mimics**: each colour copies one rule from another family, so a slime is always a gentle preview of a mechanic.
* Roles at a glance: *Runner* (fast, fragile), *Swarm* (many weak / splitters / brood), *Armored* (visible plate, shells, barriers), *Support* (fields, siphon, guardian, summoner).
* **Decoys** (Mirage, Glimmer Copy) never cost lives — they only soak up shots.
* Bounty is roughly one coin per 10 effective HP in the chapter where the enemy debuts (late monsters carry more loot).

## Trait reference

| Trait | What it does | Counters |
|---|---|---|
| Armored (`armored`) | Flat damage reduction on every hit. | armorPen, armorShred |
| Barrier (`barrier`) | A separate shield pool that must be broken first. Blast deals +50% to barriers. | barrierBreak |
| Crystal Shell (`crystal`) | Damage per hit is capped until the shell shatters after enough hits. | multiHit |
| Veiled (`veiled`) | Cannot be targeted without Veil Sight or Reveal. | detection, reveal |
| Regenerating (`regen`) | Heals after a short delay without damage. | antiHeal |
| Hasty (`hasty`) | Periodic speed bursts. | slow, trap |
| Volatile (`volatile`) | Explodes on death, stunning nearby girls. | kill at range, cleanse aura |
| Airborne (`airborne`) | Flies over ground-only attacks. | antiAir |
| Elemental Ward (`ward`) | Immune to one element’s status and takes half damage from it. | use other elements |
| Brood (`brood`) | Releases smaller enemies when defeated. | splash, kill early |
| Siphon (`siphon`) | Drains nearby allies to heal itself. | antiHeal, priority, silence |
| Blink (`blink`) | Teleports forward along the path. Slows and stuns interrupt it. | slow, stun, silence |
| Field Caster (`field`) | Projects a haste, shield or regen field on nearby allies. | silence, priority |
| Phasing (`phasing`) | Periodically becomes intangible; only Holy and Mystic hits land. Holy hits stop phasing. | silence |
| Guardian (`guardian`) | Shields nearby allies from damage. Blast ignores the guard. | armorShred |
| Sabotage (`sabotage`) | Disables girls it passes near for a few seconds. | cleanse, trap |
| Illusionist (`decoy`) | Spawns fragile decoys that soak up shots. | multiHit |
| Pack Fury (`enrage`) | Speeds up when packmates fall. | slow |
| Summoner (`summoner`) | Calls reinforcements over time. | priority |
| Splitter (`splitter`) | Splits into smaller copies when defeated. | splash, pierce |

## Slimes

*Wobbly jelly creatures that soak up the colour — and one rule — of whatever lives nearby.* Fragile mimics. Each colour copies exactly one trait from another family: gold runs, violet hides, iron wears plate, rose drinks its neighbours.

| Enemy | Tier | HP | Speed | Armor class | Armor | Rules | Bounty | Debut |
|---|---|---|---|---|---|---|---|---|
| **Green Slime** `slime_green` | normal | 14 | 1 | light | – | – | 1 | 1-1 |
| **Slime Droplet** `slime_droplet` | normal | 5 | 1.3 | light | – | – | 0 | 2-3 |
| **Gold Slime** `slime_gold` | normal | 12 | 1.15 | light | – | Hasty | 3 | 1-3 |
| **Pearl Slime** `slime_pearl` | normal | 20 | 0.9 | light | – | Regenerating | 3 | 2-1 |
| **Prism Slime** `slime_prism` | normal | 28 | 0.95 | light | – | Splitter | 4 | 2-3 |
| **Violet Slime** `slime_violet` | normal | 16 | 1 | light | – | Veiled | 3 | 3-2 |
| **Iron Slime** `slime_iron` | normal | 22 | 0.9 | light | 2 | Armored | 5 | 4-1 |
| **Rose Slime** `slime_rose` | normal | 20 | 0.95 | light | – | Siphon | 6 | 5-1 |
| **Quartz Slime** `slime_crystal` | normal | 24 | 0.9 | light | – | Crystal Shell | 9 | 6-1 |
| **Ember Slime** `slime_ember` | normal | 18 | 1 | light | – | Volatile | 6 | 6-4 |
| **Mimic Slime** `slime_mimic` | normal | 40 | 0.9 | light | – | Illusionist | 18 | 7-3 |
| **Glimmer Copy** `slime_glimmer` | normal | 6 | 1.2 | light | – | – | 0 | 7-3 |
| **Bubble Slime** `slime_bubble` | normal | 16 | 1 | light | – | Airborne | 9 | 8-1 |
| **Royal Guard Slime** `slime_courtier` | elite | 180 | 0.8 | light | 1 | Armored, Splitter | 18 | 1-5 |
| **Slime Prince** `slime_prince` | miniboss | 2600 | 0.5 | light | – | Splitter, Summoner, Hasty | 280 | 1-5 |

**Green Slime** — The first thing every sentinel ever defeats. It mostly wants to be petted.
*Counter:* Anything works. A single Aoi handles the early waves.

**Slime Droplet** — A tiny blob shaken loose from a bigger slime. It bounces faster than it thinks.
*Counter:* Splash and pierce mop them up; Rei at a corner deletes whole puddles.

**Gold Slime** — Borrowed a goblin's sprint and a little of its greed. Shines brightest mid-dash.
*Counter:* Hasty: Yuki's slow cancels the burst value; keep a second shooter near the exit.

**Pearl Slime** — Grew a lizard's knack for healing while sunning on lakeshore stones.
*Counter:* Regenerating: keep it under steady fire so it never gets 2 quiet seconds. Poison stops it outright.

**Prism Slime** — A rainbow slime that refracts into three droplets when it pops.
*Counter:* Splitter: finish it early on the path, or let splash and pierce catch the droplets.

**Violet Slime** — Soaked in shrine incense until it learned to fade like a ghost.
*Counter:* Veiled: needs Veil Sight — Kage, Hikari, or anyone inside Umeko's aura.

**Iron Slime** — Swallowed an orc helmet and decided it was armor now.
*Counter:* Armored (2): weak chip damage bounces off. Use Shiro's armor pierce or Sango's shells.

**Rose Slime** — Learned to drink from its neighbours by hanging around marsh ghouls.
*Counter:* Siphon: poison it (Midori) or snipe it first with Priority targeting.

**Quartz Slime** — Slept in a Foundry crystal vat and woke up wearing it.
*Counter:* Crystal Shell: many small hits shatter it — Aoi, Kage and Raika love these.

**Ember Slime** — A slime that ate furnace coal. It pops like a firework — right next to your girls.
*Counter:* Volatile: kill it far from your melee girls, or stand them inside a cleanse aura.

**Mimic Slime** — Hides inside a festival prize chest and coughs up fake copies of itself.
*Counter:* Illusionist: rapid multi-hit girls clear the glimmer decoys so your heavy hitters stay on the chest.

**Glimmer Copy** — A shiny fake coughed up by a Mimic Slime. It pops on the first touch.
*Counter:* Decoy: it never costs lives, but it soaks up shots. Rapid hitters clear them.

**Bubble Slime** — Blew itself up like a balloon to follow the wyverns over the peaks.
*Counter:* Airborne: Rei and other ground-only girls can't touch it. Aoi, Yuki and Kage can.

**Royal Guard Slime** — Sworn to the Slime Prince. When it falls, its jelly keeps marching as three green recruits.
*Counter:* Light armor plus a split: steady damage first, then splash or a cleaver for the leftovers.

**Slime Prince** — Heir to the Jelly Throne of Sakura Gardens. He insists the garden is his by right of being very large.
*Counter:* Pile damage on him early. When he pops he becomes three Royal Guards — keep a cleaver or splash near the exit.
* at 66% HP — “The Slime Prince wobbles with rage — Gold Slimes spill from his cape!”
* at 33% HP — “The Prince bounces into a royal sprint!”

## Goblins

*Quick, greedy tinkerers who never walk when they can sprint.* Fast runners. Some throw smoke (veiled), some sabotage girls, some carry bombs.

| Enemy | Tier | HP | Speed | Armor class | Armor | Rules | Bounty | Debut |
|---|---|---|---|---|---|---|---|---|
| **Goblin Runner** `goblin_runner` | normal | 10 | 1.7 | light | – | – | 1 | 1-2 |
| **Goblin Dasher** `goblin_dasher` | normal | 14 | 1.5 | light | – | Hasty | 1 | 1-3 |
| **Smoke Thrower** `goblin_smoke` | normal | 18 | 1.4 | light | – | Veiled | 3 | 3-2 |
| **Goblin Sapper** `goblin_sapper` | normal | 30 | 1.3 | light | – | Sabotage | 11 | 6-3 |
| **Goblin Bomber** `goblin_bomber` | normal | 26 | 1.25 | light | – | Volatile | 9 | 6-4 |
| **Goblin Glider** `goblin_glider` | normal | 20 | 1.5 | light | – | Airborne | 12 | 8-2 |
| **Goblin Chieftain** `goblin_chief` | elite | 240 | 1.2 | light | – | Hasty, Summoner | 90 | 6-5 |
| **Goblin Machine** `goblin_machine` | miniboss | 3000 | 0.5 | heavy | 4 | Armored, Barrier, Summoner | 1300 | 6-5 |

**Goblin Runner** — Steals one sakura petal per run and is extremely proud of it.
*Counter:* Runner: fast and fragile. Place shooters near the start and the end so none slip past.

**Goblin Dasher** — Wears racing goggles it found in a festival lost-and-found. Bursts ahead every few seconds.
*Counter:* Hasty: Yuki's slow and freeze turn the sprint into a stroll.

**Smoke Thrower** — Hurls pots of shrine incense and runs inside the cloud.
*Counter:* Veiled: Kage and Hikari see through smoke; Umeko shares Veil Sight with her neighbours.

**Goblin Sapper** — Jams a wrench into anything that looks important — including your girls' weapons.
*Counter:* Sabotage: Suzu's traps catch sappers before they reach anyone; Hikari's banner cleanses.

**Goblin Bomber** — Carries a powder keg twice its size. Nobody has told it the keg is the dangerous part.
*Counter:* Volatile: pop it at range, away from melee girls, or protect them with a cleanse aura.

**Goblin Glider** — Built wings from paper lanterns and a stolen kite. Somehow it works.
*Counter:* Airborne: needs anti-air — Aoi, Kage, Yuki, Shiro or Nami.

**Goblin Chieftain** — Leads from the front, mostly by running faster than everyone else and yelling for backup.
*Counter:* Hasty summoner: slow it and snipe it with Priority targeting before the runners pile up.

**Goblin Machine** — Forty goblins, one stolen boiler and zero safety inspections. It walks, it shields, it honks.
*Counter:* Break the barrier with blast (Sango, Suzu) then crack the plate with armor pierce. Traps and a cleanse handle the sappers it launches.
* at 60% HP — “Barrier reboot! The Goblin Machine's shield generator roars back to life!”
* at 25% HP — “Overdrive — the Machine vents steam and launches Sappers!”

## Orcs

*Slow, stubborn warriors in heavy iron.* Tanky and armored. Shieldbearers guard the soldiers around them.

| Enemy | Tier | HP | Speed | Armor class | Armor | Rules | Bounty | Debut |
|---|---|---|---|---|---|---|---|---|
| **Orc Grunt** `orc_grunt` | normal | 45 | 0.75 | heavy | – | – | 4 | 1-4 |
| **Ironhide Orc** `orc_ironhide` | normal | 60 | 0.7 | heavy | 3 | Armored | 13 | 4-1 |
| **Orc Shieldbearer** `orc_shieldbearer` | normal | 75 | 0.65 | heavy | – | Guardian | 16 | 4-3 |
| **Orc Berserker** `orc_berserker` | normal | 55 | 0.85 | heavy | – | Pack Fury | 12 | 4-2 |
| **Orc Warlord** `orc_warlord` | elite | 380 | 0.6 | heavy | 5 | Armored, Guardian | 80 | 4-4 |
| **Orc General** `orc_general` | miniboss | 3400 | 0.45 | heavy | 6 | Armored, Guardian, Hasty | 840 | 4-5 |

**Orc Grunt** — A big, patient lump of muscle. Has no armor yet — just a lot of health.
*Counter:* Plain tank: focus fire and upgrade damage. Blast and mystic hit heavy bodies hardest.

**Ironhide Orc** — Bolted iron plates straight onto its skin. Small arrows just ping off.
*Counter:* Armored (3): Shiro pierces it, Sango's shells shred it for everyone. Avoid chip damage.

**Orc Shieldbearer** — Holds a tower shield over its comrades. It does not protect itself, which it finds noble.
*Counter:* Guardian: allies near it take 35% less — except from blast. Shell the formation or snipe the shieldbearer first.

**Orc Berserker** — Paints itself red before battle. Every fallen orc nearby makes it run harder.
*Counter:* Pack Fury: kill the pack evenly with splash, or slow it so the fury doesn't matter.

**Orc Warlord** — A veteran of a hundred sieges with a shield the size of a door.
*Counter:* Armored guardian: armor break (Sango) or Shiro's pierce, then blast the escort while the guard is up.

**Orc General** — Commander of the Ironhold garrison. Believes retreat is a word for other people.
*Counter:* Phase 2 armor 10: only armor pierce and shred matter — stack Shiro and Sango. Phase 3 he sprints: have Yuki ready.
* at 60% HP — “The Orc General plants his tower shield — armor and guard surge!”
* at 30% HP — “The General throws down his shield and charges in a berserk rage!”

## Ghosts

*Lost lantern-lights of the Moonveil Shrine.* Spectral bodies shrug off blades and arrows. Some vanish behind veils, some phase out of reality.

| Enemy | Tier | HP | Speed | Armor class | Armor | Rules | Bounty | Debut |
|---|---|---|---|---|---|---|---|---|
| **Shrine Wisp** `ghost_wisp` | normal | 12 | 1.25 | spectral | – | – | 2 | 3-1 |
| **Veil Wraith** `ghost_veilwraith` | normal | 24 | 1 | spectral | – | Veiled | 4 | 3-1 |
| **Phantom** `ghost_phantom` | normal | 30 | 0.95 | spectral | – | Phasing | 5 | 3-3 |
| **Lantern Bearer** `ghost_lanternbearer` | elite | 220 | 0.75 | spectral | – | Veiled, Summoner | 38 | 3-4 |
| **Hollow Samurai** `ghost_hollowknight` | elite | 260 | 0.7 | spectral | 2 | Armored, Phasing | 46 | 3-5 |

**Shrine Wisp** — A candle flame that forgot to go out. Arrows pass through it like mist.
*Counter:* Spectral: pierce and slash do half damage. Holy (Hikari) and mystic (Yuki) work well.

**Veil Wraith** — Wears the shrine's mourning veil. Unless you can see spirits, it isn't there at all.
*Counter:* Veiled + spectral: Kage spots it, Hikari's holy light burns it.

**Phantom** — Flickers between this world and the next every few heartbeats.
*Counter:* Phasing: while intangible only holy and mystic hits land. A holy hit snaps it back.

**Lantern Bearer** — Carries the lantern that calls lost wisps home — straight down your path.
*Counter:* Veiled summoner: you need Veil Sight to touch it at all. Snipe it with Priority so the wisps stop coming.

**Hollow Samurai** — Empty armor still guarding a shrine that fell long ago.
*Counter:* Armored and phasing: holy damage ignores the phase and hits spirits ×2.

## Ghouls

*Hungry marsh dead that steal life and slip through the fog.* Siphon health from nearby allies or blink forward along the path.

| Enemy | Tier | HP | Speed | Armor class | Armor | Rules | Bounty | Debut |
|---|---|---|---|---|---|---|---|---|
| **Bonewalker** `ghoul_bonewalker` | normal | 22 | 0.9 | spectral | – | – | 6 | 5-1 |
| **Bog Shambler** `ghoul_shambler` | normal | 50 | 0.8 | spectral | – | – | 14 | 5-1 |
| **Leech Ghoul** `ghoul_leech` | normal | 45 | 0.85 | spectral | – | Siphon | 13 | 5-1 |
| **Fog Skulker** `ghoul_skulker` | normal | 35 | 0.9 | spectral | – | Blink | 10 | 5-2 |
| **Grave Priest** `ghoul_gravepriest` | elite | 320 | 0.7 | spectral | – | Siphon, Summoner | 90 | 5-4 |
| **Grave Lych** `grave_lych` | boss | 12000 | 0.4 | spectral | 3 | Armored, Regenerating, Summoner, Phasing | 2000 | boss-lych |

**Bonewalker** — Rattles out of the bog whenever something important calls.
*Counter:* Plain spectral fodder: mystic and holy hit it fully.

**Bog Shambler** — A marsh-soaked ghoul that keeps walking because nobody told it to stop.
*Counter:* Plain but spectral: bring mystic or holy damage; pierce does half.

**Leech Ghoul** — Drinks the life out of whatever walks beside it, friend or not.
*Counter:* Siphon: Midori's poison stops the healing; Priority targeting removes it first.

**Fog Skulker** — Steps into the fog and out again three tiles later. Watch for the green mark.
*Counter:* Blink: a slow, stun or silence during the warning cancels the jump.

**Grave Priest** — Chants the marsh dead awake and feeds on them as they rise.
*Counter:* Siphoning summoner: poison it (no healing) and kill it with Priority before its congregation grows.

**Grave Lych** — Lord of the Gloomfen dead, crowned in candle-wax. It has been dying for three hundred years and is very good at it.
*Counter:* Poison (Midori) shuts down its regeneration and its leeches; holy hits snap it out of phasing. Keep splash for the summons.
* at 70% HP — “The Grave Lych slips between worlds — it begins to phase!”
* at 40% HP — “The Lych calls the Leech Ghouls to feed it!”
* at 15% HP — “Its phylactery cracks — the Lych lurches for the exit!”

## Oni

*Festival demons who empower everyone around them.* Project haste, shield or regen fields. Holy hits silence the field for a moment.

| Enemy | Tier | HP | Speed | Armor class | Armor | Rules | Bounty | Debut |
|---|---|---|---|---|---|---|---|---|
| **Oni Brute** `oni_brute` | normal | 70 | 0.75 | warded | – | – | 32 | 7-1 |
| **Wind Oni** `oni_haste` | normal | 60 | 0.85 | warded | – | Field Caster | 28 | 7-1 |
| **Ward Oni** `oni_shield` | normal | 65 | 0.75 | warded | – | Field Caster | 30 | 7-2 |
| **Bloom Oni** `oni_bloom` | normal | 60 | 0.8 | warded | – | Field Caster | 28 | 7-4 |
| **Taiko Oni** `oni_taiko` | elite | 340 | 0.65 | warded | 2 | Armored, Field Caster | 160 | 7-4 |
| **Oni Champion** `oni_champion` | miniboss | 3200 | 0.5 | warded | 3 | Armored, Field Caster | 1840 | 7-5 |

**Oni Brute** — Came for the festival food, stayed for the fighting.
*Counter:* Warded: mystic does half. Pierce, slash, blast and holy all work.

**Wind Oni** — Fans a festival wind that sends everyone nearby racing ahead.
*Counter:* Haste field: snipe the caster with Priority, or silence it with a holy hit.

**Ward Oni** — Its mask hums with a barrier that blunts every blow on its friends.
*Counter:* Shield field (35% less damage nearby): kill the caster first — holy hits switch the field off.

**Bloom Oni** — Scatters festival petals that knit wounds closed.
*Counter:* Regen field: poison blocks the healing; holy hits silence it.

**Taiko Oni** — Beats the festival drum so loudly the whole parade breaks into a run.
*Counter:* Armored haste caster: Shiro on Priority, or a holy silence, before the parade outruns you.

**Oni Champion** — Undefeated grand champion of the Oni Festival tournament. Has never lost a staring contest.
*Counter:* Holy hits silence each stance — Hikari next to the path is gold. Poison its regen stance; slow its haste stance.
* at 75% HP — “The Oni Champion switches stance — a Shield field flares!”
* at 50% HP — “Bloom stance — the Champion's field begins to heal its escort!”
* at 25% HP — “Final stance — the Champion rotates Haste and Shield every few seconds!”

## Lizardfolk

*Scaled lakeshore hunters, at home in reeds and shallow water.* Scaled hides (pierce finds the gaps). Hunters regenerate; sunscales shrug off fire.

| Enemy | Tier | HP | Speed | Armor class | Armor | Rules | Bounty | Debut |
|---|---|---|---|---|---|---|---|---|
| **Reed Skink** `lizard_skink` | normal | 22 | 1.25 | scaled | – | – | 3 | 2-1 |
| **Marsh Hunter** `lizard_hunter` | normal | 40 | 0.95 | scaled | – | Regenerating | 6 | 2-2 |
| **Sunscale Warrior** `lizard_sunscale` | normal | 50 | 0.9 | scaled | – | Elemental Ward | 7 | 2-4 |
| **Bog Basilisk** `lizard_basilisk` | elite | 300 | 0.7 | scaled | 3 | Armored, Regenerating | 42 | 2-5 |

**Reed Skink** — A young lakeshore scout, all tail and enthusiasm.
*Counter:* Scaled: pierce (Aoi, Kage) finds the gaps for ×1.5; slash only ×0.75.

**Marsh Hunter** — Wounds close over in seconds — a gift from the lake spirits, it says.
*Counter:* Regenerating: concentrate fire so it never rests. Later, Midori's poison stops it cold.

**Sunscale Warrior** — Basks on hot rocks until fire feels like a warm bath.
*Counter:* Fire Ward: burns barely tickle it. Use pierce, frost or water shells instead.

**Bog Basilisk** — An ancient lake beast with stone-hard scales that slowly regrow.
*Counter:* Armored and regenerating: Sango's shells crack the scales; keep it under constant fire.

## Constructs

*Clockwork and crystal machines from the Foundry.* Heavy bodies with crystal shells (cap damage per hit) or barriers (break with blast).

| Enemy | Tier | HP | Speed | Armor class | Armor | Rules | Bounty | Debut |
|---|---|---|---|---|---|---|---|---|
| **Cogling** `construct_cogling` | normal | 35 | 1.05 | heavy | – | – | 13 | 6-1 |
| **Shellback** `construct_shellback` | normal | 50 | 0.8 | heavy | – | Crystal Shell | 18 | 6-1 |
| **Aegis Automaton** `construct_aegis` | normal | 50 | 0.8 | heavy | – | Barrier | 18 | 6-2 |
| **Iron Sentry** `construct_sentry` | normal | 70 | 0.7 | heavy | 4 | Armored | 25 | 6-3 |
| **Prism Warden** `construct_warden` | elite | 300 | 0.6 | heavy | – | Barrier, Crystal Shell | 110 | 6-4 |
| **Iron Colossus** `iron_colossus` | boss | 14000 | 0.35 | heavy | 6 | Armored, Crystal Shell | 2500 | boss-colossus |

**Cogling** — A wind-up helper that wandered off the assembly line.
*Counter:* Heavy body: blast and mystic deal extra; slash bounces off.

**Shellback** — A clockwork beetle under a quartz dome. Big hits just bounce.
*Counter:* Crystal Shell (max 5 per hit for 10 hits): rapid hitters shatter it, then heavy hitters finish.

**Aegis Automaton** — Projects a humming energy dome that recharges if you stop hitting it.
*Counter:* Barrier: blast deals +50% to it — Sango, Suzu, Akane. Keep the pressure on so it can't recharge.

**Iron Sentry** — A walking foundry door. Armor 4 means small hits do just 1 damage.
*Counter:* Armored (4): armor pierce and shred, or big blast shells.

**Prism Warden** — Foundry guardian wrapped in a barrier and, under that, a crystal shell.
*Counter:* Barrier then shell: blast first, then many quick hits.

**Iron Colossus** — The Foundry's masterpiece: a walking furnace sheathed in living crystal. It regrows its shell under pressure.
*Counter:* Every phase brings a fresh shell — keep rapid hitters (Aoi, Kage, Raika) on it, and armor shred for the plate underneath.
* at 70% HP — “The Colossus grows a new crystal plate!”
* at 40% HP — “Furnace surge — thicker crystal and hardened plate!”
* at 15% HP — “The shell shatters — its core is exposed and it stomps forward!”

## Beasts

*Mountain wildlife driven mad by the dragon smoke.* Wolves grow furious as packmates fall; boars charge in bursts.

| Enemy | Tier | HP | Speed | Armor class | Armor | Rules | Bounty | Debut |
|---|---|---|---|---|---|---|---|---|
| **Dusk Wolf** `beast_wolf` | normal | 26 | 1.3 | light | – | Pack Fury | 6 | 4-2 |
| **Boar Charger** `beast_boar` | normal | 40 | 1 | light | – | Hasty | 4 | 1-4 |
| **Moss Bear** `beast_bear` | normal | 110 | 0.65 | light | – | – | 24 | 4-2 |
| **Alpha Wolf** `beast_alpha` | elite | 260 | 1.15 | light | – | Pack Fury, Summoner | 60 | 4-4 |

**Dusk Wolf** — Hunts in packs. Each lost packmate makes the others run harder.
*Counter:* Pack Fury: kill the pack together with splash or slow them down.

**Boar Charger** — Lowers its tusks and charges every few seconds, for no reason at all.
*Counter:* Hasty: slows blunt the charge; traps near the exit catch it mid-sprint.

**Moss Bear** — Slept for a hundred years and woke up grumpy. Just a lot of health.
*Counter:* Plain tank on a light body: slash and pierce shred it.

**Alpha Wolf** — Its howl calls the pack from every ridge in Ironhold.
*Counter:* Summoner with Pack Fury: snipe it first, then let splash handle the pack.

## Fae

*Mischievous festival spirits wrapped in glamour.* Warded against mystic magic. Illusionists spawn decoys that soak up shots.

| Enemy | Tier | HP | Speed | Armor class | Armor | Rules | Bounty | Debut |
|---|---|---|---|---|---|---|---|---|
| **Lantern Sprite** `fae_sprite` | normal | 14 | 1.5 | warded | – | – | 6 | 7-3 |
| **Mirage** `fae_mirage` | normal | 6 | 1.2 | warded | – | – | 0 | 7-3 |
| **Fae Illusionist** `fae_illusionist` | normal | 45 | 0.9 | warded | – | Illusionist | 21 | 7-3 |
| **Wind Sylph** `fae_sylph` | normal | 30 | 1.2 | warded | – | Airborne | 17 | 8-2 |
| **Mirror Queen** `fae_queen` | elite | 280 | 0.8 | warded | – | Veiled, Illusionist | 130 | 7-4 |

**Lantern Sprite** — A giggling festival sprite that skips along the lantern strings.
*Counter:* Warded runner: mystic is halved. Aoi and Kage handle them well.

**Mirage** — A shimmering copy that pops on the first touch.
*Counter:* Decoy: it never costs lives, but it soaks up shots. Rapid multi-hit girls clear them.

**Fae Illusionist** — Throws mirror-copies of itself ahead to soak up your shots.
*Counter:* Illusionist: multi-hit girls (Kage, Raika, Rei) pop the mirages; Shiro on Priority ignores them.

**Wind Sylph** — Rides the updrafts over Ashwing Peaks.
*Counter:* Airborne: anti-air only. Pierce hits its ward fully.

**Mirror Queen** — Queen of the festival glamour. You see her mirages long before you see her.
*Counter:* Veiled illusionist: Veil Sight to target her, multi-hit for the mirages.

## Plants

*Bog flora that walked out of the Gloomfen.* Seed pods burst into sprouts, thornroots wear bark armor, mosslings regrow.

| Enemy | Tier | HP | Speed | Armor class | Armor | Rules | Bounty | Debut |
|---|---|---|---|---|---|---|---|---|
| **Bog Sprout** `plant_sprout` | normal | 8 | 1.35 | light | – | – | 0 | 5-2 |
| **Seed Pod** `plant_seedpod` | normal | 40 | 0.75 | light | – | Brood | 11 | 5-2 |
| **Thornroot** `plant_thornroot` | normal | 55 | 0.7 | light | 3 | Armored | 15 | 5-3 |
| **Mossling** `plant_mossling` | normal | 35 | 0.9 | light | – | Regenerating | 10 | 5-3 |
| **Elder Treant** `plant_treant` | elite | 400 | 0.5 | light | 3 | Armored, Brood | 110 | 5-4 |

**Bog Sprout** — Hops out of a burst seed pod and runs for it.
*Counter:* Swarm: splash or a cleaver near the pods.

**Seed Pod** — A walking seed pod that bursts into four sprouts.
*Counter:* Brood: kill pods early on the path so the sprouts have far to run, with splash waiting.

**Thornroot** — Bark as tough as plate — but bark burns and splits.
*Counter:* Armored (3) on a light body: slash with armor pierce, or shred it.

**Mossling** — Regrows anything you chop off, given two quiet seconds.
*Counter:* Regenerating: poison stops it; steady fire works too.

**Elder Treant** — The oldest willow in the fen, walking at last. Seed pods fall when it does.
*Counter:* Armored brood: break the bark, and keep splash behind it for the pods and sprouts.

## Dragons

*The brood of the Ashwing Matriarch.* Scaled and often airborne. Fire-warded ashdrakes laugh at burns.

| Enemy | Tier | HP | Speed | Armor class | Armor | Rules | Bounty | Debut |
|---|---|---|---|---|---|---|---|---|
| **Ash Wyvern** `dragon_wyvern` | normal | 60 | 1.1 | scaled | – | Airborne | 35 | 8-1 |
| **Ashdrake** `dragon_ashdrake` | normal | 90 | 0.8 | scaled | – | Elemental Ward | 50 | 8-3 |
| **Cinder Wyvern** `dragon_cinder` | elite | 360 | 0.95 | scaled | – | Airborne, Elemental Ward | 210 | 8-4 |
| **Ashwing Matriarch** `dragon_ashwing` | boss | 12000 | 0.4 | scaled | 4 | Armored, Elemental Ward, Airborne, Summoner | 3000 | 8-5 |

**Ash Wyvern** — A young wyvern circling the peaks, scouting for its Matriarch.
*Counter:* Airborne: Rei, Akane and Sango can't reach it without upgrades. Aoi, Kage and Shiro's pierce hit scales ×1.5.

**Ashdrake** — A wingless drake that wallows in lava. Fire just makes it comfortable.
*Counter:* Fire Ward: Akane's burns are halved. Frost, pierce and mystic hit it fully.

**Cinder Wyvern** — An elder of the brood with embers in its wings.
*Counter:* Airborne and fire-warded: anti-air pierce (Shiro, Aoi, Kage) or frost.

**Ashwing Matriarch** — Mother of every dragon on the peaks. Her wingbeat scatters ash across three valleys.
*Counter:* Bring anti-air for her flights, armor break for her landing, and never rely on fire. Pierce hits her scales ×1.5.
* at 75% HP — “The Ashwing Matriarch takes to the sky — her wyverns answer the call!”
* at 45% HP — “She lands in a storm of cinders — her scales harden!”
* at 20% HP — “Final flight! The Matriarch soars for the exit with her elders!”
