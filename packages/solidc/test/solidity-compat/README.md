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

## Closed: fn-ptr array dispatch table (pushes kept)

The two `foreign external fn-ptr ARRAY dispatch table ...` tests in `storage-collections.test.ts` and the
`packages/solidcash/test/e2e/FnPtrDispatchTables.test.ts` contract suite (15 VM tests) failed with
`Function-pointer array 'fns': it is never written in contract code ...`.

Root: an external-function-pointer-element array (`function(uint) external[] fns`) is a sparse-entry COLLECTION
at parse time (the element is not chunk-packable), and `4c20695ca` gave every unbounded array collection a
`<name>$len` length authority. `fns.push(v)` then took `buildCollectionLengthPush`, which keeps only the length
bump and drops `v`. The fn-ptr lowering moves the table to chunk-backed `address[]` (+ `bytes[] __fnsel_<name>`)
state arrays, each with its own length header, which the SDK keys as `<name>$len` - so a surviving scalar
`fns$len` also collides with the lowered array's header (the "missing: fns$len" / VM `OP_VERIFY` seen when only
the push was patched).

Fix: `AstBuilder` gives an external fn-ptr table no length authority (`isExternalFnPtrTable`), so push (value
kept), pop, delete and `.length` take the ordinary array forms and the fn-ptr passes rewrite them in lockstep on
both arrays (whole `delete` included). A no-arg `push()` (a zero element with no selector) stays refused:
"never written" when it is the table's only growth, a specific reason beside writes.
`FnPtrArrayEmptyTargets.test.ts` pins both refusals and the kept-push lockstep.

