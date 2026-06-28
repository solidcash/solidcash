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
3. **Consumer-side call protocol + deployed-library covenant: mid-body `r = L.f(x)`.** Compose delegate
   caller-context execution with the external-call return-event so a contract calls a library function mid-body
   and consumes its result. Mark public functions `delegate` and emit self-preservation so the deployed library
   UTXO is reusable; add the library artifact marker the SDK keys on. Add the contention design: brand the
   deployed library with the consumer's category (self-pin) + master-gate. This is the load-bearing new work
   (see "Granularity" and "Contention resolution").
4. **SDK.** Deploy the library UTXO (branded, self-preserving), auto-co-spend on calls, link-by-address, thread
   through auto-derivation. Mirror the precompile side-car SDK flow where it applies.
5. **State-touching libraries + polish.** `storage self`-style caller-state access for state-mutating library
   functions; user-controlled inline-vs-externalize (extend `inlineLibraries`); tests + regtest.
