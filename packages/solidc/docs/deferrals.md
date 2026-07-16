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
