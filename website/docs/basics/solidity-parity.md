---
title: Coming from Solidity
---

SolidCash is a Solidity-flavored language for Bitcoin Cash. If you write Solidity, you already know most of
it: the same contracts, functions, modifiers, structs, enums, interfaces, libraries, inheritance, events,
errors and `abi.*` helpers. This page is the map of what carries over unchanged, what behaves differently, and
what the UTXO model intentionally does not have.

For the primitive-level differences behind all of this, read
[Platform Differences](/docs/basics/platform-differences).

## What ports unchanged

These Solidity constructs work as written.

**Declarations and structure**

- `contract`, `abstract contract`, `interface`, `library`
- `is` inheritance, real **C3 linearization**, `super.f()` and qualified `Base.f()` calls
- `virtual` / `override`, including the explicit `override(A, B)` base list
- Constructors with parent constructor arguments, `modifier` with `_` placeholder and arguments
- `fallback` and `receive`
- File-level declarations: `struct`, `enum`, `type`, `event`, `error`, `constant`, free functions
- `import` in wildcard, namespace (`import "f" as X;`) and selective (`{ A, B } from`) forms. The
  `import * as X from "f";` spelling does not parse.
- `using L for T`, `using { f as + } for T`, `global` attachment

**Types**

- `bool`, `string`, `bytes`, `bytesN`, `address` / `address payable`
- `int` / `uint` and all `intN` / `uintN` widths, with EVM-identical ranges and overflow checks
- `unchecked { }` wraparound
- `enum` (SolidCash additionally allows explicit member values)
- User-defined value types (`type X is Y`) with `.wrap()` / `.unwrap()`
- `struct`, including nesting, named-argument initialisation and partial field assignment
- Fixed-size and dynamic arrays, multi-dimensional arrays, `mapping(K => V)` including nesting
- Function types / function pointers (`function(int) internal returns (int)`)
- `fixed` / `ufixed` (see [below](#where-solidcash-goes-further))

**Statements and expressions**

- `if` / `else`, `for`, `while`, `do-while`, `break`, `continue`, `return`
- `require`, `assert`, `revert Custom(...)`, `try` / `catch`
- Compound assignment (`+= -= *= /= %= &= |= ^= <<= >>=`), `++` / `--` prefix and postfix
- Short-circuiting `&&` and `||`
- Tuples, multi-return, destructuring including skipped slots and swaps
- Slices `x[a:b]`, `bytes.concat`, `string.concat`
- `abi.encode`, `abi.encodePacked`, `abi.encodeWithSelector`, `abi.encodeWithSignature`, `abi.encodeCall`,
  `abi.decode`
- `type(T).min` / `.max` / `.interfaceId` / `.name` / `.creationCode`
- Inline `assembly { }` with the Yul subset (`let`, `:=`, `if`, `switch`, `for`, functions)
- Number units: `wei`, `gwei`, `ether`, `seconds`, `minutes`, `hours`, `days`, `weeks`

**Solidity source files**

The `evmCompat` compiler option lets `.sol` files be parsed directly and accepts
`pragma solidity ...`. Several porting affordances that never relax soundness are plain defaults and need no
flag at all: bare state access (`balanceOf[a] += x`, byte-identical to `this.balanceOf[a] += x`), hex-literal
integer coercion, string-literal `bytesN` right-padding, empty function bodies synthesising type defaults,
declaration-only files compiling to an ABI-only artifact, `uint`/`int` aliases, contract members in any order, and
`Library.Type` member types.

See [Solidity Import Compatibility](/docs/compiler/solidity-import-compat) for the mode-specific storage, getter,
proxy, data-location and validation lowerings, plus a release porting workflow.

## Where behaviour differs

These compile, but do not mean quite what they mean on the EVM. Several are compiler-warned, including every read
of `msg.sender` and `tx.origin`. `msg.value` and `payable` compile without a warning, so review every use.

| Construct | Difference |
| --- | --- |
| `msg.sender` | The caller's locking bytecode, falling back to `tx.origin` for direct spends. It is derived from the transaction's inputs, so prefer `checkSig` for authorization; the compiler warns on every read. |
| `msg.value` | Net satoshi change in the contract's satoshi container, not an EVM call value. |
| `try` / `catch` | The `try` block runs, but a failed BCH opcode aborts the script and cannot be resumed, so `catch` bodies are dead code. Compiler-warned. |
| `keccak256` | Real keccak256, computed by a co-spent side-car input rather than a native opcode. Values match Ethereum. |
| Function selectors | Derived with sha256 by default, so calldata is not cross-VM compatible. The `evmCompat` option switches to real keccak256 over Solidity's canonical signature spelling, so a selector matches what solc derives. |
| `event.selector`, `error.selector`, `type(I).interfaceId` | Compile-time constants: sha256-based by default, real keccak256 under `evmCompat`. The event's covenant address salt stays sha256. |
| Event storage | An event is an NFT output, not an EVM log or receipt entry; there is no bloom filter or topic channel. |
| `ecrecover` | Real secp256k1 recovery, implemented as a co-spent recovery side-car pair. Exposed as `ecrecoverPubKey`, `ecrecoverP2pkh` and `ecrecoverEvm`. |
| `block.*` | Oracle-backed reads rather than native VM state. See [Global Variables](/docs/language/globals). |
| `block.prevrandao` | A transaction-local shim, grindable by the transaction builder. Not secure randomness; compiler-warned. |
| `gasleft()`, `block.gaslimit` | Fixed shims (`1000000`) so ported gas-budget checks keep running. Compiler-warned; do not rely on the value. |
| `address` | Full variable-length locking bytecode, not a 20-byte hash. `bytes20(addr)` / `uint160(addr)` narrow to the embedded 20-byte hash and warn. |
| `payable` | Required on an address for `.transfer` and `.send`; otherwise inert, since every BCH address can receive value. |
| `transient` | No transaction-scoped storage exists. Lowered to a per-function local, zero-initialised each spend. Warned. |
| `immutable` | Assigned once in the constructor and read-only afterwards, but stored in the state NFT rather than baked into bytecode. |
| Mappings | Verified mappings (vmaps) preserve default-on-absent reads with authenticated absence proofs. They are not iterable by default; declare `enumerable mapping(...)` to opt in. |
| Re-entrancy guards | Compile and are harmless, but there is no re-entrancy on a UTXO chain to guard against. |

## What is intentionally unsupported

These are EVM-execution-model features with no UTXO analogue. Each has a BCH substitute.

| Solidity feature | Why | BCH substitute |
| --- | --- | --- |
| Storage slots / `contract C layout at ...` | State lives in CashToken NFT commitments, not a linear slot array | Declare state variables; the compiler picks the backend |
| Persistent contract accounts | A contract is a set of UTXOs, not an account | Category-branded contract identity |
| Synchronous message calls | No cross-input call stack | Co-spent inputs/outputs pinned by the covenant |
| Gas metering | No gas economy | Bytecode size, stack size and per-input operation cost limits |
| EIP-55 checksummed address literals | Addresses are locking bytecode | CashAddr encoding in the SDK |
| EIP-4844 blobs (`blobhash`, `block.blobbasefee`) | No BCH blobs | Porting shims that return zero / alias `block.basefee`, compiler-warned |

## Where SolidCash goes further

Some things SolidCash has that Solidity does not.

- **Working fixed-point decimals.** Solidity declares `fixed`/`ufixed` but any real use is a compile error in
  solc. SolidCash implements them as scale-correcting scaled integers.
- **Iterable mappings.** Declare `enumerable mapping(...)` and iterate with `for-of` (values), `for-in` (keys)
  or `for-of ... .entries` (pairs), or page through the values with `for (V v of this.m.window(cursor, N))`.
- **`switch` / `case` / `default`** as a statement.
- **Explicit enum member values** (`enum Priority { LOW = 1, HIGH = 10 }`).
- **String and bytes methods**: `.slice()`, `.split()`, `.reverse()`, `.length`, and `+` concatenation.
- **`date("YYYY-MM-DDThh:mm:ss")` literals**, folded to a UTC Unix timestamp at compile time.
- **Full transaction introspection**: `tx.inputs[i]` and `tx.outputs[i]` fields, `this.activeBytecode`,
  `this.activeInputIndex`, and the covenant patterns they enable.
- **Native BCH units**: `sats`, `satoshis`, `finney`, `bits`, `bitcoin`.
- **CashTokens**: first-class fungible-token and NFT containers on a contract.

## Experimental profiles

These compile, but 0.14.0-beta.1 does not include them in its stability promise:

- composed external state mutation: a typed call that changes another contract's state;
- custom delegate forwarding beyond the built-in proxy profile (`upgrades.deployProxy`);
- message-bus kernel composition (see [Message Bus](/docs/guides/message-bus));
- the framed convention, `composition: 'framed'` (see [Framed Composition](/docs/guides/framed-composition)); and
- Solidity source shapes outside the subset documented here and in
  [Solidity Import Compatibility](/docs/compiler/solidity-import-compat), even when the parser accepts them.

## A worked port

A minimal Solidity contract, and the same thing in SolidCash:

```solidity
pragma solidcash ^0.14.0;

interface IERC20 {
    function transfer(address to, uint256 amount) returns (bool);
}

error InsufficientBalance(uint256 available, uint256 required);

event Transfer(address indexed from, address indexed to, uint256 value);

contract Token(pubkey admin) {
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    constructor() {
        this.totalSupply = 1_000_000;
    }

    modifier onlyAdmin(sig s) {
        require(checkSig(s, admin));
        _;
    }

    function transfer(address to, uint256 amount, sig s) public onlyAdmin(s) {
        uint256 available = this.balanceOf[msg.sender];
        if (available < amount) revert InsufficientBalance(available, amount);

        this.balanceOf[msg.sender] = available - amount;
        this.balanceOf[to] += amount;

        emit Transfer(msg.sender, to, amount);
    }
}
```

The differences from the Solidity original are small and deliberate:

- Contract-level parameters (`pubkey admin`) are immutable constructor arguments baked into the script.
- Authorization uses `checkSig` against a public key rather than `msg.sender == owner`.
- A `sig` parameter carries the spender's signature.

## See also

- [Platform Differences](/docs/basics/platform-differences) - byte order, integers, hashing, execution model
- [Types & Operators](/docs/language/types) - the full type reference
- [Data Locations](/docs/language/data-locations) - `memory`, `calldata` and `storage` on a UTXO chain
- [Inline Assembly](/docs/language/assembly) - the supported Yul subset
- [Contract Creation & Lifecycle](/docs/language/contract-creation) - `new`, upgrades, selfdestruct, proxies
