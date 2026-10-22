---
title: EVM Storage & ERC-7201 Compatibility
---

SolidCash does not run an EVM or store a flat `2^256` array of 32-byte words. It does understand the storage
assembly generated and commonly written for Solidity contracts. The compiler resolves supported `sload`,
`sstore`, `.slot`, OpenZeppelin `StorageSlot`, and ERC-7201 shapes into authenticated state NFTs.

This is a compile-time bridge over the native [state storage model](./storage-model.md), not an EVM emulator.
The resulting transaction still has to co-spend and recreate the required data, entry, or chunk NFTs. The bridge
works in native compiles and under `evmCompat`.

:::caution Experimental
This page lists the storage shapes the compiler supports. Other Solidity storage shapes are experimental in this
release: most fail with a lowering diagnostic, and one that compiles still needs a test of every path across at
least two state transitions.
:::

## Logical slots and physical state

The compiler preserves EVM *logical* layout where assembly can observe it, while choosing an efficient BCH
substrate for the actual value:

| Solidity storage shape | Physical SolidCash substrate |
| --- | --- |
| Declared scalar and packed value fields | One or more bin-packed data NFTs |
| Declared mapping entry | The mapping's authenticated [vmap](./verified-mappings.md) entry NFT |
| Dynamic `bytes`, `string`, or array data | Length authority plus 120-byte chunk NFTs |
| Recognized ERC-7201 namespace fields | Hidden packed fields, vmaps, or chunks according to field type |
| Arbitrary `uint256` slot | Hidden `mapping(uint256 => uint256) __evm_storage` vmap |

Contiguous values therefore do not cost one UTXO per EVM word. A 128-byte commitment can carry several words,
and a namespace's scalar fields can share one data NFT. Sparse values still use one authenticated entry per live
key. The physical collection key is BCH-native; the EVM slot number remains a logical label visible to assembly.

The SDK reads the emitted `stateLayout`, discovers all required UTXOs, supplies vmap presence or exclusion proofs,
and derives the new commitments. Do not reconstruct this routing from Solidity declarations in application code.

## Declared state slots

For declared state, `.slot` and `.offset` use Solidity declaration order and packing rules. Sub-word values which
share an EVM word are combined by `sload` and decomposed by `sstore`:

```solidity
contract Packed() {
    uint128 low;
    uint64 middle;
    uint64 high;

    function replaceWord(uint256 word) public {
        assembly {
            sstore(low.slot, word)
        }
    }

    function readWord() public view returns (uint256 word) {
        assembly {
            word := sload(low.slot)
        }
    }
}
```

Supported packed leaves include bounded integers, user-defined value types over them, `bool`, enums, and
`bytesN`. Writes apply the destination type's cleaning and truncation rules. Fixed arrays, structs, nested value
structs, and array-in-struct layouts occupy their full EVM word ranges; constant `add(value.slot, n)` sub-slot
reads and writes rebuild the corresponding high-level fields.

A value after a multi-word fixed array or struct receives the same logical slot number it would receive in
Solidity. The values are still physically packed into NFT commitments rather than EVM storage words.

:::caution
A BCH `address` is full variable-length locking bytecode, not an EVM `uint160`. Do not expect an address-valued
raw storage word or `StorageSlot.AddressSlot` to round-trip a P2PKH/P2SH locking bytecode. Keep addresses in native
declared `address` state and access them at the high level.
:::

## Arbitrary raw slots

An `sload(slot)` or `sstore(slot, value)` which does not resolve to declared state uses a compiler-generated
`__evm_storage` mapping:

```solidity
contract RawSlots() {
    function write(uint256 slot, uint256 value) public {
        assembly { sstore(slot, value) }
    }

    function read(uint256 slot) public view returns (uint256 value) {
        assembly { value := sload(slot) }
    }
}
```

Each live slot is a vmap entry. A read of an untouched slot receives `0` only after the covenant verifies the
entry is absent; a transaction author cannot hide an existing entry. Distinct slots remain independent. Inspect
`artifact.stateLayout.collections` for `__evm_storage` when tooling needs to identify this fallback.

The raw table stores `uint256` words. Prefer native state declarations for composite or variable-length values,
both for type safety and for denser storage.

## Mapping-slot assembly

The compiler recognizes Solidity's standard mapping preimage sequence and routes it to the declared mapping
rather than creating a second raw-slot entry:

```solidity
contract Balances() {
    mapping(uint256 => uint256) balances;

    function write(uint256 key, uint256 value) public {
        assembly {
            mstore(0x00, key)
            mstore(0x20, balances.slot)
            let entrySlot := keccak256(0x00, 0x40)
            sstore(entrySlot, value)
        }
    }
}
```

Inline and `let`-bound forms are supported, as is the canonical double-keccak derivation for nested mappings.
Assembly writes are visible through high-level `balances[key]` reads and high-level writes are visible through
the assembly form. The physical access uses the same vmap entry and exclusion proof as an ordinary mapping access;
the expensive EVM keccak is not executed on chain for a recognized pattern.

