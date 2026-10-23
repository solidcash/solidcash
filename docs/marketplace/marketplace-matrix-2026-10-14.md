# Marketplace matrix, 2026-10-14

The user requested all marketplace tests in `[proxy, noproxy] × [kernel, framed]`, then recording all baseline
results before fixing all regressions. The four baseline attempts are terminal and fully recorded before regression fixes. No fixes were applied during this
baseline. Existing no-BCHN and canonical-source protections remain in effect; this request explicitly authorizes
the full marketplace runs.

All cells start from `371cb72b1f846bb7379214fe9be36c0c24c6039b` plus the completed six-follow-up changes.
The frozen tracked patch SHA-256 is `5b6c3680c290ef063509c2290190f1663324aacc8b166dbf157c867c83c60630`.
The full source snapshot manifest, process metadata, compile logs, test logs and native Vitest JSON reports are
under `/tmp/marketplace-matrix-20261014/`. [Durable full baseline results](marketplace-matrix-2026-10-14-baseline.json) include every native Vitest result, compile/test logs, snapshot and artifact manifests, and the explicit compiler interruption record.
Three detached worktrees preserve the same source and emitted build; proxy×framed runs in the original
`transcript-followups` worktree with its already-fresh complete artifacts. Local workspace packages resolve to
each cell, and each cell has independent artifacts/configuration/Vite caches. Third-party dependencies are shared
read-only. No workspace build runs while baseline tests are active.

| Cell | Compile | Full suite | Worktree |
| --- | --- | --- | --- |
| proxy × kernel | Passed: 9 jobs / 19 artifacts / 0 cache hits; 82.40s | **15 passed, 51 failed**; 143.46s | `.worktrees/marketplace-matrix-proxy-kernel` |
| proxy × framed | Existing fresh 19 artifacts, freshness gate passed | **63 passed, 3 failed**; 1971.76s | `.worktrees/transcript-followups` |
| noproxy × kernel | Passed: 22 jobs / 26 artifacts / 0 cache hits; 133.62s | Setup failed; **0 executed, 65 skipped**; 9.68s | `.worktrees/marketplace-matrix-noproxy-kernel` |
| noproxy × framed | **Explicitly interrupted** after >33 minutes in diagnosed repeated provenance traversal | Not started; complete rerun required | `.worktrees/marketplace-matrix-noproxy-framed` |

Kernel means `composition: 'direct'`, `messageBus: true`, `messageBusKernel: true`, and
`messageBusGraphContext: true`. Framed means `composition: 'framed'`, with the same compiler flags.
Every cell retains `tagSingletonDataNfts: true` and the source worktree's enlarged mock consensus capacities:
1,000,000 operation-cost units per byte, 10 MB input/stack-item/commitment allowances and 100 MB transaction
allowance. Each Vitest worker has a 6,144 MB heap ceiling. These are semantic mock results, not stock deployment
claims; the [offline inventory](marketplace-stock-inventory-2026-10.md) documents the stock limits separately.

Before each process, inherited `SOLIDC*` variables, `TESTS_USE_REGTEST`, `FRAMED_HOP_TRACE`, and
`MARKETPLACE_FIXTURE_STALE_OK` are removed. The lane and artifact freshness checks remain active. Tests use the
unchanged canonical proxy or no-proxy source/test twin, offline network fixtures, the existing per-test timeout,
and no title filter or bail option. Parallel timings reflect host contention and are not benchmark claims.

Full suite command from each cell, after the lane check and normal complete compile when needed:

```sh
SOLIDCASH_MARKETPLACE_WORKER_HEAP_MB=6144 yarn vitest run \
  --config vitest.marketplace.config.ts --reporter=verbose --reporter=json \
  --outputFile.json=/tmp/marketplace-matrix-20261014/<cell>-results.json
```

The no-proxy/framed compile was explicitly terminated after profiling a live CPU-bound process. This was an
operator interruption for diagnosis, not a natural compiler error or completed test run. The profile attributed
47.5% of samples to `findTupleInit` and 32.4% to `countPushes`; both repeatedly traversed resolved AST references.
The complete cell must run after the compiler correction.

