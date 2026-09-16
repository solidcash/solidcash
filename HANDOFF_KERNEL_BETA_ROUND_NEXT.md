# Handoff — kernel-beta marketplace climb (after the event/continuation round)

> **Latest state (ROUND 138: the resolve loop now probes EVERY participant's verifier input (reads 952 -> 1426) but the missing recovery reads are behind control flow the placeholder data does not enter: ladder stays 43 pass / 23 fail.** The sections below are a chronological log;
> read ROUNDS 51-52 and 54 (the collection-key, rolled-array and dynamic-storage-read fixes: 32 -> 37),
> ROUNDS 53-96 (the remaining-class measurements), ROUND 47 (the aggregate-decode fix: 26 -> 32) and ROUNDS 48-50 (the
> deferred-`takeJob` class and its three falsified hypotheses) at the end. Earlier "State" numbers in this header
> are historical.

## State

HEAD: `9b4792c19 fix(message-bus): keep the terminal continuation lane per storage resource`

Three commits landed this round, each a general fix with no application naming:

| commit | scope | what it fixes |
|---|---|---|
| `95075e7db` | compiler | `artifact.events` omitted an interface/sibling-declared event's schema; emit overloads leaked |
| `5cc5c6558` | SDK | authenticated kind-2 event rows were dropped during final relocation |
| `9b4792c19` | SDK | a collection appended by several batched rows produced several continuation lanes |

Plus `68d518a17`, the generic e2e regression for the first two (interface-declared
event, concrete inherited implementation, two calls from a root contract, every
input evaluated under BCH-2026).

Gates: `yarn build` clean. `packages/solidc` full suite: **223 failed / 4843 passed
both before and after** the compiler commit (`comm`-diffed by test name) — zero new
failures. `journal-message-bus/e2e`: **117 → 116 failures**, zero new, one newly
passing. Lint on the touched files: same 31 pre-existing errors.

## Marketplace ladder: 21 pass / 45 fail (unchanged count, replaced failure class)

The 66-title suite is at the same 21/45 as the handoff baseline, but the dominant
failure class changed completely. The 38-title
`one routed participant cannot publish multiple continuation resource lanes` class
is **gone**; all 40 preflight failures now reduce to three inputs:

    38  input 214   MarketplaceDataV1 __message_bus1
     5  input 216   FakeToken __message_bus1
     2  input 127

Remaining non-preflight failures: 3 `index out of bounds` (`getUsers` /
`getArbitrators` dynamic-array reads, `upgrades.ts:521`), 1 "Expected transaction NOT
to be reverted" (`post job with invalid mece tags`), 1 state-derivation convergence
(`post job with invalid amount`).

## The artifact fixture is not in the repository and cannot be regenerated wholesale

This is the most important operational fact of the round.

* `node --max-old-space-size=8192 packages/testing/dist/cli.js compile --jobs 4`
  (the "force a genuinely cold compile" step) **destructively replaces**
  `.marketplace/artifacts/solidcash/` with this repo's own ~19 artifacts. It does
  NOT maintain the fixture. Running it wipes ~85 artifacts the suite needs and every
  title then fails with `one routed participant cannot publish multiple continuation
  resource lanes` or `function 'meceTags' … has no authenticated resultEncoding`.
* The fixture is the 11 marketplace sources compiled by the recipe in
  `.marketplace/iteration/recompile.sh` **merged over** a ~105-artifact base tree.
* Two complete base trees survive in `/tmp`:
  * `/tmp/kb-artifacts-105-preargfix` — round-46 vintage, pre-dates `46d682882` and
    the event fixes. Stale: it reports `no authenticated resultEncoding`.
  * `/tmp/artifacts-full-105` — the other historical base.
  * `.worktrees/kernel-beta-perf/.marketplace/artifacts/solidcash` (105) — a
    different vintage; its `FakeToken.json` has **no** events, so it is ALSO stale.

**To get a consistent fixture:** copy a base tree, then run the recipe so the 11
marketplace artifacts (and their event inventories) match the current compiler:

    cd .marketplace/iteration
    ./recompile.sh MarketplaceV1.sol MarketplaceV2.sol MarketplaceV3.sol \
      MarketplaceDataV1.sol EACCToken.sol TreasurySplit.sol unicrow/FakeToken.sol \
      unicrow/Unicrow.sol unicrow/UnicrowDispute.sol unicrow/UnicrowArbitrator.sol \
      unicrow/UnicrowClaim.sol

Then confirm `FakeToken.json` has BOTH
`Transfer(address,address,uint256)` and `Approval(address,address,uint256)` and that
`MarketplaceDataV1.json`'s `meceTags` has `resultEncoding: "evm-abi-v1"`. Those two
checks are the fastest fixture-consistency probe.

**The marketplace vitest config aliases `solidcash` to `packages/solidcash/dist`.**
Every SDK edit needs `yarn workspace solidcash build` before a marketplace run, or
the run silently exercises the previous build. This cost most of a session.

## Next blocker: a 32-byte commitment equality at input 214 (38 titles)

**Correction to an earlier claim in this file's first draft:** the reserved inactive
slots are NOT the problem. A probe of the real transaction at input 214
(`SOLIDC_DEBUG_SLOT_SATS` was added for this and reverted) shows the SDK already
materializes every tokenless reserved slot at exactly **1000 satoshis**:

    221-223, 225-226, 228-237   sats=1000  lock=51 (OP_TRUE)  tokenless
    214-220, 224, 227           sats=1200  (real data/entry/event NFTs)
    238                         sats=873   (trailing/fee tail)

So `emitInactiveGraphDeployOutput`'s 1000-sat assertion (and its twin at
`GenerateTargetTraversal.ts:28488`) passes. The earlier 1200-vs-1000 note was wrong.

### The actual failing operation

`SOLIDC_DEBUG_PREFLIGHT_ROUTE=1 SOLIDC_DEBUG_ROUTE_INPUT_INDEX=214` prints the exact
failing comparison, and it is precise and readable:

    message-bus-preflight-failure {
      inputIndex: 214,
      ip: 7856, opcode: 119, instructionCount: 18313,
      error: 'Program failed an OP_VERIFY operation.',
      failedComparison: {
        ip: 7855, opcode: 136,          // OP_EQUALVERIFY
        left:  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',  // sha256("")
        right: 'c2a8d2ff56802508ee018495941516441069e7ddcd8d1f9c96c3219591547617',
        lastOutputCategoryIndex: 305,
        lastOutputCategory: 'ee643a1671fbbe5333480fe40ff0fa72b65b6df0818805a2209586e991ca0af0:mutable',
        lastOutputBytecodeIndex: 307,
      },
      stack: [ 26:'1976a914c4ad89cdb7377ec8a163070e8442d399a87b870188ac',
               0:'', 0:'',
               30:'9bd3de951976a914c4ad89cdb7377ec8a163070e8442d399a87b870188ac',
               25:'76a914c4ad89cdb7377ec8a163070e8442d399a87b870188ac',
               0:'', 32:'c2a8d2ff56802508ee018495941516441069e7ddcd8d1f9c96c3219591547617', 0:'' ],
    }

The covenant compares a 32-byte value it computed as `sha256("")` against the
256-bit value `c2a8d2ff…` that the SDK supplied. `9bd3de95` is a handler selector in
the stack window, so this is a state/commitment equality inside a participant block,
not an event-frame check. `lastOutputBytecodeIndex: 307` says output 307 (the fee
tail) was the most recent `OP_OUTPUTBYTECODE` index.

**It is NOT a regression.** The identical failure at input 214 reproduces with
`packages/solidcash/src/message-bus/compose.ts` stashed back to its pre-session
revision and the SDK rebuilt, so neither `5cc5c6558` nor `9b4792c19` introduced it.
It was previously masked: before `9b4792c19` these 38 titles died earlier at the
continuation-lane check.

### Round 3 refinements

* **`e3b0c442…` is the `keySlot` of the `jobEvents` entry, not a computed state digest.**
  It appears verbatim as the third component of the resource identity in
  `SOLIDC_DEBUG_VALUE_CHUNKS=1` output:
  `ee643a16…:3b2d866b…:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
  So the covenant is comparing the entry's **slot key** against the SDK's entry
  commitment (`c2a8d2ff…`), i.e. a slot/key-derivation disagreement for the
  `jobEvents` entry, not a wrong hash of an empty payload.
* The SDK's materialized state entries in the failing transaction carry **38-byte**
  commitments of the form `4c335631` + payload (e.g. output 212
  `0000656174652061206d61726b6574706c61636520696e20736f`), while `c2a8d2ff…` is 32
  bytes — so the right operand is not simply one of those outputs' commitments.
* `c2a8d2ff…` is not `sha256`/`hash160` of any simple candidate (empty, zero32,
  ff32, single 0/1, or 0..1024 as u64le/u64be/b32le), in either byte order. It is
  runtime-derived.
* **`admit` only sees one transaction per invocation.** A probe added at the top of
  `admit` (since reverted) showed `participantInputs [0, 129, 216]` and no kind-6
  rows — that is an *earlier* transaction of the same title, not the one failing at
  input 214. `update job tags` sends several transactions in sequence. Any future
  probe at `admit` must either filter by the transaction that contains the failing
  input or hook `evaluateEveryInput` instead.
* `SOLIDC_DEBUG_VALUE_CHUNKS=1` shows the `jobEvents` chain for this title staging two
  owned values (205 and 233 bytes); the terminal (233-byte) one is the correct lane
  after `9b4792c19`. Comparing that lane's expected commitment against the covenant's
  `e3b0c442…` slot check is the most direct remaining experiment.

### ROUND 3 BREAKTHROUGH: it is the entry-output cardinality defect, already documented

The failing operands are **entry keySlots**, not payload hashes. Dumping the failing
transaction's outputs (`SOLIDC_DEBUG_TX_OUTPUTS=1`, probe reverted; hook
`evaluateEveryInput` just before its `transaction.inputs.forEach`, NOT `admit` —
see above) reproduces the shape the repo already documents:

    output 218  mutable  commit e2a4aac2…  …(1f9)…  e3b0c44298fc1c14…b7852b855 00907b984f02ca30
    output 219  mutable  commit 8c600621…  …(21)…   c2a8d2ff56802508…1547617    000010632d5ec76b05
    output 220  mutable  commit 09f85bbf…  …(48)…   484c83d413774888…b5ded26b   ffffffffffffffff…ff00

`e3b0c442… = sha256("")` is **`jobEvents[0]`'s collection hash**, i.e. the
`jobEvents` HEAD/entry slot; `c2a8d2ff…` is a second slot key the SDK also
materialized. The covenant's `__internal__vmapBatchSlot_N` witness table does not
agree with the second one.

This is the same defect family as `MARKETPLACE_ENTRY_CARDINALITY_FINDINGS.md`
(read it — it is the highest-value document in the worktree). That file records for
`publishJobEvent` on this same collection:

* `message-bus-large-equals`: `left = 01` (expected) vs `right = 02` (found);
* `aa2047362c…87` (category `ee643a16…`, slot `e3b0c442…`, i.e. `jobEvents[0]`) with
  `inputs: [16], outputs: [16, 18]` — **one consumed entry, two recreated entries**;
* output 18 is byte-identical to the consumed input commitment (stale pre-state body
  `…e9000000a68b212f…`), and is the illegal copy;
* a prior session already fixed one half of this (`3ef649fcd`: `_deriveFullTransactionState`
  preferred `blockSize` instead of the layout's own entry-slot offset).

So the remaining defect is **the SDK materializing a second, stale entry output for a
sorted-vmap collection** (or the covenant counting one it should not). The
compiler's expectation is explicit and is the right place to match:
`GenerateTargetTraversal.ts:20653` expects `1n + extraCollectionOutputs` for UPDATE and
`:20694` expects `2n + extraCollectionOutputs` for INSERT, then `:20697` censuses
outputs at the collection address via `emitVerifySortedOutputCountRaw`
(`:27879`). The SDK's entry-output plan must produce exactly that many.

Highest-value next step: start from `.marketplace/iteration` + the
`SOLIDC_DEBUG_ENTRY_LOCK`/`SOLIDC_DEBUG_LOOP_ENTRIES` diagnostics named in
`MARKETPLACE_ENTRY_CARDINALITY_FINDINGS.md`, and find where the SDK appends the
second entry output for a sorted collection whose consumed entry is byte-identical to
the pre-state. That single fix is the whole of the 38-title input-214 class.

### Round 4: the entry-cardinality hypothesis does NOT reproduce for `update job tags`

I built the decisive probe the findings file lacked: an insert-order log in
`TransactionBuilder.addOutputs` (recording absolute index, lock, capability and
commitment for every added output), scoped per `StatefulTransactionBuilder.build()`
session, plus a report in `evaluateEveryInput` that groups mutable entry commitments by
their 32-byte slot and flags any slot seen at two different indices **within one
session**. Both probes are reverted.

Result: **no intra-session duplicate entry slot.** The apparent duplicates are
local-index artifacts — the composition builds one `TransactionBuilder` per
participant, and each builder numbers its own outputs from 0, so the same logical entry
appears in the log as e.g. `2` (local, in one participant's builder) and `218`
(absolute, in another). Grouping across sessions therefore manufactured false positives.

Concretely, the entry slots actually materialized in the failing transaction are
`e2a4aac2498e0a62…` (entry index 218), `0000…0000` (the HEAD sentinel, index 219) and
`f8f64388910649b0…` (index 220) — plus a second `mutable` entry at index 238 whose
commitment has the same *value tail* as index 220 but a different leading slot.

**Neither failing operand matches any of them.** The covenant compares
`e3b0c44298fc1c14…` against `c2a8d2ff56802508…`, and no entry in this transaction
carries either as its slot. So for this title the two operands are **not** entry slots
of this transaction; the round-3 note that inferred "entry keySlot" from the resource
identity was only correct for `e3b0c442…` (which is `jobEvents[0]`'s collection hash and
does appear as a *slot* in other transactions of this title), and `c2a8d2ff…` is still
unattributed.

What that leaves, and what to try next:

1. `_padOutputsToIndex` (`StatefulTransactionBuilder.ts:7951`) clones the same-index
   input's token when padding — the mechanism the findings file blames. It runs at
   `:13282`, `:13483`, `:16921`, `:18433`. Instrument **inside** it to log the padded
   index and the cloned commitment, and correlate with the covenant's census, rather
   than inferring duplicates from an output log.
2. The compiler's expectation is unambiguous and is the target to match:
   `GenerateTargetTraversal.ts:20653` wants `1n + extraCollectionOutputs` for UPDATE,
   `:20694` wants `2n + extraCollectionOutputs` for INSERT, censused at `:20697` via
   `emitVerifySortedOutputCountRaw` (`:27879`). Run the failing title with
   `SOLIDC_DEBUG_FAILURE_POINT=1 SOLIDC_DEBUG_FAILURE_RING=1 SOLIDC_DEBUG_ROUTE_INPUT_INDEX=214`
   and read `message-bus-large-equals` — the findings file shows that hook printing
   `left = 01 / right = 02` for the sibling title, which is the direct cardinality read
   this round did not obtain.
3. Attribute `c2a8d2ff56802508…` by breaking on `OP_EQUALVERIFY` at ip 7855 in
   `evaluateEveryInput` and walking the previous ~40 executed instructions via
   `evaluated.instructions` — the byte-boundary decode attempted by hand in round 3 was
   unreliable and should be done programmatically.

### Round 5: the mismatch is now named — the SDK materializes the NEW node's slot wrong

Two decisive facts, both obtained cheaply:

**1. The digest is the NEW node's slot, and it is already published as a witness.**
`preflight-unlocker-params` for input 214 (`SOLIDC_DEBUG_PREFLIGHT_ROUTE=1
SOLIDC_DEBUG_ROUTE_INPUT_INDEX=214`) lists the vmap batch the compiler built:

    __message_bus_key_jobEvents_0   '0'                       # inserting jobEvents[0]
    __internal__vmapBatchSlot_1     e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    __internal__vmapBatchPredOut_1  150
    __internal__vmapBatchSlot_2     e2a4aac2498e0a62d7a3936482584bb94059e33c96b7090c81338243b335d559
    __internal__vmapBatchSlot_3     e2a4aac2498e0a62d7a3936482584bb94059e33c96b7090c81338243b335d559

So `e3b0c442…` — the covenant's `left` operand, and the thing the 103-byte runtime
value must decode to — **is `vmapBatchSlot_1`, the NEW node's slot for
`jobEvents[0]`** (`sha256("")` with the high bit cleared, i.e. the key-0 slot).

**2. The SDK's materialized entries do not contain that slot.** The `mutable` entries
in the failing transaction carry slots `e2a4aac2498e0a62…` (index 218, value tail all
zero), `0000…0000` (index 219, the HEAD sentinel) and `f8f64388910649b0…` (index 220).
**No entry in the transaction has slot `e3b0c442…`.** The batch says "the NEW[k] node
lives at output 150 (via `PredOut_1`)"; the SDK's entry at the collection band carries
the *predecessor/HEAD* slot with an empty tail instead of the NEW node's slot with the
appended `jobEvents` value.

That is exactly the defect `MARKETPLACE_ENTRY_CARDINALITY_FINDINGS.md` describes from
the other end ("output 18 is byte-identical to the consumed input commitment (stale
pre-state body)"), and it reproduces for this title after all — my round-4 conclusion
of "does not reproduce" was drawn from an output log that conflated per-participant
local indices; the correct comparison is **SDK entry slots vs the published
`vmapBatchSlot_*` witnesses**, which is unambiguous and does fail.

**Next experiment (bounded, start here):** take `vmapBatchPredOut_1 = 150` as the
covenant's declared NEW-node coordinate and check what the SDK placed there. Then find
which code path decides the entry commitment written **inside the collection band**
(not the padded slot): the suspect list from the findings file is
`_padOutputsToIndex` (`StatefulTransactionBuilder.ts:7951`, call sites `:13282`,
`:13483`, `:16921`, `:18433`), `build`'s `derivedChunkOutputs` placement (~`:18226`),
and `appendDelegateGroupOutputs` (`:15894`). The `band` reset arm in
`_reassertStagedValueChunkOutputs` (`:13282+`) writes
`cloneToken(occupant.token)` from `this.allInputs[index]` — i.e. the consumed
input's pre-state commitment — which is precisely a "stale pre-state body" writer.

**Also correct two tool notes from earlier rounds:**

* The ring/large-equals diagnostics need `SOLIDC_DEBUG_FAILURE_RING=1` (not only
  `SOLIDC_DEBUG_FAILURE_POINT`); with it, `message-bus-large-equals` prints every
  `OP_EQUALVERIFY` operand pair. For this title it yields exactly one meaningful row —
  the `e3b0c442…` vs `c2a8d2ff…` pair — plus small `00`/`00` and self-equal rows, so
  there is no separate cardinality read to find.
* `SOLIDC_DEBUG_EQUAL_WATCH=<hex-prefix>` (added this round, then reverted with the
  rest of the probe) makes the scan print the last 60 executed instructions with their
  stack tops when a matching operand appears. That trace is what showed the value is
  pushed as a 103-byte item and DLE-decoded at ip 7847-7855 (`OP_NIP OP_ROLL OP_SPLIT
  OP_0 OP_ROLL OP_DUP OP_2 OP_PICK OP_EQUALVERIFY`) into the 32-byte slot — worth
  re-adding rather than hand-decoding byte boundaries again.

### ROUND 6 ROOT CAUSE: the SDK transposes the predecessor entry's `slot` and `nextKey`

The compiler publishes the complete vmap topology as witnesses, and the SDK's
materialized entry disagrees with it by a straight field swap. From
`preflight-unlocker-params` (input 214, `SOLIDC_DEBUG_PREFLIGHT_ROUTE=1
SOLIDC_DEBUG_ROUTE_INPUT_INDEX=214`):

    __internal__vmapBatchSlot_0   725babc3f2b6f93c99f4ae965d72a8e28fe0efaddffe66f6fcf48e2144cf4215   Next_0  0                   PredOut_0  -2
    __internal__vmapBatchSlot_1   e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855   Next_1  0                   PredOut_1  150
    __internal__vmapBatchSlot_2   e2a4aac2498e0a62d7a3936482584bb94059e33c96b7090c81338243b335d559   Next_2  0                   PredOut_2  -1
    __internal__vmapBatchSlot_3   e2a4aac2498e0a62d7a3936482584bb94059e33c96b7090c81338243b335d559   Next_3  0                   PredOut_3  -2
    __internal__vmapBatchSlot_4   41d0326f18316d0cde6612927fcf6def7c1fa980e37aa3eafc155955f19eda26   Next_4  0                   PredOut_4  -1
    __internal__vmapBatchSlot_5   3df6d4d865fadd63a788de2eec3d24ec56f4fae1a1751217c8b1d8faf9133635   Next_5  f6e31252a31d19336117582c2c39cd60f81de513948b5cc722d3e03b05c23247   PredOut_5  -1

The SDK's entry **at the declared P' coordinate** (`PredOut_1 = 150`), decoded as
`slot || nextKey || value`:

    idx 150  sats 1200  mutable  64 bytes
      slot    0000000000000000000000000000000000000000000000000000000000000000
      next    e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      value   (empty, 0 bytes)

Compare `Slot_1 = e3b0c442…`, `Next_1 = 0…0`. **The two fields are swapped.** The
covenant's `emitSortedValueUpsert` INSERT branch verifies
`P' = coSlot32 || Hk32 || coValue` (`GenerateTargetTraversal.ts:20668`,
`emitVerifySortedValueOutput(loc, 4, 3, 5, 1, 6)`), i.e. it reads the on-chain
commitment as `slot || next || value` and requires `slot == Slot_1` and
`next == Next_1`. Against the SDK's transposed entry it reads `slot = 0…0` and
compares it to `e3b0c442…` — which is exactly the failing `OP_EQUALVERIFY` at ip 7855
(`left = e3b0c442…`, `right = c2a8d2ff…`, the latter being the runtime DLE-decoded
form of the observed `slot || next || value` tuple).

Secondary observation from the same dump: the on-chain band is
`150 = slot 0, next e3b0c442` (P' as the SDK built it),
`218 = slot e2a4aac2, next 0`,
`219 = slot 8c600621, next 21c513b0`,
`220 = slot 09f85bbf, next 484c83d4`,
`239 = slot 0, next 8c600621` — so the whole band is present but the FIRST member (the
declared P') is the transposed one. `218` also has `next = 0` where the witness wants
`Slot_2`/`Next_2`, so 218 looks like the NEW node built with `next = 0` instead of the
splice predecessor's next.

**Where to fix (bounded):** the P' commitment is built in `SortedList.ts`:
`:237` `predNewCommitment: encodeEntryCommitment(predecessor.slot, slot, predecessor.value)`
(insert) and `:479` (splice out). `encodeEntryCommitment(slot, nextKey, value)` writes
`slot || nextKey || value`, so those call sites look correct — the transposition must
happen where the SDK *re-derives* the P' output before writing it (the same three paths
the findings file names: `_padOutputsToIndex` `:7951`, `build`'s `derivedChunkOutputs`
placement ~`:18226`, `appendDelegateGroupOutputs` `:15894`, plus the band reset in
`_reassertStagedValueChunkOutputs` ~`:13282`). The decisive question is narrow and
should be answered next: **which code writes output 150's commitment**, and does it use
`predNewCommitment` or a `decodeEntryCommitment(out.commitment)` round-trip (see
`:19423-19425`, which rebuilds a target commitment as
`encodeEntryCommitment(slot, decodeEntryCommitment(out.commitment).nextKey, valueTail)`) —
a round-trip through `.nextKey` where `.slot` was intended produces exactly this swap,
and `:19443`'s `raw?.next ?? decodeEntryCommitment(out.commitment).nextKey` shows a
`.nextKey` read feeding a field that the covenant treats as the node's next.

**Diagnostic used (re-add if needed):** `SOLIDC_DEBUG_OUTPUT_SLICE=1` plus
`SOLIDC_DEBUG_OUTPUT_SLICE_INDICES=<comma list>` (added at the top of
`evaluateEveryInput` in `preflight.ts`, then reverted with the rest of the probe) prints
`sats`, `capability`, byte length and full commitment hex for named output indices, which
is what made the swap visible.

### ROUND 7 CORRECTION: there is no slot/nextKey transposition — round 6 misread it

Round 6 concluded that output 150's `slot = 0…0, next = e3b0c442…` was a transposition
against the witnesses. **That was wrong.** Reading `SortedList.planInsert`
(`SortedList.ts:233-239`):

    const predecessor = this.predecessorOf(slot);
    const oldNext = predecessor.nextKey;              // becomes NEW's next
    predNewCommitment: encodeEntryCommitment(predecessor.slot, slot, predecessor.value),
    newNodeCommitment: encodeEntryCommitment(slot, oldNext, value),

and `encodeEntryCommitment(slot, nextKey, value)` writes `slot || nextKey || value`.

For this title the insertion is a **HEAD insert into an empty collection**: the
predecessor is the HEAD sentinel, so `predecessor.slot = 0…0`, the new key is
`slot = e3b0c442…`, and `predecessor.value` is empty. Therefore

* P'  = `0…0 || e3b0c442… || (empty)` — **exactly the 64-byte entry at output 150**;
* NEW = `e3b0c442… || 0…0 || value` — the new node.

Both are correct, and the covenant's `Slot_1 = e3b0c442…` is `coHk32`, not the
predecessor's slot. So no transposition exists and output 150 is right.

**Also tried and rejected this round:** the batch `Next` witness was read from
`plan.newNodeCommitment` where the predecessor's spliced link is meant
(`StatefulContract.ts` batched entry path). That is a genuine latent semantic bug —
they differ whenever the predecessor was not already adjacent to the inserted key —
and it is now fixed in `b8dea98a6`, but for a HEAD insert both nexts are `0…0`, so the
witness values and the transaction are byte-identical and the title fails unchanged.
It is committed as a correction, **not** as a fix for this blocker.

Verified after both: `SOLIDC_DEBUG_PREFLIGHT_ROUTE=1` witness dump is unchanged
(`Slot_1 = e3b0c442…`, `Next_1 = 0…0`), and `journal-message-bus/e2e` is 116 failures
with zero new.

### So the failing value is NOT P' — the next target

The failing `OP_EQUALVERIFY` at ip 7855 compares `e3b0c442…` (the covenant's computed
value) against `c2a8d2ff…` (runtime). Since P' at output 150 is provably correct, the
`c2a8d2ff…` operand is **not the P' commitment**. Candidates left, in order:

1. **The NEW node.** `PredOut_1 = 150` is P'; the covenant then verifies NEW via
   `emitVerifySortedValueOutput(loc, 1, 6, 3, 7, 6)` after computing the trailing block
   base (`GenerateTargetTraversal.ts:20679-20697`). The SDK's band member that looks
   like NEW is index **218** (`slot e2a4aac2…`, next `0…0`, value tail
   `0000907b984f02ca30`) — but the witnesses say the new key's slot is `e3b0c442…` and
   `Slot_2`/`Slot_3` are both `e2a4aac2…`. Check which SDK output is meant to be NEW and
   whether it carries `e3b0c442…` as its slot.
2. **The value tail.** `218`'s tail is 8 bytes (`0000907b984f02ca30`) where the
   `jobEvents` append should carry the encoded `JobEventData` element — compare against
   the `code`/`value` the handler wrote.
3. The `jobEvents` batch's key-slot derivation: `__message_bus_key_jobEvents_0 = '0'`
   is the raw key, and `Slot_1 = e3b0c442…` is asserted to be its slot. Confirm the
   covenant's own `keyToSlot` for key 0 agrees (`sha256(sha256(<encoded 0>))` with the
   high bit cleared) — my attempts at `sha256("")`/u64 encodings did not reproduce
   `c2a8d2ff…`, so identify what actually produces that value rather than assuming.

The cheapest discriminator: dump the covenant's `coHk32`, `coSlot32` and `coValue`
inputs for this insert (they are computed from the batch witnesses above, all of which
are known) and compare each against the three fields of the SDK's NEW candidate.

### ROUND 8: the SDK's P' is correct by construction — the open question is now sharp

Confirmed with a full-transaction slot scan (`SOLIDC_DEBUG_SLOT_SCAN=1` plus
`SOLIDC_DEBUG_SLOT_SCAN_HEX=<32-byte hex>`, added at the top of `evaluateEveryInput`
and reverted): `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` occurs
in exactly two outputs, as the **second 32-byte field** of a 64-byte commitment:

    idx 150 (the declared P' coordinate, PredOut_1):
        off  0: 0000000000000000…0000     (slot)
        off 32: e3b0c44298fc1c14…b7852b855 (next)
    idx 133: identical

So P' = `0…0 || e3b0c442…`, which is *exactly* what `SortedList.planInsert` produces for
a HEAD insert of key-slot `e3b0c442…`: `encodeEntryCommitment(predecessor.slot, slot,
predecessor.value)` with `predecessor.slot = 0…0`, `slot = e3b0c442…`, empty value. **The
SDK's P' is correct by construction**, which is why round 7's `Next`-witness change was
inert and why no transposition exists (round 6 and round 7 both settled).

That leaves one sharp, unresolved contradiction to attack next — it is now the whole
of the remaining question:

* The compiler reads the batch `Slot_N` witness as the **entry's own slot**:
  `GenerateTargetTraversal.ts:22271` emits
  `fixedField('slot'); arg('__internal__vmapBatchSlot_' + aliasOwner, 1); OP_EQUALVERIFY`.
  The SDK sets `Slot_N = bSlot` — the key being inserted — so for this insert
  `Slot_1 = e3b0c442…`.
* The SDK's P' at output 150 has `slot = 0…0`, i.e. the PREDECESSOR's slot. If the
  covenant looks up P' by `Slot_1`, it will not find it, because the on-chain entry at
  the `PredOut_1 = 150` coordinate does not carry `Slot_1` in its slot field.
* Also unexplained: the covenant's `Next_N` for this slot is `0…0`
  (`__internal__vmapBatchNext_1`), and after round 7 the SDK publishes
  `decodeEntryCommitment(plan.predNewCommitment).nextKey`, which must equal the inserted
  key's slot (`e3b0c442…`) for an insert. It stayed `0…0`, so **the `plan` that ran for
  route slot 1 is not the insert plan this model predicts** — either `bList.has(bSlot)`
  was true (taking the `exact` branch at `StatefulContract.ts:22702`, which sets
  `PredOut_N = -1`), or a different slot-to-key mapping produced this pair. Determining
  which is the next concrete step, and it decides everything downstream.

**Recommended next experiment (do this first):** log, in the batched entry path at
`StatefulContract.ts:22700-22737`, for each `routeSlot`: `routeSlot`, `bSlot`,
`bList.has(bSlot)`, `blockOffset`, `plan.predNewCommitment` and `plan.newNodeCommitment`
as hex. That single log resolves whether slot 1 took the insert or the exact branch and
what the true predecessor is — it is the ambiguity that made rounds 6, 7 and 8 each
reason from an assumption instead of a measurement.

### ROUND 9: the running branch is identified, and the witness family is now consistent

**The branch that runs is not `planInsert` in the batched entry path.** Instrumenting
`StatefulContract.ts:22722` shows *zero* executions for this title; the work is done by
the **nested batch planner at `StatefulContract.ts:26260-26275`**, which publishes:

    childCompilerInternalArgs[`__internal__vmapBatchSlot_${slotIndex}`]    = target
    childCompilerInternalArgs[`__internal__vmapBatchNext_${slotIndex}`]    = decodeEntryCommitment(output.commitment).nextKey
    childCompilerInternalArgs[`__internal__vmapBatchPredOut_${slotIndex}`] = batchInsertBase + childBatchTrailingCount + predecessorOrdinal

where `proof = list.find(target) ?? list.predecessorOf(target)` and `output` is the plan's
own output for `target`. That establishes the family's invariant, which is uniform across
all three writers: **`Slot_N` = the target key's slot, `Next_N` = that target entry's
nextKey, `PredOut_N` = the predecessor's output coordinate.**

**`b8dea98a6` broke that uniformity and is reverted by `94cb9ac11`.** It derived `Next_N`
from `predNewCommitment` in the (unused-here) batched path, making one branch disagree
with the other two about the field's meaning. `94cb9ac11` restores the target-entry read
and documents the invariant. Measured: the title fails identically either way, so this is
a consistency repair, not the fix; `journal-message-bus/e2e` is unchanged at 116 failures,
zero new.

**Consequence for the remaining blocker.** Given that invariant, the covenant must obtain
the predecessor's slot for the P' check from **`Proof_N` / `PredOut_N`**, not from
`Slot_N` (which is the target). The SDK's P' at output 150 is `proof.slot || target ||
proof.value` = `0…0 || e3b0c442… || (empty)` — consistent with that reading. So the open
question is now narrow and mechanical: **where does the covenant get `coSlot32` for the P'
commitment, and does the SDK's `PredOut_1 = 150` actually point at an output whose
predecessor fields match?** The next probe should log, in the nested planner at `:26260`:
`routeSlot`, `target`, `proof.slot`, `proof.nextKey`, `predecessorOrdinal`, the computed
`PredOut`, and `output.commitment` — then compare `PredOut`'s referenced output against
150 and against the plan's `predNewCommitment`.

Both `SOLIDC_DEBUG_VMAP_BRANCH` (batched path) and the earlier `DBG-OUTPUT-SLICE` /
`DBG-SLOT-SCAN` probes are reverted; re-adding the nested-planner log above is a
five-line change at a known location.

### ROUND 10: the witness table and the output plan disagree about which keys exist

Instrumenting the nested batch planner (`:26260`, probe reverted) prints its decisions for
this title. All four:

    _allowances  routeSlot 0  target 09f85bbf77ab…  predOut 4    (targetOffset 1)
    _balances    routeSlot 0  target 8c60062159c0…  predOut 8    (targetOffset 2)
    _balances    routeSlot 2  target e2a4aac2498e…  predOut -1   (targetOffset 4)
    _allowances  routeSlot 1  target f8f643889106…  predOut -1   (targetOffset 3)

Each carries a **correct-looking** predecessor record, e.g. for `_allowances` slot 0:

    predecessorOutputs[0] = { slot: f8f64388910649b0…, commitment: f8f64388910649b0…09f85bbf77abf3d5…, existed: true }

i.e. the correct predecessor `f8f64388` whose successor is being set to `09f85bbf` — exactly
`predNewCommitment = predecessor.slot || target || predecessor.value`.

**The contradiction:** the planner produces targets
`{09f85bbf, 8c600621, e2a4aac2, f8f64388}`, but the witness table applies to six slots:

    Slot_0 725babc3f2b6f93c99f4ae965d72a8e28fe0efaddffe66f6fcf48e2144cf4215   <- never produced by the planner
    Slot_1 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855   <- never produced by the planner
    Slot_2 e2a4aac2498e0a62d7a3936482584bb94059e33c96b7090c81338243b335d559   <- produced (slot 2)
    Slot_3 e2a4aac2498e0a62d7a3936482584bb94059e33c96b7090c81338243b335d559   <- produced (slot 2, duplicated)
    Slot_4 41d0326f18316d0cde6612927fcf6def7c1fa980e37aa3eafc155955f19eda26   <- never produced
    Slot_5 3df6d4d865fadd63a788de2eec3d24ec56f4fae1a1751217c8b1d8faf9133635   <- never produced

So two witnesses (`Slot_0 = 725babc3…`, `Slot_4 = 41d0326f…`) name keys that the output
plan never materializes, and the `jobEvents` insert (`Slot_1 = e3b0c442…`) has **no planner
decision at all** — yet `PredOut_1 = 150` points at a real output that does carry
`0…0 || e3b0c442…`. Either a third writer sets these witnesses (candidates:
`:22905 bPlannedEntryInserts`, `:27254`/`:27364 lateInternalArgs`, `:27326` alias
targets), or the witnesses are computed against a different `SortedList` than the outputs.

**This is the thing to measure next, and it is cheap:** log every write to
`__internal__vmapBatchSlot_*` and `__internal__vmapBatchPredOut_*` with the calling site
(line number) and the value, then diff the set of `(routeSlot, slot)` pairs against what
the planner produced. Whichever writer emits `Slot_0 = 725babc3…` and `Slot_1 =
e3b0c442…` is the one whose `PredOut` must be correct — and until that is known, every
hypothesis about "which output is P'" is guesswork, as rounds 6-9 demonstrated.

Why this is the likely bug rather than a detail: the covenant locates P' **by the output
coordinate `PredOut_N`**, and cross-checks it against its own slot/next witnesses. If two
writers disagree, `PredOut_N` and `Slot_N` can come from different plans, which is exactly
the symptom — a correct-looking P' at 150 paired with a witness pair that does not
describe it.

### ROUND 11: the transaction consumes and recreates the same entries at the same coordinates

Full band dump for the failing transaction (probes reverted; entry rows below are
`slot=`, `next=`, and value-tail length, from each mutable 128-byte-or-longer commitment):

**Consumed mutable entry inputs (120..216):**

    in 130  slot 0023aa20fb9daa43  next 32e767d387013501  valLen 11
    in 133  slot 0000000000000000  next 0000000000000000  valLen 0
    in 134  slot e2a4aac2498e0a62  next 0000000000000000  valLen 64
    in 136  slot 41d0326f18316d0c  next 0000000000000000  valLen 64
    in 137  slot 3df6d4d865fadd63  next f6e31252a31d1933  valLen 17
    in 138  slot 0000000000000000  next cabb7b582130831e  valLen 0

**Outputs:**

    out 130  slot 0023aa20fb9daa43  next 32e767d387013501  valLen 11   <- byte-identical to in 130
    out 133  slot 0000000000000000  next e3b0c44298fc1c14  valLen 0    <- CHANGED next
    out 134  slot e2a4aac2498e0a62  next 0000000000000000  valLen 64   <- byte-identical to in 134
    out 136  slot 41d0326f18316d0c  next 0000000000000000  valLen 64   <- byte-identical to in 136
    out 137  slot 3df6d4d865fadd63  next f6e31252a31d1933  valLen 17   <- byte-identical to in 137
    out 138  slot 0000000000000000  next cabb7b582130831e  valLen 0    <- byte-identical to in 138
    out 150  slot 0000000000000000  next e3b0c44298fc1c14  valLen 0
    out 218  slot e2a4aac2498e0a62  next 0000000000000000  valLen 9
    out 219  slot 8c60062159c0569d  next 21c513b0c2661060  valLen 9
    out 220  slot 09f85bbf77abf3d5  next 484c83d413774888  valLen 33
    out 239  slot 0000000000000000  next 8c60062159c0569d  valLen 0

Two facts stand out and neither is explained by any hypothesis tried so far:

1. **134, 136, 137 (and 138) are recreated byte-identically at their own input indices.**
   Those are the *modified* targets per the nested planner — `_balances` slot 2
   (`e2a4aac2`, targetOffset 4), `_allowances` slot 1 (`f8f64388`, targetOffset 3) — but at
   134/136 they carry their **pre-state** contents. The actually-updated rows are the ones
   at 218/219/220 (real value tails 9, 9 and 33 bytes) and 150/239.
2. **`Slot_0 = 725babc3…` has no output at all**, and `Slot_5 = 3df6d4d8…`'s `PredOut_N`
   is `-1` while output 137 still carries `next = f6e31252…`, i.e. the pre-splice link.
   The witness table therefore names at least one entry the transaction never creates.

Also note `Slot_2` and `Slot_3` are the **same** slot (`e2a4aac2…`) appearing twice in one
batch, with `PredOut_2 = -1` and `PredOut_3 = -2`, while the nested planner emitted only
**one** decision for that target (`_balances` slot 2, `predOut -1`). Duplicate slot
witnesses with different predecessors are another sign that the witness table and the
output plan are not describing the same batch.

**Most valuable next step (cheap, decisive):** the transaction's own inputs show the true
pre-state (`133 next 0`, `137 next f6e31252`). Recompute, for each witness N, what
`PredOut_N` *should* be from those inputs, and compare against the published value. If
`PredOut_0`/`Slot_0` and `Slot_2`/`Slot_3` cannot be satisfied by any output in the
transaction, the witnesses are stale — i.e. computed from an earlier planning iteration —
and the fix belongs where `vmapBatchSlot_*`/`vmapBatchPredOut_*` are memoized, not in the
entry planner that rounds 6-10 kept re-examining.

### ROUND 12: `Slot_0`'s entry does not exist anywhere in the transaction

A needle scan over **both** the transaction's outputs and the source outputs of every one
of its 308 inputs (probe reverted) for
`725babc3f2b6f93c99f4ae965d72a8e28fe0efaddffe66f6fcf48e2144cf4215`
(`__internal__vmapBatchSlot_0`) returns:

    in inputs : []
    in outputs: []

So the covenant is handed a batch entry slot that the transaction neither consumes nor
creates. That is not a P'/NEW placement problem — it is the witness table naming a key
that has no state at all in this transaction, which is the signature of **stale witnesses**
(the value was computed against an earlier plan/state and not refreshed).

Cross-checks from the same round, all consistent with that reading:

* `Slot_1 = e3b0c442…` **is** present, as the `next` field of outputs 133 and 150.
* `Slot_4 = 41d0326f…` **is** present, as the `slot` of output 136, and output 136 is
  byte-identical to the consumed input 136 — i.e. the entry was preserved, not rewritten.
* `Slot_5 = 3df6d4d8…` is present at output 137, whose `next` is `f6e31252…` — matching
  `Next_5 = f6e31252…` exactly. Its `PredOut_5 = -1` therefore claims "target entry is its
  own proof", which is consistent.
* 134, 136, 137 and 138 are **recreated byte-identically at their own input indices**,
  while the rows with genuinely new value tails are 218/219/220 (tails 9, 9, 33 bytes) and
  150/239.

Note also that the key parameters for this transaction are `jobEvents`,`users`,
`arbitrators`,`userRatings`,`meceTags`,`userReviews` — six keys for six witness slots — and
`__message_bus_key_jobEvents_0 = '0'` whose slot is `e3b0c442…`, which the table assigns to
**`Slot_1`**. So slot index and key index are offset relative to each other as well, which
is what one expects if the table was assembled from a different batch than the one the
outputs implement.

**Next step (was `PredOut` recomputation; now sharper):** find where
`__internal__vmapBatchSlot_*` / `__internal__vmapBatchPredOut_*` are *cached or reused*
across planning iterations and confirm whether a stale entry survives into the final
assembly. Concretely, log the witness map at each write with a monotonically increasing
iteration/assembly counter, then fail loudly if the final assembly reuses a map whose
`Slot_0` key is absent from the plan it is assembling. That converts "stale" from an
inference into an assertion, and the assertion is the fix's guard rail.

`__message_bus_key_jobEvents_0 = '0'` -> slot `e3b0c442…` is `Slot_1`, not `Slot_0`, so the
slot/key alignment is itself suspect; verify the intended correspondence before changing
either side.

### ROUND 13: the executed nested planner produces only 4 of the 6 witness slots

Re-ran the nested-planner probe without deduplication. It runs its per-slot branch **eight**
times (two batches × their slot indices) but completes a decision only four times, and never
for the slots that matter:

    iteration 1  _allowances  slot=0  target=09f85bbf77ab  proofSlot=f8f643889106  isTarget=False  predOut=4   active=['_allowances:0']
    iteration 2  _balances    slot=0  target=8c60062159c0  proofSlot=000000000000  isTarget=False  predOut=8   active=['_balances:0,2', '_allowances:1']
    iteration 3  _balances    slot=2  target=e2a4aac2498e  proofSlot=e2a4aac2498e  isTarget=True   predOut=-1  active=['_balances:0,2', '_allowances:1']
    iteration 4  _allowances  slot=1  target=f8f643889106  proofSlot=f8f643889106  isTarget=True   predOut=-1  active=['_balances:0,2', '_allowances:1']

So the executed planner accounts for `_allowances:{0,1}` and `_balances:{0,2}` and **nothing
else**. The witness table's `Slot_0 = 725babc3…`, `Slot_1 = e3b0c442…`, `Slot_4 = 41d0326f…`
and `Slot_5 = 3df6d4d8…` are not produced by it.

Two of the four values are now explained and are **correct**, which narrows the search:

* `PredOut_N = -2` is a deliberate marker, not a bug: `StatefulContract.ts:26308` comments
  "predOut=-2 is a true same-target runtime alias and deliberately has no target output",
  and the alias assignment at `:26196-26200` sets `Next = zeros`, `PredOut = -2`.
* The alias path itself does **not** run for this title — a probe of
  `aliasOwner.get(slotIndex)` shows `aliasOwnerSize: 0` on every visit, so `-2` is not coming
  from there.

**Therefore the remaining suspects are the *other* witness writers**, which is where the next
round should look rather than at the nested planner: `:22905`
(`bCompilerInternalArgs[vmapBatchPredOut_${planned.slotIndex}]`), `:27237-27241` and
`:27309-27312` / `:27347-27349` (the `lateInternalArgs` family), and `:26333`
(`childCompilerInternalArgs[...PredOut]` rewrite for planned inserts). One of those is
producing `Slot_0`/`Slot_1`/`Slot_4`/`Slot_5` for the batch, and since `Slot_0`'s entry is
provably absent from the transaction (round 12), that writer is working from state that the
assembled transaction does not share.

**Cheapest decisive measurement:** print the *final* `childCompilerInternalArgs` /
`lateInternalArgs` witness map immediately before the route ABI is encoded, and compare its
`(slotIndex -> slot, predOut)` pairs against the four planner decisions above. That single
dump identifies both the extra writer and the stale keys, and it is the last piece needed
before the fix.

### ROUND 14: the route's real witness table, and the chain it does not satisfy

**Correction:** the six-slot table quoted in rounds 10-12 was extracted from a *different*
transaction's parameter dump (it belonged to an `initialize`/genesis entry). The route under
failure is `__message_bus1` with `sortedBatchInfo = ['_balances[0,1]', '_allowances[2,3]']`,
and dumping the final witness map where it is assembled
(`StatefulContract.ts:19462`, `entryBatchWitnesses = new Map(...)`; probe reverted) gives
exactly **four** slots:

    Slot_0  e2a4aac2498e0a62d7a3936482584bb94059e33c96b7090c81338243b335d559   Next_0  0…0                                                                PredOut -1
    Slot_1  8c60062159c0569d397635696b7dbdf03420bc417718429c56d738db370e621d   Next_1  21c513b0c2661060bc5c9ddd6640b03c5e4e9d3976f1d0e60cc9f197f96dac32   PredOut 239
    Slot_2  09f85bbf77abf3d58fa693e798679c2ddfb77fdbd6ffc99aed72387e82d9656b   Next_2  484c83d4137748889dcd31f84f30a96393d30b42722e64b5cdf73cc3b5ded26b   PredOut -1
    Slot_3  f8f64388910649b0cff4b60b13d9c517620fec824459a639ee346a4f6d6d9232   Next_3  09f85bbf77abf3d58fa693e798679c2ddfb77fdbd6ffc99aed72387e82d9656b   PredOut -1

Correlating against the assembled transaction's entry outputs
(`slot`, `next`, value-tail bytes):

    out 134  slot e2a4aac2…  next 0…0   tail 64        <- matches Slot_0's (slot, Next)
    out 136  slot 41d0326f…  next 0…0   tail 64        <- matches NOTHING in the table
    out 137  slot 3df6d4d8…  next f6e31252…  tail 17   <- matches NOTHING in the table
    out 218  slot e2a4aac2…  next 0…0   tail 9         <- ALSO matches Slot_0's (slot, Next)
    out 219  slot 8c600621…  next 21c513b0…  tail 9    <- matches Slot_1 (slot, Next) exactly
    out 220  slot 09f85bbf…  next 484c83d4…  tail 33   <- matches Slot_2 (slot, Next) exactly
    out 150  slot 0…0        next e3b0c442…  tail 0
    out 239  slot 0…0        next 8c600621…  tail 0    <- PredOut_1 = 239

Four concrete defects are now visible, all inside this 4-slot table:

1. **`Slot_3`'s entry does not exist in the outputs.** Nothing carries slot `f8f64388…`,
   and nothing carries `Next_3 = 09f85bbf…` as a *next*. Yet the nested planner explicitly
   planned `_allowances` slot 1 → target `f8f64388…` with `predOut = -1` (round 13). The
   ledger write for that entry was planned and then not materialized.
2. **`Slot_0` matches two outputs** (134 and 218) with identical `(slot, next)`. `134` is
   byte-identical to consumed input 134, i.e. pre-state preserved; `218` is the same slot
   with a 9-byte value tail. So the collection appears twice in the same transaction and
   the covenant cannot tell which one the witness means.
3. **`Slot_0`'s `Next_0 = 0…0`** while `Slot_0` is mid-chain: `Slot_2` points at `484c83d4…`
   and `Slot_1` sits between `e2a4aac2…` and `09f85bbf…` in value order. A zero next in the
   middle of the chain is only valid for the last element.
4. **The successor chain is broken.** For the covenant's linked-list check, `Next_0` should
   be `Slot_1`'s slot (`8c600621…`) and `Next_1` should be `Slot_2`'s (`09f85bbf…`). They
   are `0…0` and `21c513b0…` respectively, and `21c513b0…` is not any slot in the table.
   Meanwhile `Next_3 = 09f85bbf…` *is* `Slot_2`'s slot — as if `Slot_3` were the element
   immediately before `Slot_2`, not after `Slot_0`.

**Next step:** the table and the outputs agree on `Slot_1`/`Slot_2` and disagree on
`Slot_0`/`Slot_3`, so diff those two by construction. Specifically, for `_balances[0,1]`
and `_allowances[2,3]`, print from the planner the `(slot, proof.slot, proof.nextKey,
predOut)` it decided and the `(slot, next)` it wrote, then compare against the table above —
`Slot_3`'s missing output and `Slot_0`'s two outputs should fall straight out. Note also that
`_allowances` uses slot indices `2,3` in the route while the nested planner plans
`_allowances` slots `0,1` (round 13): a slot-index remap between planning and route
publication is a strong candidate for the whole discrepancy.

### ROUND 15: the slot-index remap hypothesis is refuted

Round 14's prime candidate ("a slot-index remap between planning and route publication")
does not hold. Probing the planner and the route's published metadata together
(`SOLIDC_DEBUG_BATCH_SPACE=1`, probe reverted) shows all three observed configurations are
**internally consistent**:

    handler=approve       _allowances  planner [0]      route [{' _allowances', [0]}]                  layout entries [0]
    handler=transferFrom  _balances    planner [0, 2]   route [{' _balances', [0, 2]}, {' _allowances', [1]}]  layout entries [0, 1, 2]
    handler=transferFrom  _allowances  planner [1]      route (same as above)                          layout entries [0, 1, 2]

and the four-slot table from round 14

    handler=__message_bus1  _balances [0, 1]   _allowances [2, 3]   layout entries [0, 1, 2, 3]

is a third, self-consistent configuration. In every case `plannerBatchSlotIndices`,
`route.sortedBatchInfo[].slotIndices` and the layout's entry slot indices agree. My round-13
reading of "`_allowances` slots 0,1 in the planner vs 2,3 in the route" was comparing **two
different contracts' configurations**, not a remap inside one.

So the discrepancy is not in the index space. It is still the four defects isolated in round
14, all within the `__message_bus1` four-slot table: `Slot_3`'s entry never materializes,
`Slot_0` matches two outputs, `Next_0 = 0…0` mid-chain, and the successor chain does not
match the table (the covenant wants `Next_0 = 8c600621…` and `Next_1 = 09f85bbf…`).

**Where to go next, given the above:** the useful next measurement is no longer about indices
but about *which writer last set each of the four slots*. Dump, at the point the route ABI is
encoded, the four `(Slot_N, Next_N, PredOut_N)` triples together with a per-slot
"last writer" tag (add the tag at each of the five candidate sites: `:22905`, `:26252-26257`,
`:26333`, `:27237-27241`, `:27347-27349`). Whichever site set `Slot_0`/`Slot_3` is the one
whose predecessor plan disagrees with the assembled outputs — and for `Slot_3` the plain
question is why a planned `_allowances` write produced no entry output at all.

Note for whoever continues: the marketplace suite is at 21/66 and every round since round 5
has been diagnosis rather than a fix on this blocker. The three commits that *did* move the
suite are `95075e7db`, `5cc5c6558`, `9b4792c19` (and `94cb9ac11` restored correctness without
moving the count). If this blocker resists another round or two of the above, it may be worth
routing around it — the remaining 21 non-preflight failures (3 `index out of bounds`, 1 revert
assertion, 1 state-derivation convergence) are independent and may be cheaper.

### ROUND 16: routed around the input-214 blocker — the `index out of bounds` mechanism, corrected

Following this file's own advice, this round worked the independent failures instead of the
38-title batch-witness blocker. Result: the documented explanation of the three
`index out of bounds` titles is **wrong in its mechanism**, and the real one is now pinned.

**Correction.** `MARKETPLACE_ENTRY_CARDINALITY_FINDINGS.md` says the revert comes from the
synthetic pagination fallback. It does not. That fallback lives in
`StatefulContract`/`upgrades.ts:418-425` and is gated by
`proxySyntheticPaginationCollection` (`stateful/proxy-pagination.ts`), which returns
`undefined` whenever the artifact already declares the method:

    if (implementation.abi.some((entry) => entry.name === methodName)) return undefined;

and `getArbitrators` **is** declared in `MarketplaceDataV1.json`'s ABI. So the fallback never
runs, and `throw new Error('index out of bounds')` in the *test* is simply the echoed VM
revert reason surfaced through `probeRequireMessage`.

**The real mechanism.** The compiled view function is:

    getArbitrators(index_ uint256, limit_ uint256,
                   __internal__valueWitness_0 bytes, __internal__returnOutputIdx bigint,
                   __internal__proxyMasterIndex bigint, __internal__dynamicChunkInputBase bigint)
      -> JobArbitrator[]

`arbitratorAddresses` is not a `stateLayout.collections` entry (I checked: `undefined`), so
the body's bounds check reads the dynamic state array's length from the **P5b chunkable value
witness** (`__internal__valueWitness_0`). The witness path is gated at
`StatefulContract.ts:18417`:

    const hasChunkableValueWitness = collection.sorted && collection.chunkableValue
      && (entryOperations(slotIndex).includes('read') || ...);

and the witness is built from `proofEntry.value` (`:18683-18700`), i.e. the 4-byte LE length
prefix followed by the inline value or `sha256(value) || head`. Inside the VM the array
therefore reads as **length 0**, so `require(index_ < length_)` reverts —
exactly what the earlier session's instrumentation saw ("SDK does see the entry UTXOs:
`rawUtxos: 2, filtered: 2`, yet the call still reverts").

**Why this is a bigger job than it looks.** The Solidity source is
`arbitratorAddresses.length` + `getArbitrators(index, limit)` returning
`JobArbitrator[]`. The port compiled the *storage* as `arbitrators: mapping(address =>
JobArbitrator)` and kept a `getArbitrators(index, limit)` view, so the index/limit arguments
are being interpreted against a mapping-keyed view rather than a positional array. Making the
witness carry the real array contents requires the compiled `arbitratorAddresses` array to be
materialized as an addressable collection (a `T[]`-kind collection with its trailing chunks),
not merely deriving a better witness for a mapping entry. That is a compiler-semantic change,
and it should be scoped deliberately rather than patched in the SDK.

**Cheapest next probe (5 lines):** log `access.collection`, `collection.sorted`,
`collection.chunkableValue`, `entryOperations(slotIndex)`, and the resulting
`proofEntry.value` length at `:18417`/`:18688` for `getArbitrators`. If
`hasChunkableValueWitness` is true but the value tail is empty or is a longer-than-head
digest, the defect is in the proof-entry selection; if it is false, the param is absent from
the ABI order and the length read is reading something else entirely.

### ROUND 17: the array length reads 79 because the witness is one struct, not the array

Used the repo's own `SOLIDC_DEBUG_VALUE_WITNESS=1` hook (`StatefulContract.ts:18744`,
`chunkable-read-witness`) on `register arbitrator`, which fails with `index out of bounds`.
The block for the failing view:

    functionName: 'getArbitrators'   collection: 'arbitrators'   slotIndex: 0
    slot:        41d0326f18316d0cde6612927fcf6def7c1fa980e37aa3eafc155955f19eda26
    present:     true                proofSlot: same (the entry itself)
    tailBytes:   64                  storedLength: 79
    witnessBytes: 79
    witnessHead: 1976a914c4ad89cdb7377ec8a163070e8442d399a87b870188ac210211c5a8d9b0e12cdd69fd6c4b0008bc1c830e766e9d5aff5779ecc5decfd240f2

Decoding the witness: `19 76a914…88ac` is a 25-byte `address` (the 20-byte pubkey hash with
its prefix), then `21 02 11c5…40f2` is a 33-byte compressed `pubkey`. That is **one
`JobArbitrator` struct** = 25 + 33 = 58 bytes of payload, 79 with the pushdata-length
prefixes. It is exactly the selected mapping entry's value.

The covenant is reading the dynamic array's length from that witness, so it sees 79 where the
source-level array has 1 element, and `require(index_ < length_)` then fails on a completely
different comparison — hence "index out of bounds" for a call that passes `index=0`.

**So the defect is now fully characterised, and it is a compiler-semantic gap, not an SDK
bug:** Solidity's `arbitratorAddresses` (`address[]`) plus `getArbitrators(index, limit)`
returning `JobArbitrator[]` was lowered to a single `arbitrators` mapping with the positional
view retained. The view's `index`/`limit` are then interpreted against a one-entry-per-key
mapping, and the only value available to serve as the array witness is that one struct.

**Options, in increasing cost:**

1. **Lower the view as a mapping access** — when the compiled body of a
   `getX(index, limit)` view reads a length from a witness whose collection is a mapping,
   treat the mapping's entries as the array (the SDK already enumerates them and the test
   harness does exactly that in the passing titles). Smallest change, but it must be gated so
   it cannot alter declared-array semantics.
2. **Materialize `arbitratorAddresses` as a real `T[]` collection** at lowering time, with its
   trailing chunks, so the witness is the encoded array. Correct and general, larger.

Given four rounds have now been spent diagnosing around this title without moving the suite,
option 1 should be attempted first and timeboxed; if it does not land quickly, option 2 is the
honest scoping and belongs in its own session with the compiler-lowering tests as the gate.

**Also worth noting for triage:** the three `index out of bounds` titles share this one
mechanism, and `register arbitrator`/`update arbitrator` additionally call
`registerArbitrator` first (whose witness is correctly empty for an absent key), so the
failing call is only ever the view.

### ROUND 18: `getUsers` passes with the same struct witness — so the witness is NOT the discriminator

Attempted the timeboxed option 1 from round 17 and the first measurement refuted the round-17
hypothesis. Comparing the `chunkable-read-witness` output for the two titles, which use the
*same* Solidity pattern (`address[]` + `mapping(address => T)`) and the *same* view shape
(`getX(index, limit)`):

    register arbitrator (FAILS)   getArbitrators   coll=arbitrators  present=true  witness=60 bytes
    register user       (PASSES)  publicKeys       coll=users        present=true  witness=57 bytes

(Both are single structs: `19 <25-byte address> 21 <33-byte pubkey>` = 60 bytes for
`JobArbitrator`; `User` is the same shape with a shorter tail. The `79`/`77` figures in
round 17 were a regex artifact in my extraction — the decoded hex is 60 and 55 bytes, with no
array length prefix in either.)

So a struct-shaped `__internal__valueWitness_0` is **normal**, `getUsers` consumes one without
trouble, and round 17's "the length reads 79 because the witness is one struct" conclusion is
**withdrawn**. The two titles differ somewhere else.

What the two have in common, per the ported source
(`.marketplace/contracts/MarketplaceDataV1.sol:404-421`):

    uint256 arbitratorsLength_ = arbitratorAddresses.length;
    require(index_ < arbitratorsLength_, "index out of bounds");
    ...
    result[i] = arbitrators[arbitratorAddresses[i + index_]];

and the declarations are **identical in shape**: `address[] public userAddresses;` /
`address[] public arbitratorAddresses;` (lines 116/119), while the artifact shows both as
ordinary `stateLayout.variables` of type `address[]` (`userAddresses`, `arbitratorAddresses`)
and neither as a `collections` entry. The mapping sides are also symmetric
(`users`/`arbitrators`, both `kind: 'mapping'`).

So the difference is **data/state dependent, not shape dependent** — e.g. what the
`arbitratorAddresses` array holds and whether `arbitrators[arbitratorAddresses[i]]` resolves
after `registerArbitrator`. The next measurement should therefore be at the *array* access,
not the mapping witness: instrument the compiled `getArbitrators` run (or the SDK's derivation
of the array's stored value) and compare `arbitratorAddresses`'s decoded contents against
`userAddresses`'s in the passing title.

**Triage note, and a recommendation.** Five consecutive rounds (14-18) have each ended by
withdrawing the previous round's hypothesis on this title, and the suite has been flat at
21/66 since round 6. The persistent difficulty is that every probe here observes SDK-side
derivations, while the failing predicate lives inside a compiled covenant whose bytecode
cannot be attributed without a compiler-side mapping. Rather than spend another round on
another single-probe hypothesis, the higher-value move is to fix the **instrumentation gap**
first: make the failing `require` name its source expression (the compiler already emits
`requires[]` with `ip` and `message`, and `probeRequireMessage` resolves messages — extending
that to report the *source expression* for a revert inside a view would end this class of
guessing for every remaining title, not just this one).

### ROUND 19: closed the instrumentation gap (committed) — and it paid for itself immediately

Following round 18's recommendation, the instrumentation gap is closed.
`d6639cd67 feat(solidcash): name the failing probe predicate when a return cannot be derived`:

* `probeRequireStatement` resolves the failing `require` itself, using the source line the
  artifact's `requires[]` table already carries - which is what makes a **bare**
  `require(x < n)` (`message: undefined`) attributable at all - and returns the owning contract
  name so a multi-contract graph names the right body.
* `_deriveReturnBlob` records a one-line description of why the last probe stopped
  (instruction pointer, opcode, VM detail, resolved `require` site, probed input index), and
  both "could not derive" throw sites append it.

It paid off on the first title it was pointed at. `register arbitrator` now reports:

    Could not derive the return value of '__forward' for .emitReturn(). The covenant trace did
    not expose an authenticated return commitment. Probe detail: probe stopped at ip 5
    (opcode 85): Program attempted to read from an invalid transaction UTXO index.
    Transaction UTXO count: 9; requested index: -1.; probed input 3.

**`ip 5, opcode 85` is `OP_OUTPUTTOKENCOMMITMENT` reading output index `-1`** (opcode 85 =
0x55; the SDK's own message says so). So the covenant's `__internal__returnOutputIdx` is
reaching it as **-1**, not as an out-of-range positive index. That is a completely different
defect from the array-length story of rounds 17-18, and it is consistent with
`StatefulContract` computing `returnOffset === 0xffff ? -1` (see the message-bus route
context) - i.e. the callee/route being asked to publish a return it was never given a
coordinate for.

**Next step, now cheap:** trace where `__internal__returnOutputIdx` is set to -1 for this
view and why. Candidates: the return slot is absent from the block layout for `getArbitrators`
(so the layout lookup yields `0xffff`), or the delegate/proxy path forwards -1 because the
route publishes no return. Grep `__internal__returnOutputIdx` assignments in
`StatefulContract.ts` and check the value for this function at the point the unlocker args are
built.

Verified for the commit: `test/e2e/BehaviorParityPins.test.ts` 19/19 (it pins this exact
message by prefix, so the appended detail is safe), `journal-message-bus/e2e` unchanged at 116
failures with zero new, lint error count on the file identical before and after (3408).
Behaviour is unchanged - only diagnostic text, and only when a probe actually failed.

### ROUND 20: the `-1` is because the proxy's `__forward` has no return index in its ABI

Instrumented the exact decision point (`StatefulContract.ts:29346`, immediately before
`materializeInternalFunctionArgument(finalArgs, abiFunction.inputs,
'__internal__returnOutputIdx', BigInt(returnEmitOutputIndex))`). For the failing view probe:

    functionName: '__forward'            abiFunctionName: '__forward'
    selector: '88b357fe'                 emitReturn: true    returnProbeOnly: true
    returnEmitOutputIndex: 7             returnMaterializationOutputIndex: 7
    returnEmitBlockOffset: 7             returnAbiFunctionName: 'getArbitrators' (1 output)
    hasReturnSlot: false                 finalArgValue: 'ABSENT-FROM-ABI'

**`finalArgValue: 'ABSENT-FROM-ABI'`** is the finding: the proxy's `__forward` ABI has **no
`__internal__returnOutputIdx` input at all**, so `materializeInternalFunctionArgument` is a
no-op and nothing is published. The value the covenant then reads is its own default
(`StatefulContract.ts:7280` returns `-1n` for that param name), which is why
`OP_OUTPUTTOKENCOMMITMENT` reads output `-1` and the probe dies at ip 5.

So the SDK does *want* a return here and correctly relocates it to the delegated
implementation's layout (`returnAbiFunctionName: 'getArbitrators'`,
`returnEmitBlockOffset: 7`, via the delegate projection at `:28557`), but it is handing that
coordinate to a forwarder that cannot carry it. `hasReturnSlot: false` confirms the proxy has
no `returnEvent` slot of its own.

Note this contradicts nothing in the code's own comments - `:28556` says exactly the right
thing for a plain send ("A plain send materializes no return event, so only the layout slot
moves there - the witness stays -1 and the covenant skips the check entirely"). The unhandled
case is a **view read through a proxy**: `.emitReturn()` is set, the delegated function does
have an output, and the return event must be materialized by the *implementation* while the
forwarder is told nothing.

**Next step (small and concrete):** for a probe/read of a delegated call, the return event must
be published by the co-spent implementation's body, not the forwarder's. Two candidate fixes,
in order of preference:

1. When the executing `abiFunction` has no `returnEvent` slot but `returnAbiFunction` does,
   route the probe at the implementation input (the SDK already computes
   `delegatecallInputIndex` / `executorOffset` for this) and keep the forwarder's index at -1.
   The proxy path already has all the coordinates; this only changes which input the probe
   evaluates.
2. If the forwarder must still be the probed input, give it a real return coordinate by
   materializing the return event inside the proxy's own block (a larger change: the proxy
   would need the slot reserved, which the layout currently does not publish).

Option 1 matches the existing delegate-return machinery (`delegateReturnEventOffset`, the
`omitLocalFeeTail` branch) and should be attempted first.

**Diagnostic to keep:** the round-19 commit (`d6639cd67`) is what produced this finding - it
turned "could not derive the return value" into `ip 5 (opcode 85) ... requested index: -1`,
which is what pointed at the parameter in one step instead of five rounds.

### ROUND 21: the `-1` reaches the implementation as an ARGUMENT — narrows the fix

Two facts from the code, which change the shape of the fix from round 20's option 1:

* `delegatecallInputIndex` already exists and is threaded into every return derivation
  (`StatefulContract.ts:32353`, `:32446`: `this._deriveReturnBlob(builder,
  returnMaterializationOutputIndex, delegatecallInputIndex ?? 0)`), and
  `returnMaterializationOutputIndex` is set by the delegate projection at `:28557-28562`.
  So the SDK already computes both coordinates for a delegated call.
* The failing program ran at **input 3** (round 19's `probed input 3`), and the proxy's
  `__forward` body reaches the implementation through `OP_INVOKE`, not by co-spending a
  second evaluated input. The implementation's own return check therefore sees the value the
  forwarder **passed it as an invocation argument**.

So the defect is not "the probe evaluates the wrong input" (round 20 option 1) — the probe is
already at the right input. It is that the forwarder **forwards `-1` to the implementation
for the return-output coordinate**: the SDK wants 7 (correctly relocated to the
implementation's layout), but because the proxy's `__forward` ABI has no
`__internal__returnOutputIdx` input (`ABSENT-FROM-ABI`), `materializeInternalFunctionArgument`
is a no-op and the delegated invocation is built with the default `-1`.

**Therefore the fix belongs where the delegated invocation's arguments are assembled**, not in
the probe's input selection and not in the proxy's published layout. Concretely: when a
delegated call is built for a probe/read (`emitReturn` set, `returnAbiFunction` has an output)
and the executing forwarder cannot carry the coordinate, the delegated invocation must still be
given the relocated index. The two places to look are the low-level-call argument assembly
(`:28557`'s block and its callers, which already know `delegateReturnEventOffset`) and
`:29344-29350`'s `materializeInternalFunctionArgument`, which currently cannot see that a
delegated invocation will be built from the same `finalArgs`.

**Why this is the right level.** Option 1 from round 20 (probe the implementation input) is
now ruled out: the implementation is not a separate evaluated input, so there is nothing to
re-point. Option 2 (reserve a return slot in the proxy's own block) remains valid but is a
larger change to the published layout. The narrow fix is to publish the already-computed
relocated coordinate into the forwarder's *invocation* arguments even though the forwarder's
own ABI does not declare it — i.e. thread it by name the way other hidden route values are
threaded, rather than through positional ABI materialization.

**Verification available:** `journal-message-bus/e2e` must stay at 116 failures with zero new,
`test/e2e/BehaviorParityPins.test.ts` 19/19, and the title's own probe detail must change from
`requested index: -1` to a real index (that message is the round-19 diagnostic and is the
fastest feedback loop for exactly this change).

### ROUND 21b: the exact line that forwards `-1`, and why the failing program is the forwarder

The delegated invocation's return coordinate is chosen at **`StatefulContract.ts:28778-28782`**:

    if (inp.name === '__internal__returnOutputIdx') {
      const proxyExternalGroup = nestedDelegateProxyGroupByLowLevel.get(groupLocalIdx);
      return BigInt(proxyExternalGroup === undefined
        ? returnEmitOutputIndex
        : physicalReturnIndexForGroup.get(proxyExternalGroup) ?? -1);
    }

For the failing read this is the `proxyExternalGroup === undefined` arm, and
`returnEmitOutputIndex` is 7 (round 20's measurement), so **the implementation IS handed 7** -
the round-21a hypothesis that `-1` is forwarded as an argument is therefore **not** what the
VM saw at ip 5.

What the VM saw at ip 5 (`OP_OUTPUTTOKENCOMMITMENT`, index -1, opcode 85) is the
**forwarder's own** operation, in its own body, at the top of the program
(`instructionCount` small; round 19 reported `ip 5 (opcode 85)` for input 3). So the shape is:

* the proxy's `__forward` is the executed input (3) and the probed program;
* `__forward` has no `returnEvent` slot of its own (`hasReturnSlot: false`) and no
  `__internal__returnOutputIdx` ABI input (`ABSENT-FROM-ABI`), so
  `materializeInternalFunctionArgument` at `:29346` is a no-op and the covenant reads its
  `-1` default (`:7280`);
* the forwarder's body performs a return-output operation at ip 5 which, with `-1`, reads an
  invalid UTXO index and aborts **before** the delegated call ever runs.

That last point is the actionable one, and it is a different failure from "the implementation
was not told where to emit": **the forwarder itself needs a non-negative return coordinate for
a probe/read, because its own body indexes a return output before delegating.**
`hasReturnSlot: false` says its layout publishes none, which is exactly why the value defaults
to -1 - so the fix must either

1. reserve/publish a `returnEvent` slot in the forwarder's effective layout for the
   probe/read case (so `:18201`'s `slot` lookup succeeds and `returnEmitOutputIndex >= 0`), or
2. make the forwarder's probe body skip its own return-output operation and let the
   implementation's returned value be extracted from the delegated call result
   (`:33266-33271` shows `callee.forward(...).staticCall()` already returns the
   implementation's value for the passthrough arm - the non-passthrough arm at `:33273` is the
   one that fails).

Option 2 is closer to the existing design: the `passthrough` / `callee.forward` arms above
already read through the implementation successfully for other titles, so the bug is that this
title falls past them into the generic `_createBuilder` probe.

**Cheapest next check (one line of logging):** print, at `:33260-33275`, which arm is taken for
`getArbitrators` (`passthrough`, `proxy` public method, `callee.forward`, or the generic
builder) and the value of `passthroughOnly`. If `passthroughOnly` is false only because
`(resultFunction?.emits?.length ?? 0) !== 0` or a `dynamicWrites` entry exists, that predicate
is over-strict for a read and is the real bug.

### ROUND 22: the proxy read arm was discarding the diagnostic — fixed and committed

`f2397e74e fix(solidcash): stop the proxy read path from discarding the probe diagnostic`.

`wrapDispatch`'s read arm (`upgrades.ts:518-524`) caught the derive failure and rethrew
`new Error(declared[0])` - the single declared revert reason. That is right for callers that
assert on the reason, but it threw away the `Probe detail:` added by `d6639cd67`, which is why
`pa.ERROR` kept reading exactly that message in round 20-21 despite the earlier fix. The
declared reason is now the message **prefix** with the detail appended, so
`revertedWith`/`toThrow` keep matching and the cause is visible.

`register arbitrator` now reports:

    index out of bounds Probe detail: probe stopped at ip 5 (opcode 85): Program attempted to
    read from an invalid transaction UTXO index. Transaction UTXO count: 9; requested
    index: -1.; probed input 3.

Verified: `test/e2e/BehaviorParityPins.test.ts` 19/19, `journal-message-bus/e2e` unchanged at
116 failures with zero new.

**Also learned this round (path map, useful for the next attempt):** a proxied view read does
*not* go through `_deriveReturnValue`'s passthrough machinery at all - the
`static-return-passthrough` hook never fires for `getArbitrators`. It goes
`wrapDispatch` -> `target.forward(prop, args)` -> `call.staticCall()`, i.e. the generic
`__forward` probe described in round 21. That is why the `passthroughOnly` predicate cannot be
the bug (round 21's last suggestion is withdrawn), and it confirms the target is the
forwarder's own pre-delegation return-index operation.

**Note a second, adjacent shortcut already in that arm** (`upgrades.ts:495-509`): a
`fooLength()`-shaped zero-argument view over a declared state variable is served from
`target.proxy.getState()` instead of a VM probe, precisely because "the proxy `__forward` view
probe can decode an empty return slot as 0n even when the array is on-chain". `getArbitrators`
is not zero-argument, so it misses that shortcut - but the comment is direct evidence that the
forwarder-view-probe return-slot problem is already known and worked around in this file. The
next fix should generalise that insight rather than re-derive it.

### ROUND 23: the delegate return base IS computed (8) — but the registry is empty at read time

Ran `SOLIDC_DEBUG_RETURN=1` on `register arbitrator` and read the passthrough diagnostic
properly this time (round 21's `{}` was a parsing bug on my side, not a hook that failed to
fire - I had extracted with a regex that did not match the multi-line object). It says:

    static-return-passthrough {
      functionName: '__forward',
      resultFunction: 'getArbitrators',
      delegated: 'getArbitrators',
      passthrough: undefined,
      passthroughOnly: false,
      delegateRegistry: [],
      rootRegistry: []
    }

and, immediately after, a second hook shows the delegate geometry **is** known:

    delegate-return-base {
      functionName: 'getArbitrators',
      entryOutputs: 1, externalOutputStart: 4, externalGroupOutputCount: 0,
      delegateImplOutputCount: 3, delegatedCallerReturnCount: 1, delegatedLoopOutputCount: 0,
      delegatedDynamicWriteChunkCount: 0,
      delegateReturnOutputBase: 8,
      groups: [],
      delegates: [ { i: 0, fn: 'getArbitrators', mode: 'delegatecall', data: 2 } ]
    }

Two things follow, and they narrow the fix to a single decision:

1. **The `passthrough` predicate is genuinely not the bug** (round 21's suggestion stays
   withdrawn). `passthrough` is `undefined` because `resultFunction.externalCalls` is not a
   single external call - `getArbitrators` is a local loop over `arbitrators[...]`, so there
   is no passthrough edge to follow. Correct behaviour for that predicate.
2. **The delegate return coordinate is computed and is 8**, i.e. `entryOutputs 1 +
   externalOutputStart 4 + delegateImplOutputCount 3 = 8`, while round 20 measured the
   forwarder being given `returnEmitOutputIndex = 7`. `delegateReturnOutputBase` and
   `returnEmitOutputIndex` disagreeing by one - combined with `delegateRegistry: []` (the
   registry is empty on this contract, so the delegated call is resolved positionally rather
   than by name) - is the most concrete lead yet.

**Next step (one measurement, then a fix):** log `returnEmitOutputIndex`,
`returnMaterializationOutputIndex`, `delegateReturnEventOffset` and `delegateReturnOutputBase`
**at the point the forwarded invocation's arguments are built** (`:28778-28782`, where the
`__internal__returnOutputIdx` argument is chosen for the delegated call), for this title. If
that site returns 7 while the covenant requires 8, the fix is to source the argument from
`delegateReturnOutputBase` (the relocated value) rather than from `returnEmitOutputIndex` (the
pre-relocation value); if it already returns 8, then the -1 the VM reads is produced later and
the probe should follow the argument into the built unlocking bytecode.

Also worth noting for whoever continues: this file already documents the same limitation twice
- the `fooLength()` shortcut (`upgrades.ts:495-509`) exists because "the proxy `__forward` view
probe can decode an empty return slot as 0n even when the array is on-chain", and `:28556`
states the plain-send rule ("the witness stays -1 and the covenant skips the check entirely").
Both are consistent with the read-probe case simply never having been given a valid coordinate.

### ROUND 24: exact off-by-one confirmed, and the code already names it

Instrumented the forwarded-argument site (`:28778-28782`) and got the full picture in one run:

    functionName: '__forward'        groupFunctionName: 'getArbitrators'
    hasProxyExternalGroup: false     chosen: '7'
    returnEmitOutputIndex: 7         returnMaterializationOutputIndex: 7
    returnEmitBlockOffset: 7         delegateReturnEventOffset: 7
    delegateReturnOutputBase: 8      physicalReturnIndexForGroup: []

So the SDK hands the **delegated** call `7` (`delegateReturnEventOffset`) while its own
independently computed base for the same return band is **8**
(`externalOutputStart 4 + externalGroupOutputCount 0 + delegateImplOutputCount 3
+ delegatedCallerReturnCount 1 = 8`). `chosen` comes from
`physicalReturnIndexForGroup.get(proxyExternalGroup) ?? -1`, which is empty, so it falls to
the `proxyExternalGroup === undefined` arm and returns `returnEmitOutputIndex` = 7.

**The code already documents exactly this failure mode.** At `:27830-27834`, immediately above
the `delegateReturnOutputBase` sum:

    // An associated/embedded delegate is emitted while materializing its external proxy group rather than
    // in the later low-level loop, but it still occupies physical output coordinates before the appended
    // return band. Excluding it made every proxy return witness point one slot early (at the implementation
    // master rather than the first return event).

That is a one-slot-early witness at a proxy return - the same off-by-one seen here, one layer
up. The two quantities that should agree (`delegateReturnEventOffset` and
`delegateReturnOutputBase`) are computed in different places (`:28545-28562` relocates
`returnEmitBlockOffset` to `delegateReturnEventOffset`; `:27836-27843` computes
`delegateReturnOutputBase`), and nothing asserts they match.

**Fix to attempt next, in this order:**

1. Make the forwarded `__internal__returnOutputIdx` use `delegateReturnOutputBase` rather than
   `returnEmitOutputIndex` when the group is a delegatecall and a return band exists. One-line
   change at `:28778-28782`; the comment above the base computation is the justification.
2. If that is wrong in the other direction (the covenant wants the implementation-relative
   offset), add an assertion where both are in scope - fail loudly when
   `delegateReturnEventOffset !== delegateReturnOutputBase` for a group with a return - so the
   next occurrence is a hard error rather than a silent -1 at the VM.

Verify with: the title's probe detail must stop reporting `requested index: -1`, plus
`journal-message-bus/e2e` at 116 failures with zero new and
`test/e2e/BehaviorParityPins.test.ts` 19/19. The round-19/22 diagnostic makes this a fast loop.

### ROUND 25: the delegated-argument fix is INERT — the failing read is the forwarder's own

Attempted round 24's fix #1: at `:28778-28782`, when the group is a `delegatecall` and a return
band exists, return `delegateReturnOutputBase` instead of `returnEmitOutputIndex`. Built and
ran `register arbitrator`:

    → index out of bounds Probe detail: probe stopped at ip 5 (opcode 85): Program attempted to
      read from an invalid transaction UTXO index. ... requested index: -1.; probed input 3.

**Byte-identical failure.** So the value passed to the delegated invocation is not what the VM
reads at ip 5, and round 24's causal chain was wrong. Reverted; tree clean.

The correct reading of the evidence, now consistent with every measurement:

* The failing operation is in the **forwarder's own body at ip 5** - the very top of the
  program, before any `OP_INVOKE` to the implementation. The delegated call has not run yet.
* `ip 5 / opcode 85 / index -1` is therefore the forwarder evaluating **its own**
  `__internal__returnOutputIdx`, which is `-1` because `__forward`'s ABI does not declare it
  (`ABSENT-FROM-ABI`, round 20) and `:7280` defaults that parameter name to `-1n`.
* Round 20's `returnEmitOutputIndex: 7` and round 24's `chosen: 7` describe how the SDK
  parameterises the *delegated call*; they are real but they are downstream of the aborting
  instruction, which is why changing `chosen` changed nothing observable.

**So the fix must give the FORWARDER a usable coordinate, or stop it reading one.** That means
one of:

1. **Publish a `returnEvent` slot in the forwarder's effective layout for the probe/read case.**
   `:18201`'s `slot` lookup would then succeed, `returnEmitOutputIndex >= 0`, and `:19348`'s
   `materializeInternalFunctionArgument` would fill the ABI position - except that
   `__forward`'s ABI has no such position, so this also requires publishing the input. This is
   round 20's option 2 and it is the one the evidence now supports.
2. **Make the forwarder's probe body not perform its own return-output operation** and take the
   value from the delegated result. The `passthrough` arms at `:33266-33271` already do exactly
   that for single-external-call views (`callee.forward(...).staticCall()`); `getArbitrators`
   has no such arm because its body is a local loop, so this needs the probe to accept the
   implementation's return rather than the forwarder's.

Note the dependency this creates for the *test*: both options change what the proxy exposes for
a read, so either needs the full `journal-message-bus/e2e` + parity-pin gate, and the
`fooLength()` shortcut at `upgrades.ts:495-509` is prior art for option 1 (it sidesteps the
forwarder probe entirely rather than repairing it).

**Method note for the next attempt:** rounds 23-25 were three consecutive wrong causal
attributions, each from reading a diagnostic *near* the failure rather than at it. The
diagnostic added in rounds 19/22 reports the failing `ip`, `opcode` and index precisely - the
mistake was reasoning about SDK-side values (`chosen`, `returnEmitOutputIndex`,
`delegateReturnOutputBase`) that are computed for a *different* program than the one that
aborts. Anchor on `ip` first: for this title it is `ip 5`, in the forwarder, before delegation.

### ROUND 26: why the existing delegate-read machinery cannot be reused, and the real fork

Read the read-path resolution in full. Every arm that would avoid the generic forwarder probe is
gated on `passthrough`, which is `undefined` for this title:

* `_deriveReturnValue` resolves `registered` at `:33216` from
  `delegatedCall.contract._externalRegistry.get(passthrough.interfaceName) ?? ... ?? byName`, and
  `resolvedArgs` at `:33222` from `passthrough.argSources`. Both dereference `passthrough`.
* The whole block is entered at `:33240` (`if (registered && resolvedArgs)`), so with
  `passthrough === undefined` none of `callee.forward(...).staticCall()` (`:33266`), the proxy
  public-method arm (`:33260`) or `callable(...)` (`:33271`) can run.
* `passthrough` is `undefined` because `resultFunction.externalCalls` is not a single external
  call - `getArbitrators` is a local loop over `arbitrators[...]` (round 23). That is correct
  behaviour for the predicate, so this is not a predicate bug.

Hence the read falls through to the generic `_createBuilder(..., { emitReturn: true,
returnProbeOnly: true })` probe at `:33273`, i.e. the proxy's `__forward` body, which aborts at
ip 5 because `__forward` has no `returnEvent` slot and no `__internal__returnOutputIdx` ABI
input.

**This is the fork, and it is architectural rather than parametric:**

* **A. Repair the forwarder probe.** Publish a `returnEvent` slot *and* the matching ABI input
  for `__forward` in the probe/read case (`:19348`'s `materializeInternalFunctionArgument` can
  then fill it). This is the only option that fixes reads for *every* local-loop view on a
  proxy at once - `getArbitrators`, `getUsers`, and whatever else the remaining titles call.
  It changes the proxy's published layout and ABI, so it needs the compiler/lowering side to
  agree that the forwarder owns a return channel, and it needs the full parity gate.
* **B. Extend the state-read shortcut.** `upgrades.ts:495-509` already serves a zero-argument
  `fooLength()` view from `target.proxy.getState()` with the comment that "the proxy `__forward`
  view probe can decode an empty return slot as 0n even when the array is on-chain". Extending
  that to an indexed slice view (`getX(index, limit)` over `address[]` + `mapping(address => T)`)
  would work, but it means reimplementing the view's slice/filter/struct-projection semantics in
  the SDK. The existing precedent is a two-line length read; this would be materially more, and
  it belongs in `proxy-pagination.ts` if attempted, not inline.

**Recommendation.** Option A is the correct fix and is bounded by the same gate discipline as
the earlier commits, but it is a compiler+SDK change and should be started with a fresh context
budget rather than at the end of a long session. Option B is a legitimate stopgap for this
specific view shape if the goal is to move the ladder, but it must be written as general
pagination semantics with its own regression, not as a name-matched special case - the same
discipline the repo already applies elsewhere.

**Status of the arc.** Rounds 19-26 produced two committed, verified improvements
(`d6639cd67` probe attribution, `f2397e74e` stop discarding it) and one confirmed root cause
with a precise ip-level mechanism. No title moved: the ladder is 21/66. The three
`index out of bounds` titles and the `getArbitrators`/`getUsers` family all wait on option A
or B; the 38-title input-214 batch-witness class is independent and still open.

### ROUND 27: `post job with invalid mece tags` is a genesis-state read, not a routing bug

Took the remaining independent failure with the clearest signature. The title's error is
`Expected transaction NOT to be reverted, but it reverted` on the **last, expected-success**
call:

    publishJobPost(title, contentHash, false, ["DV", "test"], fakeToken, 100e18, 120, "digital", 0, [user2])

The two `revertedWith` assertions before it pass. The contract's own check
(`MarketplaceV1.sol:247-259`) is:

    for (uint8 i = 0; i < tags_.length; i++)
      if (bytes(marketplaceData.meceTags(tags_[i])).length != 0) { meceCount++; if (meceCount > 1) revert("Only one MECE tag is allowed"); }
    require(meceCount == 1, "Exactly one MECE tag is required");

so for `["DV","test"]` to succeed exactly one of those two strings must be present in the
`meceTags` mapping. It is reverting, which means **the covenant reads `meceTags` as empty** -
and that also explains the passing-elsewhere assertion: `revertedWith("Only one MECE tag is
allowed")` passes because the call does revert, just with the *other* message
(`Exactly one MECE tag is required`), which the assertion does not distinguish.

Where the mapping comes from: `MarketplaceDataV1.sol:149-155` populates it **in
`initialize()`** (`meceTags["DA"] = "DIGITAL_AUDIO"`, `["DV"] = "DIGITAL_VIDEO"`, …), i.e. at
genesis. The artifact confirms this is a **sorted, chunkable** mapping written through an
8-slot batched upsert:

    meceTags collection: { kind: 'mapping', keyType: 'string', valueType: 'string',
                           sorted: true, chunkableValue: true }
    initialize entryAccesses: meceTags slots 0..7, all operations: ['write']
    initialize inputs: __internal__vmapBatchSlot_0..7, __internal__vmapBatchRows_meceTags,
                       __internal__valueWitness_0..7, __internal__leadingPushValue_0..7

So this is the **same 8-slot sorted batch family** as the input-214 class, but exercised at
genesis rather than on a route, and observable through a much simpler predicate
(`meceTags(tag).length != 0`).

**Highest-value next probe (cheap, and it discriminates two very different causes):** after
`deployContractsFixture`, read the `meceTags` entries back from the proxy -
`marketplaceData.meceTags("DV")` should return `"DIGITAL_VIDEO"`. If it returns empty, the
genesis batch wrote nothing (or wrote it at unreachable coordinates) and the whole
`getArbitrators`/`publishJobPost` family shares this cause. If it returns the value, then the
read inside the covenant is failing while the SDK's own read succeeds, which points at a
string key-encoding mismatch between the SDK's `keyToSlot` for `string` keys and the covenant's
key derivation - also a general bug, and one that would affect every string-keyed sorted
mapping.

**Note on scope:** unlike rounds 19-26, this defect is not behind the proxy-forwarder view-probe
problem (option A/B in round 26). It is a state-materialization or key-derivation question,
reachable with `meceTags(...)` directly on the proxy handle - no delegated read, no return band.
That makes it the most promising independently-fixable target currently open.


**Caveat on the readback probe:** a standalone fixture test was attempted and did not run - the
marketplace fixtures are local to `marketplace.test.ts`'s describe scope, so importing that file
does not expose `deployContractsFixture`. The probe and its vitest config were removed; tree is
clean. Exercise the readback instead with a temporary assertion *inside* the existing title,
immediately before the final `publishJobPost`:

    console.log('DBG-MECE', await (marketplaceData as any).meceTags('DV'));

Non-invasive, but it edits the Marketplace suite, which this repo's handoff requires be
reverted after measuring.

**One ambiguity to resolve with that same log:** the second assertion
`.revertedWith("Only one MECE tag is allowed")` passes, and that message requires
`meceCount > 1` - at least two tags *present*. A wholly empty map would revert that call with
"Exactly one MECE tag is required" instead. So the mapping is probably NOT empty, and the
failing `["DV","test"]` call is more likely hitting `meceCount == 0` or a neighbouring guard.
Read `meceTags("DV")` and `meceTags("test")`: if `DV` returns `"DIGITAL_VIDEO"` while `test`
returns `""`, genesis state is healthy and the defect is in how `checkJobPostData` iterates a
runtime-sized `string[]` argument - a different and narrower bug than the one hypothesised
above, and worth knowing before touching genesis materialization.

### ROUND 28: the mece-tags hypothesis is REFUTED — it is the same preflight class

Ran the readback probe from round 27 inside the title. Result:

    DBG-MECE {"dv":"DIGITAL_VIDEO","test":"","da":"DIGITAL_AUDIO"}

**Genesis is healthy.** `meceTags("DV")` returns `"DIGITAL_VIDEO"` and `meceTags("DA")` returns
`"DIGITAL_AUDIO"`; `"test"` is correctly absent. So the mapping is populated, `keyToSlot` for
string keys agrees with the covenant's derivation on this collection, and the sorted 8-slot
genesis batch works. Every hypothesis in round 27 is refuted.

Then captured the actual revert reason for the failing call:

    Revert reason: "messageBus: BCH-2026 preflight failed at input 127: Program failed an OP_VERIFY operation."

**This title belongs to the 38-title preflight class, not to an independent defect.** Input 127
is a MarketplaceV1 route input, the same `BCH-2026 preflight failed at input N: Program failed an
OP_VERIFY operation` family as the 214/216/127 groups in the ladder. It is not a tag-reading or
argument-iteration bug at all: the `revertedWith` assertions earlier in the title pass because
those calls are *supposed* to revert, and this one is supposed to succeed but dies in preflight.

**Correction to the ladder accounting used in rounds 16-27.** The genuinely independent
non-preflight failures are **3** (`index out of bounds` x3), plus 1 state-derivation convergence
on `post job with invalid amount`. The "1 revert assertion" I repeatedly listed as independent
was this title, and it is not independent. So the open work is:

* 38 titles - input-214 batch-witness class (rounds 10-15; four defects isolated in the 4-slot
  table, no fix landed);
* 5 titles - input-216 (FakeToken route);
* 2 titles - input-127 (this title among them);
* 3 titles - `index out of bounds` (blocked on the proxy-forwarder view probe, round 26
  options A/B);
* 1 title - state-derivation convergence.

**Method note, third instance this arc:** rounds 23-25 misattributed because I read a diagnostic
near rather than at the failure; round 27 misclassified because I inferred the cause from the
contract's source and a passing assertion instead of reading the revert. In both cases the
one-line measurement (here: the `Revert reason:` line, which the harness already prints) was
available and would have prevented the detour. Read the revert reason first.

The test-file probe has been reverted; `.marketplace/` is generated and not tracked, and
`grep DBG-MECE` confirms it is gone.

### ROUND 29: input 127 — a 36-byte P2SH32 contract-identity mismatch at offset 6

Ran the round-28 method (read the failure first, then the equality operands). `input 127` is
`MarketplaceV1`, reached through `SolidCashProxy` (input 129) with `DataNft_ee643a16` entries
alongside. The route aborts at instruction pointer **6** of an 8-instruction program
(`instructionCount: 8`), and the ring capture shows exactly one mismatched large equality in the
whole run:

    ip 6:
      left  = 23aa20ac44e8d664563800c6aae011c226b3327543616d4ec57251b85a2fbea6f9786287
      right = 23aa2005e29c954b39460500103ebba17925a8b14d73727dc34e4b61428de3784cbc2b87

Both are **36 bytes**, and both begin `23 aa20` - `0x23` is the pushdata length 35, so each
operand is `PUSH35 aa20 <32-byte hash> 87`, i.e. a **P2SH32 locking bytecode**. Every other large
equality in the run compares equal; this one does not.

So the route is comparing two *contract addresses* and they differ in their 32-byte script hash.
Neither hash appears literally in any artifact (confirmed by scanning all 105 JSONs), which is
expected: these locks are assembled at runtime from a token category plus a slot/hash payload,
so the mismatch is a **parameterisation** difference, not a stale constant.

**Why this shape is informative:** the check sits at offset 6 of an 8-instruction program, i.e.
in a *prologue*, before any effect handling - consistent with a participant/route identity
assertion (`OP_INPUTBYTECODE`/`OP_UTXOBYTECODE`-parameterised lock equal to a computed one)
rather than an effect or return check. It is therefore a different mechanism from both the
input-214 batch-witness defects (rounds 10-15) and the input-216 FakeToken event frame.

**Next step (one measurement):** dump the 8-instruction program at input 127 with its opcodes and
pushdata (the failure dump already carries `ipWindow` when `SOLIDC_DEBUG_FAILURE_POINT_FULL=1`),
and identify which local/slot the right-hand lock is derived from. Then compare that against the
block layout the SDK used for input 127's participant. Because both operands are well-formed
P2SH32 locks of the same structural shape, the difference is almost certainly *which* slot/category
each side used - so the decisive question is "which two slots do these two locks correspond to",
answerable by recomputing candidate locks from the participant's category and slot list.

Note the participant geometry already known for this title (`MarketplaceV1` at input 127, proxy
at 129, two `DataNft_ee643a16` at 130-131) - the mismatching pair may be the route's own block
lock versus a *proxy/implementation* lock, which would make this a delegate-identity
parameterisation bug rather than an entry/slot bug.

### ROUND 30: input 127's prologue decoded — a bytecode-identity check with a computed operand

Dumped the prologue (the failing program is 1721 instructions; the abort is in the first six):

    ip 0  op 121   OP_DUP
    ip 1  op 124   OP_SWAP      (124 = 0x7c)
    ip 2  op 127   OP_NIP       (127 = 0x7f)
    ip 3  op 124   OP_SWAP
    ip 4  op 123   OP_ROLL      (123 = 0x7b)
    ip 5  op 136   OP_EQUALVERIFY   <- this one PASSED (every large-equals row at ip 5 compares equal)
    ip 6  (failing)

and the mismatching equality is the one at ip 6:

    left  = 23aa20ac44e8d664563800c6aae011c226b3327543616d4ec57251b85a2fbea6f9786287
    right = 23aa2005e29c954b39460500103ebba17925a8b14d73727dc34e4b61428de3784cbc2b87

Decoding the prologue: an `OP_OUTPUTBYTECODE` result is being rolled into place and compared
against a precomputed P2SH32 lock, with a second equality immediately after. The passing ip-5
equality and the failing ip-6 equality are therefore **two identity checks in sequence**, and the
second one is the one whose right-hand operand disagrees with the transaction.

**The actionable shape of this:** the left operand is a *computed* lock (it is produced by the
prologue itself from introspection) and the right operand is a 35-byte `aa20<32>87` P2SH32
address. A bytecode-identity check failing at this position means the SDK built the participant's
output lock from **different parameters** than the covenant computed - the same class as the
input-214 family's identity disagreements, but arrived at through an output-lock comparison
rather than a batch witness.

**Cheapest decisive measurement:** log, while building input 127's participant block, the
`(slot or nftIndex, categoryId, computed lockingBytecode)` triples the SDK emits for its
output-only slots, and compare each against `aa20ac44e8d6…` and `aa2005e29c95…`. Whichever triple
reproduces the **right** operand is the slot the SDK chose; whichever reproduces the **left** is
what the covenant expected. The difference between those two slot descriptors is the bug, and it
is a one-line report rather than a new investigation.

**Why not infer it from the artifacts:** neither hash appears literally in any of the 105
artifact JSONs (round 29), because these locks are assembled at runtime from a category plus a
slot/hash payload. The mapping has to come from the SDK's own construction, not from a constant
search.

### ROUND 31: input 127 compares the participant's own master lock against an unrelated slot

Traced both operands of the ip-6 equality through the built transaction by scanning every input
and output lock for the two 32-byte hashes (probe reverted). Result, filtered to distinct
`(label, index, hit)`:

    in  idx=  0   LEFT   cat=ee643a16  cap=minting  commitLen=0    <- participant master
    in  idx= 18   RIGHT  cat=ee643a16  cap=none     commitLen=75   <- a state NFT
    out idx=  0   LEFT   cat=ee643a16  cap=minting  commitLen=0
    out idx= 18   RIGHT  cat=ee643a16  cap=none     commitLen=75
    out idx= 10   RIGHT  cat=ee643a16  cap=none     commitLen=75   (from in 9)
    in/out 217    LEFT,  in/out 303 RIGHT        (a second participant block)
    in/out 129    LEFT,  in/out 215 RIGHT        (a third)

All operands share category `ee643a16` (MarketplaceDataV1), so this is one contract family.

**The reading:** the covenant's *left* operand is a **minting** NFT with an empty commitment -
a participant **master** - and it sits at index 0 of its own block, i.e. literally
`INPUTINDEX`. The *right* operand is a **mutable/none state NFT carrying a 75-byte commitment**
at **index 18**. For input 127 the compared pair is therefore *this participant's master lock*
against *a state NFT 18 slots away* - and 18 is far outside the master+block region, so the
comparison is between two unrelated coordinates.

**This is the same "wrong coordinate" family already documented twice in this file**, and the
codebase already warns about exactly this shape:

* `:28556` - "A plain send materializes no return event, so only the layout slot moves there -
  the witness stays -1"; and
* `MARKETPLACE_ENTRY_CARDINALITY_FINDINGS.md` / `_deriveFullTransactionState` - correcting
  `implInputIndex + (physicalEntrySlot ?? blockSize)` to the layout's own entry-slot offset,
  because `blockSize` is the coordinate just PAST the block.

**Next step (one comparison, then a fix):** the participant's state/slot layout maps
`master -> offset 0`, so identify which slot the covenant *intends* on the right-hand side and
what index that slot resolves to for this participant. `input 127`'s block should place it near
index 1-9, not 18. Log the slot list for input 127's participant (`blockLayout.slots` with
`kind`/`offset`/`slotIndex`) together with the layout-derived absolute index of each, and the
18-vs-expected delta names the bug. Given the two prior instances of this exact class were both
"used a base instead of a published offset", start by checking whether the right-hand index was
computed from a `blockSize`-like value rather than from the slot's own offset.

### ROUND 32: input 127 is an ECRECOVER SIDECAR lock mismatch, and the expected hash is IN the commitment

Resolved the `18` delta against the participant's published layout. `MarketplaceV1`'s route block
is **127 slots**, and offset 18 is:

    {"kind":"ecrecoverSideCar","offset":18,"slotIndex":14,"conditional":true}

with `master` at offset 0, `dataNft` at 1-2, `keccakSideCar` at 3, and `ecrecoverSideCar` at
4..19. So the right-hand operand of the failing equality is the **ecrecover sidecar slot at block
offset 18** - not an entry and not an unrelated participant, as the previous two rounds guessed.

Then the decisive detail. The left operand's hash appears **inside the idx-18 commitment**:

    left  lock = 23aa20 ac44e8d664563800c6aae011c226b3327543616d4ec57251b85a2fbea6f9786287 87
    right lock = 23aa20 05e29c954b39460500103ebba17925a8b14d73727dc34e4b61428de3784cbc2b87 87
    idx-18 commitment begins: 0023aa20ac44e8d664563800c6aae011c226b3327543616d4ec57251b85a2fbea6f9786287...
    -> embeds the LEFT hash  (verified)

So the covenant compares `aa20<ac44e8d6>87` against `aa20<05e29c95>87`, and `ac44e8d6` is the
P2SH32 that the ecrecover sidecar's own commitment references. The SDK materialised the
offset-18 sidecar with **a lock that is not the sidecar lock its commitment points at** -
commitment and locking bytecode disagree at the same output.

**What this means and what to do next:**

* This is the third distinct mechanism found in this group, and it is much narrower than
  "wrong coordinate": it is an **output whose token commitment and locking bytecode were
  produced from different parameters**. That is a single-output inconsistency, not a layout
  offset error.
* The immediate check: recompute the ecrecover sidecar locking bytecode for this participant's
  category (`ecrecoverSideCar`, `slotIndex 14`) and see which of the two hashes it equals. Whichever
  it is tells you which side is wrong - the commitment's expected lock or the output's actual
  lock.
* Because the sidecar is `conditional: true`, also check whether the SDK is materialising the
  sidecar for a **different** slot index than the one whose commitment it wrote - i.e. writing
  slot 14's commitment onto a lock computed for another ecrecover slot. The block publishes 16
  ecrecover slots (offsets 4..19), 12 of them conditional, so a slot-index mix-up within that
  family is plausible and would produce exactly this "commitment and lock disagree" shape.
* `ecrecoverSideCar` appears 20 times in `MarketplaceV1.json`, so this is a first-class layout
  feature with existing handling - search the SDK for how it builds these outputs before
  changing anything.

**Method note:** this round finally landed because the prologue (round 30) was decoded to an
operand *pair*, and the pair was then traced to concrete transaction indices (round 31), which
made the layout lookup meaningful. The previous two attempts reasoned from the artifact search
alone and from a `blockSize`-style hypothesis; both were guesses about *which* coordinate was
wrong. Deriving the actual index first was what made the slot identifiable.

### ROUND 33: the sidecar salt scheme is a third form — computed locks match neither operand

Read the sidecar construction. `ecrecoverComputeLockingBytecode(salt, 'A'|'B')`
(`packages/utils/src/ecrecover-compute-library.ts:40`) is `aa20 <hash256(redeem(salt, role))> 87`,
and the file documents **two** salts:

* `salt = hexToBin(this.categoryId).reverse()` - the *branded* form, used for direct calls
  (`StatefulContract.ts:12366`: "A branded sidecar checks the category at absolute input 0, which
  is only the owning master for a direct call");
* `new Uint8Array(32)` - the *shared* form, used when `selectedCalls || options.graphExecution`,
  with the note that "Loop side-cars are always shared-salt ... the argBlob bind + A->B hash chain
  secures the result", exposed as `ECRECOVER_COMPUTE_A_SHARED_LOCK` / `_B_`.

Computed all four candidate locks for category `ee643a16…` and compared their hashes against the
two operands:

    shared(zeros)          A  e932c48ff89e3522e9b9f02f...    no match
    shared(zeros)          B  d3572e7459708a7176fae150...    no match
    branded(reversed cat)  A  08b82d62a1982500ba050e66...    no match
    branded(reversed cat)  B  d5b82966aa685c867e95cfdb...    no match

    LEFT  (covenant expected)  ac44e8d664563800c6aae011c226b3327543616d4ec57251b85a2fbea6f9786287
    RIGHT (SDK materialised)   05e29c954b39460500103ebba17925a8b14d73727dc34e4b61428de3784cbc2b87

**So neither operand is the branded or shared A/B lock for this category.** The mismatch is
therefore not "the SDK picked the wrong one of the two documented salts" - it is a *third*
derivation, or the operands are not sidecar locks at all despite offset 18 being an
`ecrecoverSideCar` slot.

**Two candidate explanations, in order of cheapness to test:**

1. **The category is not the one I assumed.** I used `ee643a16…` because the idx-18 output carries
   it, but the *covenant's* expected lock may be branded to a different category - e.g. the
   master's category at absolute input 0, which for input 127 may be a different participant's
   master than the one whose category the SDK used. Recompute the four locks for each category
   present in the transaction (`ee643a16…`, `3770ad41…`, `424cc33a…`, `a3cef944…`) and for the
   `SolidCashProxy` category; if one reproduces `ac44e8d6…`, the defect is a category mix-up.
2. **The operands are not sidecar locks.** Offset 18 is an ecrecover slot *in this layout*, but
   the compared index is derived by the covenant and need not equal the block offset. Re-derive
   the compared index from the prologue's introspection sequence rather than assuming it is 18.

Explanation 1 should be run first; it also retroactively tests the round-31/32 assumption that the
right operand is "the idx-18 output's lock" rather than merely a lock *equal* to it.

**Already run, and it failed:** all four locks were computed for the four categories present in the
transaction (`ee643a16…`, `3770ad41…`, `424cc33a…`, `a3cef944…`), both salts, both roles - **zero
matches**. So explanation 1 is eliminated as stated, and neither operand is an ecrecover sidecar
lock under either documented salt for any category in this transaction. Explanation 2 (the compared
index is not block offset 18) is therefore the live one.

**Caution for the next probe:** the `SOLIDC_DEBUG_FAILURE_POINT_FULL` output truncates
`lockingBytecode` to 16 hex characters and `commitmentHead` to 20, so it cannot be scanned for a
32-byte hash. The round-31 index mapping (0 and 18) came from a *different* probe that emitted full
locks (`SOLIDC_DEBUG_LOCK_NEEDLE`), and that probe has been reverted. Any further index mapping
must emit full lock hex, not the truncated dump form.

**Method note.** This round closed off a plausible mechanism (branded-vs-shared salt) with a
direct computation rather than another inference. Worth keeping: computing the candidate values
and diffing them is cheap, and it has now either confirmed or eliminated three hypotheses in two
rounds.

### ROUND 34: the input-127 comparison is an external-call transcript row, and the SDK duplicated the loop's element

Rounds 29-33 chased a "P2SH32 lock mismatch at offset 6/18". That reading was wrong at the
first step: the failing frame is a **6-instruction program** whose last instruction is an
`OP_EQUALVERIFY`, and the two operands are **47/49-byte transcript records**, not bare locks.
`evaluated.ip` is one past the last instruction, which is why the dump showed `ip: 6` with
`opcode: None` and an `ipWindow` of only six entries.

Decoding the operands as pushdata (the round-31/32 "locks" were 2-byte-length-prefixed
frames, and the `23 aa20 … 87` I read as one lock is really `<u16 35> <P2SH32>` followed by a
selector and an argument):

    record = <u16 subjectLen> subject  <u8 mode> <4-byte selector> <u16 argsLen> args  <u16 resultLen> result

`compose.ts:1393` builds exactly that (`concat(framed(targetLbc), mode, selector, framed(args),
framed(result))`), so the compared value is an **invocation-transcript row** and the selector
`2d232774` is the ABI selector of `meceTags` (confirmed in `MarketplaceDataV1.json`).

`SOLIDC_DEBUG_FAILURE_POINT=1` at input 127 gave the real defect directly. The same 6-instruction
program runs once per tag, and the failing pair differs **only in the tag bytes**:

    occurrence 0: left == right == "...02 4456"                 ("DV" vs "DV")   equal
    occurrence 1: left  = "...02 4456 40 00"                    ("DV" + 2 bytes)
                  right = "...04 74657374"                      ("test")         MISMATCH

`post job with invalid mece tags` calls `publishJobPost(tags = ["DV","test"])`; the Solidity loop
`for (i…) if (bytes(marketplaceData.meceTags(tags_[i])).length != 0)` therefore evaluates
`meceTags("DV")` and `meceTags("test")`. The covenant evaluated the right element, the SDK's row
carried the **first** element for every occurrence.

Confirmed at the SDK level with `SOLIDC_DEBUG_ATOMIC_PROMOTION=1`: the discovered node list has
two `meceTags` rows at callsite 1 and **both print `args: ['DV']`**. Root cause chain:

1. `SymbolTableTraversal.classifyArg` published a loop-local array index as `indexValue: 0`, the
   same shape as "element zero, fixed" (its own comment said "the SDK expands these call sites in
   array order; index zero identifies the first group").
2. `StatefulContract._resolveExternalArgs`'s `arrayElement` case then used `indexValue ?? 0` and
   ignored the `occurrenceIndex` it was already given — so every occurrence read element 0. The
   **return-value** path did expand by occurrence (which is why row 1's *result* was already the
   empty string for `meceTags("test")` while its *argument* was still `"DV"`).

**Landed** (three commits, audit clean, no application names):

* `1476de821` feat(solidc): publish the array index a loop occurrence selects — a loop induction
  variable index publishes `indexValue` (value at occurrence zero) plus `indexStepValue`; a
  literal index publishes an explicit `indexStepValue: 0`; an index the compiler cannot describe
  keeps the unstepped form.
* `823aafd78` fix(solidcash): advance a loop callsite's array index per reached occurrence — apply
  the published delta in `_resolveExternalArgs`, and bind the reached occurrence at the two callers
  that bake an occurrence into the sources themselves (`resolveLoopReturnValue`,
  `rewriteOccurrenceIndex`) before resolving with occurrence zero.
* `8e4077f86` test: cover the per-occurrence array index of a loop callsite.

Fixture regeneration (required: the compiler's emitted JS changed) reproduced **only**
`indexStepValue: 1` additions plus `updatedAt` in 11 artifacts — no bytecode change — and
`yarn workspace testing-suite compile` reported all three example artifacts `Unchanged`.
Pass-set check: 20/21 previously-passing titles still pass (the one "failure" is the pre-existing
`register user > update user` index-out-of-bounds title matching the same `-t` filter).

**Effect on this title: the input-127 preflight failure is GONE.** The third assertion now fails
one layer earlier, at *planning*:

    messageBus [L3_RESOURCE_UNRESOLVED]: message-bus batch collection witness
    '__message_bus_key_meceTags_0' must identify one physical entry

### ROUND 35: the next blocker is a kernel-route capability gap — a per-row collection key

This is a real architectural gap, not a residual of the round-34 fix, and it is now the
input-127 class's actual blocker.

* The `meceTags` handler in `MarketplaceDataV1.json` declares one **global** key witness
  (`batchKeyWitnesses: [{ routeInput: '__message_bus_key_meceTags_0', inputIndex: 0,
  source: 'argument' }]`), and the route declares exactly one input of that name.
* `encodeMessageBatch` (and `_buildRepeatedExternalBatch`) therefore require every row of the
  batch to carry the **same** key value. Two rows reading two different mapping entries cannot be
  expressed: the route has one value to authenticate one entry.
* The compiler *has* a per-row form — binding `perRow: true` makes the route declare
  `<name>_r<row>` parameters and the handler use `<name>_r${rowIndex}` — but it is only set by
  `crossHandlerPerRowWitnesses` (two *handlers* binding the same witness from different
  argument positions), never for one handler reached twice with different keys. It is also
  currently **unreachable in the kernel convention**: `compiler.ts:8878` expands the per-row
  parameters only `if (perRow && !kernelLoopDispatch)`.
* So under `kernel-row-loop`, a generated public getter over a mapping can be batched only if
  every row passes the same key — which is never true for the loop that motivated the call.

**What the fix has to decide (not yet done):** in the kernel loop, an argument-sourced entry key
should be resolved from the **row's decoded argument** rather than from a single route witness.
`entryKeyArguments(fn)` already names the handler's entry-key arguments and the kernel body
already decodes each row's arguments (`decode`/`declarations`); the `keyChecks`
(`require(<entryKey> == <witness>)`) and the SDK's one-value-per-global-witness requirement are
what force the single value. The open question that must be answered before writing it: whether the
participant block layout can co-spend **two entries of one collection** (two distinct
`meceTags` keys) at the key-derived input indices the covenant computes. That is the same
subsystem as the input-214 batch-witness defects (`Slot_3` never materialising, `Next_0 = 0…0`),
so those should be understood together rather than separately.

### ROUND 36: input 214 resolves to an exact source line — a chunkable value never reaches its frame slot

Ran `should whitelist worker` (the cheapest input-214 title) with
`SOLIDC_DEBUG_FAILURE_POINT=1 SOLIDC_DEBUG_FAILURE_RING=1 SOLIDC_DEBUG_ROUTE_INPUT_INDEX=214`.

**New technique — route ips map to source lines.** The failing program is input 214's
`MarketplaceDataV1` route (`__message_bus1`, 18313 instructions, `unlockerContract:
MarketplaceDataV1`, category `3770ad41…`). `MarketplaceDataV1.json` publishes
`debug.functionDebug['53434231'].requires` with **1641** entries whose `ip` values run to 15317 —
i.e. the route program's own coordinate space. Looking up `ip 7855` gives:

    {"ip":7855,"line":393}                       (and every ip 7836…7880 → line 393)

and `MarketplaceDataV1.sol:393` is

    function arbitratorRegistered(address address_) public view returns (bool) {
        return arbitrators[address_].publicKey.length > 0;      // <- line 393
    }

`JobArbitrator.publicKey` is `bytes` (unbounded, so a chunkable value: the entry stores
`len || sha256(value)` and the value lives in chunk UTXOs). This is the **first time this class has
been tied to a named source statement**; earlier rounds only had witness tables and output
coordinates.

**The failing instruction, decoded.** `message-bus-large-equals` reports the one unequal
EQUALVERIFY in the whole run:

    ip 7855 (of 18313):  left = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                         right = c2a8d2ff56802508ee018495941516441069e7ddcd8d1f9c96c3219591547617

`left` is exactly `sha256("")`. The ip window is

    7845 OP_16   7846 OP_INVOKE (function table 16)   7847 OP_DEPTH   7848 OP_11
    7849 OP_MUL  7850 OP_PICK   7851 OP_DUP  7852 OP_SHA256  7853 OP_2  7854 OP_PICK
    7855 OP_EQUALVERIFY   <- fails

which is `require(sha256(V) == A)` where `V` is read out of the **current row frame** at
`stackDepth * 11` (`OP_DEPTH OP_11 OP_MUL OP_PICK`: each row frame is 11 slots) and `A` is the
expected value digest. `V` is empty. So the covenant looked in the frame slot that should hold
`arbitrators[address_].publicKey`'s value and found nothing, while the expected digest
(`c2a8d2ff…`) was computed correctly.

**The SDK did stage a value.** `SOLIDC_DEBUG_VALUE_CHUNKS=1 SOLIDC_DEBUG_VALUE_WITNESS=1` shows,
for resource `ee643a16…:3b2d866b…:e3b0c442…`:

    value-chunk-producer-stage        valueBytes 205   -> stage-result stagedOwned: true
    value-chunk-producer-stage        valueBytes 233   -> stage-result stagedOwned: true
    value-chunk-producer-select       producerSelectionStatus "owned:233" writeCount 1 claimCount 2 minChunks 2
    value-chunk-producer-select       producerSelectionStatus "owned:233" writeCount 1 claimCount 2 minChunks 6
    value-chunk-producer-bind (x4)    functionName __message_bus1, rowCount 5, rows
                                      [9bd3de95, 2d232774, 177472f2, a826ee9c, a826ee9c]

Note `9bd3de95` **is** `arbitratorRegistered`'s selector (row 0 of the five-row batch), and the
staged owned value is 233 bytes. So the value exists on the SDK side and does not reach the frame
slot the covenant reads. This is the **value-witness / frame-relocation family** that rounds 6-9
and the `transportedValueChunks` work already touched — not the entry-slot index space that
rounds 10-15 chased.

**Next step (one measurement):** dump, for the failing row, the `(rowIndex, frameSlot, value)`
pairs the SDK writes into the route frame (the `__internal__valueWitness_*` /
`__internal__leadingPushValue_*` family) next to the slot the covenant reads at ip 7850
(`depth * 11 - <frame base>`). The row-0 selector is `9bd3de95` and the frame stride is 11, so the
comparison is a small table, not a new investigation. `SOLIDC_DEBUG_VALUE_WITNESS=1` already prints
the witness side; what is missing is the *frame slot ordinal* each staged value lands in.

**Method note.** Two things made this round cheap and would have made earlier input-214 rounds
cheap: (1) `debug.functionDebug['53434231'].requires` maps a route `ip` straight to a source line,
and `probeRequireStatement` in the SDK already implements that lookup; (2) reading the two
EQUALVERIFY operands *as the decoded instruction sequence around them* (`OP_PICK OP_DUP OP_SHA256
OP_2 OP_PICK OP_EQUALVERIFY` = "verify a value against its digest") says what the check means,
where reading the operands alone only said "two 32-byte values differ".

### ROUND 37: the input-214 class is FIXED — value witnesses were keyed by position, not by slot ordinal

Round 36 left one measurement: "dump the `(rowIndex, frameSlot, value)` pairs the SDK writes next to the
slot the covenant reads". That measurement found a defect one layer up from the value itself.

**What the route actually received.** Re-ran `should whitelist worker` with the failure-point diagnostic
widened (now committed) to print the `__internal__valueWitness_*` / `__internal__leadingPushValue_*`
route parameters. The route passed:

    valueWitness_0  0B      leadingPushValue_0    0B
    valueWitness_1  106B    leadingPushValue_1  205B
    valueWitness_2  106B    leadingPushValue_2    0B
    valueWitness_3  114B    leadingPushValue_3    0B      <- the arbitrators struct
    valueWitness_4..8  0B

`arbitratorRegistered` is bound to physical entry slot **4** (`physicalEntrySlots: [4]`), and the route's
`__internal__valueWitness_4` was **empty**, while the 114-byte `arbitrators` value sat on slot 3. The
covenant hashed the empty value it found and failed `require(sha256(value) == <entry digest>)` - the
round-36 equality at ip 7855.

**Root cause.** `route.entryAccesses` is the union `[userRatings, jobEvents, users, users, arbitrators,
meceTags, users, arbitrators, userReviews]`, so the route publishes one witness position per union entry
slot. `userRatings` is not a chunkable collection, so the SDK's collection loop pushed nothing for it, and
the SDK then filled the published positions **positionally** from that compact list. Every value after the
first unwitnessed slot landed on the parameter of the slot before it. The two consumers
(`abiFunction.inputs` for a direct frame, `bFunc.inputs` at the delegate-argument assembly) both read
`entryValueWitnesses` positionally, which is why both were affected.

**Landed** (`05be374e7` fix(solidcash): key a value witness by its entry-slot ordinal, not by position):
`entryValueWitnesses` is now a `Map<slot ordinal, witness>`, and both consumers read the ordinal out of the
ABI name they are filling (`__internal__valueWitness_<ordinal>`). A slot that resolves no witness leaves
its own position empty, and a resolved witness with no published position is refused instead of silently
mis-slotted. The failure-point `routeParams` diagnostic also prints the value-witness / leading-push route
parameters (kept: it is what localized this).

**Effect.** Every input-214 title measured now advances to **input 216**:
`take job`, `update job tags`, `integration test`, `post job 1`, `post job with whitelist`,
`should whitelist worker` (and `post job two jobs`). The pass set is unchanged (20/21; the one is the known
`register user > update user` index-out-of-bounds title matching the same `-t` filter).

### ROUND 38: input 216 is one batch entry output short — `_allowances` lane 3 never materializes

With 214 fixed, the next blocker is input 216: a **FakeToken** route participant (category `424cc33a…`).
The failure is at `ip 1` of a **5-instruction** body (`invokeDebug['45']` = `OP_PICK OP_EQUALVERIFY OP_DUP
OP_OUTPUTTOKENCATEGORY OP_DUP`, used from the route at ip 6397):

    UNEQUAL ip 1 of 5:  left = 51                                  (a bare OP_1 output script)
                        right = aa20c85f18ac45dbf85476ec948a712b3050f9ae817c32f3e89228d8da3e3b93883087

The helper is `require(<expected entry lock> == OP_OUTPUTBYTECODE(inputIndex + 5))`, and the trace
(`message-bus-failure-ring`, which now shows the pre-instruction stack) proves `tx.outputs[221]` has
locking bytecode `51` while the covenant expects the `_allowances` entry covenant lock.

`FakeToken.messageBus.route.blockLayout` puts the four sorted-batch entry slots at block offsets
**2, 3, 4, 5**, and the assembled block (base = output 216) has:

    out 216 master | 217 dataNft | 218 entry e2a4aac2 (offset 2) | 219 entry 8c600621 (offset 3)
    out 220 entry 09f85bbf (offset 4)  |  out 221 = 0x51 PLACEHOLDER (offset 5)  <- missing entry

The batch is `_balances[0,1]` + `_allowances[2,3]`; lane 3's target is `f8f64388…` and **no output in the
whole transaction carries it** (checked the full entry-lock inventory and the 308-output dump).

**Where it is NOT (measured, probes reverted):**

* The plan is right: `vmap-batch-plan` shows `_allowances slotIndices [2,3]` with plan outputs for both
  `09f85bbf` and `f8f64388`.
* The final entry plan is right: `entry-plan-final` shows slot 3 with `exists=false`, `utxo=false`,
  `inactive/hardDelete/softDelete/aliasSkip` all false and `placeholder='f8f64388…'`.
* The builder is right: `entry-output-slot` shows `slot=3 offset=5 produced=true raw='f8f64388…'` in every
  instance, and `assignBalancedOutputAtOffset` never substitutes a placeholder.

So the entry output **is** produced at the group's offset 5 and something *after* `_createBuilder`
replaces it. The one place that writes a bare `0x51` output into a participant block is
`compose.ts:3104`:

    while (local.outputs.length < blockSize && local.outputs.length < local.inputs.length) {
      const input = local.inputs[local.outputs.length];
      local.addOutput({ to: Uint8Array.of(0x51), amount: input.satoshis });
    }

**Next step (one measurement):** log the participant's `local.outputs` immediately before and after that
padding loop (lock, index, token commitment) together with the group builder's own outputs. If the entry
output for offset 5 is absent from `local.outputs` before padding, the assembly dropped it (compare the
group's `outputs` array against `local.outputs`, slot by slot); if it is present before padding and gone
after, the padding loop is replacing it.

**Method note.** The ring's pre-instruction stack (`message-bus-failure-ring`, the last entry with
`instructionCount == <body size>`) is what identified `OP_OUTPUTBYTECODE(inputIndex+5)`; the collector's
`large-equals` pair alone only said "`51` vs a lock". Pair the two dumps: the collector gives the operands,
the ring gives the stack that produced them.

### ROUND 39: the missing lane is a deleted one — derivation removed an active batch lane

Round 38 asked for the participant's `local.outputs` before/after the composer's padding loop. The padding
loop is innocent, and so is the composer: `atomic-local-block-as-built` (probe, reverted) shows the block
arriving from `localCall.build()` already with the placeholder at offset 5.

The built-in stage hook found the writer in one run - it prints the transition of one output index through
every builder stage:

    SOLIDC_DEBUG_OUTPUT_INDEX=5 SOLIDC_DEBUG_OUTPUT_CATEGORY=424cc33a

    layout-entries          -> output 5 MISSING            (nothing placed it at the entry layout)
    balanced-trailing-frame -> output 5 = _balances lock, commitment e3b0c442…   (a filler)
    … later builders: layout-entries -> _allowances lock f8f64388…   (correct!)
    … and others:     layout-entries -> 51 placeholder

So the decision is made **inside the builder**, before the composer ever sees it: sometimes the lane's
entry output is produced, sometimes the slot is a placeholder. The writer is the derivation's conditional-slot
cleanup (`_deriveFullTransactionState`, ~16193):

    const observedSlots = new Set([...commitMap.keys()].map((outIdx) => slotOrder[outIdx - entryOutputBase]));
    const conditionalSlots = new Set(slotOrder.filter((slotIndex) => … stb.isEntrySlotConditional(slotIndex)));
    for (const slotIndex of conditionalSlots) {
      if (observedSlots.has(slotIndex) || stb.isEntrySlotPinned(slotIndex)) continue;
      const commitment = stb.getExistingEntryCommitment(slotIndex);
      if (commitment) { … } else { stb.deleteEntry(slotIndex); … }
    }

Every FakeToken entry slot is `conditional: true`, lane 3 is a *fresh insert* (no existing entry) and the
probe never observed its commitment (the covenant gates the untaken orientation of the swappable
`_allowances` pair), so derivation **deleted** it. That rule is right for a cache-lowered invariant flush
whose dirty arm was not reached; it is wrong for a sorted-batch lane, whose coordinate the batch covenant
verifies positionally - the lane's published batch witness (`predOut`), not the trace, says whether the lane
is active.

**Landed** (`52a9a8fea` fix(solidcash): keep an active sorted-batch lane's entry output): every slot that
receives a batch target placeholder is marked with the new builder method `requireEntryOutputSlot`, and the
derivation cleanup skips required slots. A placeholder only exists for a lane the batch publishes as active
(inactive and alias-skipped lanes `continue` before it), so the mark is exactly "this lane's output is read
at its fixed block coordinate". Probes reverted; pass set unchanged (20/21, the one being the known
`register user > update user` filter overlap).

**Effect:** output 5 now consistently ends as the `_allowances` entry with commitment `f8f64388…`, and the
input-216 failure **moves past the lane check** to `ip 2` of a different body.

### ROUND 40: the next input-216 check is the participant's own return-event frame

The new failure is inside the callee's route, at `ip 2` of the 33-instruction body
`invokeDebug['-25']` (`OP_OVER OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY OP_DUP OP_OUTPUTTOKENCATEGORY …` -
"verify this output is exactly (commitment, category, amount, lock, value)"). Both operands are
**98-byte pushdata-wrapped frames** (`4c60` = `OP_PUSHDATA1 96` + a 96-byte payload):

    L (stack[-2], the route's expectation, 98 B)
      4c60 00×22 36 35 c9 ad c5 de a0 00 00 00 00 00 00 01 00×32 01
    R (stack[-1], OP_OUTPUTTOKENCOMMITMENT of the output under test, 98 B)
      4c60 00×29 01 00×33 01

    diff: payload bytes 23..29  L = 36 35 c9 ad c5 de a0   R = 00 00 00 00 00 00 00
          payload byte 31      L = 00                        R = 01

So the SDK materialized a return-event frame whose amount-like 8-byte field is zero where the covenant
computed a value, and whose trailing flag byte is 1 where the covenant has 0. The ring shows the output
index on the stack below the pair (`2:ee00` = 238 = the FakeToken participant's `returnEvent` slot at block
offset 22), and the *next* checks in the same body (category split, token amount 0, locking bytecode,
output value ≤ N) are the standard "this output is exactly the declared event" sequence.

This failure was previously masked by the lane check in the same input, so it is *not* a regression from
ROUND 39 - but ROUND 39 changed which entry outputs exist, so the derived frame may legitimately have
changed too. Confirm that before treating it as pre-existing.

**Next step (one measurement):** dump the return-event frame the SDK writes for this participant next to the
one the route computes: `SOLIDC_DEBUG_RETURN=1` prints the return-event derivation, and
`message-bus-output-summary`/`SOLIDC_DEBUG_FAILURE_POINT_FULL=1` give output 238's commitment. The byte that
separates the two frames is a `01` in the SDK's trailing field and an amount (zero in the SDK's) - i.e. the
SDK's frame looks like "amount field empty, flag set" while the route's is "amount present, flag clear".
`SOLIDC_DEBUG_OUTPUT_INDEX=22 SOLIDC_DEBUG_OUTPUT_CATEGORY=424cc33a` traces that slot through the builder
stages.

**Already run (round 40b), and here is the frame's shape.** The slot really is the `returnEvent` slot
(block offset 22, absolute output 238): its output is a **bare `OP_1` lock carrying a `capability: none`
token whose commitment is the 98-byte frame** (`4c60` = `OP_PUSHDATA1 96` + a 96-byte payload), which is
`<u16 length> + 3 × 32-byte words`:

    word 0 (payload bytes 0..31):  covenant L = 36 35 c9 ad c5 de a0 00 00  (0x3635c9adc5dea00000 = 1e21)
                                   SDK      R = 00 … 01
    word 1 (payload bytes 32..63): both = 00 … 01
    word 2 (payload bytes 64..95): both = 00 … 01

So the SDK wrote `1` in the first word where the route's own computation has the **transfer amount**
(`1e21` = `BigInt(1000e18)`, the amount both `post job 1` and `should whitelist worker` move), and the other
two words agree. `SOLIDC_DEBUG_OUTPUT_INDEX=22 SOLIDC_DEBUG_OUTPUT_CATEGORY=424cc33a` shows the frame is
written at the builder's `balanced-trailing-frame` stage (and is sometimes `00`, i.e. an empty
commitment, in probe builders), so the writer is whatever materializes the participant's return-event
output, not the composer.

**Next measurement (narrowed):** find the writer of that first word. `SOLIDC_DEBUG_RETURN=1` plus a grep for
the return-event commitment builder (`returnEventCommitment` / `pendingReturnEventOutputs` /
`seedPrecomputedReturnEvents` in `StatefulContract.ts` and the return-event block in
`StatefulTransactionBuilder`) - start from the value `1`: a literal 1 in the first word of a 3-word frame is
what a *default/blank* frame looks like, so the likely defect is that the amount-bearing word is never
filled for this participant (the amount is known from the row's arguments, which the covenant reads).

### ROUND 41: the frame is the participant's return vector, and two seeds for one part disagree

Chased the first word. `SOLIDC_DEBUG_RETURN_VECTOR=1` and the return-event seeding probe
(`set-return-event-output`, enabled by `SOLIDC_DEBUG_FAILURE_RING=1`) give both sides:

    atomic-return-vector  -> only participant 0 (MarketplaceV1) is printed; the FakeToken participant never
                             reaches that path, so its 98-byte commitment is not assembled there.

    set-return-event-output (FakeToken category 424cc33a…):
      424cc33a…          len=1   '00'                                  (clear)
      424cc33a…          len=32  …0001
      external-call:1:0  len=32  …3635c9adc5dea00000   = 1e21
      external-call:2:0  len=32  …3635c9adc5dea00000   = 1e21
      external-call:4:0  len=32  …3635c9adc5dea00000   = 1e21
      external-call:4    len=32  …3635c9adc5dea00000   = 1e21
      external-call:1    len=32  …0001                              <-- disagrees with :1:0
      424cc33a…          len=98  4c60…  (the frame the covenant rejects)

So the frame is the participant's **return vector**: one 32-byte word per returning invocation
(`external-call:N` / `external-call:N:0` name one physical return part). The covenant's expected frame is
`[1e21, 1, 1]` and the SDK's is `[1, 1, 1]` - i.e. the first returning invocation's result is the one in
dispute, and the *call-specific* seed (`external-call:1:0` = 1e21) agrees with the covenant while the
non-provisional `external-call:1` = `1` does not.

Where each seed comes from:

* `external-call:N:P` - `seedPrecomputedReturnEvents` (`StatefulTransactionBuilder.ts:15155`), value
  `candidate.precomputedReturnCommitment ?? fallback`, provisional when the candidate has no precomputed
  value. This is the call-specific value and it matches the covenant.
* `external-call:N` - the same pass (`:15166`) seeds the whole-call alias with the **physical group's**
  fallback; `StatefulContract.ts:14267/14692` also seed both names from a **trace-extracted**
  `returnCommitments[0]` with `provisional = false`, and a non-provisional write can never be replaced.

**Tried and reverted:** seeding the whole-call alias with the *same call's* first part
(`loopReturnCommitments[0] ?? precomputedReturnCommitment ?? fallback`) instead of the physical group's
value - the fix that matches the documented alias rule. It is **inert for this blocker**: `external-call:1`
already holds a non-provisional trace-extracted value, so `shouldReplaceReturnEventCommitment(false, true)`
rejects the corrected seed. The change is correct in principle (see the alias-synchronization comment at
`StatefulTransactionBuilder.ts:15214`), but it cannot help until the trace-extracted value is right, so it was
reverted rather than landed unverified.

**The live hypothesis (next measurement):** the trace extraction returns `…0001` for a part whose value is a
*`uint256` result* (`1e21`). A `bool` and a `uint256` both encode to a 32-byte word, so a **wrong result
type** for that invocation would produce exactly this "same length, `1` instead of the amount" shape. Note
the two encodings the composer supports: `compact-pushdata-v1` decodes per `invocation.resultTypes` via
`canonicalNativeResultField`, and for it the composer *re-materializes* the output from the decoded canonical
fields (`compose.ts` ~3700); `evm-abi-v1` slices `evmInvocationResultLength`. So:

1. print the plan's per-invocation `resultTypes`/`resultEncoding` for the FakeToken participant and compare
   them with the route's actual return schema (`messageBus.handlers[].outputs` for the selected handlers);
2. if they disagree for the first returning invocation, the fix is in the type list the plan carries, not in
   the seed values;
3. if they agree, the extraction is at fault - start from
   `extractPendingReturnCommitment` / `extractCommitmentsFromTrace` /
   `extractExpectedOutputCommitmentFromTrace` (`StatefulContract.ts:14160-14290`) for that part.

`atomic-return-vector` did not fire for this participant, so whatever assembles its 98-byte frame is the
`seedPrecomputedReturnEvents` path plus the builder's `balanced-trailing-frame` materialization of
`pendingReturnEventOutputs` - not the composer's decode loop. Confirm which value that materialization
selects for the aliased part before changing the seeds.

**The return schema makes the hypothesis concrete.** `FakeToken.messageBus.handlers` publish mixed result
types:

    balanceOf uint256   allowance uint256   totalSupply uint256
    transfer  bool      approve   bool      transferFrom bool

so the participant's return vector is a mix of `uint256` words and `bool` words, and a `uint256` word of
`1e21` versus a `bool` word of `1` is exactly the observed "same 32-byte length, different value" shape. The
first returning invocation of this participant must therefore be a `uint256`-returning call whose word the
frame filled with a `bool` value - i.e. the per-invocation `resultTypes` the plan carries for it are the
thing to check first (see the three steps above).

### ROUND 42: the types are right - the CLAIMED VALUE for the uint256 invocation is not

Round 41's first step (compare the plan's per-invocation result types with the route's schema) came back
clean, and it also produced the value that is actually wrong. A probe on `compose.ts:3586`
(`atomic-owned-returns`, since reverted) prints, per participant, the invocations whose `resultTypes` are
non-empty together with the result the plan currently claims for each:

    participant 2 FakeToken
      invocation 2  balanceOf     resultTypes ['uint256']  evm-abi-v1  claimed …0001   <-- wrong
      invocation 3  approve       resultTypes ['bool']     evm-abi-v1  claimed …0001
      invocation 5  transferFrom  resultTypes ['bool']     evm-abi-v1  claimed …0001

So the vector is `[balanceOf, approve, transferFrom]`, the types match the handler schema
(`balanceOf uint256`, `approve`/`transferFrom` bool), and the only bad value is the `uint256` one: the plan
claims `1` (a bool-shaped word) where the covenant computes the balance (`0x3635c9adc5dea00000`, the value
the `_balances` input commitment at index 218 also carries). No type or ordering defect.

**Where that claim comes from.** `claimedResults` starts as `provisionalResults` (`compose.ts:3722`) - the
discovery pass's provisional result commitments - and the convergence loop only replaces an entry when the
*provisional transaction* exposes a different value (`deriveReturnResults`, `compose.ts:3575-3710`, then
`claimedResults = derivedResults`). The FakeToken participant's own return output is materialized by its
builder from exactly those seeds (`seedPrecomputedReturnEvents` -> `pendingReturnEventOutputs` ->
`balanced-trailing-frame`), so a wrong provisional value can be **read back out of the transaction the SDK
just built** and confirm itself; `atomic-return-probe-missing` never fired for participant 2, i.e. the probe
*did* extract a blob there.

**Next measurement:** print the FakeToken participant's `provisionalResults` entry for invocation 2 where it
is first produced (the discovery path that evaluates `balanceOf` off-chain and stores
`provisionalResultCommitment` on the prepared call) and compare it with the same call's *post-state* balance
in the composed transaction. If the off-chain evaluation reads the **pre-transaction** balances entry (a
stale/other value, here `1`), the fix is to stop trusting a provisional result that the same pass also seeds
into the transaction - e.g. mark the seeded return output untrusted in `deriveReturnResults`, or derive the
value from the covenant's own computation in the trace instead of from the output commitment the SDK wrote.

### ROUND 43: the frame is not assembled from the `external-call:*` seeds at all

Round 42 left "print where `provisionalResults` for the `balanceOf` invocation comes from". Doing that named
the exact writer, and it is **not** the alias selection.

**What the seeds are.** A probe on the node→seed mapping (`atomic-seed-selection`, reverted) shows the
FakeToken participant's returning nodes and the identity each one picks:

    meceTags        group 0  identities {0}     matched external-call:0:0
    balanceOf       group 1  identities {1, 4}  matched external-call:1:0      <- fused with group 4
    approve         group 2  identities {2}     matched (none)
    userRegistered  group 3  identities {3}     matched external-call:3:0
    transferFrom    group 4  identities {4}     matched external-call:4:0

`balanceOf`'s physical group is 1 and its logical return group is 4, i.e. the two calls fuse onto one
physical return group. The seeds themselves (from the `set-return-event-output` probe):

    external-call:1:0 = …3635c9adc5dea00000   (1e21 - the canonical value the covenant expects)
    external-call:1   = …0001                 (later, non-provisional, probe-extracted)

**Two preference fixes tried, both inert.** Both the tail selector
(`selectMaterializedTailReturnEvents`, whose own doc comment says the numbered form is the call's
independently evaluated canonical result and only a *provisional* seed may be superseded) and the in-block
writer reassert (`_reassertInBlockWriterReturns`, which looks the alias up before its `:0` counterpart) were
changed to prefer an authenticated numbered entry. Neither changed the failing frame by a single byte, and a
probe placed in the tail selector **never fired** for this participant, so neither path assembles the frame.
Both were reverted.

**Where the frame really comes from.** The 98-byte frame is seeded with identity = the *participant
category* (not `external-call:*`) by

    builder.setReturnEventOutput(this.categoryId, blob);        // StatefulContract.ts ~32477

with `blob = this._deriveReturnBlob(builder, returnMaterializationOutputIndex, delegatecallInputIndex ?? 0)`,
i.e. the contract derives the participant's whole return blob and publishes it as one opaque frame. That is
the value the materializer and the composer both read, so the wrong first word is either produced inside
`_deriveReturnBlob` (a probe read of the participant's own return output) or in whatever materializes that
output's commitment for a multi-part participant before the probe runs.

**Next measurement (one probe):** log inside `_deriveReturnBlob` for the FakeToken participant
(`returnOutputIndex` = its `returnEvent` slot, category `424cc33a`) the `commitments` it extracts, the probe
transaction's commitment at that index, and the `trace` tail if the extraction comes back empty. That names
the reader; then walk backwards one step to whichever code writes that output's commitment (the builder's
`balanced-trailing-frame` stage is where the 98-byte value first appears, per
`SOLIDC_DEBUG_OUTPUT_INDEX=22 SOLIDC_DEBUG_OUTPUT_CATEGORY=424cc33a`).

**Note for whoever continues:** the `post job 1` frame and the `should whitelist worker` frame are
byte-identical in their first word conflict, so this one writer is the whole input-216 class.

### ROUND 44: the input-216 return-frame class falls — 26/66

ROUND 43's one-probe plan paid off, and the writer it named is not the fix site. The chain is:

1. The composer's only correction path for a returning participant's claimed per-invocation results is
   `_messageBusReturnBlobFromTransaction` (`compose.ts:3599`). Its targeted observation
   (`extractCommitmentsFromTrace` over the return-event output) finds nothing when the progressive probe stops
   after the route assembled its frame and before that frame's output comparison.
2. The weaker reading that exists for exactly that state - `extractSchemaFallback` -> `extractEvmReturnCommitment`
   - was called with `allowRaw = false`, which rejects a *bare* (unframed) ABI vector. So `blob` came back
   `undefined`, `atomic-return-probe-missing` fired for participant 2, and `deriveReturnResults` kept the
   discovery pass's provisional claim for the `balanceOf` row (`…0001`) instead of the value the route computed.
3. The participant's frame is then assembled by the composer from those claims, so it stayed `[1, 1, 1]` and the
   participant's own covenant rejected it at input 216 - exactly ROUND 40's byte conflict.

**Evidence.** With `SOLIDC_DEBUG_RETURN_VECTOR=1 SOLIDC_DEBUG_RETURN_VECTOR_CONTRACT=FakeToken
SOLIDC_DEBUG_RETURN_VECTOR_INPUT=216` the failing route frame's stack carries the *complete and correct* vector
`0000…3635c9adc5dea00000 ++ <bool 1> ++ <bool 1>` while `observations` is empty and `atomic-return-vector` never
prints for participant 2. A probe on `_deriveReturnBlob` (reverted) also showed that the FakeToken participant's
own blob derivation is not called inside the composition at all - it runs once during deployment
(`inputIndex 0`, `returnOutputIndex 3`) - so the frame really is the composer's, assembled from claims. That
closes ROUND 42's "where does the claim come from" question: the claim is right, only its correction path refused
the evidence.

**The fix** (commit `00b8a78ed`): `isConstrainedEvmResultVector` (`StatefulContract.ts`, next to
`EVM_DYNAMIC_RETURN_TYPES`) now decides `allowRaw`. A *multi-row* scalar vector whose rows constrain their
encoding - at least one `bool`, `address`, fixed-bytes, or narrow `int`/`uint`/`fixed` row - is accepted in its
bare form as the weaker reading. A lone ABI-width word stays rejected (state hashes, mapping witnesses, and
placeholders are all canonical `uint256` words), a vector made only of unbounded `int`/`uint`/`bigint` rows stays
rejected, dynamic rows stay rejected, and the compiler-framed reading still wins whenever the trace exposes it.
The final BCH-2026 preflight authenticates whichever reading reaches assembly, so a wrong claim cannot survive.
Regression coverage: `packages/solidcash/test/unit/ExternalReturnEncoding.test.ts`
(`isConstrainedEvmResultVector`, plus the bare-vs-framed selection it drives).

**Ladder: 26 pass / 39 fail** (was 21/45), one complete 66-title run
(`npx vitest run --config vitest.marketplace.config.ts --reporter=verbose --no-file-parallelism`), zero
regressions - all 21 previously passing titles still pass. The five new passes are
`job posting > post job with whitelist`, `take job > sanity checks`, `pay start job > sanity checks`,
`dispute > sanity checks closed job`, `refuse arbitration > job closed`; the rest of the input-216 class now
fails later, in the classes below.

**Gates.** Root `yarn build` clean. SDK unit suite: 4 failed / 720 passed; the same four test names fail with the
fix reverted (`RecursiveEvmResultLayout` x1, `ValueChunkConstructionAuthority` x1, `ValueChunkDescriptorAuthority`
x2), so the fix adds three passing tests and regresses none. The change is SDK-only, so the compiled fixture and
the testing-suite artifacts are untouched.

### ROUND 44b: what is left, and the next measurement

The 39 failures are now six signatures. The dominant one is a *send* guard, not a read:

    18  "messageBus: transported continuation output does not own a balanced trailing slot"
     7  getEvents / getJobs read an empty array ("Cannot read properties of undefined (reading 'job')" x6,
        "expected [] to contain subset" x1)
     3  "index out of bounds ... probe stopped at ip 5 (opcode 85): Program attempted to read from an invalid
        transaction UTXO index ... requested index: -1" (getUsers / getArbitrators)
     3  "state commitments could not be auto-derived ... Route probe convergence repeated a physical state"
     2  "Signer transaction nonce 16 is already reserved"
     2  "[L3_RESOURCE_UNRESOLVED] ... '__message_bus_key_meceTags_0' must identify one physical entry"
     1  "expected 0n to deeply equal 2n" (update job many times, get history)

**The continuation class, measured.** A probe on `update job` (`SOLIDC_DEBUG_CONTINUATION=1`, reverted) prints
the plan the composer computes at `compose.ts:2706` and the state that raises the guard at `compose.ts:2836`:

    participant 1 MarketplaceDataV1, transportedChunkCount 2, chunksPerCandidate [2]
    valueChunkSlots: [[0,21], [1,22], … [62,83], [63,84]]      (route __message_bus1, trailingBase 21, capacity 64)
    selected: [[62,83], [63,84]]                               (slice(-transportedChunkCount) = the last two)
    __internal__valueChunkOutputBase = 212 = participant base 129 + 83

    guard state: slot { kind: 'trailing', offset: 83, slotIndex: 62, conditional: true }
    local.inputs[83] = { satoshis: 5000n,
                         token: 'ee643a1671fbbe5333480fe40ff0fa72b65b6df0818805a2209586e991ca0af0',
                         lock: 'aa201424fcc85ecd6566e6aadb49e8ebda0907d0fe20b6f48d3c2cabcafdbac0763987' }
    BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX = aa20953c…

The composer hands the participant the *last* two trailing slots and asserts that the participant's own balanced
block funded them with dummy funders - but the participant's build materialized a token-bearing input at offset 83
instead. Note the chunk indices in the guard ran as high as 4 in an earlier assembly pass (a later pass transports
only 2), i.e. the mismatch appears on the pass whose transported value is widest, which is why the failure
survives every claim convergence. The next measurement is inside the participant's own `build()`: print which
input and output (with owner and lock) occupy offsets 83/84 and whether the routed builder's value-chunk band
agrees with the `__internal__valueChunkOutputBase` it was handed. The reconciliation is either the band the
composer names or the occupancy map it assumes - not the transport loop itself.

**The read class.** `post job 1` now completes its `publishJobPost` send and its
`to.emit(marketplaceData, 'JobEvent')` assertion (the event *output* path is correct), then
`checkJobFromStateDiffs` calls `marketplaceData.getEvents(jobId, 0n, 0n)` and receives `[]` while
`marketplaceData.getJob(0)` reads correctly in the same fixture. `post two jobs` fails the same way one step
later on `getJobs(0, 1)`. Both handlers return a *dynamic array* (`JobEventData[]`, `JobPost[]`) over a
`chunkableArrayValue` collection, so the read path - not the composer - is where to look next; the composer-side
ABI decoder already supports dynamic array layouts (`evmResultLayout`, `compose.ts:772`).

### ROUND 45: the transported-continuation guard was rejecting a consumed predecessor (26/66, new class)

ROUND 44b's measurement was taken and it named a wrong requirement rather than a wrong band.

**What the guard demanded.** `assemble` (`compose.ts:2866`) takes the participant block's *last*
`transportedChunkCount` trailing slots, replaces each slot's output with the transported chunk, and required the
slot's **input** to be a balanced dummy funder. A participant whose continuation already existed in the prior
state consumes the predecessor chunk there instead, so every pass threw
`messageBus: transported continuation output does not own a balanced trailing slot` - 18 of the 66 titles.

Measured on `update job` (`SOLIDC_DEBUG_CONTINUATION=1`, probes reverted):

    participant 1 MarketplaceDataV1, transportedChunkCount 3
    selectedValueChunkSlots [[61,82],[62,83],[63,84]]   (route __message_bus1, trailingBase 21, capacity 64)
    slot 83 input: mutable token of the participant's own category, commitment `0000…` -> chunkIndex 0
    claim for that slot: commitment `0100…` -> chunkIndex 1        <-- band shifted by the wider value
    slot 84 input: `0100…` -> chunkIndex 1;  slots 82 input: balanced dummy funder

The transported value grew from 2 to 3 chunks, so its band moved one slot down while the participant's
predecessor chunks stayed at the band tail. The predecessor at a slot therefore need not carry the index being
written there; the covenant pins the *outputs* by band index and consumes the old chunks as inputs, and the
final BCH-2026 preflight authenticated the arrangement once the guard admitted it (`update job` now completes its
`updateJobPost` send and fails later, in the read class below).

**The fix** (commit `fb4533419`): `canOwnTransportedContinuationSlot` (`compose.ts:303`) authorizes the slot when
it is either the balanced dummy or a mutable token input of the transported category whose commitment parses as a
canonical value chunk (`valueChunkIndexFromCommitment`). Shared category, mutable capability, and a canonical
chunk index keep an unrelated token input from authorizing the replacement, and the participant's own covenant VM
still authenticates the completed block. Regression coverage:
`packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`.

**Ladder: 26 pass / 39 fail, and the pass set is *identical*** (`comm`-style set diff between the ROUND 44 and
ROUND 45 full runs: no new passes, no lost passes). The value of this round is that the 18-title guard is gone;
every one of those titles now fails later, in the two classes below, with 8 of them reaching the event read.
Full run: `npx vitest run --config vitest.marketplace.config.ts --reporter=verbose --no-file-parallelism`.
Root `yarn build` clean; the change is SDK-only, so the compiled fixture is untouched.

### ROUND 45b: the new failure map

    14  "messageBus: complete graph did not expose arguments for all deferred compute resources"
     8  getEvents / getJobs return an empty array ("Cannot read properties of undefined (reading 'job')" x7,
        "expected [] to contain subset" x1)
     3  "index out of bounds ... probe stopped at ip 5 (opcode 85): ... requested index: -1" (getUsers/getArbitrators)
     3  "state commitments could not be auto-derived ... Route probe convergence repeated a physical state"
     2  "Signer transaction nonce 16 is already reserved"
     2  "[L3_RESOURCE_UNRESOLVED] ... '__message_bus_key_meceTags_0' must identify one physical entry"
     1  "BCH-2026 preflight failed at input 127: Program failed an OP_VERIFY" (pay start job)
     1  "BCH-2026 preflight failed at input 3: ... requested index: -1" (should whitelist worker)
     1  "expected 0n to deeply equal 2n" (update job many times, get history)

**The deferred-compute class, measured.** One run of `deliver result` with `SOLIDC_DEBUG_ECRECOVER_DERIVE=1`
prints the controller's own view (`StatefulTransactionBuilder.ts:12092`):

    deferred-ecrecover-no-argument {
      unresolvedAIndices: [[4,0],[6,1],[8,2],[10,3],[12,4],[14,5],[16,6],[18,7]],
      inputCount: 129,
      inputBytecodeReads: [ { index: 127, belowBytes: 0 }, { index: 3, belowBytes: 1, below: '02' } ],
    }

Eight deferred `ecrecover` calls are unresolved, each waiting for the 97-byte argument blob
(`hash ++ v ++ r ++ s`) that the resolver expects to find **below** an `OP_INPUTBYTECODE` observation whose
index is the call's sidecar-A input (`resolveDeferredEcrecoverArgument`, `StatefulTransactionBuilder.ts:12092`:
the sidecar A/input index map at 12095-12104, the 97-byte read at 12108-12122). The trace exposes no such read:
the two `OP_INPUTBYTECODE` states it does expose carry 0- and 1-byte operands, so the covenant never reached the
argument reads for those eight calls. An earlier pass in the same run *did* learn one argument
(`deferred-ecrecover-learned { callIndex: 0, inputIndices: [7], argument: c812bf42… }`), so the machinery works
when the covenant reaches the read - the next measurement is what the covenant is doing at inputs 4..18 instead
(the failing ip / the resource claim that stops it), i.e. the usual
`SOLIDC_DEBUG_FAILURE_POINT=1 SOLIDC_DEBUG_FAILURE_RING=1` pair on the participant that owns those sidecars.

**First failure-point datum for that class (same run, `SOLIDC_DEBUG_FAILURE_POINT=1`).** Four passes print a
failure point; the last two - the ones immediately before the throw - are identical in shape and read:

    failure-point { inputIndex: 0, ip: 11, opcode: 109,
      controlStack: [ { ip: 803, instructionCount: 803 }, true x5,
                      { ip: 327, instructionCount: 1199, opcode: 103 } ],
      stack: [ '8:1:05', '9:32:e2a4…', '10:1:02', '11:32:cabb…', '12:32:00…', '13:1:01',
               '14:9:0000a0dec5adc93536', '15:25:76a91447d9…', '16:256:cabb…020000', '17:0:', '18:0:', … ] }

(`opcode: 109` is the instruction *after* the failing one - the reported `ip` is one past a failing
`OP_EQUALVERIFY`/`OP_VERIFY`, the convention this file uses throughout - and `opcode: 103` in the control stack is
the enclosing `OP_ELSE`.) The failing frame is a small body (803 instructions) inside the 1199-instruction body of
the branch taken at `ip 327`. The stack at that point carries three small script numbers (`05`, `02`, `01`), a
32-byte value, and a 256-byte blob - i.e. the branch is still doing selector/flag work and has not reached the
ecrecover argument reads for the eight unresolved calls at inputs 4..18. Next: decode the failing instruction at
`ip 10` of that 803-instruction body against the participant's debug map (`debug.functionDebug`), and check whether
the 256-byte stack item is the `batchBlob`-relative row the deferred calls need.

### ROUND 46: both post-ROUND-45 classes measured to their failing instruction (no commit)

No fix landed this round; both dominant classes were driven to a precise failing point with temporary probes
(all reverted, tree clean at `fb4533419`).

**Deferred compute (14 titles).** `deliver result` with `SOLIDC_DEBUG_ECRECOVER_DERIVE=1` ends in one
`atomic-deferred-compute-no-progress`:

    executionInput: 127, inputBase: 0, states: 951,
    error: 'Program called an OP_SPLIT operation with an invalid index.
            stack item length: 0; requested split index: 32.',
    ip: 1,  stackBytes: [0, 35, 35, 35, 0, 0, 1, 28],
    terminalStack bottom item: '19457468657265756d205369676e6564204d6573736167653a0a3332'
                               (= "\x19Ethereum Signed Message:\n32")

`resolveDeferredEcrecoverArgument` (`StatefulTransactionBuilder.ts:12092`) needs the 97-byte argument blob
*below* an `OP_INPUTBYTECODE` observation whose index is the call's sidecar-A input; the controller reports 8
unresolved calls whose sidecars sit at aggregate inputs 4,6,…,18 while the trace only exposes bytecode reads at
127 and 3, with 0- and 1-byte operands. The covenant is splitting an **empty** item to obtain a 32-byte field
while the EIP-191 prefix is already on the stack, i.e. an argument (message hash or signature component) the
route should have produced is empty before the deferred read is reached. An earlier pass of the same run *does*
learn one argument (`deferred-ecrecover-learned { callIndex: 0, inputIndices: [7], argument: c812bf42… }`), so the
mechanism works when the covenant gets there. Next: identify the route argument that is empty for those eight
calls (the row's signature/message parameter) - the failing split is one instruction past the reported `ip`.

**Read class (8 titles).** `post job 1` with `SOLIDC_DEBUG_READ_PROBE=1` (probe added and reverted) shows the
`getEvents` read is *fully supplied*:

    input 3: fn 'getEvents'
      jobId_: 0   index_: 0   limit_: 0
      __internal__valueWitness_0: bytes:180  head '51001471782e8159265ed94bd35b8e699c08f53a6f38c6…'
      __internal__returnOutputIdx: 7    __internal__proxyMasterIndex: 0
    entry input 6: EntryNft_ee643a16, commitment 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4…'
    chunkable-read-witness { functionName: 'getEvents', collection: 'jobEvents',
      slot/proofSlot 'e3b0c442…', present: true, tailBytes: 64, storedLength: 180, witnessBytes: 180 }

(`e3b0c442…` is `SHA256("")`, which is this compiler's key slot for `jobEvents[0]`: a VM-number zero hashes as
an empty item. The write derivation uses the same slot, so the entry choice is right.) The derived return is
still an empty ABI array (`480:0000000000000000000000000000000000000000000000000000000000000020 00…`) and the
probe ends `probe stopped at ip 5 (opcode 118): Program failed an OP_VERIFY operation.; probed input 3`. The
source explains what that means: `getEvents` starts with `require(index_ < eventsLength_, "index out of bounds")`,
so a zero-length read means the *covenant* saw `jobEvents[jobId_]` as empty - or the read of the chunked value
failed authentication - and the SDK then returned its own placeholder (the empty array). The value is chunked
(180 B > the inline limit) and the probe supplies the entry plus the assembled witness but **no value-chunk
inputs**; `getEvents` needs to be compared with a passing chunked read (there is none in the suite yet, which is
itself the open question) before choosing between "supply the chunks" and "the witness is not accepted".

**One shared failing instruction.** Three different classes stop in the *same* tiny helper body at `ip 5`:
`register user > update user` / `register arbitrator` / `update arbitrator` report
`probe stopped at ip 5 (opcode 85): … requested index: -1`;
`post thread message > sanity checks` and `should whitelist worker` report the same `ip 5` preflight read of an
invalid UTXO index; the `getEvents` read above stops at `ip 5 (opcode 118)`. Mapping that body once (its
`debug.functionDebug` entry, or the `requires` list of the enclosing route) is likely to pay for several classes
at once - it is the single highest-leverage next measurement.

### ROUND 47: the read class falls - aggregate Solidity results were decoded with a scalar-only helper (32/66)

ROUND 46's "shared failing instruction at `ip 5`" was the thread that unravelled the read class. The failing body
is `[OP_1, OP_PICK, OP_OVER, OP_OUTPUTTOKENCOMMITMENT, OP_EQUALVERIFY, OP_DUP, OP_OUTPUTTOKENCATEGORY]` - the
"this output is exactly (commitment, category, …)" helper - and for `getEvents` it failed because the probe's
return output held **no** commitment while the covenant's expected side was a *complete, non-empty* frame:

    return-blob-extract { contract: 'SolidCashProxy', inputIndex: 3, returnOutputIndex: 7,
      materialized: 'absent',
      extracted: { bytes: 480,
                   word0: '…0020',   # ABI offset 32
                   word1: '…0001',   # array length 1
                   word2: '…0020' } }

So the whole read path was already correct - correct key (`e3b0c442…` is this compiler's slot for
`jobEvents[0]`), correct entry input, correct 180-byte value witness, correct 480-byte authenticated return
frame - and only the **decode** was wrong: `_deriveReturnValue` decoded an `evm-abi-v1` result with
`decodeEvmReturnValue`, which is scalar-only (`EVM_DYNAMIC_RETURN_TYPES` = `bytes`/`string`; everything else goes
to `decodeEvmScalarReturn`, which returns `undefined` unless the value is exactly 32 bytes). The `undefined`
then fell through to `decodePushdataValue(blob, 0, type, structs)` - the *native* pushdata decoder applied to a
Solidity ABI blob - which reads the ABI head as a length and returned `[]`. `SOLIDC_DEBUG_RETURN=1` shows it
directly: `static-return-decoded { contract: 'SolidCashProxy', functionName: '__forward',
outputType: 'JobEventData[]', decoded: [] }`.

**The fix** (commit `3b7157e03`): decode an `evm-abi-v1` result with the complete ABI decoder
(`decodeEvmInvocationResult`) over the declared output types, which walks offsets, lengths, and nested structs
exactly as the writer encoded them. Scalar results decode identically; `decodeEvmReturnValue` stays exported for
its own callers. Regression coverage: `packages/solidcash/test/unit/ExternalReturnEncoding.test.ts`
(`decodeEvmInvocationResult for aggregate results`, including that the scalar-only helper rejects `uint256[]`).

**Ladder: 32 pass / 33 fail** (was 26/39), pass-set diff shows **no lost titles** and six new passes:
`job posting > post job 1`, `job updates > update job`, `job updates > update job arbitrator`,
`job updates > update job many times, get history`, `close job > close job before timeout`,
`post thread message > post thread message`. Root `yarn build` clean; SDK unit suite 4 failed / 722 passed with
the same four pre-existing names; SDK-only change, fixture untouched.

### ROUND 47b: the failure map after the read fix

    14  "messageBus: complete graph did not expose arguments for all deferred compute resources"
         (the ROUND 46 ecrecover measurement still stands: OP_SPLIT of an empty 32-byte field with the
          EIP-191 prefix on the stack, 8 unresolved calls)
     4  "state commitments could not be auto-derived ... Route probe convergence repeated a physical state"
         (post job with invalid amount, close job after timeout, reopen job after timeout, withdraw collateral)
     3  "index out of bounds ... probe stopped at ip 5 (opcode 85) ... requested index: -1"
         (register user > update user, register arbitrator, update arbitrator)
     3  preflight read of an invalid UTXO index / OP_VERIFY at input 3, 11, or 127
         (should whitelist worker, post thread message > sanity checks, reopen job before timeout, pay start job)
     2  "[L3_RESOURCE_UNRESOLVED] ... '__message_bus_key__balances_0' has no shared physical entry orientation"
         (update job amounts) and the meceTags witness (update job tags, post job with invalid mece tags)
     2  "Signer transaction nonce 16 is already reserved" (take job, take job multiple)
     1  "expected [] to contain subset [{title: B}]" - `post two jobs`: `getJobs(0, 2)` now returns the first job
         and no longer an empty array, so the array decode is fixed and the remaining defect is the read's
         `index_`/`limit_` window (one row instead of two)
     1  "expected 0n to deeply equal 1n" (refuse arbitration > job not taken - moved on from the empty read)

`post two jobs` is the cheapest next target of the remaining read-family defects: it needs no new
infrastructure, only the `index_`/`limit_` argument handling of an aggregate read (compare `getJobs(0, 1)` and
`getEvents(jobId, 0, 0)`, which are correct, with `getJobs(0, 2)`).

### ROUND 47c: `post two jobs` measured - the loop rows are duplicates, not missing

`getJobs(0, 2)` now returns the right **width** with the wrong **contents**: two rows, both title `A`
(`expected [ {…"title":"A"}, {…"title":"A"} ] to contain subset [{"title":"B"}]`). Probes (reverted) narrow it:

* the final result blob is a well-formed 1856-byte `JobPost[]` whose ABI length word is `0x02` and which decodes
  to 2 rows - so the ROUND 47 decode fix is doing its job and the width comes from the covenant;
* `loop-return-array-commitments` (for the `getJob` loop callsite inside `getJobs`) reports `reached: 0` and the
  only commitment is the all-zero placeholder, and `loop-return-resolve` never fires: the SDK's loop-return
  expansion is not what produced the second row;
* source of the read: `MarketplaceDataV1.getJobs` loops `result[i] = marketplace.getJob(i + index_)`, i.e. its
  callsite argument is an **expression over the loop variable** (`i + index_`), not an array element. If every
  occurrence materializes the same argument, the *covenant itself* computes `[A, A]` - and preflight accepts it
  because the transaction is self-consistent; only the application-level expectation (`getJobs(0,2)` must list
  both jobs) sees the defect.

So the next target is the per-occurrence materialization of a loop callsite argument that is an expression over
the induction variable. The machinery exists and is threaded: `resolveArguments` (`worklist.ts:175`) passes
`occurrence` into `loopIndex` (`initialValue + stepValue * occurrence`, line 202) and into the
`expressionArgument` callback (line 230), and compose's callback (`compose.ts:1761`) resolves
`descriptors[next - 1].args[argument]` after `takeTarget` advanced `next` for that occurrence. The measurement to
take next is therefore on the **prepared descriptors themselves** for the two `getJob` rows - print
`descriptors[i].args` (and `batchLogicalIndex`/`batchOccurrenceIndex`) while expanding `getJobs`, and check
whether the second row's `index_` argument is `1` or `0`. If the descriptors are already identical, the defect is
in the read's own prepared-call construction (`_deriveReturnValue`'s callsite expansion, where
`_evaluateExternalExpression(..., occurrenceIndex, ...)` is the local equivalent of `expressionArgument`).

### ROUND 48: the deferred-ecrecover class is `takeJob`, and the argument is never exposed

The dominant class is one handler. `MarketplaceV1.messageBus.handlers` publishes exactly one ecrecover handler -
`takeJob` (`ecrecoverCompute: true`, `ecrecoverEvmFlags: [false]`) - and every later title calls `takeJob` to get a
job taken, which is why 14+ titles share the failure.

**What the route publishes.** `MarketplaceV1.messageBus.route` has `ecrecoverCompute: true`,
`ecrecoverLoopReads: true`, `graphEffectFrame { sites: 8, ecrecoverBase: 0, ecrecoverWidth: 2,
ecrecoverOffset: 4 }`, and its block layout carries **16 `ecrecoverSideCar` slots at offsets 4..19** (8 A/B
pairs, the pairs from offset 8 on `conditional: true`). That matches the measured sidecar inputs exactly:
`unresolvedAIndices [[4,0],[6,1],[8,2],…,[18,7]]`. So the mapping is **one ecrecover call site per row**
(8 rows x 2 sidecars), and the harness also shows why nothing can be resolved from the ABI directly:

    ecrecover-call-arguments { functionName: 'takeJob', callIndex: 0, params: [null,null,null,null],
      visible: ['jobId_','signature_'],
      args: ['0','0xbedae1ac55f4e95a7992791b0c0d50fdb8d4d34c494dbeb31f14ecfafff7fd48167fcfc9f508d05c83d0293b08dc3c5d5e1c56648f603b25d75e3f32e205262c1c'],
      hash: 'undefined', v: 'undefined', r: 'undefined', s: 'undefined', graphExecution: false }

The signature is present in the invocation; only the compiler's `(hash, v, r, s)` split is unpublished, so the
argument is deferred by design and must be learned from the covenant's trace.

**Tried and reverted: requiring only the first call site.** Restricting
`hasUnresolvedDeferredEcrecoverArguments`/`resolveDeferredEcrecoverArgument` to `callIndex 0` does **not** unblock
`take job` - the composition still ends in `complete graph did not expose arguments for all deferred compute
resources`. So the dormant rows are not the blocker: the covenant fails *before* it exposes any argument, exactly
as ROUND 46 measured (`atomic-deferred-compute-no-progress`: `OP_SPLIT … stack item length: 0; requested split
index: 32`, `executionInput 127`, with the EIP-191 prefix `\x19Ethereum Signed Message:\n32` at the bottom of the
stack and the test's 65-byte signature `0041bedae1ac…1c` in the frame). The next measurement is therefore the
*item being split*: print what sits directly below the EIP-191 prefix on that stack (the signed message), the
identifier of the failing helper body, and whether the participant's state NFTs are still provisional at that
point - if the message comes from a job-state read, the probe is seeing placeholder state, which would explain an
empty message and why no pass can ever expose the argument.

**Isolated runs differ from the ladder for this class.** `take job` alone fails with the deferred-compute error;
inside the full 66-title ladder it fails earlier with `Signer transaction nonce 16 is already reserved`, i.e. the
fixture snapshot does not reset the mock signer's logical nonce across titles. Use isolated runs when judging
this title, and do not treat the ladder's nonce message as its blocker.

### ROUND 48b: the `getUsers` read class, measured

    Error: index out of bounds Probe detail: probe stopped at ip 5 (opcode 85):
      Program attempted to read from an invalid transaction UTXO index.
      Transaction UTXO count: 9; requested index: -1.; probed input 3.
    failing-body { inputIndex: 3, ip: 5, instructionCount: 13,
      opcodes: [81,121,147,118,199,85,121,136,118,206,118,1,138],
      stack: ['0:','0:','1:1b','35:aa20e755…','1:01','0:','0:','1:81'] }

`marketplaceData.getUsers(0, 0)` (test line 385, through `upgrades.ts:526`) reads
`return userAddresses[i + index_]` in a loop, so the read needs the **dynamic array element inputs**. The route
body is `OP_1 OP_PICK OP_ADD OP_DUP <199> OP_5 OP_PICK OP_EQUALVERIFY OP_DUP OP_UTXOTOKENCATEGORY OP_DUP
<push 0x01> OP_INVOKE` - a "verify input N is this token family" helper - and the index it read is `-1`
(`1:81`, script-number -1), i.e. the element coordinate was computed below the array's base. The contract's own
`require(index_ < usersLength_, "index out of bounds")` supplies the message, so the route also saw
`userAddresses.length` as 0. This class needs the dynamic-array element geometry, not the aggregate decoder that
ROUND 47 fixed; the three titles are `register user > update user`, `register arbitrator`, `update arbitrator`.

### ROUND 49: two dead ends closed on the deferred-ecrecover class

Both cheap hypotheses were tested and falsified; the class is now narrowed to the pass ordering around
`assemble`.

**Dead end 1 - the empty signature witness is not the bug.** The route input `__message_bus_sig_38_0_rows`
arrives as `array:1[bytes:0:]` (one empty signature), which looked exactly like a dropped signature for
`takeJob(jobId_, signature_)`. It is not: the witness is named for handler index 38 / parameter 0, i.e. the
**block-oracle handler** (`__updateBlockOracle(sig, uint32)`, the only `sig`-typed handler), and
`message-bus.ts:944-960` deliberately fills an unselected handler's signature array with
`inactiveSignatureRouteWitness` ("the handler is not selected in this envelope, so the route never indexes this
array"). `takeJob`'s second parameter is `bytes calldata signature_`, not `sig`, so it travels inside the row
blob; a probe on the kernel-row-loop witness assignment (`SOLIDC_DEBUG_SIG_WITNESS`, reverted) never fires for
this title, confirming it. Do not chase this witness again.

**Dead end 2 - requiring only the reached call site does not unblock it.** ROUND 48's experiment stands: the
covenant fails before exposing *any* ecrecover argument.

**What the failure looks like now.** The failing helper body is four instructions -
`nearby: [{ip:0, opcode:127 (OP_3DUP)}, {ip:1, opcode:119 (OP_NIP)}, {ip:2, opcode:1, data:'20'}]` - i.e.
`OP_3DUP OP_NIP <0x20> OP_SPLIT`: "select the second item from the top and split 32 bytes off it", and that item
is **empty** (`atomic-deferred-compute-no-progress`: `stack item length: 0; requested split index: 32`). The ring
immediately before it is an `OP_OUTPUTBYTECODE` (opcode 205) scan over **output indices around 458-469**, so the
empty operand is almost certainly a *frame blob read out of one of those outputs* rather than a route argument.

**The structural suspect.** `assemble` performs the deferred resolution *inside* the participant assembly and
throws `complete graph did not expose arguments for all deferred compute resources` when one round makes no
progress (`compose.ts:3571`), while the composer's claim loop - which is what materializes a nested returning
invocation such as `takeJob`'s `marketplaceData.eventsLength(jobId_)` result - only runs *after* `assemble`
returns (`compose.ts:3760-3800`). If the frame the helper parses is still a placeholder on that first pass, no
pass can ever fix it. Next measurement: in the deferred probe, print the commitments of the outputs in the
458-469 band (they should be the ecrecover sidecar frame outputs) and the `resultBlob`/`returnCommitment` the
composer handed the involved invocations; if those are placeholders while the nested read's claim is only
provisional, the fix is to let the deferred resolution retry across claim passes instead of throwing on the
first one.

### ROUND 50: the pass-ordering hypothesis is falsified too; the covenant's own split is the blocker

Three measurements and one experiment, all reverted.

**The deferred block, in aggregate coordinates.** `SOLIDC_DEBUG_DEFERRED_BAND=1` (probe reverted) prints, for
`take job`:

    blocks: [ { participant: 0, inputBase: 0, executionInput: 127,
                offsets: [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19],
                invocationReturns: [] } ]
    band 450..468: 450-461 `OP_1` placeholders (1000 sat), 462 `53434944…` (150 B, capability none),
                   463-467 five 76-byte `4c335631` ("L3V1") mutable frames - the participants' state outputs,
                   468 the P2PKH change.

So the sidecars occupy outputs 3..19 of participant 0's own block and participant 0 has **no returning
invocation**; the 76-byte frames the earlier ring saw scanned (`OP_OUTPUTBYTECODE` over ~458-469) are the *other
participants'* state outputs.

**The graph route has no external-return indices.** A probe over the route's inputs
(`SOLIDC_DEBUG_ECRECOVER_ARGS=1`, reverted) shows `__internal__externalReturnOutputIdx*`, `__internal__extcallMasterIdx*`,
`__internal__externalCallSelector*` and `__internal__extcallAnchorIdx*` are **not route inputs at all**; the route
resolves nested results from `__internal__graphSettlementTable` plus the callers/emissions tables, with
`__internal__activeVerifierIndex` = 463. Any hypothesis built on a `-1` return index is therefore wrong for the
graph path.

**What actually fails.** The stack at the failure carries `abi.encode(eventsLength, jobId_)` as **64 all-zero
bytes** (i.e. the route read `eventsLength` as 0), the 28-byte EIP-191 prefix above it, and the test's 65-byte
signature deeper in the frame; the failing helper is `OP_3DUP OP_NIP <0x20> OP_SPLIT` and its operand is
**empty** (`stack item length: 0; requested split index: 32`).

**Falsified: the composer's pass ordering.** Made `assemble` tolerant of an unresolved deferred controller during
the claim loop (`allowUnresolvedCompute`, recording the stalled participants) and strict again both when the
claims go stable and in the final straight-line path. With tolerance the build advanced past the deferred stall -
and failed at the final preflight on the *sidecar* input instead (`input 4: OP_SPLIT … requested split index:
128`, i.e. the placeholder sidecar covenant rejecting its own unwritten argument) - and the strict re-assembly at
stability still reported `complete graph did not expose arguments for all deferred compute resources`. So a
provisional nested-claim value is **not** what blocks the argument: even with settled claims the covenant never
exposes it. The change was reverted (inert for the ladder).

**Also falsified:** running the controller's probe with a faithful (non-sparse) trace
(`evaluateProbeTrace(..., forceFullDebug = true)`) - same error.

**Next measurement.** The route's own view of the two operands: inside the participant-local build (not the
aggregate), print (a) the value the route computed for the nested `eventsLength` read and (b) the length of the
signature it holds when it enters `ECDSA.recover`. The 64 zero bytes say the nested read produced 0 even in a
settled graph, which points at the *callee's* return frame as seen from the caller's block (the
`__internal__graphSettlementTable` coordinate) rather than at the deferred controller.

### ROUND 51: a caller-identity row no longer breaks the shared collection key (33/66)

`update job amounts` failed in the SDK's own batch encoder:

    MessageBusDiagnosticError: messageBus [L3_RESOURCE_UNRESOLVED]:
      message-bus batch collection witness '__message_bus_key__balances_0' has no shared physical entry orientation

**Root cause** (`message-bus.ts:583`, probed with `SOLIDC_DEBUG_KEY_ORIENTATION`, reverted). `swappableBases`
is the *union* over the artifact's handlers, so `_balances_0` is in it as soon as one handler binds it to a batch
argument (`transferFrom`: shared = `from`, row = `to`, both `swappable: true`). But the per-row candidate
collection required the *row's own* binding to be marked swappable, so a row whose shared binding is the caller
identity contributed nothing:

    invocations: [ { function: 'transfer', args: ['bytes:25:76a9147178…', '200000000000000000000'] } ]
    bindings:    [ { routeInput: '__message_bus_key__balances_0',     source: 'msgSender', inputIndex: -2, swappable: false },
                   { routeInput: '__message_bus_key__balances_0_row', source: 'argument',  inputIndex:  0, swappable: false } ]
    choices: []

A batch reaching only `transfer` therefore had no candidate at all and threw, even though the row derives its
key from the caller at run time and never consumes the shared route input.

**The fix** (commit `1308f87e2`): a row constrains the shared slot only when its binding for that base comes from
a batch argument; otherwise it is skipped and merely offers its row-local value as a fallback. A batch that no
row constrains falls back to the supplied witness (the caller identity the encoder already derives) or a
type-correct inactive value, and a constraining row still decides the value, so mixed batches are unchanged. The
regression test (`MessageBatchEncoding.test.ts`, `SWAPPABLE_BALANCE_SOURCE`) uses neutral `send`/`sendFrom` names
precisely because the shape, not the name, drives the binding.

**Ladder: 33 pass / 32 fail** (was 32/33), no lost titles, one new pass (`job updates > update job amounts`).
Root `yarn build` clean; SDK unit suite 4 failed / 722 passed (same four pre-existing names).

**Failure map now:** 15 deferred compute (`takeJob`), 4 state-derivation convergence ("Route probe convergence
repeated a physical transaction state"), 3 `index out of bounds` (`getUsers`/`getArbitrators` dynamic reads), 2
`Signer transaction nonce 16 is already reserved` (ladder-only artifact - the fixture does not reset the mock
signer nonce; `take job` alone reaches the deferred class instead), 2 meceTags collection-witness failures, 1
`should whitelist worker` (preflight input 3), 1 `reopen job before timeout` (preflight input 11), 1 `post two
jobs` (duplicate loop rows, ROUND 47c), 1 `refuse arbitration > job not taken` (`0n` vs `1n`).

### ROUND 52: a rolled call's parent array was split with the wrong codec (34/66)

ROUND 47c's duplicate rows were not a covenant problem. The read's own groups say:

    read-groups { functionName: '__forward', resultFunction: 'getJobs', blobBytes: 1856,
      groups: [ { fn: '__forward', logical: 'jobsLength', loopResultArrayOutput: undefined, precomputed: 32, returnOutputIndex: 11 },
                { fn: '__forward', logical: 'getJob',     loopResultArrayOutput: 0, hasResolver: true, precomputed: 896, returnOutputIndex: 12 } ] }

`getJob` carries the compiler's rolled-call marker (`loopResultArrayOutput: 0`) and a resolver, so the SDK is
supposed to resume one authenticated return per reached occurrence and splice them back into the parent array.
That splice decodes the parent array out of the provisional blob and re-encodes it in place - with the *native*
pushdata codec. For a Solidity-encoded parent (`evm-abi-v1`, `JobPost[]`) the decode step fails, the loop
`continue`s, no occurrence is ever resolved (`loop-return-resolve` never fires), and the graph keeps a single
callee invocation that every loop row reuses - hence `[A, A]`.

**The fix** (commit `47c914134`): decode the single-output parent's prefix with
`decodeEvmInvocationResultPrefix` and re-encode the resumed array with `encodeEvmInvocationResult` when the
parent result encoding is `evm-abi-v1`; the native path is unchanged. Regression coverage in
`packages/solidcash/test/unit/ExternalReturnEncoding.test.ts` (the prefix codec reports the decoded array *and*
its blob range, and re-encoding the resumed array reproduces the same bytes).

**Ladder: 34 pass / 31 fail** (was 33/32), no lost titles, one new pass (`job posting > post two jobs`). Root
`yarn build` clean; SDK unit suite 4 failed / 723 passed (same four pre-existing names).

### ROUND 53: two more classes measured (no commit)

**`getUsers`/`getArbitrators` (3 titles) - the key is an SDK-resolved expression.** The handler binding is

    { routeInput: '__message_bus_key_users_0', inputIndex: -1, source: 'expression',
      expressionLabel: 'map:userAddresses(binop:+(id:i,id:index_))' }

so the *user key itself* is `userAddresses[i + index_]`, and the artifact publishes only the label, not an
expression tree: the SDK must resolve the element from state and pass it as the route witness. The covenant
then reads the same array from its own state and reports the contract's own `require(index_ < usersLength_,
"index out of bounds")`, i.e. it sees `userAddresses.length` as 0 - so the state-array (dynamic chunk) view is
what disagrees, not the key witness. `SOLIDC_DEBUG_DYNAMIC_FRAME=1` prints nothing on this title (the failure is
upstream of the dynamic-frame code) and no `collection-entries-read` mentions `userAddresses`: the next
measurement is the read builder's dynamic-chunk input/base geometry for this handler - compare it with the
passing `registerUser` write, which materializes the same array.

**`refuse arbitration > job not taken` (1 title) - the entry value does not change.** The failure is
`arbitratorData.refusedCount` reading `0n` where the test expects `1n` (test line 3122). With
`SOLIDC_DEBUG_COLLECTION_FETCH=1` the `arbitrators` entry reads before and after the refusal show the *same*
value tail (`…72 000000 c2a8d2ff56802508ee018495941516441069e7ddcd8d1f9c96c3219591547617
1976a914c4ad89cd…87 21 02`) and differ only in the outpoint (`…:8` then `…:136`), so the refusal either updated
a different lane (the alternate entry) or did not change the count field at all. Next measurement: which entry
lane the refusal writes versus which one `arbitrators(address)` reads, using the entry-slot alternatives the
compiler publishes for that collection.

### ROUND 54: a delegated read never co-spent its dynamic-storage chunks (37/66)

ROUND 53's lead was right: the `userAddresses` array lives as **dynamic-storage chunks**, and the SDK gathers
them from the executing ABI's `dynamicReads` (`StatefulContract.ts:19751`). For a delegated read the executing
ABI is the forwarder, which publishes no dynamic-storage metadata at all, so no chunk inputs were co-spent, the
route's dynamic input base stayed absent, and the covenant saw an empty array - the contract's own
`require(index_ < usersLength_, "index out of bounds")`, or a read of input -1. A probe
(`SOLIDC_DEBUG_DYNAMIC_READ`, reverted) showed the shape exactly:

    dynamic-read-selection { functionName: '__forward', executing: '__forward', entry: 'getUsers',
      calls: [ { type: 'stateful', functionName: 'getUsers', route: undefined } ],
      dynamicReads: [], dynamicWriteNames: [] }

The entry ABI *is* the logical handler (`entry: 'getUsers'`) and publishes `dynamicReads: ['userAddresses']`; the
artifact confirms `getUsers.dynamicReads = ['userAddresses']`, `getArbitrators.dynamicReads =
['arbitratorAddresses']`, and that the route's own `dynamicReads` is the union of both.

**The fix** (commit `a74a6da53`): fill the reads in from the entry ABI when the executing ABI publishes none, and
add the entry ABI's writes to the read-modify-write skip set. The route's published union is deliberately not
used - co-spending a collection the row does not read would shift the compiled trailing band.

**Ladder: 37 pass / 28 fail** (was 34/31), no lost titles, three new passes: `register user > update user`,
`register arbitrator > register arbitrator`, `register arbitrator > update arbitrator`. Root `yarn build` clean;
SDK unit suite 4 failed / 723 passed (same four pre-existing names). No unit test accompanies this one: the
selection is inline builder orchestration, so the three focused titles plus the full ladder are the verification.

### ROUND 55: the preflight-failure class measured, and the convergence cycle-break falsified

Failure map at 37/66: 15 deferred compute (`takeJob`), 4 "Route probe convergence repeated a physical
transaction state" (`post job with invalid amount`, `close job after timeout`, `reopen job after timeout`,
`withdraw collateral`), 3 preflight `OP_VERIFY` at input 11/17/127 (`should whitelist worker`, `reopen job
before timeout`, `pay start job`), 2 meceTags collection witnesses, 2 ladder-only nonce stalls, 1
`post thread message > sanity checks` participant revert, 1 `refuse arbitration > job not taken` (`0n` vs `1n`).

**The preflight class.** `SOLIDC_DEBUG_FAILURE_POINT=1 SOLIDC_DEBUG_FAILURE_POINT_FULL=1` on
`reopen job before timeout` lands on input 11 = `MarketplaceDataV1 publishJobEvent`, failing inside a
1544-instruction program at ip 256. A temporary addition to the failure-point printer
(`SOLIDC_DEBUG_FAILURE_STACK=1`, reverted) dumps the full items, which are unambiguous:

    0: (empty)        1,2: '5800000460fb5565' (8 B)      3: '54001471782e81…' (249 B, the job-event frame)
    4: '38c1ef95…' (32 B)   5: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' (= SHA256(""))
    6: 'aa20c76e…87' (35 B lock)   7: '02'   8: the same 249-byte frame   9: the same lock

The covenant is comparing an event/journal value against the **empty** digest (`e3b0c442…`) while the SDK
materialized a populated event frame, so the class is "empty where the contract expects a value" in the event
path, not a geometry problem. Next measurement: which digest `e3b0c442…` belongs to (the empty-preimage sentinel
of a `data_`/`nextKey` field) and which of the two 249-byte frames the SDK wrote versus which one the covenant
recomputed - the 249-byte frames are byte-identical in this dump, so the mismatch is the value *hashed* next to
them.

**The convergence cycle-break is falsified.** Turning the repeated-fingerprint throw
(`StatefulContract.ts:13955`) into a `break` (guarded by `SOLIDC_STRICT_ROUTE_CONVERGENCE` for the experiment,
reverted) does not unblock `withdraw collateral`: the derivation then completes and the *final preflight* rejects
the non-converged entry at input 17 (`Program failed an OP_VERIFY operation`). So the cycle is a genuine
write/read disagreement about one entry - the earlier measurement showed output 10's expected tail alternating
between `…907b984f02ca30` and `…a0dec5adc93536`, i.e. two different amounts for the same entry - and the next
measurement is which pass *writes* that entry and which one *reads* it back with a different value.

### ROUND 56: the arbitrators entry and the `e3b0c442…` sentinel (no fix)

**`refuse arbitration > job not taken`.** `SOLIDC_DEBUG_COLLECTION_FETCH=1` dumps every prepared transaction; the
`arbitrators` outputs are mutable 128-byte entries whose commitment begins with the slot `41d0326f18316d0c…` - the
same slot the failing read looks at - so the *slot* is not the problem. The value after the slot is
`…00 72 000000 c2a8d2ff56802508ee018495941516441069e7ddcd8d1f9c96c3219591547617 1976a914c4ad89cd…87 21 02`,
identical before and after the refusal, so either the refusal never rewrote the count field or the SDK's write
went to the zero-slot twin (`0000…000041d0326f…`, 64 bytes, which also appears in the same transactions). Next
measurement: which of the two arbitrators entries the refusal's own transaction writes (the last prepared
transaction in the dump is a jobEvents-only one, so the dump needs to be indexed by transaction rather than
inspected at the tail).

**The preflight class' `e3b0c442…` is most likely a key slot, not an empty digest.** `e3b0c442…` is exactly the
slot this compiler derives for key zero (a VM-number zero hashes as an empty item - the same constant appears as
the `jobEvents[0]` slot in every job-events entry), so the failing comparison at input 11 is consistent with the
covenant checking an entry's key slot rather than comparing a value digest. The stack also holds
`38c1ef95…` (32 B) next to it, which is then the *value* digest of the populated event frame. Next measurement:
print the two operands of the failing `EQUALVERIFY` itself (not the stack tail) for `reopen job before timeout`
and pair it with the executor's `debug` requirement map, which names the source `require`.

### ROUND 57: the preflight class is a lock mismatch, not a digest mismatch

The failing instruction was printed directly (`SOLIDC_DEBUG_FAILURE_POINT=1` plus a temporary
`nearbyInstructions`/`topOperands` addition to the printer, reverted) for `reopen job before timeout`, input 11
(`MarketplaceDataV1 publishJobEvent`):

    ip 253: opcode 102 (OP_UNTIL)   254: opcode 117   255: opcode 136 (OP_EQUALVERIFY)   256: opcode 109
    top operands: 0: 'aa20c76e2793ab407f5be653fe3b9c97835454ccd50844d307f7195b68524821d95087' (35 B lock)
                  1: '02'   2: '5400147178…' (80 B)   3: the same 35-byte lock

So the equality that fails compares a **35-byte P2SH32 locking bytecode**, not the `e3b0c442…` slot: ROUND 56's
"key slot" reading was wrong, and the `e3b0c442…` item is just part of the surrounding frame. The class is
therefore "an input/output carries a different lock than the covenant expects", inside the
`publishJobEvent` event band. Next measurement: which of the two locks on the stack the SDK materialized (the
35-byte item is the *expected* side of an `OP_EQUALVERIFY`, per this file's convention the failing opcode is the
one at `ip`, so the two operands are the last two items the state pushed) and which output/input that lock belongs
to - `SOLIDC_DEBUG_FAILURE_POINT_FULL=1`'s `focus.inputs` already names the neighbours
(`DataNft_ee643a16 spend`, `MarketplaceDataV1 publishJobEvent`, two P2PKH inputs, `EntryNft_ee643a16 spend`).

### ROUND 58: the preflight class is a jobEvents value-chunk lock mismatch

`SOLIDC_DEBUG_COLLECTION_FETCH=1 SOLIDC_DEBUG_FAILURE_POINT=1` on `reopen job before timeout` prints the whole
failure context (the printer emits `focus.inputs`/`focus.outputs`, `routeParams` and `ipWindow` once the
collection-fetch switch is on). Facts:

* failing input 11 = `MarketplaceDataV1 publishJobEvent`; failing instruction `ip 255 = OP_EQUALVERIFY`
  (reported `ip 256`), comparing the 35-byte P2SH32 lock
  **`aa20c76e2793ab407f5be653fe3b9c97835454ccd50844d307f7195b68524821d95087`**;
* that lock occurs **nowhere** in the prepared transaction - it is the *covenant's expected* lock, not a lock the
  SDK wrote;
* the SDK's value-chunk output is index 17 with lock `aa20988cb8f2620a1663a40aecdfbe2a54e17c4646800ba944c7f47957dbd920d70487`
  and commitment `0000656174652061206d61726b6574706c61636520696e20736f6c6964697479…` - the jobEvents value
  chunk for the new value;
* the entry output 14 (slot `e3b0c442…`, i.e. key 0) carries value `…f9000000 38c1ef95…` where its *input* 14
  carries `…f1000000 …`: the recreated entry grew by 8 bytes, and `38c1ef95…` is the value digest the covenant
  hashes;
* `routeParams` publishes the SDK's own witness: `__internal__valueWitness_0` = the 249-byte value ending
  `…045efb5565570000045ffb5565`.

So the disagreement is the **jobEvents value**: the covenant computes a value whose chunk lock is `aa20c76e…`,
while the SDK materialized a chunk with lock `aa20988cb8…`. Because a chunk lock commits to
(category, collection, slot, root), the next measurement is a two-minute offline check: compute the chunk lock
for candidate values (the SDK witness as-is, and with the last event removed so the value matches the input
entry's 241 bytes) with `getValueChunkLockingBytecode(category, 'jobEvents', keyToSlot(0), sha256(candidate))` and
see which candidate reproduces `aa20c76e…` - that names the exact extra or missing bytes.

### ROUND 59: exact geometry of the failing OP_EQUALVERIFY (input 11, `reopen job before timeout`)

The failure-point dump truncates every hex item at 70 chars, but the lock is 35 bytes (70 chars), so the lock is
complete while the values are not. Stack at `ip 255 = OP_EQUALVERIFY` (reported `ip 256`, `opcode 109`):

    STK 5  = 241-byte OLD jobEvents value      (53001471782e8159...4caf2043...)
    STK 8  = 5800000460fb5565                  (the new event frame, 8 bytes)
    STK 10 = 249-byte NEW value (old + frame)  (54001471782e8159...4caf2043...)
    STK 11 = 32-byte NEW value root            (38c1ef95c3c7f1f52c2c87eca27b5ca36d2e37672c3439ad2c748e...)
    STK 12 = e3b0c442...b855                   (SHA256("") = the key-0 slot)
    STK 13 = aa20c76e2793ab407f5be653fe3b9c97835454ccd50844d307f7195b68524821d95087   <- covenant-computed
    STK 14 = 02, STK 15 = 249-byte NEW value, STK 16 = aa20c76e... (same pair computed a second time)

So the covenant derives `root = sha256(newValue)` and then the value-chunk locking bytecode for
`(category, slot = e3b0c442..., root)`, i.e. exactly `getValueChunkLockingBytecode(categoryId, 'jobEvents',
keyToSlot(0), root)`; it EQUALVERIFYs that against an output the SDK was supposed to materialize.

The SDK's only chunk-shaped output is index 17 - lock `aa20988cb8f2620a1663a40aecdfbe2a54e17c4646800ba944c7f47957dbd920d70487`,
commitment `0000` || `656174652061206d61726b6574706c61636520696e20736f6c6964697479a0b16a`
("eate a marketplace in solidity" + 3 bytes; only 33 data bytes, not a 120-byte chunk). `aa20c76e...` appears
nowhere in the prepared transaction.

Next measurement (probe already chosen): rerun the focused title with the SDK's own value-chunk tracing -
`SOLIDC_DEBUG_VALUE_CHUNKS=1 SOLIDC_DEBUG_VALUE_WITNESS=1 SOLIDC_DEBUG_CHUNK_LAYOUT=1 SOLIDC_DEBUG_CHUNK_GEOM=1`
- which prints the (collection, slot, root) the SDK *does* address chunks with. Two outcomes decide the fix:
(a) the SDK addresses the jobEvents chunk with a stale root (e.g. the pre-transaction root, or its own pushed
value instead of the covenant's recomputed one) -> the root/digest the SDK feeds into
`getValueChunkLockingBytecode` must come from the same derivation the covenant uses;
(b) the SDK emits no jobEvents value chunk at all for this write (only the dynamic-string chunk of the job
title, which is what output 17 looks like) -> the write path drops the value-chunk output for an event append.

### ROUND 60: the value-chunk pins were clobbered by a direct band rewrite (39 pass / 27 fail)

**Landed fix** (`f72fbaa98`): `packages/solidcash/src/stateful/StatefulTransactionBuilder.ts`, two writers of
`derivedChunkOutputs` now honour one invariant - *a provisional observation must never displace a
compiler-authenticated fixed pin at the same coordinate when the addresses disagree*:

1. `setDerivedChunkOutput` refuses a non-fixed observation over an existing `fixedIndex === true` observation
   with a different `lockingBytecode`;
2. the job-events band rewrite (`previousDerived` loop that deletes non-fixed entries and then re-sets every
   band index) skips an index whose `previousDerived` entry is `fixedIndex === true` with a different address.

Ladder: **39 pass / 27 fail** (was 37/28), no lost titles. New passes:
`job worker whitelisting > should whitelist worker`, `reopen job > reopen job before timeout`.

How it was localized (the measurements that mattered, in order):

* stack geometry (ROUND 59) proved the covenant EQUALVERIFYs the value-chunk P2SH32 of
  `(category, slot = e3b0c442..., root = sha256(newValue))` = `aa20c76e2793ab40...`;
* `SOLIDC_DEBUG_VALUE_CHUNKS=1` on the failing title prints `value-chunk-producer-*`,
  `nested-identity-scan` (with `identityLock`, `identityNNew`, `placed`, `fallbackBase`, `bandStart`),
  `finalize-reverse-suffix-jobs` and `dynamic-chunk-layout-mismatch`. The identity scan reports the *correct*
  lock - so the derivation was right and something later clobbered the pin;
* write-order probes on `setDerivedChunkOutput` (17/18) showed the identity path writing
  `aa20c76e... fixed=true`, and a stack-trace probe showed **every** write came from
  `_deriveFullTransactionState`, so the clobber was not another `setDerivedChunkOutput` caller;
* the clobber is the direct `this.derivedChunkOutputs.set(index, ...)` in the band rewrite
  (it deletes only *non-fixed* entries, then re-sets every band index with the provisional chunk whose
  `lockingBytecode` is the pre-update digest's address) - which is why the final map held the stale address as a
  **non-fixed** observation while the builder output kept the stale address too.

Two useful facts for the next round: the failing preflight for this class is thrown from
`_assertConvergedFinalTransaction` (called inside `build()`), *before* `send()`'s `reassertFinalLayout`
re-applies derived pins - so a stale pin must be fixed in the map, not patched on the final builder. And the
failing preflight dump (`message-bus-failure-point`) is the right oracle: it prints `focus.inputs`/`focus.outputs`
(contract/function/category/capability/commitment) plus `routeParams`, `ipWindow`, `invokeWindow`.

Remaining class after this fix: 27 titles. The deferred-compute class is still the largest (15 titles, `takeJob`),
followed by the convergence class (4), the two `meceTags` collection witnesses, the two ladder-only nonce stalls,
`post thread message > sanity checks`, and `refuse arbitration > job not taken`.

### ROUND 61: the 27 remaining titles by revert reason (largest class = deferred compute)

Reading the *revert reason* out of each failing title (the test harness prints `Revert reason: "..."` inside the
FAIL block, before the assertion) splits the 27 into four real classes - the "Expected transaction NOT to be
reverted" titles are NOT a cascade, they each revert with the deferred-compute message:

| class | count | titles |
| --- | --- | --- |
| `messageBus: complete graph did not expose arguments for all deferred compute resources` | 16 | `post thread message > sanity checks`, `deliver result > sanity checks`, `deliver result`, `approve result and review > sanity checks`, `approve result`, `refund > sanity checks`, `refund`, `dispute > sanity checks no arbitrator`, `dispute > sanity checks with arbitrator`, `dispute creator`, `dispute worker`, `arbitrate > sanity checks`, `arbitrate 80-20`, `arbitrate 0-100`, `arbitrate 100-0`, `refuse arbitration > job taken` |
| `Route probe convergence repeated a physical transaction state` | 4 | `post job with invalid amount`, `close job after timeout`, `reopen job after timeout`, `withdraw collateral` |
| nonce stall (`Signer transaction nonce N is already reserved`) | 2 | `take job`, `take job multiple` |
| single-title geometry/bookkeeping | 5 | `pay start job > sanity checks` (`participant 1 built 87/174 slots, expected balanced block size 87`), `pay start job` (preflight input 127), `post job with invalid mece tags` + `update job tags` (meceTags collection witness), `refuse arbitration > job not taken` (`refusedCount` 0 vs 1), `integration test` (600 s timeout, downstream) |

So the next round should stay on the deferred-compute message, which is one root cause behind 16 titles: the
graph route for a handler that consumes a deferred compute resource (ecrecover loop / keccak / blockhash) must
expose every deferred argument. `SOLIDC_DEBUG_ECRECOVER_DERIVE=1` plus `SOLIDC_DEBUG_FAILURE_POINT=1` is the pair
to use, and `MarketplaceV1.takeJob` remains the only ecrecover handler in the fixture. Note that running the two
`take job` titles alone reproduces the nonce stall (218 ms), so use full-ladder runs to judge the deferred class.

### ROUND 62: the doubled participant block is a local/absolute continuation-band confusion

`post thread message > sanity checks` fails (also in isolation, so it is not a cascade) with
`messageBus: participant 1 built 87/174 slots, expected balanced block size 87`. Measurements:

* `SOLIDC_DEBUG_ATOMIC_GRAPH=1` + the `atomic-local-block-mismatch` dump shows outputs `0..86` are the real block,
  `87..170` are OP_TRUE pads and `171..173` are three value-chunk outputs (lock `aa209cc7f6aa439c`,
  commitments `0000656174` / `01006bc75e` / `0200a87b87`), while `inputs` is 87 (last inputs: transported chunk
  slots at 83/84 with lock `aa20225e7569984d`, identity anchor at 86). So the block is correct and a *second*,
  absolute continuation run was appended to it.
* A probe at `localCall.build()` (compose.ts) proved `build()` itself returns `87/174` - the doubling happens
  inside the participant-local builder, not in compose.
* Probes on `_padOutputsToIndex` and on `setDerivedChunkOutput` (index > 86) never fire, so the writes come from
  the band materializer path.
* A probe inside `getChunkableValueWriteBand()` names the culprit line exactly: for the failing builder
  `convention === 'kernel-row-loop'`, `publishLlcIndex === 0`, `publishBlockSize === 85`,
  **`bases === [170, 170]`** (`= impl input index 85 + publishBlockSize 85`), `layoutStart = 170`,
  `band = { start: 170, end: 171, nNew: 2 }` while the local builder has only 86 inputs. The `captured` list is
  empty at band time, i.e. the captured `__internal__valueChunkOutputBase` witness has not been applied yet.

So the legacy single-contract formula `impl + blockSize` (bases are pushed at
`StatefulTransactionBuilder.getChunkableValueWriteBand()`, the `bases.push(impl + blockSize)` loop over delegate
low-level groups) is meaningless inside a kernel participant: there the writer's continuation outputs are the
participant's compiler-declared **trailing** slots (compose already selects them as
`participant.blockLayout.slots.filter(kind === 'trailing').slice(-transportedChunkCount)` = local offsets 82..84)
and the route witness `__internal__valueChunkOutputBase` is **absolute**
(`graph.layout.participantInputs[participant] + slot.offset`, e.g. 171 for participant 1 whose block starts at 89).

Next round's fix shape: for `messageBusConvention === 'kernel-row-loop'`, derive the continuation band from the
writer route's compiler-declared trailing slot offsets (or from the captured witness rebased by the participant
block base) instead of `impl + blockSize`; keep the absolute witness untouched for the covenant argument vector.
Verify with `post thread message > sanity checks` (isolated run is enough, ~60 s) and then the full ladder.

### ROUND 63: composed participants keep continuation placement local and claims absolute

Landed (ladder-neutral prerequisite, no lost titles): the composed participant's continuation geometry is split
into the two coordinate systems the composer actually uses.

* `StatefulTransactionBuilder` gained `composedParticipant`/`composedBlockBase` options (set from `_batchBuilder`'s
  `overrides.omitLocalFeeTail`/`blockBase`, i.e. by `AtomicMessageBusComposition`),
  `getComposedBlockBase()`, and a band rule: when composed, the value-chunk band start is the first of the last
  `valueChunkOutputCount`/`plannedWidth` compiler-declared `trailing` slots of the writer route (exactly the slots
  the composer selects), not the legacy `impl + blockSize` base.
* `_createBuilder` publishes the ABSOLUTE continuation base (`graphPublishedValueChunkOutputBase ??
  local band + blockBase`) into the group argument/`valueChunkWrites[].outputBase`, and
  `StatefulFunctionCall.build()` shifts the block-local derived pins by `getComposedBlockBase()` before publishing
  `__messageBusComputedValueChunks`.

Evidence/measurements: `post thread message > sanity checks` used to fail at `test.ts:2142` with
`participant 1 built 87/174 slots` (band computed as `impl 85 + publishBlockSize 85 = 170` while the participant
block is 87 slots and the composer's slots are 82..84 = absolute 211..213). After the change the same title fails
later, at `test.ts:2168`, with `complete graph did not expose arguments for all deferred compute resources`; the
full ladder stays at 39 pass / 27 fail with no lost titles, so the geometry class is closed but does not flip a
title on its own.

### ROUND 63b: the deferred-ecrecover resolver needs the composed coordinate mapping

`SOLIDC_DEBUG_ECRECOVER_DERIVE=1` (with the ROUND 63 geometry fix) prints for the failing title:

    deferred-ecrecover-no-argument {
      unresolvedAIndices: [[4,0],[6,1],[8,2],[10,3],[12,4],[14,5],[16,6],[18,7]],
      inputCount: 129,
      inputBytecodeReads: [ { index: 127, belowBytes: 0 }, { index: 467, belowBytes: 0 }, ... ] }

so the SDK's unresolved A-side indices are participant-LOCAL (4,6,...,18 in a 129-slot participant) while the
executing covenant reads its A side-car at `__internal__activeVerifierIndex + ecrecoverOffset` = 463 + 4 = **467**,
an absolute verifier coordinate that is not an index into the participant's own `allInputs`. `resolveDeferredEcrecoverArgument`
only rebases local->absolute through `inputBase` (`inputBase + findIndex(...)`), which cannot reach the verifier
region; the composer's `block.resolve(program, executionInput, block.inputBase)` therefore never progresses and the
graph throws. Next round: map the trace's A-side read back to the participant-local sidecar input (the composition
knows `activeVerifierIndex`/`graphSettlementTable`), i.e. reverse-map `absolute - (inputBase + verifierBase)` before
comparing with `unresolvedAIndices`, and check `resolveDeferredKeccakPreimage` for the same confusion.

### ROUND 64: the deferred-compute stall is the composed executor input failing at ip 1

Measured on `deliver result` (both titles) and `post thread message > sanity checks`, with the ROUND 63
geometry fix in place:

* keccak resolves fine (`deferred-keccak-learned` 8, zero extract misses) - this class is ecrecover.
* `deferred-ecrecover-learned` 2 of 8 sites; the rest never learn, and the composer then reports
  `atomic-deferred-compute-no-progress { executionInput: 127, inputBase: 0, states: 951,
  error: 'OP_SPLIT ... stack item length: 0; requested split index: 32', ip: 1 }`.
* `executionInput 127` is participant 0's published executor slot: `atomicMessageBusPhysicalLayout` puts one
  verifier per participant after the participant blocks, and `compose.ts` selects
  `inputBase + participant.executorOffset` where `executorOffset` is the `lowLevelCall` slot of the delegated
  participant layout. A probe on that site prints participant 0 as
  `{executorOffset: 127, blockSize: 129, executorLock: 'aa20260e28787b12...'}` and participant 1 as
  `{executorOffset: 85, blockSize: 87, executorLock: 'aa208e08f12f204d...'}` (the impl covenant address).
* The trace for that input dies at `ip: 1` on `OP_SPLIT 32` with a zero-length item, i.e. the implementation
  covenant executes against an EMPTY unlocking stack: the executor input carries an impl locking bytecode but a
  stub/placeholder unlocker. Two of the observed executor outpoints look synthetic
  (`46d52a29bb77:127`, `7fac03652e66:127` - vout equal to the slot offset) next to the real-looking
  `0d428c6528f8:3`, so the aggregate is being fed the probe-local placeholder copy of the executor input whose
  unlocker never became the real delegated invocation.

A second probe immediately before the deferred-compute loop (`deferred-eval-inputs`, on `deliver result`) shows
the evaluated executor input is NOT a placeholder in the resolving pass: participant 0 resolves to
`{absolute: 127, lock: 'aa20260e28787b12...', category: '142ee8b0de81...', capability: 'minting',
commitmentBytes: 0, satoshis: 1200, params: 18, offsets: [3..19]}` - the real delegate master with its invocation
unlocker and all 17 published ecrecover side-car offsets. So the stub copies (`txid:127`) are probe-build
artifacts, and the stall is not a missing executor UTXO: the implemented input runs its delegated invocation but
the trace dies at `ip 1` on `OP_SPLIT 32` over a zero-length item while the stack holds 35-byte P2SH32 values and
empty items, i.e. a covenant script (entry/anchor shaped) executes without its expected category/commitment item.

Next round: instrument that terminal trace (its `instructions`/frame and the 35-byte stack items) to identify which
covenant is running at `executionInput 127` and which push is empty - the ecrecover side-car A/B inputs the resolver
looks for sit at block-local offsets 4..19 (`offsets` above), so either the invocation is passing the wrong frame
to the implementation or the evaluated input index is the block's *identity* slot rather than its executor. - i.e. ensure `local.inputs[executorOffset]` is the authenticated impl
master UTXO with its invocation unlocker, not the local placeholder; the ecrecover resolver then sees the
`OP_INPUTBYTECODE` reads it expects (its sidecars sit at the same block-local offsets 4..19, which is why the
`unresolvedAIndices` keys are local while the covenant addresses them absolutely).

### ROUND 65: the premature-throw hypothesis is FALSIFIED; the stall is an output scan

Tested and reverted (tree stays at `888142361`): turning `assemble()`'s "no progress" throw into a pending signal
(`deferredComputePending`, refused only on a stable graph) so the claim loop could learn the missing nested returns
and rebuild before the compute resolution is judged. Result on `deliver result`: the composition now runs its full
claim loop (6 resolve attempts instead of 1) and still ends with the *stable-graph* variant of the same error
`... did not expose arguments for all deferred compute resources (participant(s) 0)`, and the controller's own
diagnostic is byte-identical: `executionInput 127, inputBase 0, states 951, ip 1,
'OP_SPLIT ... stack item length: 0; requested split index: 32'`. So the missing nested invocation results are not
what blocks the resolution - the executed transcript itself never reaches the compute call.

What the transcript does instead (from the `ring` of the same diagnostic): a tight **output scan loop** -
`ip 247 opcode 205 (OP_OUTPUTBYTECODE)` repeated with the index on top incrementing `ca01, cb01, cc01, ... cf01`,
then `ip 255 opcode 209 (OP_OUTPUTTOKENCOMMITMENT)` - before the OP_SPLIT-over-empty failure. Note the scan
`ip` values 247/255 are *outside* participant 0's 129-slot block, i.e. the script is walking an aggregate
coordinate space, which is consistent with a composed participant scanning past its own block (the scan bound and
the read coordinate come from different witnesses).

Also identified (useful for the next trace read): the terminal 5-instruction frame is invoke body 18 of
MarketplaceDataV1 = `7f7701207f75` (OP_3DUP OP_NIP <32> OP_3DUP OP_VERIFY) and its sourceMap span
`192:24:192:54` = `marketplace.getJob(i + index_)`. The same bytecode appears in 13 fixture artifacts at
*unrelated* spans (`_timestamps[id] = ...`, `symbol: ... ? ...`, `shares,`), so it is a **generic compiler
outline** (a value store/decode shape), not evidence about `getJob` - do not read it as a nested-return problem.

Follow-up measurement (aggregate tail at the deferred stage, participant count 5, 469 inputs/outputs):

    450..461  lock '51' (OP_TRUE pads), no token, empty commitment      <- tail of participant 4's block
    462       SID token, category 2c62df0f77, capability none, 75-byte commitment
    463..467   the five VERIFIER outputs, capability mutable, 38-byte commitments '4c3356310000...' (L3V1 + digest)
    468       fee change

and the trace's scan counter on the stack runs `ca01, cb01, cc01, cd01, ce01, cf01` = output indices
**458, 459, 460, 461, 462, 463** while executing `OP_OUTPUTBYTECODE` (ip 247) and `OP_OUTPUTTOKENCOMMITMENT`
(ip 255). So the script walks forward from 458 to the verifier output at 463 and, at the OP_TRUE pads (no token),
`OP_OUTPUTTOKENCOMMITMENT` yields an EMPTY item - which is exactly the `OP_SPLIT 32` over a zero-length item that
kills the trace. `verifierInputs[0]` is 463, so the scan endpoint is the participant's own verifier coordinate,
but its start (458) lands inside the *previous* participant's padded block tail instead of this participant's own
band.

Next round: find which witness supplies that scan base (candidates: `__internal__activeVerifierIndex` arithmetic
in the generated route, `__internal__graphBlockSize`/`fixedSize`, `__internal__graphSettlementTable`) and make the
scan range block-local - the same local/absolute split ROUND 63 fixed for the continuation band. A fast oracle is
the tail dump above: after the fix, output indices 450..461 must no longer be scanned by participant 0's route.

### ROUND 66: the failing body is `__message_bus_verify_atomic`

Identified the frame that runs the output scan (no code change; tree at `a9b7cbf60`):

* `MarketplaceDataV1.debug.invokeDebug` is keyed by invoke id and named per generated body. The terminal 5-instruction
  frame is id 18 (the generic outline), but the *scan* frame (trace ips 247/255, 943 states) is
  **id 71 `__message_bus_verify_atomic`**, 319 instructions / 386 bytes - the only body with that instruction count.
* Decoding that body (id 71, instruction offsets are byte offsets) around those ips gives a
  commitment-digest accumulator shape: `... OP_RIGHT OP_NIP <0x21> OP_NUMEQUAL OP_ELSE OP_0 OP_ENDIF OP_IF
  <0x4e> OP_1ADD OP_CAT OP_NIP OP_2 OP_PICK OP_XOR OP_ELSE OP_0 OP_ENDIF OP_IF OP_PICK ...
  OP_CAT OP_DROP <0x20> ...`, i.e. it folds a sequence of 32-byte commitments with `OP_CAT`/`OP_XOR` while walking
  an index (`OP_1ADD`). Together with the ring's `OP_OUTPUTBYTECODE`/token-commitment reads and the counter walking
  458 -> 463, this is the atomic verifier digesting the composed layout's commitments.
* Caveat for whoever continues: **opcodes are BCH-2026 renumbered** (205 = OP_OUTPUTBYTECODE, 210 =
  OP_OUTPUTTOKENCOMMITMENT per the SDK's `Op`), so a decoder using the pre-2026 table (as I used) mislabels
  0xcd/0xce/0xcf/0xd0. Map through `Op` from the SDK's libauth before drawing conclusions from raw bytes.
* Also ruled out as the *cause* of the "empty item": the digest region itself carries non-empty commitments
  (verifier outputs 463..467 are 38-byte `4c3356310000...`), so the empty item comes from an output the loop
  reaches that has no token at all - the OP_TRUE pads at 450..461 in participant 4's block tail.

Measured the witnesses the body receives (5-participant pass, the failing one) with a probe on
`graphRouteContext`:

    participantInputs [0,129,216,304,385]   verifierInputs [463,464,465,466,467]   verifierLast 467
    participant 0: activeVerifierIndex 463, fixedSize 129, maximumSize 129, actualSize 129,
                   returnOffset 65535 (the "no return" sentinel), settlementBoundary 12
    completions [129,87,88,81,78]  =>  block ends 128, 216, 304, 385, 462   derivedLimit 462

The scan the trace walks is exactly the tail of the LAST participant block: outputs 458..462 = participant 4's
block end (462 = SID token; 450..461 are OP_TRUE pads, so 458..461 have no token at all). In a standalone layout
those five outputs before the verifier region are the participant's settlement/receipt outputs, and the verifier
digest loop reads their commitments - in the composed layout they are another participant's padding, so
`OP_OUTPUTTOKENCOMMITMENT` returns an empty item and the following `OP_SPLIT 32` fails.

Next round (targeted, cheap): in the failing pass, dump the arguments this body receives
(`__internal__activeVerifierIndex`, `__internal__graphFixedSize`, `__internal__graphBlockSize`,
`__internal__graphSettlementTable`, `__internal__graphCompletionPositions`) plus the stack at the loop setup
(trace ip where `OP_1ADD` first runs), and compute the loop's base/limit arithmetically from those witnesses. That
names the witness that must become block-local (or the composer value that must change), instead of guessing from
the bytecode.

### ROUND 67: the verifier digest loop is `OP_TXOUTPUTCOUNT`-bounded and needs token-bearing pairs

Decoded `__message_bus_verify_atomic` (MarketplaceDataV1 invokeDebug id 71, 319 instructions) **by instruction
index** (libauth's `ip` is an instruction index, not a byte offset - an earlier byte-offset decode mislabelled the
region) with the BCH-2026 opcode table verified from
`@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js`
(`202 = OP_INPUTBYTECODE, 205 = OP_OUTPUTBYTECODE, 206 = OP_UTXOTOKENCATEGORY, 207 = OP_UTXOTOKENCOMMITMENT,
209 = OP_OUTPUTTOKENCATEGORY, 210 = OP_OUTPUTTOKENCOMMITMENT, 211 = OP_OUTPUTTOKENAMOUNT`):

    idx 244  OP_TXOUTPUTCOUNT      <- loop limit
    idx 245  OP_LESSTHAN           <- counter < TXOUTPUTCOUNT
    idx 246  OP_IF
    idx 247  OP_0 OP_PICK OP_OUTPUTBYTECODE   (205)
    idx 250  OP_3 OP_PICK OP_UTXOBYTECODE
    idx 253  OP_XOR
    idx 254  OP_IF
    idx 255  OP_0 OP_PICK OP_OUTPUTTOKENCATEGORY (209)
    idx 258  OP_3 OP_PICK OP_UTXOTOKENCATEGORY   (206)
    idx 261  OP_XOR
    ... (OP_CAT / OP_SPLIT 32 over the accumulated digest follows)

So the body walks outputs paired 1:1 with inputs and accumulates `output XOR input` bytecodes/categories into a
32-byte digest. A token-less pair (the OP_TRUE pads used to balance participant blocks: aggregate outputs 450..461
are `51` with no token) XORs two empty items into an **empty accumulator**, and the following `OP_SPLIT 32` over a
zero-length item is exactly the failure the trace dies with. The ring's counter values (`ca01..cf01` = 458..463)
are in that padded tail, i.e. the loop is running over participant 4's block tail rather than the participant's own
tokenized settlement range.

Fix direction for the next round (two candidates, decide by the counter's start witness):
(a) the composer must not leave token-less pads inside the range the verifier digests - e.g. bind the pads to
token-bearing counterpart slots, or keep the participant's verified window `[blockEnd - settlementBoundary,
blockEnd)` free of pads; or
(b) the loop's start coordinate is a witness that must be block-local (same class as ROUND 63), so participant 0's
digest runs over its own window instead of the last participant's tail.
Cheap oracle for either: dump the counter's *initial* value and the witness it came from on the first iteration
(trace states of the 315-instruction frame with ip == the OP_TXOUTPUTCOUNT site), then check whether outputs
450..461 disappear from the digest input.

### ROUND 68: the digest loop really walks every output, through the change output

Traced the counter itself (probe printing the first state of every `ip 247` visit in the 315-instruction body, on
`deliver result`):

* the loop body runs **469 visits** with the stack carrying `d501` (=469, `OP_TXOUTPUTCOUNT`) and `81` (=1);
* the visits start at counter `00, 01, 02, 03, 04, 05, ...` (shallow depth 4, the first pass over the whole
  transaction) and the *last* six are `cf01, d001, d101, d201, d301, d401` = **463, 464, 465, 466, 467, 468**
  with depth 53 and a 32-byte digest accumulator (`3e0898a59579c5f6f2e6db6b855bcbaf...`) on the stack;
* 468 is the composer's **fee change output**, which is token-less (`to: changeAddress` via
  `addBchChangeOutputIfNeeded`), and 463..467 are the five verifier outputs. So the digest pairs output i with
  input i for `i` in `[0, OP_TXOUTPUTCOUNT)` - including the fee/change pair and every OP_TRUE pad in every
  participant block - and the pair that contributes nothing (empty XOR empty) leaves the accumulator empty for the
  following `OP_SPLIT 32` (the ROUND 67 mechanism).

Next measurement (cheap, decisive): run the same tail dump on a **passing** kernel title (e.g. `post two jobs`)
and compare its last outputs with the failing one's `... 447..468` tail - specifically whether the change output
exists, whether it carries a token, and whether the digest loop's last counter stops at the change. That decides
between "the composer must not put a token-less change inside the digested range" and "the loop bound/start is a
witness that must be block-local".

### ROUND 68b: the "token-less tail" theory is FALSIFIED by a passing title

Ran the same aggregate-tail dump on the **passing** `post two jobs` composition (3 participants [129,87,88],
`totalSlots` 308, `verifierInputs` [304,305,306], `feeInput` 307):

    302  OP_TRUE pad, no token, 1000 sats
    303  SID token, capability none, 75-byte commitment
    304..306  the three verifier outputs (mutable, 38-byte commitments)
    307  change output, token-less, 200751333 sats   <- last output, index = feeInput

That is byte-for-byte the same *shape* as the failing `deliver result` tail (pads, SID, verifier outputs, then a
token-less change as the last output at `feeInput`). So the verify-atomic digest loop demonstrably copes with
token-less pads and a token-less change, and ROUND 67's "empty accumulator from a token-less pair" is NOT the
discriminator. Two theories are now falsified (ROUND 65 premature throw, ROUND 68 token-less tail); what actually
differs between the two compositions is the **pass state**: the failing one runs with 5 participants and
provisional claims (its first `graphRouteContext` dump even shows `returnOffset 65535` for participant 0, the
"no return" sentinel), i.e. the digest input is a manifest that the trace cannot reproduce yet.

Next round: diff the *manifest/claims* between a passing pass and the failing pass instead of the physical layout -
in particular whether the failing pass's verifier commitments are placeholders (the composer's own
`admit()` guard, 'mutable resources changed after semantic-manifest convergence', is the same family), and use
`SOLIDC_DEBUG_GRAPH_RESULTS=1`/`SOLIDC_DEBUG_ATOMIC_GRAPH=1` to compare `graph.callManifest.rows` of a passing vs
failing assembly.

### ROUND 69: one call object is one logical transaction (nonce-stall class fixed)

**Landed fix** (`StatefulContract.StatefulFunctionCall.send`): the call object memoizes its in-flight logical
transaction, so a second send started while the first is still in flight observes that transaction instead of
reserving a second logical nonce. A settled send is not cached (a new transaction still needs a new call object).
This is a general SDK invariant - one call object IS one transaction - with no application-specific behaviour; it
matters to every contract whose calls are evaluated more than once by a caller or an assertion helper.

Diagnosis (probe logging `reserve`/`commit`/`release` with call stacks in `Signer`):

    nonce-reserve 2  HDSigner.reserveTransactionNonce<StatefulFunctionCall.send<Assertion.revertedWith<...
    nonce-conflict 2 HDSigner.reserveTransactionNonce<StatefulFunctionCall.send<Assertion.revertedWith<Promise.p.withArgs<...

`packages/testing/src/chai.ts`'s `revertedWith` fast path calls `this.actual.send()`, and
`revertedWithCustomError(...).withArgs(...)` re-runs `revertedWith` on the *same* actual, so the same call object
was sent twice concurrently: the first reservation was still in flight (never committed or released, because both
sends raced) and the second tripped `Signer`'s "nonce is already reserved" guard. Repro: `-t 'take job'` in
isolation failed in 218 ms before any transaction was attempted; nonce 17 in the full ladder.

Effect (ladder 39 pass / 27 fail, **no lost titles**, so this is a prerequisite rather than a flip): both
`take job` titles now perform their transaction - `take job > take job` fails with the deferred-compute error
(the 16-title class ROUNDS 62-68 are working on) and `take job multiple` with a harness event-assertion
`TypeError: Cannot read properties of undefined (reading 'to')` at `marketplace.test.ts:2038`. SDK unit gate
unchanged (4 pre-existing failures / 723 passed); handoff audit clean.

### ROUND 69b: next kernel step for the deferred-compute class (keep it general)

With the nonce class gone, `take job > take job` reports the deferred-compute error directly, so the class can now
be driven from the cheapest reproducer (`-t 'take job'`, ~1 min) instead of the 5-participant `deliver result`.

The composer's own contract for this mechanism (`compose.ts`, `assemble`): the first semantic pass carries
*placeholder sidecars* on purpose, "the route verifier stops before the compute call and no complete-graph argument
can be observed", and only blocks "whose sidecar slots are already present in the authenticated manifest" are
resolved; "the ordinary effect pass below will add them and rebuild this assembly". Our readiness dump confirms the
kind-6 rows ARE present (`{participant: 0, offset: 3..19}`) while the trace still dies inside
`__message_bus_verify_atomic` before reaching the compute call - i.e. what is present is the *row declaration*,
not necessarily a *committed endpoint*.

General next step (kernel, no application names): make the deferred-compute readiness condition require the
sidecar pair the verifier will digest - the input endpoint in the aggregate *and* the output commitment the
manifest claims for that row - rather than the row's presence alone; when the endpoint is still a placeholder, the
assembly must be rebuilt from the effect pass instead of being judged unresolvable. Concretely: dump, in the
failing pass, `aggregate.inputs[absolute]`/`aggregate.outputs[absolute]` for each `offset` in
`block.offsets` and compare them with `graph.callManifest.rows.filter(kind === 6)` for that owner/offset; if they
disagree, the readiness filter (or the pass ordering) is the fix, not the resolver. This keeps the change inside
the composition contract that already documents this behaviour, so it applies to every deferred-compute consumer
(ecrecover, keccak, and any future sidecar resource), not just the marketplace fixture.

### ROUND 70: the sidecar endpoint mismatch is measured (readiness must compare, not just find rows)

Probe on the readiness site (`-t 'take job'`, the 1-minute reproducer) comparing, for every `block.offsets`
entry, the aggregate's physical slot with the authenticated kind-6 manifest row:

* 18 assemblies carry deferred blocks; only **9** of them have kind-6 rows at all - in the other half
  `resolvableDeferredBlocks` is empty and no resolution is attempted (so the ROUND 65/66 "premature throw" reading
  was doubly wrong: the throw only fires in the passes that *do* have rows);
* in a row-bearing pass, offset 3 (mode 1 = keccakSideCar) declares
  `argsHex = 613f0de0...b72a31ab` + `01` (category + **1-byte input commitment** `01`) and
  `effectHex = a086010000000000` + `c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`
  (= 100000 sats + `keccak256("")`), while the aggregate slot holds
  `input: {category: ab312ab7... (= the row's category byte-reversed, so consistent), commitment: ''}` and
  `output: {commitment: c5d2460186f7... (= the declared keccak256("") - consistent)}`.

So the *output* endpoint already matches its manifest claim, but the *input* endpoint is the placeholder
(empty commitment) while the manifest declares `01`: the participant block's sidecar input is a placeholder whose
commitment was never filled from the authenticated row. The verifier digests input/output pairs, so it fails before
the compute call and the resolver never sees an argument - and the composer then reports "did not expose
arguments" although nothing was actually unresolvable.

The same log shows the deeper pattern - the sidecar slot **oscillates across the 18 assemblies** (offset 3,
participant 0): passes 0,2,4,... carry **no** kind-6 row while passes 1,3,5,... do, and the row's declared
category changes between row-bearing passes (`56662108...`, `c2923911...`, `9313e2ff...` (stable for several
passes), `613f0de0...`) while the aggregate's sidecar **input commitment is always empty** and its output
commitment is always `c5d2460186...` (= keccak256("")). Within one pass the row's category and the aggregate
slot's category agree modulo byte order (`ab312ab7...` reversed = `...b72a31ab`, the row's suffix), so the
mismatch is not a byte-order bug - the physical stand-in sidecar itself is regenerated with a fresh identity
between passes, so the authenticated manifest can never match the slots the verifier digests, and the verifier
rejects the assembly before the compute call on every pass.

That points at the kernel rule to implement (general, deterministic): while a compute resource is unresolved, the
stand-in sidecar UTXO placed at its slot must have a **stable identity derived from the resource** (category,
outpoint, commitment), so the provisional manifest endpoint equals the physical endpoint the verifier digests; only
once the resolver learns the argument may the real endpoint appear. Candidate sites: the atomic plan's sidecar
UTXO sourcing and `probeMixedKeccakLayout`'s `standIn` (`tag.repeat(32)` txid + `pool[0]` category) in
`TransactionBuilder`, and whatever fabricates the ecrecover/keccak sidecars for `preparedAtomicCalls` - it is the
one that currently hands out a different category (and an empty commitment) per pass.

General fix direction (kernel contract, no application names): make the deferred-compute readiness condition
compare the physical slot against the row it is resolved for - input locking bytecode/category/commitment from
`argsHex`, output value/commitment from `effectHex` - and, when they disagree, either fill the aggregate slot from
the authenticated row (the manifest is the authority the verifier will digest) or return the assembly as "not
ready yet" so the caller rebuilds, instead of judging it unresolvable. That applies to every sidecar resource
(keccak mode 1, ecrecover mode 2, blockhash mode 0), not just the marketplace fixture.

### ROUND 71: deterministic compute side-car stand-ins (identity oscillation fixed)

**Landed fix** (`StatefulContract`): a compute side-car that a mock provider has not been provisioned with now gets
a **deterministic identity** derived from the resource - `sha256(domain || branded lock || slot index)` for the
outpoint and the token category - instead of `randomUtxo()`. The helper (`computeSideCarStandIn`) is generic
(keccak side-car at `_resolveKeccakComputeCoSpends`, ecrecover A/B at `_resolveEcrecoverComputeCoSpends`) and
provisioning is idempotent by outpoint, so repeated derivation passes reuse the same physical side-car. Real
networks never take this path (they require explicitly deployed side-cars).

Measured effect on the `-t 'take job'` reproducer (endpoint probe across the 18 assemblies of one build):

* before: the row's declared category changed on every row-bearing pass (`56662108...`, `c2923911...`,
  `9313e2ff...`, `613f0de0...`) and the physical slot never matched the authenticated manifest;
* after: `rowArgs` category is identical in **all 18 passes**, and it equals the aggregate slot's category modulo
  the VM byte order (`rowCat` reversed == `inCat`), with the row's trailing `01` being the mutable-capability
  suffix (not an input commitment) and the output commitment matching the declared `keccak256("")`;
* the trace error moves from `OP_SPLIT ... stack item length: 0` at `ip 1` (the digest abort) to
  `Program failed an OP_VERIFY operation.` at **`ip 424`** of the same body - i.e. the verifier now digests the
  sidecars and gets 423 instructions further before its next refusal.

Ladder: 39 pass / 27 fail, no lost titles (the remaining refusal is a later `require` inside the route, not the
sidecar mismatch). SDK unit gate unchanged.

### ROUND 72: cherry-picked `ecea6158a` (solidhat offline runtime)

Landed as `8cf709692` = `ecea6158a` minus one environment artifact (see below). The pick brings the general
SolidHat runtime pieces: `mock-contracts` (local contract models with ethers-shaped handles), `offline-network` /
`offline-ipfs` / `offline-rpc` / `offline-setup`, `project-fixture`, `ported-script`, `cashaddr`, the README, and a
`packages/testing/src/chai.ts` change. That chai change is the **harness-side counterpart of ROUND 69**: `withArgs`
now awaits the assertion it belongs to instead of re-running `revertedWith` (which used to issue a second
`send()` on the same call object), and it verifies argument tuples for locally modelled contracts while keeping the
lenient pass-through for compiled covenants. Both fixes are now in the tree and compose.

Two environment repairs were needed to build/test this worktree at all (neither is a source change):

* the worktree had **no local `node_modules`**, so `solidcash`/`@solidcash/utils` resolved up to the main checkout's
  stale declarations - the pick's build invalidation surfaced phantom errors (`AbiFunction.directMappingReturn`,
  `StatefulTransactionBuilder.clearPersistedJobEvents`). Fixed with `yarn install --ignore-scripts` in the worktree
  (creates workspace links pointing at this worktree's packages). The toolchain also declares `@noble/hashes`
  (`^1.4.0`, resolved 1.8.0) for solidhat.
* the pick carried a tracked `node_modules` **symlink** pointing at another worktree
  (`/Code/cashscript/.worktrees/solidhat-marketplace-something/node_modules`); it is dropped from the landed commit
  (`.gitignore` already ignores `node_modules/`, so nothing else changes).
* 90 stale untracked compiled copies (`*.js`, `*.d.ts`, `*.js.map`, dated Sep 10) under `packages/solidhat/src`,
  `packages/solidhat/test` and `packages/testing/test` were removed: vitest resolved `../src/vitest-preset.js` to a
  stale sibling instead of the `.ts` source, and discovered each compiled test twice.

Verification: `yarn build` green; `@solidcash/solidhat` 69 passed / 1 skipped (9 files, includes the pick's new
suites); `@solidcash/testing` 4 failed / 58 passed where all 4 are `incremental-compile.e2e` compiler-spawn
failures that **also fail with the pre-pick `chai.ts`** (checked by restoring that file: same 4); marketplace
ladder **39 pass / 27 fail, no new, no lost** and zero `nonce ... already reserved` errors.

### ROUND 73: the post-stand-in blocker is takeJob's whitelist require

After ROUND 71 the `take job` trace fails later, and the new failure is now identified exactly. The diagnostic's
`ip: 424` (reported one past the failing instruction, as usual) belongs to a frame whose opcode signature
(indices 404..423 = `OP_INVOKE x6, OP_NUMEQUAL, OP_IF OP_1 OP_ELSE OP_2SWAP OP_PICK OP_ENDIF OP_VERIFY`) matches
**exactly one** body in the whole fixture set: `MarketplaceV1` invokeDebug id 59
**`__message_bus_entry_takeJob`** (5073 instructions), whose `sourceMap[423]` is `680:8:684:10`. That source is:

    require(
        job.whitelistWorkers == false ||
            whitelistWorkers[jobId_][msg.sender],
        "not whitelisted"
    );

So the composition probe's execution of `takeJob` dies on the **whitelist read**, long before the
`keccak256`/`ecrecover` digest it is supposed to expose. Supporting facts:

* the fixture publishes the job with `whitelisted: [user2.address]` by default, so the read must be true for
  `msg.sender == user2`;
* the same nested mapping reads correctly through the SDK view path - `should whitelist worker` (passing) asserts
  `marketplace.whitelistWorkers(jobId, addr) === true` after `updateJobWhitelist`, and the collection fetch log
  shows both chained entries present (`key 0x00..00 -> slot bac4afa3...`, `slot bac4afa3... -> 0x..01`);
* `take job > sanity checks` (passing) only asserts the *rejecting* outcomes ("not whitelisted" for user4,
  `whitelistWorkers == false` variants), so an always-false in-covenant read is consistent with it passing.

Next round: compare the inner key the covenant derives for `whitelistWorkers[jobId_][msg.sender]` with the key the
SDK wrote (`bac4afa31b5925f59e163c5993bc34d46d99ab4307fe5e59569dcfec21113727`), inside the composed
proxy+delegate context. If the covenant derives a different caller key (for example the proxy identity instead of
`tx.origin`), that is the bug - and it is a general kernel/`msg.sender` witness issue, not a marketplace one.
Cheapest probe: dump the read key from the failing trace (the entry read is preceded by the executed route's
`OP_INVOKE`s at ip 404..414), or run `take job > sanity checks`'s third block (the `whitelisted: false` job, where
the read must be false) and the `should whitelist worker` view read side by side.

### ROUND 74: the whitelist entry exists with value `01`; the key scheme is not what I guessed

Decoded the fetched whitelist collection from the ROUND 73 fetch log (`-t 'take job'`,
`SOLIDC_DEBUG_COLLECTION_FETCH=1`), using the entry layout from
`SortedList.encodeEntryCommitment(slot, nextKey, value) = slot(32) || nextKey(32) || value`:

    entry A: 64 bytes  0000...0000 (slot = head sentinel) || bac4afa3...13727 (nextKey) || (no value)
    entry B: 65 bytes  bac4afa3...13727 (slot)            || 0000...0000 (nextKey) || 01

So the nested key `whitelistWorkers[jobId=0][user2]` really is materialized, its stored value is `01` (true), and
the sorted-list head points at it. The data is present; the in-covenant read misses it.

`SortedList.keyToSlotMulti(keys) = mask(sha256(sha256(k0) ++ sha256(k1)))` with the top bit of the last byte cleared,
documented as "matching the covenant's emitSortedKeyHash" - i.e. both sides are supposed to derive the same slot.
I tried to reproduce `bac4afa3...` offline from the default test mnemonic (`test test ... junk`, user2 = the third
`ethers.getSigners()` entry) across signer indices 0..9 and several key encodings (20-byte pkh, reversed pkh,
25-byte P2PKH locking bytecode and its reverse, 32-byte left-padded pkh) crossed with jobId encodings (32 zero
bytes, one zero byte, empty) and both hash schemes (each key hashed, or both raw) - **no combination matches**, so
the runtime key inputs differ from every guess (a per-collection salt, an ABI-encoded key, or a different signer
mapping in the harness are all still open).

Next round (do not guess again): probe the SDK write path to capture the exact key inputs - log inside
`keyToSlotMulti` (or at its call sites in the sorted-list write path) for the `whitelistWorkers` collection during
`-t 'take job'`, then compare those bytes with the slot the covenant computes. The two facts to establish are (a)
which bytes the SDK feeds for the address key and the jobId key, and (b) whether the covenant's `msg.sender`
derive feeds the same bytes in the composed proxy+delegate context. The ROUND 73 signature match
(`__message_bus_entry_takeJob`, require at source 680-684) remains the oracle for whether the read passes.

### ROUND 75: the SDK's whitelist key bytes are captured

Probed `keyToSlotMulti` directly (temporary `SOLIDC_DEBUG_KEY_SLOT` logging of its inputs, output and call stack)
during `-t 'take job'`. The slot that holds the whitelist value is produced by exactly one call:

    key-slot-multi-in  keys = ["", "76a91447d9fe52d462741f418e9dd5efaa6ae7e7adb60088ac"]
                       frames = ["slotForKey", "StatefulContract._createBuilder", ...]
    key-slot-multi-out bac4afa31b5925f59e163c5993bc34d46d99ab4307fe5e59569dcfec21113727

so the SDK's nested-mapping key is `(jobId 0 encoded as an EMPTY byte vector, the caller's 25-byte P2PKH locking
bytecode)`, hashed per `keyToSlotMulti` (each key sha256'd, concatenated, sha256'd again, top bit of the last byte
cleared). That is the same slot the on-chain entry uses (ROUND 74: value `01`, head sentinel points at it), and it
is why my ROUND 74 offline guesses failed: I never combined the *empty* jobId encoding with the *locking bytecode*
form of the address, and the harness signer whose pkh is `47d9fe52...` is not among the first ten derived from the
default mnemonic.

Also tried to dump the same hash from the *covenant* side by scanning the failing trace for the sha256 outline
invoke (states whose next instruction is `OP_INVOKE` with the id byte `0xa8` pushed before it). The scan found zero
samples in all 10 no-progress attempts, so the trace's frame/instruction representation for outlined helpers is not
what that probe assumed - the next attempt should locate the read through the artifact's `debug.functionDebug` /
require mapping (the round-73 body is `__message_bus_entry_takeJob`, id 59) rather than pattern-matching opcodes.

Next round: with the SDK key known (`[empty, 25-byte locking bytecode]`), find the ip of the entry read inside
`__message_bus_entry_takeJob` (via its `sourceMap`: the require is at 680:8..684:10, so the read precedes it) and
dump that ip's stack from the trace - the two 32-byte hashes or the raw key bytes it feeds to the hash helper will
show whether the covenant derived a different caller identity (for example a 32-byte category instead of the
25-byte locking bytecode) in the composed proxy+delegate context.

### ROUND 76: the failing composition has no input owned by the caller

Probed the composed aggregate at the deferred-compute site (`SOLIDC_DEBUG_ENTRY_COUNTS=1`) for the whitelist entry
and for the caller's funding input:

* the whitelist entry itself is fine: the failing 5-participant composition (469 inputs) **co-spends it at input
  20 and recreates it at output 20** (`bac4afa3...` found in both), so the read is not blocked by a missing entry;
  the 3-participant passes show it only at outputs 63/64 (the `updateJobWhitelist` write) - also expected;
* but `callerAt: []` - the caller's locking bytecode `76a91447d9fe52d462741f418e9dd5efaa6ae7e7adb60088ac`
  (ROUND 75's SDK key input, i.e. the whitelisted `user2`) appears at **no input** of that aggregate, and the first
  non-token input is index 21 with `76a914470bf077d5619f3424774ab30b3fcb2c3a89ea7088ac` (a different P2PKH account).

Since the platform defines `msg.sender` as `tx.origin` for direct calls and `tx.origin` as the first P2PKH
(non-token) input, the covenant's `whitelistWorkers[jobId_][msg.sender]` lookup is keyed by an account that never
took the job - which is exactly the "not whitelisted" require failure ROUND 73 localized at source 680-684.

Before treating that as the root cause, one fact still has to be pinned down: whether `470bf077...` is another
harness signer (funding the fee tail while `user2` pays nothing) or whether the *caller* of this composed
transaction is genuinely a different account than the one the fixture whitelisted. Next round: at the same compose
site, enumerate the provider's signers (`aggregate.provider.getSigners?.(10)`) and print their addresses next to
that first P2PKH input - then either (a) the fee/funding input selection must prefer the caller's UTXO (general
composer fix: the caller's funding input must stay the first non-token input so `tx.origin` keeps naming it), or
(b) the caller identity must be supplied to the route as an authenticated witness instead of being re-derived from
`tx.origin` (the kernel already does this for delegate rows via `__internal__msgSenderCategory`).

### ROUND 77: composed transactions are funded by the caller, not merely the signer

**Landed change** (`StatefulFunctionCall._sendWithoutLogicalNonce`, composed branch): the atomic composition's fee
funder is now the **logical-nonce signer** (`connect(caller)` binds it to the account that initiated the call) with
the signing `_signer` as fallback, and both signers' UTXO snapshots are invalidated afterwards. Rationale is the
measured ROUND 76/77 behaviour: the fee input is the transaction's first P2PKH input, the platform derives
`tx.origin` - and with it `msg.sender` for a direct call - from that input, so funding only from the signing key
silently renames the caller whenever the two differ, and every `msg.sender`-keyed state read then misses.

Measurements behind it (probe at the deferred-compute site, `SOLIDC_DEBUG_ENTRY_COUNTS=1`, `-t 'take job'`):

* failing composition (469 inputs, `feeInput 468`): the fee funder IS the account of the first P2PKH input
  (`76a914470bf077d5619f3424774ab30b3fcb2c3a89ea7088ac`, outpoint `7ae41a32d55a:11`), and the whitelisted
  caller's locking bytecode `76a91447d9fe52d462741f418e9dd5efaa6ae7e7adb60088ac` (ROUND 75's SDK key) appears at
  **no input** - so `tx.origin` named the funder, not the caller;
* the passing 308-input compositions use `76a91471782e8159...88ac` as funder and first P2PKH (64) - a different
  account again, i.e. the funder choice is not the caller in general;
* the whitelist entry itself is present and correct in both (co-spent at input 20 in the 469-input case).

Ladder after the change: **39 pass / 27 fail, no new, no lost** - the change is behaviour-neutral when the two
signers coincide (the common case) and only reroutes funding when they differ. `take job` still stops at the
deferred-compute error, so the caller/funder mismatch is necessary but not sufficient for that title; the remaining
question from ROUND 76 (whether the fixture's `user2` is the whitelisted `47d9fe52...` account or the funder
`470bf077...`) is still open and is the next thing to settle.

**Testing rule for the following rounds (from the operator):** do not run the whole 66-title ladder for
measurement. Run only the title under work plus its two neighbours (`-t '<title>'` plus the adjacent describes), and
reserve a full ladder run for the moment a previously failing title turns green.

### ROUND 78: funder/caller diagnostics and a falsified wrapper hypothesis

**Landed:** an env-gated diagnostic in the composed funding path - `SOLIDC_DEBUG_FUNDER_PLAN=1` prints
`composed-funder-plan` with the caller's locking bytecode, the chosen fee outpoint/satoshis and whether the
logical-nonce and physical signers agree. General, zero behaviour change, and it makes the ROUND 76/77
caller-vs-funder question answerable in one focused run instead of by probing three subsystems.

Measurements this round (focused runs only, per the operator's rule):

* **falsified**: the hypothesis that the harness's `withEthersMessageSigning` wrapper is not a `Signer` instance
  (which would make `connect(user)` fall back to a stale signer). It mutates and returns the *same* `Signer`
  (`packages/testing/src/hre.ts:237`), so `connect(user2)` does bind user2, and the probe confirms
  `logicalMatchesPhysical: true` at funding time.
* the composed funding for the failing `take job` transaction uses caller lock
  `76a914470bf077d5619f3424774ab30b3fcb2c3a89ea7088ac` (outpoint `7ae41a32d55a:11`) - the same account as that
  aggregate's first P2PKH input, so `tx.origin` and the funder do agree there;
* across the same title the *callers* are several distinct accounts, and both `470bf077...` and `47d9fe52...`
  (ROUND 75's whitelist-key account) appear as callers for different composed transactions. That makes ROUND 74/75's
  single fetched whitelist entry (`bac4afa3...`, value `01`) inconclusive: it may belong to another job/fixture run
  in the same test rather than to the read that fails, so the "no entry for the taker" reading is not established.

Next round: with the new diagnostic, run the failing title and match `composed-funder-plan`'s caller lock against
the *take* call under test (the one whose `takeJob` is expected to succeed), then check that account's whitelist
entry directly (fetch the collection and match `keyToSlotMulti([<jobId>, <that lock>])`) instead of relying on the
single-entry observation. Only then decide between a read-key mismatch and a wrong-caller/funder mismatch.

### ROUND 79: the takeJob composition IS funded by the whitelisted caller (funder theory closed)

Extended the ROUND 78 diagnostic to name the logical calls each composed send performs (the prepared atomic calls'
`logicalFunctionName ?? functionName ?? selectorHex`), then re-ran `-t 'take job'` with
`SOLIDC_DEBUG_FUNDER_PLAN=1`. Result:

    caller 47d9fe52d462741f418e9d  fee f10cdd1971ee:11  calls ['takeJob', 'userRegistered', 'eventsLength',
                                                          'publishJobEvent', 'approve', 'getArbitratorFee', 'pay', ...]
    caller 71782e8159265ed94bd35b  fee d168b77edf26:11  calls ['publishJobPost', 'arbitratorRegistered', ...]

So the **takeJob sends are funded by `47d9fe52...`**, which is exactly the account whose whitelist entry exists
(`ROUND 75`: `bac4afa3... = keyToSlotMulti([jobId 0, 76a91447d9fe52...88ac])`, stored value `01`), while the
`publishJobPost` sends (the fixture, as user1) are funded by `71782e81...`. The caller/funder mismatch theory from
ROUNDS 76-78 is therefore **closed**: `tx.origin`, the funder and the whitelisted worker all agree for this call.

That also re-reads two earlier observations: the "entry co-spent at input 20" aggregate (469 inputs) was the
*5-participant publish* transaction - where the entry is created - not the takeJob one. What remains is whether the
*takeJob* composition co-spends the whitelist entry at all (the SDK fetches it: `allCount 2, matchedCount 2`, but
fetching is not co-spending), i.e. a read-planning gap for a `msg.sender`-keyed nested read.

Landed this round: the diagnostic extension above (composed sends now report the logical calls they perform),
env-gated, no behaviour change.

Next round: run the failing takeJob composition with a probe that matches the *whitelist entry NFT* by commitment
against `aggregate.inputs` (the entry's commitment is `bac4afa3...13727 || 0000...0000 || 01`), now that the right
transaction is identified by its call list. If the entry is absent from the takeJob aggregate, the fix belongs in
the kernel read planning (the row must co-spend the entry it reads); if it is present, the read itself is at fault.

### ROUND 80: the compiler declares the msg.sender-keyed read; the composition does not co-spend it

Probed the *failing* composition directly (inside the resolve loop's `!progressed` branch, so it is the stall, not
a neighbour). Across `-t 'take job'`:

    8x  calls ['takeJob','userRegistered','eventsLength','publishJobEvent']  219 inputs  whitelistEntryInputs []
    2x  calls ['takeJob',...,'approve','getArbitratorFee','pay','balanceOf'] 469 inputs  whitelistEntryInputs [20]

So the dominant failing shape is the small (219-input) takeJob composition and it does **not** co-spend the
whitelist entry at all (12 entry-like inputs, none of them `bac4afa3...`), while the larger takeJob shape does
(input 20).

Metadata check (artifact, no run): `MarketplaceV1.takeJob` declares exactly the read -

    entryAccesses: [{ slotIndex 0, collection 'whitelistWorkers',
                      keyParams ['jobId_', 'sender:msg.sender'],
                      keySources [{kind:'param',paramName:'jobId_'}, {kind:'msgSender',senderOp:'msg.sender'}],
                      operations ['read'] }]

and the SDK already knows how to resolve that key (`StatefulContract` ~18982:
`keyValues.push(addressToLockScript(this._signer.getAddress()))`, plus the forced sender-P2PKH funder at ~31184).
The entry is also fetched (`allCount 2, matchedCount 2`). What is missing is the **co-spend**: the read-only
`msg.sender`-keyed access is resolved and fetched but not placed as an input of the participant block, so the
covenant cannot read it.

Landed this round: the `deferred-stall-composition` probe (env-gated, `SOLIDC_DEBUG_ENTRY_COUNTS=1`) which prints
the failing composition's logical calls, input count and whitelist-entry co-spend state - the measurement that
pinned the shape above; diagnostics only, no behaviour change.

Next round: make the participant's read-only `msg.sender`-keyed entry access materialise as a co-spent entry NFT
input (the same mechanism that already co-spends entry NFTs for write rows), then re-check that this composition's
`whitelistEntryInputs` is non-empty.

### ROUND 81: sender-key resolution unified (co-spend gap persists)

**Landed:** the `keySources` entry of kind `msgSender` now resolves the sender through the same lookup the
expression-keyed branch uses (`this._signer ?? this._logicalNonceSigner`). A composed participant is built from a
contract instance that may carry only the logical-nonce signer (the account that initiated the call), so the old
code either threw or keyed the entry by an account that never calls the contract; both branches now agree.
Behaviour-safe: the previous code threw in exactly the case the fallback now handles.

Focused verification (`-t 'take job'`, stall probe on): sanity still passes, the two real titles still fail, and
the failing composition is unchanged - `whitelistEntryInputs: []` for the dominant 219-input takeJob shape, `[20]`
for the 469-input one. So the *key resolution* branch was not what withholds the co-spend: the read-only
`msg.sender`-keyed access is still resolved and fetched (`allCount 2, matchedCount 2`) without its entry NFT being
placed in the participant block.

Next round: instrument the entry-access loop itself (it fetches `collectionEntriesFor(signature)`, then for
`sorted` collections builds a `SortedList` and co-spends "the exact entry if present, else the bracketing
predecessor"). Print, per access, the resolved `keyValues`, the selected entry's slot and whether the predecessor
fallback was taken. That separates "key not found" from "entry selected but not placed" - the two remaining
explanations for the missing co-spend - before touching the placement code.

### ROUND 82: the read plan resolves the correct slot as ABSENT (predecessor co-spent)

Instrumented the entry-access loop's read-only branch (`entryNfts.push` for `sorted` collections) and ran
`-t 'take job'` with `SOLIDC_DEBUG_ENTRY_COUNTS=1`. For the whitelist collection the plan is computed 51 times and
the *correct* sender (`...aa6ae7e7adb60088ac` = `47d9fe52...`, ROUND 79's whitelisted caller) resolves to slot
`bac4afa31b5925f59e163c5993bc34d46d99ab43...` in **both** states:

    present False  entry 000000000000000000000000000000000000...   (bracketing predecessor)
    present True   entry bac4afa31b5925f59e163c5993bc34d46d99...   (the real entry)

So the mechanism is now exact: when `present` is false, the SDK co-spends the sorted list's **predecessor** (an
empty entry), the covenant's read therefore returns the absent/false value, and `require(job.whitelistWorkers ==
false || whitelistWorkers[jobId_][msg.sender], "not whitelisted")` fails - which is precisely the stall ROUND 73
localized at source 680-684. Other slots in the same log (`bbe40417...`, `849a4c3f...`, `1549f589...`,
`ffde089c...`) are absent for other senders, as expected.

Since the entry demonstrably exists on chain (ROUND 74/79: value `01`, fetched with `allCount 2, matchedCount 2`),
a `present: false` for it means the collection-entry list used by that pass did not contain it - i.e. a stale
snapshot/ordering problem in the entry fetch, not a key or placement bug.

Landed this round: the `entry-read-plan` probe (env-gated) that prints collection, slot, `present`, the selected
entry's commitment and the sender - diagnostics only.

Next round: find why `collectionEntriesFor(signature)` can miss an entry that exists - check whether the fetch
caches UTXOs (provider snapshot invalidation happens for signers via `invalidateSignerUtxos`; collection entries may
need the same refresh after a composed write), and whether the *provisional* passes run before the publish's
outputs are indexed. The oracle is the probe: after the fix, the correct sender's slot must read `present: true` in
the pass that raises the stall.

### ROUND 83: the absent slot comes from a collection list that holds only its HEAD

Extended the ROUND 82 probe with the sorted list's size and re-ran `-t 'take job'`:

    slot bac4afa31b5925f59e16  present False  listSize 1  headOnly True   entry 0000...
    slot bac4afa31b5925f59e16  present True   listSize 2  headOnly False  entry bac4afa31b5925f59e163c59...
    slot bbe4041794f2eccd9757  present False  listSize 2  headOnly False  entry 0000...   (other sender, absent)

For the correct sender's slot, `present: false` is exactly `listSize === 1`: the sorted list built from
`collectionEntriesFor(signature)` contained **only the HEAD sentinel**, so the entry really was not in the fetched
set for that pass - the read plan is not dropping it (`SortedList.fromUtxos` only skips commitments shorter than
`SLOT_BYTES * 4` = 64 bytes, and this entry is 65 bytes, i.e. fine). The same slot reads `present: true` with
`listSize 2` in other passes of the same run, so the entry is visible to some builds and not to others - an
ordering/visibility difference between builds, not a key, parse, or placement bug.

Landed this round: the probe now reports `listSize`/`headOnly` beside `present`, which is what separated those
cases.

Next round: at the stall, compare the *cached* list with a **fresh** `provider.getUtxos(getEntryNftAddress(...))`
count taken at the same moment. If the fresh fetch already returns 2, the stale data is a provider/SDK-side cache
(`collEntryCache` is per-build, so the suspect is the provider's own UTXO view or a per-instance snapshot) and the
fix is to refresh entry collections the way `invalidateSignerUtxos` refreshes signer UTXOs; if the fresh fetch also
returns 1, the composed publish's output genuinely is not visible yet and the fix belongs in the ordering (do not
finalise a composition whose reads depend on an output this same send created).

### ROUND 84: stale collection fetch confirmed and self-healed; the stall persists

Added a fresh-fetch column to the read-plan probe: at the moment a plan resolves the correct slot as absent
(`listSize 1`, head only), a **fresh** `provider.getUtxos(getEntryNftAddress(collection))` taken then returns
**2** entries. The chain/provider had the entry; the list had been built from an earlier fetch that did not - i.e.
the per-build collection fetch can precede a write this same test just performed.

**Landed fix:** `collectionEntriesFor(signature, { fresh: true })` re-fetches and replaces the cached list, and the
read-only branch uses it once when the key misses, before falling back to the bracketing predecessor. General and
self-healing: any stale first fetch is repaired at the point where it would otherwise produce an absent-value
proof; a genuinely absent key still uses its predecessor.

Focused `take job` after the fix: sanity still passes, the two real titles still fail, and the stall composition is
unchanged (`whitelistEntryInputs: []`, 219 inputs). So the staleness is real and now handled, but it is **not** what
blocks the stall: the `present: false` observations came from *other* builds in the same run, and the stalling
build's own read plan was never isolated from them.

Next round: tie the plan probe to the stalling build only - print `entry-read-plan` together with the composition
identity (prepared call list + input count) or gate it on the participant whose block is the stalling one - so the
stall's own plan (slot, presence, list size, sender) is read directly instead of inferred from a run-wide mix.

### ROUND 85: the stalling build's own whitelist plan is CORRECT (the read is not the stall)

Wired a monotonic builder-pass id (`builderBuildSequence`, exported as `peekBuilderBuildId()`) into both the
read-plan probe and the composer's `deferred-stall-composition`, so a stall can be tied to the plans of the build
that produced it instead of a run-wide mix. On `-t 'take job'`:

    stalls: 10, max lastBuildId 175
    whitelist plans with buildId >= 167:  build 171  slot bac4afa31b5925f5  present TRUE  listSize 2
                                          sender ...e7adb60088ac (= 47d9fe52..., the whitelisted caller)

So the stalling composition's own read plan resolves the whitelist entry **correctly** (present, list of 2, right
sender). Every `present: false` observation from ROUNDS 82-84 belonged to *other* builds - the caveat recorded then
is now confirmed, and the whitelist co-spend is **not** what blocks this stall.

That leaves the trace evidence from ROUND 73 (the same stall dies on `OP_VERIFY` at the require on source 680-684)
to be reconciled with a correct co-spend: the covenant must be deriving a different key than the plan used. The
key candidates are the plan's 25-byte P2PKH locking bytecode for the caller versus whatever the evaluated
aggregate's `tx.origin` resolves to - and the covenant derives `msg.sender` from `tx.origin`, i.e. the *first P2PKH
input of the transaction being evaluated*, which the plan does not control.

Next round: in the stalling pass, print the evaluated aggregate's first P2PKH locking bytecode and compare it with
the plan's sender (`...e7adb60088ac`); `composed-funder-plan` already gives the funded account, so a mismatch there
- not the entry list - is the remaining explanation for the failed require.

### ROUND 86: the title-blocking stall is the ip-1 OP_SPLIT, NOT the whitelist require

Extended the composer's stall probe with the aggregate's first P2PKH input (the `tx.origin` the covenant will
derive `msg.sender` from) and wired `buildId` into the controller's `atomic-deferred-compute-no-progress`
diagnostic, then ran `-t 'take job'` with `SOLIDC_DEBUG_ECRECOVER_DERIVE=1 SOLIDC_DEBUG_ENTRY_COUNTS=1`:

    build 40   ip 424  states 949  OP_VERIFY            firstP2pkh 76a914470bf077...  (non-whitelisted caller)
    build 67   ip 183  states 449  OP_VERIFY            firstP2pkh 76a91471782e81...
    build 74   ip 244  states 449  OP_VERIFY            firstP2pkh 76a914c4ad89cd...
    build 104  ip 121  states 449  OP_VERIFY            firstP2pkh 76a9149bf20ffc...
    build 140  ip 361  states 449  OP_VERIFY
    build 112  ip 1    states 451  OP_SPLIT 32 over 0    firstP2pkh 76a91447d9fe52...  (the whitelisted caller)
    build 119/126/133 ip 1 states 451 OP_SPLIT 32 over 0
    build 175  ip 1    states 951  OP_SPLIT 32 over 0    firstP2pkh 76a91447d9fe52...

Two conclusions, both decisive:

1. the whitelist chain (ROUNDS 73-85) was reading the **sanity** titles' compositions: their callers are not
   whitelisted, so their `require` legitimately fails (the varying `OP_VERIFY` ips); the whitelisted builds are
   different builds entirely;
2. the compositions the failing title actually needs (**112, 175**, `firstP2pkh = 76a91447d9fe52...`, the
   whitelisted caller, correct co-spend per ROUND 85) die with the *original* ROUND 64/67 signature:
   `OP_SPLIT ... stack item length: 0; requested split index: 32` at **ip 1** - the verifier/digest abort, not the
   whitelist read.

Landed this round: `buildId` in the controller diagnostic (so trace failures are attributable to a build) and the
aggregate's first P2PKH input in the stall probe; diagnostics only.

Next round: with the correlation in place, dump the failing state of build 112/175's trace (ip 1, 451/951 states) -
the terminal stack around the OP_SPLIT and the frame it belongs to - and finish the ROUND 67/68 digest analysis on
the *right* trace instead of a mixed one.

### ROUND 87: the whitelisted builds die inside the 5-instruction outline on a serialized output

Dumped the terminal state of the failing trace for the correlated (whitelisted) builds. All of 112/119/126/133/175
fail at `ip 1` in a **5-instruction frame**:

    program: ['127', '119', '1:20', '127', '117']   = OP_3DUP OP_NIP <0x20> OP_3DUP OP_VERIFY
    stack  : 13:''  12:225:'5100001976a91471782e8159265ed94bd35b8e699c08f53a6f38c688ac19...'  11..8:''

The 225-byte item is a **serialized transaction output** - `value(8) || 0x19 || 76a914<20-byte pkh>88ac`, i.e. a
25-byte P2PKH locking bytecode with its length prefix, for the change/funder account `71782e81...`. The frame is
the same generic outline ROUND 66 identified (`MarketplaceDataV1` invokeDebug id 18, sourceMap `192:24:192:54`,
bytecode `7f7701207f75`), which now clearly takes a serialized output and splits a 32-byte value out of it - and in
these builds the operand it splits is empty, which is the `OP_SPLIT ... stack item length: 0` failure.

So for the builds the failing title needs, the abort is a *digest/serialization* step over the aggregate's outputs
(the ROUND 67/68 area), not a state read - and it is now isolated to one frame with its input on the stack.

Landed this round: the `no-progress-terminal` diagnostic (env-gated) printing the failing frame's first eight
instructions, its instruction count and the top of its stack; diagnostics only.

Next round: walk back from that frame - print the last few states *before* the first state whose instruction count
is 5, i.e. the invoking site and its stack - to see which value the caller passed and why it is empty for these
builds while the same outline succeeds elsewhere. The comparison target is a build whose outline receives a full
32-byte item (any passing composition in the same run).

### ROUND 88: the aborted frame is reached from the ecrecover side-car path with the EIP-191 prefix

Dumped the states immediately before the first 5-instruction frame (build 112, the whitelisted caller):

    ip 247 frame 315   op 205 (output bytecode)     [d800, d800, da00, da00]      <- verifier digest scan
    ip 281 frame 315   op 210                       [d800, d800, db00, d800]
    ip 16  frame 17    op 136 (EQUALVERIFY) id 00   [27:190076a91447d9fe52..., 1:19, 1:00, 1:00]
    ip 437 frame 5073  op 202 (input bytecode)      [28:19457468657265756d205369676e6564204d657373616765...,
                                                     64:0000000000000000..., 1:02, 1:03]
    ip 2   frame 7     op 210                       ['', 01, 28:19457468657265756d205369676e6564204d657373616765..., 1:42]

`19457468657265756d205369676e6564204d657373616765` is the EIP-191 prefix
(`\x19Ethereum Signed Message:`), so the failing outline is reached from the **ecrecover side-car** path (the
takeJob digest), with a 64-byte item and `02`/`03` flags beside it - not from the verifier's output digest, which
is what the ROUND 87 terminal-stack reading suggested. The 225-byte "serialized output" is one of several pieces,
not the operand that came up empty.

This fits the placeholder story exactly: the fabricated side-car UTXOs carry an **empty commitment**
(`computeSideCarStandIn` sets `commitment: ''`, ROUND 71), so the side-car covenant's `OP_SPLIT 32` over its input
commitment runs on a zero-length item and aborts before the compute call is ever reached - which is also why the
deferred argument is never exposed.

Next round's first experiment: give the stand-in side-cars a well-formed placeholder commitment (32 bytes, e.g.
zeros or the SDK's placeholder preimage) instead of an empty one, then re-run and read the correlated trace: the
abort should move past the split, and the oracle stays `deferred-ecrecover-learned` / the stall composition's
`whitelistEntryInputs`.

### ROUND 89: a well-formed stand-in commitment is not the missing operand

**Landed:** `computeSideCarStandIn` now gives a fabricated compute side-car a well-formed placeholder commitment
(32 zero bytes) instead of an empty one - a covenant that splits a 32-byte chunk cannot run on an empty commitment,
and zeros are a placeholder the resolver replaces once it learns the real chunk. Mock-only path; real networks
deploy side-cars explicitly.

Focused `take job` after the change: unchanged - sanity passes, both real titles fail, `deferred-ecrecover-learned`
stays at 2, and the correlated stalls are identical (`build 112/119/126/133/175 ip 1`, `OP_SPLIT ... length: 0`,
plus the sanity builds' `OP_VERIFY`s). So the empty operand the outline splits does **not** come from the stand-in
commitment.

The entry states say where it does come from: the frame that invokes the outline is a **7-instruction frame** whose
stack at `ip 2` holds `['', 01, 28:19457468657265756d205369676e6564204d657373616765..., 1:42]` and whose opcode
there is `210` (2026 numbering: output-token commitment). In other words the frame reads an **output's token
commitment** and gets nothing, i.e. the output it reads is token-less for these builds - the side-car/continuation
output placeholder those builds place is missing its token, so the covenant cannot split a chunk out of it.

Next round: for a correlated stall build, dump the aggregate's outputs at the participant's side-car slots
(category, capability, commitment) and confirm whether they carry tokens; the oracle remains `ip 1` moving off
`OP_SPLIT` and `deferred-ecrecover-learned` rising above 2.

### ROUND 90: the side-car slots DO carry tokens (falsified), the frame is parsing a buffer

Added a `deferred-stall-sidecars` probe (env-gated) that prints, for the stalling composition, every
`ecrecoverSideCar`/`keccakSideCar` slot's input and output (category, capability, commitment size). Every correlated
stall build reports `tokenlessOutputs: 0` and well-formed slots, e.g. build 40/67/74/104:

    offset 3 keccakSideCar     in {cat 361eb80b9f, mutable, 32 B}  out {…, 64 B}
    offset 4 ecrecoverSideCar  in {cat 9e47d0fc96, mutable, 32 B}  out {…, 32 B}
    offset 5 ecrecoverSideCar  in {cat 5986b263aa, mutable, 32 B}  out {…, 34 B}

So the ROUND 89 hypothesis - a token-less side-car/continuation output - is **falsified**: the slots the covenant
reads are token-bearing with 32-byte commitments.

What the entry states actually show is a *buffer parse*: the 7-instruction frame's stack holds 2-byte counters
(`d800`, `db00`, ...) beside the 225-byte item, and it splits at index 32. Those look like offsets into a
serialized output/transaction buffer, with the split running off the end of the remaining slice - i.e. the buffer is
shorter than the parser expects, not missing a token.

Landed this round: the `deferred-stall-sidecars` probe (diagnostics only).

Next round: dump the **full buffer** the failing frame parses (the 225-byte item and its neighbours on the stack)
together with the 7 instructions it executes and the offsets it uses - then compare that buffer against the same
frame in a passing build of the same run. A shorter/truncated serialization is then directly visible.

### ROUND 91: the failing helper splits an output commitment that is one chunk short

Dumped the full programs and stacks of the two innermost frames of a correlated stall build (112) and resolved the
opcode numbers against the BCH-2026 table (`127 = OP_SPLIT`, `119 = OP_NIP`, `117 = OP_DROP`, `126 = OP_CAT`,
`83 = OP_3`, `147 = OP_ADD`, `138 = OP_INVOKE`, `210 = OP_OUTPUTTOKENCOMMITMENT`, `202 = OP_INPUTBYTECODE`):

    5-instruction frame: ['127','119','1:20','127','117']            = OP_SPLIT OP_NIP <0x20> OP_SPLIT OP_DROP
    7-instruction frame: ['83','147','210','1:20','1:7a','138','126'] = OP_3 OP_ADD OP_OUTPUTTOKENCOMMITMENT
                                                                        <0x20> <0x7a> OP_INVOKE OP_CAT

So the 7-instruction frame computes an output index (`3 + k`), reads that output's **token commitment**, pushes 32 and
an invoke id, and calls a helper that does `SPLIT NIP <32> SPLIT DROP` - i.e. it skips the first `index` bytes and
then requires **32 more bytes** to remain. The failure `OP_SPLIT ... stack item length: 0; requested split index: 32`
means the first split consumed the whole item: the helper was handed an output commitment that is exactly as long as
the offset it split at.

ROUND 90's slot table matches that reading: the side-car outputs are 32 or 34 bytes, and the 32-byte ones leave
nothing after the skip. So the helper expects the commitment to still carry a 32-byte chunk past the offset - the
*length* of the output commitment the SDK places is what is short, not its token.

Next round: identify the helper (the pushed id `0x7a` / body 18, sourceMap `192:24:192:54`) in
`MarketplaceDataV1`'s `invokeDebug` and read what layout it expects, then fix the commitment the SDK builds for
that side-car output (general: the side-car commitment layout, not a marketplace rule). Oracle: `ip 1` must stop
being the failure point in the correlated builds and `deferred-ecrecover-learned` must rise above 2.

### ROUND 92: the two dumped frames are NOT a nesting pair (correction)

Looked up the bodies in `MarketplaceDataV1.debug.invokeDebug`:

    id 18  'outlined source span 18'   bytecode 7f7701207f75  (6 B)  sourceMap 192:24:192:54
    id 122 'outlined source span 122'  bytecode ce01207f7c755288 (8 B) sourceMap 23:6:114:7:1

Decoded with the BCH-2026 table, id 122 is `OP_UTXOTOKENCATEGORY <32> OP_SPLIT OP_SWAP OP_DROP OP_2 OP_EQUAL` - the
standard "this input's token category carries the minting capability" check - and id 18 is
`OP_SPLIT OP_NIP <32> OP_SPLIT OP_DROP`. They are different outlines, and the pushed invoke id in the 7-instruction
frame (`0x7a` = 122) names the minting check, not body 18.

So the ROUND 91 pairing was wrong: frames of the same *size* occur in different *bodies*, and the "7-instruction
frame invokes the 5-instruction frame" reading - and with it the "output commitment is one chunk short"
conclusion - is **not established**. What survives is only this: some body of size 5 fails its second
`OP_SPLIT <32>` on a zero-length remainder, and the EIP-191 prefix plus the 64-byte item in the surrounding states
place it in the ecrecover path.

Landed this round: a probe that lists the trace's *frame entries* (states at `ip 0`) with each body's first six
instructions - which returned **no entries**, i.e. libauth does not record `ip === 0` states, so bodies must be
grouped by their `instructions` list identity rather than by size or first ip.

Next round: group the failing trace's states by their `instructions` array identity (or by length + first six
opcodes) and report, per body, the first and last ip reached - that identifies the body that actually fails and its
parent without assuming frames of equal size are the same body.

### ROUND 93: bodies grouped by identity; the failing body runs exactly one state

Grouped the failing trace's states by their `instructions` fingerprint (first six opcodes) for a correlated build:

    order 2  443 states  ips 3..281   '195,82,148,202,0,121'      <- the executing route/handler body
    order 0    2 states  ips 13..14   '121,118,206,1,127,124'
    order 3    1 state   ip 16        '127,119,1,126,129,118'
    order 4    1 state   ip 437       '2,138,1,121,79,138'
    order 5    1 state   ip 2         '83,147,210,1,1,138'        <- OP_3 ADD OUTPUTTOKENCOMMITMENT ... OP_INVOKE
    order 7    1 state   ip 1         '127,119,1,127,117'         <- FAILING body, entered and failed at ip 1

Two durable facts: the failing body runs exactly **one** state (so it is entered with a bad operand and dies on its
second instruction), and the body immediately before it in execution order is the 7-instruction
`OP_3 OP_ADD OP_OUTPUTTOKENCOMMITMENT <push> <push> OP_INVOKE`.

That last fact contradicts the ROUND 92 lookup again: the pushes before that `OP_INVOKE` are `0x20` and `0x7a`, so
the popped id should be 122 (`ce01207f7c755288` = 8 instructions), yet the body that actually executes has the
5-instruction fingerprint `127,119,1,127,117`. Either the id is not what names the body, or the trace's state order
does not reflect the invoke directly.

Next round: dump the parent state *immediately* before the failing body's single state, in full - its ip, its
complete stack (so the popped id is visible) and the two states after it - and reconcile the id-to-body mapping
against `invokeDebug` (matching the fingerprint to `bytecode` rather than trusting the id). That pins the invoking
site, which is the last missing link before the operand can be named.

### ROUND 94: the failing helper receives an EMPTY operand (an output read that returned nothing)

Dumped the states around the failing body's single state (build 112, `failingIndex 450`):

    at 447  ip 437  size 5073  '2:8d81 138 1:13 121 79 138 117 93'      top: 89:25:76a91447d9fe52...88ac
    at 448  ip 2    size 7     '83 147 210 1:20 1:7a 138 126'           top: 87:25:76a91447d9fe52...88ac
    at 449  ip -1   size 0     (frame boundary)                         7:8064:'4c33425553310000801f...'
    at 450  ip 1    size 5     '127 119 1:20 127 117'   top: 73:1:3f, 72:0:'', 71:1:81, 70:0:''

Three things are now certain:

* the 5073-body at ip 437 is the takeJob route entry (its stack still holds the caller's 25-byte P2PKH lock
  `76a91447d9fe52...88ac`);
* the 7-instruction body is about to execute `OP_OUTPUTTOKENCOMMITMENT` (opcode 210 at ip 2), i.e. it computes an
  output index (`3 + k`) and reads that **output's** token commitment;
* the failing 5-instruction body is then entered with an **empty item** beneath the split index (`72:0:''` under
  `73:1:3f`), which is why its `OP_SPLIT` runs on a zero-length item.

So ROUND 89's "token-less output read" was right in kind but at the wrong index: ROUND 90's slot dump only covered
the *side-car* slots, while this read targets whatever output index the 7-body computes. The frame boundary at 449
even carries the atomic envelope (`4c3342555331...` = PUSHDATA1 `BUS1...`), confirming this is the composed graph's
execution.

Next round: in the stall probe, print the aggregate's outputs for the first ~24 indices with their category /
capability / commitment size, and match the 7-body's computed index - a token-less output at that index is then the
whole story (and the fix is to place the token the covenant reads, or to stop the digest/read from covering a
token-less slot).

### ROUND 95: the scan runs one slot past the side-car band, onto a token-less output

Dumped the aggregate's first 24 outputs for a correlated stall build (112):

    idx 0   a3cef94467  minting  0 B        idx 3   361eb80b9f  mutable  64 B   keccakSideCar
    idx 1   a3cef94467  mutable  207 B      idx 4..19  9e47d0fc96/5986b263aa/... mutable 32/34 B  side-cars
    idx 2   a3cef94467  mutable  35 B       idx 20  (NO TOKEN)                    <-- the read that returns empty

Every slot 0..19 is token-bearing; **slot 20 is token-less**, and the 7-instruction body's
`OP_OUTPUTTOKENCOMMITMENT` reads `3 + k` - so its scan walks the side-car band 3..19 (17 slots) and then takes
one more step onto slot 20, gets an empty item, and hands it to the helper whose `OP_SPLIT 32` then fails.

That is the whole mechanism of the deferred-compute stall: the covenant's scan width covers one slot more than the
participant publishes as a token-bearing side-car, so the last read is empty and the compute call is never reached.

Next round (fix): make the composed participant's scanned side-car band carry tokens to the full width the covenant
walks - i.e. fill the inactive union slot(s) with the SDK's placeholder side-car (mutable NFT, well-formed
commitment, the participant's category) instead of a bare funder pad. The oracle is `ip 1` ceasing to be the
failure and `deferred-ecrecover-learned` rising above 2; the general rule is that any slot a compiled scan may read
must be materialised with the shape that scan expects, not left as a filler.

### ROUND 96: commitment-limit config verified (128 bytes, unchanged)

Operator check requested: confirm the maximum NFT commitment size is configured as 128 bytes and that it is not
being changed. Verified:

* the configs do **not** set it at all - neither `solidcash.config.js` nor `vitest.marketplace.config.js` contains a
  `commitmentLimit`, so the SDK default applies;
* the SDK default is **128** (`packages/solidcash/src/stateful/ContractFactory.ts:264` `commitmentLimit: 128`, and the
  baked `defaultProxyArtifact.ts` entries `"commitmentLimit": 128`);
* the `commitmentLimit: 10000000` values that appear under `.marketplace/artifacts/*` are **artifact metadata**
  (`stateLayout.commitmentLimit`) produced by the fixture's compile options, not configuration, and they are
  untouched;
* `git diff --name-only HEAD` contains no config, JSON, or artifact change - every change in this session is in
  `packages/solidcash/src/**` plus this handoff.

Design rule recorded for the pending side-car fix (ROUND 95): placeholder material must stay well inside the
128-byte commitment limit. The stand-ins introduced so far carry 32-byte commitments (ROUND 71/89), and the fix for
the token-less slot 20 must likewise emit a commitment of at most 128 bytes - a mutable NFT with a well-formed
short commitment, never a longer payload - and must not introduce or modify any configuration value.

### How to localize it next

Both questions this section used to carry are answered: ROUND 36 localized the input-214 failure to
`MarketplaceDataV1.sol:393` (a chunkable-value digest check) and ROUND 37 fixed it — the value witness was
being filled positionally, so it now keys by the entry-slot ordinal in its own ABI name. ROUND 38 carries
the next blocker (input 216: one batch entry output short) and names its one remaining measurement.

Reproduce any of it with `SOLIDC_DEBUG_FAILURE_POINT=1 SOLIDC_DEBUG_FAILURE_RING=1
SOLIDC_DEBUG_ROUTE_INPUT_INDEX=<n>`; add `SOLIDC_DEBUG_FAILURE_POINT_FULL=1` for every output's lock,
category, commitment length and head. `SOLIDC_DEBUG_VALUE_WITNESS=1` / `SOLIDC_DEBUG_VALUE_CHUNKS=1` print
the staged value witnesses (`chunkable-read-witness`, `delegate-value-witness-fill`), and
`SOLIDC_DEBUG_ATOMIC_GRAPH=1` / `SOLIDC_DEBUG_ATOMIC_PROMOTION=1` print the graph's rows and the discovered
node argument vectors. Do not trust the earlier `preflight-return-idx` lead for this class: that message
only records `__internal__returnOutputIdx` and is not where the equality fails.

### Unrelated: an unexplained concurrent edit

At 20:54 — after this round's last compose.ts edit at 20:35 — an uncalled helper
`transportedChunkableInsertValue` (31 added lines, never referenced) appeared in
`packages/solidcash/src/stateful/StatefulContract.ts`. It was not written by this
session; nothing in this round edits that file. It has been reverted to HEAD and the
SDK rebuilt. **If a parallel session is working in this worktree, its edits will land
on top of these commits — check `git status` before building.**

### ROUND 97: the deferred-compute stall reads a CONSECUTIVE BAND of aggregate OUTPUTS

Measurements (all from `-t 'take job'`, deterministic: stalls are builds 40/67/74/104/112/119/126/133/140/175):

1. `deferred-stall-band` (compose, gated by `SOLIDC_DEBUG_ENTRY_COUNTS=1`) shows participant 0's route layout:
   master(0), dataNft(1,2), `keccakSideCar`(3), `ecrecoverSideCar`(4..19, first four unconditional, the rest
   `conditional`), `entry`(20, slotIndex 0, conditional), `entry`(21, slotIndex 1), then 40 `event` slots (22..61),
   `returnEvent`(62), 64 `trailing` slots (63..126), `lowLevelCall`(127), `identityAnchor`(128). Route frame:
   `sites 8, ecrecoverWidth 2, ecrecoverOffset 4, eventWidth 5, eventOffset 22`.
2. `deferred-stall-io` (compose) shows the aggregate's token table: inputs/outputs 0..20 are token-bearing and
   MIRRORED 1:1 (including output 20 = the entry NFT, category = participant category, 64-byte commitment);
   outputs 21+ are token-less funder pads (`lock 51`), while input 21 is the caller's P2PKH funding input.
3. The failing bytecode is `outlined source span -381` of `MarketplaceV1`
   (`5393d20120017a8a7e` = `OP_3 OP_ADD OP_OUTPUTTOKENCOMMITMENT <push 32> <invoke helper 122> OP_CAT`,
   helper 122 = `7f7701207f75` = `OP_SPLIT OP_NIP <32> OP_SPLIT OP_DROP`, i.e. "drop the first 32 bytes, keep the
   next 32"), sourceMap `689:16:689:59` = `keccak256(abi.encode(eventsLength, jobId_))`. So the covenant reads
   `output[3 + k]` for k = 0,1,... and parses each commitment as two 32-byte ABI words. `OP_3` is the keccak
   side-car slot, so the read walks the compute band 3.. and the failing k is the one that lands on index 21
   (k = 18) - the first token-less output.
4. `entry-slot-position` (builder, gated by `SOLIDC_DEBUG_KEY_SLOT=1`) shows which fixed entry slots received a
   real resource and which fell back to `funderPool.shift()`; `route-entry-keys`/`message-bus-entry-meta`
   (gated by `SOLIDC_DEBUG_COLLECTION_FETCH=1`) show, per build id, the reached rows, `activeRouteEntryKeys`,
   the handlers' `batchKeyWitnesses`/`physicalEntrySlots` and the computed `messageBusInactiveEntrySlots`.
   Measured: the 2-access whitelist capability of `SolidCashProxy.__message_bus1` runs with
   `inactive [0, 1]` for the `publishJobPost` row (its `batchKeyWitnesses` is EMPTY, hence `activeKeys []`)
   and with `inactive []` for the `takeJob` row (bindings `_0`/`_1` plus `_0_alt`/`_1_alt`).
5. Falsified this round (do not repeat):
   - "Force every entry slot active" (`inactive = []`): still 3 failures in `take job`, error changes to
     `preflight failed at input 127: OP_VERIFY`, and the previously GREEN `take job > sanity checks` breaks.
     So blind activation is not the fix: the SDK's `batchAliasSkips`/`entryDeleteSlots` deactivation is load
     bearing, and the covenant then rejects whatever the SDK publishes (the entry proof/keys are missing).
   - "The alias-skip slot is a token-less pad but the covenant skips it": the covenant DOES address it
     (measurement 3), so the gate the SDK relies on ("the covenant gates the write off, so fund this slot")
     does not hold for the READ alias at `runtimeAliasPriorSlots: [0]`.
   - "The failing band is the side-car band only": no. The covenant's band is content-addressed by
     `3 + k` over aggregate OUTPUTS, so a *missing trailing band member* (not the side-car count) is the
     proximate cause.

Open question for the next round (the fix fork):
  (a) SDK: when the SDK decides an alias/read slot may be skipped, it must still publish the OWNER's entry
      mirror at that slot (same commitment/category/bytecode) instead of a bare funder, so any covenant read of
      the slot is well defined; or
  (b) compiler: the route's row gating must not read a slot the SDK was told to skip, or the covenant's band
      walk must be bounded by the published band width.
  Decide with: `deferred-stall-io` on the STALL build (does index 21 belong to the entry band or to the compute
  band?), plus `route-entry-keys` for the same build id (which rows were reached and what `inactive` was).

Diagnostics landed this round (permanent, gated, build-correlated):
  - `packages/solidcash/src/stateful/buildSequence.ts` (new leaf module) + `peekBuildId()`/`nextBuildId()`;
    `peekBuilderBuildId` in `StatefulContract` now re-exports it, so every participant-side record carries the
    same id as the composer's stall record (`StatefulTransactionBuilder` imports the leaf module directly, so
    no import cycle is introduced).
  - `entry-slot-position` (builder), `route-entry-keys` and `message-bus-entry-meta` (contract), plus
    `deferred-stall-band` and `deferred-stall-io` (composer) - each stamped with `buildId`.

### ROUND 98: the deferred stall is a PREFLIGHT CRASH, not a composition dead-end

Decisive chain (measured with `SOLIDC_DEBUG_ECRECOVER_DERIVE=1`, which is REPORTING-ONLY: its branch only
prints, so every measurement below is the default path):

1. `deferred-ecrecover-no-argument` (96 records in one `-t 'take job'` run) shows the failing build as
   `unresolvedAIndices [[4,0],[6,1],[8,2],[10,3],[12,4],[14,5],[16,6],[18,7]]` (= the eight recovery side-car A
   inputs) with `inputCount 129` and exactly ONE `OP_INPUTBYTECODE` read in the whole trace:
   `{index: 127, belowBytes: 0, below: '', stackBytes: [0,0,0,0,1]}` - the verifier input, with an EMPTY item
   below. The recovery-argument read the resolver needs is never reached because the preflight program dies
   first.
2. The preflight death is `atomic-deferred-compute-no-progress`:
   `Program called an OP_SPLIT operation with an invalid index. stack item length: 0; requested split index: 32`,
   `ip 1`, `executionInput 127`, `states 451`.
3. The failing body is `MarketplaceV1`'s shared outlined span `5393d20120017a8a7e` =
   `OP_3 OP_ADD OP_OUTPUTTOKENCOMMITMENT <push 32> <invoke span 122> OP_CAT` (span 122 = `7f7701207f75` =
   "drop the first 32 bytes, keep the next 32"), invoked from `__message_bus_entry_whitelistWorkers` - the
   ENTRY COVENANT, i.e. the collection's entry NFT script, not the route body. So the covenant reads
   `output[base + 3]`'s commitment and parses it as `slot || digest || ...`.
4. Consequence: because the trace dies at that read, `resolveDeferredEcrecoverArgument` can never learn the
   eight 97-byte recovery blobs, `!progressed` fires, and the composer throws
   `messageBus: complete graph did not expose arguments for all deferred compute resources`. The "stall" is a
   symptom; the crash is the cause.

Band measurement (io table for the failing build, `deferred-stall-io-full`):
  - token-bearing outputs: 0..20 (master, 2 data NFTs, keccak(3), 16 ecrecover(4..19), entry(20));
  - **63 and 64 carry the two real value-chunk NFTs** (commitments 123 and 108 bytes, participant category);
  - 21..62 and 65..126 are BARE token-less pads (lock `51`),
    so a positional chunk read that lands past the two real chunks finds an empty commitment and the
    covenant's `OP_SPLIT 32` helper dies.

Band-base experiment (`SOLIDC_DEBUG_CHUNK_SHIFT=<n>`, read in `getChunkableValueWriteBand`; default 0 is a
no-op, verified: the same two failures and the same error messages as before the patch):
  - with `SOLIDC_DEBUG_CHUNK_SHIFT=3`: ZERO OP_SPLIT stalls, `deferred-ecrecover-learned` fires, and the
    failure moves to a later stage (`complete graph did not expose arguments...` and an internal
    `Cannot read properties of undefined (reading 'to')`), because the shift moves the band start without
    re-clamping the reserved width (it overruns the participant's trailing region) - so the shift is EVIDENCE
    of a band-coordinate mismatch, NOT the fix.

Falsified / corrected this round (do not repeat):
  - "`SOLIDC_DEBUG_ECRECOVER_DERIVE=1` changes behaviour": NO. Its branch in
    `__messageBusDeferredCompute.resolve` only prints `atomic-deferred-compute-no-progress` and the
    `no-progress-*` frames. Runs with and without the flag throw the identical error; only the record count
    differs (10 vs 0). Earlier rounds' habit of using the flag for focused runs is harmless.
  - "the fault is in the entry-access plan (`messageBusInactiveEntrySlots`)": no - forcing every entry slot
    active still fails (`preflight failed at input 127: OP_VERIFY`) and breaks the green `take job > sanity
    checks`.

Next round (the fix fork, now sharp):
  (a) SDK: every reserved slot of the value-chunk/continuation band must be published TOKEN-BEARING with a
      structurally valid chunk commitment (2-byte index + data), instead of a bare pad, so a preflight read
      of any band member is well defined and the trace reaches the recovery read. Fail-closed is preserved:
      the write covenant verifies the chunk's lock identity + `slot || digest || pushdata(i) || pushdata(v)`,
      and the read side verifies `sha256(value) == digest`, so a placeholder can never be ACCEPTED - it only
      lets the program run far enough to learn the deferred arguments.
  (b) compiler: align the entry covenant's read coordinate with the published band base (the `+3` in span
      `-381`) and/or skip a read whose slot is not part of the authenticated band.

Focused state after this round's changes: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`,
failing `take job` and `take job multiple`), same two error messages as the pre-change baseline; `yarn build`
green; no full-ladder run (no title turned green).

### ROUND 99: the failing introspection is a SCAN, and empty commitments were the invalid payload

New diagnostic (permanent, gated by `SOLIDC_DEBUG_ENTRY_COUNTS=1`) - `deferred-no-progress-reads`: when the
deferred resolver makes no progress, it reports the trailing `OP_UTXOTOKENCOMMITMENT`/`OP_OUTPUTTOKENCOMMITMENT`/
`OP_OUTPUTBYTECODE` reads of the probe trace with their index operand. Measured (build 40, default path):

    out-bytecode 466, 467, 468 (two-byte items, stackDepth 53) then out-commitment 463

so the program dies inside a bounded OUTPUT RANGE SCAN that reads bytecode per index and then parses a matched
commitment - the `emitSortedValueChunkPin` shape (`Scan every output ... OP_OUTPUTBYTECODE ... OP_IF ...
OP_OUTPUTTOKENCOMMITMENT ...`). The parse helper is `OP_SPLIT 32` (`span 122`), so any matched output whose
commitment is EMPTY kills the whole program with an invalid-index failure - a VM abort, not a rejected check -
and that abort lands before the recovery/keccak read sites, which is why the resolver cannot learn arguments.

Empty-commitment outputs measured in the stalled aggregate (`deferred-stall-io-full`, now with locking-bytecode
prefixes): the master minting NFT (index 0, legitimate) plus four mutable NFTs with `commitment.length === 0`
(`127:142ee8b0`, `129:ee643a16`, `214:3770ad41`, `216:424cc33a`) and one minting NFT. They are placeholders for
slots whose value the deferred build has not learned yet.

Landed (both general, neither can be ACCEPTED anywhere - every equality check still compares against the
authenticated expectation):
  - `StatefulTransactionBuilder` mutable-token shell repair no longer writes `commitment: ''`. It mirrors the
    co-spent input's commitment at the same 1:1 block coordinate when there is one (that is the authenticated
    value the preservation checks expect) and otherwise writes a 64-byte zero body long enough to parse.
  - `StatefulContract` deferred resolver: the PROBE program (only the trace, never the sent transaction) fills
    every empty token commitment from `program.sourceOutputs[index]` (1:1 coordinate) or with 64 zero bytes, so
    the run can reach the read sites the resolver needs.

Falsified this round (do not repeat):
  - "filling the empty commitments is enough": with both changes in place the focused window is unchanged
    (2 failed | 1 passed, 10 `deferred-no-progress-reads`, 2 `deferred-ecrecover-learned`, identical error
    messages). The failing scan still aborts, so the dying commitment is either not one of the filled outputs or
    the scan's abort is not about an empty commitment at all. Next measurement: dump the PROBE program's output
    table at the reported read index (the `deferred-stall-io-full` record is taken at the final stall and its
    indices do NOT line up with the earlier attempt's trace indices - 216 vs 463 - because each resolve round
    rebuilds the program).

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), same two errors, `yarn build`
green, no full-ladder run (no title turned green).

### ROUND 100: the aborting read is the MASTER commitment, and probe placeholders must agree

`deferred-no-progress-reads` now reports the introspected PROGRAM state for every traced read
(`cat`, `cap`, `commitBytes`, `lock`), which removes the correlation problem noted in ROUND 99 (the aggregate dump
at the final stall and an earlier attempt's trace indices never line up). Measured (builds 40/67/74/104/112):

    out-bytecode 208..218 (a bounded OUTPUT RANGE SCAN; 208..211 are `lock 51` pads, 218 is a P2PKH fee output)
    out-commitment index 0  ->  cat a3cef944, cap minting, commitment length 0, lock aa20fb9daa43

so the program dies parsing the commitment of **output 0, the participant's MASTER minting NFT**, whose
commitment is legitimately EMPTY (minting NFTs carry none) - and the caller's fixed `OP_SPLIT 32` helper aborts
the whole program on it. The scan at 208..218 is not the aborting site; it only reads locking bytecodes.

Landed (probe-only; the sent transaction is untouched):
  - empty token commitments in the probe program are filled from the OTHER side of the same 1:1 block
    coordinate, else with 64 zero bytes, and BOTH sides are filled so the pair agrees.
    Measured effect: with only outputs filled the abort moved to `OP_VERIFY` at ip 148 of the 20-instruction
    category-check body `121 118 206 1:20 127 124 117 82 ...` (input commitment empty vs output filled - the
    preservation check correctly failing closed); with both sides filled the abort is a plain `OP_VERIFY` at
    ip 424 / 183 / 244 with `stackBytes [0,0,35,35,35,0,0,1]` - the same signature ROUND 95 recorded for build
    40, i.e. the probe now dies like an ordinary incomplete transaction instead of on an invalid OP_SPLIT.

Still open (the next measurement): which check fails at those ips, and why the trace never reaches the
`OP_INPUTBYTECODE` recovery read (still exactly one read, at input 127, `belowBytes 0`) before it does.
`deferred-ecrecover-learned` stays at 2 and `deferred-no-progress-reads` at 10, so the resolver still cannot
learn the eight recovery blobs - the composer error is unchanged.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 101: the aborting resource is a SHORT (38-byte) commitment mirror

`deferred-no-progress-reads` is now self-contained: it also carries the terminal `error`, `failingIp` and
`failingOpcode`, so the DERIVE-gated `no-progress-*` frames are no longer needed to read a stall. Measured
(builds 40/67/74, default path):

    error: "Program failed an OP_VERIFY operation."
    build 67/74: failingIp 183 / 244     build 40: failingIp 424
    last introspection: out-commitment idx 216 (67/74) / 463 (40), cat a3cef944, commitment 38 BYTES

and the surrounding 1:1 pairs (io-full, build 67) are exact mirrors:

    idx 212  in ee643a16:128  out ee643a16:128
    idx 213  in ee643a16:53   out ee643a16:83   <- the only pair that CHANGED
    idx 214  in 3770ad41:0    out 3770ad41:0
    idx 215  in ee643a16:75   out ee643a16:75
    idx 216  in a3cef944:38   out a3cef944:38   <- the aborting read, lock aa20ee2996...
    idx 217  in ee643a16:38   out ee643a16:38

So the program dies immediately after a covenant parses the commitment of a resource that input and output agree
on - a 38-byte commitment at a COLLECTION address (`aa20ee2996...`), while the code applies the SORTED entry
shape `slot(32) || nextKey(32) || value` (>= 64 bytes, `commitmentField(..., 'next')` = "drop 32, take next 32").
38 = 32-byte slot/key hash + 6-byte tail, i.e. the shape of a NON-sorted entry or of a value-chunk commitment
(`index(2) || data`), not of a sorted entry.

Next (the fix fork): decide which side owns the mismatch -
  (a) the published resource is a stale value chunk from the previous derivation and the scan's `nNew` count /
      digest expectation is computed for the new value;
  (b) a non-sorted collection entry is matched by a sorted scan (collection/address mix-up in the route's union
      layout);
  (c) the SDK mirrors the wrong resource kind into a collection slot.
Start from the io-full pair at the aborting index: whether the input is a real UTXO of that collection (then the
address is right and the parse shape is wrong) or a placeholder (then the SDK published the wrong resource).

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 102: the aborting lock is outside the reading participant's own address set

`deferred-no-progress-reads` now classifies every introspected lock against the reading participant's own address
set (master, data NFT, and every `getEntryNftAddress(parent.inner, parent.categoryId, collection)`), so a read can
be attributed to its owner. Measured (builds 40/67/74, default path):

    out-commitment idx 216 (67/74) / 463 (40), cat a3cef944, commitment 38, lock aa20ee2996d7  -> KIND: none
    out-bytecode idx 217/218 ...                                                              -> KIND: none
    (every other read in the window is also KIND: none, including a P2PKH pad)

i.e. the aborting lock is NONE of the reading participant's own addresses - not its master, not its data NFT and
not any of its collection entry addresses. Since the program that runs is the atomic VERIFIER (it opens with
`OP_TXINPUTCOUNT OP_2 OP_SUB OP_INPUTBYTECODE OP_0 OP_PICK ...`, reading input 127's unlocking bytecode = the
envelope), it addresses outputs of EVERY participant, so an aborting slot has to be classified against the whole
AGGREGATE's participants, not against the controller's own contract.

Aggregate geometry for build 67 (221 outputs): participant 0 occupies 0..128; the aborting index 216 sits in the
last participant's block, i.e. it is a slot of a DIFFERENT participant than the one whose builder reported the
stall - consistent with KIND: none.

Next (concrete): move the classification to the aggregate level - in the composer's stall probe, build the lock ->
kind map from every participant's own master/data/entry addresses (the composer has each participant's artifact,
category and block layout) and re-report the aborting read with its owner. Then the fix fork from ROUND 101 can be
decided with an owner attached.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 103: the aborting read addresses the aggregate's TAIL, not a participant slot

`deferred-stall-io-full` now labels every aggregate coordinate with its owner and block slot
(`p<participant>:<kind>#<slotIndex>`, computed from `graph.layout.participantInputs` and each participant's
`blockLayout.slots`). Measured:

    build 40 (469 outputs): idx 216 p2:master, 217 p2:dataNft, 218 p2:entry#0      <- participant slots
                            idx 463..467 = "other"                                 <- the ABORTING read (463)
    build 67 (219 outputs): idx 216 = "other"                                      <- the ABORTING read

so the aborting commitment read is always in the aggregate's TAIL - beyond every participant's block - where
co-spent resources are mirrored 1:1 (`in == out` at the same index, e.g. `216: a3cef944:38` both sides, with
several different categories `a3cef944`, `ee643a16`, `424cc33a`, `00000000`, `2c62df0f` in the same tail run).

Combined with ROUND 101/102 this says: the verifier's scan bytecode-matches a TAIL output (a mirrored co-spent
resource) at a COLLECTION address and then parses its 38-byte commitment with the SORTED entry shape
(`slot||nextKey||value`, >= 64 bytes) - while a 38-byte body is the legitimate shape of a NON-sorted entry
(`slot||value`) or of a value-chunk (`index||data`). Two candidate owners, to be decided next:
  (a) the covenant scans too far: `emitSortedValueChunkPin` scans EVERY output ("Scan every output"), so a
      mirrored tail resource at a collection address is matched even though the pin's authority is the writer's
      own band; or
  (b) the SDK mirrors the wrong resource into the tail (the mirrored UTXO at that address really is not a sorted
      entry of that collection, i.e. the collection/address the scan expects and the resource published disagree).

Next concrete step: print, for the aborting tail index, the mirrored input's outpoint (txid:vout) and the
collection the scan is verifying (the verifier's `nNew`/address derivation), then decide (a) vs (b).

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 104: the failing instruction is `OP_EQUAL OP_NOT OP_VERIFY` (a require-not-equal)

`deferred-no-progress-reads` now prints `failingWindow` - the opcodes around the terminal instruction pointer - so
the check can be identified without the artifact's ip-to-source map. Decoded (BCH-2026 opcode numbers):

    build 67  ip 183 : [117 DROP, 135 EQUAL, 145 NOT, 105 VERIFY, 96 OP_16, 121 PICK, 1]
    build 74  ip 244 : [138 INVOKE, 135 EQUAL, 145 NOT, 105 VERIFY, 84, 1, 138 INVOKE]
    build 40  ip 424 : [92, 121 PICK, 104 ENDIF, 105 VERIFY, 2, 138 INVOKE, 95]

so in every case the program dies on `require(a != b)` - a NEGATED equality - immediately after the
`out-commitment` read of the tail resource (index 216 for 67/74, 463 for 40; category a3cef944, 38 bytes,
input and output identical). The two candidate semantics:
  (a) the sorted read's ABSENCE proof: `require(slot32 != H(k))` while the parsed word equals H(k);
  (b) a "must not be empty/zero" guard on a parsed word, tripped by the placeholder body (my probe fill uses 64
      zero bytes only when BOTH sides are empty, so this cannot explain the 216/463 cases, whose bodies mirror a
      real 38-byte UTXO commitment).

Note the 38-byte body cannot be parsed by `commitmentField(...,'next')` at all (`SPLIT 32; NIP; SPLIT 32` on a
6-byte remainder is an invalid-index abort, not a VERIFY), so the failing parse is a DIFFERENT field extraction -
one that yields a word equal to the value it must differ from.

Round 101's format observation stands and now looks decisive: the SDK's continuation chunk is
`uint16-le index || raw chunk data` (`buildValueChunkCommitment`, 2 + 36 = 38 bytes - exactly the observed
length), while the compiler's sorted-value chunk pin documents `slot(32) || digest(32) || pushdata(i) ||
pushdata(v)` (>= 66 bytes) at the collection's value-chunk P2SH32. Next: check whether the tail resource at the
aborting index lives at a VALUE-CHUNK address (`valueChunkSignature(collection)` / `getEntryNftAddress` with the
chunk domain) - if yes, the SDK publishes the vmap continuation format where the covenant expects the pinned
value-chunk format, which is a concrete SDK/compiler format mismatch to fix.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 105: the aborting tail resources are COMPOSER-appended, and the SDK chunk format is documented

Landed (general, diagnostics only):
  - every participant build now publishes `__messageBusResourceLocks` - its own block-slot locks, derived chunk
    locks and session lock, each tagged by resource family;
  - the composer records those per participant as it builds each local block and merges them in the stall probe
    into `tailKinds` = every aggregate coordinate whose label is `other`, with the owning participant+family and
    the commitment length.

Measured (builds 40/67/74, default path):

    build 67/74 tail: 216:unknown:38, 217:unknown:38, 218:unknown:0
    build 40    tail: 463:unknown:38 .. 467:unknown:38, 468:unknown:0

so the aborting tail resources are published by NONE of the participants' block slots, derived chunk locks or
session locks. They sit at the very END of the aggregate (216..218 of 219; 463..468 of 469) and are therefore
appended by the COMPOSER's post-build passes (`transportedValueChunks`, split/merge, upgrade-state suffix), which
run after each participant's `build()` and cannot appear in a per-participant map.

Also settled this round: `getValueChunkAddress` (SDK, covenant-helpers) documents "The address commits to
collection, slot, and value root, so chunk commitments carry only uint16 index || raw data" - i.e. the observed
38-byte (`uint16 index || data`) tail commitment IS the correct shape for a ROOT-ADDRESSED value-chunk covenant.
The compiler's `emitSortedValueChunkPin` documents the other, PINNED shape (`slot(32) || digest(32) ||
pushdata(i) || pushdata(v)`) for its own address. Two different covenants, two different formats - so ROUND 104's
"format mismatch" reading is falsified for the root-addressed family, and the remaining question is which address
family the aborting scan matched and which family the composer's transport published there.

Next concrete step: read the composer's `transportedValueChunks` placement (compose.ts, the loop right after each
`local = await localCall.build()`), note the lock and commitment format it appends, and compare against the
address the verifier's scan compares (`valueChunkSignature` domain vs the pinned slot/digest domain).

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 106: the failing check is `require(target != 0xffff)`, and build 40 carries exactly that

Located the compiler site emitting the failing window's `OP_EQUAL OP_NOT OP_VERIFY`
(`GenerateTargetTraversal.ts:26522`): it is the runtime-loop JOURNAL binding, which validates each compact access
tuple `flags || target-u16le || predecessor-u16le` and rejects the reserved ordinal in the TARGET field:

    OP_DUP 0xffff OP_EQUAL OP_NOT OP_VERIFY        // require(target != 0xffff)
    OP_SWAP 2 OP_SPLIT                             // -> predecessor, next

The SDK's own encoder agrees with that contract (`KernelEntryJournal.ts`: `NO_PREDECESSOR = 0xffff`, ordinals must
stay below it, and its decoder throws "uses the reserved target ordinal"), so a 0xffff target is invalid on both
sides.

New diagnostic `accessSentinels` in `deferred-no-progress-reads`: it scans every probe input's unlocking bytecode
for the compact access stream (`KERNEL_ENTRY_JOURNAL_ACCESS_TAG = 0x06`, header 2 + 20 bytes, 5 bytes per access)
and reports the tuples whose target field is the sentinel. Measured:

    build 40 : inputs 463, 464, 465, 466, 467 each carry count = 33 with sentinel targets at access ordinals
               11 and 26          <- CONFIRMED: the probe dies on exactly this check
    build 67 : []                 <- different cause, still open
    build 74 : []                 <- different cause, still open

Note the coincidence that matters for round 105's finding: build 40's sentinel-carrying inputs (463..467) are the
same coordinates as its aborting tail read (463). Build 67/74's stall is NOT this sentinel, so the class has at
least two causes and they must be fixed separately.

Next: (1) find which SDK path writes `targetRecordOrdinal = 0xffff` (an "unresolved target" placeholder in the
deferred probe is the likely origin) and give it a plausible ordinal; (2) diagnose build 67/74 independently - the
sentinel scan can be widened to the other witness carriers (outputs, and streams with count > 64 or a different
tag offset).

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 107: ROUND 106's "confirmed sentinel" was a FALSE POSITIVE

`accessSentinels` now validates the whole stream canonically before reporting (every tuple must satisfy the
flag/sentinel relation under one field order, the predecessor sentinel must be canonical, and target != predecessor)
and only reports when that holds. Measured with the strict rule:

    loose scan (ROUND 106): 20 "definitive" stream reports across builds 40/175
    strict scan (this round): 0 reports

and the loose scan's own agreement numbers already gave it away (14 or 15 of 33 tuples matched under either field
order, i.e. the parse was misaligned). The loose scan was matching accidental `0x06`/count byte pairs inside a large
witness blob, so ROUND 106's claim - "build 40's stall is a reserved target ordinal" - is FALSIFIED, and the
`require(target != 0xffff)` site at `GenerateTargetTraversal.ts:26522` is NOT where the probe dies.

Related correction: the failing three-op sequence cannot be located by matching a single emission site, because
shared-span outlining deduplicates bytecode - the same `OP_EQUAL OP_NOT OP_VERIFY` can belong to any
`require(a != b)` in the program. The windows also show the two builds fail at DIFFERENT checks:

    build 67/74 : [DROP, EQUAL, NOT, VERIFY, ...]   - a negated equality
    build 40    : [PICK, ENDIF, VERIFY, ...]        - a bare OP_VERIFY after an ENDIF

so the class has at least two causes, and the next step is to identify each by its ENCLOSING instructions (the
`failingWindow` already carries the neighbourhood; extend it to ~12 opcodes and map it against the candidate
emitters in `GenerateTargetTraversal` by hand).

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 108: the stall class splits 5 VERIFY / 5 OP_SPLIT, and the band+3 shift is FALSIFIED

`failingWindow` widened to 13 opcodes. Default-path error mix over the ten stalled builds (builds
40/67/74/104/112/119/126/133/140/175):

    OP_SPLIT-empty   112, 119, 126, 133, 175   [SPLIT NIP PUSH1 SPLIT DROP]  <- the 5-byte span 122 parser
    OP_VERIFY         40, 67, 74, 104, 140
      build 40  : 0 BOOLAND IF 1 ELSE 12 PICK ENDIF VERIFY PUSH2 INVOKE 15 PICK      (conditional require)
      build 67  : INVOKE PUSH1 INVOKE 1NEG INVOKE DROP EQUAL NOT VERIFY 16 PICK ...  (require a != b)
      build 74  : 15 INVOKE PUSH1 INVOKE PUSH1 INVOKE EQUAL NOT VERIFY 4 ...         (require a != b)
      build 104 : 0x65 FROMALT PUSH2 INVOKE 0x66 DROP 0xbc BIN2NUM VERIFY ...        (bare require)
      build 140 : INVOKE 14 INVOKE DROP 0 PUSH1 INVOKE BOOLAND VERIFY ...            (require a && b)

For the OP_SPLIT class the read sequence is now exact (build 112):

    in-inputbytecode idx 3 (keccak side-car, mutable, 32-byte commitment)
    out-commitment   idx 66  -> cat None, commitment None      <- ABORTS: a token-less output

i.e. the covenant reads the commitment of aggregate output 66 while only outputs 63 and 64 carry value chunks,
so the third band slot is a bare pad.

The `SOLIDC_DEBUG_CHUNK_SHIFT=3` experiment was re-run WITH a clamp that keeps the shifted band inside the
participant's trailing run (the earlier run overran the block and produced an unrelated internal failure):

    default     : 5 OP_SPLIT + 5 VERIFY stalls
    shift+clamp : 5 OP_SPLIT + 4 VERIFY stalls

so the band+3 offset removes ONE VERIFY stall and NONE of the OP_SPLIT stalls - the ROUND 97/98 "+3 offset"
hypothesis is FALSIFIED as the fix for this class, and the shift/clamp code was reverted (only the neutral,
default-off `SOLIDC_DEBUG_CHUNK_SHIFT` knob remains).

Next (per class): for the OP_SPLIT builds, compare the number of chunk outputs the SDK publishes with the band
width / chunk count the covenant walks (the `chunk-band-probe` record already prints `start`, `band`, the composed
trailing run and the planned width) - the read at 66 says the covenant expects a chunk at band start + 2 while the
SDK stopped after two chunks. For the VERIFY builds, the two `require(a != b)` cases (67/74) and the three
boolean/conditional cases (40/104/140) are separate emitters and must be located by their 13-op context.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 109: the OP_SPLIT class reads the side-car RESULT band at the wrong base

`deferred-no-progress-reads` keeps the last 40 introspections now. Full sequence for build 112 (447 reads total):

    183..211  out-bytecode, ascending, every one a PAD (no token)
    212..217  out-bytecode, token-bearing (128, 83, 64, 75, 38, 38-byte commitments)
    216       out-category (a3cef944, mutable, 38 bytes)
    217       out-bytecode
    218       out-bytecode
    216       out-commitment (a3cef944, 38 bytes)          <- an identity scan that MATCHED 216
    3         in-inputbytecode (361eb80b, mutable, 32 B)   <- the KECCAK side-car input
    66        out-commitment -> EMPTY                     <- ABORT (span 122: SPLIT 32)

So the aborting read follows the side-car input check directly, and its coordinate is
`master + blockSize + 3` for participant 0 (blockSize 63, trailing band 63..126), NOT the side-car band at
`master + 3` where inputs and their 1:1 mirrors actually live (outputs 3..19 are token-bearing).

That is a base/offset mismatch in the code that reads a compute result: the read should address the side-car
mirror band (`master + 3 + k`, the same coordinate as the input) or the SDK must publish the result band at
`master + blockSize + 3 + k`. The scan before it (183..218) is a separate identity scan whose match at 216 is a
tail resource (ROUND 103/105).

Next: find the emitter that pushes `master + blockSize + <k>` before the shared span `5393d20120017a8a7e`
(`OP_3 OP_ADD OP_OUTPUTTOKENCOMMITMENT <32> <span 122> OP_CAT`) - the candidates are the vmap batch/settlement
readers that use `emitTrailingBlockBase`/`emitTrailingWriteOutputBase` plus a constant, and the SDK witness that
carries the predicted output ordinal (`__internal__vmapBatchPredOut_*`) - and decide which side owns the extra
`blockSize`.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 110: the OP_SPLIT coordinate is the RANGE-SPLICE chain walk, not the side-car band

The `+3` in the shared span was a red herring: the span is `OP_3 OP_ADD OP_OUTPUTTOKENCOMMITMENT <32> <span 122>`
where `span 122` is the "drop 32, take next 32" parser used by EVERY `commitmentField`-style read, so the 5-byte
body in the failing window identifies the parser, not the caller. The caller that produces exactly
`master + blockSize + 3` is the range-splice chain walk:

    GenerateTargetTraversal.ts:23417  emitTrailingBlockBase(blockSize)   // master + blockSize
                                      OP_1ADD                            // + 1  (P' sits at +0)
                                      <counter> PICK OP_ADD              // + counter
                                      OP_DUP OP_OUTPUTBYTECODE ... OP_OUTPUTTOKENCOMMITMENT
                                      <32/32 parse>                      // span 122

i.e. `output[master + blockSize + 1 + counter]` = the `counter`-th new sorted-chain node. Triangulated with the
measured read index for participant 0 (blockSize 63): `63 + 1 + 2 = 66`, so the covenant was walking node 2 while
the participant published only TWO trailing outputs (63 and 64 = P' at +0 and node 1 at +1). The abort is
therefore a CHAIN-LENGTH mismatch: the covenant walks more new nodes than the SDK materialised, and the walk runs
off the published run into a bare pad.

Candidates for the count the covenant uses: the row's key/insert count from its witness blob
(`__internal__vmapBatchTrailingCount` is the corresponding ABI input) versus the SDK's `plannedWidth` /
`composedContinuationWidth`. Both are already printed by `chunk-band-probe` (`start`, `band`, `composedTrailing`,
`composedContinuationWidth`).

Next: build a focused diagnostic that prints, for one stalled build, the covenant's walked node count (the read
index chain, now visible in the 40-read window) next to the SDK's published count for that band and the witness
value it passed - then decide whether the SDK undercounts, the witness overcounts, or the walk should stop at the
published run (fail-closed bound).

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 111: the chain-length mismatch is measured (2 published vs 3 walked)

New diagnostic field `trailingPublished` in `deferred-stall-io-full`: for every participant, how many of its
`trailing` slots actually carry a token in the aggregate, and at which offsets. Measured:

    build 40 : p0 2/64 [63,64]   p1 5/64 [21,22,82,83,84]   p2 3/64 [23,24,25]   p3 2/64 [16,17]   p4 1/64 [13]
    build 67 : p0 2/64 [63,64]   p1 4/64 [21,22,83,84]
    build 74 : p0 2/64 [63,64]   p1 4/64 [21,22,83,84]

Participant 0 has blockSize 63, so its published run is exactly P' at +0 (63) and node 1 at +1 (64) - while the
range-splice walk reads `master + blockSize + 1 + counter` and the measured abort was at 66 (counter 2). The
covenant therefore walks MORE new sorted-chain nodes than the SDK materialised, and the walk runs off the
published run into a bare pad, where the shared 32/32 parser (span 122) aborts on the empty commitment.

The published counts also show the pattern per participant: a short prefix at the start of each trailing run (and
for p1 a second pair at 82..84), which is consistent with the SDK publishing only the nodes it planned while the
covenant's walk is bounded by the ROW's key count from its witness blob.

Next: compare the row's key/insert count (the witness the covenant's loop bound comes from) with the SDK's
published node count for the same row - both are now measurable (the read window gives the walk, `trailingPublished`
gives the publication) - and fix whichever side is wrong: publish one node per key, or bound the walk by the
published run.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 112: the trailing band base disagrees between compiler and SDK (2-slot prefix)

`deferred-stall-io-full` now also prints `trailingCommitments` - the commitment head of every published trailing
output next to its co-spent input. Measured (build 67, participant 0, trailing offsets 63 and 64, both mirrored
1:1):

    p0@63 in/out = 004c785100001976a91471782e8159265ed94bd35b8e699c08f53a6f38c688ac1976a914c4ad89cd...
    p0@64 in/out = 514c695522ee138ae55109000010632d5ec76b0523aa20e61fa6c6f5b188a0bcee4f42fd7bf0524e...

Both commitments embed RECORD payloads - a P2PKH locking bytecode (76a914..88ac) and a 35-byte P2SH32 lock - i.e.
they are the participant's runtime EVENT records, not sorted-chain nodes.

The SDK's own placement code explains the geometry (`StatefulTransactionBuilder.getRuntimeLoopEventOutputIndex`):

    if (this.runtimeLoopTrailingSegments.length === 0) {
      return this.getChunkOutputBase() - transfers - events + eventIndex;
    }

so runtime events are placed immediately BEFORE the chunk base: with 2 events at 63/64 the chunk base is 65. But
the compiler's reads use `master + blockSize + k` directly (the range-splice chain walk is
`emitTrailingBlockBase(blockSize)` + `1ADD` + counter, and the chunk pin/reader addresses the same run), i.e. the
compiler's band base is `blockSize` = 63 for participant 0. The SDK therefore publishes its band `prefix`
(runtime events, loop-entry outputs, transfers) INSIDE the region the covenant walks, and the walk reads event
records as if they were sorted-chain nodes - the link fields do not match, the walk continues off the published
run into a bare pad, and span 122 aborts on the empty commitment.

This closes the OP_SPLIT class analytically: it is a band-base disagreement, not a missing chunk. The two possible
fixes (both general):
  (a) SDK: place the runtime-effect prefix AFTER the band - i.e. `getChunkOutputBase()` must equal the compiler's
      `blockSize`, with events/transfers/loop-entry outputs allocated above the published band width; or
  (b) compiler: publish the band base offset (the prefix length) so the SDK and the covenant agree on it.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 113: the band bases AGREE (63), so the OP_SPLIT class is a slot COLLISION, not a shift

New diagnostic `trailing-band-coordinates` (from `stb.getTrailingBandCoordinatesForDiagnostics()`, gated by
ENTRY_COUNTS) prints the compiler's fixed base, the published `trailingBase`, the SDK's chunk base and the event
base. Measured for the route participant (SolidCashProxy, all ten stalled builds):

    {"blockSize": 127, "trailingBase": 63, "chunkBase": 63, "eventBase": 22}

Corrections to ROUNDS 109/110: `blockSize` is 127, NOT 63, so the failing read at 66 is NOT
`master + blockSize + 1 + counter`. And `trailingBase` (63) EQUALS the SDK's `chunkBase` (63), so ROUND 112's
"the SDK's chunk base is shifted past the prefix" is refined: the bases agree, and 66 = chunkBase + 3 is the
FOURTH value-chunk slot (index 3).

Combined with ROUND 112's commitment dump: the two trailing outputs p0 did publish (63/64) do not parse as
`uint16 index || data` chunks at all (their leading two bytes decode to out-of-range chunk indices), and they
carry record payloads. So the covenant's value-chunk band at `trailingBase + 0..` is effectively UNPUBLISHED for
this participant: its first two slots are occupied by runtime-effect records, and the chunk the covenant walks to
(index 3, coordinate 66) is a bare pad whose empty commitment aborts span 122.

The defect is therefore a SLOT ALLOCATION collision inside the trailing run: the runtime-effect records and the
value-chunk band both claim `trailingBase + 0..` for the same participant. Fix options (general):
  (a) SDK: publish the value-chunk band at `trailingBase` and allocate runtime-effect records ABOVE the band's
      published width (`getRuntimeLoopEventOutputIndex` / `getKernelJournalTrailingEffectOutputIndex`); or
  (b) compiler: start the covenant's chunk band after the runtime-effect footprint, which requires the footprint
      to be a runtime value (the route already carries `__internal__vmapBatchTrailingCount`).

Next measurement to pick between them: print, for the same build, `runtimeLoopEventOutputs.length`,
`runtimeLoopTransferOutputs.length`, `_trailingLoopEntryOutputCount()` and the value-chunk band width
(`getChunkableValueWriteBand()`) so the claimed slots can be laid out side by side and the overlap proven
numerically.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 114: the chunk band is never PLANNED - `valueChunkWrites` has no producer in the compiler

`trailing-band-coordinates` now also prints every family that claims a coordinate inside the trailing run plus the
planned band. Measured for the route participant (all ten stalled builds):

    {"blockSize":127, "trailingBase":63, "chunkBase":63, "eventBase":22,
     "events":0, "transfers":0, "loopEntries":0, "runtimeEvents":0, "eventSlots":[]}     (no "band" key at all)

so ROUND 113's collision reading is FALSIFIED: NOTHING else claims the trailing run for this participant, and
`getChunkableValueWriteBand()` returns UNDEFINED - the value-chunk band is simply never planned.

Why: the SDK's descriptor-driven plan (`ValueChunkWriteDescriptor`, `describeValueChunkWrites`,
`_chunkableValueWriteGroups`) reads artifact metadata named `valueChunkWrites`, and

    grep -rn "valueChunkWrites" packages/solidc/src   ->  NO MATCHES
    grep -l "valueChunkWrites" *.artifact.ts          ->  NO FILES

i.e. the compiler never emits that field, for any contract, so the SDK's descriptor-driven chunk planning is dead
code in practice. Chunks can only ever be staged by the TRACE-LEARNING path (nothing appears in the
`composedTrailing`), and that path needs a probe run to reach the chunk pin - which is exactly what the empty pad
at `chunkBase + 3` (66) prevents: the covenant's positional chunk read aborts on the unpublised slot before any
trace can expose the chunk commitment. The class is a DEADLOCK:

    covenant needs published chunks to run -> SDK publishes chunks only from a trace -> the trace aborts on the
    missing chunk.

Fix options (general, both need the compiler's own metadata to be the authority):
  (a) compiler: emit `valueChunkWrites` descriptors for every handler that writes a chunkable value (collection,
      key slot, entry access slot, route slot, operation, outputBase, outputCount) so the SDK materialises the
      band before the first probe; or
  (b) SDK: synthesise the descriptor locally from metadata the artifact DOES publish (the collection's
      `chunkableValue` / `sorted` flags, the entry slot and the key slot), keeping the descriptor path as the
      authority when it exists.

Next: determine which metadata the artifact already carries for the failing row (`stateLayout.collections[].
chunkableValue`, the entry-slot index and the key slot are all present in the dumps so far) and either emit the
descriptor in the compiler or synthesise it in the SDK - then verify with the focused window and a full ladder run
if a title turns green.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 115: the composed path has no writer CANDIDATE at all (not an ambiguity)

`trailing-band-coordinates` now reports the chunkable-writer candidate identities the SDK's selector sees
(`groupChunkableValueWriteResource` over every low-level-call and external-call group with a resolved master
input). Measured for the route participant (all ten stalled builds):

    writerCandidates: []      band: null

so `selectChunkableValueWriteExecution` bails out at the FIRST test (`resource === undefined`), not at the
ambiguity test (`executions.size !== 1`): in the composed kernel route there is no group representing the
chunk-writing call at all, because those writes execute inside the participant's own verifier rather than through
a separate delegate/external call group. The `ValueChunkWriteDescriptor` + group machinery is consequently
structural-legacy only (the SDK comments already call the remaining paths "Compatibility only for plans predating
compiler-authored valueChunkWrites", and no compiler emitter exists for that field - ROUND 114).

Consequence: in the composed path the value-chunk band can ONLY be populated by the trace-learning path, and that
path needs a probe run that reaches the chunk pin - which the token-less pad at `chunkBase + 3` prevents. The
deadlock is therefore structural, and the fix must break the cycle from one of two sides:

  (a) PROBE side (SDK, probe-only, fail-closed): give the participant's trailing-band coordinates a token-bearing
      structural placeholder in the probe program so the positional parse (span 122) survives. The probe patch
      added in ROUNDS 99/100 only fills tokens whose commitment is EMPTY; a slot with NO token at all - the
      failing case - is untouched. The placeholder needs the participant's own category (the master's) to be
      structurally plausible, and a body long enough to parse (>= 64 bytes). Any later equality check still fails
      closed, but it must fail AFTER the recovery/keccak read sites the resolver needs.
  (b) COMPILER side: publish the band so the SDK does not have to learn it - i.e. emit the descriptor
      (collection, key slot, entry access slot, route slot, operation, outputBase, outputCount) or start the
      covenant's positional chunk read after a runtime prefix the route already carries
      (`__internal__vmapBatchTrailingCount`).

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 116: the OP_SPLIT abort class is fixed (probe-side), the VERIFY class remains

Landed (probe-only, fail-closed): every TOKEN-LESS output at or above the participant's trailing base
(`stb.getTrailingBandCoordinatesForDiagnostics().trailingBase`, offset by the participant's `inputBase`) receives a
structural placeholder token in the PROBE program - the participant's own master category (`minting` capability
scan), `mutable`, with a 64-byte zero body - so the covenant's positional chunk parse cannot abort on an empty
item. The sent transaction is untouched.

Measured effect on the focused window:

    before : 5 OP_SPLIT-empty + 5 VERIFY stalls      2 failed | 1 passed
    after  : 0 OP_SPLIT-empty + 10 VERIFY stalls     2 failed | 1 passed

so the OP_SPLIT class (builds 112/119/126/133/175) is ELIMINATED - the probe now runs past the positional chunk
parse - and the remaining blocker is the VERIFY class, now 10/10. The converted builds fail at their own checks:

    112, 119 : VERIFY ELSE 0 PICK 2 EQUAL IF 0 VERIFY ELSE 0 PICK 3     (a tag/kind dispatch rejection)
    126, 175 : PICK 2 PICK 1 INVOKE PUSH1 PICK EQUAL VERIFY             (require a == b)
    133      : INVOKE ENDIF ENDIF ELSE 0 SWAP ENDIF TOALT EQUALV ...    (equality-family)

`deferred-no-progress-reads` is still 10 and `deferred-ecrecover-learned` stays at 2, so the resolver still cannot
learn its arguments: the placeholder data satisfies the parse but not the checks that precede the recovery reads.

Next: make the placeholders PLAUSIBLE rather than zero-filled - the cheapest candidate is to mirror the resource
the coordinate rightfully carries (the co-spent input at the same 1:1 coordinate, or the value-chunk commitment the
covenant's own pin would compute from the row's current value), so those equality checks pass and the trace reaches
the recovery/keccak reads. The failing windows above name the checks to satisfy, and `trailingCommitments` already
prints both sides' commitment heads for comparison.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 117: deferred learning is quantified per stall

New `deferredRemaining` field in `deferred-no-progress-reads` (from
`stb.getDeferredComputeRemainingForDiagnostics()`): how many keccak preimages and ecrecover argument blobs are
still unlearned when the resolve loop gives up. Measured on the focused window (10 stalls):

    5 stalls : ecrecover 8/8 unresolved, keccak 2/2 unresolved      <- nothing learned at all
    3 stalls : ecrecover 8/8 unresolved, keccak 0/2 unresolved      <- all keccak learned, no ecrecover
    2 stalls : ecrecover 7/8 unresolved, keccak 0/2 unresolved      <- ONE ecrecover argument learned

so the learning machinery does work when the probe survives far enough: the recovery read is reachable in at least
one row, and each learned member advances the derivation. The remaining blocker is that the probe's placeholder
data fails the checks that precede the OTHER reads, which is exactly what the VERIFY windows name.

Also this round: a placeholder refinement (mirroring a co-spent input's real token, and shaping the placeholder
body like `uint16-le index || data`) was implemented and then REVERTED - measured identical on every signal
(learned 0/2, no-progress 10, OP_SPLIT 0; earlier "learned 2" readings came from pre-ROUND-116 runs), so the
simpler ROUND-116 placeholder is kept and the working tree carries only the diagnostic addition.

Next: use the VERIFY windows to satisfy the specific checks that precede the recovery reads. The three shapes seen
are a tag/kind dispatch (`VERIFY ELSE 0 PICK 2 EQUAL IF 0 VERIFY ELSE ...`), `require a == b`
(`PICK 2 PICK 1 INVOKE PUSH1 PICK EQUAL VERIFY`) and an equality-family check; each needs its placeholder
coordinate's body to equal what the covenant computes, which `trailingCommitments` can now be compared against.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 118: the failing checks compare LOCKS and EMPTY items

`deferred-no-progress-reads` now carries `failingStack` - the top of the terminal state's stack as
length-prefixed hex - so the operands of the aborting check are visible, not just its opcode shape. Measured
(builds 40/67/74):

    build 40 : 35:aa20ac44e8d6... (p0 data NFT lock), 35:aa20e61fa6c6..., 35:aa2037bea4b7..., 0:, 0:, 1:02
    build 67 : 0:, 35:aa20ac44e8d6..., 35:aa20e61fa6c6..., 35:aa2037bea4b7..., 0:, 0:
    build 74 : (identical to 67)

so the VERIFY checks compare 35-byte P2SH32 locking bytecodes and several EMPTY items (the `1:02` on build 40 is a
one-byte `0x02` - a small ordinal/tag). The empty operands are the interesting part: a token-less coordinate yields
an empty item for the category/commitment introspections, exactly like the output-side pads did before ROUND 116.

Experiment (reverted): give the PROBE's `sourceOutputs` the same structural placeholder (both sides agreeing at
every 1:1 coordinate). Measured reach:

    outputs-only (ROUND 116/117) : 5x keccak 2/2 unresolved, 3x keccak 0/2, 2x ecrecover 7/8
    both sides                   : 5x keccak 2/2, 5x keccak 1/2          <- SHORTER reach, no ecrecover learned

so input-side placeholders change what earlier checks compare and cost reach; the change was reverted, and the
restored tree reproduces the ROUND-117 distribution exactly (verified in the same session).

Next (narrower than the reverted experiment): identify WHICH coordinate's input the failing comparison reads - the
empty operand plus the lock operands should locate it - and give a placeholder to that coordinate only, or make
the check's expected operand match. `deferred-stall-io-full` prints `trailingPublished`/`trailingCommitments` and
`deferred-no-progress-reads` prints the introspection sequence, so the coordinate can be pinned from the same logs.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 119: the probe's verifier input is missing its `localBatch` and `suppliedBlockSize`

`deferred-no-progress-reads` now decodes the executing input's unlocking bytecode into its pushdata items and
names them from the artifact's `messageBus.verifierProgram.inputs`. Measured (builds 40/67, identical):

    witness count 5, lengths [4, 21, 0, 1, 0], empty at indexes [2, 4]
    empty names    ['localBatch', 'suppliedBlockSize']
    declared       ['activeInputIndex', 'expectedLocalRows', 'localBatch', 'suppliedFixedSize',
                    'suppliedBlockSize', 'suppliedEmissions', 'suppliedCallers',
                    'suppliedSettlementBoundary', 'suppliedCompletionPositions', ...]

So the TWO empty operands that the failing checks compare against locking bytecodes (ROUND 118) are the atomic
verifier's `localBatch` - the batch blob itself - and `suppliedBlockSize`. Everything ROUNDS 109-118 measured about
chunk bands, chain walks and trailing pads is a consequence of tracing a verifier invocation whose batch argument
is empty; the covenant then computes empty values, compares them against real 35-byte P2SH32 locks and fails.

Next: establish why `localBatch`/`suppliedBlockSize` are empty on this path and whether they must be filled for the
PROBE run (or whether this verifier invocation is the wrong one to trace). The verifier's own codegen comment says
its covenant supplies exactly `verifierProgram.inputs` "with the authenticated envelope deliberately left
underneath", so an empty `localBatch` may belong to a script path that expects the batch on the stack - in which
case the trace has to be taken from the invocation that does carry it (the composer builds the verifier input's
unlocking bytecode in `compose.ts`; that is where the values come from).

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 120: ROUND 119's "empty localBatch" was a POSITIONAL-MAPPING error

New composer-side record `verifier-arguments` (gated by ENTRY_COUNTS) reports every verifier argument by its
DECLARED name together with its actual value - the only place where names and values are both known, because the
unlocking bytecode also carries non-ABI items and a positional mapping mislabels them. Measured:

    participant 0  batchBlob 199 bytes  empty args: []
    participant 1  batchBlob 353 bytes  empty args: ['suppliedEmissions']
    participant 2  batchBlob 214 bytes  empty args: ['suppliedEmissions']

so ROUND 119's claim - that `localBatch` and `suppliedBlockSize` are empty - is FALSIFIED: the empty items in the
unlocking bytecode are NOT the batch blob. The 21-byte item that ROUND 119 read as `expectedLocalRows` is in fact
the `batchBlob` (a canonical batch blob is >= 19 bytes: `SCB1` + version + row count + ...), and `expectedLocalRows`
is a BigInt that cannot be 21 bytes at all - the positional mapping was off by one because the script carries items
the ABI does not declare.

What IS empty is `suppliedEmissions` for participants 1 and 2, which is the graph-emission transcript
(`graphRouteContext` filters rows by `kind === 0 && parent !== 0xffff && owner === participant`). A participant
that owns no emitted rows legitimately has an empty transcript, so this is NOT yet evidence of a defect: the next
step is to check whether the verifier's checks depend on a non-empty emission transcript for those participants
(the route's own binding digest does include them, so an empty value must match what the compiler bound).

Consequence for the investigation: ROUNDS 109-118's chain (band coordinates, chain walks, trailing pads, chunk
parse aborts) stands as measured, but ROUND 119's "the batch blob is missing" shortcut does not, and no fix should
be built on it. The failing checks compare 35-byte P2SH32 locking bytecodes against items that came out empty
(ROUND 118) - with the verifier's arguments now nameable, the next round can map those empties onto the real ABI
parameters instead of guessing.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 121: the empty operands are NOT route arguments

New field `routeArguments` in `deferred-stall-io-full`: for every participant it decodes the MASTER input's
unlocking bytecode - which is the packed route ABI argument vector, and unlike the verifier's script it is packed
exactly as declared, so a positional mapping is sound - and names the empty entries from
`artifact.messageBus.route.inputs`. Measured:

    build 40 : p0 empty[], p1 empty[], p2 empty[], p3 empty[], p4 empty[__internal__graphFixedSize]
    build 67 : p0 empty[], p1 empty[]
    build 74 : p0 empty[], p1 empty[]

so the two EMPTY stack operands the failing checks compare against 35-byte P2SH32 locks (ROUND 118) do NOT come
from the route argument vector. They must come from a per-row/per-slot witness lookup (the `_rN` / vmap witness
family) that the probe build leaves unset, or from an introspection of a coordinate with no token. The single
empty value found is `__internal__graphFixedSize` for participant 4 in build 40.

Next: list the values the covenant actually picks for those witness families in the probe program. The cheapest
decisive measurement is to make `failingStack` self-describing: record, for each of the top stack items, whether
an IDENTICAL byte string appears as a route argument, as a graph argument (`verifier-arguments`), or nowhere -
items that appear nowhere are witness lookups, and their emptiness is then the thing to fill.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 122: the compared values are now self-described (`known` / `nowhere` / `empty`)

`failingStack` entries now carry an `origin`: `known` when the byte string appears among the values the program
actually carries (any input's unlocking-bytecode pushdatas, and every source/output locking bytecode, token
category and commitment), `nowhere` when it does not, `empty` for zero-length items. Measured:

    build 40 : 35:aa20ac44e8d6 known | 35:aa20e61fa6c6 known | 35:aa2037bea4b7 known | 0: empty | 0: empty | 1:02 known
    build 67 : 0: empty | 35:aa20ac44e8d6 known | 35:aa20e61fa6c6 NOWHERE | 35:aa2037bea4b7 known | 0: empty | 0: empty

So the operands split cleanly into (a) locking bytecodes the program really carries - including the participant's
own data-NFT lock `aa20ac44e8d6` and another contract's `aa2037bea4b7` - (b) two EMPTY items, which are the values
the covenant computed for that comparison, and (c) in build 67 one compared lock (`aa20e61fa6c6...`) that appears
NOWHERE in the program, i.e. the covenant computed an address for a resource the SDK never published.

That last one is the concrete, actionable shape: the covenant expects an OUTPUT at a computed collection/chunk
address for the current value, and the SDK published nothing there - consistent with ROUNDS 114/115 (no
chunkable-writer candidates in the composed path, so the band is never planned) and with ROUND 116 (a placeholder
stops the parse abort but cannot satisfy the identity comparison).

Next: identify that computed address - it is the lock the covenant compares against, so it is derived from
(category, collection, slot, root) with the CURRENT row values. Reproducing it off-chain (the same
`computeValueChunkDomain`/`getValueChunkLockingBytecode` recipe, with the slot and root the row's value yields)
tells exactly which chunk output the SDK must publish, and the `verifier-arguments`/`routeArguments` records now
give the row's inputs.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 123: operand origin hardened (whole-item -> substring) and the `nowhere` set is now exact

The `known` test in `failingStack` only matched WHOLE carried items, but a carried value can contain the operand
nested inside a larger blob (a graph-emission transcript or a record payload embeds other contracts' locks - the
same `aa20e61fa6c6...` lock appears inside `suppliedEmissions` (463 bytes) and inside p0@64's trailing commitment).
The test now also accepts substring matches of any carried value. Measured over the ten stalls:

    origins: known 38, empty 37, nowhere 5

so the operand picture is now exact: most compared values are carried by the program, the `empty` items are the
values the covenant computed, and FIVE locking bytecodes are genuinely absent from the program.

Also tried and NOT yet successful: explaining a `nowhere` lock as a value-chunk address
(`getValueChunkLockingBytecode(category, collection, slot, root)` replayed from every published commitment >= 100
bytes, taking `slot = [0:32]` and `root = [68:100]` per the `slot || next || len(4) || root(32)` entry layout).
No collection produced the lock, so either the entry layout offset or the collection set is wrong for that value,
or the missing resource is not a value chunk.

Next: print, for each of the 5 `nowhere` locks, every candidate the recipe produced (not just the match) plus the
commitments it was replayed from, and cross-check against `trailingCommitments`/`trailingPublished` for the same
build - that will say whether the SDK is missing an output for a resource the covenant names, or whether the lock
is derived from something else entirely (an event/return covenant address, or a proxy/data address of a participant
that this build does not include).

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 124: every compared operand is accounted for - the blocker is the empty COMPUTED values

The `failingStack` origin test was in a MIXED state: the origin line still used the whole-item `known` set while
the family probe used the substring test, which produced five phantom `nowhere` locks (all the same address,
`aa20e61fa6c6...`, across builds 67/74/104/126/140) and made the family field absent exactly where it was needed.
The substring predicate is now defined once (`isCarried`, matching a carried value exactly or as a nested
substring) and used by both. Measured over the ten stalls:

    origins: known 43, empty 37, nowhere 0

So EVERY operand the failing checks compare is either a value the program really carries - the previously
"nowhere" locks turn out to be embedded inside carried blobs (the graph-emission transcript and the trailing
record payloads) - or a zero-length item, which is the value the covenant COMPUTED for that comparison. The
address-family probe (data NFT / entry / event / value-chunk replays) therefore has nothing left to explain, and
the round 122/123 hunt for a missing address is closed: the SDK is not failing to publish an address, it is
failing to supply a VALUE.

That is consistent with ROUND 121 (route and verifier argument vectors are non-empty) and points the next step at
the empty computed operands themselves: they come from witness lookups the probe leaves unset (the `_rN`/vmap
family). The concrete next measurement is to record, for the failing comparison, WHICH witness name produced the
empty value - the route ABI vector is non-empty, so the empty must be an unset per-row/per-slot witness, and the
covenant's own witness-name list (the `__internal__vmap*` family) can be enumerated against the values the probe
carried.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 125: the graph transcript vectors, participant by participant

`routeArguments` now prints the full `name=length` table (not just the empty entries) so a witness read can be
matched to its ABI position; the route unlocking bytecode is not a flat pushdata vector, so the decoder stops at
the first non-pushdata opcode and the table is partial by construction (recorded as such). The
`verifier-arguments` record gives the reliable side. Measured across the failing builds:

    p0  blob 199  expectedLocalRows 1  emissions 1073  callers 27   completions 2   boundary 9
    p1  blob 353  expectedLocalRows 5  emissions 0     callers 185  completions 10  boundary 9
    p2  blob 214  expectedLocalRows 3  emissions 0     callers 111  completions 6   boundary 7
    p0  blob 21   expectedLocalRows 1  emissions 932   callers 27   completions 2   boundary 12

So `suppliedEmissions` is EMPTY for exactly the participants that own no emitted rows (p1 with 5 declared rows,
p2 with 3) while their caller and completion vectors are populated - which is consistent with the compiler's
per-participant filter (`kind === 0 && parent !== 0xffff && owner === participant`) and with the composer throwing
only on UNDEFINED arguments, so an empty transcript is by design. It is therefore NOT by itself the missing value;
the empty COMPUTED operands (ROUND 124) are still unattributed.

Next: attribute the empties directly instead of by elimination. The covenant's failing comparison reads a value it
computes from parsed fields; the cheapest decisive measurement is to record the last few COMPUTED stack items with
their producing instruction (the trace already walks every state), i.e. for the terminal frame, list the preceding
4-6 instructions that pushed the empty operands - that names the field (a `PICK` of a witness slot, a `SPLIT` of a
short blob, or a `CAT` of an empty argument) without guessing.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 126: why the band is never planned, and why the obvious relaxation is wrong

Located the gate that stops the SDK from planning the value-chunk band in the composed kernel path:

    permitsLegacyNamedValueChunkFallback(groups, ownerConvention) {
      if (ownerConvention === 'kernel-row-loop') return false;      // <- our convention
      return !groups.some((group) => ... artifact.messageBus?.convention === 'kernel-row-loop');
    }

and the artifact survey that explains the asymmetry behind it:

    MarketplaceV1.artifact.ts      `__internal__valueChunkOutputBase` occurrences: 0
    MarketplaceDataV1.artifact.ts  `__internal__valueChunkOutputBase` occurrences: 13

i.e. the compiler DOES inject the chunk-base witness where the write happens (the implementation/delegate
function), but never into the proxy route that the SDK builds and composites - and the route is the only thing the
composer can claim a writer from. So under `kernel-row-loop` the named fallback is closed and the descriptor path
has no producer (ROUND 114): the band can never be planned.

Fix attempt and its measured result (reverted): relax `groupChunkableValueWriteResource` so the claim is accepted
when the selected function's ABI names exactly one chunkable-value collection it writes, even under
`kernel-row-loop`:

    before : 2 failed | 1 passed   (sanity checks GREEN, 10 stalls)
    after  : 3 failed              (sanity checks 10.5s failure - the claim fires where it should not)

so the relaxation is correct in DIRECTION but must be scoped to the composed participant (`this.composedParticipant`),
where the band geometry is participant-local - not applied at group level, where an ordinary direct send also
matches. That scoping is the next change to make, and it is a fix attempt rather than instrumentation.

Also this round: the `failingTrace` instrumentation (trace tail with stack sizes) was added, read once (the tail is
`OP_OUTPUTTOKENCATEGORY` / `OP_OUTPUTTOKENCOMMITMENT` then `EQUALVERIFY` with an empty operand), and REVERTED -
per the operator's steer the effort is shifting from diagnostics to fixes.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 127: the scoped relaxation is safe but inert - the proxy route ABI describes no chunkable write

Landed `fix(solidcash): allow a compiler-described chunkable write claim for composed participants`:
`selectChunkableValueWriteExecution(candidates, { allowCompilerDescribed })` accepts a resource from
`groupChunkableValueWriteCollections(group)` when the flag is set, and only `StatefulTransactionBuilder`
passes it - and only when `this.composedParticipant === true`. Measured:

    group-level relaxation (ROUND 126) : 3 failed  (sanity checks REGRESSED)
    composed-scoped relaxation (this)  : 2 failed | 1 passed, sanity checks GREEN, 10 stalls (unchanged)

so the scoping fixes the regression, but the relaxation never FIRES: `groupChunkableValueWriteCollections`
reads the selected function's ABI metadata (`messageBusActiveWriteCollections` + `entryAccesses` + the
collection's `chunkableValue`), and the participant the composer builds is the PROXY route, whose ABI lists only
the whitelist entries - the chunkable `jobEvents` write belongs to the implementation, which the route ABI never
mentions (ROUND 126's artifact survey: 0 occurrences of the chunk-base witness in MarketplaceV1, 13 in
MarketplaceDataV1). Nothing to claim, so nothing changes - measured, not assumed.

That closes the diagnosis of this class: the band is never planned because the composer's participant ABI does not
describe the chunkable write, and the two ways forward are now both named:
  (a) compiler: propagate the delegate's chunkable-write description into the CALLER's route ABI (so
      `messageBusActiveWriteCollections`/an equivalent claim names it); or
  (b) SDK: let the claim consult the IMPLEMENTATION artifact the participant delegates to (the composer knows the
      delegate/LLC wiring) instead of only the ABI it builds.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 128: the chunk source split, and where the deterministic derivation must plug in

Read the P5b machinery in `StatefulContract` and found the split that matters:

    if (isWrite && collection.chunkableValue) {
      const vIdx = access.valueParam ? ... : -1;
      const raw = vIdx >= 0 ? entryArgs[vIdx] : undefined;
      if (vBytes) { if (vBytes.length > 60) valueChunkMints.push({ collection, slot, digest: sha256(vBytes),
                                                                chunks: splitValueIntoValueChunks(vBytes) }); }
      else { ... addComputedValueChunkRun(access.collection, slot); }        // <- trace discovery
    }

so a DIRECT value param produces the pinned continuations deterministically, while a handler-COMPUTED value
(publishJobEvent's array value) registers a computed run that the SDK resolves by trace discovery - and that
discovery is exactly what the unpublised chunk slot deadlocks (the probe halts before it reaches the pin).

Attempted fix (reverted): in the computed branch, when the route carries `messageBusRowArguments`, encode the value
from the row arguments - the code immediately above already builds exactly that encoding
(`encodeLeadingRouteArrayPushes({ rowArguments, collection, valueType, structs, timestamp, resolveElement:
this._encodeStoredElementSource(...) })`) - and push a `valueChunkMints` entry with its digest/chunks instead of a
computed run. Measured:

    after the change : 3 failed (sanity checks REGRESSED) and the first error is
                       `messageBus: participant 1 built 87/146 slots, expected balanced block size 87`

so the derivation direction is plausible but the mints materialize at the LAYOUT-relative base, growing the
participant past its balanced block; they must be placed at the COMPOSED band base (the `composedTrailing` /
`getComposedBlockBase()` coordinates the band planner already uses) for a composed participant. Reverted; the
mints/`valueChunkMints` path is the right lever, the placement is the open detail.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 129: the band work is landed but inert - back to the VERIFY class next

Landed (sound, general, no regression): a kernel route whose handler-computed value is reproducible from its
`messageBusRowArguments` now derives the pinned continuations deterministically
(`valueChunkMints.push({ collection, slot, digest: sha256(value), chunks: splitValueIntoValueChunks(value) })`)
instead of registering a trace-discovered run, and a COMPOSED participant pins those chunks into its own trailing
run (`setDerivedChunkOutput(composedBase + i, ...)`, the same local coordinates the band planner and the composer's
absolute shift use) rather than appending them past the balanced block. The row-argument encoding is also attempted
when the OLD value is unavailable but the key is absent (an INSERT starts from the empty array).

Measured across three consecutive attempts in this area - all of them safe, none of them effective for these
builds:

    deterministic derivation                : 2 failed | 1 passed, sanity green, 10 stalls
    + composed placement (setDerivedChunk)  : 2 failed | 1 passed, sanity green, 10 stalls
    + absent-key old value relaxed          : 2 failed | 1 passed, sanity green, 10 stalls
    (the earlier layout-relative placement) : 3 failed - `participant 1 built 87/146 slots` (reverted)

Conclusion recorded for the next round: the value-chunk band is NOT what blocks these ten builds. Whatever the
deterministic path computes, the failing builds never reach it (identical stall count and identical error), so the
band changes are inert here and the blocker remains the VERIFY class measured in ROUNDS 116-124: the failing
comparisons read a value the covenant COMPUTED (empty) against locking bytecodes the program carries.

Concrete next idea (fix, not instrumentation): the builder stages each entry's commitment before the probe, so the
probe's placeholder chunk commitment can mirror the AUTHENTIC data the staged entry implies - i.e. derive the
placeholder's `uint16 index || data` body from the entry's own tail (`len || root`) where the data can be recovered,
so the covenant's pin comparison has a chance to pass instead of comparing zeros. If that is not recoverable for a
handler-computed value, the honest alternative is to make the covenant's read fail closed EARLIER than the
recovery read it must reach - which is a compiler-side ordering question.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green, no full-ladder
run (no title turned green).

### ROUND 130: other ladder windows fail for DIFFERENT, actionable reasons (and verify in seconds)

I had been looking only at `take job` for ~20 rounds. Two neighbouring windows measured this round:

    -t 'close job'   : 1 failed | 1 passed
        close job before timeout  PASSES (26s)
        close job after timeout   FAILS: "Cannot send stateful transaction: state commitments could not be
                                   auto-derived. Reason: Full state derivation failed: Route probe convergence
                                   repeated a physical transaction state. Use .setState() to provide state values
                                   manually."                       <- the 4-title convergence class
    -t 'job updates' : 1 failed | 4 passed
        update job                     PASSES (80s)
        update job arbitrator          PASSES (28s)
        update job tags                FAILS in 15s with:
            messageBus [L3_RESOURCE_UNRESOLVED]: message-bus batch collection witness
            '__message_bus_key_meceTags_0' must identify one physical entry
        update job amounts             PASSES (48s)
        update job many times, history PASSES (218s)

The second one names a witness and comes from `packages/solidcash/src/message-bus/message-bus.ts:851`, in the
SWAPPABLE key path:

    const varyingInput = varying.perRow ? `${varying.routeInput}_r${rowIndex}` : varying.routeInput;
    const selectedVarying = sharedMatches ? {value: varyingValue, encoded: varyingEncoded}
                                          : {value: sharedValue, encoded: sharedEncoded};
    const priorVarying = keyWitnessValues.get(varyingInput);
    if (priorVarying && priorVarying.encoded !== selectedVarying.encoded) throw ... 'must identify one physical entry'

i.e. one witness NAME is being assigned two different key values across rows, which only happens when the binding
is not row-qualified - the compiler-side `perRow` flag on the route key witness (see the route metadata's
`__message_bus_key_meceTags_0` vs `..._row` shapes and `alternateRouteInput`). That is a small, general,
compiler-side fix with a 15-SECOND verification loop (`-t 'update job tags'`), which is the fastest feedback this
climb has had.

Next round (fresh budget): fix the compiler's per-row qualification for the meceTags-style varying key, verify with
`-t 'update job tags'`, then run `-t 'job updates'` and the full ladder if a title turns green.

Focused state (unchanged): `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green.

### ROUND 131: `update job tags` - distinct literal keys collapse onto one route witness name

Two experiments and one artifact survey settled the cause of the `L3_RESOURCE_UNRESOLVED` on `-t 'update job tags'`
(the fast 15-26s loop):

1. First hypothesis (compiler `perRow` for kernel param-keyed resources) - tested and REVERTED. Setting
   `perRow = alternativeIndex > 0` for the kernel case did not change the error, and the compiler's own comment
   explains why that flag must stay off there: the two alternatives of a param-keyed kernel resource are two
   physical slots of ONE invocation, "not a 2-row resource template ... must not set `resourceShapedHandler` or
   `_rN` copies".
2. The failure context is exactly `{ handler: 'meceTags', resourceIdentity: '__message_bus_key_meceTags_0',
   invocationIds: [2] }`, i.e. the SHARED name (not a `_row`/`_rN` copy) receives a second, different key value.
3. MarketplaceDataV1's meceTags accesses explain why:

       entryAccesses: [
         { slotIndex: 0, collection: 'meceTags', keyParams: ['lit:DA'],
           keySources: [{ kind: 'expression', expressionLabel: 'lit:DA' }], operations: ['write'] },
         { slotIndex: 1, ... 'lit:DV' }, { slotIndex: 2, ... 'lit:DT' },
         { slotIndex: 3, ... 'lit:DS' }, { slotIndex: 4, ... 'lit:DO' }, ... ]

   FIVE DISTINCT literal keys, one per entry slot. The route names key witnesses by (collection, keyIndex,
   alternative) only - "never by the handler or its parameter names" - and every one of these accesses has
   `inputIndex === -1` (an expression), so all five collapse onto the single published name
   `__message_bus_key_meceTags_0`. The SDK then sees one witness name carrying two different literal values and
   rejects the second row.

So the general fix is a NAME DISCRIMINATOR for expression/literal keys: the route witness name must distinguish
the distinct physical entries those literals address (e.g. a short digest of the expression label), threaded from
`entryAccesses[i].keySources[keyIndex].expressionLabel` into the naming loop in `compiler.ts` (the loop currently
has only the `alternatives` index vectors, where every literal is `-1` and therefore indistinguishable). That is a
compiler-only change; the SDK reads the names from the artifact metadata (`batchKeyWitnesses[].routeInput`,
`alternateRouteInput`) rather than hard-coding them, so a consistent rename is safe - and `-t 'update job tags'`
verifies it in ~25s.

Focused state: `-t 'take job'` = 2 failed | 1 passed (green `sanity checks`), `yarn build` green.

### ROUND 132: the fixture artifacts are STALE - compiler-side changes are invisible to the ladder

While trying to land the expression-key discriminator for `update job tags`, three variants produced the byte-for-byte
identical error naming the identical witness. Checking the artifact instead of the code settled why:

    grep -c "_x"                    .marketplace/artifacts/solidcash/MarketplaceDataV1.artifact.ts  -> 0
    grep -o "__message_bus_key_meceTags[^']*" ...                                                  -> __message_bus_key_meceTags_0
    ls -l --time-style=+%H:%M  ...                                                                 -> 15:40 (touched, CONTENT unchanged, 1229326 bytes)

i.e. the fixture artifact predates every compiler edit of this session: it still publishes the un-discriminated
`__message_bus_key_meceTags_0`. The attempted recompiles did not help:

  - `bash .marketplace/iteration/recompile.sh contracts/MarketplaceDataV1.sol contracts/MarketplaceV1.sol`
    fails for both sources with a stack ending in `at selectCompileSources
    (packages/testing/dist/builtin-tasks.js:80:19)` and copies the stale merged files back;
  - `rm -rf .marketplace/cache .marketplace/vite-cache-marketplace .marketplace/vite-cache-mece` followed by a
    fresh `-t 'update job tags'` run leaves the artifact untouched (same size, same content, same missing suffix).

IMPLICATION (important for every remaining round): the LADDER only exercises SDK changes (built into
`packages/solidcash/dist`); COMPILER changes are invisible until the marketplace fixture is actually recompiled.
That is why the last several compiler-side experiments (perRow, both naming branches) showed no effect - they were
never compiled in. All of them have been REVERTED; the tree carries no unvalidated compiler change.

Evidence that SDK-side work IS exercised: the ladder's behaviour changed repeatedly with SDK edits (OP_SPLIT class
eliminated, stall counts, error texts), so the SDK conclusions from ROUNDS 96-129 stand.

NEXT ROUND (do this first): find the compile step the marketplace fixture actually uses and make it regenerate -
candidates: the project-level task behind `.marketplace/project` (the vite config / setup file in
`.marketplace/project` that produced `artifacts/solidcash` and the `vite-cache-*` directories), `packages/testing`'s
`compile` task with `KB_ARTIFACTS`/`KB_CACHE` set correctly (the recompile helper's invocation is the failing one),
or a hard `rm -rf .marketplace/artifacts/solidcash` followed by whatever command repopulates it. Verify success by
the discriminator appearing in the artifact (`grep -c _x ...` > 0) BEFORE re-testing any compiler fix.

Focused state: `-t 'update job tags'` = 1 failed (unchanged, stale artifact), `-t 'take job'` = 2 failed | 1 passed,
`yarn build` green, tree clean.

### ROUND 133: the fixture recompile path is REPAIRED - compiler changes now reach the ladder

Root cause of ROUND 132: the compile task resolves `--iteration` against the CURRENT directory, and
`.marketplace/iteration/recompile.sh` passed a bare `contracts/<File>.sol` while `cd`-ing into `.marketplace/iteration`
first, so the source never resolved and the run died at `selectCompileSources` - silently leaving the stale fixture
in place. Repaired in the script (resolve the source against `.marketplace/contracts` before invoking, and skip
loudly when it is missing) and VERIFIED end to end:

    bash .marketplace/iteration/recompile.sh contracts/MarketplaceDataV1.sol contracts/MarketplaceV1.sol
    -> Compiled 1 Solidity source(s) in 1 compiler job(s) (0 cache hit(s)) -> 1 artifact(s)   (both sources)
    -> merged files: 22, fixture json count: 105
    -> fixture mtimes move to the current minute

So the loop is now: edit compiler -> `yarn build` -> `bash .marketplace/iteration/recompile.sh <sources>` ->
`npx vitest run -t '<title>'` (~26s). That is the first round in this session where a compiler change can actually
be validated.

Attempted and REVERTED (incomplete, not validated): the expression-key discriminator for `update job tags`. The
route key name is constructed at FOUR sites in `compiler.ts` and they must agree:
  1. the alternatives-branch naming loop (~5813),
  2. the single-alternative branch's witness list (~5873),
  3. the handler-body rewrite inside `handler.body.statements.flatMap((statement) => ...)` (~7640),
  4. the second rewrite inside `walkInvocationAst(handler.body, (node) => ...)` (~7677).
Sites 3 and 4 are the ones the ARTIFACT actually renders (`entryAccesses[].keyParams`), which is why patching 1
and 2 alone changed nothing. Each site needs the discriminator computed from its OWN enclosing variable
(`statement.name` at site 3, `node.name` at site 4); the attempt had them swapped and the helper defined after site
3, which fails to compile. Reverted, so the tree carries no unvalidated compiler change.

Next round (the loop is fast now): re-apply the discriminator at all four sites with the correct scopes, verify the
suffix appears in the fixture (`grep -o "__message_bus_key_meceTags[^']*" .../MarketplaceDataV1.artifact.ts` should
show `_x...` entries), then run `-t 'update job tags'` and `-t 'job updates'`.

Focused state: `-t 'take job'` = 2 failed | 1 passed, `yarn build` green, tree clean.

### ROUND 134: the meceTags key is a PARAMETER, not an expression - that is why the name is shared

With the repaired recompile loop I could finally instrument the *compile* (env-gated, removed again) and read what
the route naming actually sees:

    key-witness-name {"site":"single","fn":"readMeceTag",  "collectionName":"meceTags","alternatives":1,
                      "keyIndices":[0],"accessKeys":[]}
    key-witness-name {"site":"single","fn":"updateMeceTag","collectionName":"meceTags","alternatives":1,
                      "keyIndices":[0],"accessKeys":[]}
    key-witness-name {"site":"single","fn":"meceTags",     "collectionName":"meceTags","alternatives":1,
                      "keyIndices":[0],"accessKeys":[]}

Three facts, each different from my earlier reading:

1. the key reaches the naming with input index **0** - the FIRST PARAMETER - not `-1`, so the expression-key
   discriminator never applies (it keys off `-1`), which is why four attempts changed nothing;
2. `alternatives: 1`, so the multi-alternative branch is not taken either - the single-alternative branch names it
   `__message_bus_key_meceTags_0`, one name for the whole route;
3. `accessKeys: []` - the naming runs BEFORE admission populates `entryAccesses`, so nothing there can be consulted
   for an identity at this point.

The artifact agrees with this and explains the failure: the data contract's five meceTags accesses are
`keyParams: ['lit:DA'] … ['lit:DO']` (five DISTINCT literals, desugared per slot) while the route publishes ONE
string parameter `__message_bus_key_meceTags_0`. Each row calls the handler with a different literal through that
same parameter, so the SDK assigns one witness name two different values and rejects the second ('must identify one
physical entry', invocationIds [2]).

FIX DIRECTION (general): a PARAMETER key whose value differs between route rows must be row-qualified
(`perRow`/`_rN`), exactly like the multi-alternative case - the existing cross-handler row-locality analysis
(`crossHandlerPerRowWitnesses`) covers aliases within one handler but not distinct literals passed by different
rows of the same handler. Either extend that analysis to per-row argument values, or bind the key from the row's own
argument instead of a single route witness. The verification loop is now fast: edit -> `yarn build` ->
`bash .marketplace/iteration/recompile.sh contracts/MarketplaceDataV1.sol` ->
`grep -o "__message_bus_key_meceTags[^']*" .marketplace/artifacts/solidcash/MarketplaceDataV1.artifact.ts`
(expect more than one name) -> `npx vitest run -t 'update job tags'`.

All instrumentation and the incomplete discriminator are reverted; the tree carries no unvalidated compiler change.

Focused state: `-t 'take job'` = 2 failed | 1 passed, `-t 'update job tags'` = 1 failed (unchanged), `yarn build`
green, tree clean.

### ROUND 135: the exact knot - row locality is decided BEFORE the labels that could decide it

Located both halves of the mechanism in `compiler.ts`:

    // ~7300, route construction (BEFORE key resolution)
    for (const [routeInput, bindings] of bindingsByRouteInput) {
      const identities = new Set(bindings.map((binding) =>
        `${binding.source ?? 'argument'}:${binding.inputIndex}:${binding.expressionLabel ?? ''}`));
      if (identities.size <= 1) continue;
      crossHandlerPerRowWitnesses.add(routeInput);
      for (const fn of eligible) for (const binding of fn.messageBusKeyWitnesses ?? []) {
        if (binding.routeInput === routeInput) binding.perRow = true;
      }
    }

    // ~13456, artifact assembly (AFTER resolution)
    for (const witness of fn.messageBusKeyWitnesses ?? []) {
      if (witness.source !== 'expression' || witness.expressionLabel) continue;
      for (const access of fn.entryAccesses ?? []) { ... if (source?.kind === 'expression')
        witness.expressionLabel = source.canonical; }
    }

The identity string already includes `expressionLabel`, so the per-row decision is *designed* to see literal
differences - but the label is only FILLED at artifact assembly, long after the decision is taken, and only for
witnesses whose `source === 'expression'`. The meceTags witnesses are `source: 'argument'` (their value arrives as
the handler's first parameter, index 0) with the literal living in the ACCESS's `keySources` as an expression, so
their labels stay empty at decision time: five rows with literals `lit:DA … lit:DO` compare as the single identity
`argument:0:` and the witness is never marked per-row.

Consequence for any fix: marking `perRow` after assembly is NOT enough, because the route ABI's parameter names are
produced by the earlier naming pass (`__message_bus_key_meceTags_0` with no `_row`/`_rN` variant when there is one
alternative), so a late `perRow` flag would reference parameters that do not exist. The workable shapes are:
  (a) derive the argument keys' literal identity EARLIER - from the route rows' call-site arguments rather than
      from resolved `entryAccesses` - so both the naming pass and the per-row decision see it; or
  (b) after resolution, re-derive BOTH the witness names (adding the row-qualified variants to
      `routeKeyWitnesses` / the route ABI) and `perRow`, in one consistent re-run of the naming step.
Either way the verification is the fast loop recorded in ROUND 134: build -> recompile.sh -> grep the artifact for
more than one `__message_bus_key_meceTags*` name -> `npx vitest run -t 'update job tags'`.

Focused state: `-t 'take job'` = 2 failed | 1 passed, `-t 'update job tags'` = 1 failed, `yarn build` green, tree
clean (no unvalidated compiler change).

### ROUND 136: the convergence guard was throwing on a FIXED POINT - 2 titles turn green

Widened the survey instead of staying on meceTags, and the convergence class turned out to be a one-line guard
bug. The route-probe loop in `StatefulContract.ts` (~13995) is:

    if (!progressed) break;
    const nextProbe = stb.build();
    const nextFingerprint = binToHex(encodeTransaction(nextProbe.buildLibauthTransaction()));
    if (routeProbeTransactions.has(nextFingerprint)) {
      throw new Error('Route probe convergence repeated a physical transaction state.');
    }

A repeated physical transaction means this pass APPLIED every observation the trace revealed and the built
transaction is unchanged - that is a fixed point, i.e. convergence, not failure. The guard treated it as failure and
surfaced as `Cannot send stateful transaction: state commitments could not be auto-derived. Reason: Full state
derivation failed: Route probe convergence repeated a physical transaction state.` The loop now `break`s on the fixed
point.

Measured (focused windows):

    -t 'close job'            : 2 passed | 64 skipped   (before: 1 failed | 1 passed)
        close job after timeout    FAIL -> PASS
    -t 'withdraw collateral'  : 1 passed | 65 skipped   (before: 1 failed)
        withdraw collateral        FAIL -> PASS

So the convergence class is fixed by accepting the fixed point; the handoff's remaining convergence-flavoured
targets are the other titles that reported the same error text (this round's survey found `withdraw collateral` and
`close job after timeout`; a full ladder run follows to confirm the count).

Also surveyed this round (new error signatures worth attacking next):
  - 'mece tags' window: `post job with invalid mece tags` fails with "Expected transaction NOT to be reverted, but it
    reverted"; the three meceTags read/update/remove titles PASS.
  - 'refuse arbitration' window: `job closed` PASSES; `job not taken` fails with an AssertionError
    (`expected 0n to deeply equal 1n`, a state-read mismatch) and `job taken` fails with "Expected transaction NOT to
    be reverted, but it reverted".

### ROUND 136 (continued): full ladder after the fix - 43 pass / 23 fail (was 39/27)

    npx vitest run --config vitest.marketplace.config.ts --reporter=verbose --no-file-parallelism
    -> Tests  23 failed | 43 passed (66)

Four titles turned green from the single fixed-point change (two of them verified individually, the other two
discovered by the ladder), and no title regressed. The new failing set (23), for the next rounds:

    approve result and review > approve result, sanity checks
    arbitrate > arbitrate 0-100, arbitrate 100-0, arbitrate 80-20, sanity checks
    deliver result > deliver result, sanity checks
    dispute > dispute creator, dispute worker, sanity checks no arbitrator, sanity checks with arbitrator
    integration test > integration test
    job posting > post job with invalid mece tags
    job updates > update job tags
    pay start job > pay start job
    post thread message > sanity checks
    refund > refund, sanity checks
    refuse arbitration > job not taken, job taken
    take job > take job, take job multiple

Error signatures already known for some of them:
  - `refuse arbitration > job not taken`: AssertionError `expected 0n to deeply equal 1n` on
    `marketplaceData.arbitrators(arbitrator.address).refusedCount` after `refuseArbitration` - the entry's field
    increment does not land; `refuseArbitration` appears ONLY once in the data artifact (an ABI entry, no
    `entryAccesses`), so it is not a message-bus handler and runs through the direct-call path.
  - `refuse arbitration > job taken` and `job posting > post job with invalid mece tags`: "Expected transaction NOT
    to be reverted, but it reverted".
  - `take job` / `take job multiple`: the deferred-compute stall documented in ROUNDS 96-129 (unchanged by this
    fix; its blocks are the band/witness questions, none of which are the fixed point).

### ROUND 137: deferred argument learning was serialized; the dispute/arbitrate family is the same wall

Surveyed the two biggest remaining clusters. Both fail with "Expected transaction NOT to be reverted, but it
reverted", and the single-title diagnostic run shows why:

    -t 'dispute'    : 4 failed | 1 passed  (sanity checks closed job PASSES)
    -t 'arbitrate'  : 4 failed
    -t 'sanity checks no arbitrator' with ENTRY_COUNTS=1:
        deferred-no-progress-reads build 40: OP_VERIFY at ip 515,
        deferredRemaining {keccakUnresolved 0/2, ecrecoverUnresolved 7/8}

i.e. the dispute/arbitrate family is blocked by the SAME deferred-compute wall as `take job` (ROUNDS 96-129), and it
is one argument short: every keccak resolved and one of eight ecrecover blobs learned.

Landed (general, no regression): `resolveDeferredEcrecoverArgument` learned only the FIRST readable argument per
pass and returned, so a composition that exposes several A inputs advanced by one call per pass - and when a later
probe dies earlier (each round rebuilds the composition) the remaining calls never learn. It now collects every
matching `OP_INPUTBYTECODE` read in the pass and applies them all, skipping candidates whose side-cars are missing
instead of aborting the whole loop.

Measured: `-t 'dispute'` unchanged (4 failed | 1 passed) - the traces evidently expose one argument per pass for
these builds - and `-t 'close job'` still 2 passed | 64 skipped, so the change is a safe generalisation rather than
this window's fix. The remaining wall is the probe dying before the recovery read, which is where the earlier
band/witness work also landed.

### ROUND 138: multi-execution probing landed; the missing reads are behind UNTAKEN BRANCHES

Landed (general, no regression): the deferred resolve loop probed a single execution input, but the
keccak/recovery reads live in per-row bodies and each participant's verifier executes only its own rows. The
composer now passes every participant's verifier coordinate
(`graph.layout.participantInputs[p] + (executorOffset ?? 0)`) and the controller evaluates the probe at each
candidate, starting with its own, stopping at the first trace that teaches something.

Measured:

    -t 'dispute' : 4 failed | 1 passed (unchanged)   but the probe DID change:
        before: deferred-no-progress-reads total 952 reads, failing ip 515
        after : total 1426 reads, failing ip 10
        both  : deferredRemaining { keccak 0/2, ecrecover 7/8 }

    -t 'close job'           : 2 passed | 64 skipped   (no regression)
    -t 'withdraw collateral' : 1 passed | 65 skipped   (no regression)

So the extra executions collect 50% more introspections yet still never reach the seven missing
`OP_INPUTBYTECODE` recovery reads. Combined with ROUND 128's measurement (the only recovery read present is one
input EARLIER than the plan's index, with a 1-byte item below, i.e. the contract's own argument read), the
conclusion is that those reads sit behind control flow the probe's PLACEHOLDER DATA does not enter: the probes are
running, the branches are not. That is the next lever - the placeholders must be plausible enough for the guards
preceding the recovery calls (the same VERIFY family measured in ROUNDS 116-124), not merely parseable.

Focused state: `-t 'take job'` = 2 failed | 1 passed, ladder 43 pass / 23 fail, `yarn build` green, tree clean.
