# W7 phase 2: coverage-based deletion candidates

Proposal only. No test was deleted, no source or test file was edited. All numbers below are v8 line/branch
coverage on `packages/solidc/src/**` plus `packages/solidcash/src/**`, measured at HEAD `a0ce264c7` of
`feat/per-call`. The marketplace config was never run; the marketplace fixture was never compiled.

## Method (what was actually measured)

Two instruments, both one directory at a time, with `packages/solidcash/vitest.framed.config.ts`.

1. Directory baseline (17 runs). One run per framed directory, coverage on, all tests in the directory:
   `validator records queue receipt time primitives edges toys shapes frames conformance reads reverts deploy
   composer hostile call`. Logs `{SCRATCH}/<dir>-base.log`, coverage
   `{SCRATCH}/cov-<dir>-base/coverage-final.json`.
2. Per-file runs (14 directories, 137 files). Every test file in the directory run on its own, coverage on,
   in the same directory, so the only source of coverage is that one file. Logs
   `{SCRATCH}/<dir>-one-<name>.log`, coverage `{SCRATCH}/cov-<dir>-one-<name>/coverage-final.json`.
   `deploy`, `hostile` and `call` were not run per file (41 + 39 + 121 files); their baselines stand in for
   them in the global instrument.

`{SCRATCH}` is `/tmp/grok-goal-4b830698eeec/implementer/w7p2`.

The command the task prescribed captured only `packages/solidcash/src`, because Vitest 4 defaults
`coverage.allowExternal` to false and the tuned glob was read as project-relative. Adding
`--coverage.allowExternal=true` and `--coverage.include='packages/<pkg>/src/**/*.ts'` brings both packages in
(636 files on a small run). `--coverage.reportOnFailure=true` was needed because `deploy/address-identity.test.ts`
(1 case) and 5 files in `call/` (8 cases) fail at HEAD; without it no report is written. Those failures are
pre-existing at this commit and are not part of this task.

Derived quantities:

- Within-directory marginal: a key (a covered statement, branch arm, or function) is "within-dir unique" for a
  file when that file's own run covers it and no other file's own run in the same directory does. That is exactly
  the coverage the directory loses if the file is deleted, because these framed files are independent and their
  coverage is additive. Summaries `{SCRATCH}/wid-<dir>.txt`.
- Global marginal: a key is "global unique" for a file when exactly one individual run covers it and no baseline
  of the three not-individually-run directories covers it either. Output `{SCRATCH}/global.txt`, tool
  `{SCRATCH}/global.py`.
- Duplicate-source scan: sources hashed by long string literals and by each file's longest literal
  (`{SCRATCH}/dupsrc.txt`, `{SCRATCH}/maxsrc.txt`), to find a same-contract replacement.

## Headline

Of 137 individually measured framed files:

- 32 have zero within-directory marginal coverage (all 32 are also globally zero).
- 81 have zero global marginal coverage. That is the 32 above plus 49 more that carry unique lines within their
  own directory but are subsumed by another directory's files (usually `deploy`, `hostile` or `call`).
- The remaining 56 carry unique coverage in their own directory.

But the plan's caveat is binding: a file with zero TypeScript marginal can still be the only executor of an
emitted-script path. Almost every framed test compiles its own contract and runs it in the BCH-2026 machine, so
zero TS marginal is the normal case, not evidence of redundancy. The candidates below are split accordingly.

## Directory results (per-file instrument)