Baseline regression groups: proxy/kernel has 46 missing authenticated timestamp recipe evaluations, three
getter/list VM failures, and two preflight errors ahead of expected source errors. No-proxy/kernel fails in
the generic Mocha hook adapter before executing its 65 cases. Proxy/framed has one native CashAddress passed
to a Solidity bytes argument and two allocated-local-array mapping-key provenance refusals.

## Current validation status

> **At `7e5c0f897` (2026-10-23), mocknet:** all four cells pass, 262/262, with 0 failed and 0 skipped, each from its
> own cold compile. This is the first matrix run after D49 (`809de50f8`, a data NFT of its own for each `bigint` and
> each unbounded state field). It exposed one regression the ahead-gated tests do not cover: a framed callee whose
> entry writes two data NFT records had its second record settled with the pre-call commitment, which the callee's
> own route refused with `OP_VERIFY`. `7e5c0f897` makes the caller's derivation re-probe until every required record
> is learned and pins it with `FramedExternalCallMultiRecordState.test.ts`; every cell in the table ran after it. The
> runs came from the isolated worktree `/Code/cashscript/.worktrees/release-readiness`, branch
> `release-readiness/2026-10-22`, based on master `809de50f8`.

| Cell | Passed | Failed | Skipped | Wall time | Cold compile |
| --- | ---: | ---: | ---: | ---: | --- |
| proxy × framed | 66 | 0 | 0 | 1924s | 9 sources to 19 artifacts |
| proxy × kernel | 66 | 0 | 0 | 3479s | 9 sources to 19 artifacts |
| noproxy × framed | 65 | 0 | 0 | 1814s | 22 sources to 26 artifacts |
| noproxy × kernel | 65 | 0 | 0 | 2646s | 22 sources to 26 artifacts |

Each cell ran the suite below after `node scripts/marketplace-lane.mjs <lane>`, the `composition` line set to
`framed` or `direct`, and `rm -rf .marketplace/cache node_modules/.experimental-vitest-cache` followed by
`node packages/solidhat/dist/cli.js compile`, with no title filter and no bail option. The first no-proxy × kernel
attempt reached 60 of 65 titles with no failing test and then lost its Vitest worker to `SIGKILL` while another
session ran a marketplace compile on the same host; the cell was re-run from a fresh cold compile once the host was
idle, and the table records that run. Every cell also reports a native Vitest JSON result whose `numFailedTests`,
`numPendingTests` and `numTodoTests` are 0.

> **At `14bfff57a` (2026-10-19), mocknet:** all four cells pass again, 262/262 (proxy x kernel 66, proxy x framed 66,
> no-proxy x kernel 65, no-proxy x framed 65). At `11b8f7feb` proxy x kernel arbitrate failed at input 1462 and
> no-proxy x kernel failed 20 titles; the four causes and fixes are in `../release/0.13.1/RELEASE_DECISION_0.13.1.md`, "What closed the
> marketplace matrix failures". The 262/262 result below belongs to the pre-merge snapshot it names.

All four complete, unfiltered marketplace suites pass on the same final repaired source: **262 passed,
0 failed, 0 skipped**. Every cell exits 0 with no source/build/artifact/config/test drift or unhandled errors.

| Cell | Passed | Failed | Skipped | Wall time |
| --- | ---: | ---: | ---: | ---: |
| proxy × kernel | 66 | 0 | 0 | 3125.19s |
| proxy × framed | 66 | 0 | 0 | 1913.00s |
| noproxy × kernel | 65 | 0 | 0 | 2595.31s |
| noproxy × framed | 65 | 0 | 0 | 1975.80s |

The final common snapshot contains 789 production TypeScript files, aggregate SHA-256
`37548017ea8c29799496c50ed56982df7124a81fdf6924b3de6eb9a0567dded8`, 787 emitted JavaScript files
(`879f1c359b314e9714a2a8c5e93fc8341a66df168e27a8e1add5bf4372a9b768`), and 2,124 TypeScript files under package test trees
(`b24847822966817921ec41e9e644bf7431dd16d3fe2d1267ed7a0ce47bc8c6f0`). All four cells match this source;
production, emitted build and tests remain frozen during the full gates. The retained runtime controls pass
11/11 and oracle unit controls 7/7. Mandatory one-shot build, seven-file final lint, source-tree/whitespace
guards and normal complete compile pass. The last SDK-only oracle followup leaves compiler artifacts unchanged.
Full raw controls, patches, build/lint logs and freeze manifests are embedded in the durable repair JSON.

