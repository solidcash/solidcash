# Solidity import compatibility and porting notes

This documents `solidityImportCompat` and the language-level features added so real Solidity sources (the
Sablier exercises) compile as SolidCash with minimal edits. Tests: `test/PortingFixes.test.ts`,
`test/SafetyDefaults.test.ts`.

## `solidityImportCompat`

A `CompilerOptions` flag scoped to compiling Solidity *source*: import/parse handling plus the few source-level
semantics that differ between the two languages and so cannot be a SolidCash default. When set:

- `.sol` files are parsed as SolidCash (the import resolver also tries `.sol` candidates).
- `pragma solidity ...` is accepted (treated like `pragma solidcash`); the version constraint is not enforced.
- `block.timestamp` lowers to `tx.locktime` instead of the native oracle-backed register (see
  docs/block-and-transaction-properties.md). The native default is the oracle register.
- A `0x..` hex literal coerces to a big-endian integer in any integer context (assignment, argument, return,
  comparison, ...). Natively a `0x..` literal is a *bytes* value (the deliberate inverse of Solidity, where
  `0x..` is a number), so these uses are a type error without the flag. See "Hex literals" below.
- An empty *regular* function body is synthesized to `return <defaults>` / `require(true)`. Natively this is an
  `EmptyFunctionError`; empty `receive()`/`fallback()` are exempt (synthesized by default, see below).

It adds no EVM execution semantics. Without it, a `.sol` pragma is a clean error pointing at the flag.

These behaviors used to be gated behind this flag but are now plain SolidCash defaults (they help porting but
never relax soundness, so they apply to every compilation):

- A spending path that performs no `require()`/verification and changes no state compiles to an
  unconditionally-spendable script. This is a **warning** by default; pass `enforceFinalRequire: true` to turn
  it back into a hard `FinalRequireStatementError` (e.g. for CI). A `selfdestruct` function with no `require()`
  stays a hard error regardless of the option - it skips all covenant codegen, so a missing guard means any
  caller can trigger the destruction.
- Empty `receive()`/`fallback()` synthesize a state-preserving no-op spend path (`require(true)`), with a
  warning. They are idiomatic in Solidity and need no flag.

### Hex literals

Solidity's `0x..` is a *number* literal whose concrete type is context-driven (Solidity docs: "Conversions
between Literals and Elementary Types"): it converts implicitly to an integer type if it fits, or to `bytesN`
only when the hex-digit count is exactly `2N` (zero converts to any `bytesN`). SolidCash natively treats `0x..`
as a `bytes` value (the deliberate inverse), so the reinterpretation is gated behind the flag.

Under solidityImportCompat a `0x..` literal coerces to its big-endian integer value in every **integer
context**: variable init, (state/local) assignment, mapping value, constant, return, function/internal-call
argument, and comparison/binary op. A non-integer target (`bytesN` etc.) keeps the native bytes literal, so
`bytes2 b = 0x1234;` is unchanged in both modes. The coercion is value-preserving but does not enforce
Solidity's exact size/fit rules (SolidCash's integer model is unbounded); multi-overload resolution and
constructor-argument positions are not covered. Tests: `test/PortingFixes.test.ts` (hex describe),
`test/e2e/PortingRuntime.test.ts`.

## Features added while porting

Each was surfaced by a real Solidity line and has a clean BCH mapping.