| directory | files | within-dir zero | within-dir zero files |
| --- | ---: | ---: | --- |
| validator | 7 | 3 | fixture-order, golden, no-master-lock |
| records | 2 | 0 | - |
| queue | 2 | 0 | - |
| receipt | 3 | 0 | - |
| time | 3 | 0 | stated-chain-time is near-zero (4L/13B/2F) |
| primitives | 4 | 2 | fixed-array-calls, pure-static-frame |
| edges | 18 | 7 | deep-chain, events-across-frames, fixed-array-return-edge, nested-authority, reentrant-guard, ... |
| toys | 10 | 6 | fan-in, proxied-appends, proxied-entry, reentry, result-into-later-call, sorted-entry-lifecycle |
| shapes | 15 | 2 | deep-arbitration, record-with-mapping-write |
| frames | 10 | 4 | assembled-spend, category-pin, chunk-run-kinds, round-trip-composition |
| reads | 16 | 2 | nested, proxied-nested-reads |
| reverts | 6 | 0 | - |
| composer | 17 | 1 | witness |
| conformance | 24 | 5 | conditional-write-preservation, deep-chain-rows, large-event-rows, ... |

Baselines for `deploy`, `hostile` and `call` are in `{SCRATCH}/{deploy,hostile,call}-base.log`; they are not in
the per-file table because they were not run per file.

## Ranked deletion candidates

Ranked by confidence that the file adds nothing the suite would lose. Each row states the replacement guard and
answers the script-path caveat explicitly.

### Tier 1: no script path at all, zero marginal within and across the suite

These files compile no `.scash` source and never build a transaction for the machine; they are pure TypeScript
unit tests of helpers and models. The caveat does not apply to them, so zero marginal is decisive.

1. `validator/fixture-order.test.ts` (3 cases; 48 lines). Asserts the fixture's output list is sorted by index
   and inputs are named by position. Marginal 0L/0B/0F within `validator/` (`{SCRATCH}/wid-validator.txt`) and
   0/0/0 globally.
   - Replacement guard: every harness run materialises the composition (`validator/differential.test.ts` over
     240 generated cases, `validator/golden.test.ts`, `validator/no-master-lock.test.ts`), and `planComposition`
     is the single source of the index order all of them consume. Residual: no other file re-states the
     "outputs are index-sorted" assertion, so this is the fixture contract, not the product.
2. `validator/golden.test.ts` (3 cases; 59 lines). ABBA acceptance, the literal spec section-8 order
   `[0,0],[4,0],[1,0],[4,1],[0,1]`, and one smaller acceptance. Marginal 0/0/0 within and globally.
   - Replacement guard: `validator/differential.test.ts` (acceptance and derived-order agreement over two
     seeds) plus `validator/script.test.ts` (the emitted validator program run in the VM). Residual: the exact
     section-8 tuple list is asserted only here; delete only if differential's agreement is judged to pin it.
3. `validator/no-master-lock.test.ts` (2 cases; 94 lines). The derivation must decide identically under
   different master locks. Marginal 0/0/0 within and globally.
   - Replacement guard: `validator/generator.ts:372` mutates a master to a loader lock and
     `validator/differential.test.ts` runs it through both models, which is the same lock-independence property.
4. `composer/witness.test.ts` (8 cases; 219 lines). Master and validator witness assembly, wire order, and two
   refusals. Compiles nothing and runs no VM. Marginal 0/0/0 within `composer/` and globally.
   - Replacement guard: `composer/assemble.test.ts` (assembly at layout indices, transcript building) and the
     `utils/test/framed` witness/transcript codec vectors. Residual: the two refusal messages (segment count
     not following calls; a call recording a root frame) are asserted only here; check
     `composer/derivation.test.ts` and `composer/assemble.test.ts` before deleting.

### Tier 2: no script path, small but non-zero within-directory marginal

5. `composer/composition.test.ts` (3 cases; 193 lines). ABBA block layout, validator transcript, master
   assembly. No compile, no VM. Within `composer/` it is near-zero (2L/1B/2F, in `composer/pools.ts` and
   `composer/layout.ts`); globally 0/0/0.
   - Replacement guard: `composer/layout.test.ts` (documented order, recreate-in-place, output regions) and
     `composer/assemble.test.ts`. Residual: the exact ABBA coordinates are pinned here; the 2L/1B/2F unique
     within the directory must be re-checked against `layout`/`assemble` before deletion.

