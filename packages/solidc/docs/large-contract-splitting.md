# Fitting large contracts into BCH VM limits — brainstorm

> The normative implementation sequence and release gates are in
> [`large-contract-splitting-implementation-plan.md`](./large-contract-splitting-implementation-plan.md).

Status: **living design doc / brainstorm**. Captures the problem, the strategy space, a worked design for
function-facet splitting, its soundness argument, and open questions. Driven by Unicrow (23,726 B after the
2026-07-21 coalescing passes, still 2.4x the per-input limit).

## 1. The wall

Per BCH consensus + standardness, applied per SPENDING input:

- **`MAX_INPUT_BYTESIZE = 10,000` bytes** (`packages/solidc/src/constants.ts`) — an input's evaluated bytecode
  (the P2SH32 redeem script + its unlocking data) must be <= 10 KB. This is the hard wall. A larger contract's
  UTXO simply cannot be spent (`unlocking bytecode exceeds maximum 10000 bytes`), and its deploy PROBE can't run
  even one step (see §2).
- **10,000-byte stack element limit** — no single stack item may exceed 10 KB (the 2025 VM-limits value; matters
  for whole-struct blobs and the ecrecover side-car, already tuned to ~9950 B).
- **Operation-cost budget** ∝ the spending input's bytecode length (2025 CHIP). A 10 KB input buys ~10 KB worth of
  op budget; splitting does not change the per-op cost, only caps how much runs per input.
- **Hashing limit** ∝ input length — heavy C2 (sorted-mapping) hashing competes for this budget.
- **Control-stack depth 100** — bounds recursion / nested OP_INVOKE (see internal_fn_recursion memory).
- **Standard tx size ~100,000 bytes** — bounds the WHOLE transaction (all co-spent inputs + outputs together).

Only the first is the splitting driver. The tx-size cap is the ceiling on how many facets/state pieces one call
may co-spend at once.

## 2. Where Unicrow stands

Whole locking script: **23,726 B** (post Pass 1/2). Deploy probe (covenant + ctor args + state derivation):
~32,404 B — which is why `StatefulContract.deploy` currently dies in `_deriveDeployCommitments` (the VM probe
can't run a >10 KB unlocking script). See ea_deploy_wall memory.

Per-function bodies (post-optimization), all **well under 10 KB**:

| fn | B | | fn | B |
|---|--:|---|---|--:|
| refund | 5,683 | | getAllEscrowData | 1,430 |
| pay | 2,948 | | setClaimed | 1,220 |
| release | 2,691 | | splitCalculation | 1,094 |
| settle | 1,632 | | (11 more) | < 1,000 each |
| challenge | 1,578 | | | |

**Key observation:** no single Unicrow function is over the limit. The 23.7 KB is the SUM of all function bodies +
one shared dispatcher + shared covenant/subroutine machinery packed into one script. So Unicrow needs *partitioning*,
not *intra-function* splitting. That makes it the tractable first target.

## 3. Strategy space

- **S1 — Compression** (reduce total bytes). Subroutine extraction (done, -60%), the coalescing passes (done, -26%),
  more cross-function dedup / peephole. NECESSARY (smaller facets) but INSUFFICIENT alone: Unicrow would need another
  ~2.4x, unrealistic. Keeps helping in combination.
- **S2 — State-local function-facet splitting** (the main answer). First form complete call closures, then group by
  conservative state/effect interference and locality before applying the <=10 KB pack. Disjoint state domains are
  natural split boundaries; state/effect-free code can be duplicated or isolated subject to return-channel rules.
  Every facet still shares one state UTXO. Detailed in §4.
- **S3 — Library extraction** (dedup the shared machinery pulled into every facet). Complements S2; §5.
- **S4 — Computation splitting** (one function that is itself >10 KB). The general frontier; not needed for Unicrow.
  §6. SolidCash already does a bespoke instance of this: the ecrecover compute side-car splits a >10 KB computation
  across co-spent inputs passing results by commitment.

## 4. S2: function-facet splitting (a compiler-generated Diamond)

**Major finding (mechanism survey):** SolidCash's docs ALREADY name this exact use case —
`library-contracts.md:102-124`: "a contract that exceeds BCH script limits can be split across [branded delegate
library UTXOs]... the BCH analogue of working around EVM's 24 KB code-size cap," governed by the one hard rule
"a transaction can only read the bytecode of inputs it SPENDS (`OP_UTXOBYTECODE`), so using library code means
either embedding it (inline) or co-spending the UTXO that holds it." And the delegate-library machinery that makes
it work — proxy-master + branded delegate + state retargeting — is already shipped. So S2 is NOT a new covenant
model to invent; it is **automating a per-function Diamond on top of the existing delegate-library primitive.**

