# Solidity parity: gap analysis and roadmap

Status: analysis, 2026-06. Compares SolidCash against the Solidity language reference
(`/Code/solidity/docs`, commit 816d9b2) to position SolidCash as the closing-the-gap BCH
language. Categories below:

> Historical roadmap: Categories A-C were completed during this effort. This file preserves the decisions and
> implementation trail, but it is not the current open-work list. Use `deferrals.md`, current corpus scorecards, and
> tests for remaining gaps.

- **IMPLEMENT** - feasible and valuable on BCH/UTXO; should be built.
- **ALIGN** - exists but diverges from Solidity in syntax/semantics; bring into line (or fix docs).
- **N/A** - EVM-execution-model specific (accounts, gas, storage slots, message calls); document as
  intentionally unsupported, with the BCH substitute.

## Progress (2026-06)

Implemented so far (branch `solidcash_v0.13.1`), each with a VM-level e2e test: short-circuit
`&&`/`||` (+ conditional-var-leak fix) and the try/catch warning (ALIGN); compound assignment,
`x[a:b]` slice, `bytesN[k]` index, `require(cond, Error())`, enum<->int casts + enum-typed params
with full SDK encode/decode, `addmod`/`mulmod`, named call args `f({a:1})`, tuple destructuring with
skipped slots, named return values, integer bitwise `& | ^ ~`, bytesN ordering `< <= > >=`, and
tuple assignment to existing lvalues + swap `(x,y)=(y,x)`. **Category A is now complete.** Category B
underway: **internal function types / function pointers** (incl. dispatch tables), **`super.f()`/
`Base.f()` parent calls**, and **`type(C).creationCode`/`runtimeCode`** are done. The only remaining
**Category B is now complete** - internal function types + dispatch tables, `super`/`Base.f()`,
`type(C).creationCode`, real C3 linearization (cooperative super; `C3LinearizationError` for
inconsistent hierarchies), and meaningful `virtual` + explicit `override(A, B)`. **Category C doc
reconciliations are done** (C3 claim, `interfaceId` width, `encodeWithSignature` selector).
Categories A, B, and C are all complete; what remains is only the Category D "intentionally
unsupported on UTXO" items (documented below). See per-row Status markers.

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
| DONE `c09937f1` | Tuple assignment to existing lvalues + swap `(x,y)=(y,x)` | Bare-identifier slots + per-slot RHS tuple expressions. Swap of top-two vars -> single OP_SWAP; general case evaluates RHS first (clobber-safe) then emitReplace. Mixing declarations + existing rejected. Fixed an opRolls last-use bug for existing targets. |
| DONE (already worked) | Multi-return destructuring from **user** functions `(a,b)=myFn()` | Verified: `(int a, int b) = userFn()` and `= b.split(4)` both compile/run. Declarations only. |
| DONE `fd8f2dcf` | Named args for arbitrary calls `f({b:2,a:1})` | Reorder to declared params in SymbolTable; single-target only (overloaded+named errors). |
| DONE `e0334f3c` | Named return values `returns (int sum)` | Desugared (NamedReturnTransformation) to default-init locals + `return <names>;`; bare `return;` returns them. Requires an explicit `return;`. |
| DONE `40862303` `a2be41fd` | bytesN single-byte index `b[k]` + ordering `< <= > >=` | Index extracts the byte via SPLIT (literal + variable). Ordering compares equal-width bytesN as unsigned big-endian (REVERSEBYTES + 0x00 sign-pad + BIN2NUM + numeric compare); unequal-width/unbounded rejected. |
| DONE `cc79005a` | Integer bitwise `& \| ^ ~` | Bounded intN/uintN via sign-magnitude <-> two's-complement (NUM2BIN/SPLIT -> byte-wise AND/OR/XOR -> BIN2NUM); `~a = mask - a` (OP_INVERT disabled). Unbounded int + mismatched width/sign rejected. VM e2e for signed/unsigned incl. negatives. |

## Category B - IMPLEMENT: substantial features

| Gap | Value | Notes |
|-----|-------|-------|
| **Internal function types / function pointers** DONE `74a3eb8f` `dcf6d498` `79804a8a` | High / novel | A function value is the target's integer `functionId`; an indirect call is `<functionId> OP_INVOKE`, reusing the existing per-function `OP_DEFINE`/`OP_INVOKE` dispatch. `function(T) returns (R)` type; function name in value position; callbacks/strategy dispatch/higher-order helpers; expression + statement call forms; **dispatch tables** (arrays + state mappings of function pointers, encoded as the int functionId; two-step call from a table element since the callee grammar wants an identifier). SDK encodes/decodes function-pointer values as int. Targets are internal/private/public (external stay N/A); entry-point function-type params/returns rejected (no ABI); function-pointer state in `upgrade`/`delegate` contracts rejected (positional ids would remap). Event fields of function type not yet supported. |
| `super.f()` and qualified `Base.f()` parent calls DONE `e5273533` | Med | Overridden parent bodies are preserved under a mangled internal name during flattening; `super.f()` resolves to the next ancestor in the linearization that implements f (multi-level chains work), `Base.f()` targets a named ancestor. Preserved bodies are internal-only and pruned unless reached by a super/Base call; abstract parents are not preserved. |
| Real C3 linearization DONE `39f3b1ed` | Med | `super`/`Base` resolution now uses true C3 MRO (Python/Solidity order): identical to depth-first for linear/tree hierarchies, but in diamonds `super` traverses the sibling branch before the shared ancestor (cooperative super). Inconsistent hierarchies raise `C3LinearizationError`. The flatten that builds the function set is unchanged - C3 governs resolution order, which is what `super` observes. |
| Make `virtual` meaningful + explicit `override(A,B)` DONE `42664f8a` | Med | `virtual` is now enforced: overriding a non-virtual function raises `NonVirtualOverrideError` (abstract functions are implicitly virtual). The `override(A, B)` base-list form parses and is validated (each base must be an ancestor that declares the function, else `OverrideBaseListError`); bare `override` unchanged. Breaking change - migrated the test contracts to mark overridden bases `virtual`. |
| `type(C).creationCode` / `runtimeCode` DONE `667a91c8` | Med | Returns the child contract's compiled redeem script as bytes (BCH has no separate creation vs runtime code, so runtimeCode aliases creationCode). Reuses referenced-contract compilation; emitted as a bytes constant. Enables on-chain factory patterns (build a child's address/output from its bytecode + constructor args). |

