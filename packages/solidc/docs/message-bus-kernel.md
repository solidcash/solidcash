# Message-bus kernel (compiler calling convention)

Status: normative and default for message-bus contracts. The on-wire envelope remains
[`atomic-message-bus-protocol.md`](./atomic-message-bus-protocol.md). Journal read/write/flush rules remain
[`state-journal-protocol.md`](./state-journal-protocol.md). This document is the compiler convention that
sits between those two: how a handler is an `OP_DEFINE` body, how the route wrapper is the only layout
owner, and which shapes are refused with a closed reason set.

Unsupported handlers are refused independently with the closed `KERNEL_*` catalog below; they do not move the
whole artifact back to the historical implementation. `messageBusKernel: false` is the explicit compatibility
escape hatch for reproducing the **legacy** clone/unroll convention and its old rejection strings. Legacy is not
extended with new clone families or admission flags.

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

The interpreter to grow is the loop `assembleMessageBusRowStatements` emits for every admitted kernel
surface:

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
graph / msg.sender-category parameters. Kernel routes **omit** compile-time `_r${row}` key and signature
bands. Each scalar source `sig` parameter contributes one aligned `sig[] ..._rows` route witness, and each
source `sig[]` contributes an aligned `sig[][] ..._rows` witness. Transaction signatures stay outside the
committed row blob and the runtime loop selects element `row`.

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

A contract with a message-bus route uses the kernel calling convention by default. An explicit
`messageBusKernel: true` selects the same behavior. Admission is decided **per handler**:
kernel-shaped handlers are dispatched by the row loop and
unsupported siblings remain published with a `KERNEL_*` refusal:

- scalar `sig` and one-dimensional `sig[]` parameters are aligned positional route witnesses and are finalized
  against the selected handler body; deeper source signature-array dimensions remain refused;
- no dedicated resource-shaped handler that owns a fixed per-row physical frame as route ABI
  (param-keyed `from`/`to` alternatives journal as two slots of the same row);
- no `_r${row}` witnesses required for soundness (`msg.sender` is a shared published identity;
  argument and expression keys are decoded from the row);
- results and effects (events, BCH, token-container, **typed external calls**) can be appended in
  the loop (concat / effect table / authenticated emission context on one `OP_INVOKE`);
- no frozen-forbidden construct (section 5).

`messageBusKernel: false` keeps the **legacy** path as a temporary compatibility escape hatch:
current clones, current unroll, and current `messageBusRejectionReason` strings. A
Marketplace-shaped handler is kernel-eligible when its keys and calls have a loop representation.
Under the kernel convention, an unsupported sibling is refused without demoting eligible siblings.

The default kernel convention requires kernel admission. Ineligible handlers publish
`KERNEL_*` reasons instead of the legacy admission catalog. The resolved convention is published as
`artifact.messageBus.convention` (`legacy-unroll` | `kernel-row-loop`) and
`artifact.messageBus.available` (false when every handler is refused). `this.activeBytecode` /
`this.activeInputIndex` are stable owner introspection on the kernel path only.

---

## 5. Frozen forbidden reasons

Kernel-path toys and `messageBusKernel: true` compiles may only refuse bus admission with these codes
(plus ordinary SolidCash type/parse errors). Do not add a new code without changing this document and
every kernel toy.

| Code | Means | Not this |
| --- | --- | --- |
| `KERNEL_LIFECYCLE` | `deploy`, `upgrade`, `selfdestruct`, or `unsafe` as a **bus row** | Implementation functions that run in this participant's delegate/proxy frame |
| `KERNEL_TX_SIGNATURE` | A transaction-signature shape that cannot be represented by the aligned route witnesses (notably source `sig[][]` or deeper, or a signature check with no representable signature parameter) | Scalar `sig` (aligned `sig[] ..._rows`), source `sig[]` (aligned `sig[][] ..._rows`); `ecrecover` / ECDSA over **data** (existing compute sidecar) |
| `KERNEL_UNBOUNDED_KEY` | A locally constructed key array whose length is not a compile-time `N <= 64`; a counter-keyed mapping loop whose exact iteration domain is not one of the canonical forms; a counter loop with `continue`, `break`, early `return`, or mutation of its counter/public bound; or a counter loop that repeats a fixed-slot effect (event, BCH transfer, or token-container transfer) | Parameter-keyed, `msg.sender`-keyed, expression-keyed (`m[jobs.length-1]`), parameter-array loop (`m[k][xs[i]]`), literal `new T[](N)` local (unrolled to scalar writes), canonical counter-keyed `for (int i = 0; i < n; i = i + 1)` (domain `n`) or `int i = 0; do { ...; i = i + 1; } while (i < n)` (domain `max(n, 1)`) over `m[i]` / nested `m[k][i]`, or those rewrites beside source-order typed external calls / invariant `if`/`switch` |
| `KERNEL_FOREIGN_DELEGATE` | `delegatecall` to a foreign executor treated as this participant's owner | `delegate` on this contract's own implementation |
| `KERNEL_OPAQUE_EFFECT` | Inline assembly or a low-level call the journal cannot summarize as a call/effect row | After Solidity-compat lowering to `call` plus returndata |
| `KERNEL_LAYOUT` | The handler would need its own block layout (for example a deploy inside the handler) | Journaled state accessed through the wrapper; `new LockingBytecodeP2PKH` / `P2SH20` / `P2SH32` / `NullData` constructors (not child deploys) |

