# Deferrals

A running log of features/fixes that were **investigated and intentionally deferred** - scoped enough to know
roughly what they'd take, but not shipped because the value/risk/effort did not justify it at the time. This is
the "we looked, here's why not yet, here's the trigger to revisit" list, distinct from unknown/unscoped gaps.

Related: `examples/solidity-corpus/ATTENTION.md` (autonomous-grind decisions + soundness caveats),
`docs/platform-differences.md` (BCH-vs-EVM primitives), `docs/solidity-gap-analysis.md`.

Format per entry: **what**, **why deferred**, **what it'd take**, **revisit if**.

---

## bytes / string `memory` PARAMS as `__yulmem` pointers (assembly interop)  — 2026-07-15

**What.** Local `bytes` buffers now lower to `__yulmem` pointers (commit `3cadcba7`, see
`docs/experimental-memory-model.md`), but a `bytes`/`string` **parameter** used inside inline assembly stays
value-copy, so `add(p, 0x20)` / `keccak256(p, len)` / `mcopy(add(p, ..), ..)` fail with a `bytes+int` type error.
Corpus files: `keccak_optimization_bug_string.sol`, `mcopy.sol`, `mcopy_empty.sol` (~3, all `inlineAssembly/`).

**Why deferred.**
- **Regression risk (high).** Materializing a bytes param into a pointer would bypass the
  `parseBytesPtr` / `bytesMemorySlice` bridge in `LowerInlineAssembly` that backs the signature-split idiom
  (`byte(0, mload(add(sig, 96)))`) and other bridge-handled param reads. Distinguishing "needs a real pointer"
  (mstore/mcopy/variable-length keccak) from "bridge-handled read" can't be done cleanly in `LowerMemoryModel`,
  which runs BEFORE the assembly lowering that owns the bridge.
- **Value (low).** These are EVM-memory-layout-idiosyncratic edge tests, not real contracts:
  `keccak_optimization_bug_string` hashes the *length word* via the pointer (a keccak-optimizer regression test);
  `mcopy` writes an *uninitialized* named-return bytes. They are compile-only corpus points and would not run
  EVM-faithfully on BCH anyway (BCH-native little-endian + sha256/keccak alias).

**What it'd take.** Re-add a Yul-ref trigger detector + a **Yul-aware remap** (a `YulBlockNode` is not a main-AST
`Node`, so the existing `remapNames`/analysis can't reach param references inside assembly - this is most of the
`collectYulRefs` machinery removed in the stage-4 taint lift) + a bytes/string deserialize loop; extend
`materializeParams`; and gate it so bridge-handled reads still take the bridge (else the signature idiom breaks).

**Revisit if.** A REAL contract (not an edge test) needs assembly to mutate or variable-length-hash a
`bytes`/`string` param's buffer.

---

## Uninitialized named-return bytes  — 2026-07-15

**What.** `function f(..) returns (bytes memory dst) { assembly { mcopy(add(dst, 0x20), ..) } }` - `dst` is a
named return never allocated with `new bytes(n)`; assembly writes into it. Corpus: `mcopy.sol`.

**Why deferred.** EVM-memory-layout-specific: in EVM `dst` points at the free-memory region and the assembly
builds the value in place. There is no BCH-native analog without the param-pointer machinery above, and it shares
that item's low value. Bundled with the bytes/string-param deferral.

**Revisit if.** The param-pointer item is taken up (this rides on the same materialization).

---

## Compound byte writes on a converted bytes buffer  — 2026-07-15

**What.** `b[i] += v` / `b[i] |= v` on a `bytes` buffer that otherwise converts to a `__yulmem` pointer. The
AstBuilder keeps compound `op=` byte writes on the whole-blob value-copy rebuild (`DesugarLocalBytesElementWrite`
only relocates the plain `=` form), so such a buffer falls back to value-copy.

**Why deferred.** Rare (byte compound-assignment is uncommon), and the value-copy path is correct - only the
pointer optimization is missed. Not worth a read-modify-write byte-splice path yet.

**Revisit if.** A contract hot-path does compound byte writes on a buffer it also drives via assembly.

---

## External-call target: DIRECT method call on a memory-COPY struct field  — 2026-07-15

**What.** `Job memory job = jobs[id]; IFoo(job.token).method()` - a plain-`address` field of a `memory` struct
COPY, cast + called directly. `SynthesizeExternalAddressLocals` now hoists `IFoo(<state chain>)` (struct/array/
mapping field of a self-pinned state root - `castChainTarget`) and `IFoo(<param field>)` (caller-witness -
`castParamFieldTarget`), which unblocked the EACC Marketplace (`JobPost storage job = jobs[id]`, a storage
pointer AstBuilder inlines to `jobs[id].token`) and Unicrow (`IERC20(input.currency).balanceOf`, a param field).
The remaining hole is a `memory` copy: `job` is a real local (value-copy), so `job.token` is neither a
self-pinned state chain (root is a local, not a collection) nor param-rooted.

**Why deferred.**
- **Soundness subtlety.** A memory copy can be modified before the call (`job.token = <caller value>`), so hoisting
  `job.token` could pin a caller-influenced value where the author intended the state value - the exact forgery
  `extcall-target-pinning.md` forbids. Sound handling needs a non-modification proof (dataflow) or a rewrite of
  `job.token` -> `jobs[id].token` (only valid when `job` is a read-only copy).
