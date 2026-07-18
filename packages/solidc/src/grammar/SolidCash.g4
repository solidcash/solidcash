grammar SolidCash;

@lexer::members {
// True when the next input char cannot continue an identifier, so a dotted op like `.value` is a complete
// token rather than the prefix of a longer member name like `.values` (which must lex as `.` + `values`).
dotOpBoundary(): boolean {
  const c = this._input.LA(1);
  return !((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95);
}
// The `.split` op is always a call `x.split(y)`, so it only wins over a member named `split`
// (`escrow.split[i]`, `s.split = ..`) when the next non-space char is `(`. Skips whitespace before '('.
splitOpBoundary(): boolean {
  let i = 1;
  let c = this._input.LA(i);
  while (c === 32 || c === 9 || c === 13 || c === 10 || c === 12) { i++; c = this._input.LA(i); }
  return c === 40;
}
}

sourceFile
    : pragmaDirective* importDirective* (constantDefinition | enumDefinition | structDefinition | typeDefinition | usingForDirective | errorDefinition | eventDefinition | interfaceDefinition | freeFunctionDefinition | libraryDefinition | contractDefinition)* EOF
    ;

importDirective
    : 'import' StringLiteral ';'                                                        # WildcardImport
    | 'import' StringLiteral 'as' Identifier ';'                                        # NamespaceImport
    | 'import' '{' importBinding (',' importBinding)* ','? '}' Identifier StringLiteral ';' # SelectiveImport
    ;

importBinding
    : Identifier ('as' Identifier)?
    ;

freeFunctionDefinition
    : 'function' anyIdentifier parameterList functionModifier* returnType? '{' statement* '}'
    ;

usingForDirective
    : 'using' Identifier 'for' (arrayType | mappingType | typeName | '*') 'global'? ';'                                                     # UsingLibraryFor
    | 'using' '{' usingFunctionBinding (',' usingFunctionBinding)* ','? '}' 'for' (arrayType | mappingType | typeName | '*') 'global'? ';'  # UsingFunctionsFor
    ;

usingFunctionBinding
    : Identifier ('.' Identifier)? ('as' userDefinableOperator)?
    ;

userDefinableOperator
    : '+' | '-' | '*' | '/' | '%' | '**'
    | '==' | '!=' | '<' | '<=' | '>' | '>='
    | '&' | '|' | '^' | '~'
    ;

// A user-chosen name. Soft keywords: SolidCash-specific keywords that Solidity keeps usable as identifiers
// (matching Solidity's `anyIdentifier: Identifier | From | Error | Revert | Global | ...`). Used in name
// positions (parameters, locals, function/struct-field names) so valid Solidity identifiers don't collide.
anyIdentifier
    : Identifier
    | 'delegate' | 'upgrade' | 'selfdestruct' | 'unsafe' | 'packed' | 'entries' | 'error' | 'global' | 'revert'
    | 'transient' | 'leave' | 'fallback' | 'receive' | 'enumerable'
    | CryptoType | BchUnit
    ;

pragmaDirective
    : 'pragma' pragmaName pragmaValue ';'
    // Tolerated no-op directives (abicoder / experimental ...): EVM-specific compiler switches with no BCH
    // effect. Matched via Identifier so they stay non-reserved; the AST builder ignores them.
    | 'pragma' Identifier (Identifier | VersionLiteral | NumberLiteral | StringLiteral | 'solidity')* ';'
    ;

pragmaName
    : 'solidcash'
    | 'solidity'
    ;

pragmaValue
    : versionConstraint+
    | '*'          // wildcard version (`pragma solidity *;`)
    ;

versionConstraint
    // Accept 2-part versions (DecimalLiteral, e.g. 0.0) in addition to X.Y.Z, so ported `pragma solidity >=0.0;`
    // forms parse. Bare numbers (`>1`) stay a parse error - they are not valid version constraints. The version
    // is validated for solidcash pragmas in the AST builder; ignored under solidityImportCompat.
    : versionOperator? (VersionLiteral | DecimalLiteral)
    ;

versionOperator
    : '^' | '~' | '>=' | '>' | '<' | '<=' | '='
    ;

interfaceDefinition
    : 'interface' Identifier ('is' Identifier (',' Identifier)*)? '{' (enumDefinition | structDefinition | typeDefinition | eventDefinition | errorDefinition | interfaceStateVariable | interfaceCollection | interfaceFunction)* '}'
    ;

interfaceCollection
    : interfaceStateVariableVisibility mappingType Identifier ';'
    | interfaceStateVariableVisibility arrayType Identifier ';'
    ;

interfaceStateVariable
    : interfaceStateVariableVisibility typeName Identifier ';'
    ;

interfaceStateVariableVisibility
    : 'public' | 'external'
    ;

interfaceFunction
    : 'function' Identifier parameterList functionModifier* returnType? ';'
    ;

libraryDefinition
    : 'library' Identifier '{' (enumDefinition | structDefinition | typeDefinition | eventDefinition | errorDefinition | constantDefinition | stateVariableDeclaration | usingForDirective | freeFunctionDefinition)* '}'
    ;

contractDefinition
    : 'abstract'? 'contract' anyIdentifier parameterList? ('is' inheritanceSpecifier (',' inheritanceSpecifier)*)? '{' (enumDefinition | structDefinition | typeDefinition | eventDefinition | errorDefinition | constantDefinition | usingForDirective | stateVariableDeclaration | modifierDefinition | constructorDefinition | functionDefinition | abstractFunctionDefinition | fallbackDefinition | receiveDefinition)* '}'
    ;

// A base contract in the inheritance list, optionally with constructor args: `is X("a"), Y`.
inheritanceSpecifier
    : Identifier expressionList?
    ;

abstractFunctionDefinition
    : 'function' anyIdentifier parameterList (functionModifier | customModifierInvocation)* returnType? ';'
    ;

eventDefinition
    : 'event' anyIdentifier '(' (eventParameter (',' eventParameter)* ','?)? ')' 'anonymous'? ';'
    ;

eventParameter
    : (typeName | arrayType) 'indexed'? anyIdentifier?
    ;

errorDefinition
    : 'error' anyIdentifier '(' (errorParameter (',' errorParameter)* ','?)? ')' ';'
    ;

errorParameter
    : typeName Identifier?
    | arrayType Identifier?
    ;

structDefinition
    : 'struct' anyIdentifier '{' structField+ '}'
    ;

structField
    : (typeName | arrayType | mappingType) anyIdentifier ';'
    ;

enumDefinition
    : 'enum' anyIdentifier '{' enumMember (',' enumMember)* ','? '}'
    ;

enumMember
    : anyIdentifier ('=' NumberLiteral)?
    ;

typeDefinition
    : 'type' anyIdentifier 'is' typeName ';'
    ;

constantDefinition
    : typeName 'constant' anyIdentifier '=' expression ';'
    ;

constructorDefinition
    // Visibility/payable may appear before AND/OR after the parent invocations (Solidity `constructor() A() payable`);
    // both groups are the same keywords and the AST builder reads them by rule type, so order does not matter.
    : 'constructor' parameterList ('public' | 'internal' | 'external' | 'payable')* parentInvocation* ('public' | 'internal' | 'external' | 'payable')* customModifierInvocation* '{' statement* '}'
    ;

fallbackDefinition
    : 'fallback' parameterList fallbackModifier* 'external' fallbackModifier* customModifierInvocation* returnType? '{' statement* '}'
    ;

fallbackModifier
    : 'payable' | 'virtual' | overrideSpecifier
    ;

receiveDefinition
    // external + payable are both required but may appear in either order (Solidity `receive() payable external`
    // and `receive() external payable`); the AST builder always records both, so order does not matter.
    : 'receive' '(' ')' receiveModifier* 'external' receiveModifier* 'payable' receiveModifier* ('{' statement* '}' | ';')
    | 'receive' '(' ')' receiveModifier* 'payable' receiveModifier* 'external' receiveModifier* ('{' statement* '}' | ';')
    ;

// external + payable stay required (a receive must be both); virtual/override may be interleaved in any order.
receiveModifier
    : 'virtual' | overrideSpecifier
    ;

parentInvocation
    : Identifier expressionList
    ;

stateVariableDeclaration
    : stateVariableVisibility? typeName (modifier | overrideSpecifier)* anyIdentifier ('=' expression)? ';'
    // modifiers may appear on either side of the visibility, so `uint constant public X` (as well as
    // `uint public constant X`) parses - Solidity allows any order. `override` (a public state var
    // overriding a base getter) is accepted and ignored: EVM inheritance is a no-op in SolidCash.
    | typeName (modifier | overrideSpecifier)* stateVariableVisibility (modifier | overrideSpecifier)* anyIdentifier ('=' expression)? ';'
    | stateVariableVisibility? 'enumerable'? mappingType collectionModifier* anyIdentifier ';'
    | stateVariableVisibility? arrayType collectionModifier* anyIdentifier ('=' expression)? ';'
    ;

collectionModifier
    : modifier
    | stateVariableVisibility
    | overrideSpecifier
    ;

stateVariableVisibility
    : 'public' | 'internal' | 'private' | 'external'
    ;

mappingType
    : 'mapping' '(' typeName Identifier? '=>' typeName Identifier? ')'
    | 'mapping' '(' typeName Identifier? '=>' mappingType ')'
    | 'mapping' '(' typeName Identifier? '=>' arrayType Identifier? ')'
    ;

arrayType
    : typeName '[' expression? ']'
    | arrayType '[' expression? ']'
    ;

modifierDefinition
    : 'modifier' Identifier parameterList? ('virtual' | overrideSpecifier)* ('{' modifierStatement* '}' | ';')
    ;

modifierStatement
    : placeholderStatement
    | statement
    ;

placeholderStatement
    : '_' ';'
    ;

functionDefinition
    : 'function' anyIdentifier parameterList (functionModifier | customModifierInvocation)* returnType? '{' statement* '}'
    ;

customModifierInvocation
    : Identifier expressionList?
    ;

functionModifier
    : 'pure' | 'view' | 'internal' | 'external' | 'public' | 'private' | 'payable' | overrideSpecifier | 'virtual' | unsafeModifier | 'upgrade' | 'selfdestruct' | 'delegate'
    ;

overrideSpecifier
    : 'override' ('(' Identifier (',' Identifier)* ')')?
    ;

unsafeModifier
    : 'unsafe' ('(' NumberLiteral ')')?
    ;

returnType
    : 'returns' '(' returnParam (',' returnParam)* ','? ')'
    ;

returnParam
    : typeName modifier* anyIdentifier?
    | arrayType modifier* anyIdentifier?
    | mappingType modifier* anyIdentifier?
    ;

parameterList
    : '(' (parameter (',' parameter)* ','?)? ')'
    ;

parameter
    : typeName modifier* anyIdentifier?
    | arrayType modifier* anyIdentifier?
    | mappingType modifier* anyIdentifier?
    ;

block
    : '{' statement* '}'
    | statement
    ;

// A bare braced block used as a statement (Solidity allows `{ ... }` to introduce a nested scope). Distinct
// from `block` (which also matches a single bare statement) to avoid left-recursion when nested in `statement`.
blockStatement
    : '{' statement* '}'
    ;

statement
    : placeholderStatement
    | blockStatement
    | variableDefinition
    | tupleAssignment
    | prefixIncDecStatement
    | timeOpStatement
    | requireStatement
    | ifStatement
    | loopStatement
    | consoleStatement
    | emitStatement
    | returnStatement
    | selfdestructStatement
    | assemblyStatement
    | tryCatchStatement
    | revertStatement
    | assertStatement
    | deleteStatement
    | uncheckedStatement
    | switchStatement
    | breakStatement
    | continueStatement
    | expressionStatement
    ;

// A bare expression, or an assignment, used as a statement. Left-factored (solc-style): the LHS `expression` is
// parsed ONCE, then a 1-token decision picks the assignment tail vs a bare expression. This avoids the unbounded
// lookahead (scan the whole lvalue chain for `=`) that a separate assignmentStatement rule forces, so the
// statement decision stays SLL-cheap. AstBuilder reconstructs the assignment target from the LHS expression.
expressionStatement
    : expression
      ( op=('=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^=' | '<<=' | '>>=') assignChain
      // Chained push (Solidity's push-returns-reference): `c.push().push()` appends a default element to the
      // fresh inner array; the `= expression` forms write the appended element; a `.push()` tail on the value
      // side (`b.push() = b.push();`) appends a default to the value array and reads it back.
      | '.push' '(' ')' second='.push' '(' ')' '=' expression (rhsPush='.push' '(' ')' (rhsPush2='.push' '(' ')')?)?
      | '.push' '(' ')' second='.push' '(' pushArgument? ')'
      | '.push' '(' ')' '=' expression (rhsPush='.push' '(' ')' (rhsPush2='.push' '(' ')')?)?
      | '.push' '(' pushArgument? ')'
      | '.pop' '(' ')'
      | '.delete' '(' expression ')'
      )? ';'
    ;

// The value side of an assignment, itself allowed to be another assignment (Solidity's right-associative
// assignment-as-expression: `a = b = c;`, `a += b += c;`). AstBuilder desugars a chain into sequential
// assignments right-to-left, reading each middle lvalue back as the next value.
assignChain
    : expression (op=('=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^=' | '<<=' | '>>=') assignChain)?
    ;

// Prefix `++x;` / `--x;` as a statement (same effect as postfix at statement scope). Keyword-led by `++`/`--`
// (no other statement or expression starts with them), so it needs no left-factoring; the target reuses the
// lvalue reconstruction + assignment builder.
prefixIncDecStatement
    : op=('++' | '--') expression ';'
    ;

returnStatement
    : 'return' ';'
    | 'return' expression rop=('=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^=' | '<<=' | '>>=') assignChain ';'
    | 'return' expression (',' expression)* ';'
    | 'return' '(' expression (',' expression)* ','? ')' ';'
    ;

// EVM-style `selfdestruct(addr)`: destroys the contract and forwards its value to addr (function-based form of
// the selfdestruct modifier). Implies the modifier on the enclosing function.
selfdestructStatement
    : 'selfdestruct' '(' expression ')' ';'
    ;

emitStatement
    : 'emit' Identifier ('.' Identifier)? '(' '{' (namedArg (',' namedArg)* ','?)? '}' ')' ';'
    | 'emit' Identifier ('.' Identifier)? expressionList ';'
    ;

variableDefinition
    : typeName modifier* anyIdentifier ('=' expression (iop=('=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^=' | '<<=' | '>>=') assignChain | '.push' '(' ')')?)? ';'
    | arrayType modifier* anyIdentifier ('=' expression ('.push' '(' ')')?)? ';'
    | mappingType modifier* anyIdentifier ('=' expression)? ';'
    ;

tupleAssignment
    : typeName Identifier (',' typeName Identifier)+ '=' expression ';'
    | '(' tupleSlot (',' tupleSlot)+ ')' '=' '(' expression (',' expression)+ ')' ';'
    | '(' tupleSlot (',' tupleSlot)+ ')' '=' expression ';'
    // Parenthesised single declaration `(uint a) = expr;` (solc's one-element tuple decl). Restricted to a
    // declaration (a type is required after `(`) so `(a) = b` stays a plain parenthesised-lvalue assignment.
    | '(' typeName modifier* anyIdentifier ')' '=' expression ';'
    | '(' arrayType modifier* anyIdentifier ')' '=' expression ';'
    ;

tupleSlot
    : typeName modifier* anyIdentifier
    | arrayType modifier* anyIdentifier
    // A bare name, or an index/member lvalue chain `x[0]`, `s.e`, `s.a[0]` (existing target, not a declaration).
    | anyIdentifier ('[' expression ']' | '.' anyIdentifier)*
    |
    ;

// The pushed value in an `arr.push(v)` expression-statement tail, wrapped so it is separable from the receiver's
// bracket keys, and optional so `arr.push()` appends the element type's default (Solidity's no-arg push).
pushArgument
    : expression
    ;

deleteStatement
    : 'delete' Identifier ';'                                      # DeleteLocal
    | 'delete' 'this' '.' Identifier ';'                           # DeleteState
    | 'delete' 'this' '.' Identifier ('[' expression ']')+ ';'     # DeleteMappingEntry
    | 'delete' Identifier ('[' expression ']')+ ';'                # DeleteIndexed
    | 'delete' Identifier ('.' Identifier)+ ('[' expression ']')+ ';' # DeleteMemberEntry
    | 'delete' Identifier ('.' Identifier)+ ';'                    # DeleteMember
    ;

timeOpStatement
    : 'require' '(' TxVar '>=' expression (',' requireMessage)? ')' ';'
    ;

requireStatement
    : 'require' '(' expression (',' requireMessage)? ')' ';'
    ;

ifStatement
    : 'if' '(' expression ')' ifBlock=block ('else' elseBlock=block)?
    ;

loopStatement
    : doWhileStatement
    | whileStatement
    | forStatement
    | forOfEntriesStatement
    | forInStatement
    | forOfStatement
    ;

forOfEntriesStatement
    : 'for' '(' typeName Identifier ',' typeName Identifier 'of' 'this' '.' Identifier '.' 'entries' ')' block
    ;

forInStatement
    : 'for' '(' typeName Identifier 'in' 'this' '.' Identifier ')' block
    ;

forOfStatement
    : 'for' '(' typeName Identifier 'of' 'this' '.' Identifier ')' block
    ;

forStatement
    : 'for' '(' forInit forCondition forUpdate? ')' block
    ;

forInit
    : typeName modifier* Identifier ('=' expression)? ';'
    | Identifier op=('=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^=' | '<<=' | '>>=') expression ';'
    | '(' tupleSlot (',' tupleSlot)+ ')' '=' ('(' expression (',' expression)+ ')' | expression) ';'
    | ';'
    ;

forCondition
    : expression? ';'
    ;

forUpdate
    : Identifier op=('=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^=' | '<<=' | '>>=') expression
    | Identifier op=('++' | '--')
    | op=('++' | '--') Identifier
    | '(' tupleSlot (',' tupleSlot)+ ')' '=' ('(' expression (',' expression)+ ')' | expression)
    ;

doWhileStatement
    : 'do' block 'while' '(' expression ')' ';'
    ;

whileStatement
    : 'while' '(' expression ')' block
    ;

consoleStatement
    : 'console.log' consoleParameterList ';'
    ;

assemblyStatement
    : 'assembly' StringLiteral? ('(' StringLiteral (',' StringLiteral)* ')')? yulBlock
    ;

// Yul sub-grammar (Solidity inline assembly). A block of only bare paths/literals (OP_* opcodes) is
// classified as native BCH-ASM in the builder; any structural Yul (let/:=/call/control-flow) is Yul.
yulBlock
    : '{' yulStatement* '}'
    ;

yulStatement
    : yulBlock                       # YulNestedBlockStmt
    | yulVariableDeclaration         # YulVarDeclStmt
    | yulAssignment                  # YulAssignStmt
    | yulIf                          # YulIfStmt
    | yulSwitch                      # YulSwitchStmt
    | yulForLoop                     # YulForStmt
    | yulFunctionDefinition          # YulFunctionDefStmt
    | 'break'                        # YulBreakStmt
    | 'continue'                     # YulContinueStmt
    | 'leave'                        # YulLeaveStmt
    | yulFunctionCall                # YulCallStmt
    | yulPath                        # YulPathStmt
    | yulLiteral                     # YulLiteralStmt
    ;

yulVariableDeclaration
    : 'let' anyIdentifier (',' anyIdentifier)* (':=' yulExpression)?
    ;

yulAssignment
    : yulPath (',' yulPath)* ':=' yulExpression
    ;

yulIf
    : 'if' yulExpression yulBlock
    ;

yulSwitch
    : 'switch' yulExpression (yulCase+ yulDefault? | yulDefault)
    ;

yulCase
    : 'case' yulLiteral yulBlock
    ;

yulDefault
    : 'default' yulBlock
    ;

yulForLoop
    : 'for' yulBlock yulExpression yulBlock yulBlock
    ;

yulFunctionDefinition
    : 'function' Identifier '(' (Identifier (',' Identifier)*)? ')' ('->' Identifier (',' Identifier)*)? yulBlock
    ;

yulExpression
    : yulFunctionCall
    | yulPath
    | yulLiteral
    ;

yulFunctionCall
    : yulFunctionName '(' (yulExpression (',' yulExpression)*)? ')'
    ;

// Yul builtin names that collide with solidc keyword tokens (so they are not lexed as Identifier).
// `byte` is the BoundedBytes token (a bytesN type), referenced directly so we do not mint a rival token.
yulFunctionName
    : Identifier
    | 'return' | 'revert' | 'selfdestruct' | 'address'
    | BoundedBytes
    ;

yulPath
    // `.length`/`.slot`/`.offset` calldata & storage accessors: `.offset` lexes as `.` + identifier, but
    // `.length` is a single DotLength token (like `.value`), so accept it explicitly in the member chain.
    : anyIdentifier ('.' anyIdentifier | '.length')*
    ;

yulLiteral
    : NumberLiteral
    | HexLiteral
    | HexStringLiteral
    | StringLiteral
    | BooleanLiteral
    ;

uncheckedStatement
    : 'unchecked' '{' statement* '}'
    ;

switchStatement
    : 'switch' '(' expression ')' '{' switchCase* switchDefault? '}'
    ;

switchCase
    : 'case' expression ':' statement*
    ;

switchDefault
    : 'default' ':' statement*
    ;

tryCatchStatement
    : 'try' expression tryReturns? tryBlock=block catchClause+
    ;

tryReturns
    : 'returns' '(' (parameter (',' parameter)* ','?)? ')'
    ;

catchClause
    : 'catch' Identifier? ('(' (parameter (',' parameter)* ','?)? ')')? catchBlock=block
    ;

breakStatement
    : 'break' ';'
    ;

continueStatement
    : 'continue' ';'
    ;

requireMessage
    : StringLiteral
    | Identifier expressionList
    | expression
    ;

revertStatement
    : 'revert' anyIdentifier ('.' Identifier)? '(' '{' (namedArg (',' namedArg)* ','?)? '}' ')' ';'
    | 'revert' anyIdentifier ('.' Identifier)? expressionList ';'
    | 'revert' '(' expression ')' ';'
    | 'revert' '(' ')' ';'
    ;

assertStatement
    : 'assert' '(' expression ')' ';'
    ;

consoleParameter
    : Identifier
    | literal
    ;

consoleParameterList
    : '(' (consoleParameter (',' consoleParameter)* ','?)? ')'
    ;

functionCall
    : Identifier expressionList // Only built-in functions are accepted
    | Identifier '.' Identifier expressionList // Namespaced function call (e.g. SafeMath.add(...))
    | Identifier '(' '{' (namedArg (',' namedArg)* ','?)? '}' ')' // Named-arg struct initialization (e.g. Person({name: "Alice", age: 30}))
    // Redundant parentheses around a SIMPLE callee: `(foo)(args)` / `(L.f)(args)` / `(blockhash)(n)`. Solidity
    // allows parenthesising a callable; the AST builder unwraps to the same call. A parenthesised NON-simple
    // callee (`(b ? f : g)()`, `x()()`) is a function-pointer form, not matched here.
    | '(' Identifier ')' expressionList
    | '(' Identifier '.' Identifier ')' expressionList
    ;

namedArg
    : Identifier ':' expression
    ;

expressionList
    : '(' (expression (',' expression)* ','?)? ')'
    ;

callOptions
    : '{' callOption (',' callOption)* ','? '}'
    ;

callOption
    : Identifier ':' expression
    ;

typeList
    : '(' typeListItem (',' typeListItem)* ','? ')'
    ;

typeListItem
    : typeName
    | arrayType
    ;

expression
    : '(' Identifier op=('=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^=' | '<<=' | '>>=') expression ')' # AssignmentExpression
    | '(' 'new' Identifier ')' callOptions expressionList # InstantiationWithOptions
    | '(' expression ')' # Parenthesised
    | '(' expression (',' expression)+ ')' # TupleExpression
    | typeCast '(' castable=expression ','? ')' # Cast
    | functionCall # FunctionCallExpression
    // Call the value of a parenthesised non-simple callee: `(cond ? f : g)(args)`, `((super).f)()`. A simple
    // parenthesised callee `(foo)(args)` is handled by functionCall above; this catches the rest (ternary etc.).
    | '(' expression ')' expressionList # ParenthesizedFunctionCall
    | 'new' Identifier callOptions? expressionList #Instantiation
    | 'new' typeName ('[' NumberLiteral? ']')+ '(' expression ')' # NewArray
    | 'new' UnboundedBytes '(' expression ')' # NewDynamicBytes
    | 'new' PrimitiveType '(' expression ')' # NewDynamicString
    | 'type' '(' typeName ')' '.' Identifier # TypeIntrospection
    | 'abi.encode' expressionList # AbiEncode
    | 'abi.encodePacked' expressionList # AbiEncodePacked
    | 'abi.encodeWithSelector' expressionList # AbiEncodeWithSelector
    | 'abi.encodeWithSignature' expressionList # AbiEncodeWithSignature
    | 'abi.encodeCall' '(' ('this' | Identifier) '.' Identifier ',' expressionList ')' # AbiEncodeCall
    | 'bytes.concat' expressionList # BytesConcat
    | 'string.concat' expressionList # StringConcat
    | 'abi.decode' '(' expression ',' typeList ')' # AbiDecode
    | 'abi.decodeAt' '(' expression ',' typeList ',' NumberLiteral ')' # AbiDecodeAt
    | element=expression '[' start=expression? ':' end=expression? ']' # IndexRangeSlice
    | expression '[' index=NumberLiteral ']' # TupleIndexOp
    | expression '[' expression ']' # ArrayAccess
    | scope='tx.outputs' '[' expression ']' op=('.value' | '.lockingBytecode' | '.tokenCategory' | '.nftCommitment' | '.tokenAmount') # UnaryIntrospectionOp
    | scope='tx.inputs' '[' expression ']' op=('.value' | '.lockingBytecode' | '.outpointTransactionHash' | '.outpointIndex' | '.unlockingBytecode' | '.sequenceNumber' | '.tokenCategory' | '.nftCommitment' | '.tokenAmount') # UnaryIntrospectionOp
    | expression op=('.reverse()' | '.length') # UnaryOp
    | left=expression op='.split' '(' right=expression ')' # BinaryOp
    | element=expression '.slice' '(' start=expression ',' end=expression ')' # Slice
    | expression '.' Identifier callOptions? '(' '{' (namedArg (',' namedArg)* ','?)? '}' ')' # MethodCallNamed
    | expression '.' Identifier callOptions? expressionList # MethodCall
    | base=expression '[' index=expression ']' expressionList # IndexedFunctionCall
    | expression memberName # FieldAccess
    | expression op=('++' | '--') # PostfixOp
    | op=('++' | '--') expression # PrefixOp
    | op=('!' | '-' | '~') expression # UnaryOp
    | <assoc=right> left=expression op='**' right=expression # BinaryOp
    | left=expression op=('*' | '/' | '%') right=expression # BinaryOp
    | left=expression op=('+' | '-') right=expression # BinaryOp
    // Solidity precedence: bitwise & ^ | bind TIGHTER than comparisons/equality (unlike C), so
    // `x & y == z` parses as `(x & y) == z`.
    | left=expression op=('>>' | '<<') right=expression # BinaryOp
    | left=expression op='&' right=expression # BinaryOp
    | left=expression op='^' right=expression # BinaryOp
    | left=expression op='|' right=expression # BinaryOp
    | left=expression op=('<' | '<=' | '>' | '>=') right=expression # BinaryOp
    | left=expression op=('==' | '!=') right=expression # BinaryOp
    | left=expression op='&&' right=expression # BinaryOp
    | left=expression op='||' right=expression # BinaryOp
    // Optional assignment tails in the branches mirror solc (its ternary operands are full expressions, so
    // `cond ? a = v : b = v` is two branch assignments). Desugared by AstBuilder at statement / initializer /
    // assignment-value scope only; anywhere else is rejected with a clear ParseError.
    | <assoc=right> condition=expression '?' ifTrue=expression (tOp=('=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^=' | '<<=' | '>>=') tVal=assignChain)? ':' ifFalse=expression (fOp=('=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^=' | '<<=' | '>>=') fVal=assignChain)? # TernaryOp
    | '[' (expression (',' expression)* ','?)? ']' # Array
    | 'this' '.' Identifier '.' Identifier '[' expression ']' memberName # OutStateMappingFieldAccess
    | 'this' '.' Identifier ('[' expression ']')+ # MappingAccess
    | 'this' '.' Identifier # StateAccess
    | 'this' # ThisExpr
    | NullaryOp # NullaryOp
    | anyIdentifier # Identifier
    | literal # LiteralExpression
    ;

memberName
    : '.' Identifier
    | '.' 'address'    // `.address` on a function pointer (address is a keyword, so not an Identifier)
    | '.value'
    | '.lockingBytecode'
    | '.tokenCategory'
    | '.nftCommitment'
    | '.tokenAmount'
    | '.outpointTransactionHash'
    | '.outpointIndex'
    | '.unlockingBytecode'
    | '.sequenceNumber'
    | '.code'
    | '.codehash'
    ;

modifier
    : 'constant'
    | 'packed'
    | 'memory'
    | 'calldata'
    | 'storage'
    | 'immutable'
    | 'transient'
    ;

// Data location on a parameter/return inside a function TYPE (`function(string memory) external`). Solidity
// requires it for reference types; on BCH it is inert (values are not location-tagged), so it is parsed and
// discarded. Kept separate from `modifier` so only the three real data locations are accepted here.
dataLocation
    : 'memory'
    | 'calldata'
    | 'storage'
    ;

literal
    : BooleanLiteral
    | numberLiteral
    | decimalLiteral
    | StringLiteral (StringLiteral)*
    | UnicodeLiteral
    | HexStringLiteral
    | DateLiteral
    | HexLiteral
    ;

numberLiteral
    : NumberLiteral (NumberUnit | BchUnit)?
    ;

decimalLiteral
    : DecimalLiteral (NumberUnit | BchUnit)?
    ;

typeName
    : 'address' 'payable'
    | 'address'
    | PrimitiveType
    | CryptoType
    | BoundedBytes
    | UnboundedBytes
    | BoundedSignedInt
    | BoundedUnsignedInt
    | 'fixed'
    | 'ufixed'
    | BoundedSignedFixed
    | BoundedUnsignedFixed
    | 'function' '(' (typeName dataLocation? (',' typeName dataLocation?)*)? ')' ('pure' | 'view' | 'internal' | 'external' | 'payable')* ('returns' '(' typeName dataLocation? (',' typeName dataLocation?)* ')')?
    | Identifier '.' Identifier
    | Identifier
    ;

typeCast
    : PrimitiveType
    | CryptoType
    | UnboundedBytes
    | BoundedBytes
    | UnsafeCast
    | BoundedSignedInt
    | BoundedUnsignedInt
    | 'fixed'
    | 'ufixed'
    | BoundedSignedFixed
    | BoundedUnsignedFixed
    | 'address'
    | 'payable'
    ;

VersionLiteral
    : [0-9]+ '.' [0-9]+ '.' [0-9]+
    ;

BooleanLiteral
    : 'true' | 'false'
    ;

NumberUnit
    : 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks'
    | 'wei' | 'gwei' | 'ether'
    ;

// BCH value units are split out (not NumberUnit) so they can double as soft identifiers (`bits`/`sats`/...
// are valid Solidity identifiers); the parser accepts them as number-literal units and as names.
BchUnit
    : 'satoshis' | 'sats' | 'finney' | 'bits' | 'bitcoin'
    ;

// No leading `-`: a minus is always the unary/binary operator (parsed via UnaryOp/BinaryOp). Lexing `-1` as a
// single literal made `i-1` tokenize as `i` `-1` (two operands) - breaking every unspaced `x-1`, `a[i-1]`, etc.
DecimalLiteral
    : NumberPart '.' [0-9]+ ExponentPart?
    ;

NumberLiteral
    : NumberPart ExponentPart?
    ;

fragment NumberPart
    : [0-9]+ ('_' [0-9]+)*
    ;

// Solidity scientific notation allows a negative exponent (200e-2 == 2); a bare `2e-x` cannot match (the
// exponent needs digits), so `-` still lexes as the operator there.
fragment ExponentPart
    : [eE] '-'? NumberPart
    ;

PrimitiveType
    : 'int'
    | 'bigint'
    | 'bool'
    | 'string'
    ;

// BCH crypto types are split into their own token (not PrimitiveType) so they can double as soft identifiers
// (`pubkey`/`sig`/`datasig` are valid Solidity identifiers); the parser accepts them in type + name positions.
CryptoType
    : 'pubkey'
    | 'sig'
    | 'datasig'
    ;

UnboundedBytes
    : 'bytes'
    ;

BoundedBytes
    : 'bytes' Bound | 'byte'
    ;

Bound
    : [1-9] [0-9]*
    ;

StringLiteral
    : '"' ('\\' . | ~["\\\r\n])*? '"'
    | '\'' ('\\' . | ~['\\\r\n])*? '\''
    ;

DateLiteral
    : 'date(' StringLiteral ')'
    ;

HexLiteral
    : '0' [xX] [0-9A-Fa-f]*
    ;

TxVar
    : 'this.age'
    | 'tx.time'
    ;

UnsafeCast
    : 'unsafe_int'
    | 'unsafe_bool'
    | 'unsafe_bytes' Bound?
    | 'unsafe_byte'
    ;

BoundedSignedInt
    : 'int' Bound
    ;

BoundedUnsignedInt
    : 'uint' Bound
    ;

BoundedSignedFixed
    : 'fixed' Bound 'x' [0-9]+
    ;

BoundedUnsignedFixed
    : 'ufixed' Bound 'x' [0-9]+
    ;

NullaryOp
    : 'this.activeInputIndex'
    | 'this.activeBytecode'
    | 'this.categoryId'
    | 'tx.inputs.length'
    | 'tx.outputs.length'
    | 'tx.version'
    | 'tx.locktime'
    | 'msg.sender'
    | 'msg.value'
    | 'msg.sig'
    | 'msg.data'
    | 'tx.origin'
    | 'tx.gasprice'
    | 'block.chainid'
    | 'block.number'
    | 'block.timestamp'
    | 'block.difficulty'
    | 'block.size'
    | 'block.totalFees'
    | 'block.basefee'
    | 'block.blobbasefee'
    | 'block.gaslimit'
    | 'block.prevrandao'
    | 'block.coinbase'
    ;

UnicodeLiteral
    : 'unicode' StringLiteral
    ;

HexStringLiteral
    : 'hex' '"' [0-9a-fA-F _]* '"'
    | 'hex' '\'' [0-9a-fA-F _]* '\''
    ;

// Dotted introspection/member/method ops, each gated so it only matches at an identifier boundary (so e.g.
// `.values` lexes as `.` + `values`, not `.value` + `s`, and a field named `pushCount` is not `.push`+`Count`).
// See dotOpBoundary in @lexer::members.
DotValue : '.value' {this.dotOpBoundary()}? ;
DotLength : '.length' {this.dotOpBoundary()}? ;
DotPush : '.push' {this.dotOpBoundary()}? ;
DotPop : '.pop' {this.dotOpBoundary()}? ;
DotSplit : '.split' {this.splitOpBoundary()}? ;
DotSlice : '.slice' {this.dotOpBoundary()}? ;
DotDelete : '.delete' {this.dotOpBoundary()}? ;
DotCode : '.code' {this.dotOpBoundary()}? ;
DotCodehash : '.codehash' {this.dotOpBoundary()}? ;
DotLockingBytecode : '.lockingBytecode' {this.dotOpBoundary()}? ;
DotTokenCategory : '.tokenCategory' {this.dotOpBoundary()}? ;
DotNftCommitment : '.nftCommitment' {this.dotOpBoundary()}? ;
DotTokenAmount : '.tokenAmount' {this.dotOpBoundary()}? ;
DotOutpointTransactionHash : '.outpointTransactionHash' {this.dotOpBoundary()}? ;
DotOutpointIndex : '.outpointIndex' {this.dotOpBoundary()}? ;
DotUnlockingBytecode : '.unlockingBytecode' {this.dotOpBoundary()}? ;
DotSequenceNumber : '.sequenceNumber' {this.dotOpBoundary()}? ;

Identifier
    : [a-zA-Z_$] [a-zA-Z0-9_$]*
    ;

WHITESPACE
    : [ \t\r\n\u000C]+ -> skip
    ;

COMMENT
    : '/*' .*? '*/' -> channel(HIDDEN)
    ;

LINE_COMMENT
    : '//' ~[\r\n]* -> channel(HIDDEN)
    ;
