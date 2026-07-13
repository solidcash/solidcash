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

// Count identifier reads named `name` in an AST subtree (skips non-AST metadata keys). Used to detect a postfix
// lvalue that is observed again in the same statement, which the after-hoist lowering would miscompile.
function countIdentifierRefs(node: Node, name: string): number {
  let n = 0;
  const walk = (x: Node): void => {
    if (x instanceof IdentifierNode && x.name === name) n += 1;
    for (const key of Object.keys(x)) {
      if (key === 'location' || key === 'type' || key === 'symbolTable') continue;
      const v = (x as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) walk(v);
      else if (Array.isArray(v)) v.forEach((item) => { if (item instanceof Node) walk(item as Node); });
    }
  };
  walk(node);
  return n;
}

/**
 * Lowers postfix `lvalue++`/`lvalue--` and prefix `++lvalue`/`--lvalue` used as an EXPRESSION (e.g.
 * `abi.encode(.., nonces[owner]++, ..)` the EIP-2612 nonce pattern, or `arr[i] = ++x` / `return ++counter`).
 * Both replace the expression with a read of the lvalue and hoist `lvalue = lvalue +/- 1`; postfix yields the
 * PRE-mutation value so its increment hoists AFTER the enclosing statement, prefix yields the POST-mutation value
 * so its increment hoists BEFORE. (Statement-form `lvalue++;`/`++lvalue;` is a separate grammar path and is
 * untouched; for-loop `i++` updates are handled by the for desugar.)
 *
 * Sound only when the lvalue is evaluated exactly once and unconditionally at statement scope - so the hoist is
 * suppressed in conditional positions (ternary branches, `&&`/`||` right operands, loop conditions), and postfix
 * additionally in a return (its increment would land after the return, dead); prefix in a return is fine (it
 * hoists before). A left-in-place op surfaces as a normal "unsupported here" error rather than a mis-ordered side
 * effect.
 */
export default class DesugarPostfixExpressions extends AstTraversal {
  private after: StatementNode[] = [];
  private before: StatementNode[] = [];
  private suppress = false;
  private inReturn = false;
  private currentStmt: StatementNode | undefined; // innermost enclosing statement (a sequence point)

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  // Per statement: visit it (postfix ops replace themselves with the read + queue their increment in
  // this.after), then emit [statement, ...increments].
  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const savedAfter = this.after; const savedBefore = this.before; const savedStmt = this.currentStmt;
      this.after = []; this.before = []; this.currentStmt = stmt;
      const visited = this.visit(stmt) as StatementNode;
      const before = this.before; const after = this.after;
      this.after = savedAfter; this.before = savedBefore; this.currentStmt = savedStmt;
      // Prefix increments hoist BEFORE the statement (they read the post-mutation value); postfix AFTER.
      out.push(...before, visited, ...after);
    }
    node.statements = out;
    return node;
  }

  visitUnaryOp(node: UnaryOpNode): Node {
    node.expression = this.visit(node.expression) as ExpressionNode; // inner postfix/prefix first
    const op = node.operator;
    const isPostfix = op === UnaryOperator.POSTFIX_INCREMENT || op === UnaryOperator.POSTFIX_DECREMENT;
    const isPrefix = op === UnaryOperator.PREFIX_INCREMENT || op === UnaryOperator.PREFIX_DECREMENT;
    if (!isPostfix && !isPrefix) return node;
    // Conditional positions (ternary branch, short-circuit right operand, loop condition) make the hoist
    // conditional either way; postfix additionally cannot hoist after a return (dead). Prefix hoists before the
    // statement, which is fine in a return. Reject the unsupported combinations rather than mis-compile.
    if (this.suppress || (isPostfix && this.inReturn)) {
      throw new Error(
        "'++'/'--' as an expression is only supported at statement scope (and prefix additionally in a return), "
        + 'not inside a ternary, short-circuit (&&/||), or loop condition; assign it to a variable first',
      );
    }
    // Postfix reads the PRE-mutation value and hoists the increment AFTER the statement. That is only sound when
    // the lvalue is not observed again in the same statement: `a++ + a` must be old + NEW (2a+1), but the after-
    // hoist makes the second read see OLD (2a) - a silent miscompile. Fail closed for an identifier read more than
    // once (its postfix operand counts as one). Prefix hoists BEFORE, so re-reads see the new value and are sound.
    if (isPostfix && node.expression instanceof IdentifierNode && this.currentStmt
      && countIdentifierRefs(this.currentStmt, node.expression.name) > 1) {
      throw new Error(
        `postfix '${node.expression.name}++'/'--' cannot be lowered when '${node.expression.name}' is read again in `
        + 'the same statement (the increment would be observed out of order); assign it to a plain variable first',
      );
    }
    const increment = this.buildIncrement(node.expression, op);
    if (!increment) return node; // unsupported lvalue shape - leave it
    if (isPrefix) {
      this.before.push(increment);
      return node.expression; // the read = the post-mutation value (increment already ran)
    }
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
    // Prefix `return ++x` hoists `x = x + 1` before the return (fine). Postfix `return x++` would need the
    // increment after the return (dead), so inReturn keeps postfix rejected while allowing prefix.
    const saved = this.inReturn;
    this.inReturn = true;
    node.expressions = this.visitList(node.expressions) as ExpressionNode[];
    this.inReturn = saved;
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
    const isInc = op === UnaryOperator.POSTFIX_INCREMENT || op === UnaryOperator.PREFIX_INCREMENT;
    const binop = isInc ? BinaryOperator.PLUS : BinaryOperator.MINUS;
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
