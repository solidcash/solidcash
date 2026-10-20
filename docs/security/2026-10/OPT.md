# OPT audit: post-codegen bytecode transformations and encodings

Tree: /Code/cashscript/.worktrees/per-call, branch feat/per-call, HEAD abbb7e0ec (read 2026-10-11).
Read-only; no tests, compiles or probes run. Line numbers as read at that HEAD.

## Findings

### OPT-1 MEDIUM, SUSPECTED: top-level constant pooling can merge a framed master's deploy-time placeholder slot with an ordinary constant; the published offset then lands inside the pooled helper and the deploy fill rewrites every merged site

Files:
- packages/solidc/src/generation/GenerateTargetTraversal.ts:3579 (`if (!this.framedReservesValidatorHash) this.poolTopLevelConstants(node);`), 3595-3629 (poolTopLevelConstants: anchors = require/log pointers + ATTRIBUTED_FAILURE_OPS only, 3604-3609; definitions prepended, 3627)
- packages/utils/src/outline.ts:1256-1286 (constant seeding: any data element of >= 6 encoded bytes seen >= 2 times, excluded only when it is an OP_DEFINE/OP_INVOKE operand or a define body)
- packages/solidc/src/framed/master/master-head.ts:1209-1219 (category slot = push of 32 zero bytes; address slot = push of 35 zero bytes)
- packages/solidc/src/framed/master/master-program.ts:53-77, 92-98 (findPlaceholderOffsets scans raw bytes, not instructions; category = last `0x20 00*32` before the address slot)
- packages/solidc/src/compiler.ts:16559-16564 (offsets published from the finished, pooled script)
- packages/solidcash/src/framed/deploy/material.ts:146-153 (fill writes at the published offsets; assertPlaceholders checks only that the bytes there are the zero placeholder)

Root cause: a standalone framed master (no validator-hash slot) still runs top-level pooling. The pooler has no notion of
"placeholder slot": the category push is an ordinary 33-byte data element to it. Any second byte-identical top-level
element (a compiler-emitted raw 32-zero push, e.g. the sorted-mapping iteration HEAD check
GenerateTargetTraversal.ts:12735/12755 `<00*32> OP_EQUALVERIFY`, or the kernel paths at 33915/34033/34575) forms a constant
group with it. Savings for 2 sites at 1-byte ids: 66 - 37 - 6 = 23 > 0, so it is pooled. The offset finder then locates
the slot by byte pattern, which now occurs only inside the pooled definition's body push.

Mis-transformed example (standalone master, inline body iterating a sorted mapping):
- before pooling: `... <00*32> <02> OP_CAT OP_DUP OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_EQUALVERIFY ... <k> OP_PICK <00*32> OP_EQUALVERIFY ...`
- after pooling: `<20||00*32> <h> OP_DEFINE ... <h> OP_INVOKE <02> OP_CAT ... <k> OP_PICK <h> OP_INVOKE OP_EQUALVERIFY ...`
- findPlaceholderOffsets: categoryOffset = 1 (inside the definition push). Deploy fills the chain category there, so
  helper h pushes the category at BOTH sites: `HEAD.slot == 0` becomes `HEAD.slot == category` (iteration path bricked).
- Variant: if a free-function definition (prelude, between the pooled definition and the head) contains the bytes
  `20 00*32`, lastBefore picks that one; the fill corrupts the free function's constant and h (the head's category pin)
  stays zero, so `OP_UTXOTOKENCATEGORY == 00*32||02` never holds: the master is unspendable.
- Any merged site that used the zero constant in a `!=` / OP_NOT sense would become a check against the category, i.e.
  weaker (a zero value passes). Not found concretely; listed as the bypass direction of the same defect.
- Same mechanism for the 35-byte address slot: two 35-zero pushes would be merged and `uniqueOffset` would then accept.

Unconfirmed precondition: that a standalone master's top-level script actually carries a second raw 32-zero push (inline
bodies per the findPlaceholderOffsets doc comment "a body's own pushes lie either side of the whole head").

Fix: in poolTopLevelConstants pass every placeholder push index as an anchor (or skip pooling for every framed master,
as already done for the validator-hash case); make findPlaceholderOffsets instruction-aligned (decode, match only
top-level push elements) and refuse when the slot bytes also occur anywhere else in the program.

