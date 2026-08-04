# Solidity corpus behavioral coverage

The compatibility compiler suite proves parsing, diagnostics, artifact shape, and bytecode generation. It does not
by itself prove that a compiled Solidity semantic fixture can be spent successfully with the expected result.

`behavioral-audit.mjs` compares successful semantic fixtures in `results.json` that contain executable `// ----`
expectations with explicit fixture references in SolidCash e2e and conformance tests. Run it with:

```sh
node examples/solidity-corpus/behavioral-audit.mjs
```

Set `SOLC_CORPUS` when the Solidity checkout is not at `/Code/solidity`. The generated
`behavioral-coverage.json` is a conservative traceability report, not a claim that every unreferenced fixture has no
equivalent runtime coverage. Generic SolidCash tests can exercise the same behavior without naming its upstream
fixture.

The current baseline contains 1,504 successfully compiled semantic fixtures with executable expectations. Of those,
24 are explicitly traced to an e2e or conformance test, leaving 1,480 without a durable fixture-to-runtime link. The
largest untraced topics include arrays, ABI coding, via-IR/Yul, inline assembly, function calls, libraries, operators,
structs, and inheritance.

When adding behavioral parity coverage:

- Name the upstream semantic fixture in a comment so the audit can trace it.
- Exercise an actual contract spend or stateful call, not another compilation assertion.
- Assert the upstream expected value or success condition and include a deliberate failure/revert control when useful.
- Prefer representative high-risk semantics over mechanically porting all 1,504 fixtures; many fixtures overlap.
- Keep negative compiler diagnostics in `packages/solidc/test/solidity-compat` unless runtime behavior is involved.

A runtime adaptation of `semanticTests/enums/enum_referencing.sol` exposed why this distinction matters: making
`L.g()` reachable found namespace erasure that rebound same-named interface and library enums to the wrong ordinal.
The compiler fix is now guarded by both focused compilation coverage and an actual successful/failed spend pair.
