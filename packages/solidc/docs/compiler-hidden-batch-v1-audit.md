# Compiler-hidden batch v1: independent implementation/covenant review

Reviewer: Claude (adversarial soundness + security audit)
Baseline reviewed: branch `codex/state-bus-research`, HEAD `4cff1624`, implementation commit `cbb360fc`.
Scope: the R4 owner-local SCB1 batch, the R5 repeated-external-callee route, and the new two-row
mapping-backed ERC-20 `transferFrom` resource-shaped route (`5e1c0a7d`, `99c03c51`, `cbb360fc`).

## Disposition

**Decision 2 with required corrections.** Both R4 and the current narrow R5 (including the two-row
resource route) are covenant-sound as an experimental surface, and R5 must remain default-off. The
core covenant mechanics fail closed. However, one headline claim is materially inaccurate (F1), one
on-chain guarantee is argued but never regression-tested (F2), and one guard is latent-fragile if
eligibility broadens (F3). These should be resolved before the graduation/default-on discussion, not
after.

No CRITICAL/exploitable fund-theft was found in the default-off, narrow, SDK-constructed
configuration.

## Completion review - independent re-verification (2026-07-24)

Reviewer: Claude (fresh completion pass). Baseline: `1a324595` (batch remediation `df3fab7e`,
`09d62ff4`), rebuilt from source; annotations verified, not trusted. Mock provider runs a full
mem-cash consensus verifier (value/token conservation + duplicate-input rule), so negative-test
failure layers matter.

**Decision 2 stands (sound experimental surface; R5 default-off).** F1-F4 and F6 are remediated; F5's
missing-caller negative is a weak test that should be replaced. No new soundness defect.

| Finding | Disposition | Note |
|---|---|---|
| F1 overstated "real ERC-20" | **FIXED; citation re-located at X125** | Spec now disclaims ("does not demonstrate standard ERC-20 authorization"), but at `compiler-hidden-batch-v1.md:422`, not the `:351-354` this row cited - those lines are the `msg.data`/selector-position ineligibility rule and do not contain the quote. Fixture uses a `spender` param. Cosmetic residual: 2 test titles still say "ERC-20 transferFrom" unqualified. |
| F2 alias only SDK-tested | **FIXED; citation re-located at X125** | A raw hand-rewritten duplicate-outpoint tx is now pushed to the VM and rejected (`RepeatedExternalBatchCorpus.test.ts:197-239`, not the `:194-236` this row cited), with an untouched positive control at `:239`. Rejection is the consensus duplicate-input rule (by design), reaching the VM - not a `.build()` throw. |
| F3 metadata-dependent cold gate | **FIXED; citation re-located at X125** | Cold flag now set structurally (`if (compilerRoute && !exact)`) independent of `sortedBatchInfo`; any unresolved compiler-route entry throws. Construction-time refusal (the requested structural assertion). The gate is at `src/stateful/StatefulContract.ts:7801`, not the `:7737` this row cited. The path was never `src/StatefulContract.ts` (checked: `git log --all` on that path is empty), so only the line drifted. Five other bare `StatefulContract.ts:NNNN` citations in this document - `7736`, `7738`, `7943`, `7948`, `5225` - also land on unrelated lines in the current file, so re-locate any of them by content before relying on it. |
| F4 no library size gate | **FIXED, but this row's EVIDENCE went stale (X123)** | `compileString` emits a structured `contract-size-limit` diagnostic - that part still holds, at `compiler.ts:2579-2586`. **X125: the X123 pass corrected this row's figure and left its own code citation rotted.** It cited `compiler.ts:959-967`, which is collection-route key-witness synthesis and has never emitted a diagnostic; re-located by grep for `contract-size-limit`, which occurs once in that file. The rest of X123 stands: the route is **4,900** bytes, not 9,775, and `BatchCostRegression.test.ts:79` no longer holds the assertion quoted here (it reads `routeBodyBytes:`; the ERC-20 pin moved to `:102-117`). The X125 measurement was 4,814 bytes with 5,186 bytes of headroom; the current margin is **5,100** bytes, so "pinned just under the limit" is no longer the reason this is fixed. Authority for every current figure: `BatchCostRegression.test.ts`. |
| F5 adversarial coverage | **PARTIAL - one WEAK test** | R4 event/value/result-output negatives are covenant-layer and adequate (value mutation compensates the container to conserve satoshis; corpus corrupts the *last* entry). But the R5 missing-caller negative (`RepeatedExternalBatchRelease5.test.ts:481-490` at X125, not the `:405-412` this row cited - those lines are now blob mutators) `splice`s out A's whole master input, so `rejects.toThrow()` fires on value/token-conservation + index-shift, and the callee fixture has no `msg.sender` check to exercise - it proves "can't delete an input," not caller authentication. Replace with a real caller-LBC-swap test in the `msg.sender`-keyed C2 scenario. Test-quality gap, not a soundness regression (caller/callee binding soundness stands via the target-substitution and forged-settlement negatives with positive controls). |
| F6 direct-route isolation | **FIXED** | `MsgSenderCrossContractC2.test.ts` asserts byte-identical bytecode with/without the flag and executes the direct `bal[msg.sender]` insert on the VM. |

