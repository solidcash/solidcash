# Resumed-session follow-ups

Goal: complete the seven follow-ups identified from Claude session `7d9e436e`.
Starting point: `feat/per-call` at `64c351077`. Work branch: `feat/transcript-followups`.

## Constraints

- No BCHN tests for this goal (user instruction, 2026-10-14). Validate with focused local VM tests and actual
  consensus-limit assertions. Record live-node evidence as unavailable for new changes.
- D30 remains a decision not to implement batch-width binding. Model-B logical identity remains deferred.
- Keep the independently active `vmap-items` worktree intact; do not merge or alter its work without coordination.
- Use persistent build and focused test watchers. Run the final project-reference build before handoff.
- Keep consensus rules and security checks intact; a green relaxed-capacity test alone does not prove deployability.

## Work and acceptance evidence

| Item | Work | Evidence required | Status |
| --- | --- | --- | --- |
| 1 | Atomic-compose oracle and mixed-container cost gaps | Both original cases meet real per-input costs and byte limits; focused integrity regressions pass | Complete with local VM evidence, `4d575b330`; no new live-node evidence |
| 2 | Stream placement for differing sibling reads/writes, plain batch and non-compose callees | Honest transactions settle for each shape; mutated stream records are refused | Pending |
| 3 | SEM-1 exemptions and event-integrity hypotheses; older DS-1 and invoked-read reports | Hostile VM evidence supports a fix or a documented refutation for each finding | Pending |
| 4 | Oracle call-path coverage, keeper deployment and typed live configuration | Focused call-path/deployment tests and documented typed configuration | Pending |
| 5 | SDK observers across outlined equality checks | Computed chunks, values, returns and repairs agree for inline and outlined checks | Pending |
| 6 | Refresh marketplace artifacts and run its planned ladder checkpoint | Full normal compile with current compiler context, then recorded ladder outcomes | Pending |
| 7 | Reconcile decisions and audit status | D26 and older residuals match implementation and verified results | Pending |

## Current evidence and handoff

- Added real verifier-budget assertions to the two original atomic-compose cases. Baseline oracle verifier:
  7,959,892 / 7,234,400. Baseline mixed NFT verifiers: 11,114,485 and 15,884,364 / 7,234,400.
- Both assertions and the original hostile mutations now pass with the compiler work in progress:
  shared minting-output census (preserving the last exact V1 match), shallow physical-classification helpers,
  an authenticated empty-pad fast path, cheaper loop lowering, and earlier script-shape filtering for `tx.origin`.
  Protocol selection remains unchanged. The proposed ordinary-graph V2 selection was rejected because the
  codec reserves V2 for a changed output identity.
- Two new optimizer folds remove a duplicate and discarded old counter around `OP_1ADD` / `OP_1SUB`.
  The existing VM-equivalence tests for both rules pass (2 tests, 2026-10-14).
- Ordinary-VM checks across **all** inputs now pass for the oracle and mixed NFT/container cases. The initial
  callee input was 41,795 bytes (37,625-byte redeem script); a runtime unused-slot walk and omission of an
  impossible FT debit scan for a proven NFT-only effect frame brought it below the byte ceiling. The FT
  preservation checks remain, and a conservation-balanced attempt to debit FT through the NFT output is refused.
- Token-container aggregate scans skip unrelated locks in a small inner loop; mutable-output admission stops
  after finding an exact input lock/category match. Compiler-synthesized helpers receive ordinary peephole
  optimization with rewritten source/require maps. Their provenance is explicit AST metadata.
- Fixed physical reservation for multi-container kernel frames: the 510-slot shared transfer band was counted
  once per container, yielding 1,020 slots. Per-container effect capacity still applies, but physical layout now
  takes its transfer-site count from the shared frame.
- The SDK's existing discarded density reserve now accounts for sibling participants' physical slots, remains
  bounded by the complete input byte limit, and invalidates its cache when the transaction population changes.
  Change fees are measured with the candidate output present so the new reserve does not underpay relay fees.
- Focused validation: the two original cases pass with ordinary per-input VM/byte gates and their hostile
  mutations; the adjacent repeated-FT case passes; `tx.origin` candidate filtering passes (1 test);
  transaction-dependent change sizing and rollback pass (2 tests). No BCHN runs were made for these changes.
- Duplicate-master and mutated-neutral-pad checks pass. One-shot `yarn build`, changed-file lint and the
  source-tree guard passed (2026-10-14). Code and focused tests are committed as `4d575b330`.
- Temporary VM profiling changes were removed. Diagnostic snapshots in `/tmp/followups-program-*.json*`
  predate the final layout and reserve fixes and must not be cited as final measurements.
- Build watcher and the two-title Vitest watcher remain active; logs are
  `/tmp/codex-followups-build-watch.log` and `/tmp/codex-followups-cost-watch.log`.
- D26 status has been reconciled to the prior six-case, 64-frame completion evidence.

Next: continue items 2-7. Under item 3, investigate the
pre-existing graph-token bitmap layout: NFT counters begin at bit 8 while a kernel frame may reserve 255 site
bits. The old unrolled code and the new loop both read that layout; no exploit or fix is claimed yet. No BCHN runs.
