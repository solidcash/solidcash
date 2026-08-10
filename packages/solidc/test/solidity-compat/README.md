# Solidity compatibility tests

These focused compiler regressions are derived from gaps found by
`examples/solidity-corpus/bench.mjs`. Keep new corpus-gap tests in the topic file that best matches the compiler
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
