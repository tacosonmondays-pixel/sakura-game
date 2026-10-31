# Art v3c review, round 1

Reviewed: `feature/art-v3c` @ 18a00648 (off `main` a3d97a38, v0.1.68). Store: `wip/art-v3` @ 48b1a59e (`docs/art-v3-wip/v3c/`).
Fresh clone, nothing pushed to `main` or the feature branch.

**Verdict: OK to ship.** No girl is rejected. There are no blockers and no mediums. Five low or advisory notes follow, and all are optional.

## 1. Content, girl by girl

I opened every new `-full` master (768x1024) at full resolution, not just the board. I zoomed into the torsos of Nami and Hikari, Kanna, Norika, Momo's and Noa's skirts, and every visible hand. I also looked at every `-card`, `-bust` and `-thumb` crop.

The same checks pass for all 24:
- Fully dressed, with eye-level or near-eye-level cameras: no low angle, no high angle looking down the top, no body-focus framing.
- No halo rings: 0 of the 211 manifest prompts ask for one, and none is drawn.
- No text or watermarks. Norika's STOP paddle is a blank red disc.
- No extra or fused fingers.

| Girl | Prop vs kit (`units.js` bio) | Notes |
|---|---|---|
| Akane | staff, gold ring around a red star crystal; fire in hand; witch hat | pass |
| Aoi | longbow, quiver, bracers, hooded cape | pass |
| Chika | big wrench, goggles, tool belt, drones | pass. The gloved hand in the foreground is large but well formed |
| Ena | holo rose cards, wrist launcher, rose ornament | pass |
| Fuu | turbine fan, mint ribbons, track jacket | pass. Skirt over leggings |
| Hana | falcon drone on her falconry glove, arrows in a back quiver | pass. The bow itself is cased on her back; acceptable |
| Hikari (adult) | star-guard sword, gold star circlet | pass, see A1 |
| Hotaru | hooked staff, paper lantern, beret, fireflies | pass |
| Kaede | rapier with a gold basket guard, maple ornament | pass |
| Kage | shuriken, crescent headband (in her bio) | pass |
| Kanna (adult) | drumsticks, festival drum, horns | pass, see A2 |
| Midori | star-stopper flask, goggles, satchel, apron | pass |
| Miko | gohei, red hakama, red bow | pass |
| Momo | mic, idol dress, gloves | pass. The skirt is layered, mid-thigh, over opaque white tights. Eye-level camera, no upward angle |
| Nami (adult) | gilded trident, admiral cap and coat | pass, see A1 |
| Noa | sakura ward shield, armband | pass. The pleated skirt is just above the knee, over grey tights |
| Norika (adult staff) | blank STOP paddle, whistle, sash, safety cap, gloves | pass. Clearly an adult woman. Style note L3 |
| Raika | gold-star staff, ram-horn tufts | pass. The ring around the star is part of the staff, not a halo |
| Rei | katana with pink silk bow | pass |
| Ruri | glowing tome with holo fox | pass |
| Shiro | scoped rifle, beret, bell tower | pass |
| Suzu | gold hand bell, bell rack behind her | pass |
| Umeko | shell-fan staff with pearls, sea shrine | pass |
| Yuki | ice-crystal staff, snowflake pin, capelet | pass |

**A1, Nami and Hikari.** Each extends a gloved hand toward the camera in front of her torso. Both coats are closed to the collar, and the camera is at eye level. The hand and the face are the subject; the chest is not. In the bust crops the glove sits mid-frame, with the face in the upper third.

Verdict: acceptable. They read as adult officers, not body-framed. No change requested.

**A2, Kanna (adult: true, drum club advisor).** Not in the brief, but she is the other adult in this batch. The tie, wristwatch, slacks and adult build read as a young adult. The twin-tails and big grin skew her younger. Passes; worth keeping in mind at the stand pass.

## 2. Prompts and the ledger

- **`_ledger.jsonl`** has 211 lines and only these keys: `time, id, name, ok, http, anlas_before, anlas_after`. There are no prompts and no references in it.
- **Prompts** live in the per-girl `spec*.json` and `_manifest.jsonl` files. I grepped them for other franchises' names, artist tags, booru or pixiv sites and similar terms. The only hits were the phrases "by its handle" and "by the wind". **No other games' or anime names, and no third-party references.**
- **Character references:** 23 girls use only `public/art/portraits/<id>-full.webp`, their own shipped art.
  - Norika's round 1 used `work/roster/norika/r2-0.png`, her own earlier generation.
  - Her shipped image is round 2 `r2-6`, which is text-only (no refs). It matches the shipped `norika-full.webp` with a mean pixel difference of 0.2.
  - Her superseded `spec.v3.json` carries `vibe: "azami:0.2"`. Azami is the game's own art.
- Info: `hikari/spec.v3.json` and `kaede/spec.v3.json` still contain the old "halo" positive prompt. They are superseded specs; none of the manifest prompts behind the picks contains "halo".

## 3. Repo hygiene

- **Changes:** `origin/main..origin/feature/art-v3c` touches 102 files. 96 are portraits (24 girls x full/card/bust/thumb). The other six:
  - `src/art/portraitsV3.js`
  - `src/art/portraits.js`
  - `src/ui/faceAnchors.js`
  - `src/data/patchNotes.js` (v0.1.69 at the top)
  - `tests/art/portraitsV3.test.js`
  - `e2e/art-v3.mjs`
