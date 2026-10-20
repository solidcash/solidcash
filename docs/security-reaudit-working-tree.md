# Reaudit of the working tree past the 2026-10-15 covenant audit

This file is a new reading. It does not replace `docs/security-audit-2026-10-15.md` or `SECURITY-AUDIT-2026-10.md`.

## Tree

Read at `HEAD` `056f4036b96048cd79794866bde3098409698b42` (`fix(solidcash): skip zero-trip state-array loop callsites in delegate compose resolution`). That commit changes `packages/solidcash/src/stateful/sc-resolve-create-builder-nested-compose-callee.ts` and a unit test. Its parent `70b90de91` changes `packages/solidc/docs/deferrals.md` only. Neither file is a check cited below. `e6c512d14925b4d96e45a7809c7b7c55c2f596aa` and `dcd062c05e501123c8f227e3d4ffdc3edadcf1e6` are deferral notes. `HEAD` also contains `3b7e8089a` (`fix(solidc): keep array-co-spend dynamic write in delegate single-write split`), which inserts a net three lines in `packages/solidc/src/generation/GenerateTargetTraversal.ts` (diff hunks `@@ -40491` and `@@ -40493` against `f15997036b84af42ecd8e28579b874cba9133e3f`).

Also read, and cited where the file on disk differs from `HEAD`, the uncommitted edits in:

- `packages/utils/src/state.ts`
- `packages/solidc/src/generation/GenerateTargetTraversal.ts`

Every `GenerateTargetTraversal.ts` line below is a line of that working tree (`HEAD` plus the uncommitted diff), including the three committed lines. The uncommitted test edits and the golden-token artifact edits were not used as proof. A test title is not a check. Fixtures were not line-read.

The 2026-10-15 document was read at `d7a2aa8dc`. Its line numbers are not reused.

## Threat model

On chain, the compiled Bitcoin Cash Script is the only boundary. An attacker may build any transaction the BCH 2026 virtual machine accepts. They cannot produce a signature for a key they do not hold. A locking bytecode of up to 201 bytes is standard.

`OP_UTXOTOKENCATEGORY` and `OP_OUTPUTTOKENCATEGORY` append a capability byte only for a mutable or minting token (`packages/solidc/src/framed/validator/program.ts:1978-1979`). A pure immutable NFT is a 32-byte category. A mutable NFT is 33 bytes ending in `0x01`. A minting NFT is 33 bytes ending in `0x02`.

## Method and what was not read

Every CRITICAL and HIGH id in the 2026-10-15 table was reclassified by opening the check in this tree. The seven rows that document left open were traced through the refusal that would have to stop them. The suspected framed output-category walk was finished from its opcodes. Message-bus lifecycle modes 0, 1, 2, and 3 were line-read past the binding digest.

Not read: website docs, benches, fixtures, conformance snapshots, generated artifacts, October MEDIUM and LOW rows whose checks were not on these surfaces, and the rest of `GenerateTargetTraversal.ts` outside the functions cited here.

## Classification

