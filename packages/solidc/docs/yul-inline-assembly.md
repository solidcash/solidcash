# Inline assembly (Yul) support

Status: PROPOSAL / tracking doc. No codegen shipped yet.

Solidity inline `assembly { ... }` blocks are written in Yul. Porting real Solidity (and the
solidity-by-example bench) keeps hitting Yul: 23 of the bench `.sol` files use `assembly`, and today every
one of them fails at parse on the Yul `:=` token (the opaque `:` ParseError cluster). This doc tracks which
Yul we can map onto Bitcoin Cash script, which is fundamentally EVM-only, and the plan to support the
mappable subset.

There are three buckets, not two. **Value computation** (arithmetic / bitwise / control-flow) maps directly
to BCH script. **Machine-resource ops that solidcash already exposes at the high level** - the context
surface (`msg.*`/`block.*`/`tx.*`), external calls, events, contract deploy, `selfdestruct`, `.balance`,
`.code.length`, plus modelled memory / storage / transient - ROUTE onto that existing codegen. Only a small
residual (raw EVM bytecode, growable dynamic memory, opaque-bytecode proxies) is genuinely absent on BCH and
gets rejected. An earlier draft of this doc over-counted the rejected bucket; most of the EVM opcode set
routes.

## Supported-subset boundary

| Yul family | Builtins | Status | BCH mapping |
|---|---|---|---|
| Variables | `let`, `:=`, identifier read/write | IN | stack locals; Solidity vars by name; all values are 256-bit words |
| Arithmetic | `add sub mul div sdiv mod smod exp addmod mulmod` | IN | `OP_ADD/SUB/MUL/DIV/MOD`, existing `addmod/mulmod` |
| Bitwise | `and or xor not shl shr sar byte` | IN | integer-bitwise codegen; `shl(n,x)=x*2^n`, `shr(n,x)=x/2^n` |
| Comparison | `lt gt slt sgt eq iszero` | IN | `OP_LESSTHAN/GREATERTHAN/NUMEQUAL`, `iszero=OP_NOT` |
| Control flow | `if`, `for`, `switch/case/default`, `leave`, `break`, `continue` | IN | `OP_IF`; `for`->existing loop codegen; `switch`->nested `OP_IF` |
| Abort | `revert(0, 0)`, `return(p, 0)` | IN | unconditional fail / function exit |
| Memory | `mstore mload mstore8 keccak256(p,l) return(p,l) revert(p,l)` | IN (constant-region only) | compile-time word-addressed buffer; see "Memory model" |
| Storage | `sstore sload`, `.slot`, `.offset` | IN (value-type slots) | virtual-slot table over state vars; see "Storage model" |
| Transient | `tstore tload` | IN (constant key) | zero-init function-scoped local, no UTXO; see "Transient model" |
| Context | `caller callvalue origin gasprice chainid number timestamp gaslimit difficulty prevrandao coinbase basefee blobbasefee gas` | ROUTE | existing NullaryOperator / shims; see "Routing" |
| Crypto / math | `keccak256(hash) addmod mulmod` | ROUTE | existing GlobalFunction codegen |
| Balance / code | `balance selfbalance extcodesize extcodehash` | ROUTE | `addr.balance`, `address(this).balance`, `addr.code.length`, `addr.codehash` |
| Code copy / size | `extcodecopy extcodesize codesize codecopy` | ROUTE | `addr.code` / `this.activeBytecode` (own code) + memory buffer; see "Routing" |
| Calldata | `calldataload calldatasize calldatacopy` | ROUTE | synthesized EVM calldata `msg.sig ++ abi-encoded args`; see "Calldata model" |
| Block hash | `blockhash` | ROUTE | existing `blockhash(n)` oracle |
| Logs | `log0 log1 log2 log3 log4` | ROUTE | `Event` / `emit` |
| Lifecycle | `selfdestruct` | ROUTE | existing `selfdestruct(addr)` statement |
| External call | `call delegatecall staticcall` | OUT (Yul form) | corpus uses only opaque-calldata forwarding to an opaque target; the typed call is the high-level `IContract(addr).method(...)`, not Yul (Phase 6) |
| Return data | `returndatasize returndatacopy` | OUT | only used by the opaque-proxy forward |
| Contract create | `create create2` | OUT | deploys runtime/opaque bytecode; typed deploy is the high-level `new Contract(...)`, not Yul (Phase 6) |
| Immutables | `setimmutable loadimmutable` | ROUTE (deferred) | solidcash immutables; rare (compiler-generated) |
| Genuinely out | `verbatim pc datasize dataoffset datacopy linkersymbol` + free-pointer memory + opaque-bytecode proxy | OUT | no analogue; see "Genuinely out" |

