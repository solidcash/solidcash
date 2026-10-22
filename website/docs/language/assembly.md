---
title: Inline Assembly
---

SolidCash accepts two kinds of `assembly { }` block:

- **Yul**, the same inline-assembly language Solidity uses. Anything with `let`, `:=`, `if`, `switch`, `for`
  or a function definition is treated as Yul.
- **Native BCH Script**, a bare sequence of `OP_` opcodes and push literals.

The compiler classifies the block automatically: a block containing only bare opcode paths and literals is
native BCH ASM; anything structural is Yul.

## Yul

Yul blocks port from Solidity as written. All Yul values are 256-bit words.

```solidity
contract Compute() {
    uint256 result;

    function run(uint256 a) public {
        uint256 r;
        assembly {
            let x := add(a, 1)
            let y := mul(x, 2)
            if gt(y, 0) { y := sub(y, 1) }
            r := y
        }
        this.result = r;
    }
}
```

Solidity locals and parameters are visible inside the block by name, and assignments to them flow back out.

A signed variable enters the block in BCH sign-magnitude form, not EVM two's complement, so `sar`, `signextend`
and `shl` fail the script on a negative value rather than computing a wrong word. `exp` runs one loop iteration
per exponent bit. See [Platform Differences](/docs/basics/platform-differences#number-encoding).

### Why most of the EVM instruction set works

Yul's builtin set is generated directly from the EVM instruction set, so the support boundary is a partition
of the EVM opcodes into three buckets:

1. **Compute on a value** - arithmetic, bitwise, comparison, control flow. These lower directly to BCH Script.
2. **Touch a machine resource SolidCash already exposes** - the context surface, external calls, events,
   `selfdestruct`, balance and code size. These are *routed* onto the existing high-level codegen, so they
   inherit its behaviour and soundness. This is the large bucket.
3. **Touch a resource with no BCH analogue** - raw EVM bytecode objects, the program counter, runtime-bytecode
   deploys. These are rejected with a clear diagnostic rather than an opaque parse error.

### Supported builtins

| Family | Builtins | Notes |
| --- | --- | --- |
| Variables | `let`, `:=`, multi-assignment | Stack locals; Solidity variables visible by name |
| Arithmetic | `add sub mul div sdiv mod smod exp addmod mulmod` | Direct BCH arithmetic |
| Bitwise | `and or xor not shl shr sar` | `shl(n,x)` is `x * 2^n`, `shr(n,x)` is `x / 2^n` |
| Comparison | `lt gt slt sgt eq iszero` | `iszero` is `OP_NOT` |
| Control flow | `if`, `for`, `switch` / `case` / `default`, `break`, `continue`, `leave`, nested blocks | Lowered to the existing branch and loop codegen; a top-level `leave` returns early from a local Yul function |
| Functions | `function f(a, b) -> r { ... }` | Inlined at each call: no recursion, and `leave` only as an unconditional top-level statement of the function body |
| Memory | `mstore mload mstore8 mcopy msize`, `keccak256(p, l)`, `return(p, l)`, `revert(p, l)` | Backed by the runtime `__yulmem` buffer |
| Words | `byte(n, x)`, `signextend(b, x)`, `clz(x)`, `pop(x)`, `erc7201(namespace)` | Word selection, sign extension, leading-zero count, discard, ERC-7201 slot |
| Storage | `sstore sload`, `.slot`, `.offset` | Virtual-slot table over state variables (value types) |
| Transient | `tstore tload` | Zero-initialised function-scoped local; no UTXO |
| Context | `caller callvalue origin chainid number timestamp coinbase difficulty prevrandao` | Routed to the existing globals |
| Gas and fees | `gas gaslimit gasprice basefee blobbasefee` | `gas()` and `gaslimit()` are fixed shims (see the caution below); `gasprice()` is this transaction's fee rate and `basefee()` the block's realized fee rate, in sat/kB; `blobbasefee()` aliases `basefee()` |
| Balance / code | `balance selfbalance extcodesize extcodehash address codesize codecopy extcodecopy` | Routed to `addr.balance`, `addr.code`, `this.activeBytecode` |
| Calldata | `calldataload calldatasize calldatacopy` | Synthesized from `msg.sig` plus the ABI-encoded arguments |
| Return data | `returndatasize returndatacopy` | Tracks the last low-level call's return data |
| Block hash | `blockhash blobhash` | Routed to the block oracle; `blobhash` is always zero (BCH has no EIP-4844 blobs) |
| Logs | `log0 log1 log2 log3 log4` | Routed to event emission |
| External call | `call staticcall delegatecall` | Routed to the low-level call codegen |
| Termination | `stop()`, `invalid()` | `stop()` ends the path with empty return data - write the function's `require` **before** it, since a `require` after it is unreachable and the path then reads as unverified. `invalid()` is an unconditional abort (`require(false)`), and does nothing inside an untaken branch |

### Not supported

These are rejected with an explicit diagnostic naming the builtin:

| Builtin | Reason |
| --- | --- |
| `create`, `create2` | Deploy runtime bytecode; use the high-level `new Contract(...)`. A value-0 call over constant or memory-built bytecode only computes the address that bytecode would have and deploys nothing |
| `verbatim_*` | Raw EVM bytecode has no BCH equivalent |
| `pc` | The EVM program counter has no BCH analogue |
| `datasize`, `dataoffset`, `datacopy`, `linkersymbol` | EVM bytecode-object builtins |
| `callcode` | No BCH analogue |
| `selfdestruct(addr)` | Not yet lowerable inside assembly; use the `selfdestruct` lifecycle modifier and the `selfdestruct(addr)` statement |

:::caution
`gas()`, `gasleft()` and `block.gaslimit` are **fixed shims** that return `1000000`. They exist so ported
gas-budget checks keep running; the value is meaningless on BCH, which has no gas metering. The compiler warns
when a contract uses one.
:::

### Memory model

Yul memory is backed by a runtime linear buffer. `mstore(p, v)` followed by `mload(p)` round-trips `v`
exactly, but the buffer is **little-endian**, so the byte at address `p` is the **low** byte of the word,
whereas on the EVM it is the high byte.

```solidity
contract MemoryDemo() {
    uint256 out;

    function roundTrip(uint256 v) public {
        uint256 r;
        assembly {
            mstore(0x80, v)
            r := mload(0x80)     // r == v
        }
        this.out = r;
    }
}
```

`mstore8(p, v)` writes `v`'s low byte at `p`. Because the buffer is little-endian, `mstore8(p, v)` then
`mload(p)` gives `v & 0xff`; on the EVM the same sequence gives `v << 248`.

:::caution
If you are porting EVM assembly that packs values into the high byte of a word or hashes a hand-assembled
buffer, re-derive the offsets for little-endian order. See
[Platform Differences](/docs/basics/platform-differences#byte-order).
:::

### Storage model

`sstore` and `sload` address a compiler-resolved virtual slot model. Declared values follow EVM declaration and
sub-word packing rules; recognized mapping, dynamic-array, `StorageSlot`, and ERC-7201 shapes are routed onto the
same authenticated native state used by high-level code. Arbitrary word slots use a hidden vmap.

```solidity
contract StorageDemo() {
    uint256 slot0;

    function write(uint256 v) public {
        assembly {
            sstore(0, v)
        }
        require(this.slot0 == v);
    }
}
```

This includes high-bit slot numbers and packed word read/write, but a BCH `address` cannot round-trip through an
EVM `uint160` word because it is full locking bytecode. See
[EVM Storage & ERC-7201 Compatibility](./evm-storage-compat.md) for the physical substrates, supported assembly
patterns, dynamic values, OpenZeppelin factories, limitations, and security guidance.

## Native BCH assembly

A block of bare opcodes is emitted directly into the script. This is the escape hatch for Bitcoin Cash
primitives that have no high-level spelling. A native block may contain only `OP_` opcodes and hex data pushes
(`0xdeadbeef` or `deadbeef`).

```solidity
contract Raw() {
    function spend(int a) {
        require(a > 0);
        assembly { OP_DUP OP_DROP }
    }
}
```

The compiler tracks the stack effect of each opcode so it can keep the surrounding code consistent, but it
does **not** type-check the values you produce. Values a block leaves on the stack have no source-level name.

The compiler rejects:

- unknown opcodes, and `OP_RETURN`, `OP_CODESEPARATOR`, `OP_VER`, `OP_VERIF`, `OP_VERNOTIF` and the
  `OP_RESERVED` opcodes;
- opcodes whose stack effect cannot be tracked statically;
- `OP_IF`/`OP_NOTIF`/`OP_ELSE`/`OP_ENDIF` arms that leave different stack heights, and `OP_BEGIN`/`OP_UNTIL`
  loops whose body does not restore the stack height it started with.

:::caution
Inline assembly bypasses the compiler's safety checks. A block that leaves the stack in an unexpected shape
will produce a contract that is subtly wrong or permanently unspendable. Every native assembly block emits a
compiler warning. Use it only when you fully understand the stack effects, and test on the VM.
:::

## See also

- [Platform Differences](/docs/basics/platform-differences) - little-endian memory and sign-magnitude integers
- [Data Locations](/docs/language/data-locations) - how `memory` and `storage` work outside assembly
- [EVM Storage & ERC-7201 Compatibility](/docs/language/evm-storage-compat) - `sload`/`sstore`, mappings, arrays and namespaces
- [Debugging](/docs/guides/debugging) - inspecting the emitted script and VM traces
