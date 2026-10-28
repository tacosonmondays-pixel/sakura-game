# Gate Arc · Arc 1 "The Girl at the Door"

**Status:** approved 2026-10-27 with the defaults in §22 (Q19 answered on 2026-10-20: a full lethal war, no gore).
Written 2026-10-20. Step 1 (§19) is being built on the `feature/gate-arc` branch; nothing has shipped yet. This spec
covers the story arc, the 40 new stages (a modern Act II for every chapter), the theme kit and the rollout. Every
organisation, place, piece of gear and character named here is our own.

Contents: 1 Summary · 2 Names · 3 The Long Day · 4 Paradoxes · 5 Attachment to Arc 0 · 6 Sensei · 7 The sides ·
8 Cast and soul-threads · 9 The mystery · 10 Reveals · 11 The eight modern acts · 12 Scene list · 13 Bosses ·
14 Deaths and the roster · 15 Tone · 16 Finale, cliffhanger, Arc 2 · 17 The 40 stages · 18 Theme kit · 19 Rollout ·
20 Ids and room to grow · 21 Build and lint notes · 22 Open questions

---

## 1. Summary

The summer after the second bloom, the sky splits along the Wall at sunrise. On the other side is a school rooftop on
the same hill a thousand years later, and a small girl watering flower boxes. This is **Itomachi**, an ordinary
lakeside city of trains, canals and convenience stores, and Sensei's real home: one foggy spring morning Sensei took
its first ferry with a soggy letter in one pocket, and never arrived. Frozen slimes tumble through the crack, running
from a cold that has swallowed the far north. Outside the ward's lullaby nothing "poofs" home. A creature that falls in
Itomachi stays fallen, and every death in terror tears the sky a little wider.

The Sentinels cross to help, Sensei's old school becomes Shelter 3, and a frightened city answers with guns. A whole
people of freezing refugees comes down the mountain road behind a young oni who carries their last fire. The city's
Gate Response Brigade fires on them, the shrine district burns, and the Brigade crosses into the frozen north, where the
Sentinels fight their own city's soldiers and learn that first light has nowhere to send a soldier who is already home. Then a third gate opens in a
drowned subway, and survivors walk out of **Vesperline**, a gleaming academy city that will one
day stand on this lake. It is already destroyed. Its soul Register lists every citizen's previous life, so it lists how
Itomachi's people die in this war, before they die. Its founding legend is a nameless student who held a shelter door
with a lantern so that four hundred people lived. Its last commander left a recording for that girl, in Hikari's words,
with Hikari's sword in her hand.

Across eight modern acts the cast saves one man the Register has buried and loses a girl only Sensei remembers. They
learn that Hikari, the small girl on the rooftop and the commander on the recording are one soul in three lives. On the
festival night the girl at the door turns out to be the one person nobody thought to protect: **Mahiru**, who believed
she was too small to matter. At the summit the Night pushes through the Vesper Gate wearing the frayed scarf the
Handicraft Club knitted "for a cat". When Mahiru's soul passes on, the gates swing. Sensei steps alone into a living
Vesperline years before its fall, where a first-year with Mahiru's habits and none of her memories hands Sensei a
brand-new faculty card, the twin of a cracked one marked MISSING, and says: "...You came."

**Scope:** 8 modern acts (one per chapter), 40 stages, 48 cutscenes (45 main and 3 join episodes: six in every act,
joins included), 21 optional side scenes, 2 bond scenes, 8 new x-10 bosses on existing models, 1 side stage, and four
enemy factions (one out of each gate, plus the Brigade: the one new enemy model family, eight units).

---

## 2. Names

| Thing | Name | Note |
|---|---|---|
| All of history | **the Long Day** | one circle of three eras on one lake: **Morning** (fantasy), **Noon** (modern), **Evening** (future), then **the Night**, then the same Morning again |
| The fantasy era | **Moonpetal City**, Sakura Academy | the Morning; the shipped world, unchanged |
| The modern era | **Itomachi** ("thread town") | the Noon: an old silk-mill town turned commuter city: station plaza, covered arcade, canals, the Old Town, the Lakeside Shrine, a mountain highway, a drowned old subway line |
| Sensei's old school | **Itomachi Hilltop High** ("Hilltop") | stands where Sakura Academy stands; its rooftop is where the Wall was; Shelter 3 in the war |
| The future era | **Vesperline Academy City** | the Evening: one great academy grown into a city of glass lecture towers, sky-rails and light-bridges; destroyed completely in **the Fall** |
| Vesperline's soul archive | **the Spindle** and its **Register** | a white tower that recorded every citizen's soul-thread; the Register lists each person's previous life |
| The phenomenon | **the Merge** | the three eras bleeding into each other through gates |
| The fantasy gate | **the Petal Gate** | Morning into Noon |
| The modern gate | **the Noon Gate** | Noon into Evening |
| The future gate | **the Vesper Gate** | Evening into Morning; its Morning mouth is the shipped star rift on Dragonback Ridge (8-4) |
| The refugees | **the Emberfolk**, around **the Ember** | the peoples of the far north beyond Ashwing Peaks (oni, orcs, goblins, slimes, wolves, bog-folk, walking trees, fae) who have lived for centuries around one ancient fire; Itomachi's news calls them "the Host" |
| Vesperline's mascot | **Doorie** | a round, lantern-carrying cartoon girl on keychains, buses and lunch boxes; she is the girl at the door |
| Itomachi's science arm | **the Thread Institute** | the city's old silk-research laboratory; takes custody of "Specimen 0" |
| The Brigade's kit | **Gnats, Tortoises, Badgers, Striders, Herons, HAMMER** | its own nicknames for recon drones, armoured response vans, light tanks, rescue walkers and gunships, and the mobile artillery that carries Protocol HAMMER's name (§7.3) |
| What the Night touches | **the Rimebound** | wisps, slimes and wyverns chilled by the Night as they fall out of the Vesper Gate; frost cannot slow them (§3.4) |
| The hatchling | **Specimen 0**, "the little one" | follows warm things; on screen only "a small grey winged thing" until Act 7 |
| One soul's three lives | **Hikari, Mahiru, Yūhi** | first light, high noon, the evening sun; nobody says it aloud until Act 7 |

---

## 3. The Long Day

### 3.1 The circle

History is one day that goes round. The Morning grows into Noon, Noon into the Evening, the Evening ends in the Night,
and after the Night the same Morning comes again: the same lake, the same hill, the same mountains. Each era knows the
one before it as history and the one before that as legend. Itomachi tells a folk tale about a city of moon-petals that
sank into the lake. In Vesperline, *The Quiet Stones* is a picture book about a captain, a mother in the mountains and a
little star in a hat. The Morning knows nothing of either, except what its founders hid in "instruction poems": the
founders were Vesperline's last cadets, who walked through the Vesper Gate on the night of the Fall.

Each hour carries faint **sediment** from earlier turns of the Day. That is why the Hollow Samurai guards "a shrine that
fell long ago" in a Morning where Moonveil still stands, and why Luna has dreamed all her life of a city burning at noon.

### 3.2 The three gates

| Gate | Links | Torn by | What comes through | Shipped anchor |
|---|---|---|---|---|
| **Vesper Gate** (future) | Evening → Morning | the Fall: a whole city's deaths at once; held open by Commander Yūhi's dying plea | the founders, a century ago in Morning time; ever since, the Night's cold and the Night's touched (the Rimebound); in Act 8, the Night itself | the 8-4 star rift; the moon leaning north |
| **Petal Gate** (fantasy) | Morning → Noon | this summer, the Emberfolk freezing in the far north; a crack between the Wall and Hilltop's rooftop (Act 1), torn wide in the lake fog (Act 3) | the refugees, family by family (every fantasy monster family); the Sentinels; the little one | "Everyone's running from the cold this spring" |
| **Noon Gate** (modern) | Noon → Evening | Act 3: Protocol HAMMER and the shrine district's dead; its mouth settles in the drowned subway (Act 5) | Vesperline's last survivors, and behind them the machines that still hold its line; the cast, going the other way | the Hollow Samurai's fallen shrine is this shrine |

**Who holds them open.** Each gate was torn by one era's dead and leads to the next hour, where those dead were going.
What holds all three open, and pins them to one place in each era, is one unanswered plea. Commander Yūhi died at the
Vesper Gate holding a blade of first-light crystal, asking for someone. Her plea pinned the Merge to her own soul, so
the gates open onto the three hard seasons of that soul's three lives: Hikari's cold spring, Mahiru's war autumn,
Yūhi's Night. That is why the first crack opens between the Wall and a rooftop at the minute Hikari and Mahiru both
watch the sun come up.

**Why now.**
1. The Night has always pressed on the Vesper Gate; the Morning's ward held it shut.
2. This spring the ward was dim because the Hearthstone was keeping the eggs warm (shipped, unchanged). The Night's cold
   seeped through the star rift: the spring was cold, the mother woke early, and the moon leaned north toward the rift.
3. In `ch8.epi` the Hearthstone blazed and shut the Vesper Gate out of the Morning. Relighting was right, and the ward
   was also keeping the hours apart. The cold already inside pooled in the far north, outside the ward's ring, and the
   Emberfolk began to freeze. Their deaths tore the Petal Gate.
4. Why the Night pressed harder this time is Arc 2's question.

### 3.3 The rules (the story never breaks them)

1. **One Day, one circle.** No parallel worlds, no second copies of an era. The Day can be rewritten, and then the
   rewrite is the only version.
2. **The Day rhymes.** Each hour lives the same story its own way: a cold season, a people at a warm door, a keeper who
   holds a light, someone small who stays. Every modern act retells its fantasy chapter with another ending.
3. **One soul, one thread, one life in each hour.** When a life ends its thread passes forward into the next hour, into
   someone new. No memories pass. Echoes do: a gesture, a fear, a turn of phrase, a taste in tea.
4. **Death is real.** Nobody comes back, by a gate, a rewrite or a soul-thread. "The thread goes on. The stitch is
   finished."
