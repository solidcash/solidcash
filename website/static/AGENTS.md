# SolidCash -- AI Agent Reference

SolidCash is a high-level language for Bitcoin Cash smart contracts with Solidity-compatible syntax. It compiles .scash source files to Bitcoin Script bytecode. The repository is a monorepo: compiler (packages/solidc), SDK (packages/solidcash), shared utils (packages/utils).

## Build & Test

    yarn                  # install + bootstrap + build
    yarn build            # build all packages
    yarn test             # run all tests
    yarn test -t 'name'   # run specific test by name
    yarn lint             # lint all packages

### Fast Development Loop (Use By Default)

For iterative development, do not repeatedly launch one-shot builds and test runners. Their TypeScript and
Vitest startup/import costs dominate focused tests. Keep these processes alive in separate terminals:

    yarn build:watch
    yarn test:compiler:watch -- test/SomeCompiler.test.ts
    yarn test:sdk:watch -- test/unit/SomeSdk.test.ts
    yarn test:e2e:watch -- test/e2e/SomeE2e.test.ts

`build:watch` assumes changes affect direct dependencies to minimize edit latency. This is not the final type
gate: run one-shot `yarn build` before handoff to validate all transitive project references.

For a quick Git-aware check that requires no file selection, use `yarn test:compiler:changed`,
`yarn test:sdk:changed`, or `yarn test:e2e:changed`. These select tests related to uncommitted changes and
exit successfully when no tests are affected; they do not replace the relevant one-shot suite before handoff.

In `solidcash`, `test:unit` means only `test/unit`. `test:fast`, `test:changed`, and `test:watch` also cover
top-level SDK regressions but exclude the conformance and journal/message-bus directories. Do not broaden these
development-loop commands; `yarn test` remains the comprehensive non-root-e2e regression gate.

Pass `-t 'test name'` after the optional file path for a narrower loop. Vitest automatically reruns affected
tests on save; press `r` to rerun the current selection. Prefer the narrowest relevant file/name during
implementation, then run the corresponding one-shot suite and `yarn build` before handoff.

Always use `test:e2e:watch` for focused e2e watch runs. Do not run `vitest test/e2e <file>`: Vitest treats
positional filters as alternatives, so that form runs every e2e file instead of only `<file>`. The dedicated
e2e watch config restricts discovery while allowing an additional file filter.

The root build uses TypeScript project references. Preserve `tsconfig.packages.json`, package `references`, and
incremental build metadata; do not replace the build with per-package `tsc -p` loops. Generated testing-suite
artifacts only need regeneration when contract sources or emitted compiler JavaScript change; `.tsbuildinfo`
and declaration/source-map timestamp changes must not invalidate them.

Yarn workspaces already link local packages during install. Do not restore `lerna bootstrap` to `postinstall`;
it performs a redundant second dependency resolution before the build.

CI installs with `--ignore-scripts` because its next step runs the authoritative explicit build. Preserve that
ordering; allowing workspace lifecycle builds during CI installation compiles the monorepo twice.

## File Structure

    packages/solidc/src/grammar/SolidCash.g4   -- ANTLR4 grammar (source of truth)
    packages/solidc/src/ast/AST.ts             -- AST node definitions
    packages/solidc/src/semantic/              -- 3 visitor passes (symbols, types, final-require)
    packages/solidc/src/generation/            -- bytecode codegen (GenerateTargetTraversal.ts)
    packages/solidcash/src/Contract.ts         -- non-stateful contract SDK
    packages/solidcash/src/StatefulContract.ts -- stateful contract SDK
    packages/solidcash/src/TransactionBuilder.ts -- transaction building

## Language Syntax

