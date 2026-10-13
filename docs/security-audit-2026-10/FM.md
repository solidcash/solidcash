# FM audit: framed master head (feat/per-call @ df51215d6)

Scope: packages/solidc/src/framed/master/{master-head,prologue,witness-reader,lifecycle,master-program,frame-tail
(head helpers),value,composition}.ts; packages/utils/src/framed/{witness-block,identity}.ts; GTT emitters
emitFramedGenesisGuard, emitFramedEventCountCheck, emitFramedCallValueCheck, emitMsgSender, emitTxOrigin,
emitCallerSelfContext, emitMsgValue. Static reading only; no tests, compiles or probes were run.

---

## FM-1 CRITICAL, CODE-CONFIRMED: N1 recognizes a fake validator. The validator input's lock is never checked

Files:
- packages/solidc/src/framed/master/frame-tail.ts:794-819 (`recogniseValidatorScriptAgainstReservedHash`)
- packages/solidc/src/framed/master/master-head.ts:860-883 (`branchOnValidatorNeed`, the only caller)
- spec docs/framed/SPEC_FRAMED_TRANSACTION.md:861-866 (N1) and T5 (line 1107), which claim T5 is closed

Root cause. The recognizer reads input `v = validatorRef` and checks only these things:
1. `OP_UTXOTOKENCATEGORY(v)` is 33 bytes and ends in 0x01 (a mutable NFT of any category `c`).
2. `OP_INPUTBYTECODE(v)` is exactly two pushes, `<M> <R>`.
3. `R = b0 || pin || P` with `sha256(P) ==` the reserved slot, and `pin == c||0x01`.
   `b0` is dropped by `OP_1 OP_SPLIT OP_NIP` and never compared with 0x21.

It never reads `OP_UTXOBYTECODE(v)`. The comment ("P2SH32 consensus gives its lock as addrV(c)") holds only if
the input really is P2SH32. The VM runs `R` as a redeem script only when the lock matches the P2SH20 or P2SH32
template (libauth bch-2023-instruction-set.js:86-121). Under any other lock, `R` is inert data.

So anyone can make a "validator" that runs no V-check:
- Mint a mutable NFT of their own new category `c`. Any genesis does this.
- Lock it with a bare script such as `OP_2DROP OP_1` (6d51). The stack `[M, R]` ends as `[1]`, which passes
  CLEANSTACK.
- Unlock it with `<junk> <0x21 || c || 0x01 || V_TEMPLATE>`. V_TEMPLATE is public: it is in every artifact and in
  every spent validator input.

The master accepts this input as its validator. Every check the head delegates to the validator (V4/V5/V7/V8/V10)
is then gone.

Second variant (SUSPECTED). Even under a P2SH32 lock, an unchecked `b0` (for example 0x4c or 0x4d, with `c[0]` or
`c[0..1]` ground over 2^8 to 2^16 genesis candidates) makes the VM parse `R` misaligned. It then runs a suffix of
V_TEMPLATE that the attacker picks. Whether some suffix succeeds is unproven.

What the attacker gets (GTT always builds every master as composed, with ROOT/CALL/STATIC/DELEGATE admitted,
GenerateTargetTraversal.ts:3705, and with the validator hash slot reserved, compiler.ts:16431):

a. msg.sender forgery on any entry of any framed contract. Spend X's master with a `CALL` frame:
   - kind = 1, `self = addrX` (the public constant);
   - `sender` = the victim's lock, or the owner or admin address read from X's state;
   - `callerRef` = any other input, `originRef` = any input;
   - `validatorRef` = the fake validator.
   The head checks only `callerRef != self`, `self == addrX`, kind and value. `msg.sender` is the witness `sender`
   (GTT emitMsgSender :46621 reads the slot as-is). X has one master in the transaction, so the head settles
   alone (master-head.ts:920-964, `countMasters == 1` and kind != DELEGATE). That settlement makes the records
   follow the body exactly as the body computes them with the forged sender. Examples:
   `transfer(attacker, balanceOf(victim))` as the victim; `transferOwnership`/`upgradeTo`/`mint` as the owner;
   withdrawing to a forged `msg.sender`.
b. Forged `tx.origin` (`OP_UTXOBYTECODE(originRef)` of any input), forged call results (`calls[k].result`) and
   forged `retval` bindings, because V5 never runs.
