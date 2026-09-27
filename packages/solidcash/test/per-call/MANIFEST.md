# Focused test directories

One directory per stream, plus the shared interface vectors. A stream's directory is the only suite it runs while
it is being written; the whole-repo suite runs at milestones.

Run a package's focused suites, or one directory of them, with its per-call config:

    yarn workspace solidc vitest run --config vitest.per-call.config.ts [<directory>]
    yarn workspace solidcash vitest run --config vitest.per-call.config.ts [<directory>]
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
| `packages/utils/test/per-call/` | `@solidcash/utils` | 114 |
| `packages/solidc/test/per-call/master/` | `solidc` | 281 |
| `packages/solidc/test/per-call/records/` | `solidc` | 29 |
| `packages/solidc/test/per-call/validator/` | `solidc` | 9 |
| `packages/solidcash/test/per-call/validator/` | `solidcash` | 77 |
| `packages/solidcash/test/per-call/composer/` | `solidcash` | 137 |
| `packages/solidcash/test/per-call/frames/` | `solidcash` | 66 |
| `packages/solidcash/test/per-call/records/` | `solidcash` | 4 |
| `packages/solidcash/test/per-call/deploy/` | `solidcash` | 40 |
| `packages/solidcash/test/per-call/hostile/` | `solidcash` | 91 |
| `packages/solidcash/test/per-call/shapes/` | `solidcash` | 9 |
| `packages/solidcash/test/per-call/edges/` | `solidcash` | 22 |
| `packages/solidcash/test/per-call/toys/` | `solidcash` | 5 |
| `packages/solidcash/test/per-call/conformance/` | `solidcash` | — not written |

Total: 887 tests, all passing at `4ee6f81d5` (114 + 320 + 453).

## What each directory covers

- **`utils/test/per-call/`** — the wire formats and the pure derivations, driven through their exported functions:
  witness-block and transcript round trips, exact-length rejection (bad magic, unknown version, unknown frame kind,
  root recorded as a call kind, absent callee, wrong segment count, truncation, trailing byte), minimal-push
  framing, argument pushes told apart from the redeem script, canonical values and `argsHash`, derived addresses,
  and stop-site coherence. Vectors in `vectors/`.
- **`solidc/test/per-call/master/`** — the compiled master program: its published composition descriptor and slot
  offsets, the frame checks the machine enforces on a real spend (ownership, recreation, hash type, `msg.sender`,
  `tx.origin`, `address(this)`), the witness-block reader, dispatch over one master's entry points, state read and
  written through the frame's declared record views — the walk that recovers them from the witness block is
  `declared-view.test.ts` — record settlement across the segments of one execution, the
  returns an entry settles against the frame's `retval`, one head serving bodies that make different numbers of
  calls and each body pinning the block's declared count to its own, call sites and their argument digests, a
  dynamic value's
  chunk run addressed from the frame's declared record block rather than from the master's own input
  (`dynamic-state-record.test.ts`, which lays the block away from the master so a fixed offset would fail), and the
  shapes the generator refuses by name (including imports that contribute emitted definitions, which a
  declaration-only import does not).
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
  the design lists — including the trailing outputs a plan states that no input recreates — and both refusals.
- **`solidcash/test/per-call/frames/`** — the master prologue and the witness-block reader, evaluated in the BCH-2026
  virtual machine against real transactions, and, in `composition-spend.test.ts`, one composed transaction driven
  from source to verdict: shipped compile, shipped deployment, composer layout and assembly, derivation, and the
  machine's acceptance of the caller, its callee and the validator, twice on the same bytes, with two mutated
  controls refused. `two-contract-round-trip.test.ts` drives the two-contract round trip the design's worked
  example uses, and `round-trip-composition.test.ts` derives it end to end: the layout places the two masters of
  the re-entered contract, the validator and the callee; the shipped host fills every published stop site, callee
  first (`A.k`, then `B.g`, then `A.f`); the machine accepts all four contract inputs of the assembled transaction,
  twice with the same verdict; and the validator's own derivation walks all eleven checks and derives the order the
  spec states for the shape. Controls refused: a re-entered master presenting another contract's address, and a
  block that declares a call its entry's source does not make. `round-trip-stateful.test.ts` carries the same shape
  with records on both contracts, and it is the evidence the plan's first milestone asks for: `A`'s one record is
  written by the entry twice and by the re-entered entry between them, every frame reads and closes against its own
  segment's declaration, the derivation completes callee-first, every contract input and the validator are
  accepted, the validator's derivation accepts all eleven checks in the spec's order, each record's output carries
  the commitment its last declaration wrote, and four controls are refused. `round-trip-events.test.ts` states a
  trailing event output and pins what remains of that shape: with each entry named by the selector its program
  dispatches on, the entry's call site fills and the derivation reaches the re-entered entry, whose own program
  fails an `OP_VERIFY` before its first segment close.
