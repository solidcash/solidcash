# R3. The external-review guide: what to check, what is measured, and where the evidence stops

Status: review guide. Base commit `abb3f13b`. Every figure below is labelled **MEASURED HERE** (re-run at
`abb3f13b` by this row, with the command that produced it) or **CITED** (taken from another row's record, with
its provenance and its known staleness). Nothing in this document is promoted, and nothing here changes a task
state - the plan and the completion ledger remain the only places task state lives.

This document exists because the message-bus effort has produced a large amount of evidence held in three
places that do not agree with each other: a 4,400-line plan, a 1,300-line ledger, and roughly 90 fixtures whose
prose comments are older than their assertions. An external reviewer cannot use any of the three as a starting
point without first knowing which parts are checked by something that runs.

It has two halves:

1. **Sections 1-5**: how to check the claims without trusting the board.
2. **Section 6**: what a hostile reviewer would catch. Sixteen findings, each with the file, the line, the
   verification performed, and what would close it. Two were closed by this row (R3-1 and R3-7, both by
   re-measuring against a live node), one was settled empirically (R3-2), and thirteen are open.

---

## 1. What the reviewer needs before anything runs

### 1.1 The repository alone is not sufficient

Three of the strongest claims cannot be checked from a clone:

| requirement | needed for | what happens without it |
| --- | --- | --- |
| Docker regtest stack (BCHN v29.0.0 + Fulcrum, `docker-compose.regtest.yml`) | every `CONSENSUS_FIT` claim | six suites `describe.runIf(TESTS_USE_REGTEST)` silently report 0 tests |
| Four Solidity corpora checked out at four absolute paths | the whole F3 corpus-fit result | the recorded census still loads; the live subset tests fail on a missing path |
| `yarn build` after any compiler change | any suite result at all | a stale `dist` produced 4 false failures twice in this effort |

The four corpora and their default paths, from `layer3-corpus-probe-f3.mjs` and `Layer3CorpusFitF3.test.ts`:

| corpus | default path | env override |
| --- | --- | --- |
| mistswap | `/Code/mistswap/mistswap/contracts` | `MISTSWAP_ROOT` |
| eacc | `/Code/effectiveacceleration.ai/contract/contracts` | `EACC_CONTRACTS_DIR` |
| solidity-by-example | `/Code/solidity-by-example/contracts/src` | `SBE_ROOT` |
| solc-corpus | `/Code/solidity` | `SOLC_CORPUS` |

**None of the four is vendored, submoduled, or revision-pinned anywhere in this repository.** A reviewer who
obtains them at a different revision is measuring a different population than the census recorded, and nothing
would say so. See finding R3-16.

### 1.2 Evidence levels, as the plan defines them

- `SEMANTIC`: runs correctly under BCH-2026 instruction-set and introspection semantics, with **capacity
  limits relaxed**. Never a deployability claim.
- `CONSENSUS_FIT`: the same shape passes ordinary BCH-2026 consensus limits.
- `POLICY_FIT`: accepted by BCHN standard policy with the selected production headroom.

The relaxations that make `SEMANTIC` what it is are in `packages/solidcash/test/e2e/layer3-semantic-profile.ts`
and are worth reading before anything else, because most fixtures use them:

| knob | relaxed value | real BCH-2026 value | ratio |
| --- | --- | --- | --- |
| `maximumInputBytes` | 1,000,000 | 10,000 | 100x |
| `maximumStackItemBytes` | 1,000,000 | 10,000 | 100x |
| `maximumTransactionBytes` | 10,000,000 | 1,000,000 consensus / 100,000 policy | 10x / 100x |
| `operationCostBudgetPerByte` | 10,000,000 | 800 | 12,500x |
| `hashDigestIterationsPerByte` | 10,000,000 | 0.5 standard / 3.5 consensus | 20,000,000x |
| `maximumNftCommitmentBytes` | 128 | 128 | **1x - not relaxed** |

A green run of any fixture that calls `createLayer3SemanticTestProvider()` is `SEMANTIC` evidence and nothing
more. The capstone files each contain a separate block that re-evaluates with nothing relaxed; those blocks
are named in section 2.

---

## 2. The claims and the fixture that checks each

Ordered by how much weight the effort puts on them. "Re-measured here" means this row ran it at `abb3f13b`.

### 2.1 CONSENSUS_FIT: the four capstones execute on a real node

**Claim**: A13, C2, C1 and C3 are executed, accepted and mined by BCHN v29.0.0 on regtest with the May 2026
upgrade active, each with a hostile control refused on the same chain in the same run, and
`RegtestNetworkProvider` carries no `consensusLimits`, so nothing is relaxed.

| capstone | fixture | describe block |
| --- | --- | --- |
| A13 | `packages/solidcash/test/e2e/ReviewA13BoundedGraphC3.test.ts` | `X59: A13 on a real BCHN node` |
| C2 | `packages/solidcash/test/e2e/Layer3HeterogeneousCycleC2.test.ts` | `X59: C2 on a real BCHN node` |
| C1 | `packages/solidcash/test/e2e/Layer3DefiCapstoneC1.test.ts` | `X59: C1 on a real BCHN node` |
| C3 | `packages/solidcash/test/e2e/Layer3BoundedMaximumGraphC3.test.ts` | `X59: C3 on a real BCHN node` |

