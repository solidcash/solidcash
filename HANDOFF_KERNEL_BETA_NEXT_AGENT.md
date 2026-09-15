# Kernel beta candidate — next-agent handoff

Updated: 2026-09-15 (Europe/Berlin)

## Resume point

Work in `/Code/cashscript/.worktrees/kernel-beta-candidate` on branch
`grok/message-bus-kernel-beta`. The latest implementation checkpoint is:

```text
699287803 fix(sdk): decode dynamic EVM view returns
```

The active goal is to make all 66 unchanged titles in
`examples/effectiveacceleration/test/marketplace.test.ts` green on mock BCH-2026 while preserving
`artifact.messageBus.convention === 'kernel-row-loop'` and the graph handler `OP_INVOKE` boundary.

Commit coherent, verified slices periodically. The tree contains hundreds of generated untracked `.js`, `.d.ts`,
`.js.map`, and build metadata files. Never use `git add -A`; stage only explicitly reviewed source, tests, and this
handoff.

Planning context:

```text
/root/.grok/sessions/%2FCode%2Fcashscript/01a08719-2af7-7972-a026-bee8bc1bf3b3/goal/plan.md
/tmp/grok-goal-e3920f329cc4/implementer/beta-reach-extension-inventory.md
```

## Latest verified result

The unchanged Marketplace `read mece tag` title is green in 10.25 seconds.

The failure was not persistence, mapping selection, or compiler repeated-read stack lifetime. The SDK extracted
the correct canonical 96-byte EVM ABI string blob, but `_deriveReturnValue` used the scalar-only decoder. When
that returned `undefined`, the native compact-pushdata fallback interpreted the ABI's leading zero as an empty
string. Commit `699287803` uses the existing schema-validating `decodeEvmReturnValue` instead.

The neutral regression is
`packages/solidcash/test/e2e/RepeatedMappingReadDelegate.test.ts`. It covers a proxy/delegate contract with
`mapping(string => string)`, an initialized inline value, a guard read followed by a repeated return read, and an
`OP_INVOKE` body.

Verified for that commit:

```text
solidcash TypeScript build: PASS
ExternalReturnEncoding.test.ts: 22/22 PASS
RepeatedMappingReadDelegate.test.ts: 1/1 PASS
unchanged Marketplace `read mece tag`: PASS (10.25s)
git diff --check: PASS
```

Full-file ESLint on `StatefulContract.ts` remains baseline-red with thousands of pre-existing findings; the diff
check was clean.

## Recent performance checkpoints

```text
2e141a09a perf(sdk): skip non-observing convergence inputs
4dfd49bbd feat(sdk): add partial covenant validation receipts
96d76caa6 perf(sdk): prefilter commitment introspection inputs
1046e954b perf(sdk): bound convergence history memory
```

These moved the MarketplaceData initializer from more than 15 minutes and 15.4 GiB RSS to a complete focused read
title in seconds:

- convergence history retains fixed-width transaction hashes rather than serialized transactions;
- immutable authenticated input programs are inspected once and cached;
- inputs that cannot execute `OP_OUTPUTTOKENCOMMITMENT` are excluded from mutable-resource convergence;
- pushed bytes are ignored, `OP_DEFINE` bodies reached by `OP_INVOKE` are inspected, P2SH20/P2SH32 redeem hashes
  are authenticated, and malformed/uncertain programs remain conservatively eligible;
- a separate exact, one-use, tx/source-bound partial-validation receipt API exists, but preflight does not yet
  consume it.

Focused eligibility plus computed-output tests pass 34/34, and the SolidCash build passes.

## Current blocker

`post job 1` has a later large-graph scaling problem. After the fast initializer completed, a bounded diagnostic
run reached about 5.6 GiB RSS in 75 seconds and was stopped. Do not simply rerun it without a bound or increase its
timeout.

Resume by localizing the phase with a bounded, low-volume timing run, for example:

```bash
timeout 60s env SOLIDC_DEBUG_BUILDER_TIMING=1 \
  yarn vitest run --config vitest.marketplace.config.ts \
  -t 'post job 1' --reporter=dot --no-file-parallelism \
  > /tmp/kernel-post-job-1-timing.log 2>&1
```

Identify the first repeating convergence/layout state before editing. Keep one SDK/compiler writer. Parallel agents
may perform read-only audits of independent suspected phases.

