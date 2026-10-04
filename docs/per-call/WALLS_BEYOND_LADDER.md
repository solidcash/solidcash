# Walls ahead of the ladder, predicted from the code (W2)

**Re-confirmed at `0948e0d5d` (2026-10-04):** all 41 pinned replica cases pass under `PER_CALL_AHEAD=1`, so every
wall below still stands after `afc0727fb` (the root reads its own mapping values), `23a455e33` (two reads at one
node) and `0948e0d5d` (grammar). Each replica pins today's refusal; its title says what should settle once served.

Branch `feat/per-call` at `1fb6987a8`, scratch tree `st182-w2`, 2026-10-04. The ladder's 66 titles are expected
green; this report asks what ordinary Solidity contracts outside it will meet. Every wall below was predicted from
the code first and then confirmed with one neutral replica, one run each, except where a run met a wall earlier
than or different from the one predicted: `stored-value-keyed-write` took three runs, `role-admin-read-key` and
`guarded-vault-root` two; a refuted replica (two runs) was deleted; one last run of all twelve verified the pins.

## 0. Method and numbers

- **Census**: every named refusal and fail-closed throw on the per-call path: 352 throw sites in
  `packages/solidcash/src/per-call/**`, 11 reasons handed to a thrower in `call/callees.ts` and
  `proxy/external-calls.ts`, 24 throws in `packages/solidc/src/per-call/**` and the 43 refusal reasons the
  compiler publishes from `solidc/src/per-call/master/support.ts` (`assessPerCallMasterShape`,
  `refusedEntries`). 441 rows, classified by rule and checked by hand where it mattered:
  **146 NOT-YET-SERVED**, 241 must-stay (integrity: malformed artifacts, deployments, drafts), 32 must-stay
  (semantics: a real revert, a value rule, the P2PKH caller, a balance of another address), 18 reporting
  wrappers, 4 operational (pool sizes). Full table in the appendix.
- **Replicas**: `packages/solidcash/test/per-call/ahead/*.test.ts` (run only under `PER_CALL_AHEAD=1`), driven
  through a shared harness `ahead/composition-world.ts`: sources are compiled the way a project compiles them
  (`solidityImportCompat` + `composition: 'per-call'`; one case uses the fixture's project options),
  deployed through `deployStatefulContract` (plain, what `deployContract` does) or `deployPerCallProxy`
  (behind the generated proxy, what `upgrades.deployProxy` does), and entered through `callPerCallEntry` (the
  plain call path a handle uses) or `callPerCallProxyEntry` (the hop). 12 files, 41 cases, all green as pinned
  in one final run (9.7 s). `npx tsc -p tsconfig.per-call-tests.json` is clean.
- **Frequency anchor** (static regex count over files with a contract, tests and mocks excluded; rough):
  solidity-by-example 137 files / MistSwap 66 / OpenZeppelin 5.0.2 63: payable function 33 / 20 / 8; native send
  out 30 / 5 / 3; emit inside a loop 0 / 5 / 1; keccak inside a loop 2 / 0 / 2 (`MerkleProof`); try/catch
  1 / 0 / 6; receiver hooks (`onERC721Received`, `onERC1155Received`) 3 / 0 / 6; mapping write keyed by a scalar
  state variable 3 / 0 / 0 (`campaigns[count]`, `bids[highestBidder]`, `balances[king]`; the regex undercounts
  `_nextTokenId++` written through a local).
- **What the ladder already exercises** (excluded): Ownable/Pausable on proxied roots, SafeERC20 pulls whose
  target is a stored struct field, ERC-20 allowances and two-key mappings, ReentrancyGuard on CALLEES, events
  with dynamic data, ECDSA, mapping=>array push, re-entry into a callee, tx.origin.

## 1. Ranked walls (confirmed)

Ranked by how many ordinary contracts hit it, how early (deploy or first call), and whether a source rewrite
avoids it.

| # | Wall | Who hits it | Met at | Replica | Kind |
| --- | --- | --- | --- | --- | --- |
| 1 | The plain call path is not the hop: a contract deployed WITHOUT a proxy cannot make a call beside its own mapping write, call one token twice, pass an earlier call's result, write two collections, store a string per key, or have a constructor that writes two mappings | every non-upgradeable dApp contract that touches a token (vaults, staking, escrows, marketplaces, fee splits, sweeps) and every token whose constructor mints and records an admin | `call/call.ts` 584, `call/callees.ts` 318/339, `call/entry-records.ts` 762/786, `deploy/genesis.ts` 548 | `plain-root-calls`, `plain-root-writes`, `plain-genesis-writes` | named refusals |
| 2 | `nonReentrant` on a proxied ROOT that calls out: a record field set before the call and restored after it | every OZ-style upgradeable entry that pulls or pays a token under ReentrancyGuard | `proxy/deploy.ts` 2113 (cause: 3249) | `guarded-vault-root` | unattributed (exhausted settle) |
| 3 | A mapping write keyed by a scalar state variable: the id counter (`items[nextId]`, OZ v5 `_nextTokenId++`) and the stored recipient (`credit[treasury]`) | listings, escrows, proposals, NFT mints, fee crediting | compiler, `support.ts` 353 (`resolveBatchKey` -> `keyOperandUnavailable`) | `state-keyed-mapping-write` | named compile refusal; served (SK1) |
| 4 | A mapping write keyed by a value read from another mapping ("credit the party the record names": `owed[deal.payee]`, `proceeds[listing.seller]`, OZ ERC721 `_balances[_ownerOf(id)]`) | escrows, marketplaces, OZ ERC721 transfer/burn | memory-copy spelling: codegen crash in `GenerateTargetTraversal.emitPerCallBatchWitnessDerivation`; direct spelling: `proxy/entry-writes.ts` 977, `call/entry-records.ts` 271 | `stored-value-keyed-write` | crash, then named refusal; served (SK1, MK1, NF1) |
| 5 | Native value through a proxy: no value in, no send out | payable entries of upgradeable contracts (sales, auctions, deposits, refunds in BCH) | `call/handle.ts` 182; implementation frame `value: 0n`, `sends: []` (`proxy/deploy.ts` 3414, 3429) | `proxied-native-value` | named (in), unattributed (out) |
| 6 | AccessControl-shaped roles: a contract constant as a key, a `bytes32(0)` literal key, and the admin check whose key is a stored value | every OZ AccessControl user (`DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`) - including its constructor or `initialize` | compiler `support.ts` 345; hop key evaluator (`stateful/route-expression-key.ts`, `evalComputedKey`); `proxy/entry-writes.ts` 920 | `role-admin-read-key` | named, unattributed, named |
| 7 | A loop that emits, hashes or pays once per turn | batch airdrops/mints, Merkle-proof claims (`MerkleProof.verify`), refund loops | compiler `support.ts` 1972, 1985, 2404 | `loop-counted-tail` | named compile refusals |
| 8 | The root re-entered by a callback below a callee | NFT staking/escrow/listing that pulls with `safeTransferFrom(..., address(this), id)`, ERC-1155 receivers, flash-loan borrowers | `proxy/external-calls.ts` 1297 (`ctx.fixed`) | `root-reentry-receiver-hook` | named (already pinned bare in `conformance/cross-contract-identity`) |
| 9 | Two deployments of one contract in one entry | swaps, pairs, two-token escrows, OTC | hop: no named refusal (bookkeeping keyed by contract NAME); plain: `call/callees.ts` 335 | `two-deployments-one-artifact` | unattributed (hop), named (plain) |
| 10 | A read of the caller's own node beside an insert that splices through it | hand-written allowlists and admin sets (`require(members[msg.sender]); members[a] = true`); about half of all inserts into a one-member set | `proxy/deploy.ts` 4579 | `read-node-spent-by-insert` | named; a variant N1 does not cover |
| 11 | Removing a member of an enumerable set: swap the last member in, pop, delete the position | OZ `EnumerableSet` users: AccessControlEnumerable, ERC721Enumerable, allowlist and staking sets | compiler `support.ts` 1193 (alias), then 386 (state form's key) | `enumerable-set` | named compile refusals |

Also found: under the fixture's project options (`messageBus: true`) a plain escrow source does not compile at all:
the message-bus route generated for `open(uint256,address,uint256)` fails its own type check (a route the per-call
convention then discards). Pinned first in `stored-value-keyed-write`. Root (2.4 (1)): the per-call type check leaves
the derived sorted-batch operands out of every call, the route's too, which forwards one; the source compiles since
SK1, at the admission ladder's narrower rung.

Refuted predictions: an internal helper that returns a value and calls out, written with an early return
(`if (asset == address(0)) return 1; return oracle.priceOf(asset);`), was predicted to be kept as an OP_INVOKE
subroutine and refused ("invoked as its own subroutine"); it settles and broadcasts. And I first predicted the
guarded vault (row 2) would settle: it is a wall.

## 2. The confirmed walls in detail

SDK paths are under `packages/solidcash/src/per-call/` (the key evaluator under `packages/solidcash/src/stateful/`),
compiler paths under `packages/solidc/src/` (`support.ts` is `per-call/master/support.ts`); replicas are under
`packages/solidcash/test/per-call/ahead/`.

### 2.1 The plain call path is not the hop (rank 1)

**Partly served.** The root's own writes (agent PL1): `call/call.ts` plans each frame's mapping writes with the hop's
`hopEntryWrites` on the frame's own records, nodes and category, so two collections, a value that chunks and a
struct record per id settle (`call/plain-root-writes.test.ts`; the replica `plain-root-writes` and the plain case of
`stored-value-keyed-write` retired). A write beside the root's call (agent PL2): the root's laid writes are declared
in the segment the artifact publishes for each, kept on either side, by the hop's own placement (`proxy/deploy.ts`
`placeOwnWrites`), so a deposit credited past the token pull or ahead of it settles (`call/plain-root-calls.test.ts`).
Routing the plain root through the hop's settle whole is more than that: `buildHopPlan` (`proxy/deploy.ts` 3423)
builds a proxy master and a delegate master over the proxy's records, which a plain root does not have. A token
entered twice, each frame writing its nodes (agent PL3): `calleeFrames` lays a node an earlier frame created at that
frame's output (the hop's `continuedOutputOf`), its settlement lists the outputs the frames create, and `call.ts`
chains every node's views over the frames of the call in the validator's order with the hop's own
`chainSharedNodeViews`, the node's input and output carrying where the chain ends; `learnCalleeValue` reads the
frames in the hop's settle order (`calleeSettleOrder`) and no frame while an earlier writer of a node it declares
still owes that node's view, so no frame is learned from a stale view and none needs learning again. Reaches one
transaction cannot carry are refused as the hop refuses them (`requireSatisfiableReachWrites`), and a frame that only
reads a node an earlier frame created is refused by name. A payout to a payee and to the fee recipient settles,
whether the fee recipient is the payee or not (`call/plain-root-calls.test.ts`). A sweep, whose transfer passes on
what an earlier `balanceOf` returned (agent PL4): `planEntryCallees` hands back the plan the hop's planner stops
before a site of the root's own (`blocked`), and `callInShape` declares the root's calls from that site on unbound
(`declareUnstatedCalls`), so the root binds the calls before it and stops there, as the execution does. The frames of
those calls are learned as on any plan, their results decoded with the hop's `reachedCallResults`, and the call
planned again from them (`reachedResults`); each stop learns a result no earlier one did, or is refused by name. A
stopped plan lays a write past its last stated call in its last segment, as the hop's does (`truncated`). The sweep
settles, and a result stated smaller in the vault's record and the read's `retval` alike is refused by the read's own
frame (`call/plain-root-calls.test.ts`; the replica retired). A callee frame's own site that waits on a result, and a
call the root guards on an earlier result (agent PL5): a stop inside a callee frame declares that frame's calls from
the site on unbound as well (every frame the plan is `truncated` in), a truncated frame owes no value and lays a
write past its last stated call in its last segment, and the result is keyed by the waiting frame's path; a guarded
call is stated as the results the plan was made from decide it (none at first), and once the callees answered,
`callInShape` decides the guards again from what they returned (the hop's `producedCallResults`), keeping a plan
whose sites that leaves unchanged (`samePlannedSites`) and planning again otherwise, at most once per result a guard
reads. A sweep that transfers only a balance the read returned, skipping the transfer when there is none, and a
keeper whose strategy sweeps its own balance settle, and a result stated otherwise in the caller's record and the
read's `retval` alike is refused by the read's own frame (`call/plain-root-calls.test.ts`). Two plain-path walls
stand. A frame that only reads a node an earlier frame created is refused by name (`call/callees.ts` 366): serving
it means declaring the read at the creator's output as the hop does (`proxy/deploy.ts` 3975, beside `readEntries`,
`call/callees.ts` 577), chaining that output's view from the creator's learned end, and the hop's held reading
(`heldPlanOf`, `proxy/deploy.ts` 2709): the read and a rewrite state the same declaration until a settle, so the hop
plans once more with `heldContinuations` and keeps that plan only when it settles. A mapping write beside a value
call into a contract is refused by name (`call/call.ts` 929); the placement it needs is PL2's (`laid.place`, 1318),
but the compiler fixes the segment of a write after a send only when it follows every call (a send widens the call
range, `solidc/src/per-call/master/support.ts` 1258), and its test needs a funded container and a paid contract,
which `ahead/composition-world.ts` `enterPlain` (215) does not carry (`call/value-harness.ts` does). A plain burn through
OpenZeppelin v5's `_update` (`from` debited, `to` = address(0) skipped, its kept predecessor `from`'s node) needs no
rule of its own: the plain path lays its batch with the hop's `layBatchRecords`, so the skipped group continues from
the view the debit leaves (`withLearnedViews`, `proxy/entry-writes.ts` 1380), and `call.ts`'s own chaining of a
node's repeated declarations only restates that view.

Replicas: `plain-root-calls.test.ts` (4 cases, retired: the deposit, the payout and the sweep are served),
`plain-root-writes.test.ts` (3, retired); `plain-genesis-writes.test.ts`
retired: **the constructor half is served** (agent C2: genesis learns each created node from the body's close and
plans run-time loops and several collections; `deploy/constructor-loop-writes.test.ts`).
A per-call artifact deployed without a proxy is entered by the SDK's handle through `callPerCallEntry`
(`StatefulContract.createStatefulFunctionCall` -> `PerCallFunctionCall` -> `call/call.ts`), which plans with its own
narrower planners (`call/entry-records.ts`, `call/callees.ts`). The ladder's roots are all proxied, so none of this
is exercised there. Met texts, in order: a vault deposit (`token.transferFrom(...); deposits[msg.sender] += amount;`),
a payout through one token twice, a sweep (`uint256 held = token.balanceOf(address(this)); token.transfer(to, held);`),
an ERC-20 `transferFrom` entered by a user, a string stored per address, a constructor that mints and records an
admin:

```text
entry "deposit" writes mapping "deposits" and makes 1 external call(s), whose segments this call path does not place its writes in yet
entry "payout" makes 2 external call(s): it enters "Token" 2 times and a frame of it writes its mapping nodes, whose views across the frames this call path does not chain yet
entry "sweep" makes 2 external call(s): the call to "IToken.transfer" reads an earlier call's result, which this call path does not plan yet
entry "transferFrom" touches 3 mapping entry(ies) across 2 sorted batch(es), and a call declares one collection's writes
entry "setName" writes mapping "names", whose values chunk, so the created node's run of chunk records cannot be declared from the call alone
the constructor of "MintAndAdmin" writes 2 mapping entry(ies) across 2 collection(s), and this deployment plans one collection's sorted writes
```

The sweep case pinned a pattern; its `where` clause is the `the call to "<iface>.<fn>"` of `external-calls.ts` 1231.
Controls that settle: `mint` (one collection) and a constructor that only mints.

