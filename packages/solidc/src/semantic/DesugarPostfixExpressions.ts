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
  AssignmentExpressionNode,
  StateAssignNode,
  MappingAssignNode,
  ArrayAssignNode,
  BinaryOpNode,
  IntLiteralNode,
  TernaryOpNode,
  BranchNode,
  WhileNode,
  DoWhileNode,
  ReturnNode,
  VariableDefinitionNode,
  FieldAccessNode,
  FunctionCallNode,
  FunctionDefinitionNode,
} from '../ast/AST.js';
import { UnaryOperator, BinaryOperator } from '../ast/Operator.js';
import { MappingType, StructType, Type } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

// The base variable name of a supported postfix/prefix lvalue (local / state var / mapping entry / bare array
// element). All of local, `this.s`, `m[k]`, `arr[i]` expose it as an IdentifierNode/State/Mapping `.name` or the
// array base identifier - so counting nodes named `base` across the statement finds every reference to it.
function lvalueBaseName(operand: ExpressionNode): string | undefined {
  if (operand instanceof IdentifierNode) return operand.name;
  if (operand instanceof StateAccessNode) return operand.name;
  if (operand instanceof MappingAccessNode) return operand.name;
  if (operand instanceof ArrayAccessNode && operand.array instanceof IdentifierNode) return operand.array.name;
  if (operand instanceof FieldAccessNode && operand.expression instanceof IdentifierNode) {
    return operand.expression.name;
  }
  return undefined;
}

