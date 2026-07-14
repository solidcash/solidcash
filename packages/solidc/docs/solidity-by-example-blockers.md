# solidity-by-example corpus: compiler blockers

A coverage run of the [solidity-by-example](https://github.com/solidity-by-example/solidity-by-example.github.io)
corpus (152 standalone contracts under `examples/solidity-by-example/contracts/src/`, all `^0.8.26`, MIT)
through `solidc` with `solidityImportCompat`. Goal: surface the blockers to prioritize compiler work.

Re-run: `node examples/solidity-by-example/bench.mjs` (scorecard) then `categorize.mjs` (buckets).

## Baseline

**4 / 152 compile as-is**: `state-variables/SimpleStorage`, `events/Events`, `unchecked-math/UncheckedMath`,
`app/multi-sig-wallet/TestContract`. The other 148 fail - **121 at parse, ~27 at semantic**. Most failures are
a handful of recurring gaps; many files hit several at once, so fixing the top tiers unblocks far more than
their individual counts suggest.

## Run results (2026-06-20): 4 -> 18 / 152

Implemented this run (committed; full solidc suite green at each step). The scorecard is a lagging metric -
many files carry several blockers, so the error *distribution* moved much more than +14:

- **D** reserved-word collisions: soft-keyword `anyIdentifier` rule (mirrors Solidity's `identifier: Identifier
  | From | Error | Revert | ...`), used in name + expression-read positions. Softened the implicit-token
  keywords `deploy delegate upgrade selfdestruct unsafe packed entries error global revert` - all
  keyword-collision parse errors eliminated. Still reserved (lexer token-types, would need lexer surgery to
  split): the Bitcoin types `pubkey`/`sig`/`datasig` and number units `bits`/`sats`/`finney`/`satoshis`/
  `bitcoin`; and member-access on a soft name (`s.error`) is not yet softened. - DONE (partial)
- **A** state-variable inline initializers (lowered into the constructor) - DONE
- **B** multiple top-level contracts per file (last = primary, earlier = available) - DONE
- **C** `payable` on constructors (accepted, ignored) - DONE
- **E** events/errors interleaved in interface/contract bodies - DONE
- **F** array return types, unnamed parameters, uninitialized array locals, bare indexed `delete` - DONE
- **G** `uint256`/`uintN` <-> `int` compatibility (one unbounded VM integer) - DONE
- **H** `address(int)` cast + bytes/hex address literals - DONE
- **I** enum-typed state variables - DONE
- **Crash fix** contract/interface-typed params/returns (undefined type -> address fallback) - DONE

- **FinalRequire relaxation** - two parts. (1) Always-on, safe: an *unconditional* require/assert/revert/
  timeop anywhere in a function gates the whole path (codegen appends `OP_1` after trailing statements), so
  `require(authorized); _mint(...)` no longer needs the require to be last. (2) Under `solidityImportCompat`: a
  void path that verifies *nothing* and changes no state downgrades from a hard error to a warning (compiles
  as an unconditionally-spendable path, matching Solidity). It stays a **hard error by default** so SolidCash
  contracts can't silently expose an always-spendable UTXO. - DONE

- BCH crypto-type / number-unit identifier collisions: split `pubkey`/`sig`/`datasig` out of `PrimitiveType`
  into a `CryptoType` token and the BCH value units `satoshis`/`sats`/`finney`/`bits`/`bitcoin` out of
  `NumberUnit` into a `BchUnit` token, then accept both in name + expression positions (via `anyIdentifier`)
  as well as their original type/unit positions. All such collisions cleared; no regression to the types/units
  themselves. - DONE

### Now supported (were mis-classified as EVM-only)

- low-level **`addr.call{value:}(data)` / `staticcall` / `delegatecall`** - SolidCash already models low-level
  calls (returns `(bool, bytes)`); the `{value:}` call-option path was just resolving the target type from
  `node.object.type` (unset during SymbolTableTraversal) instead of the symbol table - fixed.
- **`(bool, bytes memory) = ...` tuple destructuring** with a data-location modifier in a slot.
- **`ether`/`gwei`/`wei` value units** (nominal on BCH, accepted for porting).

### Remaining - fundamental (EVM, won't map to BCH)

- inline **Yul assembly** (`:=`, `switch`, `if`, `for`, `mstore`/`tstore`) - `Unexpected token ':'` etc.
- **external calls via state-var of interface type** (`token.transferFrom(...)`, `pool.token0()`) - the bulk
  of the `UndefinedReferenceError`s; invoking a separately-deployed contract and receiving a return mid-tx has
  no BCH analogue (the closest is the co-spend `IFoo(category).method()` constraint, a different shape).
- EVM globals `.balance`, `msg.value`, `address(this).code.length`.

## Tier 1 - high impact, clean BCH mapping (fix first)

### A. State-variable inline initializers (35 files)
`Mismatched input '=' expecting ';'`. SolidCash requires state init in the constructor; Solidity allows
inline:
```solidity
uint256 public count = 123;
uint256[] public arr = [1, 2, 3];
uint256 private constant DURATION = 7 days;     // also: visibility-before-constant, and `days` time unit
bool public paused = false;
```
Fix: allow `stateVariableDeclaration` (and `constant`) to take `('=' expression)?`; lower the initializer into
the (implicit) constructor. Sub-items surfaced here: visibility may precede `constant`; time-unit literals
(`days`, `hours`, `weeks`).

### B. Multiple top-level definitions per file (31 files)
`Mismatched input 'contract'/'interface'/'library' expecting <EOF>`. The grammar accepts one trailing
`contract|library`. Real files routinely declare several:
```solidity
contract MerkleProof { ... }
contract TestMerkleProof is MerkleProof { ... }
```
Fix: `sourceFile` should accept a sequence of contract/interface/library definitions (compile each; the
artifact set or a designated primary). This is the single biggest structural gap.

### C. `payable` on constructors / functions (8 files)
`Unexpected token 'payable'`, e.g. `constructor(...) payable checkBalances(_balances) { }` and
`function f() public payable`. Fix: accept (and ignore, no native value on BCH) `payable` in the
constructor/function modifier positions where Solidity allows it.

## Tier 2 - grammar, medium impact

### D. Reserved-word collisions with common identifiers (~7 files)
SolidCash keywords shadow ordinary Solidity names, so valid code fails to parse:
| identifier | reserved as | example |
|---|---|---|
| `transaction` | (reserved) | `Transaction storage transaction = ...` (MultiSigWallet) |
| `pointer` | (reserved) | `returns (AddressSlot storage pointer)` (Slot) |
| `sig` | type | `signature/Signature.sol` |
| `bits` | (reserved) | `bitwise/Bitwise.sol` |
Fix: make these contextual keywords (allow as identifiers where unambiguous) or trim the reserved set.

### E. `event` / `error` declaration placement (4 + 3 files)
`Unexpected token 'event'` / `'error'`. Body rules order members strictly; real code interleaves them - e.g.
`interface IERC20 { function ...; event Transfer(...); }` (events after functions in an interface body, in
`hacks/vault-inflation/VaultInflation.sol`). Fix: allow `eventDefinition`/`errorDefinition` anywhere in
contract AND interface bodies (the contract body was already relaxed; interface bodies still order them).

### F. Array-type positions + tuples (~7 + ~5 files)
`Unexpected token '['` / `Mismatched input '[' expecting ...` / `Unexpected token ','`. Array types and
tuple returns in positions the grammar misses (e.g. `function f() returns (uint[] memory)`,
`(uint a, uint b) = ...`, array params). Needs a per-case audit.

### F2. Misc syntactic gaps (1 file each)
- **Storage-pointer locals**: `MyStruct storage x = myStructs[1];` (`data-locations/DataLocations.sol:19`) -
  `storage` isn't a recognized data-location modifier, so the var name is misparsed. (Semantically a
  write-through reference - tricky on UTXO; at minimum parse it, treating `storage` like `memory`.)
- **`fallback` with `returns`**: `fallback(bytes calldata data) external payable returns (bytes memory)`
  (`fallback/FallbackInputOutput.sol:12`) - `fallbackDefinition` has no `returns` clause.
- **Postfix `--`/`++` in expression position**, `do { } while`, etc. surfaced as one-offs.

## Tier 3 - semantic / type-system friction

### G. `uint256` vs `int` incompatibility (5+ files)
`ReturnTypeMismatchError`/`AssignTypeError`/`StateAssignTypeError: Type 'int' can not be assigned to ...
'uint256'`. `uint256` is a bounded `IntType` that rejects plain-`int` values and int literals; Solidity uses
`uint256` ubiquitously. Decision needed: treat `uint256` (and `uintN`) as compatible with `int` (the BCH VM
has one unbounded integer), i.e. relax the bounded-int assignability rules.

### H. `address(<int>)` casts (2 files)
`CastTypeError: Type 'int' is not castable to type 'address'` - `address(0)`, `address(uint160(x))`. Allow
int->address casts (address is locking-bytecode; `address(0)` is the common "zero address" sentinel).

### I. enum-typed state variables (2 files)
`UnsupportedStateTypeError`/`UnknownContractTypeError: Type 'Status'`. Enums work as locals but not as state
var types. Allow enum state vars (encode as their backing int).

### J. constructor inheritance arguments (2 files)
`ParentInvocationArgCountError: Parent constructor 'ERC20' expects 0 arguments but got 3` - base-constructor
args via `MyToken is ERC20` / `constructor() ERC20("n","s",18)`. Needs parent-constructor parameter threading.

## Tier 4 - fundamental (EVM, do not map)

- **Yul assembly** `:=`, `switch`, `case`, `for`, `if` (~12 files): `assembly { let x := ... }`. EVM Yul.
- Low-level `.call`/`delegatecall` slot manipulation, `code.length`, create2 raw bytecode.

## Compiler bugs (fix regardless)

- **Crash**: `TypeError: Cannot read properties of undefined (reading 'toString')` -
  `app/erc20/TokenSwap.sol`. A codegen/semantic path dereferences undefined; should be a clean diagnostic.
- `UnsupportedArrayElementTypeError: ... 'undefined'` (1) - likely the same class of missing-type-resolution.

## Not blockers (expected)

- `LibraryNotCompilableError` (4) / `AbstractContractNotCompilableError` (1): interface-only / abstract files
  compiled **directly** (they compile fine when imported). The bench compiles every file standalone.
- `EmptyContractError` (2): marker/guard contracts with no functions.

## Suggested attack order

1. **A** (state-var initializers) + **B** (multiple defs per file) - unblocks the most files and is prereq
   for almost everything else.
2. **C** (payable), **E** (event/error placement), **D** (reserved-word collisions).
3. **G** (uint256<->int) - removes a pervasive semantic friction once parsing succeeds.
4. **H**, **I**, **J**, **F** - case by case.
5. Fix the **crash** in TokenSwap whenever its parse path is reached.

Tier 4 (Yul/low-level) is out of scope - EVM substance with no BCH mapping.
