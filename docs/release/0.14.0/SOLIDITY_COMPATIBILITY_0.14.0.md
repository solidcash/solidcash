# SolidCash 0.14.0 Solidity Compatibility Manifest

Status: release-candidate contract (conservative), reviewed 2026-10-11
Applies to: `solidc` 0.14.0 with `evmCompat: true`

This manifest defines the compatibility claims for 0.14.0. “Supported” means the construct has parser, semantic,
code-generation, and behavioral coverage on Bitcoin Cash. It does not imply EVM execution, EVM storage layout, or
Hardhat byte-for-byte compatibility. Anything marked experimental is outside the stable release subset and must
fail before broadcast when its required transaction shape cannot be constructed.

| Area | Parse | Type check | Codegen | SDK | Behavioral evidence | 0.14.0 status |
|---|---:|---:|---:|---:|---|---|
| Integers and checked/unchecked arithmetic | Yes | Yes | Yes | Yes | EVM-vs-BCH differential in both compile modes: `packages/solidcash/test/conformance/{arithmetic,unchecked,numbers,bitwise,comparisons}.conformance.test.ts`; VM spends in `packages/solidcash/test/e2e/SolidityCorpusBehavior.test.ts` | Supported; left shifts truncate to their type, as in Solidity |
| Integer casts | Yes | Yes | Yes | Yes | `packages/solidcash/test/conformance/casts.conformance.test.ts` (both modes) | Supported. evmCompat truncates unsigned narrowing, reinterprets same-width int <-> uint as two's complement (`uint256(int256(-1)) == 2^256-1`, `int8(uint8(0xfa)) == -6`) and reads bytesN big-endian like the EVM; native reverts on loss and on sign reinterpretation by design |
| ABI encode/decode | Yes | Yes | Yes | Yes | EVM-vs-BCH differential: `packages/solidcash/test/conformance/abi.conformance.test.ts`, `decode.conformance.test.ts` (including dirty-word reverts); VM round-trip `SolidityCorpusBehavior.test.ts` | Supported subset; EVM selectors require `evmCompat`; `abi.decode` reverts on a non-clean word as solc does |
| Statements and control flow (loops, break/continue, early returns, memory values) | Yes | Yes | Yes | Yes | EVM-vs-BCH differential of whole function bodies in both compile modes: `packages/solidcash/test/conformance/statements.conformance.test.ts` | Supported; a loop-heavy function needs a deploy-time density reserve (`salt`, `packages/solidcash/test/e2e/StatelessDensityReserve.test.ts`) when its script is too short to fund the loop's operation cost |
| Structs and fixed arrays | Yes | Yes | Yes | Yes | VM spends in `SolidityCorpusBehavior.test.ts`; compile coverage `packages/solidc/test/StructsMappings.test.ts`, `packages/solidc/test/solidity-compat/storage-collections.test.ts` | Supported |
| Dynamic arrays | Yes | Yes | Yes | Yes | `packages/solidcash/test/e2e/DynamicArrays.test.ts`, `packages/solidcash/test/e2e/ChunkedArrays.test.ts`; memory values `packages/solidcash/test/conformance/memory.conformance.test.ts` | Supported within documented commitment/chunk limits; memory arrays of arrays keep reference semantics within a function (rows copy at function boundaries) |
| Mappings | Yes | Yes | Yes | Yes | `packages/solidcash/test/e2e/SortedMappingComputedKeyRmw.test.ts`; value and slot parity `packages/solidcash/test/conformance/{mapping,slot-layout}.conformance.test.ts` | Supported subset, including VM coverage for computed and last-use local keys; documented dynamic-loop/chunk limits apply |
| Function pointers | Yes | Yes | Partial | Partial | `packages/solidcash/test/e2e/ForeignFunctionPointer.test.ts`, `FunctionPointerArrayCall.test.ts`, `FunctionPointerTernaryCall.test.ts` | Supported for internal pointers and single foreign pointers. KNOWN FAILURE: an `external` function-pointer array (`function(..) external[]` with push) fails to lower, see `packages/solidc/test/solidity-compat/README.md` and `packages/solidcash/test/e2e/FnPtrDispatchTables.test.ts` |
| Inheritance and modifiers | Yes | Yes | Yes | N/A | EVM-vs-BCH differential of whole contracts (super chains, C3 diamonds, virtual dispatch, modifiers, using-for, overloads, recursion): `packages/solidcash/test/conformance/contracts.conformance.test.ts`; VM spends in `SolidityCorpusBehavior.test.ts`; compile coverage `packages/solidc/test/solidity-compat/inheritance.test.ts`, `packages/solidc/test/Modifiers.test.ts` | Supported subset |
| Libraries and using-for | Yes | Yes | Yes | Yes | `packages/solidcash/test/e2e/InheritedUsingForReceiver.test.ts`; compile coverage `packages/solidc/test/solidity-compat/libraries-imports.test.ts` | Supported subset |
| Enums and user-defined value types | Yes | Yes | Yes | Yes | `packages/solidcash/test/e2e/EnumParam.test.ts`, `EnumCast.test.ts`, `EnumMappingKey.test.ts`, `YulUdvtPacking.test.ts` | Supported |
| Events and custom errors | Yes | Yes | Yes | Yes | `packages/solidcash/test/e2e/EventAnonymousE2E.test.ts`; custom errors `SolidityCorpusBehavior.test.ts`, `packages/testing/test/framed/revert-matchers.test.ts` | Supported; error arguments are artifact metadata, not on-chain revert data |
| try/catch | Yes | Yes | Yes | N/A | `packages/solidc/test/solidity-compat/expressions-control-flow.test.ts` | Supported syntax; a failed call fails the whole transaction, so `catch` bodies never run |
| External reads/calls and returns | Yes | Yes | Yes | Partial | `packages/solidcash/test/e2e/CrossContractCallInfra.test.ts` (including unbounded `bytes` returns), `packages/solidc/test/ExternalCalls.test.ts` | Experimental for composed state mutation; circular-address shapes deferred; a low-level call's `success` is always true |
| CREATE/CREATE2 | Yes | Yes | Yes | Yes | `packages/solidcash/test/e2e/ContractDeployment.test.ts`, `_Create2ComputedSalt.test.ts` | Supported for documented SDK transaction builders; deploy entries need a trusted-key signature check |
| fallback/receive | Yes | Yes | Yes | Yes | `packages/solidcash/test/e2e/FallbackReceive.test.ts`, `FallbackWithInput.test.ts` | Supported |
| Proxy/delegate calls | Yes | Yes | Partial | Partial | `packages/solidcash/test/e2e/DefaultProxyIntegrity.test.ts`, `UpgradesDeployProxy.test.ts` (data-NFT state) | Built-in `upgrades.deployProxy` profile supported for scalar/data-NFT state; custom forwarders and other delegate shapes remain experimental; no token/satoshi movement or fallback-only transparent proxy |
| Inline assembly/Yul | Yes | Yes | Subset | N/A | VM spends `packages/solidcash/test/e2e/{YulInlineAssembly,YulMemoryByte,YulLogEvent,YulUdvtPacking,AssemblyReturnHalts}.test.ts`; differential `assembly.conformance.test.ts`; compile coverage `packages/solidc/test/InlineAssemblyYul.test.ts`, `packages/solidc/test/solidity-compat/yul-evm.test.ts` | Supported lowerable subset; EVM-only operations must produce a diagnostic. Known divergences: a signed high-level variable enters assembly as its sign-magnitude value rather than its two's-complement word (word builtins over it keep the checked signed operator; `sar`/`signextend`/`shl` fail closed on a negative one), `shr` by a runtime amount past about 80,000 bits fails instead of giving 0, and `exp` takes one loop pass per exponent bit, so a very wide runtime exponent can exceed the op-cost budget |
| Lifecycle deploy/upgrade/destroy/split/merge | Yes | Yes | Yes | Yes | `packages/solidcash/test/e2e/{ContractDeployment,Upgrade,Selfdestruct,SplitMerge,LargeContractSplitting}.test.ts` | Supported only for documented SDK transaction builders; delegate restrictions still apply |
| Hardhat/ethers-style testing | N/A | N/A | N/A | Partial | `packages/testing/test/`, `examples/testing-suite/test/` | Supported migration layer, not drop-in universal Hardhat compatibility |

