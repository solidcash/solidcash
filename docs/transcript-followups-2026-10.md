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
| 2 | Stream placement for differing sibling reads/writes, plain batch and non-compose callees | Honest transactions settle for each shape; mutated stream records are refused | Complete with focused local VM evidence; no new live-node evidence |
| 3 | SEM-1 exemptions and event-integrity hypotheses; older DS-1 and invoked-read reports | Hostile VM evidence supports a fix or a documented refutation for each finding | Complete with focused local VM evidence; explicit unsafe(0) policy unchanged |
| 4 | Oracle call-path coverage, keeper deployment and typed live configuration | Focused call-path/deployment tests and documented typed configuration | Complete with focused local evidence; no new live-node evidence |
| 5 | SDK observers across outlined equality checks | Computed chunks, values, returns and repairs agree for inline and outlined checks | Complete with focused local VM/unit evidence; no new live-node evidence |
| 6 | Refresh marketplace artifacts and run its planned ladder checkpoint | Full normal compile with current compiler context, then all three selected titles pass | Complete: offline mock checkpoint 3/3, 63 skipped; current artifacts and clean validation |
| 7 | Reconcile decisions and audit status | D26 and older residuals match implementation and verified results | Complete for scoped findings and recorded checkpoint outcome |

## Current evidence and handoff

Item 6 completed on 2026-10-14. The final complete normal compile produced 19 artifacts from 9 source jobs
(0 cache hits). The proxied lane and fixture freshness gate passed. With diagnostic variables unset, the unchanged
upstream checkpoint passed **3/3** (`post job 1`, `take job`, `approve result`), with 63 titles skipped, in 152.66
seconds. Individual title times were 7.333, 45.183 and 96.717 seconds. The project-reference build, changed-file
lint and source-tree guard pass. BCHN and full-suite runs remain excluded; this enlarged mock lane does not
establish ordinary-chain deployability.

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
- Final build and cost evidence is in `/tmp/codex-followups-final-build.log` and
  `/tmp/codex-followups-final-cost-watch.log`; focused watchers were stopped after validation.
- D26 status has been reconciled to the prior six-case, 64-frame completion evidence.
- Repeated plain external callees now use their published SCB1 handler metadata and reserve only materialized
  stream records in the compiler-owned trailing band. The SDK learns exact computed records from the selected
  callee verifier and funds growing chunk runs from the retained signer wallet. Every final input still passes
  the ordinary VM; records outside the published event schema or band are refused.
- The caller's exact SCB1 push comparison now supports canonical PUSHDATA2 for payloads from 256 through
  the existing 520-byte limit. Compact callee rows (7, 8) and differing chunked rows (3, 2 records) settle;
  changed commitments, NFT capabilities and swapped continuation records are refused (2 focused tests).
- Compact trace extraction is opt-in and returns only the single observed record; it does not infer an unseen
  prefix. The compact and existing whole-run trace tests pass (2 focused unit tests). Adjacent plain batch
  compact and chunk-count cases pass (2 focused tests). Build, changed-file lint and source-tree guard pass.
- Parallel agents completed security findings, oracle follow-ups and the four SDK equality observers. BCHN
  testing remained excluded for all workers.
- Oracle follow-ups pass six focused cases: three call paths (nested non-bus, all-staticcall compose and delegate
  forwarder), direct and framed keeper genesis, and typed live Electrum configuration. Every call-path input
  passes the ordinary VM; changed oracle records, pad values and mutable keeper outputs are refused. Build
  watcher and changed-file lint pass. Live-node execution remains excluded.
- Stream placement now uses the complete route read-only dynamic projection, conservatively treating unknown
  footprints as writable. Cached read-only journal values remain protected by the exact chunk preservation census.
  Sibling compose rows with different reads/writes and plain batch chunked events after preserved reads settle;
  changed stream records, reordered continuations and altered preserved chunks are refused. Direct entry output
  coordinates are reconstructed independently of input witnesses; the SDK keeps read-only inputs ahead of old
  written chunks. The same-artifact direct call passes every input and persists its state. Two focused regressions
  pass; adjacent W2 differing-width read/write and mixed array/mapping initialization cases each pass.
