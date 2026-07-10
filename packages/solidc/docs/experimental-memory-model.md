# Experimental Solidity-compatible memory model - FINAL SPECIFICATION

Status: EXPERIMENTAL, flag-gated (`experimentalMemoryModel`). Reversible (flag off = strict no-op). Goal:
Solidity-faithful `memory` semantics on BCH - nested lvalue writes (`s.ts[j].y = v`) that COMPOSE across
statements, and reference aliasing (`b = a; b[0]=v` makes `a[0]==v`), neither of which the value-copy blob model
can express. Confirmed against ../solidity: memory reference types are POINTERS; a nested lvalue is a base
pointer + a chain of dereferences ending in ONE in-place store.

## 0. VM capabilities (post May-2026 upgrade) and implementation strategy

The BCH VM has **native loops** (`OP_BEGIN`/`OP_UNTIL`) and **native functions** (`OP_DEFINE`/`OP_INVOKE`);
loops are not unrolled and functions are real subroutines (see `GenerateTargetTraversal.ts` visitWhile/visitFor,
emitFunctionDefine). Unlocking bytecode up to 10KB; NFT commitment 128 bytes. This means dynamic-length memory
operations (allocate n words, copy/serialize an array of runtime length) are ordinary runtime loops - no
unrolling, no constant-length restriction.

The model is a **pure semantic desugar to existing language constructs** (`LowerMemoryModel` pass, flag-gated,
in `compiler.ts` before the value-copy desugars) - NO codegen changes. Primitives, verified at the language level:
- `mstore(p, w)` = `__memory = bytes.concat(__memory[0:p], <w as bytesN>, __memory[p+W:])`
- `mload(p)`     = `<decode> (__memory[p:p+W])`
- `malloc grow`  = `bytes.concat(__memory, new bytes(size))`  (runtime `new bytes(n)` = `0 n OP_NUM2BIN`)
- per-element serialize/deserialize at boundaries = a `for` loop over the array (native loop)

## 1. The buffer and pointers

Per-function heap: `bytes __memory` + `uint __freeptr`, threaded as function locals (init `("", 0)` at entry
when the function uses any convertible memory ref). Word size W = 32 bytes for value/pointer slots. A `memory`
reference-typed value (dynamic array, struct, bytes, string) is an INTEGER offset into `__memory`; value-typed
locals are unchanged.

- `malloc(size) -> ptr`: `ptr = __freeptr; __memory = bytes.concat(__memory, new bytes(size)); __freeptr += size`.
- `mload(p)/mstore(p,w)`: 32-byte slice/splice as above; int decode `uint(bytes32(..))`, encode `bytes32(v)`.

Cost: `mstore` copies the buffer (O(memsize)); acceptable for experimental, optimizable later.

## 2. Reference-type layouts

- **Dynamic array `T[]`**: ptr to `[ length(32) | e0(32) | e1(32) | ... ]`. Element = a value word or a pointer
  word (ref element). `new T[](n)`: malloc(32+n*32), store length. `a.length` = `mload(a)`. `&a[i] = a+32+i*32`.
- **Struct `S{f0..fk}`**: ptr to `[ f0(32) | ... | fk(32) ]`. `&s.fi = s + 32*i`. Ref-typed member holds a
  pointer. `S memory s;` = malloc(32*(k+1)) zero-init; `S(a0..ak)` = malloc + store each arg (pointer for refs).
- **Static array `T[N]`**: like dynamic without the length word; `&a[i] = a + i*32`.
- **`bytes`/`string` memory**: ptr to `[ length(32) | raw bytes ]`; byte-addressed. (Phase 4.)

## 3. The load-bearing rule: nested lvalue = address chain + single store

For `s.ts[j].y = v` (`S{T[] ts}`, `T{uint y}`): walk segments building the address; at each REFERENCE-typed step
`mload` to dereference; the value-typed leaf yields the final address; emit exactly one `mstore`.
```
a = s ; a = s+32*tsIdx ; P_ts = mload(a) ; a = P_ts+32+j*32 ; P_T = mload(a) ; a = P_T+32*yIdx ; mstore(a, v)
```
In-place and composing (two writes to `s.ts[j]` and `s.ts[k]` share the `ts` block). Reads are the same walk
ending in `mload`. Reference-to-reference assignment (`s.ts = other`) is a single pointer `mstore` (aliasing).

## 4. Boundary serialization (pointer <-> value-copy blob)

State, entry-point returns, `abi.encode*`, and external-call args speak the value-copy blob format. At each such
boundary the pointer is converted with a runtime loop (native `OP_BEGIN/OP_UNTIL`), so the buffer's internal
layout is decoupled from every external format:
- **serialize(ptr) -> blob**: read `n = mload(ptr)`; `for i in 0..n: out = concat(out, encode(mload(ptr+32+i*32)))`;
  prepend the blob's length framing. For ref elements, recurse (serialize the sub-object).