| Id | Status | Deciding check, or its absence |
| --- | --- | --- |
| FM-1 | fixed | `recogniseValidatorScriptAgainstReservedHash` requires the redeem to open with `0x21` and the input lock to equal `aa20 \|\| HASH256(redeem) \|\| 87` (`packages/solidc/src/framed/master/frame-tail.ts:809-814`). |
| FW-1 | fixed | A spent state input is keyed `in:` and must be touched (`packages/solidc/src/framed/validator/checks.ts:499-503`). On chain, `emitRequireTouchedRecords` requires every collected index to be a state input or a listed created record (`packages/solidc/src/framed/validator/program.ts:2936-2960`). |
| FW-2 | fixed | An exempt declaration must match the pair's input and its output (`packages/solidc/src/framed/master/declared-view.ts:613-619`, `OP_BOOLAND`). A trailing `{in: D, out: none}` is not exempt. |
| DX-1 | fixed | The direct container master arm, built with the 35-byte lock, pins the output at this input (`packages/utils/src/state.ts:2409-2441`, spliced at `2578`). A different lock must be value 0 and token amount 0 (`2433-2439`). The same lock may change amount. `scansSatoshi` requires `!this.framedMaster` (`GenerateTargetTraversal.ts:10204-10205`). The scan then requires the satoshis at the container lock, inputs, to be at most the outputs at that lock plus the transfers this call names (`50701-50712`), including when the transfer list is empty. |
| DX-2 | fixed | The same pin is spliced into the token-container master arm (`state.ts:2475`). A function that does not name that container recreates a foreign input at the same index with the same lock, category, and at least the same amount (`GenerateTargetTraversal.ts:51122-51138`). A named container's full movement may leave the 0-sat 0-token placeholder only when the transfers cover the input (`53675-53699`). The arm that still has a category keeps the lock (`53725`) and subtracts those witnesses (`53737-53746`). |
| DX-6 | open | Entry, chunk, deploy, and token-container spends skip the simple count (`GenerateTargetTraversal.ts:10119-10122`) and call `emitDirectCollectionCensus` (`10123-10126`). Unread data records keep lock, commitment, and category (`51275-51293`). Unwritten chunks do the same (`51395-51419`). An own-category mutable input past the block is recreated only when no entry slot is `inLoop`, `collectionIterations` is empty, and `blockSize > 0` (lock `51330`, commitment `51335`, category `51340`). An entry spend with an in-loop slot (`51302`) or a nonempty `collectionIterations` (`51303`) returns before those opcodes. The output scan that still runs matches lock and category (`51571-51620`) and does not require the input to come back. |
| DS-1 | fixed | An active row may publish `predOut = -2` only when an earlier active write of the same target owns it, or the proof is non-positive (`GenerateTargetTraversal.ts:32202-32225`, `OP_EQUALVERIFY`). |
| DS-2 | fixed | After the category-base compare, a direct read requires `OP_UTXOBYTECODE` at the record's offset to equal the data-NFT covenant (`GenerateTargetTraversal.ts:34951-34976`, `OP_EQUALVERIFY` at `34975`). |
| DS-3 | open | Same absence as DX-6. The commitment `OP_EQUALVERIFY` is the unread-record pin (`51289`, called for the commitment at `51292`), the unwritten-chunk pin (`51414`), and the past-the-block pin (`51335`). The last is not emitted when `51302` or `51303` returns. `emitMutableOutputAllowed` compares lock and category (`51610-51620`) and does not read the commitment. |
| DS-4 | fixed | `emitMinimalIntegerKey` requires the raw key to equal `OP_BIN2NUM` of itself (`GenerateTargetTraversal.ts:27493-27506`). `evmCompat` returns before that pin (`27496-27497`). |
| DS-5 | fixed | Every collection is marked sorted, with no mapping-only gate (`packages/solidc/src/compiler.ts:14904`, and again at `15980` and `20136`). |
| DS-6 | fixed | A compiler route keeps the unrun census (`GenerateTargetTraversal.ts:31955-31956`). A batch-slot mismatch or a commitment shorter than 64 bytes takes the guard false and `emitUnrunSortedBatchCensus` preserves each node (`31967-32002`, `51147-51164`; a conditional-delete slot is skipped there at `51150`, and the preserve arm is `51158`). A scalar `if` with no else is rewritten to `m[k] = cond ? <default> : m[k]` (`packages/solidc/src/semantic/IfConvertConditionalEntryOp.ts:406-415`, run at `compiler.ts:20101`). A conditional delete that stays a delete writes the type default into the value register on the taken path (`GenerateTargetTraversal.ts:31276-31300`, `emitDefaultValue` at `31296`). The output commitment must equal that encoding (`28140-28154`, `OP_EQUALVERIFY` at `28154`). Selector 0 keeps the previous value. |
| DS-7 | fixed | A direct entry with a collection signature counts only when its lock is the entry address and its commitment is nonempty (`GenerateTargetTraversal.ts:3743-3750`). The batch census uses the same address compare for a read slot, routes included (`33927-33933`). |
| DS-8 | fixed | A direct batch, routes included, requires each target's proof index to differ from every pure-read slot's input (`GenerateTargetTraversal.ts:33897-33909`, `OP_NUMNOTEQUAL` / `OP_VERIFY`). A framed frame leaves that loop at `33888`. |
| DX-4 | fixed | A negative return index walks every output and refuses an own-category immutable output whose lock is `OP_TRUE` (`GenerateTargetTraversal.ts:47411-47433`, `OP_VERIFY` at `47433`). A nonnegative index pins that same lock (`47390-47393`, `OP_EQUALVERIFY`). |
| DX-5 | fixed | A non-empty low-level call requires the named input's lock to equal the target (`GenerateTargetTraversal.ts:26617-26647`). An empty literal payload is not pinned (`26617`). |
| DX-8 | fixed | A delegate calls `emitDelegateRecordConservation` (`GenerateTargetTraversal.ts:10231`, `10262`). Each side is folded into a hash chain and the chains must be equal (`48893-48898`, `OP_EQUALVERIFY` at `48898`). |
| KB-1 | fixed | The offloaded route requires the verifier output index to be in range (`compiler.ts:12241`), sets `activeVerifierOutput = activeVerifier` (`12242`), and requires that output's lock and category (`12243-12244`) and its commitment (`12245-12253`) to match the input and the binding digest. The inlined verifier sets the same index (`12858`), requires the output amount and value (`12859-12860`), and requires the output commitment to be that digest (`12880-12884`). |
| KB-2 | fixed | `compileAddressToEvmIdentity` accepts only empty, 20, 32 with a 12-byte zero prefix, 23 (`a914…87`), 35 (`OP_HASH160`), and 25 (`76a914…88ac`). Any other length must itself be a P2PKH template (`packages/solidc/src/generation/utils.ts:44-79`). |
| KB-3 | fixed | The offloaded route requires `activeVerifier >= 0` and a real input at that index (`compiler.ts:12231-12233`). A negative index on a bound route is also refused when an envelope is still present (`13670-13673`). |
| CRYPTO-1 | fixed | `emitBindAltStackedRedeemLock` requires the side-car lock to be P2SH32 of the revealed redeem (`GenerateTargetTraversal.ts:51686-51696`, `OP_EQUALVERIFY` at `51696`). `emitKeccakComputeCall` calls it at `14919`. |
| CRYPTO-2 | fixed | The shared-salt recovery path requires side-car A's lock to equal `ECRECOVER_COMPUTE_A_SHARED_LOCK` (`GenerateTargetTraversal.ts:15163-15165`) and side-car B's lock to equal `ECRECOVER_COMPUTE_B_SHARED_LOCK` (`15172-15174`). The other path binds both revealed redeems with `emitBindAltStackedRedeemLock` (`15201`, `15212`). |
| CRYPTO-3 | fixed | `blockhash(n)` requires `tx.time >= n` (`GenerateTargetTraversal.ts:15431`, `OP_CHECKLOCKTIMEVERIFY`), binds the oracle lock (`15446`, `emitBindBlockhashOracleLock` `51645-51678`, `OP_EQUALVERIFY` at `51678`), and requires `commitment.n == n` (`15447-15450`). |
| CRYPTO-4 | fixed | Without an explicit lock, `bindMintingAuthorityLock` requires the final redeem to be longer than 128 bytes (`state.ts:168-169`). A one-byte keeper redeem does not pass. Callers that have the contract lock compare that 35-byte lock (`128-132`). |
| SEM-1 | fixed | `firstUnverifiedReturn` walks into a branch and returns the early `return` (`packages/solidc/src/semantic/EnsureFinalRequireTraversal.ts:450-471`). The caller uses that return before a later require can cover it (`338-342`). That throws `FinalRequireStatementError` when strict (`241-242`). `enforceFinalRequire` defaults to true (`compiler.ts:314`). |
| SEM-11 | fixed | A produced function id must be one of `entryFunctionPointerTargets` (`GenerateTargetTraversal.ts:10658-10670`). A function value inside an array or struct fails compilation (`10654-10656`). |
| TOOLS-1 | fixed | The libauth dependency is the commit `1cf4b432864b3a4ed9f33d1992355d7286f3dab8` in the root `package.json:17`, `packages/solidc/package.json:54`, `packages/solidcash/package.json:73`, `packages/utils/package.json:45`, and `packages/testing/package.json:58`. |
| SDKFRAMED-1 | fixed | `genesisCoinRefusal` (`packages/solidcash/src/stateful/ContractFactory.ts:176-178`) calls `ownCoinRefusal`, which hashes the served raw transaction to the txid and requires the output lock, value, and token (`packages/solidcash/src/framed/deploy/own-coin.ts:20-38`, `59-78`). |
| SDKFRAMED-2 | narrowed | `separateHop` is true only for `initializeAs: 'hop'` (`packages/solidcash/src/framed/proxy/deploy.ts:1095`). The default mints one initialized genesis (`1385-1396`). The hop path builds `broadcastHop` (`1397`) and then `staging.release()` sends the geneses and that hop back to back (`1426-1429`). Until the hop confirms, the uninitialized proxy can be initialized by someone else. |

