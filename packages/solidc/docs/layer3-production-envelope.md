# The Layer-3 production envelope

Status: **PROPOSAL for R1.** Selection and enforcement design, with the measurements that decided each
boundary. Nothing in this document is wired into a send path, and nothing here changes any shape's evidence
level. The plan and the completion ledger remain the authorities on task state and on claims.

Harness: `packages/solidcash/test/e2e/layer3-production-envelope-r1.ts` (the rules and the reference gate)
and `packages/solidcash/test/e2e/Layer3ProductionEnvelopeR1.test.ts` (21 tests, re-run green at `1591e87f`).

Every figure below is stamped. Figures marked **measured here** were produced by a run of the harness at
`1591e87f`; figures marked **citation** were taken at another commit and are named as such, because a
recorded number whose consequences were not re-derived has already invalidated one conclusion on this board
(F1 costed C3's overrun against 354 bytes and the fix stopped working at 650).

### R2 reconciliation at `1591e87f` - what this document got wrong, and what it now says

This proposal was written at `8632fb98`. Four things changed under it and are corrected below, each in its
consequence and not only in its number:

1. **`standard-output-template` is gone.** X64 measured a BCHN v29.0.0 node - on the shared regtest node and
   again on a throwaway container with an explicit `-acceptnonstdtxn=0` - accepting, mining and then
   *spending* a bare `OP_1` output. The rule was **removed** from the harness at `6ab3bc12`, not relabelled.
   The envelope is **eleven** rules and **no rule in it is unmeasured**. Section 6.1, which asked for the
   decision, is replaced by the decision.
2. **C3 is no longer outside the envelope.** F4 cut the projection verifier by 129 bytes, which is worth 129
   bytes *per participant*, and X60 raised C3's placeholder output from 10 satoshis to 1,000. C3 was then
   executed, accepted and **mined** at **99,670 bytes**, inside the relay ceiling and clear of dust.
3. **A13, C2 and C3 are node-verified** (X59/X60). The evidence rows in section 4 that read `SEMANTIC` on a
   `missing-inputs` verdict were correct when written and are now superseded.
4. **The four false-refusal window figures in sections 1 and 5.1 rested on capstone sizes F4 superseded.**
   They are **dropped rather than restated**, because the harness constant they were computed from
   (`c3SerializedBytesAtBasis = 100_650`, still labelled a `ffef8568` citation) has not been re-pinned and
   this report did not re-measure the capstones. What survives is the direction, which is re-derivable
   without them: every `measured` term shrank while every `predicted` term is unchanged, so every window is
   **wider** than the figures this document used to print, and the conclusion they supported is strengthened.

---

## 1. What the envelope has to be, and what it cannot be

Three findings decided the shape of this proposal. All three are somebody else's measurement.

**A different limit binds first for almost every shape (F1, citation at `4ac40b82`/`ffef8568`).** C1 and A13
bind on the 10,000-byte per-input script limit, C2 on operation-cost density, C3 on the 100,000-byte relay
ceiling, the N=2 sweep on per-input SigChecks. An envelope stated as one number would be wrong about four of
the seven measured shapes. The envelope below is therefore eleven independent rules, and the gate reports
*every* violated rule rather than the first, because a user shrinking one limit needs to know about the rest.

C3's binding rule survives its shrink: at the node-mined **99,670 bytes** (citation, X59/X60) relay size
reads 0.9967x while its worst-input operation-cost density reads 0.9217x (citation, the ledger's X47
correction), so relay size is still the tightest rule for C3. What changed is that C3 is now *inside* it.

**The refusal no capacity measurement would ever have found was dust (X49, citation, BCHN v29.0.0 regtest).**
C1 is inside every capacity limit and the node still refused it, for a 10-satoshi output to a one-byte `OP_1`
script against a 474-satoshi threshold. It was invisible for the whole effort because the Layer-3 semantic
profile sets `enforceDust: false` and `MockNetworkProvider` then sets `dustRelayFeePerKb: 0n`.

**The estimator cannot be the gate, in either direction (F2, re-measured here).** F2 is conservative in
sample by construction and is *not* conservative out of sample. Re-derived at `1591e87f`: worst in-sample
over-prediction **+41.6%**, worst out-of-sample in-range under-prediction **-12.3%** (on `C1 DeFi / worst
unlocking bytes`). Both allowances are properties of the calibration, not of any capstone build, and neither
moved. Refusing on `predicted > limit` therefore produces false refusals across a window on every capstone;
admitting on `predicted <= limit` produces false admissions across a 12.3% band.

**The four window widths this paragraph used to print are dropped, not restated.** They were
`predicted - measured` over the capstones, and F4 moved every `measured` term. The predictions are unchanged
and re-derived here (A13 28,938 B, C2 59,548 B, C1 65,397 B, C3 112,955 B); the harness's `measured` terms
are not re-pinned, and this report did not rebuild the capstones. The consequence is re-derivable without the
widths and is the one the design rests on: each capstone got **smaller** while its prediction did not, so
each false-refusal window is now **wider**.

---

## 2. The selected envelope

Eleven rules. `evidence` grades the **rule's threshold**, not any shape measured against it, and is separate
from the board's `SEMANTIC` / `CONSENSUS_FIT` / `POLICY_FIT` ladder, which grades shapes. **Measured here:**
the rule ids, regimes, scopes, byte-versus-VM split and evidence labels in this table are read back out of
`PRODUCTION_ENVELOPE_RULES` and asserted against it by `Layer3EnvelopeDocR2.test.ts`, so this table cannot
drift from the harness again without failing the suite.

| rule id | regime | scope | decidable from | threshold | evidence |
| --- | --- | --- | --- | --- | --- |
| `relay-transaction-size` | policy | transaction | bytes | 100,000 B | **NODE_MEASURED** |
| `output-dust` | policy | output | bytes | `3 * (serialized + 148)` sat | **NODE_MEASURED** |
| `scriptsig-push-only` | policy | input | bytes | pure push sequence | **NODE_MEASURED** |
| `input-unlocking-bytes` | consensus | input | bytes | 10,000 B | LIBAUTH_PINNED |
| `consensus-transaction-size` | consensus | transaction | bytes | 1,000,000 B | LIBAUTH_PINNED |
| `standard-locking-bytes` | policy | output | bytes | 201 B | LIBAUTH_PINNED |
| `operation-cost-density` | consensus | input | VM | 800 per density byte | LIBAUTH_PINNED |
| `hash-iteration-density` | consensus | input | VM | 0.5/byte standard, 3.5/byte consensus | LIBAUTH_PINNED |
| `per-input-sigchecks` | consensus | input | VM | `floor((unlocking + 60) / 43)` | LIBAUTH_PINNED |
| `transaction-sigchecks` | consensus | transaction | VM | 3,000 | LIBAUTH_PINNED |
| `input-accepted` | consensus | input | VM | evaluates in both regimes | LIBAUTH_PINNED |

**No rule in this envelope is unmeasured.** The one that was - `standard-output-template`, the twelfth row of
the table this document used to print - was measured out of existence by X64 and removed at `6ab3bc12`. Its
classifier survives in the harness as `standardOutputTemplate`, which still *names* what an output is;
nothing refuses on it. Section 6.1 records the decision.

**Six of the eleven need no VM.** Transaction size, dust, both bytecode lengths and push-only are pure
arithmetic on bytes the builder has already produced. That matters for enforcement: the majority of the
envelope can be checked on every transaction the SDK builds at effectively zero cost.

### The dust rule, re-derived rather than cited

BCHN's `GetDustThreshold` is `3 * dustRelayFee.GetFee(GetSerializeSize(txout) + 148)`, which at the default
1,000 sat/kB is `3 * serialized + 444`. **Re-measured here** at `1591e87f`, all three unchanged:

| output | serialized | threshold |
| --- | --- | --- |
| one-byte `OP_1` script (C1's output 15 shape) | 10 B | **474 sat** |
| P2PKH | 34 B | **546 sat** |
| p2sh32 | 44 B | **576 sat** |

Two independent cross-checks, both in the harness. The SDK's own `calculateDust`
(`packages/solidcash/src/utils.ts`), written as `444 + outputSize * 3`, returns the same three numbers - the
same arithmetic with the multiplication distributed. And 546 is the universally agreed P2PKH dust limit,
which falls out of the formula with nothing fitted: a formula that reproduces a constant nobody in this
repository chose is a formula, not a curve through one point.

**The rule was correct, present and reachable. It was switched off.** `TransactionBuilder.addOutputs` calls
`validateOutput(output, this.provider.policy?.enforceDust ?? true)`. Measured here: a provider with
`enforceDust: true` throws `... less than the required minimum for this output-type (474)` on C1's exact
output; the identical call on a provider with `enforceDust: false` does not. The Layer-3 semantic profile
sets it false, legitimately, because it is a SEMANTIC fixture profile. **A production envelope therefore
cannot be a policy flag on the provider.**

### A correction to F1's binding-limit table

**Re-measured here at `1591e87f`**, all three readings unchanged. Adding one rule F1 did not model changes
which rule is tightest for two of the seven shapes:

| shape | F1's binding limit (citation) | tightest rule with dust modelled (measured here) |
| --- | --- | --- |
| sweep N=2 | per-input SigChecks 0.2500x | **`output-dust` 0.2880x** at output 2 |
| sweep N=4 | op-cost density 0.2570x | **`output-dust` 0.2880x** at output 4 |
| sweep N=8 | op-cost density 0.3630x | op-cost density 0.3630x at input 1 (unchanged) |

The 0.2880x is the 2,000-satoshi p2sh32 change output against its 576-satoshi threshold. The comparison is
fair because every reading is expressed as the fraction of the distance to refusal, and dust is expressed as
threshold-over-value so that 1.0000x is its boundary too. This is not a defect in F1; it is the direct
consequence of X49's finding that a capacity measurement which does not model dust is not measuring the
envelope, and the shape it misses first is the smallest one.

---

## 3. Where the boundary is drawn inside what is merely possible

Three choices, each with its cost measured.

### 3.1 Relay, not mining

**The envelope targets relay.** An SDK that hands a user bytes no peer will forward has not built them a
transaction; getting them mined requires a direct relationship with a miner, which is not a property of an
SDK.

The distinction is real and was settled on a node: X49 got **101,513 bytes** refused `64: tx-size` by the
mempool and then **accepted in a hand-assembled block** (citation, X49, BCHN v29.0.0 regtest). The
100,000-byte ceiling is therefore **policy, not consensus**, and a shape can be mineable and unrelayable.

**Cost of this choice across the current corpus: nothing.** When this section was written it cost exactly one
shape by 0.65% - C3, then 100,650 bytes. F4's 129-byte cut to the projection verifier is worth 129 bytes per
participant and C3 has eight, so C3 came down to **99,670 bytes** as executed, accepted and mined
(citation, X59/X60). No shape in the corpus is now outside a policy limit and inside consensus, so choosing
relay over mining refuses nothing that has been built. That is a fact about today's corpus and not an
argument for a wider envelope: the 101,513-byte transaction is what the distinction is *for*, and the next
graph that grows past 100,000 bytes meets it again.

### 3.2 Exact limits at build time; headroom only where the number is uncertain

The natural instinct is to set the production ceiling below the network's. **This proposal does not**, and
the reason is that the build-time measurement is *exact*: the serialized size of a finalized transaction is
not an estimate. Any headroom there is a guaranteed false refusal of a transaction the network accepts.

Headroom belongs where the number is uncertain, which is plan time, and its size is then **measured rather
than chosen**: `limit / (1 + worst measured out-of-sample under-prediction)`. Re-derived here, that puts the
plan-time CLEAR threshold for relay size at **89,057 bytes** - 10.9% of headroom, none of it invented.

### 3.3 The envelope is stated in transaction terms, not in participant terms

The instinct to say "supported up to N participants" is refuted by the corpus. **Re-measured here at
`1591e87f`**, the participant-binding sweep at N=8 is 10,661 serialized bytes, 10.66% of the relay ceiling;
C3 at the same participant count is 99,670 bytes (citation, X59/X60), 99.67% of it - **the same participant
count, 9.35x the bytes**. The gap narrowed with C3's shrink and the argument does not depend on its width.
X47 already found the ledger's "N=8 participant binding at 36.5%" misleading for this reason.
The planner's own `MAX_GRAPH_PARTICIPANTS = 8` and `MAX_GRAPH_INVOCATIONS = 24` remain as structural bounds;
this envelope adds no second, different participant cap, because participant count is not what binds.

---

## 4. Supported, supported with caveats, out of envelope

| class | evidence | status |
| --- | --- | --- |
| Participant-binding composition, N = 2, 4, 8. **Re-measured here at `1591e87f`** at 2,429 / 4,977 / 10,661 serialized bytes - reproducing F1's figures exactly - and admitted on all eleven rules. Tightest reading across the three is 0.3630x (op-cost density at N=8); at N=2 and N=4 it is 0.2880x on dust. | **`CONSENSUS_FIT`** - real UTXOs, executed, **accepted and mined** by BCHN v29.0.0 (citation, X49). | **SUPPORTED** |
| A13: 3 participants, 8 inputs, **23,458 B** (citation, X59/X60). | **`CONSENSUS_FIT`** - executed, accepted and **mined** by BCHN v29.0.0 on regtest with May 2026 active, `85a78285c463c5b1...` at height 1401, with a hostile control refused on the same chain in the same run and nothing relaxed (citation, the ledger). | **SUPPORTED** |
| C2 heterogeneous cycle: 4 participants, 79 inputs, **52,733 B** (citation, X59/X60). | **`CONSENSUS_FIT`** - `de22608f5f088c1f...` at height 1304, same conditions (citation, the ledger). | **SUPPORTED** |
| C3's maximum graph *as built*: 8 participants, 108 inputs, **99,670 B** (citation, X59/X60) - inside the relay ceiling by 330 bytes, and clear of dust since X60 raised its `OP_1` placeholder from 10 satoshis to 1,000. | **`CONSENSUS_FIT`** - `5eb1fdb123cdcd44...` at height 1090, same conditions (citation, the ledger). | **SUPPORTED.** This row read *OUT OF ENVELOPE at 100,650 B, 650 over relay* before F4 and X60. |
| C1's DeFi graph: 5 participants, 38 inputs, **62,722 B** (citation, X59/X60). Inside every capacity rule, and its dust defect is fixed. | **`SEMANTIC`.** **C1 is the one capstone that is NOT node-verified**: it executes on the node and fails `mandatory-script-verify-flag-failed` at inputs 2-6, blocked by a provider defect - `RegtestNetworkProvider.addUtxo` ignores `token.category` and silently mints a fresh genesis - and not by the capstone (citation, the ledger). | **SUPPORTED WITH CAVEATS** |
| E1 result graph: 6 participants, 19 inputs, 68,904 B, 0.6890x (citation, `ffef8568`, **not re-measured** - this figure predates F4's per-participant cut and is an upper bound on today's build). | **`SEMANTIC` only.** The node returned `missing-inputs`, so it stopped before executing anything and the script validity is libauth's. | **SUPPORTED WITH CAVEATS** |
| Any transaction carrying an output below its dust threshold. | **NODE_MEASURED** | **OUT OF ENVELOPE** |
| Any descriptor outside F2's calibrated driver ranges (e.g. participants + invocations > 16). | none - an upper envelope carries no guarantee outside its fitted range | **NOT SCREENABLE.** WARN at plan time, never CLEAR; the build-time gate still decides |

An output on a non-standard template was a row in this table and is not one now: **BCHN v29 does not enforce
an output-script template** (X64, measured on the shared node and again with `-acceptnonstdtxn=0`). See 6.1.

Three honest gaps in that table, stated rather than smoothed:

- **`POLICY_FIT` remains supported for nothing.** The node-mined rows above are `CONSENSUS_FIT`: a regtest
  node running default policy accepted and mined them. That is not the BCHN standard-policy configuration,
  and passing this gate is not `POLICY_FIT` either - it is agreement with the rules a node was measured
  enforcing. What X64 measured under `-acceptnonstdtxn=0` was individual **output shapes**, not a capstone.
- **The gate in this harness has still not been run against A13, C2, C1 or C3 themselves.** Their builders
  are file-local and unexported (the obstacle X59 names). What is measured here is their *rules*: the exact
  boundary, the exact dust arithmetic, and the exact output shapes those fixtures build, taken from source.
- **The capstone byte figures above are citations, not measurements taken here.** Rebuilding them costs
  roughly fifteen minutes each and a live node. Every one is attributed to the run that produced it.

---

## 5. How it should be enforced

### 5.1 Two instruments, and only one of them refuses

**Plan time - a screen, three verdicts, and only one is a refusal.** Built on F2's estimator, which needs no
UTXO, no builder and no VM:

- `CLEAR` when `predicted <= limit / (1 + underPrediction)`. Not a guarantee. The gate still decides.
- `WARN` between the thresholds. The estimator cannot separate fit from overrun here and says so.
- `REFUSE` when `predicted > limit * (1 + overPrediction)`. No measured over-prediction can explain the gap.

**Re-measured here at `1591e87f`, and this is the decisive result for the design:** with the allowances
derived from the calibration (over +41.6%, under 12.3%), the four capstone descriptors screen A13 `CLEAR`,
C2 `CLEAR`, C1 `CLEAR`, C3 `WARN`. **Nothing in the corpus reaches `REFUSE`** - for relay size the CLEAR
threshold is 89,057 B and the REFUSE threshold is 141,562 B, while the largest shape ever built predicts
112,955. A plan-time hard refusal is therefore *nearly unreachable*, which is not a reason to widen it: it is
the measurement that says the gate has to be somewhere else.

The verdicts are unchanged and the reason they *mean* something different is worth stating. The screen reads
descriptors, not builds, so F4's shrink moved none of these predictions. What moved is the truth they are
being scored against: C3 screens `WARN` while now being **inside** the envelope, so the one shape the screen
declined to clear is a shape it would have been wrong to refuse. That is the same finding the design already
rests on - the screen advises and the gate decides - reached from the other side.

**Build time - the gate, on the finalized bytes, fail-closed.** `assessProductionEnvelope` takes the
transaction and its source outputs and takes **no plan, no builder and no provider**:

- not a plan, because the bytes are what the network judges. **Re-measured here:** one descriptor, two
  builds, one with an output appended after planning; the plan screen returns a byte-identical verdict for
  both and the gate admits one and refuses the other;
- not a provider, because `provider.consensusLimits` is exactly what made every existing Layer-3 capacity
  check vacuous. **Re-measured here at `1591e87f`:** `MockNetworkProvider`'s defaults are **100x** the real
  transaction-size ceiling, **100x** the per-input script limit, **12,500x** the operation-cost budget and
  **20,000,000x** the standard hash-iteration allowance.

`bytesOnly` exists so a caller can take the six free rules without the five expensive ones. **A cheap check
narrows the work and never widens the admission:** every skipped rule is reported in `undecided`, and a
non-empty `undecided` forces `admitted: false`. A caller asking for the cheap answer gets INCOMPLETE, never
ADMIT.

### 5.2 Where the gate has to sit, and what is unchecked today

**Re-measured at `1591e87f`:** `packages/solidcash/src/` contains **8 call sites** that hand bytes to
`provider.sendRawTransaction` outside the provider implementations themselves - unchanged in count.
**Exactly one** of them - `src/layer3/preflight.ts:99`, inside `sendPreflightedLayer3Transaction` - runs the
Layer-3 gate. The other seven are `TransactionBuilder.send()` (`TransactionBuilder.ts:901`),
`StatefulTransactionBuilder.send()` (`:2899`) and five sites in `StatefulContract.ts` (`:3055`, `:3238`,
`:10067`, `:10207`, `:11095`), two of which carry the explicit comment "Build and send directly (bypass
debug step which doesn't handle covenant unlockers)" (`:10067`, `:10207`) and a third of which is named
`_sendBuilderWithCustomUnlockers` (`:3238`) - custom unlockers being exactly the class Layer-3 route
unlockers belong to.

`src/layer3/transcript.ts:358` returns a plain `TransactionBuilder`, so `.send()` is available on every
Layer-3 builder the SDK produces. **Re-measured at `1591e87f`: 4 test files** use
`sendPreflightedLayer3Transaction`; **14 of the 100** `Layer3*` e2e files broadcast through `.send(`. The
gated share of the corpus fell as the corpus grew - it was 3 files against 84 at `8632fb98` - so the
placement argument below is stronger than when it was written, not weaker. Beyond the eight,
`TransactionBuilder.build()` and `generateWcTransactionObject()` hand raw bytes out of the SDK entirely, and
an external wallet broadcasts them.

**Two defects in the one gate that does exist**, both measured:

1. **It reads the provider's limits.** `evaluateEveryInput` at `preflight.ts:55` calls
   `createVirtualMachineBch2026ForProvider(builder.provider)`. Under the semantic profile that is a
   10,000,000-byte transaction ceiling and a 10,000,000-per-byte operation budget. The check passes
   vacuously.
2. **A per-input evaluation is the wrong *shape* of instrument for two of the rules.** Transaction size and
   output dust are properties of the transaction and of its outputs, and no per-input script evaluation can
   observe either however correct its limits are. **Re-measured here at `1591e87f`:** a **synthetic**
   100,650-byte transaction carrying a 10-satoshi `OP_1` output produces **zero** per-input refusals at the
   real standard profile *and* at the real consensus profile, while the gate refuses on two rules. The
   100,650 is now a synthetic size and no longer C3's: the harness still carries it as
   `c3SerializedBytesAtBasis`, labelled a `ffef8568` citation, and that constant has not been re-pinned since
   F4 and X59/X60 brought C3 to 99,670 bytes. The demonstration does not depend on the number.

**Proposed placement.** The six byte rules belong at `TransactionBuilder.build()` and
`TransactionBuilder.send()` - the two points where final bytes leave the builder - and at the
`StatefulTransactionBuilder` equivalents, *not* at `buildLibauthTransaction()`, which is also called on
intermediate states during sidecar co-spend planning (`TransactionBuilder.ts:442-443` save and `:477-478`
restore the input and output lists) and by the measurement probes. `generateWcTransactionObject()` calls
`build()` and is therefore covered. The five VM rules belong in `evaluateEveryInput`, with the provider's
limits replaced by the fixed production constants.

**A fail-closed boundary must never become an unchecked witness path.** Two consequences of that rule that
this proposal is built around:

- the gate is keyed on the serialized transaction, so a mutation after the plan cannot slip past it. This is
  not hypothetical, and it is **re-measured at `1591e87f`**: `TransactionBuilder` mutates `this.outputs` at
  **six** places and only one of them - `addOutputs` at `:576`, whose `validateOutput` call is at `:573` -
  checks anything. Two of the rest are **persistent** auto-co-spend splices (`:406` ecrecover, `:545` the
  dynamic keccak loop) that `send()` performs *before* it builds, and one (`:650`) adds an OP_RETURN. So the
  SDK itself appends outputs that the only dust check never sees;
- refusing at `sendPreflightedLayer3Transaction` alone would leave `.send()` as the witness path, and
  `.send()` is what 14 of the 100 `Layer3*` e2e files actually use.

### 5.3 The diagnostic

The board's standing preference is a named diagnostic over a late failure. Every rule carries a stable `id`
that the refusal quotes, the location (`input 3`, `output 15`, `transaction`), the measured value, the
allowed value and the overrun in the rule's own units. Measured example, verbatim from the run:

```
REFUSED output-dust at output 4: 464 satoshis short of the 474-satoshi threshold
for a 10-byte output; the node refuses `64: dust`
```

Every violated rule is reported, not only the first. This paragraph used to say that C1's placeholder is
refused by `output-dust` **and** `standard-output-template`, and that raising the value to 474 closes the
first and leaves the second. **Re-measured at `1591e87f`: the 10-satoshi placeholder is refused by
`output-dust` alone, and the 1,000-satoshi placeholder is refused by nothing.** The second rule does not
exist; the multi-rule reporting is a property of the gate and is exercised elsewhere - a transaction that is
both over the relay ceiling and carrying a dust output is refused on both, measured.

**Liveness, per rule.** Every one of the six byte rules has a case in the harness that trips it, so a rule
that silently stopped being checked fails the suite rather than silently widening the envelope. This is F1's
knob-liveness discipline applied to a gate instead of to a VM knob.

---

## 6. Flagged for a decision, not assumed

Defaults are ON in this codebase and nothing here proposes a new flag. Three things nevertheless need an
explicit decision rather than a default chosen by whoever writes the code. A fourth was decided; 6.1 records
it rather than re-opening it.

### 6.1 `standard-output-template` - DECIDED, and the rule is gone

This section used to ask for a decision. It got one, and the answer went the other way from the
recommendation it made.

The recommendation was *keep the rule and measure a mainnet-configured node*. X64 ran that measurement and
found **the rule does not exist**. A BCHN v29.0.0 node - the shared regtest node, and again a throwaway
container started with an explicit `-acceptnonstdtxn=0` - was measured refusing a 10-satoshi bare `OP_1`
output `64: dust` and *not* refusing the same one-byte script at 1,000 satoshis. The dust row is what makes
that readable: it is the same script at a lower value, so the per-output policy loop demonstrably runs before
input lookup and demonstrably reaches this script. It looked and declined to refuse. And the form that owes
nothing to that argument: a real 1,000-satoshi bare `OP_1` output was funded through the node, accepted,
mined, and then redeemed with an **empty** unlocking script, with the spend accepted.

**The rule was removed rather than relabelled** (`6ab3bc12`), on the principle that an envelope which refuses
what the node accepts is not conservative, it is wrong - and this one would have kept two working shapes out.
`standardOutputTemplate` survives in the harness as a classifier that names what an output is; nothing
refuses on it.

**What this does and does not say about mainnet.** No mainnet node was queried. What was measured is the code
path a mainnet node takes: `-acceptnonstdtxn=0` forces `fRequireStandard`, which is the only chain-derived
input to whether `IsStandardTx` runs at all, and the output templates it applies are not parameterized by
chain. A mainnet difference would have to come from a policy option set differently, not from this rule.

**The consequence for the bare-`OP_1` placeholder, re-measured at `1591e87f`.** This section used to report
eighteen e2e fixtures building such an output, in two values, with the 10-satoshi spelling the only real
defect. Both halves have moved: **22** test files now build a bare `OP_1` output and **none of them is at 10
satoshis** - X60 raised every one to 1,000 or above. So the placeholder is no longer refused by any rule in
this envelope, by either mechanism: dust no longer applies to it, and the template rule no longer exists.

Full table and controls: `Layer3OutputTemplateX64.test.ts`, and the comment block in
`layer3-production-envelope-r1.ts` where the rule used to stand.

### 6.2 Turning the byte rules on at `build()` refuses shapes that build today

The dust rule is already default-on at `addOutput`; moving it to the final bytes closes the
`TransactionBuilder.ts:467` and transcript-derivation bypasses. But it also newly refuses any fixture that
sets `enforceDust: false` and then relies on it. **This is not a gate on a feature** - it is a refusal to
build a transaction the network refuses - but its blast radius has not been measured, and X14 measured an
analogous wiring as rejecting 44.5% of settling sends. **A measurement of what the six byte rules would
refuse across the existing suite is required before this lands. Decision required on whether to run it as a
non-default profile first.**

One input to that decision moved and narrows it: X60 raised every bare-`OP_1` placeholder in the test tree
above the dust threshold, so the fixture class this section was most worried about no longer trips the dust
rule. **Re-measured at `1591e87f`: zero of the 22 files carrying such an output is at 10 satoshis.** That
does not measure the blast radius - other output shapes are untouched - but it removes the one instance
already known to be in it.

### 6.3 Whether `POLICY_FIT` should mean "with margin"

Section 1 of the plan defines `POLICY_FIT` as accepted by the BCHN standard-policy configuration *and*
retaining "the selected production headroom". This proposal puts the headroom at plan time (measured at
10.9%) and none at build time (argued in 3.2). If the board wants `POLICY_FIT` to carry a build-time margin,
that is a different envelope and the margin has to be selected explicitly, because no measurement in this
corpus produces it. **Decision required.**

### 6.4 Replacing the provider's limits in `evaluateEveryInput` is a tightening

It is a small change and it may newly refuse fixtures that pass today only because the mock's limits are
12,500x the real operation-cost budget. That has not been measured. **Required before the change lands.**

---

## 7. What this does not prove

- **It does not promote anything.** The promotions recorded in section 4 are X59/X60's node runs, not this
  document's; this document reports them. Nothing anywhere is `POLICY_FIT`. Passing this gate is agreement
  with a rule set, not evidence about a shape.
- **It does not measure A13, C2, C1 or C3 through the gate.** Their builders are unexported (X59). What is
  measured is the rules and the exact output shapes their sources build.
- **It changes no behaviour.** No `src/` file is touched; the gate is a reference implementation in the test
  tree so the placement decision can be made against something that runs.
- **It does not establish that the six byte rules are the complete standard-policy set.** X49 enumerated
  four rules the regtest node enforces and X64 measured one it does not. Package and ancestor limits,
  minimum relay fee, and the rest of `IsStandardTx` are unmeasured and unmodelled here, as F1 left them.
- **The estimator error allowances rest on a seven-point calibration.** They are re-derived here, not
  re-earned; a seven-point upper envelope does not generalise and F2 says so itself.
- **The capstone sizes it carries are citations and the harness's own copies of them are stale.** This
  document re-derives every rule, threshold and screen verdict at `1591e87f`, and re-derives no capstone
  build. `c3SerializedBytesAtBasis = 100_650` in the harness, and the four `measured` terms behind the
  dropped false-refusal windows, still hold pre-F4 values. Re-pinning them is somebody's open row.
