<!-- cspell:ignore Exploitability -->
# SEM audit - front-end semantics (modifiers, inheritance, dispatch, control flow, inlining, final-require, locktime)

Tree: /Code/cashscript/.worktrees/per-call, branch feat/per-call. NOTE: HEAD moved during the audit from df51215d6 to
abbb7e0ec (df51215d6 is its ancestor); line numbers below are against abbb7e0ec. Read-only; no tests/compiles run.
Paths: `semantic/` = packages/solidc/src/semantic, `compiler.ts`/`GTT` = packages/solidc/src/compiler.ts /
generation/GenerateTargetTraversal.ts.

## Current follow-up status (2026-10-14)

The findings below preserve the original audit snapshot and its evidence. Current implementation and validation
status is recorded in `archive/docs:docs/security/security-audit-2026-10-feat-parity.md`.

- SEM-1 now has path-sensitive final-require checks. Focused local VM tests also verify the two covenant-covered
  early-return exemptions: a direct mapping reader rejects a rewritten mapping node, and a framed reader rejects
  rewritten mapping and data records while accepting unchanged records. Evidence:
  [AuditTranscriptStateIntegrity](../../packages/solidcash/test/e2e/AuditTranscriptStateIntegrity.test.ts) and
  [framed exempt-return regression](../../packages/solidc/test/framed/master/audit-exempt-return.test.ts).
- The invoked-read follow-up now inlines a direct void `this.f()` mapping reader into its caller's physical
  collection frame. Two distinct-key reads settle, and an incorrect second key is refused in
  [AuditTranscriptStateIntegrity](../../packages/solidcash/test/e2e/AuditTranscriptStateIntegrity.test.ts).
  Returning self-calls retain the existing refusal for a mapping read after a pending write before a delete;
  the focused external-getter case in
  [AuditDS6SameKeyAlias](../../packages/solidcash/test/e2e/AuditDS6SameKeyAlias.test.ts) still passes.

These follow-up checks used local VMs without running BCHN tests.

## Findings

### SEM-1 HIGH, CODE-CONFIRMED - final-require check passes an early `return;` that precedes the only require
- Where: semantic/EnsureFinalRequireTraversal.ts:303 (`hasPriorUnconditionalRequire` short-circuit) and :382-393 (it
  is order-blind: any top-level require anywhere in the list counts); :152-157 + :575-577 (bare `return;` allowed and
  ignored); semantic/ConfineReturns.ts:123-125 (`confineFunction` leaves a function alone when `nestsReturnsToTail`,
  which is true for `if (c) return; require(..)`, EarlyReturnTransformation.ts:227-250); order compiler.ts:16167
  (EnsureFinalRequire) before :16181 (EarlyReturnTransformation, which then nests the tail into the else arm and does
  no re-check).
- Root cause: the check asks "is there an unconditional require in this list", not "does every path reach one before
  it ends". A bare return ends a path before the later require. The pass's own contract (:225-227, compiler.ts:303)
  says such a path "compiles as unconditionally-spendable (codegen ends it with OP_1)" and must be a hard error.
- Attack (stateless contract, default options):
  ```
  contract Wallet(pubkey owner) {
    function spend(sig s, int amount) { if (amount == 0) return; require(checkSig(s, owner)); }
  }
  ```
  Call `spend(<any well-formed sig bytes>, 0)`: the `amount == 0` arm runs no verification and the UTXO is spent to
  any outputs. Same for a stateful contract's non-state-writing entry only if its covenant does not cover value
  (stateless is the clear case). Guard-clause early returns are a common Solidity idiom.
- Fix: make the check path-sensitive: a top-level require counts only if no earlier statement in the list holds a
  return on some path (`holdsReturn`), and a branch arm ending in a bare return must itself be verified; or run the
  check after EarlyReturnTransformation (the nested `if (c) {} else {require}` then fails as if-without-else).

### SEM-2 HIGH, CODE-CONFIRMED (path) / SUSPECTED (trigger) - referenced child silently compiled without its modifiers
- Where: compiler.ts:19664-19685 `compileReferencedContractStandalone` returns `undefined` on ANY exception (bare
  `catch`, :19681) and on a creation cycle (:19668); compiler.ts:19569-19571 then embeds
  `scriptToBytecode(optimisationResult.script)` from the fallback `singleAst` pipeline (:19468-19549), which runs no
  `expandModifiers`, no `expandBreakContinue`, no `DesugarReturnInLoop`/`LowerTailRecursion`. Nothing downstream
  rejects leftover `customModifiers` (GTT, SymbolTableTraversal and TypeCheckTraversal never read them; base
  AstTraversal.visitContract does not visit modifierDefinitions, so the unexpanded `_` never throws).
