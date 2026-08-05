# SolidCash 0.13.1 Solidity Compatibility Manifest

Status: release-candidate contract (conservative)  
Applies to: `solidc` 0.13.1 with `solidityImportCompat: true`

This manifest defines the compatibility claims for 0.13.1. “Supported” means the construct has parser, semantic,
code-generation, and behavioral coverage on Bitcoin Cash. It does not imply EVM execution, EVM storage layout, or
Hardhat byte-for-byte compatibility. Anything marked experimental is outside the stable release subset and must
fail before broadcast when its required transaction shape cannot be constructed.

| Area | Parse | Type check | Codegen | SDK | Behavioral evidence | 0.13.1 status |
|---|---:|---:|---:|---:|---|---|
| Integers and checked/unchecked arithmetic | Yes | Yes | Yes | Yes | `packages/solidc/test/solidity-compat/expressions-control-flow.test.ts`, `packages/solidcash/test/e2e/SolidityCorpusBehavior.test.ts` | Supported |
| ABI encode/decode | Yes | Yes | Yes | Yes | `packages/solidc/test/solidity-compat/calls-abi.test.ts`, `packages/solidc/test/AbiEncoding.test.ts` | Supported subset; EVM selectors require `evmCompat` |
| Structs and fixed arrays | Yes | Yes | Yes | Yes | `packages/solidc/test/StructsMappings.test.ts`, `packages/solidc/test/solidity-compat/storage-collections.test.ts` | Supported |
| Dynamic arrays | Yes | Yes | Yes | Yes | `packages/solidcash/test/e2e/`, `packages/solidc/test/Arrays.test.ts` | Supported within documented commitment/chunk limits |
| Mappings | Yes | Yes | Yes | Yes | `packages/solidcash/test/e2e/SortedMappingComputedKeyRmw.test.ts` | Supported subset, including VM coverage for computed and last-use local keys; documented dynamic-loop/chunk limits apply |
| Inheritance and modifiers | Yes | Yes | Yes | N/A | `packages/solidc/test/solidity-compat/inheritance.test.ts`, `packages/solidc/test/Modifiers.test.ts` | Supported subset |
| Events and custom errors | Yes | Yes | Yes | Yes | `packages/solidc/test/solidity-compat/events-errors.test.ts`, `packages/solidcash/test/e2e/EventAnonymousE2E.test.ts` | Supported |
| External reads/calls and returns | Yes | Yes | Yes | Partial | `packages/solidc/test/ExternalCalls.test.ts`, `packages/solidcash/test/e2e/CrossContractCallInfra.test.ts` | Experimental for composed state mutation; unbounded-byte return and circular-address shapes deferred |
| Proxy/delegate calls | Yes | Yes | Partial | Partial | `packages/solidcash/test/e2e/DefaultProxyIntegrity.test.ts` and delegate tests under `packages/solidcash/test/e2e/` | Built-in `upgrades.deployProxy` profile supported for scalar/data-NFT state; custom forwarders and other delegate shapes remain experimental; no token/satoshi movement or fallback-only transparent proxy |
| Inline assembly/Yul | Yes | Yes | Subset | N/A | `packages/solidc/test/InlineAssemblyYul.test.ts`, `packages/solidc/test/solidity-compat/yul-evm.test.ts` | Supported lowerable subset; EVM-only operations must produce a diagnostic |
| Lifecycle deploy/upgrade/destroy/split/merge | Yes | Yes | Yes | Yes | lifecycle tests under `packages/solidcash/test/e2e/` | Supported only for documented SDK transaction builders; delegate restrictions still apply |
| Hardhat/ethers-style testing | N/A | N/A | N/A | Partial | `packages/testing/test/`, `examples/testing-suite/test/` | Supported migration layer, not drop-in universal Hardhat compatibility |

## Permanent Bitcoin Cash differences

- State is held in covenant and CashToken NFT UTXOs, not EVM storage slots.
- Contract identity is category/locking-bytecode based; there is no persistent EVM account or synchronous call
  stack.
- `msg.sender`, `msg.value`, gas shims, block data, addresses, events, and transaction introspection follow the BCH
  definitions in the public documentation.
- Reentrancy and EVM gas accounting do not exist in the BCH execution model.

## Release rule

A source outside the supported rows may be rejected. It must not be silently compiled with incorrect covenant
behavior. Experimental features are not promoted to supported until their compiler, SDK, VM/adversarial, and BCHN
release gates all pass.
