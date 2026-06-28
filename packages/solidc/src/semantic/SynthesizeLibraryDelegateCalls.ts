import { AddressType, computeFunctionSignature, computeFunctionSelector } from '@solidcash/utils';
import {
  SourceFileNode, ContractNode, Node, FunctionCallStatementNode, LowLevelCallStatementNode,
  IdentifierNode, HexLiteralNode, ParameterNode, FunctionModifier,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Desugars `L.f()` calls to a state-touching ("delegate") library into a delegatecall, so a consumer calls an
 * imported library's public functions with plain Solidity syntax (no SolidCash `delegate`/`delegatecall`
 * keyword). A delegate library function is marked DELEGATE on the import path (AstBuilder, when the library
 * declares state); it runs against the CALLER's state via the existing delegatecall machinery.
 *
 *   import { Counter } from "./counter.scash"; // library Counter { bigint count; function inc() public {...} }
 *   contract C() { bigint count; function bump() { Counter.inc(); } }
 *   ->  contract C(address __libAddr_Counter) { bigint count;
 *         function bump() { __libAddr_Counter.delegatecall(<inc selector>); } }
 *
 * Runs pre-semantic, after import resolution. The library's deployed address is a synthesized constructor arg
 * (EVM-link style): the SDK supplies it and co-spends the library. See docs/library-contracts.md (3b sugar).
 * First form: no-argument library functions (args via abi.encodeWithSelector + return values are follow-ups).
 */
export default class SynthesizeLibraryDelegateCalls extends AstTraversal {
  private delegateLibFns = new Map<string, { libName: string; selector: Uint8Array }>();
  private usedLibs = new Set<string>();

  visitSourceFile(node: SourceFileNode): Node {
    this.delegateLibFns = new Map();
    for (const fn of node.freeFunctions) {
      if (!fn.modifiers.includes(FunctionModifier.DELEGATE)) continue;
      const dot = fn.name.lastIndexOf('.');
      if (dot < 0) continue;
      const libName = fn.name.slice(0, dot);
      const fnName = fn.name.slice(dot + 1);
      const sig = computeFunctionSignature(fnName, fn.parameters.map((p) => p.type.toString()));
      this.delegateLibFns.set(fn.name, { libName, selector: computeFunctionSelector(sig) });
    }
    if (this.delegateLibFns.size === 0) return node;

    this.usedLibs = new Set();
    node.contract = this.visit(node.contract) as ContractNode;

    // One synthesized address constructor arg per library used (the library's deployed address; the SDK
    // supplies it and co-spends the library at call time).
    for (const libName of this.usedLibs) {
      const param = new ParameterNode(new AddressType(), `__libAddr_${libName}`);
      param.location = node.contract.location;
      node.contract.parameters.push(param);
    }
    // Delegate library functions are delegate-called, not inlined - drop them from the free functions.
    node.freeFunctions = node.freeFunctions.filter((f) => !this.delegateLibFns.has(f.name));
    return node;
  }

  visitFunctionCallStatement(node: FunctionCallStatementNode): Node {
    const name = node.call.identifier?.name;
    const info = name ? this.delegateLibFns.get(name) : undefined;
    if (!info) return super.visitFunctionCallStatement(node);

    if (node.call.parameters.length > 0) {
      throw new Error(
        `Library delegate call '${name}' with arguments is not yet supported (no-argument library functions `
        + 'only for now). See docs/library-contracts.md.',
      );
    }
    this.usedLibs.add(info.libName);
    const addr = new IdentifierNode(`__libAddr_${info.libName}`);
    addr.location = node.location;
    const data = new HexLiteralNode(info.selector);
    data.location = node.location;
    const ll = new LowLevelCallStatementNode(addr, data, 'delegatecall');
    ll.location = node.location;
    return ll;
  }
}
