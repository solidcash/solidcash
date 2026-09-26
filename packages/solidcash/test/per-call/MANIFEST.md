# Focused test directories

One directory per stream, plus the shared interface vectors. A stream's directory is the only suite it runs while
it is being written; the whole-repo suite runs at milestones.

Run one directory:

    yarn workspace <package> vitest run <directory>

| Directory | Package | Tests |
| --- | --- | --- |
| `packages/utils/test/per-call/` | `@solidcash/utils` | 113 |
| `packages/solidc/test/per-call/master/` | `solidc` | 29 |
| `packages/solidc/test/per-call/records/` | `solidc` | 29 |
| `packages/solidcash/test/per-call/validator/` | `solidcash` | 25 |
| `packages/solidcash/test/per-call/composer/` | `solidcash` | 35 |
| `packages/solidcash/test/per-call/frames/` | `solidcash` | 27 |
| `packages/solidcash/test/per-call/records/` | `solidcash` | — not written |
| `packages/solidcash/test/per-call/deploy/` | `solidcash` | 28 |
| `packages/solidcash/test/per-call/conformance/` | `solidcash` | — not written |
| `packages/solidcash/test/per-call/edges/` | `solidcash` | — not written |
| `packages/solidcash/test/per-call/hostile/` | `solidcash` | — not written |
| `packages/solidcash/test/per-call/toys/` | `solidcash` | — not written |
| `packages/solidcash/test/per-call/shapes/` | `solidcash` | — not written |

Total: 286 tests, all passing at the latest commit.

## What each directory covers

- **`utils/test/per-call/`** — the wire formats and the pure derivations, driven through their exported functions:
  witness-block and transcript round trips, exact-length rejection (bad magic, unknown version, unknown frame kind,
  root recorded as a call kind, absent callee, wrong segment count, truncation, trailing byte), minimal-push
  framing, argument pushes told apart from the redeem script, canonical values and `argsHash`, derived addresses,
  and stop-site coherence. Vectors in `vectors/`.
- **`solidc/test/per-call/master/`** — convention selection: the direct convention compiles to the same bytecode
  whether requested or default, and a convention whose code generation is absent is refused by name.
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
  virtual machine against real transactions. The prologue's two checks are exercised in isolation, a faithful
  recreation is accepted, and a stack-neutrality case proves the prologue leaves the stack as it found it. The reader
  recovers the block from the first push of the input's own unlocking bytecode, bounded by the length that push
  declares, and then walks the frame fields; each field is compared against a value from outside the block, so a
  wrong offset rejects, and one mutation per field is checked.

## The shape the path currently carries

A compiled master exists and is spent in a test: one inlined entry point, no selector dispatch, no external calls and no returns. The end-to-end test compiles a contract for the convention, deploys it through the shipped deployment, and has the virtual machine accept a real spend, with three controls refused.

## What is not covered

The compiler path that would emit a master program per entry point, and the record view mode it reads records
through, are not implemented: no directory above drives a compiled artifact, and the composer executes no scripts.
Program execution is an injected step function, so the derivation, assembly, layout and refusals are exercised for
real while script evaluation is not. The prologue's checks are real and VM-proven, but nothing yet emits them into a
contract. See the plan's Log and Deviations.
