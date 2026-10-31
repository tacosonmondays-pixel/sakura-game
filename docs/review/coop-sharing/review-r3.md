# Co-op sharing: quick review r3 (3004a1d7 → 8b390971)

This is a quick review of `feature/coop-sharing` `8b390971` (sim `28f9ca5dd4b1`, COOP 17), scoped to r2's open M1 residual,
solo identity and the no-nerf gate.

## Verdict: OK

## The change
`src/sim/abilities.js`:
- `groupKey` now keys by `t.owner`, so the shared map cooldown is the owner's group.
- `groupCut` and the first-bell scan in `startAbilityWave` also key by owner.
- `pickCaster` and `abilitySlots` stay on the controller, which is right: the controller is the one who may press the button.
- `carryGroupCooldown` is removed from `abilities.js` and from `commands.js` `setCtrl`. It is redundant now that a lent girl stays in her owner's group.

`groupCut`'s only caller passes the owner parsed from the group key (`abilities.js:198`), which is consistent. There is also a new lend-first test.

## M1, every order (`probes/probe.test.js`; both views give identical results and hashes)

| Probe | Result |
|---|---|
| Cast, then lend, then cast (r1 order) | the lent copy is refused: `cooldown` ✔ |
| **Lend first**, then the guest casts the lent copy, then the host casts the home copy | the home copy is refused: `cooldown` ✔ (it was `ok` in r2) |
| Cast, lend, give, back (`already`), then re-lend / back / re-lend across a wave boundary | the lent and home casts are refused (`cooldown`) on both sides of the boundary ✔ |
| Hand-out of copies after a cast (leaver gone, grace over) | both copies are the guest's and still on cooldown, both refused ✔ |
| Econ cap (M2), both orders | 2 per owner ✔ |

`coopSharing` + `coopAbilities` + `lockstep` + my probes: 95/95 passed.

## Solo and balance
- Solo `MODES_*` (15 battles, a bundle built from this tree): **identical to main** and to `solo-proof.json` (digest `964d4bf0`).
- noNerfGate `--support none` vs main `a3d97a38`: 4455 cells, **0 under**, 0 missing, output **byte-identical**.

I did not re-run the full vitest suite or the browser e2e scripts in r3 (the builder is running them). r2's results on `3004a1d7`
still stand for everything outside this one-file change.
