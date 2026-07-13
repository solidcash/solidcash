# Unified linear memory - DESIGN (READ bridge landed; WRITE + full unification remain)

## Implementation status (2026-07-13)
- **DONE (commit 8798f756): the READ bridge.** `mload(add(s, 32*i))` on a high-level memory struct lowers to
  `uint256(s.field_i)` (LowerInlineAssembly.resolveStructField + the mload hook). No buffer needed - EVM's one-
  32-byte-slot-per-field memory struct layout means the Yul memory read at a struct address IS the field read,
  and mapping to `s.field` (not a byte offset) is sound regardless of the value-copy packed layout. VM-verified
  (YulStructMemory.test.ts: right field, right value, negative). solc-corpus 3907->3908 (+1 static_struct_v2).
- **BLOCKED: the WRITE.** `mstore(add(s, 32*i), v)` == `s.field_i = v` needs the value-copy rebuild `s = S(..)`,
  but emitting that from this LATE pass does not compose with the memory-model conversion of `s` - the store is
  silently dropped (a bisecting VM test caught `s.a` staying at its init value). So mstore on a struct address is
  left UNLOWERED (falls back to the prior AssignTypeError, non-regressing) rather than miscompiling. The WRITE
  needs the pass-order coordination below (U0-U1): either LowerMemoryModel and LowerInlineAssembly share one
  buffer + one convertible set, or the struct-field-write desugar is re-run over the emitted rebuild. Do NOT
  re-enable the mstore mapping without that - it is a silent miscompile.

---

# Original scoping doc

Status: DESIGN ONLY. This scopes the architecture change needed to close the "Yul assembly accessing a
high-level memory struct/array" corpus wall, so a future dedicated effort can execute it phase-by-phase with a
VM gate at each step. It is written design-first ON PURPOSE: the last attempt to make these files compile via a
value-copy whole-field read-modify-write shipped a SILENT MISCOMPILE and was reverted (see
[[experimental-memory-model.md]] and the solc-corpus notes). Do not patch this wall ad hoc.

## 1. The problem

Solidity has ONE linear memory. High-level reference types (`struct`/`T[]`/`bytes`/`string` in `memory`) and Yul
`assembly { mstore(p, v) / mload(p) }` address the SAME byte-addressable space, so this is idiomatic:

```solidity
struct S { uint8 a; bytes1 b; }
function f(uint256 a, bytes32 b) public returns (bytes memory) {
    S memory s = S(2, 0x02);
    assembly { mstore(s, a); mstore(add(s, 0x20), b); }   // treat `s` as a memory address
    return this.gg(s);
}
```

SolidCash has THREE unrelated memory representations, and the Yul op cannot address the high-level struct.

Corpus impact: of the 9 struct-memory type-error failures at 3907/4876, **8 are exactly this pattern** (Yul reading
or writing a high-level struct/array address): `abicoder/cleanup/struct_v2`, `abicoder/validation/static_struct_v2`,
`viaYul/dirty_memory_struct`, `inline_assembly/assembly_5`, `inline_assembly/assembly_memory_write`,
`structs/recursive_struct_2`, `structs/struct_delete_storage_nested_small`, `types/struct/struct_recursive_2`. The
9th (`storageLayoutSpecifier/state_variable_struct`) is a separate `layout at` feature. Two also need recursive
structs (fundamental). Realistic closeable set: ~4-6.

Honesty note: several of these are EVM-memory-INTERNALS tests (dirty-bit ABI cleanup, memory-layout probing). They
would compile SOUNDLY under this design but their assertions test EVM-specific memory behavior, so the corpus gain
is partly compile-only-green. This is documented so the payoff is not oversold.

## 2. Current state: three representations

1. **Value-copy blob (default).** A `memory` ref is a self-contained byte blob; nested mutation is whole-blob
   read-modify-write. PACKED element widths (a `uint256` is 33 bytes, a `uint8` is 1 byte). No aliasing. This is
   the fallback and it is CORRECT for everything the pointer model does not convert.
2. **High-level pointer model** (`LowerMemoryModel.ts`, always-on, safety-gated). A convertible `memory` ref is an
   INTEGER offset into a per-function `bytes __memory` buffer with a `uint __freeptr`. Layout is 32-byte word slots:
   struct `[f0(32)|f1(32)|...]` with ref fields holding pointers; dynamic array `[len(32)|e0(32)|...]`. Nested
   lvalue = address chain + single `mstore`. Init: `__memory = ""`, `__freeptr = 0` (heap from offset 0).
