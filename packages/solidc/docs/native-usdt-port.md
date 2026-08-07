# Native USDT port: fidelity audit and implementation status

Status: **contract written and compiling; partially executing.** Six `.scash` files under
`packages/solidcash/test/fixture/`, tests in `packages/solidcash/test/e2e/NativeUsdt.test.ts` (23, all green).

Reference: `TetherToken` at `0xdAC17F958D2ee523a2206206994597C13D831ec7`, solc `v0.4.18+commit.9cf6e910`.
Audited against the **deployed verified source** (fetched via Blockscout), which is byte-identical to
`github.com/tethercoin/USDT` apart from the Etherscan submission header - so the GitHub copy is a safe
reference.

> **Re-measured 2026-08-07** after merging `solidcash_v0.13.1` (1,773 commits, 2026-07-25 -> 2026-08-06).
> Two of this document's load-bearing claims changed, and both changed in the port's favour:
> the blocking gap is now half-fixed upstream and the remaining half names its own workaround (s3), and
> upstream outlining cut every measurement in s1.1 - the monolith by 58% (s1.3). Everything in s2
> (the fidelity audit) re-verified unchanged.

## 1. What was built

A drop-in USDT whose balances are backed by a REAL CashTokens fungible token, with three compliance
extensions: **quarantined admission**, **blacklist** (USDT-native, extended), and **freeze** (new).

Everything is written in SolidCash. No hand-rolled Bitcoin Script covenant was introduced; the split uses
the shipped `library` + `brandLibrary` delegate machinery and the standard token-container primitive.

### 1.1 Why it is six files, not one

The monolith (`native_usdt.scash`, kept as the readable reference spec) compiles to **13,698 B**. BCH enforces
`MAX_INPUT_BYTESIZE = 10,000` bytes **per spending input** - the P2SH32 redeem script plus its unlocking data.
An over-limit contract cannot be spent at all; its deploy probe cannot execute one instruction. No single
function is over the limit (largest body 1,004 B) - the sum is. So this needs partitioning, per
`large-contract-splitting.md` strategy S2: a proxy master holding state plus facets deployed as branded
delegate libraries, each riding its own co-spent input with its own 10 KB budget.

Measured, after the split (all under the cap, verified by a test):

| script | 2026-07-25 | 2026-08-07 | delta | contents |
| --- | --: | --: | --: | --- |
| `nusdt.scash` (master) | 7,992 | **4,934** | -38.3% | state, 19 forwarders, and the three FT-moving functions |
| `nusdt_transfer.scash` | 7,396 | **7,779** | +5.2% | `transfer` |
| `nusdt_spend.scash` | 8,083 | **8,445** | +4.5% | `transferFrom` |
| `nusdt_admin.scash` | 8,570 | **3,281** | -61.7% | Ownable, Pausable, blacklist, freeze, `approve`, `deprecate` |
| `nusdt_supply.scash` | 6,054 | **3,001** | -50.4% | `issue`, `redeem`, `destroyBlackFunds`, `setParams` |
| `nusdt_boundary.scash` | 5,936 | **3,673** | -38.1% | `tick`, `deposit`, `claimDeposit` |
| `native_usdt.scash` (monolith) | 32,644 | **13,698** | -58.0% | the whole surface in one file |

Note the shape of that table: everything shrank sharply **except the two facets that carry the sorted-mapping
hot paths**, which grew. Outlining pays off across many medium bodies and does not help a body dominated by
C2 access sequences.

Splitting still multiplies the available budget rather than compressing code, and that is still the reason
the contract exists at all - but the margin is now 3,698 B over the cap, not 22,644 B.

Two rules the split must obey, both learned the hard way and both now pinned by tests:

- **Every facet must declare the state layout identically to the master.** A delegate writes the caller's state
  BY SLOT, so a divergent layout writes the wrong field. `nusdt_state.inc` is the authoritative copy;
  libraries cannot inherit (`library X is Base` is not grammatical - only contracts can), so the block is
  duplicated and a test asserts all six agree.
- **Forwarder parameter names must match the facet's exactly.** The SDK resolves a sorted-mapping key by
  looking the facet's declared `keyParam` name up in the ABI of the function being called. A renamed forwarder
  parameter fails at transaction-build time ("Cannot convert value to bytes for type address"), not at compile
  time.

### 1.2 Named forwarders, not a `fallback` dispatcher

A single `fallback(bytes)` Diamond dispatcher is smaller (master ~5.8 KB) and was tried first. It does not
work: the SDK derives C2 entry slots from the ABI of the function being called, and a bytes-blob fallback
hides the facet's arguments, so every param-keyed mapping write fails slot derivation. Named forwarders keep
those parameters in the master's own ABI - and preserve the named ABI a drop-in replacement wants anyway.

