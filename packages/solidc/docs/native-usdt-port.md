# Native USDT port: fidelity audit and implementation status

Status: **contract written and compiling; partially executing.** Six `.scash` files under
`packages/solidcash/test/fixture/`, tests in `packages/solidcash/test/e2e/NativeUsdt.test.ts`.

Reference: `TetherToken` at `0xdAC17F958D2ee523a2206206994597C13D831ec7`, solc `v0.4.18+commit.9cf6e910`.
Audited against the **deployed verified source** (fetched via Blockscout), which is byte-identical to
`github.com/tethercoin/USDT` apart from the Etherscan submission header - so the GitHub copy is a safe
reference.

## 1. What was built

A drop-in USDT whose balances are backed by a REAL CashTokens fungible token, with three compliance
extensions: **quarantined admission**, **blacklist** (USDT-native, extended), and **freeze** (new).

Everything is written in SolidCash. No hand-rolled Bitcoin Script covenant was introduced; the split uses
the shipped `library` + `brandLibrary` delegate machinery and the standard token-container primitive.

### 1.1 Why it is six files, not one

The monolith (`native_usdt.scash`, kept as the readable reference spec) compiles to **32,644 B**. BCH enforces
`MAX_INPUT_BYTESIZE = 10,000` bytes **per spending input** - the P2SH32 redeem script plus its unlocking data.
A 32 KB contract cannot be spent at all; its deploy probe cannot execute one instruction. No single function
is over the limit (largest body 6,555 B) - the sum is. So this needs partitioning, per
`large-contract-splitting.md` strategy S2: a proxy master holding state plus facets deployed as branded
delegate libraries, each riding its own co-spent input with its own 10 KB budget.

Measured, after the split (all under the cap, verified by a test):

| script | bytes | contents |
| --- | --: | --- |
| `nusdt.scash` (master) | 7,992 | state, 19 forwarders, and the three FT-moving functions |
| `nusdt_transfer.scash` | 7,396 | `transfer` |
| `nusdt_spend.scash` | 8,083 | `transferFrom` |
| `nusdt_admin.scash` | 8,570 | Ownable, Pausable, blacklist, freeze, `approve`, `deprecate` |
| `nusdt_supply.scash` | 6,054 | `issue`, `redeem`, `destroyBlackFunds`, `setParams` |
| `nusdt_boundary.scash` | 5,936 | `tick`, `deposit`, `claimDeposit` |

Splitting multiplies the available budget rather than compressing code: `transfer` costs 6,222 B inline in the
master but only 214 B as a forwarder.

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

## 2. Fidelity audit against the deployed source

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

## 3. BLOCKING GAP: mapping writes through a delegate facet

**A sorted-mapping (C2) write executed through a delegate facet does not work today.** Minimal repro:
`packages/solidcash/test/e2e/DelegateMappingProbe.test.ts` - a scalar write on a facet succeeds; the same
facet's mapping write fails on-chain with an OP_VERIFY failure at the master input.

Root cause, isolated: the consumer's `L.f()` forwarder reports `entryAccesses = null` while the library's own
function reports the entry write. So the SDK never co-spends the mapping entry UTXOs that the delegate then
tries to write, and the covenant fails. `large-contract-splitting-implementation-plan.md` already specifies
the fix - facet routes must "lay out root state/effect outputs" - but it is designed, not implemented.

Blast radius: every function whose body touches `balances`, `allowed`, `isBlackListed`, `frozen`, or
`pendingAmount` - `transfer`, `transferFrom`, `approve`, `issue`, `redeem`, `destroyBlackFunds`,
`addBlackList`, `removeBlackList`, `freeze`, `unfreeze`, `deposit`, `claimDeposit`.

This is not routable around at the contract level. Partitioning by STATE into several independent contracts
composed with `IContract(addr).method()` (which does support cross-contract sorted writes) does not fit
either: `transfer` (6,044 B) and `transferFrom` (6,555 B) both write `balances`, so they must share one
contract, and that contract exceeds 10 KB on its own. The facet mechanism is the only shape that fits, so the
propagation fix is on the critical path.

### What executes today

Working end-to-end (12 behavioural tests): `setBacking` (one-shot, owner-only, reads the physical premint),
`withdraw`'s guards (balance-gated, category-pinned), `pause`/`unpause`, `setParams` (both bounds and the
decimals scaling), `transferOwnership` (including locking the old owner out), `setQuarantineBlocks`,
`deprecate` - i.e. every scalar-state facet route plus the master's own functions.

Blocked: the twelve mapping-touching functions above. The suite pins the current behaviour with
`rejects.toThrow()` so it stays green and honest; when the propagation fix lands those assertions must be
inverted.

## 4. Incidental findings

1. **`packages/solidc/test/imports/fixtures/usdt_tether.scash` no longer compiles.** `10 ** this.decimals`
   with `int decimals` raises `SignedExponentError: Exponent type 'int256' must be unsigned`. Nothing
   references the fixture, so it rotted silently. Fix: declare `decimals` as `uint8`.
2. **SDK gap fixed in this branch**: a mapping key sourced from a STATE VARIABLE (`balances[this.owner]`, the
   ERC-20 fee-credit shape) threw `Cannot convert value to bytes for type address`. The artifact contract
   already defines `KeySourceAbi.kind = 'state'` with `stateVarName`, and the compiler emits it, but
   `StatefulContract`'s `encodeKey` never consumed it - it fell through to a parameter lookup that could not
   match. Now resolved from the state the builder already read, using the same codec as the state-array path.
   88 existing tests across `LibraryDelegate`, `MsgSenderC2`, `C2DefaultMapping`, and `TokenContainer` pass
   with the change.
3. **`arrays.md` miscites `compiler.ts:28` for `commitmentLimit`**; the constant is at `compiler.ts:84`.
