<!-- cspell:ignore Ownr SDKCORE SDKFRAMED -->
# SolidCash security audit, October 2026

Branch `feat/per-call` (`.worktrees/per-call`), audited 2026-10-11. The audit started at `df51215d6`; a parity merge
moved HEAD to `abbb7e0ec` while it ran, and the auditors checked that the merge touches none of the cited paths. Line
numbers are at `abbb7e0ec` unless a detail file says otherwise. In `GenerateTargetTraversal.ts` (GTT below), lines
after about 21300 moved by about +57 between the two commits.

## Scope, method and limits

- **Scope:** the whole project. The compiler (`packages/solidc`), the SDK (`packages/solidcash`), `@solidcash/utils`,
  the testing and solidhat tooling, the VS Code extension, CI, packaging and the regtest stack. Both composition
  conventions: `direct` (the compiler default, with its message-bus kernel) and `framed`.
- **Method:** 13 independent read-only domain audits. Then a second, adversarial read of every CRITICAL and HIGH
  claim: four verifier passes that tried to find the check that blocks each attack, plus the coordinator's own
  checks against the code.
- **Limits:** nothing was executed. No test, compile or VM run backs any finding; this follows the project's agent
  test discipline. Every claim rests on reading the source and the opcodes it emits. The exceptions are DS-7,
  DS-8 and SEM-11, added after the audit: the `feat/parity` work found them and proved each with a hostile test on
  the mock network.
- **Status labels:**
  - CONFIRMED: traced by the domain auditor and re-traced independently (a verifier or the coordinator), with no
    blocking check found.
  - CODE-CONFIRMED: traced end to end by one auditor.
  - SUSPECTED: plausible; a VM test must decide.
  - VM-PROVEN (mock): a hostile test on the mock network accepted the attack before the fix.
  - Only DS-7, DS-8 and SEM-11 are VM-proven. Each other CRITICAL and HIGH row needs one hostile VM test, red
    before its fix and green after it. The verifier files name the test each row needs.
