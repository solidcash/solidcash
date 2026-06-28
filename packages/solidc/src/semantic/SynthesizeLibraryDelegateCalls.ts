import { AddressType, computeFunctionSignature, computeFunctionSelector } from '@solidcash/utils';
import {
  SourceFileNode, ContractNode, Node, FunctionCallStatementNode, LowLevelCallStatementNode,
  IdentifierNode, HexLiteralNode, ParameterNode, FunctionModifier, StateVariableNode,
  FunctionDefinitionNode,
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
  private delegateLibFns = new Map<string, { libName: string; fnName: string; selector: Uint8Array }>();
  private usedLibs = new Set<string>();
  private currentFn?: FunctionDefinitionNode;

  visitSourceFile(node: SourceFileNode): Node {
    this.delegateLibFns = new Map();
    for (const fn of node.freeFunctions) {
      if (!fn.modifiers.includes(FunctionModifier.DELEGATE)) continue;
      const dot = fn.name.lastIndexOf('.');
      if (dot < 0) continue;
      const libName = fn.name.slice(0, dot);
      const fnName = fn.name.slice(dot + 1);
      const sig = computeFunctionSignature(fnName, fn.parameters.map((p) => p.type.toString()));
      this.delegateLibFns.set(fn.name, { libName, fnName, selector: computeFunctionSelector(sig) });
    }
    if (this.delegateLibFns.size === 0) return node;

    this.usedLibs = new Set();
    node.contract = this.visit(node.contract) as ContractNode;

    // Verify the consumer's state layout matches each delegate library it calls: the library operates on the
    // caller's state at the library's own compile-time field offsets, so a mismatched layout silently corrupts
    // the caller's state. (Compile-time, untrusted-SDK-proof; complements the SDK withDelegatecall guard.)
    for (const libName of this.usedLibs) {
      const libVars = node.importedLibraryLayouts.get(libName);
      if (libVars) checkLayoutCompat(libName, libVars, node.contract.stateVariables);
    }

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

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const prev = this.currentFn;
    this.currentFn = node;
    const result = super.visitFunctionDefinition(node);
    this.currentFn = prev;
    return result;
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
    // Record the target so the SDK auto-wires the delegatecall co-spend (no manual withDelegatecall).
    if (this.currentFn) {
      (this.currentFn.libraryDelegateCalls ??= []).push({ library: info.libName, functionName: info.fnName });
    }
    const addr = new IdentifierNode(`__libAddr_${info.libName}`);
    addr.location = node.location;
    const data = new HexLiteralNode(info.selector);
    data.location = node.location;
    const ll = new LowLevelCallStatementNode(addr, data, 'delegatecall');
    ll.location = node.location;
    return ll;
  }
}

// The consumer's state layout must have the library's declared fields first, in the same order, with the same
// name and type (the proxy/impl storage-compatibility rule, checked across the delegatecall). A mismatch would
// make the library read/write the wrong field of the caller's commitment.
function checkLayoutCompat(libName: string, libVars: StateVariableNode[], consumerVars: StateVariableNode[]): void {
  for (let i = 0; i < libVars.length; i++) {
    const lv = libVars[i];
    const cv = consumerVars[i];
    if (!cv || cv.name !== lv.name || cv.type.toString() !== lv.type.toString()) {
      const got = cv ? `'${cv.name}' (${cv.type.toString()})` : 'no such field';
      throw new Error(
        `Library '${libName}' expects the caller's state field #${i} to be '${lv.name}' (${lv.type.toString()}), `
        + `but the caller has ${got}. A consumer of a delegate library must declare a compatible state layout `
        + '(the library\'s fields first, same order, name and type). See docs/library-contracts.md.',
      );
    }
  }
}
