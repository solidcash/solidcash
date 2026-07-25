# Balanced block layouts for contract composition

Status: **DESIGN REFINEMENT - DEFERRED, NOT YET APPLIED**

This note records a stronger SolidCash transaction-layout invariant than Bitcoin
Cash consensus requires. It is intended for a later compiler and SDK change.
Nothing in this document claims that the current implementation already
enforces the invariant.

## 1. The invariant

A valid BCH transaction may have unrelated input and output counts. A
composable SolidCash transaction must satisfy a stronger structural rule:

```text
for every physical contract block:
    block input count == block output count
```

Every local block slot has both a physical input index and a physical output
index:

```text
physicalInput  = blockBase + localSlot
physicalOutput = blockBase + localSlot
```

Input and output values at a slot need not be equal. "Balanced" means balanced
cardinality and index space, not value conservation per slot.

This keeps the input and output base of every following contract identical.
Blocks can then be concatenated without separately relocating their input and
output references.

## 2. Canonical composed shape

For a call from A to B where both contracts have state, A emits an event, B
returns a value and emits an event, and the transaction creates a settlement
output:

```text
INPUTS                                      OUTPUTS
------------------------------------        ------------------------------------
[0] A master                               [0] A recreated master/post-state
[1] A data or entry state, if needed       [1] A recreated data or entry state
[2] funding input                          [2] A ordinary event NFT

[3] B master                               [3] B recreated master/post-state
[4] B data or entry state, if needed       [4] B recreated data or entry state
[5] funding input                          [5] B return-event NFT
[6] funding input                          [6] B ordinary event NFT
[7] funding input                          [7] settlement/transfer output

[8] funding input covering >= full fee     [8] change
```

The blocks are:

```text
A block:  input/output [0..2], size 3
B block:  input/output [3..7], size 5
fee tail: input/output [8],    size 1
```

Therefore:

```text
A base    = 0
B base    = A base + A block size = 3
tail base = B base + B block size = 8
```

B's physical input and output bases are both 3. The contents of A's block do
not cause B's two index spaces to diverge.

## 3. Slot classes

### 3.1 State-preserving slots

A consumed master, data NFT, entry NFT, container, or other persistent state
UTXO is paired with its recreated output:

```text
state input <-> authenticated post-state output
```

The covenant defines whether value, locking bytecode, category, capability,
commitment, and token amount are preserved or transitioned.

### 3.2 Output-only semantic slots

An operation which logically creates only an output still receives a physical
input slot:

```text
funding input <-> event NFT
funding input <-> return-event NFT
funding input <-> transfer output
funding input <-> deployment output
funding input <-> other authenticated effect
```

The funding input may have any sufficient amount. The paired output will
normally carry 1,000 satoshis where a dust-bearing token output is required.
Excess input value contributes to fees or final change.

An output-only slot must never be inserted without its paired input. Otherwise:

```text
next input base != next output base
```

and contract blocks cease to be directly composable.

### 3.3 Input-only proof slots

If a future operation needs a proof input without a semantic output, it must
still reserve a paired output. The output must use an explicitly specified
authenticated neutral/preservation form; it may not silently shift the output
base.

The preferred design is to avoid input-only slots where the proof can ride an
existing state or funding slot.

### 3.4 Fee tail

The final fee input is paired with the final change output:

```text
fee funding input <-> change output
```

The change value is:

```text
sum(all input values)
  - sum(all preceding output values)
  - transaction fee
```

The fee input must cover the full remaining fee requirement. Ordinary
per-effect funding inputs should not make block layout depend on fee-estimation
side effects.

## 4. Value accounting

Balanced slots do not imply:

```text
input[k].value == output[k].value
```

Such equality is a covenant property only for slots that require value
preservation.

For an output-only slot:

```text
funding input value >= paired output value
```

The typical event or return-event output is 1,000 satoshis. The final change
output absorbs aggregate excess after the fee.

The SDK must perform whole-transaction value accounting after composing every
block, while preserving all compiler-assigned slot indices.

## 5. Events and OP_RETURN

The normal event representation should be the existing event NFT:

```text
funding input <-> covenant-authenticated event NFT
```

This representation:

- preserves balanced block cardinality;
- carries the ABI-encoded event in the NFT commitment;
- binds provenance to the emitting contract's category;
- supports multiple events without relying on nulldata relay policy;
- permits dust recovery after the event covenant's CSV delay; and
- reuses existing compiler block slots and SDK event decoding.

