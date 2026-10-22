<!-- cspell:ignore SDKFRAMED -->
# SDKFRAMED - framed SDK (packages/solidcash/src/framed) off-chain audit

Tree: /Code/cashscript/.worktrees/per-call, HEAD abbb7e0ec (feat/per-call). Read-only; no tests, compiles or probes run.
Paths below are relative to packages/solidcash/src unless stated. Line numbers as read at abbb7e0ec.

## Findings

### SDKFRAMED-1 - HIGH - CODE-CONFIRMED (SDK side) - Genesis category taken from an unverified provider outpoint: a hostile provider can hand the user an attacker-owned category (deploy, proxy implementation, CREATE look-ahead)

Files:
- stateful/ContractFactory.ts:96-107 and 171-175 (`selectGenesisFundingUtxoForCost` / `selectGenesisFundingUtxo`):
  the vout-0 coin comes from `signer.getUtxos()` -> `provider.getUtxos(address)`, and nothing checks its lock.
- framed/deploy/stateful.ts:69-76 (`categoryId = options.fundingUtxo.txid`) and :257 (`builder.send()`).
- framed/proxy/deploy.ts:1049-1053: the implementation category comes from `implementationDeploy.fundingUtxo.txid`.
  Lines 1104-1110 then mint the proxy record `implementation: implementationMaster.address`, which is addrV of that txid.
- framed/deploy/create-lookahead.ts:131-136 and 150-165: predicted CREATE address = addrV(reserved coin txid).
- TransactionBuilder.ts:1308-1325: `send()` only checks that the returned txid equals the hash of the bytes. A provider
  can always return that hash and serve the bytes back to `getTxDetails`.

Root cause: the SDK never checks that the coin whose txid becomes the category is a real output at the signer's
own lock. A txid commits to the transaction's outputs, so one `getRawTransaction(txid)` check would settle this.
Today, an outpoint a hostile provider reports at the user's address is trusted outright.

Scenario:
1. A hostile Electrum/provider lists an outpoint T:0 that the attacker owns, as if it were at the user's address.
2. It accepts the user's genesis broadcast, returns the expected txid and serves the bytes back. The genesis is
   invalid, because it spends T:0 with the user's key, so it is never relayed.
3. The SDK returns a handle on category T. Separately, the attacker creates category T from T:0. They mint masters
   at the user's master lock (computable from the public artifact), validators, records with attacker-chosen state
   (for example owner = attacker), and keep a minting NFT at their own P2PKH.
4. From then on even an honest provider serves the attacker's category T, because it is real on-chain. The lie is
   needed only once.
5. Deposits paid into T's containers (records.ts:59-70: authorized by a minting NFT of T) can be swept with the free
   minting NFT.
6. Proxy variant: the provider lies only for the implementation half. The user's proxy is real, but its
   `implementation` record is addrV(T_i). Per spec R2/R8, any minting-NFT holder of T_i can mint a master under T_i
   at any lock, so the attacker's code runs as the proxy's delegate frame over the proxy's records and containers.
   This is full takeover of a proxy the user owns.
7. Look-ahead variant: `getNonce()` reserves attacker outpoints, so the `getCreateAddress` answers (spec 19: circular
   constructor references) point at attacker-creatable categories that the user's own contracts then trust.

Extends M-5 ("provider UTXO data trusted, display/DoS"): for the genesis coin the impact is a category hijack, not
display or DoS.

Suggested fix:
- Before using or reserving a coin as genesis funding, fetch `getRawTransaction(txid)`. Require
  `hash256(raw) == txid` and that `outputs[vout]` is the signer's P2PKH with the stated value and no token. Fail closed.
- In `deployFramedProxy`, check the implementation genesis is seen (or confirmed) before minting the proxy record
  that names it.

### SDKFRAMED-2 - HIGH - CODE-CONFIRMED - F11 status: framed `deployProxy` REOPENS F11 (initialize is a separate third transaction), and widens it

