# Security audit 2026-10-16 (living document)

Status: in progress. Findings are appended as they are found; a later section may refine an earlier one.

Summary so far: DYN-1 (CRITICAL, direct and route builds), ECR-1 (CRITICAL, needs a VM run), FRAMED-CONT-1 (HIGH, framed), MERGE-1 (MEDIUM-HIGH), CONT-1 (MEDIUM), MIG-1 (MEDIUM, design),
WT-2 (LOW), KCHAIN-1 (LOW on consensus limits, forged-digest primitive under the mock's limit), WT-1 (LOW).
Closed after tracing: ROUTE-SKIP-1 and ROUTE-READ-1 (handler clones never batch; LOW hardening note on the
name-based guard).

Remaining unread: the framed validator's field-level checks past those cited in the 2026-10-15 audit, the message-bus
compose/layout SDK, the website, benches, and tooling. The `ecrecover` covenants were read only for chain binding
(not the field and ladder arithmetic).

Recommended next steps: (1) a VM test for DYN-1 (patch the base witness to -5 on a `setName` call and forge a chunk);
(2) a VM test for ECR-1 (a width-0 recovery whose `B-1` output is an attacker commitment); (3) a VM test for
MERGE-1 (merge with the consumed masters' satoshis sent to the spender's output); (4) decide whether public
`migrateRecords` should require a committed upgrade target (MIG-1).

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

### DYN-1 (CRITICAL, source-traced; direct and route builds) A dynamic write skips all chunk verification when the spender passes a base below -1

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

Route extension (CONFIRMED 2026-10-17 by a read-only compile probe): the message-bus route's own ABI takes
`__internal__dynamicChunkInputBase` as an ordinary push. A `compileString(..., { messageBus: true })` of a contract
with `string name` and `function setName(string n)` yields route inputs
`batchBlob, __internal__activeVerifierIndex, __internal__dynamicChunkInputBase, __internal__dynamicChunkOutputBase`.
`compiler.ts:11638` forwards that parameter unchanged into every handler clone's argument vector, and a clone is a
plain (non-route) function, so its `isCompilerMessageBusRoute` is false and its `A$len` header is written from the
pending value while `emitDynamicWriteVerification` takes the same `< -1` skip (`GenerateTargetTraversal.ts:40494-40516`).
The route's dormant-header arm (`35299-35318`) does not even apply to the clone. Nothing ties the witness to the
binding digest (`compiler.ts:12880-12882` hashes the manifest, base, row count and local batch). So the same exploit
works through a route row, and the default `auto` build keeps the direct entry as well (the ABI above still lists
`setName` with the witness). This makes DYN-1 reach every stateful build, not only direct ones.

### ROUTE-READ-1 (CLOSED 2026-10-17 after tracing; kept for the record) A route's sorted-map read returns the default when the spender marks it inactive

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

### FRAMED-CONT-1 (HIGH, source-traced; framed composition) A standalone framed spend that handles no value leaves its containers unprotected

Attacker: any caller of a public framed function that neither accepts value nor sends it (a plain state update or
admin setter). Shape: spend that master **standalone** (no validator input), co-spend the contract's satoshi
container with `flag = 1`, and/or a token container, and send the container's BCH or tokens to the attacker.

Why nothing refuses it:

- A framed deployment builds its containers **without** a master lock (`directConventionMasterLock` returns
  `undefined` for `composition.convention === 'framed'`, `packages/solidcash/src/stateful/covenant-helpers.ts:286-288`,
  used at `477` and `898`). The container covenant therefore omits `directMasterOutputPin`
  (`packages/utils/src/state.ts:2479`, `2579`); its master arm checks only the authority lock, minting capability and
  category, so any output shape is allowed.
- The master's container accounting is only `valueChecks` (`packages/solidc/src/framed/master/master-head.ts:1070-1155`),
  emitted only `if (this.handlesValue)` (`459`), where `handlesValue = acceptsValue || sendCount > 0 ||
  paysThroughCalls` (`381`). A body with none of the three calls `assertZeroValue()` (`659`).
- The frame's `value` is a **witness field** the reader leaves (`master-head.ts:16`), not a value derived from
  container growth, so `assertZeroValue` only requires the attacker to write zero there.
- `assertStandalone` requires `callCount == 0` and frame kind `ROOT` (`973-978`), which a plain setter satisfies, so
  the no-validator arm is reachable for exactly the functions that handle no value.
- The direct convention's scans are excluded for a framed master: `scansSatoshi = !this.framedMaster && ...` and
  `scansForeign = !this.framedMaster && ...` (`GenerateTargetTraversal.ts:10252-10259`).

The validator does cover this: V7's `checkContractValue` sums every container input/output
(`packages/solidc/src/framed/validator/checks.ts:558-590`). A standalone frame attaches no validator
(`assertNoValidator`, `master-head.ts:1189-1194`), so the exposure is exactly the no-validator path. The same
applies to a foreign token container: the keep rules are direct-only and V7 sums only the satoshi container.

Impact: theft of the contract's BCH balance and of any custodied foreign tokens, in a framed contract that holds
them and exposes at least one non-value function. This is DX-1/DX-2's shape on the framed backend, which the direct
fix (the container output pin) does not reach.

Fix direction: in `standaloneFrameChecks`, always require container growth `>= 0` (not only when `handlesValue`),
and add a foreign-token keep for a framed standalone spend, or attach the validator to every spend. Omitting the
master lock from the container is what lets it survive an upgrade at a new lock, so the master-side check is the
right place.

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

### WT-1 (LOW, hardening) The outside-layout pin now admits every record lock unconditionally

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

### WT-2 (LOW, revised from MEDIUM) The outside-layout walk's exit test is relative while its entry test is absolute

`a56314f36` changed the walk's entry test to `i >= master + blockSize` (absolute) but left the loop's exit test as
`i < blockSize` (relative; `emitPreserveOutsideLayoutOwnMutable`, the `OP_DUP <blockSize> OP_LESSTHAN OP_UNTIL`
tail). With the master at absolute index `m > 0`, inputs in `[blockSize, m + blockSize)` are skipped by the entry
test, and inputs `< blockSize` are never visited at all. The walk therefore no longer covers an own-category mutable
input placed before the master, and the attacker chooses `m` by ordering inputs (the master index is `OP_INPUTINDEX`
and no rule pins it to 0).

What keeps it from being exploitable, traced 2026-10-17:

- An extra entry of a collection the function does not name fails `emitFixedSlotCollectionCount`
  (`GenerateTargetTraversal.ts:52024-52031`): the input count at the collection address is pinned to the number of
  named slots (zero).
- An extra data record fails `emitDataRecordCensus` (`52036-52041`): the data-lock input count is pinned to the
  accessed-record count. `emitPreserveUnreadDataRecords` pins the accessed ones at their offsets.
- Chunks of a dynamic variable the function does not write are pinned 1:1 by `emitUnwrittenChunkCensus`.
- Chunks of a written variable and value chunks are covered only by the dynamic-write verifier, which is DYN-1 and
  not this finding.
- Replacing a named slot's UTXO with a different genuine entry fails that slot's key-hash or bracket check.
- The output scan's `emitMutableOutputAllowed` still refuses an own-category mutable output at an arbitrary lock
  unless a mutable input at that same lock and category exists, which limits what can be created at all.

So WT-2 is a real boundary defect and a loss of defense-in-depth, with no reachable theft found on this tree. Fix
it by iterating every input and skipping only `[m, m + blockSize)` (exit on `i == 0`), which also removes the
reliance on the counts above.

## Coverage on the 2026-10-17 pass

Read in full or in the cited functions: the outside-layout walk and its census neighbours (WT-1/WT-2), direct and
route sorted-batch transitions (`GenerateTargetTraversal.ts:33496-34360`), upsert gating (`28615-28710`), value-chunk
pinning (`28353-28530`, `27514-27575`), split/merge (`50588-50980`), upgrade self-preservation and data-NFT
migration (`49265-49300`, `49770-49961`), the SIGHASH_ALL fence (`15738-15800`), external return-event settlement
(`47870-47990`), `msg.sender` (`53005-53215`), container covenants and their deltas (`utils/src/state.ts:1900-2580`),
the route binding digest and lifecycle modes (`compiler.ts:12230-12535`), the trailing batch width binding
(`32279-32327`), the clone batch-assignment rule (`SymbolTableTraversal.ts:4030-4067`), the SDK signer, and the
block-oracle keeper.

### Surfaces read with no new issue

- Split (`emitSplitCovenantVerification`): the master keeps its LBC, category and capability, value, commitment and
  fungible amount; each new master sits at the same LBC with an empty commitment and a zero fungible amount; and
  `emitSplitMintingCount` pins the transaction-wide minting count to exactly `N + 1`.
- Value chunks (`emitSortedValueChunkPin`, `emitChunkableValueTail`, `emitChunkableValueRead`): the entry tail is
  `len4 || sha256(value) || head28` for a long value, the write pins the exact output set by chunk address, count and
  per-index commitment `slot || digest || pushdata(i) || slice`, and the read verifies the supplied witness against
  the stored digest. A duplicate, missing or extra chunk fails the count.
- Route signature fence (`compiler.ts:11321-11335`): every transaction-signature leaf parsed from a batch must end
  in `0x41` or `0x61`, so `SIGHASH_NONE`/`SINGLE` cannot authorize a route row.
- Upgrade data-NFT migration: re-mints only at the replacement-bound canonical data-NFT covenant. Values are not
  byte-compared (the replacement layout is opaque), which is sound because the authorizer's `checkSig`/
  `checkMultiSig` calls in an upgrade/deploy/split/merge body are fenced to base sighash `ALL`
  (`fencesUpgradeSignatures`, `15745-15756`).
- External return events (`emitExternalReturnEventVerification`): the return carrier must carry the callee's
  category, `none` capability, zero fungible amount, `OP_TRUE` locking bytecode, and at most 1200 satoshis.
- `msg.sender` (`emitMsgSender`, `emitMsgSenderMintingVerification`): a nonzero category must name exactly one
  co-spent minting input (not the executing input), and the sender is that input's lock. A zero category falls back
  to `tx.origin`.
- Trailing batch width (`emitBatchTrailingCountBinding`): `__internal__vmapBatchTrailingCount` is recomputed from
  the topology witnesses and compared, so it is not a free coordinate.
- `SignatureTemplate`: defaults to `ALL|UTXOS`, rejects unknown bits and `UTXOS|ANYONECANPAY`, and warns on weak
  modes; the atomic message-bus path requires hash type `1`.
- Ordinary `upgrade` master path: the full category with capability is preserved and the output lock equals the
  witness `__internal__upgradeBytecode`; trust in that witness is the upgrade entry's own authorization.
- Block oracle keeper (`oracle/blockOracleUpdater.ts`): updates are signed `SIGHASH_ALL|UTXOS` with the keeper key
  the oracle commitment already names; the n->hash mints spend the keeper baton. No new issue.
- `d60f17ae9` (container master pin compares 32 bytes): an unnamed container is still held to its full category by
  `emitForeignContainerKeep` (`51779-51783`), so a capability downgrade on a call that names no container is
  refused. A named container is held by its transfer covenant.

- Framed container exposure confirmed at the single-master rule: `requireSingleMasterScript` counts only inputs whose
  token category equals the master's pin (`frame-tail.ts:710-740`), so a tokenless satoshi container or a foreign
  token container is not excluded from a standalone spend. This is the last premise FRAMED-CONT-1 needed.
- `StatefulContract.upgrade`'s entry-migration loop creates its fee funder with `provider.addUtxo`
  (`packages/solidcash/src/stateful/sc-upgrade.ts:178-189`). That method exists only on the mock provider, and it is
  called unguarded, so an upgrade of a contract with collections cannot run against Electrum/regtest/BCHN. This is a
  liveness gap in the migration path, not a fund-loss path. The loop also re-creates the master at the **old** lock
  each step (`sc-upgrade.ts:193-201`), so an interrupted migration leaves part of a mapping at the new-bound entry
  covenant, which the old code cannot read (keys read as absent). Fold this into MIG-1's liveness note.
- `migrateRecords` hardcodes the entry at absolute input/output index 1. The SDK's layout co-spends only the
  master (0), the entry (1) and a funder (2), and does not co-spend the contract's data NFTs, so index 1 holds the
  entry even in a contract with scalar state; the positional coupling is consistent today. It is fragile if a future
  migration also co-spends data NFTs (to re-encode them), which would move the entry. Advisory, not a vulnerability.
  A migration that does co-spend a data NFT at 1 fails closed: no selector arm matches the old entry covenant.
- `selfdestruct` does not pin the satoshi container or any token container: `emitValuePreservation` and
  `scansSatoshi` are skipped for it, and message-bus mode 3 requires only the master/prefix slot values to be
  preserved. The SDK's `destroy` does co-spend them (`packages/solidcash/src/stateful/sc-destroy.ts:369-427`). A
  caller that omits them destroys the master and leaves the containers permanently unspendable, because their
  covenant's master path needs a master of the category. That is a self-inflicted liveness hazard for the
  authorized caller (and an honest client is fine), worth a doc warning next to `selfdestruct`.
## Threat-model assumptions worth documenting in user docs

- An `upgrade`/`deploy`/`split`/`merge` body that authorizes by `checkDataSig`, a hash preimage, or a raw
  outpoint comparison instead of `checkSig`/`checkMultiSig` does not get the sighash fence. The compiler cannot
  fence a check it does not recognize. The data-NFT migration's value pinning then depends on that other
  authorization binding the outputs.
- `migrateRecords` is not a lifecycle modifier for the fence (it needs none, since it preserves commitments), but a
  body that also re-encodes values would.
- A public lifecycle entry (`split`, `merge`, `migrateRecords`, `upgrade`) is authorized only by its own body.
  The compiler emits the topology checks, not an access policy.

## Additional surfaces read (2026-10-17, later pass)

- Event settlement (`emitEventCovenantVerification`, `emitNotTakenEventSlotBinding`,
  `emitOwnCategoryImmutableNftOutputPin`, `GenerateTargetTraversal.ts:45694-46052`, `50191-50320`): for every
  emitted event the output's commitment and event covenant lock are pinned; a conditional emit that did not run
  requires the reserved index to hold an **empty commitment** (or to be past the output count); a runtime loop's
  event span comes from compiler-tracked temps, not witnesses. The SEC-15 per-slot form binds every unreached
  ordinal of a graph handler's window. No new issue.
- `unsafe` tiers (`SymbolTableTraversal.ts:5335-5373`): tiers 1 and 2 forbid state writes, entries, events,
  transfers, token containers, external calls/reads, deploys, and out-state reads, so only master/data-NFT
  preservation remains to be checked. Advisory: `unsafe` with no argument is tier 0 (no covenant checks at all),
  and the compiler accepts it silently; user docs should say so next to the modifier, since omitting the argument
  is easy.
- Token-container transfers (`emitTokenContainerTransferCovenantVerification`, `54342-54480`): the output at the
  reserved `tcTransfer` slot is pinned to the call's `to`, amount, category (display→internal reversed, capability
  handled) and, for NFTs, the commitment. The debit side is the container covenant plus `DX-2`'s preservation.
