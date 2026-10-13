# Kernel beta candidate — next-agent handoff

Updated: 2026-09-15 (Europe/Berlin)

## Goal and boundaries

Work in `/Code/cashscript/.worktrees/kernel-beta-candidate` on branch
`grok/message-bus-kernel-beta`. Make all 66 unchanged titles in
`bench/effectiveacceleration/test/marketplace.test.ts` green on mock BCH-2026 while preserving
`artifact.messageBus.convention === 'kernel-row-loop'` and the graph-handler `OP_INVOKE` boundary.

Do not edit Marketplace/Unicrow Solidity or the Marketplace suite. Do not use chipnet, Hardhat, a 10k-P2SH
escape hatch, beta-manifest widening, or cherry-picking. `OP_RETURN` is separator-only. Implement support from
type/effect/flow/layout properties and authenticated metadata, never source names or application shapes. Keep one
compiler/SDK writer and work one Marketplace title at a time. Commit coherent, verified slices periodically.

Planning context:

```text
/root/.grok/sessions/%2FCode%2Fcashscript/01a08719-2af7-7972-a026-bee8bc1bf3b3/goal/plan.md
/tmp/grok-goal-e3920f329cc4/implementer/beta-reach-extension-inventory.md
```

The worktree has many generated untracked files. Never use `git add -A`; stage only reviewed source, tests, and
this handoff.

## Current checkpoint

Current implementation HEAD is `f99a1a68b`:

```text
f99a1a68b fix(sdk): recover event lock from selected schema
5f1b20dab fix(message-bus): recognize split event equality pins
78547780d fix(solidcash): rebase routed delegate input witnesses
e32b48366 fix(solidc): anchor routed delegate chunks to owner blocks
b8ad10ec9 fix(graph): preserve conditional call activation through helpers
20ab57efd feat(graph): authenticate producer-result condition lanes
92dc3a7d0 fix(solidc): distinguish control predicates from arms
5ed4c6c69 fix(solidc): preserve graph participant owner frames
e50ffd892 Merge branch 'grok/message-bus-kernel-beta-perf' into grok/message-bus-kernel-beta
```

Tracked state was clean before this handoff update. Root `yarn build` passed. Focused neutral checks passed:

```text
packages/solidcash/test/unit/DelegateInputIndexCoordinates.test.ts       1/1
packages/solidcash/test/journal-message-bus/e2e/MessageBusEventIdentity.test.ts  1/1
packages/solidc/test/DelegateInference.test.ts dynamic route selection   PASS
```

`78547780d` rebases isolated graph-participant delegate witness coordinates by participant owner/block base. It
moved the unchanged `post job 1` failure from proxy input 129 to the correct implementation input 214.

`5f1b20dab` recognizes both adjacent `OP_EQUALVERIFY` and split `OP_EQUAL OP_VERIFY` event pins.

`f99a1a68b` fixes the resulting event relocation deadlock: when a commitment mismatch stops execution before the
following locking-bytecode pin, composition may recover the lock only when the selected handlers' published event
schemas decode that commitment to exactly one covenant lock. Ambiguous and unknown schemas remain fail-closed.
Its neutral regression removes the trace lock and verifies successful shared-slot event composition.

## Resolved event-slot blocker

Freshly compile the separately emitted imported implementation before testing; rebuilding only
`MarketplaceV1.sol` does not refresh `MarketplaceDataV1.json`:

```bash
cd /Code/cashscript/.worktrees/kernel-beta-candidate/.marketplace/iteration
yarn build
./recompile.sh MarketplaceDataV1.sol
```

Before `f99a1a68b`, the unchanged focused title failed at implementation input 214:

```bash
cd /Code/cashscript/.worktrees/kernel-beta-candidate
yarn vitest run --config vitest.marketplace.config.ts -t 'post job 1$'
```

Exact trace:

```bash
SOLIDC_DEBUG_ONLY_PREFLIGHT_INPUT=214 \
SOLIDC_TRACE_INPUT=214 \
SOLIDC_DEBUG_FAILURE_POINT=1 \
SOLIDC_DEBUG_FAILURE_RING=1 \
SOLIDC_DEBUG_ROUTE_INPUT_INDEX=214 \
yarn vitest run --config vitest.marketplace.config.ts -t 'post job 1$' \
  > /tmp/post1-fresh214.log 2>&1
```

Evidence from `/tmp/post1-fresh214.log`:

- input 214 is the implementation executor for participant owner input 129;
- handler id 55 reaches `OP_OUTPUTTOKENCOMMITMENT` at ip150 and fails `OP_EQUALVERIFY` at ip151;
- its index helper is `OP_7 OP_PICK; OP_12 OP_ADD; OP_7 OP_PICK; OP_ADD`;
- the computed output is 143: owner 129 + fixed event offset 12 + selected site 2;
- expected is the 180-byte event commitment `0000147178...045cfb5565`;
- actual output 143 is still neutral and has an empty commitment.

The SDK audit localized the causal loop:

1. `_messageBusEventCommitmentsFromTransaction` discovers the expected commitment for output 143 from the
   failing comparison.
2. Execution stops at that equality, so it cannot discover the output locking bytecode from later introspection.
3. The target filter in `packages/solidcash/src/message-bus/compose.ts` around line 3908 currently requires both a
   nonempty commitment and `expectation.lockingBytecode !== undefined`.
4. Therefore it refuses to materialize output 143 and convergence repeats the same failure.
5. `eventLockingBytecodeForCommitment(participant, commitment)` can already parse the commitment against the
   selected handler artifact schemas and return a unique covenant lock.

That general fix and its neutral regression are committed in `f99a1a68b`. Validation passed:

```text
packages/solidcash/test/journal-message-bus/e2e/MessageBusEventIdentity.test.ts  1/1
root yarn build                                                                 PASS
git diff --check                                                                PASS
```

One read-only compiler audit also noticed that DEFINE setup skips both `__internal__returnOutputIdx` and
`__internal__msgSenderCategory`, whereas the caller says the latter is consumed. Treat this as a separate latent
frame-risk to reduce and test; the current fresh runtime trace nevertheless computes the correct output 143, so it
is not evidence for changing the already-correct current owner/event coordinate.

## Exact current blocker

After `f99a1a68b`, `post job 1` passes the output-143 event commitment and locking-bytecode checks, then fails in
the outer route. The diagnostic log is `/tmp/post1-schema-lock-trace-agent.log`.

The failing outer opcode is ip14721 `OP_EQUALVERIFY` followed by ip14722 `OP_2DROP`. This is not an event mask or
event identity check. It is `emitValueChunkWrite`'s final `matches == expected count` assertion in
`GenerateTargetTraversal.ts` around lines 20380–20383:

```text
actual matching outputs:   2
expected chunk count:      0
last scanned output index: 307
```

The next generic investigation is resource/dynamic-value cleanup and final-layout reassertion: two outputs matching
the computed value-chunk address survive even though the selected write's new encoding needs zero external chunks.
Trace which descriptor/producer identity owns those outputs, whether they are stale provisional chunks or duplicate
materialization, and which convergence phase recreates them. Do not infer identity from argument position or names.
Add a neutral regression for a graph-selected value replacement that transitions from external chunks to an inline
zero-chunk encoding and rejects/scrubs surplus matching outputs.

## Continuation order

After the generic surplus value-chunk fix:

1. Run its neutral regression and relevant message-bus unit/e2e file.
2. Run root `yarn build`.
3. Explicitly recompile `MarketplaceDataV1.sol`.
4. Re-run unchanged `post job 1$`.
5. Re-run unchanged `post two jobs` and confirm distinct event/resource slots.
6. Continue Tier 1 (`invalid mece`, then the remaining inventory ladder) one title at a time.
7. Run all 66 only after focused titles are stable.

Do not hide compiler exceptions behind fallback compilation. A successful fresh compile must have no speculative
stack/codegen failure.

## Architectural checkpoint and pause rule

Enforce these invariants:

1. Every graph call has exactly one stable callsite identity.
2. Later calls consume authenticated producer-result IDs, never cloned call AST nodes.
3. Graph handlers stay behind one consistent `OP_INVOKE` boundary.
4. Fresh successful compilation has no hidden speculative errors.
5. Support is expressed by type/effect/flow/layout properties, never names or application shapes.
6. Differential tests compare kernel/legacy observable semantics; route-size tests separately prove kernel size is
   proportional to row logic rather than maximum unrolled rows.

The preferred beta stop is 66/66, two deterministic clean beta-gate runs, one-shot `yarn build`, and a recorded
same-machine cold compile/contract-size comparison against legacy. If an edge-case frontier prevents 66/66, pause
only at a coherent slice: neutral regression and earlier ladder titles green, deterministic fresh compile, explicit
kernel refusal for unsupported shapes, no application-name authority, and one reduced reproducer or bounded stable
invariant for the remaining blocker. Do not claim full Marketplace compatibility before 66/66.

Before committing production changes, audit additions:

```bash
git diff -U0 -- packages/solidc/src packages/solidcash/src | \
  rg '^\+.*(Marketplace|jobs\b|publishJobPost|publishJobEvent|JobEvent|Unicrow|FakeToken)'
```
