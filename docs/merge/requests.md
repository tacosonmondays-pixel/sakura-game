# Owner-request audit for the "super game" merge (Codex Alpha 1.3.1 + current build)

Scope: every distinct thing the owner asked for, in Codex, in the ChatGPT roadmap chat and in this Claude
session, checked against the CURRENT build (`/home/user/sakura-game`, "NEW") and the Codex build mirror
(`scratchpad/oldgame`, "OLD"). Read-only; nothing in
either project was changed. Old minified modules were prettier-formatted for reading into
`$M/req-pretty/*.js` (and the sibling reports' `$M/pretty/`, `$M/fmt/`); **old line numbers below refer to those
formatted copies**. `$M` = `scratchpad/merge`.
New-repo paths are repo-relative with real line numbers (written at HEAD `d617b2e`; re-checked at `ac57f8e`, 23:05 UTC — docs-only diff, lines unchanged).

Sibling reports this one leans on (don't duplicate): `$M/characters.md` (old chibis, illustrations, port spec),
`$M/combat.md` (sim/enemy/battle-UX gaps), `$M/integration.md` (skin system, codex model source, new units).

## Legend

* **Source tags.** `C1…C43` = the owner's 43 Codex requests (`docs/OWNER_REQUESTS.md` "Request N", identical to
  `scratchpad/kit/notes/02_CODEX_CHAT_your_requests.txt`). `CX@idx` = a Codex reply in
  `kit/notes/03_CODEX_CHAT_codex_replies.txt`. `RM Lnn` = owner's roadmap message in
  `scratchpad/share3.md` (= `kit/notes/04_CHATGPT_roadmap_chat.txt`). `REC` = ChatGPT's suggestions after the owner
  asked "Any other mechanics?" (share3.md L215-444; listed as "worth building" in `docs/OWNER_REQUESTS.md`
  L227-243) — suggestions, not explicit owner asks. `CL mm-dd hh:mm` = this Claude session
  (`kit/notes/01_CLAUDE_CHAT_LOG.txt`). `O7 hh:mm` = owner messages of 2026-10-07 (UTC), extracted from the session
  transcript into `$M/owner_msgs_all.txt` and `$M/owner_queued.txt` (mid-turn messages). `HO Lnn` = Codex handoff
  `docs/codex-handoff/Sakura-Sentinels-Alpha-1.3.1-Handoff.txt` (byte-identical to the uploaded
  `247ec2d4-Sakura-Sentinels-Project-Handoff.txt`).
* **NEW status:** DONE / PARTIAL / MISSING / IN PROGRESS / SUPERSEDED / DECLINED, with file:line evidence.
* **OLD:** whether the Codex build implements it, with the module.
* **Priority for the merged game:** **P0** = first merge pass (the owner's "main thing" or something the merge
  would break); **P1** = right after the roster lands (owner asked explicitly and/or OLD code/data is ready to
  port); **P2** = later (big system, needs a backend, or only a ChatGPT suggestion). "—" = done, keep as is.

---

## 00. Update pass, 2026-10-07 23:05 UTC (read this first)

The table below was written at 18:24 against HEAD `d617b2e`. Re-checked at 23:05: HEAD is now `ac57f8e` (adds
only `docs/merge/{README,characters,combat,integration,meshy-chibi-test}.md`, no code change), so every NEW
file:line in §2 still holds. Owner messages that arrived after the first pass (extracted from the session
transcript `/root/.claude/projects/-home-user/bc8e90b4-5af0-5aad-ab54-4a98bb73399f.jsonl`):

| ID | Time (UTC) | Owner message (verbatim, trimmed) | Status now | Prio |
|---|---|---|---|---|
| N-01 | 18:13 | "Give me more update pls" | Answered in chat; recurring ask: send short progress updates with screenshots | process |
| N-02 | 18:20 | Uploaded `uploads/…/8314b371-blue-archive-wakamo-swimsuit.zip` (BA CH0175 rip: body/face/eyes/mouth/hair/halo textures + source zip): "its supposed to be like this, we're so close but still abit far from the mark.. the character sheet for the chibi look better!" | IN PROGRESS: chibi-v2 Hikari pilot (`scratchpad/chibi-v2/`: `hikari-v2.glb` 0.79 MB, separate `face-atlas.png` + `face-atlas.json`, expressions idle/blink/attack/happy/hurt/surprised/wink/shy). I opened `chibi-v2/shots/portrait3.png`: the swap-able eyes/mouth work but the old eyes baked into the projected body texture still show through (double eyes, smudged cheeks) — the face area of `tex-body-final.png` must be cleaned. | **P0** |
| N-03 | 18:20 | (same) "the character sheet for the chibi look better" — the 2D turnaround beats the 3D result | Keep `docs/art/approved/chibi-style-hikari-turnaround.webp` as the reference the 3D must match; judge 3D against it side by side | **P0** |
| N-04 | 18:21 | "also can you push everything thats been completed so far?" | DONE for the main branch: `claude/sakura-sentinels` = `origin` at `ac57f8e`. NOT pushed: `feature/tracks-v3` (`1706381` + 2 uncommitted files `src/core/track.js`, `src/data/maps.js` in `/home/user/wt-tracks`), untracked Meshy test (`public/_meshy-test/`), this audit and `scratchpad/chibi-v2`. Push again when each lands. | P0 |
| N-05 | 18:26 | "the big issue is the scaling! compared to everything else its super [small]… If it was larger but like stubbier, look at how the blue archive model looks… I think its at a 6/10 while codex has technically better proportions its at a 3/10 because its ugly" | PARTIAL: battle scale constants `src/render/actors.js` L12-14 (`TOWER_SCALE 1.22`, `HERO_SCALE 1.36`, `ENEMY_SCALE 1.12`) unchanged; chibi-v2 aims at ~2.4 heads (BA SD). | **P0** |
| N-06 | 21:56 | "wait it changed to max I set it to ultra code will it auto change?" | A question about the session's effort setting, not a game request. The lead should answer it in chat; nothing for the game. | — |

**What N-05 changes in this audit (important):** the owner now rates the **Codex chibi 3/10 ("ugly")** and the Meshy
Hikari 6/10, against the judge's scores in `docs/merge/meshy-chibi-test.md` (Codex 6.5 overall, Meshy-as-delivered
4.0). Owner's view wins (X-03 "recommendations must fit the owner's view"). So:
* "Get the characters in" = the old **designs** (names, colours, outfits, illustrations, kits), **not** the old
  Codex GLBs as the final battle look. Old GLBs are at most a stopgap while BA-style chibis are made (R-02, A-01,
  decision D-h below now leans to new BA-style chibis).
* Battle chibis must be **bigger on the board and stubbier** (~2.4-2.7 heads, big head, short limbs), like BA SD
  models. Raise `TOWER_SCALE`/`HERO_SCALE` and re-check placement footprints (B-03) and readability at 844×390.
* The Wakamo reference is a **swimsuit** model: use it only for proportions, face/eye-atlas setup, texture
  flatness and outline. Never copy the outfit, and never ship its textures (third-party rule, §1).

---

## 0. Top items (what the lead must not miss)

**P0 — the merge pass itself**
1. **Old characters in as the main roster** (O7 17:01, 16:52): 32 old girls (25 towers + 7 heroes), their 35 Draco
   GLBs, face atlas, procedural acting/weapons and illustrations. NEW has 19 V2 designs only, no second model
   source (`src/models/index.js`). Port spec: `$M/characters.md` §5, `$M/integration.md` §2. 13 old-only girls; 7
   of them need new sim features (`$M/combat.md` §4).
2. **Current V2 girls → "special skins"; Rei, Nami, Luna, Kaede → future-release units with new names; Yuki, Suzu
   and the rest → skins** (O7 17:25). NEW has no skin concept anywhere (grep "skin" hits only mesh skinning).
3. **Home menu = drawn landscape illustration ("memorial lobby"), breathing + tap reactions, NO 3D girl and NO SVG
   room** (O7 16:34, 17:06, 17:11, 17:16). NEW lobby is exactly what the owner rejected: a 3D secretary over a
   painted SVG office (`src/ui/screens/lobby.js` L3-8, `src/ui/lobby/secretary.js`, `src/art/lobbyRoom.js`; looked at
   `scratchpad/lobby-v3/wip-6-1280.png`). Keep its BA HUD (top bar, left shortcuts, carousel, Campaign folder, dock).
