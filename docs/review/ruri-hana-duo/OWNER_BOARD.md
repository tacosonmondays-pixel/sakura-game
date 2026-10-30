# Ruri's rework and the Ruri & Hana duo: owner board

Oct 30, 2026. The full spec is `docs/specs/RURI_HANA_DUO.md`. This board was revised after the independent reviews r1 and r2 (`review-r1.md`, `review-r2.md`).
- Each question has a recommended default, and **"default all"** takes every one, **except the Anlas spend in Q13**, which needs its own yes.
- The build follows the defaults until you say otherwise.

**Who is who:**
- The girl with the fox is **Ruri** (her holo fox **Kon**). Luna is the other fox girl.
- The girl with the hawk is **Hana** (her falcon drone **Kaze**).

---

**Q1. Do both, Ruri's rework first?**
**Default: yes.**
- Ruri's rework ships first, free for everyone who owns her, as one co-op update after balance round 5.
- The duo comes next: her battle code first, held (not pullable, not named in the patch notes), then her art and her premiere together.
*Other options:* the rework only; or the duo only, with Ruri left as she is.

**Q2. Ruri's three new paths, all about Kon?**

| Path | What Kon does | Her ⚡ |
|---|---|---|
| **Bounding Fox** (was Moonhound) | a tile more reach (2.4 → 3.4 tiles from his spot). Kon is drawn leaping out to bite and trotting home; that part is a look, and her bites still count from his spot | **Moon Pounce** (stays; it reaches a tile further with this path) |
| **Fox Tricks** (was Star Falcon) | sets holo lure foxes on the road; the walkers that reach one turn round and trot back up the road | **Follow the Fox**: a row of lure foxes along her lane |
| **Paw Prints** (was Tide Otter) | her bolts leave glowing prints on an enemy; at the 5th, Kon leaps out of cover for a big hit (her boss path) | **Spirit Fox**: Kon grows big and her bolts hit harder |

**Default: yes.**
- Star Falcon and Tide Otter retire. Star Falcon copied Hana and was the weakest path in the game for her price.
- Kon changes colour by path: lapis blue, pale violet, soft gold.
- None of Ruri's paths touch flyers, grounding or birds, so she no longer overlaps Hana.
*Other option:* keep Tide Otter and replace only Star Falcon.

**Q3. Lured walkers really walk backwards?**
**Default: yes.** A Lured walker walks back at its own speed:

| Source | Lure time |
|---|---|
| Lure Fox (tier 3) | 1.5 s |
| Two-Tailed Trick (tier 4) | 2 s |
| Hundred-Fox Trick (tier 5) | 2.5 s |
| Follow the Fox (her ⚡) | 2.5 s, 3 s at tier 5 |

- **Who:** bosses and flyers (grounded ones too) are never lured; minibosses are lured half as long.
- **How often:** each walker is lured **at most twice a wave** (minibosses once), with at least 8 s between two lures (minibosses 12 s).
- **Not with the locked pushes:** from the moment it is lured until it has walked back to where it was lured, nothing that respects the push lock can move it: Fuu's gusts and Backdraft Fan, gather, Marumi's blasts and ability pushes. A walker that was just pushed by one of those cannot be lured. Ordinary knock-back from other girls' hits still works, as today.
- **The bound:** each lure costs a walker at most its lure time plus the time to walk that ground again, twice a wave at most. So Ruri can slow a walker but never hold it. A test checks this with Fuu and Ruri on runners that never die, against Fuu alone.
- Fast runners go back the furthest, which makes Ruri the answer to leaks. Fuu keeps her crowd push.
*Other option:* lure foxes only stop walkers for a moment.

**Q4. No build of Ruri's falls, measured against balance round 5?**
**Default: yes.** Each new build is at least as strong, on crowds and on bosses, as the round-5 build it replaces:
- Bounding Fox 5-0-2 ≥ Moonhound 5-0-2.
- Fox Tricks 2-5-0 ≥ Star Falcon 2-5-0. On our quick test bench Star Falcon is her best boss build, so Fox Tricks keeps that boss number.
- Paw Prints 2-0-5 ≥ Tide Otter 2-0-5. Tide Otter is her best crowd build today, so her new boss path keeps that crowd number too.

On top of that each path gets its new job: crowds, control, bosses.
- Level, stars, Potential, gear and bond are untouched.
- A saved battle with her on a retired path **above tier 2** gives back every coin spent on her. At tiers 1–2 she comes back on the new tiers.
- The patch note says where her old paths went.

*Other option:* "no job falls" only (her best crowd and best boss builds hold, but the 2-0-5 build would lose most of its crowd damage and the 2-5-0 build its boss damage). It is cheaper to tune.

**Q5. The new duo: "Ruri & Hana · Fox and Falcon", a new LR unit?**
**Default: yes.**
- It is a separate unit, so solo Ruri and solo Hana stay with all their progress. Nothing is merged or used up.
- In one sentence: *Kon runs the road and flushes walkers out of cover; Kaze stoops from the sky on whatever Kon startles, and every flyer Kaze knocks down lands in front of Kon.*
- Both girls stand on one base and take one slot. Kon dashes up the road from his spot biting walkers and leaves them **Startled**; Kaze dives on flyers and Startled enemies.
- Her paths are High Stoop (Kaze leads), Fox Run (Kon leads) and Flush and Stoop (both), and she climbs SSR → UR at ★5 → LR through Limit Break.