Historical completed green snapshots include proxy/framed 66/66 (1940.03s), no-proxy/kernel 65/65
(2628.80s), no-proxy/framed 65/65 (2037.27s), and proxy/kernel 66/66 (3163.03s); each predates some later
repairs and remains identified by its own frozen inputs. The subsequent known-failing proxy/kernel attempt
was explicitly interrupted after 58 passes, one whitelist failure and seven uncompleted titles, once its
reviewed repair passed the exact canonical title. Those outcomes are preserved and do not substitute for
the four final gates.


## Chronological repair history

The following entries record the status at each repair iteration. Later entries supersede earlier ongoing or
outstanding statuses; the current table above is authoritative. Failed and interrupted attempts remain preserved.

- Native CashAddress-to-Solidity-bytes conversion now happens at both direct and framed call boundaries,
  with strict checksum and byte-width validation preserved. Three SDK regressions pass; the unchanged
  proxy/framed `pay start job > sanity checks` target now passes (57.59s, 65 unrelated titles skipped).
- The generic Mocha adapter declares no parameters while retaining callback arguments, shared context and
  asynchronous completion. Two regression cases and two adjacent adapter checks pass. The full no-proxy/kernel
  rerun now executes contract cases; further preflight failures are under investigation.

The complete post-adapter no-proxy/kernel run executed all 65 cases: **17 passed, 48 failed**, 343.18s.
The newly exposed failures are 38 token-preservation/layout errors, five preflight failures in the data
participant, and five negative cases failing before their intended source errors. Full native results and logs
are preserved in [repair iteration results](marketplace-matrix-2026-10-14-fix-results.json).

Authenticated timestamp and proxy return-slot regressions now pass in neutral runtime tests. The unchanged
proxy/kernel `update user` and `post job 1` targets pass individually (19.42s and 31.60s). Native-address bytes
checks pass three cases; exact-bound-oracle source attribution passes eleven diagnostics, and the invalid-token
case passes in both kernel lanes. No-proxy/kernel invalid-delivery also passes (22.96s).

The compiler alias fix passed five focused cases and now publishes the initialized key expression; the first
refund rerun before that metadata correction exposed the unresolved runtime descriptor, recorded in the repair
iteration log. No-proxy/framed's fourth exploratory compile eliminated the original traversal spin but naturally
aborted at the default Node heap limit after 95.08s. This is recorded as a failed repair attempt; the complete
no-proxy/framed cell remains outstanding.

The complete no-proxy/framed compile now passes with the default Node heap: **22 sources, 22 jobs, 26 artifacts,
zero cache hits, 85.22s**. The original traversal stall, repeated recipe analysis and metadata DAG expansion
were corrected generically. Its first executable full suite is recorded: **0 passed, 65 failed, 0 skipped**,
92.31s; every case hits the same shared fixture setter record covenant failure. This new regression remains
under focused investigation.

Proxy/framed refund sanity now passes (130.67s) after initialized-array provenance is also published in SDK
key descriptors. A further kernel delegate-frame regression demonstrated that normalization was validated but
its returned arguments were discarded. The retained-frame fix passes its neutral runtime test and lint.

A complete proxy/kernel repair gate ran all 66 cases on its frozen v5 snapshot: **28 passed, 38 failed,
0 skipped**, 1311.44s; source hashes remained unchanged during the run. The earlier timestamp, getter and
negative-source-error cases pass. The newly exposed failures are 37 instances of a misleading MECE-tag source
error caused by an earlier data-producer event/chunk output collision, plus one valid take-job signature
rejection in the no-arbitrator dispute fixture. Both groups remain under focused investigation.

The no-proxy/framed record failure is now reduced to missing PUSHDATA4 support in the generic minting-authority
reader. Six VM boundary/security regressions pass, covering 65,535/65,536/65,537-byte redeems, a header crossing
the bounded scan head, malformed lengths and a misleading long argument before a short redeem. Normal complete
compilation is required after this covenant change before running fixture validation.