DX-6 and DS-3 stay open for the iterating entry shape below. SDKFRAMED-2 stays narrowed: the hop race remains for the opt-in and is gone for the default. Every other id in this table is fixed.

## The seven rows the 2026-10-15 document left open

### DX-1

Attacker: anyone who can satisfy a public function that does not transfer satoshis, and who co-spends the direct satoshi container with `flag = 1` and the master's input index.

The container script's master arm no longer ends at the category check. `directMasterOutputPin` (`state.ts:2409-2441`) pushes `OP_INPUTINDEX`, not the witness index. If the output lock equals the input lock, and the input has a token category, the output category must equal it. The amount may fall. If the lock differs, the output value and the output token amount must both be 0. The mismatch arm duplicates the index (`2433`) before `OP_OUTPUTVALUE`, so `OP_OUTPUTTOKENAMOUNT` still has an index. A 0-sat 0-token placeholder therefore finishes.

That pin alone would still allow a placeholder on a call that names no transfer. The master does not. `scansSatoshi` is set for a direct stateful spend that is not framed, not a delegate, and not `selfdestruct` (`10204-10205`). `emitSlotScans` sums values at the container lock and requires `inSum <= outSum` plus only the transfers this call pushes (`50701-50712`, `OP_LESSTHANOREQUAL` then `OP_VERIFY`). With an empty transfer list the outputs at the container lock must hold the inputs. A placeholder is not at that lock, so it fails. An authorized transfer is added on the output side, so only that amount can leave. A full authorized drain pays that amount and leaves the placeholder; both the pin and the scan accept it.