### 4.1 Model — proxy master + per-function delegate facets

Map the monolith to the EVM Diamond, implemented with today's `library` + `{brandLibrary:true}` machinery:

- **Proxy master** (= the state authority, the existing stateful "master" minting NFT, capability `0x02`, category
  `C` = genesis funding-UTXO txid). Holds the serialized state (data/entry/chunk NFTs, unchanged) and a THIN
  *forwarding* function per split function. Its script = N thin forwarders + the shared covenant. Must be <= 10 KB.
- **Facets = branded delegate libraries** (one `library` per function, or per size-bin). Each holds one Unicrow
  function's body as a `delegate` entry, <= 10 KB. `{brandLibrary:true}` bakes the proxy's category as a synthesized
  `bytes32 __brand` and the facet pins the co-spent proxy master's category `== __brand`
  (`GenerateTargetTraversal.ts:1743-1750`) — so a facet is spendable ONLY alongside its owning proxy. Persistent
  (self-preserving master), reusable per call.

Today the proxy master's script IS the whole 23.7 KB contract. The split moves each function's body OUT into its own
delegate facet and leaves the master holding only state + thin forwarders.

### 4.2 Calling a function

To call `refund(id)` the tx co-spends `in0 = proxy master`, the proxy data/entry NFTs `refund` touches, and
`inK = refund facet master`. The proxy's `refund` forwarder does `delegatecall` into the facet; the facet's delegate
function runs against the PROXY's state via the existing `_proxyMasterIndex` retargeting
(`emitMasterInputIndex:16092-16103` reads the proxy index off the altstack, so every `this.field` write pins the
PROXY's NFTs, not the facet's). Outputs: the updated proxy state + the re-created (self-preserved) facet master. This
is exactly today's delegatecall spend, one facet per function. SDK auto-derivation (VM-probe the covenant) applies.

### 4.3 Security model (the crux) — reuses shipped, audited bindings

Every link below already exists and is tested; the split just composes them.

**Q1 — what authorizes a facet to touch the state?** Two independent locks, both shipped:
(a) the facet's `__brand` pins the co-spent proxy master's category `== C` (`GenerateTargetTraversal.ts:1743-1750`),
so a facet only ever operates on ITS proxy; and (b) the proxy's forwarding function is what invokes the delegatecall
and preserves its own master, so a facet cannot act without the proxy's own script consenting on that spend. The
delegate is the sole state authority and the proxy forwarder must NOT write state itself
(`delegatecall-security.md`), so authority is unambiguous.

**Q2 — what stops a malicious/foreign facet?** The proxy delegatecalls a SPECIFIC facet address
(synthesized `__libAddr` link value), checked `OP_UTXOBYTECODE(inK) == addr` + minting-capability `0x02`
(`emitExternalCallVerification:15028-15062`). A fabricated UTXO at that address is unspendable because the real
facet self-pins its own category. So `addr => genuine facet code`. Facets are fixed at deploy (their addresses are
baked into the proxy), == the audited function set.

**Q3 — cross-contract confusion?** The facet `__brand` == proxy category, and the proxy self-pins category `C`
(`Contract.ts:217-221`). Contract A's facet cannot bind to contract B's proxy (brand mismatch). Shipped.

**Q4 — persistence?** The facet master self-preserves (LBC/value/category/commitment/FT-amount + capability `0x02`,
`emitDelegateSelfPreservation:16111-16186`), so it is reusable indefinitely — the existing delegate behavior.