ROUTE = re-spell the Yul op onto the *existing* solidcash codegen for that primitive, so behaviour and
soundness are inherited from the high-level path (it is just another surface syntax). OUT ops get a clear
diagnostic (`inline-assembly 'verbatim' has no BCH equivalent`) instead of the opaque parse error.

### Framing: Yul builtins are the EVM instruction set

Confirmed against solc (`libyul/backends/evm/EVMDialect.cpp:136`, `for (auto const& instr: evmasm::c_instructions)`):
the Yul builtin set is generated directly from the EVM instruction set, plus a small set of object/linking
builtins. So the boundary above is a partition of the EVM opcodes into three buckets, not two:

1. Compute on a value -> direct BCH codegen (arithmetic / bitwise / comparison / control-flow / let).
2. Touch a machine resource solidcash already exposes -> ROUTE to the existing primitive. This is the large
   bucket and the reason most of the "EVM-only" verdict was wrong: solidcash already implements the context
   surface, external calls, events, deploy, selfdestruct, balance, and code-size. Re-spelling the Yul op
   onto that codegen reuses a tested, sound path.
3. Touch a resource with genuinely no BCH analogue -> reject with a clear diagnostic (small residual set).

Yul allows local function definitions (`function f(a, b) -> r { ... }`, AST `FunctionDefinition`). Rare in
the bench but common in real libs; treat like a solidcash internal function (inline or subroutine). Deferred.

## Routing to existing solidcash primitives

Every row here re-spells a Yul builtin onto codegen that already exists, so semantics and soundness are
inherited. Anchors are where the high-level primitive is defined today.

| Yul builtin | solidcash primitive | Anchor |
|---|---|---|
| `caller()` | `msg.sender` | `ast/Operator.ts` NullaryOperator.MSG_SENDER |
| `callvalue()` | `msg.value` | NullaryOperator.MSG_VALUE |
| `origin()` | `tx.origin` | NullaryOperator.TX_ORIGIN |
| `gasprice()` | `tx.gasprice` | NullaryOperator.TX_GASPRICE |
| `chainid()` | `block.chainid` | NullaryOperator.CHAIN_ID |
| `number()` | `block.number` | NullaryOperator.BLOCK_NUMBER |
| `timestamp()` | `block.timestamp` | NullaryOperator.BLOCK_TIMESTAMP |
| `gaslimit()` | `block.gaslimit` | NullaryOperator.BLOCK_GASLIMIT |
| `difficulty()` / `prevrandao()` | `block.prevrandao` | NullaryOperator.BLOCK_PREVRANDAO |
| `coinbase()` | `block.coinbase` | NullaryOperator.BLOCK_COINBASE |
| `basefee()` / `blobbasefee()` | `block.basefee` / `block.blobbasefee` | NullaryOperator.BLOCK_BASEFEE / BLOCK_BLOBBASEFEE |
| `gas()` | gasleft shim | `semantic/SynthesizeBlockOracle.ts` |
| `keccak256(p,l)` | `keccak256(...)` | `ast/Globals.ts` GlobalFunction.KECCAK256 (+ memory model for the region) |
| `addmod` / `mulmod` | `addmod` / `mulmod` | GlobalFunction.ADDMOD / MULMOD |
| `blockhash(n)` | `blockhash(n)` | GlobalFunction.BLOCKHASH |
| `balance(a)` / `selfbalance()` | `a.balance` / `address(this).balance` | `generation/GenerateTargetTraversal.ts` `'balance'` |
| `extcodesize(a)` | `a.code.length` | GTT `'code'` (`.code` = the redeem script) |
| `extcodehash(a)` | `a.codehash` | GTT `'codehash'` (BCH script-hash, not EVM keccak-of-code - see note) |
| `extcodecopy(a, dst, off, len)` | `a.code` into the memory buffer | GTT `'code'` + memory model |
| `codesize()` / `codecopy(...)` | `this.activeBytecode` (own redeem script) + memory buffer | `ast/Operator.ts` NullaryOperator.BYTECODE |
| `calldataload(p)` / `calldatasize()` / `calldatacopy(...)` | slice/length of synthesized EVM calldata | `msg.sig` + `abi.encode`; see "Calldata model" |
| `log0`..`log4` | `emit Event(...)` | `ast/AST.ts` `class Event` |
| `selfdestruct(a)` | `selfdestruct(a)` statement | GTT selfdestruct |
| `call` / `staticcall` | `IContract(addr).method(args)` | `ast/AST.ts` ExternalCall; needs calldata decode (below) |
| `delegatecall` | `ExternalCall` with delegatecall flag / `library` delegate | ExternalCall.delegatecall |
| `create` / `create2` | `new Contract(...)` deploy | `ast/AST.ts` InstantiationNode (`isStatefulDeploy`) |

