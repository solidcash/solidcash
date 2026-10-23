# Verification of DS-1, DS-3, DS-5, DS-6 and the DS-2+DS-3 chain (direct convention)

Current follow-up status (2026-10-14): this is a historical code-read snapshot. Current fixes and remaining limits
are recorded in `archive/docs:docs/security/security-audit-2026-10-feat-parity.md`. The resumed-session DS-1 residual
for a direct singleton conditional write without a source read is now verified locally: a skipped absent-key arm
leaves no node, a changed predecessor successor is refused, and the taken insert settles
([AuditTranscriptStateIntegrity.test.ts](../../packages/solidcash/test/e2e/AuditTranscriptStateIntegrity.test.ts)).
This adds focused VM evidence; it does not widen support for multi-target conditional topology. The original
findings and their original-tree confirmation below are retained as evidence, not as a current-head verdict.

Tree: feat/per-call at abbb7e0ec (HEAD). Line numbers below are at HEAD. The df51215d6..HEAD diff does not touch any
code cited here. GTT = packages/solidc/src/generation/GenerateTargetTraversal.ts, STT =
packages/solidc/src/semantic/SymbolTableTraversal.ts. Read-only; nothing was compiled or run.

I tried to refute each finding by looking for a blocking check in: the function epilogue (GTT:9440-9725), the batch
transition and cardinality (GTT:30068-30798), the alias preflight (GTT:29162-29290), the direct census
(GTT:45990-46048), the strict C3 count (GTT:44552-44650), minting uniqueness (GTT:44425-44500), the immutable-NFT pin,
and the record covenants (packages/utils/src/state.ts:133-306 data NFT, 1894-1972 entry/chunk). No blocking check exists
for any of the four. All four are CONFIRMED at code level.

---

## DS-1  CONFIRMED  (Critical)

Decisive path: a single-target sorted batch accepts predOut = -2, and nothing in a direct function rejects that value.
- STT:3955-3976: every fixed sorted write goes into `sortedBatchInfo` (`fixedSortedWriteCount >= 1`), a lone write
  included. `linear` only when `slotIndices.length > 1` (STT:3977-3980). STT:3982-3990: `__internal__vmapBatchPredOut_N`
  is a plain BIGINT ABI parameter. BIGINT parameters are not range-checked (GTT:9873-9881).
- STT:3933-3941: `runtimeAliasPriorSlots` is set only `if (node.messageBusRoute)`. So the preflight at GTT:29208-29210
  (`if (priors.length === 0) continue;`) never binds -2 in a direct function.
- GTT:26388-26399: the in-batch upsert body is wrapped in `IF predOut != -2`. GTT:26563-26575: the ELSE arm only does
  `OP_DROP`. It fails closed only when `keptValue`, i.e. when the same function reads the slot again after the write.
- GTT:30176-30200: the single-target transition (`targets.length === 1`, not framed) is wrapped in
  `predOut == -2 NOTIF ... ENDIF`, so it is skipped.
- GTT:30592-30608: `directSmallCensus` expects `(predOut >= 0) + 1` outputs, which is 1 with -2. GTT:30668-30675 expects
  `(proof > 0)` inputs. GTT:30730-30731 is an exact address count. Nothing pins the commitment of that one output.
- GTT:46000-46004: the census skips batch collections (`counted`).
- The entry covenant's flag=1 arm (state.ts:1909-1916) only requires the master minting NFT at masterIdx. Any node of
  the collection can therefore be spent beside the master.

Result: one free output at the collection address. The witness Proof may name any node of the collection, so the
attacker can rewrite any existing node, not only mint one. If the function also reads the same key, Proof must name
that read's fixed-slot node: the read pins its lock (GTT:25806-25822, int reads via emitSortedIntReadProofInline GTT:25534-25553) and the address count is exact. The D15 flag is
set before the gate (GTT:26353, then the gate at 26388), so a conditional write skipped with -2 also gets no
preservation. The DS.md variant without -2 (a conditional write whose arm is not taken, with a plain input at the fixed
slot) also holds: emitEntryPreservationBody is gated on `emitSlotExistsCheck` (commitment non-empty, GTT:3352-3362,
45698-45700).