The PUSHDATA4 authority fix removes the shared no-proxy/framed fixture failure. Fresh complete compile and
two unchanged admin targets pass; its next complete frozen gate records **17 passed, 48 failed, 0 skipped**,
31.41s Vitest / 33.42s wall, with no source drift. All remaining cases reach the direct framed call path's explicit
refusal to co-spend an authenticated block oracle for a callee. That generic side-car support is now being
implemented and will be checked through every transaction input before a new full gate.


The direct framed oracle repair now passes two neutral VM cases (callee-only clock and root/callee sharing
one oracle), including exact stored timestamp readback and rejection of a replacement oracle at a foreign lock.
The unchanged no-proxy/framed `post job 1` target passes (12.20s); its next complete frozen gate is running.
Newly exposed `closeJob` VM failures will be diagnosed after that gate is recorded.

Additional focused repair coverage now includes authenticated pure-read mapping census (present and absent
proofs, unchanged existing record, and rejected tampering), selected read-only dynamic chunks preserved ahead
of event outputs, and native-address arguments retained after validation in proxy delegate frames. The shared
kernel proxy runtime regression file passes all three cases together (11.07s). No token-free deletion guard,
VM covenant, expected source require, lane check or freshness check was relaxed.


The remaining kernel producer investigation has separated three generic geometry issues: inactive dynamic
writers must use the selected read-only mode; restoration of chunk twins must preserve the relative order of
runtime event occurrences; and a newly materialized sorted mapping entry occupies a coordinate before those events.
The initial continuation-chunk hypothesis was corrected after decoding its complete 128-byte node format. Candidate fixes are being checked against the unchanged marketplace producer as well as
neutral cases. An active dynamic-writer control also refuses the exact pre-candidate baseline, so it is recorded
as an existing unsupported geometry rather than treated as passing or used to weaken the resource guard.


The complete proxy/framed v7 gate is **GREEN: 66 passed, 0 failed, 0 skipped**, exit 0, 1836.12s wall.
Its source/dist/config/test hashes have no drift. Native Vitest JSON, complete test log, source manifest and
artifact manifest are stored in the durable repair results. This snapshot includes native-address normalization,
retained delegate frames, compiler provenance/array fixes and PUSHDATA4 authority support. Later queued changes
are kernel composition and direct framed-call planning; their own checks and snapshots remain explicit.


After merging the kernel repair and direct callee-oracle support, the main worktree's normal complete compile
passes again (9 cold jobs, 19 artifacts). Every one of the 19 prior green proxy/framed artifacts was recovered
from cache by its exact recorded SHA-256 and compared with the refreshed output: **only `updatedAt` differs**.
Bytecode, ABI and all other metadata remain identical. This establishes that the kernel codegen correction
does not change the framed programs used in the 66/66 green gate.


The complete no-proxy/framed v8 gate after callee-oracle support records **53 passed, 12 failed, 0 skipped**,
exit 1, 2067.83s wall, with no source drift. Integration, arbitration and refund sanity pass. Eleven failures
stop at generated guards in `closeJob`; one stops in the conditional amount-update path. Direct planning did
not overlay the authenticated oracle clock into activation and write recipes. That correction is being
validated next; the failed gate's full native results and log remain preserved.


The complete no-proxy/kernel repair gate after selected-effect geometry records **35 passed, 30 failed,
0 skipped**, exit 1, 1339.90s wall; source and artifact hashes have no drift. Final native JSON, rather than
partial live reporter output, separates 11 root-input VM failures, 17 producer VM failures, one direct dual-return
refusal and one native-address batch-encoding error. All four groups are preserved in the durable results and
remain under focused repair. The root-input trace shows dynamic-write chunk verification aimed at a later
callee master because the old coordinate calculation ended at the last returning callee.


The complete proxy/kernel v8 gate records **43 passed, 23 failed, 0 skipped**, exit 1, 1809.10s wall,
with no source, emitted-build or artifact drift. All timestamp/proof/event-prefix failures and the valid
signature fixture pass. Twenty failures reach one missing nested target caused by framed CREATE prediction
in a kernel deployment; three fail during amount/after-timeout settlement. Full native results and all
wrapped error variants are preserved. The CREATE correction is being tested against both deployment modes.


