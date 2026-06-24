import {
  ContractNode,
  FunctionDefinitionNode,
  SourceFileNode,
  Node,
  ExpressionNode,
  VariableDefinitionNode,
  IdentifierNode,
  FunctionCallNode,
  MethodCallNode,
  BlockNode,
} from '../ast/AST.js';
import { AddressType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Rewrites an external method call on an interface-typed STATE VARIABLE (`token.transferFrom(..)`) into a call
 * on a synthesized local that reads the address from state at function entry:
 *
 * ```
 * IERC20 token; ... function f() { token.transferFrom(..); }
 * ->
 * function f() { IERC20 __extaddr_token = token; __extaddr_token.transferFrom(..); }
 * ```
 *
 * The local reuses the existing local-interface-var external-call dispatch (the dispatch verifies the co-spent
 * callee against the local's value = the address read from this contract's self-pinned state), so there are no
 * codegen or dispatch changes. Runs before semantic analysis so the synthesised decls resolve normally. The
 * constructor is not visited (it sets the immutable; the local would read it before assignment).
 */
const PREFIX = '__extaddr_';
const ADDRESS_METHODS = new Set(['send', 'call', 'staticcall', 'delegatecall']);

export default class SynthesizeExternalAddressLocals extends AstTraversal {
  private stateVarIface: Map<string, string> = new Map(); // interface-typed state var name -> interface name
  private usedInFn: Set<string> = new Set();

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.stateVarIface = new Map();
    for (const sv of node.stateVariables) {
      if (sv.type instanceof AddressType && sv.type.interfaceName) {
        this.stateVarIface.set(sv.name, sv.type.interfaceName);
      }
    }
    if (this.stateVarIface.size > 0) {
      node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    }
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (!node.body) return node;
    this.usedInFn = new Set();
    node.body = this.visit(node.body) as BlockNode;
    if (this.usedInFn.size > 0) {
      const decls = [...this.usedInFn].map((v) => {
        const init = new IdentifierNode(v); // reads the interface-typed state var (its stored address)
        init.location = node.location;
        const def = new VariableDefinitionNode(new AddressType(false, this.stateVarIface.get(v)), [], PREFIX + v, init);
        def.location = node.location;
        return def;
      });
      node.body.statements = [...decls, ...(node.body.statements ?? [])];
    }
    return node;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    const name = node.identifier.name;
    const dot = name.indexOf('.');
    if (dot > 0) {
      const varName = name.slice(0, dot);
      const method = name.slice(dot + 1);
      if (this.stateVarIface.has(varName) && !ADDRESS_METHODS.has(method)) {
        this.usedInFn.add(varName);
        const loc = node.identifier.location;
        node.identifier = new IdentifierNode(`${PREFIX}${varName}.${method}`);
        node.identifier.location = loc;
      }
    }
    node.parameters = this.visitList(node.parameters) as ExpressionNode[];
    return node;
  }

  // `token.method{value:}(..)` form: rewrite the object identifier to the synthesized __extaddr_ local.
  visitMethodCall(node: MethodCallNode): Node {
    if (
      node.object instanceof IdentifierNode && this.stateVarIface.has(node.object.name)
      && !ADDRESS_METHODS.has(node.methodName)
    ) {
      this.usedInFn.add(node.object.name);
      const loc = node.object.location;
      node.object = new IdentifierNode(PREFIX + node.object.name);
      node.object.location = loc;
    } else {
      node.object = this.visit(node.object) as ExpressionNode;
    }
    node.parameters = this.visitList(node.parameters) as ExpressionNode[];
    if (node.callOptions?.value) node.callOptions.value = this.visit(node.callOptions.value) as ExpressionNode;
    if (node.callOptions?.gas) node.callOptions.gas = this.visit(node.callOptions.gas) as ExpressionNode;
    return node;
  }
}