Pattern recognition is intentionally structural. Keep ported storage assembly close to solc's canonical
`mstore`/`keccak256` spelling. Ambiguous pointer arithmetic is rejected or treated as an explicit raw-slot access,
never silently aliased to an unrelated declared mapping.

## Dynamic arrays

For a declared dynamic array:

- `sload(array.slot)` reads its length;
- `sstore(array.slot, n)` resizes a **fixed-width-element** array, truncating or zero-filling its packed blob;
- `keccak256(array.slot) + i` in the canonical Yul pattern addresses `array[i]`; and
- an out-of-range element `sload` returns the EVM default word `0`.

```solidity
uint128[] values;

function resizeAndSet(uint256 n, uint256 i, uint128 value) public {
    assembly {
        sstore(values.slot, n)
        mstore(0x00, values.slot)
        let element := add(keccak256(0x00, 0x20), i)
        sstore(element, value)
    }
}
```

Size the array before writing an element. Raw resize of a variable-width-element array such as `string[]` fails
closed; use high-level `push`, `pop`, `delete`, and element assignment for that shape.

## Dynamic bytes and strings

`sload(bytesValue.slot)` exposes the EVM base-slot encoding:

- fewer than 32 bytes: data in the high bytes and `2 * length` in the low byte;
- 32 bytes or more: `2 * length + 1`; and
- empty: `0`.

The compiler recognizes a constant short-value `sstore` encoding and `sstore(slot, 0)` clearing. It also recognizes
the canonical long marker followed by word writes at `keccak256(slot) + i`, lowering the data into SolidCash chunk
storage. Arbitrary sparse mutation of EVM byte-array words is not a general-purpose byte-storage API; use the
high-level `bytes`/`string` operations when the exact assembly shape is not required for a port.

## OpenZeppelin `StorageSlot`

The parameterized factory idiom is lowered to the raw slot table:

```solidity
library StorageSlot {
    struct Uint256Slot { uint256 value; }

    function getUint256Slot(bytes32 slot)
        internal pure returns (Uint256Slot storage result)
    {
        assembly { result.slot := slot }
    }
}

contract Config() {
    bytes32 constant LIMIT_SLOT = keccak256("app.limit");

    function setLimit(uint256 value) public {
        StorageSlot.getUint256Slot(LIMIT_SLOT).value = value;
    }
}
```

Both the inline `.value` form and a local `XSlot storage pointer` alias are supported. Constant keys, including
top-bit-set `bytes32` hashes, are recorded in the artifact so the SDK can find the entry without a caller-provided
key. `uint256`, `bool`, and `bytes32` slot values have the intended word round-trip; the BCH-address warning above
still applies to `AddressSlot`.

The OpenZeppelin overload which aliases a native storage reference, such as `getStringSlot(string storage ref)`,
is lowered as a direct alias of that state value rather than a copy.

## ERC-7201 namespaced storage

SolidCash recognizes the common no-argument namespace factory:

```solidity
library AppStorage {
    struct Layout {
        uint256 count;
        mapping(address => uint256) balances;
        string name;
    }

    bytes32 constant SLOT = keccak256("app.storage.Main");

    function layout() internal pure returns (Layout storage result) {
        assembly { result.slot := SLOT }
    }
}
```

Scalar fields are promoted to hidden packed state, mapping fields to hidden vmaps, and supported dynamic fields to
chunk-backed state. Reads, writes, read-modify-write operations, local storage aliases, contract-method factories,
and factories reached through expanded modifiers use those promoted fields. The factory itself is consumed during
lowering and is not emitted as a callable ABI function.

Use `erc7201("namespace")` when source needs the specification's slot formula explicitly. It returns the
EIP-7201 `uint256` slot:

```solidity
uint256 constant APP_SLOT = erc7201("example.main");
```

A literal or constant-string namespace is folded to real Keccak at compile time and is byte-identical to the
EIP-7201 formula. A runtime string expression lowers to the full formula and therefore carries the runtime Keccak
cost and sidecar requirements described in [Computation Sidecars](./computation-sidecars.md). The same builtin is
accepted in Yul.

`contract C layout at <base>` is accepted for source compatibility and has no effect on the NFT layout. When the
compiler can evaluate the base, it offsets the EVM slot numbers that `.slot`, `sload` and `sstore` see, as in
Solidity; otherwise the compiler warns and the slot numbers start at zero.

## Porting and security checklist

- Compile imported Solidity with `evmCompat: true`; inspect warnings and the emitted state layout.
- Treat the artifact as the storage schema. Hidden namespace and raw-slot collections are part of deployment.
- Preserve canonical Yul mapping/array derivation shapes so the compiler can bind them to native state.
- Prefer declared native `address`, mapping, array, string, and bytes state over raw words in new code.
- Never assume EVM physical storage proofs, RPC slot inspection, or `eth_getStorageAt` exists on BCH.
- Test every storage-assembly path across at least two state transitions; compile success alone is not a
  persistence proof.
- A construct outside the documented bridge should fail with a lowering diagnostic. Do not replace that failure
  with caller-supplied unauthenticated state.

See [Inline Assembly](./assembly.md) for the rest of the Yul surface and
[Solidity Import Compatibility](/docs/compiler/solidity-import-compat) for the complete porting pipeline.
