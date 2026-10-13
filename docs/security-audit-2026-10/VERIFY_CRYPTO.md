# VERIFY_CRYPTO: adversarial verification of CRYPTO-2, CRYPTO-3, CRYPTO-4

Tree: /Code/cashscript/.worktrees/per-call (feat/per-call), HEAD abbb7e0ec. This is a read-only check. No tests,
compiles or probes were run. GTT = packages/solidc/src/generation/GenerateTargetTraversal.ts.

## CRYPTO-2: CONFIRMED, CRITICAL

Decisive lines: GTT:13961-13993 (A and B side-cars authenticated only from OP_INPUTBYTECODE), GTT:13999 (pubkey read
from B's OUTPUT commitment), GTT:14017 + 14060-14066 + 14068 (keccak side-car K, same shape).

Reasoning:
- Non-loop branch. A: `idxA OP_INPUTBYTECODE`, decode the pushes, bind argBlob_A == argBlob, then
  `dropFirst(3) dropFirst(33) OP_HASH256 <A_COVENANT_HASH> OP_EQUALVERIFY`. B: drop 5 pushes, then the same hash compare.
  The pubkey is then read with `slotIdx('B', true) OP_OUTPUTTOKENCOMMITMENT`, and nothing checks OP_UTXOBYTECODE,
  OP_OUTPUTBYTECODE or OP_OUTPUTTOKENCATEGORY on A, B or K. Only the dynamic-loop branch compares OP_UTXOBYTECODE with
  the baked shared locks (GTT:13947-13958 and 14057-14058). Those are the only OP_UTXOBYTECODE emissions in
  emitEcrecoverComputeCall.
- Every index source is attacker-placed: count-relative, block-layout slot, threaded outlined index (GTT:13823-13836)
  and framed `OP_INPUTINDEX + 1 + 2k` (GTT:13814-13822). None of them adds a lock check.
- The loop path (ecrecoverLoopActive) is entered only by dynamic loops (GTT:36116-36125). Framed per-call bodies refuse
  ecrecover loops (framed/master/support.ts:2658-2659), so a framed compile only ever emits the unbound path. Nothing
  in framed/master pins the locks of side-car inputs.
- All three builtins route here (GTT:14258-14266), and so does `ecrecover` when the compiler option is set
  (SymbolTableTraversal.ts:1452, 1532). Under the direct convention, v outside [27,29) skips the side-cars
  (GTT:13917-13939), so the attacker uses v = 27.
- No test in the tree uses a bare-lock side-car as a negative case. EcrecoverRecovery.test.ts covers only
  wrong-signer cases with genuine side-cars.

Q2, whether any side-car covenant can be relied on without a lock binding: no.
- The genuine B covenant (packages/utils/src/ecrecover-compute-library.ts:15) does enforce the result:
  - The tail `c0 d2 88` makes OUTPUT[self].commitment equal the recovered key. `c0 c7 c0 cd 88` and `c0 ce c0 d1 88`
    keep its own lock and category.
  - The prefix `...7e7e aa c0 8c d2 88` links it to A: hash256(argBlob||shared||C) == OUTPUT[INPUTINDEX-1].commitment.
  - Both covenants start with `76 20<0^32> 87 63 75 67 00 ce 0120 7f 75 88 68`, which binds a non-zero salt to input 0's
    category.
- None of this executes unless the input's lock is P2SH32(hash256(0x20||salt||covenant)). With a bare lock, the
  covenant bytes are inert pushes.
- The caller checks no output lock or category. The SDK side-cars are `mutable` NFTs of whatever category the source
  UTXO has (packages/solidcash/src/ecrecover/ecrecoverComputeSidecar.ts:65-70), so a check on category scarcity is not
  available either.
- Output-side checks alone would not help, because anyone can pay an NFT with any commitment to the genuine P2SH32
  address. Only an input-lock binding (`OP_UTXOBYTECODE(idx) == aa20||hash256(redeem)||87`, or the baked shared lock)
  makes the covenant run. Once it runs, its self-preserving output fixes the commitment.

Severity: CRITICAL. The attack is permissionless and cheap, and makes any `ecrecover(...) == signer` gate pass, so
funds behind signature-gated logic (permit, meta-tx, owner withdraw) can be stolen.
The VM regression test should spend A, B and K as bare-lock inputs (`OP_2DROP.. OP_1`) whose unlocking carries the
genuine covenant pushes, add an attacker-genesis NFT output at B with commitment `02||QxLE`, and check that it is
REJECTED.

## CRYPTO-3: CONFIRMED, HIGH. The attack is wider than reported

Decisive lines:
- GTT:14207-14228. The index is the witness `__internal__blockhashInputIndex` (SymbolTableTraversal.ts:3810-3817), with
  no bind to master + slot anywhere. The checks are `OP_DUP OP_CHECKLOCKTIMEVERIFY OP_DROP`, then
  `OP_UTXOTOKENCATEGORY` with emitVerifyCatBaseEqMaster, then `OP_UTXOTOKENCOMMITMENT 4 OP_SPLIT OP_SWAP OP_BIN2NUM OP_ROT
  OP_EQUALVERIFY`. The read returns commitment[4:].
- GTT:31351-31353 and 31363-31366 compare only the 32-byte category base and drop the capability on both sides. The
  shared subroutine at GTT:4911-4914 has the same body.
- utils/state.ts:2203 states the design: "the consumer reads by category + commitment.n, never rebuilds this address".
  There is no lock check, no capability check and no length check.

Fake oracle sources:
- (a) The event NFTs, as reported:
  - They are own-category with capability none.
  - Their lock lets anyone spend them after CSV 144 (state.ts:2112-2135).
  - Their commitment is the caller's arguments (GTT:41194-41206), packed raw under evmCompat (GTT:21580-21586).
- (b) NEW and stronger: the master co-spent in any call holds minting capability, so the attacker can append an
  own-category immutable NFT with any commitment:
  - The only guard is emitOwnCategoryImmutableNftOutputPin. It is emitted only when
    `declaresEvents || currentFunctionIsDelegate || proxyCanAdmitDelegateEvent` (GTT:9710-9713), so a blockhash
    consumer without events has no guard at all. The SEC-11 comment at GTT:44752-44755 records that this mint was
    "measured live on a plain stateful contract with NO ... emit".
  - When the pin is emitted, it exempts outputs whose lock is exactly `51` (OP_1) (GTT:44874-44879).
  - The mutable census (GTT:44575-44600) counts only capability 0x01, and nothing else counts immutable outputs.
- Attack (b):
  1. tx1: any public call, for example f(n', H') with a genuine windowed oracle. Append an own-category NFT with
     capability none, commitment LE4(n)||X32, at lock OP_1 (or any lock if the contract has no events).
  2. tx2: call f(n, X) and point `__internal__blockhashInputIndex` at that UTXO.
- This needs no event, no 144-block wait, and no constraint on `n mod 256` in native mode. It works for any n up to the
  tx locktime.
- Scope: framed (per-call) bodies refuse blockhash (framed/master/support.ts:2653-2654), so this affects the direct
  and kernel stateful path.

Impact on the proposed fix: a lock binding alone is not enough. In an event-less contract, the attacker mints the fake
directly at addr_C(n), and the oracle covenant's own self-pin (category C, capability none) accepts it. The fix needs
three parts:
1. Lock-bind the oracle input.
2. Emit the immutable-output pin for every stateful contract, and drop the OP_1 exemption for blockhash users.
3. Better still, move the oracles to a separate keeper category, which also fixes CRYPTO-4.
Also require capability none and a commitment size of 36.

Severity: HIGH. Anyone can forge blockhash(n) for any past n at no cost. For any consumer that pays out on blockhash
(lottery, commit-reveal, chain-anchored proofs), this becomes CRITICAL.
The VM test should run tx1 then tx2 above on `contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); }}`
and check that tx2 is REJECTED.

## CRYPTO-4: CONFIRMED, HIGH. Worse than suspected: the keeper can rewrite existing records, not just mint new ones

Decisive lines:
- utils/state.ts:239-256, the data-NFT write path (flag=1). It requires only "a minting NFT of category C at the
  witnessed masterInputIndex", plus this input's category, and does not preserve the commitment (common tail 277-300).
- utils/state.ts:192-235, the destroy path (flag=2), which uses the same minting-NFT test.
- utils/state.ts:1910-1917, the entry/mapping NFT write path, which has the same shape.

Reasoning:
- Who holds the baton: the keeper. The design says so in packages/solidc/docs/block-and-transaction-properties.md:
  316-319 ("from a minting baton of that category").
- The SDK mints with `blockhashOracleMaster` at the keeper's own lock (packages/solidcash/src/oracle/
  blockOracleUpdater.ts:176-198).
