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
| mapping entries `H(k.p)` (sparse keyspace) | **entry NFT** at the collection's deterministic address, slot id (key) in the commitment; C2-SORTABLE opt-in for absence proofs (`SortedList.ts`, `emitSorted*`) | 1 per live key | 1 per live key |
| `bytes` / `string` / dynamic arrays (values > 32 bytes) | **chunk** (dynamic-storage.md) | 120B payload per chunk UTXO + a `uint32 len` header packed in a register | `ceil(len / 120)` |

Rules that fall out of this:

- **Contiguous static slot runs pack.** Declared vars already bin-pack into 128B data NFTs. ERC-7201
  namespaced structs (`$.slot := CONST`, then `$.f0/$.f1/$.f2` at `CONST+0/+1/+2`) and struct/array bases
  are the same shape - lower them to a **packed page** keyed by the base slot, reusing the register
  bin-packer, NOT to N `__evm_storage[base+i]` entries.
- **Sparse mapping slots are entry NFTs, directly located by slot id.** One entry per live key at the
  collection's deterministic address (slot id in its commitment); the EVM slot number `H(h(k).p)` is the
  logical label over that entry. C2 sorting is an opt-in absence-proof overlay, not a location mechanism.
- **Values over 32 bytes ride the chunk model.** `bytes`/`string`/dynamic arrays already split into 120B
  chunks with the length authority in a register field.
- **One-UTXO-per-slot stays only for genuinely-sparse assembly slot math** (hand-written `sstore` at a
  keccak-derived scattered slot with no packable neighbours). Even there, a contiguous field group packs.

Net: EVM storage parity is a **logical slot-addressable VIEW** over the existing packed register + entry-NFT
(C2-sortable) + chunk substrates, chosen to minimize UTXO count. It is not a physical re-homing onto a flat
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

Since shipped (see Phasing): the ERC-7201 **const-slot** factory (P1); EVM-exact register layout past a
struct/array (P3); the Tier-2 mapping-slot assembly idiom bridge (P4). P2 (sorting the slot space) was
DROPPED by design - it needs no absence proof (see Soundness). Remaining: deeper Tier-2 (nested mappings /
array-element idiom); the sorted-MAPPING string-value tail (P5, a C2-feature niche). See Phasing.

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

## The slot-p anchor: array length, and the mapping-count enumeration option

EVM stores metadata at the variable's anchor slot `p` (grounded in `/Code/solidity`):
- **dynamic array `T[] @ p`** -> slot `p` holds the LENGTH; `arrayLengthFunction` is `length := sload(slot)`
  (`YulUtilFunctions.cpp:1328`); elements at `H(p)+i`. This is the enumeration handle.
