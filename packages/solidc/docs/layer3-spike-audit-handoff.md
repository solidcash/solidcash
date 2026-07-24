# Layer-3 message-bus spike - audit handoff

Date: 2026-07-24. Audience: an auditing agent. This is a review handoff, not a completion claim. Read
section 5 (harness) and section 6 (stand-ins) FIRST - they determine what the 54 passing tests actually
prove. The green suite is necessary evidence, not sufficient: several soundness-critical properties are
deliberately stubbed and are called out below for you to break.

AN ADVERSARIAL SELF-AUDIT WAS ALREADY RUN (`layer3-spike-audit-findings.md`,
`test/e2e/Layer3Audit*.test.ts`). It CONFIRMED the section-6.1 state-NFT stub is exploitable (inflate a
foreign-category pre-state, mint excess share) and found a NEW issue: the M5/result value-settlement
output binds the value but not the recipient (redirectable). It also verified defenses (extra-input,
aliasing, msg.sender constraint) hold. Do not treat that self-audit as exhaustive or as a substitute for
yours - re-run it, extend it, and challenge its severity calls.

## 1. What was built and why

The disposable Milestone-2 participant-binding spike (`layer3-target-corpus.md` authorizes only this)
was extended into a full end-to-end demonstration of the journaled message bus: participant binding,
authenticated msg.sender / caller intent / callee result, multi-invocation result graphs, the three-owner
Kashi acceptance case with real `floor(M*B/E)` share math and persistent multi-resource state writes, a
variable-table on-chain codec, and off-chain SDK graph derivation.

Purpose (from corpus section 7): answer whether the mechanism is SOUND and BUILDABLE on BCH-2026, and
whether it fits the operation budget. It is test-only spike code - NOT production, NOT the ported Kashi
contract, NOT wired into the compiler/SDK beyond the one experimental seam.

## 2. Repository state

- Worktree `.worktrees/layer3-binding-spike`, branch `codex/layer3-binding-spike`, based on `3ead8954`.
- 23 `spike(bus)` commits, `2e9db17e` .. `1143f340`. The only non-test source change is the pre-existing
  compiler seam (commit `645f91aa`): a public handler named exactly `__layer3_bind`, under BOTH
  `experimentalHiddenBatch` and `experimentalLayer3BindingSpike`, bypasses ONE SCB1 eligibility rejection
  (route-sensitive introspection). Every other SCB1 gate still applies. No default capability, selector,
  or metadata is emitted. VERIFY this seam is as narrow as claimed - it is the only production-surface
  change, and it must not be generalizable to arbitrary handler names or enabled by default.
- 17 test files: 16 `test/e2e/Layer3*.test.ts` + `test/e2e/ByteLexProbe.test.ts`. 54 tests.
- Documentation: `layer3-target-corpus.md` sections 8-23 record each result and every finding.

## 3. How to verify

```
cd packages/solidcash
yarn vitest --root <abs>/packages/solidcash run test/e2e/Layer3*.test.ts test/e2e/ByteLexProbe.test.ts --testTimeout=90000
```

Each POSITIVE test pins measured metrics (`{instr, ratioPct}`) via `toEqual`; a changed cost fails the
test, so the numbers in the docs are enforced, not decorative. `ratioPct` = `operationCost /
maximumOperationCost` from `createVirtualMachineBch2026().evaluate(...).metrics`. Re-run and confirm the
counts; then challenge the harness (section 5).

## 4. Spike inventory

