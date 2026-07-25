# SolidCash: Complete Feature Inventory Since v0.12.1 — Solidity Comparison

**Branch lineage:** `master` (v0.12.1) → `next` (51 commits, v0.13.0-next) → `future` (165 additional commits)
**Test coverage:** 263 compiler test contracts, 68 SDK e2e test suites

---

## Table of Contents

1. [Branch `next` — v0.13.0 Improvements](#1-branch-next--v0130-improvements)
2. [Branch `future` — Complete Language Overhaul](#2-branch-future--complete-language-overhaul)
   - [2.1 Type System](#21-type-system)
   - [2.2 Operators & Expressions](#22-operators--expressions)
   - [2.3 Control Flow](#23-control-flow)
   - [2.4 Functions](#24-functions)
   - [2.5 Contract Structure & Declarations](#25-contract-structure--declarations)
   - [2.6 State Management](#26-state-management)
   - [2.7 Mappings & Collections](#27-mappings--collections)
   - [2.8 Events & Errors](#28-events--errors)
   - [2.9 Inheritance & Modularity](#29-inheritance--modularity)
   - [2.10 Cross-Contract Interaction](#210-cross-contract-interaction)
   - [2.11 Contract Lifecycle Modifiers](#211-contract-lifecycle-modifiers)
   - [2.12 Special Variables & Introspection](#212-special-variables--introspection)
   - [2.13 Import System](#213-import-system)
   - [2.14 Inline Assembly](#214-inline-assembly)
   - [2.15 Literals & Units](#215-literals--units)
   - [2.16 Global Functions](#216-global-functions)
   - [2.17 Debugging](#217-debugging)
   - [2.18 Covenant Architecture](#218-covenant-architecture-stateful-contracts)
   - [2.19 SDK: Auto-Derivation System](#219-sdk-auto-derivation-system)
   - [2.20 SDK: Full Public API](#220-sdk-full-public-api)
   - [2.21 Compiler & Artifact](#221-compiler--artifact)
   - [2.22 Advanced Patterns](#222-advanced-patterns-demonstrated)
3. [Solidity Parity Comparison Matrix](#3-solidity-parity-comparison-matrix)
4. [Features SolidCash Has That Solidity Lacks](#4-features-solidcash-has-that-solidity-lacks)
5. [Features Solidity Has That SolidCash Lacks](#5-features-solidity-has-that-solidcash-lacks)

---

## 1. Branch `next` — v0.13.0 Improvements

### 1.1 BCH 2026 VM Target
Default VM target updated to `BCH_2026_05`. Script size and opcode limits updated to match the May 2026 BCH upgrade spec. VM supports `OP_BEGIN`/`OP_UNTIL` (unbounded loops) and `OP_DEFINE`/`OP_INVOKE` (function definition/invocation).

### 1.2 Loop Constructs
- **do-while**: `do { body } while (cond);` — executes at least once
- **while**: `while (cond) { body }` — standard pre-check loop
- **for**: `for (int i = 0; i < n; i = i + 1) { body }` — C-style with init/condition/update
- Loops can nest. `require()` detection works inside loops. `console.log()` supported in loop bodies
- Optimization: number comparison negation (`!(a < b)` → `a >= b`)
- Underlying opcodes: `OP_BEGIN ... condition OP_NOT OP_UNTIL` (do-while), `OP_BEGIN condition OP_IF body OP_0 OP_ELSE OP_1 OP_ENDIF OP_UNTIL` (while)

### 1.3 Bitshift & Invert Operators
- **Left shift**: `<<` — multiplies int, shifts bytes left
- **Right shift**: `>>` — divides int, shifts bytes right
- **Bitwise invert**: `~expr` — bitwise NOT
- Works on both `int` and `bytes` types

### 1.4 Unsafe Type Casting
Old "padding" casts removed. New explicit unsafe casts:
- `unsafe_int(bytes)` — interpret raw bytes as integer without type validation
- `unsafe_bool(expr)` — coerce any value to boolean (0 or 1)
- `unsafe_bytesN(int)` — cast int to fixed-size bytes (e.g., `unsafe_bytes4(x)`)
- `unsafe_byte(int)` — cast int to single byte
- `CastNode` gains `isUnsafe: boolean` field

### 1.5 `toPaddedBytes(value, size)`
Global function: converts an integer to a byte sequence of exactly `size` bytes, zero-padded. Signature: `toPaddedBytes(int, int) → bytes`.

### 1.6 Function Parameter Type Enforcing
Compiler injects runtime type checks for `bool` and `bytesX` parameters at function entry. Bytecode validates parameter encodings match expected types. Controlled by `--enforceFunctionParameterTypes` flag (default: on). When disabled, smaller bytecode but no runtime type safety.

### 1.7 Pay-to-Script (P2S) Support
New contract address type alongside P2SH20 and P2SH32. P2S contracts embed the full script in the output (no hashing). `Contract` class gains generic `TAddressType` parameter. Three address types: `'p2sh20' | 'p2sh32' | 'p2s'`. P2S has no `.address` property (no address concept); uses `.lockingBytecode` directly.

### 1.8 MockNetworkProvider Improvements
- `vmTarget` option in constructor
- `updateUtxoSet` (default: true) tracks UTXO creation/consumption across transactions
- `setBlockHeight()` for simulating blockchain state
- `sendRawTransaction()` validates UTXOs exist before spending

### 1.9 Boolean as Numeric
Booleans compile to numeric values (1 or 0) in script output, improving interoperability with arithmetic operations.

---

## 2. Branch `future` — Complete Language Overhaul

### 2.1 Type System

#### Primitive Types
| Type | Description |
|------|-------------|
| `int` | Unbounded integer (Bitcoin script native) |
| `bool` | Boolean (`true`/`false`), compiled as numeric 0/1 |
| `string` | UTF-8 string with escape sequences |
| `bytes` | Unbounded byte array |
| `pubkey` | 33-byte compressed public key |
| `sig` | Schnorr/ECDSA signature (up to 74 bytes) |
| `datasig` | Data signature (up to 66 bytes) |

#### Bounded Integer Types
- **Signed**: `int8`, `int16`, `int24`, ..., `int256` (step of 8 bits)
- **Unsigned**: `uint8`, `uint16`, `uint24`, ..., `uint256`
- Overflow/underflow checks: compiler emits `OP_DUP <min> OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP <max> OP_LESSTHANOREQUAL OP_VERIFY` after arithmetic
- `IntType` class with `signed`, `bits`, `minValue`, `maxValue`, `byteWidth` (sign-magnitude: `ceil((bits+1)/8)`)
- Implicit widening: `uint8` → `uint16` → ... → `uint256` (never narrowing)

#### Bounded Bytes Types
- `bytes1` through `bytes32` — fixed-size byte arrays (value types)
- `byte` alias for `bytes1`
- `BytesType` class with optional `bound` (1-32)

#### Fixed-Point Decimal Types
- **Signed**: `fixed`, `fixed128x18`, `fixedMxN` (M: 8-256 step 8, N: 0-80 decimal places)
- **Unsigned**: `ufixed`, `ufixed128x18`, `ufixedMxN`
- Stored as scaled integers: `1.5` in `fixed128x18` = `1500000000000000000n`
- `FixedType` class with `signed`, `bits`, `decimals`, `scaleFactor` (10^N), `minValue`, `maxValue`
- All existing integer opcodes work directly — no new VM opcodes needed
- **First smart contract language to fully implement fixed-point** (Solidity declared but never finished)
- `DecimalLiteralNode` preserves exact string representation; `.scaledValue(decimals)` converts to bigint

#### Address Types
- `address` — represents a locking bytecode
- `address payable` — address that can receive satoshis via `.transfer()`
- `payable(addr)` — cast address to payable
- `address(lockingBytecode)` — construct address from bytes
- Properties: `.balance`, `.code`, `.codehash`, `.connect(category).balance`
- Methods: `.call(data)`, `.staticcall(data)`, `.delegatecall(data)`, `.transfer(amount)`, `.send(amount)`
- `ConnectedAddressType` — address connected to a token category

#### User-Defined Value Types
```
type Price is int;
type TokenId is bytes32;
```
- Zero-cost wrapper types for type safety (prevents mixing `Price` and `Quantity`)
- Wrapping: `Price(myInt)` — explicit cast from underlying type
- Unwrapping: `int(myPrice)` — explicit cast to underlying type
- `ValueType` class with `name` and `underlyingType`

#### Enums
```
enum Color { Red = 1, Green, Blue }
```
- Can be defined at file level, contract level, interface level, or library level
- Explicit value assignment optional (auto-increments from 0 or last value)
- Members accessible as `Color.Red`
- `EnumType` class with `name` and `members: { name, value }[]`

#### Structs
```
struct User {
    bytes20 pkh;
    string name;
    int balance;
}
```
- File-level, contract-level, interface-level, or library-level definitions
- Nested structs: structs containing other structs
- Named initialization: `User({name: "Alice", balance: 100, pkh: 0x...})` — field order doesn't matter
- Positional initialization: `User(0x..., "Alice", 100)`
- Partial field assignment in stateful contracts: `this.users[key].name = newValue`
- Chained field writes in same function: `this.users[key].name = x; this.users[key].balance = y;`
- Arrays as struct fields: `struct Data { int[] items; }`
- `StructType` class with `name` and `fields: { name, type }[]`

#### Array Types
- **Fixed-size**: `int[5]` — compile-time known size
- **Dynamic**: `int[]` — runtime-sized
- **Multi-dimensional**: `int[3][]` (array of fixed arrays), `int[][]` (jagged)
- Array literal: `[1, 2, 3]`, `[[1, 0], [0, 1]]`
- Dynamic allocation: `new int[](n)` — creates array of size n
- Operations: `.push(value)`, `.pop()`, `.delete(index)`, `.length`, `array[index]`
- `ArrayType` class with `elementType` and optional `bound`

#### Packed Arrays (Fixed-Width Element Encoding)

Arrays in SolidCash use two internal encoding schemes, selected automatically based on whether the element type has a known fixed byte width:

```cash
bytes20[] packed addrs = [a, b];   // packed: O(1) access
int[] dynamicNums = [1, 256];      // variable-width: O(n) access
```

**Fixed-width types** (detected by `isFixedWidthType()`):
`bool` (1B), `bytes1`..`bytes32` (1-32B), `byte` (1B), `pubkey` (33B), `int8`..`int256` / `uint8`..`uint256` (1-32B sign-magnitude), `fixed`/`ufixed` variants, and structs whose every field is itself fixed-width.

**Variable-width types**: unbounded `int`, `bytes`, `string`, `sig`, `datasig`, and structs with any variable-width field.

**Encoding differences:**

| Aspect | Packed (Fixed-Width) | Unpacked (Variable-Width) |
|--------|---------------------|---------------------------|
| **Encoding** | `abi.encodePacked()` — tight packing, no per-element headers | `abi.encode()` — pushdata format with length prefix per element |
| **Element storage** | Exact `W` bytes each (e.g., `bytes20` = 20B, `uint8` = 1B) | Variable bytes with pushdata framing |
| **Index access** | **O(1)** — `index * W` byte offset, single `OP_SPLIT` | **O(n)** — loop scanning through `index` pushdata prefixes |
| **Push / Pop / Assign** | **O(1)** — direct byte-offset splice | **O(n)** — scan to target position |
| **On-chain cost** | Fewer opcodes, predictable cost | More opcodes, cost scales with index |

**O(1) access bytecode** (packed):
```
# Stack: [array_blob, index]
<W> OP_MUL          # byte offset
OP_SPLIT            # [left, right]
OP_NIP              # [right]
<W> OP_SPLIT        # [element, rest]
OP_DROP             # [element]
```
Fixed number of opcodes regardless of array size or element index.

**O(n) access bytecode** (unpacked):
```
# Stack: [array_blob, index]
OP_BEGIN            # scan loop
  # skip one pushdata-encoded element
  # decrement counter
  # exit when counter reaches 0
OP_UNTIL
# decode current pushdata element
```
Cost proportional to the index being accessed.

**Element encoding for packed arrays:**
- `bool`: canonical 1-byte form (`0x01` or `0x00`)
- `int8`..`int256` / `uint8`..`uint256`: `OP_NUM2BIN` converts VM number to exact-width sign-magnitude bytes
- `bytes1`..`bytes32`: already correct width, no conversion
- `pubkey`: already 33 bytes, no conversion
- Structs: fields concatenated at their respective fixed widths

**The `packed` modifier**: declared in grammar as a variable modifier (`modifier: 'constant' | 'packed' | 'memory' | 'calldata' | 'immutable'`). The compiler uses the `blobEncoded` flag on `ArrayNode`/`NewArrayNode` AST nodes to select the encoding path — when an array literal is assigned to a typed variable, `blobEncoded` is set to `true` and the element type determines packed vs. unpacked encoding automatically.

**Performance summary by type:**

| Element Type | Width | Access | Example |
|-------------|-------|--------|---------|
| `bool[]` | 1B | O(1) | `[true, false, true]` |
| `uint8[]` / `int8[]` | 1B | O(1) | `[0, 127, 255]` |
| `bytes20[]` | 20B | O(1) | Address lists |
| `bytes32[]` | 32B | O(1) | Hash lists |
| `int256[]` / `uint256[]` | 32B | O(1) | Large integers |
| `pubkey[]` | 33B | O(1) | Multi-sig key lists |
| `fixed128x18[]` | 17B | O(1) | Decimal arrays |
| `int[]` | Variable | O(n) | VM-native numbers |
| `bytes[]` | Variable | O(n) | Arbitrary data |
| `string[]` | Variable | O(n) | Text arrays |

#### Mapping Types
- `mapping(KeyType => ValueType)` — key-value store
- Nested: `mapping(K1 => mapping(K2 => V))` — multi-level nesting
- Array values: `mapping(K => int[3])`, `mapping(K => int[])`
- Struct values: `mapping(bytes20 => User)`
- `MappingType` class with `keyType` and `valueType`

#### Tuple Types
- `TupleType` with `elements: Type[]`
- Used for function multiple return values
- Tuple unpacking: `int x, int y = getTuple();` or `(int x, int y) = getTuple();`
- Tuple index access: `result[0]`, `result[1]`

#### Token Container Type
- `TokenContainerType` — represents `this.tokens[category]` access
- Properties: `.tokenAmount`, `.nftCommitment`, `.nftCount`
- Methods: `.transfer(recipient, amount)`, `.transferNft(recipient, commitment)`

#### Type Casting
Safe casts: `int(x)`, `bytes(x)`, `string(x)`, `address(x)`, `payable(x)`, bounded types
Unsafe casts: `unsafe_int(x)`, `unsafe_bool(x)`, `unsafe_bytes(x)`, `unsafe_bytesN(x)`
Implicit conversions: narrower → wider int, `address` → `bytes`, `address payable` → `address`

---

### 2.2 Operators & Expressions

#### Arithmetic
`+`, `-`, `*`, `/`, `%` — standard arithmetic on `int` and `fixed` types

#### Bitwise
`&` (AND), `|` (OR), `^` (XOR), `~` (NOT/invert), `<<` (left shift), `>>` (right shift)

#### Comparison
`<`, `<=`, `>`, `>=`, `==`, `!=`

#### Logical
`&&` (AND), `||` (OR), `!` (NOT)

#### Unary
`-` (negate), `!` (logical not), `~` (bitwise invert)

#### Special Operations
- `.length` — size of bytes/string/array
- `.reverse()` — reverse bytes
- `.split(position)` — split bytes at position (returns tuple)
- `.slice(start, end)` — extract sub-range from bytes
- `bytes.concat(a, b, c)` — concatenate multiple byte values
- `string.concat(a, b, c)` — concatenate multiple strings
- `+` on strings — string concatenation

#### Ternary
`condition ? ifTrue : ifFalse` — right-associative

#### ABI Encoding
- `abi.encode(args...)` — standard ABI encoding (bitcoin minimal encoding)
- `abi.encodePacked(args...)` — tightly packed encoding
- `abi.decode(data, (types...))` — decode ABI-encoded data
- `abi.decodeAt(data, (types...), offset)` — decode element at index

#### Type Introspection
- `type(int8).min`, `type(int8).max` — integer bounds
- `type(ufixed64x8).min`, `type(ufixed64x8).max` — fixed-point bounds
- `type(Color).min`, `type(Color).max` — enum bounds
- `type(IToken).interfaceId` — EIP-165 style interface ID (XOR of function selectors)
- `type(MyContract).name` — contract name as string literal

#### Field Access
- `expr.fieldName` — struct field access
- `expr.value`, `expr.lockingBytecode`, etc. — introspection field access
- `EnumName.MemberName` — enum member access

---

### 2.3 Control Flow

#### Conditionals
- `if (cond) { } else { }` — full branching with state writes in both branches
- Ternary `cond ? a : b` — expression-level conditional

#### Loops
- `for (int i = 0; i < n; i = i + 1) { }` — C-style for loop
- `while (cond) { }` — pre-check loop
- `do { } while (cond);` — post-check loop (executes at least once)
- `break;` — exit current loop
- `continue;` — skip to next iteration
- All loops compile to `OP_BEGIN`/`OP_UNTIL` (unbounded, no compiler-imposed iteration limits)
- Nested loops fully supported

#### Collection Iteration (3 variants)
```cash
// Variant 1: Key-value pairs (entries)
for (bytes20 key, int value of this.balances.entries) { ... }

// Variant 2: Keys only
for (bytes20 key in this.balances) { ... }

// Variant 3: Values only
for (int value of this.balances) { ... }
```
- Keyword distinction: `of ... .entries` (entries), `in` (keys), `of` (values)
- `CollectionIterationMode` enum: `ENTRIES`, `KEYS`, `VALUES`
- Works on mappings and arrays
- Each iteration decodes NFT commitment for key/value/both
- Synthetic `_collectionIterCount_N` parameter injected (SDK must provide count)

#### Error Recovery
- `try expr { } catch { }` — catches reverts from external function calls
- `catch ErrorName(params) { }` — catch specific custom error
- `catch (bytes data) { }` — catch with raw error data
- Multiple catch clauses supported

#### Return
- `return expr;` — single return value
- `return (expr1, expr2, ...);` — tuple return with optional parentheses

---

### 2.4 Functions

#### Visibility
| Keyword | Meaning |
|---------|---------|
| `public` | Callable from anywhere (default for regular functions) |
| `private` | Only within defining contract |
| `internal` | Within contract and derived contracts |
| `external` | Only from outside (default for fallback/receive) |

#### State Mutability
| Keyword | Meaning |
|---------|---------|
| `pure` | No state access or blockchain operations |
| `view` | Reads state but does not modify |
| `payable` | Can receive satoshis via `msg.value` |

#### Special Functions
- **Constructor**: `constructor(args) Parent1(args) Parent2(args) { }` — with parent invocations
- **Fallback**: `fallback(bytes input) external [payable] [virtual] [override] { }` — catches unknown selectors
- **Receive**: `receive() external payable { }` — catches empty-data calls (pure BCH receive)
- **Abstract functions**: `function name(params) virtual; ` — no body, must be overridden

#### Free Functions
- Top-level functions outside any contract: `function helper(int x) returns (int) { }`
- Implicitly internal, compiled to `OP_DEFINE`/`OP_INVOKE`
- Can be imported and called from contracts

#### Function Overloading
Multiple functions with same name but different parameter types:
```cash
function transfer(bytes20 to, int amount) { }
function transfer(bytes20 from, bytes20 to, int amount) { }
```

#### Return Values
- `returns (int)` — single return
- `returns (int, bytes, bool)` — multiple returns (tuple)
- Tuple unpacking at call site: `int a, bytes b = myFunction();`

#### Custom Modifiers
```cash
modifier onlyOwner(pubkey pk, sig s) {
    require(checkSig(s, pk));
    _;
}

function withdraw() onlyOwner(ownerPk, ownerSig) { }
```
- `modifier name(params) { statements; _; statements; }` — `_` is the placeholder for the function body
- Multiple modifiers per function: `function f() mod1() mod2() { }`
- Modifiers with parameters
- Modifiers can be inherited

#### Virtual & Override
```cash
contract Base() {
    function getValue() virtual returns (int) { return 1; }
}
contract Child() is Base {
    function getValue() override returns (int) { return 2; }
}
```

---

### 2.5 Contract Structure & Declarations

#### Contract Body Order (Grammar-Enforced)
```
abstract? contract Name(params) is Parent1, Parent2 {
    enum*
    struct*
    type*        // user-defined value types
    event*
    error*
    constant*
    stateVar*
    modifier*
    constructor?
    (function | abstractFunction)*
    fallback?
    receive?
}
```

#### Abstract Contracts
```cash
abstract contract Base() {
    function getValue() virtual returns (int);  // no body
}
```
- Cannot be instantiated directly
- Must be inherited by concrete contract
- Can mix abstract and implemented functions

#### Libraries
```cash
library SafeMath {
    function add(int a, int b) returns (int) { ... }
}
```
- Contains only pure utility functions and type definitions
- No state variables, no constructor
- Functions called as `SafeMath.add(x, y)` or imported directly

---

### 2.6 State Management

#### State Variable Declarations
```cash
contract Counter() {
    int counter;                          // simple state
    public int readableCounter;           // auto-getter visibility
    private bytes32 secret;               // private
    int immutable LIMIT;                  // set in constructor only
    int constant MAX = 100;               // compile-time constant
    User user;                            // struct state
}
```
- Visibility: `public`, `internal` (default), `private`, `external`
- Modifiers: `immutable` (set once in constructor), `constant` (compile-time)
- `memory`, `calldata` — accepted as no-op keywords for Solidity compatibility
- `packed` — packing modifier

#### State Reads & Writes
```cash
int val = this.counter;            // read from input NFT commitment
this.counter = this.counter + 1;   // write to output NFT commitment
```

#### Struct State Operations
```cash
this.users[pkh].name = "Alice";           // partial field assignment
this.users[pkh].balance = 100;            // chained write in same function
User u = this.users[pkh];                 // read entire struct
```

#### Delete Operations
```cash
delete x;                          // reset local variable to zero/default
delete this.counter;               // reset state variable
delete this.users[pkh];            // delete mapping entry NFT
```
- Three AST nodes: `DeleteLocalNode`, `DeleteStateNode`, `MappingDeleteNode`
- Mapping delete: `this.map.delete(key)` (dot-method syntax also supported)

#### Constants (File-Level and Contract-Level)
```cash
int constant FEE_RATE = 30;  // file-level, inlined at every usage

contract MyContract() {
    int constant MAX = 100;  // contract-level, inlined
}
```

---

### 2.7 Mappings & Collections

#### Mapping Declarations
```cash
mapping(bytes20 => int) balances;                           // simple
mapping(bytes20 => mapping(bytes20 => int)) allowances;     // nested
mapping(bytes20 => User) users;                             // struct values
mapping(bytes20 => int[3]) scores;                          // array values
mapping(bytes20 => int[]) dynamicScores;                    // dynamic array values
```

#### Mapping Access & Assignment
```cash
int bal = this.balances[sender];                             // read
this.balances[sender] = newBalance;                          // write
this.allowances[owner][spender] = amount;                    // nested write
this.users[pkh].name = "Alice";                              // struct field write
this.map.delete(key);                                        // delete entry
```

#### Dynamic Mapping Keys
Keys can be:
- Function parameters (`this.balances[pk]`)
- State variables (`this.data[this.currentIndex]`)
- Computed expressions (`this.data[hash256(k1 + k2)]`)
- Literal values (`this.balances[0x1234...]`)
- Auto-resolved via placeholder (0n) and VM trace capture

#### Collection Iteration (3 Syntax Variants)
```cash
// 1. ENTRIES: iterate key-value pairs
for (bytes20 key, int value of this.balances.entries) {
    // access both key and value
}

// 2. KEYS: iterate keys only (keyword: in)
for (bytes20 key in this.balances) {
    // access key only, value not decoded
}

// 3. VALUES: iterate values only (keyword: of, no .entries)
for (int value of this.balances) {
    // access value only, key not decoded
}
```
- Grammar rules: `forOfEntriesStatement`, `forInStatement`, `forOfStatement`
- SDK provides entry count via synthetic `_collectionIterCount_N` param
- Each iteration reads an entry NFT's commitment, decodes key/value based on mode
- Works on both mappings and arrays

#### Mapping Enumeration (SDK)
```typescript
const entries = await contract.getEntries('balances');
// Returns: [{ key: Uint8Array, value: bigint }, ...]
```

#### Token Containers
```cash
this.tokens[category].tokenAmount          // read FT balance
this.tokens[category].nftCommitment        // read NFT commitment
this.tokens[category].nftCount             // read NFT count
this.tokens[category].transfer(to, amount) // transfer FTs
this.tokens[category].transferNft(to, commitment) // transfer NFT
```
- Each token category gets its own covenant UTXO
- `TokenContainerMethodStatementNode` handles `.transfer()` and `.transferNft()`

#### Satoshi Container
```cash
this.balance                               // current satoshi container value
this.outState.balance                      // expected output value
this.transfer(lockingBytecode, amount)     // transfer satoshis
```
- Dedicated covenant UTXO holds contract's BCH treasury
- Separates contract identity (master NFT) from funds

---

### 2.8 Events & Errors

#### Events
```cash
event Transfer(address indexed from, address indexed to, int amount);
event Swap(int amountIn, int amountOut) anonymous;

emit Transfer(sender, recipient, 100);
```
- `indexed` parameters — stored in NFT commitment for filtering/searching
- `anonymous` — no event signature hash (all anonymous events share one address)
- Overloaded events (same name, different parameters) supported
- Events defined at file, contract, interface, or library level
- Event NFTs: each `emit` creates a data NFT with 144-block relative timelock for cleanup

#### Custom Errors
```cash
error InsufficientFunds(int required, int available);
error Unauthorized();

revert InsufficientFunds(amount, balance);
revert("not enough funds");
revert();
```
- Errors defined at file or contract level
- `ErrorDefinitionNode` with `name`, `parameters`, `signature`

#### Assert
```cash
assert(invariantCondition);  // halts if false
```

---

### 2.9 Inheritance & Modularity

#### Contract Inheritance
```cash
contract ERC20(bytes32 tokenId) {
    mapping(bytes20 => int) balances;
    function transfer(bytes20 to, int amount) virtual { ... }
}

contract MyToken() is ERC20(0x...) {
    function transfer(bytes20 to, int amount) override { ... }
}
```
- Single and multiple inheritance: `contract C is A, B { }`
- Diamond inheritance with proper linearization
- Inherits: functions, state variables, collections, events, structs, enums, constants, modifiers, errors, type definitions
- Constructor inheritance with parent invocation: `constructor() Parent1(args) Parent2(args) { }`

#### Abstract Contracts
```cash
abstract contract Ownable() {
    function owner() virtual returns (pubkey);
    function checkOwner(pubkey pk, sig s) {
        require(checkSig(s, pk));
    }
}
```

#### Interfaces
```cash
interface IToken is IBase {
    // Nested type definitions
    enum TokenType { Fungible, NonFungible }
    struct TokenInfo { bytes32 id; int amount; }
    event Transfer(address from, address to, int amount);

    // State declarations
    public int totalSupply;
    external mapping(bytes20 => int) balances;

    // Function signatures
    function transfer(bytes20 to, int amount);
    function balanceOf(bytes20 owner) returns (int);
}
```
- Interface inheritance: `interface IChild is IParent1, IParent2`
- Can define: enums, structs, types, events, state variables, collections, functions
- State variable visibility: `public` or `external`
- Interface ID: computed from XOR of function selectors

#### Libraries
```cash
library Math {
    enum RoundingMode { Down, Up }
    struct Fraction { int num; int den; }
    function add(int a, int b) returns (int) { return a + b; }
}
```
- Can define: enums, structs, types, events, constants, free functions
- No state, no constructor

---

### 2.10 Cross-Contract Interaction

#### Interface-Based Calls
```cash
int balance = IToken(categoryId).balanceOf(owner);
int a, int b = IOracle(cat).getPrice();
IToken(cat).transfer(to, amount);
```
- Return value capture (single and tuple)
- `ExternalFunctionCallNode` with `callMode`, `callOptions`

#### Call Modes
```cash
ITarget(cat).function(args)                     // regular call (state-modifying)
ITarget(cat).function(args).call()              // explicit call
ITarget(cat).function(args).staticcall()        // read-only
address.delegatecall(calldata)                  // execute in caller's context
```

#### Low-Level Calls
```cash
(bool success, bytes data) = addr.call(payload);
(bool success, bytes data) = addr.staticcall(payload);
(bool success, bytes data) = addr.delegatecall(payload);
```
- Returns `TupleType(BOOL, bytes)` — success flag and return data
- `LowLevelCallNode` / `LowLevelCallStatementNode`

#### Call Options
```cash
ITarget(cat).function(args){value: 100, gas: 800}
```
- `{value: amount}` — send satoshis with call
- `{gas: limit}` — gas hint (no-op on BCH, accepted for Solidity compat)
- `{salt: bytes}` — salt for deterministic creation (no-op on BCH, accepted for Solidity compat)

#### External State Reads
```cash
int counter = ICounter(categoryId).counter;           // read scalar state
User user = IUsers(cat).users[pkh];                   // read mapping entry
int outBalance = IToken(cat).outState.totalSupply;    // read output state
```
- `ExternalStateAccessNode`, `ExternalMappingAccessNode`, `ExternalOutputStateAccessNode`
- Covenant verification ensures external state matches on-chain values

---

### 2.11 Contract Lifecycle Modifiers

#### `unsafe` / `unsafe(1)` / `unsafe(2)` — Tiered Covenant Bypass

| Check | `unsafe` (0) | `unsafe(1)` | `unsafe(2)` | Normal |
|-------|:---:|:---:|:---:|:---:|
| Master self-preservation | - | YES | YES | YES |
| Minting NFT uniqueness | - | YES | YES | YES |
| Value preservation | - | - | YES | YES |
| State commitment verification | - | - | - | YES |
| Entry/Event/Transfer/Container | - | - | - | YES |

#### `upgrade` — Contract Migration
```cash
function migrate(bytes newBytecode) upgrade {
    // State is preserved, bytecode changes
}
```
- Verifies old bytecode matches expected parent
- Data NFT covenants keyed by `categoryId`, not bytecode — state infrastructure decoupled from logic
- SDK: `StatefulContract.upgrade()` handles migration transaction

#### `selfdestruct` — Contract Destruction
```cash
function destroy(bytes20 recipient) selfdestruct {
    this.transfer(LockingBytecodeP2PKH(recipient), this.balance);
}
```
- Spends ALL UTXOs (master, data NFTs, entry NFTs, containers) without recreating
- Data NFT covenant has flag=2 (destroy) path: verifies master but skips output preservation
- SDK: `StatefulContract.destroy()` with batching for large contracts

#### `deploy` — Child Contract Creation
```cash
function createChild(bytes32 tokenId) deploy {
    new ChildContract(tokenId);
}
```
- Synthetic params injected: `_deployGenesisInputIndex`, `_deployOutputBase`
- Verifies child master NFT (minting cap) + data NFTs (mutable cap, correct LBC, default commitments)
- ABI: `deployTargets?: { contractName, dataNftCount }[]`
- SDK: `StatefulContract.deployFrom()` for factory pattern
- **create**: `deploy` modifier + `deployFrom()` (new categoryId from funding UTXO)
- **create2**: Implicit in BCH — addresses always deterministic from `hash(bytecode + args + salt)`
- **create3**: Factory stores `mapping(bytes32 salt => bytes32 categoryId)` — permanent identity

#### Inferred Delegatecall Implementation
```cash
contract Implementation() is State {
    function increment() public {
        this.counter = this.counter + 1;
    }
}
```
- No source-level `delegate` modifier: eligible ordinary functions are compiled into `artifact.delegateArtifact`
- Operates on proxy's state, not implementation's
- Synthetic `_proxyMasterIndex` parameter injected
- Altstack-based: master index saved to altstack at function entry, retrieved via `FROMALTSTACK DUP TOALTSTACK`
- ~20 covenant methods use `emitMasterInputIndex()` for proxy's index
- Implementation verifies its own self-preservation via `emitDelegateSelfPreservation()`

#### `split(n)` / `merge(n)` — Threaded Execution
```cash
function fork() split(4) { }    // split master into 4 copies
function join() merge(4) { }    // merge 4 copies back
```
- Enables parallel state transitions (N transactions per block instead of 1)
- SDK: `ThreadManager.split()` / `merge()` with `ThreadHandle` per-thread access

#### Modifier Validation Rules
- Functions using `unsafe`, `upgrade`, `selfdestruct`, `deploy`, `split`, `merge`, `view`, `pure`,
  `internal`, or `private` are ineligible for the inferred delegate build
- Stateful contracts require `p2sh32` address type

---

### 2.12 Special Variables & Introspection

#### Nullary Operators (Zero-Operand)
| Variable | Description |
|----------|-------------|
| `this.activeInputIndex` | Index of current input being spent |
| `this.activeBytecode` | Locking bytecode of current input |
| `tx.inputs.length` | Number of transaction inputs |
| `tx.outputs.length` | Number of transaction outputs |
| `tx.version` | Transaction version |
| `tx.locktime` | Transaction locktime |
| `msg.sender` | Address that called this function |
| `msg.value` | Net satoshi change in satoshi container (outputs - inputs) |
| `msg.sig` | 4-byte function selector |
| `msg.data` | Full unlocking bytecode including selector |
| `tx.origin` | Original caller in chain of calls |

#### Input Introspection
| Access | Description |
|--------|-------------|
| `tx.inputs[i].value` | Satoshi value of input i |
| `tx.inputs[i].lockingBytecode` | Locking bytecode of input i |
| `tx.inputs[i].outpointTransactionHash` | Outpoint txid |
| `tx.inputs[i].outpointIndex` | Outpoint vout |
| `tx.inputs[i].unlockingBytecode` | Unlocking bytecode |
| `tx.inputs[i].sequenceNumber` | Sequence number |
| `tx.inputs[i].tokenCategory` | CashToken category (32B + capability) |
| `tx.inputs[i].nftCommitment` | NFT commitment data |
| `tx.inputs[i].tokenAmount` | Fungible token amount |

#### Output Introspection
| Access | Description |
|--------|-------------|
| `tx.outputs[i].value` | Satoshi value of output i |
| `tx.outputs[i].lockingBytecode` | Locking bytecode |
| `tx.outputs[i].tokenCategory` | Token category |
| `tx.outputs[i].nftCommitment` | NFT commitment |
| `tx.outputs[i].tokenAmount` | Fungible token amount |

#### Time Operations
| Operation | Description |
|-----------|-------------|
| `require(tx.time >= expr)` | Absolute timelock (`OP_CHECKLOCKTIMEVERIFY`) |
| `require(this.age >= expr)` | Relative timelock (`OP_CHECKSEQUENCEVERIFY`) |

---

### 2.13 Import System

```cash
import "file.scash";                              // wildcard import
import "file.scash" as Lib;                       // namespace import
import { Token, IToken } from "file.scash";       // selective import
import { Token as MyToken } from "file.scash";    // aliased import
import "npm:@package/file.scash";                  // npm module import
```
- Selective imports support aliasing: `{ Name as Alias }`
- NPM resolution: walks up `node_modules/` directories (same as Node.js)
- Importable items: contracts, interfaces, libraries, types, enums, events, structs, functions, constants

---

### 2.14 Inline Assembly
```cash
assembly {
    OP_DUP OP_HASH160 0x14 OP_EQUALVERIFY OP_CHECKSIG
}
```
- Direct Bitcoin Script opcodes
- Can mix opcodes, hex literals, and number literals
- `AssemblyStatementNode` with `assemblyBody: string`

---

### 2.15 Literals & Units

#### Number Units
| Unit | Multiplier |
|------|-----------|
| `satoshis` / `sats` | 1 |
| `finney` | 10 |
| `bits` | 100 |
| `bitcoin` | 100,000,000 |
| `seconds` | 1 |
| `minutes` | 60 |
| `hours` | 3,600 |
| `days` | 86,400 |
| `weeks` | 604,800 |

#### Literal Types
- Integer: `42`, `-5`, `1_000_000` (underscores for readability), `1e6` (scientific notation)
- Decimal: `1.5`, `-2.25` (for fixed-point)
- Hex: `0xdeadbeef`
- Hex string: `hex"dead_beef"` (underscores allowed)
- String: `"hello"`, `'hello'` (escape sequences: `\n`, `\t`, `\\`, `\"`, etc.)
- Unicode: `unicode"emoji"`
- Boolean: `true`, `false`
- Date: `date("2024-01-01T00:00:00")`
- Array: `[1, 2, 3]`

---

### 2.16 Global Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `abs(x)` | `int → int` | Absolute value |
| `min(a, b)` | `(int, int) → int` | Minimum |
| `max(a, b)` | `(int, int) → int` | Maximum |
| `within(x, lo, hi)` | `(int, int, int) → bool` | Range check |
| `ripemd160(x)` | `any → bytes20` | RIPEMD-160 hash |
| `sha1(x)` | `any → bytes20` | SHA-1 hash |
| `sha256(x)` | `any → bytes32` | SHA-256 hash |
| `hash160(x)` | `any → bytes20` | RIPEMD160(SHA256(x)) |
| `hash256(x)` | `any → bytes32` | SHA256(SHA256(x)) |
| `checkSig(s, pk)` | `(sig, pubkey) → bool` | Verify signature |
| `checkMultiSig(sigs, pks)` | `(sig[], pubkey[]) → bool` | Multi-signature check |
| `checkDataSig(ds, msg, pk)` | `(datasig, bytes, pubkey) → bool` | Data signature check |
| `toPaddedBytes(val, size)` | `(int, int) → bytes` | Int to fixed-width bytes |
| `intToString(x)` | `int → string` | Integer to string |
| `stringToInt(s)` | `string → int` | String to integer |

#### Locking Bytecode Constructors
| Constructor | Signature | Description |
|-------------|-----------|-------------|
| `LockingBytecodeP2SH20(hash)` | `bytes20 → bytes23` | P2SH20 locking bytecode |
| `LockingBytecodeP2SH32(hash)` | `bytes32 → bytes35` | P2SH32 locking bytecode |
| `LockingBytecodeP2PKH(pkh)` | `bytes20 → bytes25` | P2PKH locking bytecode |
| `LockingBytecodeNullData(chunks)` | `bytes[] → bytes` | OP_RETURN output |

---

### 2.17 Debugging

#### Console Logging
```cash
console.log("counter =", counter, "balance =", balance);
```
- `ConsoleStatementNode` with `parameters: (LiteralNode | IdentifierNode)[]`
- Log entries included in artifact debug info with stack positions
- Available inside loops

#### Require Messages
```cash
require(balance > 0, "insufficient balance");
```
- Debug info maps instruction pointer to source line and message
- `RequireStatement` in debug info: `{ ip, line, message }`

#### Source Maps
- Compressed format: `sl:sc:el:ec:h;sl:sc:...` (start line:col, end line:col, hint)
- Maps every opcode to source location
- `generateSourceMap()` / `sourceMapToLocationData()` for round-trip
- `formatBitAuthScript()` for side-by-side source + bytecode display

---

### 2.18 Covenant Architecture (Stateful Contracts)

#### NFT-Based State Model
SolidCash stateful contracts use Bitcoin Cash's native CashTokens for persistent state:

| NFT Type | Purpose | Covenant Script | Capability |
|----------|---------|-----------------|------------|
| **Master** | Contract identity, function dispatch | Contract's own locking bytecode | Minting |
| **Data NFT** | Scalar state variables | `buildDataNftCovenantScript` | Mutable |
| **Entry NFT** | Mapping/array entries | `buildEntryNftCovenantScript` | Mutable |
| **Event NFT** | Emitted event data | `buildEventNftCovenantScript` | None |
| **Token Container** | Per-category FT/NFT holdings | `buildTokenContainerCovenantScript` | Mutable |
| **Satoshi Container** | BCH treasury | `buildSatoshiContainerCovenantScript` | Mutable |

#### Covenant Script Paths
Each covenant script has multiple paths controlled by a flag byte:
- **Flag 0 (read-only)**: Preserve commitment, verify self-preservation
- **Flag 1 (write)**: Verify master minting NFT authorization, allow state change
- **Flag 2 (destroy)**: Master-authorized destruction (data NFTs only, for `selfdestruct`)

#### Verification Order in Compiled Bytecode
1. Auto-covenant (state transitions)
2. Entry covenant (mapping updates)
3. Read-only entry preservation (OP_IF branch)
4. Transfer covenant (satoshi sends)
5. Token container transfers
6. Token container preservation
7. Event covenant (emitted events)
8. Master self-preservation
9. Value preservation

#### State Encoding
- **Pushdata encoding**: matches compiler bytecode exactly
  - Bool: `0x00` (false) or `0x51` (true)
  - Int: OP_0/OP_1NEGATE/OP_1-OP_16 shortcuts, standard pushdata otherwise
  - Pubkey: `0x21` prefix (33 bytes)
  - Structs: concatenated field encodings
  - Arrays: length prefix + elements
- **Commitment format**: pushdata-encoded fields concatenated per NFT index
- **Entry commitment**: encoded key + encoded value concatenated
- **Collection signature**: `"name:mapping(keyType => valueType)"` → SHA-256 truncated to 20 bytes

#### Commitment Size Limit
Default 128 bytes per NFT commitment. State variables bin-packed across NFT indices (`nftIndex` + `fieldIndex`).

---

### 2.19 SDK: Auto-Derivation System

The SDK can **automatically derive** all transaction outputs from VM execution traces:

#### How It Works
1. Build initial transaction with placeholder state outputs
2. Execute against BCH VM (MockNetworkProvider or real network)
3. Scan VM debug trace for `OP_OUTPUTTOKENCOMMITMENT + OP_EQUALVERIFY` patterns
4. Extract verified commitments, apply to transaction
5. Re-execute until convergence (values stop changing)

#### What Gets Auto-Derived
| Component | Detection Pattern |
|-----------|------------------|
| State commitments | `OP_OUTPUTTOKENCOMMITMENT + OP_EQUALVERIFY` |
| Entry writes | Same pattern, filtered by output index range |
| Events | Same pattern at event output indices |
| Satoshi transfer targets | `OP_OUTPUTBYTECODE + OP_EQUALVERIFY` |
| Satoshi transfer amounts | `OP_OUTPUTVALUE + OP_EQUALVERIFY` |
| FT transfer amounts | `OP_OUTPUTTOKENAMOUNT + OP_EQUALVERIFY` |
| Mapping keys | Placeholder (0n) → VM trace captures correct commitment |

#### Safety Properties
- Max 20-50 iterations safety limit (configurable via `maxDerivationIterations`)
- VM script is the final arbiter — wrong auto-derived values cause failure (non-convergence), not wrong transactions
- Output index filtering prevents counting preservation bytecodes as transfers
- Manual overrides: `.transfer()`, `.tokenContainerTransfer()`, `.setState()`, `.setEntry()` override auto-derived values

#### Usage
```typescript
// Fully auto-derived — no manual state specification needed:
await contract.call['increment'](sig, pk).send();

// With external call auto-derivation:
await contract.call['swap'](sig, pk)
  .withExternalCall(otherContract, 'exchange', [amount])
  .send();

// With delegatecall:
await proxy.call['__fallback']()
  .withDelegatecall(implementation, 'increment', [])
  .send();
```

---

### 2.20 SDK: Full Public API

#### `Contract` — Non-Stateful Contracts
| Property/Method | Description |
|-----------------|-------------|
| `.address` | Cash address (P2SH20/P2SH32/P2S) |
| `.tokenAddress` | Token-aware address |
| `.lockingBytecode` | Hex-encoded locking bytecode |
| `.bytecode` | Full bytecode with constructor args |
| `.bytesize` / `.opcount` | Size metrics |
| `.unlock.functionName(args)` | Create unlocker for function |
| `.getBalance()` | Total satoshis at address |
| `.getUtxos()` | All spendable UTXOs |
| `.withSalt(salt)` | New instance with different salt |
| `Contract.generateSalt(length?)` | Random salt generation |

#### `TransactionBuilder` — Non-Stateful Transactions
| Method | Description |
|--------|-------------|
| `.addInput(utxo, unlocker)` | Add transaction input |
| `.addOutput({ to, amount, token? })` | Add output |
| `.addOpReturnOutput(chunks)` | OP_RETURN output |
| `.setLocktime(n)` | Set transaction locktime |
| `.build()` | Build hex transaction |
| `.debug()` | Debug with VM |
| `.getVmResourceUsage()` | VM resource metrics |
| `.getBitauthUri()` | Bitauth debug URI |
| `.send()` | Build + broadcast |

#### `StatefulContract` — Stateful Smart Contracts
| Property/Method | Description |
|-----------------|-------------|
| `.categoryId` | Token category ID |
| `.state` | Async state variable getters proxy |
| `.call['functionName'](args)` | Create function call builder |
| `.tokens[categoryId]` | Token container accessor |
| `.satoshiContainer.address` | Satoshi container address |
| `.getState()` | Current state values |
| `.getFullState()` | State + UTXOs + master + data NFTs |
| `.getBalance()` | Satoshi container balance |
| `.getEntries(collection)` | Enumerate all mapping entries |
| `.queryEvents(name, filters?)` | Query events by name + indexed filters |
| `.registerExternal(name, contract)` | Register external contract for auto-resolution |
| `StatefulContract.connect(contract, categoryId)` | Connect to deployed contract |
| `StatefulContract.from(artifact, args, options, categoryId)` | Create from artifact |
| `StatefulContract.discover(contract)` | Discover by finding minting NFT |
| `StatefulContract.deploy(artifact, args, options)` | Deploy with genesis NFTs |
| `StatefulContract.upgrade(options)` | Migrate to new version |
| `StatefulContract.deployFrom(options)` | Deploy child from factory |
| `StatefulContract.destroy(options)` | Destroy contract (batch) |

#### `StatefulTransactionBuilder` — Manual Stateful Transactions
| Method | Description |
|--------|-------------|
| `.setState(name, value)` | Set state variable |
| `.setEntry(slot, value)` | Set mapping entry |
| `.deleteEntry(slot)` | Delete mapping entry |
| `.addTransfer(lbc, amount)` | Add satoshi transfer |
| `.addTokenContainerTransfer(cat, lbc, amount)` | Add FT transfer |
| `.addTokenContainerTransferNft(cat, lbc, commitment, capability)` | Add NFT transfer |
| `.emitEvent(name, ...args)` | Emit event |
| `.addOutput({ to, amount })` | Add custom output |
| `.clearTransfers()` | Clear pending transfers |
| `.build()` | Build underlying TransactionBuilder |

#### `StatefulFunctionCall` — Auto-Derived Calls
| Method | Description |
|--------|-------------|
| `.withExternalCall(contract, fn, args)` | Chain external call |
| `.withDelegatecall(impl, fn, args)` | Chain delegatecall |
| `.send()` | Build, auto-derive, broadcast |

#### `ThreadManager` — Parallel Execution
| Method | Description |
|--------|-------------|
| `.split(options)` | Split master into N copies |
| `.merge(options)` | Merge N copies back to 1 |
| `.getThread(id)` | Get thread handle |
| `.getAllThreads()` | Get all thread handles |
| `ThreadHandle.call(fn, args)` | Call function on specific thread |

#### `SignatureTemplate` — Signing
| Method | Description |
|--------|-------------|
| `constructor(key, hashtype?, algo?)` | From WIF/hex/keypair |
| `.generateSignature(payload)` | Sign with hash type byte |
| `.signMessageHash(payload)` | Sign without hash type byte |
| `.getPublicKey()` | Derive compressed pubkey |
| `.unlockP2PKH()` | Create P2PKH unlocker |

#### Network Providers
| Provider | Features |
|----------|----------|
| `ElectrumNetworkProvider` | Electrum protocol, CashToken support |
| `MockNetworkProvider` | In-memory, VM execution, UTXO tracking |
| `BitcoinRpcNetworkProvider` | Direct bitcoind RPC |
| `FullStackNetworkProvider` | BCHD/FullStack nodes |

#### Error Types
| Error | Description |
|-------|-------------|
| `FailedTransactionError` | Transaction rejected |
| `FailedTransactionEvaluationError` | VM evaluation failure with debug info |
| `FailedRequireError` | Specific require statement failed |
| `AutoDerivationError` | VM inference non-convergence |

---

### 2.21 Compiler & Artifact

#### Compiler Pipeline
`.scash` source → Lexer/Parser (ANTLR4) → AST → `SymbolTableTraversal` → `TypeCheckTraversal` → `EnsureFinalRequireTraversal` → `GenerateTargetTraversal` → Bytecode Optimization → Artifact

#### Artifact Structure
```json
{
  "contractName": "MyContract",
  "constructorInputs": [{ "name": "owner", "type": "pubkey" }],
  "abi": [{
    "name": "transfer",
    "inputs": [{ "name": "to", "type": "bytes20" }, { "name": "amount", "type": "int" }],
    "selector": "0xabcd1234",
    "requiredNftIndices": [0, 1],
    "entryAccesses": [{ "collection": "balances", "operations": ["read", "write"] }],
    "externalCalls": [{ "interfaceName": "IToken", "functionName": "mint", "callMode": "call" }],
    "emits": [{ "eventName": "Transfer", "emitIndex": 0 }],
    "transferCount": 1,
    "unsafeTier": null,
    "lowLevelCalls": [{ "callMode": "delegatecall" }],
    "collectionIterations": [{ "collection": "balances", "mode": "entries" }],
    "deployTargets": [{ "contractName": "Child", "dataNftCount": 2 }]
  }],
  "bytecode": "...",
  "source": "...",
  "debug": {
    "bytecode": "...",
    "sourceMap": "0:0:0:5:0;...",
    "logs": [{ "ip": 42, "line": 10, "data": [...] }],
    "requires": [{ "ip": 55, "line": 15, "message": "insufficient funds" }]
  },
  "stateLayout": {
    "stateVariables": [{ "name": "counter", "type": "int", "nftIndex": 0, "fieldIndex": 0 }],
    "collections": [{ "name": "balances", "kind": "mapping", "keyType": "bytes20", "valueType": "int" }],
    "structs": [{ "name": "User", "fields": [...] }],
    "dataNftCount": 1,
    "commitmentLimit": 128
  },
  "events": [{ "name": "Transfer", "signature": "...", "parameters": [...] }],
  "errors": [{ "name": "InsufficientFunds", "signature": "...", "parameters": [...] }],
  "enums": [{ "name": "Status", "members": [{ "name": "Active", "value": 0 }] }]
}
```

#### Bytecode Optimization
140+ provable optimizations:
- Arithmetic: `OP_1 OP_ADD` → `OP_1ADD`
- Hash: `OP_SHA256 OP_SHA256` → `OP_HASH256`
- Stack: `OP_0 OP_PICK` → `OP_DUP`, `OP_2 OP_ROLL` → `OP_ROT`
- Redundancy: `OP_DUP OP_DROP` → empty, `OP_SWAP OP_SWAP` → empty
- Merge VERIFY: `OP_EQUAL OP_VERIFY` → `OP_EQUALVERIFY`
- Reordering: `OP_SWAP OP_GREATERTHANOREQUAL` → `OP_LESSTHANOREQUAL`
- Comparison negation: `!(a < b)` → `a >= b`

#### Function Dispatch
- 4-byte function selectors: SHA-256(signature)[0:4]
- Dynamic dispatch via `OP_DEFINE`/`OP_INVOKE` — O(1) lookup
- Single-function interfaces skip selector check (optimization)
- Fallback catches unmatched selectors; receive catches empty calldata

---

### 2.22 Advanced Patterns (Demonstrated)

| Pattern | Description | Test File |
|---------|-------------|-----------|
| **ERC20-like token** | Fungible token with balances, allowances, transfers | `MappingEnumeration.test.ts` |
| **Transparent proxy** | Delegatecall to upgradeable implementation | `Delegatecall.test.ts` |
| **Flashloans** | Request-callback with repayment verification | `FlashLoan.test.ts` |
| **Multi-party atomic** | Synchronized state across contracts | `MultiPartyAtomicTx.test.ts` |
| **Circular calls** | A → B → A call chains | `CircularCalls.test.ts` |
| **Recursive functions** | Self-calling via `OP_DEFINE`/`OP_INVOKE` | `DynamicDispatchAndRecursion.test.ts` |
| **Threaded execution** | Split/merge master for parallelism | `SplitMerge.test.ts` |
| **Factory deployment** | Contract creating child contracts | `ContractDeployment.test.ts` |
| **Diamond inheritance** | Multi-level with proper linearization | `InheritanceAndLibraries.test.ts` |
| **Covenant vault** | Time-locked withdrawal with hot/cold keys | `TransferWithTimeout.test.ts` |
| **Multi-sig** | N-of-M signature schemes | `P2PKH.test.ts` |

---

## 3. Solidity Parity Comparison Matrix

| Feature | Solidity | SolidCash | Notes |
|---------|:--------:|:----------:|-------|
| **TYPES** | | | |
| Bounded integers (`int8`..`uint256`) | Yes | Yes | Full parity |
| Fixed-point (`fixed`/`ufixed`) | Declared only | **Fully implemented** | **SolidCash ahead** |
| Bool | Yes | Yes | Parity |
| Address / address payable | Yes | Yes | Parity (different chain) |
| Fixed bytes (`bytes1`..`bytes32`) | Yes | Yes | Parity |
| Dynamic bytes / string | Yes | Yes | Parity |
| Enums (explicit values, file-level) | Yes (max 256) | Yes (file/contract/interface) | Parity+ |
| Structs (named init, nested) | Yes | Yes (+ partial field assign) | Parity+ |
| Mappings | Yes (**no iteration**) | Yes (**3 iteration modes**) | **SolidCash ahead** |
| Dynamic arrays | Yes | Yes | Parity |
| Multi-dim arrays | Yes | Yes | Parity |
| User-defined value types | Yes (0.8.8+) | Yes | Parity |
| Tuple types | Yes | Yes | Parity |
| | | | |
| **CONTROL FLOW** | | | |
| if/else | Yes | Yes | Parity |
| for/while/do-while | Yes | Yes | Parity |
| break/continue | Yes | Yes | Parity |
| Ternary | Yes | Yes | Parity |
| try/catch (external calls) | Yes | Yes | Parity |
| `unchecked` blocks | Yes (0.8.0+) | No | Solidity only |
| | | | |
| **FUNCTIONS** | | | |
| Visibility (public/private/internal/external) | Yes | Yes | Parity |
| View/pure/payable | Yes | Yes | Parity |
| Custom modifiers with params | Yes | Yes (multiple, `_` placeholder) | Parity |
| Virtual/override | Yes | Yes | Parity |
| Free functions | Yes (0.7.1+) | Yes | Parity |
| Function overloading | Yes | Yes | Parity |
| Fallback/receive | Yes | Yes | Parity |
| Multiple return values | Yes | Yes (tuple unpacking) | Parity |
| | | | |
| **STATE** | | | |
| State variables | Yes (storage slots) | Yes (NFT commitments) | Different mechanism |
| Constants | Yes | Yes (file + contract level) | Parity |
| Immutables | Yes | Yes | Parity |
| Transient storage | Yes (0.8.28+) | No | EVM-specific |
| Data locations (memory/calldata/storage) | Yes (meaningful) | Accepted as no-op | Compat syntax |
| | | | |
| **CONTRACTS** | | | |
| Single/multiple inheritance | Yes | Yes | Parity |
| Abstract contracts | Yes | Yes | Parity |
| Interfaces (nested types) | Yes | Yes (structs, enums, events) | Parity |
| Libraries | Yes (`using for`) | Yes (import-based) | Different mechanism |
| Constructor inheritance | Yes | Yes (parent invocation) | Parity |
| Diamond inheritance | Yes (C3 linearization) | Yes | Parity |
| `super` keyword | Yes | No | Solidity only |
| | | | |
| **EVENTS** | | | |
| Event declaration/emit | Yes | Yes | Parity |
| Indexed parameters | Yes (up to 3) | Yes | Parity |
| Anonymous events | Yes | Yes | Parity |
| Overloaded events | Yes | Yes | Parity |
| | | | |
| **ERROR HANDLING** | | | |
| require/assert/revert | Yes | Yes | Parity |
| Custom errors | Yes (0.8.4+) | Yes | Parity |
| try/catch | Yes | Yes | Parity |
| | | | |
| **CROSS-CONTRACT** | | | |
| Interface-based calls | Yes | Yes | Parity |
| delegatecall | Yes | Yes | Parity |
| staticcall | Yes | Yes | Parity |
| Low-level call | Yes | Yes | Parity |
| Call options ({value:, gas:}) | Yes | Yes ({gas: no-op}) | Parity |
| External state reads | No (must call getter) | Yes (direct syntax) | **SolidCash ahead** |
| Output state reads | No | Yes (`outState`) | **SolidCash ahead** |
| | | | |
| **CREATION** | | | |
| `new Contract()` | Yes | Yes | Parity |
| CREATE2 (salted, deterministic) | Yes | Yes (implicit in BCH) | Parity |
| CREATE3 (factory-based identity) | No (library only) | Yes (built-in) | **SolidCash ahead** |
| selfdestruct | Yes (deprecated) | Yes (not deprecated) | Parity |
| | | | |
| **ABI** | | | |
| abi.encode/encodePacked | Yes | Yes | Parity |
| abi.decode/decodeAt | Yes | Yes (+ `decodeAt`) | Parity+ |
| abi.encodeWithSelector | Yes | No | Solidity only |
| abi.encodeCall | Yes (0.8.11+) | No | Solidity only |
| | | | |
| **IMPORTS** | | | |
| Wildcard/namespace/selective | Yes | Yes | Parity |
| Import aliasing | Yes | Yes | Parity |
| NPM modules | Via remapping | Native `npm:` prefix | **SolidCash ahead** |
| | | | |
| **ASSEMBLY** | | | |
| Inline assembly | Yes (Yul — full language) | Yes (raw Bitcoin Script) | Both, different targets |
| | | | |
| **INTROSPECTION** | | | |
| type().min/max | Yes | Yes | Parity |
| type().interfaceId | Yes | Yes | Parity |
| type().name | Yes | Yes | Parity |
| type().creationCode/runtimeCode | Yes | No | Solidity only |
| | | | |
| **GLOBALS** | | | |
| msg.sender/value/data/sig | Yes | Yes | Parity |
| tx.origin | Yes | Yes | Parity |
| tx.gasprice, gasleft() | Yes | No (no gas model) | N/A |
| block.timestamp/number | Yes | `tx.time`/`tx.locktime` | Different model |
| block.coinbase/prevrandao | Yes | No | N/A |
| Transaction introspection | No | Yes (full input/output) | **SolidCash ahead** |
| **DEBUGGING** | | | |
| console.log | Yes (Hardhat) | Yes (built-in) | Parity |
| Source maps | Yes | Yes | Parity |
| Require messages | Yes | Yes | Parity |

---

## 4. Features SolidCash Has That Solidity Lacks

| Feature | Why It Matters |
|---------|---------------|
| **Mapping iteration** (3 modes: entries, keys, values) | `for (k, v of map.entries)` — Solidity mappings cannot be iterated at all |
| **Fixed-point arithmetic** | Fully implemented `fixed128x18` with `*`, `/` — Solidity declared but never built |
| **Transaction introspection** | `tx.inputs[i].value`, `tx.outputs[i].lockingBytecode` — inspect every input/output in the transaction |
| **External state reads** | `IContract(cat).stateVar` — read other contracts' state without calling them |
| **Output state reads** | `IContract(cat).outState.var` — read expected output state of other contracts |
| **Auto-derivation** | SDK automatically discovers all state changes from VM traces — no manual wiring |
| **Threaded execution** | `split(n)`/`merge(n)` — fork master NFT for N parallel state transitions per block |
| **Tiered unsafe** | `unsafe(0/1/2)` — granular covenant bypass levels for admin operations |
| **Deploy modifier** | First-class child contract deployment from existing contracts with state provisioning |
| **CREATE3** | Built-in deterministic creation with permanent factory-registered identity |
| **NPM imports** | Native `import "npm:@pkg/file.scash"` without remapping config |
| **P2S contracts** | Pay-to-Script — embed full script without hashing, smaller for small scripts |
| **Token containers** | Built-in per-category fungible/NFT token management with covenant security |
| **Satoshi containers** | Dedicated BCH treasury with covenant-enforced transfers (`this.transfer()`) |
| **Struct partial field assignment** | `this.users[key].name = newValue` — chained writes in same function |
| **`abi.decodeAt`** | Decode with byte offset (not available in Solidity) |
| **`toPaddedBytes`** | Integer to fixed-width bytes conversion |
| **`intToString` / `stringToInt`** | Built-in integer ↔ string conversion |
| **Native CashToken support** | First-class NFT commitment and fungible token amount access |

---

## 5. Features Solidity Has That SolidCash Lacks

| Feature | Notes |
|---------|-------|
| **Transient storage** | EVM-specific (`TSTORE`/`TLOAD`), cleared per-tx (0.8.28+) |
| **`unchecked` blocks** | Disable overflow checks for gas optimization |
| **`super` keyword** | Call parent in linearization chain |
| **Gas model intrinsics** | `gasleft()`, `tx.gasprice`, `block.basefee` — N/A on BCH |
| **Block intrinsics** | `block.number`, `block.coinbase`, `block.prevrandao` — different chain model |
| **`using for` syntax** | Attach library functions to types (SolidCash uses import-based libraries) |
| **`abi.encodeWithSelector`** | Low-level ABI encoding with selector prefix |
| **`abi.encodeCall`** | Type-safe call encoding (0.8.11+) |
| **`type().creationCode`** | Access contract bytecode at compile time |
| **Custom storage layouts** | `layout at offset` for proxy storage (0.8.29+) |
| **Switch statement** | Only in Yul assembly; SolidCash has no switch |
| **User-defined operators** | Operator overloading on UDVTs (0.8.19+) |
| **Named parameters in mappings** | `mapping(address user => uint256 balance)` syntax (0.8.18+) |

Most gaps are either EVM-specific (gas, block intrinsics, transient storage), minor convenience features (`super`, `using for`, user-defined operators), or recently added Solidity features.

---

## Summary

SolidCash's `future` branch represents a transformation from a **basic Bitcoin Cash scripting language** to a **comprehensive smart contract platform** with near-complete Solidity feature parity. The ~216 commits since v0.12.1 add:

- **100+ language features** spanning every category: types, control flow, functions, inheritance, events, errors, cross-contract calls, and contract lifecycle
- **Complete stateful contract system** using Bitcoin Cash's native NFT covenant pattern with 6 covenant types
- **Auto-derivation SDK** that eliminates manual transaction construction via iterative VM trace analysis
- **263 compiler test contracts** and **68 SDK e2e test suites** for comprehensive coverage
- **Several features ahead of Solidity**: iterable mappings (3 modes), working fixed-point, transaction introspection, external state reads, output state reads, threaded execution, auto-derivation, and native token container management

The result is a language that speaks Solidity's vocabulary while leveraging Bitcoin Cash's unique UTXO model for capabilities Ethereum cannot offer.
