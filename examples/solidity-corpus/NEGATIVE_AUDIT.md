# Solidity negative-fixture audit

Last run: 2026-08-05
Corpus: `816d9b2aeef4c0d1c0f6d8af2d8aeed3eb7a0762`
Runtime: Node 22.22.0, linux-arm64

## Result

All 2,158 in-scope Solidity-negative fixtures were compiled in fresh workers. The 30-second/four-worker pass
left 104 timeouts; a 120-second/four-worker retry resolved every one. After storage-pointer definite-assignment
hardening, a 30-second/four-worker pass rechecked all 328 formerly accepted fixtures with zero timeouts.

- 1,835 rejected by SolidCash;
- 323 accepted by SolidCash although solc expects a diagnostic;
- zero unchecked fixtures;
- zero residual timeouts.

All 323 over-accepted fixtures are from `test/libsolidity/syntaxTests`; none are semantic-execution negatives.
Acceptance still needs review: a syntax-test fixture can encode an important type-system or safety invariant even
when it has no execution trailer.

## Conservative screening buckets

These buckets are an inventory, not release dispositions. In particular, “platform/backend-policy divergence”
means the upstream diagnostic mentions an EVM version, solc backend, storage-layout option, or feature that
SolidCash intentionally models differently; it does not mean the fixture is automatically safe to waive.

| Bucket | Count | Typical upstream diagnostic |
|---|---:|---|
| Platform/backend-policy divergence | 95 | EVM-version gates, custom base storage slots, legacy-codegen limitations, fixed point not implemented by solc |
| Data-location and storage-reference strictness | 78 | uninitialized storage/calldata references, missing data locations, invalid storage-reference conversions |
| Other semantic strictness — review required | 75 | ABI/function-type mismatches, invalid operators/calls, immutable and getter restrictions |
| Constant/range strictness | 22 | rational/constant overflow, fractional encoding, bounds and precision errors |
| Parser/syntax strictness | 19 | constructs solc's parser rejects but SolidCash currently accepts |
| Inheritance/declaration strictness | 15 | invalid linearization, missing/incorrect overrides, recursive declarations |
| Address/contract typing divergence | 13 | payable, address-to-contract, and unrelated contract conversions |
| Assembly strictness | 6 | invalid builtin use, shadowing, or access to Solidity locals from Yul functions |

The 95 platform/backend-policy candidates should be mapped to documented permanent BCH differences or explicit
first-release extensions. The other 228 are the strictness-review queue; the first priority is the 78
data-location/storage-reference cases because accepting an undefined or incorrectly-aliased reference can affect
state safety rather than only source compatibility.

## Reproduction

```bash
CHECK_NEGATIVES_FROM_RESULTS=true NEGATIVE_TIMEOUT_MS=30000 NEGATIVE_WORKERS=4 \
  node examples/solidity-corpus/bench.mjs
CHECK_NEGATIVES_FROM_RESULTS=true NEGATIVE_TIMEOUT_MS=120000 NEGATIVE_WORKERS=4 \
  node examples/solidity-corpus/bench.mjs
RECHECK_ACCEPTED_NEGATIVES=true NEGATIVE_TIMEOUT_MS=30000 NEGATIVE_WORKERS=4 \
  node examples/solidity-corpus/bench.mjs
```

The runner preserves negative diagnostics and timeouts in `results.json`, records both passes in
`run-metadata.json`, and does not count a timeout as a successful rejection.
