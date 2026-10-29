# Balance notes

## Balance round 5 (2026-10-29, `feature/balance-r5`; ships after Nov 1, 7 PM Central with its own COOP_PROTOCOL bump)

The owner's direction (Oct 27–28): "no cap, everyone close to Kage". Every fully maxed striker's honest DPS (the battle
drawer's live number since v0.1.59) in a 1M–2.5M band, Kage in the middle; supports judged by their boost to allies;
nobody nerfed. Built on v0.1.60 (`main` 4b4388b8: banners, Tryout Day and Extended Day, UR Resonance, honest DPS, Tenka's LR
form, Gate Arc Acts 3–6, and the owner's duo buff with the edge beam), with the attack shapes S1–S4 merged in first
(5124dacf: #41 → #45 → #46 → #49, the coordinator's order; they ship together). Kept from rounds 1–4: the per-girl rows (`src/data/balance.js`, re-sized here),
the heroes' level curve, the titan rule, Fuu's wind and Chigusa's lives. Dropped: Options A/B, the kit-fair panel (the
honest readout shipped instead), the chapter HP pass.

**Ship gate.** Merge only after the Halloween event closes (Nov 1, 7 PM Central): the Gourdlight Golem gates
(`tests/integration/event-balance.test.js` EB-1–EB-3) read the girls without the round (`powerOff`) because players fight
the Golem on today's numbers until then; with the round a mid free team wins its Hard and a level-60 P1 team its
Nightmare. After the event, the `powerOff` wrappers there can go.

**The three findings on round 4, fixed.** (1) Every number below is the honest readout's own measure: damage the sim
credits her per second (`damageDealt`, `src/ui/battle/dpsView.js`), not a panel formula. (2) Power never drops
(`src/data/powerKit.js`, `tests/systems/powerKit.test.js`). (3) No chapter HP pass: on every finale, no win becomes a loss
for the free roster or a common gacha team on Normal, Hard or Nightmare.

**Bench** (`tools/balance/r5Bench.mjs`, three seeds): each girl fully maxed (L85, ★5, 10 gates, P6, three UR +12 Taiko
pieces at average rolls, UR Resonance on, the duo at LR) on 4-5's best-covered spot with Umeko 2-5-0 and Midori 5-0-2
beside her, her best tier-5 build (tier-2 crosspath). Boss = the Ashwing Matriarch held in her reach (or walking
through, for trap and strip kits; the better of the two); late crowd = an Orc Grunt every 0.5 s. Targets never die
(healed each step), so the number is her rate. Kage reads 1.97M on a boss and 1.82M on a crowd before the round (the
owner's "about 1.7M" frame). Her **ruler** is her job: a boss for single-target girls, the late crowd for splash girls.

| Girl | job | boss before → after | late crowd before → after | her ruler after | band 1M–2.5M |
|---|---|---:|---:|---:|---|
| Shiro | boss | 2.99M → 3.24M | 1.88M → 2.03M | 3.24M | above (no cap) |
| Kage | boss | 1.97M → 2.22M | 1.82M → 1.83M | 2.22M | in |
| Kaede | boss | 1.02M → 1.92M | 656k → 1.22M | 1.92M | in |
| Hana | boss | 322k → 1.91M | 231k → 1.37M | 1.91M | in |
| Chigusa | boss | 434k → 1.91M | 616k → 2.74M | 1.91M | in |
| Aoi | boss | 621k → 1.89M | 570k → 1.74M | 1.89M | in |
| Ena | boss | 296k → 1.88M | 291k → 1.86M | 1.88M | in |
| Yuzuha | boss | 473k → 1.85M | 449k → 1.78M | 1.85M | in |
| Tenka | boss | 1.67M → 1.80M | 6.05M → 6.55M | 1.80M | in |
| Akane | crowd | 288k → 1.07M | 15.94M → 16.47M | 16.47M | above (no cap) |
| Kohaku & Tsubaki | crowd | 3.70M → 3.94M | 7.99M → 8.71M | 8.71M | above (no cap) |
| Hotaru | crowd | 399k → 1.09M | 7.79M → 8.58M | 8.58M | above (no cap) |
| Sango | crowd | 325k → 1.11M | 7.38M → 7.87M | 7.87M | above (no cap) |
| Iroha | crowd | 255k → 1.08M | 5.45M → 5.88M | 5.88M | above (no cap) |
| Fuu | crowd | 97k → 263k | 1.80M → 4.04M | 4.04M | above (no cap) |
| Marumi | crowd | 170k → 1.02M | 3.22M → 3.48M | 3.48M | above (no cap) |
| Yuki | crowd | 94k → 153k | 1.92M → 3.22M | 3.22M | above (no cap) |
| Ruri | crowd | 104k → 1.02M | 2.69M → 3.16M | 3.16M | above (no cap) |
| Kinu | crowd | 123k → 1.01M | 1.11M → 2.29M | 2.29M | in |
| Raika | crowd | 174k → 1.01M | 1.67M → 2.20M | 2.20M | in |
| Azami | crowd | 714 → 2k | 716k → 1.91M | 1.91M | in |
| Suzu | crowd | 8k → 13k | 976k → 1.87M | 1.87M | in |
| Rei | crowd | 366k → 1.08M | 1.67M → 1.82M | 1.82M | in |
| Chika | support | 1.72M → 1.87M | 625k → 682k | – | judged by boost |
| Momo | support | 457k → 502k | 644k → 697k | – | judged by boost |
| Miko | support | 22k → 25k | 352k → 385k | – | judged by boost |
| Midori | support | 20k → 21k | 1.07M → 1.08M | – | judged by boost |
| Noa | support | 3k → 3k | 54k → 59k | – | judged by boost |
| Umeko | support | 2k → 2k | 37k → 40k | – | judged by boost |
| Wakaba | support | 57 → 60 | 29 → 30 | – | judged by boost |
| Ouka | support | 0 → 0 | 0 → 0 | – | judged by boost |

- Single-target strikers rise to 86–90% of Kage on a boss (`dmg` rows ×1.72–×5.9). Splash girls already above the band
  on a crowd keep it (no cap) and get a boss-only factor (`boss`, bosses and minibosses) to about 1M on a boss, half of
  Kage's: Marumi ×5.6 and Ruri ×9 are the largest because their kits barely touch a boss.
- **The duo (Kohaku & Tsubaki) only has a ×1.01 floor** (the supports' raised auras shift her shell timing and cost her
  best crowd build 0.3%). The owner's Oct 29 buff (v0.1.60) makes her an intended outlier above
  Kage (the coordinator: exempt from the band, never tuned down); every build of hers is at or above v0.1.60.
- Suzu's traps and Azami's strips sit in the band on a crowd but stay near 0 on a boss: their kits do not touch bosses
  (a kit question for the owner, not a number).
- Kage, Shiro and Tenka have no damage row; the supports' +5% lifts every girl beside them about 9%.
- **No build falls, not only the best one** (every girl, all three tier-5 builds, boss and crowd, 3 seeds; Fuu, Yuki and
  the duo also alone and with supports over 5–7 seeds). Rows that exist only for that: Fuu ×2.45 (her stronger wind
  pushes walkers out of her reach: at ×1.3 her Returning Gale build alone lost 46%, so her best build now reads ~4M on
  a crowd), Yuki ×1.5 (her 20% longer freezes, and the shapes' Rising Spikes left her
  Frostbite build alone 28% under), Hotaru ×1.03, Momo ×1.03 (her coins do not move) and Umeko ×1.07 (the shapes left
  each of them 1–5% under on one build alone). Every girl was checked alone and with supports against live v0.1.60.

**Supports** (Kage 5-0-2 on a held boss beside one support at her best build, ÷ Kage alone):

| Support | best build | Kage beside her ÷ alone, before → after |
|---|---|---:|
| Umeko | p1t5 | ×3.78 → ×3.97 |
| Midori | p0t5 | ×2.48 → ×2.57 |
| Miko | p0t5 | ×3.28 → ×3.42 |
| Noa | p1t5 | ×2.25 → ×2.32 |
| Wakaba | p0t5 | ×1.88 → ×1.93 |
| Ouka | p1t5 | ×1.25 → ×1.26 |
| Chika | p1t5 | ×2.57 → ×2.67 |
| Momo | p0t5 | ×1.00 → ×1.00 |

**Power** (fully maxed profile; `unitPower`): a raised girl's Power rises until her Power ÷ Kage's matches her measured
DPS ÷ Kage's (√ of the boss and crowd ratios); a girl already at or above that keeps hers. None drops on any account.

| Girl | Power before | Power after |
|---|---:|---:|
| Hikari | 7,547 | 7,547 |
| Luna | 12,330 | 12,330 |
| Nami | 8,262 | 8,262 |
| Aoi | 5,569 | 11,896 ▲ |
| Rei | 3,256 | 8,368 ▲ |
| Yuki | 3,256 | 3,604 ▲ |
| Momo | 1,960 | 1,960 |
| Akane | 7,973 | 27,766 ▲ |
| Sango | 13,758 | 20,638 ▲ |
| Kage | 14,636 | 14,636 |
| Umeko | 1,221 | 1,221 |
| Shiro | 20,349 | 20,349 |
| Midori | 3,126 | 3,126 |
| Suzu | 5,564 | 5,564 |
| Raika | 13,587 | 13,587 |
| Miko | 2,036 | 2,036 |
| Hotaru | 7,725 | 20,166 ▲ |
| Kaede | 17,852 | 17,852 |
| Chika | 3,220 | 3,220 |
| Tenka | 48,625 | 48,625 |
| Kanna | 8,486 | 8,486 |
| Yoriko | 13,981 | 13,981 |
| Seiran | 14,055 | 14,055 |
| Fuu | 4,039 | 6,683 ▲ |
| Hana | 4,625 | 10,323 ▲ |
| Ruri | 6,146 | 11,948 ▲ |
| Noa | 1,133 | 1,133 |
| Iroha | 7,227 | 16,775 ▲ |
| Ena | 17,057 | 17,057 |
| Azami | 1,736 | 1,736 |
| Kinu | 8,693 | 10,594 ▲ |
| Wakaba | 1,180 | 1,180 |
| Yuzuha | 4,448 | 11,428 ▲ |
| Ouka | 1,197 | 1,197 |
| Chigusa | 8,018 | 15,405 ▲ |
| Marumi | 24,486 | 24,486 |
| Kohaku & Tsubaki | 44,720 | 44,720 |
| Kogane | 8,519 | 8,519 |
| Norika | 4,421 | 4,421 |

**Heroes.** One multiplier per level 1–25 (round 4's curves) floored at ×1: Hikari and Kanna were ×0.94 / ×0.91 at
Lv 25, a nerf of the top. Every paid level raises her hit by more than 1% and her boss DPS at four account profiles
(`tests/sim/heroPower.test.js`). The held heroes Kogane and Norika keep their data.

**Titans.** No row and no hero curve in a titan battle (`TITAN_POWER` false). `tools/balance/r5Titans.mjs` (a maxed team
without Fuu or Chigusa on every titan, 240 s): damage and sim hash identical before and after (foundry 146,002, regent
609,851, daimyo 909,332, wyrm 653,485). Fuu's wind and Chigusa's lives are kit rules in every battle, titans too: the
independent review measured a team with both at regent 609,825 → 609,971 (+0.02%), the other titans identical. The
titans screen says titan battles use every girl's damage without the boost.

**Finales** (`tools/balance/r5Finales.mjs`, the autoPlan bot; common team = the free roster with Akane, Raika, Miko and
Kinu in; mid = the census level, late = Lv 60 ★3 with two Epic +6 pieces, max = fully maxed; wins of 2 seeds). Normal,
Hard and Nightmare × free and common × three accounts × the 14 finales (Gate Arc Acts 3–6 included), with the shapes: **0 wins
become losses, 42 losses become wins.**

| Finale | Nightmare, common team: mid · late · max (2 seeds) before → after | Hard, common team | Nightmare, free roster |
|---|---|---|---|
| 1-5 | 0→0 · 0→2 · 2→2 | 2→2 · 2→2 · 2→2 | 0→0 · 0→0 · 2→2 |
| 1-10 | 0→0 · 0→2 · 2→2 | 2→2 · 2→2 · 2→2 | 0→0 · 0→2 · 2→2 |
| 2-5 | 0→0 · 1→2 · 2→2 | 2→2 · 2→2 · 2→2 | 0→0 · 2→2 · 2→2 |
| 2-10 | 0→2 · 2→2 · 2→2 | 2→2 · 2→2 · 2→2 | 0→2 · 2→2 · 2→2 |
| 3-5 | 0→0 · 0→0 · 2→2 | 0→0 · 2→2 · 2→2 | 0→0 · 0→0 · 2→2 |
| 3-10 | 0→0 · 0→2 · 2→2 | 0→0 · 2→2 · 2→2 | 0→0 · 0→0 · 2→2 |
| 4-5 | 0→0 · 0→0 · 2→2 | 0→2 · 2→2 · 2→2 | 0→0 · 0→2 · 2→2 |
| 4-10 | 0→0 · 0→0 · 2→2 | 0→0 · 2→2 · 2→2 | 0→0 · 0→0 · 2→2 |
| 5-5 | 0→0 · 0→2 · 2→2 | 2→2 · 2→2 · 2→2 | 0→0 · 2→2 · 2→2 |
| 5-10 | 0→0 · 0→0 · 2→2 | 0→0 · 2→2 · 2→2 | 0→0 · 0→0 · 2→2 |
| 6-5 | 0→0 · 0→2 · 2→2 | 2→2 · 2→2 · 2→2 | 0→0 · 2→2 · 2→2 |
| 6-10 | 0→0 · 0→0 · 2→2 | 0→0 · 2→2 · 2→2 | 0→0 · 0→0 · 2→2 |
| 7-5 | 0→0 · 0→0 · 2→2 | 0→0 · 0→2 · 2→2 | 0→0 · 0→2 · 2→2 |
| 8-5 | 0→0 · 0→0 · 2→2 | 0→0 · 0→0 · 2→2 | 0→0 · 0→2 · 2→2 |

**Tryout Day** (`tools/tryoutBot.mjs --sweep`, 20 runs each, solo Half Day; re-run on v0.1.60, the same rates): the rows apply in Tryout, so it gets easier
(the coordinator's call, Oct 29: no Grade retune this round; easier low and mid Grades are fine and Grade 12 maxed at
30% is still a real top. For the Tryout session: these are the rates with the round and the shapes).

| Grade | new | mid | maxed |
|---|---|---|---|
| 1 | 55% → 95% | 100% → 100% | 100% → 100% |
| 6 | 15% → 15% | 55% → 80% | 65% → 85% |
| 12 | 0% → 0% | 5% → 20% | 15% → 35% |

The ceiling gate (`tools/bench.mjs --hit --ceiling --maxed geared`): round 5 alone leaves it unchanged (max ×1.119, the
same three rows over ×1 as v0.1.60). **With the shapes Kage fails it: ×1.185, and ×1.584 with her talent**, identical on
the shapes branch without round 5 (5124dacf) and ×0.75 / ×0.99 on v0.1.60: S1's Blade Cyclone, not a round-5 row (Kage
has none). Flagged to the coordinator and the shapes session.

**Sim id** `2b2c558fde94` (the shapes and round 5 together; base `d35092f141d3`, COOP 12), pinned as one PENDING_BUMP {12: …} in `tests/art/itemArtRuntime.test.js`; COOP_PROTOCOL is
not bumped here (the coordinator assigns it at ship). Goldens re-pinned with no win becoming a loss; mechanics
scenarios (save/restore, co-op casts) run power-neutral (`powerOff`, or the row divided back out in co-op).

**Review.** An independent adversarial review (FIX-THEN-SHIP, no blocker) found Fuu's two lower builds, the titan claim,
the Golem ship gate and four nits (the footnote naming only damage and boss rows, Chigusa judged on the wrong ruler, the
wiki's Fuu line, the duo's beam and boss row); all fixed above. Not fixed: Umeko's tier text keeps her own words (+15%)
while her running total includes the +5% buff, as battle does.

**Second review** (after merging v0.1.60 and the attack shapes; FIX-THEN-SHIP, no blocker): the merge had taken
Fuu's Typhoon Fans push back to 0.2 under round 5's "+0.25" text (fixed: 0.25); Umeko's Searchlight build alone read 1%
under on a held boss (×1.05 → ×1.07); the duo's best crowd build read 0.3% under with supports (×1.01). Checked and
held: the rows reach every new shape exactly once; Fuu's wind applies to her fans; Chigusa's lives rule survives the
new vines; Momo's coins and Umeko's aura do not move; no test weakened.

## Marumi rework (2026-10-21, `feature/marumi-rework`)

Owner request (Oct 21): a bowling-ball ricochet that bounces from walker to walker. Player feedback: her
best path showed about 1k DPS on the panel where regular girls show 4-5k, and she could not touch flyers
without Lob. Measured the way players see it: the battle panel's **DPS** cell (`Sim.towerStats().dps`,
damage × attacks a second × blasts) with `tools/bench.mjs` (strong preset: L60, 3 awakenings, gear ×1.45,
25% crit; stage 4-5, seed 9, best-covered spot, an un-upgraded Aoi beside her), next to the bench's real
damage on the crowd stream (Orc Grunts that never fall) and the walking boss. Builds pNtM: path N to tier
M with a tier-2 crosspath (Heavy x-0-2, Lane 2-x-0, Spin 2-0-x). Azami's and Yuzuha's panels show only
their own shot (their strips and sentries do the work), so read their real columns.

| Girl / path | coins 3/2 · 4/2 · 5/2 | panel DPS 3/2 · 4/2 · 5/2 | crowd DPS | boss DPS |
|---|---|---|---|---|
| marumi (before) p1 | 2440 · 5840 · 25040 | 32 · 107 · 405 | 4.6k · 16k · 93k | 8 · 28 · 135 |
| marumi (before) p2 | 2370 · 5570 · 23970 | 39 · 98 · 218 | 0 · 0 · 0 | 0 · 0 · 0 |
| marumi (before) p3 | 2290 · 5090 · 21090 | 32 · 32 · 181 | 2.7k · 2.7k · 15k | 14 · 14 · 255 |
| marumi (after) p1 | 2440 · 5840 · 25040 | 398 · 875 · 4.9k | 55k · 129k · 260k | 53 · 118 · 809 |
| marumi (after) p2 | 2370 · 5570 · 23970 | 388 · 990 · 5.0k | 4.3k · 12k · 70k | 38 · 108 · 603 |
| marumi (after) p3 | 2290 · 5090 · 21090 | 477 · 955 · 4.4k | 24k · 47k · 241k | 29 · 39 · 99 |
| kinu p1 | 2070 · 5070 · 22670 | 403 · 2.2k · 5.8k | 1.1k · 5.9k · 30k | 11 · 67 · 349 |
| kinu p2 | 1940 · 4340 · 19540 | 247 · 516 · 1.2k | 217 · 580 · 1.8k | 8 · 19 · 43 |
| kinu p3 | 2020 · 4820 · 20820 | 233 · 233 · 686 | 78 · 683 · 1.4k | 8 · 16 · 37 |
| azami p1 | 1900 · 4500 · 19500 | 6 · 6 · 6 | 175 · 723 · 7.9k | 9 · 10 · 38 |
| azami p2 | 1790 · 4190 · 18690 | 7 · 7 · 7 | 103 · 112 · 130 | 3 · 3 · 4 |
| azami p3 | 1950 · 4750 · 20750 | 6 · 6 · 6 | 88 · 88 · 239 | 4 · 4 · 4 |
| yuzuha p1 | 2350 · 5750 · 24950 | 20 · 20 · 20 | 279 · 1.4k · 6.4k | 235 · 668 · 4.7k |
| yuzuha p2 | 2250 · 5250 · 22850 | 20 · 20 · 20 | 298 · 730 · 2.2k | 157 · 396 · 1.2k |
| yuzuha p3 | 2150 · 4950 · 20950 | 20 · 20 · 20 | 280 · 280 · 280 | 173 · 173 · 173 |

- Her panel now counts every blast of a ball (the first, one per bounce, the Glow Bowl finale × 3) and
  her pins, like a volley's projectiles. Best path at 5/2: Heavy 4.9k, Lane 5.0k, Spin 4.4k (Kinu's best
  5.8k at 22,670 coins). Damage is back-loaded (base 20 at 0.8/s; T5s +500 / +200 / +60) so tier 3/2
  sits at Kinu's 3/2 (~400).
- Real crowd at 5/2 is in the blast band (Akane 324k, Sango 235k on the same bench); the walker a ball
  meets takes the whole blast and the others in it half (`ball.share` 0.5), which keeps the crowd pile
  from running away. Heavy 3/2 and 4/2 (55k / 129k) sit above Akane's (6k / 24k) on this pile bench:
  the Spin 2 crosspath's bounce and her push keep the immortal crowd bunched in her blast.
- Lane Master read **0** before: on 4-5 her nearest road point lies on a shared stretch of two paths and
  a walker on the other path never counted as "on her lane" without Hook Spin. Her own lane is now every
  path whose nearest point is hers (`sameSpot`), and she rolls on the walker's path.
- Anti-air: the lob is her base kit (every path): when only flyers are in her range she lobs half her
  blast at the lead one (`ball.lobMul` 0.5). Lob panel at 5/2: Heavy ~1.2k, Lane ~1.2k, Spin ~0.2k.
- Bot goldens (the free team plus her, seed 1): 5-4 Hard 37 → 38 lives, 8-4 Hard 36 → 40. Easy gate
  unchanged (she is gacha, never in the free pool).

### v0.1.41 ship pass (lob for flyers only, one Heavy Ball tune)

- **The lob is flyers only.** With no walker on her lane, `rollBall`'s lob gathered every target the
  lob spec could reach, so she lobbed at ground walkers on other lanes too. It now picks flyers only
  (Hook Spin stays her way onto other lanes; test: one walker on a far lane, no Hook Spin, no flyer: no
  lob). On this bench Lane Master (2-x-0, no Hook Spin) now reads **0**: her best-covered 4-5 spot sits
  between the two arms before they join, her own lane is path 1's arm and the bench stream walks path 0
  only. The 4.3k · 12k · 70k above were those lobs. Beside the shared stretch after the join (Lane
  2-3-0 at (8, 7.3), same strong stats): path-0 walkers 4.6k, path-1 walkers 5.0k (main before the
  rework: 2.2k and **0**), so the shared-road fix itself holds.
- **Heavy Ball tune** (one pass): Concussion loses its +20 damage and makes the others in a blast take
  15 % (`ball.share` −0.35); Wrecking Ball +60 → +80; Bowling Thunder brings the share back to half
  (+0.35). Her 5/2 damage is unchanged (610 base), so the 5/2 panel and crowd are too.

| Heavy (coins) | panel DPS before → after | crowd DPS before → after | Akane crowd (coins) | boss DPS before → after |
|---|---|---|---|---|
| 3-0-2 (2,440) | 398 → 239 | 55.4k → 10.2k (1.7× Akane) | 5.9k (2,300) | 53 → 32 |
| 4-0-2 (5,840) | 875 → 875 | 129.2k → 41.2k (1.7× Akane) | 24.1k (5,500) | 118 → 118 |
| 5-0-2 (25,040) | 4,853 → 4,853 | 259.6k → 259.6k | 324.0k (35,500) | 809 → 809 |

## Kaede's AoE rework (2026-10-21, `feature/kaede-rework`)

Owner (Oct 15): "make kaede's attacks aoe! at least some of them, make her feel like an ssr!". Live Kaede was a
single-target duelist. She now cuts crowds on every path, with one AoE path, one boss path and one armor path.
Sim: `src/sim/towers.js` `bladeArts` (her `blade` block, `src/sim/mods.js` `normBlade`); FX:
`src/render/attackFx/styles/kaede.js` (`bladeArt` event); bench: `tools/kaedeBench.mjs`.

**Base (600):** every 3rd strike is a **Maple Cleave**: up to 4 enemies within 0.9 tiles of her target take 50 % of
her plain (unfocused) hit. Every shape below hits at a share of her plain hit, except the maple splash (a share of
her focused strike); victims are eligible enemies only (no flyer unless her kit reaches flyers, nothing in a
tunnel, never her target), nearest first, capped per shape.

| Path | Tier | Price | Effect |
|---|---|---:|---|
| Unbroken Rhythm (boss duel) | Steady Footwork | 150 | Ramp +2 % per hit, +20 % cap |
| | Second Wind | 360 | +15 % attack speed |
| | Maple Cascade | 1,200 | Ramp +4 %/hit, +50 % cap; ignores 3 armor. **At full focus** (her cap before Potential) every strike scatters maple leaves: up to 3 enemies within 0.9 tiles of her target take 30 % of it |
| | Autumn Requiem | 3,800 | Ramp +4 %/hit, +50 % cap; +30 % speed, +8 damage; ×1.3 damage |
| | Crimson Eternity | 28,000 | +24 damage, ramp +5 %/hit, +100 % cap, **×1.6 vs bosses** (was ×1.5), +30 % speed, ×1.3 damage; maple leaves 1.3 tiles, 5 enemies, 50 % |
| Flowing Blade (crowd) | Light Step | 130 | +0.3 range |
| | Flash Step | 340 | +4 damage; the cleave reaches 1.1 tiles and cuts 6 |
| | Wind Severing | 1,100 | Reaches flyers; +0.6 range. Every cleave also sends a **wind crescent** through her target: up to 4 enemies on a 3.5-tile line (half-width 0.3) take 55 % |
| | Iaijutsu Master | 3,500 | +20 % crit at ×2.5, +10 damage, ×1.3 damage. **Three crescents in a fan** (±0.32 rad), 4 tiles, half-width 0.4, 5 enemies each |
| | Thousand Leaves Draw | 25,000 | +60 % speed, +16 damage, +15 % crit at ×3, +0.5 range, ×1.4 damage. **Maple Storm**: every cleave also cuts up to 8 enemies within 2.5 tiles of her for 55 % |
| Guard Breaker (armor) | Heavy Hilt | 140 | +3 damage |
| | Pommel Strike | 320 | 15 % stun 0.2 s |
| | Armor Cleaver | 1,150 | Shred −2 (×3), ignores 4 armor |
| | Guard Breaker | 3,600 | Brittle +20 %, 25 % stun 0.5 s, shred −3 (×3), +6 damage, ×1.3. Every cleave sends a **shockwave**: up to 6 enemies on a 2.5-tile line (half-width 0.35) take 60 % and get her armor shred |
| | Heaven-Splitting Strike | 27,000 | +60 damage, shred −6 (×3), ×1.4 elites, ×1.3 bosses, ignores 2 armor, ×1.45. Shockwave 4 tiles, half-width 0.5, 10 enemies, 100 % |

- **Gear.** ATK, speed, crit, armor pierce, UR gear and the club tricks reach every blade-art hit (they hit with her
  own spec through `sim._hit`; a Finishing Thrust or a Big Beat multiplies the whole attack). **Pierce is now real
  for her:** +2 targets per 100 % on every shape of the attack (the sweep rule, carried, at most +4); it no longer
  fills in as ATK (`src/data/gearStats.js`). Crowd bench with +100 % Pierce: Kaede 2-5-0 3,280 → 4,182; Chika 2-0-5
  3,551 → 3,995, 5-0-2 2,697 → 5,341 (every drone pierces).
- **Potential.** P5 Maple Gale is re-sized on her blade arts: +8 % speed and her blade arts cut ×1.1 (was a 0.1-tile
  cut every 4th strike). P6 One Blade, One Foe keeps ×1.2 vs bosses and every 3rd strike ×1.5 (its proc is named
  One Blade). Power 1.13 · 1.09 · 1.17 · 1.12 · 1.31 = 2.11. Her maple splash keys on her focus cap **before**
  Potential (`blade.capMax`), so Scarlet Focus (+30 cap) never delays it.
- **Flash Lunge** (dormant ⚡, Flowing Blade 3): on her crowd path it now flashes through the 3 enemies her target
  mode picks, 2 full-ramp strikes each (tier 5: 5 enemies, 3 each, 20 s), her focus kept on the first.

**Bench** (`tools/kaedeBench.mjs`: the potentialBench harness, 4-5, the same strong stats for both girls, seeds 9
and 21, 15 s warm-up + 40 s; crowd = an immortal Orc Grunt every 0.1 s, held = one Royal Guard Slime, boss = one
Iron Colossus). DPS, before → after; Chika is unchanged (5-0-2 38,920 coins: crowd 2,697 / 5,083, held 4,486 /
8,525, boss 3,163 / 6,332; 2-0-5 30,920 coins: crowd 3,551 / 5,126):

| Kaede (coins) | target | P1 | P6 | ÷ Chika's best, P1 / P6 |
|---|---|---:|---:|---:|
| 5-2-0 Rhythm (34,580) | boss | 2,816 → 3,007 | 6,179 → 6,667 | 0.95 / 1.05 |
| 5-2-0 Rhythm | held elite | 4,702 → 4,704 | 8,591 → 8,689 | 1.05 / 1.02 |
| 5-0-2 Rhythm (34,570) | boss | 2,645 → 2,876 | 5,997 → 6,522 | 0.91 / 1.03 |
| 2-5-0 Flowing (31,180) | crowd | 750 → 3,280 | 1,875 → 5,486 | 0.92 / 1.07 |
| 2-5-0 Flowing | held elite | 4,489 → 4,469 | 8,951 → 9,050 | 1.00 / 1.06 |
| 0-5-2 Flowing (31,130) | crowd | 734 → 3,161 | 1,770 → 5,112 | 0.89 / 1.00 |
| 2-0-5 Breaker (33,320) | crowd | 414 → 1,740 | 1,224 → 2,872 | 0.49 / 0.56 |
| 2-0-5 Breaker | held elite | 4,582 → 4,900 | 8,738 → 8,911 | 1.09 / 1.05 |

**Gate B7** (Kaede / Chika within ±10 % at P1 and P6): boss path 0.95 / 1.05 (boss), 1.05 / 1.02 (held); crowd
path 0.92 / 1.07 (crowd vs Chika's best crowd build, Tesla 2-0-5 at equal coins); E = √(crowd × held) of 2-5-0 vs
Chika 5-0-2 (her best E) 1.10 / 1.07. The held numbers move by ±2 % from shared crit rolls when a second enemy
shows up in that bench; Breaker is the armor path, not a rival for either bar.

**Re-pinned goldens:** `tests/sim/mods.test.js` P1 resolve hash `456:055ce472` → `456:bd28cc90` (Kaede's `blade` block
and tiers; every other girl bit-identical, checked with Kaede left out at P1 and P6); `tests/online/engines.test.js`
POTENTIAL_START `23752 / 4242036526 / 57997ea1` → `23827 / 1924477857 / dec1d574` and POTENTIAL_BOSS_START
`35101 / 6568/4679 / 3492961063 / b2b2f34d` → `35035 / 6700/4594 / 2141169952 / 20c45d69` (Kaede fights in both).
Campaign, modes, abilities and battle-save goldens did not move. **Easy gate 40 / 40**: she is gacha, so the free
roster never fields her and every row is unchanged (full and base roster).

## New girls, wave 1 (2026-10-20, `feature/new-girls-w1`; UNIT_GAPS §5)

Azami (R, free after 2-2), Kinu (R, gacha), Wakaba (R, free after 6-5), Yuzuha (SR, free after 4-2).
Bench: a **walking stream** on 4-5 (one 3000-HP slime every 0.5 s along the road, 60 s, the girl on the
bot's own spot for her, best main/cross split) — the stationary bench cannot judge a strip layer.

| Girl | 3/2 | 4/2 | 5/2 | Band (same bench) |
|---|---|---|---|---|
| Azami | 46 | 139 | 998 | R: Aoi 56 / 173 / 1269, Rei 57 / 181 / 1072, Yuki 24 / 159 / 1273 |
| Kinu | 46 | 244 | 1125 | R (as above) |
| Yuzuha | 67 | 213 | 1672 | SR: Sango 79 / 236 / 2303, Midori 93 / 276 / 1150, Suzu 107 / 331 / 2805 |

Moves from the spec's first numbers: Azami strip damage 2 → 3 (Shredder +4, Detonation +16); Yuzuha's
sentries ×4 (base 12 dmg at 1.5/s, darts 4; tier 4-5 damage and bursts raised) — the spec's sentries
sat at a fifth of the SR band. Tier 5s are in the live 12,000-36,000 window (spec × ~1.6).

Bot (`src/sim/headless.js`, keys only the new girls carry, so base-roster plans are unchanged): a strip
layer is placed after the damage dealers, gets no extra copies, and her tiers wait for the carry's focus
push (v0.1.40 merge: main's Gourdlight Golem gate EB-2 lost Normal seed 1 by a one-second boss leak
when Azami's early spending delayed Shiro and Sango; the base team kills the Golem 20 s before it
leaks); a buff thrower is a support placed where her drinks reach the planned carry; `pathScore` reads sentry and strip
tiers like turret tiers.

**Easy gate: 40 / 40** with the full roster; with the four new girls left out every row is bit-identical
to the merged base (the modes goldens pin the same as a "base roster" block). 8-5 Easy over seeds 1-9:
full roster 5 / 9 (seed 1 won), base 6 / 9 — the same near coin flip the roster wave measured.

**Ouka** (SR, gacha; Student Council President, campus hub). She never attacks, so the damage bench does
not apply; her value is coins. Six girls inside her office, each built to 4/2 (Aoi, Rei, Yuki, Kage, Shiro,
Sango: 27,820 coins of upgrades):

| Ouka | team upgrades | saved | Ouka cost | net |
|---|---|---|---|---|
| 0-0-0 (5% off) | 26,440 | 1,380 | 550 | +830 |
| 2-0-0 (14% off) | 23,925 | 3,895 | 1,050 | +2,845 |
| 3-0-0 (+ first tier free) | 22,705 | 5,115 | 2,250 | +2,865 |
| 4-0-0 (+ two free, +2 coins a kill) | 19,735 | 8,085 | 5,850 | +2,235 (before kill coins) |
| 5-0-0 Golden Charter | 18,360 | 9,460 | 25,050 | a prestige buy (+5 a kill, 90% sell) |

She is gacha, so the Easy gate (free roster) never fields her: the gate rows are unchanged (full roster
40 / 40, identical to wave 1; base roster bit-identical to the merged base). The balance bot fields her
poorly (it places her last, after the first upgrade round, where she covers two girls: 4-5 Normal over
seeds 1-2, 178 → 153 lives left; 6-5 184 → 181; 8-5 lost either way): a player places her first and
builds around her. Rules are "strongest wins" with the auras, so her discount never stacks with Momo's.
Bot goldens for the gacha girls (`modesGolden` GACHA_GOLDEN, the free team plus her, seed 1): Ouka 5-4
Hard 21 → 25 lives, 8-4 Hard 37 → 37; Kinu 5-4 Hard 21 → 13, 6-1 Hard 44 → 38. 4-2 Hard (a 4-life win
for the free team) is lost with any ninth girl the bot adds, either of them: its plan spends on her
before the second copies it relies on.

Ouka's Assembly (v0.1.40 ship check): Club Mentors (T3, 1,100) and Festival of Clubs (T5, 19,200) only
sped up ability charge (`cdCut`), and nothing casts an ability until the ability bar ships, so both
were dead buys (and T3 gates T4). They now give a live effect at the same prices: Club Mentors, girls
in her radius attack 15% faster (Morning Bell's 10% raised to 15%; strongest wins with the auras);
Festival of Clubs, 25% faster and 15% further (Student Body's 10% range raised to 15%). Her ⚡ tier-3
total stays 2,090. `cdCut` stays in the sim for the bar (`tests/sim/hubs.test.js` runs it on a test
Ouka); give a tier its charge rule back when the bar ships. Gates: GACHA_GOLDEN Ouka rows unchanged
(5-4 Hard, 8-4 Hard), Easy gate 40 / 40 (she is gacha, never in the free pool).

**Chigusa** (SR, gacha; Greenhouse Gardener, nature caster). Walking-stream bench (as above): 75 / 278 /
1422 at 3/2 / 4/2 / 5/2 (SR band: Sango 79 / 236 / 2303, Midori 93 / 276 / 1150). The spec's seeds (2
damage, Fresh Seeds +1, Full Bloom +4, Season of Plenty +10) benched at 28 / 139 / 550, a third of the
band: base damage 3, Fresh Seeds +2, Bloom Rush +3, Full Bloom +6, Season of Plenty +30. Forest Corridor
(her T5, a final tier at 19,200) also raises vine damage to 30/s and thorn beds to 10. Bot goldens (the
free team plus her): 5-4 Hard 21 → 29 lives, 8-4 Hard 37 → 41. Her Harvest coins use the existing
`income` (pooled like Momo's wave income); her lives respect healing, income and the 30-a-battle cap.

**Marumi** (SR, gacha; Strike Bowler, rolling bombs). Walking-stream bench: 80 / 335 / 1854 at 3/2 /
4/2 / 5/2 with the spec's numbers unchanged (Akane 94 / 353 / 3738, Sango 79 / 236 / 2303). Her tier 5s
are in the final-tier window (spec × 1.6); Turkey Strike also adds +40 damage and 9 pins of 16. Bot
goldens (the free team plus her): 5-4 Hard 21 → 25 lives, 8-4 Hard 37 → 36. Shared stretches (P-17):
a ball and its pins also touch walkers of another path where the two roads run the same way (a fork's
shared entrance, a join's shared exit), never on a crossing or an overpass. Bowling Thunder: minibosses
take her whole push (`pushBig`; KNOCKBACK_RESIST halves everyone else's miniboss pushes as before). (Reworked
Oct 21: see "Marumi rework" above.)


## Roster wave (2026-10-20, `feature/roster-wave`, track 5)

First pass for the nine returning girls; the owner's balance pass comes later. Method: the hero-rework
bench (`tools/balance/bench.js`: stage 4-5's map, a column of 10 stationary ground enemies, 20 s,
default stats, best main/cross split) plus a **stream** bench in `tools/balance/rosterWave.js`
(finite-HP enemies replaced as they fall, so kills and curse bursts count; and a flyer column).
Run: `BALANCE=roster BALANCE_OUT=/tmp/t.md npx vitest run tests/integration/rosterWave.balance.test.js`.
A girl is "in band" when at least one of her stream measures sits inside her rarity's live min × 0.85 …
max × 1.15. Supports (Noa, like Umeko and Miko) are not banded.

| Girl | Rarity | Crowd 3/2 | Crowd 5/2 | Single 5/2 | Stream 3/2 (400 HP) | Stream 5/2 (4,000 HP) | Flyers 3/2 | vs her rarity median: crowd 5/2 · stream 3/2 · stream 5/2 · flyers | In band? |
|---|---|---|---|---|---|---|---|---|---|
| Fuu | R | 54 | 834 | 131 | 54 | 834 | 54 | 0.42× · 0.59× · 0.42× · 0.88× | yes |
| Hana | R | 49 | 696 | 371 | 49 | 696 | 107 | 0.35× · 0.53× · 0.35× · 1.74×! | yes |
| Ruri | SR | 84 | 1191 | 157 | 84 | 1191 | 84 | 0.52× · 0.65× · 0.52× · 0.88× | yes |
| Noa | SR | 10 | 128 | 13 | 10 | 128 | 10 | 0.06×! · 0.07×! · 0.06×! · 0.10×! | support (aura; not banded) |
| Iroha | SSR | 156 | 1449 | 309 | 156 | 1449 | 156 | 1.56× · 3.12×! · 1.68× · 3.11×! | yes |
| Ena | SSR | 42 | 383 | 385 | 42 | 383 | 42 | 0.41×! · 0.85× · 0.44×! · 0.84× | yes |

Bands: the live girls of her rarity, damage dealers only (min … max; "!" = outside min × 0.85 … max × 1.15). Akane and Midori are left out of the 1e9-HP crowd band (their % of max HP burns read the bench's 1e9 HP).
- R: c52 791 · 1999 · 2009 | st32 32 · 91 · 131 | st52 791 · 1989 · 1993 | air32 32 · 62 · 91
- SR: c52 1287 · 2288 · 6877 | st32 61 · 130 · 210 | st52 854 · 2286 · 7006 | air32 42 · 95 · 210
- SSR: c52 864 · 929 · 1902 | st32 45 · 50 · 123 | st52 622 · 864 · 1902 | air32 42 · 50 · 123

Live girls (crowd 5/2 / stream 3/2 / stream 5/2 / flyers 3/2): Aoi 1999/91/1993/91 · Rei 2009/131/1989/0 · Yuki 791/32/791/32 · Momo 1515/53/1504/53 · Akane 29800770/162/3397/0 · Sango 2288/140/2286/0 · Kage 6877/210/7006/210 · Umeko 180/14/180/14 · Shiro 3420/61/3357/61 · Midori 24834025/89/854/42 · Suzu 1860/72/1860/0 · Raika 1287/130/1287/130 · Miko 861/4/861/4 · Hotaru 1902/123/1902/123 · Kaede 929/45/622/42 · Chika 864/50/864/50

| Hero | Lv 1 | Lv 5 | Lv 10 | Lv 15 | Lv 20 | Lv 25 crowd | Lv 25 single | Guards |
|---|---|---|---|---|---|---|---|---|
| Hikari | 18 | 33 | 74 | 167 | 876 | 3960 | 389 | crowd ≤ 1.4× best · single ≤ best · Lv25 ≥ 5/2 median · Lv20 ≥ 4/2 median · Lv10 ≥ ½ 3/2 median |
| Luna | 29 | 48 | 91 | 210 | 983 | 4587 | 127 | crowd ≤ 1.4× best · single ≤ best · Lv25 ≥ 5/2 median · Lv20 ≥ 4/2 median · Lv10 ≥ ½ 3/2 median |
| Nami | 20 | 31 | 74 | 154 | 378 | 1198 | 106 | crowd ≤ 1.4× best · single ≤ best · Lv25 < 5/2 median · Lv20 ≥ 4/2 median · Lv10 ≥ ½ 3/2 median |
| Kanna | 16 | 24 | 59 | 142 | 786 | 6531 | 1847 | crowd ≤ 1.4× best · single ≤ best · Lv25 ≥ 5/2 median · Lv20 ≥ 4/2 median · Lv10 ≥ ½ 3/2 median |
| Yoriko | 11 | 14 | 32 | 54 | 498 | 2775 | 992 | crowd ≤ 1.4× best · single ≤ best · Lv25 ≥ 5/2 median · Lv20 ≥ 4/2 median · Lv10 < ½ 3/2 median |
| Seiran | 16 | 29 | 52 | 87 | 631 | 4305 | 215 | crowd ≤ 1.4× best · single ≤ best · Lv25 ≥ 5/2 median · Lv20 ≥ 4/2 median · Lv10 ≥ ½ 3/2 median |

Tower references: 3/2 median 92 · 4/2 median 360 · 5/2 median 1902 · best 5/2 crowd 6877 · best 5/2 single 2354.

Tuning done to get here (data only): Iroha 5 → 4 damage and 0.8 → 0.7 rate (her two firing points made
her 3/2 the SSR top); Ena 5 → 12 damage, 1.0 rate and bigger tier 4-5 damage (her curses could not
burst when nothing died); Fuu, Hana and Ruri more tier 4-5 damage; Yoriko 4 → 6 and Seiran 4 → 5 base
damage (hero Lv 10 guard). Yoriko still misses the Lv 10 guard (32 < 46): a control hero, like Nami's
Lv 25 miss; left for the owner's pass.

**The campaign (Easy gate, `tests/integration/balance.test.js`): 40 / 40, strict.** The first push lost
8-5 Easy (the Ashwing Matriarch's final flight leaked) and listed it in `KNOWN_EASY_FLIPS`; that list is
gone and the test is identical to v0.1.37's again. Full analysis in `docs/merge/ROSTER_WAVE_NOTES.md` §5:

- **Old roster (the 19 live girls only).** It lost 8-5 on the head because B3's push lock applied to every
  girl's knockback (Shiro, Sango, Umeko, …). The lock now applies only to gathers and to `PUSH_LOCK_KITS`
  (Fuu). The bot also places an amphibious girl on water whenever a water spot is free, as it did when she
  was water-only. With the returning girls left out, every row below and every modes golden is
  bit-identical to v0.1.37.
- **Full pool.** From 7-5 on, Hana and Noa take the last two slots from Yuki and Aoi. 8-5 Easy is a near
  coin flip for this bot: over seeds 1-9 v0.1.37's team wins 2 / 9 (seed 1 is a win) and Hana + Noa 3 / 9.
  Hana's numbers barely matter there (Shiro deals ~90 % of the boss damage). **Noa's base aura +5 % → +8 %
  damage** (Miko's is +10 %) lifts it to 6 / 9, seed 1 included.

Bot fixes kept: a token-damage aura girl is a support (no more three Noas); amphibious girls water-first.
Modes goldens: 1-1 … 6-1 unchanged; 6-3 … 8-5 re-pinned (Noa and Hana in the bot's free team), plus a
"19 live girls" block pinned to v0.1.37's digests.

Easy gate, seed 1, lives left. "Before" = head `fdf741d`; "old roster" = free pool without the nine
returning girls; "full" = everyone free at that point (Noa after 6-2, Hana after 7-5).

| Stage | v0.1.37 (main) | before, old roster | before, full | after, old roster | after, full |
|---|---|---|---|---|---|
| 1-1 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 1-2 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 1-3 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 1-4 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 1-5 | won 121/150 | won 121/150 | won 121/150 | won 121/150 | won 121/150 |
| 2-1 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 2-2 | won 148/150 | won 148/150 | won 148/150 | won 148/150 | won 148/150 |
| 2-3 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 2-4 | won 149/150 | won 149/150 | won 149/150 | won 149/150 | won 149/150 |
| 2-5 | won 145/150 | won 145/150 | won 145/150 | won 145/150 | won 145/150 |
| 3-1 | won 102/150 | won 102/150 | won 102/150 | won 102/150 | won 102/150 |
| 3-2 | won 93/150 | won 128/150 | won 128/150 | won 93/150 | won 93/150 |
| 3-3 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 3-4 | won 136/150 | won 141/150 | won 141/150 | won 136/150 | won 136/150 |
| 3-5 | won 111/150 | won 140/150 | won 140/150 | won 111/150 | won 111/150 |
| 4-1 | won 148/150 | won 131/150 | won 131/150 | won 148/150 | won 148/150 |
| 4-2 | won 144/150 | won 143/150 | won 143/150 | won 144/150 | won 144/150 |
| 4-3 | won 148/150 | won 148/150 | won 148/150 | won 148/150 | won 148/150 |
| 4-4 | won 141/150 | won 141/150 | won 141/150 | won 141/150 | won 141/150 |
| 4-5 | won 140/150 | won 140/150 | won 140/150 | won 140/150 | won 140/150 |
| 5-1 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 5-2 | won 143/150 | won 143/150 | won 143/150 | won 143/150 | won 143/150 |
| 5-3 | won 116/150 | won 116/150 | won 116/150 | won 116/150 | won 116/150 |
| 5-4 | won 141/150 | won 143/150 | won 143/150 | won 141/150 | won 141/150 |
| 5-5 | won 150/150 | won 149/150 | won 149/150 | won 150/150 | won 150/150 |
| 6-1 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 6-2 | won 146/150 | won 146/150 | won 146/150 | won 146/150 | won 146/150 |
| 6-3 | won 147/150 | won 147/150 | won 148/150 | won 147/150 | won 148/150 |
| 6-4 | won 149/150 | won 150/150 | won 150/150 | won 149/150 | won 150/150 |
| 6-5 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 7-1 | won 146/150 | won 146/150 | won 145/150 | won 146/150 | won 145/150 |
| 7-2 | won 147/150 | won 147/150 | won 145/150 | won 147/150 | won 145/150 |
| 7-3 | won 139/150 | won 137/150 | won 139/150 | won 139/150 | won 143/150 |
| 7-4 | won 122/150 | won 138/150 | won 135/150 | won 122/150 | won 119/150 |
| 7-5 | won 117/150 | won 147/150 | won 144/150 | won 117/150 | won 113/150 |
| 8-1 | won 150/150 | won 150/150 | won 150/150 | won 150/150 | won 150/150 |
| 8-2 | won 148/150 | won 150/150 | won 150/150 | won 148/150 | won 149/150 |
| 8-3 | won 149/150 | won 150/150 | won 150/150 | won 149/150 | won 150/150 |
| 8-4 | won 145/150 | won 145/150 | won 150/150 | won 145/150 | won 150/150 |
| 8-5 | won 144/150 | **lost** 0/150 | **lost** 0/150 | won 144/150 | won 145/150 |
| **wins** | 40/40 | 39/40 | 39/40 | 40/40 | 40/40 |

"Before, old roster" also differed from v0.1.37 on 13 more stages (lives only: the girls' push lock),
all back to v0.1.37's numbers now. Run: a scratch copy of the gate with the free pool filtered
(`freeUnitsBefore` minus `EXPANSION_IDS`), on both checkouts.

## Hero rework (2026-10-14, `feature/hero-rework`; spec `docs/specs/HERO_REWORK.md`)

Heroes deploy for free and level 1–25 inside each battle. Measured on this branch against the live
code (`ca97c1e`), same bot, same seed, same script on both checkouts.

**Method.** Headroom = the largest multiplier on a stage's enemy HP that the balance bot still wins:
Normal, the free-to-play roster at `EXPECTED_LEVEL` with `autoPlan` (no level buying, no ult), seed 1,
bracket search 0.25–16 on a log scale, 7 steps (`tools/balance/headroom.js`; `BALANCE=hero` runs it on
ten stages with the pace / power guards). "✗" = the bot loses at ×1. Default hero: Hikari on chapter 1,
Nami after 1-5.

### Summary

| | Live (today) | Reworked, no HP pass | **Reworked + stage-HP pass (ships)** |
|---|---|---|---|
| Normal headroom, geomean of 40 stages | 2.71 | 5.38 (**×1.98** of live) | **3.13 (×1.15 of live)** — target 1.1–1.3 |
| Easy / Normal wins (`BALANCE=full`) | 40 / 39 (8-5 lost) | — | **40 / 39** (8-5 lost) |
| Hard / Nightmare wins | 30 / 0 | — | **26 / 3** |
| Hero end level, chapter 1 / 8-5 (no buying) | 5–10 / 10 | 14–19 / 18 | 14–19 / 19 |

**Stage-HP pass** (`HERO_HP_PASS` in `src/data/stages.js`, data only): per chapter, the chapter's
headroom gain ÷ 1.05, capped per stage so no stage ends harder than today for the bot, floor 1,
step 0.05. Enemy HP only: `cashScale` is computed from the pre-pass `hpScale`, so coins per kill and
per wave do not move. It also applies to co-op (×1.6 on top) and co-op freeplay, which use the stage's
`hpScale`. Re-measured after applying it (not just computed): ×1.154 (prediction ×1.147).

### Per stage (Normal headroom)

| Stage | Hero | Live (today) | Reworked, no HP pass | **Reworked + HP pass** | HP pass × | Reworked ÷ live | **+ pass ÷ live** | Hero end level live / reworked / + pass |
|---|---|---|---|---|---|---|---|---|
| 1-1 | Hikari | 6.73 | 11.81 | **6.73** | 1.75 | ×1.75 | **×1.00** | 6 / 15 / 15 |
| 1-2 | Hikari | 3.51 | 6.58 | **3.75** | 1.75 | ×1.87 | **×1.07** | 8 / 14 / 15 |
| 1-3 | Hikari | 5.66 | 8.92 | **5.91** | 1.55 | ×1.58 | **×1.04** | 5 / 14 / 14 |
| 1-4 | Hikari | 2.65 | 4.46 | **2.59** | 1.65 | ×1.68 | **×0.98** | 8 / 15 / 16 |
| 1-5 | Hikari | 3.36 | 8.18 | **4.65** | 1.75 | ×2.43 | **×1.38** | 10 / 19 / 19 |
| 2-1 | Nami | 2.23 | 3.44 | **2.28** | 1.5 | ×1.54 | **×1.02** | 7 / 14 / 15 |
| 2-2 | Nami | 1.92 | 3.91 | **2.00** | 1.95 | ×2.04 | **×1.04** | 8 / 15 / 17 |
| 2-3 | Nami | 1.96 | 3.91 | **1.96** | 1.95 | ×1.99 | **×1.00** | 10 / 20 / 20 |
| 2-4 | Nami | 2.13 | 3.22 | **2.13** | 1.5 | ×1.51 | **×1.00** | 9 / 14 / 14 |
| 2-5 | Nami | 2.13 | 8.92 | **4.36** | 1.95 | ×4.19 | **×2.05** | 8 / 17 / 19 |
| 3-1 | Nami | 3.75 | 7.34 | **4.97** | 1.45 | ×1.96 | **×1.33** | 8 / 15 / 15 |
| 3-2 | Nami | 2.00 | 3.15 | **2.18** | 1.45 | ×1.57 | **×1.09** | 6 / 13 / 14 |
| 3-3 | Nami | 2.95 | 3.83 | **3.08** | 1.25 | ×1.30 | **×1.04** | 9 / 20 / 20 |
| 3-4 | Nami | 1.58 | 2.23 | **1.54** | 1.4 | ×1.41 | **×0.97** | 10 / 19 / 20 |
| 3-5 | Nami | 1.45 | 2.23 | **1.54** | 1.45 | ×1.54 | **×1.06** | 10 / 17 / 18 |
| 4-1 | Nami | 2.13 | 6.44 | **2.77** | 2.3 | ×3.02 | **×1.30** | 10 / 18 / 21 |
| 4-2 | Nami | 1.83 | 4.65 | **2.09** | 2.3 | ×2.54 | **×1.14** | 10 / 21 / 23 |
| 4-3 | Nami | 2.95 | 9.11 | **3.83** | 2.3 | ×3.09 | **×1.30** | 10 / 20 / 23 |
| 4-4 | Nami | 1.54 | 2.89 | **1.51** | 1.85 | ×1.88 | **×0.98** | 10 / 19 / 20 |
| 4-5 | Nami | 2.23 | 4.46 | **2.23** | 2 | ×2.00 | **×1.00** | 10 / 17 / 18 |
| 5-1 | Nami | 3.59 | 11.56 | **5.66** | 2.1 | ×3.22 | **×1.58** | 10 / 19 / 20 |
| 5-2 | Nami | 2.00 | 3.36 | **2.09** | 1.65 | ×1.68 | **×1.04** | 10 / 16 / 17 |
| 5-3 | Nami | 1.45 | 2.71 | **1.54** | 1.85 | ×1.87 | **×1.06** | 10 / 18 / 19 |
| 5-4 | Nami | 4.09 | 12.34 | **5.91** | 2.1 | ×3.02 | **×1.44** | 10 / 21 / 22 |
| 5-5 | Nami | 8.35 | ≥16 | **10.83** | 1.9 | ×1.92 | **×1.30** | 10 / 24 / 24 |
| 6-1 | Nami | 3.44 | 4.76 | **3.51** | 1.35 | ×1.38 | **×1.02** | 10 / 21 / 21 |
| 6-2 | Nami | 2.65 | 7.66 | **4.00** | 1.95 | ×2.89 | **×1.51** | 8 / 19 / 20 |
| 6-3 | Nami | 3.08 | 5.19 | **3.02** | 1.65 | ×1.69 | **×0.98** | 10 / 17 / 17 |
| 6-4 | Nami | 3.59 | 8.00 | **4.00** | 1.95 | ×2.23 | **×1.11** | 10 / 20 / 21 |
| 6-5 | Nami | 4.56 | 12.34 | **6.30** | 1.95 | ×2.71 | **×1.38** | 8 / 19 / 21 |
| 7-1 | Nami | 2.48 | 3.91 | **2.54** | 1.55 | ×1.58 | **×1.02** | 10 / 18 / 18 |
| 7-2 | Nami | 5.19 | 14.05 | **6.17** | 2.4 | ×2.71 | **×1.19** | 10 / 21 / 23 |
| 7-3 | Nami | 1.87 | 4.18 | **1.87** | 2.2 | ×2.24 | **×1.00** | 10 / 24 / 25 |
| 7-4 | Nami | 3.75 | 13.75 | **5.66** | 2.4 | ×3.67 | **×1.51** | 10 / 20 / 21 |
| 7-5 | Nami | 3.22 | 9.72 | **4.18** | 2.4 | ×3.02 | **×1.30** | 9 / 18 / 21 |
| 8-1 | Nami | 4.46 | 7.34 | **5.66** | 1.3 | ×1.65 | **×1.27** | 10 / 20 / 20 |
| 8-2 | Nami | 2.33 | 3.02 | **2.43** | 1.25 | ×1.30 | **×1.04** | 10 / 22 / 22 |
| 8-3 | Nami | 2.95 | 4.27 | **3.22** | 1.3 | ×1.45 | **×1.09** | 8 / 19 / 20 |
| 8-4 | Nami | 2.77 | 4.00 | **3.08** | 1.3 | ×1.44 | **×1.11** | 10 / 19 / 19 |
| 8-5 | Nami | 0.60 ✗ | 0.66 ✗ | **0.64 ✗** | 1.1 | ×1.10 | **×1.07** | 10 / 18 / 19 |

The pass makes the late campaign's enemies tougher in absolute HP (7-x: ×2.4) but, with the hero
growing through the battle, the bot's margin there ends at ×1.0–1.5 of today. 8-5 stays lost for the
bot (as today; it is won when the bot buys hero levels, spec §6.1).

### Medal difficulties (`BALANCE=full`, all 40 stages, no buying, no ult) — owner question Q2

| Difficulty | Live wins | **Reworked + HP pass** | Newly won | Newly lost |
|---|---|---|---|---|
| Easy | 40/40 | **40/40** | — | — |
| Normal | 39/40 | **39/40** | — | — |
| Hard | 30/40 | **26/40** | — | 2-3, 2-4, 7-3, 7-5 |
| Nightmare | 0/40 | **3/40** | 1-1, 1-2, 1-3 | — |

**Owner, 2026-10-15: approved ("Sure ship"); the Hard change (30 → 26 wins) accepted; one HP-pass re-fit at the train-C combined pass is fine.**

**First-clear gems reachable earlier for a free player (Q2, shipped as measured):**
Nightmare +3 stages × 100 = **+300 gems** reachable earlier (and sweeping of those stages); Hard 4 stages
× 60 = 240 gems now need more levels or gear than before. Once per account; the medal budget
(220 gems × 40 stages) is unchanged. The spec measured the rework **without** the HP pass at +760
(6 Hard + 4 Nightmare); the HP pass that ships removes most of that. If the owner says no:
`DIFFICULTIES.hard/nightmare.heroCost` (data) puts a deploy price back on medal difficulties only.

### Power: in-sim crowd / single-target bench (`tools/balance/bench.js`, `BALANCE=hero` power guard)

Stage 4-5's map, a column of 10 ground enemies along 2 tiles of road (1e9 HP, no armor), the unit on
the nearest valid spot, 20 s; damage ÷ 20. Default stats, no gear; towers at their best main/cross split.

| Unit | Lv 1 | Lv 5 | Lv 10 | Lv 15 | Lv 20 | Lv 25 crowd | Lv 25 single target |
|---|---|---|---|---|---|---|---|
| Hikari | 18 | 33 | 74 | 167 | 876 | **3,960** (1.14× best 5/2) | 389 (0.33×) |
| Luna | 29 | 48 | 91 | 210 | 983 | **4,587** (1.32×) | 127 (0.11×) |
| Nami | 20 | 31 | 74 | 154 | 378 | **1,198** (0.34×; 1.28× median) | 106 (0.09×) |

Towers, crowd: tier 3/2 median 81 · 4/2 median 219 · 5/2 median 934, best **Kage 5/2 3,473**; single
target at 5/2: best **Kage 1,189**. Guards (all pass): Lv 25 crowd ≤ 1.4× and single ≤ 1.0× the best
5/2 tower; Lv 25 crowd ≥ the 5/2 median; Lv 20 ≥ the 4/2 median; Lv 10 ≥ half the 3/2 median.
Luna's Lv 22 "Lunatic Lance" is +8 damage (spec +10) to stay under the 1.4× guard on this bench.

### Deliberate side effects (said in the tips)

- Cost-cut auras (Umeko, Miko, Nami's Lv 24 Harbor aura) discount tower upgrades, **not hero levels**.
  Gear Cost Reduction on a hero now discounts her level prices ("Level prices −X %").
- Codex Half Income (#169) halves coins, not level prices: buying levels is relatively dearer there.

### Still to do (train C combined pass, landing plan §9.2)

The HP pass above is calibrated on the hero rework alone. Chika, Potential and codex modes add power
on the same train; the combined pass re-runs this script on `train/battle-2` and re-fits
`HERO_HP_PASS` once. Co-op balance (`COOP.hpMul` 1.6) and freeplay `hpBands` were not re-measured here.
