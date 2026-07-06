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
