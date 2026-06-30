# Deploy-then-call folding (`a = new C(args); a.foo(x)` in one tx)

## Problem

Solidity routinely deploys and configures in one transaction:

```solidity
C a = new C(args);
a.foo(x);          // configure the freshly-deployed C
```

On BCH this cannot be literal: `new C(args)` creates C's UTXO as an **output** of the tx, while a
state-changing `a.foo()` needs C's UTXO as a **co-spent input** of the same tx. A UTXO can't be both an
output and an input of one transaction. Worse, solidcash currently *silently* compiles this to **both** a
deploy target and a co-spend external call on the same variable (`SymbolTableTraversal.ts:3673` routes
`a.foo()` to an `ExternalFunctionCallNode` because `a` is typed `AddressType(interfaceName="C")`), producing
an **unsatisfiable transaction** with no diagnostic. This feature closes that soundness hole and supports
the pattern by **folding** the post-deploy call into the deploy.

Additional context: a child deployed via `new C(args)` **always starts at default (zero) state today** -
the deploy covenant (`GenerateTargetTraversal.ts:9991-10019`) emits `emitDefaultValue` per field and
verifies `OP_OUTPUTTOKENCOMMITMENT(childDataNft) == <defaults>`; constructor args become only *immutables*
baked into the child's locking bytecode, never mutable state. So "deploy with non-default initial state"
is itself only expressible as deploy-then-configure - which is exactly what the fold enables, in one tx.

## Idea

The intermediate "C exists but `foo` hasn't run" state never needs to exist on-chain. Deploy C directly in
its **post-`foo` state**: the deploy covenant verifies `child genesis == foo(constructor(args), x)` instead
of `== defaults`. Net on-chain result is identical to EVM's sequential `new C(); a.foo()`, in one tx, fully
covenant-verified (no SDK-trusted genesis).

## Architecture (3 layers)

### 1. Semantic - detect + fold, don't co-spend

- Track **deploy-result locals**: in `SymbolTableTraversal.visitVariableDefinition` (~3296), record a
  per-function `Map<varName, InstantiationNode>` when `expression instanceof InstantiationNode &&
  expression.referencedContract`.
- At the external-call construction sites - `visitFunctionCall` (~3673, no-options form) and
  `visitMethodCall` (~5785, `{value:}` form) - if the receiver identifier is a deploy-result local:
  - resolve `foo` against `referencedContract`;
  - **validate foldability** (below); non-foldable -> `DeployFoldError` with a precise message;
  - append the call (`{ fn, args, resolvedFunction }`) to the `InstantiationNode`'s new `foldedCalls`
    field, in source order (multiple calls on the same local fold in sequence);
  - **do not** build the `ExternalFunctionCallNode`; the statement becomes a no-op (so no co-spend is
    collected by the pre-scan at 2793, and no external-call covenant is emitted).
- Keep keying on *deploy-result local*, not merely `interfaceName` - the legitimate `IC token` param /
  `IC(addr)` external-call patterns share the same `AddressType.interfaceName` routing and must keep working.

**Foldability** (a `foo` is foldable iff it is a pure `(state, args) -> state` transition):
- Allowed: reads/writes of `this.<field>`, pure computation, local variables, control flow (if/loops),
  calls to other foldable functions of the same contract.
- Forbidden (-> diagnostic): `tx.*` introspection, `msg.sender`/`msg.value`, external calls, `emit`,
  `blockhash`/block.*, `new`/`deploy`, `selfdestruct`, `require` on tx context. Determined by scanning the
  resolved `foo` body for these constructs (reuse the collectors that already gate `usesMsgSender`,
  `externalCalls`, `deployTargets`, blockhash reads, etc.).

### 2. Codegen - covenant verifies the post-`foo` genesis

The deploy covenant (`emitDeployCovenantVerification`, `GenerateTargetTraversal.ts:9897-10037`; genesis
assert at 9991-10019) must emit, per child data-NFT, the **post-`foo`** commitment instead of the default.

