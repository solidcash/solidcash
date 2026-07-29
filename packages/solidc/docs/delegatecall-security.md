# Delegatecall proxy security

`addr.delegatecall(input)` implements the proxy/upgrade pattern: the **proxy** holds the persistent state and
forwards calls to a **delegate** (implementation) contract that carries the mutating logic. On SolidCash the
delegate is a function marked `delegate` on the implementation; it runs against the *proxy's* state via the
injected `_proxyMasterIndex` (a witness pointing at the proxy master input), so the proxy can be upgraded by
pointing at a new delegate while its state lives on.

## The model, precisely

State lives in BCH token NFT commitments (UTXOs), not in per-account storage. A stateful contract has a **master
NFT** (minting capability `0x02`, the contract's identity) and one or more **data NFTs** (mutable capability
`0x01`, the state fields). Each data NFT is a *free-standing UTXO with its own covenant* (`packages/utils/src/
state.ts`): its `flag=1` (write) path authorizes an arbitrary output commitment given only that a minting NFT of
its category is present in the inputs — it delegates commitment authorization to "the master". Its `flag=0`
(read) path preserves the commitment; `flag=2` destroys it.

The delegate side works as intended: a `delegate` function reads `_proxyMasterIndex`, verifies the proxy master
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

**C. `impl` must be a covenant the CALLER cannot choose.** Rule 3 says `impl` must be a covenant address rather
than a P2PKH placeholder, but that is only half of it: the pin compares the co-spent input's locking bytecode
against *whatever address the spender supplied*. If `impl` is an unguarded function parameter the pin is
trivially satisfiable — the attacker co-spends an implementation **they wrote**, whose `delegate` function
writes whatever they like:

```solidity
function up(bytes input, address impl) external {   // pinsDelegateCoSpend == true, and the pin proves NOTHING
    impl.delegatecall(input);                       // MEASURED: an unrelated spender settles 5 -> 999
    require(input.length > 0);
}
```

The address must be bound to something the caller does not control. Any one of these is sufficient:

- a **constructor argument** — the proxy's own p2sh32 commits to it (the `bytecode-pinned` class);
- a **signature guard whose KEY the caller cannot choose** - a constructor argument or a state variable, so only
  an authorized signer may pick `impl` (the `caller-authorized` class);
- a **`require()` against stored state** — `require(impl == this.implementation);`, the ordinary upgradeable
  proxy.

A parameter with none of the three emits a `SECURITY-AUDIT C1` warning naming the parameter. It warns rather
than rejecting **because the third shape is legitimate and common**, and a hard rejection would have to model
every way a `require()` can constrain an address.

**A signature guard is only as good as its key (finding SEC-12).** `checkSig(s, pk)` proves that whoever
supplied `pk` also supplied a matching `s` - nothing more. If the *same caller* supplies both, the check
authorizes nobody and the proxy is wide open:

```solidity
contract SelfAuthProxy() {                                        // no constructor arguments: no stored key
    bigint counter;
    function up(bytes input, address impl, pubkey pk, sig s) external {
        require(checkSig(s, pk));                                 // pk is the CALLER's, so this proves nothing
        impl.delegatecall(input);                                 // MEASURED: a stranger settles 5 -> 999
        require(input.length > 0);
    }
}
```

Until round 15 the compiler credited *any* `checkSig`/`checkMultiSig`/`checkDataSig` in the body as a guard
without asking which key it checked, so this shape compiled with no C1 diagnostic at all - and so did a P2PKH
`impl` once such a check was added beside it. The compiler now reads the key operand (arg 1 of `checkSig` /
`checkMultiSig`, arg 2 of `checkDataSig`), resolves it through casts and local aliases, and credits a guard only
when it lands on a **constructor input, a state variable, or a literal**. A parameter of the same entry point is
not a guard. An array index only *selects* among a container's elements, so `checkSig(s, this.owners[i])` stays
a guard even though the caller picks `i`.

> The `PINNED_PROXY` fixture in `packages/solidcash/test/e2e/Delegatecall.test.ts` is written in exactly the
> unsafe shape above. It is **not** an example of a safe key - it exists to exercise the identity + forwarded
> -selector pins of rule 3, which are independent of who is authorized, and it now emits the C1 warning.

**D. The delegatecall must be reached at most once per path.** The state-covenant skip is a *per-function*
property (`!functionHasDelegatecall`), while the co-spend pin is emitted at the *callsite*. Those two disagree
whenever the callsite is not straight-line:

- **Inside a branch.** `if (flag) { impl.delegatecall(input); }` skips the proxy's own state covenant for the
  whole function but pins the co-spend only on the taken arm. Spending with `flag = false` and **no
  implementation in the transaction** reproduced finding C1 exactly (measured: 5 -> 999 accepted). The compiler
  now allocates a runtime "delegate edge reached" flag and requires every proxy data NFT's
  `category ++ commitment` to be preserved input -> output on any path that did not reach the edge. So the
  not-taken path is *frozen*, not unauthorized: a no-op spend still settles, a state change on that path does
  not. Straight-line proxies allocate no flag and are byte-identical.
- **Inside a loop.** `for (...) { impl.delegatecall(input); }` reuses the *same* pinned input and the *same*
  block slot on every iteration, so two source delegations settled as one (measured: 5 -> 6 where the source
  says 5 -> 7), with no diagnostic. There is no honest covenant to emit for it, so it is a hard compile error.
  Delegate to an implementation function that performs the iteration itself.

Scope: both rules apply to any callsite that owns ONE reserved delegate slot — a hand-written
`impl.delegatecall(input)` and the synthesized forms of rule E alike. A compiler-synthesized SCB1 route / graph
handler dispatches rows through a loop by design and derives a delegate index per ROW, so it is excluded from
both.

*Why that exclusion does not disarm anything (measured, not proven).* "Excluded" reads like "unprotected", so
the three things that actually hold there, each measured at compile time on the same source:

- The **source entry point is not excluded**. Compiling a conditional-delegate proxy with the message-bus
  options still classifies its callsite `conditional` and still emits the not-taken-path covenant into that
  function's body. Only the `__scb_graph_*` clone (`graphEmissionHandler`) and the `__scb1` route are excluded.
- The **route never skips its own state covenant.** `__scb1` issues no delegatecall itself (it `OP_INVOKE`s
  handlers), so `functionHasDelegatecall` is false for it and it runs the ordinary data-NFT covenant. Rule D's
  hazard is precisely "the per-function skip is wider than the per-callsite pin"; with no skip there is no gap.
- A **state-writing batch contract with a delegate row does not compile at all**: the route inlines the row
  bodies, so it has both a delegatecall and a state write and rule B rejects it. (Identical on 05412a58 — this
  is pre-existing, not a consequence of rule E.)

**Measurement traps, recorded because each produced a false negative on first inspection.** Two artifact shapes
hide emitted covenants from an ASM grep of `artifact.bytecode`:

- A **message-bus** artifact publishes the dispatcher in `bytecode` and each function body as HEX in
  `functionBodies`; decode the body for the function's selector.
- A **split root** outlines forwarder bodies into `OP_DEFINE`d spans that are *pushed as data*, so opcode names
  never appear; search the assembled BYTES (`93 c7 88` = `OP_ADD OP_UTXOBYTECODE OP_EQUALVERIFY`).

Both are pinned in `SecurityAudit.test.ts` ("X16", "pins the facet co-spend in a split root forwarder").

Still open: no VM-level forgery was attempted against a live graph-controller transaction with a conditional
delegate row. The above is compile-level evidence for the mechanism, not a settled negative result.

**E. A delegatecall the COMPILER writes is still a delegatecall.** Two source forms lower to a delegatecall the
user never typed, and both were excluded from rules 3, B and D because those rules keyed off "did the user write
`delegatecall`":

- **`L.f()` library-call sugar.** `contract C { bigint count; function bump() { Counter.increment(); } }`
  desugars to `__libAddr_Counter.delegatecall(<increment selector>)`.
- **Split-facet forwarders.** A contract over the script-size limit is split, and each moved entry point becomes
  a root forwarder that delegatecalls its facet.

The exclusion made `pinsDelegateCoSpend` **false** for these, so the callsite emitted no covenant at all — while
the per-function `!functionHasDelegatecall` gate still skipped the consumer's **entire** state covenant. That is
rule 3's hazard with nothing left to catch it and, unlike rule C, no caller-supplied address to blame. Measured
on the BCH-2026 VM with a one-line delegate library (consumer state 0):

| co-spent at the delegate slot | settled | baseline | fixed |
|---|---|---|---|
| the real, linked library | 1 | ACCEPTED | ACCEPTED |
| a HOSTILE library, same layout + same `increment()` selector | 999 | ACCEPTED | REJECTED at input 0 |
| **nothing at all** | 999 | ACCEPTED | REJECTED at input 0 |

The synthesized forms are now pinned exactly like a hand-written delegatecall, with one difference: the delegate
input index is **derived** from the function's own reserved `lowLevelCall` block slot rather than read from the
`__internal__delegateInputIndex` witness. They carry no witness parameter (the consumer ABI is unchanged), and a
derived index is the stronger source — nothing caller-supplied selects the input. The target is a synthesized
constructor argument (`__libAddr_L`, or the facet link), so rule C is satisfied structurally: the contract's own
p2sh32 commits to it.