4. **Approved chibi look** = Meshy Hikari turnaround, `docs/art/approved/chibi-style-hikari-turnaround.webp`
   (O7 17:43 "THATS LITERALLY PERFECT"; looked at it): ~2.5-3 heads, flat two-tone cel, thin outlines,
   lash-heavy eyes, modest outfits copied from the illustration. Target for every 3D battle chibi and 2D chibi.
   Decide: Meshy-made battle GLBs vs ported Codex GLBs (cost/time ×32).
5. **Replace code-drawn SVG card art with real illustrations** everywhere (`cardArtSVG`, 19 call sites). Art exists
   for 20 girls (6 singles + 7 pair portraits); 10 base girls (Aoi, Rei, Yuki, Akane, Shiro, Kage, Raika, Miko,
   Midori, Momo) only appear in `roster.webp`, which is not shippable for students → generate.
6. **Content gates before anything ships:** no swimwear on chibi bodies — do not ship old `marina.glb`,
   `amane.glb` (swimwear-like base outfits), `marina-beach.glb`, `amane-beach.glb`, `nami-beach.glb`; not
   `roster.webp` for students; crop/repaint the bust-focused Hikari illustration (`$M/characters.md` §7).
7. **Keep the NEW base** the owner praised (O7 17:06): UI, maps, inventory/backpack, item icons, sim, enemies
   ("enemies you know idk" → keep the 74 new enemies, `$M/combat.md` TL;DR 2).
8. **Tracks: curves, loops, crossings, splits, tunnels** ("tracks are linear and repetitive", O7 17:06) — IN
   PROGRESS in worktree `/home/user/wt-tracks` (`src/core/track.js`, `src/render/trackMesh.js`, 13 modified files,
   uncommitted). Must land and survive the merge.
9. **Re-validate free counters, rarities and balance for the merged roster** (C19/C20 "free unit before the
   mechanic"; README L85-86). Old and new rarities disagree for the same ids (old Shiro SSR / new SR; old Kaede R /
   new SSR; old Raika SSR / new SR) — choose one table.
10. **Process:** builder + screenshot-critic loop on every merged screen and art batch (O7 16:36, 17:14), Meshy
    "one test + credit report first", and rewrite `docs/ROSTER.md` + README roster table (owner asked for the list
    of characters and what they do, C19).

