import { ArrayType, IntType } from '@solidcash/utils';
import {
  ArrayAccessNode, ArrayAssignNode, ArrayNode, AssemblyStatementNode, AssignNode, BlockNode,
  CatchClauseNode, CollectionIterationNode, ConstantDefinitionNode, ContractNode, DeleteLocalNode,
  ExpressionNode, FunctionCallNode, FunctionDefinitionNode, IdentifierNode, IntLiteralNode, Node,
  ReturnNode, SourceFileNode, StatementNode, TupleAssignmentNode, VariableDefinitionNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Coalesce fresh bounded integer array writes and forward complete fixed-array external return projections.
 *
 * The default allocation is pure, each omitted bounds check is statically true, and ascending indices retain
 * the exact evaluation order of the right-hand sides. Stop before any self-read or non-matching statement, so
 * later dependent writes still observe the initialized array. External return forwarding is restricted to a
 * canonical memory local with a fresh origin; the ABI boundary cannot expose an array alias. A small bound avoids
 * expanding huge declarations.
 */
export default class OptimizeFixedArrayValues extends AstTraversal {
  private constantIndices = new Map<string, bigint>();
  private contractFunctions = new Map<string, FunctionDefinitionNode[]>();
  private returnArrayLocals = new Map<string, VariableDefinitionNode>();
  private currentExternalReturn?: ArrayType;

  visitSourceFile(node: SourceFileNode): Node {
    this.constantIndices = literalIntegerConstants(node.constantDefinitions);
    return super.visitSourceFile(node);
  }

  visitContract(node: ContractNode): Node {
    const fileConstants = this.constantIndices;
    const previousFunctions = this.contractFunctions;
    this.constantIndices = new Map([...fileConstants, ...literalIntegerConstants(node.constantDefinitions)]);
    this.contractFunctions = new Map();
    for (const fn of node.functions) {
      const overloads = this.contractFunctions.get(fn.name) ?? [];
      overloads.push(fn);
      this.contractFunctions.set(fn.name, overloads);
    }
    for (const binding of [...node.parameters, ...node.stateVariables, ...node.collections]) {
      this.constantIndices.delete(binding.name);
    }
    const result = super.visitContract(node);
    this.constantIndices = fileConstants;
    this.contractFunctions = previousFunctions;
    return result;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const outerConstants = this.constantIndices;
    const previousReturn = this.currentExternalReturn;
    const previousLocals = this.returnArrayLocals;
    this.constantIndices = new Map(outerConstants);
    const shadowed = new Set([...node.parameters.map((parameter) => parameter.name), ...node.returnNames]);
    walkNodes(node.body, (child) => {
      if (child instanceof VariableDefinitionNode) shadowed.add(child.name);
      if (child instanceof TupleAssignmentNode) {
        for (const element of child.elements) if (element.name) shadowed.add(element.name);
      }
      if (child instanceof CollectionIterationNode) {
        if (child.keyName) shadowed.add(child.keyName);
        if (child.valueName) shadowed.add(child.valueName);
      }
      if (child instanceof CatchClauseNode) {
        for (const parameter of child.parameters ?? []) shadowed.add(parameter.name);
      }
    });
    for (const name of shadowed) this.constantIndices.delete(name);
    const returnType = node.returnTypes.length === 1 ? node.returnTypes[0] : undefined;
    this.currentExternalReturn = node.visibility === 'external' && returnType instanceof ArrayType
      && returnType.elementType instanceof IntType && returnType.bound !== undefined
      && Number.isInteger(returnType.bound) && returnType.bound >= 2 && returnType.bound <= 16
      ? returnType : undefined;
    this.returnArrayLocals = this.currentExternalReturn ? this.collectReturnArrayLocals(node) : new Map();
    const result = super.visitFunctionDefinition(node);
    this.constantIndices = outerConstants;
    this.currentExternalReturn = previousReturn;
    this.returnArrayLocals = previousLocals;
    return result;
  }

  visitReturn(node: ReturnNode): Node {
    const projection = node.expressions.length === 1 ? node.expressions[0] : undefined;
    const bound = this.currentExternalReturn?.bound;
    if (projection instanceof ArrayNode && bound !== undefined && projection.elements.length === bound) {
      const source = projection.elements[0];
      const name = source instanceof ArrayAccessNode && source.array instanceof IdentifierNode
        ? source.array.name : undefined;
      if (name && this.returnArrayLocals.has(name)
        && projection.elements.every((element, index) => element instanceof ArrayAccessNode
          && element.array instanceof IdentifierNode && element.array.name === name
          && this.constantIndex(element.index) === BigInt(index))) {
        // An external result is serialized at the ABI boundary: no memory alias escapes. All indexed reads
        // reconstruct exactly the same fixed array in the same order, so forward its canonical value instead.
        const forwarded = new IdentifierNode(name);
        forwarded.location = projection.location;
        node.expressions = [forwarded];
      }
    }
    return super.visitReturn(node);
  }

  private collectReturnArrayLocals(fn: FunctionDefinitionNode): Map<string, VariableDefinitionNode> {
    const declarations = new Map<string, VariableDefinitionNode[]>();
    const invalid = new Set<string>([...fn.parameters.map((param) => param.name), ...fn.returnNames]);
    let hasAssembly = false;
    walkNodes(fn.body, (child) => {
      if (child instanceof VariableDefinitionNode) {
        const names = declarations.get(child.name) ?? [];
        names.push(child);
        declarations.set(child.name, names);
      } else if (child instanceof AssignNode && child.identifier instanceof IdentifierNode) {
        invalid.add(child.identifier.name);
      } else if (child instanceof TupleAssignmentNode) {
        for (const element of child.elements) if (element.name) invalid.add(element.name);
      } else if (child instanceof DeleteLocalNode) {
        invalid.add(child.identifier.name);
      } else if (child instanceof AssemblyStatementNode) {
        // Assembly can mutate the buffer or its header through a pointer alias.
        hasAssembly = true;
      }
    });
    const eligible = new Map<string, VariableDefinitionNode>();
    for (const [name, copies] of declarations) {
      if (hasAssembly || copies.length !== 1 || invalid.has(name)) continue;
      const [declaration] = copies;
      if (!declaration.modifier.includes('memory')
        || !sameBoundedIntArray(declaration.type, this.currentExternalReturn!)
        || !this.hasFreshArrayOrigin(declaration.expression, declaration.type as ArrayType)) continue;
      eligible.set(name, declaration);
    }
    return eligible;
  }

  private hasFreshArrayOrigin(expression: ExpressionNode | undefined, arrayType: ArrayType): boolean {
    if (expression === undefined) return true;
    if (expression instanceof ArrayNode) return expression.elements.length === arrayType.bound;
    if (!(expression instanceof FunctionCallNode)) return false;
    const helpers = this.contractFunctions.get(expression.identifier.name);
    if (helpers?.length !== 1) return false;
    const [helper] = helpers;
    if ((helper.visibility !== 'internal' && helper.visibility !== 'private')
      || helper.returnTypes.length !== 1 || !sameBoundedIntArray(helper.returnTypes[0], arrayType)) return false;
    const final = helper.body.statements?.at(-1);
    if (!(final instanceof ReturnNode) || final.expressions.length !== 1
      || !(final.expressions[0] instanceof IdentifierNode)) return false;
    const returnedName = final.expressions[0].name;
    if (helper.parameters.some((param) => param.name === returnedName)
      || helper.returnNames.includes(returnedName)) return false;
    let fresh: VariableDefinitionNode | undefined;
    let unsafe = false;
    walkNodes(helper.body, (child) => {
      if (child instanceof VariableDefinitionNode && child.name === returnedName) {
        if (fresh) unsafe = true;
        fresh = child;
      } else if (child instanceof ReturnNode && child !== final) unsafe = true;
      else if (child instanceof AssignNode && child.identifier instanceof IdentifierNode
        && child.identifier.name === returnedName) unsafe = true;
      else if (child instanceof TupleAssignmentNode
        && child.elements.some((element) => element.name === returnedName)) unsafe = true;
      else if (child instanceof DeleteLocalNode && child.identifier.name === returnedName) unsafe = true;
      else if (child instanceof AssemblyStatementNode) unsafe = true;
    });
    return !unsafe && fresh !== undefined && sameBoundedIntArray(fresh.type, arrayType)
      && fresh.modifier.includes('memory') && helper.body.statements?.includes(fresh) === true
      && (fresh.expression === undefined
        || (fresh.expression instanceof ArrayNode && fresh.expression.elements.length === arrayType.bound));
  }

  visitBlock(node: BlockNode): Node {
    if (node.statements) node.statements = this.coalesce(node.statements);
    return super.visitBlock(node);
  }

  private coalesce(statements: StatementNode[]): StatementNode[] {
    const out: StatementNode[] = [];
    for (let i = 0; i < statements.length;) {
      const declaration = statements[i];
      if (!(declaration instanceof VariableDefinitionNode)
        || declaration.expression !== undefined
        || !(declaration.type instanceof ArrayType)
        || !(declaration.type.elementType instanceof IntType)
        || declaration.type.bound === undefined
        || !Number.isInteger(declaration.type.bound)
        || declaration.type.bound < 2
        || declaration.type.bound > 16) {
        out.push(declaration);
        i += 1;
        continue;
      }

      const bound = declaration.type.bound;
      const writes: Array<{ index: number; value: ExpressionNode }> = [];
      let lastIndex = -1;
      let j = i + 1;
      while (j < statements.length) {
        const write = statements[j];
        const indexValue = write instanceof ArrayAssignNode ? this.constantIndex(write.index) : undefined;
        if (!(write instanceof ArrayAssignNode) || write.name !== declaration.name
          || indexValue === undefined
          || indexValue <= BigInt(lastIndex)
          || indexValue >= BigInt(bound)
          || referencesIdentifier(write.value, declaration.name)) break;
        const index = Number(indexValue);
        writes.push({ index, value: write.value });
        lastIndex = index;
        j += 1;
      }
      if (writes.length < 2) {
        out.push(declaration);
        i += 1;
        continue;
      }

      const elements = Array.from({ length: bound }, () => {
        const zero = new IntLiteralNode(0n);
        zero.location = declaration.location;
        return zero as ExpressionNode;
      });
      for (const write of writes) elements[write.index] = write.value;
      const literal = new ArrayNode(elements);
      literal.location = declaration.location;
      // Strictly ascending indexes below `bound` cover 0..bound-1 exactly when every slot was written.
      // A shorter run still folds, and the zero-filled holes stay visible to key replay.
      literal.coalescedPartial = writes.length !== bound;
      declaration.expression = literal;
      out.push(declaration);
      i = j;
    }
    return out;
  }

  private constantIndex(index: ExpressionNode): bigint | undefined {
    if (index instanceof IntLiteralNode) return index.value;
    if (index instanceof IdentifierNode) return this.constantIndices.get(index.name);
    return undefined;
  }
}

function literalIntegerConstants(definitions: ConstantDefinitionNode[]): Map<string, bigint> {
  return new Map(definitions.flatMap((definition) => (
    definition.expression instanceof IntLiteralNode ? [[definition.name, definition.expression.value]] : []
  )));
}

function sameBoundedIntArray(left: unknown, right: unknown): boolean {
  return left instanceof ArrayType && right instanceof ArrayType
    && left.bound !== undefined && left.bound === right.bound
    && left.elementType instanceof IntType && right.elementType instanceof IntType
    && left.elementType.signed === right.elementType.signed
    && left.elementType.bits === right.elementType.bits;
}

function walkNodes(root: unknown, visit: (node: Node) => void): void {
  const seen = new WeakSet<object>();
  const scan = (value: unknown): void => {
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (value instanceof Node) visit(value);
    if (Array.isArray(value)) { value.forEach(scan); return; }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'type' || key === 'location' || key === 'symbolTable' || key === 'definition') continue;
      scan(child);
    }
  };
  scan(root);
}

function referencesIdentifier(root: ExpressionNode, name: string): boolean {
  const seen = new WeakSet<object>();
  const scan = (value: unknown): boolean => {
    if (value instanceof IdentifierNode && value.name === name) return true;
    if (value === null || typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    if (Array.isArray(value)) return value.some(scan);
    return Object.entries(value).some(([key, child]) => {
      if (key === 'type' || key === 'location' || key === 'symbolTable' || key === 'definition') return false;
      return scan(child);
    });
  };
  return scan(root);
}