// Count references to base variable `name` in an AST subtree (skips non-AST metadata keys). Detects a postfix
// lvalue observed again in the same statement, which the naive after-hoist would miscompile. Conservative:
// counts by base name, so `m[k1]++ + m[k2]` (distinct keys, actually sound) also trips it - safe (a fail-close,
// never a silent miscompile).
function countBaseRefs(node: Node, name: string): number {
  let n = 0;
  const walk = (x: Node): void => {
    if ((x as unknown as { name?: unknown }).name === name) n += 1;
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

// True if `operand` is the FIRST (eval-order/pre-order) reference to base `name` in `stmt` - i.e. `name` is not
// read before the postfix. Only then is it sound to hoist the increment before the statement and reconstruct the
// pre-value as `base -/+ 1`: an earlier read would otherwise see the (hoisted) post-mutation value.
// True if base `name` is the target of an assignment anywhere in `stmt` (a plain read is fine, a self-write is
// not): `a = a++` must yield the OLD a, but the reconstruction's hoisted increment races the outer assign. Only
// reconstruct when the base is read-only apart from the postfix, so self-writes fail closed instead.
function baseIsWritten(stmt: Node, name: string): boolean {
  let written = false;
  const walk = (x: Node): void => {
    if (written) return;
    if (x instanceof AssignNode && x.identifier?.name === name) { written = true; return; }
    if ((x instanceof StateAssignNode || x instanceof MappingAssignNode || x instanceof ArrayAssignNode)
      && (x as unknown as { name?: string }).name === name) { written = true; return; }
    for (const key of Object.keys(x)) {
      if (written) return;
      if (key === 'location' || key === 'type' || key === 'symbolTable') continue;
      const v = (x as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) walk(v);
      else if (Array.isArray(v)) { for (const it of v) { if (written) break; if (it instanceof Node) walk(it); } }
    }
  };
  walk(stmt);
  return written;
}

// True if `target` is `root` or a node within `root`'s subtree.
function containsNode(root: Node, target: Node): boolean {
  if (root === target) return true;
  for (const key of Object.keys(root)) {
    if (key === 'location' || key === 'type' || key === 'symbolTable') continue;
    const v = (root as unknown as Record<string, unknown>)[key];
    if (v instanceof Node) { if (containsNode(v, target)) return true; } else if (Array.isArray(v)) {
      for (const it of v) if (it instanceof Node && containsNode(it, target)) return true;
    }
  }
  return false;
}

function isLeftmostBaseRef(stmt: Node, operand: Node, name: string): boolean {
  let first: Node | undefined;
  const walk = (x: Node): void => {
    if (first) return;
    if ((x as unknown as { name?: unknown }).name === name) { first = x; return; }
    for (const key of Object.keys(x)) {
      if (first) return;
      if (key === 'location' || key === 'type' || key === 'symbolTable') continue;
      const v = (x as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) walk(v);
      else if (Array.isArray(v)) { for (const it of v) { if (first) break; if (it instanceof Node) walk(it); } }
    }
  };
  walk(stmt);
  // The postfix is the leftmost use of the base iff the FIRST base reference is the operand itself OR lives inside
  // the operand's subtree - i.e. the base is not read anywhere before the postfix. For a mapping/array element
  // `m[k]++` the operand is the Mapping/ArrayAccess and the first `m` reference is the identifier INSIDE it.
  return first !== undefined && containsNode(operand, first);
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
  private collectionTypes = new Map<string, MappingType>(); // mapping name -> its MappingType (for the save-old temp)
  private localStructTypes = new Map<string, StructType>();
  private tempCounter = 0;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    for (const c of node.collections ?? []) {
      if (c.type instanceof MappingType) this.collectionTypes.set(c.name, c.type);
    }
    return super.visitContract(node) as Node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const saved = this.localStructTypes;
    this.localStructTypes = new Map();
    const result = super.visitFunctionDefinition(node);
    this.localStructTypes = saved;
    return result;
  }

  visitVariableDefinition(node: VariableDefinitionNode): Node {
    if (node.type instanceof StructType) this.localStructTypes.set(node.name, node.type);
    return super.visitVariableDefinition(node);
  }

  // The value type of `m[k]` / `m[a][b]`: unwrap the mapping's MappingType by the number of keys applied. Returns
  // undefined for a non-mapping base or a shape that does not resolve to a value (fall back to the reconstruction).
  private mappingElementValueType(access: MappingAccessNode): Type | undefined {
    let t: Type | undefined = this.collectionTypes.get(access.name);
    if (!t) return undefined;
    for (let i = 0; i < access.keys.length; i += 1) {
      if (t instanceof MappingType) t = t.valueType;
      else return undefined;
    }
    return t instanceof MappingType ? undefined : t;
  }

  // Per statement: visit it (postfix ops replace themselves with the read + queue their increment in
  // this.after), then emit [statement, ...increments].
  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const expanded = this.expandTernaryAssignment(stmt);
      if (expanded) {
        // Keep each synthesized statement as its own sequence point. In particular, an increment in the
        // condition belongs before the branch while increments in either arm stay inside that arm.
        for (const part of expanded) this.visitBlockStatement(part, out);
        continue;
      }
      this.visitBlockStatement(stmt, out);
    }
    node.statements = out;
    return node;
  }

  private visitBlockStatement(stmt: StatementNode, out: StatementNode[]): void {
    const savedAfter = this.after; const savedBefore = this.before; const savedStmt = this.currentStmt;
    this.after = []; this.before = []; this.currentStmt = stmt;
    const visited = this.visit(stmt) as StatementNode;
    const before = this.before; const after = this.after;
    this.after = savedAfter; this.before = savedBefore; this.currentStmt = savedStmt;
    // Prefix increments hoist BEFORE the statement (they read the post-mutation value); postfix AFTER.
    out.push(...before, visited, ...after);
  }

  // `T x = c ? a : b` / `x = c ? a : b` cannot pull mutations in `a` or `b` to statement scope: only the
  // selected arm executes. Turn the expression into a real branch first, then the ordinary block visitor lowers
  // each arm independently:
  //
  //   T x; if (c) { x = a; } else { x = b; }
  //
  // This also gives prefix/postfix operations in an arm their correct branch-local sequence point.
  private expandTernaryAssignment(stmt: StatementNode): StatementNode[] | undefined {
    let ternary: TernaryOpNode | undefined;
    let makeAssign: (expression: ExpressionNode) => StatementNode;
    let declaration: VariableDefinitionNode | undefined;

    if (stmt instanceof VariableDefinitionNode && stmt.expression instanceof TernaryOpNode) {
      ternary = stmt.expression;
      declaration = new VariableDefinitionNode(stmt.type, [...stmt.modifier], stmt.name);
      declaration.allowUnused = stmt.allowUnused;
      declaration.isLoopVariable = stmt.isLoopVariable;
      declaration.location = stmt.location;
      makeAssign = (expression) => {
        const target = new IdentifierNode(stmt.name); target.location = stmt.location;
        const assign = new AssignNode(target, expression); assign.location = stmt.location;
        return assign;
      };
    } else if (stmt instanceof AssignNode && stmt.expression instanceof TernaryOpNode) {
      ternary = stmt.expression;
      makeAssign = (expression) => {
        const assign = new AssignNode(cloneNode(stmt.identifier) as IdentifierNode, expression);
        assign.fromModifier = stmt.fromModifier;
        assign.isReferenceDataWrite = stmt.isReferenceDataWrite;
        assign.location = stmt.location;
        return assign;
      };
    } else if (stmt instanceof StateAssignNode && stmt.expression instanceof TernaryOpNode) {
      ternary = stmt.expression;
      makeAssign = (expression) => {
        const assign = new StateAssignNode(stmt.name, expression);
        assign.fromModifier = stmt.fromModifier;
        assign.location = stmt.location;
        return assign;
      };
    } else {
      return undefined;
    }

    const yes = new BlockNode([makeAssign(ternary.ifTrue)]); yes.location = ternary.ifTrue.location;
    const no = new BlockNode([makeAssign(ternary.ifFalse)]); no.location = ternary.ifFalse.location;
    const branch = new BranchNode(ternary.condition, yes, no); branch.location = ternary.location;
    return declaration ? [declaration, branch] : [branch];
  }

  visitUnaryOp(node: UnaryOpNode): Node {
    node.expression = this.visit(node.expression) as ExpressionNode; // inner postfix/prefix first
    const op = node.operator;
    const isPostfix = op === UnaryOperator.POSTFIX_INCREMENT || op === UnaryOperator.POSTFIX_DECREMENT;
    const isPrefix = op === UnaryOperator.PREFIX_INCREMENT || op === UnaryOperator.PREFIX_DECREMENT;
    if (!isPostfix && !isPrefix) return node;
    // Conditional positions (ternary branch, short-circuit right operand, loop condition) make the hoist
    // conditional, so it cannot be pulled out of the expression - reject.
    if (this.suppress) {
      throw new Error(
        "'++'/'--' as an expression is not supported inside a ternary, short-circuit (&&/||), or loop condition; "
        + 'assign it to a plain variable first',
      );
    }
    const increment = this.buildIncrement(node.expression, op);
    if (!increment) return node; // unsupported lvalue shape - leave it
    // Prefix yields the POST-mutation value: hoist the increment before, read the (new) lvalue.
    if (isPrefix) { this.before.push(increment); return node.expression; }

    // Postfix yields the PRE-mutation value. Simple lowering: read the lvalue, hoist the increment AFTER the
    // statement - correct ONLY when the lvalue is read once and not in a return (an after-return hoist is dead).
    // When it is re-read (`a++ + a` must be old + NEW, not 2a) or in a return, hoist the increment BEFORE and
    // reconstruct the pre-value as `base -/+ 1`. This uses the lvalue's OWN type (no temp: `(a-1)+a` type-checks
    // as a+a), and is sound ONLY when the postfix is the FIRST reference to the lvalue (leftmost) - an earlier
    // read would otherwise see the hoisted post-value. Non-leftmost re-reads fail closed (never a miscompile).
    const base = lvalueBaseName(node.expression);
    const reRead = base !== undefined && this.currentStmt !== undefined
      && countBaseRefs(this.currentStmt, base) > 1;
    if (this.inReturn || reRead) {
      // vmap-SOUND read-old-temp for a MAPPING element in a plain `return m[k]++` (the OZ Nonces/EIP-2612 pattern):
      // the reconstruction below hoists the write then RE-READS `m[k]` as `m[k] -/+ 1`, but a vmap sorted mapping
      // entry NFT is co-spent by the write and cannot be read again in the same tx - so when such a value helper
      // inlines into an entry point the re-read OP_VERIFY-fails. Instead lower like the SOUND assignment form
      // `n = m[k]++` (which the vmap codegen handles): read the old value into `__pfN`, then the ordinary RMW
      // `m[k] = m[k] +/- 1` (whose read coalesces with the entry's single co-spend), and return `__pfN`. Only the
      // clean return case (`inReturn && !reRead`); mapping elements are the only vmap entries (state vars / locals are
      // register/data-NFT), so those keep the cheaper reconstruction.
      if (this.inReturn && !reRead && node.expression instanceof MappingAccessNode
        && this.currentStmt !== undefined && base !== undefined && !baseIsWritten(this.currentStmt, base)) {
        const valueType = this.mappingElementValueType(node.expression);
        if (valueType) {
          const tempName = `__pf${this.tempCounter++}`;
          const readOld = new VariableDefinitionNode(
            valueType, [], tempName, cloneNode(node.expression) as ExpressionNode,
          );
          readOld.location = node.location;
          this.before.push(readOld, increment); // __pfN = m[k];  m[k] = m[k] +/- 1;  (RMW coalesces the read)
          const ret = new IdentifierNode(tempName); ret.location = node.location;
          return ret; // return the saved OLD value
        }
      }
      if (base !== undefined && this.currentStmt !== undefined
        && isLeftmostBaseRef(this.currentStmt, node.expression, base)
        && !baseIsWritten(this.currentStmt, base)) {
        this.before.push(increment); // base = base +/- 1 (runs before the statement)
        const one = new IntLiteralNode(1n); one.location = node.location;
        const undo = op === UnaryOperator.POSTFIX_INCREMENT ? BinaryOperator.MINUS : BinaryOperator.PLUS;
        const pre = new BinaryOpNode(cloneNode(node.expression) as ExpressionNode, undo, one);
        pre.location = node.location;
        return pre; // pre-mutation value = the already-mutated lvalue, undone by one
      }
      throw new Error(
        `postfix '${base ?? 'x'}++'/'--' cannot be lowered when '${base ?? 'the lvalue'}' is read before the `
        + 'increment in the same statement (or is an unsupported lvalue); assign it to a plain variable first',
      );
    }
    // Single-use postfix at statement scope: read the pre-value, hoist the increment after.
    this.after.push(increment);
    return node.expression;
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

  visitBranch(node: BranchNode): Node {
    // A state assignment used as the RIGHT operand of a short-circuit condition cannot remain a value-form
    // assignment (state writes are statements in the target IR), and hoisting it would execute the write when
    // Solidity would skip it. Preserve evaluation order by spelling the short circuit as nested branches:
    //
    //   if (left && (x = value)) A else B
    //     -> if (left) { x = value; if (x) A else B } else B
    //
    // `||` is the dual. The ordinary block traversal can then lower/resolve the assignment as a statement.
    const condition = node.condition;
    if (condition instanceof BinaryOpNode
      && (condition.operator === BinaryOperator.AND || condition.operator === BinaryOperator.OR)
      && condition.right instanceof AssignmentExpressionNode) {
      const assignment = condition.right.assign;
      const read = new IdentifierNode(assignment.identifier.name);
      read.location = condition.right.location;
      const inner = new BranchNode(
        read,
        cloneNode(node.ifBlock) as BlockNode,
        node.elseBlock ? cloneNode(node.elseBlock) as BlockNode : undefined,
      );
      inner.location = node.location;
      const conditionalSide = new BlockNode([assignment, inner]);
      conditionalSide.location = node.location;

      let rewritten: BranchNode;
      if (condition.operator === BinaryOperator.AND) {
        rewritten = new BranchNode(
          condition.left,
          conditionalSide,
          node.elseBlock ? cloneNode(node.elseBlock) as BlockNode : undefined,
        );
      } else {
        rewritten = new BranchNode(
          condition.left,
          cloneNode(node.ifBlock) as BlockNode,
          conditionalSide,
        );
      }
      rewritten.location = node.location;
      return this.visitBranch(rewritten);
    }

    node.condition = this.visit(node.condition);
    node.ifBlock = this.visit(node.ifBlock) as BlockNode;
    if (node.elseBlock) node.elseBlock = this.visit(node.elseBlock) as BlockNode;
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

  // An assignment used as an EXPRESSION (`f(x = v)` assignment-as-argument, `int a = (b = c)`): hoist the side
  // effect to a statement before the enclosing one and read the target in its place - `f(x = v)` becomes
  // `x = v; f(x)`. This also sidesteps the state-var assignment-as-expression codegen restriction (the write is
  // now an ordinary statement). Suppressed inside a ternary / short-circuit / loop condition (where the write would
  // become conditional), where the node is left as-is (the existing local-only value-form handling still applies).
  visitAssignmentExpression(node: AssignmentExpressionNode): Node {
    if (node.prelude && node.result) {
      for (const statement of node.prelude) this.before.push(this.visit(statement) as StatementNode);
      return this.visit(node.result);
    }
    node.assign = this.visit(node.assign) as AssignNode; // recurse first: a nested postfix in the RHS hoists too
    if (this.suppress) return node;
    const target = node.assign.identifier;
    this.before.push(node.assign);
    const read = new IdentifierNode(target.name);
    read.location = node.location;
    // Preserve an inlined-modifier/ctor origin tag (an ancestor ctor accessing its OWN private state) so the
    // hoisted read does not trip the inherited-private-access check - the write keeps its tag on node.assign.
    read.fromModifier = node.assign.fromModifier ?? target.fromModifier;
    return read;
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
    } else if (operand instanceof FieldAccessNode && operand.expression instanceof IdentifierNode) {
      const baseName = operand.expression.name;
      const structType = this.localStructTypes.get(baseName);
      if (structType?.fields.some((field) => field.name === operand.name)) {
        const args = structType.fields.map((field) => {
          const base = new IdentifierNode(baseName); base.location = operand.location;
          const read = new FieldAccessNode(base, field.name); read.location = operand.location;
          return field.name === operand.name ? sum(read) : read;
        });
        const ctor = new FunctionCallNode(new IdentifierNode(structType.name), args);
        ctor.location = operand.location;
        const target = new IdentifierNode(baseName); target.location = operand.location;
        stmt = new AssignNode(target, ctor);
      }
    }
    if (stmt) stmt.location = operand.location;
    return stmt;
  }
}
