OK

This is a delta review of b7ed2c2e on `feature/vfx-shapes`: one commit on top of 72c0610f, before v0.1.73. I am a fresh reviewer: I did not build any of this and wrote no earlier review.
- I read the whole diff, round 4's LOW-1 and NIT-1, and the code each claim rests on.
- Every mutation ran on a scratch copy (`git archive b7ed2c2e` into `/tmp/rvlib5/tree`).
- The worktree is unchanged and clean at b7ed2c2e.

**Verdict.**
- **Asks 2 and 3 are done.** Mutations prove them.
- **Ask 1's wiring is right.** With `settings.attackFx === false`, nothing reaches the chains, beams, slashes, rings, ribbons or the styles' segments, and the plain look runs exactly main's code.
- **Two things around ask 1 are not as the docs say:**
  - **LOW-1:** one styled effect still draws with the option off: Akane's Starmine fire tornado. The library spec lists the tornado as one of the library's pieces.
  - **LOW-2:** there is no player setting. Nothing in the UI sets this option, and the save drops the key, so in the shipped game the option is never off.
- **Neither changes what a player sees in v0.1.73.** Nothing blocks. I recommend both fixes before merge: wording, or one token for LOW-1.

## Gates

1. **Sim id: pass.**
   - It prints `e4001588f40b` in the worktree and in the scratch copy.
   - The commit changes 6 files: CONTRACTS.md, docs/ATTACK_FX.md, docs/VFX.md, src/render/BattleRenderer.js and two tests. None of them is among the 92 files `tools/simId.mjs` hashes.
   - No `COOP_PROTOCOL` bump is needed.
2. **`nice npx vitest run tests/render` at b7ed2c2e: pass.**
   - 62 files and 692 tests, all green, in 78 s.
   - The load average was about 5, from other work on the machine. There were no timeouts, so nothing was rerun.
   - The worktree was clean afterwards.
3. **Content: pass.**
   - I scanned the 68 added lines and the commit message against 115 show, game, studio, character and technique names (whole words): 0 hits. I also read every line myself.
   - There are no player names and no secrets or keys. The only email address is the attribution line.

## Ask 1: the setting covers the library

**The wiring is correct.** Every path, traced with `settings.attackFx === false`:

- **`fx.chain`, `beam`, `pulse` and `slash`** (`fx.js:351`, `369`, `379-381`, `411`) try `this.lightning`, `beams` or `shapes` first. When those are null, each runs main's old code verbatim: against `origin/main`, `fx.js` only adds the guarded hand-off in front of each old body.
  - Abilities (`abilityFx.js`, 1 call) and roster effects (`rosterFx.js`, 3 calls) reach the library only through these four methods.
  - Companions and the staff props never reach it.
- **The projectile feed** (`actors.js:668`) runs only `if (this.trails && …)`. With `trails` null, the method is exactly main's.
- **The attack styles and the shared segments** do not exist: `attackFx` is null (`BattleRenderer.js:302`). So there are no projectile views and no `ctx`, and the guarded `strike`, `fire`, `slash` and `ctx.strokes` are never set: lines 406-415 sit inside `if (attackFx)`.
- **Everything else in BattleRenderer** only sets up or ticks the layers, and none of it spawns anything:
  - `flashGate` (531-532), `setGlow` (567-568), `setQuality` (613-616) and `update` (1192-1195);
  - strokes `begin`, `hold`, `setPixel` and `end` (1121, 1198-1200);
  - the impact-frame hide list (514), `r.vfx` (1555) and `dispose` (1753-1757).
- **The layers stay idle.** I ran the layers as the renderer builds them, with nothing handed over, in its frame order on high, medium and low, plus a quality switch (`tests/rv5/idle.test.js`):
  - 0 strokes and 0 quads were pushed;
  - the strokes mesh was never shown (`strokes.js:202`: `mesh.visible = n > 0 && !held`), so there is no draw call.
- **The dev tools** still draw when called: `lightningDemo`, `beamDemo` and the `lightning`, `beams` and `shapes` getters (1517-1532).
  - Their only callers are the DEV-only lightning panel (1805) and `tools/vfx/capture.mjs`, which never sets the option.
  - This does not matter for a battle.