Legacy `messageBusRejectionReason` strings (`dynamic-and-collection-route-not-enabled`,
`atomic-delegate-context-unpreservable`, …) remain on the legacy path only so existing diagnostics
stay stable.

The frozen catalog is not a list of features supplied by legacy. Legacy also refuses transaction-signature
arrays, lifecycle/unsafe rows, opaque assembly, and foreign delegate execution (under its older diagnostic
names). The compatibility escape exists for bytecode/ABI reproduction and for the small set of historically
admitted clone-owned layouts; it is not a general fallback for a kernel refusal. In particular, default kernel
compilation never silently emits the legacy unroll: if an admitted survivor cannot use the row loop, that is an
internal compiler invariant violation.

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
appends them from the outer message-row loop; it does not unroll one covenant site per compile-time row index.
An effect site inside a counter-keyed inner loop is different: it can execute repeatedly within one row and
remains refused until the effect frame has an inner-iteration dimension.

---

## 7. Wire and artifact compatibility

Unchanged:

- envelope domain `L3C1`, call-manifest domain `L3BUS1\0\0`, verifier commitment prefix `L3V1`;
- selector `53434231`;
- `artifact.messageBus.version === 1`;
- participant blocks, verifier NFTs, fee/change tail as in the atomic protocol;
- SDK-derived absolute indices; application source still supplies none.

Kernel artifacts should not require `_r${row}` route inputs. Row arguments stay in the manifest
`arguments` bytes; scalar and one-dimensional transaction-signature arrays are the deliberate exception and use
one aligned `_rows` array per handler parameter because committing them into the manifest would be circular. Return `position` in
the manifest remains the logical row index; only redeem bytecode becomes a loop.

---

## 8. Tests (kernel toys)

Compiler: `packages/solidc/test/journal-message-bus/KernelLoopRoute.test.ts` (loop vs
`if (rowCount > i)` copies; returning scalar plus void `add`; unknown selector; `maximumRows`).

Journal: existing `ScalarJournal.test.ts` and `CollectionJournal.test.ts` remain the controller
evidence; kernel work must not regress them.

SDK: `packages/solidcash/test/journal-message-bus/e2e/KernelLoopCompose.test.ts` composes two logical
calls through the existing envelope and `vm.evaluate`, including two selected scalar-signature rows, two selected
signature-array rows, and unsigned sibling-only batches that must not request an unrelated signer.

