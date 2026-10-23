# `msg.sender` security assessment

Date: 2026-09-25.

Follow-up status (2026-10-14): the measurements below remain a snapshot of their cited tree. The resumed-session
direct void `this.f()` mapping-reader failure is now covered by a focused local VM regression: the body uses the
caller's collection witnesses, two different-key reads settle, and a wrong-key call is refused
([AuditTranscriptStateIntegrity.test.ts](../../packages/solidcash/test/e2e/AuditTranscriptStateIntegrity.test.ts)).
This does not claim the mapping-writer shape in F7 was revalidated, or change the deferred native model-B
identity policy. Current implementation status is recorded in
`archive/docs:docs/security/security-audit-2026-10-feat-parity.md`.

**Requirement** (plan D7, user decision): `msg.sender` behaves exactly as in Solidity, in every call context.
`tx.origin` and `address(this)` come with it, since they are defined by the same call frames.

**Scope**
- Today's compiler and SDK at `ea7a48e27`: what runs now, and what Phase 0 of the plan builds on.
- The framed design, [`SPEC_FRAMED_TRANSACTION.md`](./SPEC_FRAMED_TRANSACTION.md) revision 6, which plan
  section 4 builds. Later revisions are listed in the spec's section 0.

**Method**
- Reference behaviour is measured, not recalled: solc 0.8.36 in `@ethereumjs/evm`
  (`probes/this-call-msg-sender/ref.sol`, `ref.mjs`).
- Today's behaviour: code reading with citations, plus mocknet probes (`probes/`).
- Design: an adversarial pass over every identity check, cross-checked by an independent reviewer.

---

## 0. Verdict

**Today's compiler.**
- `msg.sender` differs from Solidity in most contexts beyond a direct user call and internal calls (section 2).
- Five identity or authorization weaknesses are exploitable or close to it:
  - contract callers are identified by presence (F1, VM-demonstrated);
  - signature hash types are not checked (F2, VM-demonstrated);
  - logical-address anchors can be forged (F9);
  - the message-bus graph path lets the builder choose the caller's identity (F10);
  - proxy initialization can be front-run (F11).
- F1, F2 and F9 are critical. Each lets someone act as a contract or a user they are not.

**Spec revision 6.**
- It would have fixed F1-F3 for the new path.
- It had two critical holes: execution order not pinned (S1), and one signature authorizing any number of calls
  (S2).
- It also took the caller's physical lock as its address (S3).
- Revision 7 fixes S1 and S3-S12.
  - S12 uses D9: an address is the transcript's category-pinned address.
  - S2 is a documented residual by D8 (no receipts for now).

**Recommended order.**
1. Build the differential conformance suite. It defines "identical" for every later step.
2. On today's path, if it stays in use:
   - fix F2 (hash-type check);
   - fix F1 and F10 (bind the caller to the call);
   - replace the forgeable anchors of F9 with the transcript address (D9);
   - make proxy initialization atomic (F11).

---

## 1. Reference: the Solidity rule, measured

`msg.sender` changes exactly when a new message call starts: a call to another contract or to the contract
itself, a static call, a value send, or a `CREATE`. It does not change on an internal call or a `delegatecall`.
`address(this)` follows the storage context, so `delegatecall` keeps it too. `tx.origin` never changes.

Measured with a user account `EOA` calling contract `A` (21 contexts):

