# More page audit (v0.1.68)

The battle girl drawer's **More ▸ Details** page, for every unit in the roster (`src/data/units.js`: 32 girls including the duo LR Kohaku & Tsubaki and Tenka, and 7 heroes including the staff heroes Kogane and Norika).

The owner asked to show everyone's actual DPS, not just Chika's. The owner also said that Luna, for example, doesn't show all the info on the More page.

## Method

Each unit was placed on the fixture field at five builds:

- each path at tier 5: 5-0-0, 0-5-0 and 0-0-5;
- one mixed build, 2-0-5;
- heroes at Lv 25 with full Mastery.

Each one fought ten stationary orcs and tanks for 8 s. Then I read the sim's credit (`damageDealt`, `shapeDealt`, `droneDmg`) and her effective kit (`t.eff`).

Each column comes from a different source:

- **DPS shown?** is the drawer's old rule (`st.dps > 0`, a trapper or strip layer, or poison or burn), compared with the new `dealsDamage` rule (`src/ui/battle/kitRows.js`).
- **Missing info** is every kit piece in her stats that the More page had no row for before this change.
- **Fix** is what now shows it.

`e2e/more-page.mjs` repeats the check in the real app on map 1-3 for Luna, Chika, Iroha, Midori, Suzu and Ouka, at 390x844, 844x390 and 1280x720.

## Summary

- **DPS cells.** On these builds the old rule already showed DPS (live) and DPS (avg) for every damage dealer but one. The exception was Wakaba with Towel Snap (0-0-5 and 2-0-5): she deals damage, but her paper DPS is 0.
  - The new rule shows the cells whenever she has any damage source. A source is any of: paper DPS, traps or strips, poison or burn, a damage kit, a towel, a lab, or any damage the sim has credited her.
  - The drawer's signature now redraws the cells the moment she first deals damage, so a girl whose damage the paper formula misses still gets them.
  - Pure supports still get no DPS cells, only "Boost to allies": Ouka at every build, and Wakaba on paths 1 and 2.
- **Heroes (Luna included) had no stat grid on More at all.** Their page showed only the top stat row, the DPS cells, then Level, Ultimate, Skill and the 25-level track.
  - Hero More now gets the same grid as a girl (`detailGrid`): Damage, Attacks/s, Range, Beams or Targets, Pierce, Splash, Crit, vs Elite / Boss, Aura → allies, Mark, Ramp, Element, Kills and Damage dealt.
  - It also gets her capability chips (statuses, Hits air, Veil Sight), her "Buffed by" list, and her kit rows. For Luna that means Moonbeam: 2 beams, ±45° sweep, 35% of her hit.
- **No kit row for 29 kit pieces.** Before this change the More page only had rows for traps, drones, aura, office, mark, ramp and income. Every other piece now gets a row with its tier numbers:
  - the S5 shapes: Charm Wheel, Crescent, Bell Toll, Spore Mist, Moonbeam, Static Web;
  - the S1 to S4 shapes: Coin Wheel, Pinwheel, Petal Halo, Stream, Sweep, Rising Spikes, Ripple Quake, Homecoming, Spirit Tether;
  - Iroha's mirrors (placed / bounces / bounce damage / splash / shards, allies' shots, mirror reach) and Ruri's familiar;
  - Kaede's blade arts, Kinu's pin ring, Azami's strips, and Chigusa's vines, thorn beds, Bloom Rush and harvest;
  - Marumi's bowl, Yuzuha's sentries and capture nets, the duo's prism beam and refraction, and Norika's barricades;
  - Tenka's lab team, gravity well and Last Line, Shiro's execution shot, Midori's brew, and Wakaba's drink and Towel Snap.
- **The ⚡ ability** had no line on More. A girl's ability row now names it:
  - before it unlocks: "Skyfall Volley · Rapid Volley tier 3";
  - once unlocked: "… · 28s recharge";
  - with her LR form: its LR name, only while her battle stats carry `lr`.
- **Damage by source.** The sim credits two sources apart, and nothing else:
  - an S5 shape's damage, `t.shapeDealt`, used by Charms, Crescent, Bells, Mist, Moonbeam and Web;
  - drones, `t.droneDmg`, which Chika's own tabs already show.

  So "Damage by source" shows "Attack 80% · Mist 20%" style splits for the S5 girls and Luna.
  - Iroha's mirror bounces, Ena's tether shares, curse spreads, DoTs, sentries and the duo's beam are credited only to her total. As the brief asked, I added no sim fields, so those show the total DPS with no split.
  - Splitting them would need new sim credits, and so a `COOP_PROTOCOL` bump: that is the coordinator's call.