- **deserialize(blob) -> ptr**: allocate; loop to unpack each element into the buffer; return the pointer.

Boundaries that MUST serialize (else the pointer leaks as a small integer = wrong):
`this.x = a` (state write), entry-point `return a`, `abi.encode(a)`/`abi.encodePacked`, external `IFoo(x).m(a)`.
Solidity serializes contents at exactly these points; matching it here closes the correctness gap.

IMPORTANT (reframing after P2.5): the safety gate ALREADY makes all of these correct - a boundary use taints
the array, which then falls back to the value-copy path. So the `abi.encode` silent miscompile and the
return/state breaks are CLOSED by fallback. P3 serialization is therefore a COVERAGE/perf expansion - it lets an
array that is BOTH mutated and returned/stored/encoded use the pointer model for the mutations and serialize at
the exit, instead of falling back entirely. Not correctness-critical.

Serialization detail: value-copy packs a `uint256` element at `byteWidth = ceil(257/8) = 33` bytes (not 32), so
either (a) serialize with a runtime loop re-encoding each 32-byte word to the 33-byte packed element + a
minimal-push length prefix, or (b) store elements in the buffer at the packed width behind the fixed 32-byte
header so serialize is a straight-line prefix swap `pushdata(len) ++ block[32:]` (redesign of P1/P2 element
encoding, needs re-VM-verify). (b) is cleaner long-term.

## 5. Internal pass-by-reference

Solidity passes memory args to internal functions BY REFERENCE (callee mutations visible). Two sound lowerings:
- **Inline** the callee (existing inline path): one shared `__memory` scope - pointer + mutations just work.
- **Thread** `__memory`/`__freeptr` in and out of the `OP_DEFINE`/`OP_INVOKE` subroutine (like the existing
  `__internal__*` hidden params): callee allocates/writes in the shared buffer; caller adopts the returned buffer.

## 6. Safety gate (the non-regression guarantee)

The pass converts a memory local to a pointer ONLY when EVERY use of it - and of every variable in its alias
group - is a lowering the pass supports. Otherwise the variable (and its group) stays value-copy, exactly as
today. Mechanism, per function:
1. Collect candidate memory locals (declared as a handled memory ref type with a handled initializer).
2. Union-find alias groups over reference assignments (`b = a`, `T[] b = a`).
3. Walk every use; classify each as HANDLED (index r/w, `.length`, member r/w, nested chain, a boundary with a
   serializer, an internal call with pass-by-ref) or UNHANDLED. Any unhandled use taints the whole group.
4. Convert only untainted groups; tainted groups fall through to the value-copy path unchanged.

Consequence: **flag-on can never regress** - a handled program gets the pointer model, anything else behaves
exactly as flag-off. Each later phase (SS4, SS5, SS3-structs) moves more use-kinds from UNHANDLED to HANDLED,
shrinking the fallback set. This is the invariant that makes default-on safe, verified by running the corpus +
full suite with the flag forced on and getting ZERO new failures.

## 7. Phasing / STATUS

- **P1 foundation - DONE + VM.** flag; runtime `new bytes(n)` (`NewArrayNode.rawBytes`); pass skeleton.
- **P2 dynamic arrays (int/uint) - DONE + VM.** new/index-rw/length/aliasing. Gotchas: literal index `a[0]` is a
  TupleIndexOp (not ArrayAccess); `a.length` is UnaryOp(SIZE); every emitted node needs a stamped `.location`.
- **P2.5 SAFETY GATE - DONE + VERIFIED.** SS6 convertibility analysis (candidate fixpoint + union-find alias
  groups + taint walk over identifier AND name-keyed uses). Restricted handled element to 256-bit int/uint;
  `.length` decodes as bigint; `delete d[i]` lowers in place. VERIFIED non-regressing with the flag FORCE-ON:
  1906/1906 solidc tests + corpus 3837/4876 (>= 3834 baseline, ZERO new failures). This closes ALL correctness
  gaps (unhandled uses fall back to value-copy) and is the prerequisite for default-on.
- **P3 boundary serialization - RETURN + STATE-WRITE DONE + VM (COVERAGE, not correctness - see SS4).** `return a`
  and native `this.s = a` on a memory value-array no longer taint it: it stays a pointer (aliasing/composition work
  through the body) and a shared `serializeArray` helper emits `uint[] __ser = new uint[](a.length); while(i<len)
  __ser[i]=a[i];` at the boundary (reuses the value-copy `new T[]`+writes path, each elem mload'd from the buffer -
  no manual packed re-encode). State-write is native `this.s=a` only: bare `s=a` under solidityImportCompat is an
  AssignNode at AstBuilder time (state resolution is later, in SymbolTable) so it stays on value-copy fallback.
  abi.encode / extcall boundaries DEFERRED as narrow completeness: abi.encode(a) is already byte-identical
  flag-on/off (gate -> value-copy -> encodes CONTENTS not pointer), and the boundary is expression-context hoisting
  with low value (alias-then-encode is rare, common case already correct).
