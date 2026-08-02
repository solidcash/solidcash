# Layer-3 binding spike implementation handoff

Date: 2026-07-24. This is an implementation handoff, not a completion claim.

## 1. Exact repository state

Two worktrees matter:

| Worktree | Branch | Purpose | Head |
|---|---|---|---|
| `.worktrees/state-bus` | `codex/state-bus-research` | accepted R0-R5 plus research/specification | `3ead8954` |
| `.worktrees/layer3-binding-spike` | `codex/layer3-binding-spike` | disposable Milestone-2 implementation | based on `3ead8954` |

Commit `3ead8954` completes only Milestones 0-1 from
`pre-message-bus-work-scope.md`: the measured baseline, real Kashi target, sequential oracle, and
observed-need go decision. Read `layer3-target-corpus.md` before changing the spike target.

The spike branch currently contains a narrow compiler seam and its compiler test. It does **not**
yet contain the BCH-2026 covenant E2E, participant-row codec, controller-prefix proof, or cost
measurement. Do not describe Milestone 2 as complete.

## 2. Verified commands and totals

On the accepted research branch:

- monorepo build: all six packages passed;
- compiler full run: 2,302 passed and two `HiddenBatch` cases hit the 5-second timeout;
- isolated `HiddenBatch` rerun with `--testTimeout=30000`: 9/9 passed;
- SDK full run: 3,261 passed, 24 skipped, 9 todo.

On the spike branch:

- `yarn` completed, including two successful all-six-package builds;
- `packages/solidc: yarn vitest run test/Layer3ParticipantBindingSpike.test.ts
  --testTimeout=30000`: 2/2 passed.

The focused test proves only the compiler isolation boundary described below. It does not prove
participant binding.

## 3. Current implementation

Changed files:

- `packages/utils/src/artifact.ts`
  - adds `__testLayer3BindingSpike?: boolean`;
  - the comment states that it is test-only and emits no layer-3 capability.
- `packages/solidc/src/compiler.ts`
  - the normal SCB1 eligibility analysis still rejects route-sensitive introspection;
  - only a public handler named exactly `__layer3_bind`, with both
    `hiddenBatch` and `__testLayer3BindingSpike`, bypasses that one rejection;
  - signature checks, forward calls, dynamic state, unresolved effects, lifecycle routes, and all
    other SCB1 eligibility gates still apply.
- `packages/solidc/test/Layer3ParticipantBindingSpike.test.ts`
  - production SCB1 compilation produces no hidden-batch capability for the introspective handler;
  - the spike flag admits the reserved handler;
  - `__scb1` stays out of source ABI and no artifact key containing `layer3` is emitted.

This seam exists so a test contract can execute transaction-introspection checks inside the already
positional SCB1 parser. It must not be generalized to arbitrary handler names or enabled by default.

## 4. Chosen covenant-fixture design

Use two clones of one generated stateful participant artifact, with distinct CashToken categories.
The clones share locking bytecode but remain distinct logical owners because owner identity is
`(lockingBytecode, category)`.

Both inputs execute the same one-row SCB1 blob:

```text
SCB1 row -> __layer3_bind(participant fields...)
```

The handler checks the fixed two-row participant projection against the actual transaction. The
outer SCB1 route already proves that its decoded `batchBlob` is the minimally encoded second push in
its own unlocking bytecode. The handler must additionally prove both participant inputs have the
same first two pushes, so both execute the same projection.

For the disposable controller brand, prefix the compiled redeem script in the test fixture with:

```text
08 4c3342314354524c 75
   "L3B1CTRL"       OP_DROP
```

Do this only to the test artifact bytecode after compilation. The harmless prefix executes before
the compiled dispatcher. The participant handler must locate the final redeem-script push in each
unlocking bytecode and verify that the redeem script starts with those exact ten bytes. Actual input
locking-bytecode equality then binds the entire branded redeem script.

Do not mistake a witness push containing `L3B1CTRL` for this check. The verified bytes must be inside
the final redeem script. Magic is a format check, never a locator.

## 5. Minimal participant-row shape for Milestone 2

Do not add the invocation/resource/effect/event tables yet. Encode exactly two direct-owner rows:

```text
magic                    bytes4 = "L3P1"
version                  u8 = 1
participantCount         u8 = 2

per row:
  participantId          u8, contiguous 0..1
  executionKind          u8 = direct-owner
  ownerInputIndex        u16le
  ownerInputCount        u16le
  ownerOutputIndex       u16le
  ownerOutputCount       u16le
  stateCategory          bytes32
  ownerLockingBytecode   compact bytes
  redeemScriptLength     u16le
```

The full candidate uses wider IDs in later tables; this reduced spike format is deliberately not a
wire-format freeze. Bounds and exact-consumption checks are still mandatory.

Canonical owner order is lexicographic over `(ownerLockingBytecode, stateCategory)`. SolidCash does
not currently support `<` on `bytes`; the first draft test exposed this. Do not weaken canonical
order to mere inequality in the final covenant. Either:

1. implement a bounded byte-lexicographic helper suitable for 35-byte P2SH32 locking bytecodes and
   32-byte categories, or
2. encode and compare a canonical numeric/order key whose collision-free mapping is proven for this
   exact fixed-width domain.

Hash order is not a substitute for owner-key order unless the spec is explicitly revised and
collision assumptions are accepted.

## 6. Required on-chain checks

Each of the two active participant inputs must independently prove:

1. header, version, count, row lengths, and exact blob consumption;
2. contiguous participant IDs and strict canonical owner order;
3. non-empty, non-overlapping input/output blocks;
4. owner input indices and output indices are in range;
5. actual input locking bytecode equals the row;
6. actual input base category equals `stateCategory` and capability is minting;
7. the canonical owner output preserves locking bytecode, category, minting capability, protected
   satoshis, and the expected commitment/state transition;
8. both participant inputs minimally select SCB1;
9. both participant inputs carry byte-identical encoded second pushes;
10. each final redeem script begins with the exact `L3B1CTRL` controller prefix;
11. the active input is the owner input named by exactly one row;
12. no second row names the same logical owner or creates a second settlement authority.

The SDK may help construct this, but none of these checks may rely solely on SDK validation.

## 7. E2E construction strategy

Create `packages/solidcash/test/e2e/Layer3ParticipantBindingSpike.test.ts`.

Recommended path:

1. compile the participant with:

   ```ts
   {
     forceStateful: true,
     hiddenBatch: true,
     __testLayer3BindingSpike: true,
   }
   ```

2. prepend the test-only controller prefix to a cloned artifact's bytecode;
3. instantiate two contracts from that same artifact, using two independently created categories;
4. construct one transaction containing both master inputs and both canonical owner outputs;
5. use `Contract.hiddenUnlock('__scb1', routeArgs)` or the lower-level unlocker returned by the
   existing hidden-batch builder for each participant input;
6. ensure the encoded SCB1 second push is byte-identical for both inputs;
7. evaluate every input with `createVirtualMachineBch2026()` and broadcast the untouched positive
   transaction through `MockNetworkProvider`.

`StatefulContract._buildHiddenBatch` currently builds one owner's transaction. It may be used to
obtain route arguments/unlockers, but the final test needs one combined `TransactionBuilder`. Avoid
merging two already-balanced transactions blindly: duplicate funders/change outputs would
over-determine failures and weaken hostile tests.

## 8. Mandatory hostile matrix

Every negative starts from a known-valid captured raw transaction, changes only the named property,
and evaluates/broadcasts while the original inputs remain unspent:

- fabricated participant row;
- owner locking-bytecode substitution;
- category substitution;
- minting-to-mutable/no-capability substitution;
- owner input-index substitution;
- owner output-index substitution;
- non-minimal first or second push;
- legacy/direct route instead of SCB1;
- controller-prefix removal/substitution inside redeem script;
- duplicate logical owner under another participant ID;
- overlapping participant input blocks;
- overlapping output blocks;
- two settlement authorities for one category;
- executor fields/non-direct execution kind in this direct-only spike;
- trailing bytes and truncation at every field boundary;
- untouched positive transaction.

An SDK throw is not a passing hostile case. Assert the intended VM/covenant failure and retain a
positive control using the same source UTXOs.

## 9. Known issues discovered during this pass

Two discarded approaches should not be repeated:

- `lockingBytecode0 < lockingBytecode1` does not compile: relational operators accept numeric types,
  not `bytes`.
- Referencing a contract constructor parameter from the synthesized SCB1 wrapper currently fails
  code generation (`Expected variable 'redeemLength' does not exist on the stack`). The hidden
  wrapper does not inherit that lexical stack binding. For the fixture, encode redeem length in the
  participant row and independently bind it by parsing the actual final push; do not trust the row
  length without checking the push boundary.

The current compiler test temporarily uses `lockingBytecode0 != lockingBytecode1` only to test the
flag boundary. It is not the final canonical-order implementation.

## 10. Completion sequence

The next model should proceed in this order:

1. commit the current narrow compiler seam and this handoff as the rollback point;
2. add a test-only participant codec with canonical byte fixtures and malformed-field unit tests;
3. implement the two-participant handler checks and make the honest BCH-2026 transaction pass;
4. add the hostile matrix one invariant at a time, committing each invariant with its tests;
5. add structured metrics for both participant inputs and total transaction bytes;
6. update `layer3-target-corpus.md` with measured Milestone-2 results;
7. independently review the spike before starting Milestone 3.

Do not start the general five-table parser, SDK graph derivation, cycles, callbacks, Kashi execution,
or production metadata until this binding spike passes. The full objective remains
`pre-message-bus-work-scope.md`; completing this handoff or Milestone 2 is not completion of that
objective.
