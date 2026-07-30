# F3. Corpus fit: does the message bus fit the contracts people actually write?

Everything measured for the message bus so far is a fixture built for the purpose. F1 measured seven such
shapes against the real BCH-2026 limits; F2 predicts an eighth from its descriptor. Neither answers the
different question this report asks: **take the real corpora in this repository and report how they land
against the measured envelope.**

Base commit `6a685f33`. The census, every estimate, and all 45 built transactions were produced at that
commit. No figure here is carried forward from an earlier bench run or from the F1 table.

**R2 reconciliation at `1591e87f`, re-done at `77cd1e8c`.** Two figures in this report were about shapes
measured *elsewhere* rather than by the F3 probe, and both moved after `6a685f33` when F4 cut the projection
verifier by 129 bytes: C3's position against the relay ceiling (section 6, real limit 2) and the size of the
projection proof (sections 5 and 6). X65 then cut the same covenant by a further 444 bytes and moved both
again, and X81 then ADDED 23 by retiring a width bound, so all three are re-measured: the verifier's redeem script is
**4,121 bytes** and C3's build is **96,302 bytes**. Each correction re-derives its consequence rather than swapping
its number. **No F3 measurement is restated**: the census, the verdict counts, the binding-limit table and
the 45 built transactions are all still the `6a685f33` run and are not re-derived here - except section 3.2's
write classification, which X73 invalidated outright and which is re-measured in place, in that section.

**X86 re-take at `b4d33fc1`: the census below is superseded, and this is what moved.** Every gate count,
refusal histogram and eligible row in sections 2 to 4 is the `6a685f33` run. `layer3-corpus-census-f3.ts` now
holds a re-take of ALL FOUR corpora at `b4d33fc1`, taken in one run against one compiler. The handoff that
opened X86 said solc-corpus and solidity-by-example were hours of work; measured, at the same stride 12 the
recorded census used, a full four-corpus re-take is **29 minutes** - mistswap 167 s, EA 734 s,
solidity-by-example 360 s, solc-corpus 486 s - so there was no reason to take a partial one and no reason for
this document to keep quoting a census two compilers old.

| | `6a685f33` | `b4d33fc1` |
| --- | --- | --- |
| contracts probed | 712 | 712 |
| compile in direct mode | 635 | 635 |
| compile in bus mode | 504 | 512 |
| routed / eligible / instantiable | 367 | **428** |
| one-slot candidates for the measured control | 71 | **86** |
| named route refusals | 455 | **280** |
| bus-mode failure rows | 96 | 88 |
| bus-mode failure rows naming NO cause | 15 | **0** |

