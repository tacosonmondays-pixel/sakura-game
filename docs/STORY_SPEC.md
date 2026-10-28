# Story + progression spec: Meet Hikari, tutorial, Captain's Journal, chapter scenes

Branch `feature/story` (from the live main, `05adb2a`). Area name **story**. The owner's current
priority is content over models, so this spec covers the story and progression content that the old Codex game had
and the new game lacks (`docs/merge/world.md` §0.2 and §5.4, `docs/merge/requests.md` T-01..T-03, G-08,
K-02, L-02). That content is the "Meet Hikari" opening, a guided first battle, the Captain's Journal (12 lessons
with feature unlocks and a free welcome 10-pull at 3 clears), and short story scenes for all 8 campaign chapters.
It is read by three sequential builders (§7) and by the writers (§4).

Hikari is the thread through all of it. She greets the player in the opening, coaches the first battle, writes
the journal, opens and closes every chapter, and her toast announces each new lesson. Her 3D battle chibi
is being finished on its own branch; story scenes use only her drawn art (`public/art/portraits/hikari-*`).

---

## 0. Decisions at a glance

| # | Decision |
|---|---|
| D1 | **The player is "Sensei"**, the academy's new tactics advisor. The game already uses that word about 20 times (lobby, mail, notice). **Hikari is the Captain**: Captain of the Sentinel Guard, a young-adult guardian. The **Captain's Journal** is *her* journal of lessons for Sensei, which keeps the old name and gives it a reason. |
| D2 | Scenes are **data** in `src/data/story/**`. Lines name speakers **by unit id**. Names, titles, name-plate colours and portraits come from `UNIT_MAP` and `src/art/portraits.js`. Inside dialogue, a girl's name is written as a token (`{name:aoi}`), so a rename in `units.js` (the roster merge) carries through. |
| D3 | **No new art.** Portraits are the existing drawn stands (`<id>-cut.webp`). Backgrounds are the painted academy (day, sunset and night tints), the three painted lobby scenes used as event CGs, and **stills of real battle maps** rendered once with the existing renderer. Expressions are code-drawn emote bubbles plus motion. They are not new faces. |
| D4 | **Existing saves are "legacy"**: no forced opening or tutorial, every feature open, no welcome-pull grant (they already got the creation ticket), and journal lessons for content they have already passed unlock quietly with claimable small rewards. |
| D5 | **New saves** go title → opening scene → tutorial battle on **1-1 (Easy)** with a coach overlay. It is skippable and is never forced again once done or skipped. |
| D6 | **The welcome 10-pull moves** from account creation (`createProfile` `ticket_recruit10: 1`) to the **1-3 clear**, delivered by **mail** (`deliverMail`, id `story-welcome-10pull`). It is guarded against double grants by `story.welcome` **and** `mail.delivered`. |
| D7 | Lessons unlock on **"stage X cleared"** (any difficulty). The campaign is linear, so this equals "N distinct stages cleared". It matches the old game's distinct-clear counting and the existing stage gates (Bounty 1-5, Challenge 2-5, Total Assault 5-5). |
| D8 | **Hard feature gates are few** and apply to new saves only: Student → **Equipment** tab (until 2-1) and **Awakening** tab (until 3-2). Each opens early when the profile already shows use: owned gear, a gear box, any awakened girl, or an owned crown. Everything else keeps the gates it already has; lessons only *teach*. Recruit is **never** gated, because beta-gift tickets must stay usable. |
| D9 | **No SAVE_VERSION bump** (feature/roster owns v3). A new `profile.story` block is added by `createProfile`, carried and repaired by `migrateProfile`, and read lazily through `storyOf(profile)`, which falls back to `profile.story ??= legacyStory()`. |
| D10 | Scenes play through **one player** (`src/ui/story/player.js`). It mounts as a screen (`#/scene/<id>`) for forced and replay flows, or as an overlay for queued scenes on top of whatever screen the player is on. |
| D11 | The audio hook is **optional and tiny**: `window.__sakura?.audio?.play?.(track, { stems })`, guarded. With no audio merged it does nothing. Story never imports `src/audio/**`. |

Content rules (hard, CONTRACTS §0):
* Everything is wholesome. The academy girls are students: no romance, no flirting, no comments on bodies,
  no fanservice framing.
* Hikari, Luna and Nami (later also Kanna, Yoriko and Seiran) are adults who act as guardians and mentors. No
  character is ever written romantically, including toward Sensei.
* All writing is original, with no quoting or paraphrasing of other works and no third-party characters. Old
  Codex-game text is first-party and may be adapted. The tutorial lines below adapt it.
* The content lint test (§6) enforces a banned-word list.

---

## 1. Scene format, scene player, triggers, archive

### 1.1 Files (new area **story**; edits elsewhere are listed in §5.4)

```
src/data/story/
  format.js        scene()/say()/narrate()/cue()/choice() helpers + vocabularies (POSITIONS, FACES, FX, NPCS, TOKENS)
  backgrounds.js   BACKGROUNDS { id: { kind: 'paint'|'cg'|'stage', file?, tint?, stageId?, thumb } }
  music.js         STORY_MUSIC { cueId: { track, stems? } | { jingle } | { stop: true } }   (pure data)
  lessons.js       LESSONS (12), LESSON_IDS, FEATURE_GATES, STORY_REWARDS — small, imported by systems/story.js
  scenes/opening.js, scenes/ch1.js … scenes/ch8.js
  index.js         SCENES (id → scene), SCENE_LIST (archive order), sceneById(id), scenesWithTrigger(kind)
src/systems/story.js          pure profile logic (state, migration, lessons, gates, welcome pull, onboarding)
src/systems/storyTriggers.js  pure trigger/queue/seen logic; takes the scene list as an argument
src/ui/story/
  install.js       installStory({ store }) — app-start check + screenchange / battle-result listeners
  player.js        playScene(id, { host, onDone }) → Promise<'done'|'skipped'>; the VN player
  scene.js         route #/scene/<id>?next=… (screen host for the player)
  archive.js       route #/story (Story archive)
  journal.js       route #/journal (Captain's Journal) + lesson detail
  coach.js         tutorial coach overlay mounted into the battle shell
  coachSteps.js    pure step machine for the tutorial (unit-tested)
  toast.js         journal unlock toast pill (own host; no change to components.toast)
  backdrop.js      resolves a background id → <img> (stage ids → their painted place); optional stage-still hook
  emotes.js        code-drawn emote glyphs (SVG strings)
  music.js         optional audio hook (§1.6)
src/ui/styles/story.css
tests/story/*.test.js, e2e/story.mjs
```

`src/systems/story.js` must stay light because `save.js` imports it. It imports only `src/data/story/lessons.js`
and `src/data/stages.js`, and **never** the scene files. All scene text is in one lazy chunk loaded by
`install.js` (`import('../../data/story/index.js')`), so the main bundle grows by about 4 KB at most.

### 1.2 Scene data

```js
// src/data/story/scenes/ch1.js
import { scene, say, narrate, cue, choice } from '../format.js';

export default [
  scene('ch1.mid', {
    title: 'The Jelly Throne',          // episode title (archive + title card)
    chapter: 1,                         // 0 = opening/tutorial, 1..8 campaign
    kind: 'mid',                        // 'opening' | 'prologue' | 'join' | 'mid' | 'epilogue' | 'outro' | 'lesson' | 'event'
    trigger: { before: '1-5' },         // §1.4: { opening: true } | { before: stageId } | { after: stageId } | { tutorial: 'won' } | { lesson: id } | null (archive only)
    bg: 'stage:1-5',                    // §1.2.4 — first background
    music: 'blossom',                   // §1.6 — first music cue
    cast: ['hikari', 'rei', 'aoi', 'yuki'], // optional; derived from lines when omitted (archive card + preload)
  }, [
    narrate('The fountain at the heart of the gardens has a new owner.'),
    say('rei', 'He is wearing the rosebushes. As a crown.', { at: 'left', face: 'deadpan' }),
    say('slime_prince', 'Bloop.', { face: 'sparkle' }),           // NPC: plate only, no portrait
    say('hikari', 'Careful — every hit splits him into smaller jellies. Keep {name:yuki} near the fountain!', { at: 'center', face: 'determined', fx: 'nod' }),
    choice([
      { text: 'Everyone, on Hikari\'s signal!', lines: [say('aoi', 'Bowstring ready!', { face: 'determined' })] },
      { text: 'Can we keep one small jelly?', lines: [say('yuki', '…I already named one. Wobble.', { face: 'sleepy' })] },
    ]),
    cue({ music: 'march', shake: true }),
    say('hikari', 'Sentinels — let\'s take back our garden!', { face: 'joy', fx: 'hop' }),
  ]),
];
```

Normalised line objects (`format.js` builds them; the player reads only these):

| Line | Shape | Notes |
|---|---|---|
| say | `{ t: 'say', who, text, at?, face?, fx?, name? }` | `who` = unit id, NPC id (§1.2.3) or `'sensei'`. `at` places or moves her portrait (keeps her last slot when omitted). `name` overrides the plate text (e.g. `'???'` before Hikari introduces herself). |
| narrate | `{ t: 'narrate', text }` | No plate, italic, centred box style. |
| cue | `{ t: 'cue', bg?, music?, sfx?, exit?: id[]\|'all', enter?: [{ who, at }], flash?, shake?, petals?, fade?: 'in'\|'out', wait?: ms }` | Stage direction. It runs at once and the player auto-advances past it. |
| choice | `{ t: 'choice', options: [{ text, lines: Line[] }] }` | 2–3 options. **Flavour only**: there is no effects field (a test checks this). The chosen index is stored in `story.choices[sceneId]` for the log. Max one per episode. |

#### 1.2.1 Positions (`POSITIONS`)
`left`, `center`, `right` (three on stage at most), plus `off` (a voice from off-stage: plate shown, no portrait).
Entering a fourth speaker without `exit` replaces the portrait that has gone longest without speaking.

#### 1.2.2 Expressions (`FACES`) and motion (`FX`)
The portraits are single drawn stands, so an expression = **emote bubble** (code-drawn SVG, `emotes.js`) above her
head + an optional **motion**. Vocabulary (closed; tests enforce):

| face | emote glyph | default fx |
|---|---|---|
| `neutral` | — | — |
| `smile` | small sparkle | — |
| `joy` | ♪ notes | hop |
| `laugh` | "hehe" squiggles | bounce |
| `surprise` | ! | jolt |
| `question` | ? | tilt |
| `sweat` | sweat drop | — |
| `pout` | puff cloud | shake-small |
| `determined` | spark/flare | nod |
| `sad` | tear drops | droop |
| `sleepy` | z z | sway |
| `idea` | lightbulb | hop |
| `sparkle` | ✦✦ | — |
| `wink` | star | — |
| `heart` | ♡ (friendly cheer only, never romantic — lint caps it at 1 per episode) | — |
| `deadpan` | "…" | — |

`fx` (overrides the default): `hop`, `bounce`, `jolt`, `nod`, `tilt`, `shake-small`, `droop`, `sway`, `slide-in`,
`fade`. Screen effects live on `cue`: `flash` (white/gold), `shake`, `petals`, `fade`.
Forward-compatible: if per-girl expression art is ever painted (`<id>-face-<face>.webp`), the player uses it
and keeps the emote. Nothing in the data changes.

