# Sakura Sentinels — Roster

Source of truth: `src/data/units.js` (validated by `tests/data/units.test.js`). This page is the
human-readable summary: who every girl is, what she is for, how the roster covers every enemy
mechanic, and what is still missing.

* **19 characters** — 3 adult **heroes** (one per battle, they level up 1→10 during the fight and
  have an ultimate) and 16 academy **students** who serve as towers.
* Every girl has a Blue Archive–style halo, a material family for breakthrough, 3 upgrade paths × 5
  tiers (BTD6 crosspathing: two paths max, only one above tier 2) and an awakening passive (★3+).
* Heroes are grown-up guardians with glamorous, elegant designs; the students stay cute, cool and
  wholesome (see CONTRACTS.md §0).
* Every girl, free ones included, is also in the gacha pool of her rarity (duplicates → Star Fragments).

Type chart reminder (attack → armor): **Blast** ×1.5 heavy, ×0.5 spectral · **Pierce** ×1.5 scaled,
×1.25 light, ×0.75 heavy · **Slash** ×1.5 light, ×0.6 heavy · **Mystic** ×1.25 heavy/scaled,
×0.5 warded · **Holy** ×2 spectral, ×1.25 warded, ×0.75 scaled.

## The roster

| Girl | Kind · Rarity | Role | Type | Element | Placement | How to obtain | What she does | Best against | Weak against |
|---|---|---|---|---|---|---|---|---|---|
| **Hikari** — Dawnblade Captain | Hero · SSR | Vanguard | Holy | – | Land | Starter | Melee holy cleaves (3 targets) with **Veil Sight from the start**. Ult *Celestial Bloom*: 160 holy nova, stun, reveals veils 8 s. | Spirits, veiled waves, mixed crowds on corners | Flyers (until Lightbringer 3), scaled lizards (holy ×0.75) |
| **Luna** — Moonlit Archmage | Hero · SSR | Mystic | Mystic | – | Land | Gacha | Three piercing moon beams. Ult *Moonfall*: slows every enemy 50 % and speeds every girl +30 %. | Armored & scaled columns on long straights | Warded fae/oni (mystic ×0.5), lone fast targets |
| **Nami** — Tideguard Commodore | Hero · SR | Tideguard | Mystic | Frost | **Water** | Free after 1-5 | Frost strikes from the water that splash and slow. Ult *Tidal Wave*: 70 damage, pushes the wave back 5 tiles. | Runners near lakes, leaks, crowd pushback | Maps with no water, warded foes |
| **Aoi** — Sky Archer | Tower · R | Marksman | Pierce | – | Land | Starter | Cheap, fast arrows. Paths: pierce/armor, multi-shot + Veil Sight, elite marking. | Ordinary enemies, runners, **crystal shells**, flyers, scaled | Heavy plate (pierce ×0.75, small hits vs armor) |
| **Rei** — Crescent Cleaver | Tower · R | Cleaver | Slash | – | Land | Starter | Melee sweep hitting 3+ enemies; Duelist Stance (T4) turns her into a ramping single-target fighter. | Light swarms at corners, splitters, decoys | Plate (slash ×0.6), spirits, **cannot hit flyers** |
| **Yuki** — Snowdrift Mage | Tower · R | Controller | Mystic | Frost | Land | Free after 1-2 | Splashing snowballs that slow 30 %; paths add freezes, Brittle (+damage taken) or long-lasting slows. | Hasty goblins, blinkers, pack-fury wolves, leaks | Bosses (resist freezes), warded foes; low damage |
| **Momo** — Peach Merchant | Tower · R | Economy | Pierce | – | Land | Gacha | +30 coins every wave; paths add big income, interest + upgrade discounts, or a real coin-toss attack. | Funding a stronger late game | Early pressure — she barely defends |
| **Akane** — Firework Demolitionist | Tower · SR | Bombardment | Blast | Fire | Land | Gacha | Fireballs with 1-tile explosions and burns. | Dense swarms, broods, splitters, guarded formations | Fire-warded lizards/dragons, spirits, flyers (until T4/T5) |
| **Sango** — Coral Battery | Tower · SR | Artillery | Blast | Water | **Water** | Free after 1-5 | Long-range shells (4.2 tiles) that soak, hit barriers ×1.25 and (path 1) **shred armor for everyone**. | Armored formations, barriers, guardians | Scattered runners, spirits (blast ×0.5), flyers (until flak T4) |
| **Kage** — Shadow Courier | Tower · SR | Skirmisher | Pierce | – | Land | Free after 2-5 | Two shuriken at a time, very fast, **innate Veil Sight**; paths reveal/mark for the team or pierce armor. | Veiled, fast or scattered enemies, crystal, decoys | Heavy armor (tiny hits) |
| **Umeko** — Lantern-Float Lookout | Tower · SR | Support | Mystic | Water | **Water** | Free after 3-2 | **Veil Sight aura** for every girl within 2.6 tiles; weak soaking pulse. Paths: team reveal, buffs, water control. | Veiled waves (makes the whole team see) | Can't defend alone; needs water near the action |
| **Shiro** — Silent Overwatch | Tower · SR | Sniper | Pierce | – | Land | Free after 3-5 | Map-wide (10 tiles) hitscan rifle that **ignores 3 armor**, ×1.25 vs elites. | Casters, siphoners, field oni, elites, bosses, armor | Swarms (one target per shot), slow fire rate |
| **Midori** — Verdant Apothecary | Tower · SR | Alchemist | Mystic | Poison | Land | Free after 4-5 | Splashing flasks of poison that ignore armor and **stop regen & siphon healing**; paths add acid shred or mist. | Regenerators, siphoning ghouls, high-HP tanks | Burst-needed moments, flyers (until Field Kit 3) |
| **Suzu** — Bell Seal Trapper | Tower · SR | Trapper | Blast | – | Land | Free after 5-5 | Places up to 4 rune traps on the path in range; paths: big mines, binding roots, holy reveal/silence seals. | Leakers near the exit, **sappers**, hasty runners | Flyers (traps are on the ground), needs set-up time |
| **Raika** — Thunderdrum Prodigy | Tower · SR | Chain | Mystic | Lightning | Land | Gacha | Lightning that jumps to 3 extra enemies with shock; paths: more jumps, a piercing lance, or tempo + silence. | Spread-out groups, decoys, soaked enemies | Lone targets, warded foes |
| **Miko** — Shrine Blessing Keeper | Tower · SR | Enchanter | Holy | – | Land | Gacha | **+10 % damage aura**; paths: stronger aura, silencing talismans/holy beam, Veil Sight + cleanse aura. | Making a cluster of girls stronger | Defending alone |
| **Hotaru** — Firefly Exorcist | Tower · SSR | Exorcist | Holy | – | Land | Gacha | Holy pulses (8 targets) that **reveal veils and silence** fields, siphons, blinks and phasing. | Ghosts, wraiths, veils, oni field casters | Scaled lizards (holy ×0.75); specialist, not a carry |
| **Kaede** — Crimson Maple Duelist | Tower · SSR | Duelist | Slash | – | Land | Gacha | Rapier duel: +10 % damage per consecutive hit on one target (up to +80 % base). | One tough enemy: elites, minibosses, bosses | Swarms, plate (slash ×0.6), flyers (until Flowing Blade 3) |
| **Chika** — Gadget Prodigy | Tower · SSR | Engineer | Pierce | Lightning | Land | Gacha | Builds sentry drones (2 at base); paths: drone army, **cleanse + Veil Sight aura**, or a Tesla coil. | Sabotage waves, long straights | Burst moments before drones are built |

