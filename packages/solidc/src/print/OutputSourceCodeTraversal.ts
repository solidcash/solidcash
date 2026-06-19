import { binToHex } from '@bitauth/libauth';
import { SymbolTable } from '../ast/SymbolTable.js';
import {
  Node,
  SourceFileNode,
  ContractNode,
  ParameterNode,
  VariableDefinitionNode,
  FunctionDefinitionNode,
  AssignNode,
  IdentifierNode,
  BranchNode,
  CastNode,
  FunctionCallNode,
  UnaryOpNode,
  BinaryOpNode,
  BoolLiteralNode,
  IntLiteralNode,
  DecimalLiteralNode,
  HexLiteralNode,
  StringLiteralNode,
  StatementNode,
  BlockNode,
  TimeOpNode,
  ArrayNode,
  TupleIndexOpNode,
  RequireNode,
  InstantiationNode,
  TupleAssignmentNode,
  NullaryOpNode,
  ConsoleStatementNode,
  ConsoleParameterNode,
  SliceNode,
  DoWhileNode,
  WhileNode,
  AssemblyStatementNode,
  StateVariableNode,
  StateAccessNode,
  StateAssignNode,
  CollectionNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingFieldAssignNode,
  DeleteLocalNode,
  DeleteStateNode,
  MappingDeleteNode,
  AbiEncodeNode,
  AbiEncodePackedNode,
  AbiEncodeWithSelectorNode,
  AbiEncodeWithSignatureNode,
  AbiEncodeCallNode,
  BytesConcatNode,
  StringConcatNode,
  AbiDecodeNode,
  AbiDecodeAtNode,
  StructDefinitionNode,
  EnumDefinitionNode,
  FieldAccessNode,
  EventDefinitionNode,
  EmitStatementNode,
  TransferStatementNode,
  TokenContainerMethodStatementNode,
  ReturnNode,
  FunctionCallStatementNode,
  MethodCallNode,
  MethodCallStatementNode,
  ConstantDefinitionNode,
  ModifierDefinitionNode,
  PlaceholderStatementNode,
  TernaryOpNode,
  BreakNode,
  ContinueNode,
  TryCatchNode,
  CatchClauseNode,
  ArrayAccessNode,
  ArrayPushNode,
  ArrayPopNode,
  ArrayAssignNode,
  ArrayDeleteNode,
  StateArrayPushNode,
  StateArrayPopNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
  StateVariableVisibility,
  ErrorDefinitionNode,
  RevertNode,
  AssertNode,
  AddressTransferStatementNode,
  AddressSendExpressionNode,
  AddressConnectNode,
  TypeDefinitionNode,
  InterfaceNode,
  LowLevelCallNode,
  LowLevelCallStatementNode,
  CallOptions,
  CollectionIterationNode,
  CollectionIterationMode,
  TypeIntrospectionNode,
  FunctionModifier,
  UncheckedNode,
  SwitchNode,
  SwitchCaseNode,
  UsingForDirectiveNode,
} from '../ast/AST.js';
import { AddressType, ConnectedAddressType, MappingType, Type } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

export default class OutputSourceCodeTraversal extends AstTraversal {
  private indentationLevel: number = 0;
  output: string = '';
  private currentContract?: ContractNode;

  private addOutput(s: string, indent: boolean = false): void {
    s = indent ? `${this.getIndentation()}${s}` : s;
    this.output += s;
  }

  private getIndentation(): string {
    return '    '.repeat(this.indentationLevel);
  }

  private indent(): void {
    this.indentationLevel += 1;
  }

  private unindent(): void {
    this.indentationLevel -= 1;
  }

  private outputSymbolTable(symbolTable?: SymbolTable): void {
    if (!symbolTable) return;
    this.addOutput(` --> ST: ${symbolTable}`);
  }

