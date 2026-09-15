# Kernel beta candidate — next-agent handoff

Updated: 2026-09-15 (Europe/Berlin)

## Workspace and goal

Work in `/Code/cashscript/.worktrees/kernel-beta-candidate` on branch
`grok/message-bus-kernel-beta`.

Long-term acceptance target: all 66 unchanged titles in
`examples/effectiveacceleration/test/marketplace.test.ts` pass on mock BCH-2026 with
`messageBus.convention === 'kernel-row-loop'` and graph handlers behind `OP_INVOKE`.

For the bounded beta checkpoint, do not make 66/66 a release gate. Freeze the manifest proof matrix, close the
live application-name-dependent SDK paths listed below, add and stabilize the proposed Marketplace smoke slice,
and cut the RC after two clean deterministic gate runs. The remaining Marketplace ladder is post-beta unless the
release claims full Marketplace compatibility.

The tree contains many generated `.js`, `.js.map`, `.d.ts`, and `.tsbuildinfo` files. Never use `git add -A`;
stage reviewed source, tests, and handoffs explicitly.

## Architecture that must remain true

- Every graph call has one stable compiler callsite identity.
- Consumers use authenticated producer-result IDs, never cloned call nodes.
- Repeated calls to one participant retain separate logical rows but share its physical state inputs.
- Return wire encoding is compiler-owned and tuple-wide:
  `evm-abi-v1 | compact-pushdata-v1`.
- Result encoding is resolved per function/callsite/row, never from one artifact-wide Solidity flag.
- Fresh kernel compilation must not hide speculative stack/codegen failures.
- Support is based on type/effect/flow/layout properties, never application names or shapes.
- Kernel/legacy differential semantics and kernel row-size scaling are separate gates.
- `OP_RETURN` remains separator-only.

Do not edit Marketplace/Unicrow Solidity sources or the Marketplace suite. Do not use chipnet, Hardhat, a 10k
P2SH escape, beta-manifest widening, or cherry-picking.

## Verified current work

### Vmap/outState scanner

The row-loop output scanner now uses the live scan index for commitment introspection (`OP_DUP`, not `OP_OVER`).
It preserves an exact match if a later bracket is encountered. Full regression:

```text
OutStateAndReturns.test.ts: 39/39 PASS
```

### External result encodings

The compiler now publishes one shared classifier result through:

- `AbiFunction.resultEncoding`
- typed `ExternalCallAbi.resultEncoding`
- invocation-analysis result dependencies
- returning message-bus handlers

The SDK resolves old artifacts conservatively: native missing metadata means compact; Solidity missing metadata
may infer EVM only for unambiguous one-word scalar tuples; ambiguous dynamic/composite schemas fail closed.

Composition, graph planning, provisional/precomputed results, route traces, loop/static returns, writer defaults,
and `decodeMessageBusResults` now use exact invocation/row encodings. Mixed result rows are decoded independently.

Focused verification:

```text
ExternalResultEncoding.test.ts:       1/1 PASS
MessageBatchEncoding.test.ts:        12/12 PASS
ExternalCallPredicate.test.ts:       27/27 PASS
GraphProducerResult.test.ts:           8/8 PASS
EvmAbiResult.test.ts:                  3/3 PASS
SolidityAbiReturnFraming.test.ts:       5/5 PASS
solidc build:                              PASS
solidcash build:                           PASS
```

Commit `02deabb60` makes the compiler-generated route's outer `bytes` carrier explicitly compact while preserving
each child row's published EVM/compact encoding. User-authored compatibility-mode `abi.encode` remains Solidity
ABI and still fails closed for unsupported types such as `bytes39`.

### Repeated calls to one participant

Direct callsites now reuse an existing physical external-call group by exact live master outpoint. Aliases keep
their own selector, arguments, callsite, and result metadata but add no duplicate master/block inputs. This is
application-independent and has focused unit coverage.

## Fenced frontier: returning calls to one repeated participant

Regression:

```bash
cd packages/solidcash
yarn vitest run --config vitest.e2e.config.ts test/e2e/CrossContractCallInfra.test.ts \
  -t 'mixed result encodings'
```

