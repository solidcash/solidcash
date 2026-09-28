# Focused test directories

One directory per stream, plus the shared interface vectors. A stream's directory is the only suite it runs while
it is being written; the whole-repo suite runs at milestones.

Run a package's focused suites, or one directory of them, with its per-call config:

    yarn workspace solidc vitest run --config vitest.per-call.config.ts [<directory>]
    yarn workspace solidcash vitest run --config vitest.per-call.config.ts [<directory>]
    yarn workspace @solidcash/testing vitest run --config vitest.per-call.config.ts [<directory>]
    yarn workspace @solidcash/utils vitest run test/per-call

The per-call configs keep transpiled modules on disk between runs (`test.experimental.fsModuleCache`), skip
per-file isolation and turn on the compiler's deterministic compile cache. Measured at `6f8d4b5ec`: `solidc`
16.8 s with the package config, 13.3 s on a first run and 7.5 s on a repeat; `solidcash` 56.6 s, 22.1 s and
10.5 s. An edited file is transpiled again on the next run; if a run ever looks stale, `npx vitest --clearCache`
empties the cache. New tests should still compile each source once per file.

The generated program-versus-derivation check in `validator/script.test.ts` runs three cases per mutation by
default. `PER_CALL_FULL=1` restores its full 400-case sample; use it at milestones.

| Directory | Package | Tests |
| --- | --- | --- |
| `packages/utils/test/per-call/` | `@solidcash/utils` | 115 |
| `packages/solidc/test/per-call/master/` | `solidc` | 466 |
| `packages/solidc/test/per-call/records/` | `solidc` | 29 |
| `packages/solidc/test/per-call/validator/` | `solidc` | 9 |
| `packages/solidc/test/per-call/machine.test.ts` | `solidc` | 3 |
| `packages/solidcash/test/per-call/validator/` | `solidcash` | 94 |
| `packages/solidcash/test/per-call/composer/` | `solidcash` | 165 |
| `packages/solidcash/test/per-call/frames/` | `solidcash` | 71 |
| `packages/solidcash/test/per-call/reads/` | `solidcash` | 19 |
| `packages/solidcash/test/per-call/reverts/` | `solidcash` | 3 |
| `packages/solidcash/test/per-call/receipt/` | `solidcash` | 8 |
| `packages/solidcash/test/per-call/queue/` | `solidcash` | 3 |
| `packages/solidcash/test/per-call/records/` | `solidcash` | 7 |
| `packages/solidcash/test/per-call/deploy/` | `solidcash` | 116 |
| `packages/solidcash/test/per-call/call/` | `solidcash` | 7 |
| `packages/solidcash/test/per-call/time/` | `solidcash` | 7 |
| `packages/solidcash/test/per-call/hostile/` | `solidcash` | 79 |
| `packages/solidcash/test/per-call/shapes/` | `solidcash` | 112 |
| `packages/solidcash/test/per-call/edges/` | `solidcash` | 41 |
| `packages/solidcash/test/per-call/primitives/` | `solidcash` | 12 |
| `packages/solidcash/test/per-call/toys/` | `solidcash` | 80 |
| `packages/solidcash/test/per-call/conformance/` | `solidcash` | — not written |
| `packages/testing/test/per-call/` | `@solidcash/testing` | 2 |

Total: 1448 checks (115 + 507 + 824 + 2), with one more case that runs under `PER_CALL_FULL=1` (the
twenty-four-master composition, which takes about twenty-eight seconds to derive). The package totals are full-config runs of
`vitest.per-call.config.ts`: `solidc` 507 is the four rows above it, `solidcash` 824 (823 passed, one skipped) is the
seventeen rows above it,
and `@solidcash/testing` is its own row and drives the layer's public entry points rather than the SDK's.
A row is refreshed by rerunning its directory, not by carrying a number forward. A new case belongs in one
place: before adding a refusal, check whether `validator/script.test.ts`, `master-program.test.ts` or the file of
the shape it mutates makes it.

## The call-edge catalog (spec section 22)

Every edge the catalog names, with the named test that exercises its shape on this path today. Until the project
compiles here, a market edge is carried by a neutral replica of its shape; a row whose shape no replica carries
says what is missing.

