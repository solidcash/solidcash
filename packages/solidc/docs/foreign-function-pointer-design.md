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

### `store_function` needs a second deep feature regardless

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
