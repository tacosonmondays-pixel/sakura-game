# Visual reworks: owner board

Display only. The sim id equals main's (35748b1b58db) and COOP_PROTOCOL is unchanged.

## Batch A (v0.1.60)

### Tenka's real 3D figure
She takes the field as her Meshy figure, coilgun in hand. Low graphics uses the lighter model. If her model fails to load, her recoloured stand-in stays.

| | |
|---|---|
| In battle | `tenka/battle-844x390.jpg`, `tenka/battle-1280x720.jpg` |
| Close-up, coilgun in hand | `tenka/closeup-844x390.jpg`, `tenka/closeup-1280x720.jpg`, `tenka/closeup-low-844x390.jpg` (Low) |
| Muzzle flash at the barrel tip | `batch-a-look/tenka-844x390-muzzle-strip.jpg` |
| Girl page 3D view | `tenka/student-844x390.jpg`, `tenka/student-1280x720.jpg`, `batch-a-look/tenka-page-390x844.jpg` |
| Fallback (her model blocked) | `tenka/fallback-844x390.jpg` |

### Iroha's animations (the owner's defaults)
| | |
|---|---|
| The panel turns and glints on each relayed bolt | `iroha/844x390-flip-glint.jpg`, `iroha/844x390-flip-strip.jpg` (and 1280x720) |
| Afterimages when the panel jumps | `iroha/1280x720-shift-afterimages.jpg` |
| Mirror Shift echo (preview only) | `iroha/844x390-shift-echo.jpg` |
| Shattered Glass shards and the Kaleidoscope flare | `iroha/844x390-shards-strip.jpg`, `iroha/844x390-shards-kaleidoscope.jpg` |

Mirror Shift itself is not built in the sim yet; that is planned for its own sim round, A6. Its echo and split bolts switch on when the sim casts it. The second panel of Infinite Reflection waits until the sim gives it a position.

### Companions
| | |
|---|---|
| Kon bounds to Ruri's relay spot | `companions/kon-run-844x390.jpg` |
| Kon's Moon Pounce (crouch, leap, impact, hop back) | `companions/kon-pounce-844x390.jpg` |
| Kaze climbs and stoops onto Hana's targets | `companions/kaze-swoop-844x390.jpg`, `companions/kaze-swoop-1280x720.jpg` |
| Seiran's sky dragon (bigger; mane, whiskers, arrival roar) | `companions/dragon-strip-844x390.jpg`, `companions/dragon-flight-1280x720.jpg` |

### Display fixes (backlog lows)
| | |
|---|---|
| Home Events tab: an icon-only tab clear of Co-op on small phones | `backlog/1-home-events-tab.jpg`, `backlog/1b-home-667x375.jpg` |
| Hero widget clears the HUD at 667x375 | `backlog/2-hero-widget-lift.jpg` |
| Hero card "Deployed" and "Lv N" without wrapping | `backlog/3-hero-card-deployed.jpg` |
| Patch-note date on one line | `backlog/4-notice-patch-date.jpg` |
| Recruit rate line without the grey box | `backlog/5-recruit-banner-box.jpg` |
| Girl page Matchup on upright phones | `backlog/6-girl-page-matchup.jpg` |

### Reviews
- **Logic:** OK in two rounds, at adf61830 and c28918a4 (`batch-a-logic.json`). Of its lows, the panel snap and the stale comments are fixed. The lingering panel states past 24 relay panels are accepted: they are bounded and freed with the battle.
- **Look:** OK at c28918a4 (`batch-a-look.json`, evidence in `batch-a-look/`). Its MEDIUM (a white disc on clumped Shattered Glass T5 volleys) is fixed in 27a8ad31; its re-review is pending (`batch-a-fix/`).
- **Lows left for later:**
  - Iroha's un-aimed panel stands over her.
  - The Events "10D" sticker touches the lantern at 390x844.
  - Kon's run is short on 1-1, because the sim puts his spot about a tile from Ruri.
  - The 1280x720 pounce e2e crop misses the leap. That is a capture gap, not a game bug.