- `migrateRecords` positions (`emitMigrateRecordsEntryMigrationCheck`, `50042-50110`): the check uses absolute
  input/output index 1 while the master is located by `emitMasterInputIndex`. For a direct call with the master at
  index 0 the layout is exact. With a master at a higher index the check still only migrates a genuine old entry
  into a replacement-bound entry at global index 1, with commitment, category and value preserved, so it is a
  layout assumption rather than a hole. Advisory: state the master-at-0 layout requirement for `migrateRecords`.
- `unsafe(0)` / merge / split / `migrateRecords` authorization: the compiler emits topology rules, not an access
  policy. A public lifecycle entry is exactly as strong as its body's `require`s.

## Final status of this pass

Confirmed by source tracing: DYN-1 (critical), ECR-1 (critical), FRAMED-CONT-1 (high, framed), MERGE-1 (medium-high), CONT-1 (medium), MIG-1
(medium, design), WT-2 (medium), KCHAIN-1 (low on consensus rules; forged-digest primitive under the mock's
commitment limit), WT-1 (low). Closed after tracing: ROUTE-SKIP-1, ROUTE-READ-1. No VM run was made for any
finding; DYN-1, ECR-1, FRAMED-CONT-1 and MERGE-1 are the four that most need one. This pass read no website, bench, fixture, or
tooling code.