```
docker compose -f docker-compose.regtest.yml up -d bchn fulcrum miner
cd packages/solidcash
TESTS_USE_REGTEST=true npx vitest run test/e2e/ReviewA13BoundedGraphC3.test.ts \
  --no-file-parallelism -t 'X59: A13 on a real BCHN node' --silent=false
```

(The `--silent=false` matters: the root vitest config sets `silent: 'passed-only'`, so a passing test prints
none of its measurements.)

**The recorded node evidence is for bytes that no longer exist**, because two covenant changes landed after
the mining run - finding R3-1. All four were re-run at `abb3f13b` by this row and all four were accepted and
mined at their current sizes; results in section 3.1.

### 2.2 Policy versus consensus is settled

**Claim**: the 100,000-byte ceiling is policy, not consensus - the same 101,513 bytes were refused
`64: tx-size` by the mempool and accepted inside a hand-assembled block.

- Non-mutating half, committed as a test: `packages/solidcash/test/e2e/Layer3NodeEnvelopeX49.test.ts`
  (`TESTS_USE_REGTEST`). Establishes only that the node's size ceiling is exactly 100,000/100,001 and that the
  size rule runs **before** input lookup.
- Mutating half, a harness rather than a test: `packages/solidcash/test/regtest/x49-policy-vs-consensus.py`.
  This is the only artifact that demonstrates the block-acceptance half. **It is not run by any suite**, has
  no assertions a CI run would check, and its result exists only as prose in the plan and ledger.

### 2.3 POLICY_FIT: nothing

**Claim**: no shape reaches `POLICY_FIT`. The node enforces `tx-size`, `dust`, `oversize-op-return`,
`scriptsig-not-pushonly`, and measurably does **not** enforce an output-script template - a bare `OP_1` output
was funded, mined, and then spent with an empty unlocking script on a node forced strict with
`-acceptnonstdtxn=0`.

- `packages/solidcash/test/e2e/Layer3OutputTemplateX64.test.ts` (`TESTS_USE_REGTEST`; one further test gated
  on `STRICT_RPC_URL`, which points at the separately-launched strict node).
- `packages/solidcash/test/regtest/standard-policy-harness.sh` recreates the node with `-acceptnonstdtxn=0`.

The two negative policy results are the solid ones here. Read finding R3-6 before reading any test in this
repository titled "standard relay policy".

### 2.4 A different limit binds first for almost every shape

**Claim**: C1 and A13 bind on the 10,000-byte per-input script limit, C2 on operation-cost density, C3 on the
100,000-byte relay ceiling; the plan-time screen cannot be the gate.

- `packages/solidcash/test/e2e/Layer3EnvelopeF1.test.ts` - the three synthetic sweep rows are **asserted**;
  the four capstone rows in its header table are **recorded, not asserted**, which the file says itself.
- `packages/solidcash/test/e2e/Layer3ProductionEnvelopeR1.test.ts` - twelve envelope rules, each with a
  hostile case that trips it, plus the measurement that a per-input VM evaluation is structurally blind to
  size, dust and template.
- `packages/solidcash/test/e2e/Layer3EnvelopeDocR2.test.ts` - the guard that the published rule table is the
  enforced rule table.

### 2.5 The capacity envelope is not what stops real contracts

**Claim**: 12 bus-reachable application contracts, 0 admitting a state-changing handler, 134 refused;
route-scope gates are 148/280 = 53% of refusals (177/280 = 63% counting the route-generation gap).

- `packages/solidcash/test/e2e/Layer3CorpusFitF3.test.ts` consumes
  `packages/solidcash/test/e2e/layer3-corpus-census-f3.ts`, an 11,476-line **recorded** census stamped
  `F3_CENSUS_COMMIT = 'b4d33fc1'`.
- The census is regenerated by `packages/solidcash/test/e2e/layer3-corpus-probe-f3.mjs`, which takes about 29
  minutes across all four corpora and is **not run by any suite**.

**The "12 / 0 / 134" headline is not asserted at full scale by anything that runs.** The live test
(`MEASURED: X73 lifted the visibility gate and the application read-only surface still holds`) asserts it over
a **size-selected subset** - application rows whose census redeem script is under 8,000 bytes - and says so.
The three other commits at which the headline is recorded as reproducing were manual probe runs. See finding
R3-4.

### 2.6 The estimator

`packages/solidcash/test/e2e/Layer3EstimatorF2.test.ts` plus `layer3-estimator-f2.ts`,
`layer3-estimator-basis-f2.ts` (a **frozen** basis stamped `F2_BASIS_COMMIT = '1591e87f'`) and
`layer3-estimator-heldout-f2.ts`. The frozen basis is deliberate: two tests assert that the live covenant size
**differs** from the basis figure, so the staleness is the assertion. A reviewer who "refreshes" the basis
breaks `Layer3ProductionEnvelopeR1.test.ts:879`, which asserts the frozen C3 sits exactly 330 bytes under the
ceiling - a figure that was C3's real margin at `9238abff` and is now 3,698.

