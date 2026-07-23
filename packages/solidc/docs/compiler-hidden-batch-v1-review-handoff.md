# Compiler-hidden batch v1: implementation/covenant review handoff

Status: READY FOR INDEPENDENT REVIEW; DEFAULT ENABLEMENT NOT REQUESTED.

Review baseline: branch `codex/state-bus-research`, beginning with the validated R1-R5 snapshot
`5447911e` and including the mapping-backed ERC-20 graduation gates added afterward.

This is a project implementation and BCH covenant review. It should determine whether the
experimental R4/R5 surface faithfully implements `compiler-hidden-batch-v1.md`; it is not a claim
that the deferred general message bus or participant graph is implemented.

## 1. Supported review target

The implemented target is deliberately narrow:

- R1-R3: compiler-owned state journals for supported local helper, loop, recursion, mapping,
  bytes/string, array, and sequential token-effect shapes;
- R4: one owner-local SCB1 batch with at most eight rows and a 223-byte canonical blob;
- R5: one straight-line caller invoking one compatible external owner repeatedly, with one physical
  callee owner input and exact whole-blob equality between caller and callee;
- protocol version 1 only; unknown or missing capabilities fail before construction.

TreasurySplit, Marketplace reward distribution, and MasterChef double mint are scalar topology
fixtures. They prove repeated-callee grouping, not mapping-backed ERC-20 settlement.

## 2. Explicit non-target and default-on blocker

A real ERC-20 `transferFrom` which reads/writes sender balance, recipient balance, and nested
allowance is not supported by the present SCB1 physical route. Compiler and SDK tests require:

1. the callee advertises no hidden route for that resource shape;
2. enabling the compiler experiment adds no bytecode to the ineligible callee; and
3. a repeated external caller fails before transaction construction because no compatible SCB1
   capability exists.

Do not approve R5 for default enablement by extrapolating from the scalar corpus fixtures.
Mapping-backed multi-entry settlement remains a graduation requirement.

## 3. Rejected implementation spike

A per-row union-route spike was built and discarded. It attempted to preallocate shared entry slots
and one recipient entry slot per possible row. VM construction exposed that:

- shared sender/allowance keys require one physical predecessor and one journaled transition, so
  duplicate row slots cannot independently spend them; and
- inactive row/handler slots are not free placeholders: their entry covenant branches still impose
  locking-bytecode and preservation requirements.

No code from that spike is part of the review baseline. The proposed next direction is a separately
measured resource-shaped route: one advertised capability per exact physical layout, selected only
after concrete key resolution. It must not union unrelated inactive resources.

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
- output, event, value, target, and duplicate-input substitutions fail in the VM;
- signature-consuming, route-sensitive introspection, forwarding, callbacks, multiple repeated
  owners, R4-plus-R5 composition, and over-limit blobs remain fail-closed;
- artifacts without an eligible route remain byte-identical and direct single-call behavior is
  unchanged;
- only exact version 1 capability matching is accepted, with no translation or inferred fallback;
- frozen 2/3/8-row byte, operation, stack, unlocking, and transaction measurements reproduce under
  `BCH_2026_05`.

## 5. Required review disposition

Report findings against one of three decisions:

1. R4 implementation conforms, while R5 remains experimental pending ERC-20 resource-shaped routes;
2. both R4 and the current narrow R5 conform, but R5 still remains default-off because the stated
   graduation scope is incomplete; or
3. implementation/specification defects require changes before either experimental capability is
   considered stable.

The review must not silently broaden the accepted scope. Any request to support the rejected ERC-20
shape, additional repeated owners, forwarding, callbacks, cycles, or a new protocol version returns
to design and measurement before implementation.
