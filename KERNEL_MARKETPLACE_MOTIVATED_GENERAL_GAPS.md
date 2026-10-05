# Marketplace-motivated → kernel-general message-bus gaps

**Worktree:** `.worktrees/kernel-comprehensive-fixtures`
**Motivation:** Gate A title failures on the beta worktree (nested graph emissions, address-typed args, layout witness apply).
**Rule:** Extension definitions use only type / effect / flow / layout properties. Product names appear only as motivation footnotes, never as done-means or special cases.

## Gaps (property language)

| ID | Gap (kernel-general) | Forced by title class (footnote) | Closable now? |
|----|----------------------|----------------------------------|---------------|
| **G1** | **Nested returning graph arg before consumer row.** A returning external call whose result is an argument of a later graph emission must authenticate and consume its emission row before the consumer builds/compares its own row against `__internal__graphEmissions`. Stream head at consumer construction must be the consumer’s row (or an explicit selector-matched scan), not an earlier unconsumed sibling. | Nested `view`/`pure` fee/read call inside a later external call’s argument list | **Yes** — prove with Owner/Helper/Callee compose settle |
| **G2** | **Address-typed graph-arg representation reconciliation.** For `address` (and nested address fields encoded as pushdata) under solidity-compat, local evaluation and authenticated emission-row bytes may differ in encoding (full locking bytecode vs 20-byte identity) while projecting to the same identity. Construction must prove projection equality and prefer authenticated row bytes. | Address args / struct fields on graph-emitted calls | Prefer after G1; may need peel-by-param vs flat pushdata care |
| **G3** | **Callee target = authenticated participant identity.** Graph emission target locking bytecode must be an authenticated physical or logical identity of the planned callee participant; planning must not stamp a different participant’s lock onto a selector owned by another artifact. | Wrong target lock beside correct selector in emission vector | Likely planner/worklist; separate wedge |
| **G4** | **Route-frame layout witness apply.** Absolute dyn/PredOut (and related) layout witnesses must apply to the route ABI unlocker parameters, not only a thin proxy/forward shell that omits those slots. | Layout apply hitting `__forward`(2) while route is `__message_bus1` | Layout/unlocker publish path; separate wedge |

## Implementation status

| ID | Status |
|----|--------|
| G1 | Prior peer / dedicated uint fixture exists (`KernelNestedReturningUintGraphArgCompose`); not counted as this goal’s new settle |
| **G2** | **Landed prior tip; re-proved iter 1** — selective ABI address value-lanes + native call-target params; `KernelNestedReturningGraphArgCompose` (+ poke peer) |
| **G2b** | **Landed this goal (iter 2)** — address fields inside structs on message-bus / graph-emission args project to ABI words (`encodeMessageBatch` + GTT `emitPushdataEncode` under `graphEmissionHandler`); settle `KernelNestedReturningStructAddressCompose` |
| **G3** | **Deferred post-beta (iter 3)** — `planCompiledGraph` refuses foreign `targetLockingBytecode` (`G3ForeignTargetRefusal`); live compose wrong-lock wedge still open; see `{SCRATCH}/mb-mkt-iter-3.log` |
| **G4** | **Deferred post-beta (iter 4)** — route publishes dyn/PredOut witnesses that `__forward` omits; see `{SCRATCH}/mb-mkt-iter-4.log` |
| **G2c** | **Settled in a later follow-up** — nested returning address into a struct field now composes and passes the BCH-2026 VM. Lowered struct arguments had exposed the same external-call AST node twice; call-slot collection and assignment now count that source node once, while distinct source calls retain separate slots. The focused `KernelNestedReturningStructAddressCompose` and compiler `ExternalCalls` titles cover both properties. |

## Five-iteration log
| Iter | Candidate | Outcome |
|------|-----------|---------|
| 1 | G2 re-prove | settle (already-landed) |
| 2 | G2b struct address fields | **settle (new src + fixture)** |
| 3 | G3 target=participant | deferred (candidate refusal captured) |
| 4 | G4 route-frame witnesses | deferred (structural gap captured) |
| 5 | G2c return-into-struct-field | deferred |

## Evidence
- `{SCRATCH}/mb-mkt-iter-{1..5}.log`
- `{SCRATCH}/mb-mkt-general-settle.log`
- `{SCRATCH}/mb-mkt-general-fence.log`
- `{SCRATCH}/mb-mkt-general-noverfit.log`
- `{SCRATCH}/mb-mkt-address-unit.log`

## Non-goals
- Greening any marketplace title test.
- Widening inventory #15 foreign delegate or other permanent R1 fences.
- Title-shaped branches (`takeJob`, product contract names) in compiler/SDK.