**Q6. Her ⚡ "Wind Chase" and her LR form "Paw and Feather"?**
**Default: yes.**
- **Wind Chase:** Kon sprints up the lane startling everything, and Kaze dives on each enemy he startled in turn (up to 10, 16 at tier 5).
- **Paw and Feather (LR):**
  - one more dive chain on every build;
  - Kon's runs 50% longer;
  - a damage boost on top of the usual LR boost;
  - a finishing **Great Stoop** on the strongest enemy on the map.
- Her crest is a paw print crossed by a feather. ("Daybreak" was the first name; the dawn belongs to Hikari.)

**Q7. LR power: 2.5–3× the best Kage tier 5, as a floor?**
**Default: yes. A floor, never a cap.**
- **Before LR:** at least 1.3× on her main job and at least 1.0× on the other.
- **In LR form:**
  - every build at least 2.5× on crowds and on bosses;
  - her best boss build at least 3×;
  - her best crowd build never the weakest of the LR units': at least 3.58× today, Tenka's best.
- Later balance passes may raise her, never lower her.

**Q8. Keep round 5's lift for the other two LR units?**
Balance round 5 (`feature/balance-r5` `d6f092b7`) has already added an LR boost (LR form only, never in Titan Trials). Against the best Kage tier 5, in LR form:

| LR unit, build | Crowds | Bosses |
|---|---|---|
| Kohaku & Tsubaki, each of her three builds | 2.58–5.63× | 2.79–3.01× |
| Tenka, Rail Arms | 3.58× | 2.75× |
| Tenka, Joint Research | 0.52× | 0.48× |
| Tenka, Singularity | 0.27× | 0.05× |

**Default: yes, keep it.** Nothing was cut.
- Tenka's Joint Research (economy) and Singularity (control) builds stay below the floor. Round 5 leaves them as its own question to you; it is not decided here.
- The new duo has to clear the floor with all three of her builds.
*Other option:* undo round 5's LR boost and use the floor for the new duo only.

**Q9. How players get her?**
**Default:**
- her own LR Banner, **"Fox and Falcon Premiere"**: 7 days at 0.7%, then the daily LR tab at 0.5%;
- the 300-pull Legend Promise; never sparked, never from a Select Ticket or Chosen Essence;
- SR rate-ups **Ruri, Chigusa and Marumi** (Ruri so pulls for the duo also help solo Ruri);
- she premieres only after her art is approved, and not before Tenka's premiere ends (Nov 5);
- price 850 and family feather, like the first duo's price.

**Q10. Her Limit Break?**
**Default:** the same as the other LR units.
- Level 60 with all 5 gates, ★5, and the usual fee in feather materials.
- Then her trial, **"The Field Survey"**: solo, with fast walkers and flyer swarms. Until its map exists, the stand-in is 8-5 on Nightmare.

**Q11. A thank-you for players who own both Ruri and Hana?**
**Default: yes.**
- Owning both unlocks a free bond scene, **"Kon Meets Kaze"**, and the profile title **"Fast Friends"**.
- It works for everyone who already owns both: the game checks on your first load after the update.
- You don't need the duo for it, and it gives no power.
*Other option:* none.

**Q12. May the duo share a team with solo Ruri or solo Hana?**
**Default: yes**, like every girl (copies are allowed). The duo's Kon wears Hana's olive club bandana, so you can tell the two Kons apart.
*Other option:* one version of each girl per team.

**Q13. The duo's picture?**
**Default:** made with the art v3 tool in the clean academy look (B), after art v3 ships, from Ruri's and Hana's own portraits.
- About 60 Anlas. **"Default all" does not say yes to this spend: we ask you separately before spending.**
- Both girls are in uniform, with Kon at Ruri's feet and Kaze on Hana's glove.
- The NovelAI key goes in as an environment secret, never into chat.
*Other option:* you draw it.

**Q14. 3D figures: Tripo or Meshy?**
**Default:** you make four models in Tripo (Ruri, Hana, Kon and Kaze), and we rig them, add their moves and fit them to the game.
- Solo Ruri and Hana get the new figures too.
- Until they are ready, the duo uses today's figures.
*Other option:* we make them with Meshy, which is already approved for spending (one test run first, every run's cost reported). The Meshy key also goes in as an environment secret, never into chat.

**Q15. Names OK?**
**Default: keep.**

| What | Names |
|---|---|
| Ruri's paths and ⚡ | Bounding Fox, Fox Tricks, Paw Prints, Lured, Trail's End, Follow the Fox, Spirit Fox (Moon Pounce stays) |
| The duo | Ruri & Hana · Fox and Falcon; Startled; High Stoop, Fox Run, Flush and Stoop; Wind Chase; Paw and Feather; Great Stoop; Trusty Pair |
| Banner and Limit Break | Fox and Falcon Premiere; The Field Survey |
| Gift for owners of both | Kon Meets Kaze; Fast Friends |

- Ruri's new names avoid the moon and foxfire, which belong to Luna, and the dawn, which belongs to Hikari.
- The first names "Field Trip" (kept for a future game mode), "Daybreak" (Hikari's dawn), "Kindred Companions" (Kindred Essence) and "Old Friends" (they only just met) were changed.