The duplicate-state-input part is fixed, but compiler admission deliberately continues to reject repeated-owner
grouping when a row returns values (`!slot.hasReturnValues`). A partial widening was explored and reverted before
commit because it violated the graph invariants below. The focused mixed-result e2e is therefore an intentionally
red future-support test, not an advertised beta proof.

Full support requires one stable logical `resultOrdinal` per row, row-aware graph-handler prologue verification,
row-specific graph result names, exact aggregate-row selection in the caller, and selected-row schema validation
in SDK `graph.ts`. Do not widen admission until all of those land together. Do not duplicate the participant input,
point multiple callsites at one result index, or authenticate a clone of the source call node.

## Bounded beta stop rule

Release blockers are limited to:

- a clean `node scripts/kernel-beta-gate.mjs` run without `--allow-dirty`, repeated twice with identical fresh
  compile hashes and no stderr or caught speculative compiler attempts;
- regressions in the frozen manifest proof inventory, the proposed Marketplace smoke titles (post job 1, post two
  jobs, whitelist post, invalid-MECE guards, whitelist-worker), legacy compilation, determinism, or the six
  architectural invariants;
- soundness/security failures, silent kernel-vs-legacy semantic mismatches, or executable production-name-based
  SDK/compiler behavior;
- loss of proportional route-size evidence. Record same-machine cold medians and keep kernel route bytes materially
  below legacy; do not claim full artifact-size improvement or 10KB deployability.

A newly discovered shape is not a beta blocker if admission deterministically rejects it with one of the published
kernel reasons. Add a negative admission test and release-note entry, then defer it. New positive support must be
described by type/effect/flow/layout metadata, have an alpha-renamed neutral test, and include kernel-vs-legacy
observable parity.

## Marketplace frontier

The proposed five-title smoke slice is not currently part of `scripts/kernel-beta-manifest.json` or
`scripts/kernel-beta-gate.mjs`; a clean gate can pass without it. Recorded evidence confirms the four posting
titles, but `should whitelist worker` previously exceeded a 300-second wrapper and has not been proven green. Do
not describe the five-title slice or Tier 1g as green until a fresh run establishes that result.

Exact proposed smoke command:

```bash
yarn vitest run --config vitest.marketplace.config.ts \
  -t '^(Marketplace Unit Tests job posting (post job 1|post two jobs|post job with whitelist|post job with invalid mece tags)|Marketplace Unit Tests job worker whitelisting should whitelist worker)$' \
  --reporter=dot --no-file-parallelism
```

The latest recorded full-suite baseline is 26 passing and 39 failing before timeout. The scratch inventory records
Tier 1g's current blocker as `update job`; older prose claiming all Tier 1g titles were individually green is not
evidence-backed. After the smoke slice, the next investigation title remains Tier 1f:

```bash
yarn vitest run --config vitest.marketplace.config.ts \
  -t 'take job.*sanity checks$' --reporter=dot --no-file-parallelism
```

Earlier 120-second wrappers timed out, but the suite's real timeout is 600 seconds and the title performs several
deployments plus many negative calls. Do one full 600-second run before classifying it as a convergence bug.

## Generality debt before beta

The SDK still has live, unfenced application-shape logic. Audit and replace or fence at least these areas before the
beta checkpoint:

- `StatefulContract.ts`: the `publishJobEvent`/`JobEventData` reconstruction and positional timestamp paths around
  the former lines 5613, 14794, 24057, and 25336;
- `StatefulTransactionBuilder.ts`: `publishJobEvent` input/output layout handling, `_ensureDistinctJobEventNfts`,
  and `transferFrom`/`balances` repair or surplus-stripping paths around the former lines 4098, 7397, 9111, 10114,
  16313, and 19468.

Replace live name-based behavior with compiler-authenticated mutation, event-instance, resource-identity, and
physical-layout metadata. Add a genuinely alpha-renamed chunkable-array/nested-delegate/multi-emit regression;
the existing schema-name isolation test is too weak.

## Useful context

```text
HANDOFF_KERNEL_BETA_CURRENT.md
HANDOFF_NEXT_SESSION.md
/root/.grok/sessions/%2FCode%2Fcashscript/01a08719-2af7-7972-a026-bee8bc1bf3b3/goal/plan.md
/tmp/grok-goal-e3920f329cc4/implementer/beta-reach-extension-inventory.md
```