---

## 3. Figures: measured at this commit versus cited

### 3.1 MEASURED HERE at `abb3f13b`

**All four capstones re-executed against the live regtest stack** (BCHN v29.0.0, May 2026 upgrade active,
chain tip 4129 at start), each in its own run, `--no-file-parallelism`, nothing relaxed:

| shape | node verdict | height | txid prefix | bytes | inputs | hostile control's actual refusal |
| --- | --- | --- | --- | --- | --- | --- |
| A13 | ACCEPTED + MINED | 4144 | `bc7d1629e6462526` | **22,195** | 8 | `mandatory-script-verify-flag-failed (Script failed an OP_VERIFY operation) (code 16)` |
| C2 | ACCEPTED + MINED | 4242 | `70ccb9c343478cc2` | **51,049** | 79 | `mandatory-script-verify-flag-failed (Script failed an OP_EQUALVERIFY operation) (code 16)` |
| C3 | ACCEPTED + MINED | 4456 | `602b2e27b4ceaf50` | **96,302** | 108 | `mandatory-script-verify-flag-failed (Script failed an OP_VERIFY operation) (code 16)` |
| C1 | ACCEPTED + MINED | 4630 | `c0c8b993a46852d0` | **60,617** | 38 | `mandatory-script-verify-flag-failed (Script failed an OP_EQUALVERIFY operation) (code 16)` |

Each was then run a **second** time with the re-pinned assertion of finding R3-7 in place; all four are green,
2 passed each, and C3 was accepted and mined again at height 5134 at the same 96,302 bytes - so the C3 figure
has two independent on-chain confirmations at this commit.

**The opcode is not stable across runs and the flag is.** C1's control was refused `OP_EQUALVERIFY` in the
first run above and `OP_VERIFY` in the second, at the same commit on the same chain. Whichever input the node
happens to reject first is not a property of the covenant, so a control pinned to the opcode would go red on a
correct change. The re-pinned assertions therefore match `/mandatory-script-verify-flag-failed/` and stop
there - that is the property that distinguishes "the node ran the scripts and they refused" from every policy
or lookup refusal, and it is the only part of the message that is stable.

Two things follow, and only two. First, the sizes the node accepted are the **current** sizes, so the
`CONSENSUS_FIT` evidence and the size table now describe the same transactions - which was not true before this
row (finding R3-1). Second, each hostile control is refused for a **script-verify** reason, so the node
executed the covenants and they refused, rather than the node declining on size, dust or a missing input
(finding R3-7). This is a re-establishment of an existing claim on bytes that had moved. It is not a new
evidence level for anything, and it says nothing about `POLICY_FIT`.

Also green on the same node at `abb3f13b`:

| fixture | result |
| --- | --- |
| `Layer3NodeEnvelopeX49.test.ts` | 3/3 - the 100,000/100,001 size boundary and the size-before-lookup ordering hold on this node |
| `Layer3OutputTemplateX64.test.ts` | 6 tests, 1 skipped (the skip is the `STRICT_RPC_URL` second-node case) |
| `Layer3ParticipantBindingSpike.test.ts` | 7/7 broadcast and accepted, the only committed Layer-3 sweep fixture that offers bytes to the node |

Mock-provider builds, at the real ordinary-capacity profile:

| figure | value | command |
| --- | --- | --- |
| C3 serialized | **96,302** B (3,698 under the ceiling) | `vitest run test/e2e/Layer3BoundedMaximumGraphC3.test.ts -t 'C3 capacity measurement' --silent=false` |
| C1 serialized | **60,617** B | `vitest run test/e2e/Layer3DefiCapstoneC1.test.ts --silent=false` |
| C2 serialized | **51,049** B | `vitest run test/e2e/Layer3HeterogeneousCycleC2.test.ts --silent=false` |
| C3 projection redeem | **5,496** B each, 8 of them | same C3 command |
| C3 projection instructions | **18,845** each, identical across all eight | same C3 command |
| C3 controller | **2,891** B, 2,131,942 cost, 15,336 instructions, 0.9218x | same C3 command |
| C3 inputs over budget | **none** | same C3 command |
| projection verifier redeem | **4,121** B compiled, **4,121** B deployed (takes no constructor args) | `Layer3EnvelopeDocR2.test.ts` |
| graph root controller | **1,493** B compiled, **1,514** B deployed with a `bytes20` initializer | see finding R3-3 |

### 3.2 CITED, with provenance

| figure | source | status |
| --- | --- | --- |
| C3 mined at height 3718, 99,670 B, 108 inputs | plan 4.80, commit `9238abff` | true of that commit's bytes; **not the current C3** |
| C1 mined at height 4058, 62,722 B | plan 4.80 | same caveat; and the ledger denies it happened at all - finding R3-2, settled here |
| 101,513 B refused `64: tx-size`, same bytes accepted in a block | plan 4.66, `x49-policy-vs-consensus.py` | not exercised by any suite |
| bare `OP_1` output funded, mined, spent with an empty unlocking script | plan 4.78 | gated on `STRICT_RPC_URL`, requires a second node |
| 12 / 0 / 134 application read-only headline | F3 doc, census `b4d33fc1` | asserted only over the under-8,000-byte subset |
| 148/280 = 53% route-scope | F3 doc errata, census `b4d33fc1` | derived from the recorded census, not re-derived by a test |
| sweep N=2/4/8 accepted and mined | plan 4.66 | the board's only asserted `CONSENSUS_FIT`; no committed fixture reproduces it - finding R3-15 |

