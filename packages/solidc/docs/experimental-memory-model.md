# Experimental Solidity-compatible memory model

Status: EXPERIMENTAL, flag-gated (`experimentalMemoryModel`). Reversible. Goal: make nested memory lvalue writes
(`s.ts[j].y = v`) compose correctly across multiple statements, which the value-copy read-modify-write model
cannot (it re-encodes stale aggregate snapshots - see the reverted attempts and `docs/`-noted findings). Mirrors
how solc compiles memory: a nested lvalue is a base pointer + a chain of dereferences/offsets ending in a single
in-place store (confirmed against ../solidity IRGeneratorForStatements + ArrayUtils).

## 0. Implementation strategy: SEMANTIC DESUGAR to bytes ops (no codegen changes)

The whole model lowers to a SEMANTIC PASS (`LowerMemoryModel`, flag-gated) that rewrites memory reference-type
operations into ordinary `bytes` operations on a `bytes __memory` local + `uint __freeptr` local. The existing
codegen already compiles all of these - VERIFIED at the language level:

- `mstore(p, word)`  ->  `__memory = bytes.concat(__memory[0:p], bytes32(word), __memory[p+32:])`
- `mload(p)`         ->  `uint(bytes32(__memory[p:p+32]))`
- `malloc` growth    ->  `__memory = bytes.concat(__memory, bytes32(0))` per 32-byte word