- **P4 internal pass-by-ref - TODO.** SS5 inline-or-thread. Closes `g(a)`.
- **P5a value-field structs - DONE + VM.** A `struct memory` with all-256-bit-int fields is a pointer to a block
  of field words: construct (`S(..)` -> malloc + store each), member read (`s.f` -> mload at `s+32*i`), field
  write (`s.f=v` desugars to `s=S(s.f0,v,..)` -> store each arg via read-all-into-temps-then-store so a
  self-referential rebuild/swap matches value-copy). Only a genuine `S(..)` ctor for s's own type converts
  (`s=someFn()` falls back). Aliasing + reference fields fall back via the gate. VM: MemoryModelStruct.test.ts.
- **P5b-arrays: array of value-field structs - DONE + VM.** `T[] memory arr` (T a value-field struct) is a
  length-prefixed block of struct POINTERS (separate `memStructArrays` track so value-element ops are untouched).
  `arr[i]=T(..)` -> alloc a T block + store its pointer at arr[i]; `arr[i].f=v` (MappingFieldAssignNode, lowered
  BEFORE DesugarNestedArrayWrite) -> a SINGLE in-place store at `mload(arr+32+i*32) + 32*fieldIdx` (the clean SS3
  approach - this is exactly the case value-copy MISCOMPILES via element-rebuild); `arr[i].f` read -> mload same
  addr; `arr.length` handled. Gate: standalone `arr[i]` (whole-struct read) taints (fall back); only `arr[i].f`
  chains + `arr[i]=T(..)` ctor convert. VM: MemoryModelStructArray.test.ts (elem field-write composition +
  loop build/update). NOTE: forced-on breaks one byte-identity test (StructsMappings `arr[i].f=v` == `arr[i]=S(..)`)
  BY DESIGN - the memory model lowers the two forms differently (in-place vs rebuild), both correct; flag-off
  passes. This is the real correctness win over value-copy.
- **P5b-fields: struct with ARRAY reference fields - DONE + VM.** `struct S{ uint[] a; uint n; }` - a ref field
  holds a pointer. `s.a[i]=v` pre-desugars to `uint[] tmp=s.a; tmp[i]=v; s=S(tmp,s.n)`; a GATE FIXPOINT
  co-discovers tmp as a candidate (its init `s.a` resolves to a ref-field pointer once s is known convertible),
  and unions tmp + candidate ctor-args with s so a group falls back together. resolvePtr(expr) does the recursive
  address chain (ident/FieldAccess/ArrayAccess, mload at each ref step) for reads (`s.a[i]`, `s.a.length`).
  Restricted to array ref fields (NESTED-STRUCT fields excluded - `b.a.x` falls back to value-copy). VM:
  MemoryModelStructField.test.ts (nested write composes + aliases the source array; loop over `s.a`). The full
  `s.ts[j].y` (struct with a struct-ARRAY field) still hits a pre-existing AstBuilder desugar gap ("Undefined
  mapping" - value-copy fails it too). GATE HOLES found+fixed (latent since P2.5): (1) a `using`-attached bound
  call `x.m()` is a FunctionCall whose identifier is the QUALIFIED name `x.m` (receiver baked into the name, not a
  child) -> taint the prefix; (2) struct member read `s.f` handled ONLY if f is a real field (else it is a bound
  fn); (3) an inline `new T[]` / non-candidate struct ctor ref-arg taints the struct; (4) a tuple assignment
  `(x,y)=g()` to a candidate taints it. VERIFIED non-regressing: flag-off and forced-on give the IDENTICAL
  3838/4876 OK/FAIL set (per-file diff = 0 regressions, 0 gains).
- **SOLIDITY FIDELITY (confirmed vs /Code/solidity):** the P5b-arrays byte-identity divergence
  (`arr[i].f=v` != `arr[i]=T(..)`) is the memory model being MORE correct. Memory struct-array elements are
  pointers; `arr[i].f=v` is an in-place mstore (aliases see it), `arr[i]=T(..)` allocates a new block + repoints
  (aliases do not) - reference-types.rst:71-73 + IRGeneratorForStatements.cpp. Value-copy collapses them (it has
  NO aliasing) = the artifact. The two byte-identity tests (StructsMappings, Arrays) encode value-copy behavior;
  they pass flag-off (default) and must be UPDATED to the memory-model behavior at default-on.
- **P6 bytes/string memory, wider element types, struct aliasing, nested-struct fields, full `s.ts[j].y` - TODO.**
- **DEFAULT-ON** once P2.5 holds and coverage is broad enough that the fallback set is small.

## 8. Non-goals / limits

- Not byte-compatible with EVM memory layout (no cross-chain memory interop needed).
- `__memory` is one stack element -> the live heap is bounded by the max stack-element size.
- `mstore` is O(memsize); optimize later if needed (chunked buffer).
- Every phase is behind the flag; the value-copy path is untouched, so the whole thing is reversible.