R5 remains default-off regardless of audit status, per the graduation gates in
`compiler-hidden-batch-v1.md`.

## What is sound (verified against generated bytecode + VM tests)

1. Positional selector + whole-blob byte equality (caller A). `emitExternalBatchBlobVerification`
   (`GenerateTargetTraversal.ts:17726`) checks the first five unlocking bytes equal the minimal push
   `04 53434231` and compares the complete minimally-encoded second push (opcode + length + content)
   byte-for-byte via `OP_EQUALVERIFY`. Extraction is fully positional; there is no content scan. The
   decoy-push / magic-scan forgery flagged in the prior transcript audit is code-defended. The
   PUSHDATA1 length reconstruction for 76..223-byte blobs is correct (two-byte `NUM2BIN` then low-byte
   truncation, `17770`+).

2. Callee B binds its parsed blob to its own positional second push. The synthesized `__scb1`
   (`compiler.ts:509-521`) re-reads `tx.inputs[this.activeInputIndex].unlockingBytecode`, asserts the
   first push is the selector, and asserts the second push equals the executable `batchBlob`
   argument. This closes the "B parses a different blob than A committed" gap: A binds the second
   push, B binds its parsed blob to the same second push, so B executes exactly A's committed rows. A
   bottom-of-stack untracked blob copy exists only for A's binding and is rolled off and dropped
   (`GenerateTargetTraversal.ts:2404-2413`).

3. Parser hardening. `__scb1` validates magic/version/flags, bounds `rowCount` (`== 2` resource,
   `1..8` scalar), bounds every slice, requires `occurrence == 0` and `callsite == row`, reverts on
   unknown selectors, and requires `cursor == batchBlob.length` (exact exhaustion, no trailing
   suffix). VM-exercised by the R4 and R5 tamper suites.

4. Eligibility is fail-closed and fails closed on analysis-uncertainty. `synthesizeHiddenBatchRoute`
   (`compiler.ts:185-514`) rejects, with recorded reasons: `msg.sender`/introspection
   (route-sensitive), `checkSig`/`sig` params, forwarding (`ExternalFunctionCall`/`MethodCall`),
   dynamic state, disallowed lifecycle/unsafe modifiers, non-parameter mapping keys, multi-handler
   routes, multiple repeated owners, and non-straight-line chains. `IndirectCall` and any unresolved
   footprint set `unknown` and are rejected. `expandModifiers` runs before synthesis
   (`compiler.ts:618`), so a `checkSig` hidden inside a modifier is inlined and caught.

5. Journal read-your-writes and single flush. `LowerCollectionJournalHelpers` caches entry locals by
   key-identifier: `balances[from]` and `allowances[from][spender]` are shared across both rows
   (summed decrement, one flush), `balances[to]` is per-row (`to_r0` vs `to_r1` are distinct locals).
   Correct for the supported shape.

6. Caller identity reuses the existing (VM-proven) `msg.sender`/target-pinning model. No caller
   identity is taken from the blob. Target-substitution, forged-settlement, and duplicate-callee-input
   are VM-rejected with a positive control (`RepeatedExternalBatchRelease5.test.ts:353-393`).

7. Entry substitution fails closed on-chain. `emitSortedSetRead` (`GenerateTargetTraversal.ts:11380`)
   computes `slot = sha256(key)` (masked) from the witness parameter and verifies the co-spent
   entry's commitment slot, with absence proven by `bracket.slot < H(k) < nextKey`. The covenant
   `require(decoded_row_key == witness)` plus `slot == H(witness)` binds each physical entry to the
   key the blob decoded. A wrong entry in a slot reverts.

8. Iterative VM derivation is off-chain planning, not authentication
   (`StatefulContract.ts:5225-5294`). B's covenant halts at the first mismatching entry output, so
   each probe pass reveals only the next commitment; the loop feeds it back and re-probes. If it
   stops early it produces a transaction the covenant rejects (liveness loss), never an unauthenticated
   acceptance. Authentication is the covenant's, per entry, in order.

