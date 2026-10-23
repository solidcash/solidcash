# Security audit 2026-10-16 (living document)

Status: complete for the 2026-10-16/17 pass. The findings are kept in discovery order; the section
"Fix pass 2026-10-22" at the end is the current answer, and supersedes the status lines above it.

Fix status: DYN-1, ECR-1, FRAMED-CONT-1, MERGE-1, CONT-1, WT-1 and WT-2 are fixed with the tests named below.
KCHAIN-1, the C3 residual, AUTHHEAD-1's contract paths, G0 and the 2026-07/2026-10 LOWs still open in code were
fixed on 2026-10-22; MIG-1 stays open (privileged). See "Fix pass 2026-10-22".

Summary of the pass: DYN-1 (CRITICAL, direct and route builds), ECR-1 (CRITICAL, fixed with a VM test),
FRAMED-CONT-1 (HIGH, framed), MERGE-1 (MEDIUM-HIGH), CONT-1 (MEDIUM), MIG-1 (MEDIUM, design),
WT-2 (LOW), KCHAIN-1 (LOW on consensus limits), WT-1 (LOW).
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
- Baseline: `archive/docs:docs/security-reaudit-working-tree.md` (read at `056f4036b`), `security-audit-2026-10-15.md`,
  `SECURITY-AUDIT-2026-10.md` and `2026-10/`. Ids from those files are not re-reported unless
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
  `GenerateTargetTraversal.ts`). The revealed redeem is also bound to the predecessor's actual locking bytecode:
  the script recomputes the P2SH32 lock `OP_HASH256 hash256(redeem) OP_EQUAL` and compares it to
  `OP_UTXOBYTECODE`, so a bare input that merely publishes the genuine redeem bytes in its unlocking is refused.
  The loop path requires the M shared lock when B is B3. The 2-way B/B2 paths are unchanged because their result is
  a pure function of the call's own arguments. Test:
  `packages/solidcash/test/e2e/AuditEcrecoverMiddleInput.test.ts` (both the empty-unlocking substitution and the
  public-push substitution are refused; the honest width-0 recovery settles). Verified the pre-fix build ACCEPTS the
  substitution.
- FRAMED-CONT-1: FIXED. A standalone framed frame that handles no value requires satoshi-container growth `>= 0` in
  both the pure standalone arm and the composed master's no-validator arm (`assertContainersDidNotShrink`,
  `master-head.ts`). The framed token container covenant (built without a master lock) now keeps its custody itself:
  `framedTokenContainerKeep` requires the output at the container's index to recreate its lock, full token
  category, fungible amount, NFT commitment and satoshi value. Tests:
  `packages/solidcash/test/framed/AuditFramedContainerRedirect.test.ts` drives the shipped framed call harness: a
  captured no-value call with the satoshi container co-spent and its value redirected is refused at the master,
  while the same call without the container settles; a framed token container co-spent with the captured master
  unlock is refused when its tokens move to the caller's lock and accepted when recreated at its index.
  `packages/solidc/test/framed/StandaloneContainerGrowth.test.ts` also carries the master ASM rule.
- MERGE-1: FIXED. The survivor output must now carry the summed value and fungible amount of every consumed master.
  Direct merges sum `OP_UTXOVALUE`/`OP_UTXOTOKENAMOUNT` over the consumed tail and require
  `survivor_out.value == survivor_in.value + sum` and `survivor_out.tokenAmount >= survivor_in.tokenAmount + sum`
  (`emitSumConsumedMasters`, `emitMergeCovenantVerification`). The message-bus mode-2 lifecycle performs the same
  sums in its synthesized route verification, and the survivor's ordinary master-value preservation is relaxed to
  `>=` only on a mode-2 lifecycle owner so the exact route sum remains the binding rule. The SDK layouts moved with
  the covenant: `StatefulContract.merge`, `sc.call ... withConsumedMasters`, and
  `messageBus.compose({ lifecycleMerges })` all place consumed satoshis on the survivor; compose keeps a tokenless,
  dust-paying output at each consumed input index, funded from the fee tail's change (BCHN relays at most one
  OP_RETURN output, so zero-sat OP_RETURN placeholders are not usable for N>1). A merge whose funding inputs cannot
  cover the fee now throws instead of building a zero-fee transaction. Tests:
  `packages/solidcash/test/e2e/AuditMergeConservation.test.ts` (honest merge settles with the summed value/FT at
  the survivor; the same captured transaction with the consumed satoshis moved to change, or the surplus FT moved to
  change, is refused at input 0), `AuditMergeRouteDust.test.ts` (the routed merge composes and relays under
  `enforceDust: true` with at most one OP_RETURN and every output above dust; a captured routed merge whose consumed
  value or surplus FT is moved to change is refused), `SplitMerge.test.ts` (an empty funding list is refused), and
  `KernelAtomicMergeLifecycle.test.ts` / `KernelAtomicMergeReadLifecycle.test.ts` (routed merge(2) settles,
  survivor FT consolidated).
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

