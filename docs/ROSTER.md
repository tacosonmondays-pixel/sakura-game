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
* Every girl, free ones included, is also in the gacha pool of her rarity (a duplicate gives +1 Potential, up to
  P6, and Star Fragments; see *Potential* below).

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
| **Chika** — Gadget Prodigy | Tower · SSR | Engineer | Pierce | Lightning | Land | Gacha | A weak wrench bolt plus a wing of **roaming drones** (2 at base) that fly out up to 4 tiles to hunt; flight modes Hover · Hold · Patrol · Pursuit (map-wide); paths: drone army, **cleanse + Veil Sight aura**, or a Tesla coil (her bolt becomes the coil; drones keep flying). | Sabotage waves, bosses walking a long lane (Pursuit), lanes out of reach (Hold) | Sappers jam drones far from the team; her own bolt is weak |

## Upgrade paths at a glance

Tier 3 is where a path changes how she plays; tier 5 is the dramatic finale (7 000–16 000 coins).

| Girl | Path 1 → T5 | Path 2 → T5 | Path 3 → T5 |
|---|---|---|---|
| Hikari | Radiant Edge → *Noon Absolute* (huge cleave) | Sanctuary → *Dawn Sanctuary* (Veil Sight + silence aura; cleanse from T4) | Lightbringer → *Celestial Choir* (anti-air light lances) |
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
| **Sabotage** (goblin sappers) | cleanse, trap | Suzu (5-5) traps catch sappers; Hikari Sanctuary 4 *Sanctified Banner* (cleanse aura) | Chika Repair Bay 3 (cleanse), Miko Sacred Grounds 4, Hotaru Guiding Lights 4 | Traps near the entrance stop sappers before they reach girls. |
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

1. **Only one free cleanse, and it is on the hero** (Hikari Sanctuary 4, ≈4 700 coins in total).
   Players who bring Nami or Luna rely on Suzu's traps; a cheaper free cleanse tower (or a Chapter 6
   free support) would make Foundry stages kinder.
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

## Potential (P2–P6 steps, v3: `src/data/potential.js`, text `src/data/potentialText.js`)

