// Path looks: the pieces each girl wears per path and stage (docs/specs/path-looks.md §4; display only).
//
// Phase 1 prototype: Aoi, Akane and Luna; rollout batch 1: Rei, Yuki, Momo, Kage, Nami and Hikari. Every other girl shows
// the pip gauge, the T1–T2 hand glows and the T5 aura, and no pieces until her row lands here (the spec's table lists a
// T3 and a T5 look for every girl's three paths). A T4 stage is the T3 piece a size up unless a row says otherwise.
//
//   weaponHand  bone her weapon hangs from (default: her weapon-tip bone, src/models/weaponTip.js, else hand_R): the T1–T2 glow of her leading path sits there, the second path's at the other
//   paths[i]    { t3, t4?, t5 }: the pieces worn at that stage (a missing t4 keeps the t3 pieces). Each piece:
//     piece   node name in public/models/pathlooks/<unit>_p<i>.glb (tools/blender/pathlooks/build_path_looks.py)
//     bone    the socket: a bone of her rig (head, chest, hips, root, hand_L, hand_R); the piece follows its animation
//     at      the piece's pivot, in figure units (her group space after unitScale: feet at 0, +y up, +z her front)
//             measured from that bone's rest position
//     rot     [x, y, z] radians in figure axes (XYZ), scale: uniform
//     anim    optional: { spin } rad/s about the piece's up axis, { bob: [amplitude, hz] } a gentle float
// Pieces must never hide a face from the battle camera (48° down): head pieces ride the top, side or back of the head
// (or of a hat), back pieces sit behind her, floating pieces keep beside or above her.

const P = (piece, bone, at, rot = [0, 0, 0], scale = 1, anim = null) => Object.freeze({ piece, bone, at: Object.freeze(at), rot: Object.freeze(rot), scale, anim });
const BOB = Object.freeze({ bob: [0.025, 0.55] });
const SPIN = (r) => Object.freeze({ spin: r });
/** A T3 piece a size up: the plain T4 escalation (the layer adds its T4 sparkles). */
const UP = (list, k = 1.15) => list.map((e) => P(e.piece, e.bone, e.at, e.rot, e.scale * k, e.anim));
/** A path row from its T3 and T5 lists (T4 = T3 a size up). */
const ROW = (t3, t5, t4 = UP(t3)) => Object.freeze({ t3, t4, t5 });

