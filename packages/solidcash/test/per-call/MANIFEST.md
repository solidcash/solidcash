# Focused test directories

One directory per stream, plus the shared interface vectors. A stream's directory is the only suite it runs while
it is being written; the whole-repo suite runs at milestones.

Run one directory:

    yarn workspace <package> vitest run <directory>

The generated program-versus-derivation check in `validator/script.test.ts` runs three cases per mutation by
default. `PER_CALL_FULL=1` restores its full 400-case sample; use it at milestones.

| Directory | Package | Tests |
| --- | --- | --- |
| `packages/utils/test/per-call/` | `@solidcash/utils` | 114 |
| `packages/solidc/test/per-call/master/` | `solidc` | 233 |
| `packages/solidc/test/per-call/records/` | `solidc` | 29 |
| `packages/solidc/test/per-call/validator/` | `solidc` | 9 |
| `packages/solidcash/test/per-call/validator/` | `solidcash` | 77 |
| `packages/solidcash/test/per-call/composer/` | `solidcash` | 129 |
| `packages/solidcash/test/per-call/frames/` | `solidcash` | 44 |
| `packages/solidcash/test/per-call/records/` | `solidcash` | 4 |
| `packages/solidcash/test/per-call/deploy/` | `solidcash` | 40 |
| `packages/solidcash/test/per-call/hostile/` | `solidcash` | 32 |
| `packages/solidcash/test/per-call/shapes/` | `solidcash` | 9 |
| `packages/solidcash/test/per-call/conformance/` | `solidcash` | — not written |
| `packages/solidcash/test/per-call/edges/` | `solidcash` | — not written |
| `packages/solidcash/test/per-call/toys/` | `solidcash` | — not written |

Total: 720 tests, all passing at `0af283aa7` (114 + 271 + 335).

## What each directory covers

- **`utils/test/per-call/`** — the wire formats and the pure derivations, driven through their exported functions:
  witness-block and transcript round trips, exact-length rejection (bad magic, unknown version, unknown frame kind,
  root recorded as a call kind, absent callee, wrong segment count, truncation, trailing byte), minimal-push
  framing, argument pushes told apart from the redeem script, canonical values and `argsHash`, derived addresses,
  and stop-site coherence. Vectors in `vectors/`.
- **`solidc/test/per-call/master/`** — the compiled master program: its published composition descriptor and slot
  offsets, the frame checks the machine enforces on a real spend (ownership, recreation, hash type, `msg.sender`,
  `tx.origin`, `address(this)`), the witness-block reader, dispatch over one master's entry points, state read and
  written through the frame's declared record indices, record settlement across the segments of one execution, the
  returns an entry settles against the frame's `retval`, call sites and their argument digests, and the shapes the
  generator refuses by name (including imports that contribute emitted definitions, which a declaration-only import
  does not).
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
  the design lists, and both refusals.
- **`solidcash/test/per-call/frames/`** — the master prologue and the witness-block reader, evaluated in the BCH-2026
  virtual machine against real transactions, and, in `composition-spend.test.ts`, one composed transaction driven
  from source to verdict: shipped compile, shipped deployment, composer layout and assembly, derivation, and the
  machine's acceptance of the caller, its callee and the validator, twice on the same bytes, with two mutated
  controls refused.
- **`solidcash/test/per-call/records/`** — a stateful composition whose record sits away from the master that reads
  it: the record is declared once per segment, the chain runs from the commitment the transaction spends to the one
  it writes, the plan states the output that carries the new commitment, and the machine accepts the master's own
  input. The control removes the declarations, and the same transaction is refused by the body's read and by the
  derivation.
- **`solidcash/test/per-call/hostile/`** — spends that must be refused, each beside the faithful spend it mutates
  and each decided by the machine: loose funds at a master's lock, a master not recreated in place, a covered
  master presenting an address its category does not derive, a validator UTXO that is not the mutable NFT its
  script pins, a call record naming the wrong input or carrying the wrong argument digest, an event output the body
  did not compute, a declared record the transaction does not spend, and a state UTXO no segment declares.
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

Not covered by `hostile/`, and not claimed by any other directory: a standalone master whose reserved address slot is
filled with an address its category does not derive (the on-chain head compares the witness `self` with the reserved
slot; only the deployment gate recomputes it); a forged caller or call edge where a validator is present but the
edge rule does not fire first; reordered segments and stale reads; partial settlement of a multi-master contract;
one view spread over two validators; a second signed user offered as `originRef`; a witness selecting a `catch`
branch; proxy and implementation binding; a value send made as a plain output; and the receipt form, which the plan
records as a residual.

## The shape the path currently carries

Both sides of a composition compile and are spent in a test: a caller and the callee it reaches, co-spent with a
validator, assembled by the composer from a plan the test supplies no geometry for. A compiled stateful master
reads and writes its record through the indices its own frame declares, chains those declarations across the
segments of one execution, and settles a record that sits away from it. The validator is an emitted program
(`packages/solidc/src/per-call/validator/program.ts`) that enforces V1, V9 and the transcript's header and root
indices, and is held to its own derivation by a generated differential check.

## What is not covered

- The marketplace harness is pointed at `composition: 'per-call'`, but the project does not compile on that path: a
  compiled unit that contributes emitted definitions (a library import) is refused by name, and so is a constructor
  body that asks the head for something it does not carry — the first marketplace root stops on a constructor that
  writes a mapping, which needs a batch-slot operand the head does not supply. The ladder therefore stands at
  "blocked at compile" and no title count is claimed.
- The composer lays out the shapes whose entries make the same number of external calls: a call-back shape, a
  user-entered multi-entry master, and a two-master contract whose validator has nothing to settle are refused by
  name. Delegatecall, mapping records and value sends are refused by name as well.
- The validator program enforces V1, V9 and the transcript header; V2-V8, V10 and V11 are pure checks with hostile
  units, a reference model and a differential harness, and no master-side test yet runs the shipped program instead
  of a stand-in whose hash the master recognises.
- Every VM acceptance in these directories runs under the relaxed operation-cost profile; the published density is
  what a real chain would apply (see `GATE_REPORT.md`).
