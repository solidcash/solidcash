'use strict';

// Documentation database for SolidCash keywords, types, builtins, globals, member operations and BCH
// opcodes. Pure data + lookup helpers: no vscode dependency, so it is loadable from tests.
//
// Entries are grouped so `kind` and the docs link are declared once per group. Keys are exact source
// tokens: dotted globals keep their prefix (`msg.sender`), member operations keep a leading dot
// (`.lockingBytecode`), everything else is a bare word. Indexed introspection is keyed with `[i]`.

const BASE = 'https://solidcash.org/docs';
const CONTRACTS = `${BASE}/language/contracts`;
const FUNCTIONS = `${BASE}/language/functions`;
const BUILTINS = `${BASE}/language/builtin-functions`;
const CRYPTO = `${BASE}/language/cryptography`;
const GLOBALS = `${BASE}/language/globals`;
const TYPES = `${BASE}/language/types`;
const MODIFIERS = `${BASE}/language/modifiers`;
const DATA_LOCATIONS = `${BASE}/language/data-locations`;
const STATEFUL = `${BASE}/language/stateful-contracts`;
const ADVANCED = `${BASE}/language/advanced-features`;
const ASSEMBLY = `${BASE}/language/assembly`;
const EVENTS = `${BASE}/language/events-errors`;
const STRUCTS = `${BASE}/language/structs-enums-types`;
const INHERITANCE = `${BASE}/language/inheritance`;
const IMPORTS = `${BASE}/language/imports-interfaces`;
const LIBRARIES = `${BASE}/language/libraries`;
const CREATION = `${BASE}/language/contract-creation`;

