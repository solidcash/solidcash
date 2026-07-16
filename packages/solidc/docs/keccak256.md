# keccak256 on SolidCash - implementation reference

This is the authoritative reference for how `keccak256` works in SolidCash: one model
(compute-and-commit side-cars), every mainstream form supported, sound by construction.
For the design rationale, budget measurements, and phase-by-phase history see
[keccak-result-nft.md](keccak-result-nft.md); for the fail-closed edges see
[deferrals.md](deferrals.md).

## 1. Summary

`keccak256(x)` compiles to a **co-spent side-car** rather than inline script. A side-car is a
small UTXO whose covenant runs keccak256 in its OWN per-input op budget, commits the digest to
its recreated NFT commitment, and self-preserves. The spending contract reads that commitment as
the hash result. keccak256 on BCH costs ~2.26M VM ops per 136-byte block; a contract cannot
afford that on its own input budget, so the work is delegated to a side-car input that carries
its own budget (see keccak-result-nft.md section 2). Inline keccak is fully eliminated - from
codegen AND from the artifact descriptor.

The model is EVM-faithful for the digest (same bytes ethers/solc produce) and the compiler emits
enough metadata for the SDK to co-spend side-cars transparently: `contract.unlock.f(x, hash)`
"just works" as long as side-cars are deployed at the branded address.

## 2. The co-spend mechanism (single call)

For `require(keccak256(preimage) == expected)`:

1. The SDK appends a side-car input feeding `<budget-pad> <preimage> <PUSHDATA(redeem)>` and a
   recreation output committing `R = keccak256(preimage)` to a mutable NFT.
2. The contract, at the keccak call site, reads the side-car input's bytecode with
   `OP_INPUTBYTECODE`, decodes the pushes, and performs four checks that make the result
   trustworthy:
   - **preimage bind**: `preimage == <the value being hashed>` (`OP_EQUALVERIFY`). Proves the
     side-car hashed OUR argument, not some other value.
   - **covenant integrity**: strip the redeem to the covenant and confirm it is the genuine
     compute covenant - `OP_HASH256(covenant) == <baked hash>` (single/multi call) or a direct
     byte-compare against the baked covenant constant (loops; see section 8). Proves the input is
     a real side-car, not an attacker UTXO with a fake output.
   - **result read**: read `output[slot].tokenCommitment` - that IS the keccak256 result `R`.
3. The side-car INPUT, when validated by the VM, runs its own covenant: it recomputes
   `keccak256(preimage)`, enforces `output[slot].commitment == R`, and self-preserves at
   `output[slot]`.

Checks (2) + (3) compose: the contract trusts `R` because the input is a genuine side-car
(covenant hash), it hashed our preimage (bind), and it recreated itself at the slot the contract
reads (self-preservation). See section 9 for the full soundness argument.

## 3. Endianness / EVM parity

The digest bytes match EVM keccak256 exactly (verified against `@noble/hashes` vectors). BCH is
little-endian sign-magnitude, but the side-car returns the raw 32-byte digest, so `bytes32`
comparisons behave as in Solidity. Selector-style `keccak256(sig)[:4]` from a literal signature is
const-folded at compile time (no runtime side-car). See platform-differences.md for the wider
BCH-vs-EVM primitive table.

## 4. Supported forms (the matrix)

| form | how | resolved by |
|---|---|---|
| stateless single `keccak256(param)` | 1 side-car, count-relative read (last input) | direct from args |
| stateless multi `keccak256(a); keccak256(b)` | N side-cars, slot-per-call | direct from args |
| stateless complex/nested `keccak256(keccak256(x))`, `keccak256(abi.encodePacked(..))` | side-cars + VM probe | `resolveKeccakPreimages` |
| direct stateful `keccak256(param)` | keccakSideCar block-layout slot, branded | args + block layout |
| complex/nested stateful | block-slot side-cars + derivation probe | `_extractStatefulKeccakPreimages` |
| transitive (callee hashes) | side-car co-spent INSIDE the callee's block | `_resolveExternalKeccakSideCars` |
| transitive + complex/nested in callee | probe the callee in isolation | `_externalKeccakProbeCtx` |
| front-region (blockhash / external-read before the keccak slot) | thread front-region inputs into the probe | `frontRegionInputs` in the probes |
| fixed-bound loop `for(i<3)` | unroll to N syntactic calls | `UnrollFixedBoundEntryLoop` |
| dynamic loop stateful `for(i<n)` | N trailing side-cars, progressive derivation | `_resolveStatefulKeccakLoop` |
| dynamic loop stateless `for(i<n)` | N side-cars spliced after the master | `addStatelessKeccakLoopCoSpends` |

