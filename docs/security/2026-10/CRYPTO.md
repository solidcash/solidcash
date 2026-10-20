<!-- cspell:ignore hashlock -->
# CRYPTO audit: cryptographic builtins and chain-data oracles

Tree: /Code/cashscript/.worktrees/per-call, branch feat/per-call, HEAD abbb7e0ec (2026-10-11).
Read-only. No tests, compiles or probes were run. GTT = packages/solidc/src/generation/GenerateTargetTraversal.ts.

## Findings

### CRYPTO-1 - CRITICAL - CODE-CONFIRMED - keccak256 result forgery: the compute side-car is authenticated only by its UNLOCKING bytes

- Where: GTT:13549-13740 (`emitKeccakComputeCall`). Index at 13665 (`fromEnd(OP_TXINPUTCOUNT)`), `OP_INPUTBYTECODE` at
  13674, preimage bind at 13684, covenant check at 13704-13719 (`hash256(covenant) == KECCAK256_COMPUTE_*_HASH`, or for a
  dynamic keccak loop a direct byte compare with `KECCAK256_COMPUTE_STATEFUL_COVENANT`, 13714), result read
  `OP_OUTPUTTOKENCOMMITMENT` at 13720-13721. Every keccak256 compiles to this path (SymbolTableTraversal.ts:3842-3854:
  "EVERY keccak256 uses it"): stateless, stateful block slot, helper basis slot, framed, and dynamic loop.
- Root cause: the "integrity" check takes the covenant from the side-car input's unlocking bytecode. It never checks
  that input's locking bytecode (`OP_UTXOBYTECODE`), and it never checks the token category or lock of the output it reads
  the digest from. The covenant bytes in an unlocking push run only if that input's lock is
  P2SH32(hash256(0x20||salt||covenant)). Under any other lock they are inert data. The only `OP_UTXOBYTECODE` side-car
  checks in the file are in the ecrecover dynamic-loop path (13948, 13957, 14057).
- Attack (stateless consumer `function claim(bytes s) { require(keccak256(s) == hashlock); ... }`):
  1. Fund a coin at the bare P2S lock `OP_2DROP OP_2DROP OP_1` (3 bytes; standard).
  2. Build the spend. Input 0 is the contract, called with an arbitrary `s`. The last input is the coin from step 1,
     unlocked with `<pad (may be OP_0)> <s> OP_1 <PUSHDATA2(0x20 || any32 || KECCAK256_COMPUTE_COVENANT)>`. That is the
     exact layout the SDK emits (keccakComputeSidecar.ts:101-108), and the bare lock accepts any 4 pushes.
  3. Make the last output carry an NFT whose commitment is `hashlock`. Its category comes from a genesis on an input
     with vout 0, or from any minting NFT the attacker holds.
  The contract decodes `s` and binds it to the argument. hash256 of the trailing covenant equals the baked constant, and
  the last output's commitment is read as keccak256(s) == hashlock. The claim passes without the secret. The same
  forgery breaks Merkle proofs, commit-reveal, EIP-712 digests and anything else keccak-derived, including ecrecoverEvm
  (CRYPTO-2).
- Fix: bind the side-car's lock to the code. Either (a) `OP_UTXOBYTECODE(idx) == aa20 || hash256(redeem) || 87`, where
  `redeem` is the PUSHDATA2 payload already on the stack (keep the covenant-hash check so the salt is the only free part),
  or (b) for shared-salt side-cars, compare with the baked `keccakComputeLockingBytecode(zero, stateful)` constant, as
  14057 already does. Bind the result output as well (`OP_OUTPUTBYTECODE(k) == OP_UTXOBYTECODE(idx)`). That is implied
  once the lock is genuine, because the genuine covenant self-preserves. Add a VM negative test that uses a bare-lock
  side-car.

### CRYPTO-2 - CRITICAL - CODE-CONFIRMED - ecrecover / ecrecoverPubKey / ecrecoverP2pkh / ecrecoverEvm return an attacker-chosen signer (non-loop path)

- Where: GTT:13960-13993. The A integrity check reads `OP_INPUTBYTECODE(idxA)` (13961) and checks hash256 of the trailing
  covenant (13983-13987). B is handled the same way (13988-13993). B's output commitment is read as the pubkey at 13999.
  The EVM projection's keccak side-car K is likewise checked only from its unlocking (14017, 14060-14066), and its output
  is read at 14068. Only the dynamic-loop branch (13942-13959, 14053-14059) uses `OP_UTXOBYTECODE == baked shared lock`.