- Split/merge and unsafe tiers 1/2 refuse extra addressable event NFTs (four honest/refusal cases). The replay case
  mints a real event, mines 144 mock blocks, proves the matured covenant and genuine SCID preservation, and refuses
  publishing the old log beside an unrelated call. All five lifecycle/replay cases pass the final affected-file check.
- Final integration checks: one-shot project-reference build passed; both original cost/byte cases pass again with
  all-input ordinary-VM gates after the token counter change. No BCHN run or full suite was made.
- The historical SEM, DS, direct-state verification and msg.sender audit snapshots now point to current scoped
  evidence while preserving their original findings. The atomic cost and plain callee deferrals are reconciled.
- The four equality observers and their value-chunk pin predicate now reuse the bounded instruction-sequence
  recognizer across exact constant OP_INVOKE dispatch and call continuations. Dynamic or EVAL dispatch and
  introspections used only for SIZE remain excluded. Inline/outlined computed chunks, mapping values, events,
  repairs and lock reconstruction agree; dynamic cases pass the ordinary VM on all inputs and refuse tampering.
  Focused validation: 29/29 tests across the 12 new observer cases and the existing value-chunk ownership and
  hashed-return files. Changed-file lint passes; the project build watcher reports zero errors.

Item 3 now has focused local VM evidence:

- The graph-token bitmap overlap was reproduced: nine skipped-NFT-transfer batch rows admitted a downgrade of
  the preserved mutable NFT. Counter fields now begin above the complete site bitmap and take their widths from
  physical transfer capacity. `GraphTokenSitePackingSecurity` refuses the downgrade and accepts a genuine transfer.
- The direct singleton no-read conditional insert was reproduced and fixed. Source branch preservation and the
  existing compiler/SDK activity settlement leave an absent key absent, refuse a changed predecessor successor,
  and accept the taken insert (`AuditTranscriptStateIntegrity`).
- The same file verifies the exempt direct early-return path and two different mapping reads through a void
  `this.read()`. An incorrect second key is refused. The existing returned-getter stale-read fence still refuses
  the adjacent unsupported write/read/delete shape (`AuditDS6SameKeyAlias`, one focused title).
- The framed exempt-return regression accepts unchanged records and refuses changed mapping and data records
  (`framed/master/audit-exempt-return`). Lifecycle and old-log replay evidence is recorded above.

These are bounded local VM checks; no BCHN runs were made.

## Marketplace checkpoint history

Normal compile completed with 9 Solidity sources in 9 jobs, 0 cache hits, and 19 artifacts. The fixture freshness
gate passed against the current emitted compiler JavaScript and proxied lane stamp. The offline mock checkpoint
selected exactly `post job 1$|take job$|approve result$`: **3 failed, 63 skipped** (8.42 seconds).

All three stop in the shared `deployUnicrowSuite` setup at upstream `marketplace.test.ts:62`, before contract
execution: CREATE nonce 1 has no reserved genesis-eligible UTXO; only nonce 0 is reserved. The stack is
`CreateLookahead.getCreateAddress -> predictCreateAddress -> ethers-shim.getCreateAddress`. No marketplace
behavior or ordinary BCH deployability is established by this failing setup checkpoint; the configured mock
marketplace lane uses enlarged consensus limits. No upstream source was changed.

Logs: `/tmp/codex-followups-marketplace-compile.log` and `/tmp/codex-followups-marketplace-checkpoint.log`.
The user requested completion of item 6 after reviewing this checkpoint. Work continues to resolve the lookahead
genesis reservation and make these three titles pass. The earlier failed checkpoint remains recorded above as the
baseline. BCHN and full-suite runs remain excluded.

