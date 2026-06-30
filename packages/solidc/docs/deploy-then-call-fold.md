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

**Foldability.** The eventual target is any pure `(state, args) -> state` transition. **Implemented today**
(`tryFoldDeployCall` + `foldGenesisExpr`): a `foo` whose body is a **straight-line** sequence of
`T local = <expr>;` and `this.<field> = <expr>;` assignments (plus an optional trailing `require`). Each RHS
folds into a parent-context expression where, on the child's default state:
- an identifier resolves to a forwarded arg or an earlier local;
- a `this.<field>` read resolves to the value written EARLIER in the call (`fieldExprs`) or, if not yet
  written, the field's type default (`createDefaultValueExpression`);
- the operators allowed are arithmetic / comparison / bitwise / cast / ternary.

So `this.counter = this.counter + 1` folds to `1`; `int x = sup*2; this.a = x` inlines the local;
`this.a = sup; this.b = this.a + 1` chains. The folded expressions are cloned, so the child's own
compilation is untouched; TypeCheck types them (see `visitInstantiation`).
- Not yet foldable (-> `DeployThenCallError`): **control flow** (if/loops), function calls, contract
  constants; and the always-forbidden `tx.*`, `msg.sender`/`msg.value`, external calls, `emit`,
  `blockhash`/block.*, `new`/`deploy`, `selfdestruct`. Control flow needs the state-transition subroutine
  below.

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

### 3. SDK - read the genesis back from the trace (DONE for `deployFrom`)

The child genesis used to be static defaults (`StatefulContract.ts:1403`, `buildInitialStateCommitments`).
Because the covenant pushes its expected commitment immediately before each `OP_EQUALVERIFY`, the SDK now
reads it straight out of the deploy probe rather than recomputing:

- `_deriveCommitments` takes a `childDataNftCount` param and, after deriving the factory state, runs one
  extra probe pass with the factory state correct (`runProbe(commitmentHexes)`) so the trace reaches the
  child genesis verify (which sits after the factory-state + entry verifies). `extractCommitmentsFromTrace`
  reads the expected commitment for the child data-NFT output range
  (`{min: 1 + nfts + bhCoSpends + entryCount + 1, ...}`) and returns it as `childCommitments`.
- `deployFrom` passes `childLayout.dataNftCount`, then uses `effectiveChildCommitments[i] =
  derivedChildCommitments[i] ?? childCommitments[i]` for the final child outputs (1647-1657). A plain deploy
  emits its defaults, so the trace value equals the static one; a folded deploy emits the post-call state.
  SDK reads exactly what the covenant computes => match by construction, works for any `foo` the covenant runs.

Limitation: a deploy function that **writes mapping entries** is unsupported in the fold path - the entry
verify would abort before the child verify is reached, so the extra pass can't capture the child commitment.

**Ergonomic sugar + context resolution.** A deploy-modifier function is a single terminal call. With a
connected signer (the existing `Signer` abstraction - ethers-style) it is just the function args:

```
const signed = factory.registerChild(childArtifact).connect(signer);
await signed.deployConfigured(sig, owner, c0, a0);
```

- The instance method for a deploy function returns a **thenable** `DeployFunctionCall`; awaiting it runs
  `_deployFromSigner`, which picks a genesis-valid (vout 0, token-free) UTXO from the signer and uses the
  signer's `unlockP2PKH()` + address for funder + change. `.deploy({ fundingUtxo, ... })` stays for explicit
  / no-signer control; `DeployFromCallOptions` is `DeployFromOptions` minus the four call-derived fields
  (provider, factory, deploy-function name, args).
- The child + funding are resolved from context (so even the explicit form is short):

- **childArtifact**: explicit option, else the registered artifact for the deploy target's `contractName`.
- **childConstructorArgs**: explicit, else derived from the compiler-recorded `new C(param)` mapping
  (`deployTargets[].constructorArgs`: the deploy-parameter name per child ctor arg, null for a non-trivial
  expression) applied to the deploy args. The child category is the funding UTXO's txid (vout 0), so the
  child address derives forward from (artifact, ctor args, category) - no trace reverse-derivation (a p2sh
  hashes the redeem script, so the args are not recoverable from the trace anyway).
- **funder / changeAddress**: explicit, else `factory.setDeployDefaults(...)`.

Falls back to requiring explicit values when the mapping is absent (old artifact) or a ctor arg is a
non-trivial expression. A generated `.ts` artifact types the method name; `compileString`'s generic `Artifact`
needs a cast.

