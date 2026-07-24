# Layer-3 target corpus and Milestone-0 baseline

Status: observed-need gate **passes** for one bounded acyclic workload. This document authorizes a
disposable participant-binding spike only. It does not freeze a transcript or authorize production
layer-3 capability metadata.

## 1. Trusted baseline

The preparation baseline is branch `codex/state-bus-research`, commit
`9dba31ba1a3ed9aa0cdf0d8955c9ce08c4004a7a` (2026-07-24). The existing
`.worktrees/state-bus` worktree is the isolated research worktree. A child spike branch/worktree is
required when Milestone 2 begins so that the measured candidate can be discarded without disturbing
the accepted R0-R5 implementation.

The baseline was rebuilt and tested under the repository's BCH-2026 default:

| Gate | Result |
|---|---|
| monorepo `yarn build` | six packages passed |
| `packages/solidc` complete suite | 2,302 passed; two heavy `HiddenBatch` cases hit the suite's 5 s timeout |
| isolated `HiddenBatch` rerun with 30 s timeout | 9/9 passed; the two timed-out shapes completed in 2.88 s and 3.13 s |
| `packages/solidcash` complete suite | 3,261 passed, 24 skipped, 9 todo |

The raw timeout is retained as baseline evidence rather than described as a clean full-suite pass.
It is the already-documented concurrent-CPU measurement flake, not a different result or bytecode.

Artifact invariance is pinned by existing tests:

- `InvocationAnalysis.test.ts` proves invocation analysis does not change emitted bytecode.
- `HiddenBatch.test.ts` proves a disabled experimental capability leaves artifacts byte-identical.
- `MsgSenderCrossContractC2.test.ts` pins the direct route while the R5 corpus tests exercise the
  experimental route.
- `BatchCostRegression.test.ts` pins the R4 parser and R5 two-row resource-route bytes.

Milestone 2 must not modify those fixtures except through an explicit, separately reviewed baseline
change. It must not advertise a layer-3 selector, version, controller prefix, or default capability.

## 2. Selected real workload

The smallest surveyed real acyclic target is Kashi's `depositCollateral(amount)` helper:

```solidity
cook(
  [ACTION_BENTO_DEPOSIT, ACTION_ADD_COLLATERAL],
  [0, 0],
  [
    encode(collateral, caller, amount, 0),
    encode(USE_VALUE2, caller, false)
  ]
)
```

Corpus anchors:

- `mistswap/test/utilities/kashipair.ts:286-297` constructs this exact two-action call.
- `kashi-lending/contracts/KashiPair.sol:526-584` is the `cook` interpreter.
- `kashi-lending/contracts/KashiPair.sol:465-476` maps the first action to
  `BentoBox.deposit` and returns `(amountOut, shareOut)`.
- `kashi-lending/contracts/KashiPair.sol:285-296` applies `shareOut` to Kashi collateral
  state and, because `skim == false`, calls BentoBox again to transfer the shares.
- `mistswap/contracts/bentobox/BentoBoxV1.sol:803-854` implements the deposit, including the
  token interaction; lines 919 onward implement the later share transfer.

The workload is bounded to two source actions. It has no callback or invocation back-edge. A token
with ordinary `totalSupply` and `transferFrom` behavior is assumed; malicious token callbacks are
outside Deferred Release A and must remain rejected.

## 3. Participants, owners, invocations, and results

Physical state owners:

| ID | Owner | Mutable resources used |
|---|---|---|
| P0 | KashiPair | `userCollateralShare[caller]`, `totalCollateralShare` |
| P1 | BentoBox | `totals[token]`, `balanceOf[token][caller]`, `balanceOf[token][KashiPair]` |
| P2 | collateral token | `balanceOf[caller]`, `balanceOf[BentoBox]`, `allowance[caller][BentoBox]` |

Canonical logical invocation preorder:

```text
I0 KashiPair.cook(actions=[deposit, addCollateral])
├─ I1 BentoBox.deposit(token, caller, caller, amount, 0)
│  ├─ I2 token.totalSupply()                         [read, when Bento total is initially zero]
│  └─ I3 token.transferFrom(caller, BentoBox, amount)
└─ I4 BentoBox.transfer(token, caller, KashiPair, I1.shareOut)
```