---

## 4. Where the evidence stops

Stated as flatly as possible, because several of these are easy to read past.

1. **No application contract has ever been built into a transaction and measured.** F3 says so itself: no
   application row has a one-slot block and the harness cannot seed sidecar slots generically. Every
   application landing figure is an estimate.
2. **No two real contracts have been composed.** Every heterogeneous graph measured is a fixture.
3. **`POLICY_FIT` is not supported for anything.** The two solid policy results are negative ones.
4. **The corpus census is a recording, not a measurement that reruns.** Nothing in CI would notice if the
   compiler's route admission changed tomorrow, except the small live subsets.
5. **The solc-corpus figure is a 1-in-12 systematic sample.**
6. **The read/write split is an upper bound on usefulness, not a floor** - `writesState: false` proves
   read-only; absent is read as writing.
7. **The 10,000-byte-per-input wall is "real" but not "unmovable".** Subroutine extraction, `outline.ts` span
   sharing, and the splitting and `library` paths all target script size, and **none is applied by the
   census**. Whether they close `MarketplaceV1`'s roughly 70% gap is unmeasured in either direction, and the
   board deliberately claims neither.
8. **The plan-time screen is not wired as a gate**, by design and on measured grounds: nothing in the corpus
   reaches its REFUSE threshold, and a per-input VM evaluation cannot see size, dust or template at all.

---

## 5. A reproduction order that fails fast

```
# 0. build first - a stale dist has produced false failures twice in this effort
yarn && yarn build

# 1. cheap, no node, no corpora (~10 s): the covenant sizes every other figure leverages
cd packages/solidcash
npx vitest run test/e2e/Layer3EnvelopeDocR2.test.ts --silent=false

# 2. the envelope and the screen (~5 s)
npx vitest run test/e2e/Layer3EnvelopeF1.test.ts test/e2e/Layer3ProductionEnvelopeR1.test.ts --silent=false

# 3. the capstone sizes, mock provider (~2 min for C1+C2, ~30 s for C3's capacity block)
npx vitest run test/e2e/Layer3DefiCapstoneC1.test.ts test/e2e/Layer3HeterogeneousCycleC2.test.ts --silent=false
npx vitest run test/e2e/Layer3BoundedMaximumGraphC3.test.ts -t 'C3 capacity measurement' --silent=false

# 4. the node evidence (requires the docker stack; one file at a time, they share one chain)
docker compose -f docker-compose.regtest.yml up -d bchn fulcrum miner
TESTS_USE_REGTEST=true npx vitest run test/e2e/ReviewA13BoundedGraphC3.test.ts \
  --no-file-parallelism -t 'X59: A13 on a real BCHN node' --silent=false
# ... then C2, C1, C3 the same way, plus Layer3NodeEnvelopeX49 and Layer3OutputTemplateX64

# 5. the corpus fit (requires the four external corpora; minutes)
npx vitest run test/e2e/Layer3CorpusFitF3.test.ts test/e2e/Layer3EstimatorF2.test.ts --silent=false
```

Never run `yarn test` on a loaded box to check any of this: one worker's single full run was SIGTERM'd by
memory exhaustion with **zero failing tests printed**, which reads exactly like a passing run that stopped.

---

## 6. What a hostile reviewer would catch

Sixteen findings. Severity is about the claim, not the code: **HIGH** means a headline claim rests on it,
**MEDIUM** means a reader would be misled, **LOW** means it is untidy. None of them is a soundness defect in a
covenant; this row read no covenant. They are defects in what the evidence proves, which is a different thing
and the one an external reviewer is being asked to judge.

### R3-1. The node-verified bytes are not the current bytes. HIGH.

The four-capstone mining run is recorded at `9238abff`. Two covenant changes landed **after** it on the
mainline - X65 (`825f720f`, -444 B per projection) and X81 (`e8bff7a9`, +23 B per projection) - and the
projection verifier is instantiated once per participant with each proof slot pushing the whole redeem script,
so every capstone moved:

| capstone | mined at `9238abff` | current at `abb3f13b` | delta |
| --- | --- | --- | --- |
| A13 | 23,458 | 22,195 | -1,263 |
| C2 | 52,733 | 51,049 | -1,684 |
| C1 | 62,722 | 60,617 | -2,105 |
| C3 | 99,670 | 96,302 | -3,368 |

These are not the same transactions and not the same scripts: X81 replaced a partial `OP_NUM2BIN` map with a
total `OP_BIN2NUM` decode inside the covenant the node executed. Read literally, "all four capstones mined" is
a statement about bytes that no longer exist anywhere in the tree.

Ancestry checked rather than inferred: `9238abff` is an ancestor of both `825f720f` (X65) and `e8bff7a9`
(X81), and `825f720f` of `e8bff7a9`, so on the mainline both covenant changes land after the mining run.

