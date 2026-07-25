# Library contracts (`library` as a stateless contract class)

Design discussion (2026-06). NOT built. This covers the `library` keyword compiled to a stateless,
delegatecall-able CONTRACT that produces its own artifact - the BCH analogue of a Solidity deployed library.

## A separate concern from external libraries (precompiles)

This is distinct from **external libraries** (script precompiles like `keccak256`; see
`external-libraries.md`). They sit at different layers and are orthogonal and composable - a library contract
may itself call external-library precompiles:

| | External library (precompile) | Library contract class |
|---|---|---|
| layer | a Script bytecode subroutine | a source-language contract abstraction |
| execution | `OP_INVOKE` within the CALLER's script | a separate co-spent contract evaluation (`delegate`) |
| state | pure (inputs -> outputs on the stack) | stateless itself; `delegate`-touches the CALLER's state |
| reuse storage | inline in the redeem, or a side-car blob UTXO | a deployed contract UTXO at its own address |
| linking | by hash (content-addressed) | by address / category (brand) |
| artifact | blob + ABI descriptor (`ExternalLibraryAbi`) | a full contract artifact + library ABI |
| exemplar | keccak256, math/hash precompiles | Solidity `library Set { ... storage self ... }` |

The precompile path is NOT a deployment mode of the library class; it is a lower-level mechanism a library
(or any contract) can use for pure Script-subroutine reuse. The rest of this document is only the
contract-class concern.

## `library` lowers to a stateless contract

A Solidity `library` is a stateless contract whose code runs in the caller's context via DELEGATECALL, and
SolidCash already has that primitive (the `delegate` modifier + the `_proxyMasterIndex` altstack trick). So
`LibraryNotCompilableError` is liftable: a `library` lowers to a **stateless contract that emits a normal
artifact** whose public functions are `delegate` entry points. This is the deployed counterpart to the
inlined `using for` library (compile-time inlined, no artifact) - matching Solidity's own split: internal
funcs `JUMP`-inline, public funcs DELEGATECALL.

## Deployment forms (within the contract-class concern)

| Function | BCH form | Contention |
|---|---|---|
| cheap / pure / `using for` one-liners | inline (compile-time, as today) | none |
| deployed, caller-state-touching | branded `delegate` co-spend | rides the master (proof below) |

(Orthogonally, a pure computational function could instead be factored into an external-library precompile
and reused by hash - that is the separate mechanism in `external-libraries.md`, not a deployment mode here.)

## Granularity + state-model gaps vs today's `delegate`

Today's `delegate` is the EVM transparent-PROXY shape, not the library shape (see `Delegatecall.test.ts`: a
proxy `fallback(bytes input)` forwards its WHOLE spend to one impl via `impl.delegatecall(input)`, and the
impl mutates the proxy's state through a SHARED layout - proxy and impl both declare `bigint counter`). A
Solidity library is the opposite: mid-function, possibly multiple, value-returning calls (`r = L.f(x)`).
Net-new work:

- **Mid-body value-returning calls:** compose `delegate` caller-context execution with the external-call
  return-event (the existing mid-body co-spend-with-result path) into one `L.f(x)`.
- **State model:** a delegate library shares the caller's state layout (not Solidity's by-reference
  `storage self`); it is "shared logic over an agreed state shape." Pure functions sidestep this entirely.

## Contention resolution: brand + master-gate

A deployed library is a consumable co-spent UTXO, so a globally shared one serializes all its users - a
throughput hotspot. Resolution: **brand the library with the deploying contract's category (self-pin), and
make it spendable only when that contract's master is co-spent.** Then:

```
library spendable  <=>  master co-spent  AND  library branded to the contract's category
                   =>   library spend-rate  <=  master spend-rate
```