3. **Yul linear memory** (`LowerInlineAssembly.ts` P7, `__yulmem`). A per-assembly-block `bytes __yulmem`,
   initialized to the EVM reserved layout: 128 bytes, free-memory-pointer value `0x80` stored at slot `0x40`, heap
   from `0x80` (`/Code/solidity` CompilerUtils.cpp:45-52). 32-byte words, `mload`/`mstore` = slice/splice.

**The gap.** Representations 2 and 3 are SEPARATE buffers with DIFFERENT free-pointer conventions. A high-level
struct `s` is either a value-copy blob (rep 1) or an offset into `__memory` (rep 2) - never an offset into
`__yulmem`. So Yul `mstore(s, v)` cannot address it. Today the safety gate (SS6) sees the Yul use as UNHANDLED and
TAINTS `s` to the value-copy path, which then cannot express `mstore(s, v)` at all -> the type error.

## 3. The key insight (why this is tractable, not a rewrite)

The in-buffer layouts of reps 2 and 3 are ALREADY compatible: both are 32-byte word slots. And the high-level
pointer struct layout `[f0(32)|f1(32)|...]` with ref fields as pointers IS the EVM memory struct layout that Yul
`add(s, 0x20)` = field 1 expects. The PACKED/slotted divergence exists ONLY at the value-copy BOUNDARY blob (rep 1),
not inside the buffer.

Therefore the change is NOT a new memory model. It is: (a) merge `__memory` and `__yulmem` into ONE buffer with one
free-pointer convention, and (b) teach the safety gate that "Yul takes this ref's address" is a HANDLED use that
CONVERTS the ref to the shared buffer (instead of tainting it to value-copy). The existing pointer-model machinery
(address chains, in-place `mstore`, boundary serialization) then covers the rest.

This also structurally AVOIDS the prior silent miscompile: that bug was in value-copy whole-field RMW composition.
The pointer model mutates in place (one `mstore`), which is exactly what does NOT have the composition bug.

## 4. Proposed architecture

ONE per-function linear buffer shared by the high-level refs and Yul, with the EVM reserved layout:

