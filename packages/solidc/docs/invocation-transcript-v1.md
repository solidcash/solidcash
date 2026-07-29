# General invocation transcript design candidate

Status: DEFERRED RESEARCH. NOT AN IMPLEMENTATION OR DEPLOYMENT TARGET. NO WIRE BYTES, SELECTOR,
CONTROLLER, LIMIT, OR VERSION ARE FROZEN.

Baseline: `codex/state-bus-research`, forked from `codex/solidhat-init` at `d36116aa`.

This document preserves a detailed candidate for a future general multi-participant and circular
invocation protocol. Its uppercase requirements are requirements the candidate would need to meet,
not claims that the format is selected. The immediate journal and narrow batching implementation is
specified in `compiler-hidden-batch-v1.md`.

### This is NOT the spec of the transcript the SDK ships

The Layer-3 graph transcript that exists in this repository is encoded by
`packages/solidcash/src/layer3/graph.ts` (`finalizeCompiledGraph`), and it is a DIFFERENT format from the
candidate below. Nothing in section 3 describes its bytes. The divergences are structural, not cosmetic:

| | candidate (this document) | shipped `L3GRAPH1` transcript |
| --- | --- | --- |
| magic | `SCBT` + `version:u8` + `flags:u8` | `L3GRAPH1\0`, 9 bytes, no version or flags byte |
| carrier | dedicated P2SH32 carrier at input 0, blob in its unlocking bytecode | controller NFT commitment over the transcript root |
| integrity | `hash256(transcript)` in a trailing `SCBH` `OP_RETURN` output | single `sha256(transcript)` as the controller root |
| row kinds | participant, resource, invocation, effect, event | participant and invocation only |
| ID widths | `u32` invocation/effect/event IDs, `u16` participant/resource | `u16` parent, `u8` callee/localRow/depth |
| depth ceiling | 16 (section 11) | `MAX_GRAPH_DEPTH = 7` |

Reading a byte offset off section 3 and expecting it to land in the shipped blob therefore does not work,
in either direction. The shipped invocation row is `parent:u16, callee:u8, localRow:u8, depth:u8,
subtreeEnd:u16, selector:bytes4, callOptions:u8, args, result` - so its call-options byte is at row offset
11, where this document's own candidate row has the high byte of `subtreeEnd:u32`. The authority for the
shipped layout is `graph.ts` and the offsets asserted in `Layer3ReviewA1.test.ts`; this document is the
authority for nothing that is deployed.

Consensus target: `BCH_2026_05`. Transcript mode MUST NOT be constructed or relayed under an earlier
VM target. It depends on the 2026 standard unlocking-bytecode limit of 10,000 bytes and 128-byte
token commitments. `BCH_2025_05` retains a 1,650-byte standard unlocking limit and is not a supported
deployment target for this protocol.

`__batch` is not language grammar, source ABI, or a user-callable API. The compiler may emit a
reserved physical route and artifact metadata; the SDK selects it when one state owner has more than
one logical invocation in the transaction.

### Research decision boundary

This candidate MUST NOT be implemented after only a parser benchmark. A future adoption decision
also requires:

- demonstrated production demand for bounded multi-participant cycles after the narrow batch ships;
- measured fixed covenant overhead, targeting roughly 800 bytes or less per participant and tested
  on real contracts near the 10,000-byte limit;
- an immutable-deployment compatibility strategy in which peers negotiate an exact common version
  and newer artifacts may retain old routes without unbounded parser growth;
- measured stale-outpoint/retry behavior as participant count rises;
- an independent review of participant binding, caller authentication, owner uniqueness,
  exhaustiveness, and cycles.

Until all gates pass, unsupported graphs fail with diagnostics and no artifact advertises this
protocol.

## 1. Security and semantic model

### 1.1 Atomic transition

A bus transaction is one finite atomic transition:

```text
(authenticated participant pre-states, root arguments)
    -> canonical logical invocation execution
    -> one authenticated post-state per state owner
```

Each state owner has exactly one physical owner input and exactly one settlement covenant. Repeated
calls never duplicate that input. Only code authenticated by the owner may interpret operations and
write its journal.

The SDK is an untrusted witness constructor. On-chain covenants MUST reject omitted calls, substituted
participants, reordered calls, forged callers/results, duplicate logical invocations, incomplete
storage witnesses, and incorrect final state.

### 1.2 Logical order

Logical calls use depth-first, left-to-right synchronous order:

1. enter an invocation;
2. execute until an external callsite;
3. enter that call and all of its descendants;
4. obtain its result;
5. resume the caller;
6. return.

Each invocation executes exactly once. Participant cycles are allowed; execution/value cycles are
not. The protocol does not iterate handlers to a fixed point.

### 1.3 Physical evaluation

BCH evaluates transaction inputs independently. The protocol therefore does not claim a shared
cross-input stack or storage.

Every owner covenant evaluates the projection of the canonical logical order relevant to that owner:

- it executes every invocation targeted at itself in global logical order;
- it keeps one live read-your-writes journal for the complete transaction;
- when one of its handlers reaches a foreign call, it verifies the child row and traverses the
  child's complete subtree before consuming the child's authenticated result;
- during that traversal it executes any callback row targeted back at itself against the same live
  journal, including callbacks reached through several foreign participants;
- rows targeting other owners are not executed locally.

This projection preserves callback ordering. For `A.start -> B.process -> A.callback`, A's covenant
suspends `A.start`, executes `A.callback` against A's live journal while traversing B's subtree, and
then resumes `A.start` with B's authenticated result. B independently executes `B.process` and binds
the same callback row and result.

### 1.4 Visibility rule

A handler may observe:

- its owner's authenticated pre-state;
- prior writes in the same owner's journal;
- its invocation arguments and logical caller;
- authenticated results of completed child invocations;
- ordinary transaction introspection whose meaning is defined in section 8.