- **Threat model:** as in `SECURITY-AUDIT.md` (2026-07). On chain, the compiled Script is the only boundary: an
  attacker builds any transaction the BCH 2026 VM accepts and cannot sign for keys it does not hold. Since the May
  2026 upgrade (P2S), any locking bytecode up to 201 bytes is standard (`maximumStandardLockingBytecodeLength: 201`
  in libauth's `bch-2026-consensus.js`), so an attack that needs a bare lock such as `OP_2DROP OP_1` relays without a
  miner's help. Off chain, a user must not be led to sign something unintended, lose funds or leak keys, and a network
  provider may be hostile.
- **Detail:** each domain's write-up (root cause, attack transaction, suggested fix) and each verifier's verdicts are
  in `docs/security-audit-2026-10/`. Finding ids are prefixed by domain:

| Prefix | Domain | Detail file |
| --- | --- | --- |
| FV | framed validator program (`V_TEMPLATE`) | `FV.md` |
| FM | framed master head | `FM.md` |
| FW | framed frame body: segments, records, calls, events | `FW.md` |
| DS | direct convention: state covenants and sorted mappings | `DS.md` |
| DX | direct convention: calls, delegatecall, containers, events, lifecycle | `DX.md` |
| KB | message-bus kernel | `KB.md` |
| SEM | front-end semantics: modifiers, inheritance, dispatch, lowering | `SEM.md` |
| ARITH | arithmetic, casts, ABI, indexing | `ARITH.md` |
| CRYPTO | keccak256, ecrecover, blockhash and block oracles, time | `CRYPTO.md` |
| OPT | optimiser, outliner, encoders, env switches | `OPT.md` |
| SDKCORE | SDK transaction building, signing, keys, providers | `SDKCORE.md` |
| SDKFRAMED | framed SDK: deployment, proxies, calls, composer | `SDKFRAMED.md` |
| TOOLS | tooling, packaging, CI, supply chain | `TOOLS.md` |
| (verifiers) | second reads of the CRITICAL and HIGH rows | `VERIFY_*.md` |

## Verdict

96 findings: 15 CRITICAL, 14 HIGH, 20 MEDIUM, 29 LOW, 18 INFO. Every CRITICAL row and all HIGH rows but two
(SDKFRAMED-1, SDKFRAMED-2) were re-read by a second auditor or the coordinator. None was refuted outright: two HIGH
rows were narrowed to MEDIUM (ARITH-2, SEM-2) and two rows rose to CRITICAL (DX-6, KB-2). DS-7, DS-8 and
SEM-11 were added after the audit, from the `feat/parity` work; the audit's passes had missed all three.

Both conventions have holes that an unprivileged attacker can use. Neither should hold value on a real chain until
the CRITICAL rows are fixed and each is pinned by a hostile VM test.

- **`direct` (the default):**
  - Any public call drains a contract's satoshi and token containers (DX-1, DX-2).
  - A sorted-mapping write can be skipped or replaced by the spender; `approve` alone forges any allowance (DS-1).
  - When a function writes a mapping and reads it in a branch the call skips, a stray own-category NFT stands in
    for a node, so another node of that mapping can be rewritten (DS-7, VM-proven on the mock network).
  - A batch proof may name a read slot's input, so the census counts it twice and a record can leave the
    collection (DS-8, VM-proven on the mock network).
  - A public function with a function-typed parameter can be handed the id of any function of the contract,
    internal ones included, and invokes it (SEM-11, VM-proven on the mock network).
  - One integer mapping key has many encodings, so a claim-once guard can be passed repeatedly (DS-4).
  - Un-accessed records can be destroyed or forged, and a forged data record passes as the real one, which gives an
    owner takeover (DS-2, DS-3, DS-5).
  - Default (message-bus enabled) builds skip the C3 census, so un-accessed records are destroyable again (DX-6).
  - The message-bus route can be bound to an attacker's digest (KB-1).
  - Under `evmCompat`, a crafted lock presents another address's 20-byte identity (KB-2).
  - keccak256 and ecrecover results can be chosen by the attacker (CRYPTO-1, CRYPTO-2).
- **`framed`:**
  - A master accepts a fake validator, so composed frames go unchecked (FM-1).
  - Under the genuine validator, a record can be reset to zeros or rewritten unchecked (FW-1, FW-2).
  - `V_TEMPLATE` is not frozen yet (no real-chain deployment), so the validator fixes cost no address migration now.
    After the freeze a validator defect is permanent (spec section 9).
- **README:** its caveat (direct `msg.sender` is not authenticated) understates the direct convention's exposure. The
  container, mapping and side-car holes need no `msg.sender` at all.

## Root causes

Most CRITICAL and HIGH rows fall into five classes. A fix should close the class, not only the instance.

| Class | Pattern | Rows |
| --- | --- | --- |
| A. Unbound co-spent input | A check reads another input's unlocking bytecode or token, or finds an output by search, without binding that input's locking bytecode or its own output index. A look-alike at a bare lock satisfies it. | FM-1, CRYPTO-1, CRYPTO-2, CRYPTO-3, DX-5, KB-1, DS-2, DS-7 |
| B. Presence-only satellites | A container, record or oracle UTXO authorizes any spend when a minting NFT of the category is co-spent, and the master accounts only for the satellites its own function touches. | DX-1, DX-2, DS-3, DX-6, DX-8, DX-7, CRYPTO-4 |
| C. Spender-chosen switches | A witness value the spender chooses (a sentinel, an index, an exemption) turns a check off, and nothing binds it on that path. | DS-1, DS-6, DX-4, FW-1, FW-2, KB-3, DX-3, SEM-11, DS-8 |
| D. Non-canonical bytes | Bytes that are hashed or compared admit several encodings of one value, or one encoding of several values. | DS-4, FV-1, FW-1 (zero-padded views), KB-2, ARITH-2, ARITH-3, ARITH-4, ARITH-6 |
| E. 2026-07 fixes regressed or bypassed | A fix from the last audit does not cover a path added since. | DS-3 and DX-6 (C3), DS-5 (C2), DS-2 (H1), DX-4 (H2), SEM-4 (H7), SEM-5 (H8) |

## Findings

### CRITICAL (15)

| Id | Status | Finding | Where |
| --- | --- | --- | --- |
| FM-1 | CONFIRMED | A framed master accepts a fake validator. The N1 recognizer checks the named input's token and its two unlocking pushes `<M> <R>` (a mutable NFT of some category `c`, `R[1:34] == c||01`, `sha256(R[34:]) == H_V`) but never that input's locking bytecode, nor that `R[0]` is `0x21`. A mutable NFT at the bare lock `OP_2DROP OP_1`, unlocked with `<M> <0x21||c||01||V_TEMPLATE>`, passes; no V-check runs. A CALL frame then carries any `msg.sender`, `tx.origin` and call results, and a lone master self-settles them (token theft, owner takeover). A DELEGATE frame, or two masters, leaves the records settled by nobody. Fix: require `R[0] == 0x21` and `OP_UTXOBYTECODE(validatorRef) == OP_HASH256 <HASH256(R)> OP_EQUAL`. | `framed/master/frame-tail.ts:794-819`, `master-head.ts:860-883` |
| FW-1 | CONFIRMED | A record declared "at its output alone" (`in = 0xffff`) may name the index of a record the transaction spends. Under validator settlement that record's chain starts from "nothing", which equals an all-zero view after padding, so its real input commitment is never compared. A later frame reads the data record as zeros and re-runs `initialize()` (owner takeover). Needs only two masters of the contract (12 per contract by default) through permissionless ROOT frames, or a proxied frame; works against the genuine validator. Mechanism: FV-1 key merge plus zero-padded view compares. | `framed/master/declared-view.ts:619-625`; `framed/validator/program.ts:2363-2380, 3164-3170, 3187-3198` |
| FW-2 | CONFIRMED | In the segment that writes data record D, any declaration whose input or output index equals D's is exempt from the kept walk (OR, not AND). A trailing delete `{in: D, out: 0xffff}` makes the chain end in a delete, and the census only needs output D declared somewhere, so output D's commitment is compared with nothing: the attacker writes arbitrary persistent state. The SDK's `checks.ts` and reference model accept the same shape. | `declared-view.ts:609-615`; GTT:29476-29497; `program.ts:2337-2351, 1951-1990` |
| DX-1 | CONFIRMED | Satoshi containers are drained beside any master spend. The container's master path only checks that a minting NFT of the category sits at a witness index; the master accounts for one container, at its slot, and only when the function makes a non-zero transfer. The code comment that "the container is not co-spent here" is an SDK assumption, not a chain rule. Any permissionless function (an ERC-20 transfer, a setter, `pay(0)`) lets an attacker co-spend every container and keep the BCH. `msg.value` and `address(this).balance` can also be inflated within one transaction. | `packages/utils/src/state.ts:2378-2392`; GTT:46175-46233 (`emitValuePreservation`), 3227, 11989 |
| DX-2 | CONFIRMED | Token containers are drained the same way. A function without `tokens[...]` access checks no container; one with access checks only its slot, and a tokenless input at the slot skips identity and preservation. | `state.ts:2276-2292`; GTT:9533-9543, 47700-48080 |
| DX-6 | CONFIRMED | Regression of C3 on the default build. The direct collection/data-NFT census and the strict count are emitted only when the message bus is explicitly disabled (`__messageBusExplicitlyDisabled`), which is false for the default `auto` build and for `messageBus: true`; the C3 loop itself skips entry, container, dynamic and deploy functions. Direct entries of every bus-enabled build therefore leave un-accessed entry and data NFTs destroyable or rewritable (their covenants self-authorize on any master co-spend). | GTT:45993, 9519-9526; `compiler.ts:1141-1170, 2593, 4272-4285`; `state.ts:133-200, 1894-1916` |
| DS-1 | CONFIRMED | Any single-target sorted-mapping write can be skipped with the witness `predOut = -2`, the "inactive route row" sentinel. The binding that refuses `-2` exists only for slots with alias priors (message-bus routes); the write and its transition check are skipped, while the output count still admits one node output that nothing checks, and the proof may name any node. Triggers include ERC-20 `approve` (forge any allowance), the allowance decrement in `transferFrom`, WETH `deposit`, claim-once mappings, ERC-721 owners. (The two-key linear `balances` batch does refuse `-2`.) | GTT:29205-29245 (binding loop `continue`s), 26388-26399, 26563-26575, 30176-30200, 30592-30608; `SymbolTableTraversal.ts:3955-3976` |
| DS-2 | CONFIRMED | Direct data-NFT reads trust any own-category mutable NFT at the master's offset: they check only the category base, not the lock (the lock pin exists only on the framed path). With DS-3, step 1 mints a forged record (`owner = attacker`) to the attacker's own lock; step 2 presents it as the data record and passes `onlyOwner`. A fully written data NFT also skips the H1 nftIndex tag check. | GTT:31370-31381 (`emitTokenCategoryVerification`), 37527-37600, 38146-38196 |
| DS-3 | CONFIRMED | Regression of C3. Functions with entry access, token containers, dynamic writes or deploys get only a census that counts sorted collection addresses and the data-NFT lock. Dynamic-variable chunks (`string`, `bytes`), array entries and value chunks can be destroyed or forged by a plain `transfer`, and own-category mutable NFTs can be minted at any other lock. | GTT:9519-9526, 45990-46048, 38960-38995 |
| DS-4 | CONFIRMED | Integer mapping keys are hashed from the raw parameter bytes. The `uintN` entry check runs `OP_NUM2BIN` on a copy, which accepts non-minimal numbers (libauth `requireMinimalEncoding: false`), and plain `int` has no check, so `5`, `0x0500`, `0x050000`... land in different slots: a claim-once or nonce guard passes once per padding. Signed `intN` is safe (its check's `OP_ADD` rejects non-minimal input). Reported independently as ARITH-1. | GTT:9858-9862 (`emitIntBoundsCheck`), 25583-25660 (`emitSortedKeyHash`, `emitMappingKeyIdentity`) |
| DS-5 | CONFIRMED | Regression of C2 for array collections: `sorted = true` is set only for mappings, so native `T[N]`, bounded array fields of flattened structs, non-chunk-packable elements and `chunkedArrays: false` keep the old backend. An omitted entry reads as the default, the input's lock is never compared with the collection address, and writes mint duplicates. (Solidity-import `uint[N]` and `T[]` are packed or chunk-packed instead.) | `compiler.ts:14523, 15571, 19524`; GTT:25923-25990 |
| KB-1 | CONFIRMED | The bound message-bus route takes the LAST output carrying the verifier's lock and category as the verifier output, not the output at the verifier's own input index. The genuine verifier pins only its own index, so the attacker mints one extra mutable NFT of the contract's category at the verifier lock (the master's minting NFT is in the transaction and nothing counts the clone on bus routes) with any binding digest. The route then runs with attacker-chosen graph callers (forged `msg.sender`), batch, emissions and settlement table. A regression: the inlined verifier was fixed in `1fc064596`, the bound route was not. | `compiler.ts:11974-11988`; `packages/utils/src/message-bus-verifier.ts:165-205` |
| KB-2 | CONFIRMED | Under `evmCompat` the 20-byte address identity is not injective: `compileAddressToEvmIdentity` maps any lock whose length is not 0, 20, 23, 32 or 35 bytes to its bytes 3..23 with no template check, and a 32-byte value to its last 20 bytes with no zero-prefix check. It feeds address `==`/`!=` (so `msg.sender == owner` compares projections), address mapping keys, `uint160`/`bytes20` casts and graph argument binding. A crafted lock (a 71-byte bare 1-of-2 multisig whose first key starts with the victim's HASH160 is standard under P2S) presents the victim's identity. Wider than first reported. | `generation/utils.ts:24-52, 222-234`; GTT:16340-16356, 21816-21828, 25582-25603, 46854-46900 |
| CRYPTO-1 | CONFIRMED | keccak256 results can be forged. The side-car check reads the side-car's unlocking bytecode, extracts its redeem push and compares the hash of the covenant bytes with a constant, but never compares the input's locking bytecode with P2SH32 of that redeem; the digest is then read from an output commitment. A coin at a bare lock replaying the genuine unlocking layout, plus a freshly minted NFT carrying any digest, passes. Breaks hash locks, Merkle proofs, commit-reveal and keccak-derived mapping keys. Applies under `framed` too. | GTT:13665-13721 |
| CRYPTO-2 | CONFIRMED | ecrecover returns an attacker-chosen signer on the non-loop path, for every variant: side-cars A, B and the keccak side-car are taken from their unlocking bytes without a lock binding, and the pubkey and address are read from outputs. `ecrecover(...) == owner` passes for any signature. Only the dynamic-loop path binds the locks; framed bodies refuse ecrecover loops, so framed compiles always get the unbound path. | GTT:13961-13999, 14017-14068 (bound loop path: 13948, 13957, 14057) |

### HIGH (14)

| Id | Status | Finding | Where |
| --- | --- | --- | --- |
| DS-6 | CONFIRMED | When every write of a function sits in branches and one is a delete inside an if/else (or a lone `if (c) delete m[k]`), a value the spender chooses switches off the whole sorted-batch transition check, so every collection the function batches can be minted into, destroyed or rewritten. | GTT:29044-29081; `emitConditionalDeleteVerification` |
| DS-7 | VM-PROVEN (mock) | Added after the audit. When a function batch-writes a sorted mapping and reads the same mapping only in a branch the call skips, the batch census counts that read slot as a node whenever its fixed input carries a non-empty commitment. The skipped read never pins that input's lock, and the slot's category check asks only for an own-category mutable NFT, so a stray one at any other lock (DS-3 mints them) raises the expected input and output counts by one. One real node then rides outside every per-position check, and nothing but the count checks its output: the mock test rewrote `m[9]` from 60 to 61 in a call that wrote only `m[7]`. Fixed on `feat/parity` by `6e292ca1f` (merged as `4b8850496`, test `packages/solidcash/test/e2e/BatchCensusReadSlots.test.ts`): the slot counts only when its input's `OP_UTXOBYTECODE` is the entry address. Not yet on `feat/per-call`. | Lines at `25e887d0a`: GTT:30671-30680, 30720-30729 (`emitSlotExistsCheck` in the census), 30607-30612 (such functions skip `directSmallCensus`), 30745-30746 (the count is by lock), 31653 (`emitEntryCategoryVerification`), 45713 (`emitEntryPreservationBody`) |
| DS-8 | VM-PROVEN (mock) | Added after the audit. A batch target's proof index is a spender-chosen offset, and it may name the input of a pure-read slot of the same mapping, which the census already counts as a node. That input is then counted twice, leaving room for one node that no per-position check covers. The mock test showed a record leaving the collection and the updated key duplicated. Reported as pre-existing; this audit has not re-read it on `feat/per-call`. Fixed on `feat/parity` by `228ea4a5e` (merged as `cc52f07e8`, test `packages/solidcash/test/e2e/BatchProofReadSlotOverlap.test.ts`): direct functions check every batch target's proof index against every read slot's input. Message-bus routes are not covered by that guard. | `emitSortedBatchTransitionVerification`: `proofIndex` (GTT:30106-30110 at `25e887d0a`) and the census loops cited for DS-7 |
| DX-4 | CONFIRMED | Forged external-call return values (new variant of H2): the callee's `_returnOutputIdx` witness may be `-1`, the caller never binds it, so the callee pins no return carrier and an attacker-minted OP_TRUE carrier satisfies the caller's single-return uniqueness count. Slots without an address identity get no uniqueness check at all. | GTT:42985, 42994-43194; `SymbolTableTraversal.ts:4798` |
| DX-5 | CONFIRMED | A non-`evmCompat` low-level `call`/`staticcall` never pins its target: it compares the calldata with the first push of the unlocking bytecode at a spender-chosen input and never reads that input's lock, and `success` is hard-coded true. A bare-lock coin satisfies it, so `token.call(payload); credit(...)` credits a call that never ran. Under `evmCompat` with an empty payload only a non-empty unlocking is required. | GTT:24777-24868 (`emitLowLevelCallVerification`), 25212-25235 |
| DX-8 | CONFIRMED (impact conditional) | A delegatecall co-spends the implementation's master but conserves none of the implementation's own records: its data NFTs can be rewritten or destroyed and new ones minted. HIGH when the implementation exposes a standalone function gated on its own state (an owner-gated upgrade, selfdestruct or sweep): rewrite its owner, then destroy the implementation master, which bricks every proxy that pins it. MEDIUM otherwise (the SDK leaves the implementation's own state unused). | GTT:9519, 44186-44345, 44770-44771; `state.ts:133-180` |
| KB-3 | CONFIRMED | A routed callee's execution is bound to the manifest only if its own route runs its verifier; a non-graph bound route skips the verifier when the active verifier index is negative, and no other participant checks it, so a caller trusts a manifest result the callee never produced. | `compiler.ts:13307, 12466-12481, 13020-13030` |
| SEM-1 | CONFIRMED | The final-require safety net passes a function whose only `require` follows an early `return`: `hasPriorUnconditionalRequire` accepts a require anywhere in the list. `if (amount == 0) return; require(checkSig(s, owner));` lets anyone spend a stateless contract's UTXO. | `EnsureFinalRequireTraversal.ts:303, 382-393`; `ConfineReturns.ts:123-125` |
| SEM-11 | VM-PROVEN (mock) | Added after the audit. A function-type parameter of a public function that receives a self-ref (`this.f`) at any internal call site is kept as an integer function id instead of the `(address, selector)` pair Solidity uses, and the call through it is `<args> <id> OP_INVOKE` with no check on the id. Every function, private ones and compiler helpers included, has an id in the same table, so a caller can run bodies Solidity never exposes. (An internal function type in a public signature is refused, as in solc.) The mock test ran a private helper on caller-chosen arguments, directly and through an id stored in state. Fixed on `feat/parity` by `3df64a824` (merged as `e5e3013f5`, test `packages/solidcash/test/FnPtrEntryIdValidation.test.ts`): entry points check every function-typed parameter against the contract's matching public and external targets. `707df2835` (merged as `e501c8513`) applies the same check to ids from `abi.decode` and from external-call returns (the latter tested at compile level only), and `11b716f9f` to struct fields entering public functions. Not yet on `feat/per-call`. | Lines at `25e887d0a`: `LowerForeignFunctionPointerParams.ts:41-43, 110-116`; GTT:15600-15619, 15623-15644; `SymbolTableTraversal.ts:2026-2030` |
| CRYPTO-3 | CONFIRMED | `blockhash(n)` can be forged: the oracle input index is a caller parameter and the read checks only the category base (capability dropped) and that the commitment starts with `n`; no lock or length check. In a contract without events any caller can even mint the fake through the co-spent master, because the immutable-output guard is emitted only for contracts with events and exempts OP_1 locks. CRITICAL for a contract that pays out on a blockhash. Direct/kernel only (framed refuses blockhash). | GTT:14207-14228, 31351-31366, 9710-9713, 44874-44879; `SymbolTableTraversal.ts:3810-3817` |
| CRYPTO-4 | CONFIRMED | By design the block-oracle keeper holds a second minting NFT of the contract's own category, and the data-NFT write, destroy and entry write paths only require some minting NFT of that category at a witnessed index. The keeper can rewrite or burn any data record or mapping entry without the master running, or mint forged records and a duplicate master (a keeper-to-owner escalation). | `docs/block-and-transaction-properties.md:316-319`; `packages/solidcash/src/oracle/blockOracleUpdater.ts:176-198`; `state.ts:192-256, 1910-1917` |
| TOOLS-1 | CONFIRMED | The published `solidc`, `solidcash`, `@solidcash/utils` and `@solidcash/testing` depend on libauth through `git+https://github.com/mainnet-pat/libauth.git#vm-performance-dist`, a mutable branch of a personal fork; libauth does key generation, signing and VM evaluation. The monorepo's `yarn.lock` pins `1cf4b432`, but consumers resolve the branch head at install. Reported independently as SDKCORE-9. | `packages/{solidc,solidcash,utils,testing}/package.json`; `yarn.lock:61-63` |
| SDKFRAMED-1 | CODE-CONFIRMED | A contract's category is the txid of a provider-reported coin, and nothing checks that the coin is an output at the signer's own lock. A hostile provider lists an attacker-owned outpoint once, fakes the broadcast, and the attacker then creates that category with its own state (owner, minting NFT); every later provider serves the attacker's real contract. Covers plain deploys, the proxy's baked implementation address and predicted CREATE addresses. One `getRawTransaction` check closes it. | `stateful/ContractFactory.ts:96-107, 171-175`; `framed/deploy/stateful.ts:69-76`; `framed/proxy/deploy.ts:1049-1053`; `framed/deploy/create-lookahead.ts:131-165` |
| SDKFRAMED-2 | CODE-CONFIRMED | F11 reopened and widened on the framed path: `initialize` is a separate third transaction planned only after both geneses are broadcast, so the race window is the whole derivation, and any refusal after the geneses leaves an uninitialized proxy on chain. | `framed/proxy/deploy.ts:1098-1110, 1131-1272`; `stateful/upgrades.ts:812-816` |

### MEDIUM (20)

| Id | Status | Finding | Where |
| --- | --- | --- | --- |
| FV-1 | CONFIRMED (as FW-1's mechanism) | The validator keys record chains `index||index` with no in/out namespace, while `checks.ts` and the reference model keep `in:i` and `out:i` apart; a created record at output i and a kept record at input i merge. The kept-first ordering on its own is unresolved. Fix: a one-byte namespace in the key. | `program.ts:3187-3198`; `checks.ts:380`; `reference.ts:434-436` |
| SEM-2 | CONFIRMED (path; cycle trigger refuted) | A child contract a parent deploys (`new B()`) is embedded from a reduced pipeline that never runs `expandModifiers` when B's standalone compile throws (a bare `catch`): any modifier error in B (an undefined name such as `onlyOwnr`, a wrong arity) makes the parent compile with no warning and embed a child with no guard. Not attacker-triggered, but a typo silently removes the child's access control. (Mutual creation fails closed earlier.) | `compiler.ts:19664-19685` (catch :19681), 19468-19549; `ModifierExpansionTransformation.ts:359-538` |
| ARITH-2 | CONFIRMED (narrowed) | Struct entry parameters are never validated, a struct's last `bytesN` field decodes to the whole remainder, and the `bytesN` state encoder prefixes `<N>` with no size check, so `root = c.root` into a `bytes32` field that is not last in its record lets the caller write the following field (for example `owner`). HIGH where that shape occurs. (The originally reported struct-state and wrong-length `bytesN` parameter variants are refuted: struct state is laid out last, and `bytesN` parameters are size-checked at entry.) | GTT:22021-22025, 21624-21631, 31566-31591; `SymbolTableTraversal.ts:1858-1872` |
| FW-3 | CODE-CONFIRMED | A conditional emit is gated on whether its payload is truthy, not present: a reached `emit E(0)` / `emit E(false)` is closed as skipped, so the event is lost and its output goes unchecked. | GTT:41184-41192, 41366-41368, 41431-41436 |
| DX-3 | CODE-CONFIRMED | The own-category immutable-NFT pin exempts every commitment that starts with `SCID`, and real event encodings can start with those bytes, so forged logs pass the pin and the SDK's event reader. | GTT:44842-44857; `StateReader.ts:349-372` |
| DX-7 | CODE-CONFIRMED | A CREATE genesis counts only the child's minting and mutable outputs, so whoever triggers a public factory can mint forged child events and a stash of the child's own fungible tokens. | GTT:40012-40016, 40352, 40375 |
| SEM-3 | CODE-CONFIRMED | `break`/`continue` inside `unchecked {}` or inside a for-of collection loop is never lowered and emits nothing: budget-cap breaks and skip-continues are dropped silently. | `BreakContinueTransformation.ts:75-137, 291-446, 527-547` |
| SEM-4 | CODE-CONFIRMED | New variant of H7: a by-value state-variable argument is aliased even when a nested helper mutates it. | `InlineStoragePointerCalls.ts:813-818, 891-892` |
| ARITH-3 | CONFIRMED | `bytesN(bytes)` from dynamic bytes is a no-op (neither truncates nor pads), so `bytes4(data) != SELECTOR` is always true for longer data: a selector deny-list is bypassed. | `generation/utils.ts:188-193` |
| ARITH-4 | CODE-CONFIRMED | `evmCompat` `abi.decode` with an all-static schema gives the last field the whole remainder with no length check: values exceed their type's range and one tuple has many encodings. | GTT:20799-20811, 20910-20941 |
| ARITH-5 | CODE-CONFIRMED | On `evmCompat` split facets, BoringMath-style `to128`/`to64`/`to32` are lowered to a truncating cast, so their overflow require is gone; the add/sub/mul lowering also wraps when the call site sits in `unchecked`. | `MarkLegacyCheckedMath.ts:36-94`; GTT:3450, 14276-14288 |
| ARITH-6 | CODE-CONFIRMED | Native `abi.decode` and struct reads give a last-field `bytesN`/pubkey the whole remainder with no length check; native enum decode has no range check. | GTT:22008-22030, 22092-22104, 22259-22263 |
| CRYPTO-5 | CODE-CONFIRMED | The oracle owner's "no block height above the chain" bound can be bypassed with a time-type locktime, and the height can be rewound (no monotonicity check). | `SynthesizeBlockOracle.ts:371-377`; `generation/utils.ts:69` |
| OPT-1 | SUSPECTED | Top-level constant pooling can merge a framed master's deploy-time placeholder slot with a byte-identical constant push; the deploy fill then rewrites every merged site (bricking a path or the master). | GTT:3579, 3595-3629; `outline.ts:1256-1286`; `master-program.ts:53-98` |
| SDKCORE-1 | SUSPECTED (HIGH if a test confirms it) | Message-bus composition pads a participant block with `{to: OP_TRUE, amount: input.satoshis}` for any input without a paired output, and the trim keeps real coins. Transfer slots and blocks with trailing capacity are blocked; a block with no trailing capacity ending in an empty return-event or event slot that holds a wallet P2PKH coin is not, so that coin's whole value would go to OP_TRUE on a live network. | `message-bus/compose-assemble.ts:1499-1505, 1664-1676`; `stateful/sc-allocate-create-builder-funders-accounting.ts:371-476` |
| SDKFRAMED-3 | CODE-CONFIRMED | Framed calls pay fees with the largest tokenless coin, which can be a coin reserved for a predicted CREATE address; spending it kills that address for good. | `framed/call/handle.ts:264-267`; `stateful/upgrades.ts:841-843` |
| SDKFRAMED-4 | SUSPECTED | Placeholder record commitments or sentinel sends can be signed once a plan is marked settled; only the hop calls `requireLearnedViews`, and broadcast is gated on VM acceptance alone. | `framed/call/call.ts:2149-2186, 2286`; `proxy/hop-value.ts:198-233` |
| TOOLS-2 | CODE-CONFIRMED | The regtest compose publishes node RPC (`rpcallowip=0.0.0.0/0`, fixed user/password), Electrum, ZMQ and an explorer with `BTCEXP_RPC_ALLOWALL` on all host interfaces; fulcrum is on `:latest`. | `docker-compose.regtest.yml:9-17, 28, 41-42, 92-96` |
| TOOLS-3 | CODE-CONFIRMED | `emit().withArgs()` never checks an address argument when the expected value is a CashAddress (the `:` case is skipped), skips missing args, and passes a mined transaction with no decoded events. | `packages/testing/src/chai.ts:489-496, 549-558` |
| TOOLS-4 | CODE-CONFIRMED | `.reverted` passes on any thrown error, including SDK build, derivation or funding failures; `rejectedWith` passes when the contract source merely declares the reason. Security tests built on them can pass without the contract refusing anything. | `chai.ts:818-821, 953-962`; `packages/solidcash/src/test/TestExtensions.ts:243-255` |

### LOW (29)

| Id | Finding | Where |
| --- | --- | --- |
| FW-4 | A raw one-byte call argument `0x00` or `0x80` fails the VM's minimal-number check, so such a call can never be made. | `framed/master/argument-push.ts:66-74` |
| DX-9 | The rule that upgrade/deploy/split/merge carry a trusted signature is off in message-bus builds; `checkDataSig` counts as authorization though it binds no transaction; the sighash-ALL fence covers only `upgrade`. | `compiler.ts:16167-16170`; `SymbolTableTraversal.ts:18468`; GTT:14337 |
| SEM-5 | New variant of H8: the expression inliner resolves a callee by name only, so a guarded same-arity overload can be replaced by an unguarded one's return expression. | `InlineStoragePointerCalls.ts:368-375, 523-534`; `InlineMappingReturnFunctions.ts:53-60` |
| SEM-6 | A `tx.time` check anywhere in a block, even after an early return, suppresses the locktime guard for an earlier `tx.locktime` read. | `InjectLocktimeGuardTraversal.ts:46-57` |
| SEM-7 | (suspected) Split facets match plans and routes by function name, so a same-name internal overload of a moved entry becomes a public delegate. | `compiler.ts:19268-19275, 19321` |
| ARITH-7 | The framed slice `arr[s:e]` never checks `e <= length`; phantom elements read as defaults and array params can claim more elements than they carry. | GTT:16155-16185, 22296 |
| ARITH-8 | An int-to-enum cast inside `unchecked` skips the enum range check. | GTT:13490-13491 |
| ARITH-9 | `evmCompat` signed-to-bytesN casts use sign-magnitude, so `int256(bytes32(0xff..ff))` is not -1. | `generation/utils.ts:125-136` |
| ARITH-10 | Checked-mode `<<` and `evmCompat` signed narrowing revert where Solidity truncates (availability only). | GTT:16441-16454; `generation/utils.ts:118-123` |
| ARITH-11 | (suspected) Yul `add`/`sub`/`mul` do not wrap mod 2^256: typed operands revert, a literal operand leaves the result unbounded. | `LowerInlineAssembly.ts:1599-1603, 2094-2104, 2171-2179` |
| ARITH-12 | `msg.value` and `.length` are typed `bigint`, so `uint - msg.value` does not revert on underflow unless assigned to a bounded variable. | `TypeCheckTraversal.ts:2932-2937, 2980-2981` |
| CRYPTO-6 | `block.timestamp` is a register only the owner writes, with no bound or freshness check and no compiler warning; deadline checks run against stale values. | `SynthesizeBlockOracle.ts:239-247, 361-383` |
| OPT-2 | Several bytecode-changing switches (`SOLIDC_DEBUG_STREAM_PICK_OFFSET`, `SOLIDC_ROUTE_ABI_TAIL=0`, `SOLIDC_ROW_*`) are read straight from `process.env`, bypass the env registry and are not in the compile-cache key, so a debug compile can be served to a later normal compile. | GTT:6173, 7229, 24342-24463; `compiler.ts:1376-1410, 11400`; `solidc-env-registry.ts` |
| OPT-4 | The helper-id pool does not reserve ids a registrar library defines at run time (availability only). | GTT:4706-4726; `keccak-library.ts:3-4` |
| SDKCORE-2 | By design the SDK funds anyone-can-spend OP_TRUE outputs (return events, `returnDust` default 1000 with no cap, structural pads). | `loop-call.ts:158, 203-207`; `StatefulTransactionBuilder.ts:1240, 5026, 5031` |
| SDKCORE-3 | Shared library, keccak and ecrecover side-car UTXOs are picked without checking their token shape: anyone can plant a UTXO at the public side-car lock and break `send()` for every user of those contracts. | `TransactionBuilder.ts:269, 294, 418`; `keccak/keccakComputeSidecar.ts:115` |
| SDKCORE-4 | `HDSigner` keeps the mnemonic and xprv node as public enumerable fields; logging or serializing a signer leaks the seed. | `HDSigner.ts:32-43, 99-101` |
| SDKFRAMED-5 | The low-level call, hop and resize APIs sign with whatever hash type the template carries (defaults are ALL with UTXOS). | `framed/call/call.ts:195, 2463`; `proxy/deploy.ts:138, 4844`; `deploy/resize.ts:41, 64-65` |
| SDKFRAMED-6 | `compose()` broadcasts although it reads as a preview, and the thenable call object sends when awaited. | `framed/call/handle.ts:133-153, 227-235` |
| SDKFRAMED-7 | With a non-P2PKH funder the constructor's `msg.sender` silently becomes an unspendable P2PKH, so an owner set there is lost. | `deploy/stateful.ts:90-91`; `deploy/genesis.ts:246-248, 1263` |
| SDKFRAMED-8 | `Signer.getNonce()` (a read in ethers) can sign and broadcast up to 4 consolidation transactions. | `Signer.ts:108-122`; `ContractFactory.ts:111-127` |
| SDKFRAMED-9 | A framed merge disables the NFT-burn guard for the whole transaction and is sent with no VM check. | `deploy/resize.ts:139-158` |
| TOOLS-5 | Chai-shim properties `.empty`, `.NaN`, `.finite` and similar assert nothing. | `chai.ts:633-770` |
| TOOLS-6 | An `electrum` network with an unknown name (for example "testnet") silently goes to mainnet. | `packages/testing/src/hre.ts:62-64, 72` |
| TOOLS-7 | (suspected) One mnemonic signs on every network, and BCH signatures carry no chain id, so a hostile chipnet server could obtain a mainnet-valid signature. | `packages/solidhat/src/init.ts:72`; `hre.ts:557` |
| TOOLS-8 | `solidcash init --from-hardhat` writes the resolved mnemonic (possibly from the environment) as plaintext into `solidcash.config.ts`. | `packages/testing/src/config.ts:269` |
| TOOLS-9 | Config discovery walks up to `/` and runs the first config file found (for example in `/tmp` on a shared host). | `config.ts:173-198, 242-246` |
| TOOLS-10 | Compile trusts cache entries in the project's `cache/solidcash`, so a cloned repository can ship poisoned artifacts. | `packages/testing/src/builtin-tasks.ts:214-216`; `compiler.ts:1561-1570` |
| TOOLS-11 | CI actions are pinned by tag, not SHA; no `permissions:` block; checkout credentials and `CODECOV_TOKEN` are readable by later steps. | `.github/workflows/github-actions.yml:23, 26, 87-89` |

### INFO (18)

| Id | Finding | Where |
| --- | --- | --- |
| FM-2 | `readOwnWitnessBlockScript` treats any non-PUSHDATA2 first push as PUSHDATA1; not exploitable (the block magic stops a double reading), but its doc comment is wrong. | `framed/master/witness-reader.ts:91-115` |
| FM-3 | The lifecycle admin signature check (`sighash & 0x1f == 1`) admits ANYONECANPAY: a third party can swap which masters a merge retires; outputs stay fixed. | `framed/master/lifecycle.ts:256-266` |
| SEM-8 | In message-bus mode an event-only contract gets a compiler-added public `initialize()` the source never declared. | `compiler.ts:5519-5541` |
| SEM-9 | State variables with no visibility default to public even under `evmCompat` (Solidity: internal), adding getter entry points. | `AstBuilder.ts:5360`; `SynthesizePublicGetters.ts:303-305` |
| SEM-10 | An inherited fallback/receive is not copied into the child; a parent constructor's own modifiers are dropped when its body is inlined (deploy only). | `InheritanceExpansionTransformation.ts:1083-1088, 1193-1209` |
| CRYPTO-7 | Under `direct`, an invalid `v` returns `address(0)`, which matches an unset signer (EVM parity; contracts must check for zero). | GTT:13917-13939 |
| CRYPTO-8 | Blockhash readers do not enforce the 256-block window; a stateless `ecrecoverEvm` loop does not check the keccak side-car's width (equality still fails closed). | GTT:14037-14072 |
| OPT-3 | The outliner splices cached candidates without re-checking them; edits to 200+-element helper bodies are dropped (latent, safe today). | `outline.ts:1486-1494, 1548, 1620-1676` |
| SDKCORE-5 | A numeric HD index of 2^31 or more silently derives the hardened child. | `HDSigner.ts:82-85, 119-122` |
| SDKCORE-6 | Private keys are not range-checked; a key of 0 or >= n yields an address nobody can spend from. | `Signer.ts:60-67`; `SignatureTemplate.ts:17-19, 40` |
| SDKCORE-7 | The stateful and composition builders switch on `allowImplicitNftBurn` for the whole transaction under broad conditions. | `stb-create-build-session-prelude.ts:77-89`; `compose-assemble.ts:257` |
| SDKCORE-8 | Mock behaviour is triggered by the mere presence of an `addUtxo` method (fee funders and change then go to P2SH32(OP_TRUE)); `RegtestNetworkProvider` never checks its node is on regtest. | `stb-measure-and-fund-covenant-fee.ts:107-121`; `RegtestNetworkProvider.ts:36, 608-619` |
| SDKFRAMED-10 | The rebuilt framed transaction is not re-evaluated before broadcast, and the reference validator is not a preflight (it runs only under a debug flag). | `framed/call/call.ts:2380-2499`; `proxy/deploy.ts:4568-4668, 4869` |
| SDKFRAMED-11 | Event outputs carry 1,000 sats (1,200 at genesis) that anyone can spend after 144 blocks, by design. | `state.ts:2112-2134` |
| SDKFRAMED-12 | Proxied calls keep the deploy-time implementation, so calls fail after an upgrade (liveness only). | `framed/proxy/deploy.ts:4960-5060` |
| TOOLS-12 | Generated TypeScript interpolates file and contract names without escaping (own project only). | `builtin-tasks.ts:245`; `typegen.ts:237, 271`; `artifact.ts:2725` |
| TOOLS-13 | VS Code hovers render contract doc comments as untrusted markdown; no exec, command or webview. | `vscode-solidcash/src/extension.js:116` |
| TOOLS-14 | Secrets inventory: every hit looks like a fixture (a doc example WIF; a third-party project's mnemonic in `solidcash.config.ts:38` and `bench/effectiveacceleration/solidcash.config.ts:62`, mock network only - confirm it is dev-only). No xprv, PEM key or API token is tracked; no key is wired to mainnet by default. | see `TOOLS.md` |

## Status of earlier findings

- 2026-07 fixes re-checked and holding: C4 (key canonicalization), H3, H4 (multiCall change), H5, MD1 (baked selector),
  MD3, MD4, the D18 genesis guard (direct and framed), the upgrade sighash fence, delegate co-spend and selector pins,
  split/merge minting counts.
- Regressed or bypassed: C3 (DS-3, DX-6), C2 for arrays (DS-5), H1 for fully written data NFTs (DS-2), H2 (DX-4), H7
  (SEM-4), H8 (SEM-5).
- SDK L3 (keys in `bitauthUri` on failed sends): fixed; every failure path redacts the keys.
- F11 (proxy initialize front-run): reopened and widened on the framed path (SDKFRAMED-2).

## Recommended fix order

1. **Class A, one rule everywhere:** trust a co-spent UTXO only if its locking bytecode is compared with the expected
   P2SH32 or fixed lock, and read its output at its own index.
   - FM-1: bind `OP_UTXOBYTECODE(validatorRef)` to P2SH32 of the revealed redeem and require `R[0] == 0x21`.
   - CRYPTO-1, CRYPTO-2: bind the side-car locks, as the ecrecover loop path already does.
   - CRYPTO-3: bind the oracle lock, and emit the immutable-output guard for every stateful contract without the OP_1
     exemption.
   - DX-5: pin the low-level call's target lock.
   - KB-1: take the verifier output at the verifier's input index.
   - DS-2: pin the data record's lock on the direct path, as framed does.
   - DS-7: count a batch census read slot only when its input's lock is the collection's entry address (done on
     `feat/parity` by `6e292ca1f`).
2. **Class B:** conserve every container lock in aggregate, and run the full own-category census, in every master
   entry (DX-1, DX-2, DS-3, DX-6, DX-8). Give block oracles their own keeper category (CRYPTO-4).
3. **Class C:** bind every sentinel at its one legitimate use: DS-1 (`-2` only on bus routes, with the binding),
   DS-6, DX-4 (the caller binds the callee's return index), FW-1 and FW-2 (master and validator rules in `FW.md`),
   SEM-11 (invoke only the ids a function-typed parameter can hold, including ids from `abi.decode` and from other
   contracts), DS-8 (keep every batch proof index off every read slot's input, on message-bus routes too).
4. **Class D:** reject non-minimal integer parameters before they are hashed (DS-4); tag validator keys in/out (FV-1)
   and compare views exactly (FW-1); length-check `bytesN`, struct and array parameters and `bytesN(bytes)` casts.
5. **Remaining HIGH rows:** SEM-1, TOOLS-1 (pin libauth to a published version or a commit), SDKFRAMED-1 (check
   the genesis coin with `getRawTransaction`), SDKFRAMED-2 (initialize inside the genesis). SEM-2 is a one-line fix:
   fail the parent compile when a child's standalone compile fails, instead of falling back.
6. **Before any real-chain framed deployment:** re-audit `V_TEMPLATE` after these fixes, since the freeze binds at the
   first deployment.
7. **Until the class A-C fixes land:** extend the README caveat for the direct convention.

## Checked and found sound

About 230 checks across the 13 domains came out sound. The main ones:

- **Framed validator:** every V-check V1-V11 traced to emitted opcodes (V2 canonical decoding, V3 completeness both
  ways, V4 roots, V5 edges, V6 depth-first order, V7 settlement and census, V8 counting, V10, V11) and facet binding.
- **Framed master:** P1/P2, the R2b pool rule, lifecycle authentication, the W1 hash-type fence (CLEANSTACK forces a
  P2PKH unlocking to `<sig> <pubkey>`), O1, `callerRef != self`, the standalone master count by category scan, T57
  gating, the S2/S3 census including T49 and T56, the T54 genesis guard and its byte order, `msg.value` on every frame
  kind, record coordinates (T52, T55), call-site, event, send and `retval` binding.
- **Direct state:** the strict absence bracket, byte-exact presence, the read-path lock pin of sorted nodes,
  composite-key hashing, the two-target linear batch refusing `-2`, the taken conditional delete, the strict C3 count
  where it is emitted.
- **Direct calls and lifecycle:** transfer exactness, active and not-taken event binding, external call identity,
  selector and reachedness, the compat call pin (D8), the delegate co-spend pin and self-preservation.
- **Message bus:** the verifier input is bound by lock and category; the inlined verifier pairs its output by index.
- **Semantics:** the H5, MD3 and MD4 fixes, modifier return regions, override and `__base_` visibility, selector
  collisions, the dispatch size check, the fallback dispatch, the constructor genesis guard.
- **Arithmetic:** division and modulo, `int256.min / -1`, arithmetic `>>`, the bounds-check and wrap emitters, `**`,
  narrowing, bytes indexing and slicing, `evmCompat` dirty-bit checks, `encodePacked`, literal parsing.
- **Crypto:** keccak padding, the ecrecover loop path, the off-curve proof and the r/s/v range checks, the locktime
  guard (on by default), the user external-library loader.
- **Optimiser:** outliner barriers and balanced spans, invoke pairing, dead-define splicing, the peephole rules
  (unchanged since 2026-07-26), push encoding, codecs, the SDK placeholder fill.
- **SDK:** every default signing path is SIGHASH_ALL with SIGHASH_UTXOS; change handling, burn and fee guards; the
  provider txid check; Electrum over wss with certificate checks; no `eval` and no prototype pollution; framed
  signing only after every output is final; nothing refused is broadcast; a plain framed deploy is atomic.

## Not reached

Coverage gaps for a follow-up pass:

- **Framed:** the batch walk's record count for every group shape and mapping-node variants of FW-1/FW-2; chunk
  record checks, `emitFramedAliasedReadGuard` and paging; collection-lock (T45) and conditional-arm (T50) checks for
  struct-field, array-element, delete and multi-slot writes; early-return and revert-after-call paths against the
  segment close; the validator's `emitCheckOrderedEntry` window arithmetic and value arithmetic.
- **Direct:** sorted runtime loops and batches with three or more targets; array and inline-loop external calls;
  out-state and batch-blob verification; the graph deploy paths.
- **Message bus:** the entry journal end to end, `KernelReadCarrierAuthorization.ts`, graph event and token slot
  binding, the proxy-forward envelope, what KB-1's forged lifecycle code leads to.
- **Semantics and arithmetic:** `LowerTailRecursion` body rewrites, the `this`/`msg.sender` context in two inliners,
  `evmCompat` static struct/array decoders, the memory model and Yul storage slots, `addmod`/`mulmod`.
- **SDK:** `message-bus/*` beyond spot checks, the framed composer internals, `read.ts` and receipt listeners, the
  reference validator's semantics.
- **Tooling:** the published npm tarballs and the libauth branch contents (no network access was used).