c. Unsettled state rewrite. The attacker can make the master skip self-settlement in either of two ways:
   - put two masters of X in the transaction (`countMasters > 1`);
   - give X's master a `DELEGATE` frame, which every master admits. Kind 3 never self-settles, and its owner is
     the attacker-chosen `callerRef`.
   Either way neither the master nor the fake validator settles X. X's record covenants require only that a
   master of X be present (spec 7.3 D1). So the attacker spends any of X's data-NFT, mapping and chunk records
   and writes arbitrary commitments and values for them: state takeover plus theft of record value. With the head
   census also skipped (`selfSettlementScript` never runs), the master's minting NFT also lets the attacker mint
   arbitrary immutable catX NFTs (forged events) and stray mutable catX NFTs. The pool check
   (lifecycle.ts:208) covers only minting NFTs and fungible amounts.

Transaction shape (variant a):
- in0: attacker P2PKH (fee).
- in1: X master, unlocked with `<block{kind=1, callerRef=0, originRef=0, validatorRef=2, sender=victimLock,
  self=addrX, value=0, calls=0, segments=1 (the victim's and recipient's records, real viewIn, computed viewOut),
  events as the body emits}> <selector+args> <code_X>`.
- in2: fake validator, with lock `6d51`, token = mutable NFT of the attacker's category `c`, unlocked with
  `<00> <21 || c || 01 || V_TEMPLATE>`.
- in3..: X's touched records.
- outputs: the master recreated at index 1, the records as the body computes, the listed events. in2's token goes
  anywhere.

Suggested fix: in `recogniseValidatorScriptAgainstReservedHash`, require all of:
- `R[0] == 0x21`;
- `OP_UTXOBYTECODE(v) == 0xaa20 || OP_HASH256(R) || 0x87`, that is, the input really is P2SH32 of the `R` it
  pushes. Only then is `R` what runs.

Add a VM test with a bare-lock validator, and one with a P2SH32 validator whose `b0 != 0x21`. Update the T5 row,
which lists this as closed.

---

## FM-2 INFO, CODE-CONFIRMED: readOwnWitnessBlockScript reads any non-PUSHDATA2 first push as PUSHDATA1

- File: packages/solidc/src/framed/master/witness-reader.ts:91-115.
- What the code does: the ELSE branch drops the opcode byte and takes `bytes[1]` as a one-byte length without
  checking `bytes[0] == 0x4c`. A direct push (0x01-0x4b) or `OP_0` as the first push is therefore read from a
  different place than the VM reads it.
- How the other readers differ: the caller's call-site binding (call-site.ts:210-222), `collapseCallDataBand` and
  the validator all use `splitFirstPushScript`/`dropFirstPushScript`, which parse VM-correctly.
- Why it is not exploitable: the magic is `50 57 01`, and it cannot appear both at `bytes[1..]` and at
  `bytes[2..]`. So a block that the master accepts under the misparse is refused by every VM-correct reader. Only
  a ROOT frame that stands alone (where the attacker is the signer) can use the misparse. Honest blocks are always
  at least 82 bytes, so they always use PUSHDATA1 or PUSHDATA2.
- Why it is reported: the doc comment says "anything else fails", which is false.
- Fix: require the first byte to be 0x4c in the ELSE branch, or reuse `splitFirstPushScript`.

---

## FM-3 INFO, CODE-CONFIRMED: the lifecycle admin signature admits ANYONECANPAY

- File: packages/solidc/src/framed/master/lifecycle.ts:256-266 (`authorise`).
- What the code does: it checks `sighash & 0x1f == 0x01`, so 0xC1 and 0xE1 (ACP|ALL) pass. The count `n` and the
  mode are unsigned unlocking pushes.
- What an attacker can do with an ACP admin signature: swap the other inputs of a split or merge, which means
  choosing which masters are retired, or retiring fewer than the admin intended (and resetting `n` to match).
  Outputs stay fixed. The pool cannot be minted beyond what the signed outputs show, and nothing is stolen.