Files:
- framed/proxy/deploy.ts:1098-1110: both geneses are broadcast first.
- framed/proxy/deploy.ts:1131-1270: only then is the deployment read back and the initialize hop planned and settled.
  This is up to `MAXIMUM_HOP_ATTEMPT_CAP` VM-probe attempts (deploy.ts:250-258).
- framed/proxy/deploy.ts:1272: the hop is broadcast only if `callerFunding` is set and the hop was accepted.
- stateful/upgrades.ts:812-816: a refused hop throws after both geneses are on-chain.
- Spec 19 (SPEC_FRAMED_TRANSACTION.md:1810-1817) documents the three transactions and defers atomic init.

Root cause: the proxy's genesis mints the records uninitialized and publishes masters and validators anyone can
compose against. `initialize` runs later as a permissionless ROOT hop through the fallback.

Scenario:
- A mempool watcher sees the proxy genesis. The proxy artifact is reproducible: `buildProxyArtifact(implementation)`
  plus `deployMaster(category)`.
- The watcher broadcasts its own `initialize` hop, spending the proxy master, validator and record from the
  unconfirmed genesis, while the SDK is still planning. It becomes owner (`__Ownable_init(msg.sender)`), and the
  user's hop then conflicts and fails.
- The window is the whole hop derivation (seconds or more), not one round-trip.
- Fail-open: any refusal after step 2 leaves an uninitialized proxy on-chain for anyone to initialize. For example:
  - the static "sends value from a loop" check at deploy.ts:1172-1176, which could run before any broadcast;
  - record-count mismatches at 1132-1146;
  - a planning error;
  - an unaccepted hop (upgrades.ts:812).
  A direct `deployFramedProxy` call without `callerFunding` never broadcasts the hop at all (deploy.ts:1272).

Suggested fix:
- Plan and VM-check the hop before broadcasting anything. The genesis txids are computable from the signed bytes.
  Run every static refusal before step 1.
- Broadcast the three transactions back to back, and refuse `deployFramedProxy` without `callerFunding` (or mark the
  result as uninitialized loudly).
- Proper fix: initialize atomically. Run `initialize` as the proxy genesis's own constructor frame, so the records
  are minted already initialized, as the plain framed deploy does.

### SDKFRAMED-3 - MEDIUM - CODE-CONFIRMED - Reserved CREATE look-ahead coins are spent as the fee coin of framed calls and hops, permanently killing the predicted address

Files:
- framed/call/handle.ts:264-267 (`callerCoin`: largest tokenless UTXO, no reservation filter).
- stateful/upgrades.ts:841-843 (`framedCallerFunding`, same rule).
- Contrast with the selection paths that do filter: stateful/ContractFactory.ts:104-108, 171-175 and
  `fanOutPlainUtxos`, all of which exclude `isReservedGenesisOutpoint`.

Root cause: reservations (stateful/genesis-reservations.ts) are honoured only by genesis and fan-out selection.
`Signer.getNonce()` reserves 4 coins (Signer.ts:108-122), and the fan-out consolidates the user's largest coin into
the reserved vout-0 output (ContractFactory.ts:111-127). That reserved coin is then exactly the "largest tokenless
UTXO" the next framed call picks.

Scenario:
1. `getNonce()`, then `getCreateAddress(n+1)`, then deploy A with B's predicted address.
2. A framed call (for example `A.initialize()`) or a framed `deployProxy` spends B's reserved coin as its fee input,
   not at input 0 and with no genesis.
3. Category txid(B coin) can never be created. B's predicted address is dead forever: A is permanently misconfigured,
   and anything paid to that address is unrecoverable. `takeReservedGenesisFunding` later hands out the spent coin,
   so B's deploy fails.

