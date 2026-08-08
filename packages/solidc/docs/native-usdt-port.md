# Native USDT port: fidelity audit and implementation status

Status: **executing.** The whole mapping surface settles, including `transfer` from the owner - the entire
supply path - and `deposit` reaches the boundary facet. Two arrangements exist: the hand-split `.scash` files
(s1, master + one facet) and an inheritance-composed rewrite partitioned by the built-in splitter (s5). Files
under `packages/solidcash/test/fixture/`, tests in `packages/solidcash/test/e2e/NativeUsdt.test.ts` (28) plus
`C2RuntimeSlotAlias`, `NativeUsdtInherited` and `NativeUsdtSurfaceParity`.

Reference: `TetherToken` at `0xdAC17F958D2ee523a2206206994597C13D831ec7`, solc `v0.4.18+commit.9cf6e910`.
Audited against the **deployed verified source** (fetched via Blockscout), which is byte-identical to
`github.com/tethercoin/USDT` apart from the Etherscan submission header - so the GitHub copy is a safe
reference.

> **Re-measured 2026-08-07** after merging `solidcash_v0.13.1` (1,781 commits, 2026-07-25 -> 2026-08-07).
> Two of this document's load-bearing claims changed, and both changed in the port's favour:
> the blocking gap is now half-fixed upstream and the remaining half names its own workaround (s3), and
> upstream outlining cut every measurement in s1.1 - the monolith by 59%. Everything in s2 (the fidelity
> audit) re-verified unchanged.
>
> Measured in two passes, because upstream landed eight more size commits mid-session. The first pass
> (through `83c0a8da`) showed the two C2-heavy facets GROWING while everything else shrank, and this
> document concluded that outlining "does not help a body dominated by C2 access sequences". **That
> conclusion was wrong** - it was an artifact of the subroutine probe being gated off for those contracts.
> `290dfa43` ("run the subroutine probe when a contract uses aggregates") turned it on and both facets fell
> ~35%. Recorded because the retracted claim is the more instructive half: a facet that resists outlining is
> evidence about the probe's gating, not about C2 codegen.

## 1. What was built

A drop-in USDT whose balances are backed by a REAL CashTokens fungible token, with three compliance
extensions: **quarantined admission**, **blacklist** (USDT-native, extended), and **freeze** (new).

Everything is written in SolidCash. No hand-rolled Bitcoin Script covenant was introduced; the split uses
the shipped `library` + `brandLibrary` delegate machinery and the standard token-container primitive.

### 1.1 Why it is two files, not one

The monolith (`native_usdt.scash`, kept as the readable reference spec) compiles to **12,612 B**. BCH enforces
`MAX_INPUT_BYTESIZE = 10,000` bytes **per spending input** - the P2SH32 redeem script plus its unlocking data.
An over-limit contract cannot be spent at all; its deploy probe cannot execute one instruction. No single
function is over the limit (largest body 964 B) - the sum is. So this needs partitioning, per
`large-contract-splitting.md` strategy S2: a proxy master holding state plus facets deployed as branded
delegate libraries, each riding its own co-spent input with its own 10 KB budget.

The port went 6 files -> 4 -> **2**. Moving the insert path into the master (s3.1) emptied
`nusdt_transfer.scash` and `nusdt_spend.scash`; merging what was left into one facet bought back the
constructor-argument space the master needed (s1.4).

| script | 07-25 | 08-07 @`83c0a8da` | now | contents |
| --- | --: | --: | --: | --- |
| `nusdt.scash` (master) | 7,992 | 4,934 | **9,689** | state, the FT-moving functions, and the whole INSERT path |
| `nusdt_facet.scash` | - | - | **6,238** | everything delegated: all 14 UPDATE-only functions |
| *(dissolved)* `nusdt_transfer` / `nusdt_spend` / `nusdt_admin` / `nusdt_supply` / `nusdt_boundary` | | | - | |
| `native_usdt.scash` (monolith) | 32,644 | 13,698 | **12,612** | the whole surface in one file |

Sum of the two shipping scripts: **15,927 B**, against 18,671 B across four, 25,139 B across six, and
44,031 B on 2026-07-25.