## Upgrade paths at a glance

Tier 3 is where a path changes how she plays; tier 5 is the dramatic finale (7 000–16 000 coins).

| Girl | Path 1 → T5 | Path 2 → T5 | Path 3 → T5 |
|---|---|---|---|
| Hikari | Radiant Edge → *Noon Absolute* (huge cleave) | Sanctuary → *Dawn Sanctuary* (Veil Sight + silence + cleanse aura) | Lightbringer → *Celestial Choir* (anti-air light lances) |
| Luna | Lunar Lances → *Lunatic Lance* (5 beams) | Night Gravity → *Event Horizon* (freeze, Brittle) | Astral Court → *Queen of the Night Sky* (team aura) |
| Nami | Frostbrand → *Absolute Zero Tide* (freezes) | Undertow → *Leviathan's Wake* (push-back) | Harbor Watch → *Admiral of the Tides* (fleet aura, discounts) |
| Aoi | Piercing Arrows → *Skyline Breaker* (armor pen, pierce 17) | Rapid Volley → *Thousand Feathers* (6 targets, Veil Sight) | Sky Hunter → *Apex Huntress* (mark, elite/boss hunter) |
| Rei | Whirlwind → *Thousand Petal Storm* (hit everything) | Duelist Stance → *Final Crescent* (becomes `duel`) | Counter Form → *Kenshi's Answer* (silence, stun, shred) |
| Yuki | Deep Freeze → *Eternal Winter* (becomes a blizzard `pulse`) | Frostbite → *Diamond Dust* (Brittle +35 %) | Permafrost → *Frozen Time* (long slows, silence) |
| Momo | Peach Orchard → *Golden Peach Bank* (+1 390/wave total) | Savings Pact → *Golden Ledger* (interest, 25 % discount aura) | Coin Toss → *Fortune's Favourite* (coin storm) |
| Akane | Big Bang → *Hanabi Sky Festival* (5 shells, anti-air) | Wildfire → *Inferno Queen* (25/s burns) | Rocket Science → *Skybreaker Missile* (armor/boss/barrier) |
| Sango | Armor-Breaker Shells → *Fortress Fall* (shred −5, Brittle) | Wide Fragmentation → *Carpet Bombardment* (flak, 4 shells) | Concentrated Siege → *Leviathan Cannon* (boss shells, knockback) |
| Kage | Storm of Steel → *Thousand Shadows* (13 targets) | Shadow Mark → *Night Sovereign* (team reveal + mark) | Kunai Craft → *Black Lotus* (armor pen, stun) |
| Umeko | Lighthouse → *Sea of Lanterns* (6-tile Veil Sight, team reveal) | Plum Rain → *Blooming Ocean* (damage/speed aura) | Undertow Ripples → *Tidal Sanctuary* (slow + push-back) |
| Shiro | Execution → *Cross-Map Execution* (huge shots, stagger) | Spotter's Mark → *Overwatch Network* (+40 % mark, Veil Sight aura) | Follow-up Shots → *Silver Storm* (4 targets, fast) |
| Midori | Toxicology → *Verdant Apocalypse* (40/s poison) | Corrosion → *Universal Solvent* (shred −5, Brittle) | Field Kit → *Elixir Barrage* (anti-air mist, stun spores) |
| Suzu | Explosive Mines → *Grand Bell Detonation* | Binding Traps → *Thousand Bell Prison* (freeze traps) | Spirit Seals → *Great Barrier Seal* (holy, reveal, silence) |
| Raika | Forked Lightning → *Raijin's Wrath* (2 bolts × 21 jumps) | Overcharge → *Heaven's Drum* (becomes a `beam` lance) | Storm Rhythm → *Endless Thunder* (tempo + silence) |
| Miko | Blessing → *Goddess's Festival* (+20 % dmg aura) | Purification → *Amaterasu's Mirror* (becomes a holy `beam`) | Sacred Grounds → *Heavenly Shrine* (Veil Sight, cleanse, discounts) |
| Hotaru | Lantern Light → *Thousand Souls Festival* (holy nuke) | Silent Prayer → *Absolute Stillness* (long silence, stun) | Guiding Lights → *Night of Fireflies* (aura, cleanse) |
| Kaede | Unbroken Rhythm → *Crimson Eternity* (ramp +250 %) | Flowing Blade → *Thousand Leaves Draw* (anti-air, crits) | Guard Breaker → *Heaven-Splitting Strike* (shred, stun) |
| Chika | Sentry Works → *Mecha-Fortress Protocol* (9 drones) | Repair Bay → *Grand Workshop* (cleanse, Veil Sight, buffs) | Tesla Engineering → *Thunderforge Reactor* (becomes a `chain` coil) |

