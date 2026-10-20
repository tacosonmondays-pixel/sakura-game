// Potential's player text (docs/specs/POTENTIAL.md, v3 §5 and §7): per girl and step P2…P6,
//   node   the six-node track's label (≤ 9 characters; the Info tab adds `stat · cap` under it)
//   long   what she gains, in full (tooltips, wiki, letter); it states every number in the step's data
//          (tests/data/potentialText.test.js)
//   power  the step's size on her scored measure: the median step E of the B1 bench
//          (tools/potentialBench.mjs) for the damage girls, the paper size of spec Appendix B where the
//          bench cannot see a step (a kept focus, an aura for others, Momo's coins); Power multiplies
//          them, gate B5 compares their product with the bench (±10 %)
//   fx     the render cue (attack FX, V4)
// UI-only: imported by src/systems/potential.js and the screens, never by the sim, so it is outside
// the co-op graph and the data hash (a wording fix never changes the co-op id).

const t = (node, long, power, fx) => Object.freeze({ node, long, power, fx });
const row = (...steps) => Object.freeze(steps);

export const POTENTIAL_TEXT = Object.freeze({
  kage: row(
    t('+4% SPD', '+4% attack speed.', 1.04, 'rim'),
    t('SHURIKEN+', '+5% attack speed. Every throw carries 8% more shuriken (Thousand Shadows 13 → 14.04 on average; Blade Rain 7 → 7.56; on a 2-shuriken build a 3rd shuriken about every 6th throw), and they ignore 1 more armor.', 1.13, 'kage.moon'),
    t('TEMPO', '+5% attack speed. Every throw in an unbroken run makes the next one 1% faster, up to +6% after 6 throws; it fades after 1 s without a throw.', 1.11, 'kage.tempo'),
    t('PIERCE+1', '+6% attack speed. Every shuriken passes through 1 more enemy (2 → 3; Kusarigama 6 → 7; Thousand Shadows 5 → 6).', 1.22, 'kage.edge'),
    t('STORM', '+7% attack speed. Every 8th throw is a Shuriken Storm: a ring of shadow clones throws the whole volley again at once.', 1.20, 'kage.storm'),
  ),
  aoi: row(
    t('+4% DMG', '+4% damage.', 1.04, 'rim'),
    t('PEN+CRIT', '+4% attack speed. Her arrows ignore 1 more armor and crit 3% more often (5 → 8% at tier 0).', 1.06, 'aoi.through'),
    t('CRIT+6%', '+4% damage; +6% crit chance (8 → 14% at tier 0; Apex Huntress 28 → 34% at ×3).', 1.09, 'aoi.crit'),
    t('TWIN 1/12', '+4% attack speed. Every 12th volley she looses the whole volley twice (1 arrow → 2; Thousand Feathers 6 → 12).', 1.12, 'aoi.twin'),
    t('HAWK', '+5% damage. Twin Fletch comes every 10th volley, and on it her hawk dives on her first target for one more volley\'s damage (her hit × her arrows; it can crit).', 1.12, 'aoi.hawk'),
  ),
  rei: row(
    t('+4% DMG', '+4% damage.', 1.04, 'rim'),
    t('3RD STEP', '+4% attack speed. Every 4th sweep (or duel strike) cuts 15% harder and staggers everything it hits for 0.3 s (bosses take a quarter; Freeplay\'s stagger budget applies).', 1.08, 'rei.third'),
    t('CRIT+5%', '+4% damage; +5% crit chance (0 → 5% at tier 0; Final Crescent 25 → 30% at ×3).', 1.08, 'rei.crit'),
    t('BREAK', '+4% attack speed. Third Step cuts 50% harder (instead of 15%) and cracks 1 armor for 3 s (stacks ×3, for every girl).', 1.15, 'rei.break'),
    t('TWIN CUT', '+5% damage. After every Third Step a returning crescent sweeps the same reach for 30% of it (in Duelist stance, a 30% follow-up strike that adds no focus stack).', 1.16, 'rei.twin'),
  ),
  yuki: row(
    t('+4% SPD', '+4% attack speed.', 1.04, 'rim'),
    t('DEEPCHILL', '+4% damage. Her slows are 5 points stronger and 1 s longer (30%/1.5 s → 35%/2.5 s; Eternal Winter 62 → 67%; the 90% cap stays).', 1.04, 'yuki.drift'),
    t('BRITTLE', '+4% attack speed. Everything she hits turns Brittle +5% (damage from everyone) for 2 s (on Frostbite it adds 5 points: Diamond Dust 45 → 50%).', 1.08, 'yuki.snap'),
    t('FLURRY', '+4% damage. Every 5th throw (or blizzard pulse) is a Flurry: 30% harder, +0.3 splash and a sure 0.4 s freeze on everything it hits (bosses take a quarter; her own freeze chance still rolls).', 1.11, 'yuki.flurry'),
    t('GLASS', '+5% attack speed. Flurry comes every 4th throw, hits 50% harder, and leaves everything it hits Brittle +10% for 3 s.', 1.16, 'yuki.glass'),
  ),
  momo: row(
    t('+3% COIN', '+3% coins per wave.', 1.03, 'momo.coin'),
    t('+10% LOOT', '+3% coins per wave. Enemies defeated inside her range pay 10% more coins (the strongest Momo only; it also works on Nightmare, where wave income is off).', 1.03, 'momo.pouch'),
    t('LUCKY 1/8', '+4% coins and +4% attack speed. Every 8th flick is a lucky coin that hits 3× as hard.', 1.04, 'momo.lucky'),
    t('HARVEST', '+4% coins. Every 8th wave clear she pays her wave income a second time.', 1.17, 'momo.harvest'),
    t('FESTIVAL', '+4% coins. Golden Harvest every 6th wave clear; a lucky coin every 6th flick, 4× as hard.', 1.08, 'momo.festival'),
  ),
  akane: row(
    t('+4% DMG', '+4% damage, shells and burn.', 1.04, 'rim'),
    t('SPREAD', '+5% attack speed. When an enemy burning from her falls, the fire leaps to the nearest enemy within 1.2 tiles (twice at most); her burns last 1 s longer.', 1.08, 'akane.leap'),
    t('SKYBURST', '+5% damage and burn. Her shells also burst in the sky (she hits flyers on every path; her Wildfire, Big Bang and Rocket paths already can), and every 8th shell is a Starburst: 50% harder with a blast 0.4 tiles wider.', 1.13, 'akane.starburst'),
    t('GRANDSTAR', '+6% attack speed. Starburst every 6th shell: twice as hard, a blast 0.6 tiles wider, and its burn 50% stronger.', 1.20, 'akane.grand'),
    t('MIDSUMMER', '+7% damage and burn. Every Starburst blooms twice: a second firework follows it at once for half its power.', 1.22, 'akane.bloom'),
  ),
  sango: row(
    t('+4% DMG', '+4% damage.', 1.04, 'rim'),
    t('SHRED+1', '+5% attack speed. Every shell cracks 1 armor for 3 s (stacks ×3, for every girl; on Armor-Breaker it adds 1: Fortress Fall 6 → 7, team −21).', 1.08, 'sango.chisel'),
    t('CORAL 1/6', '+5% damage. Every 6th shell is a Coral Shell: 40% harder, with a blast 0.3 tiles wider.', 1.13, 'sango.coral'),
    t('CORAL 1/4', '+6% attack speed. Coral Shell every 4th shell: 80% harder, a blast 0.4 tiles wider, and it Soaks everything it hits for 4 s (+15% frost and lightning damage).', 1.20, 'sango.barrage'),
    t('SEADRAGON', '+7% damage. Coral Shell every 3rd shell, and it leaves everything it hits Brittle +10% for 3 s.', 1.21, 'sango.dragon'),
  ),
  umeko: row(
    t('+3% AURA', 'Girls in her aura attack 3% faster.', 1.03, 'rim'),
    t('WIDE AURA', 'Aura +3% attack speed and 0.4 tiles wider (3.0 → 3.4 with her awakening; Sea of Lanterns 6 → 6.4).', 1.03, 'umeko.wide'),
    t('AURA PEN', 'Aura +3% attack speed; girls in her aura ignore 1 more armor (Sea of Lanterns 3 → 4); aura 0.3 tiles wider again.', 1.06, 'umeko.lanterns'),
    t('CRIT AURA', 'Aura +3% attack speed; girls in her aura get +6% crit chance (Blooming Ocean 10 → 16%).', 1.09, 'umeko.petals'),
    t('WAVE 1/3', 'Aura +3% attack speed. Every 3rd pulse, girls in her aura attack a further 15% faster for 3 s.', 1.12, 'umeko.wave'),
  ),
  shiro: row(
    t('+4% DMG', '+4% damage.', 1.04, 'rim'),
    t('MARK+6%', '+5% damage. Her shots mark: the target takes +6% damage from everyone for 3 s (on Spotter\'s Mark it adds 6 points: Overwatch 50 → 56%).', 1.09, 'shiro.scope'),
    t('CRIT+5%', '+5% attack speed; +5% crit chance (20 → 25% with her awakening).', 1.09, 'shiro.crit'),
    t('OVERPEN', '+6% damage. Her rounds ignore 2 more armor, and every 5th shot is a Silver Line round that goes through 2 more enemies.', 1.17, 'shiro.line'),
    t('HERON', '+7% attack speed. Silver Line comes every 4th shot as a White Heron round: 50% harder, and it still goes through 2 more enemies.', 1.27, 'shiro.heron'),
  ),
  midori: row(
    t('+4% DMG', '+4% damage, flask and poison.', 1.04, 'rim'),
    t('BRITTLE', '+5% attack speed. Her splash leaves enemies Brittle +5% for 3 s (on Corrosion it adds 5 points: Universal Solvent 30 → 35%).', 1.10, 'midori.tonic'),
    t('EVERGREEN', '+5% damage and poison. Her poison lasts 1 s longer and also eats 0.05% of max HP a second (bosses 0.005%; adds to Toxicology\'s 0.25%).', 1.11, 'midori.venom'),
    t('CAULDRON', '+6% attack speed. Every 6th flask is a Cauldron Bomb: 50% harder, 0.4 tiles wider, and its poison 50% stronger.', 1.17, 'midori.cauldron'),
    t('+1 BREW', '+7% damage and poison. Her brew reaches 1 more girl (never more than 4: Toxic Tonic and Acid Edge 3 → 4, Swift Draught stays 4), and Cauldron Bomb comes every 5th flask.', 1.09, 'midori.batch'),
  ),
  suzu: row(
    t('+4% DMG', '+4% trap damage (whole-girl damage reaches traps).', 1.04, 'rim'),
    t('+1 TRAP', 'Sets traps 5% faster. One more trap at once (6 → 7 with her awakening), and her traps slow by 20% for 1.5 s (on Binding it adds 20 points).', 1.08, 'suzu.seals'),
    t('BELL 1/10', '+5% trap damage. Every 10th trap that goes off is a temple bell: 50% harder, with a blast 0.3 tiles wider.', 1.10, 'suzu.bell'),
    t('BIG BELL', 'Sets traps 6% faster. Temple Bell every 5th trap: 60% harder, a blast 0.4 tiles wider, and it silences for 1 s.', 1.13, 'suzu.peal'),
    t('BELL ECHO', '+7% trap damage. One more trap again (+2 in all), and Temple Bell comes every 4th trap: 80% harder, and it leaves everything it hits Brittle +10% for 3 s.', 1.20, 'suzu.evening'),
  ),
  raika: row(
    t('+4% DMG', '+4% damage.', 1.04, 'rim'),
    t('+1 JUMP', '+5% attack speed. One more jump (4 → 5 with her awakening), and her lightning ignores 1 more armor.', 1.08, 'raika.branch'),
    t('COLUMN', '+5% damage. Every 6th cast drops a thunder column on her first target: 25% of her hit to everything within 0.9 tiles.', 1.13, 'raika.column'),
    t('THUNDER', '+6% attack speed. The column comes every 5th cast, hits for 40% within 0.8 tiles, and stuns for 0.3 s (sure; bosses take a quarter).', 1.14, 'raika.thunderhead'),
    t('MONSOON', '+7% damage. One more jump again; Thunderhead every 4th cast, and it Soaks what it hits for 3 s (Soaked foes take +15% lightning and frost, her own chain included).', 1.26, 'raika.monsoon'),
  ),
  miko: row(
    t('+3% AURA', 'Her aura\'s damage bonus grows by 3% (+10% → +13.3% at tier 0), and her talismans hit 4% harder.', 1.03, 'rim'),
    t('AURA PEN', 'Aura +3% damage; girls in her aura ignore 1 more armor (Goddess\'s Festival 4 → 5); she throws 5% faster.', 1.06, 'miko.bells'),
    t('WIDE AURA', 'Aura +3% damage and 0.4 tiles wider (Goddess\'s Festival 4.2 → 4.6); her talismans +5% damage.', 1.04, 'miko.steps'),
    t('SACRED', 'Aura +3% damage; enemies inside her aura are Brittle +6% (damage from everyone); she throws 6% faster.', 1.09, 'miko.rope'),
    t('FEST BELL', 'Aura +3% damage; her talismans +7% damage. Every 4th talisman (or beam pulse) rings the festival bells: girls in her aura deal a further 10% for 3 s.', 1.09, 'miko.festival'),
  ),
  nami: row(
    t('SLOW+5', '+4% damage. Her slows are 5 points stronger (20 → 25% at tier 0; 30 → 35% with her awakening).', 1.04, 'rim'),
    t('SOAK', '+5% attack speed. Her orbs Soak for 2 s: Soaked foes take +15% frost and lightning damage (her own orbs too).', 1.17, 'nami.soak'),
    t('TIDE+15%', '+5% damage; Tidal Wave recharges 15% faster.', 1.05, 'nami.legs'),
    t('HIGHWATER', '+6% attack speed. Tidal Wave hits 50% harder, Soaks every enemy for 6 s and leaves them Brittle +10% for 4 s (rank 3: +15% for 6 s → +25% for 10 s).', 1.06, 'nami.highwater'),
    t('TIDECROWN', '+6% damage. Every 5th orb swells into a Tide Crown: 50% harder, +0.5 splash, and a sure 0.4 s freeze.', 1.18, 'nami.crown'),
  ),
  hotaru: row(
    t('FIREFLIES', '+5% damage. On every path, girls within 2.6 tiles deal +6% damage (her own aura multiplies: Guiding Lights 5\'s +38% → +46%).', 1.05, 'hotaru.lamps'),
    t('+1 & MARK', '+7% attack speed. Her pulse hits 1 more enemy (8 → 9) and marks them: +5% damage from everyone for 3 s.', 1.16, 'hotaru.parade'),
    t('HOLY×1.2', '+7% damage. Her pulses deal 20% more to spectral enemies (ghosts, wraiths, the Grave Lych, the Gloom Regent: holy ×2 → ×2.4) and leave struck foes Brittle +6% for 3 s.', 1.11, 'hotaru.rite'),
    t('HUNDRED', '+8% attack speed. Every 4th pulse reaches 1 tile further, hits 40% harder and silences 1 s longer.', 1.20, 'hotaru.hundred'),
    t('MIDNIGHT', '+9% damage. Her firefly aura gains another 6% (to +12%; Guiding Lights 5: +55%); Hundred Lanterns comes every 3rd pulse, hits 80% harder, and leaves everything Brittle +8% for 3 s.', 1.27, 'hotaru.midnight'),
  ),
  kaede: row(
    t('LEAF MEM', '+5% damage. When her target falls she keeps half her focus for the next one; switching targets by choice still resets it.', 1.13, 'kaede.memory'),
    t('FOCUS+2%', '+7% attack speed. Her focus builds 2% faster per strike (12 → 14% per hit with her awakening).', 1.09, 'kaede.breeze'),
    t('SCARLET', '+7% damage. Her focus cap rises 30 points (+100 → +130% at tier 0; Crimson Eternity +320 → +350%), and +5% crit chance.', 1.17, 'kaede.scarlet'),
    t('MAPLEGALE', '+8% attack speed. Every 4th strike also cuts the enemies right beside her target (within 0.1 tiles; an unfocused hit at her plain damage, like her duel splash).', 1.28, 'kaede.gale'),
    t('ONE FOE', '+9% damage. She deals 20% more to bosses and minibosses (Crimson Eternity ×1.5 → ×1.8). Maple Gale comes every 3rd strike, and the Gale strike on her target hits 50% harder (her focus still counts; the cut beside it stays at her plain damage).', 1.31, 'kaede.onefoe'),
  ),
  chika: row(
    t('THROTTLE', '+5% damage (drones and bolt). Every 30 s from when she is placed, her drones fire 50% faster for 4 s.', 1.12, 'chika.throttle'),
    t('PEN+1', '+7% attack speed (drones fire and build faster). Drones reach 0.3 tiles further, and she and her drones ignore 1 more armor.', 1.11, 'rim'),
    t('THROTTLE+', '+7% damage. Throttle Up comes every 25 s, lasts 6 s, and makes her drones fire 60% faster.', 1.15, 'chika.overhaul'),
    t('+1 DRONE', '+8% attack speed. One more drone (3 → 4 with Mk-II; Mecha-Fortress 10 → 11), and drone hits crack 1 armor for 3 s (stacks ×3, for every girl).', 1.21, 'chika.wing'),
    t('UPLINK', '+9% damage. Throttle Up every 20 s, with drones firing 75% faster; her tune-up links 1 more girl (Signal Tower 1 → 2, Grand Workshop 2 → 3).', 1.17, 'chika.uplink'),
  ),
  hikari: row(
    t('SUNRISE', '+5% damage. Every 6th sweep is a Sunrise: 50% harder.', 1.14, 'hikari.sunrise'),
    t('BLOOM+10%', '+7% damage; Celestial Bloom recharges 10% faster.', 1.07, 'rim'),
    t('SUN 1/5', '+7% attack speed. Sunrise every 5th sweep, 75% harder.', 1.14, 'hikari.drill'),
    t('HIGH SUN', '+8% damage. Celestial Bloom reaches 1 tile further, hits 75% harder, and leaves every foe Brittle +15% for 6 s (rank 3: +15% for 6 s → +30% for 12 s).', 1.08, 'hikari.highsun'),
    t('2ND SUN', '+9% attack speed; Bloom recharges a further 10%. Sunrise every 4th sweep, twice as hard, with a sure 0.3 s stun.', 1.19, 'hikari.second'),
  ),
  luna: row(
    t('PIERCE+2', '+5% damage. Every beam pierces 2 more enemies (3 → 5 at Lv 1).', 1.08, 'luna.long'),
    t('MOON+10%', '+7% damage; Moonfall recharges 10% faster.', 1.07, 'rim'),
    t('HASTE+', '+7% attack speed. Moonfall\'s haste lasts 3 s longer and is 5 points stronger (rank 3: +40% for 10 s → +45% for 13 s), for every girl on the map, a partner\'s included.', 1.07, 'luna.pace'),
    t('TIDELOCK', '+8% damage. Moonfall recharges a further 10%, its slow lasts 2 s longer, and it leaves every enemy Brittle +15% for 8 s.', 1.08, 'luna.tidelock'),
    t('ECLIPSE', '+9% attack speed. Moonfall\'s haste is 5 points stronger again (+50%), and girls within 3 tiles of her get +8% damage and attack speed at every level.', 1.09, 'luna.eclipse'),
  ),
});

/** A def's text row (kit variant first), or null (fixtures and dev units). */
export function potentialTextRow(def) {
  if (!def) return null;
  return (def.kitStyle && POTENTIAL_TEXT[`${def.id}@${def.kitStyle}`]) || POTENTIAL_TEXT[def.id] || null;
}