- **mapping `@ p`** -> slot `p` holds NOTHING. `mappingIndexAccessFunction` is `mstore(0,key); mstore(0x20,
  slot); dataSlot := keccak256(0,0x40)` (`YulUtilFunctions.cpp:2762-2766`) - `slot` is ONLY a hash input, never
  sload/sstore'd, so `p` stays 0. EVM mappings are deliberately NOT enumerable; devs bolt on a separate key
  array (OpenZeppelin `EnumerableMap`). (That exact idiom is what the P4 bridge recognizes - it matches the real
  compiler's emitted code.)

SolidCash parity notes:
- **Array length** is kept in a register field (`A$len`, `docs/dynamic-storage.md`), reachable via high-level
  `arr.length`. The length is NOT physically at `__evm_storage[p]`, so a hand-written `sload(arr.slot)` reads 0
  rather than the length - a niche divergence (Solidity's own `arr.length` compiles to `sload(p)`, but explicit
  assembly length-reads are rare). Routing `sload(<dyn-array>.slot)` -> `arr.length` would close it; deferred as
  low-value (the length is already available high-level).
### Trustless mapping enumeration - evaluated (proposed `enumerable mapping` extension)

SolidCash has mapping ITERATION (absent in Solidity). Today it is a caller-chosen PARTIAL WINDOW
(`collection-iteration.md`): the loop is `i < __internal__collectionIterCount_N`, an untrusted UNLOCKING ARG,
and the SDK picks which entry NFTs to co-spend. There is NO on-chain completeness check, so it is sound for
SIGNED / permissioned use (the signer chose an honest window) but NOT trustless "iterate ALL entries" - an
attacker can pass a smaller count and OMIT entries. The idea: store a live ENTRY COUNT at the mapping's master
slot (EVM leaves it 0) and require iteration to co-spend exactly N == count entries. Evaluation:

- **Soundness reduces to COUNT INTEGRITY.** "Co-spend N == count" is sound iff count equals the number of
  live, distinct-key entries. That requires (a) the count in the ALWAYS-PRESENT register / data NFT (a hidden
  `<map>$count` field, like a dynamic array's `A$len`) - NOT a withholdable entry UTXO, else the count itself
  is omittable; (b) EVERY insert/delete updates it atomically on ALL codegen paths; (c) NO duplicate-key
  entries - uniqueness on insert = an absence proof = the C2 sorted list. So an enumerable mapping is built ON
  C2.
- **DECISION: LINKAGE ONLY, drop the count (2026-07-16, user).** The count duplicates work the sorted list
  already does, and placing it at the mapping's master UTXO would add GLOBAL write contention (every insert/
  delete rebuilds that one commitment) that the per-key entry UTXOs otherwise avoid - plus a corruptible
  redundant source of truth whose stale-LOW desync would silently OMIT. The C2 list already proves completeness
  by LINKAGE and is self-contained. Structure (`SortedList.ts`): commitment = `slot(32) ++ nextKey(32) ++
  value`; a HEAD sentinel at slot 0 (always present, `:85,141`); tail = `nextKey == 0` (+inf). Sound iteration:
  co-spend HEAD then follow the chain to the tail, verifying HEAD.slot==0, each entry.slot == prev.nextKey
  (contiguity - a skipped entry breaks the link), and last.nextKey==0 (completeness - reached the tail); each
  entry address/category-checked (no foreign substitute). Omission/truncation/substitution/duplicate all fail
  closed. EXTRA CODE is modest and NON-hashing: per entry ~2-3 opcodes over the read it already does - one
  `OP_SPLIT` to lift `nextKey`, one `OP_EQUALVERIFY` for `slot == expectedNext`, carry `nextKey` as the new
  expectedNext; plus O(1) setup (co-spend HEAD + `slot==0`) and teardown (`expectedNext == 0`). Cost is +1
  co-spent UTXO (the HEAD) and a per-iteration spend of the HEAD sentinel - contention only at iteration time
  and on head-adjacent inserts, far less than the count's every-write master-UTXO contention. So NO `.length`
  in O(1) (a count would be needed for that) - an acceptable trade.
- **Delete semantics must be reconciled.** C2 delete = NULLIFY (node stays). A nullified node is a live UTXO
  not logically present, so either the count/iteration must skip default-valued nodes (and the covenant must
  verify non-default per co-spent entry, else a nullified node substitutes for a real one) or delete must
  SPLICE (re-link predecessor.next, more covenant work) so count == physical == iterable. Splice is cleaner
  for enumeration; nullify bloats (dead nodes accumulate, never shrink, inflating every iteration).
- **TX-SIZE / COMPUTE CEILING (the load-bearing practical limit).** Trustless full enumeration co-spends ALL N
  entries (+ the HEAD) in ONE transaction. For a large mapping (millions of USDT balances) that overflows the
  tx-size and per-input compute limits regardless of the completeness mechanism. So enumeration is only
  feasible for BOUNDED / small collections (admin sets, participant lists), NOT a general balances primitive.
- **KEY RECOVERY (separate cost, note).** A C2 commitment stores `slot = H(key)`, not the raw key, so
  `for (key, value of m)` must recover the key: the SDK (which knows all keys while building the tx) supplies
  each as an unlocking arg and the covenant verifies `H(key) == slot` - ~1 native `sha256` per entry (cheap,
  not keccak). Orthogonal to completeness.

Verdict: an OPT-IN `enumerable mapping` built on C2, proving completeness by LINKAGE ALONE (no count, no master
UTXO, no global write contention), is sound and worth building for BOUNDED collections. Splice-delete keeps the
chain clean (nullify would bloat it). The DEFAULT `mapping` stays Solidity-parity: not enumerable, slot p = 0,
no overhead.

## Soundness - and why the slot space does NOT need a sorted linked list

`__evm_storage` is an ordinary solidcash mapping - a covenant-verified keyed-UTXO store - so `sstore(s,v)`
then `sload(s)` returns `v`, distinct slots are independent, and the derivation is deterministic and
collision-resistant: EVM storage semantics verbatim, per touched slot. Every element is DIRECTLY located by
its slot id: entries of one collection share that collection's deterministic P2SH address, and each entry
carries its slot id (key) in its commitment, so `__evm_storage[slot]` is found by scanning that address for
the entry whose committed key == slot. No linked-list traversal is needed to FIND an element.

The sorted-linked-list (C2) exists for exactly one thing: an ABSENCE proof (bracketing `pred.slot < H(k) <
pred.nextKey`), which stops the OMISSION attack - withholding an existing entry so a read sees "absent -> 0"
(breaking a `require(x == 0)` guard) or a write mints a duplicate. That attack only applies to storage held
in withholdable per-key UTXOs. It does NOT apply to the slot space in general, because the storage that
actually needs absence proofs is covered elsewhere:

- **Declared vars** live in the data NFT (register), a MANDATORY co-spend+recreate (`requiredNftIndices`).
  Their value cannot be withheld, so `require(admin == 0)`-style guards are sound with zero absence machinery.
- **Mappings** are the withholdable case, and the EXISTING C2 opt-in sorted list (`docs/sorted-mapping-c2.md`)
  is precisely for them (balances/allowances/owners). After P4 an assembly mapping-slot access routes to the
  SAME high-level mapping collection, so opting that mapping into C2 makes the assembly path sound too.
- **`__evm_storage`** - after P1 (ERC-7201 -> promoted register/collection) and P4 (mapping idiom -> the
  high-level mapping) the residual is only genuinely-raw, non-declared computed slots. A negative-existence
  guard on such a raw slot is vanishingly rare; a contract that needs one should use a declared mapping
  (C2-sortable), not a raw slot.

So sorting the whole 2^256 slot space by default would pay a bracketing co-spend on every access to cover a
case that is already sound (declared vars) or better expressed as a mapping (C2). It is dropped by design
(see P2). The only residual, documented limitation: a raw permissionless `require(sload(rawSlot)==0)` guard
inherits the plain-mapping omission concern - niche, and the sound path is a declared C2 mapping.

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
- **P3 - EVM-exact register layout [DELIVERED].** `packWords`/`compositeSlotWords` (`LowerInlineAssembly`):
  a fixed array `T[k]` and a struct occupy their full multi-word EVM footprint (packing sub-word members
  EVM-exactly) and never pack with a neighbour, so a var after `uint256[3]` gets EVM slot 3 (was 1) and its
  literal-slot assembly interops with the high-level var. e2e `EvmStorageLayout.test.ts`.
- **P4 - Tier-2 high-level interop [DELIVERED, mappings].** Two parts shipped: (1) `computeStorageLayout`
  merges COLLECTIONS in source declaration order, so every state member (incl. mappings/arrays) gets its EVM
  slot - a mapping's slot is known and a scalar after a mapping is EVM-correct. (2) The EVM mapping-slot
  assembly idiom bridges to the high-level mapping: single-key (`mstore(0,k); mstore(32,m.slot);
  sload/sstore(keccak256(0,64))`, inline AND the canonical `let slot := keccak256(0x00,0x40)` form) AND
  NESTED (`allowances[a][b]` double-keccak: the first keccak is the partial `m[a]`, the second extends to
  `m[a][b]`) - assembly and high-level share the entry collection, bidirectional (`EvmStorageTier2.test.ts`);
  the dead keccak binding is dropped (no on-chain keccak). This covers the vast majority of hand-written
  storage assembly (mapping access dominates). REMAINING (lower-value extensions, not the common case):
  dynamic-ARRAY element idiom `sload(add(keccak256(p),i))` (needs single-word-keccak array-base tracking +
  add-offset recognition + high-level array routing - rare in real code, most array access is high-level);
  struct-field slot math past a composite base.
- **P2 - sorted-list soundness re-homing [DROPPED BY DESIGN].** The premise was wrong: the slot space does
  not need absence proofs (see Soundness above). Elements are directly located by slot id at a deterministic
  address; declared-var guards are sound via the always-present register; mapping guards use the existing C2
  opt-in (and after P4 the assembly path shares that collection). Sorting the whole slot space would be pure
  overhead. Not implemented.
- **P5 - sorted value-type tail [DEFERRED, niche].** This is an enhancement to the OPT-IN C2 sorted-MAPPING
  feature (a sorted mapping whose VALUE is an unbounded `string`/`bytes`), orthogonal to storage parity -
  especially once P2 is dropped (the slot space does not use the sorted list). A sorted entry's 128B
  commitment holds slot(32)+next(32)+value(<=64), so a >64-byte value fails closed (`sortedValueKind` null,
  `SortedMappingCodegenPendingError`); closing it needs the dynamic-storage chunk model spliced into the
  sorted-entry value (value -> chunk pointer + length; SDK derives the run). Low value-per-complexity for a
  rare combination (sorted mapping + string value) - documented, not built. `int`/`bytesN`/`address`/`struct`
  values already work and are VM-tested.
  `bytesN`/`address`/`struct`/`int` values already work and are VM-tested.

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
- [x] P3: EVM-exact register layout past a struct/array (packWords/compositeSlotWords; e2e verified).
- [x] P4: declaration-order EVM slots incl. collections + the mapping-slot assembly idiom (single-key inline +
      canonical let-bound + NESTED double-keccak) bridged to the high-level mapping, bidirectional. Covers the
      common hand-written-storage case. Lower-value extensions remain: dynamic-array element idiom, struct-field
      slot math.
- [x] P2: DROPPED BY DESIGN - the slot space needs no absence proof (declared vars = always-present register;
      mappings = existing C2 opt-in; raw slots directly located by slot id). Sorting it would be pure overhead.
- [~] P5: sorted string / unbounded-bytes value tail - DEFERRED as a niche C2-sorted-MAPPING enhancement (not
      the slot space, and orthogonal to storage parity once P2 is dropped). Needs the chunk model spliced into
      the sorted entry value; low value-per-complexity, documented rather than built.
