# Security audit 2026-10-15

Audited code: `d7a2aa8dc` on `feat/per-call` (`test(solidc): drive criterion-1 as one 16-cell materialization x op table`), which is `994934726` plus that test-only commit. This document is the only later change and does not alter the cited sources. The checks below were read at `d7a2aa8dc`.
Baseline for the rows below: `SECURITY-AUDIT-2026-10.md` and `2026-10/` as they stood at `abbb7e0ec`. That file is the 2026-10-11 record and is not rewritten here.

## Threat model

On chain, the compiled Bitcoin Cash Script is the only boundary. An attacker may build any transaction the BCH 2026 virtual machine accepts. They cannot produce a signature for a key they do not hold. A locking bytecode of up to 201 bytes is standard, so a bare lock needs no miner help. Off chain, a user must not be led to sign something they did not intend, lose funds, or leak keys, and a network provider may be hostile: it may lie about UTXOs, omit coins, or serve a transaction that does not match the outpoint it names.

## Method and what was not read

The delta from `abbb7e0ec` is 754 files. This pass reclassified every CRITICAL and HIGH id from the October audit by reading the current check, and it reviewed the covenant and trust surfaces that authorize a spend, bind identity, settle state, or sign and broadcast. It did not line-read website docs, benches, fixtures, conformance snapshots, or generated artifacts. It did not re-audit October MEDIUM and LOW rows whose checks were not on a reviewed delta. It did not line-read the whole of `GenerateTargetTraversal.ts` outside the functions cited below, nor every message-bus lifecycle mode past the binding-digest equation. The kernel caller digest, the framed call broadcast, and `TransactionBuilder.send` were read. A later commit message or doc was not treated as proof that a finding is fixed.

Source-traced "confirmed" means the refusal is present or absent in the current script builder. It is not a new virtual-machine run.

## Reclassification of October CRITICAL and HIGH