All VM-verified end to end. Fail-closed edges (compound cases that throw) are in section 10.

## 5. The two covenant variants

Both variants are salt-independent (the salt is a 32-byte prefix stripped before the integrity
check). They differ ONLY in the self-preservation tail:

- **STATELESS (offset-from-end)**: `KECCAK256_COMPUTE_COVENANT` / `_HASH`. Self-preserves at
  `output[TXOUTPUTCOUNT - k]`; used by count-relative reads (stateless single/multi call). Tail
  `c0 c4 93 c3 94` = `INPUTINDEX TXOUTPUTCOUNT ADD TXINPUTCOUNT SUB`.
- **STATEFUL / absolute-forward**: `KECCAK256_COMPUTE_STATEFUL_COVENANT` / `_HASH`. Self-preserves
  at `output[OP_INPUTINDEX]` (input index == output index); used by block-layout slots AND by
  every dynamic loop (stateful and stateless). Tail `c0` = `INPUTINDEX`.

`keccakComputeLockingBytecode(salt, stateful)` and `buildKeccakComputeRedeem(salt, stateful)`
(utils) select the variant. The salt is the contract's token category for a branded (stateful)
side-car, or `KECCAK256_SHARED_SALT` (32 zeros) for a shared one - the salt=0 covenant skips the
brand check.

## 6. Complex / nested arguments (the VM probe)

When the hashed value is not a direct parameter (`keccak256(keccak256(x))`,
`keccak256(abi.encodePacked(a,b))`, a slice, ...), the compiler records `null` in
`keccakPreimageParams[i]` and the SDK resolves the preimage by a **VM debug probe**: co-spend N
side-cars (real preimages for resolved calls, a placeholder for the rest), evaluate the contract
input under the VM, and read the aborting call's argument off the trace at its `OP_INPUTBYTECODE`
step (`extractKeccakPreimageFromTrace`, before the binding `OP_EQUALVERIFY` aborts on the
placeholder). Nested calls abort inner-to-outer, so one `null` resolves per probe, in stack (not
emission) order. Loop until every preimage is known.

The probe assumes the preimage depends only on the function's args/state (not on surrounding-tx
introspection that would differ between the isolated probe and the real spend). If that were
violated the runtime preimage bind rejects at spend - fail closed, never a wrong hash.

## 7. Transitive (keccak in a called external function)

When contract A co-spends a stateful callee B whose function hashes, B reads a `keccakSideCar`
slot in B's OWN block, so B's side-car is co-spent + recreated INSIDE B's co-spend block. Handled
on both external-call paths (`externalCall` and the `B.outState.x` read):

- Direct-param preimages come from the call args.
- Complex/nested-in-callee preimages are resolved by probing B in ISOLATION
  (`_externalKeccakProbeCtx` builds B's master unlocker + all of B's data NFTs, then reuses
  `_extractStatefulKeccakPreimages`).
- **SHARED salt=0 side-car** (key): a transitive co-spend cannot brand to B, because the branded
  covenant brand-checks input 0 - which for a transitive tx is the OUTER caller A, not B. The
  shared covenant skips the brand check; integrity is still enforced by B's baked covenant-hash +
  preimage bind (only isolation is relaxed, exactly like a shared stateless side-car).

## 8. Front-region (blockhash / external reads before the keccak slot)