Nothing was lost: the contract and direct-compile denominators are identical, so the +61 routed contracts are
gates lifted rather than a changed population. Named by gate: `initial-v1-route-requires-public-visibility`
**172 -> 0** (X73, at full corpus scale rather than on the two application corpora), `unnamed` **20 -> 0**
against `not-examined-by-route-synthesis` 2 -> 22 (X72's rename, one for one),
`result-route-requires-effect-free-handlers` 66 -> 44 and `batched-handler-forward-call-not-enabled` 22 -> 35
(X76), `collection-helper-route-not-enabled` 52 -> 29, `mixed-scalar-and-collection-route-not-enabled` 52 -> 40,
and two new ones - `external-handler-route-generation-unsupported` 0 -> 29 and
`external-handler-would-shrink-the-route` 0 -> 1. The 15 unattributed bus-failure rows going to 0 is X84's
sibling-error carry-through, measured rather than predicted.

**Section 3.1's 80% re-derives to 53%, and section 3.2's headline does not move.** Under the same grouping this
report uses - visibility, the two collection gates, the result-route gate, the forward-call gate - route-scope
refusals are **148 of 280 (53%)**, down from 364 of 455 (80%); counting the new external-handler
route-generation gap as route scope as well gives 177 of 280 (63%). The `no-entry-point-declared` count is
unchanged at 56, which is why the percentage falls: the denominator shrank around a fixed floor of contracts
that declare no entry point at all. Section 3.2 re-derives from the new census as **12 bus-reachable
application contracts, 0 admitting a state-changing handler, 134 state-changing handlers refused** - MistSwap 3
/ 0 / 18 and EA 9 / 0 / 116, every figure identical to both earlier measurements. What moved there is the
ADMITTED count, 38 -> 26, because 38 was the stale record. Corpus-wide the write table becomes MistSwap 3/0,
EA 9/0, solidity-by-example 115/60, solc corpus 301/226, total **428 / 286 writing / 142 read-only only**.

**X85: 444 bytes of every estimate in section 4 was a covenant this tree does not build.** `estimate` defaults
the two generated covenant lengths from the calibration and `replicaSpec` never filled the override fields, so
every projection proof was priced at the basis's 4,542 bytes where the verifier is **4,121** (4,098 when this
was written, before X81's +23) - once per
participant. Passed through, the section 4.1 verdict counts change: at the new census the stale default answers
OVER on **23 of 1,712** rows that fit, 8 at four participants and 15 at eight, because at N = 8 the dead
covenant is 3,552 serialized bytes and relay size is what those rows were refused on. The controller is NOT
part of this: it compiles to 1,493 and DEPLOYS at 1,514, which is the calibration's figure exactly, and the
override fields mean the deployed length. A first pass at this fix read 1,493 off the compile and passed a
controller input 21 bytes shorter than the script the transaction pushes; the built-graph row now asserts both
figures against what `classifyInputs` recovers from the assembled transaction, and that is what caught it.

**X86's drift, and where it was not.** X86 was filed as three rows failing `census redeem length disagrees with
the built participant`, to be repaired by re-taking the application corpora. Probing all 71 one-slot rows
against the compiler found the three exactly - and all three are solc-corpus, none is an application contract,
and **no application contract is a one-slot candidate at all**, so re-taking mistswap and EA could not have
moved that population by one row. The three are
`ethdebugTests/abstract_and_interface.sol` (+24 B), `smtCheckerTests/external_calls/
external_call_this_with_value_1.sol` (+24 B) and `controlFlow/uninitializedAccess/reverting_call_virtual.sol`
(+535 B and blockSize 1 -> 2, which stops it being a one-slot candidate). The disagreement was being asserted
inside the measured control's own try/catch, so those three were counted with the nineteen contracts whose
`require` a placeholder argument cannot satisfy and the built population fell from 45 to 43 with no reason
published. Both built-graph rows now take block size and redeem length from their own compile, re-check the
one-slot rule against the compiler by name, and publish the census disagreement as counted drift.

## 0. What is measured and what is estimated

| Class | Produced by | Status |
| --- | --- | --- |
| The census: gate counts, block sizes, redeem lengths, named refusals, write classification | `layer3-corpus-probe-f3.mjs`, recorded in `layer3-corpus-census-f3.ts` | **MEASURED** (compile outputs) |
| Where a graph of those contracts lands at N = 1/2/4/8 | F2's `estimate` over the census descriptor | **ESTIMATED** |
| 45 real corpus contracts built as participants and evaluated | F1's `assessEnvelope`, run to completion, each with the density knob-liveness control | **MEASURED** (transactions) |

This is not `CONSENSUS_FIT` and not `POLICY_FIT`. A census plus an estimate is neither, and the 45 built
transactions are one-participant shapes on `MockNetworkProvider`, the same reading F1 declined to promote.

Compile-only success is not VM proof. Section 5 is the only VM evidence here; everything in sections 2 to 4
is compile output or estimate.

## 1. Method

Four corpora, each compiled twice: once in ordinary direct mode, once in message-bus participant mode.

```
direct : { solidityImportCompat: true, ecrecover: 'p2pkh' }
bus    : direct + { forceStateful: true, experimentalHiddenBatch: true,
                    experimentalMessageBusController: <p2sh32 lbc>,
                    experimentalMessageBusControllerCategory: <32 bytes> }
```

Three method choices, stated because they change the denominators:

1. **Contracts, not files.** `compileFileMulti` compiles every top-level declaration, with a `compileFile`
   fallback when one sibling in a file fails, so a compiling contract is not dropped because of a neighbour.
   The file-level counts here are therefore **not** the solc-corpus or solidity-by-example bench scorecards,
   which call `compileFile` and count per file. Do not compare them.
2. **`ecrecover: 'p2pkh'`**, the porting alias the EA and MistSwap benches already use. Without it every
   contract using Solidity's builtin fails on an undefined symbol long before anything about the bus.
3. **The solc corpus is a systematic sample.** Compiling 4,876 in-scope files twice did not fit this
   session, so every 12th in-scope file was probed: 407 files, 475 contracts. A `LIMIT` prefix was rejected
   as the sampling method because that corpus is laid out by feature directory, so a prefix samples one or
   two features rather than the corpus.

Corpus pins: solc `816d9b2`, solidity-by-example `5bcdca0`, Effective Acceleration `cea03ed`; MistSwap has no
git metadata in this checkout (`/Code/mistswap/mistswap/contracts`, the sixteen recorded bench targets, plus
`bentobox/KashiPairMediumRiskV1.sol` compiled separately because the F3 row names Kashi and the sixteen do
not include it).

## 2. How many real contracts can reach the bus at all

A contract must pass five gates. Each column is a strictly weaker population than the one to its left, which
the test asserts rather than assumes.

| corpus | files | contracts | compiles | compiles in bus mode | has an SCB1 route | has an eligible handler | instantiable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MistSwap | 16 | 16 | 7 | 3 | 3 | 3 | 3 |
| Effective Acceleration | 22 | 28 | 28 | 10 | 9 | 9 | 9 |
| solidity-by-example | 141 | 193 | 187 | 129 | 91 | 91 | 91 |
| solc corpus (1-in-12 sample) | 407 | 475 | 413 | 362 | 264 | 264 | 264 |
| **total** | **586** | **712** | **635** | **504** | **367** | **367** | **367** |

Read the application corpora first, because they are the ones the F3 row names. **Of the 44 contracts in
MistSwap and Effective Acceleration, 12 reach the bus** - three and nine. Of the 193 solidity-by-example
contracts, 91 do. The proving corpus is the most permissive at 264 of 475, which is expected rather than
encouraging: its files are small single-feature conformance tests, not applications.

Nothing that has a route lacks an eligible handler, and everything eligible is instantiable with placeholder
constructor arguments. All the attrition is in the two middle steps: **131 contracts compile but not in bus
mode**, and **137 compile in bus mode but synthesize no route**.

## 3. What stops the rest

### 3.1 The named route refusals

Route synthesis publishes one reason per entry point. 455 refusals across all four corpora:

| count | reason |
| --- | --- |
| 172 | `initial-v1-route-requires-public-visibility` |
| 66 | `result-route-requires-effect-free-handlers` |
| 56 | `no-entry-point-declared` |
| 52 | `mixed-scalar-and-collection-route-not-enabled` |
| 52 | `collection-helper-route-not-enabled` |
| 22 | `batched-handler-forward-call-not-enabled` |
| 20 | `unnamed` (no `rejectionReason` published) |
| 4 | `lifecycle-or-unsafe-handler` |
| 2 each | `collection-route-requires-one-parameter-keyed-entry-per-collection`, `not-examined-by-route-synthesis`, `event-route-requires-uniform-events-and-at-most-one-value-transfer`, `direct-versus-batch-introspection-divergence`, `value-route-requires-at-most-one-direct-transfer-per-handler` |
| 1 | `result-consuming-handler-requires-effect-free-body` |

The largest single reason is **visibility**, 172 of 455 (38%). `synthesizeHiddenBatchRoute` refuses any entry
point whose visibility is not `public`; Solidity convention marks most external entry points `external`. That
one line of v1 scope turns away more real handlers than any other cause.

Grouped: 364 of the 455 (80%) are route-scope gates - visibility, the two collection gates, the result-route
gate and the forward-call gate. 56 are contracts that declare no entry point at all, 20 are the unnamed hole
in the diagnostic channel, 4 are the deliberate lifecycle/unsafe exclusion, and 11 are the remaining
soundness and shape refusals.

### 3.2 Reachable is not the same as useful, and for the application corpora the useful count is zero

This is the most important number in the report. Using the compiler's own `writesState: false` proof of
read-only, and reading an absent flag as writing - the direction that OVERSTATES usefulness:

| corpus | bus-reachable | admit >= 1 state-changing handler | read-only surface only | state-changing handlers refused |
| --- | --- | --- | --- | --- |
| MistSwap | 3 | **0** | 3 | 18 |
| Effective Acceleration | 9 | **0** | 9 | 116 |
| solidity-by-example | 91 | 34 | 57 | 81 |
| solc corpus (sample) | 264 | 190 | 74 | 26 |
| total | 367 | 224 | 143 | 241 |

**All twelve bus-reachable application contracts admit a read-only surface and nothing else.** Between them
134 state-changing handlers were turned away. A participant like that can be co-spent and invoked, but
composing it buys nothing a plain read would not.

The contrast with the solc corpus (190 of 264 admit a write) is the diagnosis: the refusals concentrate on
contracts that have both mappings and `external` entry points, which is what an application is and what a
conformance test is not.

#### 3.2.1 Re-measured at `77cd1e8c`, after X73 lifted the visibility gate: THE HEADLINE STILL HOLDS

X73 removed `initial-v1-route-requires-public-visibility` entirely - the 172 refusals that were 38% of the
total, and the single largest reason in section 3.1's table. That is the gate this report named as the thing
standing between the application corpora and a useful surface, so the sentence above was re-measured rather
than reasoned about: `layer3-corpus-probe-f3.mjs` was re-run over both application corpora at `77cd1e8c`,
same options, same denominators.

**The verdict does not move. Not one of the twelve admits a state-changing handler, and the refused-write
counts reproduce exactly.**

| corpus | bus-reachable | admit >= 1 state-changing handler | read-only surface only | state-changing handlers refused |
| --- | --- | --- | --- | --- |
| MistSwap | 3 | **0** | 3 | 18 |
| Effective Acceleration | 9 | **0** | 9 | 116 |
| total | 12 | **0** | 12 | 134 |

Every gate count reproduces too: MistSwap 16 files / 16 contracts / 7 direct-OK / 3 bus-OK / 3 routed, EA 22
files / 28 contracts / 28 direct-OK / 10 bus-OK / 9 routed.

**What DID move is the reason, and that is the finding.** The visibility gate is gone from both corpora - 0
refusals, down from 2 and 14 - and every handler it used to refuse landed on a different gate rather than
becoming eligible:

| refusal | MistSwap: census -> `77cd1e8c` | EA: census -> `77cd1e8c` |
| --- | --- | --- |
| `initial-v1-route-requires-public-visibility` | 2 -> **0** | 14 -> **0** |
| `unnamed` | 2 -> **0** | 7 -> **0** |
| `not-examined-by-route-synthesis` | 0 -> 2 | 0 -> 7 |
| `mixed-scalar-and-collection-route-not-enabled` | 2 -> 2 | 4 -> **7** |
| `collection-helper-route-not-enabled` | 1 -> 1 | 7 -> 7 |
| `external-handler-route-generation-unsupported` | - | 0 -> **6** |
| `external-handler-would-shrink-the-route` | - | 0 -> **4** |
| `lifecycle-or-unsafe-handler` | - | 3 -> 3 |
| `batched-handler-forward-call-not-enabled` | 1 -> 2 | - |
| `collection-route-requires-one-parameter-keyed-entry-per-collection` | 1 -> 1 | - |

Two things follow, and neither is a restatement. First, **`unnamed` is no longer a hole**: X72 named it
`not-examined-by-route-synthesis`, one-for-one on both corpora, so section 3.1's "20 are the unnamed hole in
the diagnostic channel" is a property of the census run and not of the compiler. Second, **admitting external
entry points bought reach without buying usefulness**: EA gained two new named refusals worth ten entry
points, its `mixed-scalar-and-collection` count grew from 4 to 7, and its admitted-handler total rose to 17
against MistSwap's 6 - all of them still read-only. This is D2's stacked-gates result reproduced on real
applications: **no single lift admits anything**, and lifting the largest gate on the board moved the useful
count for the application corpora from zero to zero.

That makes the headline sentence *more* durable than when it was written, not less: it now survives the
removal of the gate that was supposed to be the explanation for it. It is still a `6a685f33` measurement for
the solidity-by-example and solc rows, which were not re-taken here.

At full resolution on two contracts everybody recognises, recompiled by the test that prints the table:

```
MyToken (a real ERC-20), blockSize=68
  transfer      refused  collection-helper-route-not-enabled            writesState=true
  approve       refused  initial-v1-route-requires-public-visibility    writesState=true
  transferFrom  refused  initial-v1-route-requires-public-visibility    writesState=true
  mint          refused  collection-helper-route-not-enabled            writesState=true
  burn          refused  collection-helper-route-not-enabled            writesState=true
  totalSupply   refused  mixed-scalar-and-collection-route-not-enabled  writesState=false
  name/symbol/decimals   refused  (same)                                writesState=false
  balanceOf     ELIGIBLE                                                writesState=false
  allowance     ELIGIBLE                                                writesState=false

CPAMM (a constant-product AMM), blockSize=4
  swap            refused  initial-v1-route-requires-public-visibility  writesState=true
  addLiquidity    refused  collection-helper-route-not-enabled          writesState=true
  removeLiquidity refused  collection-helper-route-not-enabled          writesState=true
  token0/token1/reserve0/reserve1/totalSupply  refused  mixed-scalar-...  writesState=false
  balanceOf       ELIGIBLE                                              writesState=false
```

Both count as "bus-reachable" in section 2. **The capacity envelope never gets a chance to bind on `swap` or
`transfer`, because route synthesis turns them away first.**

### 3.3 The contracts the F3 row names by hand

| target | direct mode | bus mode |
| --- | --- | --- |
| `MasterChef.sol` | `AssignTypeError: Type 'address' can not be assigned to variable of type 'address payable' at Line 16` | same |
| `MasterChefV2.sol` | `InvalidModifierCombinationError: function 'batch' issues delegatecall inside a loop` | same |
| `bentobox/BentoBoxV1.sol` | `InvalidModifierCombinationError: function 'batch' issues delegatecall inside a loop` | `LowLevelCallShapeError: function 'withdraw' issues a low-level 'call' carrying the call data` |
| `bentobox/KashiPairMediumRiskV1.sol` | `InvalidParameterTypeError` on `_isSolvent` | `LowLevelCallShapeError: function '_call' issues a low-level 'call' carrying the call data` |
| `TreasurySplit.sol` (EA) | compiles | route present, 3 eligible handlers, all read-only |
| `MarketplaceV1/V2/V3.sol` (EA) | compiles | route present, 1-2 eligible handlers, all read-only |

None of MasterChef, BentoBox or Kashi reaches the bus, and none of them is stopped by a BCH limit: two are
stopped by a type-check gap and a `delegatecall`-in-a-loop refusal in ordinary compilation, and two by the
message-bus low-level-call shape gate.

### 3.4 Bus-mode compile failures

131 contracts compile in direct mode and fail in bus mode. The heads, all corpora:

| count | head |
| --- | --- |
| 26 | `LowLevelCallShapeError: Message-bus low-level call shape is not admitted` |
| 14 | `Error: contract absent from the bus-mode artifact map` (a sibling in the same file failed) |
| 5 | `Error: Unbound return call in __scbN; graph=undefined` |
| 4 | `InvalidParameterTypeError` |
| 3 | `Error: external call target address must be a constructor/function parameter` |
| 2 | `Error: Graph handler requires call/staticcall edges and at most one returning call` |
| 1 | `ParseError: Unexpected token '[' at Line N, Column N` |

Three deserve naming.

**`contract absent from the bus-mode artifact map` names no cause, and that is a probe defect (X84).** The
probe compiles each file with `compileFileMulti` and falls back to `compileFile` when that throws, so a file
whose primary contract still compiles contributes one row instead of all of its declarations, and the rest are
recorded absent. The fallback hands back the error it swallowed; the direct path keeps it as
`directSiblingError` and the bus path used to discard it. Measured at `77cd1e8c`, all five EA rows -
`MarketplaceDataV1` and `MarketplaceV1` under `MarketplaceV1/V2/V3.sol` - are one and the same
`InvalidParameterTypeError: Found parameters (string) in call to function 'meceTags'` at
`MarketplaceDataV1.sol:126`, reached only in bus mode, and the census records none of it. The probe now
carries the sibling error through.

**This does not touch section 3.1's 80%.** The refusal histogram is tallied over rows that compiled in bus
mode - routed plus route-absent - so a bus-failure row contributes nothing to the 455 refusals. Nor does it
move a gate count: widening `busOk` is what the fallback is for. What it corrupted is the attribution in this
one table.

**`Unbound return call in __scbN; graph=undefined`** is an internal abort, not a named refusal - the class of
defect X22 already closed one instance of. Five contracts reach it.

**A REPORT THIS SECTION HAS NOW ABSORBED.** It was reported that `MerkleTree.sol` produces a `ParseError`
under the census's own bus options while this table lists none for solidity-by-example, suspected to be a
missing `compileFile` fallback. Measured at `77cd1e8c`, that is not a discrepancy: `MerkleTree.sol` fails in
**direct** mode, on `Error: Block slot not found: keccakSideCar[0]`, and the probe returns on a direct failure
before bus mode is reached, so the row belongs in section 3.3 and is there. X71 has since made both modes
report the same error. The fallback exists; the real gap was what it discards, above.

**The `ParseError` was a bus-mode-only failure whose reported position was not in the user's file - AND IT IS
GONE (X71).** As this report recorded it, `UniswapV2Router02.sol` compiled in direct mode and with
`forceStateful` and failed the moment `experimentalHiddenBatch` was added, at `Line 68, Column 82` under
`+hiddenBatch` and `Line 119, Column 82` under `+controller`. **Neither position exists in that file**, and the
reported line moving by 51 when an unrelated option is added was the proof: it was a position in whatever the
compiler assembled. A user handed that could not act on it.

Re-measured at `77cd1e8c`, the ParseError is not reachable and the positions above cannot be reproduced:

```
direct           -> OK
+forceStateful   -> OK
+hiddenBatch     -> OK, route present, 25 handlers, 7 eligible
+controller      -> Error: Graph handler '__scb_graph_removeLiquidity' requires call/staticcall edges
                    and at most one returning call
```

Two things follow, and the second is a correction to a claim made in passing elsewhere. First, Router02 now
synthesizes a route under `+hiddenBatch`, but it still does NOT reach the bus under `+controller` - F3's actual
configuration - so it is **not** added to the bus-reachable set here; it fails on a pre-existing *named*
refusal instead of on a position that does not exist, which is a diagnostic improvement and not an admission.

Second, **the seven handlers it admits under `+hiddenBatch` are not all read-only by this report's own test,
and the claim that they are should not be repeated.** Measured at `77cd1e8c`:

| admitted handler | `writesState` |
| --- | --- |
| `quote`, `getAmountOut`, `getAmountIn`, `factory`, `WETH` | `false` |
| `getAmountsOut`, `getAmountsIn` | **`true`** |

All seven are `view` in Solidity, which is presumably where "all seven are `view`/`pure`" came from - but
section 3.2 classifies on the compiler's `writesState`, not on the annotation, and the compiler sets it from
whether the function makes an external call. So **if Router02 ever cleared `+controller`, it would be the first
application contract in this corpus to admit a handler this report counts as state-changing, and section 3.2's
headline would have to be retired with it.** That is the precise condition under which the headline falls, and
it is not met today.

The impossible positions are kept above, quoted as history and labelled as impossible, because that class of
defect is still live elsewhere: a corpus scan found 161 files emitting a warning that cites a line beyond the
file, 138 of them naming a generated `__scb_*` symbol, plus 13 reporting an unlabelled position inside an
IMPORTED file. Those are compiler-side and outside this report; nothing in this document reproduces a
position that cannot exist as though it were current.

## 4. Where the bus-reachable contracts land

**ESTIMATED from here on**, by F2's calibration at `ffef8568`, over the census descriptor. A census records
contracts one at a time and cannot know which pairs call each other - a graph edge is a source-level
`IContract(peer).method()` - so the shape it can describe is a graph of N copies of one contract, using that
contract's own measured block size and redeem script. A real heterogeneous graph is bracketed by the replicas
of its largest and smallest members.

### 4.1 The verdict counts, over all 367 bus-reachable contracts

| N | FITS | OVER | flagged outside the calibrated driver range |
| --- | --- | --- | --- |
| 1 | 355 | 12 | 0 |
| 2 | 309 | 58 | 52 |
| 4 | 309 | 58 | 53 |
| 8 | 241 | 126 | 57 |

**Twelve of the 367 are predicted OVER at ONE participant** - before any graph exists at all. Eight of those
twelve are application contracts (section 4.3), one is `StakingRewards` from solidity-by-example, and three
are from the solc sample.

### 4.2 Which limit binds

| binding limit | N=1 | N=2 | N=4 | N=8 |
| --- | --- | --- | --- | --- |
| operation-cost density | 337 | 342 | 342 | 47 |
| unlocking bytecode length (10,000 B) | 30 | 25 | 25 | 3 |
| standard relay transaction size (100,000 B) | 0 | 0 | 0 | 317 |

F1's central finding holds on the real corpus and gets sharper: **the binding limit is a function of the
contract and of N, and it moves twice as N grows.** Small contracts are density-bound at every count until
the relay ceiling overtakes them at N=8. Large ones are script-bound from N=1 and stay script-bound until
relay size passes them.

A model that used only relay size would be wrong about all 367 rows at N=1, N=2 and N=4. One that used only
script bytes would be wrong about 337 of 367 at N=1. Section 5 shows the *estimator's* answer to this
question is itself wrong for the corpus, in a specific and systematic way.

### 4.3 The application corpora, in full

| contract | redeem B | blockSize | N=1 | N=2 | N=4 | N=8 |
| --- | --- | --- | --- | --- | --- | --- |
| MistSwap `SushiRoll` | 7,119 | 4 | FITS 0.92x script | FITS 0.92x | FITS 0.92x | OVER 1.40x relay |
| MistSwap `UniswapV2Pair` | 14,556 | 6 | **OVER 1.66x script** | OVER 1.66x | OVER 1.66x | OVER 2.03x relay |
| MistSwap `UniswapV2Factory` | 43,939 | 67 | **OVER 4.60x script** | OVER 4.60x | OVER 4.60x | OVER 5.44x relay |
| EA `TreasurySplit` | 2,694 | 3 | FITS 0.58x density | FITS 0.58x | FITS 0.58x | OVER 1.03x relay |
| EA `UnicrowClaim` | 6,501 | 4 | FITS 0.85x script | FITS 0.85x | FITS 0.85x | OVER 1.35x relay |
| EA `UnicrowDispute` | 7,423 | 4 | FITS 0.95x script | FITS 0.95x | FITS 0.95x | OVER 1.42x relay |
| EA `UnicrowArbitrator` | 8,569 | 5 | **OVER 1.06x script** | OVER 1.06x | OVER 1.06x | OVER 1.53x relay |
| EA `FakeToken` | 8,594 | 69 | **OVER 1.06x script** | OVER 1.07x density | OVER 1.68x | OVER 2.89x |
| EA `EACCToken` | 18,166 | 72 | **OVER 2.02x script** | OVER 2.02x | OVER 2.02x | OVER 3.47x relay |
| EA `MarketplaceV1` | 32,326 | 68 | **OVER 3.44x script** | OVER 3.44x | OVER 3.44x | OVER 4.53x relay |
| EA `MarketplaceV2` | 27,535 | 69 | **OVER 2.96x script** | OVER 2.96x | OVER 2.96x | OVER 4.16x relay |
| EA `MarketplaceV3` | 27,509 | 69 | **OVER 2.96x script** | OVER 2.96x | OVER 2.96x | OVER 4.16x relay |

**Eight of the twelve cannot be a participant at N = 1.** Their compiled redeem script alone exceeds, or
nearly exceeds, the 10,000-byte per-input limit before a single argument byte is added:

| contract | redeem script alone, as a share of the 10,000-byte per-input limit |
| --- | --- |
| `UniswapV2Factory` | 439% |
| `MarketplaceV1` | 323% |
| `MarketplaceV2` / `V3` | 275% |
| `EACCToken` | 182% |
| `UniswapV2Pair` | 146% |
| `FakeToken` | 86% |
| `UnicrowArbitrator` | 86% |
| `StakingRewards` (solidity-by-example) | 82% |

That column needs no estimator and no calibration. It is `new Contract(artifact, args).bytecode.length`.

### 4.4 Block size is the second driver, and it is large in exactly the wrong places

The ERC-20-shaped contracts carry the biggest balanced blocks: `EACCToken` 72 slots, `FakeToken` 69,
`MarketplaceV2`/`V3` 69, `MarketplaceV1` 68, `MyToken` 68, `UniswapV2Factory` 67. A participant contributes
`blockSize` inputs, so `MyToken` at N=2 is 140 inputs and at N=8 is 554 - against the 108 inputs of C3, the
largest shape ever measured. F2 reports those descriptors as outside its calibrated range, which is the
correct answer rather than a confident wrong one; 52 to 57 of the 367 rows are so flagged at N >= 2.

## 5. The measured control: 45 real corpus contracts, built and evaluated

Every landing figure above is an estimate. This section is measurement.

**Subject selection is a rule, not a choice.** Every bus-reachable contract with a one-slot block whose
constructor types the harness can supply is built into a real one-participant graph - master, projection
proof, controller, fee - and measured. 71 candidates qualified; **45 built and evaluated**; 26 were skipped,
19 of them because placeholder arguments do not satisfy a real contract's `require`, which is a harness
limitation and not a bus result.

The one-slot restriction is itself a limitation with a consequence worth stating plainly: **none of the
twelve application contracts has a one-slot block, so no application contract is in the measured set.** A
participant with sidecar slots needs those exact entry and resource UTXOs seeded before the transaction
exists, which is per-contract work a corpus-wide harness cannot do generically.

For every one of the 45: costs are read run to completion on a relaxed density ceiling with every other
consensus knob real; acceptance is then re-checked with nothing relaxed at both the real consensus and the
real standard profile, and **nothing is refused at either**; and the density knob-liveness control bites on
the same bytes at a budget derived from that input's own reading, so no acceptance rests on an evaluation
that never ran.

Two of the 45, at the extremes of the range:

```
MEASURED  Test x1 (solc, uninitializedFunctionPointer/invalidStoredInConstructor.sol, redeem 2717B)
          inputs=4 | serialized=9798B | stdSize=9.8% | worstCost=input 2 @ 0.2274x
          refusedAtConsensus=0 | refusedAtStandard=0
          binds=unlocking bytecode length (consensus) 0.4780x at input 1
PREDICTED serialized<=11753B | worstScript<=4757B | worstDensity<=0.5758x
          binds=operation-cost density 0.5758x at master | FITS | in-range

MEASURED  AssemblyError x1 (solidity-by-example, redeem 1163B)
          inputs=4 | serialized=8252B | stdSize=8.3% | worstCost=input 3 @ 0.2177x
          refusedAtConsensus=0 | refusedAtStandard=0
          binds=unlocking bytecode length (consensus) 0.4782x at input 1
PREDICTED serialized<=10199B | worstScript<=4441B | worstDensity<=0.5758x
          binds=operation-cost density 0.5758x at master | FITS | in-range
```

### 5.1 What 45 measurements found about the estimator

All four limits F1 found binding, predicted against measured, over the 45:

| limit | conservative | under-predicts | error range | mean |
| --- | --- | --- | --- | --- |
| serialized bytes (vs the 100,000 B relay ceiling) | 45/45 | 0/45 | +15.7% to +24.2% | - |
| worst density ratio | 45/45 | 0/45 | +56.9% to +153.2% | - |
| worst per-input SigChecks ratio | 45/45 | 0/45 | exact, 0.2500x predicted and measured | 0.0% |
| **worst unlocking bytes (vs the 10,000 B per-input limit)** | **0/45** | **45/45** | **-0.5% to -9.8%** | **-7.0%** (median -7.1%) |

SigChecks is exact rather than merely conservative because every shape here does what every calibration
shape does: one check, on a 126-byte P2PKH fee input, whose allowance is `floor((126 + 60) / 43) = 4`. It is
the one limit no real contract in this corpus comes near, and it is reported so that the fourth limit is not
silently dropped from a report about four limits.

**F2 under-predicts the per-input script limit on every single real corpus contract measured, and that is
the limit which actually binds: all 45 measured transactions bind on unlocking bytecode length.** The
estimator predicted operation-cost density would bind on every one of them.

The mechanism is not a mystery, and it is F2's own documented blind spot 5 - "projection unlocking bytes are
not a function of participants and invocations". In all 45 the measured worst input is input 1, the
projection proof, at roughly 4,780 bytes: **the generated projection covenant is larger than any of these
contracts**, and its size is driven by the transcript it carries rather than by the row count the envelope is
fitted over.

That 4,780 is unlocking bytecode - the covenant's redeem script plus the transcript and proof arguments it
carries - and it was measured at this report's base commit `6a685f33`, which is **before F4**. F4 then cut
the projection verifier's redeem script by 129 bytes (4,542 at `1591e87f`), and X65 then cut a further 444
by replacing its 8-way dispatch with an input-index table. Re-measured after X81, that redeem script is
**4,121 bytes**. The unlocking figure on these 45 shapes is smaller than 4,780 by an amount this report did
not re-measure, and is not restated here as a number.

What is new here is the scale and the sign consistency. F2 recorded that blind spot as a 1.8% miss on one
held-out six-participant graph. On real corpus contracts at **one** participant it is a 7% systematic miss,
on 45 of 45, on the axis that decides fit for the application corpora. Any use of F2 to answer "will this
real contract fit the 10,000-byte input" needs a margin on that term; F2's own searched 34% out-of-sample
margin covers it, at the cost F2 already records.

A second, smaller observation from using the estimator. `Layer3EstimatorF2.test.ts` feeds
`new Contract(...).bytecode.length` directly as `redeemBytes` when predicting its held-out synthetic counts,
but `Contract.bytecode` is a hex string, so that is twice the byte count the calibration basis was fitted on
(the basis takes redeem lengths from `redeemScriptLength`, in bytes). The direction is conservative, so no
recorded conclusion changes, but the two paths are not measuring the same quantity. This census feeds bytes.

## 6. Real walls and incidental walls

This board has a standing correction against calling an EVM pattern fundamental, applied at least three
times. It is applied here: every wall is named with its mechanism, and where SolidCash already carries
machinery pointed at it, that machinery is named.

### Real limits - properties of BCH-2026, not of this compiler

1. **The 10,000-byte per-input unlocking-bytecode limit.** This is what stops eight of the twelve
   bus-reachable application contracts, at one participant, and it is what binds on all 45 measured
   transactions. A consensus limit; no graph design moves it.
2. **The 100,000-byte standard relay ceiling.** It takes over at N=8 for 317 of 367 rows, so this is the wall
   F1 found, reached earlier by larger contracts. This report originally added *"C3 already sat at 1.0065x of
   it"*; that is no longer true and the correction does not weaken the point. C3 was executed, accepted and
   mined at **99,670 bytes**, 0.9967x of the ceiling (citation, X59/X60 at `1591e87f`) after F4's 129-byte
   cut to the projection verifier, worth 129 bytes per participant across C3's eight. **Re-measured at
   `77cd1e8c` the same build is 96,118 bytes, 0.9612x**, after X65 cut a further 444 from the same covenant -
   a re-measurement of the mock-built bytes, NOT a second node run: the node-mined figure is still 99,670.
   The ceiling is still where the corpus meets it at N=8; what changed is that the largest fixture ever built
   went from just outside it to **3,698** bytes inside at HEAD (3,882 before X81), and that margin is wide enough to be headroom rather
   than a near miss - which retires, rather than re-prices, every C3 slot-removal option this board costed.

   **This one is POLICY, not consensus, and it is the only entry in this section that is.** X49 got the same
   101,513 bytes refused `64: tx-size` through the mempool and then accepted in a hand-assembled block; the
   consensus transaction ceiling is 1,000,000 bytes (citation, X49). It is listed here as a real limit
   because it is real for anything that has to be *relayed*, which is what an SDK builds - but unlike the
   per-input limit above it, it is a property of node policy rather than of BCH-2026, and a direct
   relationship with a miner moves it. Do not cite it as a consensus bound.
3. **Operation-cost density.** Predicted to bind for the majority of contracts at N=1..4, though section 5
   shows that prediction is wrong for the 45 shapes that were actually built.

Real does not mean unmovable. The per-input limit binds on **script size**, and this repository already
carries machinery aimed at script size that the census does not apply: subroutine extraction via
`OP_DEFINE`/`OP_INVOKE` (`docs/subroutine-extraction.md` records -60.7% cumulative on its worked example),
cross-function span outlining (`packages/utils/src/outline.ts`), and the splitting and `library` paths
(`docs/large-contract-splitting.md`, `docs/library-contracts.md`). `MarketplaceV1` at 32,326 bytes needs
roughly a 70% reduction to fit one input. Whether any combination of those reaches it on THESE contracts in
bus mode is unmeasured, here and elsewhere; this report neither claims it does nor claims it cannot. That is
the measurement the production-envelope decision actually needs.

A second observation in the same category: the projection proof is a fixed overhead on every participant,
which at these sizes is a large share of a limit that real contracts are already close to. It is a generated
covenant, so it is a compiler artifact rather than a limit - and two rounds have since demonstrated exactly
that, cutting its redeem script to **4,121 bytes** with no require removed, weakened or reordered: F4's -129 to
4,542, X65's -444 to 4,098, then X81's +23 to retire a VM-constant-dependent width bound. Because the covenant is instantiated once per
participant and each proof slot pushes the whole redeem script, **a verifier byte is worth N transaction
bytes**, and both cuts were measured landing at exactly that multiplier on all four capstones: F4's 129 x N
(citation, F4), and X65's 444 x N re-measured here as A13 23,458 -> 22,126, C2 52,733 -> 50,957, C1
62,722 -> 60,502, C3 99,670 -> 96,118.

The four figures on the line above are PRE-X81, while the 4,121 verifier figure is POST-X81 - the same line
named X81's +23 without carrying its consequence, which J4 caught as this document's own instance of the
board's recurring failure mode. Post-X81, node-mined at `8685ae91`: **A13 22,195, C2 51,049, C1 60,617, C3
96,302**, each exactly `23 x N` above the figures above (+69/+92/+115/+184 at N=3/4/5/8), with participant
routes byte-identical - so the growth is attributable to the projection and to nothing else.

### Incidental walls - scope decisions and defects, not limits

4. **`initial-v1-route-requires-public-visibility`** (172 refusals, 38% of the total). Its own name says what
   it is: a v1 route scope. Solidity marks entry points `external`; the route admits `public`.
5. **`mixed-scalar-and-collection-route-not-enabled`** (52) and **`collection-helper-route-not-enabled`**
   (52). Between them these turn away `transfer`, `mint`, `burn`, `addLiquidity`, `removeLiquidity` and every
   scalar getter on a contract that also has a mapping. Both are named "not enabled".
6. **`result-route-requires-effect-free-handlers`** (66) and
   **`batched-handler-forward-call-not-enabled`** (22). The forward-call and result machinery exists - the C1
   and E1 capstones exercise returning edges - and these are the gates in front of it.
7. **`LowLevelCallShapeError`** (26 bus-mode compile failures, including BentoBox and Kashi). A shape gate on
   low-level calls carrying call data.
8. **`Unbound return call in __scbN; graph=undefined`** (5). An internal abort with no named refusal, the
   defect class X22 closed one instance of.
9. **The bus-mode-only `ParseError` with a position outside the user's file** (Router02). A compiler defect.
10. **The unnamed refusal** (20). Handlers published `eligible: false` with no `rejectionReason`. Every one
    observed falls on a compiler-synthesized entry point (`__updateBlockOracle`), which is why it is last: a
    hole in the diagnostic channel, not a category of contract.

Items 4 to 6 alone account for 364 of the 455 named refusals (80%), and items 7 to 10 are compiler defects
on top of that. **The dominant reason a real contract cannot join a message-bus graph today is not a BCH
limit.** And for the twelve application contracts that do
clear route admission, the reason composing them would be pointless - a read-only admitted surface - is also
not a BCH limit.

## 7. What this does not prove

- **Not a fit claim.** 45 one-participant transactions were built and measured. Every N > 1 figure is an
  estimate from a calibration fitted on four capstone shapes, and 52-57 of them are flagged outside its
  driver range.
- **No application contract was measured.** None of the twelve has a one-slot block, and the harness cannot
  seed sidecar slots generically. Their landings in section 4.3 are estimates only.
- **No heterogeneous graph was measured or estimated.** The census cannot see which contracts call each
  other. Every N > 1 figure is a replica of one contract, which brackets a real graph but is not one.
- **No two real corpus contracts were composed.** Route admission gates that first, and section 3.2 shows
  the callable surface of every application contract is empty.
- **The solc corpus figure is a 1-in-12 systematic sample**, not the corpus.
- **The write/read split is an upper bound on usefulness.** An absent `writesState` is counted as writing.
- **26 of 71 measured-control candidates were skipped**, mostly on placeholder arguments failing a real
  `require`. The 45 that were measured are not a random subset of the 71.
- **Nothing here is `CONSENSUS_FIT` or `POLICY_FIT`**, and nothing here is `PROVEN`.

## 8. Reproducing

```bash
# census (writes packages/solidcash/test/e2e/layer3-corpus-census-f3.ts)
F3_CORPORA=mistswap,eacc F3_COMMIT=<commit> F3_OUT=<a.json> node \
  packages/solidcash/test/e2e/layer3-corpus-probe-f3.mjs
F3_CORPORA=solidity-by-example ... F3_OUT=<b.json> node .../layer3-corpus-probe-f3.mjs
F3_CORPORA=solc-corpus F3_STRIDE=12 ... F3_OUT=<c.json> node .../layer3-corpus-probe-f3.mjs
F3_ENRICH=<a.json,b.json,c.json> node .../layer3-corpus-probe-f3.mjs   # write classification
F3_MERGE=<a.json,b.json,c.json> F3_COMMIT=<commit> node .../layer3-corpus-probe-f3.mjs

# the report's tests, including the 45 measured graphs
cd packages/solidcash && npx vitest run test/e2e/Layer3CorpusFitF3.test.ts --disable-console-intercept
```
