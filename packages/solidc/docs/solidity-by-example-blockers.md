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
| `deploy` | function modifier | `function deploy(...)` (Create2, Factory) |
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