A handler MUST NOT observe another owner's unsettled journal or imagined intermediate output state.
Cross-owner information may cross a call boundary only as authenticated calldata, return data, event
data, or an explicitly authenticated final-state read. A foreign `outState` read which influences
execution before settlement is rejected.

## 2. Candidate transcript carrier

This section preserves the previously specified carrier for comparison; it is not selected. A future
format spike MUST compare, in this order:

1. a complete `OP_RETURN`/nulldata blob for witnesses within the 223-byte aggregate relay limit,
   requiring no carrier signer or redeem-template authentication;
2. a copy of the blob in each parsing participant's own unlocking bytecode while
   `participantCount * blobSize` remains comfortably below standard transaction size;
3. a shared carrier only if measured replication approaches the 100,000-byte standard transaction
   limit and the carrier's extra authentication surface is justified.

The ordering follows the BCH 2026 budget model: carrying bytes in a parser's own unlocking bytecode
increases that parser's operation budget, while a separate carrier grants budget to an input which
does not parse the witness.

### 2.1 Carrier location

The complete transcript is carried exactly once in a dedicated ephemeral carrier at transaction
input 0:

- the carrier is a signer-bound, token-free P2SH32 UTXO using the canonical v1 carrier covenant;
- the first item pushed by its unlocking bytecode MUST be the transcript blob;
- the push MUST use the shortest valid pushdata encoding;
- the remaining pushes are the carrier signature, public key, and redeem script;
- participant blocks begin at input 1.

Every participating covenant obtains the identical blob by introspecting
`tx.inputs[0].unlockingBytecode` and parsing its first canonical push. Participant-specific copies are
forbidden. The carrier is not a persistent queue/outbox and carries no protocol state. The SDK may
use a signer-owned carrier UTXO from a pool or create one in a preparatory funding transaction.

The canonical carrier redeem script enforces, in equivalent Bitcoin Script:

```text
stack before redeem: transcript, signature, publicKey
require(stack depth == 3)
require(hash160(publicKey) == bakedSignerPkh)
checkSig(signature, publicKey)
drop(transcript)
true
```

The redeem script is exactly 30 bytes:

```text
74 53 9d 76 a9 14 <bakedSignerPkh:20> 88 ad 75 51
```

That is `OP_DEPTH OP_3 OP_NUMEQUALVERIFY OP_DUP OP_HASH160 PUSHBYTES_20 <pkh>
OP_EQUALVERIFY OP_CHECKSIGVERIFY OP_DROP OP_1`. No prefix, suffix, alternate opcode spelling, or
trailing byte is accepted.

The first transcript push parser accepts only minimal:

- direct pushes for lengths 0 through 75;
- `OP_PUSHDATA1` for lengths 76 through 255;
- `OP_PUSHDATA2` for lengths 256 through the protocol transcript limit.

`OP_PUSHDATA4`, non-minimal encodings, truncated payloads, and trailing carrier stack items are
rejected. Every participant MUST verify the carrier signature's final hash-type byte is
`SIGHASH_ALL | SIGHASH_FORKID`; the 30-byte carrier redeem itself performs the signature check.
The carrier locking bytecode MUST be the canonical 35-byte P2SH32 locking bytecode committing to the
exact redeem script.

Participants MUST parse the final redeem-script push, verify the canonical carrier template, verify
the carrier input locking bytecode commits to that redeem script, and verify the pushed public key
matches `bakedSignerPkh`. The corresponding P2PKH locking bytecode is transcript-mode `tx.origin` and
the root invocation's direct `msg.sender`.

The carrier MAY fund fees and ordinary change. It MUST carry no token and is never a participant or
state authority.

### 2.2 Transcript commitment output

The final transaction output MUST be:

```text
value: 0
token: none
locking bytecode: OP_RETURN push("SCBH") push(hash256(transcript))
```

Every participant MUST independently compute `hash256(transcript)` and compare it with this exact
last-output digest. This check provides transcript integrity. The carrier's
`SIGHASH_ALL | SIGHASH_FORKID` signature commits the authenticated origin to that digest/output,
providing origin consent even though signature hashing does not directly include unlocking scripts.
No other output may use the `SCBH` protocol tag.

### 2.3 Physical unlocking routes

In transcript mode the SDK constructs:

```text
input 0:          transcript, carrier signature, carrier pubkey, carrier redeem script
participant owners:reserved SCB1 route, generated internal layout arguments, redeem script
delegate executor:reserved SCB1 settlement route, generated delegate/context arguments, redeem script
```

The exact stack order of generated internal arguments remains compiler-owned. `SCB1` MUST select the
transcript controller rather than a source handler. Application arguments, including signatures, are
decoded from invocation rows and are not duplicated as physical ABI arguments.

Existing external-call code which pins a callee's source selector MUST use transcript-row
authentication in transcript mode. Existing delegate pinning MUST instead pin the executor's `SCB1`
settlement route and owner context. Direct mode retains its existing selector checks.

### 2.4 Carrier authentication

Every participant MUST verify:

- transcript magic and version;
- the final `SCBH` output from section 2.2;
- canonical length encoding and complete consumption of the blob;
- row counts and protocol maxima;
- participant 0 identifies the first participant block at input 1;
- invocation 0 is the unique root and targets participant 0;
- its own participant row identifies its active owner input;
- the complete structural rules in section 4.

Implementations MAY cache `hash256(transcript)` internally but MUST NOT substitute a
participant-supplied digest for reading the common blob.

### 2.5 Compatibility

Ordinary one-invocation calls retain their existing unlocking layout and bytecode. The transcript
carrier and reserved batch route are used only when derivation selects transcript mode.

An artifact without v1 metadata cannot participate in transcript mode as a mutable participant.
It may be called only through the existing direct physical-call path when that does not duplicate a
state owner or require a callback.

## 3. Wire format

### 3.1 Primitive encoding

The transcript is a byte string with:

- ASCII magic `SCBT`;
- protocol version `0x01`;
- fixed-width integers encoded little-endian;
- unsigned `u8`, `u16`, `u32` and signed two's-complement `i64`;
- byte strings encoded as `u32 length || bytes`;
- no ignored padding, alternate integer spelling, or trailing bytes.

