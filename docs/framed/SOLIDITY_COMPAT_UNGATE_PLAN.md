# Ungate `solidityImportCompat` rules — plan

Working checklist. Each Tier 1 / Tier 2 item is a checkbox to be ticked as the change lands and is pinned by a
test. Tier 3 is included for completeness and is **do not implement**.

Scope: compiler-side rules currently conditioned on `solidityImportCompat` in
`packages/solidc/src/semantic/SymbolTableTraversal.ts`, `semantic/TypeCheckTraversal.ts`,
`generation/GenerateTargetTraversal.ts`, and the small validators in `compiler.ts`. SDK/harness *consumers*
of the flag (`compute-recipe-evaluator.ts`, `builtin-tasks.ts`, `hre.ts`) are out of scope — they read the
recorded artifact option, they are not rules.

Line anchors are from the tip at plan creation (`459af4da3`); they will drift, so resolve by the quoted rule
text, not the number.

---

## Tier 1 — universal mutability/payability rules (implement)

Native SolidCash already enforces the mirror image of these (pure cannot *read* state), so the current gating is
an inconsistency, not deliberate permissiveness.

### State writes

- [ ] **T1-1 Ungate `pure`/`view` cannot write scalar state.**
  `SymbolTableTraversal.ts` `visitStateAssign` (`'pure'/'view' functions cannot modify contract state`, ~14246):
  drop `this.compilerOptions.solidityImportCompat ||` so the check is unconditional. Keep the existing
  `!node.fromModifier && !storagePointerRebind && !storageAliasRebind` guard.
- [ ] **T1-2 Ungate `pure`/`view` cannot `push`/`pop` a state array.**
  `visitStateArrayPush` / `visitStateArrayPop` (`'pure'/'view' functions cannot modify contract state`, ~14310,
  ~14337): same flag removal.
- [ ] **T1-3 Close the sibling write paths the gated checks never covered.**
  `visitStateArrayAssign`, `visitStateArrayDelete`, `visitMappingAssign`, `visitMappingFieldAssign`,
  `visitMappingDelete` have no pure/view check at all (gated or otherwise). Add the same
  `'pure'/'view' functions cannot modify contract state` diagnostic so T1-1/T1-2 are not leaky.
  Verify `visitMappingDelete`'s existing `MappingAccessInConstructorError` ordering stays first.

### Environment and payability

- [ ] **T1-4 Ungate `pure` cannot read environment ops.**
  `visitNullaryOp` (`'pure' functions cannot read '<op>'`, ~13577): keep the `fromInlineAssembly` carve-out for
  `chainid`, drop the flag.
- [ ] **T1-5 Ungate `msg.value` only in payable functions.**
  `visitNullaryOp` (`'msg.value' can only be read by payable constructors or payable public/external functions`,
  ~13590). This predicate is Solidity-shaped (constructor/view/visibility wording); rewrite it against native
  semantics (native default visibility is `external`, constructor is `constructor()`) rather than dropping the
  flag verbatim. Pin both the constructor and the non-payable-entry rejection.
- [ ] **T1-6 Ungate value-bearing deploy requires a payable constructor.**
  `visitInstantiation` (`cannot set deployment value because constructor ... is not payable`, ~13664): drop the
  flag.

### Contract creation and calls

- [ ] **T1-7 Ungate `pure`/`view` cannot create contracts.**
  `visitInstantiation` (`pure or view functions cannot create contracts`, ~13628): drop the flag. Keep the
  existing native stateful-deploy inference below it.
- [ ] **T1-8 Ungate caller↔callee mutability for external calls and function pointers.**
  `validateExternalCallMutability` (~12952) and the indirect/function-pointer spelling in `visitFunctionCall`
  (~13373). Native already enforces this for free functions at parse time (`AstBuilder.ts:1190-1199`), so this
  completes the same rule for contract functions.
- [ ] **T1-9 Ungate `pure`/`view` cannot make state-modifying low-level calls — careful execution.**
  `visitLowLevelCall` (~16743) and `visitLowLevelCallStatement` (~16770): drop the flag. Keep the existing
  carve-outs (`staticcall` allowed; `synthesizedFromLibraryCall` statements exempt). **Execution note:** the
  compat suite has free `view` helpers that do `a.call(d)` and pass today because those helpers are inlined into
  a non-view caller before this traversal runs. After ungating, run the compat external-call and low-level-call
  suites and confirm no non-inlined `view`/`pure` helper (contract or library subroutine) newly reaches the
  check; if one does, add the narrowest carve-out (free/library helper) rather than re-gating.

**Tier 1 pins:** add native (no `solidityImportCompat`) cases. Suggested home:
`packages/solidc/test/Modifiers.test.ts` or a new `packages/solidc/test/PureViewMutability.test.ts`, one case
per item, asserting the diagnostic.

---

## Tier 2 — safety-net validators (implement)

Low-risk correctness nets; native already covers part of each, and the remainder is a genuine gap.