## Category C - ALIGN: semantic divergences and doc fixes

| Item | Issue | Action |
|------|-------|--------|
| **Short-circuit `&&` / `||`** DONE `7c99690a` | SolidCash did NOT short-circuit. | Fixed: emits `OP_IF` branching (RHS skipped when decided). Also fixed the underlying conditional-var-leak in the `opRolls` last-use analysis (which affected ternary too). |
| **`try`/`catch` dead catch** DONE `7c99690a` | Catch blocks emit nothing (BCH can't resume after a failed opcode). | Kept as dead code (4+ contracts rely on the try-block) but sharpened the compile-time warning to call out the Solidity divergence. |
| C3 linearization claim DONE | `inheritance.md:119` said "C3 linearization"; impl did not compute C3. | Resolved by *implementing* C3 (`39f3b1ed`): `super`/`Base` now use true C3 MRO; docs updated to match. |
| `type(I).interfaceId` width DONE | Code returns `bytes4`; docs said `bytes32`. | Docs corrected to `bytes4` (sha256-based, EIP-165 style) in inheritance.md + structs-enums-types.md. |
| `abi.encodeWithSignature` selector DONE | Solidity derives the 4-byte selector via `keccak256(sig)`; SolidCash uses `sha256`, so selectors DIFFER and are not cross-VM compatible. | Documented in advanced-features.md (sha256, not keccak; not cross-VM compatible). |
| `delete` as prefix expression; postfix `x++`/`x--` in expression position | SolidCash has statement forms only. | Minor; optional alignment. |

## Category D - N/A on UTXO (document as intentionally unsupported, with BCH substitute)

- **Gas family**: no gas metering on BCH, but the whole family is now implemented (reinterpreted). `tx.gasprice` = the current tx's realized fee rate `1000*(sum in - sum out)/tx_size` sat/KB, reconstructed from introspection (no oracle; tx_size estimated, no `OP_TXSIZE`). `block.basefee` = the block's fee rate `Floor(1000*totalFees/size)` sat/KB (oracle-backed). `gasleft()` and `block.gaslimit` are **fixed shims** (constant `1000000`, compiler-warned) so ported gas-budget checks keep running. See docs/block-and-transaction-properties.md.
- **Block/randomness introspection** (IMPLEMENTED via the per-contract block oracle, see docs/block-and-transaction-properties.md): `blockhash(n)`, `block.coinbase`, `block.difficulty`, `block.number`, `block.timestamp`, etc. are oracle-backed reads. `block.prevrandao` is implemented as a **transaction-local shim** - `abs(int(sha256(input[0] prevout txid)))`, NO oracle/co-spend/state - but it is grindable by the tx-builder, so it is compiler-warned and NOT secure randomness (use commit-reveal or `checkDataSig`). Non-oracle substitute for time/height: `require(tx.time >= ...)` (CLTV) / `require(this.age >= ...)` (CSV).
- **EIP-4844 blobs**: `blobhash(i)` -> `bytes32(0)` and `block.blobbasefee` -> aliases `block.basefee` (compiler-warned porting shims; no real BCH blobs). See docs/block-and-transaction-properties.md s11.
- **`keccak256`** - no Keccak opcode. Substitute: `sha256` / `hash256` / `hash160` / `ripemd160`.
- **`ecrecover`** - SHIPPED via branded recovery side-car pairs. `ecrecoverPubKey`, `ecrecoverP2pkh`, and
  `ecrecoverEvm` expose explicit projections; bare Solidity `ecrecover(hash,v,r,s)` is enabled through the compiler
  projection option. Use `checkSig` / `checkDataSig` when the public key is already known.
- **`erc7201`, transient storage, storage/memory/calldata data locations, storage-slot layout** - UTXO has no storage slots; state lives in data-NFT commitments.
- **External/message-call function types, linked (DELEGATECALL) libraries, `new` CREATE/ordered base-constructor execution, create2 deterministic addresses** - no persistent on-chain contract objects. Substitutes: covenant introspection (`IFoo(category).x`), inferred proxy-implementation artifacts, inline libraries, the inferred deploy covenant (`new Child()`) + SDK `deployFrom`.
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
