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
| G1 | Already settles on fixtures for uint nested returning args (inline and statement form); kept as regression via related peers |
| **G2** | **Landed this goal** — graph-emission address lanes use solidity ABI words (`addressToGraphEmissionBytes` + GTT `emitGraphEmissionAddressLane`); settle `KernelNestedReturningGraphArgCompose` (nested returning address into later graph call); fence peer: foreign-delegate residuals still `KERNEL_FOREIGN_DELEGATE` |
| G3–G4 | Listed follow-ons; not gating this goal |

## Evidence
- `{SCRATCH}/mb-mkt-general-settle.log`
- `{SCRATCH}/mb-mkt-general-fence.log`
- `{SCRATCH}/mb-mkt-general-noverfit.log`
- `{SCRATCH}/mb-mkt-address-unit.log`

## Non-goals
- Greening any marketplace title test.
- Widening inventory #15 foreign delegate or other permanent R1 fences.
- Title-shaped branches (`takeJob`, product contract names) in compiler/SDK.
