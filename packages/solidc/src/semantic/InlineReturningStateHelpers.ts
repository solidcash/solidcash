import {
  ContractNode,
  FunctionDefinitionNode,
  SourceFileNode,
  Node,
  StatementNode,
  BlockNode,
  VariableDefinitionNode,
  IdentifierNode,
  ExpressionNode,
  FunctionCallNode,
  ReturnNode,
  MappingAccessNode,
  ArrayAccessNode,
  WhileNode,
  DoWhileNode,
  TernaryOpNode,
  BinaryOpNode,
} from '../ast/AST.js';
import { Modifier } from '../ast/Globals.js';
import { BinaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * Inlines internal/private functions that RETURN a value and READ a state entry (a mapping/collection
 * element). Entry-access input slots live only in an entry-point's block layout, so such a function cannot
 * compile as an OP_INVOKE subroutine ("Block layout not available"). The sibling InlineStoragePointerCalls
 * pass handles the VOID case at statement call sites; this handles the RETURNING case at EXPRESSION call
 * sites by hoisting the callee body before the enclosing statement and replacing the call with a temp:
 *
 * ```
 * function f() external view returns (uint) { return earned[a] + _calc(a); }
 * function _calc(address a) private view returns (uint) { uint s = bal[a]; return s * idx; }
 * ->
 * function f() external view returns (uint) {
 *   address __rh0_a = a; uint __rh0_s = bal[__rh0_a]; uint __rh0__ret = __rh0_s * idx;
 *   return earned[a] + __rh0__ret;
 * }
 * ```
 *
 * Runs pre-semantic (before InlineStoragePointerCalls). Restricted to single-tail-return helpers; hoisting is
 * suppressed at conditionally-evaluated positions (loop conditions, ternary branches, short-circuit right
 * operands) to preserve revert/effect semantics. An un-hoistable call keeps its helper.
 */
const PREFIX = '__rh';

export default class InlineReturningStateHelpers extends AstTraversal {
  private funcByName: Map<string, FunctionDefinitionNode> = new Map();
  private inlinedFns: Set<string> = new Set();
  private collectionNames: Set<string> = new Set();
  private counter = 0;
  private hoists: StatementNode[] = [];
  private stack: string[] = [];
  private suppress = false;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.funcByName = new Map();
    for (const fn of node.functions) this.funcByName.set(fn.name, fn);
    this.collectionNames = new Set(node.collections.map((c) => c.name));

    this.inlinedFns = new Set();
    for (const fn of node.functions) if (this.eligible(fn)) this.inlinedFns.add(fn.name);
    if (this.inlinedFns.size === 0) return node;

    const bodies = [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef];
    for (const fn of bodies) {
      if (fn?.body) { this.stack = [fn.name]; fn.body = this.visit(fn.body) as BlockNode; }
    }
    // Drop a helper only if every call site was inlined (none left in a suppressed/un-hoistable position).
    const stillCalled = new Set<string>();
    for (const fn of bodies) {
      if (fn?.body) {
        this.walk(fn.body, (n) => {
          if (n instanceof FunctionCallNode && this.inlinedFns.has(n.identifier.name)) {
            stillCalled.add(n.identifier.name);
          }
        });
      }
    }
    node.functions = node.functions.filter((fn) => !this.inlinedFns.has(fn.name) || stillCalled.has(fn.name));
    return node;
  }

  private eligible(fn: FunctionDefinitionNode): boolean {
    if (!fn.body || fn.returnTypes.length !== 1) return false;
    if (!(fn.isFreeFunction || fn.visibility === 'private' || fn.visibility === 'internal')) return false;
    if (fn.parameters.some((p) => p.modifier.includes(Modifier.STORAGE))) return false;
    const stmts = fn.body.statements ?? [];
    if (stmts.length === 0 || !(stmts[stmts.length - 1] instanceof ReturnNode)) return false;
    let returns = 0;
    this.walk(fn.body, (n) => { if (n instanceof ReturnNode) returns += 1; });
    if (returns !== 1) return false; // a mid-body return can't linearize into a hoisted prelude
    return this.readsEntry(fn);
  }

  // Reads a mapping/collection element (incl. the read half of a compound write) - the access that needs an
  // entry-access input slot from the entry-point block layout.
  private readsEntry(fn: FunctionDefinitionNode): boolean {
    let found = false;
    this.walk(fn.body, (n) => {
      if (found) return;
      if (n instanceof MappingAccessNode && this.collectionNames.has(n.name)) found = true;
      else if (n instanceof ArrayAccessNode && n.array instanceof IdentifierNode
        && this.collectionNames.has(n.array.name)) found = true;
    });
    return found;
  }

  // Per statement: visit it (replacing inlined calls with temps + filling this.hoists), then emit
  // [hoists, statement]. Nested blocks recurse through the standard traversal and flush their own hoists.
  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const saved = this.hoists;
      this.hoists = [];
      const visited = this.visit(stmt) as StatementNode;
      const mine = this.hoists;
      this.hoists = saved;
      out.push(...mine, visited);
    }
    node.statements = out;
    return node;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    node.identifier = this.visit(node.identifier) as IdentifierNode;
    node.parameters = this.visitList(node.parameters); // inner calls inlined first
    const name = node.identifier.name;
    const callee = this.funcByName.get(name);
    if (!this.suppress && callee && this.inlinedFns.has(name) && !name.includes('.')
      && !this.stack.includes(name) && node.parameters.length === callee.parameters.length) {
      return this.inlineCall(callee, node.parameters as ExpressionNode[]);
    }
    return node;
  }

  // Suppress hoisting where the call is only conditionally evaluated; hoisting it unconditionally would
  // change revert/side-effect timing. The call is left in place (and the helper kept, not dropped).
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

  visitTernaryOp(node: TernaryOpNode): Node {
    node.condition = this.visit(node.condition); // evaluated unconditionally
    node.ifTrue = this.withSuppressed(() => this.visit(node.ifTrue));
    node.ifFalse = this.withSuppressed(() => this.visit(node.ifFalse));
    return node;
  }

  visitBinaryOp(node: BinaryOpNode): Node {
    node.left = this.visit(node.left);
    if (node.operator === BinaryOperator.AND || node.operator === BinaryOperator.OR) {
      node.right = this.withSuppressed(() => this.visit(node.right)); // short-circuit: right is conditional
    } else {
      node.right = this.visit(node.right);
    }
    return node;
  }

  private withSuppressed<T>(fn: () => T): T {
    const s = this.suppress;
    this.suppress = true;
    const r = fn();
    this.suppress = s;
    return r;
  }

  // Expand one returning-helper call: push [param bindings, body-minus-return, return-temp def] to
  // this.hoists, return an identifier for the return temp.
  private inlineCall(callee: FunctionDefinitionNode, args: ExpressionNode[]): Node {
    const n = this.counter++;
    const cloned = cloneNode(callee) as FunctionDefinitionNode;

    const rename = new Map<string, string>();
    callee.parameters.forEach((p) => rename.set(p.name, `${PREFIX}${n}_${p.name}`));
    this.walk(cloned.body, (node) => {
      if (node instanceof VariableDefinitionNode && !rename.has(node.name)) {
        rename.set(node.name, `${PREFIX}${n}_${node.name}`);
      }
    });
    this.applyRename(cloned.body, rename);

    const bindings: StatementNode[] = [];
    callee.parameters.forEach((p, i) => {
      const def = new VariableDefinitionNode(p.type, [], rename.get(p.name)!, cloneNode(args[i]) as ExpressionNode);
      def.location = args[i].location ?? callee.location;
      bindings.push(def);
    });

    // Recursively inline nested returning-helper calls within the cloned body (visitBlock flushes their
    // hoists into the statement list). Guard against self-recursion via the stack.
    const savedStack = this.stack;
    this.stack = [...savedStack, callee.name];
    const processed = (this.visit(cloned.body) as BlockNode).statements ?? [];
    this.stack = savedStack;

    const ret = processed[processed.length - 1] as ReturnNode;
    const retName = `${PREFIX}${n}__ret`;
    const retDef = new VariableDefinitionNode(callee.returnTypes[0], [], retName, ret.expressions[0]);
    retDef.location = callee.location;
    this.hoists.push(...bindings, ...processed.slice(0, -1), retDef);

    const id = new IdentifierNode(retName);
    id.location = callee.location;
    return id;
  }

  private applyRename(root: Node, map: Map<string, string>): void {
    this.walk(root, (n) => {
      if (n instanceof IdentifierNode) {
        const dot = n.name.indexOf('.');
        if (dot > 0) {
          const head = n.name.slice(0, dot);
          if (map.has(head)) n.name = map.get(head)! + n.name.slice(dot);
        } else if (map.has(n.name)) {
          n.name = map.get(n.name)!;
        }
      } else {
        const nm = (n as unknown as { name?: unknown }).name;
        if (typeof nm === 'string' && map.has(nm)) (n as unknown as { name: string }).name = map.get(nm)!;
      }
    });
  }

  // Pre-order walk over child Nodes (and Node arrays); skips Type/symbol-table/location fields.
  private walk(node: Node | undefined, visit: (n: Node) => void): void {
    if (!node) return;
    visit(node);
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) this.walk(v, visit);
      else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) this.walk(it, visit);
    }
  }
}