| Id | Status | Deciding check, or its absence |
| --- | --- | --- |
| FM-1 | fixed | `recogniseValidatorScriptAgainstReservedHash` requires the redeem to open with `0x21` and the input lock to equal `P2SH32` of that redeem (`packages/solidc/src/framed/master/frame-tail.ts:806-814`). A bare lock replaying the unlocking no longer passes. |
| FW-1 | fixed | A spent state input is keyed `in:<index>` (`checks.ts:444`) and must be touched (`checks.ts:503`, `V7_TOUCHED_RECORDS_MISMATCH`). On chain `emitRequireTouchedRecords` requires every collected index to be a state input or a listed created record, and every spent state input to be collected (`program.ts:2928-2960`). Declaring `in = 0xffff` does not stand in for the spent input. |
| FW-2 | fixed | An exempt declaration must match the pair's input and its output (`declared-view.ts:613-619`, `OP_BOOLAND`). A trailing `{in: D, out: 0xffff}` is not exempt. The comment at 617-618 names the old skip. |
| DX-1 | still open, narrowed | The container's master path now requires a long redeem or the contract's own 35-byte lock (`bindMintingAuthorityLock`, `packages/utils/src/state.ts:128-174`, used at `2518-2533`). It still does not preserve the container's satoshis. The master accounts for the container only when `pendingTransfers.length > 0` (`GenerateTargetTraversal.ts:51709-51721`). |
| DX-2 | still open, narrowed | Same authority bind on the token-container master path (`state.ts:2422-2432`). That path checks category and minting capability and does not preserve the fungible amount. The master scans foreign containers (`GenerateTargetTraversal.ts:10194-10199`) only outside the framed master and outside `delegatecall`. A framed spend is not that scan. |
| DX-6 | still open | `emitOwnCategoryMutableNftConservation` runs only when `countsOwnCategoryNfts` is true (`GenerateTargetTraversal.ts:10278-10282`). The comment at 10268-10274 says entry, token-container, dynamic-chunk, deploy, selfdestruct, split, merge, and delegate functions skip it. `__messageBusExplicitlyDisabled` still selects the direct conditional-batch flags (`50415-50418`). |
| DS-1 | fixed | An active row may publish `predOut = -2` only when an earlier active write of the same target owns it, or the proof is non-positive (`GenerateTargetTraversal.ts:32202-32210`, `OP_EQUALVERIFY`). The write itself treats `-2` as inactive unless that alias holds (`28514-28523`). |
| DS-2 | still open | `emitTokenCategoryVerification` checks the data-NFT category base against the master and does not read the lock (`GenerateTargetTraversal.ts:34926-34935`). A mutable NFT of the category at another lock still satisfies the read. Minting that NFT is the DX-6 residual. |
| DS-3 | still open | Same gate as DX-6. The census comment records the residual: re-emitting a `0x01` output keeps the count, and this rule does not check the run's commitments (`GenerateTargetTraversal.ts:49133-49134`). |
| DS-4 | fixed | `emitMinimalIntegerKey` requires the raw key bytes to equal `OP_BIN2NUM` of themselves before `OP_SHA256` (`GenerateTargetTraversal.ts:27481-27493`). `evmCompat` skips it because ABI words are not minimal script numbers (`27482-27484`); native `int`/`uint` keys are the October hole and are covered. |
| DS-5 | fixed | Every collection is marked sorted, with no mapping-only gate (`compiler.ts:14903-14904`, and again at `15980` and `20136`). |
| KB-1 | fixed | The generated route sets `activeVerifierOutput = activeVerifier` and requires that output's lock and category to equal the input (`compiler.ts:12239-12244`). The comment at 12239-12240 names the old last-output search. |
| KB-2 | fixed | `compileAddressToEvmIdentity` accepts only empty, 20, 32 (12 zero prefix), 23 (P2SH20 template), 35 (`OP_HASH160`), and 25 (P2PKH template). Any other length must itself be a P2PKH template (`packages/solidc/src/generation/utils.ts:43-80`). The 71-byte multisig fall-through is gone. |
| CRYPTO-1 | fixed | `emitBindAltStackedRedeemLock` requires the side-car input's lock to be `P2SH32` of the revealed redeem (`GenerateTargetTraversal.ts:51544-51554`). `emitKeccakComputeCall` calls it at `14907` before trusting the commitment. |
| CRYPTO-2 | fixed | The non-loop recovery path binds side-car A with `emitBindAltStackedRedeemLock` (`GenerateTargetTraversal.ts:15189`) and checks side-car B's lock against `ECRECOVER_COMPUTE_B_SHARED_LOCK` (`15160-15162`). |
| DS-6 | still open, narrowed | The ran-flag and the unrun census exist only when the message bus is explicitly disabled or the master is framed (`allocateConditionalSortedBatchFlags`, `GenerateTargetTraversal.ts:50413-50418`; `settlesUnrun`, `31940-31941`). A compiler message-bus route sets both `settlesSortedTargetsByActivityLayout` and `settlesUnrun` false (`31376-31377`, `31940-31941`). A spender-chosen `__internal__vmapBatchSlot` mismatch then takes the guard `OP_IF` false and skips `emitSortedBatchTransitionVerification` with no preservation else (`31952-31990`). |
| DS-7 | still open | `emitSlotExistsCheck` treats a nonempty commitment as an entry and does not read the lock (`GenerateTargetTraversal.ts:3735-3746`). The entry-address compare exists only for a shared-proof read (`3754-3766`). A skipped-branch read slot can still be counted from a stray own-category NFT. |
| DS-8 | fixed | A direct-convention batch, routes included, requires each target's proof index to differ from every pure-read slot's input (`GenerateTargetTraversal.ts:33882-33896`, `OP_NUMNOTEQUAL` / `OP_VERIFY`). A framed frame leaves that loop at `33873` because its records are the declarations settlement ties to the transaction. |
| DX-4 | fixed | `emitReturnEventCheck` pins the carrier when the index is nonnegative. When the index is negative it walks every output and refuses an own-category none-capability output locked with `OP_TRUE` (`GenerateTargetTraversal.ts:47362-47389`). The comment names DX-4. |
| DX-5 | fixed | A non-empty low-level call requires the named input's lock to equal the target (`GenerateTargetTraversal.ts:26602-26635`). An empty literal payload is documented as running no callee (`26680-26684`) and is not pinned. |
| DX-8 | fixed | `emitDelegateRecordConservation` requires the input record chain to equal the output chain (`GenerateTargetTraversal.ts:48842-48854`) and is called for a delegate entry (`10219`, `10250`). |
| KB-3 | fixed | The same route template requires `activeVerifier >= 0` and a real input at that index (`compiler.ts:12230-12233`). A negative index no longer skips the verifier. |
| SEM-1 | fixed | `firstUnverifiedReturn` walks into a branch and returns the early `return` (`EnsureFinalRequireTraversal.ts:334-343`, `466-471`) before `hasPriorUnconditionalRequire` can accept a later require. `enforceFinalRequire` defaults to true (`61`) and throws (`241-242`). |
| SEM-11 | fixed | An entry function id must be one of `entryFunctionPointerTargets`, the contract's public and external functions (`GenerateTargetTraversal.ts:2613-2614`, `10609-10611`, `10663-10677`). A function value inside an array or struct fails compilation (`10642-10644`). |
| CRYPTO-3 | fixed | `blockhash(n)` checks `tx.time >= n`, binds the oracle lock (`emitBindBlockhashOracleLock`), and requires `commitment.n == n` (`GenerateTargetTraversal.ts:15418-15438`). A caller-chosen index at another lock fails. |
| CRYPTO-4 | fixed | Data-NFT destroy calls `bindMintingAuthorityLock` (`state.ts:253-254`). Without an explicit lock that walk requires the final redeem to be longer than 128 bytes (`168-169`). The comment at `124-125` says the keeper baton is a one-byte redeem and does not pass. Callers pass the contract lock (`covenant-helpers.ts:293`), not the keeper. |
| TOOLS-1 | fixed | `packages/solidc/package.json`, `packages/solidcash/package.json`, `packages/utils/package.json`, and `packages/testing/package.json` depend on `git+https://github.com/mainnet-pat/libauth.git#1cf4b432864b3a4ed9f33d1992355d7286f3dab8`, a commit, not `#vm-performance-dist`. The root `package.json` uses the same pin. No new mutable git-branch dependency was added on this pass. |
| SDKFRAMED-1 | fixed | `genesisCoinRefusal` (`ContractFactory.ts:176-178`) calls `ownCoinRefusal`, which hashes the served raw transaction to the txid and requires the output lock, value, and token to match the signer's coin (`framed/deploy/own-coin.ts:20-38`, `59-78`). |
| SDKFRAMED-2 | narrowed | The default deploy is one genesis. `separateHop` is true only when the caller passes `initializeAs: 'hop'` (`framed/proxy/deploy.ts:184`, `1095`). That opt-in still broadcasts the geneses and then the hop, so the race the October row described remains for the hop and is gone for the default. |

