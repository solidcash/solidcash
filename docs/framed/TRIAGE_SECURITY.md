# Security triage (section 3 item 2)

> **Snapshot, 2026-10-05.** Current finding status and fixes are in
> [`../security/security-audit-2026-10-16.md`](../security/security-audit-2026-10-16.md). The F1/F10 descriptions
> below remain the direct-convention explanation; read the audit for whether each finding is fixed or deferred.

Surveyed 2026-10-05 on `feat/framed` at `57dfa942e`. Each finding is fixed or named as a known limitation. No code change is in this triage.

## msg.sender (`docs/framed/AUDIT_MSG_SENDER.md`, 2026-09-25, measured at `ea7a48e27`)

| id | status | where it stands |
|---|---|---|
| F1 contract caller identified by presence | known limitation on the direct convention; specified for framed | The audit's direct path treats a co-spent master as the caller. Per-call frames carry `sender` and the validator checks the edge (`V5` in `SPEC_FRAMED_TRANSACTION.md`). The direct / kernel path is unchanged. |
| F2 signature hash type not checked | partially fixed: unfenced on the direct convention's ordinary
entries and its `msg.sender` path | See the F2 note below the table. |
| F9 forgeable logical-address anchors | known limitation until model B | Model B (an address is the full locking script) is deferred. `DECISIONS.md` still records it as not scheduled. This release does not adopt identity20 mapping keys for framed. |
| F10 message-bus builder chooses the caller | known limitation of the direct convention | The graph path's caller identity is the builder's. Per-call does not read `artifact.messageBus` for its frames. |
| F11 proxy initialization front-run | known limitation | The audit leaves proxy initialization as a second, permissionless transaction (open point 5). Not closed in this triage. |
| S2 one signature can authorize many calls | known limitation | Recorded residual. No framed receipts in this release. |


### F2, corrected 2026-10-07

A sighash-ALL fence exists in exactly three places:

- the direct **upgrade** authorization: `GenerateTargetTraversal.ts:14100-14104` for `checkSig` and
  `14154-14223` for `checkMultiSig`, gated by `fencesUpgradeSignatures()` seeded from upgrade entry points at
  `10930-10952`;
- the message-bus route: `compiler.ts:9836-9837`, emitted at `13542-13549`, and only for handlers that reach a
  `checkSig`;
- the framed master root caller: `master-head.ts:1128-1150`.

A direct convention's ordinary entry, and the `msg.sender` / `tx.origin` shape this finding is about, carry no
fence: the emitted script's first op for a plain `checkSig` entry is `OP_CHECKSIGVERIFY`, which accepts any valid
hash type. The fence commit is `85636dfde` (as `DECISIONS.md:24` records), not `e40c15ed2`, which relaxed the
data-NFT census instead; the row above also conflated the route fence with the direct-upgrade fence. The direct
path needs the fence, or the warning now in the README stands, before a release presents `msg.sender` as
authorization.

## State-bus transcript (`SECURITY-AUDIT.md`, 2026-07, on the line that became `solidcash_v0.13.1`)

The file's own remediation status, which this triage adopts:

| id | status |
|---|---|
| C1 delegatecall proxy state rewrite | fixed (`44bead84` and the follow-ups named in the audit). Residual, known limitation: a P2PKH placeholder implementation cannot be pinned. |
| C2 mapping omission | fixed by the authenticated sorted-list backend (2026-07-22). Residual, known limitation: the fail-closed gaps in `docs/verified-mappings.md` section 10.1 (loop-variable values, multi-collection runtime loops, duplicate-key array-mutation loops, consecutive same-entry scalar coalescing). |
| C3 un-accessed NFT destruction | fixed (`ea67656f`). Residual, known limitation: a balanced output can still corrupt a flag=1 commitment. The audit names that residual. |
| C4 mapping-key collapse | fixed (`e5c5d0d0`). |
| H1 through H8 | fixed, commits named in `SECURITY-AUDIT.md`. H2 residual, known limitation: multi-same-category external calls. |
| MD1 through MD4 | fixed, commits named in `SECURITY-AUDIT.md`. |

The historical exploit text in that file describes the code before those commits. The remediation section is the status.

## `revertedWith` on the merged harness

`packages/testing/src/chai.ts` `revertExpectation` (read at this commit) is not the lenient matcher the kernel 66/66 run used.

- A framed call compares the contract's own frame reason to the expected reason, and `.withArgs` compares the frame's error arguments. A failure that never reached a contract reason does not pass.
- A direct-convention call on a relaxed network (maximum input bytes above 10,000) must name the expected reason in the runtime error. A construction failure is rethrown, not treated as the expected revert.
- Any other call uses the Vitest matcher.

Title runs that claim a revert on this tree are held to that behaviour. A kernel-lane run on the kernel worktree must say whether that worktree's matcher is this one or the older lenient one. The numbers in `PERF_KERNEL_VS_FRAMED.md` state which matcher each lane ran under.
