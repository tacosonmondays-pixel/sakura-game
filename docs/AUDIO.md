# Sakura Sentinels — Audio Design

Owner request (2026-10-08, verbatim): *"No music or sound too. Use the music engine we created for Kai game
use Toby style nes earthbound sound font like you did for that game custom new music forget about copy right
for now we're just in alpha 2 anyways and it's only between friends for now"*.

This document is the contract for the **audio** area (branch `feature/audio`). It covers where audio hooks
into the game, the offline music/SFX toolkit (`tools/audio/`), the in-game playback engine (`src/audio/`),
the soundtrack plan with its leitmotifs, the SFX list, and the review tooling. Everything here is
**original music**. The owner's copyright waiver covers soundfont *samples* in this private alpha (the
private "Toby" palette). It does not cover compositions: we never quote or paraphrase existing songs.

**At a glance**

| | |
|---|---|
| Music | Not a live synth. Songs are written as note data (Python DSL or JSON) → MIDI → FluidSynth with a soundfont **palette** → stems (WAV) → numpy mix (SNES echo, optional crush, loudness) → Opus `.webm` + AAC `.m4a` → `public/audio/music/` + `manifest.json` |
| Palettes | `cleared` (GeneralUser GS + our CC0 `sakura-chip.sf2`, works now), `strict` (FluidR3 GM, MIT + `sakura-chip`), `toby` (owner's private EarthBound + SGM soundfonts, slot ready) and `chip` (all-NES joke mode). `--palette toby` re-renders every song with only a JSON swap |
| Playback | WebAudio: one AudioContext (32 kHz), master/music/sfx buses, a music director with sample-locked stems, gapless head+loop scheduling, bar-quantised transitions, stingers, ducking, and a pooled SFX sprite player with rate limits for 3× speed |
| Hooks | Mostly zero-touch: `screenchange`, `store.on('change')`, delegated clicks and a body MutationObserver. Small explicit hooks: 1 line in `main.js`, 3 in `controller.js`, 2 in `placement.js`, 7 in `recruit.js`, about 6 in `settings.js` and 4 in `save.js` |
| Soundtrack | 12 looping tracks (5 battle families + boss + final boss, each with base + intensity stems) + about 18 jingles and stingers, built around the **Sakura Bell** music-box motif and an original main theme |
| SFX | 84 offline-rendered SFX ids (P1 core: 60, P2 polish: 24) in one sprite, tuned short and clean, Deltarune-style |
| Budget | ≤ 25 MB of music in the repo for both formats together (Opus ≈ 10.5 MB, AAC ≈ 12 MB). A player downloads only one format and only per screen. SFX sprite ≤ 300 KB |

---

## Status: pipeline + engine built (2026-10-08, `feature/audio`)

Milestones A1-A5 of §7 are done, plus the Sound Test of §6.6. **Round 2 (2026-10-09): the whole soundtrack of
§4.4 is composed, rendered with the `cleared` palette and shipped** — 31 tracks, no stand-ins (§S.5). *Roll Call*
(§S.3) is now only the palette audition; `ship all` no longer publishes it.

### S.1 What exists

| Area | Files | Notes |
|---|---|---|
| Toolkit setup | `tools/audio/requirements.txt`, `setup_venv.sh`, `fetch_soundfonts.py`, `make_chip_sf2.py` | GeneralUser GS fetched by `git` at the pinned commit, size + SHA-256 checked, licence copied next to it; FluidR3 fallback; `sakura-chip.sf2` (CC0) is generated deterministically |
| Song → MIDI | `sakura_audio/notation.py`, `theory.py`, `song.py`, `gen.py`, `midi.py`, `songs/motifs.py` | Python DSL or JSON (`Song.from_dict`), bar validator, chord-symbol generators, motif markers, tempo snap |
| Palettes | `palettes/cleared.json` (shipped), `strict.json`, `chip.json`, `toby.json` + `sakura_audio/palette.py` | 116 roles (81 + 35 genre roles in round 3, §2.4). `toby` points at `${SAKURA_PRIVATE_SF2}/earthbound.sf2` + `sgm.sf2`; without them every role falls back to `cleared` with a warning |
| Render + mix | `render.py`, `mix.py`, `fx.py`, `encode.py`, `checks.py`, `pipeline.py` | FluidSynth jobs per (stem × font × echo send × part fx), cached by hash; per-part filter / drive / sidechain pump (round 3, §2.4.2); SNES echo, lowpass, optional crush, one loudness gain for all stems, exact head + loop-body file, Opus + AAC, gates |
| SFX | `sfx/synth.py`, `sfx/recipes.py` (84 ids), `sfx/sampled.py`, `sfx/sprite.py` | one mono sprite + `sprite.json` |
| Review | `sakura_audio/review.py` | piano roll (motif boxes), waveform with loop points, seam plots (WAV + both decodes), spectrogram, gate report, SFX contact sheet, `index.html` |
| CLI | `studio.py fetch / list / roles / presets / midi [--roll] / render / sfx / review / ship` | `ship` is the only command that writes `public/audio/`, and only when every gate passed |
| Python tests | `tools/audio/tests/` (60 tests) | notation, loop layout + tempo snap, echo impulse response, SF2 round trip through FluidSynth (pitch per program, band-limiting, kit), palettes (inheritance, toby fallback, every role played by the demo, every preset and drum name exists in its font), song model, swing options, part effects (`test_fx.py`: SVF vs a per-sample reference, drive, pump, periodic curves, a FluidSynth render with all three effects passing the seam gates) |
| Engine | `src/audio/` `cue`, `index`, `engine`, `loader`, `music`, `sfx`, `limiter`, `loopMath`, `routes`, `cues`, `battle`, `economy`, `domSfx`, `soundTest` | as §3; battle stings, jingles and the boss track two waves ahead are preloaded; a sting that is still decoding 0.75 s after its moment is skipped instead of playing late |
| Hooks | §1.9, all in place | plus `registerRoute('soundtest', …)` in `main.js` and a *Sound test* row in Settings → Audio |
| JS tests | `tests/audio/` (7 files, 64 tests) | loop math, manifest + budgets + sprite ids, routes, battle state machine + SFX mapping, limiter, economy, director on a fake WebAudio graph, battle preloads |
| Browser check | `e2e/audio.mjs` | unlock on first tap, lobby music, menu stem fade without restart, seams of the shipped Opus files measured in Chromium, battle switch + intensity on wave start + prompt sting, SFX, pause duck, Music off/on, memory, no console errors |

Not built yet: `kai_import.py` (needs Kai's file format). `originality.py` (§6.5) exists since round 2.

### S.2 Commands

```
sh tools/audio/setup_venv.sh                              # venv + pinned pip packages + soundfonts (AUDIO_VENV to relocate)
PY=tools/audio/.venv/bin/python
$PY tools/audio/studio.py list                            # songs, stems, durations, size estimate
$PY tools/audio/studio.py roles --palette toby            # where every role comes from (+ fallback warnings)
$PY tools/audio/studio.py presets eb --palette toby       # presets inside the private EarthBound font
$PY tools/audio/studio.py midi demo --roll                # GM preview MIDI + piano roll
$PY tools/audio/studio.py render all                      # every song: stems → mix → loop file → encode → gates
$PY tools/audio/studio.py render all --palette toby       # same songs through the Toby fonts (build/toby/, not shipped)
$PY tools/audio/studio.py sfx                             # SFX recipes → sprite (also copied to public/audio/sfx/)
$PY tools/audio/studio.py review all                      # build/<palette>/review/index.html
$PY tools/audio/studio.py originality                     # blocklist of famous hooks + shared-phrase scan (§6.5)
$PY tools/audio/studio.py ship                            # gates + budgets, then public/audio/music/ + manifest + probes
                                                          # ('all' skips the demo* auditions and prunes stale tracks)
$PY -m unittest discover -s tools/audio/tests -t tools/audio/tests
npx vitest run tests/audio && node e2e/audio.mjs
```

### S.3 The demo tune and its measurements

*Roll Call* (`tools/audio/songs/demo.py`, original): a melody passed around the band one bar at a time, so
every one of the 81 round-2 palette roles plays at least once (a unit test checks this; round 3 adds
`demo_genres`, which plays the 35 genre roles and the part effects, §2.4.2). It is rendered four ways:

| Track | Layout | Length | Opus | AAC | Stands in for |
|---|---|---|---|---|---|
| `demo` (F, 112 swing) | loop, `base` + `melody` | 2 + 16 bars, file 41.6 s | 623,365 B | 602,340 B | title, homeroom, march, wishing, mall, results |
| `demo_battle` (G, 144) | loop, `base` + `intensity` | 2 + 16 bars, file 33.3 s | 405,615 B | 466,692 B | `battle_*`, boss, final |
| `demo_sting` | one-shot (stinger, −18 LUFS) | 3.8 s | 23,414 B | 31,756 B | wave stings, miniboss, boss warning, gacha R |
| `demo_victory` | one-shot (jingle, −15 LUFS) | 5.5 s | 42,323 B | 45,751 B | victory, level-up, awaken, new student, gacha SR/SSR |

Music total 1.09 MB Opus + 1.15 MB AAC; the SFX sprite (84 sounds, 39.8 s mono) is 187 KB Opus + 238 KB AAC.
Loops: −16.0 LUFS, true peak −2.4 / −2.9 dBTP (no peak limiting needed). Every gate of §6.1 passes for all four
renders (`review all`: 14/14 for the loops, 7/7 for the one-shots).

SFX balance, measured by `review sfx` (momentary loudness compensated to each sound's length, plus its
`gain_db`): the median UI blip is 1.7 LU *louder* than the median battle hit, not the 6 LU quieter that §6.1
aimed for. That aim was a guess; hits fire many times a second, so they were left soft on purpose. It is a
`gain_db` change in `sfx/recipes.py` once someone has listened on a phone (Sound Test pads).

| Seam check | `demo` | `demo_battle` |
|---|---|---|
| Cycle 1 vs cycle 2 after the seam (render determinism) | −69.9 dB | −67.8 dB |
| WAV loop wrap / entry vs the continuous render (1 s each side) | −82.9 / −71.4 dB, click ratio 1.00 / 1.05 | −70.5 / −68.7 dB, 1.00 / 1.00 |
| ffmpeg-decoded Opus: alignment, wrap / entry (codec noise) | lag 0, −36.5 / −36.0 dB (noise −37.5) | lag 0, −34.3 / −35.5 dB (noise −34.2) |
| ffmpeg-decoded AAC: alignment, wrap / entry (codec noise) | lag 0, −35.9 / −34.5 dB (noise −37.0) | lag 0, −33.7 / −30.9 dB (noise −33.3) |
| Chromium `decodeAudioData` (Opus) + the engine's own head/loop schedule in an `OfflineAudioContext`, 32 and 48 kHz | decoded length = file length to the sample; no click at the entry or either wrap (click ratio ≤ 1.0); differences sit at the codec-noise level of the surrounding music | same, click ratio ≤ 1.07 |

A "click ratio" is the 2nd-difference energy at the seam against the median of the surrounding audio,
relative to what the continuous music does there (1.0 = no click; the gate is < 3). AAC on iPhone / Android
cannot be measured here: open **Settings → Audio → Sound test** on the phone and use the *3 s before loop
seam* / *3 s before entry* buttons; the page also shows which format the probe picked and its Δ.

### S.4 Credits

- **GeneralUser GS** v2.0.3 by S. Christian Collins (GeneralUser GS License v2.0), fetched from the
  author's repository, never committed. Used by the `cleared` palette.
- **FluidR3_GM** by Frank Wen (MIT), the installed fallback and the `strict` palette.
- **sakura-chip.sf2**, the NES-style chip font, and every composition and SFX recipe: made for this game,
  CC0 for the font. `public/audio/CREDITS.md` ships the same list.

### S.5 Round 2: the soundtrack ships (critic round 1 fixes)

**Shipped** (`public/audio/music/manifest.json`, `cleared` palette, built 2026-10-09). LUFS / true peak after
the mix; "seam" = worst Opus wrap/entry difference against the continuous render (codec noise level) and the
click ratio (gate < 3). Every gate of §6.1 passes for every track.

| Track | Kind | bpm / key | Intro + loop | LUFS | TP dBTP | Opus | AAC | Opus seam / click |
|---|---|---|---|---|---|---|---|---|
| `title` | loop | 132 / F | 7.3 + 43.6 s | -16.0 | -1.8 | 390,545 | 447,299 | -33.8 dB / 1.0 |
| `battle_blossom` | loop (base, intensity) | 150 / D | 3.2 + 64.0 s | -16.1 | -1.0 | 960,576 | 1,030,675 | -35.7 dB / 1.14 |
| `homeroom` | loop (base, melody) | 96 / F | 5.0 + 60.0 s | -16.0 | -1.3 | 1,009,431 | 958,522 | -40.4 dB / 1.13 |
| `march` | loop (base, prep) | 120 / Bb | 4.0 + 64.0 s | -16.0 | -2.0 | 895,665 | 1,026,516 | -34.3 dB / 1.02 |
| `battle_moonlit` | loop (base, intensity) | 126 / Am | 3.8 + 61.0 s | -16.0 | -2.3 | 947,050 | 973,485 | -35.6 dB / 1.06 |
| `battle_lantern` | loop (base, intensity) | 112 / E phrygian | 4.3 + 60.0 s | -16.2 | -1.0 | 841,151 | 980,306 | -35.5 dB / 0.93 |
| `wishing` | loop (base, riser) | 84 / E | 5.7 + 45.7 s | -16.0 | -1.0 | 678,813 | 763,322 | -35.6 dB / 0.97 |
| `mall` | loop | 108 / G | 2.2 + 53.3 s | -16.3 | -1.0 | 401,440 | 483,047 | -37.0 dB / 1.02 |
| `battle_ironclock` | loop (base, intensity) | 152 / G dorian | 3.2 + 63.2 s | -16.0 | -2.0 | 923,556 | 1,014,624 | -35.3 dB / 1.03 |
| `battle_matsuri` | loop (base, intensity) | 160 / Cm | 3.0 + 60.0 s | -16.0 | -3.3 | 886,776 | 959,110 | -36.3 dB / 1.09 |
| `victory` | oneshot | 132 / F | 5.6 s | -15.0 | -2.6 | 41,310 | 46,540 | — |
| `defeat` | oneshot | 108 / Fm | 8.0 s | -15.0 | -4.3 | 49,644 | 66,072 | — |
| `levelup` | oneshot | 150 / Ab | 2.8 s | -15.0 | -3.3 | 26,174 | 23,724 | — |
| `gacha_r` | oneshot | 120 / E | 3.0 s | -18.0 | -2.6 | 24,499 | 26,926 | — |
| `gacha_sr` | oneshot | 120 / E | 4.6 s | -15.0 | -2.7 | 37,745 | 38,326 | — |
| `gacha_ssr` | oneshot | 120 / G | 7.8 s | -15.0 | -2.0 | 53,090 | 64,159 | — |
| `boss` | loop (base, intensity) | 168 / Dm | 5.7 + 62.9 s | -16.0 | -3.3 | 903,980 | 1,045,742 | -32.6 dB / 0.99 |
| `wave_blossom` | oneshot | 150 / D | 2.0 s | -18.0 | -5.8 | 15,265 | 17,549 | — |
| `wave_moonlit` | oneshot | 126 / Am | 2.9 s | -18.0 | -6.1 | 20,312 | 24,362 | — |
| `wave_lantern` | oneshot | 112 / E phrygian | 2.7 s | -18.0 | -4.8 | 19,070 | 22,433 | — |
| `wave_ironclock` | oneshot | 152 / G dorian | 2.0 s | -18.0 | -5.2 | 12,682 | 16,879 | — |
| `wave_matsuri` | oneshot | 160 / Cm | 1.9 s | -18.0 | -7.1 | 12,886 | 16,428 | — |
| `final_wave` | oneshot | 120 / C | 3.5 s | -18.0 | -4.7 | 22,188 | 29,854 | — |
| `miniboss` | oneshot | 140 / Dm | 3.9 s | -18.0 | -4.2 | 26,705 | 32,494 | — |
| `boss_warning` | oneshot | 168 / Dm | 3.2 s | -18.0 | -3.9 | 28,659 | 27,261 | — |
| `final` | loop (base, intensity) | 176 / Em | 5.5 + 54.5 s | -16.0 | -2.2 | 802,075 | 918,169 | -33.8 dB / 1.02 |
| `results_win` | loop | 96 / F | 0.0 + 20.0 s | -16.0 | -1.6 | 171,681 | 192,851 | -37.4 dB / 1.0 |
| `results_lose` | loop | 84 / Dm | 0.0 + 22.9 s | -16.0 | -2.5 | 184,251 | 219,031 | -38.4 dB / 1.27 |
| `awaken` | oneshot | 120 / Ab | 5.9 s | -15.0 | -1.9 | 39,068 | 48,799 | — |
| `new_student` | oneshot | 150 / E | 3.9 s | -17.0 | -5.7 | 29,763 | 32,864 | — |
| `boss_warning_hold` | loop | 168 / Dm | 0.0 + 5.7 s | -18.0 | -4.8 | 86,013 | 75,019 | -34.5 dB / 0.99 |

Total: Opus 10,542,063 B, AAC 11,622,388 B (budgets 11 / 13 / 25 MB). SFX sprite: 84 sounds, 192 KB Opus + 242 KB AAC.

**What changed in round 2**

| Area | Change |
|---|---|
| New songs | `final` (Ashwing Matriarch: own E-minor hook, 3+2+2 bridge where SHADOW and the SENTINEL CALL trade bars, main theme in G with the Bell **answered**, rising push), `results_win` (After School), `results_lose` (Petals on the Path: the Bell hangs twice in D minor, answered in F), `awaken`, `new_student` (the Wishing question answered at last), `boss_warning_hold` (4-bar alarm loop, see §3.5). `standins.json` is empty |
| SNES character | `cleared` now treats the sampled GM voices like S-DSP samples: an 11.5 kHz band limit plus parallel BRR-style 4-bit block grit (mix 0.12; drums 0.10; chip voices untouched) — `mix.voices` in the palette, `mix.py brr_crush / voice_fx`. Kits render in jobs of their own so drums get their own treatment |
| Palette echo | songs set their echo for the shipped palette; a palette now changes it *relative* to that (`echo_override`, `echo_scale`), so `--palette toby` (shorter, darker EarthBound-style echo) changes every song by editing only `toby.json` |
| Melodies | `homeroom` got its own hook (section H; the main theme now plays once per loop: 2 + 24 bars, 60 s, 1.0 MB instead of 1.38 MB). `battle_matsuri` chorus rewritten (Bell in long notes, then the festival skip climbs) so it no longer opens like Moonlit's. SENTINEL CALL is now +5 +5 +2 −2 (the old +5 +5 −1 shared a famous TV fanfare's gesture). `march` bar 5 is D7sus4 only (no G over F♯ rub) and the third call overshoots to C6 |
| Balance (solo-part loudness, `partloud.py`) | title koto −38.7 → −24.9 LUFS, chip arp pad −34.5 → −26.3; matsuri lead −24.5 → −21.1 (5 LU under the mix, fue doubles A too; bass/taiko2 −2 dB); lantern koto −21.7 over the upright bass −23.3; blossom counter 2.9 LU under the lead; ironclock counter 3.7 LU under the saw; boss horn 2.8 LU under the lead; mall steel drum 4.8 LU over the e-piano, slap bass +3 dB |
| Engine | wave / miniboss stings are quantised so their stab (manifest `accent`) lands on the battle loop's next half bar (`loopMath.accentStart`, measured 0.0 ms off the grid in Chromium); `bossTakeover` plays `boss_warning`'s hold loop when the boss track is still decoding and hands over on its bar line; the first track's bytes are prefetched before the unlocking tap (format guessed from the cached probe / `canPlayType`), decoding starts right after the probe, and a track starting from silence plays as soon as its first stem is decoded (the others join sample-locked) — tap → lobby music 5.1 s → 2.5 s on this loaded machine (load average 19) |
| SFX | `ui.confirm` 405 → 235 ms; spam budgets per family (§3.8) |
| Tools | `studio.py originality` + `originality/blocklist.json` (+ `tests/test_originality.py`), `ship` skips `demo*` and prunes stale tracks |

---

## 0. Ground rules, ownership, and getting Kai in

### 0.1 Files the audio area owns

```
docs/AUDIO.md
tools/audio/**            offline toolkit (Python + ffmpeg + FluidSynth)
public/audio/**           committed renders: probe files, music/, sfx/
src/audio/**              runtime engine and hooks
tests/audio/**            vitest (Node) tests
e2e/audio.mjs             Playwright browser check
```

Edits to other areas' files are **only** the small hooks listed in §1.9. Each is a single import plus
single-line calls, so merges stay easy. Every hook is also noted in `docs/INTEGRATION_NOTES.md`
(append-only, prefix `[audio]`). The lead should add a short §13 *Audio* to `CONTRACTS.md` that points
here.

### 0.2 Licensing guardrails

- **Soundfont binaries never enter git.** They live in `tools/audio/cache/` (fetched) and
  `tools/audio/private/` or `$SAKURA_PRIVATE_SF2` (owner's private fonts). `.gitignore` gets:
  ```
  tools/audio/cache/
  tools/audio/build/
  tools/audio/private/
  tools/audio/.venv/
  *.sf2
  *.sf3
  *.dls
  ```
- **GeneralUser GS** (S. Christian Collins, License v2.0 — read on 2026-10-08 from
  `documentation/LICENSE.txt` in the official repo) allows unrestricted private or commercial music
  creation and asks us not to hot-link its downloads. We fetch it from the author's official GitHub repo
  into the gitignored cache, pin the commit, and verify the SHA-256.
- **Rendered audio is committed** (`public/audio/`). A render made with the `toby` palette contains
  EarthBound and SGM samples. The owner waived this for the friends-only alpha. The shipped default
  stays `cleared`, and the `toby` set is only shipped when the owner explicitly runs `ship --palette toby`
  (§2.6). The site is a public GitHub Pages URL, so this choice is made on purpose and never by default.
- **Compositions are 100 % original** (§4.1 style rules, §6.5 originality check).

### 0.3 Bringing in the Kai toolkit (the owner asked: *"How can I fork Kai to you"*)

The Kai repository is **not attached to this session**. Nobody here has read Kai's code. This design
rebuilds the same kind of pipeline from the Kai ledger notes: offline renders, palettes, the stem
renderer, the self-made chip soundfont and Deltarune-style SFX. To share Kai:

1. Connect GitHub at **https://claude.ai/connect-github**, and install the Claude GitHub App on the Kai
   repository (or on its org) from that same page.
2. If Kai lives under another account, first use GitHub's **Fork** button to copy it into the
   `tacosonmondays-pixel` account (or install the app on the original account).
3. Then either attach it to this session (ask Claude to attach `owner/kai`) or start a new Claude Code
   session with both `sakura-game` and the Kai repo selected.
4. **Do not** put the EarthBound or SGM soundfonts into `sakura-game`. That repo is public through Pages.
   Keep them in the private Kai repo or upload them straight into the session, then set
   `SAKURA_PRIVATE_SF2=/path/to/dir`.

When Kai arrives we take its **Toby palette mapping** (role → preset), its mixer settings, the chip
soundfont recipe and its SFX list for parity. `tools/audio/kai_import.py` converts Kai palette and song
files into ours if the formats differ. Nothing in this design blocks on Kai: the `cleared` palette works
today.

---

## 1. Hook points

Line numbers are from `feature/audio` HEAD `a5ffdbf`. Other branches move them; anchor on the quoted
code.

### 1.1 Boot, unlock and visibility

| Where | What happens | How |
|---|---|---|
| `src/main.js:27-35` (`store.load()`, `onAppStart`) | Boot the audio engine lazily, after the first route is up | **+1 line at the end of main.js**: `import('./audio/index.js').then((a) => a.initAudio({ store })).catch((e) => console.warn('[main] audio unavailable', e));` |
| Title screen (wt-ui `src/ui/screens/title.js:88` `button.tt-start`, `:98` whole-screen click, `:115 go()`) | First gesture: the AudioContext unlocks, `ui.start` chime plays, lobby music starts | Zero-touch. Capture-phase `pointerup` / `touchend` / `click` / `keydown` listeners on `window` unlock audio. `[data-testid=title-start]` maps to `ui.start` in the delegated click table |
| `document.visibilitychange` | Tab hidden → `ctx.suspend()`. Visible → resume, if unlocked and not paused by the game | Zero-touch (engine). The battle controller already opens its pause sheet when hidden (`controller.js:279-290`) |
| iOS `AudioContext.state === 'interrupted'` (call, Siri) | Re-arm the unlock listeners and resume on the next gesture | Engine |

### 1.2 Route and screen changes → music

| Where | Hook |
|---|---|
| `src/ui/router.js:91` `window.dispatchEvent(new CustomEvent('screenchange', { detail: { name, params } }))` | **Zero-touch.** The director listens to `screenchange`. It also listens to `hashchange` (`router.js:96-99`, parsed with the exported `parseHash` at `:28`) so it can start fetching the next track **before** the screen module loads |
| Routes (`main.js:7-25`, plus wt-ui's `title` and wt-online's `coop`) | Table in §3.6: `title`, `lobby`, the menus (students, student, formation, backpack, bestiary, wiki, commissions, rewards), `settings` (keeps the current track), `missions` / `campaign` / `bounty` / `assault` / `challenge`, `stage` (prep), `recruit`, `mall`, `battle`, and `coop` if merged |

### 1.3 Battle

The deterministic sim (`src/sim/**`) is never touched. All battle audio comes from the **same event
array the renderer already drains**. `BattleRenderer.update()` (`src/render/BattleRenderer.js:504-532`)
calls `sim.drainEvents()` at `:508`, feeds `handleEvents()` (`:252-500`) and **returns** the events. The
controller then routes them to `handle(events)` (`src/ui/battle/controller.js:400-404`). That return
value is the single place SFX hook in. There are no renderer edits and no second drain.

| Where | Hook |
|---|---|
| `controller.js:23` (imports) | `import { attachBattleAudio } from '../../audio/battle.js';` (light module: no WebAudio at import, safe in Node) |
| `controller.js:419` (after `ctx.results = results;`) | `ctx.audio = attachBattleAudio(ctx); cleanups.push(() => ctx.audio.destroy());` |
| `controller.js:404` (before `handle(events)`) | `ctx.audio?.events(events);` |
| `src/ui/battle/placement.js:104-107` `reject()` (invalid drop; silent reasons show no toast, so we need a sound) | `+import { cue } from '../../audio/cue.js';` and `cue('battle.deny', { reason });` |

`attachBattleAudio(ctx)` does the rest **without editing other battle files**:
- It reads `ctx.sim`, `ctx.stage`, `ctx.speed`, `ctx.paused` and `ctx.ended` in a 4 Hz poll.
- It wraps `ctx` actions defined at `controller.js:146-231`:
  - `openPause` / `closePause` → duck and lowpass the music, mute the battle bus.
  - `cycleSpeed` → `ui.tick` × speed, plus the 3× limiter profile.
  - `bump` (`placement.js:69-71`) → `bt.deny`.
  - `select` → `ui.select`.
- It wraps `ctx.feed.push` (`src/ui/battle/feed.js:29`):
  - kind `'new'` → `en.new`.
  - key `upg-cash` (`towerPanel.js:231-233`) or `poor-*` → `bt.deny`.
- It wraps `ctx.results.showVictory` / `showDefeat` / `showRewards` (`src/ui/battle/results.js:136/158/188`)
  → results loop, reward chimes and `gacha.newStudent` for unlocked girls.

Sim events → audio. The event list is CONTRACTS §6. The emit sites:

| Event (emit site) | Audio |
|---|---|
| `waveStart` (`Sim.js:442`) | Wave-start stinger in the family key, or `final_wave` when `wave === totalWaves`. Intensity stem fades in from the next beat. Build phase (`prep` / `between`) = base stem only |
| `waveEnd` (`Sim.js:464`) / `cash` reason `waveBonus` (`:452`) | `bt.waveClear`. Intensity fades out over 2 bars, unless the next wave starts within 2 s (auto-start) |
| `spawn` (`Sim.js:278`), tier `miniboss` | `miniboss` stinger, music −10 dB while it plays, intensity forced to 1 until it dies |
| `spawn`, tier `boss` | **Boss takeover**: battle music fades over 0.35 s, `boss_warning` stinger plays, then the boss track (`boss` or `final`) starts sample-accurately at the sting's end (§3.7) |
| `bossPhase` (`sim/enemies.js:186`) | `en.bossPhase`. The boss track's intensity stem fades in (phase 2+) |
| `attack` (`sim/towers.js:400` projectile, `:416` pulse, `:446` duel slash, `:463` beam, `:501` chain, `:547` trap, `:556` turret build, `:593` turret bullet) | Fire sound by `kind`. `WEAPON_KIND` at `towers.js:17-21` gives arrow / bullet / shell / fireball / shuriken / flask / bolt / orb / spark / needle. Turret shots play 4 dB quieter |
| `pulse` / `beam` / `chain` (`towers.js:415 / 461 / 499`) | Already covered by `attack` kinds `pulse` / `beam` / `chain`. `chain.points.length` sets the crackle count |
| `hit` (`Sim.js:305`) | `hit.*` by `attackType`. Blast is skipped because `explode` covers it. `crit` → adds `hit.crit`. `effective < 1` → `hit.resist` |
| `explode` (`towers.js:308`, `sim/enemies.js:470` volatile) | `boom.small` / `boom.big` (radius ≥ 1.4) / `boom.volatile` |
| `status` (`Sim.js:323`, only on new statuses) | `st.*` by status |
| `barrierBreak` / `shellBreak` (`Sim.js:308-309, 361`) | `break.barrier` / `break.crystal` |
| `death` (`Sim.js:388`) | `en.death` / `en.deathBig` (elite, or size ≥ 1.4) / `en.bossDeath` (boss or miniboss) |
| `split` (`sim/enemies.js:482`), `blink` (`:269`), `teleportWarn` (`:285`), `phase` (`:317/403`), `sabotage` (`:391`) | `en.split`, `en.blink`, `en.blinkWarn`, `en.phase`, `en.sabotage` |
| `leak` (`Sim.js:404`) | `bt.leak`, or `bt.leakBig` when lives ≥ 5. The poll fires `bt.lowLives` once when lives drop to ≤ 25 % |
| `place` (`Sim.js:594`) | `bt.place`, or `bt.placeHero` for the hero |
| `upgrade` (`Sim.js:665`) | `bt.upgrade` (tier 1-2) / `bt.upgradeBig` (3-4) / `bt.upgradeMax` (5) |
| `sell` (`Sim.js:689`) | `bt.sell` |
| `trapPlaced` / `trapTriggered` (`towers.js:546 / 753`) | `trap.set` / `trap.trigger` |
| `heroLevel` (`sim/hero.js:66`) / `ult` (`:179`) | `hero.level` / `hero.ult` |
| `cash` reason `income` (`Sim.js:459`) | `eco.coins` at −10 dB, at most one per 300 ms |
| `won` / `lost` (`Sim.js:467 / 408`) | Music stops (0.3 s), `victory` / `defeat` jingle plays, battle bus −6 dB. Then the `results_win` / `results_lose` loop when the jingle ends. The results sheet opens 1.7 s later (`controller.js:385`, `RESULT_DELAY_MS`) |

Pause and fast-forward: pause = the wrapped `ctx.openPause` (`controller.js:211`, from `hud.js:22` and
Esc). Speed = the wrapped `ctx.cycleSpeed` (`controller.js:172`, from `hud.js:21` and F). Music tempo
**never** follows game speed. Speed only changes SFX limits and gain (§3.9).

Co-op (wt-online changes `controller.js` heavily) keeps the same two touch points. Events still come back
from `renderer.update()`. Our three lines sit next to code they do not edit.

### 1.4 Gacha (recruit)

`src/ui/screens/recruit.js` is being edited in wt-fix (summon tracking, `doPull` at `:34`). Our cues sit
inside `playReveal` / `revealCard`, away from that fix. Add `+1 import` and these single-line calls:

| Line | Phase | Call |
|---|---|---|
| `:292` after `document.body.appendChild(overlay)` | Anticipation: envelope on screen | `cue('gacha.envelope', { best, count: results.length });` |
| `:305` after `phase = 'flip'` | Envelope opened, flips start | `cue('gacha.open');` |
| `:409` in `flip()` after `el.classList.add('flipped')` | Each card flip by rarity (`r` is in the closure) | `cue('gacha.flip', { rarity: r.rarity, instant });` (instant flips from "Skip" make one soft sound, not ten) |
| `:319` after `phase = 'showcase'` | SSR showcase | `cue('gacha.showcase', { unitId: r.unitId });` |
| `:347` after `newCount` is computed | Results readable | `cue('gacha.results', { best, newCount });` |
| `:369` in `close()` | Overlay closed | `cue('gacha.close');` |

The Skip button (`button.ma-gacha-skip`, `:290`) gets its sound from the delegated click table.

### 1.5 UI components (`src/ui/components.js`, lead-owned): zero-touch

No edits to `components.js`. `src/audio/domSfx.js` installs:
- **One capture-phase `click` listener on `document`.** It resolves `e.target.closest(...)` against a
  priority table. An explicit `[data-sfx="id|none"]` attribute always wins, so screens can opt in or out
  without code.

  | Selector | SFX |
  |---|---|
  | `[data-testid=title-start]`, `.tt-start` | `ui.start` |
  | `.topbar-back`, `[data-testid=back]`, `.menu-tab-x`, `[data-testid=reveal-close]`, `.ma-gacha-skip` | `ui.back` |
  | `[role=tab]`, `.tab`, `.ma-seg-btn`, `.bt-seg-btn` | `ui.tab` (`components.js:205-223` tabs) |
  | `[role=switch]`, `.ma-toggle`, `[aria-pressed]` | `ui.toggle`, pitched up or down from `aria-checked` / `aria-pressed` read in a microtask |
  | `.btn-yellow`, `.btn-primary`, `.bt-cta`, `.bt-start`, `.bt-buy` | `ui.confirm` |
  | `.unit-card`, `.item-tile`, `.menu-tab-btn`, `.bt-card` | `ui.select` (`.bt-card` = tower bar pick → `bt.pick`) |
  | `button`, `a[href]`, `[role=button]` (fallback) | `ui.click` (`components.js:49` button, `:60` iconButton, topbar `:175-189`) |

- **`pointerdown` on `button[disabled]`, `[aria-disabled=true]`** → `ui.deny`. This is best-effort,
  because some browsers send no pointer events to disabled controls.
- **`input` on `input[type=range]`** → `ui.tick`, throttled to 60 ms and pitched by value.
- **One `MutationObserver` on `document.body` (childList, plus the toast host).**
  - `.modal-overlay` added (`components.js:249-251`) → `ui.modalOpen` and music duck tag `modal` −4 dB.
  - `.modal-overlay.closing` or removed (`:232-239`) → `ui.modalClose` and unduck.
  - `.toast.toast-good` / `-info` (`:323-330`) → `ui.toast`.
  - `.toast-bad` → `ui.deny`.
  - `.ma-gacha` added → recruit duck safety net, in case cues are missing.

### 1.6 Economy and progression: zero-touch

`store.commit(reason)` emits `'change'` with `{ reason }` (`src/core/store.js:89-93`). `src/audio/economy.js`
subscribes with `store.on('change')` and keeps a snapshot of `currencies`, item totals, unit levels and
awaken stars. A pure, unit-tested `economyCues(prev, next, reason)` turns the diff into cues:

| Commit reason (call site) | Cues |
|---|---|
| `level-up` (`src/ui/screens/student.js:421`) | `levelup` jingle (music bus, menus duck −10 dB) |
| `breakthrough` (`student.js:462`) | `eco.breakthrough` |
| `awaken` (`student.js:509`) | `awaken` jingle |
| `gear-enhance` (`:609`) / `gear-reroll` (`:566`) / `gear-equip` (`:633`) / `gear-unequip` / `gear-lock` | `gear.enhance` (pitch rises with level) / `gear.reroll` / `gear.equip` / `gear.equip` at a lower pitch / `ui.toggle` |
| `missions` / `achievements` / `login` / `redeem` (`commissions.js:156,187,225,253,284`, `lobby.js:373`) | `eco.claim`, then by diff: `eco.gems` if gems rose, `eco.coins` if coins rose, `eco.item` if any item rose (staggered 120 ms) |
| `shop` (`mall.js:154`) | `eco.purchase`, plus `eco.item` |
| `sweep` (`stage.js:627`, `bounty.js:145`, `assault.js:128`, `missions.js:139`) | `eco.sweep`, plus coins and items |
| `gearbox-open` / `gear-salvage` | `eco.item` / `eco.coins` |
| `formation` / `secretary` | `ui.slot` / `ui.select` |
| `pull` / `spark` | None (the gacha cues own this) |
| `battle-result`, `app-start`, `replace`, `settings` | None (battle audio owns results; settings re-apply volumes) |

### 1.7 Settings and volumes

`src/ui/screens/settings.js:82-87` (Audio panel; the toggles at `:84-85` currently do nothing) and
`src/systems/save.js:26-37` (`DEFAULT_SETTINGS`) and `:188-205` (`cleanSettings`, **which drops unknown
keys**, so new keys must be added there):

- `save.js` adds `musicVolume: 0.7` and `sfxVolume: 0.8` to `DEFAULT_SETTINGS` (`:30-32`). In
  `cleanSettings` it adds
  `musicVolume: num(s.musicVolume, typeof s.music === 'number' ? s.music : d.musicVolume, 0, 1)` and the
  matching `sfxVolume` (`:196-198`). Old numeric `music` / `sfx` values migrate into the sliders. 4 lines.
- `settings.js` (+1 import of `cue`):
  - Relabel the existing `Volume` row (`:86`) to **Master volume**.
  - Add **Music volume** and **Sound effects volume** sliders under their toggles (the `slider()` helper is at
    `:181`).
  - Each slider's `onInput` also calls `cue('settings.audio')` for live preview. The SFX slider's
    `onCommit` plays `cue('sfx.preview')`.
  - The toggles need no change: `save()` → `store.commit('settings')` → the engine re-reads.
  - Optional: a **Sound Test** button → `navigate('soundtest')` (§6.6).

### 1.8 Lobby, title and currency pills

- Lobby secretary tap reactions and future voice lines: the UI team adds `data-sfx="ui.chirp"` to the
  tap target. No audio code change is needed.
- Account level-ups are derived in the UI (`components.js:88` `accountLevel`). The first ship skips them.
  Later, `economy.js` can compare `accountLevel` before and after commits.

### 1.9 Complete edit list outside the audio area

| File (owner) | Lines added | Content |
|---|---|---|
| `src/main.js` (lead) | 1 (+1 optional) | lazy `initAudio`; optional `registerRoute('soundtest', () => import('./audio/soundTest.js'))` |
| `src/ui/battle/controller.js` (battle-ui) | 3 | import, `ctx.audio = attachBattleAudio(ctx)` + cleanup, `ctx.audio?.events(events)` |
| `src/ui/battle/placement.js` (battle-ui) | 2 | import `cue`, `cue('battle.deny', { reason })` in `reject()` |
| `src/ui/screens/recruit.js` (meta-a) | 7 | import + 6 cue lines |
| `src/ui/screens/settings.js` (meta-a) | about 6 | import, 2 sliders, relabel, cue on input, optional Sound Test button |
| `src/systems/save.js` (systems) | 4 | `musicVolume`, `sfxVolume` defaults and cleaning |
| `.gitignore` (lead) | 7 | §0.2 |

---

## 2. Offline pipeline: `tools/audio/`

### 2.1 Layout

```
tools/audio/
  requirements.txt        mido==1.3.3  numpy==2.4.6  scipy==1.17.1  packaging==26.3   (pinned; verified 2026-10-08)
  setup_venv.sh           python3 -m venv "${AUDIO_VENV:-tools/audio/.venv}" && pip install -r requirements.txt
  studio.py               the CLI (§2.6)
  sakura_audio/
    notation.py           note-string parser + bar validator
    theory.py             keys, scales, chord symbols → voicings, motif transforms
    song.py               Song / Section / Part model; loads songs/*.py and songs/*.json
    gen.py                pattern generators from chord symbols (bass, comp, arp, chip-arp, drums)
    midi.py               mido writer: preview GM MIDI + per-render subset MIDIs + motif markers
    palette.py            palette loading/validation/inheritance, sf2 discovery (cache, private, env)
    render.py             FluidSynth subprocess per (stem, soundfont, echo-bus) subset; ≤ 2 jobs
    mix.py                sum, SNES echo, lowpass, crush, loudness, head+loop extraction
    encode.py             ffmpeg Opus/AAC, probe files
    manifest.py           public/audio/music/manifest.json, budget checks
    sfx/synth.py          numpy primitives (pulse/triangle/noise LFSR/FM/pluck/envelopes/sweeps)
    sfx/recipes.py        one function per SFX id (deterministic, seeded)
    sfx/sprite.py         packer + sprite.json
    review.py             analysis, seam check, spectrograms, piano rolls, HTML index
    originality.py        interval n-gram self-check (§6.5)
  make_chip_sf2.py        writes cache/sf2/sakura-chip.sf2 (CC0, deterministic)
  fetch_soundfonts.py     GeneralUser GS (pinned) → cache/sf2/; checks FluidR3 fallback
  kai_import.py           (later) converts Kai palettes/songs when the repo is shared
  palettes/  cleared.json  strict.json  toby.json  chip.json
  songs/     motifs.py  title.py  homeroom.py  march.py  wishing.py  mall.py
             battle_blossom.py  battle_moonlit.py  battle_lantern.py  battle_ironclock.py  battle_matsuri.py
             boss.py  final_boss.py  results.py  jingles.py
  tests/     test_notation.py  test_loop_math.py  test_echo.py  test_sf2_writer.py  test_palette.py   (python -m unittest)
  cache/ build/ private/ .venv/      gitignored
```

On this machine the venv lives at
`/tmp/claude-0/-home-user/bc8e90b4-5af0-5aad-ab54-4a98bb73399f/scratchpad/audio/venv` (`AUDIO_VENV`). It
is already created with the pinned versions above.

### 2.2 Soundfonts

- **GeneralUser GS v2.0.3.** Official repo `https://github.com/mrbumpy409/generaluser-gs`.
  `GeneralUser-GS.sf2` (32,319,396 bytes) sits at the repo root at commit
  `684543d5e5efaef08d02be50dcda8d552478fa60` (2026-02-23). It is a normal blob, not LFS. The GitHub
  release API is blocked in this sandbox, but anonymous `git` reads work, so `fetch_soundfonts.py` runs:
  ```
  git clone --depth 1 --filter=blob:none --no-checkout https://github.com/mrbumpy409/generaluser-gs cache/generaluser-gs
  git -C cache/generaluser-gs fetch --depth 1 origin 684543d5e5efaef08d02be50dcda8d552478fa60
  git -C cache/generaluser-gs checkout 684543d5… -- GeneralUser-GS.sf2 documentation/LICENSE.txt
  ```
  Then it copies the font to `cache/sf2/GeneralUser-GS.sf2` and verifies a pinned SHA-256 (recorded on
  the first fetch in `fetch_soundfonts.py`). On machines with release access it may instead download
  the official release zip.
- **Fallback:** `/usr/share/sounds/sf2/FluidR3_GM.sf2` (installed, MIT). A palette that names `gm`
  resolves to GeneralUser GS, else FluidR3, with a warning in the render report.
- **`sakura-chip.sf2`** (ours, CC0, by `make_chip_sf2.py`, in the spirit of KAI-Chip). A minimal SF2 2.01
  writer:
  - `RIFF sfbk`
  - `INFO`: `ifil`, `isng`, `INAM "Sakura Chip"`, `ICOP "CC0 1.0"`
  - `sdta/smpl`: 16-bit mono
  - `pdta`: `phdr/pbag/pmod/pgen/inst/ibag/imod/igen/shdr` with terminal records

  Content:
  - Melodic programs (bank 0):
    - 0 pulse 12.5 %, 1 pulse 25 %, 2 pulse 50 %, 3 NES triangle (32-step quantised), 4 saw (VRC6-ish),
      5 pulse-25 pluck (fast decay), 6 "chip bell" (pulse 50 % + pitch blip).
    - Every waveform is a looped single cycle, **band-limited per octave**: 9 key-range zones, each
      additively synthesised to just below Nyquist at 32 kHz for that zone's top note. High notes then
      do not alias into mush, while low notes keep the full square bite.
    - Envelopes come from SF2 generators (volEnv attack, decay, sustain and release; NES-like stepped
      decay where wanted).
  - Bank 128 program 0 "NES kit":
    - kick = triangle pitch-sweep
    - snare = long-mode LFSR noise + triangle body
    - closed hat = short-mode (93-step) metallic noise
    - open hat and crash = long-mode noise with long decay
    - toms = triangle sweeps
    - Mapped to GM drum notes 35-57, so the same `drums` part plays on either kit.

  `tests/test_sf2_writer.py` round-trips the file through FluidSynth (renders one note per program and
  checks pitch by zero crossings).

### 2.3 Song format

Songs are Python modules (`songs/<id>.py`). They are JSON-compatible, so a `songs/<id>.json` with the
same fields also loads, which keeps us compatible with Kai-style plain note data. Melodies are written by
hand as compact note strings. Accompaniment can be hand-written or generated from chord symbols. Shared
leitmotifs live in `songs/motifs.py` and are inserted with transforms. Each insertion also writes a MIDI
marker (`motif:BELL`), so piano rolls can box it.

**Note strings**

```
c5/8   d#4/4.   bb5/16   r/2   [f4 a4 c5]/2     C4 = middle C (MIDI 60); /1 /2 /4 /8 /16 /32; '.' dotted; 't' triplet
~      tie to the next note of the same pitch (across bars)
!  ?   accent (+20 vel) / ghost (−30 vel);  @v96  explicit velocity
'  _   staccato (50 %) / legato (105 %, chip glide)   ^ slide-in from −2 semitones   *v vibrato
|      bar line, validated: a bar that does not sum to the meter is an error
%      repeat previous bar     ( … )x2  repeat group     a duration with no note keeps the previous one
drums  k s rs cl h ph o c r t1 t2 t3 tb cb sh wb tri tk   (kick, snare, rimshot, clap, hats, crash, ride,
       toms, tambourine, cowbell, shaker, woodblock, triangle, taiko); k+c/4 = simultaneous
```

**Example: the first 4 bars of the main theme, plus accompaniment**

```python
# tools/audio/songs/title.py — ORIGINAL composition (no quotes; see docs/AUDIO.md §4.1)
from sakura_audio.song import Song
from songs.motifs import BELL

song = Song(id='title', title='Sakura Sentinels', bpm=132, meter=(4, 4), key='F',
            form=['intro', '|:', 'A', 'B', 'A_ab', ':|'],           # |: … :| = the loop body (8 + 8 + 8 bars)
            stems={'full': ['*']},
            mix={'echo': {'delay_ms': 192, 'feedback': 0.40, 'volume': 0.28, 'fir': 'soft'}})

song.section('A', bars=8, chords='Fmaj7 | Dm9 | Bbmaj7 | C7sus4 C7 | Am7 | D7b9 | Gm9 Bbm6 | F/C C7')

song.part('lead', role='chip_pulse25', stem='full').notes('A', '''
  c5/8 f5/8 d5/4 e5/4. f5/8 | a5/4 g5/8 f5/8 e5/4 d5/4 | c5/8 f5/8 d5/4 e5/8 f5/8 g5/4 | a5/4. g5/8 c5/2 |
  c5/8 f5/8 d5/4 e5/4 c6/4  | a5/8 bb5/8 a5/8 f#5/8 eb5/4 d5/4 | g5/4 bb5/8 a5/8 g5/8 f5/8 db5/4 | c5/4. d5/8 e5/4 g5/4
''', motifs={1: BELL, 3: BELL, 5: BELL})          # bar → motif tag (marker only)
song.part('glock', role='glock', stem='full', octave=+1, vel=-18).double('lead', 'A')   # chip + real-instrument doubling
song.part('bass', role='finger_bass', stem='full').gen('A', 'bass:sync')               # root, octave on 2&, 5th, chromatic approach
song.part('keys', role='epiano', stem='full').gen('A', 'comp:charleston', voicing='rootless')
song.part('drums', role='drums', stem='full').pattern('A', 'k/8 h/8 s/8 h/8 k/16 k/16 h/8 s/8 h/8 |', each_bar=True,
                                                     fills={4: 'k/8 h/8 s/8 h/8 s/16 s s s t1/8 t2/8 |', 8: 'k+c/2 s/8 s s/4 |'})
song.section('intro', bars=4, chords='Fmaj7 | Bbmaj7/F | Fmaj7 | C7sus4')
song.part('box', role='music_box', stem='full').notes('intro', BELL.question(key='F', octave=6) + ' r/8 | '   # c6/8 f6/8 d6/4 e6/4.
                                                       + BELL.answer(key='F', octave=6) + ' r/2 | r/1 | r/1')  # f6/2
```

**Swing quantise** (no audio stretching; round 3). `Song(swing=0.64)` moves every offbeat 8th to 64 % of the
beat and stretches the notes in between proportionally. Options: `Song(swing_unit=0.5)` swings 16ths instead of
8ths; `Song(swing_triplets='keep')` leaves notes on a triplet grid where they are (jazz triplet skips stay triplets,
while duple 8ths swing); `song.section('Br', 8, chords, swing=0)` overrides the amount for one section (a straight
bossa bridge in a swing tune); `song.part(..., swing=0.66)` overrides it for one part (it wins over the section).
The defaults (`swing_unit=1`, `'warp'`) are the round-2 formula, so older songs render bit-identically.

Generators (`gen.py`) are deterministic. They take the chord grid, the key and the style:

| Family | Generators |
|---|---|
| Bass | `bass:root`, `bass:root5`, `bass:sync` (Toby-ish syncopated slap or finger, octave pops, chromatic approach), `bass:walking` (swing), `bass:pedal` |
| Comping | `comp:offbeat`, `comp:charleston`, `comp:bossa`, `comp:stabs` (brass), `pad:sustain` |
| Arpeggios | `arp:up16`, `arp:updown8`, `chip:arp32` (classic NES one-voice chord arpeggio) |
| Drums | `drums:<style>` (straight, shuffle, march, taiko, bossa, halftime) with fills every 4 and 8 bars |

A song file declares `stems`, the parts in each stem, and per-part `role`. Everything about *sound*
(which soundfont, bank, program and gain) comes from the palette, never from the song.

### 2.4 Palettes

`tools/audio/palettes/<id>.json`:

```json
{
  "id": "cleared",
  "description": "Ships today: GeneralUser GS (GM/GS) + our CC0 sakura-chip.sf2",
  "inherit": null,
  "soundfonts": {
    "gm":   { "path": "cache/sf2/GeneralUser-GS.sf2", "fallback": "/usr/share/sounds/sf2/FluidR3_GM.sf2", "fetch": "generaluser" },
    "chip": { "path": "cache/sf2/sakura-chip.sf2", "build": "make_chip_sf2.py" }
  },
  "render": { "rate": 32000, "interp": 4, "polyphony": 256, "gain": 0.4 },
  "mix": {
    "echo":   { "delay_ms": 208, "feedback": 0.42, "volume": 0.30, "fir": "soft", "invert_right": false },
    "lowpass_hz": 14500,
    "crush":  { "bits": 0, "mix": 0.0 }
  },
  "roles": {
    "chip_pulse25": { "sf": "chip", "bank": 0,   "program": 1,  "gain_db": -3, "pan": -0.15, "echo": 1 },
    "slap_bass":    { "sf": "gm",   "bank": 0,   "program": 36, "gain_db":  0, "pan": 0,     "echo": 0 },
    "music_box":    { "sf": "gm",   "bank": 0,   "program": 10, "gain_db": -2, "pan": 0.2,   "echo": 1 },
    "drums":        { "sf": "gm",   "bank": 128, "program": 0,  "gain_db":  0, "pan": 0,     "echo": 0,
                      "kit_map": { "k": 36, "s": 38, "rs": 37, "cl": 39, "h": 42, "ph": 44, "o": 46, "c": 49, "r": 51,
                                   "t1": 50, "t2": 47, "t3": 43, "tb": 54, "cb": 56, "sh": 70, "wb": 76, "tri": 81, "tk": 35 } }
  }
}
```

Role fields: `sf`, `bank`, `program` (0-based), `gain_db`, `pan` (−1…1), `echo` (0…1 send; on SNES this
was a per-voice on/off bit, so we render a wet group and a dry group), `transpose`, `vel_curve`, `kit_map`
(drums: drum name → MIDI key, for names a kit lacks), `alias` (`"lead": {"alias": "chip_pulse25"}`), `fx` (part
effects, §2.4.2; round 3).

**Role list** (songs may only use these; the validator rejects unknown roles). `cleared` defaults below,
GM programs 0-based:

| Group | Roles → `cleared` preset |
|---|---|
| Chip (sakura-chip) | `chip_pulse12` 0, `chip_pulse25` 1, `chip_pulse50` 2, `chip_triangle` 3, `chip_saw` 4, `chip_pluck` 5, `chip_bell` 6, `chip_kit` bank 128/0 |
| Aliases | `lead` → chip_pulse25, `counter` → chip_pulse12, `chip_bass` → chip_triangle |
| Keys and mallets | `piano` 0, `epiano` 4, `epiano_fm` 5, `harpsichord` 6, `celesta` 8, `glock` 9, `music_box` 10, `vibes` 11, `marimba` 12, `xylophone` 13, `tubular_bells` 14 |
| Organ | `organ` 17 (percussive), `organ_drawbar` 16, `accordion` 21 |
| Guitar | `nylon_gtr` 24, `clean_gtr` 27, `overdrive_gtr` 29, `dist_gtr` 30 |
| Bass | `upright_bass` 32, `finger_bass` 33, `pick_bass` 34, `fretless` 35, `slap_bass` 36, `synth_bass` 38 |
| Strings | `strings` 48, `strings_slow` 49, `tremolo` 44, `pizz` 45, `harp` 46, `timpani` 47 |
| Voices and hits | `choir_ahh` 52, `choir_ooh` 53, `synth_voice` 54, `orch_hit` 55 |
| Brass and reeds | `trumpet` 56, `trombone` 57, `tuba` 58, `muted_trumpet` 59, `horn` 60, `brass` 61, `brass_stab` 62, `alto_sax` 65 |
| Winds | `piccolo` 72, `flute` 73, `recorder` 74, `pan_flute` 75, `shakuhachi` 77, `whistle` 78, `ocarina` 79 |
| Pads | `pad_warm` 89, `pad_choir` 91, `pad_halo` 94 |
| Japanese and world | `shamisen` 106, `koto` 107, `kalimba` 108, `steel_drum` 114, `woodblock` 115, `taiko` 116, `melodic_tom` 117, `rev_cymbal` 119 |
| Kits | `drums` 128/0 (Standard), `drums_room` 128/8, `drums_power` 128/16, `drums_brush` 128/40, `drums_orch` 128/48 |
| Round 3 | 35 genre roles, see §2.4.1 |

**Palettes shipped in git** (JSON only):

| Palette | Content |
|---|---|
| `cleared` | As above. The default and shipped palette |
| `strict` | Same roles on FluidR3 GM (MIT) + `sakura-chip` (CC0) only, for a fully license-documented build |
| `chip` | `inherit: cleared`, but every melodic role maps to `sakura-chip` and drums to the NES kit. A full NES mode, cheap to offer later as a Settings "8-bit mode" |
| `toby` | `inherit: cleared` (any role it does not map falls back, with a warning). Soundfonts point at `${SAKURA_PRIVATE_SF2}/earthbound.sf2` and `${SAKURA_PRIVATE_SF2}/sgm.sf2` (file names confirmed when Kai's ledger or palette arrives). Role entries are filled from Kai's Toby palette. It can also set its own `mix` (EarthBound-style shorter echo, crunchier). Nothing in any song changes: `studio.py render all --palette toby` re-renders everything |

#### 2.4.1 Round-3 genre roles (jazz, ska, city pop, techno, hardtek, Celtic, surf, sweet)

Added for the round-3 genre lanes (plan: `r3/plan.md` §4.1). `cleared` uses GeneralUser GS's GS variation banks
where they sound better than the plain GM program. FluidR3 (`strict`) only has banks 0, 8, 16 and 128, so
`strict.json` now carries explicit overrides (`quiet_inherit`, round-3 roles only) with the closest FluidR3
preset. `toby.json` maps every new role to the GM program in `sgm` (and falls back to `cleared`, fx included,
without the private fonts). `chip.json` maps them to `sakura-chip`, like every other role.

**Levels.** Every new role was rendered solo through the real chain (voice treatment, part fx, echo; no loudness
normalisation) playing a 4-bar audition phrase of its kind (lead, bass, comp, strum, stab, pad, bell, 16th arp,
kit, kick), next to reference roles that were balanced in round 2 (`partloud`). `gain_db` was set so a new
role lands within about 1 dB of its family: leads ≈ `alto_sax` / `chip_pulse25` / `trumpet` (−33.5 LUFS solo),
comping ≈ `epiano` (−32.5), stabs ≈ `brass_stab` (−36), pads ≈ `pad_warm` (−35.5), bells ≈ `celesta` level minus
4 LU (answers sit under the tune, −37), basses −31.5…−33 (`techno_bass` and `saw_bass` are the stars of their
lanes), kits ≈ `drums` (−36.5), `kick_hard` −32 (quarter kicks alone; keep it 2-3 dB under bass + lead in the
mix). FluidR3 runs 1-5 dB hotter than GeneralUser and its synth / 808 presets up to 9 dB hotter, so `strict`
re-measures the overridden roles against FluidR3's own references. The auditions (WAV + spectrogram per role,
8-bar effect demos, contact sheets) were made with a scratch script around `render.plan_jobs` / `mix.voice_fx` /
`fx.part_fx` / `mix.loudness`; they are not in the repo.

| Role | `cleared` (bank/prog, gain dB) | `strict` (FluidR3) | `toby` (sgm) | Notes |
|---|---|---|---|---|
| `tenor_sax` | 0/66 Tenor Sax, −2.5 | = | 0/66 | jazz section, ska head, surf honk |
| `bari_sax` | 0/67 Baritone Sax, −3 | = | 0/67 | ska blat, jazz bottom |
| `clarinet` | 0/71 Clarinet, −4 | = | 0/71 | jazz counter-line |
| `harmonica` | 0/22 Harmonica, 0 | = | 0/22 | ska dub breakdown |
| `jazz_gtr` | 0/26 Jazz Guitar, −5 | = | 0/26 | four-to-the-bar comping |
| `muted_gtr` | 0/28 Muted Guitar, −0.5 | = | 0/28 | ska skank |
| `funk_gtr` | 8/28 Funk Guitar, −5 | 8/28, −7.5 | 0/28 | city-pop 16th scratch |
| `surf_gtr` | 12/27 Clean Guitar 2, +1.5, echo 0.9 | 0/27, −0.5 | 0/27 | tremolo-picked surf lead |
| `ukulele` | 8/24 Ukulele, −6.5 | 8/24, −9 | 0/24 | sweet strum |
| `mandolin` | 16/25 Mandolin, +4.5 | 16/25, +2.5 | 0/25 | Celtic chops (the sample is quiet) |
| `clavinet` | 0/7 Clavinet, −4 | = | 0/7 | city-pop stabs |
| `rhodes` | 8/4 Chorused Tine EP, −5.5, `fx.drive` (pre 9 dB, mix 0.5, tone 4.5 kHz) | = (8/4 Detuned EP 1) | 0/4 (+ same fx) | FluidSynth's chorus is off, so 8/4 alone = `epiano`; the light drive gives the tine bark that tells them apart |
| `vibes_dry` | 11/11 Vibraphone No Trem., −3 | 0/11 | 0/11 | jazz head (no tremolo) |
| `combo_organ` | 8/16 Detuned Tonewheel, −5.5 | 8/16 Detuned Organ 1, −2 | 0/17 | surf / ska organ |
| `bell_piano` | 12/0 Bell Piano (DX7 strike + grand), 0 | 0/5 FM EP | 0/8 | sweet tune |
| `fiddle` | 0/110 Fiddle, −3 | = | 0/110 | Celtic lead / double-stops |
| `tin_whistle` | 24/75 Tin Whistle, −3.5 | 0/74 Recorder, −10 | 0/78 | Celtic lead (GM 78 "Whistle" is a human whistle; the recorder is the closest fipple flute in FluidR3) |
| `tinkle_bells` | 11/8 Tinkling Bells, −1 | 0/112 Tinker Bell, +0.5 | 0/112 | sweet answers |
| `xmas_bells` | 12/10 Christmas Bells (glass + triangle), −2.5 | 0/98 Crystal, 0 | 0/10 | sweet answers |
| `synth_chime` | 11/98 Synth Chime, −2.5 | 0/98 Crystal, −4.5 | 0/98 | techno "conveyor" 16th arp |
| `techno_bass` | 11/38 Techno Bass, +2 | 8/39 Synth Bass 4, −3 | 0/38 | short plucky 16ths; pump it (§2.4.2) |
| `acid_bass` | 8/38 Acid Bass, −5, `fx.filter` LP 520 Hz, Q 5.5, accent 2.6 oct / 170 ms | 8/39, −7 (+ same fx) | 0/38 (+ same fx) | add `auto` on the part for the sweep |
| `saw_bass` | 12/38 Mean Saw Bass, −3, `fx.drive` (pre 7 dB, mix 0.6, tone 5.2 kHz) | 0/38 Synth Bass 1, −4.5 | 0/39 (+ same fx) | hardtek rolling bass |
| `square_lead` | 12/80 Square Lead 2, −0.5 | 0/80, −5 | 0/80 | techno / city-pop hook |
| `saw_lead` | 12/81 Saw Lead 2, +2 | 0/81, −3 | 0/81 | electronic lead (optional) |
| `saw_stab` | 11/81 Sawtooth Stab, 0 | 0/81 Saw Wave, −5.5 | 0/63 | rave / techno BAM |
| `supersaw` | 11/100 Bright Saw Stack, −1 | 0/50 Synth Strings 1, −10 (the GU stack is built on that sample) | 0/90 | pumped pads; the stack decays to a sustain, so retrigger it |
| `sweep_pad` | 0/95 Sweep Pad, −8 | = | 0/95 | risers |
| `synth_brass` | 0/63 Synth Brass 2, −5 | = | 0/63 | city pop, techno, hardtek rallies (slow attack: lines, not stabs; stabs = `brass_stab`) |
| `synth_strings` | 0/50 Synth Strings 1, −8 | = | 0/50 | pad (optional) |
| `vox_chop` | 0/85 Solo Vox, −5 | = | 0/85 | hardtek "hey": write it staccato (`a4/8'`) |
| `drums_jazz` | 128/32 Jazz kit, −2 | = | 128/32 | ride spang-a-lang, brushed snare on 40 |
| `drums_909` | 128/25 808/909 kit, −2; `s` → 40 (909 snare), `sd2` → 38 (808 snare) | 128/25 TR-808, −11.5 | 128/25 | `k` 36 = 909 kick, `tk` 35 = 808 kick; hats, clap, cymbal, cowbell are 808 |
| `drums_electro` | 128/24 Electronic kit, −4 | = | 128/24 | optional |
| `kick_hard` | 128/25, −4.5, `fx.drive` (pre 14 dB, HP 35 Hz, tone 6 kHz); `k` → 36 (909), `tk` → 35 (808, longer) | 128/25, −11 | 128/25 (+ same fx) | write only kicks on it: the drive treats the whole part |

**Kit names** (`notation.DRUM_NAMES`, round 3): `fs` finger snap (GS 26), `sr` snare roll (GS 25), `st` sticks (31).
Neither GeneralUser GS nor FluidR3 has a sample on 25 or 26 in any kit (checked zone by zone with
`sf2.preset_keys`), so every kit role carries a `kit_map`: `fs` → 28 (the Slap, a short dry crack) on the GM kits,
31 (sticks) on the orchestral kit and 37 (rim click) on the 808/909 and chip kits; `sr` → 40 (the kit's second
snare: brush swirl on the brush kit, 909 snare on the 808/909 kit; write real rolls as `(s?/32)x8`); `st` → 75
(claves) on the chip kit. A test checks that every drum name the round-3 briefs use lands on a sample in every kit
of `cleared`, `strict` and `chip`. Note: on the brush kit `cl` (39) is a brush slap, not a clap.
`kick_hard` and the other kit roles that do not start with `drums` are recognised as kits from the shipped palette,
so their parts take drum names before a palette is chosen.

#### 2.4.2 Part effects (`fx`, `sakura_audio/fx.py`)

An `fx` dict can sit on a role (sound design: the hardtek kick's drive) and on a part (`s.part(..., fx={...})`,
musical automation). The part's dict updates the role's effect by effect; `{'drive': None}` on a part removes the
role's drive. Unknown effects or fields are errors.

| Effect | Fields (defaults) | What it does |
|---|---|---|
| `filter` | `type` lp / bp / hp, `hz` (static) or `auto: [[section, bar, hz], …]`, `q` 0.707, `accent: {depth_oct 2, decay_ms 180, vel_floor 48}`, `mix` 1, `block` 32 | TPT state-variable filter (stable under fast modulation). `auto` points are placed on every pass of the section (bar is 1-based and may be fractional; bar `bars+1` is the section's end) and interpolated in log-frequency; before the first point / after the last the value holds. `accent`: each note restarts a cutoff blip of `depth_oct · (vel − vel_floor)/(127 − vel_floor)` octaves decaying over `decay_ms` (303-style squelch: write accents with `!`). `bp` has unity gain at the centre. A filter with `accent` renders in a job of its own |
| `drive` | `pre_db` 12, `hp_hz` 35, `tone_hz` 6000, `mix` 1, `out_db` 0, `ref` 'peak', `os` 2 | `ref · tanh(g·HP(x)/ref)/tanh(g)` then a `tone_hz` low-pass, blended at `mix`. With `ref='peak'` the loudest hit keeps its peak and everything `pre_db` below it saturates: the character does not depend on the role or part gain (scale-invariant), and the quiet tail comes up (the long hardtek kick). The shaper runs 2× oversampled. It makes a part louder overall: set `gain_db` after it |
| `pump` | `key` 'beat' or a part name (or list), `notes` (drum names or MIDI keys of the key part, e.g. `['k']`), `depth_db` 6, `attack_ms` 3, `hold_ms` 0, `release_beats` 0.4, `every` 1 / `offset` 0 (beat mode) | Sidechain gain built from the key's onsets in the song timeline: down by `depth_db` within `attack_ms`, back to 0 dB along a raised cosine over `release_beats`; overlaps keep the deepest dip. When the kick drops out (breakdown), the pumping stops with it |

Order: filter → drive → pump. Effects run in `pipeline.render_song` on each FluidSynth job's continuous render,
after the palette's voice treatment and before the echo send and the stem sum, so stems still add up to the full
mix (SFX rendered through the palette, `sfx/sampled.py`, get their role's fx too). Parts with effects render in
jobs grouped by their merged fx (`render.plan_jobs`); songs without fx keep
their job layout, MIDI and cache keys (verified: `results_win`, `wave_ironclock`, `battle_ironclock`, `homeroom`,
`boss` and `demo_battle` render bit-identically to round 2). The loop seam stays exact: automation points and
key/accent onsets are laid out over every pass plus one virtual pass after cycle 2, and the render past the end of
cycle 2 is replaced by the start of cycle 2 before the effects run (only `R[0 : L0+2P]` reaches the loop file), so
the drive's ±10-sample oversampling filter sees what really follows the loop end.

Cost (measured on this shared machine at load ≈ 17): the filter takes about 5-7 s for 130 s of stereo (exact
SVF, block-parallel: zero-state responses of all 32-sample blocks at once plus a 2×2 recurrence over the block
states), the drive about 5 s.

**Demo:** `demo_genres` in `songs/demo.py` (*Roll Call: genre bus*, 128 bpm, 1 + 16 bars, base + intensity, not
shipped) plays every round-3 role and all three effects, two bars per lane, with section swing in the jazz bars.
Gates: loop identity −65.8 dB, WAV seams −67.9 / −74.0 dB, Opus / AAC seams at codec-noise level, Σ stems = full mix.

### 2.5 Stems

Every stem of a song has **identical length and identical loop points**. That means sample-locked
playback (§3.5).

| Kind | Stems | Used for |
|---|---|---|
| Single | `full` | title, mall, stingers, jingles, results loops |
| Vertical remix (menus) | `base` + `melody` (homeroom), `base` + `prep` (march), `base` + `riser` (wishing) | Same song across related screens: lobby ⇄ menus, map ⇄ stage prep, recruit ⇄ reveal |
| Battle | `base` (harmony + bass + drums + main melody) + `intensity` (extra drums, counter-melody, brass and strings hits, orchestra hits) | `base` = build phase, `base + intensity` = wave active. The base must be complete music on its own. The intensity stem never changes harmony |
| Boss | `base` + `intensity` | Phase 1 = base. Phase 2+ (`bossPhase`) adds intensity |

### 2.6 The CLI

```
python tools/audio/studio.py fetch                       # GeneralUser GS (pinned) + build sakura-chip.sf2
python tools/audio/studio.py list                        # songs, sections, stems, durations, size estimate vs budget
python tools/audio/studio.py midi title                  # MIDI only (build/midi/title.mid) + piano roll
python tools/audio/studio.py render title                # one song: MIDI → stems → mix → encode → manifest entry
python tools/audio/studio.py render all                  # every song (2 FluidSynth jobs at a time, foreground)
python tools/audio/studio.py render all --palette toby   # same songs, another palette (output to build/, not shipped)
python tools/audio/studio.py render battle_blossom --stems intensity --no-encode   # fast iteration
python tools/audio/studio.py sfx all                     # SFX recipes → sprite
python tools/audio/studio.py review title|all|sfx        # analysis + spectrograms + piano rolls + report (§6)
python tools/audio/studio.py ship [--palette cleared]    # budget + seam + loudness gates, then copy into public/audio/
```

- `render` writes only to `tools/audio/build/<palette>/`. `ship` is the only command that writes
  `public/audio/`, and it refuses if any gate in §6 fails.
- The machine is small and shared: no daemons, at most 2 FluidSynth processes, timeouts on every
  subprocess, renders in batches.

### 2.7 Render and mix chain

Per song:

1. **MIDI.** `midi.py` writes `build/midi/<song>.mid`: a GM preview with program changes, playable in
   any player. It also writes one **subset MIDI per (stem × soundfont × echo-bus)**, with that palette's
   bank and program, CC7 gain, CC10 pan, and channels ≤ 16 (channel 10 only for kits).
   - **Tempo snap.** The loop body length P is rounded to a multiple of 64 samples at 32 kHz (FluidSynth
     applies MIDI events on 64-sample blocks). The BPM is adjusted by < 0.01 % (e.g. 132 → 132.0041)
     so cycle 1 and cycle 2 render bit-identically apart from tails.
   - **Render length** = intro + loop × 2 + 0.5 s. FluidSynth keeps rendering release tails after the
     last event (verified).
2. **FluidSynth** (verified flags, FluidSynth 2.3.4):
   ```
   fluidsynth -ni -q -R 0 -C 0 -g <render.gain> -r 32000 -O float -T wav -o synth.polyphony=256 \
              -f interp.cfg -F build/raw/<song>/<stem>.<sf>.<bus>.wav <font.sf2> <subset.mid>
   ```
   - `interp.cfg` = `interp 4` (4-point, the closest to the SNES Gaussian interpolator).
   - FluidSynth's own reverb and chorus are **off**. All space comes from our echo, the same for every
     palette.
   - Output is float32. Measured: two notes 1.000 s apart render exactly 32000 samples apart. The
     start offset is constant (the preset's own attack).
3. **Mix** (`mix.py`, numpy/scipy, float64):
   - **Voice treatment** per job (palette `mix.voices`, round 2), then **part effects** per job (`fx`: filter →
     drive → pump, §2.4.2, round 3).
   - **Sum** sub-renders per stem: a dry bus and a wet bus.
   - **SNES echo** on each stem's wet bus:
     - Delay `d` = 16 ms × EDL (1-15).
     - Feedback `y[n] = x[n] + fb · FIR8(y[n−d])` with an 8-tap FIR inside the loop. The FIR presets
       (`flat`, `soft`, `dark`) are designed with `scipy.signal.firwin(8, …)` at 32 kHz.
     - Echo volume L/R, with optional right-channel inversion for the SNES "wide" trick.
     - It runs vectorised in blocks of `d` samples, valid because `d ≥ 16 ms ≫ 8 taps`.
     - The echo is a **per-stem** process, so stems still sum to the full mix.
     - Drums and bass are normally dry.
   - **Lowpass**: 2nd-order, about 14.5 kHz, for SNES DAC softness. It also helps both codecs.
   - **Crush** (optional, off in `cleared`): parallel blend of 12-bit quantisation and a 4-bit "BRR grit"
     emulation. Per song or per palette.
   - **Loudness.** Measure the **full mix of the loop body** (sum of all stems) with
     `ffmpeg -af ebur128=peak=true`. Apply one gain to every stem so the full mix is at
     **−16 LUFS integrated**, with **true peak ≤ −1.0 dBTP**. If the peak would be exceeded, lower the
     gain instead of limiting: a limiter is non-linear and would break "stems sum to the mix". The report
     records the result, e.g. "peak-limited, −16.6 LUFS". Base-only playback ends up quieter than the
     full mix (about −18 to −20 LUFS), which gives a natural lift when a wave starts.
   - Targets:

     | Material | Target |
     |---|---|
     | Music | −16 LUFS integrated, true peak ≤ −1 dBTP |
     | Jingles | −15 LUFS |
     | Stingers (they overlay music) | −18 LUFS |
     | SFX | Sample peak −3 dBFS, then a per-sound `gain_db` in `sprite.json` |

4. **Loop construction** (exact, no ghost tails). From the continuous render
   `R = [intro L0][cycle 1 P][cycle 2 P][tail]`, each stem file is:
   ```
   F = R[0 : L0+T]  ++  R[L0+P : L0+2P]
       └ head ┘         └ loop body = cycle 2 ┘
   ```
   - `T` = seam tail ≥ the echo decay to −60 dB and the release of the longest pad, rounded up to whole
     beats (typically 2 bars, at least 2.5 s).
   - Cycle 2's start already contains cycle 1's echo and release tail, which is exactly what the loop
     wrap needs.
   - The head contains the **intro's** tail over the first T seconds of the first pass, so the first pass
     is exact too.
   - Playback (§3.5) plays the head once, then enters the loop body at offset T. There is no crossfade
     and no "ghost" of the loop's end on the first pass. The cost is T extra seconds per file.
   - One-shots (jingles) are `R` trimmed after the tail falls below −70 dBFS, with a 5 ms fade.
   - `boss_warning` also has a loopable last bar (`holdStart` / `holdEnd`), so it can wait if the boss
     track is still decoding.
5. **Encode** (`encode.py`, ffmpeg 6.1.1):
   ```
   ffmpeg -i stem.wav -c:a libopus -b:a 48k -vbr on -application audio stem.webm      # Opus (48 kHz internal)
   ffmpeg -i stem.wav -c:a aac -b:a 64k -ar 32000 -movflags +faststart stem.m4a        # AAC-LC 32 kHz
   ```
   Secondary stems (`melody` / `prep` / `riser` / `intensity`) use AAC 48k. The SFX sprite is mono:
   Opus 32k and AAC 48k.

### 2.8 Formats, encoder priming and what was verified (2026-10-08)

| Check | Result |
|---|---|
| ffmpeg AAC (`-c:a aac`) in `.m4a` | Writes an MP4 **edit list** `elst media_time = 1024` (the priming samples). ffmpeg's own decoder honours it: a click at sample 3200 decodes at 3200. The decode keeps **end padding** (length rounded up to a multiple of 1024 frames), so `buffer.duration` must never be used as a loop end. The manifest's `loopEnd` is used instead |
| Opus (`libopus`) in `.webm` / `.ogg` | `OpusHead` pre-skip = 312. ffmpeg decode: click exact |
| Playwright Chromium 141 (no proprietary codecs) `decodeAudioData` | **AAC fails** ("Unable to decode audio data"), even though `canPlayType('audio/mp4')` answers `"maybe"`. **Opus decodes sample-exact**: a click at 10000 decodes at 10000 (44.1 kHz context) and 10884 (48 kHz context). The length is exact |
| Head + loop scheduling (§3.5) on a decoded Opus file in Chromium `OfflineAudioContext` at 32 kHz and 48 kHz | Error at the entry seam and at both wraps equals the error mid-file (≈ 0.008-0.009 RMS index-rounding baseline). There is no discontinuity, and the probe Δ is 0 |
| iOS Safari / Chrome on Android with AAC | **Not verifiable here.** That is why the runtime probe below exists, and why the Sound Test page (§6.6) shows the measured Δ on real phones |

Consequences:

- We ship **both** Opus `.webm` (primary) and AAC `.m4a` (fallback, iOS safety).
- The engine picks the format by **actually decoding a 1.5 KB probe file**, not by `canPlayType`.
  `public/audio/probe.webm` (1,554 B) and `probe.m4a` (1,291 B) each contain one click at sample 3200 at
  32 kHz.
- The engine measures the decoder offset Δ for that format once (normally 0). It adds Δ to every
  manifest position and caches it per user agent in `localStorage` (`sakura-audio-probe`).
- A format whose click lands more than 4096 samples off, or not at all, is rejected and the next one is
  tried.

### 2.9 `public/audio/music/manifest.json`

```json
{
  "version": 1, "rate": 32000, "palette": "cleared", "built": "2026-10-…", "tool": "studio 1",
  "formats": [ { "id": "opus", "ext": "webm", "mime": "audio/webm; codecs=opus" },
               { "id": "aac",  "ext": "m4a",  "mime": "audio/mp4; codecs=mp4a.40.2" } ],
  "probe": { "file": "probe", "clickSample": 3200 },
  "tracks": {
    "battle_blossom": {
      "title": "Blossom Brigade", "kind": "loop", "bus": "music",
      "bpm": 144.0014, "meter": [4, 4], "key": "D", "bars": { "intro": 2, "loop": 40 },
      "introEnd": 106666, "seam": 80000,
      "head": 186666, "loopStart": 186666, "loopEnd": 2319978, "entry": 266666,
      "lufs": -16.0, "truePeak": -1.6, "duck": { "stinger": -4 },
      "stems": {
        "base":      { "file": "battle_blossom.base",      "lufs": -18.7, "bytes": { "opus": 401234, "aac": 534567 } },
        "intensity": { "file": "battle_blossom.intensity", "lufs": -21.2, "bytes": { "opus": 301234, "aac": 401234 } }
      },
      "markers": { "A": 2, "B": 22 }
    },
    "boss_warning": { "kind": "oneshot", "bus": "music", "length": 115200, "holdStart": 96000, "holdEnd": 115200,
                      "stems": { "full": { "file": "boss_warning.full" } } }
  }
}
```

All positions are **samples at `rate`** (32 kHz). The engine converts them to seconds and adds the probe
Δ. `head` = `introEnd + seam`, `loopStart` = `head`, `loopEnd` = `head + P`, `entry` = `loopStart + seam`.
`P` is a multiple of 64 samples (tempo snap, §2.7). `markers` are bar numbers, used for quantised jumps.

### 2.10 Size and memory budget

| Item | Duration (all stems) | Opus 48k | AAC 64k/48k |
|---|---|---|---|
| Menus: title, homeroom ×2, march ×2, wishing ×2, mall | ≈ 9.0 min | ≈ 3.2 MB | ≈ 3.9 MB |
| Battle families 5 × (base + intensity) | ≈ 11.6 min | ≈ 4.2 MB | ≈ 4.9 MB |
| Boss + final boss (base + intensity) | ≈ 5.3 min | ≈ 1.9 MB | ≈ 2.3 MB |
| Jingles, stingers, results loops | ≈ 1.5 min | ≈ 0.6 MB | ≈ 0.7 MB |
| **Total music** | **≈ 29 min** | **≈ 10.5 MB** | **≈ 11.8 MB** |
| SFX sprite (mono, ≈ 30 s for 84 sounds) | | ≤ 150 KB | ≤ 250 KB |

- **Gates** (enforced by `ship` and `tests/audio/manifest.test.js`): Opus ≤ 11 MB, AAC ≤ 13 MB, both
  together ≤ 25 MB, sprite ≤ 300 KB per format.
- **Levers if over:** shorten loops (60-70 s is plenty), lower the secondary-stem bitrate, merge the boss
  intensity stems.
- **Downloads are per screen.** The first lobby needs homeroom (≈ 1.1 MB) + sprite. A battle needs about
  0.9-1.0 MB.
- **Memory:** decoded audio is float32 at the 32 kHz context rate = 256 KB per stereo second, e.g.
  ≈ 37 MB for a battle track with both stems. The loader keeps an **LRU of decoded buffers**: 96 MB on
  phones (`pointer: coarse`), 256 MB on desktop. It also keeps a 16 MB LRU of compressed bytes, so
  re-decoding never refetches.
- The 32 kHz context (SNES native rate) costs a third less memory than 48 kHz. It can be overridden
  (§3.2).
- The desktop exe embeds `dist/`. It only needs the Opus set (`desktop/build.mjs` may drop `*.m4a`; ask
  the desktop owner).

### 2.11 SFX generator and sprite

`sfx/synth.py` primitives (numpy, 32 kHz mono, seeded RNG):

| Kind | Primitives |
|---|---|
| Oscillators | Pulse (duty 12.5/25/50 %), NES triangle (4-bit stepped), saw, sine |
| Noise | NES LFSR noise (long and short "metallic" mode), white, pink |
| Shaping | ADSR and exponential envelopes, NES 16-step volume, pitch sweeps (linear / exponential in semitones), arpeggio tables (FamiTracker-style), vibrato |
| Synthesis | 2-operator FM (bells, chimes), Karplus-Strong pluck (koto blips), band-passed noise whooshes |
| Effects | Bit and rate crush, the same SNES echo as the music |
| Helpers | `seq([(t, sound), …])` layering |
| `sampled(role, notes)` | Renders a tiny MIDI phrase through the **current palette** (harp gliss, glock, orchestra hit, taiko), so `--palette toby` changes those SFX too |

Each recipe:

```python
@sfx('ui.confirm', bus='ui', gain_db=-6, voices=2, gap_ms=40, jitter=0.0, priority=2)
def confirm(r):    # r = seeded helpers
    return seq([(0.000, pulse(1046.5, 0.045, duty=0.25, env=nes_decay(0.045))),
                (0.045, pulse(1568.0, 0.090, duty=0.25, env=nes_decay(0.09))),
               ]) | echo('ui')
```

- **Sprite.** All SFX are trimmed, peak-normalised to −3 dBFS and given 2 ms edge fades. They are packed
  with 3200 samples (0.1 s) of silence between them (more than any codec smear) into `sfx.webm` and
  `sfx.m4a`.
- **`public/audio/sfx/sprite.json`:**
  ```json
  { "version": 1, "rate": 32000, "files": { "opus": "sfx.webm", "aac": "sfx.m4a" },
    "sounds": { "ui.confirm": { "start": 12800, "length": 4480, "gain_db": -6, "bus": "ui", "voices": 2,
                                "gap_ms": 40, "jitter": 0, "priority": 2 } } }
  ```
- Gains, caps and jitter are applied at runtime, so balancing SFX never needs a re-encode. Only the
  recipes do.
- **Part sprites.** A recipe registered with `part='<name>'` ships in its own small sprite,
  `sfx-<name>.webm` / `.m4a`, appended after the main one: `studio.py sfx-part <name>` renders only those
  recipes and merges them into `sprite.json` (`parts: [{ id, start, length, files }]`, `mainLength`, and
  `length` = the whole; each part sound has an absolute `start` and `part`). Adding a few sounds therefore
  never re-encodes the other 84 (whose sampled recipes need FluidSynth and the soundfonts). The player
  decodes every file and lays each part into the one SFX buffer at its start (`src/audio/sfx.js` `stitch`),
  so `play()` is unchanged; a full `studio.py sfx` rebuild re-attaches the parts. FX-1 adds the `attacks`
  part (8 sounds, 2.2 s; 7 KB Opus + 18 KB AAC).

---

## 3. Game playback engine: `src/audio/`

### 3.1 Modules

| File | Role | Node-safe at import |
|---|---|---|
| `cue.js` | `cue(name, data)` / `onCue(fn)` / `getAudio()`. A queue until the engine boots, a no-op in Node. **This is the only module other areas import.** | yes |
| `index.js` | `initAudio({ store })`: boots everything, exposes `window.__sakura.audio` (debug + e2e) | yes |
| `engine.js` | AudioContext, unlock, buses, visibility, probe/format choice, volumes | yes (lazy ctx) |
| `loader.js` | fetch + `decodeAudioData`, LRU (bytes and decoded), preload queue | yes |
| `music.js` | MusicDirector: tracks, stems, head/loop scheduling, transitions, stingers, ducking | yes |
| `sfx.js` | SfxPlayer: sprite, voice pool, caps, rate limits, pan | yes |
| `routes.js` | Pure tables: route → track/stems, map theme → battle family, boss → track, preload graph | yes |
| `cues.js` | Pure table: cue name → actions (sfx ids, music calls) | yes |
| `battle.js` | `attachBattleAudio(ctx)` | yes |
| `economy.js` | `economyCues(prev, next, reason)` (pure) + store subscriber | yes |
| `domSfx.js` | Delegated clicks + MutationObserver (§1.5) | yes (installs in `initAudio`) |
| `soundTest.js` | Optional `#/soundtest` jukebox screen (§6.6) | — |

### 3.2 Context, unlock and platform rules

- `new AudioContext({ sampleRate: 32000, latencyHint: 'interactive' })`. If that throws, use the default
  rate. A `localStorage['sakura-audio-rate']` override (e.g. `48000`) exists for problem devices.
- Creation is lazy: the context is created at boot only if `navigator.userActivation?.hasBeenActive`.
  Otherwise it waits for the first gesture.
- **Autoplay.** At boot the engine tries `ctx.resume()`. It succeeds on Android Chrome for
  home-screen-installed PWAs, with high media engagement on desktop, and in the desktop exe if its
  launcher adds `--autoplay-policy=no-user-gesture-required`. If it succeeds, the title theme plays
  immediately. Otherwise the engine arms gesture listeners (`pointerup`, `touchend`, `click`, `keydown`,
  capture). Inside the handler it:
  1. Resumes the context.
  2. Starts a 1-sample silent buffer (iOS).
  3. Sets `navigator.audioSession.type` (Safari 16.4+): `'playback'` while Music is on, so the game is
     audible with the ringer switch off as the owner expects; `'ambient'` when Music is off, so it mixes
     with the player's own music.
  4. Removes the listeners.
- **Deferred start.** On the title screen the unlocking tap is also TAP TO START, which navigates to
  the lobby 260 ms later. So the pending track starts **350 ms after unlock** and re-reads the route
  first. This means the title theme is not blipped before the lobby.
- **Visibility.** `hidden` → `ctx.suspend()`. `visible` → `ctx.resume()`. All schedules stay
  sample-locked because the context clock stops too. An unexpected `suspended` or `interrupted` state
  while visible re-arms the unlock listeners.
- **Disabled buses don't download.** With Music off the director stops and fetches nothing. With SFX off
  the sprite is not loaded. With `navigator.connection.saveData` set, prefetching is off.

### 3.3 Bus graph and volumes

```
music stems ─┬─ stemGain ─┐
             └─ …         ├─ trackGain ─┐
stinger/jingle ───────────┘             ├─ musicDuck ─ musicPauseLPF ─ musicBus ─┐
                                                                                 ├─ master ─ safety compressor ─ destination
sfx voices ─ voiceGain ─ panner ─ {uiBus, battleBus} ─ sfxBus ───────────────────┘
```

| Bus | Gain |
|---|---|
| `master` | `settings.volume` (0.8) |
| `musicBus` | `settings.music ? musicVolume : 0` (0.7) |
| `sfxBus` | `settings.sfx ? sfxVolume : 0` (0.8) |

- All changes ramp with `setTargetAtTime(…, 0.05)`. The engine re-applies volumes on store `change`
  with reason `settings` / `replace`, and on `cue('settings.audio')` while a slider is dragged.
- **Safety compressor:** threshold −3 dBFS, ratio 12, knee 3, attack 3 ms, release 150 ms. It only
  catches overs; music is mastered with headroom.
- `battleBus` changes with game speed: 0 / −2 / −4 dB at 1× / 2× / 3×. It drops −6 dB while a
  victory or defeat jingle plays and is muted while paused.

### 3.4 Loader and preloading

- URLs are `${import.meta.env.BASE_URL}audio/…`. That resolves to `./audio/…` under `base: './'`, the
  same scheme as `src/models/glbChibi.js:29`, so it works on GitHub Pages, in a subfolder and in the
  exe.
- `loader.load(trackId)`: fetch every stem's ArrayBuffer (kept compressed in the bytes LRU), then decode
  each stem (`decodeAudioData(bytes.slice(0))`), then insert the result into the decoded LRU (byte
  budget §2.10). Evicting never touches the playing or pending track, or the sprite.
- **Preload graph** (`routes.js`, the next likely screens). It fetches bytes only, except where marked
  "decode":

  | Current | Preload |
  |---|---|
  | `title` | homeroom (decode) |
  | `lobby` | march, wishing |
  | `missions` / `campaign` / `bounty` / `assault` / `challenge` | The battle family of `nextStage(profile)` |
  | `stage` (prep) | **Decode** the stage's battle family, its wave sting, victory, defeat. Fetch `boss` or `final` when the stage has a boss in its `waveGen.fixed` |
  | `battle` | Results loops. **Decode** the boss track when `sim.wave ≥ bossWave − 2` (or immediately on boss arenas) |
  | `recruit` | Decode the R / SR / SSR fanfares and `gacha.newStudent` |

- **Ordered decode** (round 2, `loader.loadStems`): all stem bytes are fetched at once, the first stem (`base` /
  `full`) is decoded first and the others after it. `MusicDirector.play` starts a track as soon as its first
  stem is decoded when the other stems start silent (intensity, riser, prep at 0) or when nothing is playing
  yet; the others join sample-locked at the track's current musical position (`_attachLate`). Under a playing
  track every audible stem is awaited, so a crossfade never arrives without its tune.
- **Before the first tap** (round 2, `index.js prefetchFirst`): once the manifest is in, the bytes of the
  screen's track (on `title`: the lobby's) are fetched in the format the probe will most likely pick
  (`engine.guessFormat`: this browser's cached probe result, else the first `canPlayType() === 'probably'`). No
  AudioContext is created, so no autoplay warning. After the tap the decode starts right after the probe,
  before the 350 ms settle that waits for the tap's own navigation. Measured (`e2e/audio.mjs`, load average
  19): tap → lobby music 2.5 s (round 1: 5.1 s).

### 3.5 Music director: scheduling math

For one track: `t0` = context time when musical position 0 plays. `m` = musical seconds since song start
(unbounded). File positions in seconds are `pos(x) = x / rate + Δ`, with `x` in manifest samples.

```
head    = introEnd + seam          (one-shot region of the file)
musical → file:  m < head  ⇒  file = m
                 m ≥ head  ⇒  u = (m − introEnd) mod P ;  file = loopStart + u     (P = loopEnd − loopStart)
```

Start a stem at musical position `m` (0 for a fresh start) at context time `when`:

```js
if (m < head) {
  A = src(buf); A.start(when, pos(m), head - m);                                   // play the rest of the head once
  B = src(buf, { loop: true, loopStart: pos(loopStart), loopEnd: pos(loopEnd) });
  B.start(when + (head - m), pos(entry));                                          // enter the loop body at offset T
} else {
  B = src(buf, { loop: true, … }); B.start(when, pos(loopStart + ((m - introEnd) % P)));
}
```

(`m`, `head`, `P`, `introEnd`, `entry` in seconds. Δ applied in `pos`.)

- **All stems of a track get the same `when` and `m`.** They are sample-locked, verified in Chromium
  for this scheme (§2.8).
- **A stem's level** is its own `GainNode`. Silent stems keep playing at gain 0, so un-muting is a pure
  gain ramp.
- **The musical grid** comes from the manifest: `bpm`, `meter` and intro bars, with `introEnd` and `P` as
  whole bars. `nextBeat` / `nextBar` / `nextMarker` are computed from `m`.

**Director API**

```js
music.play(trackId, { stems: { base: 1, intensity: 0 }, transition: 'bar'|'beat'|'now'|'cut', fade: 1.2, from: 0 })
music.setStems({ intensity: 1 }, { quantize: 'beat'|'bar', fade: bars(1) })
music.stinger(id, { duck: -4, quantize: 'accent'|'now'|'beat'|'bar' })   // one-shot on the music bus
// 'accent' (battle default, round 2): the sting starts so that its stab — manifest `accent`, samples, from the
// song's `extra={'accentBeat': n}` — lands on the playing loop's next half bar (whole bar in odd meters)
music.bossTakeover('boss')   // stop 0.35 s → boss_warning → boss track at its end; if the boss track is not
                             // decoded 0.12 s before that end, the warning's `hold` loop (boss_warning_hold) plays
                             // on and the boss track enters on the hold's next bar line
music.jingle(id, { stopMusic: true, then: 'results_win' })               // victory/defeat/levelup…
music.duck(tag, dB, { lpf: 1200, attack: 0.2, release: 0.4 }); music.unduck(tag)
music.stop({ fade: 0.3 })
music.state()  // { track, m, stems, ducks, pending }
```

**Transitions**

| Name | Behaviour | Used for |
|---|---|---|
| `bar` (default between different tracks) | The old track's gains ramp to 0 over the fade, starting at its next bar. The new track starts at that same instant from its head (its intro is written to enter from silence) | Route changes |
| `stem` | Same track: only stem gains change, from the next beat, over 1-2 bars. Nothing restarts | lobby ⇄ menus, map ⇄ prep, recruit ⇄ reveal, battle build ⇄ wave |
| `cut` | 0.25-0.35 s fade, then the jingle or stinger | Victory, defeat, boss warning |
| `now` | Immediate equal-power crossfade, 0.6 s | Leaving battle early, errors |

**Ducking** (tags stack; the deepest wins):

| Situation | Music | SFX |
|---|---|---|
| Modal open (`.modal-overlay`) | −4 dB | — |
| Battle paused | −8 dB + lowpass 1.2 kHz ("muffled") | Battle bus muted |
| Wave-start / final-wave stinger | −4 dB for its length | — |
| Miniboss stinger | −10 dB for its length | — |
| Boss warning | Music stops (0.35 s) | — |
| Gacha reveal | Wishing `riser` stem → 1, base −3 dB | — |
| SSR showcase | Music −30 dB while the SSR fanfare plays | — |
| Level-up / awaken jingles in menus | −10 dB for the jingle | — |
| Victory / defeat | Music stops | Battle bus −6 dB |
| Tab hidden | Context suspended | Context suspended |

### 3.6 Route → music table (`routes.js`)

| Route | Track | Stems |
|---|---|---|
| `title` | `title` | full |
| `lobby` | `homeroom` | base 1, melody 1 |
| `students`, `student`, `formation`, `backpack`, `bestiary`, `wiki`, `commissions`, `rewards` | `homeroom` ("Study Hall" = the same song, melody stem faded out) | base 1, melody 0 |
| `settings` | Keep whatever is playing (title, lobby, …). If nothing is playing: homeroom / Study Hall | — |
| `missions`, `campaign`, `bounty`, `assault`, `challenge` | `march` | base 1, prep 0 |
| `stage` (prep) | `march` | base 1, prep 1 (snare march + low brass enter: "get ready") |
| `recruit` | `wishing` | base 1, riser 0 (riser 1 during the reveal) |
| `mall` | `mall` | full |
| `battle` | `battle_<family>` from `getMap(STAGE_MAP[stage].mapId).theme` | base 1, intensity 0 or 1 by sim state |
| `coop` (wt-online, if merged) | `march` | base 1, prep 0 |
| Unknown route | Keep current | — |

**Map theme → battle family** (all 11 themes in `src/data/maps.js`; 49 maps):

| Theme (maps) | Family track |
|---|---|
| `sakura` (6), `arena` (1) | `battle_blossom` |
| `lake` (6), `snow` (2), `night` (2) | `battle_moonlit` |
| `shrine` (5), `marsh` (5) | `battle_lantern` |
| `mountain` (6), `foundry` (7) | `battle_ironclock` |
| `festival` (5), `volcano` (4) | `battle_matsuri` |

Campaign coverage: chapter 1 → blossom; 2 → moonlit; 3 and 5 → lantern; 4 and 6 → ironclock; 7 → matsuri;
8 → moonlit (8-1, 8-2 snow) then matsuri (8-3 to 8-5 volcano). Bounty: sakura, lake, foundry, mountain,
night. Boss arenas: night, foundry, volcano. Challenge: arena.

**Bosses → track:**
- `dragon_ashwing` (8-5, `boss-ashwing`, challenge wave 70) → `final`.
- `grave_lych` (`boss-lych`, challenge wave 50) and `iron_colossus` (`boss-colossus`, challenge wave 60)
  → `boss`.
- Minibosses (`slime_prince` 1-5 wave 18, `orc_general` 4-5 wave 26, `goblin_machine` 6-5 wave 28,
  `oni_champion` 7-5 wave 30; challenge waves 10-40) → the `miniboss` stinger plus forced intensity. No
  track change.

### 3.7 Battle music logic (`battle.js`)

| Moment | Music |
|---|---|
| Mount (battle built) | `music.play(battle_<family>, { stems: { base: 1, intensity: 0 }, transition: 'bar' })`. It was decoded during the stage prep / loading card |
| `waveStart` | `stinger('wave_<family>' or 'final_wave', { duck: -4 })`, then `setStems({ intensity: 1 }, { quantize: 'beat', fade: 1 bar })` |
| `waveEnd` | Unless `sim.state === 'wave'` again within 2 s: `setStems({ intensity: 0 }, { quantize: 'bar', fade: 2 bars })` |
| Miniboss `spawn` | `stinger('miniboss', { duck: -10 })`. Intensity is held at 1 until that miniboss's `death` |
| Boss `spawn` | `stop({ fade: 0.35 })`, then `stinger('boss_warning')`, then `play(bossTrack, { transition: 'now', at: stingEnd })`. If the boss track is not decoded yet, the warning's hold bar loops until it is |
| `bossPhase` | Boss track `setStems({ intensity: 1 }, { quantize: 'bar', fade: 1 bar })` |
| Boss `death` | If `won` follows, the victory flow takes over. In endless mode the family track returns at the next bar (`transition: 'bar'`) |
| `won` / `lost` | `jingle('victory' / 'defeat', { stopMusic: true, then: 'results_win' / 'results_lose' })` |
| Pause | `duck('pause', -8, { lpf: 1200 })`, battle bus mute. Resume: unduck |
| Leaving battle | The route change handles the next track |

### 3.8 SFX player (`sfx.js`)

- **Buffer.** One mono AudioBuffer for the whole sprite, decoded once after unlock if SFX are on.
- **Playing a sound.** `play(id, { pan, rate, gain, when, data })` starts
  `source.start(when, pos(start), length/rate)` with `playbackRate = rate × (1 ± jitter)`.
- **Voices.** A pre-built pool of `{ GainNode, StereoPannerNode }` pairs, sized to the global cap. A new
  `AudioBufferSourceNode` per play is cheap; nodes are reused.
- **Caps.**
  - Global: 14 voices on phones (`matchMedia('(pointer: coarse)')`), 28 on desktop.
  - The UI bus has its own 6 voices, so it is never starved by battle.
  - Per-sound `voices` and `gap_ms` (minimum retrigger interval, in real time).
  - **Steal policy:** the oldest voice with lower priority is released over 30 ms. Otherwise the new
    sound is dropped.
- **Per-frame aggregation for battle.** `events(evts)` first buckets one frame's events:

  | Bucket | Per-frame limit and choice |
  |---|---|
  | Fire | ≤ 3 per frame, one per kind |
  | Hit | ≤ 2, picks crit, then super-effective, then highest amount |
  | Death | ≤ 2, picks boss, then big, then small |
  | Status | ≤ 1 per status |
  | Explode | ≤ 2 |
  | Place, upgrade, sell, leak, wave, boss, hero | Always (high priority) |

- **Speed profile.** At 2× / 3×, `gap_ms` of fire, hit, status and boom sounds are multiplied by √speed, and
  the battle bus gain drops (§3.3).
- **Spam budgets** (`limiter.js` `SPAM_BUDGET`, token buckets in real time, burst 3, whatever the game speed):
  attacks (`fire.*` + `atk.*`) 12/s, hits 9/s, enemy deaths 6/s, statuses 3/s, booms 3/s. Per-sound gaps alone
  were not enough: ten attack and hit kinds each at their own maximum added up to ~55 a second. UI, player
  actions, leaks, wave flow, hero, boss and gacha sounds are never budgeted.
- **Measured** (`node e2e/audio-dense.mjs`, 2026-10-08): stage 8-5 hard, wave 26, 19 girls, ~60 enemies, ×3:
  the sim emits ~760 hits, ~200 statuses and ~57 attacks a second; 21 attack + hit sounds a second reach the
  speakers (≈ 34 sounds/s in all), at most 11 battle voices (cap 28; 9 of 14 on a phone), output true peak
  −7.4 dBTP at the default volumes and −2.6 dBTP with every slider at 100 % (with the hero ult, a boss-phase
  roar and a leak on top); the safety compressor never engages; energy above 8 kHz 26 dB under the mix.
- **Clean edges.** `synth.seq()` gives every layer a 3 ms raised-cosine release and `fmx()` a 4 ms one, so a
  decaying blip or bell that stops at 8-30 % of its level no longer ends on a step (a click per hit).
- **Positional pan.** `pan = clamp((x / map.width) * 2 − 1) × 0.5`. Hits use the enemy x, fires use the
  tower x.
- **Determinism.** Jitter uses its own RNG and never touches the sim's seeded RNG.

### 3.9 Debug API and failure modes

`window.__sakura.audio`:
- `state()` → `{ ctx, rate, format, delta, unlocked, track, m, stems, ducks, voices, decodedBytes, pending }`
- `play(id)`, `sfx(id)`, `music`, `setVolumes()`

Failure modes:
- Every load and decode failure is caught and logged once (`[audio] …`). The game never waits on audio.
- A missing track means silence for that screen.
- A missing sprite id is a warning, not a throw.
- If WebAudio is unavailable, the engine stays inert.

---

## 4. Soundtrack: style, leitmotifs, main theme, track list

### 4.1 Style guide (what "Toby Fox + EarthBound + NES" means here)

- **Hooks first.** Every track has a 2-bar melodic cell with its own rhythmic signature, repeated with
  altered endings (AA′BA′, call and answer). You should be able to hum it after one loop.
- **Harmony with colour:**
  - maj7, 9ths and 13ths; ii–V motion; secondary dominants.
  - The **chromatic minor iv** (Bbm6 in F) and diminished passing chords (B°7 between Bb and C/F).
  - bVI–bVII–I cadences and pedal points.
  - Playful mediant key changes: F → Ab, D → F, G → Bb, Cm → Eb.
- **Bass:**
  - Syncopated slap or finger bass with octave pops and chromatic approach notes.
  - Walking bass in swing tracks.
  - Chip triangle bass for NES flavour.
- **Drums:**
  - Tight and dry (no echo), "crunchy" kit, shuffle where it fits.
  - Fills every 4 and 8 bars, a crash on section downbeats.
  - Chip-noise hats layered over real hats.
- **Chip and real instruments together** (the EarthBound/Toby signature):
  - A pulse lead doubled an octave up by glock, music box or trumpet.
  - `chip:arp32` chord arpeggios as pads.
  - Quirky GM colours: slap bass, brass stabs, organ, e-piano, marimba/xylophone, steel drum, music box,
    choir "ahh", orchestra hit.
  - For the Japanese academy setting: koto, shamisen and shakuhachi.
- **Space:** SNES echo on leads, pads and music box (180-240 ms, feedback 0.35-0.5). Drums and bass stay
  dry. The music is mono-compatible and slightly lowpassed.
- **Mood:** cute anime girls defending their academy. Cheerful, adventurous, heartfelt. Bosses intense and
  driving. Spooky maps are spooky-*cute*, never horror.
- **Forbidden:**
  - Quoting or paraphrasing any existing melody, riff, chord-and-rhythm signature or arrangement.
    Explicitly: no Undertale, Deltarune, EarthBound or Mother melodies, Megalovania-style openings
    (repeated root, then an octave leap and a descending chromatic run), or the Undertale "Once Upon a
    Time" contour.
  - Generic idioms (a bVI–bVII–I cadence, a I–vi–IV–V loop, a snare roll) are fine. Recognisable hooks
    are not.

### 4.2 Leitmotifs (`songs/motifs.py`)

| Motif | Definition | Character | Where |
|---|---|---|---|
| **BELL** "Sakura Bell", the music-box motif | Intervals **+5, −3, +2** (4 notes), rhythm ♪ ♪ ♩ ♩. ("question", ends on the leading tone). **Answer** = one more step up to the tonic. In F: **C–F–D–E (→ F)**. Minor form: −5, 0, −4, −1 from the tonic (A minor: E–A–F–G♯ → A) | Hopeful, a little wistful. The academy's heart | Every track, at least once. Its home timbre is the **music box** with SNES echo |
| **SENTINEL CALL** | Intervals **+5, +5, +2, −2** (5 notes; round 1 had +5 +5 −1 +1), rhythm ♪. ♬ ♩ ♪ ♩. (dotted-8th, 16th, quarter, 8th, dotted quarter). In B♭: F4–B♭4–E♭5–F5–E♭5 | Brass call to action, the girls rallying | march, battle intensity stems, final boss |
| **SHADOW** (enemies) | Intervals **+1, −1, +6, −3** (5 notes), rhythm ♬ ♪ ♩ ♩. (+♪ rest). In D: D–E♭–D–A♭–F | The monsters' unease: tritone, chromatic neighbour | miniboss and boss stingers, boss tracks, defeat |

Motif transforms in `theory.py`:
- `transpose(key)`, `degree_map(mode)` (diatonic re-mapping, so BELL in minor uses the harmonic-minor
  leading tone)
- `invert()`, `augment(2)`, `diminish(2)`, `rhythm(pattern)`
- `question()`, `answer()`

### 4.3 The main theme, written out ("Sakura Sentinels")

F major, 4/4, ♩ = 132, straight eighths. ⟨B⟩ marks the BELL motif. Durations: 8 = ♪, 4 = ♩, 4. = ♩.,
2 = 𝅗𝅥. Range G4–E♭6, so the same line works for chip lead, flute, music box or glock.

| Bar | Chord | Melody |
|---|---|---|
| **A** | | |
| 1 | Fmaj7 | ⟨B⟩ C5/8 F5/8 D5/4 E5/4. · F5/8 (pickup) |
| 2 | Dm9 | A5/4 G5/8 F5/8 E5/4 D5/4 |
| 3 | B♭maj7 | ⟨B⟩ C5/8 F5/8 D5/4 · E5/8 F5/8 G5/4 (E over B♭ = ♯11 colour) |
| 4 | C7sus4 → C7 | A5/4. G5/8 · C5/2 |
| **A′** | | |
| 5 | Am7 | ⟨B⟩ C5/8 F5/8 D5/4 E5/4 C6/4 (leap = lift) |
| 6 | D7(♭9) | A5/8 B♭5/8 A5/8 F♯5/8 E♭5/4 D5/4 |
| 7 | Gm9 → B♭m6 | G5/4 B♭5/8 A5/8 · G5/8 F5/8 D♭5/4 (chromatic minor iv: the heart-tug) |
| 8 | F/C → C7 | C5/4. D5/8 · E5/4 G5/4 |
| **B** (playful lift to the flat side) | | |
| 9 | D♭maj7 | A♭5/8 F5/8 C6/4 B♭5/8 A♭5/8 F5/4 |
| 10 | E♭maj9 | B♭5/8 G5/8 D6/4 C6/8 B♭5/8 G5/4 (sequence a tone up) |
| 11 | Fmaj7 → F7/A | A5/4 C6/4 · E♭6/4 D6/8 C6/8 |
| 12 | B♭maj7 → B°7 | D6/4. C6/8 · F5/8 A♭5/8 B5/4 (bass B♭ → B → C) |
| 13 | F/C → D7 | C6/4 A5/8 G5/8 · F♯5/8 A5/8 C6/4 |
| 14 | Gm7 → C7 | B♭5/4. A5/8 · G5/8 E5/8 C5/4 |
| 15 | Am7 → A♭°7 | E5/4 C5/8 A4/8 · B4/8 D5/8 F5/4 (bass A → A♭ → G) |
| 16 | Gm13 → C7(♭9) | E5/2 · D5/8 D♭5/8 C5/8 G4/8 → back to bar 1 |

- Every bar sums to 4 beats; the validator checks this in the song file.
- Bass: `bass:sync` in A/A′. In B, half notes following the written roots, with the chromatic lines of
  bars 12 and 15 played exactly.
- **The music-box fragment** that recurs everywhere: **C6/8 F6/8 D6/4 E6/4.** (question) … **F6/2**
  (answer). It is usually left as the bare question at a phrase end, and the answer is saved for
  emotional payoffs (victory, SSR, new student, awaken).
- **The 4-note victory sting:** **C5/16 F5/16 D5/8 F5/4**. This is the motif with its question already
  answered. In the victory jingle, a bVI–bVII–I brass cadence follows it (D♭ → E♭ → F(add9), top line
  F5 → G5 → A5) over a cymbal swell.

### 4.4 Track list

Loop lengths = bars × 4 × 60 / BPM. File length = intro + seam (≈ 2.5 s) + loop.

| ID | Title | Use | Tempo / key / meter | Mood | Intro + loop | Stems | Leitmotif use | Palette roles |
|---|---|---|---|---|---|---|---|---|
| `title` | **Sakura Sentinels** | Title screen (plays when audio is already unlocked; its music-box intro also opens `homeroom`) | 132, F → A♭ (last 8 bars), 4/4 | Bright, sweeping, "the adventure starts" | 4 + 24 bars (7.3 s + 43.6 s) | full | Full main theme (A A′ B), last 8 bars = A in A♭ (lift), back to F via E♭7 (backdoor) | music_box, harp, chip_pulse25 + glock (lead doubling), strings, brass, choir_ahh (B), timpani, orch_hit (A♭ downbeat), finger_bass, drums |
| `homeroom` | **Homeroom** (+ "Study Hall" variant) | Lobby (full); students, formation, backpack, bestiary, wiki, commissions, rewards (melody stem off) | 96 swing (0.62), F major, bridge in B♭ | Cosy, after-school sunshine, lo-fi jazz | 2 + 24 bars (5 s + 60 s) | base, melody | Intro = music-box BELL (question → answer). H = Homeroom's own hook (vibes + ocarina; e-piano Bell in the gaps). Bridge = a new after-school melody in B♭ with e-piano BELL answers. A = main theme bars 1-8, re-harmonised (Fmaj9, Dm11, B♭maj9, C13sus4…) on music box + vibes | base: epiano, finger_bass (walking), drums_brush, marimba comp, pad_warm. melody: vibes (lead), music_box, chip_triangle counter-line |
| `march` | **Sentinel March** | Campaign map, missions hub, bounty, assault, challenge (base). Stage prep (+prep) | 120, B♭ major, lydian E♮ colour, bridge to D♭, 4/4 | Adventurous overworld, determined but bouncy | 2 + 32 bars (4 s + 64 s) | base, prep | Melody = SENTINEL CALL (trumpet + chip_pulse12). Bridge: flute BELL in D♭ (A♭5–D♭6–B♭5–C6 → D♭6) | base: trumpet, chip_pulse12, strings, pizz, flute, finger_bass, glock, drums. prep: snare march ostinato (drums_orch), trombone/tuba, timpani |
| `wishing` | **Wishing Envelope** | Recruit screen; reveal anticipation (+riser) | 84, E major, 4/4 | Dreamy, sparkling, held breath | 2 + 16 bars (5.7 s + 45.7 s) | base, riser | Celesta BELL **always left as the question** (B5–E6–C♯6–D♯6), never answered until a fanfare answers it | base: harp (arps on Emaj9 – C♯m9 – Amaj9 – B7sus4), celesta, pad_halo, music_box, soft kick. riser: tremolo strings crescendo, timpani heartbeat, rev_cymbal every 2 bars, choir_ooh |
| `mall` | **Sakura Mall** | Mall / shop | 108, G major, bridge in B♭, 4/4 bossa-funk | Cheeky, window-shopping fun | 1 + 24 bars (2.2 s + 53.3 s) | full | Steel-drum BELL fill at bars 8 and 24 (D5–G5–E5–F♯5 → G5), and a "cha-ching" chip arp | steel_drum (lead), slap_bass, epiano, organ stabs, vibes, chip_pulse50 answers, drums (bossa + shaker/conga) |
| `battle_blossom` | **Blossom Brigade** | sakura, arena | 144, D major, B section in F (up a minor 3rd), 4/4 | Cheerful, bouncy first adventure, heroic | 2 + 40 bars (3.3 s + 66.7 s) | base, intensity | **Heroic main theme**: B section = main theme bars 1-8 in F, double-time feel, BELL with brass hits. A section = its own original hook | base: chip_pulse25 lead, slap_bass, marimba ostinato, epiano stabs, drums. intensity: chip_pulse12 SENTINEL CALL counter-line, brass_stab, orch_hit on phrase ends, claps + double-time hats, strings octaves |
| `battle_moonlit` | **Moonlit Ripples** | lake, snow, night | 126 shuffle, A minor → C major chorus, 4/4 | Cool, gliding, moonlight on water | 2 + 32 bars (3.8 s + 61 s) | base, intensity | Music-box BELL in minor in the break (E5–A5–F5–G♯5, unanswered). The chorus answers it in C | base: vibes, harp ostinato, chip_triangle bass ostinato, flute lead, drums_brush. intensity: full shuffle kit, finger_bass doubling, pizz, kalimba ripples, chip_pulse25 counter |
| `battle_lantern` | **Lantern Hush** | shrine, marsh | 112, E minor with Phrygian colour, 4/4 | Spooky-cute, lantern light, ghosts and frogs | 2 + 32 bars (4.3 s + 68.6 s) | base, intensity | BELL on koto in Phrygian form (B4–E5–C5–D5) and inverted on a detuned music box | base: koto ostinato, shamisen plucks, upright_bass pizz, music_box (pitch-wobbled), woodblock, choir_ooh pad. intensity: taiko pattern, shakuhachi lead, low brass swells, chip-noise hats, synth_bass |
| `battle_ironclock` | **Ironclock Overdrive** | mountain, foundry | 152, G minor (dorian) with mixolydian riff, 4/4 | Mechanical, stomping, gears and armour | 2 + 40 bars (3.2 s + 63.2 s) | base, intensity | BELL as a syncopated brass riff in G minor (D–G–E♭–F♯ → G), bars 17-24. SENTINEL CALL in the guitar | base: slap_bass riff, organ (percussive), chip_pulse50 bass, cowbell/agogo "anvil", drums (crunchy). intensity: brass section, overdrive_gtr, orch_hit, tom fills, chip_pulse25 counter-lead |
| `battle_matsuri` | **Oni Matsuri** | festival, volcano | 160, C minor → E♭ major chorus, 4/4 | Hot, festive, drums and fire | 2 + 40 bars (3 s + 60 s) | base, intensity | Shamisen BELL in C minor (G–C–A♭–B → C). Triumphant in the E♭ chorus (B♭–E♭–C–D → E♭) | base: taiko groove, shamisen, flute (festival fue), finger_bass, chip_pulse25 lead. intensity: double taiko + timpani, choir_ahh stabs, brass, orch_hit, string runs |
| `boss` | **Hold the Line!** | Grave Lych, Iron Colossus, challenge bosses at waves 50 and 60 | 168, D minor → F major "hope" section, 4/4 | Frantic, driving, then defiant | 4 + 48 bars (5.7 s + 68.6 s) | base (phase 1), intensity (phase 2+) | Intro: SHADOW in low brass and organ (D–E♭–D–A♭–F). A: **frantic minor main theme** (A4–D5–B♭4–C♯5 → D5…) over 16th-note chip arps. B: SHADOW vs BELL counterpoint. C: **hope**: main theme bars 9-12 heroic in F (brass + choir), pivot back via A7(♭9) | base: organ, chip_pulse25 + chip_arp32, slap_bass, drums_power, low brass. intensity: choir_ahh, tremolo strings, timpani, orch_hit, horn counter-melody (BELL) |
| `final` | **Ashwing Matriarch** | 8-5, `boss-ashwing`, challenge wave 70 | 176, E minor ↔ G major; 8-bar 7/8 bridge | Epic, desperate, then everyone together | 4 + 40 bars (5.5 s + 54.5 s) | base, intensity | All three motifs: SHADOW (dragon) in low brass, SENTINEL CALL in trumpets (3+2+2 bridge, kept on the 4/4 grid), and in section C the main theme bars 1-4 in G major with BELL answered (choir + full band) | base: strings, brass, koto runs, chip_pulse12/25 leads, slap_bass, drums, organ. intensity: choir_ahh, orch_hit, timpani, second drum layer, tremolo strings |
| `results_win` | **After School** | Results after victory (loop after the jingle) | 96, F major | Warm, satisfied | 0 + 8 bars (20 s) | full | BELL answered softly, music box | music_box, epiano, drums_brush, finger_bass |
| `results_lose` | **Petals on the Path** | Results after defeat | 84, D minor → F | Gentle, encouraging | 0 + 8 bars (≈ 22 s) | full | BELL in D minor, answered in F major at the end (hope) | music_box, strings_slow, harp |

**Jingles and stingers** (one-shots, `jingles.py`):

| ID | Length | Bus | Content |
|---|---|---|---|
| `wave_blossom`, `wave_moonlit`, `wave_lantern`, `wave_ironclock`, `wave_matsuri` | 1.4 s each | music (stinger) | Snare roll, then a chip arpeggio up the family tonic triad, then a brass stab, in the family key |
| `final_wave` | 2.2 s | music (stinger) | Unpitched, so safe over any key: taiko roll, gong-like crash (`rev_cymbal` into crash), choir cluster, whoosh |
| `miniboss` | 2.6 s | music (stinger) | SHADOW on brass, taiko hits, crash |
| `boss_warning` | 3.2 s (+ `boss_warning_hold`, a 4-bar loop) | music | Chip siren (alternating tritone), SHADOW in low brass, taiko crescendo, then an orchestra hit. The boss track starts on its decay; if it is still decoding, the hold loop keeps the alarm going and the boss enters on its next bar line |
| `victory` | ≈ 5.2 s | music | 4-note sting (C F D F), then the bVI–bVII–I brass cadence to F(add9), a cymbal swell and a chip arp sparkle |
| `defeat` | ≈ 5.5 s | music | F minor music box: C5–F5–D♭5–C5 (the question collapses), slowing down, Fm(add9) → D♭ → B♭m6 → Fm, then a soft low piano "pa-dum" |
| `levelup` | 1.6 s | music (menus duck) | A♭ major 16ths: E♭6–A♭6–F6–G6 → A♭6, chip_pulse12 + glock trill |
| `awaken` | 3.2 s | music | BELL in A♭ answered → D♭ → A♭, choir + harp |
| `new_student` | 2.6 s | music | Harp gliss and celesta BELL in E, answered. Used for gacha NEW and for battle unlocks |
| `gacha_r` | 1.0 s | music | Celesta E6 + chip blip (a soft "answer" note) |
| `gacha_sr` | 2.2 s | music | Harp gliss, glock answer D♯6 → E6, E(add9) chord |
| `gacha_ssr` | 5.5 s | music | Orchestra hit, timpani roll, key lift E → G: brass BELL D5–G5–E5–F♯5 → G5 (held), choir "ahh", cymbal swell |

### 4.5 Leitmotif matrix

| Track | BELL | Main-theme phrase | SENTINEL CALL | SHADOW |
|---|---|---|---|---|
| title | ● | ● (complete) | | |
| homeroom | ● | ● (cosy) | | |
| march | ● (bridge) | | ● (main melody) | |
| wishing | ● (unanswered) | | | |
| mall | ● (fills) | | | |
| blossom | ● | ● (heroic) | ● (intensity) | |
| moonlit | ● (minor) | | ● (intensity) | |
| lantern | ● (phrygian, inverted) | | | ○ (bass hints) |
| ironclock | ● (brass riff) | | ● (guitar) | |
| matsuri | ● | | ● (intensity) | |
| boss | ● (counterpoint, hope) | ● (frantic + heroic) | | ● |
| final | ● (answered) | ● (G major finale) | ● | ● |
| jingles | ● (victory, levelup, awaken, new student, gacha) | | | ● (miniboss, boss warning, defeat) |

### 4.6 Composition order and approval

1. `motifs.py` + `title.py` (the main theme): render and send to the owner for approval. The approval
   piece is the main theme, the same way Hikari was the approval chibi.
2. `homeroom`, `march`, `battle_blossom`. These cover the first 10 minutes of play.
3. The other four battle families, then `boss`, `final`, `wishing`, `mall`, then jingles and results.

Each song file carries a header comment declaring it original, plus a `review` block (who reviewed,
originality check result).

---

## 5. SFX list

P1 = first ship (60 ids), P2 = polish (24 ids). "Delegation" = `domSfx.js`. "Economy" = `economy.js`.
"Battle" = `attachBattleAudio`. Recipe notes are starting points; ears decide.

### 5.1 UI (bus `ui`)

| ID | P | Hook | Recipe | Caps |
|---|---|---|---|---|
| `ui.click` | 1 | Delegation fallback (`button`, `a`, `[role=button]`) | Pulse 25 % blip 1.57 kHz, 30 ms, NES decay (Deltarune-style tick) | 3 voices, 25 ms |
| `ui.select` | 1 | `.unit-card`, `.item-tile`, `.menu-tab-btn`; wrapped `ctx.select` | Two-step blip up (C6 → G6), 70 ms | 2, 30 ms |
| `ui.confirm` | 1 | `.btn-yellow`, `.btn-primary`, `.bt-cta`, `.bt-start`, `.bt-buy` | Pulse 25 % C6 → G6 chime + soft echo, 140 ms | 2, 40 ms |
| `ui.back` | 1 | `.topbar-back`, `[data-testid=back]`, `.menu-tab-x`, reveal close, skip | Two-step down (G5 → C5), 80 ms | 2, 40 ms |
| `ui.tab` | 1 | `[role=tab]`, `.tab`, `.ma-seg-btn`, `.bt-seg-btn` | Triangle "pip" 880 Hz, 40 ms | 2, 30 ms |
| `ui.toggle` | 1 | `[role=switch]`, `.ma-toggle`, `[aria-pressed]` (rate 1.12 on, 0.89 off) | Pulse 50 % click + pitch blip | 2, 40 ms |
| `ui.tick` | 2 | `input[type=range]` (pitch by value); speed button (× speed pips) | Pulse 12.5 % 2 kHz, 12 ms | 1, 60 ms |
| `ui.deny` | 1 | `button[disabled]` pointerdown, `.toast-bad`, and `bt.deny` reuses it | Low square buzz 110 + 117 Hz, 130 ms (Deltarune "can't") | 1, 150 ms |
| `ui.toast` | 2 | `.toast-good` / `.toast-info` | Soft triangle pop, 60 ms | 1, 200 ms |
| `ui.modalOpen` | 1 | `.modal-overlay` added; pause open (wrap) | Band-passed noise swoosh up + glock tick, 160 ms | 1, 80 ms |
| `ui.modalClose` | 1 | `.modal-overlay.closing` / removed; pause close (wrap) | Swoosh down, 120 ms | 1, 80 ms |
| `ui.start` | 1 | Title TAP TO START | Sparkle + music-box BELL question at double speed, 0.8 s | 1 |
| `ui.slot` | 2 | Economy `formation` | Wooden "snap" (filtered pluck + click), 90 ms | 2 |
| `ui.chirp` | 2 | `data-sfx="ui.chirp"` (secretary tap) | Cute two-blip FM chirp, 120 ms | 1, 300 ms |

### 5.2 Economy and progression (bus `ui`)

| ID | P | Hook | Recipe |
|---|---|---|---|
| `eco.coins` | 1 | Economy: coins rose; battle income at −10 dB | 2-3 bright pulse "clinks" with a rising arp (E6 B6 E7), 250 ms |
| `eco.gems` | 1 | Economy: gems rose | FM crystal shimmer + glock, 400 ms |
| `eco.item` | 1 | Economy: items rose; gearbox open | Original 3-note "item get" arpeggio (G5 C6 E6 → D6) on chip + glock, 450 ms |
| `eco.claim` | 1 | Reasons `missions`, `achievements`, `login`, `redeem` | Stamp thump + sparkle, 300 ms |
| `eco.purchase` | 1 | Reason `shop` | Chip "ka-ching" (pulse arp + noise click), 350 ms |
| `eco.sweep` | 2 | Reason `sweep` | Three fast whooshes, then coins, 600 ms |
| `eco.breakthrough` | 2 | Reason `breakthrough` | Rising chip arp + chord bloom, 900 ms |
| `gear.equip` | 2 | `gear-equip` / `gear-unequip` (rate 0.85) | Buckle click (noise + metallic FM), 120 ms |
| `gear.enhance` | 2 | `gear-enhance` (rate rises with level) | Anvil "ting" (FM bell) + sparkle, 300 ms |
| `gear.reroll` | 2 | `gear-reroll` | Dice rattle (granular clicks) + result chime, 500 ms |

### 5.3 Battle: player actions (bus `battle`, high priority)

| ID | P | Hook | Recipe |
|---|---|---|---|
| `bt.pick` | 1 | `.bt-card` click (delegation) | Card lift: pulse blip + paper flick, 70 ms |
| `bt.place` | 1 | `place` (tower) | Soft poof (noise burst, LPF sweep) + landing thump, 220 ms |
| `bt.placeHero` | 1 | `place` (hero) | Poof + brass mini-chord + sparkle, 600 ms |
| `bt.deny` | 1 | `cue('battle.deny')` (placement reject), wrapped `ctx.bump`, feed key `upg-cash` / `poor-*` | "Bonk": triangle drop 300 → 120 Hz + buzz, 150 ms (gap 200 ms) |
| `bt.upgrade` | 1 | `upgrade` tier 1-2 | Rising 3-note pulse arp, 250 ms |
| `bt.upgradeBig` | 1 | `upgrade` tier 3-4 | Arp + shimmer + low hit, 500 ms |
| `bt.upgradeMax` | 1 | `upgrade` tier 5 | Mini-fanfare: BELL question + answer on brass + chip, 1.1 s |
| `bt.sell` | 1 | `sell` | Coin cascade down + poof, 400 ms |

### 5.4 Battle: attacks per behaviour (bus `battle`, aggregated per frame)

| ID | P | Hook (`attack.kind` unless noted) | Recipe | Caps |
|---|---|---|---|---|
| `fire.arrow` | 1 | `arrow`, `needle` (projectile) | Bow twang (pluck) + air "fwip", 120 ms | 3, 45 ms |
| `fire.bullet` | 1 | `bullet` (rifle, coin purse; turret −4 dB) | Chip "pew" (pulse sweep down) + click, 90 ms | 3, 45 ms |
| `fire.shell` | 1 | `shell`, `fireball` (fireball adds a crackle layer via `data.fire`) | Mortar thump (sine drop + noise), 200 ms | 2, 70 ms |
| `fire.shuriken` | 1 | `shuriken` | Whoosh + metallic "shing", 120 ms | 3, 45 ms |
| `fire.magic` | 1 | `orb`, `flask` | Bubbly FM "bloop" + sparkle tail, 160 ms | 3, 50 ms |
| `fire.holy` | 1 | `spark` | Bright bell ping (FM), 150 ms | 3, 50 ms |
| `fire.zap` | 1 | `bolt` | Short zap (noise + pulse 12.5 % sweep), 110 ms | 3, 45 ms |
| `atk.slash` | 1 | `slash` (duel; rate = 1 + 0.03 × ramp, so the swish climbs as she locks on) | Sword swish (band-passed noise sweep), 140 ms | 2, 60 ms |
| `atk.pulse` | 1 | `pulse` | "Whum" ring (sine 220 Hz + chorus, echo), 300 ms | 2, 200 ms |
| `atk.beam` | 1 | `beam` | Laser hum zip (saw + vibrato, LPF sweep), 250 ms | 2, 90 ms |
| `atk.chain` | 1 | `chain` (crackles = number of points, max 4) | Electric crackle (short-mode noise bursts), 80 ms each | 2, 90 ms |
| `trap.set` | 2 | `trapPlaced` | Rune click + soft chime, 120 ms | 2, 100 ms |
| `trap.trigger` | 1 | `trapTriggered` | Snap + small boom, 250 ms | 2, 80 ms |
| `turret.build` | 2 | `build` | Wrench clank (metallic FM ×2), 200 ms | 1, 200 ms |

**FX-1 attack sounds** (the `attacks` part sprite, §2.11): the attack kinds that were silent and the new
placed objects. Synthesised in `recipes.py` like the rest (original, no samples).

| ID | Hook | Recipe | Caps |
|---|---|---|---|
| `fire.roll` | `roll` (Marumi) | A soft knock as the ball drops, then a tumbling low rumble, 340 ms | 2, 90 ms |
| `fire.lob` | `lob` (Marumi) | Hand slap + an upward "fwoop", 170 ms | 2, 80 ms |
| `fire.strip` | `strip` (Azami) | A skim through the air + a steel clack, 180 ms | 2, 90 ms |
| `fire.trap` | `trap` (Suzu's seal toss) | Paper flick + a light swish, 110 ms | 2, 90 ms |
| `strip.snap` | `trapTriggered` with `strip` (replaces `trap.trigger` for strips) | Sharp snap + a short metallic "shk", 80 ms | 2, 70 ms |
| `pins.clatter` | `pins` | Five wooden knocks, a little clatter, 200 ms | 2, 120 ms |
| `sentry.deploy` | a sentry set (`kind: 'sentry'`; its `type` field is the sentry's type) | Clunk + a servo whirr up + a lock click, 310 ms | 1, 200 ms |
| `sentry.fold` | `deployEnd` (not a burst: the blast is its sound) | Servo whirr down + a soft latch, 270 ms | 1, 200 ms |

### 5.5 Battle: impacts, status, enemies (bus `battle`)

| ID | P | Hook | Recipe |
|---|---|---|---|
| `hit.pierce` | 1 | `hit` attackType pierce | "Thock" (short noise + 1.2 kHz click), 60 ms |
| `hit.slash` | 1 | `hit` slash | Cut "tsk" (high noise burst), 60 ms |
| `hit.mystic` | 1 | `hit` mystic | Soft "bwip" (FM), 70 ms |
| `hit.holy` | 1 | `hit` holy | "Ting" (bell partials), 80 ms |
| `hit.crit` | 1 | `hit` crit (layered) | Sharp sparkle + pitch-up click, 120 ms |
| `hit.resist` | 2 | `hit` effective < 1 | Dull "tunk" (LPF), 70 ms |
| `boom.small` | 1 | `explode` radius < 1.4 | Pop explosion (noise, LPF decay), 300 ms |
| `boom.big` | 1 | `explode` radius ≥ 1.4 | Boom + low sine thump + echo, 600 ms |
| `boom.volatile` | 2 | `explode` volatile (enemy) | Boom + alarm-ish detuned square stab, 600 ms |
| `break.barrier` | 1 | `barrierBreak` | Glass shatter (noise grains + high FM), 400 ms |
| `break.crystal` | 1 | `shellBreak` | Crystal crack (bright FM cluster), 350 ms |
| `st.freeze` | 1 | `status` freeze | Icy crackle + glock high, 250 ms |
| `st.burn` | 1 | `status` burn | Whoosh + crackle, 250 ms |
| `st.poison` | 2 | `status` poison | Bubbles (pitched blips), 300 ms |
| `st.shock` | 2 | `status` shock / stun | Buzz zap, 200 ms |
| `st.debuff` | 2 | `status` slow, reveal, silence, mark, shred, soak (rate per type) | Soft descending "wah" (pulse + LPF), 200 ms |
| `en.death` | 1 | `death` normal | Cute "poof" (noise puff + pitch-down blip), 180 ms |
| `en.deathBig` | 1 | `death` elite / size ≥ 1.4 | Bigger poof + thud, 350 ms |
| `en.bossDeath` | 1 | `death` boss / miniboss | Crumble + orchestra hit (sampled through the palette) + long echo, 1.6 s |
| `en.split` | 2 | `split` | Slime squish (pitched noise wobble), 160 ms |
| `en.blinkWarn` | 2 | `teleportWarn` | Rising shimmer (warning), 400 ms |
| `en.blink` | 2 | `blink` | "Vwip" teleport, 200 ms |
| `en.phase` | 2 | `phase` | Ghostly reverse swell, 300 ms |
| `en.sabotage` | 2 | `sabotage` | Spark-fizzle + low buzz, 400 ms |
| `en.bossPhase` | 1 | `bossPhase` | Roar-ish (detuned saw cluster + noise) + gong crash, 1.2 s |
| `en.new` | 2 | Wrapped `feed.push` kind `new` | Curious "?!" two-blip chirp, 250 ms |

### 5.6 Battle flow (bus `battle`)

| ID | P | Hook | Recipe |
|---|---|---|---|
| `bt.leak` | 1 | `leak` | Life-lost "bwomp" (square drop + heart crack noise), 350 ms |
| `bt.leakBig` | 1 | `leak` with lives ≥ 5 | Heavier bwomp + low thud, 600 ms |
| `bt.lowLives` | 2 | Poll: lives ≤ 25 % (once per battle) | Two alarm chirps (A5–E5), 500 ms |
| `bt.waveClear` | 1 | `waveEnd` | "Clear" chime (C6 E6 G6 C7 pulse arp) + coin layer, 700 ms |
| `hero.level` | 1 | `heroLevel` | Short level-up arp (E♭6 A♭6 F6 G6 → A♭6 at 32nds), 600 ms |
| `hero.ult` | 1 | `ult` | Big whoosh + choir hit (sampled) + BELL flourish, 1.4 s |

### 5.7 Gacha (bus `ui`; the music fanfares are in §4.4)

| ID | P | Hook | Recipe |
|---|---|---|---|
| `gacha.envelope` | 1 | `cue('gacha.envelope')` | Paper rustle + soft heartbeat (the riser stem starts) |
| `gacha.open` | 1 | `cue('gacha.open')` | Envelope tear + upward whoosh, 500 ms |
| `gacha.flipR` | 1 | `cue('gacha.flip', { rarity: 'R' })` | Card flip (paper flick) + soft bell, 300 ms |
| `gacha.flipSR` | 1 | `… 'SR'` | Flip + sparkle arpeggio, 500 ms |
| `gacha.flipSSR` | 1 | `… 'SSR'` | Flip + big shimmer + low hit, 900 ms |
| `gacha.results` | 2 | `cue('gacha.results')` | "Ta-da" chime. Plays `new_student` if `newCount > 0` |

Music-bus companions: `gacha_r` / `gacha_sr` / `gacha_ssr` fanfares play on the **best rarity once**
(after the last flip, or on `gacha.showcase` for SSR). Per-card flips use the SFX above, so a 10-pull is
not ten fanfares.

---

## 6. Review tooling

### 6.1 `studio.py review <song|all>` → `tools/audio/build/review/<song>/`

| Check | How | Gate |
|---|---|---|
| Loudness | `ffmpeg -nostats -i full.wav -af ebur128=peak=true:framelog=quiet -f null -`. Parse I (LUFS), LRA, true peak. Per stem and full mix | Full mix −16 ± 0.5 LUFS (jingles −15, stingers −18), TP ≤ −1.0 dBTP |
| Sample peak, DC, clipping | `astats` + numpy | Peak ≤ −0.5 dBFS, \|DC\| < 0.001 |
| **Loop seam** | Splice `F[loopEnd−N : loopEnd] ++ F[loopStart : loopStart+N]` and compare with the continuous render `R` across the cycle 1 → cycle 2 boundary (N = 1 s): max \|diff\| and RMS diff. **Click detector:** 2nd-difference energy in 5 ms windows at the seam vs the track median | WAV: RMS diff < −60 dBFS. Click ratio < 3 |
| **Entry seam** | Same, for `F[head−N : head] ++ F[entry : entry+N]` vs `R` at L0+T | Same |
| **Encoded seams** | Decode `.webm` and `.m4a` with ffmpeg and repeat both splices against the decoded continuous file | RMS diff < −35 dBFS (codec noise only), click ratio < 3 |
| **Encoder alignment** | Cross-correlate the ffmpeg-decoded file with the source WAV (lag search ± 4096) | Lag = 0 (edit list or pre-skip honoured) |
| Stem integrity | Equal lengths and loop points; Σ stems vs a separately rendered full mix | Residual < −50 dB |
| Sizes | Bytes per format vs §2.10 | Per-format and total caps |
| **Spectrogram** | `ffmpeg -i full.wav -lavfi showspectrumpic=s=1600x600:legend=1:scale=log:fscale=log -frames:v 1 spectrum.png`, plus `seam.png` (4 s around the loop wrap, from the spliced audio) | Visual |
| Waveform | `showwavespic` with head, entry and loop lines drawn by `drawbox` | Visual |
| **Piano roll** | See below | Visual |

**Piano roll.** `pianoroll.png` per song, built from the MIDI with numpy only. No new pip dependencies:
the raster goes through `ffmpeg -f rawvideo -pix_fmt rgb24` → PNG, and labels use `drawtext` with
`/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf`. It shows:
- time on x (beats), pitch on y, one colour per part (legend with roles and stems)
- velocity as brightness
- bar lines with numbers, section labels and a chord-symbol lane on top
- the loop region shaded
- **leitmotif boxes** (BELL yellow, SENTINEL CALL blue, SHADOW purple) from the DSL's motif markers, plus
  heuristic matches of the interval patterns for untagged reuse

Reviewers can *see* the melodies and the motif reuse.

`report.md` + `report.json` per song. `build/review/index.html` has audio players (WAV and both encodes)
next to the PNGs and the gate table, and opens from `file://`. `review sfx` writes a contact sheet:
per-SFX waveform and spectrogram tiles, momentary-max loudness, peak, duration, and checks that UI blips
stay quieter than battle hits by about 6 LU.

### 6.2 Python unit tests (`python -m unittest discover tools/audio/tests`)

- Notation parsing and bar validation.
- Generator determinism.
- Loop math: head, entry and positions; tempo snap.
- SNES echo impulse response: delay, feedback decay, FIR response.
- SF2 writer round-trip through FluidSynth.
- Palette inheritance and role validation.
- Manifest schema.
- Round 3 (`test_fx.py`, `test_r3_palette.py`): the block SVF equals a per-sample reference filter; drive is
  deterministic and scale-invariant; pump envelope shape and overlaps; automation, accent and pump curves repeat
  exactly over the loop (a filtered + driven + pumped signal is periodic to < −150 dB, the last samples before the
  wrap included); fx dict merge / validation; a FluidSynth render with all three effects keeps loop identity, the
  WAV seam gates and Σ stems = full mix; every role of `cleared` / `strict` / `chip` is a real preset of its font
  and every drum name used by the briefs lands on a sample in every kit; toby maps every GM role and keeps the role
  fx; kit roles are recognised without a palette; section / part swing, triplets kept, 16th swing, and the round-2
  swing formula unchanged.

### 6.3 Vitest (`npx vitest run tests/audio`, Node, no browser)

| Test file | Checks |
|---|---|
| `routes.test.js` | Every registered route resolves. Every theme in `MAPS` maps to a family. Every stage's boss and miniboss resolve. Coverage of `STAGES` |
| `economy.test.js` | `economyCues` for each commit reason with synthetic before/after profiles |
| `battleMap.test.js` | A recorded `runHeadless` event stream fed through the battle mapper with a fake engine: SFX ids exist, per-frame caps, 3× speed rates, boss takeover sequence, intensity on/off by sim state |
| `manifest.test.js` | Schema, both formats present for every stem, loop points in range, stems equal length, budgets (§2.10), every SFX id referenced in `cues.js` / `battle.js` / `domSfx.js` exists in `sprite.json`, probe files exist |
| `cue.test.js` | Queue before boot, no-op in Node, no window access at import |

### 6.4 Browser e2e: `e2e/audio.mjs`

Uses Playwright Chromium (Opus path) via `e2e/browser.mjs`, its own Vite server on port 0 as in
`e2e/shot.mjs`, and `--autoplay-policy=no-user-gesture-required`. Foreground, with timeouts.

1. Boot. Tap. Check `__sakura.audio.state()`: ctx `running`, format `opus`, Δ = 0.
2. Lobby → `homeroom` playing (melody 1). Students → melody 0, same `m`, no restart.
3. Recruit → `wishing`. Pull → riser 1.
4. Stage prep → prep 1.
5. Battle → `battle_<family>` base only. Start wave → intensity ≥ 0.9 within 2 bars. Speed 3× → the
   battle bus profile switches.
6. Force `sim.cash` / `sim.lives` for a quick win → victory jingle, then `results_win`.
7. No console errors. Decoded bytes under budget.

**Dense wave: `e2e/audio-dense.mjs [--out x.wav] [--phone] [--loud]`.** The real Sim (last campaign stage, hard,
the whole tower roster placed and upgraded by `autoPlan`, a late wave kept at ~60 enemies) runs at ×3 on a
60 Hz timer; its drained events go through the real `attachBattleAudio` → limiter → sprite voices → buses.
An AudioWorklet records 10 s of the final output (after the safety compressor) and of the SFX bus. The hero
ult, a boss-phase roar and a leak are added on top. Checks: sample and true peak ≤ −1 dBFS, no clipped
samples, energy above 8 kHz ≥ 20 dB under the mix, battle voices ≤ cap, ≥ 8 attack + hit sounds a second
(so it really is dense). Writes `x.wav`, `x.sfx.wav`, `x.png` (linear-frequency spectrogram) and `x.json`.
`--phone` emulates a coarse pointer (14 voices), `--loud` sets all three sliders to 100 %.

### 6.5 Originality check (`studio.py originality`)

- An interval and rhythm n-gram index of every melody line in our songs.
- It flags internal self-similarity (two tracks sharing a phrase that isn't a declared motif).
- It flags matches against a reviewer-maintained `tools/audio/originality/blocklist.json` of short
  interval fingerprints of famous hooks we must not resemble (the reviewer adds entries; ≥ 6 consecutive
  matching intervals is a fail).
- This is a heuristic. The real gate is human review of the piano roll and listening.

### 6.6 Sound Test (owner review on real phones)

An optional `#/soundtest` route (`src/audio/soundTest.js`, one `registerRoute` line in `main.js`), plus a
button in Settings → Audio. It works on the live Pages site and in the exe. It shows:
- Every track with its stems as sliders, and "jump to 3 s before the loop seam" / "before the entry"
  buttons.
- Every SFX on a pad grid.
- The measured format, probe Δ, context rate and decoded memory.

This is how the owner, or a friend with an iPhone, verifies AAC gapless looping on iOS. It is also a
Toby-style jukebox for free.

---

## 7. Work plan and acceptance

| # | Milestone | Done when |
|---|---|---|
| A1 | Toolkit skeleton: venv + pins, `fetch` (GeneralUser GS pinned + SHA), `make_chip_sf2.py`, palettes (`cleared`, `strict`, `chip`, `toby` slot), unit tests | `studio.py fetch` works; SF2 round-trip test is green |
| A2 | Song DSL + generators + MIDI + piano roll; `motifs.py`; **main theme** (`title.py`) | Piano roll PNG shows the theme with BELL boxes; bars validate |
| A3 | Render + mix + loop construction + encode + manifest + `review` gates | `title` renders; every §6.1 gate passes for WAV and both encodes |
| A4 | Runtime: `cue`, `engine` (unlock, probe, buses), `loader`, `music` director, `routes`, `domSfx`, `economy`; settings sliders + `save.js` keys; `main.js` line | Lobby plays `homeroom` on the dev server after a tap. Vitest green |
| A5 | SFX recipes P1 + sprite + `sfx.js` + `attachBattleAudio` + `controller` / `placement` hooks + recruit cues | A battle at 1× and 3× sounds right; caps hold; e2e audio passes |
| A6 | Compose the remaining tracks (§4.6 order), jingles, results loops; `ship` | Budgets met; all gates pass; owner approves the main theme first |
| A7 | P2 SFX, Sound Test, docs (`INTEGRATION_NOTES` entries, `CONTRACTS` §13 request), README section "Music & sound" with credits (GeneralUser GS by S. Christian Collins; sakura-chip CC0) | Merge-ready |

Run only targeted tests on this shared machine (`npx vitest run tests/audio`, `python -m unittest …`,
`node e2e/audio.mjs`). No servers are left running. Renders run in batches of at most 2 jobs.

---

## Appendix A: measured on 2026-10-08 (this machine)

- ffmpeg 6.1.1 (encoders `aac`, `libopus`, `libvorbis`, `libmp3lame`; filters `ebur128`,
  `showspectrumpic`, `showwavespic`, `drawtext`, `astats`). FluidSynth 2.3.4. Python 3.11.15.
  4 cores. DejaVu fonts present.
- AAC `.m4a`: `elst media_time 1024`. ffmpeg decode is click-exact; end padding is kept (16000 → 16384
  samples).
- Opus `.webm`: pre-skip 312. Click-exact in ffmpeg and in Playwright Chromium 141 at 44.1 / 48 kHz
  contexts.
- Playwright Chromium 141 cannot decode AAC, yet answers `canPlayType('audio/mp4') = "maybe"`. Hence
  the decode probe.
- Head+loop scheduling on decoded Opus in an `OfflineAudioContext` (32 kHz and 48 kHz): no
  discontinuity at the entry or the wraps.
- FluidSynth `-O float -r 32000 -R 0 -C 0 -f interp.cfg`: float32 WAV, exact note spacing, renders
  release tails past the MIDI end.
- GeneralUser GS reachable by anonymous `git` (the GitHub REST API is blocked in this sandbox):
  `GeneralUser-GS.sf2` 32,319,396 B at commit `684543d5…`, License v2.0 read.
- Venv with `mido==1.3.3`, `numpy==2.4.6`, `scipy==1.17.1` created at the scratch path above.

## Appendix B: open questions for the owner

1. Do you want the main theme as the **title** music only, or the title, *and* as the battle-1 B section
   (current plan: both)?
2. When Kai is shared: which exact EarthBound / SGM files, and should the **shipped** alpha use the
   `toby` palette (friends-only) or stay `cleared` with `toby` as an opt-in setting?
3. iPhone silent switch: play music with the ringer off (current plan while Music is on), or respect the
   switch?