The CREATE predictor correction passes actual deployments in direct, default and framed configurations, both
imported and HRE-bound prediction paths, and two existing framed-funding checks. The unchanged proxy/kernel
`take job` target now passes (112.42s, 65 unrelated cases skipped), with no diagnostics or freshness override.
The cause was framed look-ahead funding selecting the address domain even for direct logical CREATE deployment.
Native-address normalization at the message-batch descriptor boundary also passes three focused checks while
retaining strict primitive bytes encoding, exact widths, malformed-address rejection and unmodified caller arguments.


The remaining proxy/kernel timeout and amount targets now all pass cleanly after topology discovery reuses the
selected artifact’s authenticated oracle clock: close after timeout (60.54s), reopen after timeout (55.91s),
and update amounts (83.15s). Its next complete gate is being prepared on the merged common source snapshot.
The no-proxy dual-return refusal disappeared after the CREATE correction; its strict admission guard is retained.

Ordinary direct dynamic writers now publish their exact materialized output coordinate when later callees can
move their chunk run. The SDK defers that run past callee/identity recreation and transports logical caller
identity through the existing authenticated SCID witness. Compiler controls pass twice; neutral full-VM checks
cover growth, shrinkage, rejection of the old coordinate, exact state readback, and a child-only VM rejection
of a forged SCID root binding. The unchanged whitelisting target advances past its original root chunk and caller
identity failures to a remaining nested chunkable-value producer placement failure. No VM guard was relaxed.


The complete no-proxy/framed v9 gate is **GREEN: 65 passed, 0 failed, 0 skipped**, exit 0,
2037.27s wall (2035.89s Vitest). Source, emitted build, canonical tests and all 26 artifact hashes remained
unchanged. Every native test result, duration, full log and manifest is preserved in the durable repair JSON.
Both framed cells have now completed successfully. The final proxy/kernel complete run has started on the
merged common source, after a clean normal compile (9 cold jobs, 19 artifacts, 54.19s).


The main worktree’s complete compile after the ordinary direct compiler repair also passes: 9 cold jobs,
19 artifacts, 34.67s. All 19 artifacts from the green proxy/framed v7 gate were again recovered by exact
SHA-256 and compared: only `updatedAt` changes. Framed bytecode, ABI and all other metadata are identical.
The merged compiler controls (2/2, 6.18s) and logical-caller VM/security neutral (1/1, 10.65s) pass locally;
the source-tree generated-sidecar guard passes. The offline stock inventory has been refreshed from these
complete artifacts; its size conclusions are unchanged.


A focused no-proxy pay-start retry exposed parent argument overrides switching an address between native
P2PKH and ABI-word encodings on each result pass. Reapplying the selected handler’s existing ABI projection
to supplied parent frames fixes the loop; its red-to-green neutral passes (9.90s), all 21 adjacent topology
unit checks pass (5.83s), and lint passes. The unchanged marketplace target now reports every expected early
creator/worker/arbitrator/registration source rejection, then reaches the same outstanding nested producer
placement failure as whitelisting. This retry remains recorded as failed rather than reported as a full pass.


The no-proxy/kernel whitelisting target now passes cleanly (47.54s, 64 unrelated cases skipped). Its repair
uses the compiler’s typed stored-element recipe, authenticated old mapping value and selected oracle clock
to stage a complete append under an exact source-call/selector/owner/resource producer claim. Funding surplus
no longer shifts fixed outputs, and executing leaf identities reserve the same-index positions their covenant
requires before root dynamic chunks are appended. Neutral VM checks cover insert, growing update, a new key
using a populated predecessor, logical callee identity, exact persisted values/timestamps, and rejected entry
and oracle tampering. The final metadata narrowing and common-source kernel full gates remain outstanding.