const GROUPS = [
  {
    kind: 'declaration',
    link: CONTRACTS,
    items: {
      pragma: [
        'pragma solidcash ^0.13.0;',
        'Declares the compiler version range the source is written for. `pragma solidity ...` is also '
        + 'accepted so ported Solidity files compile unchanged.',
        `${CONTRACTS}#pragma`,
      ],
      solidcash: [
        'pragma solidcash ^0.13.0;',
        'Pragma dialect name: the version constraint is checked against the SolidCash compiler version.',
        `${CONTRACTS}#pragma`,
      ],
      solidity: [
        'pragma solidity >=0.8.0;',
        'Pragma dialect name accepted so ported Solidity sources compile unchanged. The version '
        + 'constraint is not enforced.',
        `${IMPORTS}#importing-solidity-sources`,
      ],
      _: [
        'modifier onlyOwner(sig s) { require(checkSig(s, owner)); _; }',
        'Placeholder inside a modifier body marking where the decorated function body is spliced in.',
        `${MODIFIERS}#custom-modifiers`,
      ],
      import: [
        'import "./Token.scash";\nimport { ERC20 as Token } from "./Token.scash";\nimport "./Math.scash" as Math;',
        'Pulls contracts, interfaces, libraries, structs, enums, events, errors, free functions and '
        + 'file-level constants from another file. Paths resolve relative to the importing file, then '
        + 'through `node_modules` for npm-style paths.',
        `${IMPORTS}#import-forms`,
      ],
      contract: [
        'contract Name(constructor args) is Base { ... }',
        'A contract compiles to one Bitcoin Script locking script. Constructor parameters are baked into '
        + 'the bytecode; each `public`/`external` function becomes one unlock path.',
        CONTRACTS,
      ],
      abstract: [
        'abstract contract Base() { ... }',
        'Marks a contract that cannot be deployed on its own. It may declare functions without a body for '
        + 'a deriving contract to implement.',
        `${IMPORTS}#abstract-contracts`,
      ],
      interface: [
        'interface IToken { function transfer(address to, int amount) external; }',
        'A declaration-only type used for cross-contract calls and external state reads. '
        + '`IToken(address).method()` co-spends the target contract in the same transaction.',
        `${IMPORTS}#interfaces`,
      ],
      library: [
        'library Math { function add(int a, int b) internal returns (int) { ... } }',
        'A stateless collection of functions. Library calls are inlined or routed through a co-spent '
        + 'delegate contract; `using Math for int;` attaches them to a type.',
        LIBRARIES,
      ],
      struct: [
        'struct Bid { address bidder; int amount; }',
        'A named group of fields. Structs work as locals, function arguments, return values and state '
        + 'variables, and their fields can be written individually.',
        `${STRUCTS}#structs`,
      ],
      enum: [
        'enum State { Created, Locked, Released }',
        'A named set of integer constants, referenced as `State.Locked`. Custom values are supported with '
        + '`Created = 1`.',
        `${STRUCTS}#enums`,
      ],
      type: [
        'type Price is int;\ntype(IToken).interfaceId',
        'Declares a user-defined value type (UDVT) wrapping an underlying type, converted with `.wrap()` '
        + 'and `.unwrap()`. As an expression, `type(T)` exposes introspection members such as '
        + '`interfaceId`, `name`, `min` and `max`.',
        `${STRUCTS}#user-defined-value-types-udvt`,
      ],
      event: [
        'event Transfer(address indexed from, address indexed to, int amount);',
        'Declares an event record type. Unlike a Solidity log, `emit` persists it as a CashToken NFT in the '
        + 'UTXO set. `E.selector` is the 32-byte SHA-256 of the event signature (this platform\'s analog of '
        + 'the keccak topic hash), and up to three `indexed` parameters can be filtered on when reading.',
        `${EVENTS}#event-definitions`,
      ],
      error: [
        'error InsufficientBalance(int available, int required);',
        'Declares a custom error type for `revert InsufficientBalance(a, b);`. The selector and arguments '
        + 'are surfaced by the SDK when the script fails.',
        `${EVENTS}#custom-error-definitions`,
      ],
      constructor: [
        'constructor(pubkey owner) { ... }',
        'Runs once at deployment to seed state. Constructor arguments of the contract header are baked '
        + 'into the locking bytecode; constructor body assignments seed the state NFT.',
        `${CONTRACTS}#constructor`,
      ],
      fallback: [
        'fallback() external payable { ... }',
        'The unlock path selected when no function selector matches. Accepted for Solidity parity and '
        + 'used for proxy forwarding.',
        `${ADVANCED}#fallback--receive-functions`,
      ],
      receive: [
        'receive() external payable { ... }',
        'The unlock path for a plain value transfer into the contract with no call data.',
        `${ADVANCED}#fallback--receive-functions`,
      ],
      function: [
        'function name(int arg) public returns (int) { ... }',
        'A `public`/`external` function is one unlock path of the contract script; `internal`/`private` '
        + 'functions are helpers. As a type, `function(int) external returns (int)` declares a function '
        + 'pointer.',
        `${CONTRACTS}#functions`,
      ],
      modifier: [
        'modifier onlyOwner(sig s) { require(checkSig(s, owner)); _; }',
        'A reusable guard inlined into every function that lists it. The `_;` placeholder marks where the '
        + 'function body is spliced in.',
        `${MODIFIERS}#custom-modifiers`,
      ],
      returns: [
        'function f() public returns (int, bytes32) { ... }',
        'Declares the return types of a function. Multiple returns are read as a tuple.',
        `${CONTRACTS}#functions`,
      ],
      is: [
        'contract Child() is Parent { ... }\ntype Price is int;',
        'Inheritance in a contract or interface header, and the underlying type in a `type` declaration.',
        `${INHERITANCE}#contract-inheritance`,
      ],
      using: [
        'using Math for int;\nusing { add as + } for Price global;',
        'Attaches library functions to a type so they can be called as members, optionally binding an '
        + 'operator. `global` makes the binding visible to importing files.',
        `${LIBRARIES}#using-for`,
      ],
      from: [
        'import { ERC20 } from "./Token.scash";',
        'Separates an import\'s binding list from its path. A soft keyword, so `from` is still usable as an '
        + 'identifier.',
        `${IMPORTS}#selective-import`,
      ],
      as: [
        'import { ERC20 as Token } from "./Token.scash";',
        'Renames an import binding, an imported namespace, or a `using`-bound operator.',
        `${IMPORTS}#namespace-import`,
      ],
      global: [
        'using { eq as == } for Price global;',
        'Makes a `using ... for` binding apply everywhere the type is visible, including importing files.',
        `${STRUCTS}#global-scope`,
      ],
      indexed: [
        'event Transfer(address indexed from, address to, int amount);',
        'Marks an event parameter as filterable when reading events from chain, up to three per event. Every '
        + 'parameter is encoded in the event NFT commitment either way, so this does not move data out of the '
        + 'payload.',
        `${EVENTS}#indexed-parameters`,
      ],
      anonymous: [
        'event Ping(int value) anonymous;',
        'Omits the event-signature hash from the event NFT covenant, so every anonymous event of a contract '
        + 'shares one address. Less on-chain overhead, at the cost of readers decoding against candidate '
        + 'definitions.',
        `${EVENTS}#anonymous-events`,
      ],
    },
  },
  {
    kind: 'modifier',
    link: MODIFIERS,
    items: {
      public: [
        'function f() public',
        'On a function: an externally callable unlock path of the contract script. On a state variable: '
        + 'readable cross-contract through a synthesized interface.',
        `${MODIFIERS}#visibility-modifiers`,
      ],
      external: [
        'function f() external',
        'Same as `public` in SolidCash: the function is an unlock path. On a state variable it makes the '
        + 'value readable cross-contract.',
        `${MODIFIERS}#visibility-modifiers`,
      ],
      internal: [
        'function f() internal',
        'Not an unlock path. Callable from this contract and contracts deriving from it; always inlined '
        + 'or invoked as a script subroutine.',
        `${MODIFIERS}#visibility-modifiers`,
      ],
      private: [
        'function f() private',
        'Not an unlock path, and not visible to deriving contracts.',
        `${MODIFIERS}#visibility-modifiers`,
      ],
      pure: [
        'function f() public pure',
        'Accepted for Solidity parity. Not enforced: there is no state-access metering on Bitcoin Cash.',
        `${MODIFIERS}#state-access-modifiers`,
      ],
      view: [
        'function f() public view',
        'Accepted for Solidity parity. Not enforced: there is no state-access metering on Bitcoin Cash.',
        `${MODIFIERS}#state-access-modifiers`,
      ],
      payable: [
        'function deposit() public payable',
        'Allows the contract balance to grow during the call and enables `msg.value`. On a type, '
        + '`address payable` marks a payout address.',
        `${MODIFIERS}#state-access-modifiers`,
      ],
      virtual: [
        'function f() public virtual',
        'Marks a function as overridable. Accepted for Solidity parity; overriding is resolved at compile '
        + 'time, so the keyword itself is a no-op.',
        `${INHERITANCE}#virtual--override`,
      ],
      override: [
        'function f() public override\nfunction f() public override(A, B)',
        'Replaces a base implementation. Checked against the C3-linearized base list.',
        `${INHERITANCE}#virtual--override`,
      ],
      constant: [
        'int constant FEE = 1000;',
        'On a top-level or contract-level definition: a compile-time value inlined at every use site with '
        + 'no state cost. On a parameter or local: a write-protected binding.',
        `${DATA_LOCATIONS}#constant`,
      ],
      immutable: [
        'int immutable deadline;',
        'A state field assigned once in the constructor and read-only afterwards. It still lives in the '
        + 'state NFT; the covenant rejects later writes.',
        `${DATA_LOCATIONS}#immutable`,
      ],
      transient: [
        'int transient guard;',
        'Accepted for Solidity (EIP-1153) parity. Lowered to a per-function local that is zero-initialized '
        + 'on every spend, and dropped from the state layout.',
        `${DATA_LOCATIONS}#transient-eip-1153`,
      ],
      memory: [
        'bytes memory data',
        'Mutable scratch data location. This is the default for locals and parameters, so the keyword is '
        + 'mostly for Solidity parity.',
        `${DATA_LOCATIONS}#memory`,
      ],
      calldata: [
        'bytes calldata data',
        'Read-only data location: assigning to a `calldata` parameter or local is a compile error. Copy it '
        + 'into a plain variable to modify.',
        `${DATA_LOCATIONS}#calldata`,
      ],
      storage: [
        'Bid storage bid = this.bids[id];',
        'Declares a local as a write-through alias of a state collection entry: writes to the alias update '
        + 'the entry.',
        `${DATA_LOCATIONS}#storage`,
      ],
      packed: [
        'int[10] packed values;',
        'Stores a bounded array or struct state field as one dense blob rather than one UTXO per element, '
        + 'trading per-element access cost for space.',
        `${DATA_LOCATIONS}#packed`,
      ],
      enumerable: [
        'enumerable mapping(address => int) balances;',
        'Enables source-level iteration over a verified mapping (vmap), including '
        + '`for (address k in this.balances)` and `this.balances.entries`. Plain mappings use the same '
        + 'authenticated storage but cannot be iterated.',
        `${STATEFUL}#mapping-iteration`,
      ],
      deploy: [
        'function create(sig s) public { new Child(admin); }   // inferred',
        'Lifecycle modifier reported in the ABI for a function that mints a child contract. It is inferred '
        + 'from the deploy form itself, so it is not a source-level keyword: writing `deploy` on a function '
        + 'is an undefined-modifier error.',
        `${MODIFIERS}#inferred-deploy`,
      ],
      upgrade: [
        'function upgradeTo(bytes code) public upgrade { ... }',
        'Lifecycle modifier: the function may change the contract bytecode, so the covenant does not pin '
        + 'its own script for that path.',
        `${CREATION}#upgrading`,
      ],
      selfdestruct: [
        'function close() public selfdestruct { ... }\nselfdestruct(recipient);',
        'Lifecycle modifier (and statement form): collapses all state UTXOs, ending the contract and '
        + 'forwarding the remaining balance.',
        `${CREATION}#destroying`,
      ],
      split: [
        'function fork(int n, sig s) split(n) { ... }',
        'Lifecycle modifier: the function fans one contract thread out into N independent copies of the '
        + 'state. The argument is the name of the function parameter holding the thread count, not a '
        + 'literal.',
        `${CREATION}#splitting-and-merging`,
      ],
      merge: [
        'function join(int n, sig s) merge(n) { ... }',
        'Lifecycle modifier: the function fans N contract threads back into one, combining their state. The '
        + 'argument is the name of the function parameter holding the thread count, not a literal.',
        `${CREATION}#splitting-and-merging`,
      ],
      unsafe: [
        'function f() public unsafe\nfunction f() public unsafe(1)',
        'Disables covenant checks so the function can introspect the transaction freely. Tier 0 is full '
        + 'access, tier 1 forbids reading state variables, tier 2 forbids writing NFTs.',
        `${MODIFIERS}#unsafe`,
      ],
      delegate: [
        'contract.asDelegate()',
        'Delegate mode is inferred, not written: the compiler emits `artifact.delegateArtifact` for '
        + 'eligible entry points so they can execute in a calling proxy\'s state context.',
        `${MODIFIERS}#inferred-delegate-mode`,
      ],
    },
  },
  {
    kind: 'statement',
    link: CONTRACTS,
    items: {
      require: [
        'require(bool condition);\nrequire(bool condition, string message);\nrequire(tx.time >= 600000);',
        'Aborts the script unless the condition holds. Every contract path must end in a passing check; '
        + 'with a `tx.time`/`this.age` operand it becomes a native time lock instead.',
        `${CONTRACTS}#require`,
      ],
      assert: [
        'assert(bool condition);',
        'Solidity-parity invariant check. Fails the script when the condition is false.',
        `${EVENTS}#assert`,
      ],
      revert: [
        'revert();\nrevert("message");\nrevert InsufficientBalance(available, required);',
        'Fails the script immediately, optionally with a message or a declared custom error carrying '
        + 'arguments.',
        `${EVENTS}#revert`,
      ],
      emit: [
        'emit Transfer(from, to, amount);\nemit Transfer({ from: a, to: b, amount: 1 });',
        'Creates an event NFT output: the encoded arguments become its token commitment, locked to a P2SH32 '
        + 'covenant pinned to the contract\'s token category and the event signature. The record lives in the '
        + 'UTXO set, readable from any node without archive access or indexing. Its 144-block relative '
        + 'timelock (roughly a day) then expires into an anyone-can-spend cleanup that reclaims the 1200 dust '
        + 'satoshis.',
        `${EVENTS}#emitting-events`,
      ],
      'console.log': [
        'console.log(value, "label");',
        'Records a debug line in the artifact so the SDK can print it when the script runs. Free at '
        + 'runtime: nothing is emitted into the transaction.',
        `${CONTRACTS}#consolelog`,
      ],
      delete: [
        'delete this.balances[key];\ndelete localVar;',
        'Assigns the target its type default. For a verified mapping this may leave an authenticated node '
        + 'holding `0`, `false`, or empty; it does not mean the entry NFT is physically removed.',
        `${STATEFUL}#deleting-entries`,
      ],
      unchecked: [
        'unchecked { total = total + amount; }',
        'Skips the overflow and underflow guards inside the block, matching Solidity semantics for ported '
        + 'arithmetic.',
        `${ADVANCED}#unchecked-arithmetic`,
      ],
      assembly: [
        'assembly { OP_DUP OP_HASH160 }\nassembly { let x := add(a, b) }',
        'Inline low-level block. Bare `OP_*` tokens are native Bitcoin Script; Yul syntax (`let`, `:=`, '
        + 'calls, control flow) is lowered by the compiler.',
        ASSEMBLY,
      ],
      new: [
        'new LockingBytecodeP2PKH(pkh)\nnew Child(arg)\nnew bytes(32)',
        'Constructs locking bytecode, a dynamically sized array / `bytes` / `string`, or a child contract '
        + '(which makes the enclosing function a deploy function, inferred by the compiler).',
        `${CREATION}#creating-a-contract-with-new`,
      ],
      if: ['if (condition) { ... } else { ... }', 'Conditional branch.', `${CONTRACTS}#if-statements`],
      else: ['else { ... }', 'The alternative branch of an `if` statement.', `${CONTRACTS}#if-statements`],
      for: [
        'for (int i = 0; i < n; i++) { ... }\nfor (address k in this.balances) { ... }\nusing Math for int;',
        'Bounded loop, collection iteration over a state mapping or array, or the type target of a '
        + '`using ... for` directive.',
        `${ADVANCED}#loops`,
      ],
      while: ['while (condition) { ... }', 'Loop that tests before each iteration.', `${ADVANCED}#while--do-while`],
      do: ['do { ... } while (condition);', 'Loop that runs the body before the first test.', `${ADVANCED}#while--do-while`],
      switch: [
        'switch (value) { case 1: ... default: ... }',
        'Multi-way branch on an expression. Cases do not fall through.',
        `${ADVANCED}#switch-statement`,
      ],
      case: ['case 1: ...', 'One branch of a `switch` statement.', `${ADVANCED}#switch-statement`],
      default: ['default: ...', 'The branch of a `switch` taken when no case matches.', `${ADVANCED}#switch-statement`],
      break: ['break;', 'Leaves the innermost loop or switch.', `${ADVANCED}#loops`],
      continue: ['continue;', 'Skips to the next iteration of the innermost loop.', `${ADVANCED}#loops`],
      return: [
        'return value;\nreturn (a, b);',
        'Returns from a function, optionally with a tuple of values.',
        `${CONTRACTS}#functions`,
      ],
      try: [
        'try IToken(addr).transfer(to, amount) returns (bool ok) { ... } catch { ... }',
        'Runs an external call and handles its failure locally instead of failing the whole script.',
        `${ADVANCED}#try-catch`,
      ],
      catch: [
        'catch Error(string reason) { ... }\ncatch { ... }',
        'The failure branch of a `try` statement, optionally binding the error data.',
        `${ADVANCED}#try-catch`,
      ],
      of: [
        'for (int v of this.values) { ... }\nfor (address k, int v of this.balances.entries) { ... }',
        'Iterates the values of a state collection, or key-value pairs with `.entries`.',
        `${STATEFUL}#mapping-iteration`,
      ],
      in: [
        'for (address key in this.balances) { ... }',
        'Iterates the keys of an `enumerable` state mapping.',
        `${STATEFUL}#mapping-iteration`,
      ],
      entries: [
        'for (address k, int v of this.balances.entries) { ... }',
        'Key-value view of an `enumerable` state mapping, used as the target of a two-variable `for ... of`.',
        `${STATEFUL}#mapping-iteration`,
      ],
    },
  },
  {
    kind: 'type',
    link: TYPES,
    items: {
      bool: ['bool', 'Boolean `true` or `false`.', `${TYPES}#boolean`],
      int: [
        'int   // alias of int256',
        'Signed 256-bit integer: an alias of `int256` for Solidity parity. Bounded and overflow-checked, '
        + 'with a fixed 33-byte on-chain encoding, so arrays of it are O(1)-indexable. Use `bigint` for the '
        + 'unbounded Bitcoin Cash native integer.',
        `${TYPES}#integers`,
      ],
      uint: [
        'uint   // alias of uint256',
        'Unsigned 256-bit integer: an alias of `uint256` for Solidity parity. Bounded and overflow-checked, '
        + 'with a fixed 33-byte on-chain encoding, so arrays of it are O(1)-indexable. Use `bigint` for the '
        + 'unbounded Bitcoin Cash native integer.',
        `${TYPES}#integers`,
      ],
      bigint: [
        'bigint',
        'The Bitcoin Cash VM native integer: arbitrary precision, no range check, and stored variable-width '
        + 'as minimal pushdata (little-endian sign-magnitude). Bounded only by the 10,000-byte stack-element '
        + 'limit. The cheapest integer to compute with; `int` / `uint` are the bounded Solidity-parity types.',
        `${TYPES}#integers`,
      ],
      string: [
        'string',
        'UTF-8 text. Backed by `bytes`, with `string.concat()` and `.length` available.',
        `${TYPES}#string`,
      ],
      bytes: [
        'bytes',
        'Variable-length byte string. `bytesN` fixes the length; casting between them is checked.',
        `${TYPES}#bytes`,
      ],
      byte: ['byte', 'A single byte; equivalent to `bytes1`.', `${TYPES}#bytes`],
      hex: [
        'hex"0a1b2c"',
        'Prefix for a hexadecimal byte-string literal. Equivalent to `0x0a1b2c`, and allowed to contain '
        + 'separating spaces or underscores.',
        `${TYPES}#bytes`,
      ],
      unicode: [
        'unicode"price in \\u20ac"',
        'Prefix for a string literal containing non-ASCII escapes.',
        `${TYPES}#string`,
      ],
      address: [
        'address\naddress payable',
        'An identity, held as the **full locking bytecode** rather than a 20-byte hash: 25 bytes for P2PKH, '
        + '35 for P2SH32, arbitrary for a covenant. That makes it variable-length and directly comparable '
        + 'against `lockingBytecode` introspection. `address payable` behaves identically, since every BCH '
        + 'address can receive value. Members: `.transfer`, `.send`, `.call`, `.staticcall`, `.delegatecall`, '
        + '`.code`, `.codehash`.',
        `${TYPES}#bytes-types-with-semantic-meaning`,
      ],
      pubkey: [
        'pubkey',
        'A secp256k1 public key: 33 bytes compressed, or 65 bytes uncompressed.',
        `${TYPES}#bytes-types-with-semantic-meaning`,
      ],
      sig: [
        'sig',
        'A transaction signature, checked with `checkSig()`. Only `0x` is a valid "false" signature under '
        + 'the NULLFAIL rule.',
        `${TYPES}#bytes-types-with-semantic-meaning`,
      ],
      datasig: [
        'datasig',
        'A signature over arbitrary data, checked with `checkDataSig()`.',
        `${TYPES}#bytes-types-with-semantic-meaning`,
      ],
      fixed: [
        'fixed / fixed128x18',
        'Signed fixed-point decimal. `fixedMxN` has M bits of width and N decimal digits; scaled '
        + 'intermediates do not overflow because the underlying VM integer is unbounded.',
        `${STRUCTS}#fixed-point-decimal-types`,
      ],
      ufixed: [
        'ufixed / ufixed128x18',
        'Unsigned fixed-point decimal. `ufixedMxN` has M bits of width and N decimal digits.',
        `${STRUCTS}#fixed-point-decimal-types`,
      ],
      mapping: [
        'mapping(address => int) balances;\nmapping(address owner => int balance) balances;',
        'Verified mapping (vmap): a key-value state collection whose linked entry NFTs authenticate both '
        + 'present and absent keys. Unset keys safely read as their type default. Keys may be named, values '
        + 'may be mappings or arrays, and `enumerable` enables source-level iteration.',
        `${STATEFUL}#verified-mappings`,
      ],
      this: [
        'this.stateVar\nthis.transfer(lockingBytecode, amount)\nthis.tokens[category]',
        'The contract itself: its state fields, its satoshi and token containers, and the introspection '
        + 'globals `this.activeInputIndex`, `this.activeBytecode`, `this.age` and `this.categoryId`.',
        STATEFUL,
      ],
      super: [
        'super.f()',
        'Calls the base-contract implementation of a function, following the C3-linearized order.',
        `${INHERITANCE}#virtual--override`,
      ],
      true: ['true', 'Boolean literal.', `${TYPES}#boolean`],
      false: ['false', 'Boolean literal.', `${TYPES}#boolean`],
    },
  },
  {
    kind: 'builtin function',
    link: BUILTINS,
    items: {
      abs: ['bigint abs(bigint a)', 'Absolute value of `a`.', `${BUILTINS}#abs`],
      min: ['bigint min(bigint a, bigint b)', 'Smaller of `a` and `b`.', `${BUILTINS}#min`],
      max: ['bigint max(bigint a, bigint b)', 'Larger of `a` and `b`.', `${BUILTINS}#max`],
      within: [
        'bool within(bigint x, bigint lower, bigint upper)',
        'True when `x >= lower && x < upper`.',
        `${BUILTINS}#within`,
      ],
      addmod: [
        'bigint addmod(bigint x, bigint y, bigint k)',
        'Computes `(x + y) % k` without intermediate overflow.',
        `${BUILTINS}#addmod`,
      ],
      mulmod: [
        'bigint mulmod(bigint x, bigint y, bigint k)',
        'Computes `(x * y) % k` without intermediate overflow.',
        `${BUILTINS}#mulmod`,
      ],
      ripemd160: ['bytes20 ripemd160(any x)', 'RIPEMD-160 hash of `x`.', `${BUILTINS}#ripemd160`],
      sha1: ['bytes20 sha1(any x)', 'SHA-1 hash of `x`.', `${BUILTINS}#sha1`],
      sha256: ['bytes32 sha256(any x)', 'SHA-256 hash of `x`.', `${BUILTINS}#sha256`],
      hash160: ['bytes20 hash160(any x)', 'RIPEMD-160 of the SHA-256 of `x`.', `${BUILTINS}#hash160`],
      hash256: ['bytes32 hash256(any x)', 'Double SHA-256 of `x`.', `${BUILTINS}#hash256`],
      keccak256: [
        'bytes32 keccak256(bytes message)',
        'Real Keccak-256 (not SHA-256), used for EVM-compatible hashes such as role ids and domain '
        + 'separators. A constant argument folds at compile time; a runtime call is computed by a co-spent '
        + 'side-car that commits the result, which the SDK wires automatically.',
        `${BUILTINS}#keccak256`,
      ],
      checkSig: [
        'bool checkSig(sig s, pubkey pk)',
        'Checks that `s` is a valid signature over the spending transaction for `pk`. Under NULLFAIL only '
        + 'an empty `0x` signature returns false; any other invalid signature fails the script.',
        `${BUILTINS}#checksig`,
      ],
      checkMultiSig: [
        'bool checkMultiSig(sig[] sigs, pubkey[] pks)',
        'Multi-signature check over the spending transaction. Not supported by the TypeScript SDK: prefer '
        + 'several `checkSig()` calls.',
        `${BUILTINS}#checkmultisig`,
      ],
      checkDataSig: [
        'bool checkDataSig(datasig s, bytes msg, pubkey pk)',
        'Checks that `s` is a valid signature over `msg` for `pk`. Used for oracle attestations.',
        `${BUILTINS}#checkdatasig`,
      ],
      ecrecoverPubKey: [
        'pubkey ecrecoverPubKey(bytes32 hash, bigint v, bytes32 r, bytes32 s)',
        'Recovers the compressed public key that signed `hash`. Pure script secp256k1 recovery, computed '
        + 'by a co-spent recovery side-car.',
        `${BUILTINS}#ecrecoverpubkey`,
      ],
      ecrecoverP2pkh: [
        'address ecrecoverP2pkh(bytes32 hash, bigint v, bytes32 r, bytes32 s)',
        'Recovers the signer of `hash` as a Bitcoin Cash P2PKH address.',
        `${BUILTINS}#ecrecoverp2pkh`,
      ],
      ecrecoverEvm: [
        'bytes20 ecrecoverEvm(bytes32 hash, bigint v, bytes32 r, bytes32 s)',
        'Recovers the signer of `hash` as a 20-byte EVM-style address, matching Solidity `ecrecover`.',
        `${BUILTINS}#ecrecoverevm`,
      ],
      ecrecover: [
        'bytes20 ecrecover(bytes32 hash, bigint v, bytes32 r, bytes32 s)',
        'Solidity-compatible spelling of `ecrecoverEvm`: recovers the signer of `hash` as a 20-byte '
        + 'EVM-style address.',
        `${CRYPTO}#signature-recovery-ecrecover`,
      ],
      toPaddedBytes: [
        'bytes toPaddedBytes(bigint value, bigint length)',
        'Zero-pads `value` to `length` bytes. Cheaper than a literal when a fixed-size zero field is '
        + 'needed.',
        `${BUILTINS}#topaddedbytes`,
      ],
      intToString: ['string intToString(bigint value)', 'Decimal string form of `value`.', `${BUILTINS}#inttostring`],
      stringToInt: [
        'bigint stringToInt(string value)',
        'Parses a decimal string into an integer.',
        `${BUILTINS}#stringtoint`,
      ],
      blockhash: [
        'bytes32 blockhash(bigint blockNumber)',
        'Hash of a block within the last 256 blocks, read from a co-spent block oracle. A read with no '
        + 'oracle entry fails the script instead of returning zero.',
        `${BUILTINS}#blockhash`,
      ],
      blobhash: [
        'bytes32 blobhash(bigint index)',
        'Always `bytes32(0)`: Bitcoin Cash has no EIP-4844 blobs. Present for Solidity parity.',
        `${BUILTINS}#blobhash`,
      ],
      gasleft: [
        'bigint gasleft()',
        'Fixed shim returning `1000000`. Bitcoin Cash has no gas metering; the compiler warns on use.',
        `${BUILTINS}#gasleft`,
      ],
      date: [
        'date("2024-01-01T00:00:00Z")',
        'Compile-time date literal that becomes the corresponding Unix timestamp.',
        `${ADVANCED}#date-literals`,
      ],
      LockingBytecodeP2PKH: [
        'new LockingBytecodeP2PKH(bytes20 pkh): bytes25',
        'P2PKH locking bytecode for a public key hash, to compare against `tx.outputs[i].lockingBytecode`.',
        `${GLOBALS}#lockingbytecodep2pkh`,
      ],
      LockingBytecodeP2SH20: [
        'new LockingBytecodeP2SH20(bytes20 scriptHash): bytes23',
        'P2SH20 locking bytecode for `hash160(script)`. Prefer P2SH32: 20-byte script hashes are '
        + 'collision-vulnerable.',
        `${GLOBALS}#lockingbytecodep2sh20`,
      ],
      LockingBytecodeP2SH32: [
        'new LockingBytecodeP2SH32(bytes32 scriptHash): bytes35',
        'P2SH32 locking bytecode for `hash256(script)`. The recommended form, and the only one used for '
        + 'stateful contracts.',
        `${GLOBALS}#lockingbytecodep2sh32`,
      ],
      LockingBytecodeNullData: [
        'new LockingBytecodeNullData(bytes[] chunks): bytes',
        'OP_RETURN locking bytecode carrying `chunks` as data. Provably unspendable, so any attached '
        + 'satoshis are burned.',
        `${GLOBALS}#lockingbytecodenulldata`,
      ],
      unsafe_int: [
        'unsafe_int(x)',
        'Reinterprets the bytes of `x` as an integer with no length or range check.',
        `${TYPES}#other-semantic-casting`,
      ],
      unsafe_bool: [
        'unsafe_bool(x)',
        'Reinterprets `x` as a boolean with no check.',
        `${TYPES}#other-semantic-casting`,
      ],
      unsafe_byte: [
        'unsafe_byte(x)',
        'Reinterprets `x` as a single byte with no length check.',
        `${TYPES}#other-semantic-casting`,
      ],
      unsafe_bytes: [
        'unsafe_bytes(x) / unsafe_bytes20(x)',
        'Reinterprets `x` as `bytes` (or `bytesN`) with no length check. Use a plain cast when the length '
        + 'should be verified.',
        `${TYPES}#other-semantic-casting`,
      ],
    },
  },
  {
    kind: 'ABI helper',
    link: `${ADVANCED}#abi-encoding--decoding`,
    items: {
      abi: [
        'abi.encode(...)  abi.encodePacked(...)  abi.decode(data, (int, bytes32))',
        'ABI encoding and decoding helpers, byte-compatible with Solidity so hashes and signatures match '
        + 'EVM tooling.',
      ],
      'abi.encode': [
        'bytes abi.encode(...values)',
        'ABI encoding with 32-byte padded words, matching Solidity `abi.encode`.',
      ],
      'abi.encodePacked': [
        'bytes abi.encodePacked(...values)',
        'Concatenates values with no padding. Ambiguous for dynamic types, exactly as in Solidity.',
      ],
      'abi.encodeWithSelector': [
        'bytes abi.encodeWithSelector(bytes4 selector, ...values)',
        'Prefixes the encoded arguments with a 4-byte function selector.',
      ],
      'abi.encodeWithSignature': [
        'bytes abi.encodeWithSignature(string signature, ...values)',
        'Derives the selector from a signature string, then encodes the arguments after it. The selector is '
        + 'sha256-derived by default, so the calldata is not cross-VM compatible without `evmCompat`.',
      ],
      'abi.encodeCall': [
        'bytes abi.encodeCall(IToken.transfer, (to, amount))',
        'Type-checked call encoding: the arguments are validated against the referenced function. Like '
        + '`encodeWithSignature`, the selector is sha256-derived unless `evmCompat` is enabled.',
      ],
      'abi.decode': [
        'abi.decode(bytes data, (int, bytes32))',
        'Decodes ABI-encoded bytes into the listed types.',
      ],
      'abi.decodeAt': [
        'abi.decodeAt(bytes data, (int), 4)',
        'Decodes starting at a byte offset, for skipping a selector prefix.',
      ],
      'bytes.concat': [
        'bytes bytes.concat(...values)',
        'Concatenates byte strings into one `bytes` value.',
        `${TYPES}#bytes`,
      ],
      'string.concat': [
        'string string.concat(...values)',
        'Concatenates strings into one `string` value.',
        `${ADVANCED}#string-features`,
      ],
    },
  },
  {
    kind: 'global',
    link: GLOBALS,
    items: {
      tx: [
        'tx.version  tx.locktime  tx.time  tx.inputs[i]  tx.outputs[i]  tx.origin  tx.gasprice',
        'The spending transaction: its version and locktime, full input and output introspection, and the '
        + 'Solidity-parity origin and fee-rate globals.',
        GLOBALS,
      ],
      msg: [
        'msg.sender  msg.value  msg.sig  msg.data',
        'The current call: the caller, the satoshis it sent, its selector and its argument bytes.',
        `${GLOBALS}#message-and-origin-variables`,
      ],
      block: [
        'block.number  block.timestamp  block.chainid  block.difficulty  block.coinbase',
        'Block properties. Most are read from a co-spent block oracle, since Bitcoin Cash script cannot '
        + 'observe the containing block directly.',
        `${GLOBALS}#block-properties`,
      ],
      console: [
        'console.log(value, "label");',
        'Debug logging recorded in the artifact and printed by the SDK. Nothing is emitted on chain.',
        `${CONTRACTS}#consolelog`,
      ],
      'tx.time': [
        'require(tx.time >= expression);',
        'Absolute time lock on the transaction (`nLocktime` via OP_CHECKLOCKTIMEVERIFY). Values below '
        + '500,000,000 are block numbers, higher values are timestamps. Usable only in `require`; use '
        + '`tx.locktime` to read the value.',
        `${GLOBALS}#txtime`,
      ],
      'this.age': [
        'require(this.age >= expression);',
        'Relative time lock on the UTXO being spent (`nSequence` via OP_CHECKSEQUENCEVERIFY), counted in '
        + 'blocks or 512-second chunks. Usable only in `require`.',
        `${GLOBALS}#thisage`,
      ],
      'this.activeInputIndex': [
        'bigint this.activeInputIndex',
        'Index of the transaction input currently being evaluated. Pairs with `tx.inputs[...]`.',
        `${GLOBALS}#thisactiveinputindex`,
      ],
      'this.activeBytecode': [
        'bytes this.activeBytecode',
        'Contract bytecode of the input currently being evaluated: the basis of covenant self-pinning.',
        `${GLOBALS}#thisactivebytecode`,
      ],
      'this.tokens': [
        'this.tokens[bytes32 category].tokenAmount\nthis.tokens[category].transfer(lockingBytecode, amount)',
        'Token containers held by the contract, keyed by CashToken category. Exposes `.tokenAmount`, '
        + '`.tokenCategory` and `.nftCommitment`, plus `.transfer()` and `.transferNft()`. The key must be '
        + 'a function parameter so the covenant can pin the category.',
        `${STATEFUL}#token-containers`,
      ],
      'this.categoryId': [
        'bytes this.categoryId',
        'Token category identifying this contract instance, used to pin its own state NFTs.',
        STATEFUL,
      ],
      'tx.version': [
        'bigint tx.version',
        'Version of the spending transaction. Only version 2 enforces BIP68 relative time locks.',
        `${GLOBALS}#txversion`,
      ],
      'tx.locktime': [
        'bigint tx.locktime',
        'The `nLocktime` field as a readable value, unlike `tx.time` which only works inside `require`.',
        `${GLOBALS}#txlocktime`,
      ],
      'tx.inputs': [
        'tx.inputs[i]',
        'Inputs of the spending transaction. Index it and read a property, for example '
        + '`tx.inputs[0].value`.',
        `${GLOBALS}#txinputs`,
      ],
      'tx.outputs': [
        'tx.outputs[i]',
        'Outputs of the spending transaction. Index it and read a property, for example '
        + '`tx.outputs[0].lockingBytecode`.',
        `${GLOBALS}#txoutputs`,
      ],
      'tx.inputs.length': ['bigint tx.inputs.length', 'Number of inputs in the transaction.', `${GLOBALS}#txinputslength`],
      'tx.outputs.length': [
        'bigint tx.outputs.length',
        'Number of outputs in the transaction.',
        `${GLOBALS}#txoutputslength`,
      ],
      'tx.inputs[i].value': ['bigint tx.inputs[i].value', 'Satoshi value of a specific input.', `${GLOBALS}#txinputsivalue`],
      'tx.inputs[i].lockingBytecode': [
        'bytes tx.inputs[i].lockingBytecode',
        'Locking bytecode (`scriptPubKey`) of a specific input.',
        `${GLOBALS}#txinputsilockingbytecode`,
      ],
      'tx.inputs[i].unlockingBytecode': [
        'bytes tx.inputs[i].unlockingBytecode',
        'Unlocking bytecode (`scriptSig`) of a specific input.',
        `${GLOBALS}#txinputsiunlockingbytecode`,
      ],
      'tx.inputs[i].outpointTransactionHash': [
        'bytes32 tx.inputs[i].outpointTransactionHash',
        'Transaction hash of the outpoint a specific input spends.',
        `${GLOBALS}#txinputsioutpointtransactionhash`,
      ],
      'tx.inputs[i].outpointIndex': [
        'bigint tx.inputs[i].outpointIndex',
        'Output index of the outpoint a specific input spends.',
        `${GLOBALS}#txinputsioutpointindex`,
      ],
      'tx.inputs[i].sequenceNumber': [
        'bigint tx.inputs[i].sequenceNumber',
        'The `nSequence` field of a specific input. Only enforced as a relative time lock with transaction '
        + 'version 2.',
        `${GLOBALS}#txinputsisequencenumber`,
      ],
      'tx.inputs[i].tokenCategory': [
        'bytes tx.inputs[i].tokenCategory',
        'Token category of a specific input, or `0x` when it holds no tokens. An NFT capability appends '
        + '`0x01` (mutable) or `0x02` (minting). Note the unreversed byte order, unlike wallets and '
        + 'explorers.',
        `${GLOBALS}#txinputsitokencategory`,
      ],
      'tx.inputs[i].nftCommitment': [
        'bytes tx.inputs[i].nftCommitment',
        'NFT commitment data of a specific input.',
        `${GLOBALS}#txinputsinftcommitment`,
      ],
      'tx.inputs[i].tokenAmount': [
        'bigint tx.inputs[i].tokenAmount',
        'Fungible token amount of a specific input (64-bit maximum).',
        `${GLOBALS}#txinputsitokenamount`,
      ],
      'tx.outputs[i].value': [
        'bigint tx.outputs[i].value',
        'Satoshi value of a specific output.',
        `${GLOBALS}#txoutputsivalue`,
      ],
      'tx.outputs[i].lockingBytecode': [
        'bytes tx.outputs[i].lockingBytecode',
        'Locking bytecode (`scriptPubKey`) of a specific output: the usual way a covenant pins where money '
        + 'may go.',
        `${GLOBALS}#txoutputsilockingbytecode`,
      ],
      'tx.outputs[i].tokenCategory': [
        'bytes tx.outputs[i].tokenCategory',
        'Token category of a specific output, or `0x` when it holds no tokens. An NFT capability appends '
        + '`0x01` (mutable) or `0x02` (minting). Note the unreversed byte order.',
        `${GLOBALS}#txoutputsitokencategory`,
      ],
      'tx.outputs[i].nftCommitment': [
        'bytes tx.outputs[i].nftCommitment',
        'NFT commitment data of a specific output.',
        `${GLOBALS}#txoutputsinftcommitment`,
      ],
      'tx.outputs[i].tokenAmount': [
        'bigint tx.outputs[i].tokenAmount',
        'Fungible token amount of a specific output (64-bit maximum).',
        `${GLOBALS}#txoutputsitokenamount`,
      ],
      'msg.sender': [
        'address msg.sender',
        'The calling contract\'s locking bytecode, or `tx.origin` for a direct wallet call. Requires '
        + 'exactly one co-spent caller, which the SDK arranges. Weaker than an account-chain caller: it is '
        + 'derived from the co-spent input set, not an authenticated call frame, so the compiler warns on '
        + 'every use. Authenticate with `checkSig` instead.',
        `${GLOBALS}#message-and-origin-variables`,
      ],
      'msg.value': [
        'bigint msg.value',
        'Satoshis sent to the contract in this call: the output balance minus the input balance of its '
        + 'satoshi container.',
        `${GLOBALS}#message-and-origin-variables`,
      ],
      'msg.sig': [
        'bytes4 msg.sig',
        'The 4-byte selector of the function being called.',
        `${GLOBALS}#message-and-origin-variables`,
      ],
      'msg.data': [
        'bytes msg.data',
        'The unlocking bytecode of this input with the redeem script stripped: the call\'s argument bytes.',
        `${GLOBALS}#message-and-origin-variables`,
      ],
      'tx.origin': [
        'address tx.origin',
        'Locking bytecode of the first native P2PKH input: the wallet that funded the transaction. Like '
        + '`msg.sender` it is builder-chosen rather than authenticated, so the compiler warns on every use.',
        `${GLOBALS}#message-and-origin-variables`,
      ],
      'tx.gasprice': [
        'uint32 tx.gasprice',
        'Realized fee rate of the transaction in sat/KB, `1000 * (sum in - sum out) / size`. Not wei/gas.',
        `${GLOBALS}#block-properties`,
      ],
      'block.number': [
        'uint32 block.number',
        'Current block height, read from a co-spent block oracle. A `>= K` comparison lowers to a native '
        + 'locktime floor with no oracle needed.',
        `${GLOBALS}#block-properties`,
      ],
      'block.timestamp': [
        'uint32 block.timestamp',
        'Block time as a uint32, read from a co-spent block oracle. Under `solidityImportCompat` it maps '
        + 'to `tx.locktime` instead.',
        `${GLOBALS}#block-properties`,
      ],
      'block.chainid': [
        'uint256 block.chainid',
        'Network identifier, typed `uint256` for Solidity parity and baked into the bytecode as a constant '
        + 'rather than read from an oracle. On stack it stays a minimal single-byte number, so the wide type '
        + 'costs nothing.',
        `${GLOBALS}#block-properties`,
      ],
      'block.difficulty': [
        'uint32 block.difficulty',
        'Raw `nBits` of the block from the oracle: the real proof-of-work difficulty, not an alias of '
        + '`prevrandao`, and not a randomness source.',
        `${GLOBALS}#block-properties`,
      ],
      'block.coinbase': [
        'address block.coinbase',
        'Full locking bytecode of the coinbase output, read from the block oracle.',
        `${GLOBALS}#block-properties`,
      ],
      'block.size': [
        'uint32 block.size',
        'Block size in bytes from the oracle. Bitcoin Cash native, with no Solidity counterpart.',
        `${GLOBALS}#block-properties`,
      ],
      'block.totalFees': [
        'uint32 block.totalFees',
        'Sum of transaction fees in the block, in satoshis, from the oracle. Bitcoin Cash native.',
        `${GLOBALS}#block-properties`,
      ],
      'block.basefee': [
        'uint32 block.basefee',
        'Realized fee rate of the block in sat/KB, derived as `1000 * block.totalFees / block.size`. '
        + 'Bitcoin Cash has no consensus base fee.',
        `${GLOBALS}#block-properties`,
      ],
      'block.blobbasefee': [
        'uint32 block.blobbasefee',
        'Aliases `block.basefee` (warned). There are no EIP-4844 blobs on Bitcoin Cash; aliasing avoids '
        + 'divide-by-zero in ported code.',
        `${GLOBALS}#block-properties`,
      ],
      'block.gaslimit': [
        'bigint block.gaslimit',
        'Fixed shim returning `1000000` (warned). Bitcoin Cash has no gas metering.',
        `${GLOBALS}#block-properties`,
      ],
      'block.prevrandao': [
        'uint256 block.prevrandao',
        'Transaction-local `abs(int(sha256(input[0] outpoint hash)))` (warned). Grindable by the '
        + 'transaction builder, so it is not a secure randomness source.',
        `${GLOBALS}#block-properties`,
      ],
    },
  },
  {
    kind: 'member',
    link: GLOBALS,
    items: {
      '.value': [
        'bigint .value',
        'Satoshi value of an input or output. In `.call{value: n}(data)` it is the amount forwarded with a '
        + 'low-level call.',
        `${GLOBALS}#txoutputsivalue`,
      ],
      '.lockingBytecode': [
        'bytes .lockingBytecode',
        'Locking bytecode (`scriptPubKey`) of an input or output.',
        `${GLOBALS}#txoutputsilockingbytecode`,
      ],
      '.unlockingBytecode': [
        'bytes .unlockingBytecode',
        'Unlocking bytecode (`scriptSig`) of an input.',
        `${GLOBALS}#txinputsiunlockingbytecode`,
      ],
      '.outpointTransactionHash': [
        'bytes32 .outpointTransactionHash',
        'Transaction hash of the outpoint an input spends.',
        `${GLOBALS}#txinputsioutpointtransactionhash`,
      ],
      '.outpointIndex': [
        'bigint .outpointIndex',
        'Output index of the outpoint an input spends.',
        `${GLOBALS}#txinputsioutpointindex`,
      ],
      '.sequenceNumber': [
        'bigint .sequenceNumber',
        'The `nSequence` field of an input.',
        `${GLOBALS}#txinputsisequencenumber`,
      ],
      '.tokenCategory': [
        'bytes .tokenCategory',
        'Token category of an input, output or token container; `0x` when there are no tokens. Byte order '
        + 'is unreversed, unlike wallets and explorers.',
        `${GLOBALS}#txoutputsitokencategory`,
      ],
      '.nftCommitment': [
        'bytes .nftCommitment',
        'NFT commitment data of an input, output or token container.',
        `${GLOBALS}#txoutputsinftcommitment`,
      ],
      '.tokenAmount': [
        'bigint .tokenAmount',
        'Fungible token amount of an input, output or token container.',
        `${STATEFUL}#token-container-properties`,
      ],
      '.length': [
        'bigint .length',
        'Number of elements in an array, bytes in a `bytes` value, or inputs/outputs in '
        + '`tx.inputs.length` / `tx.outputs.length`.',
        `${TYPES}#arrays`,
      ],
      '.push': [
        'array.push(value)\narray.push()',
        'Appends an element to a dynamic array, or a type default when called with no argument.',
        `${STATEFUL}#dynamic-arrays`,
      ],
      '.pop': ['array.pop()', 'Removes the last element of a dynamic array.', `${STATEFUL}#dynamic-arrays`],
      '.slice': [
        'bytes .slice(bigint start, bigint end)',
        'Sub-range of a `bytes` value from `start` up to `end`.',
        `${TYPES}#bytes`,
      ],
      '.split': ['(bytes, bytes) .split(bigint index)', 'Splits a `bytes` value in two at `index`.', `${TYPES}#bytes`],
      '.reverse': ['bytes .reverse()', 'Reverses the byte order of a `bytes` value (OP_REVERSEBYTES).', `${TYPES}#bytes`],
      '.delete': ['collection.delete(key)', 'Removes an entry from a state collection.', `${STATEFUL}#deleting-entries`],
      '.transfer': [
        'this.transfer(bytes lockingBytecode, bigint amount)\nthis.tokens[category].transfer(lockingBytecode, amount)\n'
        + 'recipient.transfer(amount)',
        'Sends satoshis from the contract balance, fungible tokens from a token container, or value to an '
        + 'address, in each case by enforcing the matching transaction output.',
        `${STATEFUL}#token-container-methods`,
      ],
      '.send': [
        'bool recipient.send(bigint amount)',
        'Sends satoshis to an address and reports success instead of failing the script.',
        `${ADVANCED}#external-contract-interaction`,
      ],
      '.transferNft': [
        'this.tokens[category].transferNft(bytes lockingBytecode, bytes commitment)',
        'Sends an NFT from a token container to a recipient locking bytecode.',
        `${STATEFUL}#token-container-methods`,
      ],
      '.call': [
        'target.call(data)\ntarget.call{value: amount}(data)',
        'Low-level call to another contract, co-spending it in the same transaction. Returns a success '
        + 'flag and return data.',
        `${ADVANCED}#external-function-calls`,
      ],
      '.staticcall': [
        'target.staticcall(data)',
        'Low-level call that may not change the target\'s state.',
        `${ADVANCED}#external-function-calls`,
      ],
      '.delegatecall': [
        'implementation.delegatecall(data)',
        'Runs the target\'s logic against this contract\'s state: the proxy pattern. The target is pinned '
        + 'so an attacker cannot substitute code.',
        `${ADVANCED}#delegatecall--proxy-pattern`,
      ],
      '.outState': [
        'IFoo(addr).outState.field',
        'Read-only view of another contract\'s post-execution state: the callee is co-spent and its output '
        + 'commitment decoded, without mutating it.',
        `${IMPORTS}#reading-external-state`,
      ],
      '.code': ['bytes .code', 'Locking bytecode of a contract address.', `${ADVANCED}#external-contract-interaction`],
      '.codehash': [
        'bytes32 .codehash',
        'Hash of the locking bytecode at a contract address.',
        `${ADVANCED}#external-contract-interaction`,
      ],
      '.address': [
        'address .address',
        'Address a function pointer or contract handle refers to.',
        `${ADVANCED}#external-function-calls`,
      ],
      '.wrap': [
        'type Price is int256;\nPrice.wrap(int256 value)',
        'Converts an underlying value into a user-defined value type.',
        `${STRUCTS}#wrapping--unwrapping`,
      ],
      '.unwrap': [
        'Price.unwrap(Price value)',
        'Converts a user-defined value type back to its underlying type.',
        `${STRUCTS}#wrapping--unwrapping`,
      ],
      '.selector': [
        'bytes4 f.selector\nbytes32 E.selector',
        'The 4-byte selector of a function, or for an event the 32-byte SHA-256 of its signature. Function '
        + 'selectors are sha256-derived by default, so they do not match Ethereum unless the contract is '
        + 'compiled with `evmCompat`.',
        `${ADVANCED}#abi-encoding--decoding`,
      ],
      '.interfaceId': [
        'bytes4 type(IToken).interfaceId',
        'EIP-165 style identifier of an interface.',
        `${INHERITANCE}#interface-id-eip-165-style`,
      ],
      '.creationCode': [
        'bytes type(C).creationCode',
        'Deployment bytecode of a contract type.',
        `${STRUCTS}#type-introspection-summary`,
      ],
      '.runtimeCode': [
        'bytes type(C).runtimeCode',
        'Runtime bytecode of a contract type.',
        `${STRUCTS}#type-introspection-summary`,
      ],
      '.slot': [
        'x.slot',
        'Assembly accessor for a state variable\'s virtual slot, used with `sload` and `sstore`.',
        `${ASSEMBLY}#storage-model`,
      ],
      '.offset': [
        'x.offset',
        'Assembly accessor for a calldata or storage offset, alongside `.slot` and `.length`.',
        `${ASSEMBLY}#storage-model`,
      ],
      '.entries': [
        'this.balances.entries',
        'Key-value view of an `enumerable` mapping, iterated with a two-variable `for ... of`.',
        `${STATEFUL}#mapping-iteration`,
      ],
    },
  },
  {
    kind: 'unit',
    link: `${GLOBALS}#globally-available-units`,
    items: {
      satoshis: ['1 satoshis == 1', 'Value suffix: the base Bitcoin Cash unit, one satoshi.', `${GLOBALS}#bch-units`],
      sats: ['1 sats == 1', 'Value suffix: the base Bitcoin Cash unit, one satoshi.', `${GLOBALS}#bch-units`],
      finney: ['1 finney == 10 sats', 'Value suffix multiplying the literal by 10 satoshis.', `${GLOBALS}#bch-units`],
      bits: ['1 bits == 100 sats', 'Value suffix multiplying the literal by 100 satoshis.', `${GLOBALS}#bch-units`],
      bitcoin: ['1 bitcoin == 1e8 sats', 'Value suffix for one whole BCH, 100,000,000 satoshis.', `${GLOBALS}#bch-units`],
      wei: [
        '1 wei == 1',
        'Accepted for Solidity parity. Nominal on Bitcoin Cash, which has no ETH denominations.',
        `${GLOBALS}#ethereum-units`,
      ],
      gwei: [
        '1 gwei == 1e9',
        'Accepted for Solidity parity. Nominal on Bitcoin Cash, which has no ETH denominations.',
        `${GLOBALS}#ethereum-units`,
      ],
      ether: [
        '1 ether == 1e18',
        'Accepted for Solidity parity. Nominal on Bitcoin Cash, which has no ETH denominations.',
        `${GLOBALS}#ethereum-units`,
      ],
      seconds: ['1 seconds == 1', 'Time suffix: the base unit for time locks, one second.', `${GLOBALS}#time-units`],
      minutes: ['1 minutes == 60 seconds', 'Time suffix multiplying the literal by 60 seconds.', `${GLOBALS}#time-units`],
      hours: ['1 hours == 60 minutes', 'Time suffix multiplying the literal by 3,600 seconds.', `${GLOBALS}#time-units`],
      days: ['1 days == 24 hours', 'Time suffix multiplying the literal by 86,400 seconds.', `${GLOBALS}#time-units`],
      weeks: ['1 weeks == 7 days', 'Time suffix multiplying the literal by 604,800 seconds.', `${GLOBALS}#time-units`],
    },
  },
];