## Token container pass (2026-10-20)

Found while completing framed token containers (`docs/framed/DECISIONS.md` D37 to D40). Each fixed finding names the
test that pins it. Where an entry says the pre-fix code accepts a refused transaction, that is read from the code: the
tests were not run on the pre-fix commits. CONT-FLAG-1 and CONT-CAT-1 never shipped in a release.

- **CONT-FLAG-1** (HIGH; introduced in `ba6296865`, fixed in `916bc9ea2`, unreleased). A framed master owns the
  containers whose unlocking starts `<its index> OP_1`, but the container's `OP_IF` took the master path for any
  non-zero flag, so a container spent with flag 2 named a master that did not claim it and no master checked it.
  The accounted container now takes only the master path with the flag exactly 1. Test: `BchNativeFramed.test.ts`
  (the flag-2 drain is refused by the container itself; the flag-1 one by the master).
- **MERGE-PATH-1** (HIGH; direct, kernel and framed). The token container's merge path (flag 0, no master) pinned
  lock, value, fungible amount and full category, but no NFT commitment: anyone could rewrite a custodied mutable
  NFT's commitment, or spend a container holding a minting NFT and mint its category in the same transaction. FIXED
  in `efba0f1ef`: no token container has a merge path. Test: `MinimalNativeToken.test.ts` (a `<0> <0>` spend of the
  reserve is refused at the container).
- **CONT-1 residual** (MEDIUM). CONT-1's fix pinned an unnamed container's commitment, but a minting NFT kept in
  place still mints. FIXED in `306318a0b` (direct keep) and `19eefe1d6` (framed keep): neither keeps an unnamed
  minting container. Test: `AuditContainerCommitment.test.ts` (an unnamed minting container co-spent to mint is
  refused at the master).
