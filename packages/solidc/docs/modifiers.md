# SolidCash modifiers

A reference for every modifier keyword SolidCash accepts, with EVM behavior and SolidCash behavior side by
side. "Modifier" here means any keyword that decorates a declaration: data-location / lifetime modifiers on
variables, visibility and mutability modifiers on functions and state, inheritance modifiers, the BCH-specific
covenant-control modifiers, and user-defined `modifier` definitions.

## Why the semantics differ

SolidCash targets Bitcoin Cash Script, a UTXO model, not the EVM account model. Three facts shape every
entry below:

- **No persistent contract storage.** State lives in CashToken "data NFT" UTXOs that the covenant pins and
  re-creates each spend. There are no storage slots, no `SSTORE`/`SLOAD`.
- **One spend = one execution.** A contract script runs exactly once per spend, top to bottom, with no
  nested or re-entrant calls into the same script. There is no transaction-scoped scratch storage and no call
  stack between contract functions.
- **The script is the locking condition.** Each externally-callable function is one branch of the redeem
  script (an "unlock path"), selected by a 4-byte selector. "Calling" a function means spending a UTXO down
  that branch. Cross-contract interaction is co-spending covenants, not message calls.

Some Solidity modifiers map cleanly, some are accepted purely so real `.sol` sources compile (see
[solidity-import-compat.md](./solidity-import-compat.md)), and some have no EVM analog at all.

## Overview

| Modifier | Category | Applies to | Status in SolidCash |
| --- | --- | --- | --- |
| `constant` | data / lifetime | top-level def, var | compile-time inlined (def) / write-protected (var) |
| `immutable` | data / lifetime | state var | set-once in constructor, then read-only |
| `transient` | data / lifetime | state var | lowered to per-function zero-init local |
| `memory` | data / lifetime | param, local | accepted, no-op (warned) |
| `calldata` | data / lifetime | param, local | accepted, no-op (warned) |
| `storage` | data / lifetime | local | write-through alias for a collection entry |
| `packed` | data / lifetime | array / struct state | dense single-blob state field |
| `public` / `external` | visibility | function | unlock path (entry point) |
| `internal` / `private` | visibility | function | inlined only, not an unlock path |
| `public` / `external` | visibility | state var | readable cross-contract (synthesized interface) |
| `internal` / `private` | visibility | state var | not externally readable |
| `pure` / `view` | mutability | function | accepted, NOT enforced |
| `payable` | mutability | function | accepted (porting); enables `msg.value` |
| `virtual` | inheritance | function | no-op (warned) |
| `override` / `override(A,B)` | inheritance | function | enforced via C3 linearization |
| `unsafe` / `unsafe(N)` | covenant | function | disables covenant checks (tiered) |
| `upgrade` | covenant | function | allows the contract bytecode to change |
| `deploy` | covenant | function | may mint child contracts |
| `selfdestruct` | covenant | function | collapses all state UTXOs |
| `delegate` | covenant | function | proxy-implementation side (delegatecall) |
| `split(n)` / `merge(n)` | covenant | function | thread fan-out / fan-in |
| `modifier f() { _; }` | user-defined | function | inlined at the `_` placeholder |

---

## Data location and lifetime

### `constant`

Two distinct uses share the keyword.

| | EVM | SolidCash |
| --- | --- | --- |
| Top-level `T constant X = expr;` | Inlined at compile time; no storage slot | Inlined at every use site; no data NFT field, zero state cost |
| `constant` on a parameter / local | n/a (not a Solidity local modifier) | Write-protected binding; assigning it is a `ConstantModificationError` |

### `immutable`

| EVM | SolidCash |
| --- | --- |
| Assigned once in the constructor, then baked into the deployed bytecode (no SLOAD). | Assigned once in the constructor, then read-only. **It still lives in the data NFT**, not the bytecode; the covenant just rejects any write outside `constructor`. Tagged `immutable: true` in the artifact. |

Difference to flag: an EVM `immutable` is a bytecode constant; a SolidCash `immutable` is a write-once *state*
field. A SolidCash value that should be bytecode-embedded is a constructor argument or a `constant`.

### `transient` (EIP-1153)

| EVM | SolidCash |
| --- | --- |
| Transaction-scoped storage (`TSTORE`/`TLOAD`): persists across calls within one transaction, zeroed when the transaction ends. Headline use is a cheap reentrancy guard. | No analog (no transaction-scoped storage, and one spend = one execution with no re-entry). Lowered to the sound equivalent: a per-function local, zero-initialized at the start of every spend. Dropped from the state layout; a transient-only contract stays stateless. Warned. |

Full treatment: [solidity-import-compat.md](./solidity-import-compat.md), "transient state variables".

### `memory` / `calldata`

