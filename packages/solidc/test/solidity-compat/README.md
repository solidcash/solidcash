# Solidity compatibility tests

These focused compiler regressions are derived from gaps found by
`bench/solidity-corpus/bench.mjs`. Keep new corpus-gap tests in the topic file that best matches the compiler
behavior under test rather than creating another chronological catch-all.

Run this suite with:

```sh
yarn workspace solidc test test/solidity-compat
```

Compatibility fixtures with an explicit Solidity 0.5-or-newer pragma must specify function visibility. Unversioned
fixtures retain SolidCash's native implicit-public shorthand, while explicit pre-0.5 sources retain Solidity's
historical rule. `helpers.ts` only centralizes compiler imports and does not alter compiler options.

## Redundancy and runtime audit

An audit of the 1,111 tests found little exact duplication. Two confirmed redundancies remain as cleanup targets:

- `yul-evm.test.ts` has two identical mapping-entry low-level-call tests. The second is labelled vmap-default but
  currently passes the same compiler options as the first; remove it or make it exercise vmap explicitly.
- `storage-collections.test.ts` compiles the same bytes-element-delete source twice in one test. The initial
  `contractName` assertion is redundant because the following bytecode comparison already proves compilation.

No exact compiler-input duplicates were found between this directory and the other `solidc` test files. Other
repeated sources here intentionally exercise different compiler options or suite-local fixtures.

The largest runtime concentrations are `storage-collections`, followed by `yul-evm`,
`expressions-control-flow`, `libraries-imports`, and `calls-abi`. Removing the two exact redundancies will not
materially affect runtime. A substantial reduction requires a deliberate policy: positive compile-only smoke cases
that are represented by the external Solidity corpus could be removed while retaining negative diagnostics,
bytecode-equivalence checks, and multi-condition regressions. Do this only after the external corpus benchmark is
part of normal CI; otherwise those tests are the only continuously run guards for many compatibility behaviors.

## Known pre-existing failure (fn-ptr array dispatch table)

Two tests in `storage-collections.test.ts` fail - and they fail IDENTICALLY at the pre-goal base `041acb1c7`
(verified by building that commit in a scratch worktree), so no recent change introduced them:

- `foreign external fn-ptr ARRAY dispatch table ... > bare fns[idx](v) is a SINGLE-element call (no broadcast loop)`
- `foreign external fn-ptr ARRAY dispatch table ... > the loop spelling for (..) { fns[i](v); } is the broadcast ...`

Both compile `contract C { function(uint) external[] fns; ... this.fns.push(IFoo(a).ping); ... }` and get
`FnPtrArrayLoweringError: Function-pointer array 'fns': it is never written in contract code ...`
(`src/semantic/LowerReceivedFnPtrArray.ts`).

Root (measured): an external-function-pointer-element array is registered at parse time as a sparse-entry
COLLECTION with a `<name>$len` length authority (`AstBuilder`'s collection classification - the element is not
chunk-packable). `this.fns.push(v)` then takes the collection-length branch of `buildArrayPush` ->
`buildCollectionLengthPush`, which emits ONLY the length bump and drops the element value, so the fn-ptr pass
finds no write to classify.

Two fixes were tried and rejected (do not retry them blind):
- emitting the leaf element write beside the bump lowers the array to `address[]`, but the `fns$len` bump remains
  and the SDK state derivation then fails ("missing: fns$len");
- falling through to the ordinary push node for a leaf value push removes that, but the contract suite
  `packages/solidcash/test/e2e/FnPtrDispatchTables.test.ts` (15 VM tests, which currently cannot even run - the
  file fails at import with this same error) still fails 13/15 with a VM `OP_VERIFY`.

A real fix must reconcile the parse-time collection/length-authority model with the fn-ptr array lowering.
This note is a diagnosis, NOT a waiver: the two tests stay active and failing, and the fix is expected to
make them - and the `FnPtrDispatchTables` contract suite - pass.