## Findings

### F1 (MEDIUM, claims/scope) - "Real ERC-20 transferFrom" is overstated

The synthesized and tested handler is
`transferFrom(bytes20 from, bytes20 to, bytes20 spender, bigint amount)` with
`allowances[from][spender]` (`RepeatedExternalBatchCorpus.test.ts:103-111`,
`BatchCostRegression.test.ts:28-39`). `spender` is an explicit parameter because any handler
referencing `msg.sender` is rejected as route-sensitive
(`compiler.ts:218-222` -> `direct-versus-batch-introspection-divergence`). Consequently the allowance
debit is authorized by caller-supplied data, not by the actual authenticated caller. A genuine ERC-20
`transferFrom` (allowance keyed by `msg.sender`) remains batch-INELIGIBLE.

The resource-shape and multi-entry journaling graduation is genuinely demonstrated (shared sender
balance, shared nested allowance, two distinct recipients, one owner transition). But the claim "Real
two-row ERC-20 transferFrom batching works" conflates a reshaped token with real ERC-20 authorization
semantics. Correct the framing: the batched form is a parameter-authorized multi-entry transfer, and
`msg.sender`-bound allowance batching is still an open item. This matters only for the graduation
narrative; it is not a covenant bug (the direct, non-batch route still uses `msg.sender`, restored by
`cbb360fc`).

### F2 (MEDIUM, test/assurance) - alias/cold safety is proven only at SDK construction

Repeated-recipient, sender-as-recipient, and cold-recipient are rejected at `.build()`
(`StatefulContract.ts:7943-7958` alias via `txid:vout` outpoint; `7738-7765` cold), and there is no
VM-level adversarial test. On-chain, aliasing does fail closed, but by **emergent** behavior, not an
explicit covenant assertion: the covenant never compares `to0` vs `to1` or `from` vs `to`. Safety
rests on (a) the covenant `slot == H(witness)` key-binding (prevents substituting a different entry),
(b) the BCH consensus duplicate-input rule (two entry slots for one key would need two inputs with the
same outpoint), and (c) minting-authority uniqueness (a second entry UTXO for a key cannot be forged).
This composition holds, but "it fails closed on-chain" is currently an argument, not a regression lock.

Recommendation: add a VM-level test that bypasses the SDK alias gate (via a raw hook analogous to
`_batchRaw`/`createCompilerRouteUnlocker`) and asserts the constructed aliased/duplicate-entry
transaction is rejected by the 2026 VM, with a positive control on the distinct-entry case.

### F3 (MEDIUM, latent) - cold-entry safety is delegated to compiler metadata, not structurally enforced

The cold gate only runs when the slot is present in `bAbiFunc.sortedBatchInfo[].slotIndices`
(`StatefulContract.ts:7738-7739`). That metadata is produced under
`isWritten && !info.inLoop && coll.sorted && fixedSortedWriteCount > 1`
(`SymbolTableTraversal.ts:1535-1548`). It holds for the exact three-write `transferFrom`. But any
future route whose recipient write is loop-lowered (`info.inLoop`) or yields a single sorted write is
dropped from `sortedBatchInfo`; the cold branch is then skipped and resolution silently falls back to
`bList.predecessorOf(bSlot)` (`7736`), settling against an unrelated predecessor entry. The covenant
likely rejects the resulting mismatched entry output, but this is unverified. The SDK does not
independently assert "every resource entry slot exists." Additionally the alias gate skips non-NFT
inputs (`if (!input?.token?.nft) continue;`, `7948`) and indexes `bBlockInputs[slot.offset]` assuming
an entry-only block layout - safe for a pure balance-transfer route, not defensively written.

Recommendation: make entry-existence a structural SDK assertion independent of `sortedBatchInfo`, and
re-verify both gates before any eligibility broadening.

### F4 (MEDIUM, deployability) - no library-API size gate (the "225-byte headroom" half is superseded)

AS AUDITED at `4cff1624`; every byte figure in this finding is superseded, see the X125 re-derivation
below. The minimal two-row ERC-20 fixture compiles to 9,775 bytes; the SCB1 route body alone is 6,532
bytes, +6,728 over the 3,047-byte direct token (`BatchCostRegression.test.ts:64-83`).
`MAX_INPUT_BYTESIZE = 10_000` is enforced ONLY as a `console.warn` in `solidc-cli.ts:90`;
`compileString` (the library/SDK path used by every programmatic caller and by the test suite) emits no
size diagnostic. A marginally larger token (bytes32 keys, events, decimals, a second handler) silently
compiles oversize and is rejected by the network at deploy with no compiler signal. The route roughly
triples contract size, so it is viable only for the most minimal token.