| Edge (spec 22) | Kind | Exercised today by |
| --- | --- | --- |
| a static scalar read of another contract | `STATIC` | `reads/reads.test.ts`, `reads/nested.test.ts`, and the composed static call in `validator/script.test.ts`. The state-variable form (`ICounter(c).counter`) is refused by name in `edges/reads-and-loops.test.ts` |
| a static read once per tag in a loop, with a `string` | `STATIC` | the loop half by `edges/reads-and-loops.test.ts` (a run-time trip count with one call site settles one iteration; a branch over the call is refused by name), and a static callee that refuses stalls the derivation there too. A `string` crossing the edge has no replica yet |
| a call appending to one array entry, once per change, in a loop | `CALL` | `toys/same-entry-appends.test.ts` (one entry, one record across the frames, one event per append) and `edges/records-growing.test.ts`. The struct-with-two-`bytes` argument is not carried: a run-time struct argument is refused by name (`edges/refused-contract-shapes.test.ts`) |
| a call the callee itself refuses on a bad value, with a `string` | `CALL` | `reverts/innermost-revert.test.ts` reports the innermost refusing frame and its custom error. A `string` argument has no replica yet |
| a low-level token call (`abi.encodeCall` / `abi.encodeWithSelector` + `address(t).call`) | low-level `CALL` | refused per body with its reason measured, beside the typed call that is served (`edges/refused-contract-shapes.test.ts`, `toys/fan-in.test.ts` for the typed `transferFrom` shape) |
| a static `balanceOf` read of a token | `STATIC` | the view-function form is served as above; a token's `balanceOf` has no replica yet |
| a payable call with value 0 carrying a struct and returning a value | `CALL` | the return-consumed-by-a-later-call half by `toys/result-into-later-call.test.ts`. A value send is refused at compile by name, and a run-time struct argument likewise (`edges/refused-contract-shapes.test.ts`) |
| a call before the caller stores its own record (a write after a call) | `CALL` | `edges/writes-after-call.test.ts` |
| a token call in the token's own low-level spelling | low-level `CALL` | as the low-level row above |
| a callee that is re-entered while its caller runs | `CALL` | `toys/reentry.test.ts` |
| a static read that re-enters a contract whose write is still running | `STATIC` | `toys/reentry.test.ts` reads the record its caller just wrote; the stale-read direction is refused in `hostile/stale-view.test.ts`, and the struct-with-a-`string` return has no replica |
| a re-entering call that passes because a guard field is still set | `CALL` | `edges/reentrant-guard.test.ts` |
| a re-entering call in a loop, one per computed share | `CALL` | `edges/repeated-callee.test.ts`: two turns settle and the callee's record chains across them, while a plan declaring fewer call records than the turns stalls by name. A run-time-trip-count loop with a per-turn value argument is refused by name |
| a call gated on `tx.origin` rather than `msg.sender` | `CALL` | `edges/nested-authority.test.ts`; the forged `originRef` directions are refused in `hostile/origin-reference.test.ts` |
| a static read of a flag the same transaction just wrote | `STATIC` | `frames/round-trip-stateful.test.ts` and `edges/deep-chain.test.ts` chain a record's writes across frames; the read of a flag written by a deeper frame has no replica |
| a call that needs a later block than its payment | `CALL` | `time/time-gated.test.ts` |
| a deep call chain whose result returns up several frames | `CALL` | `edges/deep-chain.test.ts` for the chain, `toys/reentry.test.ts` for a value read back up two frames. The `uint256[5]` return has no replica (a tuple return is carried by the re-entry toy) |
| a view that calls views on another contract, returning a struct with `string[]` | `STATIC` | `reads/nested.test.ts` (a two-frame read) and the read path's own replicas in `reads/nested-reads.test.ts`. A `string[]`-carrying struct return has no replica |

The proxy hops of the catalog are exercised as their own rows: a user's call into a proxy that `DELEGATE`s into its
implementation by `toys/proxied-entry.test.ts`, `toys/proxied-appends.test.ts` and `shapes/proxied-registration.test.ts`,
and the binding of a delegate callee to the implementation the record names by `hostile/delegate-target-binding.test.ts`.

## What each directory covers

- **`utils/test/per-call/`** — the wire formats and the pure derivations, driven through their exported functions:
  witness-block and transcript round trips, exact-length rejection (bad magic, unknown version, unknown frame kind,
  root recorded as a call kind, absent callee, wrong segment count, truncation, trailing byte), minimal-push
  framing, argument pushes told apart from the redeem script, canonical values and `argsHash`, derived addresses,
  and stop-site coherence. Vectors in `vectors/`.
