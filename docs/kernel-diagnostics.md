# Kernel diagnostic switches

`SOLIDC_*` switches are investigation tools, not a second release configuration. Find a switch and its exact
effect at its source (`rg 'SOLIDC_<NAME>' packages/{solidc,solidcash,utils}/src`). Keep a useful probe when it
exposes a reusable compiler, witness, or VM boundary; remove probes whose observation no longer has a clear
consumer. A retained probe must be opt-in, bounded to a named test/input or instruction window where practical,
and must not silently change normal codegen or settlement. Do not turn an application-name probe into kernel
admission logic. Delete probes tied only to a literal function name, output index, or address prefix after the
investigation; those are observations, not durable diagnostic interfaces.

| Kind | Examples | Use |
| --- | --- | --- |
| Trace/report | `SOLIDC_DEBUG_ROUTE`, `SOLIDC_DEBUG_FAILURE_POINT`, `SOLIDC_DEBUG_DERIVE_FAIL`, `SOLIDC_DEBUG_COMPUTE_BASE` without markers, `SOLIDC_DEBUG_COMPOSE_TIMING`, `SOLIDC_DEBUG_EVENT_TRACE_TIMING`, `SOLIDC_DEBUG_HARNESS_TIMING` | Diagnose one named test; capture only the relevant window. Confirm bytecode identity before calling a new trace-only probe neutral. |
| Instrumented output | `SOLIDC_DEBUG_COMPUTE_BASE_MARKERS`, `SOLIDC_DEBUG_BOTTOM_PICK_SITE`, `SOLIDC_ROW_ASSERT`, `SOLIDC_FRAME_ANCHOR` | Changes emitted script or stack shape; useful for localization, never a production-size or semantics measurement. |
| Experimental behavior | `SOLIDC_DEBUG_NO_OUTLINE`, `SOLIDC_NO_OPTIMISE`, `SOLIDC_ROUTE_ABI_TAIL=0`, `SOLIDC_RETURN_OUTPUT_IDX_DISABLE`, `SOLIDC_DISABLE_JOBEVENT_DETACH` | Bisect behavior only. These may change bytecode, witnesses, or SDK settlement. The JobEvent switch is a legacy compatibility probe, not a general kernel feature. |
| Timing/cache | `SOLIDC_PROFILE`, `SOLIDC_DEBUG_OUTLINE_TIMING`, `SOLIDC_COMPILE_CACHE*` | Useful locally, but changes the measurement environment. |

The list is illustrative, not a claim that every `SOLIDC_DEBUG_*` switch is observational. Record the exact
environment, compiler options, artifact hash, and target title with each diagnostic result. The beta gate and
authoritative marketplace scoreboard remove inherited `SOLIDC_*` variables before cold compilation; the
one-shot compiler profiler also strips them before importing compiler modules. Repeat production claims with
those clean paths. During debugging, run only the target test and at most one adjacent title. When adding a
switch, classify it here as observational, output-changing, experimental, or timing-related; include a bounded
invocation and explain what evidence it provides. Do not preserve one-off logging solely because it once helped.

`compiler.tagSingletonDataNfts: true` is a persisted state-layout option, not a diagnostic switch. It adds a
verified record-index header to single-record state so an implementation can share that record with a generated
proxy that owns an additional pointer record. The artifact publishes `stateLayout.taggedDataNfts: true`; codecs,
layout digests and proxy compatibility checks use that encoding. Existing untagged artifacts keep their format.
Changing this option requires a normal complete project compile and an explicit state migration for existing
deployments. It changes bytecode and commitments, so compare measurements only at the same recorded setting.

`SOLIDC_DEBUG_EVENT_TRACE_PARITY=1` reruns a failed event probe with the expensive faithful recorder and
throws if its event commitments or locking bytecodes differ from the bounded observer. It is a targeted
cross-check, not part of a production or timing run.

`SOLIDC_DEBUG_COMPUTED_VALUE_DISCOVERY=1` reports the computed values observed at executed chunk-count guards
on the complete message-bus graph. The normal settlement path accepts a value only when its exact
compiler-described collection/key lock and chunk count also appear in that VM frame. The switch only logs. Use
it with one title; `SOLIDC_DEBUG_ONLY_PREFLIGHT_INPUT=<input index>` can narrow a diagnostic probe, but an isolated
run is never a passing-test gate. Logging overhead makes the run unsuitable for cold timing. This switch does not
change emitted bytecode.

`SOLIDC_DEBUG_VALUE_CHUNKS=1` includes `value-chunk-base-plan` records for external computed writes: the
selected band, fallback coordinate, requested width, and a bounded occupancy window around that coordinate.
It also emits `kernel-value-chunk-resource-lanes` immediately before the kernel rejects an ambiguous scalar
continuation coordinate; that record lists the compiler-authenticated collection/key lanes and witness groups.
Use it with one title to distinguish a missing value, an output-suffix collision, and a route that genuinely
requires multiple resource coordinates. The switch only logs and does not relax the refusal.
It also reports `transported-value-producer-mismatch` when a transported continuation claim disagrees with its
routed terminal producer: both claims and at most 24 compiler rows with 24 access summaries each, without
value bytes or stored-value expression trees. `terminal-value-production-unavailable` reports the expected
terminal claim and at most 24 candidate claims when assembly cannot find the terminal value. These records
distinguish stale producer selection from incomplete source paths while preserving the ownership gate.

`SOLIDC_DEBUG_RETURN_CAPTURE=1` reports return-event installs and the producer probe that supplied each
candidate, including the terminal error and internal indices. Use it only on one named title: the diagnostic
captures stack and origin data, adds substantial logging, and is not a cold-timing or neutrality claim.
`SOLIDC_DEBUG_RETURN=1` and `SOLIDC_DEBUG_FAILURE_RING=1` can change the observed convergence path in large
compositions; repeat any conclusion with these switches off.