For the direct-`deploy()` path (`_deriveDeployCommitments:2130`), the analogous hook is a second probe after
the constructor-convergence loop that re-runs with the child's `foo` unlocker (agent-identified, ~2199/2388).
Not yet wired (only `deployFrom` is done).

### Codegen gotcha: the folded field must be OP_PICK, not OP_ROLL

The deploy covenant genesis loop (GTT:~10001) emits the folded field value with `this.visit(foldedExpr)`,
where `foldedExpr` is the parent's arg node (e.g. a function parameter `c0`). Two things were required to
make it execute:

1. **Force OP_PICK** by bumping `this.scopeDepth` around the visit. The folded arg node is registered as the
   variable's *final use* (the call that referenced it was folded away, so it is never emitted in the body),
   so `visitIdentifier` would otherwise OP_ROLL it - consuming the param off the stack - while the
   `this.stack = savedStack` restore puts it back in the model. That model/runtime drift makes every later
   `OP_PICK`/`OP_ROLL` in the covenant read the wrong depth ("read from an empty stack").
2. **Keep visit()'s tracked entry** (do *not* popFromStack). `emitPushdataEncode` consumes one tracked value,
   and a subsequent folded field's pick depth must account for this field's runtime push. The final
   `savedStack` restore discards the accumulation.

## Multi-data-NFT child deploys (DONE)

A child whose fixed-size state spans more than one data NFT was never actually deployable via a factory.
Three compounding bugs, all fixed:

1. **Stale `deployedDataNftCount`.** Semantic analysis computes it from the child's `nftIndex` values
   (`SymbolTableTraversal.ts:4012`), but an imported child has not been bin-packed into NFTs yet when the
   parent's `new C()` is visited (cross-file order), so the count came out 1. Recompute it from the
   now-packed `deployedStateVars` in `emitContractDeployment` (GTT), before the deployTarget ABI / covenant
   loop / deploy offset read it. (Single-NFT children: `max(0)+1 = 1`, unchanged.)
2. **Missing nftIndex tag in the genesis.** `buildPushdataCommitment` prepends `encodeNftIndexTag(nftIndex)`
   when `dataNftCount > 1` (`utils/src/state.ts:830`), and the child's own covenant verifies it, but the
   deploy genesis builder didn't stamp it - so the child was born in a state its own covenant can't read.
   Stamp it (GTT genesis loop), keyed on the CHILD's NFT count, mirroring the canonical write path (GTT:8932).
3. **Unmodeled OP_CAT.** The genesis loop emitted `OP_CAT` without updating the stack model, so after the
   first CAT a folded field's `visit()` pick depth drifted by one. Track `emitDefaultValue`'s push and model
   the CAT's net -1 - both model-only, so existing deploy bytecode is byte-identical.

SDK: `_deriveCommitments` iterates the child extraction - the covenant verifies child NFTs in order and
aborts at the first mismatch, so for a folded multi-NFT child it captures NFT 0, feeds it back into the
probe output, and re-runs to reach NFT 1 (a plain deploy resolves in one pass). Pinned by e2e: a 4x bytes32
child spanning 2 data NFTs deploys both plain (tagged defaults) and folded (configured across both NFTs).

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
- **P2 - DONE:** multi-data-NFT child deploys (stale count recompute + genesis nftIndex tag + OP_CAT model
  + SDK iterative child extraction) + plain & folded multi-NFT e2e. See "Multi-data-NFT child deploys" above.
- **P3 (codegen) - DONE for straight-line callees:** deploy covenant emits the post-call field values
  (folded expr via OP_PICK leaves); SDK trace-extraction of the child genesis (`deployFrom`). Each field's
  RHS may be any straight-line expression over the callee's params, earlier locals, and `this.field` reads
  (earlier-write or default) - arithmetic / cast / ternary. e2e (`DeployThenCallFold.e2e.test.ts`): direct
  setters, a computed callee (`total=sup*2`), a local + sequential + default-read callee (`a=sup*2`,
  `b=a+1`, `c=default+5`), and multi-NFT - all evaluated on-chain in one tx; the covenant runs on `send()`,
  so success proves it accepted the SDK-supplied post-call genesis.
- **P4 (open):** control flow (if/loops) via a true state-transition subroutine that decodes the default
  commitment and runs `foo`'s body; folded deploy + factory mapping-entry writes; the direct-`deploy()`-path
  second probe; docs in external-contract-calls.md / modifiers.md.