Participant, resource, and physical transaction indices use `u16`; invocation/effect/event IDs use
`u32`. The absent sentinel is the all-ones value of the field's width (`0xffff` or `0xffffffff`).
Boolean and flag fields MUST contain only defined bits. ABI arguments and results use the artifact's
existing canonical ABI byte encoding.

### 3.2 Header

```text
magic[4]                 // "SCBT"
version:u8               // 1
flags:u8                 // 0 in v1
participantCount:u16
resourceCount:u16
invocationCount:u16
effectCount:u16
eventCount:u16
rootInvocationId:u32     // MUST be 0
participants...
resources...
invocations...
effects...
events...
```

### 3.3 Participant row

```text
participantId:u16        // contiguous, table position, participant 0 first
ownerInputIndex:u16
ownerOutputIndex:u16
ownerBlockInputCount:u16
ownerBlockOutputCount:u16
ownerLockingBytecode:bytes
stateCategory:bytes      // empty only for a compiler-declared stateless participant
executionKind:u8         // 0 owner, 1 delegate, 2 split-root-local
executorInputIndex:u16   // 0xffff when executionKind == owner/split-root-local
executorLockingBytecode:bytes
firstResource:u16
resourceCount:u16
settlementBoundary:u32   // exclusive logical position after all owner invocations complete
```

Participant 0 is fixed by the root invocation. Remaining participants are sorted by
`(ownerLockingBytecode, stateCategory)` with unsigned lexicographic byte ordering. The key MUST be
strictly increasing, so the same logical owner cannot appear twice. Participant blocks occupy the leading
transaction inputs after the carrier and the leading outputs in participant-ID order:

```text
inputs:  carrier, P0 block, P1 block, ... PN block, trailing funder/compute auxiliaries
outputs: P0 block, P1 block, ... PN block, trailing payments/change auxiliaries, SCBH
```

`ownerInputIndex` and `ownerOutputIndex` are the starts of those blocks. Blocks MUST be contiguous,
non-overlapping, and exactly adjacent in participant order; P0's owner input is index 1 and its owner
output is index 0. Kind-specific resource/effect rows
authenticate every non-master position inside a block. Trailing inputs/outputs remain governed by
the handlers which require them and by existing covenant rules; they cannot claim owner state
authority.

`settlementBoundary` MUST equal the maximum `subtreeEnd` of every invocation targeting this
participant. This is stronger than the last target row: an earlier owner handler may be suspended
around a callback and resume after that row. Streaming validation computes and checks the maximum
without rescanning the invocation table.

For a normal stateful contract, the owner input is its master. For proxy/delegate execution, the
owner is the proxy master and the executor is the pinned delegate input. For a split contract, v1
accepts only handlers which remain root-local or have been compiler-colocated into one selected
settlement artifact. General multi-facet execution is rejected under section 9.5.

### 3.4 Resource row

```text
resourceId:u16           // contiguous, table position
ownerParticipant:u16
kind:u8
flags:u8
logicalSlot:bytes
inputStart:u16
inputCount:u16           // 0 only for an authenticated creation/absence transition
outputStart:u16
outputCount:u16          // backend-defined: preservation, update, insert pair, deletion, or chunk run
aux:bytes
```

Kinds:

```text
0 scalar register/data NFT
1 mapping or set entry
2 dynamic-storage chunk
3 satoshi container
4 token container
5 event/return authority
```

`logicalSlot` is compiler canonical:

- scalar: state-layout fingerprint plus field/register index;
- mapping: collection ID plus canonical encoded key tuple;
- chunk: collection ID plus chunk index;
- containers: container kind plus canonical category/key.

`aux` carries kind-specific authenticated descriptors such as `nftIndex`, C2 predecessor/successor
slot, chunk count, or token category. It is not application-controlled storage authority. Physical
spans MUST lie inside the owning participant's declared input/output block. C2 inserts, deletes, and
dynamic values use their complete contiguous backend span rather than hiding additional physical
outputs outside the resource row.

Rows MUST be sorted by `(ownerParticipant, kind, logicalSlot)` and unique. Transcript-mode physical
resource spans are allocated in that same order, so non-empty `inputStart` and `outputStart` spans
advance monotonically without overlap. Each participant's resource range MUST be contiguous and
match its participant row. This lets one streaming pass prove both logical-slot and physical-span
uniqueness.

### 3.5 Invocation row

```text
invocationId:u32         // contiguous, table position; root is 0
parentInvocationId:u32   // 0xffffffff only for root
subtreeEnd:u32           // exclusive invocation index
targetParticipant:u16
selector:bytes4
callOptions:u8           // bit 0 = read-only (staticcall) mode; bits 1-7 reserved for source-level options
valueDelta:i64           // little-endian two's-complement satoshi change for this logical call
callsiteId:u32
occurrence:u32
args:bytes
result:bytes
```

Rows are canonical depth-first preorder. A child's row immediately follows the execution point which
emits it. `subtreeEnd` identifies the first row after all descendants.

The root has `parentInvocationId = 0xffffffff`, `callsiteId = 0`, and `occurrence = 0`.
Every non-root invocation is authenticated by exactly one external callsite executed by its parent
handler. A parent may have several children; their `(callsiteId, occurrence)` sequence MUST match
runtime execution exactly. For each `(parentInvocationId, callsiteId)`, occurrences start at zero and
are contiguous with no gaps. Invocation IDs are not replay nonces and have no meaning outside the
consumed transaction.

`valueDelta` is within the signed 64-bit range and BCH money range. It is the net satoshi-container
change attributed directly to this invocation: its call-entry/origin credits plus its own explicit
credits, minus its own explicit debits, excluding effects attributed to descendant invocations. This
preserves SolidCash's net-change meaning without double-counting callbacks. The target uses the row
value as logical `msg.value`; it is available before handler execution, and settlement later proves
it equals the invocation's consumed effect rows. It is a checked transaction witness, not a
fixed-point calculation. A `staticcall` has zero `valueDelta`; its target MUST be compiler-proven
read-only and may not emit mutable descendants.