- **Low remaining value.** The real EACC contracts do not hit it: the direct method-call form is rare, and the
  common wrapped form `SafeERC20.safeTransfer(IFoo(escrow.currency), ..)` already works - the SafeERC20 inline
  binds the token to a local, which codegen sources as a bare local (the `local-from-statechain` path). This is
  the same "memory-local-from-state provenance" deep slice flagged as deferred elsewhere (reassignable storage
  ptr / `[[struct_array_lvalue_grind_2026_07]]`).

**What it'd take.** A per-function memory-local alias map (`local -> state chain`, gated on the local being
assigned once from a state chain and never field-written/reassigned), applied BEFORE `LowerMemoryModel` obscures
the assignment; then `castChainTarget` handles the rewritten form. OR per-call-site hoisting (insert
`__extaddr = job.token` just before the call, where `job` is in scope) instead of body-top hoisting.

**Revisit if.** A real contract makes a DIRECT (non-SafeERC20-wrapped) external call on a `memory`-copy struct
field and it is the last compile blocker.

---

## `mapping(K => Struct)` NESTED struct-field write  — 2026-07-15

**What.** `m[k].nested.field = v` where `m` is a `mapping(K => Struct)` and `nested` is a struct-typed field
(e.g. `mapping(uint => Post); jobs[id].roles.creator = v`). The packed struct-ARRAY form was fixed (commit
38a79ceb, `rebuildStructWithChain` in the packed-array element handler), but the mapping form still fails closed:
`Found type 'address' where type 'Roles' was expected`. Both the direct `m[k].a.b=v` and the storage-pointer
`S storage p = m[k]; p.a.b=v` forms.

**Why deferred.** The mapping-value path is a DIFFERENT, more complex desugar than the array path: it recursively
FLATTENS the value struct's fields into per-field mappings (`jobs__roles`, handled in buildLvalueAssign ~3181 via
`mappingStructValueVars`), and the nested-struct case is not wired through that recursive flattening (it drops the
deeper member or assigns the raw value at the first-level field). Fixing it means threading the nested rebuild
through the flatten-map machinery (mappingStructValueVars / mappingStructStateVars / stateMappingValueStruct), not
just calling rebuildStructWithChain. Fails CLOSED (type error, no miscompile), and the driving EACC contract
(MarketplaceV1) uses struct ARRAYS not mappings, so no contract is blocked by the mapping form specifically.

**What it'd take.** In the mappingStructValueVars handler (~3181), when `trailing.length > 1` (a nested struct
chain), rebuild the nested struct value via rebuildStructWithChain against the flattened value struct and reduce
the write to the first-level flattened field, mirroring the array fix. Verify against the recursive flattening of
deeper structs.

**Revisit if.** A real contract writes a nested struct field through a `mapping(K => Struct)` value and it blocks
the compile.

**Related (2026-07-15).** The fn-ptr CALL form `m[k].inner.x()` (calling a `function()` field nested inside a
mapping-value struct, shipped 9d2ad911) is gated by THIS write limitation, not by the call rewrite: `m[k].inner.x
= h` fails identically to the `uint` control, so the pointer can never be stored to invoke. The read/call side is
proven complete for nesting - `t[i].inner.x()` and `s.a.b.x()` compile and dispatch. When the mapping-value
nested write is fixed, re-test `m[k].inner.x()`; no call-side change is expected to be needed.

---

## Block layout v2: unified auxiliary co-spend band (2026-07-15)

**What.** A refactor unifying every co-spent auxiliary - block/tx oracles (`blockhashOracle`), external
libraries (keccak256 result-NFT side-car), external reads/calls - into ONE explicit front-region "auxiliary
band" in `computeBlockLayout` (`semantic/SymbolTableTraversal.ts:7507`), with a single slot allocator and one
SDK co-spend driver. Prompted by evaluating whether to "prepend" external-lib + oracle slots ahead of the
contract's own outputs (docs/keccak-result-nft.md section 10).

**Why deferred.** The intent (constant positions, variability isolated to the tail) is ALREADY the structure:
`computeBlockLayout` front-loads the fixed co-spent slots (`master -> dataNft -> readOnlyDataNft ->
blockhashOracle -> extcall-reserved -> ...`) and keeps runtime-variable outputs (transfer/tcTransfer/event/
loop-entries) in the tail; offsets resolve centrally via `getBlockSlotOffset` (`GTT:563`). `blockhashOracle`
is already a front-region "1:1 input/output slot" - the exact shape a keccak side-car needs. So keccak Phase 1
just adds an `externalLibrary` slot kind as a `blockhashOracle` sibling; no reorg required. A full unification
would REORDER slots across the 5 byte-matched covenant pairs + the green blockhashOracle / external-call /
entry-NFT e2e suites - high validation cost, disproportionate to shipping single-hash keccak, and the
per-mechanism versions already work. Hard constraint either way: `master` stays at offset 0 (state anchor for
self-pin + auto-derivation), and the input/output index-alignment rationale must be preserved.

**What it'd take.** A dedicated project: define an `auxiliaryBand` abstraction (ordered oracle+library+read+
call slots) emitted right after master+dataNft; migrate `blockhashOracle` and the extcall/read reservations
onto it; one SDK co-spend driver iterating the band; re-verify the 5 covenant pairs byte-for-byte; full
stateful + oracle + extcall + entry e2e as the regression gate.

**Revisit if.** A third+ built-in library/oracle lands and the per-mechanism placement code starts to
duplicate, or a contract needs many heterogeneous co-spent auxiliaries whose ad-hoc ordering becomes fragile.

---

## evmCompat `abi.encodeWithSignature` / `abi.encodeCall` - not at EVM parity (selector + args)

