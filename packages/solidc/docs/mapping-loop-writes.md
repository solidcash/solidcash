# Mapping writes in loops

Writing a C2 mapping inside a loop (`for (uint i = 0; i < n; i++) m[k[i]] = v[i];`) is supported through fixed
unrolling, invariant-key caching, and the runtime sorted-upsert covenant. The old unsorted `key || value` entry
model described in early design notes is gone; every persisted node is `slot[32] || nextSlot[32] || valueTail`.

Current runtime support includes pure set, `+=`, `-=`, and delete-to-default, including absent-key insertion,
same-gap chains, repeated recipients, and canonical counter loops (`m[i]`) reordered by an authenticated SDK-
supplied slot permutation. The remainder of this file records both the shipped design and historical rationale.

## 1. Fixed-bound loops -> unrolled

A loop whose iteration count is a compile-time constant (`for (int i = 0; i < 3; i++)`, or `i < arr.length`
where `arr` is a fixed-size array) is unrolled to N static writes with the loop variable substituted by each
literal (`UnrollFixedBoundEntryLoop`, run before symbol resolution). Distinct constant-index keys get distinct
entry slots, so the unrolled form is exactly N hand-written static writes - no new covenant. Bounded at N <= 64.

## 2. Dynamic-bound loops -> runtime entry-mint covenant loop

A loop whose count is only known at runtime (`for (uint i = 0; i < ks.length; i++)` over a calldata array, or a
`while` / `do-while`) compiles to a native `OP_BEGIN`/`OP_UNTIL` covenant loop that mints one new entry NFT per
iteration at a **runtime counter-indexed trailing output** - the same shape as the dynamic-storage chunk write:

- Before `OP_BEGIN`: precompute the collection's entry NFT P2SH32 address and a counter (`entries-written-so-far
  = 0`), both persisting across iterations.
- Each iteration (`emitLoopEntryWrite`): build the expected commitment `key_enc ++ value_enc`; compute
  `outIdx = masterInputIndex + blockSize + counter`; verify output[outIdx] has that locking bytecode, the
  master's base category with the mutable (0x01) capability, and that commitment (a tight `<expected> <outIdx>
  OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY` the SDK reads back); then `counter++` in place.
- After `OP_UNTIL`: pin the number of tx outputs at the entry address to the counter (no orphan / duplicate entry
  outputs), then drop the temps.

The SDK derives the N `(key, value)` pairs from the VM trace progressively (the VM halts at the first mismatched
`OP_EQUALVERIFY`, so each probe reveals one more commitment) and builds N trailing entry outputs. This is a
runtime-variable output count, exactly like `dynamicChunkVars`.

## Soundness rules

The following bullets describe the original unsorted loop-mint path and are retained as historical threat-model
context. Mandatory C2 now routes varying-key writes through the sorted-upsert machinery; invariant keys are cached
and flushed once. Authenticated reverse-suffix chunk outputs support both invariant and per-key values above 60
bytes. Current restrictions include multi-collection interleaving, unsupported loop-local value expressions,
duplicate keys in array-mutation loops, and the composition cases listed in `sorted-mapping-c2.md` §10.1.

The write is sound only when each iteration writes a **distinct** entry. The compiler enforces the checkable part
of that and fails closed (`EntryWriteInLoopError`) otherwise:

- **Key must vary per iteration.** A loop write is accepted only when its key references a loop-mutated variable
  (the induction variable, or a local transitively derived from it). An invariant key - `for (i<n) m[k] = v`,
  `k` fixed - would mint N entries for the same key (ambiguous read); it is **rejected**.
- **Supported value sources are explicit.** Literal, invariant parameter, and aligned parameter-array values are
  supported. An arbitrary loop-local expression such as `m[ks[i]] = i` still fails closed.
- **RMW and delete are supported by the sorted-upsert path.** The historical restrictions below explain why the
  former unsorted design could not support them safely.
- **Single collection.** Two different collections written in one loop is **rejected** (the covenant precomputes
  one entry address / trailing region). A sound extension (interleave M entries per iteration at stride M with M
  per-collection count-pins, or M separate trailing regions) is deferred - no current use case needs it.
- **Array mutations are authenticated.** Varying-key push/pop/index assignment reconstructs and authenticates one
  old whole-array witness per effective key. Duplicate mutation keys are rejected because they require sequential
  folding over one co-spent entry.

## Historical RMW blocker and C2 resolution

`for (i<n) m[k[i]] += v[i]` (ERC1155 `_batchMint`/`_batchBurn`/`_batchTransfer`) needs to read the OLD value of
`m[k[i]]` each iteration, add, and write the sum. This splits by whether the key already exists:

- **Existing keys (sound, but partial).** Force-co-spend each key's entry NFT at `input[blockSize + counter]` and
  pin its decoded key `== k[i]` (exactly the dynamic-storage chunk read's `chunkIndex == i` pin), read old from
  its commitment, write `old + v[i]` to `output[blockSize + counter]`, and pin both the input and output entry
  counts to N. Because the covenant *requires* the entry at that slot, it cannot be omitted - no C2. This is sound
  but only covers keys that already exist.
- **New keys (unsound).** A first-time `+=` (e.g. `_batchMint` to a fresh account) has no entry to co-spend, so
  the read must fall back to the type default (0). That default-on-absent read is exactly the C2 omission attack
  (`mapping-omission-security.md`): a spender omits an existing entry, the covenant reads 0, and writes `v[i]`
  instead of `old + v[i]` - **resetting a token balance**. For a batch balance update this is a fund-safety
  hazard, not just self-denial.

So the *useful* case (mint to new accounts) is unsound, and the *sound* case (all keys pre-exist) does not close
`_batchMint`. RMW therefore stays `EntryWriteInLoopError` (fail-closed) rather than shipping a caveated covenant.
The sound existing-keys-only variant is a clean future addition (reuse `emitDynamicReadLoop` for the input read
and `emitVerifyChunkUtxoCount(isOutput=false)` for the input-count pin), gated to reject any not-yet-existing key.
Closing the new-key case needs the C2 fix itself: an entry-set accumulator (count / merkle / nullifier root)
committed in the master, so an existing entry cannot be omitted.

**Resolution:** mandatory C2 closes the omission hazard because every old-value read is membership- or exclusion-
proven. The runtime sorted-upsert loop now implements existing updates, absent inserts, same-gap chains, and
delete-to-default. The same-key case is coalesced by `CacheMappingEntryInLoop`; canonical counter keys are lowered
by `LowerC2CounterLoops` to full-width slot order.

### Current operational limits

- Duplicate keys in ordinary set/arithmetic loops are deduplicated or folded according to the operation. Duplicate
  keys in varying-key array-mutation loops are rejected until sequential mutation folding is implemented.
- Derivation and covenant verification scale with the number of effective keys and value chunks. Practical
  transaction-size, fee, and VM-operation limits are reached before the commitment format's theoretical bounds.
- The authoritative fail-closed feature list is `sorted-mapping-c2.md` §10.1.

## Verified

`packages/solidcash/test/e2e/DynamicLoopEntry.test.ts` (for / while / do-while, N=1..3, each entry reads back),
`DynamicLoopEntryAdversarial.test.ts` (wrong commitment, redirected address, and orphan output all rejected),
`EntryWriteBehavior.test.ts` (invariant-key caching, counter/array-key set and RMW, and counter-key deletes).
