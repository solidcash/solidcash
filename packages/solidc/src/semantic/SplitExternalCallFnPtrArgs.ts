import {
  Node,
  SourceFileNode,
  ContractNode,
  InterfaceNode,
  MethodCallNode,
  FunctionCallNode,
  FieldAccessNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * A foreign fn-ptr PASSED to a DIFFERENT contract over an external call. At the ABI boundary a
 * `function(..) external` value is `(address, selector)` - and the callee's fn-ptr param is lowered to exactly
 * those two params (LowerForeignFunctionPointerParams / ...Storage). So a fn-ptr member argument at an
 * external-call site splits into the address + the compile-time selector to match:
 *
 *   IB(b).register(ITarget(t).m, ..)   ->   IB(b).register(t, ITarget.m.selector, ..)
 *
 * The callee (B) already decodes `(cb: address, __fnsel_cb: bytes4)`; this is the CALLER (A) side. Runs before
 * semantic. Only a foreign member `IFace(a).m` on an interface-cast external-call receiver is split - an internal
 * call / self-ref is untouched.
 */
export default class SplitExternalCallFnPtrArgs extends AstTraversal {
  private typeNames = new Set<string>();

  visitSourceFile(node: SourceFileNode): Node {
    this.typeNames = new Set();
    for (const iface of node.interfaceDefinitions as InterfaceNode[]) this.typeNames.add(iface.name);
    for (const c of node.importedContracts as ContractNode[]) this.typeNames.add(c.name);
    if (node.contract) this.typeNames.add(node.contract.name);
    node.importedContracts = this.visitList(node.importedContracts) as ContractNode[];
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitMethodCall(node: MethodCallNode): Node {
    const visited = super.visitMethodCall(node) as MethodCallNode;
    // Only split args of a call whose receiver is an interface-cast external-call target (`IFace(addr).method`).
    if (this.isExternalReceiver(visited.object)) {
      visited.parameters = visited.parameters.flatMap((arg) => {
        const m = this.foreignMember(arg);
        return m ? [cloneNode(m.address) as ExpressionNode, this.selectorOf(m.iface, m.method, arg)] : [arg];
      });
    }
    return visited;
  }

  // `IFace(addr)` cast (or a chained `IFace(addr).getter()` etc.) - any expression rooted in a known type name.
  private isExternalReceiver(obj: ExpressionNode): boolean {
    if (obj instanceof FunctionCallNode && obj.identifier instanceof IdentifierNode) {
      return this.typeNames.has(obj.identifier.name);
    }
    if (obj instanceof FieldAccessNode) return this.isExternalReceiver(obj.expression);
    return false;
  }

  // `IFace(addr).method` -> its interface, method, and address arg.
  private foreignMember(expr: ExpressionNode): { iface: string; method: string; address: ExpressionNode } | undefined {
    if (!(expr instanceof FieldAccessNode)) return undefined;
    const base = expr.expression;
    if (!(base instanceof FunctionCallNode) || !(base.identifier instanceof IdentifierNode)) return undefined;
    if (base.parameters.length !== 1 || !this.typeNames.has(base.identifier.name)) return undefined;
    return { iface: base.identifier.name, method: expr.name, address: base.parameters[0] };
  }

  // `IFace.method.selector` (folds to the method's compile-time 4-byte selector).
  private selectorOf(iface: string, method: string, at: Node): FieldAccessNode {
    const id = new IdentifierNode(iface); id.location = at.location;
    const methodAccess = new FieldAccessNode(id, method); methodAccess.location = at.location;
    const sel = new FieldAccessNode(methodAccess, 'selector'); sel.location = at.location;
    return sel;
  }
}