The category-only script, built with no `masterLock`, does not include the pin (`2578`). That is the framed container. Its value is the validator's container-lock growth, outputs at the lock minus inputs at the lock (`packages/solidc/src/framed/master/value.ts:84-107`), which `emitRequireContractValue` requires to be nonnegative after frame nets (`program.ts:2184-2207`). A framed master is excluded from `scansSatoshi` by `!this.framedMaster` (`GenerateTargetTraversal.ts:10204`). The transfer-identity block states the same absence (`51861-51862`) and its `if` requires `!this.framedMaster` (`51863-51864`), so that block does not scan a co-spent satoshi container either. Lines `51857-51860` are the graph-route synthetic-transfer comment, including the example `5000 <= 4000 + 0` at `51859`. They are not this exclusion.

### DX-2

Same attacker, against a fungible token container.

The token-container master arm includes the same pin when `masterLock` is set (`state.ts:2475`). Paying the tokens to another lock fails the pin unless that output is the 0-value 0-amount placeholder.

`emitForeignContainerKeep` (`GenerateTargetTraversal.ts:51108-51140`) then requires an unnamed foreign input to be recreated at the same index with the same lock, the same category, and an output amount at least the input amount (`51122-51138`, `OP_EQUALVERIFY` at `51126` and `51131`, `OP_LESSTHANOREQUAL` / `OP_VERIFY` at `51137-51138`). A placeholder fails the lock compare. A container the function does name is left to `emitTokenContainerPreservation`. Its placeholder arm (`53675-53699`) requires output value 0, an input category of at most 32 bytes, and `input amount − this slot's transfer witnesses <= 0`. A full authorized `transfer` can finish the placeholder. A call that names no transfer cannot. The arm that still has a category keeps the lock (`53725`) and subtracts those same witnesses (`53737-53746`).

