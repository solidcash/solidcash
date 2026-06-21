# External contract calls & dynamic dispatch (EVM-parity address model)

Status: **Stage 3 landed & green.** Stage 1 (master self-pin) + Stage 2 (data/entry NFT read-path self-pin) +
Stage 3 (address dispatch: hard replace of the category model with `IContract(addr)`, `connect` removed) are
implemented and tested: compiler 1219 green, SDK 1713 green. `IContract(addr).method()/.stateVar/.outState` is
runtime-verified (reads, calls, outState, returns, msg.sender, multi-party, low-level, events) on mocknet.
Remaining scoped pieces: (a) **multi-data-NFT external reads** need the commitment-preamble nftIndex tag
(single-data-NFT reads + entries are sound today; cross-contract reads of an nftIndex >= 1 var are **rejected at
compile time** with `MultiNftExternalReadError` until the tag lands - no silently-unsound code is emitted) - the
register/memory design below; (b) `address(this)` primitive; (c) **circular A<->B address references are a
deliberate casualty** - a mutual cycle `addrA=hash(codeA|addrB)`, `addrB=hash(codeB|addrA)` is a hash fixed
point with no constructible genesis (3 CircularCalls tests skipped); the old shared-category model could
bootstrap them, address parity cannot. Stage 4 (proxy upgradeability) remains design.