- **`solidc/test/per-call/master/`** — the compiled master program: its published composition descriptor and slot
  offsets, the frame checks the machine enforces on a real spend (ownership, recreation, hash type, `msg.sender`,
  `tx.origin`, `address(this)`), the witness-block reader, dispatch over one master's entry points, state read and
  written through the frame's declared record views — the walk that recovers them from the witness block, and the
  one that requires every record a segment declares kept unless its code wrote it there, is
  `declared-view.test.ts`, and its run-time-count variant, which resolves a read against the segment the execution's
  own call count names, is `declared-view-runtime.test.ts` and `looped-call-state-read.test.ts` — record settlement across the segments of one execution, the
  returns an entry settles against the frame's `retval`, one head serving bodies that make different numbers of
  calls and each body pinning the block's declared count to its own, call sites and their argument digests, a
  dynamic value's
  chunk run addressed from the frame's declared record block rather than from the master's own input
  (`dynamic-state-record.test.ts`, which lays the block away from the master so a fixed offset would fail), and the
  shapes the generator refuses by name, and the file-level definitions a unit contributes, which the master opens
  after: a declaration-only import leaves the program byte-identical, an unused definition emits nothing, an entry
  that calls an imported definition runs it in the machine, and a definition whose body cannot be outlined is inlined
  at its call sites rather than placed ahead of the head.
- **`solidc/test/per-call/records/`** — proof that the shipped sorted-list, covenant-helper and state encoders
  implement the record semantics the design assumes: exact read, absence by strict predecessor on the masked slot,
  insert with a relinked predecessor, update in place, delete as the default value, composite keys for nested
  mappings, and the value-tail thresholds. Expectations are built independently of the code under test, and one
  divergence was found (see the plan's Log).
- **`solidcash/test/per-call/validator/`** — one hostile test per check, the golden re-entrant composition with its
  transcript and derived order, a seeded differential harness requiring the derivation and the independent
  reference model to agree on accept and reject, and a structural check that masters are identified by category and
  capability rather than by locking bytecode.
- **`solidcash/test/per-call/composer/`** — the resumable derivation (one program run per published site, no
  fixpoint), a re-entrant chain derived callee-first, witness and transcript assembly, block layout for the shapes
  the design lists — including the trailing outputs a plan states that no input recreates — and the refusals. The
  record plans a write needs live here too: `mapping-plan.test.ts` derives the nodes a sorted-list write touches,
  and `chunk-plan.test.ts` derives a dynamic value's length header and chunk commitments and lays the run out at
  the index the layout gives it, each read back through the shipped codecs (`decodePushdataValue`,
  `parseChunkCommitment`) and each refused shape named.
- **`solidcash/test/per-call/deploy/`** — the deployed side: the master program's filled slots and published
  offsets, the master and validator pools, the genesis state a constructor's own frame computes (including the
  events a constructor emits), the record discovery a deployed contract is read through - the token category is
  enumerated and each UTXO's capability and commitment classify it as a master, a validator or a record at its
  state index - and a proxy deployment in three transactions, whose third is an `initialize` delegate hop the
  composer plans and the shipped derivation fills. `proxy-initialize-write.test.ts` drives that hop when the entry
  *writes*: the state it leaves is read back out of the machine rather than stated in advance, the record keeps the
  implementation's address, a second call offered the record the first one left is refused beside a control that the
  same plan offered the state the entry expects is accepted, and a proxy whose record does not declare the
  implementation's fields is refused by name.