### OPT-2 LOW, CODE-CONFIRMED: bytecode-changing SOLIDC_* switches bypass the env registry and are not part of the compile-cache identity

Files:
- packages/solidc/src/generation/GenerateTargetTraversal.ts:24456-24463 (SOLIDC_DEBUG_STREAM_PICK_OFFSET shifts the
  `<k> OP_PICK` that reads the authenticated emission stream to `<k+n>`), 24342-24344 / 24355-24358 / 24382-24385
  (SOLIDC_ROW_STACK_CLEAN, SOLIDC_ROW_ASSERT, SOLIDC_ROW_HEAD_CHECK emit extra or different code; not registered),
  7229 (SOLIDCASH_NO_OUTLINE read raw, any non-empty value), 6172-6173 (SOLIDC_DEBUG_NO_OUTLINE read raw)
- packages/solidc/src/compiler.ts:11400-11401 (SOLIDC_ROUTE_ABI_TAIL=0 restores short route ABI vectors; the comment
  above it documents the misaligned owner read this causes)
- packages/solidc/src/solidc-env-registry.ts:5-11 (claims: observation = must not change bytecode; unknown names never
  change production semantics; instrumented never affect release), 62 and 66 (STREAM_PICK_OFFSET and ROUTE_ABI_TAIL
  classed `observation`)
- packages/solidc/src/compiler.ts:1376-1410 (cache key = options + feature bits; only SOLIDCASH_NO_OUTLINE disables caching)

Root cause: these reads use `process.env` directly instead of solidcEnvFlagEnabled/solidcEnvValue, so release mode and
the registry classes do not gate them, and none is folded into cacheableCompilerOptions.

Example: `SOLIDC_DEBUG_STREAM_PICK_OFFSET=1` turns the graph-row consumer's `<k> OP_PICK ... OP_SPLIT ... OP_EQUALVERIFY`
into `<k+1> OP_PICK ...`, so the row is compared against the neighbouring stack item instead of the authenticated stream
and the remainder is written back into the stream slot. With SOLIDC_COMPILE_CACHE_DIR set, that artifact is cached under
the default key and returned to a later compile with the variable unset. Precondition: the deployer's own environment.

Fix: route every read through the registry with the right class; refuse instrumented/unknown bytecode-affecting
variables in release compiles; fold any set bytecode-affecting variable into the cache key or bypass the cache.

### OPT-3 INFO, CODE-CONFIRMED (latent): outliner apply phase trusts cached candidates; cached spans are aliased and mutated

