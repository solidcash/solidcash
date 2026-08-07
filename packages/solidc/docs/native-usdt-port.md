# Native USDT port: fidelity audit and implementation status

Status: **executing, with two named limitations.** Two arrangements exist: the hand-split `.scash` facets
(s1, now FOUR files not six) and an inheritance-composed rewrite partitioned by the built-in splitter (s5).
Files under `packages/solidcash/test/fixture/`, tests in `packages/solidcash/test/e2e/NativeUsdt.test.ts`
(24, all green).

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

### 1.1 Why it is four files, not one

The monolith (`native_usdt.scash`, kept as the readable reference spec) compiles to **12,612 B**. BCH enforces
`MAX_INPUT_BYTESIZE = 10,000` bytes **per spending input** - the P2SH32 redeem script plus its unlocking data.
An over-limit contract cannot be spent at all; its deploy probe cannot execute one instruction. No single
function is over the limit (largest body 964 B) - the sum is. So this needs partitioning, per
`large-contract-splitting.md` strategy S2: a proxy master holding state plus facets deployed as branded
delegate libraries, each riding its own co-spent input with its own 10 KB budget.

Measured, after the split (all under the cap, verified by a test). The middle column is the intermediate
measurement at `83c0a8da`, kept because of what it got wrong (see the note at the top). `nusdt_transfer.scash`
and `nusdt_spend.scash` no longer exist: their functions moved into the master when the insert path did (s3.1),
which is why the master grew back to 9,748 B:

| script | 07-25 | 08-07 @`83c0a8da` | 08-07 @`804b786b` | vs 07-25 | contents |
| --- | --: | --: | --: | --: | --- |
| `nusdt.scash` (master) | 7,992 | 4,934 | **9,748** | +22.0% | state, the FT-moving functions, and the whole INSERT path |
| `nusdt_admin.scash` | 8,570 | 3,281 | **2,608** | -69.6% | Ownable, Pausable, `removeBlackList`, `unfreeze`, `deprecate` |
| `nusdt_supply.scash` | 6,054 | 3,001 | **2,729** | -54.9% | `redeem`, `destroyBlackFunds`, `setParams` |
| `nusdt_boundary.scash` | 5,936 | 3,673 | **3,586** | -39.6% | `tick`, `deposit`, `claimDeposit` |
| `native_usdt.scash` (monolith) | 32,644 | 13,698 | **12,612** | -61.4% | the whole surface in one file |

Everything shrank, including the two facets that carried the sorted-mapping hot paths - those were the last
to, and only once the subroutine probe was gated on for aggregate-using contracts. That headroom is what let
the insert path move back into the master. Sum of the four shipping scripts: **18,671 B**, against 25,139 B
across six before the move and 44,031 B on 2026-07-25.

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

### 1.2 Named forwarders, not a `fallback` dispatcher

A single `fallback(bytes)` Diamond dispatcher is smaller (master ~5.8 KB) and was tried first. It does not
work: the SDK derives C2 entry slots from the ABI of the function being called, and a bytes-blob fallback
hides the facet's arguments, so every param-keyed mapping write fails slot derivation. Named forwarders keep
those parameters in the master's own ABI - and preserve the named ABI a drop-in replacement wants anyway.

### 1.3 The shipped auto-splitter does not handle this contract - SUPERSEDED, see s5

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

## 3. The delegated mapping INSERT wall - characterized, then designed around

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

### 3.1 Why the port was nonetheless still blocked end-to-end, and the two ways out

Every one of the twelve mapping-touching functions was refused on a fresh deployment, because on a fresh
deployment **every one of those writes is an insert**. Nothing in the master then created a key: its only
non-delegated mapping writes were `withdraw`'s `balances[sender] -= amount` (gated on
`require(balances[sender] >= amount)`, so the key must already exist) and `cancelDeposit`'s zeroing of
`pendingAmount` / `pendingUnlockAt` (whose keys `deposit` would have had to create - and `deposit` is
delegated). So the contract could not get its first key and the whole mapping surface stayed unreachable.

The difference is that this is now a **contract-shape problem with a measured fix**, not a missing upstream
feature. Key creation has to happen in a direct (non-delegated) master function. Two shapes work, both
proven or measured:

1. **Zero-value registration (cheap, general).** A direct master `register(address k) { this.balances[k] = 0; }`
   creates the key at zero; every later facet write to it is an UPDATE and settles. Proven end-to-end in
   `DelegateMappingProbe.test.ts` ("a direct zero-value register is enough..."). Costs one small master
   function per mapping that needs first-touch, and makes account-opening an explicit step - a deviation from
   ERC-20, where `transfer` to a never-seen address just works.
