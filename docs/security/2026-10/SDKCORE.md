<!-- cspell:ignore SDKCORE -->
# SDKCORE audit: solidcash SDK transaction building, signing, keys, providers

Tree: /Code/cashscript/.worktrees/per-call, branch feat/per-call, HEAD abbb7e0ec (unchanged during the audit).
Method: read-only code tracing. No tests, builds, compiles or probe scripts were run. All file:line refs are at HEAD.
Paths are relative to packages/solidcash/src unless stated otherwise.

## Findings

### SDKCORE-1: Composition pads a participant block with OP_TRUE outputs carrying the full value of the same-index input
- Severity: MEDIUM (SUSPECTED; HIGH if reachable on a live network). Outside the listed files (message-bus), so it needs confirmation by the message-bus auditor.
- Files: message-bus/compose-assemble.ts:1499-1505 (padding), :1664-1676 (trim), stateful/sc-allocate-create-builder-funders-accounting.ts:396-476 (live signer funders)
- Root cause: after a participant's local block is built, compose-assemble appends
  `{ to: OP_TRUE, amount: input.satoshis }` for every index where `local.outputs.length < local.inputs.length`.
  It does not check what that input is. The trim loop at :1664-1676 removes trailing pairs only when the input
  lock is BALANCED_DUMMY_FUNDER (P2SH32(OP_TRUE)), so a pair whose input is a real wallet coin survives.
  On a live provider (no `addUtxo`) with a connected Signer, the block-layout funders are the signer's whole
  plain P2PKH coins (sc-allocate :396-476: `selectedPlain`, with `fanOutPlainUtxos` if short). They are not dummy funders.
- Scenario: in a message-bus composition send on mainnet with a Signer, a wallet funder sits at a block index
  with no paired output (for example, the local builder emitted fewer outputs than inputs). The user signs a
  transaction that sends that coin's entire value to a bare OP_TRUE output, and any miner or bot can sweep it.
  I did not confirm whether the local builder can actually leave a wallet funder unpaired. `_padOutputsToIndex`
  (StatefulTransactionBuilder.ts:1229-1243) normally pairs funders with a pass-through to their own lock.
- Fix: pad only when the input lock is BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX. For any other input, either
  pass the value through to `input.unlocker.generateLockingBytecode()` (keeping the token), or throw.

### SDKCORE-2: User-funded anyone-can-spend (OP_TRUE) outputs by design: return events and structural pads
- Severity: LOW. Confidence: CODE-CONFIRMED.
- Files: loop-call.ts:158,203-207 (return events, `returnDust` default 1000n, caller-settable with no ceiling);
  stateful/StatefulTransactionBuilder.ts:1240 (pad, BALANCED_SLOT_SATOSHIS = 1000n, balancedBlocks.ts:31),
  :5026,:5031 (800n pads in evacuateReturnIndicesOffOpReturn); stateful/value-chunk-band-helpers.ts:42 (1000n);
  stateful/stb-reverse-suffix-value-chunks.ts:102,:307.
- Root cause: index-alignment pads and log/return-event NFTs are emitted to the bare lock `51` and funded from
  the user's funder or change. A bare OP_TRUE output needs only about 474 sat to clear dust, but these carry 800-1200 sat.
- Scenario: each such output can be swept by the miner or any mempool bot. The loss is bounded per output
  (the covenant caps events at 1200, see balancedBlocks.ts:34-45), but it repeats on every call. On the loop path,
  a caller who sets a large `returnDust` loses all of it, and nothing warns them.
- Fix: use the exact dust minimum for OP_TRUE pads. Cap `returnDust` at BALANCED_EVENT_SLOT_CEILING and warn above
  dust. Document that event and log outputs are donations.
- H4 check: H4 stays fixed. Change still defaults to the funder lock (loop-call.ts:162, :285).

### SDKCORE-3: Shared side-car UTXO selection accepts attacker-planted UTXOs (griefing DoS of auto co-spends)
- Severity: LOW (availability only, no fund loss). Confidence: the missing filter and the crash path are
  CODE-CONFIRMED. The claim that a planted UTXO is ordered first is SUSPECTED; it depends on the indexer.