> **DECISION (2026-06): the register/memory model for sound cross-contract reads.**
>
> *Mental model (CPU analogy).* A data NFT is a **register** (a fixed-width ~`commitmentLimit` slot); a contract's
> fixed-size state is a **register file**; `nftIndex` is the **register number**. Like every ISA, fixed-size data
> lives in **registers** and variable-size data lives in **memory**:
> - **Fixed-size vars -> registers (data NFTs).** Tightly bin-packed, **static count** frozen at compile time
>   (`ceil(total_fixed_width / commitmentLimit)`). A value wider than one register spans a **register pair** (fixed
>   count, ABI layout) - never a runtime-variable count.
> - **Variable-size vars (`string`, dynamic array) -> memory.** A separate, *addressed, growable* structure -
>   which is exactly what **entry NFTs already are** (per-collection address + in-commitment key, mint/destroy to
>   grow/shrink). A variable value is a memory object, **not** a register that grows. So the earlier
>   "dynamic-spanning data NFT" worry was a register/memory category error: the register file is static; only
>   memory grows, and memory already handles growth soundly. Variable-state-in-memory is **future work**, out of
>   scope for the read fix.
>
> *The soundness gap.* A register's number must be its **identity** (a CPU addresses `r5` by number, never "the
> 3rd register here"). Today a data NFT's `nftIndex` is only **positional** - nothing on the UTXO declares it.
> Fine for the contract's **own** spends (it builds its own tx, trusted ordering); **unsound** for cross-contract
> reads, where an untrusted tx-builder can permute B's (identically-addressed `f(C)`) data NFTs and the reader
> can't detect it. (Single-data-NFT and entry reads are unaffected.)
>
> *The fix: stamp the register number as a verifiable UTXO attribute.* Chosen mechanism - a **commitment-preamble
> tag**: each data NFT self-declares its `nftIndex` as the first field of its commitment; a read does
> `tag == N -> OP_EQUALVERIFY` (fail-closed on permutation). Preferred over the alternative (a per-`nftIndex`
> *address*, `dataNftAddr(C, nftIndex)`) because the tag keeps the address `f(C)` - **no SDK per-UTXO
> address-tracking change** - and self-describes (the natural shape for the future memory/chunk case). The
> per-`nftIndex`-address variant (register number in the *addressing*, classic-register style) stays the recorded
> alternative; it needs the SDK to model data NFTs as an indexed register file.
>
> *Trustworthiness* of the tag rests on **Stage 2 self-pin**: the data NFT covenant enforces its live category
> `== C` on the read path, so only a genuine category-C UTXO is spendable at the address; category C is mint-once
> (only B's lineage), and B's write codegen always stamps the correct `nftIndex`, so every category-C data NFT
> carries a correct tag. The covenant need not enforce the tag itself.
>
> Stage 3 read fix = **Stage 2 self-pin + commitment-preamble nftIndex tag + reader tag-verify**. The earlier
> master-free / per-nftIndex-address §3.3/§7.3/§9.6 text below predates this and is superseded by this block.

Model for `IContract(address).method(arg)` on the BCH UTXO/CashTokens substrate, with the explicit goal of **EVM
address parity**: an `address` *is* the contract's on-chain address, passed/compared/called directly, with no
derivation or transformation. Normative rules use MUST/SHOULD.

## 1. Goal

`IContract(addr).method(arg)` is *the* way to call another contract. `addr` is a first-class value identical
in role to an EVM address: you store it, compare it, and dispatch through it. **No `derive()`, implicit or
explicit** - the value you hold is the address, full stop. Calls must have EVM-equivalent *safety* and as much
EVM-equivalent *ergonomics* as the chain allows.

## 2. Terminology: four distinct "address-like" things

"Address" is overloaded on BCH. The spec uses these names **exactly** and never interchangeably:

| term | value | derived from | role | EVM analogue |
|---|---|---|---|---|
| **`address`** = locking bytecode (scriptPubKey) | **35 bytes**: `OP_HASH256 ‖ 0x20 ‖ <scriptHash> ‖ OP_EQUAL` (`0xaa20 ‖ hash ‖ 0x87`) | code + baked args (incl. category when self-pinning) | the everyday handle: `IContract(addr)`, `==`, stored/passed, **and** the recipient scriptPubKey; returned directly by `OP_UTXOBYTECODE` | **`address`** (callable + payable instance identity) |
| **codehash** | 32 bytes: `hash(compiledBytecode)`, **args-excluded** | code only (same across all instances) | "which contract / which code" - interface & proxy-impl identity | **`codehash`** / `hash(type(C).runtimeCode)` |
| **cashaddr** | `bitcoincash:p…` string (bech32; token-aware variant for token UTXOs) | the locking bytecode | human / wallet / SDK display & I/O | the checksummed `0x…` *display* of an address |
| *(script hash)* | 32 bytes: `hash256(redeemScript)` - the middle of the locking bytecode | code + baked args | **not a first-class type** - lives inside `address`; extracted only in the rare case it's needed | — |

Decision (resolving the §11 representation question): **`address` is the 35-byte locking bytecode**, not the
bare 32-byte hash. Rationale: in-script, the locking bytecode is the native currency - it's what
`OP_UTXOBYTECODE`/`OP_OUTPUTBYTECODE`/`address(this)` return and what every covenant already compares (52
bytecode-comparison ops in the generator vs ~0 bare-script-hash comparisons), and it's the scriptPubKey you
pay to. Making `address` the locking bytecode means **identity == location == the introspected value, with
zero conversions**; the call check is a direct `OP_UTXOBYTECODE == addr`. The bare 32-byte script hash is
demoted to an internal detail (the middle bytes), not a user type. Cost: an `address` is 35 bytes, not 32
(+3 bytes per stored address - a minor NFT-commitment-packing cost, since addresses are *used* far more than
*stored*). `address(0)` = the all-zero/empty locking bytecode sentinel (no real contract matches).

`codehash` stays a separate 32-byte type (args-excluded) for "which code" and proxy-implementation allowlists.
cashaddr is the SDK display of an `address`. `derive()` is gone.

EVM mapping: EVM **`address`** ≈ BCH **`address`/locking bytecode** (callable+payable identity), EVM
**`codehash`** ≈ BCH **codehash** (template), **cashaddr** ≈ EVM checksummed-hex *display* (presentation, not
semantic).

### 2.1 `address ⟹ code`, but not `⟹ state`

| | EVM | BCH (SolidCash) |
|---|---|---|
| `address ⟹ code` | yes (protocol-bound) | **yes** - P2SH: only that redeem script hashes into that locking bytecode |
| `address ⟹ state` | yes (protocol-bound storage) | **not for free** - see §3 |

`IContract(addr).method()` verifies the co-spent callee with a **direct comparison** to the 35-byte `addr`:

```
require( OP_UTXOBYTECODE(inputN) == addr )      // addr = 35-byte locking bytecode; no conversion
```

The one gap vs EVM is `address ⟹ state`. §3 closes it.

## 3. The load-bearing requirement: self-pinning closes `address ⟹ state`

A P2SH locking script governs **how a UTXO is spent**, never what it *contains*. Anyone can pay a UTXO to any
address with any token category and any commitment, permissionlessly, running no code. So on BCH:

- `address ⟹ code` holds (P2SH guarantees the script).
- `address ⟹ state` does **not** hold for free - the UTXO's category/commitment are attacker-chosen at
  creation.

EVM gets `address ⟹ state` from the protocol binding storage to the account. BCH must get it from the
**contract's own covenant**:

> **Self-pinning (`code ⟹ category`):** the contract bakes its state-NFT **category** as a constructor arg and
> its covenant enforces `OP_UTXOTOKENCATEGORY(self) == bakedCategory` on every spend, inductively from genesis.

With self-pinning, a UTXO carrying this code can *only validly hold* the one legitimate category - and that
category is mint-once, so its commitment is genuine state by induction. Therefore:

> **Claim.** For a self-pinning contract, `address ⟹ (code, genuine state)` - the EVM-address property,
> reconstructed on BCH.

### 3.1 Why this makes the caller's check trivial (and why it's exactly EVM)

The callee's UTXO is **co-spent** (it is an input), so **its covenant runs** as part of tx validation. A
fabricated UTXO sitting at the address with a fake category is **unspendable** (self-pin rejects any category ≠
the baked one), so it can never be a valid input. Hence *any co-spent UTXO at `addr` necessarily passed
self-pin → carries genuine state*. The caller therefore needs only:

```
require( OP_UTXOBYTECODE(inputN) == addr )   // addr = 35-byte locking bytecode (§2); direct compare
```

and the callee's own covenant - which ran *because it was spent* - did the integrity work. This is precisely
the EVM model: the callee's code executes on the call and enforces its own invariants. No category check, no
derivation at the caller.

### 3.2 Stateless callees

A stateless / pure-covenant contract has no NFT to forge. `address ⟹ code` is sufficient; the address handle
is trivially safe with the same `OP_UTXOBYTECODE == addr` check.

### 3.3 Reads are master-free; the sub-NFT self-pins

A **state-changing call** co-spends B's master (it mutates B - unavoidable), so call integrity rides on the
master's self-pin (Stage 1). A **read** must not: requiring every reader to co-spend B's master would make that
single UTXO a **global lock**, serializing all of B's own activity *and* all concurrent readers - at most one
read-or-op per block for a popular B. So reads co-spend only the **sub-NFT** being read (the data/entry NFT),
contending solely for that UTXO.

Without a co-spent master there is no anchor to verify the sub-NFT against, so the sub-NFT must carry its **own**
integrity: the data NFT and entry NFT **self-pin their category** (Stage 2, §7.3), exactly as the master does.
A read is then a single `OP_UTXOBYTECODE(readOnlyDataNft) == <sub-NFT address>` against the deploy-time-fixed
sub-NFT address; the self-pin guarantees the co-spent UTXO's committed state is genuine. Residual trust = "who
set the address" - identical to the call case and to EVM (§4.3).

## 4. Forgery analysis (keep this central)

Threat model: the SDK/tx-builder is **untrusted** - it picks every input and output. The covenant is the only
arbiter.

### 4.1 The attack the model must defeat

If a stateful callee is **category-agnostic** (does *not* self-pin - it reads its own category and preserves
whatever it finds), then:

1. Attacker genesis's their own category `CX` (dust) with a lying commitment.
2. Attacker pays a UTXO **to the callee's address** bearing `CX` + the lie (permissionless; runs no code).
3. SDK co-spends caller + that UTXO. The category-agnostic covenant **accepts the spend** (it preserves `CX`
   under the code; it cannot tell `CX` is illegitimate).
4. Caller checks `OP_UTXOBYTECODE == addr` ✓, reads the lie commitment, acts on it. **Total state injection**
   (oracle manipulation, fund drain). SDK-mountable, **critical**.

### 4.2 Why self-pinning kills it

A self-pinning callee enforces `category == bakedCategory`. The fabricated `CX`-UTXO at the address is
**unspendable**, so it cannot be a co-spent input - the attack never gets off the ground. The attacker cannot
instead use the *real* category (mint-once; held only by the genuine lineage). So address-handle integrity is
restored **by the callee binding its own state**, not by the caller checking a second identifier.

> **Rule.** Address-handle dispatch is sound **iff** the callee is stateless, or a **self-pinning** stateful
> contract. A category-agnostic stateful contract behind an address handle is exactly §4.1 and MUST be
> rejected by the compiler.

### 4.3 Residual trust = EVM parity, not a regression

The only remaining trust is "was `addr` set to a legitimate contract's address?" - i.e. who may write the
caller's `callee`/`token` field. Identical to Solidity (controlling a stored `address` redirects calls).
Decentralized data; no registry.

## 5. The trilemma, resolved under the address model

Three properties tension on every call: **integrity** (state is real), **authenticity** (logic is what you
expect), **adaptability** (upgrade/intermix). The escape is not to pin identifiers on the caller, but:

- **Integrity + authenticity come from the address itself, *because the callee self-pins*.** `addr ⟹ (code,
  state)`. For an **immutable** contract this is the whole story - the single address handle delivers integrity
  and authenticity at once, with no caller-side pin and no derivation. **This is the default and it is
  trilemma-free.**
- **Adaptability** is preserved because `addr` is a runtime value (store it, swap it, pass it) and because
  multiple callees are just multiple addresses you co-spend and check independently.

### 5.1 Upgradeability = the EVM proxy pattern (stable address, mutable impl)

A self-pinning contract's address is `hash(code)`, so changing code changes the address - which would break a
stable handle. EVM solves this with **proxies**; so do we, identically:

- An upgradeable contract is a **stable, self-pinning proxy** (fixed proxy code → fixed address) that
  delegates to a **mutable implementation**.
- The **proxy address is the EVM-parity handle**; the implementation changes behind it.
- The proxy covenant enforces the **upgrade policy** (immutable allowlist of implementation code-hashes, or
  `{governorCategory, timelock}`), carried in the proxy's (self-pinned, unforgeable) commitment. The owner can
  upgrade only within the policy they committed at genesis - **stricter than a typical EVM proxy** whose admin
  upgrades to anything.

SolidCash already has a delegate/proxy mechanism (altstack `_proxyMasterIndex`) to build on.

### 5.2 "Owner go nuts" - two threats, only one is in scope

- **Code mutation (upgrade rug):** bounded by §5.1's covenant-enforced policy.
- **Operator posts bad data through legit code** (a real oracle owner sets a fake price via its real setter):
  address real, code real, *input* a lie. **No reference mechanism defends this** - it is data-source trust,
  same as trusting Chainlink signers in Solidity. Economic/redundancy mitigation; out of scope here.

## 6. The cost (honest trade-offs vs the category-keyed alternative)

Choosing EVM address parity means choosing **self-pinning, unique-address instances** (each instance bakes its
category → distinct redeem script → distinct address). Consequences:

- **Single-phase deploy; address is pre-computable (CREATE2-like).** A token category ID is **the txid of the
  parent transaction whose output 0 is consumed** by a "token genesis input" - *not* the genesis
  transaction's own txid (CHIP-2022-02-CashTokens). So the category is a **known value before deploy**: pick a
  UTXO with outpoint index 0, its parent txid *is* the category `C`. There is **no circularity** - bake `C`
  into the redeem script, compute `addr = hash(template + C)`, and in a single genesis transaction spend that
  vout-0 UTXO and pay the state NFT (category `C`) to `addr`. The address is fully determined in advance.
  (SolidCash's current deploy already derives the category from a genesis input; the only addition is baking
  that already-known category into the constructor args.)
- **No shared-bytecode "intermix" topology.** The category-agnostic, one-script-many-instances model
  (reference by category) is *not* the address-parity model and address-handle dispatch is **forbidden** on it
  (§4.2). It remains expressible for users who explicitly want it, but it is non-EVM-parity. Intermix under the
  address model = co-spending several unique-address instances, each checked by its address (works; loses only
  the shared-script byte savings - same as EVM CREATE2 instances).
- **An `address` is the 35-byte P2SH32 locking bytecode**, not EVM's 20. Semantics match (opaque
  callable+payable handle); width does not. (+3 bytes vs the bare hash - a minor commitment-packing cost.)