The master is already a single chained UTXO that serializes every state transition - the contract's
intrinsic throughput ceiling, library or not. Gating the library on "master present + my brand" makes it
ride that existing serialization and add **zero marginal contention**: the library stops being an
independent contended resource and becomes slaved to the master. Corollary: if the contract shards state
across multiple master/instance UTXOs, each shard mints its own branded library, so library parallelism
scales exactly with the contract's own state parallelism.

It composes with existing machinery: self-pin (`OP_UTXOTOKENCATEGORY == bakedCategory`) and "find a co-spent
input and verify its category by introspection" (the external-call path, here pointed at the master input).
The library self-preserves (recreates itself, same brand) and chains alongside the master. (The keccak
side-car already uses a branded address for the same contention reason at the precompile layer; this is the
same idea applied to a deployed contract rather than a blob carrier - see `external-libraries.md`.)

## Category-placeholder linking (BCH analogue of EVM's address placeholder)

The brand is the deployer's genesis category, which does not exist until genesis - so the library script
cannot hardcode it; it is a **category placeholder filled at mint time** (a constructor-baked constant).
That is the precise BCH analogue of EVM's library-address linking placeholder (`__$hash$__` filled at link
time), except content/identity-bound rather than trust-an-address. The consumer pins the library by brand +
master-presence; the library pins the consumer by category.

## Refinements / caveats

- **Master-gate only for state-touching calls.** Forcing a master co-spend on a pure/`staticcall` library
  call re-adds contention on the read path (reads serialize against writes) and bloats the bundle. Keep pure
  functions inline (or, separately, a precompile); reserve the master-gate for state-mutating ones.
- **Plain master vs minting NFT.** Routine library spends only need the master's category provable (presence
  + brand match). Reserve the minting capability for what needs it - minting the pool of branded copies, and
  re-minting on upgrade - not hot paths.
- **Upgradeability is free, and a governance edge.** A branded library the master can re-mint means swappable
  logic without changing the contract's address (good), but whoever controls the master controls the code
  (the same trust surface as an EVM upgradeable proxy). Offer an immutable / non-minting brand variant for
  libraries meant to be frozen.
- **New use case - large-contract split.** Because logic can live in master-gated branded library UTXOs, a
  contract that exceeds BCH script limits can be split across them: the BCH analogue of working around EVM's
  24KB code-size cap.
- **Heavier bundle.** The library joins the co-spent set (recreated each transition); bounded, but a real
  per-transaction cost.

## The one hard BCH constraint (governs inline vs deploy)

There is no free global shared code on BCH: a transaction can only read the bytecode of inputs it SPENDS
(`OP_UTXOBYTECODE`), so "using" library code means either embedding it (inline) or co-spending the UTXO that
holds it. EVM code is freely shareable with zero contention; BCH's only contention-free reuse is inlining
(duplicated bytes, no sharing), and any deployed/shared form is a consumable UTXO (shared bytes, plus
lifecycle and the contention this design resolves). This - not a code-size limit - is what should drive the
inline-vs-deploy choice.

## Decisions (direction set 2026-06)

- **Build it, with user-controlled inline-vs-externalize (not deferred).** The driver is not just shared
  state-touching logic - it is BCH's hard per-input script-size and op-budget limits. Each input carries its
  own budget, so when a contract outgrows one input, logic must move to a co-spent UTXO (splitting multiplies
  available budget). Inlining works until it doesn't; the user then externalizes. This is the user's choice,
  not the compiler's - extending the existing `inlineLibraries` control philosophy (pure code externalizes via
  the precompile path; state-touching code via the delegate-library here).