In a stateful block the slot order is `master < dataNft < readOnlyDataNft < blockhashOracle <
keccakSideCar`. When a contract also reads `blockhash(n)` or another contract's state, those
front-region slots shift the keccak side-car base past `1 + dataNftCount`. The complex-arg probe
and the loop probe thread the already-resolved front-region co-spends
(`[...externalReadUtxos, ...blockhashCoSpendUtxos]`) plus their self-preserving recreations
(`_frontRegionRecreate`) plus the blockhash freshness locktime, and compute the base from the
ACTUAL keccak slot offset, so the probe reaches the keccak call. Direct-param keccak with a
front-region already worked (the builder positions every slot); only the probe paths needed this.

## 9. Loops

### Fixed-bound (`for (int i = 0; i < 3; i++)`)
`UnrollFixedBoundEntryLoop` (guarded by `hasKeccakCall`) unrolls the loop into N syntactic calls
BEFORE keccak counting, so each iteration becomes an independent slot resolved by the ordinary
per-call path. `keccakInLoop` is NOT set.

### Dynamic / runtime-bound (`for (int i = 0; i < n; i++)`)
The iteration count is unknown at compile time, so the loop reads one side-car per iteration and
the SDK discovers N + each preimage by a progressive probe.

- **Read (compiler)**: `emitLoopKeccakSetup` pushes a 0-based counter before `OP_BEGIN`;
  `emitKeccakComputeCall` (loop mode, `keccakLoopActive`) reads the side-car at
  `masterInputIndex + blockSize + counter` for BOTH the input and the output, using the STATEFUL
  (absolute self-preserving) covenant, and increments the counter each iteration
  (`emitLoopKeccakTeardown` drops it after `OP_UNTIL`). Sets `AbiFunction.keccakLoopReads`.
  Because `emitMasterInputIndex` emits `OP_INPUTINDEX` for a stateless (non-delegate) contract and
  `blockSize` defaults to 1, the read is byte-identical for a stateless contract and a stateful
  blockSize-1 contract - so stateless loops reuse the proven stateful read + covenant
  (absolute-forward), no offset-from-end.
- **Resolve (SDK)**: a progressive VM probe co-spends k side-cars (first k-1 resolved, k-th a
  placeholder), evaluates the contract, and reads the aborting iteration's preimage; resolve one
  per probe until the placeholder is never read (loop exited) => N reached. Stateful:
  `_resolveStatefulKeccakLoop` (trailing region after the block, via STB `keccakLoopSideCars` /
  `keccakLoopRecreates`). Stateless: `addStatelessKeccakLoopCoSpends` splices the side-cars right
  after the master input and their recreations at the parallel output positions.
- **Sound by construction**: each iteration BINDS its side-car preimage == the running value, so a
  missing/wrong side-car aborts. No count-pin needed - extra trailing side-cars are independent
  self-preserving UTXOs the contract never reads.

**Two soundness bugs were fixed here (both were also latent in the stateful loop, masked because
its test only checked tx validity while the SDK derived state from the same corrupted trace):**
1. The loop counter increment had a spurious `popFromStack()` after `emitReplace` that dropped the
   tracked `(value)`, so `h = keccak256(h)` wrote to the wrong slot and `h` never advanced - a
   self-consistent-but-WRONG hash chain. Fixed by removing the pop (mirror the entry-loop counter,
   which is explicitly tracker-neutral).
2. The contract re-hashed the ~2.4KB covenant every iteration (~39 hash-digest iterations each),
   blowing the per-input hash-density budget at ~5 iterations. Fixed by pushing the compile-time
   covenant CONSTANT and `OP_EQUALVERIFY` instead of `OP_HASH256` + hash-compare - zero hashing in
   the loop, lifting the cap to the tx-size bound (~20-25 iterations per standard 100KB tx).
   Single/multi call keeps the tight 32-byte hash-compare.

All dynamic-loop tests now EXTERNALLY assert the chain result (`require(h == expected)`) so this
class of bug fails loudly.

## 10. Soundness (why it holds)

- **The contract validates each side-car it uses, independently.** Preimage bind + covenant
  integrity (hash or byte compare) + the side-car's own covenant enforcing
  `commitment == keccak256(preimage)` + self-preservation. A forged "side-car" fails the covenant
  check (closed); a genuine one can only return `keccak256(our preimage)`.