### Tier 3: an individual case (`it`) rather than a file

6. `primitives/many-masters.test.ts`, the two gated cases at lines 241 and 257 (the nine-entry composition and
   its record refusal, `FRAMED_FULL=1`). They are skipped by default and the file's own comment names
   `shapes/deep-arbitration.test.ts` as the default-run replacement, which composes twenty-one masters and
   refuses a record output no frame computed. The third gated case (twenty-four masters, line 284) has no
   replacement and must stay.
   - Script-path answer: the nine-entry `Ledger`/`Hub` composition is also built by `deep-arbitration`, so the
     removed `it`s are not the sole executor of their shape. The 24-master case is (it carries distinct
     cardinality branches), which is why only the two cases are proposed.

## Keep: zero marginal but the only executor of a script path

These 29 files (28 with zero marginal plus `time/stated-chain-time` at 4L/13B/2F) have no second file that
compiles the same contract for the same entry, so they are the sole executor of the script path named beside
them. Deleting them would leave that emitted bytecode unexecuted even though no TypeScript line would go dark.
This is the plan's caveat, case by case.

- `primitives/fixed-array-calls.test.ts` -- `uint16[4]` and `int16[2]` in/out and a computed `uint16[5]` return
  through a static frame. `edges/fixed-array-return-edge` drives `uint256[5]`, not these widths.
- `primitives/pure-static-frame.test.ts` -- a `uint16[2]` the caller fills element by element at run time, so the
  digest is over a value the code holds rather than one the source states.
- `edges/deep-chain.test.ts` -- the four-deep direct call chain (`conformance/deep-chain-rows` is the hop shape).
- `edges/events-across-frames.test.ts` -- events above the commitment size emitted by a nested frame, and two
  events at distinct outputs.
- `edges/fixed-array-return-edge.test.ts` -- `uint256[5]` and `uint16[5]` returned, checked, stored, and a revert
  after the return.
- `edges/nested-authority.test.ts` -- `msg.sender` authority checked on a callee.
- `edges/reentrant-guard.test.ts` -- a re-entrancy guard field crossed by a re-entering call.
- `edges/refused-contract-shapes.test.ts` -- the two compiler refusals left by phase 1 (a low-level call; a keccak
  side-car in a non-recurrence loop); each source is compiled here only.
- `edges/writes-after-call.test.ts` -- the direct-edge write-after-a-call replica
  (`conformance/write-after-call-rows` is the hop shape).
- `toys/fan-in.test.ts` -- the allowance read-modify-write where `Token` is entered twice and the second frame
  works on the first frame's write.
- `toys/proxied-appends.test.ts`, `toys/proxied-entry.test.ts` -- the proxy hop toys: proxy master,
  implementation master and validator accepted, two controls refused.
- `toys/reentry.test.ts` -- the re-entry shape and the value read back up two frames.
- `toys/result-into-later-call.test.ts` -- a read's result fed into a later call.
- `toys/sorted-entry-lifecycle.test.ts` -- the sorted-entry insert/update/delete lifecycle.
- `shapes/deep-arbitration.test.ts` -- the twenty-one-master, six-contract world and its record refusal.
- `shapes/record-with-mapping-write.test.ts` -- one entry keeping a data-NFT record and writing a mapping batch,
  with the validator control.
- `frames/assembled-spend.test.ts` -- the machine on an assembled spend.
- `frames/category-pin.test.ts` -- the category pin in the VM at immutable vs capable tokens.
- `frames/chunk-run-kinds.test.ts` -- the chunk-run kinds in the machine.
- `frames/round-trip-composition.test.ts` -- the spec's worked ABBA round trip end to end through the machine.
- `reads/nested.test.ts` -- a `STATIC` root reading another contract's `view` in the machine.
- `reads/proxied-nested-reads.test.ts` -- the nested read at a handle that names a proxy.
- `conformance/conditional-write-preservation.test.ts` -- the single-key conditional sorted write (`credit`); the
  batch file is a different contract (`move`).
