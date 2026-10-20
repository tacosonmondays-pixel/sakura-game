# BACKLOG: core units, abilities, tactical UI and "what else"

Sakura Sentinels · core-units workflow · Oct 14 · engineering backlog

This file orders the work proposed in **UNIT_GAPS.md** (missing unit archetypes, the planned Codex girls, 11 new girls), **ABILITIES.md** (one cooldown ability per girl, Chika's flight modes in its §17) and **WHAT_ELSE.md** (missing systems, twice the stages, the tactical UI layer). It may later be copied into the public repo, so it uses our own names only.

**Effort:** **XS** under half a builder session · **S** one session · **M** 2–3 sessions · **L** a multi-builder workflow. Art is listed separately, because it costs generation credits and needs the owner's eye.

**Co-op rule.** Anything that changes `src/sim`, `src/data/units.js` or the co-op commands changes the co-op compatibility id, so both players must update. Such items ride a **co-op train** (a release that forces the update). UI-only and art-only items ship in any normal update.

---

## 0. Already in flight (not part of this backlog; listed so the order is clear)

The four-features landing plan (`docs/specs/LANDING_PLAN.md`) owns these. This backlog starts **after** them.

| Train | Contents | Co-op |
|---|---|---|
| **A** (normal updates, now) | battle save (#170), Potential M0, attack FX (#157), unit info (#160–161), patch notes (#171), story B2 (#118), social follow-ups (#145–149) | unchanged |
| **B** (co-op update #1) | co-op freeplay (#164); solo freeplay (#174) and sandbox (#175) from the cloud sessions follow it | `COOP_PROTOCOL` 3 |
| **C** (co-op update #2, the battle train) | hero rework (#168) → Chika rework (#166) → Potential M1–M3 (#165) → codex modes (#169) | 4 |

**One exception rides train C:** Chika's flight modes (CU-0 below). They are the owner's #1 request, the landing plan already reserves a flight-mode seam in Chika M0, and they change the same files. If they are not green when train C's window closes, they become the first item of train D, as the landing plan's cut-off rule says.

---

## 1. The backlog, in order

| ID | Milestone | Effort | Depends on | Lane | Train | Owner approval needed |
|---|---|---|---|---|---|---|
| **CU-0** | **Chika flight modes** F0–F3 (ABILITIES §17): Guard / Hold / Follow / Hunt / Patrol; `fly` + `flyB`; Hunt's map-wide pool; patrol phase; chips, pick modes, overlays; balance and performance re-run | M | Chika rework M0–M2 | Sim → UI | **C** (or first of D) | Already approved (OWNER_DECISIONS #1). Default to confirm: all five modes from placement (ABILITIES §16 Q7) |
| **CU-1** | **Ability system core** A0–A2: `src/data/abilities.js` (16 towers + 3 hero skills, Momo's single Market Day), sim core and the seven first kinds, auto-cast, owner-credited coins (`ownerCash`), co-op `abil` / `acast` with the girl-target rule, hash fold, engines scenario | L | Hero rework merged (train C) | Sim | **D** | Tier-3 unlock (default) vs tier 4 (ABILITIES §16 Q1); hero skill at Lv 7 (Q4); copies share a button (Q5) |
| **CU-2** | **Ability UI** A3: ability bar at both sizes, slot states, keys 1–9 and Shift+1–9, hold info card, panel block and ⚡ teaser, settings toggle, feed, audio, generic FX, wiki article, student-page ⚡ block, hero skill button | M | CU-1; hero-rework M3 for the skill button | UI | **D** | PC key layout (Q2); auto-cast default Off (Q3); screenshots at 844×390 and 1280×720 |
| **CU-3** | **Roster B3 finish**: tests (#138), renderer and UI hooks (#139), verify (#140); rebase onto train C; co-op **`aim`** command (GAPS P-2); Ena's curse-burst budget | M | Train C merged | Sim (roster) | **D** | — |
| **CU-4** | **Builder 4: the planned 11** (GAPS §4): `unitsExpansion.js`, `unitKit.js`, base kits with the GAPS §4.1 upgrades that need only B3, Hana's path renames, every girl's ⚡ ability data (ABILITIES §5.2), the look guard test (no fantasy outfits for new girls), wiki and tips | L | CU-3; CU-1 for ability data | Roster | **E** | **Art credits:** 11 portraits + 11 chibi models in school uniforms (GAPS §4.2); the originality check (GAPS §4.3); keep or rename Noa, Iroha, Kanna, Tsubaki (GAPS §9 Q7) |
| **CU-5** | **Shared primitives, batch 1** (GAPS §7): P-3 road objects with budgets, P-7 straight shots (`spawnStraight`), P-9 seven rule keys + banners, P-14 kill and near-exit hooks, P-17 shared stretches, the §7.2 caps with oldest-first eviction, and the §7.3 wave-end rules with battle-save keys | M | CU-1 | Sim | **E** | — |
| **CU-6** | **Deploy kind** A4: Suzu's extra traps, Kage's doubles, Chika's Drone Surge (with the "Surge" rows in her Drones tab) | S | CU-1; Chika rework | Sim | **E** | — |
| **CU-7** | **Wave 1 new girls**: **Azami** (spikes, M), **Yuzuha** (sentries, M), **Kinu** (ring, S–M); **Ouka** (rules hub + banners, M) as the fourth if capacity allows. Each: data, sim, panel chips and counters, FX, tips, wiki, balance pass | M each | CU-5, CU-6 | Sim + UI | **E** | **Which three first** (default Azami, Yuzuha, Kinu); **free stage slots** (Azami after 2-2, Yuzuha after 4-2); **art credits** per girl; balance table |
| **CU-8** | **Momo**: Coin Toss T3 per-kill coins (`killBounty`); Market Day already ships in CU-1 | S | CU-5 | Sim | **E** | Market Day vs Flash Sale (ABILITIES §16 Q6, default Market Day); any change to Momo's income is an economy change |
| **CU-9** | **Move and zone kinds** A5 + `hold` and `hex` statuses: Fuu's Backdraft Fan, Ruri's Moon Pounce and Star Snatch, Yoriko's Puppet Hex; P-4 zones; P-10 hold | M | CU-3, CU-4 | Sim | **E** | — |
| **CU-10** | **Aimed casts, runners, mirror** A6: the `qx, qy` aim path and UI aim mode; the runner kind with segments, carry and shared stretches; mirror redirect; **Seiran's sky-dragon ult** (ranks 1–3 written into her hero track); Iroha's Mirror Shift; Ruri's River Rush | M–L | CU-9, CU-5 (P-17) | Sim + UI | **F** | Seiran's dragon start point (default: aim point if set, else exit; GAPS §9 Q3) |
| **CU-11** | **Codex five, full picture** (GAPS §4.1): Ruri's roaming pet with hound / falcon / otter moves, Iroha's two firing origins and Infinite Reflection, Hana's circling flier, Yoriko's hexing Dream Detour | M–L | CU-4, CU-9, CU-10, Chika rework (roaming bodies) | Sim + FX | **F** | Ruri as the beast tamer (default yes, GAPS §9 Q2) |
| **CU-12** | **Wave 2 new girls**: **Marumi** (rolling bombs, M), **Chigusa** (vines and harvest, M), **Wakaba** (buff thrower, M); path changes for **Yuki** and **Midori** zones, **Akane** blast and bomblets, **Suzu** aim and expiry, **Shiro** execute | M each | CU-9, CU-10 | Sim + UI | **F** | Free slot for Wakaba (after 6-5); art credits; balance tables (lives restore and coins are economy changes) |
| **CU-13** | **Wave 3 new girls**: **Sorano** (firebird, L), **Tenka** (late carry + offering, L), **Norika** (barricades, L); P-11 blockers, P-13 offering; the freeplay-density benchmark (GAPS §7.2) | L each | CU-10, CU-11 | Sim | **G** | "Late-game powerhouse vs money unit" reading (GAPS §9 Q1); Norika vs Tomoe for barricades (Q5); art credits |
| **CU-14** | **Ability balance pass** A7 (ABILITIES §11) and the new girls' tables | M | CU-1…CU-13 as they land; the owner's progression model (D14/D15) | Balance | each train | **Sign-off on the tables** |
| **CU-15** | **Wave 4 (optional)**: **Kogane** (mech, reusing the hero rework's move), future-slot kits (Tomoe, Hiiro, Mizuha, Sayo) | L | CU-13; hero rework's `moveHero` | Sim | later | Whether to build them at all (P3) |

## 2. Parallel lanes (no sim files)

These touch only UI, CSS, data outside the co-op graph, or art, so they can run beside the trains and ship in normal updates.

| ID | Item | Effort | Depends on | Owner approval needed |
|---|---|---|---|---|
| **UI-1** | **Tactical UI** T0: `tactical.css` + preview page, nothing in the game imports it | S | — | **Approve the look from images** (844×390 and 1280×720 mock-ups in `core-units/shots/`) |
| **UI-2** | Tactical T1: battle HUD top bar behind **Settings → HUD style: Classic / Tactical** | S | UI-1 | Approve before/after shots |
| **UI-3** | Tactical T2: selected-girl panel + tower bar (+ ability bar once CU-2 lands) | M | UI-2; unit info merged | Approve shots |
| **UI-4** | Tactical T3–T5: wave and boss banners, ult cut-in, unit sheet and tree (light), results report, intel, co-op room | M | UI-3 | Approve each screen; T6 flips the default after one version |
| **WE-1** | **Threat card on tap** + enemies-left counter + armor tint, with the one tap order (card → girl → drone → enemy → open ground) | S | — (drone taps after Chika rework) | — |
| **WE-2** | **Co-op pings and quick emotes** (room messages outside lockstep) | S | — | — |
| **WE-3** | **Formation presets** | S | — | — |
| **WE-4** | **Stage objectives (3 stars) + results rank** | S–M | — | **Chapter chest rewards** (gems are an economy change) |
| **WE-5** | **PC hotkeys**: Z / X / C upgrade, hold Delete to sell; other XS wins (route labels, traits sheet, HUD margin slider) | XS each | CU-2 for the key move | — |
| **WE-6** | **Range rings by archetype** + pile / sentry / drone counters | S | CU-5 for piles | — |
| **WE-7** | **Student trials** (first five: Ena, Iroha, Ruri, Seiran, Yoriko) | S–M | CU-4 (and CU-7 for new girls) | First-clear rewards (30 gems + 1 rare book each) |
| **WE-8** | **Live damage meter + per-wave leak log** | S | UI-3 helps | — |
| **WE-9** | **Daily challenge** | M | codex modes, energy and 7 PM reset (#134), WE-7 rentals | **About 30 gems a day** (≈ 7 recruits a month) |
| **WE-10** | **Tactical Supplies** (earned-only battle items) | M | CU-1 effect kinds; a lockstep `sup` command (co-op train) | Earned only, never sold (default) |
| **ART-1** | **School forms for the existing 19** (#173) | L (art) | after CU-4 and CU-7; owner: "later" | **Art credits**; look approvals |
| **NAME-1** | Rename live names borrowed from another game (WHAT_ELSE §1.6) | XS | — | **The owner's call**, before anything goes to the public repo |

## 3. Twice the stages (WHAT_ELSE §2)

| ID | Item | Effort | Depends on | Owner approval needed |
|---|---|---|---|---|
| **ST-1** | Infrastructure: act fields, Act II builder, gate switch, "next stage" pointer, two-row campaign screen, achievements, tests; **chapter 1 Act II** (1-6 … 1-10) | M + M | Energy + 7 PM reset (#134), codex modes (#169), the progression model (D14/D15) | Parallel Act II (default) vs main road; half medal gems (default); 2 new + 2 variant + 1 remix maps per chapter (default) |
| **ST-2…ST-8** | One chapter per release: 2 new maps, 2 route variants, 1 remix, 5 stage defs, map rules, an encore boss, 2 story episodes | M each | ST-1 | **Art** for 16 new maps and 8 encore bosses (built on existing models); each release changes the co-op data hash, so it rides a co-op train |

## 4. Trains after C (proposal)

| Train | Co-op | Contents |
|---|---|---|
| **D** | update #3 | CU-3 roster B3 + `aim`; CU-1 + CU-2 ability system; CU-0 if it slipped from C |
| **E** | update #4 | CU-4 Builder 4 (the planned 11 in school uniforms); CU-5 primitives; CU-6 deploy; **CU-7 wave 1 girls**; CU-8 Momo; CU-9 move and zone |
| **F** | update #5 | CU-10 aimed casts and runners (**Seiran's dragon**); CU-11 Codex five full picture; **CU-12 wave 2 girls** |
| **G** | update #6 | **CU-13 wave 3 girls**; CU-14 balance pass for everything so far |
| later | as needed | CU-15 (optional), ST-2…ST-8 (one chapter per train), ART-1 school forms for the 19 |

Normal updates between trains carry UI-1…UI-4, WE-1…WE-8, NAME-1 and art drops.

## 5. Approvals at a glance

| What | When it is needed | Default if the owner says nothing |
|---|---|---|
| Art credits for portraits and chibi models (11 planned + 11 new + 19 school forms) | before CU-4, CU-7, CU-12, CU-13, ART-1 | Spend per wave, three girls at a time |
| Free stage slots for core girls (2-2, 4-2, 6-5) | CU-7, CU-12 | Yes |
| Any gem, chest or daily reward | WE-4, WE-7, WE-9, ST-1 | Conservative values in the specs; nothing ships without a yes |
| Balance tables | CU-14, each girl | Ship nothing that turns an Easy win into a loss |
| The tactical look | UI-1 | Behind a toggle, Classic by default |
| Renaming borrowed names | NAME-1 | Keep in game for now; decide before any public-repo copy |

## 6. Risks to the order

| Risk | Mitigation |
|---|---|
| Train C slips and pushes everything | CU-1 and CU-3 can be built on branches off train C; only their merge waits. UI and art lanes never wait |
| Roster B3 is far behind live (95 commits) | CU-3 rebases once, after train C; every spec already asks B3 to rebase onto them |
| Too many co-op updates annoy players | Bundle; one forced update per train, and never two trains in the same week |
| Performance with many copies of new girls | GAPS §7.2 per-player and per-sim caps, plus the freeplay-density benchmark before CU-13 merges |
| Art throughput | Three girls per wave; look sheets approved before generation |