Patterns and reach (all permissionless):
- ERC-20 `approve`: a single target in `allowance`. Mint `allowance[victim][attacker] = max`, then `transferFrom` the
  victim's balance.
- `transferFrom`: the allowance decrement is a single target, conditional in OZ. Skip it and repeat until the approver
  is drained. The two-key `balances` batch is linear and does refuse -2 (GTT:30258-30290).
- WETH `deposit` (`balanceOf[msg.sender] += v`): set your own node to any value, then `withdraw`.
- Claim-once `claimed[msg.sender] = true`: claim repeatedly.
- ERC-721 `_owners[id] = to`: a single target. Rewrite the owner of any token.

Severity: Critical. Any permissionless function with one fixed write per collection hands the caller arbitrary
mint/rewrite of that mapping.

VM test to promote to VM-proven: a direct `claim()` tx with PredOut=-2, Proof = the predecessor's offset, and that
predecessor recreated unchanged. It must be accepted twice. Alternatively, `approve` with PredOut=-2, Proof=0 and one
forged node must be accepted.

## DS-3  CONFIRMED  (Critical)

Decisive path:
- GTT:9519-9526: `countsOwnCategoryNfts` is false whenever the function has entry access, token containers, dynamic
  writes or deploys. Those functions get only `emitDirectCollectionCensus`.
- GTT:45990-46048: the census counts (a) each sorted, non-batch collection's address and (b) the data-NFT lock. It
  `continue`s on `!collection.sorted` (GTT:46004) and on batch, loop and iteration collections. Nothing else is counted.
- Minting uniqueness (GTT:44425-44500) counts only `cat||0x02`. The immutable pin covers 0x00 only (GTT:9711-9714).
- Dynamic chunks sit at the entry covenant with the chunk hash (GTT:36664-36668), so the flag=1 arm lets them be spent
  beside any master spend.
- Chunk counts exist only in emitDynamicWriteVerification, for the variable that function writes
  (GTT:36863, 38664).
- The dynamic read loop (GTT:38960-38995) checks lock, category||0x01 and chunkIndex. It has no content root.
- `string` and unbounded `bytes` state are chunk storage (packages/utils/src/types.ts:896-899). Unbounded `T[]`,
  struct arrays included, is chunk-packed by default (AstBuilder.ts:5520-5531).

In any census-path call, the attacker can destroy or rewrite the chunks of any dynamic variable the function does not
write, forge a chunk `push(i)||push(x)` that a later read accepts, and mint C-mutable NFTs at any lock.

Patterns: every contract that has (i) any function touching a mapping, which is permissionless (ERC-20
`transfer`/`approve`), and (ii) a `string` (ERC-20 name/symbol), `bytes`, `T[] public items`, struct arrays, long
mapping values, legacy array collections, or data-NFT-held authority (the DS-2 chain).

Severity: Critical. Permissionless, and it corrupts state the function never touches.

VM test: an ERC-20 `transfer` tx that also spends a `name` chunk with `<0><1>` and does not recreate it, plus one
extra output (C mutable, P2PKH). Both must be accepted.

## DS-2 + DS-3 takeover chain  OPEN END TO END (by reading)  (Critical)

- Step 1 is DS-3: any census-path call (e.g. `transfer(x, 0)`) adds the output P2PKH(attacker), token {C, mutable,
  commitment = a well-formed data commitment with owner = attacker (and the nftIndex tag if multi-NFT)}. The master
  minting NFT authorizes the mint. The census counts only collection addresses and the data-NFT lock.
- Step 2: a later privileged call takes that NFT at master+offset. Nothing checks its lock:
  - GTT:31370-31381 `emitTokenCategoryVerification` compares the category base only.
  - GTT:37527-37600 field reads take `OP_INPUTINDEX + offset` and its commitment.
  - GTT:38146-38196 direct data preservation checks only input lock == output lock and category in == out. The covenant
    lock is pinned only in the framed branch at 38161-38185. `emitDataNftLbc` is used only at 38168 (framed), deploy,
    upgrade and the census (39867, 40171, 44673, 46039).
  - In a strict-count function, the C3 count (GTT:44552-44650) is a lock-agnostic in == out balance, so 1 == 1 passes.
  - In a census-path function, the real record can ride along at another index: the data covenant's flag=0 arm
    (state.ts:256-275) needs no master. Inputs and outputs at the data lock then still equal compactOffsetMap.size.