After a general fix, rerun `post job 1` first, then continue the Tier 1 ladder one unchanged Marketplace title at
a time. Do not weaken verification, add title-specific harness branches, or edit the suite/contracts.

## Genericity checkpoint — beta blocking

A read-only audit found kernel-reachable application-shaped behavior that must be replaced, not renamed:

- `packages/solidcash/src/stateful/StatefulContract.ts` around the historical
  `publishJobEvent`/`JobEventData` paths reconstructs values and entry keys from names and positional arguments;
- `packages/solidcash/src/stateful/StatefulTransactionBuilder.ts` contains `_ensureDistinctJobEventNfts` and a
  larger JobEvents persistence subsystem with literal event schema, enum, timestamp, and payload-byte knowledge.

The general replacement should use existing compiler metadata:

- `EntryAccessAbi.storedElementSource`;
- `ValueChunkWriteDescriptor`;
- authenticated `ValueChunkProducerIdentity`;
- exact resource identity `{categoryId, collectionHash, keySlot}`;
- stable producer path/effect ordinal and, for events, a stable event-producer identity.

Derive entry coordinates from the published `keySlot`, never `args[0]`. Kernel paths must fail closed when the
recipe is absent or ambiguous. If legacy schema compatibility must remain, fence it explicitly to
`legacy-unroll`; it must not influence kernel authority.

Before each commit, audit additions with:

```bash
git diff -U0 -- packages/solidc/src packages/solidcash/src | \
  rg '^\+.*(Marketplace|jobs\b|publishJobPost|publishJobEvent|JobEvent|Unicrow|FakeToken)'
```

## Architectural invariants

1. Every graph call is represented exactly once by stable callsite metadata.
2. Later calls consume authenticated producer-result IDs, never cloned `ExternalFunctionCallNode`s.
3. Graph handlers remain behind the same `OP_INVOKE` boundary.
4. A successful fresh compile produces no hidden speculative stack/codegen errors.
5. Support is expressed by type/effect/flow/layout properties, never source names or application shapes.
6. Differential tests compare kernel and legacy observable semantics; proportional kernel route size is tested
   separately from the maximum unrolled row count.
7. `OP_RETURN` is separator-only.

Do not edit Marketplace/Unicrow Solidity sources or the Marketplace suite. Do not use chipnet, Hardhat, a 10k
P2SH escape hatch, beta-manifest widening, or cherry-picking.

## Meaningful pause rule

Do not grind an unlimited edge-case frontier for beta. A sound pause point is a coherent architectural slice where:

- its alpha-neutral regression and relevant existing suites pass;
- its corresponding unchanged Marketplace title and all earlier ladder titles are rechecked;
- fresh compilation is deterministic and has no caught speculative error;
- unsupported shapes are explicitly rejected with a published kernel reason;
- no application-name behavior is introduced or left as kernel authority;
- kernel/legacy observable parity is covered separately from route-size scaling;
- the remaining blocker has one reduced reproducer or one stable, bounded failing invariant.

The preferred final stop remains 66/66, two deterministic clean beta-gate runs, a full one-shot `yarn build`, and
recorded same-machine cold compile/size comparison. If 66/66 is not reached, do not claim full Marketplace
compatibility; use the bounded architectural pause rule above.

## Recent commit chain

```text
699287803 fix(sdk): decode dynamic EVM view returns
f6f8ae23d docs: refresh kernel beta handoff
2e141a09a perf(sdk): skip non-observing convergence inputs
4dfd49bbd feat(sdk): add partial covenant validation receipts
96d76caa6 perf(sdk): prefilter commitment introspection inputs
1046e954b perf(sdk): bound convergence history memory
ebbb51a90 test(kernel): verify emitted verifier lock
3f87729f9 fix(kernel): bind published verifier identity
0cd0ec43d fix(sdk): gate dynamic placeholders by selected rows
1ac4d30ca fix(sdk): authenticate route entry coordinates
32c4a3c55 fix(sdk): decode aggregate delegate payload arguments
08031a54e fix(sdk): preserve atomic graph discovery boundaries
990189cbe docs: hand off kernel allowance resource frontier
10520b381 feat(kernel): authenticate fixed collection tuple alternatives
```