**Q5 — atomicity / multi-piece state?** All touched proxy NFTs are co-spent in one tx; the delegate pins each via the
retargeted `emitMasterInputIndex`. The multi-data-NFT `nftIndex` tag (`state.ts:885`) fails closed on register
permutation. The tx-size cap (§1) bounds the fan-out.

**Q6 — external calls / reentrancy?** Unchanged: the facet does `IUnicrowArbitrator(addr).setArbitrator(...)` via the
external-call co-spend + `OP_UTXOBYTECODE == addr` pin, exactly as the monolith did.

**Soundness reduction.** Observationally equivalent to the monolith iff: (1) facet set = function set, addresses baked
into the proxy at deploy; (2) each facet is the audited function's delegate + self-preserves; (3) the proxy is the
sole state authority and only its forwarders delegatecall facets; (4) facet `__brand` == proxy category `C`; (5) all
touched state co-spent atomically. Each clause is an ALREADY-SHIPPED delegate/external-call invariant. No new trust
beyond "the compiled functions are correct."

### 4.4 Internal forward vs. external call — soundly distinguished

A split tx co-spends TWO kinds of foreign UTXO: **internal shards** (this contract's own function facets, which share
the proxy's state) and **external contracts** (foreign callees with their own state). They must never be confused —
an external contract must never gain write-access to our state, and an internal facet must always land its writes on
the proxy. The distinction is **static + cryptographic, never a runtime guess:**

- **Static call kind.** Every cross-UTXO site is emitted at compile time as a `delegatecall` (internal shard) or a
  `call`/read (external). No runtime code inspects a co-spent UTXO to decide "internal or external?"; the site's kind
  is fixed in the opcode sequence.
- **Internal shard = delegatecall + retargeting + brand + baked link address.** The proxy delegatecalls a SPECIFIC
  baked facet address (`OP_UTXOBYTECODE(inK) == addr`, cap `0x02`); the facet is brand-bound (`__brand == proxy
  category C`); it writes the PROXY's state via `_proxyMasterIndex` retargeting. The proxy master cannot be spent
  without co-spending + delegatecalling the correct facet.
- **External call = call/read + NO retargeting + self-pinned foreign category + address pin.** The facet pins the
  callee by address (`OP_UTXOBYTECODE(inM) == addr`); the callee self-pins ITS OWN category and mutates ITS OWN state;
  we only read its committed return (return-event NFT). With no retargeting it can never touch our state.
- **The one invariant (the gate).** RETARGETING — write-access to our state — is granted EXCLUSIVELY via delegatecall
  to a brand-bound, baked-address facet. Every external interaction is a call/read to a self-pinned foreign category
  with no retargeting. So the write-blast-radius of our state is exactly our own audited facets and nothing else —
  the monolith's guarantee, made cryptographic across the input boundary.
- **Untrusted indices, baked checks.** Input indices are SDK-provided witness; each is verified against a BAKED
  constant — facet address + brand for an internal shard, foreign address + its own self-pin for an external call.
  Mispointing the "facet index" at a foreign UTXO fails the facet-address/brand check; mispointing the "external
  index" at our facet fails the foreign-address check. Attacker-chosen indices cannot swap a role.
- **Isolation both ways.** Symmetrically, our facet's external call gets NO write-access to the callee's state (the
  callee self-authorizes its own transition). We cannot corrupt their state; they cannot corrupt ours.

Reduction: this is exactly the monolith's *function vs. external-call* distinction (own code writes own state;
external calls only exchange values), lifted across UTXOs as *delegatecall-brand vs. call-address-pin*.

**Pinned v1 inter-facet rule:** there is no runtime facet A -> facet B edge. The current compiler explicitly rejects
a `delegate` function containing delegatecall because the nested path would skip required state-covenant and
self-preservation checks. Treating B as a regular call would instead select B's own state, not the proxy's. The
splitter therefore colocates the complete stateful helper/call closure with its entry point, collapses recursive
strongly connected components, and duplicates only helpers proven pure. A public-to-public internal call also forces
colocation. If the resulting closure exceeds 10 KB, compilation fails rather than inventing a nested interaction.
External self-calls are rejected because the root UTXO is already consumed. Calls to a DIFFERENT contract, including
another split contract, remain ordinary calls to that contract's proxy/category. Atomic multi-operation composition
requires a dedicated entry point whose closure fits in one facet; otherwise users compose calls across transactions.
The normative rules and future nested-delegate proof obligations are in the implementation plan.

