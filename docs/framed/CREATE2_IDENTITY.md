# Framed CREATE2 children at their own address (design, 2026-10-30)

Status: in progress. The child-address computation, the creator's genesis check, the in-transaction composition of a
child's genesis, the deploy-then-call fold of its initializer and the creator's count of the child's category outputs
are implemented and tested, including the creator's check of the folded state's record commitments. Found while building the SushiSwap BCH web
layer, whose pairs are CREATE2 children of the factory. A SolidCash-level change for any creator and child: what the
compiler emits, what the validator checks and what the SDK composes. No contract source changes for it.

## The gap

A framed `new C{salt: s}()`, or `create2(...)`, evaluates today to an EVM identity
`X = keccak256(0xff ‖ creator ‖ s ‖ codeHash)[12:]` that the child presents as `address(this)`:

1. **X is not bound to anything on chain.** The validator skips a 20-byte `self` (`checks.ts` V11), and a child's master
   binds only the identity its own deployer baked in. Anyone can deploy code presenting a future child's `X` and spend
   what is credited to it.
2. **The child is stood up out of band.** `create2-child.ts` deploys it in its own transaction before the creator's
   call, funding the genesis with a coin minted by `provider.addUtxo`, which only a devnet or the mock can do.

## Decision

A CREATE2 child is an ordinary framed contract at its own address, as SolidCash's direct `deployFrom` already makes one:

- **Created in the creator's transaction, funded by its caller.** A token-free coin of the caller leads the
  transaction; its outpoint is the child's category `K`; the transaction mints the child's masters, validator and
  records alongside the creator's frames (the framed proxy's calling genesis is the precedent, D47).
- **At its real address.** The child presents `addrV(K)` like every framed contract, so V11 binds it and nothing can
  forge it (`K` is minted once). `create2` evaluates to `addrV(K)`, which the creator computes from `K` and the validator
  template its own validator input carries. The 20-byte identity path goes away.
- **Its code checked by the creator, against constant shard locks.** Direct `deployFrom` embeds the child's body; a
  framed child's shards are too large for that. Masters therefore stop baking their category and address: a master reads
  its category from its own token and its address from its validator's input. Every master of an artifact shard then
  has one lock whatever its category, and the creator embeds those locks (about 35 B per shard) and checks the child's
  genesis outputs against them, with the child's validator at `addrV(K)` and its records at `K`'s record locks.
- **Found the way its creator publishes it.** Discovery and uniqueness are the creator's own business, as on the EVM: a
  factory's users find its children by its events and its pair mapping, and the mapping refuses a second pair. Callers
  that predicted a pair by hashing (`UniswapV2Library.pairFor`) look it up in the factory instead.

## Landed

- The creating body's category check (`framed/master/child-category-check.ts`, `child-category-check.test.ts`): every
  output of `K` must carry an NFT, mint no fungible amount, sit at a 35-byte P2SH32 lock, and be one of the locks the
  child's genesis names — the validator at `addrV(K)`, the data record's covenant, the authhead contract, or one of the
  master locks the deployment fills into the check's sentinels (`child-locks.ts` on both sides,
  `DeployOptions.childLocks`). `atomic-create2.test.ts` proves both sides in one planned transaction: the child's
  genesis passes, a fungible amount of `K` is refused, and a minting NFT at a foreign P2SH32 lock is refused.
- Two bugs that cost a round, kept here: the output's lock must be dropped after the membership comparisons (it
  otherwise stays on the stack and the next loop turn reads it as its index), and `SPLIT` leaves the suffix on top, so
  a P2SH32 prefix comparison needs `OP_SWAP` before `EQUALVERIFY`. In the generator, the record and authhead locks must
  be derived from a *copy of K at its actual depth* (depth 1 before the record, depth 2 after it), not from the top of
  the stack, which is the address.
- The factory's `createPair` shard with the check is 6,386 B of program and an 8,289 B whole spend, still inside the
  10,000-byte input limit.