**CLOSED by this row.** All four capstones were re-run against the live node at `abb3f13b` and all four were
accepted and mined at their current sizes (section 3.1). Nothing here says the claim was wrong - it says the
claim was unpinned, and a size table that moved three times in two days is exactly the input this board has
been burned by four times.

**What remains open**: the capstone node blocks assert `serializedBytes` against a band rather than a figure,
which is deliberate and correct, so nothing fails when the size moves again. What is missing is a statement in
the ledger row itself of which commit its txids belong to.

### R3-2. The ledger and the plan disagree about whether C1 is node-verified. HIGH.

`packages/solidc/docs/message-bus-completion-ledger.md:113` reads
**"NODE-VERIFIED for three capstones"** and, explicitly, **"C1 is NOT node-verified"**, with a fixed set of
three txids at heights 1401 / 1304 / 1090.

`packages/solidc/docs/message-bus-parallel-work-plan.md` section 4.80 reads **"ALL FOUR CAPSTONES MINED, in
one run, on a real node"**, with four txids at heights 3718 / 3933 / 4058 / 4115.

The plan's own preamble says *"The completion ledger remains authoritative for detailed evidence."* So the
document designated authoritative is the one that denies the strongest result. A reviewer starting from the
ledger will conclude C1 is blocked by a provider defect; a reviewer starting from the plan will conclude it is
mined. Both are current documents at `abb3f13b`.

**Settled here, in the plan's favour**: C1 was executed, accepted and mined at height 4630, 60,617 B, 38
inputs, with its hostile control refused `mandatory-script-verify-flag-failed (OP_EQUALVERIFY)` on the same
chain in the same run. The ledger row is wrong on this point, and it is wrong in the direction that
understates the result. It is outside this row's lease; the correction belongs to the integration owner.

### R3-3. The controller size everyone quotes is the anti-conservative one. MEDIUM.

X85's finding was that the covenant override fields mean the **deployed** redeem length, and that reading
1,493 off the compile passed an input 21 bytes shorter than the script the transaction actually pushes -
anti-conservative, in a row whose entire purpose is conservatism.

The guard built to stop stale covenant figures - `Layer3EnvelopeDocR2.test.ts:166` - still pins only the
**compiled** sizes (1,493 with a p2sh32 target, 1,459 with a 1-byte target). It never pins 1,514. Measured
here at `abb3f13b`: compiled **1,493**, deployed **1,514**. Every brief and summary that says "controller
1,493 B" is quoting the figure X85 identified as the wrong one, including the one that dispatched this row.

**What would close it**: add the deployed figure to that test, since it is the load-bearing one, and quote
both wherever one is quoted.

### R3-4. The most-quoted sentence in the corpus report is not asserted at the scale it is stated. MEDIUM.

"All twelve bus-reachable application contracts admit a read-only surface and nothing else" is stated over 12
contracts. The test that checks it (`Layer3CorpusFitF3.test.ts:325`) filters to application rows whose census
redeem script is **under 8,000 bytes**, because `MarketplaceV1/V2/V3.sol` and `EACCToken.sol` take minutes each
to compile twice. The file says so plainly, and the test is otherwise well built - it has the non-vacuity
guard (`expect(admitted).toBeGreaterThan(0)`) that most of its neighbours lack.

The claim that it "re-verified at four separate commits" resolves to: one recorded census data module
(`b4d33fc1`), and three manual runs of `layer3-corpus-probe-f3.mjs` whose output survives only as prose. The
excluded contracts are precisely the largest ones - which is also where the per-input script wall bites
hardest.

### R3-5. `grep` cannot see the file that generates the entire corpus census. MEDIUM, and mechanically interesting.

`packages/solidcash/test/e2e/layer3-corpus-probe-f3.mjs` uses a literal NUL byte as a field separator in two
places (a `${corpus}\0${rel}` key and its matching `split`). The bytes are committed: the blob is 27,688 bytes
and 27,686 with NULs stripped.

Consequently the file is classified as **binary** and its matching lines are not shown. In the environment this
row ran in, where `grep` is a `ugrep` wrapper invoked with `-I`, it is worse than not shown: the file is
skipped entirely and the command reports **no match**, exit 1. GNU grep is less dangerous but still hides the
content, printing `Binary file ... matches` and no line. Either way a sweep that reads its own output loses the
file.

```
$ grep -n  "no-entry-point-declared" layer3-corpus-probe-f3.mjs   # exit 1, no output
$ grep -an "no-entry-point-declared" layer3-corpus-probe-f3.mjs   # 232:  ... 'no-entry-point-declared' ...
```

This is the same failure mode as the four vacuous guards already on the board - a check that cannot see its
subject and reports success - except that it applies to **every grep-based audit anyone has run over this
repository**, including the ones that produced the guard inventory. Any conclusion of the form "identifier X
no longer exists anywhere" is unsound unless it was taken with `grep -a` or an equivalent.

