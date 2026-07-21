# Coalescing consecutive struct-field array-element writes

## Problem

A run of writes to elements of the SAME fixed-array field of a `memory` struct local, e.g. Unicrow's
`refund`:

```solidity
escrow.split[WHO_BUYER]      = 10000;
escrow.split[WHO_SELLER]     = 0;
escrow.split[WHO_MARKETPLACE]= 0;
escrow.split[WHO_PROTOCOL]   = 0;
```

is desugared by the front end (AstBuilder for same-file structs, `RedesugarImportedStructFieldWrites`
for imported ones) into ONE read-modify-rebuild triple PER element write:

```
tmp = escrow.split;               // read the whole field
tmp[i] = v;                       // write one element
escrow = Escrow(tmp, ...12 other fields read back from escrow...);   // REBUILD the whole struct
```

So four element writes = four whole-`Escrow` (13-field) reconstructions. On the BCH VM each rebuild is a
byte-serialization of every field (CAT / NUM2BIN / SPLIT), and `Escrow` is large, so this dominates the
size of `refund` / `challenge` / `release`. This is pure redundancy: the intermediate structs are never
observed.

## Transformation

A new pre-`LowerMemoryModel` pass, `CoalesceStructFieldArrayWrites`, detects a maximal run of consecutive
such triples that target the SAME struct local `base` and SAME field `FIELD`, and collapses the N reads +
N rebuilds into ONE read + N element writes + ONE rebuild:

```
__csf = escrow.split;             // read once
__csf[0] = 10000;
__csf[1] = 0;
__csf[2] = 0;
__csf[3] = 0;
escrow = Escrow(__csf, ...others...);   // rebuild once
```

### W2 refinement (whole-array constant cover)

When the element writes use constant indices that cover the whole fixed array `[0 .. bound-1]` exactly and
NO value reads `base.FIELD`, the field read and the element writes are replaced by a single array literal
in index order, skipping the read entirely:

```
escrow = Escrow([10000, 0, 0, 0], ...others...);   // one rebuild, no field read
```

## Soundness

Let the run be `base.FIELD[i_j] = v_j`, j = 0..N-1, consecutive, nothing else between them.

- Each desugared rebuild replaces ONLY `FIELD`; every other constructor argument is a pure
  `base.otherField` read. So across the run only `base.FIELD` changes; `base.otherField` is invariant.
  The coalesced rebuild reuses the LAST triple's constructor verbatim (only swapping the FIELD argument),
  so its other-field reads evaluate to the same values they did in the original last rebuild.
- A value `v_j` may read the field being written (`escrow.consensus[k] = abs8(escrow.consensus[k])`). In
  the original, that read observes the field as progressively updated by the earlier rebuilds. The single
  running temp `__csf` accumulates the same writes in the same order, so every `base.FIELD` read inside a
  value is rewritten to `__csf`, preserving both own-index and cross-index self-reads
  (`a[0]=5; a[1]=a[0]` still sees `a[0]==5`).
- W2 fires only when no value reads `base.FIELD` (so the read is dead) and the constant indices tile the
  whole array (so no pre-existing element survives) - then the literal is observationally identical.

### Guards (fail closed - leave unoptimized)

- `base` is a plain identifier; the rebuild assigns back to that same identifier.
- The temp is a fresh front-end lvalue temp (`__nlv_*` / `__inlv_*`) used only as the ArrayAssign target
  and the constructor's FIELD argument.
- Exactly one constructor argument is the temp; all others are `FieldAccess(base, _)` reads.
- Both the flat triple (same-file structs) and the `BlockNode`-wrapped triple (imported structs) are
  matched; a run must be >= 2 units to coalesce.

## Placement

Runs after `RedesugarImportedStructFieldWrites` (so imported-struct triples exist) and before
`LowerMemoryModel` (which lowers the rebuild to byte ops), alongside the other struct/array desugars.
