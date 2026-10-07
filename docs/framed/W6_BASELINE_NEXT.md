# W6 baseline, next: root-cause hypotheses for three remaining clusters

Probe only. Measured on a throwaway worktree taken from `feat/per-call` at `4d95209ea`. Nothing
here is landed; the work that produced it was diagnostic and its instrumentation was removed.

Companion to `W6_FAILURE_FIXES.md` (the 29 recorded fixes) and `W6_BASELINE.md` (the residual
rows). All three clusters below are `pre-existing kernel` rows: the test files match the kernel
parent and failed on it, so they are not merge-caused regressions.

Recipe per title (files are slow; one title at a time, one worker):

    cd packages/solidcash
    node_modules/.bin/vitest run --config vitest.e2e.config.ts <file> -t '<title>' --maxWorkers=1

`SOLIDC_DEBUG_FAILURE_POINT=1` prints the failing opcode window for a message-bus preflight
failure. All instrumentation added below was removed before the deliverable commit; the tree is
clean and `git status --porcelain` is empty.

Summary of the hypotheses:

- A (AtomicMessageBusCompose): the oversized callee input is 10627 bytes because the callee
  compiles to 9968 bytes (32 under the P2SH ceiling) and the message-bus frame adds ~1082; the
  `mapping(uint256 => bigint[])` plus event is the dominant size. A2/A3 are route/recipe
  refusals, not size.
- B (FixedConditionalTransferSecurity): the false arm drops the satoshi container output, and
  the Solidity `address.transfer`/`address.send` handlers fail an OP_EQUALVERIFY inside the
  driver's `__message_bus1` route.
- C (KernelMultiContinuationResourceCompose): the batch-predecessor output (10000 sats) is
  materialized by `reassertMaterializedBatchPredecessorOutputs` AFTER the fee is measured, so the
  fee input is 10000 sats short; over-funding by 20000 turns both titles green.

## Cluster A: `AtomicMessageBusCompose.test.ts` (3 titles)

### A1 `preserves a pooled long mapping return across event-emitting writes`

Exact error (reproduced alone):

    AssertionError: unlocking scripts must meet the BCH-2026 per-input byte limit:
    expected [ { index: 1, bytes: 10627 } ] to deeply equal []

Evidence. The assertion is at test line 1445; the limit is
`ConsensusBch2026.maximumBytecodeLength` = 10000 (`MockNetworkProvider.ts:168`). A temporary
env-gated dump of `built.buildLibauthTransaction().inputs` reported:

    DBG-INPUTS [{"index":0,"bytes":4932,"category":"<caller>"},
                {"index":1,"bytes":10627,"category":"<callee>"},
                {"index":2,"bytes":108,"category":"<callee>"},
                ... ,{"index":328,"bytes":9002,"commitment":"4c335631"},
                {"index":329,"bytes":9002,"commitment":"4c335631"},{"index":330,"bytes":100}]

Input 1 carries the callee category and its unlocking script's final push (the P2SH redeem) is
9545 bytes; the argument/envelope prefix is 1082 bytes (two 134-byte pushes, one 148-byte push,
and small pushes). A temporary probe compiled the callee with/without features:

    PROBE full     9968  8956     (full callee / delegate)
    PROBE noEvent  9578  8390     (drop `event Appended` + emit)
    PROBE noItems  4999.5 5431.5  (drop `mapping(uint256 => bigint[]) items` + its 2 functions)

So the callee artifact bytecode is 9968 bytes - within 32 bytes of the 10000-byte P2SH ceiling -
and the `bigint[]` mapping plus its read/push functions cost ~4970 bytes, the dominant share.

Hypothesis (falsifiable). Input 1 spends the callee's own P2SH32, so its unlocking script must
push the whole callee contract (`~9545`), and the message-bus frame adds `~1082`; the sum 10627
exceeds 10000. This is a size interlock, not a caller-side bug: the caller (input 0) is 4932
bytes, and the oversized input is the callee's. The callee's redeem would have to be `<= 8918`
(10000 - 1082) to fit, i.e. ~627 bytes smaller. Falsify by shrinking the callee's own emitted
bytecode by ~650 bytes and re-running: the assertion moves below 10000.

Smallest change believed to fix it. Either (a) reduce this shape's compiled bytecode, or (b) route
the callee participant through the message-bus verifier/delegate so its input does not push the
full contract (the two 9002-byte inputs at 328/329 already carry `4c335631` verifier commitments,
so the machinery exists). Option (b) is a routing decision and must be confirmed against the
intended participant layout; a bare "grow the limit" is not available because the limit is
consensus.