**What.** Under `evmCompat`, `abi.encode` / `abi.encodePacked` / `abi.encodeWithSelector` are byte-identical to
solc (331 conformance cases). But `abi.encodeWithSignature(sig, args)` and `abi.encodeCall(fn, args)` are NOT:
they emit (1) a **SHA256**-derived 4-byte selector (`computeFunctionSelector` = `sha256(sig)[:4]`) where the EVM
uses **keccak256**, and (2) **native pushdata** args (`emitEncodeArgsAndCatSelector` -> `emitPushdataEncode`)
instead of the EVM head/tail ABI encoding. So both the selector and the argument bytes diverge from solc.
`encodeWithSelector` is fine because the selector is passed in explicitly and its args already route through
`emitEvmAbiEncode`.

**Why deferred.** The selector needs keccak256, which is entangled with the concurrent keccak256 rework in
`GenerateTargetTraversal.ts` (compute-and-commit side-car). The args half is independent (just route through
`emitEvmAbiEncode`) but can't be conformance-verified on its own: the differential harness compares the whole
`selector ++ args` blob, so a SHA256 selector makes every case mismatch until keccak lands.

**What it'd take.** (1) An `evmCompat` branch in `visitAbiEncodeWithSignature` / `visitAbiEncodeCall` that encodes
args via `emitEvmAbiEncode(node.parameters)` instead of `emitEncodeArgsAndCatSelector`. (2) A keccak256 selector:
signatures are compile-time constants, so const-fold `keccak256(sig)[:4]` (the const-keccak256 path) - no runtime
side-car needed. (3) `selCase`-style conformance cases for both, cross-checked against ethers `id(sig).slice(0,10)`.

**Revisit if.** The const-`keccak256` work lands (it already covers `keccak256(<const>)`); computing a selector
from a literal signature is exactly that shape, so this becomes a small, testable follow-up.

---

## evmCompat ABI - niche recursive shapes (RESOLVED)

**Status: implemented.** All three deep-recursion shapes now work both directions, byte-identical to solc:
(1) `abi.decode` of `bytes[][]`/`string[][]` (commit 4284ace9: `emitEvmDecodeDynElementArray`, a counted inner
loop); (2) `abi.encode` of a struct with a nested dynamic- or static-struct field (commit 4ca9df7d:
`emitEvmStructTail` keeps the tracker synced through the unpack so nested `getStackIndex` resolves, and
`emitEvmStructInline` recurses via `emitEvmEncodeValue`); (3) `abi.decode` of a dynamic struct with a
fixed-array or nested-static-struct field (commit 698c516d: `emitEvmAbiDecodeDynamic` head positions generalized
to cumulative `abiStaticSize` + composite reconstruction). The `__abiblob` slot collision was avoided by keeping
levels temporally disjoint (each nips its slots before an enclosing level names its own) rather than a depth-scoped
namespace. Covered by conformance cases in abi/decode.conformance.test.ts.

The only genuine non-support remaining is `abi.encodePacked` of an array of dynamic elements - ambiguous/disallowed
in Solidity too, so rejecting it is correct, not a gap.

---

## keccak compute model - remaining fail-closed edges (2026-07-16)

Every keccak form now uses the compute-and-commit side-car (stateless single/multi/complex/nested, direct
stateful, transitive external incl. complex/nested-in-callee, front-region blockhash/external-read, and
runtime-bound loops in stateful + stateless contracts). These compound edges still throw (never mis-resolve):

**What.**
1. **Loop + other trailing users.** A dynamic keccak loop whose function ALSO writes a mapping loop / spends
   token-or-satoshi containers / does transfers in the SAME trailing region (both would want `[blockSize, ..)`).
2. **Transitive complex + front-region IN the callee.** A co-spent callee B that has BOTH a complex/nested keccak
   arg AND a blockhash/external-read: `_externalKeccakProbeCtx` probes B in isolation without threading B's own
   front-region, so `_extractStatefulKeccakPreimages` hits the base mismatch (direct-param transitive with
   front-region, and complex without front-region, both work).
3. **Preimage > 3 keccak blocks (~407 B)** in one side-car (a single side-car input funds at most 3 blocks).

**Why deferred.** (1) The trailing region has ONE runtime-counter-indexed band; two independent counter-indexed
users have nowhere sound to interleave. (2) B's probe context would need B's resolved front-region inputs +
recreations + locktime (the master path threads them, but the transitive path builds B's context from
`getFullState`, not a full derivation). (3) Fundamental per-input op budget.

