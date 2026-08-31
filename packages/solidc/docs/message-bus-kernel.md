# Message-bus kernel (compiler calling convention)

Status: normative for **kernel-shaped** contracts. The on-wire envelope remains
[`atomic-message-bus-protocol.md`](./atomic-message-bus-protocol.md). Journal read/write/flush rules remain
[`state-journal-protocol.md`](./state-journal-protocol.md). This document is the compiler convention that
sits between those two: how a handler is an `OP_DEFINE` body, how the route wrapper is the only layout
owner, and which shapes are refused with a closed reason set.

Marketplace-scale and other contracts that do not yet match this convention keep the **legacy** path in
`synthesizeMessageBusRoute` (handler clones, AST row unroll, existing `messageBusRejectionReason` strings).
Legacy is not extended with new clone families or admission flags. Kernel work lands on toys first.

Related: [`journal-and-message-bus.md`](./journal-and-message-bus.md),
[`buffered-state-and-message-bus-research.md`](./buffered-state-and-message-bus-research.md),
[`call-model.md`](./call-model.md), [`message-bus-coverage-matrix.md`](./message-bus-coverage-matrix.md).

---

## 1. What this is for

Bitcoin Cash has no nested `CALL`. A state UTXO is spent once. Several logical invocations of one owner
therefore share one physical input, one journal, and one flush. Cross-owner composition authenticates a
single call manifest. That is the protocol.

The kernel is how the **compiler** expresses it:

- A **handler** is a reusable subroutine. It does not own `blockLayout`.
- A **route wrapper** (artifact selector `53434231`) is the only function with a block layout. It
  prefetches, loops rows, invokes handlers, concatenates results, appends effects, flushes, and binds
  the verifier.
- `maximumRows` is a **runtime** bound (`require(rowCount <= maximumRows)`). It is not an AST unroll
  count.

The interpreter to grow is the loop `assembleMessageBusRowStatements` already emits when a route is
not in collection/array/signature/resource mode:

```text
for (bigint row = 0; row < rowCount; row = row + 1) {
  parseOneRow(row);
}
```

Kernel work extends that loop to results and effects. It does not introduce a new bytecode format, a
new envelope domain, or a new `artifact.messageBus` version. Additive handler metadata is allowed.

---

## 2. Handler ABI

A kernel handler is compiled as an internal function (`OP_DEFINE` / `OP_INVOKE`). Documented on
`artifact.messageBus.handlers[]` the same way as today (`name`, `selector`, `inputs`, `outputs`,
`eligible`, footprints). The body must not require its own authenticated input/output template.

Stack / value convention (logical; codegen may use the existing value-threaded journal lowering):

```text
in:  logical caller / msg.sig / msg.data / msg.value when the handler uses them
     user arguments decoded from the row blob (not from __message_bus_*_rN route parameters)
     pending journal values for the entries this handler may touch
out: updated pending values in the same order
     optional ABI result (the wrapper concatenates abi.encode(...) into __message_bus_results)
     optional effect records appended to the wrapper's effect table
```

Keys for mapping/collection entries come from **row arguments** or a published non-row-indexed witness
(for example a single `msg.sender` that every row shares). They do not become `_r${row}` parameters on
the route ABI.

`external` handlers may be invoked through one internal alias whose body is the same define. The kernel
does not emit `__message_bus_graph_*`, `__message_bus_array_*`, `__message_bus_resource_*`, or
per-row cloned bodies.

---

## 3. Route wrapper (controller)

Selector `53434231` (`SCB1`). Inputs remain `batchBlob` plus the existing compact-binder /
graph / msg.sender-category parameters. Kernel routes **omit** per-row key and signature witness
parameters.

Execution order:

1. Parse `batchBlob` with the existing `__message_bus_parse_row` helper (and graph caller stream when
   the contract is a graph participant).
2. Prefetch authenticated state for the published footprint (the journal wrapper already does this for
   parameter-keyed mapping helpers and scalar internals).
3. `require(rowCount <= maximumRows)` with `maximumRows` from the artifact (8 for ordinary kernel
   routes; the legacy resource batch of 2 is not a kernel shape).
4. For each `row` in `[0, rowCount)`:
   - bind logical `msg.sender` / `msg.sig` / `msg.data` / `msg.value` from the row;
   - dispatch `rowSelector` to a handler `OP_INVOKE` (unknown selector → `revert("unknown batch selector")`);
   - concatenate ABI results into one `bytes` accumulator when any selected handler returns;
   - append events / BCH transfers / token effects to the wrapper's effect table.
5. Flush each dirty journal location once; emit the existing state and effect covenants.
6. Bind the participant verifier (compact binder + `artifact.messageBus.verifierProgram`).

Generated locals inside the loop are **reused across iterations**. Codegen must not bake `rowIndex`
into names such as `__message_bus_value_${rowIndex}_${handlerIndex}_${field}`. That naming is why
legacy `resultMode` unrolls `if (rowCount > i)` copies.

`parseOneRow` already accepts a runtime `rowExpression`. Kernel dispatch always passes `'row'` (the
loop variable), never a compile-time integer.

---

## 4. Eligibility

A contract uses the kernel path when **every** handler the route would dispatch is kernel-shaped:

- no `sig` / `sig[]` parameters (those cannot live in the envelope);
- no dedicated resource-shaped handler that owns a fixed per-row physical frame as route ABI;
- no `_r${row}` witnesses required for soundness;
- results and effects (events, BCH, token-container, **typed external calls**) can be appended in
  the loop (concat / effect table / authenticated emission context on one `OP_INVOKE`);
- no frozen-forbidden construct (section 5).