  visitSourceFile(node: SourceFileNode): Node {
    for (const cd of node.constantDefinitions) {
      this.visitConstantDefinition(cd);
    }
    for (const ed of node.enumDefinitions) {
      this.visitEnumDefinition(ed);
    }
    for (const sd of node.structDefinitions) {
      this.visitStructDefinition(sd);
    }
    for (const td of node.typeDefinitions) {
      this.visitTypeDefinition(td);
    }
    for (const ufd of node.usingForDirectives) {
      this.visitUsingForDirective(ufd);
    }
    for (const ev of node.eventDefinitions) {
      this.visitEventDefinition(ev);
    }
    for (const iface of node.interfaceDefinitions) {
      this.visitInterfaceDefinition(iface);
    }
    for (const func of node.freeFunctions) {
      this.visitFunctionDefinition(func);
      this.addOutput('\n');
    }
    node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitInterfaceDefinition(node: InterfaceNode): Node {
    this.addOutput(`interface ${node.name}`, true);
    if (node.parents.length > 0) {
      this.addOutput(` is ${node.parents.join(', ')}`);
    }
    this.addOutput(' {\n');
    this.indent();
    for (const ed of node.enumDefinitions) {
      this.visitEnumDefinition(ed);
    }
    for (const sd of node.structDefinitions) {
      this.visitStructDefinition(sd);
    }
    for (const td of node.typeDefinitions) {
      this.visitTypeDefinition(td);
    }
    for (const ev of node.eventDefinitions) {
      this.visitEventDefinition(ev);
    }
    for (const sv of node.stateVariables) {
      this.addOutput(`public ${sv.type} ${sv.name};\n`, true);
    }
    for (const col of node.collections) {
      this.addOutput(`public ${col.type} ${col.name};\n`, true);
    }
    for (const fn of node.functions) {
      this.addOutput(`function ${fn.name}(`, true);
      const paramStrs = fn.parameters.map((p: ParameterNode) => `${p.type} ${p.name}`);
      this.addOutput(paramStrs.join(', '));
      this.addOutput(')');
      if (fn.returnTypes.length > 0) {
        this.addOutput(`: ${fn.returnTypes.map((t: Type) => t.toString()).join(', ')}`);
      }
      this.addOutput(';\n');
    }
    this.unindent();
    this.addOutput('}\n', true);
    return node;
  }

  visitConstantDefinition(node: ConstantDefinitionNode): Node {
    this.addOutput(`${node.type} constant ${node.name} = `, true);
    this.visit(node.expression);
    this.addOutput(';\n');
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.currentContract = node;
    this.addOutput(`${node.isAbstract ? 'abstract ' : ''}contract ${node.name}(`, true);
    node.parameters = this.visitCommaList(node.parameters) as ParameterNode[];
    this.addOutput(') {');
    this.outputSymbolTable(node.symbolTable);
    this.addOutput('\n');

    this.indent();
    node.enumDefinitions = node.enumDefinitions.map(
      (ed) => this.visitEnumDefinition(ed) as EnumDefinitionNode,
    );
    node.structDefinitions = node.structDefinitions.map(
      (sd) => this.visitStructDefinition(sd) as StructDefinitionNode,
    );
    node.typeDefinitions = node.typeDefinitions.map(
      (td) => this.visitTypeDefinition(td) as TypeDefinitionNode,
    );
    node.eventDefinitions = node.eventDefinitions.map(
      (ed) => this.visitEventDefinition(ed) as EventDefinitionNode,
    );
    node.errorDefinitions = node.errorDefinitions.map(
      (ed) => this.visitErrorDefinition(ed) as ErrorDefinitionNode,
    );
    node.constantDefinitions = node.constantDefinitions.map(
      (cd) => this.visitConstantDefinition(cd) as ConstantDefinitionNode,
    );
    for (const ufd of node.usingForDirectives) {
      this.visitUsingForDirective(ufd);
    }
    node.stateVariables = node.stateVariables.map((sv) => this.visitStateVariable(sv) as StateVariableNode);
    node.collections = node.collections.map((coll) => this.visitCollection(coll) as CollectionNode);
    for (const mod of node.modifierDefinitions) {
      this.printModifierDefinition(mod);
    }
    if (node.constructorDef) {
      node.constructorDef = this.visitConstructorDefinition(node.constructorDef) as FunctionDefinitionNode;
    }
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    this.unindent();

    this.addOutput('}\n', true);
    return node;
  }

  private printModifierDefinition(mod: ModifierDefinitionNode): void {
    this.addOutput(`modifier ${mod.name}`, true);
    if (mod.parameters.length > 0) {
      this.addOutput('(');
      mod.parameters.forEach((p, i) => {
        this.addOutput(`${p.type} ${p.name}`);
        if (i !== mod.parameters.length - 1) this.addOutput(', ');
      });
      this.addOutput(')');
    }
    this.addOutput(' {\n');
    this.indent();
    for (const stmt of mod.statements) {
      if (stmt instanceof PlaceholderStatementNode) {
        this.addOutput('_;\n', true);
      } else {
        this.visit(stmt);
      }
    }
    this.unindent();
    this.addOutput('}\n', true);
  }

  visitStructDefinition(node: StructDefinitionNode): Node {
    this.addOutput(`struct ${node.name} {\n`, true);
    this.indent();
    for (const field of node.fields) {
      this.addOutput(`${field.type} ${field.name};\n`, true);
    }
    this.unindent();
    this.addOutput('}\n', true);
    return node;
  }

  visitEnumDefinition(node: EnumDefinitionNode): Node {
    this.addOutput(`enum ${node.name} {\n`, true);
    this.indent();
    node.members.forEach((m, i) => {
      this.addOutput(m.name, true);
      if (i !== node.members.length - 1) this.addOutput(',');
      this.addOutput('\n');
    });
    this.unindent();
    this.addOutput('}\n', true);
    return node;
  }

  visitTypeDefinition(node: TypeDefinitionNode): Node {
    this.addOutput(`type ${node.name} is ${node.valueType.underlyingType};\n`, true);
    return node;
  }

  visitUsingForDirective(node: UsingForDirectiveNode): Node {
    if (node.libraryName) {
      this.addOutput(`using ${node.libraryName} for ${node.isWildcard ? '*' : node.targetTypeName}`, true);
    } else if (node.functionBindings) {
      const bindingStrs = node.functionBindings.map((b) => {
        const name = b.funcName;
        return b.operator ? `${name} as ${b.operator}` : name;
      });
      this.addOutput(`using {${bindingStrs.join(', ')}} for ${node.isWildcard ? '*' : node.targetTypeName}`, true);
    }
    if (node.isGlobal) this.addOutput(' global');
    this.addOutput(';\n');
    return node;
  }

  visitEventDefinition(node: EventDefinitionNode): Node {
    this.addOutput(`event ${node.name}(`, true);
    node.parameters.forEach((p, i) => {
      this.addOutput(`${p.type} ${p.name}`);
      if (i !== node.parameters.length - 1) this.addOutput(', ');
    });
    this.addOutput(`)${node.isAnonymous ? ' anonymous' : ''};\n`);
    return node;
  }

  visitErrorDefinition(node: ErrorDefinitionNode): Node {
    this.addOutput(`error ${node.name}(`, true);
    node.parameters.forEach((p, i) => {
      this.addOutput(`${p.type} ${p.name}`);
      if (i !== node.parameters.length - 1) this.addOutput(', ');
    });
    this.addOutput(');\n');
    return node;
  }

  visitRevert(node: RevertNode): Node {
    if (node.errorName) {
      this.addOutput(`revert ${node.errorName}(`, true);
      node.args = this.visitCommaList(node.args);
      this.addOutput(');\n');
    } else if (node.message !== undefined) {
      this.addOutput(`revert("${node.message}");\n`, true);
    } else {
      this.addOutput('revert();\n', true);
    }
    return node;
  }

  visitAssert(node: AssertNode): Node {
    this.addOutput('assert(', true);
    node.expression = this.visit(node.expression);
    this.addOutput(');\n');
    return node;
  }

  visitEmitStatement(node: EmitStatementNode): Node {
    this.addOutput(`emit ${node.eventName}(`, true);
    node.args = this.visitCommaList(node.args);
    this.addOutput(');\n');
    return node;
  }

  visitTransferStatement(node: TransferStatementNode): Node {
    this.addOutput('this.transfer(', true);
    node.lockingBytecode = this.visit(node.lockingBytecode);
    this.addOutput(', ');
    node.amount = this.visit(node.amount);
    this.addOutput(');\n');
    return node;
  }

  visitAddressTransferStatement(node: AddressTransferStatementNode): Node {
    node.addressExpression = this.visit(node.addressExpression);
    this.addOutput('.transfer(');
    node.amount = this.visit(node.amount);
    this.addOutput(');\n');
    return node;
  }

  visitAddressSendExpression(node: AddressSendExpressionNode): Node {
    node.addressExpression = this.visit(node.addressExpression);
    this.addOutput('.send(');
    node.amount = this.visit(node.amount);
    this.addOutput(')');
    return node;
  }

  visitAddressConnect(node: AddressConnectNode): Node {
    node.addressExpression = this.visit(node.addressExpression);
    this.addOutput('.connect(');
    node.categoryExpression = this.visit(node.categoryExpression);
    this.addOutput(')');
    return node;
  }

  visitTokenContainerMethodStatement(node: TokenContainerMethodStatementNode): Node {
    this.addOutput('this.tokens[', true);
    node.tokenContainerKeyExpression = this.visit(node.tokenContainerKeyExpression);
    this.addOutput(`].${node.methodName}(`);
    node.args = this.visitCommaList(node.args);
    this.addOutput(');\n');
    return node;
  }

  visitFieldAccess(node: FieldAccessNode): Node {
    node.expression = this.visit(node.expression);
    this.addOutput(`.${node.name}`);
    return node;
  }

  visitTypeIntrospection(node: TypeIntrospectionNode): Node {
    this.addOutput(`type(${node.typeArgText}).${node.property}`);
    return node;
  }

  visitStateVariable(node: StateVariableNode): Node {
    const vis = node.visibility !== StateVariableVisibility.PUBLIC ? `${node.visibility} ` : '';
    const packed = node.isPacked ? 'packed ' : '';
    this.addOutput(`${vis}${node.type} ${packed}${node.name};\n`, true);
    return node;
  }

  visitConstructorDefinition(node: FunctionDefinitionNode): Node {
    this.addOutput('constructor(', true);
    node.parameters = this.visitCommaList(node.parameters) as ParameterNode[];
    this.addOutput(')');

    // Print parent invocations if present
    if (this.currentContract?.parentInvocations) {
      for (const pi of this.currentContract.parentInvocations) {
        this.addOutput(` ${pi.parentName}(`);
        pi.args.forEach((arg, i) => {
          this.visit(arg);
          if (i < pi.args.length - 1) this.addOutput(', ');
        });
        this.addOutput(')');
      }
    }

    this.outputSymbolTable(node.symbolTable);
    this.addOutput(' ');

    node.body = this.visit(node.body) as BlockNode;
    this.addOutput('\n');

    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    this.addOutput(`function ${node.name}(`, true);
    node.parameters = this.visitCommaList(node.parameters) as ParameterNode[];
    this.addOutput(')');

    // Output modifiers
    if (node.modifiers.length > 0) {
      const standardModifiers = node.modifiers.filter(
        (m) => m !== FunctionModifier.SPLIT && m !== FunctionModifier.MERGE,
      ).map((m) => {
        if (m === FunctionModifier.UNSAFE && node.unsafeTier !== undefined && node.unsafeTier > 0) {
          return `unsafe(${node.unsafeTier})`;
        }
        return m;
      });
      if (standardModifiers.length > 0) {
        this.addOutput(` ${standardModifiers.join(' ')}`);
      }
      if (node.modifiers.includes(FunctionModifier.SPLIT) && node.splitCountParam) {
        this.addOutput(` split(${node.splitCountParam})`);
      }
      if (node.modifiers.includes(FunctionModifier.MERGE) && node.mergeCountParam) {
        this.addOutput(` merge(${node.mergeCountParam})`);
      }
    }

    // Output return types
    if (node.returnTypes.length > 0) {
      this.addOutput(` returns (${node.returnTypes.map((t) => t.toString()).join(', ')})`);
    }

    // Abstract functions have no body - just print semicolon
    if (node.isAbstract) {
      this.addOutput(';\n');
      return node;
    }

    this.outputSymbolTable(node.symbolTable);
    this.addOutput(' ');

    node.body = this.visit(node.body) as BlockNode;
    this.addOutput('\n');

    return node;
  }

  visitCommaList(list: Node[]): Node[] {
    return list.map((e, i) => {
      const visited = this.visit(e);
      if (i !== list.length - 1) {
        this.addOutput(', ');
      }
      return visited;
    });
  }

  visitParameter(node: ParameterNode): Node {
    this.addOutput(`${node.type} ${node.name}`);
    return node;
  }

  visitVariableDefinition(node: VariableDefinitionNode): Node {
    const modifiers = node.modifier.length > 0 ? ` ${node.modifier.join(' ')}` : '';
    if (node.expression) {
      this.addOutput(`${node.type}${modifiers} ${node.name} = `, true);
      this.visit(node.expression);
      this.addOutput(';\n');
    } else {
      this.addOutput(`${node.type}${modifiers} ${node.name};\n`, true);
    }

    return node;
  }

  visitTupleAssignment(node: TupleAssignmentNode): Node {
    const vars = node.elements.map((e) => {
      if (e.skip) return '';
      return e.existing ? e.name : `${e.type} ${e.name}`;
    }).join(', ');
    if (node.parenthesised) {
      this.addOutput(`(${vars}) = `, true);
    } else {
      this.addOutput(`${vars} = `, true);
    }
    if (node.tupleExpressions) {
      this.addOutput('(', true);
      node.tupleExpressions.forEach((e, i) => {
        if (i > 0) this.addOutput(', ', true);
        this.visit(e);
      });
      this.addOutput(')', true);
    } else {
      this.visit(node.tuple);
    }
    this.addOutput(';\n');

    return node;
  }

  visitAssign(node: AssignNode): Node {
    this.addOutput('', true);
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    this.addOutput(' = ');
    node.expression = this.visit(node.expression);
    this.addOutput(';\n');

    return node;
  }

  visitStateAccess(node: StateAccessNode): Node {
    this.addOutput(`this.${node.name}`);
    return node;
  }

  visitStateAssign(node: StateAssignNode): Node {
    this.addOutput(`this.${node.name} = `, true);
    node.expression = this.visit(node.expression);
    this.addOutput(';\n');
    return node;
  }

  visitCollection(node: CollectionNode): Node {
    const vis = node.visibility !== StateVariableVisibility.PUBLIC ? `${node.visibility} ` : '';
    const typeStr = node.type instanceof MappingType ? node.type.toSourceString() : node.type.toString();
    this.addOutput(`${vis}${typeStr} ${node.name};\n`, true);
    return node;
  }

  visitMappingAccess(node: MappingAccessNode): Node {
    if (node.isOutStateTokenContainerAccess) {
      this.addOutput(`this.outState.${node.name}`);
    } else {
      this.addOutput(`this.${node.name}`);
    }
    for (let i = 0; i < node.keys.length; i++) {
      this.addOutput('[');
      node.keys[i] = this.visit(node.keys[i]);
      this.addOutput(']');
    }
    return node;
  }

  visitMappingAssign(node: MappingAssignNode): Node {
    this.addOutput(`this.${node.name}`, true);
    for (let i = 0; i < node.keys.length; i++) {
      this.addOutput('[');
      node.keys[i] = this.visit(node.keys[i]);
      this.addOutput(']');
    }
    this.addOutput(' = ');
    node.expression = this.visit(node.expression);
    this.addOutput(';\n');
    return node;
  }

  visitMappingFieldAssign(node: MappingFieldAssignNode): Node {
    this.addOutput(`this.${node.name}`, true);
    for (let i = 0; i < node.keys.length; i++) {
      this.addOutput('[');
      node.keys[i] = this.visit(node.keys[i]);
      this.addOutput(']');
    }
    this.addOutput(`.${node.fieldName} = `);
    node.expression = this.visit(node.expression);
    this.addOutput(';\n');
    return node;
  }

  visitDeleteLocal(node: DeleteLocalNode): Node {
    this.addOutput(`delete ${node.identifier.name};\n`, true);
    return node;
  }

  visitDeleteState(node: DeleteStateNode): Node {
    this.addOutput(`delete this.${node.name};\n`, true);
    return node;
  }

  visitMappingDelete(node: MappingDeleteNode): Node {
    this.addOutput(`this.${node.name}`, true);
    // All keys except the last are bracket keys; the last goes in .delete()
    for (let i = 0; i < node.keys.length - 1; i++) {
      this.addOutput('[');
      node.keys[i] = this.visit(node.keys[i]);
      this.addOutput(']');
    }
    this.addOutput('.delete(');
    node.keys[node.keys.length - 1] = this.visit(node.keys[node.keys.length - 1]);
    this.addOutput(');\n');
    return node;
  }

  visitTimeOp(node: TimeOpNode): Node {
    this.addOutput(`require(${node.timeOp} >= `, true);
    node.expression = this.visit(node.expression);
    this.addOutput(');\n');
    return node;
  }

  visitRequire(node: RequireNode): Node {
    this.addOutput('require(', true);
    node.expression = this.visit(node.expression);

    if (node.message) {
      this.addOutput(`, "${node.message}"`);
    }

    this.addOutput(');\n');

    return node;
  }

  visitBranch(node: BranchNode): Node {
    this.addOutput('if (', true);
    node.condition = this.visit(node.condition);
    this.addOutput(') ');

    node.ifBlock = this.visit(node.ifBlock) as BlockNode;
    if (node.elseBlock) {
      this.addOutput(' else ');
      node.elseBlock = this.visit(node.elseBlock) as BlockNode;
    }

    this.addOutput('\n');

    return node;
  }

  visitTryCatch(node: TryCatchNode): Node {
    this.addOutput('try ', true);
    this.visit(node.expression);

    // Output returns clause
    if (node.returnParameters && node.returnParameters.length > 0) {
      this.addOutput(' returns (');
      node.returnParameters = this.visitCommaList(node.returnParameters) as ParameterNode[];
      this.addOutput(')');
    }

    this.addOutput(' ');
    node.tryBlock = this.visit(node.tryBlock) as BlockNode;

    for (const clause of node.catchClauses) {
      this.addOutput(' ');
      this.visitCatchClause(clause);
    }

    this.addOutput('\n');
    return node;
  }

  visitCatchClause(node: CatchClauseNode): Node {
    this.addOutput('catch');
    if (node.errorName) {
      this.addOutput(` ${node.errorName}`);
    }
    if (node.parameters && node.parameters.length > 0) {
      this.addOutput('(');
      this.visitCommaList(node.parameters);
      this.addOutput(')');
    } else if (!node.errorName) {
      // Bare catch with no error name and no parameters - just "catch"
    }
    this.addOutput(' ');
    node.block = this.visit(node.block) as BlockNode;
    return node;
  }

  visitDoWhile(node: DoWhileNode): Node {
    this.addOutput('do ', true);
    node.block = this.visit(node.block) as BlockNode;
    this.addOutput(' while (', true);
    node.condition = this.visit(node.condition);
    this.addOutput(');\n');
    return node;
  }

  visitWhile(node: WhileNode): Node {
    this.addOutput('while (', true);
    node.condition = this.visit(node.condition);
    this.addOutput(') ');
    node.block = this.visit(node.block) as BlockNode;
    return node;
  }

  visitAssemblyStatement(node: AssemblyStatementNode): Node {
    this.addOutput(`assembly { ${node.assemblyBody} }\n`, true);
    return node;
  }

  visitUnchecked(node: UncheckedNode): Node {
    this.addOutput('unchecked ', true);
    node.block = this.visit(node.block) as BlockNode;
    return node;
  }

  visitSwitch(node: SwitchNode): Node {
    this.addOutput('switch (', true);
    node.expression = this.visit(node.expression);
    this.addOutput(') {\n');
    this.indentationLevel += 1;
    for (const c of node.cases) {
      this.visit(c);
    }
    if (node.defaultCase) {
      this.addOutput('default:\n', true);
      this.indentationLevel += 1;
      if (node.defaultCase.statements) {
        for (const stmt of node.defaultCase.statements) {
          this.visit(stmt);
        }
      }
      this.indentationLevel -= 1;
    }
    this.indentationLevel -= 1;
    this.addOutput('}\n', true);
    return node;
  }

  visitSwitchCase(node: SwitchCaseNode): Node {
    this.addOutput('case ', true);
    node.value = this.visit(node.value);
    this.addOutput(':\n');
    this.indentationLevel += 1;
    if (node.body.statements) {
      for (const stmt of node.body.statements) {
        this.visit(stmt);
      }
    }
    this.indentationLevel -= 1;
    return node;
  }

  visitBreak(node: BreakNode): Node {
    this.addOutput('break;\n', true);
    return node;
  }

  visitContinue(node: ContinueNode): Node {
    this.addOutput('continue;\n', true);
    return node;
  }

  visitConsoleStatement(node: ConsoleStatementNode): Node {
    this.addOutput('console.log(', true);
    node.parameters = this.visitCommaList(node.parameters) as ConsoleParameterNode[];
    this.addOutput(');\n');
    return node;
  }

  visitBlock(node: BlockNode): Node {
    this.addOutput('{');
    this.outputSymbolTable(node.symbolTable);
    this.addOutput('\n');

    this.indent();
    node.statements = this.visitOptionalList(node.statements) as StatementNode[];
    this.unindent();
    this.addOutput('}', true);

    return node;
  }

  visitCast(node: CastNode): Node {
    // payable() is the cast keyword for AddressType(payable=true) and ConnectedAddressType(payable=true)
    if (node.type instanceof AddressType && node.type.payable) {
      this.addOutput('payable(');
    } else if (node.type instanceof ConnectedAddressType && node.type.payable) {
      this.addOutput('payable(');
    } else if (node.type instanceof AddressType && !node.type.payable) {
      this.addOutput('address(');
    } else {
      this.addOutput(`${node.isUnsafe ? 'unsafe_' : ''}${node.type}(`);
    }
    node.expression = this.visit(node.expression);
    this.addOutput(')');
    return node;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    node.identifier = this.visit(node.identifier) as IdentifierNode;

    this.addOutput('(');
    node.parameters = this.visitCommaList(node.parameters);
    this.addOutput(')');

    return node;
  }

  visitInstantiation(node: InstantiationNode): Node {
    this.addOutput('new ');
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    this.outputCallOptions(node.callOptions);

    this.addOutput('(');
    node.parameters = this.visitCommaList(node.parameters);
    this.addOutput(')');

    return node;
  }

  visitTupleIndexOp(node: TupleIndexOpNode): Node {
    node.tuple = this.visit(node.tuple);
    this.addOutput(`[${node.index}]`);
    return node;
  }

  visitSlice(node: SliceNode): Node {
    node.element = this.visit(node.element);
    this.addOutput('.slice(');
    node.start = this.visit(node.start);
    this.addOutput(', ');
    node.end = this.visit(node.end);
    this.addOutput(')');
    return node;
  }

  visitBinaryOp(node: BinaryOpNode): Node {
    if (node.operator.startsWith('.')) {
      node.left = this.visit(node.left);
      this.addOutput(`${node.operator}(`);
      node.right = this.visit(node.right);
      this.addOutput(')');
      return node;
    }

    this.addOutput('(');
    node.left = this.visit(node.left);
    this.addOutput(` ${node.operator} `);
    node.right = this.visit(node.right);
    this.addOutput(')');
    return node;
  }

  visitUnaryOp(node: UnaryOpNode): Node {
    if (node.operator.startsWith('.')) {
      this.visit(node.expression);
      this.addOutput(node.operator);
      return node;
    }

    if (node.operator.includes('[i]')) {
      const [scope, op] = node.operator.split('[i]');
      this.addOutput(scope);
      this.addOutput('[');
      this.visit(node.expression);
      this.addOutput(']');
      this.addOutput(op);
      return node;
    }

    this.addOutput('(');
    this.addOutput(node.operator);
    node.expression = this.visit(node.expression);
    this.addOutput(')');
    return node;
  }

  visitNullaryOp(node: NullaryOpNode): Node {
    this.addOutput(node.operator);
    return node;
  }

  visitTernaryOp(node: TernaryOpNode): Node {
    this.addOutput('(');
    node.condition = this.visit(node.condition);
    this.addOutput(' ? ');
    node.ifTrue = this.visit(node.ifTrue);
    this.addOutput(' : ');
    node.ifFalse = this.visit(node.ifFalse);
    this.addOutput(')');
    return node;
  }

  visitAbiEncode(node: AbiEncodeNode): Node {
    this.addOutput('abi.encode(');
    node.parameters = this.visitCommaList(node.parameters);
    this.addOutput(')');
    return node;
  }

  visitAbiEncodePacked(node: AbiEncodePackedNode): Node {
    this.addOutput('abi.encodePacked(');
    node.parameters = this.visitCommaList(node.parameters);
    this.addOutput(')');
    return node;
  }

  visitAbiEncodeWithSelector(node: AbiEncodeWithSelectorNode): Node {
    this.addOutput('abi.encodeWithSelector(');
    this.visit(node.selector);
    if (node.parameters.length > 0) { this.addOutput(', '); }
    node.parameters = this.visitCommaList(node.parameters);
    this.addOutput(')');
    return node;
  }

  visitAbiEncodeWithSignature(node: AbiEncodeWithSignatureNode): Node {
    this.addOutput('abi.encodeWithSignature(');
    this.visit(node.signature);
    if (node.parameters.length > 0) { this.addOutput(', '); }
    node.parameters = this.visitCommaList(node.parameters);
    this.addOutput(')');
    return node;
  }

  visitAbiEncodeCall(node: AbiEncodeCallNode): Node {
    this.addOutput(`abi.encodeCall(${node.interfaceName}.${node.functionName}, (`);
    node.parameters = this.visitCommaList(node.parameters);
    this.addOutput('))');
    return node;
  }

  visitBytesConcat(node: BytesConcatNode): Node {
    this.addOutput('bytes.concat(');
    node.parameters = this.visitCommaList(node.parameters);
    this.addOutput(')');
    return node;
  }

  visitStringConcat(node: StringConcatNode): Node {
    this.addOutput('string.concat(');
    node.parameters = this.visitCommaList(node.parameters);
    this.addOutput(')');
    return node;
  }

  visitAbiDecode(node: AbiDecodeNode): Node {
    this.addOutput('abi.decode(');
    node.data = this.visit(node.data);
    this.addOutput(`, (${node.schema.map((t) => t.toString()).join(', ')}))`);
    return node;
  }

  visitAbiDecodeAt(node: AbiDecodeAtNode): Node {
    this.addOutput('abi.decodeAt(');
    node.data = this.visit(node.data);
    this.addOutput(`, (${node.schema.map((t) => t.toString()).join(', ')}), ${node.index})`);
    return node;
  }

  visitArray(node: ArrayNode): Node {
    this.addOutput('[');
    node.elements = this.visitCommaList(node.elements);
    this.addOutput(']');
    return node;
  }

  visitIdentifier(node: IdentifierNode): Node {
    this.addOutput(node.name);
    return node;
  }

  visitBoolLiteral(node: BoolLiteralNode): Node {
    this.addOutput(node.value.toString());
    return node;
  }

  visitIntLiteral(node: IntLiteralNode): Node {
    this.addOutput(node.value.toString());
    return node;
  }

  visitDecimalLiteral(node: DecimalLiteralNode): Node {
    this.addOutput(node.value);
    return node;
  }

  visitStringLiteral(node: StringLiteralNode): Node {
    this.addOutput(`${node.quote}${escapeStringValue(node.value, node.quote)}${node.quote}`);
    return node;
  }

  visitReturn(node: ReturnNode): Node {
    this.addOutput('return ', true);
    node.expressions = this.visitCommaList(node.expressions);
    this.addOutput(';\n');
    return node;
  }

  visitFunctionCallStatement(node: FunctionCallStatementNode): Node {
    this.addOutput('', true);
    node.call = this.visit(node.call) as FunctionCallNode;
    this.addOutput(';\n');
    return node;
  }

  private outputCallOptions(opts?: CallOptions): void {
    if (!opts) return;
    const parts: string[] = [];
    if (opts.value) parts.push('value');
    if (opts.salt) parts.push('salt');
    if (opts.gas) parts.push('gas');
    if (parts.length === 0) return;

    this.addOutput('{');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) this.addOutput(', ');
      this.addOutput(`${parts[i]}: `);
      if (parts[i] === 'value' && opts.value) this.visit(opts.value);
      if (parts[i] === 'salt' && opts.salt) this.visit(opts.salt);
      if (parts[i] === 'gas' && opts.gas) this.visit(opts.gas);
    }
    this.addOutput('}');
  }

  visitMethodCall(node: MethodCallNode): Node {
    node.object = this.visit(node.object);
    this.addOutput(`.${node.methodName}`);
    this.outputCallOptions(node.callOptions);
    this.addOutput('(');
    node.parameters = this.visitCommaList(node.parameters);
    this.addOutput(')');
    return node;
  }

  visitMethodCallStatement(node: MethodCallStatementNode): Node {
    this.addOutput('', true);
    if (node.expression) {
      this.visit(node.expression);
    } else {
      this.visit(node.call);
    }
    this.addOutput(';\n');
    return node;
  }

  visitLowLevelCall(node: LowLevelCallNode): Node {
    this.visit(node.targetExpression);
    this.addOutput(`.${node.callMode}`);
    this.outputCallOptions(node.callOptions);
    this.addOutput('(');
    this.visit(node.data);
    this.addOutput(')');
    return node;
  }

  visitLowLevelCallStatement(node: LowLevelCallStatementNode): Node {
    this.addOutput('', true);
    this.visit(node.targetExpression);
    this.addOutput(`.${node.callMode}`);
    this.outputCallOptions(node.callOptions);
    this.addOutput('(');
    this.visit(node.data);
    this.addOutput(');\n');
    return node;
  }

  visitHexLiteral(node: HexLiteralNode): Node {
    this.addOutput(`0x${binToHex(node.value)}`);
    return node;
  }

  visitArrayAccess(node: ArrayAccessNode): Node {
    node.array = this.visit(node.array);
    this.addOutput('[');
    node.index = this.visit(node.index);
    this.addOutput(']');
    return node;
  }

  visitArrayPush(node: ArrayPushNode): Node {
    this.addOutput(`${node.name}.push(`, true);
    node.value = this.visit(node.value);
    this.addOutput(');\n');
    return node;
  }

  visitArrayPop(node: ArrayPopNode): Node {
    this.addOutput(`${node.name}.pop();\n`, true);
    return node;
  }

  visitArrayAssign(node: ArrayAssignNode): Node {
    this.addOutput(`${node.name}[`, true);
    node.index = this.visit(node.index);
    this.addOutput('] = ');
    node.value = this.visit(node.value);
    this.addOutput(';\n');
    return node;
  }

  visitArrayDelete(node: ArrayDeleteNode): Node {
    this.addOutput(`${node.name}.delete(`, true);
    node.index = this.visit(node.index);
    this.addOutput(');\n');
    return node;
  }

  visitStateArrayPush(node: StateArrayPushNode): Node {
    this.addOutput(`this.${node.name}.push(`, true);
    node.value = this.visit(node.value);
    this.addOutput(');\n');
    return node;
  }

  visitStateArrayPop(node: StateArrayPopNode): Node {
    this.addOutput(`this.${node.name}.pop();\n`, true);
    return node;
  }

  visitStateArrayAssign(node: StateArrayAssignNode): Node {
    this.addOutput(`this.${node.name}[`, true);
    node.index = this.visit(node.index);
    this.addOutput('] = ');
    node.value = this.visit(node.value);
    this.addOutput(';\n');
    return node;
  }

  visitStateArrayDelete(node: StateArrayDeleteNode): Node {
    this.addOutput(`this.${node.name}.delete(`, true);
    node.index = this.visit(node.index);
    this.addOutput(');\n');
    return node;
  }

  visitCollectionIteration(node: CollectionIterationNode): Node {
    if (node.mode === CollectionIterationMode.ENTRIES) {
      this.addOutput(`for (${node.keyType} ${node.keyName}, ${node.valueType} ${node.valueName} of this.${node.collectionName}.entries) `, true);
    } else if (node.mode === CollectionIterationMode.KEYS) {
      this.addOutput(`for (${node.keyType} ${node.keyName} in this.${node.collectionName}) `, true);
    } else {
      this.addOutput(`for (${node.valueType} ${node.valueName} of this.${node.collectionName}) `, true);
    }
    node.body = this.visit(node.body) as BlockNode;
    return node;
  }
}

function escapeStringValue(value: string, quote: string): string {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    switch (ch) {
      case '\\': result += '\\\\'; break;
      case '\n': result += '\\n'; break;
      case '\r': result += '\\r'; break;
      case '\t': result += '\\t'; break;
      default:
        if (ch === quote) {
          result += `\\${quote}`;
        } else {
          const code = ch.charCodeAt(0);
          if (code < 0x20 || code > 0x7e) {
            result += `\\x${code.toString(16).padStart(2, '0')}`;
          } else {
            result += ch;
          }
        }
    }
  }
  return result;
}