`addCollateral` is an owner-local part of I0 rather than a fourth participant invocation. Its
load-bearing dependency is:

```text
I1.result[1] = shareOut
    -> Kashi userCollateralShare delta
    -> Kashi totalCollateralShare delta
    -> I4.share argument
```

The participant graph is acyclic (`Kashi -> Bento -> token`) even though P1 is entered twice.
Returning from I1 to I0 is result flow, not a callback edge.

## 4. Sequential reference oracle

Let the pre-state be:

```text
Bento totals[token]       = (elastic E, base B)
Bento balance caller      = C
Bento balance Kashi       = K
Kashi caller collateral   = U
Kashi total collateral    = T
token balance caller      = X
token balance Bento       = Y
token allowance caller->Bento = L
deposit amount            = M, with M > 0 and L >= M and X >= M
```

For a non-initialized Bento total, the corpus implementation additionally checks token supply and
the minimum-share rule. The first spike fixture should use `E > 0` and `B > 0` to keep the oracle
focused on graph semantics. With `share=0`:

```text
S = floor(M * B / E)              // Bento Rebase.toBase(M, roundUp=false)
require S > 0 and all arithmetic/authorization checks pass
```

Execute the oracle in this order:

1. Bento deposit:
   `C := C + S`, `E := E + M`, `B := B + S`.
2. Token transfer:
   `X := X - M`, `Y := Y + M`, `L := L - M`.
3. Kashi local update:
   `U := U + S`, `T := T + S`.
4. Bento share transfer:
   `C := C - S`, `K := K + S`.

Expected post-state:

```text
Bento totals[token]       = (E0 + M, B0 + S)
Bento balance caller      = C0
Bento balance Kashi       = K0 + S
Kashi caller collateral   = U0 + S
Kashi total collateral    = T0 + S
token balance caller      = X0 - M
token balance Bento       = Y0 + M
token allowance           = L0 - M
```

Every future spike execution must compare all these fields with this sequential oracle. Checking
only the final Kashi value would miss stale Bento or token settlement.

## 5. Why Releases 1-5 cannot express it

R4 batches handlers owned by one physical contract. This workload mutates three physical owners, so
R4 alone cannot settle it.

R5 groups repeated calls from one caller A to one callee B. It deliberately rejects forward calls
and supports only one repeated external owner. Here:

1. Bento's first invocation forwards to the token participant and mutates token state.
2. Bento's authenticated `shareOut` result becomes both caller-local Kashi state and the argument of
   Bento's later invocation.
3. Kashi, Bento, and token must each settle once even though Bento has two logical invocations.

Inlining does not remove this ownership graph: it only duplicates code while the same three UTXOs
still require one atomic, sequential interpretation. Auto-derivation can discover the owners and
resources, but R1-R5 have no covenant format that authenticates this three-owner result graph.

Therefore the observed-need gate passes independently of callbacks, cycles, flash loans, facets, or
the larger arbitrary-call Kashi examples.

## 6. Smaller parser-debugging fixture

The disposable spike may first use a synthetic two-participant, three-invocation graph:

```text
A.root
├─ B.quoteAndCredit(x) -> r
└─ B.consume(r)
```

B has one physical state input/output and two logical invocations; A authenticates the exact result
dependency. This fixture is not corpus evidence and cannot replace the Kashi acceptance case.

## 7. Go/no-go and next work package

Decision: **GO to Milestone 2 transaction-binding spike**, with these limits:

- disposable/test-only; no production capability advertisement;
- participant rows and invariant-15 transaction binding only;
- begin with two participants and no general invocation/resource/effect tables;
- strict owner uniqueness and one settlement authority;
- raw BCH-2026 VM negatives, not SDK-only construction failures;
- no cycles, callbacks, arbitrary calls, shared carrier, or five-table freeze.

Passing this gate establishes need, not feasibility. Cost, immutable-version interoperability,
contention, full projection exhaustiveness, and independent review remain mandatory later gates.

## 8. Milestone-2 measured results (2026-07-24, this pass)