### 1.3 The shipped auto-splitter does not handle this contract

`compileFileSplit` / `compileStringSplit` landed upstream, and the compiler's over-limit error now names them.
Run against `native_usdt.scash` it does **not** converge: its probe explored facet groupings of 10,115 to
12,741 B - every one still over the cap - and was still going at a 240 s timeout. The hand-split remains
necessary, and it beats the automatic planner on this input. (Contrast `UnicrowSplitCorpus.test.ts`, where the
same API splits and deploys a real corpus contract successfully.)

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
| **`pendingDeposits` is two mappings, not a struct** | The master imports all five facets, and each declaring `struct Pending` collides ("Redefinition of struct Pending"). Two `mapping(address => int)` avoid it and read no worse. |

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

## 3. The blocker: delegated mapping INSERT (was: all delegated mapping writes)

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

### 3.1 Why the port is nonetheless still blocked end-to-end

Every one of the twelve mapping-touching functions is still refused on a fresh deployment, because on a fresh
deployment **every one of those writes is an insert**. Nothing in this master ever creates a key: its only
non-delegated mapping writes are `withdraw`'s `balances[sender] -= amount` (gated on
`require(balances[sender] >= amount)`, so the key must already exist) and `cancelDeposit`'s zeroing of
`pendingAmount` / `pendingUnlockAt` (whose keys `deposit` would have had to create - and `deposit` is
delegated). So the contract cannot get its first key and the whole mapping surface stays unreachable.

The difference is that this is now a **contract-shape problem with a measured fix**, not a missing upstream
feature. Key creation has to happen in a direct (non-delegated) master function. Two shapes work, both
proven or measured:

1. **Zero-value registration (cheap, general).** A direct master `register(address k) { this.balances[k] = 0; }`
   creates the key at zero; every later facet write to it is an UPDATE and settles. Proven end-to-end in
   `DelegateMappingProbe.test.ts` ("a direct zero-value register is enough..."). Costs one small master
   function per mapping that needs first-touch, and makes account-opening an explicit step - a deviation from
   ERC-20, where `transfer` to a never-seen address just works.
2. **Move the credit path back into the master (no semantic deviation).** This was impossible when the port was
   written - `transfer` cost 6,222 B inline against a 7,992 B master. After the merge it costs **2,778 B**, and
   both credit functions fit:

   | master variant | bytes |
   | --- | --: |
   | both forwarded (today) | 4,934 |
   | `transfer` inline | 7,712 |
   | `transfer` + `transferFrom` inline | **9,030** |

   9,030 B is under the 10,000 B cap with 970 B to spare. That covers the ERC-20 movement surface. It does not
   cover the rest of the insert set (`approve` -> `allowed`, `issue` -> `balances[owner]`,
   `addBlackList`/`freeze` -> their flag mappings, `deposit` -> `pendingAmount`), so shape 2 is not sufficient
   on its own - the remaining first-touches still need shape 1 or their own direct entry points, and 970 B does
   not buy many.

The honest summary: the blocker went from "a designed-but-unimplemented upstream feature on the critical path"
to "a budget allocation problem inside a 10,000 B master, with two working mechanisms and measured prices".
Deciding between them is the next step and is a product decision (explicit account registration vs. spending
the master's remaining headroom), not a compiler one.

### What executes today

23 tests green. Working end-to-end: `setBacking` (one-shot, owner-only, reads the physical premint),
`withdraw`'s guards (balance-gated, category-pinned), `pause`/`unpause`, `setParams` (both bounds and the
decimals scaling), `transferOwnership` (including locking the old owner out), `setQuarantineBlocks`,
`deprecate` - i.e. every scalar-state facet route plus the master's own functions.

Refused, and pinned with `rejects.toThrow()` so the suite stays green and honest: `issue`, `transfer`,
`approve`, `addBlackList`, `freeze` - each a first-touch insert. When either fix above lands these assertions
must be inverted.

## 4. Incidental findings

1. **`packages/solidc/test/imports/fixtures/usdt_tether.scash` still does not compile** (re-verified
   2026-08-07). It declares `public int decimals` (line 69) and evaluates `10 ** this.decimals` (line 289),
   which raises `SignedExponentError: Exponent type 'int256' must be unsigned`. Nothing references the fixture,
   so it rotted silently and stayed rotten. Fix: declare `decimals` as `uint8`, as this port does.
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
   `beforeAll` an explicit 180 s budget, since six scripts overrun the suite's 10 s `hookTimeout`; and provision
   **two** plain funder UTXOs per top-up, because a facet call co-spends master + facet and the builder now
   wants one plain funder per covenant input. The mock provider also now requires `@mem-cash/validation` 0.0.8
   exactly - 0.0.7 silently ignores published consensus limits, which would let shapes pass `.build()` and fail
   `.send()`.
