# State-journal + full-branch soundness audit (R1-R5)

Reviewer: Claude (adversarial soundness + security audit)
Baseline: branch `codex/state-bus-research`, HEAD `4cff1624`, forked from `d36116aa` (62 commits, ~5.2k
inserted lines). Scope: **all** work added since the fork, with emphasis on the previously
un-audited R1-R3 journal-lowering layer. The R4-R5 hidden-batch surface is covered in the companion
`compiler-hidden-batch-v1-audit.md`; this document adds the journal layer beneath it and the
cross-cutting result.

Method: five parallel adversarial code traces (scalar/recursion, collection/mapping, dynamic-state,
metadata/inlining, SDK derivation), each hunting concrete wrong-but-authenticated-state scenarios
against the normative ship-gate (sequential-execution equivalence). Every material finding was then
verified by me directly against the code, and the two soundness holes were **reproduced on the real
BCH-2026 VM** (`MockNetworkProvider.send()` executes `createVirtualMachineBch2026`).

## Disposition

**Decision 3 (implementation defects require changes) for the R1-R3 collection journal.** Two
distinct, always-on lowering bugs produce covenant-accepted wrong state on common contract shapes and
are confirmed on-chain. Neither is behind an experimental flag: any contract compiled on this branch
with the trigger pattern is affected. The scalar journal, dynamic-state length/flush integrity, SDK
derivation, and the batch positional-binding machinery are otherwise sound (covenant-enforced,
fail-closed). The remaining journal defects are fail-closed correctness/robustness regressions.

Headline: **the covenant authenticates whatever the lowered bytecode computes.** R1-R3 add no new
covenant surface, so a lowering that computes the wrong state transition yields state that is
"correctly wrong" and settles on-chain. That is exactly what J1 and J2 do.

## Remediation status

Post-audit corrections (2026-07-23):

- **J1 corrected and VM-locked:** multi-entry caches now use explicit structural identities for
  wrapper parameters, parsed literals, and transaction/message globals. Repeated literal keys share
  one pending value; unsupported complex expressions are rejected rather than assigned an identity
  weaker than physical storage canonicalization. The original inflation transaction now settles
  `100 -> 40 + 30 + 30` on the BCH-2026 VM.
- **J2 corrected by a sound boundary:** a wrapper containing an early return cannot use a
  multi-entry journal helper. Compilation fails with a specific diagnostic before an artifact is
  emitted. General exit-aware write-back sinking remains a future feature, not a soundness
  dependency.
- **J3 corrected:** scalar-journal eligibility now inspects pre-semantic `MethodCall`,
  low-level-call, and dotted external-call AST shapes. Such helpers remain on the established inline
  path, where their external-call covenant slots are owned by the physical entry point.
- **J4 corrected and VM-locked:** returning helpers that push, pop, assign, or delete a state array
  are recognized as state-touching and inlined. The former rejected `append(5); append(7)` shape now
  settles and reads back `[5, 7]` on the BCH-2026 VM.
- **J5 fails closed explicitly:** an event-bearing returning state helper which survives to
  subroutine journal code generation is rejected with a specific compiler error. It can no longer
  silently discard the event.
- **J6 regression-locked:** invocation SCC analysis is journal-kind-independent. Mutually recursive
  collection and dynamic-state closures now have tests proving their physical entry ABI carries
  `recursiveStateHandler`, activating the existing concrete BCH VM preflight in the SDK.

With these corrections, no covenant-accepted wrong-state finding in this audit remains open.
The original finding descriptions below are retained as the independent review record.

---

## J1 - CRITICAL: multi-entry journal key-dedup mismatch mints tokens from nothing

Confirmed on the 2026 VM. **No experimental flag required** (`compileString(src, { forceStateful: true })`).

Root cause: the multi-entry collection journal decides whether two handler calls touch the same
logical entry by **`IdentifierNode`-name equality only** (`LowerCollectionJournalHelpers.ts:500-505`):

```js
const prior = cache.locals.find((local) =>
  local.entry.collection === entry.collection
  && local.keys.length === keys.length
  && local.keys.every((candidate, keyIndex) =>
    candidate instanceof IdentifierNode && keys[keyIndex] instanceof IdentifierNode
    && candidate.name === (keys[keyIndex] as IdentifierNode).name));
```

