import { binToHex } from '@bitauth/libauth';
import { AddressType, computeFunctionSignature, computeFunctionSelector, LibraryCallArg } from '@solidcash/utils';
import {
  SourceFileNode, ContractNode, Node, FunctionCallStatementNode, LowLevelCallStatementNode,
  IdentifierNode, HexLiteralNode, ParameterNode, FunctionModifier, StateVariableNode,
  FunctionDefinitionNode, FunctionCallNode, IntLiteralNode, BoolLiteralNode, StringLiteralNode,
  ExpressionNode, CastNode,
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
 * Arguments may forward the enclosing function's parameters or pass literals (encoded per the library param
 * type); the SDK resolves them and supplies them to the library unlocker. Return values are via shared state.
 */
type DelegateLibFn = { libName: string; fnName: string; selector: Uint8Array; paramTypes: string[] };

export default class SynthesizeLibraryDelegateCalls extends AstTraversal {
  private delegateLibFns = new Map<string, DelegateLibFn>();
  private usedLibs = new Set<string>();
  private knownLibs = new Set<string>();
  private currentFn?: FunctionDefinitionNode;

  visitSourceFile(node: SourceFileNode): Node {
    this.delegateLibFns = new Map();
    for (const fn of node.freeFunctions) {
      if (!fn.modifiers.includes(FunctionModifier.DELEGATE)) continue;
      const dot = fn.name.lastIndexOf('.');
      if (dot < 0) continue;
      const libName = fn.name.slice(0, dot);
      const fnName = fn.name.slice(dot + 1);
      const paramTypes = fn.parameters.map((p) => p.type.toString());
      const sig = computeFunctionSignature(fnName, paramTypes);
      this.delegateLibFns.set(fn.name, { libName, fnName, selector: computeFunctionSelector(sig), paramTypes });
    }
    // Known library names (inline + imported) so `address(L)` resolves to the library's link-time address.
    this.knownLibs = new Set(node.declaredLibraryNames);
    if ((this.delegateLibFns.size === 0 && this.knownLibs.size === 0) || !node.contract) return node;

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

  // `address(L)` where L is a library resolves to the library's link-time address - the same synthesized
  // `__libAddr_L` constructor arg the delegate-call path uses (EVM library-linking parity: the SDK supplies the
  // linked address). Referencing a library only by address still triggers the param synthesis (via usedLibs).
  visitCast(node: CastNode): Node {
    if (node.type instanceof AddressType
      && node.expression instanceof IdentifierNode
      && this.knownLibs.has(node.expression.name)) {
      this.usedLibs.add(node.expression.name);
      const addr = new IdentifierNode(`__libAddr_${node.expression.name}`);
      addr.location = node.location;
      return addr;
    }
    return super.visitCast(node);
  }

  // A delegate library call in expression position (its return value is used) is rejected: a delegate library
  // is co-spent with no synchronous return on BCH. Statement-form calls are rewritten in
  // visitFunctionCallStatement and never reach here.
  visitFunctionCall(node: FunctionCallNode): Node {
    const name = node.identifier?.name;
    const info = name ? this.delegateLibFns.get(name) : undefined;
    if (info) {
      throw new Error(
        `Delegate library call '${name}' is used as a value, but a delegate library cannot return a value to the `
        + 'caller (it is co-spent with no synchronous return on BCH). Have '
        + `'${info.libName}.${info.fnName}' write its result to the shared state and read it from the caller's own `
        + 'state afterward, or use a pure library (precompile) for value-returning helpers. '
        + 'See docs/library-contracts.md.',
      );
    }
    return super.visitFunctionCall(node);
  }

  visitFunctionCallStatement(node: FunctionCallStatementNode): Node {
    const name = node.call.identifier?.name;
    const info = name ? this.delegateLibFns.get(name) : undefined;
    if (!info) return super.visitFunctionCallStatement(node);

    // Arguments are positional: a forwarded enclosing-function parameter (the SDK reads its value from the
    // consumer call) or a literal (encoded per the library param type; the SDK reconstructs it). Both reach the
    // library via its SDK-built unlocker, since the delegatecall data is not on-chain. Computed expressions and
    // state reads are not supported (the SDK cannot evaluate them).
    if (node.call.parameters.length !== info.paramTypes.length) {
      throw new Error(
        `Library delegate call '${name}' expects ${info.paramTypes.length} argument(s) but got `
        + `${node.call.parameters.length}.`,
      );
    }
    const args: LibraryCallArg[] = node.call.parameters.map(
      (arg, i) => this.toLibraryCallArg(arg, info.paramTypes[i], name!),
    );
    this.usedLibs.add(info.libName);
    // Record the target so the SDK auto-wires the delegatecall co-spend (no manual withDelegatecall).
    if (this.currentFn) {
      (this.currentFn.libraryDelegateCalls ??= []).push(
        { library: info.libName, functionName: info.fnName, args },
      );
    }
    const addr = new IdentifierNode(`__libAddr_${info.libName}`);
    addr.location = node.location;
    const data = new HexLiteralNode(info.selector);
    data.location = node.location;
    const ll = new LowLevelCallStatementNode(addr, data, 'delegatecall');
    ll.synthesizedFromLibraryCall = true;
    // C1/piece-7: a library with >= 2 public functions compiles to a selector-dispatched contract, so its
    // unlocking script leads with the selector and the co-spend pin can verify it. With one public function
    // there is no selector and nothing to choose.
    ll.librarySelectorDispatched = [...this.delegateLibFns.values()]
      .filter((candidate) => candidate.libName === info.libName).length > 1;
    ll.location = node.location;
    return ll;
  }

  // Map one call argument to a LibraryCallArg: a forwarded enclosing-function parameter, or a literal encoded
  // per the library parameter's type. Throws on anything else (computed expression, state read, or a literal
  // whose kind does not match the parameter type).
  private toLibraryCallArg(arg: ExpressionNode, paramType: string, callName: string): LibraryCallArg {
    if (arg instanceof IdentifierNode) {
      const param = this.currentFn?.parameters.find((p) => p.name === arg.name);
      if (!param) {
        throw new Error(
          `Library delegate call '${callName}' argument '${arg.name}' is not a parameter of the enclosing `
          + 'function. Only enclosing-function parameters and literals are supported (computed expressions and '
          + 'state reads are not). See docs/library-contracts.md.',
        );
      }
      param.syntheticallyUsed = true; // used via SDK forwarding; suppress the unused-variable warning
      return { param: param.name };
    }
    const kind = literalKindForType(paramType);
    if (kind === 'int' && arg instanceof IntLiteralNode) return { literal: arg.value.toString(), kind };
    if (kind === 'bool' && arg instanceof BoolLiteralNode) return { literal: arg.value ? 'true' : 'false', kind };
    if (kind === 'bytes' && arg instanceof HexLiteralNode) return { literal: binToHex(arg.value), kind };
    if (kind === 'string' && arg instanceof StringLiteralNode) return { literal: arg.value, kind };
    throw new Error(
      `Library delegate call '${callName}' argument must be an enclosing-function parameter or a ${kind} literal `
      + `matching the parameter type '${paramType}'. Computed expressions and state reads are not supported. `
      + 'See docs/library-contracts.md.',
    );
  }
}

// The literal encoding for a library parameter type: int-like -> 'int', bool -> 'bool', string -> 'string',
// everything else (bytes, bytesN, address, pubkey, sig, ...) -> 'bytes'.
function literalKindForType(t: string): 'int' | 'bool' | 'bytes' | 'string' {
  if (t === 'bool') return 'bool';
  if (t === 'string') return 'string';
  if (t === 'bigint' || /^u?int\d*$/.test(t)) return 'int';
  return 'bytes';
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
