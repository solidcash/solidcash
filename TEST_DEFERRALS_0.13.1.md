# SolidCash 0.13.1 skipped-test register

Last reviewed: 2026-08-05

This register classifies every executable `.skip` and `.todo` under `packages` and `examples`. A classified test
is not evidence that the behavior works: release blockers remain blockers, while deferred rows define the public
boundary that release documentation must preserve. Empty placeholder suites are not useful evidence and were
removed during this review.

## Release-blocking coverage gaps

| Tests | Classification | Required release evidence |
|---|---|---|
| `packages/solidcash/test/e2e/misc/timelocks.test.ts` — sequence numbers | Supported language feature, missing BCHN integration proof | Add BIP68 height/time sequence tests against BCHN and keep the compiler's `this.age` coverage. This remains part of the BCHN release gate. |
| `packages/solidcash/test/e2e/CrossContractCallInfra.test.ts` — unbounded `bytes` return | Known fail-closed implementation gap | Either fix the return-event encoding and enable the VM test, or reject/document unbounded cross-contract returns in the 0.13.1 compatibility manifest. Do not advertise this shape while skipped. |

## Explicit first-release deferrals

| Tests | Classification | Boundary/evidence |
|---|---|---|
| `packages/solidcash/test/debugging.test.ts` — three optimized/nested-loop TODOs | Debugger quality, post-release | Contract execution is covered; reconstruction of optimized-away values and precise nested-loop attribution is not a consensus or covenant claim and remains P2. |
| `packages/solidcash/test/multi-contract-debugging.test.ts` — duplicate messages and multiline non-require attribution | Debugger quality, post-release | Multi-contract execution and ordinary require attribution are covered. Exact disambiguation/statement rendering for these two shapes is deferred. |
| `packages/solidcash/test/e2e/BigInt.test.ts` — maximum compute-budget failure | Resource-diagnostic coverage, post-release | Consensus/provider resource gates are covered by the dedicated BCH-2026 capacity and over-limit suites. This duplicate BigInt-specific diagnostic is deferred. |
| `packages/solidcash/test/e2e/UpgradesDeployProxy.test.ts` — returning call from one deployed proxy to another | Experimental nested proxy composition | Direct proxy mutation, upgrade/state preservation, and a delegated implementation calling a non-proxy return source are covered. Cross-owner proxy event+return layout remains experimental and must not be claimed stable. |

## Permanent BCH/model differences

| Tests | Classification | Boundary/evidence |
|---|---|---|
| `packages/solidcash/test/e2e/EvmStorageFoundation.test.ts` — EVM address slot | Intentional BCH difference | SolidCash `address` is locking bytecode (commonly 25 bytes), not an EVM 20-byte account. The compatibility manifest documents the address model; bytes20 storage remains available for EVM-shaped data. |
| Three `packages/solidcash/test/e2e/CircularCalls.test.ts` rows | Permanent construction/address-model limitation | Two contracts cannot bake each other's final P2SH address without a fixed-point preimage. The supported alternative is late-bound state/category references; circular constructor-address claims remain excluded. |

## Unlocker-diagnostic limitations

| Tests | Classification | Boundary/evidence |
|---|---|---|
| `packages/solidcash/test/debugging.test.ts` — mismatched P2PKH key | Mock/debug API limitation; network remains fail-closed | A bare `Utxo` has txid/vout/value/token but no source locking bytecode. The builder therefore cannot prove that a supplied P2PKH unlocker matches it; the actual network validates the source output and rejects a wrong signature. Enabling this test requires carrying authenticated source locking bytecode in the UTXO/provider API. |
| Two `packages/solidcash/test/e2e/MultiContract.test.ts` rows | One redundant contract-negative case plus the same P2PKH boundary | Incorrect unlockers at contract inputs 0 and 1 already have active source-located negative tests. The combined-contract row adds attribution ordering, not a new fail-closed path. The Bob P2PKH row has the source-locking-bytecode limitation above. |

## Audit command

Comments mentioning a future `it.todo` are deliberately excluded:

```bash
rg -n --glob '*.{test,spec}.ts' \
  '^\s*(describe|it|test)\.(skip|todo)\b' \
  packages examples -g '!**/node_modules/**'
```

Expected 2026-08-05 result: **16 classified executable occurrences**. The obsolete manual-proof TODO was removed
because `optimisation-equivalence.test.ts` already contains 102 active proofs. Any new occurrence fails the classification
gate until this register assigns it a release-blocking, explicitly deferred, or permanent-difference status.