Files: packages/utils/src/outline.ts:1486-1494 (cache stores `[...candidates]`, a shallow copy), 1548 (`script:
candidate.span`), 1620-1628 (later-round edits splice small helper bodies in place), 1636-1676 (helper bodies of >= 200
elements: the per-round wrapper's `script` is reassigned, fn.script keeps the original code).

Root cause: occurrences are spliced without re-checking that the site still holds `candidate.span`. A cached candidate
whose span was spliced in a later round of an earlier attempt would be re-applied with a definition that contains
`<id> OP_INVOKE` of an id from that earlier attempt. Not reachable today: the only caller passing a cache
(GenerateTargetTraversal.ts:7445-7479) uses a fresh Map for one single-round call. The >= 200-element branch silently
drops edits to helper bodies (semantically safe, the helper keeps its original instructions) while savedBytes counts them.

Fix: deep-copy spans into the cache (as the `superset:` entry already does) and assert span equality at each occurrence
before splicing; write the rebuilt array back to the function entry for corpus indices >= working.length.

### OPT-4 LOW, SUSPECTED: helper id pool is not reserved against ids a registrar library defines at run time

Files: packages/solidc/src/generation/GenerateTargetTraversal.ts:4706-4726 (pool seeded with captured-subroutine, user
and free-function ids only), 1560 (SINGLE_BYTE_PUSH_IDS include 1..16), 6797-6812 (registrar run); packages/utils/src/
keccak-library.ts:3-4 (the keccak registrar defines its round at id 2 inside the blob).

The built-in keccak no longer loads the registrar (external-library.ts:41-50), so this needs a `userLibraries`
registrar with fixed internal ids. Effect: "function identifier previously defined" on that path (availability).
Related INFO: libauth 2026 counts defined functions in maximumMemorySlots (bch-2026-instruction-set.js:47-53, 1000 slots),
and MAXIMUM_OUTLINED_FUNCTIONS is 4096 (outline.ts:104), so outlining reduces the stack budget of every path.

Fix: reserve ids defined inside inlined/side-car registrar blobs (or any id an OP_DEFINE in a pushed blob can create)
before seeding the cheap pool.

## Checked and sound

1. Barrier set (outline.ts:42-56) covers every frame-relative BCH 2026 op (ACTIVEBYTECODE, CODESEPARATOR, CHECKSIG family, DEFINE, INVOKE) plus alt-stack ops; libauth opInvoke shares stacks and pushes a frame (bch-2026-functions.js:48-66).
2. longestBalancedSpan (outline.ts:235-288): spans start and end at one depth, never dip below it, and OP_ELSE retires same-depth starts; traced `IF a ELSE b ENDIF` and region-starts-inside-branch cases.
3. Invoke operand pairing: splitsInvoke checks every occurrence's first and following element (outline.ts:1373-1385); constant seeding skips DEFINE/INVOKE operands and define bodies (1264-1269).
4. Window grouping verifies the full seed window element-by-element and splits buckets on exact keys (outline.ts:1166-1229); data and opcode keys cannot collide (160-168), so push payload bytes are never matched as instructions.
5. Nested-invoke opt-in relaxes the barrier only for a literal data operand decoding to an allowed id; number-encoded operands stay barriers (outline.ts:186-209).
6. reorderOutlinedFunctionIds permutes ids in one pass keyed on original ids over all bodies and helpers; helper ids are <= 3 bytes so the length>4 skip never applies (GenerateTargetTraversal.ts:7718-7776).
7. Trampoline folding resolves alias chains with a cycle guard (GenerateTargetTraversal.ts:7515-7550).
8. Dead-DEFINE splice uses codegen use counts with transitive dependency closure (GenerateTargetTraversal.ts:5157-5171).
9. Peephole rule table unchanged since 2026-07-26 (git log on optimisations.ts / cashproof-optimisations.ts); new-engine regex is end-anchored and start anchoring holds because every ASM opcode token begins with OP_ and hex tokens never contain it (script.ts:9-13, 408-535).
10. scriptToBytecode / elementEncodedSize mirror libauth encodeDataPush incl. OP_N / OP_1NEGATE folding and PUSHDATA1/2/4 thresholds (script.ts:41-104); normaliseScript is element-wise (188-196); 0x00 / 0x80 / 0x81 pushes round-trip through bytecodeToAsm/asmToBytecode.
11. encodeInt/decodeInt are libauth minimal VM numbers, decodeInt rejects non-minimal input; fixed-width pack/unpack are range-checked both ways (data.ts:13-47, state.ts:1658-1716).
12. Top-level pooling prepends definitions before any invoke and remaps require/log pointers through indexMap (GenerateTargetTraversal.ts:3615-3629); for direct contracts no byte offsets are published, so the move is semantics-preserving.
13. SDK framed deploy fills a copy and verifyMasterDeployment checks every non-slot byte and the P2SH32 lock (material.ts:120-238).
14. No OP_EVAL (0x62) emission anywhere in compiler sources, so its absence from BARRIER_OPS is moot.

## Not reached

- state.ts encodePushdataValue / decodePushdataValue (479-1143), event encoders, entry/chunk commitment builders vs. the covenant's own comparisons.
- artifact.ts validation (2732 lines), fingerprint.ts, source-map.ts; SDK auto-derivation paths that act on artifact fields. Prototype pollution only spot-checked (the SDK does not JSON.parse artifacts).
- cashproof-optimisations.ts equivalences (unchanged; prior audit).
- findCandidates hashing internals (outline.ts:352-1150) beyond the exact-verification step; GTT alias/leftover passes under largeBodyOutline only skimmed.
- censusAddressPushes (master-program.ts:146-170) also scans raw bytes; a false match inside a data push makes elementIndexCovering throw (compile-time only), not traced further.