- **GROWTH-1** (CRITICAL for a framed BchNative token). A framed read of `tokenAmount` summed every container the
  transaction spends, and `outState` every output at the lock, so two `wrap` frames of one token (a contract calling
  `wrap` twice) each credited one deposit. FIXED in `7d0571259`: a frame reads only the containers its master owns,
  and counts newly created containers only when it is its contract's only master. Test: `FramedTokenCallee.test.ts`
  (a vault's `depositTwice` with one deposit is refused and its ledger does not move).
- **GROWTH-2** (HIGH; message bus). A batch runs every row in one input, so two rows of a handler crediting the
  reserve's growth counted one deposit twice; BchNative's `wrap` became route-eligible in `c919a1686`. FIXED in
  `d0fc11486`: such a handler, its internal calls included, runs at most once per batch. Test:
  `KernelStateKeyedTokenContainerCompose.test.ts` (one row settles; two rows against one deposit are refused; the
  pre-fix route accepted them).
- **GROWTH-3** (HIGH for a direct contract that declares `split`). The same transaction-wide read reached a direct
  contract forked into several masters, each spent with its own call. FIXED in `564d82fe4`: a contract that declares
  `split` reads amounts per master, as the framed convention does; one without `split` keeps one master and its
  bytecode is unchanged. Test: `ThreadedTokenReserve.test.ts` (a thread wraps into a new container, wraps again into
  it, and unwraps). The bus graph shape was traced and cannot arise: the bus interns one participant input per
  locking bytecode and batches that contract's rows in it (`compose-plan-graph.ts`), a growth-reading handler runs at
  most once per batch (GROWTH-2), and a second master of one contract exists only through `split`, which now reads
  per master. Test of the two-thread case (`8c4fb67a7`, the same file): a thread's `wrap` that opens a new container
  settles alone and is refused with the other thread spent and recreated beside it, while a `wrap` growing a container
  the thread owns settles both ways. An earlier attempt at this test placed the second thread's output before the
  container's recreation, shifting it off its index, which is why it refused both.
- **NAMED-MINT-1** (HIGH; direct). A direct call that names a container holding a minting NFT spends it, and nothing
  bounded what else the transaction minted of that category. FIXED in `3a6c3d143`: every output outside the slot's
  lock that carries the category holds no fungible amount and is one of the NFT sends the call made from the slot.
  Test: `AuditDirectMintBound.test.ts` (a read that keeps the minting container settles; the same transaction with an
  NFT of the category minted beside it is refused at the master, which the pre-fix code accepts). As first landed the
  bound ran after container preservation, which consumes the transfer witnesses, so a function with a conditional
  `transferNft` did not compile; `13b90f8fc` runs it first, and a bus route, whose sends sit in its token-transfer
  windows, bounds the mints by position instead: every output outside the lock carrying the category sits in a window
  or in its runtime effect span, with no fungible amount. Test: `GraphTokenSitePackingSecurity.test.ts`. That bound
  walked every output once per container, which put the callee of a 517-input kernel composition ("authenticates NFT
  capability, commitment, recipient, and mixed-container settlement") at 8.82M of its 6.65M operation budget; the
  route now runs it in the output pass of its slot scans, whose skip stops at any output with a token (callee 5.88M).
  The kernel verifier's census does not cover this: it counts no token output paired with a tokenless input other
  than the dummy funder. No test mints beside a route's named minting container.
- **CONT-CAT-1** (CRITICAL for a framed contract paying tokens; introduced in `ba6296865`, fixed in `80c517ca7`,
  unreleased). A framed master's owned scan summed the amount of every container at the lock whose unlocking names
  it, whatever its category. Anyone can put a token of another category at that lock, so a builder could name such a
  container in the master's block, grow it in place with tokens of no value, and draw the same amount of the real
  category out of the master's other containers to an output of its own, conservation holding on the sum. The owned
  scan now requires every owned container to hold the slot's category. Test: `FramedTokenNft.test.ts` (the same
  in-place growth settles at the master as a deposit of the category itself and is refused for another category,
  which the pre-fix code accepts).
- **NFT custody v2** (design, never shipped). Dropping D38's rule that no outside NFT of the category is an input,
  so that NFT deposits settle beside NFT sends, lets a builder make a send from an NFT of its own and take the
  container's mutable NFT, which the count of released NFTs does not see. D39 closes it: each send is made from a
  named container at the end of its frame's block, and every NFT of the category leaving the lock must be one of the
  sends. Test: `FramedTokenNft.test.ts` (a mutable NFT makes an immutable send; the same transaction with the mutable
  NFT also paid to an output no send pins is refused at the master).

## Outside-declared events and the container destroy path (2026-10-21)

Found while bringing the SDK e2e suite back to green; mocknet only.

- **EVENT-SCOPE-1** (HIGH; direct, introduced before 2026-10-20). A contract stateful only because it emits an event
  declared outside it (file level, library, interface) is marked by `currentContractEmitsEvent`, its
  `eventDefinitions` being empty. The subroutine-use probe and the entry-body and `emitFunctionDefine`
  sub-traversals were handed `eventDefinitions` but not that mark, so they compiled such a contract as stateless: an
  OP_DEFINE'd entry body of a multi-entry contract lost its covenant checks. FIXED in `88bb5ab35` (all three copy the
  mark). Test: `Events.test.ts` (the file-level form compiles byte-identical to the contract-level one, delegate
  variant included).
- **EVENT-SCOPE-2** (HIGH; direct and bus). SEC-10/SEC-11's forged-log pin was scoped to contracts that declare an
  event, so a stateful contract emitting only outside-declared events (the OpenZeppelin `IERC20` pattern) had none,
  and anyone could add an own-category immutable NFT that reads as its log. FIXED in `d487efe87`: a contract has events
  when it declares one or emits one, for the pin, the split/merge/unsafe pin and the message-bus decisions. Tests:
  `EventForgedLogScope.test.ts` (byte-identical to the contract-level form), `FileLevelEventNftForgery.test.ts` (a
  forged event NFT beside such a call is refused). Residual: a stateful contract whose file declares an event it
  never emits stays unpinned, though the artifact lists that event.
