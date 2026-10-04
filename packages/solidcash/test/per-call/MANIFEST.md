# Focused test directories

One directory per stream, plus the shared interface vectors. A stream's directory is the only suite it runs while
it is being written; the whole-repo suite runs at milestones.

Run a package's focused suites, or one directory of them, with its per-call config:

    yarn workspace solidc vitest run --config vitest.per-call.config.ts [<directory>]
    yarn workspace solidcash vitest run --config vitest.per-call.config.ts [<directory>]
    yarn workspace @solidcash/testing vitest run --config vitest.per-call.config.ts [<directory>]
    yarn workspace @solidcash/utils vitest run test/per-call

Vitest does not check types. Check the `solidc` and `solidcash` per-call tests from the repository root with
`npx tsc -p tsconfig.per-call-tests.json`.

The per-call configs keep transpiled modules on disk between runs (`test.experimental.fsModuleCache`), skip
per-file isolation and turn on the compiler's deterministic compile cache. Measured at `6f8d4b5ec`: `solidc`
16.8 s with the package config, 13.3 s on a first run and 7.5 s on a repeat; `solidcash` 56.6 s, 22.1 s and
10.5 s. An edited file is transpiled again on the next run; if a run ever looks stale, `npx vitest --clearCache`
empties the cache. New tests should still compile each source once per file.

The generated program-versus-derivation check in `validator/script.test.ts` runs three cases per mutation by
default. `PER_CALL_FULL=1` restores its full 400-case sample; use it at milestones.

| Directory | Package | Tests |
| --- | --- | --- |
| `packages/utils/test/per-call/` | `@solidcash/utils` | 119 |
| `packages/solidc/test/per-call/master/` | `solidc` | 993 |
| `packages/solidc/test/per-call/records/` | `solidc` | 36 |
| `packages/solidc/test/per-call/validator/` | `solidc` | 22 |
| `packages/solidc/test/per-call/machine.test.ts` | `solidc` | 3 |
| `packages/solidcash/test/per-call/validator/` | `solidcash` | 95 (94 by default, 1 skipped) |
| `packages/solidcash/test/per-call/composer/` | `solidcash` | 171 |
| `packages/solidcash/test/per-call/frames/` | `solidcash` | 78 |
| `packages/solidcash/test/per-call/reads/` | `solidcash` | 57 |
| `packages/solidcash/test/per-call/reverts/` | `solidcash` | 21 |
| `packages/solidcash/test/per-call/receipt/` | `solidcash` | 9 |
| `packages/solidcash/test/per-call/queue/` | `solidcash` | 4 |
| `packages/solidcash/test/per-call/records/` | `solidcash` | 7 |
| `packages/solidcash/test/per-call/deploy/` | `solidcash` | 211 |
| `packages/solidcash/test/per-call/call/` | `solidcash` | 314 (310 by default, 4 skipped) |
| `packages/solidcash/test/per-call/time/` | `solidcash` | 12 |
| `packages/solidcash/test/per-call/hostile/` | `solidcash` | 171 |
| `packages/solidcash/test/per-call/shapes/` | `solidcash` | 93 |
| `packages/solidcash/test/per-call/edges/` | `solidcash` | 77 |
| `packages/solidcash/test/per-call/primitives/` | `solidcash` | 9 (6 by default, 3 under `PER_CALL_FULL=1`) |
| `packages/solidcash/test/per-call/toys/` | `solidcash` | 81 |
| `packages/solidcash/test/per-call/conformance/` | `solidcash` | 138 (136 by default, 2 under `PER_CALL_FULL=1`) |
| `packages/solidcash/test/per-call/pw7-measure.test.ts` | `solidcash` | 2, under `PER_CALL_FULL=1` |
| `packages/solidcash/test/per-call/ahead/` | `solidcash` | 184, under `PER_CALL_AHEAD=1` |
| `packages/testing/test/per-call/` | `@solidcash/testing` | 11 |