Two routes need a decode step, not just a rename:

- `call(gas, addr, value, inOff, inLen, outOff, outLen)` / `staticcall` / `delegatecall`. The in-region is
  EVM calldata = `selector(4) || abi-encoded args`. For a known-ABI target the selector identifies the
  function and the args decode by its signature, so this routes to `ExternalCall` once the memory model can
  read the constant in-region. This is the same insight as the arbitrary-calldata external-call work
  (call-model.md s10) - coordinate with that, do not duplicate.
- `create(value, off, len)` / `create2(value, off, len, salt)`. The off/len region is init bytecode. On BCH
  there is no init-bytecode-at-runtime; what maps is the typed `new Contract(args)` deploy
  (`InstantiationNode`, which already supports stateful deploy + a salt-style path via create3 deployFrom).
  Generic "deploy these raw bytes" (MinimalProxy/Factory/Create2.sol) stays out; typed deploy routes.

## Survey: the 23 bench files

Pure computation (single-wall, unblocked by the value subset alone):

| File | Yul used |
|---|---|
| assembly-variable/AssemblyVariable.sol | `let`, `:=` |
| assembly-math/AssemblyMath.sol | add/mul/div, switch, if, overflow check |
| assembly-loop/AssemblyLoop.sol | `for` loops |
| assembly-if/AssemblyIf.sol | `if`, `switch/case/default` |
| assembly-error/AssemblyError.sol | `if gt(...) { revert(0,0) }` |
| app/assembly-bin-exp/AssemblyBinExp.sol | binary exponentiation (mul/loop) |
| bitwise/MostSignificantBitAssembly.sol | shl/shr/gt/or |
| user-defined-value-types/UserDefinedValueTypes.sol | or/shl/shr bit-packing (UDVT itself already compiles) |

Machine-state, mappable through a solidcash model:

| File | Family | Mappable? |
|---|---|---|
| app/airdrop/Hashes.sol | memory scratch + keccak256 | Yes (constant offsets 0x00/0x20/0x40) |
| evm/storage/EVMStorage.sol | storage slots (single + packed) + pure | Partial: single-var slots yes; packed slots = stretch |
| transient-storage/TransientStorage.sol | tstore/tload + low-level `.call` + fallback | tstore/tload yes; file is multi-wall (`.call`, reentrancy) |
| signature/Signature.sol | `mload(add(sig,32))` bytes split + ecrecover | Harder: bytes-memory layout; ecrecover inert |
| app/.../ECDSA.sol (x3) | same bytes-split pattern | Harder (same) |
| evm/memory/YulMem.sol | general memory + calldatacopy + keccak | No (dynamic/free-pointer memory) |

Routable to an existing primitive (was previously mislabelled fundamental):

| File | Family | Route |
|---|---|---|
| hacks/contract-size/ContractSize.sol | `extcodesize(addr)` | `addr.code.length` - likely a clean single-wall close |
| app/simple-bytecode-contract/Factory.sol, app/create2/Create2.sol | `create` / `create2` | typed `new Contract` deploy if the target is a known contract; raw-init-bytecode form stays out |

Genuinely out (small residual - no BCH analogue):