### Source File Structure

    pragma solidcash ^0.13.0;
    import "./Base.scash";
    import { Struct, func } from "./Lib.scash";

    // File-level definitions (importable)
    int constant MAX = 100;
    struct Pair { int x; int y; }
    enum Status { PENDING, ACTIVE, DONE }
    type TokenId is bytes32;
    error InsufficientBalance(int requested, int available);
    event Transfer(bytes20 indexed from, bytes20 to, int amount);
    function freeFunc(int x) { require(x > 0); }
    library MathLib { function square(int x) returns (int) { return x * x; } }
    using MathLib for int;
    using { add as +, sub as - } for int;

    interface IToken {
        int public totalSupply;
        mapping(bytes20 => int) public balances;
        function transfer(bytes20 to, int amount);
    }

    contract MyContract(pubkey admin) is Base(admin) {
        // Order: enum* struct* type* event* error* const* stateVar* modifier* constructor? function*
    }

### Types

    bool                              -- true / false
    int / uint                        -- 256-bit signed / unsigned (checked; unchecked wraps)
    bigint                            -- arbitrary-precision BCH-native integer
    int8 .. int256                    -- bounded signed (8-bit steps)
    uint8 .. uint256                  -- bounded unsigned (8-bit steps)
    fixed / fixed128x18               -- signed fixed-point (MxN: M=bits, N=decimals)
    ufixed / ufixed128x18             -- unsigned fixed-point
    string                            -- UTF-8 byte sequence
    bytes                             -- unbounded byte sequence
    bytes1 .. bytes32 (byte=bytes1)   -- bounded byte sequence
    pubkey                            -- public key (~33 bytes)
    sig                               -- transaction signature (~65 bytes)
    datasig                           -- data signature (~64 bytes)
    address / address payable         -- locking bytecode
    mapping(K => V)                   -- key-value store (state only, backed by entry NFTs)
    T[] / T[] packed                  -- dynamic array (state only)
    T[N]                              -- fixed-size array

### Literals

    42, -7, 1_000_000, 1e6           -- integers
    1.5, 0.05                         -- decimals (for fixed-point)
    true, false                       -- booleans
    "hello", 'world'                  -- strings
    0xdeadbeef                        -- hex literal
    hex"cafebabe", hex'01 02'         -- hex string literal
    date("2025-12-31T14:30:00")       -- compile-time unix timestamp
    1000 satoshis, 1 bitcoin          -- number units (sats=1, finney=10, bits=100, bitcoin=1e8)
    7 days, 2 hours                   -- time units (seconds=1, minutes=60, hours=3600, days=86400, weeks=604800)

### Operators (by precedence, highest first)

    ()                                -- parentheses
    type(expr)                        -- type cast
    new Class(args)                   -- instantiation
    func(args)                        -- function call
    tuple[index]                      -- tuple index
    obj.member                        -- member access
    - ! ~                             -- unary minus, logical NOT, bitwise NOT
    **                                -- exponentiation (right-associative)
    * / %                             -- multiplication, division, modulo
    + -                               -- addition/subtraction, string/bytes concatenation
    << >>                             -- shift
    < <= > >=                         -- comparison
    == !=                             -- equality
    &                                 -- bitwise AND
    ^                                 -- bitwise XOR
    |                                 -- bitwise OR
    &&                                -- logical AND (no short-circuit)
    ||                                -- logical OR (no short-circuit)
    ? :                               -- ternary conditional
    =                                 -- assignment

### Statements

    // Variable declaration (type required, no var/let/const)
    int x = 42;
    bytes32 constant ZERO = bytes32(0);

    // Assignment
    x = x + 1;

    // Require (primary validation; external/public functions must end with require)
    require(condition);
    require(condition, "error message");

    // Control flow
    if (cond) { ... } else if (cond2) { ... } else { ... }
    for (int i = 0; i < n; i = i + 1) { ... }
    while (cond) { ... }
    do { ... } while (cond);
    break; continue;
    switch (val) { case 0: ...; break; case 1: ...; break; default: ...; }

    // Error handling
    revert InsufficientBalance(100, 50);
    revert("message");
    assert(invariant);
    try expr returns (int r) { ... } catch Error(string reason) { ... } catch { ... }

    // Return (from internal/private/view/pure functions)
    return value;
    return (a, b);  // multiple return values

    // Tuple destructuring
    string a, string b = "Hello World".split(6);

    // Emit event
    emit Transfer(from, to, amount);

    // Delete
    delete localVar;
    delete this.stateVar;
    delete this.balances[key];

    // Inline assembly
    assembly { OP_DUP OP_ADD 0x01 }

    // Unchecked arithmetic (wrapping for bounded ints)
    unchecked { uint8 a = uint8(255) + uint8(1); }  // wraps to 0

    // Console (debug only, stripped from production bytecode)
    console.log("value:", x);