Most VM evidence above compiles native SolidCash sources; the differential conformance suite runs both modes.

## Application porting notes

The frozen application gate records these source/workflow adaptations rather than presenting the examples as
unchanged EVM deployments:

| Pattern | Required SolidCash adaptation |
|---|---|
| ERC-20-like ledger | Balances use entry-NFT-backed mappings; callers prove the `from` identity with a public key and signature; `Transfer` is an NFT-commitment event. Native CashTokens remain preferable for transferable fungible assets. |
| Token integration | Connect the expected CashToken/covenant target explicitly; an arbitrary EVM token address is not a sufficient runtime identity. |
| Ownership/modifiers | Store or derive the authorized public key and express access checks with `checkSig`; modifiers are compile-time inlining, not EVM call context. |
| Escrow/oracle/timelock | Use `checkDataSig` for oracle messages and BCH transaction locktime/sequence rules for absolute or relative timing. |
| Upgradeable proxy | Deploy through the built-in `upgrades.deployProxy` profile; persistent state belongs to the proxy's NFT set and initialization runs through the proxy or is seeded at genesis. |
| Mapping plus dynamic array | Mappings use sorted entry NFTs and dynamic arrays use chunk NFTs; enable the documented chunked-array profile when needed. |
| Cross-contract calls | Connect the concrete category/locking-bytecode target and build the composed transaction; calls are co-spends rather than synchronous EVM message calls. |
| Events | Read decoded NFT-commitment logs through `queryFilter`, receipt events, or listeners; there is no EVM log bloom. |
| Custom errors/assert/revert | Error declarations and arguments are artifact metadata; failed execution surfaces through transaction preflight rather than EVM revert-data transport. |

