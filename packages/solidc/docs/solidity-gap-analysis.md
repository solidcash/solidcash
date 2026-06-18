# Solidity parity: gap analysis and roadmap

Status: analysis, 2026-06. Compares SolidCash against the Solidity language reference
(`/Code/solidity/docs`, commit 816d9b2) to position SolidCash as the closing-the-gap BCH
language. Categories below:

- **IMPLEMENT** - feasible and valuable on BCH/UTXO; should be built.
- **ALIGN** - exists but diverges from Solidity in syntax/semantics; bring into line (or fix docs).
- **N/A** - EVM-execution-model specific (accounts, gas, storage slots, message calls); document as
  intentionally unsupported, with the BCH substitute.

## Progress (2026-06)

Implemented so far (branch `solidcash_v0.13.1`): short-circuit `&&`/`||` (+ conditional-var-leak fix)
and the try/catch warning (ALIGN); compound assignment, `x[a:b]` slice, `require(cond, Error())`,
enum<->int casts + enum-typed params with full SDK encode/decode, `addmod`/`mulmod` (Category A).
Each shipped with a VM-level e2e test. Remaining Category A: tuple-destructuring expressiveness,
named call args, named returns, bytesN ordering/index, integer bitwise. Then Category B (function
types et al.). See per-row Status markers below.

## Where SolidCash already matches or exceeds Solidity

Syntax/OOP parity is high. SolidCash already has: structs (file-level, nested, partial field
assignment, named-arg init), enums (with custom values - exceeds Solidity), user-defined value types
+ operator overloading, custom errors, events (indexed, anonymous), interfaces (carry state vars +
collections for covenant reads), libraries, free functions, `using ... for`, compile-time
inheritance (`is`, abstract, parent constructor args), modifiers (multiple, args, `_` placeholder),
fallback/receive, constructor, function overloading, `unchecked`, the `abi.*` family
(encode/encodePacked/encodeWithSelector/encodeWithSignature/encodeCall, decode, decodeAt),
`bytes.concat`/`string.concat`.

It **exceeds** Solidity in: functional fixed-point (`fixed128x18` with scale-correcting math -
Solidity declares but cannot use fixed point), iterable mappings (`for-of` / `for-in` /
`.entries`), `switch` statement, collection-iteration loops, custom enum values, string-manipulation
methods (`.slice`/`.split`/`.reverse`/`.length`/`+`), `date(...)` literals, and full tx
introspection (`tx.inputs[i]` / `tx.outputs[i]` fields, `this.activeBytecode`, etc.).

The remaining gaps are bounded. They are listed below.

## Category A - IMPLEMENT: quick ergonomic/syntactic parity (low risk)

| Status | Gap | Notes |
|--------|-----|-------|
| DONE `71ac1c45` | Compound assignment `*= /= %= &= \|= ^= <<= >>=` | Desugar `x op= e` -> `x = x op e`; inherits the binary op's type rules. |
| DONE `ecb01192` | `x[a:b]` index-range sugar | Lowers to the existing `SliceNode` (byte-identical to `.slice`). |
| DONE `86ec5f9b` | `require(cond, CustomError(args))` | Reuses the revert custom-error machinery; error is tooling metadata on BCH. |
| DONE `86fedba1` `86046e99` | Enum <-> int conversion + enum-typed params/vars | `Color(i)` range-checked, `int(c)`; fixed the pre-existing enum-param crash; SDK encode/decode (`33caf817` `406fdca9`). |
| DONE `a1aba265` | `addmod` / `mulmod` | `(x+y)%k` / `(x*y)%k` (no wrap on BCH BigInt). |
| DONE `b6ee313c` | Tuple destructuring with skipped slots `(, x) = f()` | Empty-slot grammar; codegen drops skipped values via the altstack (declared -> altstack, skipped -> drop, restore + name). |
| TODO | Tuple assignment to existing lvalues + swap `(x,y)=(y,x)` | LHS is declaration-only; swap also needs RHS tuple expressions `(y,x)`. |
| DONE (already worked) | Multi-return destructuring from **user** functions `(a,b)=myFn()` | Verified: `(int a, int b) = userFn()` and `= b.split(4)` both compile/run. Declarations only. |
| DONE `fd8f2dcf` | Named args for arbitrary calls `f({b:2,a:1})` | Reorder to declared params in SymbolTable; single-target only (overloaded+named errors). |
| DONE `e0334f3c` | Named return values `returns (int sum)` | Desugared (NamedReturnTransformation) to default-init locals + `return <names>;`; bare `return;` returns them. Requires an explicit `return;`. |
| PARTIAL | bytesN single-byte index `b[k]` DONE; ordering `< <= > >=` TODO | Index extracts the byte via SPLIT (literal + variable). Ordering deferred - needs a byte-order/sign semantics decision (like integer bitwise). |
| TODO | Integer bitwise `& \| ^ ~` | Needs a defined sign-magnitude/byte semantics decision before building (only genuinely new capability; riskiest). |

## Category B - IMPLEMENT: substantial features