Runtime same-state composition, if added, must use authenticated messages rather than pretend separately evaluated
inputs share sequential memory. Producer facets constrain intent messages; exactly one settlement facet is the
delegate/state controller, folds the complete canonically ordered message set over the proxy pre-state, and authors
the sole proxy output. The root commits participants; messages bind destination proxy, logical call, source facet,
sequence/nonce, operation, global slot, and value/payload digest. Completeness, replay protection, conflict handling,
payload binding, and whole-transaction size are new proof obligations. Until experiment A4 passes, this is disabled
and v1 colocates logical call closures.

### 4.5 What is genuinely NEW vs. already shipped

Shipped: the delegate retargeting, brand pinning, self-preservation, external-call address pin, category-`C` genesis
identity, multi-NFT state, auto-derivation. NEW work is mostly COMPILER + SDK plumbing, not covenant design:
- **Auto-extraction:** split the monolith AST into one delegate `library` per function + a thin proxy of forwarders
  (today the developer writes `library` + consumer by hand). Bin-pack functions so each facet AND the proxy are <= 10 KB.
- **A hard size gate + auto-split trigger** — MAX_INPUT_BYTESIZE is currently only a CLI `console.warn`
  (`solidc-cli.ts:65`); nothing blocks or splits a >10 KB artifact before broadcast.
- **Lifting delegate-library limits** that block full functions as facets (§4.8).

### 4.6 Deploy also gets fixed

The current deploy wall is that the 32 KB probe can't run to derive initial state commitments. After the split:

- The proxy master's covenant is now state + thin forwarders (<= 10 KB) — the deploy probe runs.
- Facets are created as plain P2SH32 outputs at genesis (an output only needs the 32-byte script hash; the <= 10 KB
  facet script is NOT executed at creation, only when later spent). So genesis stays within limits.

So S2 resolves BOTH the runtime spend wall and the deploy-probe wall.

### 4.7 Compiler + SDK automation

**When does the split trigger? (is >10 KB automatically a proxy?)** Intended default: the hard `MAX_INPUT_BYTESIZE`
gate TRIGGERS the split when a contract would exceed 10 KB and is partitionable into <= 10 KB facets. But it is NOT a
free/transparent transform, so it applies only above the threshold and with escape hatches:

- **Only when partitionable.** If a SINGLE function exceeds 10 KB, function-facet splitting cannot help — that needs
  S4 (intra-function, §6) or a manual refactor. The packer must ERROR (not silently produce an unspendable facet) if
  any one function facet won't fit.
- **The proxy must also fit <= 10 KB.** With enough functions, the thin forwarders + covenant overflow the proxy
  itself. Then the proxy must split too: a hierarchy of sub-proxies, or a state-resident facet REGISTRY
  (selector -> address mapping, the true Diamond) instead of static forwarders. So there is a function-COUNT ceiling,
  not just a per-function ceiling.
- **It changes the observable shape.** A split contract is N+1 UTXOs with a multi-mint genesis, more co-spent inputs
  per call, and new addresses (a proxy address + facet addresses). The SDK abstracts it, but cost / latency / tx-size
  differ, so you do NOT split a contract that already fits (the proxy + delegatecall overhead is not worth paying
  below the threshold). A developer opt-out / explicit partition override is advisable for cost tuning.
- **Not yet built.** Today a >10 KB contract only WARNS (`solidc-cli.ts:65`) and fails at broadcast; auto-split is the
  proposed design, not current behavior.

- **Compiler** (`compileStringMulti` already emits an ArtifactMap, `compiler.ts:160-233`): add a "split" mode that
  bin-packs functions into facet libraries <= (10 KB - forwarder/brand overhead), and emits N facet artifacts + the
  thin proxy artifact + a manifest (category-`C` derivation, facet addresses baked into the proxy forwarders, per-facet
  state footprint). Facets reuse the existing delegate-library + brand machinery; the proxy is generated forwarders.
