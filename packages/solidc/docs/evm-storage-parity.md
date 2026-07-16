# EVM storage parity on solidcash

Status: **Tier-1 (assembly-storage) + OZ StorageSlot param-factory SHIPPED and runtime-sound.** Tier-2
(high-level state re-homed onto the slot model) is the open work. This doc was rewritten 2026-07-16 to
reflect shipped reality (the earlier "nothing implemented" text was stale) and to fold in two things: the
128-byte-commitment PACKING cost model, and the prerequisites the EVM-ABI-parity work retired.

The question was: can Solidity's storage model be mapped soundly onto solidcash, including the assembly that
manipulates storage slots directly (`sstore`/`sload` with derived slots)? Earlier this was called
"fundamentally out". It is not - it maps soundly, and the foundation is built.

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

## The cost model: pack into 128-byte commitments, minimize UTXOs (LOAD-BEARING)

Since the May 2026 upgrade a CashToken NFT commitment holds **128 bytes** (`compiler.ts commitmentLimit:
128`) = **~3-4 EVM words**. The parity model must exploit this: a naive `mapping(uint256 => uint256)
__evm_storage` with **one UTXO per touched slot** is the raw EVM cost shape and is wasteful on BCH. A
struct, a namespaced-storage group, or an array must NOT become N UTXOs. It maps onto whichever of the three
existing 128-byte-aware substrates fits, so a contiguous or packable region costs one UTXO, not one per word:

| EVM shape | Substrate (all already built) | 128B usage | UTXOs |
|---|---|---|---|
| declared vars; ERC-7201 namespaced struct fields; any **contiguous static slot run**; array elements `H(p)+i` | **packed register** (data NFT, bin-packed by ordinal, whole-commitment rebuild on write; `SymbolTableTraversal` ~591-704) | ~3-4 words per commitment | 1 per page, not 1 per slot |
| mapping entries `H(k.p)` (sparse keyspace) | **sorted-list entry** (the C2 model; `SortedList.ts`, `emitSorted*`) | `(slot, next, value)` in one commitment | 1 per live key |
| `bytes` / `string` / dynamic arrays (values > 32 bytes) | **chunk** (dynamic-storage.md) | 120B payload per chunk UTXO + a `uint32 len` header packed in a register | `ceil(len / 120)` |

Rules that fall out of this:

- **Contiguous static slot runs pack.** Declared vars already bin-pack into 128B data NFTs. ERC-7201
  namespaced structs (`$.slot := CONST`, then `$.f0/$.f1/$.f2` at `CONST+0/+1/+2`) and struct/array bases
  are the same shape - lower them to a **packed page** keyed by the base slot, reusing the register
  bin-packer, NOT to N `__evm_storage[base+i]` entries.
- **Sparse mapping slots ride the sorted list.** One 128B commitment per live key already carries
  `(slot, next, value)`; the EVM slot number `H(h(k).p)` is the logical label over that entry, not a new
  UTXO per word.
- **Values over 32 bytes ride the chunk model.** `bytes`/`string`/dynamic arrays already split into 120B
  chunks with the length authority in a register field.
- **One-UTXO-per-slot stays only for genuinely-sparse assembly slot math** (hand-written `sstore` at a
  keccak-derived scattered slot with no packable neighbours). Even there, a contiguous field group packs.

Net: EVM storage parity is a **logical slot-addressable VIEW** over the existing packed register + sorted
list + chunk substrates, chosen to minimize UTXO count. It is not a physical re-homing onto a flat
per-slot mapping. This matches the deep-research conclusion: make the hybrid EVM-slot-addressable and
sound, do not rebuild it.

## What is shipped (Tier-1 + slot-pointer), runtime-verified

- **Synthesized `__evm_storage`** (`LowerInlineAssembly.ts`): a computed / arbitrary (non-declared) slot in
  `sstore(slot,v)` / `sload(slot)` routes to a synthesized `mapping(uint256 => uint256) __evm_storage`
  (`evmStorageSlotKey` -> `MappingAssignNode` / `MappingAccessNode`; the `CollectionNode` is synthesized
  once if any slot routed). Runtime-sound (`EvmStorageFoundation.test.ts`): set in tx1 / read in tx2
  roundtrips; distinct slots independent; an untouched slot reads default 0 even when another slot has a
  live entry. Each touched slot rides the mapping entry-NFT covenant.