Suggested fix: filter `isReservedGenesisOutpoint` (and the session's reserved set) out of `callerCoin`,
`framedCallerFunding` and every other fee-coin pick. Refuse if only reserved coins remain.

### SDKFRAMED-4 - MEDIUM - SUSPECTED (reachability depends on an on-chain gap) - Broadcast is gated only on VM acceptance; the SDK signs outputs that still carry placeholders or sentinels

Files:
- framed/call/call.ts:2149-2186: the `owed` check runs only `if (!settled && owed)`. A plan that set
  `settled = true` (2107-2109, 2140-2141) with unlearned views, sends, events or amounts goes on to verdicts and
  broadcast (2286).
- The call path never calls `requireLearnedViews`. Only the hop does (proxy/deploy.ts:2397).
- Neither path checks that the hop's sends were learned (hop-value.ts:198, 225-233; deploy.ts:5240-5268).
- Sentinel outputs:
  - call.ts:1187-1189 and 1385-1390: send lock = P2PKH(sha256(label)), which nobody can spend; amount
    1,234,567,891+ sats.
  - With an unknown amount, `payFromContainers` spends no container (call.ts:1219, hop-value.ts:198).
  - So the sentinel amount is funded from the caller's coin through `addBchChangeOutputIfNeeded`
    (TransactionBuilder.ts:890-918). `callerCoin` is the largest coin.

Root cause: the SDK relies wholly on the masters and validator constraining every output it lists. The composer's
own comment (composer/draft.ts:367-370) says an unlearned placeholder "would reach the record's output as the value
the transaction writes".

Scenario: an on-chain declaration gap is already known (validator-settled record declarations). Combined with
artifact metadata that disagrees with the body (for example `unconditionalSends` vs the body's real sends), an
accepted run can leave:
- a placeholder commitment in a record, which corrupts state; or
- a sentinel send, which burns about 12.3 BCH of the caller's coin to an unspendable lock.

Suggested fix: before signing, refuse whenever any learned slot is still undefined or still equals its sentinel or
placeholder, whatever `settled` is. Call `requireLearnedViews(draft)` in call.ts. As a final cheap guard, assert no
output lock or value equals a sentinel.

### SDKFRAMED-5 - LOW - CODE-CONFIRMED - Low-level framed APIs sign with whatever hash type the funder's template carries

Files:
- framed/call/call.ts:195, 2463 (`callFramedEntry` / `sendFramedValue`).
- framed/proxy/deploy.ts:138, 4844 (`callFramedProxyEntry`; `deployFramedProxy` callerFunding).
- framed/deploy/resize.ts:41, 64-65: the admin's `sighashType` is used as given, though the comment says it must be ALL.
- The derivation is evaluated with a filler 0x41 (deploy.ts:1011-1016, call.ts:419-...), while the broadcast carries
  the template's own type.

Root cause: `funder: Unlocker` is never inspected. `SignatureTemplate` accepts NONE, SINGLE and ANYONECANPAY with
only a console warning (SignatureTemplate.ts:45-72).

Scenario: an integrator passes `new SignatureTemplate(key, SINGLE|ANYONECANPAY)`. The master head refuses the
transaction, a liveness bug. The signed bytes still reach the provider, and the caller-input signature can be reused
to sweep the caller's coin minus the one committed output.

Default surfaces are safe: `Signer.unlockP2PKH` uses ALL|UTXOS (Signer.ts:65, SignatureTemplate.ts:23).

Suggested fix: require `funder.template.sighashType` to be ALL or ALL|UTXOS (no ANYONECANPAY) before building. Same
for the resize admin.

### SDKFRAMED-6 - LOW - CODE-CONFIRMED - `FramedFunctionCall.compose()` broadcasts, and the call object is a thenable that sends when resolved

Files:
- framed/call/handle.ts:133-153: `compose()` is documented as "for a caller that wants the verdicts".
- It runs `composeWith` -> `callFramedEntry`, which broadcasts on accept (call.ts:2286).
- framed/call/handle.ts:227-235: `then` sends a writing call.

Scenario: a dApp calls `compose()` to preview before asking for confirmation, but the transaction is already
broadcast. Separately, returning a call object from an async function, or `Promise.all([...calls])`, executes it.

Suggested fix: make `compose()` derive only, with a refusing provider like `simulationProvider`, or rename it. Document
the thenable.

### SDKFRAMED-7 - LOW - CODE-CONFIRMED - Constructor `msg.sender` silently becomes an unspendable synthetic lock

Files:
- framed/deploy/stateful.ts:90-91: the sender is the funder's lock only when it is 25 bytes.
- framed/deploy/genesis.ts:246-248 and 1263: otherwise it is P2PKH(0x11 x 20).

Scenario: a direct `StatefulContract.deploy` / `deployFramedStatefulContract` with a non-P2PKH funder and no
`senderLockingBytecode`. A constructor doing `owner = msg.sender` mints owner = a lock nobody can sign for. Contract
control is lost, though not stolen. The factory path sets the Signer's lock (ContractFactory.ts:379).

Suggested fix: refuse when the constructor reads `msg.sender` and no 25-byte sender is known.

### SDKFRAMED-8 - LOW - CODE-CONFIRMED - `Signer.getNonce()` (a read in ethers) can sign and broadcast up to 4 fan-out transactions

Files:
- Signer.ts:108-122 -> create-lookahead-session.ts:68-75 -> create-lookahead.ts:111-121, 150-158 ->
  ContractFactory.ts:111-127 (`tb.send()`).

Scenario: reading the nonce consolidates the user's coins into fresh vout-0 outputs, one per reservation and 1,000
sats fee each, without being asked. The funds stay with the user, but signing happens on a read. This also feeds
SDKFRAMED-3.

Suggested fix: reserve only existing eligible coins on `getNonce()`, and fan out only on an explicit reserve or deploy.

### SDKFRAMED-9 - LOW - CODE-CONFIRMED - Framed merge disables the NFT-burn guard for the whole transaction and has no preflight

Files: framed/deploy/resize.ts:139 (`allowImplicitNftBurn: kind === 'merge'`), 147 (caller-supplied
`fundingUtxos` signed by `funder`), 150-158 (built and sent directly, no VM evaluation).

Scenario: an NFT sitting on a caller-supplied funding UTXO is burned silently. FT conservation is still enforced.

Suggested fix: allow only the retired masters' minting NFTs to disappear (count them explicitly), or require
tokenless funding.

### SDKFRAMED-10 - INFO - CODE-CONFIRMED - No re-evaluation of the rebuilt transaction; the reference validator is not a preflight

Files:
- framed/call/call.ts:2380-2499 and framed/proxy/deploy.ts:4749-4887: the transaction is rebuilt on real outpoints,
  with the real signature and the change output, then sent unevaluated.
- `decideReference` is reachable only from `traceAssembledHop` under FRAMED_HOP_TRACE=1 (deploy.ts:4568-4668, 4869),
  and it only traces.

Impact: liveness only (consensus decides), but the "provider's own profile accepts" assumption (call.ts:2378-2380) is
never checked locally.

### SDKFRAMED-11 - INFO - CODE-CONFIRMED - Event outputs leave value anyone-can-spend after 144 blocks (by design)

Files: packages/utils/src/state.ts:2112-2134 (event covenant = category/capability check plus CSV 144, then OP_1);
1,000 sats per event in calls (call.ts:256, callees.ts:175, deploy.ts:4436) and 1,200 at genesis (stateful.ts:180-188),
paid from the caller's coin.

This conflicts with "never leave value anyone-can-spend" and with the spirit of spec R9 (no bare OP_1 outputs), but
the amount is small.

### SDKFRAMED-12 - INFO - CODE-CONFIRMED - Proxied calls pin the deploy-time implementation category

Files:
- stateful/upgrades.ts:874 and framed/call/handle.ts:179-195.
- `callFramedProxyEntry` never reads the proxy record's `implementation` (deploy.ts:4960-5060).
- `requireFramedUpgrade` (proxy/upgrade.ts:35) has no caller, and `upgradeProxy` refuses non-param proxies
  (upgrades.ts:1240-1246).

Impact: after an implementation-driven upgrade every proxied call is refused (liveness). The SDK cannot be steered to
another implementation.

## Checked and sound

1. Default signing surfaces use SIGHASH_ALL|SIGHASH_UTXOS: handle.ts:194/207 and upgrades.ts:847 use
   `signer.unlockP2PKH()` -> SignatureTemplate.ts:23.
2. Every output is placed before the caller's input is signed. Participants, trailing outputs and change come first,
   then `buildLibauthTransaction`: call.ts:2468-2480, deploy.ts:4852-4866. Tentative fee-sizing signatures never leave
   the process.
3. The funder's lock must equal the root caller lock, so the `msg.sender` binding holds (call.ts:2385-2391,
   deploy.ts:4751-4757).
4. Participant inputs are rebuilt from the derived lock, value and token, never from provider data. Under ALL|UTXOS a
   lying provider makes the transaction invalid, never different, and cannot steer a raw contract unlocking onto a
   user coin (call.ts:2410-2461, deploy.ts:4786-4834).
5. `broadcastCall` fails closed on a live token/NFT mismatch (call.ts:2431-2453).
6. The provider's returned txid is checked against the hash of the bytes (call.ts:2494-2499, deploy.ts:4878-4883,
   TransactionBuilder.ts:1320-1325).
