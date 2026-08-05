# Opus handoff: Effective Acceleration marketplace on native BCH

## Worktree and objective

Work only in this existing worktree:

```text
/Code/cashscript/.worktrees/effectiveacceleration-marketplace
```

Branch:

```text
codex/effectiveacceleration-marketplace
```

Objective: make `/Code/effectiveacceleration.ai/contract/.marketplace/project/test/marketplace.test.ts`
compile and run natively on BCH without modifying the marketplace source or its tests. The test project is
exposed in this worktree under `.marketplace/project`.

The worktree is intentionally very dirty and contains substantial unfinished work. Preserve all existing
changes. Do not reset, checkout, or discard them.

## User-authorized constraints

- Consensus checks for input count/size and transaction size may be bypassed temporarily. The mock provider
  supplies the relevant configuration.
- `solidcash_v0.13.1` has known pre-existing test failures. Ignore those for now; they are being fixed elsewhere.
- Symlinking `node_modules` into this worktree is acceptable if it works. If path resolution makes the symlink
  unsuitable, a recursive copy is an acceptable fallback.
- Do not alter the marketplace contracts or `marketplace.test.ts` to obtain a pass.

## Current plan/status

1. Canonical address/compiler SDK encoding inspection — complete.
2. External batch self-address reconstruction and artifact rebuilding — complete.
3. Focused unchanged marketplace test and successive native BCH failures — in progress.
4. Full unchanged marketplace suite and diagnostic cleanup — pending.

The focused test is:

```bash
env NODE_OPTIONS=--max-old-space-size=2048 SOLIDC_DEBUG_ROUTE_CONCISE=1 \
  node node_modules/vitest/vitest.mjs run \
  --config vitest.solidhat.config.ts --no-file-parallelism -t 'post job 1'
```

Latest output is in:

```text
/tmp/marketplace-tail-chunk-fix.log
```

## Most recent verified progress

The previous blocker was:

```text
dynamic storage chunk region for 'jobs' is not fully derived (0 of 2 chunks resolved)
```

That is fixed. Delegate dynamic chunks are emitted at the physical transaction tail, but derivation used the
delegate-local block offset (`8`) rather than their actual composed output positions (`107` and `108`).

The latest change in `packages/solidcash/src/stateful/StatefulContract.ts` introduces
`getPhysicalChunkOutputBase()` inside the phase-2 derivation loop. For delegate calls it derives the region from
the built probe output count, excluding the probe-only terminal funder remainder. `yarn workspace solidcash build`
passes, and the focused test now produces two real `jobs` commitments at outputs 107 and 108. The old unresolved
chunk error is gone.

## Current blocker

The unchanged focused test now fails in final preflight:

```text
messageBus: BCH-2026 preflight failed at input 3:
Program failed an OP_VERIFY operation.
```

The widened VM trace shows the failure inside an outlined equality helper invoked from the MarketplaceV1
delegate implementation near body IP ~1344. It is external-call identity verification:

- Callee master input/output index: `6`
- Physical callee master locking bytecode starts with:
  `aa201b0ec407724317ed993e82d2216a7692db17...`
- Expected address picked from the implementation stack starts with:
  `a914323844f5b0ce613ced9a025cb1dca82aa501...87`

The group at input 6 is the MarketplaceData proxy (`category e5ef7ec4...`). The expected value is its stable
logical P2SH20 CREATE address, while the co-spent state-holder master uses the physical BCH covenant bytecode.
`GenerateTargetTraversal.emitExternalCallVerification()` currently checks:

```text
B master UTXO bytecode == expected Solidity address
```

That is valid for ordinary stateful contracts but wrong for upgrade proxies whose public Solidity-compatible
address is logical. The SDK already translates direct function-argument targets to physical bytecode in
`packages/solidcash/src/stateful/upgrades.ts`, but this target is synthesized/read from Marketplace state on-chain,
so it cannot be rewritten off-chain without changing semantics.

## Recommended next design

Implement a sound proxy logical-identity proof rather than weakening or skipping the identity check.

Likely shape:

1. Co-spend the target proxy's immutable logical identity anchor for each distinct proxied external-call group.
2. Supply a compiler-owned hidden identity-anchor input index per external-call slot (similar to
   `__internal__extcallMasterIdx<slot>`).
