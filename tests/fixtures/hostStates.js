// Every state a host's line table is walked through (src/ui/hostLines.js): tests/ui/hostLines.test.js checks each line
// is true in its state, and e2e/m5-kit.mjs checks each line fits her bubble on one line. Per screen, the values each
// state field can take (undefined = the screen passed nothing); hostStates(screen) is every combination.

const LONG = 'A Festival Name So Long It Could Never Fit One Line';

export const HOST_STATE_AXES = Object.freeze({
  missions: { next: [undefined, '2-3 Shield Wall', '12-5 Stage 3', '12-5 The Very Long Name of a Final Stage Indeed'], titansOpen: [false, true], doubleDrop: [undefined, 'the Meadow'] },
  commissions: { ready: [undefined, 0, 1, 3, 12], loginReady: [false, true], allDone: [false, true] },
  login: { claimable: [undefined, false, true], day: [undefined, 0, 4, 7] },
  bounty: { endsSoon: [false, true] },
  assault: { locked: [false, true] },
  titans: { locked: [false, true], keys: [undefined, 0, 1, 12], newWeek: [false, true] },
  mall: { restockSoon: [false, true] },
  mail: { gifts: [undefined, 0, 1, 2, 140] },
  happening: { running: [undefined, 0, 1, 3, 12], endingSoon: [undefined, 'Halloween', 'Pumpkin Lantern Night', LONG] },
  multiplayer: { invites: [undefined, 0, 1, 4] },
});

/** Every combination of a screen's state fields. */
export function hostStates(screen) {
  let out = [{}];
  for (const [key, values] of Object.entries(HOST_STATE_AXES[screen] || {})) {
    out = out.flatMap((s) => values.map((v) => (v === undefined ? { ...s } : { ...s, [key]: v })));
  }
  return out;
}