**X125 re-derivation. The conclusions died with the figures, so they are re-derived rather than
refreshed.** Measured at HEAD by compiling this finding's own fixtures; the authority for the pinned
columns is `compiler-hidden-batch-v1.md`'s Release 0 table, itself pinned by
`BatchCostRegression.test.ts:102-117` (the `:64-83` cited above is now the parser/dispatcher pin, not
this one).

| figure | as audited | at HEAD | how measured |
|---|---:|---:|---|
| route batch bytes | 9,775 | 4,900 | `BatchCostRegression.test.ts:114` |
| SCB1 route body | 6,532 | 1,562 | `BatchCostRegression.test.ts:116` |
| direct token bytes | 3,047 | 3,157 | `BatchCostRegression.test.ts:113` |
| batch delta | +6,728 | +1,743 | `BatchCostRegression.test.ts:115` |
| headroom under 10,000 | 225 | 5,100 | `10,000 - 4,900` |

Four consequences, not four numbers:

1. **"Roughly triples contract size" is dead.** It was 9,775/3,047 = 3.21x; it is 4,900/3,157 = 1.55x.
2. **"Viable only for the most minimal token" has inverted.** The five-function corpus token
   (mint, approve, transferFrom, checkBalance, checkAllowance) compiles to 6,032 bytes with 3,968 to
   spare and no `contract-size-limit` diagnostic (`RepeatedExternalBatchCorpus.test.ts:124-125`).
3. **The named counter-example has inverted.** This finding's own "marginally larger token (bytes32
   keys, events, decimals, a second handler)" was compiled as written: 5,777 batch bytes, 4,223 of
   headroom, no diagnostic, `transferFrom` still eligible. It does not compile oversize.
4. **"With no compiler signal" is fixed, and was fixed independently of the figures.** `compileString`
   emits the structured `contract-size-limit` error above 10,000 bytes at `compiler.ts:2579-2586`. The
   CLI `console.warn` at `solidc-cli.ts:90` is unchanged and still present, so that half of the
   citation held.

Recommendation, as re-derived: the library-path size gate is delivered and remains required. The
"document the tripling" half is withdrawn - there is no tripling to document. Size is no longer a
ceiling for this shape and must not be cited as one; the binding constraint on the route is its
capability boundary, not its byte count.

### F5 (LOW/MEDIUM, test quality) - the adversarial suite over-attests

- No adversarial test for decoy first push, mis-positioned blob, or non-minimal push encoding (the
  positional locator is now code-defended but not regression-tested).
- Event-substitution and value-substitution have no VM rejection test (only positive functional
  assertions).