These are the deliberate prices of dropping `derive()` for true address parity.

## 7. Specification

### 7.1 `address`

`address` is **its own type** (the existing `AddressType`), **not** an alias to `bytesN` or to `bytes`. It is
VM-represented as a **variable-length locking bytecode** (≈ unbounded `bytes`), with *explicit* casts to/from
`bytes` - this preserves type safety, the address operations (`.send`/`.connect`/`.call`/`IContract(addr)`),
and Solidity parity (Solidity's `address` ≠ `bytes20`). It is **not** fixed-width: locking bytecode is 35
bytes for p2sh32, 23 for p2sh20, 25 for p2pkh, so `address` (which also denotes EOA/wallet recipients) cannot
be `bytes35`. An address is used directly: stored, compared (`==`, `!= address(0)`), passed, dispatched
through, **and** used as the recipient scriptPubKey - it is exactly what `OP_UTXOBYTECODE`/`OP_OUTPUTBYTECODE`
return. `address(0)` = the empty/all-zero locking bytecode (no real contract matches) - a clean null sentinel.

A **contract handle** (an interface type `IFoo`) is a *distinct* type carrying "this is contract C" for
dispatch; its *value* is specifically the **35-byte p2sh32 locking bytecode** of a stateful contract. The
type system tracks it as the contract type - no `bytes35` is introduced. So the addressable feature does not
add a width-typed address; it only changes *what value* an `address`/`IFoo` handle carries (category-baked
locking bytecode) and the call semantics.

**Identity and location coincide.** Because the address *is* the locking bytecode, the call/compare identity
and the recipient/location encoding are the **same value** - no duality, no conversion (unlike the rejected
32-byte-hash option, which would convert at every use; see §2). The bare 32-byte script hash is just the
middle of the locking bytecode and is rarely needed in-script.

`address(this)` = `OP_INPUTINDEX OP_UTXOBYTECODE` (the contract's own 35-byte locking bytecode), serving both
identity and recipient roles. (If the bare script hash is ever needed, it is `hash256(OP_ACTIVEBYTECODE)` -
self-output). The compiler picks by use-site.

### 7.2 `IContract(addr).method(arg)` lowering

`method(arg)` is realized by **co-spending** the callee (its UTXO is an input, its covenant runs) and reading
its result via introspection / the existing `_Return_` event flow. The caller covenant MUST:

1. **Identity+integrity (one direct check):** `require(OP_UTXOBYTECODE(inputN) == addr)` - `addr` is the
   35-byte locking bytecode, so this is a single comparison, no conversion. For a self-pinning callee this *is*
   the integrity guarantee (§3.1): the callee's covenant, having been spent, already enforced its category and
   transition.
2. **Interaction:** read the callee's state (view) / constrain its output (state-changing) / consume its
   return blob - exactly the current external-call/`_Return_` machinery, keyed on the verified address.

No category appears at the call site. The caller stays address-agnostic at compile time (`addr` is a
runtime parameter/field).

### 7.3 Self-pinning (callee obligation) - DEFAULT for stateful contracts

**Decision:** **every stateful contract self-pins by default** (no opt-in). Self-pinning is irrelevant to
**stateless** contracts - they have no readable state to forge, so they are addressable for free via the bare
`OP_UTXOBYTECODE == addr` check (§3.2) and are left untouched. (Self-pinning matters exactly for contracts
whose state - data NFT / entry NFTs / commitments - a caller can read.)

A self-pinning stateful contract:
- takes its state-NFT category as a (compiler-injected) constructor arg, baked into the redeem script → part
  of the address;
- enforces `OP_INPUTINDEX OP_UTXOTOKENCATEGORY == bakedCategoryWithCapability` **once in the contract
  prologue** (before the dispatcher / at the top of a single inlined function), so it runs on **every spend** -
  including `selfdestruct`/`unsafe` functions, which skip only their function-*body* covenant code (run after
  the prologue via `OP_INVOKE`) and so cannot bypass the prologue pin. A stateful contract's spent UTXO is
  always its master = the **minting NFT** (capability `0x02`), and capabilities never change, so the baked
  value is `category(internal) || 0x02` (33 bytes) and the compare is **direct** - no capability-byte split.
  This also pins the capability. (One ~4-byte check, not per function; empirically verified across the e2e
  suite incl. delegate/upgrade/selfdestruct.) Combined with self-preservation, the invariant is inductive from
  genesis;
- the **data NFT** and **entry NFT** self-pin their category on the read path (Stage 2). This is the enabler
  for **master-free cross-contract reads** (§3.3): a reader reads B's sub-NFT *without co-spending B's master*,
  so there is no master to anchor the sub-NFT's category to - the sub-NFT must carry its own integrity. The
  self-pin (`OP_UTXOTOKENCATEGORY(self) == bakedCategory‖capability`, capability `0x01` for these mutable NFTs)
  makes a fabricated UTXO at the sub-NFT's address - correct bytecode, foreign token category - **unspendable**,
  so any co-spent UTXO at that address necessarily carries the genuine category `C` and thus genuine committed
  state. The reader therefore needs only `OP_UTXOBYTECODE(readOnlyDataNft) == <data-NFT address>` (the sub-NFT
  address, which bakes `C`), and the sub-covenant - having run because it was spent - guarantees the rest. This
  is the sub-NFT analogue of the master self-pin: it bridges `address ⟹ (code, genuine state)` for the sub-NFT
  in isolation. The pin is **NOT** applied to the **token container** (its UTXO carries the *held* token X, so
  `category==C` would reject every spend), the **satoshi container** (indeterminate category), or the **event
  NFT** (write-only, no read path). Cost: the byte-for-byte covenant mirrors (`build*CovenantScript` in
  `state.ts` + the compiler `emit*Lbc` reconstructions) must stay in lockstep.

  > **History.** An earlier revision skipped Stage 2 as "redundant," on the reasoning that the reader anchors
  > every sub-NFT's category to a co-spent, self-pinned master. That holds *only* when reads co-spend B's
  > master. We instead make reads **master-free** (co-spending B's master to read would make B's master a global
  > lock, serializing all of B's activity against every reader - §3.3). Master-free reads require the sub-NFT to
  > self-pin, so Stage 2 is reinstated as the enabler, not redundant.

The compiler emits and proves this, and surfaces an `addressable` flag in the artifact so a caller's
`IContract(addr)` can rely on `addr ⟹ state`. (A future `agnostic` opt-out for the shared-script topology is
deferred - YAGNI.)

This is a **breaking change**: stateful contract addresses change (the category is now baked), and deploy must
supply the category. Stateless contracts are unaffected.

### 7.4 Interface upgrade stance

The interface declares the callee's stance:

```
immutable interface IOracle { function price() external view returns (uint256); }

proxy interface IVault {                 // upgradeable behind a stable proxy address
    // policy carried in the proxy's self-pinned commitment, one of:
    //   impl codeHashes [0x.., 0x..]    // allowlist of implementation CODE hashes (§2, args-excluded -
    //                                   // authorizes the code, independent of per-instance args), immutable
    //   governor <category> timelock 144
    function deposit(uint256 amount) external;
}
```

- `immutable` ⇒ caller emits only the address check (§7.2.1); `addr ⟹ (fixed code, state)`.
- `proxy { policy }` ⇒ the address is the stable proxy address; the caller additionally `require`s the proxy's
  committed implementation policy meets the interface's bar.

### 7.5 Deploy

Single-phase (§6): pick a UTXO with outpoint index 0; its parent txid is the category `C`; bake `C` into the
constructor args → `addr = hash(template + C)` is known in advance; in one genesis transaction spend that
vout-0 UTXO and pay the state NFT (category `C`) to `addr`. The address is pre-computable (CREATE2-like).

## 8. EVM-parity mapping

Ports cleanly:
- `IContract(addr).viewFn()` / `.stateFn(arg)` → co-spend + `OP_UTXOBYTECODE==addr` + read/constrain.
- storing/comparing/passing `address`; `address(0)` null sentinel; `address(this)`.
- upgradeable deps via a stable proxy address (the EVM proxy idiom, one-to-one).

Differs (inherent):
- **synchronous return mid-call** → **co-spend introspection** (callee is an input; you read its output, no
  CALL return; no reentrancy).
- **`token.transferFrom(...)`** → a **CashTokens covenant move**, not a code call (ERC-20 isn't a contract).
- EVM globals `.balance`, `msg.value`, `code.length`: no direct analogue.
- addresses are 35 bytes (the locking bytecode; semantics parity, not width).

## 9. Compiler enforcement (normative)

1. `IContract(addr)` MUST verify `OP_UTXOBYTECODE(input) == addr` directly (`addr` = 35-byte locking bytecode;
   §2) and MUST NOT use `derive`/category at the call site.
2. A **stateful** callee referenced by address MUST be **self-pinning** (§7.3); the compiler MUST prove this
   and reject category-agnostic stateful contracts behind an address handle (the §4.1 forgery).
3. Stateless callees may be addressed with the same check (nothing to forge).
4. `proxy` interfaces MUST emit the implementation-policy check; the proxy code (hence proxy address) MUST be
   fixed/immutable so the handle is stable.
5. `address` is the 35-byte locking bytecode; `address(this)` = `OP_INPUTINDEX OP_UTXOBYTECODE`, serving both
   identity and recipient roles with no conversion.
6. A cross-contract **sub-NFT read** (caller reads the callee's data/entry NFT) is **master-free**: it co-spends
   only the sub-NFT and verifies `OP_UTXOBYTECODE(readOnlyDataNft) == <sub-NFT address>`. Soundness comes from
   the sub-NFT's **self-pin** (Stage 2, §7.3), which makes any co-spent UTXO at that address carry the genuine
   category `C` (a fabricated foreign-category UTXO there is unspendable). The caller MUST NOT need to co-spend
   the callee's master to read - co-spending it would make the master a global lock on the callee.

## 10. Phased plan (implementation order: 1 -> 2 -> 3 -> 4)

Address-dispatch must be gated on self-pinning for safety, so self-pinning lands first. Self-pinning is **on
by default** for every stateful contract (no flag) - it is the default-addressable decision, landed directly.

0. **Done** - `this.categoryId` introspection (the self-category primitive).
1. **Self-pinning (callee) - DONE.** Implemented by reworking the existing dead salt (no new ctor arg): the
   SDK bakes the category as a verify **prologue** `<category||0x02> OP_INPUTINDEX OP_UTXOTOKENCATEGORY
   OP_EQUALVERIFY` (the master is always the minting NFT, so the 0x02 capability is baked and compared
   directly - no split). Runs before ctor args + dispatch -> one contract-level check covering
   selfdestruct/unsafe. On by default for every stateful contract (the categoryId, already threaded as the
   salt, is now the `category` self-pin segment; `salt` freed for the separate user CREATE2 segment). Address
   commits to the category + capability. deployFrom children remain un-self-pinned (compiler-side follow-up).
   Full SDK + compiler suites green.
2. **Sub-NFT self-pin (data + entry NFT) - the master-free-read enabler.** Add the capability-baked self-pin
   to the read path of the data NFT (`C‖0x01`) and entry NFT (`C‖0x01`) covenants in `state.ts`, with the
   compiler `emit*Lbc` mirrors in lockstep (the "5 pairs" surface). This lets a reader trust a co-spent sub-NFT
   by its address alone, with no master anchor (§7.3). NOT the token/satoshi containers (foreign/indeterminate
   category) nor the event NFT (no read path). Negative test: a fabricated-category sub-NFT must be unspendable.
3. **Address dispatch (caller).** `address` = locking-bytecode value. **Calls** `IContract(addr).method()` ->
   co-spend B's master + `OP_UTXOBYTECODE(B_master) == addr` (B's master self-pin from Stage 1 gives genuine
   state) + `_Return_`. **Reads** `IContract(addr).stateVar` -> co-spend B's sub-NFT only (master-free) +
   `OP_UTXOBYTECODE(readOnlyDataNft) == <sub-NFT address>` (Stage 2 self-pin gives genuine state). `address(this)`
   = `OP_INPUTINDEX OP_UTXOBYTECODE`; remove `connect(categoryId)` and `address.connect(category)` entirely.
   Gated on 1 + 2.
4. **Proxy upgradeability.** `immutable`/`proxy` interface stances + impl-policy commitment + caller policy
   check, on the existing delegate mechanism.
5. *(Deferred, YAGNI)* `agnostic` opt-out for the shared-script topology.

## 11. Open questions

- Self-pinning proof: how the compiler statically certifies `category == bakedArg` is enforced on *all* spend
  paths, and how that flag is represented in the artifact for callers to trust.
- Address value: **resolved** - `address` = the **35-byte locking bytecode** (§2). It is the in-script native
  currency (what `OP_UTXOBYTECODE`/`address(this)` return and every covenant compares; 52 bytecode-comparison
  ops in the generator), so identity == location == introspected value with **zero conversion** and a 1-op
  call check. The 32-byte-hash alternative was rejected: it would convert at every use (in-script ops matter
  more than the +3 stored bytes) and would resurrect an identity/location duality.
- Proxy policy layout (allowlist root vs inline list; governor+timelock encoding) and how `address(this)`
  behaves inside a proxy vs its implementation.
- The category-agnostic opt-*out* (`agnostic`): deferred (YAGNI) - add only if a concrete shared-script need
  arises. Until then there is one model: stateful = self-pinning.