### Functions

    // External (default) -- callable from outside, uses 4-byte selector dispatch
    function transfer(bytes20 to, int amount) { ... }

    // Visibility modifiers
    function f() external { ... }   // only from outside
    function f() public { ... }     // anywhere, generates selector
    function f() internal { ... }   // this + children, inlined
    function f() private { ... }    // this only, inlined

    // State access
    function f() pure returns (int) { return 1; }     // no state
    function f() view returns (int) { return this.x; } // read-only

    // Return types
    function f() returns (int) { return 42; }
    function f() returns (int, bool) { return (42, true); }

    // Special functions
    constructor() { this.x = 0; }
    fallback(bytes input) external { ... }
    receive() external payable { ... }

### Custom Modifiers

    modifier onlyOwner(sig s) {
        require(checkSig(s, owner));
        _;   // placeholder for function body (multiple _ allowed)
    }

    function doThing(sig s) onlyOwner(s) { ... }

### Lifecycle Modifiers (stateful contracts only)

    function f() deploy { ... }          -- deploy child contract
    function f() upgrade { ... }         -- migrate to new bytecode
    function f() selfdestruct { ... }    -- permanently destroy
    function f(int n) split(n) { ... }   -- fork into N threads
    function f(int n) merge(n) { ... }   -- consolidate N threads
    function f() unsafe { ... }          -- tier 0: skip all covenant checks
    function f() unsafe(1) { ... }       -- tier 1: preserve master NFT
    function f() unsafe(2) { ... }       -- tier 2: preserve master + values

Proxy implementation functions use ordinary `public`/`external` syntax. The compiler infers eligible
state-mutating entry points and emits their proxy-context build as `artifact.delegateArtifact`.

### Stateful Contracts

State variables persist across transactions via CashToken NFT commitments.

    contract Counter(pubkey admin) {
        int public counter;                              // state variable
        bytes20 internal owner;                          // visibility
        int constant MAX = 100;                          // compile-time const
        bytes20 immutable deployer;                      // set once in constructor
        mapping(bytes20 => int) public balances;         // key-value store
        mapping(bytes20 holder => int balance) public b; // named keys/values
        mapping(K1 => mapping(K2 => V)) public nested;  // nested mappings
        string[] public items;                           // dynamic array
        int[] packed public scores;                      // packed array (fixed-width only)
        event Increment(int indexed newValue);           // event definition

        constructor() {
            this.deployer = hash160(admin);
        }

        function increment(sig s) {
            require(checkSig(s, admin));
            this.counter = this.counter + 1;
            emit Increment(this.counter);
        }
    }

    // State access: this.varName (read/write)
    // Mapping access: this.balances[key]
    // Partial struct update: this.users[key].name = newName;
    // Mapping delete: delete this.balances[key];
    // Array ops: this.items.push(x); this.items.pop(); this.items[i] = x;
    // Token container: this.tokens[category].tokenAmount / .transfer() / .transferNft()
    // Satoshi transfer: this.transfer(lockingBytecode, amount);

    // Mapping iteration (impossible in Solidity):
    for (int balance of this.balances) { ... }              // values
    for (bytes20 holder in this.balances) { ... }           // keys
    for (bytes20 holder, int balance of this.balances.entries) { ... }  // entries