No stack-machine surgery, no branch-snapshot fixups, no new codegen - the pass emits normal AST (bytes slices,
`bytes.concat`, `bytes32`/`uint` casts, loops, assignments) the compiler already handles. This is the load-bearing
simplification. The only rough edge: `new bytes(n)` with a RUNTIME length is rejected, so a runtime-sized
zero-fill (allocating `new T[](n)` with runtime n) grows the buffer with a small `for` loop of `bytes32(0)`
appends; compile-time sizes (a struct's field count) grow by a constant number of words.

## 1. Runtime linear memory buffer

Memory is a single per-function byte blob `__mem` plus a free pointer `__fmp` (a uint), both function-scoped
locals threaded through the whole body (initialized at entry: `__mem = 0x` (empty), `__fmp = 0`). Word size is
32 bytes (EVM layout parity; the *byte order within a word* is an internal detail - we never interoperate with
EVM memory, we only need the LAYOUT for composition correctness).

Primitives (codegen helpers over `OP_CAT` / `OP_SPLIT` / `OP_SIZE` / `OP_NUM2BIN` / `OP_BIN2NUM`):

- `malloc(size) -> ptr`: `ptr := __fmp; __mem := __mem ++ zeros(size); __fmp := __fmp + size`. Returns the block
  start. `zeros(size)` = `OP_0 <size> OP_NUM2BIN` (size-byte zero blob).
- `mload(ptr) -> word32`: `__mem[ptr : ptr+32]`. `OP_SPLIT(__mem, ptr) -> [_, r]; OP_SPLIT(r, 32) -> [w, _]`.
- `mstore(ptr, word32)`: `__mem := __mem[0:ptr] ++ word32 ++ __mem[ptr+32:]`.
  `OP_SPLIT(__mem, ptr) -> [l, r]; OP_SPLIT(r, 32) -> [_old, rest]; __mem := l ++ word32 ++ rest`.
- `mloadInt(ptr) -> int`: `OP_BIN2NUM(mload(ptr))`. `mstoreInt(ptr, n)`: `mstore(ptr, OP_NUM2BIN(n, 32))`.
- `mstore8`, byte-array packing: later (bytes/string memory).

Cost: each `mstore` copies the whole buffer (O(memsize)). Acceptable for experimental correctness; optimize later
(chunked buffer / in-place OP_SPLIT tricks) if it matters.

## 2. Memory reference types = integer pointers

A `memory` reference-typed local (struct, dynamic array, bytes) is an INTEGER (offset into `__mem`), not a blob.
Value-typed locals stay as-is.

- **Dynamic array `T[]`**: pointer to `[ length(32) | elem0(32) | elem1(32) | ... ]`. Element = a 32-byte word
  (value type) or a 32-byte pointer (reference type). `stride = 32`.
  - `new T[](n)`: `p := malloc(32 + n*32); mstoreInt(p, n)`. Elements zero (null pointer for ref elems).
  - `a.length`: `mloadInt(a)`.
  - `a[i]` address: `a + 32 + i*32`. Read = `mload`/`mloadInt` of it; ref element = the pointer stored there.
- **Struct `S{f0,f1,...}`**: pointer to `[ f0(32) | f1(32) | ... ]`. member `fi` at `p + 32*i`. Ref-typed member
  holds a pointer.
  - `S memory s;`: `s := malloc(32 * numMembers)` (zero-init; ref members are null until assigned).
  - `S(a0,a1,...)`: `p := malloc(32*k); mstore(p, a0); mstore(p+32, a1); ...` (store the pointer for ref args).
  - `s.field` address: `s + 32 * fieldIndex`.
- **Static array `T[N]`**: same but no length word; `a[i]` at `a + i*32`; `memoryDataSize = N*32`.
- **`bytes`/`string` memory**: pointer to `[ length(32) | packed bytes ]`; stride 1, `mstore8` for byte writes.
  Phase 3.

## 3. The load-bearing rule: nested lvalue = address chain + single store

For `s.ts[j].y = v` (`S{ T[] ts }`, `T{ uint y }`):

```
addr := s                              // S block pointer
addr := s + 32*tsIndex                 // &s.ts (ts is a ref field)
P_ts := mloadInt(addr)                 // deref -> ts array pointer
addr := P_ts + 32 + j*32               // &ts[j] (element is a ref -> struct T)
P_T  := mloadInt(addr)                 // deref -> T block pointer
addr := P_T + 32*yIndex                // &y (value type -> final address)
mstoreInt(addr, v)                     // SINGLE in-place store
```

Rule: walk the lvalue segments building the address; at every step whose static type is a REFERENCE type,
`mloadInt` to dereference to the next block; the leaf (a value type) yields the final address; emit exactly one
`mstore`. **This is in-place and composes** - two writes to `s.ts[j].y` and `s.ts[k].y` share the same `ts`
block; no aggregate is copied. Reads are the same chain ending in `mload` instead of `mstore`.

Reference-to-reference assignment (`s.ts = otherArr`) is a single pointer `mstore` (aliasing, like solc), NOT a
deep copy - matches EVM memory semantics.

## 4. Threading `__mem` / `__fmp`

Both are ordinary function-scoped locals on the stack (tracked by the stack tracker). `malloc`/`mstore` read the
current `__mem`/`__fmp`, compute the new value, and write it back to the same slot (in-place local update, the
existing mechanism for reassignable locals). Initialized to `(0x, 0)` at function entry when the function uses
any memory reference type. Passing a memory ref to another function passes the POINTER (pass-by-reference, which
is *more* correct than the current copy); the callee shares the caller's `__mem` (threaded as a hidden in/out
param) - Phase 4 (start intra-function only).

## 5. Scope / phasing

- **P1 (foundation):** buffer + malloc/mload/mstore/mloadInt/mstoreInt codegen helpers; VM-verify via direct unit
  tests. Add the `experimentalMemoryModel` flag.
- **P2 (dynamic arrays):** `new T[](n)`, `a.length`, `a[i]` read/write for value elements; VM-verify multi-write
  composition. Wire only when the flag is on and the local is a memory dynamic array.
- **P3 (structs + nested chains):** memory struct alloc/construct, member access, and the §3 address-chain
  lvalue for arbitrary `s.f[i].g[j]...` reads and writes. VM-verify `s.ts[j].y` multi-write (the target).
- **P4 (bytes/string memory, cross-function pass-by-ref, returns).**

Every phase is behind the flag; the default (value-copy) path is untouched, so this is fully reversible.

## 6. Non-goals / risks

- Not byte-compatible with EVM memory (internal word byte-order differs); fine, no cross-chain memory interop.
- Buffer copy cost per store is O(memsize); experimental, optimize later.
- Stack depth: `__mem` is one (large) stack item; deep functions with many locals must stay within limits.
- Interaction with state encoding (a memory struct written to state) must convert pointer-model -> the existing
  pushdata blob at the state-write boundary (Phase 3+ boundary shim).
