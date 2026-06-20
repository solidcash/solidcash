# External contract calls & dynamic dispatch (Solidity-parity model)

Status: **design spec** (not yet implemented). Captures the model for `IContract(address).method(arg)` on the
BCH UTXO/CashTokens substrate, with the explicit goal of staying as close to Solidity/EVM dynamic dispatch as
the chain allows. Normative rules use MUST/SHOULD.

## 1. Goal

Make `IContract(addr).method(arg)` - Solidity's dynamic dispatch - the recurring, idiomatic way to call
another contract in SolidCash, with EVM-equivalent *safety* and as much EVM-equivalent *ergonomics* as the
UTXO model permits. A single value (`addr`) identifies a callee; you pass it around, compare it, and call
through it.

## 2. Background: what an "address" is on each chain

| | EVM | BCH (SolidCash) |
|---|---|---|
| code identity | bound to the account by the protocol | P2SH32 **locking bytecode** = hash of code+args |
| state identity | bound to the account by the protocol | NFT **category** = genesis txid (mint-once) |
| the handle | one `address` binds **both** | code and state are **independent** primitives |

The decisive asymmetry:

- A **locking script only governs how a UTXO is *spent*** - it never attests to what that UTXO *contains*.
  Anyone can pay a UTXO to any address with any token category and any commitment, permissionlessly, running
  no code. So **code-on-a-UTXO does not imply "this code produced this state."**
- A **category is mint-once** at genesis and (under self-preservation) its commitment only evolves through the
  contract's own covenant. So **category implies genuine state.**

Therefore the faithful BCH equivalent of an EVM address - the thing that binds code+state integrity - is the
**category**, *not* the locking bytecode. This is the foundational claim of this spec.

> **Claim 1.** EVM `address` ≈ BCH **category**. EVM `address` ≠ BCH locking bytecode.

## 3. Core principle: derive the address from the category

A Solidity contract-identity address is a pure function of the category:

```
addr = derive(categoryId)
```

`derive` MUST be deterministic and collision-resistant. Two encodings:

- **Identity** - `addr = categoryId` (32 bytes). Verification `categoryId == addr`. Collision resistance:
  exact (none possible). Simplest covenant. **Recommended baseline.**
- **hash160** - `addr = hash160(categoryId)` (20 bytes), BCH's native address derivation. Verification
  `hash160(categoryId) == addr`. Collision resistance 2^160 (infeasible). Use only where a port genuinely
  needs Solidity's 20-byte address width (bit-packing, `uint160` casts); accept the 160-bit bound.

Because `derive` is public and pure, **no registry and no central party** is involved: anyone can derive any
instance's address from its (public) category and verify it locally. This is the decentralized answer.

Normative:
- The compiler MUST verify the co-spent callee against the category, never the locking bytecode alone:
  `require(derive(OP_UTXOTOKENCATEGORY(inputN)) == addr)`.
- `derive` MUST operate on the canonical 32-byte category id in **internal** byte order (the order
  `OP_UTXOTOKENCATEGORY` yields), with the capability byte stripped, consistently on both the stored address
  and the introspected value. (Mismatch here silently breaks honest matches and invites loosening the check -
  see [[regtest_category_byteorder_bug]].)

## 4. Threat model & forgery analysis

The transaction builder / SDK is **untrusted**: it chooses every input and every output. The covenant is the
only arbiter. A design is safe only against what *passes the covenant*.

### 4.1 The code-only forgery (why fixing locking bytecode is fatal)

Suppose Contract1 verifies a callee by **locking bytecode only** (no category):

1. Attacker genesis's their own category `CX` (dust cost) with a lying commitment.
2. Attacker pays a UTXO **to the callee's P2SH32 address** bearing `CX` + the lie (permissionless; runs no code).
3. SDK co-spends Contract1 + that UTXO. A **category-agnostic** callee covenant accepts the spend (it
   introspects "my category = `CX`, my state = lie", enforces a valid-looking transition - it cannot see that
   `CX` is illegitimate).
4. Contract1 checks locking bytecode ✓, reads the commitment = lie, acts on it. **Total state injection**
   (oracle manipulation, fund drain).