7. Refused compositions are never broadcast. Every path is gated on all participant and container verdicts
   (call.ts:2210-2224, 2286; deploy.ts:2409-2416, 1272, 5240).
8. The no-coin simulation refuses `sendRawTransaction` and `sendPreparedTransaction` (handle.ts:283-293). Its stand-in
   outpoint signature is useless elsewhere.
9. msg.value goes into the callee contract's own container (`satoshiContainerLockingBytecode(categoryId)`), and
   through a proxy into the proxy's container, not the implementation's (deploy.ts:5131-5133, hop-value.ts:228).
10. Change goes to the caller's `changeAddress` or own lock. The SDK creates no OP_RETURN and no R9 placeholder outputs
    (layout.ts:1-9 and 70-78; call.ts:2477; deploy.ts:4855).
11. A plain framed deploy is atomic and front-run-free. The constructor's state (sender = the Signer's lock,
    ContractFactory.ts:379) is minted in the one genesis transaction that spends the deployer's coin
    (stateful.ts:126-257).
12. The genesis leaves no free minting NFT: minting outputs go only to the master lock (stateful.ts:142-148).
    Funding must be at vout 0 (stateful.ts:69-74, deploy.ts:1042-1046).
13. The SDK never composes another user's call into the caller's transaction. The queue only serializes (queue.ts,
    handle.ts:146-152), so T32 does not arise from SDK flows. There is no external co-sign API in framed/.
14. Reads never broadcast. view, pure and `writesState === false` entries go to `staticCall` (handle.ts:186-235).
15. The deployment registry used for callee and address resolution is in-process (deployment-registry.ts), not
    provider-controlled.
16. Merge still enforces FT conservation (the TransactionBuilder FT check is independent of `allowImplicitNftBurn`).
17. The generated proxy has no upgrade entry (D20 held), so the SDK never retargets an implementation itself.
18. `allowImplicitNftBurn` in `broadcastCall`/`broadcastHop` is enabled only when the caller's coin is tokenless and a
    record is consumed (call.ts:2399-2404, deploy.ts:4771-4776).

## Not reached

- callees.ts settlement internals; entry-records.ts; external-calls.ts; entry-writes.ts; call-resolution.ts;
  generate-core.ts; reentry.ts (grep only).
- composer assemble/settlement/need-test/pools/derivation internals.
- read.ts (2078 lines; only reached via the handle) and receipt listeners.
- reference.ts semantics (only confirmed it is not a preflight).
- The ethers shim in packages/testing (only noted that it calls `predictCreateAddress`).
- Whether the on-chain masters actually constrain unlisted trailing outputs, which decides SDKFRAMED-4 reachability.