- Files: TransactionBuilder.ts:262-275 (library side-car: `utxos[0]`, recreate drops any token),
  :291-301 (`addKeccakComputeCoSpend`: first free UTXO), keccak/keccakComputeSidecar.ts:113-117 (`sidecar.token!.category`
  dereference -> TypeError on a token-less UTXO), TransactionBuilder.ts:411-420 (ecrecover A/B: first free UTXO).
  Contrast: the loop paths filter `u.token?.nft?.capability === 'mutable'` (:477, :610, :684).
- Root cause: these side-cars live at public, deterministic P2SH32 locks (the shared salt is 32 zero bytes).
  Anyone can create a UTXO at those locks. send() auto-invokes these helpers (:1243-1252) and selects a candidate
  without checking its token shape.
- Scenario: an attacker sends a dust UTXO with no token (or with a foreign token) to the shared keccak, library
  or ecrecover side-car lock. If the indexer lists it first (Fulcrum generally orders confirmed UTXOs by height,
  so an old planted coin precedes the constantly recreated real one), every user's send() of a contract using that
  side-car fails: TypeError, token-burn refusal, or covenant reject. One dust UTXO is enough.
- Fix: filter candidates to the expected shape (a token of the expected category, capability 'mutable', or no
  token for the library side-car) and skip non-conforming ones. Try the next candidate instead of `utxos[0]`.

### SDKCORE-4: HDSigner exposes the BIP-39 mnemonic and the xprv node as public enumerable fields
- Severity: LOW. Confidence: CODE-CONFIRMED.
- Files: HDSigner.ts:32-43 (`readonly node`, `readonly mnemonic`), :99-101 (`connect()` carries the mnemonic);
  Signer.ts:39 (`readonly privateKey`).
- Root cause: this is the known "SignatureTemplate.privateKey is public" item, but here the field is the
  whole-wallet seed phrase, plus the chain code that derives every non-hardened descendant. Both are plain
  own-enumerable properties.