**What it'd take.** (1) A shared trailing-region allocator that assigns disjoint counter bands (like the fixed
front-region band allocator). (2) Resolve B's blockhash/external-read co-spends inside `_externalKeccakProbeCtx`
and pass them as `frontRegionInputs` (reuse the master's resolvers against B). (3) Split a large preimage across
multiple side-cars (partial-absorb chaining), or a multi-block side-car covenant.

**Revisit if.** A real contract needs a keccak loop beside a mapping-write loop / container spend (1), a
transitive callee that hashes a nested arg while reading a blockhash (2), or a >407 B preimage (3).

**Soundness note (not a gap).** The complex-arg + transitive probes assume the keccak preimage depends only on
the function's args/state, not on surrounding-tx introspection that differs between the isolated probe and the
real spend. If it did, the probe would extract a wrong preimage and the runtime preimage bind would REJECT at
spend (fail closed) - never accept a wrong hash.

**Code cleanup (not functional).** `BUILTIN_LIBRARIES.keccak256` still carries the 2.3 KB inline blob
(`keccak-library.ts`), now only supplying `abi` + as the canonical script reference; fully removing it needs the
`ExternalLibrary` type to allow a blob-less compute-only builtin. Documented in-code.

---

## Conformance harness: run the SAME EXACT source on solc + solidc  — 2026-07-16

**What.** The differential conformance harness (`packages/solidcash/test/conformance/harness.ts`) generates TWO
sources per case - a Solidity one (`contract C { ... return <expr>; }`) and a separate SolidCash one
(`contract Conf() { ... require(<expr> == __expected); }`). They differ only in unavoidable decorations (SPDX +
pragma, `contract C` vs `contract Conf()`, `public pure`/`view`, and the return-vs-require oracle), but they are
NOT byte-identical, so a divergence in how the two toolchains PARSE the same source text is not exercised. Ideal:
compile ONE identical source string under both solc and solidc.

**Why deferred.** The languages are not a strict superset: Solidity requires `pragma solidity`, function
visibility/mutability keywords, and `return`; SolidCash uses `pragma solidcash`, `contract C()`, no
visibility/mutability on the tested shapes, and the require-oracle is what makes the BCH covenant checkable
(there is no `bytes memory ==` and no external return channel to compare on-chain). `assertBothAccept` already
runs a single self-contained `require()` covenant on both where the shape allows (round-trips), but reference
cases (arithmetic, abi.encode, slot layout) need the EVM-computed expected fed in, which forces the asymmetry.

**What it'd take.** A shared-subset preprocessor: one canonical source annotated with directives that lower to
each dialect's decorations (pragma, visibility, return-vs-require) - or a Solidity dialect shim that accepts the
SolidCash spellings. Non-trivial and low marginal value (the current per-case generation already shares the
expression/param/type strings verbatim, which is where a real parse divergence would show).

**Revisit if.** A parse-level divergence is suspected (a construct that both accept but interpret differently at
the syntax layer), or the corpus grows enough that maintaining two source templates per case becomes a burden.

---

## Sorted-mapping enumeration + C2-default: the four followups after VALUES linkage — 2026-07-16

VALUES-mode trustless iteration over a sorted (C2) `enumerable mapping` SHIPPED (commits 07cd085a SDK, 42eaed88
codegen, tests SortedMappingIteration.test.ts; the covenant co-spends the HEAD sentinel and walks the nextKey
chain to the tail, so omission/truncation revert at the VM). Its three named "next steps" plus the value-width
gap were assessed and DEFERRED - each for a concrete, grounded reason, not for lack of time.

### 1. KEYS / ENTRIES iteration over a SORTED mapping - RESOLVED for fixed-width keys (2026-07-16, commit 7b911613)

**What.** `for (k in this.m)` / `for (k, v of this.m.entries)` when `m` is a sorted (C2) enumerable mapping.

**Resolution.** Shipped via option (a), the witness-key protocol - ADDITIVELY (no change to the byte-verified C2
read/write/delete core): the caller supplies the keys (`setIterationKeys`), the SDK orders them to the ascending
chain and injects them as a concatenated fixed-width blob (a conditionally-injected `__internal__collectionIterKeys_N`
param, sorted-KEYS/ENTRIES only so other ABIs are untouched), and the linkage covenant per entry splits keyWidth
bytes off the blob, computes `keyToSlot(key)` (OP_SHA256 + 0x7f mask) and OP_EQUALVERIFYs it against the entry's
slot before exposing the key. A wrong/forged key hashes elsewhere -> reverts (verified VM-level); a missing entry
breaks the chain -> reverts. Tests: SortedMappingKeyIteration.test.ts.

**Remaining (still deferred).** None for key type - VARIABLE-WIDTH keys (int, address) now work too (commit
a9e0037b): the blob is LENGTH-PREFIXED (1-byte length ++ key per entry), the covenant splits the prefix, so any
single key type iterates (composite/nested keys are still out - no single preimage to verify). Unchanged
properties: keys come out in H(key) (hash) order, and the caller must know all keys (owner-driven enumeration;
the raw key is not on-chain). DEFERRAL #1 FULLY RESOLVED.

### 2. C2 sorted backend as the DEFAULT for plain `mapping` - SHIPPED (2026-07-17, commit 79d00698)

**DONE.** Every mapping whose value type C2 can store is C2-backed BY DEFAULT (exclusion-proof / unforgeable
reads = Solidity storage parity) - no flag. Opt out per contract with `{ sortedMappingsAll: false }` (then
`sortedMappings` names specific mappings to keep C2). A mapping whose value C2 cannot store (an array) falls back
to the default entry model via a value-type guard in compiler.ts, so unsupported shapes keep compiling. The
prior C2 feature work (computed-key auto-derivation, deploy-time HEAD init, value types, iteration keys, RMW)
made the flip safe. The migration: the ~104 tests that seed/assert the default entry model opt out via a
one-line per-file compileString shim (a behavioral no-op). Result: solidc 2054 green, solidcash 2944 green (lone
failure = pre-existing BCH_2023_05 vmTarget, no mappings). C2-as-default is DONE end to end.

**Follow-ups (not blocking).** (a) The ~104 opt-out'd legacy tests exercise the DEFAULT ENTRY MODEL; over time
migrate the representative ones to C2 seeding so the new default is directly tested (SortedMappingsAllParity +
the SortedMapping* suite already cover the C2 path). (b) P5b (item 3) for array/long-value mappings, which
currently fall back to the default model (no parity yet). (c) A future major version could remove the default
entry model + `sortedMappingsAll: false` entirely once nothing needs it.

**Why deferred - GAUGED 2026-07-16.** Temporarily defaulting all mappings to C2 measured the blast radius:
COMPILE level only 1/75 StructsMappings breaks (C2 compiles fine, different bytecode); E2E level ~half of the
plain-mapping tests break, for a MIX of reasons - (a) seeding: tests seed the default entry model, so the C2
covenant hits "missing HEAD sentinel" (mechanical migration); (b) real C2 CODEGEN/SDK gaps the flip surfaced.
So the flip is a staged migration, not a one-line default change.

**Progress (gaps closed 2026-07-16/17).** Several surfaced gaps now fixed, moving C2 toward feature-complete:
computed/local-key RMW `balances[pkh]=balances[pkh]+x` COMPILES (368efcfe: upsert hashes the key before the
value so the last-use ROLL does not eat the key) and now AUTO-DERIVES with NO withEntryKey (2ac3941e + ae3fb3bf):
the artifact carries each computed key's canonical (`call:hash160(id:pk)`) as expressionLabel - for a direct key
directly, for a LOCAL `pkh=hash160(pk)` by inlining the local's initializer canonical - and the SDK's
evalComputedKey evaluates it (hash160/sha256/ripemd160/hash256 + casts) so its co-spend agrees with the
covenant's on-chain hash. Matches Solidity's auto-resolution. Value-type coverage also widened (P5a, item 3). So
the "computed key" C2 gap is CLOSED for the common hash-of-arg shapes (a reassigned local / non-hash op falls
back fail-closed, resolvable with withEntryKey).

**DEPLOY-time HEAD init DONE (8f40abc3).** The genesis tx now mints HEAD[slot 0 | nextKey 0] for each C2 mapping
the constructor did not populate, so a freshly deployed (unseeded) C2 contract's first read/write works - no
"missing HEAD". Funder-authorized genesis; later reads/writes pin the HEAD via the covenant. So a real C2-default
CONTRACT is now deployable + usable end-to-end.

**What it'd take (remaining).** (1) P5b (chunked values) for unbounded string/bytes mappings > 64 B (or a
fail-closed carve-out). (2) The FLIP itself + test-suite migration: flip the default to C2, and the ~half of e2e
tests that SEED default-model entries need C2 seeding (HEAD + sorted entries) - either per-test or via a C2-aware
seed helper; an opt-out `plainMappings` option would let the flip land with legacy tests opting out while the
default is C2. (3) Sweep for further per-shape C2 gaps (the gauge only sampled). The feature gaps are largely
closed now (computed keys, deploy init, value types, iteration keys, RMW) - the remaining work is the coordinated
flip + seeding migration, best done as a dedicated pass.

