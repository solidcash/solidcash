<!-- cspell:ignore unconserved -->
# DX audit: direct-convention cross-contract and lifecycle checks

Scope: packages/solidc/src/generation/GenerateTargetTraversal.ts (GTT) and the covenants it relies on
(packages/utils/src/state.ts). Read-only; no tests, compiles or probes were run.

Line numbers are at the brief's HEAD df51215d6. HEAD moved to abbb7e0ec during the audit (a merge). That merge
does not touch any function cited here. In GTT it only shifts lines after about :21300 by roughly +57.

---

## DX-1. CRITICAL, CODE-CONFIRMED. Satoshi container drained beside any master spend that makes no non-zero native transfer

- **Where.**
  - Container covenant, master path: `state.ts:2378-2392` (`buildSatoshiContainerCovenantScript`, flag=1:
    `OP_IF <idx> OP_UTXOTOKENCATEGORY 32 OP_SPLIT OP_2 OP_EQUALVERIFY <cat> OP_EQUALVERIFY ... OP_ENDIF OP_1`).
  - GTT `emitValuePreservation` :46118-46176. The container is checked only when
    `pendingTransfers.length > 0` (:46128), and even then only inside `emitPendingTransferValueGuard`
    :3224-3236, which requires some transfer amount != 0.
  - `emitSatoshiContainerIdentity` :11986-12020 checks one input only, the one at the `satoshiContainer` slot.
