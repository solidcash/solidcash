# KB audit: message-bus kernel (route/verifier, read carriers, entry journal, graph identity)

Tree: /Code/cashscript/.worktrees/per-call, branch feat/per-call, HEAD abbb7e0ec (df51215d6 is an ancestor; 6 commits
later, kernel paths audited at HEAD). Read-only; no tests, compiles or probes run.

## KB-1 CRITICAL, CODE-CONFIRMED: the bound route accepts a minted clone in place of its verifier's output, so the whole verifier binding (graph callers, batch, lifecycle) is attacker-chosen

Files:
- packages/solidc/src/compiler.ts:11965-11990 (compactAtomicBinder, the bound route's `__message_bus_verify_atomic`)
- packages/solidc/src/compiler.ts:13280-13293 (route-side bindingDigest and its return)
- packages/utils/src/message-bus-verifier.ts:160-205 (verifier sidecar tail: recreation at OP_INPUTINDEX only)
- packages/solidc/src/generation/GenerateTargetTraversal.ts:9519-9522 (C3 own-category 0x01 count skipped for any
  route with entry access, token containers, dynamic writes or deploys), :45990-45995 (collection/data census returns
  unless the bus is explicitly disabled)
- packages/solidc/src/compiler.ts:11861-11868, 11153, 11251 (graph caller parsed from `__internal__graphCallers` and
  passed to handlers as msg.sender / msgSender mapping keys)

Root cause. The bound route checks the verifier INPUT correctly (lock == specialized P2SH32 verifier lock, category ==
own category, capability 0x01, `L3V1` prefix), but then selects the verifier OUTPUT with a scan over all outputs that
keeps the LAST one with the same lock and category (compiler.ts:11974-11979) and requires only that this output's
commitment equals `input[activeVerifier].commitment[0:6] || bindingDigest` (11981-11988). The verifier sidecar enforces
`prefix || <digest its program returned>` only at its own index (message-bus-verifier.ts:165-205). Nothing ties the
scanned output to the verifier input: the sidecar has no class balance any more, and the participant's master minting
NFT (capability 0x02, required at 11947) is spent in the same transaction, so consensus lets the spender mint any
number of extra `C||0x01` NFTs. The only covenant that would count them (C3, GTT 9519/9661) is skipped for every
route with mapping/entry access, and the census (GTT 45990) is off for bus contracts. The inlined verifier was fixed to
pair by index in 1fc064596 (`activeVerifierOutput = activeVerifier`, compiler.ts:12420); the bound route was not.
`archive/docs:MESSAGE_BUS_ENFORCEMENT_MATRIX.md` rows 11 and 17 still claim same-index pairing and a sidecar class balance; the class
balance existed at 3b2fcc82d/4424d82cd and is absent by 39dccf3b6 and at HEAD. Regression of a documented control.

Attack (graph route of a mapping-backed contract V with category C, e.g. a token with
`balances[msg.sender]`, no checkSig in `transfer`):
- Input 0: attacker participant A0 (any attacker P2SH lock holding a minting NFT of the attacker's own category X),
  unlocking `04 SCB1 | 4d <len> L3C1 <len4> manifest | ...`; manifest lists A0 (active) and A1 (attacker, second
  category Y), both trivially valid; V is not listed.
- Inside A1's block (never physically counted, since A1 is not the active participant): V's master (C||02) and the
  entry NFTs of the victim and the attacker (their sub-covenants self-authorize on a master spend). V's unlocking:
  `04 SCB1 <batchBlob: transfer(attacker, victimBalance)>`, `__internal__graphCallers = <len><victim lock>`,
  `__internal__activeVerifierIndex = E+1`, any graph values.
- E+0: the attacker's own X||01 NFT with commitment `L3V1 ii`; output E+0 = same with `prefix || D_A0`.
- E+1: a genuine V verifier instance (verifier lock, C||01). Its sidecar runs the verify program for A0
  (activeInputIndex = 0), which checks only `input[E+0]` (category X) and output E+0, and returns D_A0; the sidecar
  recreates output E+1 with `prefix_V || D_A0`.
- E+2 (fee): attacker coin. Output E+2: a NEW mutable NFT of category C at the verifier lock, commitment
  `prefix_V || D_route`, where D_route = sha256(sha256(manifest) || V's input index || rowCount || sha256(batchBlob)
  || graph values) is computed offline (compiler.ts:13280-13285). Minting authority: V's master minting NFT.
- V's route: input E+1 passes the input checks; the output scan picks E+2 (last match); its commitment equals the
  expected value; V's handler runs with msg.sender = victim lock and debits the victim's entry. Master, minting
  uniqueness and the immutable-event pin all hold (the clone is 0x01, the master is preserved).
Same shape works for any routed graph handler: forged msg.sender, forged emissions/results, forged settlement table.
Aggravation (SUSPECTED): for routes with lifecycle handlers the route reads the lifecycle code from the scanned output
(compiler.ts:13290-13291, 13317-13330), so the clone also chooses split/merge/selfdestruct mode, which switches off
the minting-uniqueness guard in non-zero modes (GTT 44429-44437).
Not affected: routes where C3 is emitted (no entries/containers/dynamic/deploys): the clone unbalances the 0x01 count.

Fix. In compactAtomicBinder take `activeVerifierOutput = activeVerifier` and require that output's lock and full
category equal the input's (as the inlined body does at 12420). Defense in depth: restore the sidecar's transaction-wide
class balance (inputs minus outputs with the verifier lock and full category == 0) in
buildMessageBusVerifierCovenantScript, and update the matrix rows 11/17 to the code.

## KB-2 HIGH, CODE-CONFIRMED (projection and graph binding; standardness of the carrier lock not verified): evmCompat address identity is not injective, so a crafted bare-multisig caller equals any P2PKH or contract identity in `==` checks

Files:
- packages/solidc/src/generation/utils.ts:24-52 (compileAddressToEvmIdentity)
- packages/solidc/src/generation/GenerateTargetTraversal.ts:16340-16356 (evmCompat address `==`/`!=` normalizes both
  operands), :21816-21828 (emitGraphAddressIdentity: a 32-byte value keeps its last 20 bytes, no zero-prefix check),
  :24083-24087 (graph argument address binding uses the same projection)
- packages/solidc/src/compiler.ts:13057-13061 (verifier: nested-row caller is `tx.inputs[sourceSlot].lockingBytecode`,
  any lock), 12319-12322 (a participant needs only `lockingBytecode == participantLbc` and a minting NFT)

Root cause. The identity is: size 0 -> zeros, 20 -> as is, 32 -> last 20 bytes, 23 -> bytes 2..22, 35 -> HASH160(lock),
ANY other size -> bytes 3..23. No template check, so a lock of any other length projects to 20 bytes the attacker
places at offset 3. D13 (docs/framed/DECISIONS.md) describes the identity as HASH160 of the lock; the code does not.

Attack (evmCompat contract V with `require(msg.sender == owner)`, owner a P2PKH user or a P2SH32 contract):
- Pick a secp256k1 X whose first 20 bytes are the target identity T (T = victim pkh, or HASH160 of a contract's
  35-byte lock), random tail until X^3+7 is a square. Lock L = `OP_1 <02||X> <attackerPub> OP_2 OP_CHECKMULTISIG`
  (71 bytes); spendable with the attacker's key alone; L[3..23) = T.
- Fund L with a minting NFT of a fresh category; use it as participant A (manifest lbc = L). Row 0: A root
  (caller = tx.origin = the attacker's P2PKH). Row 1: A -> V nested call, sourceOffset 0, so V's verifier binds
  caller = L (13060) and V's handler gets msg.sender = L.
- `msg.sender == owner` compiles to identity(L) == identity(owner) = T == T: passes. Same for address equality against
  any stored P2PKH/contract identity, `uint160(msg.sender)`/`bytes20` casts, and the graph argument binding at 24083.
Precondition: evmCompat, an authorization by address equality, and a relayable bare 1-of-2 multisig output (BCHN's
default policy; otherwise a miner, or a 32-byte nonstandard lock via the size-32 branch).
Also applies outside the bus wherever an evmCompat msg.sender can be a non-P2PKH lock (direct convention, not audited).

Fix. Project by exact template: P2PKH only for size 25 with 76a914..88ac, P2SH20 only for a914..87, P2SH32 only for
aa20..87; every other lock -> HASH160(lock) (or a domain-tagged hash). For 32-byte words require the 12 zero bytes, as
GenerateTargetTraversal.ts:19921-19929 already does.

## KB-3 HIGH, SUSPECTED (needs a VM test): a routed callee's execution is enforced only by its own choice to run its verifier

Files:
- packages/solidc/src/compiler.ts:13307 (non-graph bound route: verifier skipped when `__internal__activeVerifierIndex < 0`)
- packages/solidc/src/compiler.ts:12319-12350, 12414-12418, 12466-12481 (a verifier checks other participants only by base
  lbc/category/base output and a verifier-slot unlocking prefix; it never requires a routed callee's verifier NFT,
  its digest, or that the callee's input runs its route)
- packages/solidc/src/compiler.ts:13020-13030 (the caller's expected emissions carry the callee's result from the manifest)

Root cause. Caller A's verifier trusts the manifest's row result for routed callee V (authority 0). That claim is
enforced only if V's route runs and invokes V's verifier. A non-graph bound route (a leaf compiled with explicit
`messageBus: true`) makes that optional, and nothing in A's verifier requires V's input to run its route at all (V's
master may also be spendable through a direct entry point that preserves state). The V5 direct-authority path does bind
the callee's unlocking (12646-12679); the routed path has no equivalent.
Attack shape. A: `require(token.transferFrom(msg.sender, this, amt)); shares[msg.sender] += amt;`. Manifest: A root,
A -> V `transferFrom` with result true. V's master is spent standalone (activeVerifierIndex = -1, any benign batch) or
through a state-preserving direct entry; V2+ base-output preservation holds. A credits shares; no tokens move.
Fix. Make the verifier mandatory on every bound route (drop the `>= 0` escape or split standalone into a separate
selector that refuses when input 0 carries an L3C1 envelope), and have each verifier bind, for every routed consumer it
relies on, the consumer's verifier NFT output (by index) or the consumer's `SCB1` route selector in its unlocking.

## Checked and sound
1. Route binds the verifier INPUT's code: OP_UTXOBYTECODE == specialized P2SH32 verifier lock (compiler.ts:11968).
2. Route rejects another category's verifier: category[0:32] == own master category, capability 0x01 (11969-11971).
3. Sidecar preserves its own lock, full category, amount and value at OP_INPUTINDEX (message-bus-verifier.ts:165-205).
4. Batch blob is pinned to the route input's own unlocking bytes with minimal push framing (compiler.ts:13524-13557).
5. Inlined verifier pairs its verifier output by index and checks category at the layout slot (12414-12422).
6. Participant bases bound by lbc + minting category; V2+ base outputs fully preserved (12319-12337).
7. Root-row caller = tx.origin, a template-checked token-free P2PKH (GTT 46348-46430; compiler.ts:13057-13058).
8. Route and verifier read the same input-0 envelope bytes (root-route reader 12059-12067), so they cannot diverge.
9. SCKP execution-plan digest is an off-chain push/drop marker (kernel-execution-plan-commitment.ts); no on-chain
   authority is claimed for it.
10. Minting-NFT uniqueness outside lifecycle modes (GTT 44425-44470): no extra 0x02 NFT.
11. Own-category immutable output pin for event-declaring contracts (GTT 44780+).
12. C3 count, where emitted, rejects an extra own-category 0x01 output (GTT 44552-44650), limiting KB-1's scope.
13. Journal identity select admits only flags 01/03/0a/(11)/0c, with 0c shape-checked as an 84-byte zero-successor
    absence record (GTT 34540-34584); out-of-range ordinals fail in the element scan.
14. Graph satoshi container: input value <= container output + sum of transfer outputs (GTT 3184-3216).

## Not reached
- Entry journal end to end: record-to-physical-NFT binding, emitKernelJournalReturnedSegmentBank (GTT 14761),
  final flush and dense-prefix rules (GTT 34739+), access-stream shape (35648); KernelEntryJournal.ts (SDK).
- KernelReadCarrierAuthorization.ts beyond its header (compile-time authority only) and the 0x11 read-carrier transition
  (GTT 34917); LowerVMapCounterLoops admission.
- emitGraphEventOutputIndex (GTT 3019), emitGraphFrameEventSlotBinding (41510), graph token-site binding, token
  container flows, transfer-window authentication inside graph subroutines.
- Proxy-forward envelope transport, upgrade (V2) and V4 signature frames, the kernelV2SignatureFence semantics,
  lifecycle (split/merge/selfdestruct) consequences of KB-1's forged code, V5 direct-authority soundness.
- kernel-capability-schema.ts, kernel-journal-disposition.ts, handler-frame-abi.ts, docs/kernel-diagnostics.md,
  `archive/docs:docs/framed/TRIAGE_SECURITY.md` F2 note.