- Root cause: the "standalone bytes" safety net degrades to a reduced front-end instead of failing closed. The main
  pipeline expands modifiers only on `ast.contract` (ModifierExpansionTransformation.ts:411-460), never on
  `ast.importedContracts`.
- Attack: a file where parent `A` deploys child `B` (`new B(..)`) and `B` has
  `function sweep(address to) external onlyOwner { .. }`. If B's standalone compile throws for any reason the
  embedded-child path tolerates (any standalone-only refusal, an internal error in a pass the fallback skips), or A
  and B create each other (second-generation B is built from the fallback bytes via the :19668 cycle guard), the
  deployed B carries no `onlyOwner` require: anyone calls `sweep(attacker)` on child instances. Break/continue in
  that child are also no-ops (see SEM-3).
- Fix: on standalone failure rethrow (fail closed) instead of falling back; for the genuine cycle case, run the full
  front-end (expandModifiers, expandBreakContinue, ...) in the fallback and assert every function's
  `customModifiers` is empty before codegen.

### SEM-3 MEDIUM, CODE-CONFIRMED (lowering) - break/continue inside `unchecked {}` (or a for-of collection loop) is dropped
- Where: semantic/BreakContinueTransformation.ts:75-137 (`transformStatementList` has no UncheckedNode, SwitchNode or
  CollectionIterationNode case: such a statement is pushed unchanged, so a loop inside it is never transformed);
  :291-446 (`nestBreakContinue` has no UncheckedNode case); :527-547 (`containsBreakOrContinue` does not look into
  UncheckedNode); ast/AstTraversal.ts:595-601 (visitBreak/visitContinue return the node) and GTT does not override
  them, so a leftover break/continue emits no opcode. UncheckedNode survives to this pass (AstBuilder.ts:4101-4140,
  compiler.ts:960).
- Attack (source semantics silently weakened):
  ```
  function payout(address[] calldata to, uint256[] calldata amt) external {
    uint256 spent;
    unchecked { for (uint256 i; i < to.length; ++i) {
      if (spent + amt[i] > budget) break;      // dropped: loop keeps paying past the budget
      if (blocked[to[i]]) continue;            // dropped: blocked recipient is paid
      spent += amt[i]; payable(to[i]).transfer(amt[i]);
    } }
  }
  ```
  An attacker supplies arrays whose later entries the source would have cut off. `while (true) { .. break; }` inside
  `unchecked` (OZ Strings.toString shape) becomes an infinite loop (fail-closed DoS).
- Fix: treat UncheckedNode as a transparent block in all three walkers (and CollectionIterationNode as a loop, or
  reject break/continue in it); add a pre-codegen assertion that no BreakNode/ContinueNode survives.

