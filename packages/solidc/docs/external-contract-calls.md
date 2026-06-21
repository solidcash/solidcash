# External contract calls & dynamic dispatch (EVM-parity address model)

Status: **design spec** (not yet implemented). Model for `IContract(address).method(arg)` on the BCH
UTXO/CashTokens substrate, with the explicit goal of **EVM address parity**: an `address` *is* the contract's
on-chain address, passed/compared/called directly, with no derivation or transformation. Normative rules use
MUST/SHOULD.

## 1. Goal

`IContract(addr).method(arg)` is *the* way to call another contract. `addr` is a first-class value identical
in role to an EVM address: you store it, compare it, and dispatch through it. **No `derive()`, implicit or
explicit** - the value you hold is the address, full stop. Calls must have EVM-equivalent *safety* and as much
EVM-equivalent *ergonomics* as the chain allows.

## 2. What "address" is, on each chain

| | EVM | BCH (SolidCash) |
|---|---|---|
| address = | hash of code (CREATE2: `hash(deployer, salt, codehash)`) | **P2SH32 script hash** = hash of the redeem script (code + baked args) |
| address ⟹ code | yes (protocol-bound) | **yes** (P2SH: only that script hashes to that address) |
| address ⟹ state | yes (protocol-bound storage) | **not for free** - see §3 |

So the EVM-parity address on BCH is the **P2SH32 script hash**. It is 32 bytes rather than 20, and parity is
in *semantics* (address = hash-of-code, compared directly), not width. (Stateful contracts are p2sh32 only -
see [[Only p2sh32 for Stateful Contracts]] - so contract addresses are 32 bytes by construction.)

`IContract(addr).method()` verifies the co-spent callee with a **direct address comparison**:

```
require( OP_UTXOBYTECODE(inputN) == addr )      // (or its 32-byte hash); no derivation
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
require( OP_UTXOBYTECODE(inputN) == addr )
```

and the callee's own covenant - which ran *because it was spent* - did the integrity work. This is precisely
the EVM model: the callee's code executes on the call and enforces its own invariants. No category check, no
derivation at the caller.

### 3.2 Stateless callees

A stateless / pure-covenant contract has no NFT to forge. `address ⟹ code` is sufficient; the address handle
is trivially safe with the same `OP_UTXOBYTECODE == addr` check.

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
- **Addresses are 32 bytes** (p2sh32 hash), not 20. Semantics match; width does not.

These are the deliberate prices of dropping `derive()` for true address parity.

## 7. Specification

### 7.1 `address`

`address` (contract identity) is the callee's **p2sh32 locking-script hash** (32 bytes), used directly:
stored, compared (`==`, `!= address(0)`), passed, and dispatched through. No derivation. `address(0)` is the
all-zero hash (no real script hashes to it) - a clean null sentinel.

Note the existing **location/identity duality** dissolves favorably here: the contract address *is* the
locking-script hash, so the contract-identity address and the recipient/location address coincide (as in EVM).
`address(this)` = the spent input's own script hash (`hash(OP_INPUTINDEX OP_UTXOBYTECODE)` or the introspected
hash), usable both to be called and to be paid.

### 7.2 `IContract(addr).method(arg)` lowering

`method(arg)` is realized by **co-spending** the callee (its UTXO is an input, its covenant runs) and reading
its result via introspection / the existing `_Return_` event flow. The caller covenant MUST:

1. **Identity+integrity (one check):** `require(OP_UTXOBYTECODE(inputN) == addr)`. For a self-pinning callee
   this *is* the integrity guarantee (§3.1): the callee's covenant, having been spent, already enforced its
   category and transition.
2. **Interaction:** read the callee's state (view) / constrain its output (state-changing) / consume its
   return blob - exactly the current external-call/`_Return_` machinery, keyed on the verified address.

No category appears at the call site. The caller stays address-agnostic at compile time (`addr` is a
runtime parameter/field).

### 7.3 Self-pinning (callee obligation)

Any **stateful** contract that may be referenced by address MUST self-pin:

- take its state-NFT category as a constructor arg (baked into the redeem script → part of the address);
- covenant MUST enforce `OP_UTXOTOKENCATEGORY(self) == bakedCategory` on every spend, and preserve the NFT
  under its own code (self-preservation), so the invariant is inductive from genesis.

The compiler MUST verify this property and surface it in the artifact, so a caller's `IContract(addr)` can rely
on `addr ⟹ state`. A stateful contract lacking it MUST NOT be addressable (it would be §4.1-forgeable).

### 7.4 Interface upgrade stance

The interface declares the callee's stance:

```
immutable interface IOracle { function price() external view returns (uint256); }

proxy interface IVault {                 // upgradeable behind a stable proxy address
    // policy carried in the proxy's self-pinned commitment, one of:
    //   impl codeHashes [0x.., 0x..]    // immutable allowlist of implementation hashes
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
- addresses are 32 bytes (semantics parity, not width).

## 9. Compiler enforcement (normative)

1. `IContract(addr)` MUST verify `OP_UTXOBYTECODE(input) == addr` and MUST NOT use `derive`/category at the
   call site.
2. A **stateful** callee referenced by address MUST be **self-pinning** (§7.3); the compiler MUST prove this
   and reject category-agnostic stateful contracts behind an address handle (the §4.1 forgery).
3. Stateless callees may be addressed with the same check (nothing to forge).
4. `proxy` interfaces MUST emit the implementation-policy check; the proxy code (hence proxy address) MUST be
   fixed/immutable so the handle is stable.
5. `address(this)` is the contract's own script hash, serving both identity and recipient roles.

## 10. Phased plan

1. **Address handle** - `address` = p2sh32 hash; `IContract(addr).method()` lowering to `OP_UTXOBYTECODE==addr`;
   `address(this)` as script hash.
2. **Self-pinning** - constructor-baked category + covenant invariant + the compiler proof/artifact flag; gate
   address-dispatch on it.
3. **Proxy upgradeability** - `proxy` interface + implementation-policy commitment + caller policy check, on
   the existing delegate mechanism.
4. **Deploy** - SDK bakes the (already-known, vout-0-parent-txid) category into the constructor args; single
   genesis tx; the address is pre-computable.

## 11. Open questions

- Self-pinning proof: how the compiler statically certifies `category == bakedArg` is enforced on *all* spend
  paths, and how that flag is represented in the artifact for callers to trust.
- Address value: full locking bytecode vs the 32-byte hash as the canonical `address` representation (hash is
  leaner; bytecode avoids a hash op).
- Whether self-pinning (addressability) is **opt-in** (a contract marker; coexists with category-agnostic A)
  or the **default** for EVM parity. Opt-in keeps A's shared-bytecode intermix available; default maximizes
  Solidity-likeness. (Self-pinning makes each instance's address category-dependent, hence unique.)
- Proxy policy layout (allowlist root vs inline list; governor+timelock encoding) and how `address(this)`
  behaves inside a proxy vs its implementation.
- Whether to keep the category-agnostic, category-referenced topology at all as an explicit non-parity escape
  hatch, or drop it to keep one model.
