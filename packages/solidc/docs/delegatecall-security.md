# Delegatecall proxy security

`addr.delegatecall(input)` implements the proxy/upgrade pattern: the **proxy** holds the persistent state and
forwards calls to a **delegate** (implementation) contract that carries the mutating logic. On SolidCash the
delegate is a compiler-derived implementation build; it runs against the *proxy's* state via the injected
`_proxyMasterIndex` (a witness pointing at the proxy master input), so the proxy can be upgraded by pointing at
a new delegate while its state lives on.

## The model, precisely

State lives in BCH token NFT commitments (UTXOs), not in per-account storage. A stateful contract has a **master
NFT** (minting capability `0x02`, the contract's identity) and one or more **data NFTs** (mutable capability
`0x01`, the state fields). Each data NFT is a *free-standing UTXO with its own covenant* (`packages/utils/src/
state.ts`): its `flag=1` (write) path authorizes an arbitrary output commitment given only that a minting NFT of
its category is present in the inputs — it delegates commitment authorization to "the master". Its `flag=0`
(read) path preserves the commitment; `flag=2` destroys it.

The delegate side works as intended: an inferred implementation function reads `_proxyMasterIndex`, verifies the proxy master
has minting capability and preserves itself, forbids `_proxyMasterIndex == OP_INPUTINDEX`, and — because it is
not itself issuing a delegatecall — runs `emitAutoCovenantVerification` against the proxy's data NFTs, pinning
their output commitments to the computed new values. **So when the delegate is co-spent, it fully authorizes the
proxy state it touches.**

## The hazard (finding C1)

The gap is on the **proxy** side, and it is a direct consequence of the BCH state model differing from EVM
storage. On Ethereum, storage can only be mutated by executing code with authority over the account — there is
no "write slot N directly" primitive, so a public mutating method is safe because *every* mutation goes through
code the developer wrote. On BCH the proxy's data NFT is independently spendable, and its `flag=1` path
self-authorizes on minting-NFT presence alone. Meanwhile the proxy's delegatecall path deliberately skips its
own state covenant (`emitAutoCovenantVerification` is gated `!functionHasDelegatecall`) and emits **no** co-spend
verification for the delegate. Nothing forces the delegate to be present.

So a malicious spender submits, with **no delegate in the transaction**:

```
in0:  proxy master     -> __fallback   (epilogue: master self-preserve + minting-unique + value only)
in1:  proxy data NFT   -> flag=1       (arbitrary output commitment; only checks minting-NFT presence)
out0: proxy master (preserved)
out1: proxy data NFT with an ATTACKER-CHOSEN commitment
```

Value and FT are preserved (state-forgery, not value theft — the `flag=2` destroy vector is finding C3), but the
proxy's state is now whatever the attacker wants. The delegate's authorization never ran because the delegate
was never co-spent. "The developer defines the delegate's authorization paths" cannot help, because the
delegate's code does not execute.

## The sound rule set

Closing this requires the proxy and delegate together to make the delegate the **sole, forced authority** over
the proxy's *entire* state:

1. **The proxy defers its own state authorization on the delegatecall path.** (Current behaviour, correct — this
   is the essence of delegatecall: the proxy forwards, the delegate authorizes.) Safe only in combination with 3.

2. ~~Proxy state mutations should not involve external calls.~~ **Unnecessary.** Once 3 forces the delegate
   co-spend, the delegate is the sole authorizer of the proxy's state, *independently* of anything else in the
   transaction. Additional external calls are orthogonal (and separately hardened for their own return-value
   integrity, findings H2/MD1); they cannot influence the proxy-state authorization. A blanket ban would just
   forbid a delegate that legitimately calls out.

3. **The delegatecall must FORCE and PIN the delegate co-spend.** The delegatecall path must verify that a
   co-spent input at `impl` exists whose UTXO locking bytecode `== impl` and whose forwarded calldata matches
   `input` (identity + which-function). The building blocks already exist — `emitLowLevelCallVerification` pins a
   co-spent input's calldata, and the external-call path (`emitExternalCallVerification`) pins callee identity
   via `OP_UTXOBYTECODE`; the delegatecall path currently emits neither. **Requirement:** `impl` must be the
   delegate's real *covenant* (P2SH) address, not a P2PKH placeholder. If `impl` is P2PKH, the pin is satisfiable
   by an attacker-controlled P2PKH UTXO that authorizes nothing, so C1 stays open. The pinning is mutual and
   composes with delegates that serve many proxies (proxy -> delegate address; delegate -> proxy master via
   `_proxyMasterIndex`).

