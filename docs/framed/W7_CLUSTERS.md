# W7 phase 1: clusters to land first

Proposal only. No test was deleted. No suite was run. The scan covered 511 per-call test files. `it.each` does not drop vitest's reported case count. No percentage target.

Live walls to keep, because the code still refuses the shape:

- `toys/identity.test.ts`: a refund recorded under `tx.origin` is planned under the frame sender.
- `master/read-after-write-refusal.test.ts`: a second write of the same entry in one segment.
- `ahead/proxied-native-value.test.ts`: a send to a contract from the implementation body.
- `ahead/enumerable-set.test.ts`: removing a member of the contract's own set. The group-form compile `it` in that file is the one to delete (B1). The refusal its stay.
- `ahead/two-deployments-one-artifact.test.ts`: a view over both deployments.
- `ahead/typed-call-value.test.ts` and `call/typed-call-value.test.ts` drive different entry points. Share the source. Do not delete either file.

Land in this order:

1. Delete `packages/solidcash/test/per-call/pw7-measure.test.ts`. Two gated measurement cases. The toys and `many-masters` already settle the behaviour.
2. Delete the "is served" its in `edges/refused-contract-shapes.test.ts`. Each comment names the file that spends the shape. Keep the two "is refused by name" its.
3. Delete the group-form compile `it` in `ahead/enumerable-set.test.ts`. `call/enumerable-set.test.ts` already settles that remove.
4. Delete the push-length control `it`. Keep the two settlement its in that ahead file.
5. Share the `Child`, `Registry.tag`, and `Sample` sources. Several deploy and read files compile the same contract with the same options. Do not delete the its. They pin different rules.
6. Delete the nine own-reason its in `ahead/revert-after-calls.test.ts` only after a read confirms nothing else asserts the `Coin` balance view chain and the proxied `peek` return.
7. Collapse the eight block-header refusals in `hostile/builder-stated-fields.test.ts` to one `it.each`.

Do not merge the shapes files with the ahead flow files. Do not thin `validator/script.test.ts`. Strip `console.log` from the two validator measurement its and from `consensus-limits.test.ts`. Keep the assertions.
