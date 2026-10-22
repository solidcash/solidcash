<!-- cspell:ignore unconserved -->
# VERIFY_CALLS: adversarial check of DX-4, DX-6, DX-8, KB-2, KB-3

Tree: /Code/cashscript/.worktrees/per-call @ abbb7e0ec (feat/per-call). Read-only: no tests, compiles or probes.
GTT = packages/solidc/src/generation/GenerateTargetTraversal.ts. All line numbers are at HEAD (not df51215d6).

Summary: all five hold up. No blocking check found for any of them.

| Finding | Verdict | My severity |
|---|---|---|
| DX-4 | CONFIRMED | HIGH |
| DX-6 | CONFIRMED by code (one VM test recommended) | CRITICAL |
| DX-8 | CONFIRMED (mechanism), impact conditional | MEDIUM (HIGH for some implementations) |
| KB-2 | CONFIRMED, wider than reported (direct convention too, mapping keys too) | CRITICAL |
| KB-3 | CONFIRMED by code (one VM test recommended) | HIGH |

---

## DX-4: CONFIRMED. Severity HIGH

### Decisive lines

- **B side.** In GTT:42876-42886, `__internal__returnOutputIdx` is read from the witness. The
  sequence `OP_DUP 0 OP_GREATERTHANOREQUAL OP_IF` puts every carrier check behind `>= 0`. The
  `OP_ELSE OP_DROP OP_ENDIF` at GTT:42981-42984 pins no carrier for a negative index.
  - The witness is a plain ABI parameter (SymbolTableTraversal.ts:4804-4815).
  - `-1` is a supported mode: GTT:44134-44156 compacts the output layout for it.
- **A side (binding).** `emitExternalCallVerification` binds only three things: B's lock, B's master
  preservation, and the first 4-byte push of B's unlocking (GTT:42145-42227 via
  `emitExtractUnlockingSelector`, 41851-41865). Nothing parses B's `_returnOutputIdx`.
- **A side (carrier checks).** A's epilogue checks the carrier at A's own witnessed index
  (GTT:42997-43089): category == B, none capability, FT 0, lock `0x51`, value <= 1200.
- **H2 uniqueness.** GTT:43090-43190 requires the count of (category B, none capability, OP_TRUE)
  outputs to equal the number of genuine returning calls. With B's carrier absent, the forged
  carrier makes the count exactly 1.
  - Identity-less slots (msg.sender, function-pointer and loop targets) skip the check entirely
    (GTT:43110), so a forged twin also works beside a genuine carrier there.

### Blocking checks searched (none blocks)

- B's own-category immutable pin exempts OP_TRUE carriers (GTT:44856-44880), except in
  split-facet delegates.
- B's minting uniqueness counts only 0x02, and C3 counts only 0x01.
- B's master is a co-spent minting NFT, so at consensus it authorizes minting the forged
  none-capability NFT of category B.

### Scope

- Direct convention only. Framed masters read their result from the witness record (GTT:9600-9603).
- Graph handlers skip this path entirely (GTT:9551-9553, `!node.graphEmissionHandler`).
- STATICCALL has no selector check at all (GTT:42145 is REGULAR-only).

### Side note (not separately audited)

In REGULAR mode, A binds only B's selector, not B's ordinary arguments. B may therefore run the expected
function on other arguments.

### Severity: HIGH

Any direct-convention caller that consumes a callee's return value (a price, a balance, a bool) can be fed
a value the attacker chooses. It is critical wherever the caller pays out on that value.

---

## DX-6: CONFIRMED by code (one VM test recommended). Severity CRITICAL

### Decisive lines

- **The census is gated off.** GTT:45990-45995: `emitDirectCollectionCensus` returns unless
  `__messageBusExplicitlyDisabled === true`. It also returns for framed compositions.
- **C3 does not cover these functions.** GTT:9519-9526: C3 (`countsOwnCategoryNfts`) excludes:
  - entry access;
  - token containers;
  - dynamic writes;
  - deploys;
  - delegates.

  For those functions the census is the only transaction-wide cover.