- **Declared-var slots decompose to packed vars** (`computeStorageLayout` + `resolveSlotFields`): a literal
  or `.slot` slot that holds declared vars stays the optimized register path (sub-word fields combined /
  decomposed), NOT `__evm_storage`. `x.slot` of a state var lowers to its constant slot number.
- **OZ StorageSlot param-factory idiom** (`LowerStorageSlotPointers.ts`): a `library` fn
  `f(bytes32 slot) returns (XSlot storage r){ assembly { r.slot := slot } }` is a slot-pointer factory;
  `XSlot storage d = StorageSlot.getXSlot(SLOT); d.value = v` / `d.value` rewrite to
  `__evm_storage[uint256(SLOT)]` with per-field-type casts. `.value` is a writable field (grammar);
  constant-key reads resolve (the SDK matches the entry, covenant re-derives + `OP_EQUALVERIFY`s the key so
  a wrong entry fails safe); high-bit slots write correctly (`uint(bytesN)` sign-pad). `erc7201(id)` lowers
  to `uint256(sha256(id))`.
- **uint256 / bool / bytes32 slots roundtrip fully.** **Address-valued** slots compile but the runtime
  roundtrip is out of scope: a BCH `address` is the full variable-length locking bytecode, not a 20-byte
  hash, so it cannot round-trip through a uint160 word.

Not built: the ERC-7201 **const-slot** factory (no param, `$.slot := CONST`); EVM-exact register layout past
a struct/array; sorted-list soundness re-homing of `__evm_storage`; Tier-2 high-level interop; sorted
value-type tail (string / unbounded-bytes leaves). See Phasing.

## What the EVM-ABI-parity work changed (prerequisites now retired)

The ABI byte-parity work (evm-abi-parity.md, shipped through commit `bab4efe9`) landed three things this
storage work was going to have to build from scratch:

1. **Compile-time REAL keccak.** `keccak256(literal)` folds via `@noble/hashes/sha3` (`FoldHashLiterals`);
   the selector path folds `keccak256(canonicalSig)[:4]` (`computeEvmFunctionSelector`). Byte-identical
   **constant** slot numbers (declared-var slots, struct/array bases, ERC-7201 constants) need exactly this,
   and it is now proven in codegen, not a claim. (This CORRECTS the earlier version of this doc, which said
   slot keccak lowers to sha256: PHYSICAL UTXO keys use sha256, but a CONSTANT slot's byte-identical EVM
   number is a real-keccak compile-time fold.)
2. **The EVM word / mapping-key preimage encoder.** `emitEvmWordFromUint` / `emitEvmAbiWord` (bytesN
   left-align; int/uint/address/bool right-align + sign-extend; 32-byte big-endian) is byte-verified against
   ethers/solc. The byte-identical LOGICAL mapping-slot preimage `H(h(k).p)` needs the same EVM word
   encoding; the on-chain primitive exists and the SDK mirror is a straight port.
3. **A differential conformance harness.** `packages/solidcash/test/conformance/` compiles one source under
   both solc (-> `@ethereumjs/evm`) and solidc (-> libauth) and asserts value/byte-identical results. Storage
   parity is testable the same way once the harness gains a stateful / multi-call extension.

So the SOUND behavioral core (native sha256 physical slots, no keccak on the hot path) was always reachable;
the ABI work specifically de-risked the OPTIONAL byte-identical-EVM-slot-number veneer and gave storage a
real test substrate. The `evmCompat` gate discipline (temporary, dropped once parity is green) is the model
this work follows too.

## The hash function: physical sha256 vs logical keccak

BCH has no native keccak. Measured cost (`Keccak256.test.ts` compute-budget bench): one input affords ~3
keccak block-permutations (~8M op budget at the 10,000-byte bytecode limit), spent as ONE keccak256 of up to
~407 bytes; a 2nd keccak call in the same input aborts. So in-script keccak on a storage hot path is
infeasible. This forces a split:

- **PHYSICAL slot (the UTXO key) uses native `sha256`** - cheap, on-chain re-derivable, collision-resistant,
  so distinct keys land on distinct entries and the covenant bracketing / key-check stays sound. Nothing
  outside the contract observes the physical slot number.
- **LOGICAL slot (the EVM slot number) uses keccak, off-chain / at compile time.** CONSTANT slots fold real
  keccak at compile time (free, unforgeable). RUNTIME mapping slots `H(h(k).p)` are the SDK's off-chain view;
  the physical UTXO key stays sha256. Real in-script keccak is confined to cross-chain interop with
  pre-existing keccak-derived data (a foreign Merkle path = `log2(N)` levels; a hash committed on Ethereum =
  1), which is niche and bounded.

This is behavioral parity, not byte-identical slot-number parity by default; the byte-identical logical layer
is the optional veneer above, reachable now that real-keccak folding + the EVM word encoder are shipped.

## Soundness

`__evm_storage` in Tier-1 is an ordinary solidcash mapping - a covenant-verified, permissionless-safe
keyed-UTXO store - so `sstore(s,v)` then `sload(s)` returns `v`, distinct slots are independent, and the
derivation is deterministic and collision-resistant: EVM storage semantics verbatim, per touched slot.

The one soundness gap to close for parity (P2): EVM flat slots ride an implicit global authenticated trie;
BCH has none. A plain mapping cannot prove a key is ABSENT, so negative-existence guards (`require(m[k] ==
0)` before a first write) can be spoofed by withholding the entry. The sorted-linked-list (C2) is the UTXO
substitute: absence is proven by bracketing (`pred.slot < H(k) < pred.nextKey`). Re-homing `__evm_storage`
onto the sorted list closes this; the 128B commitment already fits `(slot, next, value)`.

## Phasing

Priorities carry the PACKING lens above: each phase lowers to a 128B-aware substrate, never one-UTXO-per-slot.

