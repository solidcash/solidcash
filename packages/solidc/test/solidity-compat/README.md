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