- **The flag is false on the default path.**
  - compiler.ts:1141-1170: `messageBus` undefined resolves to `'auto'`, which is enabled, with the
    flag false.
  - compiler.ts:2593: the flag is `messageBus === false`.
  - compiler.ts:4272-4285: auto mode sets the flag only when it narrows a graph-free contract.

  So every contract with a typed external call or a non-delegate low-level call compiles without the
  census, and so does every explicit `messageBus: true` leaf.
- **Direct entries survive in message-bus builds.** compiler.ts:2231-2232 and 8271: "The ordinary
  direct entry points and public message-bus handlers remain unchanged". The route is an additional
  entry point.
- **The record covenants self-authorize on any master co-spend.**
  - Entry NFT write path, flag=1 (state.ts:1894-1916): it checks only that `masterInputIndex`
    holds C||02 and places no constraint on outputs.
  - Data NFT, flag=3 rewrites and flag=2 destroys (state.ts:133-200).
- **Nothing else counts.** The remaining checks are per named slot:
  - `emitReadOnlyEntryVerification` (GTT:45669+);
  - `emitEntryCategoryVerification` (31638+);
  - `emitTokenCategoryVerification` (31370+).

  No other transaction-wide count of own-category 0x01 NFTs exists in a non-route direct entry.
- **The census commit confirms it.** cf9724659's message says message-bus builds stayed
  byte-identical. The hole it closed was VM-proven on the direct path.

### Attack

Take any message-bus build's direct entry that touches a sorted mapping. The attacker can do any of the
following:

- co-spend an unnamed entry node with flag=1 and re-mint it with a forged value (for example a
  balance), or destroy it;
- co-spend an un-accessed data NFT with flag=3 and rewrite it;
- mint a duplicate data NFT.

### VM test to close it

1. Take the CollectionReadInputCensus contract plus one typed external call (or compile it with
   `messageBus: true`).
2. Spend its direct read entry beside an extra node of the same collection, rewritten through flag=1.

Expected: accepted under the message bus; refused with `messageBus: false`.

### Severity: CRITICAL

This is the historical C3 class (rated CRITICAL), and it sits on the default build path for every contract
with a graph edge.

---

## DX-8: CONFIRMED (mechanism), impact conditional. Severity MEDIUM (HIGH for some implementations)

### Decisive lines

- **What a delegate function checks.** GTT:9609-9615:
  - proxy master preservation and proxy minting uniqueness;
  - `emitDelegateSelfPreservation`, which covers D's master UTXO only (GTT:44186-44265);
  - `emitDelegateMintingNftUniqueness`, which counts D's 0x02 only (GTT:44268-44345).
- **What it does not check.**
  - C3 excludes `currentFunctionIsDelegate` (GTT:9519).
  - The census, C1 and the immutable pin all use `emitMasterInputIndex`, which is the proxy's
    category.
  - GTT:44770-44771 states it directly: "The implementation's OWN category is not pinned here".
- **D's records are open.** D's data NFTs accept flag=3 and flag=2 against D's master, which is
  co-spent in every delegated call (state.ts:133-200). At consensus, D's minting NFT also lets the
  transaction mint new D||01 and D NFTs.
- **No victim proxy is needed.** A delegate takes `__internal__proxyMasterIndex` as a witness
  (SymbolTableTraversal.ts:3671-3675), so any proxy works, including the attacker's own.

### Limits

- The delegated call itself preserves D's master, so it cannot brick proxies directly.
- D's own records are read only by D's standalone (non-delegate) functions: view/pure, upgrade,
  selfdestruct, deploy, split/merge, unsafe, and functions that write no state.
- The SDK deploys D with its own state "unused" (packages/solidcash/src/stateful/upgrades.ts:1007-1009).
- Impact therefore needs D to expose such a function gated by its own stored state. Example: an
  `upgrade` or `selfdestruct` behind a stored owner. That bricks every proxy that pins D's lock
  (GTT:25267-25277).

### Severity: MEDIUM

The state is genuinely unconserved, but default deployments leave D's own state unused. It is HIGH for
implementations with standalone owner-gated lifecycle or sweep functions.

---

## KB-2: CONFIRMED, wider than reported. Severity CRITICAL (evmCompat)

### The projection is not injective (generation/utils.ts:24-52)

No template check is made. The 20-byte identity is chosen by lock size alone:

| Lock size | Identity |
|---|---|
| 0 | 20 zero bytes |
| 20 | the value as is |
| 32 | last 20 bytes (no zero-prefix check) |
| 23 | bytes 2..22 |
| 35 | HASH160 of the lock |
| any other size | bytes 3..23 |