Risk. (a) is a codegen size change and can perturb other pinned bytecode. (b) changes which
participants are direct vs verifier spends and can invalidate layout pins.

Verified. The 10627/9545/1082 split and the 9968-byte callee were measured directly. The
"smallest contract that fits" arithmetic is derived from those measurements, not from a fixed run.

### A2 `advances past a reached conditional opaque-return row in a delegated root`

Exact error (reproduced alone, `SOLIDC_DEBUG_FAILURE_POINT=1`):

    Error: messageBus: BCH-2026 preflight failed at input 3
    (ip 636 of 1144, opcode 119, failing opcode 136, window 1:fd 138 117 118 88 138 82 121 136 119)
    (participant ComposeConditionalRawCaller.__message_bus1): Program failed an OP_VERIFY operation.

Evidence. Input 3 is the caller's route; `opcode 136` (0x88) is OP_EQUALVERIFY. The trailing
window and the ip-window dump show the comparison target is the 4-byte value `9f0bb8a9`:

    ipWindow [ ... {"ip":638,"opcode":1,"data":"97"},{"ip":639,"opcode":138},
               {"ip":640,"opcode":4,"data":"9f0bb8a9"},{"ip":641,"opcode":126}, ...]

`9f0bb8a9` is the callee's invocation selector in the published emissions blob
(`__internal__graphEmissions` starts `2300aa20af0e...a58700177472f22100...`); the stack at the
failure holds the 38-byte `9f0bb8a92000...abd0b871...` row subject. So the route checks a
reached row's selector against its emission and the check fails.

Hypothesis (falsifiable). For a "conditional opaque-return row" inside a delegated root, the
caller's `__message_bus1` route emits an authenticated row whose emission selector does not match
the selector the route recomputes at ip 636, so the route refuses instead of advancing past the
row. The row is "reached" (the condition holds) yet the route does not skip it. Falsify by dumping
the route's expected vs actual selector at ip 636 for the two arms.

Smallest change believed to fix it. Locate the conditional opaque-return row lowering in the
caller route emission (the `__internal__graphEmissions`/row-selector binding) and make the reached
row's emission match its selector, or make the route skip a reached opaque-return row as the title
says. This is a route-codegen change.

Risk. The route is the security boundary for the whole composition; a wrong skip weakens row
authentication. High.

Verified. The failing input, ip, opcode and the `9f0bb8a9` comparison are measured. The "which
selector should match" claim is inferred from the emissions blob, not proven.

### A3 `learns computed ecrecover arguments under the shared atomic graph lock`

Exact error (reproduced alone):

    Error: materialization: recipe mode forbids deferred-compute VM discovery as planner authority;
    unresolved participant(s) 1 (keccak 0/0, ecrecover 1/1)
    (opt into materializationMode=devOracle for diagnostic discovery)

Evidence. The throw is `compose-assemble.ts:2735`, gated by `!allowsDeferredComputeVmDiscovery()`.
`allowsDeferredComputeVmDiscovery()` (`materialization-mode.ts:89`) is true only when the mode is
`devOracle`; the default is `recipe`. The test's `messageBus.compose({...})` passes no
materialization mode, so the gate is closed. The unresolved set is participant 1 (`ComputedRecover
Sink`), `ecrecover 1/1` - the `ecrecoverPubKey(bytes32(bytes(sourceHash).reverse()), v, r, s)`
compute is unresolved under recipe.

Hypothesis (falsifiable). The recipe path is supposed to *learn* the ecrecover arguments from a
compiler-authored recipe (as it does for keccak/CREATE2: sibling titles
`keeps computed CREATE2 recipes site-local...` and the G2 fix `07950282c` handle
Keccak/`ECDSA.recover`). For this shape the recipe is not produced, so the controller stays
unresolved and the recipe gate refuses. Falsify by dumping the sink handler's
`ecrecoverArgParams`/sidecar recipes (`handler?.ecrecoverArgParams` is asserted earlier in the
test as `[[null,'v','r','s']]`) and checking that no sidecar recipe was authored, then re-running
with `materializationMode=devOracle` to confirm the shape is otherwise composable.

Smallest change believed to fix it. Author (or stop dropping) the ecrecover compute recipe for a
handler whose args come from the caller's handler inputs, mirroring the keccak/`ECDSA.recover`
exemption in `07950282c`.

Risk. Recipe-mode authority is the correctness boundary for computed outputs; a wrong recipe
could publish an unauthenticated value. Medium-high.

Verified. The mode gate and the unresolved counts are measured. Whether the missing recipe is in
solidc (authoring) or in the SDK (dropping) is not established here.

## Cluster B: `FixedConditionalTransferSecurity.test.ts` (3 titles)