Status: the two-participant invariant-15 **binding core is now VM-proven and feasible**, not just
compiled. Test: `packages/solidcash/test/e2e/Layer3ParticipantBindingSpike.test.ts` (5/5), executed on
the real BCH-2026 VM via `MockNetworkProvider.sendRawTransaction` (full consensus verifier).

Design realized: two clones of one stateful `Participant` artifact (distinct random categories, shared
body), co-spent in one hand-built `TransactionBuilder` (no single-owner SDK path exists; the two peer
masters + their canonical minting-NFT recreations at output0/output1 are laid out manually). Each
master executes the SCB1 `__layer3_bind` handler. Row args are carried as the SCB1 row payload
(not yet the separate L3P1 table); `createCompilerRouteUnlocker(route, sel)(blob)` gives each per-input
unlocker with the byte-identical positional second push.

Proven ENFORCED by the covenant (each negative has a same-UTXO positive control):

| Invariant-15 check | Proven | Evidence |
|---|---|---|
| 5 row bound to actual input locking bytecode | yes | forged owner LBC row -> VM reject |
| 6 input base category == stateCategory, minting | yes | forged category row -> VM reject |
| 7 canonical owner output preserves LBC + category | yes (partial) | tampered output-0 category -> VM reject |
| 8 both participant inputs select SCB1 | yes | corrupted input-1 SCB1 selector -> VM reject |
| 11 active input is a named row | yes | `activeInputIndex in {input0,input1}` |
| owner distinctness | yes (via `!=`) | positive requires distinct locking bytecodes |

Frozen feasibility measurement (2 participants, one direct-owner row each), `BCH_2026_05`:

| metric | per participant input | note |
|---|---|---|
| evaluated instructions | 2,480 | |
| operation cost | ~304,700 | budget 2,057,600 (~15%) |
| unlocking bytecode bytes | 2,531 | |
| total transaction bytes | 5,525 | 2 masters + fee, 3 outputs |

NOT yet done (honest; continue per the binding-spike handoff before Milestone 3):

- separate **L3P1 participant-table codec** (checks 1-4 header/version/count/row-length/exhaustion are
  currently the SCB1 outer envelope's, not a dedicated participant table);
- check 2 **canonical strict byte-lexicographic owner order** (this pass uses distinctness `!=`, not
  `<`; the `bytes <` compiler limitation still applies);
- check 9 **byte-identical second pushes** across both inputs;
- check 10 **controller-prefix (`L3B1CTRL`) inside each final redeem script** (needs redeem-script push
  location parsing; the wrapper-stack-binding limitation applies to a length-from-constructor-param
  approach);
- check 12 general **duplicate-logical-owner / two-authorities** beyond the 2-distinct-participant case;
- remaining hostile matrix rows: non-minimal push, legacy/direct route, controller-prefix
  removal/substitution, duplicate logical owner, overlapping input/output blocks, executor/non-direct
  kind, trailing-byte/truncation at each field boundary.

This establishes **feasibility of the binding core** on top of the earlier need gate. Cost at scale,
immutable-version interoperability, contention/liveness, full projection exhaustiveness, and
independent review remain mandatory later gates before any production layer-3 surface.

### 8.1 Continuation: controller-prefix binding + canonical-order finding (2026-07-24)

Two further invariant-15 checks were added to the same VM-proven fixture (now 6/6):

- **Check 10 controller-prefix binding - DONE, VM-proven.** Each clone's redeem script is branded with
  the exact 10-byte layer-3 controller prefix `08 "L3B1CTRL" 75` (push8 OP_DROP), realized via the
  `salt` prologue (harmless push+drop before dispatch; clones stay distinct by category). The handler
  front-parses each participant input's unlocking bytecode (selector(5) + PUSHDATA1 positional blob +
  PUSHDATA1 batchBlob arg + PUSHDATA2 redeem push) and requires the redeem-script data to begin with
  those 10 bytes. Hostile: an unbranded participant (redeem script lacking the prefix) is VM-rejected,
  with a branded positive control. This closes the "substitute an arbitrary SCB1 contract as a
  participant" gap: the co-spent contract must carry the controller brand.

