import {
  ContractNode,
  SourceFileNode,
  Node,
  FunctionDefinitionNode,
  ExpressionNode,
  FunctionCallNode,
  IdentifierNode,
  ParameterNode,
} from '../ast/AST.js';
import { AddressType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * A Solidity constructor can read a value from another contract - `token0 = IERC20(pool.token0())` - because the
 * constructor runs on-chain at deploy. BCH has no on-chain constructor: immutables are computed off-chain and
 * baked into the contract's initial state. So a zero-arg external read on an interface-typed state var IN THE
 * CONSTRUCTOR is hoisted to a synthesized deploy input (an extra constructor parameter). The deployer/SDK
 * resolves it off-chain (reads pool.token0()) and supplies it at deploy - matching Solidity's deploy-time-read
 * intent. This lets a contract whose immutable external-call targets derive from such a read compile and deploy
 * (the read result becomes a pinnable baked value, like any other constructor-provided immutable).
 *
 * Runs before semantic analysis so the synthesized param + its uses resolve normally. Only the constructor is
 * visited (a read in a normal function is a real on-chain external call, handled by SynthesizeExternalAddressLocals).
 */
const ADDRESS_METHODS = new Set(['send', 'call', 'staticcall', 'delegatecall', 'transfer', 'connect']);

export default class PromoteConstructorExternalReads extends AstTraversal {
  private stateVarIface = new Map<string, string>(); // interface-typed state var name -> interface name
  private promoted: { param: string; read: string }[] = [];
  private counter = 0;
  private active = false;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    if (!node.constructorDef) return node;
    this.stateVarIface = new Map();
    for (const sv of node.stateVariables) {
      if (sv.type instanceof AddressType && sv.type.interfaceName) {
        this.stateVarIface.set(sv.name, sv.type.interfaceName);
      }
    }
    if (this.stateVarIface.size === 0) return node;

    this.promoted = [];
    this.counter = 0;
    this.active = true;
    node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    this.active = false;

    for (const p of this.promoted) {
      const param = new ParameterNode(new AddressType(), p.param, []);
      param.location = node.constructorDef.location;
      node.constructorDef.parameters.push(param);
    }
    if (this.promoted.length > 0) {
      const list = this.promoted.map((p) => `${p.param} = ${p.read}`).join(', ');
      console.warn(`Warning: constructor external read(s) hoisted to deploy inputs (${list}). BCH has no `
        + 'on-chain constructor, so supply the resolved address(es) at deploy (read them off-chain from the '
        + 'target contract). See docs/deploy-external-reads.md.');
    }
    return node;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    // A namespaced zero-arg call `pool.token0()` on an interface-typed state var, inside the constructor, is a
    // deploy-time external read: replace it with a reference to a synthesized deploy-input parameter.
    if (this.active && node.parameters.length === 0) {
      const name = node.identifier.name;
      const dot = name.indexOf('.');
      if (dot > 0) {
        const varName = name.slice(0, dot);
        const method = name.slice(dot + 1);
        if (this.stateVarIface.has(varName) && !ADDRESS_METHODS.has(method)) {
          const paramName = `__ctorread_${varName}_${method}_${this.counter++}`;
          this.promoted.push({ param: paramName, read: `${varName}.${method}()` });
          const id = new IdentifierNode(paramName);
          id.location = node.location;
          return id;
        }
      }
    }
    node.parameters = this.visitList(node.parameters) as ExpressionNode[];
    return node;
  }
}