| File | Proves | Tests | Worst ratio | State model |
|---|---|---|---|---|
| ByteLexProbe | two-half unsigned byte-lex primitive | 4 | n/a | none |
| Layer3ParticipantBindingSpike | full-identity 2-participant binding (superseded) | 7 | ~14% | none |
| Layer3CompactBindingSpike | compact identity-by-reference N=2/4/8 | 7 | 16.2% | none |
| Layer3ScalingSpike | op-cost scaling n=2/4/8 | 1 | 20.8% | none |
| Layer3InvocationSpike | M3 msg.sender bound to co-spent caller | 4 | 12.9% | none |
| Layer3IntentSpike | M4 caller intent (master commitment) | 3 | 12.9% | master commitment |
| Layer3ResultSpike | M5 callee result -> caller settlement | 3 | 12.8% | callee master commitment |
| Layer3TranscriptSpike | binding+sender+intent+result, one covenant | 3 | 13% | master commitment |
| Layer3ChainSpike | multi-invocation result dependency | 3 | 13.1% | callee master commitment |
| Layer3GraphSpike | three-owner result graph (corpus 5 gap) | 3 | 13.8% | producer master commitment |
| Layer3RebaseSpike | floor(M*B/E) share math | 2 | 12.8% | producer master commitment |
| Layer3StateWriteSpike | persistent state write E->E+M | 2 | 13.3% | **foreign-cat state NFT** |
| Layer3KashiSpike | full 3-owner Kashi deposit, 2 state writes | 3 | 13.6% | **foreign-cat state NFTs** |
| Layer3CodecSpike | variable-length table parsed in a loop | 2 | 18.7% | none |
| Layer3RefinedIntentSpike | method granularity + one-shot nonce | 4 | 13.5% | **foreign-cat state NFT** |
| Layer3DeriveSpike | SDK unsorted-list -> transcript tx | 1 | n/a | none |
| Layer3OracleSpike | multi-resource oracle, 3 state NFTs | 2 | 13.3% | **foreign-cat state NFTs** |

## 5. The verification harness - scrutinize first

`MockNetworkProvider.sendRawTransaction` runs `createVirtualMachineBch2026()` (libauth's BCH-2026
consensus VM) as a full verifier over the assembled transaction; several tests additionally call
`vm.evaluate({inputIndex, sourceOutputs, transaction})` per input for metrics. So the passes are real VM
executions, not SDK-level checks.

CHALLENGE THESE:
- Does the mock verifier enforce EVERY consensus rule you care about (token genesis/mint/burn, NFT
  capability transitions, activation flags), or only script evaluation? Confirm against libauth source.
- Standardness vs consensus: the transcript/oracle txs carry TWO OP_RETURN outputs and are large. That is
  consensus-legal but non-standard for relay. Re-run the positive cases against a real BCHN regtest node
  (`yarn test:regtest` infra) and confirm they broadcast, or document that they need a policy exception.
- `maximumOperationCost` formula: confirm libauth computes it as consensus does
  (`~800*(41+|unlockingBytecode|)`), so the ~13-19% ratios are meaningful. If the formula differs, the
  budget headroom claim moves.
- The mock's category byte order is display-order; a real node uses internal order (see
  `regtest_category_byteorder_bug` history). The covenants compare VM-read categories to VM-read
  categories (order-agnostic), but verify none of the fixtures bakes an assumption that breaks on a node.

## 6. CRITICAL stand-ins - audit these hardest

These are where "the tests pass" and "the system is sound" diverge. Each is documented in the fixtures and
corpus, but concentrated here for the audit.

### 6.1 State-NFT authenticity is STUBBED (the big one)

The state-write, Kashi, oracle, and refined-intent spikes hold owner state (Bento `(E,B)`, Kashi `U`,
token `(X,Y)`, the intent authKey/nonce) in a **mutable NFT under a FOREIGN category, guarded by P2PKH**
(a key the test controls). The covenant reads that NFT's commitment as authoritative pre-state and
enforces the transition (`post = f(pre)`), but NOTHING ties the NFT to the owner it claims to represent.
Consequence: an attacker can supply a foreign-category state NFT with ANY pre-state (e.g. an inflated
`B` to mint excess `shareOut`), and the covenant will faithfully compute and settle against it. The spike
therefore proves the TRANSITION/BINDING logic, NOT end-to-end economic soundness of the state. A real
system MUST brand each state NFT to its owner (the owner's minting category, so only the owner can create
or update it) - the same way the SDK's data-NFT machinery brands data NFTs. The fixtures say
"production-branded, not key-guarded; the transition binding is identical," which is true but load-bearing.
AUDIT: treat every foreign-category-state spike's soundness as conditional on that branding, and confirm
the branded design (a data NFT at `getDataNftAddress`, guarded by `buildDataNftCovenantScript`) actually
composes with the transcript covenant - that integration is NOT built (section 10).