**Revisit if.** Continuing the parity push (the standing directive) - this is now the critical path; each gap
closed shrinks the eventual flip.

### 3. large VALUES in sorted entries - P5a + P5b + GENERAL struct/array chunking + sorted push/pop all DONE

**P5a DONE (2026-07-16, commit ad70e15f).** Unbounded `bytes` / `string` values <= 60 B are stored INLINE in the
entry commitment tail as `len(4 B LE) ++ value` (<= 128 B total, real-chain-valid), so a `mapping(K => bytes|string)`
gets the same exclusion proofs as int/bytesN values. Closes the common short-string/bytes case (symbols, URIs, names).

**P5b DONE (2026-07-17).** The HARD REQUIREMENT ("c2 must be default, even for data longer than ~64B") is met:
`mapping(K => bytes|string)` is C2 by default for values of ANY practical length. A value > 60 B stores
`len(4 B LE) ++ sha256(value)` (100 B commitment, fits the 128 B token-commitment limit) and the full value
persists off-commitment in per-(collection, slot, digest) chunk NFTs. A read reassembles the chunks into a witness
and the covenant verifies `sha256(witness) == storedHash` - a forged/tampered/missing witness fails the read CLOSED
(never a wrong value). Design E (SDK-minted, covenant-UNPINNED chunks): the covenant stores only the hash, so no
chunk co-spend loop and no OP_TXOUTPUTCOUNT coupling is needed - the value chunks are extra trailing 0x01 mutable
outputs the C2 write covenant tolerates (no total-output bound; minting uniqueness counts only 0x02; C3 conservation
is skipped for entry-access functions). The 10,000 B VM stack-element limit caps an on-chain-READ value (the witness
must be hashed on-stack) - the same ceiling any storage mechanism faces, since a value the contract compares must be
loaded whole; not a chunk-design limit.

Pieces (all shipped, all green in SortedMappingLongValue.test.ts + migrated SortedMappingDynBytesValue.test.ts):
- Covenant: `emitChunkableValueTail` (write v -> `len4 ++ [inline<=60 | sha256(v)]`) + `emitChunkableValueRead`
  (read: strip len4; short -> inline; long -> PICK the `__internal__valueWitness_<slot>` arg, `sha256==hash`
  OP_EQUALVERIFY). GTT.
- SymbolTable: `__internal__valueWitness_<slot>` param injection, gated on `collection.sorted` + chunkable value.
- Compiler ABI: `EntryAccessAbi.valueParam` records the direct value parameter of a chunkable write.
- SDK: read reassembles the value from `getValueChunkAddress(collection, slot, digest)` chunks -> witness (threaded
  into finalArgs between blockhash and iteration args, matching the SymbolTable order); write mints the chunks via
  `StatefulTransactionBuilder.addValueChunkOutput` (trailing, after every covenant-managed output).