- Caller-identity negative direction is untested (no test removes/forges A's co-spent input).
- The "authenticates every entry output" property is tested only against the FIRST entry output; both
  forgery tests flip `commitment[0]` of the first matching output. No test flips a second/non-first
  entry.
- Several R4/R5 blob-tamper tests use bare `.rejects.toThrow()` with no reason and no positive control
  that the untouched blob sends successfully (`HiddenBatchRelease4.test.ts:122`,
  `RepeatedExternalBatchRelease5.test.ts:307,350`). A construction-time failure unrelated to the
  covenant would satisfy them; the "even when the callee route accepts it" title is unproven.

Recommendation: add positive controls to every forge-and-reject test and fill the missing negatives,
especially the decoy-push and second-entry-output cases.

### F6 (LOW, blast radius) - the compiler-route/direct-route split is load-bearing

The resource-route work introduced a generic master-unlocker replacement, multi-key resolver, and
iterative derivation that initially ran for ALL external-call groups and silently clobbered ordinary
`bal[msg.sender]` direct inserts; `cbb360fc` scoped them behind `group.compilerRoute` and was caught
only on the first SDK validation run. The `group.compilerRoute` guard is now a correctness boundary
threaded through several branches of `StatefulContract.ts`; a single missed guard is a silent
direct-route miscompile.

Recommendation: add a focused invariant test that direct cross-contract construction (including
`bal[msg.sender]` insert) is byte-identical with the batch experiment enabled vs disabled, so the
bifurcation cannot regress unnoticed.

## Answer to the handoff review checklist

- Positional second push, byte-for-byte compare, exact exhaustion: CONFIRMED (sound; F5 notes the
  missing decoy-push regression test).
- Row-count bound, omission/injection/reordering/selector/argument/suffix failures: CONFIRMED at the
  VM level (F5 notes weak assertions on some).
- Caller identity only from the co-spent input: CONFIRMED (negative direction untested, F5).
- Target/category/lineage/one settlement authority pinned by existing machinery: CONFIRMED.
- Journal read-your-writes, one flush per dirty resource: CONFIRMED for the supported shape.
- Global/per-row witnesses bind decoded keys: CONFIRMED (`require(decoded == witness)` + `slot ==
  H(witness)`).
- Physical aliases and cold predecessors rejected before layout: CONFIRMED at construction; on-chain
  by emergent consensus + key-binding, not regression-tested (F2); cold gate metadata-dependent (F3).
- Iterative derivation authenticates every entry output: the covenant does (in order); the SDK loop is
  liveness-only. The "every entry" property is under-tested (F5).
- Non-batch artifacts byte-identical, exact v1-only capability match: CONFIRMED.
- Frozen measurements reproduce: not re-run here; F4 flagged a 225-byte ceiling and a missing
  library-path size gate. Both are superseded at X125: the gate exists (`compiler.ts:2579-2586`) and
  the ceiling is 5,100 bytes of headroom, so this line is no longer a reason to withhold anything.

## Remediation status

Post-audit corrections (2026-07-23):

- **F1 corrected:** the specification and handoff now call the fixture a parameter-authorized
  multi-entry transfer. Standard ERC-20 `transferFrom`, keyed by authenticated `msg.sender`, remains
  explicitly batch-ineligible.
- **F2 regression-locked:** the SDK corpus captures a valid transaction, bypasses the construction
  gate by rewriting the second recipient input to duplicate the first recipient outpoint, and
  requires consensus rejection before accepting the untouched positive control. It also corrupts
  the last mutable entry output, rather than only the first, and requires covenant rejection.
- **F3 made structural:** every sorted entry required by a compiler route must resolve to an exact
  existing entry. Cold rejection no longer depends on `sortedBatchInfo.slotIndices`; that metadata
  only supplies route-internal C2 witnesses after exact resolution.
- **F4 surfaced in the library artifact:** compilation emits a structured
  `contract-size-limit` error diagnostic above 10,000 bytes. The two byte figures recorded here are
  superseded at X125 and both moved the same way: the stripped route fixture was 9,775 bytes and is
  4,900 (4,814 at X125), and the corpus token with mint/approve/check helpers was 10,600 bytes and is 6,032. The
  "explicitly documented as non-deployable" clause has inverted - that token now compiles 3,968 bytes
  inside the limit and `RepeatedExternalBatchCorpus.test.ts:124` asserts the diagnostic is ABSENT.
- **F5 completed:** R5 includes a positional-second-push decoy transaction, a late/second
  entry-output corruption, the raw duplicate-resource transaction, removal of the physical caller
  input, and untouched positive controls. R4 separately mutates an authenticated event output and
  mutates a value-transfer output while compensating the satoshi-container output (so rejection
  cannot be explained by value non-conservation); both then accept the untouched transaction.
- **F6 regression-locked:** the direct `bal[msg.sender]` cross-contract fixture now asserts that
  enabling repeated-external analysis on a single-call caller leaves bytecode identical and emits
  no batch metadata, then executes the direct insertion in the VM.

These corrections do not request default enablement. They narrow the claim, make cold handling
structural, add a library-path size gate, and strengthen the audit evidence for the existing
experimental boundary. ("Expose the deployability ceiling" was the third item here; X125 withdraws it,
because at 5,100 bytes of headroom there is no ceiling to expose.)

**This "all closed" claim is CONTRADICTED by the completion review above it, and the completion review
is the later document.** Its F5 row records `PARTIAL - one WEAK test` and asks for a replacement
caller-LBC-swap negative; that replacement has not landed, and the missing-caller test at
`RepeatedExternalBatchRelease5.test.ts:481-490` still ends in a bare `rejects.toThrow()` after
splicing out a whole input. So read the sentence below as scoped to 2026-07-23: it predates the
2026-07-24 re-verification and was never revised after it. F1-F4 and F6 are closed; F5 is not.

All required F1-F6 corrections and assurance gaps identified by this review are now closed. The
default-off disposition remains a product/protocol graduation boundary, not an unresolved audit
finding.

Post-remediation validation passes the six-package monorepo build, 2,299 compiler tests, and 3,256
SDK tests (24 skipped, 9 todo).