`scansForeign` does not run for a framed master (`10209-10210`). No token-container builder under `packages/solidcash/src/framed/` was part of this pass. The October hole was the direct master arm.

### DX-6 and DS-3

Still open for one shape. Closed for the others.

Attacker: a spender of a function that has entry access, including a dynamic-chunk, deploy, or token-container function that also has it.

Shape that stays open: the function has any entry slot with `inLoop`, or `collectionIterations` is nonempty. The spender co-spends an own-category mutable NFT the function does not step — not an unread layout data record and not a chunk of a dynamic variable the function does not write — and either drops that input or re-emits it at the same lock with a different commitment and the same `0x01` category.

The check that should refuse the drop and the recommit is `emitPreserveOutsideLayoutOwnMutable`: category `master first 32 || 0x01` (`51306-51312`), then lock, commitment, and category `OP_EQUALVERIFY` (`51330`, `51335`, `51340`). The simple count `emitOwnCategoryMutableNftConservation` would also refuse an extra mutable, and it runs only when `countsOwnCategoryNfts` is true (`10290`).

That count is already false for an entry, chunk, deploy, or token-container spend (`10119-10122`), so the call at `10290` does not emit it. `emitDirectCollectionCensus` still runs (`10123-10126`) and still calls the outside-layout walk (`51257`). The walk returns before any opcode when any entry slot is `inLoop` (`51302`) or `collectionIterations.length > 0` (`51303`). It also returns when `blockSize` is missing or not positive (`51304-51305`), and when the master is framed (`51301`, and the census itself returns at `51203-51204`).

What still runs on that iterating spend does not cover this input:

- Unread data records are recreated at their offsets (`51261-51272`, pin at `51275-51293`). The commitment compare is the call at `51292`, and its `OP_EQUALVERIFY` is `51289`. That is a layout data NFT, not an extra mutable past the block.
- An unwritten dynamic variable's chunks are recreated (`emitUnwrittenChunkCensus` at `51374`, `emitPreserveUnaccessedChunk` at `51395-51425`, commitment `OP_EQUALVERIFY` at `51414`).
- `mutableOutputCheckPending` is set (`51251`) before the early return, so the output scan runs. `emitMutableOutputAllowed` (`51571-51620`) accepts an own-category mutable output that sits at a mintable lock or that matches some mutable input's lock and category (`51610-51620`). It does not compare commitments, and an input with no output is not a failing output. A drop passes. A same-lock recommit with a different commitment passes.
- `emitSortedIterationLinkage` (`13676`) steps the iterated collection's chain. Each stepped entry's bytecode must equal the entry address (`14010-14015`) and its slot must equal the previous next key (`13755-13759`). An input that chain does not step is outside that walk. The iterated collection is also added to `counted` (`51217-51218`) and skipped by the fixed-slot address count (`51222`).

