# Kernel beta candidate — next-agent handoff

Updated: 2026-09-15 (Europe/Berlin)

## Workspace and goal

Work in `/Code/cashscript/.worktrees/kernel-beta-candidate` on branch
`grok/message-bus-kernel-beta`.

Primary acceptance target: all 66 unchanged titles in
`examples/effectiveacceleration/test/marketplace.test.ts` pass on mock BCH-2026 with
`messageBus.convention === 'kernel-row-loop'` and graph handlers behind `OP_INVOKE`.

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

### Repeated calls to one participant

Direct callsites now reuse an existing physical external-call group by exact live master outpoint. Aliases keep
their own selector, arguments, callsite, and result metadata but add no duplicate master/block inputs. This is
application-independent and has focused unit coverage.

## Active blocker: mixed encodings from one repeated participant

Regression:

```bash
cd packages/solidcash
yarn vitest run --config vitest.e2e.config.ts test/e2e/CrossContractCallInfra.test.ts \
  -t 'mixed result encodings'
```

The test first exposed duplicate stateful inputs; that is fixed. It now reaches BCH-2026 preflight and fails at
caller input 0:

```text
OP_SPLIT with stack item length 0, requested split index 1
```

Exact trace: caller `B.use`, input 0, IP82 reads output 4's empty placeholder commitment and executes
`OP_SPLIT(1)`. Output 3 contains `echo`'s valid EVM result; `wide` was never executed. The compiler publishes two
stable callsites and two result modes, but repeated-owner admission currently excludes returning calls. The SDK's
new physical participant aliasing therefore executes only the first row while still allocating two result channels.

The next general step is to admit repeated-owner returning calls as one participant batch, execute every logical
row, and make each caller callsite select its own authenticated row from the participant's aggregate result vector.
Do not merely duplicate the participant input again, point both callsites at the same result index, revert the
regression, or restore artifact-wide encoding inference.

## Marketplace frontier

Tier 1e and 1g titles were individually green, including post one/two jobs, update-job variants, close/reopen, and
withdraw collateral. The next title is Tier 1f:

```bash
yarn vitest run --config vitest.marketplace.config.ts \
  -t 'take job.*sanity checks$' --reporter=dot --no-file-parallelism
```

Earlier 120-second wrappers timed out, but the suite's real timeout is 600 seconds and the title performs several
deployments plus many negative calls. Do one full 600-second run before classifying it as a convergence bug.

## Generality debt before beta

`StatefulTransactionBuilder.ts` still contains historical application-specific comments and, more importantly,
live names such as a `publishJobPost` parsed field and function-name comparisons around physical layout logic.
Replace live name-based behavior with compiler-published effect/layout metadata and alpha-renamed neutral tests;
comments should describe the invariant rather than an application.

## Useful context

```text
HANDOFF_KERNEL_BETA_CURRENT.md
HANDOFF_NEXT_SESSION.md
/root/.grok/sessions/%2FCode%2Fcashscript/01a08719-2af7-7972-a026-bee8bc1bf3b3/goal/plan.md
/tmp/grok-goal-e3920f329cc4/implementer/beta-reach-extension-inventory.md
```