`SOLIDC_DEBUG_MSG_SENDER_KEY=1` traces how compiler-owned caller-category and SCID-anchor witnesses move through
route arguments, unlocker construction, and return probes. Limit it to one named test and, where possible, one
input: it can print argument shapes and stack summaries, is expensive, and is not evidence about cold performance
or production bytecode. Verify any proposed identity fix again with the switch unset.

`SOLIDC_DEBUG_ATOMIC_GRAPH=1` traces graph participant placement, argument transport, and published unlockers;
it also reports `atomic-semantic-claims` with bounded per-domain counts/digests, pass number, local-repeat status,
and changed observation indices (computed chunks, resources, values, tokens, sidecars). These records contain
no claim value bytes and distinguish local claim cycles from a repeated active-session fingerprint.
`SOLIDC_DEBUG_RESULT_PROPAGATION=1` reports result-dependent argument resolution and, on a repeated producer lane,
`atomic-repeated-producer-lane` lists at most 24 matching producer indices and source/batch/occurrence coordinates, without
argument or result bytes. Use one named title to distinguish repeated source callsites from duplicate graph rows;
this observational probe does not alter validation or emitted bytecode.
`SOLIDC_DEBUG_VMAP_PROOF=1` traces sorted-entry proof and predecessor-output rebinding;
`SOLIDC_DEBUG_VALUE_WITNESS=1` traces chunked-entry witness selection across nested calls. These are opt-in
reports, not alternate settlement modes. They can log large transaction or witness summaries, so use one named
test and capture only the needed records. Recheck any fix with all three switches unset.

`SOLIDC_DEBUG_ROUTE=1` includes `collection-journal-message-bus-pool` records when routed handlers share a
collection journal. Each record identifies handler mutation effects, normalized key identities, pooled locals,
and runtime aliases. Use it to distinguish a missing write from an alias/key-lane mismatch without relying on
application names. Metadata collection and logging are both disabled when the switch is unset; the switch does
not alter emitted bytecode.

`SOLIDC_DEBUG_OUTPUT_TOKEN_COMPARE=1` reports mismatched `OP_OUTPUTTOKENCOMMITMENT` equalities during final
preflight without changing the transaction. Use `SOLIDC_DEBUG_ROUTE_INPUT_INDEX` to select an input and
`SOLIDC_DEBUG_OUTPUT_TOKEN_COMPARE_IP` to inspect one instruction's stack before the comparison.
`SOLIDC_DEBUG_RETURN_IDX=1` prints return-output index parameters only when preflight rejects an input.
`SOLIDC_DEBUG_DERIVE_TRACE_OPS=1` emits `derive-op` records with an `executing` field. The VM also visits
instructions inside inactive conditional arms, so an `OP_INVOKE` record with `executing: false` does not mean
the callee ran. Use `programInputs` to distinguish a final composed probe from earlier setup transactions in
the same named test.
`SOLIDC_DEBUG_PROBE_CANDIDATE_TERMINAL=1` reports each deferred-compute candidate's terminal VM frame;
the default no-progress report otherwise shows only the final candidate, which can hide an earlier failure.
For `SOLIDC_DEBUG_FAILURE_POINT_PRE_STATE=1`, set `SOLIDC_TRACE_INPUT=<input index>` on large compositions;
the opt-in VM probe snapshots that input's instruction pre-states and can report compared operands and a bounded
`SOLIDC_DEBUG_FAILURE_POINT_TRACE_FROM`/`_TO` instruction window without retaining every participant's stacks.
`SOLIDC_TRACE_INPUT` bounds snapshot capture only: preflight still validates every transaction input.
Use `SOLIDC_DEBUG_FAILURE_POINT_STACK_FULL=1` only with a selected input when comparing deep frame slots;
it reports each item's size plus bounded head/tail bytes, enough to distinguish a stale dynamic value from a
pending update without dumping full commitments. Avoid `SOLIDC_DEBUG_FAILURE_TRACE=1` on large invoked routes:
its full VM replay can exhaust a worker's memory. `SOLIDC_DEBUG_ONLY_PREFLIGHT_INPUT=<index>` is a diagnostic
isolation switch, not a passing-test gate: it deliberately skips the other inputs.

`SOLIDC_DEBUG_FRAMED_COUNTS=1` counts the framed composer's own work — the plain call path's learning attempts,
the derivation hosts it builds, the whole-composition and scoped derivations it runs, the hop's per-frame attempts,
and each declaration read split by which answer took it (a close the machine already recorded, or the bounded
walk). It is observational: no plan, program or verdict changes, and with the switch unset
every bump is one `false` test. The running totals are logged as `framed-composer-counts {...}` every 128 plain-path
attempts, which is what a lane log can read (a worker's exit-time output is dropped by the test runner); a test can
read them directly through `framedComposerCounts()` in `packages/solidcash/src/framed/composer/counters.ts`.
Use it to size a title's cost before changing the loop, and compare the same title before and after a change.

`FRAMED_HOP_TRACE=1` reports framed proxy/callee planning and settlement attempts, including bounded comparison
and instruction context on an implementation-frame refusal. It changes logging only; programs, witnesses and
verdicts remain unchanged. Use it on one focused title, for example
`FRAMED_HOP_TRACE=1 yarn workspace solidcash vitest --watch --config vitest.framed.config.ts test/framed/shapes/proxied-root-append.test.ts -t 'settles the record write and both appends'`.
Recheck with the variable unset before recording a passing checkpoint or comparing timings.
`docs/framed/NOPROXY_LANE_COST.md` is the reading that motivated it.