| File / op | Why |
|---|---|
| app/minimal-proxy/MinimalProxy.sol, app/deploy-any-contract/Proxy.sol | deploy + run *arbitrary raw EVM bytecode* (proxy delegating to an opaque impl) - no EVM bytecode at a BCH address |
| app/upgradeable-proxy/UpgradeableProxy.sol | generic `calldatacopy` + `delegatecall(arbitrary impl)` + `returndatacopy` forward of opaque calldata to an opaque target |
| evm/memory/YulMem.sol | free-memory-pointer / growable dynamic memory (calldatacopy here is fine; the wall is dynamic memory) |
| `verbatim` | raw EVM bytecode injection - opaque EVM opcode bytes spliced into output; no BCH meaning, hard-reject |
| `pc`, `datasize`/`dataoffset`/`datacopy`, `linkersymbol` | EVM program counter / bytecode-object / library-linking; no BCH analogue (and compiler-internal, not hand-written) |

## Memory model (mload / mstore)

EVM memory is a linear byte-addressable array; there is no such thing on a stack machine. But the common
assembly patterns address it at compile-time-constant offsets, so we model it as a **compile-time
word-addressed buffer** rather than runtime memory.

Two tractable sub-cases:

1. Constant absolute offset (scratch space). `mstore(0x00, a)` records word@0x00 = a; `mload(0x00)` reads
   it. `keccak256(0x00, 0x40)` (or `return`/`revert` over a constant region) emits the byte-concatenation
   of the covered words and applies the keccak builtin: `keccak256(a . b)`. This unblocks the OZ
   `_efficientKeccak256` pattern (Hashes.sol).
2. `bytes memory` base + constant offset. `mload(add(sig, 32))` reads the first data word of a `bytes`
   argument (offset 32 skips the EVM length word). Maps to byte-slicing the bytes argument:
   `r = sig[0:32]`, `s = sig[32:64]`, `v = sig[64]`. Requires modelling the EVM length-prefixed bytes
   layout; covers the canonical ECDSA r/s/v split.

Rejected: runtime-computed offsets, free-memory-pointer arithmetic (`mload(0x40)` as an allocator),
growable buffers, `abi.encode` of dynamic data. Clear diagnostic.

## Storage model (sstore / sload)

Assign each state variable a **virtual EVM slot number** in Solidity declaration order, and resolve
`x.slot` / `x.offset` to compile-time constants. `sstore(slot, v)` and `sload(slot)` then route through the
*same* state read/write codegen as the high-level `stateVar = v` / `stateVar`, so encoding stays consistent
and the mapping is sound (it is just an alternate spelling of the existing state access).

- Value-type, one var per slot (`EVMStorageSingleSlot`: `sstore(0,111)` -> `s_x`, `sload(1)` -> `s_y`):
  direct and sound. Both the literal-slot form `sstore(0, v)` and the `.slot` form `sstore(s_x.slot, v)`
  resolve to the same var.
- Packed slot (`EVMStoragePackedSlot`: four vars masked into slot 0): `sload(0)` must return the packed
  32-byte word (concat of the packed vars) and `sstore(0, masked)` must decompose a word back into the
  separate var storages. This is the "offsets inside slots" case - real but a stretch goal; the risk is
  keeping the packing layout identical to what the assembly's hand-written masks assume.
- Mapping / dynamic-array storage (keccak-derived slots `keccak256(key . slot)`): out of scope unless the
  slot-derivation pattern is recognized; reject otherwise.

## Transient model (tstore / tload)

EIP-1153 transient storage is tx-scoped and cleared at the end of the transaction. A BCH contract execution
is a single atomic script run, so transient storage with a constant key maps to a **zero-initialized,
function-execution-scoped local** - no UTXO, no state UTXO, just a stack slot.