## Still open, traced

### DX-1 satoshi container beside a no-transfer spend

Attacker: anyone who can satisfy a public function that does not transfer satoshis, on a contract that holds a satoshi container.
Shape: spend the master with that function, and spend the container with `flag = 1` and the master's input index. Pay the container's satoshis to the attacker.
What should refuse it: either the container script preserves value on the master path, or every master spend pins the container output.
Why it does not: `buildSatoshiContainerCovenantScript`'s master arm checks the authority lock, minting capability, and category (`state.ts:2524-2533`) and then succeeds. `emitValuePreservation` skips the container when there are no pending transfers (`GenerateTargetTraversal.ts:51709-51721`). The comment there says the container covenant does not protect its output on the master-spend path.

### DX-2 token container, same shape

Attacker and shape as DX-1, against a fungible-token container, taking the tokens instead of the satoshis.
What should refuse it: the master arm preserves `OP_OUTPUTTOKENAMOUNT`.
Why it does not: `buildTokenContainerCovenantScript`'s master arm ends after the authority, capability, and category checks (`state.ts:2422-2432`). The preservation compares are only on the merge arm (`2433-2457`).

### DX-6 and DS-3 unaccessed mutable NFTs on entry, chunk, and deploy functions

Attacker: anyone who can spend a function that co-spends a variable number of own-category mutable NFTs (a mapping entry, a dynamic chunk, a deploy).
Shape: co-spend an unaccessed data NFT or chunk, destroy it or replace its commitment with another `0x01` output so the count still balances, using the data-NFT covenant's master arm, which authorizes a change when the real master is present.
What should refuse it: the own-category mutable count, plus a commitment pin for every NFT the function did not name.
Why it does not: that count is skipped when `countsOwnCategoryNfts` is false (`GenerateTargetTraversal.ts:10268-10282`). The rule that does run says a re-emitted `0x01` output keeps the count and that commitments are not checked (`49133-49134`).