**B. A function that issues a delegatecall must not self-mutate.** Because the delegatecall epilogue skips
`emitAutoCovenantVerification` *unconditionally*, any `this.x = ...` in that function is unauthorized — and this
is not specific to the fallback:

```solidity
function foo() { this.M = x; impl.delegatecall(input); }   // functionHasDelegatecall == true
                                                           // => this.M = x is NOT authorized
```

So the delegate must be the *only* writer of the proxy's state on this path. This is a compile-time check
(a delegatecall-issuing function containing any state write is rejected) and is *enforced*.

**Full-state authority.** `emitAutoCovenantVerification` (delegate side) only pins the proxy data NFTs the
delegate *accesses*, and the own-category mutable-NFT conservation loop (finding C3) is off on the delegatecall
path. So a proxy data NFT the delegate never touches (`M` below) is still corruptible via `flag=1`:

```
proxy has data NFTs N (delegate writes) and M (delegate never touches)
attacker: fallback(in0) + pinned delegate(in2) writing N + co-spend M's data NFT flag=1 (arbitrary)
```

So the delegate must be the sole authority over the **entire** proxy state: either it co-spends and
preserves/authorizes every C-mutable proxy data NFT, or the proxy runs the own-category conservation loop for
its *own* category on the delegatecall path (its count-conservation is compatible with the delegate's writes,
which preserve the count). The conservation loop is *enforced*.

Structural note: the dispatcher runs exactly one function per master spend, so the fallback and a regular
(self-authorizing) function are mutually exclusive on the same proxy master; the only way to "compose" them is
inlining a delegatecall into a regular function, which rule B forbids.

## Implementation status

- **B (no self-mutation in a delegatecall function)** — enforced (hard compile error,
  `DelegatecallSelfMutationError`).
- **Full-state authority (own-category conservation on the delegatecall path)** — enforced.
- **3 (force + pin the delegate co-spend)** — enforced for a **covenant** `impl`. The delegatecall verifies
  `OP_UTXOBYTECODE[__internal__delegateInputIndex] == impl`, so a real delegate is required at `impl`; the
  delegate then authorizes the proxy's data NFTs via `_proxyMasterIndex`. VM-proven: a correct delegate passes,
  a wrong/absent one fails the pin (`Delegatecall` e2e). A **P2PKH-placeholder** `impl` is *not* pinned (a P2PKH
  UTXO authorizes nothing, so pinning it would be unsound) and still emits the `SECURITY-AUDIT C1` warning — use
  the delegate contract's real covenant address so the co-spend is forced.
  - `withDelegatecall` **auto-derivation is done**: `proxySc.call['up'](input, impl, pk, sig).withDelegatecall(
    implSc, 'increment', []).send()` builds a passing transaction — the SDK auto-fills
    `__internal__delegateInputIndex` with the co-spent delegate's position (the caller passes `impl`).
- **Forwarded-selector pin (which-function)** — enforced. On the pinned path the delegatecall also verifies the
  co-spent delegate's *unlocking* bytecode leads with the forwarded calldata `input` (skip the push-opcode byte,
  compare the next `|input|` bytes) — mirroring `emitLowLevelCallVerification`. So the delegate must run the
  function whose selector the proxy forwarded; a co-spent-but-wrong delegate *function* fails the pin. VM-proven:
  the `Delegatecall` pin e2e checks correct-delegate+selector passes, wrong impl fails the identity pin, a wrong
  forwarded selector fails the selector pin. **Requirement:** the delegate must be **selector-dispatched**
  (`>= 2` functions), so its unlocking script leads with the selector. A single-function delegate has no selector
  (its leading push is `_proxyMasterIndex`), so the pinned path rejects it (fail-closed) — proxy to a multi-function
  implementation, which is the only case where a "wrong function" is possible anyway.

## Writing a safe proxy

- Make `impl` the delegate contract's real category-pinned covenant address (not a hardcoded P2PKH), so the
  co-spend + selector pins are emitted (a P2PKH `impl` disables them and keeps the C1 warning).
- Keep the delegatecall function pure-forwarding: **no `this.x = ...`** in it (the delegate owns all writes).
- Ensure the delegate authorizes/preserves the whole proxy state, not just the fields one call touches.
- Delegate to a **selector-dispatched** (multi-function) implementation so the forwarded-selector pin applies.
- `upgrades.deployProxy` (SDK) wires all of this: it deploys the implementation + a pinned proxy, seeds the state,
  and forwards `proxy.fn(...)` through the pinned delegatecall. See `docs/upgrades.md`.