- **Check 2 canonical strict order - NOT enforced; specific VM obstacle found.** Two approaches failed
  at the VM and were reverted to owner distinctness (`!=`, which gives the no-dup / one-settlement
  property but not anti-malleability ordering):
  1. `int(reverse(lbc) ++ 0x00)` (intended big-endian unsigned / lexicographic): `OP_BIN2NUM` strips
     the trailing 0x00 sign-forcing pad, so the value is sign-magnitude, not unsigned.
  2. `int(lbc)` (numeric key): the fixed P2SH32 suffix `0x87` sets the sign bit, so every owner key is
     negative and the direct comparison did not behave as a stable sortable key at the VM.
  Conclusion: strict canonical order needs a **bounded byte-lexicographic helper** (compare the 32-byte
  hash byte-by-byte), not an `int()` cast. This confirms the handoff's `bytes <` limitation and is the
  top remaining hardening item. Distinctness still guarantees no duplicate logical owner.

Updated frozen feasibility measurement (2 branded participants, full binding incl. controller-prefix
parsing), `BCH_2026_05`:

| metric | per participant input | note |
|---|---|---|
| evaluated instructions | 2,738 | |
| operation cost | ~470,200 | budget 3,319,200 (~14%) |
| unlocking bytecode bytes | 4,108 | |
| total transaction bytes | 8,679 | 2 masters + fee, 3 outputs |

Proven-enforced checks now: 5 (row-input-LBC), 6 (category+minting), 7 (owner output preservation,
partial), 8 (both inputs select SCB1), 10 (controller prefix), 11 (active input is a named row), owner
distinctness. Still open: L3P1 codec (checks 1-4 as a dedicated table), 2 (strict order - needs the
byte-lexicographic helper), 9 (byte-identical second pushes), general 12 (duplicate owner beyond the
2-distinct case), and the remaining hostile rows (non-minimal push, legacy route, duplicate logical
owner, block overlap, two authorities, executor kind, field-boundary truncation).

### 8.2 Cost analysis and reduction (2026-07-24)

The controller-prefix check reads and slices each participant input's whole ~4 KB unlocking bytecode
(OP_SPLIT charges the full item length), which dominated cost. It was rewritten so each input
SELF-checks only its own prefix and merely cross-checks that the other input selects SCB1 (so the
other also runs this handler and self-checks). Result per participant input, `BCH_2026_05`:

| | before | after (self-checked) |
|---|---:|---:|
| evaluated instructions | 2,738 | 2,615 |
| operation cost | 470,207 | 378,129 |
| operation budget | 3,319,200 | 2,700,000 |
| ratio | 14.2% | 14.0% |
| unlocking bytes | 4,108 | 3,334 |
| total tx bytes | 8,679 | 7,131 |

Key finding: **~14% is a structural ratio, not creeping cost.** Both operation cost and budget scale
with covenant/unlocking size (`budget = 800 * (41 + |unlocking|)`), so cutting redundant work (-20%
op cost) shrank the budget proportionally and the ratio held. The 86% headroom is comfortable for two
participants.

Scaling caveat (the real cost gate): the ratio stays bounded only if per-input work scales with
contract size, i.e. an UNROLLED N-participant handler (bigger covenant earns a bigger budget). A
LOOPED parser (small code that reads N x 4 KB unlockings) would grow cost without growing the budget
and could exceed it. A dedicated 2/4/8-participant measurement is the honest next feasibility step;
the 2-participant point plus this reasoning suggests ~14% holds for the unrolled design but is not yet
proven for N=8.

### 8.3 Findings on the remaining invariant-15 checks

- Check 9 (byte-identical second pushes) is **largely subsumed** here: each input's handler binds BOTH
  participant inputs/outputs to the values decoded from ITS OWN blob, so for both handlers to pass, the
  two blobs must agree on every bound field (owner LBC, category, and the introspected indices). A
  general transcript with UNBOUND row data would still need an explicit identical-blob check.
- Check 12 (duplicate logical owner / two settlement authorities) is covered for two participants by
  owner distinctness plus the consensus duplicate-input rule; a general N-row table needs an explicit
  pairwise no-duplicate pass.
- Check 2 (canonical strict order) needs an unsigned byte-lexicographic helper (see 8.1). Note it is
  also COSTLY (a 32-byte per-byte unsigned comparison), so it trades against the budget above; a
  production implementation should weigh a compact order key against the operation budget.