- The out-of-band stand-up (`create2-child.ts`'s deployer and `addUtxo` funding), the identity registry and V11's
  20-byte `self` exception are removed. A covered frame presents `addrV` of its category, and a created child is
  reached at its own `addrV(K)` in the transaction that mints it.
- The planner test `lookup-then-call.test.ts` proves a call whose target an earlier call returned, on the shipped
  path: the factory's `getPair`, then the pair's own `getReserves` frame, on a master of the pair's category.
- The allow-list reserves 26 master-lock slots (`CHILD_LOCK_CAPACITY`), enough for the pair's 23 entries and the
  helper cuts a bundle adds. `child-lock-capacity.test.ts` creates a 26-entry child atomically and holds the creator's
  widest input to the production cap; its creator's unlocking bytecode measured 5,161 B. `test-app-bch/
  AtomicPairCreation.test.ts` creates the *shipped* pair in one caller-funded transaction: `create2` returns
  `hash160(addrV(K))`, every one of the pair's 23 shard masters is minted at its deployment lock, the validator sits at
  `addrV(K)`, the authhead and the pair's records carry `K`, and the creator's widest input is under 10,000 B.
- The deploy-then-call fold landed: the compiler drops a creator's `IChild(child).initialize(...)` on the child it
  just made (`FoldFramedCreate2Initializer`), publishes its entry and argument sources as
  `composition.creates[].foldedCall`, and the SDK runs that body at genesis after the constructor's state
  (`deriveFramedGenesis`'s `initializer`). `callFramedEntry` infers the creation from the artifact and a project
  registration of the child's artifact (`registerFramedCreatedChild`), evaluating the folded arguments over the
  creating entry's own.
  `test-app-bch/test/AtomicPairCreatePair.test.ts` runs the shipped `UniswapV2Factory.createPair`: the pair's 23
  shard masters, validator, authhead and nine records are minted in the caller's transaction, the pair's `factory`
  record is the creator's `addrV`, `token0`/`token1` are the sorted call arguments, `create2` returns `hash160(addrV(K))`,
  and the creator's widest input stays under 10,000 B. `packages/solidcash/test/framed/deploy/folded-initializer.test.ts`
  proves the same shape on a synthetic creator.
- The creator's check counts the transaction's outputs of the child's category (`childCategoryCheckScript`'s second
  loop) and requires the deployment-filled `childOutputCount`: an extra record, master or event of the child's
  category is refused even at an allowed lock. `child-category-check.test.ts` refuses an extra record in the module,
  and `atomic-create2.test.ts` drives the same refusal through the shipped call path.
- The folded state's *commitments* are checked: `childGenesisOutputs` appends a tokenless `OP_RETURN <digest>` where
  the digest is `SHA256(concat over the category outputs, in output order, of SHA256(lock ++ commitment))`, and
  `childCategoryCheckScript` recomputes it from the transaction's outputs of the child's category and compares it. A
  record whose commitment a composer altered no longer matches; `child-category-check.test.ts` tampers one (count
  unchanged) and `AtomicPairCreatePair.test.ts` supplies an arbitrary commitment through the shipped `createPair`
  call. The fold order is ascending (the outputs' order), measured against a single- and multi-output probe.
- Still open for the app: its seed and bridge deploy a pair and `registerPair` it; switching them to `createPair`
  needs the factory deployed with the pair's child locks and count, and the created pair's category registered with
  the service. The app's seed and bridge still
  deploy a pair and register it (`registerPair`); switching them to `createPair` needs the factory deployed with the
  pair's child locks and the pair's category (the creating transaction's leading coin) registered with the service.

- A framed `create2` is `addrV(K)`, computed by the creating body from its block's validator reference and the
  transaction's origin coin (`child-address-in-body.test.ts`).
- The call derivation states the real outpoints of the inputs the plan holds, so a body reading
  `OP_OUTPOINTTXHASH` sees the coin the broadcast spends.
- `FramedCallOptions.creates` appends the child's genesis to the composition's trailing outputs at the caller
  coin's outpoint (`atomic-create2.test.ts`: the returned address, each shard's master, the validator and a
  record, all read off the derivation the machine accepted).

### Landed: the category check

The create site now refuses, for every output carrying `K`: a fungible amount (unbacked liquidity), a missing NFT,
and a lock that is not a 35-byte P2SH32 (`aa20 … 87`). `atomic-create2.test.ts` proves both sides on the shipped path:
the child's own genesis passes, and a transaction that adds a fungible `K` at the caller's key is refused with the
entry's `OP_VERIFY` objection. Two bugs the probes found are worth keeping: the branch's index must be dropped with
`OP_DROP` (an `OP_NIP` removes the loop index underneath), and a `SPLIT` leaves the suffix on top, so the prefix
comparison needs `OP_SWAP` before `OP_EQUALVERIFY`.

### Still open: the masters' locks in that check (measured budget)

The child's master locks are still not in the allow-list, so a minting NFT of `K` at a substituted P2SH32 lock would
pass. Binding them needs deployment-filled sentinels, and the budget is measured: the SushiSwap factory's `createPair`
shard is 5,640 B of program and a 7,543 B whole spend, so a 23-lock set (805 B of pushes plus 23 comparisons) fits
only if the comparisons stay compact. The shape that does: push each sentinel once before the output loop, accumulate
`found = OR(found, lock == S_i)` over them with depths computed at emission, and publish each sentinel's offset under
`composition.creates` for the split pass to rewrite per shard and the SDK to fill from
`MasterPoolDeployment.getEntryLocks()`.

### Measured: the module is right, the generator's derived locks are not

The check was extracted into `child-category-check.ts` with a fixed contract — entry `[K, addrV, recordLock,
authheadLock, S0…S7]`, exit unchanged — and driven by a synthetic transaction. With fixed locks it passes all four
cases (the child's genesis, a foreign P2SH32 lock, a fungible amount of `K`, a category output with no NFT), and the
probes pin the loop's depths:

- the category item is 33 bytes for an NFT output, and its first 32 compare equal to `K` at depth 14 of that entry;
- the validator's address sits at depth 13 once a comparison has duplicated the output's lock;
- the `OP_0 TOALTSTACK … FROMALTSTACK BOOLOR TOALTSTACK … VERIFY` flag matches at that depth.

Two bugs the probes found: the output's lock must be dropped after the comparisons (it stayed on the stack and the
next loop turn read it as its index), and `SPLIT` leaves the suffix on top, so the P2SH32 prefix comparison needs
`OP_SWAP` before `EQUALVERIFY`.

Wired into the generator, the same module refuses the child's genesis, while the plan passes with the module skipped:
the failure is in the *locks the generator derives* — the record covenant and the authhead — or in the values the
deployment fills. The sentinels themselves are found and replaced in the deployed shard. Next: compare the generator's
record and authhead derivations against `stateRecordLockingBytecode` and `authheadLockingBytecode` in a probe, then
re-wire. The module and its test are ready to restore from this note's shape.

### Measured: the sentinel allow-list refuses real locks too

An attempt added the master-lock sentinels (one 35-byte placeholder per slot, filled at deployment from the child's
entry locks), the record and authhead locks derived from `K`, and an OR-accumulated membership over all of them.
Results, each probed separately:

- The sentinels are found and replaced in the deployed `make` shard (scanned standalone: one push per slot, replaced).
- Both refusals work: a fungible amount of `K`, and a minting NFT at a foreign P2SH32 lock, are refused.
- The accepted path fails: at least one legitimate output's lock is not matched, so the attempt was reverted to the
  shipped shape rules (fungible/NFT/P2SH32) rather than land a check that refuses the child's own genesis.

What is already ruled out: the authhead formula (checked off chain: it matches `authheadLockingBytecode` when the
pinned category is the reverse of the display order, which is the order `K` is in), and the sentinel replacement.
What remains to instrument is the membership comparison itself, one allowed lock at a time, plus the inline record
builder's order: `emitP2sh32FromCovenant(buildDataNftCovenantScript)` may expect the display-order category, and both
orders were tried without isolating the record output alone.

### Measured: the check block runs, the category comparison does not match

An attempt emitted the category check (loop over outputs, category compared with `K`, fungible amount forbidden,
NFT present, 35-byte P2SH32 lock). Two probes pin the failure:

- An immediate `OP_0 OP_VERIFY` at the block's start made the accepted path fail, so the block is reachable and runs.
- With the fungible-amount test set to expect `1` instead of `0`, the accepted path *passed*: no output of category
  `K` ever compared equal to the category the loop read, so the branch never executes.

The byte order is the suspect, and the quick probe was invalid (it pushed a raw length byte instead of a data push,
so both orders "matched" empty items). The next step is a correct isolated VM test of
`OP_OUTPUTTOKENCATEGORY`'s first 32 bytes against the fragment's `K` (which is the order `validatorAddress` pins,
as `child-address-in-body.test.ts` already establishes) before re-emitting the block.

### The creator's allow-list, as the next unit

The creator has to refuse any output of category `K` that is not one of the child's: the masters at their shard
locks, the validator at `addrV(K)`, the records at the data-NFT covenant, and the authhead. Two of those it derives
from `K` in script (`addrV`, and the record lock through the framework's `data record lock` routine; the authhead is
`push(pin(K)) ++ AUTHHEAD_BODY` hashed); the masters' locks come from the child's artifact, and with the block
oracle binding they are only known at deployment.

Measured shape for the check:

- The compiler emits one 35-byte sentinel push per allowed master lock (a fixed capacity, refused by the SDK when the
  child has more), so each comparison has a compile-time stack depth; the SDK fills them at deploy from
  `MasterPoolDeployment.getEntryLocks()`, as `patchInternalHelperLocks` fills helper locks. Distinct locks let a
  count establish the rule without per-lock multiplicity: count every output of category `K` (nK), count per allowed
  lock the outputs of category `K` at that lock, and require the sum to equal nK. Padding uses a lock no output can
  carry, so it counts zero.
- Counting loops follow the call-batch template; the layout below is the one the emitted block was worked out for,
  with `L` a compile-time constant push and the body emitted once per allowed lock:
  `[K, nK, sum, L]` → `OP_TXOUTPUTCOUNT OP_BEGIN OP_1SUB OP_DUP OP_OUTPUTTOKENCATEGORY
  OP_SIZE OP_NIP 32 OP_GREATERTHANOREQUAL OP_IF OP_DUP 32 OP_SPLIT OP_DROP <K by pick> OP_EQUAL OP_IF
  OP_NIP OP_DUP OP_OUTPUTBYTECODE <L by pick> OP_EQUAL OP_IF <sum++> OP_ENDIF OP_ENDIF OP_ENDIF
  OP_DUP OP_NOT OP_UNTIL`, then drop the index and `L`. In-place increment with the new value on top and the old at
  depth `k` is `OP_k OP_ROLL OP_DROP`; `nK` itself is one more such loop counting `category == K` without the
  bytecode test, and the final `OP_EQUALVERIFY` compares `nK` with the summed count.
- Fungible amounts of `K` must be refused as well: a minted amount at creation is unbacked LP, and a minting NFT at a
  substituted lock could mint it later. The allow-list above refuses both, because a matching lock is required.

## Work

1. solidc: masters without baked category/address (read from the own token and the validator input); constant shard
   locks published per artifact; at a CREATE2 site, the creator's check of the child's genesis outputs and `create2`'s
   value `addrV(K)`; V11 without the 20-byte exception.
2. solidcash: plan the child's genesis inside the creator's composition; remove the `addUtxo` stand-up and the identity
   registry; resolve a child from its address on chain (the coin at `addrV(K)` carries `K`).
3. solidcash planners: a loop turn whose call targets an address an earlier call of the same turn returned (a factory
   lookup, then the pair), in the hop planner, the read planner and the derivation.
4. SushiSwap: `pairFor` as the factory lookup (replacing the pair-code-hash read), parity suites and size survey on the
   mock and on a `solidcash node`.
5. Tests: genuine creation; a createPair whose genesis carries other code (refused by the creator); a frame presenting
   another category's address (refused, V11); resolution from chain in a fresh process.

## Implementation notes (2026-10-30)

**The address is computable in script.** `packages/solidc/src/framed/master/child-address.ts` leaves `addrV(K)` from
the validator input index, reading `K` from input 0's outpoint and the validator program from the co-spent validator's
redeem script (the same push `recogniseValidatorScriptAgainstReservedHash` reads). `test/framed/master/child-address.test.ts`
pins it to `validatorAddress` off chain. Two details it settles:

- `OP_OUTPOINTTXHASH` answers in `OP_HASH256` byte order, which is the reverse of a token category. The pin needs
  `OP_REVERSEBYTES` before the capability byte.
- The redeem push is `OP_PUSHDATA2` with a three-byte header, as the head's recognition already assumes.

**The identity output carries `K`.** A framed genesis leads with the authhead output, which holds a mutable NFT of
the child's category at a lock derived from the category and the deployer's owner lock (`planGenesisIdentity`). A
check over "every output of category `K`" therefore needs that lock: either supplied as a creation parameter, or a
rule that admits exactly one output at it.

**The master shard locks are not in the creator's compile unit.** They are compile-time constants of the child (its
constant-lock masters embed the validator-template hash), but a creator compiles independently. Two ways to supply
them: a first pass over creation targets in the project compiler, or the sentinel-push fill the function split already
uses for `internalHelperLocks`. The sentinel route needs no compile ordering and fails closed on a missing fill.

**Lock membership is not enough.** A record at the right lock can still hold the wrong commitment, so the factory
would mint a pair initialized with arbitrary tokens. The creator has to compute the folded `initialize` values and
check the records' commitments (the `foldedStateInit` path), which is the part that makes this a genesis replay rather
than a lock allow-list.

## Seams measured for the in-transaction composition (2026-10-30)

What a creator's transaction needs, and where each piece sits, from reading the shipped composer:

- **The derivation's outpoints are stand-ins.** A `callFramedEntry` derivation lays its inputs at
  `01…01:0`, `02…02:0`, … (`result.transaction.inputs`), so anything a body computes from
  `OP_OUTPOINTTXHASH` is the stand-in's, not the UTXO's. A broadcast restates the real inputs and re-signs, and a
  plan whose *value* depended on a stand-in fails there (measured: the creator's `make` refused at broadcast).
  Composing a creating transaction therefore has to lead with the caller's real coin *in the derivation*, not
  only in the broadcast.
- **The coin whose outpoint is `K`.** `childAddressScript()` (packages/solidc/src/framed/master/child-address.ts) reads
  `OP_0 OP_OUTPOINTTXHASH`, so the genesis-eligible coin (a token-free coin at vout 0) must be transaction input 0.
  `callFramedEntry` places the caller among user inputs after the participants (`call.ts:3490`,
  `placeUserInputs([CALLER_ID, ...])`), so the composer has to move it to input 0, or the snippet has to scan inputs
  for the first token-free vout-0 coin. The coin is also the child's category, so the composer must know it before it
  builds any output.
- **The child's outputs.** A framed call's non-participant outputs are the draft's `trailingOutputs`
  (`composer/draft.ts:187`, assembled at `call.ts:2744`); the broadcast lays out `participantCount + trailingOutputs`
  (`call.ts:3962`). The child's genesis is a list of such outputs: `deployMaster(shard.artifact, K, validator)` per
  shard lock, one validator at `addrV(K)`, the data-NFT records at `stateRecordLockingBytecode(K)`, and the authhead at
  `authheadLockingBytecode(K)`. The records' commitments are what `deriveFramedGenesis` computes from the constructor
  (and, with a fold, from the folded call).
- **The creator's check.** The test shows what the snippet needs: the validator input's index, which the head parses
  but drops before the body (`master-head.ts:~806`). A body can re-read its own witness block
  (`readFrameHeaderScript()` over `OP_INPUTINDEX OP_INPUTBYTECODE`'s first push) to get `validatorRef` again, and then
  `childAddressScript()` leaves `addrV(K)`. The child's shard locks are not derivable in script, so they must be
  deployment-filled sentinels (the `internalHelperLocks` pattern in `split/function-split.ts:773` and
  `framed/deploy/entry-pool.ts`), with the artifact publishing the blob's offset and the SDK filling it from the
  child's prepared split (`MasterPoolDeployment.getEntryLocks()`).
- **The fold.** `UniswapV2Pair(pair).initialize(...)` is a framed external call whose target is a local holding the
  `create2` value. `LowerFramedCreate2Address` would have to record the call on the creating local and drop it, the
  `.func` shard would publish it (`composition.creates[].foldedCall`), and `deriveFramedGenesis` would run it against
  the constructor's state — the proxy deployment's `initializedProxyState` (`framed/proxy/deploy.ts:1643`) is the
  working precedent for reading a hop's state back out of its plan.
- **The fragment's stack accounting.** The create-site fragment is emitted only after outlining folds shared spans, so
  its physical stack effect has to match the generator's model exactly. The form that works reads the block, drops
  `rest` and nips twice (leaving the frame kind beneath the validator index), then leaves the address on top; reading
  the block's `origin` reference instead — the user's coin, which is the coin `K` should name — shifts the body's
  PHD depths and the entry's retval write then reads the wrong slot (measured: an output-index refusal). Either the
  composer leads with the caller's coin as input 0 (what the shipped fragment expects) or the fragment's accounting
  is redone against the body's stack model.
- **V11.** `checkV11` and `addressCheckScript` both skip a 20-byte `self`; removing the skip is the last step, once no
  deployment presents an identity (`create2-child.ts`, `create2-identity-registry.ts` and the `identityTarget`
  stand-up in `framed/proxy/external-calls.ts` are the paths to delete with it).