#### 1.2.3 Speakers that are not roster girls (`NPCS`)
`narrator` (no plate), `sensei` (plate "Sensei", no portrait, rare; Sensei mostly speaks through choices),
`unknown` (plate "???"), and **enemy speakers by enemy id** (`slime_prince`, `lizard_basilisk`,
`ghost_hollowknight`, `orc_general`, `plant_treant`, `goblin_chief`, `goblin_machine`, `oni_champion`,
`dragon_ashwing`, …). Their plate name comes from `ENEMY_MAP[id].name`, tinted in the enemy family colour, with no
portrait. A test checks every NPC id exists. Future girls (the 11 old-only ids) may appear only on lines or
scenes marked `ifUnit: '<id>'`. These are dropped while `UNIT_MAP[id]` is missing, so content can land before the
roster does.

#### 1.2.4 Backgrounds (`BACKGROUNDS`)
| id | kind | source | use |
|---|---|---|---|
| `academy-day`, `academy-sunset`, `academy-night` | paint | `public/art/lobby/academy.webp` + the lobby's CSS tints | the stage fallback (`CHAPTER_FALLBACK_BG`); no campaign scene uses them since Oct 27, but the Halloween event scenes (`src/data/events/scenes/halloween.js`) still open on `academy-night` |
| `academy-soft` | paint | same, blurred (8 px) + dimmed | spare |
| story places (31: `academy-courtyard[-sunset/-night]`, `academy-gate[-sunset/-night]`, `common-room`, `workshop`, `blossom-court[-sunset/-night]`, `library-garden`, `lakeshore`, `moon-pier`, `shrine-steps`, `shrine-bell`, `mountain-pass`, `beacon-gate`, `marsh`, `drowned-willow`, `foundry`, `sakura-sanctuary`, `festival-street`, `festival-drum`, `base-camp`, `summit-nest`, and the Gate Arc's `station-plaza`, `covered-arcade`, `corner-store`, `dry-fountain`, `shelter`) | paint | `public/art/lobby/story/<id>.webp` (1280x876) + `story/thumbs/<id>.webp` (320 px, archive cards); time of day painted in (`tint: 'day'`), `focus` = the picture's object-position | where each scene takes place |
| `cg:hikari-rampart` | cg | `public/art/lobby/hikari.webp` | Hikari's reveal in the opening; ch8 ending |
| `cg:aoi-archery` | cg | `public/art/lobby/aoi.webp` | Aoi moments (ch1, ch2) |
| `cg:sango-harbour` | cg | `public/art/lobby/sango.webp` | the harbour arrival (end of ch1), ch2 |
| `stage:<stageId>` | stage | that stage's painted place (`STAGE_PLACE` in `backgrounds.js`), else the chapter's academy tint | every chapter location |
| `stage:<stageId>@dusk` / `@night` | stage, time of day | the same place at dusk or night (a painted place's `-sunset` / `-night` picture when listed; a drawn skyline gets the dusk or night sky and its lights) | evening and night scenes |
| `black` | — | solid | fades, title cards |

A CG already has a girl painted in it, so while a `cg:` background is up the player **hides portraits** (lines still
get name plates). Leaving the CG brings the stage portraits back.

**Story places (Oct 27):** every campaign stage maps to a painted place (`STAGE_PLACE`, e.g. 2-1 to 2-3 the
lakeshore, 2-4 and 2-5 the Moon Pier), so scene data keeps `stage:<id>`. A scene loads its own background when it
opens and each cue's background one cue ahead; nothing loads at boot. Each place's `focus` keeps its landmark in the
open band above the text box on a landscape phone (844x390) and its middle on a portrait one. `SPARE_BACKGROUNDS`
lists the pictures no scene uses yet (the Gate Arc places wait for their scenes and stages 1-6 to 1-10). A new
background fades in once its picture has decoded (or after 2.5 s, `BG_READY_CAP_MS`, so it never holds the scene
up). The old layers stay underneath until the new one has really faded in: its own opacity `transitionend`, or a
safety timer (`FADE_FALLBACK_MS`, 670 ms) that starts when the fade starts, and its picture has decoded. Layers go
only from beneath the topmost layer that is fully in (`layersToDrop`), so a second change that arrives mid-fade can
never remove a newer layer, and a slow phone or a busy frame never shows black between two places.

**Stage stills** (not built; the hook `setStageStillProvider()` in `backdrop.js` stays, nothing registers a
provider, and a registered still would crossfade over the stage's place). The original plan: build a headless `Sim` for the stage (`new Sim({ stageId })`, prep state, no
towers) and `createBattleRenderer(hiddenHost, sim, { quality: 'medium' })`. Render a few frames, copy the canvas to
an `ImageBitmap` or object URL, then dispose the renderer. The still is cached per stage for the session, shown with
`object-fit: cover`, a 2 px blur and a light tint for text contrast. Use `stage:`, not map ids, because
feature/tracks-v3 may rename maps. **Fallbacks:** WebGL missing, `settings.quality === 'low'`, or no still within
2.5 s → the chapter's academy tint (`CHAPTER_FALLBACK_BG[ch]`). A still is never a reason to delay text.
Builder 2 checks that the still path does not leak WebGL contexts (one at a time; dispose before the next).

#### 1.2.5 Text tokens (`TOKENS`)
`{name:<unitId>}`, `{title:<unitId>}`, `{ult:<heroId>}` (her ult name from data), `{stage:<stageId>}` (stage name),
`{chapter:<n>}` (chapter name from `CHAPTERS`). Every roster name in text **must** be a token. The lint test fails
on a bare unit name, so the roster merge can rename anyone safely. Unknown tokens fail the test.

#### 1.2.6 Limits (tests enforce)
Text ≤ 120 characters per line (3 lines at 844×390). An episode has 8–18 spoken lines (opening ≤ 20), at most 1
choice and at most 4 distinct portraits. `heart` appears at most once per episode. Mechanic explanations run at
most 2 consecutive lines.

### 1.3 Scene player UI (academy style)

Layout (same structure at 844×390 and 1280×720; sizes in `story.css` use `vh` with clamps):

```
┌──────────────────────────────────────────────────────────────┐
│ [title card on first line: "Chapter 2 · Episode 1  Lanterns…"]│   [LOG] [AUTO] [SKIP ›]  (top-right, 40 px pills)
│                                                              │
│      (left)              (center)             (right)        │   portraits: drawn stands <id>-cut.webp,
│     portrait            portrait             portrait        │   ~175 vh tall, top at ~4 vh → head to waist
│                                                              │   visible above the box; speaker 100 %, others
│ ┌─[ Hikari  Dawnblade Captain ]─────────────────────────────┐ │   dimmed to 55 % + 2 % smaller
│ │ Text types on here… two or three lines, 16 px phone /     │ │   text box: bottom, ~30 % (phone) / 24 % (desktop)
│ │ 20 px desktop.                                        ▼   │ │   height; translucent white, navy text, slanted
│ └───────────────────────────────────────────────────────────┘ │   name plate (name in her palette accent)
└──────────────────────────────────────────────────────────────┘
```

* **Portrait placement.** Slot x centres are 20 / 50 / 80 % (phone) and 24 / 50 / 76 % (≥ 1100 px). The face
  height comes from `PORTRAIT_DATA` and the stand ratio. Builder 1 adds a per-girl `storyY` nudge table
  in `backgrounds.js` only if a stand reads badly. Portraits enter with a slide-in (180–260 ms), the speaker
  change with a dim crossfade (120 ms), following the CONTRACTS §12 motion timings.
* **Name plate.** `UNIT_MAP[id].name` plus a small `title`, coloured by the girl's palette accent (falls back to sky blue).
  NPCs use the family colour. Narration has no plate and is centred italic.
* **Type-on.** 45 chars/s (Slow 25, Fast 90, Instant). A tap while typing completes the line; a tap on a full line
  advances. Space and Enter advance. Holding Ctrl fast-forwards (desktop). A ▼ bounce marks a full line.
* **Auto.** After a full line, waits 900 ms + 30 ms per character (cap 4 s), then advances. The button glows while on.
  Auto pauses on a choice. The speed and Auto setting persist in `story.prefs`.
* **Skip.** A confirm dialog: "Skip this episode? You can read it again from the Story archive." with [Skip] and
  [Keep reading]. Skipping counts as seen, so first-read rewards are still granted (a common story-player convention). On an
  unread *opening* the dialog adds: "Hikari will still show you the ropes in your first battle."
* **Log.** A sheet with every shown line (plate + text), the chosen option marked ▶. It scrolls and closes with ✕ or Esc.
* **Hide UI.** An eye button (or a long press on the background) hides the box and buttons; a tap brings them back.
* **Choices.** 2–3 slanted white buttons stacked above the box. The reply lines play, then the scene continues.
* **Title card.** On the first line: chapter, episode number and episode title, fading out after 1.6 s (0 s with reduced motion).
* **Reduced motion** (`settings.reduceMotion` or `prefers-reduced-motion`): instant text, no slides, hops, shakes,
  flashes or petals (crossfades only), and the title card shows without animation. Auto still works.
* **Accessibility.** The text box is `aria-live="polite"`. Buttons have labels. Focus is trapped in the player.
  `Esc` opens the Skip confirm. Touch targets are at least 40 px. Safe-area insets
  (`env(safe-area-inset-left/right)`) apply on notched phones.
* **Loading.** Preload the cast's `-cut` stands and the first background, capped at 2.5 s (petal spinner). The
  rest load in the background. A broken stand image falls back to `portraitHTML`'s SVG.
* **Overlay etiquette.** A queued scene waits while any `.modal` is open (checks every 400 ms for up to 10 s, then
  defers to the next screen change), never starts on `battle`, `title` or `scene` screens (the tutorial
  outro is the one exception, §2.4), and sets `window.__sakura.storyBusy = true` while it plays.
* **Test hooks.** `data-testid`s: `story-player`, `story-text`, `story-next` (whole-screen tap area),
  `story-log`, `story-auto`, `story-skip`, `story-skip-confirm`, `story-choice-<i>`, `story-hide`.

### 1.4 Triggers

| Trigger | When it plays | Rules |
|---|---|---|
| `{ opening: true }` | New save, after TAP TO START, or on any lobby visit while `story.opening === 'pending'` | Route `#/scene/opening?next=tutorial`, replacing history. Forced once. Done or skipped, it never auto-plays again. |
| `{ tutorial: 'won' }` | On the tutorial victory, over the results sheet | §2.4. |
| `{ before: stageId }` | First time the player opens **stage prep** (`screenchange` name `stage`, `params.id`) for that stage | Only if the scene is unseen, the stage is **unlocked**, and the stage is **not yet cleared** (legacy players are not shown backlog). Plays as an overlay on stage prep. |
| `{ after: stageId }` | On that stage's **first clear** | `install.js` diffs the cleared-stage set on store change `battle-result` and pushes onto `story.queue` (persisted). It plays on the next non-battle screen. Several queued scenes play in campaign order, then any pending `before` scene. |
| `{ lesson: id }` | Optional short Hikari scene behind a journal entry's "Hikari explains" button | Never auto. |
| `null` | Archive only (side and event stories) | — |

Queue rules: `story.queue` holds at most 10 ids and drops unknown ids. A scene leaves the queue only when it is
marked seen (done or skipped). Closing the app mid-scene replays it next session.

### 1.5 Story archive — route `#/story`

Reachable from the **missions hub "Story" tile** (replacing today's "Soon" toast; NEW dot when an unlocked
episode is unseen), the **lobby Menu Tab** ("Story") and the journal.

* Layout: the painted academy (`academy-soft`) and Hikari's stand at the bottom-left (as on the missions hub).
  On the left are chapter tabs: Opening, then Ch 1 … Ch 8 with names from `CHAPTERS`. On the right are episode cards.
* Episode card: thumbnail (its background thumb, or the main speaker's bust over the academy thumb), "Episode n",
  title and cast heads. States: **NEW** (unlocked, unseen; chip "First read: 20 gems"), **read** (✓), and
  **locked** (lock + requirement from the trigger: "Clear {stage:2-5}").
* Tap a card to play it in the player (screen host). On exit you return to the archive at the same tab.
* Header buttons: **Captain's Journal** (→ `#/journal`) and **Replay battle tutorial** (→ battle 1-1 Easy with
  `tutorial=1`; rewards follow the normal stage rules).
* **Replays never grant anything.** First-read rewards come from `STORY_REWARDS` (20 gems per chapter episode,
  0 for opening and outro; about 500 gems over the whole campaign) and are granted once, when an episode is first
  marked seen. Legacy players earn them by reading the episodes they have already passed in the archive.

### 1.6 Music cues (optional audio hook)

`STORY_MUSIC` maps story cue ids to the audio branch's track ids (`feature/audio`
`public/audio/music/manifest.json`):

| cue | track · stems | mood |
|---|---|---|
| `title` | `title` | opening |
| `home` | `homeroom` · base+melody | everyday academy |
| `calm` | `homeroom` · base | quiet talk |
| `march` | `march` · base+prep | "let's go" |
| `blossom` / `moonlit` / `lantern` / `ironclock` / `matsuri` | `battle_<family>` · base only | chapter locations |
| `danger` | `boss_warning_hold` | boss reveal |
| `wish` | `wishing` · base | welcome pull, heartfelt |
| `victory` | jingle `victory` | celebration |
| `silence` | stop (0.6 s fade) | dramatic beat |

`src/ui/story/music.js`:
`storyMusic(cue)` calls `window.__sakura?.audio?.play?.(track, { stems })` (or `.music.jingle` / `.music.stop`),
wrapped in try/catch. At scene start it snapshots `audio.state?.()`, and at scene end it restores the previous track
if the snapshot has one. With no audio on the branch, every call is a no-op. Optional per-line `sfx` ids go
through `audio.sfx?.(id)` the same way. **Request to the audio area (one line in `src/audio/routes.js`):** map the
routes `story`, `scene` and `journal` to `{ keep: true, fallback: homeroom }`.

---

## 2. Opening + tutorial

### 2.1 Flows

| Case | What happens |
|---|---|
| **New save** (fresh `createProfile`) | Title → TAP TO START → `#/scene/opening?next=tutorial` → `#/battle?stage=1-1&difficulty=easy&tutorial=1` → victory → outro scene over the results → Home → lobby (Beta gift modal if eligible, then the "Welcome home" lesson toast). |
| Opening skipped | Skip confirm → `story.opening = 'skipped'` → tutorial battle anyway (coach still on; it has its own Skip). |
| Tutorial skipped | Coach "Skip tutorial" → confirm → `story.tutorial = 'skipped'`. The battle continues as a normal 1-1 Easy run. |
| Quit or defeat mid-tutorial | `tutorial` stays `pending`. Defeat shows Hikari's retry bubble (§2.3). The next visit to 1-1 stage prep shows a small Hikari prompt: "Shall we finish our first lesson together?" with [Start with Hikari] (→ tutorial battle) and [Not now] (→ `skipped`). It is never forced again after that. |
| Deep link while opening pending (e.g. `#/students`) | That screen renders (keeps e2e deep links working). Only the **lobby** redirects to the opening. |
| **Legacy save** (no `story` block when migrated) | Nothing forced. On the first lobby visit after the update, one toast appears: "Hikari's Captain's Journal is here — N lessons to read (Menu → Journal)" (`story.announced`). Archive episodes behind them are unlocked and unseen. |
| RESET67 | `store.reset()` → fresh `createProfile()` (new story) → **navigate('title')** (today it goes to the lobby). Clear `sessionStorage['sakura-title-seen']` first → opening → tutorial. This closes K-02. Keeping device settings on reset is a separate meta-a fix, listed in §5.4. |
| e2e / screenshots | Adding the page query `?onboarding=0` (before the hash) makes `installStory` mark opening and tutorial `skipped` once. It is a debug convenience only, since players can skip anyway. `e2e/shot.mjs` appends it. The smoke test exercises the real flow. |

### 2.2 Opening scene "Meet Hikari" (canonical example of the format; Builder 1 ships it as written)

```js
scene('opening', { title: 'Meet Hikari', chapter: 0, kind: 'opening', trigger: { opening: true }, bg: 'black', music: 'title' }, [
  cue({ bg: 'academy-day', fade: 'in', petals: true }),
  narrate('Spring. Above Moonpetal City, the cherry trees of Sakura Academy are in full bloom.'),
  narrate('Here, students with halos train to become Sentinels — the guardians of the academy and the city below.'),
  say('hikari', 'Sensei! Up here — on the wall!', { at: 'off', name: '???' }),
  cue({ bg: 'cg:hikari-rampart', flash: 'gold' }),
  say('hikari', 'Hehe, sorry! I always come up here to watch the sunrise. It\'s the best seat in the academy.', { face: 'laugh' }),
  say('hikari', 'I\'m {name:hikari}, Captain of the Sentinel Guard. Welcome to Sakura Academy!', { face: 'smile' }),
  choice([
    { text: 'Nice to meet you, Captain!', lines: [say('hikari', 'Just Hikari is fine. We\'re going to be working together, after all.', { face: 'wink' })] },
    { text: 'Do you greet everyone from the top of a wall?', lines: [say('hikari', 'Only the important ones! …And the bakery delivery girl. She was very impressed.', { face: 'sweat' })] },
  ]),
  cue({ bg: 'academy-day', music: 'home', enter: [{ who: 'hikari', at: 'center' }] }),
  say('hikari', 'The academy asked for a Sensei who can read a battlefield. That\'s you — I\'ve been looking forward to this.', { face: 'smile' }),
  say('hikari', 'Lately, monsters keep wandering out of the wilds. Slimes, goblins… and a few things that are much bigger.', { face: 'neutral' }),
  say('hikari', 'The Sentinels protect the city. My job is to protect them while they do it. The dawn is never late!', { face: 'determined', fx: 'nod' }),
  say('aoi', 'Captain! The slimes are in the flowerbeds again! They\'re eating the tulips!', { at: 'left', face: 'surprise', fx: 'slide-in' }),
  say('hikari', 'Sensei, this is {name:aoi} — the steadiest bow in the academy.', { face: 'smile' }),
  say('aoi', 'A-a real Sensei? Oh! Hello! I\'ll do my very best!', { face: 'sparkle', fx: 'hop' }),
  say('rei', 'The tulips are lost. The rosebushes can still be saved.', { at: 'right', face: 'deadpan', fx: 'slide-in' }),
  say('hikari', 'And that\'s {name:rei}. She takes gardening very seriously.', { face: 'laugh' }),
  say('rei', 'I take everything seriously. Sensei — your orders?', { face: 'determined' }),
  say('hikari', 'Perfect timing for a first lesson. Come on, Sensei — I\'ll show you how we protect this place ♡', { face: 'wink', fx: 'hop' }),
  cue({ music: 'march', fade: 'out' }),
]),
```

### 2.3 Tutorial battle (coach overlay)

* **Stage:** the real **1-1** (`First Petals`, `sakura_terrace`) on **Easy**: the first stage, forgiving, and its
  first clear counts normally. There is no new stage def, so files owned by feature/balance-playtest stay untouched.
  Route `#/battle?stage=1-1&difficulty=easy&tutorial=1`. The formation is the new-save default (Hikari + Aoi + Rei).
* **Hook:** `src/ui/battle/controller.js` gets one additive block after `ready`:
  `if (params.tutorial === '1') import('../story/coach.js').then((m) => cleanups.push(m.attachCoach({ ctx, sim, shell, renderer, profile })))`.
  The coach reads state only (`sim.towers`, `sim.wave`, `sim.state`, `sim.hero`, `sim.heroUltStatus()`, `sim.cash`,
  `ctx.speed`, `ctx.selectedUid`) on its own 200 ms timer. It never pauses the sim and **never blocks input**.
  The coach is a dimmed scrim with a spotlight hole, a pulsing ring on the target and a bubble. The player
  progresses by doing the action.
* **Targets** use the existing test ids: `card-<id>`, `start-wave`, `tower-panel`, `buy-0..2`, `speed`, `ult`,
  `result`, `home`. Board targets use `renderer.worldToScreen(x, y)`.
* **Drag hint:** for step 1 the coach picks a suggested spot. It samples points about 1.3 tiles to the side of the
  path (30–45 % along the first path), keeps one where `sim.canPlace('aoi', x, y)` holds, and animates a ghost hand
  from Aoi's card to it, looping every 1.6 s. A valid drop anywhere completes the step.
* **Bubble:** Hikari's thumb (56 px) with a bubble up to 320 px wide, top-centre under the HUD, moving to avoid the
  target. It has buttons [– minimise] (→ "Hikari's tips" pill) and [Skip tutorial]. Lines use tokens, so the ult
  name and girls' names come from data. It is hidden while the pause menu is open.

Steps (pure machine `coachSteps.js`: `nextStep(snapshot, done) → stepId`; the first step whose *gate* is open and
which is not *done* shows):

| # | id | gate (show when) | done when | target | Hikari (title / text) |
|---|---|---|---|---|---|
| 1 | `place` | always | any tower placed | `card-aoi` + drag hand | **Meet your first defender!** Drag {name:aoi}'s card onto the grass beside the path and let go — she'll stand right where you drop her. |
| 2 | `start` | ≥1 tower | `sim.wave ≥ 1` | `start-wave` | **Ready, Sensei?** Tap Start wave. Slimes that reach the gate cost hearts — let's not lose any! |
| 3 | `hero` | state `between` and cash ≥ hero cost (or wave ≥ 2) | `sim.hero` placed | `card-hikari` | **A little light, just for you ♡** Now drag my card onto the field. I'm your hero — I grow stronger every wave! |
| 4 | `upgrade` | state `between` and cash ≥ the cheapest tier-1 cost of a placed girl | any tower tier > 0 | the girl on the board, then `buy-*` once `tower-panel` is open | **A tiny upgrade, a big difference!** Tap {name:aoi}, then buy her first upgrade. Battle coins only last for this battle, so spend them! |
| 5 | `speed` | `upgrade` done and wave ≥ 2 | `ctx.speed > 1` | `speed` | **Let's pick up the pace!** Tap the speed button for 2× — tap again for 3×. |
| 6 | `ult` | `heroUltStatus().ready` | ult fired (`ult` event or cooldown > 0) | `ult` | **Let's make it bloom!** {ult:hikari} is ready! Tap it when a crowd of slimes gathers. |
| 7 | `free` | steps 1–5 done | — (shown 5 s, then minimises) | — | **You've got this, Sensei ♡** Keep the path covered until the last wave. I'm right here! |
| — | `lost` | `sim.state === 'lost'` | — | `retry` | **That's okay — even the dawn needs a second try.** [Retry with Hikari] [Skip tutorial] |

Step 6 can appear at any point after it becomes ready, including before 7. If the stage ends before Hikari's ult
unlocks (hero level 3), step 6 is simply never shown; the "Two kinds of growing" lesson covers ults. **Builder 2
verifies with the headless sim** that Hikari placed after wave 1 on 1-1 Easy reaches ult unlock before the last
wave (§6 T-coach-3). If not, they report it to feature/balance-playtest and leave the sim alone.

### 2.4 Victory and outro

On `sim.state === 'won'` the coach waits for `[data-testid=result]`, then plays `tut.outro` as an **overlay
on the battle screen** before the rewards view. This is the one exception to "never on battle". Then
`story.tutorial = 'done'`, and a bubble points at **Home**; Next Stage and Map still work. Replays from the
archive play the outro again without rewards.

```js
scene('tut.outro', { title: 'First Petals', chapter: 0, kind: 'outro', trigger: { tutorial: 'won' }, bg: 'academy-sunset', music: 'victory' }, [
  say('hikari', 'Wonderful work, Sensei! The flowerbeds are safe… mostly.', { at: 'center', face: 'joy', fx: 'hop' }),
  say('aoi', 'I upgraded my arrows! Well — Sensei told me when.', { at: 'left', face: 'sparkle' }),
  say('rei', 'Two tulips lost. Acceptable.', { at: 'right', face: 'deadpan' }),
  cue({ music: 'home' }),
  say('hikari', 'I\'ll write down everything we learn in my Captain\'s Journal. You can read it any time from the Menu.', { face: 'smile' }),
  say('hikari', 'Let\'s head home. And Sensei? Welcome to the Sentinels.', { face: 'wink' }),
]),
```

---

## 3. Captain's Journal

### 3.1 The 12 lessons (old → new)

Unlock = "stage cleared, any difficulty" (D7); the clear count in brackets is the old game's `at` equivalent. *Gate*
= a hard lock on new saves only (D8). Rewards are small and claimed from the journal entry. **Action** is the
entry's "Show me" button.

| # | Old lesson (`at`) | New id | Unlocks on | New-game feature taught | Action (route) | Gate | Reward |
|---|---|---|---|---|---|---|---|
| 0 | `city` (0) | `home` | tutorial done or skipped [0] | Lobby: secretary ‹ ›, backgrounds, Mail, Login gift, Notice; where the journal lives | `commissions?tab=login` | — | 100 gems |
| 1 | `bestiary` (1) | `bestiary` | 1-1 [1] | Bestiary (silhouettes until beaten), Wiki type chart, "New!" enemies in stage prep | `bestiary` | — | 5× `book_common` |
| 2 | `teams` (2) | `formation` | 1-2 [2] (Yuki joins) | Formation: hero + 8, counters glow, "Add counters"; free girls arrive one stage before their mechanic | `formation` | — | 3,000 coins |
| 3 | `recruit` (3) | `recruit` | 1-3 [3] | **Welcome 10-pull (mail)**; rates, pity 90, SR in every 10, recruit points → spark, duplicates → Star Fragments | open Mail, then `recruit` | never | 1× `ticket_recruit10` **via mail** (§3.4) |
| 4 | `level` (3) | `levelup` | 1-3 [3] (listed after `recruit`) | Level Up with books, breakthroughs with family materials, Teleport to drops | `student/aoi?tab=level` | — | 5× `book_rare` + 5,000 coins (the "training kit") |
| 5 | `talents` (4) | `paths` | 1-4 [4] | Battle upgrades: 3 paths × 5 tiers and the crosspath rule (Student → Tree); battle coins vs permanent levels; hero levels and ult | `student/<secretary>?tab=tree` | — | 50 gems |
| 6 | `resource` (5) | `bounty` | 1-5 [5] (= existing Bounty gate) | Bounty arenas and tiers, the weekly double-drop event, medals and difficulties, Sweep after Hard | `bounty` | existing stage gate | 60 gems |
| 7 | `gear` (6) | `gear` | 2-1 [6] | Equipment: charm/ribbon/shoes, enhance, substat rerolls with dice + lock pin; Backpack Equipment tab | `backpack?tab=equipment` | **Student → Equipment tab** | 1× `gearbox_rare` + 2× `dice_reroll` |
| 8 | `event` (6) | `commissions` | 2-2 [7] | Commissions (daily, weekly, achievements), Events page, Mall exchanges | `commissions` | — | 50 gems |
| 9 | `sandbox` (7) | `challenge` | 2-5 [10] (= existing Challenge gate) | Tactical Challenge (endless) and endless runs on cleared maps, "try your wildest idea" | `challenge` | existing stage gate | 50 gems + 1× `ticket_recruit` |
| 10 | `awaken` (10) | `awaken` | 3-2 [12] | Awakening: crowns from chapter finales, Star Fragments; "levels can't replace the right counter" | `student/<secretary>?tab=awaken` | **Student → Awakening tab** | 10× `star_fragment` |
| 11 | `boss` (8) | `assault` | 5-5 [25] (= existing Total Assault gate) | Total Assault bosses, phases, boss tokens → Boss Exchange (crowns, dice) | `assault` | existing stage gate | 100 gems |

Totals: 410 gems, 1 single ticket, the 10× ticket moved from account creation, plus small items. ECONOMY.md
gets one paragraph (Builder 3). `f2pIncomeSummary` is unchanged because these are one-time rewards.

### 3.2 Lesson texts (Hikari's voice; `lessons.js`, tokens allowed; title + body ≤ 3 short paragraphs)

* **home — "Welcome home, Sensei"**: "This is our home base! Tap ‹ › to change who keeps you company, and the picture
  button to pick a background. Mail holds gifts from the academy, and the Login gift grows every day you visit —
  missing a day never resets it. Every lesson I teach you stays right here in my journal."
* **bestiary — "Meet the neighbours… and the rivals!"**: "You found your first monsters! Beat a stage and they appear
  in the Bestiary with their traits and weaknesses. Stage prep marks brand-new ones with **New!** — and the Wiki's
  type chart tells you which attacks hurt them most."
* **formation — "A little teamwork goes a long way"**: "{name:yuki} joined us! In Formation you choose one hero and up to
  eight girls. Girls who counter the next stage glow, and **Add counters** fills the gaps for you. Every counter you
  need comes from a free girl, one stage before her mechanic shows up."
* **recruit — "Ten new possibilities, on us ♡"**: "Three stages cleared — that deserves a celebration! I left a
  10× Recruit Ticket in your Mail. Every ten-pull has at least one SR, an SSR is guaranteed by pull 90, and recruit
  points let you pick any SSR you like. Duplicates turn into Star Fragments for awakening."
* **levelup — "Your first Academy lesson"**: "Battle upgrades vanish when the battle ends — Academy levels stay forever!
  Open {name:aoi}, tap Level Up and feed her books. I packed a training kit for this lesson. Missing a material?
  Tap it and **Teleport** straight to the stage that drops it."
* **paths — "Two kinds of growing"**: "In battle, every girl has three upgrade paths with five tiers. Two paths at most,
  and only one past tier 2 — the Tree tab shows how they combine. Heroes level up during the fight, and at level 3
  their ultimate unlocks. Save it for a crowd!"
* **bounty — "A little supply expedition"**: "Bounty is open! Each arena drops one kind of supply — books, coins, gear or
  materials — and one arena has double drops every week. Clear a stage on Hard and you can **Sweep** it later in one tap."
* **gear — "Dress for the adventure"**: "Equipment unlocked! Every girl has a charm, a ribbon and shoes. Enhance gear with
  coins, and reroll substats with dice — a lock pin keeps your favourite one safe. Always read the cost before you roll!"
* **commissions — "Little promises, every day"**: "Commissions are small daily and weekly goals with gems as thanks.
  Achievements reward big milestones, Events show this week's special, and the Mall trades tokens for things you need."
* **challenge — "Try your wildest idea"**: "Tactical Challenge is endless — see how many waves your squad can hold!
  Maps you've cleared can be played endlessly too. It's the perfect place to test a new team before a hard stage."
* **awaken — "Let your star shine brighter"**: "Awakening adds stars that make a girl stronger for good. It needs crowns
  from chapter finales and Star Fragments. But remember: no amount of levels replaces the right counter!"
* **assault — "Something big is coming!"**: "Total Assault is open — huge bosses with phases you can read before you fight.
  They drop boss tokens and crowns. Time your hero's ultimate for the most dangerous phase!"

### 3.3 Gating rules (`featureOpen(profile, featureId)`)

```
featureOpen(p, f) =
  story.legacy                                   // existing saves: everything open, always
  || lessonUnlocked(p, FEATURE_GATES[f].lesson)  // reached the unlock stage
  || usedEvidence(p, f)                          // never hide what the player already has
usedEvidence: gear   → any profile.gear entry, or any gearbox_* item
              awaken → any unit with awaken > 0, or any crown_* item
```

The locked state uses the student screen's existing `emptyState` style, not a plain alert:
"Equipment unlocks after {stage:2-1} — Hikari will teach you!", a Hikari thumb, and a [Go to {stage:2-1}] button.
The Menu Tab "Equipment" entry and Backpack stay open; with no gear they show their existing empty states.

### 3.4 Welcome 10-pull (mail) and the no-double-grant rule

* `createProfile()` **no longer** gives `ticket_recruit10: 1`. It sets `story.welcome = 'pending'`.
* `checkLessons` runs on app start and after every `battle-result`. When `1-3` is cleared and
  `story.welcome === 'pending'` **and** `!mail.delivered.includes(WELCOME_MAIL_ID)`, it calls
  `deliverMail(profile, { id: 'story-welcome-10pull', from: 'Hikari', title: 'Ten new possibilities, on us ♡', body, rewards: [{ id: 'ticket_recruit10', count: 1 }] })`
  and sets `welcome = 'mailed'`.
* Legacy saves get `welcome = 'legacy'` and are **never** mailed, because they received the creation ticket.
* Imports carry `story.welcome`. `deliverMail` is once-per-id ever, so a mismatched import still cannot regrant.
* RESET67 gives a fresh profile, so the welcome is `pending` again. That is intended: the reset wiped everything.
* The Beta Tester gift (`mail.js`) is unrelated and unchanged.

### 3.5 Unlock moments

* After a battle unlocks lessons, `install.js` shows the **journal toast** (`toast.js`): a tappable pill with Hikari's
  thumb, "Hikari has a new lesson ♡ — Dress for the adventure" (or "2 new lessons"), 4 s, tap → `#/journal?id=…`.
  It appears once the results sheet closes (on the next screen change); on the battle screen it waits.
* **Red dots:** on the lobby Menu button and the Menu Tab "Captain's Journal" entry while
  `unreadLessonCount + claimableLessonCount > 0`, and on the missions hub Story tile for unseen unlocked episodes.
* Legacy backlog: lessons are unlocked silently (`quiet`) with one summary toast (§2.1). Their rewards are
  claimable once, as a thank-you.

### 3.6 Journal screen — route `#/journal`

* Two-pane layout over `academy-soft`. **Left:** a scrollable list of 12 lesson cards, each with an icon (the
  existing `lobbyIcon`/`uiIcon` names), title, "Clear {stage:x}" or ✓, a **NEW** chip when unread, and a gift
  chip when claimable. Locked cards are greyed with the requirement; their titles show as "???" until
  unlocked, to keep the surprise.
* **Right:** the selected lesson, with Hikari's bust (`portraitHTML(hikari, 'bust')`) beside a speech-panel body,
  then [Show me] (action route), [Claim] (rewards, `showRewardsModal`) and, when the lesson has a scene,
  [Hikari explains]. Opening a lesson marks it read.
* Header: "Captain's Journal" and [Replay battle tutorial].
* At 844×390 the list collapses to a horizontal strip of icon cards above the detail panel, or the panes become
  a single column with Back. Test at both sizes.

---

## 4. Chapter story plan and story bible

### 4.1 What exists and what we write

`src/data/stages.js` `CHAPTERS`: **8 chapters × 5 stages = 40 campaign stages**. They are 1 Sakura Gardens (sakura),
2 Moonlit Lakeshore (lake), 3 Moonveil Shrine (shrine), 4 Ironhold Pass (mountain), 5 Gloomfen Marsh (marsh),
6 Clockwork Foundry (foundry), 7 Oni Festival (festival) and 8 Ashwing Peaks (volcano). Every X-5 is a finale with a
miniboss or boss. Free girls join on 1-2 (Yuki), 1-5 (Nami, Sango), 2-5 (Kage), 3-2 (Umeko), 3-5 (Shiro),
4-5 (Midori) and 5-5 (Suzu).

Per chapter: a **prologue** (before X-1), a **mid** scene (before the finale X-5, the boss intro) and an **epilogue** (after
the X-5 first clear, folding in the girls who join there). Two extra **join** episodes cover the free girls who join
mid-chapter (Yuki after 1-2, Umeko after 3-2). Chapter 1's prologue *is* the opening. Total: opening + tutorial
outro + 25 chapter episodes = **27 episodes**, 8–18 lines each (about 350 lines of dialogue).

### 4.2 Story bible

**Premise.** Sakura Academy sits on the hill above **Moonpetal City** (the old game's city, which the City hub port will
build). Its students wear halos and train as **Sentinels**, cheerful guardians of the academy and the city. Long
ago the founders planted the **Sakura Ward**, eight **wardstones** around the city's lands that keep the wilds calm.
This spring the stones are dimming one by one. Monsters drift out of their homes, confused, hungry or just
mischievous, and wander toward the city. Each chapter's finale **relights one wardstone**. In chapter 8 the
ward is whole again.

**Sensei (the player).** The academy's new tactics advisor. Everyone calls them Sensei. Their gender, age and face
are never shown or stated. Sensei speaks through choices, and rarely in a plate line. The girls trust Sensei's
plans; Hikari treats Sensei as a respected partner.

**Hikari (anchor character).** Captain of the Sentinel Guard and the academy's senior guardian, a young adult (never
give a number). Pink hair, star clip, white-and-gold knight's coat, the Dawnblade. She is warm, bright and
unshakeable, teases gently like a big sister, and turns serious in danger ("Stay behind me."). She has kawaii
flourishes ("hehe", at most one ♡ per scene) but is **never flustered or romantic**. She keeps the Captain's Journal.
Catchphrases: "The dawn is never late." and "One petal at a time."