- Scenario: `console.log(signer)`, an error reporter or structured logger that serialises objects, or
  `JSON.stringify` of any object holding the signer (for example a connected StatefulContract's `_signer`)
  emits the mnemonic, which compromises every account in the wallet. The SDK itself does not log it (checked).
- Fix: keep `mnemonic`, `node` and `privateKey` in `#private` fields or non-enumerable properties. Add
  `toJSON()` and `[Symbol.for('nodejs.util.inspect.custom')]` that redact them. Expose an explicit getter if needed.

### SDKCORE-5: A numeric HD index of 2^31 or more silently derives a hardened child, and the recorded path mislabels it
- Severity: INFO. Confidence: CODE-CONFIRMED.
- Files: HDSigner.ts:82-85, :119-122, :173-176. libauth deriveHdPathRelative parses unhardened indices with
  `parseInt` and has no `< 2^31` check (node_modules/@bitauth/libauth/build/lib/key/hd-key.js:744-776).
  deriveHdPrivateNodeChild then treats index >= 0x80000000 as hardened (:603-604).
- Scenario: `deriveChild(2147483648 + k)` returns the same key as `deriveChild("k'")`, while `derivationPath`
  reads `.../2147483653`. Per-user indices can alias each other, and other tools that reject or interpret such
  paths differently will not reproduce the key. The keys stay under the user's control.
- Fix: for numeric input, require `Number.isInteger(i) && 0 <= i < 2**31`. Accept hardened indices only in `"n'"` form.

### SDKCORE-6: No secp256k1 scalar-range check: an invalid private key produces an unspendable "valid-looking" address
- Severity: INFO. Confidence: CODE-CONFIRMED.
- Files: Signer.ts:60-67, SignatureTemplate.ts:17-19, :40-42.
- Root cause: only the length (32 bytes) is validated. For a key of 0 or >= n, `secp256k1.derivePublicKeyCompressed`
  returns an error string. That string is cast to `Uint8Array` and hashed (`hash160`), so the result is a garbage
  P2PKH address with no corresponding key. Signing also casts error strings to bytes (SignatureTemplate.ts:82-84).
- Scenario: a placeholder or all-zero key yields an address. Funds sent to it are unrecoverable.
- Fix: throw when `typeof pub === 'string'`, as blockOracleUpdater.ts:241-243 already does, or validate the key
  with libauth's validatePrivateKey. Throw on string results from the sign calls as well.

### SDKCORE-7: The stateful and composition builders turn off the SDK NFT-conservation guard for the whole transaction
- Severity: INFO. Confidence: CODE-CONFIRMED (the risk is to callers that add their own NFT inputs).
- Files: stateful/stb-create-build-session-prelude.ts:77-89 (enabled whenever any of these is present: entry
  deletes, dynamic chunks, trailing disposals, loop entries, token-container NFT transfers, or external/low-level
  call groups), message-bus/compose-assemble.ts:255-257, stateful/sc-destroy.ts:91, sc-split-merge.ts:259,
  sc-split-merge-builders.ts:156, oracle/blockOracleUpdater.ts:225.
- Root cause: `allowImplicitNftBurn: true` applies to every input. The fungible check stays on
  (stb-converge-and-serialize-final-transaction.ts:76). Default funder selection excludes token UTXOs
  (sc-allocate ~:436-438), so no default path brings in a wallet NFT. Any user NFT-bearing P2PKH input added to
  such a call is protected only by the covenants, and covenants do not cover P2PKH-held NFTs.
- Fix: scope the allowance to the contract's own state or entry categories. Keep checkNftBurn active for every
  other category.

### SDKCORE-8: Mock and regtest behaviour is gated on a duck-typed `addUtxo`, and RegtestNetworkProvider never verifies its chain
- Severity: INFO (misconfiguration only). Confidence: CODE-CONFIRMED.
- Files: stateful/stb-measure-and-fund-covenant-fee.ts:107-121 (if `provider.addUtxo` exists: funds a
  P2SH32(OP_TRUE) fee funder and OVERWRITES `funderChangeAddress = DUMMY_LBC`, discarding a change address the user set);
  sc-allocate-create-builder-funders-accounting.ts:373-395, :507-527; sc-upgrade.ts:199-210;
  network/RegtestNetworkProvider.ts:36 (network fixed to REGTEST), :59-90 (defaults http://localhost:18443,
  user/password), :164-200 (funding addUtxo), :608-619 (initialize: no `getblockchaininfo.chain` check).
  RegtestNetworkProvider is exported from the package root (index.ts:28).
- Scenario: someone points RegtestNetworkProvider at a node with a real-value wallet (for example via
  REGTEST_RPC_URL), or wraps a production provider that exposes a funding `addUtxo`. Fee funders and change are then
  routed to anyone-can-spend P2SH32(OP_TRUE).
- Fix: in initialize(), assert `chain === 'regtest'`. Gate the mock paths on an explicit capability flag rather than
  on `addUtxo` presence. Never overwrite a funderChangeAddress the user set.

### SDKCORE-9: The crypto/signing dependency is a git branch, not a pinned version
- Severity: INFO (supply chain). Confidence: CODE-CONFIRMED.
- Files: packages/solidcash/package.json (`"@bitauth/libauth": "git+https://github.com/mainnet-pat/libauth.git#vm-performance-dist"`),
  also packages/utils/package.json:45 and packages/solidc/package.json:54. The repo yarn.lock:61-63 pins 1cf4b432...
- Scenario: consumers of the published package resolve whatever the branch head is when they install. A
  compromised or rewritten branch would control secp256k1 signing and hashing for every SDK user.
- Fix: pin a commit hash in package.json, or publish a versioned scoped npm package.

## Checked and sound
1. SignatureTemplate defaults to SIGHASH_ALL|SIGHASH_UTXOS with Schnorr. It validates the base type and unknown flags, rejects UTXOS+ANYONECANPAY, and adds the fork id (SignatureTemplate.ts:23,44-60; utils.ts:369-371).
2. Every SignatureTemplate the SDK constructs internally uses the default hash type (Signer.ts:65, stateful/upgrades.ts:112, oracle/blockOracleUpdater.ts:165).
3. Contract checkSig arguments are signed with each template's own sighashType over the per-input preimage (Contract.ts:811-823).
4. Signer.signMessage is domain-separated with the Bitcoin Signed Message magic prefix (Signer.ts:161-179). No SDK path signs raw attacker data.
5. H4 is still fixed: both loop builders default change to the funder's lock and never to OP_TRUE (loop-call.ts:162,285).
6. Base change helpers: negative BCH change throws, sub-dust change goes to fee, the change lock is always caller-specified, and token change carries dust BCH (TransactionBuilder.ts:890-948).
7. The base builder's burn options default to false. Fungible and NFT conservation are checked on every non-skip build, send and build() (TransactionBuilder.ts:148-152,1019-1084,1109-1112).
8. Outputs exceeding inputs are refused, and fee/byte is capped at 1000 in the base builder (TransactionBuilder.ts:993-1017). The stateful send applies the same cap plus the optional absolute cap (stb-validate-send-fee-caps-and-bytes.ts:71-86).
9. Token amounts are range-checked to 0..2^64-1 on inputs and outputs, which blocks modulo-wrap burns (utils.ts:76-78,105-107). Categories are lowercased for grouping.
10. Duplicate outpoints are refused on add (TransactionBuilder.ts:169-189).
11. send() compares the provider-returned txid with the local hash256, and getTxDetails hash-checks the fetched tx (TransactionBuilder.ts:1337-1345,1358-1364). The stateful split/merge paths do the same (sc-split-merge.ts:326-333).
12. Failure-path Bitauth URIs redact private keys (TransactionBuilder.ts:1232-1234,1333; debugging.ts:389-504,718; libauth-template/bitauth-uri.ts:20-27), and FailedTransactionError.bitauthUri is non-enumerable (Errors.ts:59; build target es2021, so subclass parameter properties do not redefine it). The known "keys on failed sends" item appears fixed.
13. The sighash serialization cache is keyed by fresh per-build transaction objects. I found no in-place mutation of a built transaction's outputs, outpoints or sequences (utils.ts:364-411; TransactionBuilder.ts:1119-1145).
14. The Electrum default transport is wss on port 50004 with certificate verification (@electrum-cash/web-socket default encrypted=true). Spreading token_data copies own properties only, so there is no prototype pollution.
15. A hostile provider lying about a UTXO's value, lock, token or commitment cannot cause signed loss under the default SIGHASH_UTXOS: the signature commits to the claimed source outputs, so the on-chain transaction is invalid.
16. Stateful change defaults to the signer's address or the first serialized funder's lock (StatefulContract.ts:3817; stb-place-send-change-and-sidecar.ts:45-46; stb-rebalance-funder-surplus.ts:34-35). Final token conservation is enforced (stb-converge-and-serialize-final-transaction.ts:76).
17. Upgrade change defaults to the funder's lock. With no funder on a live network, the send fails (outputs exceed inputs) rather than paying the covenant (stateful/sc-upgrade.ts:282-293).
18. The public Hardhat mnemonic is referenced only inside MockNetworkProvider. No production path falls back to it.
19. libauth's HD path parsing throws on malformed paths (throwErrors defaults to true), and public derivation of hardened indices errors.
20. Contracts default to the p2sh32 address type (Contract.ts:338).
21. tx-trace and the debug logs print only sizes and fees. Stateful console output is env-gated and contains no key material. The SDK does no file or storage writes.
22. gatherBchUtxos excludes token UTXOs (transaction-utils.ts:22-25).
23. generateWcTransactionObject runs build(), and so the burn and fee checks, before exporting (TransactionBuilder.ts:1374-1376). Placeholder signatures and keys are zero-filled.
24. There is no eval, new Function or dynamic import of untrusted input in src outside framed/. JSON.parse is used only on SDK-formatted strings.

## Not reached
- message-bus/* beyond the compose-assemble padding and burn-option spot checks behind SDKCORE-1 and SDKCORE-7.
- StatefulContract.ts and StatefulTransactionBuilder.ts beyond the requested greps (derivation probes, VM-trace auto-derived transfer outputs, placeholder lifecycle).
- network/createVirtualMachine.ts, createPreparedTxVerifier.ts and prepared-covenant-receipt.ts (mock verifier internals; only grepped). The RegtestNetworkProvider funding internals (refillFeeFunderPool/fundSignSend).
- Argument.ts encoding (address/string auto-conversion), and LibauthTemplate.ts beyond where it embeds keys.
- oracle/ beyond the keeper signing and sweep paths. The ecrecover/ and keccak/ side-car builders beyond their recreate outputs. wait.ts, debug-attribution.ts.