### Introspection Variables

    this.activeInputIndex              -- int: index of current input being evaluated
    this.activeBytecode                -- bytes: contract bytecode of current input
    tx.version                         -- int: transaction version
    tx.locktime                        -- int: nLocktime field
    tx.inputs.length                   -- int: number of inputs
    tx.outputs.length                  -- int: number of outputs

    tx.inputs[i].value                 -- int: satoshi value
    tx.inputs[i].lockingBytecode       -- bytes: scriptPubKey
    tx.inputs[i].unlockingBytecode     -- bytes: scriptSig
    tx.inputs[i].outpointTransactionHash -- bytes32
    tx.inputs[i].outpointIndex         -- int
    tx.inputs[i].sequenceNumber        -- int
    tx.inputs[i].tokenCategory         -- bytes: 32-byte category (+ 0x01 mutable / 0x02 minting)
    tx.inputs[i].nftCommitment         -- bytes
    tx.inputs[i].tokenAmount           -- int (64-bit max)

    tx.outputs[i].value                -- int
    tx.outputs[i].lockingBytecode      -- bytes
    tx.outputs[i].tokenCategory        -- bytes (same format as inputs)
    tx.outputs[i].nftCommitment        -- bytes
    tx.outputs[i].tokenAmount          -- int

### msg/tx Globals (stateful contracts)

    msg.sender    -- address: locking bytecode of calling contract (tx.origin for direct calls)
    msg.value     -- int: net satoshi change in satoshi container (sum outputs - sum inputs)
    msg.sig       -- bytes4: 4-byte function selector of current function (compile-time constant)
    msg.data      -- bytes: unlocking bytecode with redeem script stripped (selector + args as pushdata)
    tx.origin     -- address: P2PKH locking bytecode of first non-token input

### Time Locks

    require(tx.time >= expr);          -- absolute lock (nLocktime via OP_CHECKLOCKTIMEVERIFY)
    require(this.age >= expr);         -- relative lock (nSequence via OP_CHECKSEQUENCEVERIFY)

### Locking Bytecode Construction

    new LockingBytecodeP2PKH(bytes20 pkh): bytes25
    new LockingBytecodeP2SH20(bytes20 scriptHash): bytes23
    new LockingBytecodeP2SH32(bytes32 scriptHash): bytes35
    new LockingBytecodeNullData(bytes[] chunks): bytes

### Built-in Functions

    // Arithmetic
    int abs(int a)
    int min(int a, int b)
    int max(int a, int b)
    bool within(int x, int lower, int upper)

    // Hashing
    bytes20 ripemd160(any x)
    bytes20 sha1(any x)
    bytes32 sha256(any x)
    bytes20 hash160(any x)            -- RIPEMD160(SHA256(x))
    bytes32 hash256(any x)            -- SHA256(SHA256(x))

    // Signatures
    bool checkSig(sig s, pubkey pk)
    bool checkMultiSig(sig[] sigs, pubkey[] pks)
    bool checkDataSig(datasig s, bytes msg, pubkey pk)

    // Utility
    bytes toPaddedBytes(int value, int length)

### ABI Encoding/Decoding

    bytes data = abi.encode(42, true, hex"abcd");
    bytes packed = abi.encodePacked(sender, amount);
    bytes call = abi.encodeWithSelector(hex"12345678", arg1, arg2);
    bytes call = abi.encodeWithSignature("transfer(address,uint)", to, amount);
    bytes call = abi.encodeCall(IToken.transfer, (recipient, amount));
    (int x, bool y) = abi.decode(data, (int, bool));
    int value = abi.decodeAt(data, (int), 4);

### String/Bytes Members

    .length                            -- int: size
    .split(int pos)                    -- (T, T): split at position
    .slice(int start, int end)         -- T: substring/subsequence
    .reverse()                         -- T: reversed copy
    string.concat(a, b, c)            -- string concatenation
    bytes.concat(a, b, c)             -- bytes concatenation