### 6.2 Commitment SETTING is not covenant-gated

Even the master-commitment spikes (intent, result, rebase, graph, transcript, chain) set the auth/rate/
`(E,B)` by `provider.addUtxo`-ing a re-minted master with a chosen commitment. The covenants only READ,
PRESERVE, and TRANSITION that commitment - they never exercise the path that GATES its initial value.
For master commitments this is defensible (the master is the owner's minting NFT, so only the owner mints
it - though the spike does not prove the mint path). For foreign-category state NFTs it is not (6.1).
AUDIT: verify who can set each committed value in a real deployment, and that the setting path is itself
covenant-constrained.

### 6.3 Controller brand is a test salt

The `L3B1CTRL` (`4c3342314354524c`) controller prefix is applied via the `salt` contract option
(`<salt> OP_DROP` prologue). The brand cross-check proves participants share a known prefix, but the spike
does not establish a canonical, collision-resistant, spec-fixed controller identity, nor prevent an
unrelated contract from adopting the same salt. AUDIT: is the brand doing real work, or is it a namespacing
convenience that a production spec must harden?

### 6.4 The Kashi model is simplified

Layer3Kashi/Oracle model `S = floor(M*B/E)` with `E,B > 0` (the share!=0 branch), and a subset of the
corpus-4 resources (E,B / U / X,Y). Omitted: the min-share / total-supply checks for an uninitialized
Bento total, and the C/K/L/T fields. Values are tiny (fit 4-byte fields); real magnitudes need wider
encodings and overflow analysis (BCH bigint is fine numerically, but the 4-byte pack and `int()` of a
sub-slice must be re-checked for sign/width at real magnitudes). AUDIT: re-derive the oracle at realistic
values and confirm no sign/width/rounding divergence from the reference `Rebase.toBase`.

### 6.5 Single transaction only

Every spike is ONE transaction. Persistent state and the nonce are proven to transition within a tx, but
no spike executes a SEQUENCE (deposit then withdraw; nonce 0 then 1). Cross-tx continuity, and that a
spent state NFT cannot be resurrected, are untested. AUDIT: build a 2-3 tx sequence per stateful spike.

### 6.6 The codec is minimal

Layer3CodecSpike parses only a variable PARTICIPANT table (count + index pairs) in a loop. The
invocation/resource/effect/event tables are not parsed generically; the other spikes still use fixed
positional args. The bounded loop (`for step < 8`) silently caps N at 8 - exceeding it does NOT error, it
under-validates. AUDIT: any general codec must fail closed when the count exceeds the loop bound.

## 7. Soundness arguments to challenge

For each, the claim and the intended argument; try to falsify.
- Identity binding (compact): identity = `tx.inputs[i].lockingBytecode`, read not claimed, so unforgeable.
  ATTACK: any way to make an input present a lockingBytecode that is not its real one? Any P2SH collision
  assumption?
- Canonical order: two-16-byte-half big-endian compare over the 32-byte P2SH32 hash; adjacent strict order
  subsumes distinctness. ATTACK: the fixed `aa20..87` frame is stripped by slicing bytes 2..33 - confirm
  the frame really is invariant for all stateful P2SH32 and that the halves cover the whole hash.
- Brand cross-check: every named participant's redeem begins with the brand at `rp+3`, `rp` from the
  shared blob structure. ATTACK: mixed push encodings (blob >= 76 bytes -> PUSHDATA1) break the direct-push
  `rp` computation; the compact form is bounded to ~25 participants (documented). Confirm the bound is
  enforced, and that a crafted unlocking cannot move the redeem while satisfying `rp`.
