grammar SolidCash;

sourceFile
    : pragmaDirective* importDirective* constantDefinition* enumDefinition* structDefinition* typeDefinition* usingForDirective* errorDefinition* interfaceDefinition* freeFunctionDefinition* libraryDefinition* (contractDefinition | libraryDefinition) EOF
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
    : 'function' Identifier parameterList returnType? '{' statement* '}'
    ;

usingForDirective
    : 'using' Identifier 'for' (typeName | '*') 'global'? ';'                                                     # UsingLibraryFor
    | 'using' '{' usingFunctionBinding (',' usingFunctionBinding)* ','? '}' 'for' (typeName | '*') 'global'? ';'  # UsingFunctionsFor
    ;

usingFunctionBinding
    : Identifier ('.' Identifier)? ('as' userDefinableOperator)?
    ;

userDefinableOperator
    : '+' | '-' | '*' | '/' | '%' | '**'
    | '==' | '!=' | '<' | '<=' | '>' | '>='
    | '&' | '|' | '^' | '~'
    ;

pragmaDirective
    : 'pragma' pragmaName pragmaValue ';'
    ;

pragmaName
    : 'solidcash'
    ;

pragmaValue
    : versionConstraint versionConstraint?
    ;

versionConstraint
    : versionOperator? VersionLiteral
    ;

versionOperator
    : '^' | '~' | '>=' | '>' | '<' | '<=' | '='
    ;

interfaceDefinition
    : 'interface' Identifier ('is' Identifier (',' Identifier)*)? '{' enumDefinition* structDefinition* typeDefinition* eventDefinition* interfaceStateVariable* interfaceCollection* interfaceFunction* '}'
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
    : 'function' Identifier parameterList returnType? ';'
    ;

libraryDefinition
    : 'library' Identifier '{' enumDefinition* structDefinition* typeDefinition* eventDefinition* constantDefinition* freeFunctionDefinition* '}'
    ;

contractDefinition
    : 'abstract'? 'contract' Identifier parameterList? ('is' Identifier (',' Identifier)*)? '{' enumDefinition* structDefinition* typeDefinition* eventDefinition* errorDefinition* constantDefinition* usingForDirective* stateVariableDeclaration* modifierDefinition* constructorDefinition? (functionDefinition | abstractFunctionDefinition)* fallbackDefinition? receiveDefinition? '}'
    ;

abstractFunctionDefinition
    : 'function' Identifier parameterList functionModifier* customModifierInvocation* returnType? ';'
    ;

eventDefinition
    : 'event' Identifier '(' (eventParameter (',' eventParameter)* ','?)? ')' 'anonymous'? ';'
    ;

eventParameter
    : typeName 'indexed'? Identifier
    ;

errorDefinition
    : 'error' Identifier '(' (errorParameter (',' errorParameter)* ','?)? ')' ';'
    ;

errorParameter
    : typeName Identifier
    ;

structDefinition
    : 'struct' Identifier '{' structField+ '}'
    ;

structField
    : typeName Identifier ';'
    ;

enumDefinition
    : 'enum' Identifier '{' enumMember (',' enumMember)* ','? '}'
    ;

enumMember
    : Identifier ('=' NumberLiteral)?
    ;

typeDefinition
    : 'type' Identifier 'is' typeName ';'
    ;

constantDefinition
    : typeName 'constant' Identifier '=' expression ';'
    ;

constructorDefinition
    : 'constructor' parameterList parentInvocation* '{' statement* '}'
    ;

fallbackDefinition
    : 'fallback' parameterList 'external' fallbackModifier* customModifierInvocation* '{' statement* '}'
    ;

fallbackModifier
    : 'payable' | 'virtual' | overrideSpecifier
    ;

receiveDefinition
    : 'receive' '(' ')' 'external' 'payable' '{' statement* '}'
    ;

parentInvocation
    : Identifier expressionList
    ;

stateVariableDeclaration
    : stateVariableVisibility? typeName modifier* Identifier ';'
    | typeName stateVariableVisibility modifier* Identifier ';'
    | stateVariableVisibility? mappingType collectionModifier* Identifier ';'
    | stateVariableVisibility? arrayType collectionModifier* Identifier ';'
    ;

collectionModifier
    : modifier
    | stateVariableVisibility
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
    : typeName '[' NumberLiteral ']'
    | typeName '[' ']'
    | arrayType '[' NumberLiteral ']'
    | arrayType '[' ']'
    ;

modifierDefinition
    : 'modifier' Identifier parameterList? '{' modifierStatement* '}'
    ;

modifierStatement
    : placeholderStatement
    | statement
    ;

placeholderStatement
    : '_' ';'
    ;

functionDefinition
    : 'function' Identifier parameterList functionModifier* customModifierInvocation* returnType? '{' statement* '}'
    ;

customModifierInvocation
    : Identifier expressionList?
    ;

functionModifier
    : 'pure' | 'view' | 'internal' | 'external' | 'public' | 'private' | 'payable' | overrideSpecifier | 'virtual' | unsafeModifier | 'upgrade' | 'deploy' | 'selfdestruct' | 'delegate'
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
    : typeName modifier* Identifier?
    ;

