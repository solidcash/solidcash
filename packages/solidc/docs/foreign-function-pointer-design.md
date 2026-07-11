# Foreign external function pointers: design + the runtime-tag blocker

Status: **PARAMS + STATE storage + nested (struct field / array) + return/pass through an INTERNAL helper all
SHIPPED + VM-verified. Remaining: single-method-callee selector (#5, deferred), CROSS-ABI return/pass (#3 public,
needs the blob + SDK), deploy-fold (#2). Note: `p = (new Other()).addTwo; p(v)` (deploy + local ptr + call)
already COMPILES via alias + the shipped deploy-then-call fold; store_function's `store((new Other()).addTwo)`
(deployed method PASSED to a public fn) is the open deploy-fold+param intersection.**

## SHIPPED map (2026-07-11 session: items 1 + 4 of the 5 gaps)

- **#1 Foreign fn-ptr STATE storage of a RECEIVED value** (`x = y`, method carried in the value) - 50766c59.
  `LowerForeignFunctionPointerStorage` flattens the fn-ptr state var to an `address` field + a `bytes4
  __fnsel_<name>` companion; a store copies both parts; `x(args)` dispatches through the synth `__FnPtr_S<n>`
  interface + the per-call master index + a runtime selector sourced from the companion (reduces to the audited
  state-address external call). `LowerForeignFunctionPointerParams` also lowers a fn-ptr param STORED into such a
  var (not only called ones). VM: seeded call-from-storage, save->run across txs, and a RETURN value captured back
  via the return-event NFT (`ForeignFunctionPointerStorage.test.ts`).
- **#4 Foreign fn-ptr in a STRUCT FIELD**, fixed method - bd6b0f58. `LowerForeignFunctionPointerStructFields`
  retypes the fn-ptr field to interface-typed, drops `.m` off the struct constructor arg, and rewrites
  `s.fn(args)` -> `s.fn.m(args)` = the shipped `s.field.m()` co-spend. Lowered only when the field name maps to a
  single consistent (interface, method) contract-wide.
- **#4 Foreign fn-ptr ARRAY dispatch table**, fixed method - 15421ec1. `LowerForeignFunctionPointerArrayElements`
  MOVES the fn-ptr array out of `collections` into a plain `address[]` state var (a fn-ptr array parses as a
  collection; a plain address array is a dynamic-array state var) and rewrites `fns[i](args)` ->
  `IFace(fns[i]).m(args)` = the shipped array-element co-spend. Runs FIRST so every later pass sees a native
  `address[]`. Semantics = BROADCAST (co-spend + call the method on every registered callee); the explicit-loop
  form is redundant + rejected by codegen (fails closed).

The nested cases (#4) reduce to the fixed-method form (a consistent method contract-wide) - the RECEIVED-value
nested case (method in the value, runtime selector) needs the general BLOB representation below.

- **#3 (partial) Foreign fn-ptr RETURNED from / PASSED to a side-effect-free INTERNAL helper** - 7d6ff0d7 +
  dc6b733d. `InlineForeignFunctionPointerReturns` beta-reduces a single-return internal/private helper into its
  call sites: `p = make(a)` -> `p = IFoo(a).m` (RETURNED), and `relay(IFoo(a).m, v)` -> `IFoo(a).m(v)` (PASSED,
  via a `cb(args)` -> method-call substitution), which the straight-line desugar reduces to the external call.
  The self-ref/foreign DUALITY is respected: a helper is inlined only when every external-fn-ptr-param arg is a
  foreign member (a self-ref `this.g` = a functionId stays on the OP_INVOKE path; internal fn-ptr params are never
  touched). VM: internal return co-spend + pass-to-helper with the callee's return captured via the return-event
  NFT. The PUBLIC (cross-ABI) return/pass still needs the blob (a fn-ptr crossing the real ABI boundary).

- **fn-ptr `.selector` / `.address` members** - 643c75a9. `f.selector` -> the aliased member's compile-time
  selector, `f.address` -> the interface-cast address (the EVM `function external` value members).
- **#2 deploy-fold through a local ptr** - 8b9a063c (guard only). `p = (new Other()).m; p()` is byte-identical
  to the shipped direct deploy-then-call fold; sound by reduction. store_function's full deploy+store+fold-in-one-tx
  is the open deep #2.

Corpus measurement (2026-07-11): 255 fn-ptr-value corpus files -> 102 OK / 153 FAIL, a plateau. The tractable
veins are exhausted; the remaining fails are diverse/deep (cross-ABI member resolution, EVM `function()`->uint256,
transient/Yul/parse). The next fn-ptr work is architectural: the unified BLOB value model below + SDK.

### The general nested/return/pass case: the fn-ptr VALUE as a bytes BLOB (validated, not yet built)

A foreign fn-ptr value = `address_lbc ++ selector4` (a single bytes blob, selector = last 4 bytes). A CALL slices
it: `bytes a = blob.split(blob.length - 4)[0]; IFace(a).__call(args)` with a runtime selector `bytes4(blob[-4:])`.
VALIDATED (2026-07-11): a SLICED value in a LOCAL is accepted as an external-call target (addressParam = the
local), and a bytes struct field sliced into (addr, sel) locals dispatches an external call. So a blob fn-ptr in a
struct field / array element / calldata / return-event reduces to slice-locals + the synth call. This is the path
for the general #4 (received value in a struct/array), #3 (return/pass a fn-ptr), and unifies the value
representation. Remaining build: the slice-desugar pass (construct split/length/index/bytes4-cast nodes) + the
store-side param coordination + (for #3) SDK blob encode/decode of the (address, selector) calldata/return.

### #5 single-method-callee selector elision (analyzed, deferred)

A single-method contract skips the dispatcher (GTT:756), so its co-spend unlocking has NO 4-byte selector prefix
and the fn-ptr runtime-selector check reads the first ARG. Sound+complete fix = make single-method callees ALWAYS
emit the selector dispatcher (GTT:756 + SDK Contract.ts:101 both special-case `abi.length === 1`) but that changes
EVERY single-method contract's address + unlocking. Caller-side alt = verify the selector only when the co-spent
unlocking's first push is a 4-byte (`0x04`) push: sound but FALSE-NEGATIVE when a single-method callee's first arg
is itself 4 bytes. Not corpus-unblocking alone (store_function also needs #2). Deferred.

---
## Original design notes (params + the runtime-tag journey)

## SHIPPED: foreign fn-ptr parameters via the PER-CALL master index (5096dba6)

The per-call-index design below is IMPLEMENTED + VM-verified. A called `function(P) external returns(R)` param
lowers (LowerForeignFunctionPointerParams) to an external call on a synthesized `__FnPtr_N` interface with an
`address` param + a `bytes4` selector param (runtime selector). The co-spend MASTER INDEX is a per-call param
`__internal__extcallMasterIdx<i>` the SDK fills from the real callee layout it co-spends (StatefulContract loop),
and codegen (GTT, `slot.fnPtrCall`) reads the master at that index + runs identity + runtime-selector +
preservation. UNAMBIGUOUS across many calls (each reads its own index) - VM-verified with TWO calls to different
callees (A.inc, B.dec). The DUALITY is handled by a gate: a param passed a self-ref (`this.f` = StateAccess) at an
internal call site stays a functionId (OP_INVOKE); only foreign params lower. GOTCHAS found while building: (1)
a bare `y(v);` STATEMENT needs re-wrapping FunctionCallStatement->MethodCallStatement (external-call passes skip a
MethodCall in a FunctionCallStatement.call slot); (2) a SINGLE-method callee has NO selector in its co-spend
unlocking (the covenant reads the sig arg) - the runtime-selector check needs a 2+-method callee (single-method
selector-elision is a follow-up). store_function still needs foreign fn-ptr STATE storage (`x = y`) + the
deploy-fold (`new Other()`), which are separate.

## What works today

- **Internal / self-ref** `function(..) internal|external` pointers: represented as an integer **functionId**,
  called via `OP_INVOKE`. Locals, params, state vars (`this.f` self-ref state var), same-address varying-method
  (runtime selector). All VM-verified.
- **Foreign, fixed method, runtime address** (`LowerForeignFunctionPointerVars`): a `function(P) external x` whose
  every assignment is `x = IFace(addr).method` (one method, varying address) lowers to an `address` var +
  `IFace(x).method(args)` = the audited state-address external call (co-spend). VM-verified
  (`ForeignFunctionPointerStateVar.test.ts`).

## The general case (`store_function`) and why it needs a runtime tag

```solidity
function eval(function(uint) external returns (uint) y) public returns (uint) { return y(7); }
function t() { this.store((new Other()).addTwo); return ev(x); }   // ev = eval, x holds Other.addTwo
```

`eval` is **public**, so `y` cannot be classified self-vs-foreign at compile time:

- At the **ABI boundary**, a `function(..) external` value is `(address, selector)` (24 bytes in EVM). So an
  external caller *always* passes a foreign `(address, selector)`.
- **Internally**, BCH represents a *self-ref* as a functionId (`OP_INVOKE`, no co-spend) — an optimization, since
  a contract cannot co-spend itself (no second self-UTXO exists).

So one `function(..) external` value can be **either** a functionId (self → `OP_INVOKE`) **or** `(address,
selector)` (foreign → co-spend), decided by the caller/origin. The two call mechanisms are irreducibly different
and cannot be unified into one primitive. This is the **duality**.

### The runtime-tag representation (the direct solution)

A tagged value: `0x00 ++ functionId` (self) or `0x01 ++ selector(4) ++ lockingBytecode` (foreign). Call-through
`y(args)` branches on `y[0]`:

- `0x00`: `<args> <y[1:]> OP_INVOKE`  (the existing path — `visitIndirectFunctionCall`, GTT:3946).
- `0x01`: a **foreign external call** — co-spend a callee, verify `co-spent.lockingBytecode == y[5:]` and
  `co-spent.selector == y[1:5]`, encode args, decode return.

### The blocker: **conditional co-spend at a fixed covenant epilogue**

The foreign branch co-spends the callee — an **extra transaction input**. The self branch does not. So the tx
input set depends on a **runtime** value. But `emitExternalCallVerification` (GTT:11034) runs per-slot at the
function epilogue **unconditionally**, at compile-time-computed offsets. Making a fn-ptr-call slot conditional
requires:

1. carrying the runtime tag to the epilogue and gating that slot's verification on `tag == foreign`;
2. the SDK adding the callee input **only** when the value is foreign, and passing its index in (mirroring
   `__internal__externalCallInputBase`) so the covenant reads the right input;
3. the return-event / value handling agreeing on both branches.

The external-call machinery already computes input indices at runtime, so this is *possible* — but it is a
genuine extension to the covenant's fixed epilogue structure (conditional co-spend + tag-gated verification +
SDK conditional co-spend), touching the core representation that the 20 passing fn-ptr VM tests depend on. It is
a dedicated, VM-verified-per-step build, **not a safe single-session partial** — a wrong gate is a silent
miscompile, which the project's correctness bar forbids.

### Second blocker, found by BUILDING it: the generic-callee data-NFT count

An attempt (`LowerForeignFunctionPointerParams`, built + reverted 2026-07-11) lowered a called fn-ptr param
`y(v)` to an external call on a synthesized interface (`__FnPtr_N(y).__call(v)` with a runtime selector = a
synthetic `bytes4` param). It COMPILED and EXECUTED the covenant end-to-end (co-spend + selector read), but the
external-call co-spend layout is computed from the callee interface's **data-NFT count**, and a fn-ptr signature
carries **no state-layout information** - the synth interface has 0 data NFTs. Against a real callee with 1 data
NFT (a `bigint counter`), the covenant computed the wrong co-spend input index and read the wrong bytecode
(expected selector `e174892f`, read `dd061921` from the mis-indexed input) -> OP_VERIFY fail. It ALSO broke the
self-ref param path (the duality: it changed every `function(..) external` param call to foreign; the
`ExternalFnPointerParam` self-ref VM test failed). Reverted.

So a foreign fn-ptr call needs the callee's data-NFT count at the CALL site, which is unknown for a generic
pointer. Options: (a) a runtime/opaque co-spend model that reads the callee's NFT count at runtime (bigger
covenant change); (b) restrict to 0-data-NFT (pure/stateless-on-BCH) callees - which is `store_function`'s
`Other.addTwo`, so the pure-callee subset is the tractable target once the duality (runtime tag) is solved.

### Deeper diagnosis (2026-07-11 re-attempt, on the hint that the callee ADDRESS carries the CATEGORY)

Re-built the pass + dumped the tx. Refined finding: for a SINGLE call the master IDENTITY check PASSES (the SDK
orders the callee block master-first, so `externalCallInputBase + 0` = the master - the data-NFT count does NOT
break the single-call master index, correcting the earlier hypothesis). The failure is in the SELECTOR
verification: the synth-interface external call carries BOTH a witness `__internal__externalCallSelector` param
AND the runtime `__fnsel_y`, and the co-spent callee's actual dispatch selector matches NEITHER the ABI selector
(`e174892f`) NOR the trace-observed value (`dd061921`) when routed through the synth interface `__FnPtr_N`. So the
synth-interface path does not thread the runtime selector the way the same-address-varying path (which WORKS, see
ForeignDispatchTable) does. The category hint is right that a stateful callee is reachable (identity + layout are
fine); what remains is (1) threading the runtime selector correctly for a fn-ptr call (align with the working
same-address-varying machinery instead of a synth interface with a witness selector), and (2) the duality
(self-ref params). A category-based co-spend would further remove the need for a synth interface's data-NFT count
for MULTI-call / staticcall cases. Reverted (still breaks self-ref params); the working same-address-varying path
is the template to build the fn-ptr call on, not a fresh synth interface.

### PINPOINT root cause (2026-07-11, third build + full VM trace)

Dumped the failing `OP_EQUALVERIFY` operands across runs: the selector read produces a value that CHANGES every
run (`dd061921`, `638d22fc`, `e38eeac5`) preceded by a `0x41` (65-byte) push - i.e. it is reading a **signed
input's unlocking (a signature), not the callee master's selector-first unlocking**. So the co-spend master
index is WRONG: it is computed from the CALLER's synth-interface layout (0 data NFTs) while the SDK co-spends the
real callee (Handler, 1 data NFT) via `withExternalCall`, and the two disagree on where the master sits, so
`INPUTBYTECODE[masterIndex]` lands on a funding/signed input. This is definitively a co-spend LAYOUT mismatch,
not a selector-value bug.

### Attempt 4 (2026-07-11): runtime master SCAN - built, hit the multi-call ambiguity

Built `emitForeignFnPtrScanVerification`: loop all inputs, find the master (UTXOBYTECODE == pointer address AND
minting capability 0x02), verify its selector-first unlocking == the runtime selector, require exactly one match.
It compiled + executed; VM trace showed an offset bug (the address PICK matched a wrong input - the caller's own
minting master, whose unlocking is signature-first). That is fixable, BUT the user raised the decisive flaw:

**A scan-for-ANY-match is fundamentally AMBIGUOUS with MULTIPLE fn-ptr calls in one function** (same or different
selectors). "require exactly one match" breaks the moment two calls co-spend two callees; and matching the FIRST
input with a given (address, selector) binds a call to the wrong callee. The covenant must pin EACH call to ITS
proper co-spent callee.

### The correct design (per-call binding, not a global scan)

Bind each fn-ptr call to a SPECIFIC co-spent callee via a PER-CALL master-index parameter that the SDK fills from
the real callee layout it co-spends (it already knows the callee + its position from withExternalCall). The
covenant then reads the master at THAT index and runs the normal identity + selector + preservation checks -
unambiguous across many calls, and layout-independent (the index is SDK-computed, not derived from a compile-time
synth data-NFT count). This reuses `emitExternalCallVerification` almost verbatim; only the index SOURCE changes
(a per-call `__internal__fnptr_master_idx_N` param instead of `externalCallInputBase + computedOffset`). The
category/scan can still be a runtime CHECK (assert the input at that index is the target's minting master) for
defense-in-depth, but the INDEX itself comes from the SDK per call. Remaining pieces: (1) the per-call index
param + covenant read; (2) the SDK auto-derivation to fill each fn-ptr call's callee master index; (3) the
duality (a self-ref param is a functionId, handled by a size/tag branch). This is a bounded covenant + SDK build,
now fully specified.

## `store_function` needs a third deep feature regardless

`this.store((new Other()).addTwo); return ev(x)` also deploys `Other` and calls through the stored pointer in
**one tx** = the deploy-then-call fold intersected with the fn-ptr call. So even a complete runtime-tag does not
compile `store_function` without the deploy-fold work.

## Recommended path

1. **(done)** fixed-method foreign state vars — the common callback/registry pattern.
2. Runtime-tag representation + call-through branch, VM-verified on a **no-state, no-deploy** foreign-param PoC
   (`eval(function(uint) external y){ return y(7); }` called with a genuinely foreign pointer) — this de-risks the
   conditional co-spend in isolation before touching stored/deploy cases.
3. Foreign fn-ptr in state / passed across the ABI (SDK `(address, selector)` encode + co-spend derivation).
4. Deploy-fold intersection for `store_function`.

Each is a scoped effort with its own VM proof.