- The master carries no binding to the record (GTT:43338-43398).

Consequence: `require(msg.sender == owner)` / onlyOwner pass for the attacker. They can withdraw, mint, pause or
upgrade-gate.

VM test: run the two txs on mocknet against a contract with `owner` in a data NFT, `transfer` and `withdraw`.

## DS-5  CONFIRMED  (Critical where the shape exists; reach is narrower than mappings)

Decisive path:
- compiler.ts:14522-14524, 15569-15572, 19523-19525 set `sorted = true` only for `MappingType`.
- The legacy read (GTT:25923-25990): `emitSlotExistsCheck` (commitment non-empty) -> IF decode keys / ELSE type default.
  There is no lock check and no absence proof.
- `emitEntryCategoryVerification` (GTT:31638-31683) checks the category base and 0x01 only when the slot is present.
- The legacy write (GTT:26968-27030 and emitEntryCovenantVerification GTT:36157-36240) pins the output only. The old
  entry is never required as an input.
- The census skips non-sorted collections (GTT:46004).

Attacks that work:
- Plain input at the slot: the read sees 0, and the write mints a duplicate entry. This gives unlimited claims.
- Present another collection's entry with the same encoding at the slot: it is read, then preserved at its own lock.
- Present a DS-3 forged P2PKH NFT at the slot.

Reach (AstBuilder.ts:5507-5556, 2989-3000; types.ts:742-756):
- native SolidCash bounded `T[N]` state arrays (docs: "uint256[5] a");
- bounded array fields of flattened structs;
- arrays of non-chunk-packable elements;
- `chunkedArrays: false`.
Plain Solidity imports of `uint[N]` (packed blob) and unbounded `T[]` (chunk-packed) do not land here; the latter are
hit by DS-3 instead. Any function reading such an array is reachable, so `claim(i)` is permissionless.

Severity: Critical for affected contracts. This is the original C2 omission attack, intact.

VM test: native `int[8] claimed; claim(i)`. The second claim, with a plain input at the entry slot, must be accepted,
and two entries for i must exist afterwards.

## DS-6  CONFIRMED  (High)

Decisive path:
- GTT:29044-29081: if every batch target's layout slot is `conditional` and some entry slot is `softDelete` (a delete
  inside an if/else, GTT:8318-8384), then the WHOLE `emitSortedBatchTransitionVerification` is wrapped in
  `IF input[fixedSlot(S)].commitment[0:32] == __internal__vmapBatchSlot_S`. That covers the transition and the
  cardinality for every batch, all inside GTT:30068-30798.
- Both sides of that comparison are spender-chosen:
  - The condDelete path (GTT:28931-28963) binds H(k) to the input's slot field, never to the witness. No other code
    binds the witness of slot S.
  - A plain input at fixed slot S has commitment size < 64, so the guard is false.
- With the guard off:
  - emitConditionalDeleteVerification is gated on the slot existing (GTT:36403-36404).
  - The census skips batch collections (GTT:46000-46004).
  - An upsert that runs pins only its own target output, with a free `next` (GTT:26476-26560). Predecessor relinks and
    output/input counts at every batch collection go unchecked.
- In the two-branch shape, honest calls with the write arm taken never run the other collection's transition either.

Patterns: `if (c) { m1[k] = v; } else { delete m2[k]; }`, and a lone `if (cond) delete m[k];` such as a keeper cleanup or
a revoke. The lone form lets the caller mint, destroy or rewrite any `m` node. It is permissionless when the function
is. Not checked here: whether the same-slot toggle `if (b) m[k] = true; else delete m[k];` compiles, since it mixes
the condDelete and upsert paths on one slot.

Severity: High. The shape is narrower, but where it exists it switches off every vmap transition check in the
function.

VM test: `function g(k, c) { if (c) delete m[k]; }` with c=false, a plain input at the entry slot, and an extra C-mutable
output at m's entry address with a forged commitment. It must be accepted.

---

Additional note (not a finding here): the census is emitted only when `__messageBusExplicitlyDisabled === true`
(GTT:45993-45995). A direct contract compiled with the bus not explicitly disabled gets neither the census nor the
strict count for these function kinds. That was not traced further.