Severity: **critical**, mountable by the SDK alone.

### 4.2 Why the category defeats it

`derive(category) == addr` checks the **category**, which the attacker cannot forge (mint-once; no preimage at
2^160/exact). So the fabricated `CX` fails the check. Forgery via §4.1 is dead.

### 4.3 Residual trust = Solidity parity, not a regression

After §4.2 the only remaining trust is **"was `storedAddr` set to a legitimate category's derivation?"** -
i.e. who is allowed to write Contract1's `token`/`callee` field. This is *identical* to Solidity (controlling a
stored `address` redirects calls). The derivation neither adds nor removes this; it is decentralized data set
by whoever the dapp trusts. No registry needed.

### 4.4 The two-direction rule (when each verification mode is sound)

Two implications must not be conflated:

- **`category ⟹ code` (self-preservation):** a genuine `C` token can only sit under the contract's code,
  because the covenant preserves its own NFT under its own script on every spend. ⇒ verifying **by category**
  also gives you the code. Holds for any self-preserving stateful contract.
- **`code ⟹ category` (self-pinning):** a UTXO with the contract's code can *only validly hold* its one
  category (the covenant rejects spends with any other). ⇒ verifying **by address/locking-bytecode** also
  gives you the category. Holds **only** when the code hard-pins its category (= unique code → unique
  address = Scenario B in §6).

| target | code ⟹ category? | address-only safe? |
|---|---|---|
| category-agnostic shared code (Scenario A) | NO | **NO - forgeable (§4.1)** |
| self-pinning / salted (Scenario B) | YES | YES |
| stateless (no NFT) | n/a | YES (nothing to forge) |

> **Claim 2.** Address-only verification is sound *iff* the target is stateless or provably self-pins its
> category. For shared-code instances, category verification is mandatory.

## 5. The trilemma and its resolution

Every external call wants three properties; static pinning gives at most two:

- **Integrity** - the state is real (anti-hacker, §4).
- **Authenticity** - the logic is what you expect (anti-owner-rug).
- **Adaptability** - upgrade / swap instance / intermix (anti-overconstraint).

Fix locking bytecode → lose integrity. Fix category → lose authenticity (owner mutates code under the fixed
category). Fix both → lose adaptability.

**The trap is treating code-trust as a static, caller-side pin.** Resolution - assign each property to its
rightful owner:

1. **Integrity belongs to the category - always.** Anchor every external read on `derive(category)==addr`.
   Non-negotiable.
2. **Authenticity belongs to the *callee*, as a genesis-committed, covenant-enforced governance fact** that
   the caller *reads from the unforgeable state* - not a caller pin. (This is the unlock; see §5.1.)
3. **Adaptability is preserved by treating `addr` as a runtime value, never a hardcoded constant.** Different
   instances = different handles; intermix and dynamic dispatch are free.

The key enabler: on BCH the callee's **state commitment is itself category-anchored and unforgeable**, so the
callee can publish its own code-governance into its state and the caller can trust it - something EVM can't do
cleanly cross-contract.

### 5.1 Resolution by upgrade stance

