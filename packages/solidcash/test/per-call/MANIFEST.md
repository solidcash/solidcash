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
| `packages/utils/test/per-call/` | `@solidcash/utils` | 115 |
| `packages/solidc/test/per-call/master/` | `solidc` | 336 |
| `packages/solidc/test/per-call/records/` | `solidc` | 29 |
| `packages/solidc/test/per-call/validator/` | `solidc` | 9 |
| `packages/solidc/test/per-call/machine.test.ts` | `solidc` | 3 |
| `packages/solidcash/test/per-call/validator/` | `solidcash` | 94 |
| `packages/solidcash/test/per-call/composer/` | `solidcash` | 149 |
| `packages/solidcash/test/per-call/frames/` | `solidcash` | 71 |
| `packages/solidcash/test/per-call/records/` | `solidcash` | 4 |
| `packages/solidcash/test/per-call/deploy/` | `solidcash` | 66 |
| `packages/solidcash/test/per-call/hostile/` | `solidcash` | 54 |
| `packages/solidcash/test/per-call/shapes/` | `solidcash` | 13 |
| `packages/solidcash/test/per-call/edges/` | `solidcash` | 29 |
| `packages/solidcash/test/per-call/toys/` | `solidcash` | 57 |
| `packages/solidcash/test/per-call/conformance/` | `solidcash` | — not written |

Total: 1029 tests (115 + 377 + 537), all passing. The two package totals are full-config runs of
`vitest.per-call.config.ts`: `solidc` 377 is the four rows above it, and `solidcash` 537 is the nine rows above it.
An earlier total here counted rows that had gone stale rather than re-running them; the numbers above were taken
from the per-file lines of the same runs. A new case belongs in one place: before adding a refusal, check whether
`validator/script.test.ts`, `master-program.test.ts` or the file of the shape it mutates makes it.

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
  composer plans and the shipped derivation fills.
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
- **`solidcash/test/per-call/records/`** — a stateful composition whose record sits away from the master that reads
  it: the record is declared once per segment, the chain runs from the commitment the transaction spends to the one
  it writes, the plan states the output that carries the new commitment, and the machine accepts the master's own
  input. The control removes the declarations, and the same transaction is refused by the body's read and by the
  derivation.
- **`solidcash/test/per-call/hostile/`** - spends that must be refused, each beside the faithful spend it mutates
  and each decided by the machine: loose funds at a master's lock, a master not recreated in place, a covered
  master presenting an address its category does not derive, a validator UTXO carrying no token or another
  category's, a call record naming the wrong input or carrying the wrong argument digest, a declared record the
  transaction does not spend, a second signed user offered as the origin, a root whose sender is rewritten while a
  validator covers the edge, and the validator-program cases `validator/script.test.ts` does not make: a missing
  or non-recreated validator output, a covered witness block with a trailing byte or cut short, and a read-only
  frame that changes a record, emits, or calls with value or into a frame that is not read-only. The validator
  program's per-rule refusals are `validator/script.test.ts`'s, one per rule it emits; the table below maps each
  attack to the file that refuses it.
- **`solidcash/test/per-call/edges/`** — one dedicated test per row of the spec's edge-case table (section 23) that
  the shipped language subset can express: a record written on both sides of a call, a reentrancy guard crossed by
  re-entry, `tx.origin` and `msg.sender` authority on a callee, events above the commitment size emitted by a
  nested frame, two events at distinct outputs, a static read of state another frame just wrote, a data-dependent
  call count, a record growing within one transaction, a four-deep call chain, and a named refusal for every row
  the compiler or the composer still refuses (inline assembly, low-level calls, value sends, struct and array
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
  settled: the proxy master, the implementation master and the validator are accepted), and a dynamic value whose first
  write creates its run beside one event per append (settled, with the created chunk's output, the header and each
  event read back through the shipped encoders).
- **`solidcash/test/per-call/shapes/`** — the compositions the same scripts and the same builder have to serve,
  laid out and derived through the shipped composer and settled in the machine where they are supported, with the
  shapes the generator still refuses asserted as refusals by name.

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
| A standalone master whose reserved address slot is filled with an address its category does not derive | `standalone-address-slot.test.ts` (one case refused; a slot and a presented address that agree on a foreign address are accepted there, which is the residual only the deployment gate recomputes) |
| One contract's masters split across two validators | `validator-split-view.test.ts` (one case, with a second validator input beside the first) |
| An extra call naming an already-used signed input (the call-receipt residual) | `reused-signature.test.ts` (recorded as accepted, so adopting receipts flips it) |
| A proxy's call the contract does not hold the target for: a fallback beside ordinary entries, a receive, a delegatecall whose data is not the entry's own received call data, a target the contract does not hold | `proxy-binding.test.ts` (each refused at compile by name) |
| A standalone master entered by a contract's input rather than a user's | `standalone-caller-contract.test.ts` (refused, with the attribution controls: the same forge is refused whether the frame claims that lock or the user, and a token behind a user lock is accepted) |
| A proxied call whose delegate callee is not the implementation the proxy's own record names | owed, and now testable: the forwarded hop settles in the machine (`toys/proxy.test.ts`), so the record's target can be mutated against it — no case yet |

Not covered by `hostile/`, and not claimed by any other directory: reordered segments, which the machine accepts —
its chain walk is order-free, so a master whose segment declarations are reordered is refused by the derivation as
`V7_CHAIN_START_MISMATCH` but accepted by the program, whose ordering half of `V6` is not emitted — and a witness
selecting a `catch` branch, which no witness can express: the block carries no branch field and the compiler makes
every catch a no-op. A value send made as a plain output is refused at compile by name, and that refusal is already
made in `edges/refused-contract-shapes.test.ts`; no compiled master fixes a send, so there is no spend to mutate.

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
  path: a compiled unit whose own bodies, or whose reached definitions, carry inline assembly is refused by name,
  and so is a body
  that writes a mapping in a shape whose records the master cannot read back from its own frame. One target written
  in place, a whole multi-target batch, the read of the entry the write targets, a composite key, several
  collections in one body, and the sender and compile-time key forms are now derived, planned and settled, and a body now pins its own event count against the head's region, so a
  constructor that emits shares the head. A file-level definition is no longer a wall either: the master opens after
  the definitions its unit contributes, and the shapes a definition could carry that the head cannot serve are the
  ones the compiler never outlines. A `string`-valued state variable is no longer a wall by itself, and the composer now supplies the band: the
  head derives the chunk run's coordinate from the frame's declared record block, `planChunkRun` derives the header
  and chunk commitments and `layOutChunkRun` places the run one layout width past the block's data NFTs, and a plan
  built that way derives with the machine accepting the master that wrote the value (`frames/chunk-run.test.ts`).
  What no plan lays out is a write that changes the run's width: creating or deleting chunks is refused by name
  (`PER_CALL_CHUNK_UNPLANNABLE`). The compile's first reported failure is read the same way each round —
  `node --max-old-space-size=8192 packages/testing/dist/cli.js compile --jobs 4`, after `yarn build`, because the
  harness compiles the built compiler rather than the sources. At `8876b4db7` it is `unicrow/UnicrowClaim.sol` and a
  loop: "the call to 'arbitrationCalculation' runs conditionally, and the paths through 'claimMultiple' do not make
  the same number of calls, so its call records are not a fixed set the head can check" — a `for` over the caller's
  own escrow list, whose trip count is a run-time value, so the calls it makes are not a set the head can count. A
  branch whose arms each make one call is admitted now, which is the shape of that unit's `claim`. The
  ladder stands at "blocked at compile" and no title count is claimed.
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
