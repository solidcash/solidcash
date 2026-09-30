import { AddressType } from '@solidcash/utils';
import {
  AssignNode,
  AssemblyStatementNode,
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
  hasAssembly = false;

  visitAssemblyStatement(node: AssemblyStatementNode): Node {
    // Yul assignments may change a Solidity local without producing an AssignNode.
    this.hasAssembly = true;
    return super.visitAssemblyStatement(node);
  }

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
 * state and collection writes. It also carries a nonzero-address fact into the false arm of a pure equality
 * guard, including an inlined continuation nested under that arm. It never substitutes a runtime value or drops
 * a binding/evaluation.
 */
export default class PruneInlinedConstantBranches extends AstTraversal {
  private constants = new Map<string, string>();
  private aliases = new Map<string, string>();
  private immutableBindings = new Set<string>();
  private nonZero = new Set<string>();

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const survey = new BindingSurvey();
    survey.visit(node.body);
    this.constants = new Map();
    const candidates = [...survey.definitions.entries()].filter(([name, definitions]) =>
      // Restrict this pre-typecheck rewrite to the pass-owned, uniquely named value bindings. Source locals are
      // still checked in all branches, even when a user wrote an obvious constant condition.
      (this.isInlinedBinding(name) && definitions.length === 1 && !survey.writes.has(name)));
    const immutableLocals = [...survey.definitions.entries()].filter(([name, definitions]) =>
      definitions.length === 1 && !survey.writes.has(name));
    this.immutableBindings = new Set(survey.hasAssembly ? [] : [
      ...immutableLocals.map(([name]) => name),
      ...node.parameters.filter((parameter) => !survey.definitions.has(parameter.name)
        && !survey.writes.has(parameter.name)).map((parameter) => parameter.name),
    ]);
    this.aliases = new Map(immutableLocals.flatMap(([name, [definition]]) =>
      definition.expression instanceof IdentifierNode && this.immutableBindings.has(definition.expression.name)
        ? [[name, definition.expression.name] as const] : []));
    this.nonZero = new Set();
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
    this.aliases = new Map();
    this.immutableBindings = new Set();
    this.nonZero = new Set();
    return result;
  }

  visitBranch(node: BranchNode): Node {
    const selected = this.nonZeroTruth(node.condition)
      ?? (this.usesInlinedConstant(node.condition) ? this.truth(node.condition) : undefined);
    if (selected === undefined) {
      const before = new Set(this.nonZero);
      node.condition = this.visit(node.condition);
      node.ifBlock = this.visit(node.ifBlock) as BlockNode;
      this.nonZero = new Set(before);
      // An inlined continuation is commonly placed in the else arm of a terminating guard. Even when the
      // first arm does not terminate, `x == address(0)` being false proves x nonzero throughout this arm.
      const comparison = this.nonZeroComparison(node.condition);
      if (comparison?.equalsZero) this.nonZero.add(comparison.key);
      node.elseBlock = this.visitOptional(node.elseBlock) as BlockNode | undefined;
      this.nonZero = before;
      return node;
    }
    // Preserve the selected block's lexical scope and all of its statements. The condition is built only from
    // literal/cast/immutable-identifier expressions, or a pure comparison of a proven-nonzero immutable address.
    const block = selected ? node.ifBlock : (node.elseBlock ?? new BlockNode([]));
    return this.visit(block);
  }

  /** Immutable aliases may carry a proven nonzero address across an inlined call. */
  private canonicalAlias(name: string): string {
    const seen = new Set<string>();
    let current = name;
    while (this.aliases.has(current) && !seen.has(current)) {
      seen.add(current);
      current = this.aliases.get(current)!;
    }
    return current;
  }

  private zeroAddressOperand(expression: ExpressionNode): string | undefined {
    if (!(expression instanceof IdentifierNode) || !this.immutableBindings.has(expression.name)) return undefined;
    return this.canonicalAlias(expression.name);
  }

  private nonZeroComparison(expression: ExpressionNode): { key: string; equalsZero: boolean } | undefined {
    if (!(expression instanceof BinaryOpNode)
      || (expression.operator !== BinaryOperator.EQ && expression.operator !== BinaryOperator.NE)) return undefined;
    const left = this.zeroAddressOperand(expression.left);
    const right = this.zeroAddressOperand(expression.right);
    const key = this.constant(expression.left)?.startsWith('address-zero:') ? right
      : this.constant(expression.right)?.startsWith('address-zero:') ? left : undefined;
    return key === undefined ? undefined : { key, equalsZero: expression.operator === BinaryOperator.EQ };
  }

  private nonZeroTruth(expression: ExpressionNode): boolean | undefined {
    const comparison = this.nonZeroComparison(expression);
    if (comparison === undefined || !this.nonZero.has(comparison.key)) return undefined;
    return !comparison.equalsZero;
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
    if (expression instanceof IdentifierNode) {
      const value = this.constants.get(expression.name);
      if (value === 'bool:true') return true;
      if (value === 'bool:false') return false;
      return undefined;
    }
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