- **Count-agnostic.** The contract never assumes how many side-cars exist; extra ones are idle
  UTXOs, missing ones abort. This is why deploy-time over-provisioning and (future) split/merge are
  sound by reduction - the contract needs no change.
- **Fail closed.** Every unhandled compound edge throws in the SDK or aborts in the VM rather than
  producing a wrong result.

## 11. Deploy-time provisioning

The compiler counts references and exposes them so the SDK knows how many side-cars to deploy:

- `AbiFunction.keccakPreimageParams.length` - the static keccak256 call count of a function.
- `AbiFunction.keccakInLoop` - a call sits inside a loop (runtime-variable count).
- `ExternalLibraryAbi.minInstances` - the MAX call count across the contract's functions (each
  function co-spends its own per-call side-cars, so the largest function sets the floor).
- `ExternalLibraryAbi.unbounded` - some function hashes in a loop, so `minInstances` is a LOWER
  bound; the real need is the loop's runtime iteration count.
- SDK: `keccakSideCarRequirement(artifact)` -> `{ minInstances, unbounded } | undefined`.

| shape | minInstances | unbounded | deploy |
|---|---|---|---|
| one (single call) | 1 | false | 1 side-car |
| several (N calls in the largest fn) | N | false | N side-cars |
| many (keccak in a loop) | 1 (static floor) | true | provision for the expected iteration count |

Deploy mutable-NFT side-cars at `keccakComputeLockingBytecode(salt, stateful)` - branded (salt =
reversed category) for a stateful contract, shared (`KECCAK256_SHARED_SALT`) otherwise.

## 12. SDK usage

Transparent - the side-car co-spend is automatic from the recorded args:

```ts
// deploy min side-cars once (mutable NFTs at keccakComputeLockingBytecode(salt, stateful))
const tx = await new TransactionBuilder({ provider })
  .addInputs(await contract.getUtxos(), contract.unlock.verify(preimage, evmKeccak(preimage)))
  .addOutput({ to: contract.address, amount })
  .send();                       // addRequiredKeccakComputeCoSpends() runs inside send()
```

Stateful contracts co-spend through the auto-derivation (`StatefulContract`); the block-layout
slot, branded side-car, and result commitment are threaded through the derivation probes and the
final builder automatically.

## 13. Limits and deferrals (all fail closed)

- Dynamic loop practical cap ~20-25 iterations per standard 100KB tx (side-car budget pads);
  `MAX_ITERS = 64` hard ceiling.
- A single side-car funds at most 3 keccak blocks (~407 B preimage).
- Compound edges that throw (documented in deferrals.md): a dynamic loop sharing a function with
  another trailing user (mapping-write loop / container spend / transfers); a transitive callee
  with BOTH a complex/nested arg AND a front-region read; a >407 B preimage in one side-car.

## 14. Future: split/merge for side-car contention (POSTPONED, design only)

A side-car is one UTXO, so concurrency is capped at `(side-cars deployed) / (per-tx calls)`. The
sound mitigation reduces to "mint more genuine side-cars", because the contract is count-agnostic
(section 10) and needs no change:

- **Split = mint**: a minting-capability side-car whose covenant lets anyone mint additional
  mutable side-cars, gated on every minted output being byte-identical to the canonical side-car
  (same covenant, same category, mutable). Permissionless is safe - extra side-cars are harmless,
  and a mint that produced a different covenant would be rejected by the contract anyway. Most
  valuable for the shared salt=0 pool (global contention); branded pools are per-contract isolated.
- **Merge**: mostly unnecessary (side-cars self-recreate on co-spend, so the pool count is
  stable). A "burn excess to reclaim dust" path is a griefing vector unless gated (deployer sig /
  timelock); omitting it is simplest.
- Dispatch would mirror the blockhash-oracle wipe flag: a leading unlocking flag selects `compute`
  (existing, contract-bound) vs `mint` (new), never letting `mint` reach the compute path.

## 15. Code map