- **Reuse the `library` keyword; visibility decides the call mechanism.** internal/private functions inline
  (no artifact, as today's `using for`); public/external functions compile to the deployed delegate contract.
  Exact Solidity parity at the call site (internal = `JUMP`-inline, public = `DELEGATECALL`). Library functions
  need a visibility marker added to the grammar for this.
- **Artifact generation: per library that has >=1 public/external function.** This is a DELIBERATE divergence
  from Solidity, which generates a library artifact UNCONDITIONALLY: solc's
  `ContractDefinition::canBeDeployed() = !abstract() && !isInterface()` (AST.cpp:192) is kind-based, so every
  library (even internal-only) gets bytecode, and visibility there gates only inline-vs-`DELEGATECALL`, not
  artifact emission. SolidCash diverges because BCH has no vestigial-bytecode notion - an inline-only library
  has no standalone script to deploy, so emitting an artifact for it is meaningless. (An ABI/types-only
  descriptor for internal-only libraries - the BCH echo of Solidity's vestigial artifact - is optional, for
  tooling.)

## Deferred to implementation

- **Call granularity.** The mid-body, value-returning `L.f(x)` form (compose `delegate` caller-context with
  the external-call return-event) is the main net-new compiler/SDK work; resolve its mechanics against the
  actual codegen rather than pinning them now.
- **`delegate` restriction matrix.** The principle follows from visibility (public state-touching -> delegate;
  pure/view -> inline or staticcall), but the exact legal-combination matrix (today `delegate` excludes
  `unsafe`/`upgrade`/`selfdestruct`/`deploy`/`internal`/`private`/`pure`/`view`) firms up during implementation.

## Implementation plan (phased)

Build order; each phase is independently committable and tested. The deployable artifact lands in Phase 2; the
consumer-side call protocol (the load-bearing new work) in Phase 3. Phases 1-2 are mostly front-end + reuse of
the existing delegate-impl compilation path; Phase 3+ is the genuinely new mechanism.

1. **Front-end: classify library functions by visibility.** `visitFreeFunctionDefinition` parses function
   modifiers (today it drops them), so library/free functions carry visibility (the grammar already allows it
   via `functionModifier`). No compilation-behavior change yet. Tests: `parseCode` a library and assert each
   function keeps its declared visibility. [KICKOFF.]
2. **Compile a deploy-eligible library to a stateless contract artifact. [DONE.]** A library with >=1
   EXPLICITLY public/external function lowers to a stateless ContractNode (public/external fns -> entry points,
   internal/unmarked fns -> inline helpers); `LibraryNotCompilableError` is lifted for that case. A library with
   only inline (internal/unmarked) functions has no entry point and stays non-compilable - this preserves
   existing behavior (an all-unmarked using-for library like the `math_lib` fixture still throws), so deployment
   is an explicit opt-in via `public`/`external`. Statelessness is grammar-enforced (libraries have no state
   vars). Implementation: AstBuilder stashes `SourceFileNode.libraryContract`; compiler.ts swaps it in for
   `ast.contract`. Tests: `test/LibraryContracts.test.ts`. NOTE: for now the entry points compile as plain
   external functions; the deployed-library covenant (delegate self-preservation, the library artifact marker)
   moves to Phase 3 with the call protocol, so the Phase-2 artifact is a normal stateless-contract artifact and
   not yet a reusable on-chain library.
3. **State-touching libraries via delegate - the remaining work for this class.** [DECISION 2026-06-28: 3a
   (pure library via the external-call path) is DROPPED. Pure-library reuse is the precompile path's job
   (external-libraries.md "Phase 6": .scash source -> blob, OP_INVOKE, branded side-car) - lighter and already
   mostly built; a stateless-external-contract path here would duplicate it heavier. Confirmed from the SDK: the
   external-call path (`StatefulContract.withExternalCall`, `setupStatefulUtxos`) is built entirely for STATEFUL
   callees - a stateless library does not fit it.] What is UNIQUE to the library-contract-class is the
   caller-state-mutating library lowered to a delegate contract. Remaining (a coupled design+build, NOT a series
   of quick commits - needs its own design pass before codegen):
   - **Caller-state access (the core blocker).** A library is stateless and cannot declare the caller's state
     layout, so it needs a way to name the caller's state THROUGH delegate - a `storage self`-style reference
     resolved across the delegate boundary, or a shared-layout convention. Today's storage-pointer params are
     INLINED (`InlineStoragePointerCalls`); a delegate library needs them resolved at the co-spend boundary
     instead. This is the central new design; everything else depends on it.
   - **Library side.** Infer delegate mode for caller-state-touching public functions; reuse the delegate-impl
     machinery (`_proxyMasterIndex` altstack, `emitDelegateSelfPreservation`) so the deployed library UTXO
     self-preserves.
   - **Consumer side: mid-body `r = L.f(args)`.** Co-spend L, run f in the caller's covenant context (delegate),
     return a value mid-body. Today's delegate is whole-spend (a proxy fallback forwards all calldata); a
     mid-body, value-returning delegate call composed with the return-event is genuinely new.
   - **Contention + SDK + e2e.** Brand the library with the consumer's category + master-gate (see "Contention
     resolution"); the SDK co-spends/recreates the branded library and supplies the address; mocknet + regtest.

Note: Phase 2 currently lowers ANY library with public functions to a contract artifact, pure ones included.
Under the decision above, pure libraries should route to the precompile path instead; reconciling Phase 2's
routing (pure -> precompile blob, state-touching -> this delegate contract) is part of the precompile workstream
(external-libraries.md Phase 6) and tracked there.

## 3b design: caller-state access through delegate (design pass, 2026-06-28)

The blocker for 3b is letting a stateless library read/write the CALLER's state. Grounded in the codegen:

- State field access is a **compile-time-fixed offset**: a `this.field` read emits
  `emitMasterInputIndex; <encodeInt(compactOffsetMap[nftIndex])>; OP_ADD; OP_UTXOTOKENCOMMITMENT` with the
  field skipped by unrolled steps (GenerateTargetTraversal.ts ~2329-2345). There is NO runtime-offset
  commitment access anywhere.
- `delegate` already redirects that access to the caller's master: `emitMasterInputIndex` (~10647) reads
  `_proxyMasterIndex` from the altstack instead of `OP_INPUTINDEX`. Offsets resolve against the FUNCTION'S OWN
  declared `StateLayout`, so a delegate impl and its proxy must declare matching state (Delegatecall.test.ts:
  both declare `bigint counter`).
- Storage-pointer params are pure compile-time substitution (`InlineStoragePointerCalls`: "a storage pointer
  has no value representation"); they cannot cross a co-spend/delegate boundary as a runtime value.

### Two models

- **(a) Shared-layout (RECOMMENDED, low effort - reuses everything).** The library declares the state SHAPE it
  operates on; `this.field`/`self.field` resolve to the caller's master at the compile-time offset via the
  existing `_proxyMasterIndex` path. The caller's layout must be compatible (the library's fields at the same
  offsets). This is exactly the EVM upgradeable-proxy storage-layout-compatibility rule - an accepted,
  EVM-parity constraint - and needs NO new codegen, only gate-lifts.
- **(b) Runtime storage pointer (DEFERRED, high effort).** The caller passes a runtime field handle and the
  library does generic offset-addressed commitment read/write. Nothing does runtime-offset commitment access
  today, and pushdata's length-prefix format has no generic "skip N bytes"; ~500+ lines + new stack patterns.
  More generic (a library over ANY caller's sub-struct, Solidity `storage self` semantics) but out of scope.

### Recommended mechanism (model a)

Keep Solidity's `storage self` SYNTAX, give it shared-layout SEMANTICS: in a delegate library,
`function f(Data storage self, ...)` means "`self` is the caller's state interpreted as the declared struct
`Data`"; `self.x` resolves to the caller's master commitment at `Data.x`'s compile-time offset (reusing the
struct-field-offset codegen + `_proxyMasterIndex`) - NOT a runtime slot. The caller invokes `L.f(this, ...)`
(its whole state as `self`); the compiler VERIFIES the caller's `StateLayout` matches `Data` at the accessed
fields (a prefix match on `nftIndex:fieldIndex`/width). A mismatch is a hard error (mismatched offsets would
corrupt caller state - this check is load-bearing). First form: `self` is the caller's whole state; operating
on a sub-struct of an arbitrary caller is the (b)-flavored generalization, deferred.

### The call is not synchronous

BCH has no synchronous cross-input call, so `r = L.f(args)` is NOT a function call - it is: co-spend the
library UTXO (its script runs in its own evaluation) + the library operates on the caller's master via
`_proxyMasterIndex` (delegate) + the result returns via the existing `_Return_` event the caller reads. The
caller is the proxy and the library is the impl for that spend; as today, the caller's covenant defers state
verification to the delegate (Delegatecall.test.ts: "compiler skips auto-covenant state verification for
delegatecall functions"). First form is per-FUNCTION deferral (one function's whole state transition runs in
the library); arbitrary mid-body logic before AND after one call (splitting a transition across caller and
library) is a harder generalization, deferred.

### Gate-lifts + build order

1. **Layout-compatibility check. [SDK guard DONE.]** The SDK `withDelegatecall` now verifies the caller's
   `StateLayout` matches the impl/library's at each impl field (same slot `nftIndex:fieldIndex`, name, type) and
   throws on mismatch (`assertDelegateLayoutCompatible`, StatefulContract.ts), so a wrong-layout delegatecall is
   caught at build time - for BOTH libraries AND the existing proxy/impl (which previously had no check). Test:
   `test/e2e/LibraryDelegate.test.ts` (mismatch rejected). The build-time GUARD is now complemented by a
   **COMPILE-TIME check [DONE]** at the static `L.f()` call site: `ImportResolver` conveys the imported library's
   declared layout (`SourceFileNode.importedLibraryLayouts`) and `SynthesizeLibraryDelegateCalls.checkLayoutCompat`
   rejects a consumer whose state layout does not lead with the library's fields (same order/name/type) -
   untrusted-SDK-proof, since both layouts are in one compilation (LibraryContracts.test.ts).

**`L.f()` sugar [DONE].** A consumer that imports library `L` calls `L.f()`; `SynthesizeLibraryDelegateCalls`
desugars it to `__libAddr_L.delegatecall(<f selector>)`, with `__libAddr_L` a synthesized `address` ctor param
(EVM-link-style: the SDK supplies L's address and co-spends it). **SDK auto-wire [DONE].** The desugar records
`{library, functionName}` in the artifact (`AbiFunction.libraryDelegateCalls`); `StatefulContract.registerLibrary`
registers a deployed library, and the call builder derives the `withDelegatecall` co-spend automatically - the
caller names the library function only once (in source).

**Arguments [DONE].** A library call's args are positional: a forwarded enclosing-function parameter
(`function bumpBy(bigint n) { Counter.incrementBy(n); }`) or a compile-time literal (`Counter.incrementBy(5)`).
The desugar records each as a `LibraryCallArg` (`{param}` | `{literal, kind}`), encoding literals per the library
parameter's type; the SDK resolves them (forwarded params from the consumer call, literals reconstructed by kind)
and supplies them to the library unlocker (the delegatecall data is not on-chain, so the SDK is the courier).
Computed expressions and state reads throw a clear error (the SDK cannot evaluate them); a literal whose kind
does not match the parameter type is also rejected. A forwarded param is not reported "unused"
(`ParameterNode.syntheticallyUsed`).

**Return values - by design, via shared state (not a return channel).** A delegate library is co-spent with NO
synchronous return on BCH (the delegatecall data is not even on-chain), so a library function cannot hand a value
back to the caller's script. Using a library call as a value (`r = L.f(x)`) is a clear compile error. The
delegate model instead communicates results through the SHARED STATE: the library writes a state field and the
caller reads it from its OWN state afterward (proven by the args e2e - the library mutates `count`, the
consumer's state reflects it). Value-returning PURE helpers (e.g. SafeMath.add) belong to the precompile path
(external-libraries.md), which is a synchronous inline subroutine and does return a value.

**Contention - brand + master-gate [DONE].** A delegate library compiled with `{ brandLibrary: true }` pins the
co-spent proxy master's category to a synthesized `bytes32 __brand` ctor arg (the owning consumer's category):
the delegate master-validation, which already requires a co-spent self-preserving MINTING master, now also
verifies that master's category == `__brand` instead of dropping it. So the library is spendable ONLY alongside
its owning consumer's master - it rides that one master's serialization (zero marginal contention) rather than
being a shared, contended UTXO; shard by minting a per-consumer branded copy. Gated on `isBrandedLibrary`, so an
unbranded delegate/library is byte-identical (no regression). `__brand` is the category in internal (VM) byte
order, reversed from the display categoryId. Pure libraries are never branded. Proven e2e: a branded library
accepts its owning consumer's master and rejects a foreign master (LibraryDelegate.test.ts).

The library-contract feature is now COMPLETE: lower -> deploy -> `L.f(args)` -> auto-wire -> compile-time +
runtime layout guard -> branded master-gate. Returns are by design via shared state (delegate has no synchronous
return); pure value-returning helpers use the precompile path.

2. **Library-side lowering. [DONE.]** A library may now declare state vars (the shared layout it operates on):
   the grammar gained `stateVariableDeclaration*` in `libraryDefinition` (regen) and AstBuilder carries them
   into the lowered contract. A state-touching library's public/external functions are AUTO-marked `delegate` -
   Solidity has no `delegate` keyword (public library functions are delegatecalled implicitly), so ported
   source needs none. This reuses `_proxyMasterIndex` + `emitDelegateSelfPreservation` verbatim: a delegate
   library has the same inferred ABI mode and state layout as an ordinary implementation contract
   (LibraryContracts.test.ts).

   **On `storage self` (EVM parity):** Solidity's `storage self` library pattern is ALREADY supported - via
   `using for` over an explicit struct instance: `library L { struct Data { uint x; } function getX(L.Data
   storage d) internal ... } ... using L for L.Data; L.Data d; d.getX()` desugars to `L.getX(d)` (the existing
   storage-pointer / inline-helper path; PortingFixes.test.ts "using for"). That matches Solidity's semantics
   exactly: `self` is ONE of possibly many struct instances in the caller's storage. A delegate library, by
   contrast, operates on the caller's WHOLE single state (one master NFT), which the state-vars form above
   expresses directly. A separate "`storage self` => delegate whole-state" desugar was prototyped and dropped:
   it collides with the `using for` path (same syntax, incompatible single-vs-multi-instance semantics). So the
   two map cleanly onto the two existing forms - `using for` + `storage self` (inline, multi-instance) and the
   state-vars delegate library (deployed, whole-state) - and no new syntax was added.
3. **Consumer-side call**: the WHOLE-SPEND form already WORKS by reuse - a consumer delegatecalls the library
   via the existing `addr.delegatecall(input)` codegen + SDK `withDelegatecall`, and the library's function runs
   against the consumer's state (PROVEN e2e on mocknet: `test/e2e/LibraryDelegate.test.ts`, a state-touching
   library written as plain Solidity increments the proxy's state). The ergonomic `L.f()` sugar + SDK auto-wire
   are now DONE (above); remaining = argument passing / return values / pre+post consumer logic (the deferred
   generalizations). Steps 1 (layout-compat, DONE) and 4 (contention) harden it.
4. **Contention [DONE]**: brand L with the caller's category + master-gate (see "Contention resolution" above).
5. **SDK + e2e [DONE]**: the existing co-spend recreates the (branded) library; the consumer supplies its
   address. Branded e2e in LibraryDelegate.test.ts (owning consumer accepted, foreign master rejected).

Constraints to accept (all EVM-parity-ish): the caller's state layout must match the library's shape
(proxy/impl storage rule); per-function delegation first; sub-struct genericity and arbitrary mid-body
splitting are deferred to the harder model (b).