| # | Context | Observed |
| --- | --- | --- |
| 1 | User calls `A.whoExt()` | `msg.sender` = EOA |
| 2 | Internal `g()` | EOA |
| 3 | `this.g()` | A |
| 4 | `IA(address(this)).g()` | A |
| 5 | `address(this).call(g)` | A |
| 6 | `address(this).delegatecall(g)` (the `Multicall` pattern) | EOA |
| 7 | `try this.g()` | A |
| 8 | A calls `B.who()`: `msg.sender` | A |
| 9 | A calls `B.who()`: `tx.origin` | EOA |
| 10 | A static-calls `B.who()` | A |
| 11 | A calls B, B calls back `A.k()` | B |
| 12 | A delegatecalls `Impl.who()`: `(msg.sender, address(this))` | (EOA, A) |
| 13 | A runs `new Child()`: `(msg.sender, tx.origin)` in the constructor | (A, EOA) |
| 14 | A sends value to B: `msg.sender` in `receive()` | A |
| 15 | A calls an unknown function on B: `msg.sender` in `fallback()` | A |
| 16 | User calls a proxy, which delegatecalls `ImplP.f()`: `(msg.sender, address(this))` | (EOA, Proxy) |
| 17 | User calls the proxy, and `ImplP` calls B: B sees | Proxy |
| 18 | `Factory.make()` runs `new Pair()` then `pair.initialize()` (guarded by `factory = msg.sender`) | passes; `factory` = Factory |
| 19 | The user calls `pair.initialize()` directly | reverts |
| 20 | `msg.sender == tx.origin` at top level | true |
| 21 | `msg.sender == tx.origin` inside `this.g()` | false |

Also measured earlier (`demo.sol`):
- `this.onlySelf()` passes.
- `this.ownerOnly()` called by the owner reverts.
- `sweepFees()` via `this.transfer(...)` debits the contract, not the caller.

---

## 2. Conformance matrix

"Today" comes from the probes and a code survey with citations; section 3 covers the security-relevant rows. "Spec
rev 7" is the rule after this assessment (section 5).