Splitting still multiplies the available budget rather than compressing code, and that is still the reason
the contract exists at all - but the margin is now 2,612 B over the cap, not 22,644 B.

Two rules the split must obey, both learned the hard way and both now pinned by tests:

- **Every facet must declare the state layout identically to the master.** A delegate writes the caller's state
  BY SLOT, so a divergent layout writes the wrong field. `nusdt_state.inc` is the authoritative copy;
  libraries cannot inherit (`library X is Base` is not grammatical - only contracts can), so the block is
  duplicated and a test asserts all four agree.
- **Forwarder parameter names must match the facet's exactly.** The SDK resolves a sorted-mapping key by
  looking the facet's declared `keyParam` name up in the ABI of the function being called. A renamed forwarder
  parameter fails at transaction-build time ("Cannot convert value to bytes for type address"), not at compile
  time.

### 1.2 The 10,000 B limit is on the whole unlocking bytecode, and it has three layers

This cost two wrong measurements before it was pinned down, so it is worth stating flatly. The cap applies to
the ENTIRE unlocking bytecode of an input, which is:

    redeem script  +  constructor arguments  +  the call's own arguments  +  the redeem push

The compiler's script-size check - and `scriptToBytecode(asmToScript(artifact.bytecode)).length`, which this
document used throughout - sees only the FIRST of those. Measured on this master: 9,689 B of artifact,
9,761 B of deployed redeem script once one facet address is baked in, and a further ~239 B needed for a single
`address` argument at call time. A contract the compiler passes can be entirely unspendable, and the SDK's
preflight says so in as many words:

> `... whose 9,856-byte redeem script fits the limit on its own but leaves only 144 bytes for the 239 bytes of
> arguments and redeem push it must also carry. The limit is on the WHOLE unlocking bytecode, so a contract the
> compiler's script-size check passes can still be unspendable`

Two consequences shaped the final layout. Each additional facet costs the master one constructor argument
(~72 B in the deployed script for one, ~171 B for three), which is why the three remaining facets were merged
into one (s1.1) - that alone bought back ~99 B. And the master's usable budget is not 10,000 B but roughly
9,760 B, which is what makes s3.1's remaining gap a hard wall rather than a near miss.

The port's own size test asserts the artifact figure, which is the number that rots quietly. What actually
proved this was the SDK preflight refusing a built transaction, so the check that matters is a spend, not a
compile.

### 1.3 Named forwarders, not a `fallback` dispatcher

A single `fallback(bytes)` Diamond dispatcher is smaller (master ~5.8 KB) and was tried first. It does not
work: the SDK derives C2 entry slots from the ABI of the function being called, and a bytes-blob fallback
hides the facet's arguments, so every param-keyed mapping write fails slot derivation. Named forwarders keep
those parameters in the master's own ABI - and preserve the named ABI a drop-in replacement wants anyway.

### 1.4 The shipped auto-splitter does not handle this contract - SUPERSEDED, see s5

**This section was measured at `83c0a8da` and no longer holds.** It read: run against `native_usdt.scash`,
`compileFileSplit` does not converge - its probe explored facet groupings of 10,115 to 12,741 B, every one
still over the cap, and was still going at a 240 s timeout.

After the size commits through `804b786b` it converges in ~60 s, on the monolith (root + 2 facets) and on the
inheritance-composed rewrite alike. The groupings that used to overflow now fit. See s5.

## 2. Fidelity audit against the deployed source

Re-verified 2026-08-07: unchanged.

### 2.1 Reproduced exactly

- The **fee mechanism**: `fee = value * basisPointsRate / 10000` capped at `maximumFee`, credited to the owner,
  recipient receives `value - fee`, and BOTH `Transfer` events in the original's order (fee leg first).
- **`approve`'s EIP-20 race guard**: `require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)))`. This
  IS in the deployed source (line 205) - confirmed, since it is often assumed absent.
- **`transferFrom` decrements only finite allowances**, with `MAX_UINT = 2**256 - 1` as the infinite sentinel,
  preserved at full width.
- **`setParams` transparency bounds**: `newBasisPoints < 20`, `newMaxFee < 50`, and
  `maximumFee = newMaxFee * 10**decimals`.
