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
  existing-entry ERC-20 `transferFrom` resource route;
- protocol version 1 only; unknown or missing capabilities fail before construction.

TreasurySplit, Marketplace reward distribution, and MasterChef double mint cover scalar topology.
A separate VM fixture proves shared sender balance, shared nested allowance, distinct recipient
balances, and one token-owner settlement for two ordered mapping-backed `transferFrom` rows.

## 2. Explicit resource-route boundary

The accepted ERC-20 route is exact, not generic. It supports exactly two rows when both recipient
entries already exist and sender, first recipient, and second recipient resolve to distinct
physical entry UTXOs. Compiler and SDK tests require:

1. sender balance and nested allowance are global resources journaled across both rows;
2. the recipients are per-row resources with one authenticated predecessor and output each;
3. repeated-recipient and sender-equals-recipient aliases fail before construction; and
4. missing/cold recipient entries fail before construction.

Alias-collapsed and cold-insert routes require new capabilities and are not implied by this one.
The fixture compiles to 9,775 bytes, leaving only 225 bytes below the covenant limit. Default
enablement remains outside this handoff: the independent review must first accept this narrow
surface and its size margin.

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
- the ERC-20 direct/batch size regression reproduces at 3,047/9,775 bytes.

## 5. Required review disposition

Report findings against one of three decisions:

1. R4 conforms, but the R5 caller/callee or resource-shaped route requires changes;
2. both R4 and the current narrow R5 conform, while R5 remains default-off pending an explicit
   project enablement decision; or
3. implementation/specification defects require changes before either experimental capability is
   considered stable.

The review must not silently broaden the accepted scope. Any request to support cold or
alias-collapsed ERC-20 shapes, additional repeated owners, forwarding, callbacks, cycles, or a new
protocol version returns to design and measurement before implementation.

## 6. Validation baseline

To be filled only after the final clean compiler and SDK runs. The review target is the commit which
adds the completed totals here; reviewers should reject a dirty worktree or a different artifact
measurement baseline.
