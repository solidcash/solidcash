# The Layer-3 production envelope

Status: **PROPOSAL for R1.** Selection and enforcement design, with the measurements that decided each
boundary. Nothing in this document is wired into a send path, and nothing here changes any shape's evidence
level. The plan and the completion ledger remain the authorities on task state and on claims.

Harness: `packages/solidcash/test/e2e/layer3-production-envelope-r1.ts` (the rules and the reference gate)
and `packages/solidcash/test/e2e/Layer3ProductionEnvelopeR1.test.ts` (21 tests, green at `6a0a0b69`).

Every figure below is stamped. Figures marked **measured here** were produced by a run of the harness at
`6a0a0b69`; figures marked **citation** were taken at another commit and are named as such, because a
recorded number whose consequences were not re-derived has already invalidated one conclusion on this board
(F1 costed C3's overrun against 354 bytes and the fix stopped working at 650).

---

## 1. What the envelope has to be, and what it cannot be

Three findings decided the shape of this proposal. All three are somebody else's measurement.

**A different limit binds first for almost every shape (F1, citation at `4ac40b82`/`ffef8568`).** C1 and A13
bind on the 10,000-byte per-input script limit, C2 on operation-cost density, C3 on the 100,000-byte relay
ceiling, the N=2 sweep on per-input SigChecks. An envelope stated as one number would be wrong about four of
the seven measured shapes. The envelope below is therefore twelve independent rules, and the gate reports
*every* violated rule rather than the first, because a user shrinking one limit needs to know about the rest.

**The refusal no capacity measurement would ever have found was dust (X49, citation, BCHN v29.0.0 regtest).**
C1 is inside every capacity limit and the node still refused it, for a 10-satoshi output to a one-byte `OP_1`
script against a 474-satoshi threshold. It was invisible for the whole effort because the Layer-3 semantic
profile sets `enforceDust: false` and `MockNetworkProvider` then sets `dustRelayFeePerKb: 0n`.

**The estimator cannot be the gate, in either direction (F2, re-measured here).** F2 is conservative in
sample by construction and is *not* conservative out of sample. Re-derived at `6a0a0b69`: worst in-sample
over-prediction **+41.6%**, worst out-of-sample in-range under-prediction **-12.3%** (on `C1 DeFi / worst
unlocking bytes`). Refusing on `predicted > limit` therefore produces false refusals across windows measured
at **A13 5,093 B, C2 6,299 B, C1 2,082 B, C3 12,305 B** of serialized size; admitting on `predicted <= limit`
produces false admissions across a 12.3% band.

---

## 2. The selected envelope

Twelve rules. `evidence` grades the **rule's threshold**, not any shape measured against it, and is separate
from the board's `SEMANTIC` / `CONSENSUS_FIT` / `POLICY_FIT` ladder, which grades shapes.

| rule id | regime | scope | decidable from | threshold | evidence |
| --- | --- | --- | --- | --- | --- |
| `relay-transaction-size` | policy | transaction | bytes | 100,000 B | **NODE_MEASURED** |
| `output-dust` | policy | output | bytes | `3 * (serialized + 148)` sat | **NODE_MEASURED** |
| `scriptsig-push-only` | policy | input | bytes | pure push sequence | **NODE_MEASURED** |
| `input-unlocking-bytes` | consensus | input | bytes | 10,000 B | LIBAUTH_PINNED |
| `consensus-transaction-size` | consensus | transaction | bytes | 1,000,000 B | LIBAUTH_PINNED |
| `standard-locking-bytes` | policy | output | bytes | 201 B | LIBAUTH_PINNED |
| `standard-output-template` | policy | output | bytes | p2pkh / p2sh20 / p2sh32 / OP_RETURN | **UNMEASURED_CONSERVATIVE** |
| `operation-cost-density` | consensus | input | VM | 800 per density byte | LIBAUTH_PINNED |
| `hash-iteration-density` | consensus | input | VM | 0.5/byte standard, 3.5/byte consensus | LIBAUTH_PINNED |
| `per-input-sigchecks` | consensus | input | VM | `floor((unlocking + 60) / 43)` | LIBAUTH_PINNED |
| `transaction-sigchecks` | consensus | transaction | VM | 3,000 | LIBAUTH_PINNED |
| `input-accepted` | consensus | input | VM | evaluates in both regimes | LIBAUTH_PINNED |

**Seven of the twelve need no VM.** Transaction size, dust, both bytecode lengths, the output template and
push-only are pure arithmetic on bytes the builder has already produced. That matters for enforcement: the
majority of the envelope can be checked on every transaction the SDK builds at effectively zero cost.

### The dust rule, re-derived rather than cited

BCHN's `GetDustThreshold` is `3 * dustRelayFee.GetFee(GetSerializeSize(txout) + 148)`, which at the default
1,000 sat/kB is `3 * serialized + 444`. **Measured here** at `6a0a0b69`:

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

**Measured here**, adding one rule F1 did not model changes which rule is tightest for two of the seven
shapes:

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

C3 is **inside every consensus limit** and 650 bytes outside one policy limit. X49 settled that this is
policy and not consensus by getting the same 101,513 bytes refused `64: tx-size` by the mempool and then
**accepted in a hand-assembled block**. So C3 is mineable and unrelayable.

**The envelope targets relay.** An SDK that hands a user bytes no peer will forward has not built them a
transaction; getting them mined requires a direct relationship with a miner, which is not a property of an
SDK. **Cost of this choice, measured across the whole corpus: exactly one shape, by 0.65%.**

### 3.2 Exact limits at build time; headroom only where the number is uncertain

The natural instinct is to set the production ceiling below the network's. **This proposal does not**, and
the reason is that the build-time measurement is *exact*: the serialized size of a finalized transaction is
not an estimate. Any headroom there is a guaranteed false refusal of a transaction the network accepts.

Headroom belongs where the number is uncertain, which is plan time, and its size is then **measured rather
than chosen**: `limit / (1 + worst measured out-of-sample under-prediction)`. Re-derived here, that puts the
plan-time CLEAR threshold for relay size at **89,057 bytes** - 10.9% of headroom, none of it invented.

### 3.3 The envelope is stated in transaction terms, not in participant terms

The instinct to say "supported up to N participants" is refuted by the corpus. At N=8 the participant-binding
sweep sits at 10.7% of the relay ceiling and C3 sits at 100.65% of it - **the same participant count, 9.4x
the bytes**. X47 already found the ledger's "N=8 participant binding at 36.5%" misleading for this reason.
The planner's own `MAX_GRAPH_PARTICIPANTS = 8` and `MAX_GRAPH_INVOCATIONS = 24` remain as structural bounds;
this envelope adds no second, different participant cap, because participant count is not what binds.

---

## 4. Supported, supported with caveats, out of envelope

| class | evidence | status |
| --- | --- | --- |
| Participant-binding composition, N = 2, 4, 8. Measured here at 2,429 / 4,977 / 10,661 serialized bytes, admitted on all twelve rules, tightest reading 0.3630x. | **`CONSENSUS_FIT`** - real UTXOs, executed, **accepted and mined** by BCHN v29.0.0 (citation, X49). Sizes reproduce F1's exactly at this commit. | **SUPPORTED** |
| Composed `L3GRAPH1` graphs whose finalized transaction passes all twelve rules. Measured instances (citation, `ffef8568`): A13 3 participants / 8 inputs / 23,845 B / 0.5131x; C2 4 / 79 / 53,249 B / 0.6491x; E1 result graph 6 / 19 / 68,904 B / 0.6890x. | **`SEMANTIC` only.** The node returned `missing-inputs` for all of these, so it **stopped before executing anything** and their script validity is libauth-only. | **SUPPORTED WITH CAVEATS** |
| C1's DeFi graph *shape*: 5 participants, 38 inputs, 63,315 B, worst script 0.7451x. Inside every capacity rule. | `SEMANTIC`; and the node refused the built transaction `64: dust`. | **SUPPORTED WITH CAVEATS - the shape is in, that build is out** |
| C3's maximum graph *as built*: 8 participants, 108 inputs, **100,650 B**, 650 over relay. | `SEMANTIC`; node `64: tx-size`; same bytes mined in a submitted block. | **OUT OF ENVELOPE** |
| Any transaction carrying an output below its dust threshold. | **NODE_MEASURED** | **OUT OF ENVELOPE** |
| Any transaction carrying an output on a non-standard template. | **UNMEASURED_CONSERVATIVE** - see 5.2, this is the open decision | **OUT OF ENVELOPE as proposed** |
| Any descriptor outside F2's calibrated driver ranges (e.g. participants + invocations > 16). | none - an upper envelope carries no guarantee outside its fitted range | **NOT SCREENABLE.** WARN at plan time, never CLEAR; the build-time gate still decides |

Three honest gaps in that table, stated rather than smoothed:

- **A13's and C2's dust and template status was never measured on a node.** X49 got dust verdicts only for
  C1 and C3; for A13 and C2 the node stopped at `missing-inputs`. Their capacity readings are libauth's.
- **The gate in this harness has not been run against A13, C2, C1 or C3 themselves.** Their builders are
  file-local and unexported (the same obstacle X59 names), and re-running them costs roughly fifteen minutes.
  What is measured here is their *rules*: the exact boundary, the exact dust arithmetic, and the exact output
  shapes those fixtures build, taken from their source.
- **`POLICY_FIT` remains supported for nothing.** Passing this gate is not `POLICY_FIT`; it is agreement with
  the rules a node was measured enforcing, plus one rule that was not measured at all.

---

## 5. How it should be enforced

### 5.1 Two instruments, and only one of them refuses

**Plan time - a screen, three verdicts, and only one is a refusal.** Built on F2's estimator, which needs no
UTXO, no builder and no VM:

- `CLEAR` when `predicted <= limit / (1 + underPrediction)`. Not a guarantee. The gate still decides.
- `WARN` between the thresholds. The estimator cannot separate fit from overrun here and says so.
- `REFUSE` when `predicted > limit * (1 + overPrediction)`. No measured over-prediction can explain the gap.

**Measured here at `6a0a0b69`, and this is the decisive result for the design:** with the allowances derived
from the calibration (over +41.6%, under 12.3%), the four capstone descriptors screen A13 `CLEAR`, C2
`CLEAR`, C1 `CLEAR`, C3 `WARN`. **Nothing in the corpus reaches `REFUSE`** - for relay size the CLEAR
threshold is 89,057 B and the REFUSE threshold is 141,562 B, while the largest shape ever built predicts
112,955. A plan-time hard refusal is therefore *nearly unreachable*, which is not a reason to widen it: it is
the measurement that says the gate has to be somewhere else.

**Build time - the gate, on the finalized bytes, fail-closed.** `assessProductionEnvelope` takes the
transaction and its source outputs and takes **no plan, no builder and no provider**:

- not a plan, because the bytes are what the network judges. **Measured here:** one descriptor, two builds,
  one with an output appended after planning; the plan screen returns a byte-identical verdict for both and
  the gate admits one and refuses the other;
- not a provider, because `provider.consensusLimits` is exactly what made every existing Layer-3 capacity
  check vacuous. **Measured here:** `MockNetworkProvider`'s defaults are **100x** the real transaction-size
  ceiling, **100x** the per-input script limit, **12,500x** the operation-cost budget and **20,000,000x** the
  standard hash-iteration allowance.

`bytesOnly` exists so a caller can take the seven free rules without the five expensive ones. **A cheap check
narrows the work and never widens the admission:** every skipped rule is reported in `undecided`, and a
non-empty `undecided` forces `admitted: false`. A caller asking for the cheap answer gets INCOMPLETE, never
ADMIT.

### 5.2 Where the gate has to sit, and what is unchecked today

**Re-measured at `6a0a0b69`:** `packages/solidcash/src/` contains **8 call sites** that hand bytes to
`provider.sendRawTransaction` outside the provider implementations themselves. **Exactly one** of them -
`src/layer3/preflight.ts:99`, inside `sendPreflightedLayer3Transaction` - runs the Layer-3 gate. The other
seven are `TransactionBuilder.send()`, `StatefulTransactionBuilder.send()` and five sites in
`StatefulContract.ts`, three of which are documented as deliberately bypassing `send()`.

`src/layer3/transcript.ts:358` returns a plain `TransactionBuilder`, so `.send()` is available on every
Layer-3 builder the SDK produces. **3 test files** use `sendPreflightedLayer3Transaction`; 14 of the 84
Layer-3 e2e files broadcast through `.send(`. Beyond the eight, `TransactionBuilder.build()` and
`generateWcTransactionObject()` hand raw bytes out of the SDK entirely, and an external wallet broadcasts
them.

**Two defects in the one gate that does exist**, both measured:

1. **It reads the provider's limits.** `evaluateEveryInput` at `preflight.ts:55` calls
   `createVirtualMachineBch2026ForProvider(builder.provider)`. Under the semantic profile that is a
   10,000,000-byte transaction ceiling and a 10,000,000-per-byte operation budget. The check passes
   vacuously.
2. **A per-input evaluation is the wrong *shape* of instrument for three of the rules.** Transaction size,
   output dust and output template are properties of the transaction and of its outputs, and no per-input
   script evaluation can observe any of them however correct its limits are. **Measured here:** a
   100,650-byte transaction carrying a 10-satoshi `OP_1` output produces **zero** per-input refusals at the
   real standard profile *and* at the real consensus profile, while the gate refuses on two rules.

**Proposed placement.** The seven byte rules belong at `TransactionBuilder.build()` and
`TransactionBuilder.send()` - the two points where final bytes leave the builder - and at the
`StatefulTransactionBuilder` equivalents, *not* at `buildLibauthTransaction()`, which is also called on
intermediate states during sidecar co-spend planning (`TransactionBuilder.ts:453/467` save and restore the
output list) and by the measurement probes. `generateWcTransactionObject()` calls `build()` and is therefore
covered. The five VM rules belong in `evaluateEveryInput`, with the provider's limits replaced by the fixed
production constants.

**A fail-closed boundary must never become an unchecked witness path.** Two consequences of that rule that
this proposal is built around:

- the gate is keyed on the serialized transaction, so a mutation after the plan cannot slip past it. This is
  not hypothetical: the SDK's own sidecar auto-co-spend appends outputs at `TransactionBuilder.ts:467`
  *after* any external preflight, and those outputs never pass through `validateOutput`;
- refusing at `sendPreflightedLayer3Transaction` alone would leave `.send()` as the witness path, and
  `.send()` is what 14 of the 84 Layer-3 e2e files actually use.

### 5.3 The diagnostic

The board's standing preference is a named diagnostic over a late failure. Every rule carries a stable `id`
that the refusal quotes, the location (`input 3`, `output 15`, `transaction`), the measured value, the
allowed value and the overrun in the rule's own units. Measured example, verbatim from the run:

```
REFUSED output-dust at output 4: 464 satoshis short of the 474-satoshi threshold
for a 10-byte output; the node refuses `64: dust`
```

Every violated rule is reported, not only the first. Measured here: C1's placeholder is refused by
`output-dust` **and** `standard-output-template`; raising the value to 474 closes the first and leaves the
second, which is why they are two rules and not one "bad output" verdict.

**Liveness, per rule.** Every one of the seven byte rules has a case in the harness that trips it, so a rule
that silently stopped being checked fails the suite rather than silently widening the envelope. This is F1's
knob-liveness discipline applied to a gate instead of to a VM knob.

---

## 6. Flagged for a decision, not assumed

Defaults are ON in this codebase and nothing here proposes a new flag. Four things nevertheless need an
explicit decision rather than a default chosen by whoever writes the code.

### 6.1 `standard-output-template` - the rule with the weakest evidence decides the most

This is the important one.

X49 measured that the **regtest** node does **not** enforce scriptPubKey templates, and did not measure a
mainnet node. The rule is in this envelope on the conservative side, labelled `UNMEASURED_CONSERVATIVE`.

**Measured here, and it makes the decision material rather than cosmetic:** the bare `OP_1` placeholder
recipient is not a C1/C3 artifact. **Eighteen** e2e fixtures build an output to a bare `OP_1` script, in two
values:

| value | fixtures | refused by |
| --- | --- | --- |
| 10 satoshis | C1, C3 | `output-dust` **and** `standard-output-template` |
| 1,000 satoshis | `Layer3HeterogeneousCycleC2.test.ts:537`, `Layer3ResultGraph.test.ts:499` | **`standard-output-template` only** |

So the 1,000-satoshi spelling clears dust, the node never reached it (both returned `missing-inputs`), and
the only rule in this envelope that refuses it is the one with no measurement behind it. **Including the rule
takes C2 and the E1 result graph out of the envelope as built; excluding it leaves an unmeasured mainnet
relay risk in eighteen fixtures.** X60 currently names the placeholder for C1 and C3 only; on this
measurement it is corpus-wide.

**Recommendation: keep the rule, and open a row to measure a mainnet-configured node** (`-acceptnonstdtxn=0`,
which X49 already stood up once as a throwaway) so the label can move from `UNMEASURED_CONSERVATIVE` to
`NODE_MEASURED` or the rule can be dropped on evidence. **Decision required.**

### 6.2 Turning the byte rules on at `build()` refuses shapes that build today

The dust rule is already default-on at `addOutput`; moving it to the final bytes closes the
`TransactionBuilder.ts:467` and transcript-derivation bypasses. But it also newly refuses any fixture that
sets `enforceDust: false` and then relies on it. **This is not a gate on a feature** - it is a refusal to
build a transaction the network refuses - but its blast radius has not been measured, and X14 measured an
analogous wiring as rejecting 44.5% of settling sends. **A measurement of what the seven byte rules would
refuse across the existing suite is required before this lands. Decision required on whether to run it as a
non-default profile first.**

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

- **It does not promote anything.** The sweep at N=2/4/8 remains `CONSENSUS_FIT` and everything else remains
  `SEMANTIC`. Nothing is `POLICY_FIT`. Passing this gate is agreement with a rule set, not evidence about a
  shape.
- **It does not measure A13, C2, C1 or C3 through the gate.** Their builders are unexported (X59). What is
  measured is the rules and the exact output shapes their sources build.
- **It changes no behaviour.** No `src/` file is touched; the gate is a reference implementation in the test
  tree so the placement decision can be made against something that runs.
- **It does not establish that the seven byte rules are the complete standard-policy set.** X49 enumerated
  four rules the regtest node enforces and two it does not. Package and ancestor limits, minimum relay fee,
  and the rest of `IsStandardTx` are unmeasured and unmodelled here, exactly as F1 left them.
- **The estimator error allowances rest on a seven-point calibration.** They are re-derived here, not
  re-earned; a seven-point upper envelope does not generalise and F2 says so itself.