- **Root cause.** The container's master path checks one thing: a minting NFT of the master category sits at a
  witness index. It never checks that the master accounts for the container. The direct master accounts for one
  container input at a fixed slot, and only on a path with an active non-zero transfer. The comment at :46118
  ("When pendingTransfers is empty the container is not co-spent here ... the container's own covenant still
  gates its master/merge spends") is false: the container's own covenant gates on presence alone. The framed
  convention accounts for all containers (`framed/master/value.ts:1-8`). The direct one does not.
- **Attack.**
  - Inputs:
    - [0] the master (or any thread), spent through any function the attacker may run that has no active
      transfer. Examples: any public setter, deposit, vote, ERC-20 transfer, or `pay(0)` on the e2e `NOSIG`
      contract.
    - [k..] every satoshi-container UTXO at `P2SH32(container(C))`, each unlocked with `<0> <1>`.
    - [f] a fee coin.
  - Outputs: what f() pins (the master's state output and so on), plus one P2PKH to the attacker with the
    containers' whole value.
  - f() never looks at inputs k..; each container's script sees the minting NFT at input 0. Accepted.
  - Variant: in a function that does transfer, only the slot container is conserved. Every other container UTXO
    co-spent at another index (for example from `payable` deposits, which add container outputs) is free.
- **Knock-on effects.**
  - `msg.value` (:46674-46745) and `address(this).balance` / `outState.balance` (:19267-19300, `emitBalanceLoop`
    :46906) sum every input or output at the container lock. The attacker can inflate them within one
    transaction: pay to the container address, then reclaim it through this hole.
  - A deposit credited from `msg.value` can be withdrawn again the same way. The contract credits the deposit,
    and the attacker reclaims the deposited UTXO in the next master spend.
- **Fix.** Pick one:
  - (a) In every direct master entry (every function kind except `unsafe(0)`), conserve the containers in
    aggregate, as framed does: (outputs at the container lock) - (inputs at the container lock) >= -(sum of
    authenticated sends).
  - (b) Make the container's master path require that the master input runs a function which names the
    container. For example, bind the container slot index in the master's unlocking and have every master entry
    refuse any container input outside its slots.
  - The cheapest sound form is (a) applied in `emitMasterValuePreservation`.

## DX-2. CRITICAL, CODE-CONFIRMED. Token containers drained the same way; the slot check is also skippable

- **Where.**
  - Covenant master path: `state.ts:2276-2292` (`buildTokenContainerCovenantScript`, presence of a minting NFT
    of the master category only).
  - GTT: identity check and preservation run only when `hasTokenContainerAccess` (:9530, :9539).
  - `emitTokenContainerIdentityVerification` :47648-47790 is wrapped in
    `OP_UTXOTOKENCATEGORY(slot) SIZE >0 IF` (:47652-47660).
  - `emitTokenContainerPreservation` :47975-48250: "input has tokens -> output has tokens" (:47994-48010), and
    every other check sits under `OUTPUTTOKENCATEGORY(slot) SIZE >0 IF` (:48012-48020).
- **Root cause.** Same as DX-1, for foreign-category FT/NFT custody. Two parts:
  - A function without `tokens[...]` access checks no token container at all.
  - A function with access checks only the container at its slot, and only when that slot input carries a token.
    A tokenless input there (the attacker's own coin) plus a tokenless output there skips the identity check,
    the "in has tokens" rule, the amount, lock and category preservation, and the TC satoshi rule
    (`emitValuePreservation` :46088-46110).
- **Attack.**
  - Inputs: [0] the master via any public function; [k..] every token container `P2SH32(tc(C, X))`, each with
    `<0> <1>`; a fee coin.
  - Outputs: the master's pinned outputs, plus the attacker's P2PKH carrying all X fungible tokens and NFTs.
  - CashTokens conservation is satisfied, since the X tokens only move.
  - In a `tokens[X].transfer(to, amt)` function: put a tokenless coin at the TC slot. The real container is
    co-spent elsewhere and pays `amt` to `to` plus the remainder to the attacker.
  - `tokens[X].tokenAmount` reads (`emitTokenContainerAggregateLoop` :47418-47530) can be inflated within the
    transaction by co-spending the attacker's own UTXOs pre-paid to the container lock and reclaiming them.
- **Fix.** As DX-1:
  - Conserve every input and output at each container lock the contract can own, aggregated per category, in
    every master entry.
  - At the slot, treat a tokenless input as "no container", and then require no input at that container lock
    anywhere in the transaction, instead of skipping.

## DX-3. MEDIUM, CODE-CONFIRMED. Forged event logs: the immutable-NFT pin exempts every commitment that starts with `SCID`

- **Where.** `emitOwnCategoryImmutableNftOutputPin` :44726. The SCID exemption is at :44788-44800
  (`commitment || 00000000`, split 4, `== 'SCID'`, `NOT BOOLAND`). The reader is
  `packages/solidcash/src/stateful/StateReader.ts:349-372` (`readEventsFromChain`), which filters only on
  category and a non-empty commitment.
- **Root cause.** Logical-identity anchors use the `SCID` envelope, so the pin skips any own-category immutable
  whose commitment starts with those four bytes. Nothing stops a real event's encoding from starting with them:
  - Plain events: first argument `3` (encoded `0x53` = OP_3), then a 67-byte bytes or string beginning `ID`
    (`0x43` = push 67).
  - `evmCompat` events: scalars are raw big-endian, so any `uintN`/`bytesN`/20-byte address first argument whose
    top 4 bytes are `SCID`, with the rest free (for example `Transfer(from=0x53434944.., to=attacker,
    value=any)`).
- **Attack.** Spend the master through any public function. Append an output at the event covenant address
  `P2SH32(event(C, sig))` that carries an immutable NFT of category C with the forged commitment. The minting NFT
  in the inputs permits it. The pin skips it, and `readEventsFromChain` returns it as a genuine log.
- **Related.**
  - The FT-carrying-immutable residual is documented in code at :44711. DX-7 hands anyone the FTs it needs.
  - The reader also does not check NFT capability or FT amount.
- **Fix.**
  - Exempt only exact anchor shapes: `SCID 0x01` plus the anchor's fixed length, and at the anchor's own lock
    family rather than at any P2SH.
  - Or give event commitments a prefix that cannot collide.
  - In the reader, also reject commitments that start with `SCID`, or that carry a non-`none` capability or a
    non-zero FT amount.

## DX-4. HIGH, CODE-CONFIRMED. Forged external-call return values (new variant of H2: the callee is told it is "standalone")

- **Where.**
  - B side: `emitReturnEventCovenantVerification` :42815-42936. `_returnOutputIdx < 0` skips every check
    (:42928). The witness is a plain ABI parameter (`SymbolTableTraversal.ts:4798-4810`), and A never binds it.
  - A side: `emitExternalCallVerification` checks only B's identity, preservation and selector (:41918-42160).
  - Return check and uniqueness: :42940-43075, :43080-43140.
  - B's own pin skips OP_TRUE carriers (:44819-44826).
- **Root cause.** H2's fix proves there is at most one OP_TRUE, none-capability, category-B output, and A reads
  its commitment. It assumes B pins one. B pins one only if the spender passes `_returnOutputIdx >= 0`.
- **Attack.** A.f() reads `x = B.get()`. The attacker builds:
  - Input A, running f with `externalReturnOutputIdx = k`.
  - Input B, running `get` (the selector A expects) with `_returnOutputIdx = -1`.
  - Output k: lock `0x51`, an immutable NFT of category B with an attacker-chosen commitment, at most 1200 sats.
    B's minting NFT authorizes minting it.
  - Every check passes: category, capability, FT, lock, value, and a uniqueness count of 1. A uses a forged x
    (a price, a share count, a balance, a bool) and pays out on it.
  - In STATICCALL mode there is no selector check at all, so B may run any commitment-preserving function.
- **Also.** Slots without an address identity (msg.sender targets, function pointers, loops) get no uniqueness
  check at all (comment at :43037-43062). A forged twin works there directly.
- **Fix.**
  - A must bind B's return witness. Parse B's unlocking from the redeem end, as D8 does for arguments, and
    require B's `_returnOutputIdx == A's externalReturnOutputIdx`.
  - Or have B treat the carrier as mandatory whenever it is co-spent beside a foreign master.
  - Extend uniqueness to every returning slot.

## DX-5. HIGH, CODE-CONFIRMED. A non-compat low-level `call`/`staticcall` never pins its target

- **Where.** `emitLowLevelCallVerification` :24720-24808, called from :25162 and :25274. The `target` argument is
  used only on the `evmCompat` branch (:24728-24731). Otherwise the code reads `OP_INPUTBYTECODE` at the witness
  `__internal__callInputIndex` and compares the first push to `data`. No `OP_UTXOBYTECODE == target` is
  emitted. Under `evmCompat` with an empty payload or no witness, the check is only "input has a non-empty
  unlocking" (:24763-24776).
- **Root cause.** `docs/call-model.md` section 5 promises "the target must actually be spent running exactly that
  calldata". The code checks the calldata bytes at an input the spender picks, not the target.
- **Attack.**
  - Contract A (default `evmCompat: false`) does `token.call(payload); credit(msg.sender, amt);`.
  - The attacker funds a P2SH32 coin with redeem `OP_DROP OP_1`, and spends it at `callInputIndex` with unlocking
    `<payload> <redeem>`.
  - The prefix check passes and `token` is never spent. A's `success` is hard-coded true (:25155-25178), so the
    call is skipped while the caller credits it.
- **Fix.** In the non-compat path, emit `idx OP_UTXOBYTECODE <target> EQUALVERIFY`, as the compat pin and the
  delegatecall pin do (:25213-25220). Fail closed when `target` is not an address the caller cannot choose.

## DX-6. HIGH, SUSPECTED. The direct C3 census is compiled out of message-bus builds (new variant or regression of C3)

- **Where.**
  - `emitDirectCollectionCensus` :45936-45941 returns unless `__messageBusExplicitlyDisabled === true`.
  - C3's count (`countsOwnCategoryNfts` :9516-9519) skips functions with entry access, token-container access,
    dynamic writes or deploys.
  - Auto mode keeps the message bus on for every contract with a graph edge (`compiler.ts:4272-4285`), and
    `messageBus: true` keeps it on too.
- **Root cause.** cf9724659 added the census that closes C3 for entry-access functions: an extra entry node or
  data NFT co-spent, then rewritten through flag=1/3 or destroyed through flag=2. Its own commit message says
  message-bus builds stay byte-identical, so their direct entries do not get it. Per F1 those direct entries
  still exist.
- **Attack (needs a VM test against a message-bus build's direct entry).** In any direct entry of a contract
  with external calls that reads a mapping: co-spend an un-accessed data NFT with `flag=2` (destroy) or `flag=3`
  (rewrite the commitment, `state.ts:133-180`), or co-spend an extra collection node rewritten through its write
  path. The function's script names neither.
- **Fix.**
  - Emit the census for direct entries whatever the message-bus mode.
  - Or prove the route verifier covers direct entries, and refuse the direct entry otherwise.

## DX-7. MEDIUM, CODE-CONFIRMED. A CREATE genesis can mint unlimited immutable NFTs and fungible tokens of the child category

- **Where.** `emitInlineDeployVerification` :39689-39960 counts only `childCat||02 == 1` and
  `childCat||01 == D+E` (:39955-39959, `emitDeployCapabilityOutputCount` :40318). The graph deploy at
  :40295-40300 counts the same way.
- **Root cause.** The genesis input at vout 0 lets the transaction create any FT amount and any NFT of the new
  category. The census leaves capability none (32-byte category) and pure-FT outputs uncounted.
- **Attack.** Anyone who triggers a public factory `new Child()` (for example `createPair`) appends outputs with:
  - immutable childCat NFTs at the child's event addresses, which become forged logs at birth;
  - `SCID` records, the F9 family;
  - an FT stash of childCat.

  The stash satisfies the documented FT-carrying-immutable residual (:44711) forever: in any later child spend,
  an immutable plus 1 FT at an event address is exempt from the pin, so arbitrary child events can be forged.
- **Fix.** Count every output whose 32-byte base category equals childCat: exactly 1 + D + E, with an FT amount of
  0 (or the declared supply) and no capability-none NFTs except the declared constructor emits.

## DX-8. HIGH, CODE-CONFIRMED (impact conditional). A delegate call leaves the implementation's own category unconserved (C3 variant)

- **Where.** In a delegate function (:9607-9611), the checks are proxy master preservation and minting
  uniqueness (proxy category), plus `emitDelegateSelfPreservation` (:44132) and `emitDelegateMintingNftUniqueness`
  (:44214), which cover only the implementation's master UTXO and its minting count. C3's count excludes delegates
  (:9516), and the census uses the proxy category (`emitMasterInputIndex`).
- **Root cause.** The implementation master D, a minting NFT, is co-spent in every delegated call. That opens:
  - D's own data and entry NFTs through flag=2 (destroy) and flag=3 (rewrite the commitment; `state.ts:133-180`);
  - minting of new D||01 and D NFTs;
  - D's satoshi and token containers (DX-1, DX-2).

  Nothing in the transaction conserves D's records. The code documents this only for D's events (:44715).
- **Attack.**
  - Call any proxy function through its delegate. In the same transaction, co-spend D's data NFT with
    `<D-master-idx> <out> <3>` and write a commitment with `owner = attacker`, or mint a second D data NFT with
    that commitment.
  - Then call D's own direct privileged function (for example an `initialize`, or `upgrade`/`selfdestruct`
    gated by a key read from D's state). D's script accepts the forged record.
  - Destroying or replacing D's master bricks every proxy that pins `impl` by locking bytecode (:25213-25220).
- **Fix.** In delegate functions, also apply the C3 count, or a full preserve-in-place, for D||01, and an
  immutable pin for D (`OP_INPUTINDEX`-based). Or forbid implementation contracts from holding their own
  records.

## DX-9. LOW, CODE-CONFIRMED. Weak points in the lifecycle-authorization safety net

- `checkLifecycleAuthorization` (the upgrade/deploy/split/merge must-sign rule) is turned off whenever
  `messageBus || messageBusKernel` (`compiler.ts:16167-16170`). That is the default for any contract with a
  graph edge, so an unauthenticated `split`/`merge`/`deploy`/`upgrade` compiles silently.
- `checkDataSig` counts as an authorizing guard (`SymbolTableTraversal.ts:18468-18470`, `:18804+`). A data
  signature over a fixed message binds no transaction and can be replayed.
- The sighash-ALL fence is applied only to `upgrade` (`fencesUpgradeSignatures` :14337-14344). Split, merge and
  deploy signatures stay unfenced, which is the F2 class.
- **Fix.**
  - Enforce the rule in every mode, or check it in the route.
  - Do not credit `checkDataSig` unless its message hashes the outputs.
  - Extend the fence to every lifecycle kind.

---

## Checked and sound
1. Transfer covenant: the output at the transfer slot has lock == recipient, value == amount and no tokens
   (:39090-39160).
2. Satoshi-container identity and drain guard when it runs: input lock pinned; the output keeps the lock or is
   worth 0 (:11986-12020). Conservation is `in <= out + sends` (:46128-46175).
3. Token-container transfer outputs: exact recipient, amount and category; for an NFT also commitment,
   capability and FT 0 (:47796-47960).
4. Token-container preservation when the slot input holds tokens: lock, amount net of sends, category
   (:47975-48250). See DX-2 for the gaps.
5. Active event outputs: commitment, event covenant lock, none capability, FT 0, at most 1200 sats
   (:41089-41290).
6. Not-taken event slots are bound to an empty commitment (SEC-10, :41336-41365). Zero-argument emits carry the
   marker byte (SEC-14, :18519-18535).
7. A reached external call requires masterIdx >= 0 (:23196-23206), so the epilogue's `idx<0` skip covers only
   untaken calls.
8. External-call identity (lock == pinned address), preservation (lock, category plus capability), and the
   compile-time selector (MD1) (:41918-42160).
9. Return-carrier checks: category B, none capability, FT 0, OP_TRUE lock, value; uniqueness per callee
   identity (:42940-43140). See DX-4 for the bypass.
10. Compat low-level call pin: identity, push4 selector, arguments (D8) (:24811-24870).
11. Delegatecall co-spend pin: `UTXOBYTECODE[delegateIdx] == impl` plus the forwarded-payload prefix
    (:25205-25262).
12. Delegate self-preservation (lock, value, category plus capability, commitment, FT) and the delegate's
    minting count (:44132-44310).
13. Proxy state output count by lock (1 master, D data) for delegate functions (:44650-44700).
14. Conditional-delegate preservation of own-category mutable NFTs in place unless the edge is reached
    (:45038+).
15. D18 genesis guard:
    - `OUTPOINTTXHASH(0)||02 == own category && OUTPOINTINDEX(0)==0` (`framed/master/prologue.ts:86-92`),
      emitted at the head of every direct entry `__construct` (:8724, :9802-9811), before parameter checks.
    - Both values use the serialized byte order.
    - A stateless constructor arm can never pass.
16. Upgrade: category plus capability kept, output lock == `__internal__upgradeBytecode`, sighash-ALL fence on
    every checkSig and multisig signature, including array multisig (:14320-14420, :44324-44345).
17. Split:
    - Master preserved: lock, category plus capability, value, commitment, exact FT.
    - N new outputs: minting, same category and lock, empty commitment, FT 0.
    - Total minting outputs == N+1 (:45368-45560).
18. Merge:
    - Survivor (input 0): preservation, consumed inputs in (D, D+N] with the same category and lock, exactly one
      minting output.
    - Consumed inputs: survivor match, index range, and each runs the merge body, including its signature
      (:45125-45290).
19. CREATE: child category from the vout-0 genesis input; child master lock plus `cat||02`; data and entry NFT
    lock, category and commitment; exact 0x02 and 0x01 counts (:39689-39960). See DX-7.
20. Minting-NFT uniqueness: no new own-category minting NFT in any function (:44371-44460).
21. The immutable pin covers selfdestruct and delegate functions (SEC-13, :9677-9712). Not-taken slots and empty
    commitments are consistent with the reader skipping empty commitments.

## Not reached
- `emitArrayExternalCallLoop` (:42220) and `emitInlineLoopExternalCall` (:42479) in detail (per-iteration index
  lists, loop return carriers).
- `emitExternalOutStateVerification` (:43141) and `emitExternalBatchBlobVerification` (:43207).
- Runtime-loop effect, event and transfer journals (:40431-41089), beyond their container conservation.
- `emitCompatTargetIdentity` (:24872): canonical-lock derivation for a 20-byte identity.
- `emitDeployCovenantVerification` (:40036) and the graph deploy paths, beyond the capability counts.
- Graph-handler and message-bus route variants of every check above.