It has a live consequence for a reviewer. `no-entry-point-declared` is the label carrying the fixed floor of 56
refusals that the 53% route-scope figure is normalised against, and an ordinary grep finds it in the recorded
census and **nowhere else** - which invites the conclusion that it is orphaned data with no producer. It is in
fact produced at `layer3-corpus-probe-f3.mjs:232`, from the absence of a `Rejected entry points - ...` clause in
the compiler's `hidden-batch-route-not-synthesized` diagnostic. This row reached the wrong conclusion first and
only caught it because `sed` and `awk` disagreed with `grep` about the contents of the same file.

**What would close it**: write the separator as the two-character escape sequence backslash-zero in both
places instead of embedding a raw NUL. JavaScript produces the identical byte and the source becomes ASCII.

**And a demonstration nobody planned.** The first draft of this very finding was written with the Write tool
and the intended escape sequence was materialised as a **raw NUL byte** in the paragraph above, making this
document binary too. It was found because the follow-up edit failed to match its own text. The hazard is not
exotic and it is not confined to one file.

### R3-6. A file titled "standard relay policy, committed CI gate" asserts two limits that do not exist. MEDIUM.

`packages/solidcash/test/e2e/Layer3BalancedStandardPolicy.test.ts` describes itself as *"a committed,
reproducible standard-policy gate that runs in ordinary CI"* which asserts the built transactions *"satisfy
BCH mainnet STANDARD-RELAY limits"*. Its two named limits are, at line 18-19:

```ts
const MAX_UNLOCKING = 1650;
const MAX_COMMITMENT = 40;
```

Both are pre-May-2026. **The repository contradicts itself on the first one, in the same directory.** The
production envelope's own rule table, `layer3-production-envelope-r1.ts:107-114`, carries
`input-unlocking-bytes` at **10,000** with the reason *"X49 separately accepted a 6,035-byte scriptSig on the
node, so the legacy 1,650-byte standard limit is gone in v29 and the standard and consensus ceilings
coincide."* So one file in `test/e2e` states the limit as 1,650 and another states, with the measurement, that
1,650 no longer exists. The second constant is 128 in May 2026 - the semantic profile in the same directory
sets `maximumNftCommitmentBytes: 128` and lists it as the one knob it does **not** relax.

Being stricter than reality makes the gate conservative rather than unsound, but it is published as a
statement about what mainnet requires, and it is 6x and 3.2x wrong in that role.

The third defect in the same file is a real vacuity: the commitment test is titled *"every **co-spent**/created
NFT commitment"* and iterates `[...inputs, ...outputs]`, but `TransactionBuilder.buildLibauthTransaction()`
(`packages/solidcash/src/TransactionBuilder.ts:1007-1012`) maps inputs to exactly four fields -
`outpointIndex`, `outpointTransactionHash`, `sequenceNumber`, `unlockingBytecode`. **There is no `token` field
on a libauth input.** The body reads `io.token?.nft?.commitment` and guards with `if (c)`, so all six inputs
are skipped every run. The co-spent half of the test has never executed.