- **`solidcash/test/per-call/records/`** — a stateful composition whose record sits away from the master that reads
  it: the record is declared once per segment, the chain runs from the commitment the transaction spends to the one
  it writes, the plan states the output that carries the new commitment, and the machine accepts the master's own
  input. The control removes the declarations, and the same transaction is refused by the body's read and by the
  derivation.
- **`solidcash/test/per-call/hostile/`** — spends that must be refused, each beside the faithful spend it mutates
  and each decided by the machine: loose funds at a master's lock, a master not recreated in place, a covered
  master presenting an address its category does not derive, a validator UTXO that is not the mutable NFT its
  script pins, a call record naming the wrong input or carrying the wrong argument digest, an event output the body
  did not compute, a declared record the transaction does not spend, a state UTXO no segment declares, a second
  signed user offered as the origin, a root whose sender is rewritten while a validator covers the edge, a
  composition that leaves part of a covered contract unsettled, and — over the shipped validator program's own
  bytes — one rejection per rule it emits: its transcript and the witness blocks it reads, which masters and roots
  a transcript must list, every call edge, settlement, read-only frames and address binding, each with the
  accepted composition beside it.
- **`solidcash/test/per-call/edges/`** — one dedicated test per row of the spec's edge-case table (section 23) that
  the shipped language subset can express: a record written on both sides of a call, a reentrancy guard crossed by
  re-entry, `tx.origin` and `msg.sender` authority on a callee, events above the commitment size emitted by a
  nested frame, two events at distinct outputs, a static read of state another frame just wrote, a data-dependent
  call count, a record growing within one transaction, a four-deep call chain, and a named refusal for every row
  the compiler or the composer still refuses (inline assembly, low-level calls, value sends, struct and array
  returns, `ecrecover`, dynamic mapping values).
- **`solidcash/test/per-call/toys/`** — the small compositions the design lists. Each is driven to the machine
  where the shipped path supports it and otherwise refused by name: a repeated call to one target, the sorted-entry
  insert/update/delete lifecycle, a result fed into a later call, and a fan-in through an allowance, each currently
  refused before composition with the rule named.
- **`solidcash/test/per-call/shapes/`** — the compositions the same scripts and the same builder have to serve,
  laid out and derived through the shipped composer and settled in the machine where they are supported, with the
  shapes the generator still refuses asserted as refusals by name.

## Which refusals cover which attack

Every row below is a case in `hostile/` that the BCH-2026 machine refuses, beside the faithful spend it mutates.
Rows the directory does not yet cover are listed under them, and none of those is claimed anywhere else.