Every duplicate raises a girl's Potential by 1 (P1 = her first copy, max P6). Every step is a stat boost on her
rarity's track, spent on her own axis (Kage all attack speed, the supports their aura, Momo her coins), and from P3
(from P2 for SSR girls and the three heroes) a kit step (✦) that amplifies what she is good at; P6 is her capstone.
Each step is bigger than the one before (spec `docs/specs/POTENTIAL.md`, v3 §3 and §5). The whole-girl numbers are
relative, so they are the same size at every level and reach her traps and drones. Generated from the data and the
text table (the in-game wiki article *Potential* and each girl's Info tab show the same rows).

| Girl | P2 | P3 | P4 | P5 | P6 capstone |
|---|---|---|---|---|---|
| Hikari | ✦ **Sunrise Step**: +5% damage. Every 6th sweep is a Sunrise: 50% harder. | ✦ **Dawn Training**: +7% damage; Celestial Bloom recharges 10% faster. | ✦ **Sunrise Drill**: +7% attack speed. Sunrise every 5th sweep, 75% harder. | ✦ **High Sun Bloom**: +8% damage. Celestial Bloom reaches 1 tile further, hits 75% harder, and leaves every foe Brittle +15% for 6 s (rank 3: +15% for 6 s → +30% for 12 s). | ✦ **Second Sunrise**: +9% attack speed; Bloom recharges a further 10%. Sunrise every 4th sweep, twice as hard, with a sure 0.3 s stun. |
| Luna | ✦ **Long Moonbeam**: +5% damage. Every beam pierces 2 more enemies (3 → 5 at Lv 1). | ✦ **Night Study**: +7% damage; Moonfall recharges 10% faster. | ✦ **Starlit Pace**: +7% attack speed. Moonfall's haste lasts 3 s longer and is 5 points stronger (rank 3: +40% for 10 s → +45% for 13 s), for every girl on the map, a partner's included. | ✦ **Tidelocked Moon**: +8% damage. Moonfall recharges a further 10%, its slow lasts 2 s longer, and it leaves every enemy Brittle +15% for 8 s. | ✦ **Eclipse Crown**: +9% attack speed. Moonfall's haste is 5 points stronger again (+50%), and girls within 3 tiles of her get +8% damage and attack speed at every level. |
| Nami | ✦ **Morning Tide**: +4% damage. Her slows are 5 points stronger (20 → 25% at tier 0; 30 → 35% with her awakening). | ✦ **Brine Soak**: +5% attack speed. Her orbs Soak for 2 s: Soaked foes take +15% frost and lightning damage (her own orbs too). | ✦ **Sea Legs**: +5% damage; Tidal Wave recharges 15% faster. | ✦ **High Water**: +6% attack speed. Tidal Wave hits 50% harder, Soaks every enemy for 6 s and leaves them Brittle +10% for 4 s (rank 3: +15% for 6 s → +25% for 10 s). | ✦ **Tide Crown**: +6% damage. Every 5th orb swells into a Tide Crown: 50% harder, +0.5 splash, and a sure 0.4 s freeze. |
| Aoi | Dawn Practice: +4% damage. | ✦ **Through-Shot**: +4% attack speed. Every arrow passes through 1 more enemy (1 → 2; Skyline Breaker 17 → 18) and ignores 1 more armor. | ✦ **Keen Fletching**: +4% damage; +6% crit chance (5 → 11% at tier 0; Apex Huntress 25 → 31% at ×3). | ✦ **Twin Fletch**: +4% attack speed. Every 12th volley she looses the whole volley twice (1 arrow → 2; Thousand Feathers 6 → 12). | ✦ **Hawk Companion**: +5% damage. Twin Fletch comes every 10th volley, and on it her hawk dives on her first target for one more volley's damage (her hit × her arrows; it can crit). |
| Rei | Morning Kata: +4% damage. | ✦ **Third Step**: +4% attack speed. Every 4th sweep (or duel strike) cuts 15% harder and staggers everything it hits for 0.3 s (bosses take a quarter; Freeplay's stagger budget applies). | ✦ **Clean Cut**: +4% damage; +5% crit chance (0 → 5% at tier 0; Final Crescent 25 → 30% at ×3). | ✦ **Breaking Petal**: +4% attack speed. Third Step cuts 50% harder (instead of 15%) and cracks 1 armor for 3 s (stacks ×3, for every girl). | ✦ **Twin Crescent**: +5% damage. After every Third Step a returning crescent sweeps the same reach for 30% of it (in Duelist stance, a 30% follow-up strike that adds no focus stack). |
| Yuki | Snow Day: +4% attack speed. | ✦ **Powder Drift**: +4% damage. Her slows are 5 points stronger and 1 s longer (30%/1.5 s → 35%/2.5 s; Eternal Winter 62 → 67%; the 90% cap stays). | ✦ **Cold Snap**: +4% attack speed. Everything she hits turns Brittle +5% (damage from everyone) for 2 s (on Frostbite it adds 5 points: Diamond Dust 45 → 50%). | ✦ **Flurry**: +4% damage. Every 5th throw (or blizzard pulse) is a Flurry: 30% harder, +0.3 splash and a sure 0.4 s freeze on everything it hits (bosses take a quarter; her own freeze chance still rolls). | ✦ **Winter Glass**: +5% attack speed. Flurry comes every 4th throw, hits 50% harder, and leaves everything it hits Brittle +10% for 3 s. |
| Momo | Pocket Money: +3% coins per wave. | ✦ **Lucky Pouch**: +3% coins per wave. Enemies defeated inside her range pay 10% more coins (the strongest Momo only; it also works on Nightmare, where wave income is off). | ✦ **Fortune Flick**: +4% coins and +4% attack speed. Every 8th flick is a lucky coin that hits 3× as hard. | ✦ **Golden Harvest**: +4% coins. Every 8th wave clear she pays her wave income a second time. | ✦ **Peach Festival**: +4% coins. Golden Harvest every 6th wave clear; a lucky coin every 6th flick, 4× as hard. |
| Akane | Hotter Powder: +4% damage, shells and burn. | ✦ **Ember Leap**: +5% attack speed. When an enemy burning from her falls, the fire leaps to the nearest enemy within 1.2 tiles (twice at most); her burns last 1 s longer. | ✦ **Starburst Skies**: +5% damage and burn. Her shells also burst in the sky (she hits flyers on every path; her Wildfire, Big Bang and Rocket paths already can), and every 8th shell is a Starburst: 50% harder with a blast 0.4 tiles wider. | ✦ **Grand Starburst**: +6% attack speed. Starburst every 6th shell: twice as hard, a blast 0.6 tiles wider, and its burn 50% stronger. | ✦ **Midsummer Bloom**: +7% damage and burn. Every Starburst blooms twice: a second firework follows it at once for half its power. |
| Sango | Deck Drill: +4% damage. | ✦ **Coral Chisel**: +5% attack speed. Every shell cracks 1 armor for 3 s (stacks ×3, for every girl; on Armor-Breaker it adds 1: Fortress Fall 6 → 7, team −21). | ✦ **Coral Shell**: +5% damage. Every 6th shell is a Coral Shell: 40% harder, with a blast 0.3 tiles wider. | ✦ **Coral Barrage**: +6% attack speed. Coral Shell every 4th shell: 80% harder, a blast 0.4 tiles wider, and it Soaks everything it hits for 4 s (+15% frost and lightning damage). | ✦ **Sea Dragon Shell**: +7% damage. Coral Shell every 3rd shell, and it leaves everything it hits Brittle +10% for 3 s. |
| Kage | Night Drills: +4% attack speed. | ✦ **Shadow Edge**: +5% attack speed. Every shuriken passes through 1 more enemy (2 → 3; Kusarigama 6 → 7; Thousand Shadows 5 → 6) and ignores 1 more armor. | ✦ **Shadow Tempo**: +5% attack speed. Every throw in an unbroken run makes the next one 1% faster, up to +6% after 6 throws; it fades after 1 s without a throw. | ✦ **Moonpiercer**: +6% attack speed. Every shuriken pierces 1 more enemy again (2 → 4 with Shadow Edge; Thousand Shadows 5 → 7), and every throw carries 12% more shuriken (Thousand Shadows 13 → 14.56 on average; Blade Rain 7 → 7.84; on a 2-shuriken build a 3rd shuriken about every 4th throw). | ✦ **Shuriken Storm**: +7% attack speed. Every 6th throw is a Shuriken Storm: a ring of shadow clones throws the whole volley again at once, and storm shuriken pierce 2 more enemies. |
| Umeko | Spring Water: Girls in her aura attack 3% faster. | ✦ **Tidewarmth**: Aura +3% attack speed and 0.4 tiles wider (3.0 → 3.4 with her awakening; Sea of Lanterns 6 → 6.4). | ✦ **Lantern Ward**: Aura +3% attack speed; girls in her aura ignore 1 more armor (Sea of Lanterns 3 → 4); aura 0.3 tiles wider again. | ✦ **Petal Drizzle**: Aura +3% attack speed; girls in her aura get +6% crit chance (Blooming Ocean 10 → 16%). | ✦ **Blessing Wave**: Aura +3% attack speed. Every 3rd pulse, girls in her aura attack a further 15% faster for 3 s. |
| Shiro | Range Day: +4% damage. | ✦ **Keen Scope**: +5% damage. Her shots mark: the target takes +6% damage from everyone for 3 s (on Spotter's Mark it adds 6 points: Overwatch 50 → 56%). | ✦ **Steady Breath**: +5% attack speed; +5% crit chance (20 → 25% with her awakening). | ✦ **Silver Line**: +6% damage. Her round goes through 2 more enemies and ignores 2 more armor. | ✦ **White Heron**: +7% attack speed. Every 5th shot is a White Heron round: 60% harder, and it passes through 6 more enemies. |
| Midori | Fresh Herbs: +4% damage, flask and poison. | ✦ **Bitter Tonic**: +5% attack speed. Her splash leaves enemies Brittle +5% for 3 s (on Corrosion it adds 5 points: Universal Solvent 30 → 35%). | ✦ **Evergreen Venom**: +5% damage and poison. Her poison lasts 1 s longer and also eats 0.05% of max HP a second (bosses 0.005%; adds to Toxicology's 0.25%). | ✦ **Cauldron Bomb**: +6% attack speed. Every 6th flask is a Cauldron Bomb: 50% harder, 0.4 tiles wider, and its poison 50% stronger. | ✦ **Double Batch**: +7% damage and poison. Her brew reaches 1 more girl (never more than 4: Toxic Tonic and Acid Edge 3 → 4, Swift Draught stays 4), and Cauldron Bomb comes every 5th flask. |
| Suzu | Bell Practice: +4% trap damage (whole-girl damage reaches traps). | ✦ **Spare Seals**: Sets traps 5% faster. One more trap at once (6 → 7 with her awakening), and her traps slow by 20% for 1.5 s (on Binding it adds 20 points). | ✦ **Temple Bell**: +5% trap damage. Every 10th trap that goes off is a temple bell: 50% harder, with a blast 0.3 tiles wider. | ✦ **Bell Peal**: Sets traps 6% faster. Temple Bell every 5th trap: 60% harder, a blast 0.4 tiles wider, and it silences for 1 s. | ✦ **Evening Bell**: +7% trap damage. One more trap again (+2 in all), and Temple Bell comes every 4th trap: 80% harder, and it leaves everything it hits Brittle +10% for 3 s. |
| Raika | Drum Practice: +4% damage. | ✦ **Branching Bolt**: +5% attack speed. One more jump (4 → 5 with her awakening); her lightning lance pierces 1 more enemy. | ✦ **Thunder Column**: +5% damage. Every 6th cast drops a thunder column on her first target: 35% of her hit to everything within 0.9 tiles. | ✦ **Thunderhead**: +6% attack speed. The column comes every 5th cast, hits for 70% within 1 tile, and stuns for 0.3 s (sure; bosses take a quarter). | ✦ **Monsoon Drum**: +7% damage. One more jump again; Thunderhead every 4th cast, and it Soaks what it hits for 3 s (Soaked foes take +15% lightning and frost, her own chain included). |
| Miko | Morning Prayer: Her aura's damage bonus grows by 3% (+10% → +13.3% at tier 0), and her talismans hit 4% harder. | ✦ **Bell Ward**: Aura +3% damage; girls in her aura ignore 1 more armor (Goddess's Festival 4 → 5); she throws 5% faster. | ✦ **Shrine Steps**: Aura +3% damage and 0.4 tiles wider (Goddess's Festival 4.2 → 4.6); her talismans +5% damage. | ✦ **Shimenawa Circle**: Aura +3% damage; enemies inside her aura are Brittle +6% (damage from everyone); she throws 6% faster. | ✦ **Festival Bells**: Aura +3% damage; her talismans +7% damage. Every 4th talisman (or beam pulse) rings the festival bells: girls in her aura deal a further 10% for 3 s. |
| Hotaru | ✦ **Firefly Lamps**: +5% damage. On every path, girls within 2.6 tiles deal +6% damage (her own aura multiplies: Guiding Lights 5's +38% → +46%). | ✦ **Firefly Parade**: +7% attack speed. Her pulse hits 4 more enemies (8 → 12) and marks them: +5% damage from everyone for 3 s. | ✦ **Lantern Rite**: +7% damage. Her pulses deal 20% more to spectral enemies (ghosts, wraiths, the Grave Lych, the Gloom Regent: holy ×2 → ×2.4) and leave struck foes Brittle +6% for 3 s. | ✦ **Hundred Lanterns**: +8% attack speed. Every 4th pulse reaches 1 tile further, hits 40% harder and silences 1 s longer. | ✦ **Midnight Lanterns**: +9% damage. Her firefly aura gains another 6% (to +12%; Guiding Lights 5: +55%); Hundred Lanterns comes every 3rd pulse, hits 60% harder, and leaves everything Brittle +8% for 3 s. |
| Kaede | ✦ **Leaf Memory**: +5% damage. When her target falls she keeps half her focus for the next one; switching targets by choice still resets it. | ✦ **Breeze Step**: +7% attack speed. Her focus builds 2% faster per strike (12 → 14% per hit with her awakening). | ✦ **Scarlet Focus**: +7% damage. Her focus cap rises 30 points (+100 → +130% at tier 0; Crimson Eternity +320 → +350%), and +5% crit chance. | ✦ **Maple Gale**: +8% attack speed. Every 4th strike also cuts every enemy within 0.6 tiles of her target (an unfocused hit, like her duel splash). | ✦ **One Blade, One Foe**: +9% damage. She deals 20% more to bosses and minibosses (Crimson Eternity ×1.5 → ×1.8). Maple Gale comes every 3rd strike, and the Gale strike hits 50% harder (her focus still counts). |
| Chika | ✦ **Throttle Up**: +5% damage (drones and bolt). Every 30 s from when she is placed, her drones fire 50% faster for 4 s. | ✦ **Fine Tuning**: +7% attack speed (drones fire and build faster). Drones reach 0.3 tiles further, and she and her drones ignore 1 more armor. | ✦ **Overhaul**: +7% damage. Throttle Up comes every 25 s, lasts 6 s, and makes her drones fire 60% faster. | ✦ **Extra Wing**: +8% attack speed. One more drone (3 → 4 with Mk-II; Mecha-Fortress 10 → 11), and drone hits crack 1 armor for 3 s (stacks ×3, for every girl). | ✦ **Grand Uplink**: +9% damage. Throttle Up every 20 s, with drones firing 75% faster; her tune-up links 1 more girl (Signal Tower 1 → 2, Grand Workshop 2 → 3). |

**A new girl needs her row in the same PR** (`tests/data/potential.test.js` fails otherwise): every step must
change a stat her behaviour reads, inside the budget (CONTRACTS §3, *Potential steps*).

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
