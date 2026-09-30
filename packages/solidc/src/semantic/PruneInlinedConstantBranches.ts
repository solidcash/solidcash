import { AddressType } from '@solidcash/utils';
import {
  AssignNode,
  BinaryOpNode,
  BlockNode,
  BoolLiteralNode,
  BranchNode,
  CastNode,
  DeleteLocalNode,
  ExpressionNode,
  FunctionDefinitionNode,
  IdentifierNode,
  IntLiteralNode,
  Node,
  TupleAssignmentNode,
  UnaryOpNode,
  VariableDefinitionNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';

/** Collect immutable, uniquely named helper parameter bindings before simplifying any body. */
class BindingSurvey extends AstTraversal {
  readonly definitions = new Map<string, VariableDefinitionNode[]>();
  readonly writes = new Set<string>();

  visitVariableDefinition(node: VariableDefinitionNode): Node {
    const definitions = this.definitions.get(node.name) ?? [];
    definitions.push(node);
    this.definitions.set(node.name, definitions);
    return super.visitVariableDefinition(node);
  }

  visitAssign(node: AssignNode): Node {
    this.writes.add(node.identifier.name);
    return super.visitAssign(node);
  }

  visitTupleAssignment(node: TupleAssignmentNode): Node {
    for (const element of node.elements) {
      if (element.existing && element.name) this.writes.add(element.name);
    }
    return super.visitTupleAssignment(node);
  }

  visitDeleteLocal(node: DeleteLocalNode): Node {
    this.writes.add(node.identifier.name);
    return super.visitDeleteLocal(node);
  }
}

/**
 * Prune branches made static by the ordinary helper-inlining passes. Inlining deliberately binds value parameters
 * once so their arguments are evaluated once; a literal binding such as `_mint`'s `address(0)` subsequently makes
 * one arm of `_update` impossible. Removing that arm before physical-slot discovery avoids allocating impossible
 * state and collection writes. This pass never substitutes a runtime value or drops a binding/evaluation.
 */
export default class PruneInlinedConstantBranches extends AstTraversal {
  private constants = new Map<string, string>();

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const survey = new BindingSurvey();
    survey.visit(node.body);
    this.constants = new Map();
    const candidates = [...survey.definitions.entries()].filter(([name, definitions]) =>
      // Restrict this pre-typecheck rewrite to the pass-owned, uniquely named value bindings. Source locals are
      // still checked in all branches, even when a user wrote an obvious constant condition.
      (this.isInlinedBinding(name) && definitions.length === 1 && !survey.writes.has(name)));
    for (let iteration = 0; iteration < candidates.length; iteration += 1) {
      let changed = false;
      for (const [name, [definition]] of candidates) {
        if (this.constants.has(name) || !definition.expression) continue;
        const value = this.constant(definition.expression);
        if (value === undefined) continue;
        this.constants.set(name, value);
        changed = true;
      }
      if (!changed) break;
    }
    const result = super.visitFunctionDefinition(node);
    this.constants = new Map();
    return result;
  }

  visitBranch(node: BranchNode): Node {
    if (!this.usesInlinedConstant(node.condition)) return super.visitBranch(node);
    const selected = this.truth(node.condition);
    if (selected === undefined) return super.visitBranch(node);
    // Preserve the selected block's lexical scope and all of its statements. The condition is built only from
    // literal/cast/immutable-identifier expressions, so evaluating it had no runtime effects to preserve.
    const block = selected ? node.ifBlock : (node.elseBlock ?? new BlockNode([]));
    return this.visit(block);
  }

  private isInlinedBinding(name: string): boolean {
    return /^__(?:sp|rh)\d+_/.test(name);
  }

  private usesInlinedConstant(expression: ExpressionNode): boolean {
    if (expression instanceof IdentifierNode) return this.constants.has(expression.name);
    if (expression instanceof CastNode || expression instanceof UnaryOpNode) {
      return this.usesInlinedConstant(expression.expression);
    }
    if (expression instanceof BinaryOpNode) {
      return this.usesInlinedConstant(expression.left) || this.usesInlinedConstant(expression.right);
    }
    return false;
  }

  private truth(expression: ExpressionNode): boolean | undefined {
    if (expression instanceof BoolLiteralNode) return expression.value;
    if (expression instanceof UnaryOpNode && expression.operator === UnaryOperator.NOT) {
      const inner = this.truth(expression.expression);
      return inner === undefined ? undefined : !inner;
    }
    if (!(expression instanceof BinaryOpNode)
      || (expression.operator !== BinaryOperator.EQ && expression.operator !== BinaryOperator.NE)) return undefined;
    const left = this.constant(expression.left);
    const right = this.constant(expression.right);
    // Equal literal constructions must evaluate equally. Do not infer that *different* literals differ after
    // casts or implicit coercions: e.g. two distinct integer literals can truncate to one bounded value.
    if (left === undefined || right === undefined || left !== right) return undefined;
    return expression.operator === BinaryOperator.EQ;
  }

  private constant(expression: ExpressionNode): string | undefined {
    if (expression instanceof IntLiteralNode) return `int:${expression.value}`;
    if (expression instanceof BoolLiteralNode) return `bool:${expression.value}`;
    if (expression instanceof IdentifierNode) return this.constants.get(expression.name);
    if (expression instanceof UnaryOpNode && expression.operator === UnaryOperator.NEGATE) {
      const inner = this.constant(expression.expression);
      return inner?.startsWith('int:') ? `int:${-BigInt(inner.slice(4))}` : undefined;
    }
    if (expression instanceof CastNode && !expression.isUnsafe
      && expression.type instanceof AddressType
      && expression.expression instanceof IntLiteralNode
      && expression.expression.value === 0n) {
      // The zero-address literal is an exact, total construction. Other casts can truncate or fail, so their
      // condition evaluation must remain in the generated bytecode even when two source expressions look alike.
      return `address-zero:${expression.type.toString()}`;
    }
    return undefined;
  }
}
