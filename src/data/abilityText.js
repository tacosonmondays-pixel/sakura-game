// Ability player text (ABILITIES_SPEC §5, §8, §10): per ability id,
//   name   what the button and the hold card call it (unique in the game: tests/data/abilities.test.js)
//   icon   a glyph key of src/art/icons/glyphs.js (the hold card and the ⚡ chip; the bar shows her portrait)
//   desc   the hold card / student page description; {placeholders} come from abilityValues()
//   short  one plain phrase for the ⚡ tier-3 row and a hero's Lv 7 line ("unlocks Skyfall Volley: …")
//   up     the tier-5 row / a hero's Lv 17 line, filled from the upgraded definition
//   aim    (optional) how a tap aims it in battle (src/ui/battle/aimControl.js 'ability' mode): 'girl' = the
//          next board tap picks a girl (the sim's girl-target rule), 'point' = a point on the map. Rows without
//          it cast at once. Only abilities whose cast reads an aim carry it; auto-cast never aims.
// UI-only: never imported by the sim, so it is outside the co-op graph and the data hash (a wording
// fix never changes the co-op id), like potentialText.js. The numbers live in src/data/abilities.js.

const t = (name, icon, desc, short, up, aim = null) => Object.freeze(aim ? { name, icon, desc, short, up, aim } : { name, icon, desc, short, up });

/** The aim kinds a text row may name. */
export const ABILITY_AIMS = Object.freeze(['girl', 'point']);

