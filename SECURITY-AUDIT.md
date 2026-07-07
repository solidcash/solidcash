# SolidCash Security Audit (2026-07)

> **Status:** COMPLETE (2026-07). All 6 domains audited + serious findings verified. This file is written to
> survive a session reset — a fresh session can read it to regain full context.
>
> **4 CRITICAL: C1 (delegatecall), C2 (mapping omission), C3 (un-accessed NFT destruction), C4 (mapping-key
> collapse).** Plus 8 HIGH, 4 MEDIUM, and LOW findings. **Top fixes: C1, C2, C3, C4.**
>
> **To resume in a fresh session:** read this file top-to-bottom, then (1) fold in any covenant-codegen /
> semantic-analysis findings (see "PENDING" at the end), (2) verify the not-yet-code-verified items, (3) the
> top priorities to FIX are **C1 (delegatecall)** and **C2 (mapping omission)**.

## REMEDIATION STATUS (2026-07, branch solidcash_v0.13.1)
All 4 CRITICAL fixed + regression-tested (`packages/solidc/test/SecurityAudit.test.ts` + Stateful e2e):
- **C4** FIXED (e5c5d0d0): `canonicalizeExpression` now operand-injective (explicit composite-key cases +
  generic structural fallback + hard-reject operand-less). Distinct struct-field/keccak keys -> distinct slots.
- **C1** FIXED (44bead84 warning; then hardened e3db4490 / 5581227c / 8849bb79 / e17f24e5 / a2eecc50 after a
  design review): a delegatecall function may not self-mutate (`DelegatecallSelfMutationError` - the delegate owns
  all writes); the delegatecall path conserves the proxy's own-category state NFTs (un-touched data NFTs can't be
  destroyed); and for a **covenant** `impl` the covenant FORCES + PINS the delegate co-spend
  (`OP_UTXOBYTECODE == impl`, identity) + the forwarded selector (which-function), so {proxy master, data NFT
  flag=1} with no delegate is rejected. VM-proven; `withDelegatecall` auto-fills the witness. A P2PKH-placeholder
  `impl` is unpinnable (a P2PKH UTXO authorizes nothing) and keeps the compile-time warning - use the delegate's
  real covenant address. Docs: `docs/delegatecall-security.md`, `docs/delegatecall.md`, `docs/upgrades.md`.
- **C3** FIXED (ea67656f): `emitOwnCategoryMutableNftConservation` pins the count of co-spent C-mutable(0x01)
  NFTs input==output for gated (non-entry/dynamic/deploy) functions -> un-accessed NFT DESTRUCTION rejected at
  VM (e2e-proven). Residual: flag=1 balanced-output corruption (needs per-NFT commitment pin).
