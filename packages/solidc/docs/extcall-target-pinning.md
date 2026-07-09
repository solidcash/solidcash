# Sound external-call target pinning (state-var & constant targets)

Status: DESIGN (not implemented). Supersedes the reverted Phase-1 forgery attempt (commit `a6cf8435`).

## 1. Problem

`IContract(addr).method()` compiles only when `addr` is a **constructor/function parameter** (an
`IdentifierNode`). Any other target form throws:

```
external call target address must be a constructor/function parameter
```

Thrown at `GenerateTargetTraversal.ts:11061` inside `emitExternalCallVerification` (the identity check),
reached because `SymbolTableTraversal.collectExternalCalls` (~`:3075`) sets
`slot.addressParam = addressExpression instanceof IdentifierNode ? name : undefined` — so a
`StateAccessNode` (state-var target) or a `HexLiteralNode` (address literal) leaves `addressParam`
undefined.

Corpus cost: the `external call target address must be...` cluster is **19 files** at bench 3826. Not all
are recoverable (see §7), but the state-var and literal forms are.

### 1.1 Why the current identity check needs a stack slot

`emitExternalCallVerification` (`GTT:11013`) proves the co-spent callee is the intended target:

```
<B_master_inputIdx> OP_UTXOBYTECODE            // B's master locking bytecode
<addrParamIdx+2> OP_PICK                        // expected address, PICKed from a stack slot
OP_EQUALVERIFY                                  // they must match
```

The expected address is **picked from a stack slot** (`slot.addressParam`, `GTT:11064-11067`). A
parameter or a synthesized local sits on that stack; a state var or a literal does not. The fix is to
**source the expected address from somewhere the caller cannot choose**, not from a caller-supplied stack
slot.

## 2. Soundness model (recap)

The external-call security rests on two facts (see `docs/external-contract-calls.md`,
[[external_call_dispatch_model]]):

1. **Co-spend + self-pin.** The callee's master UTXO is an input to the tx, so **its own covenant runs**.
   Every stateful contract self-pins its category (Stage 1), so a fabricated fake-category UTXO at the
   address is unspendable. Any co-spent UTXO that passes self-pin is therefore genuine (genuine code +
   genuine state).
2. **Caller identity check.** The caller does one `OP_UTXOBYTECODE(input) == addr` — binding the co-spend
   to *the intended address*. The callee did the integrity; the caller only asserts *which* callee.

**The forgery Phase-1 introduced:** it lifted the target to a caller-supplied
`__internal__extTarget_N` parameter and pointed the identity check at it. Then `addr` was whatever the
**caller** passed, so `IFoo(0xUniswap).m()` could be redirected to a fake contract — the identity check
verified "co-spend == caller's choice", which is no check at all. The user caught this and it was reverted.

**Invariant this design must preserve:** the expected address in the identity check must be a value the
**contract author fixed** (a constant baked into the code) or a value the **contract itself controls**
(self-pinned state) — never a per-call caller input.

## 3. Target forms and their sound treatment

| Form | `addressExpression` | Sound source of expected address | Production behavior |
|---|---|---|---|
| Function/ctor parameter | `IdentifierNode` (param) | PICK the param (unchanged) | Caller supplies; already sound because the caller *is* the party choosing whom to call in that shape |
| Interface-typed state var `token.m()` | rewritten to `__extaddr_` local | PICK the local, which is loaded from self-pinned state | Sound today (`SynthesizeExternalAddressLocals`) |
| **Plain-`address` state var behind a cast `IFoo(sv).m()`** | `StateAccessNode` (via a cast) | Read `sv` from self-pinned state into an `__extaddr_` local | **New (§4.1).** Sound: state is deployer-set + self-pin-preserved |
| **Address literal `IFoo(0x..40..).m()`** | `HexLiteralNode` (20 bytes) | Push the literal bytes as a constant in the covenant | **New (§4.2).** Compiles; **un-satisfiable** in production (a 20-byte ETH address is not a 35-byte BCH locking bytecode → `OP_UTXOBYTECODE == <20B>` can never hold) |
| **`address constant ADDR`** | folds to `HexLiteralNode` | Same as literal | **New (§4.2).** Same un-satisfiable pin |

The two production-relevant properties:

- A **state-var** target is *callable in production* (the stored address can be a real BCH contract) and
  *debug-seedable* (an SDK debug harness can seed a mock's address into the slot at genesis).
- A **literal/constant** target *compiles but is un-callable* in production (correct: a hardcoded
  cross-chain ETH address has no BCH contract) and is *not* debug-seedable (it is baked). This is the
  faithful outcome — the reference exists in the ABI/type system but any spend that tries to satisfy it
  fails closed.

## 4. Compiler design

### 4.1 State-var targets — reuse `__extaddr_` (no covenant change)

`SynthesizeExternalAddressLocals` already rewrites `token.m()` (interface-typed state var) into
`IERC20 __extaddr_token = token; __extaddr_token.m()`. The local is an `IdentifierNode` → becomes a valid
`addressParam` that the dispatch PICKs, and its value is read from this contract's **self-pinned** state.
No codegen or dispatch change is needed for the local form.

Extend it to two more shapes:

1. **Cast on a plain-`address` state var:** `IFoo(sv).m()` where `sv` is a plain `address` state var (no
   `interfaceName`). Today `externalTargetStateVar` (`SynthesizeExternalAddressLocals.ts:114`) only
   recognises a bare interface-typed var or a *same-interface* redundant cast. Add: a
   `FunctionCallNode` cast `IFoo(sv)` where `sv` is a plain-`address` **state var** and `IFoo` is an
   interface/contract name → synthesize `IFoo __extaddr_sv = sv;` and rewrite the target to
   `__extaddr_sv`. The synthesized local carries the cast's interface type so dispatch resolves the
   callee ABI.
   - Track plain-`address` state vars separately from `stateVarIface` (which is interface-typed only).
   - The decl initializer reads `sv` (a `StateAccessNode` at codegen) into the local — the same sound
     read the interface-typed path already relies on.

2. **`address(new D())` pushed into state, then `D(sv).m()`:** out of scope for the first cut (see §7);
   the target `ss[0].d` is a nested array-struct read, not a simple state var. Handle only
   single-state-var targets initially.

**Where:** `SynthesizeExternalAddressLocals.ts` only. Runs pre-semantic, so the synthesized decls resolve
normally and every downstream pass (collectExternalCalls, dispatch) sees a clean `IdentifierNode` target.
Zero covenant/metadata surgery for this form.

**Constructor caveat:** the pass already skips the constructor (a local would read the state var before
the constructor assigns it). External calls *inside a constructor* (the `external_call_from_constructor_*`
files) stay unsupported — see §7.

### 4.2 Literal / constant targets — push a baked constant in the covenant

For a `HexLiteralNode` target (or a constant that folds to one), record the literal bytes on the slot and
push them in `emitExternalCallVerification` instead of PICKing a param.

1. **Metadata.** Add `addressLiteral?: string` (hex) to `ExternalCallSlot` (SymbolTableTraversal) and to
   `ExternalCallAbi` (`utils/artifact.ts` — `addressStateVar` already lives there at `:282`, mirror it).
   Set it in `collectExternalCalls` when `addressExpression instanceof HexLiteralNode` (and for a
   constant, resolve via the constant map to its literal bytes — reuse the const-folding path).

2. **Codegen.** In `emitExternalCallVerification` (`GTT:11059-11067`), replace the
   `if (!addrName) throw` with a three-way source of the expected address:
   - `addrName` present → `OP_PICK` (unchanged).
   - `slot.addressLiteral` present → push the literal bytes directly
     (`this.emit(hexToBin(slot.addressLiteral))`), then `OP_EQUALVERIFY`. No stack-index math (it is a
     fresh push, so the `+2` untracked offset does not apply — push then compare).
   - neither → throw (unchanged, now only for genuinely unsupported shapes).

3. **Soundness.** The pushed value is a compile-time constant baked into the covenant — the caller cannot
   influence it. A 20-byte value can never equal a 35-byte `OP_UTXOBYTECODE` result, so the identity
   `OP_EQUALVERIFY` fails on every spend. The call **compiles** (the type/ABI is faithful) but is
   **un-satisfiable** — exactly right for a hardcoded cross-chain address. If a future author wants a
   real 35-byte BCH locking-bytecode literal, the same mechanism calls it for real (the push equals the
   co-spend's bytecode when a genuine callee is co-spent).

### 4.3 What does NOT change

- The dispatch, co-spend, self-pin, return-event, and outState covenants are untouched.
- Parameter targets and interface-typed-state-var targets keep their exact current bytecode.
- No new AST field on `FunctionDefinitionNode`, no `SyntheticExternalTarget` (the reverted Phase-1
  plumbing). Everything rides the existing `externalCalls` metadata.

## 5. SDK debug-mode seeding (state-var targets only)

**There is no "debug covenant."** Seeding a state variable at genesis is a capability the deployer *always*
has (it is just initial state). "Debug mode" names a convenience: the SDK's mock registry wires up the
co-spend of a mock contract for a seeded target. The emitted script is byte-identical whether you seed a
mock or a mainnet address, so nothing debug-only can leak into production — a mainnet deployer who
initialises `sv` to some address is simply deploying a contract that calls that address, which is a normal
deployment choice, not a relaxation. The forgery in Phase-1 was a *per-call caller witness*; a genesis
seed is a *deploy-time deployer choice* — categorically different.

The *only* difference between a debug run and production is which address the deployer seeds at genesis.

- Add an opt-in provider flag, e.g. `MockNetworkProvider({ mockExternalTargets })` mapping a state-var
  name (or the deployer-intended address value) to a **mock contract's BCH address**.
- For a **state-var** target: at genesis, seed the state slot with the mock's address instead of the real
  value. The covenant reads it from self-pinned state, the mock UTXO is co-spent (reuse the existing
  external-call co-spend path with `addressParam = __extaddr_sv`), identity matches, the call runs.
- For a **literal** target: un-seedable (baked). Debug testing a literal target needs a bytecode patch or
  a refactor-to-state-var. Document this; do not add a permissive path.
- Mock **graph** for chaining (a mock factory's `getPair` returns a registered mock's address) is a later
  step — the same auto-derivation machinery ([[auto-derivation doc]]) that supplies
  `__internal__extTarget`-style params today.

Debug mode never relaxes the covenant. "Which address the harness seeds" is an SDK-level, debug-only
choice; the on-chain script is byte-identical to production. No forgery is introduced.

## 6. Soundness argument (per form)

- **Parameter:** unchanged; the caller choosing the target *is* the intended semantics for
  `IFoo(paramAddr).m()`.
- **State var:** the expected address is read from the contract's own self-pinned master commitment
  (`emitReadCurrentStateValueEncoded`, `GTT:2535`: `emitMasterInputIndex` → `OP_UTXOTOKENCOMMITMENT`, with
  the multi-NFT anti-substitution tag). That state is (a) deployer-set at genesis and (b)
  self-pin-preserved: a spend that mutates the slot must satisfy the write covenant, which only the
  contract's own authority path allows. A *caller* cannot substitute it.
  - **Author-semantics boundary (not a hole):** if the contract exposes a *permissionless setter*
    (`function setTarget(address a) { sv = a; }`), then any user can change the target — but through the
    contract's own code, exactly as in the EVM. The compiler's guarantee is narrow and correct: **the
    call goes to whatever the genuine self-pinned state holds.** Write access control is the author's
    responsibility, identical to EVM `sv = a`. This is fundamentally different from the Phase-1 forgery,
    where the target was a *per-call transaction witness* chosen at spend time with no state write and no
    covenant at all.
- **Literal/constant:** the expected address is a code-baked constant; caller-independent by construction.
  Un-satisfiable for a non-BCH-locking-bytecode value → fails closed. A genuine locking-bytecode literal
  is called for real.

The forgery vector (caller-chosen target) is structurally absent: no per-call caller input feeds the
identity check in any of the three sound forms.

## 7. Corpus scope (honest)

Of the 19 files in the cluster at bench 3826:

- **Recoverable now** (state-var / literal, single-var, non-constructor): the plain-`external_call_state_var_address_inside_*`
  and any literal-target files. Estimate a handful.
- **Constructor external calls** (`external_call_from_constructor_*`): a constructor calling an external
  contract. On BCH the callee must be co-spent at spend time; a constructor runs at *deploy*. These are
  the deploy-then-call class ([[deploy_then_call_fold]]) and stay unsupported here.
- **Nested-state targets** (`external_call_state_var_address_inside_array_struct_*` = `D(ss[0].d).m()`
  with `new D()`): the target is an array-struct field read plus a `new` deploy — not a single state var.
  Deferred to a follow-up that reads a computed state location into `__extaddr_`.
- **Low-level `.call`/`.staticcall`** (`bare_call_no_returndatacopy`, `staticcall_for_view_and_pure`,
  `precompiles_ignoring_trailing_input`): these route through the low-level path; check whether the target
  is a param/state-var/literal and apply the same §4 treatment, but several target EVM precompiles
  (address `0x1`..`0x9`) which are fundamentally absent on BCH → literal pin (compiles, un-satisfiable).
- **Not actually address-target** (`018_forward_function_reference`, `096/099_access_to_*`): these
  matched the error string loosely; verify individually — some are unrelated name-resolution cases.

**Expected sound bench delta: small (a few files), but the value is correctness parity** — the state-var
and literal target *forms* become expressible and sound, which is a real language capability the port is
currently missing, and the mock-seeding unlocks debug e2e for the whole external-call surface.

## 8. Test matrix (the merge gate)

Happy-path is insufficient — the acceptance gate is adversarial (mirrors
`docs/external-contract-calls.md` §10):

Positive:
1. `IFoo(addrStateVar).m()` reads a value from a real co-spent callee (mocknet e2e, value-checked).
2. `addrStateVar.call(payload)` low-level form.
3. Literal target compiles; the artifact records `addressLiteral`; a debug attempt to *call* it fails
   (un-satisfiable), while a state-var target with a seeded mock succeeds.

Negative (must FAIL closed):
4. **Target substitution:** a caller co-spends a *different* contract than the state var names → identity
   `OP_EQUALVERIFY` fails.
5. **State forgery:** a caller tries to spend with a mutated address slot (no authority) → write covenant
   rejects.
6. **Literal redirect:** no seed can make a literal target call a chosen contract (baked constant).
7. **Category forge / fake-category UTXO at the address** → callee self-pin rejects the spend.

Compiler-level: the throw remains for genuinely unsupported shapes; a regression test asserts the
parameter and interface-typed-state-var bytecode is byte-identical (no drift).

## 9. Phasing

1. **P1 — state-var targets (compiler):** extend `SynthesizeExternalAddressLocals` (§4.1). No covenant
   change. Unblocks the simple `IFoo(sv).m()` files. VM-verify with an existing-mechanism e2e.
2. **P2 — literal/constant targets (compiler):** metadata + `emitExternalCallVerification` push (§4.2).
   Un-satisfiable pin. Compile-guard + a negative e2e (literal can't be redirected).
3. **P3 — SDK debug seeding (§5):** mock registry + genesis seed for state-var targets; minimal
   `IOracle(sv).read()` e2e first, then a chained mock graph.
4. **P4 — nested-state & low-level targets:** computed-state-location reads into `__extaddr_`; low-level
   `.call` target-form parity. Constructor-external-calls stay out (deploy-then-call class).

## 10. Open questions

- **Constant folding for `address constant`:** does the const map already fold an `address constant` to
  its 20-byte literal at the point `collectExternalCalls` runs? If not, P2 needs the constant resolved
  first (reuse the `bytes.concat` const-fold path added in `d6b11acb`).
- **Nested-state read into `__extaddr_`:** the cleanest sound read for `ss[0].d` is
  `emitReadCurrentStateValueEncoded` (`GTT:2535`) generalised to a computed location — decide whether to
  route through a synthesized local (uniform with §4.1) or read directly in the identity check.
- **`address(this)` and self-calls:** confirm these already resolve (they route through the self-external
  `this.f` path, not this target-address path) and are unaffected.

## 11. Security reevaluation

Adversarial pass over the design (the reverted Phase-1 shipped a caller-choice forgery, so happy-path
reasoning is not enough).

### Verdict

**Fundamentally sound.** The forgery vector — a per-call value the *caller* chooses at spend time feeding
the identity check — is structurally absent in all three sound forms:

- parameter: the caller choosing the target *is* the semantics of `IFoo(paramAddr).m()`;
- state var: sourced from the contract's genuine self-pinned commitment, caller cannot mutate it;
- literal/constant: a code-baked constant, caller-independent by construction.

No new value that the caller controls at spend time is admitted into `emitExternalCallVerification`.

### Attacks considered and why they fail

1. **Target substitution** (caller co-spends a contract other than the state var / literal names): the
   identity `OP_EQUALVERIFY` (co-spend bytecode vs sourced address) rejects → fail-closed. Unchanged from
   param targets.
2. **State forgery** (caller presents a contract UTXO with a doctored `sv`): a UTXO carrying the
   contract's category exists only if it passed the contract's own write covenant (Stage-1 self-pin,
   inductive from genesis). So `sv` can only hold what the contract's own logic wrote. The read
   (`emitReadCurrentStateValueEncoded`) additionally verifies the multi-NFT index tag. Caller cannot
   inject a value.
3. **Literal redirect** (make a literal target call a chosen contract): impossible — the expected address
   is a `this.emit(<baked bytes>)` push; no seed or witness feeds it. The SDK has **no lever** on a literal
   slot: even if it co-spends a mock, the covenant compares the co-spend against the baked literal, not the
   mock, so the spend fails. Un-seedable by design.
4. **Length equivocation on the literal** (make a 20-byte value satisfy the 35-byte check): `OP_EQUAL` is
   an exact byte-and-length match; a 20-byte push can never equal an `OP_UTXOBYTECODE` result. The
   un-satisfiability premise depends on the callee being a **stateful (self-pinning) P2SH32** contract
   (35-byte locking bytecode) — which every external-call target is, since address dispatch requires
   self-pin. A *genuine* 35-byte locking-bytecode literal is callable and sound (baked ⇒ caller-independent).
5. **Category/fake-category UTXO at the address** (fabricate a same-bytecode UTXO with an attacker category
   + lie state): the callee's own self-pin (Stage 1/2) rejects the spend; a fabricated UTXO is unspendable
   so it can never be a valid co-spend input. Unchanged from the shipped model.
6. **Debug seed leaking to production:** there is no debug-only covenant (§5). A genesis seed is a
   deploy-time deployer choice; the script is identical to production. Nothing to leak.
7. **Reentrancy / cross-call state consistency:** BCH scripts are flat and atomic (no temporal invoke), so
   the EVM reentrancy class is structurally absent; the external call reads the *input* (pre-tx) `sv`.

### ABI-shape trust is INHERITED, not introduced

The identity check binds the co-spend to an *address*, not to a proof that the co-spent contract implements
`IFoo`. A mismatched-shape callee (wrong selector / data-NFT count / return layout) is caught fail-safe by
the existing dispatch (selector verify + wrong-input read fails loudly — see
[[external_call_dispatch_model]]), exactly as for a parameter target. State-var and literal targets do not
weaken this; they reuse the same downstream verification untouched.

### Implementation-discipline requirements (a bug here IS a hole)

These are not design weaknesses but MUST be enforced or they reintroduce risk:

- **Conservative collect — preserve the throw.** `collectExternalCalls` must set `addressLiteral` /
  `addressStateVar` **only** for an exactly-recognised `HexLiteralNode` (or a constant that provably folds
  to one) / a recognised self-pinned state var. Every other `addressExpression` shape MUST leave both
  unset so `emitExternalCallVerification` still throws. A permissive collect that guesses a source would
  emit an identity check against an unintended value — the exact class of the reverted bug. The three-way
  in `emitExternalCallVerification` must have **no silent fall-through**: param → PICK, literal → push,
  state → local/read, else → throw.
- **Per-interface synthesized locals.** `IFoo(sv).m()` and `IBar(sv).n()` on the same plain-address `sv`
  must synthesize *distinct* locals keyed by interface (`__extaddr_sv_IFoo` / `__extaddr_sv_IBar`), or the
  ABI resolution of one clobbers the other. Not a forgery (both read genuine `sv`), but a correctness bug.
- **No new caller-supplied param.** Do NOT reintroduce a `__internal__extTarget_N` parameter for any of
  these forms (that was the Phase-1 mistake). State targets ride the `__extaddr_` local (value from state,
  not a witness); literals ride a baked push.

### Residual behavioral notes (completeness, not security)

- **Up-front unconditional verification.** All external-call slots are verified at function entry
  (`emitExternalCallVerification`), not inside the branch where the call textually sits. So an
  un-satisfiable literal call makes the *whole function* uncallable even when it is in a dead branch
  (`if (false) IFoo(0xLit).m();`). This differs from EVM (dead code does not run) but fails **closed**, so
  it is a completeness gap, not a soundness one. Consider a compile-time diagnostic when a function
  contains a provably-un-satisfiable literal call.
- **Same-tx read of `sv`.** The external call uses the input (old) `sv`, not a value written earlier in the
  same tx — a known same-tx-read limitation, not specific to this feature.

### Merge gate

Ship only behind the §8 adversarial matrix (attacks 1, 3, 5 above are the load-bearing negatives), plus a
byte-identical-bytecode regression for the untouched param / interface-typed-state-var paths.