Total: 2734 checks (119 + 1054 + 1550 + 11). Twelve cases in a default `solidcash` run are skipped and run under
`PER_CALL_FULL=1` instead: three in `primitives/many-masters.test.ts` (the nine-entry composition and its refusal,
which `shapes/deep-arbitration.test.ts` covers by default, and the twenty-four-master composition, which takes about
twenty-eight seconds to derive), the shipped data contract's clock-stamped append
(`call/proxy-proxied-callee-element-clock.test.ts`), which deploys the project's compiled `MarketplaceDataV1`
behind its proxy and takes about three and a half minutes, `pw7-measure.test.ts`'s two, and the full-width samplers
the `validator/`, `conformance/` and `call/` rows show. The `ahead/` row's 184 run under `PER_CALL_AHEAD=1`. The
package totals are full-config runs of
`vitest.per-call.config.ts`: `solidc` 1054 is the four rows above it (122 files),
`solidcash` 1550 is the rows above it from `validator/` down, `ahead/` excepted (282 files), every row above
re-measured 2026-10-03 by rerunning its own directory in the same sweep, and `@solidcash/testing` is its own row
and drives the layer's public entry points rather than the SDK's.
The `ahead/` row is outside the totals: its cases are skipped unless `PER_CALL_AHEAD=1`. It was refreshed
2026-10-03 by rerunning the directory (28 files / 184 cases, all green).
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
| a static read once per tag in a loop, with a `string` | `STATIC` | `edges/string-argument-edge.test.ts`: one static call per key the caller passed, a `string` in and a `string` out, the answers joined and emitted by the caller, and an empty key refused on the second turn with the callee's reason, nothing broadcast. The loop's other forms by `edges/reads-and-loops.test.ts` (a run-time trip count with one call site settles one iteration; a branch over the call is refused by name) |
| a call appending to one array entry, once per change, in a loop | `CALL` | `edges/struct-argument-edge.test.ts`: a struct with two `bytes` members and a `string`, passed as it came, built at the site from the caller's arguments, or built from a local the call also passes, appended to one id's array and emitted, one append per transaction; `toys/same-entry-appends.test.ts` (several appends to one entry in one transaction on the composer path, one record across the frames, one event per append) and `edges/records-growing.test.ts`. Not carried through the hop: two appends to one entry in one transaction, pinned as a known wall in `edges/struct-argument-edge.test.ts` (the hop plans each reach of a node whose value chunks from the deployment's value; owner `proxy/external-calls.ts`, `requireSettledNodeChains`) |
| a call the callee itself refuses on a bad value, with a `string` | `CALL` | `edges/string-argument-edge.test.ts`: a `string` argument the callee stores (inline, and past 60 bytes as a chunk run) and emits, the score it returns stored by the caller, and a score the callee's own check rejects refused with its reason, nothing broadcast; `reverts/innermost-revert.test.ts` reports the innermost refusing frame and its custom error; `reverts/proxied-callee-reason.test.ts` reports a score a callee behind its own proxy rejects by its delegate frame's reason, and `reverts/proxied-callee-error-arguments.test.ts` carries the arguments of a custom error such a callee raises |
| a low-level token call (`abi.encodeCall` / `abi.encodeWithSelector` + `address(t).call`) | low-level `CALL` | `edges/low-level-token-call-lowering.test.ts`: both spellings, bound or discarded, lower to the typed call and settle as it does, the `bool` decoded from the returned data; a spelling that names no method statically stays refused by name. The re-raise SafeERC20 writes in inline assembly is refused by name (`edges/refused-contract-shapes.test.ts`) |
| a static `balanceOf` read of a token | `STATIC` | `shapes/fan-in-with-result.test.ts` ("settles the one-call pull"): the escrow reads the token's `balanceOf` before and after its `transferFrom` pull and requires the difference, every contract input accepted |
| a payable call with value 0 carrying a struct and returning a value | `CALL` | `edges/struct-argument-edge.test.ts`: a payable entry entered with value 0 (its body checks `msg.value == 0`), a struct with a `string` argument, and the number it returns stored by the caller; value sends by `call/value-call.test.ts` and `hostile/contract-payment-plain-output.test.ts`, a returned value fed to a later call by `toys/result-into-later-call.test.ts`. Not carried: the market's spelling, the returned value written straight to storage (`job.escrowId = unicrow.pay(...)`), pinned as a known wall in `edges/struct-argument-edge.test.ts`: the compiler publishes that write in the segment before the call, so the entry never settles (owner `solidc/src/per-call/master/support.ts`, `perCallWriteSteps`); the same write through a local settles |
| a call whose own argument is another call | `STATIC` beside `CALL` | `deploy/proxy-nested-argument-call.test.ts`: the inner call's value is fed straight into the outer call's argument list, the compiler publishes the two sites in source order (`[feeOf, apply]`) and the body binds each to its own record, with the sibling that holds the same value in a local first as the control; `deploy/proxy-callee-own-call.test.ts` carries the same reach one level down, a callee that calls a contract and then writes its own record |
| a call before the caller stores its own record (a write after a call) | `CALL` | `edges/writes-after-call.test.ts`, and through the hop `conformance/write-after-call-rows.test.ts` (each write on its own side of the call, read back from the chain) |
| a token call in the token's own low-level spelling | low-level `CALL` | as the low-level row above (the `encodeWithSelector` spelling) |
| a callee that is re-entered while its caller runs | `CALL` | `toys/reentry.test.ts` |
| a static read that re-enters a contract whose write is still running | `STATIC` | `toys/reentry.test.ts` reads the record its caller just wrote; the stale-read direction is refused in `hostile/stale-view.test.ts`. The values the market's re-entering reads return are carried on a direct edge: a struct holding a `string` by `edges/string-array-return-edge.test.ts`, a `uint16[5]` by `edges/fixed-array-return-edge.test.ts`. Not carried: those values returned by a re-entering read (the hop refuses a contract a call reaches below itself by name, `call/proxy-external-calls.test.ts`; the re-entry toy returns scalars) |
| a re-entering call that passes because a guard field is still set | `CALL` | `edges/reentrant-guard.test.ts` |
| a re-entering call in a loop, one per computed share | `CALL` | `edges/repeated-callee.test.ts`: two turns settle and the callee's record chains across them, while a plan declaring fewer call records than the turns stalls by name; through the hop, `conformance/loop-call-rows.test.ts` pays one share per turn with the turn's own value (not re-entering). Not carried: a loop whose turns a per-turn condition skips (the market's `if (amounts[i] > 0)`), pinned as a known wall in `conformance/loop-call-rows.test.ts` (owner `proxy/external-calls.ts`, `occurrenceCountOf`) |
| a call gated on `tx.origin` rather than `msg.sender` | `CALL` | `toys/identity.test.ts` (a refund gated on `tx.origin`, reached through an intermediate contract) and through the hop `conformance/origin-nested-call-rows.test.ts`; the forged `originRef` directions are refused in `hostile/origin-reference.test.ts` |
| a static read of a flag the same transaction just wrote | `STATIC` | `frames/round-trip-stateful.test.ts` and `edges/deep-chain.test.ts` chain a record's writes across frames; the read of a flag written by a deeper frame has no replica |
| a call that needs a later block than its payment | `CALL` | `time/time-gated.test.ts` |
| a deep call chain whose result returns up several frames | `CALL` | `edges/deep-chain.test.ts` for the chain, `toys/reentry.test.ts` for a value read back up two frames, and `edges/fixed-array-return-edge.test.ts` for the `uint256[5]` return: five words, past 128 bits, checked, stored and emitted by the caller, which reverts after the return when its own check fails, nothing broadcast |
| a view that calls views on another contract, returning a struct with `string[]` | `STATIC` | `edges/string-array-return-edge.test.ts`: a struct holding a `string`, a `string[]` and a number, and a bare `string[]`, returned to a caller that reads their lengths and elements through the hop, and to a view that calls a view through the shipped read path; `reads/nested.test.ts` and `reads/nested-reads.test.ts` for the read path's frames. Not carried: a callee view that reads its own stored dynamic field, answered through the read path, pinned as a known wall there (no chunk run is declared for a field the entry publishes in `dynamicReads`; owner `per-call/read/read.ts`); the hop serves the same view |

The proxy hops of the catalog are exercised as their own rows: a user's call into a proxy that `DELEGATE`s into its
implementation by `toys/proxied-entry.test.ts`, `toys/proxied-appends.test.ts` and `shapes/proxied-registration.test.ts`,
and the binding of a delegate callee to the implementation the record names by `hostile/delegate-target-binding.test.ts`.
A read-only entry of a proxy handle is read at the proxy's category, the implementation's artifact being the code the
frame runs, by `reads/proxied-root-read.test.ts`.

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
  `parseChunkCommitment`) and each refused shape named. `keccak-side-car.test.ts` hashes through keccak256 compute
  side-cars: a preimage the entry takes is read from its argument pushes, and one its body computes is learned
  from the body's own bind, a nested call included. `recovery.test.ts` does the same for a recovery pair: a digest
  the body computes is learned with the keccak256 preimage it hashes, and the placeholder pair stands on its own;
  a frame that runs on its caller's records reads every side-car after its own input.
- **`solidcash/test/per-call/deploy/`** — the deployed side: the master program's filled slots and published
  offsets, the master and validator pools, the genesis state a constructor's own frame computes (including the
  events a constructor emits), the record discovery a deployed contract is read through - the token category is
  enumerated and each UTXO's capability and commitment classify it as a master, a validator or a record at its
  state index - and a proxy deployment in three transactions, whose third is an `initialize` delegate hop the
  composer plans and the shipped derivation fills. `proxy-initialize-broadcast.test.ts` drives that hop when the
  entry *writes*: the state it leaves is read back out of the broadcast outputs rather than stated in advance, and
  the record keeps the implementation's address. `proxy-initialize-write.test.ts` refuses a second call offered the
  record the first one left, beside a control that the same plan offered the state the entry expects is accepted,
  and a proxy whose record does not declare the implementation's fields, by name.