## Permanent Bitcoin Cash differences

- State is held in covenant and CashToken NFT UTXOs, not EVM storage slots.
- Contract identity is category/locking-bytecode based; there is no persistent EVM account or synchronous call
  stack.
- `msg.sender`, `msg.value`, gas shims, block data, addresses, events, and transaction introspection follow the BCH
  definitions in the public documentation.
- Reentrancy and EVM gas accounting do not exist in the BCH execution model under the default (direct and
  message-bus) conventions; the framed convention runs a re-entrant call on a second master of the contract, in EVM
  order (`docs/framed/AUDIT_MSG_SENDER.md`).

## Measured parity

Measured 2026-10-11 on `feat/parity` (merged into `feat/per-call`) with `evmCompat: true`:

| Measure | Result |
|---|---:|
| solc corpus, single-file semantic and syntax fixtures that compile (`bench/solidity-corpus`) | 2720/2805 = 96.97% |
| solc corpus, fixtures solc rejects that SolidCash also rejects | 2009/2158 = 93.10% |
| Solidity-by-Example, compiled as-is (`bench/solidity-by-example`) | 138/141 = 97.87% |
| EVM-vs-BCH differential cases with the same result (`packages/solidcash/test/conformance`) | 672/676 = 99.41% |
| solc corpus semantic expectations executed on the BCH VM under the real BCH-2026 size limits, pure-function slice (`bench/solidity-corpus/semantic-runner.mjs`) | 1377/1477 = 93.23% |
| the same, stateful slice (deploy once, lines in order, before any divergence; includes external-call fixtures routed from the pure run; 15 lines need a commitment or input larger than a real node accepts and count as unmatched, 14 of them match under the mock's relaxed sizes) | 711/783 = 90.80% |
| the same, pipeline-specific expectations (`compileViaYul` true/false, excluded from both rates) | legacy 26/30, via-IR 94/103 |
| Executable corpus fixtures traced to a VM test (`bench/solidity-corpus/BEHAVIORAL_COVERAGE.md`) | 155/1506 = 10.29% |

The 4 differential divergences are `it.fails` cases: 3 native-mode casts (narrowing and same-width sign
reinterpretation revert by design; bytesN reads little-endian) and 1 SDK derivation gap (a tuple into two mapping
elements whose keys depend on the RHS keys one entry twice). Each conformance file was run after its last change;
files untouched by a change were not re-run for it. The semantic runner's mismatches are triaged in
`bench/solidity-corpus/semantic-scorecard.txt`; most remaining ones are BCH platform differences (an uncatchable failed
call in `tryCatch/*`, chain id, gas and blob fields) or runner-wrapper limits. Of the 88 failing corpus fixtures, 12 are deliberate security refusals (an unauthenticated deploy or
selfdestruct, an untrusted delegatecall target).

## Release rule

A source outside the supported rows may be rejected. It must not be silently compiled with incorrect covenant
behavior. Experimental features are not promoted to supported until their compiler, SDK, VM/adversarial, and BCHN
release gates all pass.