The current compiler event covenant uses a 144-block relative delay. Spending
the event NFT later does not remove the historical event from its creating
transaction.

An OP_RETURN record is not intrinsically free. If a protocol retains one, it
must also occupy a balanced slot:

```text
funding input <-> OP_RETURN output
```

It therefore adds an input, unlocking data, an outpoint, transaction bytes, and
a block-layout slot. OP_RETURN should be optional indexing metadata, not part of
the correctness model for journaling, calls, `msg.sender`, returns, or events.

In particular:

- `msg.sender` should be derived from the actual authenticated co-spent caller;
- invocation instructions should live in authenticated unlocking data or an
  execution commitment;
- return values should use return-event NFTs;
- Solidity events should use ordinary event NFTs; and
- journaled state should flush into normal authenticated state outputs.

## 6. Journaling is independent of event transport

The state journal is an execution and settlement mechanism:

```text
load authenticated pre-state
        |
        v
buffer reads and writes
        |
        v
execute internal/repeated calls
        |
        v
flush each physical state slot once
```

Neither an OP_RETURN output nor an event NFT is the journal itself. Event and
return outputs are observable effects allocated by the block layout. The
journal controls how state reads and writes are accumulated before the
post-state outputs are authenticated.

## 7. Composition rules

The eventual implementation should make these rules normative:

1. Every composed contract owns one contiguous physical block.
2. Every block has equal input and output counts.
3. Local input and output slot numbers share one block-relative index space.
4. Master and state slots pair consumed state with authenticated post-state.
5. Every output-only effect receives a funding input in the same local slot.
6. Every permitted input-only proof receives an authenticated paired output.
7. Child and subsequent blocks begin at the same physical input and output
   index.
8. The final fee input is paired with the final change output.
9. Conditional operations reserve stable slots or use an authenticated neutral
   representation; taking a branch must not shift later blocks.
10. No SDK or application output may be inserted between blocks outside the
    compiler-assigned layout.
11. Transitive composition applies the rules recursively; a nested call graph
    is flattened into a sequence of balanced blocks.
12. Auto-derivation may fill slot contents, but it may not redefine or compact
    the compiler-declared block topology.

## 8. Deferred implementation plan

### Compiler

- Represent every block slot as a paired input/output slot, including events,
  return events, transfers, deployments, and other output-only effects.
- Emit one block size and one local offset per slot rather than independently
  drifting input and output offsets.
- Reserve stable slots for conditional effects.
- Reject a function or composed call graph whose physical layout cannot be
  balanced without ambiguous or unauthenticated neutral slots.
- Include the balanced layout in the artifact so the SDK does not infer it from
  execution traces.

### SDK

- Allocate a funding input for every output-only slot.
- Use a normal 1,000-satoshi output for event/return-event token outputs unless
  the artifact specifies another bounded value.
- Concatenate contract blocks without inserting inputs or outputs inside them.
- Append one final fee/change pair after all contract blocks.
- Recompute fees by changing funding amounts and final change, never by shifting
  slots.
- Verify before signing that every block has equal input/output cardinality and
  that all physical indices match the artifact.

### Covenant

- Authenticate the expected role of every local output.
- Where relevant, authenticate the paired funding input sufficiently to prevent
  it from masquerading as contract state.
- Use block-relative offsets plus a single block base.
- Avoid `tx.inputs.length`/`tx.outputs.length` assumptions that prevent safe
  concatenation of later blocks; use authenticated block bounds instead.

## 9. Acceptance criteria for the later change

The refinement is ready to graduate only when tests prove:

1. a single stateful contract with zero, one, and multiple events remains
   balanced;
2. A -> B composition has equal input/output bases for B;
3. A -> B -> C preserves the same property transitively;
4. event, return-event, transfer, and deployment slots each receive paired
   funding inputs;
5. conditional active and inactive paths have identical physical block sizes;
6. fee changes modify amounts and final change without moving any slot;
7. hostile insertion or omission of an input/output inside a block is rejected;
8. independently compiled blocks compose using artifact layouts alone;
9. SDK and covenant independently agree on every physical slot; and
10. the complete shapes pass BCH-2026 VM, standard-policy, and live-node tests.

Until these criteria pass, this document remains a design constraint for future
work rather than a statement about current behavior.
