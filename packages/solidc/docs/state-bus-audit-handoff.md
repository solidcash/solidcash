# State bus/journal audit handoff

Date: 2026-07-24  
Branch: `codex/state-bus-research`  
Worktree: `/Code/cashscript/.worktrees/state-bus`  
Fork baseline: `d36116aa`

## Purpose

This is a handoff to a fresh model/reviewer. Do not infer audit completion from the remediation
claims in the existing audit documents. Re-evaluate the current branch independently, execute the
listed gates, and write a final disposition supported by current code and VM evidence.

The implementation scope intentionally excludes sharded/faceted contracts. It covers:

1. R1 scalar state journaling and callable internal state handlers.
2. R2 dynamic bytes/string state journaling.
3. R3 collection/mapping and dynamic-array journaling.
4. R4 inferred owner-local message-bus batching.
5. R5 repeated calls from one physical caller to one physical external callee, default-off.

The broader multi-participant/cyclic message bus is research only and is not an implemented or
approved release surface.

## Authoritative documents

- `packages/solidc/docs/invocation-transcript-research.md`
- `packages/solidc/docs/compiler-message-bus-v1.md`
- `packages/solidc/docs/compiler-message-bus-v1-audit.md`
- `packages/solidc/docs/state-journal-audit.md`

Treat the first two as design/specification material and the latter two as historical independent
finding reports plus remediation annotations. Verify annotations; do not trust them as evidence.

## Commits most relevant to the final audit

- `0f46a2bd fix(journal): prevent stale aliases and unsafe exits`
  - J1 cache identity correction for supported expressions.
  - J2 compile-time rejection of multi-entry wrappers with early returns.
  - BCH-2026 literal-key inflation regression.
- `1f76667f fix(journal): close remaining audit findings`
  - J3 pre-semantic external/low-level effect backstops.
  - J4 returning state-array writers inline.
  - J5 event-bearing returning journal handlers reject explicitly.
  - J6 collection/dynamic SCC metadata regressions.
- `09d62ff4 test(batch): complete adversarial output and caller gates`
  - R4 event-output and value-output substitution negatives with positive controls.
  - R5 physical-caller-removal negative with positive control.

Earlier batch remediation:

- `df3fab7e fix(batch): resolve audit resource-boundary findings`
- `b6bfff7e docs(batch): adopt the independent audit corrections`
- `357157ad test(batch): allow measured route compile under suite load`
- `87c67b83 docs(batch): freeze post-audit validation`

Review the full branch diff, not only these commits:

```sh
git diff --stat d36116aa..HEAD
git log --reverse --oneline d36116aa..HEAD
```

## Historical findings and claimed current disposition

This table is a checklist, not a conclusion.

| Finding | Claimed current behavior | Required independent evidence |
|---|---|---|
| J1 stale multi-cache aliases | Repeated parameter, literal, and nullary-global keys share one pending value; unsupported complex call-site keys reject | Inspect `canonicalCacheKey`; run literal VM repro; probe `msg.sender`, local aliases, struct fields, casts, and semantically equal expressions |
| J2 early-return write-back loss | Multi-entry wrappers containing any `ReturnNode` reject before artifact emission | Verify nested branches/loops/try/switch detection; ensure no equivalent exit bypasses the gate |
| J3 vacuous scalar effect guards | Pre-semantic method/dotted/low-level calls force established inlining | Probe external reads, stateful calls, static calls, low-level calls, deploy-like effects, library calls, and modifiers |
| J4 returning chunk-array handler | Push/pop/assign/delete returning writers inline and execute on BCH-2026 | Run the SDK VM regression and probe non-tail/multi-return variants |
| J5 dropped event | Event-bearing returning state handler that survives inlining is a compile error | Prove no event-bearing journal handler can evade the codegen check through transitive calls/modifiers |
| J6 recursive journal budget | Invocation SCC marks collection/dynamic physical entries as `recursiveStateHandler`; SDK concrete VM preflight applies | Inspect artifact propagation and test an over-budget collection/dynamic recursion build, not only metadata |
| F1 ERC-20 claim | Fixture is documented as parameter-authorized, not standard `msg.sender`-authorized `transferFrom` | Search all docs/tests/help text for overstatement |
| F2 alias safety | Raw duplicate-resource transaction rejected on BCH-2026 | Confirm test bypasses SDK construction and reaches VM |
| F3 cold resources | Compiler-route SDK structurally requires every exact existing entry | Inspect independently of `sortedBatchInfo`; probe missing/cold/non-NFT cases |
| F4 size ceiling | Library compilation emits structured `contract-size-limit`; measured route remains under 10,000 bytes | Verify library API behavior and pinned measurements |
| F5 adversarial coverage | Positional decoy, blob mutations, late entry output, duplicate input, event/value/result output, and missing caller all reject; untouched controls accept | Ensure failures occur at intended VM/covenant layer rather than construction, missing UTXO lookup, conservation, or unrelated indexing |
| F6 direct-route isolation | Enabling analysis for a non-batched call is byte-identical and direct `bal[msg.sender]` insertion executes | Re-run focused compiler and SDK invariants |