export const PATH_LOOKS = Object.freeze({
  // Aoi, Wind Ranger: 0 Piercing Arrows → steel quiver / comet quiver; 1 Rapid Volley → hawk feathers / feather wings;
  // 2 Sky Hunter → a falcon friend / the golden apex falcon
  aoi: Object.freeze({
    weaponHand: 'hand_L',
    paths: Object.freeze([
      Object.freeze({
        t3: [P('p0_quiver', 'chest', [-0.17, 0.17, -0.17], [0.2, 0, 0.62], 1.6)],
        t4: [P('p0_quiver', 'chest', [-0.17, 0.17, -0.17], [0.2, 0, 0.62], 1.7), P('p0_comet', 'chest', [-0.17, 0.17, -0.17], [0.2, 0, 0.62], 1.7)],
        t5: [P('p0_cometQuiver', 'chest', [-0.17, 0.17, -0.18], [0.2, 0, 0.6], 1.6)],
      }),
      Object.freeze({
        t3: [P('p1_feathers', 'head', [0.17, 0.3, -0.08], [0, 0, -0.15], 1.55)],
        t4: [P('p1_feathersWide', 'head', [0.17, 0.3, -0.08], [0, 0, -0.15], 1.6)],
        t5: [P('p1_feathersWide', 'head', [0.17, 0.3, -0.08], [0, 0, -0.15], 1.6), P('p1_wings', 'chest', [0, 0.06, -0.17], [0, 0, 0], 1.15)],
      }),
      Object.freeze({
        t3: [P('p2_falcon', 'root', [-0.35, 0.8, 0.02], [0, 0.45, 0], 1.2, BOB)],
        t4: [P('p2_falcon', 'root', [-0.36, 0.83, 0.02], [0, 0.45, 0], 1.32, BOB), P('p2_jess', 'root', [-0.36, 0.83, 0.02], [0, 0.45, 0], 1.32, BOB)],
        t5: [P('p2_apexFalcon', 'root', [-0.36, 0.95, -0.02], [0, 0.4, 0], 1, BOB)],
      }),
    ]),
  }),
  // Akane, Flame Witch (her own big witch hat stays): 0 Big Bang → firework pinwheel / hanabi wheel behind her;
  // 1 Wildfire → phoenix plume in the hat / flame wings; 2 Rocket Science → rocket pack / skybreaker pack + goggles
  akane: Object.freeze({
    weaponHand: 'hand_R',
    paths: Object.freeze([
      Object.freeze({
        t3: [P('p0_pinwheel', 'head', [0.16, 0.56, 0.03], [0, 0.45, 0], 1.75)],
        t4: [P('p0_pinwheels', 'head', [0.16, 0.56, 0.03], [0, 0.45, 0], 1.65)],
        t5: [P('p0_pinwheels', 'head', [0.16, 0.56, 0.03], [0, 0.45, 0], 1.65), P('p0_hanabi', 'chest', [0, 0.3, -0.26], [0, 0, 0], 1.05, { spinZ: 0.35 })],
      }),
      Object.freeze({
        t3: [P('p1_plume', 'head', [-0.11, 0.47, -0.03], [0, 0, 0.25], 1.35)],
        t4: [P('p1_plumeFlame', 'head', [-0.11, 0.47, -0.03], [0, 0, 0.25], 1.45)],
        t5: [P('p1_plumeFlame', 'head', [-0.11, 0.47, -0.03], [0, 0, 0.25], 1.45), P('p1_flameWings', 'chest', [0, 0.06, -0.16], [0, 0, 0], 1.15)],
      }),
      Object.freeze({
        t3: [P('p2_rockets', 'chest', [0, 0.02, -0.18])],
        t4: [P('p2_rockets', 'chest', [0, 0.02, -0.18], [0, 0, 0], 1.1), P('p2_goggles', 'head', [0, 0.47, 0], [0, 0, 0], 1.15)],
        t5: [P('p2_skybreaker', 'chest', [0, 0.02, -0.19], [0, 0, 0], 1.1), P('p2_goggles', 'head', [0, 0.47, 0], [0, 0, 0], 1.15)],
      }),
    ]),
  }),
  // Luna, Moonfox Oracle (hero: every path she has reached at T3+ shows at once, so each path keeps its own place —
  // lances behind her left shoulder, orbs circling her, the court on her head):
  // 0 lances → moon lances / a crescent of lances; 1 gravity → orbiting moons / event horizon; 2 court → star tiara / crescent crown
  luna: Object.freeze({
    weaponHand: 'hand_R',
    paths: Object.freeze([
      Object.freeze({
        t3: [P('p0_lances', 'chest', [0.24, 0.3, -0.1], [0, 0, -0.45], 1.5)],
        t4: [P('p0_lances5', 'chest', [0.24, 0.3, -0.1], [0, 0, -0.45], 1.6)],
        t5: [P('p0_crescent', 'chest', [0, 0.3, -0.24], [0, 0, 0], 1.12)],
      }),
      Object.freeze({
        t3: [P('p1_orbs', 'root', [0, 0.6, 0.04], [0, 0, 0], 1.25, { spin: 0.9 })],
        t4: [P('p1_orbs3', 'root', [0, 0.6, 0.04], [0, 0, 0], 1.3, { spin: 0.9 })],
        t5: [P('p1_horizon', 'root', [0, 0.6, 0.04], [0, 0, 0], 1.35, { spin: 0.7 })],
      }),
      Object.freeze({
        t3: [P('p2_tiara', 'head', [0, 0.36, 0.06], [0, 0, 0], 1.3)],
        t4: [P('p2_tiaraStars', 'head', [0, 0.36, 0.06], [0, 0, 0], 1.3)],
        t5: [P('p2_crown', 'head', [0, 0.36, 0.05], [0, 0, 0], 1.3), P('p2_crownStars', 'head', [0, 0.58, 0.03], [0, 0, 0], 1.3, { spin: 1.1 })],
      }),
    ]),
  }),
  // ---- rollout batch 1 -----------------------------------------------------------------------------------------
  // Rei, Sakura Samurai: 0 Whirlwind → sakura sash bow / a ring of petals; 1 Duelist → headband / crescent-crest
  // headband; 2 Counter → a short sword on her back / three spirit blades fanned behind her
  rei: Object.freeze({
    paths: Object.freeze([
      ROW([P('p0_bow', 'chest', [0, 0.2, -0.18], [0, 0, 0], 2.3)],
        [P('p0_bow', 'chest', [0, 0.2, -0.18], [0, 0, 0], 2.4), P('p0_petals', 'root', [0, 0.55, 0], [0.12, 0, 0], 1.1, SPIN(0.8))]),
      ROW([P('p1_band', 'head', [0, 0.28, -0.02], [0, 0, 0], 1.15)], [P('p1_bandCrest', 'head', [0, 0.28, -0.02], [0, 0, 0], 1.2)]),
      ROW([P('p2_wakizashi', 'chest', [0.16, 0.18, -0.16], [0, 0, -0.75], 1.8)],
        [P('p2_wakizashi', 'chest', [0.16, 0.18, -0.16], [0, 0, -0.75], 1.8), P('p2_blades', 'chest', [0, 0.3, -0.21], [0, 0, 0], 1.3)]),
    ]),
  }),
  // Yuki, Frost Mage (deep ice blues: she is all white): 0 Deep Freeze → snowflake ornament / great snowflake halo;
  // 1 Frostbite → icicle shards circling / a diamond-dust ring; 2 Permafrost → frost crystals over her left shoulder /
  // + an ice clock above her (her staff head rests low behind her right hip: nothing goes on that side)
  yuki: Object.freeze({
    paths: Object.freeze([
      ROW([P('p0_flake', 'head', [-0.19, 0.32, 0.0], [0, 0, 0], 1.7)],
        [P('p0_flake', 'head', [-0.19, 0.32, 0.0], [0, 0, 0], 1.8), P('p0_halo', 'chest', [0, 0.32, -0.25], [0, 0, 0], 1.15)]),
      ROW([P('p1_shards', 'root', [0, 0.55, 0], [0, 0, 0], 1.3, SPIN(1.0))], [P('p1_dust', 'root', [0, 0.55, 0], [0, 0, 0], 1.3, SPIN(0.8))]),
      ROW([P('p2_frost', 'chest', [0.2, 0.24, -0.12], [0, 0, -0.3], 1.45)],
        [P('p2_frost', 'chest', [0.2, 0.24, -0.12], [0, 0, -0.3], 1.5), P('p2_clock', 'chest', [0, 0.6, -0.22], [0, 0, 0], 1.2)]),
    ]),
  }),
  // Momo, Starlight Idol: 0 Fan Club → peach hair clip / a golden peach bank; 1 Merch → a light-stick tote /
  // a golden ledger; 2 Encore → star-coin clips / a ring of coins and stars
  momo: Object.freeze({
    paths: Object.freeze([
      ROW([P('p0_peach', 'head', [0.15, 0.38, 0.0], [0, 0, 0], 1.6)],
        [P('p0_peach', 'head', [0.15, 0.38, 0.0], [0, 0, 0], 1.7), P('p0_bank', 'root', [-0.37, 0.82, 0.0], [0, 0.4, 0], 1.25, BOB)]),
      ROW([P('p1_tote', 'chest', [0, 0.0, -0.17], [0, 0, 0], 1.35)],
        [P('p1_tote', 'chest', [0, 0.0, -0.17], [0, 0, 0], 1.4), P('p1_ledger', 'root', [0.37, 0.88, 0.0], [0, -0.3, 0], 1.3, BOB)]),
      ROW([P('p2_clips', 'head', [-0.15, 0.37, 0.02], [0, 0, 0], 1.9)],
        [P('p2_clips', 'head', [-0.15, 0.37, 0.02], [0, 0, 0], 2.0), P('p2_coins', 'root', [0, 0.6, 0], [0.1, 0, 0], 1.1, SPIN(0.9))]),
    ]),
  }),
  // Kage, Shadow Ninja: 0 Steel → a big shuriken on her back / six shuriken circling; 1 Shadow Mark → a long scarf /
  // a violet glowing scarf + a crescent on her headband; 2 Kunai → a kunai fan / a black lotus of blades behind her
  kage: Object.freeze({
    paths: Object.freeze([
      ROW([P('p0_shuriken', 'chest', [0.22, 0.28, -0.12], [-0.9, 0, 0.3], 1.9)],
        [P('p0_shuriken', 'chest', [0.22, 0.28, -0.12], [-0.9, 0, 0.3], 2.0), P('p0_ring', 'root', [0, 0.55, 0], [0, 0, 0], 1.1, SPIN(1.6))]),
      ROW([P('p1_scarf', 'chest', [0, 0.12, 0.0], [0, 0, 0], 1.3)],
        [P('p1_scarfGlow', 'chest', [0, 0.12, 0.0], [0, 0, 0], 1.4), P('p1_crescent', 'head', [0, 0.36, 0.12], [0, 0, 0], 1.6)]),
      ROW([P('p2_kunai', 'chest', [-0.12, 0.12, -0.17], [0, 0, 0.55], 1.35)],
        [P('p2_kunai', 'chest', [-0.12, 0.12, -0.17], [0, 0, 0.55], 1.4), P('p2_lotus', 'chest', [0, 0.32, -0.22], [0, 0, 0], 1.3)]),
    ]),
  }),
  // Nami, Tide Admiral (hero: frost behind her right shoulder, the undertow circling, the harbor on her cap):
  // 0 Frostbrand → ice crystals / a fan of ice spikes; 1 Undertow → a water ring / a friendly water serpent;
  // 2 Harbor → an anchor badge on her cap / a ship's wheel floating above her
  nami: Object.freeze({
    paths: Object.freeze([
      ROW([P('p0_crystals', 'chest', [-0.24, 0.32, -0.08], [0, 0, 0.3], 1.4)], [P('p0_spikes', 'chest', [-0.2, 0.36, -0.12], [0, 0, 0.25], 1.35)]),
      ROW([P('p1_ring', 'root', [0, 0.55, 0.03], [0.1, 0, 0], 1.25, SPIN(0.8))], [P('p1_serpent', 'root', [0, 0.5, 0.03], [0, 0, 0], 1.25, SPIN(0.6))]),
      ROW([P('p2_anchor', 'head', [0, 0.5, 0.08], [-0.7, 0, 0], 2.4)],
        [P('p2_anchor', 'head', [0, 0.5, 0.08], [-0.7, 0, 0], 2.5), P('p2_wheel', 'head', [0, 0.8, -0.06], [-0.6, 0, 0], 1.45, BOB)]),
    ]),
  }),
  // Hikari, Dawnblade Captain (hero; her own crown stays): 0 Radiant → a sun charm beside her / a great sun disc
  // behind her; 1 Sanctuary → a shield charm circling / three dawn shields; 2 Lightbringer → light-feather wings at her
  // head / a radiant sun crown
  hikari: Object.freeze({
    paths: Object.freeze([
      ROW([P('p0_medallion', 'chest', [-0.33, 0.45, -0.1], [0, 0.4, 0], 1.75, BOB)], [P('p0_sun', 'chest', [0, 0.42, -0.3], [0, 0, 0], 1.4)]),
      ROW([P('p1_shield', 'root', [0, 0.25, 0], [0, 0, 0], 1.3, SPIN(0.8))], [P('p1_shields', 'root', [0, 0.25, 0], [0, 0, 0], 1.3, SPIN(0.8))]),
      ROW([P('p2_wings', 'head', [0, 0.1, -0.05], [0, 0, 0], 1.6)], [P('p2_crown', 'head', [0, 0.27, 0.0], [0, 0, 0], 1.4)]),
    ]),
  }),
});