- Root cause: same as CRYPTO-1. None of A, B or K has its lock bound, and B's argBlob is not even decoded. On a genuine
  B, the A->B link (`hash256(argBlob||shared||C) == OUTPUT[INPUTINDEX-1].commitment`, from the B covenant prefix
  `...7e7eaac08cd288`) is enforced only by B's covenant, and that covenant never runs.
- Attack (`function withdraw(bytes32 h, uint8 v, bytes32 r, bytes32 s) { require(ecrecover(h,v,r,s) == owner); pay(); }`
  with ecrecover:'evm', or `ecrecoverP2pkh` / `ecrecoverPubKey`):
  - Use v = 27 so the invalid-v branch (13917-13939) is skipped. h, r and s can be anything.
  - Input A: bare lock `OP_2DROP OP_2DROP OP_DROP OP_1`. Unlocking `<32 zero bytes> <argBlob = h||v||r||s> <OP_0> <OP_0>
    <PUSHDATA2(0x20||any32||ECRECOVER_COMPUTE_A_COVENANT)>`. The pad must be at least 32 bytes only in framed mode. The
    unlocking is about 7.5 KB, under the 10,000-byte limit.
  - Input B: bare lock that drops 6 pushes. Unlocking `<OP_0> <any> <OP_0> <OP_0> <OP_0> <PUSHDATA2(0x20||any32||COV_B)>`.
  - Output at B's index: an NFT (genesis) with commitment `0x02 || QxLE(33)`, where Q is a key the attacker picks.
  - ecrecoverEvm only. Input K: bare lock. Unlocking `<OP_0> <P = Qx||Y with Y odd/even to match> <OP_1>
    <PUSHDATA2(0x20||any32||KECCAK256_COMPUTE_COVENANT)>`. Output at K's index: an NFT with commitment `any12 || owner20`.
  The result is `owner`, or for p2pkh / pubkey whatever the attacker set. The attacker steals any funds that
  signature-gated logic protects (permit, meta-tx, owner-signed withdrawals).
- Fix: in the non-loop branch, emit the loop's lock checks on A, B and K: `OP_UTXOBYTECODE == ECRECOVER_COMPUTE_A/B_SHARED_LOCK`
  and `KECCAK256_COMPUTE_*_SHARED_LOCK`, or the computed P2SH32 of the revealed redeem for branded salts. Keep the
  argBlob bind on A. The loop path shows this is affordable (a 35-byte compare instead of hashing 7.4 KB).

### CRYPTO-3 - HIGH - CODE-CONFIRMED - blockhash(n) is authenticated by category and a 4-byte prefix, at an index the caller chooses

- Where: GTT:14202-14229. The input index is `__internal__blockhashInputIndex`, a plain unlocking parameter (synthesized
  at SymbolTableTraversal.ts:3810-3817 and never compared with master + slot offset). The checks are CLTV(n), then
  `emitVerifyCatBaseEqMaster` (GTT:31338-31367), which compares only the 32-byte category and drops the capability byte
  (31351-31353), then `BIN2NUM(commitment[0:4]) == n`. The function returns `commitment[4:]` with no length check. It does
  not check the oracle's lock `addr(n)` or require capability `none`.
- Root cause: the (n->hash) oracle shares the contract's own category (by design, docs/block-and-transaction-properties.md:
  303-319), so every NFT of that category is a valid oracle: the master (minting), data records, entries, token
  containers and event NFTs. Event NFTs carry the contract's category with capability none, and anyone can spend them
  after 144 blocks (utils/state.ts:2112-2135). Their commitment is the caller-supplied arguments concatenated, raw/packed
  for evmCompat scalars (GTT:18521-18560, 21580-21590).
- Attack (evmCompat, `event Committed(bytes32 c, address who)` emitted by `commit(bytes32 c)`, and
  `settle(uint n)` that uses `uint(blockhash(n)) % k`):
  1. Call `commit(c*)` with `c* = LE4(n) || X28`. This mints event NFT E with commitment `c* || who`.
  2. Wait at least 144 blocks, then build `settle(n)` with E as an extra input (nSequence >= 144), tx locktime >= n, and
     `__internal__blockhashInputIndex = index(E)`.
  The category matches the master's and the prefix decodes to n, so `blockhash(n)` returns `X28 || who`. The attacker
  grinds X28 to pick the outcome. In native mode the push-length byte is the first byte, so it works when
  n mod 256 = 0x20. Records whose first bytes the caller controls work too.