### Where the projection is used

- **Address `==` / `!=`.** GTT:16340-16356  normalizes both operands under evmCompat before
  the EQ/NE, via `emitGraphAddressIdentity` (GTT:21816-21828). That helper keeps the last 20 bytes
  of a 32-byte word (no zero-prefix check) and otherwise falls to `compileAddressToEvmIdentity`.
- **Mapping keys by address.** `emitMappingKeyIdentity` (GTT:25582-25603) applies the same projection
  to address keys under evmCompat (direct convention; skipped for framed). Called from the sorted-key
  hash at GTT:25657 and at 12817 / 22775.
- **Casts.** `uint160(address)` / `bytes20(address)` use the projection (generation/utils.ts:222-234).
- **Graph argument binding.** GTT:24083-24086.
- **msg.sender is a full lock.** `emitMsgSenderMintingVerification` returns the co-spent minting
  master's full `OP_UTXOBYTECODE` (GTT:46854-46900). So `msg.sender == owner` under evmCompat compares
  identity(full lock) == identity(owner).

### Attack (unchanged from KB-2's text, confirmed)

Craft a lock L whose projected 20 bytes equal the victim identity T. The simplest is a bare 1-of-2
multisig `OP_1 <02||X> <attackerPub> OP_2 OP_CHECKMULTISIG` (71 bytes), where X's first 20 bytes are T;
L falls in the "any other size -> bytes 3..23" branch so L[3..23) = T. Attacker spends with his own key.
Then identity(L) == T == identity(owner) passes.

### Standardness (question 2): the carrier IS standard under BCH 2026

- bch-2026-consensus.js:13: `maximumStandardLockingBytecodeLength: 201`.
- bch-2023-instruction-set.js:486-490: for a source output (the UTXO being spent) whose lock exceeds
  that length, `isSimpleMultisig(...) === false` is the only extra test; a lock <= 201 bytes passes the
  length test outright with no pattern check.
- The 71-byte bare multisig is also independently `isSimpleMultisig` (instruction-sets-utils.js:699-732):
  m=1,n=2, both keys are standard-encoded 33-byte compressed points (X is a real curve point, attacker
  key is real). So it is relayable as both a source output and a tx output (`isStandardMultisig`,
  n<=3, 735-745).
- A P2S covenant of any OTHER length up to 201 bytes is equally standard as a UTXO, so the attacker does
  not even need the multisig shape: any <=201-byte lock whose bytes 3..23 equal T works and is relayable.
- The size-32 branch (nonstandard 32-byte lock) needs a miner, but the bare-multisig/P2S path does not.

### Verdict: CONFIRMED, broader than reported

D13 (docs/framed/DECISIONS.md) describes the identity as HASH160(lock); the code only does that for
size-35 locks. The projection is used in direct-convention `==` and mapping keys too, not just the graph
binding. The fix the finding proposes (exact template projection; require 12 zero bytes for 32-byte
words as GTT:19921-19929 already does for the EVM-word encode path) is correct.

### Severity: CRITICAL

Under evmCompat, any authorization by address equality (`require(msg.sender == owner)`, address-keyed
balances/allowances) is forgeable with a relayable standard lock and no victim key. This is the core
access-control primitive.

---

## KB-3: CONFIRMED by code (one VM test recommended). Severity HIGH

### Decisive lines

- **The verifier is optional on a non-graph bound route.** compiler.ts:13307: the atomic verifier
  invocation is gated `__internal__activeVerifierIndex >= 0 && ...` only when `useBoundRoute &&
  !graphExecutionContext`. The witness is attacker-supplied, so `-1` skips `__message_bus_verify_atomic`
  entirely (atomicVerifierInvocation, 13306-13334).
  - `localAuthenticatedRoute` (13302, 13342) further restricts invocation to a one-row lifecycle
    selector for msg.sender routes, widening the skip.
- **A caller's verifier does not require the routed callee to run its own route.** The participant
  loop (compiler.ts:12300-12373) binds every other participant by base lbc, category and base-output
  preservation only (12319-12337). It never requires that a routed callee's input carries an `SCB1`
  route selector, an L3C1 envelope, or its own verifier NFT. The caller trusts the manifest row result
  for the callee (authority 0), which is enforced only if the callee's route runs and invokes its
  verifier.
