# October 2026 security audit: fixes on feat/parity

The audit report (`SECURITY-AUDIT-2026-10.md` and `docs/security-audit-2026-10/`) lives on feat/per-call, where a
separate worker implements its response. This file lists the rows fixed on feat/parity so the two lines can be
reconciled when they meet. None of these commits are on feat/per-call.

| Row | Severity | Fix | Commits | Tests |
|---|---|---|---|---|
| DS-7 | HIGH | a batch census counts a pure-read slot only at the collection's entry address | 6e292ca1f | e2e/BatchCensusReadSlots |
| DS-8 | HIGH | a batch proof input is never a pure-read slot's input (direct functions) | 228ea4a5e | e2e/BatchProofReadSlotOverlap |
| SEM-11 | HIGH | function ids from the entry, struct fields, abi.decode and external returns are pinned to public functions | 3df64a824 e37c4aa96 11b716f9f 707df2835 | FnPtrEntryIdValidation, e2e/StructFunctionValueCalls |
| SEM-1, SEM-6 | HIGH, LOW | path-sensitive final-require and locktime-guard checks | 66af16f81 | solidc AuditSem1FinalRequire |
| SEM-2, SEM-10 | MEDIUM, INFO | an embedded child fails closed on unexpanded modifiers; fallback and receive are inherited | 57de597dc | solidc AuditSem2EmbeddedChild |
| ARITH-3, -4, -6 | MEDIUM | `bytesN(bytes)` pads and truncates; decode length and enum range checks | 130d7fbdf | e2e/AuditArithDecodeLength |
| DX-4 | HIGH | a standalone callee refuses any own-category return carrier | 624daa86a | e2e/AuditDX4ReturnBinding |
| TOOLS-1 | HIGH | libauth pinned to the commit the lockfile resolves | cf8145ecd | - |
| KB-3 | HIGH | a bound route cannot skip its verifier with a negative index inside a composition | 7afe87c00 | journal-message-bus/e2e/AuditKB3VerifierSkip |
| DS-6 | HIGH | a conditional sorted delete can no longer switch off its batch: a lone delete settles by what ran and keeps an unrun node at its own input; a delete beside writes (either order, swap-remove included) gives each write a ran flag and keeps an unrun write's node; a framed frame has no guard; a message-bus route never had one | 34ffb8b25 06c633c6d 190d5d5b1 32cc7fbe9 71566d3c6 595d99489 9a4db66bb | e2e/AuditDS6ConditionalDelete, e2e/AuditDS6MultiTargetDelete, e2e/AuditDS6RouteConditionalDelete, framed/hostile/conditional-delete-node |
| CRYPTO-4 | HIGH | the blockhash keeper baton sits at a covenant that can only mint oracle records | cfef81dfa | e2e/AuditCrypto4KeeperAuthority |
| CRYPTO-5 | MEDIUM | a reported height stays below the time threshold; number and timestamp cannot be rewound | cfef81dfa e33869dd4 | e2e/AuditCrypto5OracleRewind |
| SDKFRAMED-1, -2 | HIGH | a framed deploy proves its own coins before signing; caller-side refusals precede the first genesis | 5e6d501a2 | framed/AuditSdkFramedDeploy |
| DX-8 | HIGH | a delegatecall, direct or message-bus routed, conserves the implementation's own records, in order; the SDK mints no stray event under the implementation's category | cb3c138b6 2f99d5edb 8841257b2 b063526ca | e2e/AuditDX8DelegateRecords, e2e/AuditDX8RoutedDelegateRecords, e2e/DelegateLegacyEventCategory |

SDKFRAMED-1 adds an optional `NetworkProvider.getLedgerOutput`; only `MockNetworkProvider` implements it, for
simulator coins that have no transaction behind them. Every other provider fails closed.

## Overlap with the per-call fixes

DS-7, DS-8, SEM-1, CRYPTO-4 and DX-8 also have a fix in the per-call worker's tree, designed differently:

- DS-8: the per-call guard also covers message-bus routes; the one here covers direct functions.
- CRYPTO-4: per-call gates data and entry writes on the authority input's lock size and unlocking length, which
  changes the data and entry covenant bytecode; here the keeper baton is confined by its own covenant and contract
  bytecode is unchanged.
- DX-8: per-call pins each implementation record at its own index; here the records are conserved in order.

## Residuals and findings

- SDKFRAMED-2: the `initialize` hop is still a third transaction (packages/solidc/docs/deferrals.md).
- DS-6, fails closed: in a sorted batch where a conditional delete sits beside a write, the write arm is refused while
  the deleted key is absent, the delete arm while the written key is absent, and a write arm covering part of a larger
  batch; the SDK must re-plan inputs after its first derive pass (deferrals.md).
- DS-6, framed: the delete's reads and close use the transaction's real commitments, not the frame's declared views,
  so an honest flow is refused when another frame writes the same node in the same transaction; in a framed
  multi-target batch an insert-shaped group still rests on the record census.
- DS-6, pre-existing: in `if (s) { m[j] = v; } else { delete m[k]; }` with the write arm taken and `j == k`, the
  swap-remove alias gate silently skips the write.
- Found while fixing DS-6, not fixed here (nearest row DS-1, owned by the per-call worker): a direct conditional
  sorted write with no delete in its batch, skipped on an absent key, still runs its planned insert, and the honest
  SDK leaves a duplicate predecessor. The skipped write never binds its slot witness, so a spender can choose that
  duplicate's `next` and make present keys read absent. A per-write ran flag, as DS-6 now gives writes beside a
  delete, closes it, at a byte cost in every function with a conditional sorted write.
- Failing on feat/parity and on feat/per-call alike, so not from this work: KernelLoopCompose "recursive event domain
  step and 64-frame resource bound" (already before f9a6ee114), KernelPhysicalCallerWithScidCompose, and
  KernelRealUnicrowProxyArbitration (its compile setup).