- `conformance/deep-chain-rows.test.ts` -- spec section-23 deep-chain row.
- `conformance/large-event-rows.test.ts` -- the large-event row and its refused emitter address.
- `conformance/low-level-return-rows.test.ts` -- spec row 11: low-level call, bool decode, revert re-raise.
- `conformance/origin-nested-call-rows.test.ts` -- the `tx.origin` nested-call row (7 cases).
- `time/stated-chain-time.test.ts` -- near-zero (4L/13B/2F): a proxy hop writing `tx.locktime` into state and
  reading it back.

Shared literals were checked with `{SCRATCH}/dupsrc.txt` and `{SCRATCH}/maxsrc.txt`. Where two files share a
literal it is a harness snippet, not a whole same-entry contract, except the pairs the phase-1 audit already
ruled on (`deploy/*` `Child`, `reads/*` `Registry.tag`); none of those pairs is in the zero-marginal set.

## Negative results (files that DO carry unique coverage)

Recorded so the next round does not re-derive them. Top within-directory carriers, lines/branches/functions:

| directory | carrier | unique |
| --- | --- | --- |
| validator | `consensus-limits` | 2108L/372B/200F |
| validator | `script` | 86L/79B/9F |
| records | `state-record-composition` | 84L/81B/19F |
| queue | `handle-sends` | 1520L/864B/311F |
| receipt | `handle-thread-listeners` | 3665L/2167B/854F |
| time | `block-clock` | 1304L/796B/252F |
| primitives | `several-events` | 71L/37B/22F |
| edges | `reads-and-loops` | 9904L/5773B/1399F |
| edges | `repeated-callee` | 394L/209B/48F |
| toys | `identity` | 3832L/2263B/875F |
| shapes | `revert-partway` | 11640L/7137B/1697F |
| shapes | `deployment-circle` | 1106L/552B/236F |
| frames | `dynamic-values-together` | 154L/95B/39F |
| reads | `refused-read` | 445L/216B/106F |
| reverts | `chunk-array-range-read` | 511L/319B/111F |
| composer | `recovery` | 314L/94B/51F |
| composer | `mapping-plan` | 305L/168B/62F |
| conformance | `cross-contract-identity` | 16553L/10336B/2441F |

Also carrying unique coverage: `validator/differential`, `validator/hostile`, `records/partial-write`,
`queue/yield-queue`, `receipt/{event-logs,listeners}`, `time/time-gated`, `primitives/many-masters`,
`edges/{string-array-return-edge,string-argument-edge,struct-argument-edge,writes-after-call,...}` and the
remaining members of the "global-zero but within-dir carrier" set (49 files). Any future deletion round should
treat those 49 as covered-by-another-directory only after confirming the named replacement directory actually
runs that key (the global instrument used `deploy`/`hostile`/`call` baselines, which do cover most of them).

## Limits

- Per-file runs are V8 line/branch/function keys, not line identities per test: two files that execute the same
  line are indistinguishable, which is why the script-path reading above is manual.
- The V8 provider exposes no per-test attribution, so marginal is derived from per-file runs, not a single run.
- `deploy`, `hostile` and `call` were not run per file; their baselines inflate the "covered elsewhere" set in
  the global instrument, so the 81 globally-zero files are a lower bound on deletable-per-TS, not a verdict.
- Coverage keys are matched per source file, so a key re-implemented in emitted bytecode is invisible; the keep
  list is the manual answer to that.
- `deploy/address-identity.test.ts` (1 case) and `call/` (5 files, 8 cases) fail at HEAD; their baselines were
  captured with `reportOnFailure`, so a failing file's baseline reflects only the part that ran.