- **`solidcash/test/per-call/frames/`** — the witness-block reader, evaluated in the BCH-2026 virtual machine
  against real transactions, and, in `composition-spend.test.ts`, one composed transaction driven from source to
  verdict: shipped compile, shipped deployment, composer layout and assembly, derivation, and the machine's
  acceptance of the caller, its callee and the validator, twice on the same bytes, with a caller that does not
  recreate its own master refused. `round-trip-composition.test.ts` derives the two-contract round trip the
  design's worked example uses end to end: the layout places the two masters of the re-entered contract, the
  validator and the callee; the shipped host fills every published stop site, callee first (`A.k`, then `B.g`,
  then `A.f`); the machine accepts all four contract inputs of the assembled transaction,
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
  `proxied-root-read.test.ts` is the read at a handle that names a proxy: the implementation's artifact is the code
  the frame runs and the proxy's category is where its records sit, so a view reads the proxy's record rather than
  the implementation's own genesis, with the proxy's own address record left unspent.
- **`solidcash/test/per-call/reverts/`** — a composition the machine refuses, reporting the *innermost* frame's
  reason: the refusing frame is found by asking the machine for a verdict on every frame of the draft, its depth is
  read from the assembled caller references, and its reason names the frame, the source line and the custom error the
  artifact publishes (name and declared parameters). A nested revert reports the callee rather than the caller, both
  frames are reported when both refuse, and the provider is asserted to have seen no transaction.
  `proxied-callee-reason.test.ts` drives a `require` inside a callee behind its own proxy through the hop: the
  refusal ends with the delegate frame's own description, whether the frame refuses before its write, before a call
  of its own (its derivation's stall is not the reason) or before a later call the planner refuses.
  `proxied-callee-error-arguments.test.ts` raises a custom error with an address and a uint in such a callee: the
  refusal carries the values it was raised with (`errorArgs`) in each of those ways and when a plan stops to learn the
  refusing call's result, and the testing layer's `revertedWithCustomError(...).withArgs(...)` compares them.
- **`solidcash/test/per-call/receipt/`** — the logs a composition's events make: each listed event output is matched to
  the event its covenant declares and reported with the emitting contract's `addrV(category)`, the fields keyed by
  parameter name and in declared order, including an event a nested frame emitted (reported with the callee's address)
  and an anonymous event (disambiguated by its covenant). `listeners.test.ts` delivers those logs to handlers
  registered per emitting address: a handler sees only its own contract's event, a nested emitter's log reaches its
  own contract's handler, and a removed handler receives nothing. `handle-thread-listeners.test.ts` follows a thread
  kept behind a generated proxy through the contract handle: a listener added on a connected handle is handed the
  indexed id as a bigint and the item by field name, reads a member's key (one `bytes` field of a long struct value)
  from inside its callback, and stays registered on its own instance when the unconnected handle removes it, as
  ethers' listeners do; a page read from an offset returns the items from that offset on.
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
  category's, a call record naming the wrong input or carrying the wrong argument digest, a low-level call's record
  restated with a selector its payload does not name, a declared record the
  transaction does not spend, a second signed user offered as the origin, a root whose sender is rewritten while a
  validator covers the edge, and the validator-program cases `validator/script.test.ts` does not make: a missing
  or non-recreated validator output, a covered witness block with a trailing byte or cut short, and a read-only
  frame that changes a record, emits, or calls with value or into a frame that is not read-only, a proxied call
  whose delegate callee is not the contract the caller's record names (refused by the derivation, by the reference
  checker and by the shipped validator program), a record declared changed in a segment its frame's code
  does not write it in, and a constructor entered again on a live master. The validator
  program's per-rule refusals are `validator/script.test.ts`'s, one per rule it emits; the table below maps each
  attack to the file that refuses it.
- **`solidcash/test/per-call/primitives/`** — one case per primitive a flow shape is made of, driven on the shipped
  path: a `pure` callee reached as a `STATIC` frame that takes a fixed-size array argument and returns one (the
  caller's call record carries the result and it decodes back through the shipped decoder, a fixed-size array
  argument built at run time included), `uint16[2]` / `uint16[4]` / `int16[2]` arguments and a computed
  `uint16[5]` return in and out, and one contract's two entries each emitting an event in one transaction, both read
  back through the shipped receipt.
- **`solidcash/test/per-call/edges/`** — one dedicated test per row of the spec's edge-case table (section 23) that
  the shipped language subset can express: a record written on both sides of a call, a reentrancy guard crossed by
  re-entry, `msg.sender` authority on a callee, events above the commitment size emitted by a
  nested frame, two events at distinct outputs, a static read of state another frame just wrote, a data-dependent
  call count, a record growing within one transaction, a four-deep call chain, and a named refusal for every row
  the compiler still refuses (inline assembly, a low-level call, a function-pointer return, a keccak side-car in a
  loop) beside the shapes now served (a value send, `ecrecover`, a string-keyed string mapping). Beside them, the
  call-edge replicas of spec section 22 that no other suite carried, each a callee deployed on its own and a caller
  behind its proxy driven through the shipped hop (`edge-harness.ts`): a `string` argument stored and emitted, and a
  `string` in and out of a static call per loop turn (`string-argument-edge`); a struct with two `bytes` members and
  a `string` appended to one array (`struct-argument-edge`); a `string[]` returned bare and inside a struct
  (`string-array-return-edge`); and a `uint256[5]` and a `uint16[5]` returned (`fixed-array-return-edge`).
- **`solidcash/test/per-call/toys/`** — the small compositions the design lists. Each is driven to the machine
  where the shipped path supports it and otherwise refused by name: a repeated call to one target, the sorted-entry
  insert/update/delete lifecycle, a read's result fed into a later call (settled when the value is one the running
  code holds, a later call that also passes a compile-time argument included; a root that takes its own argument is
  refused by the composer's call-data rule, in `composer/assemble.test.ts`), a fan-in through an allowance, settled (one node read and rewritten across two frames of one
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
  `block-clock.test.ts` drives the other clock, `block.timestamp`, a register of the contract's own record: the mock
  chain's `evm_increaseTime` and `evm_mine` write the chain's clock into a proxied per-call contract's record (the
  proxy's, under the implementation's layout) and into a plain one's beside a direct contract's, and an entry gated a
  day after its stamp is refused before the day and settles after it.