- **P0 - doc + reality alignment (this rewrite). DONE.**
- **P1 - ERC-7201 / const-slot factory [DELIVERED, top ROI]. Design = PROMOTION to packed hidden state.**
  Shipped (commits 96aec43a scalar, f52ceb71 multi-scalar packing, 0974920d mapping): const-slot factory
  detection; scalar fields -> packed register (multi-scalar co-pack into ONE data NFT, VM-proven);
  mapping fields -> collection; dynamic string/bytes fields -> chunk var. Local-alias read + struct-rebuild
  write + inline scalar read all lower; e2e roundtrips green (`Erc7201Storage.test.ts`). Remaining follow-ups:
  nested struct fields (clean error), inline WRITE `factory().f = v` (OZ uses local-alias, so non-blocking),
  address-field runtime roundtrip (same 25-byte-lbc limit as the __evm_storage address slot).
  A no-param factory `f() returns (S storage $) { assembly { $.slot := CONST } }` (const RHS) is the ERC-7201
  namespaced-storage idiom. It is NOT the param-factory (`getXSlot(bytes32 slot)`, runtime slot) which stays
  the existing `__evm_storage[slot]` path. The const factory's struct is a FIXED group of fields, so
  **promote each field to hidden contract state, routed to its correct 128B-aware substrate** (this is
  `AstBuilder.buildFlattenedStructField`'s exact mapping, reused): scalar value type -> a hidden packed
  register `StateVariableNode` (fields of one struct co-pack into one data-NFT commitment = the packing win);
  `mapping` field -> a hidden `CollectionNode` (entry / sorted list); dynamic `string`/`bytes`/array field ->
  a hidden `isDynamic` var (chunk model). Promotion is not just packing - it is the only correct semantic: a
  mapping field CANNOT be a single `__evm_storage[base+i]` slot (it is a subspace `H(k.(base+i))`).
  Rewrite `_getX()._field` (inline) and the OZ-canonical `S storage $ = _getX(); $._field` (local alias,
  read + write) to the promoted state. The local-alias write desugars (AstBuilder) to a struct rebuild
  `$ = S(a0,a1,..)` which the pass maps to per-field `StateAssign`; whole-struct rebuild composes with
  register packing (one commitment rewrite). Physical slot number CONST is ignored (internal); byte-identical
  logical slot = the optional keccak veneer later. Implemented in `LowerStorageSlotPointers` (runs
  pre-`SymbolTableTraversal`, so injected vars pack). Phasing: **MVP-1** single-scalar struct
  (OwnableUpgradeable) -> **MVP-2** multi-scalar (packing proof, one data NFT) -> **MVP-3** mapping field
  (ERC20-balances). Unlocks ERC-7201, OwnableUpgradeable, ~37 OZ-upgradeable v5 bases, EACC. Today
  `$.slot := CONST` throws `YulNotLowerable` (`LowerInlineAssembly` ~982) -> misleading "control-flow/memory".
- **P3 - EVM-exact register layout [confirmed latent bug].** `stateVarByteWidth` returns 32 for a
  struct/array/mapping (`LowerInlineAssembly:127-135`), so `computeStorageLayout` advances the next var by
  one slot when EVM advances by the composite's full `storageSize()` (N words). A declared var after a
  `uint256[3]` gets the wrong EVM slot number; sub-word assembly then diverts to a disjoint cell. Fix the
  width to the full multi-word `storageSize()`, packing-aware.
- **P2 - sorted-list soundness re-homing.** Route `__evm_storage` (and Tier-2 mapping slots) through the C2
  sorted-linked-list so negative-existence guards are sound (bracketing). One 128B entry per live key.
- **P4 - Tier-2 high-level interop [large, multi-session].** Lay high-level state (vars / mappings / arrays)
  at their derived slots so `arr.push(...)` and `assembly { sload(H(p)+i) }` see the same entries. The
  logical slot VIEW over the packed register + sorted list + chunk substrates (packing-preserving), gated
  behind P1/P3 landing. ~45-48 corpus files, byte-exact caveat.
- **P5 - sorted value-type tail.** string / unbounded-bytes mapping leaves (currently fail closed);
  address/struct values already work and are VM-tested.

Byte-identical LOGICAL slot numbers (the SDK keccak veneer) is reachable any time after P1, reusing the ABI
encoder + real-keccak fold; fold it in only where a corpus contract exposes a raw slot number cross-chain.

## Tradeoffs

1. **Cost.** Native solidcash keeps simple state packed in one data-NFT commitment; the slot model is at most
   the EVM cost shape, but the packing rules above keep contiguous / packable regions at one UTXO per ~3-4
   words rather than one per word. It stays an opt-in mode where it is heavier than native.
2. **Per-contract mode**, auto-detected when a contract uses computed-slot `sstore`/`sload` or the const-slot
   factory (P1). It supersedes the literal-slot-to-var register mapping for that contract only.
3. **Slot-number divergence** (physical sha256 vs EVM keccak) is intentional, for the compute budget;
   invisible to a standalone contract. The byte-identical logical layer is the optional veneer.

## Status checklist

- [x] Feasibility: solidcash mappings take computed sha256/keccak-derived runtime keys.
- [x] Tier-1: computed-slot `sstore`/`sload` -> synthesized `__evm_storage`; runtime-sound roundtrip.
- [x] OZ StorageSlot PARAM-factory idiom (read + write, constant-key resolution, high-bit slots).
- [x] P0: this doc realigned to shipped reality + the packing cost model + the ABI prerequisites.
- [x] P1: const-slot (ERC-7201) factory -> promoted packed state (scalar register + mapping collection +
      dynamic chunk; multi-scalar co-packs into one data NFT). Nested-struct/inline-write/address-roundtrip deferred.
- [ ] P3: EVM-exact register layout past a struct/array.
- [ ] P2: `__evm_storage` re-homed onto the sorted list (negative-existence soundness).
- [ ] P4: Tier-2 high-level state on the slot model (logical view over register/sorted-list/chunk).
- [ ] P5: sorted string / unbounded-bytes value tail.
