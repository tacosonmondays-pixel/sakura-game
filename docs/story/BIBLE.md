# Sakura Sentinels: Story Bible

Head writer's bible for the `feature/story` branch. It sits beside `docs/STORY_SPEC.md`: the spec defines the
scene format, triggers, save and tests, and this bible defines **what the scenes say**. Builder 1 (opening,
tutorial outro, Chapter 1), Builder 3 (Chapters 2–8, lesson mini-scenes) and every critic read it before writing a line.

**Where the two documents differ, follow this one for text and the spec for code.** The differences are listed in §10.
The opening and the tutorial script in §8 are final and replace the drafts in spec §2.2–2.4.

Status: complete. Every script block (27 episodes) was checked against the spec's limits: ≤ 120 characters per line,
≤ 44 per choice, closed face list, no bare roster names (current 19 and the 11 later girls), banned words, ≤ 1 choice,
≤ 4 portraits, 9–15 spoken lines per episode. Speaker, enemy, stage, background and music ids were checked against
`units.js`, `enemies.js`, `stages.js` and spec §1.2.4/§1.6, and each boss's mechanic line against its phases in data.

Contents
1. [The story in one breath](#1-the-story-in-one-breath)
2. [The world](#2-the-world)
3. [The overarching mystery: "The Quiet Stones"](#3-the-overarching-mystery-the-quiet-stones)
4. [Hikari, the anchor](#4-hikari-the-anchor)
5. [Cast voice sheet](#5-cast-voice-sheet)
6. [Running jokes](#6-running-jokes)
7. [Chapter-by-chapter outline (27 episodes)](#7-chapter-by-chapter-outline-27-episodes)
8. [Opening and tutorial script (final)](#8-opening-and-tutorial-script-final)
9. [Writing rules and the critic's checklist](#9-writing-rules-and-the-critics-checklist)
10. [Changes against STORY_SPEC.md](#10-changes-against-story_specmd)

How to read the script blocks in §5 and §7: each row is `speaker  face  text`. `narrate` rows have no face.
`cue` rows are stage directions in the spec's `cue()` vocabulary. `choice` rows list the options; the indented rows
under each option are its reply lines. Every girl's name inside dialogue is a token (`{name:aoi}`), as the lint
requires. All lines were checked against the spec's limits (≤ 120 characters, closed `face` list, banned words,
no bare roster names).

---

## 1. The story in one breath

This spring, the eight old wardstones that keep the wilds around Moonpetal City calm have started to go dark, one
by one. Confused, chilly monsters wander toward the warm, bright city. **Hikari**, the young Captain of the
Sentinel Guard, has carried the Dawnblade for only a few weeks. She quietly fears that the ward is failing because
she isn't ready. So she writes to ask for help, and **Sensei** arrives.

Chapter by chapter, Sensei and the Sentinels clear each stone of the frightened creature sitting on it. Hikari
relights each stone with the Dawnblade's "first light". At every stone they find a warm grey scale, and every relit
light leans north toward Ashwing Peaks. At the summit they learn the truth. A dragon mother woke too early in a
cold spring and nested on the ward's heart, and the heart has been pulling warmth from every stone to keep her eggs
alive. Nobody was stealing anything. Every stone the Sentinels relit sent warmth up the mountain, so **they have been
keeping her eggs warm since the very first fountain.** The eggs hatch, the ward is whole, the cherry trees bloom a
second time, and Hikari learns that even guardians need guardians.

**Theme:** *care is protection.* The founders hid the ward inside things people love to use (a fountain, a lantern,
a bell, a beacon, a tree, a furnace, a drum, a hearth) so that the city would keep looking after it without knowing.
"The ward is kept by keeping."

**Tone:** a Saturday-morning adventure with a warm heart. Every chapter has one big laugh and one quiet moment.
Nobody is evil. Every "boss" turns out to be cold, lonely, proud or protective, and every one of them goes home
better off than it came.

---

## 2. The world

### 2.1 Moonpetal City

A canal city of bridges, lanterns and bakeries, on the shore of a wide lake below the mountains. People here like
festivals, tea and gossip. Townsfolk never get speaking lines; the girls mention them ("the bakery sent buns").

Places writers may use:

| Place | What it is | Used in |
|---|---|---|
| **Academy Hill** | Sakura Academy, above the city | everywhere |
| The Wall | the academy's old rampart; Hikari watches the sunrise from it (`cg:hikari-rampart`) | opening, ch8.epi |
| The Blossom Court | the academy gardens, home of the **Founders' Fountain** | tutorial, ch1 |
| North Dorm Library | Yuki's natural habitat; the librarian disapproves of frost | ch1.yuki |
| Archery range | Aoi's practice field (`cg:aoi-archery`) | ch1, ch2 |
| Observatory Tower | Luna's night courses and the founders' star charts | mentioned ch5, ch7 |
| The Foundry | the academy workshop on the east hill: crystal vats, boilers, Chika's robotics club | ch6 |
| **The Harbour** | Nami's post: docks, ships, ferry bell (`cg:sango-harbour`) | ch1.epi, ch2 |
| The Moon Pier | a long pier into the lake, with the great lantern at its end | ch2 |
| **Moonveil Shrine** | across the lake by ferry: torii, incense, a great bell, shrine canals | ch3 |
| **Ironhold Pass** | the mountain road north-west; the beacon tower at Ironhold Gate | ch4 |
| **Gloomfen Marsh** | the eastern lowlands: fog, boardwalks and the ancient Drowned Willow | ch5 |
| **The Old Quarter** | festival streets, the arena and the great taiko drum | ch7 |
| **Ashwing Peaks** | the smoking mountains to the north, with the Hearthstone on the summit | ch8 |

### 2.2 Sakura Academy

A school first. The girls have classes, clubs, homework, exams and dorm curfews, and those details are the texture of
every scene ("I have a maths quiz after this", "the tea club will be furious"). Students wear **halos**. Nobody
in the world finds them strange, and the story never explains them.

Clubs that exist (use them freely): archery (Aoi), tea and garden club (Rei), library committee (Yuki),
pyrotechnics club, with safety goggles (Akane), rifle team (Shiro), courier club (Kage), taiko and weather club (Raika),
shrine duty (Miko), alchemy lab (Midori), idol club (Momo), lantern keepers (Hotaru), harbour cadets (Sango), sea
shrine (Umeko), fencing club (Kaede), bell club (Suzu), robotics club (Chika).

### 2.3 The Sentinels and the Sentinel Guard

* **Sentinels** are students who volunteer to protect the academy and the city. They are cheerful, not soldiers. Their
  job is to **herd monsters home**, not to destroy them.
* The **Sentinel Guard** is the corps, led by the **Captain** (Hikari). The Captain carries the **Dawnblade**, a
  sword cut from the same first-light crystal as the wardstones and passed from Captain to Captain. Touched to a
  wardstone, it relights it. Hikari's words when she does it are always **"First light."**
* **Adult guardians** mentor the Sentinels and never fight *instead* of them: Hikari (Captain), Nami (the harbour's
  Tide Admiral) and Luna (the Moonfox Oracle of the observatory). Later: Kanna, Yoriko and Seiran.
* **The Captain's Journal** is Hikari's notebook of lessons for Sensei. Between lessons she presses each warm grey scale
  inside it like a flower. Her doodles fill the margins, and she draws Sensei as a little star in a hat, because "I
  can't draw faces, and anyway you're a star."

### 2.4 The Sakura Ward and the eight wardstones

Long ago the founders planted the **Sakura Ward**: seven *petal-stones* in a ring around Moonpetal's lands, and the
**Hearthstone**, the ward's heart, on the summit of Ashwing Peaks. Light flows between them along hidden *petal lines*,
the way blood runs back to a heart. The ward is not a wall. Its light works like a lullaby: monsters *can* cross it,
but while it hums they are content to stay home. The ward also keeps the seasons gentle.

The founders hid every stone inside something the city would always care for:

| # | Chapter | Wardstone | Hidden in | Who sits on it, and why (everyone is cold) | Relit in |
|---|---|---|---|---|---|
| 1 | Sakura Gardens | **Fountain Stone** | the Founders' Fountain in the Blossom Court | the Slime Prince, basking on the last warm spot in the garden | ch1.epi |
| 2 | Moonlit Lakeshore | **Moon-Pier Lantern** | the great lantern at the end of the Moon Pier | the Bog Basilisk, curled round the lantern; lizardfolk "borrow" lanterns to cuddle | ch2.epi |
| 3 | Moonveil Shrine | **Shrine Bell** | the clapper of the shrine's great bell | the Hollow Samurai, guarding a bell nobody rings any more | ch3.epi |
| 4 | Ironhold Pass | **Pass Beacon** | the brazier on the beacon tower at Ironhold Gate | the Orc General, whose clan fled a rumbling mountain | ch4.epi |
| 5 | Gloomfen Marsh | **Willow Root** | among the roots of the Drowned Willow | the willow itself, shivering; the bog-sleepers woke early and grumpy | ch5.epi |
| 6 | Clockwork Foundry | **Foundry Heart** | the core of the foundry's great furnace | goblins whose burrows froze; they built a walking heater | ch6.epi |
| 7 | Oni Festival | **Festival Drum** | the skin of the great festival taiko | the Oni Champion; the oni fled the smoking peaks | ch7.epi |
| 8 | Ashwing Peaks | **Hearthstone** | the summit stone, the heart of the ring | the Ashwing Matriarch and her clutch of eggs | ch8.epi |

Hikari's motto, "One petal at a time", turns out to be the literal plan: seven petals, then the heart.

### 2.5 Where the monsters come from

The wilds lie between and beyond the petal-stones, and every monster family has a home there. This spring the ward
is dimming and the nights are cold, so the wilds are restless. Monsters drift toward the warmest, brightest place they
know, which is the city. **Defeated monsters "poof" into sparkles and scurry home, sulky but unharmed.** Slimes
"pop" into droplets that bounce away. Nobody dies, nothing bleeds, and no one is ever "killed" in story text.

| Family | Home | Personality | Why they're out this spring | Sample lines (≤ 6 words) |
|---|---|---|---|---|
| Slimes | garden meadows | greedy, bouncy, love flowers and warm stones | basking on the warm fountain | "Bloop." "Blorp?" "Throne. Warm." |
| Goblins | burrows under the foundry hill | mischievous tinkerers who "borrow" things | burrows froze; camping in the warm foundry | "Borrowing! Just borrowing!" "Shiny!" |
| Lizardfolk | lake reeds | territorial, love shiny lanterns | cuddling stolen lanterns for warmth | "Hssss. Lantern warm." |
| Ghosts | shrine woods | lost and shy; fog makes them bold | the incense fog, and a silent bell | "Boo… sorry." "Hehehe… hide!" |
| Orcs and wolves | the high pass | proud marchers who love rules and duels | the mountain rumbles and they won't go back | "HONOUR!" "Send your STRONGEST!" |
| Ghouls ("bog-sleepers") | the fen mud | gloomy, damp, hungry; *not* dead people, just very soggy | woke early from their long nap, grumpy | "Mmmrrh… too early." |
| Plants | the fen | the sick old willow's roots and seedlings | the Willow Root went cold | "Creeeak… cold…" |
| Constructs | the foundry | old automatons, rewired by goblins | goblin "improvements" | "BZZT. Spoon detected." |
| Oni | the foothills of the peaks | festival-crazy, competitive, loud and fair | fled the smoking peaks; joined the party | "FESTIVAL! FIGHT! THEN DANCE!" |
| Fae | festival lanterns | pranksters with illusions | festivals are irresistible | "Which one's real? Teehee!" |
| Dragons | Ashwing Peaks | ancient, proud, fiercely protective | the Matriarch woke early to nest | "RRRAAAH!" "MINE! WARM!" |

Boss and NPC speakers use their enemy ids (`slime_prince`, `lizard_basilisk`, `ghost_hollowknight`, `orc_general`,
`plant_treant`, `goblin_machine`, `goblin_chief`, `oni_champion`, `dragon_ashwing`); all of them exist in `ENEMY_MAP`.
Their plates read from data ("Hollow Samurai", "Elder Treant", "Goblin Chieftain"), so text calls them by role ("the
armour", "the old willow", "the Chieftain") rather than repeating a plate name that may change. **Wobble**, Yuki's pet slime, speaks as
`slime_droplet` with `name: 'Wobble'` (it only ever says "Bloop.").

### 2.6 Sensei

The academy's new tactics advisor, who arrives on the spring ferry. Everyone calls them **Sensei**. Their gender,
age and face are never shown or stated, and nobody describes them. Sensei speaks through choices (one per episode at
most) and almost never with a name plate. The girls trust Sensei's plans; Hikari treats Sensei as a partner and
equal. Sensei's choices are always kind, sometimes silly, never mean and never romantic. Running secret: **Hikari
herself asked for a Sensei** on the night the first stone dimmed (revealed in ch8.epi).

**Open owner question (spec §8.1):** the player stays "Sensei" and Hikari keeps "Captain" until the owner says
otherwise. Writers type "Sensei" as plain text. If the owner switches the player to "Captain", Builder 3 does one
replace pass over `src/data/story/**` and the girls' lines that address *Hikari* as "Captain" (about 25, all easy to
find with a search for `Captain`) move to her new title. Nothing in the plot depends on the word.

---

## 3. The overarching mystery: "The Quiet Stones"

**The question the player carries:** *who is dimming the wardstones?*

**The truth (never stated before ch8.mid):** The Ashwing Matriarch sleeps a hundred years at a time. This spring she
woke early, in a late frost, with a clutch of eggs due. She flew the whole ward ring looking for the warmest bed,
resting at each petal-stone and leaving a scale behind, and chose the Hearthstone. The founders built the heart to
*keep what it loves warm*, and the eggs needed warmth more than anything, so the heart began pulling light from every
petal-stone down the petal lines. The stones dimmed, the land grew colder, and the wilds grew restless. Every time
Hikari relights a stone, that new light also flows north. **The Sentinels have been warming the eggs all along.**

**Why nobody guesses sooner:** every chapter has an obvious "suspect" sitting on the stone, and every suspect turns
out to be one more creature trying to stay warm. Kage's **suspect board** (§6) makes this a running joke: each chapter
crosses off a suspect, and Sensei stays on the list "for suspicious timing" until the very end.

### 3.1 Clue ladder (every writer must land their chapter's clue)

| Ep | Clue | How it lands |
|---|---|---|
| opening | Hikari: the eight wardstones have started to dim | one line, no drama |
| tut.outro | the fountain's glow is low again | Hikari, one glance |
| ch1.mid | the Slime Prince is basking: the stone is the last warm spot | "Throne. Warm." Rei rules the slimes out ("not clever enough") |
| ch1.epi | **First light** relights the Fountain Stone; its light leans **north** for a heartbeat; **scale #1**, warm "like a cup of tea" | narrate + Aoi |
| ch2.pro | lizardfolk don't break lanterns; they curl round them "like cats on a stove". The nights are cold | Sango, Hikari |
| ch2.epi | **scale #2**; the light leans north again. Nami: "One's an accident. Two's a pattern." The suspect board starts | Sango, Nami, Kage |
| ch3.umeko | the founders' record: seven petals and a heart, the **Hearthstone** on Ashwing Peaks. "The heart keeps what it loves warm." | Miko |
| ch3.epi | **scale #3**; Shiro has measured it: every relit stone bends its light **four degrees north** | Shiro |
| ch4.pro/mid | the orcs aren't attacking; they're *leaving* the mountain. "Big sleeper wakes up." | Shiro, Orc General |
| ch4.epi | **scale #4**, warm as a firework fuse | Akane |
| ch5.pro | Midori: the scales are "not fish, not lizard, something much older". Luna's riddle: *grey as ash, warm as fresh bread, has visited every stone this spring* | Midori, Luna |
| ch5.mid | Luna: "Not who. Ask instead: where is the warmth going?" Hikari: "North." | Luna, Hikari |
| ch5.epi | **scale #5**; Luna: "You already know where this ends." Hikari: "Ashwing Peaks." | Luna |
| ch6.pro | the goblins left their *frozen* burrows; "everyone's running from the cold" | Chika, Hikari |
| ch6.epi | **scale #6**, the warmest yet | Suzu |
| ch7.pro | the oni came down because the peaks are **smoking** | Momo |
| ch7.epi | **scale #7**; the Oni Champion: the **Ashwing Matriarch woke too early, in the cold** | Momo relays it |
| ch8.pro | trace each stone's leaning light on the map and the lines all meet at the summit | Hikari, Shiro |
| ch8.mid | **Reveal:** the nest sits on the Hearthstone; eggs; "The founders weren't writing a poem. They were writing instructions." | Luna, Hikari, Nami |
| ch8.epi | **Payoff:** the Hearthstone is relit, all eight shine, the eggs hatch. "We've been keeping her eggs warm since the fountain." **Scale #8** is a gift. Hikari asked for Sensei. Board: "Sensei: CLEARED." | Aoi, Hikari, narrate |

**What the player already knows.** The campaign map names stage 8-5 "The Ashwing Matriarch", and the chapter 8
blurb mentions her nest. That is fine: the mystery is never *who lives on the peaks*. It is *why the stones are
dimming*, and the twist is that nobody is stealing anything and that the Sentinels have been helping her all along.
A player who guesses "the dragon did it" early is still surprised by the eggs and the reason.

Rules: never use the words "dragon" or "Matriarch" for the culprit before ch7.epi (Midori may say "something much
older"). Never let anyone blame Hikari aloud; the worry lives only in her own lines until ch7.epi. The scales are
**grey, warm, small** (smaller than a petal) and always found *at* the stone.

### 3.2 Hikari's private thread (the heart of the mystery)

The stones began to dim the same week Hikari received the Dawnblade. She suspects the ward knows she isn't ready.
She hides it behind sunshine and jokes. Tells, one per chapter at most: her hand going to the Dawnblade's hilt when
the light leans north; "One petal at a time" said a little too quickly; Nami noticing her tired smile. It resolves in
ch7.epi (confession to Nami and Luna, then Sensei's choice) and pays off in ch8.mid ("Stay behind me— no. Stand
with me.") and ch8.epi ("I couldn't protect everyone alone. So I asked. And you came.").

---

## 4. Hikari, the anchor

**Who she is.** Captain of the Sentinel Guard and the academy's senior guardian, a **young adult** (never give a
number). This is her first spring as Captain. She was once a Sentinel cadet herself: Luna was her teacher in the night
courses and Nami trained beside her. She watches every sunrise from the Wall. She keeps the Captain's Journal.

**What she wants:** to protect everyone, all the time, by herself if she has to. **What she needs:** to let people
stand beside her. **Her arc** runs from "Stay behind me" to "Stand with me".

**Voice.**
* Warm and bright, with short exclamations and big-sister teasing ("Hehe", "Sensei!"). She is generous with praise
  and specific about it ("your arrows stopped every one of them").
* In danger she drops the flourishes: short sentences, calm orders, always "we".
* Kawaii flourishes are rationed: at most one ♡ per scene, at most one "hehe" per scene.
* She is **never flustered or romantic** with anyone, including Sensei. She can be surprised, sheepish or teary, but
  never embarrassed in a romantic way.
* She treats monsters kindly: "Shh, it's all right." She never mocks them.
* Catchphrases (use sparingly, about one per episode at most): **"The dawn is never late."**, **"One petal at a
  time."** and the relighting words **"First light."**

```text
hikari   smile        Good morning, Sensei! I saved you the best seat on the wall. Well, the only seat. It's a wall.
hikari   laugh        {name:akane}, that's the third rocket today. Into the box it goes. You'll get them back someday.
hikari   determined   Shh. It's all right. We're not here to hurt you. We just want everyone home and warm.
hikari   neutral      Stay behind me. …No. Actually, stand with me. That's better.
hikari   wink         One petal at a time, Sensei. That's how you climb a mountain, too.
```

**Never:** gives up, blames a student, talks about anyone's looks, flirts, says her age, or wins alone.

**Hikari per chapter (her beat):**

| Ch | Hikari's beat |
|---|---|
| 0 | Sunshine on a wall; hides the worry behind "The dawn is never late!" |
| 1 | First relighting. Relief, and a flicker of worry when the light leans north |
| 2 | Nami sees through her ("carrying the sunrise uphill"); Hikari deflects with a joke |
| 3 | The Hollow Samurai guards alone, and she says "I know that feeling a little." She rings the bell *with* others |
| 4 | Teaches Kaede "We win together", which is also a lesson for herself |
| 5 | Becomes a student again beside Luna; says the word "North" aloud |
| 6 | The comedy chapter: she laughs, confiscates, and gives the goblins warmth instead of blame |
| 7 | Confession: "maybe it was my fault". Nami, Luna and Sensei answer. "Together." |
| 8 | "We protect what we love. So does she." Stands *with* her squad. Reveals she asked for Sensei. Closes the journal: "Chapter one of many." |

---

## 5. Cast voice sheet

Names, titles and portraits come from data. Never describe hair colours or outfits in dialogue, because the roster
merge is changing the art. Every sample line below is lint-clean and can be pasted into a scene.

**Story cast versus the player's team.** Every girl lives at the academy and can appear in a
scene whether or not the player has recruited her. Only the eight free girls *join* in the text (Yuki 1-2, Nami and
Sango 1-5, Kage 2-5, Umeko 3-2, Shiro 3-5, Midori 4-5, Suzu 5-5, matching `acquisition` in `units.js`). Gacha girls
(Luna, Akane, Raika, Miko, Momo, Hotaru, Kaede, Chika) are introduced as classmates or guardians with a club or a
post, never as "now on your team", and no scene mentions pulls, rarity or the player's roster. The first time a girl
speaks she says her club or someone introduces her, so Sensei meets everyone properly.

### 5.1 The guardians (adults; they mentor and never act romantic)

**Luna, the Moonfox Oracle.** Hikari's old teacher from the night courses; she lives in the Observatory Tower and
reads the moon. Sly fox smile, playful riddles, moon metaphors. She calls Hikari **"little dawn"**. She knows more
than she says, but always lets the students find the answer themselves. She is never cruel and never cryptic for
its own sake: every riddle has a kind answer.

```text
luna     smile        The moon never hurries, and she's never late. Take a breath, little dawn.
luna     wink         Foxes don't sneak, Sensei. We simply arrive before anyone was looking.
luna     neutral      Some answers grow sweeter if you don't pull them up too early.
```

**Nami, the Tide Admiral.** Keeper of the harbour, Hikari's oldest friend; they trained together as cadets. Composed,
with dry nautical wit. Every student is "her crew", and she is fiercely protective of them. She calls Hikari **"Captain
Sunshine"** or just "Sunshine". Running bit: she writes strongly worded letters to natural phenomena.

```text
nami     deadpan      I've written the moon a strongly worded letter. It hasn't replied. Typical.
nami     smile        Every girl on that shore is my crew, Sensei. Nobody gets left on the dock.
nami     neutral      Steady, {name:sango}. The sea respects patience. Cannons, less so.
```

**Hikari, the Dawnblade Captain:** see §4.

### 5.2 The first squad (opening, tutorial, ch1, ch8 bookend)

**Aoi, the Wind Ranger.** A first-year archer: earnest, a little nervous, rock-steady when it counts. "I'll do my very
best!" She keeps a notebook of every target she has ever missed (it is very short). Her calming ritual is "Breathe in.
Draw. Release."

```text
aoi      sparkle      Sensei! Nine hits out of ten! The tenth was a bird. It moved!
aoi      sweat        It's so dark… okay. Breathe in. Draw. Release. I'll do my very best!
aoi      determined   Point me at it, Sensei. I won't miss twice.
```

**Rei, the Sakura Samurai.** Deadpan and formal; speaks in short sentences. She secretly loves gardening and tea, and
treats tiny things with total seriousness. She keeps the **Flower Ledger**, a record of every flower lost to monsters.
Under the deadpan she is very kind.

```text
rei      deadpan      I take everything seriously. Including tea. Especially tea.
rei      deadpan      Flower Ledger, page three. One daisy, stepped on by an orc. He apologised. Noted.
rei      determined   The corners are mine, Sensei. Send them round the bend.
```

**Yuki, the Frost Mage.** A sleepy bookworm from the North Dorm library. Soft voice, very dry humour. She hates being
rushed and has never once been late. She frosts things by accident (tea, birdbaths, fuses), and she names the slimes.

```text
yuki     sleepy       …I was not asleep. I was reading with my eyes closed. It's a technique.
yuki     deadpan      I froze my tea again. It's a tea popsicle now. I'm choosing to be happy about it.
yuki     smile        Slow down. Please. …Thank you. Now {name:aoi} can do the rest.
```

### 5.3 Harbour and shrine

**Sango, the Coral Corsair.** Sunny pirate enthusiasm ("Ahoy!") and Nami's eager cannoneer. She loves her cannon and
the sea, and gets nautical words gleefully wrong.

```text
sango    joy          Ahoy, Sensei! Cannon loaded, raft floating, morale at maximum!
sango    sparkle      Port, starboard, and… the other one! I always forget the other one!
sango    determined   Armour? Not for long! Coral shells, away!
```

**Kage, the Shadow Ninja.** Makes over-dramatic entrances ("Fear not! The shadows bring tidings!"), but is really the
friendliest courier in the academy. Always has snacks (rice crackers). She keeps the **suspect board** and pins notes
on doors. "I was always here. Mostly."

```text
kage     determined   Fear not! The shadows bring tidings! …And a parcel for the tea club.
kage     wink         I was always here. Mostly.
kage     deadpan      Suspect board, revised. You're still on it, Sensei. Nothing personal. Cracker?
```

**Miko, the Shrine Keeper.** Gentle and proper, a little strict about manners (shoes off, no running, no fireworks
before nine). Unexpectedly competitive at festival games. Has a polite rivalry with Umeko.

```text
miko     smile        May the blossoms guide your aim, Sensei.
miko     pout         Captain. Please come down from the roof. It is a sacred roof.
miko     determined   The ring toss is a sacred festival tradition. I intend to win it. Respectfully.
```

**Umeko, the Pearl Warden.** Serene, formal and unhurried; she speaks in tide proverbs and notices everything. Her pearl
light shows hidden things to everyone near her.

```text
umeko    neutral      The tide hides nothing forever.
umeko    smile        A wave that hurries breaks early. Let us be the slow, wide kind.
umeko    smile        I see you bowed deeper, honoured keeper. I shall bow deeper still.
```

**Hotaru, the Lantern Keeper.** Soft and kind; she sees the lonely side of spirits and talks to her fireflies by
name. Quietly brave.

```text
hotaru   smile        There, there. The lanterns know the way home.
hotaru   sad          It isn't angry. It's only lonely. Most scary things are.
hotaru   smile        This firefly is called Pip. He says hello, Sensei.
```

### 5.4 Mountain, marsh and foundry

**Shiro, the Moon Sniper.** Calm and precise, she talks in numbers and clipped reports, and is very kind underneath.
She carries candy for her spotters.

```text
shiro    neutral      Report. Targets: twelve. Wind: light. Chance {name:akane} explodes something: ninety-four percent.
shiro    neutral      Target confirmed.
shiro    smile        Good spotting, Sensei. Candy. Lemon. My favourite. Don't tell {name:kage}.
```

**Akane, the Flame Witch.** Loud, bubbly and impossible to discourage. She loves fireworks "with *exactly* the right
amount of boom", always wears her safety goggles ("safety first, boom second"), and signs her fireworks with a heart.
She is the sworn enemy of the **Confiscation Box**.

```text
akane    joy          Showtime! Exactly the right amount of boom, and not one boom more!
akane    pout         Captain, that's my second-favourite rocket! …Fine. The box can have it. FOR NOW.
akane    sparkle      Goggles: on. Hat: on. Boom: imminent!
```

**Kaede, the Crimson Fencer.** Proud and honourable, she loves duels and **bows to every opponent, even slimes**. She is
learning teamwork: "…Together is acceptable." (ch4) grows into "Today I fence for all of us." (ch7)

```text
kaede    determined   I bow to you, slime. Now we fence.
kaede    pout         …Together. Hm. Together is acceptable.
kaede    smile        Today I fence for all of us. It feels… lighter, somehow.
```

**Midori, the Potion Alchemist.** Curious and chatty. She labels everything "probably safe" with a percentage and says
"Fascinating!" a lot. She is a scientist at heart: hypothesis, test, delight.

```text
midori   sparkle      Fascinating! And slightly alarming! Mostly fascinating!
midori   idea         Hypothesis: it fizzes. Test: let's find out! Chance it's safe: seventy percent!
midori   smile        I labelled your tea "probably tea," Sensei. You're welcome.
```

**Suzu, the Bell Trapper.** Tidy, bright and sing-song. She has a bell for every occasion (the breakfast bell, the
"good job" bell, the "everything is stolen" bell) and is far more organised than she looks.

```text
suzu     smile        Ring-ring! That's the "good job" bell. I don't use it often. Feel special!
suzu     surprise     Bells! All the bells! Sorry, all of them is the correct number for this!
suzu     idea         Traps by the exit, labels on the traps, and the traps go ring. Easy!
```

**Chika, the Clockwork Mechanic.** Practical. She grumbles about tools, spoons and bad welds, and is proud of her
machines, which she names. Secretly soft: she builds the goblins proper heaters.

```text
chika    pout         They used my torque wrench as a spoon. I will never emotionally recover.
chika    neutral      Give me ten minutes and a toolbox. Five if nobody helps.
chika    smile        Sentry Number Two says hello. Number One is shy. They're machines. I'm still proud of them.
```

**Raika, the Storm Caller.** Sunny, loud and competitive. She turns everything into a race and makes thunder puns
she refuses to apologise for.

```text
raika    joy          Race you to the gate! Loser carries the lightning rods!
raika    laugh        That plan was electrifying, Sensei! …I'm not sorry. I'll never be sorry.
raika    determined   Many small hits? My lightning never strikes just once!
```

**Momo, the Starlight Idol.** A bubbly performer who cheers everyone on and **turns news into songs**. She is always
rehearsing and always counting the audience.

```text
momo     joy          Everybody clap! Sensei, you too! Especially you!
momo     sparkle      New song! "The Very Smug Basilisk"! Verse one: he was smug. Verse two: still smug.
momo     wink         An encore? For the Sentinels, always!
```

### 5.5 Key relationships (for banter)

| Pair | Dynamic |
|---|---|
| Hikari & Nami | old friends; Nami teases ("Sunshine") and sees through her |
| Hikari & Luna | teacher and former student; Luna still calls her "little dawn" |
| Aoi, Rei & Yuki | the first squad: earnest, deadpan, sleepy. A comic trio, and the bookend of the story |
| Nami & Sango | the admiral and her overexcited cannoneer |
| Miko & Umeko | two shrine keepers in a bowing contest neither will lose |
| Kage & Shiro | courier and watcher; Kage steals Shiro's candy and Shiro pretends not to notice |
| Akane & Hikari | the Confiscation Box feud |
| Kaede & Hikari | "We win together" |
| Midori & Yuki | "probably safe" versus the deadpan |
| Chika, Raika & Suzu | the foundry trio: grumbling, thunder and bells |

### 5.6 Later girls (only `ifUnit` cameos until the roster lands)

Provisional one-line voices; the roster branch owns their final personalities. Keep cameos to one line each and give
them `at: 'off'` when the episode already has four portraits.

| id | Cameo idea |
|---|---|
| kanna (adult guardian) | the festival's drum master; wants her trophy back "and a rematch" (ch7.mid) |
| seiran (adult guardian) | a storm rider who scouted the peaks; reports wind over the nest (ch8.pro) |
| yoriko (adult guardian) | runs the festival puppet show; her puppets "saw something big fly north" (ch7.pro) |
| hana | falcon spotter at base camp (ch8.pro) |
| tsubaki | mortar crew on the pass, very proud of her rangefinder (ch4.pro) |
| kohaku | helps Miko read the founders' record (ch3.umeko) |
| ruri | her fox familiar sniffs out the willow's cold roots (ch5.mid) |
| fuu | dances the festival wind back the right way (ch7.pro) |
| noa | brings warm blankets to base camp (ch8.pro) |
| iroha | the Mirror Parade's mirrors were hers; she wants them back (ch7.mid) |
| ena | reads fortunes at the festival and draws "a big warm surprise" (ch7.epi) |

---

## 6. Running jokes

Each joke has a setup, beats along the way and a payoff. Pay off every one of them in ch8.epi or earlier.

1. **Hikari's high places.** She greets people from the top of things: the Wall (opening), a lamppost on the shore
   (ch2.pro: "Captain. There is a perfectly good pier."), the shrine roof (ch3.pro: "It is a sacred roof.").
   *Payoff ch8.epi:* she's back on the Wall at sunrise: "Some things never change."
2. **Rei's Flower Ledger.** Two tulips lost in the tutorial; the Slime Prince wears her roses as a crown (ch1.mid);
   orcs trample the mountain heather (ch4.pro). *Payoff ch8.epi:* "Lost: two tulips and some heather. Roses: returned.
   Slightly sticky." / "Flowers planted: two
   hundred. I am satisfied."
3. **Kage's suspect board.** Starts in ch2.epi: "slimes, lizards, the moon… and Sensei. Very suspicious timing."
   Ghosts are added for giggling (ch3.pro) and "warm" is added as a concept (ch3.umeko). Notes on doors read as narrate
   lines in chapters without Kage (ch6.epi, ch8.pro). *Payoff ch8.epi:* "Sensei — CLEARED. (Still suspicious about snacks.)"
4. **Akane's Confiscation Box.** Hikari confiscates a rocket in ch4.pro ("It has a heart painted on it!") and
   pre-confiscates "the idea" in ch6.mid; Miko bans fireworks before nine (ch7.pro). *Payoff ch7.epi:* the festival
   fireworks come from the box. "I told her she'd get them back someday."
5. **Wobble the slime.** Yuki names a jelly in the ch1.mid choice. Optional narrate cameos: "{name:yuki}'s hood
   wobbles. She says it's the wind." *Payoff ch8.epi:* "Wobble came to the festival. It ate a lantern. …A small one."
6. **Midori's percentages.** "Probably safe": seventy percent, "eighty if it's sunny" (ch5.mid). She labels scale #5
   "Probably a clue."
7. **Momo's news songs.** "The Ballad of the Six Grey Scales" (ch6.epi). Chika: "That's not a ballad. That's a list."
   The ch7 concert.
8. **Nami's strongly worded letters** to the moon, the tide and the weather. They never reply.
9. **Suzu's bells for every occasion.** The "everything is stolen" bell (ch5.epi); the "good job" bell.
10. **Kaede bows to everything**, including slimes, orcs and an oni who bows back.
11. **Yuki's accidental frost**: the birdbath (ch1.yuki), tea popsicles; "…I'll bring a warmer book."
12. **Hikari's journal doodles**: Sensei drawn as a little star in a hat ("I can't draw faces"). Use in lesson
    mini-scenes only.

---

## 7. Chapter-by-chapter outline (27 episodes)

### 7.0 Chapters at a glance

The whole arc on one page. Joins in **bold** (free girls, by stage). Every chapter: one wardstone relit with "First
light", one warm grey scale found, one laugh, one quiet moment, and a boss who goes home better off.

| Ch | Place · wardstone | What happens | Who appears | Heart · laugh | Hook into the next chapter |
|---|---|---|---|---|---|
| 0 | Academy Hill · (the fountain glows low) | Hikari waves to Sensei from the Wall; the stones are dimming; slimes eat the tulips; the coached first battle on 1-1; the Captain's Journal begins | Hikari, Aoi, Rei | A captain hiding worry behind sunshine · "Well, the only seat. It's a wall." and Rei's tulip funeral | "The fountain's glow is low again" |
| 1 | Sakura Gardens · Fountain Stone | Yuki's "accidental" frost trips the goblins; the slimes crown a Slime Prince with Rei's roses on the Founders' Fountain; the first "First light"; scale #1 leans north | Hikari, Aoi, Rei, **Yuki** (1-2), **Nami, Sango** (1-5) | Yuki is welcome exactly as she is · the rose crown, Wobble the slime | Nami: lizardfolk are taking the lake lanterns; the Moon-Pier Lantern flickers |
| 2 | Moonlit Lakeshore · Moon-Pier Lantern | Night patrol; lizards don't break lanterns, they cuddle them for warmth; a smug Bog Basilisk hugs the pier lantern; scale #2, "two's a pattern"; Kage's suspect board | Hikari, Nami, Sango, Aoi, Yuki, **Kage** (2-5) | Aoi's courage in the dark; Nami: "You don't have to carry the whole lake" · "It just gets very smug." | Kage: fog on Moonveil Shrine, its bell has gone silent |
| 3 | Moonveil Shrine · Shrine Bell | Shy ghosts in incense fog; shrine manners; Umeko's boat and the bowing contest; the founders' record ("The heart keeps what it loves warm"); a lonely armour guarding a bell nobody rings; they ring it together | Miko, Kage, Aoi, **Umeko** (3-2), Hotaru, **Shiro** (3-5) | Hikari: "Standing watch alone… I know that feeling a little." · "It is a sacred roof." | Shiro: every relit light bends four degrees north; orc columns on Ironhold Pass |
| 4 | Ironhold Pass · Pass Beacon | Armoured orcs are *leaving* the mountain, not attacking; Akane's rocket goes in the Confiscation Box; the Orc General wants a duel; "We win together"; the orcs become the pass's proud gatekeepers | Shiro, Akane, Rei, Kaede, **Midori** (4-5), Yuki | Kaede learns "together", and so does Hikari · Kaede bows to an orc | Midori: the marsh plants have started walking |
| 5 | Gloomfen Marsh · Willow Root | Luna steps out of the fog ("little dawn") with a riddle; an old willow that is shivering, not cruel; "Where is the warmth going?" "North."; the mountain is named | Luna, Umeko, Midori, Hotaru, **Suzu** (5-5) | Hikari is someone's student again; Luna slows her down · the rude frog, "seventy percent, eighty if it's sunny" | Every bell rings: goblin engineers took the foundry |
| 6 | Clockwork Foundry · Foundry Heart | Goblins camping in Chika's workshop because their burrows froze; the torque-wrench spoon; the Goblin Machine is a giant walking heater in a knitted scarf; Chika builds them proper heaters | Chika, Raika, Suzu, Akane, Momo | The "villains" were only cold · the scarf, the honk, "confiscated in advance" | A festival flyer with "OGRES??" on the back; Momo's concert is tonight |
| 7 | Oni Festival · Festival Drum | Festival rules; the oni fled the smoking peaks; Kaede fences "for all of us"; the Confiscation Box becomes the fireworks; the Matriarch woke too early in the cold; Hikari's confession | Miko, Momo, Kaede, Akane, Luna, Nami (+ `ifUnit` Kanna, Yoriko) | The story's heart: "Maybe it was my fault." "You were never the shadow." · the oni rates the festival ten out of ten | "Ashwing Peaks, tomorrow. All of us. Together." |
| 8 | Ashwing Peaks · Hearthstone | Base camp with half the academy and the bakery's buns; the lines on the map meet at the summit; the reveal: a mother keeping her eggs warm on the Hearthstone; calm her, don't hurt her; all eight stones shine, the eggs hatch, the trees bloom twice; Hikari asked for Sensei herself | Nami, Shiro, Luna, Aoi, then Rei and Yuki for the bookend (+ `ifUnit` Seiran, Hana, Noa) | "Stay behind me— no. Stand with me." / "I couldn't protect everyone alone. So I asked. And you came." · Wobble ate a lantern; "Sensei: CLEARED" | "Chapter one of many" (§7.10) |

### 7.1 Episode map

| # | id | Trigger | Title | Cast (portraits) | One-line beat |
|---|---|---|---|---|---|
| 1 | `opening` | opening | Meet Hikari | hikari, aoi, rei | Hikari waves from the Wall; the stones are dimming; slimes in the tulips; first lesson |
| 2 | `tut.outro` | tutorial won | First Petals | hikari, aoi, rei | Garden saved; the Captain's Journal begins; the fountain's glow is low |
| 3 | `ch1.yuki` | after 1-2 | Snow in Spring | yuki, aoi, hikari | Yuki's "accidental" frost stopped the goblins; her frost is welcome here |
| 4 | `ch1.mid` | before 1-5 | The Jelly Throne | hikari, rei, aoi, yuki | The Slime Prince basks on the Fountain Stone wearing Rei's roses; Wobble is named |
| 5 | `ch1.epi` | after 1-5 | Ripples on the Lake | hikari, aoi, sango, nami | First light; light leans north; scale #1; Nami and Sango arrive |
| 6 | `ch2.pro` | before 2-1 | Lanterns on the Water | hikari, nami, sango, aoi | Night patrol; lizards cuddle lanterns; Aoi finds her courage |
| 7 | `ch2.mid` | before 2-5 | Basilisk Moon | hikari, nami, sango, yuki | A smug basilisk hugs the Moon-Pier Lantern |
| 8 | `ch2.epi` | after 2-5 | A Letter from the Shadows | hikari, sango, nami, kage | Scale #2, "two's a pattern"; Kage drops in; the suspect board |
| 9 | `ch3.pro` | before 3-1 | The Silent Bell | miko, hikari, kage, aoi | Shrine manners in a ghost fog; the bell is silent |
| 10 | `ch3.umeko` | after 3-2 | Pearl in the Fog | umeko, hikari, miko, kage | Umeko arrives; bowing contest; the founders' record of the Hearthstone |
| 11 | `ch3.mid` | before 3-5 | Hollow Guard | miko, hotaru, hikari, umeko | A lonely armour guards a bell nobody rings; "I know that feeling" |
| 12 | `ch3.epi` | after 3-5 | Silver Over the Pass | hotaru, hikari, miko, shiro | The bell rings; scale #3; Shiro: four degrees north |
| 13 | `ch4.pro` | before 4-1 | Iron Column | shiro, akane, hikari, rei | Armoured orcs; the Confiscation Box; the orcs are leaving something |
| 14 | `ch4.mid` | before 4-5 | The Iron General | kaede, hikari, shiro, akane | A duel demanded; "We win together"; "Big sleeper wakes" |
| 15 | `ch4.epi` | after 4-5 | Bubbles in the Fen | akane, hikari, midori, yuki | The beacon is lit; the orcs guard the pass; scale #4; Midori fizzes in |
| 16 | `ch5.pro` | before 5-1 | Leeches in the Fog | luna, hikari, umeko, midori | Luna returns; "little dawn"; the riddle |
| 17 | `ch5.mid` | before 5-5 | The Drowned Willow | hotaru, midori, luna, hikari | The willow is shivering; "where is the warmth going?" "North." |
| 18 | `ch5.epi` | after 5-5 | Bells and Bolts | hikari, midori, luna, suzu | Scale #5; "Ashwing Peaks"; Suzu rings every bell: the foundry is taken |
| 19 | `ch6.pro` | before 6-1 | Crystal Vats | chika, hikari, raika, suzu | Goblins camping in Chika's workshop because their burrows froze |
| 20 | `ch6.mid` | before 6-5 | The Goblin Machine | chika, akane, hikari, raika | A giant walking heater in a knitted scarf |
| 21 | `ch6.epi` | after 6-5 | A Flyer for the Festival | hikari, suzu, chika, momo | Heaters for the goblins; scale #6; Momo's ballad |
| 22 | `ch7.pro` | before 7-1 | Festival Wind | miko, momo, kaede, hikari | Festival rules; oni down from the smoking peaks |
| 23 | `ch7.mid` | before 7-5 | Champion of the Festival | akane, kaede, hikari, momo | Kaede fences "for all of us"; Kanna cameo (off) |
| 24 | `ch7.epi` | after 7-5 | Embers on the Peak | momo, hikari, luna, nami | Box fireworks; the Matriarch woke; Hikari's confession |
| 25 | `ch8.pro` | before 8-1 | Wings over the Ascent | nami, shiro, luna, hikari | Base camp; the lines meet at the summit; "Nobody gets hurt" |
| 26 | `ch8.mid` | before 8-5 | The Ashwing Matriarch | aoi, luna, hikari, nami | The reveal: a mother keeping her eggs warm; "Stand with me" |
| 27 | `ch8.epi` | after 8-5 | Petals Again | hikari, aoi, rei, yuki | All eight stones shine; the eggs hatch; the second bloom; "I asked for you" |

Each episode below gives: **setting**, **what happens**, **emotional beat**, **clue**, **hook**, and **key lines**.
Key lines are near-complete drafts, about 10–14 spoken lines within the 8–18 limit. Builders may trim, reorder or add
lines within the limits, but must keep the clue line and the hook. Block the stage so that no more than three
portraits stand at once; in four-girl episodes, `exit` someone before the fourth enters.

---

### Chapter 1: Sakura Gardens (Fountain Stone)

*Early spring. Slimes and goblins in the academy gardens. Mechanics: placing girls, upgrading, runners, sprinters,
splitting. Joins: Yuki (1-2), Nami and Sango (1-5). Comedy: Rei's roses become a crown. Heart: Yuki is welcome as
she is.*

The `opening` and `tut.outro` episodes are in §8.

#### `ch1.yuki` · after 1-2 · "Snow in Spring"
`academy-day` · `home` · yuki, aoi, hikari

* **What happens:** after the goblin runners fled, the garden path is covered in frost. In spring. The runners
  slipped on it and slid all the way back into the hedge. Hikari and Aoi follow frosty footprints to the library
  steps, where Yuki sits with a book beside a frozen birdbath.
* **Emotional beat:** the librarian scolds Yuki for frosting the reading room, and she thinks her frost is a nuisance.
  Hikari turns the "accident" into a talent. Yuki is welcome exactly as she is.
* **Mechanic (1 line):** slows plus damage: "Slow them down, and {name:aoi} does the rest."
* **Hook:** gold slimes and dashers are sprinting for the gate (1-3).

```text
narrate                After the goblin runners fled, the whole garden path sparkled with frost. In spring.
aoi      surprise      Captain! The goblins slipped on the ice and slid all the way back into the hedge!
hikari   question      Ice? On a spring morning? …Let's follow the frosty footprints, Sensei.
cue                    enter yuki right (slide-in)
yuki     sleepy        …Oh. Hello. If this is about the birdbath, it was an accident. I was reading.
yuki     sad           The librarian says I frost the reading room. I'm trying very hard not to be cold at people.
hikari   smile         {name:yuki}, those goblins were sprinting for our gate, and your accident stopped every one.
hikari   determined    Slow them down, and {name:aoi} does the rest. Will you walk with the Sentinels?
choice                 1) Welcome to the team!
  yuki   smile           …Welcome. I like that word. It's warm. I'll allow it.
choice                 2) What were you reading?
  yuki   sleepy          A book about penguins. They never rush. I respect them deeply.
aoi      sparkle       A frost mage and an archer! I'll make every arrow count!
yuki     deadpan       Please don't rush, though.
hikari   laugh         Gold slimes are sprinting for the gate next. Perfect weather for a snow mage.
yuki     sleepy        …Fine. But I'm bringing my book.
```

#### `ch1.mid` · before 1-5 · "The Jelly Throne"
`stage:1-5` · `blossom` → `danger` · hikari, rei, aoi, yuki · NPC `slime_prince`, `slime_droplet` (Wobble)

* **What happens:** the slimes have merged into a Slime Prince, who sits on the Founders' Fountain wearing Rei's
  roses as a crown. Hikari points out the first wardstone, glowing faintly.
* **Emotional beat:** comedy. Rei's grief for her roses is total and dignified.
* **Clue:** "Throne. Warm." The Prince is basking on the last warm spot. "Did the slimes dim it?" "Not clever enough."
* **Mechanic (2 lines):** he splits when he falls and his Royal Guards march on; keep Yuki near the fountain.
* **Hook:** take back the garden.

```text
narrate                The Blossom Court's fountain has a new owner.
rei      deadpan       He is wearing my rosebushes. As a crown.
slime_prince sparkle   Bloop. Throne. Warm.
hikari   neutral       That fountain holds our first wardstone, Sensei. See how faintly it glows? It used to light the whole court.
aoi      question      Did the slimes make it go dim?
rei      deadpan       They are not clever enough. Respectfully.
hikari   determined    He pops into smaller jellies when he falls, and his Royal Guards march on. Keep {name:yuki} by the fountain!
yuki     sleepy        Cold jelly. Slow jelly. Understood.
choice                 1) Everyone, on the Captain's signal!
  aoi    determined      Bowstring ready!
choice                 2) Can we keep one small jelly?
  yuki   sleepy          …I already named one. Wobble.
  slime_droplet smile    Bloop.  (plate: "Wobble")
cue                    music danger, shake
slime_prince pout      BLOOP.
rei      determined    My roses. Now.
hikari   joy           Sentinels, let's take back our garden!
```

#### `ch1.epi` · after 1-5 · "Ripples on the Lake"
`academy-sunset` → `cg:sango-harbour` · `home` · hikari, aoi, sango, nami

* **What happens:** the Prince pops into a hundred happy droplets that bounce off toward the lake. Hikari kneels and
  relights the Fountain Stone: **"First light."** The light leans north for a heartbeat. Aoi finds **scale #1** in the
  basin, warm like a cup of tea, and Hikari presses it into her journal. A ship's bell rings and the scene moves to the
  harbour CG: Nami and Sango arrive with news that lizardfolk are stealing lake lanterns at night and the Moon-Pier
  Lantern, the second wardstone, is flickering.
* **Emotional beat:** relief, and the warmth of an old friend. Nami reads Hikari's tired smile at a glance.
* **Lore (1 line):** the founders hid the stones in things people love, "so we'd never stop looking after them".
* **Hook:** night patrol at moonrise.

```text
narrate                The Slime Prince popped into a hundred happy droplets, and they bounced away toward the lake.
hikari   determined    Our turn. Hold still, little stone… First light.
cue                    flash gold, petals
narrate                The fountain blazed gold. For a heartbeat its light leaned north, toward the far mountains.
hikari   smile         The founders hid every wardstone in something people love. So we'd never stop looking after them.
aoi      question      Captain, there's something in the basin. A grey scale? It's warm. Like a cup of tea.
hikari   question      A scale… from what? I'll keep it in my journal. One mystery at a time.
cue                    bg cg:sango-harbour, sfx bell
sango    joy           Ahoy, Sakura Academy! Permission to come ashore?
nami     smile         Evening, Captain Sunshine. You look like you've been carrying the sunrise uphill.
hikari   laugh         Only a little! Sensei, this is {name:nami}, keeper of the harbour, and {name:sango}, her cannoneer.
nami     neutral       Lizardfolk are stealing the lake lanterns at night. And the Moon-Pier Lantern is flickering.
hikari   surprise      The Moon-Pier Lantern… that's the second wardstone.
sango    sparkle       Don't worry! We can stand on WATER, Sensei! Well, {name:nami} can. I have a raft. Same thing!
nami     deadpan       It is not the same thing. Night patrol at moonrise. Bring a lantern you don't mind losing.
```

---

### Chapter 2: Moonlit Lakeshore (Moon-Pier Lantern)

*Spring nights. Lizardfolk, reeds and the moon pier. Mechanics: water placement, regeneration (focus fire),
splitting slimes, fire-warded scales. Joins: Kage (2-5). Comedy: the smug basilisk. Heart: Aoi's courage in the dark,
and Nami's care for Hikari.*

#### `ch2.pro` · before 2-1 · "Lanterns on the Water"
`stage:2-1` · `moonlit` · hikari, nami, sango, aoi

* **What happens:** night patrol on the shore with half the lanterns missing. Hikari surveys from a lamppost (running
  joke). Lizardfolk scouts wade ashore. Sango shows that half the map is lake and that water girls can stand on it.
* **Emotional beat:** Aoi is scared of the dark, and Nami steadies her with a nautical truth.
* **Clue:** the lizards don't break the lanterns; they curl round them "like cats on a stove". The nights are cold.
* **Mechanic (2 lines):** water placement; the hunters heal in the reeds, so focus fire.
* **Hook:** light the shore again.

```text
narrate                Moonrise over the lake. Half the lanterns along the shore have gone missing.
hikari   smile         Best view of the shore is from up here!
nami     deadpan       Captain. There is a perfectly good pier.
sango    joy           Lizardfolk scouts, coming ashore! Sensei, half this map is lake. Put me and the Admiral on the water!
aoi      sweat         It's so dark out there… What if I miss?
nami     smile         Night's just water you can't see the bottom of. Watch the lantern, not the deep. You'll be fine.
sango    question      Funny thing, though. They don't break the lanterns. They curl round them. Like cats on a stove.
hikari   neutral       The nights have been so cold this spring… Maybe they just want somewhere warm.
nami     determined    Warm or not, the hunters heal in the reeds. Focus fire. Never give them two quiet seconds.
choice                 1) Stay close to me, {name:aoi}.
  aoi    determined      …Okay. Breathe in. Draw. Release. I'll do my very best!
choice                 2) Want to borrow a lantern?
  aoi    laugh           Hehe, only if the lizards don't borrow it first!
hikari   determined    Lanterns up, Sentinels. Let's light this shore again!
```

#### `ch2.mid` · before 2-5 · "Basilisk Moon"
`stage:2-5` · `danger` · hikari, nami, sango, yuki · NPC `lizard_basilisk`

* **What happens:** under the full moon the Bog Basilisk lies curled round the Moon-Pier Lantern, and the ferry can't
  pass. "Don't meet its eyes. It gets very smug."
* **Emotional beat:** comedy. The basilisk is vain, sleepy and completely unbothered.
* **Clue:** it is basking round the lantern for warmth (same pattern as the Prince; let the player notice it).
* **Mechanic (1 line):** its scales regrow, so keep up constant fire.
* **Hook:** give the moon her lantern back.

```text
narrate                Under the full moon, something enormous lies curled round the Moon-Pier Lantern.
lizard_basilisk sleepy Hssss. Go away. Am basking.
sango    surprise      It's the Bog Basilisk! The ferry can't get past while it's hugging the lantern!
nami     deadpan       Don't meet its eyes. It doesn't turn you to stone. It just gets very smug.
lizard_basilisk sparkle Hss. Am very handsome. Yes.
yuki     sleepy        I could make it colder. …No. Cold things get grumpy. I would know.
hikari   determined    Its scales grow back fast, Sensei. We keep the pressure on, every second, until it lets go.
choice                 1) Everyone, eyes off its eyes!
  nami   laugh           Eyes on the water, crew. Not on the drama.
choice                 2) Compliment its scales first.
  lizard_basilisk smile  …Hssss. Thank you. Still not moving.
nami     neutral       I'll write the moon a strongly worded letter about this. Afterwards.
hikari   determined    Our second wardstone is inside that lantern. Sentinels, let's give the moon her lantern back!
```

#### `ch2.epi` · after 2-5 · "A Letter from the Shadows"
`academy-night` · `calm` · hikari, sango, nami, kage

* **What happens:** the Moon-Pier Lantern burns again and the ferry bell rings. Sango finds **scale #2** between the
  pier boards. Kage drops out of a tree with a dramatic note: there is fog on Moonveil Shrine, and the shrine bell has
  gone silent. The suspect board begins. Kage joins, officially.
* **Emotional beat:** Nami tells Hikari "You don't have to carry the whole lake by yourself." Hikari smiles and
  changes the subject (her worry stays hidden).
* **Clue:** "One's an accident. Two's a pattern." The light leaned north again.
* **Hook:** the shrine at dawn.

```text
narrate                The Moon-Pier Lantern burns bright again. Across the water, the ferry bell rings.
hikari   smile         Two stones relit… and its light leaned north too. Just like the fountain.
sango    surprise      Captain! Another grey scale, stuck between the pier boards. Still warm!
nami     neutral       Two scales, two stones. One's an accident. Two's a pattern. I don't trust patterns I didn't draw.
hikari   smile         It goes in my journal with the first one. We'll figure it out, one petal at a time.
nami     smile         You don't have to carry the whole lake by yourself, Sunshine. That's what crews are for.
cue                    enter kage right (jolt), shake
kage     determined    Fear not! The shadows bring tidings!
hikari   surprise      {name:kage}?! How long have you been in that tree?
kage     wink          I was always here. Mostly. Delivery: fog on Moonveil Shrine, and the shrine bell has gone silent.
kage     deadpan       Also, I've started a suspect list. Slimes, lizards, the moon… and Sensei. Very suspicious timing.
choice                 1) I'm innocent, I promise!
  kage   laugh           That's exactly what a suspect would say. I like you already.
choice                 2) Fair. I'd suspect me too.
  kage   sparkle         Honest AND suspicious. I'm keeping my eye on you. Rice cracker?
nami     deadpan       She's been eating my crew's snacks all week. I assumed it was gulls.
hikari   determined    The shrine at dawn, everyone. {name:kage}, welcome to the Sentinels. Officially, this time.
```

---

### Chapter 3: Moonveil Shrine (Shrine Bell)

*Incense fog and shy ghosts. Mechanics: Veil Sight (Kage, Hikari, Umeko's aura), phasing; holy and mystic hits
reach spirits. Joins: Umeko (3-2), Shiro (3-5). Comedy: shrine manners and the bowing contest. Heart: a guardian alone,
and the bell rung together.*

#### `ch3.pro` · before 3-1 · "The Silent Bell"
`stage:3-1` · `lantern` · miko, hikari, kage, aoi

* **What happens:** fog rolls down the shrine steps and something giggles inside it. Miko greets Sensei with perfect
  manners in the middle of the chaos, and scolds Hikari off the sacred roof. The bell has been silent for seven days;
  its wardstone sits in the clapper.
* **Emotional beat:** comedy of manners, plus Aoi trusting a friend's eyes.
* **Mechanic (2 lines):** Veil Sight lets only some girls see veiled wraiths; holy light reaches spirits.
* **Hook:** through the torii.

```text
narrate                Incense fog rolls down the shrine steps. Somewhere inside it, something giggles.
miko     smile         Welcome to Moonveil Shrine, Sensei. I am {name:miko}, its keeper. Please bow, wash your hands, and mind the ghosts.
miko     pout          Captain. Please come down from the roof. It is a sacred roof.
hikari   sweat         Sorry, sorry! Best lookout on the hill!
miko     neutral       Our bell has been silent for seven days. Its wardstone sits in the clapper, and it has gone quiet.
kage     determined    Wraiths in the fog. Veiled. {name:aoi} can't see them, but I can. So can the Captain.
aoi      determined    Then I'll shoot wherever you point! Just… point clearly, please.
hikari   determined    Girls with Veil Sight lead the way, Sensei. And holy light reaches spirits nothing else can touch.
kage     deadpan       Suspect list, revised: ghosts. They giggle. Very suspicious.
miko     smile         They are only shy, I think. The fog makes them brave. Please be polite when you defeat them.
hikari   joy           Polite and quick! Sentinels, through the torii!
```

#### `ch3.umeko` · after 3-2 · "Pearl in the Fog"
`stage:3-2` · `calm` · umeko, hikari, miko, kage

* **What happens:** a little boat glides up the shrine canal with a pearl lantern at its bow. Umeko arrives; her pearl
  light shows veiled things to everyone near her. Miko and Umeko have a bowing contest that neither will lose. Miko
  brings out the **founders' record**: seven petals and a heart, the Hearthstone on Ashwing Peaks, and the line "The
  heart keeps what it loves warm."
* **Emotional beat:** the calm after the smoke, and a mystery that suddenly has a map.
* **Clue (keep verbatim):** "The heart keeps what it loves warm."
* **Hook:** something clanks in the sanctum at night.

```text
narrate                A little boat glides up the shrine canal, a pearl lantern glowing at its bow.
umeko    smile         Good evening. I am {name:umeko}, warden of the sea shrine. The tide said you could use more eyes.
hikari   question      The tide said?
umeko    neutral       The tide says many things. Most of them are "wait." Tonight it said "go."
hikari   smile         Your pearl light shows veiled things to everyone nearby, doesn't it? That's a gift.
miko     smile         Welcome, honoured warden.  (fx nod)
umeko    smile         Thank you, honoured keeper.  (fx nod)
narrate                They bow. Then they bow deeper. Then deeper still.
kage     deadpan       They've been bowing for a whole minute. Somebody should stop them. Not me.
miko     idea          Captain, I found the founders' record. Seven wardstones in a ring around the city… and one heart.
miko     neutral       The Hearthstone, on top of Ashwing Peaks. Beside it, they wrote: "The heart keeps what it loves warm."
kage     question      Warm again. Everything this spring is about warm. I'm putting "warm" on the board.
umeko    neutral       The tide hides nothing forever.
hikari   neutral       …Something clanks in the sanctum at night. Let's finish this before the bell forgets how to ring.
```

#### `ch3.mid` · before 3-5 · "Hollow Guard"
`stage:3-5` · `danger` · miko, hotaru, hikari, umeko · NPC `ghost_hollowknight`

* **What happens:** an empty suit of shrine armour walks its rounds in the sanctum. It has stood beside the bell for
  a hundred years and never moved, until now. Hotaru, who keeps the shrine lanterns, hears what it really is.
* **Emotional beat (the chapter's heart):** Hotaru: "It's lonely. It's guarding a bell that nobody rings." Hikari,
  quietly: "Standing watch alone… I know that feeling a little." It is the first crack in her sunshine.
* **Mechanic (1 line):** thick armour and phasing, and holy light reaches it either way.
* **Hook:** ring the bell tonight, together.

```text
narrate                Deep in the sanctum, an empty suit of shrine armour walks its rounds. Clank. Clank. Clank.
ghost_hollowknight determined …Halt. Who comes… to the bell?
miko     sweat         That armour stood beside the bell for a hundred years. It never once moved. Until now.
hikari   smile         Sensei, this is {name:hotaru}. She keeps the shrine lanterns, and she hears what spirits mean.
hotaru   sad           It isn't angry. It's lonely. It's guarding a bell that nobody rings any more.
hikari   sad           Standing watch alone, night after night, waiting for someone to come… I know that feeling a little.
hotaru   smile         Then you know what it needs, Captain. Someone to stand the watch with it.
umeko    determined    Its armour is thick, and it slips between worlds. Holy light reaches it either way.
choice                 1) We'll ring the bell for you!
  ghost_hollowknight question …Ring?
choice                 2) Can it hear us?
  hotaru smile           Spirits always hear kindness. They just answer slowly.
hikari   determined    Then let's answer for it. Sentinels, we ring that bell tonight. Together.
```

#### `ch3.epi` · after 3-5 · "Silver Over the Pass"
`academy-sunset` · `home` · hotaru, hikari, miko, shiro

* **What happens:** the bell rings across the lake. The armour bows once and scatters into fireflies (going home).
  "First light": the clapper stone glows and its light drifts north "like fireflies on a trail". Miko finds **scale
  #3** inside the bell. A mirror flashes from the mountain pass, and then Shiro arrives with a clipped report (three
  orc columns, many wolves, a dark Pass Beacon) and a measurement.
* **Emotional beat:** Hotaru to Hikari: "You ring bells too. Everyone hears when you do."
* **Clue (keep verbatim):** "Every relit stone bends its light four degrees north. Same mountain. I measured."
* **Hook:** march for the pass at dawn.

```text
narrate                The shrine bell rings out across the lake. The empty armour bows once, and scatters into fireflies.
hotaru   smile         It's going home. It can rest now. Thank you, Captain.
hikari   determined    Our turn to keep the watch. First light.
narrate                The bell's stone glows silver-gold. Its light drifts north, like fireflies following a trail.
miko     surprise      Captain, a grey scale, inside the bell. That makes three.
cue                    flash white, exit miko
narrate                Far up on the mountain pass, a mirror flashes. Three short. Three long. Three short.
shiro    neutral       Report. Orc columns on Ironhold Pass: three. Wolves: many. Pass Beacon: dark. Snacks remaining: two.
hikari   surprise      {name:shiro}! You climbed all the way down from the pass?
shiro    neutral       Yes. Also: every relit stone bends its light four degrees north. Same mountain. I measured.
hikari   neutral       Toward Ashwing Peaks… where the Hearthstone sits.
hotaru   smile         Captain? You ring bells too, you know. Everyone hears when you do.
hikari   smile         …Thank you, {name:hotaru}. Sensei, we march for the pass at dawn.
shiro    smile         Sensei. Candy for the road. Spotters get candy.
```

---

### Chapter 4: Ironhold Pass (Pass Beacon)

*Late spring, wind and stone. Mechanics: flat armour (pierce and shred), shieldbearers, pack fury. Finale: the Orc
General. Joins: Midori (4-5). Comedy: the Confiscation Box; Kaede bows to an orc. Heart: "We win together", the
lesson Hikari is teaching herself too.*

#### `ch4.pro` · before 4-1 · "Iron Column"
`stage:4-1` · `ironclock` · shiro, akane, hikari, rei

* **What happens:** Shiro's clipped briefing: ironhide orcs in plate. Akane volunteers "exactly the right amount of
  boom", and Hikari confiscates her favourite rocket (the Confiscation Box is born). Rei logs trampled heather.
* **Clue:** the orcs' tracks come from the north. They're not attacking the pass; they're *leaving* something.
* **Mechanic (2 lines):** small hits bounce off the plate; pierce and armour-breaking shells crack it.
* **Hook:** hold the pass, and ask the orcs afterwards.

```text
narrate                Ironhold Pass. Wind, stone, and the steady thump of iron boots.
shiro    neutral       Briefing. Ironhide orcs. Plate armour. Small hits bounce off. Big, piercing hits do not.
akane    joy           Big hits?! Leave it to {name:akane} of the pyrotechnics club! Exactly the right amount of boom!
hikari   wink          A polite amount of boom, {name:akane}. And I'll hold on to this rocket for now.
akane    pout          Aww! That's my favourite one! It has a heart painted on it!
hikari   laugh         It goes in the box. You'll get it back someday. I promise.
shiro    neutral       Pierce goes through the plate. Armour-breaking shells crack it for everyone else.
rei      deadpan       The orcs are trampling the mountain heather. I am adding it to the ledger.
shiro    question      Note. Their tracks come from the north. They are not attacking the pass. They are leaving something.
hikari   neutral       Leaving the mountains? Then what's up there that even orcs walk away from?
rei      determined    We ask them after. Sensei, your orders.
hikari   determined    Sentinels, hold the pass!
```

#### `ch4.mid` · before 4-5 · "The Iron General"
`stage:4-5` · `danger` · kaede, hikari, shiro, akane · NPC `orc_general`

* **What happens:** at Ironhold Gate the dark beacon tower looms, and on its steps stands a very large orc demanding a
  duel with "your STRONGEST". Kaede is thrilled (and bows first). Hikari: "We don't duel. We win together." Kaede:
  "…Together is acceptable."
* **Emotional beat:** pride meets teamwork. Hikari says the line she most needs to hear herself.
* **Clue:** "Mountain grumbles. Big sleeper wakes up. We are NOT going back up there."
* **Mechanic (2 lines):** when hurt he plants his shield (armour up), then charges.
* **Hook:** together, for the beacon.

```text
narrate                At Ironhold Gate, the dark beacon tower looms. On its steps stands a very large orc.
orc_general determined I am the General! Send your STRONGEST! One fight! HONOUR!
kaede    sparkle       {name:kaede}, fencing club. A duel with a general? Sensei, let me answer him. I'll bow first, of course.
hikari   smile         {name:kaede}, I love that spirit. But we don't duel. We win together.
kaede    pout          …Together. Hm. Together is acceptable. This time.
orc_general sad        Also. Mountain grumbles. Big sleeper wakes up. We are NOT going back up there.
shiro    neutral       That matches my data. Something woke up in the north. Something big.
akane    idea          Then let's light his beacon so bright the sleeper goes back to bed!
shiro    neutral       When he's hurt, he plants his shield and his armour climbs. Then he charges. Keep breaking it.
choice                 1) Bow back to him, {name:kaede}.
  kaede  determined      Of course. A proper bow. …Then a proper defeat.
choice                 2) Honour… and teamwork!
  orc_general question   Team… work? …Hm. Strong word.
hikari   determined    Sentinels, together, for the beacon!
```

#### `ch4.epi` · after 4-5 · "Bubbles in the Fen"
`academy-day` · `home` · akane, hikari, midori, yuki

* **What happens:** the Pass Beacon burns again. The General kneels and offers his helmet; Hikari asks him to guard the
  pass instead, and the orcs become its very proud gatekeepers. Akane finds **scale #4** in the beacon ashes. Back at
  the academy, Midori arrives with a fizzing flask: the marsh plants have started walking. She wants to study the
  scales, and joins.
* **Emotional beat:** kindness to a defeated foe; Hikari gives the orcs a job and a home instead of a defeat.
* **Hook:** Gloomfen Marsh and the Willow Root.

```text
narrate                The Pass Beacon burns once more. The General kneels and offers his helmet to the Captain.
narrate                She asks him to guard the pass instead. He is still up there now, guarding it very proudly.
akane    joy           Captain, another grey scale in the beacon ashes! It's warm like a firework fuse. I love it.
hikari   neutral       Four stones, four scales. All warm. All leaning north… {name:kage}'s board is getting crowded.
cue                    exit akane, enter midori right (bounce)
midori   joy           Sentinels! Sorry, the flask is fizzing! It does that when it's happy! I'm {name:midori}, alchemy lab!
midori   sparkle       The marsh plants have started walking! Fascinating! And slightly alarming! Mostly fascinating!
yuki     deadpan       Everything she brews is labelled "probably safe." That is the problem.
midori   idea          Ooh, are those scales? May I study them? I'll only dissolve a tiny corner. Probably.
hikari   laugh         You can look, not dissolve! Gloomfen Marsh, then. The Willow Root stone is out there too.
yuki     sleepy        …I'll bring a warmer book.
hikari   determined    Pack your flasks, {name:midori}. Sentinels, we leave at first light.
```

---

### Chapter 5: Gloomfen Marsh (Willow Root)

*Fog thick as soup. Mechanics: siphon and regeneration (poison stops healing), blinking skulkers, brood plants.
Joins: Suzu (5-5). Comedy: the rude frog, Midori's percentages. Heart: Luna's return, and an old tree that is only
cold.*

#### `ch5.pro` · before 5-1 · "Leeches in the Fog"
`stage:5-1` · `lantern` · luna, hikari, umeko, midori

* **What happens:** Luna steps out of the mist ("Lost already, little dawn?"). Hikari, surprised, calls her "Teacher".
  Luna has been following the moon, which "has been leaning north all spring". Midori reports on the scales.
* **Emotional beat:** Hikari is someone's student again for a moment. She is lighter around Luna.
* **Clue:** the scales are "not fish, not lizard, something much older". Luna's riddle: *grey as ash, warm as fresh
  bread, has visited every stone this spring.*
* **Mechanic (1 line):** bog-sleepers drink from their neighbours to heal, and poison stops all healing.
* **Hook:** into the fog.

```text
narrate                Gloomfen Marsh. The fog is thick as soup, and somewhere a frog says something rude.
luna     smile         Lost already, little dawn? You always did wander off the path.
hikari   surprise      Teacher?! I mean, {name:luna}! What are you doing in a swamp?
luna     wink          Following the moon. She's been leaning north all spring, just like your stones.
umeko    smile         Good evening, Oracle. The tide said a fox might be waiting.
luna     laugh         The tide gossips terribly.
midori   neutral       Bog-sleepers ahead! They drink from their neighbours to heal. My poison stops all healing!
midori   idea          Also, Captain, I studied a scale! Not fish. Not lizard. Something much, much older.
luna     smile         A riddle, then. What is grey as ash, warm as fresh bread, and has visited every stone this spring?
hikari   question      …You already know the answer, don't you?
luna     wink          Some answers grow sweeter if you don't pull them up too early. Walk, little dawn. I'll light the path.
hikari   determined    One petal at a time. Sentinels, into the fog!
```

#### `ch5.mid` · before 5-5 · "The Drowned Willow"
`stage:5-5` · `danger` · hotaru, midori, luna, hikari · NPC `plant_treant`

* **What happens:** at the heart of the fen stands a willow older than the academy, half drowned. Its walking roots are
  shivering, not cruel: the Willow Root stone beneath it went cold. Midori promises a warm tonic after the battle.
* **Emotional beat:** Hikari's frustration surfaces: "Everything we've met is cold. Who's taking the warmth?" Luna
  reframes it.
* **Clue (keep verbatim):** "Not who, little dawn. Ask instead: where is the warmth going?" "…North."
* **Mechanic (1 line):** seed pods burst into sprouts and the priests drain the others; bring poison and Priority.
* **Hook:** gently, all together.

```text
narrate                At the heart of the fen stands a willow older than the academy, half drowned in black water.
plant_treant sad       Creeeak… cold… roots… cold…
hotaru   sad           Listen. It isn't angry. It's shivering. Its roots have been cold all spring.
midori   determined    It's sick, not cruel! I can brew a warm tonic for its roots once the fen calms down.
luna     neutral       The Willow Root stone sleeps beneath it. When the stone went cold, the old tree went cold with it.
hikari   sad           Everything we've met is cold. The slimes, the lizards, the orcs… Who's taking the warmth?
luna     smile         Not who, little dawn. Ask instead: where is the warmth going?
hikari   neutral       …North. It's always north.
midori   determined    Seed pods burst into sprouts, and the priests drain the others. Poison and Priority, Sensei!
choice                 1) We'll get you warm, old tree.
  plant_treant question  …Creak?
choice                 2) How sure is "probably," {name:midori}?
  midori laugh           Seventy percent! Eighty, if it's sunny!
hikari   determined    Sentinels, gently, and all together!
```

#### `ch5.epi` · after 5-5 · "Bells and Bolts"
`academy-sunset` · `home` · hikari, midori, luna, suzu

* **What happens:** Midori's tonic seeps into the roots and the willow settles into a long, warm sleep. "First light."
  Midori labels **scale #5** "Probably a clue." Luna and Hikari say the name of the mountain aloud. Then every warning
  bell at the academy rings at once: Suzu has news that goblin engineers have taken the foundry. She joins.
* **Emotional beat:** Luna slows Hikari down: "Don't run there tonight. The road goes through the city first."
* **Clue:** "Five stones. Five scales. Every light leaning toward one mountain." "Ashwing Peaks."
* **Hook:** to the foundry.

```text
narrate                The tonic seeps into the roots. The old willow sighs, and settles into a long, warm sleep.
hikari   determined    Rest well, old friend. First light.
midori   surprise      Scale number five, in the roots! I'm labelling it. "Probably a clue."
luna     neutral       Five stones. Five scales. Every light leaning toward one mountain. You already know where this ends.
hikari   neutral       Ashwing Peaks. The Hearthstone.
luna     smile         Then don't run there tonight. The road goes through the city first. It always does.
cue                    sfx bells, exit luna
narrate                Back at the academy, every warning bell starts ringing at once.
suzu     surprise      Bells! All the bells! Sorry, all of them is the correct number for this!
hikari   surprise      {name:suzu}? What's happening?
suzu     determined    Goblin engineers took the academy foundry! They're carrying the boilers out in a very tidy line!
suzu     smile         I'm {name:suzu}, bell club. A bell for every occasion. This is the "everything is stolen" bell.
midori   sparkle       A foundry full of goblins? Fascinating! Wait, are they taking my flask rack?
hikari   determined    Not on my watch. {name:suzu}, ring us a marching bell. Sentinels, to the foundry!
```

---

### Chapter 6: Clockwork Foundry (Foundry Heart)

*Steam, gears and goblins. Mechanics: crystal shells (many small hits), barriers (blast), sabotage (traps,
cleanse), volatile blasts. Finale: the Goblin Machine. No join. Comedy: the spoon, the scarf. Heart: the
"villains" were just cold, and Chika builds them heaters.*

#### `ch6.pro` · before 6-1 · "Crystal Vats"
`stage:6-1` · `ironclock` · chika, hikari, raika, suzu

* **What happens:** this is Chika's own workshop, and the goblins "borrowed" her tools (her torque wrench is now a
  spoon). Raika volunteers thunder.
* **Clue:** "Burrows froze. The foundry's the warmest building in the city. They're not stealing. They're camping."
  Hikari: "Everyone's running from the cold this spring."
* **Mechanic (2 lines):** crystal shells block the big hits; many small, fast hits crack them.
* **Hook:** get Chika's workshop back.

```text
narrate                The Clockwork Foundry. Steam, gears, and the clatter of many small goblin feet.
chika    pout          That's MY workshop. They borrowed my tools. They are using my torque wrench as a spoon.
hikari   laugh         Sensei, this is {name:chika}, robotics club. She built half the machines in this place.
chika    neutral       Two-thirds. And the crystal vats grow shells on everything. Each shell blocks the big hits.
raika    joy           {name:raika}, weather club! Many small hits? My lightning never strikes just once! Leave it to me!
chika    neutral       Rapid hits crack shells. Fast girls, fast arrows, and lots of them.
suzu     question      But why are the goblins even here? They usually stay in their burrows under the hill.
chika    neutral       Burrows froze. The foundry's the warmest building in the city. They're not stealing. They're camping.
hikari   neutral       Cold again… Everyone's running from the cold this spring.
raika    determined    Then let's warm them up! With lightning! Politely!
hikari   determined    Sentinels, let's get {name:chika}'s workshop back!
```

#### `ch6.mid` · before 6-5 · "The Goblin Machine"
`stage:6-5` · `danger` · chika, akane, hikari, raika · NPC `goblin_machine`, `goblin_chief`

* **What happens:** in the hangar stands something enormous made of boilers, pipes and Chika's spare parts. It is a
  giant walking heater, it honks (its bestiary lore says so), and it is wearing a knitted scarf. The Goblin
  Chieftain rides on top and does the talking. Chika is offended by the welding. Akane admires the boom
  potential; Hikari confiscates the idea in advance.
* **Emotional beat:** pure comedy, with a soft centre (somebody knitted it a scarf).
* **Mechanic (2 lines):** break its barrier twice, then watch for the sappers it launches.
* **Hook:** turn off the world's grumpiest heater.

```text
narrate                In the foundry hangar stands something enormous, built from boilers, pipes and somebody's spare parts.
goblin_machine sparkle HONK.
chika    surprise      Those are MY spare parts. And who welded that seam? Did they weld it with a SPOON?
goblin_chief joy       Machine warm! Machine OURS!
akane    sparkle       Look at all those boilers! Captain, the boom potential is incredible—
hikari   wink          Confiscated in advance, {name:akane}.
akane    pout          You can't confiscate an idea!
raika    surprise      Hold on. It's a heater. They built a giant walking heater!
chika    determined    Its barrier soaks up hits. Break it twice, then watch for the sappers it throws out.
choice                 1) Can you fix it after, {name:chika}?
  chika  determined      Fix it? I'll rebuild it properly. With real welds.
choice                 2) …Is it wearing a scarf?
  raika  laugh           It IS! Somebody knitted that! It has little pompoms!
goblin_chief pout      No touch scarf!
hikari   determined    Sentinels, let's turn off the world's grumpiest heater!
```

#### `ch6.epi` · after 6-5 · "A Flyer for the Festival"
`academy-day` · `matsuri` · hikari, suzu, chika, momo

* **What happens:** the Foundry Heart burns clean ("First light… six stones home"). Suzu finds **scale #6**, the warmest
  yet, in the boiler. Chika, grumbling, promises the goblins proper little heaters for their burrows. They cheer and
  hurry home, dropping a flyer for the Summer Lantern Festival, with "OGRES??" scribbled on the back. Momo: it's oni,
  and the festival is her concert night. Her new song is "The Ballad of the Six Grey Scales".
* **Emotional beat:** kindness instead of blame. The goblins go home warm.
* **Optional narrate (Kage's door note):** "Goblins: CLEARED. They were just cold. Sensei: still pending."
* **Hook:** the festival needs us.

```text
narrate                The Foundry Heart burns clean and bright. The goblins sit in a row, looking very sorry.
hikari   smile         First light. …There. Six stones home.
suzu     surprise      Scale number six, in the big boiler! And this one's even warmer!
chika    pout          Fine. FINE. I'll build them proper little heaters for their burrows. Real welds. No spoons.
narrate                The goblins cheer, bow, and hurry home. One of them drops a bright paper flyer.
suzu     question      "Summer Lantern Festival, tonight!" …And somebody wrote "OGRES??" on the back.
cue                    exit suzu, enter momo right (hop)
momo     joy           Not ogres, oni! I'm {name:momo}, idol club, and tonight is MY concert! Sensei, Captain, you have to come!
momo     sparkle       I wrote a new song about our adventure! "The Ballad of the Six Grey Scales"!
chika    deadpan       That's not a ballad. That's a list.
momo     wink          A list with a beat! Ready? One, two—
hikari   laugh         Save it for the stage, {name:momo}! Sentinels, the festival needs us!
```

---

### Chapter 7: Oni Festival (Festival Drum)

*Early summer: lanterns, food stalls and the great taiko. Mechanics: field casters (haste, shield, regen; holy hits
silence them) and illusionist decoys (rapid hitters clear them). Finale: the Oni Champion. No join. Comedy: festival
rules, an oni who loves the festival. Heart: Hikari's confession under the fireworks.*

#### `ch7.pro` · before 7-1 · "Festival Wind"
`stage:7-1` · `matsuri` · miko, momo, kaede, hikari

* **What happens:** the Summer Lantern Festival has uninvited guests. Miko announces the festival rules (no fireworks
  before nine, "that means you, {name:akane}"), and somewhere a sparkler goes out very quickly. Momo rehearses. Kaede
  wants to challenge the oni's strongest, then remembers "together".
* **Clue:** the oni came down from the peaks because "the mountain is smoking". "Is that normal?" "…No."
* **Mechanic (1 line):** wind oni fan their friends faster, and a holy hit hushes the magic; Priority on the casters.
* **Optional `ifUnit: 'yoriko'` (off):** "My puppets saw something huge fly north, weeks ago."
* **Hook:** save the festival, and the concert.

```text
narrate                Lanterns, food stalls and drums. The Summer Lantern Festival… and its uninvited guests.
miko     neutral       Festival rules. No running. No shouting. No fireworks before nine o'clock. That means you, {name:akane}.
narrate                Somewhere in the crowd, a sparkler goes out very quickly.
momo     joy           La la la… sorry, rehearsing! The stage is right by the great drum. If the oni let me use it!
kaede    determined    Oni with fans, oni with shields… Sensei, let me challenge their strongest. One on one!
hikari   smile         Together, remember? You said it was acceptable.
kaede    pout          …I did say that.
miko     determined    The Wind Oni fan their friends faster. A holy hit hushes their magic. Priority on the casters.
hikari   neutral       The great drum holds the seventh wardstone. It hasn't sounded all week.
momo     question      The oni say they came down because the mountain is smoking. Is that normal?
hikari   neutral       …No. It isn't.
hikari   determined    Sentinels, let's save the festival, and {name:momo}'s concert!
```

#### `ch7.mid` · before 7-5 · "Champion of the Festival"
`stage:7-5` · `danger` · akane, kaede, hikari, momo · NPC `oni_champion` · `ifUnit: 'kanna'` (off)

* **What happens:** beside the great drum, the Oni Champion lifts the festival trophy: "VERY GOOD FESTIVAL! TEN OUT
  OF TEN!" Kaede answers the challenge, but this time for the team.
* **Emotional beat:** Kaede's growth: "Today I fence for all of us." Hikari's pride in her.
* **Kanna cameo:** `say('kanna', …, { at: 'off', ifUnit: 'kanna' })`, so it costs no portrait.
* **Mechanic (1 line):** he changes stance as he tires (haste, shield, healing, then all three).
* **Hook:** win this festival.

```text
narrate                In the festival arena, beside the great drum, the Oni Champion lifts the festival trophy high.
oni_champion joy       TROPHY MINE! DRUM MINE! ALSO, VERY GOOD FESTIVAL! TEN OUT OF TEN!
akane    sparkle       He gets it! Captain, he GETS it!
kaede    determined    Sensei. Let me answer this challenge. Not alone. Today I fence for all of us.
hikari   smile         …Look at you, {name:kaede}. Then we'll be right beside you.
kanna    determined    That trophy belongs to the drum master. I'll be wanting it back. And a rematch.  (at off, ifUnit kanna)
hikari   determined    He switches stance as he tires: haste, shield, then healing. At the end, all three. Stay sharp!
momo     determined    And I'll sing so loud he forgets which stance he's in! That's a real strategy!
choice                 1) For the festival!
  momo   joy             For the festival!
choice                 2) For the snacks!
  akane  laugh           For the snacks! …And the festival! Mostly the snacks!
oni_champion determined FIGHT! THEN DANCE!
hikari   joy           Sentinels, let's win this festival!
```

#### `ch7.epi` · after 7-5 · "Embers on the Peak"
`academy-night` · `wish` · momo, hikari, luna, nami

* **What happens:** the great drum sounds again and the sky fills with fireworks, from the Confiscation Box (payoff).
  Momo relays the Champion's message: the oni left the mountains because the **Ashwing Matriarch woke too early, in
  the cold**, and the peaks are smoking. Momo leaves for her encore. Under the fireworks, the three guardians talk.
* **Emotional beat (the story's heart):** Hikari confesses that the stones began to dim the week she got the Dawnblade,
  and she thought it was her fault. Nami: "Stones don't go dark because a girl got a sword." Luna: "You were never the
  shadow." Sensei answers too (the choice). Hikari laughs through it and stands up.
* **Clue:** scale #7 (mention only; the Matriarch line carries the reveal).
* **Hook:** "Ashwing Peaks, tomorrow. Together."

```text
narrate                The great drum sounds again. A moment later, the night sky bursts into colour.
momo     surprise      Fireworks?! Where did those come from?
hikari   wink          A certain box of confiscated rockets. I told {name:akane} she'd get them back someday.
momo     neutral       The Champion asked me to tell you something. The oni left the mountains because the Ashwing Matriarch woke.
momo     sad           He said she woke too early, in the cold. And now the peaks are smoking.
hikari   smile         …Thank you, {name:momo}. Go on, your encore's waiting.
cue                    exit momo, enter luna left, enter nami right
luna     neutral       Seven stones. Seven scales. A dragon who woke in the cold. The riddle is nearly answered, little dawn.
hikari   sad           Can I tell you both something? The stones started dimming the week I got the Dawnblade.
hikari   sad           I kept thinking… maybe the ward knew I wasn't ready. Maybe it was my fault.
nami     neutral       Sunshine. Stones don't go dark because a girl got a sword. That's not how stones work. Or swords.
luna     smile         And the moon doesn't wane because someone looked up at her. You were never the shadow, {name:hikari}.
choice                 1) You were ready. You still are.
  hikari smile           …Thank you, Sensei. I think I needed to hear that from you.
choice                 2) We'll climb it together, Captain.
  hikari joy             Together. One petal at a time.
nami     smile         We'll be right there with you. We always were. You were too busy watching sunrises to notice.
hikari   determined    Ashwing Peaks, tomorrow. All of us. Together.
```

---

### Chapter 8: Ashwing Peaks (Hearthstone)

*Early summer on smoking peaks. Mechanics: airborne enemies need anti-air; fire-warded dragons shrug off burns.
Finale: the Ashwing Matriarch. Comedy: the whole academy shows up with buns. Heart: everything.*

#### `ch8.pro` · before 8-1 · "Wings over the Ascent"
`stage:8-1` · `march` · nami, shiro, luna, hikari · `ifUnit` cameos: `seiran`, `hana`, `noa` (off)

* **What happens:** base camp at the foot of the peaks, and half the academy has come to help (the tea club brought
  tea, the bakery sent buns, Chika's drones carry everything else). Kage's note on the supply tent: everyone cleared
  except Sensei. Shiro briefs. Hikari and Shiro trace each stone's leaning light on the map, and the lines meet at the
  summit.
* **Emotional beat:** Hikari states the goal as a promise: "Nobody gets hurt. Not us, and not her." Luna: "That's my
  student."
* **Mechanic (2 lines):** wyverns fly over ground-only girls, so bring anti-air; ashdrakes shrug off fire, so use
  pierce, frost and mystic.
* **Hook:** up the mountain.

```text
narrate                Base camp, at the foot of Ashwing Peaks. Half the academy has come to help.
narrate                The tea club brought tea. The bakery sent buns. {name:chika}'s drones are carrying everything else.
narrate                A note is pinned to the supply tent: "SUSPECTS: slimes to oni, all CLEARED. Sensei: PENDING."
nami     deadpan       She's very thorough. I'll give her that.
shiro    neutral       Briefing. Wyverns fly. Ground-only girls cannot reach them. Bring anti-air.
shiro    neutral       Ashdrakes bathe in lava. Fire won't hurt them. Pierce, frost and mystic will.
luna     smile         Show them the map, little dawn.
hikari   neutral       Seven stones. We draw a line from each, the way its light leaned… and every line meets at the summit.
hikari   determined    The Hearthstone. That's where she's waiting.
nami     neutral       And when we get there, Captain? What's the plan?
hikari   determined    We reach the Hearthstone. We calm her down. Nobody gets hurt. Not us, and not her.
luna     wink          That's my student.
choice                 1) One petal at a time!
  hikari smile           One petal at a time, Sensei. All the way up.
choice                 2) Did anyone bring extra buns?
  nami   deadpan         {name:kage} did. She's eaten four.
hikari   determined    Sentinels, up the mountain!
```

#### `ch8.mid` · before 8-5 · "The Ashwing Matriarch"
`stage:8-5` · `danger` · aoi, luna, hikari, nami · NPC `dragon_ashwing`

* **What happens:** at the summit three trails meet at a nest of warm stone holding a clutch of eggs that glow like
  embers. Beneath it the Hearthstone burns red-gold, drinking warmth from every stone in the ring. **The reveal:** a
  mother woke too early in a cold spring with eggs to keep warm, and the heart did what the founders built it to do.
  She rampages because she thinks the Sentinels have come to take the stone.
* **Emotional beat:** Hikari: "We protect what we love. So does she." Aoi aims "only to slow her wings". Hikari
  completes her arc: "Stay behind me— no. Stand with me."
* **Mechanic (1 line):** she takes flight as she tires, lands in armour, then flies once more; keep anti-air ready.
* **Hook:** for the ward, and for her little ones.

```text
narrate                At the summit, three trails meet at a nest of warm stone. In it, a clutch of eggs glows like embers.
narrate                Beneath the nest, the Hearthstone burns red-gold, drinking warmth from every stone in the ring.
dragon_ashwing determined RRRAAAH! MINE! WARM! LITTLE ONES!
aoi      surprise      She's huge! Captain, she's sitting right on the Hearthstone!
luna     neutral       "The heart keeps what it loves warm." The founders weren't writing a poem. They were writing instructions.
hikari   sad           She woke too early, in a cold spring, with eggs to keep warm. So the heart pulled warmth from every stone.
nami     neutral       Nobody was stealing anything. A mother was keeping her children warm.
dragon_ashwing pout    GO AWAY! NOT YOURS!
hikari   determined    We protect what we love. So does she. We're not here to hurt her. We're here to calm her down.
aoi      determined    Then I'll only aim to slow her wings. Just enough to help her land.
hikari   determined    She takes flight as she tires, lands in armour, then flies once more. Keep your anti-air ready!
choice                 1) Then we'll keep them warm too.
  hikari smile           We will. That's a promise, Sensei.
choice                 2) Everyone, gently!
  nami   laugh           Gently. With cannons. The Sentinel way.
hikari   determined    Stay behind me— no. Stand with me. Sentinels, for the ward, and for her little ones!
```

#### `ch8.epi` · after 8-5 · "Petals Again"
`stage:8-5` → `academy-day` → `cg:hikari-rampart` · `wish` → `home` → `title` · hikari, aoi, rei, yuki

* **What happens (summit):** the Matriarch lands, tired and quiet. Hikari: "First light. For the ward, and for you."
  All eight stones shine at once around the ring and the eggs hatch. **Payoff:** Aoi realises that every stone they
  relit sent warmth up here, so they've been keeping her eggs warm since the fountain. The Matriarch leaves **scale #8**
  at the Captain's feet and flies her family to a quieter peak.
* **What happens (home):** the academy's cherry trees bloom a second time, which nobody has seen in a hundred years.
  The festival under the petals: Rei closes the Flower Ledger, and Yuki reports on Wobble.
* **What happens (the Wall, sunrise):** the bookend of the opening. Hikari calls "Sensei! Up here, on the wall!" again.
  She reveals that she wrote the request for a Sensei herself, on the night the first stone dimmed. Kage's final note
  floats down. Hikari closes the journal: "Chapter one of many."
* **Emotional beat:** the guardian who learned she didn't have to do it alone.

```text
narrate                The Matriarch lands, tired and quiet, and curls round her nest.
hikari   smile         Shh. It's all right. We only came to help. …First light. For the ward, and for you.
cue                    flash gold, music wish
narrate                The Hearthstone blazes. Light runs round the ring, through all seven petals and back to the heart.
narrate                One by one, the eggs crack open. Tiny dragons blink at the dawn.
aoi      sparkle       Captain… every stone we relit sent its light up here. We've been keeping her eggs warm since the fountain!
hikari   joy           We have, haven't we? …Hehe. And all this time I thought we were fighting her.
narrate                The Matriarch bows her great head, leaves one last grey scale at the Captain's feet, and flies her family home.
cue                    bg academy-day, petals, music home, exit all, enter rei left, enter yuki right
narrate                Back home, the academy's cherry trees bloom a second time. Nobody has seen that in a hundred years.
rei      smile         Final ledger. Flowers lost this spring: two tulips. Flowers planted: two hundred. I am satisfied.
yuki     sleepy        Wobble came to the festival. It ate a lantern. …A small one.
cue                    bg cg:hikari-rampart, music title
hikari   smile         Sensei! Up here, on the wall! …Hehe. Some things never change.
hikari   neutral       Can I tell you a secret? The academy didn't ask for a Sensei. I did. The night the first stone dimmed.
hikari   smile         I couldn't protect everyone alone. So I asked for someone who could read the field. And you came.
choice                 1) I'm glad you asked.
  hikari joy             So am I. Every single day.
choice                 2) Same time next spring?
  hikari laugh           Every spring, Sensei. The dawn is never late.
narrate                A note flutters down from the wall: "SUSPECT BOARD, FINAL. Sensei: CLEARED. (Still suspicious about snacks.)"
hikari   wink          Eight stones, eight scales, one very full journal. …And this is only chapter one of many, Sensei.
```

---

### 7.9 Optional lesson mini-scenes (Builder 3; `trigger: { lesson: id }`, behind "Hikari explains")

Same limits as episodes (8–18 lines). They are short, cosy and in-world; the journal text already teaches the
mechanics, so these add character.

* **`lesson.home`, "Welcome Home"** (`academy-soft`, hikari, aoi): Hikari shows Sensei around the home screen.
  Aoi asks to be the one who greets Sensei in the mornings ("I'll practise my wave!"). Hikari shows her journal
  doodle of Sensei as a star in a hat. Hook: "The Login gift grows every day you visit, even if you miss one."
* **`lesson.recruit`, "Ten New Possibilities"** (`academy-day`, hikari, kage, momo): Hikari hands over the
  10× ticket ("on us ♡"). Momo wants a drumroll. Kage insists she doesn't need recruiting because "I was always here.
  Mostly." Hook: "Duplicates become Star Fragments. Nothing goes to waste here."
* **`lesson.gear`, "Dress for the Adventure"** (`academy-day`, hikari, chika, midori): Chika explains enhancing and
  makes a joke about spoons; Midori wants to reroll everything "for science"; Hikari: "Always read the cost before
  you roll!" Hook: the lock pin keeps your favourite substat safe. (Lesson `gear` unlocks at 2-1, before the
  player meets Chika in ch6, so Hikari introduces her here: "{name:chika} from the robotics club. She'll explain.")

### 7.10 After chapter 8: seeds for later content (not built in this branch)

"Chapter one of many" is a promise; these threads are left open on purpose, so events and side stories can pick
them up without contradicting anything.

* **The hatchlings.** Three tiny dragons now live on a quieter peak. One of them has a habit of following warm
  things (lanterns, bakery ovens, Akane). A good light event: "The Little One Who Followed the Buns".
* **The founders.** The record in ch3 hints that the founders left other "instructions" in poems around the city.
  The City hub port (`docs/merge/world.md` §0.2) can hide one per district.
* **The new girls.** The eleven later girls (§5.6) arrive through side stories once the roster lands. Their `ifUnit`
  cameos in ch4, ch7 and ch8 already place them in the world, so their own stories can start from those lines.
* **The summer coast.** The old game's ten-episode beach story ports as a seasonal event with non-swimwear outfits
  (task #66). Nami, Sango and Umeko lead it; Hikari brings "a detailed schedule for relaxing".
* **Kage's next board.** "SUSPECT BOARD, SEASON TWO" can open any mystery event; Sensei is always on it.

---

## 8. Opening and tutorial script (final)

These replace spec §2.2–2.4 for text. The format is the spec's (`format.js`); Builder 1 ships them as written.

### 8.1 `opening`: "Meet Hikari"

Fifteen spoken lines (limit 20), one choice, three portraits, one ♡. Compared with the spec draft: `{name:hikari}` in
the choice reply (the bare name would fail T-content-3), the wardstone line (seeds the mystery), and the last line.

```js
scene('opening', { title: 'Meet Hikari', chapter: 0, kind: 'opening', trigger: { opening: true }, bg: 'black', music: 'title' }, [
  cue({ bg: 'academy-day', fade: 'in', petals: true }),
  narrate('Spring. Above Moonpetal City, the cherry trees of Sakura Academy are in full bloom.'),
  narrate('Here, students with halos train as Sentinels — the cheerful guardians of the academy and the city below.'),
  say('hikari', 'Sensei! Up here — on the wall!', { at: 'off', name: '???' }),
  cue({ bg: 'cg:hikari-rampart', flash: 'gold' }),
  say('hikari', 'Hehe, sorry! I always watch the sunrise from up here. It\'s the best seat in the academy.', { face: 'laugh' }),
  say('hikari', 'I\'m {name:hikari}, Captain of the Sentinel Guard. Welcome to Sakura Academy!', { face: 'smile' }),
  choice([
    { text: 'Nice to meet you, Captain!', lines: [say('hikari', 'Just {name:hikari} is fine. We\'re partners from today, after all.', { face: 'wink' })] },
    { text: 'Do you greet everyone from a wall?', lines: [say('hikari', 'Only the important ones! …And the bakery delivery girl. She was very impressed.', { face: 'sweat' })] },
  ]),
  cue({ bg: 'academy-day', music: 'home', enter: [{ who: 'hikari', at: 'center' }] }),
  say('hikari', 'The academy asked for a Sensei who can read a battlefield. That\'s you — I\'ve been looking forward to this.', { face: 'smile' }),
  say('hikari', 'Around the city stand eight old wardstones that keep the wilds calm. This spring, they\'ve started to dim.', { face: 'neutral' }),
  say('hikari', 'So monsters keep wandering out. Slimes, goblins… and a few things that are much bigger.', { face: 'sweat' }),
  say('hikari', 'The Sentinels protect the city. My job is to protect them while they do it. The dawn is never late!', { face: 'determined', fx: 'nod' }),
  say('aoi', 'Captain! The slimes are in the flowerbeds again! They\'re eating the tulips!', { at: 'left', face: 'surprise', fx: 'slide-in' }),
  say('hikari', 'Sensei, this is {name:aoi} — the steadiest bow in the academy.', { face: 'smile' }),
  say('aoi', 'A-a real Sensei? Oh! Hello! I\'ll do my very best!', { face: 'sparkle', fx: 'hop' }),
  say('rei', 'The tulips are lost. The rosebushes can still be saved.', { at: 'right', face: 'deadpan', fx: 'slide-in' }),
  say('hikari', 'And that\'s {name:rei}. She takes gardening very seriously.', { face: 'laugh' }),
  say('rei', 'I take everything seriously. Sensei — your orders?', { face: 'determined' }),
  say('hikari', 'Perfect timing for a first lesson. Come on, Sensei — let\'s protect this place together ♡', { face: 'wink', fx: 'hop' }),
  cue({ music: 'march', fade: 'out' }),
]),
```

Note for later: "The academy asked for a Sensei" is a gentle fib that pays off in ch8.epi ("The academy didn't ask
for a Sensei. I did."). Do not change it.

### 8.2 Tutorial coach (battle 1-1 Easy; `coachSteps.js` bubble copy)

Bubble: title in bold plus up to two short sentences, at most 120 characters of body. Tokens resolve from data. The
whole coach uses one ♡ (step 3, adapted from the old game's line).

| # | Step | Title | Body |
|---|---|---|---|
| 1 | `place` | **Meet your first defender!** | Drag {name:aoi}'s card onto the grass beside the path and let go. She'll stand right where you drop her. |
| 2 | `start` | **Ready, Sensei?** | Tap Start wave. Slimes that reach the gate cost hearts, so let's not lose a single one! |
| 3 | `hero` | **A little light, just for you ♡** | Now drag my card onto the field. I'm your hero, and I grow stronger with every wave! |
| 4 | `upgrade` | **A tiny upgrade, a big difference!** | Tap {name:aoi}, then buy her first upgrade. Battle coins only last for this battle, so spend them! |
| 5 | `speed` | **Let's pick up the pace!** | Tap the speed button for 2×, and again for 3×. Don't worry, I can keep up! |
| 6 | `ult` | **Let's make it bloom!** | {ult:hikari} is ready! Tap it when a crowd of slimes bunches up. |
| 7 | `free` | **One petal at a time.** | You've got this, Sensei. Keep the path covered until the last wave. I'm right here! |
| — | `lost` | **That's okay. Even the dawn needs a second try.** | [Retry with {name:hikari}] [Skip tutorial] |

Other coach and tutorial copy:

| Where | Text |
|---|---|
| Minimised pill | "{name:hikari}'s tips" |
| Skip tutorial confirm | "Skip the tutorial? {name:hikari}'s lessons stay in the Captain's Journal." [Skip] [Keep going] |
| Bubble after the outro, pointing at **Home** | "Let's go home, Sensei. I'll show you around!" |
| 1-1 stage prep prompt (tutorial unfinished) | "Shall we finish our first lesson together?" [Start with {name:hikari}] [Not now] |
| Opening skip confirm, extra line (spec §1.3) | "{name:hikari} will still show you the ropes in your first battle." |

### 8.3 `tut.outro`: "First Petals"

Ten spoken lines. The spec draft had five, below the 8-line minimum in T-content-3. This version seeds the fountain and
starts Rei's Flower Ledger.

```js
scene('tut.outro', { title: 'First Petals', chapter: 0, kind: 'outro', trigger: { tutorial: 'won' }, bg: 'academy-sunset', music: 'victory' }, [
  say('hikari', 'Wonderful work, Sensei! The flowerbeds are safe… mostly.', { at: 'center', face: 'joy', fx: 'hop' }),
  say('aoi', 'I upgraded my arrows! Well — Sensei told me when. I did the shooting, though!', { at: 'left', face: 'sparkle' }),
  say('rei', 'Two tulips lost. Acceptable.', { at: 'right', face: 'deadpan' }),
  say('hikari', '{name:rei} keeps a ledger of every flower we lose. Let\'s keep it a very short book.', { face: 'laugh' }),
  say('rei', 'Page one. Two tulips. They will not be forgotten.', { face: 'sad' }),
  cue({ music: 'home' }),
  say('hikari', 'I\'ll write down everything we learn in my Captain\'s Journal. You can read it any time from the Menu.', { face: 'smile' }),
  say('aoi', 'A real Captain\'s Journal? Can I read it too?', { face: 'question' }),
  say('hikari', 'Only after your archery homework! …Hm. The fountain\'s glow is low again, down in the Blossom Court.', { face: 'neutral' }),
  say('hikari', 'Never mind — one petal at a time. Let\'s head home. And Sensei? Welcome to the Sentinels.', { face: 'wink' }),
]),
```

Spoken lines: hikari ×5, aoi ×2, rei ×2 = 9, plus the cue. If the counter needs 10, split Hikari's eighth line at
"…Hm." into two lines (both stay under 120 characters).

---

## 9. Writing rules and the critic's checklist

### 9.1 Hard rules (from CONTRACTS §0 and spec §4.5; the lint enforces some of them)

* **Wholesome, always.** The academy girls are students: classes, clubs, homework. No romance, flirting, "outings for
  two", crushes or confessions of feelings. No comments on bodies. No fanservice framing in staging or narration.
* **Adults are guardians.** Hikari, Luna and Nami (later Kanna, Yoriko and Seiran) mentor and protect. Nobody is ever
  written romantically, including toward Sensei. No ages, for anyone.
* **Banned words** in all scene and lesson text (whole words, case-insensitive): date, dating, kiss, crush, flirt,
  romance, romantic, sexy, bikini, swimsuit, lingerie, boyfriend, girlfriend, marry, wife, husband, blush, breast,
  thigh, waifu. Rephrase ("outing", "festival together"). Avoid near-misses too: "crushing" and "update" are fine to
  the lint but read badly in review, so prefer "flatten" and "revised".
* **Original writing only.** No quotes or paraphrases of other works and no third-party characters. Old Codex text is
  first-party and may be adapted.
* **Tokens:** every roster name in text is `{name:id}`, including in choice text and narration. `{ult:hikari}`,
  `{stage:1-5}` and `{chapter:3}` exist too.
* **No violence words for monsters:** they "poof", "pop", "scurry home" or "go home". Never "kill", "die", "dead" or
  "blood". Ghouls are "bog-sleepers" in dialogue.
* **No looks in dialogue:** no hair colours, outfits or heights, because the art is changing.

### 9.2 Shape (spec §1.2.6)

* ≤ 120 characters per line; 8–18 spoken lines per episode (opening ≤ 20); ≤ 1 choice; ≤ 4 portraits (≤ 3 on stage);
  `heart` face ≤ 1 per episode (prefer none); Hikari's ♡ ≤ 1 per scene.
* Open with `narrate` or Hikari. End forward: a rally, a hook or a promise.
* Hikari speaks in every episode.
* Each prologue teaches its chapter's mechanic in **at most 2 in-character lines**, and never 3 in a row.
* Monster lines: ≤ 6 words, often ALL CAPS for big ones, funny, never cruel or threatening.
* Choices: 2 options (3 rarely), ≤ 44 characters. The first is earnest, the second playful; both are kind. Replies
  are 1–2 lines. No effects.

### 9.3 The critic's checklist (run it per chapter)

1. Does the chapter's **clue** from §3.1 land, in the right episode, without giving away more?
2. Does the chapter have **one laugh** and **one quiet moment**?
3. Does every girl sound like her §5 entry? Read her lines with the name covered: could you tell who it is?
4. Is Hikari warm, specific with praise, calm in danger, and kind to monsters? Is her worry kept private until ch7?
5. Does the boss go home **better off** (a job, a heater, a rest, a home, warmth)?
6. Did the running jokes advance without crowding the scene (two at most per episode)?
7. Lint basics: tokens, ≤ 120 characters, faces from the closed list, banned words, portrait count.
8. Read it aloud at 844×390: does any line wrap past 3 lines? Then cut it.

---

## 10. Changes against STORY_SPEC.md

| Spec | Change | Why |
|---|---|---|
| §2.2 opening | `Just Hikari is fine` → `Just {name:hikari} is fine`; added the wardstone line; reworded the last line | a bare roster name fails T-content-3; seeds the mystery |
| §2.3 coach | step 7 title is "One petal at a time." (the second ♡ removed); new strings for the pill, skip confirm, Home pointer and 1-1 prompt | one ♡ per scene for Hikari |
| §2.4 `tut.outro` | grown from 5 to 9–10 spoken lines | the spec's own minimum is 8 |
| §1.2 example / §4.4 `ch1.mid` | choice "on Hikari's signal" → "on the Captain's signal" | a bare name in choice text |
| §4.2 premise | named the clue object (warm grey scales), the relighting words ("First light."), the petal lines, the truth (a mother warming her eggs), and Hikari's private worry plus the Sensei-request reveal | the overarching mystery, paid off at the final boss |
| §4.3 voice sheet | expanded into §5 with samples; adds Kage's suspect board, Rei's Flower Ledger, Nami's letters, Suzu's bells, Midori's percentages | voice consistency across three builders |
| §4.4 `ch7.mid` | the Kanna cameo uses `at: 'off'` | keeps ≤ 4 portraits when Kanna exists |
| §4.4 `ch7.epi` | Momo exits before the guardians talk; Sensei's one choice sits in the confession | adults' moment, Sensei's voice where it matters |
| §4.4 `ch8.pro` | music `march` instead of `matsuri` | base camp "let's go" (optional) |
| §4.4 `ch8.epi` | backgrounds `stage:8-5` → `academy-day` → `cg:hikari-rampart`; music `wish` → `home` → `title` | the hatching happens on the summit; the Wall bookends the opening |
| §4.4 `ch6.mid` | the Goblin Machine is a giant walking heater; `goblin_machine` honks once and the Chieftain (`goblin_chief`) talks | ties the boss to the cold-spring mystery; both ids exist |
| §4.4 `ch1.yuki` | Yuki froze a *birdbath*, not the fountain | the fountain holds the first wardstone and the Slime Prince sits on it in `ch1.mid` |
| §4.4 first appearances | Akane, Kaede, Raika, Miko and Momo say their club (or post) the first time they speak | Sensei meets every girl properly (§5) |
| NPCs | Wobble speaks as `slime_droplet` with `name: 'Wobble'` | the id exists in `ENEMY_MAP` |
| §3.3 / §3.5 UI strings | write Hikari's name as `{name:hikari}` in `featureLockText`, the journal toast and the legacy announce toast (e.g. "Equipment unlocks after {stage:2-1} — {name:hikari} will teach you!") | same rename safety as scenes; the strings resolve through the same token helper |

### 10.1 Script pass (the shipped data in `src/data/story/`)

The scripts above are now data. Where the shipped text differs from the drafts in §7–§8, the data wins:

| Where | Change | Why |
|---|---|---|
| all scenes | ≤ 110 characters per line (raw and resolved), emotes on at most half the spoken lines; a `fx` motion without a `face` where only movement is wanted | phone readability; emotes stay meaningful |
| `ch2.epi`, `ch4.epi`, `ch7.epi` | Hikari now says "First light." on screen in every epilogue; `ch4.epi`, `ch5.epi`, `ch6.epi` and `ch7.epi` open on the boss stage still and cut to the academy | the relighting beat lands in all eight chapters; more background variety |
| `ch1.yuki` | opens on `cg:aoi-archery` (Aoi sees the goblins slide), then the library steps | uses the third CG |
| `ch3.pro`, `ch3.umeko` | Kage speaks from off-stage (in the fog, in the rafters) | keeps three portraits on stage |
| `ch6.pro` | Chika's crystal lines merged into one mechanic line before Raika's joke | ≤ 2 mechanic lines |
| `ch6.epi` | Kage's door note moved to the foundry, before the flyer | the scene cuts to the academy afterwards |
| `ch6.noa` (after 6-2), `ch7.hana` (after 7-5) | two scene-level `ifUnit` joins for the roster's new free girls (ROSTER_SPEC §5.2) | every free girl joins in the text; hidden until feature/roster lands |
| cameos | Yoriko (`ch7.pro`), Kanna (`ch7.mid`) and Seiran (`ch8.pro`), one off-stage `ifUnit` line each | voices from ROSTER_SPEC §5.2 |
| lesson scenes | `lesson.home`, `lesson.recruit`, `lesson.gear` written (§7.9); every girl introduces herself because lessons can unlock before her chapter | |
| journal | lesson texts, toasts, lock texts and the welcome mail live in `lessons.js`; coach copy in `tutorial.js`; story sounds map to the audio branch's sprite ids in `music.js` (`STORY_SFX`) | one source of words for builders |

Checks: `tests/story/content.test.js` (speakers, backgrounds, music, sounds, portraits, tokens, bare names, banned words,
the mystery rule, clue lines, line counts, blocking, emotes), `tests/story/format.test.js` and
`tests/story/journal-data.test.js`.

### 10.2 Editor pass

A script edit over every scene in `src/data/story/scenes/` against this bible. The data still wins over the drafts in
§7–§8; the voice-sheet samples in §5 and the drafts that echoed other works were updated so nobody reuses them.

| Kind | Where | Change |
|---|---|---|
| sounded like another work | `ch3.mid`, `ch6.pro` | the armour's "None. Shall. Pass." is now "…Halt. Who comes… to the bell?" (it is lonely, not a gatekeeper); Raika's "thunder with extra steps" is now "My lightning never strikes just once!" (a thunder pun, as her sheet asks) |
| continuity | `ch2.epi`, `ch3.epi` | Hikari relights the Moon-Pier Lantern and the Shrine Bell on their stage stills, not on the academy painting; the scene cuts to Academy Hill for Kage's tree and the next evening for Shiro (her mirror flashes in the moonlight) |
| continuity | `ch5.epi`, `ch8.epi`, `ch8.pro` | goblins march *into* the foundry with blankets (they camp there in ch6, they don't carry boilers out); Rei's final ledger counts the heather (ch4) and the roses (ch1, "returned, slightly sticky"); Seiran's "too warm for spring" no longer fights the summer festival |
| continuity | `lesson.recruit`, `lesson.home` | the ticket arrives in the Mail (the journal mails it); the Login gift line matches the journal ("missing a day never resets it") |
| setups and payoffs | `ch6.mid`, `ch1.mid`, `ch4.mid`, `lesson.gear` | the scarf is seen before the Chieftain says "No touch scarf!" (it no longer depends on the choice), and the choice asks who knitted it ("Me. Took all winter."); Hikari no longer pre-empts Yuki's "Cold jelly. Slow jelly."; Kaede's choice no longer asks her to bow *back*; Chika mentions dice before Midori asks "Did someone say reroll?" (and gets a "No.") |
| jokes | `opening`, `ch1.yuki`, `ch2.pro`, `ch7.mid`, `ch8.epi` | "Best seat on the wall. Well, the only seat." (was "in the academy"); Aoi actually rushes before Yuki says "don't rush"; the lamppost is named; Kaede stays on stage for her duel and answers "For the snacks" with "…Hm. Acceptable."; the last choice calls back the wall ("It's a very long wall") instead of "Same time next spring?" |
| voice | `ch8.pro`, `ch5.pro`, `ch4.mid`, `ch7.mid`, `ch7.pro`, `ch6.noa` | Nami calls Hikari "Sunshine"; the Orc General's lines trimmed toward the six-word monster rule ("Send your STRONGEST! One fight! HONOUR!"); "little dawn" thinned to two per scene; Kanna owns her trophy in first person; Yoriko's puppets "talk of nothing else" (not "whisper"); Noa's join reply says she is coming |
| repetition | several | "sprinting" ×2 in `ch1.yuki`, "silent… gone quiet" in `ch3.pro`, "sits… sit" in `ch6.epi`, the Hearthstone twice in two lines in `ch8.pro`, "warm" ×3 in the `ch8.mid` narration, Hikari's high-place lines; bare "First light." in ch4 and ch7 now has a few words of greeting to the stone |
| clarity | `ch1.epi`, `ch3.umeko`, `ch4.pro`, `ch4.epi`, `ch5.mid`, `ch7.hana`, `ch7.epi`, `ch8.mid`, `ch8.epi` | the harbour cut is placed ("That evening…"); "Hear that?" for the clanking hook; orcs are "leaving the mountains" (not "leaving something"); the Confiscation Box is named when it is born; "we leave at sunrise" (keeps "First light" for relighting); "bog priests" for Grave Priests; Aoi's falcon line no longer promises a message; Sensei's ch7 choice names the mountain; the summit's "three trails" became every trail; the final note floats down "from above"; the closing call matches the opening ("Up here — on the wall!") |
| warmth | `ch3.mid`, `ch3.epi`, `ch4.mid`, `ch6.epi`, `ch8.pro` | "Then we'll keep the watch with it" / "We'll keep the watch from now on"; Hikari tells the goblins "Nobody sleeps cold this spring"; Shiro and Midori are told they're coming ("lead the way", "You're with us") |