- **C2** FIXED-mitigated (daeaa39d): compile-time warning on negative mapping guards
  (`require(!m[k])`/`==0|false`). Full soundness needs an entry-set accumulator. Docs:
  `docs/mapping-omission-security.md`.
  - **Lineage (recorded 2026-07):** this gap is inherent to the entry-NFT model since the `future` branch
    (code-traced: `emitSlotExistsCheck` + `OP_ELSE` default, `emitMintingNftUniqueness` counts only the `0x02`
    master, no `0x01` conservation, no per-mapping entry count). The `SECURITY_AUDIT_2026_03_06.md` pass called
    the covenants "well-designed" because it verified entry **integrity-when-present** (correct) but its threat
    model was entirely **presence-based** (injection / forgery / drain / downgrade) with no absence/omission
    class - it even treats "not included as inputs -> can't be modified" as a *safety* property, the inverse of
    this attack. Omission is the structural blind spot of covenant auditing. Not a rework regression; our C3
    conservation loop (absent in `future`) was a net improvement on the sibling destruction vector.
  - **Sound solution (proposed):** positive guards already sound (fail-safe, O(1), scales); consume-once +
    provisioned eligibility -> **nullifier** (spend a unique UTXO, consensus double-spend enforces once-ness, O(1)
    identity pin, no accumulator); persistent readable negative flags / lazy unbounded negative guards ->
    **authenticated set** (master commits a sorted/indexed-Merkle root, non-membership proof per read, O(log N) -
    EVM's storage-trie model, caller supplies the witness). Diagnostic escalates warning -> error unless a
    negative-guarded mapping is nullifier- or accumulator-backed (fail-closed). Full design + phasing in
    `docs/mapping-omission-security.md`.

All 8 HIGH fixed + regression-tested:
- **H1** FIXED (cc09895d): multi-data-NFT self-reads now `emitNftIndexTagVerify` (were Skip) - swapped-sibling
  substitution fails the tag OP_EQUALVERIFY.
- **H2** FIXED (1b555980): single-return external call enforces return-event uniqueness (count category-C
  none-cap OP_TRUE outputs == 1) - forged twin return event rejected. Residual: multi-same-category calls.
- **H3** FIXED (5d714ff8): relational-NOT rules ordered before OP_NOT OP_IF - `if (!(a<b))` compiles.
- **H4** FIXED (86079ecf): multiCall change defaults to the funder's LBC, never OP_TRUE.
- **H5** FIXED (d457521b): fallback/receive routed through expandModifiers - guard modifiers no longer dropped.
- **H6** FIXED (7db06106): bounded int/enum/fixed entry params range-checked (emitIntBoundsCheck) - negative-uint
  injection rejected.
- **H7** FIXED (115f9aab): value arg not aliased when the callee writes its name (isWritten covers StateAssign) -
  copy semantics preserved.
- **H8** FIXED (7dbbbad9): the 4 inline passes refuse to inline same-name same-arity overloads
  (AmbiguousInlineOverloadError) - no wrong/unguarded body spliced.

All 4 MEDIUM fixed:
- **MD1** FIXED (85f71b6b): external-call selector baked as a compile-time constant (was a spender witness).
- **MD2** FIXED (371cd0b8): compat cross-check extended to referenced contracts + per-rule VM-equivalence tests.
- **MD3** FIXED (e7b8589c): fallback/receive get the locktime guard (InjectLocktimeGuard.visitContract override).
- **MD4** FIXED (df55cba4): un-invoked parameterless parent constructors inlined (implicit base-ctor call).

LOW: actionable ones FIXED - odd-length hex warning corrected to "zero-extended" (was "dropped"); SIGHASH
NONE/SINGLE/ANYONECANPAY now warns (L5); bounded int literals range-checked (uint8 x = 1000 rejected). Verified
already-sound / accepted (no code change): L2 indexer trust; L3 bitauthUri keys (already non-enumerable + off the
message, incl. subclasses); L4 fee cap (per-byte cap present, absolute cap opt-in); master-commitment state-path
(no impact - state on data NFTs, defense-in-depth); nested-keyed-lvalue drop + state decode malleability
(fail-closed/SDK-misread only).

Regression tests: `packages/solidc/test/SecurityAudit.test.ts` (40) + `packages/utils/test/optimisation-
equivalence.test.ts` (102) + Stateful/InlineLoopDispatch e2e.

## Scope & method
Full-codebase audit of the SolidCash BCH smart-contract compiler (`packages/solidc`), SDK
(`packages/solidcash`), and shared utils (`packages/utils`). Six domains audited by parallel read-only
security agents; the auditor (main session) then **adversarially verified** the serious findings in code.
Domains: (1) covenant codegen, (2) semantic analysis, (3) parsing/optimizer, (4) SDK tx building,
(5) state encoding + auto-derivation, (6) external calls + delegatecall.

## Threat model
The compiled **P2SH covenant Script is the only on-chain security boundary.** A malicious spender builds
their **own** transaction and will craft anything that passes Script verification; the SDK is a convenience,
not a boundary. State lives in BCH token **NFT commitments**; a contract **self-pins its token category**
(a forged UTXO of a different category is unspendable at the contract address). Every invariant
(state preservation, value conservation, access control, contract/target identity, which-function) MUST be
enforced by the emitted Script. "VERIFIED" below = auditor confirmed in code; "Agent-reported" = argued by an
audit agent, root cause confirmed but full exploit not independently PoC'd.

---

## FINDINGS BY SEVERITY

### CRITICAL

#### C1 — Delegatecall proxy: any spender rewrites proxy state arbitrarily  `[VERIFIED]`
- **Location:** `packages/solidc/src/generation/GenerateTargetTraversal.ts:1646-1709` (delegatecall epilogue);
  `packages/utils/src/state.ts:88-157` (data-NFT covenant, flag=1 write path 92-109 vs commitment check 124-128);
  `GenerateTargetTraversal.ts:8187-8200` (delegatecall low-level path is a no-op). Example/tests:
  `packages/solidc/test/valid-contract-files/proxy_delegatecall.scash`, `packages/solidcash/test/e2e/Delegatecall.test.ts`.
- **Vulnerability:** When `functionHasDelegatecall`, the epilogue emits ONLY master self-preservation +
  minting-uniqueness + value-preservation; every other check is gated `!functionHasDelegatecall` and SKIPPED —
  including `emitAutoCovenantVerification` (data-NFT commitment, 1666-1668) and `emitExternalCallVerification`
  (delegate identity, 1701-1702). The data-NFT covenant's flag=1 (write) path checks category + minting
  presence but NOT the output commitment (commitment preservation is only in the flag=0 read branch,
  state.ts:124-128) — it delegates commitment authorization to the master, which here skips it. The hardcoded
  delegate `impl` address is pushed then `OP_NIP`'d (dead); the delegate is never co-spent or compared.
- **Exploit:** A deployed delegatecall proxy holding valuable state; attacker spends the proxy master via
  `__fallback` (any non-empty input passes master self-preservation), spends the proxy data NFT with
  `[flag=1, masterInputIndex=0]` (passes category/minting/preservation; commitment unchecked), and emits the
  data NFT output with an **attacker-chosen commitment**. No delegate needed. Proxy state forged arbitrarily by
  anyone.
- **Fix:** On the delegatecall path, pin the co-spent delegate (`OP_UTXOBYTECODE(delegateInput) == impl`) and
  require it to supply/authorize the data-NFT commitment; do not skip commitment authorization unless a pinned
  delegate provided it. At minimum require `checkSig` on delegatecall-bearing fallbacks + document proxies as
  unsafe without a pinned delegate.

#### C2 — Mapping-entry OMISSION forces a default read (negative-guard bypass / replay / double-claim)  `[VERIFIED]`
- **Location:** `GenerateTargetTraversal.ts:8273-8341` (mapping read), `:8514-8549` (write),
  `emitSlotExistsCheck :527-536`. Confirmed **no entry-set accumulator** exists (no count/merkle/nullifier
  pinned in the master state).
- **Vulnerability:** A mapping read `m[k]` is gated by live introspection of whether a token sits at the entry
  slot's input index (`emitSlotExistsCheck` → `OP_IF` present / `OP_ELSE` absent). The **absent branch reads the
  type default** (`emitDefaultValue`: false/0/empty). A spender chooses which UTXO (if any) sits at that index,
  and BCH Script fundamentally cannot force a spender to reference a UTXO. There is no accumulator that could
  force an existing entry to be co-spent. On the write side, an omitted existing entry takes the "fresh entry"
  branch (`:8549`) and mints a DUPLICATE NFT for the same key.
- **Exploit:** Any negative-guard / one-time-write pattern:
  `require(!claimed[me]); claimed[me]=true; payout();` — an attacker who already set `claimed[me]` omits that
  entry NFT; the covenant reads `false`, the guard passes, a second `claimed[me]` NFT is minted. Repeatable →
  drain. Also `require(!blacklisted[u])`, `require(!hasVoted[u])`, nonce/replay maps. **This is a state-view
  forgery the covenant accepts.** Fail-safe for POSITIVE guards (`balances[k] >= amt` → omission → 0 → fails).
- **Root cause:** fundamental BCH constraint (a covenant cannot force a UTXO to be spent) + Solidity's
  "unset key = default" semantics. The authors already chose "absent = ERROR" for blockhash oracles for exactly
  this reason (`docs/block-and-transaction-properties.md:381-383,449-450`); mappings do the opposite.
- **Fix (increasing soundness):** (1) compile-time diagnostic when a mapping value feeds a negative guard /
  one-time-write; (2) commit an entry-set accumulator (count or merkle/nullifier root) into the master NFT and
  require inclusion/consumption proofs on read (redesign); (3) at minimum, document the limitation prominently.

#### C3 — Un-accessed same-category state UTXOs are destroyable/corruptible on any master-spending call  `[VERIFIED]`
- **Location:** `GenerateTargetTraversal.ts:9253` (`emitAutoCovenantVerification` iterates ONLY `compactOffsetMap`);
  `:1328-1332` (`compactOffsetMap`/`hasStateAccess` built from `accessedNftIndices` only); `:1657-1680` (data/entry
  verification gated on `hasStateAccess`/`hasEntryAccess`); `:11874-11994` (`emitMintingNftUniqueness` counts ONLY
  the master's `cat||0x02` minting — no 0x01 mutable count/set preservation; confirmed: the whole-tx
  `OP_TXINPUTCOUNT` loops are value-sum/fee only, all 0x01 checks are per-*accessed*-slot). Sub-NFT covenants:
  `packages/utils/src/state.ts:40-88` (data-NFT **flag=2 destroy** — gated only by minting-NFT presence + this input
  is C-mutable + output doesn't preserve C; NO master authorization), `:1294-1359` (entry-NFT **flag=1 write** —
  category + minting presence, no output preservation). Attacker tooling ships:
  `packages/solidcash/src/stateful/covenant-helpers.ts:263-276` (`createDestroyDataNftUnlocker` `[2n, masterIdx]`),
  `:292-307` (`createEntryNftUnlocker` `[1n, masterIdx]`). `flag`/`masterInputIndex` are unsigned data witnesses.
- **Vulnerability:** The master covenant never enforces that the multiset of category-C mutable (0x01) state UTXOs
  is preserved input→output — it re-creates only the *accessed* subset. Any *other* co-spent C data/entry NFT is
  invisible to the master covenant, and that UTXO's own covenant approves its destruction/mutation as long as a
  minting NFT of C is in the inputs (true on every state transition).
- **Exploit:** A contract with state on ≥2 data NFTs (or any mapping) and any attacker-callable function `f()` that
  does not access some NFT `X`: co-spend `X` with witness `flag=2, masterInputIndex=0` (destroy) or `flag=1`
  (entry write) → X's covenant passes (master present + X is C-mutable) with no/attacker output; f()'s covenant
  reads only accessed inputs; minting-uniqueness ignores 0x01. **Even single-data-NFT contracts** are hit via a
  function with `hasAnyStatefulAccess && !hasStateAccess` (event-/transfer-/deploy-/external-call-only, `:1657-1668`
  skips `emitAutoCovenantVerification`) or a guarded non-stateful function (`:1749`): it spends the master, so the
  attacker co-spends the lone data NFT with flag=2 and destroys ALL state. **Impact:** permanent state destruction
  / bricking (destroyed UTXO can never be re-created), arbitrary corruption of un-accessed fields/entries, and
  freeing the destroyed NFT's satoshis + FT amount (master value-preservation covers only accessed NFTs).
- **Fix:** The master covenant must pin the FULL set of C state UTXOs: (a) an all-inputs/all-outputs 0x01-of-C
  count-preservation loop (analogous to `emitMintingNftUniqueness`); and/or (b) co-spend + verify ALL data NFTs +
  all entries on every transition; and/or (c) remove the sub-NFT flag=2 destroy + output-free flag=1 paths except
  under `selfdestruct`, requiring the master to positively authorize each sub-NFT spend.

#### C4 — Distinct mapping keys collapse into ONE storage slot (state-write mis-targeting)  `[VERIFIED root + agent-reproduced]`
- **Location:** `SymbolTableTraversal.ts:3503-3504` (`canonicalizeExpression` lossy fallback
  `return \`expr:${node.constructor.name}\`` — NO operands); consumed by the entry-slot allocator
  (`collectEntryAccesses` slotKeys ~`:2400/2416/2438/2456`, `assignEntrySlotIndices` ~`:2548-2574`).
- **Vulnerability:** The entry-slot allocator groups mapping accesses by `slotKey = "<collection>:<canonicalizedKeys>"`.
  `canonicalizeExpression` has explicit cases only for a fixed node set (Identifier/StateAccess/Literal/FunctionCall/
  BinaryOp/UnaryOp/Cast/NullaryOp/Ternary/Slice/TupleIndexOp/ArrayAccess/MappingAccess/Instantiation). Every OTHER
  `ExpressionNode` subtype hits the operand-less fallback, so all keys of an unhandled type canonicalize to the
  SAME string. Two runtime-distinct writes get the same `entrySlotIndex`; the covenant allocates/verifies only ONE
  entry NFT for two distinct source-level entries. Affected key forms: **struct/contract field access
  (`FieldAccessNode`), `keccak256/sha256(abi.encode(...))`, `abi.encodePacked`, `bytes.concat`, `MethodCallNode`,
  `StringConcatNode`** — i.e. essentially every EVM composite-key idiom.
- **Reproduced (agent, built compiler):** `balances[t.from] -= amt; balances[t.to] += amt` (struct-field keys)
  compiles to **1** entry slot; the plain-param `balances[from]`/`balances[to]` correctly gets **2**. Same for
  `keccak256(abi.encode(a))` vs `(b)`, and in the native (non-solidityImportCompat) path. **Root cause
  independently VERIFIED** (the operand-less fallback at 3503-3504).
- **Exploit:** A token/AMM/vault keyed on composite/struct-field keys — `move(Transfer t, uint amt){ balances[t.from]
  -= amt; balances[t.to] += amt; }`: both updates resolve to slot 0, so the covenant enforces only one commitment;
  the debit is not independently constrained → an attacker satisfies the enforced credit without honoring the debit
  → **token inflation / theft**. Silent (clean artifact, no warning). Broad blast radius.
- **Fix:** Make `canonicalizeExpression` total and operand-injective (add FieldAccess/AbiEncode*/MethodCall/
  BytesConcat/StringConcat/… or structurally serialize operands in the fallback); as a safety net, hard-reject a
  mapping key whose canonical form is a bare `expr:<ctor>` with no operands rather than silently merging.

### HIGH

#### H1 — Multi-data-NFT swap: nftIndex anti-substitution tag skipped on self-reads  `[VERIFIED root; exploit per agent]`
- **Location:** `GenerateTargetTraversal.ts` `emitNftIndexTagSkip :7574` (NO check) used at self-read sites
  `:2508, :5511, :7820, :9286, :9967, :10124`; `emitNftIndexTagVerify :7583` (verifies) used ONLY at
  `:7921, :8098` (external/callee reads, gated `info.calleeMultiNft`). Data-NFT address is category-only
  (`state.ts:34`).
- **Vulnerability:** When state spans >1 data NFT, each commitment carries a leading `nftIndex` tag meant to
  stop a higher-index NFT being passed off as a lower one (they share one covenant address + category, addressed
  positionally). But the contract's reads of its OWN state SKIP the tag without checking it. Sibling data NFTs
  are addressed purely positionally (`OP_INPUTINDEX + compactOffset`); nothing pins "the NFT at offset k has
  tag k" on the self-read path.
- **Exploit (agent):** State bin-packed across 2 data NFTs; a function touching ≥2 NFTs; attacker reorders the
  co-spent data NFTs so preserved fields are read from the wrong NFT → fields permuted across NFT boundaries.
  With type-aligned fields this moves a value from a writable field into one with no setter (e.g. an
  owner/flag) → privilege escalation / arbitrary write. All category/bytecode checks pass.
- **Fix:** Call `emitNftIndexTagVerify(nftIndex)` (not `…Skip`) on self-reads + preservation reads in
  multi-data-NFT layouts.

#### H2 — External-call return-value forgery  `[VERIFIED root; exploit per agent, no PoC]`
- **Location:** A-side `emitExternalReturnEventVerification :11400-11480` + commitment read `:8021-8024`;
  B-side `:11307-11398`; `emitMintingNftUniqueness :11874+` (counts only 33-byte 0x02 minting category+cap —
  does NOT restrict 0x00 none-cap category-C outputs).
- **Vulnerability:** The caller reads its return from the output at its witness `__internal__externalReturnOutputIdx`
  (checked: callee category, none-cap, FT 0, OP_TRUE, ≤1200 sats). The callee independently constrains the
  output at ITS witness `__internal__returnOutputIdx`. **Nothing pins caller_idx == callee_idx, and nothing
  enforces return-event uniqueness.** Because the caller's identity check co-spends the callee's MINTING master,
  the tx is authorized to mint category-C outputs — including a second none-cap category-C output with an
  attacker-chosen commitment.
- **Exploit:** Attacker lets B emit its genuine return at `callee_idx`, additionally mints a fake return event
  (category-C, none-cap, FT-0, OP_TRUE, dust, attacker commitment), and sets A's return index to the fake.
  A decodes a forged return and acts on it (stores it, branches, uses it as an amount). Applies to typed returns
  and the opaque `(bool,bytes)=addr.call(payload)` path.
- **Fix:** Bind the two indices on-chain (derive the caller's from the same base/offset the callee uses) or
  enforce return-event uniqueness (count category-C none-cap outputs == 1), or add a per-call unique tag.

#### H3 — Optimizer rule-ordering divergence: common code fails to compile  `[VERIFIED — availability, fail-closed, NOT a bypass]`
- **Location:** `packages/utils/src/optimisations.ts:127` (`OP_NOT OP_IF`) vs `:149-152` (relational-NOT family);
  old-engine order `packages/utils/src/script.ts:225-237`; assertion `packages/solidc/src/compiler.ts:259-266`.
- **Vulnerability:** New engine applies `OP_NOT OP_IF→OP_NOTIF` BEFORE the relational-NOT family; old engine
  applies relational-NOT first. Outputs are semantically identical, but the compat assertion does an exact ASM
  string compare and throws "New bytecode optimisation is not backwards compatible".
- **Repro (confirmed):** `if (!(a < b)) {...}`, `if (!(a <= b)) {...}` (and `>`/`>=`, `while`, ternary,
  bool-branch forms) throw. Safe: `require(!(a<b))` (→ OP_VERIFY), `!(a==b)` (folds), direct `a>=b`. Above 5000
  ops the check is skipped so the same source compiles — an inconsistency (shipped output sound either way).
- **Fix:** Move the four relational-NOT rules ahead of `OP_NOT OP_IF` in `optimisations.ts` (restore old order);
  fix the stale "exact same order" comment (`:155-157`). Longer term: fold `!(<relational>)` at the AST level.

#### H4 (agent M1) — `multiCall` change output defaults to anyone-can-spend OP_TRUE  `[VERIFIED — fund loss]`
- **Location:** `packages/solidcash/src/loop-call.ts:8, :157, :206`; caller `packages/solidcash/src/Contract.ts:349`.
- **Vulnerability:** `changeLbc = opts.changeLockingBytecode ?? OP_TRUE`; `contract.multiCall(targets, data)`
  with no `ctx` passes `changeLockingBytecode: undefined`, so the funder's surplus (> 546 sats) is emitted to a
  bare `OP_TRUE` output.
- **Exploit:** A user calls `multiCall` without a change address; the change lands in an anyone-can-spend output
  and is swept by any mempool bot / the miner. Silent fund loss.
- **Fix:** Default the change to the funder's own locking bytecode, or throw on unassigned excess (mirroring
  `StatefulContract.ts:2034-2039` in `deployFrom`).

#### H5 — Custom modifier on a `fallback` is silently dropped (access-control bypass)  `[agent-REPRODUCED]`
- **Location:** `ModifierExpansionTransformation.ts:132` (`expandModifiers` iterates `contract.functions` only);
  `fallbackDef.customModifiers` (grammar `SolidCash.g4:166`, parsed `AstBuilder.ts:982-994`) is consumed NOWHERE else.
- **Vulnerability:** A guard modifier on a fallback (`fallback() external onlyOwner {…}`, the transparent-proxy
  `ifAdmin` pattern) is never expanded into its `require()` and never validated. The fallback is the DEFAULT dispatch
  branch (any unmatched selector routes to it).
- **Reproduced (agent):** bytecode BYTE-IDENTICAL with `onlyOwner(s2)` on the fallback vs no modifier
  (`OP_CHECKSIGVERIFY` count stays 1); an UNDEFINED modifier on a fallback compiles cleanly (vs `UndefinedModifierError`
  on a regular function) — proving fallback modifiers are never processed. **Exploit:** attacker sends any
  non-matching input → fallback runs with the guard absent → covenant accepts anyone. **Fix:** expand modifiers on
  `fallbackDef` (and reject custom modifiers on receive/constructor), or hard-error on non-empty `customModifiers`
  reaching codegen.

#### H6 — Bounded-int/enum/fixed PARAMETERS are never range-validated (negative-"uint" injection)  `[agent-REPRODUCED]`
- **Location:** `GenerateTargetTraversal.ts:1883-1888` (`shouldEnforceFunctionParameterType` returns true only for
  BOOL + bounded bytes — IntType/uintN/EnumType/FixedType get NO check); `packages/utils/src/types.ts:513,517`
  (`IntType↔BIGINT` always OK, launders the signedness guard).
- **Vulnerability:** Entry parameters are raw attacker-controlled stack values; bounded ints are nominal (one signed
  VM integer) and all VM compares are signed, yet a `uintN`/`enum` param gets no `>=min/<=max` guard. Signedness is
  launderable: `int256 x=-1; bigint b=x; uint256 u=b;`.
- **Reproduced (agent):** `uint256 amount` and `int256 amount` params → IDENTICAL bytecode; `uint256 u = -100;` and
  the `int256→bigint→uint256` laundering compile with no error. **Exploit:** `redeem(uint256 amount){ require(amount
  <= this.shares); this.shares = this.shares - amount; }` — pass `-100`: `-100 <= shares` is TRUE (signed), and
  `shares - (-100)` inflates shares. Any contract trusting `uintN` non-negativity in accounting is exploitable.
  **Fix:** emit `emitIntBoundsCheck`/`emitEnumBoundsCheck`/`emitFixedBoundsCheck` for these parameter types; gate
  `BIGINT→IntType`.

#### H7 — Value parameter aliased to a mutated state var — copy semantics broken  `[agent code-confirmed]`
- **Location:** `InlineStoragePointerCalls.ts:275-281` (aliases a bare-identifier value arg by NAME), guard
  `isReassigned :198-204` checks the PARAMETER name, not whether the ARGUMENT state var is mutated in the body.
- **Vulnerability:** Solidity value params are copies; aliasing makes them live references, and state reads see
  pending writes. `_accrue(accIndex)` whose body does `this.accIndex = idx+delta; snapshot[me] = bal + accIndex;`
  → `accIndex` reads the POST-mutation value; the persisted snapshot is silently wrong. If the aliased value is used
  as a mapping KEY after mutation, the write lands on the wrong entry (fund misdirection). **Fix:** only alias a
  value-arg identifier never written in the callee body; else bind a fresh temp (the `:283` path).

#### H8 — Inline overloaded helpers resolved by name+arity → wrong (possibly unguarded) body inlined  `[agent code-confirmed]`
- **Location:** `InlineStoragePointerCalls.ts:93/164/233`, `InlineReturningStateHelpers.ts:75/169`,
  `InlineExternalCallHelpers.ts:59/106-108`, `InlineMappingReturnFunctions.ts:52/136-137` (key by `name`, last-wins;
  disambiguate by param COUNT only).
- **Vulnerability:** SolidCash supports overloading; same-name same-arity overloads (`f(uint256)` vs `f(int256)`)
  collide → whichever was defined last is inlined. If the intended overload has a `require` guard and the last does
  not, the guard is dropped (H7's numeric pass-through defeats the type error). **Fix:** resolve by argument types,
  or defer inline decisions until after `SymbolTableTraversal` sets `resolvedFunction`; refuse to inline when
  multiple same-arity same-name overloads exist.

### MEDIUM

#### MD1 — External-call selector is a free witness, not the compile-time constant  `[VERIFIED]`
- **Location:** injection `SymbolTableTraversal.ts:1296-1314`; check `GenerateTargetTraversal.ts:10940-10967`
  (compares to `__internal__externalCallSelector` param); SDK fill `StatefulContract.ts:5310-5330`.
- **Vulnerability:** For a `regular` call to a >1-function callee, the covenant asserts co-spent selector ==
  a spender-provided witness param, not the compile-time function's baked selector. A malicious spender sets the
  witness to another of the callee's methods and co-spends that method instead of the one the caller's source
  names → return/effect confusion (e.g. call a different oracle method returning a manipulated value); worse
  combined with H2.
- **Note:** The recently-added same-address runtime-selector function-pointer path (`DesugarExternalFunctionPointers`)
  was checked and is correctly bound to `cond` and folds to compile-time selectors — GOOD.
- **Fix:** Emit the compile-time selector as a constant `OP_EQUALVERIFY` (the SDK already knows it from the ABI).

#### MD2 — Optimizer compat assertion is refactoring-equivalence, not a soundness oracle  `[Agent-reported]`
- Both engines consume the SAME rule set; a shared unsound rule passes the assertion. Skipped for >5000 ops and
  absent entirely for referenced/child contracts (`compiler.ts:407-416`). All rules verified sound TODAY, so this
  is a defense-in-depth gap. **Fix:** per-rule VM-equivalence tests; extend the check to referenced contracts.

#### MD3 — Locktime guard not injected for `fallback`/`receive` (time-lock bypass)  `[agent-REPRODUCED]`
- `InjectLocktimeGuardTraversal` doesn't override `visitContract`; the base `AstTraversal.ts:127-142` visits
  `constructorDef` + `functions` but NOT `fallbackDef`/`receiveDef`, so a fallback/receive reading `tx.locktime`
  gets no synthetic `require(tx.time >= tx.locktime)`. Reproduced: regular fn → `OP_CHECKLOCKTIMEVERIFY` (0→2);
  same use in a fallback → 0. Shares the "fallback/receive are second-class in transformation passes" root cause
  with H5 (and `EarlyReturnTransformation.ts:44-51` also skips them). **Fix:** route `fallbackDef`/`receiveDef`
  through the guard passes + base `visitContract`.

#### MD4 — Inherited parent-constructor body dropped when not explicitly invoked (state at defaults)  `[agent-REPRODUCED init-drop]`
- `InheritanceExpansionTransformation.ts:243-244` inlines a parent constructor body ONLY when the child explicitly
  invokes it (`is Parent(args)`). Plain `contract Child is Parent` merges the parent's state vars but not its
  constructor init, so guard-relevant state (`owner = …`) can stay at zero default. Impact depends on how deploy
  supplies initial commitments (often fails closed). **Fix:** inline un-invoked parent constructor bodies (Solidity
  implicit base-constructor call).

### LOW / informational (verify status noted)
- **SDK L2** indexer trust: `getUtxos` maps indexer JSON with no source-tx cross-check; fund loss is blocked by
  default `SIGHASH_ALL|SIGHASH_UTXOS` + covenant value/category preservation, leaving DoS + read-display integrity
  (`StateReader`). `[VERIFIED sound-enough]`
- **SDK L3** private keys materialized into `bitauthUri` on failed sends (`LibauthTemplate.ts:667-676`) — attached
  to `FailedTransactionError` (non-enumerable). Leaks if a dev logs `err.bitauthUri`. `[Agent-reported]`
- **SDK L4** loose fee caps: base `TransactionBuilder` only guards `feePerByte > 1000` (stateful path better,
  `maximumFeeSatoshis: 50000n`). `[Agent-reported]`
- **SDK L5** `SignatureTemplate` accepts `SIGHASH_NONE/SINGLE/ANYONECANPAY` with no warning (default is safe; opt-in
  only). `[Agent-reported]`
- **Parser** odd-length hex literal zero-extends (`0x…abc`→`0x…ab0c`) while warning says "dropped"
  (`AstBuilder.ts:2384-2399`). `[VERIFIED]`
- **Parser** bounded int literals not range-checked (`uint8 x = 1000;` compiles) (`AstBuilder.ts:2247-2256`).
  `[VERIFIED]`
- **AstBuilder** nested keyed lvalue chains (`this.m[k].a.b=v`) drop trailing members; type-checker backstops
  (`:2856-2866`). `[Agent-reported]`
- **State** non-minimal pushdata / sign-magnitude `-0` accepted on DECODE (malleability), but encode-and-compare
  pins the minimal form on-chain → fail-safe (SDK-misread only). `[Agent-reported]`
- **State** array encode(framed)/decode(packed) asymmetry for fixed-width element arrays — latent (fixed arrays are
  chunk-packed); SDK round-trip hazard, fail-safe. `[Agent-reported]`

---

### LOW (covenant domain)
- **Master commitment unconstrained in the state-access path** (`GenerateTargetTraversal.ts:1737-1740` emits only
  self-preservation + minting-uniqueness, vs the guarded/upgrade paths `:1755-1764`/`:1736`/`:1760` which also call
  `emitMasterCommitmentPreservation :11583-11593`). No impact today (state lives on data NFTs at offset ≥1; the
  master commitment carries no field data), but a defense-in-depth/consistency gap if a future feature stores data
  in the master commitment. **Fix:** call `emitMasterCommitmentPreservation` in the state-access branch too, or
  assert the master commitment stays empty. `[Agent-reported]`

## VERIFIED SOUND (negative results — do not re-flag)
- **Optimizer:** every replacement rule is a stack-equivalence; NO rule drops `OP_VERIFY`/`OP_EQUAL(VERIFY)`/
  `OP_CHECKSIG(VERIFY)`/a bytecode-compare or removes an IF branch; partial-match safety holds
  (`OP_1 OP_ADD` not inside `OP_16 OP_ADD`; `OP_SWAP OP_EQUAL` not inside `OP_EQUALVERIFY`); no branch/constant
  folding; dead-`OP_DEFINE` splice removes only use-count-0 subroutines; `scriptToAsm`/`asmToScript` preserves
  data pushes incl. `0x80`/`0x00`.
- **Signing:** default `SIGHASH_ALL | SIGHASH_UTXOS | forkId` commits to ALL outputs + ALL input UTXOs;
  signatures bound per `inputIndex`; post-broadcast txid verification + fetched-tx hash verification detect
  provider tampering; duplicate-input detection; argument range/length validation; `Contract.generateSalt` uses
  `crypto.getRandomValues`.
- **State:** entry key↔commitment binding (read `OP_EQUALVERIFY`s decoded key == requested key; write pins
  `key_enc ++ value_enc`, category-base==master, mutable capability); entry→output-index derived from the covenant
  trace (fail-closed); chunk storage pins chunkIndex/data/address/category/count/orphan-bound + old-chunk
  consumption; fixed-width int packing canonical sign-magnitude.
- **External calls:** wrong-target identity substitution rejected (`CallReturn.test.ts:107`); array-element +
  inline-loop dispatch bind each callee to `arr[i]`/`targets[i]`; the runtime-selector varying-method pointer temp
  is bound to `cond`, folds to compile-time selectors, and its `+2` stack offset is correct.
- **Structure:** circular/re-entrancy structurally absent in the flat-tx model; SDK blocks duplicate inputs.
- **Covenant (dispatcher & control flow):** the dispatcher (`emitDispatch :879-952`) rolls a size-checked exact
  4-byte selector then `OP_INVOKE` (hard-fails unknown IDs; fallback matches exact selector; receive gates on
  exact `OP_DEPTH`) — no wrong-function dispatch or guard-skip; conditional/early-return state writes are
  pre-allocated before the condition and the epilogue is emitted unconditionally at tail (EarlyReturnTransformation)
  — no branch skips a covenant check; entry read-only preservation gates on the *input* category so accessed
  entries must be re-created (the C3 gap is specifically *un-accessed* NFTs, which never enter this loop).

---

## SEMANTIC domain LOWs (agent-reported; fail-closed or narrow)
`IfConvertConditionalEntryOp.ts:213-219` (last-op-per-entry-per-arm drops a side-effectful first write);
`DesugarNestedArrayWrite.ts:202,225` + `LowerStorageSlotPointers.ts:133-135` (impure index cloned read vs write-back);
`SymbolTableTraversal.ts:186,211` (`getMaxPushdataEncodedSizeForType` under-sizes address/bigint at 9B → over-pack,
fails closed); `utils/types.ts:443` (bytesN→non-payable address implicit, fails closed); `InheritanceExpansion…:82,…`
(`__base_` prefix not reserved); external mapping reads `SymbolTableTraversal.ts:2861-2873` key coarsely
(key-independent) — same C4 shape in the read-only foreign subsystem, review under C4's threat model.

**Semantic VERIFIED SOUND:** `EnsureFinalRequire` (codegen appends a value-preservation covenant for return/emit-only
public fns — not unconditionally spendable); override/`super`/C3-linearization/diamond dedup (a less-guarded override
wins only via explicit `override` = Solidity parity); abstract bodies throw or emit ABI-only; visibility→external
dispatch (internal/private get a functionId but no selector → excluded from dispatch); scalar slots, `this.f`
self-calls, shadowing, signature/hash operand typing, `isValidStateType` recursion guard.

## COMPLETED — all 6 domains audited (2026-07)
Covenant-codegen (C3 + master-commitment LOW), semantic-analysis (C4 + H5-H8 + MD3-MD4 + LOWs) both DONE.
Remaining follow-up: independent on-chain PoC for H1/H2 (root causes confirmed; full exploit not built).

## TOP PRIORITIES TO FIX
> Original pre-remediation action plan. **ALL items below are now FIXED** - see REMEDIATION STATUS at the top
> (C1 in particular was hardened well past this list's "or gate behind checkSig": the delegate co-spend + selector
> are now forced + pinned for a covenant `impl`). Kept for the audit trail.

1. **C4 mapping-key collapse** — make `canonicalizeExpression` operand-injective / reject bare `expr:<ctor>`
   (silent state-write mis-targeting; broad blast radius for composite-key contracts).
2. **C1 delegatecall** — pin the delegate + authorize the commitment (or gate proxies behind checkSig + docs).
3. **C3 un-accessed NFT destruction** — an all-inputs 0x01-of-C conservation loop (or authorize each sub-NFT spend).
4. **C2 mapping omission** — diagnostic for negative-guard/one-time-write + document; entry-set accumulator for
   full soundness.
5. **H5 fallback modifier** + **H6 param bounds** + **MD3 fallback locktime** — route fallback/receive through
   `expandModifiers`/`InjectLocktimeGuard`/`visitContract` (shared root cause); emit param bounds checks.
6. **H1 multi-NFT tag** (verify tag on self-reads), **H4 multiCall change** (default to funder LBC),
   **H3 optimizer order** (reorder rules), **H7/H8 inline passes** (no aliasing / resolve overloads by type).
   **H2 / MD1** need a covenant design change (bind indices / bake selector).

## Agent transcripts (this session only; do NOT rely on cross-session)
SDK, optimizer, external-calls, state-encoding domains produced full reports (captured above). Covenant + semantic
re-running. Transcripts are under the session tasks dir and are NOT durable — this file is the durable record.
