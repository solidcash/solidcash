# Plan: bare expression statements (`expr;`), the Solidity way

Status: **DONE** (corpus 2874 -> 3040, +166). Landed in phases: assignment left-factored (`6c51d7c3`), then the
FULL fold of the remaining expression-like forms into `expressionStatement` - push/pop/delete (`ffc3d38e`), calls
(`1017495a`), storage-pointer write (`30952bea`). The statement rule is now solc's 2-way structure: keyword-led
forms + the declaration forms (`variableDefinition`/`tupleAssignment` = solc's `variableDeclarationStatement`) +
`expressionStatement` (+ the `console` debug builtin). Parse recovers to clean-HEAD parity and slightly beats it
(7343-file parse-only: clean HEAD 3.78ms/file 43085 DFA states; fully-folded 3.75ms/file 42737). An earlier
"folding push/pop/call gives zero benefit" reading was a confounded PARTIAL fold (residual forms masked the gain);
the COMPLETE fold does recover the overhead. `tupleAssignment` stays (its slots can declare types); its
fully-untyped `(a,b)=..` slice is a minor deviation kept out of the tuple-assign critical path. `visitAssignmentStatement`'s dispatch was extracted into `buildLvalueAssign`, driven by a new
`extractLvalue()` that rebuilds the lvalue segments from the parsed LHS expression. The earlier additive
`expression ';'` prototype's "OOM + 2.7x slowdown" turned out to be a per-parse DFA-reset workaround (removed
here) plus a pre-existing huge-bounded-array materialization gap (now capped), NOT the ambiguity itself.

Original deferred design (superseded, kept for context):

## Goal

Support a plain expression used as a statement: `x + type(uint).max;`, `2 / x;`, `arr[i];`, `c ? a : b;`,
`abi.decode(x, (T));`. This is the single biggest solc-corpus parse-error bucket (~292 `;` files; 369/370 are
solc-ACCEPTED, so ~+150 in-scope compiles, measured +155 on a prototype). Common in solc's model-checker /
syntax fixtures but a legitimate, universal Solidity feature.

## Why the naive fix fails (learned the hard way)

A prototype that just added `expressionStatement : expression ';'` as the LAST `statement` alternative worked
(bench 2838 -> 2993, suite green, codegen `visit + OP_DROP` ASM-verified to leave a balanced stack) BUT was
reverted for two reasons:

1. **Memory / full-context prediction.** solidcash's `statement` rule has ~13 expression-like forms
   (`assignStatement`, `assignmentStatement`, `functionCallStatement`, `addressMethodStatement`,
   `tokenContainerMethodStatement`, `arrayPush/Pop/DeleteStatement`, `stateArrayPush/PopStatement`,
   `mappingDeleteStatement`, `tupleAssignment`, `timeOpStatement`, `transferStatement`, `consoleStatement`).
   A general `expression ';'` is ambiguous with all of them (e.g. `x[i] = v;` vs `x[i];`), forcing ANTLR into
   full-context LL prediction, whose DFA/context cache accumulates per distinct input. The 7343-file corpus
   bench then OOMs at the default heap (needs 8 GB). A single / small compile is fine; a long-lived compile
   server would grow.
   - Forcing SLL prediction (`parser._interp.predictionMode = 0`) to bound the cache is NOT viable: it breaks
     the *existing* grammar (9 tests: call options `{value:..}`, address types, `msg.sender`, external calls
     genuinely need LL).
2. **NEG-ACCEPTED masking** — solved separately: the bench now skips solc-negative fixtures (`76485f88`), so a
   bare expression statement that solc rejects (e.g. a deliberately-invalid syntax test) is a skipped fixture,
   not a soundness ding. This concern is already handled; the refactor does not reintroduce it.

## The Solidity structure (the target)

`../solidity/docs/grammar/SolidityParser.g4`:

```
statement: block | simpleStatement | ifStatement | forStatement | whileStatement | doWhileStatement
         | continueStatement | breakStatement | tryStatement | returnStatement | emitStatement
         | revertStatement | assemblyStatement ;
simpleStatement: variableDeclarationStatement | expressionStatement ;
expressionStatement: expression Semicolon ;
```

Solc has **no** dedicated `assignStatement` / `functionCallStatement` / delete / `++` statements: assignment,
calls, index/member writes, `delete`, `++`/`--` are all productions of the ONE `expression` rule. There is a
single way to parse an expression statement, so SLL suffices - no ambiguity, no full-context blowup.

## Refactor steps

1. **Grammar (`SolidCash.g4`).** Move every expression-like construct into `expression` and collapse the
   statement forms:
   - Add to `expression`: bare + compound assignment (`lvalue op= expression`, currently only the parenthesised
     `AssignmentExpression` exists), prefix/postfix `++`/`--`, `delete expression`, array `.push(..)`/`.pop()`.
     (Index/member/call are already expression productions.)
   - Replace the ~13 expression-like statement alternatives with `simpleStatement: variableDefinition |
     expressionStatement` and `expressionStatement: expression ';'`. Keep the genuinely non-expression forms in
     `statement` (if/loop/require/emit/return/try/revert/assert/unchecked/switch/break/continue/assembly/
     placeholder/selfdestruct/timeOp).
   - Regen: `yarn antlr` (from `packages/solidc`). NOTE the generator's post-step uses macOS `sed -i ''`; on
     Linux run the `.js`-extension fixup manually or it errors (the .ts are still generated).

2. **AstBuilder.** `visitExpressionStatement(ctx)` dispatches on the built expression's shape to the existing
   statement nodes:
   - `AssignmentExpressionNode` (and its lvalue variants) -> the assignment path. **This is the hard part**:
     the current `visitAssignmentStatement` reads grammar context (`ctx.lvMember_list()`, index keys) for the
     struct-field / mapping / nested-write desugars. That logic must either operate on the built lvalue
     expression, or the lvalue-with-members must be preserved on the expression node so the desugars still fire.
   - `FunctionCallNode` / method calls -> `FunctionCallStatementNode` / the using-for + low-level-call dispatch
     currently in `visitFunctionCallStatement`.
   - array push/pop, delete, tuple-assignment, transfer, console -> their existing nodes.
   - A bare postfix `++`/`--` reaching here is a malformed chain (`x++++;`) - reject it (a native negative test).

3. **AST + visitors + codegen** (prototype existed; reconstruct):
   - `ExpressionStatementNode { expression }` in `AST.ts`; abstract `visitExpressionStatement` in `AstVisitor`;
     default (visit the expression) in `AstTraversal`.
   - Codegen override in `GenerateTargetTraversal`: visit the expression, then `OP_DROP` once per value
     (`TupleType` -> one per element, else 1). Verified: `x + 1;` -> `OP_DUP; OP_1ADD; OP_DROP` (balanced,
     original preserved).

## Verification

- Full compiler suite green (grammar change is high-risk for regressions - watch the AST-consistency tests).
- Corpus bench: expect ~+150 in-scope (2838 -> ~2990). NEG-ACCEPTED already handled by the skip-list.
- The prototype's guard test: `x++++;` must still be rejected; `x++;` / `arr[i]++;` still use their paths.

## Coordination

Do NOT start while the parallel agent is mid-flight in `AstBuilder.visitAssignmentStatement` /
`SynthesizePublicGetters` / the statement grammar. This refactor touches the same code; land it in a window
where that work is committed and stable.