## Looks (for art & models)

Every girl differs in hair colour and in her hairstyle + accessory combination (enforced by tests).

| Girl | Hair | Hairstyle · bangs | Accessory | Outfit | Weapon | Halo | Eyes · expression |
|---|---|---|---|---|---|---|---|
| Hikari | sunlit gold | long · swept | golden circlet (crown) | white-gold knight's greatcoat over half-plate | longsword | crown | sharp · smile |
| Luna | lavender silver | hime · hime | wide star-stitched witch hat | flowing midnight gown-robe with constellations | floating grimoire | moon | sleepy (half-lidded) · smug |
| Nami | teal | wavy · split | sea-blossom | fitted navy greatcoat, gold epaulettes | gilded trident | wave | sharp · calm |
| Aoi | sky blue | ponytail · swept | feather hairpin | sailor uniform, pink scarf | bow | ring | round · cheerful |
| Rei | ink navy | short · messy | red hachimaki | blazer, rolled sleeves | oversized nodachi (katana) | star | sharp · determined |
| Yuki | icy pale blue | bob · straight | fluffy hood | hooded winter dress | snow staff | snow | sleepy · shy |
| Momo | peach pink | buns · straight | bunny-ear headband | frilly shop apron | coin purse | star | sparkle · cheerful |
| Akane | scarlet | twintails · swept | little ember horns | orange demolition jumpsuit | steel war-fan | flame | sharp · smug |
| Sango | coral | side ponytail · swept | diving goggles | navy-trimmed sailor uniform | shoulder cannon | wave | round · determined |
| Kage | charcoal violet | short · messy | cat-ear hood | oversized dark hoodie | shuriken | moon | sharp · smug |
| Umeko | plum | side ponytail · hime | plum blossoms | pale-blue summer dress | lantern parasol | petal | sleepy · smile |
| Shiro | silver white | long · straight | navy beret | military-cut blazer | long rifle | eye (scope) | sleepy · calm |
| Midori | mint green | braids · split | brass lab goggles | stained alchemist apron | flask | leaf | round · smug |
| Suzu | fox orange | twintails · straight | fox ears with bells | red-and-white kimono | bell | ring | sparkle · cheerful |
| Raika | electric yellow | buns · messy | bolt hairpin | dark hoodie, glowing trim | lightning-rod staff | bolt | sparkle · cheerful |
| Miko | black | hime · hime | big red-and-white ribbon | miko robes | gohei | petal | closed · calm |
| Hotaru | midnight blue, glowing tips | wavy · split | sheer veil-hood | white ceremonial robe | firefly lantern | ring | round · calm |
| Kaede | burgundy | high ponytail · split | maple-orange ribbon | long black duelist's coat | rapier | leaf (maple) | sharp · determined |
| Chika | chestnut | bob · messy | workshop goggles | sunflower-yellow jumpsuit | giant wrench | gear | sparkle · smile |

