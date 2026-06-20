# Solidity import compatibility and porting notes

This documents `solidityImportCompat` and the language-level features added so real Solidity sources (the
Sablier exercises) compile as SolidCash with minimal edits. Tests: `test/PortingFixes.test.ts`.

## `solidityImportCompat`

A `CompilerOptions` flag. When set:

- `.sol` files are parsed as SolidCash (the import resolver also tries `.sol` candidates).
- `pragma solidity ...` is accepted (treated like `pragma solidcash`); the version constraint is not enforced.

It only changes parsing/resolution of imports; it does not add EVM semantics. Without it, a `.sol` pragma is a
clean error pointing at the flag.

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
