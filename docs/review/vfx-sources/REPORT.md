# VFX sources and gaps (Nov 3)

**Answer for the owner**
No. No engine or preset pack gives us tornado-quality water, electricity and beams if we just drop it in. The tools with editors and presets (Effekseer, three.quarks, Nebula, NewKrok, NixieFX) are MIT, but they are particle libraries, which your rule bans as a dependency. Out of the box they also look like soft glowing particles, not inked toon shapes. The one cel-shade editor that comes close to our look (cel-lab) is GPL, so it is out.

What we can use is parts. CC0 textures (Kenney, Screaming Brain, Effekseer's CC0 samples) work as shape masks. MIT and CC0 shader snippets cover noise, shapes, toon fire, foam and energy beams. Effekseer's samples are a good guide to timing. The look itself we build the way we built the tornado, and that is what makes it ours. The plan: one shared toon core first, then water splash, electricity and beams, then deaths, explosions and casts.

**Use now** (credits go in `public/licenses/<name>-<SPDX>.txt`, like feather and lucide)
- **Code we can port or adapt:**
  - three.js TSL tornado and flames maths (MIT)
  - webgl-noise cellular (MIT, Ashima/Gustavson)
  - psrdnoise (MIT, stated in the README only)
  - FastNoiseLite JS port, run at load only (MIT)
  - glsl-worley (MIT)
  - iq SDF and voronoi snippets (MIT)
  - three-stdlib lightning branching rules, re-implemented (MIT)
  - postprocessing ShockWave idea, re-written ourselves (Zlib)
  - cortiz stylized-components ripple and sparkle GLSL (MIT)
  - Unity Open Project 1 step-erosion and dissolve graphs (Apache-2.0)
  - GDQuest shader code only (MIT; its art is CC BY-NC-SA)
  - gtibo Godot 4 sketchbook (MIT, stated in readme.md only)
  - Cyanilux graphs (CC0)
- **godotshaders posts, tag re-read on each page:**
  - Cartoon 3D Fire (CC0)
  - Energy Beams (CC0)
  - Lightning (CC0)
  - Metaballic Splash (MIT)
  - Hexagon Shield and Swirl portal (CC0)
  - Energy shield (MIT)
- **Textures (CC0):** Kenney Particle and Smoke packs, Screaming Brain noise packs, Effekseer CC0 samples (skip the "Old" set and any unreferenced textures), the Brackeys bundle and RPicster textures, the OpenGameArt explosion sheet.
- **Needs the owner's yes:** Roystan ToonWater is under the Unlicense, which is public domain but not on his list.

**Study only** (MIT, but shipping any of these would break the no-particle-library rule)
- Effekseer runtime, three.quarks, three-nebula, three-particles, wawa-vfx (the vanilla build is a package inside the main repo), NixieFX, composer-suite, TSLFX (needs WebGPU), bevy_hanabi
- Look references with no code to take: Alisavakis' beam breakdown (no licence stated), the Adriano Delia toon .blend (CC0, but some node groups credit someone else)

**Not usable**
- cel-lab (GPL-3.0)
- No licence at all: three-particles-editor, cortiz flow-shield, charged-blast and hologram, gtibo's Godot 3 sketchbook
- KanaWorks (custom licence)
- BabylonJS Assets and Ronja tutorials (CC BY 4.0, not on the list)
- The Book of Shaders (all rights reserved)
- Shadertoy defaults and any "Shadertoy port" post
- GDQuest art and Effekseer's "Old" samples

**Fit with the house look:** the noise-cut-by-threshold sources bend to the tornado look: TSL tornado, Cartoon Fire, Cyanilux, Open Project, Roystan, Energy Beams and the Metaballic clip. Noise and SDF libraries are neutral inputs. The Kenney, Effekseer and Brackeys masks turn crisp once they go through our hard step and ramp, and the darkest band becomes the ink rim. The particle engines, realistic water, volume fire and realistic flipbooks can't be bent to it.

**Batch plan** (each batch: one instanced draw call per layer kind, nothing drawn when idle, graphics tiers, Reduce Motion, flash guard, a dev lab panel, a phone frame-time check, and an owner board)

| # | Batch | Size | External pieces | Upgrades |
|---|---|---|---|---|
| B0 | Shared toon core: the tornado fragment (noise, erosion, ramp, blend, tiers, Reduce Motion) as a shared chunk, plus a Worley F2-F1 channel and a baked swirl channel | M | webgl-noise or FastNoiseLite, psrdnoise, iq (all MIT) | none on its own; every later batch needs it |
| B1 | Water splash: ring crown with a noise lip that erodes into droplets, droplets that merge by clip, a foam ring and ripples | M | Metaballic idea (MIT), Cyanilux foam (CC0), Roystan (pending the owner), cortiz ripples (MIT), Effekseer Splash01 or Kenney mask (CC0) | Nami, Sango, Umeko, Wakaba, Ruri's otter, Tidebreaker, Frost Net |
| B2 | Electricity crackle and auras: micro-bolts re-struck round bodies, an electric ground decal, shock crackle on enemies, Drumstorm and Drone Surge casts | M | three-stdlib rules (MIT), FencerDevLog Lightning (CC0), Effekseer Thunder01 timing (CC0) | Raika, Chika, Seiran, Yuzuha, Tenka, every shocked enemy |
| B3 | Beams: held beams moved onto beams.js, a band per colour for the prism beam, charge-up and impact crown | S–M | Energy Beams (CC0), GDQuest laser (MIT code) | Umeko, Luna, Kohaku & Tsubaki; polishes Miko and Raika |
| B4 | Enemy death poof and hit sparks | S–M | Open Project dissolve (Apache), Kenney Smoke masks (CC0) | every kill and every hit |
| B5 | Explosions and blasts | M | Cyanilux dissolve (CC0), Kenney explosion masks (CC0), gtibo structure (MIT) | Akane, Sango, Midori, Marumi, Kohaku & Tsubaki, volatile enemies |
| B6 | Cast circle plus the sakura and vortex columns | M | iq SDFs (MIT), procedural magic circle (MIT) | 34 casts, starting with Yuki, Rei, Raika, Tenka |
| B7 | Held flame stream, with frost and steam variants | S–M | Cartoon 3D Fire (CC0, plus the MIT notices inside it) | Akane T5, later Kinu and Yuki |
| B8 | Ice | M | Screaming Brain cracked noise at 128 px (CC0) | Yuki, Nami, every freeze |
| B9 | Hero map ultimates: tidal wave, sun bloom, moonfall | L | builds on B1 and B6 | Nami, Yoriko, Hikari, Luna |
| B10 | Shields, portals, heals, buffs, mist, smoke, boss phases | L, split | Hexagon Shield and Swirl portal (CC0), Energy shield (MIT) | bosses, ward enemies, Noa, Miko, Midori, Ena |

Order: B0, then B1, B2 and B3 (the owner named them), then B4 through B10.