(The neighbouring unlocking-script test is **not** vacuous, despite `buildLibauthTransaction` initialising
`unlockingBytecode` to an empty array: the same method fills every input's script in before returning.)

### R3-7. Four node-level hostile controls did not check why the node refused. HIGH; closed by this row.

The strongest sentence in the effort is "each with a hostile control refused by the node on the same chain in
the same run". Until this row, all four of those controls read:

```ts
await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
```

with no matcher. That passes if the node says `mandatory-script-verify-flag-failed` - and equally if it says
`64: tx-size`, `64: dust`, `missing-inputs` (the node stopped before executing anything),
`txn-mempool-conflict`, `bad-txns-inputs-missingorspent` because a sibling worker's run spent the coin, or if
the RPC call itself throws. The board has an explicit standard against exactly this: X90's re-pin commit is
titled *"pin the three rejections to their causes so none can pass for the wrong reason"*, and X49's whole
contribution was distinguishing `missing-inputs` from a script verdict.

**Measured, the claim holds on all four** (section 3.1): every control is refused
`mandatory-script-verify-flag-failed`, code 16, on the same chain and in the same run as the acceptance. The
four controls now capture the node's message, print it, and assert `/mandatory-script-verify-flag-failed/`.
The **flag** is pinned and the **opcode is not**, and that is a measurement rather than a preference: C1's
control was refused `OP_EQUALVERIFY` in one run and `OP_VERIFY` in another at this same commit on this same
chain. Which verify fails first is not a property of the covenant, so an opcode-pinned control would go red on
a correct change.

That the claim turned out to be true is not a reason the guard was adequate. It was checked here for the first
time, four rounds after it started being quoted, and C3's case is the sharpest: C3 spent four rounds being
refused `64: tx-size` before its scripts ever ran, so during that whole period this exact assertion was green
for a reason that had nothing to do with any covenant.

A13's control was the best of the four before this change: it pins the locally-refusing inputs to
`[3, 4, 5, 6]` before offering the bytes to the node. C1, C2 and C3 had no such local pin in the node block.

### R3-8. The corpus-fit measurement swallows both of its own soundness rules. HIGH.

`Layer3CorpusFitF3.test.ts:714-721` measures every one-slot candidate inside a `try`, and appends any throw to
a `failures` list that is only `console.log`ged. `measureSubject` contains **both** rules the test's own
docstring names as load-bearing:

- rule 2, knob liveness (`:871-872`): `expect(control, 'the operation-cost knob does not bite at ${budget}/byte')
  .toBeDefined()` - *"the same bytes at a budget the input provably cannot meet must be refused, or an accepted
  reading only means the evaluation never ran"*;
- rule 1, no refusal at either real profile (`:901-902`).

A failure of either is caught, logged, and counted as a skip. The only gate is `:731`,
`expect(measured).toBeGreaterThan(0)`, so **one surviving candidate out of eighty-six keeps the test green.**

This is the third vacuous-guard variant already on the board - "a knob control inside a try/catch that was
swallowed into the skip list" - and it was repaired in the sibling file and not here:
`Layer3EstimatorF2.test.ts` puts `assertMeasurementDiscipline(measurement)` at `:1228`, **outside** the catch
that ends at `:1227` with a `continue`. F2's own header names the defect it fixed. F3 kept it.

**What would close it**: hoist the two assertions out of the catch, exactly as F2 did, and assert a floor on
`measured` relative to `candidates.length` rather than against zero.

### R3-9. Forged-log absence is asserted against a reader that returns `[]` on any failure. MEDIUM.

`Layer3EffectFrameStrideR1.test.ts:587`, `:630` and `:680` assert
`expect(show(logs)).not.toContain('999999')`, where `show` is `JSON.stringify`. An empty array renders `'[]'`,
which does not contain `999999`. `readEventsFromChain`
(`packages/solidcash/src/stateful/StateReader.ts:317`) is a `provider.getUtxos(...).filter(...)` that returns
`[]` silently and never throws, so any breakage in event read-back passes all three.

`:630` is the load-bearing one: it is the control that credits the refusals to SEC-15's commitment binding
rather than to SEC-11's offset pin, and its docstring requires the empty-commitment NFT to *"settle, and read
back as nothing"* - which is indistinguishable from the reader seeing nothing at all. The two honest cases at
`:587` and `:680` should each see two genuine logs. The same file already knows the fix: `:712` writes
`expect(logs).toHaveLength(2)`.

### R3-10. A guard repaired from vacuity still has no liveness control. MEDIUM.

`Layer3BoundedMaximumGraphC3.test.ts:1342-1353` is the only thing pinning "no covenant compares participant
rows to each other" - a scope claim about the deployed covenants. Its own comment records that it went vacuous
once, when the identifiers its regex hunted stopped existing. The replacement splits the generated source on
`&&`/`||`, filters for comparison clauses, and asserts the filtered result is empty. **Nothing asserts the
splitter found any clauses at all.** If the generator ever emits comparisons differently, the filter yields
`[]` and the guard passes while proving nothing - the same shape as the defect it replaced, one level further
out.

`Layer3ReviewA1.test.ts:1051-1062` is the same guard with the same omission, and there it is more visible: a
local `comparisons` is bound, used only to derive `pairwise`, and never asserted non-empty.

### R3-11. Two stranger-control byte-locality assertions can pass on an unpatched transcript. MEDIUM.

`Layer3BoundedMaximumGraphC3.test.ts:1330` and `Layer3ReviewA1.test.ts:1013` assert
`patchedByteIndices(...).every(index => index >= lbcStart && index < lbcStart + lbcLength)` with no
non-emptiness check, so a no-op patch satisfies them. The asymmetry is local and decisive: the **same C3
file**, thirty lines earlier at `:1300-1301`, writes `expect(differing.length).toBeGreaterThan(0)` before the
identical `.every(...)`, and `Layer3ReviewA1.test.ts:854` does the same. In both stranger cases the
neighbouring distinctness check would also pass on an unpatched honest transcript, so there is no backstop.

### R3-12. A control that claims a read-back never reads anything. LOW-MEDIUM.

`Layer3ConditionalEmitSlot.test.ts:830-836` is titled *"SEC-10 impact: the forged NFT no longer reaches the
chain to be read back"* and its body is a byte-for-byte duplicate of the test six lines above it, minus that
test's `expect(outcomeOf(...))` assertion. It is strictly weaker than its own neighbour, and the reader it
names (`readEventsFromChain`) appears nowhere in the file. Its `.rejects.toThrow()` is bare.

### R3-13. Prose in the fixtures contradicts the assertions immediately below it. MEDIUM.

X81's re-pin correctly moved every hard assertion and left the surrounding comments. The result is a set of
files whose narrative disagrees with their own code. No live assertion is stale - that was checked exhaustively
- but a reviewer reads the comment first. The sharpest three:

- `packages/solidcash/test/Layer3CompiledGraph.test.ts:706`: *"4,542 -> 4,098, -444, which is what the
  assertion below pins"*. The assertion at `:723` pins **4,121**.
- `packages/solidcash/test/e2e/Layer3BoundedMaximumGraphC3.test.ts:1623`: *"the row moved again to the 5,473
  bytes / 18,656 instructions ... asserted below"*. Asserted below: **5,496** and **18,845**.
- `packages/solidcash/test/e2e/Layer3HeterogeneousCycleC2.test.ts:839`: a capacity table giving 15,008
  instructions against the live assertion of **11,818** at `:875`.

The same file records C3 as 96,118 bytes in the present tense at `:70`, `:1479`, `:1502`, `:1541`, `:1642` and
`:1730`. Measured here: **96,302**. That is a seventh stale-figure incident by the board's own counting rule,
and it is the one that landed inside the file whose header says *"this file distrusts its own recorded
figures"*.

Two board documents carry the same class in the present tense: `message-bus-parallel-work-plan.md:1067`
(*"Sizes at HEAD, measured: A13 23,458 / C2 52,733 / C1 62,722 / C3 99,670"*) and
`message-bus-completion-ledger.md:114` (the projection parser *"pinned at ... 4,542 bytes"*, three generations
stale). Both are outside this row's lease and are left as findings; the plan already tracks the class as X99.

### R3-15. The board's one asserted `CONSENSUS_FIT` cannot be reproduced from committed artifacts. MEDIUM.

X49 asserted `CONSENSUS_FIT` for the participant-binding sweep at N=2, 4 and 8 - **and for nothing else** - on
the grounds that those three were accepted and mined while A13/C2/C1/C3 only reached `missing-inputs`. That
was the correct call at the time and it is the most carefully scoped promotion on the board.

It is also the one a reviewer cannot re-run. The 2,429 / 4,977 / 10,661-byte shapes are built in exactly one
place, `Layer3EnvelopeF1.test.ts`'s `buildSweep` - a binary-safe `grep -arn` over `packages/solidcash/test`
returns six hits for those figures, four in that file's own header and two citations of it in the estimator -
and that file **contains no call to `sendRawTransaction` at all**: it measures the built bytes and stops. The
bytes reach a node only through a three-step manual procedure:

1. run the sweep under `TESTS_USE_REGTEST` so the outpoints are real, with `vitest.broadcast.config.ts` and
   `L3_BROADCAST_OUT` set, so `layer3-broadcast-probe.ts` captures the complete serialized bytes;
2. submit the captured JSONL to the node;
3. confirm the mining.

**Step 2 has no committed implementation.** `grep -arl L3_BROADCAST_OUT` over the whole package returns the
probe and its config and nothing else. The capture half is committed and documented; the submitting half
existed only in a worker's session.

The nearest thing a reviewer can run is `Layer3ParticipantBindingSpike.test.ts`, which does broadcast and is
7/7 green on the node at `abb3f13b` - but its shape is a two-clone participant binding, not F1's N=4 or N=8
sweep, and its own hostiles are bare `rejects.toThrow()` (`:216`, `:229`), the same class as R3-7.

Nothing here says the sweep result is wrong. It says the single claim the board holds to the highest evidence
standard is the one with the weakest reproduction path, which is an odd place for a review package to end up.

### R3-14. The retired 80% figure is still stated in the present tense in three places. LOW.

The full census re-take moved route-scope refusals from 364/455 (80%) to 148/280 (53%), with the visibility
gate going 172 -> 0. The errata blocks were updated. The bodies were not:

- `message-bus-parallel-work-plan.md:1083` and `:167`;
- `message-bus-completion-ledger.md:119`;
- `layer3-corpus-fit-f3.md:154`, `:170`, `:173`, `:588`, `:605` - sections superseded by the errata at the top
  of the same document;
- and in prose only, `Layer3CorpusFitF3.test.ts:304`, `:555` and `ExternalHandlerRouteX73.test.ts:11`.

None of these is an assertion. The tests around them assert on census structure and on live-compiled gate
counts, both of which are current. The plan tracks this as X99, TODO.

### R3-16. The corpus result rests on four unpinned external checkouts. MEDIUM.

Every census figure, every refusal histogram, the 12/0/134 headline and the 53% route-scope figure are
functions of four Solidity corpora that live outside this repository at hard-coded absolute paths (section
1.1). They are not submodules, not vendored, and no revision is recorded anywhere - not in the census module,
which stamps only the **solidc** commit `b4d33fc1`, and not in the probe.

The consequence is asymmetric and worth stating plainly. If the compiler's route admission changes, the
recorded census silently keeps its old numbers, which is a known and accepted property. But if a **corpus**
changes, a reviewer re-running the probe gets different numbers from the recorded ones and has no way to tell
whether the compiler moved or the corpus did. The census's own drift check is scoped to redeem-script lengths
of rows that still exist; it cannot see a row that appeared or vanished.

**What would close it**: record the four corpus commit hashes beside `F3_CENSUS_COMMIT`. It costs four lines
and makes every corpus figure falsifiable.

---

## 7. What this document does not do

It does not review the covenants. It reads no `src/` file except to check whether a test's subject still
exists. It asserts nothing about whether any rule in the envelope is **correct**, whether the journal's
op-model is sound, or whether any refusal is complete - `layer3-review-package.md` is the entry point for that
work, and independent covenant sign-off remains outstanding.

It does not promote any claim. The two evidence-level statements it adds are that A13 and C2, at their current
`abb3f13b` bytes, were accepted and mined by BCHN v29.0.0 with a hostile control refused by the node for a
named script-verify reason in the same run - which is a re-establishment of an existing `CONSENSUS_FIT` claim
on bytes that had moved, not a new level for anything.