The final ordinary producer repair is merged at its exact tested six-file source hashes. Its final clean
whitelisting retry passes (44.26s); the logical-callee neutral checks three complete VM transactions, exact
same-index identity preservation, typed state/timestamps, and entry/oracle forgery rejection (15.18s). Two
SCID funding controls preserve fixed prefix coordinates and funder value with interior/terminal OP_RETURN
cases. The isolated mandatory build and source guard pass. Both complete kernel suites are being prepared
on this final merged common SDK, including the parent-frame ABI projection correction. The earlier proxy
repair run excludes that correction and has reproduced its two known convergence failures, so it will be
retained explicitly as an interrupted intermediate snapshot rather than presented as a final gate.


Final main-worktree checks pass: one-shot `yarn build` (35.38s), lint for all changed TypeScript files
(the final ten-file delta 41.47s), both last integration VM regressions (2/2, 19.97s), source-tree guard,
and `git diff --check`. A normal complete compile refreshes all 19 framed artifacts (0 cold jobs, 9 cache
hits, 7.90s); comparison to the exact green proxy/framed v7 artifacts again changes only `updatedAt`.
The final no-proxy/kernel 65-case run started at 21:34:08 UTC with all production source hashes equal to
the merged main worktree. Its source, emitted build and artifacts are frozen until completion.


At 21:38 UTC the replacement proxy/kernel common-source run passes the two-job sequence, with no failures
so far. The final no-proxy/kernel snapshot exposes one new `Executing identity output collides` failure in
that sequence; the suite remains frozen while the collision is reproduced in the isolated checkout. Its strict
resource-conflict refusal remains active. The earlier proxy run was explicitly interrupted after 50 passed,
2 known parent-frame convergence failures and 14 uncompleted cases; exit 130, 2248.49s, no source drift.
Native JSON was not flushed on interruption, so its combined raw reporter log and explicit interruption record
are retained rather than described as a completed native report.


The remaining no-proxy two-job failure has been reproduced cleanly and decoded at its strict conflict guard.
A read-only nested getter consumes seven physical inputs, followed by its logical identity at input 10.
Its return-tail allocator placed an immutable return witness at output 10, before identity recreation.
The correction must reserve the selected direct leaf's required same-index identity coordinate when allocating
return families, including shared aliases; the covenant collision guard stays enabled. This diagnosis and the
failed focused retry are preserved in the durable results. Both common-source kernel suites remain frozen.


At 21:45 UTC the frozen no-proxy/kernel run additionally exposes input-0 `OP_VERIFY` failures in
`close job after timeout` and `reopen job after timeout`; their before-timeout controls pass. These are being
investigated separately from return/identity allocation. The interrupted original proxy checkout has been
archived before reuse for this focused investigation; the replacement proxy/kernel full gate stays untouched.


The timeout/withdrawal trace now identifies a generic compiler decoder gap: an active direct token call
contains a 501,817-byte redeem script framed by `OP_PUSHDATA4` (`0x4e`), while the shared wide decoder handles
PUSHDATA1/2 and then assumes `OP_1NEGATE` (`0x4f`). The exact focused retry fails at that comparison
(33.54s). A proper four-byte-length branch is under repair. Because this changes compiler JavaScript, the
next validation requires a normal complete compile; earlier artifact-equivalence conclusions apply only
to their explicitly recorded snapshots.


The frozen no-proxy/kernel run now passes both pay-start cases (51.40s sanity / 30.15s positive),
confirming the parent-frame ABI projection repair in the complete suite. It also exposes a separate
`post thread message > sanity checks` failure: `nested block oracle reader has no authenticated oracle input`
(82.61s), while the positive thread-message case passes (23.24s). This remaining oracle-threading group is
being investigated independently. The compiler decoder's focused 65,536-byte regression now passes after
adding PUSHDATA4 to both the shared and inline paths; normal complete compilation and canonical confirmation
are still pending.


The two-job canonical retry now passes after reserving identity coordinates through both return planning
and initial materialization (49.31s, 64 unrelated titles skipped). The stronger repeated-getter neutral
then exposes a separate authenticity defect: the physical callee authenticates its scalar at output 5,
but the shared alias retains a provisional zero at output 11, producing `[length, 0]`. Its exact value
assertions remain enabled. The repair must bind an identical read-only alias to the physical callee's
authenticated result; copying an expected value into an otherwise unconstrained output is insufficient.
A generic compiler/SDK correction and an alias-output rejection control are being developed.