5. **The ward is a lullaby that keeps threads uncut.** Inside a lit wardstone's light, a falling creature is not cut but
   sent home (the shipped "poof"). Outside, falling is final. Itomachi's wardstones still exist, hidden in things people
   kept loving for a thousand years; they are dark and can be relit. Wherever the Dawnblade is on the field, a creature
   the girls knock down goes home through the nearest seam. The Brigade's guns carry no such light. **First light was
   sung for the wilds:** it sends home what a seam brought out of the wilds (Kagari's people among them), and it has
   nowhere to send a soldier of Itomachi, who is already home. A soldier who falls, inside first light or out, stays
   fallen.
6. **A thread cut in terror snags, and a snag is a gate.** One death makes a pinhole that heals; many make a door that
   stays. Killing makes the Merge worse. HAMMER tears the sky every time it fires.
7. **The circle must close.** A change that contradicts another hour **unweaves** whatever depended on it, people
   included. An unwoven person has not died: she has never been. She **flickers** first. Only the Constant remembers.
   **The Night is the knot:** a change ripples forward one hour at a time, so a change at Noon reaches the Evening at
   once but reaches the next Morning only by undoing the Night. That is why in Arc 1 only the Evening's people flicker,
   though Hikari is Yūhi's next life, and why in Arc 2, with the Night itself at stake, Hikari begins to flicker.
8. **Two lives of one soul can share an hour.** A traveller keeps her own thread. They do not know each other, but
   echoes bleed between them.
9. **The gates.** While the Merge holds, the three hours run side by side. A gate throws a traveller toward warmth; only
   the Constant arrives where they mean to, and anyone holding Sensei's hand arrives with them. When the pinned life
   ends, the pin slips forward to the thread's next life and the gates swing to the season where that life's trouble
   begins.
10. **The Constant.** Sensei has no thread, exists once in every hour, is never reborn, walks any gate in either
    direction, only moves forward in their own time, and remembers whatever is unwoven. Where no gate stands, only two
    things have ever crossed: a plea for help asked of the water in a hard season of the pinned soul, which surfaces
    wherever the Constant is, and the Constant, following it. That is how Sensei first came, in spring, before any gate
    opened at Noon: Hikari's letter surfaced in Itomachi's plaza fountain and Sensei followed it on the dawn ferry. Nothing
    else can cross that way. Nobody knows why (Arc 2+).

**Teaching plan:** no rule is explained before the player has seen it happen; at most one rule is named per act. Rule 5
is shown in Act 1, and its edge (first light has nowhere to send someone already home) is felt on 4-8; rule 6 is shown in Acts 1 and 3 and
named in Act 4; rules 3, 4 and 7 come in Act 5; rule 8 in Act 6;
rule 2 is named by Yoriko's puppet play in Act 7; rule 9's pin is the finale; rule 10's one gateless crossing is shown,
not named, in the Act 8 side scene "Ask the Water". From Act 5 Tenka explains each rule on a
whiteboard, and each becomes a Captain's Journal page with Hikari's doodles (kind `lesson`, 0 gems).

### 3.4 What comes out of each gate: the four factions

Three factions come out of the three gates. The fourth comes out of no gate, because it is our own.

| Gate | Faction | Families | Where they fight | How a fight ends |
|---|---|---|---|---|
| **Petal Gate** (Morning → Noon) | the Emberfolk, and everything running from the cold | the eleven fantasy families: slime, goblin, orc, ghost, ghoul, oni, lizard, beast, fae, plant, dragon (wild wyverns, never the brood) | every Itomachi map of Acts 1-5 and 7; at home on the far side in 4-9 and 4-10; the Petal lanes of 8-9 and 8-10 | knocked down inside first light, they go home (rule 5) |
| **Noon Gate** (Noon → Evening) | Vesperline's machines, still obeying *hold the line* | the construct body in white glass and cyan: Patrol Orb, Halo Drone, Line Sentry, Vesper Aegis, Lattice Shell, Vesper Warden, Gatekeeper Unit 01 | out of the gate from 5-8 (a few on 5-9); all of Act 6; the Noon lanes of 8-9 and 8-10 | they break apart |
| **Vesper Gate** (Evening → Morning) | the Night | the Rimebound (cold-touched wisps, slimes and wyverns that frost cannot slow) and the Shadow at the Gate | 6-10's last waves; the Vesper lanes of 8-9 and 8-10 | it flinches back through the gate |
| **No gate** | the Gate Response Brigade, our own city | a new family, `brigade`: eight units (§7.3) | spotter drones on 3-9; 4-8's even waves and all of 4-9; 7-8's even waves and 7-9, with the HAMMER Carriage; allied from 8-7 | a beaten soldier falls and fades out like any enemy, and first light cannot send him home: the fall is final; machines break apart (§15) |

The Brigade is the only faction that chooses to cross: everyone else is thrown through a gate toward warmth (rule 9);
the Brigade walks through on purpose, with guns. The goal of every map is the people behind the line, so whoever walks
the road toward them is stopped: gently, for every creature first light can send home, and for good, for a soldier it
cannot. On 4-9 that is the city's own squad, and not all of it goes home; on 4-10 the same girls defend what is left of
that squad from the Host's rearguard. The war with the Brigade is lethal on both sides (§15). **The family rule, extended:** Act II of chapter *c* uses only families and rules seen
by chapter *c*; the lines new to Act II (the Brigade, the machines from 5-8, the Rimebound) use only rules already taught
there (no flyers before 8-1). Every faction except the Brigade is drawn on an existing family model; the Brigade is the
one new model family (§18.9).

---

## 4. Paradoxes

| # | Paradox | Type | Planted | Pays off |
|---|---|---|---|---|
| **P1** (drives) | **The Register of the Dead**: Vesperline's people are the next lives of Itomachi's people, so the Register lists how Itomachi's people die in this war | a future already lost | Act 2 (a roll call of static), Act 5 (the slate) | Act 5: they save Lieutenant Mori, whom the Register drowns at the reservoir, and Toki is unwoven. Every later rescue has a price |
| **P2** | **Twin star**: Tsubaki is the next life of Kohaku | two lives of one soul side by side | Act 5 (Tsubaki goes white at Kohaku's name) | Act 6: Kohaku is pinned and Tsubaki flickers; they pull Kohaku out and Tsubaki steadies |
| **P3** (drives) | **The girl at the door**: Mahiru adores the Commander's voice; the Commander grew up adoring the Doorie statue; they are one soul | a causal loop of courage | Act 2, Act 6 | Act 7: the Commander redacted her own prior-life entry. Kohaku decodes it a minute too late. The name is Mahiru |
| **P4** | **Doorie has no maker**: Tenka gives Mahiru a Doorie keychain; it hangs on the shelter door; the survivors' children draw the mascot from it; centuries later Tenka buys it | a bootstrap object | Act 6 (a thank-you gift) | Act 7 (the keychain on the handle), Act 8 (Tenka works it out) |
| **P5** | **Hikari holds her own past life's sword**: the blade in the last recording has the Dawnblade's notch | inheritance across the Night | Act 2, Act 6 | Act 7: Yūhi → Hikari (the sword), Mahiru → Yūhi (the Register), so Hikari → Mahiru: "She's who I'll be." |
| **P6** (drives) | **The little one**: the hatchling follows the warmth through the Act 1 crack; the Brigade takes it; kept for centuries as the warm heart of what becomes the Spindle, it grows cold and enormous and breaks loose at the Fall as **the Night**, whose cold makes Arc 0's spring cold, wakes its own mother early and hatches its own egg | a causal loop; two versions of one creature | Act 2 (boiler room, scarf "for a cat"), Act 5 (crate "GRB · SPECIMEN 0"), Act 6 (frozen nest, grey wool in the ice) | Act 8: the Shadow at the Gate wears the scarf ("…That's my stitch."); the shipped Eclipse Wyrm lines play out; its rescue is Arc 2 |
| **P7** | **Ask the water**: the founders carved "If you cannot carry it alone, ask the water" because the picture book said the Captain asked and the teacher came; Hikari's letter surfaced in Itomachi's plaza fountain (rule 10) | a bootstrap instruction | Act 1, Act 6 | Act 8 side scene: "They carved the instruction because the answer already existed." It also says how Hikari asked, which Arc 0 never does |
| **P8** | **MISSING twice**: Itomachi's MISSING poster of Sensei; Vesperline's cracked card "SENSEI · Faculty Advisor · MISSING since the Fall" | a record from a future that has not happened to its subject | Act 1, Act 6 | the cliffhanger: Yūhi hands Sensei the card's brand-new twin |

---

## 5. Attachment to Arc 0 (nothing that shipped stops being true)

| Shipped fact | Arc 1 reading |
|---|---|
| The stones dimmed because the heart warmed the eggs (ch8) | unchanged; Arc 1 adds causes only for the cold, the early waking and the moon |
| "Nobody was stealing anything. A mother was keeping her children warm." | unchanged, and rhymed: Kagari keeps her people warm with no ward to soften it |
| The ward is a lullaby; monsters poof home | the lullaby keeps threads uncut (rule 5); nothing in Arc 0 ever died |
| The Hearthstone relit at full strength (ch8.epi) | it shut the Vesper Gate out of the Morning, which was right |
| The star rift on Dragonback Ridge (8-4) | the Vesper Gate's Morning mouth |
| The founders "were writing instructions" | Vesperline's last cadets, who had read *The Quiet Stones* as a picture book |
| The Dawnblade passes Captain to Captain; no predecessor named | its first holder was Commander Yūhi; Hikari is her next life; who held it just before Hikari stays open |
| "Stones don't go dark because someone got a sword" (ch7.epi) | still true |
| The Hollow Samurai guards "a shrine that fell long ago" | Itomachi's Lakeside Shrine, which falls in Act 3 |
| Luna: "The road goes through the city first. It always does." | her thread is frayed; she has dreamed of a burning city and a door all her life |
| Hikari: "I asked for someone who could read the field. And you came." (how she asked is never said) | Mahiru: "Sensei? You came back." Yūhi: "...You came." The asking was a letter to the water (P7, rule 10) |
| "Then we'll keep them warm too. That's a promise." (ch8.mid) | kept for the mother in Act 8; the child's rescue is Arc 2 |
| Eclipse Wyrm: "It carries her inside its shadow"; "the Ashwing Matriarch tears free!" | the Shadow at the Gate is the Night, the little one grown cold; 8-10 plays the shipped phase line |
| "Nobody gets hurt. Not us, and not her." (ch8.pro) | breaks in Act 1's last beat, and again, for people, at 4-8 |
| Kage's suspect board; "Season Two… Sensei is always on it" | Season Two runs all arc; Season Three opens at the end |
| "Bring the whole squad! It's a very long wall." (ch8.epi) | the last scene before the cliffhanger |
| Halos, never explained | a silent clue only: Morning and Evening students wear halos, Noon students do not |

**Traps avoided.** No second cause for the dimming. The Matriarch is never a villain. Hikari is never blamed. No poofed
Arc 0 monster is revealed to have died. Pinned clue lines stay in their episodes. The Quiet Stones resolution stays
genuine and becomes the last time the cast knew that kind of innocence.

**Unlock and spoiler rules (default).** Modern Act *c* opens with chapter *c*: **x-6 requires x-5 and (c−1)-10**.
1. Main lines in Act *c* use only Morning girls who joined by chapter *c*; later girls appear behind `ifUnit`.
2. Arc 0 is only ever "this spring".
3. No "dragon" or "Matriarch" before Act 7 (the mystery lint, with Act *c*'s scenes filed after chapter *c*'s).
4. The letter, the Hearthstone and the little one's identity are paid only in Act 8, which opens after 8-5.

---

## 6. Sensei: the Constant

Sensei taught at Hilltop for one week of spring, until the foggy morning of the first ferry. In Itomachi Sensei is a
missing person: a sun-faded poster at the station whose photo is always covered (a pigeon, a slime, a parking sticker,
at the very end a Doorie sticker). Sensei speaks only through one choice per episode at most, always kind. Narration
may say what Sensei remembers or notices, never what Sensei looks like. Gender, age and face are never shown or stated.

| Beat | Sensei |
|---|---|
| Wants | to protect both homes: the Morning that took Sensei in, and the Noon Sensei left without a word |
| Fears | that answering the letter emptied the first home of its teacher |
| Gets wrong (1) | sees Hikari in Mahiru ("a small Captain") and never quite sees Mahiru |
| Gets wrong (2) | keeps secrets to spare people: the little one (Act 2), then Toki (Act 5); had Hikari known, the little one could have gone home in Act 2 |
| Turns | Act 5's epilogue: both choices end with Sensei telling everything; Hikari: "Stand with me means *tell* me." |
| Changes | the one who remembers each person as herself: "She was Mahiru." |
| Ends | steps alone into a living Vesperline, knowing how the first-year in front of them will die, and chooses to be her teacher anyway |

| Episode | Earnest option | Playful option | What it does |
|---|---|---|---|
| `g1.pro` | "That's my old school." | "Is that... my rooftop?" | Sensei is home |
| `g2.boiler` | "We should tell the Captain." | "Then we keep it warm. For now." | both keep the secret (the first flaw) |
| `g2.epi` | "You're like a small Captain." | "Sunshine, junior." | the comparison the twist will punish |
| `g5.epi` | "There were three of you." | "Can I tell you something?" | both tell (the turn) |
| `g7.mid` | "You matter now." | "You water the flowers. That matters." | the last kind thing said to her |
| `g8.epi` | "She was Mahiru." | "Her name was Mahiru." | the thesis, either way |

---

## 7. The sides

### 7.1 Itomachi's defenders

| Body | Who | Gear and job |
|---|---|---|
| **Itomachi Civil Safety Office** | the civilian emergency office | sirens, the shelter registry, evacuation buses, curfew; runs Hilltop as Shelter 3 |
| **Gate Response Brigade** | **Commander Kuroe**; adjutant **Lieutenant Mori**; response troopers in navy and amber | recon drones ("Gnats"), armoured response vans ("Tortoises"), light tanks ("Badgers"), rescue walkers ("Striders"), gunships ("Herons"), barricade drones, foam projectors, searchlight towers, the radio net "Channel 9", and **Protocol HAMMER** (saturate a gate zone with everything, fired from its mobile artillery carriages), which by rule 6 makes the Merge worse |
| **The Thread Institute** | the Brigade's science partner | seam meters, sensor masts, containment crates, "long-term custody" |
| **The Hilltop Watch** | student volunteers | Student Council (Ouka: shelter rota), Disciplinary Committee (Azami: checkpoints), Campus Security Bureau (Yuzuha: sentry turrets), Traffic Safety Patrol (Norika: detours), Heavy Machinery Club (Kogane and Big Yellow: rubble), Handicraft Club (Kinu: armbands, the memorial banner), Science Club (Kohaku: seam meters) |
| **The Sentinels** | Hikari's squad, in Hilltop uniforms from Act 2 | the Dawnblade relights Itomachi's dark stones ("First light."); every creature of the wilds they knock down goes home and nothing tears, but first light has nowhere to send a soldier who is already home: he falls for good, and every fall is a pinhole (rules 5, 6) |
| **The Last Watch** | Vesperline's survivors: Tsubaki, Tenka, little Toki | coilguns, prism batteries, fold-out light-bridges, a cracked Register slate |

In battle the units are the girls, as always. The Brigade is on the map as dressing (barricades and searchlights,
`supply_ship` airdrops, `petal_sanctuary` evacuees, the `ruined` look) and, where the story has it crossing or firing,
on the road as the fourth enemy faction (§3.4, §7.3), in a war that is lethal on both sides (§15). From 8-7 it fights
beside the cast.

### 7.2 The other sides

- **The Emberfolk.** Not an army: a nation on the move, a dozen peoples around one dying fire. They come through in the
  order they were driven out: slimes and goblins first, then lake-folk, ghost-kin and orc shield-lines, then bog-folk and
  walking trees, then the keeper's household of oni and fae, and last the panicked wyverns. Motive: warmth. They think
  the city's guns *are* its people. The children are at the back of the column.
- **Kagari, the Ember Keeper:** the rival (§8.5).
- **Grandfather Hibachi:** the old oni who carried the Ember before Kagari; six-word lines. Does not come back from the
  night of HAMMER (Act 3).
- **The Orc General** (Arc 0's friend at Ironhold) went north to bring his old kin south; with the column when the
  Brigade crosses (Act 4).
- **Vesperline's machines** (the Noon Gate's faction): sentries, drones and Vesper Wardens still obeying the last order
  ever given, *hold the line*; the line is wherever the gate is, so the first of them follow the Last Watch out at 5-8.
- **Commander Kuroe:** honest, frightened, responsible for a whole city; usually right about the arithmetic and wrong
  about what it costs. After every action he reads the roll on Channel 9 himself, and the roll gets longer (§8.11).
- **The Night** (the Vesper Gate's faction: first its touched, the Rimebound, then the Shadow at the Gate): not a
  villain; a cold that wants in. In Act 8 it turns out to be someone the Sentinels once promised to keep warm.

### 7.3 The Brigade on the road

Our own city responders: navy and amber, white visors, the Brigade's gate-ring emblem, never camouflage and never a
flag (Q23). Eight units on rules the sim already has. Numbers are before stage `hpScale`; `threat` matches the groups
they replace, so no stage's budget moves.

| Unit | Tier | Look | Rule | hp · speed · class · armour · threat | When beaten | First |
|---|---|---|---|---|---|---|
| Gnat (recon drone) | normal | a palm-sized four-rotor drone with one camera eye | hasty | 12 · 1.6 · light · 0 · 1.2 | breaks apart in a spray of sparks; its screen reads LINK LOST | 3-9 |
| Response Trooper | normal | navy padded jacket, white visor, a stubby carbine of our own design | armour 1 | 40 · 0.85 · light · 1 · 3.5 | falls and fades out like any enemy, nothing left on the road: "Trooper down!" | 4-8 |
| Shieldline Trooper | normal | a tall pale-blue riot shield | guardian (−30 % within 1.6 tiles; blast ignores it) | 60 · 0.75 · light · 0 · 6 | the shield drops, he falls and fades out: "Close up!" | 4-8 |
| Foam Trooper | normal | twin tanks and a wide nozzle | sabotage (foams a girl for 3 s, every 7 s) | 34 · 0.95 · light · 0 · 4 | falls and fades out in a last puff of foam | 7-8 |
| Tortoise (response van) | elite | six wheels, a domed roof, a searchlight | armour 3 + splitter (three troopers bail out) | 240 · 0.6 · heavy · 3 · 16 | steam, the doors pop, its crew of three jumps out and keeps coming; the van breaks apart | 4-9 |
| Badger (light tank) | elite | squat and tracked, a short barrel, a dozer blade | armour 6 (splash crumbs bounce off) | 400 · 0.5 · heavy · 6 · 22 | the tracks lock and it breaks apart into smoke and scrap | 4-9 |
| Strider (rescue walker) | elite | two legs, a cockpit bubble, a shield dish | barrier 180 + armour 2 | 300 · 0.6 · heavy · 2 · 22 | its knees buckle and it breaks apart; the cockpit light goes out | 7-8 |
| The HAMMER Carriage | miniboss | eight wheels, a huge turntable barrel, stabiliser legs | guardian; at 66 % "Crew, brace!" (barrier 900); at 33 % "Ranging shot!" (a tear opens behind it; it speeds up and calls troopers) | 3,200 · 0.4 · heavy · 5 · 160 | breaks apart: "HAMMER's down! Fall back!"; its tear stays on the street | 7-9 (last wave) |

Held back: the Heron gunship (airborne and a summoner). Flyers arrive at 8-1, after the Brigade stands down, so in Arc 1
the Herons circle the summit as allies; as an enemy the Heron waits for freeplay, Bounty and Arc 2 (Q22).

**Voice.** UI barks, at most six words: "Contact front!", "Shields! Form a line!", "Tortoise rolling!", "They're
students! ...Go round them!", "Trooper down!", "Close up! Close up!", "Fall back! Fall back!", "Crew out! Crew out!",
and "Sorry! Sorry!" over the last trooper of a group still on the road. No bark or bestiary line describes a wound or a body.
Bestiary lines, for example: Gnat, "Watches everything. Understands nothing. Reports both."; Response Trooper, "Signed
up for floods and fires. Got a gate instead. Still says sorry." **The trooper who apologises** (no name, survives): the
one Hikari lets run in 4-9 and the last of his section, carried across the snow bridge on Hikari's back ("Sorry.
...Sorry about the guns." / "I'm sorry about mine."), handed a cup by Wakaba across the cordon on 7-8, and on a van
roof beside the girls at 8-7 ("Sorry about before. ...Where do you want me?").

---

## 8. Cast and soul-threads

| Thread | Morning | Noon | Evening | Its question |
|---|---|---|---|---|
| **Dawn** | Hikari | Mahiru | Commander Yūhi | what does it mean to protect someone? |
| **Ember** | Kagari | Azami | Shion (Arc 2) | what does it mean to keep someone? |
| **Twin star** | Arc 2 | Kohaku | Tsubaki | can two lives of one soul be friends? |
| **Sparrow** | unknown | Lt. Mori | Toki (unwoven) | what does a rescue cost? |

Each era has its own main cast; these threads tie some of them together. Luna's thread is frayed, so echoes reach her
as dreams.

### 8.1 Hikari (Morning · Dawn · adult hero · survives)
Wants to keep "Stand with me" true in a war. Fears being the reason someone falls. Gets wrong: war pulls her back to
"Stay behind me"; she sends Mahiru to the back of the shelter to keep her safe, which puts Mahiru beside the back door;
after Mahiru she tries to end the war alone. Carries: the hand off the hilt in Act 1 is a choice she keeps making where
she can ("Hold back wherever you can. Anyone who runs, let them run."); first light has nowhere to send a soldier of Itomachi, so when she
draws on 4-9 and on 7-8 and 7-9 the soldiers who fall stay fallen, and she takes each one as hers alone ("Then it's
mine. Not yours."), the Commander's flaw again. Turns: Luna's apology and the squad walking up the road behind her
("Not this time, Sunshine."). Changes: sets the Dawnblade down in front of Kagari, and of Kuroe, whose soldiers it
took, and asks her enemy for help. Lesson:
**"Standing together doesn't mean nobody falls. It means nobody falls alone."** Her core never breaks: she never gives
up, never blames a student, never wins alone.

### 8.2 Mahiru (Noon · Dawn · story character · dies in Act 7)
A first-year who had Sensei as homeroom teacher for one week. Tends the rooftop flower boxes because nobody else does,
apologises to furniture, carries things for everyone, taps twice over her heart before she says anything brave. Wants
to be useful; secretly, to matter. Fears she is too small to make a difference. Gets wrong: makes herself small, never
asks for help, keeps the little one secret because asking feels like being a bother. Turns: Ms. Hazuki goes back into
the fire for her (Act 3); on the rooftop Hikari and Sensei tell her she matters now (Act 7). Changes: at the back door
the motor has frozen and the street is pouring cold; she stays outside with her festival lantern until the last person
is in. Last words: "Captain? I'm not scared. ...Okay, I'm a little scared. Is that allowed?" / "It's allowed."

### 8.3 Commander Yūhi (Evening · Dawn · dead before Arc 1)
The last commander of Vesperline's Student Defence Corps, assembled from broadcasts that loop through the gates: early
(Act 2) bright and sure, "Vesperline holds. Get some sleep, everyone. I've got it."; middle logs (Act 4 side, Act 5)
tired, taking every watch herself; the last recording (Act 6) at the Vesper Gate with the Dawnblade in her hand. Her
flaw was carrying everyone; her change came too late. She found her own prior-life entry, read how the girl at the
door died, and redacted it. *"They made you into a mascot. You'd have hated that. You were small, and you held it
anyway. I couldn't protect everyone alone. I should have asked. You never had to be big. You only had to stay."* Then:
*"Sensei, if this reaches you: come earlier next time."*

### 8.4 Sensei
See §6.

### 8.5 Kagari, the Ember Keeper (Morning, far north · Ember · rival · survives)
A young oni (no age stated) who became keeper of the Ember when her mother froze holding it. Formal, proud, dutiful,
very tired; never makes war on children (in Act 3 she sends captured Hilltop students home with a message). Wants her
people warm by spring. Fears the fire going out on her watch. Gets wrong: takes warmth by force because asking never
worked for her mother; holds on to everything. Seen: the far shore (3), the parley (4), her camp at night (5 side), the
parade (7), unarmed Hikari in front of her (8). Turns: Hikari comes unarmed and asks; Azami makes the keeper's bow.
Changes: gives the Ember to the summit stone so the city's ward can wake, and leads her people home through the Petal
Gate. Voice: full formal sentences, never a contraction. "I do not ask. My mother asked the winter. The winter did not
answer."

### 8.6 Azami (Noon · Ember · free unit · the red herring · survives)
Checkpoint prefect, strict and secretly soft on first-years ("No running in the halls — or on my road."). Writes
citations for everything. Has dreamed of snow and fire all her life. Wants every first-year behind her barrier. Fears
losing a child on her watch. Gets wrong: sees the column as a threat to her children; accepts the board's verdict ("Then
I will be the door.") and the squad guards the wrong door with her. Turns: Mahiru ("It should have been me."). Her
first citation against an order ("Citation: Commander Kuroe.", Act 4) stays in her pocket, with the parking tickets she
wrote the Brigade's vans at her checkpoint, kept for every crew that did not answer Kuroe's roll; she fought those crews
too. Changes: at the checkpoint in Act 8 she lifts her own barrier ("There are first-years on both sides of this
line.") and hands Kuroe the citation, "For the back door.", with the kept tickets and one more citation, against
herself: "I was there too." He reads it twice and holds fire, and the Brigade climbs the mountain beside them.

### 8.7 Kohaku and Tsubaki (Noon and Evening · Twin star · duo unit · both survive)
Kohaku: student-council secretary and Science Club regular; corrects your grammar, then brings you tea. Tsubaki: the
Commander's last cadet commander; strict, punctual, times everything; Kohaku's next life, and she knows it (Vesperline
children look up their prior life on their first day). Tsubaki wants to finish the last order ("Get them out") and keep
Kohaku alive; fears being only a consequence of someone else's life; smothers Kohaku with protection. Kohaku wants to
understand the gates; fears being wrong; pries into the Register harder than anyone, and the twist is her own decode,
finished a minute too late. Turn: Act 6's flicker. Gift: "You'll live a long time. In a house by the lake. Too many tea
plants. It's the only thing I ever looked up." Change: "I'm not your past. I'm your friend." Their promise to guard the
academy's night sky opens the **Starfall Trial** after Act 6.

### 8.8 Tenka (Evening · survivor · the one who explains)
A physics prodigy who writes equations on whiteboards, fogged windows and bento lids, and bickers with Midori. Alive
because a commander held a gate for her. Gets wrong: thinks the right equation will make the guilt go away. Turns: as
Hikari runs for the back door, Tenka flickers, because saving Mahiru would unweave the Evening that made her: "Go
anyway." Changes: lives as someone who was paid for; Kinu teaches her that a finished stitch cannot be unpicked, you
mend around it; she writes Mahiru's name on her coilgun and works out the keychain loop in Act 8.

### 8.9 Kinu (Noon · Handicraft Club)
Counts every stitch aloud. Wants to make things whole; fears what cannot be mended. Gets wrong: mends faster as the
losses grow. Turns: after Mahiru she stops fixing and starts remembering: the memorial banner, one row per name, and
one more for Toki, a name she does not remember. Her stitch matters twice: the umbrella Sensei left in spring, and the
scarf "for a cat". In Act 8: "...That's my stitch."

### 8.10 Luna (Morning · frayed thread · hero)
All her life she has dreamed of a city burning at noon and a door with a lantern. She never saw a face, and kept silent
because a prophecy without a name only teaches fear, and would have put Hikari on that door. Act 8: "I knew a door. I
never knew a name. ...I'm sorry, Hikari." From then on she tells every dream, starting with a white tower that never lets
anyone leave (Arc 2).

### 8.11 Kuroe, Mori and Toki
- **Kuroe** (adult NPC, survives). Gets wrong: HAMMER on the far shore (3), the strike through the Petal Gate (4), the
  cordon round the festival and the guns on the back street (7), signing the little one into custody (5). Pays: he
  reads the roll on Channel 9 after every action, and it gets longer (the strike squad on 4-8 and 4-9, the cordon on
  7-8, the back-street crews on 7-9). Each silence pushes him toward more guns: when half the squad's channel goes
  quiet, HAMMER falls on the gate mouth and takes the General's bridge; on 7-9 his own carriage's ranging shot tears the
  street that freezes the back door. Turns: Azami's citation at the checkpoint (`g8.mid`), with the tickets of his dead
  crews and her own name on the last page; the numbers become names: "...I sent every one of them. All units. Hold
  fire." Changes: puts the Brigade beside the cast against the Night (8-7 … 8-10); after the summit, for the first
  time, every name on his roll answers; stands HAMMER down for good, answers Nami's letter ("Received. Standing
  down."), confesses where the specimen went. He can turn because the other side counted his dead with him.
- **Mori** (adult NPC, Sparrow). Dad jokes on Channel 9, rice balls for Kage's crackers, terrified of Wobble. On
  HAMMER night Channel 9 has "very bad reception" while the Sentinels ground the spotter drones (3-9). The Register
  drowns him at the reservoir; the Sentinels pull him out (5). In Act 8 he whistles four notes he says he made
  up himself.
- **Toki** (Evening NPC, Sparrow). The littlest runner; calls everyone "senpai"; whistles four notes she made up and
  makes Sensei promise not to forget. Her prior life is Mori. Unwoven between one line and the next (5); only Sensei
  remembers there were three survivors, and keeps the promise: her row on Kinu's banner (8).

### 8.12 Ms. Hazuki (Noon · adult NPC · dies in Act 3)
Covered Sensei's classes all spring and kept Sensei's desk and mug as they were; running argument about who owes whom
lunch. On the festival night she goes back into the burning Old Town twice: once for Mahiru, once for a boy who dropped
his phone. She does not come back from the second trip. Sensei leaves a lunch on her empty desk; her class answers
"Present".

### 8.13 Smaller arcs
Nami runs the ferries and is first up the road behind Hikari ("Not this time, Sunshine."). Kage: Suspect Board Season
Two ("WHO OPENED THE GATES?", "HAMMER MAKES GATES??", "WHO IS THE DOOR GIRL?"), Mahiru's name last and small in the
corner, then Season Three. Rei: a Flower Ledger page headed "Lost"; waters the rooftop flowers every morning. Kaede
bows to an empty snow bridge and carries the General's helmet home. Hotaru: "It isn't lonely. It's grieving." Yuzuha
(free) stops sleeping in the war and falls asleep on Sensei's desk at the memorial. Wakaba (free): "Hydrate! Everyone!
Even the oni!" Chika switches off a machine still heating an empty shelter. Suzu: "I have a bell for everything. ...I
don't have one for this." Yuki: "So this is where the cold came from." Shiro measures three skies over one mountain.
Behind `ifUnit`: Noa runs out of plasters and keeps going (3); Iroha paints the Old Town the day before it burns and
finds the painting in Vesperline's museum (3, 6); Ena's prophecies are about lunch until "This one isn't about lunch"
(7); Fuu carries the news of Ms. Hazuki without twirling (3) and leads the first-years by dance count (7); Hana's falcon
will not fly (4); Kanna's rematch (7); Yoriko's puppet play (7); Seiran races the Night's edge (8). The Brigade's trooper
who apologises (no name, survives) runs from 4-9 to 8-7 (§7.3).

---

## 9. The mystery

**Questions, nested:** (1) Who is the Commander talking to? (Acts 2-6). (2) Who is the girl at the door? (Acts 5-7).
(3) Who is Mahiru? (the question nobody asks, and the answer to both). Underneath: where does the cold come from? (the
shipped open question) and why is Sensei the Constant? (Arc 2+).

| # | Act | Clue on screen | Read as | Paid off |
|---|---|---|---|---|
| 1 | 1 | the first crack opens between the Wall and a rooftop at the minute Hikari and a stranger both watch the sunrise | coincidence | 7, finale |
| 2 | 1 | Mahiru taps twice over her heart; Hikari does too before every sunrise | a cute habit | 6 (the Commander), cliffhanger |
| 3 | 1 | a slime hit by a drone does not pop; the air crackles | tone shift | 4 (rule 6) |
| 4 | 1 | the MISSING poster; Sensei's face always covered | a gag | 6 |
| 5 | 2 | Kohaku's meter reads Sensei as zero | a gag | 5 (no thread) |
| 6 | 2 | "This is Commander Yūhi. Vesperline holds. The dawn is never late." | a Sentinel saying | 6, 7 |
| 7 | 2 | Mahiru: "She sounds like someone who's never scared." | admiration | 6-7 |
| 8 | 2 | a small grey winged thing in a scarf "for a cat"; "It follows warm things." | cute B-plot | 8 |
| 9 | 2 | static: "...prior: Itomachi, Noon..." | nonsense | 5 |
| 10 | 2 | Sensei calls Mahiru "a small Captain" | warmth | 7, finale |
| 11 | 3 | Mahiru wins a paper lantern | festival cute | 7 |
| 12 | 3 | HAMMER leaves a black-violet tear over the shrine | gate magic | 4-5 |
| 13 | 3 | the Ashen Warden: "Halt. The shrine... fell." | a darker armour | shipped lore |
| 14 | 4 | Azami's dreams of snow and fire; the keeper's bow | colour | 8, Arc 2 |
| 15 | 4 | something vast calls over the far north; Hana's falcon will not fly | a monster | 8 (a mother) |
| 16 | 5 | Luna: "I dream of a city burning at noon. And a door." | riddles | 8 |
| 17 | 5 | Tsubaki goes white at Kohaku's name | trauma | 6 |
| 18 | 5 | the empty boiler pipe; "GRB · SPECIMEN 0" | heartless Brigade | 6, 8, Arc 2 |
| 19 | 5 | "Four hundred lived because a student held the door." Doorie is that girl | a city myth | 7 |
| 20 | 5 | Kage's Door Girl list has every girl but Mahiru | a running joke | 7 |
| 21 | 6 | *The Quiet Stones* as a picture book in the museum | an echo | 8 side (P7) |
| 22 | 6 | an empty chair labelled SENSEI; the cracked card | impossibility | cliffhanger |
| 23 | 6 | the last recording: a redacted name, the notch, "come earlier next time" | grief | 7, cliffhanger |
| 24 | 6 | the Doorie statue with a keychain cast at its belt | a monument | 7 (P4) |
| 25 | 6 | a frozen nest; grey knitted wool in the ice | dread | 8 |
| 26 | 7 | Hikari and Mahiru watched every sunrise from the same spot | warmth | 7 (one soul) |

---

## 10. Reveals

- **Act 5, "It's already written."** In the drowned subway the Last Watch walks out of the Noon Gate. Kohaku reads
  Tenka's slate: Vesperline is Itomachi's future; Vesperline is gone; this war's dead are already in the Register.
  Hikari: "Then we unwrite it." They pull Mori out of the reservoir; Toki is gone between one line and the next.
- **Act 7, "The name is Mahiru."** The squad guards the main door with Azami. Kohaku's decode: *Prior life: MAHIRU.
  Place: Hilltop Shelter 3, east service door.* The back door, where Hikari sent the small first-year to be safe. Hikari
  runs; Tenka and Tsubaki flicker ("Go anyway."); the door is closing when she gets there.
- **Act 8, "That's my stitch."** The Night pours through the Vesper Gate in a shape with grey wool trailing in its
  shadow. It is the little one from the boiler room, kept warm for centuries until it grew cold and enormous.

---

## 11. The eight modern acts

Order: a city (Act 1), then a school (Act 2), then the city destroyed (Act 3); then up the mountain and across into the
fantasy north (4), under the city (5), into the dead future (6), back to a festival in the ruins (7), the summit (8).

| Act | Stages | Setting · look | Mood | Story beat | Lead families | x-10 boss | Stone relit | Retells (Act I) |
|---|---|---|---|---|---|---|---|---|
| 1 · Rush Hour | 1-6…1-10 | Itomachi downtown · `city`, day | homecoming comedy; first silence at the end | the first crack; Sensei is home; Mahiru; goblins in a convenience store; the Brigade fires first | slime, goblin (+ orc grunt, boar); Brigade drones as dressing | The Frostbitten Heir | the plaza's dry fountain | a slime on a fountain throne |
| 2 · Hilltop After Dark | 2-6…2-10 | Hilltop High · `campus` + `night` | school comedy; a night watch | Shelter 3; uniform day; the Commander's voice; the little one | lizard, slime, goblin | Old Lamp-Hugger | the boathouse lamp | lizards round a lantern; a voice in the dark |
| 3 · The Bell Festival | 3-6…3-10 | Old Town, Lakeside Shrine · night → `ruined: burning` | the warmest festival, then the turn | the Petal Gate opens; HAMMER; the Old Town burns; Ms. Hazuki and Hibachi | ghost (+ earlier); Brigade spotter drones on 3-9 | The Ashen Warden | the shrine bell | a bell nobody rings; an armour that will not bow |
| 4 · The Checkpoint | 4-6…4-10 | the mountain highway → the far north (`snow`) | military, cold | Azami and Kagari; the Brigade crosses to the fantasy side and the Sentinels hold a frozen village against it, where first light does not hold its soldiers; the Orc General holds the bridge | orc, beast, Brigade (4-8, 4-9) | The Frost Vanguard | the tunnel's beacon lamp | the orcs leaving the mountains |
| 5 · The Drowned Line | 5-6…5-10 | under the city · `drowned`, fog | horror fog, then the mid-arc reveal | Luna; the Last Watch; the raid; the Register; Mori saved, Toki unwoven | ghoul, plant, Vesperline's machines (from 5-8) | The Reservoir Willow | the reservoir willow | a fox in the fog; a shivering willow |
| 6 · Vesperline | 6-6…6-10 | the destroyed future · `vesper` + `ruined: frozen` | awe and grief | the picture book; the empty chair; the last recording; the flicker; the nest | Vesperline's machines (+ stragglers; the first Rimebound at 6-10) | Gatekeeper Unit 01 | none | a machine that was really a heater |
| 7 · The Night Parade | 7-6…7-10 | festival in the ruins · `ruined: after`, night | the bravest festival, then the worst night | the Brigade's cordon and its guns on the back street; the same sunrise; the wrong door; the decode; the back door | oni, fae, Brigade (7-8; 7-9 with the HAMMER Carriage) | The Ember Champion | Hilltop's boiler, the festival taiko | a festival, a champion, a rematch |
| 8 · Hearth of the Long Day | 8-6…8-10 | mountain road → three skies | grief into resolve, then wonder, then the hook | Hikari alone, then not; she asks Kagari; the Brigade stands down and climbs beside them; the Night wears Kinu's stitch; the ward wakes; the pin slips | dragon (Petal lanes), machines (Noon lanes), the Night (Vesper lanes); the Brigade and Kagari's people are allies from 8-7 | The Shadow at the Gate | the summit stone | "Stay behind me — no. Stand with me." |

---

## 12. Scene list

Ids use `gN.*`. `before` plays when the stage is opened, `after` on the first clear, in the order listed. **Every act
has exactly six cutscenes, joins included** (the 4-6 rule; side and bond scenes are optional). Acts 1, 4 and 7 have five
main episodes and a join, and in Acts 4 and 7 the join also carries a main beat. Every episode keeps the shipped shape (8-18 lines, at most one choice, opens with narration or Hikari, at most four
portraits) and **Hikari speaks in every episode**, in person or on Channel 9. Quoted lines stay at or under 110
characters. Side scenes are kind `event` (0 gems); *ifUnit* scenes wait for that girl. One content note plays before
`g1.pro`: "This arc contains war and loss."

| Act | Trigger | Id | Title | Kind |
|---|---|---|---|---|
| 1 | before 1-6 | `g1.pro` | Two Sunrises | main (sample 2, part 1) |
| 1 | after 1-6 | `g1.mahiru` | You Came Back | main (sample 2, part 2) |
| 1 | after 1-7 | `g1.yuzuha` | Deploying | join: Yuzuha |
| 1 | before 1-8 | `g1.mid` | Hot Case | main |
| 1 | after 1-8 | `g1.poster` | Missing | side |
| 1 | before 1-10 | `g1.boss` | The Dry Fountain | main |
| 1 | after 1-10 | `g1.epi` | First Silence | main |
| 2 | before 2-6 | `g2.pro` | Exchange Students | main |
| 2 | after 2-6 | `g2.kohaku` | The Most Boring Object in the City | side (sample 1, part 1) |
| 2 | after 2-6 | `g2.thirtyone` | Thirty-One | side (sample 1, part 2) |
| 2 | after 2-7 | `g2.lunch` | Lunch Debt | side |
| 2 | before 2-8 | `g2.mid` | Static | main |
| 2 | after 2-8 | `g2.boiler` | Something Small | main |
| 2 | after 2-9 | `g2.class` | The Old Class | side, *ifUnit* Ruri, Iroha, Ena or Fuu |
| 2 | after 2-9 | `g2.roof` | Rooftop Flowers | side |
| 2 | before 2-10 | `g2.boss` | Cats on a Stove | main |
| 2 | after 2-10 | `g2.after` | Roll Call of Static | main |
| 2 | after 2-10 | `g2.epi` | Night Tea | main |
| 3 | before 3-6 | `g3.pro` | Bowing Contest | main |
| 3 | after 3-7 | `g3.iroha` | The Day Before | side, *ifUnit* Iroha |
| 3 | before 3-8 | `g3.mid` | Fog on the Water | main |
| 3 | after 3-8 | `g3.hammer` | Hammer | main (the turn; Hikari: "Those drones are HAMMER's eyes. Ground them.") |
| 3 | after 3-9 | `g3.noa` | Plasters First | side, *ifUnit* Noa |
| 3 | before 3-10 | `g3.boss` | The Ashen Warden | main |
| 3 | after 3-10 | `g3.after` | Roll Call | main |
| 3 | after 3-10 | `g3.epi` | Two Fires | main |
| 3 | after 3-10 | `g3.fuu` | No Twirling | side, *ifUnit* Fuu |
| 4 | before 4-6 | `g4.pro` | No Running on My Road | main |
| 4 | after 4-7 | `g4.azami` | Across the Barrier | join: Azami, at her own checkpoint; carries the parley with Kagari and the keeper's bow |
| 4 | after 4-8 | `g4.cross` | The Other Side | main (the crossing; 4-9 is already across; at the tunnel mouth first light has not held the fallen troopers; Hikari's choice for the far side: "Hold back wherever you can. Anyone who runs, let them run.") |
| 4 | after 4-8 | `g4.logs` | Night Watch Logs | side |
| 4 | before 4-10 | `g4.boss` | The Frost Vanguard | main (what is left of the squad at the bridgehead) |
| 4 | after 4-10 | `g4.after` | The Bridge | main (HAMMER answers the squad's silence; the General holds the bridge; Hikari carries the last trooper of a section across: "Sorry about the guns." / "I'm sorry about mine.") |
| 4 | after 4-10 | `g4.epi` | Gates Bloom | main (Kohaku's chart; Kuroe reads the squad's roll; Azami keeps the vans' tickets) |
| 5 | before 5-6 | `g5.pro` | Lost Already | main |
| 5 | after 5-7 | `g5.embers` | The Keeper's Night | side |
| 5 | before 5-8 | `g5.mid` | Two from the Fog | main (Vesperline's machines follow the Last Watch out of the gate) |
| 5 | after 5-8 | `g5.raid` | Specimen 0 | main |
| 5 | after 5-9 | `g5.whiteboard` | The Long Day | side |
| 5 | before 5-10 | `g5.boss` | The Register | main |
| 5 | after 5-10 | `g5.after` | Already Written | main |
| 5 | after 5-10 | `g5.epi` | Two Cups | main |
| 5 | after 5-10 | `g5.board` | Door Girl | side |
| 6 | before 6-6 | `g6.pro` | Hold Hands | main |
| 6 | after 6-7 | `g6.sleep` | Four in the Morning | side |
| 6 | before 6-8 | `g6.mid` | Museum of Noon | main |
| 6 | after 6-8 | `g6.chair` | The Empty Chair | main |
| 6 | before 6-10 | `g6.boss` | The Last Recording | main |
| 6 | after 6-10 | `g6.after` | Flicker | main |
| 6 | after 6-10 | `g6.epi` | A Long Life | main; opens `side-6-starfall` |
| 6 | after 6-10 | `g6.doorie` | Doorie | side |
| 6 | before / after `side-6-starfall` | `g6.star1`, `g6.star2` | the duo's bond scenes | bond |
| 7 | before 7-6 | `g7.pro` | Festival in the Ruins | main |
| 7 | after 7-7 | `g7.wakaba` | Hydrate! | join: Wakaba; carries the wrong-door plan (Kage's board names Azami; Kohaku "Give me an hour") |
| 7 | before 7-8 | `g7.mid` | Same Sunrise | main |
| 7 | after 7-8 | `g7.fuu` | Follow the Fan | side, *ifUnit* Fuu |
| 7 | before 7-10 | `g7.boss` | The Parade | main (Kuroe's roll after the cordon and the back street; the festival's warmth draws the Ember's household down the arcade) |
| 7 | after 7-10 | `g7.after` | The Back Door | main (sample 3, part 1: the decode and the door; the street HAMMER tore at 7-9 pours cold) |
| 7 | after 7-10 | `g7.epi` | Doorie | main (sample 3, part 2: the morning) |
| 7 | after 7-10 | `g7.azami` | It Should Have Been Me | side |
| 8 | before 8-6 | `g8.pro` | Stay Behind Me | main |
| 8 | after 8-6 | `g8.water` | Ask the Water | side |
| 8 | before 8-7 | `g8.mid` | Unarmed | main (before 8-7: the sword set down; the barrier lifts; Azami's citation, the kept tickets and one against herself; the Brigade holds fire and climbs beside the cast) |
| 8 | after 8-7 | `g8.banner` | Kinu's Banner | side |
| 8 | after 8-8 | `g8.storm` | Storm Edge | side, *ifUnit* Seiran |
| 8 | after 8-9 | `g8.tune` | Mori's Tune | side |
| 8 | before 8-10 | `g8.boss` | The Shadow at the Gate | main |
| 8 | after 8-10 | `g8.after` | First Light, Twice | main (a roll in which every name answers; Kuroe stands HAMMER down for good) |
| 8 | after 8-10 | `g8.epi` | She Was Mahiru | main |
| 8 | after 8-10 | `g8.end` | Come Earlier | main (the cliffhanger) |

**Count:** 48 cutscenes, six per act: 45 main (five in Acts 1, 4 and 7, six elsewhere) and 3 join; plus 21 side and 2
bond. Free slots for later scenes: after 1-9, 3-6, 4-6, 4-9, 5-6, 6-9, 7-6 and 7-9, plus every empty *before*. Every new map gives its scenes a free background
(`stage:<id>` stills).

**In-battle radio lines.** A stage may carry `radio: [{ wave, speaker, line }]`: a Channel 9 line shown in the toast
style at a wave's start, two to four per stage, UI only. Examples: 1-9 wave 6, Mori: "Channel 9. Train coming through.
Mind the barrier."; 4-7 wave 3, Azami: "Gate's shut. Long way round. No running."; 7-9 wave 27, Kohaku: "Still
decoding. Give me an hour." The scene rules do not apply to radio lines; the spoiler rules do. With the Brigade on the
road: 3-9, Hikari: "Those drones are HAMMER's eyes. Ground them. Gently." and Mori: "Channel 9... very bad reception
tonight."; 4-8, Kuroe: "All units, push for the gate. The parley is over." and Kohaku: "Captain? The troopers don't
sparkle. ...Why don't they sparkle?"; 4-9, Azami: "Anyone who runs, we let run. Captain's orders." and, at the first Badger, Hikari:
"Not the hearths. Not the children. ...I'm sorry."; 5-8, Tsubaki: "Those are ours. They're
still holding the line."; 7-8, Kuroe: "Cordon, hold the ticket gates. Sound off every wave." and Wakaba: "Hydrate! Even the Brigade!"; 7-9 wave 30, Mori: "HAMMER's on the back street.
...I'm sorry."; 8-7, a trooper on a van roof: "Sorry about before." **Brigade barks** (UI only): one short callout
over a Brigade group when it spawns and over a unit when it is beaten, from the list in §7.3.

---

## 13. Bosses

Every x-10 boss is a new EnemyDef on an existing family GLB (tint, scale, props, phases). The arc's one new model family
is the Brigade (§7.3); its HAMMER Carriage is a set-piece miniboss on 7-9's last wave, not an x-10 boss.

| Stage | Boss | Built from | Retells | How it ends |
|---|---|---|---|---|
| 1-10 | **The Frostbitten Heir** | Slime Prince GLB, frost tint and crown; splits into Royal Guard Slimes | the Prince on the warm fountain throne | "First light": it poofs home through the crack |
| 2-10 | **Old Lamp-Hugger** | Bog Basilisk at miniboss scale, regeneration; Marsh Hunters, Pearl Slimes | the basilisk round the pier lantern | the lamp lights; it lets go and goes home |
| 3-10 | **The Ashen Warden** | Hollow Samurai GLB, charred, phasing; Lantern Bearers | the lonely armour at the bell | the bell rings over ash; it rests |
| 4-10 | **The Frost Vanguard** | Orc Warlord GLB in frost iron, guardian; Alpha Wolf, Shieldbearers | the General's stand at Ironhold Gate | it breaks off when the children are across |
| 5-10 | **The Reservoir Willow** | Elder Treant at miniboss scale, brood; Grave Priests | the shivering Drowned Willow | the willow stone wakes and it sleeps |
| 6-10 | **Gatekeeper Unit 01** | Iron Colossus at miniboss scale, crystal shell; Vesper Wardens | the Goblin Machine that was a heater | Chika switches it off: it was heating an empty shelter |
| 7-10 | **The Ember Champion** | Oni Champion GLB, three stances; Mirror Queen, Taiko Oni | the Champion and Kanna's trophy | he yields inside the drum's light and goes home |
| 8-10 | **The Shadow at the Gate** | Eclipse Wyrm GLB at campaign tier; Cinder Wyverns; the shipped last-phase banner "The eclipse breaks — the Ashwing Matriarch tears free!"; the freed Matriarch circles the board as an allied set piece, never a target | the mother keeping her children warm | the mother breaks her child's shadow; the Night flinches back through the gate |

**The Brigade's set piece (7-9, last wave): the HAMMER Carriage.** HAMMER night brought to the back street: guardian
over its escort, "Crew, brace!" at 66 % (a barrier), "Ranging shot!" at 33 % (a black-violet tear opens on the street
behind it). When it breaks apart ("HAMMER's down! Fall back!"), the tear stays on the back street,
where the cold pours through in `g7.after`. The wave pays for it from its elite budget, so 7-9 stays below 7-10.

---

## 14. Deaths and the roster

| When | Who | Why | What it costs the survivors | How it changes the war |
|---|---|---|---|---|
| Act 1 | a frostbitten little slime (never Wobble) | a Brigade drone hits it outside any lit stone | the first silence | relighting Itomachi's stones becomes the goal |
| Act 3 | **Ms. Hazuki** (adult NPC) | goes back into the burning Old Town a second time | Mahiru's guilt; Sensei takes her class; "Present" | the Noon Gate tears; Kuroe hardens |
| Act 3 | **Grandfather Hibachi** (Emberfolk elder) | HAMMER on the far shore, the same night | Kagari stops holding back | both sides lost a teacher on the same night |
| Act 4 | **the Orc General** (Arc 0's friend) | holds a snow bridge under HAMMER for soldiers and refugees alike | Kaede's bow is never returned; Ironhold Pass has no guard | first proof to the Brigade that the Host are refugees; rule 6 named |
| Act 4 | **the strike squad's fallen** (Brigade troopers, unnamed on screen) | sent through the Petal Gate to strike the Host at its source; they fall on 4-8 and in the frozen villages (4-9) to the Sentinels holding the road, and first light does not send them home | the Sentinels: the first silence after a won battle; Hikari learns first light cannot send home a soldier who is already home, and takes every fall as hers; Azami keeps the vans' tickets. The Brigade: Kuroe's first roll with silences; the trooper who ran is the last of his section | Kuroe answers with HAMMER on the gate mouth, which takes the General's bridge; Kohaku's chart shows pinholes over the villages too: killing makes the Merge worse, whoever does it |
| Act 5 | **Toki** (unwoven, not dead) | the price of saving Mori | only Sensei remembers; two cups | every later rescue has a known price; Sensei stops keeping secrets |
| Act 7 | **the cordon and the back-street crews** (Brigade) | the cordon round the festival (7-8) and the guns on the back street (7-9), held off the festival and the shelter doors by the Sentinels | the Sentinels: Hikari, now the reason people fell, sends Mahiru "behind me". The Brigade: a longer roll on Channel 9 | Kuroe's arithmetic breaks: his own ranging shot tore the street that froze the back door; Azami's citation, with every ticket, turns him |
| Act 7 | **Mahiru** (story character) | holds the back door until the last evacuee is in | everyone | Hikari's fall and recovery; the alliance with Kagari; the end of HAMMER; the pin slips |
| before | **Commander Yūhi** and Vesperline | the Fall | found through recordings and ruins | the mystery's engine; the plea that holds the gates |

**Roster (default, open question Q2): no playable girl dies in Arc 1.** The heaviest losses fall on people the player
knows well and does not own. The paradoxes make danger to units real without spending them: Kohaku nearly dies (Act
6, Tsubaki flickers); Tenka and Tsubaki flicker in Act 7, choosing to risk never having existed. Every death gets a
*before* scene (warm or funny, no more than one act earlier) and an *after* scene (grief on screen, a ritual, a change).
The Brigade's fallen are the arc's unnamed dead: their *before* is on the map and the radio (a ticket under every van's
wiper at Azami's checkpoint on 4-7, Mori's chatter on Channel 9), their *after* is Kuroe's roll and Azami's kept pages.

**How deaths are written.** No bodies, no wounds, no anatomy. A death is shown through an absence: a name that does not
answer, a door that closes, a keychain on a handle, a cup not set out, a helmet carried home. Grief lasts more than one
scene. Comedy comes back slowly, and the survivors bring it back. This keeps a teen rating.

**Who falls on the road.** A monster knocked down inside first light goes home; a machine breaks apart; the Night
flinches back. A Brigade soldier who falls does not get up: first light has nowhere to send him, because he is already home. On the battlefield
every beaten enemy leaves the same way (it falls and fades out, with no blood and nothing left on the road), so the
cost is carried in scenes: a helmet in the snow, Channel 9's roll with silences in it, Azami's kept tickets. The named
deaths above still happen off the battlefield; the Brigade's fallen are the only deaths in the arc by a student's hand.

**Died vs unwoven vs reborn.** Died: the person and her life are gone; her thread passes forward into someone new with
no memories, only echoes. Unwoven: a contradiction unmakes her; she has never been; she flickers first; only the
Constant remembers. Reborn: a new person carries the thread; "She was Mahiru" is said before the first-year Yūhi ever
appears.

---

## 15. Tone

Everyday scenes are silly, cute and warm; the main arc's big beats are grim and serious.

| Act | Silly and cute | Grim and serious | The turn |
|---|---|---|---|
| 1 | Hikari on a traffic light; goblins hoarding hand warmers; the pigeon on the poster; "Deploying." | a slime that does not pop | the last beat |
| 2 | uniform day; the garden-hose tie; the mended umbrella; lunch debt; night tea | a voice from a dead city; a crate-shaped worry | a seed |
| 3 | the bowing contest; the takoyaki prophecy; a paper lantern | HAMMER; the Old Town burns; a teacher lost on each shore | the first hard turn, after 3-8 |
| 4 | Azami's whistle stops an orc; "a very good booth"; a trooper who keeps saying sorry | frozen villages; fighting the city's own squad, and first light not holding them; a roll call with silences; the General's bridge | the crossing |
| 5 | Luna's entrance; rice balls for crackers; Tenka against Midori | already written; Toki unwoven; two cups | after the boss |
| 6 | holding hands to cross; "too many tea plants"; Doorie | a dead city; the empty chair; the last recording | awe, then grief |
| 7 | the sweetest act: the festival, the right amount of boom, "Hydrate!", the same sunrise | the guns on the back street and the roll after them; the decode; the back door | the hardest turn, straight after a won battle |
| 8 | Nami's reply; Yuzuha asleep; water for the oni | Hikari alone; the Night at the gate; the memorial | grief into resolve, wonder, the hook |

**Rules of contrast.** Every grim beat is preceded by the same characters, happy, in the same place. Every grim episode
keeps one small kindness. From Act 5 on, every cute episode carries one shadow. Never a joke after a death in the same
episode; the first laugh after a loss is gentle and about the person.

**How the war is shown (decided Oct 20, Q19 answered: a full lethal war, no gore).** The war with the Brigade is lethal
on both sides. On the road a beaten soldier falls and fades out like every other enemy (the shipped fade, without the
sparkle of a creature going home): no blood, no wound, no body, nothing left on the road. Its machines break apart into
smoke and scrap. First light does not save soldiers: it was sung for the wilds (rule 5), and every fall is a pinhole
(rule 6). The content rules hold: no gore, no torture, no bodies or wounds shown, no dismemberment; a death is carried
by absence and by what it does to the people left on both sides: a helmet in the snow, Kuroe reading the roll and its
silences, the tickets Azami keeps, the last trooper of a section on Hikari's back. Hikari's restraint is a choice she
keeps making where she can, not a rule the story protects: she lets go of the hilt in Act 1, tells the squad "Hold back
wherever you can. Anyone who runs, let them run." in Act 4, and draws anyway when the squad's guns turn on the
children's hearths (4-9) and on the festival and the shelter doors (7-8, 7-9). It weighs on her and on the squad. The
ending stands on that cost being shared: Hikari sets the Dawnblade down *because* of what it has cost; Kuroe turns when
Azami cites him and herself for the same names; the trooper Hikari carried stands on a van roof beside the girls at
8-7; and after the summit, for the first time, every name on the roll answers. Vesperline's machines break apart; the
Night flinches back through its gate.

**Writing rules kept and changed.** Kept everywhere: no romance, no bodies, no fanservice, no swimwear; students are
never sexualised; adult heroes may be glamorous but are never framed around their bodies; no ages; original writing;
`{name:id}` tokens; no looks in dialogue; Hikari's core never breaks; every chapter has one laugh and one quiet
moment. Changed for Arc 1: an antagonist side with understandable motives; bosses in main beats need not go home better
off; the violence words are allowed in Arc 1 files only (the writing still prefers weight to anatomy); invaders' lines
may be grim within the six-word limit. Added: no gratuitous gore or torture detail; a lethal war with the Brigade, shown without gore (Q19).

---

## 16. Finale, cliffhanger, Arc 2

**`g8.after` "First Light, Twice".** The three gates line up over the summit and the Night pours through. Hikari has set
down her sword and asked; Azami has lifted her barrier; Kagari's people, the Brigade and the Sentinels hold the road together (the Brigade's
searchlights on the summit, Herons circling the gates). At the
last phase the shipped banner plays and the Matriarch breaks her child's shadow with her warmth; the Night flinches back
through the gate. The Ember and the Dawnblade wake the summit stone, and Itomachi's ward hums for the first time in a
thousand years. The Emberfolk walk home through the Petal Gate, the Matriarch carrying the smallest over the pass. Kuroe,
who held fire at the checkpoint, reads a roll in which every name answers, stands HAMMER down for good, answers Nami's letter and tells the truth about the specimen. Hikari: "Then
I'll find it."

**`g8.epi` "She Was Mahiru".** The memorial: Kinu's banner and the extra row for Toki; Rei's ledger; Yuzuha asleep on
Sensei's desk. Sensei's choice: "She was Mahiru." / "Her name was Mahiru." Hikari hangs the Doorie keychain on the
rooftop flower box. Then the Wall at sunrise: "Sensei! Up here — on the wall! ...Bring the whole squad! It's a very long
wall." Everyone comes. Kagari watches from the gate. There is one space on the Wall that nobody fills.

**`g8.end` "Come Earlier" (the cliffhanger).**
1. The pin slips. Above Hilltop's rooftop the Noon Gate shudders and the frozen ruins melt into morning: a living
   Vesperline. Tenka: "That's before. That's years before."
2. Hikari, only to Sensei: "Go. Someone asked."
3. Sensei goes through alone.
4. A first-year collides with Sensei, apologises three times, taps twice over her heart. Her badge reads **YŪHI**. She
   remembers nothing. "Are you the new teacher? ...That's weird. I feel like I've been waiting for you."
5. She hands over a card: **SENSEI · Faculty Advisor · Student Defence Corps.** In Sensei's other pocket is its cracked
   twin: *MISSING since the Fall.*
6. The white tower glows warm amber. The PA: *"Good morning, Vesperline. Thanks to the Spindle, no one you love will ever
   have to leave."*
7. "...You came."

Cut to black: "End of Arc 1 · The Girl at the Door." Nobody comes back: Yūhi is someone new, and "She was Mahiru" was
said before the gate opened. The paradox is now the player's own: Sensei is on record in a future Sensei has not lived.

**Arc 2 · "The Evening Before the Night".** A living Vesperline years before its Fall. Its gentle director, **Shion**
(the Ember thread's Evening life), is about to switch on the Spindle's true purpose: to hold every citizen's thread at
death so no one ever passes on as someone new, a ward that never lets go, kept warm at its core by something enormous
asleep in a frayed grey scarf. Yūhi is a first-year who wants to be useful; Sensei is her teacher. Every rescue has a
price: if the Night never falls, the spring is never cold, the eggs never hatch, and the Quiet Stones never happen. In
the Morning, Hikari begins to flicker. Arc 2 ends at the Fall, with Sensei present.

Threads Arc 2 picks up: the faculty card; the little one and "long-term custody"; Shion and the Spindle; Yūhi as a
student and Hikari's flicker; whether Toki can be woven back (Mori's four notes); the Twin-star and Sparrow threads'
Morning lives; why the Constant has no thread and where Sensei was before Itomachi; the founders' crossing, which must
still happen; whether Moonpetal is before Itomachi or after Vesperline; halos; the Emberfolk as Moonpetal's neighbours;
Itomachi rebuilding into Vesperline; Luna's white tower; Kage's Season Three, "WHY IS SENSEI THE CONSTANT?"

---

## 17. The 40 stages

"Act II of chapter *c*" is modern Act *c*. Each stage twins the Act I stage in the same slot (x-6 ↔ x-1 … x-10 ↔ x-5)
by idea, never by trace, except the three declared echoes. Waves come from chapter *c+1*'s Act I row; hpScale uses the
corrected rung (the rung for chapter *c+1*'s Act I × chapter *c*'s own mean HP pass); tier is chapter *c+1*'s Act I tier
in the same slot. Size 20×12 unless noted. Every map from chapter 2 on keeps ≥ 8 water tiles within 3 tiles of the road;
chapter 2's five keep ≥ 60 buildable water tiles. Routes obey the authoring tests (radius ≥ 1.4 tiles, no bend sharper
than 14° per sample, edge spawns unless flagged, tunnels ≥ 1 tile, silhouette IoU < 0.65 and a different turning
signature against every other map). Every stage has one of the 15 shipped map rules, shown under a per-stage skin name
(display text only).

**Gimmick codes.** A underpass or building tunnel · B subway or highway bores · C flyover or footbridge over the road's
own earlier pass · D scramble crossing · E rooftops (tile `U`) · F mid-board rift · G out of the subway · H viaduct ·
I lane barrier on a wave schedule · J roundabout · K power-out · L relay pads · M airdrops · N hot zones · O evacuation ·
P two exits · Q water decks · R rift hops · S the street is gone (earlier ground, new road) · T echo.

| Stage | Map id · name | Route | Headline gimmick | Rule · skin | Lead families | Waves · hpScale · tier | Boss |
|---|---|---|---|---|---|---|---|
| 1-6 | `noon_station_plaza` · Station Plaza | taxi-rank hairpin, 3-tile station underpass | A | `petal_sanctuary` · Rush-hour evacuation | slime, goblin | 18 · 2.15 · beginner | |
| 1-7 | `noon_covered_arcade` · The Covered Arcade | comb: three narrow U-teeth off one straight | E (fallback: loading yards) | `tailwind` · Rush hour | goblin, slime | 20 · 2.25 · intermediate | |
| 1-8 | `noon_corner_store` · Convenience Corner | loop round the store block, flat crossing over its own approach | D | `firefly_chorus` · Time sale | slime, goblin, orc | 20 · 2.37 · intermediate | |
| 1-9 | `noon_canal_crossing` · Canal Crossing | fork: straight over the level crossing, or a wide D round the basin | I | `changing_tides` · Lock cycle | orc, beast, slime, goblin | 22 · 2.48 · intermediate | |
| 1-10 | `noon_dry_fountain` · The Dry Fountain | echo of `sakura_court` | T + M | `supply_ship` · Brigade airdrop | slime, goblin, orc, beast | 22 · 2.60 · advanced | The Frostbitten Heir |
| 2-6 | `noon_school_gate` · School Gate | front-gate chicane, 4-tile corridor tunnel | E + A | `petal_sanctuary` · Shelter intake | lizard, slime, goblin | 22 · 2.87 · intermediate | |
| 2-7 | `noon_rowing_jetty` · Rowing Jetty | tuning fork: two jetty lanes merge, switchback stem | K | `lunar_eclipse` · Lights out | lizard, slime | 22 · 3.01 · intermediate | |
| 2-8 | `noon_footbridges` · Canal Footbridges | staircase of four footbridges | L | `prism_conduits` · Sensor masts | lizard, slime, goblin | 24 · 3.15 · intermediate | |
| 2-9 | `noon_running_track` · The Running Track | stadium lap entered by a tunnel, over its own entry | C | `firefly_chorus` · Starting pistol | lizard, slime, goblin, beast | 24 · 3.31 · advanced | |
| 2-10 | `noon_boathouse_lamp` · The Boathouse Lamp | breakwater out, 270° curl round the lamp, back through the boathouse | Q + A | `changing_tides` · Lake swell | lizard, slime, goblin | 25 · 3.47 · advanced | Old Lamp-Hugger |
| 3-6 | `noon_old_town` · Old Town Lanes | fret: three hooked keys | E | `moonlit_blessing` · Bell festival | ghost, slime, lizard | 24 · 2.87 · intermediate | |
| 3-7 | `noon_takoyaki_row` · Takoyaki Row | lantern N: three diagonals | N | `forge_vents` · Hot griddles | ghost, goblin, slime | 25 · 3.02 · advanced | |
| 3-8 | `noon_shrine_steps` · Shrine Steps (fog) | town road + a lane from a mid-board rift on the lake; merge; switchbacks | F | `alchemists_mist` · Lake fog | ghost, slime, lizard, orc | 25 · 3.16 · advanced | |
| 3-9 | `noon_old_town_burning` · Old Town, Burning (3-6's ground) | broken fret: one long S through the rubble | S | `heat_mirage` · HAMMER's smoke | ghost, Brigade (Gnat spotters), goblin | 26 · 3.32 · advanced | |
| 3-10 | `noon_lakeside_shrine` · The Lakeside Shrine | echo of `shrine_sanctum` | T + K | `lunar_eclipse` · The tear | ghost + all earlier | 26 · 3.49 · advanced | The Ashen Warden |
| 4-6 | `noon_toll_plaza` · Toll Plaza (22×12) | three-booth lens | E | `supply_ship` · Brigade convoy | orc, beast, slime | 25 · 5.61 · intermediate | |
| 4-7 | `noon_checkpoint` · Azami's Checkpoint (dusk) | barrier chicane: straight lane or two S-bends | I | `heat_mirage` · Flare smoke | orc, beast | 26 · 5.89 · advanced | |
| 4-8 | `noon_tunnel_mouth` · Tunnel Mouth | dual carriageway: two bores, two exits | B + P | `rear_ambush` · Wrong way (even waves: the Brigade's strike column) | orc, beast; Brigade on even waves | 26 · 6.17 · advanced | |
| 4-9 | `north_frozen_villages` · The Frozen Villages (`snow`) | from the Petal Gate's north mouth up the sled run, a horseshoe round the village, out to Kagari's camp | L | `prism_conduits` · Village hearths | Brigade (troopers, Gnats, Tortoises, Badgers), beast | 27 · 6.49 · advanced | |
| 4-10 | `north_snow_bridge` · The Snow Bridge (`snow`, 22×12) | two columns join at one bridge (8-tile deck) | Q | `snowbell_blizzard` · Blizzard | orc, beast | 28 · 6.79 · expert | The Frost Vanguard |
| 5-6 | `noon_flooded_platform` · Flooded Platform | up from the platform (mid-board subway spawn) | G | `changing_tides` · Rising water | ghoul, slime, lizard | 26 · 6.37 · intermediate | |
| 5-7 | `noon_line2_tunnels` · Line 2 Tunnels | dashed line: four bores, three vent cuttings | B + K | `lunar_eclipse` · Emergency lights | ghoul, plant, ghost | 27 · 6.68 · intermediate | |
| 5-8 | `noon_pump_station` · Pump Station | pipe-gantry loop; the spawn is the Noon Gate | N | `forge_vents` · Steam valves | machines (out of the Noon Gate), plant, ghoul | 27 · 7.01 · advanced | |
| 5-9 | `noon_reservoir_park` · Reservoir Park (fog) | spillway Z; the last leg tunnels under the first | A | `alchemists_mist` · Reservoir fog | ghoul, plant, machines | 28 · 7.35 · expert | |
| 5-10 | `noon_reservoir_willow` · The Reservoir Willow (fog, night) | yin-yang round the willow, two exits | P + Q | `firefly_chorus` · Fireflies | plant, ghoul, slime | 28 · 7.72 · expert | The Reservoir Willow |
| 6-6 | `vesper_frost_causeway` · Frost Causeway | broken causeway W with two light-bridges | L + Q | `prism_conduits` · Prism batteries | machines, slime, goblin | 28 · 7.47 · intermediate | |
| 6-7 | `vesper_skyrail` · Sky-Rail Viaduct (22×12) | sky-rail S, then back underneath (fallback: two overpasses) | H | `heat_mirage` · Frost haze | machines, goblin, slime | 28 · 7.84 · advanced | |
| 6-8 | `vesper_museum` · Museum of Noon | wings and rotunda, two gallery tunnels | A + K | `lunar_eclipse` · Dead grid | machines, ghost, goblin | 29 · 8.23 · advanced | |
| 6-9 | `vesper_tower_ring` · Lecture Tower Ring | phi: a ring cut by its diameter | R | `shifting_stars` · Transit pads | machines, slime, goblin | 29 · 8.62 · expert | |
| 6-10 | `vesper_spindle_foot` · The Spindle's Foot (22×12) | double helix, two light-bridge crossings | C | `supply_ship` · Last Watch caches | machines + stragglers; Rime Wisps on the last waves | 30 · 9.04 · expert | Gatekeeper Unit 01 |
| side | `vesper_starfall` · The Starfall Deck | orrery: outer ring, light-bridge, inner ring, spur under the outer ring | meteor zones | `forge_vents` · Starfall | up to chapter 6 | 6-10 × 1.1 | (bond stage) |
| 7-6 | `noon_arcade_after` · The Arcade, After (1-7's ground) | broken comb: two lanes merge mid-street | S | `festival_encore` · Encore | oni, fae, goblin | 28 · 11.74 · advanced | |
| 7-7 | `noon_festival_stalls` · Festival Stalls | dance-tower roundabout (fallback: one flat crossing) | J | `moonlit_blessing` · Lantern dance | oni, fae, lizard | 29 · 12.33 · advanced | |
| 7-8 | `noon_plaza_after` · Station Plaza, After (1-6's ground) | double pontoon S round the fallen concourse | Q | `rear_ambush` · Cordon (even waves: the Brigade) | oni, fae; Brigade on even waves | 29 · 12.94 · expert | |
| 7-9 | `noon_two_doors` · Hilltop's Two Doors (`campus`, night) | fork to two shelter doors | P | `snowbell_blizzard` · Cold through the seams | Brigade (the guns on the back street; the HAMMER Carriage on the last wave), oni | 30 · 13.58 · expert | |
| 7-10 | `noon_festival_stage` · The Festival Stage | two half-moons join at the west exit | N | `forge_vents` · Fireworks | oni, fae + all | 30 · 14.24 · expert | The Ember Champion |
| 8-6 | `noon_mountain_road` · Mountain Road (22×12, `snowCover`, dawn) | viaduct curve, snow shed, switchback | H | `tailwind` · Mountain wind | dragon, goblin, slime, orc | 30 · 8.53 · expert | |
| 8-7 | `noon_checkpoint_open` · The Checkpoint, Open (4-7's ground) | straight through the open gate, then a hook | E + S | `snowbell_blizzard` · Pass blizzard | dragon, beast, goblin | 30 · 8.94 · expert | |
| 8-8 | `noon_weather_station` · Weather Station Road | Z climb, radar hook, service tunnel | L | `prism_conduits` · Radar masts (the Brigade's) | dragon, goblin, slime | 31 · 9.39 · expert | |
| 8-9 | `skies_three_skies` · Three Skies (22×12, era sectors) | one long S through three sectors; two mid-board rifts join it | R + F | `shifting_stars` · Three skies | dragon (main lane), machines (Noon rift), the Night (Vesper rift) | 31 · 9.85 · expert | |
| 8-10 | `noon_summit_stone` · The Summit Stone (22×13) | echo of `peaks_nest`; each lane from a different gate | T | `moonlit_blessing` · First light | dragon (Petal lane), machines (Noon lane), the Night (Vesper lane) | 32 · 10.33 · expert | The Shadow at the Gate |

**Totals.** 40 stages on 40 new MapDefs (49 → 89) plus 1 side-stage map: 33 new layouts, 4 "after" routes on earlier
modern ground (3-9, 7-6, 7-8, 8-7; each must still pass IoU < 0.65 against its intact twin), 3 echoes. Topology: 24
one-lane, 13 two-lane, 3 three-strand; mid-board spawns on 3; tunnels on 13; passes over the road's own pass on 6.
Enemies: four factions by gate (§3.4), 25 new defs, one new model family (§18.9).

**Echoes.** 1-10 ↔ 1-5 (`sakura_court`), 3-10 ↔ 3-5 (`shrine_sanctum`), 8-10 ↔ 8-5 (`peaks_nest`). Literal: rows (water
and void change only where the story says), paths, crossings, tunnels. New: theme, decor, rule, waves, boss. Data:
`echoOf: '<mapId>'`; the silhouette and turning-signature tests skip declared echo pairs (at most three, only between
eras). The stage card shows the Act I thumbnail as a faint ghost; the first clear adds a Captain's Journal line: "We have
been here before."

**Future-era maps.** Default: the future lives inside Arc 1 as Act 6 (5 maps), the Starfall Deck, the Evening sector of
8-9 and the Vesper lane of 8-10, with future scarring in Act 5 (glass shards, the Noon Gate at 5-8). A living-future act
per chapter belongs to Arc 2. Slots `c-11 … c-15` stay reserved for an Evening act in a later arc. Rejected: a future
act per chapter in Arc 1 (spoils the Act 5 reveal, repeats one mood) and future stages sprinkled into Acts 1-5.

**Map-borne story.** 7-9's last waves send their elites, the Brigade's Badgers and then the HAMMER Carriage, down the
back-door lane; its ranging shot tears the back street; and a watering can sits on the back stairs. 6-10 hides a thread of grey wool in the ice. 1-6 and 7-8 carry the MISSING poster.

**Factions by act** (at most three lead families per act):

| Act | Lead families | Petal Gate | Noon Gate (machines) | Vesper Gate (the Night) | The Brigade (no gate) |
|---|---|---|---|---|---|
| 1 | slime, goblin | all five maps | – | – | dressing: drones overhead, airdrops |
| 2 | lizard, slime, goblin | all five | – | – | dressing: searchlights, the curfew |
| 3 | ghost (+ earlier) | all five | – | – | Gnat spotters on 3-9 |
| 4 | orc, beast, Brigade | 4-6 … 4-8; at home in 4-9, 4-10 | – | – | 4-8's even waves; the lead on 4-9 |
| 5 | ghoul, plant, machines | all five | 5-8, a few on 5-9 | – | dressing: search boats |
| 6 | machines (+ stragglers) | stragglers drawn to the one warm window | all five | Rime Wisps on 6-10 | – |
| 7 | oni, fae, Brigade | all five | – | the cold only | 7-8's even waves; the lead on 7-9 |
| 8 | dragon, machines, the Night | the Petal lanes | the Noon lanes of 8-9, 8-10 | the Vesper lanes of 8-9, 8-10 | allied from 8-7 |

New defs outside the Brigade: Vesperline's Patrol Orb (no rule), Halo Drone (blink; a new `halo` construct variant) and
Line Sentry (armour 4) from 5-8, Vesper Aegis (barrier) and Lattice Shell (crystal) from 6-6, Vesper Warden (elite:
barrier + crystal) from 6-8; the Night's Rime Wisp (frost ward) from 6-10, Rime Slime (frost ward) and Night Wyvern
(elite: airborne + frost ward) from 8-9. Each uses only rules taught by then and is budgeted like the def it stands in for.

---

## 18. Theme kit

### 18.1 The looks

| Era | Look | How | Used by | Ground · road | Buildings | Light |
|---|---|---|---|---|---|---|
| Noon | `city`, day | new `THEMES` entry, warm: tan, brick, green awnings, trees | Act 1; 5-9, 5-10 | `paved` + painted kerbs · `asphalt` with a dashed centre line | `cityBlock` (shop row, apartment, office, convenience store, clinic, police box) | day; petals and paper litter on the wind |
| Noon | `city`, night | stage `night` + per-theme `nightLight` | 3-6…3-8, 5-10, Act 7 | as above | lit windows and signs as glow geometry | warm neon night |
| Noon | Old Town district | `MapDef.district: 'oldtown'` | 3-6, 3-7, 3-9 | plaster and stone · `setts` | `oldHouse` (wooden walls, tiled roofs carrying `U`) | lantern strings |
| Noon | highway district | `district: 'highway'` | 4-6…4-8, 8-6, 8-7 | gravel verges · `concrete` | toll booths, sound walls, sign gantries | day, dusk; frost |
| Noon | `campus` | new entry sharing city props | Act 2, 7-9 | lawns, paved paths · `asphalt`, `brick`, `track` | `schoolBlock` (classroom wing, gym, clock tower, club hut) | night; fireflies |
| Noon | `drowned` | new entry | 5-6…5-8 | wet tile, concrete · `grating`, platform edges | station boxes, retaining walls, pump halls | fog; red and amber emergency glows |
| Noon | `ruined: 'burning'` | stage scenery flag (a string) resolved in `resolveLook` | 3-9, 3-10 | ash-dusted paving, scorch marks; road stays the lightest band | `ruinBlock` | low warm key, dark sky, smoke, embers, ash |
| Noon | `ruined: 'after'` | same flag, second table | 7-6, 7-7, 7-8, 7-10 | cold ash, swept paths, tarps | `ruinBlock` cold, relief tents, scaffolding | night, cold blue key, warm lanterns |
| Noon | `snowCover` | stage scenery flag | 4-8 (north), 8-6…8-8 | snow over asphalt | as the district | thin cold dawn |
| Morning | `snow` + Brigade dressing | shipped theme + scenery keywords | 4-9, 4-10 | as shipped | frozen huts | snow |
| Evening | `vesper` + `ruined: 'frozen'` | new entry; `ruined` picks the frozen table | Act 6, the Starfall Deck | white glass panels with cyan cracks · `glassway` | `glassTower` (skirt), `podium`, `lectureHall` | eclipse dusk, cold aurora, snow, frost haze |
| Evening | `vesper`, living | same theme without `ruined` | Arc 2; the cliffhanger's still | clean white, sky blue | cherry trees in glass courtyards | bright morning |
| all | era sectors | `MapDef.ground: [{ type: 'eraSector', look, poly }]` | 8-9 | three grounds | from each era | three skies stacked |

### 18.2 Materials

- **Ground styles:** `paved`, `setts`, `tile`, `glass` (branches in `paintGround` / `detailTexture`).
- **Road styles:** `asphalt`, `track`, `setts`, `concrete`, `glassway`, `grating` (reuse `metal`); 256 px greyscale tiles
  × `path.color`.
- **Ground marks** (0 draw calls, shared atlas): `crosswalk`, `junctionBox`, `stopLine`, `platformEdge`, `cracks`,
  `scorch`, `crater`, `frostCrack`.
- **Deck looks:** concrete flyover, steel footbridge, timber jetty, pontoon, military bridge-layer, pipe gantry,
  light-bridge (opaque glass with a cyan edge glow), sky-rail girder.
- **Tunnel looks:** `subway`, `highway`, `corridor`, `station`, `boathouse`, `gallery`, `snowshed`, `service`.
- **Water looks:** canal, lake, flooded track bed, reservoir, open leads in ice, hot spring (steam).

### 18.3 Props by kit

All static props are procedural in the `props.js` pattern (boxes, cylinders, a few lathes with vertex colours), merged
into the `props`, `foliage` or `glowProps` mesh, ≤ 6 variants per builder, a `far` LOD for the skirt.

- **Street:** `cityBlock`, `cityTower`, `cityWall`, `streetLamp`, `trafficLight`, `vendingMachine`, `busStop`,
  `billboard`, `parkedCar`, `roadCone`, `barricade`, `bollard`, `hydrant`, `mailbox`, `trashBin`, `bikeRack`,
  `streetTree` (cherry variant), `powerPole`, `planterBox`, `guardRail`, `laundryLine`, `catOnWall`, `pigeonGroup`,
  `missingPoster` (pigeon, slime, parking-sticker and Doorie-sticker covers).
- **Station, rail, canal:** `stationHall`, `ticketGates`, `platformCanopy`, `clockTower`, `taxiShelter`, `railLine`,
  `levelCrossing` (reads the wave for the barrier), `trainCar` (InstancedMesh, ≤ 6), `waterBus`, `lockGate`, `canalSteps`.
- **Arcade and Old Town:** `arcadeRibs` (frames only), `shopFront`, `bunSteamer`, `lanternString` (glow geometry, every
  fourth lantern a sprite), `oldHouse`, `shopCurtain`, `stoneBasin`, `ringToss`, `bowStage`, `griddleStall`.
- **Campus:** `schoolBlock`, `flowerBoxes`, `bikeShed`, `flagpole`, `goalPosts`, `stands`, `scoreboard`, `finishGantry`,
  `boatRack`, `oldLamp`, `searchlight` (sweep disc, 0 calls), `clubHut`.
- **Highway:** `tollBooth` (roof carries `U`), `signGantry`, `soundWall`, `jerseyBarrier`, `jetFan`, `restStopRow`.
- **Brigade:** `sandbagPit` (the 4-9 beachhead), `droneDock`, `searchlightTower`, `tortoiseVan` (roof carries `U` in 8-7),
  `barrierArm`, `citationStand`, `fieldTent`, `radioMast`, `pontoon`, `bridgeLayer`, `parachuteCrate`. Dressing only;
  the Brigade's units on the road are enemy models (§18.9).
- **Drowned line and reservoir:** `platformEdge`, `stationStairs`, `mosaicWall`, `sunkenTrain`, `emergencyLight`,
  `signalLamp`, `maintenanceCart`, `pumpUnit`, `pipeRun`, `valve`, `damWall`, `spillwaySteps`, `bandstand`, `parkLamp`,
  `chainedBoats`, `rescueBuoy`, the willow (large variant).
- **Ruins:** `ruinBlock`, `rubble`, `burntCar`, `fallenPole`, `debris`, `gateCrystal`, `hammerTear`, `reliefTent`,
  `tarp`, `bucketChain`, `handPoster`, `scaffold`. Loss is told through objects people loved; never bodies.
- **Festival (modern):** `danceTower`, `festivalStage`, `fireworksRack`, `waterStation`, bunting, paper lanterns.
- **Far north:** `frozenHut`, `dyingFire`, `villageHearth` (pad, 4-9), `sled`, `hotSpring`, war banners, `stoneBridgePier`,
  `passCairn`.
- **Summit:** `radarDome`, `anemometer`, `antennaMast` (pad), `cableCar` (InstancedMesh, ≤ 2), `weatherHut`,
  `summitStone`.
- **Vesperline:** `glassTower`, `podium`, `lectureHall`, `lightBridge`, `skyRail`, `holoSign`, `haloStatue`,
  `doorieStatue`, `doorieBus`, `transitPad`, `prismBattery` (pad), `sentryBay` (spawn), `spindle` (hero prop),
  `vesperTerminal`, `frozenFountain`, `frostedPane`, `cleaningRobot` (instanced), `vesperShelter`, the frozen nest.

### 18.4 Gates at the spawn and the goal

| Prop | Where | Build |
|---|---|---|
| `petalRift` | Petal Gate mouths in Itomachi | asphalt slabs and a bent sign leaning into a torn ring; violet-pink seams and a portal disc as glow geometry; a `debris` emitter plus petals and frost motes |
| `noonGate` | 5-8, 8-9, 8-10 | a ring of slowly turning glass shards (one instanced group, ≤ 24), cyan-white seams, frost breath |
| `vesperGate` | 6-10, 8-9, 8-10 | a white-gold glass ring round a black-violet disc; dark snow falling out |
| `hammerTear` | over 3-10's sanctum; healed scars later | a jagged black-violet seam, no ring, crackling sparks |
| `sentryBay`, `passCairn` | Act 6, the far north | not gates: where the city's machines and the north's natives come from |
| `shelterDoor` | the goal on Itomachi maps | Shelter 3's steel door with the shipped heart sign; variants: station shelter, school main door, school back door (7-9) |
| Petal Gate north mouth | spawn of 4-9 (the Brigade's beachhead), goal of 4-10 | `petalRift` ringed with sandbags and a searchlight |
| `vesperShelter` | the goal in Vesperline | a shelter door under a frosted canopy with one warm window |
| `summitStone` | the goal of 8-10 | the ward stone itself |

Selection is one line in `terrain.js` (the torii keyword, else the stage's or theme's `spawnGate` / `goalGate`);
per-lane gates on three-lane maps come from `MapDef.gates: ['petalRift', 'noonGate', 'vesperGate']`.

### 18.5 Ambient life

`city` day: pigeons on wires, a cat on a wall, laundry swaying, the traffic signal cycling, a train every 40 s on the
skirt rail, a water-bus, Brigade drones high. `city` night: lit windows, humming vending machines, light pools,
searchlight sweeps. `campus` night: fireflies, a searchlight on the water, the clock face lit. Old Town festival:
lanterns swaying, stall steam. `burning`: ash fall, embers, ≤ 6 smoke columns from the skirt, fire glows on ruins, a
stray cat in the rubble. `after`: lanterns on burnt beams, relief-tent glows, a bucket chain, the cat again. `drowned`:
dripping, ripples, emergency lights pulsing. Far north: snow, hot-spring steam, a vast shadow crossing once a minute.
`vesper` frozen: snow, frost haze, holo signs flickering, a cleaning robot circling, a cold aurora. Summit: wind-blown
snow, the cable car, three skies. No traffic on the road: the road belongs to the enemies.

### 18.6 Grim, but readable

1. The road is always the clearest band on the board; ruined ground is darker and desaturated, the road lighter.
2. Fire and smoke never sit on or over the road: fire glows only on `H` / `X` tiles ≥ 1.5 tiles from the centreline;
   smoke rises from the skirt and fades within 2 tiles of height.
3. The sky goes dark, not the board: the ruined key light stays ≥ 1.2.
4. Enemy outlines and HP bars are untouched; fire is amber-yellow so it never reads as an oni's red.
5. The gate is the brightest thing on the map.
6. One accent per look: amber (burning), cold blue-grey with warm lantern points (after), cyan-white (frozen future).
7. Contact-sheet check: a greyscale screenshot at 844×390 still shows the road, the gates and every enemy.

### 18.7 Phone budget (per map's terrain, high)

| Item | High | Low | Notes |
|---|---|---|---|
| Draw calls | ≤ 10 | ≤ 10 | plus ≤ 3 instanced movers (train or cable car, drones and robot, glass shards) |
| Triangles | ≤ 90k | ≤ 65k | buildings ≤ 25k, street props ≤ 12k, trees ≤ 15k, kerbs ≤ 4k (0 on low), skyline ≤ 15k |
| Glow sprites | ≤ 250 | ≤ 250 | festival nights are the risk: lantern strings are glow geometry |
| Emitters | ≤ 40 | ≤ 40 | burning: ≤ 6 smoke columns, ≤ 12 fire glows |
| Transparency | 0 sorted transparent meshes | 0 | glass is opaque and tinted with glow edges; no real-time point lights |
| Textures | no new large ones | | one 256² road tile per style; marks in the shared atlas |

Estimates to measure with `tools/measure.mjs` once built: `city` 70-85k, `campus` 70-80k, Old Town 80-88k, `burning`
75-85k, `drowned` 50-60k, `vesper` 65-75k, era sectors 80-88k.

### 18.8 How pieces are built

Procedural by default (everything static, hero set pieces included: the station concourse, the boathouse, the sunken
train, the Spindle, the Doorie statue, the summit stone). InstancedMesh (≤ 64 each, one call) only for things that move
every frame. Public-domain (CC0) low-poly packs only for vehicles if the procedural boxes look too plain, decimated to
≤ 300 triangles, recoloured, baked to vertex colours, merged like any prop, with the licence in a credits file; never
for buildings.

### 18.9 Enemy models: the one exception

Every boss and every new def is drawn on an existing family GLB except the **Brigade**, a new family built exactly like
today's monsters (`tools/blender/enemies/`): quad cages, subsurf, painted faces, toon and outline, one rigged GLB.

| Piece | What | Size |
|---|---|---|
| `families/brigade.py` (new) | base body: the **trooper** (the chibi biped with a visor helmet, padded jacket, big boots; `main` navy, `accent` amber); variants that hide the biped: `gnat`, `tortoise`, `badger`, `strider` (keeps the legs), `hammer`; a `heron` variant waits for Arc 2 | target ≤ 260 KB (the goblin family, which carries a vehicle-sized machine, is 283 KB); cap 320 KB |
| props | new `visor`, `riotShield` (opaque, no transparency), `carbine` (our own design), `foamTanks`, `searchlight`, `rotors`; reused `backpack`, `helmet` | in the family file |
| face atlas | visor eyes; the `dead` cell is the visor gone dark, never crossed-out eyes on a person; the Gnat's face is a small screen (LINK LOST) | – |
| clips | move `run`, hit `recoil`, special `cast`; no new death style: troopers use the shipped fall-and-fade with the homeward sparkle off for this family, and nothing stays on the road; optional per-variant clips (`move@gnat` hover, `move@tortoise` roll, `death@badger` breakdown) | – |
| battle FX (render only) | `breakdown` for the machines (steam, sparks, scrap that fades with the body), the Gnat's `sparkFall` (reuses `sparkle`); no blood, no wound decals, no wreck left on the road | – |
| fallback | a V1 procedural stand-in for node and offline | – |
| Vesperline's machines | one new construct variant, `halo` (the Halo Drone); everything else is a tint on shipped construct bodies | ≈ +10 KB |
| the Rimebound | tints and the shipped `crystals` prop | 0 |

**Budget:** the twelve family GLBs total 2.27 MB against a 2.5 MB test cap; with the Brigade (≈ 0.26 MB) and the halo
variant ≈ 2.54 MB, so the total cap rises to 2.8 MB and the 320 KB per-family cap stays. Families load per stage, so the
Brigade file downloads only on stages that field it; on screen a Brigade unit costs what any monster costs. **Look:**
navy and amber city responders with the gate-ring emblem, never a real army's look (Q23). **Effort:** M for the kit (one
enemy-model workflow with a lineup render and a critic pass), S for the halo variant, XS for the tints.

---

## 19. Rollout

Sizes: XS under a day, S one or two days, M about a week, L two to three weeks.

| Step | Contents | Maps | Sim / co-op | Size | Gates |
|---|---|---|---|---|---|
| 0 | prerequisites: energy and the 7 PM reset, the balance model, the Halloween event live first | – | – | – | – |
| 1 | Act II data and unlocks (two-row campaign screen), reward and achievement fixes, story-queue sort by (chapter, act, index); the `city` look v1 (paved, asphalt, kerbs, crosswalks, ≈ 25 street props, `petalRift`, `shelterDoor`, ambient); rooftops; the lane schedule; the echo exemption; per-stage rule skins; Act 1 (5 stages, the Frostbitten Heir, 7 scenes) | 5 | rooftops [sim, M], lane schedule [sim, S]: data and sim hash | L | Easy-gate bot run on 1-6…1-10; an old save keeps every unlock; IoU and turning tests; owner playtest |
| 2 | `campus`, `nightLight`, `track` road, blackout dimming; Act 2 | 5 | render only: data hash | M+ | ≥ 60 water tiles on all five |
| 3 | Old Town district, `ruined: burning`, mid-board rift, the tear; Act 3; the Brigade kit (all eight units, §18.9, built in parallel with Step 2; only the Gnat spotters ship here), the trooper fall (shipped fade, sparkle off) and breakdown FX, Brigade barks | 5 | rift [render + test]: data hash; the Brigade is art + data only | M+ (+ the kit, M, in parallel) | greyscale contact-sheet check; a Brigade lineup render and critic pass |
| 4 | highway district, Brigade dressing, far-north dressing; Act 4 (4-9 runs from the gate to the camp); Azami joins after 4-7; Brigade defs: Response and Shieldline Troopers, Tortoise, Badger | 5 | render only | M+ | as above |
| 5 | `drowned`, subway spawn, Noon Gate look, park kit; Act 5; the first Vesperline machines (Patrol Orb, Line Sentry, the Halo Drone on a new `halo` variant) | 5 | subway spawn [render]: data hash | M+ | as above |
| 6 | Vesperline kit (frozen and living), viaduct, light-bridge, sentry-bay and transit-pad looks; Act 6 + `side-6-starfall`; the rest of the machines and the Rime Wisp | 5 + 1 | viaduct [sim, M]: data and sim hash | L | perf measure on a mid phone |
| 7 | `ruined: after`, modern festival kit, roundabout, two-door goals; Act 7; Wakaba joins after 7-7; Brigade defs: Foam Trooper, Strider, the HAMMER Carriage | 5 | roundabout [sim, M]: data and sim hash | M+ | as above |
| 8 | `snowCover`, summit kit, era-sector ground, per-lane gate looks; Act 8, the finale and the cliffhanger; the Rime Slime and the Night Wyvern; the Brigade as allied dressing | 5 | render only | M+ | full-arc read-through of every scene in order |

**Co-op.** Every step changes the co-op data hash (`MAPS` and `STAGES` are hashed), so old and new clients cannot pair:
bundle each step with another change that already forces a co-op update, and never ship one during a live event week.
Steps 1, 6 and 7 also change the sim hash; new enemy defs ride the data hash, and the Brigade adds no sim code.
`COOP_PROTOCOL` is 8 today (v0.1.41). The house rule is that a sim change needs a bump, so a step that moves the sim
hash ships inside a bundled co-op release that sets `COOP_PROTOCOL` once for the whole bundle, with one comment line
naming the step; a Gate Arc branch never bumps it on its own. No message changes shape: a rooftop placement is the
same place message with an `x, y` on a `U` tile, and the lane schedule adds no command. Act II appears in co-op by
itself (`coopStages` lists `CAMPAIGN_IDS`); the side stage
does not unless added on purpose. Option: pair Acts 4+5 and 7+8 into single releases.

**Rewards** (half, so Act II adds value without becoming the best farm).

| Reward | Per Act II | Arc 1 total |
|---|---|---|
| Medal gems | 110 per stage (10 / 20 / 30 / 50) → 550 per act | 4,400 |
| x-10 first clear | 100 + 20*c* gems + 1 recruit ticket | 1,520 gems + 8 tickets |
| First-clear coins and books | `campaignFirstClear(c)` per stage | ≈ 150,000 coins |
| Drops and energy | chapter *c+1*'s table and price (chapter 8 keeps 8's) | – |
| Achievements | "Chapter *c* · Act II complete" at half value; "80 campaign stages" goals; reword the "all 40" goals | ≈ 850 gems |
| Story | every Arc 1 episode is kind `event`, 0 gems (Q8 default) | 0 |
| Cosmetics (no gems) | each x-10 first clear unlocks that act's stage still as a lobby background and a profile title: *Rush Hour Regular*, *Night Watch*, *We'll Keep the Watch*, *A Very Good Booth*, *Channel 9, Keep It Open*, *Upstream*, *Hydrate!*, *A Very Long Wall* | 8 backgrounds, 8 titles |

**Difficulty.** Act II stage *k* of chapter *c*: hpScale = the plan's rung `hpScaleAt(5c + k − 1)` × chapter *c*'s own
mean HP pass; cash scale and start cash from the rung (pre-pass); waves from chapter *c+1*'s Act I row (chapter 8:
30/30/31/31/32); `hpPass` stored as that mean. Every Act II starts at or just above its own x-5 and climbs ≈ 20 %; 7-10
(14.24) becomes the campaign's highest hpScale. Starting values for the first balance run, not tuned numbers.

---

## 20. Ids and room to grow

| Range | What | Status |
|---|---|---|
| `c-1 … c-5` | Act I · the Morning (fantasy) | shipped, never touched |
| `c-6 … c-10` | Act II · the Noon (modern) | this spec |
| `c-11 … c-15` | reserved: Act III · the Evening, for a later arc in living Vesperline | empty |
| `9-1 …` | Arc 2's chapters, each with its own acts (default: Act I in the Morning, Act II in living Vesperline) | Arc 2 |
| `side-<c>-<slug>` | side stages: kind `side`, not in `CAMPAIGN_IDS`, own `requires`, drawn as a small card after their `anchor` stage | from Step 6 |

Every stage carries `act` (1 / 2 / 3), `finale` and an explicit `requires`, and every list is sorted by (arc, chapter,
act, *n*), never by array position. The campaign screen draws one row per act. Later: the living `vesper` look for Arc 2
(S once Step 6 exists), Itomachi rebuilding (`city` + a `scaffold` table), a "Fractured Gates" endgame with all three
eras on one board (reusing 8-9's era-sector ground), and modern and future arenas for Bounty and boss-raid modes.
Seasonal events can visit any of the three eras.

---

## 21. Build and lint notes

- **Speakers:** portraits and speaker entries for Mahiru, Kagari, Commander Yūhi (in a recording frame), Kuroe, Mori,
  Ms. Hazuki and Toki; until the art exists they speak as `unknown` with a name plate. Grandfather Hibachi keeps the
  six-word monster voice; Kagari, a named NPC, does not.
- **Faces and music:** grief, anger and shock faces (none exist today); cues for the Noon city, Vesperline, war and a
  requiem.
- **Lint:** the violence words are scoped to Arc 1 files only; every romance and body word stays banned everywhere;
  "Hikari speaks in every episode" holds (by radio where she is absent); the mystery lint holds with Act *c*'s scenes
  filed after chapter *c*'s; new girls need `{name:id}` tokens.
- **Data and tests:** new `CHAPTER_SCENE_IDS` keys for Act II so a finished chapter's Story Time progress never goes
  backwards; `SCENE_LIST.length` grows from 29; the after-scene queue sorts by (chapter, act, index), not by
  `CAMPAIGN_IDS`; the two-key unlock (x-5 and (c−1)-10) needs a two-entry `requires` or a `CHAPTER_GATE` check;
  free-girl join slots move to 1-7 (Yuzuha), 4-7 (Azami) and 7-7 (Wakaba); the campaign-enemy cap rises from 75 to 110 (99
  planned) and `FAMILY_IDS` from 12 to 13; the family-GLB total budget rises from 2.5 MB to 2.8 MB (320 KB per family
  stays); the echo exemption in the silhouette tests is limited to declared pairs.
- **Gems:** the story cap is 600 and 540 is used, so 60 remain (Q8).
- **Brigade lines:** barks are at most six words; the violence words are allowed as in every Arc 1 file, but the
  writing prefers absence ("Trooper down!", a name that does not answer) and no line describes a wound or a body.
- **Content note:** one line before Arc 1's first episode: "This arc contains war and loss."

**Step 1 build notes (2026-10-27).** Where this spec is older than the shipped code, or silent, Step 1 builds it so:
- `requires` is a stage id or a list of ids, read only through `stageRequires(stage)` in `src/data/stages.js`; Act I
  keeps its single-id chain, x-6 needs `['c-5', '(c-1)-10']` (1-6 needs only 1-5), and x-7…x-10 need the stage before.
- The Act II numbers (§19 Difficulty) are computed from one plan table (`ACT2_PLAN`) and pinned by a test, not typed
  in per stage. Act II pays half medal gems through `medalGemMul: 0.5`, and Ironclad reads `modeChapter` (c+1).
- `CAMPAIGN_IDS` lists Act I first and appends Act II; every play-order list sorts by (chapter, act, *n*), and the
  "next stage" pointer and the "Next" button stay inside an act (8-5 never offers 1-6).
- `CHAPTER_SCENE_IDS` stays Act I only and Act II episodes get their own table (`ACT_SCENE_IDS`), so the Story Time
  achievements never go backwards; `SCENE_LIST.length` is 32 today.
- The Act II achievement rows (§19 Rewards) stay hidden until all their stages exist; the three "all 40" goals read
  "on 40 campaign stages" and the Codex ribbon capstone "800 campaign mode ribbons".
- Rule skins are display text only (outside the co-op hashes).
- Yuzuha joined after 4-2 in v0.1.40; Step 1 moves her join to 1-7, and a save that cleared 4-2 still gets her once.

---

## 22. Open questions (each has a default)

| # | Question | Default | Alternatives |
|---|---|---|---|
| Q1 | Sensei's gender | keep the rule: never shown or stated; every Arc 1 line is gender-free | Sensei is "he" from Arc 1 on |
| Q2 | Deaths and the roster | no playable girl dies in Arc 1; Mahiru is story-only | Mahiru a free unit from Act 2, usable after Act 7 as "Mahiru (Remembered)"; Azami also dies at her own door; Tsubaki falls (not recommended: half of a paid duo) |
| Q3 | When the modern acts unlock | x-6 needs x-5 and (c−1)-10, with the four spoiler rules | all of Arc 1 behind 8-5 as one post-game chain |
| Q4 | The cliffhanger's last hook | "...You came." plus the card's twin | the Register redraws itself: "CAUSE OF THE FALL: THE CONSTANT" (needs one more rule) |
| Q5 | "The Merge has already happened" twist | save for a later arc | use in Arc 1 |
| Q6 | The little one | in Arc 1: planted 2, taken 5, revealed 8, rescued in Arc 2 | out of Arc 1; the Shadow at the Gate stays faceless |
| Q7 | Eras of the new girls | Noon: Yuzuha, Azami, Kinu, Wakaba, Kohaku, Ouka, Norika, Kogane, Ruri, Iroha, Ena, Fuu; Evening: Tenka, Tsubaki; Morning: Noa, Hana, Kanna, Yoriko, Seiran | Tenka a Noon native; the Last Watch's physicist becomes a new NPC |
| Q8 | Gems for the new episodes | every Arc 1 episode 0 gems; x-10 first clears carry rewards | raise the cap by 160 so each act's prologue and epilogue pay 10 |
| Q9 | Kagari | recurring NPC with a portrait now, no age stated, candidate playable unit in Arc 2 | playable when Arc 1 ends |
| Q10 | Halos | silent clue only (Morning and Evening wear them, Noon does not) | no clue; halos as costume as today |
| Q11 | How grim | loss through absence; readable maps (fire and smoke off the road) | Mahiru's last line cut off mid-sentence; darker boards; both |
| Q12 | Sensei's voice | one choice per episode; in grim scenes both options mean the same | more Sensei lines |
| Q13 | Echo maps | three echoes (1-10, 3-10, 8-10) with the ghosted Act I thumbnail | all 40 new layouts |
| Q14 | Rooftops in the first release | ship in Step 1 with the fallback | first use in Act 3 |
| Q15 | A future act per chapter | reserve `c-11 … c-15` for after Arc 2 | no third act |
| Q16 | Release size | one act (5 maps) per release | pair Acts 4+5 and 7+8 |
| Q17 | Scene placement tweaks | `g4.cross` after 4-8 (before 4-9); `g8.mid` before 8-7; Act 4's parley inside Azami's join (after 4-7) and Act 7's wrong-door plan inside Wakaba's join, so every act has six cutscenes; the back-door night as two episodes | keep the original draft placement (Acts 4 and 7 then have seven cutscenes) |
| Q18 | 7-9 back-door foreshadowing | yes: elites (now the Brigade's guns) take the back-door lane; a watering can on the back stairs | keep the map neutral |
| Q19 | Brigade soldiers | **answered Oct 20:** a full lethal war, no gore; soldiers fall and fade out like any enemy, machines break apart, the cost is carried through absence (§14, §15) | the earlier non-lethal default (the KO rule), withdrawn |
| Q20 | How much Brigade | the main enemy on 4-8, 4-9, 7-8 and 7-9; spotter drones on 3-9; dressing elsewhere; allies from 8-7 | in every modern act except Vesperline (the kit moves to Step 1); only as hazards (no new model) |
| Q21 | The Brigade's boss | the HAMMER Carriage on 7-9's last wave | Kuroe's command van; no Brigade boss |
| Q22 | The gunship | held back for freeplay, Bounty and Arc 2 (flyers arrive at 8-1); allies overhead in Act 8 | a low-hovering Heron in Act 7; a flying Heron in Act 7 |
| Q23 | How military the Brigade looks | navy and amber city responders, white visors, no camouflage | a full modern army look, still with our own emblem |
