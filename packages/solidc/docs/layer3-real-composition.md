# The real message bus: native composition of independently-compiled contracts

This is the sound direction for a BCH message bus, and the answer to the production audit
(`layer3-production-audit.md`). The bus is NOT a new homogeneous covenant; it is SolidCash's existing,
already-sound `IContract(addr).method(args)` composition applied to REAL, independently-compiled application
contracts. The audit's own correction (L3-4) states it plainly: "The bus must authenticate projections of
application contracts; it must not replace all applications with a newly generated shared covenant."

## What it is

Each contract is compiled on its own. A caller invokes a callee with the native external-call form, which
the compiler lowers to a co-spend + introspection covenant (see `call-model.md`):

- the callee is co-spent and pinned to its exact address (self-pin + `OP_UTXOBYTECODE == addr`);
- `msg.sender` resolves to the unique co-spent caller master (hardened - see
  `msg_sender_uniqueness_hardening` / `call-model.md`);
- the callee's return value is delivered through a category-bound return-event NFT the caller consumes, so a
  wrong result cannot be injected;
- the callee's OWN state covenant governs its state transition - it stays authoritative inside the
  composition.

Transitive chains (A -> B -> C) and multi-callee stars (A -> B, A -> C) compose from the same primitive; the
SDK auto-derives the co-spends.

## Evidence (real VM + real node)

- `Layer3RealComposition.test.ts` - two independently compiled contracts (Kashi <- Bento) settling a real
  Rebase (Bento returns `shareOut`, Kashi consumes it into collateral); the 3-owner graph (Kashi <- Bento +
  Token) atomically; and a hostile where an over-debit trips the Token's own `require` and reverts the whole
  settlement (callee authority under composition).
- `Layer3ResultChain.test.ts` - the corpus-5/6 result-dependency graph (Kashi -> Bento -> Oracle) where each
  level consumes the level-below AUTHENTICATED result; and a hostile where a guard failure at the deepest
  callee reverts the entire transitive settlement.
- Both files pass on the real `createVirtualMachineBch2026` consensus VM AND on a live BCHN regtest node
  (`TESTS_USE_REGTEST=true`, 6/6), establishing deployability, not just mock acceptance.

## How the native path answers each audit finding

| Finding | Native-composition status |
|---|---|
| L3-1 canonical transcript | N/A - there is no transcript blob to equivocate on; each call is individually self-pinned + return-bound. The equivocation was a homogeneous-scaffold artifact. |
| L3-2 resource commitment | Governed by the callee's OWN state covenant (self-pin), which enforces its declared transition. No unconstrained default. |
| L3-3 resource value/capability | Same - the callee covenant governs its full state; the caller cannot rewrite it. |
| L3-4 real contract composition | DONE - proven with real, separately compiled contracts (2-party, 3-owner, transitive), mock + regtest. |
| L3-5 invocation/intent/result | The native call binds selector (the dispatched method), forwarded args, and the authenticated return - complete invocation semantics, inherited. |
| L3-6 resource authority | Native self-pinned state; hostile over-debit reverts, proving authority under composition. |
| L3-7 controller identity | Exact address pinning (self-pin + `extcall-target-pinning`), not a public salt prefix. |
| L3-8 deployability | Proven on a live BCHN regtest node (6/6). Standard p2sh32 + CashTokens shapes. |
| L3-9 typed API | The native typed `IContract(addr).method()` + `withExternalCall`, not raw `appBody`/`valueExpr` source strings. |

## Scope of the homogeneous scaffold (`src/layer3`)

The `src/layer3` module (the generated `__layer3_bind` covenant + `TranscriptSpec`) is an EXPERIMENTAL
research artifact for one specific shape the native STAR model does not give: N-party MUTUAL authentication,
where peers authenticate EACH OTHER in canonical order rather than one caller authenticating callees. Its
audit findings L3-2/L3-3 are now fail-closed and L3-1 is partially closed, but it remains experimental and
is NOT the bus. For real applications, compose real contracts as above.

## N-party participant-SET binding (membership only - NOT the bus)

`generateControllerBoundCovenant` binds N HOMOGENEOUS clone participants to ONE controller-attested address
SET: a co-spent CONTROLLER NFT commits `sha256(ordered participant locking bytecodes)`, and every participant
reconstructs that root and requires the match, rejecting injected/disjoint participants
(`Layer3NPartyMutual.test.ts`, 5/5). This is a building block, not the message bus. Per the re-audit
(`layer3-production-reaudit.md` R2/R3), it commits WHO the participants are, NOT what they execute - there are
no calls, selectors, arguments, results, resources, events, or ordering in the root, and the participants are
clones of one generated covenant, not independently compiled heterogeneous contracts. It also relies on the
external assumption of a single immutable mint-once controller NFT (no genesis/uniqueness proof here, R7).

## What remains for a general cyclic heterogeneous bus (re-audit required path)

NOT implemented: a canonical, domain-separated EXECUTION transcript root covering calls/args/order/results/
resources/events (R2); binding independently compiled HETEROGENEOUS participant covenants to their
projections of that root (R3); a real mint-once controller genesis + uniqueness proof (R7); repeated
settlement of one physical callee UTXO and the smallest heterogeneous cycle A->B->A (R3); N-party live-node
lifecycle + mainnet standard-policy acceptance (R8); and independent covenant review (gate 5). The honest
status: native ACYCLIC star/chain composition works for the tested shapes and is regtest-proven; N-party
membership binding is experimental; the general cyclic heterogeneous bus is NOT implemented.