export const ABILITY_TEXT = Object.freeze({
  // heroes (Lv 7 skill, rank 2 at Lv 17)
  'hikari.rally': t('Morning Rally', 'cleanse',
    'Girls within {radius} tiles of her attack +{rateMulPct}% faster for {dur}s. It clears sabotage at once and blocks new sabotage while it lasts.',
    'a rally that speeds up and protects the girls around her',
    'Morning Rally reaches {radius} tiles with +{rateMulPct}% speed for {dur}s and recharges in {cd}s.'),
  'luna.moonbrand': t('Moonbrand', 'mark',
    'The {count} strongest enemies on the map are marked for {mark}s: they take +{markPct}% damage from everyone.',
    'marks the strongest enemies for the whole team',
    'Moonbrand marks {count} enemies for +{markPct}% and recharges in {cd}s.'),
  'nami.frostNet': t('Frost Net', 'freeze',
    'A net of frost falls on the densest crowd in her range: everything within {radius} tiles is frozen for {freeze}s and soaked for {soak}s.',
    'a frost net that freezes a whole crowd',
    'Frost Net spreads {radius} tiles, freezes for {freeze}s and recharges in {cd}s.'),
  // the returning heroes
  'kanna.heavyBeat': t('Heavy Beat', 'shred',
    'For {dur}s her strikes crack {shred} armor on every enemy within {radius} tiles of her target and stagger them for {stun}s.',
    'a drum beat that cracks the armor around her target',
    'Heavy Beat cracks {shred} armor for {dur}s and recharges in {cd}s.'),
  'yoriko.puppetHex': t('Puppet Hex', 'puppeteer',
    'The strongest enemy within {reach} tiles is hexed for {hex}s: it loses {hexPct}% of its max HP a second (minibosses and bosses less, and one hex takes at most a tenth of theirs), cannot regenerate and is slowed {slowPct}%.',
    'a hex that drains the strongest enemy near her',
    'Puppet Hex hexes the {count} strongest enemies for {hex}s and recharges in {cd}s.'),
  'seiran.stormLance': t('Storm Lance', 'chain',
    'She throws her lance at an enemy in her range and it chains on through {count} enemies, the nearest one each time: {dmg} damage each, and the flyers it hits are grounded for {ground}s.',
    'a thrown lance that chains through a crowd',
    'Storm Lance chains through {count} enemies at {dmgMul}× her hit and recharges in {cd}s.'),

  // towers (tier 3 of the ⚡ path, upgraded at tier 5)
  'aoi.skyfall': t('Skyfall Volley', 'pierce',
    'Rains arrows on up to {count} enemies within {reach} tiles, picked by her target mode: {dmg} damage each and a {stun}s pin.',
    'an arrow rain that pins the front of a wave',
    'Skyfall Volley grows to {count} arrows at {dmgMul}× her hit and recharges in {cd}s.'),
  'rei.hurricane': t('Hurricane Draw', 'spiral',
    'For {dur}s she attacks {rateMul}× as fast with +{range} reach, and every sweep hits every enemy in it.',
    'a blade hurricane that hits everything in reach',
    'Hurricane Draw lasts {dur}s at {rateMul}× speed with +{range} reach and recharges in {cd}s.'),
  'yuki.whiteout': t('Whiteout', 'snow',
    'Every enemy within {radius} tiles of her is frozen for {freeze}s (bosses for far less; frost wards are immune) and slowed {slowPct}% for {slow}s.',
    'a whiteout that freezes every enemy around her',
    'Whiteout reaches {radius} tiles, freezes for {freeze}s, slows {slowPct}% for {slow}s and recharges in {cd}s.'),
  'momo.marketDay': t('Market Day', 'coin',
    'Earns {coins} coins at once (scaled by the difficulty\'s coin rate), at most twice per wave and never on Nightmare.',
    'coins on demand, twice per wave',
    'Market Day pays {coins} coins and recharges in {cd}s.'),
  'akane.starmine': t('Starmine Barrage', 'sparkle',
    'After warning rings, {shells} firework shells fall on the densest crowd within {reach} tiles, one every {every}s: {dmg} damage each in a {radius}-tile blast that knocks enemies back {knockback} tiles.',
    'a firework barrage on the thickest crowd',
    'Starmine Barrage fires {shells} shells at {dmgMul}× her hit that also strike flyers, and recharges in {cd}s.'),
  'sango.tidebreaker': t('Tidebreaker Shell', 'blast',
    'A heavy shell lands on the densest crowd within {reach} tiles: {dmg} damage in a {radius}-tile blast, a {knockback}-tile knockback (bosses stand firm) and a {stun}s stun.',
    'a heavy shell that blasts a crowd back up the road',
    'Tidebreaker Shell fires {shells} shells {every}s apart, each aimed at the crowd anew, and recharges in {cd}s.'),
  'kage.doubles': t('Shadow Doubles', 'skirmisher',
    '{count} shadow doubles appear on the road spots nearest the exit in her range and throw her volley at {dmgMulShare}% damage for {dur}s.',
    'shadow doubles that guard the exit',
    'Shadow Doubles brings {count} doubles at {dmgMulShare}% damage for {dur}s and recharges in {cd}s.'),
  'umeko.flare': t('Lantern Flare', 'reveal',
    'Every veiled enemy on the map is revealed for {reveal}s, and girls inside her aura gain Veil Sight and +{rangeMulPct}% range for {dur}s.',
    'a flare that reveals every veiled enemy on the map',
    'Lantern Flare reveals for {reveal}s, girls in her aura gain +{rangeMulPct}% range and +{dmgMulPct}% damage, and it recharges in {cd}s.'),
  'shiro.verdict': t('Verdict Round', 'crosshair',
    'A reticle marks up to {count} enemies anywhere on the map (casters first, then bosses, elites and the strongest); {delay}s later each takes {dmg} damage that ignores armor.',
    'armor-piercing shots on the biggest threats, anywhere on the map',
    'Verdict Round marks {count} targets for {dmgMul}× her hit and recharges in {cd}s.'),
  'midori.catalyst': t('Catalyst Burst', 'flask',
    'Every poisoned enemy within {reach} tiles takes all its remaining poison at once, ×{poisonMul}, and the poison ends; enemies within {splash} tiles of each burst take half.',
    'detonates every poison around her at once',
    'Catalyst Burst deals ×{poisonMul}, each burst poisons its neighbours for {spreadPoison}s, and it recharges in {cd}s.'),
  'suzu.bellCarpet': t('Bell Carpet', 'bomb',
    '{count} extra bell mines spread along the road in her range, armed after {arm}s and beyond her trap limit. Each fires once; the rest fizzle after {dur}s.',
    'a carpet of extra mines along the road',
    'Bell Carpet lays {count} mines that last {dur}s and recharges in {cd}s.'),
  'raika.drumstorm': t('Drumstorm', 'bolt',
    'For {dur}s she attacks {rateMul}× as fast, her lightning jumps {chain} more times and every jolt shocks for {shock}s.',
    'a few seconds of faster, wider, shocking lightning',
    'Drumstorm lasts {dur}s at {rateMul}× speed with {chain} more jumps and recharges in {cd}s.'),
  'miko.chorus': t('Shrine Chorus', 'buff',
    'Every girl within {radius} tiles of her, your ally\'s too, deals +{dmgMulPct}% damage and attacks +{rateMulPct}% faster for {dur}s, on top of auras.',
    'a chorus that powers up every girl near her',
    'Shrine Chorus reaches {radius} tiles with +{dmgMulPct}% damage and +{rateMulPct}% speed for {dur}s, and recharges in {cd}s.'),
  'hotaru.hush': t('Firefly Hush', 'silence',
    'Every enemy on the map (except in tunnels) is silenced for {silence}s and revealed for {reveal}s; casters are also stunned for {casterStun}s.',
    'a hush that silences the whole map',
    'Firefly Hush silences for {silence}s, slows {slowPct}% for {slow}s and recharges in {cd}s.'),
  'kaede.flashLunge': t('Flash Lunge', 'slash',
    'She flashes through the {count} enemies her target mode picks within {reach} tiles and strikes each {hits} times at full ramp: {dmg} damage each. Her ramp stays on the first.',
    'a flash of full-ramp strikes through a crowd',
    'Flash Lunge cuts {count} enemies {hits} times each and recharges in {cd}s.'),
  'tenka.criticalMass': t('Critical Mass', 'blast',
    'A plasma blast on the strongest enemy within {reach} tiles: {dmg} damage that ignores armor, and every enemy within {splash} tiles of it takes the blast too.',
    'a plasma blast on the strongest enemy in her range',
    'Critical Mass hits for {dmgMul}× her hit in a {splash}-tile blast and recharges in {cd}s; after each cast her bolts fire {rateMul}× as fast for {afterDur}s.'),
  'chika.droneSurge': t('Drone Surge', 'summon',
    '{count} extra drones launch for {dur}s, beyond her limit. They follow her flight mode, then dock and vanish.',
    'a surge of extra drones',
    'Drone Surge launches {count} drones for {dur}s and recharges in {cd}s.'),

  // the new girls (UNIT_GAPS §5)
  'azami.spikeRain': t('Spike Rain', 'trap',
    '{count} extra spike strips land evenly along the road within {reach} tiles, beyond her strip limit: {hits} hits each, armed after {arm}s. They fold up after {dur}s.',
    'a burst of extra strips along her whole road',
    'Spike Rain lays {count} strips within {reach} tiles that last {dur}s, and recharges in {cd}s.'),
  'kinu.bladeSpiral': t('Blade Spiral', 'spiral',
    'For {dur}s she also throws two blades every 0.1s along a turning spiral, out to twice her range: each hits like a pin and pierces {spiralPierce} enemies.',
    'a turning spiral of blades on top of her rings',
    'Blade Spiral becomes {spiral} spirals turning opposite ways for {dur}s, blades piercing {spiralPierce}, and recharges in {cd}s.'),
  'wakaba.timeOut': t('Time Out!', 'buff',
    'One girl gets {rateMul}× attack speed and +{rangeMulPct}% range for {dur}s: the one you aim at, or the girl in her range who has dealt the most damage. A partner\'s girl may be chosen.',
    'a big, short power-up on one girl you pick',
    'Time Out! also gives +{dmgMulPct}% damage, lasts {dur}s and recharges in {cd}s.', 'girl'),
  'yuzuha.emergencyDeploy': t('Emergency Deploy', 'summon',
    '{count} extra sentries drop at the road\'s edge where you aim, or around the lead enemy in her range, with her current sentry stats. They last {dur}s, beyond her sentry limit.',
    'extra sentries at once, where you need them',
    'Emergency Deploy drops {count} sentries for {dur}s and recharges in {cd}s.', 'point'),
  'ouka.assemblyBell': t('Assembly Bell', 'buff',
    'Every girl on the map, your ally\'s too, attacks +{rateMulPct}% faster and pierces {pierceAdd} more enemy for {dur}s, on top of auras.',
    'a short map-wide team rally',
    'Festival of Clubs: Assembly Bell gives +{rateMulPct}% speed and {pierceAdd} more pierce for {dur}s, and recharges in {cd}s.'),
  'marumi.giantStrike': t('Giant Strike', 'bowler',
    'A giant ball rolls {length} tiles back up her nearest lane from the road point nearest the exit in her range, hitting every walker once for {dmgMul}× her hit and pushing it back (bosses do not budge).',
    'a giant ball that rolls back up her road',
    'Turkey Strike: Giant Strike rolls on every lane in her range all the way to the spawn, hits for {dmgMul}×, and recharges in {cd}s.'),
  'chigusa.overgrowth': t('Overgrowth', 'botanist',
    'Vines hold up to {count} walkers in her range for {hold}s (minibosses for less; bosses and flyers shrug them off) and squeeze each for {dmgMul}× her hit.',
    'vines that hold a whole group of walkers',
    'Forest Corridor: Overgrowth holds up to {count} walkers within {reachMul}× her range for {hold}s, squeezes for {dmgMul}×, and recharges in {cd}s.'),

  // the returning girls (ABILITIES_SPEC §5.2)
  'fuu.backdraft': t('Backdraft Fan', 'displacement',
    'One great sweep: every enemy within {reach} tiles but a boss is blown {push} tiles back up the road (minibosses {pushMiniboss}), and flyers are grounded for {ground}s.',
    'a great gust that blows a whole crowd back',
    'Backdraft Fan blows enemies {push} tiles back, grounds flyers for {ground}s and recharges in {cd}s.'),
  'hana.swoop': t('Kaze\'s Swoop', 'falconer',
    'Kaze strikes up to {count} flyers still in the sky anywhere on the map (casters, bosses and elites first): he dives on the ones near Hana and strikes the rest from the sky. {dmg} damage each, and they are grounded for {ground}s. With no flyer up, he takes the {fallbackCount} strongest walkers instead.',
    'a falcon strike on the flyers anywhere on the map',
    'Kaze\'s Swoop strikes {count} flyers at {dmgMul}× her hit and recharges in {cd}s.'),
  'ruri.moonPounce': t('Moon Pounce', 'summoner',
    'Kon leaps from his spot at the strongest enemy within {reach} tiles of him: {hits} bites of {dmg} damage, then he holds it for {hold}s (flyers and bosses shrug the hold off).',
    'Kon pounces on the strongest enemy and holds it',
    'Moon Pounce bites {hits} times, holds for {hold}s and recharges in {cd}s.'),
  'ruri.starSnatch': t('Star Snatch', 'airborne',
    'Kon swoops on the leading enemy that is not a boss and carries it {carry} tiles back up the road (minibosses {carryMiniboss}).',
    'Kon carries the leading enemy back up the road',
    'Star Snatch carries {count} enemies {carry} tiles back and recharges in {cd}s.'),
  'ruri.riverRush': t('River Rush', 'water',
    'A wave rolls {length} tiles back along her lane: it pushes every enemy it meets {push} tile back and soaks it for {soak}s.',
    'a wave that rolls back along her lane',
    'River Rush rolls {length} tiles, pushes {push} tiles and recharges in {cd}s.'),
  'noa.firstAid': t('First Aid Call', 'purifier',
    'Girls within {radius} tiles of her, your ally\'s too, are cleansed and can\'t be sabotaged or stunned for {dur}s. Meanwhile every {lifeEvery} enemies that fall within {lifeRadius} tiles of her bring back a life (at most {lifeMax}; never where lives can\'t come back).',
    'a call that protects the girls around her and brings back lives',
    'First Aid Call lasts {dur}s, brings back up to {lifeMax} lives and recharges in {cd}s.'),
  'iroha.mirrorShift': t('Mirror Shift', 'mirror',
    'Her mirror panel jumps to where you aim (or the road spot nearest the leader in her reach) and for {dur}s splits every one of your shots that crosses it in two, once each.',
    'a mirror that splits the team\'s shots in two',
    'Infinite Reflection: the panel splits shots for good, Mirror Shift adds a second panel for {dur}s, and it recharges in {cd}s.'),
  'ena.omenCard': t('Omen Card', 'curse',
    'Every enemy within {reach} tiles draws a cursed card: when it falls it bursts for {curseBurst} damage ({curseMul}× her hit) within {curseRadius} tiles and passes a weaker curse on, so a dense wave chain-reacts.',
    'a cursed card for every enemy around her',
    'Omen Card reaches {reach} tiles, bursts for {curseMul}× her hit and recharges in {cd}s.'),
});