- **`issue` / `redeem`**, **`pause` / `unpause`**, **`transferOwnership`**, the whole **BlackList** surface
  including `destroyBlackFunds` decrementing `totalSupply`, and the **exact event set**
  (`Transfer`, `Approval`, `Pause`, `Unpause`, `Issue`, `Redeem`, `Deprecate`, `Params`, `AddedBlackList`,
  `RemovedBlackList`, `DestroyedBlackFunds`).

### 2.2 Deliberate deviations, each forced or sound

| deviation | why |
| --- | --- |
| **No SafeMath** | BCH integers are arbitrary-precision BigInts since May 2025, so wraparound does not exist and `add`/`mul` overflow asserts are vacuous. Underflow still matters (a subtraction goes negative rather than wrapping), so every debit keeps an explicit `require(balance >= value)` - semantically SafeMath.sub's assert at a fraction of the size. |
| **`decimals` is `uint8`** | `10 ** this.decimals` needs an UNSIGNED exponent. A signed one is a compile error - this is the bug that makes the pre-existing `test/imports/fixtures/usdt_tether.scash` fixture fail to compile today (see s4). |
| **`name`/`symbol` are `bytes32`** | A dynamic-length BCH state variable stores length+hash in the commitment with the bytes in separate CHUNK UTXOs that must be co-spent on EVERY state-reading call - a permanent per-transaction cost for metadata no on-chain logic reads. Both values fit in 32 bytes; richer metadata belongs in BCMR. |
| **No `upgradedAddress` call forwarding** | On BCH the category ID IS the contract's identity and the `upgrade` modifier preserves it, so holders never change address and there is nothing to forward to. The flag, the successor address, and the `Deprecate` event are all kept, and the ERC20 entry points refuse once deprecated. |
| **No on-chain view functions** | `balanceOf` / `allowance` / `totalSupply` / `getBlackListStatus` / `getOwner` are read off-chain from UTXOs via the SDK (`sc.state.*`, `sc.balances(who)`), which is free. Keeping them on-chain costs script budget for data any client can already read. |
| **Supply is premint-then-release** | Fungible amounts of a CashTokens category can only be created in that category's genesis transaction, so open-ended `issue` is not implementable. `issue` releases preminted reserve; consensus makes over-issuance impossible because the FTs must already exist in the container. `containerSeen` is read from `this.tokens[cat].tokenAmount` - the physical reserve - so the owner cannot overstate the premint. |
| **`pendingDeposits` is two mappings, not a struct** | The master imports every facet, and each declaring `struct Pending` collides ("Redefinition of struct Pending"). Two `mapping(address => int)` avoid it and read no worse. |

### 2.3 The quarantine timer, and its one trust assumption

`tx.time` cannot be read into a variable in SolidCash - only compared - which usefully prevents the unsound
pattern of deriving an unlock height from a spender-chosen value. The clock is therefore a CLTV-verified
monotonic counter: `require(tx.time >= nowHeight)` makes consensus prove the real chain height is at least
`nowHeight`, and `require(nowHeight >= this.clock)` forces it forward. The claim gate
`require(tx.time >= unlockAt)` is likewise consensus-enforced, so **a matured claim can never be
accelerated**. No block oracle is needed.

The assumption: a depositor may pass the smallest accepted `nowHeight` (the current clock), so if the clock
lags the chain the window is shortened by exactly that lag. `tick` is permissionless, so anyone may keep it
fresh, and the issuer - the party the window protects - has both the means and the incentive. Documented
rather than hidden.

`cancelDeposit` is deliberately available to a blacklisted or frozen claimant: refusing admission must not
mean seizing funds, or wrapping becomes a honeypot and nobody wraps.

## 3. The delegated mapping INSERT wall, and how the port got past it

**Superseded by measurement.** The original finding was that no sorted-mapping (C2) write through a delegate
facet worked at all, root-caused to the `L.f()` forwarder publishing `entryAccesses = null` so the SDK
provisioned no entry UTXOs. Upstream **X11 (`837c8b8d`, 2026-07-29)** fixed exactly that, by making
`hasNothingToDerive` read the ROUTED implementation accesses instead of the forwarder's own. What remains is a
clean split, measured in `DelegateMappingProbe.test.ts`:

| operation through a facet | result |
| --- | --- |
| scalar state write | settles (always did) |
| mapping **UPDATE** (key exists) | **settles, and the value lands** |
| mapping **INSERT** (new key) | **refused, at the PROXY's input (input 0)** |

The INSERT refusal is a covenant fact, not a gap. An insert mints one new entry node, so the transaction's
own-category mutable (`0x01`) NFT count rises by one - and a function issuing a `delegatecall` carries
`emitOwnCategoryMutableNftConservation` (C1 full-state authority; emitted unconditionally on that path in
`GenerateTargetTraversal`), which pins that count input == output. It is the same defence that refuses an
appended fabricated entry node, so a proxy cannot admit one without admitting the other. The implementation
covenant accepts the same transaction; the master rejects it.

### 3.1 Why the port was blocked end-to-end, and what it took to clear

Every one of the twelve mapping-touching functions was refused on a fresh deployment, because on a fresh
deployment **every one of those writes is an insert**. Nothing in the master then created a key: its only
non-delegated mapping writes were `withdraw`'s `balances[sender] -= amount` (gated on
`require(balances[sender] >= amount)`, so the key must already exist) and `cancelDeposit`'s zeroing of
`pendingAmount` / `pendingUnlockAt` (whose keys `deposit` would have had to create - and `deposit` is
delegated). So the contract could not get its first key and the whole mapping surface stayed unreachable.

Key creation has to happen in a direct (non-delegated) master function, and the master had to be able to
afford one. Both halves are now solved - the insert path moved into the master (which the upstream size work
made affordable: `transfer` cost 6,222 B inline against a 7,992 B master when this was written, and 2,794 B
now), and `openSelf()` opens the keys the delegated routes need.

**Both are now fixed**, by three changes to the contract - none to the covenant, which was right all along.

1. **Fees accrue instead of being credited inside `transfer`.** Crediting `balances[this.owner]` there is a
   SECOND write to the sender's own entry whenever the owner is the sender - which is every transfer out of
   freshly issued supply. Two writes to one entry cannot compose here (each computes an absolute value from the
   same input), so the batch planner refuses the duplicate slot, correctly: deduping instead SILENTLY DROPS the
   second write, and `C2RuntimeSlotAlias.test.ts` pins that measurement. Fees now land in a `feeAccrued`
   scalar and `collectFees()` sweeps them into the owner's balance. A self-transfer would still put both
   writes on one entry, so it is refused by name.

2. **`openSelf()` - each account opens its own keys once.** Two platform rules make this necessary: a
   first-touch INSERT cannot settle through a delegate, and two ABSENT keys in one collection prove through
   the SAME predecessor, which would co-spend one entry NFT twice. Creating all five keys up front makes every
   later route an UPDATE against a distinct entry. Keyed on `msg.sender` ON PURPOSE - that is what makes it
   fit. `openAccount(address)` costs ~239 B of call arguments against the same 10,000 B cap (s1.2), and that
   was the whole reason the earlier attempt "did not fit"; an account only ever needs to open itself.

3. **The fee `Transfer` event is emitted unconditionally.** This was the last blocker and the least obvious.
   USDT emits it only `if (fee > 0)`, and a NOT-TAKEN emit is bound by SEC-10
   (`emitNotTakenEventSlotBinding`): its reserved output must carry an EMPTY commitment. With fees at the
   default 0 that branch is never taken, and the binding failed - which surfaced only as
   "the VM errored before all commitments could be extracted" during state derivation, four layers behind the
   original symptom. Emitting it unconditionally costs a zero-value `Transfer` log when no fee applies.

   Found by tracing the derivation probe's own VM (`_deriveFullTransactionState`, not the sparse probe higher
   in that file - that path is never reached for this shape) to instruction 251 of a 316-opcode script, then
   matching the opcode sequence `OP_OUTPUTTOKENCOMMITMENT OP_SIZE OP_NIP OP_0 OP_NUMEQUALVERIFY` against its
   emitter. Worth remembering as a method: the opcode pattern identified the check faster than a source map
   would have.