- **Container master pin vs destroy** (liveness, not a weakening). `b1ef5d064`'s pin on a direct container's master
  path read the output at the container's index, which a one-output `selfdestruct(addr)` transaction lacks, so
  destroying a contract with a container failed. `3fc5969bd` applies the pin whenever an output carries the master's
  minting NFT and skips it only when no master is recreated, the destroy path the master's covenant governs. Tests:
  `SelfdestructDestination.test.ts`, `X46CommitmentWriter.test.ts`. A destroy split into batches still pins a
  container placed in an intermediate batch (deferrals.md). The arm is now emitted only where a master can retire
  (`containerMasterRetires`: a selfdestruct entry, and no delegate entry or delegatecall, since a delegate binds its
  proxy's containers without seeing the proxy's entries); every other bound container is the pre-`3fc5969bd`
  covenant again. A proxy with a selfdestruct entry keeps the plain pin, and the SDK refuses an upgrade whose
  replacement takes the other container form, because the old covenant re-mints in its own.


## BCMR identity outputs and look-alike NFTs (2026-10-21)

Found while replacing the BCMR identity policies with the authhead contract (`docs/framed/DECISIONS.md` D46); read
from the code, nothing run beyond the authhead's own tests.

- **AUTHHEAD-1** (LOW, metadata lookups only; mitigated). The authhead's address and its mutable NFT of C are meant to
  name a category's identity. Several contract paths can mint a mutable NFT of C at a lock their caller chooses, so a
  look-alike with any commitment can sit at the authhead's address:
  - the direct C3 count's recorded residual (`SECURITY-AUDIT.md`, C3): a record co-spent on a master-authorized path
    that pins nothing (data flag 2, entry or chunk flag 1) is re-emitted at another lock, and the count still
    balances. Delegatecall proxies count the same way;
  - the authorized lifecycle entries `upgrade` (the master goes to the caller-supplied bytecode), `selfdestruct` (only
    the minting count) and `split`/`merge` (only minting outputs pinned);
  - the `unsafe` tiers.
  A look-alike is never on the authchain, which follows outpoints (CHIP-BCMR), so BCMR clients ignore it. The SDK's
  `resolveIdentity` proves a candidate by walking its authchain back to the genesis, and the authhead admits exactly
  two inputs (itself and a token-free owner coin), so no spend of it can co-spend a master and duplicate its NFT.
  Tests: `BcmrAuthhead.test.ts` (a served look-alike passed over; a third input, a token-carrying owner coin and every
  other move of the NFT refused). Residual: a tool that names an identity by address alone, without the chain, can be
  misled. A full fix needs the C3 per-NFT pin, which the residual already names.
- The framed convention was checked for the same: a frame pins every mapping node and dynamic chunk it reads or writes
  to its covenant at input and output (spec T45; `emitFramedNodeLockCheck`, `emitChunkRecordInputCheck`,
  `emitChunkRecordOutputCheck` in `GenerateTargetTraversal.ts`), so its calls cannot plant one. A node a frame declares
  kept but never reads or writes gets only the index-and-view check from that frame, as the comment above
  `emitFramedSegmentClose` records.

## Fix pass 2026-10-22 ("fix all vulnerabilities")

The user's request after the D46 authhead work. Every open finding in the ledgers was inventoried, the ones still open
in code were fixed with a test each, and the closing gates ran once on mocknet at the commit named below. Each test
named here ran on the landed tree; where an entry says the pre-fix code accepted a refused transaction, that was run
once before the fix unless it says "by reading".

### Closing gates (mocknet, once)

At `ac6e74d5b`: build; utils 525/525, testing 116/116, solidhat 71 (1 skipped), testing-suite 27/27; a cold
marketplace compile and the marketplace ladder 66/66 (2,179 s). The compiler (7 of 7,427), SDK e2e (6 of 3,794) and
SDK (3 of 6,172) suites failed 16 tests, all from this pass, fixed on master after it:

- Three honest contracts no longer fit the 10,000-byte per-input limit: UniswapV2Factory's `createPair` (89 B over),
  a message-bus Publisher (65 B) and a pooled compose callee (29 B). `8549edfc4` and `fe8b689d7` (below, under C3).
- A Tether staticCall failed in the SDK's return probe (TETHER-VIEW-1, `fcbd58a09`).
- Three tests asserted what the pass changed on purpose: the selfdestruct bound (SBE-20), the G0 head (FunctionSplit),
  and the delegate build's refusal of non-delegate entries (Delegatecall, which now runs `authorize` on the standalone
  artifact; `packages/solidc/docs/delegatecall.md` updated). `5d7aa18de`.