- **General `foo` (target): compile `foo` as a pure state-transition subroutine.** Emit a function
  `[stateCommitment, ...args] -> [newStateCommitment]` that decodes the commitment into the child's state
  vars, runs `foo`'s body (reusing statement codegen over those locals + the args), and re-encodes. The
  deploy covenant pushes the **default** commitment (the existing `emitDefaultValue`+encode), pushes the
  parent's `foo`-arg expressions, `OP_INVOKE`s the subroutine, and `OP_EQUALVERIFY`s the child output
  against the result. Multiple folded calls chain (output of one is input of the next). This reuses state
  encode/decode, the statement visitor, and the OP_DEFINE/OP_INVOKE subroutine machinery.
- **Direct-setter fast path** (`this.field = param`): skip the subroutine; emit the parent's arg
  expression for that field directly. (Optimization; same observable result.)

### 3. SDK - read the genesis back from the trace

Today the child genesis is static defaults (`StatefulContract.ts:1403`, `buildInitialStateCommitments`).
Because the covenant pushes its expected commitment immediately before each `OP_EQUALVERIFY`, the SDK reads
it straight out of the deploy probe rather than recomputing:

- extend `extractCommitmentsFromTrace` (`StatefulContract.ts:305-389`, value read at line 360) usage so the
  child data-NFT output range is captured from the **parent's deploy probe** (the same probe `deployFrom`
  already runs at `_deriveCommitments:1531`, child outputs passed as `extraOutputs`);
- feed those extracted commitments into the child outputs (1517-1527 probe / 1647-1657 final tx) instead of
  `buildInitialStateCommitments`. SDK reads exactly what the covenant computes => match by construction, no
  double execution, works for any `foo` the covenant can run.

For the direct-`deploy()` path (`_deriveDeployCommitments:2130`), the analogous hook is a second probe after
the constructor-convergence loop that re-runs with the child's `foo` unlocker (agent-identified, ~2199/2388).

## Multi-data-NFT caveat (fix as part of this)

The SDK's `buildPushdataCommitment` prepends an `encodeNftIndexTag(nftIndex)` byte when `dataNftCount > 1`
(`utils/src/state.ts:830-832`), but the deploy covenant's inline commitment builder (GTT:9993-10006) does
**not** stamp that tag. For multi-data-NFT children the SDK-built and on-chain-expected commitments would
diverge by that leading byte. The covenant must stamp the same nft-index tag (or both must drop it). Add a
targeted multi-NFT deploy test to pin parity before/while building the fold.

## Anchors

- AST: `InstantiationNode` `AST.ts:878-896` (add `foldedCalls`); `deployTargets` `AST.ts:204`.
- Semantic: `visitInstantiation` `SymbolTableTraversal.ts:3906`; var-def `~3296`; external-call sites
  `3673` / `5785`; pre-scan `collectExternalCalls` `2793`; type=`bytes` `TypeCheckTraversal.ts:1371`;
  receiver-type=`AddressType(interfaceName)` `AstBuilder.ts:1146`.
- Codegen: `emitContractDeployment` `GTT:6528-6681`; deploy covenant `9897-10037` (genesis `9991-10019`);
  `emitDefaultValue` `8824-8870`; `pendingDeploys` `343-350`.
- SDK: `deployFrom` `StatefulContract.ts:1331`; `_deriveDeployCommitments` `2130`; `_deriveCommitments`
  `2671`; `extractCommitmentsFromTrace` `305` (value at `360`); `buildInitialStateCommitments`
  `utils/src/state.ts:920`; `buildPushdataCommitment` `820`; nft-index tag `830-832`.

## Phasing

- **P1 (foundation):** AST `foldedCalls`; detection of deploy-result-local + call; foldability analysis;
  `DeployFoldError` diagnostic (closes the unsound-tx hole); suppress the external call. Tests: diagnostic
  fires for non-foldable and for the previously-unsound case; foldable case is detected (no external call
  collected).
- **P2:** multi-NFT commitment-tag parity fix + test.
- **P3 (codegen):** the state-transition subroutine in the deploy covenant; SDK trace-extraction of the
  child genesis. e2e: child lands configured in one tx; wrong folded genesis rejected on-chain.
- **P4:** direct-setter fast path; `deploy()`-path second probe; broaden foldable surface; docs in
  external-contract-calls.md / modifiers.md.
