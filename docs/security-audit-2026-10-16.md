# Security audit 2026-10-16 (living document)

Status: in progress. Findings are appended as they are found; a later section may refine an earlier one.

Summary so far: DYN-1 (CRITICAL), ECR-1 (CRITICAL, needs a VM run), MERGE-1 (MEDIUM-HIGH), CONT-1 (MEDIUM), MIG-1 (MEDIUM, design),
WT-2 (MEDIUM), KCHAIN-1 (LOW on consensus limits, forged-digest primitive under the mock's limit), WT-1 (LOW).
Closed after tracing: ROUTE-SKIP-1 and ROUTE-READ-1 (handler clones never batch; LOW hardening note on the
name-based guard).

Not yet read on this pass: framed validator and master deltas since `056f4036b`, message-bus lifecycle and
compose SDK, block oracle updater, website, and tooling. `ecrecover` was read only for the side-car chain binding
(not the field and ladder arithmetic).

Recommended next steps: (1) a VM test for DYN-1 (patch the base witness to -5 on a `setName` call and forge a chunk)
and for ECR-1 (a width-0 recovery with a forged `B-1` output); (2) resolve ROUTE-READ-1 by tracing read-lane
activity against the route row set.

## Scope and baseline

- Tree: `feat/per-call` at `74bd5ff06` plus the uncommitted edit to
  `packages/solidc/src/generation/GenerateTargetTraversal.ts` (`emitPreserveOutsideLayoutOwnMutable`) and the
  untracked test `packages/solidcash/test/e2e/StructArrayElementOverwrite.test.ts`.
- Baseline: `docs/security-reaudit-working-tree.md` (read at `056f4036b`), `docs/security-audit-2026-10-15.md`,
  `SECURITY-AUDIT-2026-10.md` and `docs/security-audit-2026-10/`. Ids from those files are not re-reported unless
  the current code changes their status. Open from baseline: DX-6 / DS-3 (iterating entry spend), SDKFRAMED-2
  (opt-in hop race).
- Threat model: as in the baseline. On chain, the compiled script is the only boundary; an attacker builds any
  transaction the BCH 2026 VM accepts but cannot sign for keys they do not hold. Off chain, a provider may be hostile.

Severity: CRITICAL (theft or permanent state corruption by an unprivileged spender), HIGH (same, with a
precondition that is common), MEDIUM (needs an uncommon shape or privileged party), LOW (hardening / DoS / info).
"Confirmed" means traced in source to the missing refusal; no VM run was made unless stated.

## Findings

### DYN-1 (CRITICAL, source-traced) A direct dynamic write skips all chunk verification when the spender passes a base below -1

Attacker: anyone who may call a direct (non-route) function that writes a dynamic state variable (`string`, `bytes`,
`T[]` kept in chunk NFTs). The authorization the function itself requires still applies. Many such functions are
public (MistSwap `MasterChef.deposit`/`withdraw`/`updatePool` write `poolInfo`).

Shape: call the function honestly, then set the hidden ABI argument `__internal__dynamicChunkInputBase` to any value
below -1 (for example -5). Replace the new chunk outputs' commitments with chosen bytes of the same total length,
or drop or add chunks at the chunk lock.

Why it settles:

- The parameter is a plain unlocking push. `markDynamicChunkInputBaseFunctions` (`compiler.ts:2012-2057`) marks every
  function that reads or writes dynamic state, and `SymbolTableTraversal.ts:5295-5304` appends the parameter. A
  probe compile of `contract Dyn { string public name; function setName(string n) {...} }` with
  `messageBus: false` produced the ABI `setName(n, __internal__dynamicChunkInputBase)`. The MistSwap fixture artifacts
  expose it on `MasterChef.add/set/migrate/updatePool/deposit/withdraw/emergencyWithdraw` and
  `UniswapV2Factory.createPair`.
- `emitDynamicWriteVerification` (`GenerateTargetTraversal.ts:40494-40516`) wraps the whole verifier in
  `base >= -1 OP_IF ... OP_ELSE <drop temps> OP_ENDIF` whenever the parameter is on the stack. The guard is not
  restricted to message-bus routes. It was introduced by `cbac1be14` ("fix kernel marketplace multi-post
  composition") for an inactive route row. The `OP_ELSE` arm does nothing: it skips the per-chunk commitment pin
  (`40712-40716`), the new-chunk output count (`emitVerifyChunkUtxoCount`, `40772`), and old-chunk consumption
  (`emitDynamicOldChunkConsumption`, `40773`).
- No other check holds the run. On a direct function, the data-record header still settles the new `A$len` from the
  pending value (`35319-35323`; the dormant-header arm at `35299-35318` exists only for `isCompilerMessageBusRoute`).
  `emitDirectCollectionCensus` leaves out the unwritten-chunk census for a written variable (`51893-51895`). The
  outside-layout walk admits any input at a chunk lock (`emitPreserveOutsideLayoutOwnMutable`, `51995-52000`; the
  uncommitted diff makes that admission unconditional). The output scan admits any own-category mutable output at a
  chunk lock (`emitMutableOutputAllowed`, `52281-52309`). The chunk-lock covenant (`buildEntryNftCovenantScript`,
  `utils/src/state.ts:1969-2036`) authorizes any spend beside the minting master. C3 is off because
  `pendingDynamicWrites.size > 0` (`10165-10168`).
- A later read (`emitReadDynamicScalar`, `42911-42951`) checks only the chunk lock, the mutable category, and the
  chunk ordinal, then truncates to `A$len`. Every later call of the contract therefore reads forged bytes as state.

Impact: the caller can set any dynamic state variable the function writes to arbitrary content of the length the
honest write would produce. They can also leave old chunks behind or destroy them. For `MasterChef.poolInfo`, that
means rewriting `lpToken`/`allocPoint`/`accSushiPerShare` of every pool, which is theft of rewards and deposits.

Fix direction: on a direct (non-route) function, refuse a base below -1 (`OP_1NEGATE OP_GREATERTHANOREQUAL OP_VERIFY`),
or take the inactive arm only when the route's authenticated row set says the writer is inactive. Never treat a
free witness as an activity flag.

Verification: traced in source plus a probe compile of the ABI. No VM run was made (the probe test was stopped
because the command form ran the whole e2e suite).

Route extension (suspected, not finished): `compiler.ts:11638` forwards the route's own
`__internal__dynamicChunkInputBase` parameter unchanged into every handler clone. The route's dormant-header arm
(`GenerateTargetTraversal.ts:35299-35318`) only preserves the `A$len` header when the base is below -1. A route row
that does write a dynamic value would then settle the old header while its chunks go unverified, which is
self-inconsistent but not obviously exploitable. No reference was found that ties the base to the message-bus
binding digest (`compiler.ts:12845-12849` hashes the manifest, base, row count, and batch). Whether a forged
`< -1` on an active writer row can change readable state needs the route's header path traced further.

### ROUTE-READ-1 (suspected, HIGH if confirmed) A route's sorted-map read returns the default when the spender marks it inactive

Attacker: a spender of a compiler message-bus route whose active handler reads `m[k]` for a key that exists.
Shape: set the read slot's `__internal__vmapBatchProof_<slot>` to a negative value and do not co-spend the node.

What happens: `visitSortedMapRead` on a route batch tests `proof < 0` and pushes `emitDefaultValue` instead of
reading the node (`GenerateTargetTraversal.ts:27816-27830`). The comment says the SDK publishes the negative proof for
an inactive handler's lane. The batch census counts a read slot only when its fixed input is at the collection
address (`readSlotIsNode`, `34100-34106`, used at `34216-34224` and `34267-34274`). A slot whose node is absent counts
0 on both sides, so the census balances.

Update 2026-10-17. The negative-proof arm applies only to a slot that is a **batch slot** (`routeBatch` requires
`sortedBatchInfo.slotIndices.includes(slotIndex)`, `27816-27818`). That is, a read of a key that the same route also
writes, for example `m[k] = m[k] + x` (read-modify-write) or a guard read like `require(!used[k]); used[k] = true`.
For a batch slot, the write side treats `proof <= 0` as an inactive row. The only constraint is
`(proof <= 0 || aliasOwnerOk) == (predOut == -2)` (`32455-32463`, runtime-alias slots only), and the census counts
the target as 0 outputs when `predOut == -2` (`34245-34256`). So the attacker sets `proof = -1, predOut = -2` on an
active handler's slot. The read returns the default, and the write of that slot is skipped as "inactive".

Effect on `require(!used[k]); used[k] = true;`: the read sees `false` and the require passes. The write is dropped,
so `used[k]` stays as it was (`true`), and the handler's other effects (a transfer) still run. That is a replay of a
one-time action. On `balances[k] = balances[k] - amount` with a separate transfer, the read sees 0, the check
`require(balances[k] >= amount)` fails, so that shape is safe. A `nonce` read and increment is a replay.

What could still refuse it: (1) the batch verifier's row encoding in `batchBlob`, if the selected row names its
writes and the verifier requires an active write for each. I have not found that link. `sha256(localBatch)` covers
the rows (selector and args), not the per-slot proof witnesses. (2) Whether such a handler is admitted to a
compiler route at all. The kernel admission gates refuse many shapes.

Still suspected. The decisive check is whether any on-chain code ties `__internal__vmapBatchProof_<slot> > 0` to
the active handler for that slot. Searching `compiler.ts` for `vmapBatch` finds only `TrailingCount`, so the route
template itself does not.

Open question that decides it: whether anything ties a read lane's activity to the selected handler. The binding
digest (`compiler.ts:12845-12849`) covers the batch rows, but no reference was found from the read lane to the
active-row set. If nothing does, an active handler can be made to see `m[k] == default` (for example a nonce or a
`used[k]` flag reading as zero or false, which permits replay, or an allowance reading as zero). Not yet confirmed.

### ROUTE-SKIP-1 (DOWNGRADED 2026-10-17 to LOW hardening: closed by the scalar clone path)

Correction after tracing clone batch assignment. Route writes execute inside handler clones, which are all named
`__message_bus_*` (`nameMessageBusClone`, `compiler.ts:10503-10512`). In `SymbolTableTraversal.ts:4048-4054`,
`ownsCollectionTopology` is true for `node.name.startsWith('__message_bus_') && !node.messageBusRoute`, and a clone
is not the route itself. So every clone gets `sortedBatchInfo = undefined`. A clone's writes therefore take the
scalar upload path (`inBatch` false, `GenerateTargetTraversal.ts:28622`), where `predOut` is not read at all, and
its reads cannot take the `routeBatch` default arm (`27816-27818` requires `sortedBatchInfo`). The route function's
own body dispatches rows and contains no source writes or reads. The `-2` gate on the general batch
(`33960-33961`) is therefore reachable only by the synthesized route object, whose writes do not exist.

That closes both ROUTE-SKIP-1 and ROUTE-READ-1 as written, on the current naming convention. Residual (LOW): the
protection is a *name* test (`__message_bus_` prefix) rather than a typed property. Any future clone family, renamed
clone, or inlined handler that keeps `sortedBatchInfo` would re-open the general branch, which accepts `-2` for
direct functions too whenever a batch is nonlinear (an alias/conditional-delete slot makes `linear` false at
`SymbolTableTraversal.ts:4062-4067`). Recommend replacing the name test with an explicit `ownRecordsScalarOnly`
flag and refusing `-2` outright on a non-route batch.

The analysis below records the original reasoning and stands as the description of why a typed guard is wanted.

### ROUTE-SKIP-1 (original entry; see the downgrade above; HIGH if admitted routes reach it; source-traced) A compiler route's sorted write is skipped when the spender sets `predOut = -2`

This generalizes ROUTE-READ-1 to writes. On a compiler message-bus route, each sorted-map write slot carries
spender-chosen witnesses `Slot/Proof/Next/PredOut`. `predOut == -2` is the "inactive row" sentinel, and it is
treated as authoritative in three places:

- At the write site, `emitSortedValueUpsert` wraps the whole upsert in `predOut != -2 OP_IF` for every batch slot
  (`GenerateTargetTraversal.ts:28691-28700`). The comment says this applies to "the first slot in each route
  family too ... it can still be inactive".
- In the transition, `singleTarget` skips under `predOut == -2 OP_NOTIF` (`33509-33512`). The general batch skips
  each target the same way (`33960-33961`, `34051-34052`).
- In the census, a `-2` target adds zero outputs (`34245-34256`). A target with `proof <= 0` adds zero inputs.

The only constraint on `-2` is the runtime-alias preflight (`32423-32463`). It covers only slots with
`runtimeAliasPriorSlots`, and even there it accepts `-2` whenever `proof <= 0`. A direct (non-route) single target
refuses `-2` (`33683-33686`, the DS-1 fix). The route path is exempt (`plain` is false), and the multi-target and
linear forms never refuse it. Nothing in the route template ties a slot's activity to the selected handler:
`compiler.ts` never mentions `vmapBatchProof` or `PredOut`, and the binding digest (`compiler.ts:12880-12882`)
hashes the row bytes and the row count, not the per-slot witnesses.

Supporting evidence: the SDK's default for every compiler-owned witness the selected handler does not use is
`PredOut = -2`, `Proof = -1`, `BatchSlot = BatchNext = 0^32` (`packages/solidcash/src/stateful/kernel-route-planning.ts:138-155`;
also `StatefulContract.ts:2887`, `sc-batch-raw.ts:596`). So the honest encoding of "this handler does not touch
slot N" is byte-identical to the attack encoding of "skip this handler's write to slot N". The skip happens at the
handler's own write site, inside the handler body the route invokes.

Shape: call a route row whose handler does `used[k] = true` (or `nonce[k]++`, or `balances[from] -= amount`) together
with a transfer or event. Set that slot's `predOut = -2` and `proof = -1`, and do not co-spend the node. The handler
body runs, so its `require`s and transfers happen. The map write is a no-op, and the census balances.

Impact: a one-time guard (`used[k]`, nonces, claimed flags) never flips, so the action replays. A debit followed by a
payout leaves the balance in place while the payout goes out. If a read of the same slot comes first, it returns the
default (ROUTE-READ-1), which can make that `require` pass or fail.

Not confirmed: (1) whether a route-level per-row check refuses an inactive write slot for the row's own handler. I
found none in `compiler.ts:11900-13990` or at the sites above. (2) The kernel journal path
(`emitKernelJournalSegmentsValidate/Hash`, `9652-9659`, `9809-9845`) binds a journal record vector for runtime-loop
entries, the "dense first-touch prefix". It may cover routes that settle through journals and not `sortedBatchInfo`.
Fixed map writes on routes that use `sortedBatchInfo` are not covered by it.

Fix direction: derive each slot's activity on chain from the dispatched selector (the route already decodes
`rowSelector`), and require `predOut != -2 && proof > 0` for every slot the selected handler owns.

### MERGE-1 (MEDIUM-HIGH; source-traced) A merge does not conserve or pin the consumed threads' satoshis or surplus fungible tokens

Two paths, same gap.

Direct merge (`emitMergeCovenantVerification`, `GenerateTargetTraversal.ts:50588-50757`):

- The survivor path requires `input value == output value` for the survivor only (`50606-50612`), so merged value
  cannot be added to it there.
- Each consumed master's input (window `(owner + D, owner + D + N]`) must share the survivor's lock and minting
  category. Its fungible amount only needs `self_ft <= survivor_output_ft` (`50720-50730`), checked
  **per input**. Nothing pins where that master's satoshis go, and nothing sums the fungible amounts.

Message-bus merge (`lifecycleVerification` mode 2, `compiler.ts:12485-12532`): the survivor keeps its own value
exactly (`12490-12497`), the consumed slots must be minting inputs recreated with an empty category (`12527-12531`),
and there is **no value or fungible-amount term for the consumed slots at all**.

Attacker: whoever can satisfy the merge entry. If the body guards merge with the admin's signature, this is a
malicious-admin surface. If merge is public (a plausible "consolidate shards" utility), any spender can do it.
Shape: choose the survivor as any minting master of the category, co-spend any other masters in the window, and
send their satoshis to an output of the attacker's choice. For fungible tokens, send the surplus of the category to
a separate own-category output (consensus forbids inflation, not reassignment). The consumed masters' state
commitments are burned by design, so their per-thread state is lost too.

What the honest SDK does: `sc-split-merge.ts:293-304` adds the consumed satoshis plus funding minus fee to the
user's change address. The script accepts any destination, so the SDK's behavior is a convention, not a rule.

Fix direction: require each consumed master's satoshis to arrive at a pinned destination (the survivor or the
contract's satoshi container), and require the survivor's output fungible amount to be at least the **sum** of the
consumed inputs' amounts (or pin every own-category fungible output to the survivor's lock).