- **SDK** (`StatefulContract`): deploy = genesis mint of `C` + proxy master + facet masters (the `deployFrom` path
  already mints children whose category = `fundingUtxos[k].txid`, `StatefulContract.ts:1775-1906`); call = pick facet,
  derive co-spent state (existing auto-derivation), build tx, self-preserve facet, update proxy state. `ContractBundle`
  can auto-register the graph (`multi-contract-artifacts.md:201-216`).

### 4.8 Delegate-library limits to lift (the real automation work)

Today's delegate libraries are a manual pattern with constraints that block using a full function as a facet
verbatim (`library-contracts.md:271-277`, delegatecall docs):

- **No synchronous return** — a delegate communicates only through shared state, no return channel. FINE for a facet
  that IS a terminal function (does its own state writes, returns nothing to the proxy). Blocks only the case where a
  forwarder needs a value back — which auto-split avoids by making each facet self-contained.
- **Shared-layout requirement** — the consumer's `StateLayout` must lead with the library's fields
  (`SynthesizeLibraryDelegateCalls.checkLayoutCompat` + SDK `assertDelegateLayoutCompatible`). Naturally satisfied
  when every facet is a function of the SAME contract sharing the SAME full layout; the compiler just emits the shared
  layout into every facet.
- **Positional/literal args only, couriered off-chain** — computed expressions / state-reads as delegate args throw.
  A facet takes the caller's own function args (from the tx), so the proxy forwarder forwards params it received — no
  computed args. Needs verification per-function that Unicrow's signatures forward cleanly.
- **Mid-body value-returning `r = L.f(x)` and arbitrary mid-body splitting are DEFERRED** — these are the frontier for
  splitting INSIDE a function (S4), not needed for whole-function facets.

So the covenant primitives are ready; the automation is (a) AST extraction into facets + forwarders, (b) the size
gate/packer, (c) confirming each function forwards cleanly under the arg/return/layout rules above.

### 4.9 Governance / upgrades