With those in place the whole mapping surface settles: `issue`, `transfer` (including from the owner, which is
the entire supply path), a non-owner transfer, the fee round-trip, `approve`, `addBlackList`, `freeze`,
`removeBlackList`. `deposit` reaches the FACET rather than being refused at the proxy, but it then fails its
own delivery proof - and that is a CONTRACT DEFECT, not the contract working. See s3.3. 28 tests in
`NativeUsdt.test.ts`.

Three deviations this adds, all documented and all forced: fees are swept rather than credited inline, an
account opens itself before use, and a zero-value fee `Transfer` is logged when no fee applies.

### 3.2 A shared commitment verification broke state derivation (fixed)

Merging `solidcash_v0.13.1` at `5ca52bd7` broke six of this suite's delegated scalar routes with
`parsePushdataCommitment: nftIndex tag mismatch for NFT index 0: got 2`. Bisected to
`0ecb4d7c size(solidc): rank outlining candidates by value`, which raised the outlining candidate cap so it
stopped binding. Measured on this master: the number of `OP_OUTPUTTOKENCOMMITMENT` sites fell from 8 to 6 -
two data-NFT commitment verifications had been merged into ONE shared helper, invoked twice.

`extractCommitmentsFromTrace` is POSITIONAL: the i-th verified output maps to the i-th slot. It was scanning
only the longest redeem-script instruction array, so the shared helper's SECOND invocation - which runs in a
later `OP_INVOKE` phase - was never seen. The list came back short and every later commitment shifted down a
slot, which is why NFT 2's commitment arrived as NFT 0's.

Fixed by passing `scanFullTrace` on that extraction, the same flag the entry and chunk extractions beside it
already use. One argument. The output-index range plus the tight `OTC`/`OP_EQUALVERIFY` pairing still keep
unrelated matches out.

Worth recording what did NOT work: making `OP_OUTPUTTOKENCOMMITMENT` a `BARRIER_OP` so the pattern can never
be shared is the more obvious fix and is wrong here - it costs enough outlining that this master no longer
fits its input, taking the suite from 28 passing to 9. The extractor was the side that was wrong, not the
optimiser.

### 3.3 `deposit`'s delivery proof is unsatisfiable, so the boundary cannot be entered

I previously recorded that `deposit` "fails only on its own delivery proof, which is the contract working".
That was wrong, and the arithmetic says so. The check is:

```
for (i in tx.outputs) if (tx.outputs[i].tokenCategory == category)
    delivered += tx.outputs[i].tokenAmount;
require(delivered >= this.containerSeen + amount);
```

`containerSeen` is the whole reserve's high-water mark, and **the container is not co-spent by `deposit`** - it
touches no `this.tokens[...]`, and it runs on a delegate facet where container operations are forbidden
anyway. So the container's own balance contributes nothing to `delivered`, and a depositor must supply
`containerSeen + amount` from their own bearer coins in order to move `amount`. Measured: depositing 5 USDT
against a 1,000,000 USDT premint demands the transaction carry **1,000,005 USDT** of category outputs. The
check is satisfiable only while `containerSeen == 0`, and `setBacking` makes that false immediately.

So the quarantined admission boundary - the port's headline extension, and the whole subject of s2.3 - has
never been enterable. Every earlier report that framed this as a test-harness gap was mistaken; the harness
was fine.

The loop is separately blind to WHERE an output pays: it would happily count one paying the depositor. So even
the intended proof ("the reserve grew") is not what it checks. A sound version needs one of two things this
port does not have:

- the **container's locking bytecode** available in contract code, so that only container-paying outputs are
  summed and the requirement becomes `delivered >= amount`; or
- the **container co-spent**, so its input/output delta is the measurement - which needs `deposit` on the
  master, since delegate mode cannot touch a container, and the master has no room for it (s1.2).

Neither is a small change, and a half-sound version - fixing the satisfiability while leaving the destination
unchecked - would turn an unusable function into a drainable one. Pinned by
`NativeUsdtDepositProof.test.ts` with the arithmetic, unfixed deliberately.

### 3.4 What the layout costs, and one splitter bug it exposed

