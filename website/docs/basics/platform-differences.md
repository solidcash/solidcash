---
title: Platform Differences (BCH vs EVM)
---

Read this first if you are coming from Solidity. SolidCash compiles a Solidity-like language to **Bitcoin Cash
Script**, which is a different virtual machine with a different execution model. Most high-level code ports
cleanly, but a handful of **primitive-level** differences are load-bearing and will silently surprise you if
you assume EVM semantics.

The guiding rule: SolidCash is **BCH-native by design**. When a Solidity primitive has no exact BCH analogue,
the compiler picks the sound BCH-native behaviour, and warns where it can, rather than emulating the EVM
byte-for-byte. Your
contract stays internally consistent; it is just not guaranteed to produce the same bytes an Ethereum node
would.

## Quick reference

| Primitive | EVM | BCH / SolidCash |
| --- | --- | --- |
| Word / byte order | big-endian | **little-endian** |
| Integer encoding | 256-bit two's complement | **LE sign-magnitude**; `int`/`uint` are `int256`/`uint256`, `bigint` is arbitrary precision |
| Overflow | checked reverts, `unchecked` wraps | **same** for `int`/`uint`; `bigint` grows (never wraps) |
| Structural hash | keccak256 | **sha256** for physical storage slots, the event covenant salt and native selectors; **real keccak256** for source-visible values, and for selectors under `evmCompat` |
| Storage | account key-value (`SSTORE`) | **NFT-commitment state**; mappings use authenticated vmaps; one spend = one execution |
| Address | 20-byte | **variable-length locking bytecode**; `payable` is a no-op |
| Memory | big-endian heap | **little-endian on-stack buffer** |
| Gas | metered | not metered (bytecode size, stack size and per-input operation cost limits instead) |
| Re-entrancy | possible | **structurally impossible** (no synchronous cross-call) |

## 1. Byte order: little-endian {#byte-order}

EVM words and memory are **big-endian**: the most significant byte sits at the lowest index. BCH Script
numbers are **little-endian**, so in native SolidCash `bytes32(x)` puts the **low byte at index 0**:

```solidity
// bytes32(0x5a)[0:1] == 0x5a     <- low byte first (BCH)
// bytes32(0x5a)[31:32] == 0x5a   <- what the EVM would give; NOT true here
```

### What this affects

- **Number to bytes casts** (`bytes32(uint)`, `uint(bytesN)`): the byte layout is little-endian in native mode.
  Under the `evmCompat` option these casts use the EVM layout instead: big-endian two's complement, so
  `bytes32(type(uint256).max)` fits and `bytes32(int256(-1))` is all `0xff` bytes, as on Ethereum.
- **Linear memory** backing Yul `mstore`/`mload`/`mstore8`: words are stored little-endian. `mstore(p, v)`
  then `mload(p)` round-trips `v` exactly, but the byte at address `p` is the **low** byte of the word,
  whereas on the EVM it is the high byte.
- **Hashing raw memory or hand-assembling byte strings**: the bytes are laid out little-endian, so a
  hand-built buffer will not match the EVM's big-endian layout.

### What this does not affect

Word-level values. Store/load round-trips, array element reads, arithmetic and comparisons are all
value-level and behave exactly as you expect. Only **byte-level reinterpretation** of a word diverges.

:::tip
If you are porting EVM assembly that does `mstore8` or byte-twiddling assuming big-endian positions,
re-derive the offsets for little-endian, or better, rewrite it in high-level SolidCash and let the compiler
lay out memory.
:::

## 2. Number encoding: sign-magnitude {#number-encoding}

EVM integers are 256-bit **two's complement**: `-1` is `0xFFFF...FF`, the high bit is the sign, and overflow
wraps mod 2^256.

BCH Script numbers are little-endian **sign-magnitude**: a magnitude plus a dedicated sign bit (the high bit
of the most significant byte). `-1` is a set sign bit over magnitude `1`, not an all-ones word.

This is why `int256` and `uint256` are **33 bytes** on chain rather than 32: a full 256-bit magnitude needs
one extra bit for the sign, which rounds up to a byte.

### What this affects

- **The bit pattern of negatives.** A negative number is not its two's-complement word. Do not assume
  `-1 == 0xFFF...F`, and do not build a negative by setting the top bit of a `bytes32`.
- **High-bit-set values crossing the number/bytes boundary.** A 32-byte value whose top byte is `>= 0x80` is
  a *negative* number when read as a signed Script number, not the large positive one the EVM would give.
- **Raw bit manipulation of negatives**, including shifts and sign extension.

### What this does not affect

Ordinary arithmetic and comparison within range. Fixed-width `int`/`uint` reproduce EVM overflow semantics:
a checked context reverts and `unchecked` wraps mod 2^N. Use `bigint` for BCH-native arbitrary precision that
never wraps.