## Coverage — every enemy mechanic and its counters

"Free" = starter or free unlock (with the stage that grants her); "path" = needs that upgrade path.
Every capability the stage `recommended` list can ask for has at least one free owner (enforced by tests).

| Mechanic (trait) | Counter capability | Free counters | Gacha counters | Notes |
|---|---|---|---|---|
| **Hasty** (goblin runners, boar) | slow, trap | Yuki (1-2) slow; Nami (1-5) slow; Suzu (5-5) traps; Umeko Ripples path | Luna Night Gravity path | Yuki arrives one stage before the first runners. |
| **Splitter / Brood** (prism slimes, seed pods) | splash / multi-target | Rei cleave; Sango splash; Nami splash; Aoi Piercing path | Akane (best), Raika chain | Kill children in the same splash. |
| **Water deploy** (lake maps) | water | Nami, Sango (1-5); Umeko (3-2) | – | Chapter 2 teaches water placement. |
| **Regen** (marsh lizards, Grave Lych) | antiHeal | Midori (4-5) | – | Before Midori: keep regenerators under constant fire (regen waits for a damage-free delay). |
| **Veiled** (violet slimes, smoke goblins, Veil Wraith) | detection, reveal | Hikari (starter); Kage (2-5); Umeko (3-2) aura; Aoi Volley 3; Shiro Spotter 3; Suzu Seals 3; reveal: Kage/Umeko/Shiro/Suzu/Hikari paths | Hotaru (detection + reveal); Miko/Chika aura paths; Luna Court path | Umeko shares Veil Sight with every girl in her aura. |
| **Phasing / spectral** (ghosts) | silence; Holy & Mystic land | Hikari holy; Yuki/Nami/Umeko mystic; silence via Hikari Sanctuary 3, Rei Counter 3, Yuki Permafrost 3, Umeko Lighthouse 5, Suzu Seals 4 | Hotaru (holy ×2 + silence), Miko Purification 3, Raika Rhythm 3 | Holy hits also stop phasing. |
| **Armored** (ironhide orcs, thornroots) | armorPen, armorShred | Shiro (3-5) base pen 3; Sango Breaker path (shred for everyone); Midori Corrosion; Rei Counter 4; Yuki Frostbite 4; pen paths on Aoi, Kage, Hikari, Nami | Kaede Guard Breaker, Akane Rocket Science, Raika Overcharge, Luna Lances | Blast ×1.5 and mystic ×1.25 vs heavy; slash/pierce suffer. |
| **Guardian** (shieldbearers) | armorShred; blast ignores guard | Sango (blast), Suzu mines (blast), shred paths above | Akane (blast) | Bombardment cracks the formation, then precision. |
| **Siphon** (ghouls) | antiHeal, priority, silence | Midori poison; Shiro priority; silence paths (Rei, Yuki, Hikari) | Hotaru, Raika Rhythm, Kaede priority | Poison blocks siphon healing outright. |
| **Blink** (ghoul stalkers) | slow, stun, silence | Yuki slow/freeze; Rei Counter (silence + stun); Nami slow | Hotaru silence; Raika shock/silence | Slows and stuns interrupt the blink. |
| **Crystal shell** (crystal slimes, constructs) | multiHit | Aoi (fast arrows), Kage (2 shuriken × 2/s), Rei (multi-target sweeps) | Raika (chain hits), Chika drones | Many small hits beat the per-hit cap. |
| **Barrier** (constructs, Iron Colossus) | barrierBreak | Sango (×1.25, Breaker 4 ×1.5 more); Suzu Blast Mines; Midori Universal Solvent | Akane Skybreaker Missile | Blast already deals +50 % to barriers. |
| **Sabotage** (goblin sappers) | cleanse, trap | Suzu (5-5) traps catch sappers; Hikari Dawn Sanctuary (cleanse) | Chika Repair Bay 3 (cleanse), Miko Sacred Grounds 4, Hotaru Guiding Lights 4 | Traps near the entrance stop sappers before they reach girls. |
| **Field** (oni haste/shield/regen, Oni Champion) | silence, priority | Shiro (priority, kill the caster); silence paths (Hikari, Rei, Yuki, Umeko, Suzu) | Hotaru (base silence 1 s), Raika, Miko | Holy hits silence fields. |
| **Decoy** (fae illusionists) | multiHit | Aoi Volley, Kage, Rei | Raika, Chika | Decoys soak single shots; multi-hit strips them. |
| **Warded** (fae, oni) | non-mystic damage | Aoi/Kage/Shiro (pierce), Rei (slash), Sango/Suzu (blast), Hikari (holy ×1.25) | Hotaru/Miko (holy), Kaede, Akane | Mystic is halved — Luna, Yuki, Raika, Midori, Umeko suffer. |
| **Elemental ward** (sunscale lizards = fire, Ashwing = fire) | use another element | Everyone except fire; Yuki/Nami frost | Raika lightning | Akane's burns are halved and blocked. |
| **Airborne** (wyverns, Ashwing phases) | antiAir | Aoi, Kage, Shiro, Yuki, Nami, Umeko; Hikari Lightbringer 3; Sango Flak 4; Midori Mist 3 | Luna, Raika, Miko, Hotaru, Chika, Momo; Akane T4/T5; Kaede Flowing Blade 3 | Melee, traps and lobbed shells cannot hit flyers at base. |
| **Enrage** (wolf packs) | slow | Yuki, Nami | Luna gravity | Kill the pack evenly; slows blunt the fury. |
| **Summoner** (Grave Lych, Ashwing) | priority | Shiro (Priority mode, elite bonus); Aoi/Kage mark paths | Kaede, Hotaru | Remove the summoner first. |
| **Volatile** (ember slimes) | range | Shiro (10 tiles), Sango (4.2 tiles) | Luna beams | Death blasts stun nearby girls — keep melee off the path where they die. |
| **Elites / minibosses / bosses** | priority, eliteMul/bossMul | Shiro Execution; Aoi Sky Hunter; Sango Siege; Rei Duelist Stance | Kaede (best), Raika Overcharge | Mark/Brittle (Shiro, Yuki, Sango, Midori) multiplies everyone's damage. |

