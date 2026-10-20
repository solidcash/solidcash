# Accidental edits on kernel-beta-candidate (do not treat as intentional Gate A work)

**Worktree:** `.worktrees/kernel-beta-candidate`  
**Branch:** `grok/message-bus-kernel-beta` @ `b0f67663b`  
**Cause:** implementer drifted from `kernel-comprehensive-fixtures` into this tree while chasing MDV1@223. Another agent owns beta; these uncommitted hunks may collide with their work.

## Files touched in this drift (uncommitted)

### Intended-to-port general MB kernel hunks (dyn-base / layout)
- `packages/solidc/src/compiler.ts`
  - Forward `__internal__dynamicChunkInputBase` by name in route→handler call args.
  - Compute `routeDynamicResources` union (route dynReads/Writes + eligible handler footprints).
  - Inject `__internal__dynamicChunkInputBase` for route clones **and** directly-dispatched sources that have `entryLoopWrites` or `chunkableArrayValue` entry accesses, when `routeDynamicResources.length > 0`.
  - Stamp `messageBusRouteDynamicResources` on clones + directly-dispatched sources.
  - `padMessageBusCloneCalls` after late ABI injection.
  - Filter `sortedBatchInfo` to keep complete multi-slot batches when dyn resources / multi-lane projections require it.
  - Publish `entryLoopWrites` / signatures / dynamicReads/Writes on handler ABI metadata.
  - Also present in the same diff (may predate or overlap other work): pooled chunkable early-return handling; kernel low-level return gate tweak; `sourceEffectOrder === linear` relaxation for pooled chunkable transport.
- `packages/solidc/src/generation/GenerateTargetTraversal.ts`
  - Broaden `emitAddForeignReadOnlyChunkCounts` routePreserved fallback when outlined bodies lose `messageBusRouteDynamicResources` (`messageBusEligible` / `entryLoopWrites` / route flags).
  - `emitLoopEntryWrite`: prefer `__internal__dynamicChunkInputBase` when on stack; handle `-1` sentinel by reconstructing; always add dyn-before-entries on reconstruct path; drop `usesDelegateTransactionSuffix` skip on the absolute-base path.
  - Sorted INSERT NEW index: prefer absolute dyn base **only** when an entry access has `chunkableArrayValue === true`; otherwise reconstruct; keep legacy `usesDelegateTransactionSuffix` skip on ordinary INSERT reconstruct (registerUser/initialize).

### Diffs saved for the other agent
- `/tmp/grok-goal-kext-layout/implementer/ACCIDENTAL_BETA_compiler.ts.diff`
- `/tmp/grok-goal-kext-layout/implementer/ACCIDENTAL_BETA_GenerateTargetTraversal.ts.diff`

## Diagnosis that motivated the hunks (MDV1 take-job @223)
- After FakeToken@225 cleared and valueChunkOutputBase rebase, MDV1 failed at input 223.
- Stack `outIdx=163` (pad); real jobEvents entry at output **161**; `dynamicChunkInputBase=159`; dyn chunks at 159–160.
- `163 = 123 + 40` (cospend entry input + route `trailingBase`) — outlined `publishJobEvent` reconstructed owner+trailingBase from the wrong stack item because it lacked `__internal__dynamicChunkInputBase` (only route clones got it).
- Failing outlined helper matched `DUP OUTPUTTOKENCOMMITMENT OP_2 PICK EQUALVERIFY` (invokeDebug ≈ `-430`, sourceMap `jobEvents[jobId_].push`).

## What NOT to assume
- Marketplace/eacc take-job was **not** greened by these edits.
- Later compose attempts on beta also showed regressions (registerUser `-1` index; MarketplaceV1@117 with `dynamicChunkInputBase=-1`) when injection was too broad — final narrowed predicates above are the intended shape.
- Other modified files on beta (`compose.ts`, `preflight.ts`, `layout-resolver.ts`, tests, etc.) may be mix of earlier Gate A work and this session; treat the two solidc diffs above as the accidental dyn-base focus.

## Recovery for beta owner
- Review/apply or discard the two solidc diffs as you prefer.
- Implementer will **not** edit beta further; reapplication happens on `kernel-comprehensive-fixtures`.