- Fix: authenticate the oracle by lock. Require `OP_UTXOBYTECODE(idx) == blockhashOracleLockingBytecode(cat, n)`, built
  on chain from the master's category and n (the covenant is about 120 bytes; hash it on chain), or use a separate oracle
  category. Also require capability `none` and a commitment size of 36. Optionally bind idx to master + slot offset.

### CRYPTO-4 - HIGH - SUSPECTED - the blockhash keeper must hold a minting baton of the contract's OWN category

- Where: design at docs/block-and-transaction-properties.md:317-319 ("from a minting baton of that category"). The SDK
  takes the baton at blockOracleUpdater.ts:131-133 and mints with it at 176-198. On chain, records are authenticated by
  category only: data NFTs at GTT:31370-31385, oracle reads at GTT:14221-14223. Data NFTs share the master's covenant
  address and differ only by a commitment tag (utils/state.ts:1300-1314).
- Root cause: CashTokens covenant soundness assumes the covenant holds the only minting authority for its category.
  blockhash() makes an external party hold one.
- Attack (privileged keeper, escalating from "publishes block hashes" to "forges state"): mint an NFT of category C at the
  contract's covenant address, with a forged data-record commitment (tag + fields such as balances or owner) or a
  duplicate minting master with forged state. Co-spend it where the contract reads that record. The category check
  passes. Not VM-tested. A suspected master-side binding of data-record contents was not found by grep.
- Fix: mint (n->hash) oracles under a separate keeper category and authenticate reads by lock + that category (see the
  CRYPTO-3 fix). Never require a second minting baton of the contract's own category.

### CRYPTO-5 - MEDIUM - CODE-CONFIRMED - the "cannot over-report the height" bound on block.number is bypassable

- Where: SynthesizeBlockOracle.ts:371-377 (`tx.time >= __set_number`) lowered to `OP_CHECKLOCKTIMEVERIFY OP_DROP`
  (generation/utils.ts:69). Nothing checks `__set_number < 500,000,000`.
- Root cause: CLTV accepts a time-type operand whenever nLockTime is time-type. The owner sets nLockTime to the current
  MTP (about 1.76e9) and writes any block.number in [5e8, MTP]. There is no monotonicity check either: number can be
  rewound to any lower value.
- Impact: the oracle owner can satisfy any `block.number >= deadline` immediately, or replay old windows. This defeats the
  only on-chain bound the design claims (header comment at SynthesizeBlockOracle.ts:36-39).
- Fix: `require(__set_number < 500000000)` before the CLTV, plus `require(__set_number >= __block_number)`, and the same
  `>=` for the timestamp.

### CRYPTO-6 - LOW - CODE-CONFIRMED - block.timestamp is an owner-written register with no bound, freshness or monotonicity, and the compiler is silent

