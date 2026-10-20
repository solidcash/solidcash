# Solidity vs CashScript Gap Analysis

## Language-Level Gaps

### 1. Modularity & Code Organization
- No imports (`import "./Ownable.sol"`)
- No contract inheritance (`contract A is B, C`)
- No interfaces (`interface IERC20 { ... }`)
- No abstract contracts (`abstract contract Base`)
- No libraries (`library SafeMath` / `using X for Y`)
- Single contract per file

### 2. Type System
- No enums (`enum State { Active, Paused }`) — **PLANNED**
- No type aliases (`type Amount is uint256`)
- No nested structs (fields must be int/bool/bytes1-32)  — **PLANNED**
- No structs in arrays — **PLANNED**
- No struct methods
- No `address` type (uses `bytes20` / locking bytecodes)

### 3. Control Flow
- No while loops — **PLANNED**
- No break / continue — **PLANNED**
- No ternary operator (`cond ? a : b`) — **PLANNED**
- No switch / case

### 4. Error Handling
- No custom error types (`error InsufficientBalance(uint256)`)
- No `revert` with error
- No try / catch
- No assert / panic (only `require(cond, "msg")`)

### 5. Functions
- No function overloading
- No default parameters
- No named arguments
- Modifiers: YES (just added)

### 6. Constants & Compile-Time
- File-level constants: YES
- Contract-level constants: YES
- No `type(uint256).max` / `.min`
- Constructor params serve as immutables

### 7. Inline / Low-Level
- No inline Bitcoin Script assembly — **PLANNED**
- Has `abi.encode()` / `abi.encodePacked()` / `abi.decode()`

## Platform-Level Gaps (UTXO vs Account)

### State & Storage
- State in UTXO commitments (40-byte limit per NFT), not global storage
- Writes forbidden in loops; must be balanced across branches
- Mapping keys must be function parameters (not arbitrary expressions)
- Bin-packed into NFT commitments with 40-byte cap

### Cross-Contract Interaction
- No direct contract calls — covenant-enforced output patterns instead
- No `msg.sender` — introspect `tx.inputs[i].lockingBytecode` instead
- No reentrancy possible (UTXO model prevents it)
- No return values from external calls

### Value & Token Transfer
- `this.transfer(lockingBytecode, amount)` instead of `address.transfer(amount)`
- CashTokens (native FTs/NFTs) instead of ERC-20/ERC-721 wrapper contracts
- `this.tokens[category].send()` for native token transfers

### Transaction Context
- `tx.time` instead of `block.timestamp`
- No `block.number` equivalent
- No gas model (script size/opcount limits are implicit)
- `tx.inputs[this.activeInputIndex].unlockingBytecode` instead of `msg.data`

## Current CashScript Feature Set (v0.13.0-next.3)

### Types
- Primitives: int, bool, string, pubkey, sig, datasig
- Bytes: bytes (unbounded), bytes1-bytes32 (bounded), byte
- Composite: structs (flat fields only), arrays (int/bool/bytesN only), mappings
- Tuples: multi-value returns with destructuring

### Control Flow
- if/else, do-while, for loops
- require(condition, "message")
- No while, no break/continue, no ternary

### Functions
- Visibility: external (default), public, internal, private
- Mutability: pure, view, payable
- Custom modifiers with `_` placeholder
- Free functions (top-level, outside contract)
- Return types (single and tuple)

### Contract Features
- Constructor parameters and optional constructor body
- State variables (int/bool/bytes1-32)
- Mappings and arrays as state
- Events with emit
- Structs and custom types
- Constants (file-level and contract-level)

### Operators
- Arithmetic: +, -, *, /, %
- Bitwise: &, |, ^, ~, <<, >>
- Comparison: <, <=, >, >=, ==, !=
- Logical: &&, ||, !
- Member: .field, .length, .reverse(), .split(), .slice()

### Built-in Functions
- Crypto: checkSig, checkMultiSig, checkDataSig
- Hash: hash160, sha1, sha256, hash256, ripemd160
- Math: abs, min, max, within
- ABI: abi.encode, abi.encodePacked, abi.decode, abi.decodeAt
- Bytecode: LockingBytecodeP2PKH, P2SH20, P2SH32, NullData

### Transaction Introspection
- tx.inputs[i]: value, lockingBytecode, outpointTransactionHash, outpointIndex, unlockingBytecode, sequenceNumber, tokenCategory, nftCommitment, tokenAmount
- tx.outputs[i]: value, lockingBytecode, tokenCategory, nftCommitment, tokenAmount
- tx.version, tx.locktime, tx.inputs.length, tx.outputs.length
- this.activeInputIndex, this.activeBytecode, this.age
- tx.time