- **Nothing breaks with the hand-offs null.** Every call above uses the layer objects, not the hand-offs, and `vfxOff` only sets null fields to null again.
- **The setting is read the same way as for the attack styles:** a strict `false` check on the same `settings` object, read once at creation (302, 337).
- **The tests are meaningful.**
  - The source test fails on every mutation where a hand-off ignores the option:
    - B1, B2, B5: lightning, beams or trails handed over regardless;
    - B3: `vfxOn = true`;
    - B4: an extra `fx.shapes = shapes;`.
  - The behaviour test cannot see the renderer (there is no WebGL in node). It does fail when a fallback breaks: B6, `fx.slash` drawing nothing without the layer.

**LOW-1. Akane's tornado still draws with the option off, and the docs say every effect keeps the plain look.**

- **Where:**
  - `BattleRenderer.js:768-769` starts Akane's Starmine column on its `abilityWarn` event and never checks the option;
  - `CONTRACTS.md:2151-2152` and `docs/VFX.md:352` say "every effect keeps the plain look".
- **Why it matters:**
  - `src/render/vfx/tornado.js` is new on this branch and ships in v0.1.73.
  - `docs/specs/VFX_LIBRARY.md:39` lists it as one of the library's pieces, and line 105 lists it under B8.
  - The owner decided that the option promises the plain look.
  - VFX.md keeps the tornado in a section of its own ("Tornado (prototype)", line 275), with its own error switch (`tornadoSafe`). That is presumably why the commit left it out.
- **Fix (preferred; display only):**
  1. At line 768: `if (vfxOn && ev.type === 'abilityWarn' && TORNADO_CASTS[ev.id])`. The `abilityShell` branch then does nothing, because `tornado.feed` ignores a missing column (`tornado.js:373`).
  2. Pin it in the guard test's source test.
  3. Add a Setting line to VFX.md's tornado section.
- **Or, if the tornado is meant to stay outside the option,** say so in both docs: "every effect the library styles keeps the plain look; the tornado prototype (Akane's Starmine Barrage) is not covered".

**LOW-2. There is no player "attack effects" setting.**

- **Where:**
  - `docs/VFX.md:352` ("the player's attack effects setting");
  - the comment at `BattleRenderer.js:335`;
  - the describe title at `tests/render/vfx-library-guard.test.js:204`;
  - the commit message.
- **The facts:**
  - No toggle sets it: neither Settings → Graphics (`src/ui/screens/settings.js:78-90`) nor the pause menu (`src/ui/battle/pauseMenu.js:113-115`).
  - `DEFAULT_SETTINGS` has no `attackFx` (`src/systems/save.js:65`).
  - `cleanSettings` (`save.js:358-396`) drops the key on every load, through `migrateProfile` (`save.js:674`, `store.js:344`). I checked it: a stored `attackFx: false` loads as `undefined`.
  - The only callers that pass `attackFx: false` are `previews/renderer.js:80` (`&fx=off`) and `previews/attacks.js:208`.
- **So in the shipped game the option is never off.** This commit changes nothing a player sees. It changes only the previews' plain look.
- **Fix:** in VFX.md:352, the comment at BattleRenderer.js:335 and the test title, say "the `settings.attackFx === false` option (set by the previews' `fx=off` and the attack A/B preview; there is no Settings toggle today, and the save drops the key)". The commit message cannot change, since there are no history rewrites.
- **For the coordinator:** the owner's decision assumes a player toggle that does not exist.
  - If the owner wants players to have the choice, that is a separate change: a Settings row, the key in `DEFAULT_SETTINGS` and `cleanSettings`, and a patch note, with its own review.
  - With a real toggle, LOW-1 would become a promise broken in front of players.
- **Aside (pre-existing, outside this commit):** `e2e/model-quality.mjs:81` and `e2e/slime-goblin-faces.mjs:166` seed `attackFx: false` into the save, and the load drops it. Those captures have always run with the attack styles on, and now with the library on too.

## Ask 2: Yuzuha's gap is closed and Hikari's reason is true: fixed

**Yuzuha.** I probed the test's own setup (booth 0, seed 3, 2x, the four builds on high and medium; `tests/rv5/yuzuha-timing.test.js`):
- Her sentries go down at 4.8 to 6.0 s.
- The first sentry shot flies at 33.2 to 35.2 s.
- The 1,200 frames (40 s) take in 8 to 12 sentry shot-frames, so the margin is 4.8 to 6.8 s.
- The battle is seeded, so the result does not vary. If a later change moved her first shot past 40 s, the coverage check would fail; it would not pass quietly.

