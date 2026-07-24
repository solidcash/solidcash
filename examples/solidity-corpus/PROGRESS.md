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