- Fix: refuse the ACP bit (require `sighash & 0xdf == 0x41`, as the head's root fence does).

---

## Checked and sound

1. P1 (prologue, master-head.ts:412-427): `OP_UTXOTOKENCATEGORY(self) == slot||0x02` refuses loose BCH, a foreign
   category and non-minting tokens at lockX.
2. P2: the output at OP_INPUTINDEX has the same lock, `slot||0x02`, an empty commitment (`OP_0 OP_EQUALVERIFY`)
   and value >= input.
3. R2b pool (lifecycle.ts:208-226): for every index, input-minting(catX) == output-minting(catX), and no catX
   fungible amount on any input or output. It counts by token only, so it covers facet locks too.
4. Lifecycle arm: split/merge need the constant 33-byte admin key's CHECKSIGVERIFY with base type ALL, plus the
   literal bounds. Retire needs a sibling master at the same lock that is recreated, which forces a merge arm (the
   head pool and the split census both refuse a retirement). The census refuses every non-minting catX token and
   puts new masters at the arm's own lock with an empty commitment and zero fungible amount.
5. The arm skips the category slot, but it admits only the input's own minting category. A foreign minting NFT
   parked at lockX can do nothing without the admin key.
6. W1 hash-type fence (master-head.ts:1129-1151): the "signature" is the first push of `OP_INPUTBYTECODE(callerRef)`.
   The lock is forced to the exact 25-byte P2PKH shape, and CLEANSTACK plus push-only make that unlocking exactly
   `<sig> <pubkey>`, so the fenced push is the one OP_CHECKSIG verifies. Schnorr and DER both end in the hash type.
   Mask 0xdf == 0x41 admits only 0x41 and 0x61.
7. ROOT (master-head.ts:785-800): `originRef == callerRef` (numeric), `origin == sender ==` the P2PKH lock of
   callerRef, and the hash-type fence runs. O1 for ROOT is therefore the same input and the same fence.
8. `callerRef != OP_INPUTINDEX` on every composed frame (:1108). `self ==` the addrX slot for every kind but
   DELEGATE (:721).
9. Frame kinds: ROOT/CALL/STATIC/DELEGATE are branched explicitly. INTERNAL (4), CREATE and any other kind are
   refused (`OP_0 OP_VERIFY`). A kind byte of 0x80 aliases ROOT through BIN2NUM, but the validator compares kinds
   numerically too, so the two stay consistent.
10. N1 standalone branch (:886-895): it requires ROOT, a compile-time refusal when callCount > 0, self-settlement
    and countMasters == 1. countMastersScript (frame-tail.ts:721) scans every input for `catX||0x02`, so it counts
    masters at other locks and facets (T10).
11. Self-settlement gating (:920-964): count == 1 AND kind != DELEGATE AND (when there are context-call sites) no
    DELEGATE/INTERNAL record in the block. Record kinds are bound per site (call-site.ts:178) and the body pins the
    count, so T57's fix holds.
12. S2/S3 census (frame-tail.ts:1048-1110): every index must have `catX||01` on input and output exactly where the
    chain saw the record. The only extra mutable tokens admitted are validator pairs at addrX, recreated in place
    with empty commitments on both sides (T49). Bare catX outputs are counted at <= the declared events, and the
    tail proves each listed event is a distinct bare output (T56).
13. T54 constructor guard (prologue.ts:86-92, GTT:4199, :8970): `OP_0 OP_OUTPOINTTXHASH || cap ==
    OP_UTXOTOKENCATEGORY(self)` with `OP_0 OP_OUTPOINTINDEX == 0`. Both opcodes push wire order (libauth
    inspection.js:54 and bch-2023-tokens.js:213 both reverse the stored hash). No live transaction can spend
    `(catX, 0)` again, so the arm is dead on-chain on every `__construct` entry.
14. msg.value: read as BIN2NUM of 8 bytes, then:
    - With no value handling, value == 0 for every kind (:686).
    - Value handling but no payable body: value == 0 (:985-991).
    - A payable body: value >= 0. Each non-payable body pins 0 (GTT emitFramedCallValueCheck). STATIC pins 0.
    - Alone: container growth plus sends plus call values must be >= value.
15. Call-record walks (callWalkScript, blockRecordsNoContextCallScript): a negative or forged declared count is
    refused by the body's made-count pin.
16. Census address read (pushContractAddress via OP_ACTIVEBYTECODE): it is retargeted after the lifecycle wrap
    (compiler.ts:16502-16507), so the offset matches the final script.

## Not reached

- V_TEMPLATE itself (V2-V11 completeness). The program says V7 is not fully emitted (program.ts:170-175), and
  non-alone msg.value and record values rely on V7.
- Whether a genuine validator of an attacker-owned category `c` can cover a victim master (V9/V11 owner policy).
- S1 chain details in `selfSettlementScript` beyond the census: how deletion is bound to the body's write
  (declared-view.ts, write-activation.ts) and the record-shape check (`requireRecordShape`).
- The event and send walks inside `verifyTailScript` (the eventSection and sendSection bodies), and
  `segmentLoopScript`.
- composition.ts (58 lines, convention selection only) and utils canonical.ts/identity.ts, beyond the pin length.
- S3 identifies records by `catX||01` and index only; the head never checks a record's lock. The body pins the
  data-NFT lock for non-delegate frames (GTT ~38150-38175, the T46 comment plus an OP_UTXOBYTECODE compare). I
  did not trace that pin, and the mapping-entry and chunk equivalents, to the end. DELEGATE frames skip the pin
  by design (G0 lane).