Only a stateful **entry point** reserves a delegate input slot, so a library call from an internal helper has
nothing to pin to; it is refused by name rather than left silently unpinned. (On 05412a58 that shape compiled
with `lowLevelCalls` undefined on the entry point — no slot, no pin, no diagnostic.)

The forwarded-selector half is emitted only when the library has **>= 2 public functions**. A
one-public-function library compiles to a single-entry-point contract whose unlocking script carries no leading
selector — and with one function there is nothing for a caller to choose, so the identity pin alone is the whole
property there. Un-excluding these forms also brings rules B and D to bear on them: `L.f()` next to a
`this.x = ...` is now `DelegatecallSelfMutationError`, and `L.f()` inside a loop is refused by name (one reserved
slot serves every iteration).

*Residual:* the library's `delegate` function still does not authenticate its caller (by design — a delegate
serves many proxies; see the `_proxyMasterIndex` note above). What the consumer now guarantees is that the script
at the delegate slot IS the linked library and, when the library is selector-dispatched, that the named function
ran. A `brandLibrary: true` library adds the converse pin (the library refuses a foreign consumer's master).

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
- **C (`impl` not caller-chosen)** — *warned*, not rejected. A delegatecall whose target resolves (through local
  aliases) to a parameter of the same entry point, with no signature guard and no `require()` naming it, emits a
  `SECURITY-AUDIT C1` warning identifying the parameter. Rejecting would break `require(impl == storedImpl)`.
  **SEC-12:** "signature guard" means a check whose *key* is a constructor input, a state variable or a literal.
  A `checkSig` against a key the same caller supplies suppresses nothing - measured: the self-authorizing proxy
  above compiled silently on `690c868c`, and so did a P2PKH `impl` with such a check beside it. Both now warn.
  This is a diagnostic only: no bytecode changed (0 differences over 2,070 compiled repo sources), so the
  measured `5 -> 999` takeover still settles - the warning is what tells you it can.
- **D (reached at most once per path)** — enforced. A delegatecall inside a **loop** is a hard compile error; a
  delegatecall inside a **branch/switch/try arm** compiles and carries an extra epilogue covenant freezing the
  proxy's own data NFTs on every path that did not reach the edge. VM-proven both ways in
  `Layer3DelegateClassesE3`: the not-taken forgery is refused at input 0, the honest taken spend still settles,
  and a not-taken no-op still settles.
- **E (synthesized delegatecalls are pinned too)** — enforced. `L.f()` library sugar and split-facet forwarders
  set `pinsDelegateCoSpend` with `delegateIndexFromBlockSlot`, so the identity pin reads the reserved block slot
  instead of a witness; the selector half is added when the library is selector-dispatched. Rules B and D now
  apply to them as well. VM-proven in `LibraryDelegate.test.ts` (`SEC-4`): honest spend settles, a hostile
  implementation and a bare no-delegate rewrite are both refused at input 0, and a substituted library function
  is refused on a two-function library.

## Writing a safe proxy

- Make `impl` the delegate contract's real category-pinned covenant address (not a hardcoded P2PKH), so the
  co-spend + selector pins are emitted (a P2PKH `impl` disables them and keeps the C1 warning).
- Do **not** take `impl` as an unguarded parameter. Use a constructor argument, a `require()` against stored
  state, or a signature guard **whose key is a constructor argument or state variable** (rule C). A `checkSig`
  against a `pubkey` parameter is not a guard: the caller supplies the key and the signature both (SEC-12).
- Keep the delegatecall on a straight line, or accept that a branch's not-taken path can only preserve state.
  Never put it in a loop (rule D).
- Keep the delegatecall function pure-forwarding: **no `this.x = ...`** in it (the delegate owns all writes).
- Ensure the delegate authorizes/preserves the whole proxy state, not just the fields one call touches.
- Delegate to a **selector-dispatched** (multi-function) implementation so the forwarded-selector pin applies.
- The same rules apply to a `L.f()` delegate-library call, which is a delegatecall the compiler writes for you
  (rule E): no `this.x = ...` beside it, never in a loop, and prefer a multi-function library so the
  which-function pin applies too.
- `upgrades.deployProxy` (SDK) wires all of this: it deploys the implementation + a pinned proxy, seeds the state,
  and forwards `proxy.fn(...)` through the pinned delegatecall. See `docs/upgrades.md`.