- [ ] **T2-1 Ungate `validateInheritedPrivateFunctionAccess`.** `compiler.ts` ~18193 (called at ~14420).
  Private is private universally; native has `private` + inheritance. Drop from the gated block and run
  unconditionally.
- [ ] **T2-2 Ungate `validateAbstractContractInstantiations`.** `compiler.ts` ~18018 (called at ~14416).
  Mostly redundant with `visitInstantiation`'s unconditional `AbstractContractNotCompilableError` (~13639), but
  covers unresolved/imported cases. Run unconditionally.
- [ ] **T2-3 Ungate `validateKnownUserTypes`.** `compiler.ts` ~18115 (called at ~14419). Native already rejects
  unknown state-var contract types; this also catches unresolved placeholders nested in struct/function types.
  **Execution note:** most likely of the five to surface a false positive if native keeps any placeholder
  alive past import resolution — run a native corpus/example compile sweep before landing.
- [ ] **T2-4 Ungate `validateLibrarySelfExternalCalls`.** `compiler.ts` ~18075 (called at ~14418). Native has
  libraries + `using for`; a library calling its own `public`/`external` member through a self wildcard is an
  external self-call. Verify native library lowering (mostly inline-only) does not make it moot before landing.
- [ ] **T2-5 (optional, low priority) Selfdestruct implies stateful.** `SymbolTableTraversal.ts` ~1479 and
  ~5707 count the raw `selfdestruct` modifier toward statefulness only under compat. Native already covers this
  via `impliedSelfdestruct`, so the gated branch is likely redundant; confirm and either ungated or delete it.

**Tier 2 pins:** native cases in the existing validator-adjacent test files (abstract instantiation, private
inheritance, libraries), or a new `packages/solidc/test/CompatValidatorUngate.test.ts`.

---

## Block oracle uniformity (implement)

Both modes already route `block.timestamp` through the oracle register; the remaining work is verification and
cleaning up the stale divergence text.

- [ ] **B1 Verify both modes use the oracle.** `SynthesizeBlockOracle.visitNullaryOp` maps
  `BLOCK_TIMESTAMP` → `__block_timestamp` unconditionally, and the survey counts every `block.*` read. Already
  pinned by `packages/solidc/test/StructsMappings.test.ts:97` ("routes block.timestamp via the oracle register,
  not tx.locktime"; asserts no `OP_TXLOCKTIME` and that the artifact contains `__block_timestamp`, with
  `solidityImportCompat: true`). Confirm that pin still holds for both modes.
- [ ] **B2 Correct the stale comments** that still describe a removed compat `tx.locktime` mapping:
  `semantic/SynthesizeBlockOracle.ts:42` (header) and `compiler.ts:19109-19111` (split-path comment). Both claim
  compat keeps `tx.locktime`; the code no longer does.
- [ ] **B3 Clarify the `SynthesizeBlockOracle` first constructor arg.** It is named `strictSolidityValidation`
  and receives `solidityImportCompat`, but its only remaining use is the Solidity `<0.7` `now` deprecation error
  (`SynthesizeBlockOracle.ts:196`), not timestamp routing. Rename or re-comment it so it does not read as a
  timestamp switch.

---

## Tier 3 — do not implement (frozen)

These are Solidity-import semantics or Solidity ABI/address framing. Native SolidCash has different, deliberate
behavior. No checkboxes here; do not tick and do not change these gates.

### Literal coercions (`semantic/TypeCheckTraversal.ts`) — do not implement

- `0x…` literal → integer in an integral context (`maybeCoerceHexToInt`, `contextualizeHexArithmetic`) — do not implement
- `0x…` literal → address (`maybeCoerceHexToAddress`) — do not implement
- string literal → right-padded `bytesN` (`maybeCoerceStringToBytesN`) — do not implement
- fixed `bytesN` → wider `bytesM` right-pad (`maybeCoerceBytesWiden`) — do not implement
- integer literal `0` → zero-filled `bytesN` (`maybeCoerceZeroToBytes`) — do not implement
- hex-string literal → `string` (`maybeCoerceHexLiteralToString`) — do not implement
- whole-number literal → fixed-point (`maybeCoerceIntLiteralToFixed`) and mixed fixed/int promotion — do not implement
- unary `-`/`~` on a hex number; unsigned unary-negation rejection; shift > `2^32-1`; array-index `uint256` bound;
  int256 parity for `int & int` — do not implement

### Scoping / redefinition semantics (`semantic/SymbolTableTraversal.ts`) — do not implement

- custom-error name uniqueness; function name vs local error name — do not implement
- function may shadow a free function (native rejects) — do not implement
- param/local/named-return may shadow a state var or function — do not implement
- contract constant may shadow file/global — do not implement
- duplicate-inherited-event-signature and interface event `indexed`-layout checks — do not implement
- bare spelling of a public getter is rejected (`this.m(k)` only) — do not implement
- `C.f(args)` inside `C` is a qualified direct call — do not implement
- `using for` global/UDVT/operator/private/overload rules — do not implement
- `type(uint)`/`type(int)` alias `uint256`/`int256` — do not implement

