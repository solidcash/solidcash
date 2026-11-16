# External calls on array-element targets (`IFoo(arr[i]).m()` in a loop)

Status: IMPLEMENTED & e2e-green (Phase 1). Motivating corpus contract: `events-advanced/EventsAdvanced.sol`
(`for (i < subscriberList.length) IEventSubscriber(subscriberList[i]).handleTransferEvent(...)`).
e2e: `packages/solidcash/test/e2e/ArrayExternalCall.test.ts`. See "Status: implemented" at the end for the
final composition (the hard part).

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

## Status: implemented

Detection: `collectExternalCalls` (SymbolTableTraversal) sets `slot.loopArrayVar` when the call address is
`arr[i]` with no `addressParam`; surfaced to the artifact as `externalCalls[].loopArrayVar`. Note a STATE-array
element access in the cast `IFoo(arr[i])` is a `MappingAccessNode` (the flattened state-array model), so that
branch is load-bearing; a real `mapping(k=>address)` reaches it too and is rejected in codegen
("must be a state array"). Tested: basic (1 chunk), multi-chunk (boundary straddle), mapping-rejection.

Codegen: `emitArrayExternalCallLoop` (GTT) reads the whole array to a blob (`emitReadStateArrayBlob`, which
co-spends the array's chunks once), decodes the count, then loops `OP_BEGIN..OP_UNTIL` decoding each framed
element and verifying `callee[externalCallInputBase + i*stride].master.LBC == arr[i]` plus master/category
preservation and the selector. Each call the source loop makes claims the element after the one claimed before it
and binds the arguments it names (on a table of received pointers, at the callee input the next entry of its witness
list names), and after the loop the last claim must be the last element: the loop calls every element once, in
order, or none (then no callee is checked). Strict: count pinned to N, each callee verified against arr[i]. The array
is read as the loop saw it: before the function's writes to it when they all follow the loop, after them when they
all precede it; a function writing it inside the loop, or on both sides, is refused
(`LOOP_ARRAY_WRITTEN_AROUND_CALLS`). A write inside a loop goes through the `__dlcache_` loop cache, whose writes
count as the array's.

SDK: `registerExternalArray(interfaceName, instances)` lists the callee instances (array order);
`_createBuilder` expands the one loop slot into N concrete calls (`presetResolved`) so the existing
auto-derivation co-spends + state-derives each callee.

The hard part - trailing-input composition. The array's chunk run (read at `blockSize+i`) and the loop's
callee run share the trailing input space. Resolution: the chunk run is co-spent immediately after the block
(nothing between, so `blockSize+i` is correct) and the callees go AFTER it. Four coordinated SDK points, all
keyed off `iterationEntryInputs.length` (0 when no array read, so single-call paths are unchanged):
- `_buildInputs`: when chunks + external calls, callees are placed after the chunk run (input order
  `master..chunk..callees`).
- `externalCallInputBase` (StatefulContract): `+= iterationEntryInputs.length`.
- `build()` outputs: the chunk preservation outputs are emitted BEFORE the callee outputs (the covenant
  checks callee `output[idx] == input[idx]` by index, so output order must mirror input order).
- `getExternalCallMasterInputIndex` / `getExternalCallOutputBase`: `+= iterationEntryInputs.length` so the
  auto-derivation probes the right callee input/output (else each callee's state stays underived = 0).

Subscribers update state permissionlessly when co-spent: the publisher's sig authorizes only the publisher's
input and is NOT forwarded (one sig cannot validate multiple inputs - distinct sighashes per input).

Phase-2 leftovers (unchanged): per-element return values, loop-variable args, entries/low-level co-resident
with the array read (the input/output order above handles only the array-read + callee combination).

## Function-pointer arrays: call semantics (Solidity parity)

A `function(P) external[] fns` table (fixed-method, varying-method, or received-value; lowered to
`address[]` + a parallel `bytes[] __fnsel_<name>` selector array when methods vary) follows Solidity call
semantics:

- **`fns[idx](args)` outside a loop calls ONLY element `idx`**: the lowering hoists
  `address __fnelem = fns[idx];` (+ `bytes4 __fnelemsel = bytes4(__fnsel_fns[idx]);` as a runtime selector
  when per-element methods exist) and emits one computed-receiver external call. Value-returning calls work
  in this form.
- **`fns[i](args)` inside a loop is the notify-all idiom** and maps to the broadcast covenant above: the
  epilogue co-spends and verifies EVERY element once, in order, so the loop's calls must take the elements in turn,
  as over any state array (a spend that stops early, skips or repeats an element, or runs past the end fails). Any
  index expression and loop form works. A broadcast cannot return a value (compile error).
- Every element written into a fixed or varying table must name one method taking the table type's parameters
  and returning its results (`FnPtrArrayLoweringError` otherwise): a call through the table binds those arguments
  for whichever element it reaches. A received pointer's selector is a run-time value, so a received table cannot
  check that the method it names takes no further parameters. Instead the caller pins every push ahead of the
  declared arguments to constants:
  - for a void pointer, at most `4f 00`: a record witness that names no record, then an empty genesis call;
  - for a returning pointer, the record witness, which stays free, then at most one push, which must be `OP_0`.

  A method with extra parameters therefore runs only on those constants, never on values the spender chooses. A
  call through a pointer never carries a non-empty genesis call, so it cannot answer a constructor's call slot.
- Mutations stay in lockstep with the selector array: element assign / `pop()` / `delete fns[i]` rewrite to
  two-statement blocks mutating both arrays.
- An unclassifiable fn-ptr array (never written, or written an unsupported value form) is a specific
  `FnPtrArrayLoweringError` at compile time.

e2e: `FnPtrDispatchTables.test.ts` (all table kinds: loop-spelling broadcasts + single-element calls,
returning, mutation lockstep, mixed inline+received, state-var-pointer push).

## Computed per-iteration targets (the `__internal__loopTargets` witness rewrite)

Status: IMPLEMENTED & e2e-green. Motivating corpus contract: `UniswapV2Router02._swap`
(`for (i < path.length-1) IUniswapV2Pair(pairFor(factory, path[i], path[i+1])).swap(...)`).
e2e: `packages/solidcash/test/e2e/TypedComputedLoopDispatch.test.ts`.

The array-element loop above co-spends a KNOWN array (`arr[i]` read from state / a param). A Router-style loop
instead calls a **computed** target that depends on the loop index:

```solidity
for (uint i = 0; i < path.length - 1; i++) {
  IUniswapV2Pair(UniswapV2Library.pairFor(factory, path[i], path[i+1])).swap(a0, a1, to, new bytes(0));
}
```

`pairFor(...)` is a per-iteration CREATE2 address. `SynthesizeExternalAddressLocals` (SEAL) cannot hoist it to
a body-top `__extaddr_` local because a leaf (`path[i]`) is loop-dependent (a loop-body local is not
single-assign). Rather than fail closed, the SymbolTable collect phase rewrites the call target to read a
**synthesized `address[] __internal__loopTargets<n>[i]` witness param** and routes it through the SAME typed
inline-loop dispatch as the array-element form (per-iteration identity co-spend + master/category preservation;
no return-event for a void call). The resulting `externalCalls` slot is byte-identical to the array-element
case apart from the `loopArrayVar` name (`__internal__loopTargets<n>` vs the state/param array), so it reuses
the audited codegen.

Mechanics (`SymbolTableTraversal`):
- `findLoopIndexInComputedTarget` walks the computed target for the loop index - a bare-identifier array-access
  index (`path[i]`), resolving inliner aliases (`findLocalInit`) and tuple binds (`(input,output)=(path[i],
  path[i+1])`, `findTupleInit`).
- `rewriteExternalTargetToLoopWitness` replaces the target with `__internal__loopTargets<n>[loopIdx]` and the
  witness param is synthesized next to `__internal__externalCallInputBase`. Its array-access identifier is
  back-linked to the fresh symbol (`ExternalCallSlot.loopWitnessArrayId`) so TypeCheck and codegen resolve it.
- Fires ONLY for a loop-dependent computed target; a non-loop / single-assign computed target still SEAL-hoists.

SDK (`buildTypedLoopCallTransaction`, `loop-call.ts`): fills the synthesized witness with the co-spend targets
the caller derived for the route and co-spends each typed-void (no minting NFT / return-event, unlike the
opaque MultiCall builder). Layout: input 0 = caller (preserved at output 0); inputs 1..N = co-spent targets
(preserved at outputs 1..N); input N+1 = funder; output N+1 = change. Sets
`__internal__externalCallInputBase = 1` and `__internal__loopTargets<n>` = the encoded targets.

Soundness (as of 2026-11-15): the co-spent callee is identity-verified per iteration against the witness
(`input[base+i].bytecode == witness[i]`). Whether the witness is itself checked depends on the target:
- A target computed with keccak256 (a CREATE2 `pairFor`) can equal no BCH lock, so its witness is the spender's
  choice and is never compared with the computed value. Routers work, and the spender may name any contract as
  each turn's callee. Each such call warns, `[computed-call-target-unverified]`: before relying on the callee's
  answers to release funds, call through an address the contract stores (a registry lookup) instead of a computed
  one.
- Any other target, including a plain element of a parameter array (`IFoo t = IFoo(targets[i]); t.m()`) and a
  per-turn target computed without a hash, is checked: the witness must equal the target the contract evaluates, so
  a check on `targets[i]` or on the local binds the callee (`a2daffa5e`). Before that commit a plain element's
  witness was never compared with the element, so a registry check on `targets[i]` did not bind the callee.
- A target read from a local or state array, a mapping or another contract's result keeps its on-chain value, which
  the witness must equal.

A loop-body LOCAL receiver `IPair pair = IPair(pairFor(.., path[i], ..)); pair.m()` (SEAL leaves the local
un-hoisted - a loop-body local is not single-assign - and it is loop-consumed, so unreadable at the epilogue) is
handled for the SINGLE-use case: the collect phase rewrites the call to the witness AND neutralizes the now-dead
`pairFor` initializer to read the SAME witness (else it recomputes on-chain and size-faults). The slot carries a
LIST of witness identifiers (call + init), both back-linked. Gated on a per-function external-call RECEIVER-count
map snapshotted before any rewrite, so only a single-use local qualifies.

Stateful autoderivation IS implemented: a `StatefulContract` caller with a computed-target loop needs no explicit
builder call - register the route's target instances (`registerExternalArray(interfaceName, [..])`) and the
autoderivation co-spends them (the array-slot expansion) AND fills each `__internal__loopTargets<n>` witness with
their addresses in co-spend order (`StatefulContract._createBuilder`, ordered after `externalCallInputBase`, before
the selectors). A MULTI-method interface (Uniswap's `IUniswapV2Pair` shape) works too: a loop-expanded slot owns ONE
shared selector param (checked against each co-spent element), filled once at the range start. Router02 is stateful,
so its entry functions use this path. e2e: `StatefulComputedLoopDispatch.test.ts` (single- and multi-method).

A MULTI-use local receiver (`pair.getReserves(); pair.swap(..)`, Router02's `_swapSupportingFeeOnTransferTokens`)
cannot co-spend its callee once per call, since one master input runs one call per transaction.
`rewriteMultiUseViewCalls` replaces each view call with a per-turn witness the spender supplies
(`__internal__viewReturn<n>`), which nothing checks, and keeps the one state-changing call. Since 2026-11-15 it does
so only for a keccak256-computed target, whose callee the spender already chooses, and warns at each view call
(`ab06c65cf`). Two or more calls through any other loop local are refused at compile time
(`LoopLocalRepeatedCallsError`): before, a plain element of a parameter array took the rewrite too, so its view
answers were the spender's even when the contract checked the element against a registry.