`feeAccrued` sits beside the other fee fields rather than at the end of the state block, deliberately: a
function must not touch a NON-CONTIGUOUS set of data NFTs, and `transfer` already reads `basisPointsRate` and
`maximumFee`. Everything that becomes UPDATE-only once accounts are open (`issue`, `collectFees`,
`addBlackList`, `freeze`) is delegated to the facet, which is what pays for `openSelf()`: the master lands at
**8,778 B deployed with 1,222 B of headroom**.

The inheritance arrangement (s5) surfaced a genuine splitter bug on the way, now FIXED. `compileFileSplit`
planned on ARTIFACT size while the cap is on the deployed unlocking bytecode, so it could emit a bundle whose
shards all passed its own check and was still unspendable - one shard measured under the cap and deployed at
10,030 B once its brand was baked in. Against the DEFAULT cap the planner now budgets the whole spend: the
shard's constructor arguments plus its widest single entry point's own arguments. An explicit `maxShardBytes`
stays a literal redeem-script knob, so the tuning call sites that derive limits from `estimatedRedeemBytes` are
unaffected. Measured on this contract: `Facet1` went 10,030 B deployed and unspendable to 9,322 B with room for
its arguments, and every route through the bundle now settles.

## 4. Incidental findings

1. **`packages/solidc/test/imports/fixtures/usdt_tether.scash` did not compile - FIXED.** It declared
   `public int decimals` and evaluated `10 ** this.decimals`, which raises `SignedExponentError: Exponent type
   'int256' must be unsigned`; `decimals` is now `uint8`, as in this port. It rotted because NOTHING references
   it - no test names it and no fixture imports it - so no suite ever loaded it. Two other fixtures are in the
   same position (`usdc_fiattoken.scash`, `library_same_file.scash`); both still compile.
   `packages/solidc/test/imports/UnreferencedFixtures.test.ts` now finds that set at run time and compiles it,
   so a fixture that loses its last reference cannot go quiet again. (Worth noting how the guard was verified:
   the first version passed with the break reintroduced, because it walked its own source and its comments name
   the fixture - it now excludes itself, and the discrimination was re-checked by breaking the fixture on
   purpose.)
2. **SDK gap fixed in this branch** (still present and still needed after the merge): a mapping key sourced
   from a STATE VARIABLE (`balances[this.owner]`, the ERC-20 fee-credit shape) threw `Cannot convert value to
   bytes for type address`. The artifact contract already defines `KeySourceAbi.kind = 'state'` with
   `stateVarName`, and the compiler emits it, but `StatefulContract`'s `encodeKey` never consumed it - it fell
   through to a parameter lookup that could not match. Now resolved from the state the builder already read,
   using the same codec as the state-array path.
3. **`arrays.md` miscited `compiler.ts:28` for `commitmentLimit`.** The line was 84 when this was first
   written and is 134 today - the citation rotted twice in two weeks. Fixed by citing the symbol without a
   line number.
4. **Suite maintenance the merge forced** (all applied): compile with `messageBus: false` to match
   `test/direct-compile.ts` (the default `auto` mode builds bus routes this contract never takes); give
   `beforeAll` an explicit 180 s budget, since compiling the whole port overruns the suite's 10 s
   `hookTimeout`; and provision
   **two** plain funder UTXOs per top-up, because a facet call co-spends master + facet and the builder now
   wants one plain funder per covenant input. The mock provider also now requires `@mem-cash/validation` 0.0.8
   exactly - 0.0.7 silently ignores published consensus limits, which would let shapes pass `.build()` and fail
   `.send()`.

## 5. The inheritance rebuild, and what the built-in splitter needed

`nusdt_inherited.scash` is the same contract composed the way the deployed USDT composes itself - a hierarchy
of contracts - and partitioned by `compileFileSplit` instead of by hand-written facets. Tests in
`packages/solidcash/test/e2e/NativeUsdtInherited.test.ts`.

```
Ownable
Pausable      is Ownable                BasicToken  is Ownable          StandardToken is BasicToken
BlackList     is BasicToken             Freezable   is Ownable          Backed        is Ownable
Quarantined   is Backed
NativeTetherToken is Pausable, StandardToken, BlackList, Freezable, Quarantined
```

Ownable is reached along five paths, so this leans on C3 linearization. It holds: `owner`, `paused`,
`totalSupply` and `balances` each get exactly one slot in the flattened layout (test-pinned).