### ABI / address codegen (`generation/GenerateTargetTraversal.ts`) — do not implement

- EVM ABI word framing for `abi.encode`/`encodePacked`/`encodeWithSelector`; EVM tuple `abi.decode` — do not implement
- external-return EVM ABI tuple decode (`emitEvmExternalResultDecode` sites) — do not implement
- 20-byte address identity projection: address equality, `emitPreferLockingBytecode`, mapping-key identity,
  `emitSolidityValueRecipientLockingBytecode` — do not implement
- `ecrecover` scalar byte-order reversal — do not implement
- low-level-call 32-byte EVM `true` (SafeERC20) — do not implement
- split-facet `nativeLegacyMathFunctions` (BoringMath) — do not implement
- `emitCompatLowLevelCallPin` argument binding — do not implement

### Hidden parameters — do not implement

- `__internal__msgSenderAnchorIdx`, `__internal__graphSelfIdentityInput`, and the `pubkey`/`sig`/`datasig`
  return result fence — do not implement

### Solidity-import features (compiler front end) — do not implement

- `.sol` file resolution as SolidCash sources — do not implement
- `ecrecover` default `'evm'` — do not implement
- `__gap` state-variable drop — do not implement
- `SynthesizePublicGetters` — do not implement
- inferred `delegate` from `initializer`/`reinitializer` — do not implement
- `MarkLegacyCheckedMath` — do not implement
- `expandInheritance` compat mode / root-override trigger; `ValidateDataLocations` strict mode — do not implement

---

## Verification gate

- [ ] Per item: the change lands with its native pin test, and the agent runs its own new/changed test file(s)
  **once** at the end (repo standing rule; no suites, no neighbour lists).
- [ ] Before handoff: one-shot `yarn build` from the worktree root (the root project-reference gate catches
  cross-package mismatches).
- [ ] Before Tier 2-T2-3 and the whole Tier 1 set: a native compile sweep over examples/corpus to confirm no
  native program relied on the previously-permitted shapes. Whoever lands the change runs the full suites.

---

## Final: rename `solidityImportCompat` → `evmCompat`

Do this last, after Tiers 1/2 and the block-oracle item, so the gate sites are edited once rather than twice.

- [x] **R1 Consolidated semantics (decided).** After the rename there is one flag, `evmCompat`, meaning the
  broad Solidity-compat mode: `.sol` import resolution, `pragma solidity`, Solidity literal/type semantics, and
  EVM ABI framing. The current narrow mode (`evmCompat: true` alone = native solidcash with EVM ABI byte parity
  but no `.sol` import or literal coercions) must not survive; no separate flag is kept for it.
- [ ] **R2 Option + front end.** `utils/src/artifact.ts` (fold the two option entries at ~78 and ~89 into one
  `evmCompat`; update both doc comments). `compiler.ts` normalization (~1165 `ecrecover` default, ~1224/1234
  parse cache + `parseCode` mode flag, ~3194/3212 parse and `ImportResolver`), `ImportResolver.ts:12`,
  `compileFile.ts:19`.
- [ ] **R3 Semantic + codegen reads.** `SymbolTableTraversal.ts`, `TypeCheckTraversal.ts` (constructor param),
  `SynthesizeBlockOracle.ts`, `ValidateDataLocations.ts`, `GenerateTargetTraversal.ts`: replace
  `compilerOptions.solidityImportCompat` with `compilerOptions.evmCompat`, and collapse every
  `(evmCompat || solidityImportCompat)` to `evmCompat`.
- [ ] **R4 Consumers + call sites.** `solidcash/src/message-bus/compute-recipe-evaluator.ts` (~225/299/326/369,
  collapse the two flags), `testing/src/config.ts`, `testing/src/builtin-tasks.ts`, `testing/src/hre.ts`,
  `solidhat/src/init.ts` (generated template), scripts (`scripts/regenerate-mistswap-fixtures.ts`,
  `scripts/profile-marketplace-compile.mjs`), and every test/config that passes `solidityImportCompat` or
  `evmCompat`.
- [ ] **R5 Docs.** `SOLIDITY_COMPATIBILITY_0.13.1.md` header ("Applies to: `solidc` 0.13.1 with
  `solidityImportCompat: true`" → `evmCompat`), the framed spec/plan references to `solidityImportCompat`, and
  this plan's own remaining `solidityImportCompat` references.
- [ ] **R6 Verify.** One-shot `yarn build`; run the flag-reader/config tests once
  (`testing/test/config-compat.test.ts`, `project-compiler.test.ts`, `incremental-compile.e2e.test.ts`,
  `compute-recipe-evaluator` coverage, `solidc/test/Casts.test.ts` + `AddressMappingKeyIdentity.test.ts`).
  Pure rename + gate-collapse: no behavior change beyond the flag consolidation.

## Notes

- Do not touch the concurrently-edited `docs/framed/W6_TITLE_SWEEP.md`; stage explicit paths only.
- `git` tip recorded at plan creation: `459af4da3`.