| EVM | SolidCash |
| --- | --- |
| Data location for reference-type params/returns. `memory` is mutable scratch RAM; `calldata` is the read-only, cheaper call input. One is required on reference types. | Accepted for porting and ignored (warned): the BCH VM has only a stack, so all locals and params already live on-stack. Neither changes codegen. |

### `storage`

| EVM | SolidCash |
| --- | --- |
| A storage pointer: `T storage p = m[k];` makes `p` a reference; writes through `p` mutate the storage slot. | A compile-time alias: `T storage p = container[k];` records the access path and drops the declaration. Every read/write of `p` is rewritten to `container[k]`, so it is write-through like Solidity, but it is a syntactic alias resolved at compile time, not a runtime pointer. |

### `packed`

| EVM | SolidCash |
| --- | --- |
| Not a state-variable keyword. Solidity auto-packs multiple small vars into one 32-byte slot; `abi.encodePacked` is an unrelated encoding helper. | An explicit state-layout choice for a bounded array / struct state var: pack the whole value into a single dense blob field in the data NFT, instead of the default sparse collection (one UTXO per element). See [arrays.md](./arrays.md) and [structs.md](./structs.md). |

---

## Visibility

On BCH every externally-callable function is a branch of the redeem script. Visibility decides whether a
function becomes such a branch.

### Functions: `public` / `external` vs `internal` / `private`

| | EVM | SolidCash |
| --- | --- | --- |
| `public` / `external` | Callable from outside the contract (ABI entry). | Compiled into the dispatcher as an unlock path with a 4-byte selector. This is how the function is spent. |
| `internal` / `private` | Callable only internally (`internal` also by derived contracts). No ABI entry. | Not exposed as an unlock path; only inlined into callers. Cannot be spent directly. |

There is no separate `external` vs `public` calling-convention cost on BCH; both are entry points. At most one
visibility modifier is allowed.

### State variables: `public` / `external` vs `internal` / `private`

| | EVM | SolidCash |
| --- | --- | --- |
| `public` | Compiler synthesizes a getter function. | No getter is generated. The var is added to the contract's synthesized interface so other contracts can read it cross-contract via `IFoo(category).var`; in-contract reads use `this.var`. |
| `internal` / `private` | `internal` visible to derived contracts; `private` to the declaring contract only. | Excluded from the synthesized interface; not readable cross-contract. Default visibility is `public`. |

---

## State mutability

### `pure` / `view`

| EVM | SolidCash |
| --- | --- |
| Enforced. A `view` function that writes state, or a `pure` function that reads state, is a compile error. | Accepted for porting but **not enforced**: the compiler does not verify that a `view` function avoids writes or a `pure` function avoids reads. They are documentation only. They are still combination-checked (cannot sit on covenant modifiers). |

Treat `pure`/`view` as annotations, not guarantees, when porting.

### `payable`

| EVM | SolidCash |
| --- | --- |
| A function must be `payable` to receive ETH; sending value to a non-payable function reverts. | There is no value-rejection gate: every spend inherently moves satoshis. `payable` is accepted for porting and makes `msg.value` (the contract's satoshi balance delta) meaningful. Combination-checked: external-only, not `pure`. |

---

## Inheritance

### `virtual`

| EVM | SolidCash |
| --- | --- |
| Marks a function as overridable; required for a base function to be overridden. | No-op (warned): all inherited functions are implicitly overridable. |

### `override` / `override(A, B)`

| EVM | SolidCash |
| --- | --- |
| Required when overriding; the explicit base list disambiguates multiple inherited definitions. | Enforced through real C3 linearization. The optional base list is validated (each named base must be an ancestor that declares the function), and overridden ancestors are retained as `__base_<Contract>_<fn>` for `super.f()` / `Base.f()` resolution. |

---

## Covenant control (BCH-specific)

These have no general EVM analog: they tune the UTXO covenant the compiler emits to protect a stateful
contract's state, value, and identity across a spend. All require a **stateful** contract (has state vars,
collections, or events) and must be externally callable. See
[external-contract-calls.md](./external-contract-calls.md), [call-model.md](./call-model.md), and
[selfdestruct.md](./selfdestruct.md).

### `unsafe` / `unsafe(N)`

The default covenant re-creates the master NFT (category, capability, locking bytecode, commitment), preserves
value, and verifies every state output. `unsafe` removes checks by tier:

| Tier | What is still enforced |
| --- | --- |
| `unsafe` / `unsafe(0)` | Nothing. Full bypass. |
| `unsafe(1)` | Master NFT (category + capability + locking bytecode) and minting uniqueness. |
| `unsafe(2)` | Tier 1, plus value (satoshi) preservation (`input <= output`). |

No EVM analog: the EVM has no covenant to relax. A bare `unsafe` is dangerous (arbitrary state writes); the
compiler warns at every tier. State writes, entries, events, transfers, deploy, and external calls are not
allowed in an `unsafe` body.