Otherwise the contract stays on the **legacy** path: current clones, current unroll, current
`messageBusRejectionReason` strings. A Marketplace-shaped handler is kernel-eligible when its keys
and calls have a loop representation; the whole contract stays legacy only while some sibling still
needs `_rN` witnesses or a frozen-forbidden construct.

An explicit compiler option `messageBusKernel: true` (when added) **requires** the kernel path and
fails with a `KERNEL_*` reason instead of falling back to legacy.

---

## 5. Frozen forbidden reasons

Kernel-path toys and `messageBusKernel: true` compiles may only refuse bus admission with these codes
(plus ordinary SolidCash type/parse errors). Do not add a new code without changing this document and
every kernel toy.

| Code | Means | Not this |
| --- | --- | --- |
| `KERNEL_LIFECYCLE` | `deploy`, `upgrade`, `selfdestruct`, or `unsafe` as a **bus row** | Implementation functions that run in this participant's delegate/proxy frame |
| `KERNEL_TX_SIGNATURE` | A transaction `sig` / `sig[]` in the row or envelope | `ecrecover` / ECDSA over **data** (existing compute sidecar) |
| `KERNEL_UNBOUNDED_KEY` | A counter-keyed `m[i]` loop (`i < n`) or a locally constructed key array whose length is not a compile-time `N <= 64` | Parameter-keyed, `msg.sender`-keyed, expression-keyed (`m[jobs.length-1]`), parameter-array loop (`m[k][xs[i]]`), or literal `new T[](N)` local (unrolled to scalar writes) |
| `KERNEL_FOREIGN_DELEGATE` | `delegatecall` to a foreign executor treated as this participant's owner | `delegate` on this contract's own implementation |
| `KERNEL_OPAQUE_EFFECT` | Inline assembly or a low-level call the journal cannot summarize as a call/effect row | After Solidity-compat lowering to `call` plus returndata |
| `KERNEL_LAYOUT` | The handler would need its own block layout (for example a deploy inside the handler) | Journaled state accessed through the wrapper |

Legacy `messageBusRejectionReason` strings (`dynamic-and-collection-route-not-enabled`,
`atomic-delegate-context-unpreservable`, …) remain on the legacy path only so existing diagnostics
stay stable.

If a toy needs a capability that is not in this table, change **this spec** and the toys. Do not add
`__message_bus_*` clone families or admission-ladder flags.

---

## 6. Journal

[`state-journal-protocol.md`](./state-journal-protocol.md) is unchanged: one pending value per
location, read-your-writes, one authenticated flush, untouched locations preserved.

Kernel handlers use the existing value-threaded lowering where it already applies:

- scalar internals stored once and `OP_INVOKE`d (`ScalarJournal`);
- parameter-keyed mapping helpers that receive and return the pending entry
  (`LowerCollectionJournalHelpers`).

The route wrapper (or an ordinary physical entry such as `apply`) remains the layout owner that
performs the authenticated read and the single write-back. A kernel handler must not reach a raw
`MappingAssign` / dynamic chunk write with no journal frame; that is `KERNEL_LAYOUT` or the existing
split diagnostic when dynamic storage and a collection do not share one exit.

Effects (events, BCH, FT/NFT) stay **adjacent** to the journal, not journal values. The kernel
appends them from the loop; it does not unroll one covenant site per compile-time row index.

---

## 7. Wire and artifact compatibility

Unchanged:

- envelope domain `L3C1`, call-manifest domain `L3BUS1\0\0`, verifier commitment prefix `L3V1`;
- selector `53434231`;
- `artifact.messageBus.version === 1`;
- participant blocks, verifier NFTs, fee/change tail as in the atomic protocol;
- SDK-derived absolute indices; application source still supplies none.

Kernel artifacts should not require `_r${row}` route inputs. Row arguments stay in the manifest
`arguments` bytes. Return `position` in the manifest remains the logical row index; only redeem
bytecode becomes a loop.

---

## 8. Tests (kernel toys)

Compiler: `packages/solidc/test/journal-message-bus/KernelLoopRoute.test.ts` (loop vs
`if (rowCount > i)` copies; returning scalar plus void `add`; unknown selector; `maximumRows`).

Journal: existing `ScalarJournal.test.ts` and `CollectionJournal.test.ts` remain the controller
evidence; kernel work must not regress them.

SDK: `packages/solidcash/test/journal-message-bus/e2e/KernelLoopCompose.test.ts` composes two logical
calls on a kernel toy through the existing envelope and `vm.evaluate`.

Marketplace owned-only compile is **not** a kernel gate. It may stay on the legacy unroll until a
separate cutover.

---

## 9. Cutover

Kernel toys now cover the designed eligibility class:

- returning ERC-20-shaped mapping handlers (`return true` after a parameter-keyed write);
- satoshi transfers, events, and token-container FT/NFT transfers appended from the row loop
  (X29 site = runtime `row`; one co-spent `tokenContainer` input plus `sites × tokenTransferWidth`
  `tcTransfer` outputs);
- `msg.sender` as a mapping key without `_r${row}` ABI;
- `delegate` implementation functions in this participant's owner frame.

Compiler evidence: `KernelLoopRoute.test.ts`, `KernelCutoverRoute.test.ts`. SDK: `KernelLoopCompose.test.ts`,
`KernelCutoverCompose.test.ts`. Resource-shaped per-row frames, transaction `sig` rows, counter-keyed
`m[i]` loops, and foreign `delegatecall` stay on the legacy unroll. Typed external calls and literal
`new T[](N)` key arrays use the row loop (`__message_bus_handler_*` DEFINE, not `__message_bus_graph_*`).
