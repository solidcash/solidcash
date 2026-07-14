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
bit of the most-significant byte). `-1` is a set sign bit over magnitude `1`, not an all-ones word. Since May
2025 BCH numbers are **arbitrary-precision (BigInt)**; the only ceiling is the **10,000-byte stack-element
limit**, so intermediate "overflow" of fixed-width EVM types is a non-issue in practice.

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
BigInt means you will not hit the EVM's 256-bit wraparound; if your Solidity relied on `unchecked` wraparound,
that behaviour is NOT reproduced (values just grow).

---

## 3. Hashing & storage-slot ids: sha256 (BCH) vs keccak256 (EVM)

**EVM** uses **keccak256** (SHA-3) everywhere it matters structurally: mapping/array storage-slot derivation,
`ERC-7201` namespaced slots, `EIP-712` domain separators, role ids (`keccak256("ADMIN_ROLE")`), selectors, etc.

**BCH** has no native keccak256 opcode. SolidCash's policy:

| Use | Hash used | Byte-identical to Ethereum? |
|-----|-----------|------------------------------|
| Runtime `keccak256(data)` (native mode) | real keccak via a side-car library | **Yes** |
| Constant `keccak256("literal")` under `solidityImportCompat` | folded to **sha256** (warned) | **No** |
| `erc7201(id)` / EVM storage-slot derivation | **sha256** (warned) | **No** |
| `sha256(x)` | sha256 | Yes (it is sha256) |

### What this affects

- **Slot / role-id / domain-separator VALUES differ from Ethereum.** A role id or storage slot SolidCash computes
  will not equal the one an Ethereum contract computes for the same input. They are **internally consistent** -
  the same SolidCash contract always derives the same slot - so on-chain correctness within BCH is fine.
- **Do not rely on cross-chain slot/id equality.** If a design assumes a slot or role id matches a specific
  Ethereum contract (e.g. a shared registry, an EIP-712 signature verified on both chains), that assumption
  breaks. The compiler emits a one-time warning at each such site.
- **Footgun within compat mode:** a *constant* `keccak256("x")` folds to `sha256("x")`, but a *runtime*
  `keccak256(dynamicBytes)` uses real keccak. Prefer `sha256` explicitly for on-chain slot/id derivation so the
  constant and runtime forms agree, or stay in native mode with the real-keccak library if you need Ethereum
  parity for data hashing.

> Anchors in the compiler: `FoldHashLiterals.ts` (the keccak256->sha256 literal fold), `LowerInlineAssembly.ts`
> (the `erc7201`/EVM-slot sha256 alias + warnings). See also `docs/external-libraries.md` (keccak side-car) and
> `docs/evm-storage-parity.md`.

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
- **Addresses are p2sh32** (a 32-byte script hash), not 20-byte EVM addresses. `payable` is a cosmetic no-op
  (every BCH address can receive value). `bytes20`/`uint160(address)` casts exist for EVM-source compatibility
  but the underlying identity is the 32-byte hash.
- **No gas metering.** There is no `gas`/`gasprice` economy; limits are on **bytecode/stack size** instead. Yul
  `gas()` etc. lower to the nearest analogue or are rejected.
- **`msg.data` / calldata** is reconstructed from the input's unlocking bytecode where sound, not a first-class
  ABI blob; some `abi.decode(msg.data...)` forms are restricted. See the inline-assembly and corpus notes.

---

## Quick reference

| Primitive | EVM | BCH / SolidCash |
|-----------|-----|-----------------|
| Word/byte order | big-endian | **little-endian** |
| Integer encoding | 256-bit two's-complement | **little-endian sign-magnitude, BigInt** (10 KB element cap) |
| Overflow | wraps mod 2^256 | grows (no wraparound; `unchecked` wrap not reproduced) |
| Structural hash | keccak256 | **sha256** for slots/ids (warned); real keccak for data via side-car |
| Storage | account key-value (`SSTORE`) | **NFT-commitment state**, one spend = one execution |
| Address | 20-byte | **32-byte p2sh32**; `payable` is a no-op |
| Memory | big-endian heap | **little-endian on-stack buffer** |
| Gas | metered | not metered (size limits) |

When in doubt: write high-level SolidCash and let the compiler handle layout. Reach for inline assembly / raw byte
manipulation only when you have accounted for little-endian order and sign-magnitude encoding.