- `ahead/` was not measured (it is gated behind `FRAMED_AHEAD=1` and out of the task's list), and
  `FRAMED_FULL=1`-only cases were not measured.

## Extension: solidc and utils framed suites (phase 2)

Same method, second scratch root `{SCRATCH2}` = `/tmp/grok-goal-4b830698eeec/implementer/w7p2b`. Each run is
`yarn workspace <solidc|@solidcash/utils> vitest run --config <pkg config>` with the same v8 flags as above,
`--coverage.allowExternal=true`, `--coverage.reportOnFailure=true` and
`--coverage.include` for `packages/solidc/src/**/*.ts`, `packages/solidcash/src/**/*.ts` and
`packages/utils/src/**/*.ts`.

### What was measured

- `solidc` with `packages/solidc/vitest.framed.config.ts`: `test/framed/master` (131 files),
  `test/framed/records` (7), `test/framed/validator` (4) and `test/framed/machine.test.ts` (1). There is no
  `machine/` directory; the machine suite is that single file. Baselines `{SCRATCH2}/<dir>-base.log`; per-file
  `{SCRATCH2}/s-master-<name>.log`, `s-records-<name>.log`, `s-validator-<name>.log`, `s-machine.log`; coverage
  `{SCRATCH2}/cov-<tag>/coverage-final.json`.
- `@solidcash/utils` with the package `vitest.config.ts` (it has no framed config; `test/framed` is the framed
  subset): 6 files, 119 tests. Baseline `{SCRATCH2}/utils-base.log`; per-file `{SCRATCH2}/u-<name>.log`.
- 143 solidc files plus 6 utils files = 149 per-file runs. Within-directory summary `{SCRATCH2}/wid-master.txt`
  (and `analyze2.py` for records, validator and utils); global output `{SCRATCH2}/global2.txt`
  (`global2.py`).

The global instrument for these packages seeds the key counter with every `solidcash` directory baseline
(17 runs, `{SCRATCH}/cov-*-base`) and then adds the 149 individual runs, so a key is global-unique when no
solidcash baseline and no other solidc/utils file covers it. As before this makes the global set a lower bound
on deletable-per-TypeScript.

### The caveat is stronger in solidc

`solidc` framed tests are compiler-fixture and machine tests: each compiles its own `.scash` shape, and many run
the emitted program, a validator fragment or the master head in the VM. No two solidc framed test files share
their longest source literal, and the largest overlap of any two files' long-literal sets is 0.22 (helper
fragments, not whole contracts). So no two solidc files compile the same shape, and zero TypeScript marginal
does not mean redundant: 100 of 131 master files and 108 of 149 solidc/utils files have zero global marginal,
and nearly all of them are the sole executor of a compiler shape or an emitted fragment.

### Directory results

| directory | files | within-dir zero | global zero | note |
| --- | ---: | ---: | ---: | --- |
| solidc master | 131 | 100 | 104 | union 91291 keys; 31 within-dir carriers |
| solidc records | 7 | 0 | 2 | delete-default near-zero (1L/0B/1F) |
| solidc validator | 4 | 0 | 1 | address-check near-zero (0L/1B); context-walk (3L/0B/1F) |
| solidc machine | 1 | n/a | 1 | one file; uniqueness is its whole baseline |
| utils framed | 6 | 0 | 0 | minimal-push near-zero (1L/1B/0F) |

Within-directory and global numbers for `solidc` differ because the global instrument also counts solidcash
baselines: 104 master files are globally zero but only 100 are zero within master.

### Ranked candidates (solidc and utils)

No file meets both conditions, so nothing here is recommended for deletion. The near-zero files a later round
might propose are listed with the reason each is kept (the caveat, case by case).

Solidc validator and records, VM fragments and compiler pins:

- `validator/address-check.test.ts` (global 0L/1B). Runs `addressCheckScript` in the VM, including the
  sender-longer-than-127-bytes sign-bit case; sole executor of that fragment.
- `validator/context-walk.test.ts` (global 3L/0B/1F). Runs `contextCategoryScript` over a delegate/internal
  caller chain; sole executor.