If a shared key argument is **not** a bare identifier - `msg.sender`, a struct/field access, an array
element, or a literal - `prior` is never found, so a fresh journal local is allocated per call. But
the storage-slot identity is computed by full structural canonicalization
(`SymbolTableTraversal` `canonicalizeExpression`/`collectEntryAccesses`), which coalesces both
accesses to **one** physical entry slot. `installMultiCaches` (`:520-538`) then emits
prefetch-all-at-top / flush-all-at-bottom: both locals read the pre-image (stale read), both write
back, last-write-wins. The shared debit is applied once but its effects (credits) happen twice.

Reproduced (VM, this session):

```solidcash
contract ProbeToken() {
  mapping(bytes20 => bigint) balances;
  function mint(bytes20 to, bigint amount) { this.balances[to] = this.balances[to] + amount; require(amount >= 0); }
  function move(bytes20 from, bytes20 to, bigint amount) internal {   // multi-entry: balances[from], balances[to]
    require(this.balances[from] >= amount);
    this.balances[from] = this.balances[from] - amount;
    this.balances[to]   = this.balances[to]   + amount;
  }
  function drainTwice(bytes20 to1, bytes20 to2, bigint a, bigint b) {
    move(0x1111111111111111111111111111111111111111, to1, a);   // shared key is a LITERAL (non-identifier)
    move(0x1111111111111111111111111111111111111111, to2, b);
    require(a >= 0);
  }
}
```

State: `SRC=100, to1=0, to2=0`. Call `drainTwice(to1, to2, 30, 30)`:
- **Result (VM-accepted): `SRC=70, to1=30, to2=30` - total supply 100 -> 130. 30 tokens minted from
  nothing.** Correct sequential semantics is `SRC=40` (100-30-30).

The C2 backend authenticates the sender entry as one legitimate `100 -> 70` transition; nothing
signals a second debit was required. The overspend guard is also bypassed (the second `require(bal >=
amount)` reads the stale pre-image). The literal trigger is used for a clean repro; **`msg.sender` is
the real-world trigger** and is handled identically (both are non-`IdentifierNode`), which is the
canonical ERC-20 shape (`_transfer(msg.sender, ...)` called more than once). Nested keys
(`allowances[from][spender]`) inflate if either shared key is a non-identifier.

Not covenant-guarded, not SDK-guarded on the direct path: the only alias check
(`StatefulContract.ts:7944`) is inside `compilerRoute` external-call settlement and is never reached
by an ordinary journaled call. Every existing multi-entry test reuses a bare parameter identifier
(`from`, `who`, `pool`) as the shared key, so the shape is untested.

Fix direction: dedup journal locals by the same canonical the slot layer uses, OR reject any
call-site key that is not a bare parameter identifier (mirroring the helper-side guard at
`LowerCollectionJournalHelpers.ts:133-136`, which already rejects non-parameter keys for the helper's
own accesses - the wrapper's call-site keys are simply not checked).

## J2 - HIGH: journal write-back reorder past an early return burns the entry

Confirmed on the 2026 VM. Distinct bug, same function (`installMultiCaches`).

`installMultiCaches` (`:534-537`) appends the entry write-backs to the end of the body, relocating
them only before a single trailing `RequireNode`:

```js
const finalGuard = statements.length > 0 && statements[statements.length - 1] instanceof RequireNode
  ? statements.pop() : undefined;
body.statements = [...declarations, ...statements, ...writes, ...(finalGuard ? [finalGuard] : [])];
```

Any control-flow exit inside `statements` (a mid-body `return`) executes before the appended writes.
`DesugarReturnInLoop` only rewrites returns inside loops (`DesugarReturnInLoop.ts:92`) and
`EarlyReturnTransformation` runs later (`compiler.ts:902` vs this pass at `:806`), so a guard-clause
`return` is a live branch when the writes are appended. On that path the co-spent entries are settled
to their default, not their computed value.

Reproduced (VM, this session), bare-identifier keys (no J1 confound):

```solidcash
function payOnce(bytes20 from, bytes20 to, bigint amount, bigint skip) {
  move(from, to, amount);         // multi-entry helper: prefetch/flush hoisted around the body
  if (skip == 1) { return; }      // mid-body early return, before the mandatory final require
  require(amount >= 0);
}
```

State: `alice=100, bob=0`. Call `payOnce(alice, bob, 30, skip=1)`:
- **Result (VM-accepted): `alice=0, bob=0`. Alice's entire 100 balance is destroyed** (the co-spent
  `balances[alice]` entry settles to default 0), the transfer's credit is lost, and the transaction
  succeeds. Correct semantics is `alice=70, bob=30` (source runs `move` fully before the return).