// Bitcoin Cash script opcodes, usable inside `assembly { ... }` blocks.
const OPCODE_DOCS = {
  OP_0: 'Pushes an empty byte string (numeric zero / false).',
  OP_FALSE: 'Alias of OP_0: pushes an empty byte string.',
  OP_1NEGATE: 'Pushes the number -1.',
  OP_TRUE: 'Alias of OP_1: pushes the number 1.',
  OP_PUSHDATA_1: 'Pushes the next 1-byte-length-prefixed data.',
  OP_PUSHDATA_2: 'Pushes the next 2-byte-length-prefixed data.',
  OP_PUSHDATA_4: 'Pushes the next 4-byte-length-prefixed data.',
  OP_NOP: 'Does nothing.',
  OP_IF: 'Pops a value; runs the following block when it is true.',
  OP_NOTIF: 'Pops a value; runs the following block when it is false.',
  OP_ELSE: 'Alternative branch of the enclosing OP_IF / OP_NOTIF.',
  OP_ENDIF: 'Ends an OP_IF / OP_NOTIF block.',
  OP_VERIFY: 'Pops a value and fails the script unless it is true.',
  OP_RETURN: 'Fails the script. As the first byte of an output it marks provably unspendable data.',
  OP_TOALTSTACK: 'Moves the top item to the alt stack.',
  OP_FROMALTSTACK: 'Moves the top alt-stack item back to the stack.',
  OP_2DROP: 'Drops the top two items.',
  OP_2DUP: 'Duplicates the top two items.',
  OP_3DUP: 'Duplicates the top three items.',
  OP_2OVER: 'Copies the third and fourth items to the top.',
  OP_2ROT: 'Rotates the fifth and sixth items to the top.',
  OP_2SWAP: 'Swaps the top two pairs of items.',
  OP_IFDUP: 'Duplicates the top item when it is true.',
  OP_DEPTH: 'Pushes the current stack size.',
  OP_DROP: 'Drops the top item.',
  OP_DUP: 'Duplicates the top item.',
  OP_NIP: 'Drops the second item.',
  OP_OVER: 'Copies the second item to the top.',
  OP_PICK: 'Pops n, then copies the item n back to the top.',
  OP_ROLL: 'Pops n, then moves the item n back to the top.',
  OP_ROT: 'Rotates the top three items left.',
  OP_SWAP: 'Swaps the top two items.',
  OP_TUCK: 'Copies the top item behind the second item.',
  OP_CAT: 'Concatenates the top two byte strings.',
  OP_SPLIT: 'Pops an index and splits the byte string below it in two.',
  OP_NUM2BIN: 'Encodes a number as a byte string of a given length.',
  OP_BIN2NUM: 'Decodes a byte string into a minimally encoded number.',
  OP_SIZE: 'Pushes the length in bytes of the top item, keeping the item.',
  OP_INVERT: 'Disabled opcode: bitwise NOT.',
  OP_AND: 'Bitwise AND of two equal-length byte strings.',
  OP_OR: 'Bitwise OR of two equal-length byte strings.',
  OP_XOR: 'Bitwise XOR of two equal-length byte strings.',
  OP_EQUAL: 'Pushes true when the top two items are byte-identical.',
  OP_EQUALVERIFY: 'OP_EQUAL followed by OP_VERIFY.',
  OP_1ADD: 'Adds one to the top number.',
  OP_1SUB: 'Subtracts one from the top number.',
  OP_2MUL: 'Disabled opcode: multiply by two.',
  OP_2DIV: 'Disabled opcode: divide by two.',
  OP_NEGATE: 'Flips the sign of the top number.',
  OP_ABS: 'Absolute value of the top number.',
  OP_NOT: 'Pushes true when the top number is zero.',
  OP_0NOTEQUAL: 'Pushes true when the top number is not zero.',
  OP_ADD: 'Adds the top two numbers.',
  OP_SUB: 'Subtracts the top number from the second.',
  OP_MUL: 'Multiplies the top two numbers.',
  OP_DIV: 'Divides the second number by the top; fails on zero.',
  OP_MOD: 'Remainder of the second number divided by the top; fails on zero.',
  OP_POW: 'Raises the second number to the power of the top.',
  OP_LSHIFT: 'Disabled opcode: shift left.',
  OP_RSHIFT: 'Disabled opcode: shift right.',
  OP_LSHIFTNUM: 'Shifts a number left by n bits.',
  OP_RSHIFTNUM: 'Shifts a number right by n bits.',
  OP_LSHIFTBIN: 'Shifts a byte string left by n bits.',
  OP_RSHIFTBIN: 'Shifts a byte string right by n bits.',
  OP_BOOLAND: 'Pushes true when both numbers are non-zero.',
  OP_BOOLOR: 'Pushes true when either number is non-zero.',
  OP_NUMEQUAL: 'Pushes true when the two numbers are equal.',
  OP_NUMEQUALVERIFY: 'OP_NUMEQUAL followed by OP_VERIFY.',
  OP_NUMNOTEQUAL: 'Pushes true when the two numbers differ.',
  OP_LESSTHAN: 'Pushes true when the second number is less than the top.',
  OP_GREATERTHAN: 'Pushes true when the second number is greater than the top.',
  OP_LESSTHANOREQUAL: 'Pushes true when the second number is less than or equal to the top.',
  OP_GREATERTHANOREQUAL: 'Pushes true when the second number is greater than or equal to the top.',
  OP_MIN: 'Pushes the smaller of the top two numbers.',
  OP_MAX: 'Pushes the larger of the top two numbers.',
  OP_WITHIN: 'Pushes true when x is within [lower, upper).',
  OP_RIPEMD160: 'RIPEMD-160 hash of the top item.',
  OP_SHA1: 'SHA-1 hash of the top item.',
  OP_SHA256: 'SHA-256 hash of the top item.',
  OP_HASH160: 'RIPEMD-160 of the SHA-256 of the top item.',
  OP_HASH256: 'Double SHA-256 of the top item.',
  OP_CODESEPARATOR: 'Marks the start of the signed portion of the script.',
  OP_CHECKSIG: 'Verifies a transaction signature against a public key.',
  OP_CHECKSIGVERIFY: 'OP_CHECKSIG followed by OP_VERIFY.',
  OP_CHECKMULTISIG: 'Verifies m-of-n transaction signatures.',
  OP_CHECKMULTISIGVERIFY: 'OP_CHECKMULTISIG followed by OP_VERIFY.',
  OP_CHECKDATASIG: 'Verifies a signature over an arbitrary message.',
  OP_CHECKDATASIGVERIFY: 'OP_CHECKDATASIG followed by OP_VERIFY.',
  OP_CHECKLOCKTIMEVERIFY: 'Fails unless the transaction nLocktime is at least the top number.',
  OP_CHECKSEQUENCEVERIFY: 'Fails unless the input nSequence satisfies the top number.',
  OP_REVERSEBYTES: 'Reverses the byte order of the top item.',
  OP_INPUTINDEX: 'Pushes the index of the input being evaluated.',
  OP_ACTIVEBYTECODE: 'Pushes the bytecode of the input being evaluated.',
  OP_TXVERSION: 'Pushes the transaction version.',
  OP_TXINPUTCOUNT: 'Pushes the number of inputs.',
  OP_TXOUTPUTCOUNT: 'Pushes the number of outputs.',
  OP_TXLOCKTIME: 'Pushes the transaction nLocktime.',
  OP_UTXOVALUE: 'Pushes the satoshi value of the input at index n.',
  OP_UTXOBYTECODE: 'Pushes the locking bytecode of the input at index n.',
  OP_OUTPOINTTXHASH: 'Pushes the outpoint transaction hash of the input at index n.',
  OP_OUTPOINTINDEX: 'Pushes the outpoint index of the input at index n.',
  OP_INPUTBYTECODE: 'Pushes the unlocking bytecode of the input at index n.',
  OP_INPUTSEQUENCENUMBER: 'Pushes the nSequence of the input at index n.',
  OP_OUTPUTVALUE: 'Pushes the satoshi value of the output at index n.',
  OP_OUTPUTBYTECODE: 'Pushes the locking bytecode of the output at index n.',
  OP_UTXOTOKENCATEGORY: 'Pushes the token category of the input at index n.',
  OP_UTXOTOKENCOMMITMENT: 'Pushes the NFT commitment of the input at index n.',
  OP_UTXOTOKENAMOUNT: 'Pushes the fungible token amount of the input at index n.',
  OP_OUTPUTTOKENCATEGORY: 'Pushes the token category of the output at index n.',
  OP_OUTPUTTOKENCOMMITMENT: 'Pushes the NFT commitment of the output at index n.',
  OP_OUTPUTTOKENAMOUNT: 'Pushes the fungible token amount of the output at index n.',
  OP_BEGIN: 'Starts a loop body (May 2026 upgrade).',
  OP_UNTIL: 'Pops a condition and repeats from OP_BEGIN until it is true (May 2026 upgrade).',
  OP_DEFINE: 'Defines a script subroutine under an identifier (May 2026 upgrade).',
  OP_INVOKE: 'Invokes a subroutine defined with OP_DEFINE (May 2026 upgrade).',
  OP_EVAL: 'Evaluates a byte string as script.',
  OP_VER: 'Reserved opcode: fails the script.',
  OP_VERIF: 'Reserved opcode: fails the script even in an untaken branch.',
  OP_VERNOTIF: 'Reserved opcode: fails the script even in an untaken branch.',
  OP_RESERVED: 'Reserved opcode: fails the script unless in an untaken branch.',
  OP_RESERVED1: 'Reserved opcode: fails the script unless in an untaken branch.',
  OP_RESERVED2: 'Reserved opcode: fails the script unless in an untaken branch.',
};