/** Settings and hold-card copy (spec §8.6). */
export const ABILITY_COPY = Object.freeze({
  auto: 'Auto',
  autoSetting: 'Auto-cast abilities',
  autoHelp: 'Girls fire their abilities by themselves when it\'s a good moment. You can still tap them, and switch Auto per girl by holding her button.',
});

/** @returns {object|null} the text row of an ability id */
export function abilityText(id) {
  return ABILITY_TEXT[id] || null;
}

/** How a tap aims an ability in battle: 'girl', 'point' or null (casts at once). UI only. */
export function abilityAim(id) {
  return ABILITY_TEXT[id]?.aim || null;
}

const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/**
 * The numbers a template may name, from a merged definition (abilityAtTier / skillAtLevel) and, when
 * given, her stats (resolveStats on the student page, her live stats in battle):
 *   cd, dur                     cooldown and duration (s)
 *   <effect key>                every number of effect, effect.mods, effect.rally and effect.after.mods (count, radius, …)
 *   afterDur                    a strike's boost tail: how long it lasts (s)
 *   <key>Pct, <key>Share        for each …Mul: the bonus (1.25 → 25) and the share (0.6 → 60) in %
 *   <status>, <status>Pct       each status's seconds and its amount / bonus in %; casterStatus as caster<Type>
 *   reach, radius, dmg          with stats: reachMul × range, radiusMul × range, dmgMul × her hit (× 1 + ramp.max at full ramp)
 * @throws {Error} when two sources would give the same key (the template would be ambiguous)
 */