See [Types & Operators](/docs/language/types#integers) for the full integer model.

## 3. Hashing: keccak256 values are real, slot ids are sha256 {#hashing}

The EVM uses **keccak256** everywhere it matters structurally. BCH has no native keccak256 opcode, so
SolidCash splits the difference:

| Use | Hash used | Byte-identical to Ethereum? |
| --- | --- | --- |
| Runtime `keccak256(data)` | real keccak, via a co-spent side-car | **Yes** |
| Constant `keccak256("literal")` | folded to real keccak256 at compile time | **Yes** |
| Yul `keccak256(ptr, len)` | real keccak | **Yes** |
| `erc7201(id)` namespaced slot | real keccak256, full EIP-7201 formula | **Yes** |
| Function selector, `type(I).interfaceId` and `event.selector` under `evmCompat` | real keccak256 over Solidity's canonical signature | **Yes** |
| Mapping / array physical storage-slot space | sha256 (BCH-native) | No |
| Event covenant name hash (the 20-byte event-address salt) | sha256 (BCH-native) | No |

So **keccak256 values match Ethereum**: role ids like `keccak256("ADMIN_ROLE")`, EIP-712 domain separators and
`erc7201` slot numbers all equal what an Ethereum contract derives. What is BCH-native is the *physical*
storage-slot space, which is internal to BCH's UTXO storage model and never cross-chain compared.

:::note
By default, function selectors are derived with sha256, so encoded calldata is not cross-VM compatible. Under
the `evmCompat` compiler option selectors use real keccak256 and match Ethereum. See
[Cryptography](/docs/language/cryptography).
:::

### Event arguments under `evmCompat`

An event's payload is one NFT commitment (128-byte cap) with no topic channel, so it cannot be a standard ABI
tuple. Under `evmCompat` a scalar argument of statically known width is written in the **standard EVM notation** -
the bytes `abi.encodePacked` produces at the type's natural width, big-endian two's-complement for a number - and
the artifact marks that parameter `notation: 'evm'`, so a standard decoder reads it without the platform's
little-endian sign-magnitude frame. Every other argument keeps the platform frame: a variable-width byte value
(`bytes`/`string`/`pubkey`/`sig`/`datasig`) is already raw and self-delimiting, an `address` on BCH is a locking
bytecode whose value form the `addressForm` option decides, and solc has no packed form for a struct, an array, a
UDVT or a function pointer. Native compiles keep the platform frame for every argument. See
[Events & Errors](/docs/language/events-errors).

## 4. Execution model: UTXO covenant, not accounts {#execution-model}

This is the deepest difference, and it explains most of the others.

- **No persistent contract storage.** There is no `SSTORE` key-value store surviving between transactions.
  State lives in **CashToken NFT commitments** carried by the contract's UTXOs. One spend equals one function
  execution, and the "new state" is an output the covenant constrains.
- **Mappings require proofs.** A transaction author can omit arbitrary UTXOs, so every mapping is a verified
  mapping (vmap). Reads co-spend either the exact key or the predecessor proving that the key is absent. This
  preserves Solidity's unset-key default without trusting the transaction builder.
- **No re-entrancy and no call stack.** External calls are not synchronous jumps; they are modelled as
  **co-spent inputs and outputs** pinned by the covenant. A contract cannot be re-entered mid-execution,
  because there is no mid-execution to re-enter. Re-entrancy guards ported from Solidity are harmless but
  unnecessary. When a call graph does not fit that model (an owner invoked twice, or a cycle), the
  [message bus](/docs/guides/message-bus) folds the invocations into one authenticated atomic transition
  instead of introducing a call stack. Message-bus composition is experimental in 0.14.0-beta.1.
- **Memory is on-stack, not a separate heap.** The `memory` keyword is accepted and meaningful for aliasing,
  but there is no separate memory region. See [Data Locations](/docs/language/data-locations).
- **Addresses are full locking bytecode**, variable length, not a fixed 20- or 32-byte hash. `payable` is a
  cosmetic no-op because every BCH address can receive value.
- **No gas metering.** There is no gas economy. Limits are on **bytecode size, stack size and operation
  cost per input** instead. See [Script Limits](/docs/compiler/script-limits).
- **Calldata** is reconstructed from the input's unlocking bytecode where sound, rather than being a
  first-class ABI blob.

### What this means in practice

| Solidity pattern | On SolidCash |
| --- | --- |
| Re-entrancy guard (`nonReentrant`) | Unnecessary; compiles, but there is nothing to guard |
| `msg.sender` for authorization | Works, but it is derived from the transaction's inputs; prefer `checkSig`. The compiler warns on every read |
| `block.timestamp` deadline | Works via `tx.locktime` / the block oracle |
| Pull-payment pattern | Still good practice for UTXO contention reasons |
| Unbounded loop over storage | Bounded by per-input operation cost, not gas |
| Upgradeable proxy | Supported through the built-in proxy profile (`upgrades.deployProxy`); custom delegate forwarding is experimental |

## 5. Contention: the UTXO cost that has no EVM analogue {#contention}

An EVM contract is a single account that any number of transactions can touch in the same block. A BCH
contract's state lives in **UTXOs, and a UTXO can only be spent once**. Two transactions spending the same
contract state UTXO conflict, and only one confirms.

This has no Solidity equivalent and it is the main thing to design around:

- Contract state is serialized by its master UTXO, so a globally shared contract has a throughput ceiling.
- SolidCash offers `split` and `merge` lifecycle functions to shard a contract into parallel threads and
  consolidate them again. See [Concurrency](/docs/guides/concurrency) and
  [Threading](/docs/sdk/threading).

## See also

- [Coming from Solidity](/docs/basics/solidity-parity) - the porting guide: what works unchanged, what changes
- [Types & Operators](/docs/language/types) - the integer, bytes and address models
- [Data Locations](/docs/language/data-locations) - `memory`, `calldata`, `storage` on a UTXO chain
- [Cryptography](/docs/language/cryptography) - keccak256, ecrecover and the BCH signature primitives