- `records/delete-default.test.ts` (global 1L/0B/1F). Compiles `delete m[k]` against `m[k] = default` and
  asserts byte-identical output for bool and int mappings; the only compiler pin of that rule.

Solidc master near-zero compiler-shape/VM executors (global marginal in brackets, all kept):

- `master/composition-convention.test.ts` (1L/1B), `master/master-program.test.ts` (1L/1B),
  `master/multi-entry-dispatch.test.ts` (1L/1B), `master/refused-body.test.ts` (1L/1B),
  `master/msg-data.test.ts` (1L/1B), `master/guarded-batch-target.test.ts` (1L/1B),
  `master/own-category-conservation.test.ts` (1L/1B), `master/read-only-frame.test.ts` (1L/2B/1F),
  `master/dynamic-call-settlement.test.ts` (0L/3B), `master/witness-shape.test.ts` (4L/0B/1F),
  `master/composite-return.test.ts` (3L/2B/1F), `master/loop-effects.test.ts` (3L/2B/1F),
  `master/write-segment.test.ts` (4L/1B/1F), `master/guarded-dynamic-write-across-call.test.ts` (1L/3B),
  `master/insert-beside-append.test.ts` (0L/0B/0F), `records/absence-proof.test.ts` (3L/3B/0F).
  Each compiles a distinct shape or runs an emitted fragment that no other file does.
- `master/machine.test.ts` (global 0L/0B/0F). The only test pinning that the framed profile accepts a
  20_000-byte unlock that the stock machine refuses; a suite-wide regression guard, keep.

The 100 zero-within-master files (listed in `{SCRATCH2}/wid-master.txt`) are the compiler-shape-only executors:
every line they cover is covered by a sibling, but each compiles a shape no other file compiles, so the keep
rule above applies to all of them. `master/run-apart-from-batch` and `master/run-apart-key-read` are the closest
pair (8 shared literals, j=0.22); they drive different entries of related shapes and both stay.

Utils:

- `utils/test/framed/minimal-push.test.ts` (global 1L/1B/0F). Its marginal is the PUSHDATA4 assignment at
  `utils/src/framed/primitives.ts:199` plus one branch arm at line 197, reached by the payload lengths 65536 and
  65537; no other test pushes more than 0xffff bytes, so it is the only executor of that arm. Keep; a later round
  could drop the two oversized lengths only if it also accepts losing that branch.
- The other five utils files carry unique coverage and are not candidates: `u-interfaces` 95L/37B/17F,
  `u-transcript` 62L/12B/2F, `u-stop-site` 48L/33B/8F, `u-identity` 23L/12B/9F, `u-canonical` 18L/10B/11F.

### Negative results for these packages

Top within-directory carriers in solidc master (lines/branches/functions), so the next round does not re-derive
them: `permit-token-constructor` 5374L/3671B/798F, `route-call-batch-operand` 3793L/3127B/698F,
`inlined-literal-branch` 907L/910B/93F, `returning-event-helper` 872L/555B/128F, `aliased-key-read`
827L/412B/65F, `entry-append-source` 776L/521B/88F, `entry-cache-across-calls` 534L/551B/64F,
`read-after-write-refusal` 364L/426B/38F, `ecrecover-invalid-input` 271L/87B/42F. Full list
`{SCRATCH2}/wid-master.txt`.

### What this extension did not cover

- `solidcash/deploy`, `solidcash/hostile` and `solidcash/call` are still baseline-only (201 test files). Their
  per-file runs were judged not cheap at roughly 20 s each, so they were not done; the global instrument treats
  each directory as one baseline. This is the same limitation the first section's Limits records.
- `ahead/` and `FRAMED_FULL=1`-only cases were not measured, as before.
- Duplicate-source scans for solidc are `{SCRATCH2}/maxsrc-solidc.py` (longest literal per file) and
  `{SCRATCH2}/jaccard-solidc.py` (pairwise literal overlap).