**Tone.** Cheerful, adventurous, heartfelt: a Saturday-morning adventure. Comedy comes from character
(Rei's deadpan, Akane's love of fireworks, Yuki's sleepiness). The heart of each chapter is a small kindness
toward the girls, the city or even the monsters. No gore and no death: defeated monsters "poof" into sparkles
and run home. Bosses are proud, lonely or protective, not evil.

**Monsters (families as characters).** Slimes are greedy, bouncy and love flowers. Goblins are mischievous tinkerers
who "borrow" things. Lizardfolk are territorial lake-dwellers who love shiny lanterns. Ghosts are lost and shy, and
fog makes them bold. Orcs are proud marchers who love rules and duels. Ghouls are gloomy and hungry. Plants are a
sick old willow's roots. Oni are festival-crazy and competitive. Fae are pranksters with illusions. Dragons are ancient
and protective. Enemy NPC lines are short (usually under 6 words) and funny.

**Rules for writers.** These are the content rules in §0 plus: students are students (classes, clubs, homework); adults
mentor; no romance, flirting or "dates"; no body talk; no ages; nothing a parent would frown at. Original writing
only. Names go in tokens. One gameplay idea per prologue, taught in-character in at most 2 lines.

### 4.3 Cast voice sheet (old designs on the shared ids; names and titles come from data)

| id | Voice in one line | Notes |
|---|---|---|
| hikari | warm captain, big-sister teasing, steady in danger | §4.2 |
| luna | playful riddles, sly fox smile, kind mentor | adult guardian (Moonfox Oracle); ears and tail; speaks in moon metaphors |
| nami | composed, dry nautical wit, fiercely protective of her crew | adult guardian (Tide Admiral); Hikari's old friend; calls her "Captain Sunshine" |
| aoi | earnest, a bit nervous, rock-steady when it counts | archer; "I'll do my very best!" |
| rei | deadpan, formal, short sentences; secretly loves gardening and tea | samurai |
| yuki | sleepy bookworm, soft voice, dry humour; frosts things by accident | frost mage |
| akane | loud, bubbly, loves fireworks "with *exactly* the right amount of boom" | flame witch; safety-goggles jokes |
| shiro | calm, precise, talks in numbers and clipped reports; kind underneath | moon sniper |
| kage | over-dramatic entrances, actually the friendliest courier; snacks | shadow ninja |
| raika | sunny, competitive, thunder puns | storm caller |
| miko | gentle and proper, a little strict about shrine manners | shrine keeper |
| midori | curious, chatty, labels everything, "fascinating!" | potion alchemist |
| momo | bubbly performer, cheers everyone on, turns news into songs | starlight idol |
| hotaru | soft and kind; sees the lonely side of spirits; fireflies | lantern keeper |
| sango | sunny pirate enthusiasm ("Ahoy!"), loves her cannon and the sea | coral corsair |
| umeko | serene, formal, tide proverbs | pearl warden |
| kaede | proud, honourable, loves duels; learning teamwork | crimson fencer |
| suzu | tidy and bright; a bell for every occasion | bell trapper |
| chika | practical, grumbles about tools, proud of her machines | clockwork mechanic |
| *later* ruri, fuu, hana, kohaku, tsubaki, noa, iroha, ena (students); kanna, yoriko, seiran (adult guardians) | `ifUnit` cameo lines now; side stories when they land | Kanna fits ch7, Seiran ch8 |

### 4.4 Chapter outlines (writers expand to lines; Builder 3)

Each row: episode id · trigger · title · bg · music · cast · beats.

**Chapter 1 — Sakura Gardens** (wardstone: the **Fountain Stone**)
| id | trigger | title | bg · music | cast | beats |
|---|---|---|---|---|---|
| `opening` | opening | Meet Hikari | §2.2 | hikari, aoi, rei | as written |
| `tut.outro` | tutorial won | First Petals | §2.4 | hikari, aoi, rei | as written |
| `ch1.yuki` | after 1-2 | Snow in Spring | academy-day · home | yuki, aoi, hikari | Yuki wanders out of the library having frozen the fountain "by accident"; the goblin runners slipped on the ice; Hikari recruits her: "Slow them down, and Aoi does the rest." |
| `ch1.mid` | before 1-5 | The Jelly Throne | stage:1-5 · blossom→danger | hikari, rei, aoi, yuki, slime_prince | The slimes merged into a Slime Prince on the fountain, crowned with Rei's roses; splitting warning; flavour choice (example in §1.2). |
| `ch1.epi` | after 1-5 | Ripples on the Lake | academy-sunset → cg:sango-harbour · home | hikari, nami, sango, aoi | The Prince bursts into droplets that hop toward the lake; the Fountain Stone glows again; a ship's bell, and Nami and Sango arrive: lizardfolk are stealing lanterns at night. Sango: "We can stand on WATER, Sensei!" |

**Chapter 2 — Moonlit Lakeshore** (wardstone: the **Moon-Pier Lantern**)
| id | trigger | title | bg · music | cast | beats |
|---|---|---|---|---|---|
| `ch2.pro` | before 2-1 | Lanterns on the Water | stage:2-1 · moonlit | nami, sango, aoi, hikari | Night patrol; lizardfolk love shiny lanterns; Sango shows water placement; Aoi is nervous in the dark and Nami steadies her. |
| `ch2.mid` | before 2-5 | Basilisk Moon | stage:2-5 · danger | hikari, nami, sango, yuki, lizard_basilisk | A basilisk sunbathes on the moon pier and the ferry can't pass; "Don't meet its eyes — it gets very smug." |
| `ch2.epi` | after 2-5 | A Letter from the Shadows | academy-night · calm | kage, hikari, nami, sango | The pier lantern relit; Kage drops from a tree with a dramatic note: fog at Moonveil Shrine, the shrine bell silent; Kage joins ("I was always here. Mostly."). |

**Chapter 3 — Moonveil Shrine** (wardstone: the **Shrine Bell**)
| id | trigger | title | bg · music | cast | beats |
|---|---|---|---|---|---|
| `ch3.pro` | before 3-1 | The Silent Bell | stage:3-1 · lantern | miko, kage, hikari, aoi | Miko greets them politely despite the chaos; ghosts hide in incense fog; Veil Sight explained via Kage and Hikari. |
| `ch3.umeko` | after 3-2 | Pearl in the Fog | stage:3-2 · calm | umeko, miko, kage, hikari | Umeko arrives by boat; her aura reveals hidden enemies for everyone; tide proverb; joins. |
| `ch3.mid` | before 3-5 | Hollow Guard | stage:3-5 · danger | hotaru, miko, hikari, umeko, ghost_hollowknight | An empty suit of shrine armour patrols the sanctum; Hotaru: "It's not angry. It's lonely — it's guarding a bell nobody rings." |
| `ch3.epi` | after 3-5 | Silver Over the Pass | academy-sunset · home | shiro, hikari, miko, hotaru | The bell rings again and the armour bows and fades; a mirror flash from the mountains: Shiro signals that orc columns are on the pass; joins. |

**Chapter 4 — Ironhold Pass** (wardstone: the **Pass Beacon**)
| id | trigger | title | bg · music | cast | beats |
|---|---|---|---|---|---|
| `ch4.pro` | before 4-1 | Iron Column | stage:4-1 · ironclock | shiro, akane, hikari, rei | Shiro's clipped briefing; armoured orcs; Akane wants "a polite amount of boom"; armour break and shred. |
| `ch4.mid` | before 4-5 | The Iron General | stage:4-5 · danger | hikari, kaede, shiro, akane, orc_general | The Orc General demands a duel with "the strongest"; Kaede is thrilled; Hikari: "We don't duel. We win together." Kaede: "…Together is acceptable." |
| `ch4.epi` | after 4-5 | Bubbles in the Fen | academy-day · home | midori, hikari, akane, yuki | The beacon is lit; Midori arrives with a fizzing flask: the marsh plants are walking, "fascinating — and slightly alarming"; joins. |

**Chapter 5 — Gloomfen Marsh** (wardstone: the **Willow Root**)
| id | trigger | title | bg · music | cast | beats |
|---|---|---|---|---|---|
| `ch5.pro` | before 5-1 | Leeches in the Fog | stage:5-1 · lantern | luna, midori, hikari, umeko | Luna appears as a guide through the mist with riddles; ghouls siphon life, and poison stops their healing. |
| `ch5.mid` | before 5-5 | The Drowned Willow | stage:5-5 · danger | luna, midori, hotaru, hikari, plant_treant | The walking roots come from an ancient willow that is sick, not cruel; Midori promises a cure after the battle. |
| `ch5.epi` | after 5-5 | Bells and Bolts | academy-sunset · home | suzu, hikari, luna, midori | The willow sleeps and the root stone glows; Suzu rings every warning bell at once: goblin engineers have taken the academy foundry! She joins. |

**Chapter 6 — Clockwork Foundry** (wardstone: the **Foundry Heart**)
| id | trigger | title | bg · music | cast | beats |
|---|---|---|---|---|---|
| `ch6.pro` | before 6-1 | Crystal Vats | stage:6-1 · ironclock | chika, raika, hikari, suzu | It is Chika's own workshop, and goblins "borrowed" her tools; crystal shells need many small hits; Raika is happy to supply them. |
| `ch6.mid` | before 6-5 | The Goblin Machine | stage:6-5 · danger | chika, raika, akane, hikari, goblin_chief | The goblins built a giant machine from the boilers and Chika's spare parts; Chika is offended by the welding. |
| `ch6.epi` | after 6-5 | A Flyer for the Festival | academy-day · matsuri | momo, chika, hikari, suzu | The furnace heart burns clean; the goblins leave sheepishly, dropping a festival flyer; oni were seen near the stalls; Momo's concert is tonight. |

**Chapter 7 — Oni Festival** (wardstone: the **Festival Drum**)
| id | trigger | title | bg · music | cast | beats |
|---|---|---|---|---|---|
| `ch7.pro` | before 7-1 | Festival Wind | stage:7-1 · matsuri | momo, miko, hikari, kaede | Lanterns and stalls; oni fields (haste and shield) and fae decoys; Miko explains that holy hits silence the casters; Momo keeps rehearsing. |
| `ch7.mid` | before 7-5 | Champion of the Festival | stage:7-5 · danger | kaede, momo, hikari, akane, oni_champion | The Oni Champion wants the festival trophy; Kaede accepts the challenge for the team; `ifUnit: 'kanna'` cameo. |
| `ch7.epi` | after 7-5 | Embers on the Peak | academy-night · wish | hikari, nami, luna, momo | Fireworks; the Champion bows and explains that the oni fled the mountains because the Ashwing Matriarch woke; smoke on the peaks; the three guardians share a quiet, determined moment. |

**Chapter 8 — Ashwing Peaks** (wardstone: the **Hearthstone**)
| id | trigger | title | bg · music | cast | beats |
|---|---|---|---|---|---|
| `ch8.pro` | before 8-1 | Wings over the Ascent | stage:8-1 · matsuri | hikari, luna, nami, shiro | Planning at base camp; flyers need anti-air; the whole academy volunteers; Hikari: "One petal at a time." |
| `ch8.mid` | before 8-5 | The Ashwing Matriarch | stage:8-5 · danger | hikari, luna, nami, aoi, dragon_ashwing | The nest sits on the last wardstone and its warmth keeps her eggs safe; Hikari: "We protect what we love. So does she." The goal is to calm her rampage, not to hurt her. |
| `ch8.epi` | after 8-5 | Petals Again | cg:hikari-rampart → academy-day · title | hikari, aoi, rei, yuki (the first squad, bookending the opening) | The Matriarch flies off with her hatchlings to a quieter peak; the ward is whole; a spring festival under the cherry trees; Hikari closes the journal: "Chapter one of many, Sensei." |

### 4.5 Writing style guide (lint-enforced where possible)

* Use tokens for every roster name (test). Lines are 120 characters or fewer. An episode has 8–18 lines. Every episode
  opens with a narrate line or Hikari, and ends on a forward-looking beat.
* Each prologue teaches the chapter's mechanic (`CHAPTERS[i].mechanic`) in at most 2 in-character lines.
* Choices are flavour only, with friendly options (never "mean" or romantic ones). At most one per episode.
* Banned in all story and lesson text (case-insensitive, whole words): `date`, `dating`, `kiss`, `crush`, `flirt`,
  `romance`, `romantic`, `sexy`, `bikini`, `swimsuit`, `lingerie`, `boyfriend`, `girlfriend`,
  `marry`, `wife`, `husband`, `blush`, `breast`, `thigh`, `waifu`, plus any age number
  next to a girl's name. Writers rephrase ("outing", "festival together").
* Monsters speak in short, funny lines. Hikari speaks at least once per episode.

---

## 5. Save model, API and edits outside the story area

### 5.1 `profile.story` (no SAVE_VERSION bump)

```js
story: {
  v: 1,
  legacy: false,                       // true = the save existed before this feature (migrated without a block)
  opening: 'pending' | 'seen' | 'skipped' | 'legacy',
  tutorial: 'pending' | 'done' | 'skipped' | 'legacy',
  welcome: 'pending' | 'mailed' | 'legacy',
  announced: false,                    // legacy one-time "journal is here" toast shown
  seen: string[],                      // scene ids done or skipped (≤ 500); first entry grants STORY_REWARDS
  queue: string[],                     // after-scenes waiting to play (≤ 10, unique)
  lessons: { [lessonId]: { at: number /*ms unlocked*/, quiet: boolean, read: boolean, claimed: boolean } },
  choices: { [sceneId]: number },      // flavour only
  prefs: { speed: 'slow'|'normal'|'fast'|'instant', auto: boolean },
}
```

### 5.2 `src/systems/story.js` (pure, Node-safe, no DOM; CONTRACTS §0)

```js
export const STORY_VERSION = 1, WELCOME_MAIL_ID = 'story-welcome-10pull';
export function newStory()                     // fresh save (createProfile)
export function legacyStory()                  // pre-story save: legacy everywhere
export function cleanStory(raw)                // non-object → legacyStory(); repairs enums, lists, caps; never throws
export function restoreStory(raw, counters, delivered) // migrateProfile: cleanStory, but no block + the 'story:new' mark = a new player's block
                                               // (an older build dropped it: opening/tutorial 'skipped', welcome pending unless delivered);
                                               // claimed lessons ('sl:<id>'), read scenes ('ss:<id>') and the legacy toast ('story:ann')
                                               // come back from their missions.counters marks, which older builds keep word for word
export function markStory(profile)             // migrateProfile: (re)writes those marks; claimLesson / markSeen / markAnnounced write them as they happen
export function storyOf(profile)               // lazy: profile.story ??= legacyStory(); returns it
export function clearedCampaign(profile)       // Set of campaign stage ids cleared (any difficulty)
export function onboardingRoute(profile)       // { name: 'scene', params: { id: 'opening', next: 'tutorial' } } | null
export function tutorialRoute()                // { name: 'battle', params: { stage: '1-1', difficulty: 'easy', tutorial: '1' } }
export function setOpening(profile, 'seen'|'skipped'), setTutorial(profile, 'done'|'skipped')
export function checkLessons(profile, now = Date.now())  // → { unlocked: id[], quiet: boolean, mailed: boolean }; idempotent
export function lessonList(profile)            // [{ ...LESSON, unlocked, read, claimed, claimable, requirement }]
export function readLesson(profile, id)        // → { ok, error?: 'locked'|'unknown' }
export function claimLesson(profile, id)       // → { ok, error?: 'locked'|'claimed'|'unknown'|'mailOnly', rewards }; adds items once
export function unreadLessonCount(profile), claimableLessonCount(profile)
export function featureOpen(profile, featureId) // 'gear' | 'awaken' (+ every lesson id)
export function featureLockText(featureId)
```

`src/systems/storyTriggers.js` (pure; the scene list is passed in):

```js
export function beforeSceneFor(profile, stageId, scenes)    // unseen + stage unlocked + not yet cleared → scene | null
export function queueAfterClears(profile, newlyCleared, scenes) // pushes 'after' scenes in campaign order; returns ids queued
export function nextQueued(profile, scenes)                  // first queued known id | null
export function markSeen(profile, sceneId, { skipped = false } = {}) // → { first: boolean, rewards }; removes from queue
export function recordChoice(profile, sceneId, index)
export function episodeList(profile, scenes)                 // archive rows { id, chapter, title, unlocked, seen, requirement, firstReward }
export function sceneUnlocked(profile, scene)                // trigger satisfied (before X → X unlocked; after X → X cleared; opening/tutorial → always)
```

### 5.3 Story UI entry points

`installStory({ store })` is called from `main.js` right after `store.load()` and the existing `onAppStart` block. It:
1. Applies `?onboarding=0`.
2. Runs `checkLessons` (quiet for legacy) and commits `story`.
3. Registers `window.addEventListener('screenchange', …)` to do these in order: the lobby redirect to the opening;
   the legacy announce toast; the queued after-scenes; the `before` scene for stage prep; the 1-1 tutorial prompt.
4. Registers `store.on('change', …)`. On reason `battle-result` it diffs the cleared set, queues after-scenes, runs
   `checkLessons`, and stores pending toasts. It ignores its own `story` commits.

### 5.4 Edits outside the story area (small, additive; one commit each so other branches merge cleanly)

| File (owner) | Edit |
|---|---|
| `src/main.js` (lead) | `registerRoute('story' / 'scene' / 'journal', …)`; `import('./ui/story/install.js').then((m) => m.installStory({ store }))` after the app-start block. About 5 lines. |
| `src/systems/save.js` (systems; feature/roster also edits it) | `import { newStory, cleanStory } from './story.js'`; in `createProfile` add `story: newStory()` and **remove `ticket_recruit10: 1`**; in `migrateProfile` add `p.story = cleanStory(raw.story)`. 3 lines. Update the createProfile test in `tests/systems/save.test.js` (L17). |
| `src/ui/screens/title.js` (meta-a) | In `go()`: navigate to `onboardingRoute(profile)` when set, else the lobby. In RESET67 (title and `commissions.js`): clear the title-seen key and `navigate('title')`. |
| `src/ui/screens/missions.js` (meta-a) | The Story tile goes to `navigate('story')` (drop `soon`) with a dot for unseen unlocked episodes. |
| `src/ui/screens/lobby.js` (meta-a) | Menu Tab `extra` gains "Story" and "Captain's Journal" (with dot) plus a dot on `top-menu`; `maybeShowBetaGift` is deferred while `onboardingRoute(profile)` or `window.__sakura.storyBusy`. |
| `src/ui/battle/controller.js` (battle-ui) | The `tutorial=1` coach import (§2.3). 1 block. |
| `src/ui/screens/student.js` (meta-b) | Equipment and Awakening tabs: `if (!featureOpen(p, 'gear'))` → story lock state (§3.3). About 4 lines. |
| `e2e/smoke.mjs`, `e2e/shot.mjs` | Smoke: fresh save → opening (Skip → confirm) → tutorial battle with the coach visible → Skip tutorial → lobby. `shot.mjs` appends `?onboarding=0`. |
| `CONTRACTS.md` §1 + new §11b, `README.md`, `docs/OWNER_REQUESTS.md`, `docs/ECONOMY.md` | Builder 3: the area row, API summary, features, statuses (T-01..T-03, G-08, K-02, L-02 partial). |
| Optional, meta-a, not required | Keep `settings` on RESET67 (K-02's second half). |

**Merge order note for the lead:** feature/roster bumps SAVE_VERSION to 3 and edits `createProfile`/`migrateProfile`.
The story lines are additive; keep both sides when resolving. The roster's starter list may change; the opening
uses `hikari`, `aoi` and `rei` by id, and the tutorial needs Aoi or any owned tower plus a hero.

---

## 6. Tests (`tests/story/*.test.js`, vitest, Node)

| id | File | What it checks |
|---|---|---|
| T-format-1 | `format.test.js` | `format.js` normalises say/narrate/cue/choice; unknown `face`/`fx`/`at`/`bg`/`music` throws at build time |
| T-content-1 | `content.test.js` | Unique scene ids; every `who` ∈ `UNIT_MAP` ∪ NPCS ∪ {narrator, sensei, unknown} (`ifUnit` lines exempt while missing); every NPC enemy id ∈ `ENEMY_MAP` |
| T-content-2 | | Every `bg` ∈ BACKGROUNDS; every `stage:` and trigger stage id ∈ `STAGE_MAP`; every `music` ∈ STORY_MUSIC; every portrait file for the cast exists in `public/art/portraits/` |
| T-content-3 | | Tokens resolve; **no bare roster names** in any text; ≤ 120 chars per line; 8–18 spoken lines (opening ≤ 20); ≤ 1 choice; ≤ 4 portraits; `heart` ≤ 1 |
| T-content-4 | | Content lint: the banned-word list (§4.5) over all scene and lesson text and choices |
| T-content-5 | | Each chapter 1–8 has prologue (ch1 = opening), mid (`before: 'X-5'`) and epilogue (`after: 'X-5'`); join scenes exist for 1-2 and 3-2; the archive order is complete |
| T-content-6 | | Choices have no effect: `recordChoice` changes only `story.choices`; a deep-equal snapshot of the profile is otherwise unchanged |
| T-save-1 | `save.test.js` | `createProfile().story` is new and `ticket_recruit10` is absent; `migrateProfile({...noStory})` → legacy; round trip through `serializeProfile`/`deserializeProfile` keeps the story; `cleanStory` repairs junk (bad enums, non-arrays, oversized lists, unknown lesson ids) and never throws; `SAVE_VERSION` is untouched by this branch |
| T-lessons-1 | `lessons.test.js` | 12 lessons, unique ids, non-decreasing unlock stages, valid action routes (registered names), reward ids ∈ ITEMS ∪ {coins, gems}, each gem reward ≤ 100 and total ≤ 600 |
| T-lessons-2 | | `checkLessons` is idempotent; unlock order follows clears; `claimLesson` pays once (`claimed` the second time) and `locked` before unlock; `readLesson` marks read |
| T-gates-1 | `gates.test.js` | New save: `gear` closed until 2-1 and `awaken` until 3-2; gear opens early with owned gear or a gearbox; awaken opens early with `awaken > 0` or a crown; legacy: every feature open with 0 clears |
| T-welcome-1 | `welcome.test.js` | **No double grant.** New save with 0–2 clears → no mail; 1-3 cleared → exactly one mail with `ticket_recruit10 ×1`; `checkLessons` ×3 → still one; migrate round trip → still one; legacy with 5 clears → `welcome === 'legacy'` and no mail; legacy with 0 clears that later reaches 1-3 → no mail; `mail.delivered` contains the id while `welcome === 'pending'` (odd import) → no mail; `store.reset()` equivalent (`createProfile`) → pending again |
| T-trig-1 | `triggers.test.js` | `beforeSceneFor`: unseen + unlocked + uncleared only (legacy with cleared stages → null); `queueAfterClears` puts epilogues in campaign order without duplicates; `markSeen` grants `STORY_REWARDS` once (replay → 0; skip counts); the queue drops seen and unknown ids; `episodeList` lock texts |
| T-trig-2 | | Onboarding: new save → `onboardingRoute` = opening; after `setOpening('skipped')` → null; legacy → null; tutorial `pending` stays after quit; `setTutorial('done')` is never auto again |
| T-coach-1 | `coach.test.js` | `coachSteps.nextStep` over synthetic snapshots: place → start → hero (gated by cash/between) → upgrade → speed; ult preempts once ready; `free` after core steps; `lost` on defeat |
| T-coach-2 | | Coach target selectors exist in the battle UI source (`data-testid` strings: card-, start-wave, buy-, speed, ult, result, home) to catch renames |
| T-coach-3 | `tutorial-sim.test.js` | Headless 1-1 Easy: Aoi placed at the coach's suggested spot, Hikari placed after wave 1, Aoi tier-1 after wave 1 → **wins**, and Hikari reaches ult unlock before the last wave. Reports, does not tune the sim. |
| T-bundle-1 | `bundle.test.js` | `src/systems/story.js` and `save.js` do not import `src/data/story/scenes/**` (keeps the main chunk small) |
| E-story | `e2e/story.mjs` | At 844×390 (touch) and 1280×720: fresh save → opening plays (type-on, tap advance, choice, log, auto, skip-confirm), reduced-motion variant (instant text, no transforms), tutorial coach step 1 shows the hand, a real drag completes it, start-wave completes step 2, Skip tutorial → lobby; journal opens and shows NEW; archive plays `ch1.mid` after a seeded save; screenshots in `scratchpad/story/shots/` for the critic |
| E-smoke | `e2e/smoke.mjs` | The updated fresh-save flow (§5.4) passes in dev and `--prod` |

---

## 7. Build order (3 sequential builders; each ends green on `npx vitest run`, `npx vite build`, the smoke test, then commits)

Shared machine: foreground commands with timeouts, no servers left running, never commit `node_modules`, never
push. Each builder runs a screenshot-critic pass at 844×390 and 1280×720 before committing (owner process X-03).

**Builder 1 — foundations, save, opening, player** (biggest risk first)
1. `src/data/story/{format,backgrounds,music,lessons,index}.js`, `scenes/opening.js` (§2.2), `scenes/ch1.js` with
   `tut.outro`, `ch1.yuki`, `ch1.mid` and `ch1.epi` written to §4.4.
2. `src/systems/story.js` + `storyTriggers.js`; the `save.js` hooks; update the save test.
3. Player (`player.js`, `emotes.js`, `story.css`, `scene.js` route) with type-on, Auto, Skip+confirm, Log, choices,
   Hide, reduced motion, paint and CG backgrounds (stage stills fall back to the academy tint for now).
4. `install.js`: onboarding redirect, `?onboarding=0`, queue playback on screenchange, before-scenes on stage prep,
   the battle-result diff. `main.js` routes. Title hand-off + RESET67 → title. Archive screen (minimal: chapters,
   cards, play, lock states). Missions hub Story tile.
5. Tests T-format, T-content (for the scenes written so far), T-save, T-trig, T-bundle; smoke update.
   **Acceptance:** a fresh save reaches the opening from the title and from a lobby deep link; Skip works; a legacy
   save sees nothing forced; `ch1.mid` plays on 1-5 stage prep; `ch1.epi` plays after the 1-5 clear;
   screenshots of the player at both sizes are critic-approved.

**Builder 2 — tutorial coach, Captain's Journal, gates, welcome pull**
1. `coachSteps.js` + `coach.js` + the controller hook; drag-hand spot finder; outro over results; defeat bubble;
   the 1-1 prep prompt for an unfinished tutorial; tests T-coach-1..3 (report T-coach-3 numbers in the commit).
2. Journal screen (`#/journal`) + `toast.js` + lobby Menu Tab entries and dots + legacy announce toast; lesson
   claim through `showRewardsModal`.
3. `checkLessons` wiring with the welcome mail; student Equipment/Awakening locks; tests T-lessons, T-gates,
   T-welcome.
4. `e2e/story.mjs` (tutorial and journal parts). **Acceptance:** a new player is coached through all 5 actions on a
   real phone-size viewport, the journal unlocks lessons 1–4 by 1-3 with exactly one welcome mail, and a legacy
   save shows all features plus one summary toast.

**Builder 3 — chapters 2–8, stage stills, music, docs**
1. Write `scenes/ch2.js` … `ch8.js` (19 episodes) following §4.2–4.5. Run T-content after each chapter. Have a
   critic read each chapter for tone, the content rules and voice consistency.
2. Stage-still backgrounds (`backdrop.js` via `createBattleRenderer`, one WebGL context at a time, cache, fallback)
   + `music.js` audio hook (no-op without audio).
3. Archive polish (thumbs, cast heads, first-read chips), the episode title card, the lesson "Hikari explains" mini-scenes
   (optional; `home`, `recruit` and `gear` first).
4. Docs: CONTRACTS §1 area row + §11b story API, README (Story, Journal, tutorial), OWNER_REQUESTS statuses,
   ECONOMY.md one-time rewards, INTEGRATION_NOTES (the audio route request; merge notes for roster and save).
   **Acceptance:** all 27 episodes are reachable in the archive on a fully cleared seeded save; the full suite, build
   and smoke pass; chapter screenshots (one per chapter, both sizes) are critic-approved.

---

## 8. Risks and questions for the owner (none block Builder 1)

1. **"Sensei" vs "Captain" for the player.** The spec keeps the new game's "Sensei" (D1). If the owner prefers the old
   game's "Captain" for the player, Hikari's own title needs a rename. It is one token change (`{sensei}`) if we
   add it now; Builder 1 can route the player's name through a `PLAYER_TITLE` constant.
2. **The 10× ticket moves from account creation to 1-3** (D6). New accounts before Nov 7 still get five from the
   Beta gift. Confirm the owner is fine with this pacing.
3. **The tutorial runs on 1-1 Easy**, so a new player's first medal is bronze. The alternative is Normal with
   the coach. Easy is safer for a first battle.
4. **Content risks outside this area** (for the lead, not changed here): a lobby head-pat line ("W-what are you
   doing, Sensei?! …I don't mind.") and bond backgrounds named "Café Date" lean romantic for student characters (renamed "Café Afternoon" in v0.1.54).
   Suggest "outing" wording and a neutral line, in keeping with the content rule.
5. **Stage stills** depend on the renderer working headless-ish off-screen. If it misbehaves on low-end phones,
   chapter backgrounds fall back to academy tints. That is ugly-free, but less varied.

---

## 9. Build notes: player + story system (builder "player")

Shipped: `src/systems/story.js` (state, legacy rule, onboarding, prefs), `src/systems/storyTriggers.js` (before/after
triggers, queue, `markSeen` + first-read gems, archive rows), the `save.js` hooks (`story: newStory()` in `createProfile`,
`cleanStory(raw.story)` in `migrateProfile`; no SAVE_VERSION bump), `src/ui/story/{player,emotes,backdrop,music,play,scene,archive,install}.js`,
`src/ui/styles/story.css`, routes `#/scene/<id>` and `#/story`, the title hand-off to the opening, RESET67 → title,
the missions hub Story tile (+ NEW dot), a lobby Menu Tab "Story" entry, the beta-gift deferral while a scene plays,
`e2e/story.mjs`, the smoke update and `?onboarding=0` in `e2e/shot.mjs`. Tests: `tests/story/system.test.js`,
`tests/story/player.test.js`.

Differences from §1–§5 worth knowing:
* Archive chapter tabs are a horizontal strip above the cards (Hikari's stand keeps the bottom-left), not a left column.
* Lock texts read "Clear 2-4 Sunscale Ferry" (`Clear <id> {stage:<id>}`); a `before` scene unlocks with its stage.
* Text speed (Slow / Normal / Fast / Instant) lives in the Log sheet header; Auto and speed persist in `story.prefs`.
* `markSeen(profile, scene, { skipped })` takes the scene object (or an id plus `kind`) and also records the opening.
* The startup bundle grows by about 9 KB raw / 4.6 KB gzip (lessons.js text + story.js); scene text stays in its own chunk.

Not built here (next builders): `checkLessons` / `claimLesson` / `featureOpen` / the welcome mail (so `createProfile` still
grants `ticket_recruit10: 1`), the journal screen and toast, the tutorial coach + `tut.outro` over the results, the 1-1
prep prompt, stage stills (`setStageStillProvider` in `backdrop.js` is the hook; stage backgrounds use the chapter's
academy tint meanwhile), and the docs pass (CONTRACTS, README, OWNER_REQUESTS).

## 10. Build notes: opening flow + tutorial coach (builder "opening")

Owner update (Oct 13): the opening, the tutorial and Chapter 1 stay at the academy as written; the story meets the
fantasy world in Chapter 2 (later builder work). Nothing in this step depends on that.

Shipped: `src/ui/story/coachSteps.js` (pure step machine, drag-hand spot finder, formation-aware copy), `src/ui/story/coach.js`
(scrim with spotlight holes, pulsing ring, ghost drag hand, Hikari's bubble with [–] → "Hikari's tips" pill and
[Skip tutorial] → confirm; outro over the victory sheet, then an inline Hikari card pointing at Rewards, then Home;
defeat card with [Retry with Hikari] / [Skip tutorial]; the 1-1 prep prompt), `src/ui/styles/coach.css`,
`src/data/story/tutorial.js` (all coach copy), `tutorialPromptDue()` in `src/systems/story.js`, the one-block
`tutorial=1` hook in `src/ui/battle/controller.js`, the prompt wiring in `install.js`. Tests:
`tests/story/coach.test.js` (T-coach-1, T-coach-2, spots, prompt rule) and `tests/story/tutorial-sim.test.js`
(T-coach-3). E2E: `e2e/tutorial.mjs` (both viewports) and the smoke update (fresh save → opening Skip → coach
visible → Skip tutorial → lobby).

T-coach-3 (headless 1-1 Easy, new-save formation Aoi + Rei, hero Hikari; Aoi on the hand's spot, Hikari and Aoi's
cheapest tier 1 after wave 1, nothing else bought): won on seeds 1–3 with 150/150 lives; Hikari's ultimate unlocks
on wave 6 of 12, so step 6 always gets its moment. Nothing to report to feature/balance-playtest.

Differences from §2.3–§2.4 worth knowing:
* A shown core step stays up until it is done (the ultimate may cut in once, then the waiting step comes back).
  The upgrade step also opens from wave 3 without a pause, so a player who never waits between waves still sees it.
* The upgrade bubble has a [Show Aoi] button that selects her (the ring follows: Aoi on the board → the cheapest
  tier-1 buy button the player can see; on a phone the panel's own scroller is moved if every option is below the fold).
* The scrim fades after 12 s on one step and never shows while a girl is being dragged; the ring and bubble stay.
* The ring and bubble jump onto their first target and glide only between targets.
* After the outro, Hikari's card sits inside the result sheet ("Let's see what we earned!" with Rewards pulsing,
  then "Let's go home" with Home pulsing). Next Stage and Map still work.
* A win counts even if the player leaves before the outro (the coach's cleanup marks the tutorial done).
* `e2e/tutorial.mjs` polls on a 200 ms timer and reads the ring's target geometry, because SwiftShader on a loaded
  machine can go seconds without a frame (rAF-based polling and CSS transitions stall).

Not built here (next builder): the Captain's Journal, lesson toasts, feature gates, the welcome 10-pull mail.

## 11. Build notes: Builder 2 finished — merge with live, coach polish, Captain's Journal, gates, welcome pull

Merged live (`claude/sakura-sentinels`, 91 commits: online/co-op, music, versions, navigation, camera lock, salvage)
into this branch. Conflicts were all additive and kept both sides: `src/main.js` (online + sound-test routes next to
`scene`/`story`), `title.js` (live's `buildInfo` version + `onboardingRoute`), the lobby Menu Tab (Story next to Clan /
Co-op / Chat), the missions hub (live's Co-op tile + the working Story tile, subtitle shortened to "Episodes" to fit the
shared bottom row) and `e2e/smoke.mjs` (story archive + online screens). Story touches nothing in `src/sim` or the
co-op graph: `tools/simId.mjs` gives the same id on both branches.

Shipped:
* **Journal logic** in `src/systems/story.js`: `checkLessons` (idempotent; legacy unlocks are `quiet`),
  `lessonUnlocked`, `lessonList`, `readLesson`, `claimLesson` (`mailOnly` for the recruit lesson), `unreadLessonCount`,
  `claimableLessonCount`, `journalDot`, `featureOpen` / `featureLockText` / `featureStage`, `deliverWelcome`,
  `legacyAnnounceDue`. `story.js` now also imports `units.js`, `mail.js` and `inventory.js`, which `save.js` already
  pulls in, so the startup chunk does not grow beyond the code itself; the scene chunk stays lazy (T-bundle-1).
* **Welcome 10-pull:** `createProfile` no longer grants `ticket_recruit10`. `deliverWelcome` mails it when 1-3 is
  cleared, only while `story.welcome === 'pending'` and the id is not in `mail.delivered` (an odd import with a reset
  welcome state just flips to `mailed`). Legacy saves stay `welcome: 'legacy'` and are never mailed.
* **Journal screen** `src/ui/story/journal.js` (`#/journal?id=`), styles in `src/ui/styles/journal.css`: the lesson
  list on the left (number, icon, title or ???, "Clear 1-3 Sprinting Gold" or ✓, NEW and gift chips), Hikari's page on
  the right (bust + speech panel, reward tiles, Claim → `showRewardsModal`, Show me, Hikari explains, Open Mail for the
  welcome lesson while the letter is unclaimed; legacy saves read "You received this ticket when you joined").
  Header: Replay battle tutorial ("Tutorial" on phones). At 844×390 both panes stay side by side; portrait collapses
  to a strip.
* **Unlock moments** (`install.js` + `toast.js`): `checkLessons` runs at app start, on `battle-result` / `replace` and on
  every screen change (so the tutorial ending opens "Welcome home"). New lessons queue Hikari's toast pill, shown on the
  next calm non-battle screen after any queued scene (never over a modal, never on battle / title / scene / journal);
  a tap opens the journal on that lesson. Legacy saves get one 6 s summary toast on their first lobby visit
  (`story.announced`). Dots: the lobby Menu button and the Menu Tab "Captain's Journal" entry (`menuTabModal` entries
  accept `dot`).
* **Feature gates:** Student → Equipment and Awakening show Hikari's lock (her face, "Equipment unlocks after 2-1
  Moonlit Landing — Hikari will teach you!", [Go to 2-1]) and a lock on the tab, on new saves only, until 2-1 / 3-2
  or until the profile shows gear, a gear box, an awakened girl or a crown. The Backpack and Menu → Equipment stay open.
* **Coach polish:** the "Let's go home" card now sits above the rewards list (it was hidden under the sticky action
  row). All coach targets were re-checked on the merged battle UI at both sizes.
* **Audio:** live's music director takes `{ stem: level }`; the story hook now normalises cue stem lists and the
  restore snapshot (`state()` gives `{ target, value }`), which had produced NaN gains after a scene (`stemMix`).
  Every story cue resolves against `public/audio/music/manifest.json`.

Tests: `tests/story/journal.test.js` (T-lessons-2, T-gates-1, T-welcome-1, plus two saves written by the live game in
`tests/story/fixtures/live-saves.json`: fresh and mid-game, both load as legacy with nothing forced, lost or granted
twice), `stemMix` in `player.test.js`; `e2e/story.mjs` gained the journal, the welcome mail (exactly one, also after a
reload), the gear lock and the legacy summary toast. `tests/systems/gacha.test.js` gives its profile the ticket
explicitly now that `createProfile` does not.

T-coach-3 on the merged sim (Aoi on the hand's spot, Hikari and Aoi's cheapest tier 1 after wave 1): won on seeds
1–3 with 150/150 lives; Hikari's ultimate unlocks on wave 6 of 12. Nothing to report to balance.

Differences from §3 worth knowing:
* Lock and requirement texts name the stage id as well as its name ("Clear 2-1 Moonlit Landing"), like the archive.
* `featureOpen` reads the unlock condition directly, so a gate opens the moment the stage is cleared, before
  `checkLessons` has recorded the lesson.
* Claiming a lesson also marks it read.

## 12. Open questions for the owner and Builder 3

**New direction (owner, 2026-10-14): Chapter 1 is the fantasy era; Chapter 2 onward is modern academy
life.** This reverses the Oct 13 note in §10 (academy first, fantasy from Chapter 2). Nothing built so far depends on
it, but the next story pass needs answers to:
1. **Framing.** Is Chapter 1 a prologue in the past (a "fantasy era" before the academy existed, told as a legend or
   Hikari's memory), or the same time in a different place? Does Sensei exist in the fantasy era?
2. **The opening and tutorial** ("Meet Hikari", the 1-1 coach, "First Petals") are set at Sakura Academy today. Keep
   them as the academy-day framing that then flashes back to Chapter 1, or rewrite them into the fantasy era?
3. **Chapter 1 episodes already written** (`ch1.yuki`, `ch1.mid`, `ch1.epi`) are academy scenes. Rewrite them for the
   fantasy era, or move them later?
4. **Chapters 2–8 battle maps are fantasy places** (lakeshore, shrine, mountain pass, marsh, foundry, festival,
   volcano). How should academy life meet them: school trips / club expeditions, or new academy-side maps (a
   balance-playtest and maps question)?
5. **Hikari, Luna and Nami** are adults. In academy life are they staff or guardians (the bible's current answer), and
   do they also appear in the fantasy era (the same people, or ancestors)?
6. **The journal and lesson texts** say "home base", "academy" and "Sensei". Fine for both eras?
7. **Content rule for academy life:** students stay students (classes, clubs, homework, festivals). Wholesome only,
   no romance, no fanservice framing and no swimsuit episodes. This rules out a beach-swimsuit event. A beach day in
   ordinary summer clothes is fine.
8. Still open from §8: the player name ("Sensei" vs "Captain"), the welcome pull at 1-3, and the tutorial on Easy.