parameterList
    : '(' (parameter (',' parameter)* ','?)? ')'
    ;

parameter
    : typeName modifier* Identifier
    | arrayType modifier* Identifier
    ;

block
    : '{' statement* '}'
    | statement
    ;

statement
    : variableDefinition
    | tupleAssignment
    | arrayAssignStatement
    | arrayPushStatement
    | arrayPopStatement
    | arrayDeleteStatement
    | stateArrayPushStatement
    | stateArrayPopStatement
    | assignStatement
    | stateAssignStatement
    | mappingFieldAssignStatement
    | mappingAssignStatement
    | mappingDeleteStatement
    | timeOpStatement
    | requireStatement
    | ifStatement
    | loopStatement
    | consoleStatement
    | emitStatement
    | transferStatement
    | tokenContainerMethodStatement
    | returnStatement
    | functionCallStatement
    | addressMethodStatement
    | assemblyStatement
    | tryCatchStatement
    | revertStatement
    | assertStatement
    | deleteStatement
    | uncheckedStatement
    | switchStatement
    | breakStatement
    | continueStatement
    ;

transferStatement
    : 'this' '.' Identifier '(' expression ',' expression ')' ';'
    ;

tokenContainerMethodStatement
    : 'this' '.' Identifier '[' expression ']' '.' Identifier '(' expression (',' expression)* ')' ';'
    ;

returnStatement
    : 'return' ';'
    | 'return' expression (',' expression)* ';'
    | 'return' '(' expression (',' expression)* ','? ')' ';'
    ;

functionCallStatement
    : Identifier expressionList ';'
    | Identifier '.' Identifier expressionList ';'
    | Identifier expressionList '.' Identifier '.' Identifier callOptions? expressionList ';'
    ;

addressMethodStatement
    : expression '.' Identifier callOptions? expressionList ';'
    ;

emitStatement
    : 'emit' Identifier expressionList ';'
    ;

mappingAssignStatement
    : 'this' '.' Identifier ('[' expression ']')+ '=' expression ';'
    ;

mappingFieldAssignStatement
    : 'this' '.' Identifier ('[' expression ']')+ '.' Identifier '=' expression ';'
    ;

mappingDeleteStatement
    : 'this' '.' Identifier ('[' expression ']')* '.delete' '(' expression ')' ';'
    ;

stateAssignStatement
    : 'this' '.' Identifier '=' expression ';'
    ;

variableDefinition
    : typeName modifier* Identifier '=' expression ';'
    | arrayType modifier* Identifier '=' expression ';'
    ;

tupleAssignment
    : typeName Identifier (',' typeName Identifier)+ '=' expression ';'
    | '(' tupleSlot (',' tupleSlot)+ ')' '=' '(' expression (',' expression)+ ')' ';'
    | '(' tupleSlot (',' tupleSlot)+ ')' '=' expression ';'
    ;

tupleSlot
    : typeName Identifier
    | Identifier
    |
    ;

assignStatement
    : Identifier op=('=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^=' | '<<=' | '>>=') expression ';'
    | Identifier op=('++' | '--') ';'
    ;

arrayPushStatement
    : Identifier '.push' '(' expression ')' ';'
    ;

arrayPopStatement
    : Identifier '.pop' '(' ')' ';'
    ;

arrayAssignStatement
    : Identifier '[' expression ']' '=' expression ';'
    ;

arrayDeleteStatement
    : Identifier '.delete' '(' expression ')' ';'
    ;

stateArrayPushStatement
    : 'this' '.' Identifier '.push' '(' expression ')' ';'
    ;

stateArrayPopStatement
    : 'this' '.' Identifier '.pop' '(' ')' ';'
    ;

deleteStatement
    : 'delete' Identifier ';'                                      # DeleteLocal
    | 'delete' 'this' '.' Identifier ';'                           # DeleteState
    | 'delete' 'this' '.' Identifier ('[' expression ']')+ ';'     # DeleteMappingEntry
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
    : 'for' '(' forInit forCondition forUpdate ')' block
    ;

forInit
    : typeName modifier* Identifier '=' expression ';'
    ;

forCondition
    : expression ';'
    ;

forUpdate
    : Identifier op=('=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^=' | '<<=' | '>>=') expression
    | Identifier op=('++' | '--')
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
    : 'assembly' '{' assemblyToken* '}'
    ;

assemblyToken
    : Identifier
    | HexLiteral
    | NumberLiteral
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
    ;

revertStatement
    : 'revert' Identifier expressionList ';'
    | 'revert' '(' StringLiteral ')' ';'
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
    : '(' typeName (',' typeName)* ','? ')'
    ;