## Areas needing special skepticism

### J1 is deliberately a supported subset

`LowerCollectionJournalHelpers.canonicalCacheKey` does not implement the slot layer's complete
canonicalizer. It supports wrapper parameters, parsed literals, and `NullaryOpNode` globals and
rejects other expressions. Determine whether this is consistent with the frozen R3 contract or
whether the intended release requires safe support for local aliases, field accesses, array
accesses, casts, and equivalent constant forms. A compile-time rejection is sound but is not feature
equivalence.

### J2 blocks rather than lowers exits

The current correction rejects wrappers containing early returns; it does not insert write-backs
before every exit. Verify that the release specification permits this boundary. If R3 promises
ordinary guard-clause support, implement control-flow-correct flushing rather than accepting the
rejection as complete.

### J5 checks direct event nodes

The codegen guard detects an `EmitStatementNode` in a returning writer's body. Verify transitive
event effects, expanded modifiers, inherited helpers, and any low-level/Yul event representation.
The correct invariant is that no internally invoked journal handler can silently lose an effect,
not merely that direct Solidity-style emits are detected.

### J6 currently has metadata evidence, not a collection/dynamic over-budget SDK test

Compiler tests prove `recursiveStateHandler` is set, and existing scalar SDK tests prove the generic
preflight consumes that ABI field. A stronger completion proof should add at least one
collection/dynamic over-budget build rejection to demonstrate the end-to-end path.

### F5 failure-layer quality

The event and result mutations are covenant-oriented. The value mutation preserves total satoshis
to avoid a trivial conservation failure. The missing-caller test removes input zero after locating a
four-byte non-SCB1 selector, but removal also shifts transaction indices. Determine whether this
adequately proves caller authentication or merely guarantees an unrelated structural failure. If
weak, replace it with a valid alternate-input/caller forgery that preserves all unrelated structure.

## Test evidence at handoff

Executed from this exact worktree after commits `1f76667f` and `09d62ff4`:

```text
yarn build
PASS: six packages built

cd packages/solidc && yarn test
PASS: 51 files, 2,303 tests

cd packages/solidcash && yarn test
PASS: 368 files, 3,261 tests
SKIP: 4 files / 24 tests
TODO: 9 tests
```

Focused gates:

```text
CollectionJournalRelease3.test.ts: 14/14 pass
MessageBusRelease4.test.ts + RepeatedExternalBatchRelease5.test.ts: 29/29 pass
ScalarJournal.test.ts + CollectionJournal.test.ts: 16/16 pass
```

The repository-wide lint gate is not green on this branch due to hundreds of pre-existing
violations. Targeted lint for the changed journal semantic files/tests passed. Targeted lint for the
two batch E2E files reports only pre-existing missing-return-type errors at helper declarations.
`GenerateTargetTraversal.ts` also has extensive pre-existing lint failures. Do not report full lint
as passing.

## Required final-review procedure

1. Confirm the worktree and branch are clean and at the expected commit.
2. Read both audit documents in full.
3. Inspect each code location named in the table.
4. Reproduce each focused test and confirm every negative has an untouched positive control.
5. Add missing probes where the evidence above is indirect, especially J1 expression equivalence,
   J5 transitive effects, J6 end-to-end preflight, and F5 caller authentication.
6. Re-run the complete build, compiler suite, and SDK suite after any correction.
7. Update the two audit documents with a new reviewer/date/baseline and one of:
   - Decision 1: ready within the stated R1-R5/default-off scope;
   - Decision 2: sound but specific corrections remain before graduation;
   - Decision 3: implementation defect permits wrong accepted state.
8. Keep R5 default-off unless the separate graduation gates in
   `compiler-message-bus-v1.md` are independently satisfied. Audit completion alone does not imply
   default-on approval.

## Definition of done for the next reviewer

The audit is complete only when every J1-J6 and F1-F6 row has direct current-state evidence, all
newly discovered findings have a disposition, the full validation gates pass after the last change,
and the audit documents record a fresh independent final decision. A green test suite alone is not a
completion claim.
