# keccak256 via a result-NFT side-car (compute-and-commit model)

Status: **SHIPPED - the keccak256 model for stateless direct-param keccak, single AND multi-call
(slot-per-call); sections 11-13.** Complex-arg / nested / stateful keccak still falls back to the inline path
(see [external-libraries.md](external-libraries.md)), which is being eliminated (section 13). Here the hash is
computed inside a **co-spent side-car input's own** script evaluation and returned to the contract through the
side-car's **NFT commitment**, instead of being computed on the contract input's stack.

This doc records the full evaluation (why, the budget evidence, the soundness argument, the branded
model, endianness) and the phased build plan. The single-hash branded case is the near-term target; the
3-hash batch is documented but deferred.

## 1. Why a second model

The shipped model loads the keccak blob from a side-car and runs `OP_INVOKE` **on the contract input's
stack** - so keccak's operation cost is charged to the *contract's* per-input budget, and the result is a
value already on the contract's stack. That is simplest for one or two hashes.

The compute-and-commit model moves the hashing into the side-car input:

- The keccak op-cost is charged to the **side-car** input's budget, not the contract's. A compute-heavy
  contract keeps its entire ~8M budget for its own logic and pays only cheap introspection to read the
  result.
- A single side-car input has a full dedicated budget, so it can host the maximum keccak work (3 blocks)
  without competing with contract logic - the natural home for batching several hashes.

Trade-off: at N=1 this is *more* machinery than inline-compute (an extra output + a cross-input read) for
a runtime win only when the contract's own budget is tight - but it keeps the contract's budget free and is
now the **default** for stateless single-call keccak (section 12). Inline-compute remains the fallback for
multi-call (until the batch, section 7), stateful, and complex-arg keccak.

## 2. Budget evidence (BCH-2026 VM, measured)

Measured in `keccak-poc/measure-multi.mjs` (op cost of N sequential keccak blocks in one input, pad in
that input's unlocking) and `measure-introspect.mjs` (cross-input read cost):

| work | op cost | budget @ max unlocking | headroom |
|---|--:|--:|--:|
| 1 block (<=135 B msg) | 2,266,014 | ~7.76M (9,703 B unlk) / ~8.0M (10,000 B) | 70.8% |
| 2 blocks | 4,520,478 | " | 41.8% |
| 3 blocks | 6,774,942 | " | **12.7%** |
| 4 blocks | ~9,029,000 | " | **fails (exceed op cost)** |

- Cost is ~2.254M **per keccak block**, essentially independent of message size within a block (32 B and
  135 B both cost one block; 136 B and 200 B both cost two). The real ceiling is **<=3 keccak blocks per
  input** - a >135-byte preimage silently costs 2. Enforce in blocks, not calls; fail closed.
- Per-input budget ~= `41 + 800 * unlockingByteLength`; the 10,000-byte standard unlocking cap puts the
  ceiling at ~8.0M. 4 blocks (~9.0M) exceed it at any unlocking size - a hard impossibility, not a knob.
- Reading another input's full ~10 KB unlocking via `OP_INPUTBYTECODE` + split costs ~20K op (<0.5% of a
  padded budget). The binding read is effectively free.

## 3. Data flow (single hash)

```
side-car input (branded, salt = C):
    unlocking:  <P> <pad>                       (P and pad arrive natively on the side-car's stack)
    redeem:     drop pad; R = keccak(P)         (charged to the SIDE-CAR budget; ~2.26M per block)
                enforce OUT[k].commitment == R   (R in EVM byte order; k = side-car's own output index)
                enforce OUT[k] preserves the side-car (locking + category + mutable capability)
                enforce some input has token category == C   (branded: co-spent with contract C)

contract input:
    verify UTXOBYTECODE(sidecar) is the branded side-car (salt == C + covenant/blob hash == const)
    R = OUTPUTTOKENCOMMITMENT(k)                 (cheap introspection)
    P_side = decode INPUTBYTECODE(sidecar) args; EQUALVERIFY P_side == my P   (bind preimage)
    use R
```

- The side-car reads P off its **own stack** (unlocking runs first) - no self-introspection.
- The contract reads P from the side-car's unlocking by **cross-input introspection** (`OP_INPUTBYTECODE`
  + the shared pushdata decoder), the same way SolidCash extracts external-call args + code.

## 4. Branded model = isolation + integrity

The side-car's P2SH address is salted with the contract's token category **C** (branded; one side-car per
contract, as in the shipped model). Two enforcement directions, both required:

- **Contract -> side-car (integrity, mandatory for soundness).** The contract verifies the co-spent
  side-car is the genuine keccak-computing covenant branded to *its own* C: read `OP_INPUTBYTECODE`, check
  the revealed redeem's salt == C and the covenant+blob portion hashes to a baked constant. Without this,
  an attacker co-spends a malicious "side-car" that writes an arbitrary R to its commitment; the contract
  would bind the right preimage yet read a forged hash. This is the integrity root: R is trusted because
  it comes from a UTXO whose address commits to the correct covenant.
- **Side-car -> contract (isolation, the user requirement).** The side-car covenant enforces that an input
  of token category **C** is co-spent, so the side-car is **spendable only alongside the stateful contract
  of that exact category**. This gives contention isolation (each contract drives only its own side-car),
  DoS/griefing resistance (no third party can consume the contract's side-car UTXO), and lifecycle
  alignment with the contract's state-UTXO serialization.

The side-car is itself a **mutable NFT** of its own category K (minted once when deployed with the
contract), persistent across spends; each spend rewrites its commitment to the current R and self-
preserves. "Mutable NFT attached to the side-car" is literal: the result lives in the side-car's own
commitment. Deploy once, with the contract, only if the source references `keccak256`.

## 5. Endianness

`keccak256` output is stored in the NFT commitment in **EVM byte order (big-endian)** - the canonical hash
as seen in Solidity / on Ethereum. The keccak blob (`keccak-poc/genvar.mjs`) already emits EVM-endian
output (it reverses lanes on squeeze; `test-msg.mjs` matches `@noble/hashes` vectors byte-for-byte), so
the side-car commits the blob output verbatim - no reversal. Note the platform tension: SolidCash values
are little-endian sign-magnitude (see platform-differences.md), while keccak here is EVM-BE; the committed
result is the EVM hash, and any internal LE reinterpretation is the contract's `bytes32` return handling,
not the commitment's.

## 6. Soundness conditions (single hash)

1. **Integrity** - contract verifies the side-car is the branded genuine covenant (section 4, direction 1).
2. **Binding** - contract decodes the side-car's unlocking preimage and `OP_EQUALVERIFY`s it == its own P,
   so R is `keccak(my P)` and not `keccak(attacker P)`.
3. **Preservation** - side-car covenant pins its output's locking + category + mutable capability +
   `commitment == R`, so the value the contract reads is the value the side-car computed.
4. **Isolation** - side-car enforces category C co-spent (section 4, direction 2).
5. **Budget** - <=3 keccak blocks in the side-car input (1 block for a single <=135 B preimage), fail closed.

Single-hash has no ordering, no offsets, no reversal: R is the whole 32-byte commitment.

## 7. Three-hash extension (deferred; documented)

`keccak256(P1); keccak256(P2); keccak256(P3);` folds into one branded side-car invocation, in the
static / independent / unconditional / single-block **best case**:

- **One commitment holds all three results.** The 2026 upgrade raised the token commitment cap to **128
  bytes** (`compiler.ts:76` `commitmentLimit: 128`), so `R1 || R2 || R3` = 96 bytes fits with 32 to spare.
  The side-car's own mutable NFT carries them; the contract reads at fixed offsets `[0:32] [32:64]
  [64:96]`. **No multi-NFT layer** - no `nftIndex` tags, no per-NFT category pins, no permutation surface
  (you cannot permute byte offsets inside one committed blob). The commitment even fits a 4th 32-byte
  result; the 3-block op budget, not the commitment, is the cap.
- **Reversed unlocking layout for human-readable output.** The SDK reverses encoded args
  (`solidcash/src/utils.ts:245`), so feeding preimages reversed - unlocking pushes `... P3 P2 P1 pad` so
  **P1 lands on top** - makes the side-car pop `P1 -> P2 -> P3` in source order and concatenate `R1 || R2
  || R3`. The covenant stays the natural top-down one; the reversal lives only in (a) the SDK layout and
  (b) the contract's compile-time reconstruction for the bind-compare - both compile-time constants from
  the same AST call order.
- **The one silent-if-wrong spot:** the side-car's concat order vs the contract's split offsets must
  agree. The 128-byte commitment carries only hashes (no room for preimages), so there is no on-chain
  (preimage, hash) cross-check - the correspondence rests on the covenant pair's shared constant. A
  mismatch produces a wrong hash with **no abort** (not fail-closed). This is the highest-value adversarial
  test: with 3 distinct preimages, assert slot i's hash is `keccak(the contract's i-th preimage)` and not
  its mirror.
- **Budget:** <=3 blocks total across the batch, enforced in blocks (compiler counts `ceil((len+1)/136)`
  per preimage), fail closed.

**Exits the best case** (fall back to inline-compute or fail closed): dynamic/looped call counts (slot
count not static), `keccak256(keccak256(x))` (data dependency), keccak under divergent branches (batching
pre-hashes a not-taken path), any preimage >135 bytes (eats 2 of 3 blocks).

## 8. Phasing

- **Phase 0 - VM PoC** (`keccak-poc/`): hand-authored 2-input tx proving the single-hash spine end-to-end
  on the BCH-2026 VM (side-car computes + commits + self-pres + brand-check; contract reads + binds).
  Negative cases: wrong preimage, wrong committed hash, missing category-C input. **DONE.**
- **Phase 1 - compiler + SDK single hash**: **SHIPPED + VM-verified (mock).** See section 11.
- **Phase 1b - DEFAULT + arbitrary length + transparent send**: **SHIPPED (2026-07-16).** See section 12.
- **Phase 2 - multi-hash batch**: reversed layout, offset-split commitment, correspondence constant, block
  cap, reversal adversarial test. Deferred (multi-call keccak currently auto-falls-back to the inline model).

## 11. Phase 1 as shipped (2026-07-15) - historical snapshot

> **Superseded by sections 12-13.** This records the initial opt-in landing. Since then: the
> `keccakResultNft` flag was **removed** (compute is the implied default, section 12); the covenant self-pres
> moved from last-output to `INPUTINDEX`-relative for multi-call (section 13); and inline keccak is being
> eliminated. The mechanics below (opt-in flag, last-output self-pres, 2353 B covenant) are the 2026-07-15
> state, not current.

Single-hash, VM-verified end-to-end on the mock BCH-2026 VM. Was opt-in via `CompilerOptions.keccakResultNft`
(since removed); the inline-compute model was the default (additive, non-breaking - existing keccak tests unchanged).

- **utils** (`packages/utils/src/keccak-compute-library.ts`): `KECCAK256_COMPUTE_COVENANT` (2353 B baked
  hex, regen tool `keccak-poc/gen-compute-sidecar.mjs`), `KECCAK256_COMPUTE_COVENANT_HASH`,
  `buildKeccakComputeRedeem(salt)` / `keccakComputeLockingBytecode(salt)` (P2SH32, redeem =
  `OP_PUSHBYTES_32 || salt(32) || COVENANT`), `keccakComputeResultCommitment`. Covenant: brand-check input-0
  category == salt, drop C+pad, `R = keccak(P)` on a clean stack (EVM byte order), enforce
  `last-output.commitment == R` + preserve locking/category/capability. Self-pres is **last output**
  (`OP_TXOUTPUTCOUNT OP_1SUB`), matching the shipped side-car so `addRequiredSidecars`-style last-in/last-out
  co-spend works. 7 utils tests (byte-identity + VM e2e side-car + negatives).
- **compiler**: `GenerateTargetTraversal.emitKeccakComputeCall` emits the contract-side read (last-input
  `OP_INPUTBYTECODE` -> fixed-offset strip -> `hash256(covenant) == const` integrity + preimage bind ->
  last-output commitment read). Gated in `visitFunctionCall` + the prologue loader skip on
  `compilerOptions.keccakResultNft`. `Artifact.ts` stamps `externalLibraries[].resultNft = true`.
- **SDK**: `Contract.usesExternalLibraries` excludes `resultNft` (no budget pad / `OP_DROP`);
  `TransactionBuilder.addRequiredSidecars` skips `resultNft`; new
  `TransactionBuilder.addKeccakComputeCoSpend(preimage, {salt?})` computes `R = keccak256(preimage)` (@noble),
  co-spends the branded side-car as LAST input + recreates it as LAST output carrying `R`. 4 e2e tests
  (`solidcash/test/KeccakResultNft.test.ts`): compiles w/ no blob, side-car computes + contract reads matches
  EVM, rejects wrong `e`, rejects a tampered commitment.

**v1 scope / caveats (follow-ups):** preimage constrained to 32 bytes (fixed-offset codegen; arbitrary
`bytes` needs the generic pushdata decoder). Last-input/last-output convention (composition caveat, same as
the shipped side-car) - the block-layout-slot upgrade (section 10) is the composition-safe follow-up. Brand
check reads input 0 (contract/master at input 0). Contract-side integrity verifies `hash256(covenant)` +
binds the preimage but not `salt == own category` (correctness holds via integrity+bind; the side-car's own
brand check gives isolation) - contract-side `salt == C` is a hardening follow-up. Side-car mutable-NFT
**deploy** (minting category K) is manual/test-provided; an `addKeccakComputeSidecarDeploy` + regtest run are
follow-ups. Transparent `contract.call.fn().send()` auto-co-spend (preimage extraction from the call arg) is
not wired - callers invoke `addKeccakComputeCoSpend` explicitly.

## 9. Relationship to the shipped side-car

Same branding idea (address salted with C, deploy-once-with-contract), but the redeem is a different
covenant: the shipped one is a passive blob holder (`buildSidecarRedeem` in
`utils/external-library.ts`: `<salt> OP_DROP | self-pres | PUSHDATA(blob) | OP_DROP OP_1`) that the
contract reads and runs; this one **runs keccak itself** and commits R. Integrity shifts from the
contract's blob-hash check to the contract's branded-address check plus the side-car's own covenant. The
two models can coexist: inline-compute for N<=2 / simple, compute-and-commit for the batch / budget-tight.

## 10. Discovery / placement - reuse the block-layout slot (evaluated 2026-07)

How does the contract locate its co-spent side-car(s)? **Reuse the existing block-layout slot machinery -
do not build new placement (append/prepend) infrastructure.** Grounding:

- `computeBlockLayout` (`semantic/SymbolTableTraversal.ts:7507`) is the single, centralized, ordered slot
  allocator. Current order: `master(0) -> dataNft* -> readOnlyDataNft* -> blockhashOracle* ->
  [outState/extcall reserved] -> entry* -> satoshiContainer -> tokenContainer* -> transfer* -> tcTransfer*
  -> event*` (loop-variable outputs live in the trailing `[blockSize, blockSize+N)` region).
- Every index resolves through `getBlockSlotOffset(kind, slotIndex)` (`generation/GenerateTargetTraversal.ts:563`).
- **The prepend intuition is already the structure.** Fixed co-spent auxiliaries (state, external reads,
  `blockhashOracle`, external-call groups) already sit in the FIXED FRONT region right after `master`; the
  runtime-variable outputs (transfer/tcTransfer/event/loop-entries) are already in the TAIL. That is exactly
  "constant positions, variability isolated to the tail" - no reorder needed.
- `block.*` / `blockhash(n)` already ride a front-region `blockhashOracle` slot, described in-code as a
  "read-only, self-preserving **1:1 input/output slot**" - the SAME shape as the keccak side-car. So the
  keccak library slot is a sibling of `blockhashOracle`: push an `externalLibrary` slot kind in the front
  region of `computeBlockLayout`, read it via `getBlockSlotOffset`, SDK co-spends at that slot.
- Non-stateful contracts have no block layout; they use the injected `__internal__<name>Index` +
  content-reverify pattern (as low-level calls and `blockhash` already do). Also existing.

**Hard constraint:** `master` MUST stay at offset 0 (state anchor for self-pin + auto-derivation). "Prepend
before master" is deep and regressive; the front region AFTER master already gives constant positions, so
there is no reason to. The layout's input/output index-alignment rationale (e.g. token containers placed to
keep input indices matching output indices) must also be preserved by any future reorder.

**DEFERRED (strong suggestion):** a "block layout v2" refactor unifying all co-spent auxiliaries (oracles,
libraries, external reads/calls) into one explicit front-region band with a single allocator + one SDK
co-spend driver. Right long-term shape, but a reorder across the 5 byte-matched covenant pairs + the green
`blockhashOracle` / external-call / entry-NFT e2e suites - disproportionate to shipping single-hash keccak,
and the per-mechanism versions already work. Do it as a separate, e2e-gated project. See docs/deferrals.md.

## 12. Phase 1b: DEFAULT + arbitrary length + transparent send (2026-07-16)

Three follow-ups landed, making the compute model the default for the case it fully supports.

- **Arbitrary preimage length.** `emitKeccakComputeCall` now decodes the pad + preimage with the generic
  pushdata decoder (`emitGenericPushdataDecode`) instead of fixed 32-byte offsets; the redeem stays
  fixed-size so its prefix/salt are stripped by constants. The SDK sizes the side-car op-budget pad by the
  preimage's keccak block count (`floor(len/136)+1`, cap 3). VM-verified for 0/1/32/135/136/200/300-byte
  preimages against EVM. `>3 blocks` (~407 B) throws (a single side-car input funds at most 3 keccak blocks).
- **Compute is THE keccak model - the `keccakResultNft` flag is removed (2026-07-16).** Selection is purely
  capability-based: `SymbolTableTraversal` sets `FunctionDefinitionNode.keccakCompute` when a function has
  exactly ONE `keccak256` call on a **direct parameter** and the contract is **stateless** (so `send()` can
  transparently co-spend from the arg). Artifact stamps per-function `keccakCompute` + `keccakPreimageParam`
  and the descriptor `resultNft`. **Inline keccak is being eliminated** (user decision: side-car-with-NFT
  only). Until the compute model covers every case, multi-call / stateful / complex-arg keccak still routes
  to the inline path as a temporary fallback - see "eliminating inline" below.
- **Transparent `send()` co-spend.** `TransactionBuilder.addRequiredKeccakComputeCoSpends()` (auto in
  `send()`) reads the preimage from the recorded param, computes `R` (@noble), and co-spends the side-car -
  idempotent, so an explicit `addKeccakComputeCoSpend` (e.g. for a non-param preimage) is respected.
- **One covenant, conditional brand (salt==C hardening).** The covenant brand-checks `input-0 category ==
  salt` **only when the salt is non-zero** (BRANDED, stateful): shared side-cars (salt=0, stateless) skip it,
  so a stateless contract co-spends without carrying a token, while a branded side-car stays spendable only
  alongside its category. Salt-independent -> one covenant hash. Covenant 2390 B; regen
  `keccak-poc/gen-compute-sidecar.mjs`.

## 13. Eliminating the inline keccak path (in progress, 2026-07-16)

**Decision (user): keccak256 is side-car-with-NFT ONLY. The inline keccak path is being removed.** The
`keccakResultNft` flag is gone; keccak is the compute model wherever it applies today (stateless single-call
direct-param), and the remaining inline usages are being migrated. The generic external-library machinery
(loader / registrar / `addRequiredSidecars`) stays for USER libraries; only keccak256 stops using it.

Migration plan (each step keeps single-call green; the per-function selection flips to allow the case only
once its codegen + SDK land):

1. **Multi-call (slot-per-call). SHIPPED + VM-verified (2026-07-16).** N direct-param keccak calls -> N
   side-car inputs (the last N) + N result outputs (the last N). One covenant self-preserving + committing at
   `outIdx = OP_INPUTINDEX + OP_TXOUTPUTCOUNT - OP_TXINPUTCOUNT` (generalizes single-call's last-output; for
   N=1 it *is* the last output). Contract call `i` (emission order) reads `input[TXINPUTCOUNT-(N-i)]` (bind) +
   `output[TXOUTPUTCOUNT-(N-i)]` (result). SDK `addRequiredKeccakComputeCoSpends` co-spends N side-cars in
   call order (picking a fresh UTXO each - deploy one mutable-NFT side-car per call); compiler records
   `FunctionDefinitionNode.keccakPreimageParams: (string|null)[]` in `emitKeccakComputeCall`; the selection
   requires EVERY call to hash a direct param (`allKeccakCallsDirectParam`). Each side-car input has its OWN
   ~8M budget, so N calls are N independent inputs - no shared 3-block cap (compute scales past inline). e2e:
   two `keccak256(param)` calls -> two side-cars, each result read by slot, matching EVM; wrong slot rejected.
2. **Complex / nested args (VM-probe extraction). SHIPPED + VM-verified (2026-07-16).** `keccak256(expr)` /
   `keccak256(keccak256(x))` where a call's preimage is not a direct param (`keccakPreimageParams[i] == null`).
   `SymbolTableTraversal` now selects compute for EVERY stateless keccak (the `allKeccakCallsDirectParam` gate
   is gone); codegen records `null` for non-param args. The SDK resolves nulls via a VM debug probe, the exact
   `blockhash` precedent: `TransactionBuilder.resolveKeccakPreimages` temporarily co-spends all N side-cars
   (real preimage/commitment for resolved calls, placeholders for the rest), calls `keccakProbeVm.debug({
   inputIndex, sourceOutputs, transaction})`, and `extractKeccakPreimageFromTrace` walks the trace for the LAST
   executed `OP_INPUTBYTECODE` step whose top-of-stack (the side-car input index) is in the reserved range
   `[base, base+N)`; the preimage `arg` is `stack[len-2]` and the call's slot is `idx - base`. Identify the
   step by opcode (`step.instructions[step.ip].opcode === OP_INPUTBYTECODE`), skipping not-taken branches
   (`controlStack.some(c => c===false)`). The value is captured even from a FAILING probe (abort at the bind).
   **Iterative resolution:** nested calls abort inner-to-outer (runtime order != emission order), so each probe
   resolves exactly one null - the aborting call - assigned by its **slot index** (not the loop index); loop
   until every preimage is known. VM-verified: `keccak256(keccak256(x))` (2-level), `keccak^3(x)` (3-level, two
   probes), `keccak256(abi.encodePacked(a,b))` (concat), and mixed direct+nested multi-call.
3. **Stateful (block-layout SLOT). DIRECT spends SHIPPED + VM-verified (2026-07-16).** The last-N approach does
   NOT port to `StatefulTransactionBuilder` (`send()` inserts the change output before the side-car recreation,
   and the derivation probes are `build()`-derived), so a stateful side-car rides a **block-layout slot**: a new
   `keccakSideCar` `BlockSlotKind` (sibling of `blockhashOracle`) in `computeBlockLayout`, positioned absolutely.
   As shipped:
   - **`BlockSlotKind` `'keccakSideCar'`** (`artifact.ts`); `computeBlockLayout` pushes one per keccak call right
     after `blockhashOracle` (`SymbolTableTraversal.ts`, gated on `node.keccakCompute`, count from
     `libraryCallCounts`). The compute decision now selects EVERY keccak (stateless AND stateful).
   - **Two codegen read paths** in `emitKeccakComputeCall`: `fn.blockLayout` -> `emitBlockSlotIndex('keccakSideCar', i)`
     (absolute, same index for the 1:1 input+output); else count-relative (stateless). `keccakPreimageParams` is
     reset per pass in `visitFunctionDefinition` (the node is revisited across sub-traversals).
   - **A SEPARATE stateful covenant.** The stateless covenant self-preserves at the output offset-from-end
     (`INPUTINDEX + TXOUTPUTCOUNT - TXINPUTCOUNT`), which only equals the slot when in/out counts match - false
     for a stateful tx. The stateful side-car's input and output share the block-layout index, so it
     self-preserves via the **active input index** (`OP_INPUTINDEX`). Only the tail differs (`c0c493c394` ->
     `c0`); `KECCAK256_COMPUTE_STATEFUL_COVENANT` + `..._HASH` in `keccak-compute-library.ts`, selected by
     `buildKeccakComputeRedeem(salt, stateful)` / `keccakComputeLockingBytecode(salt, stateful)`; the compiler
     bakes the matching hash by `fn.blockLayout`.
   - **SDK.** `StatefulContract._resolveKeccakComputeCoSpends` (mirrors `_resolveBlockhashCoSpends`): direct-param
     preimages from the call args, side-cars branded to the master category (salt = **reversed** category, since
     `OP_UTXOTOKENCATEGORY` is internal byte order), `buildKeccakComputeSidecar(.., stateful=true)`. Wired into
     BOTH the derivation probe (`_deriveCommitments` runProbe: inputs+outputs after blockhash; `entryBase`/
     `extraBase` bumped) and the final builder (`keccakComputeCoSpendUtxos` + `keccakComputeCommitments` STB
     options; positioning `case 'keccakSideCar'`, base sums, recreation loop, count helpers). `firstSidecarLib`
     skips `resultNft` so the inline loader is not required. Shared side-car construction:
     `keccak/keccakComputeSidecar.ts`.
   - **Complex/nested-arg stateful. SHIPPED + VM-verified (2026-07-16).** `keccak256(keccak256(secret))` /
     `keccak256(abi.encodePacked(..))` in a stateful contract (`keccakPreimageParams[i] === null`) resolves via
     `_extractStatefulKeccakPreimages`: a minimal VM probe (master + data NFTs + placeholder keccak side-cars at
     their block-layout slots), debug the master, read each unresolved call's arg off the trace at its
     OP_INPUTBYTECODE step (`extractKeccakPreimageFromTrace`, base = first keccak slot offset), iterative
     inner-to-outer. Threaded into both derivation call sites via a `probeCtx`. **Front-region oracles/reads
     (blockhash/external-read) before the keccak slot are SUPPORTED (2026-07-16):** the probe threads the already-
     resolved `[...externalReadUtxos, ...blockhashCoSpendUtxos]` (+ self-preserving recreations + the blockhash
     freshness locktime) so it reaches the keccak call, and reads the base from the ACTUAL keccak slot offset. VM
     e2e: nested keccak in a stateful `reveal`, AND `blockhash(bn)` + `keccak256(keccak256(p))`.
4. **Transitive (keccak in a CALLED external function). SHIPPED + VM-verified (2026-07-16).** A caller A reads/
   co-spends a stateful callee B whose function hashes; B's keccak reads a `keccakSideCar` slot in B's OWN block,
   so B's side-car is co-spent + recreated INSIDE B's co-spend block. Handled on BOTH external-call paths:
   - Shared resolver `StatefulContract._resolveExternalKeccakSideCars(bAbiFunc, args, bCategory)` (mirrors the
     master resolver for B).
   - **externalCall path**: `keccakSideCar` added to the `fullBlockKinds` gate + a switch case in the `bBlockInputs`
     builder (positions B's side-car at its slot); `keccakRecreates` on the group drives the recreation loop.
   - **externalOutState path** (the natural `B.outState.counter` read): the group carries `keccakInputs` +
     `keccakRecreates`; the outState input flatten appends the side-cars after B's data NFTs and the outState
     output recreation appends their recreations; the outState group-width base sums add the keccak count.
   - **SHARED (salt=0) side-car** (KEY): a transitive co-spend can't brand to B - the branded covenant brand-checks
     INPUT 0, which is the OUTER caller A, not B. The shared covenant skips the brand check (integrity still
     enforced by B's baked covenant-hash + preimage bind; only isolation relaxed, same as a shared stateless
     side-car). INPUTINDEX self-preservation is unaffected. e2e green (`Keccak256.test.ts` transitive).
   - **Complex/nested-arg in a transitive callee: SUPPORTED (2026-07-16).** `_resolveExternalKeccakSideCars` takes
     the callee `StatefulContract`; `_externalKeccakProbeCtx` builds B's probe context (B's master unlocked with
     the call args + ALL of B's data NFTs) and reuses `_extractStatefulKeccakPreimages` to probe B in isolation
     (salt=0), so B's `keccak256(keccak256(x))` resolves. VM e2e: nested keccak in a co-spent callee.

   **INLINE KECCAK IS ELIMINATED**: the selection sets `keccakCompute` for EVERY keccak function
   (`keccakCalls >= 1`), so `emitKeccakComputeCall` always fires and the inline blob loader/prologue is never
   emitted for keccak. The artifact descriptor for a `resultNft` (compute) library now OMITS the misleading inline
   fields (`blobHash` / `codeBegin` / `codeEnd` / `inline`) that described a blob the contract never loads
   (`Artifact.ts`; `blobHash` made optional). The keccak blob constant stays in `BUILTIN_LIBRARIES` only as the
   canonical script + to supply `abi` (documented vestigial). USER libraries keep the inline fields.

Also still open: side-car mutable-NFT genesis deploy helper (tests provision via `addUtxo`;
`keccakComputeLockingBytecode(salt, stateful)` gives the address); regtest. **Status 2026-07-16: steps 1 + 2 + 3
+ 4 done + VM-verified + green (ALL keccak - stateless single/multi/complex/nested, direct stateful, transitive
external incl. complex/nested, front-region blockhash/external-read, and runtime-bound loops stateful+stateless -
is compute; inline eliminated from codegen + descriptor).**

## 14. Deploy-time side-car provisioning (reference count + loop strain, 2026-07-16)

The SDK must know how many compute side-cars to deploy for a contract at creation time. The compiler counts
keccak256 references and exposes it in the artifact:
- **Per function**: `AbiFunction.keccakPreimageParams.length` is the static keccak256 call count;
  `AbiFunction.keccakInLoop` is set when any call sits inside a loop (all `for`/`while` desugar to While/DoWhile;
  detector `SymbolTableTraversal.keccakCallInLoop`).
- **Per contract (keccak256 descriptor)**: `ExternalLibraryAbi.minInstances` = the MAX call count across
  functions (each function co-spends its own per-call side-cars, so the largest function sets the floor);
  `unbounded` = some function hashes in a loop, so `minInstances` is a LOWER BOUND - the runtime need is the
  loop's iteration count, provision extra. Stamped in `Artifact.ts`.
- **SDK**: `keccakSideCarRequirement(artifact)` -> `{ minInstances, unbounded } | undefined` (undefined when the
  contract uses no compute keccak). Deploy `minInstances` mutable-NFT side-cars at
  `keccakComputeLockingBytecode(salt, stateful)`; when `unbounded`, deploy for the expected loop bound.
- **FIXED-bound keccak loops are SUPPORTED (2026-07-16):** `UnrollFixedBoundEntryLoop` (extended with a
  `hasKeccakCall` guard) unrolls a compile-time-bounded `for` loop containing keccak256 into N syntactic calls -
  N compute side-cars, each an independent slot resolved by the complex-arg probe (VM-verified: a 3-iteration
  hash chain). The unroll runs before keccak counting, so `keccakPreimageParams` / `minInstances` see the N
  calls and `keccakInLoop` is NOT set.
- A RUNTIME-bound keccak loop (`for (i < n)`, n dynamic) in a STATEFUL contract - **SHIPPED + VM-verified
  (2026-07-16):**
  - **Compiler:** `computeBlockLayout` allocates NO fixed `keccakSideCar` slots when `keccakInLoop`
    (`SymbolTableTraversal`); each iteration reads its side-car from the TRAILING region
    (`emitKeccakComputeCall` loop-mode: `masterInputIndex + blockSize + counter`), a 0-based counter pushed
    before `OP_BEGIN` by `emitLoopKeccakSetup` and incremented per iteration (dropped by `emitLoopKeccakTeardown`).
    Uses the stateful covenant (OP_INPUTINDEX self-preservation). Sets `AbiFunction.keccakLoopReads`. **Sound by
    construction:** each iteration BINDS its side-car's preimage == the running value, so a missing/wrong side-car
    fails closed (never accepts a wrong hash). No count-pin needed (extras are independent self-preserving UTXOs).
  - **SDK:** `StatefulContract._resolveStatefulKeccakLoop` runs a PROGRESSIVE VM probe: co-spend k trailing
    side-cars (first k-1 resolved, k-th a placeholder), debug the master, and `extractKeccakPreimageFromTrace(
    base = blockSize, k)` yields the aborting iteration's preimage; resolve one per probe until the placeholder
    is never read (`callIndex` already resolved) => N reached. Then co-spend N real side-cars into the trailing
    region and recreate each with R_i, via new STB `keccakLoopSideCars` / `keccakLoopRecreates` (positioned right
    after the fixed block, in the input flatten + the recreation loop). `_createBuilder` branches on
    `keccakLoopReads`; `_deriveCommitments` skips the fixed path for loops. VM-verified: a 4-iteration hash chain
    AND a 3-iteration salt-dependent (general, non-hash-chain) loop, both committing the true derived state, both
    EXTERNALLY asserting the chain result (`require(h == expected)`).
  - **CRITICAL fix (2026-07-16):** the loop counter-increment had a spurious `popFromStack()` after `emitReplace`
    that dropped the tracked `(value)`, so `h = keccak256(h)` wrote to the wrong slot and `h` never updated - the
    loop computed a SELF-CONSISTENT-BUT-WRONG chain (masked because the SDK derived state from the same corrupted
    trace, and the test only checked tx validity). Removed the pop (mirror the entry-loop counter). All loop tests
    now externally assert the chain result so this class of bug fails loudly.
  - **Per-iteration hashing:** the master compares the side-car covenant by pushing the compile-time covenant
    CONSTANT + `OP_EQUALVERIFY` (not `OP_HASH256` + hash-compare) - re-hashing the ~2.4 KB covenant each iteration
    blew the per-input hash-density budget at ~5 iters; the byte-compare has zero hashing cost, lifting the cap to
    the tx-size bound (~20-25 iters / standard 100 KB tx). Non-loop keccak keeps the tight 32-byte hash-compare.
  - **Front-region SUPPORTED (2026-07-16):** blockhash/external-read slots before the trailing region are threaded
    into the loop probe (same `frontRegionInputs` + recreations + locktime as the complex-arg probe); the base is
    the real `blockSize`. VM e2e: `blockhash(bn)` + a dynamic keccak loop. Still guarded: other TRAILING users
    (entries/containers/transfers) after the keccak region.
- A RUNTIME-bound keccak loop in a STATELESS contract (pure verifier) - **SHIPPED + VM-verified (2026-07-16),
  ABSOLUTE-FORWARD:** the loop read `masterInputIndex + blockSize + counter` is byte-identical for a stateless
  (`OP_INPUTINDEX`, blockSize 1) and a stateful blockSize-1 contract, so the SAME proven read + stateful
  (self-preserving) covenant is reused - no offset-from-end. `emitLoopKeccakSetup` drops the `blockLayout`
  requirement (keccakCompute only). SDK `TransactionBuilder.addStatelessKeccakLoopCoSpends`: progressive probe,
  SPLICE the side-cars right after the master input + their recreations at the parallel output positions (guard:
  master input index + 1 <= output count). VM-verified n=1..20 with an EXTERNAL target; fails closed on a wrong
  target.
