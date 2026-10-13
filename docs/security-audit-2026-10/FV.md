<!-- cspell:ignore PUTCOUNT argpushes -->
# FV - Framed validator V_TEMPLATE audit

Scope: packages/solidc/src/framed/validator/program.ts (emitted script), checks.ts (derivation),
reference/reference.ts (independent model), utils/src/framed, master/witness-reader.ts.
Method: read-only, traced emitted opcodes per V-rule and diffed the three implementations. No tests run.

## Findings

### FV-1  MEDIUM  SUSPECTED  Record-chain key collides kept (input-indexed) and created (output-indexed) records
Files:
- packages/solidc/src/framed/validator/program.ts:3187 emitBuildKey (and its callers emitCollectRecordEntry:2239, emitCheckOrderedEntry:2318, emitRecordStartView:2363)
- vs derivation packages/solidc/src/framed/validator/checks.ts:380 (`in:${in}` / `out:${out}`)
- vs reference packages/solidcash/src/framed/validator/reference/reference.ts:436 (`out:` / `in:`)

Root cause: the emitted V7 chain walk keys every record entry by a bare 4-byte value
`index_LE(2) || index_LE(2)`: a kept record uses its input index, a created record (in==0xFFFF) uses
its output index, with NO namespace tag. The derivation and the reference model key the two in
disjoint string namespaces (`in:i` vs `out:i`). So for a settled contract that both spends a state
UTXO at input index i (a kept record, key = i||i) and creates a record at output index i (key = i||i),
the program merges the two into ONE chain while both reference implementations keep them as two
independent chains. emitBuildKey's own comment claims created output indices sit "at or past the
participant count" so the spaces can't meet, but nothing in the validator enforces any such lower
bound: the created list is only range-checked against txOutputCount (emitSettledStateInputs ->
emitIndicesAreOutputs), and the builder controls output ordering, so output index i == input index i
is freely reachable.

Why it can be a false-accept: in the program the created-record "starts empty" rule
(emitRecordStartView, program.ts:2363) is applied only to the FIRST entry of a key in V6 order. If the
builder orders the kept entry (in=i) first, that entry sets the chain start to the input-i commitment;
the created entry (out=i) is then treated as a later link and is only held to contiguity
(viewIn == previous viewOut), so its "viewIn must be empty" requirement is never checked. The
derivation/reference, keying it as a separate `out:i` chain, require first.viewIn.length == 0
(checks.ts:464-466, reference.ts:466-469). A merged chain thus lets a newly "created" record be born
carrying a non-empty view inherited from the co-indexed kept record - a forged starting state for the
new record - that the two models reject.

Attack shape (to confirm on the VM): one settled contract X with 2+ masters; input i a mutable catX
state UTXO (kept record, some commitment C); a frame creates a catX record at OUTPUT index i
(created list = [i]); order the two entries so the kept entry is visited first; give the created
entry viewIn == C (not empty) and a viewOut the builder wants. Program: both under key i||i, start = C
from the kept entry, created entry passes as a contiguous link. Reference: rejects
A_CREATED_RECORD_DOES_NOT_START_EMPTY. Result: a created record (e.g. a fresh mapping node) is minted
already holding another record's state.

Caveats / confidence: SUSPECTED. (a) Needs a VM test to confirm the collision and that the ordering
puts the kept entry first; (b) the writing master's own W2 settlement may independently force
created records to start empty for some record kinds, which would blunt it where it applies - but the
validator is the declared backstop and memory notes "mapping-node/chunk covenants pin nothing
themselves; the settlers do", so coverage is uneven. Even if not exploitable, it is a genuine
program-vs-reference divergence in the V7 chain core and should be closed (tag the key with the
in/out namespace, as the two models do, or enforce created output index >= a participant bound).

Suggested fix: prefix the emitted key with a 1-byte namespace tag (0x00 for kept/input, 0x01 for
created/output) so emitBuildKey matches checks.ts/reference.ts, or add a validator check binding each
created output index out of the kept input range.