### Free-unlock timeline (one stage before the mechanic)

| Clear | Joins | Prepares you for |
|---|---|---|
| start | Hikari (hero), Aoi, Rei | basics; Hikari already sees veils |
| 1-2 | Yuki | hasty goblins (1-3+) |
| 1-5 | Nami (hero), Sango | Chapter 2 lake maps (water placement), armor/barrier later |
| 2-5 | Kage | Chapter 3 veiled enemies |
| 3-2 | Umeko | thicker veils at the shrine (team Veil Sight) |
| 3-5 | Shiro | Chapter 4 armored orcs & shieldbearers |
| 4-5 | Midori | Chapter 5 regen/siphon ghouls & plants |
| 5-5 | Suzu | Chapter 6 sappers (sabotage) |

## Future roster gaps

1. **No free cleanse until Hikari's tier 5** — F2P players beat sabotage with Suzu's traps only.
   A cheaper free cleanse (or a Chapter 6 free support) would make Foundry stages kinder.
2. **Only one anti-heal girl (Midori).** A second (gacha "curse" caster or anti-heal burns) would give
   Gloomfen/Lych teams options.
3. **No amphibious unit** — `amphibious` placement exists but nobody uses it. Idea: a frog-hood
   scout who can stand on land or water.
4. **No dedicated anti-air specialist** (BTD6 Heli/Ace-style). Chapter 8 relies on generalists;
   a kite-rider or wind archer would give the dragon arc a signature counter.