### `upgrade`

| EVM | SolidCash |
| --- | --- |
| Upgradeability is a pattern (a proxy that `delegatecall`s a swappable implementation), not a keyword. | A function modifier that relaxes only the master's locking-bytecode self-pin, so the spend may move state to a master with *different* bytecode while keeping category and capability. This is the migration primitive. SDK: `StatefulContract.upgrade()`. |

### `deploy`

| EVM | SolidCash |
| --- | --- |
| `new C(...)` / `CREATE` / `CREATE2` issue a child-creating sub-call from any function. | A modifier marking a function that may mint child contracts (`new Child(...)`). The covenant verifies the child's master and data-NFT genesis outputs (a factory covenant). SDK: `StatefulContract.deployFrom()`. See also create2 self-pin in [external-contract-calls.md](./external-contract-calls.md). |

### `selfdestruct`

| EVM | SolidCash |
| --- | --- |
| `selfdestruct(addr)` deletes the account and forwards its balance to `addr` (post-EIP-6780, only within the creating transaction). | A function modifier (auto-implied when the body contains a `selfdestruct(addr)` statement): collapses all state UTXOs (master, data NFTs, entries, events, containers) with no master re-creation. The statement form additionally pins `tx.outputs[0].lockingBytecode == addr`, exactly one output, and fee `< 2000` sats. SDK: `destroy()` / `selfdestructTo()`. |

Full treatment: [selfdestruct.md](./selfdestruct.md).

### `delegate`

| EVM | SolidCash |
| --- | --- |
| `delegatecall` runs another contract's code in the caller's storage context. | The implementation side of that pattern. A `delegate` function is co-spent by a proxy and operates on the proxy's state: it receives the proxy's master input index (passed via the altstack), verifies the proxy's minting capability and self-preservation, and skips its own full state covenant (the proxy owns that). Cannot itself contain a `delegatecall`. |

Blocked with every other covenant modifier (see the matrix below).

### `split(n)` / `merge(n)`

No EVM analog: a UTXO can be split into parallel threads and merged back, which the account model cannot
express.

| | SolidCash |
| --- | --- |
| `split(n)` | Fans one master out into `n` threads: `[master] -> [master_preserved, new_minting_1..n, change]`. Each thread is an independent minting NFT owning a partition of the data NFTs, enabling concurrent spends. SDK: `ThreadManager.split()` / `StatefulContract.split()`. |
| `merge(n)` | Fans `n` threads back into one, verifying value and FT are conserved into the surviving master. SDK: `ThreadManager.merge()`. |

Written as a custom-modifier invocation naming an integer parameter, e.g. `function fork(int n) split(n) { ... }`
(`split`/`merge` are synthesized from that form, not standalone grammar keywords). The count parameter must
exist on the function and be an integer.

---

## User-defined modifiers

`modifier name(args) { ...; _; }` works as in Solidity.

| EVM | SolidCash |
| --- | --- |
| The modifier body wraps the function; `_` marks where the function body runs. Multiple modifiers nest. | Same surface, resolved by inlining at compile time: each applied modifier is expanded right-to-left (innermost first), substituting the function body for each `_` placeholder (cloned if `_` appears more than once). At least one `_` is required. Parameters are renamed per invocation so the same modifier can be applied twice without collision. |

There is no runtime modifier dispatch; after expansion the function is a single inlined body.

---

## Combination rules

Validated in `SymbolTableTraversal.validateModifiers`. The general rules:

- **At most one** visibility modifier; **no duplicate** modifiers.
- `pure` / `view` cannot combine with any covenant modifier (those mutate state) or with `payable`.
- The covenant modifiers `unsafe`, `upgrade`, `deploy`, `selfdestruct`, `delegate`, `split`, `merge` are
  **mutually exclusive** with each other.
- Every covenant modifier requires a **stateful** contract and an **externally callable** function
  (not `internal` / `private`).
- `split` and `merge` are mutually exclusive and need a valid integer count parameter.
- `unsafe(N)` requires `N` in `{0, 1, 2}`.
- `delegate` bodies cannot contain a low-level `delegatecall`.

Accepted-but-inert: `virtual` (no-op, warned); `memory` / `calldata` (no-op, warned); `pure` / `view`
(unenforced). `payable` is inert as a value gate but enables `msg.value`.

## See also

- [solidity-import-compat.md](./solidity-import-compat.md) - which Solidity modifiers are porting affordances
- [selfdestruct.md](./selfdestruct.md) - the `selfdestruct` modifier and statement
- [external-contract-calls.md](./external-contract-calls.md) - `deploy`, create2, cross-contract reads
- [call-model.md](./call-model.md) - the BCH call / covenant model
- [arrays.md](./arrays.md), [structs.md](./structs.md) - `packed` and the state-layout models