The no-proxy/kernel common-source attempt terminated unexpectedly at 22:01 UTC after 1627.37s,
exit 1, with a worker `SIGKILL` and no source/build/artifact drift. Its native assertion records contain
**43 passed, 11 failed and 11 pending after termination**; this is an incomplete gate. The reporter's
aggregate `numPendingTests: 0` disagrees with those 11 pending assertion records, so the per-title records
are authoritative here. The 11 completed failures comprise one identity/return collision, three shared
wide-decoder failures and seven missing callee-oracle failures. No operator cancelled this run. The specific
cause of the kill is unconfirmed; heavy-process concurrency is being reduced for the final rerun.
Every native result, combined log, exit record and frozen manifest has been saved in the durable repair JSON.


The PUSHDATA4 repair passes shared and inline VM controls (including zero through 65,536 bytes,
negative sentinel preservation and malformed/truncated framing), adjacent ABI tests, lint, mandatory build
and normal complete compile (22 jobs / 26 artifacts / 87.51s). The canonical retry remains failed (45.47s):
it advances beyond decoding to a 20-byte recipient versus canonical zero-padded 32-byte ABI-word comparison.
A correction at the EVM argument-binding boundary is under test; physical target identity matching remains
strict. The direct compile changed 12/26 main programs and nine delegate programs, so earlier unchanged-artifact
claims do not apply to this new compiler snapshot.


The final fenced return repair passes its normal complete compile (94.87s), canonical two-job and
whitelist checks (2/2, 84.79s), logical append control (9.03s), four allocator controls and the repeated-getter
value/authentication neutral (12.94s). The caller ABI now publishes a versioned binding marker only when
the compiler emitted the corresponding check; legacy and unsupported call shapes do not receive SDK
alias propagation. The callee-only oracle repair passes scalar sharing controls (2/2, 13.58s), the stronger
clockless append/update/insert case (11.95s), and the unchanged thread-message sanity title (120.43s).
Review is correcting one provisional shared-alias physical-width count before final common validation.

The ABI-word repair also passes its wire-level controls: canonical 32-byte words, native identities and
P2PKH arguments validate through every input; wrong identities and nonzero address prefixes are rejected.
Its canonical timeout retry now clears every VM check but exposes a later balance assertion (31.48s):
reopening debits the user yet credits the physical self address, while the earlier routed call used the
logical CREATE identity. Ordinary `address(this)` must use the existing authenticated self-identity
protocol; that remaining semantic correction is being implemented before the final matrix.


The frozen proxy/kernel common-source gate completed successfully at 22:29 UTC: **66 passed,
0 failed, 0 skipped**, exit 0, 3163.03s Vitest. Source, emitted build and artifact manifests have no drift.
The full native result and combined log are preserved. This is a complete green gate on its recorded
21:36 UTC snapshot, before the subsequent PUSHDATA4, ABI-word, alias-binding, callee-oracle and ordinary
self-identity followups; final merged-source validation remains required.

The ordinary authenticated self repair passes the unchanged no-proxy/kernel timeout-and-reopen title
(1 passed, 64 unrelated skipped; 33.15s), with no source/build/artifact drift. Root and nested own-self controls
pass all-input VM validation, reject forged SCID subjects/categories, and retain physical self for native
deployments. The stronger nested writer also exposed missing concrete state-NFT discovery through an
interface; eager and late discovery now use the selected concrete ABI footprint and reject missing owned
NFTs. Graph-managed identity fills retain their existing policy. All meaningful failed retries and final
focused proofs are preserved in the durable repair JSON.

The final-merged proxy/framed suite completed at 23:21 UTC: **66 passed, 0 failed, 0 skipped**,
1940.03s wall, exit 0, with no source/build/artifact/config/test drift. Its complete native results, logs,
before/after manifests and launch context are embedded in the durable repair JSON. The proxy/kernel
oracle followup remains under review on a separate checkout; this complete green snapshot remains preserved.