5. **Only three heroes, all mystic/holy.** No fire/lightning hero, no support/economy hero, and both
   mystic heroes lose half their damage to warded fae/oni (Chapter 7).
6. **Single income unit (Momo).** Economy is gacha-only; a free, weaker farmer would help F2P on
   long stages.
7. **No summoner beyond Chika (SSR).** A necromancer-style or familiar-tamer tower (spirit fox,
   paper shikigami) would round out the "summon" capability.
8. **Elemental spread is thin:** poison = Midori, fire = Akane, water = Sango/Umeko/Nami. Elemental
   wards in late chapters will lean heavily on lightning (Raika, Chika) and frost (Yuki, Nami).
9. **Phase 2 event units** (owner request): a summer-event tower and hero — keep students in cute
   summer outfits; an adult event hero can have a glamorous summer look within the content rule.

## Data notes for other areas

* Tier mods are **incremental**; owning tier N applies tiers 1..N of that path (crosspath rule in §3).
* `base` always has numeric `silence`, `reveal`, `knockback` (0 if unused). Optional objects
  (`aura`, `income`, `trap`, `turret`, `ramp`, `mark`) appear only on units that start with them;
  an upgrade that introduces one always supplies its full shape (e.g. `aura.range`, `ramp.per+max`).
* Elemental side effects are explicit `status` entries (burn, slow, shock, poison, soak).
* Transformations (`behavior`/`attackType` replacements) only happen at tier 4–5: Hikari *Halo Lances*
  (`projectile`), Rei *Duelist Stance* (`duel`), Yuki *Eternal Winter* (`pulse`), Raika *Lightning Lance*
  (`beam`), Miko *Amaterasu's Mirror* (`beam`), Chika *Tesla Tower* (`chain` + mystic), Suzu
  *Exorcism Seal* (holy).
* Hero `levelXp[i]` = XP needed to go from level i+1 to level i+2; `levels` lists milestones 1–10
  (level 1 has empty mods). Ult unlocks at level 3.
* Helpers in `units.js`: `getUnit` (throws), `towers()`, `heroes()`, `UNIT_IDS`, `unitsByRarity(r, {kind})`,
  `freeUnlocksByStage()`, `hasCapability(unit, cap, {includePaths})`, `unitsWithCapability(cap, {includePaths, kind})`,
  `tierCost(unit, path, tier)`, `pathCostTo(unit, path, tier)`.