const OPCODE_LINK = 'https://documentation.cash/protocol/blockchain/script';

const ENTRIES = new Map();
for (const group of GROUPS) {
  for (const [name, item] of Object.entries(group.items)) {
    ENTRIES.set(name, {
      name,
      kind: group.kind,
      signature: item[0],
      doc: item[1],
      link: item[2] || group.link,
    });
  }
}
for (const [name, doc] of Object.entries(OPCODE_DOCS)) {
  ENTRIES.set(name, { name, kind: 'opcode', signature: name, doc, link: OPCODE_LINK });
}
for (let n = 1; n <= 16; n += 1) {
  ENTRIES.set(`OP_${n}`, {
    name: `OP_${n}`,
    kind: 'opcode',
    signature: `OP_${n}`,
    doc: `Pushes the number ${n}.`,
    link: OPCODE_LINK,
  });
}

// The Yul dialect SolidCash lowers, from the supported/unsupported tables in the assembly docs. Keyed with
// an `asm:` prefix so a name that also means something in Solidity (`revert`, `byte`, `address`, `if`) keeps
// its Solidity documentation outside an `assembly { ... }` block, and gets the Yul meaning inside one.
const YUL_BUILTINS = {
  let: ['let x := 1', 'Declares Yul stack locals. Solidity variables in scope are visible by name.'],
  function: ['function f(a, b) -> r { ... }', 'Defines a Yul helper, compiled like an internal function.'],
  add: ['add(x, y)', 'x + y.'],
  sub: ['sub(x, y)', 'x - y.'],
  mul: ['mul(x, y)', 'x * y.'],
  div: ['div(x, y)', 'x / y, unsigned.'],
  sdiv: ['sdiv(x, y)', 'x / y, signed.'],
  mod: ['mod(x, y)', 'x % y, unsigned.'],
  smod: ['smod(x, y)', 'x % y, signed.'],
  exp: ['exp(x, y)', 'x raised to the power y.'],
  addmod: ['addmod(x, y, m)', '(x + y) % m without intermediate overflow.'],
  mulmod: ['mulmod(x, y, m)', '(x * y) % m without intermediate overflow.'],
  and: ['and(x, y)', 'Bitwise AND.'],
  or: ['or(x, y)', 'Bitwise OR.'],
  xor: ['xor(x, y)', 'Bitwise XOR.'],
  not: ['not(x)', 'Bitwise NOT.'],
  shl: ['shl(n, x)', 'Shift left: x * 2^n.'],
  shr: ['shr(n, x)', 'Shift right: x / 2^n.'],
  sar: ['sar(n, x)', 'Arithmetic (sign-preserving) shift right.'],
  lt: ['lt(x, y)', 'x < y, unsigned.'],
  gt: ['gt(x, y)', 'x > y, unsigned.'],
  slt: ['slt(x, y)', 'x < y, signed.'],
  sgt: ['sgt(x, y)', 'x > y, signed.'],
  eq: ['eq(x, y)', 'x == y.'],
  iszero: ['iszero(x)', 'True when x is zero. Lowers to OP_NOT.'],
  mstore: ['mstore(p, v)', 'Writes a word at offset p of the `__yulmem` buffer.'],
  mstore8: ['mstore8(p, v)', 'Writes one byte at offset p of the `__yulmem` buffer.'],
  mload: ['mload(p)', 'Reads a word at offset p of the `__yulmem` buffer.'],
  keccak256: ['keccak256(p, l)', 'Keccak-256 over l bytes of memory at p.'],
  return: ['return(p, l)', 'Returns l bytes of memory at p from the current call.'],
  revert: ['revert(p, l)', 'Aborts, returning l bytes of memory at p as the error data.'],
  sstore: ['sstore(slot, v)', 'Writes a state variable through the virtual-slot table (value types).'],
  sload: ['sload(slot)', 'Reads a state variable through the virtual-slot table (value types).'],
  tstore: ['tstore(slot, v)', 'Transient write. Lowered to a function-scoped local, zero-initialised per spend.'],
  tload: ['tload(slot)', 'Transient read. Lowered to a function-scoped local, zero-initialised per spend.'],
  caller: ['caller()', 'The calling contract, i.e. `msg.sender`.'],
  callvalue: ['callvalue()', 'Satoshis sent with the call, i.e. `msg.value`.'],
  origin: ['origin()', 'The originating wallet, i.e. `tx.origin`.'],
  chainid: ['chainid()', 'The network identifier, i.e. `block.chainid`.'],
  number: ['number()', 'Block height, i.e. `block.number` (oracle-backed).'],
  timestamp: ['timestamp()', 'Block time, i.e. `block.timestamp` (oracle-backed).'],
  coinbase: ['coinbase()', 'Coinbase locking bytecode, i.e. `block.coinbase`.'],
  difficulty: ['difficulty()', 'Raw nBits, i.e. `block.difficulty`.'],
  prevrandao: ['prevrandao()', 'Transaction-local shim, i.e. `block.prevrandao`. Not secure randomness.'],
  gas: ['gas()', 'Fixed shim returning 1000000. Bitcoin Cash has no gas metering; the compiler warns.'],
  gasprice: ['gasprice()', 'Realized fee rate in sat/KB, i.e. `tx.gasprice`.'],
  gaslimit: ['gaslimit()', 'Fixed shim returning 1000000, i.e. `block.gaslimit`. The compiler warns.'],
  basefee: ['basefee()', 'Block fee rate in sat/KB, i.e. `block.basefee`.'],
  blobbasefee: ['blobbasefee()', 'Aliases `basefee()`: Bitcoin Cash has no EIP-4844 blobs.'],
  balance: ['balance(addr)', 'Satoshi balance of an address.'],
  selfbalance: ['selfbalance()', 'Satoshi balance of this contract.'],
  extcodesize: ['extcodesize(addr)', 'Byte length of the locking bytecode at addr.'],
  extcodehash: ['extcodehash(addr)', 'Hash of the locking bytecode at addr.'],
  codesize: ['codesize()', 'Byte length of this contract, i.e. `this.activeBytecode.length`.'],
  address: ['address()', 'This contract\'s address.'],
  calldataload: ['calldataload(p)', 'Reads a word of call data, synthesized from the selector plus ABI arguments.'],
  calldatasize: ['calldatasize()', 'Byte length of the call data.'],
  calldatacopy: ['calldatacopy(dst, p, l)', 'Copies l bytes of call data into memory at dst.'],
  returndatasize: ['returndatasize()', 'Byte length of the last low-level call\'s return data.'],
  returndatacopy: ['returndatacopy(dst, p, l)', 'Copies the last call\'s return data into memory at dst.'],
  blockhash: ['blockhash(n)', 'Hash of block n, read from the block oracle.'],
  log0: ['log0(p, l)', 'Emits an event with no topics; routed to event emission.'],
  log1: ['log1(p, l, t1)', 'Emits an event with one topic; routed to event emission.'],
  log2: ['log2(p, l, t1, t2)', 'Emits an event with two topics; routed to event emission.'],
  log3: ['log3(p, l, t1, t2, t3)', 'Emits an event with three topics; routed to event emission.'],
  log4: ['log4(p, l, t1, t2, t3, t4)', 'Emits an event with four topics; routed to event emission.'],
  call: ['call(g, addr, v, inP, inL, outP, outL)', 'Low-level call, routed to the call codegen.'],
  staticcall: ['staticcall(g, addr, inP, inL, outP, outL)', 'Low-level call that may not mutate the target.'],
  delegatecall: ['delegatecall(g, addr, inP, inL, outP, outL)', 'Runs the target\'s code against this state.'],
  selfdestruct: ['selfdestruct(addr)', 'Destroys the contract, forwarding its balance to addr.'],
};