- `tstore(constKey, v)` / `tload(constKey)` -> a virtual local keyed by the constant; reads before any
  write yield 0 (matching EVM's zero default).
- The reentrancy-guard pattern (`if tload(SLOT) { revert } tstore(SLOT, 1); _; tstore(SLOT, 0)`) compiles
  but is *inert*: BCH has no EVM-style reentrancy (an external call is a co-spent UTXO, not a nested
  re-entry into the same script), so the guard never trips. Compile parity, inert semantics - same posture
  as ERC20Permit's EIP-712 path.
- Non-constant keys: reject in v1.

## Calldata model (calldataload / calldatasize / calldatacopy)

EVM calldata is `selector(4 bytes) || abi-encoded args`. solidcash already exposes the pieces - `msg.sig`
(the 4-byte selector), `msg.data`, and `abi.encode` - so we synthesize the EVM-calldata view of the current
call and read from it. Note this is a *synthesized* view: solidcash's own `msg.data` is the BCH unlocking
layout (length-prefixed pushes), not 32-byte-aligned EVM words, so we do not slice `msg.data` directly; we
build `calldata = msg.sig ++ abi.encode(param0, param1, ...)` from the known function signature.

- `calldataload(p)` -> the 32-byte word of `calldata` at byte offset `p`, zero-padded past the end (EVM
  semantics). For the dominant constant-aligned case `calldataload(4 + 32*k)` this is just `param k`
  ABI-encoded to `bytes32` - a direct map to the k-th parameter. `calldataload(0)` is the selector in the
  top 4 bytes followed by the first 28 bytes of `param0`. General/unaligned/dynamic `p` slices the built
  `calldata` buffer.
- `calldatasize()` -> `4 + 32 * <static-arg-count>`, a compile-time constant from the signature.
- `calldatacopy(dst, off, len)` -> write the `calldata[off:off+len]` slice into the memory buffer (memory
  model), same shape as `extcodecopy`.

Routable, not fundamental. The only hard residual nearby is forwarding *opaque* calldata to an *opaque*
delegatecall target (UpgradeableProxy) - that wall is the opaque-bytecode impl, not the calldata ops.

DONE (Phase 2): `calldataload(4 + 32*k)` with a constant aligned offset lowers to the k-th `int`/`uint`
parameter, and `calldatasize()` lowers to `4 + 32 * paramCount`. Verified on the VM (solidcash e2e). The
selector word (offset 0), non-aligned/dynamic offsets, non-int params, and `calldatacopy` are deferred
(left to the inline-assembly diagnostic).

## Phased implementation plan

- [x] Phase 1 - front-end + diagnostics. DONE. Yul sub-grammar in `SolidCash.g4` (replaces the old
      BCH-ASM-only `assemblyToken` stub) + ANTLR regen. Standalone Yul AST (`ast/YulAST.ts`, mirrors solc
      `libyul/AST.h`) built by `ast/YulAstBuilder.ts`, hung off `AssemblyStatementNode.yulBlock` so the main
      visitor system still treats assembly as an opaque leaf. Disambiguation: a block of only bare
      paths/literals (`OP_*`) stays native BCH-ASM (existing `asmToScript` path, unchanged); any structural
      Yul (`let`/`:=`/call/control-flow) is Yul. Diagnostic (`semantic/InlineAssemblyDiagnostics.ts`, called
      from GTT `visitAssemblyStatement`) throws `UnsupportedInlineAssemblyError`: OUT builtins ->
      "no BCH equivalent"; `verbatim` -> hard reject; Yul function defs -> not-yet-supported; otherwise
      "Yul code generation is not yet implemented". Codegen-time diagnosis (not an early pass) is deliberate:
      it rejects executable assembly while letting declaration-only libraries / non-main contracts compile,
      matching solc. Grammar gotcha fixed: `byte` is the `BoundedBytes` lexer token, so `yulFunctionName`
      references that token rather than minting a rival `'byte'` literal (which had hijacked the `byte` type).
      Result: bench 98 -> 102 (Hashes declaration-library + Create2/ContractSize multi-contract files now
      parse), 1443 compiler tests green (test/InlineAssemblyYul.test.ts + UnsupportedInlineAssemblyError
      fixtures). No more opaque `:` ParseError on any of the 23 assembly files.
- [x] Phase 2 - value-computation codegen. DONE (value + control flow). Implemented as a pre-semantic
      lowering pass (`semantic/LowerInlineAssembly.ts`) that desugars supported Yul into the main AST and
      reuses the tested codegen (stack model, control flow, type checking) - far lower risk than hand-writing
      Yul stack bookkeeping. Yul words are typed `uint256` (bounded `IntType`, so integer bitwise works);
      `shl`/`shr` lower to `*`/`÷` by `2^n` (the `<<`/`>>` operators require bigint/bytes, which would break
      bitwise on the same value); comparisons lower to `uint256(boolExpr)` (a 0/1 word usable in bitwise and
      arithmetic, where a ternary would type as unbounded `int` and be rejected); `for` -> `{ init; while }`
      with `forLoopUpdateCount`; `switch` -> re-evaluated if/else-if chain (no typed temp, so it does not
      clash with signed operands); `revert(0,0)` -> `require(false)`. Unsupported Yul is left untouched for
      the diagnostic. Result: bench 102 -> 109 (+7: AssemblyVariable/Math/Loop/If/Error/BinExp +
      MostSignificantBitAssembly; UserDefinedValueTypes still needs `type.wrap`, a separate non-assembly
      wall). Runtime correctness verified on the mock VM (solidcash e2e YulInlineAssembly.test.ts: shl/shr/
      and/lt/add, for-loop, switch). NOTE: lowering types locals as uint256, so a Yul block referencing
      *signed* int Solidity vars in bitwise may hit a signedness check - standard Yul uses uint256.
- [ ] Phase 3 - route the rename-only primitives. Each Yul builtin in the "Routing" table that needs no
      decode (`caller`/`callvalue`/context, `keccak256`(value form)/`addmod`/`mulmod`, `balance`/`selfbalance`/
      `extcodesize`, `blockhash`, `log0..4`, `selfdestruct`) lowers to the existing AST node / operator for
      that primitive. Cheap and sound (reuses tested codegen). Unblocks ContractSize.sol (extcodesize ->
      .code.length).
- [x] Phase 4 - storage + transient. DONE. `sstore(slot, v)` / `sload(slot)` lower to `StateAssignNode` /
      `StateAccessNode` for the value-type state var at that slot (declaration order = slot number); the
      `.slot` form (`sstore(x.slot, v)`) resolves to the named var. Verified by byte-identical compilation to
      the direct `this.x = v` / `this.x` forms - i.e. it IS the existing, tested state codegen. Packed /
      dynamic / mapping / array slots stay deferred (Phase 7). `tstore(key, v)` / `tload(key)` (constant key)
      lower to a zero-initialized, function-execution-scoped local hoisted to the assembly block top (so
      `tload` may precede `tstore`, e.g. an inert reentrancy guard); byte-identical to an explicit local, and
      a stateless e2e round-trips it. No bench movement (EVMStorage needs packed slots; TransientStorage is
      multi-wall) - shipped for completeness.
- [x] Phase 5 - memory scratch. DONE (`mstore`/`mload`/`keccak256`). A per-block compile-time word-addressed
      map (constant offset -> stored Yul value): `mstore(p, v)` records (no emitted statement), `mload(p)`
      re-lowers the stored value, `keccak256(p, len)` concatenates the covered words (each wrapped `bytes32`)
      and applies the keccak builtin -> byte-identical to `keccak256(bytes.concat(bytes32(w0), ...))` and an
      `mload` round-trip is byte-identical to a direct read (so it reuses the tested keccak/concat codegen).
      Hashes.sol already compiled via the declaration-library path (counted in Phase 1), so no new bench, but
      this is the real codegen and the base for the bytes-memory and call/create-decode phases. Limitation:
      re-lowering assumes the stored value is not mutated between `mstore` and the read (the usual
      store-then-hash shape); `mstore8`, dynamic/free-pointer offsets, and `return`/`revert` with data are
      deferred.
- [x] Phase 6 - call / create. DONE as diagnostics, NOT codegen - the premise did not survive the evidence.
      Reading every `call`/`create` assembly in the corpus from source: all are the fundamental opaque case.
      `create`/`create2` deploy a runtime `bytes memory` blob or hand-built EIP-1167 bytecode (Factory,
      Proxy, MinimalProxy, Create2's FactoryAssembly) - never a compile-time-known contract, so they do not
      map to a typed `new`. UpgradeableProxy `calldatacopy(0,0,calldatasize())` + `delegatecall(gas(), impl,
      ...)` forwards *all* calldata to an *opaque* implementation - no known interface, no constant selector.
      The "decode the constant `selector || args` region and route to ExternalCall" precondition never occurs,
      so there is nothing sound to lower (building it would be speculative codegen no file exercises). Instead:
      `create`/`create2` are now hard-rejected ("deploying runtime bytecode has no BCH analogue; use a typed
      `new Contract(...)`"), and `call`/`delegatecall`/`staticcall` get a precise diagnostic ("needs a known
      target interface and a constant selector ... forwarding opaque calldata is not supported"). The typed
      external call stays the high-level `IContract(addr).method(...)` path (external-contract-calls.md), not
      Yul. No bench change (those files are multi-wall regardless).
- [x] Phase 7a - bytes-memory layout. DONE. `mload(add(ptr, off))` for a `bytes`-typed parameter lowers to
      `bytes32(ptr[off-32 : off])` (EVM `bytes memory` is `[length(32)][data]`, so `add(ptr, 32)` is the data
      start) - byte-identical to the direct slice, the canonical ECDSA signature-split shape. Also fixed a
      real grammar wart found here: Yul identifiers now accept solidc soft keywords (`anyIdentifier`), so a
      variable named `sig`/`pubkey`/`datasig`/etc. parses (ECDSA's `sig` param). Byte slices flowing into
      arithmetic / `byte(0, mload(...))` are not yet handled. No bench target (ECDSA/Signature are
      libraries / fail on other walls), but the byte-split is a common real-world pattern.
- [x] Phase 7b - packed storage slots. DONE. solidc stores sub-word state vars as separate fields (its
      `isPacked` is the explicit `packed` modifier, unrelated to EVM bit-packing), so an EVM slot view is
      computed (declaration-order packing into 32-byte slots) and `sload(slot)` combines the slot's int
      fields into a word (`uint256(v0) + uint256(v1)*2^off1 + ...`) while `sstore(slot, w)` decomposes it
      (`vi = type((w / 2^offi) % 2^widthi)`, via DIV/MOD to avoid bitwise on literals). A single full-width
      var stays byte-identical to direct state access; the packed combine is byte-identical to the explicit
      expression. Also fixed a P2 type-friction surfaced here: integer bitwise / `not` now cast operands to
      uint256, so literal masks (`or(v, 11)`, `not(sub(shl(128,1),1))`) work - the EVMStoragePackedSlot
      read-mask-write pattern compiles. Slots holding a non-int var (address/bytes/mapping) stay NotLowerable.
      No bench target (EVMStorage.sol fails earlier on a mapping `.push`), shipped for completeness.

## Expected bench payoff

- Phase 2: +8 (the pure-computation files), solid.
- Phase 3: ContractSize.sol (extcodesize -> .code.length) likely +1; the rest of the routed primitives
  mostly help multi-wall files rather than close them alone.
- Phase 5-6: Hashes.sol (+1), EVMStorage.sol (+1 if packed slots land in phase 7). Transient and the
  ECDSA/Signature files are multi-wall (low-level `.call`, fallback, ecrecover-inert) so they need the
  call-routing too. Factory/Create2 depend on whether the deploy target is a known typed contract.
- Genuinely fundamental (raw-bytecode proxy MinimalProxy/Proxy/UpgradeableProxy, free-pointer YulMem,
  verbatim/extcodecopy): stay out.

Net: this is not a narrow "value computation" subset - because solidcash already implements the context
surface, external calls, events, deploy, selfdestruct, balance, code (size/hash/copy, own + external), and
calldata (`msg.sig ++ abi.encode(args)`), most of the EVM opcode set ROUTES to existing codegen. The only
genuinely out residual is `verbatim` (raw EVM bytecode), `pc` / object / linking builtins, growable
free-pointer dynamic memory, and opaque-bytecode proxies. That makes the achievable Yul coverage much wider
than the original "pure computation only" framing - the "no BCH equivalent" bucket has repeatedly turned out
smaller than first assumed (calldata and own-code were both initially miscategorised).

## Open questions / risks

- Yul arithmetic is unchecked and wraps mod 2^256; solidcash int256 may over/underflow-check or hit BCH
  number-size limits differently. Bench values are tiny so it does not bite there, but a faithful subset
  should document `add`/`mul`/etc. as wrapping (or reject when wrapping is observable).
- Packed-storage soundness hinges on solidcash's state layout matching the bit positions the hand-written
  masks assume; safest to keep packed slots a stretch goal behind an explicit opt-in.
- `byte(n, x)`, `sar` (signed shift), `signextend`, `addmod`/`mulmod` overflow semantics need exact-match
  tests against EVM before claiming parity.
- `extcodehash` routes to `.codehash`, but BCH `.codehash` is the script hash (hash256/hash160 of the redeem
  script), not EVM `keccak256(code)`. Fine for "is this a known contract" comparisons (both sides on-chain),
  not byte-identical to EVM. Document as a routed-but-not-identical op.

Bench runner: `examples/solidity-by-example/bench.mjs` (`node bench.mjs`).
