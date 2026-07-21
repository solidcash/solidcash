import {
  FunctionDefinitionNode, VariableDefinitionNode, IdentifierNode, MethodCallNode, FunctionCallNode,
  ArrayAccessNode, FieldAccessNode, IntLiteralNode, BinaryOpNode, UnaryOpNode, CastNode,
  SourceFileNode, ContractNode, InterfaceNode, WhileNode, DoWhileNode, CollectionIterationNode,
  Node, ExpressionNode,
} from '../ast/AST.js';
import { AddressType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

const ADDRESS_METHODS = new Set(['send', 'call', 'staticcall', 'delegatecall']);

// A NON-LOOP external-call target that is a PARAM-ROOTED array element `IERC20(path[path.length - 1]).balanceOf(to)`
// (Router02's fee-on-transfer wrapper reads the last-hop token twice). The collect phase turns an array-access
// target into a per-iteration loop-array co-spend, which is wrong for a single call outside a loop (it faults at the
// epilogue - the array index expression is not on the stack). Hoist the element into a function-top `address
// __ehoist_N` local so the cast target becomes `IERC20(__ehoist_N)`, an ordinary fixed-slot co-spend (the epilogue
// PICKs the local, identical to a bare-param target).
//
// SOUND by reduction to a param target (docs/extcall-target-pinning.md): the element is rooted in a FUNCTION PARAM
// (the caller chooses `path`, hence chooses `path[k]`), and the index is deterministic (literal / param / `.length`
// / arithmetic over those), so the body-top value is position-independent - byte-identical to writing the element
// access at the call site. Restricted to PARAM roots (immutable) and NON-LOOP targets: a loop target stays with the
// per-iteration loop-array dispatch; a state-rooted or local-indexed target is left untouched (fails closed).
export default class HoistNonLoopArrayElemExtcallTargets extends AstTraversal {
  private typeNames: Set<string> = new Set();
  private params: Set<string> = new Set();
  private counter = 0;

  override visitSourceFile(node: SourceFileNode): Node {
    this.typeNames = new Set();
    for (const i of node.interfaceDefinitions as InterfaceNode[]) this.typeNames.add(i.name);
    for (const c of node.importedContracts as ContractNode[]) this.typeNames.add(c.name);
    if (node.contract) this.typeNames.add(node.contract.name);
    return super.visitSourceFile(node) as Node;
  }

  override visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (!node.body || !node.body.statements) return node;
    this.params = new Set(node.parameters.map((p) => p.name));
    const decls: VariableDefinitionNode[] = [];

    const walk = (n: Node | undefined, depth: number): void => {
      if (!n) return;
      // `IFoo(path[k]).method()` at the function top: the object is a `<typeName>(<arg>)` cast whose arg is a
      // param-rooted array element, and the method is a genuine interface method (not an address builtin). A target
      // read inside a loop belongs to the per-iteration co-spend, so only depth 0 is hoisted.
      if (depth === 0 && n instanceof MethodCallNode && !ADDRESS_METHODS.has(n.methodName)
        && n.object instanceof FunctionCallNode && n.object.parameters.length === 1
        && this.typeNames.has(n.object.identifier.name)
        && n.object.parameters[0] instanceof ArrayAccessNode
        && this.isParamRooted(n.object.parameters[0])) {
        const name = `__ehoist_${this.counter}`;
        this.counter += 1;
        const arg = n.object.parameters[0];
        const def = new VariableDefinitionNode(new AddressType(false, n.object.identifier.name), [],
          name, cloneNode(arg) as ExpressionNode);
        def.location = n.location;
        decls.push(def);
        const id = new IdentifierNode(name);
        id.location = arg.location;
        n.object.parameters[0] = id;
      }
      const childDepth = (n instanceof WhileNode || n instanceof DoWhileNode
        || n instanceof CollectionIterationNode) ? depth + 1 : depth;
      for (const k of Object.keys(n as object)) {
        if (k === 'type' || k === 'symbolTable' || k === 'location') continue;
        const v = (n as unknown as Record<string, unknown>)[k];
        if (Array.isArray(v)) v.forEach((it) => { if (it instanceof Node) walk(it, childDepth); });
        else if (v instanceof Node) walk(v, childDepth);
      }
    };
    walk(node.body, 0);

    if (decls.length > 0) node.body.statements = [...decls, ...node.body.statements];
    return node;
  }

  // The access is rooted in a function param and every index is deterministic (position-independent).
  private isParamRooted(expr: ExpressionNode): boolean {
    if (expr instanceof IdentifierNode) return this.params.has(expr.name);
    if (expr instanceof FieldAccessNode) return this.isParamRooted(expr.expression);
    if (expr instanceof ArrayAccessNode) return this.indexSafe(expr.index) && this.isParamRooted(expr.array);
    return false;
  }

  // A deterministic index: a literal, a param, or pure arithmetic / `.length` over those (no mutable/local leaf).
  private indexSafe(e: ExpressionNode): boolean {
    if (e instanceof IntLiteralNode) return true;
    if (e instanceof IdentifierNode) return this.params.has(e.name);
    if (e instanceof BinaryOpNode) return this.indexSafe(e.left) && this.indexSafe(e.right);
    if (e instanceof UnaryOpNode) return this.indexSafe(e.expression);
    if (e instanceof CastNode) return this.indexSafe(e.expression);
    if (e instanceof FieldAccessNode && e.name === 'length') return this.isParamRooted(e.expression);
    return false;
  }
}