The broad journal/message-bus suites remain the regression gate for the default convention. Tests that describe
the historical wire implementation must opt into it with `messageBusKernel: false`.

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
`KernelCutoverCompose.test.ts`. Scalar transaction `sig` and source `sig[]` rows use aligned route witnesses;
source `sig[][]` and deeper remain `KERNEL_TX_SIGNATURE`. Foreign `delegatecall` remains
`KERNEL_FOREIGN_DELEGATE`. The legacy convention
retains its historical admission behavior and diagnostic names, but does not make these unsafe shapes admissible.
Typed external calls, collection-plus-typed-call handlers (a mapping journal clone promoted
onto the graph `OP_INVOKE` frame), interface-typed state receivers (`this.data.userRegistered(..)`),
literal `new T[](N)` key arrays, counter-keyed `m[i]` loops,
cross-handler `msg.sender` / argument keys, public mapping getters, expression-keyed second
alternatives, nested-branch / helper-inlined expression keys (`if (byWorker) m[id][job.worker]`),
mapping field writes, complete fixed-array `T[N]` identity sets, mapping-of-array values (`m[k][i]`,
`m[k].push`; a `T[N]` value journals the entry `m[k]`, and `m[k][i]` is a whole-entry
read-modify-write before clone/journal), packed and nested dynamic arrays, returning resizes,
N satoshi transfers, typed `{value:}` calls, token-container transfers without a prior
`tokenAmount` read (including two categories as two container slots), `blockhash(n)` with a
mapping write, `this.activeBytecode`, `new LockingBytecode*` constructors
including NullData, mixed event widths and non-emitting siblings on an event route, typed call
plus `emit`, native `I(cat).fn.call()` / `.staticcall()` including one-arg statement form,
enumerable mapping iteration, `try`/`catch` around a typed call, public dynamic-array getters,
`delete this.items[i]`, `fallback`/`receive` (including `msg.value`, satoshi transfer, typed
call, and fallback that both writes a mapping of `msg.sig` and makes a typed call), Solidity
`address.transfer` / `.send` (the same satoshi-transfer effect as `this.transfer`),
if/else satoshi transfers, `address.transfer` inside an internal helper, UDVT `wrap`/`unwrap`
then a mapping write, typed calls with a struct-array argument (`I.r(Rec[])`),
library-wrapped IERC20 transfer (`using SafeTransfer for IERC20`),
mapping-of-struct-array field writes (`m[k][i].x = v`), modifier-keyed mapping RMW
(`onlyOwner(id)` plus `ownerOf[id] = ...`), `ecrecover`,
library `Address.sendValue` (`to.transfer` inside a free/library helper, including
`using Address for address payable; to.sendValue(...)`),
returning a user-defined value type (`returns (TokenId)`),
counter-keyed `delete this.m[i]` (and two mapping writes in one counter loop),
`fallback` that wraps a UDVT mapping key,
an invariant parameter key written inside `while (true) { ...; break; }`,
mapping values of `pubkey` / `datasig` / `fixedMxN` / `ufixedMxN`, public whole-struct getters (captured as their
Solidity field tuple), and dynamic arrays of structs or enums returned through the recursive EVM ABI encoder
(journal cache defaults are type-correct empty/`0` rather than `int` 0).
Recursive mapping handlers and result types the wrapper cannot encode stay `KERNEL_LAYOUT`. Enum scalar results
and public enum getters use `int` locals; enum arrays encode each element as an unsigned ABI word.
Counter-keyed mapping loops with `continue`/`break`/early `return`, non-zero starts/steps, local or mutated
bounds, or extra counter mutations stay `KERNEL_UNBOUNDED_KEY` (a permutation of `0..n-1` is neither a
skip-set nor a witness for a different iteration domain). The exact post-test form
`int i = 0; do { ...; i = i + 1; } while (i < n)` is supported with an authenticated
`max(n, 1)` permutation; other `do-while` domains remain refused. A handler currently admits at most one
counter-keyed physical loop.
Every mapping/array write in that loop must use the counter in exactly one key component, and multiple
writes must have the same complete key tuple (for example `a[k][i]` plus `b[k][i]`). Counter-dependent
or loop-carried write guards, sibling reads of a mutated mapping, foreign counter-keyed reads, and
write values derived through loop-local/loop-carried locals or scalar state mutated by the loop remain
`KERNEL_UNBOUNDED_KEY`.

Mixed typed external calls and genuinely invariant `if`/`switch` in the same counter loop stay on the
row loop: only direct uses of the counter in mapping keys and mapping values are rewritten to `perm[i]`;
this includes values computed by explicitly `pure` internal helpers and resource-free builtins such as
`max`. Calls keep source order. Events, BCH transfers, and token-container transfers inside the physical
counter loop stay `KERNEL_UNBOUNDED_KEY`: the current effect frame has one fixed window per message row,
not one window per runtime inner iteration. Those effects remain supported before or after the loop.
Nested counter keys `m[k][i]` permute the inner key only.
At transaction construction time, one envelope may currently select only one non-empty counter-loop
row. Multiple collections in that row share its authenticated permutation, but multiple selected loop
rows are rejected until the SDK/compiler protocol has row-scoped predecessor journals and cursors.
Sidecars (indexed by live `row`) use the row loop (`__message_bus_handler_*` / `__message_bus_entry_*`
DEFINE, not `__message_bus_graph_*`). A contract whose every handler is refused still publishes
`messageBus.handlers` with `KERNEL_*` reasons. Runtime-constructed key arrays stay
`KERNEL_UNBOUNDED_KEY` without aborting sibling handlers.