Shape the pins do close: a direct mapping-entry, chunk, deploy, or token-container spend with no in-loop entry slot, an empty `collectionIterations`, and `blockSize > 0`. The outside-layout walk then emits the three `OP_EQUALVERIFY`s. A destroyed output fails the bytecode compare. A different commitment fails the commitment compare, including a re-emitted `0x01` output that would keep a count (DS-3, `51335`). The same spend with no extra NFT does not take the `>= blockSize` arm (`51318`) and finishes. An NFT the function does write is in `pendingStateWrites` and is skipped by the unread-record pin (`51264-51269`), so that accessed record can still change as the function states. A deploy rejection caused only by a funder signature over an appended input is not this check. The refusal on the closed shape is the contract script.

### DS-2

Attacker: the same spender, placing an own-category mutable NFT at another lock at the data-record offset.

`emitTokenCategoryVerification` still compares category bases (`34941-34949`). It then calls `emitDataNftInputLockPin` unless the master is framed or the read comes from a frame (`34951-34952`). The pin builds the data-NFT P2SH32 from the master lock and category and requires `OP_UTXOBYTECODE` at `master + compactOffset` to equal it (`34958-34976`). Another lock fails `OP_EQUALVERIFY`. The real data-NFT input passes and the field read is the commitment that input carries.

### DS-6

Attacker: a spender of a compiler message-bus route whose sorted write or delete sits in a branch, offering a `__internal__vmapBatchSlot` that does not match the co-spent commitment, or a commitment shorter than 64 bytes.

`settlesUnrun` is true for a direct, non-framed guard (`31955-31956`). The condition does not exclude a compiler route. The guard is false when the entry is not at its collection address, when the commitment is shorter than 64 bytes, or when the first 32 bytes do not equal the batch-slot witness (`31959-31973`). The false arm calls `emitUnrunSortedBatchCensus` (`32000-32002`), which preserves each batch node (`51147-51164`).

A scalar `if` with no else is rewritten to `m[k] = cond ? <default> : m[k]` (`packages/solidc/src/semantic/IfConvertConditionalEntryOp.ts:406-415`). That pass runs on the compiled contract (`compiler.ts:20101-20104`). A conditional delete that is still a delete authenticates the spent slot and replaces only the value tail with `emitDefaultValue` (`GenerateTargetTraversal.ts:31276-31300`). `emitVerifySortedValueOutputInline` then requires the output lock, the mutable category, and the commitment `slot || next || value` (`28140-28154`). The taken arm (the condition true, selector greater than zero) is that default value in the commitment. Selector 0 is the ternary's current-value arm, or the preserved node when the guard is false. A route layout that merely lacks a soft-delete slot is not this check.

`tryConvertBranch` (`IfConvertConditionalEntryOp.ts:199`) rewrites a no-else branch only when every statement is an entry operation (`228-235`). A branch with an else goes to `tryConvertIfElse` (`212-226`). A delete that stays a delete is the `31276-31300` path, which still writes the default on the taken path. The unrun census skips a slot still marked `condDeleteSlots` only when the guard is false (`GenerateTargetTraversal.ts:51150`). The taken path does not use that census.

### DS-7

Attacker: a spender of a function that batch-writes a sorted mapping and reads it only in a branch the call does not take, funding the read slot with a nonempty own-category commitment at another lock.

`emitSlotExistsCheck` for a direct entry with a collection signature requires the entry-address compare and a nonempty commitment, combined with `OP_BOOLAND` (`3743-3750`). The address compare is `OP_UTXOBYTECODE` against the collection's entry address (`3770-3778`). The batch census counts a read slot with `readSlotIsNode`, the same bytecode compare, and uses it for a compiler route (`33927-33933`). A commitment at another lock is not a node, so it does not raise the count and cannot free another key. The same call without that input writes the named key under the ordinary transition.

The framed arm of `emitSlotExistsCheck` still treats a nonempty commitment as presence (`3753-3758`). A framed read is at the coordinate its block declares (`3782-3787`), which is the declared-record census, not this direct slot.

## Framed extra-minting output

