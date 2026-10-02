import { ArrayType, IntType } from '@solidcash/utils';
import {
  ArrayAssignNode, ArrayNode, BlockNode, ConstantDefinitionNode, ContractNode, ExpressionNode,
  FunctionDefinitionNode, IdentifierNode, IntLiteralNode, Node, SourceFileNode, StatementNode,
  TupleAssignmentNode, VariableDefinitionNode, CollectionIterationNode, CatchClauseNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Build a fresh bounded integer array once when its first uses are ordered, constant-index element writes.
 *
 * The default allocation is pure, each omitted bounds check is statically true, and ascending indices retain
 * the exact evaluation order of the right-hand sides. Stop before any self-read or non-matching statement, so
 * later dependent writes still observe the initialized array. A small bound avoids expanding huge declarations.
 */
export default class CoalesceFreshFixedArrayWrites extends AstTraversal {
  private constantIndices = new Map<string, bigint>();

  visitSourceFile(node: SourceFileNode): Node {
    this.constantIndices = literalIntegerConstants(node.constantDefinitions);
    return super.visitSourceFile(node);
  }

  visitContract(node: ContractNode): Node {
    const fileConstants = this.constantIndices;
    this.constantIndices = new Map([...fileConstants, ...literalIntegerConstants(node.constantDefinitions)]);
    for (const binding of [...node.parameters, ...node.stateVariables, ...node.collections]) {
      this.constantIndices.delete(binding.name);
    }
    const result = super.visitContract(node);
    this.constantIndices = fileConstants;
    return result;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const outerConstants = this.constantIndices;
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
    const result = super.visitFunctionDefinition(node);
    this.constantIndices = outerConstants;
    return result;
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