2. **Move the insert path back into the master (no semantic deviation).** This was impossible when the port was
   written - `transfer` alone cost 6,222 B inline against a 7,992 B master. It now costs 2,794 B, and **six of
   the eight insert-path functions fit**:

   | master variant | bytes | spare |
   | --- | --: | --: |
   | all forwarded (before the move) | 4,784 | 5,216 |
   | `+ transfer` | 7,578 | 2,422 |
   | `+ transferFrom` | 8,799 | 1,201 |
   | `+ approve` | 9,189 | 811 |
   | `+ issue` | 9,578 | 422 |
   | `+ addBlackList + freeze` | **9,748** | **252** |

   That is `transfer`, `transferFrom`, `approve`, `issue`, `addBlackList` and `freeze` all direct, under the
   cap. The functions that only ever UPDATE (`redeem`, `destroyBlackFunds`, `removeBlackList`, `unfreeze`) can
   stay in facets, because updates settle through a delegate. What does **not** fit in the remaining 252 B is
   the quarantine boundary: `deposit` first-touches `pendingAmount` / `pendingUnlockAt`, and `claimDeposit`
   can first-touch `balances`. Those two still need shape 1, or their own budget - note `cancelDeposit` is
   already a direct master function, so the boundary is partly there.

Shape 2 is what was implemented - see below. The blocker went from "a designed-but-unimplemented upstream
feature on the critical path" to "a budget allocation problem inside a 10,000 B master", and the budget turned
out to cover six of the eight.

### What executes today - shape 2 is IMPLEMENTED

The insert path moved into the master, and the split is now drawn by WRITE KIND rather than by subject matter:
a function that can create a key runs directly on the master; only update-only functions are delegated.
`transfer`, `transferFrom`, `approve`, `issue`, `addBlackList` and `freeze` moved in (master 9,748 B, 252 B
spare); `redeem`, `destroyBlackFunds`, `removeBlackList` and `unfreeze` stayed on their facets because an
UPDATE through a delegate settles.

That emptied two facets outright - `nusdt_transfer.scash` and `nusdt_spend.scash` held nothing else - so the
port is **four scripts, not six**.

Working end-to-end (24 tests): `issue`, `approve`, `addBlackList`, `freeze` (all first-touch inserts),
`removeBlackList` (an update, still delegated), plus everything that already worked - `setBacking`,
`withdraw`'s guards, `pause`/`unpause`, `setParams`, `transferOwnership`, `setQuarantineBlocks`, `deprecate`.

Two limitations remain, each pinned by a test:

1. **`transfer` from the OWNER.** USDT credits the fee to the owner, so `transfer` writes
   `balances[msg.sender]` and `balances[this.owner]` - two distinct key SOURCES that are ONE key whenever the
   owner is the sender, which is every transfer out of freshly issued supply. The C2 batch planner is handed
   the same slot twice and refuses, correctly: one entry UTXO cannot be co-spent twice. The compiler has an
   alias mechanism for this (`batchAliasSkips`) but it only pairs slots it nominated as candidates, and the
   collision here is a runtime fact. Pairing by resolved target gets past the planner and then hits the same
   duplicate at the entry co-spend (`Duplicate stateful input ... roles entry:1,entry:2`), so a real fix spans
   the batch planner AND entry co-spend/block-layout planning. Not attempted: that is the C2 value-derivation
   path, where a partial change risks a silent miscompile rather than an error. Not worked around in the
   contract either - dropping the separate owner credit would deviate from the source this port reproduces.
2. **`deposit` / `claimDeposit`.** Both first-touch (`pendingAmount` / `pendingUnlockAt`, and `balances` for a
   never-seen claimant) and neither fits in the master's remaining 252 B.

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
   `beforeAll` an explicit 180 s budget, since compiling the whole port overruns the suite's 10 s `hookTimeout`; and provision
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
| files to write | 4 `.scash` + 1 doc-only `.inc` | **1** |
| state layout declared | 4 times, guarded by a parity test | **once** |
| `pendingDeposits` | two parallel mappings (facets collided on `struct Pending`) | **the struct** |
| forwarders | 13 named, parameter names must match the facet's | **none** |
| scripts produced | 4, hand-partitioned | **3**, compiler-partitioned |
| total bytecode | 18,671 B | **15,995 B** |

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

Fixed in `SplitContractBundle.deploy`, which connects the deployed root and facets to the deploying signer.
Deliberately NOT fixed in `ContractFactory.deploy`, where ethers parity would put it: setting `_signer` on
every factory-deployed contract changes funder provisioning for all of them and breaks six tests across
`EntryWriteBehavior` and `SolidityCorpusBehavior` that depend on the current input layout. That is a real gap,
worth closing on its own terms and with those six examined one by one - it is not this fix's to take on.

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