| Mutation | Result |
|---|---|
| A1: her flag removed | caught at line 134: doubled on all 8 runs, 8 to 12 shot-frames each |
| A3: her battle back to 360 frames | caught at line 141: `missed` = yuzuha |
| A5: her tracer removed, flag kept | **passes** |

- She is out of `KNOWN_GAPS` and on the must-reach list (line 143).
- A5 is the NIT-A limitation that round 4 recorded and that is still open: her spawn-frame muzzle sprite counts as a trail, and the bare check is per girl and build. It is not new, and this commit needs no action for it.

**Hikari.**
- `hikari.js:78` returns unless her cached behaviour is `projectile`. Her lance branch is at line 83.
- She is a hero (`units.js:88-144`: `kind: 'hero'`, `paths: []`) with `behavior: 'pulse'` (line 123).
- None of her hero levels carries a `behavior` mod (`heroTracks.js:73-101`). Rule 1 at line 12 explains: her old lances became "Halo Reach", which changes numbers only.
- Only a mod key can replace a behaviour (`mods.js:22`). No potential, gear or awakening data carries one; her awakening mods are damage and reveal.
- Mutation A4 removes her gap: caught, `missed` = hikari. Nothing reaches her view.
- VFX.md:406 and ATTACK_FX.md:145 now give this reason, and the test header no longer promises that every girl's shots fly.

## Ask 3: one skip assignment: fixed

- The new rule (test lines 19-23) gives the same six views as the old one: chigusa, ena, fuu, kinu, miko and momo.
  - Each of the six has exactly one `.skip =`, sets it first, and hands only coordinates to the drawing calls.
  - Yuzuha's view also has one `.skip =`, but after a branch, so it is correctly not counted.
- It rejects a view that clears its skip:
  - **A2:** Kinu's skip cleared right after it is set. Caught by the pin at line 139: Kinu drops out of the set.
  - **A6:** Fuu's skip recomputed later, after a branch. Caught as doubled at line 134; the pin would fail too.
- The rule fails closed on comparisons: a `.skip ==` counts as an assignment.

## NITs

- **NIT-1.** `tests/render/vfx-trail-optout.test.js:111` still says "so her shots meet the enemies".
  - The header (lines 2-3) dropped those words, because they are not true for Kinu or Hikari, or for Yuzuha's sentries before 33 s.
  - **Fix:** drop them here too.
- **NIT-2.** The skip rule still cannot see a skip cleared outside the view's own text:
  - a helper that is handed `v`;
  - `v.skip &&= …`, `v['skip'] = …` or `Object.assign(v, …)`.
  - Today no always-skip view hands `v` itself to anything. Only Kinu depends on the source rule alone, because her shots never fly in the test.
  - **Optional fix:** round 4's NIT-2: assert `views === 0 && skipped > 0` for the pinned girls whose shots fly. That would back the rule with what ran for the other five.
- **NIT-3.** `CONTRACTS.md:2152` is 163 characters long; the rest of the paragraph wraps at about 100.

## Docs

The docs say exactly what ships, apart from two phrases: "every effect keeps the plain look" (LOW-1) and "the player's … setting" (LOW-2).
- ATTACK_FX.md:46 and :145 and VFX.md:406 match the code.
- So does CONTRACTS.md, apart from the LOW-1 phrase.
- The patch note needs no change, because nothing a player can see changes (LOW-2).

## Must-fix list

None. I recommend LOW-1 and LOW-2 before merge: wording, or for LOW-1 one token and a pin.

## Scratch evidence (`/tmp/rvlib5`)

- **Scratch copy:** `tree/`, extracted from b7ed2c2e, with `node_modules` symlinked. Every mutated file was restored and compared with b7ed2c2e.
- **Logs** (`logs/`):
  - `vitest-render.log`: gate 2;
  - `baseline.log`: the two changed test files, green in the scratch copy;
  - `mutations.txt` and `mut/*.log`: A1 to A6 and B1 to B7;
  - `added.txt` and `msg.txt`: the scanned lines.
- **Tools** (`tools/`):
  - `mutate.sh` and `mut.mjs`: the mutation runner;
  - `skiprule.mjs` and `views.mjs`: the old and new skip rules over all 21 views;
  - `settings.mjs`: the save drops `attackFx`;
  - `scan.mjs` and `names.txt`: the content scan.
- **Scratch tests** (`tree/tests/rv5/`):
  - `idle.test.js`: the idle layers;
  - `yuzuha-timing.test.js`: her sentry timing.

I changed no tracked files, started no captures, and committed or pushed nothing.
