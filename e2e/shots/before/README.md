# The "before" file

`<milestone>.json` holds each audited shot's probe numbers at 844x390, 1280x720 and 390x844, recorded by
`node e2e/menus.mjs --milestone all --record` on the base commit f9a2f7a (the build docs/specs/UI_V2_MENUS.md audited,
before any menus milestone), on the `ink` save. `e2e/menus.mjs` prints every later run beside it.

A few numbers differ from the plan's Oct 27 audit table: the Co-op room (the local test server's state differs from
the audit's two invites), Backpack salvage (the pick lands on a different row), the Notice (patch notes added since), the player card (the local test server's friend has fewer fields than
the audit's live one)
and the 10-pull result (two more numbers, same seed). The plan's table stays the target; this file is the measured
starting point.