- **`solidcash/test/per-call/conformance/`** - the reference contexts of `probes/this-call-msg-sender/ref.sol` (S0),
  each row its own contract: compiled with solc and run in `@ethereumjs/evm`, and compiled per-call with Solidity
  compatibility and called through the shipped call path by a user's coin, the answers compared by role (the user
  who entered, or the contract). A row the per-call path does not serve yet is pinned with its refusal beside the
  EVM's answer. The nine single-contract rows so far, and seventeen beyond the file where `tx.origin`, `msg.value`,
  `msg.sig` or `msg.data` is read (`self-call-identity.test.ts`); a selector is compared by the function it selects,
  since the EVM hashes a signature with keccak256 and the per-call dispatcher with SHA-256, and `msg.data` by the
  digests of two reads, since the EVM's calldata and a frame's call data encode a call apart. Beside them, one guard
  per spec-section-23 row the ladder reaches later, each pinning the row's shape served with its observable or
  refused by name: `view-call-revert-rows.test.ts` (19), `string-mapping-rows.test.ts` (24),
  `paired-event-rows.test.ts` (14), `large-event-rows.test.ts` (13, refused: its emitter is at an address no
  deployment holds, with a root-frame control served beside it), `time-window-rows.test.ts` (16),
  `dynamic-argument-rows.test.ts` (12), `balance-rows.test.ts` (10), `low-level-return-rows.test.ts` (11),
  `custom-error-rows.test.ts` (6), `loop-call-rows.test.ts` (4, all served: a call guarded per turn is planned only
  on the turns its guard admits), `origin-nested-call-rows.test.ts` (7), `write-after-call-rows.test.ts` (15, served but
  for a callee's own data-record write, the walls-ahead MS5 row), `record-growth-rows.test.ts` (23),
  `revert-after-calls-rows.test.ts` (5, all seven checks served: the failure reported is the one the execution
  meets first, and a callee's custom error carries its arguments) and `deep-chain-rows.test.ts` (25, its
  twenty-four-master case under `PER_CALL_FULL=1`).
  Beside them `loop-upsert-settlement.test.ts` pins the wall a run-time-loop
  mapping upsert meets on the shipped call path (the machine refuses the frame the path planned itself, while the
  same mapping written once from a parameter settles). The twelve cross-contract rows are
  `cross-contract-identity.test.ts`: A to B, `msg.sender` and `tx.origin` across a `STATIC` frame, the same read
  made by a `staticcall` whose `abi.encodeCall` payload names it, a `call` whose literal
  `abi.encodeWithSignature` payload names no function of B and so runs B's fallback, and A paying B before it reads
  what B's `receive()` recorded (the value call made where A sends), served with the EVM's answer (the call path
  plans callee frames between plain deployments, `call/plain-callees.test.ts`); the other seven each the EVM's
  answer beside the refusal the per-call path meets by name, the fallback call with its signature built at run time
  among them.
- **`solidcash/test/per-call/pw7-measure.test.ts`** - a measurement instrument rather than a regression guard: it
  drives the shipped composer and derivation on Y2, Y6 and the vault graph, counts the machine's own evaluations
  per master, and prints a JSON summary to `PW7_OUT` (default `/tmp/pw7-measure.json`). It runs only under
  `PER_CALL_FULL=1`, and its twenty-four-master case under `PW7_FULL=1` as well. The plan's 4.5 rows carry the
  numbers it produces.
- **`solidcash/test/per-call/ahead/`** - walls ahead: neutral replicas of the later groups' flow shapes, deployed
  behind generated proxies and driven through `callPerCallProxyEntry`, each pinned where it stands and, with its
  first wall stepped around, at the next; the scoreboard's "Walls ahead" table in the plan names each wall and its
  owner. `fan-in.test.ts` (MS3), `reentry-payout.test.ts` (MS4), `origin-gated-payout.test.ts` (MS5),
  `time-gated-challenge.test.ts` (MS6), `deep-arbitration.test.ts` (MS7), `revert-after-calls.test.ts` (MS10),
  `job-threads-and-refusals.test.ts` (L4: posting, thread messages, allowlists and refusals), `job-updates.test.ts`
  (L4: updates, closing, reopening and withdrawing), `call-argument-from-own-write.test.ts` (a call argument read
  from the entry's own write), `packed-address-argument.test.ts` and `packed-integer-argument.test.ts` (a
  struct-field address or an integer packed into a call argument), `block-oracle-beside-array.test.ts` (records an
  entry does not name, and a `view` read of a proxied store) and `read-only-dynamic-records.test.ts` and
  `hop-callee-read-beside-batch.test.ts` (the acceptance cases of the two hop
  changes applied in `2a85cd76f`), `pushed-struct-fields-and-event.test.ts` (a wide struct appended with every field
  written and one payload event, the same entry with a whitelist write its call does not take, and the same entry
  with no guarded write) and `push-length-keyed-mapping-write.test.ts` (a loop write whose key the entry's own push
  computes). The walls beyond the ladder (`docs/per-call/WALLS_BEYOND_LADDER.md`, agent W2) each pin today's
  refusal, titled with what should settle once served: `plain-root-calls` and `plain-root-writes` (a contract
  deployed without a proxy; its two-mapping constructor deploys since `deploy/constructor-loop-writes`),
  `stored-value-keyed-write` (an ERC721 transfer keyed by a node it then writes, and a struct record opened on the
  plain path; keys read out of another mapping are served in `call/stored-value-keyed-write`), `proxied-native-value`
  (a send to a contract from a proxied root's body; value in and sends out through the proxy are served in
  `call/proxied-native-value`),
  `role-admin-read-key` (a role write the body skips; the helpers that return and emit are served, and the keys in
  `call/role-admin-read-key`), `root-reentry-receiver-hook` and `two-deployments-one-artifact`, with
  `composition-world.ts` as their shared harness; the reentrancy guard on a root that calls out
  (`guarded-vault-root`) is served and moved to `call/root-guard-across-call.test.ts`, a mapping key read from the
  contract's own scalar state (`state-keyed-mapping-write`) to `call/state-keyed-mapping-write.test.ts`, an event,
  hash or send per loop turn (`loop-counted-tail`) to `call/loop-turn-effects.test.ts` and
  `call/proxied-native-value.test.ts`, and a read of the node an insert splices through
  (`read-node-spent-by-insert`) to `call/read-node-spent-by-insert.test.ts`. The directory runs only under
  `PER_CALL_AHEAD=1`.

## Which refusals cover which attack

Every row below is a case the BCH-2026 machine refuses, beside the faithful spend it mutates. A bare file name is in
`hostile/`; a case another suite already makes is cited there instead of repeated. Attacks no suite covers yet are
listed under the table, and none of those is claimed anywhere else.

| Attack (the plan's threat list) | Case |
| --- | --- |
| Execute on a non-master UTXO: loose funds at the lock, a foreign category, or the right category without the minting capability | `master-recreation.test.ts` (three cases) |
| A master drained, duplicated or not recreated in place: output token, category, capability, commitment, lock or value | `master-recreation.test.ts` (six cases) |
| A record a master settles alone written back with less value, whether its entry writes, reads or never touches it and whether or not it sends, or a mapping node drained (T39) | `solidc/test/per-call/master/record-value-send.test.ts` (six cases) and `shapes/mapping-values.test.ts` (one case) |
| A forged call edge: a recorded callee that is not the covered callee the call ran, or an argument digest that is not the callee's call data | `call-record.test.ts` (two cases) |
| A low-level call's record and its callee's call data restated with a selector the payload does not name: the fallback's own, which the callee runs as it runs the payload's | `raw-call-payload.test.ts` (one case, refused at the caller while the callee and the validator accept, beside the honest spend) |
| A forged or missing event: payload, lock, token presence, capability, output position, or a body that emits a value the output does not carry | `solidc/test/per-call/master/event-output.test.ts` (the compiled entry's refusals) |
| A state UTXO spent outside settlement, a declared record the transaction does not spend, or a declaration that does not chain from the spent commitment to the written one | `record-census.test.ts` (the undeclared spend) and `solidc/test/per-call/master/record-settlement.test.ts` (three cases) |
| A validator UTXO that is not the mutable NFT its own script pins (minting token, no token, another category) | `validator/script.test.ts` (minting token) and `validator-program.test.ts` (two cases) |
| A covered master presenting an address its category does not derive | `validator-program.test.ts` (one case, isolated through a delegate composition so the address rule and not an earlier edge rule is what refuses) |
| A second signed user offered as the origin reference | `origin-reference.test.ts` (two cases) |
| A root frame whose `sender` is rewritten while a validator covers the edge | `caller-lock-binding.test.ts` (one case, refused on the caller's own input while the validator and callee still accept) |
| Part of a covered contract left unsettled | `validator/script.test.ts` (one case) |
| A validator transcript or a covered witness block the shipped program cannot read | `validator/script.test.ts` (eight cases) and `validator-transcript.test.ts` (a block with a trailing byte or cut short) |
| A validator output missing, not recreated, or carrying less value, or no master of its own category | `validator-recreation.test.ts` (missing, not recreated) and `validator/script.test.ts` (two cases) |
| A record the validator settles written back lighter, even by exactly its frame's listed send (T39) | `validator/script.test.ts` (one case) |
| A transcript listing masters that point elsewhere, are duplicated or are missing, and roots that are duplicated, missing or extra | `validator/script.test.ts` (eleven cases, the two-root composition accepted beside them) |
| A forged call edge in either direction: callee, caller, frame kind, origin, value, sender, target, self, result, argument digest, an unreached master, or a master called twice | `validator/script.test.ts` (thirteen cases) |
| A contract settled twice, or a read-only frame changing a record, emitting or paying an output | `validator/script.test.ts` (settled twice, paying) and `validator-settlement.test.ts` (changing a record, emitting) |
| A read-only frame whose call carries value or names a frame that is not read-only | `validator-read-only-calls.test.ts` (three cases) |
| A record declaration that reads a view an intervening write has already passed (a stale read) | `stale-view.test.ts` (one case) |
| A record declared changed in a segment its frame's code does not write it in: a data record, another key's mapping node, a batch node outside its write's segment, or a guard shown unset between its two writes (T43, T44) | `unwritten-record-change.test.ts` (five cases), `shapes/mapping-write-beside-calls.test.ts` (five cases) and `call/root-write-skipped-call.test.ts` (a batch node past its write's segment, behind a guarded call and beside an arm that makes none) |
| A reentrancy guard shown clear while the call it guards runs, so a frame re-entering the contract below that call would pass it: on the hop's own spend of a root behind its proxy, and on a composed callee that calls back into a guarded entry | `guard-view-across-call.test.ts` (two cases: refused at the delegate frame alone, beside the settled hop every input accepts, and at the outer frame; the honest re-entry is refused in the re-entered frame by the guard's own reason) |
| A mapping write a branch guards declared on the side the body does not take: a node created or rewritten where the body skips the write, or a write the body makes declared skipped | `solidc/test/per-call/master/skipped-guarded-write.test.ts` (six refused beside the accepted taken and skipped declarations) and `call/guarded-mapping-write.test.ts` (a settled skip restated as a write, refused at the frame on both paths) |
| A standalone master whose reserved address slot is filled with an address its category does not derive | `standalone-address-slot.test.ts` (one case refused; a slot and a presented address that agree on a foreign address are accepted there, which is the residual only the deployment gate recomputes) |
| One contract's masters split across two validators | `validator-split-view.test.ts` (one case, with a second validator input beside the first) |
| An extra call naming an already-used signed input (the call-receipt residual) | `reused-signature.test.ts` (recorded as accepted, so adopting receipts flips it) |
| A proxy's call the contract does not hold the target for: a fallback beside ordinary entries, a receive, a delegatecall whose data is not the entry's own received call data, a target the contract does not hold | `proxy-binding.test.ts` (each refused at compile by name) |
| A standalone master entered by a contract's input rather than a user's | `standalone-caller-contract.test.ts` (refused, with the attribution controls: the same forge is refused whether the frame claims that lock or the user, and a token behind a user lock is accepted) |
| A constructor entered again on a live master: an owner rewritten, a supply minted twice | `constructor-replay.test.ts` (two cases, each after an honest genesis; refused at the master alone, its validator, records and nodes accepting) and `solidc/test/per-call/master/constructor-body.test.ts` (input 0 spending another output of the funding transaction or another coin, beside the genesis outpoint accepted) |
| A proxied call whose delegate callee is not the implementation the proxy's own record names | `delegate-callee-mutation.test.ts` (the faithful forwarded hop the proxy's record names is accepted by the derivation and the machine, and a callee that is a second deployed contract's master is refused `V5_DELEGATE_TARGET_MISMATCH` off chain and by the facet's edge rule on chain; `delegate-target-binding.test.ts` states the same rule for a master entered under the record's target) |
| A master whose declared segments are out of order | `reordered-segments.test.ts` (the derivation refuses `V7_CHAIN_START_MISMATCH`; the program's order-free chain walk accepts, which the case pins) |
| Two frames that list the same event output | `shared-event-output.test.ts` (the composer refuses the plan's shared list, and a mutation of the assembled spend is refused by the derivation and the program alike) |
| A payment to a contract made without the recipient's master: a plain output at its address listed as a send, the call record kept without the recipient's master, a send listed to a P2SH32 lock the body pays through a call, another contract or another body taking the value, or a payer claiming to stand alone while it makes the call (T35) | `contract-payment-plain-output.test.ts` (seven cases, beside the composed payment every input accepts) and `solidc/test/per-call/master/value-receive-call.test.ts` (the stand-alone payer) |
| A value call made where the payer sends, before a call that reads the paid contract, with another amount than the payer sent, its value paid elsewhere than the recipient's containers, or recorded after the read | `value-call-order.test.ts` (one case of three changes, beside the composed payment every input accepts) |
| Value through a proxy forged: claimed by the frames but not taken into the proxy's containers, claimed by the delegate frame above its caller's (T40), the proxy's containers drained past what the delegate frame pays, or a send paid to another lock or amount than its pin, or after another contract's container | `call/proxied-native-value.test.ts` (five cases beside the deposit and withdrawal every input accepts: the validator's value rule, its edge rule, and the delegate frame's own pins) |
| A frame entered by the contract's own validator or data-record lock, posing as the contract (T19) | `standalone-caller-contract.test.ts` (each lock refused beside an accepted control) and `validator/script.test.ts` (a root and a called master, refused at the validator) |
| A caller whose signature hash type does not commit to the whole transaction: `0xC1`, `0xC3`, `0x42`, `0x43`, `0xE1` (T20) | `standalone-caller-contract.test.ts` (standalone) and `caller-lock-binding.test.ts` (composed root, the validator still accepting) |
| A facet not recreated, recreated lighter, moved to read another head's transcript, or reading a transcript pushed ahead of its head's | `validator-facets.test.ts` (four cases; a transcript only the facet refuses is the premise) |
| A call tree deeper than the head's ordered visit can recurse | `validator/script.test.ts` (31 levels refused at the head, 25 accepted) |

Not covered by `hostile/`, and not claimed by any other directory: a witness selecting a `catch` branch, which no
witness can express: the block carries no branch field and the compiler makes every catch a no-op.

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

Every row above was re-measured with the package config at `225b23731`, one run per directory (the `ahead/` row stays at its own last measurement, since it runs only under `PER_CALL_AHEAD=1`).