## Fix status (implementation pass, 2026-10-17)

- DYN-1 (direct and route entries): FIXED. `emitDynamicWriteVerification` refuses a frame whose
  `__internal__dynamicChunkInputBase` is below -1 (`-1 OP_GREATERTHANOREQUAL OP_VERIFY`) before any chunk check, so
  a forged chunk cannot ride a sentinel base. Tests:
  `packages/solidcash/test/e2e/AuditDynamicBaseSentinel.test.ts` (honest direct write/read settles; forged base +
  forged commitment refused) and `packages/solidcash/test/e2e/AuditRouteDynamicBase.test.ts` (a routed writer row
  with a forged base and forged chunk is refused, while the honest routed write and an honest read-only sentinel
  lane settle). The message-bus route lane is closed by an authenticated activity flag: `synthesizeMessageBusRoute`
  sets `__message_bus_dynamic_write_active = 1` only inside the selector branch of a handler whose footprint writes
  dynamic state, and the route frame requires `base >= -1` when that flag is set. A batch that selects no writer
  keeps the SDK's read-only sentinel (`-(base + 3)`) and its inactive skip. Handler clones that write dynamic state
  (`messageBusCloneSourceKey` plus pending writes) take the same strict refusal.
- ECR-1: FIXED without a side-car protocol fork. The consuming contract now requires B3's predecessor input to reveal
  the M covenant and the input before it to reveal the A covenant (`requirePredecessorCovenant` in
  `GenerateTargetTraversal.ts`), and the loop path requires the M shared lock when B is B3. The 2-way B/B2 paths are
  unchanged because their result is a pure function of the call's own arguments. Test:
  `packages/solidcash/test/e2e/AuditEcrecoverMiddleInput.test.ts` (an arbitrary input standing in for M is refused;
  the honest width-0 recovery settles). Verified the pre-fix build ACCEPTS the substitution.