// Rejected with an explicit diagnostic naming the builtin.
const YUL_UNSUPPORTED = {
  create: ['create(v, p, l)', 'Not supported: deploys runtime bytecode. Use the high-level `new Contract(...)`.'],
  create2: ['create2(v, p, l, salt)', 'Not supported: deploys runtime bytecode. Use `new Contract{salt: s}(...)`.'],
  pc: ['pc()', 'Not supported: the EVM program counter has no Bitcoin Cash analogue.'],
  datasize: ['datasize(name)', 'Not supported: an EVM bytecode-object builtin.'],
  dataoffset: ['dataoffset(name)', 'Not supported: an EVM bytecode-object builtin.'],
  datacopy: ['datacopy(dst, p, l)', 'Not supported: an EVM bytecode-object builtin.'],
  linkersymbol: ['linkersymbol(name)', 'Not supported: an EVM bytecode-object builtin.'],
  leave: ['leave', 'Not supported yet: early return from a Yul function.'],
  byte: ['byte(n, x)', 'Parses, but yields `bytes1`, which cannot be assigned to a Yul word variable.'],
};

for (const [name, item] of Object.entries(YUL_BUILTINS)) {
  ENTRIES.set(`asm:${name}`, {
    name,
    kind: 'assembly builtin',
    signature: item[0],
    doc: item[1],
    link: `${ASSEMBLY}#supported-builtins`,
  });
}
for (const [name, item] of Object.entries(YUL_UNSUPPORTED)) {
  ENTRIES.set(`asm:${name}`, {
    name,
    kind: 'unsupported in assembly',
    signature: item[0],
    doc: item[1],
    link: `${ASSEMBLY}#not-supported`,
  });
}