- **The callee's master may be spent another way.** A participant base needs only lbc +
  C||02 + base-output preservation (12319-12337). A state-preserving direct entry of the callee
  satisfies that without executing its route logic or its verifier.
- **V5 direct-authority is the only path that binds a callee's unlocking** (compiler.ts:12646-12679,
  requires `directUnlock` begins with the manifest selector). The routed path (authority 0) has no
  equivalent.

### Attack shape (as reported)

A: `require(token.transferFrom(msg.sender, this, amt)); shares[msg.sender] += amt;`. Manifest: A root,
A->V transferFrom result true. V's master is co-spent and preserved through a standalone spend
(activeVerifierIndex = -1) or a state-preserving direct entry; V's verifier never runs, so V's
`transferFrom` body never executes. A credits shares with no token movement.

### VM test to close it

Compile a two-contract graph where V is a non-graph `messageBus: true` leaf. Build a transaction where
A's route runs with the manifest claiming V's result, and V's master is spent through its own direct
state-preserving entry with `activeVerifierIndex = -1`. Show A settles on the unproduced result.

### Severity: HIGH

A caller settles on a callee result the callee never produced: forged transferFrom success, forged
oracle reads. Same impact class as KB-1 but needs the callee to be a bound leaf or to have a
state-preserving direct entry.

---

## Answers to the three questions

### Q1 verdicts (decisive file:line)

- DX-4 CONFIRMED - GTT:42876-42886 + 42981-42984 (B skips carrier on idx<0); A never parses B's idx
  (41890-42268).
- DX-6 CONFIRMED - GTT:45993 (census gated on `__messageBusExplicitlyDisabled`) + 9519-9526 (C3 skip) +
  compiler.ts:1141-1170/2593/4272-4285 (flag false on default + explicit-true paths).
- DX-8 CONFIRMED (impact conditional) - GTT:9519 (C3 skips delegate) + 44770-44771 ("own category not
  pinned") + state.ts:133-200 (flag 2/3 self-authorize on master co-spend).
- KB-2 CONFIRMED - generation/utils.ts:24-52 (no template check) + GTT:21816-21828, 25582-25603,
  16340-16356.
- KB-3 CONFIRMED - compiler.ts:13307 (verifier gated on activeVerifierIndex>=0) + 12319-12337 (peer
  participants bound by base lbc/category only).

### Q2 (KB-2 standardness + which comparisons use the 20-byte projection)

- Relayable/standard: YES. BCH 2026 standard lock length is 201 bytes (bch-2026-consensus.js:13), and a
  source output <= 201 bytes passes with no pattern check (bch-2023-instruction-set.js:486-490). The
  71-byte bare 1-of-2 multisig is additionally `isSimpleMultisig`/`isStandardMultisig`
  (instruction-sets-utils.js:699-745). A miner is needed only for the 32-byte-lock variant, not for the
  bare-multisig or <=201-byte P2S path.
- 20-byte projection consumers: evmCompat `msg.sender == owner` and all address `==`/`!=`
  (GTT:16340-16356 -> emitGraphAddressIdentity 21816-21828); address mapping keys (emitMappingKeyIdentity
  25582-25603, used at 25657/12817/22775); `uint160`/`bytes20` casts (generation/utils.ts:222-234); graph
  argument binding (24083-24086). msg.sender itself is the full co-spent-master lock
  (emitMsgSenderMintingVerification, GTT:46854-46900), so equality compares identity(lock)==identity(owner).

### Q3 (severity, one line each)

- DX-4 HIGH: forged return value to any direct-convention caller that pays out on a callee result.
- DX-6 CRITICAL: historical C3 (un-accessed state destruction/forgery) reopened on the default build
  path for every graph-edge contract.
- DX-8 MEDIUM (HIGH for owner-gated-lifecycle implementations): implementation records unconserved, but
  default deployments leave D's own state unused.
- KB-2 CRITICAL: evmCompat access control by address equality is forgeable with a relayable standard
  lock and no victim key.
- KB-3 HIGH: caller settles on a callee result never produced (forged transferFrom/oracle), via the
  optional-verifier bound-leaf path.
