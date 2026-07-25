# Evaluation: dropping the explicit `delegate` function modifier

> **Status: implemented (option B).** Source no longer needs `delegate`. The compiler emits the delegate build
> as `artifact.delegateArtifact`; the SDK reaches it with `contract.asDelegate()`. Sections 1-5 are the
> evaluation that led there; section 7 records what shipped and what it cost.


Question: Solidity has no `delegate` keyword. An implementation contract is just a contract with ordinary
`public`/`external` functions, and whether it is used standalone or behind a proxy is decided by the *caller*.
Can SolidCash drop `delegate` for source parity?

Answer: not by inference alone. The modifier is not decoration, it selects a different code-generation mode,
and on BCH that mode has to be fixed at compile time. Dropping the keyword is possible, but it means moving the
mode decision somewhere else. Three viable places are evaluated below, with measured costs.

## 1. What `delegate` does today

`delegate` is a codegen mode, not an annotation. Marking a function `delegate`:

- injects an `__internal__proxyMasterIndex` unlocking parameter
  (`SymbolTableTraversal.ts:2026`), which changes the function's ABI;
- at function entry, saves that index to the altstack and emits proxy validation: minting capability, proxy
  self-preservation, and `idx != OP_INPUTINDEX` (`GenerateTargetTraversal.ts:2148-2190`);
- retargets every `this.<field>` read/write from `OP_INPUTINDEX` to the proxy master index
  (`GenerateTargetTraversal.ts:17528-17540` and ~10 further sites);
- skips the function's own full state covenant, including C3 own-category NFT conservation
  (`GenerateTargetTraversal.ts:2480`), because the proxy owns that state;
- disables subroutine sharing for the delegate-sensitive helpers, since `OP_INVOKE` puts a return address above
  the altstack proxy index (`GenerateTargetTraversal.ts:11312`, `13121`, `17449`, `17497`, `17775`).

The last point matters for size: a delegate-mode function cannot use the extracted subroutines that ordinary
stateful functions share.

## 2. Why Solidity does not need the keyword, and BCH does

On Ethereum, `DELEGATECALL` is a runtime opcode. The implementation's bytecode is compiled once and executed
against whatever storage context the EVM hands it. Nothing in the impl's bytecode names the proxy.

On BCH there is no shared execution context. The delegate is a **co-spent input** whose covenant authorizes the
proxy's data-NFT outputs. "Which input holds the state I am writing" is baked into the locking bytecode, so it
must be known when the script is emitted, and the script that writes its own state is a different script from
the one that writes a co-spent proxy's state.

That is why the proxy cannot supply the information either: the proxy's target is a runtime address value, not a
static reference to a contract (`packages/solidcash/test/e2e/Delegatecall.test.ts:57`,
`address impl = address(0x...)`). Even a whole-program / multi-contract compile cannot link proxy to impl,
so there is no source-level signal to infer from. This is a compile-mode question, not a missing primitive.

## 3. The precedent already in the tree

Half of this has already been done. For the `library` keyword, `delegate` is **already** auto-inferred and never
written by the user:

- `AstBuilder.ts:525-531` (imported libraries) and `AstBuilder.ts:595-606` (root-compiled libraries):
  a library that declares shared state gets `DELEGATE` pushed onto every `public`/`external` function.
- The comment there states the intent verbatim: "Solidity has no `delegate` keyword - a library's public
  functions are delegatecalled implicitly."

Inference is sound there because a `library` never has state of its own. Its state declarations *are* the
consumer's layout, so delegate mode is the only meaningful mode. A `contract` is genuinely ambiguous: the same
source is a valid standalone stateful contract and a valid proxy implementation.