expression
    : '(' expression ')' # Parenthesised
    | typeCast '(' castable=expression ','? ')' # Cast
    | functionCall # FunctionCallExpression
    | 'new' Identifier callOptions? expressionList #Instantiation
    | 'new' typeName '[' ']' '(' expression ')' # NewArray
    | 'type' '(' typeName ')' '.' Identifier # TypeIntrospection
    | 'abi.encode' expressionList # AbiEncode
    | 'abi.encodePacked' expressionList # AbiEncodePacked
    | 'abi.encodeWithSelector' expressionList # AbiEncodeWithSelector
    | 'abi.encodeWithSignature' expressionList # AbiEncodeWithSignature
    | 'abi.encodeCall' '(' Identifier '.' Identifier ',' expressionList ')' # AbiEncodeCall
    | 'bytes.concat' expressionList # BytesConcat
    | 'string.concat' expressionList # StringConcat
    | 'abi.decode' '(' expression ',' typeList ')' # AbiDecode
    | 'abi.decodeAt' '(' expression ',' typeList ',' NumberLiteral ')' # AbiDecodeAt
    | element=expression '[' start=expression ':' end=expression ']' # IndexRangeSlice
    | expression '[' index=NumberLiteral ']' # TupleIndexOp
    | expression '[' expression ']' # ArrayAccess
    | scope='tx.outputs' '[' expression ']' op=('.value' | '.lockingBytecode' | '.tokenCategory' | '.nftCommitment' | '.tokenAmount') # UnaryIntrospectionOp
    | scope='tx.inputs' '[' expression ']' op=('.value' | '.lockingBytecode' | '.outpointTransactionHash' | '.outpointIndex' | '.unlockingBytecode' | '.sequenceNumber' | '.tokenCategory' | '.nftCommitment' | '.tokenAmount') # UnaryIntrospectionOp
    | expression op=('.reverse()' | '.length') # UnaryOp
    | left=expression op='.split' '(' right=expression ')' # BinaryOp
    | element=expression '.slice' '(' start=expression ',' end=expression ')' # Slice
    | expression '.' Identifier callOptions? expressionList # MethodCall
    | expression memberName # FieldAccess
    | op=('!' | '-' | '~') expression # UnaryOp
    | <assoc=right> left=expression op='**' right=expression # BinaryOp
    | left=expression op=('*' | '/' | '%') right=expression # BinaryOp
    | left=expression op=('+' | '-') right=expression # BinaryOp
    | left=expression op=('>>' | '<<') right=expression # BinaryOp
    | left=expression op=('<' | '<=' | '>' | '>=') right=expression # BinaryOp
    | left=expression op=('==' | '!=') right=expression # BinaryOp
    | left=expression op='&' right=expression # BinaryOp
    | left=expression op='^' right=expression # BinaryOp
    | left=expression op='|' right=expression # BinaryOp
    | left=expression op='&&' right=expression # BinaryOp
    | left=expression op='||' right=expression # BinaryOp
    | <assoc=right> condition=expression '?' ifTrue=expression ':' ifFalse=expression # TernaryOp
    | '[' (expression (',' expression)* ','?)? ']' # Array
    | 'this' '.' Identifier '.' Identifier '[' expression ']' memberName # OutStateMappingFieldAccess
    | 'this' '.' Identifier ('[' expression ']')+ # MappingAccess
    | 'this' '.' Identifier # StateAccess
    | NullaryOp # NullaryOp
    | Identifier # Identifier
    | literal # LiteralExpression
    ;

memberName
    : '.' Identifier
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
    | 'immutable'
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
    : NumberLiteral NumberUnit?
    ;

decimalLiteral
    : DecimalLiteral
    ;

typeName
    : 'address' 'payable'
    | 'address'
    | PrimitiveType
    | BoundedBytes
    | UnboundedBytes
    | BoundedSignedInt
    | BoundedUnsignedInt
    | 'fixed'
    | 'ufixed'
    | BoundedSignedFixed
    | BoundedUnsignedFixed
    | 'function' '(' (typeName (',' typeName)*)? ')' ('returns' '(' typeName (',' typeName)* ')')?
    | Identifier
    ;

typeCast
    : PrimitiveType
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
    : 'satoshis' | 'sats' | 'finney' | 'bits' | 'bitcoin'
    | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks'
    ;

DecimalLiteral
    : '-'? NumberPart '.' [0-9]+
    ;

NumberLiteral
    : '-'? NumberPart ExponentPart?
    ;

NumberPart
    : [0-9]+ ('_' [0-9]+)*
    ;

ExponentPart
    : [eE] NumberPart
    ;

PrimitiveType
    : 'int'
    | 'bool'
    | 'string'
    | 'pubkey'
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
    | 'tx.inputs.length'
    | 'tx.outputs.length'
    | 'tx.version'
    | 'tx.locktime'
    | 'msg.sender'
    | 'msg.value'
    | 'msg.sig'
    | 'msg.data'
    | 'tx.origin'
    ;

UnicodeLiteral
    : 'unicode' StringLiteral
    ;

HexStringLiteral
    : 'hex' '"' [0-9a-fA-F _]* '"'
    | 'hex' '\'' [0-9a-fA-F _]* '\''
    ;

Identifier
    : [a-zA-Z_] [a-zA-Z0-9_]*
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