- Where: SynthesizeBlockOracle.ts:239-247 (every `block.timestamp` / `now` / Yul `timestamp()` becomes `__block_timestamp`)
  and 361-383 (the updater writes the timestamp with only the owner's signature).
- Impact: a "before deadline" check (`block.timestamp < T`) is evaluated against the last keeper write. Any spender can
  still act after the real deadline until the keeper refreshes, and can race the refresh because both spend the master.
  The owner can set any timestamp, past or future. Unlike the warnShim used for prevrandao and gaslimit, no warning is
  emitted. This is documented as owner-trusted (docs section 4), but ported Solidity assumes a miner bound of about
  15 seconds.
- Fix: emit a warning on block.timestamp/number use. Optionally bind the timestamp to `tx.time` when the locktime is
  time-type, and enforce monotonicity.

### CRYPTO-7 - INFO - CODE-CONFIRMED - an invalid v returns address(0), which can match an unset address

- Where: GTT:13917-13939 and 14089-14094. Under the direct convention, address-returning recovery with v not in {27,28}
  returns 20 zero bytes (evm) or empty (p2pkh) without reading the side-cars. In framed mode, `emitRecoveryAccepted` and
  off-curve also return 0.
- Impact: `require(ecrecover(...) == signer)` with an uninitialized `signer` passes for anyone. This matches the EVM, as
  with raw ecrecover and no OpenZeppelin zero check. A lint or warning would help.

### CRYPTO-8 - INFO - CODE-CONFIRMED - small oracle and recovery parity gaps

- blockhash readers do not enforce EVM's 256-block window. An unswept (n->hash) NFT stays readable after n+256, while the
  EVM returns 0 (GTT:14209 checks only tx.time >= n). The return value is not length-checked (see CRYPTO-3).
- In an ecrecoverEvm dynamic loop on a stateless contract (`!statefulEvmKeccak`), K's width is not checked
  (GTT:14037-14041), and the address is `commitment[12:]` (14069-14072). A genuine batched K with width 2 or 3 yields a
  52- or 84-byte "address". `==` fails closed, but the value is non-canonical if it is stored or used as a key.

## Checked and sound

1. User external-library side-car loader (GTT:6825-6847): the blob is hash256-verified, then OP_DEFINEd and run in the
   consumer's own input, so the side-car's lock is irrelevant.
2. ecrecover dynamic-loop path (GTT:13942-13959, 14053-14059): the A, B and K locks are pinned by OP_UTXOBYTECODE to the
   baked shared P2SH32 locks and A's argBlob is bound. B's covenant links to A through OUTPUT[INPUTINDEX-1] =
   hash256(argBlob||shared||C), consistent with A = B-1 in every layout.
3. The keccak padding in the compute covenant (`51 7e 82 <136> 97 <136> 7c 94 <136> 97 00 7c 80 7e 82 51 94 7f 0180 85 7e`)
   appends 0x01, zero-fills to a multiple of 136, then ORs 0x80 into the last byte. That is correct pad10*1, giving 0x81
   when both land in one byte, with the Keccak (not SHA3) domain.
4. `keccak256(type(C).creationCode)` folds with the real keccak_256 at compile time (GTT:14237-14254).
5. The off-curve proof (GTT:14130-14148) checks w^2 == p - (r^3+7) mod p. This is sound: p = 3 mod 4, and r^3+7 != 0
   because secp256k1 has no 2-torsion.
6. emitRecoveryAccepted (GTT:14114-14125) requires v in [27,29) and r, s in [1,n) as unsigned values. This matches the
   EVM precompile, and r < n < p.
7. The locktime guard is on by default (compiler.ts:302, 16174-16176). It is injected wherever tx.locktime is read
   without a CLTV, or a CSV literal < 2^31, on the path. Fallback and receive are covered, and the CSV-literal criterion
   correctly implies a non-final nSequence.
8. Yul timestamp()/number() lower to the same oracle registers (LowerInlineAssembly.ts:1621-1622, compiler.ts:15549-15551).
   No raw OP_TXLOCKTIME is emitted anywhere else in solidc.
9. The (n->hash) oracle covenant (utils/state.ts:2205-2225) self-pins category and capability none, self-preserves on
   read, and can be wiped only after CLTV n+256.
10. The oracle update requires checkSig against the immutable owner key (SynthesizeBlockOracle.ts:364-369). The signature
    covers the written state outputs.
11. domain-separated-fingerprint.ts uses an injective length-prefixed encoding (u16 name, u32 value) and is off-chain.
12. bip68.ts bounds and flags are correct (off-chain). hash.ts wraps libauth primitives.

## Not reached

- Opcode-level decoding of the ~7.4 KB / ~3.3 KB recovery covenants and the ~2.4 KB keccak covenant: r/s/v range checks
  inside A, point at infinity, multi-block absorb and lane byte order. These do not matter until CRYPTO-1/2 are fixed,
  but are needed after.
- The SDK ecrecoverRecovery.ts witness generation and the ecrecoverComputeSidecar.ts split probing.
- Whether the master binds data-record contents beyond category plus tag. Settling this would confirm or refute CRYPTO-4.
- utils/hash.ts:28-46 `addressToGraphEmissionBytes` takes slice(3,23) for any lock >= 23 bytes, so an attacker's bare lock
  could collide with a victim's P2PKH identity. It is used by the SDK message-bus and SortedList; the on-chain counterpart
  was not traced (message-bus area).
- Framed (per-call) head constraints on side-car inputs. A grep of framed/master found no side-car lock pinning.
- Authentication of the message-bus blockhash row offset (`__internal__blockhashRowOffset`).