`callOptions` was written here as a two-valued `callMode:u8` until the shipped `L3GRAPH1` transcript made
its counterpart a bitfield, and the candidate is aligned to that shape rather than left narrower than the
thing it would supersede. Bit 0 is the compiler-proven read-only mode and is the ONLY defined bit; the
root row's copy MUST be zero. Bits 1-7 are reserved for source-level call options and none is admitted, so
under section 3.1's "flag fields MUST contain only defined bits" a row carrying any of them is rejected.

### 3.6 Effect row

```text
effectId:u32             // contiguous
invocationId:u32
effectOrdinal:u16
kind:u8                  // 0 logical value, 1 satoshi transfer, 2 FT transfer, 3 NFT transfer
sourceParticipant:u16    // 0xffff for authenticated transaction origin
destinationKind:u8       // 0 participant, 1 locking bytecode
destination:bytes
category:bytes           // empty for satoshis
amount:i64
outputIndex:u16          // 0xffff when folded into an owner-local logical ledger
```

Rows are sorted by `(invocationId, effectOrdinal)` and consumed exactly as handlers execute value
movement. A logical-value row binds call-entry/origin value to an invocation and its parent callsite.
The signed sum of all direct effect rows attributed to an invocation MUST equal its `valueDelta`.
Every debit has one destination credit; every physical payment identifies and authenticates its
output. Container settlement proves opening value plus all credits minus all debits equals final
physical value. No movement may be counted by two invocations or both an ancestor and descendant.

Token-ledger contracts whose balances are application mapping state use ordinary journal writes and
events. Kinds 2 and 3 describe native CashToken container movement.

`amount` MUST be non-negative; source/destination determine direction. Signed encoding is retained so
the parser can share the checked money-range primitive and reject negative or out-of-range effects.

Non-sentinel physical `outputIndex` values are strictly increasing in effect-row order.

`outputIndex == 0xffff` is allowed only when source and destination are the same participant and the
movement is folded into that owner's authenticated local container ledger. A cross-owner or external
locking-bytecode movement MUST identify a physical output and both owners MUST reconcile the same
effect row.

### 3.7 Event row

```text
eventId:u32              // contiguous
invocationId:u32
emitOrdinal:u16
outputIndex:u16
signature:bytes32
encodedFields:bytes
```

Rows are sorted by `(invocationId, emitOrdinal)`. A handler's `emit` consumes exactly the next matching
row and verifies the existing event-output covenant at `outputIndex`. No event row may remain
unconsumed. Logical call results are carried in invocation rows; an externally requested root
`emitReturn()` continues to use the existing authenticated return-event mechanism and is represented
by a kind-5 resource/event row.

Event `outputIndex` values are strictly increasing and greater than every effect-row physical output
index. The SDK allocates effect outputs before event outputs, making cross-table output uniqueness an
adjacent/range check rather than a pairwise scan.

## 4. Structural validation

Every participant MUST perform or invoke shared generated validation which proves:

1. participant, resource, invocation, effect, and event IDs are contiguous;
2. counts are within section 11 maxima;
3. input and output indices are in range;
4. participant owner keys are strictly increasing after participant 0 and no owner key is duplicated;
5. mutable state resource input indices are unique;
6. every mutable resource belongs to exactly one owner;
7. participant resource ranges partition the resource table;
8. invocation 0 is the only root;
9. every non-root parent ID is less than its ID;
10. preorder and `subtreeEnd` form a properly nested tree;
11. every invocation target exists and every declared participant is targeted at least once;
12. `(parentInvocationId, callsiteId, occurrence)` is unique;
13. effect/event rows reference existing invocations and physical outputs are unique;
14. no undefined flags, trailing bytes, duplicate keys, or non-canonical encoding exist;
15. every participant row is bound to the actual transaction:
    - `tx.inputs[ownerInputIndex].lockingBytecode == ownerLockingBytecode`;
    - a non-empty `stateCategory` equals that input's category and it carries the required master
      capability;
    - its unlocking bytecode minimally selects `SCB1` and its redeem script contains the exact
      compiler-reserved v1 controller prefix;
    - delegate execution likewise binds `executorInputIndex`, `executorLockingBytecode`, its `SCB1`
      route, and its exact v1 delegate-controller prefix;
    - owner/executor input indices and participant blocks are disjoint except for relationships
      explicitly allowed by the execution kind.

Item 15 is the participation lemma: every identity which may become logical `msg.sender` names a
real co-spent input whose v1 controller is forced to validate this same transcript. A legacy artifact,
an input selecting a legacy route, or a redeem script lacking the reserved controller prefix cannot
be a transcript participant.

Validation MUST be one front-consuming streaming pass. Tables use their specified canonical sort
orders; uniqueness is checked against the previous key or while the owning handler consumes its
contiguous child/effect/event sequence. Validators MUST NOT randomly seek from the transcript head or
perform pairwise uniqueness scans. In particular, direct child occurrence continuity is checked by
the parent handler during projection, so item 12 does not require an all-pairs scan.

The compiler SHOULD emit shared validation as `OP_DEFINE` routines. An optimization may divide
validation work only if every malformed transcript still makes a mandatory input fail before any
incorrect transition is authorized. V1 begins with full streaming validation by every mutable
participant.

## 5. Participant and authority authentication

### 5.1 Owner

Each mutable participant MUST verify at `ownerInputIndex`:

- the expected locking bytecode;
- the self-pinned state category;
- the master NFT capability and existing state-lineage invariants;
- `OP_INPUTINDEX == ownerInputIndex` for direct-owner/root-local settlement, or a pinned
  `executorInputIndex` for delegate settlement;
- exactly one canonical owner output at `ownerOutputIndex`;
- owner locking bytecode, category, token capability, and protected value preservation.