3. In external-call identity verification, support either the ordinary direct master-bytecode equality or an
   authenticated logical-anchor path which proves:
   - anchor UTXO locking bytecode equals the expected logical address;
   - anchor NFT is immutable and has the callee root category;
   - its `SCID` commitment binds the physical root/master locking bytecode used by the callee.
4. Preserve/recreate each identity anchor output.
5. Ensure shared/repeated calls reuse one physical anchor and receive the correct absolute index.

Relevant implementation locations:

- `packages/solidc/src/generation/GenerateTargetTraversal.ts`
  - `emitExternalCallVerification()` around line 20209
  - `emitSlotMasterIndex()` around line 1320
- `packages/solidc/src/semantic/SymbolTableTraversal.ts`
  - hidden `__internal__extcallMasterIdx*` parameter synthesis around line 2540
- `packages/solidcash/src/stateful/StatefulContract.ts`
  - nested delegate external composition around lines 10220–10550
  - hidden argument injection around lines 11070–11140
- `packages/solidcash/src/stateful/StatefulTransactionBuilder.ts`
  - `ExternalCallUtxoGroup` and physical input/output assembly
- `packages/solidcash/src/stateful/logical-identity.ts`
  - `SCID` commitment format and `resolveLogicalIdentity()`
- `packages/solidcash/src/stateful/upgrades.ts`
  - existing logical-to-physical conversion for direct proxy arguments

Do not simply accept any P2SH20 expected address alongside an unrelated P2S master: the logical anchor must
cryptographically bind the visible address to that physical contract/category.

## Earlier fixes already in the worktree

- Repeated external batch reconstruction now resolves the logical P2SH20 self-address correctly; aggregate
  request encoding reached the exact expected 187 bytes.
- Default proxy delegate index generation uses bottom-relative tracked picks.
- Low-level SafeERC20 calls in repeated batches bind to their message-bus rows.
- Compiler batch descriptor return types are recovered by selector when outlined raw payloads lose their
  interface name. `approve`/`transferFrom` now return `bool`, eliminating the prior SafeERC20 decode failure.
- Address narrowing handles raw 20-byte, P2SH20 (offset 2), and P2PKH (offset 3) representations; this eliminated
  the prior `OP_SPLIT` failure at `abi.encodePacked(uint160(arbitrator_))`.
- Nested proxy route derivation resolves the group master by matching the built probe's actual outpoint rather
  than stale pre-build input ordering. The group-0 `__forward` route now completes successfully.

## Build/recompile commands

```bash
yarn workspace solidc build
yarn workspace solidcash build
rm -f .marketplace/cache/solidcash/jobs/0d6e50c17ac00bc4c728d6d7c817a076db3fc36be21d52efe198c5539c894b87.bin
node packages/solidhat/dist/cli.js compile --config solidcash.config.ts
```

Marketplace compilation can take 5–7 minutes. A compiler/artifact-affecting change requires cache invalidation
and recompilation. SDK-only changes generally need only `yarn workspace solidcash build` before the focused test.

## Temporary diagnostics to remove before completion

- `packages/solidcash/src/stateful/StatefulTransactionBuilder.ts`: VM trace ring was widened from 16 to 520;
  restore it to 16.
- `packages/solidcash/src/stateful/StatefulContract.ts`: `route-derive-start`, nearby input logging,
  `root-dynamic-chunk-scan`, repeated-route witnesses, and other `SOLIDC_DEBUG_ROUTE*` diagnostics.
- `packages/solidcash/src/stateful/StatefulContract.ts`: `fake-token-data-after-send` debug output.
- `packages/solidc/src/generation/GenerateTargetTraversal.ts`: temporary route/batch diagnostics, including expanded
  return-type/opaque-return output, unless a pre-existing useful guarded diagnostic should remain.
- Search broadly before final handoff:

```bash
rg -n "SOLIDC_DEBUG_ROUTE|root-dynamic-chunk-scan|route-derive-start|fake-token-data-after-send" \
  packages/solidc packages/solidcash
```

## Completion criteria

- The original marketplace source and tests remain unchanged.
- The focused `post job 1` test passes natively on BCH.
- The full unchanged `.marketplace/project/test/marketplace.test.ts` suite passes, aside from explicitly unrelated
  baseline failures if any are encountered and documented precisely.
- Temporary tracing is removed and trace ring restored.
- Relevant package builds pass.

