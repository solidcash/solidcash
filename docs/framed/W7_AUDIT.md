# W7 phase-1 deletion audit (against the live tree)

Audit of `W7_CLUSTERS.md` items 1-7 at `750514246`. Read-only; no test was deleted. Read-only verification
means these rows are not yet proven green: items 2 and 7 target ungated files, the other four are gated behind
`PER_CALL_FULL=1` / `PER_CALL_AHEAD=1`.

| item | file | lines | verdict |
|---|---|---|---|
| 1 | `per-call/pw7-measure.test.ts` | whole file; the two gated cases at 995-1027 | VALID. Replacement behaviour exists in `toys/fan-in.test.ts:240`, `toys/reentry.test.ts:292,728`, `primitives/many-masters.test.ts:241,284`. Deleting it removes the generator of the PW7 numbers cited in `PLAN_MARKETPLACE_66.md` (1713, 1732, 1742, 1750, 1782) and the `MANIFEST.md:49` row and `:349-352` note, so those citations must be marked orphaned. |
| 2 | `per-call/edges/refused-contract-shapes.test.ts` | delete the eight "is served" `it`s at 29-36, 60-68, 74-80, 82-91, 126-128, 130-132, 134-138, 142-152; keep 40-46 and 93-102 | VALID but not a pure deletion: it empties three `describe` blocks and orphans the `sourceOf` helper (112-127) and the `keccak` describe's helpers, so lint must be repaired in the same change. |
| 3 | `per-call/ahead/enumerable-set.test.ts` | delete 143-145; keep 112-130 and 132-141 | VALID. `call/enumerable-set.test.ts:179` settles the group-form remove. `GROUP_SETS` (80-101) loses its only user. |
| 4 | `per-call/ahead/push-length-keyed-mapping-write.test.ts` (the proposal omits the file name) | delete the control `it` at 207-210; keep 212-220 and 222-234 | VALID. `WITHOUT_THE_WRITE` (87) loses its only user. Note this removes the only control that isolates the mapping write. |
| 5 | share `Child` / `Registry.tag` / `Sample` sources | refactor only | PARTIAL. `Child` is identical in the four `deploy/*` files (`deploy-from-reservation.test.ts` is a different contract). `Registry.tag` is byte-identical in `reads/mapping-read.test.ts:39-46` and `reads/chunked-read.test.ts:46-53` only; the `Registry` in `reads/struct-mapping-read.test.ts` and `shapes/initializer-batch.test.ts` are different contracts. `Sample` lives in `deploy/pool-resize.test.ts:179` and four `hostile/*` files, not in any `reads/` file. |
| 6 | `per-call/ahead/revert-after-calls.test.ts` | delete the nine `it`s at 376-472; keep 474-504 and 506-516 | VALID, precondition confirmed: the `Coin` balance view chain is asserted only at 498-502 and the proxied `peek` return only at 512-515. The deletion orphans many helpers (`refusedCall`, `Refused`, `reportOf`, `expectReported`, `reasonOf`, `stalledAt`, `lineOf`, `UNFILLED_INDEX`) and the `vi`, `composer`, `PerCallProxyDeployError` imports, so it is a refactor, not a 9-test deletion. |
| 7 | `per-call/hostile/builder-stated-fields.test.ts` | collapse the eight block-header refusals at 173-227 into one `it.each`; keep 166-171 | VALID, cosmetic only: `it.each` does not reduce the reported case count, so this changes source lines and not the number. |

## Lint consequences to plan for

`@typescript-eslint/no-unused-vars` fails the build, and only `_`-prefixed names are exempt. Items 2, 3, 4 and
6 each leave at least one now-unused local or import. Item 1 deletes a whole file, so nothing is orphaned
inside the tree except the doc citations.

## Not covered

The proposal's phase-2 work ("coverage second") has not been audited. No file in the six targets is recorded as
failing, but that was not verified by running them; items 2 and 7 are ungated and would show a failure in a
default run.