The logical owner is `(ownerLockingBytecode, stateCategory)`, not merely an address, category, input
index, SCID address, or artifact name.

### 5.2 Executor

Owner execution uses the owner covenant as settlement controller. Delegate execution uses the
executor covenant as the sole settlement controller; the owner forwarder authenticates and requires
that executor but does not independently authorize competing state values. Delegate mode additionally
MUST pin the executor input, forwarded `SCB1` route, brand/category relationship, and full-state
authority using the existing delegate security invariants. Both mandatory covenants bind the common
transcript.

A stateless participant has no journal and cannot settle mutable resources. Its exact locking
bytecode and artifact fingerprint are still pinned by its callers.

### 5.3 Caller

For a non-root invocation, logical `msg.sender` is the authenticated physical owner locking bytecode
of the parent invocation's target participant. It is never read from calldata.

The root's `msg.sender`/`tx.origin` derives from the authenticated carrier signer as specified in
section 2.1. Non-root invocations do not change `tx.origin`.

SCID logical addresses are not exposed as `msg.sender` in protocol v1. Supporting them requires a
separately versioned caller-identity extension which authenticates the anchor on-chain.

### 5.4 Completeness

For every invocation targeted at participant P, P executes the selected handler and proves:

- selector and ABI argument decoding;
- all business `require`, `assert`, signature, and covenant conditions;
- every emitted child row in exact runtime order;
- every consumed child result;
- every value/container effect row;
- every event row;
- the exact ABI-encoded result in its invocation row.

At completion P MUST prove that:

- all and only invocation rows targeted at P were entered once;
- all child rows emitted by P were consumed once;
- no callsite, effect, event, or result expectation remains;
- all P-owned resources were authenticated;
- every dirty resource has exactly one authorized final output.

## 6. Handler execution and callbacks

### 6.1 Compiler lowering

An eligible entry point is compiled as:

```text
physical direct wrapper -> initialize direct context -> invoke handler -> existing flush
reserved transcript wrapper -> initialize transcript context -> projected replay -> one flush
handler(context, invocation row, application args) -> application result
```

The handler contains business logic. Physical input/output positioning, transcript parsing, journal
initialization, and final settlement remain in wrappers/controllers.

Modifiers are expanded into the handler exactly once. `checkSig` executes in the handler's
`OP_INVOKE` body context, matching the existing function-body signing model; the SDK MUST generate
signatures against the transcript handler body and physical input, not reuse a direct-route
signature blindly. The physical transcript wrapper supplies the final settlement verification, so
final-require analysis treats the handler plus wrapper as one verified path.

Every external call expression is lowered to a compiler intrinsic:

```text
logicalCall(callsiteId, occurrence, target, selector, args) -> result
```

In direct mode it retains the existing physical-call lowering. In transcript mode it:

1. matches the next direct child row;
2. authenticates target identity and calldata;
3. traverses the complete child subtree;
4. executes callbacks in that subtree targeted at the current owner;
5. reads the child's authenticated result;
6. resumes the handler.

### 6.2 Re-entry

Re-entry is logical, finite, and transcript-bound. It does not permit an unlisted caller to invoke an
internal handler. A callback is dispatchable only if:

- it is a canonical descendant of the currently traversed call;
- its parent handler authenticates the outbound row;
- its target participant authenticates and executes it;
- its selector names a transcript-eligible public/external handler.

The controller keeps an active-invocation stack bounded by `maxDepth`. Recursion beyond the protocol
limit fails before transaction construction and on-chain.

### 6.3 Results

The producer executes the handler and byte-compares its canonical ABI result to the row. Consumers
may read a result only after traversing the producer's complete subtree. This creates an acyclic
result-dependency order by construction.

A result cannot be used to choose an ancestor, rewrite an earlier row, or create a child outside its
parent's subtree. If deriving a row requires a future result, derivation rejects the graph.

When bit 0 of `callOptions` is set - the read-only (`staticcall`) mode - the target controller MUST
snapshot its dirty bitmap/effect cursor on
entry and verify on return that no resource became dirty, `valueDelta == 0`, no mutable effect was
consumed, and every descendant handler is compiler-marked and runtime-verified static. Compiler
metadata alone is not the enforcer.

### 6.4 Failure

Any failed handler condition invalidates the complete transaction. `try/catch` may catch only:

- a compiler-local soft-result operation; or
- a target protocol which returns an authenticated success/error value without failing its covenant.

It cannot catch arbitrary failure of another transaction input.

## 7. State journal

### 7.1 Abstract state

For participant P, the journal is a vector aligned with P's contiguous resource rows:

```text
JournalEntry {
  logicalSlot
  preValue
  currentValue
  dirty
}
```

Initialization authenticates and decodes every pre-value from its physical resource input. A
creation-capable mapping/chunk operation authenticates the existing absence/predecessor proof before
using the type default.

`journalLoad(slot)` returns `currentValue`. `journalStore(slot, value)` replaces `currentValue` and
sets `dirty`. Delete stores the language default plus the backend's deletion operation.

### 7.2 VM representation

The normative journal semantics are section 7.1; journal Release 1 chooses the measured representation. The
default candidate is an append-only write log:

```text
fixed controller header and authenticated base values
append-only (logicalSlot, currentValue) writes in execution order
active invocation/callsite/effect/event cursors
```

`journalStore` appends and never inserts at depth. `journalLoad` searches newest-to-oldest for the
slot, then falls back to its authenticated base value. Flush consumes/coalesces the log in order and
emits one transition per resource. The compiler may replace a search with a constant stack access
when dataflow proves the latest write.

A mutable lower-stack frame with deep-slot replacement is not the v1 default: BCH has no
insert-at-depth primitive, so rolling a large frame out and back can become quadratic. Release 1 MUST
benchmark append-only, explicit threaded-context, and any proposed frame specialization under the
section 11 cost model before freezing codegen.