- FRAMED-CONT-1: FIXED for the exposed container. A standalone framed frame that handles no value now requires
  satoshi-container growth `>= 0` in both the pure standalone arm and the composed master's no-validator arm
  (`assertContainersDidNotShrink`, `master-head.ts`). The framed codegen has no token-container surface: no
  `tokens[...]` access is lowered for a framed master and the framed SDK ships no token-container builder, so the
  reachable container is the satoshi one; a framed token container would need a new codegen path before a keep rule
  could apply to it. Test: `packages/solidc/test/framed/StandaloneContainerGrowth.test.ts` (master ASM carries the
  rule).
- MERGE-1: FIXED. The survivor output must now carry the summed value and fungible amount of every consumed master.
  Direct merges sum `OP_UTXOVALUE`/`OP_UTXOTOKENAMOUNT` over the consumed tail and require
  `survivor_out.value == survivor_in.value + sum` and `survivor_out.tokenAmount >= survivor_in.tokenAmount + sum`
  (`emitSumConsumedMasters`, `emitMergeCovenantVerification`). The message-bus mode-2 lifecycle performs the same
  sums in its synthesized route verification, and the survivor's ordinary master-value preservation is relaxed to
  `>=` only on a mode-2 lifecycle owner so the exact route sum remains the binding rule. The SDK layouts moved with
  the covenant: `StatefulContract.merge`, `sc.call ... withConsumedMasters`, and
  `messageBus.compose({ lifecycleMerges })` all place consumed satoshis on the survivor (compose keeps tokenless
  zero-value tail outputs so input/output indexes stay aligned). Tests:
  `packages/solidcash/test/e2e/AuditMergeConservation.test.ts` (honest merge settles with the summed value/FT at
  the survivor; the same captured transaction with the consumed satoshis moved to change, or the surplus FT moved to
  change, is refused at input 0) and `KernelAtomicMergeLifecycle.test.ts` /
  `KernelAtomicMergeReadLifecycle.test.ts` (routed merge(2) settles, survivor FT consolidated).