/**
 * Outfit rows (review r1 LOW-1): an outfit whose silhouette moves a socket (no hat, a different hairdo) overrides some
 * stages of some paths; everything it leaves out comes from her default row. Keyed by skin id (src/data/skins.js).
 *   { [skinId]: { weaponHand?, paths: { [pathIndex]: { t3?, t4?, t5? } } } }
 */
export const SKIN_LOOKS = Object.freeze({
  // Sentinel Akane wears no witch hat (review r1 LOW-1): her hat-band pieces would sink into her hair top. The pinwheel
  // and plume ride the sides of her head instead and the goggles rest on top of her hair, all well above the eyes
  akane_sentinel: Object.freeze({
    paths: Object.freeze({
      0: Object.freeze({
        t3: [P('p0_pinwheel', 'head', [0.2, 0.33, 0.04], [0, 0.5, 0], 1.6)],
        t4: [P('p0_pinwheels', 'head', [0.2, 0.33, 0.04], [0, 0.5, 0], 1.65)],
        t5: [P('p0_pinwheels', 'head', [0.2, 0.33, 0.04], [0, 0.5, 0], 1.65), P('p0_hanabi', 'chest', [0, 0.3, -0.26], [0, 0, 0], 1.05, { spinZ: 0.35 })],
      }),
      1: Object.freeze({
        t3: [P('p1_plume', 'head', [-0.17, 0.33, -0.04], [0, 0, 0.35], 1.3)],
        t4: [P('p1_plumeFlame', 'head', [-0.17, 0.33, -0.04], [0, 0, 0.35], 1.4)],
        t5: [P('p1_plumeFlame', 'head', [-0.17, 0.33, -0.04], [0, 0, 0.35], 1.4), P('p1_flameWings', 'chest', [0, 0.06, -0.16], [0, 0, 0], 1.15)],
      }),
      2: Object.freeze({
        t4: [P('p2_rockets', 'chest', [0, 0.02, -0.18], [0, 0, 0], 1.1), P('p2_goggles', 'head', [0, 0.4, 0.02], [-0.25, 0, 0], 1.75)],
        t5: [P('p2_skybreaker', 'chest', [0, 0.02, -0.19], [0, 0, 0], 1.1), P('p2_goggles', 'head', [0, 0.4, 0.02], [-0.25, 0, 0], 1.75)],
      }),
    }),
  }),
});

const skinRows = new Map();

/** Her look row for an outfit (her default row when the outfit has none), or null (pips, glows and aura still show). */
export function pathLooksFor(unitId, skinId = null) {
  const row = PATH_LOOKS[unitId] || null;
  const sk = skinId ? SKIN_LOOKS[skinId] : null;
  if (!row || !sk) return row;
  let r = skinRows.get(skinId);
  if (!r) {
    r = Object.freeze({
      weaponHand: sk.weaponHand || row.weaponHand,
      paths: Object.freeze(row.paths.map((p, i) => Object.freeze({ ...p, ...(sk.paths?.[i] || {}) }))),
    });
    skinRows.set(skinId, r);
  }
  return r;
}

/** File holding one girl's pieces of one path. */
export function pieceFile(unitId, path) {
  return `${unitId}_p${path}`;
}