- msg.sender: delivered to `tx.outputs[2]` as `6a23<caller lbc>`, bound to `identity(input[callerIdx])`.
  ATTACK: the covenant checks a specific output INDEX, not that it is the only such output, nor the total
  output count. Can extra/duplicate outputs or index shifts confuse a consumer? (See section 8.)
- Intent: caller's committed authorization must equal `hash160(callee[++selector])`, preserved (or nonce-
  advanced). ATTACK: 6.1/6.2 - the whole thing rests on the auth store being the caller's.
- Result / state write: `post == f(pre, amount)` over committed pre-state. ATTACK: 6.1 (pre-state
  authenticity) and 6.4 (width/rounding at scale).

## 8. Attack surface to exercise

- Extra outputs / output-count: covenants constrain specific output indices, never
  `tx.outputs.length`. Add spurious outputs, duplicate the OP_RETURN records, or append outputs after the
  checked ones, and confirm nothing downstream (a consumer, an off-chain reader) is misled.
- Input-set injection: co-spend an extra non-participant input (the spikes allow arbitrary extra inputs
  like the fee). Confirm it cannot masquerade as a participant or a state NFT (the membership + brand +
  category checks should stop it - verify).
- Token accounting: the state NFTs are burned/mutated; the auth NFT (M4 attempts) tripped the self-pin.
  Probe mint/burn edge cases: can an attacker mint a fake participant-category token mid-batch (the master
  is minting and co-spent)?
- Index aliasing: `callerIdx`/`calleeIdx`/`producerIdx`/state indices are attacker-supplied in the blob.
  Confirm every index is range-checked by use (introspection reverts out of range) and that aliasing two
  roles to one input cannot bypass a check.
- Loop bound: exceed the codec's `step < 8` with a 9+ participant table and confirm the extra participants
  are simply unvalidated (a real hole to fix), not silently accepted as valid.

## 9. Fixed bugs (failure modes, for awareness)

Caught and fixed during the build; each is a class of bug to check in any generalization:
- `params.unshift(...)` in a parametric generator silently REVERSED input/output params, inverting the
  canonical-order comparison (positive still "looked" plausible). Generators must use `push`. (corpus 14)
- `int()` of a >32-byte value trips the int-type range guard (`OP_DUP <+-2^255> ... OP_VERIFY`); this, not
  `reverse()`, blocked canonical order. Any wide-value arithmetic must chunk to <=16-byte pieces. (8.7)
- The stateful self-pin REJECTS an extra input under the participant's OWN category at a foreign address;
  a foreign category passes. This is why intent/state rides preserved-master or foreign-category NFTs. (10)
- The master NFT commitment is preservation-controlled - changing it (even with the intent check removed)
  fails; it must be preserved or the covenant must own the transition. (10)

## 10. What is NOT built (honest boundary)

- The general FIVE-table transcript codec (only the participant table is loop-parsed; 6.6).
- Real state-NFT branding + integration with `buildDataNftCovenantScript` / `getDataNftAddress` (6.1) -
  the spikes stub state authenticity.
- Cross-transaction lifecycle / state continuity (6.5).
- The real Kashi contract port; full corpus-4 oracle (C/K/L/T, min-share/supply) (6.4).
- Any compiler/SDK productization beyond the one experimental seam and the test-only `deriveTranscript`.
- No regtest/chipnet run; MockNetworkProvider only (section 5).

## 11. Recommended audit approach

1. Re-run the suite; confirm 54/54 and the pinned metrics (section 3).
2. Establish exactly what the harness enforces (section 5), then re-run the positive cases on regtest.
3. Attack the stand-ins (section 6), especially 6.1 state-NFT authenticity - decide whether the mechanism
   proofs survive a proper owner-branded state design, and whether that design composes with the covenant.
4. Try to falsify section 7 arguments and run section 8 attacks (extra outputs, index aliasing, loop bound).
5. Report which claims are (a) sound as-built, (b) sound only under the documented branding/productization,
   (c) not yet substantiated. The corpus doc's per-section framing is the claim ledger to check against.