- CONT-1: FIXED. `emitForeignContainerKeep` now requires the unnamed container's output NFT commitment to equal its
  input commitment, in addition to lock, full category and amount. Test:
  `packages/solidcash/test/e2e/AuditContainerCommitment.test.ts` (a rewritten commitment is refused, the identical
  spend settles). Verified the pre-fix build ACCEPTS the rewrite.
- WT-1/WT-2: FIXED. Direct entries now walk every input and skip only `[master, master + blockSize)`, and admit
  only the record families the call rewrites (its loop collections, its written dynamic variables, and its value
  chunks). The exit test is `i < 0`, so inputs below a nonzero master are inspected; the upper arm keeps
  `i >= master + blockSize`. Route participants keep the previous relative walk and full family list because their
  record block and dynamic band are settled by the route verifier and the transaction carries the verifier/sibling
  blocks below the master. Tests: `AuditOutsideLayoutRecord.test.ts` places an own-category mutable record at an
  arbitrary P2SH32 lock at input 0, with the master shifted to input 1 through the real stateful call builder: a
  rewritten commitment is refused at the master, and the same spend with the record preserved settles.
  `CollectionReadInputCensus.test.ts` (6 cases) covers records outside the block at counted locks,
  `AuditContainerCommitment.test.ts` covers CONT-1, and the existing chunk/container suites pass.
