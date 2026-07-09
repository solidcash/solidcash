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