**Design D (covenant-PINNED chunks) - SHIPPED for direct values (2026-07-17).** The value chunks are now verified
ON-CHAIN: `emitSortedValueChunkPin` (modeled on emitDynamicWriteVerification) pins each chunk output at the compile-
time per-collection value-chunk P2SH with commitment `slot(32) ++ digest(32) ++ pushdata(i) ++ pushdata(v[i*56:])`,
built from the on-stack value, base `masterInput + blockSize (- unmaterialized returnEvent) + isInsert` (isInsert =
coSlot != H(k), layout-relative so a trailing fee-change output does not shift it), orphan-bounded. So a forged /
absent / misplaced chunk fails an OP_EQUALVERIFY at WRITE time - the ADVERSARIAL-writer residual is CLOSED for direct
writes (a malicious non-SDK builder can no longer persist a correct hash with wrong chunks). The Wall-1 sorted-INSERT
NEW-node collision (the chunk-pin's OP_OUTPUTTOKENCOMMITMENT calls were misread as NEW by the loop-entry extractor)
is fixed: the SDK computes NEW exactly (`slot ++ oldNext ++ tail`) and injects it PINNED via `pinLoopEntry`, so the
derivation skips the collection. VM-green update + insert + adversarial (SortedMappingLongValue.test.ts); solidcash
2949 pass (1 pre-existing BCH_2023_05).

**COMPUTED values - NOW SHIPPED too (2026-07-17), closing residual #1.** A `m[k] = f(...)` whose result > 60 B and
is not a direct param (a local-var / expression RHS) now WORKS: the covenant pins the chunks, and the SDK DERIVES
their commitments from the VM trace progressively (the tight `<expected> <idx> OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY`
pattern exposes each chunk; the VM halts at the first placeholder mismatch, so each probe reveals one more). Both
UPDATE and INSERT work (SortedMappingLongValue.test.ts). Three derivation subtleties were solved: (a) the value-chunk
pin runs BEFORE the entry-output check, so the entry only re-derives on a PASSING probe - the convergence loop now
requires a passing probe (not just a stable fingerprint) when value chunks are present; (b) the loop-entry (NEW)
extractor's range is capped to a single output for sorted-value mints so it does not misread the chunk OTC calls as
phantom NEW nodes; (c) a computed INSERT's NEW cannot derive until the chunks converge (the pin blocks it), so the
seeded loop-entry count is held at 1 (not dropped to 0, which would shift the chunk base). A computed UPDATE pins its
(empty) loop entry so it is never phantom-derived. Direct `m[k] = v` remains injected exactly (no derivation).

**OVERWRITE GC - DONE (2026-07-17).** Overwriting a long value now CO-SPENDS (destroys) the old chunks: on a present-
key UPDATE whose old tail is long (len > 60), the SDK reads the old digest, fetches the old chunks at the collection
value-chunk address filtered by (slot, old digest), and consumes them via createValueChunkUnlocker (flag=1, reusing
the dynamicChunkInputs consume path). The covenant does not verify them (the new chunks are pinned), so this is a
pure dust reclaim - no more orphans. Digest-keyed, so only the exact old version is reclaimed. Test: SortedMapping
LongValue.test.ts "overwrite GC" (v1's 3 chunks gone, only v2's 3 remain).

**GENERAL large-value (STRUCT + ARRAY) chunking - SHIPPED (2026-07-17).** The digest+chunk mechanism is now
BLOB-AGNOSTIC: `isChunkableValueType` (utils, the single source of truth) = unbounded bytes/string OR struct OR
dynamic array `T[]`. Any such value chunks off-commitment when > 60 B, so a `mapping(K => struct)` /
`mapping(K => T[])` is C2 by default (real-chain-valid) regardless of size. address/bytesN/int stay verbatim (always
within 128 B). Delivered along the CLEAN DESIGN below:
- Reads: `m[k]` / field-read `m[k].f` / element-read `m[k][i]` all go through emitSortedSetRead (materialize via the
  witness, chunking-transparent) then the existing struct/array decode (emitArrayElementExtract for `[i]`). Added
  ArrayType to sortedValueKind ('rawbytes'); extended isChunkableValue + the SymbolTable witness injection + the SDK
  gates (`collection.chunkableValue`) to struct/dynamic-array.
- Field/element WRITES are routed as a whole-value RMW through the chunk-aware ops: `m[k].f = v` ==
  `m[k] = setField(m[k], f, v)` (emitSortedStructFieldWrite + emitStructFieldSurgery); `m[k][i] = v` ==
  `m[k] = setElem(m[k], i, v)` (emitMappingArrayElementAssign in `sortedRmw` mode: Phase-1 read via emitSortedSetRead,
  Phase-2 element surgery, Phase-3 hands the blob to emitSortedValueUpsert to re-chunk + pin). Co-spends the entry
  ONCE like a scalar RMW; the SDK reuses Design D's COMPUTED-value derivation + overwrite GC. This FIXED a pre-existing
  flip bug where sorted struct field writes read the key||value (default-model) commitment instead of slot||next||value.
- The `chunkableValue` collection-ABI flag (compiler-computed via isChunkableValueType) drives the SDK gates cleanly.
- Whole-value array-literal assign `m[k] = [a,b,c]` now blob-encodes the literal in visitMappingAssign (was only done
  for state vars / var-defs), so the array stores as one value blob, not separate stack items.
Tests: SortedMappingStructFieldWrite.test.ts (small + 160 B struct), SortedMappingArrayElementWrite.test.ts (int[]
var-width + bytes32[] > 128 B chunked, element read/write, neighbor preservation).

**push/pop on a sorted array - NOW DONE (2026-07-17).** `m[k].push(v)` / `.pop()` route through the same sortedRmw
whole-value upsert as element writes (materialize -> Phase-2 push/pop surgery -> re-chunk). They CHANGE the element
count, so the value can flip across the inline<->chunked (60 B) boundary; that transition is handled entirely by the
SDK computed-value derivation - it already reprobes the new value's chunk set and GCs the old chunks by digest. The
ONE bug was a spurious minted chunk: the derivation seeds a `'00'` placeholder to bootstrap the covenant's chunk-0
verification, but a value that resolves INLINE pins no chunks (emitSortedValueChunkPin's size>60 guard), so the seed
survived and got minted, and a later chunked read of the same slot then failed to parse it. FIX (StatefulContract, in
the post-convergence cleanup): drop any unresolved `'00'` from the FINAL value-chunk commitments - a real chunk
commitment is always long (slot++digest++i++data), never the 1-byte `'00'`, so this cleans inline results without
touching chunked ones. The compiler.ts `pushPopMappings` opt-out was REMOVED (array mappings with push/pop are C2
again). Test: SortedMappingArrayElementWrite "push/pop under C2" (INSERT empty->[v], inline->chunked, chunked->chunked,
pop chunked->inline, all with element reads). The legacy DEFAULT-model push/pop suites (MappingArrayPush, NoArg/This
Prefix/IndexedFieldArrayPush) opt out via `sortedMappingsAll:false` to keep asserting the entry-model byte format.

### 4. Sound PARTIAL (paginated / windowed) enumeration

**What.** Iterate a sorted mapping too large to co-spend whole (the tx-size ceiling - e.g. millions of balance
entries). Linkage already proves the completeness of any CONTIGUOUS WINDOW, so a windowed walk is sound in
principle: co-spend [cursor .. cursor+K], prove contiguity, persist the cursor (+ any accumulator) in the
register, resume next tx.

**Why deferred.** It does not fit the single-tx `for..of` model (one call = one tx = one result). A paginated
fold spanning many txs needs (a) the cursor persisted in the data-NFT register, (b) the partial accumulator
(e.g. running sum) persisted and threaded across txs, and (c) a completion signal (cursor reached the tail) -
i.e. a NEW resumable-fold API/construct, not a codegen tweak to the existing loop.

**Design is FINALIZED + sound-by-reduction (2026-07-17), implementation is a focused follow-up.** The covenant
reduces to the EXISTING adversarially-verified full-walk `emitSortedIterationLinkage` (GTT:3542) - which already
chain-verifies slot==expectedNext per entry (omission/reorder/truncation revert) - with two additions: (1) the walk
starts from an ANCHOR whose slot == a stored CURSOR (a register state var; the first page's cursor is the HEAD
sentinel 0), instead of always HEAD; (2) the loop is BOUNDED to K entries (or the tail), and the new cursor = the
last processed entry's nextKey is written back. Soundness: within a page the chain check is unchanged (=verified);
pages can't SKIP because each page's anchor slot is pinned == the cursor the prior page wrote, and the cursor is
covenant-enforced register state; the pass COMPLETES when a page reaches nextKey==0. CAVEAT (same as any paginated
enumeration over a mutable structure, incl. Solidity): snapshot semantics - an insert/delete between pages
invalidates the cursor, so pagination is for a signed / no-concurrent-write window. Design commit fef5723b.

**What's left to BUILD (not a codegen tweak - a new resumable-fold surface, held from rushing since it is a
completeness primitive):** (a) a surface - a windowed `for (v in m.window(cursor, k))` form or an explicit
`iterateWindow(cursor,k)` builtin exposing the post-window cursor; (b) semantic: bind the cursor state var + K
param; (c) codegen: parameterize emitSortedIterationLinkage with a start-anchor + a bound + a cursor write-back;
(d) SDK: co-spend the [cursor..cursor+K] window + derive/persist the cursor; (e) ADVERSARIAL tests
(omission/skip/stale-cursor/wrong-anchor MUST revert) BEFORE shipping - the silent-omission risk is exactly what
this prevents, so it ships only when those fail closed.

**Revisit if.** A real contract must enumerate/aggregate a mapping whose entry count exceeds one tx's input
budget (the USDT-scale case that motivated the enumerable/plain split originally).

### 5. C2 value-shape coverage + the default entry model (2026-07-17)

**C2-by-DEFAULT covers every value shape except function pointers.** `mapping(K => V)` is C2-backed by default for V
in: int/bigint/bool, bytesN, unbounded bytes/string, address, enum, struct, and arrays (dynamic `T[]` + fixed `T[N]`,
chunk-aware). A struct with a mapping/array field is field-decomposed into per-field C2 collections.

**Why ARRAYS are C2-by-default (the parity argument, revisited 2026-07-18).** Briefly considered making arrays opt-in
(the exclusion proof only helps array length/presence guards - an absent-key ELEMENT read reverts on the empty-array
bounds check, not a forgeable value - so the omission surface looked narrow). REVERSED on EVM-parity grounds: the EVM
makes EVERY storage read unforgeable (the trie commits an array's length slot to 0), so a ported
`require(orders[user].length == 0)` / presence guard relies on that; leaving arrays on the entry model makes exactly
that guard omission-forgeable = a silent porter footgun. Plus EVM arrays are unbounded while the entry model caps a
value at the 128 B commitment. So on both parity dimensions (unforgeable length/presence + no size cap) C2 is the
faithful choice; the per-read C2 overhead is the parity tax the EVM itself pays via the trie. Uniformity wins: every
mapping read unforgeable, so a porter never has to reason about which reads are safe.

**Only function pointers have NO C2 path.** fn-ptr values go through heavy lowering (LowerBlobFunctionPointers,
LowerForeignFunctionPointer*) that may transform the mapping before the C2 opt-in, and are rare - deferred.
Revert-safe: add `FunctionType` to c2StorableValue (needs the import) + sortedValueKind, then test the fn-ptr suite.

**Default entry-model DELETION** (still gated): (1) fn-ptr values -> C2; (2) migrate the ~110 `sortedMappingsAll:false`
opt-out'd tests to C2 seeding; (3) delete the entry-model codegen path + the `sortedMappingsAll` / `sortedMappings`
options. Large mechanical change; do it as a dedicated pass.

### 6. C2-default no-guards: the two deep source-shape blockers (2026-07-18)

After the nested/multi-key C2 codegen fix (commit c5c1d5c8) all 4 Unicrow + 11/12 corpus sorted-mapping files
compile under C2-default. Two source shapes still block a full no-guards flip (both surfaced by EACC Marketplace):

**(a) A C2 (sorted) mapping write inside a DYNAMIC loop.** `for (uint i; i < xs.length; i++) w[id][xs[i]] = true`
(Marketplace `whitelistWorkers`). A FIXED-bound loop already works - `UnrollFixedBoundEntryLoop` unrolls it to static
writes before codegen. The dynamic case previously crashed deep at "Block slot not found: entry[0]" (the write routes
to `emitSortedValueUpsert`, which needs a fixed entry slot); `visitMappingAssign` now FAILS CLOSED with
`SortedMappingCodegenPendingError` when `node.collection?.sorted && this.plainLoopDepth > 0` (commit 88be6d13, never
degrades to the omittable entry model). The full feature is a per-iteration sorted-linked-list INSERTION covenant: the
list, the bracketing predecessor, and the slot ordering all evolve each iteration, so it is the sorted analog of the
default-model dynamic pure-write loop (`entry_write_in_loop`, OP_BEGIN/OP_UNTIL entry-mint + SDK progressive trace
derivation). What it'd take: a sorted-insert-in-loop covenant that mints one entry per iteration with the evolving
bracket pinned + SDK derivation of the growing list, plus adversarial proof (wrong-insert / orphan / omission / out-of-
order all revert). Soundness-critical: a bug reopens the C2 exclusion-proof hole. Revisit for full no-guards.

**(b) Marketplace external-call TARGET through the SafeERC20 low-level-call chain.** `IERC20(job.token).transfer(...)`
where the token is a STORAGE-POINTER struct field, routed through OZ SafeERC20 -> `Address.functionCall` -> low-level
`.call`. All minimal repros (`IFoo(p.tok).m()` through a library fn) COMPILE - the block is the full inlined chain
with the storage-ptr-field target sourcing. Soundness-critical: the target is a FUND-TRANSFER destination, so a wrong
source silently redirects funds (worse than a clean compile error). Related to the `memory-COPY struct field` extcall
deferral (section "External-call target: DIRECT method call on a memory-COPY struct field") but through the low-level
chain. What it'd take: extend `SynthesizeExternalAddressLocals` sourcing to the chain-inlined storage-ptr-field target
with a non-modification / self-pin soundness proof (per extcall-target-pinning.md). Revisit for full no-guards.

**(c) MULTIPLE writes to the SAME C2 entry in one call (coalescing) - the array-write blocker (2026-07-18).**
Surfaced probing C2 ARRAY writes. A single element write `m[k][i]=v` / `push` / `pop` / whole assign works, but two
STRAIGHT-LINE writes to the same entry (`m[k][0]=x; m[k][2]=z`, or a fixed-bound loop `for(j<3) m[k][j]=v` after
unrolling, or two struct-field writes `m[k].a=x; m[k].b=y`) do NOT: each routes to its own `emitSortedValueUpsert`,
which CO-SPENDS the entry NFT + emits one output entry, so a second upsert needs a second co-spend of the same (now
already-spent) input and a second output - the covenant OP_VERIFYs fail (runtime revert, fail-closed, not silent).
The DEFAULT entry model handles this via `pendingEntryWrites` read-after-write chaining; the C2 analog is COALESCING:
read the entry ONCE, apply all the surgeries to the in-memory value, emit ONE output. It is the same deferred
machinery as (a) (per-iteration insert) - soundness-critical (the coalesced value must be correct AND the exclusion
proof preserved), NOT rushed. Current state kept SOUND: the fixed-bound loop is NOT unrolled for array-element writes
(`UnrollFixedBoundEntryLoop.hasMappingWrite` intentionally matches only the ArrayAssignNode whole-entry form, not the
MappingAssignNode element/push form) so it fails closed at `plainLoopDepth > 0`; a straight-line consecutive same-entry
write still compiles but reverts at runtime (a footgun, but fail-closed - a branch-aware compile guard is deferred with
the coalescing). A MULTI-DIMENSIONAL array element write `m[k][i][j]` on `mapping(K => T[][])` now fails closed cleanly
(`UnsupportedTypeError`) - it used to CRASH (the excess index was type-checked as a phantom key at `allKeyTypes[i] ==
undefined`); guarded in `TypeCheckTraversal.visitMappingAssign` by `node.keys.length > allKeyTypes.length`. Tests:
`SortedArrayWriteFailClose`. Revisit (coalescing) for full no-guards + multi-element/loop array writes.
