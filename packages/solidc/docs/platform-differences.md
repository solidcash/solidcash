# Platform differences: BCH vs the EVM

Read this first if you are coming from Solidity / the EVM. SolidCash compiles a Solidity-like language to
**Bitcoin Cash Script**, which is a different virtual machine with a different execution model. Most high-level
code ports cleanly, but a handful of **primitive-level** differences are load-bearing and will silently surprise
you if you assume EVM semantics. This document is the anchor for those differences.

The guiding rule: SolidCash is **BCH-native by design**. When a Solidity primitive has no exact BCH analogue we
pick the sound BCH-native behaviour and warn, rather than emulate the EVM byte-for-byte. Your contract stays
**internally consistent**; it is just not guaranteed to produce the same bytes/values an Ethereum node would.

---

## 1. Byte order: little-endian (BCH) vs big-endian (EVM)

**EVM** words and memory are **big-endian**: the most-significant byte is at the lowest address / lowest byte
index. `bytes32(uint256 x)` puts `x`'s low byte last (index 31).

**BCH** Script numbers are **little-endian**: the least-significant byte comes first. So in SolidCash,
`bytes32(x)` puts the **low byte at index 0**:

```solidity
// VM-verified:
bytes32(0x5a)[0:1] == 0x5a   // low byte is at index 0  (little-endian, BCH)
bytes32(0x5a)[31:32] == 0x5a // this is what EVM would give (big-endian) - NOT true here
```

### What this affects

- **Number <-> bytes casts** (`bytes32(uint)`, `uint(bytesN)`): the byte layout is little-endian.
- **Linear memory** (the runtime `__yulmem` buffer that backs Yul `mstore`/`mload`/`mstore8`): words are stored
  little-endian. `mstore(p, v)` then `mload(p)` round-trips `v` exactly (endianness is internally consistent),
  but the **byte at address `p` is the LOW byte of the word**, whereas on the EVM it is the HIGH byte.
- **`mstore8(p, v)`** writes `v`'s low byte at `p`. Because the buffer is little-endian, `mstore8(p, v); r := mload(p)`
  gives `r == v & 0xff` (the byte sits in the low position). On the EVM the same sequence gives `v << 248`.
- **Hashing raw memory / building byte strings by hand**: the bytes are laid out little-endian, so a
  hand-assembled buffer that you then hash or return will not match the EVM's big-endian layout.

### What this does NOT affect

Word-level values. If you `mstore` a word and `mload` it back, or read array element `i`, you get the right
**value** - endianness cancels out on any store/load round-trip. High-level array/struct access, arithmetic, and
comparisons are all value-level and behave exactly as you expect. Only **byte-level reinterpretation** of a word
diverges from the EVM.

> Porting tip: if you have EVM assembly that does `mstore8`/byte-twiddling and assumes big-endian positions,
> re-derive the offsets for little-endian, or (better) rewrite it in high-level SolidCash and let the compiler
> lay out memory.

---

## 2. Number encoding: sign-magnitude (BCH) vs two's-complement (EVM)

**EVM** integers are 256-bit **two's-complement**. `-1` is `0xFFFF...FF`; the high bit is the sign; overflow
wraps mod 2^256.

