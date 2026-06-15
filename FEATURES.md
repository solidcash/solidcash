# SolidCash Feature Summary

A high-level, Solidity-flavored language for Bitcoin Cash smart contracts. Compiles `.scash` to BCH Script (`solidc`); interact via the `solidcash` SDK. Targets the BCH 2026 VM (loops `OP_BEGIN/OP_UNTIL`, functions `OP_DEFINE/OP_INVOKE`).

## Language (compiler)

**Types**
- Primitives: `bool`, `int` (unbounded BigInt), `string`, `bytes`, `pubkey`, `sig`, `datasig`
- Bounded ints: `int8..int256`, `uint8..uint256` (8-bit steps, overflow/underflow checked)
- Bounded bytes: `bytes1..bytes32` (`byte` = `bytes1`)
- Fixed-point decimals: `fixed`/`ufixed`, `fixedMxN`/`ufixedMxN` (scaled-integer arithmetic)
- `address` / `address payable` / connected address (`.connect(category)`)
- User-defined value types (`type Price is int`), enums, structs (nested, named/positional init, partial-field assignment)
- Arrays: fixed `T[N]`, dynamic `T[]`, multi-dimensional, `packed` (fixed-width, O(1)) vs unpacked; `new T[](n)`, `.push/.pop/.delete/.length`
- Mappings `mapping(K => V)` with named keys/values; tuples (multi-return + destructuring)

**Operators**
- Arithmetic `+ - * / % **`; increment/compound `++ -- += -=`
- Bitwise `& | ^ ~ << >>`; logical `&& || !`; comparison `== != < <= > >=`; ternary `?:`
- Casts `type(expr)` + unsafe casts `unsafe_int/unsafe_bool/unsafe_bytesN/unsafe_byte`

**Control flow**
- `if`/`else if`/`else`; `for`, `while`, `do-while`, `break`, `continue`
- Collection iteration `for ... of/in` (arrays, mappings, `.entries`)
- `switch`/`case`/`default`; `try`/`catch`; `require`, `assert`, `revert`; `unchecked { }` (wrapping arithmetic)

**Structure**
- `contract` (constructor args, `is` inheritance, `abstract`), `interface`, `library` (`using ... for`, operator overload `using { add as + }`)
- File-level (importable): `const`, `struct`, `enum`, `type`, `event`, `error`, free functions
- Functions: visibility `external/public/internal/private`, mutability `pure/view/payable`, multi-return, custom + lifecycle modifiers, `fallback`, `receive`
- `import` (wildcard / namespace / selective); inline `assembly { OP_... }`; `console.log` (debug-only)

**Stateful contracts (covenants)**
- State variables, mappings, and dynamic arrays as on-chain state (entry NFTs, token containers, satoshi containers)
- `event`/`error` with `emit`/`revert`
- Lifecycle modifiers: `deploy`, `upgrade`, `selfdestruct`, `split`, `merge`, `unsafe`, `delegate` (delegatecall proxy/implementation)

**Cross-contract & introspection**
- External reads `IFoo(category).stateVar`; external calls + low-level `.call/.staticcall/.delegatecall`; `address.transfer/.send`
- `tx.version/locktime/time/age/origin/inputs/outputs`, `this.activeBytecode/activeInputIndex/age`, `msg.sender/value/data/sig`
- Globals: `abi.encode/encodePacked/encodeWithSelector/encodeWithSignature/encodeCall`, `abi.decode`, bytes/string concat, type introspection, `toPaddedBytes`, hashing, `date()`, number/time units

## SDK (`solidcash`)

- **Contract** - load artifact, instantiate, address types `p2sh20`/`p2sh32`/`p2s`
- **StatefulContract** - `deploy`, state read/write, entries (`setEntry`/`getEntry`), token/satoshi containers, `split`/`merge`/`destroy`, threads (`ThreadManager`/`ThreadHandle`), VM-based **auto-derivation** of commitments/transfers/events, transitive external-call resolution, connect-time external binding
- **TransactionBuilder** / **StatefulTransactionBuilder** - fluent `addInput`/`addOutput`, configurable change outputs (`addBchChangeOutputIfNeeded`/`addTokenChangeOutputIfNeeded`), `build`/`send`/`debug`
- **SignatureTemplate**, **Signer**
- **Network providers** - Electrum, Mock (vmTarget/blockHeight/UTXO-set), FullStack, BitcoinRpc, Regtest, FailingMock
- **Utilities** - `gatherBchUtxos`/`gatherFungibleTokenUtxos`, `randomUtxo`/`randomToken`/`randomNFT`
- **Debugging** - libauth template + bitauth URI, `require`/`console.log` messages, VM trace; typed event inference; WalletConnect integration

## Tooling / other

- **`solidc` compiler** - ANTLR4 (`SolidCash.g4`) -> AST -> semantic passes (symbols, types, final-require, locktime-guard) -> codegen -> dual optimizer -> artifact
- **Compiler options** - `enforceFunctionParameterTypes`, `enforceLocktimeGuard`, `commitmentLimit`, `importResolver`
- **Artifact** - bytecode, ABI, `debug` (source map, requires, logs, per-function debug), `functionBodies` (OP_INVOKE dispatch), `fingerprint`, `stateLayout`
- **Security** - auto-injected `tx.locktime` malleability guard; stateful contracts restricted to `p2sh32`
- **`@solidcash/testing`** - Hardhat-style framework: accounts, config, environment, contract factory, compile helpers, CLI
