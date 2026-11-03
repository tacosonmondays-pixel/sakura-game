// Where the re-rigged batch-2 enemies' arms really are (shared by tests/models/modelQuality.test.js and
// e2e/model-quality.mjs; not a test file itself). In each enemy's 1 m frame (feet on the floor, x its left, y its
// back, z up): shoulder, elbow, wrist and fingertip, read off its front / side / top views
// (tools/tripo/landmark_views.py) and centred on the arm's own vertices (tools/tripo/rerig_tripo_enemy.py fit). A
// file's bones can be anywhere (the batch-2 autorig put them through heads and banners); these points are the mesh.
// r: probe radius across the arm; neck: where the head starts; club: a point on the club head and the hand it rides.
export const ENEMY_ARMS = {
  orc_grunt: { r: 0.04, neck: 0.655, club: { at: [-0.43, -0.2, 0.55], bone: 'hand_R' },
    L: [[0.22, 0.127, 0.62], [0.326, 0.148, 0.485], [0.398, 0.124, 0.408], [0.43, 0.1, 0.29]],
    R: [[-0.15, 0.13, 0.62], [-0.248, 0.147, 0.487], [-0.308, 0.129, 0.407], [-0.34, 0.155, 0.3]] },
  oni_brute: { r: 0.045, neck: 0.56, club: { at: [0.39, -0.17, 0.85], bone: 'hand_L' },
    L: [[0.22, 0.066, 0.5], [0.31, 0.0, 0.43], [0.357, -0.011, 0.398], [0.4, -0.041, 0.34]],
    R: [[-0.22, 0.053, 0.5], [-0.338, 0.051, 0.418], [-0.428, 0.003, 0.356], [-0.495, -0.012, 0.31]] },
  fp_hyakki_daimyo: { r: 0.035, neck: 0.43,
    L: [[0.13, -0.048, 0.41], [0.217, -0.032, 0.335], [0.293, -0.034, 0.271], [0.345, -0.038, 0.22]],
    R: [[-0.13, -0.048, 0.41], [-0.216, -0.032, 0.336], [-0.294, -0.034, 0.271], [-0.345, -0.037, 0.22]] },
  goblin_runner: { r: 0.032, neck: 0.625,
    L: [[0.095, 0.013, 0.578], [0.245, -0.001, 0.481], [0.354, -0.011, 0.416], [0.41, 0.001, 0.376]],
    R: [[-0.095, 0.015, 0.578], [-0.247, -0.001, 0.481], [-0.353, -0.011, 0.416], [-0.41, -0.002, 0.376]] },
  ghoul_bonewalker: { r: 0.027, neck: 0.665,
    L: [[0.17, 0.013, 0.61], [0.34, 0.029, 0.543], [0.439, -0.019, 0.493], [0.52, -0.017, 0.45]],
    R: [[-0.17, 0.015, 0.61], [-0.34, 0.029, 0.54], [-0.439, -0.02, 0.492], [-0.52, -0.017, 0.45]] },
  lizard_skink: { r: 0.03, neck: 0.66,
    L: [[0.13, -0.242, 0.54], [0.255, -0.247, 0.475], [0.354, -0.262, 0.411], [0.415, -0.257, 0.37]],
    R: [[-0.13, -0.244, 0.54], [-0.254, -0.249, 0.47], [-0.347, -0.263, 0.41], [-0.415, -0.256, 0.37]] },
  iron_colossus: { r: 0.055, neck: 0.885,
    L: [[0.29, 0.038, 0.68], [0.38, 0.023, 0.55], [0.453, -0.018, 0.426], [0.49, -0.046, 0.3]],
    R: [[-0.29, 0.036, 0.68], [-0.379, 0.022, 0.549], [-0.452, -0.021, 0.425], [-0.49, -0.054, 0.3]] },
  fp_foundry_titan: { r: 0.06, neck: 0.765,
    L: [[0.3, 0.029, 0.62], [0.37, 0.01, 0.483], [0.417, -0.026, 0.367], [0.45, -0.07, 0.23]],
    R: [[-0.3, 0.03, 0.62], [-0.371, 0.009, 0.482], [-0.416, -0.024, 0.368], [-0.45, -0.07, 0.23]] },
};

// the family enemies ship a light file too (glbEnemy TRIPO_ENEMY_LODS); the bosses and titans one file
export const ENEMY_LODS = new Set(['orc_grunt', 'oni_brute', 'goblin_runner', 'ghoul_bonewalker', 'lizard_skink']);

const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** The three probe points of one arm: the middle of the upper arm, of the forearm, and the hand. */
export function armProbes(spec, side) {
  const [S, E, W, T] = spec[side];
  return { upper: lerp3(S, E, 0.5), fore: lerp3(E, W, 0.5), hand: lerp3(W, T, 0.4) };
}

/** Indices of the vertices (1 m frame [x, y, z] rows) near a probe point: across the arm (seen from the front) within
 * r, and within 0.12 of its depth. */
export function probe(P, at, r) {
  const out = [];
  P.forEach(([x, y, z], i) => {
    if (Math.hypot(x - at[0], z - at[2]) < r && Math.abs(y - at[1]) < 0.12) out.push(i);
  });
  return out;
}