The CREATE reservation blocker is fixed by partitioning each mock HRE account's existing 128 prefunding coins
across four transactions. Four distinct vout-0 genesis coins are now available without changing the configured
balance or broadcasting during nonce reads; 124 other coins remain available for fees. SDK defaults and
live/regtest funding are unchanged. Two focused tests pass, including an actual framed deployment matching its
reserved category and predicted address.

The next setup blocker was a genuine proxy wire-format mismatch: an untagged singleton implementation could
not share its record with a generated proxy that added a second, tagged pointer record. The opt-in
`tagSingletonDataNfts` compiler option publishes the singleton's tagged encoding, reserves its header during
packing, and keeps compiler/SDK reads and writes consistent. Generated proxies inherit that choice. Layout
digests and upgrade checks distinguish the formats; existing untagged artifacts keep their format and mismatched
proxies remain refused. The root and benchmark fixture configs enable the option while retaining their existing
mock capacities. No upstream application source or test was edited.

Focused validation so far: generated proxy 10/10, tagged SDK plus adjacent reader checks 10/10, upgrade layout
6/6, tagged utility codec/digest checks 4/4, and singleton compiler checks 4/4 (self/external reads and writes,
child genesis, and packing boundaries). The transitive project build, changed-file lint and source-tree guard pass.

The refreshed fixture then passed both proxy deployments and their linking call, exposing a pre-existing token
constructor failure. A neutral two-string constructor with a mapping mint and event reproduced it with tagging
both disabled and enabled: the first string's output coordinate selected the next string's chunk. Framed dynamic
write reconstruction now uses the authenticated output record base and record width, excluding physical event
and callee slots. Both constructor cases pass, including exact string payloads, mapping value, event payload and
hostile chunk-lock rejection; scripts are 9,944/9,977 bytes. The adjacent proxied dynamic-append/event case passes
on every contract input. Declaration learning and its unknown-comparison refusal are unchanged; temporary probes
were removed. A normal complete fixture recompile is required again before the marketplace checkpoint.

The next focused run completed deployment and registration, then failed the first job's call-argument hash check.
An optional arbitrator-registration call had structural conditional metadata but no predicate: helper inlining
had stamped an artificial empty source-guard snapshot. The SDK therefore planned that skipped call before the
first executed tag lookup. Helper lowering now captures lexical and early-return fallthrough guards before
return normalization, renames their bindings and then prepends caller guards. Compiler guard controls pass 3/3;
the proxy skipped/taken integration plus adjacent direct-guard control pass 3/3 with every VM verdict accepted,
correct callee counts and persisted state. SDK planning and argument-hash enforcement remain unchanged.

The job transaction and event assertions then passed, but its `jobs(0)` readback queried a master-bound address
for the framed data record. `getDataNftAddress` now uses the existing convention-aware master binding, matching
the framed category-only covenant while preserving the direct convention's binding. The tagged dynamic proxy
getter and adjacent direct-convention control pass 2/2; the regression verifies a long struct-array element,
preserved scalar state and reconnecting the handle. Strict record decoding and owner layouts are unchanged.
The clean focused `post job 1` run now passes (11.31 seconds, 65 skipped); the three-title checkpoint follows.

That checkpoint passed `post job 1` but exposed a shared setup failure for the other two titles: the worker
whitelist appends a second event to the same newly created history value. The first append's 185-byte value was
learned, but the second frame received an empty old-value witness. Settlement dependencies now include existing
declared writes as well as shared spent nodes, so creation followed by a repeated write triggers replanning from
the learned value. The old-value hash check and value learner remain unchanged. The neutral proxied two-append
case, hostile empty-witness control and two adjacent repeated-write/read controls pass. Clean individual runs of
`take job` and `approve result` pass in 52.48 and 102.17 seconds. The final combined checkpoint passes 3/3, as
recorded above. Logs: `/tmp/codex-item6-marketplace-compile.log`, `/tmp/codex-item6-marketplace-checkpoint.log`,
`/tmp/codex-item6-final-build.log` and `/tmp/codex-item6-lint.log`.
