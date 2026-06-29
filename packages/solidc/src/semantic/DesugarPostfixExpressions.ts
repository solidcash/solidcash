import {
  Node,
  SourceFileNode,
  ContractNode,
  BlockNode,
  StatementNode,
  ExpressionNode,
  UnaryOpNode,
  IdentifierNode,
  StateAccessNode,
  MappingAccessNode,
  ArrayAccessNode,
  AssignNode,
  StateAssignNode,
  MappingAssignNode,
  ArrayAssignNode,
  BinaryOpNode,
  IntLiteralNode,
  TernaryOpNode,
  WhileNode,
  DoWhileNode,
  ReturnNode,
} from '../ast/AST.js';
import { UnaryOperator, BinaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * Lowers postfix `lvalue++` / `lvalue--` used as an EXPRESSION (e.g. `abi.encode(.., nonces[owner]++, ..)`,
 * the EIP-2612 nonce pattern). Postfix yields the PRE-mutation value and mutates as a side effect, so it
 * desugars to: replace the expression with a read of the lvalue (the old value), and hoist `lvalue = lvalue +/-
 * 1` immediately AFTER the enclosing statement. (Statement-form `lvalue++;` is a separate grammar path and is
 * untouched; for-loop `i++` updates are handled by the for desugar.)
 *
 * Sound only when the lvalue is evaluated exactly once and unconditionally at statement scope - so the hoist is
 * suppressed in conditional/terminal positions (ternary branches, `&&`/`||` right operands, loop conditions,
 * return expressions), where a postfix left in place surfaces as a normal "unsupported here" error rather than
 * a silently mis-ordered side effect.
 */
export default class DesugarPostfixExpressions extends AstTraversal {
  private after: StatementNode[] = [];
  private suppress = false;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  // Per statement: visit it (postfix ops replace themselves with the read + queue their increment in
  // this.after), then emit [statement, ...increments].
  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const saved = this.after;
      this.after = [];
      const visited = this.visit(stmt) as StatementNode;
      const mine = this.after;
      this.after = saved;
      out.push(visited, ...mine);
    }
    node.statements = out;
    return node;
  }

  visitUnaryOp(node: UnaryOpNode): Node {
    node.expression = this.visit(node.expression) as ExpressionNode; // inner postfix first
    if (node.operator !== UnaryOperator.POSTFIX_INCREMENT && node.operator !== UnaryOperator.POSTFIX_DECREMENT) {
      return node;
    }
    if (this.suppress) {
      // Conditional/terminal position (return, ternary branch, short-circuit right operand, loop condition):
      // hoisting the increment after the statement would change its ordering/conditionality, so reject rather
      // than mis-compile. Assigning to a local first is the workaround.
      throw new Error(
        "postfix '++'/'--' as an expression is only supported at statement scope, not inside a return, "
        + 'ternary, short-circuit (&&/||), or loop condition; assign it to a variable first',
      );
    }
    const increment = this.buildIncrement(node.expression, node.operator);
    if (!increment) return node; // unsupported lvalue shape - leave it
    this.after.push(increment);
    return node.expression; // the read = the pre-mutation value
  }

  // Conditional/terminal positions: hoisting the increment after the statement would change its
  // ordering/conditionality, so don't desugar there.
  visitTernaryOp(node: TernaryOpNode): Node {
    node.condition = this.visit(node.condition); // unconditional
    node.ifTrue = this.withSuppressed(() => this.visit(node.ifTrue)) as ExpressionNode;
    node.ifFalse = this.withSuppressed(() => this.visit(node.ifFalse)) as ExpressionNode;
    return node;
  }

  visitBinaryOp(node: BinaryOpNode): Node {
    node.left = this.visit(node.left) as ExpressionNode;
    if (node.operator === BinaryOperator.AND || node.operator === BinaryOperator.OR) {
      node.right = this.withSuppressed(() => this.visit(node.right)) as ExpressionNode;
    } else {
      node.right = this.visit(node.right) as ExpressionNode;
    }
    return node;
  }

  visitWhile(node: WhileNode): Node {
    node.condition = this.withSuppressed(() => this.visit(node.condition));
    node.block = this.visit(node.block) as StatementNode;
    return node;
  }

  visitDoWhile(node: DoWhileNode): Node {
    node.condition = this.withSuppressed(() => this.visit(node.condition));
    node.block = this.visit(node.block) as StatementNode;
    return node;
  }

  visitReturn(node: ReturnNode): Node {
    // The increment would land after the return (dead). Capturing the pre-value pre-return needs a typed temp
    // (type unknown pre-typecheck); rare, so leave the postfix in place to error rather than mis-compile.
    node.expressions = this.withSuppressed(() => this.visitList(node.expressions)) as ExpressionNode[];
    return node;
  }

  private withSuppressed<T>(fn: () => T): T {
    const s = this.suppress;
    this.suppress = true;
    const r = fn();
    this.suppress = s;
    return r;
  }

  // `lvalue = lvalue +/- 1` for the supported lvalue shapes (local, state var, mapping entry).
  private buildIncrement(operand: ExpressionNode, op: UnaryOperator): StatementNode | undefined {
    const binop = op === UnaryOperator.POSTFIX_INCREMENT ? BinaryOperator.PLUS : BinaryOperator.MINUS;
    const one = (): IntLiteralNode => { const n = new IntLiteralNode(1n); n.location = operand.location; return n; };
    const sum = (read: ExpressionNode): BinaryOpNode => {
      const b = new BinaryOpNode(read, binop, one()); b.location = operand.location; return b;
    };
    let stmt: StatementNode | undefined;
    if (operand instanceof IdentifierNode) {
      stmt = new AssignNode(cloneNode(operand) as IdentifierNode, sum(cloneNode(operand) as ExpressionNode));
    } else if (operand instanceof StateAccessNode) {
      stmt = new StateAssignNode(operand.name, sum(cloneNode(operand) as ExpressionNode));
    } else if (operand instanceof MappingAccessNode) {
      const keys = operand.keys.map((k) => cloneNode(k) as ExpressionNode);
      stmt = new MappingAssignNode(operand.name, keys, sum(cloneNode(operand) as ExpressionNode));
    } else if (operand instanceof ArrayAccessNode && operand.array instanceof IdentifierNode) {
      // Bare `name[index]` is an ArrayAccess pre-semantic (resolved to state-or-local later); mirror the
      // bare-element statement assign with an ArrayAssign so it resolves the same way.
      const index = cloneNode(operand.index) as ExpressionNode;
      stmt = new ArrayAssignNode(operand.array.name, index, sum(cloneNode(operand) as ExpressionNode));
    }
    if (stmt) stmt.location = operand.location;
    return stmt;
  }
}
