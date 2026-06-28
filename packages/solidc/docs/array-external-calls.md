# External calls on array-element targets (`IFoo(arr[i]).m()` in a loop)

Status: DESIGN (not yet implemented). Motivating corpus contract: `events-advanced/EventsAdvanced.sol`
(`for (i < subscriberList.length) IEventSubscriber(subscriberList[i]).handleTransferEvent(...)`).

## The pattern

```solidity
address[] subscriberList;                       // state array of callee addresses
function notify(...) {
  for (uint i = 0; i < subscriberList.length; i++) {
    IEventSubscriber(subscriberList[i]).handleTransferEvent(a, b, c);
  }
}
```

Each `subscriberList[i]` is a callee contract's address. No iterative auto-derivation is needed: the SDK
reads `subscriberList` from this contract's state at build time, so the callees are known and co-spendable;
the covenant verifies each (a wrong target just fails the tx).

## Key fact: address representation (resolved)

`address` is a **locking bytecode**, not a 20-byte hash: P2SH32 = 35 bytes, P2PKH = 25 bytes. `AddressType`
carries no fixed width. So `address[]` is a **framed chunk-packed** array (each element length-prefixed), NOT
fixed-width. The single-call external dispatch compares `OP_UTXOBYTECODE(callee.master) == addr`, so `addr`
is the full LBC; `subscriberList[i]` must therefore decode to the full LBC for the per-element comparison.

## Existing single-call machinery (to generalize)

- Codegen `emitExternalCallVerification` (GTT ~10199): per slot, computes the callee master input index
  `externalCallInputBase + slot.computedOffset` (compile-time `computedOffset`), then verifies
  `OP_UTXOBYTECODE(master) == addressParam`, master bytecode/category preservation (REGULAR), and the
  selector (first push of the callee's unlocking bytecode) == `__internal__externalCallSelector[slotIndex]`.
- Slot allocation (SymbolTableTraversal `collectExternalCalls` ~2787, offsets ~1026): one slot per call SITE;
  `computedOffset` is a compile-time constant. `addressParam` = the address IdentifierNode name (or
  `__extaddr_<v>` for a state var). No loop awareness.
- SDK co-spend (`externalCallUtxoGroups`, StatefulTransactionBuilder ~241): each group = callee master +
  required data NFTs, flattened into the trailing input run; the SDK resolves the callee from the external
  registry by interfaceName + the address arg.

## Architecture for the loop form

The call SITE executes N times (N = `arr.length`, runtime), so N callees are co-spent at a **trailing run**
`[base, base+N)` and the covenant verifies each in a loop (like `emitDynamicReadLoop` / collection iteration).

1. **SDK**: read `arr` from state (`StateReader` decodes the framed `address[]`), resolve each element to its
   callee contract (external registry by interfaceName), co-spend each callee (master + data NFTs) as a
   contiguous trailing run. Pin the count = N.
2. **Covenant** (codegen, a new `emitArrayExternalCallLoop`):
   - Read the whole `arr` once into an on-stack blob (REUSE the dynamic-array whole read / chunk read loop).
   - `count = arr.length` (`A$len / ...` or the framed count prefix).
   - `OP_BEGIN/OP_UNTIL` over i: decode `arr[i]` (the i-th framed element = callee LBC; reuse
     `emitPushdataDecode`), compute callee master idx = `externalCallInputBase + loopRunStart + i*stride`,
     verify `OP_UTXOBYTECODE(master) == arr[i]`, master preservation + category + selector. Body must be
     runtime-stack-neutral (visitCollectionIteration discipline).
   - Orphan-bound: pin exactly N co-spent callees at the run (no extra/missing), like the chunk orphan-bound.
3. **Block layout**: a runtime-length trailing run of N callee groups (N from `arr.length`), accounted in the
   shared trailing-offset arithmetic alongside chunk reads / collection-iter entries / dynamic writes.

## Soundness

Strict per-element: the covenant verifies `callee[base+i].master.LBC == arr[i]` for every i AND pins the run
count to N, so a spender can neither substitute a fake callee nor skip/add subscribers. The callee's own
self-pin (Stage 1) guarantees a matching LBC is the genuine master. (A relaxed "count + interface only"
model would let a signed spender fake the subscriber set - rejected.)

## Phasing

- **Phase 1 (EventsAdvanced)**: static args (same for every iteration - `handleTransferEvent` takes
  `msg.sender, to, value`, none loop-dependent) + **void return** (no per-element return-event UTXOs).
  Chunk-packed `address[]`. This is the clean subset and the implementation target.
- **Phase 2**: per-element return values (N return-event UTXOs, verified in the same loop); loop-variable
  args (`argSources` schema doesn't yet model the loop index); transitive callee external calls (B calls C,
  N times).

## Hard parts

- Framed per-element decode of `arr[i]` inside the verification loop (variable-width LBC elements), nested
  with the callee co-spend verification - intricate stack tracking (the recurring dynamic-storage hazard).
- The new trailing run (N callee groups) must compose with the existing trailing runs (chunk reads, old/new
  write chunks, collection-iter entries) in the shared `blockSize + sum(prior runs) + i` offset arithmetic.
- SDK: enumerate `arr`, resolve each element to a registered callee + its UTXOs, place contiguously; the
  registry currently maps one interface -> one contract, so N callees of the same interface need the SDK to
  resolve each element's address to its specific contract instance.

## Why a dedicated push

This is security-critical covenant codegen in a loop with a real soundness model - comparable in size to the
whole dynamic-storage phase-2 effort (multiple interlocking parts: codegen loop, SDK co-spend, block layout,
e2e), not a one-wall change. It should be implemented and e2e-validated as a focused effort, not rushed.