Every handler MUST restore temporary main/alternate-stack usage on return. Existing transient
alternate-stack operations remain legal only when balanced. Any chosen representation MUST preserve
section 7.1 exactly and remain within the combined memory limits.

### 7.3 Scalar resources

Fixed scalar/register fields are prefetched once. Multiple assignments and bytes/string replacements
are ordered stores, not reducers. Flush reconstructs each affected commitment once and applies the
existing output covenant.

### 7.4 Mapping and collection resources

The transcript MUST enumerate every concrete mapping key and dynamic chunk required by execution.
Computed access performs a canonical lookup in the owner's sorted resource range.

Each mapping entry is authenticated through the existing C2 transition rules. Multiple writes to the
same entry share one journal entry and one physical transition. Inserts/deletes carry their complete
predecessor/successor proof in the resource descriptor. If a runtime key is not present in the
authenticated resource table, execution fails.

SDK derivation may discover keys progressively, but the final transaction is built only after the
resource set stabilizes. There is no on-chain unauthenticated cold lookup.

### 7.5 Containers and token ledgers

Satoshi and token containers remain owner-interpreted resources. Transfers are recorded in canonical
effect rows/resource descriptors and verified against physical outputs.

ERC-20-style delta aggregation is deferred beyond protocol v1. V1 always executes the ordered
operations:

- `transfer`: debit then credit;
- `transferFrom`: check/decrement the allowance of the authenticated logical caller, then transfer;
- `mint`/`burn`: update supply and balances in order;
- absolute `approve`: overwrite in order and never fold across allowance spending.

Overflow, underflow, authorization, hooks, events, and per-call return values are evaluated in logical
order. A future protocol may add aggregation only after an independently reviewed equivalence proof
and differential VM suite.

### 7.6 Flush

After projected replay, the settlement controller:

1. proves all local invocations/effects were consumed;
2. reconstructs every dirty owner resource once;
3. preserves every clean co-spent owner resource;
4. verifies/mints/deletes mapping and chunk outputs using existing backend covenants;
5. verifies container transfers and event outputs;
6. proves no duplicate output authority or orphan mutable owner resource exists.

## 8. Language behavior in transcript mode

| construct | v1 behavior |
|---|---|
| scalar reads/writes | journal read/write |
| internal/private/public internal call | handler/subroutine call against same journal |
| loops | allowed when concrete execution stays within protocol/resource limits |
| local recursion | allowed within depth and VM limits |
| external/public call | logical child invocation |
| `msg.sender` | authenticated parent owner; root uses existing origin rule |
| `msg.sig` | current invocation selector |
| `msg.data` | selector plus canonical invocation arguments |
| `msg.value` | current invocation row's authenticated `valueDelta` |
| `this.activeInputIndex` | physical owner input index |
| `this.activeBytecode` | physical executing covenant bytecode |
| `tx.origin` | authenticated carrier signer's P2PKH locking bytecode |
| other `tx.*` | actual final transaction introspection |
| state `outState` of self | current owner journal value |
| foreign `outState` | allowed only after the target's settlement boundary; otherwise rejected |
| events | canonical event rows plus existing event outputs |
| returns | invocation result row; optional root return event remains supported |
| `revert`/failed `require` | invalidates transaction |
| `staticcall` | target must preserve all mutable resources; result authenticated normally |
| `delegatecall` | only existing pinned one-hop authority model |
| lifecycle/upgrade/selfdestruct/split/merge | transcript-ineligible in v1 |
| `unsafe` | transcript-ineligible in v1 |
| opaque assembly call/state effects | transcript-ineligible unless lowered to summarized operations |
| arbitrary foreign `try/catch` | rejected |

`tx.inputs.length`, output indices, and similar introspection observe the bus transaction rather than
an imagined per-call transaction. This is the unavoidable BCH meaning and MUST be documented in the
language compatibility diagnostics.

A foreign ordinary state read always means authenticated transaction pre-state. For a foreign
`outState` read, the reader MUST verify on-chain that its current logical position is not earlier
than the target participant's authenticated `settlementBoundary`; the streaming validator proves
that field is the maximum `subtreeEnd` of all invocations targeting the owner. The target owner
authenticates the final value. An earlier read could observe a suspended owner handler which later
resumes and is rejected on-chain, not merely by SDK derivation.

## 9. Compiler and SDK admissibility

### 9.1 Compiler summaries

The compiler MUST extract the existing split planner's call-closure and `SplitStateFootprint`
machinery into shared analysis and emit per-handler:

- selector and stable handler ID;
- state/resource read and write regions;
- external callsites and target source;
- calldata and result dependencies;
- event/container/lifecycle/delegate/unsafe effects;
- boundedness facts;
- transcript eligibility and rejection reason;
- possible alias and owner-contention constraints.

Dynamic collection keys widen to wildcard regions statically and are resolved concretely by the SDK.

### 9.2 Static rejection

Compilation rejects a handler or universally impossible chain when it contains:

- an unsupported construct in section 8;
- a call/result dependency which necessarily points to a future/ancestor result;
- an external recursion shape proven unbounded;
- two statically identical settlement authorities for one owner;
- a required foreign intermediate-state read;
- a handler which cannot preserve its stack/context contract;
- an effect whose resource/authentication requirements cannot be summarized.

Potential runtime target aliasing is emitted as a constraint rather than rejected.

### 9.3 SDK derivation

The SDK performs deterministic symbolic/VM-assisted expansion:

1. resolve the root handler and participant 0;
2. execute until the next unresolved call/resource access;
3. resolve target artifact, physical identity, arguments, and required resource;
4. append one canonical child/resource row;
5. reuse an existing participant when logical owner identity matches;
6. continue each logical invocation once until it returns;
7. reject a future-result dependency, duplicate inconsistent row, unresolved target/resource, or
   protocol maximum;
8. canonicalize tables and indices;
9. acquire each physical input once;
10. build outputs and internal arguments;
11. execute a complete VM probe for every input;
12. return/send only if all probes succeed.

