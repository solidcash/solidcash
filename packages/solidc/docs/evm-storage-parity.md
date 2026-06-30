# EVM storage parity on solidcash

Status: DESIGN + Tier-1 proof-of-concept.

The question: can Solidity's storage model be mapped soundly onto solidcash, including the assembly that
manipulates storage slots directly (`sstore`/`sload` with keccak-derived slots)? Earlier this was called
"fundamentally out". It is not - it maps soundly, and proving so makes EVM storage a *feature* rather than a
wall.

## The EVM storage model is a mapping

EVM storage is `mapping(bytes32 slot => bytes32 value)` over a 2^256-slot space, with a *pure, deterministic*
slot-derivation function:

- A declared value var is at a fixed slot in declaration order; sub-word vars pack into one slot.
- `mapping(K => V) @ slot p` -> the element for key `k` is at `H(h(k) . p)` (key padded to 32 bytes,
  concatenated with the slot, hashed).
- `T[] @ slot p` -> the length is at `p`, element `i` is at `H(p) + i * size`.
- Nested mappings / arrays apply the rule recursively.

where `H` is the hash. Everything is pure computation (hash + concat + arithmetic), all of which solidcash
already has.

## The model: one mapping is the slot space

A contract in *EVM-storage mode* puts all storage in a single synthesized state mapping that **is** the slot
space:

```
mapping(uint256 => bytes32) __evm_storage;   // synthesized, one entry per touched slot
```

| EVM | lowering |
|---|---|
| `sstore(slot, v)` | `__evm_storage[slot] = bytes32(v)` |
| `sload(slot)` | `uint256(__evm_storage[slot])` |
| `uint256 s_x` (slot 0) | `__evm_storage[0]` (one entry = one packed 32-byte word) |
| `mapping(K=>V) m @ p`, `m[k]` | `__evm_storage[H(h(k) . p)]` |
| `T[] arr @ p`, `arr[i]` | `__evm_storage[H(p) + i * size]` |

A solidcash mapping already accepts a **computed runtime key** (verified: a key built from `keccak256`/
`sha256` + arithmetic works), so `sstore`/`sload` lower to runtime-keyed mapping writes/reads, and the
slot-deriving assembly lands on the same entries as the high-level access. They interoperate because they
share `__evm_storage`.

## Soundness

`__evm_storage` is an ordinary solidcash mapping - already a covenant-verified, permissionless-safe keyed-UTXO
store. EVM storage semantics are exactly: `sstore(s, v)` then `sload(s)` returns `v`; distinct slots are
independent; the derivation is deterministic and collision-resistant. The mapping provides all of this
verbatim. Therefore every Solidity storage construct - declared vars, mappings, nested mappings, dynamic and
struct arrays, and hand-written assembly slot arithmetic - has identical storage semantics. That is the
parity: **solidcash storage is EVM storage, with UTXOs as the slot cells.** No new soundness machinery is
introduced; each slot entry rides the existing mapping covenant.

The one divergence is the slot *number* (see next section), which is invisible to a standalone contract
because slot numbers are internal.

## The hash function: sha256 vs keccak256 (compute-budget evaluation)

EVM derives slots with `keccak256`. BCH has no native keccak: `keccak256` on solidcash is an **external
co-spend library** (OP_DEFINE/OP_INVOKE blob), which is computationally heavy - invoking it many times in one
input risks exhausting the per-input compute budget. So the load-bearing question for this model is: **how
often must keccak run in-script?**

### Measured cost (BCH-2026 VM)

A direct measurement (`packages/solidcash/test/Keccak256.test.ts`, "compute-budget bench") pins the numbers
along two axes. The side-car only *defines* the body; the `OP_INVOKE` executes in the **spending (main)
input** and consumes that input's operation-cost budget.