Impact is silent fund loss/burn on a very common shape (a guard clause such as `if (amount == 0)
return;` before the final `require`, in any function that calls a multi-entry journaled helper). It is
loss rather than theft, but it is covenant-accepted wrong state and can escalate to theft in a
composed protocol that trusts the transfer's success. The canonical `... returns (bool) { _transfer();
return true; }` variant is not expressible here because SolidCash mandates a final `require`
(`EnsureFinalRequireTraversal`), which narrows the trigger to mid-body returns - still common.

Fix direction: apply the write-backs at the correct program point (before every exit, or block the
journal when the wrapper body contains a non-tail control-flow exit around the multi-entry call).

## J3 - MEDIUM: scalar-journal eligibility effect-guards are vacuous

`isScalarJournalEligible` (`InlineStoragePointerCalls.ts:256-259`) gates on
`fn.externalCalls?.length`, `fn.lowLevelCalls?.length`, `fn.transferInfos?.length`, etc. - but those
fields are populated by `SymbolTableTraversal` (`compiler.ts:892`), which runs **after** this pass
(`:815`). At gate time every field is `undefined`, so each clause is `0 > 0 == false`. AST backstops
exist for `emit` (`:267`) and native transfers/token-containers (`hasPhysicalEffects`,
`:466-473`) but **not** for external contract calls, low-level `.call`, deploys, or external reads.

Confirmed (compile probe, this session): a void internal helper that makes an external call and
writes a scalar is wrongly admitted to the journal path - it receives a synthetic `(bigint)` journal
context parameter - and compilation then **fails** with a confusing call-arity type error rather than
a clean diagnostic. So the observed consequence is fail-closed (no bad artifact), but the guard is a
no-op that depends on a downstream accident. A previously-inlinable external-call scalar helper now
fails to compile (a robustness regression). Fix: add AST-level backstops mirroring the emit/transfer
ones, or move the gate after `SymbolTableTraversal`.

## J4 - MEDIUM: returning chunk-array journal handler miscompiles to non-executable bytecode

A returning helper whose only state effect is a chunk-backed dynamic-array `push`/`pop`/assign is not
recognized by `InlineReturningStateHelpers.touchesScalarState` (`:467-474`, which sees only
scalar/StateAccess/StateAssign nodes), so it is not inlined, yet `computeScalarJournalClosures`
(`GenerateTargetTraversal.ts:1238-1251`) claims it as a journal writer. It survives as an `OP_INVOKE`
handler with N=2 hidden dynamic-context slots and R>=1 declared return, and the caller's write-back
loop indexes the journal-context slot R positions too shallow (return slots are reserved after the
loop, `:5666-5675`).

Confirmed (VM probe, this session): `run(5, 7)` over such a handler is **rejected by the covenant**
(`mandatory-script-verify-flag-failed`). So this is fail-closed - a valid contract shape is
miscompiled into a transaction the VM will not accept (robustness bug), not silent corruption. The
covenant's per-chunk output verification catches the off-by-R garbage. Fix: teach
`touchesScalarState`/inlining about chunk-array state effects, or correct the write-back offset.

## J5 - MEDIUM: returning helper with an event drops the event silently

A returning scalar-writer with an `emit` and more than one `return` is inlined by neither
`InlineReturningStateHelpers` (requires exactly one tail return) nor the void `isScalarJournalEligible`
path (skips returning functions, `InlineStoragePointerCalls.ts:254`), so it is journaled as an
`OP_INVOKE` handler whose epilogue never settles `pendingEmits`. The scalar state is correct, but the
`emit` produces no on-chain event output and no ABI `emits` descriptor - a silent divergence from
source semantics (the class `7c669b3f` closed for void helpers, left open for returning ones). Event
integrity only; rises to HIGH only for a protocol whose settlement depends on that log. Mechanism
confirmed by code + pass order; runtime silent-drop vs stack-assertion not separately run.

## J6 - MEDIUM: mutual recursion not budget-guarded in the collection/bytes journals

The dynamic bytes/string lowering marks only **direct** self-recursion unsupported
(`LowerDynamicStateJournalHelpers.ts:69`); mutually recursive value handlers over the same dynamic
var are threaded without the scalar path's `scalarJournalRecursive` preflight, so an unbounded/over
-budget cycle is not caught before broadcast. Fail-closed at spend (VM exhausts limits), so liveness,
not corruption. Same gap noted for collection value handlers.

## LOW / for-the-record

- Dynamic early `return;` inside a lowered bytes handler: the pass appends `return __dj_<fn>`
  unconditionally (`LowerDynamicStateJournalHelpers.ts:99-103`); a void helper with a guard `return;`
  becomes a value function containing a bare `return;` - likely a compile error (fail-closed), or data
  loss if type-checking is lenient. Untested.
- Whole-value stack ceiling: journaled read/append/clear materializes the entire dynamic value as one
  stack element; a value grown past ~10,000 B becomes permanently non-journal-mutable (fail-closed,
  invisible at compile time).
- Alias gate `!input?.token?.nft` skip (`StatefulContract.ts:7948`) and non-defensive
  `bBlockInputs[slot.offset]` indexing (see companion doc F3): safe for the current shape, not
  defensively written.
- `strongConnect` uses JS recursion (`SymbolTableTraversal.ts:1287+`): a pathologically deep acyclic
  call graph could overflow the compiler stack (compiler DoS, not covenant).

---

## What is sound (verified, with anchors)

- **SDK auto-derivation is covenant-authoritative** (`StatefulContract.ts` `_deriveFullTransactionState`,
  `extractCommitmentMapFromTrace`): every SDK-derived commitment is materialized as an output the
  covenant re-verifies with `OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY` over the **full** commitment
  `slot ++ nextKey ++ value` (`emitVerifySortedValueOutputInline`, `GenerateTargetTraversal.ts:11680
  -11701`, including the insert P' and NEW node). Iterative entry derivation is off-chain planning; a
  wrong derivation fails to build or is VM-rejected, never covenant-accepted-but-wrong. `cbb360fc`
  scoping of the multi-key resolver behind `group.compilerRoute` is complete in both directions.
- **Scalar journal read-your-writes and single-flush are covenant-enforced**: in-place `emitReplace`
  per slot, one `OP_EQUALVERIFY` per dirty NFT (`:13509-13561`), authenticated pre-state read,
  msg.sender authentication from the pinned category, and fail-closed guards for lost/missing slots
  (`:5600-5602`, `:13493-13497`). Hostile-override and forged-flush rejection are VM-tested.
- **Dynamic-state length integrity and flush-once**: A$len is always `OP_SIZE(threaded blob)` at the
  sole write site; read truncates with `OP_SPLIT` asserting `size >= A$len` (fail-closed on
  over-read); writes coalesce to one pending write per var; chunk count is orphan-bounded and old
  chunks force-consumed. Corruption only arises via J4, which is fail-closed.
- **Batch positional binding, whole-blob equality, parser exhaustion, eligibility fail-closed, entry
  key-binding**: see companion `compiler-hidden-batch-v1-audit.md` (findings F1-F6 there:
  overstated "real ERC-20" claim, SDK-only alias/cold tests, metadata-dependent cold gate, 225-byte
  size wall, test over-attestation, load-bearing route bifurcation).

## Root cause and priority

J1 and J2 share a root: `installMultiCaches` treats a multi-entry helper's call sites as if their
keys were simple, order-independent, and unconditional - dedup by identifier name, hoist reads to the
top, sink writes to the bottom. Both assumptions break on ordinary code (non-identifier shared keys;
mid-body returns), and because R1-R3 add no covenant surface, the covenant ratifies the mistake.
Priority: fix J1 (inflation) and J2 (burn) before this branch is used to compile any value-bearing
contract, flagged or not; they are not gated by the experimental batch flags. J3-J6 are fail-closed
and can follow.

## Coverage

Audited since the fork: `LowerCollectionJournalHelpers.ts` (full), `LowerDynamicStateJournalHelpers.ts`
(full), `InvocationAnalysis.ts` (full), the scalar/dynamic/collection journal codegen in
`GenerateTargetTraversal.ts`, `InlineStoragePointerCalls.ts`, `InlineReturningStateHelpers.ts`,
`CacheMappingEntryInLoop.ts`, the `SymbolTableTraversal.ts` journal/layout deltas, `StatefulContract.ts`
derivation, and `StatefulTransactionBuilder.ts`. The pre-existing C2 sorted-mapping machinery was
taken as a VM-proven given except where a new path depends on it (verified: full-commitment output
equality). Two soundness holes reproduced on `BCH_2026_05`; two robustness bugs reproduced as
compile/VM rejections.