const INT_TYPE = /^(u?int)(\d+)$/;
const BYTES_TYPE = /^bytes(\d+)$/;
const FIXED_TYPE = /^(u?fixed)(\d+)x(\d+)$/;
const UNSAFE_BYTES = /^unsafe_bytes(\d+)$/;
const PUSHBYTES = /^OP_PUSHBYTES_(\d+)$/;

// Types whose name carries a width are generated on demand instead of being enumerated.
function parametric(word) {
  let match = INT_TYPE.exec(word);
  if (match) {
    const bits = Number(match[2]);
    if (bits % 8 !== 0 || bits < 8 || bits > 256) return undefined;
    const signed = match[1] === 'int';
    // Exact bounds stay readable up to 32 bits; wider widths are shown as powers of two.
    const exact = bits <= 32;
    const power = (exponent) => (exact ? (2n ** BigInt(exponent)).toString() : `2^${exponent}`);
    const range = signed
      ? `-${power(bits - 1)} to ${exact ? (2n ** BigInt(bits - 1) - 1n).toString() : `2^${bits - 1} - 1`}`
      : `0 to ${exact ? (2n ** BigInt(bits) - 1n).toString() : `2^${bits} - 1`}`;
    return {
      name: word,
      kind: 'type',
      signature: `${word}   // ${range}`,
      doc: `${signed ? 'Signed' : 'Unsigned'} ${bits}-bit integer, range ${range}. The bound is checked `
        + 'whenever a value lands in a bounded slot (cast, assignment, array write), not per intermediate, '
        + `and a violation fails the script; \`unchecked { }\` wraps instead. Fixed-width on chain `
        + `(${bits / 8 + 1} bytes: one more than the EVM, since BCH numbers are sign-magnitude), which is `
        + 'what makes arrays of them O(1)-indexable.',
      link: `${STRUCTS}#bounded-integer-types`,
    };
  }
  match = BYTES_TYPE.exec(word);
  if (match) {
    const size = Number(match[1]);
    if (size < 1 || size > 32) return undefined;
    return {
      name: word,
      kind: 'type',
      signature: word,
      doc: `Byte string of exactly ${size} byte${size === 1 ? '' : 's'}. Casting from a different length `
        + 'is checked at runtime.',
      link: `${TYPES}#bytes`,
    };
  }
  match = FIXED_TYPE.exec(word);
  if (match) {
    return {
      name: word,
      kind: 'type',
      signature: word,
      doc: `${match[1] === 'fixed' ? 'Signed' : 'Unsigned'} fixed-point decimal with ${match[2]} bits of `
        + `width and ${match[3]} decimal digits.`,
      link: `${STRUCTS}#fixed-point-decimal-types`,
    };
  }
  match = UNSAFE_BYTES.exec(word);
  if (match) {
    return {
      name: word,
      kind: 'builtin function',
      signature: `${word}(x)`,
      doc: `Reinterprets \`x\` as \`bytes${match[1]}\` with no length check.`,
      link: `${TYPES}#other-semantic-casting`,
    };
  }
  match = PUSHBYTES.exec(word);
  if (match) {
    return {
      name: word,
      kind: 'opcode',
      signature: word,
      doc: `Pushes the next ${match[1]} bytes onto the stack.`,
      link: OPCODE_LINK,
    };
  }
  return undefined;
}

/** Looks up documentation for an exact source token. */
function lookup(word) {
  if (!word) return undefined;
  return ENTRIES.get(word) || parametric(word);
}

/** Looks up the first token in `candidates` that has documentation. */
function lookupFirst(candidates) {
  for (const candidate of candidates) {
    const entry = lookup(candidate);
    if (entry) return entry;
  }
  return undefined;
}

module.exports = { ENTRIES, lookup, lookupFirst };