### CONT-1 (MEDIUM, source-traced) An unnamed token container's NFT commitment is not kept

Attacker: anyone who can satisfy any public function of a direct stateful contract that holds a foreign mutable or
minting NFT in a token container (for example a contract that custodies another protocol's position or receipt NFT).
Shape: co-spend that container with `flag = 1` (the container master arm) beside the master, and recreate it at
the same index, lock, category, and amount with another commitment. A minting foreign NFT also lets the attacker
mint further NFTs of the foreign category in the same transaction, because the foreign category's own rules are
the only limit.

Why it settles: `emitForeignContainerKeep` (`GenerateTargetTraversal.ts:51760-51792`) pins the lock, the full
category (with capability), and `amount >= input`. It does not compare `OP_UTXOTOKENCOMMITMENT` with
`OP_OUTPUTTOKENCOMMITMENT`. The container master arm's `directMasterOutputPin` (`utils/src/state.ts:2409-2445`)
pins only the lock and, since `d60f17ae9`, the 32-byte category. It leaves capability and commitment free.

Impact: a mutable foreign NFT the contract custodies can be rewritten. Whether that is theft depends on the foreign
protocol: commitments often carry the position's value. A minting foreign NFT lets the attacker mint the foreign
category freely.

Fix direction: add the commitment equality to `emitForeignContainerKeep` and keep the full category (capability
included) there. The `d60f17ae9` relaxation is fine only because this keep runs.

### MIG-1 (MEDIUM, design) `migrateRecords` lets its caller move an entry to any lock it names

Attacker: whoever may satisfy a `migrateRecords` function (by design the admin; the authorization is the user's
body, so a weakly guarded body widens this to anyone). The migration can be run at any time. It does not require
that an `upgrade` follow.

Shape: call the `migrateRecords` entry with `__internal__upgradeBytecode` set to a lock of the attacker's choosing,
for example a P2SH32 of a script the attacker controls. The entry is re-minted at the entry covenant bound to that
lock.

Why it settles: `emitMigrateRecordsEntryMigrationCheck` (`GenerateTargetTraversal.ts:49891-49961`) derives the new
entry covenant from the free `__internal__upgradeBytecode` (`49914-49922`) and checks commitment, category, and
value. The master is kept (`emitMasterSelfPreservation` through the generic path), so the upgrade lock is never tied
to an actual upgrade or a committed replacement. The bound entry covenant's master arm then accepts a minting master
at that lock, and only that lock (`bindMintingAuthorityLock`). So the entry is (a) stranded from the current contract,
which can no longer find it at its own entry address (a reader treats the key as absent, so a balance reads as 0),
and (b) controllable by the named lock if that lock can ever hold a minting NFT of the category.

Impact: a privileged or poorly guarded `migrateRecords` can censor or strand arbitrary user entries one at a time,
without an upgrade. The `upgrade` modifier has the same free-lock trust, but there the master moves too, so the
operation is visible and atomic. Here the contract keeps running with silently missing entries.

Fix direction: commit the replacement lock once (for example in the master commitment or an upgrade-intent
record), and require `migrateRecords` to use that committed lock. Alternatively, refuse ordinary entry functions
once migration has started.

### KCHAIN-1 (LOW on mainnet, a liveness and test-fidelity issue) Chained keccak side-cars commit 200-byte states

`keccakChainCommitments` (`utils/src/keccak-compute-library.ts:266-297`) and the START/CONT covenants
(`research/keccak-poc/gen-chain-sidecar.mjs:3-13`, `COMBINE_STATE_ASM`) commit the full 25-lane sponge state,
200 bytes, to a mutable NFT. BCH 2026 consensus allows 128 bytes (`maximumTokenCommitmentLength: 128` in libauth's
`bch-2026-consensus.js`). The mock provider allows 1,000,000 bytes (`MockNetworkProvider.ts:62`), so the e2e suites
accept transactions that mainnet and chipnet refuse. Every `keccak256` over an unbounded preimage of 136 bytes or
more becomes unspendable on a real network. This is not a theft, but any contract whose only path through such a
call is required (for example a withdrawal) is locked. The mock's limit should match consensus unless a test opts
in explicitly.

Integrity of the chain on the mock: the contract binds only the FINAL covenant hash and the full preimage
(`GenerateTargetTraversal.ts:15000-15052`). FINAL reads the previous state from
`OP_INPUTINDEX OP_1SUB OP_OUTPUTTOKENCOMMITMENT` and does not check that output's lock. An attacker could place an
arbitrary 200-byte commitment at index `FINAL-1` on an unrelated output and get a chosen digest. That chosen state
cannot be inverted to match the bound preimage, though. FINAL absorbs only the last `len % 136` bytes, so a forged
earlier state yields `keccak` of a different sponge input while the contract believes it hashed the full preimage.
**This is a forged-digest primitive.** It is limited to the mock today, because the 200-byte commitment is not
consensus-valid. Treat it as CRITICAL if the commitment limit is ever raised. Even with genuine START/CONT inputs
the chain is unbound: each START/CONT side-car absorbs the block from its own unlocking, and nothing compares that
block with the corresponding slice of the contract's argument. Only FINAL's `full_arg` is bound. A state of 128
bytes or less at `FINAL-1` cannot be split into 25 eight-byte lanes (`SPLIT_STATE_ASM`), so on consensus rules the
forgery fails along with the honest path. Fix: commit a 32-byte hash of the state (or of the absorbed prefix) and
not the raw state, and have FINAL require the previous output's lock to be the expected chain lock with the same
salt. Bind every absorbed block to the matching slice of the argument, for example by having FINAL recompute a
hash chain of the blocks against `full_arg`.

### ECR-1 (CRITICAL, source-traced; needs a VM run to confirm) A width-0 recovery's B3 trusts an unauthenticated middle output

Confirmation notes: `C2` is the Jacobian accumulator checkpoint (`research/ecrecover-poc/middle.mjs:15-36`, `74`).
B3 only re-hashes the checkpoint that output `B-1` names. The compiler never references
`ECRECOVER_COMPUTE_M_COVENANT(_HASH)`: a grep of `packages/solidc/src` finds no use, and the M lock is used only by
the SDK (`utils/src/ecrecover-compute-library.ts:26-62`). The PoC's own forgery test (`middle.mjs:117-124`) only
covers a wrong C1 or C2 under an honest commitment. It does not cover a forged predecessor output. With the
accumulator free, B3's result is `C2* + (remaining ladder)`, and an attacker who wants a chosen `Q*` solves for
`C2*` off-chain. Any contract that authenticates with `ecrecover*` (non-EVM projection) is then open to any
spender who picks the width-0 B3 path, which the contract always accepts (`15311-15321`, `15365-15375`).

Attacker: anyone who can call a function using `ecrecoverPubKey`/`ecrecoverP2pkh` (a common signature-auth pattern,
e.g. a permit or meta-transaction). Goal: make the contract accept a recovered key of the attacker's choosing for a
signature that the claimed key never made.

Chain: A binds `argBlob` to the contract (`GenerateTargetTraversal.ts:15324-15353` and the loop form `15296-15303`),
then commits `H_A = hash256(argBlob || sharedBlob || C1)` to its own output. M (`research/ecrecover-poc/
gen-middle-sidecar.mjs:64-84`) checks `H_A` at `OP_INPUTINDEX OP_1SUB` and commits `H_M = hash256(argBlob ||
sharedBlob || C2)`. B3 (`PARSE_B2`, `100-107`) checks `hash256(argBlob || sharedBlob || Cblob)` against
`OP_INPUTINDEX OP_1SUB OP_OUTPUTTOKENCOMMITMENT`, then runs the ladder from `Cblob` and commits Q.

Gap: neither M nor B3 checks the lock or category of the output it reads. The contract checks that A and B are
genuine (`15349-15375`). In the loop form it accepts B by its shared lock alone (`15311-15321`). It never checks M,
and never checks that B's predecessor output belongs to M. B3 also does not compare its own `argBlob` with A's.
So an attacker:

1. Spends a genuine A for the real `argBlob` (any signature at all, for example the victim's public one, or none:
   A only needs the ladder's first chunk to be consistent with its own blobs).
2. In place of M, puts any input whose output at `B-1` carries `hash256(argBlob || sharedBlob || C*)`, where `C*`
   is a ladder midpoint the attacker computed off-chain. Starting from `C*`, the remaining ladder reaches the
   attacker's chosen point Q*. A mutable or none NFT of any category, or even an immutable NFT at an
   anyone-can-spend lock, works. The commitment is attacker data.
3. Spends a genuine B3 with `Cblob = C*`. B3 finishes the ladder and commits Q*.

The contract reads Q* from B's output (`15381-15384`) and treats it as the signer. Whether step 2 lets Q* be chosen
freely depends on how B3's ladder uses `Cblob`. It holds the running accumulator of a Shamir/GLV ladder, so a forged
accumulator shifts the result by a chosen point, and Q* is then a free choice. The `Zinv` witness has to match the
attacker's own Q*, which they can compute.

Exploit detail (2026-10-17): the non-loop path does not bind B's `argBlob` to the contract's either. It drops B's
first five unlocking fields and only verifies B's covenant hash (`15357-15375`). So the attacker is free to choose
B's `argBlob`, `sharedBlob` and `Cblob`. The predecessor output's commitment just has to equal
`hash256(argBlob || sharedBlob || Cblob)`, which they compute, and `Cblob` is the checkpoint B3 ladders from. The
salt check inside B3 (`SALT_CHECK`) compares the unlocking salt to input 0's token category base, so input 0 must
be the contract master (the attacker arranges that) and the side-car lock is the public salted P2SH32. Any output
at index `B-1` with a 32-byte NFT commitment (any category, any lock) supplies the forged checkpoint. No VM
subtlety is needed beyond B3 accepting a 32-byte commitment and reading its own three fields. This is a
signature-forgery primitive for every contract that authenticates with `ecrecoverPubKey`/`ecrecoverP2pkh`.

Shipped bytecode check: the baked `ECRECOVER_COMPUTE_B3_COVENANT` opens with the salt brand
(`OP_DUP <0^32> OP_EQUAL OP_IF ... OP_0 OP_UTXOTOKENCATEGORY ...`, which reads input 0, not the predecessor), then
`54 7a 75 53 79 53 79 53 79 7e 7e aa c0 8c d2 88`, which is
`<4> ROLL DROP <3> PICK <3> PICK <3> PICK CAT CAT HASH256 INPUTINDEX 1SUB OUTPUTTOKENCOMMITMENT EQUALVERIFY`. No
`OP_OUTPUTBYTECODE` or `OP_UTXOBYTECODE` of `B-1` follows. This matches the source.

Cross-check: `utils/src/ecrecover-compute-library.ts:28` documents `ECRECOVER_COMPUTE_M_COVENANT_HASH` as
"baked into the contract's side-car integrity check (3rd lock)", but no compiler code reads it, so the documented
check is missing.

Also note: for the 2-way stateful B2 (`gen-ecrecover-b2.mjs:63-64`), the predecessor is read at `OP_INPUTINDEX OP_2 OP_SUB`
and the M slot is "a funder". The B2 path reads A's own output, which A authenticated, so B2 is not affected.

Fix direction: B3 must require the output at `B-1` to sit at the M covenant's lock (shared or salted P2SH32), and M
must require the output at `M-1` to be A's lock. Alternatively, the contract can check the M slot's input lock like it
checks A and B.

### WT-1 (LOW, revised from MEDIUM) The outside-layout pin now admits every record lock unconditionally

Committed during this audit as `fb0bba34f` ("admit rewritten chunks in the outside-layout mutable walk"). The edit to `emitPreserveOutsideLayoutOwnMutable` (`GenerateTargetTraversal.ts:51955-52028`) removes
the `stepped` gate. Before it, a function with no in-loop entry slot and no collection iteration preserved every
own-category mutable input past its block 1:1 (lock, commitment, category). Now any such input whose lock is a
data, entry, or chunk lock (`emitMintableRecordLocks`, `52241-52274`) is skipped, for every function.

What still holds a skipped input:

- Data records: `emitDataRecordCensus` (count at the data lock, both sides) and `emitPreserveUnreadDataRecords`
  (only at `master + offset`). A data record outside the block offsets can be co-spent and re-emitted with another
  commitment at the same count. A data NFT normally lives only at its offsets, so this needs an extra data NFT,
  which the covenant authorizes beside the master (DS-3 shape).
- Chunks of an unwritten dynamic variable: `emitUnwrittenChunkCensus` pins each 1:1. That holds.
- Chunks of a written dynamic variable: only the dynamic-write verifier. Combined with DYN-1 it holds nothing.
- Entries of a collection the function does not count (`counted` in `emitDirectCollectionCensus`, `51866-51880`):
  `emitFixedSlotCollectionCount` pins input and output counts at the collection address. It does not pin
  commitments. **An entry the function does not name can now be co-spent and re-emitted with any commitment at the
  same count.** Before the edit, the outside-layout walk pinned its commitment. Only a collection the function
  writes (`!written` false) skips the output-count pin. A read-only collection keeps both counts and no
  commitments.

Fix direction: keep the commit's intent (admit a written dynamic variable's old chunks) by admitting only the chunk
locks of `pendingDynamicWrites`, and keep the 1:1 pin for every other lock.

Update 2026-10-17 (HEAD `b3770c8cb`): a later commit narrowed the admission to `admitMintableLocks` (an in-loop
slot, a collection iteration, a dynamic write, or a value-chunk lock list). A function with none of these preserves
every outside input 1:1 again. The residual above still applies to every function that has one of these. For
example, a function that writes `string name` admits every entry lock of every collection, so an unnamed entry of
an unrelated mapping can be rewritten under the count-only census. The fix direction is unchanged: admit only the
locks the function actually rewrites.

### WT-2 (MEDIUM, revised from HIGH) The outside-layout walk stops before the block when the master is not input 0

`a56314f36` changed the entry test of the walk to `i >= master + blockSize` (absolute), but the loop's exit test
is still `i < blockSize` (relative; `emitPreserveOutsideLayoutOwnMutable`, the `OP_DUP <blockSize> OP_LESSTHAN
OP_UNTIL` tail). The walk counts down from `txInputCount - 1` and stops at the first `i < blockSize`. With the master
at absolute index `m > 0`:

- Inputs `i` in `[m + blockSize, ...)` are checked, as intended.
- Inputs in `[blockSize, m + blockSize)` are skipped by the entry test. They are the block itself plus `m` inputs
  that are not in the block when `m > blockSize`. When `m > blockSize`, nothing else excludes an outside input at
  `[blockSize, m)`.
- Inputs `i < blockSize` are never visited, because the loop exits there. That includes every input below the
  master.

So any own-category mutable input placed **before** the master (index `< m`) escapes this check entirely. A
direct contract's master is usually input 0, but not always. The SDK places a contract's block after a funder or
after another participant in a composed or cross-contract call. That is exactly the case `a56314f36` was written
for ("a cross-contract callee (master at absolute index > 0)"). An attacker builds the transaction, chooses the
master's index, and puts an unnamed own-category data, entry, or chunk NFT in front of the master. Through the
record covenant's master arm (flag 1, which any master spend authorizes), they recreate it with another commitment.
Of the other checks, the address counts (`emitDataRecordCensus`, `emitFixedSlotCollectionCount`) only count.
`emitPreserveUnaccessedChunk` preserves unwritten chunks wherever they sit, so chunks of an unwritten variable are
still safe. Data records and entries are not.

Before `a56314f36` the entry test was relative too, so the walk covered every `i >= blockSize`, inputs before the
master included (it over-preserved the callee's own block, which is the bug that commit fixed). The fix opened
this hole while closing that one.

Can the attacker choose `m`? For a plain direct function the master index is `OP_INPUTINDEX`
(`emitMasterInputIndex`, `GenerateTargetTraversal.ts:48931-48933`), and every block coordinate is relative to it. So
the attacker makes `m` large by putting their own inputs first (P2PKH funding inputs, or the unnamed record
itself). No check requires the master to be input 0. The record covenants address their master by a witness index
(`<masterInputIndex> <flag>` in `buildEntryNftCovenantScript`, `bindMintingAuthorityLock`), so a record at index
`< m` can name the master at `m`. This needs no cooperation from anyone.

Which functions it reaches: the walk runs only from `emitDirectCollectionCensus`, which runs only where C3
(`countsOwnCategoryNfts`, `GenerateTargetTraversal.ts:10165-10168`) is off. A function with no entry access,
token container, dynamic write, or deploy keeps C3, which counts own-category mutable inputs and outputs over all
indices but does not compare commitments. So even there, an unnamed record before the master can be rewritten
at the same count. C3 never stopped a rewrite. That is DX-6/DS-3's open "count, not commitment" residual, and it
applies to every function. For C3 functions the outside walk does not run at all, so this hole is the pre-existing
DX-6/DS-3 one. Correction to that: a C3 function preserves its accessed data records at their offsets
(`emitAutoCovenantVerification`, `emitPreserveRecordAtOffset`), but an unaccessed map entry beside a C3 function is
held only by the count. Rewriting `balances[victim]` beside a function that does not touch `balances` passes C3.
Whether the earlier audit (`SECURITY-AUDIT-2026-10.md:115`, DS-3) treated this as covered, or whether a later fix
added a commitment pin for C3 functions, needs checking. The 2026-10-15 reaudit rated DS-3 open, so this is
consistent: unaccessed map entries are rewritable beside any function. That is the most serious open item in the
tree, and WT-2 widens its reach. WT-2 adds the C3-off functions (any function with entry access, a dynamic write, or a token
container) for inputs before the master.