- Size and cost pins moved by the C3 record pin's intended cost: the direct-path hashes, ScalarJournal, the VMap
  array read, MinimalNativeToken, the bus verifier size and the two-party capacity readings (`5fdf8169c`, `3cff97dec`).

Each fix ran its own tests once with its neighbours: UniswapV2FactoryLiteral, KeccakChainSidecar, AuditC3CountPath,
AuditC3BusCensusRoute, AuditC3BusParticipant, AuditC3BusGraphParkedPin, KernelDirectNestedArrayPush,
TetherNativeToken, BranchLocalExternalCall, Delegatecall, and AtomicMessageBusCompose (40/40). The ladder did not
rerun: the marketplace corpus compiled cold at the final master is identical to the one it ran, field for field except
`updatedAt`.

### Fixed

- **C3 residual, count path** (CRITICAL class; `e33cbd7cb`, folded into the count in `c75c56778`). A function the
  own-category count covers had only that count, so beside any such call a caller rewrote a record it does not name
  (data flag 1) or destroyed it (flag 2) and minted a mutable NFT of C anywhere, the authhead's lock included. Every
  own-category mutable input outside the master and the data band the auto covenant settles now comes back at its own
  index with its lock, commitment and category. Test: `packages/solidc/test/AuditC3CountPath.test.ts`.
  `migrateRecords` leaves its moved entry to its own check, which now pins the master at input 0 (`cd3c4caa4`). The
  fold emitted its pass inline in every counting function, which grew UniswapV2Factory from 9,237 to 9,721 B and put
  `createPair` 89 B over the 10,000-byte unlocking limit; the pinned count is now one shared helper per span and
  verifier lock (`8549edfc4`, 9,265 B). A contract with one counting site carries it inline (+38 B on a one-function
  contract).
- **C3 residual, delegatecall proxy** (`1130af475`, `45411dffa`, `a8a3ba880`). The not-taken path compared commitment
  and category only, so an entry or chunk could return under another lock; a direct delegate on the taken path ran no
  walk over the proxy's records, so a value chunk could be rewritten in place, and consumed under the certified default
  proxy. A forwarded selector could also reach a non-delegate implementation entry, which ran none of the delegate's
  census; those entries are now unspendable in the delegate variant. Tests: `AuditC3ProxyPath.test.ts`,
  `AuditC3DelegateTakenPath.test.ts`.
- **C3 residual, message-bus routes** (`9dd2649d4`, `f431bee36`, `3a210faca`). A route can run with no verifier (a
  standalone `batch`, a local-caller route), and the verifier counts only inside the participant block. Count-path and
  census-path routes now pin every own-category record outside their block, skipping only their own verifier lock, and
  inside the block every record at a slot no executed row claims. Tests: `AuditC3BusParticipant.test.ts`,
  `AuditC3BusCensusRoute.test.ts`. The pins pushed two bus test contracts over the per-input limit, so a bound route
  that is not a local-caller route now skips its verifier by `__internal__activeVerifierIndex`: its binder requires
  that input at the verifier lock, of the own category and mutable, whenever the index is >= 0 on chain (its other
  guard, an outpoint index other than 0xFFFFFFFF, is the SDK's probe marker). A local-caller route keeps the lock
  compare. In a graph-route contract the route pin, the direct plain walks and the pinned counts share one parked
  helper (`fe8b689d7`; test `AuditC3BusGraphParkedPin.test.ts`).
- **C3 graph band, value chunk** (`0b435a977`, found 2026-10-22). A graph route's pin skipped `[master, master + B)` at
  the compile-time block size, while the graph verifier counts records only in the physical block. With the contract
  last and B above the physical size plus the participant count, the fee slot sat between them. A value chunk there
  could be rewritten in place or burned: no census counts a value-chunk lock, and `tx.origin` held once the root
  caller's own coin sat in a balanced pad slot (the mocknet node accepted the rewrite before the fix). The verifier now
  binds `__internal__graphBlockSize` to the participant's actual size instead of its maximum, the SDK supplies that
  size, and the route's pin skips only that authenticated block. Publisher 9,392 -> 9,395 B, the pooled compose callee
  8,875 -> 8,878 B; marketplace artifacts unchanged. Tests: `AuditC3BusGraphValueChunkBand.test.ts`,
  `AuditC3BusGraphParkedPin.test.ts` (compose `718807d02`, band `61e461448`, `b5c6b828b`). A V5 direct-authority root,
  which would skip the root verifier's `tx.origin`, cannot exist: every routed verifier requires each row's owner routed
  and row 0's owner its consumer (`compiler.ts` 13177, 13193, 13240, 13244), and the SDK refuses it (`graph.ts` 2299,
  `atomic.ts` 148, 212, 458).