The final-merged no-proxy/kernel suite completed **65/65**, exit 0, in 2628.80s with no drift and no
unhandled errors. Its frozen inputs are archived and verified. The known-failing proxy/kernel attempt
was explicitly interrupted only after the reviewed repair passed the unchanged whitelist title (44.17s),
three retained runtime controls, six focused unit controls, build and lint. That interrupted attempt has
**58 passed, 1 failed and 7 uncompleted** before SIGINT; native JSON did not flush, so reporter observations
are preserved without synthetic native totals. Its complete frozen inputs and raw terminal evidence are saved.

The final oracle repair uses actual physical carriers, reuses the selected instance pin for recipes and
provisioning, preserves nested oracle outputs, and promotes a shared authority into a final root-owned band
with balanced padding. Root and nested delegate ownership come from existing authenticated topology metadata;
the final input and VM guards remain strict. ROOT's combined checks pass 11 runtime cases and seven oracle unit
cases, build, lint, source-tree guard and normal cached complete compile. All compiler artifacts remain byte-for-byte
unchanged by this SDK-only followup. The final common source has 789 TypeScript files, aggregate SHA-256
`37548017ea8c29799496c50ed56982df7124a81fdf6924b3de6eb9a0567dded8`; complete matrix validation is starting.


The final common-source proxy/framed full suite completed at 00:10 UTC on October 15: **66/66**,
1913.00s wall, exit 0, no unhandled errors or drift. Native per-title records were independently audited.
The verified frozen-input archive contains 5,826 files, SHA-256
`14110e8d5a35e0356106187c51b0f420e0cd09211851605ab70445e5ea27d9da`; its metadata,
full results/logs and all before/after manifests are embedded in the durable repair JSON.


The final common-source no-proxy/framed full suite completed at 00:11 UTC on October 15: **65/65**,
1975.80s wall, exit 0, no unhandled errors or drift. All 65 unique native titles and 18 raw evidence-file
hashes were audited. The frozen archive contains 6,956 verified files, SHA-256
`d955b4a97dbda43338583cea0a10df309660fdfeddeb1009b33b1e02a342ee80`; the evidence index,
full native results/logs and before/after manifests are embedded in the durable repair JSON.


The final common-source no-proxy/kernel full suite completed at 00:21 UTC on October 15: **65/65**,
2595.31s wall, exit 0, no unhandled errors or drift. All 65 unique native titles passed. The frozen archive
contains 6,234 verified entries and matches all 4,606 before-manifest inputs, SHA-256
`0b7cd5914f04c1416b8ed159578e3c458c65e6c6b405f0bff0e7a12d3aeafd0f`. All 25 terminal evidence
files, including complete native results/logs and before/after manifests, are embedded in the durable repair JSON.


The final common-source proxy/kernel full suite completed at 00:28 UTC on October 15: **66/66**,
3125.19s wall, exit 0, no unhandled errors or drift. All 66 native assertions have empty failure messages,
with zero pending/todo titles or live workers. The frozen archive contains 5,826 verified files, SHA-256
`9078e306cb29cd39c02e591a49f602aeed2f1fc20bb8df76a9ac13ae29d70cde`; all 29 final evidence
files, including native results/logs, terminal audit and manifests, are embedded in the durable repair JSON.


The final four full gates all completed successfully on the common `37548017…` source. Their native per-title
results, logs, launch contexts, before/after manifests and verified frozen-input archive records are embedded
in the [durable repair results](marketplace-matrix-2026-10-14-fix-results.json). Earlier failed and interrupted
attempts remain preserved. No canonical marketplace test or application source was changed.


## Integration into per-call, 2026-10-15

The `feat/transcript-followups` checkpoint `d3bbc9b6e` was merged with `feat/per-call` at
`945b319f0`, retaining its windowed and chunked iteration changes. Focused validation exposed a shared
parser fast-path incompatibility: adding the window keyword renumbered anonymous ANTLR literal tokens.
The integration resolves the 32 literal tokens from the active grammar once, preserving the fast paths.
The combined tree passes build, lint, source-tree/whitespace guards and **204 focused checks**
(15 compiler, 172 SDK unit and 17 end-to-end cases), including the VM adversarial window/chunk controls.
The 262-case full marketplace result above belongs to its recorded pre-merge source snapshot.
[Complete merge validation and failed/green retries](marketplace-matrix-2026-10-15-per-call-merge.json)
are preserved separately.