### DS-2 data-NFT read trusts category, not lock

Attacker: the same spender, after minting an own-category mutable NFT to their own lock (DS-3).
Shape: place that NFT at the data-record offset the function reads.
What should refuse it: `OP_UTXOBYTECODE` at that offset equals the data-NFT covenant.
Why it does not: `emitTokenCategoryVerification` compares category bases only (`GenerateTargetTraversal.ts:34926-34935`).

### DS-6 a route can still switch the sorted-batch transition off

Attacker: anyone who can spend a compiler message-bus route whose sorted writes sit in branches, including a conditional delete.
Shape: set `__internal__vmapBatchSlot_<guard>` so it does not equal the first 32 bytes of the co-spent node's commitment, or spend a commitment shorter than 64 bytes. The guard comparison is 0.
What should refuse it: the transition still runs, or the arm that did not run preserves every node.
Why it does not: `settlesUnrun` is false because `isCompilerMessageBusRoute` is true (`GenerateTargetTraversal.ts:31940-31941`), so the `OP_ELSE` that calls `emitUnrunSortedBatchCensus` is not emitted (`31982-31989`). `settlesSortedTargetsByActivityLayout` returns false for the same route (`31376-31377`), so activity settlement does not replace the guard. The `OP_IF` at `31968` therefore skips `emitSortedBatchTransitionVerification` (`31979`) and the `OP_ENDIF` at `31990` ends the check. The ran-flag allocator never reaches a route: it returns unless the bus is explicitly disabled or the master is framed (`50413-50418`).

### DS-7 skipped-branch read slot counted from any nonempty commitment

Attacker: a spender of a function that batch-writes a sorted mapping and also has a read of that mapping in a branch the call does not take.
Shape: fund the read slot with an own-category mutable NFT at another lock and a nonempty commitment, so the census counts an extra node. One real node then sits outside the per-position checks.
What should refuse it: the slot counts only when its lock is the collection's entry address.
Why it does not, on the general path: `emitSlotExistsCheck` uses commitment nonempty (`3735-3746`). The address compare is only `emitEntrySlotAtAddressCheck`, and `emitReadOnlyEntryExistsCheck` calls that only for a shared-proof slot (`3754-3780`).

## Delta since `abbb7e0ec`: covenant and trust

Each surface is a new finding or an explicit no-new-issue. The holding check is named.

### Minted-root validator, beyond `self` and empty `sender`

`emitOneMintedMasterRootRule` (`program.ts:741-777`) now checks, for each minted master: the output index is in range, the frame kind is `ROOT`, `callerRef` and `originRef` are `INDEX_NONE`, `sender` is empty (`760-767`), and `self` equals the address of the output category with the mutable capability (`768-775`). `emitOneMintedMasterCompleteness` (`692-708`) checks the output token is minting and `validatorRef` equals this validator input. The derivation matches the empty sender (`checks.ts:282-289`, `V4_MINTED_ROOT_SENDER`) and `self` (`checkV11`).

No new issue on cross-category impersonation. A `CALL` callee's `msg.sender` is the caller's `self` (`emitMessageEdge`), and that `self` is the category address of this output. Forging another contract's address fails `OP_EQUALVERIFY`.

No new issue on a minted root's `value`. The root rule does not read `value`, and that is not a spend.

- A non-payable delegate forces the value to 0. `composedFrameChecks` calls `assertZeroValue` when the frame does not handle value (`master-head.ts:693`, `1291-1294`). V5 requires the delegate's value to equal the caller's (`checks.ts:329`). `emitDelegateEdge` compares those values (`program.ts:1414-1415`). A nonzero witness fails the delegate before the body.
- A payable delegate does not get past its own value check. `parkCategoryOwner` leaves `callerRef` as the records' owner for a delegate or internal frame (`master-head.ts:479-491`). `valueChecks` then runs `OP_UTXOTOKENCATEGORY` on that index (`1080-1084`). `emitOneMintedMasterEdges` names the caller `mintedRef(output)`, which is `MINTED_REF_BASE` (`0x8000`) plus the output index (`program.ts:861-864`, `3718`). That is not an input, so the introspection fails. The shape does not settle.

