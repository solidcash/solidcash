# Compiler-hidden batch v1: implementation/covenant review handoff

Status: READY FOR INDEPENDENT REVIEW; DEFAULT ENABLEMENT NOT REQUESTED.

Review baseline: branch `codex/state-bus-research`. The final review commit and validation totals are
recorded in section 6.

This is a project implementation and BCH covenant review. It should determine whether the
experimental R4/R5 surface faithfully implements `compiler-hidden-batch-v1.md`; it is not a claim
that the deferred general message bus or participant graph is implemented.

## 1. Supported review target

The implemented target is deliberately narrow:

- R1-R3: compiler-owned state journals for supported local helper, loop, recursion, mapping,
  bytes/string, array, and sequential token-effect shapes;
- R4: one owner-local SCB1 batch with at most eight rows and a 223-byte canonical blob;
- R5: one straight-line caller invoking one compatible external owner repeatedly, with one physical
  callee owner input, exact whole-blob equality between caller and callee, and an exact two-row
  existing-entry parameter-authorized transfer resource route;
- protocol version 1 only; unknown or missing capabilities fail before construction.

TreasurySplit, Marketplace reward distribution, and MasterChef double mint cover scalar topology.
A separate VM fixture proves shared sender balance, shared nested allowance, distinct recipient
balances, and one token-owner settlement for two ordered
`transferFrom(from,to,spender,amount)` rows. It does not prove standard `msg.sender` authorization.

## 2. Explicit resource-route boundary

The accepted resource route is exact, not generic. It supports exactly two rows when both recipient
entries already exist and sender, first recipient, and second recipient resolve to distinct
physical entry UTXOs. Compiler and SDK tests require:

1. sender balance and nested allowance are global resources journaled across both rows;
2. the recipients are per-row resources with one authenticated predecessor and output each;
3. repeated-recipient and sender-equals-recipient aliases fail before construction; and
4. missing/cold recipient entries fail before construction.

Standard ERC-20 `transferFrom`, whose allowance is keyed by authenticated `msg.sender`, remains
batch-ineligible. Alias-collapsed and cold-insert routes require new capabilities and are not implied by this one.
The stripped route-cost fixture compiles to 4,814 bytes, leaving 5,186 bytes below the covenant limit.
The executable corpus token with mint, approve, and check helpers is 6,032 bytes, carries no
`contract-size-limit` diagnostic, and has 3,968 bytes of headroom. Default enablement remains outside
this handoff.

X125 re-pin, superseding the two figures this paragraph used to carry, and a reversal rather than a
refresh: the route was 9,775 bytes with 225 bytes of headroom, and the corpus token was 10,600 bytes,
over the limit, described here as "test evidence, not a deployable token artifact". That description
was withdrawn, not corrected: `RepeatedExternalBatchCorpus.test.ts:124-125` now asserts the diagnostic
is ABSENT and the artifact is under 10,000 bytes. Both figures moved when cross-function outlining
landed at `67342f24`. Authority: `compiler-hidden-batch-v1.md`'s Release 0 table, pinned by
`BatchCostRegression.test.ts:112-117`.

## 3. Rejected implementation spike and replacement

A per-row union-route spike was built and discarded. It attempted to preallocate shared entry slots
and one recipient entry slot per possible row. VM construction exposed that:

- shared sender/allowance keys require one physical predecessor and one journaled transition, so
  duplicate row slots cannot independently spend them; and
- inactive row/handler slots are not free placeholders: their entry covenant branches still impose
  locking-bytecode and preservation requirements.

No code from that spike is part of the review baseline. Its replacement is the measured
resource-shaped route above: one advertised exact physical layout, selected after concrete key
resolution, with no unrelated inactive resources.

## 4. Review checklist

Confirm from compiler output, SDK construction, and BCH 2026 VM execution:

- the selector is the first push and the blob is the positional second push under identical caller
  and callee extraction rules;
- the complete blob is compared byte-for-byte and parsed to exact exhaustion;
- row count is bounded before dispatch and omission, injection, reordering, selector substitution,
  argument substitution, and unchecked suffixes fail;
- caller identity comes only from the actual authenticated co-spent owner input;
- target locking bytecode, category, lineage, and exactly one physical settlement authority remain
  pinned by existing external-call machinery;
- journal reads observe prior row writes and every dirty resource flushes exactly once;
- global and per-row resource witnesses bind the keys actually decoded from both rows;
- physical entry aliases and cold predecessors are rejected before layout construction;
- iterative VM derivation authenticates every external entry output, not only the first mismatch;
- output, event, value, target, and duplicate-input substitutions fail in the VM;
- signature-consuming, route-sensitive introspection, forwarding, callbacks, multiple repeated
  owners, R4-plus-R5 composition, and over-limit blobs remain fail-closed;
- artifacts without an eligible route remain byte-identical and direct single-call behavior is
  unchanged;
- only exact version 1 capability matching is accepted, with no translation or inferred fallback;
- frozen scalar 2/3/8-row byte, operation, stack, unlocking, and transaction measurements reproduce
  under `BCH_2026_05`;
- the parameter-authorized transfer direct/batch size regression reproduces at 3,157/4,814 bytes
  (X125: superseding the 3,047/9,775 this checklist item used to ask a reviewer to confirm; a reviewer
  who reproduced the current figures against the old ones would have reported a false discrepancy).

## 5. Required review disposition

Report findings against one of three decisions:

1. R4 conforms, but the R5 caller/callee or resource-shaped route requires changes;
2. both R4 and the current narrow R5 conform, while R5 remains default-off pending an explicit
   project enablement decision; or
3. implementation/specification defects require changes before either experimental capability is
   considered stable.

The review must not silently broaden the accepted scope. Any request to support cold or
alias-collapsed or `msg.sender`-authorized token shapes, additional repeated owners, forwarding, callbacks, cycles, or a new
protocol version returns to design and measurement before implementation.

## 6. Validation baseline

Implementation baseline: `df3fab7e` (`fix(batch): resolve audit resource-boundary findings`), with
the audit/specification correction commits which follow it.

Validated on 2026-07-23:

- `yarn build`: all six non-example monorepo packages pass;
- `packages/solidc: yarn test`: 51 files, 2,299 tests pass;
- `packages/solidcash: yarn test`: 368 files, 3,256 tests pass, with the repository's existing
  24 skips and 9 todos;
- the SDK full run includes the mapping-backed ERC-20 corpus, R4/R5 hostile suites, and the two
  pre-existing cross-contract `msg.sender` C2 fixtures which guard direct-route compatibility.

The first SDK validation attempt exposed a direct-call regression: final SCB1 unlocker replacement
had also replaced an ordinary callee's already-complete `msg.sender` unlocker. `cbb360fc` scopes
that replacement, multi-key lookup, and iterative derivation to compiler routes; the focused
compatibility fixtures and the subsequent full suite pass.

Reviewers should reject a dirty worktree or artifact measurements which differ from the frozen
values in the specification.