- **`solidcash/test/per-call/frames/`** — the master prologue and the witness-block reader, evaluated in the BCH-2026
  virtual machine against real transactions, and, in `composition-spend.test.ts`, one composed transaction driven
  from source to verdict: shipped compile, shipped deployment, composer layout and assembly, derivation, and the
  machine's acceptance of the caller, its callee and the validator, twice on the same bytes, with two mutated
  controls refused. `round-trip-composition.test.ts` derives the two-contract round trip the design's worked
  example uses end to end: the layout places the two masters of
  the re-entered contract, the validator and the callee; the shipped host fills every published stop site, callee
  first (`A.k`, then `B.g`, then `A.f`); the machine accepts all four contract inputs of the assembled transaction,
  twice with the same verdict; and the validator's own derivation walks all eleven checks and derives the order the
  spec states for the shape. Controls refused: a re-entered master presenting another contract's address, and a
  block that declares a call its entry's source does not make. `round-trip-stateful.test.ts` carries the same shape
  with records on both contracts, and it is the evidence the plan's first milestone asks for: `A`'s one record is
  written by the entry twice and by the re-entered entry between them, every frame reads and closes against its own
  segment's declaration, the derivation completes callee-first, every contract input is accepted, the validator's
  derivation accepts all eleven checks in the spec's order, each record's output carries the commitment its last
  declaration wrote, and four controls are refused. `round-trip-stateful.test.ts` also emits from the entry, so its
  transaction is spec 5.2's output set complete (the event at 6, the change at 7); its validator input used to be
  refused at the operation-cost density its own script sets, and the program's padding block is what makes it
  accepted now, which the case asserts with the numbers beside it.
  `round-trip-events.test.ts` states the same shape without records on both contracts: the derivation completes, every
  master accepts the transaction as derived, an event payload its listing entry did not compute is refused, an
  own-category NFT no frame lists is refused at a single-master contract and accepted at a shared one (the union
  census is the validator's, and is not emitted yet), and a plan that leaves an emitting entry's event unstated cannot
  be derived. `chunk-run.test.ts` composes a plan whose value lives in chunks: the run is laid out one layout width
  past the block's data NFTs, the derivation completes and the machine accepts the master that wrote it, with the
  header and chunk outputs carrying the commitments the plan computed and the segment declaring both records;
  moving the run one participant further on is refused, as is a chunk output carrying a commitment or a lock the
  body did not compute.
- **`solidcash/test/per-call/reads/`** — reading a deployed contract off chain through `readPerCallEntry`: a `STATIC`
  root is planned over the live records the deployment layer classifies, the value the entry computed is learned
  from the frame's own return comparison, the composition is derived, and the value is returned decoded. The read
  back is driven against a record an earlier accepted composition wrote, the provider's transaction count is
  asserted unchanged, a refusing entry reports the machine's objection, and the validator reference's own verdict on
  a read-only root is pinned. `nested.test.ts` drives a read whose root calls another contract's `view` entry: the
  callee's value is learned first and written into the caller's call record, both frames and the record accept, and
  the shipped derivation completes callee first. `time-gated-challenge.test.ts` is a flow replica: a root whose
  judge reads the escrow's recorded payment block in a read-only frame, gates on a strictly later block and calls the
  escrow's own entry — every contract input accepted, the machine's `OP_CHECKLOCKTIMEVERIFY` refusal at the payment's
  own block pinned. The same composition over one data-NFT state record settles too: the frame that only reads it
  closes against its own declaration rather than the transaction's output, so a frame that reads a record another
  frame writes in the same transaction is served (with a record output no frame computed refused by the validator). `revert-partway.test.ts` is the other one: a root
  whose own check fails after an earlier call succeeded, a nested callee's failing check reported as the innermost
  frame with its source line, and a revert with a declared error, whose arguments the compiler type-checks and does
  not evaluate (its own warning is asserted).
  `nested-reads.test.ts` drives the same shape through the module
  itself: the caller names the other contracts in `externals`, a view that reads a view returns the composed value
  with nothing broadcast, a three-contract chain returns the leaf's value, a nested refusal reports the innermost
  callee frame and builds nothing, and an entry calling a contract the caller did not supply is refused by name.
- **`solidcash/test/per-call/reverts/`** — a composition the machine refuses, reporting the *innermost* frame's
  reason: the refusing frame is found by asking the machine for a verdict on every frame of the draft, its depth is
  read from the assembled caller references, and its reason names the frame, the source line and the custom error the
  artifact publishes (name and declared parameters). A nested revert reports the callee rather than the caller, both
  frames are reported when both refuse, and the provider is asserted to have seen no transaction.
- **`solidcash/test/per-call/receipt/`** — the logs a composition's events make: each listed event output is matched to
  the event its covenant declares and reported with the emitting contract's `addrV(category)`, the fields keyed by
  parameter name and in declared order, including an event a nested frame emitted (reported with the callee's address)
  and an anonymous event (disambiguated by its covenant). `listeners.test.ts` delivers those logs to handlers
  registered per emitting address: a handler sees only its own contract's event, a nested emitter's log reaches its
  own contract's handler, and a removed handler receives nothing.
- **`solidcash/test/per-call/queue/`** — sends that could touch the same masters, validators or records are
  serialized by `CompositionQueue`: each send holds its resources from the moment it is enqueued, so a later send on
  one of them resolves its plan only after the earlier one landed, and two sends with disjoint resources run
  together. Each case broadcasts through the mock provider on the masters' real outpoints, so the assertions are
  about the provider's live UTXO view: the second send on one master spends the output the first created while the
  original outpoint is gone, and a refused broadcast leaves a disjoint send and its own overlap successor free.
- **`solidcash/test/per-call/records/`** — a stateful composition whose record sits away from the master that reads
  it: the record is declared once per segment, the chain runs from the commitment the transaction spends to the one
  it writes, the plan states the output that carries the new commitment, and the machine accepts the master's own
  input. The control removes the declarations, and the same transaction is refused by the body's read and by the
  derivation. `partial-write.test.ts` drives a record with more fields than the frame writes: the field the body does
  not touch comes back out of the spent commitment, and the same program and witnesses with only the output
  commitment changed to the one a write that dropped that field would leave are refused.
- **`solidcash/test/per-call/hostile/`** - spends that must be refused, each beside the faithful spend it mutates
  and each decided by the machine: loose funds at a master's lock, a master not recreated in place, a covered
  master presenting an address its category does not derive, a validator UTXO carrying no token or another
  category's, a call record naming the wrong input or carrying the wrong argument digest, a declared record the
  transaction does not spend, a second signed user offered as the origin, a root whose sender is rewritten while a
  validator covers the edge, and the validator-program cases `validator/script.test.ts` does not make: a missing
  or non-recreated validator output, a covered witness block with a trailing byte or cut short, and a read-only
  frame that changes a record, emits, or calls with value or into a frame that is not read-only, a proxied call
  whose delegate callee is not the contract the caller's record names (refused by the derivation, by the reference
  checker and by the shipped validator program), and a record declared changed in a segment its frame's code
  does not write it in. The validator
  program's per-rule refusals are `validator/script.test.ts`'s, one per rule it emits; the table below maps each
  attack to the file that refuses it.
- **`solidcash/test/per-call/primitives/`** — one case per primitive a flow shape is made of, driven on the shipped
  path: a `pure` callee reached as a `STATIC` frame that takes a fixed-size array argument and returns one (the
  caller's call record carries the result and it decodes back through the shipped decoder, while a fixed-size array
  argument built at run time is refused by name), `uint16[2]` / `uint16[4]` / `int16[2]` arguments and a computed
  `uint16[5]` return in and out, and one contract's two entries each emitting an event in one transaction, both read
  back through the shipped receipt.
- **`solidcash/test/per-call/edges/`** — one dedicated test per row of the spec's edge-case table (section 23) that
  the shipped language subset can express: a record written on both sides of a call, a reentrancy guard crossed by
  re-entry, `tx.origin` and `msg.sender` authority on a callee, events above the commitment size emitted by a
  nested frame, two events at distinct outputs, a static read of state another frame just wrote, a data-dependent
  call count, a record growing within one transaction, a four-deep call chain, and a named refusal for every row
  the compiler or the composer still refuses (inline assembly, low-level calls, value sends, function-pointer
  returns, `ecrecover`, dynamic mapping values).
- **`solidcash/test/per-call/toys/`** — the small compositions the design lists. Each is driven to the machine
  where the shipped path supports it and otherwise refused by name: a repeated call to one target, the sorted-entry
  insert/update/delete lifecycle, a read's result fed into a later call (settled when the value is one the running
  code holds; a root that takes its own argument and a later call mixing a compile-time argument are refused with
  the rule named), a fan-in through an allowance, settled (one node read and rewritten across two frames of one
  contract, each frame closing against the value its own declaration carries), the identity expectations the EVM
  sets for a self call, and the re-entry shape, pinned on the wall it names (a master that calls cannot carry a
  verified-mapping write, so the vault's writing entries are refused before any run is built), a proxy whose
  fallback forwards its own call data to an implementation it holds (compiled and composed, with the derivation
  settled: the proxy master, the implementation master and the validator are accepted), a proxied entry that is
  itself stateful and calls a third contract (three masters plus the validator and the record, every input accepted,
  two controls refused), and a dynamic value whose first
  write creates its run beside one event per append (settled, with the created chunk's output, the header and each
  event read back through the shipped encoders).
- **`solidcash/test/per-call/shapes/`** — the compositions the same scripts and the same builder have to serve,
  including one entry that keeps its contract's data-NFT record and writes a mapping batch
  (`record-with-mapping-write.test.ts`): the derivation completes, every contract input is accepted, the created
  node's output carries the commitment the shipped encoder materializes and the rewritten head and read node carry
  the shipped planner's commitments, with a control (a record output no frame computed) the validator refuses and
  the same plan with its state record declared behind the mapping groups refused,
  laid out and derived through the shipped composer and settled in the machine where they are supported, with the
  shapes the generator still refuses asserted as refusals by name. The chain that calls back to its head (head to
  middle to tail, tail back to the middle, middle back to the head) settles with every contract input and the one
  validator accepted, and the plan that leaves the user-entered multi-entry root without the selector its dispatcher
  consumes is pinned as the stall it produces. `mapping-values.test.ts` settles a `mapping(string => string)`
  set, a long value read from the frame's value list (a forged and a missing value stall) and a long value
  written with its value chunks (an altered chunk and a record past them stall), and
  `initializer-batch.test.ts` an initializer's record write, eight inserts into an empty mapping and event as one
  sorted batch (a chain that skips the other keys stalls, and so does a created record no write made), and
  `mapping-write-beside-calls.test.ts` an award written before two calls and one written after them, each as an
  update and as an insert, with the node kept in the segments the write is not in (a node declared changed and
  back between the calls, changed before the write, or created before the write it belongs to stalls), and an
  entry that never touches the mapping stalls with another node declared rewritten.
- **`solidcash/test/per-call/time/`** — time as the transaction's own field: a `require(tx.time >= n)` gate compiled
  per-call and driven from a payment's block time, read through the mock chain's strictly-advancing clock and the
  deployment layer's `providerUnixLocktime`. The earlier and the later transaction settle with every frame reading
  the one locktime the plan fixed before any derivation ran, the payment's own block is refused by the machine under
  the name of the check, a plan whose locktime is already too early stalls the derivation, a final sequence disables
  the gate, and a genesis whose constructor gates on time is refused by the constructor probe.

## Which refusals cover which attack

Every row below is a case the BCH-2026 machine refuses, beside the faithful spend it mutates. A bare file name is in
`hostile/`; a case another suite already makes is cited there instead of repeated. Attacks no suite covers yet are
listed under the table, and none of those is claimed anywhere else.

| Attack (the plan's threat list) | Case |
| --- | --- |
| Execute on a non-master UTXO: loose funds at the lock, a foreign category, or the right category without the minting capability | `master-recreation.test.ts` (three cases) |
| A master drained, duplicated or not recreated in place: output token, category, capability, commitment, lock or value | `master-recreation.test.ts` (six cases) |
| A forged call edge: a recorded callee that is not the covered callee the call ran, or an argument digest that is not the callee's call data | `call-record.test.ts` (two cases) |
| A forged or missing event: payload, lock, token presence, capability, output position, or a body that emits a value the output does not carry | `solidc/test/per-call/master/event-output.test.ts` (the compiled entry's refusals) |
| A state UTXO spent outside settlement, a declared record the transaction does not spend, or a declaration that does not chain from the spent commitment to the written one | `record-census.test.ts` (the undeclared spend) and `solidc/test/per-call/master/record-settlement.test.ts` (three cases) |
| A validator UTXO that is not the mutable NFT its own script pins (minting token, no token, another category) | `validator/script.test.ts` (minting token) and `validator-program.test.ts` (two cases) |
| A covered master presenting an address its category does not derive | `validator-program.test.ts` (one case, isolated through a delegate composition so the address rule and not an earlier edge rule is what refuses) |
| A second signed user offered as the origin reference | `origin-reference.test.ts` (two cases) |
| A root frame whose `sender` is rewritten while a validator covers the edge | `caller-lock-binding.test.ts` (one case, refused on the caller's own input while the validator and callee still accept) |
| Part of a covered contract left unsettled | `validator/script.test.ts` (one case) |
| A validator transcript or a covered witness block the shipped program cannot read | `validator/script.test.ts` (nine cases) and `validator-transcript.test.ts` (a block with a trailing byte or cut short) |
| A validator output missing, not recreated, or carrying less value, or no master of its own category | `validator-recreation.test.ts` (missing, not recreated) and `validator/script.test.ts` (two cases) |
| A transcript listing masters that point elsewhere, are duplicated or are missing, and roots that are duplicated, missing or extra | `validator/script.test.ts` (twelve cases, the two-root composition accepted beside them) |
| A forged call edge in either direction: callee, caller, frame kind, origin, value, sender, target, self, result, argument digest, an unreached master, or a master called twice | `validator/script.test.ts` (thirteen cases) |
| A contract settled twice, or a read-only frame changing a record, emitting or paying an output | `validator/script.test.ts` (settled twice, paying) and `validator-settlement.test.ts` (changing a record, emitting) |
| A read-only frame whose call carries value or names a frame that is not read-only | `validator-read-only-calls.test.ts` (three cases) |
| A record declaration that reads a view an intervening write has already passed (a stale read) | `stale-view.test.ts` (one case) |
| A record declared changed in a segment its frame's code does not write it in: a data record, another key's mapping node, a batch node outside its write's segment, or a guard shown unset between its two writes (T43, T44) | `unwritten-record-change.test.ts` (five cases) and `shapes/mapping-write-beside-calls.test.ts` (five cases) |
| A standalone master whose reserved address slot is filled with an address its category does not derive | `standalone-address-slot.test.ts` (one case refused; a slot and a presented address that agree on a foreign address are accepted there, which is the residual only the deployment gate recomputes) |
| One contract's masters split across two validators | `validator-split-view.test.ts` (one case, with a second validator input beside the first) |
| An extra call naming an already-used signed input (the call-receipt residual) | `reused-signature.test.ts` (recorded as accepted, so adopting receipts flips it) |
| A proxy's call the contract does not hold the target for: a fallback beside ordinary entries, a receive, a delegatecall whose data is not the entry's own received call data, a target the contract does not hold | `proxy-binding.test.ts` (each refused at compile by name) |
| A standalone master entered by a contract's input rather than a user's | `standalone-caller-contract.test.ts` (refused, with the attribution controls: the same forge is refused whether the frame claims that lock or the user, and a token behind a user lock is accepted) |
| A proxied call whose delegate callee is not the implementation the proxy's own record names | owed, and now testable: the forwarded hop settles in the machine (`toys/proxy.test.ts`), so the record's target can be mutated against it — no case yet |
| A master whose declared segments are out of order | `reordered-segments.test.ts` (the derivation refuses `V7_CHAIN_START_MISMATCH`; the program's order-free chain walk accepts, which the case pins) |
| Two frames that list the same event output | `shared-event-output.test.ts` (the composer refuses the plan's shared list, and a mutation of the assembled spend is refused by the derivation and the program alike) |

Not covered by `hostile/`, and not claimed by any other directory: a witness selecting a `catch` branch, which no
witness can express: the block carries no branch field and the compiler makes every catch a no-op. A value send made
as a plain output is refused at compile by name, and that refusal is already made in
`edges/refused-contract-shapes.test.ts`; no compiled master fixes a send, so there is no spend to mutate.

## The shape the path currently carries

Both sides of a composition compile and are spent in a test: a caller and the callee it reaches, co-spent with a
validator, assembled by the composer from a plan the test supplies no geometry for. A compiled stateful master
reads and writes its record through the indices its own frame declares, chains those declarations across the
segments of one execution, and settles a record that sits away from it. A compiled master whose state is a `string`
addresses its value's chunk run from the same declaration and settles a read-modify-write of it in the machine.
The head parks the frame's record-block base once and each body adds the width of its own layout, so bodies whose
layouts place the run at different widths share it, and a body that touches a dynamic value beside an external call
resolves the run against the segment its own calls have reached; a body whose sorted-mapping write a call precedes
and a send whose recipient lock is a run-time value are still refused by name.
The validator is an emitted program (`packages/solidc/src/per-call/validator/program.ts`) that emits rules spanning
all eleven checks, and every rule it emits has a machine-level hostile rejection beside an accepted composition.

## What is not covered

- The marketplace harness is pointed at `composition: 'per-call'`, and the project compiles there. The fixture runs
  to its own deployment; the proxy that deployment generates keeps its address in a record of the proxy's own (the
  EIP-1967-style slot the spec's open point 5 names) rather than among the implementation's fields, and the
  deployment plans every record a proxy's layout declares — driven end to end on the marketplace roots' shape (an
  isolated field beside an implementation that declares nothing about its proxy) by
  `deploy/generated-proxy.test.ts`. The fixture itself is not run until I2b, per rule 4.6. A compiled unit whose own bodies, or whose
  reached definitions, carry inline assembly is still refused by name, and so is a body
  that writes a mapping in a shape whose records the master cannot read back from its own frame — a frame that keeps
  a data-NFT record and writes a mapping batch settles, as a user-entered root and behind a proxy hop. One target written
  in place, a whole multi-target batch, the read of the entry the write targets, a composite key, several
  collections in one body, and the sender and compile-time key forms are now derived, planned and settled, and a body now pins its own event count against the head's region, so a
  constructor that emits shares the head. A file-level definition is no longer a wall either: the master opens after
  the definitions its unit contributes, and the shapes a definition could carry that the head cannot serve are the
  ones the compiler never outlines. A `string`-valued state variable is no longer a wall by itself, and the composer now supplies the band: the
  head derives the chunk run's coordinate from the frame's declared record block, `planChunkRun` derives the header
  and chunk commitments and `layOutChunkRun` places the run one layout width past the block's data NFTs, and a plan
  built that way derives with the machine accepting the master that wrote the value (`frames/chunk-run.test.ts`).
  What no plan lays out is a write that changes the run's width: creating or deleting chunks is refused by name
  (`PER_CALL_CHUNK_UNPLANNABLE`). The compile is read the same way each round —
  `node --max-old-space-size=8192 packages/testing/dist/cli.js compile --jobs 4`, after `yarn build`, because the
  harness compiles the built compiler rather than the sources. At `d63d2fc3b` its first reported failure was
  `unicrow/UnicrowClaim.sol`'s `claimMultiple`: a loop of calls whose body also reads the state of the contract it
  runs on, where the segment a read resolves against is a number only the execution knows. The declared-view walk
  takes the running execution's own counts now, so the project compiles end to end — nine sources, seven artifacts,
  no failure. The fixture runs to its own deployment and stops there: the deployment generates a proxy from the
  implementation's declaration, and `MarketplaceV1` declares no `implementation` field, so the proxy is refused by
  name. The generator now mirrors an implementation whose layout holds a field the compiler keeps in a record of its
  own; what the fixture needs is the home of the address — the EIP-1967-style slot the spec's open point 5 names, a
  trailing record of the proxy's own, which the deployment's layout agreement does not yet admit. A title count is
  not claimed until that lands.
- A master's bodies may declare different numbers of call records: the walk reads the count the block declares and
  the body that runs pins it to its own, so a contract entered twice — once as a caller and once as a plain state
  write — is emitted and deploys, and a block declaring a count no body makes is refused at the caller. The
  composition of such a shape is derived and settled too, when both entries' sources make the calls their blocks
  declare: `frames/round-trip-composition.test.ts` reaches a machine verdict on every contract input and the
  validator decides all eleven checks. A contract the transaction settles while spending none of its state — several
  covered masters, no records of its own — is stated by an empty state-input list in the transcript, which the codec
  and the shipped program both carry. What the round trip does not carry is the spec's output set: its two contracts
  keep no records and emit no events, so an event output and a value send have no supplier in the composer. A
  contract that emits inside one of two entries is admitted (the event region is sized by the contract's own bodies),
  and the round trip that emits derives: the census a body makes over its contract's own-category immutable NFTs
  admits only what its own block lists, so it stands down while another master of the same category is in the
  transaction, which is the same run-time test the record settlement uses. What that leaves is V7's union census: for
  a shared category nothing refuses an own-category NFT at an unlisted output, and a test pins that. A
  record written by more than one frame in a transaction is no longer a wall: a body reads its own segment's
  declared `viewIn`, closes against the commitment its segment declared, and resolves a field written before an
  external call from the declaration rather than its own stale value, so the worked shape settles end to end. What
  remains of that work: the close is emitted where the end-of-body rebuild runs, so a frame that writes a record
  early and leaves it untouched later does not prove that early value against that segment's declaration; a record
  whose index changes between segments is not followed; and dynamic chunks still resolve against the transaction. A
  master whose witness block carries both a call section and an event list stalls the derivation, which is the one
  wall between the round trip's output set and spec 5.2 — with the selectors the entries dispatch on, it stops at the
  re-entered entry's own program rather than at the entry's call site. Delegatecall, mapping records and value
  sends are refused by name as before.
- The validator program emits rules spanning all eleven checks; four of them (`V2`, `V5`, `V6`, `V7`) are not
  complete — the ordering half of `V6` and most of `V7`'s settlement rules are carried by record chains rather than
  emitted — and a handful of rules in the derivation's reason list have no counterpart in the program.
- Every VM acceptance in these directories runs with the standardness flags relaxed; the operation-cost density is a
  consensus rule and applies there too (see `GATE_REPORT.md`). Measured at `7c76dcef4` on the reference composition's
  shape at the published density: the budget is `800` per byte of the validator input's own unlocking bytecode, which
  is 4,765 bytes there, and the program spends 3,201,534 of the 5,452,000 those bytes buy. Before the program carried
  its padding block the same measurement was 3,142,116 of 3,812,000 — 17% of headroom, and 64 units over on the
  emitting round trip's shape — so a rule added next had 37,832 units to fit in. The headroom is now 41%, the
  padding test asserts it is more than half of what the padding itself buys, and the emitting round trip's validator
  input is accepted rather than refused. What is still open is marketplace size: the padding is a fixed block, so a
  composition whose own program and transcript approach the ten-thousand-byte limit on an unlocking bytecode needs
  the walk itself to read each covered master's unlocking bytecode once rather than once per check, and it does not
  yet.