- **No raw generations or rejected samples, and no references to the wip branch.** `git grep` finds nothing for `wip/art-v3`, `art-v3-wip` or `/home/user/work`. The 211 samples (41.5 MB) stay on `wip/art-v3`; that branch must never be merged.
- **Blob sizes:** `git rev-list --objects origin/main..origin/feature/art-v3c` lists 102 blobs, 8,509,505 bytes. The largest is `aoi-full.webp` at 269,248 bytes. **No blob is over 1 MB.**
- **Formats match the existing files:** lossy RGB WebP at full 768x1024, card 300x500, bust 512x512, thumb 160x160. The new test checks size and hash.
- **Bytes added, net +2.85 MB** (see L2):

  | Kind | Before | After | Average after | Untouched girls' range |
  |---|---|---|---|---|
  | full | 3.37 MB | 4.98 MB | 207 KB | 61–178 KB |
  | card | 0.84 MB | 1.21 MB | 50 KB | 26–41 KB |
  | bust | 1.16 MB | 1.96 MB | 82 KB | 32–62 KB |
  | thumb | 195 KB | 273 KB | 11.4 KB | 6.7–9 KB |

- **Lazy-loading:** `portraitHTML` uses `loading="lazy"` by default (`src/art/portraits.js:201`). Only the battle HUD thumbs and the result art are eager, as before.
- **Stands:** `-cut` and `-cut-s` are unchanged for all 24. Kogane and Norika keep `placeholder: true` (`src/art/portraits.js:106-107`), as intended; the test asserts it. Norika's full, card, bust and thumb are her new art; her stands are still the sign.

## 4. Wiring and framing

- **Face points:** I drew every `PORTRAIT_DATA.face` point on its master, and every `FACE_ANCHORS.card` brow, eye, chin and cx line on its card. All 24 points sit between the eyes, and the card eye lines run through the eyes.
- **Surfaces checked** at 390x844, 844x390 and 1280x720 (JPEGs, all ≤300 KB, in `docs/review/art-v3c/shots/`):

  | Surface | Shots | Art and framing |
  |---|---|---|
  | Girls list | `*-girls-list` | tiles hold the eye line |
  | Girl page | `*-girl-page-{hikari,norika,aoi}` | full art cropped on the face |
  | Squad | `*-squad` | tiles |
  | Build Coach | `*-build-coach` | Kage's page |
  | More page header | `*-more-midori` | 40 px thumb, face centred |
  | Battle | `*-battle` | HUD hero widget and deploy tray thumbs |
  | Recruit reveal | `*-recruit-reveal`, `*-recruit-results` | the reveal uses the stand (`-cut`), unchanged by design |
  | Profile showcase | `1280x720-profile-showcase` | cropped so no player name shows |

  New art and sensible framing everywhere. Nothing is cut off at the head and no face is off-centre.

## 5. Tests

| Check | Result |
|---|---|
| `npm test` (vitest) | **438 files passed, 2 skipped; 6938 tests passed, 11 skipped, 0 failed** |
| `node e2e/art-v3.mjs` | **24 ok, 0 failed** (3 sizes; list, 5 girl pages, squad; no broken images, no page errors) |
| `npm run e2e` (smoke) | **ALL SMOKE CHECKS PASSED** (681 ok lines) |
| `e2e/buildCoach.mjs` | all ok (99) |
| `e2e/more-page.mjs` | all passed (90) |
| `e2e/recruit-cinematic.mjs` | all passed (138) |
| `e2e/profile.mjs` | 2 FAIL: "the medal tally over 59 stages". **The same 2 FAILs occur on `main`**, so they are not from this branch |
| `simId()` | **e3c222f3ad44, unchanged**. No sim files touched; `COOP_PROTOCOL` stays 16 and needs no bump |

## 6. Findings

| # | Severity | Where | Finding | Fix |
|---|---|---|---|---|
| L1 | low | `src/art/portraits.js:145` | Every redraw keeps its URL with no version query. GitHub Pages caches for 10 minutes, so right after deploy a cached old card or bust can show under the new JS's face anchors, misframed. The academy v2 redraw shipped the same way. | Optional: `?v=${PORTRAIT_V3[id]}` on v3 girls' URLs in `portraitUrl`. The hash is already in the manifest. |
| L2 | low | `public/art/portraits/*` | +2.85 MB per deploy (+51 % on these 96 files). The new fulls average 207 KB, above the 178 KB maximum of untouched girls; cards and busts are about 40 % over their range. Lazy-loading limits the impact. | Optional: re-encode at WebP q≈78–80, `-m 6`, to bring fulls ≤180 KB. Update the `PORTRAIT_V3` hashes afterwards. |
| L3 | low (art) | `public/art/portraits/norika-full.webp` | Norika's text-only render has flatter shading and less detail than the other 23 (plain road, simple face shading). It reads as an adult, and the content is fine. | Ship. Consider a re-roll when her stand pass happens. |
| A2 | advisory | `public/art/portraits/kanna-full.webp` | Adult staff who reads as a young adult, not an older one. | None now; watch at the stand pass. |
| I1 | info | `docs/art-v3-wip/v3c/{hikari,kaede}/spec.v3.json` (wip branch) | Old specs still carry the halo prompt. | None; superseded. Never merge `wip/art-v3`. |
| I2 | info | the stands | The lobby, recruit reveal and win screen still use the old-style stands, so they visibly differ from the new portraits. | By design until a stand pass. |
| I3 | info | `e2e/profile.mjs` | Fails on "the medal tally" (the 3rd and 4th medal counts are 59/89 and 23/89); the stage-medal seed, not art. **The same 2 FAILs occur on `main` a3d97a38.** | Separate fix: update the expected stage count in `e2e/profile.mjs`. |

Profile baseline on `main` a3d97a38: **the same 2 FAILs**, with the same numbers (89/89 89/89 59/89 23/89). The failure was already on main and is not caused by this branch. It is an e2e expectation of 59 stages against a seed that now has 89; it belongs to whoever owns the profile e2e.