Practical consequence: explicit `delegate` in real source is already rare. Only 3 `.scash` files in the repo use
it (`test/valid-contract-files/delegate_function.scash`, EA's `MarketplaceV1.scash`, `MarketplaceDataV1.scash`),
plus inline sources in 3 test files.

## 4. Options for dropping it, with measured cost

Sizes below are real script bytes (`scriptToBytecode(asmToScript(artifact.bytecode))`), same source compiled
with the functions marked `delegate` vs `public`:

| contract | delegate mode | standalone mode | both in one script |
|---|---|---|---|
| 1 state var, 1 fn | 623 B | 515 B | 1138 B (2.21x) |
| 4 state vars incl. mapping, 3 fns | 2754 B | 1948 B | 4702 B (2.41x) |

Note delegate mode is *larger* than standalone despite skipping its own covenant: the lost subroutine sharing
outweighs the skipped checks as soon as there is more than one function.

### Option A: dual-mode in a single script

Emit both entry variants under one dispatch and pick at unlock time based on whether the proxy-index witness is
supplied. This is the truest parity: one artifact, one address, usable standalone and as an impl, exactly like
Solidity.

Cost: 2.2x to 2.4x the standalone script, per the table. Against the 10 KB script/stack limit that is fatal for
anything real. The EA port already sits at the limit (see `ea_deploy_wall`). Rejected on size.

### Option B: two bytecodes from one source (recommended)

Keep one keyword-free source. The compiler emits the standalone artifact and, for every delegate-eligible
function set, a second `delegateBytecode` + delegate ABI in the same artifact. The SDK's `withDelegatecall`
instantiates the impl from the delegate variant.

- Source parity: complete. No SolidCash-only keyword.
- Script size: unchanged. Each deployed script is single-mode.
- No flag, so it does not conflict with the no-implicit-gating rule (both variants always emitted).
- Eligibility replaces today's hard errors: `view`, `pure`, `internal`, `private`, `deploy`, `upgrade`,
  `selfdestruct`, `split`, `merge`, and bodies containing `delegatecall` simply get no delegate variant
  (`SymbolTableTraversal.ts:2621-2736` currently throws `InvalidModifierCombinationError` for each). That is
  strictly friendlier than erroring.
- Costs: compile time roughly doubles for stateful contracts (relevant to the 3952-contract corpus bench);
  the artifact schema grows a second bytecode/ABI; the impl's delegate-variant p2sh32 differs from its
  standalone p2sh32, so `deployFrom` / `upgrades.ts` must choose deliberately. In Solidity the impl has one
  address; here it has two, and only the delegate one is usable behind a proxy.

### Option C: contract-level compile option

`compilerOptions.delegateImplementation: true` selects the mode; source stays keyword-free. Cheapest to build,
and the mechanism already exists (`brandLibrary` is exactly this shape, `compiler.ts:177`).

Rejected as the primary answer: it gates a behavior behind a flag, which is against the standing preference for
defaults-on and no implicit gating. Worth keeping as an *override* on top of option B if one wants to suppress
the second compile for build speed, but that should be an explicit ask.

### Option D: heuristic inference on `contract`

Extend the library rule, e.g. "a contract whose public functions all touch state and which declares no
constructor". Unsound: it silently converts ordinary stateful contracts into non-deployable implementations, and
the failure is a covenant that skips its own state verification. Rejected.

## 5. Blast radius for option B

60 decision sites reference the modifier outside generated grammar files:

| file | sites | nature |
|---|---|---|
| `solidc/src/generation/GenerateTargetTraversal.ts` | 23 | the codegen mode itself; unchanged, just driven per-variant |
| `solidc/src/semantic/SymbolTableTraversal.ts` | 26 | 11 mutual-exclusion errors (2621-2736) plus the delegatecall check (1981) become eligibility predicates |
| `solidc/src/ast/AstBuilder.ts` | 4 | existing library auto-marking; becomes the general path |
| `solidc/src/compiler.ts` | 1 | branded-library gate; needs the second compile pass |
| `solidc/src/artifact/Artifact.ts` | 1 | `STATE_WRITING_MODIFIERS`; second artifact section |
| `solidc/src/semantic/SynthesizeLibraryDelegateCalls.ts` | 1 | `L.f()` sugar; unchanged |
| `solidcash/src/Contract.ts` | 1 | `soleFnIsProxyImpl` dispatch decision |
| `solidcash/src/stateful/upgrades.ts` | 2 | initializer-must-be-delegate check |

Grammar work is small: remove `'delegate'` from the `functionModifier` rule (`SolidCash.g4:253`) and regenerate
with `yarn antlr`. The `anyIdentifier` soft-keyword entry (`SolidCash.g4:58`) stays either way; it is what keeps
`delegate` usable as a plain variable name, exactly as Solidity does. Keeping the modifier accepted-but-deprecated
for one release is cheap and avoids breaking the 3 `.scash` files and the EA port.

## 6. Recommendation

Drop the keyword via option B, in two steps:

1. **Deprecate, do not remove.** Keep `delegate` parsing and honor it as an explicit "emit only the delegate
   variant" hint. Nothing breaks.
2. **Emit both variants by default** for stateful contracts whose functions are delegate-eligible; teach the SDK
   (`withDelegatecall`, `upgrades.ts`, `Contract.ts:104`) to select the delegate variant. Then remove the
   keyword from the grammar and update the 3 `.scash` files, 3 test files, and
   `docs/delegatecall.md` / `docs/modifiers.md` / `docs/library-contracts.md`.

## 7. What shipped

- `solidc/src/semantic/AutoMarkDelegateFunctions.ts` — marks the proxy-implementable functions, run just before
  `SymbolTableTraversal` so the function set is final (after inheritance / modifier / getter expansion).
- `solidc/src/compiler.ts` — `attachDelegateVariant` compiles the source a second time under the internal
  `autoDelegate` option and hangs the result off `artifact.delegateArtifact`. Guarded by an ABI pre-filter, one
  level deep, warnings suppressed on the second pass, and never able to fail a valid standalone compile.
- `utils/src/artifact.ts` — `Artifact.delegateArtifact`, `CompilerOptions.autoDelegate`.
- `solidcash/src/Contract.ts` — `asDelegate()`.
- `solidcash/src/stateful/StatefulContract.ts` — `withDelegatecall` now rejects a standalone build with a
  message naming `asDelegate()`, instead of silently building a transaction whose proxy writes are unauthorized.
- `solidcash/test/e2e/DelegateInferred.test.ts` — 12 tests: variant emission and eligibility, `asDelegate()`,
  the mis-wiring guard, and three on-chain executions mutating proxy state from keyword-free source.

Verification: the inferred build is **byte-identical** to the hand-written `delegate` version on every case
tried (single function, multi-function with a mapping, and the `delegate_function.scash` fixture). Regression:
solidc 2250/2250, solidcash 3191 passed / 0 failed.

Cost, measured over the 300 `valid-contract-files` fixtures: 71 get a delegate build, and total compile time
goes 7.3s -> 12.4s (+69%). The skipped 229 are cheap contracts, so in practice a contract that *could* be an
implementation costs about 2x to compile. Tightening the pre-filter barely moved it (73 -> 71 variants), because
the cost is inherent: with no keyword, every plausible implementation must be prepared. The way to remove most
of it is to stop re-running the front end - clone the AST at the marking point (late, just before
`SymbolTableTraversal`) and run only the back half twice. That needs a prototype-preserving deep clone of the
AST, which does not exist yet.

## 7b. Audit follow-up

A review pass widened eligibility and added multi-contract support. Auditing it produced these corrections:

- **`compileStringMulti` now attaches a variant per contract** (was missing entirely). Verified: each artifact
  gets its own correctly-named variant.
- **Typed external calls were dead code.** The added walk looked for `ExternalFunctionCallNode`, which is only
  constructed inside `SymbolTableTraversal` - after this pass runs. It could never match. Removed, because the
  premise was also wrong: an external call mutates the callee's state, never the proxy's.
- **Overload regression in `withDelegatecall`.** Matching the first ABI entry by name rejected a legitimate
  delegate call when a `view` overload was declared first. Now accepts when any overload is eligible.
- **Transfers and token-container operations are excluded.** They are marked-but-broken: the delegate input
  fails an OP_VERIFY at broadcast. Confirmed pre-existing (identical failure with the hand-written modifier) and
  confirmed to poison the whole function (state write + transfer fails too). Failing closed at build time beats
  an opaque revert.

The on-chain matrix that drives the rule, now a permanent regression test:

| form | delegate mode |
| --- | --- |
| state write | executes |
| emit | executes |
| state write + emit | executes |
| low-level call | executes |
| value transfer | fails covenant -> excluded |
| state write + value transfer | fails covenant -> excluded |
| token-container op | fails covenant -> excluded |

## 8. Caveat

Option B gives *source* parity, not *deployment* parity. Solidity's
impl has one address that works both ways; here the two modes remain two scripts with two addresses, and the
user picks by how they deploy. Option A would close that gap but costs 2.2x to 2.4x script size, which the 10 KB
limit does not allow today. If subroutine sharing were made delegate-safe (the altstack/return-address conflict
at `GenerateTargetTraversal.ts:11312`), the dual-mode multiplier would shrink and option A should be re-measured.