Progressive probes may use placeholders solely to discover the next dependency. Placeholder results
are never accepted in the final transaction.

### 9.4 Concrete contention checks

Before fetching/building, derivation groups by logical owner and rejects:

- two different owner inputs for one logical owner;
- one input assigned to two owners/resources;
- incompatible artifacts or state-layout fingerprints for one owner;
- two executor paths both claiming final settlement authority;
- mutable participants without transcript-capable artifacts;
- unresolved dynamic aliases;
- a final transaction which would consume the same outpoint twice.

Cross-transaction races remain normal UTXO contention and are retried from a fresh pre-state.

### 9.5 Split contracts

`solidcash-split-v1` remains valid unchanged.

Transcript v1 supports:

- root-local split handlers; and
- a moved handler only when the compiler emits one settlement artifact containing the complete
  handler/callback closure required for that owner's projected execution.

Transcript v1 rejects:

- a logical owner projection requiring two existing facets;
- nested `root -> facet -> facet` delegation;
- independently evaluated facets proposing writes to the same root;
- treating a facet category as an independent application-state owner.

The splitter SHOULD use transcript handler closures as hard colocation edges. If the closure does not
fit the configured shard limit, compilation reports the measured closure and states that
multi-facet settlement is unsupported. Authenticated facet-intent settlement is reserved for a later
protocol version.

## 10. Artifact and ABI metadata

Artifacts participating in v1 MUST include:

```ts
interface AccessRegion {
  kind: 'scalar' | 'mapping' | 'chunk' | 'satoshi' | 'token' | 'wildcard';
  owner: 'self' | { callsiteId: number };
  resource: string;
  mode: 'read' | 'write' | 'create' | 'delete';
  keySources?: readonly (
    | { kind: 'constant'; value: string }
    | { kind: 'parameter'; index: number }
    | { kind: 'state'; resource: string }
    | { kind: 'result'; callsiteId: number }
    | { kind: 'runtime' }
  )[];
}

type InvocationConstraint =
  | { kind: 'possible-owner-alias'; leftCallsite: number; rightCallsite: number }
  | { kind: 'bounded-expansion'; callsiteId: number; source: string }
  | { kind: 'result-before-use'; producerCallsite: number; consumerCallsite: number }
  | { kind: 'foreign-final-state'; callsiteId: number; ownerSource: string }
  | { kind: 'requires-colocation'; handlerIds: readonly number[] }
  | { kind: 'unsupported-effect'; handlerId: number; effect: string };

interface InvocationProtocolV1 {
  version: 1;
  artifactFingerprint: string;
  transcriptRoute: {
    selector: string;              // reserved physical selector
    carrierInput: 0;
    maxTranscriptBytes: number;
  };
  handlers: readonly {
    handlerId: number;
    name: string;
    selector: string;
    eligible: boolean;
    rejectionReason?: string;
    reads: readonly AccessRegion[];
    writes: readonly AccessRegion[];
    callsites: readonly {
      callsiteId: number;
      selector?: string;
      targetSource: string;
      argDependencies: readonly string[];
      resultTypes: readonly string[];
    }[];
    effects: readonly string[];
    maxStaticDepth?: number;
  }[];
  constraints: readonly InvocationConstraint[];
  stateLayoutFingerprint?: string;
}
```

The reserved selector is the fixed value `0x53434231` (`SCB1`). The compiler MUST reject a source ABI
selector collision. Fixing and reserving the selector avoids a recursive definition between dispatch
bytecode and its artifact fingerprint.

`artifactFingerprint` is SDK/compiler metadata only. It binds optimized handler bytecode,
constructor-bound identity, state-layout fingerprint, transcript protocol version, handler table,
and callsite IDs. It is not serialized in participant rows and is not treated as covenant-layer
identity; the locking bytecode and state category provide that identity on-chain.

Callsite IDs are assigned deterministically from canonical source identity plus enclosing handler and
AST preorder. They are stable under unrelated artifact serialization order but may change after a
semantic source/compiler change, which also changes the artifact fingerprint.

Older artifact readers ignore the additive metadata. A v1 SDK MUST reject an unknown protocol
version or malformed/incomplete metadata.

## 11. BCH 2026 cost model and protocol limits

The governing VM constants for `BCH_2026_05` are below. Values read from `ConsensusBch2026` /
`ConsensusBch2025` in `@bitauth/libauth@3.1.0-next.8`, which is what this repository pins and what
`packages/solidcash/test/e2e/layer3-envelope-f1.ts` re-reads rather than restates.

```text
densityControlLength D              = 41 + own unlockingBytecode length
maximumOperationCost                = 800 * D
operationCost                       = 100 * evaluated instructions
                                      + 26,000 * signature checks
                                      + (hash-iteration cost, see below) * hash digest iterations
                                      + arithmetic cost + stack-pushed bytes
maximum standard unlocking bytecode = 10,000 bytes
maximum standard transaction size   = 100,000 bytes
maximum stack item                  = 10,000 bytes
maximum combined stack depth        = 1,000 items
maximum control-stack depth         = 100
maximum token commitment            = 128 bytes
maximum aggregate nulldata          = 223 bytes
```

HASHING IS PRICED AND BUDGETED DIFFERENTLY IN THE TWO REGIMES, and in opposite directions. Neither
figure may be substituted for the other, and a single "iterations per byte" knob cannot express both:

```text
                                      standard (relay)   consensus (mined)
hash digest iteration cost            192                64
maximumHashDigestIterations           floor(0.5 * D)     floor(3.5 * D)
```

So the same script has a HIGHER operation cost when relayed than when mined, while the iteration
ALLOWANCE is 7x tighter under relay policy. Earlier revisions of this section listed only the 192 and the
0.5 without naming the regime, which reads as though one pair governed both.

