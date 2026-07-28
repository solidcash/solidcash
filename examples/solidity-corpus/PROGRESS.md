# solc-corpus: compilable-count progress

Absolute count of single-file, in-scope contracts from `../solidity` (the ethereum/solidity compiler test
corpus) that SolidCash compiles, tracked as gaps are closed. In-scope = files that should compile as a single
unit; excludes solc negative tests (deliberately-uncompilable) and multi-file `==== Source:` tests. Regenerate
the current number with `node examples/solidity-corpus/bench.mjs` (the scorecard's first line).

| date | compiled / in-scope | commit(s) | Δ | change |
|---|---|---|---|---|
| 2026-07-04 | 1936 / 4876 | (baseline) | — | initial solc-corpus bench |
| 2026-07-04 | 2107 / 4876 | d0a990f9, 8359e4c1 | +171 | `pragma abicoder` / `pragma experimental` tolerated |
| 2026-07-04 | 2288 / 4876 | 5a4b6f48 | +181 | `pragma solidity >=0.0` / `*` (2-part + wildcard versions) |
| 2026-07-04 | 2289 / 4876 | 9293db4d | +1 | stop internal crashes on contract-reference types (28→20 crashes; mostly crash→graceful-fail) |
| 2026-07-04 | 2299 / 4876 | 28dd1a17 | +10 | state-var modifiers in any order (`uint constant public X`) |
| 2026-07-04 | 2335 / 4876 | f28d743c | +36 | unnamed returns default on fall-through (`function f() returns(uint){ a=x; }`) |
| 2026-07-04 | 2342 / 4876 | 6083d3b8 | +7 | string literal → `bytesN` (right-padded, `bytes32 name = "TKN"`) |
| 2026-07-04 | 2349 / 4876 | cd291385 | +7 | string literal → `bytesN` in comparisons (`id == "abc"`) |
| 2026-07-04 | 2464 / 4876 | (interim) | +115 | re-measured baseline: this-prefix push/pop, struct dynamic-array-field flatten, no-arg push + grammar peels (for-init, receive/override modifiers) |
| 2026-07-04 | 2492 / 4876 | 499f9327, e070e558 | +28 | bare `uint(x)` cast; enum / contract mapping key types (were crashing on `.toString`) |
| 2026-07-04 | 2500 / 4876 | 35e74dd0 | +8 | UDVT over address (`type MyAddr is address`) |
| 2026-07-04 | 2515 / 4876 | 11225bd5 | +15 | `bytes` `.push()` / `.pop()` (desugar to concat / slice reassignment) |
| 2026-07-04 | 2527 / 4876 | 7500e2e3 | +12 | bare `uint`/`int` in `type()` introspection (compat-gated) |
| 2026-07-04 | 2540 / 4876 | 393ecfce | +13 | fixed-inner nested arrays `uint256[N][]` chunk-packed (a bounded array of fixed-width elements is now fixed-width, so it packs; whole-assign / push / `a[i][j]` / length) |
| 2026-07-04 | 2566 / 4876 | 65165b39 | +26 | variable-inner nested arrays `uint256[][]` chunk-packed (framed variable-length rows; one-line gate reusing the fixed-inner infra + framed machinery) |
| 2026-07-04 | 2586 / 4876 | 3cc5c63a | +20 | nested push/pop on a state 2D row (`a[i].push(v)` / `a[i].pop()` -> row read-modify-write) |
| 2026-07-04 | 2598 / 4876 | 90d11451, b9c9a9c9 | +12 | loop-cache fixes: preserve no-arg push default in a loop; flush state write-back before a trailing `return` |
| 2026-07-04 | 2652 / 4876 | 42a6f14c | +54 | `this.f(args)` external self-call resolves to the contract's own function (public/internal; external still a clean ICE) |
| 2026-07-04 | 2683 / 4876 | 157c6c97, 4c24281b, 7ef2935b | +31 | batch: `this.f()` to an *external* function (+21); library-namespaced member access `L.E.M` / `L.E` type + `L.f({named})` call (+2); local/named-return shadow of an outer symbol; `uint public constant` baked not stored |
| 2026-07-04 | 2703 / 4876 | (this), 3908e966 | +20 | batch: bare state-struct field write `s.field = v` (the Solidity form of `this.s.field = v` - was type-checked against the whole struct, `int -> S`; ~12+ files, byte-identical to the this-prefixed rebuild); `0.2 ether` value unit after a decimal literal |
| 2026-07-04 | 2714 / 4876 | (this), 07c42431 | +11 | batch: mapping-bearing struct SCALAR/bytes field write `s.a = v` -> flattened `s__a` state var (reads already resolved this way; write path only checked mapping/array fields with a key, so scalar writes fell through to `Undefined state variable s`; VM-verified round-trip; +5 UndefinedStateVariable files + flattened bytes writes); unspaced `i-1` number-literal subtraction |
| 2026-07-04 | 2718 / 4876 | (this) | +4 | hex string literal `hex"..."` -> bytesN, right-padded (Solidity widens a short bytes literal, like a string literal); wired into assign / state-assign, byte-identical to the padded literal, over-long still rejected |
| 2026-07-04 | 2737 / 4876 | (this), 08dc12e4 | +19 | struct field types: an array-of-struct/enum field `T[]` resolves via buildArrayType (+12); struct names pre-registered so a field may forward-reference a struct defined later or itself through a dynamic array (recursive struct decls compile). A direct / fixed-array self-reference is infinite-size and now rejects CLEANLY (guarded the two recursive type walks isValidStateType + getMaxPushdataEncodedSizeForType that previously stack-overflowed) |
| 2026-07-05 | 2761 / 4876 | (this) | +24 | Yul assignment across types (`assembly { r := x }`): in Yul every value is a 256-bit word, so a plain non-word var read is normalized to uint256 and the target reinterpret-cast to its own type (address / bytesN / bool / narrow-int both directions). Scoped to the assignment path (mstore etc. keep their own encoding). BCH cast semantics apply (compat) |
| 2026-07-05 | 2780 / 4876 | (this) | +19 | return-site + bitwise coercions: a string / hex literal returned where a wider bytesN is declared is right-padded (mirrors the assignment path, +5); a bounded int bitwise-combined with an int literal or a `?:` of literals (`x \| 1`, `x \|= c ? 1 : 2`) adopts the bounded operand's fixed width instead of failing "unsupported" - the literal retypes, any other unbounded-int operand is cast (+14). ASM-verified the literal path matches a variable operand |

| 2026-07-05 | 2782 / 4876 | (this) | +2 | `this.f{value/gas}(args)` self-call: drop the inert EVM message-call options (no analogue on a BCH direct-subroutine self-call) and resolve to the own function, instead of falling through to MethodCallNotSupported |

| 2026-07-05 | 2789 / 4876 | (this) | +7 | tuple assignment to state variables `(x, y) = (a, b)`: the tuple codegen assigns into stack slots which state vars lack, so a tuple whose targets are all state vars desugars to sequential state assigns (byte-identical to `x=a; y=b`; a swap `(x,y)=(y,x)` stays correct because a state read reads the input commitment) |

| 2026-07-05 | 2834 / 4876 | (this) | +45 | tolerate the EVM storage-layout specifier `contract C [is ..] layout at <expr> { }` (compat only): the clause sets an EVM storage base slot, meaningless on UTXO, so it is stripped (anchored to the contract header, byte-identical no-op). Note: also moves ~65 layout NEGATIVE tests to NEG-ACCEPTED (we can't validate invalid layout usage without implementing the feature - same tolerance tradeoff as the pragma peels) |

| 2026-07-05 | 2838 / 4876 | (this) | +4 | user-defined value type default: a function with a UDVT return type and no explicit return (`function f() returns (T) {}`) now defaults to the wrapped underlying default (`T.wrap(<default>)`) - createDefaultValueExpression gained a ValueType branch, byte-identical to the named-return default. Foundational (also covers no-arg push / delete synthesis) |

| 2026-07-05 | 2847 / 4876 | (this) | +7 | string / hex literal coercion at array & mapping ELEMENT writes (`a[i] = "abcd"`, `m[k] = hex".."` -> right-padded bytesN): extended the assign/return literal coercion to visitArrayAssign / visitStateArrayAssign / visitMappingAssign, byte-identical to the padded literal |

| 2026-07-05 | 2857 / 4876 | (this) | +10 | a non-stateful contract that instantiates a stateful child (`new T()` where T has state) is made stateful (zero-state) to host the implied deploy - the `deploy` modifier is inferred and the parent gets an empty stateLayout (like forceStateful). Detected pre-visit (SymbolTable) + recorded on the node so artifact generation matches. VM-verified end-to-end: the zero-state parent deploys + mints the stateful child's genesis in one tx |

Total so far: **1936 → 2857** (+921). Update this table whenever the number moves.

## Notes

- The pragma unblocks peeled the first-line wall; most files behind it still fail on EVM content (Yul,
  ABIEncoderV2 structs, `msg.sender` dispatch), so parse-unblocks convert far more files to *later* failures
  than to full compiles.
- Corpus completion also required the O(N) optimiser fixes (fc474241, e3e2060d) - large fixed-size arrays
  (`uint256[500]`) previously drove the peephole optimiser O(N^2) and hung the run.
- ~55% of remaining failures are still ParseErrors (the grammar wall). Internal `TypeError: cannot read
  undefined` crashes are down to ~4 (was 20): the enum/contract mapping-key `.toString` crash (17 files) is
  fixed; the rest are assignment-as-expression `.type` (2, SMT tests) and `.length` (2).
- Remaining top gaps are fundamental or feature-scale, not resolution tweaks: method-calls-on-non-contract
  receivers, Yul, nested-array state vars (`uint[][] a; a = d`), ABIEncoderV2 memory structs, `new C()` outside
  a `deploy` function (correct-by-design on UTXO). Enum-key mappings compile but need an SDK-side encoder for
  the int-backed key before they run.

## 2857 -> 2874 (+17): qualified event emit from a library or sibling contract
`emit L.e(...)` / `emit C.E(...)` where the event is declared in a same-file library or sibling contract now
resolves and compiles (was UndefinedEvent, the top-of-list bucket). The event's NFT-commitment encoding depends
only on name+params, not the declaring scope, so emitting a foreign event is sound.
- AstBuilder: carry library event defs into the multi-contract SourceFileNode (the library-only path already
  did; the multi-contract path passed `[]`, dropping them).
- SymbolTable: register sibling/imported-contract events; emitting ANY event (incl. foreign) forces the contract
  stateful (the commitment rides a state NFT). Redefinition check is now within-contract only (a same-sig event
  in another scope is not a redefinition).
- codegen: build the block layout when the contract emits, not only when it declares events (two gates).
- Artifact: list emitted sibling-contract events (Solidity ABI parity), deduped by signature.
+17 (not just the 16 UndefinedEvent files: the library-event drop also broke files using library events elsewhere).
Over-accept 635 -> 636 (+1, benign: a cross-scope event redefinition solc rejects but we now accept - diagnostic).

## 2874 -> 3040 (+166): bare expression statements (left-factored assignment, solc-style)
`expression (op= expression)? ';'` folds assignment into the expression rule (parse the LHS once, 1-token decision
for the assign tail vs bare expression). Removes the unbounded lookahead a separate assignmentStatement rule
forced -> no full-context LL blowup (the additive `expression ';'` approach OOMed + was 2.7x slower; that 2.7x was
actually a per-parse DFA-reset workaround, now unneeded). AstBuilder: visitAssignmentStatement's ~10-outcome
lvalue dispatch extracted into buildLvalueAssign, driven by extractLvalue() (reconstructs lvalue segs from the
parsed LHS expr); ++/-- route through it. Codegen visitExpressionStatement = visit + OP_DROP per stack slot.
Also: mixed named/unnamed returns always-on (compat gate removed); MAX_MATERIALIZED_ARRAY_ELEMENTS cap (10000,
grounded in ~3119 max outputs / ~2437 max inputs of a 100KB standard BCH tx) rejects astronomical bounded arrays
(uint[..][2999...]) instead of OOMing - a pre-existing gap the feature exposed. Folding push/pop/call too was
measured to give ZERO further parse/memory benefit (assignment fold captured it all; residual aggregate cost is
added compilation of the +166 files, not parse), so it was not done. compiler 1628 green. Commit 6c51d7c3.

## Full statement fold completed (commits ffc3d38e + 1017495a + 30952bea)
Extended the assignment left-factoring to fold ALL remaining expression-like statement forms into
expressionStatement, reaching solc's clean 2-way statement rule (keyword-led forms + the declaration forms
variableDefinition/tupleAssignment + expressionStatement; consoleStatement is a debug builtin). Phases:
- push/pop/delete tails (buildArrayPush/Pop/Delete, receiver via extractLvalue).
- calls (buildCallStatement: low-level/.transfer/tokens/interface/self-call routing, intercepting statement-only
  forms before visiting since visitMethodCall would mis-read this.transfer as a self-call).
- storage-pointer write (buildStoragePointerWrite: `Lib.f(args).field op= v` desugar in the assignment path).
CONFIRMS the earlier "folding gives no benefit" was a confounded PARTIAL-fold measurement: the COMPLETE fold
recovers parse to clean-HEAD parity and slightly beats it. Parse-only over 7343 files:
  clean HEAD 3.78ms/file 410MB dfa 43085 | assignment-only 4.60ms 447MB 45196 | fully-folded 3.75ms 416MB 42737.
(The DFA baseline is the expression rule; folding statements removes the added statement-decision ambiguity.)
Behavior-preserving (compiler 1628 green throughout); corpus 3040 -> 3065 (+25: the unified call path handles forms the separate rules rejected, e.g. a 2-arg this.f(a,b) self-call). tupleAssignment stays as solc's
variableDeclarationStatement (its slots can declare); its fully-untyped `(a,b)=..` slice is a minor deviation not
worth the tuple-assign regression risk for a DFA already below clean HEAD.

## +10: interface base in an explicit override(A,B) list (commit b4f969e1)
`function f(...) override(Contract, Interface)` was rejected ("'Interface' is not a base"): the validation
required a resolvable super impl (superImplFor), but an interface base only DECLARES the function (no body) and is
excluded from the contract linearization (computeLinearization filters to contractMap, contracts only). Fix:
accept a base that stays in `contract.implements` after inheritance expansion (a directly-implemented interface).
10/20 OverrideBaseListError files now compile. Remaining 10 = transitive interfaces (override(IBase) via a parent)
+ abstract contract bases (override(B) where B declares f with no body) - both need broader inheritance data.

## 3124 -> 3156 (+32): whole array copies + reassignable mapping-storage-return functions
Two "hard tail" veins that turned out tractable via desugar-to-verified-primitives (byte-identical, asserted).
- Whole ARRAY COPY with a per-element bytes conversion: fixed `bytes2[N]=bytes1[N]` -> element-wise `d2[i]=bytes2(d1[i])`
  in visitAssign (2b7c4828); DYNAMIC `bytes10[]=bytes8[]` (packs differently in chunk storage) -> new pre-semantic pass
  DesugarDynamicArrayCopyCast `delete d2; for(i) d2.push(bytes10(d1[i]))` before CacheDynamicArrayInLoop, reading d1
  direct (a cached source local crashes dynamic-write slot tracking) - VM-verified round-trip (20f3a956). Nested
  diff-element-same-dim already worked; diff-DIMENSION pad/truncate is a rare edge, deferred.
- REASSIGNABLE mapping-storage-return `function f() returns (mapping storage r){ r=a; r[1]=42; r=b; r[1]=84; }`: new pass
  InlineMappingReturnFunctions resolves it by straight-line dataflow into ordered side effects (each `r[k]=v` bound to
  whichever mapping r aliases at that point) + the mapping r finally aliases, then inlines at call sites (191b924e).
  Generalized to LIBRARY functions with mapping params via param->arg binding (ab569fc0). `f()[k]=v` (a call-indexed
  write, previously "Invalid assignment target") desugars at parse to `mapping storage __t=f(); __t[k]=v` (191b924e).
  Byte-identical to the hand-resolved side effects. Unblocks mapping_internal_return + mapping_returns_in_library_named.
  af2bcb39 robustness: drop only the candidates actually inlined (a branchy one stays for a clear diagnostic).

## 3156 -> 3187 (+31): file-level events + prefix ++x/--x as an expression
- FILE-LEVEL `event E();` (Solidity 0.8.22+): grammar sourceFile += eventDefinition; visitSourceFile collects into
  SourceFileNode.eventDefinitions (the field library-imported events already flow through, the symbol table registers
  globally so `emit E()` resolves). Byte-identical to the same event declared inside the contract (ca696b5f).
- PREFIX `++x`/`--x` in EXPRESSION position (`return ++counter`, `arr[i]=++x`) had no grammar rule (only postfix + the
  statement forms). Added a PrefixOp rule + PREFIX_INCREMENT/DECREMENT; DesugarPostfixExpressions lowers prefix by
  hoisting `x = x +/- 1` BEFORE the statement (prefix yields the post-mutation value) and allows it in a return (unlike
  postfix, whose increment would land after). Byte-identical to `x=x+1; <read x>` (805c8c62).
- BARE sibling import: `import "math.sol"` (no `./`) failed even with math.sol a sibling - compileFile's resolver only
  tried node_modules for non-relative paths. Added a source-directory fallback (Solidity base-path behavior), used only
  when a same-dir file of that name exists so a real package still wins. Unblocks the library-linking tests (ce23a34c).

## 3187 -> 3255 (+68): Yul inline-assembly overhaul (~40 builtins/constructs now lower)
The generic diagnostic "only native BCH-ASM assembly is currently supported" predated LowerInlineAssembly and was
false (a large Yul subset already lowered); rewrote it to NAME the actual blocker - a builtin with no BCH analogue, a
local function definition, an un-lowered builtin, or a structural combination (b6f24b5c). Then closed most remaining
Yul gaps, each byte-identical to its solidc equivalent or sound-by-construction:
- CONTEXT builtins -> the matching NullaryOp: caller/callvalue->msg.*, origin/gasprice->tx.*, chainid/number/timestamp/
  difficulty/prevrandao/basefee/blobbasefee/gaslimit/coinbase->block.* (address ones uint256-cast) (8068fcb9);
  blockhash(n)->the blockhash oracle builtin (1a517d8c); gas->gasleft, codesize->this.activeBytecode.length,
  selfbalance->address(this).balance (26843439). [+ bare imports above bundled in this bench: 3187->3216.]
- mcopy in the compile-time memory model (188ccb90); single-word return(p,32) -> a function return - fixed a nested-
  block covenant-DUPLICATION bug (~670 bytes): visitBlock now splices a return-terminated assembly block to the
  function-body tail so the terminal-return codegen sees it (4af9f013).
- LOW-LEVEL call/staticcall/delegatecall -> the external-call covenant + return-event NFT binding (reusing the VM-
  verified LowLevelCallNode: addr word-cast to address, payload SDK-supplied); returndatasize/returndatacopy read the
  tracked return-event bytes. The COMPILER compiles them; nonsense/unresolvable args fail at SDK auto-derivation, not
  compile time (85032b62).
- addmod/mulmod -> solidc builtins, pop(x) -> evaluate-a-call / discard-pure (f4041a32); invalid()->require(false),
  stop()->no-op (125a6a3c); signextend(i,v) const-i via the branchless `((v&mask)^signBit)-signBit` identity (Yul sub
  wraps mod 2^256) (3b4c21cb).
- LOCAL Yul FUNCTION inlining: simple 0-param (5ff0daf7) then FULL - parser splits Identifier_list into params/returns
  at the `->` token (was hardcoded []/[]); inliner binds `let param_i:=arg_i`, declares returns, splices the body with
  every param/return/local renamed fresh per call site (0-param `r:=expr` fast-path). Leaf-only: recursion/nesting/
  multi-return bail (2f3feed5).
- STRING/hex-string literals -> their bytes left-aligned in a 32-byte word (ed7bb54f); `x.slot` of a state var -> its
  constant storage-slot number, consistent with sload/sstore + the __evm_storage register (a1ce245b).
Sub-deltas: 3216->3217 mcopy, ->3219 return, ->3222 low-level call, ->3229 addmod/pop/invalid/stop, ->3239 local-fn,
->3255 param'd-fn + signextend + string-lit + x.slot. Remaining Yul is FUNDAMENTAL: a runtime EVM-memory / storage-slot
/ calldata-slice model (.offset/.length, variable-offset mstore/mload, keccak-over-computed-memory, loops) - a research-
level EVM-layout model, not a builtin to add.

## 3255 -> 3313 (grind: grammar peels + solc conversion rules + free/getter resolution)

Nine commits, mixed grammar-peel + semantic-gap. Grammar peels (each = a rule alternative Solidity allows that we
rejected): `.selector` on contract vars / contract names / bare functions (c44894d0, +5); the `assembly ("memory-safe")`
dialect+flags annotation (723b9dd1, +13 - biggest peel, `assemblyStatement += StringLiteral? ('(' StringLiteral,* ')')?`);
array-typed custom-error params `error E(uint[] a, uint[1])` (6751ffee, +3); `new string(n)` dynamic-string alloc
(e14d25bd, +2); array-typed tuple destructuring slots `(uint[] memory a, ..) = ..` (4ef4087d, +5); `abi.encodeCall(this.m,
(args))` self-target (36ec21f0, +1, sentinel interfaceName 'this' -> current-contract fn).

Semantic gaps (higher yield per the standing lesson): file-level enum-typed + string->bytesN constants (b6d52300, +2 -
THREE ordering/coercion walls: AstBuilder + SymbolTable both built free constants BEFORE registering free enums so
`E constant c = E.M` typed undefined; visitConstantDefinition never ran maybeCoerceStringToBytesN). **bytesN -> bytesM
widening (f579d00e, +13 - the clean win): solc's FixedBytesType::isImplicitlyConvertibleTo allows any widen (M >= N),
so `bytes32 r = ripemd160(data)` (ripemd160 returns bytes20) is valid - we rejected it. maybeCoerceBytesWiden wraps the
value in an explicit cast (byte-identical to hand `bytes32(x)`, which zero-pads via OP_CAT), wired into constant / decl /
assign / state-assign / return / call-arg coercion. Narrowing still fails.** Public value-array getter `this.a(i)`
(4861660f, +1: ArrayType branch in SynthesizePublicGetters, uint256 index -> element, mirrors mapping getter).

LESSON reinforced: reading solc's actual conversion rule (Types.cpp isImplicitlyConvertibleTo) found a 13-file vein a
grammar scan would never surface. Remaining large clusters are FUNDAMENTAL: Yul EVM-memory/storage/calldata (167), genuine
signedness + fixed-point + big-address-literal UnequalType (45), external-call-on-array-element + deploy-then-call
MethodCall (34), runtime function-pointer .selector (30). Niche leftovers: enum/2D-array/struct public getters (pass-order
wall - SynthesizePublicGetters runs pre-enum-resolution), local-bytes delete-element, 3-file address-literal comparison.

## 3314 -> 3326 (grind: contract/interface-qualified access + bytes element write)

Top non-parse bucket was UndefinedReference (194); after peeling the fundamental symbols (erc7201 Yul-cmdline 21,
library L 18, super 7) the tractable slice was CONTRACT/INTERFACE-QUALIFIED member access. Four commits:
- 924c354f contract-qualified CONSTANT `C.X` / `Base.X` (+2): inheritance is flattened before SymbolTableTraversal,
  so an inherited constant sits in scope under its bare name with inheritedFrom = the defining base. Resolve `Q.X`
  -> bare `X` only when Q is the current contract or the base X was inherited from (unrelated `Other.X` = different
  X, stays unresolved - sound).
- 6337eae3 qualified TYPE strip `I.Enum.Member` / `A.E.Y` (+4): types register under their bare name, so extend the
  AstBuilder library-name strip (`L.E`->`E`) to contract + interface names (collected before body-visiting) for any
  registered enum/UDVT/struct. Pure requalification.
- 810f9fad contract-qualified UDVT wrap/unwrap `C.T.unwrap(x)` (+3): parses as a 3-part method call (the strip makes
  the object bare `T` but it reaches visitMethodCall, not the 2-identifier FunctionCall the UDVT cast covered);
  detect wrap/unwrap on a bare-identifier UDVT object there too (typeDefMap-gated so a 2-arg library `wrap` is safe).
- 046c3e5e bytes state-var element write `data[i] = v` (+1): desugar to `data = data[0:i] ++ v ++ data[i+1:size]`
  (like .push/.pop; byte-identical to the hand form, out-of-bounds reverts via the slice OP_SPLIT).

Clean veins now thin. NEXT WALLS: memory/local bytes element write + local-memory struct field writes with
struct/array VALUES (`vk.alpha = Struct(..)`, `src.x = [3]`) = feature-scale, need local-var TYPE tracking at build
time (AstBuilder only knows state-var types). FUNDAMENTAL remainder: Yul EVM-mem/storage/calldata (168), signedness
+ fixed-point (46), external-call-target + deploy (34+16), runtime function pointers (19+17), ABIEncoderV2 calldata
(_v2 stack cluster), gnosis `using Math` circular-import (16), super/C3 inheritance (7), erc7201 (21).

## 3326 -> ~3344 (grind: user-directed local-memory writes + erc7201 + payable casts)

User directives: "take on local-memory element/struct writes", "erc7201: layout ignored + warn, function = sha256
alias", "support erc7201 as a Yul builtin". Commits:
- 68a1780c bytes memory/local element write `bytes memory d; d[i] = v` (+4): extended the state-bytes element-write
  desugar (046c3e5e) to LOCAL bytes vars - track local unbounded bytes decls per function (localBytesVars, like
  localStructTypes), desugar to a LOCAL assign `d = d[0:i] ++ v ++ d[i+1:size(d)]` (Identifier/Assign vs State).
  Local-memory STRUCT writes already work (minimal `s.a=P(..)`/`s.x=[..]`/`s=src` all compile); remaining struct
  failures are STATE-flattened array-field `s.a=x` + whole-struct-to-mapping `m[k]=s` (parallel-agent flattening area).
- 11c8b66d erc7201 NOT supported (+6): `erc7201(id)` function -> sha256(id) alias (warn, byte-identical to sha256,
  NOT Ethereum's keccak-based erc7201 - internal same-contract slot derivation only); `contract C layout at
  erc7201(..)` layout clause stripped (already the layout behaviour) + warning. No EVM storage-base offset on UTXO.
- e7821429 erc7201 Yul builtin (+0): `assembly { s := erc7201("ns") }` lowers to sha256 in LowerInlineAssembly,
  reuses the alias (single-arg, warn-once, added to LOWERABLE_BUILTINS). Remaining erc7201 files = yul-optimizer
  cmdlineTests (multi-wall/opaque).
- b2830cc5 payable(bytes) casts (+8, the clean win): explicitlyCastable rejected `bytes -> address` when payable, so
  `payable(this)` (this = the contract's bytes identity; `address(this)` already worked) and `payable(bytes20)`
  failed. payable is a no-op cosmetic distinction on BCH (every address receives value), so allow bytes->address
  regardless of the payable flag - identical resulting address. Utils type-system change (170 utils green).

EXPLICITLY REVERTED (0-yield, contested area): flattened struct ARRAY-field whole-assign `s.a=x`->`s__a` - works +
byte-sound but the corpus files are multi-wall on `m[k]=s` (whole-struct-to-mapping copy, feature-scale), so +0; kept
the tree clean. LESSON REAFFIRMED: read the actual type rule (explicitlyCastable) - the payable relaxation was +8 a
source scan wouldn't surface, same pattern as bytesN-widen.

### bytes[i] write feature completion (65fa601d + 6544fba5, +1)
- 65fa601d bytes memory-PARAM element write (+0): track unbounded bytes params in localBytesVars (calldata write
  still rejected by the existing read-only guard). Feature-coherence (local worked, param didn't).
- 6544fba5 COMPOUND bytes element write `data[i] |= v` / `&=` / ... (+1): the new byte is `data[i] op v` (read old
  byte, combine), byte-identical to the hand read-modify-slice-concat. bytes[i] write now complete: state/local/param, = and compound.

### erc7201 returns uint256 not bytes32 (82e03969, +9)
User caught it: erc7201 yields a storage-slot uint256 (spec/tests use it in return-uint256, `uint constant`,
arithmetic, uint256 comparison), so `erc7201(id)` -> `uint256(sha256(id))` (both the function alias + the Yul
builtin). bytes32 context still works via `bytes32(erc7201(..))`. erc7201 corpus 6 -> 15.

## 3360 -> ~3374 (autonomous grind: resolution + coercion veins)

Non-stop autonomous session. Commits:
- a499efbc using-for on NON-struct receivers (+2): `using L for T; x.method()` only resolved struct/array/mapping
  receivers; track a using-for type key for every non-struct local/param (localSimpleTypeKeys via usingForTypeKey:
  enum/UDVT name, contract-iface name or 'address', 'string', 'bytes'/'bytesN', 'uintN'/'intN') and consult it.
- 1f052be7 free function shadowed by a contract function (+3): free (file-scope) + contract-member functions are
  separate scopes; a contract fn may share a name/sig with a free fn (shadows it). Separate freeFunctionSignatures
  set; contract-vs-free collision errors only in native mode. Free-vs-free still errors.
- 7244ca9f library/contract-qualified enum cast `L.E(x)` (+1): a 2-identifier `Qualifier.Enum(x)` missed the enum-cast
  detection (bare `Color(x)` only); recognize a qualified enum cast. Completes using-for-on-enum.
- e984151e delete on a bytes element `delete data[i]` (+0 coherent): route to the bytes element-write desugar with a
  zero byte (was "Undefined mapping"). Completes bytes[i] op set (write/compound/delete), byte-identical to data[i]=0.
- 5f05123b coerce literal 0 to bytesN in a comparison `data[i] == 0` (+8): apply maybeCoerceZeroToBytes to both
  visitBinaryOp operands (next to the string-literal->bytesN comparison coercion).

An Explore subagent surveyed the remaining tractable veins (free-function-shadow + public-struct-getter-tuples were
its finds). Remaining big tractable-looking clusters: public struct getter tuples (6, struct getters excluded by
pass-order), UndefinedCollection struct-field-index chains, MethodCall new-C-then-call (deploy fold). See ATTENTION.md.

## ~3374 -> ~3384 (autonomous grind cont: const-fold ordering + grammar peels)
- 27841738 file-level UDVT-typed constants `T constant g = T.wrap(x)` (+2): register file-level structs+typeDefs
  BEFORE constants (mirrors enum-before-constants), so a free const can resolve/fold from a UDVT.
- 9f39a3b9 `pragma experimental solidity` (+4): add 'solidity' to the tolerant pragma token list (was a keyword
  the Identifier* tail couldn't match).
- 9a3b12d5 virtual/override on modifiers + virtual-before-external on fallback (+4): modifierDefinition gained
  `('virtual'|overrideSpecifier)*`; fallbackModifier* allowed before external too. Inheritance no-ops.

## ~3384 -> ~3390 (autonomous grind cont: const + literal veins)
- 4a0977a5 library-namespaced constant in a const initializer `D = L.INT` (+2): resolveConstantExpressionIdentifiers
  now returns the node + rewrites `L.X` -> compound identifier (was type-checked as a struct-field access on L).
- 9d7d34d9 negated hex number literal `-0x42` (+2): reinterpret a hex literal as its int value under NEGATE
  (mirrors the binary-op hexLiteralToInt).

## ~3390 -> ~3400 (autonomous grind cont: power operator + address-literal)
- 76c1c721 address vs hex address literal `a == 0x1234..` (+3, maybeCoerceHexToAddress in visitBinaryOp).
- fe2f7541 power operator result type = base's type (+7): `(-1)**e` / `int**uint` - `**` took the exponent's type
  and required equal operands; add POW to the left-operand-type special case (like shifts).
Two Explore surveys: findings mostly stale (already-fixed 2D-mapping-index, bytes/array element) or complex (array
slices `b[s:e]` on non-bytes arrays) or fundamental (method-call-on-index, function-type params).

## ~3400 -> ~3417 (autonomous grind cont: parse peels - slices + constructor modifiers)
- 412fb832 slices with omitted bounds `a[:2]`/`a[2:]`/`a[:]` (+14, BIG): IndexRangeSlice made start/end optional,
  builder defaults omitted start->0, end->SIZE(element). Common in abi.encode/bytes.concat over calldata slices.
- b59fa6f4 constructor with a modifier invocation `constructor() mod {` (+5): added customModifierInvocation* to
  constructorDefinition (parentInvocation requires args, a no-arg modifier lacks them).
Parse peels remain productive. Remaining parse clusters: function pointers (fun.selector/.address/function-type
params - fundamental), array-of-mappings, complex destructure (indexed/empty slots), computed array sizes (grammar risk).

## ~3417 -> ~3427 (autonomous grind cont: for(;;) + power/slice)
- fe2f7541 power operator result = base type (+7); 76c1c721 address vs hex-literal (+3).
- 9689973c for loop with empty condition `for(;;)` (+9): forCondition optional, omitted -> implicit true.
Remaining parse: function pointers (dominant, fundamental), abstract modifier/receive (~2, deferred), computed
array size / array-of-mappings / chained-assign (deferred, risky). NON-parse remaining mostly fundamental
(L/super/signedness/external-call/deploy/function-types).

## ~3427 -> ~3436 (autonomous grind cont: abstract decls + tuple-for)
- 4ef7d408 abstract modifier + receive (no body) (+4); d9c6c69b tuple destructure in for-init/update (+1, complete
  feature, byte-sound); 9689973c for(;;) empty condition (+9).
CLEAN VEINS NOW EXHAUSTED. Remaining documented in ATTENTION.md: array slices (need VM-verified codegen),
function-pointer ABI (fundamental), signedness/fixed-point (fundamental), external-call/deploy, ABIEncoderV2,
super/C3, Yul EVM-model, multifile, computed-array-size (grammar risk), parenthesized-calls (fn-ptr adjacent).
Autonomous session total: 3360 -> ~3436 (+76 across ~30 commits, all sound/verified/OWN-files, suite 1754 green).

POST-3436 (continuing "find next walls"):
- 86247db3 fixed-width-element array slices arr[start:end] (uint256[]/int8[]/bytes32[]/uint256[N][]); VM-verified
  end-to-end (solidcash/test/ArraySlice.test.ts: length + element values + omitted bounds). +17 -> 3453. Sound by
  reduction to VM-verified primitives (emitPushdataDecode, OP_SPLIT bytes-slice, emitPrependArrayCount).
- 509cb858 const-expression array dimensions: arrayType grammar now `typeName '[' expression? ']'` (was
  NumberLiteral|Identifier only); AstBuilder const-evals the dim (2**10, 2**10 + 3, N*2 over literal/hex/const-id
  with + - * / % ** << >> & | ^ ~ unary-neg). +17 -> 3470. Non-const dim -> clear ParseError. 1808 compiler green.
- 092de2a6 inherited modifier override + event/error overload no longer falsely collide (mergeNamedList
  overridable/overloadable flags): a child's own same-name modifier overrides the parent's (modifiers cannot
  overload); same-name events/errors with different signatures coexist. +18 (15 modifier + 3 event/error).
- 5f0f78b0 alpha-rename modifier LOCAL variables per application (expandFunctionModifiers already renamed params;
  now renames locals too). mod(2) mod(5) mod(x) / a modifier local sharing a function var's name no longer
  redeclares. VM-verified (ModifierLocalRename: aliasing would fail the trailing require). +5.
- 70d7bfb8 bare block statements `{ ... }` as nested scopes (blockStatement grammar + BlockNode.scoped flag so
  flattenStatements keeps user blocks). Disjoint sibling blocks reuse names; live-outer-local shadow stays
  REJECTED (codegen slots by name - a live shadow would miscompile; clean rejection is sound). VM-verified
  (BareBlockScope). +11. NOTE: outer-local live-shadow needs alpha-rename to be soundly ACCEPTED (deferred).

2026-07-07b (user "let's do function overloading, function-pointer ABI, abicoder" -> chose "1 & 2"), 3495->3512 (+17):
- d3342d2a function overload resolution (+5): inheritance flattening keyed functions by NAME -> a base's 2 same-name
  overloads collided + 2nd dropped as diamond-dup; now name+param-signature. Overload matching counted the synthetic
  __internal__returnOutputIdx param (public entry points) -> declaredParamTypes() excludes __internal__*. Contract fn
  shadowing a same-sig free fn -> applyFreeFunctionShadowing. VM-verified OverloadResolve.
- 721c8e14 public fn called INTERNALLY with a used return no longer imbalances the stack (THE UNLOCK): the
  internal-call subroutine skips the synthetic returnOutputIdx (unused, raw-return) + fn-pointers never push it, but
  a direct internal call DID push it (forwardInternalReturnOutputIdx, arity check) -> leak. FIX: visitUserFunctionCall
  no longer pushes it (caller-side; a visitReturn clean instead BREAKS fn-pointers). VM-verified PublicInternalCall.
- b1e8dfe2 external fn pointers as public/external params (+7): relaxed entry-point FunctionTypeNotEncodable to allow
  EXTERNAL fn types (internal stay rejected = solc parity); self-call this.ev(this.g,a) routes to internal OP_INVOKE.
  VM-verified ExternalFnPointerParam. FOLLOW-UP: genuine cross-contract external-ABI fn-ptr passing (SDK encode).
- ee49a0c8 abi.encodeWithSelector accepts a fitting string/hex literal selector (+5): maybeCoerceStringToBytesN
  right-pads "f()" -> bytes4 before the selector type check (Solidity converts a fitting literal). The clean abicoder
  subset; the rest is fundamental (fn-type ABI, msg.data EVM-calldata, Yul, struct-fn-fields, external-call).

2026-07-07c (user "do the walls: nested array copies, gnosis multifile, then yul"), tractable slice of each:
- 33672499 inherited transient state vars (EIP-1153) lower into derived contracts (+2): were filtered out
  per-contract in AstBuilder before inheritance; now recorded on the node, InheritanceExpansion merges them, new
  LowerTransientStateVars pass injects the per-fn zero-init local after flattening. VM-verified.
- 0c6c77f2 whole fixed-array copy with differing length/element (+5): generalized the fixed state-array copy
  desugar - diff-length (uint[40]=uint[20], copy prefix + zero-fill leftover) and/or diff-element (bytesN widen),
  byte-identical to hand-written element-wise. REMAINDER (deferred): nested uint256[2][], multi-dim, calldata/mem
  source, contract_array.
- 902028b3 flatten imported/sibling contracts that carry their own inheritance (+10): InheritanceExpansion only
  flattened the primary; now non-ancestor imported contracts (new Middle() where Middle is Oracle) flatten too
  (base merged), skipping primary ancestors (avoids diamond double-merge). Byte-identical to inline. Unblocks the
  gnosis "undefined interface" cluster. `using Math` (16, gnosis dense-cycle library-registration, fnDefs=[]) DEFERRED.
- 66c2dc33 Yul blobhash(i) -> 0 (+4): BCH has no blobs, like the Solidity builtin. Yul remainder = deep structural
  (122) / fundamental EVM builtins (return/log/extcode/create) / mixed nested-fns (recursion fundamental).
- f3ece226 contract-typed arrays -> address arrays (+2): new C[](n) + abi.decode(x,(C[])) typed their element as
  undefined (parseType/resolveType don't know user contracts) -> C[] became undefined[]; now an unresolved element
  name becomes a named AddressType placeholder (contract handle = address). visitNewArray + resolveAbiDecodeType.
ASSESSED ~0-yield/deferred: msg.data (simple return-msg.data/msg.data.length WORK now; 5 corpus files multi-wall
  = Yul calldatacopy/return + this-call), tuple bare-expr statements (niche smtChecker/syntax), inheritance edge
  cases (C3/override-base-list/diamond ~26 = deep MRO). CLEAN TRACTABLE VEINS EXHAUSTED; remainder fundamental
  (Yul EVM-model, fn-ptr ABI, external-call/deploy, multifile L/super, memory 2D arrays, nested/multi-dim copies).

## Session 2026-07-07b (fn-pointer ABI remainder + function-type grammar + no-arg struct push)
- 4fb0f673 .selector on a single-assignment function-pointer LOCAL (+8): `function() external fun = this.f; fun.selector`
  now folds to that function's selector (byte-identical to `this.f.selector`, sound by reduction). A reassigned
  pointer is left alone (a solidcash function value is a functionId, not (addr,selector)). Unblocks function_types_sig,
  function_type_{payable,pure,view}_* and 489/490_function_types_selector.
- 37138a7a fold (c ? this.f : this.g).selector -> c ? f.selector : g.selector (+1): a ternary of function refs taken
  .selector -> runtime choice between two compile-time selectors, byte-identical to the hand-written ternary of
  selectors. Unblocks selector_ternary.sol (empty void stubs f/g reduce to require(true) via NamedReturn already).
- de95a751 data location on function-TYPE params/returns + no-crash member fallback (+10): the function-type grammar
  rule only took a bare typeName, so `function(uint256, string memory) external` failed to parse. New dataLocation
  rule (memory|calldata|storage), inert on BCH, discarded. Also hardened parseFunctionType: an unresolvable member
  (struct/contract name, function-type array) became undefined in parameterTypes and crashed FunctionType.toString;
  now falls back to an address handle (member types of a fn pointer are inert on BCH) - 3 crashes -> clean compiles.
- a9a9b33f no-arg push on a struct array appends the struct default: `Data[] data; data.push();` left the int-0
  placeholder in place for struct elements (type error int vs struct). The default was built in TypeCheck as an
  unresolved struct-constructor call. Now built in SymbolTable (visitStateArrayPush + visitArrayPush) so it passes
  struct-constructor resolution; visitArrayPush also covers the loop-cache rewrite so `while(..) data.push();` works.
  Byte-identical to data.push(Data(0,0)). Unblocks dynamic_arrays_in_storage, array_copy_storage_storage_struct.
  KNOWN GOTCHA: noArgPushPlaceholder = IntLiteral(0), so a `!node.value` guard is WRONG (placeholder always truthy);
  numerics survive only because IntLiteral(0) == the numeric default. Must REPLACE unconditionally on noArg.
- STILL DEFERRED (fundamental/multi-wall): fn-ptr ARRAYS + indexed invoke `arr[m]()` (memory dyn arrays + fn-ptr
  storage), external-fn-ptr STATE vars, `function(uint256[] calldata)` (array type inside a fn-type param), method-
  call-result fn refs `h().f.selector`, assignment-expression ternary condition `(z=true)?...`.
- 17f4f69e receive()/constructor() payable ordering (+6): grammar forced external-before-payable on receive and
  modifiers-before-parent-invocations on the constructor; now accept receive() payable external and
  constructor() A() payable (both orders). AST builder records receive as [external,payable] + reads constructor
  sub-rules by type, so order is inert. Remaining 2 payable-bucket files fail deeper (method call / modifier combo).
- 31ec9642 this.<fn>.address -> address(this) (+1): .address on a function pointer = the hosting contract's
  address; for a self ref that is address(this) = the input's locking bytecode. address is a keyword so added
  '.address' to memberName, then fold. Byte-identical to address(this). FOREIGN C(addr).f.address (and .selector)
  still need foreign method-pointer VALUES (deferred, same wall as different-address varying fn pointers).
- DEFERRED (assessed, not clean): soft-keyword function-call statements `unsafe()/deploy()/delegate()` (~5-7 files):
  functionCall uses Identifier not anyIdentifier, so free fns named after soft keywords can't be called. Fix risks
  ambiguity with statement forms (selfdestruct(x); / revert(..); / unsafe(N) cast) AND needs AstBuilder rework
  (Identifier_list vs anyIdentifier for namespaced calls). Moderate yield, high risk - left for a focused pass.
  Also assessed fundamental: array-of-mappings `mapping(K=>V)[N]` state/param (storage layout), `(x.f)()` /
  `g(arr.push())` (fn-ptr value / push-return-as-arg), `*=` on struct-storage-pointer field (using-for library).
- ASSESSED + REVERTED (regression-free but +0 corpus): soft-keyword STATE-VAR names `bytes4 sig;` (locals/params/
  struct-fields already use anyIdentifier; state vars use Identifier). Change (stateVariableDeclaration name ->
  anyIdentifier + AstBuilder ctx.Identifier->anyIdentifier at 2 sites) WORKS, no ambiguity (packed name-vs-modifier
  resolves), 1849 compiler green. But all 5 candidate corpus files (sig/pubkey/etc) have deeper EVM walls
  (msg.sig/tx.data) -> +0 measured. Reverted to keep commits = measured gains + avoid parser-regen churn. A valid
  consistency fix if ever wanted as code-quality (not corpus).

## Session 2026-07-07f (crash-bucket grind + library registration/selector fixes, 3575->3597)
Post-crash pickup. Triage insight: the "Expected variable X does not exist on the stack" bucket (23) was NOT
mostly-fundamental - 12 of 23 fixed via 7 root-cause commits, all VM-verified or byte-identical-by-reduction:
- 63da621e tuple assignment onto STATE-VAR targets (+2): SymbolTable desugars to temp captures + sequential
  assigns when >=1 target is a state var (mixed transient/state, (x,y)=f(), ctor immutables). Clobber-safe;
  struct/array/mapping targets excluded (storage-pointer REBINDING semantics, left crashing on purpose).
- d159e92a slice-bound roll order (+1): codegen emits split(end)-then-split(start); the final-use analysis now
  traverses end-before-start so a var shared by both bounds rolls at the START bound (x[c?1:2 : c?3:4]).
- f191037d bare enum-type-reference statements dropped (+2): `A.Foo;` resolves as a valueless CONSTANT symbol
  (Symbol.enumType: CONSTANT + definition undefined + EnumType) -> statement is a Solidity no-op, now removed.
- 2fa4b5f1 try around a VOID external call (+2): a void external call has NO expression type (only set when
  returnTypes non-empty); try codegen dropped one phantom slot (state-write slot / __extaddr_ local) and broke
  the epilogue. undefined now drops zero like VOID; guard tests assert try form == bare statement bytecode.
- 238e70a8 duplicate var across ONE call's arg list (+2): OP_INVOKE args evaluate in REVERSE, analysis marks
  L-to-R -> roll landed on the use codegen hits first (g(v,v); UDVT add(value, mul(value,p))). Such vars are
  now PICK-only within that call (order-independent, epilogue cleans the leftover). Applied at user-call,
  using-for, and operator-overload sites. ALSO unblocked recursive-binary-search (its real blocker was
  find(_data, 0, _data.length, _value), not recursion!).
- a6f170c2 DesugarReturnInLoop now visits freeFunctions (+1): library fns (namespaced free fns, OP_INVOKE
  subroutines) with return-in-loop kept the corrupting raw cleanup (internal_types_in_library).
- 35c21414 NEW PASS DesugarNestedBranchReturn (+2): a MAY-return arm with fall-through (if(a){if(b){return X;}}
  rest) has no jump-free linearization without a flag; EarlyReturnTransformation only else-nests ALWAYS-return
  arms. Rewrites returns to stash+flag, gates tails on !flag, appends one terminal return. Runs after
  NamedReturn (implicit tails explicit), non-entry fns only, triggers only on the crashing class (working
  forms byte-identical). VM-verified fall-through/return/post-return-arm paths.
Then library-registration vein (the gnosis using-Math lead):
- 03127fdb constants-only libraries are not state-touching (+4): `uint public constant ONE` parses as a state
  var -> gnosis Math counted state-touching -> public pure fns auto-marked delegate -> delegate+pure error ->
  EMPTY import registration -> every `using Math for *` consumer failed. libHasState now excludes constant
  decls; pure-library constants bake as namespaced constants (Math.ONE); sibling-constant qualifier also
  fires in a library lowered to a contract. Gnosis StandardToken + Math + 2 others; 9 gnosis files advance to
  their next wall (external calls on state-var members).
- 06727a5b using-for on a KNOWN but function-less library is a no-op binding (+4): empty `library L {}` and
  libraries whose fns were ALL inlined away (storage-pointer fns) threw UsingForUndefinedLibraryError.
  Library names now travel on SourceFileNode.declaredLibraryNames through every import kind; unknown names
  still error. using_for_storage_structs then compiled fully (the inliner already handled its calls).
- 44f0b3a5 L.f.selector folds for library functions (+2): declared signatures recorded at parse time on
  SourceFileNode.libraryFunctionSignatures (survives storage-pointer fns being inlined away), folded via the
  platform's sha256-based computeFunctionSelector.
STILL IN crash bucket (deferred to walls): external_call_to_nonexisting x2 + external_call_state_var_address_
inside_array x2 (external-call machinery/epilogue ordering), state_variable_dynamic_array (layout at),
nowarn_swap_storage_pointers (tuple storage-pointer REBINDING, fundamental), redeemPushSize x5 (abicoder v2
calldata, fundamental). Event .selector (3 files) assessed: needs library-event NAMESPACING (same-name events
in different libraries collide in eventMap) - medium risk, deferred. library_function_selectors.sol/_struct
need address(L)+delegatecall+Yul .slot (multi-wall).

## Session 2026-07-07f part 2 (library values + getters, 3601->3614)
- b2d94acf library function as a fn-pointer VALUE (+4): `ptr = L.f` (FieldAccess) rewrites to the flat
  registered name -> existing fn-pointer path (functionId + OP_INVOKE). Locals + ctor-stored state
  fn-pointers. VM-verified (66-mirror + negative + state-ptr deploy).
- 6d956ac9 struct getters + own-contract-qualified values (+13, the long tail): public STRUCT state var
  getter = members minus mappings/arrays (scalar/string only; array/mapping-bearing structs are flattened
  per-field and SKIPPED so synthesized bodies can never fail on unused declarations); `C.f`/`C.x` with C the
  current contract = own fn as internal fn-ptr value / state read via getter name. Unblocked natspec
  struct-getter trio, getter smoke tests, state_variable_under_contract_name, fn-type comparison, immutable
  inheritance-specifier.
- ASSESSED + REVERTED: mapping->array getters (m(k,i)) - the synthesized BODY hits the unwired
  mapping-entry nested-array READ machinery (entry[-1] slot / int-where-undefined), and a failing
  synthesized body would REGRESS declarations that compile fine unused. Same reasoning capped struct
  getters at scalar members (no struct-typed returns from entry points). nested_arrays_mappings_1-6 stay
  failing until that read machinery exists.
- ASSESSED + REVERTED: marking synthesized getters EXTERNAL (Solidity-true) - cost 3 wins (C.x resolution
  declines external fns) + shifted mapping-arg errors; net negative, reverted.
- Remaining library-vein deferred: event .selector (library-event namespacing - eventMap is single-slot,
  same-name events from different libraries collide), address(L)/delegatecall-on-library (+Yul .slot),
  delegatecall_guard quartet, mapping-alias reassignment (m=m1; ...; m=m2 - flow-sensitive alias regions).

## Session 2026-07-07f part 3 (precedence + bitwise + deploy chains, 3636 confirmed -> 3647)
- 5ee3397e GRAMMAR PRECEDENCE (+15, the big one): the expression ladder had C-style precedence (equality
  above bitwise), so Solidity's `x & y == z` parsed as `x & (y == z)` -> uint-vs-bool UnequalTypeError
  across the bitwise cluster AND anything comparing masked values (ERC165 homer x2, recursion x2,
  UDVT-on-constants x3, compound string-literal x2...). Solidity binds & ^ | ABOVE comparisons; reordered
  alternatives + regenerated parser (NOTE: yarn antlr postantlr sed is BSD-flavored and fails on GNU -
  harmless when the visitor is unchanged). Byte-identity guards vs parenthesised forms.
- bc4f678e literal bitwise folding + mixed-width widening (+7): literal&literal folds via BigInt
  (two's-complement-infinite = Solidity constant eval, negatives incl.); mixed-width SAME-signedness
  operands widen to the larger width; mixed signedness still rejects (solc parity). Replaced the stale
  guard asserting the old rejection. VM-verified.
- 3df706a1 PromoteConstructorExternalReads return typing (+2): the hoisted deploy-input param was ALWAYS
  address; now typed by the callee method's single return type (a.getX() in ctor was becoming address).
- 295acaf7 chained sibling deployment C->B->A (+9): child re-analysis wrapper now carries file definitions
  (registration-only; free fns/using-for excluded - already-desugared bodies must not re-visit);
  collectContractReferences = transitive closure w/ name-matching (referencedContract only stamped by the
  primary's pass); topologicalSort got real dependency edges; synthetic __internal__/__ctorread_ ctor
  params excluded from call-site arg checks (child's own pass mutates the SHARED ctor node first).
  Unblocked external_call_indirect x5 + inheritance calldata pair + function_type_copy + instantiate.
UnequalType bucket CLOSED (+24 of 31): remainder = fixed-point literal coercion x3, abicoder x2, deep x2.
- 664d3e07 int literal -> fixed-point implicit conversion (+2): re-literal as a decimal of the fixed type
  (codegen scales by decimals); b[0] += 1 and -3.5 % 2 forms. Variable int->fixed (uint64 + ufixed) stays
  rejected (needs runtime scaling). VM-verified. 3647 -> 3649.
NEXT-SESSION VEINS (triaged, in task list): deploy-fold RETURN VALUES (r = c.m_x() on a fresh deploy -
foldGenesisExpr can resolve the getter value at compile time; unlocks much of DeployThenCall x18);
fallback low-level-call cluster (external-target x26); mapping-entry nested-array READS (unlocks
nested_arrays_mappings x6 + getter synthesis re-enable); memory 2D arrays (task #1); event .selector
library-event namespacing.

## Session 2026-07-07f part 5 (ctor-genesis + value folds + multi-deploy, 3649->3660)
- 908bca9b CONSTRUCTOR-GENESIS FOLD + VALUE-RETURNING CALL FOLDS (+7): (a) child ctor writes fold into the
  deploy genesis (covenant previously verified TYPE DEFAULTS - silent divergence for arg-initialized ctors;
  unfoldable ctor sets ctorFoldFailed which BLOCKS later call-folds from defaulting unwritten reads = closes
  a latent P3b soundness gap); (b) tryFoldDeployCall seeds from genesis-so-far + folds a trailing return ->
  `r = c.total()` resolves to the genesis expr in the parent (pre-analysis child bodies read/write state as
  BARE identifiers - now handled; ArrayAccess added to foldGenesisExpr; fold-embedded clones PICK-only via
  conditionalRefNames, NOT just opRolls.delete - later source uses re-mark otherwise); (c) emitContractDeployment
  bakes ctor args into the child ADDRESS only for CONTRACT-LEVEL params - Solidity-style constructor(args) are
  NOT redeem data (SDK instantiates with no constructorInputs) - this mismatch broke every factory deploy of an
  arg-carrying Solidity child (found via probe-trace debugging: child master lb EQUALVERIFY aa20ee05!=aa209907).
  NEW CtorGenesisFold e2e: trace-derived genesis (no explicit childInitialState), folded getter requires
  in-covenant, total=s*2+3 landed+parsed. 1861 compiler + 61 deploy e2e.
- b06870b1 multi-site deploys + fold relaxations (+4): one deploy block-slot PER `new C()` site (2nd site
  crashed "Block slot not found: deploy[1]"); deploy-local REASSIGNMENT re-binds fold tracking; require()
  skipped by the fold anywhere in the callee (documented deploy-fold semantics).
DeployThenCall bucket largely cleared; remainder = external calls inside the callee (external_getter_2,
by-design unfoldable v1) + Base(x, f(s)) parent-invocation ctors w/ internal calls (arrays_in_constructors).

## Session 2026-07-07f part 6 (event selectors + task-list closure, 3660->3668)
- 9b882d58 event .selector all qualifier forms (+8): bytes32 = sha256(signature) (signature-injective topic-
  hash analog). Library events register bare (collide) -> parse-time SourceFileNode.libraryEventSignatures
  (like the fn-selector map); contract/interface qualifiers via the node's eventDefinitions; BARE INHERITED
  events via currentContract.eventDefinitions (merged by InheritanceExpansion - the eventMap is keyed by
  SIGNATURE not name, and is not yet filled during state-var initializers). +5 bonus: file-level events,
  foreign-contract/interface access, shadowing.
- TASK-LIST CLOSURE per user directive (ditch or finish): #2 external-call/deploy FINISHED (ctor-genesis +
  value folds + multi-deploy); #3 library symbols FINISHED (remainder = address(L)/delegatecall-on-library
  + Yul .slot = EVM delegatecall model, documented and ditched); #5 UnequalType FINISHED (+24/31); #4 crash
  bucket FINISHED (12/23); #1 memory-2D DITCHED: fails at PARSE (uint[][] memory locals don't parse) and
  behind it sits a full framed-memory-model feature (grammar + new uint[][] + element read/write codegen)
  - a multi-session feature, analysis preserved here. ~64 files gated on it (2D parse + .push receivers +
  storage<->memory nested copies).

## Session 2026-07-08 (assignment-as-expression + self low-level calls + 2 runtime bug fixes, 3668->3702)
Fresh-session triage CORRECTED the prior "memory-2D fails at parse" framing: 2D/nested memory arrays largely
ALREADY PARSE (uint[][] memory locals, uint[2][2], 2D storage push all compile); the real parse walls inside
that bucket were assignment-as-expression (~39 files) and sized dims in `new` (10). All VM-verified.
- ec99a3f9 ASSIGNMENT-AS-EXPRESSION (+18): new right-recursive `assignChain` grammar rule; chains desugar in
  AstBuilder right-to-left, each middle lvalue RE-READ as the next value (`a = b = c;` -> `b = c; a = b;`,
  compound too: `a += b += c` VM-proves b-first ORDER). `return x op= v;` runs assigns then returns the
  first target re-read. Decl-init chains (`uint y = x = n;`) hoist before the decl (multi-statement desugar
  = unscoped BlockNode, flattened by AstBuilder's existing flattenStatements). TERNARY BRANCH ASSIGNS mirror
  solc (its ternary operands are full expressions): optional assign tails on BOTH TernaryOp branches;
  desugared to if/else at statement scope, decl-default + per-arm assign at initializer scope, distributed
  outer assignment at assignment-value scope; anywhere else = clear ParseError guard in visitTernaryOp.
  No new AST nodes - everything lowers to existing tested statements.
- 000fb5f8 SIZED DIMS IN NEW-ARRAY (+6): `new uint[4][](n)` - bracket groups read left-to-right like the
  type form, all but the last may carry a size, allocated (last) dim must stay dynamic. Sizes read from
  token children NOT text regex (the size expression may contain brackets). Unlocked the
  nested_array_element_* family.
- 57f506fb ZERO-INIT BOUNDED ARRAY RUNTIME BUG (pre-existing, verified on baseline): emitDefaultValue
  pushdata-framed every element while the literal/read/write model PACKS fixed-width elements at stride ->
  `int[10] arr; arr[9] = 4;` split out of range (OP_SPLIT 297 vs 10-byte blob; 297 = 9*33). Fixed-width
  elements now pack. Fails-closed class, but broke a basic pattern in EVERY compiling file that used it.
- 5a4b2602 SELF LOW-LEVEL CALLS + INLINE SCALAR-STATE HELPERS (+8 w/ bonus): NEW pre-semantic pass
  LowerSelfLowLevelCalls rewrites `address(this).call(payload)` (2-slot tuple / return / statement sites)
  into a plain internal call + constant-true success (internal calls abort, no revert trap):
  abi.encodeWithSignature("f(..)",args) naming an own fn -> direct `f(args)`; other payloads ->
  `__fallback(payload)` (fallback gets functionId + functionDefinitions entry + GTT subroutine candidacy;
  its entry-only msg.data->_input binding gated off the subroutine compile). msg.data-reading fallbacks are
  NOT lowered (would need payload substitution; copy_from_calldata stays failing).
  SECOND PRE-EXISTING RUNTIME BUG CLASS FIXED (verified on baseline): internal calls to helpers touching
  SCALAR state - read OR write - compiled as OP_INVOKE subroutines whose accesses are invisible to the
  entry's commitment model / NftIndexCollector; EVERY such call failed on the VM (`function inner()
  internal { x = 3; }` broke). Both inline passes now inline scalar-state-touching callees
  (InlineStoragePointerCalls void; InlineReturningStateHelpers single-tail-return); state-touching ENTRY
  POINTS called internally inline at the site but KEEP their definition (new keepDefFns).
- 69624256 SCIENTIFIC LITERALS (+2): DecimalLiteral takes ExponentPart, ExponentPart takes '-'; builder
  folds by point-shifting (2.5e3 -> 2500 int; 1.5e-1 -> 0.15 fixed path; 1e-3 int context stays ParseError).
NOTE: 4 SDK test failures (multi-contract-debugging hardcoded sibling hashes x2, debugging.test.ts:885,
ForeignFunctionPointer FALSE-branch) are PRE-EXISTING on the pre-session baseline 953fe80a - not from this
session; full SDK suite otherwise matches baseline exactly.
REMAINING VEINS (triaged): chained storage push `arr.push().push()` (~11, needs push-returns-ref on 2D);
MethodCallNotSupported (39, mixed); UndefinedStateVariable/Collection (~40, mixed); `(m = m2)[2]` mapping-
paren-assign; encodeWithSelector self-dispatch (abicodec); msg.data payload substitution for lowered
fallbacks; Yul unlowerable (~151, fundamental).
- 72d493f0 INLINER-CRITERIA HARDENING (final score 3702 CONFIRMED by clean full bench): the broadened
  scalar-state criteria initially regressed 9 previously-OK files - CAUGHT ONLY BY THE FULL BENCH (refail
  re-tests failures, it is BLIND to OK-set regressions; found precisely by compiling all current FAILs with
  the pre-session compiler in a git WORKTREE). Four root causes: (1) named-return struct writes desugar to
  state-assign-family nodes resolved contextually later -> criterion now requires a DECLARED state-var name
  + skips param/local-shadowed matches (alpha-rename breaks those clones); (2) fns referenced as VALUES
  (function pointers) were inlined+dropped -> excluded; (3) inlined INHERITED helpers lost private-state
  access -> clone's state accesses tagged fromModifier=defining contract (tagModifierStateAccess exported,
  same mechanism as modifier bodies); (4) expression-inlining a call inside FunctionCallStatement left a
  bare temp in .call (latent crash unmasked once getters became eligible) -> statement re-wraps as dropped
  expression; + empty scopeless blocks stay as placeholders in the SymbolTable splice (a body whose only
  statement was dropped must not trip EmptyFunctionError). BENCH HYGIENE REMINDER confirmed the hard way:
  a mid-run dist rebuild (baseline stash-dance) corrupted one bench run (3694 phantom score).

## Session 2026-07-08b ("go ahead with next veins", 3702->3730 CONFIRMED by clean full bench)
- c5912102 CHAINED STORAGE PUSH (+15): grammar depth-2 push alternatives + buildPushStatement desugars onto
  the EXISTING VM-proven nested keyed-push machinery via pre-push length capture: `c.push().push(v|=v|())` ->
  `uint __i = c.length; c.push(); c[__i].push(v)`; `b.push() = b.push();` -> rhs index capture + push copy;
  2-deep value side (`= b.push().push()`) reads the fresh inner's element at LITERAL index 0;
  `uint[] storage p = c.push();` -> pushPtr alias extended to ARRAY element types (inner default via no-arg
  push; p.push(v) routes through the alias to c[__idx].push(v)). Depth-3 + member/keyed-receiver chains =
  clear ParseError. All 6 forms VM-verified (ChainedPush e2e).
- 3192c71c SELF-CALL EXTENSIONS (+1): abi.encodeWithSelector(this.f.selector, args) resolves the target BY
  NAME pre-semantic (selector = still-unfolded FieldAccess('selector', StateAccess(f))); value-returning
  static targets capture returns (tuple for multi-value) + retval = abi.encode(them) -> caller abi.decode
  ROUNDTRIPS (VM-verified 2-value roundtrip). msg.data-reading fallbacks now INLINE at the call site with
  msg.data + declared input param substituted by the payload (EVM callee-sees-call-data semantics; locals
  alpha-renamed; single-trailing-return restriction). copy_from_calldata GREEN. abicodec still blocked on
  UDVT int->MyInt reinterpretation.
- ff71c45b INLINE DEPLOY RECEIVERS (+5): new pre-semantic HoistInlineDeployCalls: `(new C()).m()` ->
  `C __newcall_N = new C(); __newcall_N.m()` EMITTED IN THE NAMESPACED FunctionCall FORM (`__newcall_N.m`)
  - the deploy-then-call fold route lives in visitFunctionCall's dotted-identifier path; a plain MethodCall
  on a deploy local hits the v1 no-fold throw (it predates plain calls reaching it). Deploys are not
  hoisted out of conditionally-evaluated positions (a deploy mints a child). Sound by reduction to the
  parsed named-local shape.
- cc1febf6 NAMED STRUCT/BYTES RETURNS (+3): registerNamedReturnLocals BEFORE the body build - `returns (S
  memory s)` + `s.x = v` desugars via localStructTypes like a declared local (NamedReturnTransformation
  declares the var later; body-build registration was the only gap). VM-verified combine/extract roundtrip.
MethodCallNotSupported bucket triaged: remainder = fn-ptr-in-struct fields (~6), gnosis contract-typed
state-var targets (~8), using-for named args (2), UDVT walls. UndefinedStateVariable remainder = nested
state-struct registration (structs.sol data.s1data.x), library-qualified struct ctors (verifier Pairing.
G1Point), storage-pointer locals into mappings (copy_to_mapping), 2D memory element writes.

## Session 2026-07-08c ("attack remaining triaged veins", 3730->3732 CONFIRMED by clean full bench)
- 1f7695e3 USING-FOR NAMED ARGS + LIB-QUALIFIED STRUCT CTORS (+2): visitMethodCallNamed gains the using-for
  route (`recv.method({named})` -> `L.method(recv, named...)`, receiver POSITIONAL + fieldNames = tail);
  reorderNamedCallArgs offset case (fieldNames == params-1); BOTH inline passes reorder the named tail
  against callee params before positional substitution (out-of-order {b:1,m:3} VM-verified). Qualified
  struct ctor `Pairing.G1Point(x,y)` resolves post-dot when the prefix is no value symbol + no function
  owns the qualified name (VM-verified).
TRIAGE CLOSURES:
- gnosis/smtChecker contract-typed state targets (~8+6): MULTI-WALL per file (deploy-into-struct-field
  state + ctor-time asserts on struct-field deploy results + typed calls on stored struct-field/array-
  element addresses). Not a clean vein; needs deploy-fold struct-field tracking + external-target-from-
  struct-field machinery.
- NESTED STRUCT FLATTEN = THE NEXT-SESSION VEIN (~5+ files: delete_struct, copy_substructures_to_mapping,
  struct_mapping_abstract_constructor_param, memory_structs_nested_load, +structs.sol/struct_reference if
  recursion-pruned). DESIGN: structNeedsFieldFlattening/buildFlattenedStructField recurse into struct-typed
  fields that THEMSELVES need flattening -> leaf names `str__nstr__nestedValue` (scalar SV) /
  `str__nstr__nestedMapping` (Collection); write/read resolution in buildLvalueAssign + expression chains
  must resolve multi-level member paths through the flatten registry (today: one level via
  mappingStructStateVars); `delete str` resets VALUE leaves only (Solidity leaves mappings intact).
  RECURSIVE self-referencing mappings (structs.sol data.recursive[3].recursive[4], struct_reference) stay
  out (unbounded flatten; cycle guards reject today).
- verifier.sol peeled 2 walls (Pairing.G1Point ctor, named struct returns) -> now an internal bool/uint
  AssignType wall at line 48. snark.sol moved similarly.

## Session 2026-07-08d (nested struct flattening, 3732->3735 CONFIRMED by clean full bench)
- 3cdacff5 RECURSIVE NESTED STRUCT FLATTENING (+3): struct-typed fields carrying mappings expand into nested
  leaves (`str__nstr__nestedValue` SV / `str__nstr__nestedMapping` collection). KEY INSIGHT: registering
  every INTERMEDIATE prefix in mappingStructStateVars makes READS chain through the existing
  visitFieldAccess fold with ZERO read-path changes (`str.nstr` folds to Identifier('str__nstr'), then the
  next fold sees a registered flattened struct); WRITES collapse leading members in buildLvalueAssign so
  the one-level flattened-write paths apply at any depth. structNeedsFieldFlattening + the
  visitStructDefinition mapping-exemption recurse (cycle-safe seen-sets; struct-field cycles are invalid
  Solidity). `delete str` expands to per-VALUE-leaf DeleteState resets - mappings persist (Solidity
  semantics, VM-verified across delete + later-tx persistence). Whole-subtree assigns to flattened-struct
  fields guarded off the scalar path (fall to rebuild diagnostics).
  **PRE-EXISTING RUNTIME BUG FIXED (verified on baseline, BOTH modes): bare integer-literal mapping keys
  (`m[0]`) classified as EXPRESSION key sources; the placeholder route cannot locate an existing entry on a
  PURE READ -> covenant took the absent-entry branch and read the DEFAULT (require(m[0]==7) failed after
  m[0]=7 in a prior tx!). Literal + int-constant-identifier keys now classify as CONSTANT key sources (the
  SDK matches entries directly).** Harness lesson: mapping-bearing contracts need the
  setupStatefulUtxos + StatefulContract.withCategory harness (getContractFactory deploy alone leaves entry
  co-spends unresolvable) - the first probe wave false-failed on ALL mapping ops because of this.
  VM-verified: 2-level write/read/delete/persist, 3-level nesting, literal-key cross-tx roundtrip
  (NestedStructFlatten e2e); 28 mapping-heavy e2e green. Fixed: delete_struct, recursive_structs,
  struct_aliasing_parameter_storage_4. Cosmetic shifts: recursive_struct_2/struct_delete_storage_nested_
  small (permanent Yul-.slot files) surface an int->uint16 flattened-leaf StateAssign coercion gap - only
  reachable in already-failing files.
  STILL OUT: recursive self-mappings (structs.sol depth-2 recursive traversal), whole-subtree struct
  assigns (s.inner = Inner(...) decompose-per-leaf would be the extension), copy_to_mapping (whole-struct
  -> mapping-entry copies), memory_structs_nested_load (struct-field ARRAY-ELEMENT writes m_x.a[0]).

## Session 2026-07-08e (remaining struct walls, 3735->3738 CONFIRMED by clean full bench)
- 54080371 FLATTENED ARRAY-LEAF ASSIGNS + STATE-STRUCT ARRAY-ELEMENT WRITES (+3): `s.a = arr;` routes a
  chunk-dynamic array leaf like a scalar leaf (whole state var; collection-model leaves excluded) -
  VM-verified. `m_x.a[0] = 5` on whole-value struct state vars desugars to the temp roundtrip
  `X __t = m_x; __t.a[0] = 5; m_x = __t;` (sound by reduction to the handwritten form).
  Unlocked: memory_structs_nested_load, struct_delete_storage, name_simplifier.
- **4TH PRE-EXISTING RUNTIME BUG FOUND (baseline-verified, fail-closed): whole-struct STATE writes of
  structs carrying FIXED-array fields fail the covenant's old/new comparison** (`X memory t; t.x=3;
  t.a[0]=5; m_x = t;` handwritten fails identically; two same-length blobs differ at the written elem and
  an EQUALVERIFY treats the var as unwritten or re-encodes differently). Affects the runtime of the
  temp-roundtrip desugar too (compile-correct, rides the broken primitive). DEDICATED FIX = next-session
  candidate: trace where whole-struct StateAssign of fixed-array-field structs misses pendingStateWrites /
  re-encodes (suspect the packed-fixed-array-in-struct encode path, cousin of the zero-init stride bug).
- subtree assigns (`str.nstr = N(...)`) RESOLVED AS INVALID SOLIDITY for mapping-carrying subtrees (solc
  rejects constructing structs with mappings) - no corpus value; whole-value struct-field assigns already
  route via the scalar leaf path.
- copy_to_mapping cluster DEFERRED W/ DESIGN: whole-struct <-> mapping-entry copies need (a) entry-write
  DECOMPOSE `m[0] = s` -> per-field m__f[0] = s__f, (b) whole-read ASSEMBLE `return m[0]` / `S x = s` ->
  per-leaf reads into a struct value, (c) the whole-struct-write bug fix above for roundtrips. Next session
  with fresh context.

## Session 2026-07-08f ("go ahead with what is left", 3738->3740 CONFIRMED by clean full bench)
- d4f83626 **4TH PRE-EXISTING RUNTIME BUG FIXED (SDK)**: encodePushdataValue's array branch pushdata-encoded
  each element (OP_N shortcuts: [5,0] -> 52 55 00) while the covenant's in-script struct encode AND the
  SDK's OWN decodePushdataValue pack fixed-width elements at stride (52 0500 0000) - every whole-struct
  state write of a struct with a fixed-array field failed the output-commitment EQUALVERIFY. Fixed-width
  elements now pack via packFixedWidthArray (encoder = decoder = covenant). Trace technique: the failing
  EQUALVERIFY's two operands (covenant-computed vs OP_OUTPUTTOKENCOMMITMENT) decoded byte-by-byte exposed
  the OP_N-shortcut framing. The round-5 temp-roundtrip is now RUNTIME-sound (e2e upgraded to VM).
  DynamicMappingKeys' literal-key assertion updated to the fixed 'constant' classification.
- 575805ff WHOLE-STRUCT ENTRY COPIES + WHOLE READS (+2): `m[0] = s` decomposes to per-field entry writes
  (value = flattened state var / whole-var alias / local struct; mapping fields skipped - no value form);
  whole reads (`S memory x = s` / `= m[k]` / return) ASSEMBLE the struct ctor over leaf / entry reads
  (recursive for nested flattened state fields; entry side one-level to match the collection flatten;
  guarded to mapping-free structs). `S storage sLocal = s` = whole-var alias. VM-verified full cycle incl.
  dynamic (bytes) fields. Unlocks copy_to_mapping + copy_substructures_to_mapping.
STILL OUT: skip_dynamic_types_for_structs (getter synthesis for flattened structs + tuple-from-self-call =
double wall); recursive self-mappings; struct ctor values in entry writes (`m[k] = S(...)` - extend the
decompose with per-arg values if corpus demands).

## Session 2026-07-09 (baseline re-confirm + next-walls survey, 3740/4876 STABLE)
Clean full rerun: 3740 OK / 1136 FAIL / 2190 negative-skipped (895 over-accepted, diagnostic) / 277
multifile. ZERO regressions, zero drift vs 2026-07-08f. Failure census: parse 342, Yul 168 (fundamental),
smtCheckerTests 241 / syntaxTests 338 by dir. Ranked walls (samples + counts from results.json):
- **BUG: C3 linearization direction (11)** - `contract Derived is Base, Base1` (Base1 is Base) rejected
  "cannot compute linearization" but this IS valid solc order (most-base FIRST; the C3 merge must consume
  the REVERSED parent list). Python-style C3 w/o reversal fails exactly this. Incl. real DAO.sol.
  pass_dynamic_arguments_to_the_base_base.sol is the minimal repro. Related: 10x
  UndefinedParentInvocationError (ctor init chains naming grandparents) may share the hierarchy walk.
- **CRASH: __internal__redeemPushSize not on stack (13, one root cause)** - self-external `this.g(m)` with
  fixed-array memory arg (abicoder calldataDecoding cluster), crash inside the internal-call inline pass.
- **Tuple-LHS holes (~30)** - `(x.executed,) = a.call{...}()` trailing comma (unlocks all 5 MultiSigWallet
  real contracts incl. factories-by-import), `(m[0], , m[2]) = (1,3,4)` skipped components w/ expr targets,
  bare tuple statements `(abi.encode, 2);`, corion `(bool a, bool b, uint c) = f()` decl destructure w/
  delete-on-nested-mapping-path mixed in (9 corion files).
- **Fn-typed values beyond identifiers (~35)** - `s[0]()` / `arr[m]()` calls on array elements,
  `function()[]` array types, `.address`/`.selector` on fn values, struct fields holding external fns
  (= the stored/passed fn-ptrs open item in function_pointers.md).
- **push nested receivers + push-as-lvalue (24)** - `data[2].d.push()`, `tree.children[0].children.push()`,
  `c.push().push() = 2` (15x "Unsupported .push receiver" + 9x parse on `.push` LHS).
- **Soft keywords + literal lexing (~20 cheap grammar)** - `error`/`transient`/`leave`/`fallback`/
  `receive`/`require` as identifiers; `uint7`/`fixed1x01` as identifiers; underscore separators in
  hex/decimal literals (3-4 files).
- **gnosis contract-typed cluster (17 + OptimizorClub)** - `Token[] outcomeTokens` state arrays with
  element method calls `outcomeTokens[i].balanceOf(..)` (array-element external calls exist for the cast
  form; typed-state-array sugar missing), named-arg calls `this.foo({c:1})`.
- **extcall target pinning (19)** - targets not ctor/fn params (hardcoded/derived addresses); sound
  redesign = state/constant-pinned targets (hardcoded_address_mocks memory).
- **m[k] = S({named}) ctor-value entry writes + `m = m2` mapping-local reassign (~13 undef-m)** - the
  noted decompose extension.
- **StateAssign nested-array copies (16)** - `a = d` nested `uint[][]`, different-base copies, chained
  `data2[8] = data2[9] = v` on state elements.
- **NonCompileTime const folding (17)** - `bytes4 constant s = B.g.selector`, contract-typed constants
  `Identity constant i = Identity(address(0x4))`, abi.encode in const init.
- **DeployThenCall P4 (14)** - control flow + mapping entries in deploy-folds (known open).
- **Memory nested collections (18 UndefinedCollection)** - `z[170].b[99]`, `delete x[3][2]`, `s.a[0][1]++`
  on memory struct/2d-array locals.
FUNDAMENTAL/SKIP: Yul 168; experimental `type word = __builtin(..)` stubs; ASTJSON/lsp/natspec harness
files; `layout at` storage-layout specifiers (EVM slot semantics).

## Session 2026-07-09 round 2 (grind tier 1->3): 3740 -> 3784 CONFIRMED by clean full bench (+44, 0 regressions)
Four commits, all VM/suite-verified, clean full bench diff = 0 OK->FAIL, +44 FAIL->OK, +9 NEG-ACCEPTED
(all missing-strictness diagnostics on abstract/negative override + naming tests, not unsound codegen).
- 72da854f **C3 LINEARIZATION DIRECTION BUG + ctor chains + override dominance (+27, incl real DAO.sol)**:
  Solidity lists bases most-base-first, so the C3 merge must consume the REVERSED parent list (rightmost =
  highest priority). The Python-direction merge REJECTED valid linear chains (`Derived is Base, Base1` where
  Base1 is Base) and resolved `super` in multi-base contracts to the wrong side - both VM-verified now
  (super picks rightmost). Constructor-list entries are grammatically identical for parents vs modifiers:
  modifier invocations reroute to customModifiers; invocations naming INDIRECT ancestors (grandparent ctor
  args through abstract links) inline that ancestor's expanded ctor most-base-first, guarded vs chain-covered
  double runs. Diamond detection resolves RELATED origins by dominance (an override in a derived base beats
  the overridden ancestor version) instead of throwing; override(A,B) accepts abstract base declarations.
  SDK: ContractFactory.deploy maps positional args beyond constructorInputs to DeployOptions.initArgs.
- 19336e28 **msg.data-in-subroutine crash -> clean diagnostic (robustness, 7 files)**: _redeemPushSize is
  computed once at contract level (OP_ACTIVEBYTECODE = full script) and left on the entry-point stack;
  reading msg.data inside an OP_DEFINE subroutine (plain internal helper OR self-external this.f() lowering)
  reached a _redeemPushSize not on the subroutine stack and crashed. Self-external calldata semantics
  (callee msg.data = the self-call's encoded args) don't map to BCH's single input-bytecode model, so it's a
  genuine unsupported case: emit MsgDataInSubroutineError at the read site. Entry-point msg.data unaffected.
- 594de183 **parenthesised single declaration `(uint a) = expr` (+3)**: solc one-element tuple decl. Two
  grammar alts restricted to a declaration (a type after `(`), so `(a) = b` stays a plain assignment. 0
  regressions across 2623 OK tuple/paren corpus files. Tuple LHS HOLES already worked pre-session.
- 2bbecaf3 **soft keywords as declaration/variable names (+14)**: error/revert/transient/leave/global as
  contract/struct/enum/type/event/error/enumMember/constant names, state-var names, and the revert
  error-name target route through anyIdentifier (added transient/leave to it). Keyword-led require/revert +
  the transient data location keep their parse via alt ordering. 0 regressions across all 3740 OK files.
DEFERRED (assessed this session, documented for next):
- **Complex-lvalue tuple targets** `(x[0], s.e) = (a, b)` + nested tuples `(a,(b,c))=...`: genuine
  multi-touch codegen (target-type resolution via a SymbolTable walker like desugarStateTupleAssignment +
  per-shape lvalue-write node construction for the sound eval-all-then-assign capture). ~12-15 files across
  tuple + array-copy clusters. MultiSigWallet also blocked on `.call{value:}` to arbitrary addresses.
- **T2.4 function pointers** (~35, fn-typed array elements arr[i](), function()[] arrays, ternary fn
  selection (b?f:g)(), x()()()): the stored/passed fn-ptr feature. Tractable non-pointer bits (~5): paren
  delete `delete(b)`, paren-wrapped call target `(foo)()`.
- **T2.5 push receivers** (24): mostly nested-STATE-collection push `a.b.push()`, `data[i].d.push()`
  (chunk-backed nested mutation) + recursive-struct smtCheckerTests (fundamental). Low tractable yield.
- **const folding** (17): per-builtin compile-time eval (abi.encode/bytes.concat/keccak256/sha256 in const
  init) + .selector/type().name/creationCode constants + contract-typed constants. Fragmented, ~1-2/each.
- KNOWN over-permissiveness (missing diagnostics, negative tests only): override-list exhaustiveness +
  duplicate-contract detection; `transient` as a state-var name where solc's data-location rule rejects.

## Session 2026-07-09 round 2 cont. (complex-lvalue tuples): 3784 -> 3790 CONFIRMED by clean full bench (+6, 0 reg)
- d9380e21 **complex-lvalue tuple targets `(x[0], s.e) = (a, b)` (+6)**: tupleSlot accepts an index/member
  lvalue chain; `(lv0,..,lvN) = (e0,..,eN)` with an index/member target desugars to per-slot writes via
  buildLvalueAssign (reuses every existing lvalue-write path: local array element, struct member, nested
  field array). Solidity evaluates the whole RHS before assigning; direct sequential matches iff no RHS
  reads a target base var, so the desugar is GATED on that alias-safety (word-boundary check) and declines
  otherwise - a swap-through-the-same-array falls back to the general path (a compile error) rather than
  miscompiling. Skipped slots evaluate their RHS as an ExpressionStatement so side effects run. VM-VERIFIED
  (ComplexTupleAssign.test.ts): index/member/skip/nested writes land, untouched elements stay zero.
  NOT covered: single tuple-valued RHS (a.b() returning a tuple), nested tuples ((a,(b,c))=..), push-in-slot.
- REVERTED this round: requireMessage `| expression` (accept `require(cond, msgVar)`) - relaxed NATIVE-mode
  strictness (`require(true, boolVar)` was a correct native reject) for a single corpus file; not worth the
  fixture churn + a type check to keep native sound. Left as-is.
- SESSION 2026-07-09 TOTAL: 3740 -> 3790 CONFIRMED (+50), 6 feature/fix commits + 3 docs, 0 regressions
  throughout. C3 direction bug (+27 incl DAO.sol), msg.data-subroutine diagnostic, paren single decl (+3),
  soft keywords (+14), complex-lvalue tuples (+6). +9 NEG-ACCEPTED (missing-strictness on abstract/negative
  override + naming tests, not unsound). Remaining walls all hard/fragmented (fn-ptrs, nested-state push,
  gnosis, extcall pinning, per-builtin const folding) - see corpus_grind_2026_07_09_r2 memory.

## Session 2026-07-09 round 2 cont.2 (crash-bucket triage): 3790 -> 3792 CONFIRMED by clean full bench (+2, 0 reg)
- 807d8375 **triaged 3 of 9 internal "Cannot read properties of undefined" crashes -> 2 real fixes + 1 diagnostic**:
  (a) FORWARD-REFERENCE UDVT IN A STRUCT FIELD (+1): `struct S { U u; } ... type U is address;` - file-level
  struct fields resolved BEFORE UDVTs registered, leaving f.type undefined until artifact gen crashed. Split
  registerStructDefinitions into registerStructNames + buildStructFields; register UDVTs (primitive-wrapping,
  never struct-dependent) in between at the file level.
  (b) SOURCE-MAP GEN (+1): crashed on a compiler-generated instruction with no location; serialise an empty
  "same-as-previous" entry (solc parity) - source maps are best-effort debug info orthogonal to bytecode.
  Unblocked compound bitwise assignment `x |= y` (compound_bitwise_or_uint_2).
  (c) STATE-VAR ASSIGNMENT-AS-EXPRESSION (`(b = false) && ..`) -> clean MsgData-style diagnostic: resolves to a
  StateAssignNode (no stack slot, no value-form codegen); a short-circuit operand would make the write
  CONDITIONAL, unsound on a covenant. Reject at type-check instead of crashing on the missing identifier.
- PROTOTYPED+REVERTED: m[k] = S({named}) mapping-entry write decompose (m[k]=S(..) -> per-field m__f[k]=arg,
  named or positional) - sound + regression-clean but unlocks 0 files alone. copy_from_mapping/copy_substructures
  ALSO need whole-entry READ into a state struct var (s = m[7] -> s__f = m__f[7]) + storage-alias reassign
  (S storage sLocal=s; sLocal=m[7]), both with dynamic bytes/array leaves. Deferred as a dedicated feature.
- REMAINING 4 CRASHES (hard areas): event-aggregation pair (contract-typed state var c.f()), msg.sig
  (EVM-specific selector), copy_struct_to_array_stored_in_mapping (complex mapping copy).
- SESSION 2026-07-09 GRAND TOTAL: 3740 -> 3792 CONFIRMED (+52), 7 feature/fix commits + 4 docs, 0 regressions
  throughout. C3 direction bug (+27 incl DAO.sol), msg.data-subroutine diagnostic, paren single decl (+3),
  soft keywords (+14), complex-lvalue tuples (+6 VM-verified), 2 crash fixes (+2). +9 NEG-ACCEPTED
  (missing-strictness on abstract/negative tests, not unsound).

## Session 2026-07-09 round 2 cont.3 (correctness: mapping-struct-copy + crash triage): 3792 -> 3793 CONFIRMED (+1, 0 reg)
User directive: TARGET CORRECTNESS, not corpus unlocks ("if it works in Solidity it should work for us too").
- 45ae91fc **whole-struct <-> mapping-entry copies (VM-VERIFIED, +1 copy_from_mapping_to_mapping)**: reinstated
  the reverted m[k]=S({named}) write and COMPLETED the cycle. resolveWholeStructValue unifies the value source
  (a direct S(..) ctor, or a whole read m[k]/state-var assembled into the same ctor shape) so write/read/copy
  share one decompose. m[k]=S({..})/S(..) -> per-field entry writes; s=m[k]/s=S(..) -> per-field STATE writes
  (mirror); m2[k]=m[j] entry-to-entry. VM test solidcash/test/e2e/MappingStructCopy.test.ts (5 roundtrips:
  named/positional write, whole read into state var, wrong-expectation-reverts, entry-to-entry). TWO
  pre-existing gaps found + BOUNDED (not shipped as compile-but-run-wrong): (a) ARRAY fields inside a
  mapping-of-struct value hit `Block slot not found: entry[-1]` (affects any mapping-to-array; bytes works,
  fixed+dynamic arrays do not) - out of scope; (b) storage-alias reassign (sLocal=m[k]) MISCOMPILED so the
  decompose is restricted to DIRECT state vars and the alias form is left to fail cleanly. copy_from_mapping /
  copy_substructures stay FAIL (need both gaps) - the SOUND reject, not a miscompile.
- 79cf1cb0 **crash triage round 2: 3 more crashes -> clean diagnostics**: msg.sig in an INTERNAL function
  (undefined functionSelector pushed -> libauth crash) -> MsgSigInInternalFunctionError; statement call with
  no callee identifier (`c=new C(); c.f()` stored-contract cluster) -> MethodCallNotSupportedError. With cont.2
  this clears 8 of 9 "Cannot read properties of undefined" crashes (2 real fixes +2 corpus, 6 diagnostics);
  only copy_struct_to_array_stored_in_mapping (mapping-to-array-of-struct) remains.
- SESSION 2026-07-09 GRAND TOTAL: 3740 -> 3793 CONFIRMED (+53), 9 feature/fix commits + 5 docs, 0 regressions
  throughout. VM-verified: complex-lvalue tuples, mapping-struct copies. Correctness posture: bounded every
  pre-existing gap rather than shipping compile-but-run-wrong.

## Session 2026-07-09 round 2 cont.4 (CORRECTNESS: struct storage pointer alias): 3793 STABLE (+0 count, miscompile fixed)
User directive continued (correctness > unlocks). Investigated "fix the branchOps misclassification for aliased
writes" - the branchOps hypothesis was WRONG (disassembly showed the divergence was a real state write vs a
LOCAL-COPY write, not a misclassification). Found + fixed the actual bug:
- 0791127e **struct storage pointer to a state var SILENTLY COPIED instead of aliasing (miscompile, FIXED)**:
  `S storage sL = s` on a NON-flattened struct fell through to a local copy (extractStorageAccessPath returns
  undefined for a bare identifier; the alias branch only fired for flattened mappingStructStateVars). So
  `sL.f=v` / `sL=other` / `delete sL.f` wrote/cleared the LOCAL and left `s` unchanged. FIX: register the
  whole-var alias for ANY struct state var, substitute the container in buildLvalueAssign + visitDeleteMember,
  gated `!mappingStructStateVars.has` (flattened structs keep a clean reject, not a miscompile). VM-verified
  (solidcash/test/e2e/StructStoragePointer.test.ts, 5 roundtrips: field write / whole assign / read / delete
  all reach s; wrong expectation reverts). Fixes struct_delete_member (was returning stale data1.m_value).
  0 corpus count change (the affected files were already OK-but-miscompiling; bench measures compile only),
  0 regressions / 966 mapping-struct OK files, solidc 1884 green. THIS is the correctness win the bench can't see.
- SESSION 2026-07-09 GRAND TOTAL: 3740 -> 3793 CONFIRMED (+53 compile) + multiple SILENT-MISCOMPILE fixes
  (struct storage pointer, and every bounded gap), 10 feature/fix commits + docs, 0 regressions throughout.

## Session 2026-07-09 round 2 cont.6 (tasklist: paren-call target): 3797 -> 3804 CONFIRMED (+7, 0 reg)
- 5e36b05b **parenthesised simple call target (foo)()/(L.f)()/(blockhash)(n) (+7)**: 2 functionCall grammar
  alts unwrap a SIMPLE parenthesised callee to the same node (Identifier_list+expressionList identical, no
  builder change). Non-simple ((b?f:g)(), (get_ptr(x))(), x()()) = fn-pointer, unmatched. +7 not +3 (bench
  found (h)(42)/(x.f)() forms in smtChecker functions_identity_as_tuple / nested_tuple too). 0 regressions.
- TASKLIST: all 3 open tasks (T2.4 fn-typed, T2.5 push, T3 tier-3) WORKED - banked paren-call(+7)+const-dim(+4);
  cores DEFERRED as hard (fn-pointers, nested chunk-backed push, dynamic/nested-array copies, deploy-fold P4,
  contract-typed state) or FUNDAMENTAL (recursive self-mappings/arrays, dynamic-array-as-mapping-value, Yul).
- **SESSION 2026-07-09 GRAND TOTAL: 3740 -> 3804 CONFIRMED (+64 compile)** + silent-miscompile fixes (C3 super
  direction, struct storage pointer aliasing) the compile-bench can't measure. ~12 feature/fix commits, 0 regressions.

## Session 2026-07-09 round 2 cont.5 (tasklist: const-dim arrays): 3793 -> 3797 CONFIRMED (+4, 0 reg)
- 40a16f74 **parenthesised/arithmetic constant array dimensions (+4)**: resolveArrayBound already evaluates
  the dimension expr (visitParenthesised unwraps), but the constant PRE-SCAN only recorded plain-literal inits
  (/^[0-9]+$/). Now evaluates each constant's init via evalConstIntNode to a fixpoint (order-independent),
  gated to int-typed constants (a bytes/bool const whose value looks like an int stays out). Unblocks
  parentheses/unary_fine/rounding/can_be_recursive_constant; erc7201-dims stay rejected (EVM-specific).
  0 regressions / 777 OK const+array files. SESSION TOTAL: 3740 -> 3797 (+57 compile) + silent-miscompile fixes.

## Session 2026-07-09 round 2 cont.7 (tasklist: T2.5 push + T3 2D-delete): 3806 -> 3808 CONFIRMED (+2, 0 reg)
- **indexed struct-field array push/pop (data[i].d.push, s1.arr[i].push, m[k].d.push/pop) (+1 compile, VM-sound)**:
  the 14-file "Unsupported .push/.pop/.delete receiver" cluster. AstBuilder buildIndexedFieldArrayPushPop lowers a
  receiver mixing an index key and a struct field to whole-array read-modify-write (T[] __pf=<recv>; __pf.push(v);
  <recv>=__pf;), reusing buildLvalueAssign for the write-back via a NEW opt-in valueNode param threaded through the
  6 flattened-field '=' value sites + buildLocalStructArrayFieldWrite (undefined for all existing calls => byte-identical).
  resolvePushReceiverArrayType walks segs from the container type (stateArray/stateStruct/localStruct/mappingStructState/
  mappingStructValue) to type the temp. **mapping-of-struct m[k].d routes to the NATIVE flattened m__d[k] append**
  (tryMappingStructFieldPush) - a RMW re-reads the STALE entry (a mapping entry's in-tx write is invisible to a later
  read), so multi-push would NOT accumulate = SILENT MISCOMPILE, caught + fixed + VM double-push test. Only
  length_1d_struct_array_2d_1 flips in the corpus (+1); the rest bundle 3-level member-key-member (t.s[0].b, write-back
  itself unsupported) or recursive structs (fundamental) or ++x.push() (correctly rejected). solidcash e2e
  IndexedFieldArrayPush 4/4 (push+pop x array/struct-field/mapping bases). CORRECTNESS-FIRST: the shapes now match
  Solidity even where the compile-bench can't score them.
- **2D/3D nested-array delete (delete d[i][j]) (+1 compile, VM-sound)**: DesugarNestedArrayWrite.tryDesugarLocalArrayDelete
  extended from 1-key to N-key - walks the element type N levels, builds the type default, single-key -> ArrayAssign,
  multi-key -> MappingAssign default reused through the nested-array write desugar (local + nested-state arrays). Mappings
  untouched (not in locals/stateArrays -> stays MappingDelete). solidcash e2e NestedArrayDelete 2/2 (zeroes the element).
- CorpusGapFixes +4 guards (nested delete compile+bytecode-identical, indexed push/pop, 3-level still-rejected). solidc
  1895 green, 0 regressions. **SESSION 2026-07-09 GRAND TOTAL: 3740 -> 3808 CONFIRMED (+68 compile)** + silent-miscompile
  fixes (C3 super direction, struct storage pointer, mapping-of-struct push accumulation) the compile-bench cannot measure.

## Session 2026-07-09 round 2 cont.8 (next-walls: soft-keyword fn/param names): 3808 -> 3812 CONFIRMED (+4, 0 reg)
- **fallback / receive usable as ordinary identifiers (+4)**: both are contextual (not reserved) in Solidity, so
  `function fallback() {}` / `function receive() {}` (regular named functions, distinct from the special no-`function`
  forms) and a param named `fallback`/`receive` are valid. Grammar: added 'fallback' | 'receive' to anyIdentifier
  (the same soft-keyword list already holding deploy/selfdestruct/error/revert/transient/...). functionDefinition +
  parameter already use anyIdentifier so no rule change; the special fallbackDefinition/receiveDefinition still match
  the token so the real fallback/receive functions are unaffected (verified). A named `fallback`/`receive` compiles to
  a NORMAL ABI entry (no special dispatch). Unblocks fallback_as_function_name, receive_as_function_name,
  named_fallback_warning, named_receive_warning. `require`/`_` as names NOT added (require needs expression-position
  identifier support entangled with require(); `_` collides with the modifier placeholder). solidc 1895 + CorpusGapFixes
  186 green, 0 regressions.
- **NEXT-WALL TRIAGE at 3812** (surveyed, deferred with reasons so they are not re-chased): function pointers /
  function types (`function(..) external` types, `[N]` arrays of them, `.selector`/`.address` on functions) ~60+ files
  = the single largest remaining vein, EVM-model core; Yul ~175 fundamental; recursive structs fundamental; local-memory
  nested collections (create_memory_array z[i].a[j]) deep memory modeling; **address ordering `a < b` NOT sound on BCH -
  address is a variable-length locking bytecode, not uint160, so `<`/`>` has no EVM-matching semantics (drop)**; tuple
  extra-parens/holes (((, a))=..) pathological smtChecker edge; corion/gnosis multi-issue deep DApps. GRAND TOTAL
  SESSION 2026-07-09: 3740 -> 3812 CONFIRMED (+72 compile) + silent-miscompile fixes (C3, struct storage ptr, mapping-
  of-struct push accumulation).

## Session 2026-07-09 round 2 cont.9 (next-walls: const bytes/string.concat fold): 3812 -> 3814 CONFIRMED (+2, 0 reg)
- **bytes.concat / string.concat usable in a constant initializer (+2, VM-sound)**: `bytes constant abc =
  bytes.concat(aaaa, hex"bbbb", hex"cccc")` folds at compile time. Two symmetric one-liners in SymbolTableTraversal:
  (1) isCompileTimeExpression accepts BytesConcatNode/StringConcatNode when all args are compile-time; (2)
  resolveConstantExpressionIdentifiers recurses into their .parameters so a const-ref arg (e.g. aaaa) gets its
  .definition linked - without (2) the arg reached TypeCheckTraversal.visitBytesConcat with type=undefined
  ("expects bytes or string, found undefined"). The two functions now cover the SAME node set (Literal/Binary/
  Unary/Cast/Array/Identifier/FieldAccess/Bytes|StringConcat), closing the "passes compile-time check but leaves a
  nested ref untyped" bug class. Reference sites re-emit the existing visitBytesConcat/visitStringConcat codegen
  (concat of the inlined-literal pushes) - VM test (solidcash e2e ConstBytesConcat) confirms abc == hex"aaaabbbbcccc"
  and a wrong expectation reverts. Unblocks bytes_concat_const_args + string_concat_const_args. The rest of the
  NonCompileTime cluster needs compile-time keccak256/abi.encode/type().creationCode (deferred, harder). solidc 1898
  + CorpusGapFixes 185 green, 0 regressions.
- **CEILING NOTE**: at 3814 the clean tractable veins are mined out. Remaining large clusters are EVM-model cores:
  function pointers/types ~60+ (largest), Yul ~175, recursive structs, local-memory nested collections, deploy-then-call
  non-foldable patterns (BCH can't call a same-tx-deployed contract unless folded), address ordering (unsound on BCH).
  GRAND TOTAL SESSION 2026-07-09: 3740 -> 3814 CONFIRMED (+74 compile) + silent-miscompile fixes.

## Session 2026-07-09 round 2 cont.10 (drill: fn-pointer call from array element): 3814 -> 3818 CONFIRMED (+4, VM-sound)
- **calling a function pointer from an array element `arr[i]()` / `arr[i](x)` / `s.arr[i]()` (+4, VM-verified)**:
  the dispatch already worked (calling a fn-ptr VARIABLE `f()` compiles+runs); only the grammar lacked a call on a
  non-name callee. Root finding: most fn-type SYNTAX already parses (param/local/state/array/struct/mapping-value);
  the "(" parse cluster is specifically CALLING an indexed fn-ptr. Added a NARROW grammar alt
  `base=expression '[' index=expression ']' expressionList # IndexedFunctionCall` (NOT a broad `expression
  expressionList` - that stole this.a(i) getters, (foo)() paren-calls, this.transfer(); reverted after 14 suite
  failures). New isolated IndirectCallNode(callee, params): AstVisitor abstract + AstTraversal default recursion
  (34 subclasses inherit, only TypeCheck+codegen override). TypeCheck mirrors the fn-ptr-var indirect branch
  (callee.type must be FunctionType, result = its returns). Codegen mirrors visitIndirectFunctionCall: eval args
  reverse, eval callee (pushes the integer functionId), OP_INVOKE. solidcash e2e FunctionPointerArrayCall 2/2
  (a[i]() dispatches to add1/add2/mul10 by index; wrong expectation reverts = real runtime dispatch). Flips 4 OK
  (calldata_array_function_types_v2, array_function_pointers, function_memory_array) +1 NEG-accepted
  (calling_uninitialized_function_through_array - missing solc compile diagnostic but SOUND: uninit ptr=0,
  OP_INVOKE on unknown id hard-fails = Solidity's runtime revert). Uncovered: chained x()() (needs the broad alt),
  storage fn-ptr arrays, mapping-value fn-ptr storage (entry[-1], separate gap). solidc 1898 + CorpusGapFixes 187 green.
  **KEY: the fn-pointer "core" is NOT monolithic - the dispatch primitives exist; parse+wire slices are tractable.**
  SESSION 2026-07-09 GRAND TOTAL: 3740 -> 3818 CONFIRMED (+78 compile).

## Session 2026-07-09 round 2 cont.11 (drill: parenthesised/ternary fn-ptr callee): 3818 -> 3826 CONFIRMED (+8, VM-sound)
- **call the value of a parenthesised callee `(cond ? f : g)(args)` / `((super).f)()` / `(get_ptr(x))()` (+8)**:
  extends the IndirectCallNode infra from cont.10. One grammar alt `'(' expression ')' expressionList #
  ParenthesizedFunctionCall` placed AFTER functionCall#FunctionCallExpression so a SIMPLE `(foo)()` still routes to
  the direct paren-unwrap and only a non-simple parenthesised callee (ternary etc.) reaches here. AstBuilder
  visitParenthesizedFunctionCall builds IndirectCallNode(callee=inner expr, args) - NO TypeCheck/codegen change
  (reuses cont.10's node: ternary-of-fn-ptrs types to FunctionType, OP_INVOKE dispatches). +8 not +5: the fix also
  unblocked files whose first error bucketed elsewhere. solidcash e2e FunctionPointerTernaryCall VM-verified
  ((c?inc:dec)(v) picks the branch; wrong reverts). Regressions clean: (foo)() simple paren, (a+b)*c arith, (a,b)
  tuple all still parse right. 0 OK->FAIL, negative-accepted unchanged (907). solidc 1900 + CorpusGapFixes 188 green.
  Remaining fn-ptr "(" forms: chained x()() (call-result called, needs a call-result alt), x.length() attached-lib,
  multi_slot_function(this.foo,..) fn-ptr args. SESSION 2026-07-09 GRAND TOTAL: 3740 -> 3826 CONFIRMED (+86 compile).

## Session 2026-07-11 (3879 -> 3884 CONFIRMED, +5, 0 regress, NEG-ACCEPTED flat 910)
- **branch-local external-call target capture (f0bdc31b, +1 Migrations, VM-verified)**: an extcall target that
  is a contract/interface-typed LOCAL declared in a NON-LOOP branch (e.g. a `restricted` modifier's if-wrapper:
  `Migrations u = Migrations(a); u.setCompleted(..)`) is popped before the epilogue co-spend verification ->
  "Expected variable 'u' does not exist on the stack". New pass CaptureBranchExternalCallTargets synthesizes a
  function-top local, captures the target right after its decl, rewrites the receiver to the capture. Sound by
  reduction (byte-equivalent to the already-supported inline `if(cond) IFoo(a).m()` form). Loops excluded
  (per-iteration array dispatch); function-top locals untouched. VM: BranchLocalExternalCall.test.ts.
- **string/hex/zero literal mapping KEY -> bytesN coercion (97ccaeff, +4)**: `m["foo"]` where the key type is
  bytesN was rejected while the VALUE side already coerced. Ran node.keys through the same coerceHexArgs pipeline
  at all 4 key-check sites (access/assign/field-assign/delete). Compat-gated; byte-identical to the explicit
  `m[hex"666f6f00..00"]` padded literal. Files: implicit_cast_string_literal_byte, mapping_with_cast, mapping_6, +1.
- **GNOSIS 22->23** (Migrations); remaining 8 all DEEP/FUNDAMENTAL: new-C()-in-ctor-loop (UTXO-fundamental,
  variable genesis outputs), getter-in-loop / array-alias+chained (deep per-iteration dispatch), 2 one-offs.
  Clean-slice veins EXHAUSTED - remaining 992 = ParseError-diverse / Yul / type-fundamental / fn-pointers /
  deep-struct-memory (value-copy model). solidc 1922 + CorpusGapFixes green.

## Session 2026-07-23 (fresh baseline 4002 -> 4004 CONFIRMED, +2, NEG-ACCEPTED flat 892)

- **Bare array member references are no-op statements (+2)**: Solidity accepts `data.pop;` without calling the
  member function; evaluating and discarding that function reference has no side effect. The expression-statement
  grammar now accepts bare `.push`, `.pop`, and `.delete` tails and AstBuilder lowers them to an empty block.
  Bytecode-equivalence tests cover both `uint256[]` and `bytes`; the full 7,343-file corpus run moved exactly the
  two expected fixtures (`array_pop_isolated.sol`, `byte_array_pop_isolated.sol`) from FAIL to OK with no increase
  in negative-test over-acceptance. `CorpusGapFixes.test.ts`: 412 green.
- **Current failure shape (872 files)**: grammar/explicit parse rejection remains the largest category; the leading
  semantic walls are unsupported Yul combinations (38 under the top normalized reason), type assignment failures,
  undefined collections, computed external-call targets (20), deploy-then-call (16), and invalid data locations.
  Nine `RangeError: Maximum call stack size exceeded` results remain compiler-robustness bugs rather than ordinary
  parity diagnostics and should be triaged separately.

### Continued bench/fix loop: 4004 -> 4013 (+9, NEG-ACCEPTED flat 892)

- **Bare ABI builtin references (+2, 4004 -> 4006)**: `abi.encode;`, `abi.encodePacked;`,
  `abi.encodeWithSelector;`, `abi.encodeWithSignature;`, and `abi.decode;` are Solidity function-value references
  whose discarded result has no effect. A dedicated statement rule lowers them to an empty block, byte-identical
  to omission. Unblocks the semantic and syntax variants of `abi_functions_member_access.sol`.
- **Cycle-safe metadata walkers (+6, 4006 -> 4012; all 9 internal crashes eliminated)**: resolved function/type
  graphs can contain identity cycles that are not covered by the walkers' fixed back-reference-key skip lists.
  Added `WeakSet` guards to ecrecover call counting, keccak-in-loop detection, return-in-loop detection, genesis
  input scanning, conditional-entry scanning, and loop-entry scanning. Six formerly crashing fixtures now compile;
  the other three reach specific normal diagnostics. The `RangeError: Maximum call stack size exceeded` corpus
  bucket is now zero. A newly exposed negative `delete f;` (function declaration, not lvalue) is explicitly rejected
  as `InvalidSymbolTypeError`, keeping NEG-ACCEPTED flat.
- **Bare `assert` reference (+1, 4012 -> 4013)**: `assert;` references and discards the builtin function and is a
  Solidity warning/no-op. It now follows the builtin-reference empty-block path while `assert(condition)` retains
  the existing assertion path. Final scorecard: **4013/4876**, 863 failed, 892 NEG-ACCEPTED.

### Continued bench/fix loop: 4013 -> 4026 (+13, NEG-ACCEPTED flat 892)

- **Event argument literal coercion (+6, 4013 -> 4019)**: emit arguments now reuse the established Solidity
  call/assignment coercion path. This covers string/hex literals widened to `bytesN` and hex literals interpreted
  as integers for integer event parameters. The emitted bytecode for `"abc"` as `bytes3` is identical to
  `hex"616263"`. Four bytes/string event fixtures and two anonymous-event signature-collision fixtures compile.
- **Legacy `error` struct type/member (+2, 4019 -> 4021)**: Solidity historically permits
  `struct error { ... }`, `error value;`, and `value.error` with a future-keyword warning. The already-soft token is
  now accepted narrowly in type and member positions, including assignment-lvalue reconstruction; custom-error
  declarations retain their existing grammar. Both `struct_named_error.sol` and `error_struct.sol` compile.
- **Discarded type/struct-constructor expressions (+5, 4021 -> 4026)**: registered struct types and the exact bare
  `uint` alias may appear as no-effect expressions (`S;`, `S[7];`, `uint;`, `uint[7];`); true primitive tokens use
  a restricted statement rule. Struct constructors used as statements now route through the existing value path
  and discard the result. This unblocks both `no_effect_statements` fixtures plus three nested-calldata struct
  constructor fixtures. A first broad `typeName;` attempt was rejected after it over-accepted 26 negatives; the
  final semantic/narrow-token version keeps NEG-ACCEPTED flat. Oversized type-array bounds are explicitly checked
  against uint256, restoring rejection of `struct_array_noninteger_index.sol`.

### Continued bench/fix loop: 4026 -> 4032 (+6, NEG-ACCEPTED flat 892)

- **Named arguments participate in overload resolution (+4, 4026 -> 4030)**: named calls now first filter
  overloads by their user-parameter name set, then type-check each candidate with arguments mapped according to
  that candidate's declaration order. This supports both differing arities and same-name signatures distinguished
  by types. Candidate-specific mapping is important: a temporary positional implementation compiled the four
  positive fixtures but over-accepted two ambiguous negatives; the final implementation rejects both with
  `AmbiguousOverloadError`. Full scorecard retained the 892 NEG-ACCEPTED baseline.
- **`_` as a function name (+2, 4030 -> 4032)**: Solidity permits declaring/calling `_()` and treats bare `_;`
  in an ordinary function body as a discarded no-op, while `_` remains reserved for variables. The grammar uses a
  narrow `functionName` rule rather than widening `anyIdentifier`; an initial broad version over-accepted three
  reserved-local negatives and was narrowed. Modifier-body placeholders still expand normally. Final scorecard:
  **4032/4876**, 844 failed, 892 NEG-ACCEPTED.

### Continued bench/fix loop: 4032 -> 4034 (+2, NEG-ACCEPTED flat 892)

- **Bare call-option function references (+2)**: applying `{value: ...}` or `{gas: ...}` to a function value
  without the final call produces a function reference, so statement-position forms such as
  `a.call{value: 42};` and `this.f{gas: 42};` are side-effect-free no-ops. A statement-only grammar rule lowers
  these references to omission, with bytecode-equivalence coverage. The first implementation exposed three
  negative fixtures by discarding malformed option lists; the final path validates unknown and duplicate options
  before dropping the reference, restoring all three rejections. Final scorecard: **4034/4876**, 842 failed,
  892 NEG-ACCEPTED.

### Continued bench/fix loop: 4034 -> 4042 (+8, NEG-ACCEPTED flat 892)

- **Named function-type parameters and future soft keywords (+8)**: Solidity accepts deprecated parameter names
  in function types (`function(uint x) external`) and still permits the future keyword `transient` in those and
  custom-error parameter positions. Function-type grammar now retains the optional name while the type parser
  recovers the longest valid type prefix from ANTLR's whitespace-free text (`uinttransient` -> `uint`) before
  discarding the name. This keeps the real callable signature rather than inventing an address-placeholder type.
  The three targeted transient fixtures plus five other named-function-type fixtures moved to OK. Full scorecard:
  **4042/4876**, 834 failed, 892 NEG-ACCEPTED.

### Continued bench/fix loop: 4042 -> 4044 (+2, NEG-ACCEPTED 892 -> 893)

- **`block.coinbase` is `address payable` (+2)**: both the direct nullary expression and its synthesized block
  oracle witness now carry Solidity's payable address type. Payable-to-plain-address widening remains valid, and
  the underlying BCH locking-bytecode representation is unchanged. One old-version negative
  (`magic_block.sol`, constrained by its harness trailer to pre-Istanbul EVM where `chainid` is unavailable) now
  also compiles; this is an EVM-version diagnostic unrelated to address mutability, and SolidCash has no EVM
  version mode. Final scorecard: **4044/4876**, 832 failed, 893 NEG-ACCEPTED.

### Continued bench/fix loop: 4044 -> 4045 (+1, NEG-ACCEPTED flat 893)

- **Payable address copies in inline assembly (+1)**: Yul lowering normalized every non-word variable read through
  `uint256` before casting to the assignment target. For `address payable r; assembly { r := z }`, that created
  an illegal `uint256 -> address payable` cast even though source and target already had the identical payable
  address representation. Exact address-to-address assignments with matching mutability now bypass the word
  round-trip; cross-mutability and genuine word reinterpretations retain the existing checks. This unblocks
  `cleanup_address_types_shortening.sol`. Final scorecard: **4045/4876**, 831 failed, 893 NEG-ACCEPTED.

### Continued bench/fix loop: 4045 -> 4048 (+3, NEG-ACCEPTED 893 -> 894)

- **`address.codehash` is fixed `bytes32` (+3)**: the type checker now exposes Solidity's fixed-width result
  instead of unbounded bytes. Codegen keeps a P2SH32 hash unchanged and right-pads a P2SH20 hash with twelve zero
  bytes, matching normal `bytes20 -> bytes32` widening and the repository's documented 32-byte codehash API.
  Existing assignments to unbounded `bytes` remain valid. The three current-version codehash fixtures compile.
  The one newly accepted negative is explicitly constrained by its harness trailer to pre-Constantinople EVM,
  where `.codehash` did not yet exist; SolidCash has no EVM-version mode. Final scorecard: **4048/4876**,
  828 failed, 894 NEG-ACCEPTED.

### Continued bench/fix loop: 4048 -> 4065 (+17, NEG-ACCEPTED 894 -> 893)

- **Composite internal function types and named mappings (+17)**: function-type parameters/returns now admit
  mapping and array types, including mapping storage pointers legal on internal function types. Mapping key/value
  names use the same soft-identifier grammar as other declaration names, including names attached to nested
  mapping and array values. The whitespace-free type parser recovers both the component type and its optional
  name, preserving nested `MappingType` structure rather than degrading it to address placeholders.
- **Mapping-name conflict validation**: Solidity requires all key/value component names in one nested mapping
  chain to be unique. Both structured AST construction and raw function-type parsing now enforce that invariant.
  A first syntax-only implementation gained the same 17 positives but exposed 10 conflict negatives; the final
  version rejects all 10 and closes one pre-existing over-acceptance. The authoritative run uses a worktree-local
  `@solidcash/utils` resolution (the earlier temporary root dependency symlink resolved runtime utilities to the
  original checkout). Final scorecard: **4065/4876**, 811 failed, 893 NEG-ACCEPTED.

### Continued bench/fix loop: 4065 -> 4069 (+4, NEG-ACCEPTED flat 893)

- **Modifiers declared in libraries (+4)**: library modifier definitions are collected under their library
  namespace and imported alongside library functions. Modifier expansion now applies them to both namespaced
  calls (`L.f(s)`) and using-for calls (`s.f()`), including storage-pointer parameters, without accidentally
  binding a same-named modifier declared by the consuming contract.
- **Solidity rejection parity**: library modifiers declared `virtual` or without an implementation remain
  rejected, as do modifier invocations on file-level free functions. The initial broad grammar change exposed
  those three negative fixtures; the final AST checks restore the NEG-ACCEPTED baseline. Final scorecard:
  **4069/4876**, 807 failed, 893 NEG-ACCEPTED.

### Continued bench/fix loop: 4069 -> 4082 (+13, NEG-ACCEPTED flat 893)

- **Library ABI data-location rules (+13)**: functions declared inside libraries are now marked explicitly in
  the AST, including the lowered primary-library contract form. Public/external library functions may therefore
  use Solidity's library-only storage-reference parameters and returns (arrays, structs, and mappings), while
  ordinary contract functions retain the stricter external ABI rule.
- **Free-function distinction**: file-level functions are no longer treated as library functions merely because
  both initially share the free-function AST path. Invalid public/external/private, payable, virtual, and
  override modifiers on file-level functions are rejected, while pure/view and the existing SolidCash-compatible
  explicit `internal` spelling remain available. The corpus gain keeps NEG-ACCEPTED flat and leaves
  local/calldata-return aliases as a separate lowering gap. Final scorecard: **4082/4876**, 794 failed,
  893 NEG-ACCEPTED.

### Continued bench/fix loop: 4082 -> 4086 (+4, NEG-ACCEPTED flat 893)

- **Underscores in hexadecimal number literals (+4)**: `0x` number literals now accept Solidity digit
  separators between hexadecimal digits and remove them before byte conversion, so forms such as
  `0x8765_4321` are byte-identical to `0x87654321`. The lexer rule requires digits on both sides of every
  separator, preserving rejection of leading, trailing, and repeated underscores. Final scorecard:
  **4086/4876**, 790 failed, 893 NEG-ACCEPTED.

### Continued bench/fix loop: 4086 -> 4095 (+9, NEG-ACCEPTED 893 -> 892)

- **Arrays containing mappings (+9)**: array types may now use a mapping as their element type, including
  dynamic, fixed, and nested forms such as `mapping(K => V)[] storage`. AST construction preserves the nested
  `ArrayType<MappingType>` shape, enabling valid internal/private and library storage-pointer declarations.
- **Recursive data-location validation**: the mapping-only storage restriction now walks through array element
  types, so mapping-containing arrays in memory/calldata and externally callable contract storage parameters
  remain rejected. Uninitialized mapping-containing storage-pointer locals are also rejected rather than
  acquiring a fictitious runtime value. The final check closes the newly exposed negative plus one pre-existing
  uninitialized direct-mapping-pointer acceptance. Final scorecard: **4095/4876**, 781 failed,
  892 NEG-ACCEPTED.

### Continued bench/fix loop: 4095 -> 4097 (+2, NEG-ACCEPTED flat 892)

- **Interspersed file-level pragmas (+2)**: pragma directives may now appear after file-level declarations, as
  Solidity permits (for example, a version pragma between a user-defined value type and a contract). All pragma
  nodes still pass through the existing value/version validation.
- **Experimental ordering parity**: `pragma experimental solidity` is the exception and must remain at the
  beginning of the source unit. The initial grammar-only change exposed the two out-of-order negative fixtures;
  an AST ordering check restores both rejections while retaining the two positive UDVT fixtures. Final
  scorecard: **4097/4876**, 779 failed, 892 NEG-ACCEPTED.

### Continued bench/fix loop: 4097 -> 4100 (+3, NEG-ACCEPTED flat 892)

- **Metatype expressions (+3)**: `type(T)` is now accepted as a discarded no-effect expression, and metatype
  member access can use a parenthesized base (`(type(uint8)).max`). Both paths reuse the existing type
  introspection lowering for contracts, interfaces, enums, and numeric types.
- **Invalid metatype arguments**: a discarded `type(S)` where `S` is a struct remains invalid. The initial
  syntax-only version exposed that negative fixture; explicit argument validation restores rejection without
  losing the new expressions. Final scorecard: **4100/4876**, 776 failed, 892 NEG-ACCEPTED.

### Continued bench/fix loop: 4100 -> 4104 (+4, NEG-ACCEPTED flat 892)

- **Discarded multidimensional type expressions (+4)**: primitive array types can now appear as no-effect
  expressions with dynamic, fixed, and multiple dimensions, including parenthesized forms such as
  `(int[][][])`. They lower to the same empty block as existing discarded scalar/fixed type references.
- **Dimension validation**: discarded types still validate every explicit dimension as a positive compile-time
  integer fitting uint256. Invalid, zero, non-constant, and oversized dimensions therefore cannot bypass type
  checks merely because the expression has no runtime effect. Final scorecard: **4104/4876**, 772 failed,
  892 NEG-ACCEPTED.

### Continued bench/fix loop: 4104 -> 4108 (+4, NEG-ACCEPTED 892 -> 891)

- **`abi.encodeCall` tuple-expression semantics (+4)**: the second operand is now parsed as Solidity's single
  tuple-valued expression rather than as an ordinary function-call argument list. Scalar literals, conditionals,
  function-call results, and assignment expressions form a unitary tuple; comma expressions flatten into
  multiple components; `()` remains the empty tuple.
- **Shared semantic validation**: every resulting component still flows through existing target resolution,
  argument-count, and parameter-type checks. Besides compiling all four targeted positive files, the normalized
  path closes one pre-existing over-accepted negative. Final scorecard: **4108/4876**, 768 failed,
  891 NEG-ACCEPTED.

### Continued bench/fix loop: 4108 -> 4112 (+4, NEG-ACCEPTED flat 891)

- **Qualified base modifiers (+4)**: invocations such as `A.m` now select the modifier implementation declared
  by the named base rather than a same-name override in the most-derived contract. Inheritance retains qualified
  aliases for each modifier implementation while unqualified lookup still follows the existing most-derived
  override behavior.
- **Declaring-chain validation**: allowed qualifiers are captured on each function before inheritance flattening,
  preventing a sibling base added later from making `Sibling.m` visible. Library modifiers remain usable inside
  their library functions but cannot be attached to contract functions via `L.m`, matching Solidity.
- **Abstract versus implemented modifiers**: unimplemented `modifier m virtual;` declarations are tracked
  separately from implemented bodies. Abstract aliases may survive until overridden without triggering a false
  placeholder failure; implemented bodies still require `_`, and directly invoking an unimplemented modifier
  remains invalid. Final scorecard: **4112/4876**, 764 failed, 891 NEG-ACCEPTED.

### Continued bench/fix loop: 4112 -> 4116 (+4, NEG-ACCEPTED flat 891)

- **Complete Solidity version-range syntax (+3)**: compatibility-mode pragmas now parse disjunctions, hyphen
  ranges, ordinary comparator conjunctions, and bare integer bounds, including
  `0.8.17 || 0.4.1 - 0.9.0`, `>=0.4.0 <0.9.0`, and `<142857`.
- **Range diagnostics preserved**: a hyphen range is a complete disjunction branch, so adjoining another range
  without `||` remains invalid. Malformed caret conjunctions and integer components exceeding Solidity's
  uint32 limit are rejected. Native `pragma solidcash` continues to require a dotted semantic version and does
  not inherit Solidity-only disjunction or hyphen syntax.
- **Callable `.length()` using-for method (+1)**: `.length` is normally a single property token, but the grammar
  now distinguishes a following argument list and routes `using D for string; s.length()` through the normal
  library-method resolution path. Plain `s.length` remains the built-in size operation. Final scorecard:
  **4116/4876**, 760 failed, 891 NEG-ACCEPTED.

### Continued bench/fix loop: 4116 -> 4120 (+4, NEG-ACCEPTED flat 891)

- **Nested public getters (+3)**: synthesized getters now consume every required array index for nested public
  arrays and for the proven mapping-to-array storage shapes. For example, `uint[][] public a` exposes
  `a(uint256,uint256)`, while `mapping(uint => uint[][]) public m` exposes
  `m(uint,uint256,uint256)`.
- **Self-getter reads are inlined**: `this.m(k,i)` is lowered back to the ordinary `m[k][i]` state-read tree
  before entry-access analysis. This ensures mapping value witnesses and NFT entry slots are collected on the
  actual caller rather than hidden behind an internal synthetic getter subroutine. External callers still see
  the real generated ABI entry point.
- **Enum public getters (+1)**: enum placeholders are resolved from the declaring contract's enum definitions
  before getter synthesis, producing a correctly typed enum return and ABI output. Unsupported array-of-mapping
  layouts and deeper mixed paths remain unsynthesized and fail closed under their existing state-layout checks.
  Final scorecard: **4120/4876**, 756 failed, 891 NEG-ACCEPTED.

### Continued bench/fix loop: 4120 -> 4129 (+9, NEG-ACCEPTED flat 891)

- **Public/external calldata returns (+9)**: reference-type return values may retain `calldata` on public and
  external functions, matching Solidity's accepted declarations and conversions for bytes, strings, and arrays.
  Storage returns remain limited to internal/private functions except for library storage-pointer APIs.
- **Override data-location parity**: parameters and returns must keep identical data locations when overriding a
  non-external base function. An external declaration may still be implemented by a public function using
  memory because data location is not part of its external ABI signature. The associated invalid override
  fixture therefore remains rejected. Final scorecard: **4129/4876**, 747 failed, 891 NEG-ACCEPTED.

### Continued bench/fix loop: 4129 -> 4132 (+3, NEG-ACCEPTED flat 891)

- **Abstract-constructor storage pointers (+3)**: constructors on abstract contracts may accept `storage`
  reference parameters. Such constructors are only invoked through a derived contract and can therefore receive
  an existing state array or mapping; concrete deployable constructors remain prohibited from exposing storage
  parameters.
- **Deeper pointer gaps remain visible**: mapping storage parameters, unnamed mapping-array declarations, and
  simple array pointers now pass validation. Mutation through a mapping-array pointer and member access through
  a struct-with-mapping pointer advance to their existing lowering diagnostics instead of being mislabeled as
  invalid data locations. Final scorecard: **4132/4876**, 744 failed, 891 NEG-ACCEPTED.

### Continued bench/fix loop: 4132 -> 4135 (+3, NEG-ACCEPTED 891 -> 890)

- **Local calldata references (+3)**: local arrays, bytes, strings, and structs may retain `calldata` when bound
  from calldata-derived expressions. This covers declaration followed by rebinding, tuple rebinding, indexed
  calldata references, and explicit string/bytes calldata conversions while preserving read-only element and
  field semantics.
- **Binding and control-flow validation**: direct memory-to-calldata initialization/rebinding remains invalid.
  Definite-initialization tracking intersects the initialized set across `if`/`else` branches, so a calldata
  pointer assigned on only one path cannot be read afterward. That closes the corresponding previously
  over-accepted negative fixture. Final scorecard: **4135/4876**, 741 failed, 890 NEG-ACCEPTED.

### Continued bench/fix loop: 4135 -> 4136 (+1, NEG-ACCEPTED flat 890)

- **Struct reference returned by `push()` (+1)**: `rows.push().field = value` now appends the final struct value
  directly, preserving Solidity's zero-initialization of every other field. Direct construction is also sound
  for mapping-entry arrays, where a push followed by a separate read-modify-write would otherwise observe stale
  input state.
- **Mapping-entry struct-array field updates**: `rows[key][index].field = value` rebuilds only the selected
  struct element and uses the existing indexed mapping-array assignment path. Bytecode-equivalence tests cover
  both transformations, and the full `mapping_array_struct.sol` fixture now compiles. Final scorecard:
  **4136/4876**, 740 failed, 890 NEG-ACCEPTED.

### Continued bench/fix loop: 4136 -> 4138 (+2, NEG-ACCEPTED flat 890)

- **Contextual `require` identifier (+2)**: Solidity permits a parameter or named return value to be called
  `require`, with a shadowing warning. The grammar now treats it as a soft keyword in identifier positions, so
  those bindings can be read and assigned normally.
- **Statement syntax remains unambiguous**: `require(condition);` still routes through the dedicated validation
  statement path. Regression coverage exercises parameter assignment, named-return assignment, and an ordinary
  require statement together. Final scorecard: **4138/4876**, 738 failed, 890 NEG-ACCEPTED.

### Continued bench/fix loop: 4138 -> 4140 (+2, NEG-ACCEPTED flat 890)

- **General `for`-update expressions (+2)**: the third clause of a Solidity `for` loop now accepts any
  expression, including no-effect literals and calls, rather than only assignments and increment/decrement
  forms.
- **Side effects and `continue` semantics preserved**: call-shaped updates lower through the normal call
  statement path, while pure expressions remain ordinary discarded-expression statements. Both are appended
  as the loop's tracked update statement, so the existing `continue` rewrite still executes them. Final
  scorecard: **4140/4876**, 736 failed, 890 NEG-ACCEPTED.

### Continued bench/fix loop: 4140 -> 4141 (+1, NEG-ACCEPTED flat 890)

- **Legacy public function names (+1)**: Solidity retains an exception allowing externally callable functions
  named `this`, `super`, and `_`. `this` is now accepted in the function-name grammar alongside the already
  supported `super` identifier and underscore exception, and all three produce normal ABI entries.
- **Visibility-sensitive reservation**: the same names remain illegal for internal/private functions. A semantic
  check preserves that negative fixture, preventing the positive grammar expansion from increasing
  over-acceptance. Final scorecard: **4141/4876**, 735 failed, 890 NEG-ACCEPTED.

### Continued bench/fix loop: 4141 -> 4143 (+2, NEG-ACCEPTED flat 890)

- **Malformed type-looking identifiers (+2)**: Solidity lexes spellings such as `uint7`, `uint300`, `bytes01`,
  and `fixed1x01` as ordinary identifiers rather than elementary types. Predicate-gated identifier alternatives
  now recover that behavior while retaining the existing broad lexer tokens used for type diagnostics.
- **Canonical types remain reserved**: valid bounded forms (`uint8` through `uint256`, `bytes1` through
  `bytes32`, and canonical fixed-point widths/decimals) cannot be used as identifiers. Focused tests cover both
  sides of the distinction. Final scorecard: **4143/4876**, 733 failed, 890 NEG-ACCEPTED.

### Continued bench/fix loop: 4143 -> 4145 (+2, NEG-ACCEPTED flat 890)

- **Interface fallback declarations (+1)**: interfaces now accept Solidity's bodyless
  `fallback() external;` declaration, including inherited fallback requirements. Concrete implementers must
  provide a fallback body.
- **Abstract interface compliance (+1)**: abstract contracts may defer unimplemented interface functions,
  state members, collections, and fallback declarations to concrete descendants, matching Solidity's
  implementation model. Final scorecard: **4145/4876**, 731 failed, 890 NEG-ACCEPTED.

### Continued bench/fix loop: 4145 -> 4146 (+1, NEG-ACCEPTED +1 to 891)

- **Discarded bounded-type expressions (+1)**: no-effect elementary type statements now cover bounded
  integers, bounded bytes, fixed-point forms, crypto types, unbounded bytes, and addresses rather than only
  the small `PrimitiveType` token set. This accepts Solidity fixtures such as repeated `uint256;` statements
  while retaining compile-time validation for array bounds. Final scorecard: **4146/4876**, 730 failed,
  891 NEG-ACCEPTED.

### Continued bench/fix loop: 4146 -> 4147 (+1, NEG-ACCEPTED flat 891)

- **Parenthesized named-argument method calls (+1)**: redundant parentheses around a simple member callee now
  support named arguments, so `(x.mul)({x: a})` follows the same using-for resolution, receiver insertion, and
  argument reordering as `x.mul({x: a})`. Final scorecard: **4147/4876**, 729 failed, 891 NEG-ACCEPTED.

### Continued bench/fix loop: 4147 -> 4148 (+1, NEG-ACCEPTED +1 to 892)

- **Discarded creation-option expressions (+1)**: applying `{salt: ...}`, `{value: ...}`, or `{gas: ...}` to
  `new Contract` without the final constructor argument list is now parsed as Solidity's no-effect creation
  function value. Option spelling, duplicates, and value expressions still pass through the shared call-option
  validation before the value is discarded. Final scorecard: **4148/4876**, 728 failed, 892 NEG-ACCEPTED.

### Continued bench/fix loop: 4148 -> 4150 (+2, NEG-ACCEPTED flat 892)

- **Parenthesized array-member invocation (+2)**: `(data.pop)()` now routes into the same mutation lowering as
  `data.pop()`, preserving the distinction between local, packed, chunked, and collection-backed arrays. The
  broader statement alternative also unlocks a nested-tuple function-identifier fixture that previously
  stopped at the same parenthesized-member parse wall. Final scorecard: **4150/4876**, 726 failed,
  892 NEG-ACCEPTED.

### Continued bench/fix loop: 4150 -> 4152 (+2, NEG-ACCEPTED +4 to 896)

- **Function-pointer call options (+2)**: identifier calls through external function-pointer state values now
  accept `{gas: ...}` and `{value: ...}` and preserve those options while the pointer is rewritten into its
  concrete method-call representation. Both gas and payable-value upstream fixtures compile. Final scorecard:
  **4152/4876**, 724 failed, 896 NEG-ACCEPTED.

### Continued bench/fix loop: 4152 -> 4153 (+1, NEG-ACCEPTED flat 896)

- **Empty ABI decode schemas (+1)**: `abi.decode(data, ())` now parses as a zero-element schema and travels
  through the normal ABI decode/type/codegen pipeline. This matches Solidity's accepted no-effect empty-tuple
  decode expression. Final scorecard: **4153/4876**, 723 failed, 896 NEG-ACCEPTED.

### Continued bench/fix loop: 4153 -> 4155 (+2, NEG-ACCEPTED flat 896)

- **Unitary tuple wrappers in ABI schemas (+2)**: redundant one-item parentheses in ABI decode type lists now
  parse recursively and normalize to the underlying type while retaining array suffixes. This covers scalar,
  struct, dynamic-array, and multidimensional fixed-array forms such as `((uint))`, `(uint)[]`, and
  `((uint))[5][6]`. Final scorecard: **4155/4876**, 721 failed, 896 NEG-ACCEPTED.

### Continued bench/fix loop: 4155 -> 4157 (+2, NEG-ACCEPTED flat 896)

- **Contextual `.value` method calls (+2)**: the dedicated legacy-call `.value` token can now also serve as an
  ordinary method name. Using-for calls such as `x.value(42)` resolve and inline through the same method-call
  path as non-keyword names without disturbing `.call.value(v)(data)` compatibility. Final scorecard:
  **4157/4876**, 719 failed, 896 NEG-ACCEPTED.

### Continued bench/fix loop: 4157 -> 4158 (+1, NEG-ACCEPTED flat 896)

- **Function-reference members after call options (+1)**: discarded expressions such as
  `this.f{value: 42}.address;` now retain call-option validation and accept the two members Solidity exposes on
  external function values (`address` and `selector`). Other trailing members are rejected explicitly. Final
  scorecard: **4158/4876**, 718 failed, 896 NEG-ACCEPTED.

### Continued bench/fix loop: 4158 -> 4159 (+1, NEG-ACCEPTED flat 896)

- **Tuple ternary expressions (+1)**: `()` is now a zero-element tuple expression, and tuple conditionals at
  statement scope evaluate their condition once, evaluate the selected branch components, then discard the
  values. Empty tuple conditionals also work in return position. Final scorecard: **4159/4876**, 717 failed,
  896 NEG-ACCEPTED.

### Continued bench/fix loop: 4159 -> 4162 (+3, NEG-ACCEPTED flat 896)

- **Parenthesized delete targets (+3)**: `delete(target)` and arbitrarily nested redundant parentheses now
  lower to the same local/state deletion as the bare target. Deleting an element of a temporary expression
  preserves receiver/index evaluation while correctly producing no observable write. Final scorecard:
  **4162/4876**, 714 failed, 896 NEG-ACCEPTED.

### Continued bench/fix loop: 4162 -> 4164 (+2, NEG-ACCEPTED flat 896)

- **Contextual-keyword free-function calls (+2)**: a declared free function named `unsafe` can now be called
  as `unsafe()`. The grammar alternative is deliberately token-specific so it does not capture casts or compiler
  intrinsics (`uint(x)`, `erc7201(...)`), a regression caught by the focused suite. Final scorecard:
  **4164/4876**, 712 failed, 896 NEG-ACCEPTED.

### Continued bench/fix loop: 4164 -> 4169 (+5, NEG-ACCEPTED +3 to 899)

- **Discarded tuples with builtin function references (+5)**: tuple expressions at statement scope now
  evaluate and discard ordinary components while treating builtin references such as `abi.encode` as inert
  function values. The upstream `(abi.encode, "")` fixture compiles and related tuple-reference forms advance.
  Final scorecard: **4169/4876**, 707 failed, 899 NEG-ACCEPTED.

### Continued bench/fix loop: 4169 -> 4172 (+3, NEG-ACCEPTED flat 899)

- **Chained indirect function calls (+3)**: repeated invocation suffixes such as `x()()()()` now build nested
  indirect-call nodes and preserve each returned function pointer for the next call. The grammar remains
  restricted to an initial function call, avoiding a broad postfix-call alternative that would steal ordinary
  casts and parenthesized expressions. Final scorecard: **4172/4876**, 704 failed, 899 NEG-ACCEPTED.

### Continued bench/fix loop: 4172 -> 4182 (+10, NEG-ACCEPTED flat 899)

- **Nested tuple-assignment targets (+10)**: recursively parenthesized targets now flatten against the matching
  RHS tuple shape while preserving omitted slots. This covers redundant wrappers, nested unitary tuples, and
  completely omitted nested targets such as `((, a)) = (1, 2)` and `((,),) = ((...), ...)`. Final scorecard:
  **4182/4876**, 694 failed, 899 NEG-ACCEPTED.

### Continued bench/fix loop: 4182 -> 4189 (+7, NEG-ACCEPTED flat 899)

- **Three-level chained no-arg array pushes (+7)**: `a.push().push().push()` and its assignment form now lower
  through typed nested-array read/modify/write operations. The generalized transformation materializes the
  target inner array, mutates it, and writes every containing row back outward. Final scorecard:
  **4189/4876**, 687 failed, 899 NEG-ACCEPTED.

### Continued bench/fix loop: 4189 -> 4190 (+1, NEG-ACCEPTED flat 899)

- **Compound assignment to a pushed element (+1)**: `a.push() op= value` now applies `op` to the appended
  element's typed default and appends the result. The upstream signed subtraction case (`push() -= 1`) compiles,
  and the implementation covers the full compound-operator set. Final scorecard: **4190/4876**, 686 failed,
  899 NEG-ACCEPTED.

### Continued bench/fix loop: 4190 -> 4191 (+1, NEG-ACCEPTED +1 to 900)

- **Explicit primitive-array conversions (+1)**: expressions such as `uint256[](x[start:end])` now parse as
  array casts without stealing indexed function-pointer calls. Identically shaped source/target arrays share
  their packed representation, so code generation correctly treats the conversion as an identity operation.
  Final scorecard: **4191/4876**, 685 failed, 900 NEG-ACCEPTED.

### Continued bench/fix loop: 4191 -> 4192 (+1, NEG-ACCEPTED flat 900)

- **Function-reference members after call options in expressions (+1)**: validated no-call references such as
  `this.f{gas: 42}.address` and `.selector` now work inside comparisons and other expressions, matching the
  already-supported statement-position form. Gas remains an explicit no-op warning on BCH; invalid options and
  members still fail. Final scorecard: **4192/4876**, 684 failed, 900 NEG-ACCEPTED.

### Continued bench/fix loop: 4192 -> 4192 (+0, NEG-ACCEPTED flat 900)

- **Chained method-return calls and recursive mapping-struct deletion (+0)**: calls such as `this.g()(x)` now
  preserve the returned external function pointer for the second invocation. Mapping/struct flattening now
  recurses through interleaved mapping and struct layers, allowing targets such as
  `providers[sender].data[height].supply[round]` to resolve and delete the correct flattened collection. These
  changes advanced the affected upstream fixtures to later, independent diagnostics but did not close a full
  corpus file. Final scorecard: **4192/4876**, 684 failed, 900 NEG-ACCEPTED.

### Continued bench/fix loop: 4192 -> 4196 (+4, NEG-ACCEPTED +2 to 902)

- **Experimental standard-library imports (+4)**: compiler-provided dotted module imports now parse as no-ops
  in direct, aliased, namespace, and selective forms (`import std.stub`, `import * as x from std.stub`, and
  `import { x as y } from std.stub`). They deliberately bypass filesystem resolution because Solidity supplies
  this namespace internally. Final scorecard: **4196/4876**, 680 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4196 -> 4198 (+2, NEG-ACCEPTED flat 902)

- **Multipart prefixed literals (+2)**: adjacent Unicode and hex string tokens now concatenate into one typed
  AST literal, matching the existing multipart plain-string behavior. This closes both upstream
  `unicode"..." unicode"..."` and `hex"..." hex"..."` fixtures. Final scorecard:
  **4198/4876**, 678 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4198 -> 4200 (+2, NEG-ACCEPTED flat 902)

- **Escaped-newline string continuations (+2)**: quoted literals now lex a backslash followed by LF or CRLF,
  and the shared escape decoder removes that physical line break. Plain and Unicode strings use the same path;
  unescaped newlines remain invalid. Final scorecard: **4200/4876**, 676 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4200 -> 4203 (+3, NEG-ACCEPTED flat 902)

- **Multiline storage-layout specifiers (+3)**: EVM-only `contract C layout at expr` clauses are now ignored
  across line breaks and intervening NatSpec comments. The preprocessor blanks non-newline characters instead
  of deleting the clause, preserving downstream diagnostic line numbers. Final scorecard:
  **4203/4876**, 673 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4203 -> 4216 (+13, NEG-ACCEPTED flat 902)

- **Statement-form using-for calls (+13)**: unresolved dotted calls whose result is discarded now pass through
  the same using-for binding resolver as expression calls. This covers external, public, and internal library
  members; whole-library and selective directives; and file- and contract-scoped bindings. Interface and ordinary
  named-call paths remain unchanged. Final scorecard: **4216/4876**, 660 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4216 -> 4217 (+1, NEG-ACCEPTED flat 902)

- **Parenthesized tuple-valued ternaries (+1)**: redundant wrappers around a tuple conditional no longer hide
  it from tuple lowering. The condition is still hoisted and evaluated exactly once before the selected tuple
  components are evaluated or discarded. Final scorecard: **4217/4876**, 659 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4217 -> 4218 (+1, NEG-ACCEPTED flat 902)

- **Discarded user-defined dynamic-array type expressions (+1)**: statements such as `S[7][];` now parse as
  no-effect type expressions and validate populated dimensions as positive compile-time uint256 values. The
  grammar requires an empty `[]` dimension, keeping runtime multidimensional accesses such as `a[i][j];` on
  their original evaluation path. An initially broader rule regressed four corpus files; the authoritative
  rerun after narrowing restored them and confirmed the final scorecard: **4218/4876**, 658 failed,
  902 NEG-ACCEPTED.

### Continued bench/fix loop: 4218 -> 4219 (+1, NEG-ACCEPTED flat 902)

- **Declared methods shadow SolidCash conveniences (+1)**: a contract-declared `transfer` method now takes
  precedence for `this.transfer(...)`, including abstract declarations and methods declared later in the source.
  Address transfers and the undeclared two-argument satoshi-transfer intrinsic retain their existing behavior.
  Final scorecard: **4219/4876**, 657 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4219 -> 4220 (+1, NEG-ACCEPTED flat 902)

- **abi.encodeCall through direct self-pointer aliases (+1)**: bare external function-pointer targets are now
  accepted when the local is a direct alias of `this.method`; the statically known method supplies the selector
  and parameter signature. Other dynamic pointers remain fail-closed instead of guessing a selector.
  Final scorecard: **4220/4876**, 656 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4220 -> 4221 (+1, NEG-ACCEPTED flat 902)

- **abi.encodeCall through assigned/returned self pointers (+1)**: straight-line state-pointer assignments and
  helpers whose final return is `this.method` now establish the same static selector proof as local aliases.
  A returned-pointer helper is still invoked once and its pointer result discarded before encoding, preserving
  all preceding side effects. The full upstream encodeCall consistency fixture compiles. Final scorecard:
  **4221/4876**, 655 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4221 -> 4224 (+3, NEG-ACCEPTED flat 902)

- **Declaration selectors in constant initializers (+3)**: function, event, and custom-error selectors are now
  folded before the compile-time-expression check, including file-level declarations and `this`, `super`,
  interface, contract, bare, and qualified references. File events/errors are registered before file constants,
  matching Solidity's source-order-independent declaration lookup. Final scorecard: **4224/4876**, 652 failed,
  902 NEG-ACCEPTED.

### Continued bench/fix loop: 4224 -> 4227 (+3, NEG-ACCEPTED flat 902)

- **Scoped custom-error selectors (+3)**: identical custom-error signatures may coexist across global, library,
  interface, and contract scopes; library-qualified signatures are retained, and bare/qualified selectors fold
  in ordinary expressions as well as constants. Solidity's reserved EVM error selectors `0x00000000` and
  `0xffffffff` remain rejected—the first rerun exposed those two negative-parity regressions, and the final
  authoritative rerun restored the NEG-ACCEPTED count. Final scorecard: **4227/4876**, 649 failed,
  902 NEG-ACCEPTED.

### Continued bench/fix loop: 4227 -> 4228 (+1, NEG-ACCEPTED flat 902)

- **Ternary selectors from contract-valued calls (+1)**: `(b ? getContract().f : getContract().g).selector`
  now evaluates only the selected receiver, discards its returned contract address, and produces the selected
  method selector. A sequence-expression AST node preserves receiver side effects instead of incorrectly folding
  the whole expression to constants. Final scorecard: **4228/4876**, 648 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4228 -> 4230 (+2, NEG-ACCEPTED flat 902)

- **Using-for methods literally named `selector` (+2)**: a declared function value now reconstructs its complete
  `FunctionType` for using-for lookup, so `identity.selector(x)` resolves to a library method named `selector`
  rather than selector metadata. Final scorecard: **4230/4876**, 646 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4230 -> 4232 (+2, NEG-ACCEPTED flat 902)

- **Runtime selectors on received external pointers (+2)**: a function-pointer parameter used through
  `p.selector` now participates in the existing ABI lowering to `(address, bytes4 selector)`, and the member read
  becomes the synthesized selector parameter. Final scorecard: **4232/4876**, 644 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4232 -> 4233 (+1, NEG-ACCEPTED flat 902)

- **Default local external-pointer selector (+1)**: an uninitialized local external function pointer retains a
  runtime read and yields Solidity's zero selector default. Final scorecard: **4233/4876**, 643 failed,
  902 NEG-ACCEPTED.

### Continued bench/fix loop: 4233 -> 4234 (+1, NEG-ACCEPTED flat 902)

- **Selectors from named-return self-pointer helpers (+1)**: helpers that establish a returned self method through
  a named return variable now carry that proof to `.selector` consumers. The helper invocation remains sequenced
  before the statically known selector value. Final scorecard: **4234/4876**, 642 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4234 -> 4235 (+1, NEG-ACCEPTED flat 902)

- **Discarded contract-qualified external function references (+1)**: a no-effect `C.f;` statement is accepted
  even when `f` is external (including a function literally named `selector`), while `C.f.selector` continues to
  resolve as declaration metadata. This closes every remaining non-Yul selector fixture. Final scorecard:
  **4235/4876**, 641 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4235 -> 4238 (+3, NEG-ACCEPTED flat 902)

- **Contract-qualified internal function-pointer state (+3)**: assignments and calls through an inherited/current
  contract qualifier (`C.x = g`, `C.x()`) now resolve to the underlying state slot. Alias elimination counts the
  qualified call as a real use, so it cannot erase a pointer assigned in one entry point and invoked from another.
  Final scorecard: **4238/4876**, 638 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4238 -> 4239 (+1, NEG-ACCEPTED flat 902)

- **Whole-mapping storage aliases in array pushes (+1)**: a storage alias with no pre-bound keys now routes
  `alias_[k].push(v)` to the original mapping and prepends any alias keys before the receiver's keys. This extends
  the indexed-element alias path without copying storage into a local value. Final scorecard: **4239/4876**,
  637 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4239 -> 4240 (+1, NEG-ACCEPTED flat 902)

- **Inherited state-struct field writes (+1)**: after inheritance expansion, placeholder field writes against a
  struct type unavailable while parsing the derived body are rebuilt as whole-state struct assignments, including
  nested member chains. Final scorecard: **4240/4876**, 636 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4240 -> 4241 (+1, NEG-ACCEPTED flat 902)

- **Raw-slot reads in file-level assembly helpers (+1)**: a free helper's `sload(add(bytes32Slot, offset))`
  preserves the request for the synthesized `__evm_storage` collection until the contract is visited. The
  `bytes32` local is interpreted as a Yul uint256 word for arithmetic, and returning helper chains are inlined
  into entry points because storage-entry block layouts are entry-point-local. The upstream
  `copy_byte_array_to_storage.sol` fixture now compiles. Final scorecard: **4241/4876**, 635 failed,
  902 NEG-ACCEPTED.

### Continued bench/fix loop: 4241 -> 4246 (+5, NEG-ACCEPTED flat 902)

- **Implicit fixed-bytes widening at array write/copy boundaries (+5)**: `bytesM` values now receive Solidity's
  right-padding conversion when written to wider `bytesN` local/state-array elements, including chained writes
  and pushes. Dynamic state-array repacking now also accepts calldata and memory-local array sources, lowering
  the copy to per-element casts rather than treating differently packed arrays as layout-compatible. Three fixed
  state-array copy fixtures plus calldata-to-storage and memory-to-storage copy fixtures now compile. Final
  scorecard: **4246/4876**, 630 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4246 -> 4247 (+1, NEG-ACCEPTED flat 902)

- **Hex string literals assigned to `string` (+1)**: a `hex"..."` literal may initialize or assign a string,
  preserving its raw UTF-8 bytes through a no-op bytes-to-string cast. The rule remains literal-only and validates
  UTF-8 in fatal mode; the first rerun exposed `invalid_utf8_hex_string.sol` as newly over-accepted, and the final
  rerun restored that negative rejection. Final scorecard: **4247/4876**, 629 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4247 -> 4248 (+1, NEG-ACCEPTED flat 902)

- **Fixed state-array address mutability widening (+1)**: a storage copy from `address payable[N]` to
  `address[N]` now lowers element-by-element, applying the legal payable-to-plain address conversion without
  making general memory/calldata array references covariant. The reverse plain-to-payable direction remains
  rejected. Final scorecard: **4248/4876**, 628 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4248 -> 4249 (+1, NEG-ACCEPTED flat 902)

- **Typed Yul low-level-call success and early-return helper inlining (+1)**: assigning
  `staticcall(...)` into an existing high-level `bool` now retains the bool value, while fresh Yul bindings remain
  uint256 words. Yul `switch` comparisons normalize both operands to words. A one-return helper ending in
  `if (c) return a; return b;` is normalized to a ternary only when it transitively needs low-level/external-call
  covenant inlining, allowing `test/benchmarks/verifier.sol` to inline into its entry point. The first broad
  normalization rerun displaced the raw-slot copy fixture; narrowing eligibility restored it before the final
  authoritative run. Final scorecard: **4249/4876**, 627 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4249 -> 4252 (+3, NEG-ACCEPTED flat 902)

- **Yul byte/hash values normalized at uint256 word boundaries (+3)**: `byte(...)` remains a bytes1-shaped
  main-AST operation, but an assignment into a uint256 Yul target now explicitly reinterprets it as the Yul word.
  Runtime `mstore`/`mstore8` offsets likewise normalize to uint256, including bytes32 hash-derived offsets such as
  `mstore(keccak256(...), value)`. This compiles `optimizer/shift_bytes.sol`,
  `viewPureChecker/assembly.sol`, and `array/bytes_to_fixed_bytes_cleanup.sol`. Several additional fixtures
  advance to deeper runtime-memory diagnostics rather than reporting the misleading first assignment error.
  Final scorecard: **4252/4876**, 624 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4252 -> 4255 (+3, NEG-ACCEPTED flat 902)

- **Literal-backed memory bytes exposed to Yul as pointers (+3)**: `bytes memory m = "..."` now allocates the
  EVM-shaped `[length][data]` block in the shared high-level/Yul memory buffer and copies literal data into its
  words. Assembly can consequently use `m` as a uint256 pointer (`mstore(m, ...)`, `add(m, 32)`), and a subsequent
  bare state assignment serializes the pointer-backed bytes at the value-copy boundary even though symbol
  resolution has not yet rewritten that assignment to `StateAssignNode`. This compiles both
  `dirty_memory_bytes_to_storage_copy` variants and one additional literal-memory fixture. Final scorecard:
  **4255/4876**, 621 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4255 -> 4256 (+1, NEG-ACCEPTED flat 902)

- **Direct mapping storage-pointer rebinding (+1)**: a straight-line `mapping(...) storage p = a; p = b;`
  updates the parser's compile-time storage access path, so indexed reads and writes after the reassignment route
  to `b` rather than retaining the original alias or leaving an undefined runtime pointer. The upstream
  `mapping_local_assignment.sol` fixture now compiles. Final scorecard: **4256/4876**, 620 failed,
  902 NEG-ACCEPTED.

### Continued bench/fix loop: 4256 -> 4257 (+1, NEG-ACCEPTED flat 902)

- **Tuple mapping storage-pointer rebinding (+1)**: `(p, value) = (otherMapping, rhs)` now updates the mapping
  pointer's compile-time access path without attempting to represent the mapping as a runtime tuple word. The
  remaining scalar slots stay grouped in a tuple assignment (or become one ordinary assignment), preserving
  parallel RHS semantics. The upstream `mapping_local_tuple_assignment.sol` fixture now compiles. Final scorecard:
  **4257/4876**, 619 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4257 -> 4272 (+15, NEG-ACCEPTED flat 902)

- **Runtime ERC-7201 namespace expressions (+15)**: non-literal `erc7201(id)` calls now lower to the EIP-7201
  formula `keccak256(abi.encode(uint256(keccak256(bytes(id))) - 1)) & ~bytes32(uint256(0xff))`, while literal
  namespace ids retain the existing constant fold. This covers storage/memory/calldata strings, slices, ternaries,
  array literals, concatenation, ABI-derived strings, and pure-returning helper calls. The first full run exposed
  three invalid arguments that the generated bytes cast made over-permissive (raw bytes, invalid UTF-8 hex, and
  numeric literals); explicit argument validation restored all three Solidity-negative rejections. The benchmark
  reporter now uses its captured logger so a corpus compile cannot suppress the final scorecard by mutating the
  global console. Final scorecard: **4272/4876**, 604 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4272 -> 4273 (+1, NEG-ACCEPTED flat 902)

- **External self-call through a base/interface cast (+1)**: `Base(this).f(args)` now follows Solidity virtual
  dispatch and lowers to the current contract's most-derived `f`, just like the existing `this.f(args)` path.
  This closes `inherited_function_calldata_memory.sol`, where the base cast must select the derived override even
  though its data location differs. The remaining external-target cluster was classified into random/precompile
  literal addresses, constructor-time state-derived targets, recast freshly deployed locals, and self-low-level
  `staticcall`; these require distinct integrity/return-data treatments and were not conflated with the self-cast
  rule. Final scorecard: **4273/4876**, 603 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4273 -> 4274 (+1, NEG-ACCEPTED flat 902)

- **Self `staticcall(abi.encodeCall(...))` and narrowing invalidation (+1)**: self-targeted low-level static calls
  with a declaration-based ABI payload now dispatch to the current contract's most-derived function and encode its
  return values for the existing `(success, bytes)` path. The first lowering exposed a shared flow-typing bug:
  after `require(data.length == 32)`, `data` remained narrowed to `bytes32` even after `data = nextResult`.
  Length narrowings now end conservatively at the first direct, tuple, delete, or nested control-flow write.
  This compiles `abi_encode_call_declaration_v2.sol` and keeps later bytes assignments at their declared dynamic
  type. Final scorecard: **4274/4876**, 602 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4274 -> 4275 (+1, NEG-ACCEPTED flat 902)

- **Assembly-visible memory string/bytes parameters (+1)**: a `memory` string or dynamic-bytes parameter referenced
  by Yul is copied from its ABI value into the shared EVM-shaped linear-memory buffer, and only the Yul paths are
  renamed to the resulting uint256 pointer. High-level parameter uses remain on the declared value. This compiles
  `keccak_optimization_bug_string.sol`, where `keccak256(s, n)` must treat `s` as a memory address rather than a
  string blob. The focused rerun exposed an interaction with the existing create/create2 clone recognizer, which
  deliberately consumes value-form bytes; deployment-pattern blocks are therefore left on that dedicated lowering
  instead of being pointer-materialized. Final scorecard: **4275/4876**, 601 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4275 -> 4277 (+2, NEG-ACCEPTED flat 902)

- **Pointer-backed named memory bytes returns (+2)**: named `bytes memory`/`string memory` returns initialized
  from a parameter or literal now keep an EVM-shaped pointer while Yul mutates them, then serialize the resulting
  data at the implicit return boundary. The lowering recognizes the canonical default-local/terminal-return form
  produced by named-return desugaring and preserves the high-level value form outside assembly. This compiles
  `mcopy_empty.sol` and every function in `mcopy_overlap.sol`. Final scorecard: **4277/4876**, 599 failed,
  902 NEG-ACCEPTED.

### Continued bench/fix loop: 4277 -> 4278 (+1, NEG-ACCEPTED flat 902)

- **Null pointer for uninitialized named memory bytes (+1)**: an unassigned named `bytes memory` return used by
  Yul now retains Solidity's default pointer value zero instead of allocating an empty buffer. Assembly address
  arithmetic and writes therefore have the same base as EVM, while the function boundary still serializes the
  length-prefixed result. This compiles `semanticTests/inlineAssembly/mcopy.sol`. Final scorecard:
  **4278/4876**, 598 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4278 -> 4279 (+1, NEG-ACCEPTED 902 -> 903)

- **Runtime Yul `clz` (+1)**: `clz(word)` lowers through eight fixed binary-search branches, avoiding an
  unsupported dynamic loop while computing the complete 0..256 leading-zero count. Assignment and declaration
  bindings are supported, including reinterpretation into a `bytes32` named return. This compiles
  `syntaxTests/inlineAssembly/clz.sol`. The newly accepted negative is only the same builtin under a pre-Osaka
  EVM-version directive; SolidCash has no selectable EVM target and intentionally exposes `clz` independent of
  that version gate. Final scorecard: **4279/4876**, 597 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4279 -> 4290 (+11, NEG-ACCEPTED 903 -> 909)

- **Case-sensitive UDVT operator targets and event boundaries (+11)**: using-for resolution now checks declared
  structs, enums, and UDVTs before the primitive parser, so a valid `type Int is int64` is no longer collapsed to
  native `int` by the primitive fallback. Six direct operator suites and the operator evaluation-order suite
  compile. Event validation now admits enum values and UDVTs whose underlying representation is event-encodable,
  recovering four more enum/UDVT event fixtures. The negative diagnostic increase is under audit: invalid
  operator declarations with case-colliding UDVT names now reach existing signature validation rather than the
  old blanket non-UDVT rejection, exposing validation gaps without changing the scored positive denominator.
  Final scorecard: **4290/4876**, 586 failed, 909 NEG-ACCEPTED.

### Continued bench/fix loop: 4290 -> 4291 (+1, NEG-ACCEPTED flat 909)

- **Solidity constant-expression bitwise width (+1)**: arithmetic/unary constant subexpressions carrying the
  compatibility parser's legacy widthless `int` marker are restored to signed int256 before a bitwise operation.
  Native SolidCash bigint remains widthless and still requires an explicit bounded cast. This closes
  `operators/userDefined/operator_precendence.sol`; the adjacent bytes-index fixture now advances to a genuine
  signed/unsigned mismatch and stays rejected. Final scorecard: **4291/4876**, 585 failed, 909 NEG-ACCEPTED.

### Diagnostic parity loop at 4291 (NEG-ACCEPTED 909 -> 903)

- **UDVT operator declaration validation (-6 over-accepted negatives)**: operator aliases now require a
  file-level `using ... global` directive, a pure free-function implementation, and a unique binding for each
  type/operator arity. This retains every newly supported valid case-sensitive UDVT operator fixture while
  restoring rejection of six invalid contract-scoped/duplicate declarations. A fresh exact-order check also
  confirmed both mapping-pointer rebinding fixtures remain `OK`; their prior saved failure rows were stale output,
  not a compiler regression. Final scorecard: **4291/4876**, 585 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4291 -> 4292 (+1, NEG-ACCEPTED flat 903)

- **UDVT struct fields at the Yul memory-word boundary (+1)**: `mload(structPtr)` now unwraps a UDVT field to its
  underlying value before normalizing the 32-byte Yul word; the symmetric `mstore` path narrows to the underlying
  type and wraps it back into the UDVT. Direct UDVT-to-unrelated-type casts remain rejected outside assembly.
  This compiles `userDefinedValueType/storage_layout_struct.sol`, including signed int64 fields read both through
  a memory struct pointer and as scalar assembly operands. Final scorecard: **4292/4876**, 584 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4292 -> 4296 (+4, NEG-ACCEPTED flat 903)

- **Fixed memory arrays shared with Yul (+3)**: a fixed-size integer memory array referenced by assembly now
  allocates zero-filled 32-byte element slots in the shared linear-memory buffer. Unlike dynamic arrays, its
  pointer names element zero and carries no length header; high-level reads decode/narrow the mutated word back
  to the declared element type. Eligibility is limited to assembly-observed locals and bounded to 4096 elements,
  preserving the established value/ABI path for ordinary or enormous fixed arrays. This compiles
  `dirty_memory_uint32.sol`, `dirty_memory_int32.sol`, and `dirty_memory_static_array.sol`.
- **Signed versus unsigned constant bit-mask inference (+1)**: compatibility-mode width recovery now selects
  signed int256 only when a constant-expression subtree contains negative syntax (`-`, `~`, or a negative
  literal); an all-positive full-width mask uses uint256. This preserves the signed operator-precedence fixture
  while compiling the 256-bit sign-extension mask in `dirty_memory_int32.sol` and the adjacent bytes-index mask.
  Final scorecard: **4296/4876**, 580 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4296 -> 4297 (+1, NEG-ACCEPTED flat 903)

- **Uninitialized dynamic memory arrays observed by Yul (+1)**: a declaration such as `uint[] memory x;` now
  materializes Solidity's nonzero pointer to an allocated zero length word when assembly reads `x`. The lowering
  remains gated on an actual Yul reference, so ordinary uninitialized dynamic arrays retain the established value
  representation. This compiles `memoryManagement/assembly_access.sol`. Final scorecard: **4297/4876**,
  579 failed, 903 NEG-ACCEPTED.

### Current gap in progress at 4297

- **Initialized fixed arrays across a Yul/call boundary**: fixed integer array literals referenced by assembly
  now allocate and initialize word-addressed shared memory, and direct call arguments are serialized back to the
  normal fixed-array value representation. The focused regression suite passes. In
  `abicoder/cleanup/static_array_v2.sol` this clears the original `uint8[2]`-to-word cast failure and exposes the
  next independent blocker: `msg.data` is currently unavailable inside a Solidity self-call lowered as an
  internal subroutine. This partial gap does not yet increase the corpus score.

### Continued bench/fix loop: 4297 -> 4302 (+5, NEG-ACCEPTED flat 903)

- **Fresh `msg.data` for high-level external self-calls (+5)**: a uniquely named public/external function reached
  through `this.f(args)` now reconstructs its calldata as `f.selector ++ abi.encode(args)`. The same expression is
  valid when the function is entered through normal dispatch, so its body no longer depends on
  `OP_ACTIVEBYTECODE` while executing as an `OP_INVOKE` subroutine. This completes the initialized-fixed-array
  boundary work above and compiles `abicoder/cleanup/static_array_v2.sol` plus four adjacent self-call/msg.data
  shapes. Final scorecard: **4302/4876**, 574 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4302 -> 4303 (+1, NEG-ACCEPTED flat 903)

- **Entry calldata threaded through internal helpers (+1)**: direct, uniquely named internal/private functions
  that read `msg.data` receive a compiler-only bytes context. Public/external callers construct the original
  selector-and-arguments payload, while tainted internal callers forward the same context transitively. This
  compiles `optimizer/unused_store_storage_removal_bug.sol` and removes `MsgDataInSubroutineError` from the scored
  corpus without guessing overloaded call targets. Final scorecard: **4303/4876**, 573 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4303 -> 4306 (+3, NEG-ACCEPTED flat 903)

- **Internal function pointers as Yul words (+3)**: assembly reads and assignments now reinterpret an internal
  function pointer as its raw integer function ID, matching the compiler's existing `OP_INVOKE` representation.
  The unsafe no-op cast is synthesized only at the Yul word boundary; ordinary source casts remain type-checked.
  This compiles both uninitialized-internal-function-pointer fixtures and `tstore_hidden_staticcall.sol`.
  Final scorecard: **4306/4876**, 570 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4306 -> 4307 (+1, NEG-ACCEPTED flat 903)

- **Derived calldata aggregate pointers in Yul (+1)**: calldata aggregate parameters now carry their statically
  known ABI offsets through fixed-index derived locals. A bare fixed-array local in assembly evaluates to that
  offset, while a bare dynamic calldata array remains invalid and still requires `.offset`/`.length`. The first
  run exposed that nearby negative diagnostic; the direct invalid probe and corrected full rerun restored it.
  This compiles `inlineAssembly/calldata_array_read.sol`. Final scorecard: **4307/4876**, 569 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4307 -> 4308 (+1, NEG-ACCEPTED flat 903)

- **Known-offset calldata struct rebinding (+1)**: Yul assignments between calldata struct pointers, or to a
  literal offset matching another aggregate parameter, now materialize the corresponding positional struct view.
  Compiler-generated snapshots preserve the original calldata regions when several pointers are rebound in
  sequence. Arbitrary offsets into unavailable raw calldata remain rejected. This compiles
  `inlineAssembly/calldata_struct_assign.sol`. Final scorecard: **4308/4876**, 568 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4308 -> 4309 (+1, NEG-ACCEPTED flat 903)

- **Interface metatype names (+1)**: `type(I).name` now folds to an interface declaration's name just like
  contract and abstract-contract metatypes, while `interfaceId` retains its selector-XOR path and unsupported
  interface metatype properties remain diagnostic. This compiles `metaTypes/name_other_contract.sol`.
  Final scorecard: **4309/4876**, 567 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4309 -> 4310 (+1, NEG-ACCEPTED flat 903)

- **Originating `msg.sig` through internal calls (+1)**: direct, uniquely named internal/private functions that
  read `msg.sig` now receive a compiler-only bytes4 context. Public/external callers construct their source ABI
  selector and internal callers forward it transitively, preserving Solidity's entry-selector semantics across
  `OP_INVOKE`. Overloaded pre-semantic targets remain fail-closed. This compiles
  `smtCheckerTests/special/msg_sig.sol`. Final scorecard: **4310/4876**, 566 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4310 -> 4311 (+1, NEG-ACCEPTED flat 903)

- **Source ABI parameters for self `abi.encodeCall` (+1)**: selector and argument validation now exclude
  compiler-only `__internal__` state, covenant, oracle, and context parameters appended to a function
  implementation. User-declared parameters remain fully counted and type-checked. This compiles
  `abicoder/abi_encode_call_special_args_v2.sol`. Final scorecard: **4311/4876**, 565 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4311 -> 4314 (+3, NEG-ACCEPTED flat 903)

- **Qualified custom-error scope (+3)**: the AST now retains the qualifier in `revert D.E(...)`, and semantic
  lookup restricts resolution to the named contract/interface or the registered library error signature rather
  than selecting a same-named current/global declaration. An initial full run exposed missing library-qualified
  resolution; direct probes for both duplicate cmdline fixtures and a corrected rerun closed that regression.
  This compiles `ABIJson/errors_referenced.sol`, `cmdlineTests/abi_via_ir/input.sol`, and
  `cmdlineTests/hashes/input.sol`. Final scorecard: **4314/4876**, 562 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4314 -> 4316 (+2, NEG-ACCEPTED flat 903)

- **Contract declarations shadow file-level enum/struct names (+2)**: symbol registration now distinguishes
  file-scope enum/struct declarations from declarations in the current contract. A contract may shadow the
  file-level name, while duplicate declarations in the same scope remain rejected. This compiles
  `syntaxTests/enums/global_enum_shadowing.sol` and `syntaxTests/structs/global_struct_shadowing.sol`.
  Final scorecard: **4316/4876**, 560 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4316 -> 4317 (+1, NEG-ACCEPTED flat 903)

- **Private base state-variable shadowing (+1)**: inheritance expansion now detects collisions against every
  state-variable name in the hierarchy while mangling only the private declaration. A derived non-private slot
  can therefore reuse a private base name without producing a false duplicate-slot error. This compiles
  `syntaxTests/inheritance/shadowing_private_base_state_vars.sol`. Final scorecard: **4317/4876**, 559 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4317 -> 4318 (+1, NEG-ACCEPTED flat 903)

- **Discarded global-builtin results (+1)**: statement-form calls to value-returning global builtins now use the
  same semantic resolution as expression-form calls, and existing statement codegen drops the unused value.
  This closes the `addmod(...);` / `mulmod(...);` parity shape in
  `semanticTests/arithmetics/addmod_mulmod_zero.sol`. The exact upstream fixture and the 547-test focused suite
  pass. Final scorecard: **4318/4876**, 558 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4318 -> 4319 (+1, NEG-ACCEPTED flat 903)

- **Bare struct type expressions (+1)**: a bare struct type in statement position (`S;` or `Lib.S;`) is now
  treated as Solidity's valueless no-op rather than being resolved as a variable and rejected. Qualified and
  bare registered struct names are recognized before expression codegen. This compiles
  `semanticTests/libraries/library_struct_as_an_expression.sol`; its exact upstream fixture and the 548-test
  focused suite pass. Final scorecard: **4319/4876**, 557 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4319 -> 4322 (+3, NEG-ACCEPTED flat 903)

- **Discarded UDVT conversion references (+3)**: `T.wrap;` and `T.unwrap;` now resolve as valueless no-op
  statements when their function values are discarded, rather than treating the user-defined type name as a
  variable. Parenthesized type references lower to the same shape, closing both corresponding fixtures as well.
  This compiles `semanticTests/userDefinedValueType/wrap_unwrap.sol`,
  `semanticTests/userDefinedValueType/in_parenthesis.sol`, and
  `smtCheckerTests/userTypes/in_parenthesis_2.sol`. The exact primary fixture and 549-test focused suite pass.
  Final scorecard: **4322/4876**, 554 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4322 -> 4323 (+1, NEG-ACCEPTED flat 903)

- **Qualified interface enum namespaces (+1)**: interface enums are now retained under `I.Enum` as well as an
  unambiguous bare name. Nested member access (`I.Enum.Member`) collapses the declaration namespace before
  ordinary expression traversal, so the interface name is not misread as a runtime variable. This compiles
  `semanticTests/enums/enum_referencing.sol`; its exact upstream fixture and the 550-test focused suite pass.
  Final scorecard: **4323/4876**, 553 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4323 -> 4327 (+4, NEG-ACCEPTED flat 903)

- **Using-for precedence over native `.reverse()` (+4)**: an applicable attached library method named
  `reverse` now takes precedence over SolidCash's grammar-native bytes/string reverse operator, matching
  Solidity's ordinary using-for dispatch. This compiles the calldata bytes, dynamic-array/slice, static-array,
  and struct variants of `attached_internal_library_function_accepting_calldata*_v2.sol`. The exact bytes
  fixture and the 551-test focused suite pass. Final scorecard: **4327/4876**, 549 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4327 -> 4330 (+3, NEG-ACCEPTED flat 903)

- **Deferred overloaded external self-calls (+3)**: `this.f(...)` now skips ordinary identifier lookup when its
  unresolved overload set contains external entry points, allowing argument-type resolution to finish in the
  type checker. This covers inert `{value:}`/`{gas:}` call options and ordinary overloaded self-calls carrying
  nested calldata aggregates. It compiles `functionCall/call_options_overload.sol` plus
  `calldata_array_2d_dynamic_dynamic_v2.sol` and `calldata_array_2d_dynamic_static_v2.sol`. The exact call-options
  fixture and the 552-test focused suite pass. Final scorecard: **4330/4876**, 546 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4330 -> 4331 (+1, NEG-ACCEPTED flat 903)

- **Public constant ABI getters (+1)**: constants parsed from explicitly public/external state declarations now
  retain their visibility and receive a zero-argument getter returning the baked constant value. Resolved
  public self-calls skip the colliding constant symbol just like external entry points, so
  `this.CONSTANT()` uses the synthesized getter and the getter appears in the ABI. File-level constants remain
  unchanged. This compiles `syntaxTests/constants/access_via_getter.sol`; its exact fixture and the 553-test
  focused suite pass. Final scorecard: **4331/4876**, 545 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4331 -> 4332 (+1, NEG-ACCEPTED flat 903)

- **Contract constant shadowing and numeric introspection (+1)**: under Solidity compatibility, a contract
  constant may shadow a parent/global declaration, including SolidCash builtins such as `min` and `max`, while
  same-contract duplicates remain rejected. Numeric `type(T).min/max` in constant initializers now receives the
  same resolved integer/fixed type metadata as the function-body form. This compiles
  `syntaxTests/constants/initialization/type_info.sol`; its exact fixture and the 554-test focused suite pass.
  Final scorecard: **4332/4876**, 544 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4332 -> 4334 (+2, NEG-ACCEPTED flat 903)

- **Discarded compiler-special global references (+2)**: bare `erc7201;` and `selfdestruct;` expression
  statements now lower to valueless no-ops, matching Solidity's discarded function-reference semantics while
  leaving actual calls untouched. An initial broader implementation also accepted bare registered globals and
  raised NEG-ACCEPTED to 904 by admitting pre-Cancun `blobhash`; the final rule is deliberately limited to the
  compiler-special names. Direct positive probes pass and `blobhash_not_declared_pre_cancun.sol` remains
  negative-rejected. This compiles `globalFunctions/erc7201_builtin_no_call.sol` and
  `globalFunctions/selfdestruct_no_call.sol`; the 555-test focused suite passes. Final scorecard:
  **4334/4876**, 542 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4334 -> 4339 (+5, NEG-ACCEPTED flat 903)

- **Inline-Yul hygiene in expanded modifiers (+5)**: modifier expansion now deep-clones the attached Yul AST
  instead of sharing it between modifier applications, and alpha-renaming a modifier parameter or local also
  renames its free references inside assembly while respecting Yul-local bindings. This fixes repeated
  applications of a modifier whose assembly reads or assigns its own local, including
  `cmdlineTests/inline_assembly_function_name_clash/input.sol`. The exact upstream fixture, 556-test focused
  suite, and full corpus pass. Final scorecard: **4339/4876**, 537 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4339 -> 4340 (+1, NEG-ACCEPTED flat 903)

- **Compile-time ERC-7201 namespace constants (+1)**: the type-building pre-scan now records file/contract string
  constants as well as integer constants. `erc7201(CONST)` substitutes a known string constant before applying
  the existing spec-conformant slot fold, allowing that slot to serve as a compile-time array bound without
  changing runtime identifier handling. This compiles
  `globalFunctions/erc7201_builtin_param_string_variable_comptime.sol`; its exact fixture, the 557-test focused
  suite, and full corpus pass. Final scorecard: **4340/4876**, 536 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4340 -> 4341 (+1, NEG-ACCEPTED flat 903)

- **Discarded qualified base-function references (+1)**: inheritance resolution now recognizes a valueless
  `Base.functionName;` expression while ancestor declarations and preserved override bodies are still available.
  It drops the expression before reachability pruning, so it neither becomes an undefined read of `Base` nor
  retains dead base bytecode; unrelated qualifiers still reject. This compiles
  `immutable/inheritance_virtual_functions_direct_call.sol`; its exact fixture, the 558-test focused suite, and
  full corpus pass. Final scorecard: **4341/4876**, 535 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4341 -> 4342 (+1, NEG-ACCEPTED flat 903)

- **Value copies returned by no-argument array push (+1)**: a value declaration initialized from
  `array.push()` is now retained as a default-valued local and that same value is appended, while an explicitly
  `storage` declaration continues through the existing fresh-element alias path. The lowering is byte-identical
  to `uint y; array.push(y);`. This compiles `array/push/push_no_args_1d.sol`; its exact fixture, the 559-test
  focused suite, and full corpus pass. Final scorecard: **4342/4876**, 534 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4342 -> 4344 (+2, NEG-ACCEPTED flat 903)

- **Current-contract-qualified direct calls (+2)**: expression and statement calls written as
  `CurrentContract.f(args)` now shed the current-contract qualifier and pass through the ordinary direct-call
  resolver. This preserves overload handling and the existing prohibition on internally invoking an
  external-only function, and is byte-identical to `f(args)`. This compiles
  `inlineAssembly/period_in_identifer.sol` plus a companion qualified-call fixture; the exact primary fixture,
  560-test focused suite, and full corpus pass. Final scorecard: **4344/4876**, 532 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4344 -> 4345 (+1, NEG-ACCEPTED flat 903)

- **Dead Yul library-address bindings (+1)**: inline-assembly lowering now knows the source unit's declared
  library names and removes `let x := LibraryName` only when every bound name is unused. This matches the
  optimizer's elimination of an unused link-reference read without treating arbitrary unresolved identifiers as
  dead code; used library-address values remain deliberately unlowered. This compiles
  `inlineAssembly/assignment_from_library.sol`; its exact fixture, an undeclared-name rejection guard, the
  561-test focused suite, and full corpus pass. Final scorecard: **4345/4876**, 531 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4345 -> 4346 (+1, NEG-ACCEPTED flat 903)

- **Named bounded-primitive members in function types (+1)**: compatibility parsing now separates an
  underscore-prefixed member name from a bounded primitive inside function-type text
  (`bytes6 _name` -> `bytes6`, `uint _shift` -> `uint`) before the shared type parser validates bounds. This
  prevents `bytes6_name` from being diagnosed as an invalid bytes width while leaving ordinary user-defined
  type names untouched. This compiles `constructor/functions_called_by_constructor_through_dispatch.sol`; its
  exact fixture, the 562-test focused suite, and full corpus pass. Final scorecard: **4346/4876**, 530 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4346 -> 4347 (+1, NEG-ACCEPTED flat 903)

- **Preserved overridden base overloads (+1)**: inheritance flattening now deduplicates preserved
  `__base_Contract_function` bodies by their parameter signature rather than the shared mangled name alone.
  Every overload therefore survives under the same callable name for normal overload selection, while a true
  diamond duplicate with the same signature is still skipped. This compiles
  `functionCall/inheritance/base_base_overload.sol`; its exact fixture, the 563-test focused suite, and full
  corpus pass. Final scorecard: **4347/4876**, 529 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4347 -> 4354 (+7, NEG-ACCEPTED flat 903)

- **Qualified inherited helpers as function values (+7)**: the inheritance rewriter now resolves
  `Base.functionName` field-access expressions through the same linearized implementation lookup used for
  `Base.functionName(...)` calls. Assigning an inherited helper to a function pointer therefore targets the
  inherited or preserved `__base_*` implementation and marks preserved bodies reachable, while unrelated
  namespaces remain untouched. This compiles `deployedCodeExclusion/static_base_function_deployed.sol` and six
  companion qualified-reference fixtures; the exact primary fixture, 564-test focused suite, and full corpus
  pass. Final scorecard: **4354/4876**, 522 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4354 -> 4354 (structural, NEG-ACCEPTED flat 903)

- **Super calls and tuple locals inside modifiers**: inheritance resolution now visits modifier bodies before
  expansion, resolving `super.f()` while the C3 linearization and preserved base bodies are available.
  Modifier cloning also copies tuple-slot metadata and alpha-renames tuple-declared locals independently per
  application. Four Corion fixtures advance past their former undefined-super/variable-redefinition failures to
  unrelated deeper codegen/type gaps. The focused suite reaches 565 tests and the full corpus shows no OK→FAIL
  or negative-acceptance change; score remains **4354/4876**, 522 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4354 -> 4357 (+3, NEG-ACCEPTED flat 903)

- **Function-pointer fall-through defaults (+3)**: the shared default-expression builder now emits a value typed
  as the requested function-pointer type instead of an ordinary integer. Internal pointers use the same
  unreachable `0x7fffffff` dispatch sentinel as uninitialized local codegen, so invoking the default still
  hard-fails rather than dispatching to function id zero; external pointers retain their zero handle. This
  compiles `ASTJSON/function_type.sol` and two companion default-return fixtures; the exact primary fixture,
  566-test focused suite, and full corpus pass. Final scorecard: **4357/4876**, 519 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4357 -> 4358 (+1, NEG-ACCEPTED flat 903)

- **Contextual literal coercion in `abi.encodeCall` (+1)**: encode-call arguments now pass through the same
  compatibility-gated contextual conversion path as ordinary function-call arguments before assignability is
  checked. This permits Solidity's `"ab"` to `bytes2` conversion (as well as the already-supported fixed-bytes
  widening and literal-zero rules) without weakening non-literal type checks. This compiles
  `abicoder/abi_encode_call_uint_bytes.sol`; its exact fixture, the 567-test focused suite, and full corpus pass.
  Final scorecard: **4358/4876**, 518 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4358 -> 4359 (+1, NEG-ACCEPTED flat 903)

- **Empty ABI encodings (+1)**: `abi.encode()` and `abi.encodePacked()` now produce an explicit empty byte string,
  matching Solidity instead of failing an artificial non-empty-argument check. EVM-compatible `abi.encode` already
  had the correct zero-argument emission; native `abi.encode` and both packed paths now do as well, so every mode
  leaves a well-formed value on the stack. This compiles `abicoder/abi_encode.sol`; its exact fixture, the 568-test
  focused suite, and full corpus pass. Final scorecard: **4359/4876**, 517 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4359 -> 4360 (+1, NEG-ACCEPTED flat 903)

- **Side-effecting local Yul calls in `for` conditions (+1)**: local-function inlining now materializes a
  condition-call result after the loop prelude and performs a freshly alpha-renamed evaluation after every post
  block. This preserves Yul's evaluation order (including the post step taken by `continue`) rather than hoisting
  the side effect only once. This compiles `inlineAssembly/inline_assembly_for2.sol`; its exact fixture, the
  569-test focused suite, and full corpus pass. Final scorecard: **4360/4876**, 516 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4360 -> 4360 (structural, NEG-ACCEPTED flat 903)

- **Call-option expressions inside inlined state helpers**: the storage/state-helper inliner's AST walk now
  descends into the plain `{value, gas, salt}` options object, so helper parameters and locals referenced there
  are alpha-renamed with the rest of the cloned body. `functionCall/failed_create.sol` advances from a dangling
  `amount` reference to the distinct transfer-slot allocation gap. A compiling salt-deployment regression, the
  570-test focused suite, and full corpus pass with no OK→FAIL or negative-acceptance change; score remains
  **4360/4876**, 516 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4360 -> 4363 (+3, NEG-ACCEPTED flat 903)

- **Tuple locals shadowing contract members (+3)**: tuple-declared variables now use the same compatibility-gated
  outer-scope shadow rule as ordinary local declarations. A tuple local may shadow a state variable or contract
  function, while redeclaring a live local remains rejected because stack slots are name-keyed. This advances
  `corion/provider.sol` past `currentSchellingRound` redefinition and compiles three corpus fixtures; the focused
  suite reaches 571 tests and the full corpus passes. Final scorecard: **4363/4876**, 513 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4363 -> 4364 (+1, NEG-ACCEPTED flat 903)

- **Contextual constructor-argument coercion (+1)**: contract instantiation now applies the same
  compatibility-gated literal conversions as ordinary calls and `abi.encodeCall` before checking constructor
  parameter types. This permits Solidity's `"abc"` to `bytes3` constructor argument without weakening
  non-literal assignability. This compiles `constructor/constructor_arguments_internal.sol`; its exact fixture,
  the 572-test focused suite, and full corpus pass. Final scorecard: **4364/4876**, 512 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4364 -> 4366 (+2, NEG-ACCEPTED flat 903)

- **UDVT registration before struct field resolution (+2)**: contract-level user-defined value types now register
  before struct definitions are populated, so `T` and `T[]` fields resolve to their real `ValueType` rather than
  an unresolved named-address placeholder. UDVT underlyings are elementary and therefore do not depend on struct
  registration, making the reordered dependency direction explicit. This compiles
  `abicoder/abi_encode_call_v2.sol` and a companion fixture; the exact fixture, the 573-test focused suite, and
  full corpus pass. Final scorecard: **4366/4876**, 510 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4366 -> 4369 (+3, NEG-ACCEPTED flat 903)

- **Contract-scoped UDVT shadowing (+3)**: semantic type registration now distinguishes file-level declarations
  from declarations already made in the current contract. A contract UDVT may shadow a same-named file type,
  struct, or enum (Solidity emits only a warning), while duplicates within the contract and non-file conflicts
  remain errors. This compiles `ASTJSON/userDefinedValueType.sol`,
  `userDefinedValueType/name_conflict_contract_warning.sol`, and `userDefinedValueType/reference.sol`; the
  574-test focused suite and full corpus pass. Final scorecard: **4369/4876**, 507 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4369 -> 4370 (+1, NEG-ACCEPTED flat 903)

- **UDVT ABI re-wrapping in selector-based self calls (+1)**: reducing
  `address(this).call(abi.encodeWithSelector(...))` to a typed internal call now restores the ABI decoder's
  user-defined-value-type boundary. A raw underlying value such as `int(-5)` is wrapped into the callee's `MyInt`
  parameter, while already nominal `abi.encodeCall` arguments and existing `T.wrap(...)` casts remain untouched.
  This compiles `userDefinedValueType/abicodec.sol`; its exact fixture, the 575-test focused suite, and full corpus
  pass. Final scorecard: **4370/4876**, 506 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4370 -> 4371 (+1, NEG-ACCEPTED flat 903)

- **Direct external-function `.address` members (+1)**: `I(addressExpr).method.address` now reduces to the
  visited cast address before the inner method member can be mistaken for an external state-variable read. This
  matches the address component of Solidity's external function value while preserving evaluation of the
  receiver expression. This compiles `functionTypes/address_member.sol`; its exact fixture, the 576-test focused
  suite, and full corpus pass. Final scorecard: **4371/4876**, 505 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4371 -> 4373 (+2, NEG-ACCEPTED flat 903)

- **Self external-function values in struct blobs (+2)**: a self member such as `this.g` stored in an external
  function-pointer struct field now lowers to the field's runtime representation,
  `g.selector ++ address(this)`. When that lowered field is passed to a same-contract function-pointer
  parameter, the receiver is also retyped to the blob representation, keeping the value consistent across the
  call boundary. This compiles `abicoder/calldataDecoding/struct/member_external_function_v2.sol` and a companion
  corpus case; `abicoder/cleanup/function_v2.sol` advances to its independent Yul-memory diagnostic. The exact
  fixture, 577-test focused suite, and full corpus pass. Final scorecard: **4373/4876**, 503 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4373 -> 4376 (+3, NEG-ACCEPTED flat 903)

- **Received external-function `.address` component (+3)**: reading `cb.address` now participates in the same
  ABI-boundary split already used by calls and `cb.selector`. The pointer parameter lowers to an address plus a
  `bytes4` selector, and `.address` returns the address parameter directly instead of reaching generic struct
  field lookup. This compiles `types/external_function_to_address.sol`,
  `viaYul/function_address.sol`, and
  `functionTypes/stack_height_check_on_adding_gas_variable_to_function.sol`; the exact fixture, 578-test focused
  suite, and full corpus pass. Final scorecard: **4376/4876**, 500 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4376 -> 4377 (+1, NEG-ACCEPTED flat 903)

- **Contract metatype metadata in constants (+1)**: constant initializers bypass ordinary expression traversal,
  so a registered sibling-contract metatype is now resolved while the constant is registered. This preserves
  the contract name and compiled-bytecode lookup needed when `type(A).creationCode` or `.runtimeCode` is later
  inlined at a use site, while still deferring forward declarations that are not registered yet. This compiles
  `constants/assign_type_info.sol`; its exact fixture, the 579-test focused suite, and full corpus pass. Final
  scorecard: **4377/4876**, 499 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4377 -> 4379 (+2, NEG-ACCEPTED flat 903)

- **Split pointer arguments to an invalid internal dispatch (+2)**: calls through a provably never-initialized
  internal function-pointer state variable now restore the nominal external-function type of any argument whose
  storage representation was split to an address. The cast is restricted to values lowered by the external
  pointer storage pass and emits no conversion; the callee remains the existing invalid sentinel ID, so
  `OP_INVOKE` fails before arguments are consumed, preserving Solidity's zero-function-pointer panic. This
  compiles both `functionTypes/call_to_zero_initialized_function_type_ir.sol` and its legacy companion; their
  exact fixtures, the 580-test focused suite, and full corpus pass. Final scorecard: **4379/4876**, 497 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4379 -> 4382 (+3, NEG-ACCEPTED flat 903)

- **External function values in events (+3)**: Solidity permits external function event parameters but rejects
  internal function types. Event emission now materializes a self or direct foreign member as
  `selector ++ address`, retains the nominal external `FunctionType` for overload checking, and serializes the
  composite as bytes rather than an internal function ID. Internal function event declarations remain rejected,
  preserving `syntaxTests/events/internal_type.sol`. This compiles
  `semanticTests/events/event_indexed_function.sol`, `event_indexed_function2.sol`, and
  `syntaxTests/events/event_function_type_indexed.sol`; their exact fixtures, the 582-test focused suite, and full
  corpus pass. Final scorecard: **4382/4876**, 494 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4382 -> 4383 (+1, NEG-ACCEPTED flat 903)

- **External function-pointer Yul dirty-bit cleanup (+1)**: the Yul parser now accepts the keyword component
  `p.address`, and lowering recognizes Solidity's exact cleanup idioms that OR unreachable high bits above the
  160-bit address or 32-bit selector. SolidCash's function-pointer representation has no such dirty bits, so
  these exact assignments safely lower to no-ops; arbitrary component writes still fail closed. This compiles
  `functionTypes/comparison_operator_for_external_function_cleans_dirty_bits.sol`; its exact fixture, the
  584-test focused suite, and full corpus pass. Final scorecard: **4383/4876**, 493 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4383 -> 4384 (+1, NEG-ACCEPTED flat 903)

- **Public external-function state getter (+1)**: a zero-argument `this.x()` call now enables Solidity's
  synthesized getter when `x` is a public external-function state variable. Synthesis is usage-gated so
  unrelated pointer storage retains its established split address/selector lowering, and internal function
  pointers remain excluded from the ABI. This compiles
  `syntaxTests/functionTypes/external_function_type_public_variable.sol`; its exact fixture, the 586-test
  focused suite, and full corpus pass. Final scorecard: **4384/4876**, 492 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4384 -> 4385 (+1, NEG-ACCEPTED flat 903)

- **Discarded bare `super` reference (+1)**: an ordinary contract member may contain Solidity's valueless
  `super;` expression statement, which now lowers to a no-op without affecting real `super.f()` dispatch.
  Free functions and libraries still reject the reference; explicit negative regressions caught and removed an
  initially over-broad form of the rule. This compiles `semanticTests/various/super_alone.sol`; its exact
  fixture, the 587-test focused suite, and full corpus pass. Final scorecard: **4385/4876**, 491 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4385 -> 4386 (+1, NEG-ACCEPTED flat 903)

- **Discarded qualified interface-function reference (+1)**: a unique declared `IFace.method;` function value
  used as an expression statement now lowers to a no-op, matching Solidity's no-effect semantics. Unknown
  members still fail, and overloaded `Contract.method;` remains rejected as ambiguous; the latter negative was
  found by the corpus diagnostic after an initially broad rule raised NEG-ACCEPTED to 904. This compiles
  `syntaxTests/types/functionTypes/function_definition_expression.sol`; its exact fixture, the 591-test focused
  suite, and full corpus pass. Final scorecard: **4386/4876**, 490 failed, 903 NEG-ACCEPTED.

- **Preparatory parity work (score-neutral in this run)**: nested unchecked allocation of a named memory
  bytes/string return can now share a Yul memory buffer; constant byte tables are materialized into that buffer;
  C2 mapping-entry interface fields are captured at the call site; and same-named chunked-value witnesses forward
  through internal calls. These advances move `benchmarks/OptimizorClub.sol` from its early undefined named-return
  failure to a later block-layout limitation, with focused regressions and no corpus/negative regression.

### Continued bench/fix loop: 4386 -> 4387 (+1, NEG-ACCEPTED flat 903)

- **Using-for on an external self-function value (+1)**: when a unique declared function is the receiver of a
  using-for method, symbol analysis now reconstructs its complete `FunctionType` rather than using the ordinary
  function symbol's return type. This resolves `this.identity.double(value)` against
  `using L for function(uint256) external ...`; overloaded receivers remain rejected rather than guessed. This
  compiles `semanticTests/libraries/internal_library_function_attached_to_external_function_type.sol`; its exact
  fixture, the 593-test focused suite, and full corpus pass. Final scorecard: **4387/4876**, 489 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4387 -> 4391 (+4, NEG-ACCEPTED flat 903)

- **Named-argument external self-call normalization (+4)**: `this.f({name: value})` arrives from the parser as a
  MethodCall on the already-lowered active-input locking bytecode, unlike positional `this.f(value)`. That exact
  receiver shape now normalizes to the established `fromThisCall` FunctionCall path, retaining named arguments
  and call options for ordinary overload selection and validation. This compiles
  `lsp/rename/functionCall.sol`, `smtCheckerTests/external_calls/external_call_semantic_this_2.sol`, and both
  `constructor/constructor_this.sol` fixtures; the exact fixture, the 594-test focused suite, and full corpus
  pass. Final scorecard: **4391/4876**, 485 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4391 -> 4396 (+5, NEG-ACCEPTED flat 903)

- **Branch-local ternary increment/decrement lowering (+5)**: a ternary used to initialize or assign a variable
  now expands to a declaration/assignment plus a real `if/else` before expression-form `++`/`--` is lowered.
  Mutations in either arm therefore remain conditional and retain prefix/postfix value semantics instead of
  being rejected or hoisted outside the branch. Loop-condition mutations remain fail-closed pending their
  separate control-flow lowering. This compiles both `control_flow/side_effects_inside_ternary` fixtures,
  `operators/conditional_assignment_2.sol`, `conditional_assignment_3.sol`, and
  `conditional_assignment_statevar_1.sol`; their exact fixtures, the 596-test focused suite, and full corpus
  pass. Final scorecard: **4396/4876**, 480 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4396 -> 4398 (+2, NEG-ACCEPTED 903 -> 902)

- **Public transient-value getters (+2)**: public scalar `transient` variables now receive the same ABI getter
  Solidity exposes for ordinary public state. A direct getter entry starts from the transaction-local zero
  value, while `this.x()` within an executing function is reduced to that function's transient local so a prior
  write remains visible. This compiles both `getters/transient_value_types.sol` fixtures; their exact fixtures,
  the 597-test focused suite, and full corpus pass. The negative diagnostic also improves by one, from 903 to
  902 over-accepted solc-negative fixtures. Final scorecard: **4398/4876**, 478 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4398 -> 4400 (+2, NEG-ACCEPTED flat 902)

- **State assignments in short-circuit branch conditions (+2)**: a state assignment used as the conditional
  right operand of `&&` or `||` now lowers to nested `if/else` branches. This keeps the write conditional,
  preserves left-to-right short-circuit evaluation and turns the state mutation into the statement form required
  by the target IR. This compiles both `control_flow/short_circuit_*_touched.sol` fixtures; their exact fixtures,
  the 598-test focused suite, and full corpus pass. Final scorecard: **4400/4876**, 476 failed,
  902 NEG-ACCEPTED.

### Continued bench/fix loop: 4400 -> 4402 (+2, NEG-ACCEPTED flat 902)

- **Discarded attached-library function values (+2)**: a plain identifier receiver with a uniquely resolved
  `using L for T` member may now appear as a discarded function-value expression (`x.method;`). Resolution checks
  both the receiver binding and the actual library declaration before dropping the no-effect statement;
  computed receivers and overloaded members remain fail-closed. This compiles
  `nameAndTypeResolution/253_using_for_function_exists.sol` and
  `using/library_function_attached_but_not_called.sol`; their exact fixtures, the 600-test focused suite, and
  full corpus pass. Final scorecard: **4402/4876**, 474 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4402 -> 4404 (+2, NEG-ACCEPTED flat 902)

- **Contextual hex-number arithmetic (+2)**: integer destinations now propagate through arithmetic expression
  trees before type checking, so Solidity hex-number leaves are interpreted numerically rather than as
  SolidCash byte strings. The AST retains the exact numeric value of odd-nibble literals, making
  `0x123 + 0x456` bytecode-identical to `291 + 1110`; constants, locals, state writes, and assignments share the
  rule. The initial full run exposed two over-accepted excessive constant shifts, so Solidity's uint32 constant
  shift bound was added and NEG-ACCEPTED returned to baseline. This compiles both
  `assignment_to_const_var_involving_expression.sol` fixtures; their exact fixtures, the 603-test focused suite,
  and full corpus pass. Final scorecard: **4404/4876**, 472 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4404 -> 4406 (+2, NEG-ACCEPTED flat 902)

- **Contextually typed inline-array elements (+2)**: a declared array destination now propagates its element type
  into inline literals before homogeneous-array inference. Hex-number elements in integer arrays are interpreted
  numerically, string literals in fixed-bytes arrays are right-padded, and nested inline arrays recurse through
  their destination shape. This compiles `isoltestTesting/isoltestFormatting.sol` and
  `typecast/fixed_bytes_array_from_strig_inline_array.sol`; their exact fixtures, the 605-test focused suite, and
  full corpus pass. Final scorecard: **4406/4876**, 470 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4406 -> 4407 (+1, NEG-ACCEPTED flat 902)

- **Discarded library namespace/function values (+1)**: a known library namespace and a uniquely declared
  qualified library function may now be referenced as no-effect expression statements (`Lib; Lib.method;`).
  Unknown members and overload ambiguity still reach normal diagnostics. This compiles
  `libraries/library_stray_values.sol`; its exact fixture, the 607-test focused suite, and full corpus pass.
  Final scorecard: **4407/4876**, 469 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4407 -> 4411 (+4, NEG-ACCEPTED flat 902)

- **Nested lexical local shadowing (+4)**: inner-block locals that reuse an outer local or parameter name are
  alpha-renamed before semantic analysis so each receives a distinct target-stack slot. Initializers are visited
  before the new binding enters scope, preserving Solidity's `uint x = x` rule (the RHS reads the outer `x`);
  later uses bind to the inner slot. Same-block duplicates still reject. This compiles
  `cleanup/exp_cleanup_nonzero_base.sol`, `scoping/c99_scoping_activation.sol`,
  `scoping/double_variable_declaration.sol`, and one additional downstream shadowing fixture; the exact fixtures,
  bytecode-equivalent manual-renaming regression, 609-test focused suite, and full corpus pass. Final scorecard:
  **4411/4876**, 465 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4411 -> 4414 (+3, NEG-ACCEPTED flat 902)

- **Public getters implementing abstract functions (+3)**: synthesized public constant/state/mapping getters now
  fulfill retained inherited abstract declarations when their ABI parameters, tuple returns, and mutability are
  compatible. Fulfilled abstract provenance nodes are removed before selector dispatch/codegen, and
  mapping-to-struct getters return the scalar struct members while omitting mapping/array fields. Getter
  mutability is explicit (`pure` for constants, `view` for state); an initial diagnostic run caught and fixed
  state getters incorrectly weakening an abstract `pure` function, returning NEG-ACCEPTED to 902. This compiles
  `public_constant_var_overrides_pure.sol`, `public_var_override_mapping_to_dynamic_struct.sol`, and
  `public_var_override_struct_with_memory_element.sol`; their exact fixtures, negative mutability regressions,
  the 613-test focused suite, and full corpus pass. Final scorecard: **4414/4876**, 462 failed,
  902 NEG-ACCEPTED.

### Continued bench/fix loop: 4414 -> 4416 (+2, NEG-ACCEPTED flat 902)

- **Public-mapping receiver resolution (+2)**: indexed structural type resolution now prefers the actual
  collection declaration over a same-named synthesized public getter. Previously the getter's tuple return type
  shadowed an inherited `mapping(uint => Transaction) public transactions`, so the address field in
  `transactions[id].destination.call{value: ...}(...)` could not be recognized. Canonical struct lookup also
  hydrates nominal inherited contract-local struct fields when needed. This compiles both
  `MultiSigWallet/MultiSigWallet.sol` and `MultiSigWallet/MultiSigWalletFactory.sol`; their exact fixtures, the
  inherited-public-mapping regression, the 614-test focused suite, and full corpus pass. Final scorecard:
  **4416/4876**, 460 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4416 -> 4418 (+2, NEG-ACCEPTED flat 902)

- **Inline deploy calls in file-level free functions (+2)**: `HoistInlineDeployCalls` now traverses free-function
  bodies as well as contract functions, so `(new Child()).getter()` reaches the existing named deploy-local and
  genesis-fold machinery before the free function is inlined into its caller. The established foldability checks
  remain authoritative. This compiles both `semanticTests/freeFunctions/new_operator.sol` and
  `smtCheckerTests/file_level/new_operator.sol`; their exact fixtures, the free-function inline-deploy regression,
  the 615-test focused suite, and full corpus pass. Final scorecard: **4418/4876**, 458 failed,
  902 NEG-ACCEPTED.

### Continued bench/fix loop: 4418 -> 4420 (+2, NEG-ACCEPTED flat 902)

- **Indexed/nested blob function-pointer fields (+2)**: external function-pointer struct fields encoded as
  selector-plus-address blobs now lower calls whose receiver is an indexed or nested expression
  (`rows[i].inner.fp(args)`), not only the dotted plain-local `s.fp(args)` parser shape. Both forms feed the same
  blob split and audited external dispatch. This compiles
  `functionTypes/struct_with_external_function.sol` and `structs/multislot_struct_allocation.sol`; their exact
  fixtures, a nested indexed receiver regression, the 616-test focused suite, and full corpus pass. Final
  scorecard: **4420/4876**, 456 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4420 -> 4421 (+1, NEG-ACCEPTED flat 902)

- **Blob function-pointer call statements (+1)**: statement-form indexed struct calls now replace the
  `MethodCallStatement`'s authoritative call node rather than populating the traversal-only expression cache.
  Blob split temporaries also use a monotonic call-site counter, preventing collisions across consecutive
  statement calls. This compiles `viaYul/copy_struct_invalid_ir_bug.sol`; the exact fixture, a two-consecutive-call
  regression, the 616-test focused suite, and full corpus pass. Final scorecard: **4421/4876**, 455 failed,
  902 NEG-ACCEPTED.

### Continued bench/fix loop: 4421 -> 4434 (+13, NEG-ACCEPTED flat 902)

- **Solidity-compatible `ecrecover` default (+13)**: `solidityImportCompat` now maps Solidity's standard
  `ecrecover(hash, v, r, s)` builtin to the existing VM-backed `ecrecoverEvm` projection by default, producing
  the canonical 20-byte EVM address. An explicit `ecrecover: 'p2pkh'` still selects the native BCH projection,
  while native non-compat mode keeps the ambiguous bare name undefined. This compiles the complete 13-fixture
  `UndefinedReferenceError: ecrecover` cluster; exact projection bytecode regressions, the 617-test focused suite,
  and full corpus pass. Final scorecard: **4434/4876**, 442 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4434 -> 4440 (+6, NEG-ACCEPTED flat 902)

- **Nested deploy values in state-array pushes (+6)**: a deploy expression used as a pushed element is now
  hoisted immediately before the push (`a.push(new D())` becomes `D tmp = new D(); a.push(tmp)`), including the
  equivalent `address(new D())` and one-argument struct wrapper forms. This keeps the deploy covenant's pending
  master/category stack values below the array encoder rather than between the array blob and its element.
  Direct and manually hoisted forms are bytecode-identical. This compiles all six
  `external_call_state_var_*_inside_array*_trusted_{1,2}.sol` fixtures; exact wrapper regressions, the 618-test
  focused suite, and full corpus pass. Final scorecard: **4440/4876**, 436 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4440 -> 4444 (+4, NEG-ACCEPTED flat 902)

- **External calls through plain-address state-struct fields (+4)**: explicit contract/interface casts over
  self-pinned state chains (`D(s.d).x()` and nested `D(t.s.d).x()`) now use the same synthesized state-read target
  local as interface-typed fields. Zero-argument constructor reads through those casts are promoted to typed
  deploy inputs, matching BCH's off-chain constructor model rather than attempting an impossible constructor-time
  co-spend. This compiles all four `external_call_state_var_address_inside_struct_trusted_{1..4}.sol` fixtures;
  target-pinning/deploy-input metadata regressions, the 619-test focused suite, and full corpus pass. Final
  scorecard: **4444/4876**, 432 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4444 -> 4448 (+4, NEG-ACCEPTED flat 902)

- **Literal-argument constructor external reads (+4)**: constructor reads such as `z = state.f(2)` now promote
  to typed deploy inputs just like zero-argument reads. Promotion is restricted to literal arguments, so
  side-effectful/runtime argument expressions remain on the normal fail-closed path rather than being erased.
  This compiles `external_call_from_constructor_{1,1_trusted,3,3_trusted}.sol`; positive deploy-input and negative
  side-effect regressions, the 620-test focused suite, and full corpus pass. Final scorecard:
  **4448/4876**, 428 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4448 -> 4449 (+1, NEG-ACCEPTED flat 902)

- **Bare inherited dynamic-array mutations (+1)**: inherited `arrayA.push(v)` / `arrayA.pop()` operations were
  parsed as local-array mutations because the AST builder only knows state names declared in the contract currently
  being parsed. The symbol pass now reclassifies them after inheritance expansion, where the complete state map is
  available, while preserving genuine local shadowing. This compiles
  `storageLayoutSpecifier/state_variable_dynamic_array.sol`; the exact regression, the 621-test focused suite, and
  full corpus pass. Final scorecard: **4449/4876**, 427 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4449 -> 4450 (+1, NEG-ACCEPTED flat 902)

- **Tuple swaps between state structs (+1)**: the existing RHS-before-write state-tuple lowering now admits
  concrete struct state variables, whose values are ordinary blobs and whose state assignment path already
  rebuilds the slot. Local `storage` pointer structs remain excluded because their rebinding/copy semantics differ.
  This makes `(x, y) = (y, x)` capture both struct values before either write and compiles
  `tupleAssignments/warn_multiple_storage_storage_copies.sol`, including its nested tuple form; the focused suite is
  622/622 and the full corpus passes. Final scorecard: **4450/4876**, 426 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4450 -> 4452 (+2, NEG-ACCEPTED flat 902)

- **Nested value-deploy transfer layout (+2)**: the block-layout pre-scan now finds value-bearing child
  instantiations nested under constructor state assignments and expression wrappers, before codegen creates the
  corresponding transfer covenant. The structural expression walk is cycle-safe and excludes semantic
  back-references, preventing self-function metadata from recursing into unrelated declarations. This compiles
  `inheritance/value_for_constructor.sol` and
  `typecast/string_literal_to_fixed_bytes_constructor_for_deployment.sol`; the constructor regression, existing
  cycle regression, 623-test focused suite, and full corpus pass. Three superficially related fixtures remain loud
  with distinct stack/layout failures. Final scorecard: **4452/4876**, 424 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4452 -> 4455 (+3, NEG-ACCEPTED flat 902)

- **External contract method references as values (+3)**: a unique `C(addressExpr).f` member reference now
  materializes Solidity's external-function `(address, selector)` value before field access can mistake `f` for
  external state. The lowering preserves the nominal function signature, does not guess among overloads, and keeps
  runtime-varying function-pointer state assignments on their existing fail-closed path. This compiles
  `errors_by_parameter_type.sol`, `require_error_function_pointer_parameter.sol`, and
  `viaYul/conversion/function_cast.sol`; a fourth fixture advances to its independent try/catch missing-return gap.
  The focused suite is 624/624 and the full corpus passes. Final scorecard: **4455/4876**, 421 failed,
  902 NEG-ACCEPTED.

### Continued bench/fix loop: 4455 -> 4457 (+2, NEG-ACCEPTED flat 902)

- **Return validation for fatal try/catch semantics (+2)**: all-path return analysis now checks only the try
  branch of a final try/catch statement, matching the compiler's existing BCH semantics: a failed script aborts
  the transaction, catch clauses are dead, and only a successful try can continue. Ordinary branch/switch return
  checks are unchanged. This compiles `tryCatch/return_function.sol` and `tryCatch/returns_memory.sol`; the focused
  suite is 625/625 and the full corpus passes. Final scorecard: **4457/4876**, 419 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4457 -> 4458 (+1, NEG-ACCEPTED flat 902)

- **Literal-zero selector coercion (+1)**: `abi.encodeWithSelector` now applies the compiler's existing Solidity
  contextual conversion from integer literal zero to fixed bytes, making `abi.encodeWithSelector(0)` equivalent
  to a zero `bytes4` selector. Nonzero integers remain rejected. This compiles
  `abi/abi_encode_no_arguments.sol`; the focused suite is 626/626 and the full corpus passes. Final scorecard:
  **4458/4876**, 418 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4458 -> 4460 (+2, NEG-ACCEPTED flat 902)

- **Contextual fixed-bytes tuple literals (+2)**: tuple declarations and tuple reassignments now apply the same
  per-slot literal coercions as scalar assignment, including right-padding string literals to the declared
  `bytesN` width. Skipped slots remain unconstrained and non-literal values retain normal assignability checks.
  This compiles `string_literal_assignment_{2,3}.sol`; the focused suite is 627/627 and the full corpus passes.
  Final scorecard: **4460/4876**, 416 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4460 -> 4461 (+1, NEG-ACCEPTED flat 902)

- **All-zero hex-number fixed-bytes coercion (+1)**: an all-zero hex number literal now follows Solidity's
  numeric-zero rule and converts to any declared `bytesN` width regardless of the literal's written digit count.
  Nonzero fixed-bytes narrowing remains rejected. This compiles `zero_literal_to_bytesNN_implicit.sol`; the focused
  suite is 628/628 and the full corpus passes. Final scorecard: **4461/4876**, 415 failed, 902 NEG-ACCEPTED.

### Continued bench/fix loop: 4461 -> 4462 (+1, NEG-ACCEPTED flat 902)

- **ABI-decoded payable address binding (+1)**: a direct `abi.decode(data, (address))` result may now bind an
  `address payable` local, preserving Solidity's contextual payability qualifier on an ABI address word. Ordinary
  nonpayable-address to payable-address assignment remains rejected. This compiles `address_abi_decode.sol`; the
  focused suite is 629/629 and the full corpus passes. Final scorecard: **4462/4876**, 414 failed,
  902 NEG-ACCEPTED.

### Continued bench/fix loop: 4462 -> 4466 (+4, NEG-ACCEPTED +1 to 903)

- **Indexed public array-of-struct getter destructuring (+4)**: self-calls to synthesized public getters for
  finite arrays of non-recursive structs now retain Solidity's tuple ABI while exposing one indexed storage read
  per ABI-visible struct field to the BCH lowering pipeline. Mapping and nested-array fields remain omitted from
  the getter tuple, and recursive struct layouts remain fail-closed. This compiles
  `functions/getters/array_of_structs_{1,2,3}.sol` and
  `abiEncoder/v1_accessing_public_state_variable_via_v1_type.sol`; the direct getter for a struct containing
  contract/function-pointer fields remains loud as a distinct unsupported case. The focused suite is 630/630,
  `git diff --check` is clean, and the full corpus passes. Final scorecard: **4466/4876**, 410 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4466 -> 4468 (+2, NEG-ACCEPTED flat 903)

- **Transient state references introduced by modifiers (+2)**: transient-state lowering now runs after modifier
  expansion, when modifier arguments and bodies are part of each concrete function body. This gives those
  references the same zero-initialized transaction-local binding as direct function references; synthesized public
  transient getters are likewise initialized by the shared lowering rather than carrying a special duplicate
  declaration. This compiles `modifiers/transient_state_variable_value_type.sol` and one additional transient
  modifier interaction in the full corpus. The focused suite is 631/631, the direct fixture compile passes,
  `git diff --check` is clean, and the full corpus passes. Final scorecard: **4468/4876**, 408 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4468 -> 4469 (+1, NEG-ACCEPTED flat 903)

- **Secondary-contract transient getter initialization (+1)**: transient-state lowering now visits every contract
  in a multi-contract source, matching public-getter synthesis and semantic analysis rather than initializing only
  the selected primary contract. Synthesized transient getters in secondary contracts therefore resolve their
  state name to a zero-initialized transaction-local value instead of recursively resolving to the getter
  function. This compiles `various/different_call_type_transient.sol`; the focused suite is 632/632, the direct
  fixture compile passes, `git diff --check` is clean, and the full corpus passes. Final scorecard:
  **4469/4876**, 407 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4469 -> 4470 (+1, NEG-ACCEPTED flat 903)

- **User-defined `gasleft()` shadowing (+1)**: the pre-semantic BCH gas shim now checks for a matching
  zero-argument contract declaration before replacing a `gasleft()` call with its fixed compatibility value.
  Solidity-compatible source can therefore shadow the builtin (Solidity warns but permits it), while contracts
  without such a declaration retain the existing no-gas shim. This compiles
  `nameAndTypeResolution/500_gasleft_shadowing_1.sol`; the focused suite is 633/633, the direct fixture compile
  passes, `git diff --check` is clean, and the full corpus passes. Final scorecard: **4470/4876**, 406 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4470 -> 4471 (+1, NEG-ACCEPTED flat 903)

- **Unary complement of Solidity hex-number literals (+1)**: under Solidity compatibility, `~0xff` now receives
  integer context just like `-0xff`, so nested bitwise expressions operate on Solidity's numeric literal value
  instead of prematurely fixing it as `bytes1`. The conversion is restricted to lexer-marked hex-number
  literals; `hex"ff"` remains a byte string and retains byte-complement behavior. This compiles
  `operators/bitwise_rational_2.sol`; the focused suite is 634/634, the direct fixture compile passes,
  `git diff --check` is clean, and the full corpus passes. Final scorecard: **4471/4876**, 405 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4471 -> 4472 (+1, NEG-ACCEPTED flat 903)

- **Public state getters as external function values (+1)**: when an expression context explicitly expects an
  external function type, an uncalled `this.x` for a public state variable now resolves to the synthesized getter
  function rather than the underlying state value. `this.x()` remains the getter call, and SolidCash's whole-state
  `this.x` extension remains unchanged in non-function contexts. The contextual conversion applies to returns and
  local/state assignments. This compiles `immutable/state_var_external_access_read.sol`; the focused suite is
  635/635, the direct fixture compile passes, `git diff --check` is clean, and the full corpus passes. Final
  scorecard: **4472/4876**, 404 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4472 -> 4473 (+1, NEG-ACCEPTED flat 903)

- **Integer context through ternary arithmetic (+1)**: contextual typing for Solidity hex-number literals now
  propagates through both value branches of nested ternaries before arithmetic type inference. Expressions such
  as `(t ? 0x3f : 0xff) + ...` therefore use numeric literals when assigned to an integer, while ternaries in
  bytes contexts remain unchanged. This compiles `literals/ternary_operator_return_type_with_literal_arguments.sol`;
  the focused suite is 636/636, the direct fixture compile passes, `git diff --check` is clean, and the full corpus
  passes. Final scorecard: **4473/4876**, 403 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4473 -> 4474 (+1, NEG-ACCEPTED flat 903)

- **One-word Solidity constants in Yul `let` bindings (+1)**: fresh Yul locals now normalize referenced
  Solidity one-slot values—including bool and fixed-bytes constants—to their `uint256` word representation, using
  declaration types retained across assembly lowering. The rule deliberately excludes dynamic calldata
  aggregates and external function values, which Solidity rejects as direct assembly operands because they require
  offset/length or two stack slots. This compiles `inlineAssembly/constant_access.sol`. A differential audit found
  and then eliminated three initial negative-diagnostic regressions; `invalid/calldata_variables.sol`,
  `two_stack_slot_access.sol`, and `two_stack_slots.sol` all reject after narrowing. The focused suite is 637/637,
  the positive and three negative target checks pass, `git diff --check` is clean, and the corrected full corpus
  passes. Final scorecard: **4474/4876**, 402 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4474 -> 4479 (+5, NEG-ACCEPTED flat 903)

- **Yul raw-return halt provenance (+5)**: lowered `return(ptr,size)` statements now retain that they are Yul
  execution halts with raw memory output, rather than masquerading as Solidity source-level return expressions.
  Return-type and void-entry validation therefore no longer compares their raw word/bytes payload against the
  enclosing Solidity ABI, while path analysis still recognizes the halt as terminal. This compiles
  `inline_assembly_function_call{,2,_assignment}.sol`, `various/address_code_complex.sol`, and
  `controlFlow/unreachableCode/assembly/return.sol`; `shanghai/evmone_support.sol` advances past this gap to its
  independent external-target restriction. The focused suite is 638/638, all six direct probes clear the original
  return error, `git diff --check` is clean, and the full corpus passes. Final scorecard: **4479/4876**, 397 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4479 -> 4482 (+3, NEG-ACCEPTED flat 903)

- **Code-baked `address(integer-literal)` call targets (+3)**: external-call slot classification now recognizes
  an explicit address cast of an integer literal as a covenant-pinned constant, encoded with the same minimal VM
  number bytes emitted by the cast. This extends the existing sound literal-target path without promoting any
  computed or caller-controlled address. It compiles `types/tuple_extra_parens_7.sol`,
  `nameAndTypeResolution/018_forward_function_reference.sol`, and
  `isoltestTesting/precompiles_ignoring_trailing_input.sol`; nonliteral target shapes remain fail-closed. The
  focused suite is 639/639, direct target probes
  pass, `git diff --check` is clean, and the full corpus passes. Final scorecard: **4482/4876**, 394 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4482 -> 4485 (+3, NEG-ACCEPTED flat 903)

- **Public-variable getters resolving explicit diamond overrides (+3)**: state and collection declarations now
  retain source `override` provenance and base lists. During inheritance expansion, a matching public scalar
  variable getter can therefore replace zero-argument virtual functions from each explicitly named sibling base
  before the getter is synthesized. Base-list completeness, parent virtuality, return type, and the rule that a
  view state getter cannot implement a pure function remain enforced. This compiles
  `natspecJSON/{dev,user}_explicit_inherit_variable.sol` and
  `inheritance/override/public_vars_multiple_explicit_override.sol`; the focused suite is 640/640, direct target
  probes pass, `git diff --check` is clean, and the full corpus passes. Final scorecard: **4485/4876**, 391 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4485 -> 4486 (+1, NEG-ACCEPTED flat 903)

- **Parenthesized external member-call dispatch (+1)**: `((target.f))(args)` now preserves ordinary member-call
  lookup instead of treating `target.f` as a struct-field function pointer. Void external calls produced through
  this expression grammar path are explicitly typed `void`, preventing expression-statement cleanup from consuming
  the target parameter before covenant verification. Parenthesized `super.f` remains on its existing inheritance
  resolution path. This compiles
  `smtCheckerTests/external_calls/external_call_extra_parentheses_2.sol` while retaining
  `semanticTests/various/super_parentheses.sol`; an A/B full-corpus comparison identified and eliminated the
  initial zero-sum regression. The focused suite is 641/641, both direct fixtures pass, `git diff --check` is clean,
  and the full corpus passes. Final scorecard: **4486/4876**, 390 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4486 -> 4487 (+1, NEG-ACCEPTED flat 903)

- **Literal-backed interface constants as external targets (+1)**: external-call slot collection now recognizes
  interface/address constants such as `Identity constant i = Identity(address(0x0004))` as code-baked target
  identities instead of looking for a nonexistent runtime stack variable named `i`. Classification unwraps only
  interface/contract and address casts that terminate in an integer or hex literal; computed constants remain
  unrecognized and fail closed. This compiles
  `semanticTests/functionCall/precompile_extcodesize_check.sol`; the focused suite is 642/642, the direct fixture
  passes, `git diff --check` is clean, and the full corpus passes. Final scorecard: **4487/4876**, 389 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4487 -> 4488 (+1, NEG-ACCEPTED flat 903)

- **Discarded nested tuple RHS flattening (+1)**: when a skipped outer assignment slot receives a nested tuple,
  such as `(a,) = (4, (8,16,32))`, the builder now expands that skip to one flat VM slot per nested leaf.
  This preserves left-to-right evaluation—including side effects in discarded expressions—and drops exactly the
  number of values produced. Non-skipped nested values still require a shape-matching nested target. This compiles
  `semanticTests/types/nested_tuples.sol`; the focused suite is 643/643, the direct fixture passes,
  `git diff --check` is clean, and the full corpus passes. Final scorecard: **4488/4876**, 388 failed,
  903 NEG-ACCEPTED.

### Continued bench/fix loop: 4488 -> 4489 (+1, NEG-ACCEPTED flat 903)

- **Fixed-array using-for methods named `push`/`pop` (+1)**: local array receivers now retain their complete
  using-for type key. For fixed arrays—which have no native size-changing operations—the dedicated push/pop
  grammar path resolves attached library methods before constructing builtin array operations, so
  `using L for uint[2]; input.push()` becomes `L.push(input)`. Dynamic-array builtins remain unchanged. This
  compiles `libraries/internal_library_function_attached_to_array_named_pop_push.sol`; the focused suite is
  644/644, the direct fixture passes, `git diff --check` is clean, and the full corpus passes. Final scorecard:
  **4489/4876**, 387 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4489 -> 4490 (+1, NEG-ACCEPTED flat 903)

- **Imported/inherited enum placeholder resolution (+1)**: post-import type repair now resolves named
  `AddressType` placeholders to `EnumType` as well as imported structs and UDVTs. Function locals and parameters
  such as `Color e = Color.Red` therefore retain their declared enum type after import merging instead of failing
  as `bigint -> address`. This compiles `lsp/goto/goto_definition.sol`; `StandardMarket.sol` also advances past
  its enum error to an independent chained-call stack gap. The focused suite is 645/645, the direct import fixture
  and LSP fixture pass, `git diff --check` is clean, and the full corpus passes. Final scorecard:
  **4490/4876**, 386 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4490 -> 4491 (+1, NEG-ACCEPTED flat 903)

- **Yul alignment observation for contract-code buffers (+1)**: inline assembly now preserves the exact EVM
  invariant observed by `mod(sub(b, a), 0x20)` when `a` and `b` are memory locals initialized from
  `type(C).creationCode`/`runtimeCode`. SolidCash represents those locals by their byte values rather than fake
  EVM addresses, but Solidity allocates both at word-aligned addresses, so the remainder is provably zero. The
  fold is deliberately limited to recorded contract-code locals and a literal 32-byte modulus; arbitrary pointer
  differences remain unsupported. This compiles `semanticTests/various/code_access_padding.sol`; the focused
  suite is 646/646, the exact built-compiler fixture passes, `git diff --check` is clean, and the full corpus
  passes. Final scorecard: **4491/4876**, 385 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4491 -> 4492 (+1, NEG-ACCEPTED flat 903)

- **Yul `byte()` returns an integer word (+1)**: both lowering paths for the EVM/Yul `byte(index, value)` builtin
  now cast the selected `bytes1` slice to `uint256`. This matches Yul's word semantics and allows ordinary
  arithmetic/comparison consumers such as `lt(byte(0, mload(ptr)), 0xC0)` without weakening high-level
  `bytes1` typing. This compiles `compilationTests/milestonetracker/MilestoneTracker.sol` through its imported
  RLP decoder; the focused suite is 647/647, the exact built-compiler fixture passes, `git diff --check` is clean,
  and the full corpus passes. Final scorecard: **4492/4876**, 384 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4492 -> 4493 (+1, NEG-ACCEPTED flat 903)

- **Selective and namespace enum import aliases (+1)**: a selectively imported file enum now receives a cloned
  definition under its explicit alias (`Weather as Wetter`), while namespace imports register compound enum
  names such as `That.Color`. This feeds the existing post-import type repair and enum member resolver, avoiding
  runtime-identifier treatment of namespace qualifiers without mutating the cached imported AST shared by other
  imports. This compiles `lsp/goto/goto_definition_imports.sol`; the new import regression and focused 647-test
  corpus gap suite pass, the exact built-compiler fixture passes, `git diff --check` is clean, and the full corpus
  passes. Final scorecard: **4493/4876**, 383 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4493 -> 4494 (+1, NEG-ACCEPTED flat 903)

- **Contract-qualified named struct constructors (+1)**: sibling/imported contract structs are now registered as
  distinct qualified constructor symbols (`Lib.S`), and named-field syntax `Lib.S({a: 2, b: 3})` is routed from
  its method-call parse shape into the existing struct-constructor resolver. Qualified struct symbols take
  precedence over the older contract-qualified function-pointer fallback, while bare struct names are not leaked
  across contract scopes. This compiles `semanticTests/various/cross_contract_types.sol`; the focused suite is
  648/648, the exact built-compiler fixture passes, `git diff --check` is clean, and the full corpus passes.
  Final scorecard: **4494/4876**, 382 failed, 903 NEG-ACCEPTED.

### Continued bench/fix loop: 4494 -> 4495 (+1, NEG-ACCEPTED improves 903 -> 901)

- **Storage-layout clause before inheritance (+1)**: preprocessing now recognizes Solidity's current
  `contract C layout at <expr> is A` order and blanks only the EVM layout clause, preserving the `is A`
  inheritance tail and all source line/column offsets. The older post-inheritance spelling remains accepted for
  compatibility. Inherited collections therefore reach normal inheritance expansion instead of references such
  as `locked[x]` becoming undefined. This compiles
  `semanticTests/storageLayoutSpecifier/state_variable_mapping.sol`; the focused suite is 648/648, the exact
  built-compiler fixture passes, `git diff --check` is clean, and the full corpus passes. Final scorecard:
  **4495/4876**, 381 failed, 901 NEG-ACCEPTED (two fewer solc-negative fixtures over-accepted).

### Continued bench/fix loop: 4495 -> 4497 (+2, NEG-ACCEPTED flat 901)

- **Bytecode dependencies reached through file-level functions (+2)**: referenced-contract discovery now scans
  the retained free functions emitted with the primary contract, so `type(C).runtimeCode` inside a helper called
  by `D` causes `C` to compile first. Conversely, each referenced child wrapper now carries only the transitive
  free-function set that child actually references (including identifier and method-call forms), preventing an
  unrelated primary-only helper from creating a false child self-dependency. This compiles both
  `semanticTests/freeFunctions/free_runtimecode.sol` and `smtCheckerTests/file_level/free_runtimecode.sol`.
  The focused suite is 649/649, both exact built-compiler fixtures and the three initially exposed Gnosis
  method-helper regression probes pass, `git diff --check` is clean, and the corrected full corpus passes. Final
  scorecard: **4497/4876**, 379 failed, 901 NEG-ACCEPTED.

### Continued bench/fix loop: 4497 -> 4499 (+2, NEG-ACCEPTED flat 901)

- **Unreachable internal contract-bytecode subgraphs (+2)**: the existing conservative unreachable-method pass
  now treats `new C()`, contract references, and `type(C).creationCode/runtimeCode` like its existing `msg.data`
  hazard. Only internal/private methods in that transitive subgraph are eligible, and name-conservative
  reachability from every entry point and constructor retains all potentially live overloads. Dead deployment
  helpers therefore neither emit unavailable bytecode nor create false dependency cycles. This compiles both
  `syntaxTests/bytecodeReferences/circular_reference_internal_function.sol` and
  `circular_reference_internal_functions.sol`; the focused suite is 650/650, the exact built-compiler fixture
  passes, `git diff --check` is clean, and the full corpus passes. Final scorecard: **4499/4876**, 377 failed,
  901 NEG-ACCEPTED.

### Continued bench/fix loop: 4499 -> 4501 (+2, NEG-ACCEPTED flat 901)

- **Writable `bytes` views over storage strings (+2)**: lvalue reconstruction now preserves the narrow
  `bytes(stateString)` cast used by Solidity for storage mutation. `.push(value)` lowers to a whole-string
  append and `bytes(s)[i] = value` to the existing prefix/byte/suffix splice, with explicit bytes/string casts
  around the storage read and write-back. Other casts remain non-lvalues and bare `string.push()` remains
  unsupported. This compiles `semanticTests/events/event_indexed_string.sol` and
  `smtCheckerTests/typecast/string_to_bytes_push_1.sol`; the full corpus finishes at **4501/4876**, 375 failed,
  with NEG-ACCEPTED unchanged at 901.

### Continued bench/fix loop: 4501 -> 4502 (+1, NEG-ACCEPTED flat 901)

- **Field writes through plain storage-reference helper calls (+1)**: the existing inline
  `Library.factory(...).field = value` lvalue reconstruction now also accepts a plain resolvable
  `helper(...).field = value`. It synthesizes the same typed temporary and struct-field rebuild, allowing the
  storage-return helper to inline through the established state-reference machinery. This compiles
  `syntaxTests/viewPureChecker/returning_structs_no_restrict_warning.sol`; two related fixtures now advance to
  separate fixed-array-alias and Yul-slot gaps rather than failing in the parser. The focused suite is 652/652
  and the full corpus finishes at **4502/4876**, 374 failed, with NEG-ACCEPTED unchanged at 901.

### Continued bench/fix loop: 4502 -> 4503 (+1, NEG-ACCEPTED flat 901)

- **Prefix mutation of a no-argument push result (+1)**: `++a.push()` on a plain dynamic array now lowers to
  the equivalent single append `a.push(T(1))`: Solidity first appends `default(T)`, then increments the returned
  storage reference. The regression test proves bytecode identity with the explicit reduction, while the
  decrement path retains checked `default(T) - 1` semantics. This compiles
  `smtCheckerTests/operators/unary_add_array_push_1.sol`; the focused suite is 653/653 and the full corpus
  finishes at **4503/4876**, 373 failed, with NEG-ACCEPTED unchanged at 901.

### Continued bench/fix loop: 4503 -> 4504 (+1, NEG-ACCEPTED flat 901)

- **Indexed writes through a parenthesized mapping-storage rebind (+1)**: `(p = other)[k] = value` now lowers
  to the exact sequential semantics `p = other; p[k] = value`. The first operation updates the compiler's
  storage-alias path, and the indexed write is then routed through that newly selected mapping. The regression
  test proves bytecode identity with the sequential form. This compiles
  `semanticTests/variables/mapping_local_compound_assignment.sol`; the focused suite is 654/654 and the full
  corpus finishes at **4504/4876**, 372 failed, with NEG-ACCEPTED unchanged at 901.

### Continued bench/fix loop: 4504 -> 4505 (+1, NEG-ACCEPTED flat 901)

- **Push through a simple storage-return alias helper (+1)**: a zero-argument internal helper whose entire body
  returns one direct state variable by `storage` reference is now recorded as a compile-time alias. A
  `getData().push(value)` call can therefore mutate the known bytes/array state target without inventing an
  on-stack representation for the storage pointer. Recognition requires a single return statement and no
  parameters, so helpers with argument evaluation or body side effects are not collapsed. This compiles
  `smtCheckerTests/array_members/push_function_return_value.sol`; the focused suite is 655/655 and the full corpus
  finishes at **4505/4876**, 371 failed, with NEG-ACCEPTED unchanged at 901.

### Continued bench/fix loop: 4505 -> 4507 (+2, NEG-ACCEPTED flat 901)

- **Nested library external-call helpers (+2)**: `InlineExternalCallHelpers` now normalizes retained
  library/free-function bodies as well as contract bodies. A wrapper such as `L.g(i) { L.f(i); }`, where `L.f`
  performs an external call, no longer retains a source-arity call after `L.f` receives compiler-only covenant
  parameters. The same recursive inline path handles both same-library and cross-library wrappers, leaving each
  retained definition with its own directly discoverable external-call witnesses. This compiles
  `internal_library_external_call_2.sol` and `_3.sol`; the focused suite is 657/657 and the full corpus finishes
  at **4507/4876**, 369 failed, with NEG-ACCEPTED unchanged at 901.

### Continued bench/fix loop: 4507 -> 4510 (+3, NEG-ACCEPTED flat 901)

- **Code-baked integer targets through contract/address casts (+3)**: external-call literal extraction now
  unwraps an explicit contract/interface cast and its nested address casts. In particular, `address(0)` encodes
  as the empty locking-bytecode hex string; metadata and codegen now test presence rather than truthiness, so that
  valid-but-empty fail-closed literal is retained. Concrete cross-contract member validation also distinguishes
  a real function or explicitly public getter from an omitted-visibility state member. A separate
  `visibilityExplicit` bit preserves native/public state representation and internal `this.x()` compatibility
  adapters without exposing those adapters across contracts. This compiles
  `bare_call_no_returndatacopy.sol`, `096_access_to_default_function_visibility.sol`, and
  `099_access_to_internal_state_variable.sol`, while `098_access_to_default_state_variable_visibility.sol`
  remains rejected as Solidity requires. The focused suite is 659/659 and the full corpus finishes at
  **4510/4876**, 366 failed, with NEG-ACCEPTED unchanged at 901.

### Continued bench/fix loop: 4510 -> 4513 (+3, NEG-ACCEPTED flat 901)

- **Discarded ABI-mismatch calls through a freshly deployed alias (+3)**:
  `IExpected(address(fresh)).f()` now recognizes the address/contract casts as identity wrappers around a
  same-transaction `new Concrete()` result. The compiler evaluates the concrete implementation when deciding
  whether the call can fold into deployment; an implemented empty function is a valid no-effect fold whose
  unnamed return is its type default. A deliberately different interface return layout may be erased only in
  statement position, where Solidity discards the result; using that mismatched result as a value still fails
  closed. This compiles the three `return_size_{bigger,shorter}_than_expected` fixtures. The focused suite is
  661/661 and the full corpus finishes at **4513/4876**, 363 failed, with NEG-ACCEPTED unchanged at 901.

### Continued bench/fix loop: 4513 -> 4515 (+2, NEG-ACCEPTED flat 901)

- **Inline deployments hidden by ABI casts (+2)**: the same deploy-call fold now recognizes an
  `InstantiationNode` directly beneath address/interface identity casts, not only a named local initialized from
  `new`. Calls such as `IView(address(new Child())).f()` therefore evaluate `Child.f`'s real straight-line state
  transition and return expression against the new output's genesis. The match requires an actual inline
  instantiation, so computed and immutable external targets remain governed by the ordinary covenant provenance
  checks. This compiles both `staticcall_for_view_and_pure` fixtures. The focused suite is 662/662 and the full
  corpus finishes at **4515/4876**, 361 failed, with NEG-ACCEPTED unchanged at 901.

### Continued bench/fix loop: 4515 -> 4516 (+1, NEG-ACCEPTED flat 901)

- **State-backed targets through address/interface casts (+1)**:
  `SynthesizeExternalAddressLocals` now traces identity casts in
  `IExpected(address(this.contractTypedState)).f()`. A contract/interface-typed immutable or ordinary state
  variable is self-pinned target provenance just like a direct interface state receiver; the pass hoists the
  outer ABI cast into an `__extaddr_...` local so the external-call epilogue can retain and identity-check the
  actual state value. Different interface ABIs preserve their cast rather than being treated as the original
  contract type. This compiles `shanghai/evmone_support.sol`; the focused suite is 663/663 and the full corpus
  finishes at **4516/4876**, 360 failed, with NEG-ACCEPTED unchanged at 901.

### Continued bench/fix loop: 4516 -> 4517 (+1, NEG-ACCEPTED flat 901)

- **Private helpers in directly compiled libraries (+1)**: promoting a library to its deployable contract
  artifact now removes only the namespaced public/external functions that were actually promoted. Private and
  internal functions remain inline free helpers, so a public entry point can still reach them directly or through
  a library-scoped `using {L.helper} for T` binding. This avoids both the previous undefined using-for binding and
  duplicate deployed entry points. This compiles `using/private_library_function.sol`; the focused suite is
  664/664 and the full corpus finishes at **4517/4876**, 359 failed, with NEG-ACCEPTED unchanged at 901.

### Continued bench/fix loop: 4517 -> 4519 (+2, NEG-ACCEPTED flat 901)

- **Own-contract-qualified state arrays (+2)**: reads and array operations now reduce `C.a` to the same state
  binding as bare `a` when `C` is the current contract and `a` is a declared state variable. This applies to
  indexed reads, `.length`, `.push()`, and `.pop()`; assignments already used the equivalent qualifier stripping.
  A bytecode-identity regression covers the complete qualified/bare sequence. This compiles both
  `assignment_contract_member_variable_array` SMT fixtures.
- **Operator reachability groundwork**: per-contract compilation now treats file-level using-for function bindings
  as free-function reachability roots, and the returning-helper inliner no longer drops an operator implementation
  merely because its call is represented by a binary/unary operator until semantic resolution. The two external
  operator fixtures now advance from an undefined-function error to their real remaining memory-derived target
  provenance gap.
- **Flattened struct fixed-array groundwork**: a fixed-array leaf of a flattened state struct now writes through
  its collection backend rather than an unregistered `StateArray` slot. `delete s` resets every finite fixed-array
  index and resets chunked dynamic-array leaves as state, while still leaving mapping leaves intact per Solidity.
  The former `UndefinedStateVariable(s__b)` fixture now reaches its independent unsupported Yul block.

The focused suite is 667/667 and the full corpus finishes at **4519/4876**, 357 failed, with NEG-ACCEPTED
unchanged at 901.

### Continued bench/fix loop: 4519 -> 4519 (+0, NEG-ACCEPTED flat 901)

- **Cycle-safe recursive mapping-struct flattening (robustness)**: collection expansion now tracks the struct
  types on each flattening path and omits only a mapping edge that revisits an ancestor. This terminates both
  self-recursive and mutually recursive storage declarations while preserving scalar leaves before the cycle.
  The three remaining corpus stack overflows now reach ordinary, actionable recursive-storage or
  multidimensional-array diagnostics. A broad recursive-lvalue router was rejected after an A/B corpus run
  exposed four regressions; removing it restored the full protected baseline.

The focused suite is **669/669** and the full corpus remains **4519/4876**, 357 failed, with NEG-ACCEPTED
unchanged at 901 and no `RangeError` failures.

### Continued bench/fix loop: 4519 -> 4520 (+1, NEG-ACCEPTED flat 901)

- **Flattened struct fixed-array literals and state copies (+1)**: whole fixed-array literals on a
  mapping-bearing flattened state struct now lower to the same per-index collection writes as explicit element
  assignments. A direct copy between two flattened state structs copies scalar leaves and every fixed-array
  index while leaving mapping leaves untouched, matching Solidity storage-copy semantics. This compiles
  `copy_struct_with_nested_array_from_storage_to_storage.sol`.

The focused suite is **671/671** and the full corpus finishes at **4520/4876**, 356 failed, with NEG-ACCEPTED
unchanged at 901.

### Continued bench/fix loop: 4520 -> 4522 (+2, NEG-ACCEPTED flat 901)

- **Whole storage aliases to flattened structs (+2)**: `S storage p = s` now substitutes a mapping-bearing
  flattened state struct just like an ordinary state struct. Scalar and mapping-field writes through `p` route
  to `s`'s concrete flattened leaves rather than inventing an undefined aggregate collection. A bytecode-identity
  regression compares alias and direct state writes. This compiles `copy_substructures_from_mapping.sol`; the
  shared routing recovers one additional corpus fixture that previously failed under another diagnostic bucket.
  Nested storage-parameter paths such as `t.s.innerM` remain a separate inliner gap.

The focused suite is **672/672** and the full corpus finishes at **4522/4876**, 354 failed, with NEG-ACCEPTED
unchanged at 901.

### Continued bench/fix loop: 4522 -> 4523 (+1, NEG-ACCEPTED flat 901)

- **Nested flattened struct storage parameters (+1)**: mapping-bearing struct storage parameters now register
  every nested struct prefix that itself needs flattening, using a cycle-aware traversal. The helper body
  `p.s.innerM[k] = v` therefore lowers to `p__s__innerM[k]` before `InlineStoragePointerCalls` renames the root
  to the caller's `t__s__innerM`. A bytecode-identity regression compares the inlined helper with direct nested
  state writes. This compiles `struct_aliasing_parameter_storage_3.sol`.

The focused suite is **673/673** and the full corpus finishes at **4523/4876**, 353 failed, with NEG-ACCEPTED
unchanged at 901.

### Continued bench/fix loop: 4523 -> 4524 (+1, NEG-ACCEPTED flat 901)

- **Indexed flattened storage pointers in inherited constructors (+1)**: constructors now register struct
  storage parameters before visiting their bodies, matching ordinary function setup. During parent-constructor
  substitution, flattened collection names are rewritten together with their indexed storage path:
  `p__m[5]` under `A(data[1])` becomes `data__m[1][5]`. The substitution handles the pre-semantic tuple-index
  representation used by constructor invocation arguments, plus mapping/array access forms. This compiles
  `struct_mapping_abstract_constructor_param.sol`.

The focused suite is **674/674** and the full corpus finishes at **4524/4876**, 352 failed, with NEG-ACCEPTED
unchanged at 901.

### Continued bench/fix loop: 4524 -> 4524 (+0, NEG-ACCEPTED flat 901)

- **Defined-later struct storage-return helpers (groundwork)**: struct-returning function signatures are now
  predeclared for the whole contract before any function body is visited. An inline write such as
  `factory(args).field = value` therefore uses the real struct rebuild even when `factory` appears later in the
  source. The focused source-order regression compiles. `FixedFeeRegistrar.sol` advances from an undefined
  synthesized collection to its independent internal-transfer stack-lifetime gap.

The focused suite is **675/675** and the full corpus remains **4524/4876**, 352 failed, with NEG-ACCEPTED
unchanged at 901. `UndefinedCollection` drops from 14 to 13 with the reclassified fixture.

### Continued bench/fix loop: 4524 -> 4525 (+1, NEG-ACCEPTED flat 901)

- **Increment/decrement on flattened scalar leaves (+1)**: prefix and postfix statement forms now use the same
  flattened scalar state routing as assignment and compound assignment. `++s.x`, `s.x++`, `--s.x`, and `s.x--`
  lower to checked state reads followed by `+ 1` or `- 1`, rather than falling through to an undefined aggregate
  collection. A bytecode-identity regression compares all four forms with explicit arithmetic. This compiles
  `struct_recursive_6.sol`.

The focused suite is **676/676** and the full corpus finishes at **4525/4876**, 351 failed, with NEG-ACCEPTED
unchanged at 901.

### Continued bench/fix loop: 4525 -> 4527 (+2, NEG-ACCEPTED flat 901)

- **Fresh inner-bytes pushes and packed `bytes[]` indexing (+2)**: `bytes[] c; c.push().push() = b` now folds
  the mutation of the freshly created empty bytes value into one outer `c.push(bytes(b))`; the no-argument inner
  push similarly appends a single zero byte. Packed `bytes[]` reads now accept a second dynamic index and extract
  the selected byte with the same raw-byte split sequence as ordinary `bytes[k]`, yielding `bytes1` with natural
  bounds failure. This compiles `push_as_lhs_bytes_2d.sol` and recovers one additional corpus fixture through the
  shared indexing path.

The focused suite is **678/678** and the full corpus finishes at **4527/4876**, 349 failed, with NEG-ACCEPTED
unchanged at 901.

### Continued bench/fix loop: 4527 -> 4531 (+4, NEG-ACCEPTED flat 901)

- **Dead mapping-bearing storage-pointer helpers and mapping-array declarations (+4)**: state collection
  validation now accepts Solidity's legal `mapping(K => V)[]` shape while recursively validating mapping keys
  and eventual values. Internal/private helpers returning mapping-bearing storage pointers are conservatively
  pruned only when unreachable; reachable helpers remain in place for storage-pointer lowering. This removes
  backend failures for dead declarations without pretending a mapping has a standalone stack representation.

The focused suite is **679/679** and the full corpus finishes at **4531/4876**, 345 failed, with NEG-ACCEPTED
unchanged at 901.

### Continued bench/fix loop: 4531 -> 4532 (+1, NEG-ACCEPTED 901 -> 903)

- **Indexed aggregate fields in local struct arrays (+1)**: writes such as `rows[i].fixed[j] = v` and
  `rows[i].bytesField[j] = v` now materialize the selected aggregate field, mutate it locally, rebuild the struct
  element, and write it back. Moving the fallback local-bytes splice after this pass also covers generated bytes
  temporaries. This compiles `create_memory_array.sol`; two additional solc-negative fixtures reach acceptance,
  retained in the diagnostic count.

The focused suite is **680/680** and the full corpus finishes at **4532/4876**, 344 failed.

### Continued bench/fix loop: 4532 -> 4535 (+3, NEG-ACCEPTED flat 903)

- **Struct arrays nested in local structs (+3)**: `s.rows[i].field = v` now rebuilds the selected row before
  rebuilding the containing struct, rather than assigning the field value as the whole row. A deeper
  `s.rows[i].arrayField[j] = v` adds an inner aggregate read/modify/write before those two rebuilds. This compiles
  the safe and both unsafe nested-memory-struct SMT fixtures.

The focused suite is **681/681** and the full corpus finishes at **4535/4876**, 341 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4535 -> 4546 (+11, NEG-ACCEPTED 903 -> 904)

- **Nested aggregate writes and memory/storage parity (+11)**: nested dynamic-array fields in state-array rows,
  nested struct fields in mapping values, and aggregate members of local struct-array elements now rebuild the
  containing values along the complete access path. The Yul memory model uses one EVM word per narrow integer
  (including integer-backed user-defined value types), resets deleted memory-array pointers to zero, and
  materializes inline reference allocations embedded in struct rebuilds. Mixed integer/fixed-point arithmetic
  promotes the integer to the fixed scale. Dynamic state-array copies now convert wider fixed rows element by
  element and zero-fill their tails.

The focused suite is **691/691** and the full corpus finishes at **4546/4876**, 330 failed, with NEG-ACCEPTED
at 904.

### Continued bench/fix loop: 4546 -> 4547 (+1, NEG-ACCEPTED flat 904)

- **Fixed local-array copies into wider state arrays (+1)**: whole fixed-array state assignment now resolves a
  memory/calldata/local source from the active symbol table, not only from the state-variable map. Copying a
  shorter fixed outer array writes the shared rows and resets every remaining destination row to its default
  value. This compiles `nested_array_memory_to_storage.sol`.

The focused suite is **692/692** and the full corpus finishes at **4547/4876**, 329 failed, with NEG-ACCEPTED
unchanged at 904.

### Continued bench/fix loop: 4547 -> 4548 (+1, NEG-ACCEPTED 904 -> 903)

- **Recursive fixed-array widening (+1)**: fixed state-array copies now recursively reshape nested rows, apply
  only Solidity-legal implicit leaf conversions (including integer and fixed-bytes widening), and zero-fill
  missing elements at every dimension. Restricting the leaf conversion to widening also restores rejection of
  a previously accepted solc-negative narrowing fixture. This compiles
  `array_copy_storage_storage_different_base_nested.sol`.

The focused suite is **693/693** and the full corpus finishes at **4548/4876**, 328 failed, with NEG-ACCEPTED
at 903.

### Continued bench/fix loop: 4548 -> 4549 (+1, NEG-ACCEPTED flat 903)

- **Nested dynamic-array push widening (+1)**: pushing a narrower dynamic state array into a nested dynamic
  state array now materializes an exact-typed memory row, widens each element in a bounded runtime loop, and
  pushes the converted row. This compiles `static_array_implicit_push_3.sol`.

The focused suite is **694/694** and the full corpus finishes at **4549/4876**, 327 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4549 -> 4550 (+1, NEG-ACCEPTED flat 903)

- **Returns through stacked loop modifiers (+1)**: break/continue lowering now detects synthesized breaks inside
  modifier-inserted lexical blocks, preserves those scopes, and guards the loop tail with the break flag.
  Modifier-origin bare returns are tagged and accepted independently of the decorated function's return tuple,
  preserving the value produced by the placeholder continuation. This compiles
  `stacked_return_with_modifiers.sol`.

The focused suite is **695/695** and the full corpus finishes at **4550/4876**, 326 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4550 -> 4551 (+1, NEG-ACCEPTED flat 903)

- **Discarded payable-address method references (+1)**: bare `.transfer` and `.send` members now behave as
  discarded Solidity function values. Their receiver expression is still evaluated, but no transfer is invoked
  and the member is not misresolved as a struct field. This compiles `uncalled_address_transfer_send.sol`.

The focused suite is **696/696** and the full corpus finishes at **4551/4876**, 325 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4551 -> 4552 (+1, NEG-ACCEPTED flat 903)

- **UDVT operator overloads on state operands (+1)**: pre-typecheck operator resolution now obtains the declared
  user-defined value type from a resolved state access, just as it already did for locals and parameters. Global
  overloads such as `using {add as +} for U8 global` therefore rewrite `stateU8 + rhs` to the registered pure
  helper before ordinary arithmetic type checking. This compiles `user_defined_overflow.sol`.

The focused suite is **697/697** and the full corpus finishes at **4552/4876**, 324 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4552 -> 4555 (+3, NEG-ACCEPTED 903 -> 904)

- **Declaring-base-qualified inherited state (+3)**: after inheritance expansion, `Base.slot` now resolves from
  the inherited slot's `inheritedFrom` provenance. The qualifier must be the contract that declared the slot;
  `Child.inheritedSlot` and unrelated namespaces remain rejected. This compiles
  `constructor_hierarchy_same_var.sol`, `069_base_class_state_variable_accessor.sol`, and
  `071_base_class_state_variable_internal_member.sol`. One view/pure-checker fixture advances to acceptance
  because its independent mutability diagnostic is not yet enforced.

The focused suite is **699/699** and the full corpus finishes at **4555/4876**, 321 failed, with NEG-ACCEPTED
at 904.

### Continued bench/fix loop: 4555 -> 4556 (+1, NEG-ACCEPTED 904 -> 905)

- **Discarded contract fixed-array type expressions (+1)**: a declared contract metatype followed by a literal
  array bound (`C[0];`) is now recognized in either parser representation and dropped as Solidity's no-effect
  type expression. Unknown runtime bases retain their undefined-reference diagnostic, and library metatypes are
  excluded from this lowering. This compiles `contract_index_access.sol`; one additional solc-negative fixture
  reaches acceptance and remains tracked diagnostically.

The focused suite is **700/700** and the full corpus finishes at **4556/4876**, 320 failed, with NEG-ACCEPTED
at 905.

### Continued bench/fix loop: 4556 -> 4558 (+2, NEG-ACCEPTED flat 905)

- **Discarded contract metatype references (+2)**: bare current and sibling contract names used as expression
  statements are now dropped as Solidity no-effect metatype references. A runtime symbol with the same spelling
  still wins normal lexical resolution, and unknown names retain their diagnostic. This compiles
  `001_name_references.sol` and `circular_reference_mention_only.sol`.

The focused suite is **701/701** and the full corpus finishes at **4558/4876**, 318 failed, with NEG-ACCEPTED
unchanged at 905.

### Continued bench/fix loop: 4558 -> 4559 (+1, NEG-ACCEPTED flat 905)

- **Sibling-contract-qualified enum members (+1)**: enum definitions from sibling/imported contracts are now
  registered under their declaring namespace, so types and values such as `Interface.MyEnum.One` resolve in
  another contract. The bare alias is withheld when the selected contract already owns or inherits an enum of
  the same name, preserving Solidity's distinct contract scopes. This compiles
  `125_enum_member_access_accross_contracts.sol`.

The focused suite is **702/702** and the full corpus finishes at **4559/4876**, 317 failed, with NEG-ACCEPTED
unchanged at 905.

### Continued bench/fix loop: 4559 -> 4559 (+0 prerequisite, NEG-ACCEPTED flat 905)

- **Discarded contract-qualified struct array types**: fixed-array metatype expressions such as `C.S[10];`
  now follow the same no-effect lowering as `C[0];`, while a runtime local shadowing the type name remains an
  ordinary indexed expression. This clears the reported `S` symbol failure in
  `250_member_access_parser_ambiguity.sol`; that fixture now reaches its independent unsupported nested
  struct-array state-layout operation.

The focused suite is **703/703** and the full corpus remains **4559/4876**, 317 failed, with NEG-ACCEPTED
unchanged at 905.

### Continued bench/fix loop: 4559 -> 4561 (+2, NEG-ACCEPTED flat 905)

- **Inherited storage-alias tuple lvalues (+2)**: complex tuple targets such as `(tx.executed,)`, where `tx`
  aliases a struct entry inherited from an imported base contract, are now recognized even though `tx` overlaps
  the transaction-introspection namespace. When early import resolution cannot yet provide the struct field
  type, the fixed `(bool, bytes)` return ABI of a low-level `.call` supplies the tuple target types without
  guessing the inherited layout. This compiles `MultiSigWalletWithDailyLimit.sol` and
  `MultiSigWalletWithDailyLimitFactory.sol`.

The focused suite is **704/704** and the full corpus finishes at **4561/4876**, 315 failed, with NEG-ACCEPTED
unchanged at 905.

### Continued bench/fix loop: 4561 -> 4562 (+1, NEG-ACCEPTED flat 905)

- **Nested tuple targets after a plain first slot (+1)**: the grammar's nested-assignment lookahead now detects
  a nested tuple at any outer slot boundary, not only when the whole left side begins with `((`. It remains
  restricted to slot boundaries, so parentheses inside indexed or called lvalues do not steal ordinary tuple
  assignments. This compiles `tuple_assign_multi_slot_grow.sol` and its
  `(a, (b, c)) = ("0", ("1", "2"))` assignment.

The focused suite is **705/705** and the full corpus finishes at **4562/4876**, 314 failed, with NEG-ACCEPTED
unchanged at 905.

### Continued bench/fix loop: 4562 -> 4564 (+2, NEG-ACCEPTED flat 905)

- **Parenthesized discarded tuple expressions (+2)**: expression-statement lowering now unwraps redundant
  parentheses before recognizing a tuple value, evaluates each ordinary component, and discards the results.
  This preserves the existing tuple-statement semantics while accepting Solidity forms such as `(("", 2));`.
  This compiles `tuple_single_element_1.sol` and `tuple_single_element_2.sol`.

The focused suite is **706/706** and the full corpus finishes at **4564/4876**, 312 failed, with NEG-ACCEPTED
unchanged at 905.

### Continued bench/fix loop: 4564 -> 4565 (+1, NEG-ACCEPTED flat 905)

- **Parenthesized explicit tuple assignment RHS (+1)**: a tuple value hidden under redundant parentheses is now
  exposed to the ordinary parallel destructuring path, while calls that return tuples remain single RHS
  expressions. This compiles `tuple_different_count_assignment_1.sol`, including
  `(,, a) = (((1, 3, ((2)))));`.

The focused suite is **707/707** and the full corpus finishes at **4565/4876**, 311 failed, with NEG-ACCEPTED
unchanged at 905.

### Continued bench/fix loop: 4565 -> 4566 (+1, NEG-ACCEPTED flat 905)

- **Contextual overloaded internal function references (+1)**: assigning a bare overloaded function name to an
  internal function-pointer variable now selects the unique overload matching the destination's parameter and
  return types. External-only candidates are excluded, and compiler-generated return-routing parameters are
  omitted from structural matching. This compiles `valid_lvalues.sol` without regressing
  `conditional_expression_functions.sol`.

The focused suite is **709/709** and the full corpus finishes at **4566/4876**, 310 failed, with NEG-ACCEPTED
unchanged at 905.

### Continued bench/fix loop: 4566 -> 4567 (+1, NEG-ACCEPTED flat 905)

- **Lexical function-pointer shadowing (+1)**: calls through a function-pointer parameter now take precedence
  over a same-named contract function. The exceptional resolution is marked explicitly on the call, keeping
  ordinary contract functions and state-backed function pointers on their existing paths. This compiles
  `function_type_to_function_type_internal.sol` without regressing the corpus's function-pointer cases.

The focused suite is **710/710** and the full corpus finishes at **4567/4876**, 309 failed, with NEG-ACCEPTED
unchanged at 905.

### Continued bench/fix loop: 4567 -> 4569 (+2, NEG-ACCEPTED flat 905)

- **Parallel whole-storage-pointer rebinding (+2)**: tuple assignment now rebinds both whole-mapping and
  whole-struct storage-pointer locals from a snapshot of the old aliases. This preserves parallel swap
  semantics while leaving ordinary state-value tuple assignments on their existing copy path. It compiles
  `nowarn_swap_storage_pointers.sol` and `assignment_local.sol`.

The focused suite is **711/711** and the full corpus finishes at **4569/4876**, 307 failed, with NEG-ACCEPTED
unchanged at 905.

### Continued bench/fix loop: 4569 -> 4570 (+1, NEG-ACCEPTED 905 -> 903)

- **Inherited constructor function-pointer callees (+1)**: constructor-argument substitution now rewrites a
  function-pointer parameter used as the callee itself, including a qualified reference such as `C.f`. The
  pre-lowering validation pass also enforces that immutable writes originate directly in a constructor before
  inlining can erase the helper boundary. This compiles `function_pointer_reading.sol`, rejects its
  `function_pointer_initializing.sol` negative twin, and restores two additional immutable diagnostics.

The focused suite is **713/713** and the full corpus finishes at **4570/4876**, 306 failed, with NEG-ACCEPTED
improved from 905 to 903.

### Continued bench/fix loop: 4570 -> 4571 (+1, NEG-ACCEPTED flat 903)

- **Exact rational constants with negative exponents (+1)**: literal-only rational arithmetic is now evaluated
  exactly before integer code generation when a negative power produces an integral result. This preserves the
  rational intermediate in `(-1 / 2) ** -1`, folds it to `-2`, and leaves non-integral or dynamic negative
  powers on the existing rejection path. This compiles `rational_negative_numerator_negative_exp.sol`.

The focused suite is **714/714** and the full corpus finishes at **4571/4876**, 305 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4571 -> 4573 (+2, NEG-ACCEPTED flat 903)

- **Declaration-order-independent constant dependencies (+2)**: constants in a scope are now predeclared before
  validation, and referenced initializers are recursively checked with both cycle detection and Solidity's
  bounded dependency depth. This accepts acyclic forward arithmetic/hash and long contract-typed chains while
  retaining genuine-cycle and validator-exhaustion rejection. It compiles
  `constant_with_cyclic_dependency_4.sol` and `cyclic_dependency_check_on_consts_good.sol`.

The focused suite is **716/716** and the full corpus finishes at **4573/4876**, 303 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4573 -> 4575 (+2, NEG-ACCEPTED flat 903)

- **Event-only reserved-name exceptions (+2)**: the grammar now accepts Solidity's narrow event declaration
  exceptions for `this`, `super`, and `_` without adding them to the general identifier rule. Their reserved or
  special behavior elsewhere remains unchanged. This compiles `illegal_names_exception.sol` and
  `illegal_names_exception_file_level.sol`.

The focused suite is **717/717** and the full corpus finishes at **4575/4876**, 301 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4575 -> 4578 (+3, NEG-ACCEPTED flat 903)

- **Explicit array-pointer casts (+3)**: cast syntax now accepts array types such as `uint[](c)` through the
  same cast path as scalar types, including contextual bare `uint`, while writable byte casts retain their
  lvalue handling. This compiles `not_allowed_conversion_to_int_array_pointer1.sol`,
  `not_allowed_conversion_to_int_array_pointer2.sol`, and one additional corpus cast form exposed by the
  unified grammar.

The focused suite is **718/718** and the full corpus finishes at **4578/4876**, 298 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4578 -> 4579 (+1, NEG-ACCEPTED flat 903)

- **Incomplete function-layout parser recovery (+1)**: Solidity import compatibility now blanks the exact
  no-expression `function ... layout at {` recovery shape while retaining source positions. Ordinary custom
  modifiers, modifier calls, and contract-level storage-layout clauses are unaffected. This compiles
  `function_declaration_layout_with_no_expression.sol`.

The focused suite is **719/719** and the full corpus finishes at **4579/4876**, 297 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4579 -> 4580 (+1, NEG-ACCEPTED flat 903)

- **Exact no-dot scientific rationals in integer constants (+1)**: a literal such as `500e-3` is now retained
  as an exact decimal rational instead of being rejected as a non-integer token. A literal-only integer
  constant expression is folded only when that fractional intermediate produces an integral final value,
  preserving existing integer-only constant code generation. This compiles
  `constant_initialized_with_unlimited_arithmetic_expression.sol`.

The focused suite is **720/720** and the full corpus finishes at **4580/4876**, 296 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4580 -> 4582 (+2, NEG-ACCEPTED flat 903)

- **State-variable initializer assignment chains (+2)**: scalar state and immutable declarations now accept
  Solidity's right-associative initializer assignments. Inner writes are retained as constructor prelude
  statements and execute immediately before the outer variable initialization, reusing the existing assignment
  chain semantics rather than dropping side effects. This compiles `variable_declaration_value.sol` and
  `variable_declaration_already.sol`.

The focused suite is **721/721** and the full corpus finishes at **4582/4876**, 294 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4582 -> 4585 (+3, NEG-ACCEPTED flat 903)

- **Assignment expressions in base-constructor arguments (+3)**: a direct or contract-qualified state write in
  a parent invocation is now evaluated as a constructor prelude, then the assigned slot is read as the argument
  value used for base-constructor substitution. Complex/chained lvalues remain rejected. This compiles
  `inheritance_ctor_inherit_specifier_argument_init.sol`, `init_in_inheritance_specifier_param.sol`, and
  `multiple_initializations.sol`.

The focused suite is **722/722** and the full corpus finishes at **4585/4876**, 291 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4585 -> 4587 (+2, NEG-ACCEPTED flat 903)

- **Fixed local external-function-pointer arrays and indexed ABI selectors (+2)**: local declarations now parse
  fixed arrays whose element is a function type. Straight-line indexed assignments retain their proven method,
  allowing `abi.encodeCall(callbacks[i], ...)`, scalar aliases initialized from a known element, and the alias's
  `.selector` to resolve without replacing the runtime pointer value. Reassigned aliases remain non-foldable.
  This compiles `abi_encode_call_memory_v2.sol` plus an additional corpus function-array declaration/use.

The focused suite is **723/723** and the full corpus finishes at **4587/4876**, 289 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4587 -> 4588 (+1, NEG-ACCEPTED flat 903)

- **Call options on indexed function-pointer calls (+1)**: indexed calls now parse and retain `{value: ...}` /
  `{gas: ...}` expressions on the indirect-call AST. Type checking visits the option expressions, and both the
  fixed-method and received-selector foreign-array lowerings propagate them to the resulting external method
  call. This compiles `inline_array_with_value_call_option.sol`.

The focused suite is **724/724** and the full corpus finishes at **4588/4876**, 288 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4588 -> 4589 (+1, NEG-ACCEPTED flat 903)

- **Standalone libraries with generic storage-pointer entry points (+1)**: public library functions whose ABI
  depends on an unknown caller `storage` layout remain available for import/inlining but are excluded from the
  standalone BCH executable. When no layout-independent entry point remains, direct compilation emits the
  existing ABI-only declaration artifact. This compiles `library_argument_storage.sol` without inventing an
  unsafe concrete mapping layout.

The focused suite is **725/725** and the full corpus finishes at **4589/4876**, 287 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4589 -> 4590 (+1, NEG-ACCEPTED 903 -> 904)

- **Returning a no-argument state-array push (+1)**: `return array.push()` now appends the element type's
  default value and returns that same value, matching Solidity's fresh storage-element semantics for scalar
  arrays while preserving the existing state-array write lowering. This compiles
  `viewPureChecker/array/access_to_array_push.sol`.

The focused suite is **726/726** and the full corpus finishes at **4590/4876**, 286 failed, with NEG-ACCEPTED
at 904.

### Continued bench/fix loop: 4590 -> 4591 (+1, NEG-ACCEPTED flat 904)

- **Deleting freshly pushed array elements (+1)**: `delete array.push()` now retains the append and treats the
  delete of its already-default-initialized result as a no-op. The same lowering handles
  `delete array2d.push().push()` by preserving the fresh outer index for the nested append. This compiles
  `smtCheckerTests/operators/delete_array_push.sol`.

The focused suite is **727/727** and the full corpus finishes at **4591/4876**, 285 failed, with NEG-ACCEPTED
unchanged at 904.

### Continued bench/fix loop: 4591 -> 4592 (+1, NEG-ACCEPTED flat 904)

- **Pushes through nested struct-array element fields (+1)**: a receiver such as `t.rows[i].values.push(v)`
  now resolves the array-valued field to its flattened state collection (`t__rows`) while retaining the element
  index and inner member chain. It then reuses the indexed struct-field read/modify/write lowering. This compiles
  `smtCheckerTests/array_members/push_struct_member_2.sol`.

The focused suite is **727/727** and the full corpus finishes at **4592/4876**, 284 failed, with NEG-ACCEPTED
unchanged at 904.

### Continued bench/fix loop: 4592 -> 4593 (+1, NEG-ACCEPTED flat 904)

- **No-argument pushes on both sides of a struct-field assignment (+1)**:
  `s.items.push() = t.items.push()` now evaluates the RHS append first and then appends the same fresh default
  value on the LHS. Because both no-argument results are already default-initialized, no storage-reference
  read-back is necessary. Nested struct fields use their flattened collection names. This compiles
  `smtCheckerTests/array_members/push_as_lhs_struct.sol`.

The focused suite is **728/728** and the full corpus finishes at **4593/4876**, 283 failed, with NEG-ACCEPTED
unchanged at 904.

### Continued bench/fix loop: 4593 -> 4594 (+1, NEG-ACCEPTED flat 904)

- **Reads through element array storage-pointer aliases (+1)**: indexed reads and unary collection operations
  such as `.length` now substitute an element alias with its recorded storage access path before semantic
  analysis. Thus `uint[] storage row = data[i]` consistently routes `row[j]` and `row.length` through
  `data[i]`, matching the already-supported aliased push/write path. This compiles
  `smtCheckerTests/array_members/push_storage_ref_safe_aliasing.sol`.

The focused suite is **729/729** and the full corpus finishes at **4594/4876**, 282 failed, with NEG-ACCEPTED
unchanged at 904.

### Continued bench/fix loop: 4594 -> 4601 (+7, NEG-ACCEPTED flat 904)

- **Selfdestruct implies stateful covenant mode (+7)**: a Solidity-style `selfdestruct(recipient)` now causes
  master-NFT state layout and covenant generation even when the source contract declares no state variables.
  Stateful classification is consistent across semantic validation, final-require analysis, code generation,
  ABI metadata, and artifact state-layout emission. The recipient must still be `address payable`, preserving
  Solidity's rejection of an implicit nonpayable-to-payable conversion. This compiles seven selfdestruct corpus
  fixtures without a `forceStateful` option while retaining the corresponding negative diagnostic.

The focused suite is **731/731** and the full corpus finishes at **4601/4876**, 275 failed, with NEG-ACCEPTED
unchanged at 904.

### Continued bench/fix loop: 4601 -> 4605 (+4, NEG-ACCEPTED flat 904)

- **Value-bearing deployment implies a stateful parent (+4)**: `new Child{value: amount}()` now marks its parent
  contract stateful even when neither parent nor child declares storage, ensuring the master NFT, value-transfer
  covenant, code-generation layout, and artifact metadata are present. Solidity diagnostics remain intact:
  the child constructor must be payable, and value-bearing deployment is rejected in pure/view functions.
  This compiles four payable-constructor/deployment corpus fixtures while retaining both related negatives.

The focused suite is **733/733** and the full corpus finishes at **4605/4876**, 271 failed, with NEG-ACCEPTED
unchanged at 904.

### Continued bench/fix loop: 4605 -> 4609 (+4, NEG-ACCEPTED flat 904)

- **Stateful child deployment from constructors (+4)**: the parent pre-scan now includes constructor, fallback,
  and receive bodies when detecting `new Child(...)` sites that mint stateful child genesis. Constructor-time
  deployment therefore makes the parent stateful and enables its deploy covenant just like a deployment in an
  ordinary function. Public state-variable getters still may override only external functions, preserving the
  two internal/private override negatives exposed by the broader scan.

The focused suite is **735/735** and the full corpus finishes at **4609/4876**, 267 failed, with NEG-ACCEPTED
unchanged at 904.

### Continued bench/fix loop: 4609 -> 4612 (+3, NEG-ACCEPTED 904 -> 903)

- **Contract-qualified state assignment chains in initializers (+3)**: current-contract and direct-base
  qualifiers are normalized before inline state slots are fully registered, so chains such as
  `uint y = (Base).x = 3` preserve the inner state write and initialize from its assigned value. Qualified
  inherited state reads/writes carry source provenance into semantic analysis, retaining Solidity's pure-read
  and view-write diagnostics without confusing base constants, enums, or function references.

The focused suite is **737/737** and the full corpus finishes at **4612/4876**, 264 failed, with NEG-ACCEPTED
improved to 903.

### Continued bench/fix loop: 4612 -> 4613 (+1, NEG-ACCEPTED flat 903)

- **Current-contract-qualified state deletion (+1)**: `delete C.x` now resolves `C` as the current-contract
  qualifier and routes the operation through the same state reset lowering as `delete this.x`. This compiles
  `smtCheckerTests/operators/assignment_contract_member_variable.sol` while retaining bytecode equivalence
  between the qualified and `this` forms.

The focused suite is **738/738** and the full corpus finishes at **4613/4876**, 263 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4613 -> 4614 (+1, NEG-ACCEPTED flat 903)

- **Returning internal helpers with mapping storage parameters (+1)**: internal/private helpers that accept a
  `mapping(...) storage` reference and return a value are now hoisted into their contract call sites, substituting
  the compile-time mapping pointer before semantic analysis. This supports read/modify/write helpers such as
  `old = set_internal(a, key, value)` without attempting to encode the mapping itself on the stack. Eligibility is
  intentionally scoped away from public and library dispatch paths, preserving their existing alias semantics.

The focused suite is **739/739** and the full corpus finishes at **4614/4876**, 262 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4614 -> 4620 (+6, NEG-ACCEPTED flat 903)

- **Numeric nested-mapping reads (+6)**: nested numeric bracket chains parsed as tuple-index expressions are now
  flattened according to the declared mapping depth before semantic analysis. Thus `m[13][14]` and
  `m[13][14][15]` resolve as multi-key mapping reads rather than indexing an already-resolved scalar. A trailing
  index on `mapping(K => T[])` remains the array-value index, and fixed state arrays retain their existing path.

The focused suite is **740/740** and the full corpus finishes at **4620/4876**, 256 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4620 -> 4621 (+1, NEG-ACCEPTED flat 903)

- **Bare Cancun `blobhash` references (+1)**: an uncalled `blobhash;` expression is now discarded as Solidity's
  no-effect builtin reference while `blobhash(i)` remains a typed call. Solidity corpus trailers requesting
  `EVMVersion: <=shanghai` explicitly hide the builtin in import-compat mode, retaining the undeclared-identifier
  diagnostic without preventing a same-named user variable.

The focused suite is **742/742** and the full corpus finishes at **4621/4876**, 255 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4621 -> 4624 (+3, NEG-ACCEPTED flat 903)

- **Flattened struct array deletion and collection-backed Yul slots (+3)**: deleting an array leaf such as
  `delete s.x` now resets the flattened `s__x` collection rather than attempting to rebuild it as a scalar struct
  field. Dynamic-array storage aliases pointing at collection-backed leaves now resolve `.slot` through the EVM
  storage layout, enabling the same `sload`/`sstore` length-slot behavior as direct state arrays.

The focused suite is **743/743** and the full corpus finishes at **4624/4876**, 252 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4624 -> 4625 (+1, NEG-ACCEPTED flat 903)

- **Yul external function-pointer selector reads (+1)**: `fp.selector` inside inline assembly now reuses the
  established high-level external-function member resolver and converts the bytes4 selector to Yul's right-aligned
  uint256 word. Pointer component mutation remains fail-closed until the runtime pair can be reconstructed soundly.

The focused suite is **744/744** and the full corpus finishes at **4625/4876**, 251 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4625 -> 4628 (+3, NEG-ACCEPTED flat 903)

- **Yul slots through erased storage-pointer aliases (+3)**: direct whole-state mapping and struct pointer
  declarations now retain compile-time alias metadata on their function after the runtime declaration is erased.
  Inline assembly uses that metadata to resolve `.slot`/`.offset`, including packed scalar slots, composite struct
  sub-slots, and mapping layout slots, while ordinary high-level pointer substitution remains unchanged.

The focused suite is **745/745** and the full corpus finishes at **4628/4876**, 248 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4628 -> 4633 (+5, NEG-ACCEPTED flat 903)

- **Separate Yul transient-state layout (+5)**: transient variables now receive their own EIP-1153 slot space,
  packed independently from persistent storage. Yul `.slot`/`.offset`, `tload`, and `tstore` bind back to the
  per-function transient locals, with values cleaned to the declared bounded type before reads are exposed as
  uint256 words.

The focused suite is **746/746** and the full corpus finishes at **4633/4876**, 243 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4633 -> 4634 (+1, NEG-ACCEPTED flat 903)

- **Dynamic Yul `byte(index, word)` (+1)**: non-constant byte indices now lower to a guarded big-endian word
  extraction equivalent to the EVM opcode, returning zero for indices outside the 32-byte word. The existing
  optimized literal-index byte-slice path remains unchanged.

The focused suite is **747/747** and the full corpus finishes at **4634/4876**, 242 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4634 -> 4636 (+2, NEG-ACCEPTED flat 903)

- **EVM base slots for flattened state structs (+2)**: storage layout now assigns each erased struct prefix
  (including nested prefixes) the minimum slot occupied by its flattened leaves. Inline assembly can therefore
  use `s.slot` consistently with member `sload`/`sstore` operations even when the first physical leaf is a
  collection, without inventing an extra standalone struct slot.

The focused suite is **748/748** and the full corpus finishes at **4636/4876**, 240 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4636 -> 4637 (+1, NEG-ACCEPTED flat 903)

- **Yul address reads from erased foreign function pointers (+1)**: fixed foreign pointer aliases now retain
  their original member expression as compile-time function metadata when the runtime declaration is removed.
  Inline assembly resolves `fp.address` directly to that receiver address, preserving the established direct-call
  lowering without materializing an unsupported two-word EVM pointer local.

The focused suite is **749/749** and the full corpus finishes at **4637/4876**, 239 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4637 -> 4640 (+3, NEG-ACCEPTED flat 903)

- **Named storage returns initialized through Yul slots (+3)**: the canonical
  `result.slot := state.slot` form now lowers to the existing high-level storage-pointer return instead of
  exposing raw EVM slot integers to BCH codegen. Direct and guaranteed-control-flow forms compile; assignments
  occurring only in a Yul loop body or post-step remain fail-closed because they do not definitely initialize the
  return pointer on every path.

The focused suite is **751/751** and the full corpus finishes at **4640/4876**, 236 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4640 -> 4641 (+1, NEG-ACCEPTED flat 903)

- **Definite Yul switch initialization of storage returns (+1)**: an exhaustive switch whose default and every
  case either assign the same named storage-return pointer or unconditionally revert now lowers to guarded aborts
  followed by one high-level pointer return. Missing-default switches remain unsupported because they can leave
  the pointer uninitialized.

The focused suite is **753/753** and the full corpus finishes at **4641/4876**, 235 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4641 -> 4642 (+1, NEG-ACCEPTED flat 903)

- **Assembly-defined named calldata return views (+1)**: a dynamic named `calldata` return whose Yul block assigns
  both `.offset` and `.length` now materializes the corresponding slice of synthesized EVM calldata immediately
  before its implicit or explicit tail return. Functions with intervening high-level reads remain unsupported
  until those reads can observe the mutable view consistently.

The focused suite is **756/756** and the full corpus finishes at **4642/4876**, 234 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4642 -> 4646 (+4, NEG-ACCEPTED flat 903)

- **Definite Yul initialization of local storage pointers (+4)**: uninitialized local `storage` declarations now
  recover a compile-time alias from direct `.slot` assignment, a for-loop initializer, or an exhaustive switch
  whose successful arms select the same state target. The declaration and raw slot assignment are erased and all
  later high-level uses are substituted with the state target. Conditional, loop-body/post, and missing-default
  initialization remain unsupported.

The focused suite is **759/759** and the full corpus finishes at **4646/4876**, 230 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4646 -> 4647 (+1, NEG-ACCEPTED flat 903)

- **Mutable Yul selector component on self function pointers (+1)**: erased self-pointer declarations now retain
  their aliased method name. A Yul `fp.selector := value` writes a dedicated uint256 selector component initialized
  from that method's compile-time selector, and later assembly or high-level `fp.selector` reads observe the
  mutation. Address-component mutation remains unsupported.

The focused suite is **760/760** and the full corpus finishes at **4647/4876**, 229 failed, with NEG-ACCEPTED
unchanged at 903.

### Bench classification correction: 4647/4876 -> 4647/4874 (NEG-ACCEPTED flat 903)

- **Whitespace-tolerant negative trailers**: two historical Solidity fixtures spell their expected diagnostic as
  `//  TypeError ...` with an extra space. The bench now recognizes arbitrary whitespace after the comment marker,
  moving both deliberately invalid and correctly rejected fixtures out of the positive denominator.

The corrected corpus baseline is **4647/4874**, 227 failed, with 2192 negative-skipped and NEG-ACCEPTED unchanged
at 903.

### Continued bench/fix loop: 4647 -> 4648 (+1, NEG-ACCEPTED flat 903)

- **Inside-out nested local Yul function inlining (+1)**: nested leaf definitions are now simplified within their
  parent function body before the parent is checked and inlined. This supports nested, non-recursive call graphs
  and multi-return bindings while genuine self/mutual recursion remains unsupported.

The focused suite is **762/762** and the full corpus finishes at **4648/4874**, 226 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4648 -> 4649 (+1, NEG-ACCEPTED flat 903)

- **For-initialized named storage returns (+1)**: named `storage` returns now participate in the same recovered
  alias analysis as local pointers. A `.slot` assignment in a Yul for-loop initializer becomes the function's
  compile-time return target, eliminating the phantom EVM pointer stack variable; loop-body/post assignments
  remain non-definite and unsupported.

The focused suite is **763/763** and the full corpus finishes at **4649/4874**, 225 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4649 -> 4650 (+1, NEG-ACCEPTED flat 903)

- **Mutable Yul address components on external function pointers (+1)**: external function values now retain a
  dedicated address word alongside the selector word. Yul `.address` assignments and reads, plus later high-level
  `.address` reads, observe that component; self and fixed-foreign aliases initialize it from their known receiver,
  while uninitialized pointers start at zero.

The focused suite is **764/764** and the full corpus finishes at **4650/4874**, 224 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4650 -> 4651 (+1, NEG-ACCEPTED flat 903)

- **Address-typed Yul function-pointer mutation (+1)**: assigning a Solidity `address` local to an external
  function pointer's Yul `.address` component now crosses the typed-AST boundary through an explicit `uint256`
  word cast. The mutable component still round-trips through the dedicated address word added in the prior step.

The focused suite is **765/765** and the full corpus finishes at **4651/4874**, 223 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4651 -> 4653 (+2, NEG-ACCEPTED flat 903)

- **Tuple-assignment targets returned by storage `push()` (+2)**: tuple lvalue patterns now accept `.push()` and
  lower the assigned component to an append of the contextually converted element. Flat and nested patterns,
  indexed sibling targets, whole-array/bytes storage aliases, packed arrays, and dynamic `bytes` are covered.
  Array/bytes pointer declarations remain present so Yul `.slot`/`.offset` reads retain their storage view.

The focused suite is **767/767** and the full corpus finishes at **4653/4874**, 221 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4653 -> 4655 (+2, NEG-ACCEPTED flat 903)

- **Type-aware same-arity storage-helper overload selection (+2)**: returning helper inlining now first filters
  overloads to bodies the pass can actually reduce, then uses known state-variable and current-parameter types to
  distinguish otherwise identical name/arity candidates. This selects the `uint` using-for overload over a
  `bytes32` sibling while genuinely indistinguishable overloads remain fail-closed.

The focused suite is **768/768** and the full corpus finishes at **4655/4874**, 219 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4655 -> 4660 (+5, NEG-ACCEPTED flat 903)

- **UDVT dynamic state arrays and whole-array copies (+5)**: chunk-layout classification and fixed-width sizing
  now unwrap user-defined value types. Same-type UDVT array assignments from calldata or memory lower through the
  existing delete/push/cache pipeline, covering integer-, fixed-bytes-, and address-backed UDVT elements while
  leaving ordinary array tuple/write lowering unchanged.

The focused suite is **770/770** and the full corpus finishes at **4660/4874**, 214 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4660 -> 4666 (+6, NEG-ACCEPTED flat 903)

- **Constructor-time state-struct external receivers (+6)**: external calls through interface/contract fields in
  state structs, nested structs, and state struct arrays are now captured immediately before the constructor
  statement that performs the call. This preserves initialization order (the receiver may have been assigned by
  an earlier constructor statement) while reusing the existing pinned external-address dispatch. Ordinary
  functions retain their deduplicated body-top capture.

The focused suite is **771/771** and the full corpus finishes at **4666/4874**, 208 failed, with NEG-ACCEPTED
unchanged at 903.

### Continued bench/fix loop: 4666 -> 4668 (+2)

- **External calls inside global UDVT operator implementations (+2)**: binary and unary operator calls whose
  pure file-level implementation invokes an interface through another pure helper result are now pre-lowered
  before semantic operator rewriting. The returning-helper inliner moves the implementation into the entry point,
  and the computed receiver is captured at that call site for the existing external-call covenant.
- The rewrite is provenance-tagged and limited to this operator/helper shape; unrelated computed receivers remain
  rejected. Retained operator declaration checks are performed before the consumed helper/binding is removed.

The focused suite is **772/772** and the full corpus finishes at **4668/4874**, 206 failed. The current
NEG-ACCEPTED diagnostic is 906.

### Continued bench/fix loop: 4668 -> 4671 (+3, NEG-ACCEPTED flat 906)

- **Constructor void calls vs deploy-time getter reads (+2)**: constructor external-read promotion now requires
  the referenced method to declare exactly one return value. A zero-argument `void` call such as `child.f()` is
  retained as a call rather than replaced with a meaningless deploy-input identifier, covering aggregate-contract
  event fixtures after `child = new Child()`.
- **Contract-state receiver assigned during construction (+1)**: a namespaced call on a contract-typed state
  variable is captured immediately at its constructor call site. This reads the value after its preceding
  assignment (for example `peer = other; peer.f()`), keeps it live for the external-call covenant, and avoids the
  incorrect ordinary-function body-top capture.

The focused suite is **774/774** and the full corpus finishes at **4671/4874**, 203 failed, with NEG-ACCEPTED
unchanged at 906.

### Continued bench/fix loop: 4671 -> 4672 (+1, NEG-ACCEPTED flat 906)

- **Public struct getter with an external-function member (+1)**: synthesized Solidity getters now retain
  contract-address and external-function fields in their ABI tuple. The generated return is explicitly marked
  as the narrow storage-representation bridge, allowing the lowered selector/address bytes blob to satisfy that
  function-typed ABI position without relaxing ordinary user-authored return checking.

The focused suite is **775/775** and the full corpus finishes at **4672/4874**, 202 failed, with NEG-ACCEPTED
unchanged at 906.

### Continued bench/fix loop: 4672 -> 4673 (+1, NEG-ACCEPTED flat 906)

- **Stored function pointer vs same-named public getter (+1)**: a public external-function state variable and its
  synthesized getter intentionally share a name. `this.g()` remains a getter read, while bare `g()` now remains
  an invocation of the stored pointer instead of being beta-reduced to the getter's function-valued return.

The focused suite is **776/776** and the full corpus finishes at **4673/4874**, 201 failed, with NEG-ACCEPTED
unchanged at 906.

### Continued bench/fix loop: 4673 -> 4676 (+3, NEG-ACCEPTED flat 906)

- **Public getters retained across dynamic-field struct flattening (+3)**: AstBuilder now preserves the original
  public struct getter specification when a dynamic array or mapping forces the state value into
  `root__field` leaves. Getter synthesis reconstructs every exact ABI-visible value leaf (including nested value
  structs) while continuing to omit array/mapping members, matching Solidity's generated signature.

The focused suite is **777/777** and the full corpus finishes at **4676/4874**, 198 failed, with NEG-ACCEPTED
unchanged at 906.

### Continued bench/fix loop: 4676 -> 4677 (+1, NEG-ACCEPTED flat 906)

- **Storage struct reference returned by no-argument array push (+1)**: a no-argument `S[]` push now captures
  the pre-push length, appends the default struct without materializing an unrelated local value, and aliases
  `S storage s` to the new element. The same expression bridge permits `array.push()` directly in a call
  argument, while bare storage aliases passed to internal helpers are substituted with their concrete access.

The focused suite is **778/778** and the full corpus finishes at **4677/4874**, 197 failed, with NEG-ACCEPTED
unchanged at 906.

### Continued bench/fix loop: 4677 -> 4679 (+2, NEG-ACCEPTED flat 906)

- **Fixed arrays containing mappings (+2)**: collection metadata now retains the full
  `(arrayIndex, mappingKey, ...)` key path for an array-rooted mixed container, while preserving the existing
  mapping-to-array value-blob model. Returning internal helpers with fixed-array storage pointers inline like
  mapping-pointer helpers, numeric literal indices remain part of the same collection access, and `.length`
  folds to the fixed bound without inventing runtime length state.
- **Nested-array desugaring guard**: an array whose element is a mapping is no longer mistaken for a nested
  value array and materialized into an impossible local mapping value.

The focused suite is **780/780** and the full corpus finishes at **4679/4874**, 195 failed, with NEG-ACCEPTED
unchanged at 906.

### Continued bench/fix loop: 4679 -> 4682 (+3, NEG-ACCEPTED flat 906)

- **Mapping pointers into fixed-array collections (+3)**: internal storage-pointer inlining now captures the
  complete root/prefix path for arguments such as `maps[x]` and `maps[x][0]`. Reads through the pointer rebuild
  that concrete access; writes become mapping assignments with the captured keys prepended.
- **All-literal mixed-key reads**: numeric-only chains such as `maps[0][0]` no longer reach tuple extraction
  after the first scalar leaf. A complete fixed-array/mapping key path is routed directly to the collection,
  while partial paths remain storage references rather than fabricated values.

The focused suite is **781/781** and the full corpus finishes at **4682/4874**, 192 failed, with NEG-ACCEPTED
unchanged at 906.

### Continued bench/fix loop: 4682 -> 4683 (+1, NEG-ACCEPTED flat 906)

- **No-argument pushes into mapping-held struct arrays (+1)**: mapping array defaults are now synthesized
  during symbol resolution, matching ordinary state arrays. Struct defaults therefore pass through constructor
  resolution before type checking instead of reaching code generation as an unresolved global-function call.
- **Invalid-instruction diagnostic**: code generation now reports an undefined emitted instruction at its
  source line instead of crashing later inside bytecode serialization.

The focused suite is **782/782** and the full corpus finishes at **4683/4874**, 191 failed, with NEG-ACCEPTED
unchanged at 906.

### Continued bench/fix loop: 4683 -> 4688 (+5, NEG-ACCEPTED flat 906)

- **Typed mapping keys through library storage pointers (+5)**: void library helpers taking mapping or array
  `storage` parameters now inline through the same compile-time alias path as struct storage pointers. Their
  indexed reads/writes therefore retain the caller collection's declared contract, enum, or user-defined value
  key type instead of being misclassified as local array operations requiring an integer index.
- This closes the contract-key and both enum-key library fixtures, plus related typed/overloaded mapping-storage
  helper cases, while preserving value-returning storage-pointer inlining.

The focused suite is **783/783** and the full corpus finishes at **4688/4874**, 186 failed, with NEG-ACCEPTED
unchanged at 906.

### Continued bench/fix loop: 4688 -> 4689 (+1, NEG-ACCEPTED flat 906)

- **Inherited constructor assertions (+1)**: parent-constructor argument substitution now traverses `assert`
  conditions just as it already traversed `require` conditions. A cloned constructor such as
  `B(int b) { assert(x == b); }`, invoked as `B(-c)`, no longer retains an undefined `b` reference after
  inheritance flattening.

The focused suite is **784/784** and the full corpus finishes at **4689/4874**, 185 failed, with NEG-ACCEPTED
unchanged at 906.

### Continued bench/fix loop: 4689 -> 4691 (+2, NEG-ACCEPTED flat 906)

- **Flattened library struct pointers into mapping entries (+2)**: a library `Struct storage` parameter bound to
  `data[key]` now propagates that root and key through flattened scalar and dynamic-array field operations.
  The inference is limited to library helpers whose referenced flattened fields all exist in the caller layout,
  avoiding false aliases for ordinary internal struct-pointer helpers.
- **Invariant literal-key array-entry caching**: repeated/looped mutations of a primitive array stored at a
  literal mapping key (for example `data["abc"].items.push()`) are cached locally and flushed as one C2 update.
  Struct-element arrays retain their specialized lowering and are deliberately excluded from this cache path.

The focused suite is **785/785** and the full corpus finishes at **4691/4874**, 183 failed, with NEG-ACCEPTED
unchanged at 906.

### Continued bench/fix loop: 4691 -> 4692 (+1, NEG-ACCEPTED flat 906)

- **Mapping-entry reads in try success blocks (+1)**: entry-access collection and slot-index stamping now descend
  into `TryCatchNode.tryBlock`, matching code generation (which compiles the success path and treats catches as
  unreachable on BCH). Mapping reads in assertions or other expressions inside that path therefore receive their
  authenticated block-layout slot rather than reaching sorted codegen with index `-1`.

The focused suite is **786/786** and the full corpus finishes at **4692/4874**, 182 failed, with NEG-ACCEPTED
unchanged at 906.

### Bench taxonomy correction: 4422/4587 language-positive scope (165 failed)

- **CLI harness fixtures excluded**: all 289 files under `test/cmdlineTests/` now have their own `CMDLINE` bucket.
  They exercise compiler modes and diagnostic presentation (missing imports, stop-after parsing, line truncation,
  standard-json errors), and many deliberately invalid inputs lack semantic-test error trailers. Counting either
  their acceptance or rejection as language parity distorted the denominator.
- The comparable compiler result is unchanged by this re-bucketing: the apparent numerator/denominator change
  removes 270 accepted and 17 rejected CLI inputs from the former 4692/4874 score.
- **Tuple locals in repeated inlining**: tuple-declared locals and subsequent tuple reassignments are now
  alpha-renamed per inlined call site, like ordinary local declarations. This removes cross-call-site variable
  collisions in helpers invoked repeatedly; the focused regression is green, while the motivating large fixture
  now advances to a separate multi-return state-helper inlining gap.

The focused suite is **787/787**. The corrected full corpus finishes at **4422/4587**, 165 failed, with
NEG-ACCEPTED unchanged at 906, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4422 -> 4423 (+1, NEG-ACCEPTED flat 906)

- **Multi-return internal collection helpers (+1)**: internal helpers that touch a declared mapping/collection
  and return through multiple branches now reuse the compiler's flag-backed branch-return normalization before
  returning-state-helper inlining. This reduces them to one tail return, allowing their entry-slot reads and
  writes to inline into the dispatched caller instead of leaking hidden block-layout parameters into a
  subroutine call.
- Synthesized flag/result assignments are source-location stamped, preventing optimizer source-map failures.
- The motivating Corion module-handler fixture advances through both its helper signature and tuple-return
  mismatches to a separate external-call target provenance limitation.

The focused suite is **788/788**. The corrected full corpus finishes at **4423/4587**, 164 failed, with
NEG-ACCEPTED unchanged at 906, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4423 -> 4424 (+1, NEG-ACCEPTED flat 906)

- **External target behind an inlined struct binding (+1)**: an interface cast of a plain-address field on a
  single-assignment/inliner-created struct local is now captured immediately before the call. The value is live
  at that point and is pinned by the script, avoiding the unsound alternative of lifting it into a caller-chosen
  witness or the invalid alternative of reading the local in a body-top prologue.
- The fail-closed behavior for reassigned/mutable target locals remains intact. External-target diagnostics now
  include the interface method and containing function while preserving the established error prefix.
- This closes the full `test/compilationTests/corion/moduleHandler.sol` fixture.

The focused suite remains **788/788**. The corrected full corpus finishes at **4424/4587**, 163 failed, with
NEG-ACCEPTED unchanged at 906, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4424 -> 4425 (+1, NEG-ACCEPTED flat 906)

- **Forward-declared storage-return aliases with push preludes (+1)**: `helper().push()` can now target a
  zero-argument helper declared later in the contract when that helper performs only direct array pushes before
  returning a direct state array (or array-element) storage reference. Calls are deferred until the helper body
  is parsed, then materialized as the cloned prelude followed by the push on the returned storage path.
- The lowering remains intentionally narrow: locals, arbitrary control flow, and other side effects do not become
  implicit writable aliases.
- This closes `semanticTests/array_members/storage_pointer_push_1.sol`.

The focused suite is **789/789**. The corrected full corpus finishes at **4425/4587**, 162 failed, with
NEG-ACCEPTED unchanged at 906, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4425 -> 4426 (+1, NEG-ACCEPTED flat 906)

- **Prefix mutation of local struct fields (+1)**: prefix/postfix expression lowering now recognizes a direct
  field of a local struct and rebuilds the aggregate with only that field incremented or decremented. This matches
  the compiler's existing value-struct assignment model and preserves every sibling field.
- This closes the `isSimpleCounterLoop_negative_cases.sol` property fixture, whose final loop update is `++s.x`;
  the expression no longer reaches code generation as an undefined unary instruction.

The focused suite is **790/790**. The corrected full corpus finishes at **4426/4587**, 161 failed, with
NEG-ACCEPTED unchanged at 906, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4426 -> 4427 (+1, NEG-ACCEPTED flat 906)

- **Prefix mutation of nested push results (+1)**: `++receiver.push()` and `--receiver.push()` now reuse the
  indexed struct-field array read/modify/write path, rather than supporting only a plain array receiver. The
  appended default is replaced with the correctly typed `+1`/`-1` value while the containing aggregate is written
  back through its existing lvalue path.
- This closes `smtCheckerTests/operators/unary_add_array_push_2.sol`
  (`++data[1].d[3].push()`).

The focused suite is **791/791**. The corrected full corpus finishes at **4427/4587**, 160 failed, with
NEG-ACCEPTED unchanged at 906, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4427 -> 4428 (+1, NEG-ACCEPTED flat 906)

- **Deep indexed struct-array pushes (+1)**: the existing aggregate read/modify/write lowering now handles more
  than one struct member in an indexed receiver path, such as `s1[1].ts[4].a.push()`. It reads the innermost
  dynamic array, applies the push/pop, and writes the updated value back through both containing struct arrays.
- This closes `smtCheckerTests/types/struct/array_struct_array_struct_storage_safe.sol`, including its repeated
  deep pushes and subsequent indexed element write.

The focused suite is **792/792**. The corrected full corpus finishes at **4428/4587**, 159 failed, with
NEG-ACCEPTED unchanged at 906, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4428 -> 4429 (+1, NEG-ACCEPTED flat 906)

- **Unconditional do-while break folding (+1)**: a top-level unconditional `break` now collapses a `do...while`
  to the straight-line statements that precede the break. The remaining body and condition are unreachable, so
  condition side effects are correctly skipped (`do { break; } while (++x < 2)` leaves `x` unchanged).
- This closes `smtCheckerTests/loops/do_while_bmc_iterations_break_8.sol`.

The focused suite is **794/794**. The corrected full corpus finishes at **4429/4587**, 158 failed, with
NEG-ACCEPTED unchanged at 906, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4429 -> 4430 (+1, NEG-ACCEPTED flat 906)

- **Array-write final-use ordering (+1)**: local array assignment analysis now records the replacement write
  after traversing its index and value. A nested aggregate rebuild may read the same array while constructing the
  replacement; that read can no longer consume the stack slot before codegen performs the enclosing write.
- This closes `smtCheckerTests/types/struct/array_struct_array_struct_memory_unsafe.sol`, including nested writes
  to otherwise unread memory struct arrays.

The focused suite is **795/795**. The corrected full corpus finishes at **4430/4587**, 157 failed, with
NEG-ACCEPTED unchanged at 906, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4430 -> 4431 (+1, NEG-ACCEPTED flat 906)

- **Transitive interface override bases (+1)**: explicit override lists now accept an interface inherited through
  a sub-interface, not only a contract's direct interface names. The inheritance pass computes the transitive
  interface parent closure before validating `override(Base)`.
- This closes `syntaxTests/inheritance/interface/implementation/complete.sol`
  (`SubImpl is Sub`, with `override(ParentB)`).

The focused suite is **796/796**. The corrected full corpus finishes at **4431/4587**, 156 failed, with
NEG-ACCEPTED unchanged at 906, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4431 -> 4432 (+1, NEG-ACCEPTED flat 906)

- **Solidity keywords as Yul identifiers (+1)**: Yul declarations and paths now accept Solidity-reserved tokens
  as ordinary Yul names. A parser predicate handles these tokens only in Yul identifier positions, avoiding any
  change to keyword lexing in the surrounding Solidity grammar.
- This closes `syntaxTests/inlineAssembly/solidity_keywords.sol`.

The focused suite is **797/797**. The corrected full corpus finishes at **4432/4587**, 155 failed, with
NEG-ACCEPTED unchanged at 906, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4432 -> 4435 (+3, NEG-ACCEPTED flat 906)

- **Runtime Yul memory and raw bytes storage words (+3)**: constant-offset `mstore` words remain available while
  an assembly block uses the runtime memory buffer, allowing `keccak256(array.slot)` to retain its dynamic-array
  meaning without aliasing different-length hashes. Bare bytes32 hash results are converted to Yul uint256 words
  for anonymous storage keys.
- Canonical long-bytes markers (`sstore(b.slot, 2*n+1)`) now resize the high-level bytes value, while raw
  `sstore(keccak256(b.slot)+i, word)` and matching `sload` splice/read the corresponding 32-byte chunk of that same
  value. This avoids accepting the fixture through an unrelated anonymous-storage register.
- This closes `array/delete/delete_bytes_array.sol`,
  `inlineAssembly/keccak256_optimizer_cache_bug.sol`, and
  `viaYul/storage/dirty_storage_bytes_long.sol`.

The focused suite is **800/800**. The corrected full corpus finishes at **4435/4587**, 152 failed, with
NEG-ACCEPTED unchanged at 906, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4435 -> 4436 (+1, NEG-ACCEPTED flat 906)

- **ABI-produced bytes exposed as Yul memory pointers (+1)**: a named memory-bytes return initialized by an
  arbitrary bytes expression (such as `abi.encode(x)`) is now evaluated once, allocated in the shared linear
  memory buffer, and byte-copied before assembly observes it. Yul receives the numeric pointer while the return
  boundary serializes the buffer back to bytes.
- This closes `abicoder/cleanup/reencoded_calldata_string.sol` (`eq(mptr, r)`).

The focused suite is **801/801**. The corrected full corpus finishes at **4436/4587**, 151 failed, with
NEG-ACCEPTED unchanged at 906, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4436 -> 4437 (+1, NEG-ACCEPTED flat 906)

- **ABI-decoded dynamic arrays exposed as Yul memory pointers (+1)**: tuple decoding remains a single evaluation,
  but each decoded dynamic array referenced by inline assembly is copied into its own shared-memory allocation.
  High-level uses and Yul now share the pointer-backed array, preserving Solidity's independent allocation and
  pointer-comparison semantics.
- This closes `abicoder/abi_decode_overlapping_dynamic_arrays.sol`, including comparisons between both decoded
  array pointers and the original ABI buffer.

The focused suite is **802/802**. The corrected full corpus finishes at **4437/4587**, 150 failed, with
NEG-ACCEPTED unchanged at 906, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4437 -> 4438 (+1, NEG-ACCEPTED flat 906)

- **Nested mapping fixed-struct-array field writes (+1)**: an lvalue such as
  `m[k1][k2][i].items[j] = value`, where the mapping value is `Struct[N]`, now separates the mapping keys from
  the outer struct index and inner field-array index. The selected struct is read, rebuilt through the existing
  local array-field update path, and written back to the same mapping-array element.
- This closes `storage/array_accessor.sol`, whose constructor writes through
  `multiple_map[2][1][2].finalArray[3]`.

The focused suite is **803/803**. The corrected full corpus finishes at **4438/4587**, 149 failed, with
NEG-ACCEPTED unchanged at 906, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4438 -> 4439 (+1, NEG-ACCEPTED 906 -> 902)

- **Storage-only mapping-bearing struct-array declarations (+1)**: struct validation now accepts fixed or dynamic
  arrays of mapping-bearing structs as legal Solidity storage-only type declarations. Representation checks remain
  at actual state/local/parameter use sites rather than rejecting an otherwise-unused declaration.
- Fixed-array recursion uses an active-path cycle check: directly recursive fixed arrays remain rejected because
  they have infinite inline size, while repeated non-recursive struct fields and recursion behind a mapping/dynamic
  indirection remain valid. This also corrects four previously over-accepted negative recursion fixtures.
- This closes `parsing/arrays_in_storage.sol` while retaining rejection of
  `struct_definition_directly_recursive_fixed_array.sol`.

The focused suite is **805/805**. The corrected full corpus finishes at **4439/4587**, 148 failed, with
NEG-ACCEPTED reduced to 902, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4439 -> 4440 (+1, NEG-ACCEPTED flat 902)

- **Attached storage helpers on scalar state receivers (+1)**: parser-level using-for receiver tracking now
  includes scalar state variables, not only parameters and locals. A call such as `stateString.helper()` is
  qualified to `Library.helper(stateString)` before storage-pointer helpers are inlined and removed.
- Interface-typed state receivers retain their ambiguity guard, so genuine interface calls such as
  `token.transfer(...)` are not accidentally captured by a same-named attached library method.
- This closes `libraries/internal_library_function_attached_to_string_accepting_storage.sol`, including both its
  memory-copy and `string storage` attached helpers.

The focused suite is **806/806**. The corrected full corpus finishes at **4440/4587**, 147 failed, with
NEG-ACCEPTED unchanged at 902, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4440 -> 4441 (+1, NEG-ACCEPTED flat 902)

- **Wildcard using-for on named returns (+1)**: named return locals now receive the same parser-level using-for
  type tracking as parameters and ordinary locals. Wildcard directives (`using Math for *`) participate in early
  qualification, so `result = result.add(offset)` resolves before later library pruning/inlining.
- **Returning external calls in allocation bounds**: external-call slot collection and slot-index propagation now
  traverse `NewArrayNode.size`. A bound such as `new T[](source.length())` therefore receives its return-event
  witness instead of reaching codegen with an undefined return slot.
- Together these close `compilationTests/gnosis/MarketMakers/LMSRMarketMaker.sol`.

The focused suite is **808/808**. The corrected full corpus finishes at **4441/4587**, 146 failed, with
NEG-ACCEPTED unchanged at 902, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4441 -> 4442 (+1, NEG-ACCEPTED flat 902)

- **Hidden oversized storage declarations (+1)**: compatibility getter synthesis now avoids generating a dead
  getter for an omitted-visibility mapping/array when its fixed-array shape exceeds the compiler's 10,000-element
  materialization ceiling. The declaration remains valid storage, while no astronomical default getter value is
  emitted.
- The guard is deliberately dimension-specific. Ordinary omitted-visibility compatibility getters remain
  synthesized because downstream storage lowering currently relies on them; two broader visibility-based attempts
  were rejected after the full corpus exposed three OK-to-FAIL regressions.
- This closes `largeTypes/large_storage_array_mapping.sol`, containing
  `mapping(uint => uint[2**100]) x`.

The focused suite is **809/809**. The corrected full corpus finishes at **4442/4587**, 145 failed, with
NEG-ACCEPTED unchanged at 902, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4442 -> 4443 (+1, NEG-ACCEPTED flat 902)

- **AST-preserved internal-function event declarations (+1)**: an unused event declaration may retain an internal
  function parameter for Solidity AST compatibility. The type is still rejected at an actual `emit`, where no
  cross-boundary encoding exists.
- Declaration validation remains strict for every other unsupported event type. Struct parameters are now checked
  recursively, so recursive or mapping-containing structs remain rejected instead of slipping through the AST-only
  internal-function exception.
- This closes `ASTJSON/event_with_variables_of_internal_types.sol` while retaining rejection of
  `syntaxTests/events/internal_type.sol` and keeping negative over-acceptance flat.

The focused suite is **809/809**. The corrected full corpus finishes at **4443/4587**, 144 failed, with
NEG-ACCEPTED unchanged at 902, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 902 -> 892 (-10)

- **Fixed-array dimension range validation (-10 over-accepted negatives)**: array dimensions are now checked at
  type construction, before the compiler chooses packed-state, collection, local, or parameter representation.
  Every fixed dimension must be positive and no greater than `2**256 - 1`, matching Solidity.
- This closes the zero-length and uint256-overflow family across scalar, bytes, multidimensional, parameter, and
  ABI-decode shapes. The valid but enormous `uint[2**100]` storage declaration remains accepted, preserving the
  preceding large-storage fix.
- Exact checks cover `array/length/fixed_size_zero_length.sol`, `array/length/too_large.sol`, and
  `largeTypes/large_storage_array_mapping.sol`.

The focused suite is **810/810**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
892, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 892 -> 886 (-6)

- **ABI-coder source-unit selection validation (-6 over-accepted negatives)**: `pragma abicoder` now accepts only
  v1/v2 (including Solidity's quoted `"v1"`/`"v2"` spellings), rejects repeated or conflicting selections, and
  treats legacy `pragma experimental ABIEncoderV2` as a v2 selection.
- Solidity's asymmetric compatibility rule is preserved: the deprecated legacy spelling may follow an explicit
  v2 selection, while an explicit selection after the legacy spelling is rejected.
- Exact verification covers the six conflicting/repeated/invalid negative fixtures and the three positive
  `select_v*_quoted_string.sol` / `selected_twice_v2.sol` fixtures.

The focused suite is **811/811**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
886, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 886 -> 867 (-19)

- **Recursive external ABI boundary validation (-19 over-accepted negatives)**: public/external parameters and
  returns now reject internal function pointers, mappings, and recursive aggregate shapes at any nesting depth,
  including inside structs and arrays. External function pointers remain ABI-encodable and accepted.
- The traversal is active-path cycle-safe, so a recursive struct fails closed at the boundary without looping,
  while repeated non-recursive aggregate fields remain valid.
- Seed fixtures cover the four `external_functions_taking_internal_types_struct_*` mapping/function-pointer cases;
  the full corpus confirms the same invariant closes nineteen previously over-accepted negatives.

The focused suite is **812/812**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
867, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 867 -> 862 (-5)

- **Dynamic-storage-only array push/pop (-5 over-accepted negatives)**: under Solidity compatibility, length
  mutation is rejected on memory/calldata arrays and fixed-size storage arrays. Dynamic storage arrays continue to
  support both methods.
- Receiver classification covers packed/chunked state variables, entry-backed collection arrays, whole-array
  storage aliases, and local array values. Native SolidCash local-array mutation remains unchanged.
- Exact fixtures cover `dynamic_memory_array_pop.sol`, `pop/memory_pop.sol`, `push/memory_push.sol`, and
  `static_storage_array_pop.sol`; direct and aliased dynamic-storage controls compile.

The focused suite is **813/813**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
862, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 862 -> 859 (-3)

- **Library metatypes are not array value types (-3 over-accepted negatives)**: Solidity compatibility now rejects
  array declarations/allocations whose element is a declared library and rejects index access on a library
  metatype.
- Ordinary contract and interface types remain valid array elements because they are runtime address handles;
  the check keys only on declarations known to be libraries.
- This closes `array/invalid/library_array.sol`, `array/invalid/library_index_access.sol`, and
  `array/library_array.sol`.

The focused suite is **814/814**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
859, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 859 -> 854 (-5)

- **Custom-error name uniqueness (-5 over-accepted negatives)**: Solidity compatibility now rejects error
  overloading by parameter signature and rejects function/error collisions in the same effective file or contract
  scope, including inherited declarations.
- Definitions-only files are validated during AST construction; executable and inherited contract scopes are
  validated during symbol registration. Same-named errors in unrelated contract scopes remain valid.
- The rule is compatibility-gated, preserving native SolidCash's signature-based custom-error overloading.

The focused suite is **815/815**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
854, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 854 -> 847 (-7)

- **Exact event-signature redeclarations (-7 over-accepted negatives)**: event overloading by distinct parameter
  types remains valid, but an exact name+type signature may not be redeclared by changing `indexed`, `anonymous`,
  or its inheritance path.
- Inheritance expansion retains a duplicate marker while keeping the operational event list deduplicated. Legal
  diamond copies from the same original ancestor remain exempt, and interface event signatures participate in the
  same check.
- File-level duplicates are caught during AST construction; contract, multi-parent, and interface duplicates are
  caught during semantic validation.

The focused suite is **816/816**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
847, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 847 -> 841 (-6)

- **Exact Solidity fallback signatures (-6 over-accepted negatives)**: compatibility mode now accepts only the
  empty `fallback()` signature or the coupled forwarding signature
  `fallback(bytes calldata) returns (bytes memory)`.
- The forwarding input and output must appear together; the input must be unbounded calldata bytes and the single
  output must be unbounded memory bytes. Native SolidCash fallback behavior remains unchanged.
- Exact fixtures cover the wrong input/output data locations, missing forwarding halves, wrong return type, and
  multiple return values under `syntaxTests/fallback` and `nameAndTypeResolution`.

The focused suite is **819/819**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
841, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 841 -> 836 (-5)

- **Control-flow declarations require braces (-5 over-accepted negatives)**: Solidity compatibility now rejects a
  variable declaration used directly as the unbraced body of `if`, `else`, `while`, `do while`, or `for`.
- The validation is applied while constructing a control-flow `block`, before the single statement is normalized
  into a `BlockNode`, so braced declarations remain distinguishable and legal.
- Ordinary unbraced statements remain accepted, and native SolidCash parsing is unchanged.

The focused suite is **821/821**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
836, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 836 -> 819 (-17)

- **File-level global using-for targets (-17 over-accepted negatives)**: compatibility mode now permits
  `using ... for T global` only when `T` is a user-defined value type declared in the source unit.
- Built-ins, arrays, mappings, function types, contracts, interfaces, and wildcard targets are rejected. Legal
  UDVT global method and operator bindings remain accepted.
- Validation runs during AST construction as well as semantic registration. The early check is required because
  definitions-only and abstract source files emit declaration artifacts before ordinary symbol analysis.

The focused suite is **823/823**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
819, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 819 -> 809 (-10)

- **Solidity index-range source validation (-10 over-accepted negatives)**: `x[start:end]` now requires a dynamic
  calldata array, calldata bytes/string, a nested calldata-array element, or an existing calldata slice.
  Memory, storage, and fixed calldata sources are rejected.
- The rule runs in the pre-lowering data-location pass, while parameter/local/state provenance is still exact.
  Later ordinary type checking remains responsible for element sliceability.
- `msg.data[:]`, omitted bounds, nested calldata slices, and string calldata slices remain accepted. SolidCash's
  explicit `.slice(start, end)` method is deliberately unaffected.

The focused suite is **826/826**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
809, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 809 -> 792 (-17)

- **Required Solidity reference-type data locations (-17 over-accepted negatives)**: compatibility mode now
  requires `storage`, `memory`, or `calldata` on reference-type function parameters and return parameters.
- The validation covers internal/private/public/external contract functions, free functions, and library
  functions, including definitions-only library artifacts. Explicit locations retain the existing context-specific
  legality checks.
- Native SolidCash omission remains accepted. Focused fixtures whose unrelated behavior was under test were
  corrected to use Solidity-valid explicit memory locations.

The focused suite is **828/828**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
792, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 792 -> 786 (-6)

- **Parameter mutability keyword placement (-6 over-accepted negatives)**: Solidity compatibility now rejects
  `constant` and `immutable` on function, modifier, try-return, and catch parameters.
- Return-clause modifiers are checked independently because ordinary function returns use `returnParam` rather
  than the shared parameter parser path.
- Valid state/file constants and state immutables remain accepted; native SolidCash parsing is unchanged.

The focused suite is **830/830**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
786, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 786 -> 776 (-10)

- **ABI coder v1 boundary type validation (-10 over-accepted negatives)**: the source AST now retains an explicit
  `pragma abicoder v1|v2` selection, and the pre-lowering validator rejects v2-only structs and nested or
  dynamic-element arrays at constructor, entry-point, event, error, and interface ABI boundaries.
- One full-run regression exposed Solidity's abstract-constructor exception: an abstract contract's constructor
  is not externally ABI-decoded, so its v2-only argument shapes remain legal under v1. Concrete constructors still
  reject them.
- One-dimensional legacy-supported arrays remain accepted; v2/default source units are unaffected.

The focused suite is **832/832**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
776, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 776 -> 771 (-5)

- **Duplicate SPDX source identifiers (-5 over-accepted negatives)**: Solidity compatibility now scans actual
  line/block comments and rejects more than one `SPDX-License-Identifier:` tag in a source unit.
- The scanner skips quoted strings, so tag-shaped runtime text is not mistaken for a license declaration.
- The first full run exposed two corpus positives whose diagnostic trailer repeats SPDX warning text. Text after
  the Solidity harness `// ----` delimiter is now excluded as test metadata, restoring both positives while all
  five duplicate-license fixtures remain rejected.

The focused suite is **834/834**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
771, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 771 -> 767 (-4)

- **Transient storage is value-type-only (-4 over-accepted negatives)**: Solidity compatibility now rejects
  transient dynamic/fixed arrays, mappings, structs, dynamic bytes, and strings before selecting a state storage
  representation.
- Scalar transient values, including bounded integers and fixed bytes, retain the existing per-execution local
  lowering.
- The restriction is compatibility-gated, preserving native SolidCash declaration behavior.

The focused suite is **836/836**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
767, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 767 -> 761 (-6)

- **Non-type declarations in type positions (-6 over-accepted negatives)**: Solidity compatibility now rejects
  error, function, and modifier identifiers used where a user-defined type is required.
- Unknown identifiers continue to become named address placeholders, preserving forward/imported contract and
  interface type resolution. The guard applies only when the declaration kind is already known to be non-type.
- Source-unit declarations and each contract's declarations are pre-scanned, so forward references are rejected
  consistently in parameters, local declarations, and struct members.

The focused suite is **838/838**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
761, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 761 -> 746 (-15)

- **Balanced Unicode directional controls (-15 over-accepted negatives)**: Solidity compatibility now validates
  LRE/RLE/LRO/RLO and PDF controls independently inside every comment and string token.
- A PDF without a matching opener reports directional-control underflow; an unclosed opener reports mismatching
  markers. Nested balanced scopes remain accepted, and controls cannot be balanced across separate tokens.
- Diagnostic trailer text is excluded from this source validation, matching the existing SPDX source-unit scan.

The focused suite is **840/840**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
746, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 746 -> 734 (-12)

- **Source-unit declaration namespace (-12 over-accepted negatives)**: Solidity compatibility now rejects
  duplicate and cross-kind enum, struct, UDVT, constant, error, event, function, interface, library, and contract
  declarations in the shared source-unit namespace.
- Free functions may still overload other free functions, and events may still overload other events. A collision
  between overload sets or with any non-overloadable declaration is rejected.
- Reserved event names (`this` and `super`) retain their grammar-specific handling.

The focused suite is **842/842**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
734, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 734 -> 727 (-7)

- **Contract-local declaration namespace (-7 over-accepted negatives)**: Solidity compatibility now rejects
  state-variable/constant collisions with functions or modifiers, and event/function name collisions in the same
  contract. Function and event overload sets remain valid.
- Struct fields and enum members are now required to have unique names within their own declaration.
- Validation pre-scans the complete contract body, so declaration order does not affect the result.

The focused suite is **844/844**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
727, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 727 -> 717 (-10)

- **Effective inherited declaration namespace (-10 over-accepted negatives)**: after inheritance flattening,
  Solidity compatibility now rejects cross-kind collisions among visible state variables/collections, functions,
  events, and modifiers.
- Private ancestor declarations remain outside the derived namespace. Explicit public state getter overrides may
  coexist with inherited overloads, and a new public variable may coexist with an inherited internal-only function.
- Getter signature compatibility remains delegated to the existing synthesized-getter override validator, including
  mapping-to-struct tuple returns.

The focused suite is **847/847**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
717, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 717 -> 710 (-7)

- **Oversized Solidity memory types (-7 over-accepted negatives)**: compatibility validation now rejects fixed
  array or aggregate memory components whose 32-byte-word head exceeds Solidity's 32-bit memory-size limit.
- Nested fixed arrays are checked through dynamic outer arrays, and struct members are measured recursively while
  dynamic members occupy one pointer word in their containing aggregate.
- The same validation applies to `abi.decode` result schemas. Storage-only types remain unaffected.

The focused suite is **849/849**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
710, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 710 -> 702 (-8)

- **`abi.encodePacked` source-type restrictions (-8 over-accepted negatives)**: Solidity compatibility now rejects
  structs, nested arrays, arrays of structs, and arrays whose elements are dynamic bytes or strings in packed mode.
- Scalar values, direct bytes/string values, and one-dimensional arrays of packable value types remain accepted.
- The validation runs after expression typing, so array literals and state/local aggregate references use their
  resolved source types.

The focused suite is **851/851**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
702, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 702 -> 695 (-7)

- **Override state mutability (-7 over-accepted negatives)**: inherited function merging now validates Solidity's
  mutability substitution rules for explicit overrides.
- Payable functions may only be overridden by payable functions. Other overrides may retain or increase
  restrictiveness along `nonpayable -> view -> pure`, but cannot move in the opposite direction.
- The check runs alongside existing virtual, data-location, and override-base validation.

The focused suite is **853/853**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
695, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 695 -> 680 (-15)

- **Unique explicit `using for` function references (-15 over-accepted negatives)**: every
  `using {f, L.g as +}` binding must now resolve to exactly one user-defined free or qualified library function.
- Events, errors, libraries, builtins, unqualified library members, and ambiguous overload sets are rejected before
  operator/helper lowering can discard the original binding.
- Definitions-only files are validated during AST construction; executable contracts retain a second semantic
  guard after imports and function registration.

The focused suite is **855/855**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
680, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 680 -> 659 (-21)

- **Reserved inline-assembly identifiers (-21 over-accepted negatives)**: Solidity compatibility now rejects EVM
  instruction names used as Yul variables, function names, parameters, or return variables, including the
  non-callable `pushN`/`dupN`/`swapN` families and reserved object-format helpers.
- Validation recursively covers nested blocks, function bodies, switches, and all three `for` blocks.
- Fork-gated instructions remain legal identifiers before activation (`basefee`, `prevrandao`, Cancun transient/
  blob/memory-copy instructions, and Osaka `clz`), while high-level members such as `block.prevrandao` are left
  untouched.
- Solidity keywords that are legal in the Yul dialect remain accepted as identifiers.

The focused suite is **859/859**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
659, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued bench/fix loop: 4443 flat, NEG-ACCEPTED 659 -> 641 (-18)

- **Pure-function effect validation (-18 over-accepted negatives)**: compatibility mode now rejects inline Yul
  instructions that read EVM state/environment or perform calls/creation from a `pure` function.
- The Yul effect scan is recursive through arguments, local functions, conditionals, switches, and loops.
  Arithmetic, memory/calldata operations, and return-data buffer inspection retain Solidity's pure classification.
- Scalar, mapping, and storage-reference state reads are rejected from pure functions. Immutable reads remain
  pure, matching Solidity.
- A Yul `.slot` assignment to a named storage return is tracked as pointer selection rather than a state load, so
  valid pure storage-pointer helpers remain accepted.

The focused suite is **862/862**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
641, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued pure-effect loop: 4443 flat, NEG-ACCEPTED 641 -> 638 (-3)

- Pure functions now reject environment-valued nullary expressions such as `msg.value`, including expressions
  introduced through modifier arguments or modifier bodies after expansion.
- Transient-state reads in pure functions and transient-state writes in view functions are validated before the
  BCH transaction-local lowering erases their state semantics.

The focused suite is **864/864**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
638, plus 275 multifile and 289 cmdline fixtures excluded.

### Continued pure-effect loop: 4443 flat, NEG-ACCEPTED 638 -> 636 (-2)

- Function-pointer types now retain their declared `pure`/`view`/`payable`/`nonpayable` mutability in the shared
  type model.
- Indirect calls enforce caller/callee mutability: pure callers require pure pointers, while view callers reject
  nonpayable/payable pointers.

The focused suite is **865/865**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
636, plus 275 multifile and 289 cmdline fixtures excluded.

### Completed pure-effect cluster: 4443 flat, NEG-ACCEPTED 636 -> 634 (-2)

- Interface function declarations now retain their source mutability, including synthesized interfaces derived
  from concrete contracts and function-pointer lowerings.
- Pure free/operator helpers are checked against interface-constant external calls before helper inlining erases
  the call boundary; view/nonpayable/payable external calls are rejected from pure helpers.
- The corpus now has no remaining over-accepted fixture whose primary diagnostic is a pure function reading state
  or the environment.

The focused suite is **866/866**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
634, plus 275 multifile and 289 cmdline fixtures excluded.

### Explicit-conversion loop: 4443 flat, NEG-ACCEPTED 634 -> 627 (-7)

- Source-written bounded-integer conversions now follow Solidity's one-change rule: a cast may change signedness
  or width, but changing both requires two nested casts.
- Source-written integer/fixed-bytes conversions require matching bit widths. Compiler-generated Yul word
  normalization retains the broader internal conversion rules.
- Explicit conversion between distinct enum types is rejected before enum members are folded to integer literals.
- Numeric and hex-string literal conversion tightening was investigated but deferred: the first implementation
  exposed interactions with contextual literal rewrites and was rolled back rather than reducing positive
  coverage.

The focused suite is **870/870**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
627, plus 275 multifile and 289 cmdline fixtures excluded.

### View-effect loop: 4443 flat, NEG-ACCEPTED 627 -> 617 (-10)

- Pure/view functions now reject direct scalar and dynamic-array state mutation, contract creation, and
  state-modifying low-level calls.
- Direct and explicitly base-qualified calls enforce the resolved callee's mutability; view callers cannot invoke
  nonpayable/payable functions.
- Inline assembly in view functions rejects `sstore`, `tstore`, calls/delegatecalls, creation, and selfdestruct
  while retaining environment reads and static calls.
- Storage-pointer rebinding remains view-safe, and writes originating from Solidity's permitted virtual-modifier
  override cases retain the prior positive behavior.

The focused suite is **873/873**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
617, plus 275 multifile and 289 cmdline fixtures excluded.

### Special-function override loop: 4443 flat, NEG-ACCEPTED 617 -> 612 (-5)

- Fallback and receive declarations now retain `virtual`/`override` metadata and participate in inheritance
  override validation.
- A derived fallback/receive must explicitly use `override`, including when the declaration is inherited through
  an intermediate base; overriding a non-virtual special function is rejected.
- Intermediate inheritance retains validation-only provenance rather than cloning special-function bodies into
  every flattened descendant, avoiding AST growth while preserving existing BCH entry-point behavior.

The focused suite is **875/875**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
612, plus 275 multifile and 289 cmdline fixtures excluded.

### Duplicate base-constructor path loop: 4443 flat, NEG-ACCEPTED 612 -> 607 (-5)

- Constructor argument providers are now validated across the original linearized inheritance hierarchy, so an
  ancestor cannot receive constructor arguments independently from a derived contract and an intermediate base.
- Sibling inheritance branches that each invoke the same ancestor constructor are rejected, while a valid diamond
  with one shared provider remains accepted.
- The five affected Solidity negative fixtures now reject with `DuplicateParentInvocationError`.

The focused suite is **878/878**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
607, plus 275 multifile and 289 cmdline fixtures excluded.

### Override-list uniqueness loop: 4443 flat, NEG-ACCEPTED 607 -> 606 (-1)

- Explicit function and public-state-variable override lists now reject a contract name that occurs more than
  once, before inheritance flattening can clone or deduplicate the declaration.
- Unique multi-base lists such as `override(A, B)` retain their existing behavior.
- Solidity's `override_multiple_duplicated.sol` fixture now rejects with `DuplicateOverrideBaseError`.

The focused suite is **880/880**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
606, plus 275 multifile and 289 cmdline fixtures excluded.

### Private-virtual loop: 4443 flat, NEG-ACCEPTED 606 -> 605 (-1)

- Function declaration construction now rejects `private virtual`: private functions are not inherited and
  cannot participate in virtual dispatch.
- The check runs for abstract declarations as well as implemented functions; body-oriented semantic traversal
  alone does not visit abstract declarations.
- Solidity's `virtual_private.sol` fixture now rejects at the source declaration.

The focused suite is **882/882**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
605, plus 275 multifile and 289 cmdline fixtures excluded.

### Root override-list loop: 4443 flat, NEG-ACCEPTED 605 -> 604 (-1)

- Root contracts now run explicit override-list validation even when they have no inheritance graph to flatten.
- This closes the early-return path which accepted a library name in `override(L)` despite `L` not being a base.
- Solidity's `override_library.sol` fixture now rejects with `OverrideBaseListError`.

The focused suite is **884/884**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
604, plus 275 multifile and 289 cmdline fixtures excluded.

### Modifier-override loop: 4443 flat, NEG-ACCEPTED 604 -> 600 (-4)

- Modifier declarations now retain explicit `override(...)` metadata through AST construction.
- Inheritance validation requires a same-name base modifier, a matching parameter signature, an explicit
  `override`, and a `virtual` base declaration; named override bases must identify an actual provider.
- C3 validation excludes the current contract from its own ancestor candidates, preserving qualified-base and
  abstract modifier behavior.

The focused suite is **886/886**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
600, plus 275 multifile and 289 cmdline fixtures excluded.

### Virtual-declaration loop: 4443 flat, NEG-ACCEPTED 600 -> 596 (-4)

- Unimplemented functions in abstract contracts must now explicitly declare `virtual` in Solidity compatibility
  mode.
- Library functions reject `virtual`, since libraries cannot participate in contract inheritance dispatch.
- The general abstract-function rule also closes the runtime and creation `type(Abstract).code` negative fixtures,
  whose abstract declarations omitted `virtual`.

The focused suite is **888/888**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
596, plus 275 multifile and 289 cmdline fixtures excluded.

### Abstract-function modifier loop: 4443 flat, NEG-ACCEPTED 596 -> 595 (-1)

- Unimplemented functions now reject custom modifier invocations in Solidity compatibility mode.
- The validation lives in the abstract-declaration construction path, leaving ordinary implemented functions and
  their modifier expansion unchanged.
- Solidity's `modifiers_on_abstract_functions_no_parser_error.sol` fixture now rejects at the first modifier.

The focused suite is **889/889**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
595, plus 275 multifile and 289 cmdline fixtures excluded.

### Abstract-over-implemented override loop: 4443 flat, NEG-ACCEPTED 595 -> 593 (-2)

- An unimplemented function can no longer override a base function which already has an implementation.
- Validation runs during function merging and is independent of parent order, while an abstract override of only
  abstract base declarations remains valid.
- Both affected Solidity override fixtures now reject with `AbstractOverrideOfImplementedError`.

The focused suite is **891/891**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
593, plus 275 multifile and 289 cmdline fixtures excluded.

### Interface-function visibility loop: 4443 flat, NEG-ACCEPTED 593 -> 588 (-5)

- Solidity-compatible interface functions must now explicitly declare `external`; omitted, internal, private, and
  public visibility spellings are rejected during interface AST construction.
- Contract function visibility defaults remain intentionally permissive for import compatibility, preserving
  existing snippet and porting behavior outside interfaces.
- All five affected interface visibility fixtures now reject, including the state-reset fixture containing a
  later contract declaration.

The focused suite is **893/893**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
588, plus 275 multifile and 289 cmdline fixtures excluded.

### Root bare-override loop: 4443 flat, NEG-ACCEPTED 588 -> 587 (-1)

- Root contracts now reject bare `override` on functions, public state getters, collection getters, modifiers,
  fallback, and receive declarations because no inherited declaration can exist.
- Explicit base lists still use the existing resolver, preserving the more specific invalid-base diagnostic for
  cases such as `override(LibraryName)`.
- Solidity's `public_vars_wrong_override.sol` fixture now rejects with `OverrideNothingError`.

The focused suite is **895/895**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
587, plus 275 multifile and 289 cmdline fixtures excluded.

### Public-getter override-base loop: 4443 flat, NEG-ACCEPTED 587 -> 586 (-1)

- Explicit override base lists on public scalar and collection getters now validate every named contract or
  interface through the same post-flattening resolver used by function overrides.
- Direct and transitively inherited interface names remain valid; surplus names which are not inherited reject.
- Solidity's `public_var_surplus_override.sol` fixture now rejects with `OverrideBaseListError`.

The focused suite is **897/897**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
586, plus 275 multifile and 289 cmdline fixtures excluded.

### Public-getter signature loop: 4443 flat, NEG-ACCEPTED 586 -> 581 (-5)

- Scalar, mapping, and array public getters now derive their Solidity ABI parameter and return shapes before
  inheritance flattening.
- Getter overrides reject unrelated overload sets, return-type mismatches, missing `override`, and incomplete
  multi-base lists; dominated ancestors are excluded when computing required diamond providers.
- Unrelated inherited overloads and valid explicit diamond lists remain accepted.

The focused suite is **900/900**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
581, plus 275 multifile and 289 cmdline fixtures excluded.

### Function override-provider loop: 4443 flat, NEG-ACCEPTED 581 -> 580 (-1)

- Explicit function override lists now validate that each named concrete base declares the exact overload, rather
  than accepting any ancestor with a same-name function.
- Overrides with multiple undominated concrete providers must list every provider; dominated ancestors remain
  excluded from the required list.
- Solidity's `override_multiple_missing.sol` fixture now rejects with `OverrideBaseListError`.

The focused suite is **902/902**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
580, plus 275 multifile and 289 cmdline fixtures excluded.

### Direct-base effective-origin loop: 4443 flat, NEG-ACCEPTED 580 -> 579 (-1)

- Direct concrete bases now resolve each inherited function signature to its effective source origin before
  flattening.
- Distinct implemented origins require an explicit override even when one direct base descends from another;
  dominated abstract ancestors and unchanged same-origin diamonds remain unambiguous.
- Public getters with matching ABI signatures count as explicit conflict resolutions.

The focused suite is **904/904**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
579, plus 275 multifile and 289 cmdline fixtures excluded.

### Constructor-visibility loop: 4443 flat, NEG-ACCEPTED 579 -> 574 (-5)

- Solidity-compatible constructors now reject `external` visibility.
- Concrete contracts reject `internal` constructors, while abstract contracts reject legacy `public`
  constructors.
- The inverse legacy combinations remain accepted: abstract/internal and concrete/public.

The focused suite is **908/908**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
574, plus 275 multifile and 289 cmdline fixtures excluded.

### Abstract modifier-declaration loop: 4443 flat, NEG-ACCEPTED 574 -> 572 (-2)

- Abstract-contract declaration artifacts now validate modifier definitions before their early ABI-only return.
- Implemented modifier bodies without an `_` placeholder reject even when no bytecode is generated.
- Unimplemented modifiers still require `virtual` in abstract contracts.

The focused suite is **911/911**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
572, plus 275 multifile and 289 cmdline fixtures excluded.

### Inherited constructor-argument loop: 4443 flat, NEG-ACCEPTED 572 -> 568 (-4)

- Concrete Solidity-derived contracts now reject omitted arguments for a base's Solidity-style constructor,
  including forward-referenced child declarations.
- Abstract derived contracts may still defer those arguments, and a direct descendant base may construct a
  shared ancestor on behalf of the final diamond.
- Interface bases reject constructor arguments because interfaces have no constructors.

The focused suite is **915/915**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
568, plus 275 multifile and 289 cmdline fixtures excluded.

### Constructor-list invocation loop: 4443 flat, NEG-ACCEPTED 568 -> 564 (-4)

- Constructor custom-modifier invocations are now retained instead of being silently discarded.
- Bare modifier-style base constructor names reject because Solidity requires parentheses.
- Constructor-list calls naming an unrelated contract or the contract itself reject, while genuine custom
  constructor modifiers remain valid.

The focused suite is **918/918**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
564, plus 275 multifile and 289 cmdline fixtures excluded.

### Function-context restriction loop: 4443 flat, NEG-ACCEPTED 564 -> 561 (-3)

- Functions can no longer reuse their containing contract's name in Solidity compatibility mode.
- Concrete constructors reject internal function-pointer parameters, while abstract constructors retain
  Solidity's deferral exception.
- `msg.data` rejects inside `receive()` but remains available inside `fallback()`.

The focused suite is **922/922**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
561, plus 275 multifile and 289 cmdline fixtures excluded.

### Modifier declaration-validation loop: 4443 flat, NEG-ACCEPTED 561 -> 558 (-3)

- Modifier parameters now receive the same source-level data-location validation as function parameters.
- Duplicate locations and missing locations on reference types reject before modifier expansion.
- Modifier bodies reject return arguments while retaining Solidity's valid bare `return;` form.

The focused suite is **925/925**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
558, plus 275 multifile and 289 cmdline fixtures excluded.

### Transient/storage placement loop: 4443 flat, NEG-ACCEPTED 558 -> 550 (-8)

- Solidity-compatible state variables reject an explicit `storage` location, including parser-stop fixtures.
- `transient` rejects on local variables and in combination with `constant` or `immutable`.
- Transient state initializers reject, while uninitialized value-type transient state remains supported.

The focused suite is **929/929**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
550, plus 275 multifile and 289 cmdline fixtures excluded.

### Function-type state declaration loop: 4443 flat, NEG-ACCEPTED 550 -> 545 (-5)

- Only external function types may carry function-level `payable`; `address payable` parameter and return types
  remain valid on internal function types.
- External function types reject nested internal function parameters or returns.
- Public state exposure rejects internal function types, while private/internal state and public external
  function types remain valid.

The focused suite is **933/933**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
545, plus 275 multifile and 289 cmdline fixtures excluded.

### Constant zero-divisor loop: 4443 flat, NEG-ACCEPTED 545 -> 537 (-8)

- Integer constant declarations now reject compile-time division and modulo by a resolved zero expression.
- `addmod` and `mulmod` constants reject a resolved zero modulus.
- Validation follows constant references and arithmetic subexpressions, covering both initialization and literal
  operation fixtures while retaining non-zero constant arithmetic.

The focused suite is **936/936**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
537, plus 275 multifile and 289 cmdline fixtures excluded.

### Inline-library declaration loop: 4443 flat, NEG-ACCEPTED 537 -> 533 (-4)

- ABI-only definition units now run source-level data-location validation before their early artifact return.
- Inline-only private and internal library functions require explicit locations on reference-type parameters and
  returns, using the same validator as executable contracts.
- Explicitly located inline library declarations remain valid.

The focused suite is **938/938**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
533, plus 275 multifile and 289 cmdline fixtures excluded.

### msg.value payable-context loop: 4443 flat, NEG-ACCEPTED 533 -> 528 (-5)

- Explicit nonpayable constructors now reject `msg.value` reads, while state-variable initializer reads retain
  Solidity's initializer exception.
- Nonpayable public/external view functions reject `msg.value`, including reads introduced by modifier
  expansion.
- Non-view entry points, internal/private helpers, and library view functions retain Solidity's valid
  zero/delegate-context reads.

The focused suite is **941/941**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
528, plus 275 multifile and 289 cmdline fixtures excluded.

### Hex-string separator loop: 4443 flat, NEG-ACCEPTED 528 -> 524 (-4)

- Solidity-compatible hex strings now reject leading, trailing, and duplicate underscore separators.
- Separators must occur after a complete byte boundary, rejecting odd-nibble placement while retaining valid
  variable-sized byte grouping.

The focused suite is **946/946**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
524, plus 275 multifile and 289 cmdline fixtures excluded.

### Event indexed-parameter loop: 4443 flat, NEG-ACCEPTED 524 -> 522 (-2)

- Ordinary events now reject more than three indexed parameters in Solidity compatibility mode.
- Anonymous events retain Solidity's additional topic slot but reject more than four indexed parameters.
- Both event forms remain valid at their respective indexed-parameter limits.

The focused suite is **949/949**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
522, plus 275 multifile and 289 cmdline fixtures excluded.

### Reserved built-in error-name loop: 4443 flat, NEG-ACCEPTED 522 -> 520 (-2)

- Solidity compatibility mode now reserves the built-in `Error` and `Panic` error identifiers.
- File-level and contract-level declarations share the same rejection path, while similarly named user errors
  remain valid.

The focused suite is **952/952**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
520, plus 275 multifile and 289 cmdline fixtures excluded.

### Constant index-range loop: 4443 flat, NEG-ACCEPTED 520 -> 516 (-4)

- Constant array and bytes indices now reject values that cannot be represented as Solidity `uint256`.
- Fixed bytes and fixed arrays reject literal and folded constant indices outside their declared bounds.
- Exact `BigInt` parsing prevents oversized direct indices from losing precision before validation.

The focused suite is **956/956**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
516, plus 275 multifile and 289 cmdline fixtures excluded.

### Solidity numeric-literal syntax loop: 4443 flat, NEG-ACCEPTED 516 -> 511 (-5)

- Solidity compatibility mode now rejects decimal integer literals with legacy octal-looking leading zeros.
- Numeric denominations require separating whitespace rather than being lexically attached to the number.
- The removed Solidity `finney` denomination rejects in compatibility mode while remaining a native BCH unit.

The focused suite is **963/963**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
511, plus 275 multifile and 289 cmdline fixtures excluded.

### UDVT underlying value-type loop: 4443 flat, NEG-ACCEPTED 511 -> 509 (-2)

- Solidity-compatible user-defined value types now reject dynamic `bytes` and `string` underlyings.
- Fixed bytes, integers, and addresses remain valid elementary underlyings.
- Native SolidCash retains its dynamic-byte and string wrapper extension.

The focused suite is **967/967**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
509, plus 275 multifile and 289 cmdline fixtures excluded.

### Solidity enum member-limit loop: 4443 flat, NEG-ACCEPTED 509 -> 508 (-1)

- Solidity-compatible enums now reject declarations with more than 256 members.
- The exact 256-member boundary remains valid.

The focused suite is **969/969**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
508, plus 275 multifile and 289 cmdline fixtures excluded.

### Custom-error ABI parameter loop: 4443 flat, NEG-ACCEPTED 508 -> 507 (-1)

- Solidity-compatible custom errors now reject internal function-pointer parameters.
- Recursive struct shapes reject across direct, indirect, and array-nested recursion.
- Nonrecursive structs and external function handles remain valid error parameter types.

The focused suite is **972/972**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
507, plus 275 multifile and 289 cmdline fixtures excluded.

### Custom-error selector-collision loop: 4443 flat, NEG-ACCEPTED 507 -> 505 (-2)

- Solidity-compatible custom errors now reject distinct signatures sharing one 4-byte EVM selector.
- Collision tracking covers errors declared across a contract and its library namespace.
- Distinct selectors and repeated references to the same signature remain valid.

The focused suite is **975/975**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
505, plus 275 multifile and 289 cmdline fixtures excluded.

### Custom-error call-context loop: 4443 flat, NEG-ACCEPTED 505 -> 502 (-3)

- Declared custom errors now reject when invoked as ordinary function calls or nested as expression values.
- Source construction validates file-level free functions that return before the full semantic contract pipeline.
- Contract and namespaced library calls share the semantic diagnostic, while `revert` and `require` uses remain
  valid.

The focused suite is **978/978**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
502, plus 275 multifile and 289 cmdline fixtures excluded.

### Free-function `this` loop: 4443 flat, NEG-ACCEPTED 502 -> 501 (-1)

- Solidity compatibility mode now rejects `this` in a file-level free-function body, where no contract instance
  exists.
- Contract and library function bodies retain their existing `this` behavior, and native SolidCash parsing remains
  unchanged.

The focused suite is **980/980**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
501, plus 275 multifile and 289 cmdline fixtures excluded.

### Base-constructor argument validation loop: 4443 flat, NEG-ACCEPTED 501 -> 498 (-3)

- Explicit base-constructor integer literals are now range-checked against bounded integer parameters even when
  the base constructor does not read the parameter.
- Event and custom-error declarations are rejected when supplied as base-constructor values, including qualified
  event references.
- The validation runs before inheritance flattening, preserving existing diamond and storage-pointer constructor
  argument behavior.

The focused suite is **983/983**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
498, plus 275 multifile and 289 cmdline fixtures excluded.

### Duplicate free-function signature loop: 4443 flat, NEG-ACCEPTED 498 -> 496 (-2)

- File-level and namespaced library free-function signatures are now checked before unreachable-function pruning.
- Exact duplicate parameter signatures reject with the established function-redefinition diagnostic, while
  distinct overloads remain valid.

The focused suite is **985/985**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
496, plus 275 multifile and 289 cmdline fixtures excluded.

### Free-function call-options loop: 4443 flat, NEG-ACCEPTED 496 -> 495 (-1)

- Direct file-level and namespaced library calls now reject `{gas: ...}` and `{value: ...}` before unreachable
  free-function pruning can erase the invalid call.
- External interface calls from free functions retain their call options.

The focused suite is **987/987**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
495, plus 275 multifile and 289 cmdline fixtures excluded.

### Pure free-function storage-mutation loop: 4443 flat, NEG-ACCEPTED 495 -> 494 (-1)

- Pure file-level and library free functions now reject array, mapping, assignment, and delete mutations rooted
  in a `storage` reference parameter before unreachable-function pruning.
- Equivalent storage mutations remain valid in non-pure helpers.

The focused suite is **989/989**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
494, plus 275 multifile and 289 cmdline fixtures excluded.

### Free-function literal-overload loop: 4443 flat, NEG-ACCEPTED 494 -> 493 (-1)

- Literal-only calls to overloaded file/library free functions now reject when multiple bounded integer parameter
  ranges accept every argument.
- Explicit casts continue to select a unique overload through normal semantic resolution.

The focused suite is **991/991**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
493, plus 275 multifile and 289 cmdline fixtures excluded.

### Anonymous-event selector loop: 4443 flat, NEG-ACCEPTED 493 -> 491 (-2)

- Anonymous events now reject `.selector` because they do not emit a signature topic.
- Library anonymity is preserved through source metadata and import merging, covering function bodies and state or
  constant initializer folds; ordinary event selectors remain valid.

The focused suite is **993/993**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
491, plus 275 multifile and 289 cmdline fixtures excluded.

### Named event-overload loop: 4443 flat, NEG-ACCEPTED 491 -> 489 (-2)

- Named emits now retain every overload with the matching parameter-name set instead of selecting the first
  declaration.
- Type checking reorders arguments per candidate and rejects when multiple overloads remain implicitly compatible;
  uniquely named overloads continue to reorder and emit normally.

The focused suite is **996/996**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
489, plus 275 multifile and 289 cmdline fixtures excluded.

### Contract event-shadowing loop: 4443 flat, NEG-ACCEPTED 489 -> 488 (-1)

- Bare emits now resolve against the defining contract's effective event namespace before file-level events of
  the same name.
- Qualified interface, contract, and library emits preserve their qualifier, while inherited functions retain
  their defining lexical event scope.

The focused suite is **999/999**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
488, plus 275 multifile and 289 cmdline fixtures excluded.

### Internal state-getter call loop: 4443 flat, NEG-ACCEPTED 488 -> 487 (-1)

- Solidity-compatible bare calls to state variables and collections now reject instead of resolving to synthesized
  public getter functions.
- Explicit external self-calls such as `this.m(key)` retain the generated getter, and function-pointer state
  variables remain callable.

The focused suite is **1002/1002**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
487, plus 275 multifile and 289 cmdline fixtures excluded.

### Low-level call value-option loop: 4443 flat, NEG-ACCEPTED 487 -> 486 (-1)

- `staticcall{value: ...}` and `delegatecall{value: ...}` now reject during AST construction, including inside
  internal helpers which later become unreachable and are pruned.
- Gas-only low-level call options remain accepted as the existing BCH no-op compatibility shim.

The focused suite is **1005/1005**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
486, plus 275 multifile and 289 cmdline fixtures excluded.

### Function-pointer value-option loop: 4443 flat, NEG-ACCEPTED 486 -> 484 (-2)

- External function values now retain their declared `pure`, `view`, `payable`, or `nonpayable` mutability in
  their resolved `FunctionType`, including function references inside inline arrays.
- Solidity-compatible calls reject `{value: ...}` on nonpayable function pointers while retaining payable pointer
  calls and gas-only options.

The focused suite is **1006/1006**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
484, plus 275 multifile and 289 cmdline fixtures excluded.

### Function-type mutability-conversion loop: 4443 flat, NEG-ACCEPTED 484 -> 475 (-9)

- Function-type implicit conversions now follow Solidity's directional capability rules: `pure` may become
  `view` or `nonpayable`, and `view`/`payable` may become `nonpayable`; conversions which gain purity or
  payability reject.
- Function references, external contract/interface members, inline arrays, and synthesized public getters now
  retain their declared mutability so valid conversions and function-valued error arguments remain typed.

The focused suite is **1018/1018**, and the utils suite is **288 passed** with one todo. The full corpus remains
**4443/4587**, 144 failed, while NEG-ACCEPTED falls to 475, plus 275 multifile and 289 cmdline fixtures excluded.

### Special-function override-kind loop: 4443 flat, NEG-ACCEPTED 475 -> 473 (-2)

- Solidity-compatible inheritance now validates `fallback() override` only against ancestral fallback
  declarations and `receive() override` only against ancestral receive declarations.
- Valid direct and transitive overrides retain the existing virtuality and mutability checks.

The focused suite is **1019/1019**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
473, plus 275 multifile and 289 cmdline fixtures excluded.

### Base-function call eligibility loop: 4443 flat, NEG-ACCEPTED 473 -> 471 (-2)

- Calls through `super` or an explicit base contract now retain the original declaration's visibility and
  abstractness during pre-flattening validation, rejecting external and unimplemented base functions.
- `super` dispatch skips abstract declarations in C3 order when a later concrete implementation exists, preserving
  valid mixed implemented/unimplemented inheritance hierarchies.

The focused suite is **1021/1021**. The full corpus remains **4443/4587**, 144 failed, while NEG-ACCEPTED falls to
471, plus 275 multifile and 289 cmdline fixtures excluded.