### SEM-4 MEDIUM, CODE-CONFIRMED - H7 variant: value argument aliased when a NESTED helper mutates it
- Where: semantic/InlineStoragePointerCalls.ts:813-818 (`!this.isWritten(callee.body, arg.name)` inspects only the
  callee's own un-inlined body, :576-587); nested helper calls are inlined afterwards (:891-892).
- Attack: `uint256 accIndex; mapping(address=>uint256) snap;`
  `function _bump() internal { accIndex = accIndex + 1; }`
  `function _accrue(uint256 idx, address w) internal { _bump(); snap[w] = snap[w] + idx; }`
  `function poke() external { _accrue(accIndex, msg.sender); }` - `idx` is renamed to `accIndex`, `_bump` is then
  inlined, and `snap[w]` is credited with the post-bump value instead of the copied one (state corruption; on a
  mapping-key alias, a write to the wrong entry).
- Fix: compute `isWritten` over the transitive inline closure (or after inlining nested calls), else bind a temp.

### SEM-5 LOW, CODE-CONFIRMED - H8 variant: expression inliner picks an overload by name only
- Where: semantic/InlineStoragePointerCalls.ts:368-375 (`exprInlinableFns` keyed by name; ambiguity computed over the
  eligible subset only, comment :155-157), :523-534 (lookup by `identifier.name`, arity equality only). Same subset
  scoping in semantic/InlineMappingReturnFunctions.ts:53-60 + :143-149. Introduced in 1a533c88d.
- Attack: `function amt(Order storage o) internal view returns (uint256) { return o.amount; }` and
  `function amt(Order memory o) internal view returns (uint256) { require(!o.cancelled); return o.amount; }`; a call
  `amt(memOrder)` is replaced by `memOrder.amount`: the guarded overload's require is dropped. Needs same-name,
  same-arity overloads whose substituted expression still type-checks.
- Fix: compute ambiguity over all same-name/arity functions (as the statement path does at :194), or match by types.

### SEM-6 LOW, CODE-CONFIRMED - locktime guard suppressed by a time check placed after an early return
- Where: semantic/InjectLocktimeGuardTraversal.ts:46-57 (any CHECK_LOCKTIME statement anywhere in the block, even
  after the read and after a `return`, marks the whole block checked); runs before EarlyReturnTransformation
  (compiler.ts:16176 vs :16181).
- Attack: `function release(sig s) { if (tx.locktime >= deadline) { require(checkSig(s, seller)); return; }
  require(checkSig(s, buyer)); require(tx.time >= unlock); }` - the seller arm runs no CLTV, so the seller sets
  nLockTime = deadline with final sequences and claims before the deadline.
- Fix: count a time check only if it precedes the read and no statement between them holds a return/break.

### SEM-7 LOW, SUSPECTED - split facet promotes same-name internal overloads to PUBLIC DELEGATE
- Where: compiler.ts:19268-19275 (`planned.has(fn.name)` rewrites EVERY function with that name, including internal
  or private overloads, to `PUBLIC, DELEGATE`); root side compiler.ts:19321 (`routes.get(fn.name)`) likewise turns an
  internal overload into a delegatecall forwarder. The overloaded-entry guard (:18509) only counts entry overloads.
- Risk: an internal `burn(address,uint256)` beside a routed public `burn(uint256)` becomes a dispatchable facet
  entry. Exploitability depends on how the root authenticates the facet's selector (delegate domain); not traced.
- Fix: key plans/routes by signature and only promote the planned entry overload.

### SEM-8 INFO - message-bus event-only contract gains a compiler-synthesized public `initialize()`
- compiler.ts:5519-5541 (called from :5551 under `messageBus`): adds `__messageBusHold` (public) and a public,
  unguarded `initialize()` writing 0 when the source has no `initialize`. An entry the source did not declare;
  effect is a constant write to a compiler-owned slot.

### SEM-9 INFO - omitted state-variable visibility defaults to PUBLIC even under evmCompat
- ast/AstBuilder.ts:5360 + semantic/SynthesizePublicGetters.ts:303-305: Solidity-internal state gets view getters
  (extra selectors). Read-only and state-preserving; a getter name can now collide (fail-closed) with a selector.

### SEM-10 INFO - inherited fallback/receive and parent-constructor modifiers are dropped
- semantic/InheritanceExpansionTransformation.ts:1193-1209: a parent's fallback/receive is only recorded in
  `inheritedSpecialFunctions`, never copied into the child, so `contract P is Proxy {}` has no fallback (fail-closed;
  funds can be stranded if that was the only path). :1056-1062 and :1083-1088 inline a parent constructor body
  without its `customModifiers` (constructors run only in genesis, GTT:9805-9815, so deploy-time only).

### SEM-11 HIGH, VM-PROVEN (mock) - a function-typed entry parameter invokes any function
Added after the audit. Reported by the `feat/parity` work and re-read at `25e887d0a`; nothing run.
- semantic/LowerForeignFunctionPointerParams.ts:41-43, 110-116: an external function-type parameter that receives a
  self-ref (`this.f`) at ANY internal call site is not lowered to the `(address, selector)` foreign call; it stays
  an integer function id. On a public function the unlocking script supplies that id.
- GTT:15600-15619 (`visitIndirectFunctionCall`) and 15623-15644 (`visitIndirectCall`): `<args> <id> OP_INVOKE`, with
  no check that the id is one of the values the parameter can legitimately hold.
- SymbolTableTraversal.ts:2026-2030: every public, internal, private and external function gets an OP_DEFINE id from
  one counter, so any small integer reaches some function body, internal helpers included.
- Shape: `function run(function(uint) external returns (uint) cb, uint x) public returns (uint) { return cb(x); }`
  plus `run(this.g, 1)` somewhere. A caller passes the id of an internal helper with a matching stack shape.
  In Solidity such a parameter is `(address, selector)` and reaches only public and external functions.
- Checked: an internal function type in an entry signature is refused (SymbolTableTraversal.ts:1986-1995,
  `FunctionTypeNotEncodableError`), as solc does, so only the self-ref path above hands the caller an id.
- VM result (mock, `feat/parity`): a private helper ran on caller-chosen arguments, directly and through an id a
  public setter stored in state. Compiler helper and outlined-span bodies sit in the same OP_DEFINE table.
  Wrong-type and undefined ids already failed.
- Fix: accept only the ids the parameter can hold (the self-refs passed to it, or public and external functions of
  the matching type) and refuse any other. Done on `feat/parity` by `3df64a824` (merged as `e5e3013f5`, test
  `packages/solidcash/test/FnPtrEntryIdValidation.test.ts`); deeper nesting is refused. `707df2835` (merged as
  `e501c8513`) extends the check to ids from `abi.decode` and from external-call returns (the latter tested at
  compile level only), and `11b716f9f` to struct fields entering public functions.

## Checked and sound
1. Modifier expansion covers functions, constructor (after the base prelude), library/free functions, fallback and
   receive (H5 fixed): ModifierExpansionTransformation.ts:424-458; gate compiler.ts:14651-14658.
2. Undefined, abstract and duplicate modifiers error: :355-372, :484-494.
3. Return in a body/modifier under a modifier with post-`_` code: region flags keep post-`_` code running
   (ModifierExpansionTransformation.ts:296-353, ConfineReturns.ts:164-200).
4. Several `_` / `_` in a loop: each placeholder gets a clone and the region flag resets per run (:268-274, :333).
5. A `_` left in a switch case or catch clause throws at traversal (AST.ts:3518-3520) - fail-closed.
6. Modifier override: own override wins; a sibling-derived override conflict raises InheritanceNameCollisionError.
7. Function override dominance uses the original hierarchy; an overridden parent is kept as INTERNAL `__base_`
   (InheritanceExpansionTransformation.ts:1432-1458), never an entry.
8. Selectors only for isEntryPoint functions; collisions checked across entries, constructor, `__fallback()`,
   `__receive()` (SymbolTableTraversal.ts:2056-2111); private/internal never get a selector.
9. Simple dispatch size-checks a 4-byte selector before OP_INVOKE; helper ids are small negative ints, internal ids
   small positive (GTT:6383-6390, 6522-6526, 1688-1710) - not reachable through the selector. A function-typed
   entry parameter does reach them (SEM-11).
10. Fallback dispatch is an exact-match OR chain, else the fallback; with no fallback an unknown id hard-fails.
11. Constructor arm is dispatchable but opens with genesisSpendCheck (GTT:8727, 9805-9815; framed/master/
    prologue.ts:86-92): cannot run on a live master.
12. EnsureFinalRequire visits constructor, functions, fallback and receive (:89-100); selfdestruct stays strict.
13. Locktime guard covers fallback/receive (MD3 fixed, :27-32) and internal helpers.
14. MD4 fixed: un-invoked parameterless parent constructors are inlined (:1068-1088).
15. H8 statement paths compute ambiguity over all functions (InlineStoragePointerCalls.ts:194,
    InlineReturningStateHelpers.ts:471, InlineExternalCallHelpers.ts:97).
16. H7 direct-write guard present (InlineStoragePointerCalls.ts:813-818).
17. ConfineReturns refuses a return in an unchecked/try/switch inside a loop (ConfineReturns.ts:216-225).
18. EarlyReturnTransformation refuses unconfined returns (EarlyReturnTransformation.ts:112-117).

## Not reached
- LowerTailRecursion body rewrites (only its modifier/guard predicates checked).
- InlineReturningStateHelpers and InlineExternalCallHelpers: `this`/msg.sender/frame context of inlined bodies and
  the H7 analog there.
- IfConvertConditionalEntryOp (2026-07 LOW) regression check.
- Message-bus/kernel route synthesis (entry clones, graph handlers) visibility and dispatch; framed fallback dispatch
  beyond emitFramedFallbackDispatch.
- Covenant side of return-only entries in stateless contracts (covenant domain).