- **DS-2 class, state read through a subroutine** (`095cb22d4`, `6fdfaad23`). An entry (and a split or merge entry)
  that read state only through an invoked body skipped the data-NFT lock pin, so a mutable NFT of C at a foreign lock
  could be read as state. Test: `packages/solidc/test/AuditDataLockSubroutineRead.test.ts`.
- **G0** (framed, THEFT; `35c998efa`). A forwarding proxy could delegate into any framed contract whose master was its
  category's only one, and in that transaction rewrite its records (owner takeover), drain its containers and mint its
  events; the pre-fix head accepted all three. The master head now requires a delegate callee's category untouched
  (one input, one output: the recreated master; a value master's containers do not shrink). V_TEMPLATE is unchanged.
  Test: `packages/solidc/test/framed/master/delegate-callee-untouched.test.ts`.
- **G1**: already stopped by `2d517da79` (spec T57, DECISIONS D17); D9's "open" was stale.
- **NAMED-MINT-2** (HIGH; direct and bus; `15cc9d8ae`). After an NFT send a named container's keep compared base
  categories only, and the SDK built every honest send that way, burning the contract's minting authority. The keep
  holds a minting input's full category and the SDK mints the sent NFT beside it. Framed already held it (D38, D39).
  Tests: `ContainerMintingSend.test.ts`, `FramedContainerMintingSend.test.ts`, `GraphTokenSitePackingSecurity.test.ts`.
- **NAMED-MINT-1 route side**: tested (`7985a85ac`); the route refused all three mint shapes.
- **AUTHHEAD-1, selfdestruct** (`78a617f08`, `2c3fc9b33`). A direct selfdestruct entry checked only the minting
  count, so its caller could mint a look-alike identity NFT, recreate the master at a lock of its choosing (taking the
  minting baton), or, beside a recreated master, rewrite every record and keep the contract alive (a hashlock-guarded
  destroy rewrote a counter from 0 to 999999). An own-category mutable or minting output is now admitted only in place
  of the same-index input with the same category, capability, lock and commitment; the SDK refuses the ordinary call
  path of a selfdestruct function. Test: `AuditSelfdestructMintBound.test.ts`.
- **EVENT-SCOPE-2 residual** (`958fb0120`, `b1629294b`). The artifact listed file-level, library and imported events a
  contract never emits, which no covenant pinned; it now lists only the events a contract declares or emits (Solidity's
  rule), and a split contract pins forged logs on every shard when its logical artifact lists an event. Tests:
  `EventDeclaredNotEmitted.test.ts`, `SplitEventForgery.test.ts`.
- **Foreign read slots keyed without their target** (2026-07 LOW; `e30f777e6`, `4c41bdac9`, `6a177b545`). Two reads of
  one interface through different addresses shared one slot pinned to the first, so the second was served the first
  target's record (mocknet-proven); this held for input and outState reads. A second target is a compile error, and so
  is a read through an address the function reassigns; one target's outState records share one slot. Test:
  `ForeignReadDistinctTargets.test.ts`.
- **IfConvert** (2026-07 LOW; `6bb226632`, `acfdb8ee2`). An arm writing one entry twice kept only its last write, an
  if without else re-evaluated its condition after earlier predicated writes (`if (m[k]==0){m[k]=1;n[k]=2;}` stored
  n=0), and a merge could reorder an else arm. Test: `IfConvertRepeatedEntryWrite.test.ts`.
- **Semantic LOWs** (2026-07; `8c20f93f9`, `545c84112`, `c92efecf4`, `9e7629e77`). A side-effecting key ran once per
  rebuilt read or write (nested writes, compound ops, field rebuilds, storage-pointer aliases, pushes); it now binds
  once. `__base_` is reserved: a user `__base_A_f` had replaced the generated base copy, so `super.f()` ran the user's
  function. bytesN converts to `address` only explicitly. Test: `packages/solidc/test/SemanticLowHoles.test.ts`.
- **CRYPTO-4 residuals** (`cd3c4caa4`, `ced8e53fa`). The upgrade took the first UTXO at each container address (a dust
  coin there stranded the real container), funded entry migration with the mock-only `addUtxo`, and left dynamic and
  value chunks at the old lock. It now plans every entry and container from full listings, funds from the caller,
  refuses before broadcast while a genuine record would be stranded, and takes `leaveBehind` for donated coins. Test:
  `UpgradeMigrationCompleteness.test.ts`. The compiled upgrade then counted its token-container band at run time
  (`e72f00338`, merged from `feat/bch-native-wrapper`), so every live container coin migrates and the fixed slot count
  the planner held each container to is gone; an argument-keyed container no category names is refused. Test:
  `TokenContainerUpgradeMigration.test.ts`.
- **Unbounded state fields** (`145b0595c`, D49): a `bigint`, or a struct or fixed-size array holding a `bigint`,
  `string` or unbounded `bytes`, was sized at 9 B and packed beside other fields, so a wide value overflowed the
  128-byte commitment at send (fail-closed). Each such field now takes a data NFT of its own, breaking older layouts
  by the user's call; a function reading two data NFTs of a target it does not call is refused at compile time.
  Tests: `UnboundedStateFieldLayout.test.ts`, `ForeignReadDistinctTargets.test.ts`.
- **Batched destroy** (`2d885fa23`): containers go in the final batch; junk coins at container addresses are skipped.
  Test: `BatchedDestroyContainers.test.ts`.
- **KCHAIN-1** (`bd801e060`, `d94df696f`, `865fb9e07`, `d2fdd8fe1`, `ebf77f670`). Each step commits a 64-byte link
  (`X || sha256(state)`), CONT and FINAL take the state only from the previous input under the same lock, and FINAL
  recomputes the block chain X from its argument. The 256-slot trailing band is gone: a 400-byte chained call is 5
  inputs (was 262 and over the BCH 2026 density limit). Test: `KeccakChainBinding.test.ts`.
- **ROUTE-SKIP-1 hardening** (`de1a94233`): clones are flagged `ownRecordsScalarOnly`, and a plain direct general batch
  refuses -2 on a row no alias binds. Test: `packages/solidc/test/RouteSkipGuard.test.ts`.
- **FW-4** (`754673202`): a one-byte argument converts before its push-form checks, so 0x00 and 0x80 settle.
- **OPT-4** (`5e8eb16ef`, `992cb977e`) and **ARITH-10** narrowing (`5e8eb16ef`): registrar ids are reserved; evmCompat
  signed narrowing wraps.
- **Decode malleability** (2026-07 LOW; `08c0a8d97`): the SDK decoders require re-encoding to give the consumed bytes;
  the SDK had read a raw bool 0x01 as true where the covenant reads false. Test: `StateDecodeCanonical.test.ts`.
- **TETHER-VIEW-1** (SDK, latent; `fcbd58a09`). A return probe (staticCall) of a function whose conditional external
  call was not taken kept the planned call base and anchor 0, so the call's check read the master's empty commitment
  and failed before the return was pinned. It surfaced when this pass's size changes repacked the Tether split and put
  `totalSupply` in the root. The probe now states an unreached call as not made, as a send does; covenant unchanged.
- **TOOLS-9, TOOLS-10, SDKFRAMED-9** (`d978e9b9a`): config discovery skips files another user owns or a world-writable
  directory holds (`SOLIDCASH_TRUST_CONFIG_OWNER=1` trusts a mounted tree); a project cache needs `trustProjectCache`;
  resize runs the VM before broadcast. Tests: `AuditToolsBoundary.test.ts`, `AuditSdkframed9ResizePreflight.test.ts`.

### October rows fixed in `d6821a812` (2026-10-13) without a ledger entry

FW-3, DX-3, ARITH-2, ARITH-5, SEM-3, SEM-4, SEM-5, DX-7, FV-1, OPT-1, OPT-2, ARITH-7/8/9/11/12, CRYPTO-6, SEM-7, DX-9
(outside the bus), SDKCORE-1/3/4, SDKFRAMED-3..8, TOOLS-2, TOOLS-5/6/8: each has a hostile test that asserts the
refusal (`packages/solidc/test/SecurityAudit202610*.test.ts`, `packages/solidcash/test/AuditSdkcore*`,
`AuditSdkframed*`, `packages/testing/test/*`), and those suites ran green at the 0.13.1 gates. TOOLS-3/-4 are fixed in
`packages/testing/src/chai.ts` (missing args fail, addresses normalised, events that do not decode fail, `.reverted`
needs VM evidence, `rejectedWith` has no source fallback).

### Not changed, by decision

- Direct-convention call model: presence-based `msg.sender` (F1), no sighash fence on ordinary entries (F2), view/static
  calls in regular mode (kernel alignment). Typed calls binding only the selector, and the held callee-side return
  binding `ce51b6f18`: superseded by call records (D50), below.
- DX-9 in the bus, model B, D48, the opt-in `initializeAs: 'hop'` (SDKFRAMED-2), X1 (D11): user decisions.
- `unsafe` tiers and an authorized upgrade's new code: by design.

### Open

- MIG-1 (privileged): `migrateRecords` still binds a free replacement lock; committing it needs a master-commitment
  protocol, and the state-access path does not pin the master commitment (2026-07 LOW, no impact today).
- Routes without a verifier: the trailing band counts as claimed as a whole once a trailing row runs, and an unused slot
  of a collection a run handler names is not pinned.
- CRYPTO-4: dynamic and value chunks have no migration path.
- A direct merge of masters holding records checks them relative to `OP_INPUTINDEX` (liveness).
- Delegate (proxied) graph routes: the route pin returns on a proxy's block (`usesProxyStateBlockBase`), and
  `45411dffa` left routed delegates to their verifier, which counts records only inside the participant block. A proxy
  record outside that block, such as a value chunk in the fee slot, may have no check. Not yet checked (found
  2026-10-22 while fixing the graph band).

## Direct call results bound by call records (2026-10-22, D50)

Merged into `master` from `feat/call-records`: `8e6d14f44`, `141bd8ef2`, `56271e705`, `3115d9d9c`, `a6222d08d`.
Design: `docs/wip/call-records/DESIGN.md`.

### Fixed

- **Direct return binding** (was "Not changed, by decision"). A direct caller's read was bound to the callee's
  category, and to its selector for a multi-function callee, but not to the arguments the callee ran. A spender could
  co-spend the callee on other arguments, or lay a carrier of its category beside the callee's, and the caller took
  that result. A direct callee's return carrier is now a call record, `digest(31) || form(1) || result`, the digest
  over the call's selector and arguments, the result inline up to 96 bytes or its SHA256 with the bytes in the
  caller's witness. The callee pins its record and holds the transaction to exactly the records it pinned (one, or
  none for a run that returns nothing). The caller digests its own call and reads only that record. Tests:
  `packages/solidcash/test/e2e/CallRecords.test.ts`. The two forgery cases carry a control: the same transaction is
  accepted once the caller's own argument agrees, so the digest is what refuses it.
