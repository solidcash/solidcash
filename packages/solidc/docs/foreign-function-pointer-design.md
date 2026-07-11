# Foreign external function pointers: design + the runtime-tag blocker

Status: **self-ref + fixed-method-foreign SHIPPED; fully-general foreign is a scoped covenant-architecture build.**

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

**The fix (buildable, the user's category insight):** the fn-ptr call's co-spend base/index must come from the
CALLEE's runtime layout, not a compile-time synth count. Since the pointer's address pins the callee's category
(read via OP_UTXOTOKENCATEGORY on the co-spent master), the covenant can identify the callee's master + data NFTs
by category at runtime, independent of a compile-time interface. Concretely: emit the fn-ptr co-spend like the
array-element loop dispatch (which already verifies a runtime address by LBC) but for a single callee, and derive
the data-NFT stride from the co-spent category run rather than `requiredDataNftIndices`. Plus the SDK must set
`__internal__externalCallInputBase` / the co-spend group from the real callee (it already knows it from
withExternalCall) so caller and covenant agree. This is a bounded covenant + SDK change, now precisely scoped;
the duality (self-ref params) is the separate size/tag branch.

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