Withdrawn. The walk is not a minting census.

At `frame-tail.ts:1050-1056` the stack entering the output test is `[seen, declared, index]`, `seen` the immutable outputs already counted and `declared` the event count taken off the witness tail (`1029-1031`).

```
OP_DUP OP_TXOUTPUTCOUNT OP_LESSTHAN OP_IF
OP_DUP OP_OUTPUTTOKENCATEGORY OP_INPUTINDEX OP_UTXOTOKENCATEGORY
<32> OP_SPLIT OP_DROP OP_EQUAL
OP_ELSE OP_0 OP_ENDIF
<3> OP_ROLL OP_ADD OP_ROT OP_OVER OP_GREATERTHANOREQUAL OP_VERIFY OP_SWAP
```

`OP_SPLIT` splits the top item. After `OP_UTXOTOKENCATEGORY` the top is the executing input's category, not the output's. `OP_DROP` leaves the first 32 bytes of that input category. `OP_EQUAL` then compares the full output category to that 32-byte base.

A minting output's category is 33 bytes, base concatenated with `0x02` (`program.ts:1978-1979`, `emitMasterPinFlag` at `3173-3180`). A 33-byte item is not equal to a 32-byte item, so `OP_EQUAL` is false and the output adds 0 to `seen`. The following `OP_VERIFY` is `declared >= seen + match`. An uncounted minting output does not fail it. An immutable event is a 32-byte category and does match, which is what this walk counts (`frame-tail.ts:890`, `program.ts:2066-2068`).

`emitRequireMastersRecreated` does not refuse a minting output whose index is at least the input count. Its output walk pushes `OP_TXINPUTCOUNT` and `loopCounted` runs that many times (`program.ts:3096-3107`), so an index past the last input is never loaded. Inside that bound, a 33-byte minting category must be a listed minted master (`3111-3133`) or the input at the same index must be a master (`3102-3104`), and a master input is recreated in place (`3084-3089`, `3189-3192`). `emitRequireOwnOutputsListed` matches only a 32-byte category (`3246-3259`). `emitRequireMutableOutputsListed` matches only the mutable byte (`2463-2483`). The reference census pairs masters by input index (`checks.ts:607-621`) and its output scan flags a mutable or immutable output (`634-642`), not a minting one. `emitOwnCategoryAmounts` requires a zero fungible amount on every own-category output (`2032-2060`) and still accepts a minting NFT of amount 0.

The spend is refused by the master that has to be spent to create the output. `buildMasterHeadScript` always opens with `prologue` (`master-head.ts:319`), and that prologue appends `mastersRecreatedInPlaceScript` (`435`). The script's entry is `[pin]`, the category concatenated with the minting byte. It sets `j` to 0 (`lifecycle.ts:210`) and continues until `j` reaches `max(input count, output count)` (`220`). At each `j` the input side is 0 when `j` is not an input (`214`). The output side is 1 when `j` is an output and `OP_OUTPUTTOKENCATEGORY` equals the pin (`215-217`, the pin picked at depth 4). `OP_EQUALVERIFY` (`218`) then fails for a trailing minting output, because that index has no input. A nonzero fungible amount on the same category fails one step earlier (`227-231`).

A one-byte first push selects the lifecycle arm and skips that prologue (`lifecycle.ts:369-380`, wrapped at `compiler.ts:16956-16957`). Split and merge walk the same `max` bound (`288-314`). A trailing minting output is an input-absent, output-present index. Merge requires the input side to be the master (`303`, `inPin` against mode 2). Split counts it as one of the `n` new masters (`311`, `316`) and the admin signature's base type is `SIGHASH_ALL` (`254-255`). Retire's own loop stops at the input count (`279`) and does not read a trailing output. It still requires a different master input of the same lock to be recreated (`270-281`). That input's script is this same master, on the prologue or on split or merge, which is the walk above.

## Message-bus lifecycle modes