| Gap | Value | Notes |
|-----|-------|-------|
| **Internal function types / function pointers** `function(...) returns(...)` | High / novel | Newly feasible on BCH-2026: the compiler already mints per-function `functionId`s and calls via `OP_INVOKE`. A function value is that id on the stack; an indirect call is `OP_INVOKE <id>`. Unlocks callbacks, strategy dispatch, higher-order helpers, table-driven dispatch. **Internal only** - external function types (address+selector) stay N/A. |
| `super.f()` and qualified `Base.f()` parent calls | Med | Inheritance is flattened at compile time; today only constructor-arg forwarding exists. Needed for mixin/template (OZ-style) porting. |
| Real C3 linearization | Med | Current impl is depth-first left-to-right flatten with diamond-collision rejection, **not** C3 MRO (`InheritanceExpansionTransformation.ts:160-275`). Either implement C3 or correct the docs (see ALIGN). |
| Make `virtual` meaningful + explicit `override(A,B)` | Med | `virtual` is currently a no-op (everything implicitly overridable); `override` base-list form missing (`SolidCash.g4:200`). Safety + fidelity for diamonds. |
| `type(C).creationCode` / `runtimeCode` | Med | BCH analog = child redeem/locking bytecode. `deployFrom`/create3 plumbing exists in the SDK; a compile-time accessor enables on-chain factory patterns. |

## Category C - ALIGN: semantic divergences and doc fixes

| Item | Issue | Action |
|------|-------|--------|
| **Short-circuit `&&` / `||`** DONE `7c99690a` | SolidCash did NOT short-circuit. | Fixed: emits `OP_IF` branching (RHS skipped when decided). Also fixed the underlying conditional-var-leak in the `opRolls` last-use analysis (which affected ternary too). |
| **`try`/`catch` dead catch** DONE `7c99690a` | Catch blocks emit nothing (BCH can't resume after a failed opcode). | Kept as dead code (4+ contracts rely on the try-block) but sharpened the compile-time warning to call out the Solidity divergence. |
| C3 linearization claim | `inheritance.md:119` says "C3 linearization"; impl does not compute C3. | Implement C3 (Category B) or correct the doc. |
| `type(I).interfaceId` width | Code returns `bytes4` (`TypeCheckTraversal.ts:726`); docs say `bytes32`. | Reconcile doc vs impl; define BCH interfaceId semantics. |
| `abi.encodeWithSignature` selector | Solidity derives the 4-byte selector via `keccak256(sig)`; SolidCash has no keccak, so selectors DIFFER and are not cross-VM compatible. | Document explicitly so users don't assume ABI selector compatibility. |
| `delete` as prefix expression; postfix `x++`/`x--` in expression position | SolidCash has statement forms only. | Minor; optional alignment. |

## Category D - N/A on UTXO (document as intentionally unsupported, with BCH substitute)

- **Gas family**: `gasleft()`, `tx.gasprice`, `block.gaslimit`, `block.basefee`, `block.blobbasefee` - no gas metering on BCH.
- **Block/randomness introspection**: `blockhash`, `block.coinbase`, `block.difficulty`, `block.prevrandao`, readable `block.number`/`block.timestamp` - not exposed by Script. Substitute: absolute time/height locks via `require(tx.time >= ...)` (CLTV) and `require(this.age >= ...)` (CSV).
- **EIP-4844 blobs**: `blobhash`, `block.blobbasefee` - Ethereum-only.
- **`keccak256`** - no Keccak opcode. Substitute: `sha256` / `hash256` / `hash160` / `ripemd160`.
- **`ecrecover`** - no pubkey recovery. Substitute: `checkSig` / `checkDataSig` / `checkMultiSig` with an explicit `pubkey`.
- **`erc7201`, transient storage, storage/memory/calldata data locations, storage-slot layout** - UTXO has no storage slots; state lives in data-NFT commitments.
- **External/message-call function types, linked (DELEGATECALL) libraries, `new` CREATE/ordered base-constructor execution, create2 deterministic addresses** - no persistent on-chain contract objects. Substitutes: covenant introspection (`IFoo(category).x`), the `delegate` modifier proxy pattern, inline libraries, `deploy` modifier + SDK `deployFrom`.
- **`event.selector` / `error.selector`, EIP-55 address literals, EIP-165 semantics** - events are NFT outputs addressed by SHA-256; reverts fail the script unconditionally.
- **`gwei` / `wei` / `ether` units** - replaced by `sats`/`satoshis`/`finney`/`bits`/`bitcoin`.

## Recommended roadmap (priority order)

1. **ALIGN correctness first**: short-circuit `&&`/`||`; resolve the try/catch trap (compile-error or
   loud docs). These are behavioral landmines for anyone porting Solidity.
2. **Quick-win batch (Category A)**: compound-assignment operators, tuple-destructuring expressiveness
   (skipped slots + existing-lvalue + user-fn multi-return), named call args, named returns, `[a:b]`
   slice sugar, `require(cond, Error())`, enum<->int, `addmod`/`mulmod`. Each is small and isolated;
   together they close most day-to-day ergonomic gaps.
3. **Doc reconciliation**: C3 linearization, `interfaceId` width, `encodeWithSignature` selector note.
4. **Substantial (Category B)**: internal function types (highest novelty/leverage), then
   `super`/`Base.f()`, then `type(C).creationCode`, then real C3 + meaningful `virtual`.
5. **Document Category D** in a single "Solidity features intentionally unsupported on BCH" page so the
   positioning is explicit and defensible.