**BCH** Script numbers are **little-endian sign-magnitude**: a magnitude plus a dedicated **sign bit** (the high
bit of the most-significant byte). `-1` is a set sign bit over magnitude `1`, not an all-ones word. `int`/`uint`
are fixed-width `int256`/`uint256` with **EVM overflow semantics** (checked arithmetic reverts on over/underflow;
`unchecked` wraps mod 2^N, two's-complement parity); the BCH-native **arbitrary-precision** integer is the
separate `bigint` type, bounded only by the **10,000-byte stack-element limit**.

### What this affects

- **The bit pattern of negatives.** A negative number is NOT its two's-complement word. Do not assume
  `-1 == 0xFFF...F`, and do not build a negative by setting the top bit of a `bytes32`.
- **High-bit-set values crossing the number/bytes boundary.** A 32-byte value whose top byte is `>= 0x80` is a
  *negative number* when interpreted as a signed Script number. If you write such a byte into the
  most-significant position of a word and then read the word as an integer, you get a negative value, not the
  large positive one the EVM would give. (This is exactly why byte-level EVM assembly that packs values into the
  high byte of a word misbehaves - see section 1.)
- **Bitwise ops / shifts / sign-extension** operate on the sign-magnitude representation. High-level arithmetic
  is fine; raw bit manipulation of negatives is where the representations diverge.

### What this does NOT affect

Ordinary arithmetic and comparison on values within range. `a + b`, `a < b`, `a * b / c` all behave as expected.
Fixed-width `int`/`uint` reproduce EVM overflow: a checked context reverts, `unchecked` wraps mod 2^N
(two's-complement parity). Use `bigint` for the BCH-native arbitrary-precision integer that never wraps and
grows to the stack-element limit.

---

## 3. Hashing & storage-slot ids: sha256 (BCH) vs keccak256 (EVM)

**EVM** uses **keccak256** (SHA-3) everywhere it matters structurally: mapping/array storage-slot derivation,
`ERC-7201` namespaced slots, `EIP-712` domain separators, role ids (`keccak256("ADMIN_ROLE")`), selectors, etc.

**BCH** has no native keccak256 opcode. SolidCash's policy:

| Use | Hash used | Byte-identical to Ethereum? |
|-----|-----------|------------------------------|
| Runtime `keccak256(data)` | real keccak via a side-car library | **Yes** |
| Constant `keccak256("literal")` | folded to real keccak256 | **Yes** |
| Yul `keccak256(ptr, len)` | real keccak (folded / side-car) | **Yes** |
| `erc7201(id)` namespaced slot (EIP-7201) | real keccak256, full spec formula | **Yes** |
| Function selector under `evmCompat` | real keccak256 | **Yes** |
| Mapping/array physical STORAGE-SLOT space | sha256 (BCH-native) | **No** |
| Event `.selector` / topic0 | sha256 (BCH-native) | **No** |
| `sha256(x)` | sha256 | Yes (it is sha256) |

### What this affects

- **keccak256 VALUES match Ethereum.** Role ids (`keccak256("ADMIN_ROLE")`), EIP-712 domain separators, and
  `erc7201(id)` namespaced-slot numbers are computed with **real keccak256** (constant fold, runtime side-car, and
  the Yul builtin), so they equal what an Ethereum contract derives for the same input. `erc7201("...")` folds to
  the EIP-7201 slot `keccak256(abi.encode(uint256(keccak256(id)) - 1)) & ~bytes32(uint256(0xff))`, verified
  byte-identical to the spec's reference values.
- **The physical STORAGE-SLOT SPACE is BCH-native (sha256).** A mapping/array's on-chain slot (and an event's
  topic0) is derived with sha256 - BCH has its own UTXO/covenant storage model, not the EVM trie. So although
  `erc7201("x")` yields Ethereum's slot *number*, the data physically lives in BCH's `__evm_storage` space. This
  is internal and never cross-chain-compared, so on-chain correctness within BCH is unaffected.
- The `contract C layout at <expr>` storage-layout-offset clause is not supported (ignored, warned) - BCH storage
  is not a linear slot array to offset.

> Anchors in the compiler: `FoldHashLiterals.ts` (real-keccak literal fold), `state.ts` `computeErc7201Slot`
> (the EIP-7201 formula), `keccak-compute-library.ts` (runtime keccak side-car). See also
> `docs/external-libraries.md` (keccak side-car) and `docs/evm-storage-parity.md`.

---

## 4. Execution model: UTXO covenant (BCH) vs account/stack (EVM)

Not asked for above but essential context for why the primitives above matter:

- **No persistent contract storage.** There is no `SSTORE` key-value store surviving between transactions. State
  lives in a **CashToken NFT commitment** carried by the contract UTXO; one spend = one function execution, and
  the "new state" is an output the covenant constrains. There is no re-entrancy and no cross-call stack in the
  EVM sense - external calls are modelled as **co-spent inputs/outputs** pinned by the covenant.
- **Memory is on-stack, not a separate heap.** The `memory` data-location keyword is a no-op; local reference
  types are lowered to a linear byte buffer (see `docs/experimental-memory-model.md`) or value-copied. Sections 1
  and 2 are about that buffer.
- **Addresses are full locking bytecode** (the entire scriptPubKey, e.g. P2PKH `76a914<20>88ac` = 25 bytes,
  P2SH32 `aa20<32>87` = 35 bytes, or an arbitrary covenant script) - variable length, NOT a fixed 20- or
  32-byte hash. `payable` is a cosmetic no-op (every BCH address can receive value). `bytes20`/`uint160(address)`
  casts exist for EVM-source compatibility, but the underlying identity is the whole locking script.
- **No gas metering.** There is no `gas`/`gasprice` economy; limits are on **bytecode/stack size** instead. Yul
  `gas()` etc. lower to the nearest analogue or are rejected.
- **`msg.data` / calldata** is reconstructed from the input's unlocking bytecode where sound, not a first-class
  ABI blob; some `abi.decode(msg.data...)` forms are restricted. See the inline-assembly and corpus notes.

---

## Quick reference

| Primitive | EVM | BCH / SolidCash |
|-----------|-----|-----------------|
| Word/byte order | big-endian | **little-endian** |
| Integer encoding | 256-bit two's-complement | **LE sign-magnitude**; `int`/`uint` = fixed int256/uint256, `bigint` = arbitrary-precision |
| Overflow | checked reverts, `unchecked` wraps mod 2^256 | **same** for `int`/`uint`; `bigint` grows (no wrap) |
| Structural hash | keccak256 | **sha256** for slots/ids (warned); real keccak for data via side-car |
| Storage | account key-value (`SSTORE`) | **NFT-commitment state**, one spend = one execution |
| Address | 20-byte | **variable-length locking bytecode**; `payable` is a no-op |
| Memory | big-endian heap | **little-endian on-stack buffer** |
| Gas | metered | not metered (size limits) |

When in doubt: write high-level SolidCash and let the compiler handle layout. Reach for inline assembly / raw byte
manipulation only when you have accounted for little-endian order and sign-magnitude encoding.