- **D11's residual** (a third own-category `OP_TRUE` carrier beside a delegate): the implementation's delegated entry
  pins the forwarded call's record in the proxy's category and counts that category. Test: the forwarded-call case in
  `CallRecords.test.ts`.
- **D6 on a loop over computed targets**: each iteration's callee runs that iteration's call and the caller checks its
  record per iteration. The SDK resolved every iteration's callee with iteration 0's arguments; it now resolves each
  iteration's own (`sc-expand-resolve-create-builder-external-calls.ts`). Test: the loop case in
  `CallRecords.test.ts`.

### Open, or bound otherwise

- An opaque read (`call`, Multicall-style loops) checks no digest, as its payload is opaque: its result is bound by
  the exact count and by D8's argument binding. A Multicall over arbitrary non-SolidCash targets stays
  caller-permissive (`loop-call.ts`).
- R11's view witnesses in a loop stay caller-permissive, as before.
- A callee spent once runs one call. A fixed callee repeated in a loop is refused by the direct builder; two calls with
  different arguments to one callee fail the count on a direct path. Both run through the atomic composer (message
  bus), which binds each row. Two master threads of one callee in one transaction are refused by the count.
- A loop iteration's result must fit 96 bytes inline: there is no per-iteration preimage witness, so a hashed record
  fails the read (fail closed).
