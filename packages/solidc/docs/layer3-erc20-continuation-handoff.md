# Layer-3 caller-authorized ERC-20: completion record

The milestone this document handed off is closed. It is kept as the record of
what the blocker actually was, since the original diagnosis was only half right.

## Objective (met)

> Two repeated `transferFrom` calls debit balances and
> `allowance[from][msg.sender]` under one balanced graph, with the caller
> derived from the authenticated parent participant, and fit every input under
> BCH's 10,000-byte input-script limit.

Executable evidence:
`packages/solidcash/test/e2e/Layer3CompiledGraphController.test.ts`

- `settles two msg.sender-authorized ERC-20 transfers in one balanced graph`
- `rejects substituting the allowance spender witness for the authenticated caller`

The honest token input measures **6,024 bytes** and the test asserts a
1,000-byte headroom budget, so the limit cannot be crept past unnoticed. The
`msg.sender` authorization was not weakened to a caller-supplied `spender`
parameter at the source level.

## What the blocker actually was

The handoff framed this as a size problem with a size solution (share the
direct implementation with the journal handler). Size was one of two blockers,
and code sharing at the arithmetic level was not where the bytes were.

### 1. Size: the bytes were in C2 covenant machinery, not handler logic

Measured, not guessed:

| region | bytes |
| --- | --- |
| direct `transferFrom` entry point | 3,174 |
| SCB1 route (2 rows) | 6,383 |
| SCB1 route at 1 row | 3,604 |

The value-threaded journal handler is ~64 bytes of arithmetic. Sharing it saves
~170 bytes. The remaining ~10,000 are per-entry C2 authentication and sorted-list
proof blocks, emitted inline and repeated byte-for-byte across rows, entries and
function bodies - roughly 40% of the artifact was byte-identical repeats.

The fix is a general one: `packages/utils/src/outline.ts` shares byte-identical
spans across OP_DEFINE'd bodies, exploiting that BCH-2026's `OP_INVOKE` runs a
function body without resetting the stack. Token redeem bytecode fell
10,511 -> 4,506. The Release 5 corpus five-function mapping ERC-20, which used
to carry a `contract-size-limit` error, now compiles to 4,494 bytes.

Relocation is refused for any span that is not self-contained: unbalanced
control flow (including an `OP_ELSE` whose `OP_IF` is outside - depth alone does
not catch this, and it was a real bug caught by the graph e2e suite), anything
containing `OP_DEFINE`, and anything reading bytecode-relative context
(`OP_ACTIVEBYTECODE`, `OP_CODESEPARATOR`, the `OP_CHECKSIG` family). Spans also
never swallow a require/`console.log` anchor, so failing-statement attribution
survives; the SDK debugger additionally resolves those pointers only against
steps running in the entry point's own frame.

### 2. Correctness: a `msg.sender` key made the settlement unsatisfiable

Even at zero bytes the honest path could not have passed.
`LowerCollectionJournalHelpers` only journals parameter-keyed entries, so a
`msg.sender` mapping key made it bail and the batched clone read and flushed the
allowance entry once **per row**: row 0 demanded a post-state of 40 on the entry
output while row 1 demanded 20. One output cannot satisfy both.

Since every `msg.sender` key witness is already required to equal
`__scb_graph_caller` at each row, all rows agree on one spender, so the clone now
takes it as an ordinary parameter fed by that same route witness. The direct
entry point still reads `msg.sender`; authorization is unchanged.

## Fixture bugs found on the way

Five, all in the test rather than the compiler, each of which had been masked by
the input being rejected for size before execution:

1. `Contract.lockingBytecode` is hex; `keyToSlotMulti` hashes raw bytes, so the
   allowance slot never matched the covenant's.
2. C2 batch groups follow the wrapper's journal order (allowance,
   `balances[from]`, then `balances[to]` per row), not entry-creation order.
3. Entry write-backs are positional (`activeInputIndex + 1 + group`), so the
   settled outputs must be emitted in that same order.
4. Slots are little-endian VM numbers compared with `OP_BIN2NUM`/`OP_LESSTHAN`;
   sorting them with big-endian `Buffer.compare` builds a linked list the
   sorted-list invariant rejects.
5. Entries are authorized by co-spending the token master (input 1), not by
   their own slot index.

## Density trade-off, recorded

BCH-2025 scales the operation-cost budget with the unlocking bytecode length, so
sharing spans buys bytes at the cost of density: the same work is billed against
a smaller budget. Participant-binding scaling at N=8 went 4,370 -> 3,081
instructions but 20.8% -> 36.5% of budget. Bytes are the hard consensus limit,
so this is the right direction - density is the thing to watch as scripts shrink,
and `Layer3ScalingSpike` now pins it explicitly.

## Test state

`yarn test` is green across all three packages: @solidcash/utils 295, solidc
2,315, solidcash 3,480. That includes seven measurements that were already stale
on this branch before this work (BatchCostRegression x2, MessageBusRoute's route
input list, and four Layer3 spike pins), which are now re-pinned.

## Still open

Unchanged from the original handoff - this milestone does not close them:

1. remaining handler/result/callback and resource/effect/event combinations;
2. general compiler auto-derivation of graph edges and relocatable balanced
   composition;
3. general transcript/version-retention and measured encoding limits;
4. BCH-2026 standard-policy, corpus byte budgets, contention, and immutable
   version-interoperability gates;
5. final requirement-by-requirement completion audit.

Do not state that the entire message-bus specification is implemented until the
ledger is re-audited against executable evidence for each normative item.

Two follow-ups this work exposed:

- Outlining only sees OP_DEFINE'd bodies. A single-function contract is emitted
  inline at the top level and gets no sharing (the ERC20_CALLEE direct compile
  stayed at 3,047 bytes for exactly this reason).
- The per-entry C2 machinery is still emitted inline before outlining dedupes
  it. Emitting it as a parameterized helper in the first place would beat
  post-hoc span sharing, which can only share what happens to be byte-identical.