**Compiler (`packages/solidc`)**
- `semantic/SymbolTableTraversal.ts` - selection: sets `keccakCompute` for every keccak function,
  `keccakInLoop` via `keccakCallInLoop`; `computeBlockLayout` allocates `keccakSideCar` slots for
  non-loop stateful functions.
- `semantic/UnrollFixedBoundEntryLoop.ts` - `hasKeccakCall` guard unrolls fixed-bound keccak loops.
- `generation/GenerateTargetTraversal.ts` - `emitKeccakComputeCall` (the co-spend codegen; loop vs
  block-slot vs count-relative read; hash-compare vs covenant-constant compare); `emitLoopKeccakSetup`
  / `emitLoopKeccakTeardown` / `blockHasKeccakCall` (dynamic loop counter); the compute dispatch and
  the skipped inline loader.
- `artifact/Artifact.ts` - the `resultNft` descriptor branch (omits inline blob fields;
  `minInstances` / `unbounded`).

**Utils (`packages/utils`)**
- `keccak-compute-library.ts` - the covenants + hashes (`KECCAK256_COMPUTE_COVENANT[_STATEFUL]`,
  `..._HASH`), `buildKeccakComputeRedeem`, `keccakComputeLockingBytecode`, `KECCAK256_SHARED_SALT`,
  `keccakSideCarRequirement`.
- `artifact.ts` - `ExternalLibraryAbi` (`blobHash` optional, `resultNft` / `minInstances` /
  `unbounded`), `AbiFunction` (`keccakCompute` / `keccakPreimageParams` / `keccakInLoop` /
  `keccakLoopReads`), `BlockSlotKind` includes `keccakSideCar`.
- `external-library.ts` - `BUILTIN_LIBRARIES.keccak256` (compute-only now; the blob is vestigial,
  supplying only the abi + the canonical script reference).

**SDK (`packages/solidcash`)**
- `keccak/keccakComputeSidecar.ts` - `buildKeccakComputeSidecar` (build one side-car input +
  recreation), `extractKeccakPreimageFromTrace` (probe trace reader), `pushDataBytes`,
  `keccakComputeBlocks`.
- `TransactionBuilder.ts` - `addRequiredKeccakComputeCoSpends` (auto co-spend, branches on
  `keccakLoopReads`), `resolveKeccakPreimages` (stateless complex/nested probe),
  `addStatelessKeccakLoopCoSpends` (stateless dynamic loop), `addKeccakComputeCoSpend`.
- `stateful/StatefulContract.ts` - `_resolveKeccakComputeCoSpends` (stateful fixed),
  `_extractStatefulKeccakPreimages` (stateful complex/nested + front-region),
  `_resolveStatefulKeccakLoop` (stateful dynamic loop + front-region),
  `_resolveExternalKeccakSideCars` + `_externalKeccakProbeCtx` (transitive + complex-in-callee),
  `_frontRegionRecreate`.
- `stateful/StatefulTransactionBuilder.ts` - positioning + recreation options:
  `keccakComputeCoSpendUtxos` / `keccakComputeCommitments` (fixed slots), `keccakLoopSideCars` /
  `keccakLoopRecreates` (dynamic loop), `keccakInputs` / `keccakRecreates` (transitive).

## 16. Tests

- `packages/solidc/test/KeccakCompute.test.ts` - compute-model selection + provisioning fields.
- `packages/solidc/test/UserLibrary.test.ts` - keccak256 is always compute (no inline).
- `packages/solidcash/test/KeccakResultNft.test.ts` - stateless single/multi/complex/nested +
  fixed-bound loop, VM e2e + negatives.
- `packages/solidcash/test/Keccak256.test.ts` - stateful direct/complex, transitive (incl.
  complex/nested-in-callee), dynamic loops (stateful hash-chain + salted + stateless), all with
  external chain assertions + negatives.
- `packages/solidcash/test/e2e/BlockOracle.test.ts` - front-region: blockhash + nested keccak, and
  blockhash + dynamic loop.
- `packages/utils/test/keccak-compute-library.test.ts` - the covenant variants +
  `keccakSideCarRequirement`.