- **Set bonus and gear.** These rows were already there and unchanged: Club (the Academy Club set), Upgrades % cheaper (gear Cost Reduction), Pierce (+gear %), Potential, and Council rules.
- **Determinism.** The change is display only. kitRows reads `t.eff` and live counts and never writes them (tests/battle-ui/kitRows.test.js checks this). The sim id is unchanged, `0fe7c5c04aec`, and `COOP_PROTOCOL` stays 15.

### Notes

- Luna's split can honestly read "Moonbeam 0%". Her beam only strikes enemies her volley did not, and with 6 beams at pierce 12 a tight pack is all in her volley. On a spread-out crowd the Moonbeam share rises.
- At 390x844 the battle leaves a light band under the drawer. It is the same on live main (see the before stills), so this change did not cause it.

## Table

| Unit | Build | DPS shown? (old → new) | Missing info before | Fix |
|---|---|---|---|---|
| Hikari (hero, Lv 25) | Lv 25 | yes | whole attack grid (Damage, Attacks/s, Range, Beams/Targets, Pierce, Splash, Crit, vs Elite/Boss, Aura, Mark, Ramp, Kills, Damage dealt), capability chips, Buffed by | hero More gets the girl grid (detailGrid) |
| Luna (hero, Lv 25) | Lv 25 | yes | whole attack grid (Damage, Attacks/s, Range, Beams/Targets, Pierce, Splash, Crit, vs Elite/Boss, Aura, Mark, Ramp, Kills, Damage dealt), capability chips, Buffed by; Moonbeam row; damage by source | hero More gets the girl grid (detailGrid), kitRows, Damage by source |
| Nami (hero, Lv 25) | Lv 25 | yes | whole attack grid (Damage, Attacks/s, Range, Beams/Targets, Pierce, Splash, Crit, vs Elite/Boss, Aura, Mark, Ramp, Kills, Damage dealt), capability chips, Buffed by | hero More gets the girl grid (detailGrid) |
| Aoi | 5-0-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Aoi | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Aoi | 0-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Aoi | 2-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Rei | 5-0-0 | yes | Crescent row; ⚡ ability name / unlock / recharge; damage by source | kitRows, Damage by source |
| Rei | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Rei | 0-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Rei | 2-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Yuki | 5-0-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Yuki | 0-5-0 | yes | Rising Spikes row; ⚡ ability name / unlock / recharge | kitRows |
| Yuki | 0-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Yuki | 2-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Momo | 5-0-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Momo | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Momo | 0-0-5 | yes | Coin Wheel row; ⚡ ability name / unlock / recharge | kitRows |
| Momo | 2-0-5 | yes | Coin Wheel row; ⚡ ability name / unlock / recharge | kitRows |
| Akane | 5-0-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Akane | 0-5-0 | yes | Stream row; ⚡ ability name / unlock / recharge | kitRows |
| Akane | 0-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Akane | 2-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Sango | 5-0-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Sango | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Sango | 0-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Sango | 2-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Kage | 5-0-0 | yes | Pinwheel row; ⚡ ability name / unlock / recharge | kitRows |
| Kage | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Kage | 0-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Kage | 2-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Umeko | 5-0-0 | yes | Sweep row; ⚡ ability name / unlock / recharge | kitRows |
| Umeko | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Umeko | 0-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Umeko | 2-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Shiro | 5-0-0 | yes | Execution row; ⚡ ability name / unlock / recharge | kitRows |
| Shiro | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Shiro | 0-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Shiro | 2-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Midori | 5-0-0 | yes | Brew row; ⚡ ability name / unlock / recharge | kitRows |
| Midori | 0-5-0 | yes | Brew row; ⚡ ability name / unlock / recharge | kitRows |
| Midori | 0-0-5 | yes | Spore Mist, Brew rows; ⚡ ability name / unlock / recharge; damage by source | kitRows, Damage by source |
| Midori | 2-0-5 | yes | Spore Mist, Brew rows; ⚡ ability name / unlock / recharge; damage by source | kitRows, Damage by source |
| Suzu | 5-0-0 | yes | Bell Toll row; ⚡ ability name / unlock / recharge; damage by source | kitRows, Damage by source |
| Suzu | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Suzu | 0-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Suzu | 2-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Raika | 5-0-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Raika | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Raika | 0-0-5 | yes | Static Web row; ⚡ ability name / unlock / recharge; damage by source | kitRows, Damage by source |
| Raika | 2-0-5 | yes | Static Web row; ⚡ ability name / unlock / recharge; damage by source | kitRows, Damage by source |
| Miko | 5-0-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Miko | 0-5-0 | yes | Charm Wheel row; ⚡ ability name / unlock / recharge; damage by source | kitRows, Damage by source |
| Miko | 0-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Miko | 2-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Hotaru | 5-0-0 | yes | Petal Halo row; ⚡ ability name / unlock / recharge | kitRows |
| Hotaru | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Hotaru | 0-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Hotaru | 2-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Kaede | 5-0-0 | yes | Blade arts row; ⚡ ability name / unlock / recharge | kitRows |
| Kaede | 0-5-0 | yes | Blade arts row; ⚡ ability name / unlock / recharge | kitRows |
| Kaede | 0-0-5 | yes | Blade arts row; ⚡ ability name / unlock / recharge | kitRows |
| Kaede | 2-0-5 | yes | Blade arts row; ⚡ ability name / unlock / recharge | kitRows |
| Chika | 5-0-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Chika | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Chika | 0-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Chika | 2-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Tenka | 5-0-0 | yes | Lab team row; ⚡ ability name / unlock / recharge | kitRows |
| Tenka | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Tenka | 0-0-5 | yes | Gravity well, Last Line rows; ⚡ ability name / unlock / recharge | kitRows |
| Tenka | 2-0-5 | yes | Gravity well, Last Line rows; ⚡ ability name / unlock / recharge | kitRows |
| Kanna (hero, Lv 25) | Lv 25 | yes | whole attack grid (Damage, Attacks/s, Range, Beams/Targets, Pierce, Splash, Crit, vs Elite/Boss, Aura, Mark, Ramp, Kills, Damage dealt), capability chips, Buffed by; Ripple Quake row | hero More gets the girl grid (detailGrid), kitRows |
| Yoriko (hero, Lv 25) | Lv 25 | yes | whole attack grid (Damage, Attacks/s, Range, Beams/Targets, Pierce, Splash, Crit, vs Elite/Boss, Aura, Mark, Ramp, Kills, Damage dealt), capability chips, Buffed by | hero More gets the girl grid (detailGrid) |
| Seiran (hero, Lv 25) | Lv 25 | yes | whole attack grid (Damage, Attacks/s, Range, Beams/Targets, Pierce, Splash, Crit, vs Elite/Boss, Aura, Mark, Ramp, Kills, Damage dealt), capability chips, Buffed by | hero More gets the girl grid (detailGrid) |
| Fuu | 5-0-0 | yes | Homecoming row; ⚡ ability name / unlock / recharge | kitRows |
| Fuu | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Fuu | 0-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Fuu | 2-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Hana | 5-0-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Hana | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Hana | 0-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Hana | 2-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Ruri | 5-0-0 | yes | Familiar row; ⚡ ability name / unlock / recharge | kitRows |
| Ruri | 0-5-0 | yes | Familiar row; ⚡ ability name / unlock / recharge | kitRows |
| Ruri | 0-0-5 | yes | Familiar row; ⚡ ability name / unlock / recharge | kitRows |
| Ruri | 2-0-5 | yes | Familiar row; ⚡ ability name / unlock / recharge | kitRows |
| Noa | 5-0-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Noa | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Noa | 0-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Noa | 2-0-5 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Iroha | 5-0-0 | yes | Mirrors, Allies' shots, Mirror reach rows; ⚡ ability name / unlock / recharge | kitRows |
| Iroha | 0-5-0 | yes | Mirrors, Allies' shots, Mirror reach rows; ⚡ ability name / unlock / recharge | kitRows |
| Iroha | 0-0-5 | yes | Mirrors, Allies' shots, Mirror reach rows; ⚡ ability name / unlock / recharge | kitRows |
| Iroha | 2-0-5 | yes | Mirrors, Allies' shots, Mirror reach rows; ⚡ ability name / unlock / recharge | kitRows |
| Ena | 5-0-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Ena | 0-5-0 | yes | ⚡ ability name / unlock / recharge | kitRows |
| Ena | 0-0-5 | yes | Spirit Tether row; ⚡ ability name / unlock / recharge | kitRows |
| Ena | 2-0-5 | yes | Spirit Tether row; ⚡ ability name / unlock / recharge | kitRows |
| Azami | 5-0-0 | yes | Strips row; ⚡ ability name / unlock / recharge | kitRows |
| Azami | 0-5-0 | yes | Strips row; ⚡ ability name / unlock / recharge | kitRows |
| Azami | 0-0-5 | yes | Strips row; ⚡ ability name / unlock / recharge | kitRows |
| Azami | 2-0-5 | yes | Strips row; ⚡ ability name / unlock / recharge | kitRows |
| Kinu | 5-0-0 | yes | Pin ring row; ⚡ ability name / unlock / recharge | kitRows |
| Kinu | 0-5-0 | yes | Pin ring row; ⚡ ability name / unlock / recharge | kitRows |
| Kinu | 0-0-5 | yes | Pin ring row; ⚡ ability name / unlock / recharge | kitRows |
| Kinu | 2-0-5 | yes | Pin ring row; ⚡ ability name / unlock / recharge | kitRows |
| Wakaba | 5-0-0 | no (pure support) | Drink row; ⚡ ability name / unlock / recharge | kitRows, Boost to allies (unchanged) |
| Wakaba | 0-5-0 | no (pure support) | Drink row; ⚡ ability name / unlock / recharge | kitRows, Boost to allies (unchanged) |
| Wakaba | 0-0-5 | **no → yes** | Drink, Towel Snap rows; ⚡ ability name / unlock / recharge | kitRows, dealsDamage |
| Wakaba | 2-0-5 | **no → yes** | Drink, Towel Snap rows; ⚡ ability name / unlock / recharge | kitRows, dealsDamage |
| Yuzuha | 5-0-0 | yes | Sentries row; ⚡ ability name / unlock / recharge | kitRows |
| Yuzuha | 0-5-0 | yes | Sentries row; ⚡ ability name / unlock / recharge | kitRows |
| Yuzuha | 0-0-5 | yes | Sentries, Capture nets rows; ⚡ ability name / unlock / recharge | kitRows |
| Yuzuha | 2-0-5 | yes | Sentries, Capture nets rows; ⚡ ability name / unlock / recharge | kitRows |
| Ouka | 5-0-0 | no (pure support) | ⚡ ability name / unlock / recharge | kitRows, Boost to allies (unchanged) |
| Ouka | 0-5-0 | no (pure support) | ⚡ ability name / unlock / recharge | kitRows, Boost to allies (unchanged) |
| Ouka | 0-0-5 | no (pure support) | ⚡ ability name / unlock / recharge | kitRows, Boost to allies (unchanged) |
| Ouka | 2-0-5 | no (pure support) | ⚡ ability name / unlock / recharge | kitRows, Boost to allies (unchanged) |
| Chigusa | 5-0-0 | yes | Vines, Bloom Rush rows; ⚡ ability name / unlock / recharge | kitRows |
| Chigusa | 0-5-0 | yes | Vines, Thorn beds rows; ⚡ ability name / unlock / recharge | kitRows |
| Chigusa | 0-0-5 | yes | Vines, Harvest rows; ⚡ ability name / unlock / recharge | kitRows |
| Chigusa | 2-0-5 | yes | Vines, Harvest rows; ⚡ ability name / unlock / recharge | kitRows |
| Marumi | 5-0-0 | yes | Bowl row; ⚡ ability name / unlock / recharge | kitRows |
| Marumi | 0-5-0 | yes | Bowl row; ⚡ ability name / unlock / recharge | kitRows |
| Marumi | 0-0-5 | yes | Bowl row; ⚡ ability name / unlock / recharge | kitRows |
| Marumi | 2-0-5 | yes | Bowl row; ⚡ ability name / unlock / recharge | kitRows |
| Kohaku & Tsubaki | 5-0-0 | yes | Prism beam, Refraction rows; ⚡ ability name / unlock / recharge | kitRows |
| Kohaku & Tsubaki | 0-5-0 | yes | Prism beam, Refraction rows; ⚡ ability name / unlock / recharge | kitRows |
| Kohaku & Tsubaki | 0-0-5 | yes | Prism beam, Refraction rows; ⚡ ability name / unlock / recharge | kitRows |
| Kohaku & Tsubaki | 2-0-5 | yes | Prism beam, Refraction rows; ⚡ ability name / unlock / recharge | kitRows |
| Kogane (hero, Lv 25) | Lv 25 | yes | whole attack grid (Damage, Attacks/s, Range, Beams/Targets, Pierce, Splash, Crit, vs Elite/Boss, Aura, Mark, Ramp, Kills, Damage dealt), capability chips, Buffed by | hero More gets the girl grid (detailGrid) |
| Norika (hero, Lv 25) | Lv 25 | yes | whole attack grid (Damage, Attacks/s, Range, Beams/Targets, Pierce, Splash, Crit, vs Elite/Boss, Aura, Mark, Ramp, Kills, Damage dealt), capability chips, Buffed by; Barricades row | hero More gets the girl grid (detailGrid), kitRows |