**Biggest owner asks that NEW lacks but OLD already has (P1 — port, don't redesign):** the city hub
(owner O7 17:07 "What is missing is the city… make it look more interesting"), Hikari's kawaii tutorial +
Captain's Journal lessons + free 10-pull after 3 clears, multiple tower/hero banners rotating at 7 PM Central,
Genshin-like wish cinematic (portal + meteor coloured by rarity), hero ult cut-in, sandbox, Bloons-like modes and
map gimmicks, energy for resource stages, per-unit copy ranks, audio (NEW's audio settings are dead toggles), title
screen, reset 67 → tutorial. Summer event (10 VN chapters, 5 ops, shop, affection) is P2 because every outfit must
be redone — unless the owner wants it this season (the old event window is 2026-10-03 → 11-03, i.e. now).

**Owner's 368 MB Codex package (offered O7 16:47) holds things the site mirror does not:** `references/` (39
recovered attachments — the images from C3/C6/C7/C13/C14/C16/C18/C19 that `docs/OWNER_REQUESTS.md` L7 calls
"not recoverable"), `references/Sakura_Sentinels_V2_Roadmap_and_Audit.md` (ChatGPT's full acceptance matrix,
HO L184-185), `source/server/battle-verification.js` (anti-cheat), `models-uncompressed/` (bpy here cannot import
Draco), `source/scripts/art/` (Codex Blender builders). Worth asking for those four folders only.

---

## 1. Standing rules (apply to every row)

| Rule | Source | Status |
|---|---|---|
| Academy girls are students: no fanservice, no swimsuits/bikinis/lingerie, no body-focused framing; heroes may be elegant adults, still no body-focused framing | CONTRACTS.md §0 L21-24; CL 10-05 09:10, 09:26; `scratchpad/art-pilot/BIBLE.md` | in force |
| No swimwear-like outfits on chibi (child-proportioned) bodies, even for adult-labelled characters | task brief; `$M/integration.md` D4 | in force — affects Marina, Amane, Nami beach skin |
| Never ship third-party assets (BA/Bloons screenshots, Suzuka/Aqua/Megumin models, jaeysart .blend, YouTube thumbs); keep them in git-ignored `docs/reference/thirdparty/` | CONTRACTS §0 L25-26; commit `0fcb972`; `docs/REFERENCES.md` L13-15 | in force |
| "A feature is not complete because its button, asset or code exists" — needs in-game result, tests, evidence | RM L206; CONTRACTS §12 L761-762; HO L194-195 | violated today by NEW's audio toggles (U-20) |
| Don't recreate exactly — make it better | CL 10-05 08:58 | in force |
| Prove one character / map / loop first, then roll out | REC (share3 L85-99); CONTRACTS §12 L786 | in force |
| Meshy: one test first, report credits, owner approval before batches; never handle the API key | session rule; BIBLE.md "Tools" | in force; ~1,390 credits at last log (`scratchpad/meshy-chibi` logs), 9 credits per 2D image |
| Stay on the web build (three.js); Unity not needed now | O7 16:44-16:45 (answered); RM/ChatGPT share3 L111-117 | decided |

---

## 2. Checklist

### 2.1 Roster & characters

| ID | Request (source) | NEW status (evidence) | OLD? | Prio | Notes |
|---|---|---|---|---|---|
| R-01 | Anime-girl TD starting with "1 hero, 10 towers, 1 ability" (C1) | DONE, exceeded: 3 heroes + 16 towers (`src/data/units.js`; README L116-136); hero ult = the ability (`src/sim/hero.js` L39, L99) | DONE: 7 heroes + 25 towers (`data.js`, `expansion-roster.js`, `summer-content.js`) | — | historical scope |
| R-02 | **Get the OLD characters in as the main roster** — "the designs were cute at least", "the main thing is get the characters in" (O7 16:52, 17:01) | MISSING: units.js = 19 V2 designs; `src/models/index.js` only knows Blender GLB + procedural | DONE: 32 girls, 35 Draco GLBs `assets/models/*.glb` + `face-atlas.png`, `chibi*.js`, `expansion-weapons.js` | **P0** | Working three r186 port prototype: `$M/proto/merge-port.html` (`$M/characters.md` §0.1, §5). Merge LOD/meshopt (old GLBs ≈30k verts, 3× NEW). |
| R-03 | **Keep the current (V2 Blender) girls as special skins** (O7 17:01) | MISSING: no skin data, save field, model option or UI | DONE concept: per-unit skins `BEACH_SKINS` (`summer-content.js` L69-91), `p.equippedSkins`, wear/return UI (`season-ui.js` L62) | **P0** | Design in `$M/integration.md` §1: `src/data/skins.js`, `src/systems/skins.js`, `units[id].skin`, SAVE_VERSION 2→3. Decision D1: how skins are obtained (free with unit recommended). |
| R-04 | **V2 Rei, Nami, Luna, Kaede → future-release characters (new names, ids clash); Yuki, Suzu etc. → skins** (O7 17:25 "I like rei, nami your luna kaede but like yuki suzu … could easily be skins") | MISSING (recorded only in `docs/OWNER_REQUESTS.md` L280-283) | n/a | **P0** park / P2 release | Keep their GLBs (`public/models/characters/{rei,nami,luna,kaede}*.glb`) and freeze their look (`$M/integ/sentinel-snapshot.json`); 15 other V2 designs become skins on the same-id old girl. |
| R-05 | Expansion roster: 11 new towers + 3 heroes, target "24 towers, 6 heroes" ("Let's do it", "Run do it all") (C22-C25, CX@1254) | PARTIAL: only Kaede, Suzu, Chika (units.js; README L135-136) | DONE: kaede, suzu, chika, ruri, fuu, hana, kohaku, tsubaki, noa, iroha, ena + heroes kanna, yoriko, seiran (`expansion-roster.js`) | **P0** | 7 need sim additions: aim point + delayed shells (Tsubaki, Seiran ult, Iroha, Suzu), relay attacks (Ruri familiar, Iroha mirror), grounding flyers (Hana, Fuu, Seiran), pull (Fuu), curse spread (Ena), 3 ult shapes (`$M/combat.md` §0.3, §4). Kanna/Yoriko/Seiran must be adult guardians (integration D3). |
| R-06 | A gacha "with a new tower and hero" (C4) | DONE (Luna, Hotaru recruitable; `src/ui/screens/recruit.js`) | DONE (`gacha.js` L39-47 "Moonlit Wishes": Luna + Hotaru) | — | |
| R-07 | Rarities for towers, progression-based (C7) | DONE R/SR/SSR (`src/data/types.js` L199-201) | DONE (`growth.js` RARITIES L23, BASE_RARITY L28) | **P0** recheck | Pick one rarity table for shared ids (they differ, see §0.9). |
| R-08 | Two units + a hero placeable on water (C19) | DONE: Sango, Umeko, Nami (`placement: 'water'`) | DONE (+ Seiran, Marina, Amane as land+water) | — | Decide amphibious vs water-only for ported water girls. |
| R-09 | Subclass towers by role like Bloons, "more unique"; keep the type chart (C19) | DONE: 19 roles + `ROLE_CATEGORIES` (`types.js` L81), `unitSubclassLabel` (`src/data/wiki.js`), 5×5 type chart | DONE `SUBCLASSES` (`$M/fmt/data.js` L340-357) | — | |
| R-10 | Role types: duelist/DPS, control, support, frag … (C19) | DONE | DONE | — | |
| R-11 | "List all the characters and what they do" (C19) | DONE for 19 (`docs/ROSTER.md`; README L114-138) | Codex reply table (CX@911) | **P0** | Rewrite for the merged roster + skins + future units. |
| R-12 | Free unlock girl before each required mechanic (ghost only certain types hit, "ninja monkey camo"; water stage gives the water girl) (C19, C20) | DONE: "every counter… from a free girl, one stage before" (README L85-86; stage `unlocks`) | DONE `EXPANSION_GRANTS`, `CHAPTER_UNLOCKS` (`growth.js` L50-51) | **P0** recheck | Re-validate after the roster swap; integration D2 (which new girls are free). |
| R-13 | Role rebalance: artillery breaks armor (Sango), precision kills priority targets (Shiro), split melee Cleaver/Duelist, role·element·capabilities on cards, behaviour-changing trees (C21 + "Let's do it" C23, CX@1198) | DONE (target mode `elite`, Sango shred, Rei cleaver / Kaede duelist, Info-tab chips, 3×5 crosspaths) | PARTIAL (3 branches, primary + limited secondary) | — | Port old kits onto the new pipeline using `$M/combat.md` §2.3-2.4 conversions. |
| R-14 | Heroes: unique skills + "a cool cutscene animation attack" (C6) | PARTIAL: 3 ults in sim; render = screen flash + rings + shake only (`src/render/BattleRenderer.js` L461-477) | DONE: real-time 3D hero cinematic (`cinematics.js` mode `hero`, L6-60) + "Hero attack cinematics" setting (`req-pretty/app.js` L468) | P1 | Skippable, never changes damage, respects reduceMotion. Needs 4 more for old heroes. |
| R-15 | Nerf heroes, "super OP" (C18) | DONE (CONTRACTS §5b L514; §5 L411-412) | DONE ("weaker hero scaling", CX@911) | — | Tune Kanna, Yoriko, Seiran (+Amane) to the same bar. |
| R-16 | Every tower has its own tree (C6) | DONE as battle 3×5 crosspath tree (Student → Tree tab) | DONE permanent talent trees `UNIT_TREES` (`req-pretty/progression.js` L192) + 3 battle branches | — | Old permanent talents → see P-09. |
| R-17 | "They get stronger the more copies of a unit you have" (C6) | PARTIAL: dupes → generic Star Fragments (`src/systems/unlocks.js` L21-31; `types.js` L199-201 `fragmentsOnDupe`), nothing per-unit | DONE: Bond Rank by copies `COPY_THRESHOLDS = [1,2,4,7,11,16]`, copies never consumed (`req-pretty/progression.js` L4-5; lesson text `feature-progress.js` L49) | P1 | Add a per-unit copy rank on top of fragments. |
| R-18 | Free summer tower + super-hard event boss that rewards a new hero (Marina, Amane) (C40) | MISSING | DONE (`summer-content.js` L10-68) but outfits are swimwear-like on chibi bodies; Marina (23) is a tower | P2 | Content redo first; integration D4 (towers = students rule). |
| R-19 | "Keep the original characters" (Codex's own instruction, HO L176) | covered by R-02 | — | **P0** | |

### 2.2 Art & models

| ID | Request (source) | NEW status (evidence) | OLD? | Prio | Notes |
|---|---|---|---|---|---|
| A-01 | Cute 3D chibis in gameplay like Umamusume / Arknights (C2, C3) | DONE: 19 rigged Blender GLBs + LODs (`public/models/characters/`) | DONE: 35 rigged Draco GLBs | **P0** | Old GLBs become the main battle chibis; V2 GLBs become skins. |
| A-02 | Chibis like the attachments, not flat; better faces; "proper body types and proportions"; research tutorials (C7, C9, C10, C12, C14, C16, C41; CL 10-05 13:18 "models still look really shitty") | PARTIAL: owner on V2: "the girls look cute" in battle but the 3D lobby girl "looks ugly as shit" (O7 17:06) | PARTIAL: "the designs were cute" (O7 16:52); flaws listed in `$M/characters.md` §0.7 | **P0** | Superseded as a target by A-03. |
| A-03 | **Approved look: Meshy Hikari turnaround = target for every 3D battle chibi and 2D chibi art** (O7 17:43) | IN PROGRESS: reference committed (`d617b2e`, `docs/art/approved/`); 3D test untracked (`public/_meshy-test/hikari.glb`, `previews/_meshy-test.html`) | It was generated from old `hikari.webp` + an old chibi crop | **P0** | Prompt per girl in `docs/art/approved/chibi-style-hikari-prompt.txt` (9 credits/run). |
| A-03b | **Bigger and stubbier battle chibis like the BA model ("the big issue is the scaling"); owner scores: Meshy 6/10, Codex 3/10 "ugly"; the 2D chibi sheet looks better than the 3D** (O7 18:20, 18:26; Wakamo ref zip) | IN PROGRESS: `scratchpad/chibi-v2/` Hikari (separate eye/mouth atlas; baked old eyes still visible, `shots/portrait3.png`); scales unchanged (`src/render/actors.js` L12-14) | Codex GLBs ≈2.3 heads but rated ugly | **P0** | See §00. Use the Wakamo rip for proportions only; never ship it. |
| A-04 | Use Meshy ("don't forget you have meshy", "people make chibi renders in meshy that look like what I want") (O7 16:39-16:44, 17:28) | IN PROGRESS (API works through the proxy; `scratchpad/meshy-chibi/`, `scratchpad/meshy/`) | — | **P0** | Credit budget: ~1,390 left at last log; 3D image-to-3D + rig + animation cost much more than 2D. |
| A-05 | Main style video = dino-hoodie chibi (C43; REFERENCES.md L7) | SUPERSEDED by A-03 | not achieved (HO L138-139) | — | |
| A-06 | Use the owner's base mesh Chibibase (C12) | DONE as V1 fallback (`public/models/chibi_base.glb`) | used by Codex | P2 | Only a fallback after the merge. |
| A-07 | Proper skeletons for expressive acting (C42) | DONE: clips idle/walk/attack/cheer/victory/hurt/pickup (`src/models/glbChibi.js` L5, L299) | DONE: 27-joint rigs + procedural acting, 8 viewer poses (`chibi-acting.js`) | **P0** | Old acting is code, not clips → wrap as `userData.animate` (`$M/characters.md` §5). |
| A-08 | Pick up the chibi girls; they wriggle cutely (C6, C16) | PARTIAL: lobby secretary tap reaction `pickup` (`src/ui/lobby/secretary.js` L375) | DONE: city Play mode, held pose with kicking feet (`req-pretty/village.js` L323-489) | P1 | Comes with the city (H-*). |
| A-09 | Character view: card art and chibi, clearly separated (C19) | DONE: Card Art ⇄ 3D Chibi toggle (`src/ui/screens/student.js` L1-4, L248) | DONE (`data-view="art"/"chibi"`) | **P0** | Card art must become illustrations (A-10). |
| A-10 | **Drawn art instead of code-drawn**: background art for the girls, portraits "like this" (O7 17:06-17:16; Claude admitted SVG limits CL 10-05 09:26) | MISSING: all portraits are `cardArtSVG` (`src/art/cardArt.js`) | DONE for 20: `assets/{hikari,luna,nami,hotaru,sango,umeko}.webp` + 7 pair portraits (downloaded to `$M/portraits/`); `academy.webp` landscape | **P0** | Missing: aoi, rei, yuki, akane, shiro, kage, raika, miko, midori, momo (+ non-swimwear marina/amane). Put art inside the SVG frame (`$M/integration.md` §4). |
| A-11 | Azur Lane-style stands: new dynamic pose on a themed diorama, transparent; "the proportions get all weird, ew" → redraw the pose, keep proportions (O7 17:11-17:16) | IN PROGRESS: pilot Hikari/Sango/Aoi with critic (`scratchpad/art-pilot/`, BIBLE.md: 6.5-7.5 heads, legs 45-50 %) | — | P1 (pilot P0) | Critic must measure proportions against the anchor illustration. |
| A-12 | Bremerton-style info card: big name, class, rarity, stat radar, expression strip (O7 17:11; OWNER_REQUESTS L285) | MISSING (Student Info tab = text/chips) | — | P1 | After illustrations exist. |
| A-13 | Lighting, cute 3D props, bloom, post-processing; "lighting physics post effects engine" (C4, C16) | DONE: UnrealBloom, fog, quality presets (`BattleRenderer.js` L8-10, L24-26, L91-96), props/ambient | DONE (`postfx.js` bloom/AO/grade, `lighting.js`) | — | No physics in either; fine. |
| A-14 | Icons for everything; proper material icons (C14; RM L10) | DONE: test that every item has a dedicated icon (`tests/integration/consistency.test.js` L70-72); illustrated lobby icons (`src/art/lobbyIcons.js`) | PARTIAL (Lucide glyphs, `ui-icons.js`) | — | Owner: "item icons… a lot does look better" (O7 17:06) — keep NEW. |
| A-15 | Remake models after the references, don't import them (C8, C9) | DONE (no third-party model shipped) | Codex had integrated 3 guest models with a toggle (CX@619) | — | Never ship Suzuka/Aqua/Megumin. |
| A-16 | Bestiary shows enemy models (C20) | DONE (`src/ui/screens/bestiary.js` L2, L17) | DONE (`enemy-viewer.js`) | — | |
| A-17 | Old illustrations need content fixes: Hikari bust-focused; `roster.webp` fan-service on students; summer art (rule) | n/a | flagged in `$M/characters.md` §7 | **P0** | Crop/repaint Hikari; never ship `roster.webp` for students; content-check `assets/summer/*`. |

### 2.3 UI / menus

| ID | Request (source) | NEW status (evidence) | OLD? | Prio | Notes |
|---|---|---|---|---|---|
| U-01 | "Copy the menu from Bloons TD6" (C1) | SUPERSEDED by Blue Archive (O7 16:38); campaign picker is still BTD6-style (`src/ui/screens/campaign.js` L2-3) | — | — | |
| U-02 | Blue Archive-style overhaul: menus, transitions, animations; "ui doesn't look clean" (RM L4; CL 10-05 13:18) | PARTIAL/ongoing: BA lobby layout, missions hub, Menu Tab, slanted panels; owner: "way way better, but still needs to improve" (O7 17:06) | PARTIAL (city-first lobby) | **P0** continuous | Critic loop per screen. |
| U-03 | **Home menu: drawn wide landscape art per girl (memorial lobby), breathing/tap; no 3D girl, no SVG room** (O7 16:34, 17:06, 17:11, 17:16) | MISSING: 3D secretary + SVG office (`lobby.js` L3-8, `secretary.js`, `lobbyRoom.js`) | `academy.webp` title art only | **P0** | Safe zones: `scratchpad/art-pilot/BIBLE.md` "LOBBY". Keep ‹ › secretary swap, hide-UI, notice, carousel. |
| U-04 | Horizontal first (home menu especially); dynamic compositions (CL 10-05 13:18; O7 17:16) | DONE landscape (`src/ui/orientation.js` L2-4; manifest `orientation: landscape`); dynamic art pending | portrait-friendly | **P0** (art) | |
| U-05 | "Make the splash menu better" (C16) | MISSING: only a boot splash (`src/ui/styles/base.css` L347), boots into lobby | DONE title screen "MEET HIKARI" over `academy.webp` (`req-pretty/app.js` L1724) | P1 | Cheap once art exists. |
| U-06 | Transitions on everything; motion 80-120 / 180-260 / 300-450 ms (C16; REC share3 L63) | DONE (`base.css` L38-42 `--t-press/--t-panel/--t-screen`; `src/ui/router.js` L82-84) | PARTIAL (`motion.js`, 32 lines) | — | |
| U-07 | Cleaner menu, study real gacha layouts (C15) | DONE/ongoing (missions hub, Menu Tab) | DONE ("City, Units, Battle, Summon, Shop + command menu", CX@791) | — | |
| U-08 | Upgrade tab as its own thing (BA reference) (C16) | DONE (Student tabs Level Up / Awakening / Equipment / Tree) | DONE | — | |
| U-09 | Character page with level up, awakening, equipment, tree (C19) | DONE (`student.js` L1-4, TABS L32) | DONE | — | |
| U-10 | Team builder "like this" (C7) | DONE: one formation, hero + 8 (`src/ui/screens/formation.js`) | DONE + multiple saved teams (`req-pretty/growth.js` `saveTeam` L343, `useTeam` L371) | P2 | Saved team presets. |
| U-11 | Little icon when a unit is effective on a stage (C7) | DONE ("Glowing girls cover a counter" `formation.js` L187 and one-tap "Add counters" L120; stage prep `stage.js` `countersPanel` L522) | DONE (`matchup`, `growth.js` L385, double-chevron) | — | |
| U-12 | Map preview before entering; click for details and Bloons-like modes (C7, C13) | PARTIAL: SVG thumbnails + stage prep with 4 difficulties (`stage.js`, `src/art/stageThumb.js`); no 3D explore, no modes | DONE: "EXPLORE IN 3D" rotatable preview (`req-pretty/app.js` L2260, L2298) + 6 modes (B-14) | P1 modes / P2 3D preview | |
| U-13 | Medal in the stage card corner per difficulty (C20) | DONE (`stage.js` L99 `medalRow`; campaign cards) | DONE (per difficulty × mode) | — | |
| U-14 | Wiki built into the game (C18) | DONE: 17 searchable articles (`src/data/wiki.js`) | DONE (wiki tabs roster/types/counters) | **P0** recheck | Update for merged roster + new mechanics. |
| U-15 | Backpack + item icons (C18), organised by category not rarity (RM L10) | DONE (`src/ui/screens/backpack.js` L1; tabs by category, rarity = filter) | PARTIAL | — | Owner preferred NEW. |
| U-16 | Levels show where items drop; teleport to that stage (C18) | DONE (`itemSources`, Teleport, `backpack.js` L53-68) | DONE (`source-jump`) | — | |
| U-17 | Upgrade requirement: icon + name + owned/required + where (RM roadmap) | DONE (`backpack.js` L53 requirement line) | PARTIAL | — | |
| U-18 | Designed empty / locked / insufficient states (RM roadmap) | DONE (`emptyState`, `lockedTab` `student.js` L288) | PARTIAL | — | |
| U-19 | Hide the UI / "play mode" (C6) | PARTIAL: lobby ⤢ hide-UI (`lobby.js` L176, L217) | DONE city Play mode (`req-pretty/app.js` L2523) | P1 | With city. |
| U-20 | Settings with graphics and sounds (C6) | PARTIAL: graphics DONE; **audio toggles exist but there is no audio code at all** (`src/ui/screens/settings.js` L83-87; no `AudioContext`/audio files in `src/`) | DONE (`audio.js` + settings) | P1 | Dead toggles break the "button ≠ feature" rule. |
| U-21 | Mobile support (C17) | DONE (844×390 layouts; smoke at 1280×720, 844×390, 390×844) | DONE | — | Real-device perf unverified in both. |
| U-22 | Progression planner (REC) | MISSING | MISSING | P2 | |

### 2.4 Gacha

| ID | Request (source) | NEW status (evidence) | OLD? | Prio | Notes |
|---|---|---|---|---|---|
| G-01 | Gacha animations + 10-pulls, skippable (C6) | DONE (`recruit.js` `playReveal` L281-384, Skip L290; results saved before the animation, header L6) | DONE | — | |
| G-02 | Reveal "like CRK or Genshin, cool VFX"; Genshin = the gacha reference (anticipation → meteor colour by rarity blue/purple/gold → readable results) (C6; O7 16:38; OWNER_REQUESTS L271) | PARTIAL: CSS halo "envelope", card flips, SSR showcase with SVG card (`recruit.js` L295-334); no rarity colour tell | DONE-ish: 3D portal + meteor coloured by best rarity `#ffdb85/#d5adff/#9cdfff` + 3D chibi reveal (`req-pretty/cinematics.js` L53-60, L121, L537-602); looked at `$M/world-shots/old/o17-wish-cine-b.png` | P1 | Port the idea with illustrations; keep "results never lost or double-charged". |
| G-03 | verity777 currency must not drop after a pull (C7) | DONE structurally (single local profile) but no test that 999,999 survives 1× and 10× pulls (`tests/systems/missions.test.js` has only reset 67, L135) | DONE (save-switch bug fixed, CX@619, CX@911) | P1 | Add the regression test. |
| G-04 | Multiple banners for towers and for heroes (C7) | MISSING: one "Standard Recruitment" (`recruit.js` L126-141; `src/systems/gacha.js` `POOL` L17) | DONE: 11 banners, `category: towers|heroes` (`req-pretty/gacha.js` L60-190) | P1 | 30+ unit pool needs it; event girls stay out of ordinary pools (HO L118). Integration D5. |
| G-05 | Banners rotate on real time, daily 7 PM CST (C15) | MISSING | DONE `bannerRotation()` America/Chicago 19:00, standard + 5 rotating pairs, countdown, "nothing was spent" guard (`req-pretty/live-ops.js` L38-79) | P1 | |
| G-06 | SSRs harder (C18) | DONE: SSR 1.5 %, pity 90, ≥1 SR per 10, spark 200 (`types.js` L260) | DONE 1.5 % / 90 | — | |
| G-07 | F2P and premium currency (C7) | DONE coins + gems | DONE credits + starlight | — | |
| G-08 | Free multi after a few stages, then teach upgrading (C40) | PARTIAL: one 10× ticket at account creation (`src/systems/save.js` L60-73); no 3-clear trigger, no lesson | DONE `welcomeMulti` after 3 clears + level lesson (`req-pretty/gacha.js` L417; `feature-progress.js` L27-42) | P1 | With the tutorial (T-*). |
| G-09 | Recruit trials before pulling; wish list (REC) | MISSING | MISSING | P2 | |

### 2.5 Battle & maps

| ID | Request (source) | NEW status (evidence) | OLD? | Prio | Notes |
|---|---|---|---|---|---|
| B-01 | Bloons-TD-inspired tower defense (C1) | DONE | DONE | — | |
| B-02 | Free placement, no tiles (CL 10-05 13:18) | DONE (`src/sim/placement.js`; `docs/PLACEMENT.md`) | DONE (free land placement) | — | |
| B-03 | No red forbidden border; small circle under the girl, red where she can't stand, white where she can (O7 17:21) | DONE (commit `9da14e4`; settings text `settings.js` L91) | — | **P0** verify | Re-check footprints with the old (bigger) models. |
| B-04 | Drag-and-drop actually places on release (C37) | DONE (README L35; smoke does a real drag) | DONE (`deployment-input.js`) | — | |
| B-05 | Identify entrances/exits with cute animated arrows (C37) | DONE arrows + glowing discs + gates (`src/render/ambient.js` L331-370); no text labels | DONE "ENTRY / EXIT ♡" labels + chevrons (`oldgame/route-markers.js` L15) | P2 | Labels optional. |
| B-06 | **Tracks not linear/repetitive: Bloons-like curves, loops, crossings, splits, tunnels** (O7 17:06; C14 "more variety") | IN PROGRESS: tracks-v3 (`/home/user/wt-tracks`: `src/core/track.js`, `src/render/trackMesh.js`, 13 modified files incl. sim/render/data, uncommitted) | 22 maps with loops/crossings/alternating lanes | **P0** finish | |
| B-07 | More interesting map types with gimmicks, water theme (C6) | PARTIAL: water lakes/islands/bridges and themes; no map gimmicks (no map rule in `src/data/stages.js`, `maps.js`, `src/sim/`) | DONE per-map rules with ACTIVE/resting rhythm, e.g. "Lunar eclipse · ACTIVE" (`$M/combat.md` §3.5) | P1 | One rule per map, previewed. |
| B-08 | ~15 levels with unique areas → more stages (C6, C29, C39) | DONE: 40 campaign stages / 8 chapters, 49 maps | DONE: 22 campaign + 5 resource + 3 boss + tutorial + 6 event (37 maps) | — | |
| B-09 | Maps vibrant/alive like BTD6 (CL 10-05 13:18; RM L14; O7 16:38) | DONE V2 terrain; owner: "the maps look so much better" (O7 17:06) | weaker | — | Keep NEW. |
| B-10 | Boss stages (C7); custom maps for resources and bosses (C18) | DONE: 3 Total Assault + 15 Bounty (gates 1-5/3-5/5-5; bosses 5-5/6-5/8-5) | DONE (raids + 5 resource ops) | — | |
| B-11 | Sandbox mode (C7); tactical lab with damage breakdown (REC) | MISSING (no sandbox in `src/`) | DONE sandbox: 999,999 coins, any girl/map/enemy, spawn controls, no rewards (`req-pretty/app.js` L519-596; lesson at 7 clears) | P1 | Damage breakdown = P2. |
| B-12 | Bloons-like difficulty modifiers / modes per map (C13) | PARTIAL: 4 difficulties easy/normal/hard/nightmare + medals (`types.js` L178) | DONE 6 modes: Standard, Reverse Route, Goblin Rush, Ironclad, Half Income, Last Petal, medal per difficulty × mode (`$M/pretty/battle-modes.js` L3-51); map tiers L61-65 | P1 | Also covers REC "mission contracts". |
| B-13 | Harder: Bloons / Battle Cats level, "far too easy" (C18; RM L18) | DONE per bot: free units Easy 40/40, Normal 39/40, Hard 28/40, Nightmare 0/40 (CL 10-05 13:33; `docs/CAMPAIGN.md` L142-146) | DONE (cozy/standard/challenge) | **P0** recheck | Re-tune after roster swap; owner hasn't playtested NEW difficulty. |
| B-14 | Stage reflects new enemies (C20) | DONE (`src/render/terrain.js` L142-169 `INTRO_KEYWORDS`) | DONE | — | |
| B-15 | Pre-wave warnings; evidence-based defeat debrief (REC, adopted in CONTRACTS §12) | DONE (`src/sim/report.js` L125-176; `src/ui/battle/scout.js`) | PARTIAL (blocking scout modal) | — | |
| B-16 | Next-wave scouting, teleport warnings, field rings, counter shortcuts (CX@1043) | DONE | DONE | — | |
| B-17 | Sweep mastered farm stages; fast restart; reduced effects (REC) | DONE (sweep after Hard `src/systems/rewards.js`; pause → restart; `reduceMotion`) | PARTIAL | — | |
| B-18 | Interactive battlefields (bridge switch, lantern reveal, debris for rooftop slots) (REC) | MISSING | PARTIAL (map rules) | P2 | |
| B-19 | Link Arts, commander tool, mastery trials, reserve slot, roguelite expeditions, equal-roster puzzles + share codes, formation blueprints (REC) | MISSING | MISSING | P2 | Suggestions only; owner never confirmed individually. |

### 2.6 Enemies

| ID | Request (source) | NEW status (evidence) | OLD? | Prio | Notes |
|---|---|---|---|---|---|
| E-01 | Orcs, slimes, goblins; ghosts/ghouls/oni by map (C4, C5) | DONE: 74 defs / 12 families, 12 family GLBs 2.27 MB | DONE: 80 defs / 12 families (primitive models) | **P0** decision | Keep NEW enemies ("enemies you know idk what else you're gonna keep", O7 17:01); port ~9 old ideas (E-09). |
| E-02 | Crossovers like a purple goblin with Battle Cats-style weaknesses (C5) | DONE (type chart + traits; slime mimics copy one trait) | DONE | — | |
| E-03 | A ghost only certain heroes can hit (C19) | DONE (veiled/phasing + reveal/Veil Sight) | DONE | — | |
| E-04 | Slimes of every colour copying traits; goblins fast, orcs tanky, ghouls siphon/teleport, oni fields (C20) | DONE (15 slimes; traits siphon, blink, field, …: `types.js` TRAITS, 20 keys) | DONE | — | |
| E-05 | Minibosses: slime prince, orc general, goblin machine, oni champion (C20) | DONE (`slime_prince`, `orc_general`, `goblin_machine`, `oni_champion`) | DONE | — | |
| E-06 | Dragon boss, lizard men (C20) | DONE (`dragon_ashwing` boss; 4 lizardfolk) | DONE (Ashwing Matriarch) | — | |
| E-07 | Bestiary black/locked until you beat a stage with it (C20) | DONE (`bestiary.js` L2) | DONE | — | |
| E-08 | 12 families, 60-80 variants, reusable traits (armored, barrier, crystal, veiled, regen, hasty, volatile, airborne, ward, brood) (C22-C23) | DONE | DONE | — | |
| E-09 | Enemies v2: engaging, rewards tactics, NOT convoluted (one rule each) (RM L20) | DONE (CONTRACTS §12 L764-770) | more stacked rules | — | Port old ideas as new defs on existing GLB variants (`$M/combat.md` §5.3). P2. |

### 2.7 Economy & progression

| ID | Request (source) | NEW status (evidence) | OLD? | Prio | Notes |
|---|---|---|---|---|---|
| P-01 | Items from stages to level, awaken and gear like BA (C7) | DONE (books, breakthrough mats, crowns, gear) | DONE | — | |
| P-02 | Shop tab with random items on rotation (C7) | PARTIAL: Mall 5 tabs, 52 fixed offers with daily/weekly restock (`src/data/shop.js` L3, L11-32; `src/systems/shop.js` L11-26) | DONE random `shopRotation()` (`req-pretty/growth.js` L515) | P2 | |
| P-03 | Special stages that cost **energy** for grinding books/money/materials (C15) | MISSING: Bounty stages are free; no energy anywhere in `src/` | DONE `ENERGY_CAP 120`, +1 every 6 min, tiers cost 10/15/20, unlock at 0/12/18 clears (`req-pretty/live-ops.js` L4-5, `FARM_TIERS` L80-105, `FARM_STAGES` L106-162) | P1 | Owner asked; ChatGPT advised generous regen. Confirm with owner (decision D-d). |
| P-04 | Make upgrading harder (C15) | DONE (CONTRACTS §5 costs) | DONE | **P0** recheck | With the bigger roster. |
| P-05 | Boss stages drop rare level items/gear; crowns as awakening item from bosses (C18) | DONE (5 crowns; `docs/CAMPAIGN.md` L120-121) | DONE | — | |
| P-06 | Gear with stat + substat rerolls (C18) | DONE (`src/systems/gear.js` `rerollSubstats`, `rerollMainStat`, lock pin) | DONE (`growth.js` L570) + crafting L269 | — | Old gear crafting not in NEW (P2). |
| P-07 | Different materials per character (C18) | DONE: 7 material families | DONE `UNIT_FAMILY` (`req-pretty/items.js` L17) | **P0** | Assign families to the 13 old-only girls. |
| P-08 | Item rarities common/rare/super rare/mythic/legendary (C18) | DONE | DONE | — | |
| P-09 | Knowledge tree / account-wide gimmick (C6) | MISSING | DONE `KNOWLEDGE` + Knowledge Stars + talents (`req-pretty/progression.js` L207, L387-412) | P2 | |
| P-10 | Copies strengthen the unit → R-17 | | | P1 | |
| P-11 | Scale unlocks of bosses/resources with progress (C39) | DONE (stage `requires`) | DONE feature gates: resources 5, gear+event 6, sandbox 7, bosses 8/14/20, awakening 10 (`feature-progress.js` L2-99; HO L104-108) | — | |
| P-12 | Start with the first basic tower, unlock more one by one (C29) | PARTIAL: starts with Hikari + Aoi + Rei (`save.js` L21) then free girls by stage | DONE: Hikari + Aoi; tutorial → Yuki; Rei, Miko, Momo early (`growth.js` L49-51) | P1 | With the tutorial. |
| P-13 | Stop currency cheating ("game guardian") (C29, C35) | MISSING: plain localStorage profile, no checksum | DONE server replay verification of rewards (server not in the mirror; only in the 368 MB package) | P2 | Static Pages can't be cheat-proof; a checksum deters casual edits. Say so honestly. |
| P-14 | F2P income overview, weekly double-drop event, achievements (NEW extras from BA/HSR refs) | DONE (`src/ui/screens/rewards.js`; `WEEKLY_EVENTS` 5; 30 achievements) | — | — | |

### 2.8 City / hub

| ID | Request (source) | NEW status (evidence) | OLD? | Prio | Notes |
|---|---|---|---|---|---|
| H-01 | Cute 3D "loading screen"/hub showing all girls doing stuff, customisable with preset decor from a side menu (C6) | MISSING | DONE Moonpetal City + `DECOR` presets (`req-pretty/progression.js` L308-358; `app.js` L1567) | P1 | |
| H-02 | Centre = small city; girls walk; inside a building → icon; tap → teleport inside (C15) | MISSING | DONE (`req-pretty/village.js` `enterBuilding` L134; `city-scene.js` `CITY_BUILDINGS` L6) | P1 | |
| H-03 | City A LOT larger (C16); "codex gave a small one that's just on a square, make it look more interesting" (O7 17:07) | MISSING | PARTIAL: 5 districts (`city-scene.js` L388 `CITY_DISTRICTS`), still reads as a square grid (looked at `$M/world-shots/old/o02-city.png`) | **P1 (first)** | Port + expand (districts, canals, academy hill, harbour) — lead task #63. |
| H-04 | Girls appear in the city as you unlock them (C38) | MISSING (no city) | DONE `setResidents(unlocked)` (`village.js` L71) | P1 | |
| H-05 | Living clubhouse: characters act out interactions; furniture unlocks interactions (REC) | MISSING | PARTIAL (building interiors) | P2 | |

### 2.9 Events & live-ops

| ID | Request (source) | NEW status (evidence) | OLD? | Prio | Notes |
|---|---|---|---|---|---|
| L-01 | Login reward system (C40) | DONE 7-day calendar, missed days never reset (`src/ui/screens/commissions.js` L180); daily reset = local midnight (L206) | DONE 7-step track, one claim per Chicago 7 PM cycle (`req-pretty/summer-event.js` L20, L63; `season-ui.js` L126-143) | P2 | Unify every daily reset (banners, login, commissions, shop) on 7 PM America/Chicago (decision D-e). |
| L-02 | Events with visual-novel mini stories, beach day, funny/silly (C40) | MISSING: missions hub "Story — Coming soon" (`src/ui/screens/missions.js` L73) | DONE 10 chapters "The Beach Day That Got Away" (`req-pretty/summer-content.js` L251-406) | P2 (P1 if this season) | Old window 2026-10-03 → 2026-11-03 (`summer-content.js` L2-9) = now. Read every chapter for content; drop "fan service" framing the owner asked for. |
| L-03 | 5 special stages + 8-12 novel stages, beach scenery: boardwalk, shore for water units, night beach (C40) | MISSING | DONE 5 ops: Ramune Boardwalk, Lemonade Lagoon, Seashell Bridges, Firefly Strand, Last Light Marina (`summer-content.js` L92-153) | P2 | Build maps on the NEW terrain. |
| L-04 | Temporary event currency + event shop with equipment (C40) | MISSING | DONE Shell Tickets + `SUMMER_SHOP` (L168-250) | P2 | |
| L-05 | Mini dating sim: gifts, affection, skin when maxed, 3 for now (C40) | MISSING | DONE (100 affection → outfit, gifts +15/+8, bond chats; `season-ui.js` L54-62) | P2 | Rewards must be non-swimwear outfits (rule). |
| L-06 | Super-hard event boss, F2P-possible, play-tested, top-percent reward (C40) | MISSING | DONE Seaglass Leviathan 12 waves, needs 20 clears; automated F2P clear at Lv28 (`summer-content.js` L154; HO L123-126) | P2 | |
| L-07 | "Sexy bikini" outfits/hero, "Japanese summer fan service" (C40; CL 10-05 09:09) | DECLINED for students and any chibi body (see §3) | old shipped 3 beach GLBs | — | |
| L-08 | Global chat, transfer codes, clans (RM L8) | MISSING (only manual save export/import code in Settings) | MISSING (server recovery code only, `req-pretty/app.js` L2746) | P2 | Needs a backend (ChatGPT suggested Nakama). |
| L-09 | Dev clan joinable with code **Rosie777**; bot grants materials in any quantity (RM L8) | MISSING | MISSING | P2 | Until a backend exists: a clearly marked local dev panel behind ROSIE777, separate from normal progression — needs owner OK. |
| L-10 | Clan expeditions, live co-op (REC) | MISSING | MISSING | P2 | |

### 2.10 Story & tutorial

| ID | Request (source) | NEW status (evidence) | OLD? | Prio | Notes |
|---|---|---|---|---|---|
| T-01 | Start with a tutorial: the first hero guides you in a kawaii text box (C29) | MISSING (no tutorial; `seenIntro` stored but unused, `save.js` L92, L334) | DONE: Hikari's 3-wave "First Bloom Courtyard" (`oldgame/adventure-expansion.js` L13; `req-pretty/app.js` L643-661, L2193); replay in settings (L468) | P1 | Use the drawn Hikari art in the text box. |
| T-02 | After some stages teach bestiary, upgrades, etc.; "I want players to know every mechanic" (C39, C40) | MISSING | DONE 11 lessons + Captain's Journal (`req-pretty/feature-progress.js` L2-99) | P1 | |
| T-03 | Feature gates that match the lessons (HO L104-108) | PARTIAL (stage `requires` only) | DONE (`featureOpen`, L105) | P1 | |

### 2.11 Codes

| ID | Request (source) | NEW status (evidence) | OLD? | Prio | Notes |
|---|---|---|---|---|---|
| K-01 | `verity777` → 999,999 summon currency (C6), once per save (HO L65) | DONE (`src/data/missions.js` L89 `VERITY777` 999,999 gems, once; `src/systems/missions.js` L261-279, case/space-insensitive) | DONE (999,999 Starlight once) | P1 test | See G-03. |
| K-02 | `reset 67` → reset progress, back to main menu **and tutorial** (C30); keep device settings (HO L87-92) | PARTIAL: `RESET67` resets and goes to the lobby (`commissions.js` L294-303); there is no tutorial; `store.reset()` = `createProfile()` (`src/core/store.js` L108-110) also wipes graphics/audio settings | DONE (`oldgame/reset-code.js`; returns to Hikari's tutorial; keeps device settings) | P1 | Preserve `settings` on reset; route to the tutorial. |
| K-03 | `Rosie777` dev clan (RM L8) → L-09 | | | P2 | |

### 2.12 Audio

| ID | Request (source) | NEW status (evidence) | OLD? | Prio | Notes |
|---|---|---|---|---|---|
| AU-01 | Sound settings (C6) → U-20 (dead toggles) | | | P1 | |
| AU-02 | Brand-new music, orchestral to cute, revamp all tracks (RM L6) | MISSING: no audio at all | PARTIAL: synthesized WebAudio `GardenAudio` (`req-pretty/audio.js`, 133 lines) — the music the owner called weak | P1 port old synth + SFX as stopgap; P2 composed soundtrack | |
| AU-03 | One recurring melody in different arrangements (title, city, battle, boss, gacha, victory) (REC) | MISSING | MISSING | P2 | |

### 2.13 Platform, mobile, desktop, hosting

| ID | Request (source) | NEW status (evidence) | OLD? | Prio | Notes |
|---|---|---|---|---|---|
| PL-01 | Mobile; primarily horizontal (C17; CL 10-05 13:18) | DONE (rotate overlay, landscape layouts) | DONE | — | |
| PL-02 | Friends can play without signing in (C27) | DONE: public GitHub Pages (deploy succeeded 2026-10-07 07:34; https://tacosonmondays-pixel.github.io/sakura-game/) | old Site was private (needed sign-in) | — | Re-deploy after merge. |
| PL-03 | Smoother hosting/storage; iPhone app that updates itself (C28) | PARTIAL: manifest + iOS metas; no service worker (offline/update prompt); apple-touch-icon is an SVG data URI (`index.html` L20) that iOS ignores | DONE `pwa.js` (install, update activation L9-27) + `sw.js` + PNG icons 192/512 | P2 | |
| PL-04 | Save recovery / device transfer (CX@1326, CX@1338) | DONE locally: export/import code, 3 safety backups (`save.js` `BACKUP_KEY`) | DONE server recovery code | — | |
| PL-05 | Uploading/publishing must work (C26, C32, C34-C36) | DONE (Pages + artifact preview) | old Sites publishing broke | — | |
| PL-06 | Windows exe for local play (CL 10-06 21:39) | DONE (`desktop/build.mjs`, Node SEA; README L267-292) | Codex package exe | — | Rebuild after merge. |
| PL-07 | Package with full chat log, all links, all attachments, editable source (CL 10-06 22:12) | DONE (`scratchpad/kit/`, `SakuraSentinels_Project.7z`, `SakuraSentinels_Attachments.7z`) | Codex 368 MB package | P2 | Refresh after merge (now includes Oct 7 messages: `$M/owner_msgs_all.txt`, `$M/owner_queued.txt`). |
| PL-08 | Stay on the web, three.js; no Unity (O7 16:44-16:45) | DONE (decision) | — | — | |
| PL-09 | Phone performance (implicit; CX@1326) | unverified on a device | unverified | **P0** | Old GLBs ≈3× heavier; use merged-mesh + meshopt LOD (`$M/characters.md` §5.8: ~5 draw calls per chibi). |

### 2.14 Process

| ID | Request (source) | Status | Prio | Notes |
|---|---|---|---|---|
| X-01 | Merge the two games into a "super game", then clean from there (O7 17:01) | IN PROGRESS (this audit + `$M/characters.md`, `combat.md`, `integration.md`, world/city work) | **P0** | |
| X-02 | "Remember to look at my requests from codex and here" (O7 17:01) | this file | **P0** | Fold §2 into `docs/OWNER_REQUESTS.md` as the acceptance checklist. |
| X-03 | Two agents: one builds, one screenshots and compares until it's better; recommendations must fit the owner's view (O7 16:36, 17:14) | PARTIAL (builder/critic workflows for lobby-v3 and art-pilot) | **P0** | Every art batch through the critic before the owner sees it (OWNER_REQUESTS L286). |
| X-04 | Look up BA gameplay/screenshots and recreate the home menu; "you can generate stuff" (O7 16:34) | PARTIAL (BA refs in `docs/reference/thirdparty/`; Meshy nano-banana-pro image generation) | **P0** | |
| X-05 | Reference games: BA menus + chibis, Genshin gacha, BTD6 environments (O7 16:38) | recorded (`docs/OWNER_REQUESTS.md` L269-275) | **P0** | |
| X-06 | "Now also work on the game changes too" — not only art (O7 17:19) | ongoing (placement done, tracks-v3) | **P0** | Keep a gameplay track running beside art. |
| X-07 | Audit that every earlier request was really implemented (RM L8) | this file | **P0** | |
| X-08 | Install whatever plugins/tools you need (C12; RM L16; CL 10-05 09:24) | DONE (Blender bpy, Meshy, rembg venv) | — | |
| X-09 | Inspect the old site and the new share link; package offered (O7 16:47) | DONE (site mirrored to `scratchpad/oldgame`) | P1 | Ask only for the 4 package folders listed in §0. |
| X-10 | Don't recreate exactly — make it better (CL 10-05 08:58) | rule | **P0** | |
| X-11 | "Push everything that's been completed so far" (O7 18:21) | DONE for `claude/sakura-sentinels` (`ac57f8e` = origin); tracks-v3 branch, Meshy test files and chibi-v2 not pushed (WIP) | P0 | Push each piece as it lands. |
| X-12 | "Give me more update pls" (O7 18:13; also 17:43 "hows progress coming") | ongoing | process | Short progress posts with a screenshot. |

---

## 3. Declined, superseded and conflicting asks

| Ask | Source | Handling |
|---|---|---|
| "Create art in this like sexy style", "tasteful sexy like in blue archive", "sexy designs for a lot of the older characters", "at least do biki", "sexy bikini outfit / hero", "Japanese summer fan service" | CL 10-05 08:33, 08:41, 08:44, 09:09; C40 | DECLINED for academy girls and every chibi body. CL 09:10 offered adult heroes "normal beachwear"; CONTRACTS §0 L21-24 later forbids swimsuits for heroes too, and the merge rule bans swimwear on chibi bodies. Summer = yukata, sundresses, rash guards, sun hats, sailor/lifeguard jackets, floats, popsicles (CL 09:26). |
| Old beach content | `oldgame/assets/models/{marina,amane,marina-beach,amane-beach,nami-beach}.glb`, `assets/summer/*` | Do not ship; new non-swimwear outfits before Marina/Amane/event skins return. |
| Old art with fan-service framing | `assets/roster.webp`, `assets/hikari.webp` | `roster.webp` never for students; Hikari: crop or repaint. |
| Codex guest models (Suzuka/Aqua/Megumin) | CX@619; uploads | Not shipped (copyright); visual reference only. |
| "Copy the menu from Bloons TD6" | C1 | Superseded by Blue Archive for menus (O7 16:38); BTD6 kept for maps and the campaign picker. |
| Dino-hoodie video as chibi target | C43 | Superseded by the approved Meshy turnaround (O7 17:43). |
| 3D girl / SVG room home menu | V2/V3 lobby | Superseded by drawn memorial-lobby art (O7 17:06). |
| Red forbidden-zone overlay | V2 placement | Superseded by the small white/red circle (O7 17:21) — done. |
| V2 Blender girls as the roster | V2 | Superseded: old characters main, V2 = skins/future units (O7 17:01, 17:25). |
| Old enemies | Codex | Superseded by NEW's 74 GLB enemies (owner left it open; combat report recommends). |
| Unity / engine switch | O7 16:44-16:45; RM L14 | Not now. |
| Global chat / clans / transfer codes / Rosie777 bot | RM L8 | Need a backend; told to the owner CL 10-05 08:58. |
| Energy | C15 | NEW silently dropped it; OLD has it → ask the owner (D-d). |

**Decisions the lead must make (or ask the owner):**
D-a rarity table for shared ids (old vs new differ). D-b new names for future-release Rei/Nami/Luna/Kaede. D-c Marina
(23) as a tower vs "towers are students" (integration D4). D-d energy for Bounty yes/no (owner asked in C15).
D-e daily reset at 7 PM Central for everything. D-f run the summer event this season (old dates = now) or later.
D-g banners: port the 11 rotating banners or start with standard + 2 rotating. D-h battle chibis from Meshy (new
approved look, credit cost ×32) vs ported Codex GLBs restyled (`$M/characters.md` §5.5) as the first pass.
**Update 23:05:** the owner rated the Codex chibi 3/10 ("ugly") and Meshy 6/10 (N-05), so D-h leans to new
BA-style stubby chibis (chibi-v2 pipeline), with the Codex GLBs as a temporary stand-in only.

---

## 4. Old-game features the owner asked for that NEW lacks (port list)

| Feature | Old module(s) (formatted copies) | Owner source | Prio |
|---|---|---|---|
| 32-girl roster, GLBs, acting, weapons, illustrations | `data.js`, `expansion-roster.js`, `chibi*.js`, `expansion-weapons.js`, `assets/models/`, `assets/*.webp` | O7 17:01, C22-C25 | P0 |
| Per-unit skins (data + equip UI) | `summer-content.js` L69-91, `season-ui.js` L62 | O7 17:01 | P0 |
| City hub: districts, buildings + interiors, residents follow roster, decor presets, Play mode pick-up | `village.js`, `city-scene.js` (L6, L388), `progression.js` DECOR L308 | C6, C15, C16, C38, O7 17:07 | P1 |
| Hikari tutorial (First Bloom Courtyard) + 11 lessons + Captain's Journal + feature gates | `adventure-expansion.js` L13, `app.js` L643-661/L2193, `feature-progress.js` | C29, C39, C40 | P1 |
| Free welcome 10-pull after 3 clears | `gacha.js` L417 | C40 | P1 |
| 11 banners, tower/hero categories, 7 PM Central rotation | `gacha.js` L60-190, `live-ops.js` L38-79 | C7, C15 | P1 |
| 3D wish cinematic (portal, rarity-coloured meteor, chibi reveal) | `cinematics.js` | C6, O7 16:38 | P1 |
| Hero ult 3D cut-in + settings toggle | `cinematics.js` (mode `hero`), `app.js` L468 | C6 | P1 |
| Sandbox (999,999 coins, any girl/map/enemy) | `app.js` L519-596 | C7 | P1 |
| 6 battle modes with per-mode medals | `battle-modes.js` L3-51 | C13 | P1 |
| Map rules/gimmicks with ACTIVE/resting rhythm | `$M/combat.md` §3.5 | C6, C14 | P1 |
| Energy (120 cap, 6 min) + tiered resource ops | `live-ops.js` L4-36, L80-184 | C15 | P1 (confirm) |
| Bond Rank from copies | `progression.js` L4-5 | C6 | P1 |
| Title / splash screen | `app.js` L1724, `assets/academy.webp` | C16 | P1 |
| Synth music + SFX (stopgap) | `audio.js` | C6, RM L6 | P1 |
| Knowledge tree + permanent talents | `progression.js` L192-412 | C6 | P2 |
| Saved team presets | `growth.js` L343-384 | C7 | P2 |
| Random rotating shop | `growth.js` L515-563 | C7 | P2 |
| Gear crafting | `growth.js` L269 | C7/C18 | P2 |
| Summer event: 10 VN chapters, 5 ops, Leviathan, Shell Tickets shop, gifts/affection, login at 7 PM | `summer-content.js`, `summer-event.js`, `season-ui.js` | C40 | P2 (content redo) |
| PWA service worker + update prompt + PNG icons | `pwa.js`, `sw.js`, `assets/app-icon-*.png` | C28 | P2 |
| ENTRY/EXIT text labels | `route-markers.js` L15 | C37 | P2 |
| 3D map preview | `app.js` L2298-2308 | C7, C13 | P2 |
| Server reward verification (anti-cheat) | `source/server/battle-verification.js` (package only) | C29 | P2 |

---

## 5. Counts at a glance

| | OLD (Alpha 1.3.1) | NEW (HEAD d617b2e) |
|---|---|---|
| Characters | 32 = 25 towers + 7 heroes (+3 beach skins) | 19 = 16 towers + 3 heroes |
| Models | 35 Draco GLBs, ~30k verts, 27 joints, procedural acting, 1 shared face atlas | 19 GLB + 19 LOD, Blender clips, painted atlases |
| Illustrations | 6 singles, 7 pair portraits, summer set, `roster.webp`, `academy.webp` | none (SVG card art) |
| Enemies | 80 / 12 families | 74 / 12 families (54 normal, 13 elite, 4 miniboss, 3 boss) |
| Maps / stages | 37 maps (22 campaign, 5 resource, 3 boss, 1 tutorial, 6 event) | 49 maps; 59 stages (40 campaign, 15 Bounty, 3 Total Assault, 1 challenge) |
| Difficulties | Cozy / Standard / Challenge × 6 modes | Easy / Normal / Hard / Nightmare |
| Items | 32 | 60 (5 books, 35 materials, 5 crowns, 5 gear boxes, 3 dice, …) |
| Banners | 11, rotating 7 PM Central | 1 standard |
| Story | 10 VN chapters | none ("Story — coming soon") |
| City | Moonpetal City, 5 districts | none |
| Audio | WebAudio synth | none (toggles only) |
| Wiki / bestiary | yes / yes | 17 articles / yes |
| Codes | verity777, reset 67 | SAKURA2026, WELCOME, TACOTUESDAY, VERITY777, RESET67 |
| Backend | Cloudflare Worker + D1 (not in mirror) | none (static Pages) |

---

## 6. Not verifiable here / needs the owner's eyes

* Difficulty feel (owner only played Cozy in the old build; NEW numbers come from the auto-play bot).
* Real iPhone/Android frame rate for either build; Windows exe on real Windows.
* Whether the old 10 beach VN chapters are acceptable text-wise (they were written to an owner prompt asking for
  "fan service"; read before porting).
* Which Codex reference images belonged to which request (only in the 368 MB package, and even there "cannot be
  certified", HO L28-32).
* The Oct 7 Azur Lane / Bremerton / dynamic-background reference images the owner attached are described in
  `scratchpad/art-pilot/BIBLE.md` but were not found as files in the repo or kit.

## 7. Evidence I looked at (screenshots/images, all opened with Read)

`docs/art/approved/chibi-style-hikari-turnaround.webp` (approved look); `scratchpad/lobby-v3/wip-6-1280.png`
(current lobby: 3D secretary over SVG office); `$M/world-shots/old/o02-city.png` (old Moonpetal City);
`$M/world-shots/old/o17-wish-cine-b.png` (old 3D wish portal); update pass: `scratchpad/chibi-v2/shots/portrait3.png` (chibi-v2 Hikari expression sheet, ghost baked eyes visible). No new screenshots were needed for this audit; all
other status calls come from code, data dumps (`$M/req-dump-new.mjs`) and the sibling reports' screenshots.
