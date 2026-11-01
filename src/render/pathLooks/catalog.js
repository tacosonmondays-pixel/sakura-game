// Path looks: the pieces each girl wears per path and stage (docs/specs/path-looks.md §4; display only).
//
// Phase 1 prototype: Aoi, Akane and Luna. Every other girl shows the pip gauge and the T1–T2 hand glows, the T5 aura,
// and no pieces until her row lands here (the spec's table lists a T3 and a T5 look for every girl's three paths).
//
//   weaponHand  bone her weapon hangs from: the T1–T2 glow of her leading path sits there, the second path's at the other
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
        t3: [P('p0_pinwheel', 'head', [0.12, 0.48, 0.07], [0, 0.4, 0], 1.45)],
        t4: [P('p0_pinwheels', 'head', [0.12, 0.48, 0.07], [0, 0.4, 0], 1.5)],
        t5: [P('p0_pinwheels', 'head', [0.12, 0.48, 0.07], [0, 0.4, 0], 1.5), P('p0_hanabi', 'chest', [0, 0.3, -0.26], [0, 0, 0], 1.05, { spinZ: 0.35 })],
      }),
      Object.freeze({
        t3: [P('p1_plume', 'head', [-0.11, 0.47, -0.03], [0, 0, 0.25], 1.1)],
        t4: [P('p1_plumeFlame', 'head', [-0.11, 0.47, -0.03], [0, 0, 0.25], 1.2)],
        t5: [P('p1_plumeFlame', 'head', [-0.11, 0.47, -0.03], [0, 0, 0.25], 1.2), P('p1_flameWings', 'chest', [0, 0.06, -0.16], [0, 0, 0], 1.15)],
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
});

/** Her look row, or null (pips, glows and the aura still show). */
export function pathLooksFor(unitId) {
  return PATH_LOOKS[unitId] || null;
}

/** File holding one girl's pieces of one path. */
export function pieceFile(unitId, path) {
  return `${unitId}_p${path}`;
}