Immutable facet set = no logic upgrades (only state changes like `updateEscrowFee`, ordinary transitions). For
upgradable logic, retain a governance-gated minting-capability NFT under `C`: a `diamondCut`-style function mints a
replacement facet / rebakes a forwarder's `__libAddr`. The UTXO analog of EIP-2535 `diamondCut`; widens trust to
"governance can change the facet set" — opt-in. Note the proxy master is a single chained UTXO, so ALL transitions
serialize through it (the contract's throughput ceiling) — an inherent property of shared mutable state, unchanged by
the split.

## 5. S3: library extraction (dedup shared machinery)

Every facet embeds the shared covenant machinery (state read/verify, C2 exclusion proofs, `_msgSender`, math
helpers). If that is several KB, N facets multiply it — each facet stays <=10 KB, but genesis/aggregate size grows.

Possible future mitigation: hoist shared machinery into a compute sidecar. It cannot be a nested delegate library in
v1: a delegate facet containing delegatecall is rejected and would have unsound covenant/self-preservation semantics.
Any cross-input result must use the authenticated message/settlement protocol above, or the code remains duplicated
within each facet. S3 therefore depends on A4 rather than being an already-available optimization.

## 6. S4: computation splitting (single function > 10 KB)

The general frontier, not needed for Unicrow. When ONE function exceeds 10 KB it must be split across co-spent inputs
that pass intermediate results by commitment (each input verifies the previous input's committed output and continues).
SolidCash already has a working, audited instance: the **ecrecover compute side-car** splits a >10 KB secp256k1
computation across inputs, binding them with `OP_UTXOBYTECODE` integrity so a later input cannot lie about an earlier
one's result. Generalizing this into an automatic "continuation-passing" split (chunk a basic-block sequence, thread a
committed continuation state) is the hard, open research item. Soundness hinges on the same integrity primitive: each
segment must cryptographically pin its predecessor's committed outputs so the chain cannot be forged or reordered.

## 7. Relation to EVM

EVM Unicrow runtime is 13.5 KB — under EIP-170's 24 KB code cap, so EVM needs no split. For contracts that DO exceed
24 KB, EVM uses the **Diamond pattern (EIP-2535)**: a proxy + facets sharing storage via `delegatecall`. S2 is the
UTXO analog: facets share state via a co-spent state UTXO + covenant instead of a shared storage context. The
security models differ in mechanism (delegatecall storage-context vs. co-spent-covenant + CashToken category) but
match in shape (fixed/governed facet set, shared state, per-facet logic).

## 8. Open questions / hard parts

- **Shared-machinery duplication** vs. **library-facet overhead** (§5) — measure the C2 machinery's per-facet cost to
  decide the threshold.
- **Per-facet op-cost + hashing budget** — a <=10 KB facet buys a smaller budget than a 10 KB monolith slice; verify
  refund/challenge (heaviest C2) fit. (The monolith ran them fine when routed, and the budget scales with input size,
  so likely yes — needs a VM check.)
- **Cross-facet internal calls** — the packer must keep a function and every internal helper it calls in the SAME
  facet, or fall back to a library-facet delegate. Detect the call graph; bail (keep together) when in doubt.
- **State-piece fan-out** — a function touching many mapping chunks may exceed the tx-size cap co-spending them all;
  may need pagination / multi-tx (the C2 pagination design already contemplated in evm_storage_parity).
- **Thin state-covenant template** — exact opcodes for "require a co-spent `C`-facet + preserve category on the state
  output"; must itself be small and provably non-bypassable.
- **Genesis atomicity** — minting N+1 category-`C` outputs in one tx within standard limits; ordering/derivation of
  facet addresses (they depend on their own scripts, which depend on `C` if they pin it — resolve the fixpoint like
  the current self-pin does).
- **Determinism of the packer** — bin-packing must be deterministic (reproducible addresses) and stable across
  compiles (a function moving facets changes an address).

## 9. Incremental plan

Because the covenant primitives are shipped, the plan is measure -> hand-prototype the existing primitive -> automate.

1. **Measure.** For each Unicrow function, compile it as a standalone delegate `library` facet (body + delegate
   prologue + brand) and record its size; compile the proxy (N thin forwarders + covenant). Confirm every facet AND
   the proxy clear 10 KB. Also measure how much of each facet is the shared C2 machinery (decides S3).
2. **Hand-split a toy 2-function stateful contract** into a proxy + 2 branded delegate facets using TODAY's `library`
   machinery; VM-prove: both functions mutate shared state correctly, a foreign-brand facet is rejected, the proxy is
   sole state authority, deploy probe runs. This validates the whole model on shipped code with zero new covenant.
3. **Confirm forwarding cleanliness** (§4.8): verify each Unicrow function's args/return/layout forward through a
   delegate without hitting the no-return / computed-arg / shared-layout limits; list any function that needs a lift.
4. **Compiler split mode** — auto-extract functions into delegate-library facets + generate the proxy forwarders +
   emit the manifest; add the hard `MAX_INPUT_BYTESIZE` gate that TRIGGERS the split instead of just warning.
5. **SDK deploy/call** — genesis mint the proxy + facet masters (extend `deployFrom`); per-call facet selection +
   co-spend derivation (reuse auto-derivation); run the REAL Unicrow through it end to end.
6. **S3 library facet** for the C2 core if step 1 shows costly duplication across facets.
7. **S4** (intra-function splitting) — separate research track, seeded by the ecrecover side-car pattern.

## 10. Existing building blocks (precise refs, from the mechanism survey)

The split names itself in the docs already — `library-contracts.md:102-124` (large-contract split == BCH analogue of
the EVM 24 KB cap) + the one hard rule "you can only read the bytecode of inputs you SPEND." Concretely:

- **Delegate library = code-in-a-separate-UTXO on shared state** — `library-contracts.md`, `delegatecall.md`,
  `delegatecall-security.md`. Prologue + retargeting in `GenerateTargetTraversal.ts`: delegate prologue `:1726-1775`
  (saves proxy index to altstack, verifies capability `0x02` + proxy self-preserve + `proxyMasterIndex != INPUTINDEX`);
  `emitMasterInputIndex:16092-16103` (the ONE chokepoint that swaps `OP_INPUTINDEX` for the altstack proxy index, so a
  delegate writes the PROXY's state); `emitDelegateSelfPreservation:16111-16186`; brand pin `:1743-1750`. Desugar:
  `SynthesizeLibraryDelegateCalls` (`__libAddr_L` link param + `checkLayoutCompat`); SDK
  `assertDelegateLayoutCompatible` (`StatefulContract.ts`). **Limits:** no return channel, shared-layout, positional/
  literal args, mid-body splitting deferred (§4.8).
- **External contract calls** — `external-contract-calls.md`, `extcall-target-pinning.md`. `addr` == 35-byte P2SH32
  LBC; `emitExternalCallVerification:15028-15130` (`OP_UTXOBYTECODE(inK)==addr`, selector check, category preserve,
  cap `0x02`); master-free reads `emitExternalReadVerification:14928-14973`; self-pin prologue baked by SDK
  `Contract.ts:216-222`; returns via a co-spent return-event NFT `:15602-15654`.
- **State model + auto-derivation** — `auto-derivation.md`, `sorted-mapping-c2.md`, `dynamic-storage.md`. Master
  minting NFT (cap `0x02`) at input 0 serializes transitions; data NFTs (registers, `commitmentLimit` default 128 B)
  bin-packed; entry/chunk NFTs (heap) growable. Covenant builders `state.ts:buildDataNftCovenantScript:35-159`,
  `buildEntryNftCovenantScript:1391-1465`; multi-NFT `nftIndex` tag `state.ts:877-885` (permutation fails closed).
  Category `C` == genesis funding-UTXO txid, `fundingUtxo.vout===0` (`StatefulContract.ts:1287-1306`) — CREATE2-like,
  pre-computable. `deployFrom` mints children per `fundingUtxos[k].txid` (`:1775-1906`). Transition derived by
  VM-probing the real covenant (`_deriveFullTransactionState:2898`).
- **Subroutine extraction** — `subroutine-extraction.md`. `OP_DEFINE`/`OP_INVOKE`, >=2 uses -> define once (-60.7% on
  HIGHLIGHT). **Shares stack WITHIN one script evaluation only** — does NOT cross the input boundary (that is the
  delegate-library job). Master-family subs bake `OP_INPUTINDEX`, gated `!isDelegate`.
- **Multi-contract artifacts** — `multi-contract-artifacts.md`. `compileStringMulti`/`compileFileMulti` ->
  `ArtifactMap`; per-contract pipeline `compiler.ts:160-233`; branded delegate address =
  `address(libArtifact,[brand=libraryBrand(consumerCategory)])`; `ContractBundle.from(map,{provider})` auto-registers.
- **Deploy size wall NOT hard-enforced** — `MAX_INPUT_BYTESIZE` (`constants.ts:1`) is used ONLY as a CLI
  `console.warn` (`solidc-cli.ts:65-66`); `compileString`/`compileFile` and the SDK return/accept a >10 KB artifact
  silently. The hard failure is at broadcast. So the split (and a hard gate) must be a design-time addition.
- **Cross-input introspection vocabulary** (`GenerateTargetTraversal.ts` + `state.ts`): `OP_UTXOBYTECODE` (44,
  address identity), `OP_OUTPUTBYTECODE` (37, self-preserve), `OP_UTXOTOKENCATEGORY`/`OP_OUTPUTTOKENCATEGORY` (68/52,
  self-pin + capability), `OP_UTXOTOKENCOMMITMENT`/`OP_OUTPUTTOKENCOMMITMENT` (32/32, state read/write/return),
  `OP_INPUTINDEX` + `emitMasterInputIndex` (the delegate-vs-self chokepoint), `OP_TXINPUTCOUNT`/`OP_TXOUTPUTCOUNT`,
  token-amount/value preservation. Everything the split needs is in this set.