A `CALL` from the minted root is a different frame: its value check uses its own input index (`master-head.ts:493-495`), and `emitFrameNet` subtracts that input's value because the frame is not borrowed (`program.ts:2219-2232`). No separate unbound-value finding.

No new issue on the other minted-root fields.

- Output lock. `self` is the category address, not the output's locking bytecode. A different lock does not impersonate another category, because `self` is checked against this output's category (`program.ts:768-775`).
- `validatorRef`, kind, caller, origin, sender. Bound as cited above.
- Callee `retval`, sender, and `self`. `requireCalleeBody` reads them from the callee input and `emitMessageEdge` requires sender to equal the caller's `self` and `self` to equal the call target (`program.ts:1347-1394`).
- Minted-root `retval`, events, sends, and segments. `emitCollectOwnEvents` and `emitFrameNet` read `OP_INPUTBYTECODE` of input masters only (`program.ts:2292-2296`, `2217-2221`). The root is an output, so those lists are not executed. A spent delegate's own witness is what its script runs, and V5 ties that witness to the call. No separate spend is authorized by stuffing the minted block's event or segment list.

Suspected, not confirmed: the framed output walk at `frame-tail.ts:1050-1056` splits 32 bytes off the input category and compares that to the output category. A 33-byte output category would not match a 32-byte base, so an extra minting output might go uncounted. The stack effect was not finished, so this is not a finding.

### Framed master and frame settlement

No new issue. A spent root's `msg.sender` is the caller's locking bytecode: `assertSenderIsTheCallersLock` requires `OP_UTXOBYTECODE(callerRef)` to be a P2PKH lock and equal the witness sender (`packages/solidc/src/framed/master/master-head.ts:1249-1261`). Validator recognition is FM-1 (`frame-tail.ts:806-814`). Created and deleted records are FW-1 (`program.ts:2928-2960`) and FW-2 (`declared-view.ts:613-619`).

### Direct sorted-batch and container covenants

DS-6 and DS-7 are still open, as traced above. DS-1 and DS-8 hold on the direct batch (`32202-32210`, `33882-33896`). No new issue beyond those two.

DX-1 and DX-2 are still open, as traced above. No new issue on the direct scan that does run: a non-delegate direct function that never names `tokens[...]` still scans foreign containers (`GenerateTargetTraversal.ts:10194-10199`). That scan does not cover a framed master.

### Message-bus kernel

No new issue on caller identity or the verifier output. The binding digest is `sha256` of the manifest, the batch, and, in a graph route, `sha256(suppliedCallers)` (`compiler.ts:12255-12258`, `12845-12849`). The verifier output index is the verifier input index, and the output commitment must carry that digest (`compiler.ts:12239-12253` and `12854-12858`). A negative verifier index is refused (`12230-12233`). Lifecycle modes past that equation were not line-read; nothing in the digest equation is a new hole.

### External and delegate calls

No new issue. A non-empty low-level call pins the callee lock to the target (`GenerateTargetTraversal.ts:26629-26635`). A negative return index refuses every own-category `OP_TRUE` carrier (`47362-47389`). A delegate's records must enter and leave equal (`48842-48854`).

### SDK deploy, sign, and provider trust

No new issue. A genesis coin is refused unless the raw transaction hashes to the txid and pays the signer's lock (`framed/deploy/own-coin.ts:27-38`, `59-70`). A framed call is evaluated on the BCH 2026 machine before broadcast (`framed/call/call.ts:2347`) and the provider's txid must equal `hash256` of the submitted bytes (`2632-2636`). `TransactionBuilder.send` applies the same txid check (`TransactionBuilder.ts:1480-1487`). Covenant `debug()` errors on that path are swallowed (`1404-1408`) and an admitted transaction does not re-enter the VM (`1455-1458`); the signed bytes are still the bytes the local builder produced, so this is not a new signing bypass.

## Ids left suspected

The framed extra-minting-output census note above. No October critical or high id is left suspected.