The binding digest is unchanged: `sha256` of the manifest hash, the active base, the local row count, and the local batch hash, plus graph values when the route has them (`compiler.ts:12845-12849`). The verifier output index is the verifier input (`12858`). What follows is the lifecycle derivation, which runs only when the contract has a kernel lifecycle handler (`12844`).

The mode is not a free witness. `lifecycleDerivation` (`12374-12405`) starts at mode 0 and count 0. It reads a one-row `SCB1` batch (`localBatch` header `53434231`, row count byte equal to 1). The selector is bytes `[7, 11)` of that batch. A selector equal to a `selfdestruct` handler sets mode 3 and count 1. A `split` handler sets mode 1 and the count decoded from the batch arguments. A `merge` handler sets mode 2 the same way. A one-row batch whose selector is a `selfdestruct` handler also forces mode 3 if the structured decode left mode 0 (`12397-12404`). Any other batch leaves mode 0.

`lifecycleVerification` (`12406-12500`) then binds the transaction to that mode:

- Mode 3. The output at the participant base has an empty token category and the same value as the input. Exactly one own-category minting input and no minting output. Mutable inputs of the category equal `fixedSize - 1`, and no mutable output. Each prefix slot is a mutable input recreated with an empty category and the same value (`12440-12452`).
- Mode 1. The master output keeps lock, category, commitment, amount, and value. Minting inputs are 1 and minting outputs are `count + 1`. Each new slot is an input with an empty category and an output at the participant lock with category `base \|\| 0x02`, an empty commitment, amount 0, and a positive value (`12461-12492`).
- Mode 2. The same master preservation, except the master output amount may be greater than the input. Minting inputs are `count + 1` and minting outputs are 1. Each extra slot is a minting input at the participant lock recreated with an empty category (`12463-12496`).
- Mode 0. The verification block is skipped (`12407`). A non-lifecycle handler on a lifecycle-capable contract requires `__message_bus_active_lifecycle_mode == 0` (`11642`). The verifier commitment suffix is `0000` (`12877-12878`).

The route does not trust a second copy of the mode. The verifier writes the derived code into the verifier output commitment after the 6-byte prefix and the 32-byte digest: `-32767` for mode 3, the negated count for mode 2, the count for mode 1, and `0000` for mode 0 (`12864-12880`). The route reads those two bytes back from the commitment (`13687-13699`) and the handler requires the mode and count (`11635-11642`). A batch selector that does not match the handler fails that require. A commitment suffix the verifier did not write fails the commitment equality (`12880`).

No new issue on modes 0, 1, 2, or 3.

## Minted-root value

Stays withdrawn. `emitOneMintedMasterRootRule` (`program.ts:742-776`) checks the output index, the root kind, an empty caller, an empty origin, an empty sender, and `self` against the output category with the mutable capability. It does not read `value`.

A non-payable delegate forces value 0 (`master-head.ts:693`, `assertZeroValue` at `1291`). A payable delegate's `valueChecks` (`1070-1084`) reads `OP_UTXOTOKENCATEGORY` of `contextOwner`. For a delegate or internal frame that owner is `callerRef` (`parkCategoryOwner`, `479-491`). `emitOneMintedMasterEdges` names that caller `mintedRef(output)`, `MINTED_REF_BASE` plus the output index (`program.ts:861-864`). That is not an input. The introspection does not settle.

## What this pass did not reopen

FM-1, FW-1, FW-2, DS-1, DS-2, DS-4, DS-5, DS-6, DS-7, DS-8, DX-1, DX-2, DX-4, DX-5, DX-8, KB-1, KB-2, KB-3, CRYPTO-1, CRYPTO-2, CRYPTO-3, CRYPTO-4, SEM-1, SEM-11, TOOLS-1, and SDKFRAMED-1 still hold at the lines in the table. DX-6 and DS-3 stay open for an iterating entry spend. SDKFRAMED-2 stays the opt-in hop. No new CRITICAL or HIGH id was opened on the surfaces this pass read.