## Checked and sound (traced emitted opcodes)
- V1 self-recreation: lock/category/commitment OP_EQUALVERIFY and value OP_GREATERTHANOREQUAL at own index; minting-of-own-category loop (emitSelfRecreation program.ts:463). Sound.
- V1 head entry: 33-byte mutable pin, category == OP_INPUTINDEX OP_UTXOTOKENCATEGORY, lock == P2SH32(activeBytecode) (emitHeadEntry:326). Sound.
- V2 header: size>=4, magic "PC7\x02", rootCount!=0 (emitTranscriptHeader:490). Sound.
- V2 index lists: roots/masters/stateInputs/created each range-checked unsigned vs TX(IN|OUT)PUTCOUNT; trailing-byte size==0 guard after settle walk (emitRootsAreInputs/emitMasterIndices/emitSettledStateInputs). Sound.
- V2 witness decode: consumeWitnessBlock (program.ts:3290) magic/version/kind(0..5)/lp fields/segCount==callCount+1/record shape (no create+delete, no move)/trailing==0; counts read via unsignedByteOnTop so 0x80..0xff bytes never read negative. Matches master witnessBlockShapeScript shape. Sound.
- V3 completeness: per-input countInMasters == pointsHere, both in {0,1}; pointsHere requires minting cap + witness validatorRef(byte 8 u16)==OP_INPUTINDEX (emitCompleteness:643, emitPointsHere:3026). Sound both directions.
- V4 roots: rootOcc<2; kind==ROOT -> rootOcc==1 + caller<count + 25-byte P2PKH lock + origin==caller; kind!=ROOT -> rootOcc==0 + caller is covered master; root-but-not-master -> rootOcc forced 0 (emitRootRules:675, emitCoveredFrame:712, emitUserLock:2987). Both directions present; matches checks.ts checkV4.
- V5 edges: callee covered, caller/kind/origin match; CALL/STATIC/CREATE sender==caller.self, self==target, STATIC value both zero else callee.value==call.value; DELEGATE/INTERNAL sender==caller.sender, self==caller.self, value==caller.value; DELEGATE target==addrV(callee own category) from mutable pin; retval==result; SHA256(selector||argpushes)==argsHash (emitOneEdge:863..emitArgumentHash:1000). Converse "non-root called exactly once" (emitEdgeRules 2nd loop). Matches checks.ts checkV5 (program lacks INTERNAL category==context bind and CONTEXT_NOT_SETTLED as separate reasons; INTERNAL unreachable from compiler - GenerateTargetTraversal only emits ROOT/CALL/STATIC/DELEGATE, support.ts only CALL/STATIC/DELEGATE).
- V6 order: reached-bytes per input, DFS visit marks each master once (markReached fails on revisit), appendCallees from block calls, requireReachedMasters requires every covered master reached (emitExecutionOrder:1074). Rules out cycles/unreachable. Sound.
- V7 state inputs: listed == spent catX mutable NFTs excluding the validator's own input, each once (emitSettlementStateInputs:1467, emitIsStateInput:2783). Touched==spent (emitRequireTouchedRecords:2408). Matches models.
- V7 census: own-category fungible amount zero on every in/out first (emitOwnCategoryAmounts:1571); mutable output -> declared record output or own validator index; bare 32-byte output -> a listed event; events/sends pairwise distinct; masters recreated in place, none minted (emitRequireMastersRecreated:2548, T53). Matches checks.ts/reference checkCensus.
- V7 value floor + conservation: kept record keeps >= value; growth(X)+sum(frame nets)>=0 with borrowed frames bringing nothing in (emitRequireRecordValues:2009, emitRequireContractValue:1722, emitFrameNet:1755). Matches checkContractValue.
- V8 both directions: settle iff master count over whole tx >=2 or a delegate/internal frame runs on the context; necessity converse (emitSettlementMembership:1341, emitSettlementNecessity:1400, countMastersScript). Matches checkV8.
- V9: first root category == validator own category (emitRootCategory:509). Sound.
- V10: STATIC subtree via caller-chain walk through DELEGATE to first non-delegate ancestor==STATIC; requires viewIn==viewOut per record, no events/sends, calls only STATIC/DELEGATE with zero value (emitReadOnlyFrames:1191, emitReadOnlySubtree:1259, requireStaticCalls/Segments). Matches checkV10 (equivalent given parent static-calls rule).
- V11: selfIsCodeConstant frame self == addrV(own mutable pin) via addressCheckScript; DELEGATE/INTERNAL skipped (emitFrameAddresses:2949, address-check.ts). Matches checkV11.
- Facet binding/reading: head requires lock P2SH32(F_k) at head+k, output recreated >= value; facet reads M from OP_INPUTINDEX-k (emitFacetBinding:370, emitFacetEntry:354). Section 24 threats hold.

## Not reached (needs a longer look / VM test)
- Exhaustive stack-arithmetic correctness of emitCheckOrderedEntry window math (STRIDE/offset PICK depths) beyond the keying issue above.
- Byte-for-byte equality of emitArgumentHash (selector-payload || raw arg pushes) vs utils readCallData/argsHash and the SDK encoder (the spec's flagged canonical-encoding risk).
- emitFrameNet / callValues / sendRun value arithmetic exhaustive (overflow, loop-run send pinning).
- Side-car coordinate layout and loop "run" sections (frame-tail runSection) vs validator value/census.
- Divergence of V5 INTERNAL-specific reasons (program folds INTERNAL into the DELEGATE path for value/sender/self but does not bind INTERNAL callee category==context on-chain); low risk only because the compiler never emits INTERNAL calls today - worth a guard if that changes.
