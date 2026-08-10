# Coalescing consecutive field writes to the same mapping entry

## Problem

A run of writes to different fields of the SAME struct-valued mapping entry, e.g. Unicrow's `refund`:

```solidity
escrows[escrowId].split      = escrow.split;
escrows[escrowId].consensus  = escrow.consensus;
escrows[escrowId].claimed    = 1;
```

Each `m[k].f = v` on a vmap (sorted) mapping compiles to a FULL entry read-modify-write via `emitSortedValueUpsert`
- read the entry, splice one field, re-chunk, pin, and co-spend the entry UTXO. So three field writes = three whole
upserts, each carrying the sorted-linked-list covenant machinery. The older entry backend chained consecutive
same-entry writes (`pendingEntryWrites`), but the initial vmap path did not. The legacy backend has since been removed;
this document records the coalescing work that brought the mandatory vmap path to read-once/write-once behavior.

Measured cost (uint256[3]-field struct, vmap): one field write ~1111 B; two ~1888 B (each extra field ~+777 B);
read-once/write-once ~1213 B. So two fields is -36%, and it grows with the number of fields.

## Transformation

`CoalesceMappingEntryFieldWrites` collapses a maximal run of consecutive whole-field writes to the same entry into
ONE entry read + ONE whole-struct write:

```
S __mefw = escrows[escrowId];                       // read the entry once
escrows[escrowId] = Escrow(__mefw.buyer, .., escrow.split, escrow.consensus, .., 1 /*claimed*/, ..);  // write once
```

Unwritten struct fields are carried through from the read temp; written fields use their new value (last write wins).
When the run writes EVERY struct field, the read is skipped entirely (`escrows[k] = Escrow(<all values>)`). The output
is a `VariableDefinitionNode` + a whole-struct `MappingAssignNode` - nodes every pipeline already lowers, so the pass
needs no downstream desugaring and runs identically in the standalone and referenced-contract pipelines.

## Soundness

`m[k].f = v` on a fresh key creates the entry with `f = v` and other fields at their type default; on an existing key
it replaces `f` and preserves the rest. Reading the whole entry into a temp, replacing the written fields, and writing
the whole struct back reproduces both cases exactly (a fresh-key read yields the zero struct, Solidity parity).

The rebuild evaluates field values in STRUCT-FIELD order, not statement order, so it fires only under two conservative
gates that make the reorder observationally identical:

- **No value reads the same entry `m[k]`** - a self-read (`m[k].b = m[k].a`) would need the progressively-updated
  entry; skipped (left as individual writes).
- **No value has side effects** (no call / instantiation / assignment expression) - pure values are order-independent.

Plus: same collection (a `sorted`/vmap struct-valued mapping), keys structurally equal across the run and side-effect
free (a stable entry), and only whole-field writes (`keys.length == keyCount`; array-ELEMENT writes `m[k].a[i]=v` are
left alone). Runs of >= 2 writes coalesce.

## Placement

Runs after `RedesugarImportedStructFieldWrites` (state mapping-field writes are still `MappingFieldAssignNode`s there -
that pass only rewrites LOCAL struct field writes) and before the local-struct coalescing + `LowerMemoryModel`.
Composes with [coalesce-struct-field-array-writes](./coalesce-struct-field-array-writes.md): the earlier local
`escrow.split[i]=v` element writes are folded first, then this pass writes the finished struct back in one upsert.