- **`uint`** as the unbounded unsigned int (alias of the unbounded `int`).
- **Constructor visibility** (`public`/`internal`) accepted and ignored (optional since Solidity 0.7.0).
- **`Library.Type`** member-type syntax in type position (resolves to the bare registered type).
- **`address(this)`** -> `OP_INPUTINDEX OP_UTXOBYTECODE` (the spent contract UTXO's locking script).
- **Visibility on interface functions** accepted and ignored.
- **`using ... for ...` inside library bodies.**
- **Declaration order not enforced** at file and contract level (free functions, state vars, events,
  constants may appear in any order).
- **Uninitialized declarations** zero-init via the same path as `delete`.
- **`address` as an event parameter type.**
- A returning function that **reads a mapping** does not crash (its result is returned in an output, like a
  logged event).
- **Public state-var / mapping getters** synthesized as real dispatchable entry-point functions
  (`T x` -> `x() returns (T)`, `mapping(K=>V) m` -> `m(K) returns (V)`), so a callee invoked through its getter
  (e.g. `timeLock.lockTime(addr)`) has a target the caller can resolve + selector-verify. Restricted to plain
  value types; enum/contract/address/struct/array/nested-mapping getters are skipped (placeholder types resolve
  differently pre-semantic, and complex getters differ in ABI shape).
- **Declaration-only files compile to a minimal artifact** (ABI + empty bytecode), mirroring solc. A file with
  no executable contract - a standalone `interface`, a file-level `enum`/`struct`, or an inline-only `library` -
  is a valid Solidity compilation unit. The artifact carries the primary interface's ABI and any declared
  enums/events/errors, with `bytecode: ''` and `isLibrary: true` (not instantiable). Without the flag, native
  solidcash keeps the `LibraryNotCompilableError` guard.

### Surfaced by the modern Sablier Flow port

- **Qualified event emit** `emit I.E(...)` (qualifier stripped; resolves by bare name; positional + named).
- **Named-arg external call** `obj.f({a: x})` (reordered against the interface function's params).
- **`error` declarations inside libraries** (imported errors propagate to the importing file).
- **Qualified + named custom-error revert** `revert Lib.Err(args)` / `revert Err({a: x})`.
- **Visibility/mutability on free + library functions** accepted and ignored.
- **Interface-only / type-only files** (no trailing `contract`/`library`) parse and are importable.
- **Named-arg call statement** `f({a: x});` (the named-arg call form now works as a statement too).

## State-variable access compatibility

Solidity reads/writes state variables by bare name (`x`, `balances[user]`), with locals in an inner scope
shadowing them; `this.` is only for external calls. SolidCash historically required `this.` for all state
access. To narrow the gap (verified against solc `DeclarationContainer::resolveName`: innermost scope first,
recursing outward only on a miss):

- **Bare reads** resolve to state when no local shadows the name: `x`, `m[k]`, `m[k1][k2]`, `m[k].field`.
- **Bare writes**: `x = v`, `x op= v`, `m[k] = v`, `m[k] op= v`, `m[k].field = v`, `m[k].field op= v`,
  `m[a][b] = v` (scalar, element, member, and nested, including compound).
- **Compound assignment on state** (also for the `this.` forms): `this.x op= v`, `this.m[k] op= v`,
  `this.m[k].field op= v`, for `op` in `+ - * / % << >>` (and `& | ^` on byte types). Each desugars to
  `target = target <op> rhs` and is byte-for-byte identical to the hand-written form.

A single `assignmentStatement` grammar rule covers all `this.`-prefixed and bare-indexed lvalues; the
AstBuilder maps the lvalue shape to the existing assignment node and semantic analysis routes state vs local.
Bare scalar `x op= v` (and `x++`/`x--`) stay in `assignStatement`.

Resolution is the scope chain: a local/parameter is found first; only an unshadowed name falls through to a
state variable (SolidCash additionally rejects declaring a local that collides with a state name, so the two
never ambiguously coexist).

## `transient` state variables (EIP-1153)

Solidity's `transient` storage (EIP-1153, `TSTORE`/`TLOAD`) is a transaction-scoped slot: written and read
across calls within one transaction, then zeroed when the transaction ends. Its headline use is a cheap
reentrancy guard.

BCH has no transaction-scoped contract storage, and the execution model removes the need for one: a covenant
runs exactly once per spend with no nested/cross-contract call re-entering the same script. So the EIP-1153
feature has no analogue, and the reentrancy-guard use case is moot. SolidCash keeps the keyword for source
compatibility and lowers it to the sound analog: a `transient` state variable becomes a per-function local,
zero-initialized at the start of every spend.

- It is dropped from the persisted state layout (no data NFT field, no covenant overhead). A contract whose
  only state is transient stays stateless.
- In each function that references it, a `T name;` zero-init local is injected at the top, so a read-before-write
  sees 0 (matching "zeroed at transaction start") and writes are visible to the rest of that function body.
- It never persists across spends. Code that assumes a transient value survives can never satisfy its own
  invariant (the value always reads 0). This matches EIP-1153 between transactions; it differs only in that BCH
  has no within-transaction cross-call to carry the value, because that scenario cannot occur.

The compiler emits a warning per transient variable. A reentrancy-guard port compiles unchanged:

```solidity
contract Guard {
    uint256 transient locked;        // not persisted; a fresh 0 each spend
    function enter() public {
        require(locked == 0);        // always true (zero-init)
        locked = 1;                  // visible within this body only
        // ... protected logic ...
    }
}
```

## Sablier Flow exercise: where "compile as-is" stops

`solidityImportCompat` resolves every real import (`@openzeppelin@5.3.0`, `@prb/math@4.1.0`,
`@sablier/evm-utils@1.0.3`). After the features above, the interfaces and pure libraries parse; the remaining
blockers are EVM substance with no BCH mapping, not language gaps:

- inline `assembly ("memory-safe")` - in OZ `SafeERC20.sol` (`_callOptionalReturn` low-level `call`) and
  prb-math `Common.sol` (the fixed-point core: `msb`/`mulDiv`/`exp2`).
- ERC-721 internals (`_requireOwned`/`_update`) and external EVM contract calls (the comptroller).

The whole `SablierFlow.sol` contract body now parses (its `_streams[id].snapshotDebtScaled += x` and similar
bare member/compound state writes are supported); the first remaining blocker is `SafeERC20.sol`'s inline
assembly, reached during import resolution. That is an EVM wall, not a language gap.

Sablier Flow is an ERC-721 + comptroller + prb-math contract, so a full port does not converge. The working
record of the exercise (verbatim source, probe script, per-file results) lives under `examples/flow/scash/`.