| Attack (the plan's threat list) | Case |
| --- | --- |
| Execute on a non-master UTXO: loose funds at the lock, a foreign category, or the right category without the minting capability | `master-recreation.test.ts` (three cases) |
| A master drained, duplicated or not recreated in place: output token, category, capability, commitment, lock or value | `master-recreation.test.ts` (six cases) |
| A forged call edge: a recorded callee that is not the covered callee the call ran, or an argument digest that is not the callee's call data | `call-record.test.ts` (two cases) |
| A forged or missing event: payload, lock, token presence, capability, output position, or a body that emits a value the output does not carry | `event-output.test.ts` (six cases) |
| A state UTXO spent outside settlement, a declared record the transaction does not spend, or a declaration that does not chain from the spent commitment to the written one | `record-census.test.ts` (four cases) |
| A validator UTXO that is not the mutable NFT its own script pins (minting token, no token, another category) | `validator-program.test.ts` (three cases) |
| A covered master presenting an address its category does not derive | `validator-program.test.ts` (one case, isolated through a delegate composition so the address rule and not an earlier edge rule is what refuses) |
| A second signed user offered as the origin reference | `origin-reference.test.ts` (two cases) |
| A root frame whose `sender` is rewritten while a validator covers the edge | `caller-lock-binding.test.ts` (one case, refused on the caller's own input while the validator and callee still accept) |
| Part of a covered contract left unsettled | `settlement-coverage.test.ts` (one case) |
| A validator transcript or a covered witness block the shipped program cannot read | `validator-transcript.test.ts` (ten cases) |
| A validator output missing, not recreated, or carrying less value, or no master of its own category | `validator-recreation.test.ts` (five cases) |
| A transcript listing masters that point elsewhere, are duplicated or are missing, and roots that are duplicated, missing or extra | `validator-coverage.test.ts` (fourteen cases) |
| A forged call edge in either direction: callee, caller, frame kind, origin, value, sender, target, self, result, argument digest, an unreached master, or a master called twice | `validator-call-edges.test.ts` (fourteen cases) |
| A contract settled twice, or a read-only frame changing a record, emitting or paying an output | `validator-settlement.test.ts` (six cases) |
| A read-only frame whose call carries value or names a frame that is not read-only | `validator-read-only-calls.test.ts` (three cases) |

Not covered by `hostile/`, and not claimed by any other directory: a standalone master whose reserved address slot is
filled with an address its category does not derive (the on-chain head compares the witness `self` with the reserved
slot; only the deployment gate recomputes it); reordered segments and stale reads; one view spread over two
validators; a witness selecting a `catch` branch; proxy and implementation binding (per-call delegate shapes are
refused at compile, so there is no spend to mutate); a value send made as a plain output (the composer refuses value
sends by name); and the receipt form, which the plan records as a residual.

## The shape the path currently carries

Both sides of a composition compile and are spent in a test: a caller and the callee it reaches, co-spent with a
validator, assembled by the composer from a plan the test supplies no geometry for. A compiled stateful master
reads and writes its record through the indices its own frame declares, chains those declarations across the
segments of one execution, and settles a record that sits away from it. A compiled master whose state is a `string`
addresses its value's chunk run from the same declaration and settles a read-modify-write of it in the machine.
The validator is an emitted program (`packages/solidc/src/per-call/validator/program.ts`) that emits rules spanning
all eleven checks, and every rule it emits has a machine-level hostile rejection beside an accepted composition.

## What is not covered

- The marketplace harness is pointed at `composition: 'per-call'`, but the project still does not compile on that
  path: a compiled unit that contributes emitted definitions (a library import) is refused by name, and so is a body
  that writes a mapping in a shape whose records the master cannot read back from its own frame. One target written
  in place, a whole multi-target batch, and the sender and compile-time key forms are now derived, planned and
  settled, and a body now pins its own event count against the head's region, so a constructor that emits shares the
  head. A `string`-valued state variable is no longer a wall by itself: the head derives the chunk run's coordinate
  from the frame's declared record block, and a compiled master whose entry appends to such a value consumes the old
  chunk, writes the new one and updates the length header with the machine accepting. What is missing is the
  composer: no plan lays a chunk run out, so the marketplace path has no supplier for the band even though the
  compiler now locates it. The compile's first reported failure is therefore no longer dynamic state but a contract
  whose unit contributes free functions, which a master emits nothing before
  (`EACCToken.sol` and `MockSablierLockup.sol` both stop there). The ladder stands at "blocked at compile" and no
  title count is claimed.
- A master's bodies may declare different numbers of call records: the walk reads the count the block declares and
  the body that runs pins it to its own, so a contract entered twice — once as a caller and once as a plain state
  write — is emitted and deploys, and a block declaring a count no body makes is refused at the caller. The
  composition of such a shape is derived and settled too, when both entries' sources make the calls their blocks
  declare: `frames/round-trip-composition.test.ts` reaches a machine verdict on every contract input and the
  validator decides all eleven checks. A contract the transaction settles while spending none of its state — several
  covered masters, no records of its own — is stated by an empty state-input list in the transcript, which the codec
  and the shipped program both carry. What the round trip does not carry is the spec's output set: its two contracts
  keep no records and emit no events, so an event output and a value send have no supplier in the composer, and a
  contract that emits inside one of two entries is still refused with "the contract emits an event that is not
  attributed to a body" when a sibling contract emits; the event region is sized by the contract's own bodies. A
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
- Every VM acceptance in these directories runs under the relaxed operation-cost profile; the published density is
  what a real chain would apply (see `GATE_REPORT.md`).