**Immutable callee (default, trilemma-free).** A non-upgradeable contract self-preserves under *fixed* code ⇒
`category ⟹ exact code, forever`. The single derived address therefore delivers all three properties at once:
integrity (mint-once), authenticity (code can't change), adaptability (runtime handle, intermixable). **No
trilemma** - the "fix both" you feared is achieved without any caller pin, because the callee's own
immutability binds code to category. This SHOULD be the default an interface expresses.

**Upgradeable callee (trilemma is real and partly inherent).** Upgradeability *is* trusting an upgrader, so
"owner go nuts" can be **bounded, not eliminated**. The callee carries a **genesis-committed, covenant-enforced
upgrade policy** in its commitment - e.g. an immutable allowlist of permitted code-hashes, or
`{governorCategory, timelock}`. The covenant enforces that every upgrade stays within the policy *and*
preserves the policy. The caller verifies "current code-hash ∈ committed allowlist" (or "governed by G with
delay D"). The owner can upgrade - but only to what they pre-committed, in the open. This is **strictly
stronger than an EVM proxy**, where the admin typically upgrades to anything.

### 5.2 "Owner go nuts" is two threats - separate them

- **Code mutation (upgrade rug):** defended by §5.1's committed/enforced policy.
- **Operator feeds bad data through legit code** (an oracle owner posts a fake price via the real setter):
  category real, code real, *input* a lie. **No reference mechanism defends this** - it is data-source trust,
  identical to trusting Chainlink signers in Solidity. Mitigation is economic/redundancy, out of scope for the
  reference model. Stated so it isn't conflated with the upgrade threat.

## 6. Deploy topologies (not either/or)

The *same category-agnostic code* supports two topologies; choosing one is a deploy decision, not a language
mandate. Keep contract code **category-agnostic** (it reads its own category by introspection, never hardcodes
one) so it serves both.

| | A: shared code, category-keyed, intermix | B: salted, unique address per instance |
|---|---|---|
| instance key | category (address shared across instances) | address (encodes salt/category; self-pins) |
| call-site ref | `IFoo(addr)` where addr = derive(category) | `IFoo(addr)` (address is unique) |
| disambiguation when N co-spent | by category (address is ambiguous) | by address |
| upgradeable | natural (code changes, category persists) | breaks (address pins code) |
| deploy cost | cheap; one script, N genesises | per-instance salt; bytecode variety |
| address-only safe? | **no** (§4.4) | yes (self-pins) |
| best for | marketplaces, pools, per-user vaults, upgradeable | singletons / small fixed set; registries/anchors |

A also gives **atomic co-spend of many instances with no reentrancy** - a composition primitive the EVM lacks;
do not sacrifice it chasing B. Trust chains that *must* be address-safe (e.g. a well-known anchor) should be
B-style self-pinning singletons.

## 7. Specification

### 7.1 The `address` type has two roles (the duality)

Solidity fuses them; BCH cannot (code and category are independent - you cannot derive locking bytecode from a
category). SolidCash MUST distinguish by use-site:

- **identity address** = `derive(category)` - for `IFoo(addr)`, equality/comparison, and `address(this)`
  *as identity*. This spec is about this role.
- **location address** = locking bytecode - for value sends and recipients (`addr.transfer(v)`).

A contract-typed value that must be both called and paid carries both facets internally. (The current
`address(this)` lowering to `OP_INPUTINDEX OP_UTXOBYTECODE` is the *location* address; the identity address is
`derive(OP_UTXOTOKENCATEGORY(OP_INPUTINDEX))`.)

### 7.2 `derive`

As §3: identity (recommended) or hash160 (20-byte compat). One choice per compilation/interface, applied
consistently to stored addresses, `address(this)`-as-identity, and the introspection check.

### 7.3 Interface declares the upgrade stance

The interface (not the call site) declares the callee's stance, which selects the caller's check:

```
immutable interface IOracle { function price() external view returns (uint256); }

upgradeable interface IVault {
    // policy carried in the callee's commitment; one of:
    //   codeHashes [0x.., 0x..]          // immutable allowlist of permitted code hashes
    //   governor <category> timelock 144 // governance category + min delay
    function deposit(uint256 amount) external;
}
```

- `immutable` ⇒ caller emits the category check only (category ⟹ fixed code).
- `upgradeable { policy }` ⇒ caller emits the category check **and** the policy check.

### 7.4 Commitment governance layout (callee side)

An upgradeable callee MUST carry, in its NFT commitment, a governance field its covenant enforces from genesis
and preserves across every spend/upgrade. Minimum shapes:

- **allowlist:** a Merkle root (or short list) of permitted code-hashes; upgrade transitions MUST target a
  member; the root is immutable.
- **governor+timelock:** a governor category + a min-delay; upgrades MUST be authorized by co-spending the
  governor and respecting the delay; the `{governor, timelock}` pair is immutable (or itself governor-bounded).

An immutable callee needs no field; its covenant simply forbids code change (self-preservation under fixed
code).

### 7.5 `IContract(addr).method(arg)` lowering (caller side)

`method(arg)` is realized by **co-spending the callee** (its UTXO is an input, so its covenant runs) and
reading its result via introspection / the existing `_Return_` event mechanism. The caller covenant MUST, in
order:

1. **Integrity:** `require(derive(OP_UTXOTOKENCATEGORY(inputN)) == addr)`.
2. **Authenticity (only if interface is `upgradeable`):** read the callee's committed governance from
   `OP_UTXOTOKENCOMMITMENT(inputN)` and `require` it meets the interface's bar (immutable / hash ∈ allowlist /
   governed). For `immutable` interfaces this step is omitted - category already ⟹ code.
3. **Interaction:** read the callee's state (view) or constrain its output (state-changing) or consume its
   return blob, exactly as the existing external-call/`_Return_` flow does today - but keyed on the verified
   category, not a pinned locking bytecode.

The caller's code MUST stay category-agnostic: `addr` is a runtime parameter/field, never a compile-time
category constant (preserves adaptability and intermix).

### 7.6 `address(this)`

- as **identity**: `derive(OP_UTXOTOKENCATEGORY(OP_INPUTINDEX))` (runtime-computed from the contract's own
  category).
- as **location** (recipient/self-output): `OP_INPUTINDEX OP_UTXOBYTECODE` (current behavior).

The compiler selects by use-site (compared/passed/called → identity; transfer recipient → location).

## 8. EVM-parity mapping - what ports and what differs

Ports cleanly:
- `IContract(addr).viewFn()` / `IContract(addr).stateFn(arg)` → co-spend + category-verified read/constrain.
- passing, storing, comparing `address` handles; `address(0)` as a null sentinel (no real category derives to
  it).
- `address(this)` (identity).

Differs (inherent, not a gap to "fix"):
- **Synchronous return mid-execution** → BCH **co-spend introspection** (the callee is an input; you read its
  output, you don't receive a CALL return). Re-entrancy does not exist.
- **Value send to a contract** needs the **location** address (locking bytecode), not derivable from the
  category - separate pass (§7.1).
- **`token.transferFrom(...)`** maps to a **CashTokens covenant move**, not an external code call - ERC-20 is
  not a contract on BCH.
- **EVM globals** `.balance`, `msg.value`, `code.length` have no direct analogue.

## 9. Compiler enforcement (normative)

1. MUST forbid address/locking-bytecode-only external **state** reads/calls against a stateful target (the
   §4.1 exploit). Hard error.
2. MUST allow address-only **only** for stateless targets, or targets the compiler can prove self-pin their
   category (Scenario B).
3. MUST treat a locking-bytecode pin as **defense-in-depth on top of** a category check, never a substitute.
4. For `upgradeable` interfaces, MUST emit the §7.5(2) policy check; MUST refuse to *pin code* against an
   upgradeable interface (latent post-upgrade breakage).
5. MUST keep `derive` byte-order/capability handling canonical and identical on both sides (§3).
6. SHOULD default interfaces to `immutable` (trilemma-free) and require explicit opt-in for `upgradeable`.

## 10. Phased plan

1. **Identity address from category** - `derive`, the `address(this)`-as-identity lowering, and the category
   integrity check in `IFoo(addr)`. (This is the forgery-critical core and the bulk of contract-ref code.)
2. **Interface upgrade-stance** - `immutable` vs `upgradeable { policy }`, the commitment governance layout,
   and the caller policy check.
3. **Location/identity duality** - value-send-to-contract via the location address; recipient addresses.
4. **Deploy ergonomics** - learning an instance's address post-genesis; optional B-style salting for
   singletons/anchors.

## 11. Open questions

- `derive`: commit to identity (32B) as the canonical address, with hash160 (20B) as an explicit opt-in? Or
  pick one globally?
- Governance layout: fixed struct vs a small DSL in the `upgradeable { ... }` block; Merkle allowlist vs
  inline list size limits.
- How an interface asserting `immutable` is *checked* against the callee (the callee must be provably
  non-upgradeable - via its own compiled covenant property, surfaced in the artifact).
- Cross-contract chains (A→B→C) under category handles + per-hop policy checks (interplay with the existing
  transitive external-call resolution).
- Whether `address(this)` should default to identity under `solidityImportCompat` (closer to Solidity) while
  staying location elsewhere.