### External Contract Interaction

    // State read
    int val = ICounter(categoryId).counter;

    // Output state read (post-execution state in same tx)
    int newVal = ICounter(categoryId).outState.counter;

    // External function calls
    ITarget(categoryId).functionName.call();        // stateful
    ITarget(categoryId).functionName.staticcall();   // read-only

    // Low-level calls
    address(target).call(data);
    address(target).staticcall(data);
    address(target).delegatecall(data);

### Type Introspection

    type(int8).min                     -- -128
    type(uint8).max                    -- 255
    type(fixed128x18).min / .max
    type(Status).min / .max            -- enum bounds
    type(IToken).interfaceId           -- bytes32 (EIP-165 style)
    type(MyContract).name              -- string

### Type Casting

    // Implicit: pubkey/sig/datasig -> bytes
    // Explicit:
    int(bytesVal)       bool(intVal)      bytes(intVal)
    pubkey(bytesVal)    sig(bytesVal)     datasig(bytesVal)
    // Unsafe (no conversion opcodes):
    unsafe_int(x)       unsafe_bool(x)    unsafe_bytes20(x)

## SDK Quick Reference

### Non-Stateful Contract

    import { Contract, TransactionBuilder, ElectrumNetworkProvider, SignatureTemplate } from 'solidcash';
    const provider = new ElectrumNetworkProvider('chipnet');
    const contract = new Contract(artifact, [constructorArg], { provider, addressType: 'p2sh32' });
    const utxos = await contract.getUtxos();
    const tx = new TransactionBuilder({ provider })
      .addInput(utxos[0], contract.unlock.functionName(args))
      .addOutput({ to: address, amount: 1000n })
      .send();

### Stateful Contract

    import { StatefulContract } from 'solidcash';

    // Deploy
    const { contract, categoryId } = await StatefulContract.deploy({ artifact, constructorArgs, provider, fundingUtxo, funder, changeAddress });

    // Connect to existing
    const sc = StatefulContract.withCategory(innerContract, categoryId, { externals: { IFoo: otherContract } });

    // Call function
    await sc.call.increment(pubkey, sig).send();

    // Read state
    const state = await sc.getState();

    // Lifecycle
    await StatefulContract.upgrade({ provider, oldContract, upgradeFunctionName, upgradeFunctionArgs, newArtifact, newConstructorArgs });
    await StatefulContract.destroy({ provider, contract, destroyFunctionName, destroyFunctionArgs, recipientAddress });
    await StatefulContract.deployFrom({ provider, parentContract, deployFunctionName, deployFunctionArgs, childArtifact, ... });

## Key Differences from Solidity

- No EVM; compiles to Bitcoin Script (stack-based, no persistent storage opcode)
- State stored in CashToken NFT commitments (128 bytes per NFT), not account storage slots
- Mappings backed by entry NFTs (one per key); iteration IS possible
- msg.sender returns address (locking bytecode), not account address
- msg.value is net satoshi container change, not ETH sent with call
- msg.sig is bytes4 function selector (same semantics as Solidity)
- No gas concept; operation cost limit based on script length
- No reentrancy (UTXO model; inputs consumed atomically)
- Exponentiation (**) IS supported (unlike early CashScript)
- `int`/`uint` have Solidity-compatible 256-bit checked/wrapping semantics; `bigint` exposes BCH BigInt
- Fixed-point decimals (fixedMxN) fully implemented (Solidity declared but never built)
- `||` and `&&` short-circuit
- Max contract size: 10,000 bytes (P2SH consensus limit)
- NFT commitment limit: 128 bytes
- addressType: p2sh20, p2sh32 (recommended), p2s

## Compiler Pipeline

    .scash source
      -> Lexer/Parser (ANTLR4)
      -> AST (AstBuilder)
      -> SymbolTableTraversal (definitions, scoping)
      -> TypeCheckTraversal (type compatibility)
      -> EnsureFinalRequireTraversal (covenant safety)
      -> GenerateTargetTraversal (Bitcoin Script bytecode + source maps)
      -> Bytecode optimization
      -> Artifact (JSON/TS with bytecode, ABI, debug info)