### B1 `binds true/false and if/else paths, neutral padding, exact recipes, row cardinality, and container debit`

Exact error (reproduced alone):

    AssertionError: expected undefined to be defined
     > test/.../FixedConditionalTransferSecurity.test.ts:364:99

Line 364: `expect(inactive.outputs.find((output) => !output.token
&& output.amount === containerAmount)).toBeDefined();` with `containerAmount = 20_000n`.

Evidence. A temporary dump of `conditional(false)` (the inactive arm) vs `conditional(true)`:

    b-inactive inputs 261 outputs 261  20000-outs: []  18000-outs: []
    b-active   inputs 261 outputs 261  20000-outs: []  18000-outs: [{i:2,amount:18000,lock:aa2011a9...}]

The active arm publishes the satoshi container as `20000 - 2000 = 18000` at output 2. The
inactive arm publishes no output with the container lock at all (its only non-1000 token-less
outputs are a 3000-sat `OP_TRUE` pad and the funder change). The VM still accepts the inactive
arm (the test's earlier `vmRejects` list is all false), because with no container input and no
container output `msg.value == 0` is trivially satisfied and the `else { require(msg.value == 0);
}` passes.

Hypothesis (falsifiable). For the not-taken `else` arm the composer omits the satoshi-container
input/output entirely, so the arm's `msg.value == 0` is satisfied vacuously; the test expects the
container to pass through unchanged at 20000. Falsify by checking whether the inactive compose
co-spends `getSatoshiContainerAddress(...)` at all (the dump says it does not).

Smallest change believed to fix it. Keep the container input and a pass-through container output
(20000) in the frame for an arm whose condition can be false, so `msg.value == 0` is authenticated
against a present container instead of a missing one.

Risk. Adding a container input/output to the false arm changes the participant frame geometry and
can move every pinned output index in this file. Medium.

Verified. The inactive arm's missing container output is measured directly.

### B2 `executes address.transfer from its typed fixed-effect descriptor`
### B3 `executes address.send from its typed fixed-effect descriptor`

Exact error (B2 reproduced alone, `SOLIDC_DEBUG_FAILURE_POINT=1`; B3 is the same shape):

    Error: messageBus: BCH-2026 preflight failed at input 0 (ip 64 of 67, opcode 1,
    failing opcode 136, window 130 119 88 121 124 127 124 123 136 1:98)
    (participant Driver.__message_bus1): Program failed an OP_VERIFY operation.

Evidence. Input 0 is the `Driver` route; `opcode 136` (0x88) is OP_EQUALVERIFY, and the route
program is only 67 bytes - the failure is on a single equality near its end. A temporary probe
compiled a Solidity `Vault` (`address payable.transfer` / `address.send`) and a CashScript
`Vault` (`this.transfer`) with the same options:

    PROBE solidity-transfer [{"name":"transferStyle","eligible":true,
      "transfers":[{"transferIndex":0,"recipient":{"kind":"forward","paramIndex":0},
      "amount":{"kind":"forward","paramIndex":1},
      "recipientRecipe":{"kind":"handlerInput","inputIndex":0},
      "amountRecipe":{"kind":"handlerInput","inputIndex":1}}],"selector":"41a076b4"}]
    PROBE cash-transfer     [... byte-identical, selector "41a076b4"]

So the Vault side is identical between the two spellings; the difference is only on the driver
route. The passing sibling `authenticates bytes.concat recipients selected by branch and switch
joins` uses a `conditional`/`concat` recipe, while these failing titles use `handlerInput`
recipes.

Hypothesis (falsifiable). The composed `Driver.__message_bus1` route's per-call binding is
computed differently for `handlerInput` transfer recipes than for `conditional`/`state` recipes,
so the equality that binds the call fails for the Solidity `address.transfer`/`address.send`
descriptor and preflight refuses. Falsify by dumping the driver route program for the passing
`conditional`/`concat` fixture and for the failing `handlerInput` fixture and diffing the
equality operand at the failure ip.

Smallest change believed to fix it. Make the route's per-call equality use the same binding for
`handlerInput` recipes as for the other recipe kinds.

Risk. Route binding is the composition's authentication boundary; a wrong operand silently
loosens what a participant accepts. High.

Verified. The failing input/ip/opcode and the 67-byte route are measured; the byte-identical Vault
descriptor is measured. The exact operand compared at ip 64 is not decoded.

## Cluster C: `KernelMultiContinuationResourceCompose.test.ts` (2 titles)

### C1 `builds and sends two cold keys in one chunkable collection through typed discovery`
### C2 `routes typed cold-key inserts to the runtime-selected callee bytecode`

Exact error (reproduced alone; C2 is one byte/one satoshi less):

    Error: Transaction fee of 33353 satoshis is below the minimum relay fee
    (43528 satoshis for a 43528-byte transaction at 1.0 sat/byte). Add more funding inputs or
    reduce outputs.
    (C2: 33352 satoshis / 43527 satoshis for a 43527-byte transaction)

Evidence. With `SOLIDC_DEBUG_FEE_BALANCE=1`:

    fee-balance {"totalInputSats":"93929","totalOutputSats":"60576","fee":"33353",
                 "requiredFee":"43528", inputs:[10000 x5, 43929], outputs:[... ,5976, 10000]}

The funder is created by `measureAndFundCovenantFee`; the same run printed:

    covenant-measure {"covenantSize":"43234","totalEstimatedSize":"43321","neededFee":"43353",
      "existingFee":"5400","funderSats":"43929",
      "covenantOutputs":8,"covenantOutValues":["10000"x5,"1000","1200","1200","1200"]}

So the measurement was correct (neededFee 43353 for the measured shape). Tracing phase 3
(`stb-run-send-phase3-final-rebuild.ts`):

    phase3-after-build     outputs 8  values [... same 8 ...]
    phase3-after-place     outputs 9  values [... 8 ..., 5976]
    phase3-after-reassert  outputs 10 values [... 8 ..., 5976, 10000]
    phase3-after-postlayout outputs 10 values [... 8 ..., 5976, 10000]

and inside the reassert cascade (`stb-reassert-send-final-layout.ts`):

    layout-start                      outputs 9
    layout-after-valuechunkwitnesses  outputs 9
    layout-after-inputwitnesses       outputs 9
    layout-after-pred                 outputs 10   <- appended there

`layout-after-pred` is the snapshot after `host.reassertMaterializedBatchPredecessorOutputs`. So
the 10th output (10000 sats, store state lock, no input) is materialized by the batch-predecessor
reassert, which runs after the fee funder was sized. The extra 10000-sat output consumes the fee:
neededFee 43353 -> actual fee 33353. The final fee finalizer
(`stb-finalize-fee-before-validation.ts`) then needs `reduction = 43528 - 33353 + 2 = 10177` but
the only change output is 5976, so `findChangeIndex` fails and it throws.

Hypothesis (falsifiable). A cold two-key insert into one chunkable (`mapping(int => bytes)`)
collection needs a republished batch predecessor output P' (10000 sats). P' is appended by
`reassertMaterializedBatchPredecessorOutputs` during the phase-3 final-layout reassert, i.e. after
`measureAndFundCovenantFee`, and no input funds it, so the fee falls 10000 short. This is the same
"pred' appended past the frame" family as `W6_CHUNKED_INSERT_FINDING.md`.

Falsification performed (proves the diagnosis). Temporarily add 20000 to `funderSats` in
`measureAndFundCovenantFee` and both titles turn green:

    SOLIDC_PROBE_C_EXTRA=1 ... -t 'builds and sends two cold keys ...' -> Tests 1 passed
    SOLIDC_PROBE_C_EXTRA=1 ... -t 'routes typed cold-key inserts ...'   -> Tests 1 passed

So the entire failure is the 10000-sat-unfunded late output; nothing else about the composition is
broken. (The temporary over-fund was reverted; it is not committed.)

Smallest change believed to fix it. Include the pending batch-predecessor output in the funded
shape: either fold P' (or its satoshi value) into the phase-2 measurement, or run the
batch-predecessor placement before fee measurement, or let the finalizer reach another funding
input when the change output alone cannot cover the shortfall. The value is computable at
measurement time from the consumed predecessor input, so a targeted "pending predecessor" reserve
is the least invasive option.

Risk. Reordering measurement vs materialization must not double-count the predecessor or perturb
the pinned output coordinates; feeding the finalizer another input changes the input count and can
move every authenticated index. Medium.

Verified. The full chain is measured end to end (measurement, phase-3 growth, the exact host call
that appends the output, and the finalizer's failed reduction), and over-funding turns both titles
green. A production fix is not implemented here.

## Smaller clusters (not investigated in depth)

`OutlinedArrayReadRoute.test.ts` (1), `KernelSegmentedHandlerReturnWidths.test.ts` (1),
`KernelPhysicalCallerWithScidCompose.test.ts` (1), `KernelChunkedMappingStructCompose.test.ts`
(1), `MessageBusDelegateClassesE3.test.ts` (2) were not reached. `KernelChunkedMappingStructCompose`
is already analysed in `W6_CHUNKED_INSERT_FINDING.md` and is the same precedence/append family as
cluster C; it is the best next candidate if cluster C's reserve is implemented.
