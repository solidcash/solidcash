import { ArrayType, StructType } from '@solidcash/utils';
import {
  ArrayAccessNode, AssignmentExpressionNode, BlockNode, BoolLiteralNode, CastNode,
  ContractNode, ExpressionNode, FieldAccessNode, FunctionCallNode, HexLiteralNode,
  IdentifierNode, IndirectCallNode, InstantiationNode, IntLiteralNode, MappingAccessNode,
  Node, NullaryOpNode, SourceFileNode, StateAccessNode, StateArrayAssignNode, StatementNode,
  StringLiteralNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

interface FieldWrite {
  assign: StateArrayAssignNode;
  ctor: FunctionCallNode;
  fieldIndex: number;
  value: ExpressionNode;
}

/**
 * One `arr[i].field = value` is lowered by AstBuilder to a whole-element struct constructor. Consecutive
 * writes to different fields of the same element otherwise reread and rebuild that element once per field;
 * inside a pooled row loop each rebuild also performs the variable-width array surgery. Coalesce only when
 * the index is stable and values cannot read the changing element or have side effects.
 */
export default class CoalesceStateArrayStructFieldWrites extends AstTraversal {
  private arrays = new Map<string, StructType>();

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.arrays = new Map();
    for (const variable of node.stateVariables) {
      if (variable.type instanceof ArrayType && variable.type.elementType instanceof StructType) {
        this.arrays.set(variable.name, variable.type.elementType);
      }
    }
    if (this.arrays.size === 0) return node;
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as typeof node.constructorDef;
    node.functions = this.visitList(node.functions) as typeof node.functions;
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as typeof node.fallbackDef;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as typeof node.receiveDef;
    return node;
  }

  visitBlock(node: BlockNode): Node {
    if (node.statements) node.statements = this.coalesce(node.statements);
    return super.visitBlock(node);
  }

  private coalesce(statements: StatementNode[]): StatementNode[] {
    const out: StatementNode[] = [];
    for (let index = 0; index < statements.length;) {
      const first = this.match(statements[index]);
      if (!first) { out.push(statements[index]); index += 1; continue; }
      const writes = [first];
      const fields = new Set([first.fieldIndex]);
      let end = index + 1;
      while (end < statements.length) {
        const next = this.match(statements[end]);
        if (!next || next.assign.name !== first.assign.name
          || !this.sameIndex(next.assign.index, first.assign.index)
          || fields.has(next.fieldIndex)) break;
        writes.push(next);
        fields.add(next.fieldIndex);
        end += 1;
      }
      if (writes.length === 1) {
        out.push(statements[index]);
      } else {
        const last = writes[writes.length - 1];
        const combined = cloneNode(last.assign) as StateArrayAssignNode;
        const ctor = combined.value as FunctionCallNode;
        for (const write of writes) {
          ctor.parameters[write.fieldIndex] = cloneNode(write.value) as ExpressionNode;
        }
        // All source values are independent of this element and have no effects, so field-order evaluation of
        // the one constructor is equivalent to the original sequence of whole-element assignments.
        out.push(combined);
      }
      index = end;
    }
    return out;
  }

  private match(statement: StatementNode): FieldWrite | undefined {
    if (!(statement instanceof StateArrayAssignNode)) return undefined;
    const struct = this.arrays.get(statement.name);
    if (!struct || !this.stableIndex(statement.index)
      || this.hasEffectsOrTargetRead(statement.index, statement.name)) return undefined;
    if (!(statement.value instanceof FunctionCallNode)
      || !(statement.value.identifier instanceof IdentifierNode)
      || statement.value.identifier.name !== struct.name
      || statement.value.fieldNames !== undefined
      || statement.value.parameters.length !== struct.fields.length) return undefined;
    const ctor = statement.value;
    let changed = -1;
    for (let fieldIndex = 0; fieldIndex < struct.fields.length; fieldIndex += 1) {
      const arg = ctor.parameters[fieldIndex];
      if (this.isOriginalFieldRead(arg, statement, struct.fields[fieldIndex].name)) continue;
      if (changed >= 0 || this.hasEffectsOrTargetRead(arg, statement.name)) return undefined;
      changed = fieldIndex;
    }
    return changed < 0 ? undefined : { assign: statement, ctor, fieldIndex: changed,
      value: ctor.parameters[changed] };
  }

  private isOriginalFieldRead(
    expression: ExpressionNode, assign: StateArrayAssignNode, field: string,
  ): boolean {
    return expression instanceof FieldAccessNode && expression.name === field
      && expression.expression instanceof ArrayAccessNode
      && expression.expression.array instanceof IdentifierNode
      && expression.expression.array.name === assign.name
      && this.sameIndex(expression.expression.index, assign.index);
  }

  private stableIndex(expression: ExpressionNode): boolean {
    if (expression instanceof IdentifierNode || expression instanceof IntLiteralNode
      || expression instanceof BoolLiteralNode || expression instanceof HexLiteralNode
      || expression instanceof StringLiteralNode || expression instanceof NullaryOpNode) return true;
    if (expression instanceof CastNode) return this.stableIndex(expression.expression);
    if (expression instanceof FieldAccessNode) return this.stableIndex(expression.expression);
    if (expression instanceof ArrayAccessNode) {
      return this.stableIndex(expression.array) && this.stableIndex(expression.index);
    }
    return false;
  }

  private sameIndex(left: ExpressionNode, right: ExpressionNode): boolean {
    if (left instanceof IdentifierNode && right instanceof IdentifierNode) return left.name === right.name;
    if (left instanceof IntLiteralNode && right instanceof IntLiteralNode) return left.value === right.value;
    if (left instanceof BoolLiteralNode && right instanceof BoolLiteralNode) return left.value === right.value;
    if (left instanceof NullaryOpNode && right instanceof NullaryOpNode) return left.operator === right.operator;
    if (left instanceof FieldAccessNode && right instanceof FieldAccessNode) {
      return left.name === right.name && this.sameIndex(left.expression, right.expression);
    }
    if (left instanceof CastNode && right instanceof CastNode) {
      return left.type.toString() === right.type.toString() && left.isUnsafe === right.isUnsafe
        && this.sameIndex(left.expression, right.expression);
    }
    if (left instanceof ArrayAccessNode && right instanceof ArrayAccessNode) {
      return this.sameIndex(left.array, right.array) && this.sameIndex(left.index, right.index);
    }
    return false;
  }

  private hasEffectsOrTargetRead(expression: ExpressionNode, arrayName: string): boolean {
    let found = false;
    const seen = new WeakSet<object>();
    const walk = (value: unknown): void => {
      if (!(value instanceof Node) || found || seen.has(value)) return;
      seen.add(value);
      if (value instanceof FunctionCallNode || value instanceof InstantiationNode
        || value instanceof IndirectCallNode || value instanceof AssignmentExpressionNode
        || ((value instanceof IdentifierNode || value instanceof MappingAccessNode
          || value instanceof StateAccessNode) && value.name === arrayName)) { found = true; return; }
      for (const [key, child] of Object.entries(value)) {
        if (['location', 'type', 'symbolTable', 'definition', 'collection', 'resolvedFunction'].includes(key)) continue;
        if (child instanceof Node) walk(child);
        else if (Array.isArray(child)) child.forEach(walk);
      }
    };
    walk(expression);
    return found;
  }
}