An evaluated instruction costs 100 against a budget of 800 per byte, so EIGHT instructions consume one
byte of the evaluating input's own unlocking-bytecode budget - an instruction is worth an eighth of a
byte, not the "roughly eight bytes" this paragraph used to claim.
`OP_BEGIN`/`OP_UNTIL` reduce emitted bytecode but do not reduce per-iteration operation cost.
`OP_SPLIT` charges for pushed bytes, so repeatedly splitting the full transcript is forbidden by the
streaming rule in section 4.

Wire-format candidate maxima:

```text
transcript blob                 8,192 bytes
participants                    8
resources                      24
logical invocations            24
events                          4
effects                         8
logical call depth             16
invocations per participant    24
resources per participant      24
journal writes per participant 32
```

These maxima are simultaneous ceilings, not promises that maximum-sized variable payloads fit
together. The encoded transcript length is always the final authority. A future format spike MUST measure realistic
row payload distributions and may lower these numbers before the wire format freezes. Raising frozen
maxima requires a protocol-version change.

The SDK MUST additionally enforce the active network/provider limits for:

- carrier input unlocking bytecode, including transcript, signature, pubkey, and tiny redeem script;
- each participant/executor unlocking bytecode and redeem script independently;
- 10,000-byte P2SH redeem script;
- transaction serialized size and input/output count;
- stack item, combined stack, control/function memory, operation, and signature-check budgets;
- NFT commitment and token amount bounds;
- dust and standardness policy when broadcasting;
- aggregate arbitrary-data output usage: `SCBH` plus every application/event `OP_RETURN` output MUST
  remain within the 223-byte standard limit.

Static estimates are advisory. Complete final VM evaluation of every input is mandatory. Exceeding a
limit is a deterministic construction error naming the participant, invocation/resource count, and
measured limit.

## 12. Required diagnostics

Errors MUST include, when applicable:

- shortest relevant source call chain;
- logical invocation IDs and callsite locations;
- repeated/contended owner identity;
- physical input or state resource;
- cyclic/future result edge;
- unsupported handler effect;
- unresolved target/key/artifact;
- measured transcript/script/stack/operation limit;
- split closure/facets which prevented colocation.

Example:

```text
Cannot derive A.start -> B.process -> A.finish:
  B.process.result is required to construct A.finish's ancestor call arguments,
  but that result is available only after B.process completes.
  Invocation transcript v1 does not permit future-result dependencies.
```

## 13. Research gates and possible verification plan

This is not a scheduled implementation plan. A new adoption decision is required before gate 2;
gates 0-1 are measurement and shared compiler work which do not freeze or deploy this format.

0. **BCH 2026 format/cost spike:** before freezing section 3, hand-emit the carrier parser,
   participant transaction-binding checks, streaming structural validator, and `SCBH` verification.
   Measure realistic 2 KiB and maximum candidate transcripts from a roughly 5 KiB stateful
   participant under `BCH_2026_05`. Record `operationCost`, `maximumOperationCost`,
   `evaluatedInstructionCount`, `stackPushedBytes`, `hashDigestIterations`, stack/memory peaks,
   unlocking sizes, and complete transaction size. Freeze the exact v1 controller-prefix bytes only
   after this implementation exists. Also measure a compact no-carrier form which places the complete
   transcript in the final nulldata output when the total transaction remains under the 223-byte
   aggregate data-carrier policy; do not use application state NFT commitments as current-transaction
   witnesses.
1. **Shared analysis:** extract split footprints/call closures; artifact metadata is deterministic;
   all existing direct artifacts remain byte-identical. Do not finalize section 11 limits until the
   full research decision boundary also passes.
2. **Scalar journal:** benchmark append-only and explicitly threaded journal representations;
   recursive/local-loop scalar writers must match a sequential reference model;
   hostile output substitution fails.
3. **Local transcript route:** repeated handlers, callbacks, results, duplicate/missing rows, malformed
   tables, and stack cleanup are VM-proven.
4. **Repeated external owner:** two and three token calls consume one token owner and match sequential
   balances, allowances, supply, events, and returns.
5. **Resources:** same-key and different-key C2 transitions, inserts/deletes, dynamic chunks, and
   containers flush once and reject incomplete witnesses.
6. **Transitive graph:** Kashi-style result chaining and bounded dynamic targets derive uniquely.
7. **Participant cycle:** `A -> B -> A` callback ordering is compared instruction-for-instruction at
   the abstract handler level with the synchronous reference semantics.
8. **Corpus:** TreasurySplit, Marketplace rewards, MasterChef double mint/mass update, BentoBox batch,
   Kashi subset, Unicrow callback, and a Uniswap-style final-invariant flow pass.
9. **Adversarial review:** handcrafted transactions attack carrier substitution, parser ambiguity,
   participant/resource aliasing, caller/result forgery, omitted descendants, event/output reuse,
   executor substitution, and limit bypass.
10. **Independent security review:** required before enabling participant cycles by default.

No feature flag may emit this protocol before all adoption gates and the relevant implementation
gate pass. Direct-call and narrow-batch behavior remain the production paths when representable;
otherwise construction fails rather than silently changing behavior.

Gate 0 is necessary but insufficient. The journal and narrow batch may proceed independently, but
general-transcript implementation MUST NOT begin until measured format/cost, real-corpus fit,
version interoperability, contention/liveness, demonstrated demand, and independent review all pass
and a subsequent decision promotes this document.

## 14. Final invariants

A released implementation MUST maintain:

1. one physical owner input and settlement authority per mutable logical owner;
2. one common canonical transcript source and origin-bound transcript commitment under the frozen
   post-gate-0 format;
3. one execution of every logical invocation;
4. depth-first synchronous logical ordering with owner-local callback re-entry;
5. no visibility of foreign unsettled storage;
6. authenticated caller, target, selector, arguments, result, events, and physical identities;
7. owner-only interpretation and mutation of state;
8. read-your-writes within each owner;
9. one authenticated flush per dirty resource;
10. no omitted or duplicated child invocation/resource/event;
11. deterministic finite derivation within protocol and consensus limits;
12. fail-closed handling of unsupported artifacts, effects, aliases, cycles, and split topologies.