Read from the code but not run: a plain root calling a callee behind a proxy (`callees.ts` 261, "sits behind a
proxy": a plain contract calling an upgradeable token), a callee that sends value, touches chunks or co-spends a
side-car (264-268), a call guarded on an earlier result (321), the value-send combinations (`call.ts` 633-789).

Likely root: two planners. `call/call.ts` (`callPerCallEntry`) plans the root's mapping writes with
`callEntryRecords` (one collection, no chunk runs, keys without the record's state) and its calls with
`planEntryCallees`, which runs the hop's own `planHopExternalCalls` and then refuses whatever the plain layout does
not place; `deploy/genesis.ts` (`planConstructorMapping`) plans one collection. The hop already serves each shape
for a delegate frame (`proxy/deploy.ts` `settleHop`, `proxy/entry-writes.ts` `hopEntryWrites` with one batch per
collection and chunk runs, `planHopExternalCalls` with execution-order re-planning).

Fix sketch: route the plain root through the hop's settle, parameterized by frame kind (ROOT on its own records
instead of DELEGATE on the proxy's) and record owner category, and retire the narrower plain planners; the plain
path's value and payee handling (`sendRecipient`, `readSatoshiContainers`) moves into that settle, which also gives
the hop the native value it lacks (2.5). The constructor genesis can reuse `hopEntryWrites` against the genesis
heads (the multi-collection batch already exists there). Until then, `callEntryRecords` must also take the
deployment's state, which `call.ts` does not pass.

### 2.2 `nonReentrant` on a proxied root (rank 2)

**Served** (agent RG1): the root takes the records its delegate frame writes from the published write landings,
as callee frames do, so a guard set before the call and cleared after it is declared changed in both segments. The
replica is retired into `call/root-guard-across-call.test.ts` and `hostile/guard-view-across-call.test.ts` (a spend
declaring the guard clear at the call is refused by the delegate frame; a call back into the guarded entry is
refused by name, as rank 8 still stands).

Replica: `guarded-vault-root.test.ts` (5 cases). Controls settle: the pull plus the credit, and the same behind a
pause check. Both guarded variants fail (`deposit` stacks `nonReentrant whenNotPaused`):

```text
the implementation's "pullGuarded" entry did not settle through the proxy in 4 attempts
the implementation's "deposit" entry did not settle through the proxy in 4 attempts
```

Likely root (read off the code after the run, checked against the published facts): the compiler publishes both
landings of the status write (`writeSegments: [{record:0,segment:0},{record:0,segment:1}]`, the same for the
modifier and the inline spelling). The hop decides which records the implementation frame writes by comparing each
record's end commitment with its start (`proxy/deploy.ts` 3249, `writes = ... !bytesEqual(commitment,
writtenCommitments[nftIndex])`) and only then consults `recordLandings`. The guard ends where it started (1 -> 2 ->
1), so the record is declared kept in every segment; the settle loop (`settleHop`) learns the mid-body view into
the record's single `writtenCommitments` slot, which makes it "written" with the wrong end view, then learns the end
view back, and oscillates until `maximumAttempts`. A callee frame decides the same from `publishedRecordWrites`
(`proxy/deploy.ts` 3617) and is served, which is why the ladder's escrow guards pass.

Fix sketch: in the implementation frame's planning, `writes[nftIndex] = recordLandings.has(nftIndex) ||
!bytesEqual(start, end)`; each intermediate landing's view out stays unstated for the derivation to learn, and the
last landing's view out is `writtenCommitments[nftIndex]` (which may equal the start). One small change; the
proxy's own segments (`proxySegments`) read the same `writes` and must follow it.

### 2.3 A mapping write keyed by a scalar state variable (rank 3)

**Served** (agent SK1): the master admits a key that reads a scalar of its own record and derives the slot from the
record its frame declares, in the segment the body reads it in (`support.ts` `deriveKeyExpression`, emitted by
`emitPerCallKeyExpression`); a key read after a straight-line write is that write's value, folded as the published
label folds it (`binop:+(state:nextId,lit:1)`). A key read behind a write no straight line folds (a branch, a loop, a
function it invokes, a call between) or after calls the source does not fix is refused by name. The hop already
resolved `state:` labels; the plain path now passes the deployment's state to `callEntryRecords`. The replica is
retired into `call/state-keyed-mapping-write.test.ts` (the counter, `items[nextId++]`, `++nextId`, the stored
recipient, both paths, a forged slot) and `solidc/test/per-call/master/state-value-key-write.test.ts` (the machine,
including a key read after a re-entered frame rewrote the value). Following locals into the emitted key also lets
the memory-copy spelling of 2.4 compile.

Replica: `state-keyed-mapping-write.test.ts` (3 cases). The control (`items[id]` keyed by a parameter) settles; the
counter key and the stored-recipient key are refused (slot index elided):

```text
the implementation's "create" entry is refused by the compiler (Registry.create()): the body writes a mapping at slot N whose key 0 'state:nextId' reads the state value 'nextId', and a master derives a target slot only from a bare parameter, the frame's sender, or a compile-time value the body holds at its start
the implementation's "pay" entry is refused by the compiler (Registry.pay()): the body writes a mapping at slot N whose key 0 'state:treasury' reads the state value 'treasury', and a master derives ...
```

Already pinned at compiler scale (`solidc/test/per-call/master/mapping-write.test.ts` 309,
`composite-key-write.test.ts` 225) as a deliberate refusal; not on any assigned list. The ladder's escrow ids pass
only because `Counters.Counter._value` is a field of a state struct, which the same check admits; OZ v5 removed
`Counters`.

Likely root: `solidc/src/per-call/master/support.ts` `keyOperandUnavailable` refuses a bare `StateAccessNode`
("the bare state read is not addressable"), because the batch derivation is emitted before the body runs.

Fix sketch: the record holding the field is declared in the frame's first segment, so the derivation can read the
field from the declared incoming view, exactly the bytes the body's own read sees, as long as no write to that
field precedes the mapping write; a dominating write is folded into the key the way
`SymbolTableTraversal.stateAssignedBefore` already folds it into the published canonical label. The SDK side is
ready: `evalComputedKey` resolves `state:` labels from the live record (`resolveHopKey` passes
`liveDeployment.state`); the plain path's `callEntryRecords` call must pass the state too.

### 2.4 A mapping write keyed by a value read from another mapping (rank 4)

**Served** (agents SK1, MK1, NF1):

- (2) SK1: the derivation emits the key with the local `d` followed to `deals[id]` (`deriveKeyExpression`), so the
  memory-copy spelling compiles, keyed as the direct one (`field:payee(map:deals(id:id))`).
- (1) is no bus defect. Under `composition: 'per-call'` the type check resolves every call against the callee's
  declared parameters, the derived sorted-batch operands left out (`TypeCheckTraversal.callSiteParameterTypes`), but
  the kernel route forwards `__internal__vmapBatchTrailingCount` at the handler's own position, so each route call to
  an entry that writes a sorted mapping fails it: the first rung and the full recompile fail for BOTH spellings, and
  the admission ladder falls through to a narrower rung, which the direct spelling compiled at. The copy spelling
  showed the error only because every narrower rung then met crash (2), so it compiles under the project options
  since (2). A route call that keeps the operand (MK1, held apart) leaves the marketplace's bytecode, ABI and layouts
  identical, changes only the `diagnostics` text of five artifacts, and takes its project compile from 87 s to 65 s.
- (3) MK1: the write keys of the hop (`entry-writes.ts` `resolveHopKey`, given a `readMappingValue` by the
  implementation frame in `deploy.ts` and by every callee frame in `external-calls.ts` `calleeEntryWrites`) and of
  the plain path (`call.ts` -> `callEntryRecords`) evaluate `map:<collection>(<keys>)` with `liveMappingValueReader`
  against the live deployment the frame is planned on: the node the frame declares for the read, a field of it, or
  the type's default where no node holds the key. The master derives the slot where the body begins through the
  body's own read, which proves the node is the one at the key, and the write binds its key's hash to the derived
  slot, so a group at another party is refused by the frame and a declaration naming another payee by settlement.
  Served in `call/stored-value-keyed-write.test.ts` (both spellings through the hop, an address-valued key through
  the hop and the plain path, the forgeries) and `solidc/test/per-call/master/mapping-value-key-write.test.ts`.
- NF1: a key read out of a node the same body writes, OZ ERC721's `_balances[_ownerOf(id)] -= 1; ...;
  _owners[id] = to`. A batch target is read through the operands its own group yields, so the derivation runs in
  rounds (`support.ts` `batchDerivationOrder`, `buildBatchTargetsDerivationScript` `resume`/`continues`): the
  batch that writes the node is declared ahead of the batch whose key reads it (the published `sortedBatchInfo`
  carries the order to the hop's planner), a round derives the groups whose keys the body holds where it begins, the
  next round's key is emitted from the node's view as its group begins it, and that round takes the record list up
  where the last one left it. The view is the value the body's own read sees only where the body reads the node
  before writing it, in the batch's segment, so a read after the write, a read in another segment, and keys that
  read each other's nodes are refused by name. The hop keys the debit by `liveMappingValueReader`, which reads the
  node as the deployment, or the reaches of the hop before the frame (`rewrittenNodes`), left it: the view the
  frame's group begins with. Served in `call/written-node-keyed-write.test.ts` (mint, `transferFrom`,
  `safeTransferFrom`, a debit moved to another party refused) and `solidc/test/per-call/master/
  written-node-key-write.test.ts` (transfer in both spellings, burn, mint; forged debit and record refused).
  Found on the way: the entry cache (`CacheMappingEntryInLoop`) took a key that reads a mapping as invariant when
  the body deletes that mapping's entry (`balances[owners[id]] -= 1; delete owners[id]`), so it wrote the debit
  back after the delete, keyed by the deleted value; a delete or a mapping write now counts as changing the key.
- Stands: the plain path cannot open a struct record (its value chunks, and the call does not declare the created
  node's chunk records), so a struct-field key is served there once that lands (2.1).
- Not served by name, liveness only: a key whose mapping read follows a call is derived from the node the first
  segment declares; a frame the call re-enters that rewrites the node leaves the body's key off the derived slot,
  and the frame refuses. Record reads take the segment the body reads them in (`deriveKeyExpression`); mapping reads
  would take the same. The same release after a call settles through the hop when nothing rewrites the node.

As W2 found it (`stored-value-keyed-write.test.ts`, 5 cases; it now pins the one that stands, beside the transfer
flipped to served, in 3), three walls stood in line:

1. Under the project options (`messageBus: true`) the unit does not compile (the message-bus route generated for
   `open`, which the per-call convention then discards, fails its own type check).
2. With the per-call options, the memory-copy spelling (`Deal memory d = deals[id]; owed[d.payee] += d.amount;`)
   crashes code generation (`emitPerCallBatchWitnessDerivation` -> `visitFieldAccess` -> `visitIdentifier`).
3. The direct spelling (`owed[deals[id].payee] += deals[id].amount`) compiles; the deal opens (control) and the
   release is refused, by the hop and by the plain path.

```text
(1) InvalidParameterTypeError: Found parameters (Deal,uint256,address,uint256,bigint,uint256,bigint) in call to function '__message_bus_entry_open' where parameters (Deal,uint256,address,uint256,uint256,bigint) were expected ... This is a compiler defect
(2) StackVariableUnavailableError: Expected variable 'd' does not exist on the stack
(3) the implementation's "release" entry writes mapping "owed" at a key this hop cannot resolve from its call data (field:payee(map:deals(id:id)))
(3) entry "release" touches mapping "owed" at a key the frame's arguments do not determine (field:payee(map:deals(id:id)))
```

Likely roots: (2) `support.ts` `resolveBatchKey` follows a bare identifier key through `resolveKeyIdentifier`, but
for a field access it returns the key expression unresolved while `keyOperandUnavailable` resolved `d` internally
to admit it; the emitter then visits `d` at the top of the body, before the local exists. (3) the SDK key
evaluators (`proxy/entry-writes.ts` `resolveHopKey`, `call/entry-records.ts` `resolveKeys`, both through
`evalComputedKey`) know the call's arguments, the sender, constants and the record's scalar state, never another
collection's node: `map:deals(...)` looks for a state ARRAY named `deals`.

Fix sketch: (2) return the key with every local substituted by its single definition (the walk already computes
it), or refuse by name; (3) give `evalComputedKey` a node lookup for `map:<collection>(<keys>)` against the
deployment's `nodesByCollection` (decode the node value, then `field:` selects the member), resolved in the plan's
execution order so a node an earlier write in the same hop changed is read at that write's view (the hop already
reads such nodes as kept read nodes in `calleeReadNodes`). (1) skip message-bus route generation when the
composition is per-call, or fix the route's hidden-parameter arity.

### 2.5 Native value through a proxy (rank 5)

**Served** for the hop's root (agent NV1), as spec 4b, V5 and V7 already state it: the proxy's root frame takes the
call's value (`callPerCallProxyEntry` `value`, and a handle's `withValue`), paid by the caller into a satoshi
container of the proxy, and the delegate frame carries the same value as its `msg.value`; the implementation's sends,
a send per loop turn among them, follow a container of the proxy in a run and are paid from the proxy's containers,
each lock and amount learned from the body's own pin as the plain path learns them (`proxy/hop-value.ts`). A send on a
branch is listed when the run makes it, and a balance reader spends every container of the proxy. The generated
proxy's fallback is `payable` when an entry behind it is, as an EVM proxy's is. Refused by name: value for an entry
that is not payable, a send the proxy's containers cannot cover, a proxy whose fallback is not payable, and a send to a
contract from the implementation's body (its call into the recipient's `receive()` is the plain path's paid-contract
frame, which the hop does not plan). Served in `call/proxied-native-value.test.ts`, with forged values refused by the
machine; the ahead replica is repointed at the send to a contract. Not served: value into a deployment's `initialize`;
a contract behind a proxy paid by another (the value call would enter the proxy's fallback and delegate into the
implementation's `receive()`, a frame pair neither call path plans for a paid contract); a typed call with value is
refused at compile time (`support.ts` 3023, the direct path's value-transfer machinery).

Replica (as first met): `proxied-native-value.test.ts` (3 cases). Value in is refused by the handle
(`callPerCallProxyEntry` has no `value` option at all); a send out fails in the frame, which reads its send slot and
finds the no-index sentinel:

```text
a call to "deposit" through a proxy carries no value: a delegate frame takes none yet
the implementation's "withdraw" entry did not settle through the proxy: frame "implementation-master" of Bank.withdraw() at line 8: no source message (Program attempted to read from an invalid transaction output index. Transaction output count: 6; requested index: -32767.)
```

Likely root: `proxy/deploy.ts` states the proxy's ROOT frame and the implementation's DELEGATE frame with
`value: 0n` and `sends: []` (3384-3430), and the hop reads no satoshi containers. Fix sketch: carry the call's
value on the proxy's root frame (paid into the proxy's containers) and keep it as the delegate frame's `msg.value`;
plan the implementation's sends the way `callPerCallEntry` plans `entry.transfers` (recipient recipes, payees,
`readSatoshiContainers` of the proxy category). This falls out of 2.1's fix if the two paths share one settle.

### 2.6 AccessControl-shaped roles (rank 6)

**Served** (agent AC1): a contract or file-level constant is a key (the master derives it as code generation
inlines it), a key label publishes a constant and a byte-changing cast of a literal as the exact bytes the body
hashes (`semantic/compileTimeKeyValue.ts`), and the admin check reads its key out of the admin node through the
mapping reader `evalComputedKey` now takes. Served in `call/role-admin-read-key.test.ts`; the ahead replica is
repointed at the walls past it: helpers that return a bool and emit (refused at compile time, X118), and a role
write on a branch the body skips. The skipped write and the event beside it are served (agents GW1 and CE1, both
publishing the condition they run under): `call/guarded-mapping-write.test.ts`, `call/guarded-event.test.ts`.
With the returning helpers served too (below), the replica pins no wall and is retired.

**Served** (agent AH1): helpers that return a bool and emit, the library's current `_grantRole` and `_revokeRole`.
X118 refuses a value-returning helper that emits behind OP_INVOKE, where its event would be dropped at its exit, so
such a helper has to be inlined, and `InlineReturningStateHelpers` inlines only a single tail return. The
desugaring that gives a multi-return helper that touches a collection that shape (`DesugarNestedBranchReturn`)
looked for a collection read, and these helpers only write and emit. It now also takes a helper that emits, in its
body or through a function it calls. Served in `call/role-helpers-return-and-emit.test.ts` (a grant and a
revocation with their events read back, the result discarded and returned); a grant to a holder, which neither
writes nor emits, settles returning false (the skipped write and the skipped event, agents GW1 and CE1). A helper
that cannot be inlined (recursive, used as a value, called where its effects cannot be hoisted) keeps X118.

Replica: `role-admin-read-key.test.ts` (4 cases). The member mapping inside a struct inside a mapping is served:
`initialize` keyed by a role parameter deploys, and `grantByOwner(role, account)` settles. Then, in order: a
contract constant as the key (`_roles[DEFAULT_ADMIN_ROLE]`; `_roles[MINTER]` with `MINTER = keccak256("MINTER")`
the same), the literal `bytes32(0)` as the key (the same key failed `initialize` in the first run), and
`grantRole` (`require(hasRole(getRoleAdmin(role), msg.sender))`):

```text
the body writes a mapping at slot 0 whose key 0 'id:DEFAULT_ADMIN_ROLE' is the local 'DEFAULT_ADMIN_ROLE', which is not bound to a single compile-time value
the implementation's "grantZero" entry did not settle through the proxy: frame "implementation-master" of Guarded.grantZero() at line 33: no source message (Program failed an OP_VERIFY operation.)
the implementation's "grantRole" entry reads mapping "_roles__adminRole" beside the batch it writes, which this hop does not declare
```

- Constant key. Root: `support.ts` `resolveBatchKey` sends a bare identifier key to `resolveKeyIdentifier`, which
  knows locals only; the `constants.has(name)` admission in `keyOperandUnavailable` is never reached for it. Fix:
  check the constant set first and emit the constant's value (as inside an expression). OZ's own
  constructor/`initialize` (`_grantRole(DEFAULT_ADMIN_ROLE, admin)`) has this key, so an AccessControl contract
  cannot deploy at all.
- `bytes32(0)`. Likely root (from the code, not traced): `evalComputedKey` reads `cast:bytes32(lit:0)` through the
  cast as the integer 0 and encodes it as the empty script number, while the body hashes 32 zero bytes, so the
  planned slot is not the body's (`lit:0x00` would give 1 byte). Fix: encode a literal key at the collection's key
  type (`bytesN` -> N bytes), and publish a folded constant (`keccak256("...")`) as `lit:0x<32 bytes>`.
- `grantRole`. Root: the admin check's key is a stored value; `calleeReadNodesOrNone` (`proxy/external-calls.ts`
  1754) swallows the read planner's failure and returns NO read nodes, so the batch planner refuses the first
  undeclared read (`entry-writes.ts` 920). Fix: resolve such read keys as in 2.4 (3), and stop dropping every read
  node silently (it also misattributes the refusal).

### 2.7 A loop that emits, hashes or pays per turn (rank 7)

**Served** (agent LP1): a master with a body that emits or sends from a loop checks that region as a run of
consecutive outputs and parks its first output and declared count; the body binds its k-th event or send at the run's
k-th output and its k-th hash at the k-th side-car after its input, and pins the event and send counts where it ends.
The compile publishes the order as runs per kind with each loop's recurrence (`loopEffects` on the stop-site row,
`master/loop-effects.ts`), which the call path and the hop expand by the turns (`call/loop-turns.ts`). Served in
`call/loop-turn-effects.test.ts` (an airdrop, an event batch, a path walk of keccak256, at 0, 1 and 3 turns, the
batch and the walk through the hop too; forged counts refused). Still refused by name: a looped effect on a branch, in
a nested or do-while loop, or in a loop no counted recurrence bounds; a callee or paid contract that loops them; a
constructor that emits from a loop. The hop's looped send is served with rank 5 (agent NV1), so the replica is retired.

Replica: `loop-counted-tail.test.ts` (4 cases). The control (a loop over the caller's array writing a scalar)
settles. Through the hop each entry is `the implementation's "<entry>" entry is refused by the compiler
(Batcher.<entry>()): <reason>`, with these reasons for `announce`, `claim` and `refund`:

```text
an event emitted from a loop makes the event count depend on the loop, so the master cannot fix how many events the tail holds
a keccak256 call inside a loop reads one compute side-car per turn, which the master head does not locate a run-time number of
a value send inside a loop makes the send count depend on the loop, so the master cannot fix how many sends the tail holds
```

Root: `support.ts` `assessPerCallMasterShape` (1972, 1985, 2404): the head fixes the event and send regions and
the side-car positions per body. Fix sketch: the run-time position mode calls already use (a block declares the
count; the body binds the k-th record from a counter) applied to the event and send regions and to side-car
offsets; the hop sizes them from the loop's iteration domain as `occurrenceCountOf` does for calls. A constructor
hits the same in `deploy/genesis.ts` 336-354.

### 2.8 The root re-entered by a callback (rank 8)

**Served** on the hop (agent RE1): a call that reaches the hop's own root address places the root's deployment as
one more callee behind its proxy (`HopExternalPlanOptions.reentrantRoot`), on the masters of the root's pools after
the root's own, in the root's own blocks and on the root's own records. The records chain through the root's frames
and the re-entered ones in the validator's order: the root frame's writes before the last call that leads to a
re-entry are left for its own close to state (learned by deriving the root up to that call, `deriveReentryWriters`),
its writes after it continue from what the re-entered frames left, and a record's output is its chain's end (the
composer reads the end in the validator's walk order). A re-entry that repeats an entry two enclosing frames of the
root already run is placed without its own calls, so a reentrancy guard refuses by its own reason. Refused by name:
a re-entered frame that touches a mapping or dynamic value the root's own frame touches. The plain call path still
refuses the bare form. Served in `call/root-reentry.test.ts` (hook, ERC-721 spelling, flash loan repaid and repaid
short, a forged view of the re-entered frame) and `call/root-guard-across-call.test.ts` (the guard's own reason).

Replica: `root-reentry-receiver-hook.test.ts` (3 cases). Setup (mint two deeds, approve the locker; plain roots)
settles. Both spellings, the unconditional hook and the ERC-721 one behind `to.code.length > 0`, meet the same
refusal; the code-length check is not an earlier wall (a P2SH32 address is code-bearing on both sides):

```text
the call to "IReceiver.onReceived" reaches "Locker", which this hop already places; a contract that reaches itself below itself cannot be given a second block in the hop
```

Root: `proxy/external-calls.ts` 1297 refuses any callee whose contract is in `ctx.fixed` (the root's
implementation). Re-entry into a CALLEE is served (`proxy/reentry.ts`). Fix sketch: let the root's contract take
another master from its pool, as `placeCalleeMasters` does for callees, and carry the root's view at the call into
the re-entered frame (`withReentryFrames`); for a proxied root the re-entered frame is another proxy master plus
implementation pair. Known in the bare form (conformance rows "A -> B -> A.k() re-entry" and
"IA(address(this)).g()"); not on the assigned list.

### 2.9 Two deployments of one contract (rank 9)

**Served** on the hop and the plain call path (agent TD1): a block is a deployment's (`deploymentBlockId`
keeps the contract's name for the first deployment of a name and qualifies a further one by its category), and
record ids, master counts, draft masters, validator coverage and master-pool slots follow it; ids of a composition
with one deployment per contract are unchanged. Served in `call/two-deployments-one-contract.test.ts`; the ahead
replica keeps the off-chain read path's view over both deployments (`read/read.ts` resolves no target from the
caller's state, and keys its blocks and records by name behind that).

Replica: `two-deployments-one-artifact.test.ts` (3 cases). One token settles (control). Both tokens: the hop has
no named refusal and the second token's frame fails; the plain path refuses by name:

```text
the call's callee "Token.credit()" did not settle through the proxy: frame "callee-master-1" of Token.credit(): no source message (Program failed an OP_VERIFY operation.)
entry "both" makes 2 external call(s): it reaches two deployments of "Token", whose blocks and records this call path does not tell apart yet
```

Root: the hop keys its bookkeeping by `artifact.contractName`: master slots (`external-calls.ts` 1820), record ids
`${contract}-record-N` (`calleeRecordSet`, whose UTXO map the second deployment overwrites), callee blocks
(`proxy/deploy.ts` 3149-3152), masters per contract and the validator's `covers`. Fix sketch: key all of them by
category (or `contract@category`); until then, port the plain path's named refusal so the hop fails closed by name.

### 2.10 A read of the caller's node beside an insert through it (rank 10)

**Served** on the hop's root (agent RB1): a read whose node the entry's own batch spends, a predecessor its insert
relinks or a target it rewrites, is declared at the batch's input, which `buildHopPlan` places once. The frame
declares the node at the read's position ahead of the batch's groups, kept at the view the batch's own declaration
starts the segment from (the spent view up to the write's segment, the written one after it), and the batch's
transition follows; the frame proves the read's key and the insert's bracket against the node's first declaration in
the segment, and the validator chains the two. A forged view is refused by the frame or the validator, as before.
Served in `call/read-node-spent-by-insert.test.ts` (an allowlist insert through the caller's node, then another
through the node it relinked, and beside a call on either side of the insert; role grants whose member's predecessor
is the admin's node, and a non-admin's grant refused by the body's own check there); `call/proxied-read-beside-batch`
settles its read of the written mapping at the node the batch spends. Still
refused by name: a read under the very key the batch writes (`require(members[msg.sender]); members[a] = true` with
`a` the caller), since the frame reads that key as its segment began and the artifact does not publish whether the
source reads it before or after the write. Not served: the callee form (`external-calls.ts`, pinned in
`ahead/hop-callee-read-beside-batch`) and the plain form (`call/entry-records.ts`); and an absent key the body
reads past a call after an insert into the same gap below it, which the created node brackets by then: the read is
declared at the relinked predecessor, which no longer brackets the key, so the frame refuses it.

Replica: `read-node-spent-by-insert.test.ts` (2 cases). With one member, an insert whose key's slot falls below the
caller's settles; one above it meets:

```text
the implementation's "add" entry reads mapping "members" at a node its batch also spends, which one transaction cannot spend twice
```

Root: `proxy/deploy.ts` 4572-4583 (`entryWritesFor`); the callee form is `external-calls.ts` 1521 (pinned in
`ahead/hop-callee-read-beside-batch`), the plain form `call/entry-records.ts` 947. A user sees it as random: it
depends on where the new address hashes. Fix sketch: when a read's node is a node the batch spends, read it from
the batch's own group (its declared view in) instead of a second input: the same one-input-per-node rule N1 needs
for two reads; not covered by N1 as assigned (N1 is two reads).

### 2.11 An enumerable set's swap-and-pop removal (rank 11)

**Scoped, not served** (agent SP1). OpenZeppelin's `EnumerableSet` keeps an array of members and a mapping of
one-based positions. `add` (push, then record the pushed length) and the views `contains`, `at` and `length` settle
behind the generated proxy in both forms: the set as contract state (one sorted batch beside one dynamic run) and per
group id (an array per key beside a two-key mapping, two batches); `call/enumerable-set.test.ts`. `remove`
(`values[i] = last; positions[last] = i + 1; values.pop(); delete positions[v];`) is refused at compile in both:

```text
the implementation's "remove" entry is refused by the compiler (MemberSet.remove()): the body writes a mapping at slot 1 that can alias another target at run time, so its record is not fixed
```

The walls, in order:

1. **The swap-remove alias** (both forms). A write that a `delete` of another key of one mapping follows is marked
   `aliasCondDeleteSlot` (`SymbolTableTraversal.ts` 11358); the direct convention gates the write off where the two
   keys meet (GTT 25078), and a per-call master derives no batch with such a target (`support.ts` 983, 1193). In a
   consistent set `if (valueIndex != lastIndex)` keeps the keys apart wherever the write runs; the compiler cannot
   see that.
2. **The state form's key**: the array's last element, whose bytes live in the frame's chunk run (`support.ts` 557-569;
   the hop already evaluates the label from state, `route-expression-key.ts` 134-161). With the `delete` moved ahead
   of the write, which no alias marks, the removal is refused there:
   `... whose key 0 'map:_values(binop:-(unop:.length(state:_values),lit:1))' reads the state value '_values', ...`.
   The group form compiles that way (its key reads the node its own batch writes); its hop run is not measured.
3. **Removing the last member** (code read): the branch skips the write, but its key evaluates to the removed
   member, so two targets of one batch name one slot. The planner refuses a repeated slot whether or not a target is
   skipped (`composer/mapping-plan.ts` 418, "a sorted batch writes slot ... more than once"), a skipped target whose
   key is held keeps that very node (463), and the distinct-target check compares every pair's derived slots
   (GTT 29109). In a multi-slot batch a guarded write publishes no `activation`, and one that did not run declares
   its node kept (GTT 43513-43525): here the node the delete rewrites. An alias-marked write takes no flag (43495).
4. **Then, predicted**: the group form's overwrite and pop of `_values[group]` publishes no value, which the hop
   learns from the body's close (`entry-writes.ts` 1157-1174); the state form's run shortens, sized from its record's
   declared length (`planHopDynamicRun`).

Plan: (a) admit `aliasCondDeleteSlot` in a per-call master (`support.ts` 983, 1193; `runtimeAliasPriorSlots` stays
refused), the marked write a target its frame may skip; (b) skip the distinct-target comparison for a pair one of
whose targets is declared skipped (`PredOut` -2; GTT 29109, the general arm); (c) let a skipped target whose slot
another target writes keep the key's predecessor (`mapping-plan.ts` 418, 463), and have the hop declare the write
skipped where the keys it resolves meet (`entry-writes.ts` 1129); (d) prove swap, remove-last and the unguarded
`m[last] = v; delete m[k]` on the machine first (the `master/aliased-batch-targets` harness): the alias gate's no-op
is then what the skipped group declares, so the delete wins as on the EVM. The state form also needs (e): the
derivation reading the last element out of the frame's chunk run (`support.ts` 563).

Replica: `enumerable-set.test.ts` (4 cases): both forms' removal refused through the hop, the state form's key
refusal past the alias, and the group form compiling past it.

## 3. Predicted, not run (code only), most likely first

| Shape | Refused at | Likelihood | Note |
| --- | --- | --- | --- |
| a typed call with value (`IWETH(weth).deposit{value: v}()`) | `support.ts` 3030 ("direct path's return-event or value-transfer machinery") | M (DEX routers, wrappers) | compile refusal per entry |
| `msg.sender` as the call target (`ICallback(msg.sender).cb(...)`, V3-style callbacks) | `support.ts` 3095 | M-L | compile refusal |
| try/catch whose callee reverts | `support.ts` `callCountRange` ("a catch block is not an executable path") | M-L | not a refusal: the catch never runs, the whole call fails closed with the callee's reason |
| Multicall / any low-level call but a forwarding delegatecall | `support.ts` 2840 | M | pinned in `conformance/cross-contract-identity` (delegatecall row) |
| a loop over a mapping's array calling out (refund every bidder of `bids[id]`) | `external-calls.ts` 618/710, or `support.ts` 1953 first | M | likely overlaps R12 (a call routed through the root's own mapping value) |
| overwrite or remove an element of a mapping's array (`lists[user][i] = last; pop()`) | `entry-writes.ts` 1503 | M | swap-and-pop removal; the enumerable set meets the compiler first (2.11) |
| two dynamic state values written by one entry; sorted collections beside a dynamic value | `entry-writes.ts` 1623, 1988 | M | served (below) |
| a mapping write in a loop not over the caller's array (ERC-1155 `_update` over `ids`, two keys per turn) | `support.ts` 667, `entry-records.ts` 346-421 | M | |
| a constructor/`initialize` key or value the arguments do not fix | `genesis.ts` 520, 603 | M | |
| a returning entry through the generated closure proxy | `deploy.ts` 2139 | L-M | not exercised here |
| CREATE (factories), function pointers | `support.ts` 1909, 1912 | M (factories) | known, pinned (`NO_CREATE`) |
| ecrecover per loop turn (multisig) | `support.ts` 1991 | L | |
| assembly the lowering leaves in a body | `support.ts` 1943 | L | most OZ Yul is lowered |
| one node touched by an enclosing and an enclosed frame; a chunked value across reaches; two inserts of one key | `external-calls.ts` 2324, 2338-2378, 2220 | M | known (`NEXT_BRANCH.md`) |
| a read that re-enters its own contract | `read/read.ts` 651 | L-M | the read path's twin of 2.8 |

**Several dynamic runs, and a run beside several batches: served** (agent DV1). Met behind the generated proxy:
`the implementation's "pay" entry writes 2 sorted collections beside a dynamic value, whose records this hop does not
order` (two mappings and a push) and `the implementation's "join" entry writes 2 dynamic value(s), and this hop plans
one run to one variable` (two pushes; two strings set together, the same). The compiler admitted both: a master's
write segment declares every batch's groups back to back (the derivation walk), then one run per written value in
state declaration order, each at the wider of its two versions (`emitDynamicWriteVerification`,
`dynamicReadPriorRuns`), then the value chunks it finds by address. `dynamicWrites` is emission order, so the artifact
now publishes the frame's order as `dynamicWriteOrder` (several runs, or one beside several batches) and
`hopEntryWrites` lays the families in it; an earlier batch's value chunks now follow the runs instead of sitting
between two batches' groups. Past it, a second append to an array of fixed-width elements (`uint256[]`) threw
`Invalid VM number: Failed to decode VM Number: the number is not minimally-encoded.`: the hop read the live run as
a framed array (a count, then the elements), while such an array is stored as the tight blob its elements pack into
(`StateReader`), so the element is now packed onto the live blob (`appendedRunValue`). Then (agent DV2):
- the second of two pushes stopped on an `OP_VERIFY` at the later push (`... "join" entry did not settle through the
  proxy: frame "implementation-master" of Roster.join() at line 25`): a read of the later run steps past the earlier
  run's width as the data record declares it, and the first attempt declares the record before the body's close
  states it, so a stated run that another run follows is laid at the record's width until the record is learned;
- beside an external call, a run other than the first listed was refused as `writes a mapping record beside an
  external call, and the segment that write lands in is not fixed`: `laidWriteRecords` now names every run's chunk by
  its own covenant lock;
- `dynamicGrowthFloorLength` sizes a fixed-width array grown by a bare `push()` as the tight blob, not a framed one
  (a live blob read as a framed array miscounted, or threw `Invalid VM number` past a stated push of `7`).

`call/dynamic-run-order.test.ts`. Past the lock fix, a field written before the call into the record the runs size
(`entries += 1; ping(); stamps.push(); notes.push()`) is refused at the call: `... did not settle through the proxy:
frame "implementation-master" of Journal.log() at line 56: no source message (Program failed an OP_VERIFY
operation.)`. Served (agent DV3): the frame closes a record at each call while it holds none of the record's dynamic
fields (`perCallRecordsWrittenHere`), so its close at the call held the count against a declaration the hop kept,
because a record a dynamic write sizes was published as written in the last segment alone
(`perCallRecordWriteSegments`). The record is now published written in each segment a write of its other fields lands
in before the frame first holds a dynamic field of it (the outermost branch or loop around that write holds it from
its start), and in the last; the hop chains the two declarations. A framed run grown by a bare `push()` that another
run follows is laid at the width its record declares, as a stated one is. Still predicted, not run: a callee frame
plans with its records as the deployment holds them and is not re-planned from the record its settle learns, so a
callee that writes two dynamic values keeps a run another follows at the live width.

## 4. Replicas to land

All under `packages/solidcash/test/per-call/ahead/`, skipped unless `PER_CALL_AHEAD=1`; each case pins what is met
today and its title says what should settle once served.

| File | Cases | Pins |
| --- | --- | --- |
| `composition-world.ts` | - | shared harness: project/per-call compile, plain and proxied deploy, both call paths, `recordMet` |
| `plain-root-calls.test.ts` | 2 | 2.1, retired: served (`call/plain-root-calls.test.ts`) |
| `plain-root-writes.test.ts` | 3 | 2.1, retired: served (`call/plain-root-writes.test.ts`) |
| `plain-genesis-writes.test.ts` | 2 | 2.1, retired: served (`deploy/constructor-loop-writes.test.ts`) |
| `guarded-vault-root.test.ts` | 5 | 2.2, retired: served (`call/root-guard-across-call.test.ts`) |
| `state-keyed-mapping-write.test.ts` | 3 | 2.3, retired: served (`call/state-keyed-mapping-write.test.ts`) |
| `stored-value-keyed-write.test.ts` | 3 | 2.4, retired: served (the struct record opened plain in `call/plain-root-writes.test.ts`, the ERC721 transfer in `call/written-node-keyed-write.test.ts`, the rest in `call/stored-value-keyed-write.test.ts`) |
| `proxied-native-value.test.ts` | 1 | 2.5 served (`call/proxied-native-value.test.ts`); repointed: a send to a contract |
| `role-admin-read-key.test.ts` | 2 | 2.6, retired: served, with the walls past it (`call/role-helpers-return-and-emit`, `call/guarded-event`) |
| `loop-counted-tail.test.ts` | 4 | 2.7, retired: served (`call/loop-turn-effects`, `call/proxied-native-value`) |
| `root-reentry-receiver-hook.test.ts` | 3 | 2.8, retired: served (`call/root-reentry.test.ts`) |
| `two-deployments-one-artifact.test.ts` | 3 | 2.9 (control: one token) |
| `read-node-spent-by-insert.test.ts` | 2 | 2.10 (control: head predecessor) |
| `enumerable-set.test.ts` | 4 | 2.11 (adding and the views served in `call/enumerable-set.test.ts`) |
| `field-before-call-beside-runs.test.ts` | 1 | section 3, retired: served (`call/dynamic-run-order.test.ts`) |

Run: `PER_CALL_AHEAD=1 yarn workspace solidcash vitest run --config vitest.per-call.config.ts test/per-call/ahead/<file>`.
`recordMet` writes the met text to `$AHEAD_OBSERVE_DIR/met.txt` when that is set (used for the unattributed walls).

## 5. NOT-YET-SERVED census, ranked

H = most ordinary contracts with the shape's feature meet it; M = a common pattern; L = specialised. "conf." = a
replica above confirms it. The full table with every row and class is the appendix.

| Rank | Site | Shape refused | Lik. | Status |
| --- | --- | --- | --- | --- |
| 1 | solidcash `call/call.ts` 584, 707 | plain root: mapping write beside a call | H | 584 served (PL2); 707, beside a value call into a contract, stands |
| 1 | solidcash `call/callees.ts` 339 | plain root: one callee entered twice, a frame writing nodes | H | served (PL3) |
| 1 | solidcash `call/callees.ts` 318, 321 | plain root: argument from, or call guarded on, an earlier result | H | served (PL4, PL5) |
| 1 | solidcash `call/entry-records.ts` 762, 786 | plain root: two collections; chunked mapping value | H | served (PL1) |
| 1 | solidcash `deploy/genesis.ts` 548 | constructor writing two collections | H | conf. 2.1 |
| 1 | solidcash `call/callees.ts` 258-271 | plain root: callee behind a proxy / delegate / sending value / touching chunks / side-car / unfixed segment | H | code |
| 1 | solidcash `call/entry-records.ts` 271, 818, 884, 897, 911, 947, 346-421, 582, 879 | plain root: key not from arguments; several writes per target; reads; loop writes | M-H | 271 conf. 2.4; a key read out of another mapping served (MK1) |
| 1 | solidcash `call/call.ts` 516, 622, 633, 661, 700, 717, 738, 742, 789, 991 | plain root: single-body contract; value-send combinations | M | code |
| 2 | solidcash `proxy/deploy.ts` 2113 | hop root: a record restored to its start across a call (nonReentrant) | H | conf. 2.2 (no named refusal) |
| 3 | solidc `master/support.ts` 353 | key reads a scalar state value / an unaddressed mapping entry / a computed value | H | scalar state served (SK1); the rest stands |
| 4 | solidc `GenerateTargetTraversal.emitPerCallBatchWitnessDerivation` | key through a local copy of a mapping entry: codegen crash | H | compiles (SK1); served (MK1) |
| 4 | solidcash `proxy/entry-writes.ts` 977 | hop root: key from another mapping's value | H | served (MK1); a key from a node the body writes served (NF1) |
| 5 | solidcash `call/handle.ts` 182 | value through a proxy | H | conf. 2.5 |
| 5 | solidcash `proxy/deploy.ts` 3414, 3429 | hop: implementation frame sends (no named refusal) | H | conf. 2.5 |
| 6 | solidc `master/support.ts` 345 | key is a contract constant (bare identifier) | H | conf. 2.6 |
| 6 | solidcash `stateful/route-expression-key.ts` `evalComputedKey` | `bytesN` literal key encoded as a number (no named refusal) | H | conf. symptom 2.6 |
| 6 | solidcash `proxy/entry-writes.ts` 920 (via `external-calls.ts` 1754) | hop root: a read the planner cannot key drops every read node | H | conf. 2.6 |
| 7 | solidc `master/support.ts` 1972, 1985, 2404, 1991 | events, keccak, sends, ecrecover per loop turn | M-H | conf. 2.7 (not 1991) |
| 7 | solidcash `deploy/genesis.ts` 336, 341, 348, 354, 362 | constructor: loop events, value send, loop hashing/recovery | M | code |
| 8 | solidcash `proxy/external-calls.ts` 1297 | root re-entered below a callee | M-H | conf. 2.8 |
| 9 | solidcash hop bookkeeping (`external-calls.ts` 1820, `calleeRecordSet`; `deploy.ts` 3149) | two deployments of one contract (no named refusal) | M-H | conf. 2.9 |
| 9 | solidcash `call/callees.ts` 335 | plain: two deployments of one contract | M-H | conf. 2.9 |
| 10 | solidcash `proxy/deploy.ts` 4579; `external-calls.ts` 1521; `call/entry-records.ts` 947 | a read node the batch also spends | M | conf. 2.10 (root) |
| 11 | solidc `master/support.ts` 3030 | typed call with value / opaque return | M | code |
| 11 | solidc `master/support.ts` 2840 | low-level call other than the forwarding delegatecall | M | pinned (conformance) |
| 11 | solidc `master/support.ts` 1909 | CREATE | M | known, pinned |
| 12 | solidc `master/support.ts` 3095, 3101, 3022, 3013, 3135, 3148 | call target is `msg.sender` / not one held value; run-time selector; switch-counted calls; unrecoverable or unencodable arguments | M-L | code; 3101 R12-adjacent |
| 12 | solidc `master/support.ts` 662, 667, 678, 682 | mapping write shapes: several ops per target, in a loop, touched outside the batch | M | code |
| 12 | solidc `master/support.ts` 1953 | a long mapping value read per loop turn | M | code |
| 12 | solidc `master/support.ts` 1995, 2006, 2074, 2091, 2110, 2985 | subroutine calls/balances; a write the source does not place relative to calls | M-L | code (2.x refuted one form) |
| 13 | solidcash `proxy/entry-writes.ts` 905, 1029, 1094, 1503, 1516, 1623, 1658, 1680, 1686, 1780, 1789, 1964, 1988 | hop root: loop batches with chunks, several ops per target, array element mutation, dynamic runs beside batches | M | code |
| 13 | solidcash `proxy/entry-writes.ts` 769, 788, 1157 | hop root: a field read at an unresolvable key / unreassemblable value | M | code |
| 13 | solidcash `proxy/external-calls.ts` 605, 618, 710 | a loop whose bound or counter the caller's facts do not fix | M | code |
| 13 | solidcash `proxy/call-resolution.ts` 301, 311, 370, 384 | a target or argument the hop cannot resolve | M | code; R12-adjacent |
| 13 | solidcash `proxy/external-calls.ts` 1514, 1645, 1669, 1704 | callee writes/reads the hop cannot declare | M | code |
| 14 | solidcash `proxy/external-calls.ts` 2220, 2324, 2338-2378; `enclosed-reads.ts` 110 | node sharing across reaches (inserts, enclosing frames, chunked relinks) | M | known (NEXT_BRANCH) |
| 14 | solidcash `proxy/external-calls.ts` 1823, 1966 | re-entry beyond the callee's master pool | L (operational) | split the pool |
| 14 | solidcash `proxy/deploy.ts` 472, 686, 737, 1366, 1636, 2041, 2139, 2515, 2531, 2601, 2649, 2874, 3585 | hop segment placement, settle order, learned values, closure-proxy returns | M-L | code |
| 15 | solidcash `read/read.ts` 456, 651, 1195, 1213, 1978 | read path: arguments, re-entry, chunk turns, keys, loop bounds | M-L | code |
| 15 | solidcash `composer/refusals.ts` 107, 119, 151 | composer: a slot written twice in a batch; a node rewritten in its creating segment; chunk plan | L | code |
| 15 | solidc `master/support.ts` 1943, 1966, 1980, 2015, 2329, 2354, 2459; `master/lifecycle.ts` 174 | assembly left in a body, hidden parameters, blockhash, loop guards, constructor calls/sends, composite returns, unattributed events | L | code |

Must stay (by design): the balance of another address (`support.ts` 2002, 2029, 2032), the root caller is a
25-byte P2PKH lock and signs SIGHASH_ALL (`call.ts` 479, `deploy.ts` 961/4467, `genesis.ts` 976), a master calling
itself (`assemble.ts` 379/468: `this.f()` runs inline), the zero-address target, value rules (not payable, negative
value, no `receive()`), a signature as a call argument (`call-resolution.ts` 395), a loop counter that never
advances, insufficient container funds (`call.ts` 902/918/948: a real revert), the funder signing a different lock
than `msg.sender` (`deploy.ts` 4256), and every integrity check over artifacts, deployments, drafts and txids.

## Appendix: the full census

Every throw site and published refusal reason on the per-call path, by file and line, with the head of its
message (`...` stands for an interpolated value) and its class. Classes: GAP (not yet served), MUST-STAY
(integrity) for checks over malformed artifacts, deployments, drafts and transactions, MUST-STAY (semantics) for
a rule the EVM or BCH itself imposes, REPORT for wrappers that attribute a frame's own failure, OPERATIONAL for
pool sizes a split or a larger deploy serves. The class is rule-based with hand overrides; the ranked part is
section 5.

| Site | Thrown as | Shape / message (head) | Class |
| --- | --- | --- | --- |
| solidc/src/per-call/master/composition.ts:36 | SolidcDiagnosticError | unknown composition convention '...'; expected one of ..., { requested, supported: COMPOSITION_CONVENTIONS } | MUST-STAY (integrity) |
| solidc/src/per-call/master/composition.ts:53 | SolidcDiagnosticError | unknown composition convention '...'; expected one of ..., { requested: convention, supported: COMPOSITION_CONVENTIONS } | MUST-STAY (integrity) |
| solidc/src/per-call/master/lifecycle.ts:174 | SolidcDiagnosticError | the per-call composition convention does not support this contract: ..., { requested: 'per-call', reason, contract: contract.name } | GAP |
| solidc/src/per-call/master/master-program.ts:61 | SolidcDiagnosticError | the compiled master does not contain a reserved ...-byte category slot before its address slot', { matches: thirtyTwoByteSlots, addressOffset } | MUST-STAY (integrity) |
| solidc/src/per-call/master/master-program.ts:71 | SolidcDiagnosticError | the compiled master does not contain a reserved ...-byte validator program hash slot after its address slot', { matches: thirtyTwoByteSlots, addressOffset } | MUST-STAY (integrity) |
| solidc/src/per-call/master/master-program.ts:114 | SolidcDiagnosticError | 'the census address offset did not settle on the reserved address slot', {} | MUST-STAY (integrity) |
| solidc/src/per-call/master/master-program.ts:233 | SolidcDiagnosticError | the census address offset at byte ... is not one script element, { start: site.start, end: site.end } | MUST-STAY (integrity) |
| solidc/src/per-call/master/master-program.ts:243 | SolidcDiagnosticError | the compiled master reserves its ... slot more than once, so no single offset identifies it, { slot: what, matches: offsets } | MUST-STAY (integrity) |
| solidc/src/per-call/master/master-program.ts:250 | SolidcDiagnosticError | the compiled master does not contain its reserved ... slot, { slot: what } | MUST-STAY (integrity) |
| solidc/src/per-call/master/placeholders.ts:40 | PerCallEncodingError | a slot holds at least one byte: got ... | MUST-STAY (integrity) |
| solidc/src/per-call/master/placeholders.ts:44 | PerCallEncodingError | a slot above 65535 bytes is not representable: got ... | MUST-STAY (integrity) |
| solidc/src/per-call/master/placeholders.ts:55 | PerCallEncodingError | a slot above 65535 bytes is not representable: got ... | MUST-STAY (integrity) |
| solidc/src/per-call/master/placeholders.ts:98 | PerCallEncodingError | unsupported placeholder version: ... | MUST-STAY (integrity) |
| solidc/src/per-call/master/placeholders.ts:102 | PerCallEncodingError | ... slot at ... is outside a ...-byte script | MUST-STAY (integrity) |
| solidc/src/per-call/master/placeholders.ts:109 | PerCallEncodingError | ... slot at ... is not a reserved ...-byte zero push | MUST-STAY (integrity) |
| solidc/src/per-call/master/placeholders.ts:136 | PerCallEncodingError | a category is ... bytes: got ... | MUST-STAY (integrity) |
| solidc/src/per-call/master/placeholders.ts:141 | PerCallEncodingError | a contract address is ... bytes: got ... | MUST-STAY (integrity) |
| solidc/src/per-call/master/placeholders.ts:148 | PerCallEncodingError | 'the descriptor declares a validator program hash slot, so a value is required' | MUST-STAY (integrity) |
| solidc/src/per-call/master/placeholders.ts:151 | PerCallEncodingError | a validator program hash is ... bytes: got ... | MUST-STAY (integrity) |
| solidc/src/per-call/master/placeholders.ts:156 | PerCallEncodingError | 'the descriptor declares no validator program hash slot, so none can be filled' | MUST-STAY (integrity) |
| solidc/src/per-call/master/placeholders.ts:180 | PerCallEncodingError | slot at ... is outside a ...-byte script | MUST-STAY (integrity) |
| solidc/src/per-call/master/support.ts:308 | refusedEntries | the body writes a mapping at slot N with no key K source to read | MUST-STAY (integrity) |
| solidc/src/per-call/master/support.ts:325 | refusedEntries | the body writes a mapping at slot N whose key K names the parameter ... it does not declare | MUST-STAY (integrity) |
| solidc/src/per-call/master/support.ts:335 | refusedEntries | the body writes a mapping at slot N whose key K ... has no expression to read | MUST-STAY (integrity) |
| solidc/src/per-call/master/support.ts:345 | refusedEntries | the body writes a mapping at slot N whose key K ... is the local ..., which is not bound to a single compile-time value (also: a contract constant used bare as a key) | GAP |
| solidc/src/per-call/master/support.ts:353 | refusedEntries | the body writes a mapping at slot N whose key K ... reads <the state value X / the mapping entry X / the value computed by f / an element of the dynamic state array X> | GAP |
| solidc/src/per-call/master/support.ts:662 | refusedEntries | the body writes a mapping at slot N as a read/write/..., and a master derives the sorted-batch operands only for one write per target | GAP |
| solidc/src/per-call/master/support.ts:667 | refusedEntries | the body writes a mapping at slot N in a loop, so the records it declares are not a fixed set | GAP |
| solidc/src/per-call/master/support.ts:670 | refusedEntries | the body writes a mapping at slot N that can alias another target at run time (message-bus routes only) | MUST-STAY (semantics) |
| solidc/src/per-call/master/support.ts:678 | refusedEntries | the body touches mapping "..." outside its batch as ...(in a loop) | GAP |
| solidc/src/per-call/master/support.ts:682 | refusedEntries | the body writes a mapping in a shape whose record the master cannot read back from its own frame | GAP |
| solidc/src/per-call/master/support.ts:1902 | contract refused | a contract with no entry point is not supported | MUST-STAY (semantics) |
| solidc/src/per-call/master/support.ts:1909 | contract refused | contract creation needs the witness CREATE checks, which are not emitted yet | GAP |
| solidc/src/per-call/master/support.ts:1912 | contract refused | a function pointer needs a call kind the frame does not carry yet | GAP |
| solidc/src/per-call/master/support.ts:1943 | refusedEntries | inline assembly is not composed per-call (assembly the lowering left in the body) | GAP |
| solidc/src/per-call/master/support.ts:1953 | refusedEntries | the body reads a long mapping value once per loop turn, and the frame's block lists one value per slot | GAP |
| solidc/src/per-call/master/support.ts:1959 | refusedEntries | a proxy implementation's entry compiled for the direct convention (hidden proxy master index) | MUST-STAY (semantics) |
| solidc/src/per-call/master/support.ts:1966 | refusedEntries | the body carries the hidden parameter ..., which the master head does not supply | GAP |
| solidc/src/per-call/master/support.ts:1972 | refusedEntries | an event emitted from a loop makes the event count depend on the loop | GAP |
| solidc/src/per-call/master/support.ts:1980 | refusedEntries | a blockhash read needs a co-spent oracle input the master head does not locate | GAP |
| solidc/src/per-call/master/support.ts:1985 | refusedEntries | a keccak256 call inside a loop reads one compute side-car per turn | GAP |
| solidc/src/per-call/master/support.ts:1991 | refusedEntries | an ecrecover loop reads one recovery side-car pair per iteration | GAP |
| solidc/src/per-call/master/support.ts:1995 | refusedEntries | the body makes an external call and is invoked as its own subroutine | GAP |
| solidc/src/per-call/master/support.ts:2002 | refusedEntries | the body reads the balance of an address other than its own | MUST-STAY (semantics) |
| solidc/src/per-call/master/support.ts:2006 | refusedEntries | the body reads its contract's balance and is invoked as its own subroutine | GAP |
| solidc/src/per-call/master/support.ts:2015 | refusedEntries | a loop guard the published recipe cannot carry (UnpublishableLoopGuardError, found by codegen) | GAP |
| solidc/src/per-call/master/support.ts:2029 | refusedEntries | the constructor reads the balance of an address other than its own | MUST-STAY (semantics) |
| solidc/src/per-call/master/support.ts:2032 | refusedEntries | the constructor reads its contract's balance, which no genesis shows | MUST-STAY (semantics) |
| solidc/src/per-call/master/support.ts:2074 | refusedEntries | the body derives a verified-mapping write and is invoked by a caller after an external call | GAP |
| solidc/src/per-call/master/support.ts:2091 | refusedEntries | it runs ..., which the master cannot serve: ... (closure over invocations) | GAP |
| solidc/src/per-call/master/support.ts:2110 | refusedEntries | a verified-mapping write ... does not precede the calls (write segment unread) | MUST-STAY (integrity) |
| solidc/src/per-call/master/support.ts:2329 | refusedEntries | the constructor makes an external call / a value send / reads a blockhash / hidden parameter | GAP |
| solidc/src/per-call/master/support.ts:2354 | refusedEntries | the entry point returns a tuple/mapping/function pointer/token container (composite return) | GAP |
| solidc/src/per-call/master/support.ts:2404 | refusedEntries | a value send inside a loop makes the send count depend on the loop | GAP |
| solidc/src/per-call/master/support.ts:2459 | contract refused | the contract emits an event that is not attributed to a body | GAP |
| solidc/src/per-call/master/support.ts:2840 | refusedEntries | a low-level call needs the witness calls[] checks, which are not emitted yet (any low-level call but a forwarding delegatecall) | GAP |
| solidc/src/per-call/master/support.ts:2960 | refusedEntries | the body both forwards its own call data and makes a typed external call | MUST-STAY (integrity) |
| solidc/src/per-call/master/support.ts:2973 | refusedEntries | the body forwards its own call data conditionally | MUST-STAY (integrity) |
| solidc/src/per-call/master/support.ts:2985 | refusedEntries | the body writes a verified mapping behind a call whose occurrence the source does not fix | MUST-STAY (integrity) |
| solidc/src/per-call/master/support.ts:2996 | refusedEntries | the call to ... is a delegatecall (typed), whose callee runs on its caller's records | MUST-STAY (integrity) |
| solidc/src/per-call/master/support.ts:3004 | refusedEntries | the call to ... is a <call mode> the master head has no frame kind for | GAP |
| solidc/src/per-call/master/support.ts:3013 | refusedEntries | the call to ... is in a body that switches / whose call count a branch or loop in an expression decides | GAP |
| solidc/src/per-call/master/support.ts:3018 | refusedEntries | the call to ... runs repeatedly (loopArrayVar / inline loop dispatch / batch invocations) | GAP |
| solidc/src/per-call/master/support.ts:3022 | refusedEntries | the call to ... resolves its callee or its selector at run time | GAP |
| solidc/src/per-call/master/support.ts:3030 | refusedEntries | the call to ... takes the direct path's return-event or value-transfer machinery (opaque return / call value) | MUST-STAY (integrity) |
| solidc/src/per-call/master/support.ts:3039 | refusedEntries | the call to ... has no four-byte selector the master head can check | MUST-STAY (integrity) |
| solidc/src/per-call/master/support.ts:3095 | refusedEntries | the call to ... targets the transaction's own sender (msg.sender as call target) | GAP |
| solidc/src/per-call/master/support.ts:3101 | refusedEntries | the call to ... targets an address the caller's own code does not hold as one value | GAP |
| solidc/src/per-call/master/support.ts:3135 | refusedEntries | the call to ... passes arguments the compiler cannot recover | GAP |
| solidc/src/per-call/master/support.ts:3148 | refusedEntries | the call to ... passes a run-time argument whose value the compiler cannot encode into one push | GAP |
| solidc/src/per-call/upgrade-layout.ts:24 | SolidcDiagnosticError | "..." ..., { contract, ...context } | MUST-STAY (semantics) |
| solidc/src/per-call/validator/program.ts:408 | RangeError | not an opcode: ... | MUST-STAY (integrity) |
| solidc/src/per-call/validator/program.ts:429 | RangeError | a program constant is 0.....: got ... | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:357 | PerCallCallError | contract "..." has no receive(), so ... has no body to run | MUST-STAY (semantics) |
| solidcash/src/per-call/call/call.ts:360 | PerCallCallError | contract "..." has no receive() and its fallback() is not payable, so it refuses ... | MUST-STAY (semantics) |
| solidcash/src/per-call/call/call.ts:371 | PerCallCallError | artifact "..." publishes no entry "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:374 | PerCallCallError | entry "..." publishes no selector, so its frame cannot be dispatched to | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:409 | PerCallCallError | entry "..." has no parameter ... | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:476 | PerCallCallError | artifact "..." is not a stateful contract | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:479 | PerCallCallError | a root frame's caller is a 25-byte P2PKH lock; got ... bytes | MUST-STAY (semantics) |
| solidcash/src/per-call/call/call.ts:485 | PerCallCallError | a call carries no negative value; got ... | MUST-STAY (semantics) |
| solidcash/src/per-call/call/call.ts:487 | PerCallCallError | entry "..." is not payable, so a call to it carries no value | MUST-STAY (semantics) |
| solidcash/src/per-call/call/call.ts:490 | PerCallCallError | a call to the fallback() of "..." carries a value send's empty call data, so it takes no argument' | MUST-STAY (semantics) |
| solidcash/src/per-call/call/call.ts:516 | PerCallCallError | contract "..." has ... dispatched body(ies), so a user's frame to it carries no selector, which this call path does not plan yet' | GAP |
| solidcash/src/per-call/call/call.ts:534 | PerCallCallError | category ... holds no master, which a root frame runs on | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:538 | PerCallCallError | category ... holds no validator, which a root frame needs to be admitted | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:541 | PerCallCallError | category ... holds ... data-NFT record(s), and the layout names ... | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:550 | PerCallCallError | the record at data-NFT index ... carries no commitment | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:579 | PerCallCallError | error.message | REPORT |
| solidcash/src/per-call/call/call.ts:584 | PerCallCallError | entry "..." writes mapping "..." and makes ... external call(s), whose segments this call path does not place its writes in yet' | GAP |
| solidcash/src/per-call/call/call.ts:622 | PerCallCallError | entry "..." sends to the contract at ..., which the call's externals do not name | GAP |
| solidcash/src/per-call/call/call.ts:633 | PerCallCallError | ... makes a call, which this call path does not plan yet | GAP |
| solidcash/src/per-call/call/call.ts:644 | PerCallCallError | contract "..." at category ... holds no master or not every record its layout names' | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:661 | PerCallCallError | ... sends to a contract, which this call path does not plan yet | GAP |
| solidcash/src/per-call/call/call.ts:700 | PerCallCallError | entry "..." pays one contract through two calls, which would need two of its masters to take value | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:707 | PerCallCallError | entry "..." writes mapping "..." and makes ... external call(s), whose segments this call path does not place its writes in yet' | GAP |
| solidcash/src/per-call/call/call.ts:717 | PerCallCallError | entry "..." sends value to a contract and makes ... external call(s), and its artifact does not place the sends among the calls, so this call path does not plan both in one call yet' | GAP |
| solidcash/src/per-call/call/call.ts:738 | PerCallCallError | ... and the paid body writes a mapping, sends or emits, which this call path does not plan beside the callee frames yet' | GAP |
| solidcash/src/per-call/call/call.ts:742 | PerCallCallError | ... and a callee frame of it writes its records, whose views beside the paid body this call path does not chain yet' | GAP |
| solidcash/src/per-call/call/call.ts:789 | PerCallCallError | entry "..." pays "...", which its calls also reach, and the frame "..." reads its data records of it side by side, and no order of the records the other frames of that contract name keep | GAP |
| solidcash/src/per-call/call/call.ts:902 | PerCallCallError | contract "..." holds ... satoshis in its containers, and entry ..." sends ... more than the call brings | MUST-STAY (semantics) |
| solidcash/src/per-call/call/call.ts:918 | PerCallCallError | contract "..." holds ... satoshis in its containers, and entry "... sends ... more than the call brings | MUST-STAY (semantics) |
| solidcash/src/per-call/call/call.ts:948 | PerCallCallError | contract "..." holds ... satoshis in its containers, and the body entry ..." pays sends ... more than it receives | MUST-STAY (semantics) |
| solidcash/src/per-call/call/call.ts:991 | PerCallCallError | entry "...": ... | GAP |
| solidcash/src/per-call/call/call.ts:1516 | PerCallCallError | 'the composer built no draft for the call frame' | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:1528 | PerCallCallError | a contract entry "..." pays did not hand back every event payload and node it writes, so its frame cannot declare them' | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:1534 | PerCallCallError | the call's write to mapping "..." did not hand back every node it rewrites, so the frame cannot declare their commitments' | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:1540 | PerCallCallError | entry "..." did not hand back every event payload it emits, so its frame cannot declare its event outputs' | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:1546 | PerCallCallError | entry "..." did not hand back the amount of every value it sends to a contract, so its frame cannot record the calls' | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:1552 | PerCallCallError | entry "..." did not hand back the lock and amount of every send it makes, so its frame cannot list its send outputs' | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:1557 | PerCallCallError | entry "..." did not hand back the value it returns, so its frame's \retval\ cannot be stated | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:1565 | PerCallCallError | 'the composer built no transaction for the call frame' | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:1618 | PerCallCallError | the call's output for record "..." carries no commitment | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:1715 | PerCallCallError | 'the caller funding unlocker signs for a lock that is not the call\'s caller lock, so the root frame\'s msg.sender binding would not hold' | MUST-STAY (semantics) |
| solidcash/src/per-call/call/call.ts:1733 | PerCallCallError | the derived call carries no input for participant "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:1743 | PerCallCallError | the deployment holds no live UTXO for the call's "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:1746 | PerCallCallError | the call's "..." holds ... satoshis, but the derived call spends ... | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:1766 | PerCallCallError | the derived call carries no container input at ... | MUST-STAY (integrity) |
| solidcash/src/per-call/call/call.ts:1791 | PerCallCallError | the provider returned txid ... for the call, not the ... its bytes hash to | MUST-STAY (integrity) |
| solidcash/src/per-call/call/callees.ts:258 | PerCallCalleeError | the callee "..." is entered as a delegate frame, which this call path does not plan yet | GAP |
| solidcash/src/per-call/call/callees.ts:261 | PerCallCalleeError | the callee "..." sits behind a proxy, whose delegate frame this call path does not plan yet | GAP |
| solidcash/src/per-call/call/callees.ts:264 | PerCallCalleeError | the callee "..." sends value, which this call path does not plan yet | GAP |
| solidcash/src/per-call/call/callees.ts:266 | PerCallCalleeError | the callee "..." touches a dynamic value's or a mapping value's chunks, which this call path does not plan yet | GAP |
| solidcash/src/per-call/call/callees.ts:268 | PerCallCalleeError | the callee "..." co-spends a side-car, which this call path does not plan yet | GAP |
| solidcash/src/per-call/call/callees.ts:271 | PerCallCalleeError | the callee "..." writes in a segment its artifact does not fix, which this call path does not plan yet | GAP |
| solidcash/src/per-call/call/callees.ts:289 | PerCallCalleeError | entry "..." makes ... external call(s): ... | MUST-STAY (integrity) |
| solidcash/src/per-call/call/callees.ts:318 | PerCallCalleeError | ... reads an earlier call's result, which this call path does not plan yet | GAP |
| solidcash/src/per-call/call/callees.ts:321 | PerCallCalleeError | a call is guarded on an earlier call's result, which this call path does not plan yet | GAP |
| solidcash/src/per-call/call/callees.ts:335 | PerCallCalleeError | it reaches two deployments of "...", whose blocks and records this call path does not tell apart yet | GAP |
| solidcash/src/per-call/call/callees.ts:339 | PerCallCalleeError | it enters "..." N times and a frame of it writes its mapping nodes, whose views across the frames this call path does not chain yet | GAP |
| solidcash/src/per-call/call/callees.ts:349 | PerCallCalleeError | the callee "..." reads its data records of "..." side by side, and no order of the records the call's other frames of that contract name keeps them so | GAP |
| solidcash/src/per-call/call/entry-records.ts:271 | PerCallCallRecordError | entry "..." touches mapping "..." at a key the frame's arguments do not determine (...) | GAP |
| solidcash/src/per-call/call/entry-records.ts:346 | PerCallCallRecordError | entry "..." writes mapping "..." in a run-time loop over "...", whose key the artifact does not publish as an element of that array' | GAP |
| solidcash/src/per-call/call/entry-records.ts:354 | PerCallCallRecordError | entry "..." writes mapping "..." in a run-time loop whose key names no counter to walk it with' | GAP |
| solidcash/src/per-call/call/entry-records.ts:362 | PerCallCallRecordError | entry "..." writes mapping "..." in a run-time loop over "...", which the frame's arguments do not carry as an array" | GAP |
| solidcash/src/per-call/call/entry-records.ts:392 | PerCallCallRecordError | entry "..." writes mapping "..." at turn ... of "... under a key the frame's arguments do not determine (...) | GAP |
| solidcash/src/per-call/call/entry-records.ts:421 | PerCallCallRecordError | entry "..." writes mapping "..." at turn ... of ..." under a key that does not sit above the turn before it, and a loop whose value comes per key... keeps the caller's order, which the run-t | GAP |
| solidcash/src/per-call/call/entry-records.ts:582 | PerCallCallRecordError | entry "..." writes mapping "..." in ... run-time loop(s) whose turns touch one node twice, which one run of their records cannot declare' | GAP |
| solidcash/src/per-call/call/entry-records.ts:695 | PerCallCallRecordError | artifact "..." publishes no entry "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/call/entry-records.ts:701 | PerCallCallRecordError | entry "..." publishes no mapping access at entry slot ... | MUST-STAY (integrity) |
| solidcash/src/per-call/call/entry-records.ts:708 | PerCallCallRecordError | entry "..." reads mapping "...", which the artifact does not publish as a collection' | MUST-STAY (integrity) |
| solidcash/src/per-call/call/entry-records.ts:718 | PerCallCallRecordError | category ... holds a node of collection "..." with no commitment | MUST-STAY (integrity) |
| solidcash/src/per-call/call/entry-records.ts:733 | PerCallCallRecordError | category ... holds no node of collection "..." whose slot is the key's or the key\'s bracketing predecessor, so the read cannot locate what it reads' | MUST-STAY (integrity) |
| solidcash/src/per-call/call/entry-records.ts:762 | PerCallCallRecordError | entry "..." touches ... mapping entry(ies) across ... sorted batch(es), and a call declares one collection\'s writes' | GAP |
| solidcash/src/per-call/call/entry-records.ts:773 | PerCallCallRecordError | entry "..." writes mapping "...", which the artifact does not publish as a sorted collection' | MUST-STAY (integrity) |
| solidcash/src/per-call/call/entry-records.ts:781 | PerCallCallRecordError | entry "..."'s sorted batch names a slot its entry accesses do not describe | MUST-STAY (integrity) |
| solidcash/src/per-call/call/entry-records.ts:786 | PerCallCallRecordError | entry "..." writes mapping "...", whose values chunk, so the created node\'s run of chunk records cannot be declared from the call alone' | GAP |
| solidcash/src/per-call/call/entry-records.ts:797 | PerCallCallRecordError | category ... holds a mapping node of "..." with no commitment | MUST-STAY (integrity) |
| solidcash/src/per-call/call/entry-records.ts:818 | PerCallCallRecordError | entry "..." touches mapping "..." as ..., and a call plans one write per target' | GAP |
| solidcash/src/per-call/call/entry-records.ts:879 | PerCallCallRecordError | entry "..." writes mapping "..." at ... turn(s) of ...", a run-time loop whose per-turn records a call does not declare yet | GAP |
| solidcash/src/per-call/call/entry-records.ts:884 | PerCallCallRecordError | entry "..." touches mapping "..." as ... outside a sorted batch, which a call does not plan' | GAP |
| solidcash/src/per-call/call/entry-records.ts:897 | PerCallCallRecordError | entry "..." reads a mapping key at no fixed entry slot, which a call does not declare a node for' | GAP |
| solidcash/src/per-call/call/entry-records.ts:911 | PerCallCallRecordError | entry "..." reads a ...-byte value of mapping "..." whose bytes sit in chunk records, which a call does not declare' | GAP |
| solidcash/src/per-call/call/entry-records.ts:947 | PerCallCallRecordError | entry "..." reads a key at a mapping node it also spends for another key, which a call cannot spend twice' | GAP |
| solidcash/src/per-call/call/handle.ts:75 | PerCallCallError | 'a call carries no negative value' | MUST-STAY (semantics) |
| solidcash/src/per-call/call/handle.ts:77 | PerCallCallError | entry "..." is not payable, so a call to it carries no value | MUST-STAY (semantics) |
| solidcash/src/per-call/call/handle.ts:103 | PerCallCompositionRefusedError | refusal | REPORT |
| solidcash/src/per-call/call/handle.ts:106 | PerCallCallError | the call to "..." was refused, so nothing was broadcast: ... | REPORT |
| solidcash/src/per-call/call/handle.ts:139 | PerCallCallError | a call to "..." needs the signer whose coin enters the frame; connect one to the handle | MUST-STAY (semantics) |
| solidcash/src/per-call/call/handle.ts:167 | PerCallCallError | the caller's address ... holds no tokenless UTXO to pay the call with | MUST-STAY (semantics) |
| solidcash/src/per-call/call/handle.ts:182 | PerCallCallError | a call to "..." through a proxy carries no value: a delegate frame takes none yet | GAP |
| solidcash/src/per-call/call/handle.ts:250 | PerCallCompositionRefusedError | read.refusal | REPORT |
| solidcash/src/per-call/call/handle.ts:251 | PerCallReadError | the read of "..." was refused, so it returned no value: ... | REPORT |
| solidcash/src/per-call/call/side-cars.ts:92 | PerCallSideCarPoolError | the entry co-spends ... ...(s) at the shared covenant lock, and the network holds ... | OPERATIONAL (pool size) |
| solidcash/src/per-call/composer/assemble.ts:212 | PerCallEncodingError | the block for "..." hosts validator "...", which the plan does not name | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/assemble.ts:219 | PerCallEncodingError | "..." is covered by more than one validator | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/assemble.ts:314 | PerCallEncodingError | the plan lists events at [...], and the trailing region puts them at [...] | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/assemble.ts:320 | PerCallEncodingError | the plan lists sends at [...], and the trailing region puts them at [...] | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/assemble.ts:328 | PerCallEncodingError | the plan creates records at [...], and the trailing region puts them at [...] | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/assemble.ts:348 | PerCallEncodingError | a settlement lists created output ..., which the plan's trailing region does not create | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/assemble.ts:379 | PerCallEncodingError | master "..." calls itself, which the format refuses | MUST-STAY (semantics) |
| solidcash/src/per-call/composer/assemble.ts:383 | PerCallEncodingError | the call from "..." to "..." does not begin with a ...-byte selector | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/assemble.ts:389 | PerCallEncodingError | "..." is called with different arguments by more than one caller, so its single input cannot carry both' | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/assemble.ts:404 | PerCallEncodingError | "..." is entered by a user, so it carries no call data | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/assemble.ts:411 | PerCallEncodingError | "..." carries call data its caller did not record | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/assemble.ts:442 | PerCallEncodingError | "..." is both a participant and a user input | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/assemble.ts:449 | UnresolvedReferenceError | reference, what | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/assemble.ts:468 | PerCallEncodingError | master "..." calls itself, which the format refuses | MUST-STAY (semantics) |
| solidcash/src/per-call/composer/assemble.ts:545 | PerCallEncodingError | 'a call carries at least its selector' | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/assemble.ts:557 | PerCallEncodingError | input "..." sits at ..., outside the layout's participants | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:419 | CompositionDraftError | the call to "..." carries no selector | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:426 | CompositionDraftError | ... "..." has no input in this draft | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:469 | CompositionDraftError | "..." declares record ... in segment ... as carrying on from a declaration it does not have' | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:493 | CompositionDraftError | a computed witness of "..." reuses a placeholder | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:506 | CompositionDraftError | "..." is both a participant and a user input | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:551 | CompositionDraftError | the validator "..." was not assembled | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:564 | CompositionDraftError | two inputs claim index ... | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:568 | CompositionDraftError | no input sits at index ... | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:581 | CompositionDraftError | input "..." has no source output | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:658 | CompositionDraftError | input "..." is not a master, a validator or a facet, so it needs unlocking bytecode | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:752 | CompositionDraftError | a computed witness of "..." settles "...", which the plan does not spend | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:810 | CompositionDraftError | "..." publishes no call ... | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:814 | CompositionDraftError | "..." calls "...", which the plan does not run | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:837 | CompositionDraftError | no block for master "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:841 | CompositionDraftError | no master "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/draft.ts:846 | CompositionDraftError | no master "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/need-test.ts:143 | ValidatorCoverageError | entry.facts.contract, entry.facts.functionName, need.reasons | REPORT |
| solidcash/src/per-call/composer/need-test.ts:148 | ValidatorCoverageError | entry.facts.contract, entry.facts.functionName, [...objections] | REPORT |
| solidcash/src/per-call/composer/recovery.ts:130 | PerCallEncodingError | the supplied pool holds no ... side-car UTXO for side-car ... | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/recovery.ts:191 | PerCallEncodingError | the body binds a ...-byte recovery argument, not the ... of hash // v // r // s | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/recovery.ts:279 | PerCallEncodingError | no placeholder recovery for "..." splits its ladder: ... | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/recovery.ts:373 | PerCallEncodingError | the entry takes ... parameter(s) and its unlocking bytecode carries ... argument push(es)' | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/recovery.ts:381 | PerCallEncodingError | the entry has no parameter '...' | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/recovery.ts:423 | PerCallEncodingError | the entry takes ... parameter(s) and its unlocking bytecode carries ... argument push(es)' | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/recovery.ts:431 | PerCallEncodingError | the entry has no parameter '...' | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/refusal.ts:493 | PerCallCompositionRefusedError | report | REPORT |
| solidcash/src/per-call/composer/refusals.ts:38 | PerCallComposerError | contract "..." needs ... master ... but its pool holds ... | OPERATIONAL (pool size) |
| solidcash/src/per-call/composer/refusals.ts:49 | PerCallComposerError | contract "..." roots this composition but has no validator | OPERATIONAL (pool size) |
| solidcash/src/per-call/composer/refusals.ts:66 | PerCallComposerError | no run learned the view the plan left unstated at ......, so its placeholder would reach the transaction' | REPORT |
| solidcash/src/per-call/composer/refusals.ts:84 | PerCallComposerError | master "..." of ... filled no witness at site ... (...)... | REPORT |
| solidcash/src/per-call/composer/refusals.ts:96 | PerCallComposerError | a mapping write targets slot ... but its inventory holds no predecessor below it | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/refusals.ts:107 | PerCallComposerError | a sorted batch writes slot ... more than once | GAP |
| solidcash/src/per-call/composer/refusals.ts:119 | PerCallComposerError | the mapping node at slot ... is written again in the segment that created it; plan the segment\'s writes as one sorted batch (planMappingBatch)' | GAP |
| solidcash/src/per-call/composer/refusals.ts:128 | PerCallComposerError | value chunk ... of the mapping node at slot ... needs an output index the layout gives it none of' | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/refusals.ts:140 | PerCallComposerError | the mapping node at slot ... needs an ... index the layout gives it none of | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/refusals.ts:151 | PerCallComposerError | the dynamic value "..." cannot be planned: ... | GAP |
| solidcash/src/per-call/composer/settlement.ts:139 | RecordChainError | first | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/settlement.ts:175 | RecordChainError | owner === undefined ? issue : { ...issue, owner } | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/settlement.ts:238 | OutputOccupancyError | first | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/shipped-host.ts:74 | ShippedHostError | 'the artifact publishes no per-call stop-site table' | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/shipped-host.ts:80 | ShippedHostError | unsupported stop-site table version: ... | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/shipped-host.ts:86 | ShippedHostError | 'the stop-site table has no entries array' | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/shipped-host.ts:262 | ShippedHostError | two runs share the master "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/shipped-host.ts:290 | ShippedHostError | ... is refused by the compiler: ... | GAP |
| solidcash/src/per-call/composer/shipped-host.ts:297 | ShippedHostError | no stop sites are published for "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/shipped-host.ts:308 | ShippedHostError | no run is registered for master "..." of ... | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/shipped-host.ts:314 | ShippedHostError | master "..." runs ..., not ... | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/shipped-host.ts:352 | ShippedHostError | ... publishes no call site ... | MUST-STAY (integrity) |
| solidcash/src/per-call/composer/value-rules.ts:120 | ValueRuleError | first | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/create-lookahead-session.ts:85 | CreateAddressError | No creates are reserved for ..., so no create address can be predicted. Reserve the genesis-eligible UTXOs first (read the funding account\'s nonce with getNonce()). See packages/sol | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/create-lookahead.ts:87 | CreateAddressError | No creates are reserved for ..., so no base nonce exists yet. Reserve the genesis-eligible UTXOs first. See .... | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/create-lookahead.ts:114 | CreateAddressError | reserve a positive whole number of creates: got ... | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/create-lookahead.ts:172 | CreateAddressError | message | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/create-lookahead.ts:172 | CreateAddressError | message, { cause } | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/create-lookahead.ts:177 | CreateAddressError | No creates are reserved for ..., so no address can be predicted. Reserve the genesis-eligible UTXOs first. See .... | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/create-lookahead.ts:186 | CreateAddressError | a create nonce is a whole number: got ... | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/create-lookahead.ts:190 | CreateAddressError | Cannot predict the address of create nonce ...: ... genesis-eligible UTXO(s) are reserved (nonces ........). Reserve one more genesis-eligible UTXO per child before predicting its address. | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/genesis.ts:226 | PerCallGenesisError | artifact "..." publishes no constructor selector, so no constructor frame can be run | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/genesis.ts:273 | PerCallGenesisError | artifact "..." is not a stateful contract | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/genesis.ts:280 | PerCallGenesisError | the constructor of "..." is refused by the compiler (...): ... | GAP |
| solidcash/src/per-call/deploy/genesis.ts:330 | PerCallGenesisError | the constructor of "..." carries the internal witness '...', which this deployment has no plan for' | GAP |
| solidcash/src/per-call/deploy/genesis.ts:336 | PerCallGenesisError | the constructor of "..." emits an event from a loop, whose count the block cannot fix | GAP |
| solidcash/src/per-call/deploy/genesis.ts:341 | PerCallGenesisError | the constructor of "..." makes a value send, which this deployment has no plan for | GAP |
| solidcash/src/per-call/deploy/genesis.ts:348 | PerCallGenesisError | the constructor of "..." hashes inside a loop, so how many compute side-cars it co-spends is the loop\'s to decide and this deployment lays the artifact\'s fixed count' | GAP |
| solidcash/src/per-call/deploy/genesis.ts:354 | PerCallGenesisError | the constructor of "..." recovers inside a loop, so how many recovery side-cars it co-spends is the loop\'s to decide and this deployment lays the artifact\'s fixed count' | GAP |
| solidcash/src/per-call/deploy/genesis.ts:362 | PerCallGenesisError | the constructor of "..." publishes keccakCompute with no per-call entry, so this deployment cannot tell how many compute side-cars its frame reads' | GAP |
| solidcash/src/per-call/deploy/genesis.ts:479 | PerCallGenesisError | the constructor of "..." writes mapping "...", which the artifact does not publish as a sorted collection' | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/genesis.ts:506 | PerCallGenesisError | the constructor of "..." writes mapping "..." with ... key(s), which the collection's ... key type(s) do not cover | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/genesis.ts:520 | PerCallGenesisError | the constructor of "..." writes mapping "..." at a key this deployment cannot resolve from its arguments (...) | GAP |
| solidcash/src/per-call/deploy/genesis.ts:548 | PerCallGenesisError | the constructor of "..." writes ... mapping entry(ies) across ... collection(s), and this deployment plans one collection's sorted writes | GAP |
| solidcash/src/per-call/deploy/genesis.ts:558 | PerCallGenesisError | the constructor of "..." writes mapping "..." at slot ..., which no entry access publishes' | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/genesis.ts:568 | PerCallGenesisError | the constructor of "..." touches mapping "..." as ..., and this deployment plans one write beside at most a read | GAP |
| solidcash/src/per-call/deploy/genesis.ts:603 | PerCallGenesisError | the constructor of "..." writes mapping "..." a value this deployment cannot resolve from its arguments' | GAP |
| solidcash/src/per-call/deploy/genesis.ts:616 | PerCallGenesisError | the constructor of "..." cannot be planned at genesis: writing ..." is not an insertion into the empty list | GAP |
| solidcash/src/per-call/deploy/genesis.ts:653 | PerCallGenesisError | the constructor of "..." cannot be planned at genesis: writing ..." is not an insertion into the empty list | GAP |
| solidcash/src/per-call/deploy/genesis.ts:767 | PerCallGenesisError | the constructor of "..." writes dynamic "...", which the artifact publishes no value source for, so this deployment cannot state the run its write creates' | GAP |
| solidcash/src/per-call/deploy/genesis.ts:776 | PerCallGenesisError | the constructor of "..." writes dynamic "..." a value this deployment cannot resolve from its arguments (a ... source) | GAP |
| solidcash/src/per-call/deploy/genesis.ts:909 | PerCallGenesisError | the constructor of "..." writes a dynamic value but publishes no block layout to address its chunk run from' | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/genesis.ts:976 | PerCallGenesisError | a root frame's caller is a 25-byte P2PKH lock; got ... bytes | MUST-STAY (semantics) |
| solidcash/src/per-call/deploy/genesis.ts:1088 | PerCallGenesisError | the constructor of "..." did not yield a genesis the machine accepts | REPORT |
| solidcash/src/per-call/deploy/genesis.ts:1185 | PerCallGenesisError | genesisReadingMessage(reading) | REPORT |
| solidcash/src/per-call/deploy/genesis.ts:1213 | PerCallGenesisError | the constructor probe closed against a declaration no derivation wrote: ... | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/genesis.ts:1354 | PerCallGenesisError | the frame's side-car "..." has no plan | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/genesis.ts:1360 | PerCallGenesisError | 'a compute side-car carries no mutable NFT to recreate' | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/genesis.ts:1374 | PerCallGenesisError | the frame's side-car "..." has no unlocking | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/material.ts:58 | PerCallDeploymentError | artifact "..." was not compiled per-call, so it publishes no placeholder descriptor | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/material.ts:103 | PerCallDeploymentError | "the artifact's program is not assembly, so its published slot offsets cannot apply: (error as Error).message | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/material.ts:153 | PerCallDeploymentError | 'the deployed address is not addrV(category)' | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/material.ts:156 | PerCallDeploymentError | the deployed script is ... bytes, not the artifact's ... | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/material.ts:163 | PerCallDeploymentError | 'the category slot does not read back as the filled category' | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/material.ts:169 | PerCallDeploymentError | "the validator program hash slot does not read back as the program's hash" | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/material.ts:176 | PerCallDeploymentError | 'the address slot does not read back as the filled address' | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/material.ts:186 | PerCallDeploymentError | byte ... outside the slots changed | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/material.ts:191 | PerCallDeploymentError | 'the master lock is not the P2SH32 of the filled program' | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/records.ts:320 | PerCallRecordError | the provider cannot enumerate UTXOs by category ..., which is how the master pool, the validator pool and the records are told apart' | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/records.ts:353 | PerCallRecordError | category ... has no data-NFT record at index ... (found ...) | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/resize.ts:89 | PerCallResizeError | '...' is not the ...(n) function of "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/resize.ts:94 | PerCallResizeError | '...' takes the admin's SignatureTemplate | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/resize.ts:116 | PerCallResizeError | contract "..." declares no ...(n) function | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/resize.ts:119 | PerCallResizeError | contract "..." is not a stateful contract | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/resize.ts:121 | PerCallResizeError | a ... counts at least one master | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/resize.ts:129 | PerCallResizeError | category ... holds no master to keep beside the ... | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/resize.ts:132 | PerCallResizeError | a merge of ... retires ... master(s), but ... were named | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/stateful.ts:63 | PerCallDeployError | Contract ... is not a stateful contract | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/stateful.ts:66 | PerCallDeployError | 'Funding UTXO must be at vout 0 to create a valid token category. Got vout .... | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/stateful.ts:115 | PerCallDeployError | threadCount must be a positive integer, got ... | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/stateful.ts:119 | PerCallDeployError | validatorCount must be a positive integer, got ... | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/stateful.ts:183 | PerCallDeployError | genesis minted a node for collection "...", which the artifact does not publish | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/stateful.ts:220 | PerCallDeployError | Insufficient funding for the pool of ... master(s) and ... validator(s): ... satoshis provided, but the genesis requires ... (outputs ..., fee ...). | MUST-STAY (integrity) |
| solidcash/src/per-call/deploy/stateful.ts:255 | PerCallDeployError | The contract's own address is not encodable: ... | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/call-resolution.ts:51 | PerCallProxyDeployError | contract "..." publishes no entry "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/call-resolution.ts:291 | PerCallProxyDeployError | ... targets the state field "...", which the caller's own state does not hold as an address' | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/call-resolution.ts:301 | PerCallProxyDeployError | ... computes its target from a "..." source the hop cannot resolve to an address | GAP |
| solidcash/src/per-call/proxy/call-resolution.ts:311 | PerCallProxyDeployError | ... publishes no target address the hop can read (no literal, state field or resolvable source) | GAP |
| solidcash/src/per-call/proxy/call-resolution.ts:370 | PerCallProxyDeployError | ... takes ... argument(s), but the artifact publishes sources for ..., so the hop cannot state their digest' | GAP |
| solidcash/src/per-call/proxy/call-resolution.ts:377 | PerCallProxyDeployError | the callee entry "..." publishes no selector, so the call carries no call data | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/call-resolution.ts:384 | PerCallProxyDeployError | ... passes argument ... from a "..."..."}, which the hop cannot resolve from the caller's own arguments and state' | GAP |
| solidcash/src/per-call/proxy/call-resolution.ts:395 | PerCallProxyDeployError | ... passes a signature as argument ..., which a record's digest cannot state | MUST-STAY (semantics) |
| solidcash/src/per-call/proxy/call-resolution.ts:424 | PerCallProxyDeployError | the call to "......." names the zero address, so the hop states no callee | MUST-STAY (semantics) |
| solidcash/src/per-call/proxy/deploy.ts:264 | PerCallProxyDeployError | contract "..." publishes no selector for "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:472 | PerCallProxyDeployError | ... ... beside an external call, and the segment that write lands in is not fixed by the entry\'s own source, so the hop cannot declare it' | GAP |
| solidcash/src/per-call/proxy/deploy.ts:495 | PerCallProxyDeployError | ... publishes segment ... for ..., which the hop's ... segment(s) do not hold | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:580 | PerCallProxyDeployError | 'the entry lays a run of chunk records and the artifact publishes no dynamic value for it' | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:686 | PerCallProxyDeployError | ... declares its mapping's records in segment ... and the run of chunk records its dynamic write grows in segment ..., and a frame reads the run past the records its own block declares,  | GAP |
| solidcash/src/per-call/proxy/deploy.ts:737 | PerCallProxyDeployError | ... cannot declare its loop's records: ... | GAP |
| solidcash/src/per-call/proxy/deploy.ts:774 | PerCallProxyDeployError | ... is refused by the compiler (...): ... | GAP |
| solidcash/src/per-call/proxy/deploy.ts:793 | PerCallProxyDeployError | proxy "..." is not a stateful contract | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:798 | PerCallProxyDeployError | proxy "..." declares no address field named "implementation", so there is nothing for its fallback to forward the call data it received to' | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:804 | PerCallProxyDeployError | proxy "..." has no fallback, so it cannot forward the call data it received | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:821 | PerCallProxyDeployError | agreement.reason | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:858 | PerCallProxyDeployError | implementation "..." publishes no entry "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:867 | PerCallProxyDeployError | "..." takes ... argument(s), but ... were supplied | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:961 | PerCallProxyDeployError | a root frame's caller is a 25-byte P2PKH lock; got ... bytes | MUST-STAY (semantics) |
| solidcash/src/per-call/proxy/deploy.ts:967 | PerCallProxyDeployError | 'each genesis funding UTXO must be at vout 0 to create a token category' | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:1039 | PerCallProxyDeployError | the proxy's genesis published ... record(s) for category ..., but its layout declares ... data NFT(s) | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:1047 | PerCallProxyDeployError | the proxy's genesis published no commitment for the record at data NFT ... of category proxy.categoryId | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:1366 | PerCallProxyDeployError | 'the hop\'s callee frames have no settle order that answers each frame\'s callees before it and each shared node\'s writes before the frames that declare the views they left' | GAP |
| solidcash/src/per-call/proxy/deploy.ts:1636 | PerCallProxyDeployError | the call's callee "..." writes mapping ..." a value whose source the artifact does not publish, so this hop cannot tell whether the write needs value chunks' | GAP |
| solidcash/src/per-call/proxy/deploy.ts:1682 | PerCallProxyDeployError | the call's callee "..." did not settle through the proxy: ..., refusal.innermost?.reason.arguments | REPORT |
| solidcash/src/per-call/proxy/deploy.ts:2041 | PerCallProxyDeployError | the implementation's ... writes mapping "..." a value whose source the artifact does not publish, so this hop cannot tell whether the write needs value chunks' | GAP |
| solidcash/src/per-call/proxy/deploy.ts:2087 | PerCallProxyDeployError | the implementation's ... did not settle through the proxy: ... sizedRunClause(entryWrites), refusal.innermost?.reason.arguments | REPORT |
| solidcash/src/per-call/proxy/deploy.ts:2113 | PerCallProxyDeployError | the implementation's ... did not settle through the proxy in ... attempts... | GAP |
| solidcash/src/per-call/proxy/deploy.ts:2139 | PerCallProxyDeployError | the implementation's ... returns a value, which a call through this proxy hop does not carry: the proxy\'s fallback records the delegated call without a result, so the hop binds that | GAP |
| solidcash/src/per-call/proxy/deploy.ts:2515 | PerCallProxyDeployError | the frame "..." still leaves its write unstated after the hop learned the value its own run exposed, so the frames it encloses cannot start from it' | GAP |
| solidcash/src/per-call/proxy/deploy.ts:2531 | PerCallProxyDeployError | the hop stopped its plan ... time(s) to learn earlier calls' results and still waits on ..., so the plan does not complete | GAP |
| solidcash/src/per-call/proxy/deploy.ts:2601 | PerCallProxyDeployError | ... reads the result of the earlier call(s) ..., and settling them returned nothing the hop could decode, so the call cannot be planned from it' | GAP |
| solidcash/src/per-call/proxy/deploy.ts:2649 | PerCallProxyDeployError | the entry's arms an earlier call's result decides did not settle: the hop re-planned ... time(s) without its sites stopping | GAP |
| solidcash/src/per-call/proxy/deploy.ts:2874 | PerCallProxyDeployError | the callee "..." reads its data records of "..." side by side, and no order of the records the hop\'s other frames of that contract name keeps them so' | GAP |
| solidcash/src/per-call/proxy/deploy.ts:3585 | PerCallProxyDeployError | the callee's "..." entry reads a mapping node an earlier reach created, but the hop places no output for it' | GAP |
| solidcash/src/per-call/proxy/deploy.ts:4256 | PerCallProxyDeployError | 'the caller funding unlocker signs for a lock that is not the hop\'s caller lock, so the root frame\'s msg.sender binding would not hold' | MUST-STAY (semantics) |
| solidcash/src/per-call/proxy/deploy.ts:4291 | PerCallProxyDeployError | the derived hop carries no input for participant "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:4305 | PerCallProxyDeployError | the deployment holds no live UTXO for the hop's "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:4309 | PerCallProxyDeployError | the hop's "..." holds ... satoshis, but the derived hop spends ... | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:4373 | PerCallProxyDeployError | the provider returned txid ... for the hop, not the ... its bytes hash to | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:4452 | PerCallProxyDeployError | implementation "..." publishes no entry "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:4467 | PerCallProxyDeployError | a root frame's caller is a 25-byte P2PKH lock; got ... bytes | MUST-STAY (semantics) |
| solidcash/src/per-call/proxy/deploy.ts:4480 | PerCallProxyDeployError | category ... holds ... record(s) for a proxy whose layout declares ... data NFT(s) | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:4488 | PerCallProxyDeployError | category ... holds no proxy master or no validator, which a call is admitted by | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:4508 | PerCallProxyDeployError | category ... holds no implementation master, which the forwarded frame runs from' | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:4516 | PerCallProxyDeployError | the record at data NFT ... of category ... carries no commitment | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/deploy.ts:4579 | PerCallProxyDeployError | the implementation's ... reads mapping "..." at a node its batch also spends, which one transaction cannot spend twice' | GAP |
| solidcash/src/per-call/proxy/enclosed-reads.ts:110 | PerCallProxyDeployError | the hop's reach "..." ... a node of collection "..." that "...", a frame it runs inside, writes before the call that leads to it, and that write\'s value is the body\'s to compute: the ... i | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/entry-writes.ts:762 | PerCallProxyDeployError | the implementation's "..." entry reads field "..." of mapping ...", which the artifact does not publish as a collection | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/entry-writes.ts:769 | PerCallProxyDeployError | the implementation's "..." entry reads field "..." of mapping ..." at a key this hop cannot resolve (...) | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:788 | PerCallProxyDeployError | the implementation's "..." entry reads field "..." of the node mapping ..." holds for this key, whose value this hop cannot reassemble from the deployment's chunks' | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:871 | PerCallProxyDeployError | the implementation's "..." entry's sorted batch names slot ..., which its entry accesses do not describe' | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/entry-writes.ts:905 | PerCallProxyDeployError | the implementation's "..." entry writes ... mapping entry(ies) across 0 sorted batch(es), and this hop plans one batch to one collection' | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:920 | PerCallProxyDeployError | the implementation's "..." entry reads mapping "..." beside the batch it writes, which this hop does not declare' | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:947 | PerCallProxyDeployError | the implementation's "..." entry writes mapping "...", which the artifact does not publish as a sorted collection' | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/entry-writes.ts:977 | PerCallProxyDeployError | the implementation's "..." entry writes mapping "..." at a key this hop cannot resolve from its call data (...) | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:1029 | PerCallProxyDeployError | the implementation's "..." entry writes mapping "..." in a run-time loop over its own call data, whose values chunk, so the run of chunk records the write takes cannot be sized from th | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:1082 | PerCallProxyDeployError | the implementation's "..." entry writes mapping "..." with ... key(s), which the collection's ... key type(s) do not cover | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/entry-writes.ts:1094 | PerCallProxyDeployError | the implementation's "..." entry touches mapping "..." as ..., and this hop plans one write per target | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:1157 | PerCallProxyDeployError | the implementation's "..." entry reads mapping "..." a value this hop cannot reassemble from the node the deployment holds, so it cannot witness the body's read" | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:1194 | PerCallProxyDeployError | the deployment holds a node of collection "..." with no commitment | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/entry-writes.ts:1211 | PerCallProxyDeployError | the implementation's "..." entry writes mapping "...", but the deployment's collection "..." has no head; a head is minted only at genesis, so this deployment was deployed without it' | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/entry-writes.ts:1389 | PerCallProxyDeployError | the deployment holds no record declaring dynamic "...", so this hop cannot read the value its write starts from' | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/entry-writes.ts:1405 | PerCallProxyDeployError | the deployment holds a record at dynamic "..."'s collection covenant whose commitment is not a chunk, so this hop cannot read the value its write starts from' | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/entry-writes.ts:1413 | PerCallProxyDeployError | the deployment's dynamic "..." declares ... byte(s), which is ... chunk(s), but ... chunk(s) sit at its collection covenant | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/entry-writes.ts:1420 | PerCallProxyDeployError | the deployment's dynamic "..." holds chunk ... where chunk ... belongs | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/entry-writes.ts:1503 | PerCallProxyDeployError | the implementation's "..." entry mutates mapping "..." as ...", and this hop plans only the element an append carries | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:1516 | PerCallProxyDeployError | the implementation's "..." entry appends to mapping "..." a value whose live bytes this hop cannot reassemble from the deployment's chunks" | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:1623 | PerCallProxyDeployError | the implementation's "..." entry writes ... dynamic value(s), and this hop plans one run to one variable' | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:1632 | PerCallProxyDeployError | the implementation's "..." entry writes dynamic "...", which the artifact does not publish as a dynamic state variable' | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/entry-writes.ts:1658 | PerCallProxyDeployError | the implementation's "..." entry writes dynamic "..." a value shorter than the one the deployment holds, which this hop does not plan' | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:1680 | PerCallProxyDeployError | the implementation's "..." entry writes dynamic "..." (...), whose appended element the artifact publishes no source for, so the run of chunk records its write creates cannot be sized' | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:1686 | PerCallProxyDeployError | the implementation's "..." entry writes dynamic "..." (...) an element the artifact publishes a source for but the hop\'s call data does not determine, so the run of chunk records its wr | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:1780 | PerCallProxyDeployError | the implementation's "..." entry appends to dynamic "..." once per turn of a run-time loop over "...", whose length this hop's call data does not carry, so the run of chunk records its w | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:1789 | PerCallProxyDeployError | the implementation's "..." entry appends to dynamic "..." inside a run-time loop whose width the artifact does not pin to a call parameter, so the run of chunk records its write create | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:1861 | PerCallProxyDeployError | the implementation's "..." entry reads dynamic "...", which the artifact does not publish as a dynamic state variable' | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/entry-writes.ts:1964 | PerCallProxyDeployError | the implementation's "..." entry reads ...").join(', ')} beside a run-time loop's writes to "...", and its frame finds a run past the loop's records only when it is the one dynamic value | GAP |
| solidcash/src/per-call/proxy/entry-writes.ts:1988 | PerCallProxyDeployError | the implementation's "..." entry writes ... sorted collections beside a dynamic value, whose records this hop does not order | GAP |
| solidcash/src/per-call/proxy/external-calls.ts:605 | PerCallProxyDeployError | ... runs a loop whose counter the caller's own arguments do not fix | GAP |
| solidcash/src/per-call/proxy/external-calls.ts:610 | PerCallProxyDeployError | ... runs a loop whose counter never advances | MUST-STAY (semantics) |
| solidcash/src/per-call/proxy/external-calls.ts:618 | PerCallProxyDeployError | ... runs a loop whose bound is not fixed by the caller's own arguments, so the hop cannot state how many records its visits fill' | GAP |
| solidcash/src/per-call/proxy/external-calls.ts:710 | PerCallProxyDeployError | ... runs a loop whose bound is not fixed by the caller's own arguments, so the hop cannot state how many records its visits fill' | GAP |
| solidcash/src/per-call/proxy/external-calls.ts:1071 | PerCallProxyDeployError | the call to "......." targets ..., and none of the deployment's contracts sits at that address" | MUST-STAY (semantics) |
| solidcash/src/per-call/proxy/external-calls.ts:1226 | PerCallProxyDeployError | the entry "..." publishes call ... to .......", which its ABI routing does not describe | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:1281 | PerCallProxyDeployError | ... reaches ".......()", which the compiler refused: refusal | GAP |
| solidcash/src/per-call/proxy/external-calls.ts:1298 | PerCallProxyDeployError | ... reaches "...", which this hop already places; a contract that reaches itself below itself cannot be given a second block in the hop' | GAP |
| solidcash/src/per-call/proxy/external-calls.ts:1390 | PerCallProxyDeployError | the callee's category ... holds a record with no commitment | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:1514 | PerCallProxyDeployError | the callee "..." writes records this hop cannot declare: ... | GAP |
| solidcash/src/per-call/proxy/external-calls.ts:1521 | PerCallProxyDeployError | the callee "..." reads mapping "..." at a node its batch also spends, which one transaction cannot spend twice' | GAP |
| solidcash/src/per-call/proxy/external-calls.ts:1645 | PerCallProxyDeployError | the callee ".......()" reads a mapping key at no fixed entry slot, which this hop does not declare a node for' | GAP |
| solidcash/src/per-call/proxy/external-calls.ts:1669 | PerCallProxyDeployError | the callee ".......()" reads a mapping node this hop cannot declare: ... | GAP |
| solidcash/src/per-call/proxy/external-calls.ts:1704 | PerCallProxyDeployError | the callee ".......()" reads a mapping node of collection "..." whose ...-byte value this hop cannot reassemble from the deployment's chunk records, so it cannot witness the body's read" | GAP |
| solidcash/src/per-call/proxy/external-calls.ts:1781 | PerCallProxyDeployError | the callee's category ... holds no record at data NFT ... | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:1823 | PerCallProxyDeployError | ... reaches "...", which this hop already places; its category ... holds ... master(s), so it cannot be entered ... time(s) | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:1966 | PerCallProxyDeployError | ... reaches "...", which this hop already places; its category ... holds ... master(s), so it cannot be entered ... time(s) | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:1972 | PerCallProxyDeployError | ... reaches "...", which this hop already places; its category ... holds ... master(s), so it cannot be entered ... time(s) | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:2220 | PerCallProxyDeployError | ..., and ... of them write collection ..." at the same key, which the list does not hold, so each reach inserts it; a list holds one node per key, so a later reach of the key has to cont | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:2220 | PerCallProxyDeployError | the hop reaches the entry "..." N times, and K of them write collection "..." at the same key, which the list does not hold, so each reach inserts it | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:2324 | PerCallProxyDeployError | the hop's reaches "..." and "..." touch one node of collection ...", and one of them enters the other, so their segments interleave in an order this hop does not settle' | GAP |
| solidcash/src/per-call/proxy/external-calls.ts:2338 | PerCallProxyDeployError | ... relinks to insert a key; ... | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:2338 | PerCallProxyDeployError | ... relinks to insert a key; a node whose values chunk is continued from the bytes the write before each reach stated, and a relink states none | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:2341 | PerCallProxyDeployError | ... writes, and inserts through it; ... | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:2341 | PerCallProxyDeployError | ... writes, and inserts through it; (chunked relink) | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:2371 | PerCallProxyDeployError | ... relinks to insert a key; ... | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:2371 | PerCallProxyDeployError | ... relinks to insert a key; (chunked relink) | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:2374 | PerCallProxyDeployError | ... writes, and inserts through it; ... | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:2374 | PerCallProxyDeployError | ... writes, and inserts through it; (chunked relink) | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/external-calls.ts:2378 | PerCallProxyDeployError | ... writes, and its values chunk: the reach before it states no value a later reach can continue from, so the run of chunk records the later reach takes cannot be sized' | GAP |
| solidcash/src/per-call/proxy/generate.ts:72 | PerCallProxyDeployError | cannot generate a proxy for "...": ... has type "...", whose base "..." is neither a primitive type nor a struct the state layout publishes' | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/generate.ts:109 | PerCallProxyDeployError | cannot generate a proxy for "...": it is not a stateful contract, so it has no record a proxy could keep' | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/generate.ts:121 | PerCallProxyDeployError | cannot generate a proxy for "...": its "..." field has type "...", but a fallback forwards to an address | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/generate.ts:275 | PerCallProxyDeployError | the generated proxy for "..." compiled to a non-stateful contract | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/generate.ts:281 | PerCallProxyDeployError | cannot generate a proxy for "...": ... | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/generate.ts:303 | PerCallProxyDeployError | the generated proxy for "..." did not compile to a contract | MUST-STAY (integrity) |
| solidcash/src/per-call/proxy/refusal-order.ts:128 | PerCallProxyDeployError | the call's callee "..." did not settle through the proxy: ..., innermost.reason.arguments | REPORT |
| solidcash/src/per-call/proxy/upgrade.ts:18 | PerCallProxyDeployError | cannot upgrade proxy "..." to "...": ... | MUST-STAY (semantics) |
| solidcash/src/per-call/queue/queue.ts:71 | CompositionQueueError | 'a send whose plan is resolved when its turn comes must name the resources it consumes' | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:369 | PerCallReadError | artifact "..." publishes no entry "..." | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:372 | PerCallReadError | entry "..." publishes no selector, so its frame cannot be dispatched to | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:377 | PerCallReadError | entry "..." returns nothing, so it is not a read | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:456 | PerCallReadError | entry ".......()" calls ".......()", whose argument ... comes from a "..."..., which a read cannot state from the caller's own arguments and addresses" | GAP |
| solidcash/src/per-call/read/read.ts:465 | PerCallReadError | error.message | REPORT |
| solidcash/src/per-call/read/read.ts:495 | PerCallReadError | error.message | REPORT |
| solidcash/src/per-call/read/read.ts:607 | PerCallReadError | entry ".......()" publishes call ... to .......()", which its ABI routing does not describe | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:636 | PerCallReadError | entry ".......()" makes ... external call(s): .......()" at 0x... is not supplied in externals | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:651 | PerCallReadError | the read reaches "..." again below itself, so its frames have no order | GAP |
| solidcash/src/per-call/read/read.ts:839 | PerCallReadError | category ... holds ... master(s), and the read runs ... frame(s) over it | OPERATIONAL (pool size) |
| solidcash/src/per-call/read/read.ts:849 | PerCallReadError | category ... holds no validator, which a read frame needs to be admitted | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:869 | PerCallReadError | category ... holds no data-NFT record at index ..., which the entry reads | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:875 | PerCallReadError | the record at data-NFT index ... carries no commitment | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:941 | PerCallReadError | error.message | REPORT |
| solidcash/src/per-call/read/read.ts:965 | PerCallReadError | the node of collection "..." the entry reads holds a ...-byte value whose bytes sit in chunk records that category ... does not hold, so the read cannot state its witness' | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:1114 | PerCallReadError | category ... holds a node of collection "..." with no commitment | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:1129 | PerCallReadError | category ... holds no node of collection "..." whose slot is the key\'s or the key\'s bracketing predecessor, so the read cannot locate what it reads' | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:1170 | PerCallReadError | entry "..." reads mapping "...", which the artifact does not publish as a collection' | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:1177 | PerCallReadError | entry "..." names mapping "..." at an element of ..." that the artifact's live records do not state | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:1195 | PerCallReadError | entry "..." reads "..." at ... turn(s), but a chunk-backed array's chunk run shares the fixed record band with the entry slot\'s own turn, so exactly one turn can be composed' | GAP |
| solidcash/src/per-call/read/read.ts:1213 | PerCallReadError | entry "..." names mapping "..." at a key no run of its own arguments determines' | GAP |
| solidcash/src/per-call/read/read.ts:1273 | PerCallReadError | category ... holds no data-NFT record at index ..., which the entry reads "..." from | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:1504 | PerCallReadError | 'the frame recorded bytes that are not the entry\'s declared Solidity ABI returns' | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:1634 | PerCallReadError | entry "..." has no parameter ... | MUST-STAY (integrity) |
| solidcash/src/per-call/read/read.ts:1978 | PerCallReadError | ... runs a loop whose bound reads an earlier call's result, which the read could not learn | GAP |
| solidcash/src/per-call/validator/reference/reference.ts:735 | PerCallEncodingError | 'not a witness block: magic' | MUST-STAY (integrity) |
| solidcash/src/per-call/validator/reference/reference.ts:736 | PerCallEncodingError | 'unsupported witness block version' | MUST-STAY (integrity) |
| solidcash/src/per-call/validator/reference/reference.ts:748 | PerCallEncodingError | call ... is a root frame | MUST-STAY (integrity) |
| solidcash/src/per-call/validator/reference/reference.ts:752 | PerCallEncodingError | call ... has no callee | MUST-STAY (integrity) |
| solidcash/src/per-call/validator/reference/reference.ts:780 | PerCallEncodingError | 'segment and call counts disagree' | MUST-STAY (integrity) |