| Context | Solidity (measured) | Today (`ea7a48e27`) | Spec rev 7 |
| --- | --- | --- | --- |
| User calls A | The user | First token-free P2PKH input other than the running one; no hash-type check | The signed caller input (`SIGHASH_ALL` only), with a receipt output |
| Several calls by one user in one transaction | The user, each time | That first P2PKH input, for every call | The user; one receipt per call |
| Internal call | Unchanged | Unchanged | Unchanged (inline) |
| `this.g()` | A | Unchanged (not reset) | A |
| `address(this).call(g)` | A | Rewritten to an internal call; unchanged | A |
| `IA(address(this)).g()` | A | Not rewritten; probably a compile error (not tested) | A, on another master of A |
| `address(this).delegatecall(g)` | The user | Always fails inside `batch(bytes[],bool)` | The user (inline) |
| A calls B | A | Lock of the co-spent master of the category the builder names: presence, not a call | A's `self`, and V5 checks that A made the call |
| `tx.origin` inside B | The user | First token-free P2PKH input | The root user (`originRef`) |
| A static-calls B | A | As for a call; B's master and data must be unchanged | A; read-only, transitively (V10) |
| Re-entry A -> B -> A | B, mid-call | Message bus: rows run one after another, so there is no mid-call re-entry. Direct path: needs a second A master | B, on a second A master, in EVM order (V6) |
| `delegatecall` to other code: `(msg.sender, this)` | (user, A) | msg.sender is the SDK default: tx.origin, or whatever category the builder names; `this` = proxy/root physical lock | (caller's sender, caller's self) |
| `new Child()`: `(msg.sender, tx.origin)` | (A, user) | Factory: the parent's executing input, checked by the parent's script. User deploy: computed off-chain only | (A, user), through a `CREATE` edge |
| Value sent to B | B's `receive()` runs with A | No code runs | A `CALL` into `receive()` / `fallback()` |
| User -> proxy -> implementation: `(msg.sender, this)` | (user, Proxy) | (tx.origin, the proxy's physical master) | (user, proxy address) |
| The implementation calls B: B sees | Proxy | The proxy's physical master, or the implementation's master if the builder chooses | The proxy address |
| Proxy initialization | Atomic in the proxy constructor | A second, permissionless transaction | To specify (open point 5) |

---

## 3. Findings: today's compiler (`ea7a48e27`)

Evidence levels: **VM** = a transaction was run through the BCH-2026 verifier (`@mem-cash/validation`, standard
rules); **code** = read in the source, not run adversarially.

### F1. Critical (VM): a contract caller is identified by presence, not by a call

- **Rule today.** In the callee, `msg.sender` is the lock of the only co-spent minting NFT of the category named by
  the builder-supplied `__internal__msgSenderCategory` argument (`emitMsgSenderMintingVerification`). Nothing checks
  that this contract made the call. `call-model.md` section 9 says so: "IDENTITY (this master was co-spent), not
  framed AUTHORIZATION".
- **Exploit** (`probes/msg-sender-today/probe4_presence_splice_VM_ACCEPTED.test.ts.txt`):
  - Take the genuine transaction in which A calls `X.privileged()`, guarded by `require(msg.sender == A)`.
  - Replace A's unlocking bytecode with A running `ping()`, which makes no call. The outputs are identical, since
    both functions write `calls + 1`.
  - The verifier accepts it: X runs its privileged branch with `msg.sender == A`, and A never called it.
- **Impact.**
  - Anyone who can run any public function of A in the same transaction passes every `msg.sender == address(a)`
    guard in every contract that trusts A.
  - The compiled marketplace (`kernel-row-loop`) still exposes direct entry points with this argument for every
    `onlyMarketplace` function of `MarketplaceDataV1`: `publishJobEvent`, `userRefunded`, `userDelivered`,
    `arbitratorRefused`, `arbitratorSettled`, and others.
- **EVM.** `msg.sender == A` only when A executed the `CALL`.

### F2. Critical (VM): the signature's hash type is never checked

- **Rule today.** `msg.sender` / `tx.origin` is taken from any P2PKH input's lock. The signature is never parsed.
- **Exploit** (`probe5_sighash_reuse_VM_ACCEPTED.test.ts.txt`):
  - The owner signs their own input with `SIGHASH_SINGLE|ANYONECANPAY` (`0xc3`) for a harmless `bump()`. The build
    had no output at that input's index, so the signature committed to no output at all.
  - The attacker copies that unlocking bytecode unchanged into their own transaction calling `setOwner(attacker)`.
  - The verifier accepts it: ownership moves to the attacker without the owner's key.
- **Impact.** Every owner-only or role-gated function falls to any user signature that does not use
  `SIGHASH_ALL`. BCH offer and crowdfunding protocols produce such signatures; the SDK's `SignatureTemplate`
  allows them with a warning.
- **EVM.** A transaction has one signer, and the signature covers the whole transaction.

### F3. High (code): a user caller is chosen by input position

- **Rule today.** `msg.sender` and `tx.origin` are the first P2PKH input that carries no token and is not the running
  input (`emitTxOrigin`). The SDK puts the signer first (VM-checked, `probe2`); a hand-built transaction can put any
  other signed input first.
- **Impact.**
  - With a fee sponsor, relayer or co-signer, the builder decides which signer the call acts for.
  - A user whose input carries tokens is skipped.
- **EVM.** The transaction's signer.

### F4. High (code, documented): a contract caller is its physical lock, not its address

- **Rule today.** "Contract-origin `msg.sender` still exposes the authenticated physical caller root"
  (`large-contract-splitting.md`, "Hardhat-compatible deployment sequencing").
- **Impact.**
  - Behind a proxy, in a split contract, or under a CREATE-predicted address, the callee sees a different address
    from the one Solidity gives.
  - On the 66 path: `onlyMarketplace` (the marketplace is deployed with `deployProxy`) and Unicrow's
    `onlyUnicrow*` guards compare against proxy or CREATE addresses.
- **EVM.** The caller's address: the proxy address for proxied code (reference row 17).

### F5. Medium (VM): `this.g()` keeps the caller

- Measured earlier (`probes/this-call-msg-sender/`); `AstBuilder.ts:7323` warns about it.
- The wrong-account effect is latent today only because of F6 and F7.
- **EVM.** `address(this)` (reference rows 3-5).

### F6. Bug (VM): internal call to a public function that reads `msg.sender` and writes state

- It fails with `OP_VERIFY`, through either `this.f()` or `f()`. Each half works alone.

### F7. Limitation (code): `this.f()` whose callee writes a mapping

- Refused at compile time (`InvalidParameterTypeError`).

### F8. Low (code): try/catch

- Catch blocks are dead code. This fails closed, but a transaction fails where the EVM would continue.

The code survey (an agent with file:line citations) found the following. I re-read the cited code for F9, F10, F11
and F12; F13-F16 are the survey's reading.

### F9. Critical (code; needs a hostile VM test): a call to a logical address can reach a fake contract

- **The check** (`GenerateTargetTraversal.ts:32229-32290`, anchor path of a typed external call). It verifies only
  three things:
  - the anchor input sits at the stored logical address `L`;
  - the last 35 bytes of its commitment equal the callee master's lock;
  - the two categories match.
- **Not checked:** the record format, the anchor's capability, uniqueness, or that `L` derives from the deployer and
  nonce. The derivation is checked off-chain only.
- **Why it is forgeable.** The anchor lock is `<seed> OP_DROP OP_1` (`logical-identity.ts:62-66`), so anyone can
  spend it, and anyone can pay a new output to `L`.
- **Attack.**
  - Mint a fresh category.
  - Create a fake master F, plus an NFT of the same category at the victim's `L` whose commitment ends with F's
    lock.
  - A caller that stores `L` (the SDK's `getAddress()` for CREATE-shim deployments) then calls F and trusts its
    results. For example, a fake token "transfers" without moving anything.
- **EVM.** An address holds exactly one contract.

### F10. High (code): on the message-bus graph path, the builder picks which identity the caller presents

- **Rule.** A nested row's `msg.sender` is the lock of any input in the calling participant's block
  (`compiler.ts:10639`, `:11091`: `sourceOffset < ownerSize`).
- **Gap.** The caller's own code commits to the target, selector, arguments and result, not to this offset.
- **Consequences.** The block holds the caller's master, its state, fillers (`P2SH32(OP_TRUE)`, the same for every
  contract), and for a proxy also the implementation input and the identity anchor. So one caller can present
  several identities, and one of them is shared by all contracts.

### F11. High (code): proxy initialization can be front-run

- **Rule.** When the implementation has `initialize`, `deployProxy` creates the proxy, then forwards `initialize`
  as a second transaction. Forwarding is permissionless (`upgrades.md`, `upgrades.ts:815-835`).
- **Attack.** Whoever forwards first runs `__Ownable_init(msg.sender)` and becomes owner. MarketplaceV1 and
  MarketplaceDataV1 both have this shape.
- **EVM.** OpenZeppelin runs the initializer inside the proxy constructor, atomically.

### F12. Medium (code): user-deployed constructors are not enforced on-chain

- **Rule.** Constructors run in an off-chain simulation, and the genesis transaction is authorized only by the
  funder's signature (`sc-derive-deploy-commitments.ts:222-229`, `:341`).
- **Consequence.** A contract instance can be published with any initial state, including any `owner`. Anyone who
  trusts an instance must check its genesis off-chain.
- Factory-created children are checked by the parent's script.
- **EVM.** The constructor runs on-chain with `msg.sender` = the deployer.

### F13. Medium (code): delegate, library and facet frames take `msg.sender` from an SDK default

- **Rule.** The SDK passes a zero category, so `msg.sender` becomes tx.origin rather than the delegating frame's
  `msg.sender`. The script accepts any category the builder declares (the F1 class).
- **EVM.** A `delegatecall` keeps the caller's `msg.sender`.

### F14. Medium (code): one contract has several identities

- **Rule.**
  - Direct paths, delegate rows and constructor folds use the physical master lock.
  - Graph rows reached through a logical address use the logical address.
  - `address(this)` is physical, while the SDK's `getAddress()` is logical.
- **Consequences.**
  - `msg.sender == a` fails for CREATE-shim peers (the Unicrow guards on the 66 path).
  - Mappings keyed by `msg.sender` split into two entries.
- **Dead code.** `__internal__msgSenderAnchorIdx` is still added and filled with `-1`, but no code generation reads
  it; its consumer was removed in `c78c135b7`.

### F15. Low (code): 20-byte address conversions

- `uint160(addr)`, `bytes20(addr)` and ABI address words reduce a P2SH32 lock to HASH160. That gives about 2^80
  collision resistance between two scripts an attacker builds; `logical-identity.ts:51-53` avoided exactly this.

### F16. Low (code): receive and fallback

- Paying a contract runs no code.
- A `receive()` that reads `msg.sender` gets the hidden sender parameter, while the ABI publishes no inputs.
  This is a possible mismatch; it was not tested.

**Documentation that no longer matches the code** (from the survey):
- `large-contract-splitting.md:232-247`: SCID anchors are P2SH32, and typed calls do use them.
- `deploy-then-call-fold.md:71`: `msg.sender` is folded.
- `library-contracts.md:3`: says not built, but later phases are marked done.
- `block-and-transaction-properties.md:548-552`: omits the "no token" and "not self" conditions and physical vs
  logical.
- SDK comments in `logical-identity.ts:335-339`, `stb-set-funder-utxos.ts:116-119` and
  `stb-assemble-constructor-inputs.ts:143` still describe the on-chain SCID lookup for `msg.sender` that was removed
  in `c78c135b7`.

---

## 4. Findings: spec revision 6

Two passes: my own, and an independent reviewer's; each finding was checked against the spec text.
- Both passes found S1, S3, S6, S7, S8, S9 and S10.
- Only the reviewer found S2, S4 and S5.
- Only my pass found S11.
- S12 follows from the code survey's F9.

The fixes are folded into spec revision 7 (section 5).

### S1. Critical: execution order is not pinned (V6)

- **Rule in rev 6.** V6 only requires a master's segment `s + 1` to follow the callee range of its call `s`.
- **Not required:**
  - that the callee range starts right after segment `s`;
  - that one master's segments stay in order;
  - that independent roots stay apart.
- **Attacks:**
  - Place `A.k` (a re-entry) before `A.f`'s pre-call write. It reads the old state, consistently chained.
  - Put a second root, even the attacker's own, between a contract's pre-call segment and its callee. Example: a
    vault's `deposit()` has raised `totalShares` but not yet `totalAssets` when it calls a trusted ERC-20. The
    attacker's `redeem()`, run in that gap, trades at the wrong price.
  - The EVM cannot produce either order with a trusted callee.
- **Fix.** The validator derives the order itself, depth first, from the call tree:
  - segment 0, then the whole subtree of call 0, then segment 1, and so on;
  - `M` lists only the roots, in order;
  - root subtrees never interleave.

### S2. Critical when someone else assembles the transaction: one signature authorizes any number of calls

- **Rule in rev 6.** Any number of masters may name the same signed P2PKH input as `callerRef` / `originRef`.
- **Attack.** The victim co-signs a transaction to run `C.claim()`. The assembler adds `Token.approve(attacker, max)`
  with the victim as caller.
  - The victim's `SIGHASH_ALL` signature does cover the resulting state outputs, but a wallet cannot read what an
    opaque commitment means.
  - A signature does not cover other inputs' unlocking bytecode, where the calls are named.
- **EVM.** One signature authorizes exactly one call, whose target and calldata the wallet shows.
- **Fix considered:** a call receipt per user-rooted call, an output that puts each call made in the user's name
  under the user's signature.
- **Decision (plan D8):** no receipts for now.
  - The risk is documented as residual T32.
  - Receipts and a cheaper "one root per signed input" limit are written up as options (spec section 14.1).
  - Until then, a wallet signing a transaction it did not build must decode the witnesses to see the calls made in
    the user's name.

### S3. High (on the 66 path): the caller's physical lock is used as its address

- **Rule in rev 6.** W1 sets `msg.sender = OP_UTXOBYTECODE(callerRef)`; R8 calls the lock "its address and its
  `msg.sender` identity".
- **Divergence.** A caller running on a proxy's implementation master, or on a facet of a split contract, shows the
  code's lock. Solidity shows the proxy's or the contract's address (reference row 17).
- **Consequences:**
  - `onlyMarketplace` and Unicrow's guards cannot pass.
  - One logical contract gets one identity per facet.
  - Proxies over the same implementation code would share one identity.
  - After an upgrade, the old implementation's masters still present the old lock.
- **Fix.** Every frame has a `self`, and a message call gives the callee `msg.sender = caller.self`.
  - Plain contract: `self` is its own address.
  - Implementation master: the proxy's address, valid only while the proxy's current implementation (read from its
    real state) is this code.
  - Facet: the logical address, valid only if the facet is listed in the contract's real anchor records.

### S4. High: caller cycles with no user root

- **Attack.** Two masters name each other as caller and callee.
  - V5 closes both edges.
  - V4 never fires, because neither caller is outside the covered set.
  - `tx.origin` can then point at any P2PKH input.
- **Fix.** The callers form a forest whose roots are signed users. The depth-first walk of S1 must visit every
  covered master exactly once.

### S5. High: master and validator may parse witnesses differently

- **Gap.** The canonical witness position is open point 1.
- **Attack.** If the master reads `callerRef` at one offset and the validator at another, the master authorizes
  against caller X while the validator approves a graph with caller Y.
- **Fix.** One versioned, length-prefixed witness block at a fixed position, with no trailing items. The validator
  decodes pushes exactly as the VM does (minimal pushes are consensus).

### S6. High: value sent to a contract

- **Rule in rev 6.** Transfers are plain outputs.
- **EVM.** The recipient's `receive()` or `fallback()` runs with `msg.sender` = the sender, and the send reverts if
  the recipient cannot accept.
- **Here.**
  - The recipient's code never runs.
  - A plain output at a contract lock is unspendable (P1 and the section 3.1 table refuse it), so the value is burnt.
  - Unicrow sends value with `call{value: ...}` (`Unicrow.sol:262`, `:370`).
- **Fix.**
  - Sends to a P2PKH lock are outputs.
  - A send to any other lock is a message call into `receive()` / `fallback()` that credits the recipient; if the
    recipient accepts neither, the transaction fails.
  - The sender's code enforces the split from the target lock type.

### S7. High: `delegatecall` and internal calls across facets are not modelled

- **EVM** (reference rows 6, 12, 16). `msg.sender`, `address(this)` and storage stay the caller's.
- **Affected.** Proxies, library external functions, and `Multicall` (a delegatecall to itself).
- **Rev 6.** Such an entry on another master would get `msg.sender = lock(callerRef)`.
- **Fix.**
  - A delegatecall to the contract's own code runs inline.
  - Otherwise a `DELEGATE` edge: the callee keeps the caller's `msg.sender`, `address(this)`, `tx.origin` and
    records.
  - An internal call that crosses into another facet is the same (`INTERNAL`).

### S8. Medium: `CREATE` is not modelled

- **EVM** (rows 13, 18, 19). The constructor sees the creator: the pattern `factory = msg.sender` guarding
  `initialize`.
- **Rev 6.** Only pre-deployed masters exist.
- **Addresses.** They are code-hash based, so CREATE2 counterfactual addresses (for example `pairFor`) do not hold.
- **Fix.**
  - A `CREATE` edge into a constructor frame of a genesis, with `msg.sender = creator.self`.
  - The address model belongs to S3.

### S9. Medium: static calls are not read-only

- **EVM.** `STATICCALL` reverts on any state change, transitively.
- **Rev 6.** Settles whatever the "view" callee writes.
- **Fix.** A `STATIC` edge: every record is unchanged in every segment; no events, value or creation; all nested
  calls are `STATIC`.

### S10. Low: try/catch

- The catch branch never runs, so the transaction fails where the EVM would recover. Identity is unaffected.
- A catch branch may only ever be selected on a proven revert, never by a bare witness.

### S11. Low: users other than P2PKH

- P2SH wallets cannot be `msg.sender` (open point 8).
- If ever allowed, every one of their signatures needs the W1 hash-type rule.

### S12. Critical: a contract's address must be bound on-chain to exactly one contract

- **Gap.** Revision 7's `self` check for facets rests on an "anchor record", and the Hardhat path uses logical CREATE
  addresses. F9 shows that an anchor anyone can create at an address proves nothing.
- **Decision (plan D9).** A contract's address is the address of its transcript (validator) contract:
  `addrX = addrV(catX) = P2SH32(pin(catX) || V_TEMPLATE)`.
  - Its script starts with the category pin every stateful contract carries (`contract-creation.md`).
  - Consensus makes categories unique, and the category is hashed into the address, so no anchor is needed.
  - Facets hold the contract's category, so they present one address; behind a proxy it is the proxy's.
  - The validator checks every master's `self` against it (spec V11).
- **Follow-ups** (spec section 4a, open point 13):
  - Masters carry `addrX` as a constant baked into their code at deployment, next to the pin. So `address(this)`
    stays unforgeable and needs no `V_TEMPLATE`.
  - Paying a contract is a call in which its master mints a satoshi container, as today.
  - Predicted addresses (SDK only, decided):
    - The SDK reserves genesis-eligible UTXOs ahead of `getCreateAddress`, one per predictable nonce.
    - Beyond that, preparing them is the user's responsibility; it is documented, and the SDK's error points there.
    - The Unicrow fixture predicts four addresses.

### Recheck of revision 7 (fixed in revision 8)

- **Critical: `DELEGATE` / `INTERNAL` callee substitution (T37).**
  - Revision 7 checked a `DELEGATE` callee's `sender` and `self` against its caller, but never tied the callee's own
    code to the target the caller named.
  - So any master, including one of an attacker's contract, could run in the caller's context and write the
    caller's state.
  - Fixed in V5 and V11: the callee's category must match the named target, or for `INTERNAL`, the same contract.
- **Critical: untouched records consumed (T38).** V7 checked outputs but not which state UTXOs were spent, so another
  user's mapping entry could be deleted. Fixed: spent state UTXOs are exactly the touched records.
- **Critical: record values (T39).** Settlement compared commitments only, so a record's value could be drained.
  Fixed: S4 and D2.
- **Sanity, blocking: proxies.**
  - An implementation master of another category could not satisfy D1 for the proxy's state, and could not mint the
    proxy's records or events.
  - Fixed by following the EVM: the proxy's master runs the fallback, which delegatecalls the implementation.
- **Sanity: other fixes.**
  - State UTXOs moved to `stateX` (the minting pin refuses them at `lockX`).
  - The witness block is now the first push.
  - Validator recognition under D9 uses `H_V`.
  - `msg.value` passes through a `delegatecall`.
- **Open: address stability under D9.** `addrV` hashes `V_TEMPLATE`, so a validator fix would move every address
  (spec open point 13).

### Checked and rejected (the spec already prevents them)

| Candidate | Prevented by |
| --- | --- |
| A state UTXO or foreign input posing as a caller | V4, N1 |
| Replay of an `ANYONECANPAY` / `NONE` / `SINGLE` signature | W1 |
| `tx.origin` pointed at another user at the root | V4, N1 |
| Two deployments of the same source sharing an address | P1 pins the category into the code |
| Standalone `msg.sender` forgery | N1 |
| Two callers claiming one callee | A callee has one `callerRef` |
| Hidden second master during self-settlement | Category scan |
| Inline and cross-master self-calls giving different senders | R3, W1 |

---

## 5. Identity model for revision 7

Specified in the spec, sections 1 (R3, R8, R10), 4a and 7. In short:

- **Frames.**
  - Every execution has a `sender`, a `self` and an `origin`, set exactly as Solidity sets them for its kind of
    entry: `ROOT`, `CALL`, `STATIC`, `DELEGATE`, `INTERNAL` or `CREATE`.
  - Inline frames get them at compile time.
  - A master's frame gets them from its witness block. Each value is checked locally (`ROOT` sender, a plain `self`)
    or by the validator (every edge).
- **Sources.** Every identity value traces back to one of two things; nothing comes from position or presence:
  - a signed P2PKH input with `SIGHASH_ALL`;
  - a contract's address bound to its category (S12).
- **Authorization.** A user's signature covers the transaction's outputs, not which calls name the user (T32,
  residual by D8). Receipts are a documented option.
- **Addresses.** A contract's address is its transcript's category-pinned address, `addrV(cat)` (D9).
- **Order.** The validator derives the execution order depth first from the call tree. A root's calls never
  interleave with another root's, and a callee runs entirely inside its call.

---

## 6. Verification

1. **Differential conformance suite.**
   - Compile each row of the section 1 reference with solc and with solidc.
   - Run them in `@ethereumjs/evm` and on mocknet.
   - Map the identities to roles (user, A, B, Proxy, Factory) and require equality.
   - This is the acceptance test for "identical to Solidity" (plan D7).
2. **Regression exploits.** `probe4` (F1) and `probe5` (F2) become tests that must be rejected. F9 needs its own
   hostile VM test first.
3. **Hostile tests for the new path:** one per threat T18-T36 of the spec.