- `bytes __mem` initialized as `__yulmem` is today: 128 bytes, free-ptr value `0x80` at slot `0x40`, heap from
  `0x80`. The high-level model's separate `uint __freeptr` local is RETIRED in favor of the in-buffer free pointer
  at `0x40` (so allocation and Yul's `mload(0x40)`/`mstore(0x40, ...)` agree).
- `malloc(size)`: `p = mload(0x40); __mem = grow(__mem, p + size); mstore(0x40, p + size); return p`.
- A high-level ref value IS an offset into `__mem`. A Yul memory op IS a slice/splice of `__mem`. They interoperate
  by construction: `mstore(s, v)` where `s` is a converted high-level struct writes field 0's slot.
- Boundary serialization (pointer <-> value-copy blob) is UNCHANGED and still fires at `this.x = a`, entry-point
  `return a`, `abi.encode*`, external `IFoo(x).m(a)` - see experimental-memory-model.md section 4. The blob stays
  packed; only the in-buffer form is 32-byte-slotted.

## 5. The load-bearing change: the safety gate

Today (SS6): convert a ref to the pointer model only if EVERY use is HANDLED, else fall back to value-copy. Add ONE
new HANDLED use-kind:

- A ref var whose address flows into a Yul memory op (`mstore(x, ...)`, `mload(x)`, `add(x, K)` feeding
  `mload`/`mstore`, or passed as the memory-pointer operand of any Yul builtin) is HANDLED: it must be on the
  shared-buffer pointer model. Union-find ties it into its alias group as usual; the group converts together.

Consequence preserved: anything still UNHANDLED (recursive structs, unsupported Yul builtins, wider-than-word dirty
writes we choose not to model) TAINTS -> value-copy fallback -> identical to today. Non-regression by construction.

## 6. Phasing (each phase VM-gated + corpus-diff == 0)

- **U0 - unify the buffer, behavior-identical.** Change the high-level model to allocate from the EVM reserved
  layout (`__mem` init = the `__yulmem` init; free-ptr at `0x40`; heap from `0x80`; retire the `uint __freeptr`
  local). NO Yul interop yet. GATE: forced-on corpus + full solidc/SDK suites give the byte-identical OK/FAIL set
  vs today (the P2.5 methodology: per-file diff = 0). This is the riskiest refactor; land it alone.
- **U1 - one buffer across the two passes.** Make `LowerInlineAssembly` and `LowerMemoryModel` share the same
  `__mem` local and the same free pointer (today `__yulmem` is self-declared per block; `__memory` per function).
  Decide pass order + a shared "this function uses linear memory" flag so exactly one buffer is declared. GATE: as
  U0 (still no new conversions; identical set).
- **U2 - the gate extension (the actual feature).** Classify Yul-address-of-a-high-level-ref as HANDLED and convert
  it. Now `mstore(s, v)` addresses the converted struct in `__mem`. GATE: VM-verify each newly-compiling target
  file (struct_v2, static_struct_v2, dirty_memory_struct, assembly_5, assembly_memory_write) executes with the
  EXPECTED value; corpus-diff shows ONLY gains, ZERO regressions.
- **U3 - width and packed fields.** Handle `mstore(s, wideVal)` into a narrow field (EVM stores the full 32-byte
  word; the value-copy boundary re-packs to the field width). Handle packed value-field structs (`uint8 a; bytes1 b`)
  living 32-byte-slotted in `__mem` but packed in the value-copy blob at the boundary. GATE: VM round-trip
  (Yul-write -> boundary-serialize -> read back) for each width combination in the target files.
- **U4 (optional, completeness).** Dynamic-array fields touched by Yul (`mstore(add(s, 64), ...)` into a struct
  with a `uint8[]` field, e.g. dirty_memory_struct); the `abi.encode`/extcall boundary from a Yul-touched struct.

## 7. Risks and mitigations

- **The prior silent miscompile.** Root cause was value-copy whole-field RMW of nested structs. This design does
  NOT use value-copy for the converted refs; it uses in-place `mstore` on the shared buffer. The failure mode is
  structurally absent. MITIGATION anyway: every phase is corpus-diff-gated (0 regressions) and every target file is
  VM-executed against its expected value, not just compiled.
- **Buffer-init reconciliation (0x40/0x80).** The one genuinely invasive refactor (U0). It touches every allocation
  site in `LowerMemoryModel`. Mitigation: land U0 alone behind the P2.5 byte-identity gate before any interop.
- **Two-pass coordination.** `LowerInlineAssembly` and `LowerMemoryModel` are separate passes with separate buffers.
  U1 unifies them; if ordering proves entangled, an alternative is a single shared "MemoryContext" the two passes
  both consult (buffer local name + free-ptr slot + the convertible set).
- **Dirty-bit / wider-than-word semantics.** EVM `mstore` into a `uint8` field writes a full word; the field's
  cleanup happens at the ABI boundary. On BCH the boundary serializer re-packs to the field width. These tests are
  semantically EVM-specific; they compile soundly but their assertions probe EVM cleanup. Document per file; do not
  claim EVM-bit-exactness.
- **Cost.** `mstore` copies the buffer (O(memsize)); the shared buffer is larger than either today. Acceptable for
  correctness-first; a chunked buffer is a later optimization (experimental-memory-model.md section 8).

## 8. Non-goals

- Recursive structs (`recursive_struct_2`, `struct_recursive_2`): unbounded layout, fundamental - out of scope.
- The `layout at` storage-layout specifier (`state_variable_struct`): a separate storage feature, unrelated.
- Byte-compatibility with EVM memory across chains: not needed (BCH covenant, no cross-chain memory interop).
- Nested-struct fields beyond the current pointer model (`b.a.x`): tracked separately in experimental-memory-model.md
  P6; this doc does not extend it.

## 9. Success criteria

Each phase lands only when: (1) forced-on corpus + full solidc/SDK suites show ZERO new failures vs the prior commit
(per-file diff), and (2) every newly-compiling target file is VM-executed and asserts the EXPECTED runtime value
(with a negative that must fail), never merely "it compiled". The value-copy fallback path is never removed, so the
whole effort remains reversible and non-regressing at every step.