- No contract-side mint path exists. The read requires the oracle category to equal the contract's own (GTT:14223), so
  every blockhash deployment needs a second minting NFT of C outside the master.
- The e2e fixture places that baton at an anyone-can-spend OP_1 P2SH (BlockOracle.test.ts:728-760). The comment says
  "production gates it on the keeper key".
- What the baton holder can do without the master ever running:
  - Point masterInputIndex at the baton, spend any data or entry NFT with flag=1, and rewrite its commitment in place:
    balances, owner and other fields.
  - Burn records with flag=2.
  - Mint new own-category NFTs of any capability: mutable records at the data-covenant address, which framed T46 lock
    pinning (GTT:38160-38185) also accepts, or a duplicate minting master at the master's address.
- Direct data reads check only the category base at master+offset (GTT:31372-31385). In non-framed mode, preservation
  is in==out lock (GTT:38187-38195), so forged mutable records are also accepted when co-spent with the genuine master.

Severity: HIGH. A privileged keeper, or anyone who takes its key, gets full write and destroy power over contract
state, which is far beyond "publishes block hashes". It is not permissionless in production. It becomes CRITICAL if
the baton sits at a weak lock like the test fixture's OP_1 P2SH.
The VM test: put the baton (minting C) at input 0, a genuine data NFT at input 1 unlocked `<0> <1>`, and output 1 with
the same lock, category and value but a new commitment. Check that it is REJECTED. Today it is accepted by reading.
Fix: a separate oracle category held by the keeper, with no second baton of C. Optionally, the data and entry
covenants should authenticate the master by lock as well as by minting capability.
