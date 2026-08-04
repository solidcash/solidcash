# Solidity compatibility tests

These focused compiler regressions are derived from gaps found by
`examples/solidity-corpus/bench.mjs`. Keep new corpus-gap tests in the topic file that best matches the compiler
behavior under test rather than creating another chronological catch-all.

Run this suite with:

```sh
yarn workspace solidc test test/solidity-compat
```

Most historical fixtures omit function visibility. Use the wrappers from `helpers.ts`, which preserve that legacy
shorthand. Tests for visibility diagnostics should use `compileStringRaw` or explicitly set
`allowOmittedFunctionVisibility: false`.

## Redundancy and runtime audit

An audit of the 1,111 tests found little exact duplication. Two confirmed redundancies remain as cleanup targets:

- `yul-evm.test.ts` has two identical mapping-entry low-level-call tests. The second is labelled C2-default but
  currently passes the same compiler options as the first; remove it or make it exercise C2 explicitly.
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
