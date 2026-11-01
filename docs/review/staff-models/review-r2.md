# Review r2: `fix/staff-models` @ `ea8a9dd4`

Quick follow-up to r1 (`review-r1.md`), Nov 1, 2026. Since r1, the branch has merged `main` `2dba8b4a` (`4fb14d4`),
and `ea8a9dd` rebuilt the LOD's paddle face as a fan around a centre vertex (`tools/blender/lib/staff.py`
`stop_paddle`, LOD level only; winding re-oriented with `M._orient`).

## Verdict: **OK**

| check | result |
|---|---|
| `tests/models/weaponTip.test.js`, norika full and LOD | pass (the r1 blocker is fixed) |
| `tests/models` (17 files, including staffModels, glb and weaponTip) | 365 / 365 passed |
| `e2e/staff-models.mjs` (both heroes, 1-1 / 2-1, 1280x720 / 390x844, high / medium) | 177 ok, 0 fail |
| `e2e/weapon-muzzles.mjs --girls norika` | 13 ok, 0 fail: her shot leaves the anchor (0.000 tiles) |
| simId | `e4001588f40b`, unchanged |
| `norika.lod.glb` | 242,040 B (was 241,968), under the 245,760 B LOD budget |

**The LOD paddle in game** (`r2-lod-paddle.jpg`): top row, 1280x720 medium (idle, attack, cheer), then high idle for
comparison; bottom row, 390x844 medium (idle, attack) and 2-1 night. The paddle's red face and white rim draw the same
at medium as at high. There is no dark or inside-out disc (the staffModels positive-volume test also passes on the
LOD), and the paddle stays in her hand.

The rest of r1 stands: content OK, hygiene OK, a patch note is still needed when this lands on `main`, and the
owner note on 2.8 heads (recommendation: ship as is; ask the owner about Seiran and other adult heroes).