### 5.1 It is strictly better as source, and smaller as bytecode

| | hand-split facets | inheritance + auto-split |
| --- | --- | --- |
| files to write | 2 `.scash` + 1 doc-only `.inc` | **1** |
| state layout declared | twice, guarded by a parity test | **once** |
| `pendingDeposits` | two parallel mappings (facets collided on `struct Pending`) | **the struct** |
| forwarders | 13 named, parameter names must match the facet's | **none** |
| scripts produced | **2**, hand-partitioned | 3, compiler-partitioned |
| total bytecode | **15,927 B** | 15,995 B |

Shards: root 1,403 B, `Facet0` 9,987 B, `Facet1` 4,605 B. Note `Facet0` is **13 B** under the cap - the
splitter packs to the limit, so this bundle is one small edit away from needing a re-plan. That is the
compiler's job now rather than a hand-drawn line, but it is not slack.

Two earlier conclusions in this document are superseded:

- **s1.3 said the auto-splitter does not handle this contract.** It does now. That measurement was taken at
  `83c0a8da`, where every grouping the probe tried was still over the cap; after the size commits it converges
  in ~60 s. Re-measured on the flat monolith too: root + 2 facets.
- **The facet split's "hard-won rules" were about the mechanism, not the contract.** Identical state blocks,
  matching forwarder parameter names, no `modifier` in a library, no struct sharing - every one of them is a
  cost of hand-rolling delegate libraries, and every one disappears here.

### 5.2 `msg.sender` inside an auto-split facet - ROOT-CAUSED AND FIXED

This section recorded that no USDT entry point could be called through the bundle. Both causes are found and
fixed; `SplitFacetMsgSender.test.ts` is now a regression test rather than a repro.

**msg.sender.** `ContractFactory.deploy` set `_logicalNonceSigner` but never `_signer`, so a contract returned
by a Signer-backed factory was not "connected" for funding purposes. The builder worked the requirement out
correctly - `delegateUsesMsgSender` fires, `neededFunders` becomes 1 - and then skipped provisioning it,
because that whole block is gated on `this._signer`. Nothing errored: the transaction was simply built with no
native P2PKH input, and `emitTxOrigin` - which scans for exactly that input - then failed at the facet's own
input. `SplitContractBundle` hit it hardest because `deployed.call.f()` never connects explicitly.

Fixed in `ContractFactory.deploy`, which is where ethers parity puts it: a factory-deployed contract is now
connected to the factory's signer, so `deployed.call.f()` funds exactly like `contract.connect(signer).call.f()`.

That fix was first taken narrowly, in `SplitContractBundle.deploy`, because the general form broke six tests
across `EntryWriteBehavior` and `SolidityCorpusBehavior` and those looked like they depended on the input
layout. They did not. Every one failed with `Signer has 1 available plain UTXO(s) but N funder(s) needed` -
they were under-funded fixtures that passed only because the funder requirement was computed and then silently
skipped. `fundedSigner()` now defaults to several coins instead of one, all six pass, and the narrow
workaround was removed. Worth recording as a caution: "my fix breaks unrelated tests" was the wrong reading,
and the right move was to read the failures rather than route around them.

**Zero-parameter events.** `SplitContractBundle` wires facet event ARGUMENTS onto the call, guarded by
`values.every(v => v !== undefined)` - which is vacuously TRUE for an empty parameter list. So a zero-parameter
event got a manual emit on top of the one the builder already lays out from the facet's published `emits`, and
the covenant refused the duplicate output. `pause()` / `unpause()` are exactly that shape.

Measured on the deployed bundle afterwards: `pause`, `unpause`, `setParams`, `setQuarantineBlocks` and
`deprecate` all settle.

### 5.3 The delegated-INSERT boundary applies here too

Measured on the deployed bundle: mapping-INSERT entry points (`issue`, `addBlackList`) fail at **input 0**, the
root, exactly as they do through hand-rolled facets (s3). So the INSERT boundary is a property of the
delegatecall proxy mechanism and not of how the facets were authored - hand-rolling them differently was never
going to avoid it, and the two fixes in s3.1 remain the two fixes.