export function abilityValues(def, stats = null) {
  const v = { cd: def.cooldown, dur: def.duration };
  const put = (k, x) => {
    if (Object.hasOwn(v, k)) throw new Error(`abilityValues: ${def.id} has "${k}" twice`);
    v[k] = x;
  };
  const flat = (o) => {
    for (const [k, x] of Object.entries(o || {})) {
      if (typeof x !== 'number') continue;
      put(k, x);
      if (k.endsWith('Mul')) {
        put(`${k}Pct`, Math.round((x - 1) * 100));
        put(`${k}Share`, Math.round(x * 100));
      }
    }
  };
  const statuses = (list, prefix = '') => {
    for (const s of list || []) {
      const k = prefix ? prefix + cap(s.type) : s.type;
      put(k, s.duration);
      // (a hex's share of max HP is its `pct`)
      const amount = s.amount ?? s.bonus ?? s.pct;
      if (amount != null) put(`${k}Pct`, r2(amount * 100));
      // a curse: its burst as a multiple of her hit, its radius and (with stats) the burst itself
      if (s.burstMul != null) {
        put(`${k}Mul`, s.burstMul);
        if (s.radius != null) put(`${k}Radius`, s.radius);
        if (stats) put(`${k}Burst`, Math.round(s.burstMul * stats.damage));
      }
    }
  };
  const e = def.effect || {};
  flat(e);
  flat(e.mods);
  flat(e.mods?.ring); // (Kinu's Blade Spiral: spiral, spiralPierce)
  flat(e.rally);
  flat(e.splashArmor); // (Kanna's Heavy Beat: radius, shred)
  // a strike's boost tail (Zero Point): its ModSet's numbers and how long it lasts
  flat(e.after?.mods);
  if (e.after?.duration != null) put('afterDur', e.after.duration);
  // a strike's fallback pick (Kaze's Swoop with no flyer up): fallbackCount, …
  for (const [k, x] of Object.entries(e.fallback || {})) if (typeof x === 'number') put(`fallback${cap(k)}`, x);
  statuses(e.status);
  statuses(e.mods?.status);
  statuses(e.casterStatus, 'caster');
  if (stats) {
    if (e.reachMul) put('reach', r1(e.reachMul * stats.range));
    else if (e.reachAdd) put('reach', r1(stats.range + e.reachAdd)); // (her range + N tiles: Moon Pounce, Puppet Hex)
    if (e.radiusMul) put('radius', r1(e.radiusMul * stats.range));
    if (e.dmgMul) put('dmg', Math.round(e.dmgMul * stats.damage * (e.fullRamp ? 1 + (stats.ramp?.max ?? 0) : 1)));
  }
  return v;
}

/**
 * Details-only sentences: the student page's ability sheet adds them after the description; the battle's live hold
 * card leaves them out (its state chip already says Ready / Recharging).
 */
export const ABILITY_NOTES = Object.freeze({
  'momo.marketDay': 'It starts uncharged.',
});
/** @param {string} id */
export const abilityNote = (id) => ABILITY_NOTES[id] || null;

/** Fills {placeholders}; an unknown one is left as is (the data test fails on any left over). */
export function fillAbilityText(template, values) {
  return template.replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(values, k) ? String(typeof values[k] === 'number' ? r2(values[k]) : values[k]) : m));
}

/** The ⚡ tier-3 row and a hero's Lv 7 line: "Unlocks ⚡ Skyfall Volley: an arrow rain …". */
export function abilityUnlockLine(id) {
  const row = abilityText(id);
  return row ? `Unlocks ⚡ ${row.name}: ${row.short}.` : '';
}

/** The tier-5 row and a hero's Lv 17 line, filled from the upgraded definition: "⚡+ Skyfall Volley grows …". */
export function abilityUpgradeLine(id, values) {
  const row = abilityText(id);
  return row ? `⚡+ ${fillAbilityText(row.up, values)}` : '';
}