- **Cost scales per 136-byte message block** (~2.26M op cost/block): 32 B -> 1 block ~2.29M (21,116
  instructions, 41 hash-digest iterations); 200 B -> 2 blocks ~4.54M; 272 B -> 3 blocks ~6.78M; 408 B -> 4
  blocks, over budget. The per-input budget is `operationCostBudgetPerByte(800) * densityControlLength`,
  and density tracks the spent script size, so **padding raises the budget at ~800 per byte** (a 1000-byte
  pad adds ~808k). At the 10,000-byte consensus bytecode limit the budget tops out near ~8M op, which caps
  **one keccak256 at ~3 blocks (~407 bytes)**. (Matches `keccak-poc/README.md`.)
- **Distinct calls are capped at one per input.** The library blob `OP_DEFINE`s helper functions inside its
  invoked body, so a 2nd keccak256 call in the same input aborts ("previously-defined function
  identifier"). The ~3-block capacity is therefore reachable only as ONE call over a long message, not as 3
  separate calls.

So one input affords ~3 keccak block-permutations (~8M budget), spent as a single keccak256 of up to ~407
bytes. Real in-script keccak is expensive (a whole input budget for a few blocks), and the storage hot path
would need one per slot access - infeasible. The sha256-slot approach (zero in-script keccak for storage) is
not an optimization but a necessity.

The answer is **basically never for storage**, because slot hashing does not need to match Ethereum's slot
hashing - it only needs to be internally consistent and collision-resistant. So:

- **Slot derivation uses native `sha256`/`hash256`** (BCH opcodes, ~free). `mapping[k]` and `arr[i]` hash with
  sha256; the value is stored/read at that entry. Distinct keys -> distinct sha256 slots (collision-resistant)
  -> sound. The contract behaves identically to EVM; only the internal slot *number* differs, and nothing
  outside the contract observes it.
- **Assembly `keccak256(...)` used to derive a slot is lowered to `sha256`** in EVM-storage mode, so the
  hand-written slot math matches the high-level layout. `keccak256(abi.encode(slot))` -> `sha256(...)`; the
  result flows into `sload`/`sstore`, so it is a slot, not an externally-compared hash.

This is **behavioral parity, not byte-identical slot-number parity**. The two differ only if a contract
exposes a raw slot number to an off-chain consumer that recomputed it with real keccak - a cross-chain
inspection case, not a contract-logic case.

### When real keccak IS required in-script (and how little)

Real keccak is only needed when the contract must reproduce a value that was keccak-hashed *outside* and is
then compared on-chain:

| Operation | In-script keccak? | Why |
|---|---|---|
| Storage: declared vars, mappings, arrays, nested, packed slots | 0 | sha256 slots, internally consistent |
| Assembly slot math (`keccak256(abi.encode(p))` for a slot) | 0 | lowered to sha256 (it is a slot) |
| Internal commitments / ids (`hash` of on-chain data, compared on-chain) | 0 | app picks the hash; use sha256/hash256 |
| Native auth (checkSig / checkDataSig) | 0 | no keccak in the path |
| EIP-712 / Ethereum signature recovery | 0 in-script | recovery is inert on BCH; the message hash is SDK-side |
| Verifying an **existing Ethereum keccak Merkle tree** | ~log2(N) | each level hashes a node that depends on on-chain proof input |
| Reproducing a hash **committed on Ethereum** | 1 per check | must match the foreign keccak exactly |

So for **basic contract operations the in-script keccak count is zero** - storage, mappings, arrays, internal
hashing and native auth all use native sha256/hash256. Real keccak is confined to **cross-chain interop with
pre-existing keccak-derived data**, which is niche, and even there the count is bounded (a Merkle path is
`log2(N)` levels, and an app that owns its tree can build it with sha256 to drop to zero).

### What belongs on the SDK side (free of compute budget)

Any keccak whose **input is known to the transaction builder** moves off-chain: the SDK computes the digest
and passes it as an argument; the script only consumes the 32 bytes. This covers precomputed message hashes,
domain separators, salted commitments where the salt is chosen by the builder, and Merkle *roots*. The
script keeps only the hashing it must do to *verify* something against untrusted on-chain input - which, per
the table, is just the cross-chain-interop tail.

**Conclusion:** the storage-parity model does not move keccak load into the script. Slot hashing is sha256
(native, sound, behavioral parity). The heavy co-spend keccak stays reserved for explicit cross-chain hashing,
where the count is small and bounded, and much of even that is SDK-side.

### Option (undecided): lower keccak256 -> sha256 *globally*, not just slots

The analysis above keeps real keccak for the cross-chain tail. A blunter option is to lower **every**
`keccak256` to `sha256` - a pure rename, both produce 32 bytes - not only the slot-deriving ones. This eases
the gap maximally: any contract that hashes with keccak (ids, commitments, mappings, a Merkle tree it builds
itself) compiles and runs cheaply on native sha256, and the heavy co-spend keccak leaves the default path
entirely.

What it costs: any comparison of an in-script keccak result against a value hashed with **real** keccak
elsewhere (an existing Ethereum Merkle tree, a hash committed on Ethereum, an EIP-712 digest checked off-chain)
silently diverges. On a BCH-native contract that never touches Ethereum at runtime this is unobservable; it
only bites cross-chain interop.

It is sound (sha256 is collision-resistant; internal hashing stays self-consistent) but not elegant - it
redefines what `keccak256` means - so it must be gated and warned. Shapes:
- a compiler flag (`keccak256AsSha256`), off by default, that rewrites `keccak256(x)` -> `sha256(x)` and emits
  a per-use warning; or
- on by default under solidityImportCompat (porting), warned, with a `realKeccak256`-style opt-out for the
  cross-chain cases.

Trade: it subsumes the slot-keccak->sha256 rule (with it on, slot hashing is sha256 for free) and clears
keccak-heavy ports at near-zero compute, at the price of cross-chain hash-value parity - made explicit by the
warning. Status: proposed, **not decided**.

## Scope - two tiers

- **Tier 1 (assembly-storage mode):** synthesize `__evm_storage`; route `sstore`/`sload` with a *computed*
  slot to it (a literal / `.slot` slot stays the optimized P4/P7b path - a declared var). Proves the slot-
  space emulation; compiles contracts that manage storage purely through assembly. This is the PoC below.
- **Tier 2 (full parity):** also lay high-level state (vars / mappings / arrays) into `__evm_storage` at their
  derived slots, so `arr.push(...)` and `assembly { sload(sha256(p)+i) }` see the same entries. This is what
  compiles `EVMStorageDynamicArrayStruct`. It is a storage-backend re-homing onto the slot model - large, and
  gated behind Tier 1 landing.

## Tradeoffs

1. **Cost.** Native solidcash keeps simple state packed in one data-NFT commitment; EVM-storage mode is one
   UTXO per touched slot (packing within a slot is preserved - a packed slot is one entry holding the word).
   It is the EVM cost shape, heavier than native, so it stays an opt-in mode, not the default.
2. **Per-contract mode**, auto-detected when a contract uses computed-slot `sstore`/`sload` (or opt-in). It
   supersedes the P4/P7b literal-slot->var mapping for that contract only.
3. **Slot-number divergence** (sha256 vs keccak) is intentional, for compute budget; documented above.

## Status

- [x] Feasibility verified: solidcash mappings take keccak/sha256-derived computed runtime keys (compiled).
- [ ] Tier 1 (design only - NOT implemented): computed-slot `sstore`/`sload` lower to a synthesized
      `__evm_storage` mapping. Awaiting a go/no-go decision.
- [ ] Tier 2: high-level state re-homed onto the slot model.
- [ ] keccak256 -> sha256 global option: proposed, undecided.

Nothing here is implemented yet; this is a design + feasibility writeup pending decisions.
