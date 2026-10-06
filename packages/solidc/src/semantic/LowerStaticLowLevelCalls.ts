import {
  AbiEncodeCallNode,
  AbiEncodeNode,
  AbiEncodeWithSelectorNode,
  AbiEncodeWithSignatureNode,
  AssignNode,
  BlockNode,
  BoolLiteralNode,
  type CallOptions,
  CastNode,
  ContractNode,
  ExpressionNode,
  FieldAccessNode,
  FunctionCallNode,
  FunctionDefinitionNode,
  HexLiteralNode,
  IdentifierNode,
  InterfaceFunctionNode,
  InterfaceNode,
  LowLevelCallNode,
  LowLevelCallStatementNode,
  type LowLevelRoute,
  MethodCallNode,
  MethodCallStatementNode,
  Node,
  ParameterNode,
  ReturnNode,
  SourceFileNode,
  StatementNode,
  StringLiteralNode,
  TupleAssignmentNode,
  VariableDefinitionNode,
} from '../ast/AST.js';
import {
  AddressType, BytesType, computeEvmFunctionSelector, computeFunctionSelector, computeFunctionSignature, type Type,
} from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { isStaticallyZeroCallValue } from './branchOps.js';

/** Temporary holding a typed call's return values while the low-level `(success, returndata)` pair is rebuilt. */
const PREFIX = '__staticcall_ret_';

/** The ABI entry a contract's fallback is published under, which a call routed to it names. */
const FALLBACK_ENTRY = '__fallback';

/** One call a low-level payload names statically: an interface method, or the target's fallback. */
interface NamedCall {
  readonly interfaceName: string;
  readonly functionName: string;
  readonly args: ExpressionNode[];
  /** Set when no function of the target's interface has the payload's selector, which its fallback then runs. */
  readonly fallback?: LowLevelRoute['fallback'];
}

/** A low-level call site, with the value the callee is addressed by and the spelling that chose its frame. */
interface LowLevelSite {
  readonly target: ExpressionNode;
  readonly payload: ExpressionNode;
  readonly mode: 'call' | 'staticcall';
}

/**
 * Rewrites a low-level call whose payload names its call statically into the typed call it denotes.
 *
 * `address(t).call(abi.encodeCall(I.f, (args)))` and `address(t).call(abi.encodeWithSelector(I.f.selector, args))`
 * both denote `I(address(t)).f(args)`. The rewrite emits that typed call and rebuilds the low-level result from it:
 * a reached call on BCH either aborts the transaction or succeeds, so the success bit is the constant true, and
 * the return data is the ABI encoding of the typed call's own return values. The typed call is the one the
 * convention already compiles, so the site publishes the same call record, argument digest and callee reference as
 * the spelled-out typed call. `I` may be an interface or a contract the unit declares, typed as the semantic pass
 * types it: by its entry points.
 *
 * `abi.encodeWithSignature("f(T1,..)", args)` names its call through the target's own type: a function of it with
 * that signature, or, when none has the payload's selector, the target's fallback, which runs with the payload's own
 * selector and no arguments. The call keeps the frame kind its spelling chose: `staticcall` a static frame, `call` a
 * message frame, whatever the method's mutability.
 *
 * A payload the compiler cannot name statically - a selector computed at run time, an interface it does not know,
 * a target whose type it cannot read, a fallback it cannot run - is left alone, so the call keeps its own low-level
 * refusal.
 *
 * The method may be named through a variable of the interface's type (`abi.encodeCall(token.f, (args))`, as OZ
 * SafeERC20 spells it) rather than the interface name itself; the interface is then read from the variable's
 * declaration. A receiver the pass cannot type resolves to no call and stays opaque.
 *
 * A payload held in a local (`bytes data = abi.encodeCall(I.f, (args)); addr.call(data)`) denotes the same call when
 * the enclosing block bound that local, earlier in source order and without a later reassignment, to exactly one
 * such abi-encode expression. The lookup is flow-local and block-scoped; every other local stays opaque.
 */
export default class LowerStaticLowLevelCalls extends AstTraversal {
  private interfaces = new Map<string, InterfaceNode>();
  /** The interfaces the source declares, whose handle as a receiver names the callee itself. */
  private declaredInterfaces = new Set<string>();
  /** The contracts the unit declares, by name, whose fallback a call their entry points do not name can run. */
  private contracts = new Map<string, ContractNode>();
  /** Every function, state variable and collection name a contract or an interface of the unit declares. */
  private declaredNames = new Set<string>();
  private counter = 0;
  /** The locals currently being followed, so a chain that names itself stops instead of recursing. */
  private resolving = new Set<string>();
  // One map per lexical block, innermost last. A name present here shadows any outer binding; a value that is not
  // an abi-encode node marks a local that was bound to something else (or reassigned), so the lookup stops there.
  private payloadScopes: Map<string, ExpressionNode | undefined>[] = [];
  // The initializer each local is bound to, in the same lexical-block order, so a call option whose value is one
  // of those locals (`{value: v}` after an inliner bound `v` to `0`) resolves without the symbol pass.
  private valueScopes: Map<string, ExpressionNode | undefined>[] = [];
  // The declared type of each in-scope name, in the same lexical-block order as `payloadScopes`. A payload's
  // receiver may be an interface-typed variable (`abi.encodeCall(token.transfer, ..)`, as OZ SafeERC20 spells it)
  // rather than the interface name itself, so the callee's interface is read from the variable's declaration.
  private declaredTypes: Map<string, Type>[] = [];
  // State variables are visible in every body, so their declared types sit below the block scopes.
  private stateVariableTypes = new Map<string, Type>();
  // Parameter types of the function whose body is being entered; consumed by that body's own block scope.
  private incomingParameterTypes: Map<string, Type> | undefined;

  /** `evmCompat` selects the selector rule `abi.encodeWithSignature` follows, as the semantic pass does. */
  constructor(private readonly evmCompat = false) {
    super();
  }

  visitSourceFile(node: SourceFileNode): Node {
    this.interfaces = new Map(node.interfaceDefinitions.map((iface) => [iface.name, iface]));
    this.declaredInterfaces = new Set(this.interfaces.keys());
    // A contract the unit declares is a call target too, typed as the semantic pass types it: by its entry points.
    this.contracts = new Map();
    for (const contract of [...node.importedContracts, node.contract]) {
      if (contract === undefined || this.interfaces.has(contract.name)) continue;
      this.contracts.set(contract.name, contract);
      this.interfaces.set(contract.name, contractInterface(contract));
    }
    this.declaredNames = new Set([...node.interfaceDefinitions, ...node.importedContracts, node.contract]
      .flatMap((declared) => (declared === undefined ? [] : [
        ...declared.functions, ...declared.stateVariables, ...declared.collections,
      ].map((member) => member.name))));
    this.stateVariableTypes = new Map((node.contract?.stateVariables ?? []).map((sv) => [sv.name, sv.type]));
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    node.freeFunctions = this.visitList(node.freeFunctions) as FunctionDefinitionNode[];
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    this.incomingParameterTypes = new Map(node.parameters.map((parameter) => [parameter.name, parameter.type]));
    return super.visitFunctionDefinition(node);
  }

  visitContract(node: ContractNode): Node {
    const bodies = [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef];
    for (const fn of bodies) {
      if (!fn?.body) continue;
      this.incomingParameterTypes = new Map(fn.parameters.map((parameter) => [parameter.name, parameter.type]));
      fn.body = this.visit(fn.body) as BlockNode;
    }
    return node;
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    this.payloadScopes.push(new Map());
    this.valueScopes.push(new Map());
    this.declaredTypes.push(new Map(this.incomingParameterTypes ?? []));
    this.incomingParameterTypes = undefined;
    for (const statement of node.statements ?? []) {
      const visited = this.visit(statement) as StatementNode;
      const rewritten = this.rewriteStatement(visited);
      const emitted = rewritten ?? [visited];
      out.push(...emitted);
      for (const item of emitted) this.recordDeclaredType(item);
      this.recordPayloadBinding(visited);
      this.recordValueBinding(visited);
    }
    this.payloadScopes.pop();
    this.valueScopes.pop();
    this.declaredTypes.pop();
    node.statements = out;
    return node;
  }

  /** Track the declared type of each name a statement binds, so a payload receiver resolves through it. */
  private recordDeclaredType(statement: StatementNode): void {
    const scope = this.declaredTypes[this.declaredTypes.length - 1];
    if (!scope) return;
    if (statement instanceof VariableDefinitionNode) {
      scope.set(statement.name, statement.type);
      return;
    }
    if (statement instanceof TupleAssignmentNode) {
      for (const element of statement.elements) {
        if (element.name && element.type) scope.set(element.name, element.type);
      }
    }
  }

  /** Track a payload local declared by `statement`, or drop one a later statement reassigns. */
  private recordPayloadBinding(statement: StatementNode): void {
    const scope = this.payloadScopes[this.payloadScopes.length - 1];
    if (!scope) return;
    if (statement instanceof VariableDefinitionNode) {
      scope.set(statement.name, this.carriedPayload(statement.expression));
      return;
    }
    if (statement instanceof AssignNode) {
      this.setPayloadBinding(statement.identifier.name, this.carriedPayload(statement.expression));
      return;
    }
    if (statement instanceof TupleAssignmentNode) {
      for (const element of statement.elements) {
        if (element.name) this.forgetPayloadBinding(element.name);
      }
    }
  }

  /** Track the initializer a local is bound to, so a call option naming it resolves while the pass is running. */
  private recordValueBinding(statement: StatementNode): void {
    const scope = this.valueScopes[this.valueScopes.length - 1];
    if (!scope) return;
    if (statement instanceof VariableDefinitionNode) {
      scope.set(statement.name, statement.expression);
      return;
    }
    if (statement instanceof AssignNode) {
      this.setValueBinding(statement.identifier.name, statement.expression);
      return;
    }
    if (statement instanceof TupleAssignmentNode) {
      for (const element of statement.elements) {
        if (element.name) this.setValueBinding(element.name, undefined);
      }
    }
  }

  /** Sets the initializer a name is bound to, in the innermost scope that holds the name. */
  private setValueBinding(name: string, value: ExpressionNode | undefined): void {
    for (let index = this.valueScopes.length - 1; index >= 0; index -= 1) {
      const scope = this.valueScopes[index]!;
      if (scope.has(name)) {
        scope.set(name, value);
        return;
      }
    }
  }

  /**
   * True when a value is statically zero, reading a local through the binding this pass has tracked.
   *
   * `isStaticallyZeroCallValue` resolves a local through its symbol-table definition, which does not exist while
   * the preprocessing passes run, so a name is instead followed through the initializers the current block bound.
   */
  private isStaticallyZero(expression: ExpressionNode | undefined, seen = new Set<string>()): boolean {
    if (isStaticallyZeroCallValue(expression)) return true;
    if (!(expression instanceof IdentifierNode) || seen.has(expression.name)) return false;
    seen.add(expression.name);
    for (let index = this.valueScopes.length - 1; index >= 0; index -= 1) {
      const scope = this.valueScopes[index]!;
      if (scope.has(expression.name)) return this.isStaticallyZero(scope.get(expression.name), seen);
    }
    return false;
  }

  /**
   * Whether a call's options leave it transactionally the call alone.
   *
   * `{value: 0}` pays nothing, so the call denotes the same typed call as the spelling without the option; `gas`
   * is inert on BCH and a `salt` names a deployment. Any other value is one the running code computes and carries
   * a payment the typed call would not, so that spelling keeps its own lowering.
   */
  private callCarriesNoValue(options: CallOptions | undefined): boolean {
    if (options === undefined) return true;
    return this.isStaticallyZero(options.value) && options.gas === undefined && options.salt === undefined;
  }

  /**
   * The payload a value carries on, or undefined when it names nothing this pass can follow.
   *
   * A local may be filled from another local rather than from the abi-encode expression directly: an inlined body
   * declares its parameter and assigns the caller's argument to it, so the chain is followed name by name.
   */
  private carriedPayload(value: ExpressionNode | undefined): ExpressionNode | undefined {
    if (value instanceof AbiEncodeCallNode || value instanceof AbiEncodeWithSelectorNode
      || value instanceof AbiEncodeWithSignatureNode) return value;
    return value instanceof IdentifierNode ? value : undefined;
  }

  private forgetPayloadBinding(name: string): void {
    this.setPayloadBinding(name, undefined);
  }

  /** Sets the payload a name is bound to, in the innermost scope that holds the name. */
  private setPayloadBinding(name: string, value: ExpressionNode | undefined): void {
    for (let index = this.payloadScopes.length - 1; index >= 0; index -= 1) {
      const scope = this.payloadScopes[index]!;
      if (scope.has(name)) {
        scope.set(name, value);
        return;
      }
    }
  }

  /** The abi-encode expression a bare payload identifier was bound to, if the block still holds that binding. */
  private boundPayload(name: string): ExpressionNode | undefined {
    for (let index = this.payloadScopes.length - 1; index >= 0; index -= 1) {
      const scope = this.payloadScopes[index]!;
      if (scope.has(name)) return scope.get(name);
    }
    return undefined;
  }

  private rewriteStatement(statement: StatementNode): StatementNode[] | undefined {
    // `(bool ok, bytes data) = target.call(payload);`
    if (statement instanceof TupleAssignmentNode && !statement.tupleExpressions
      && statement.elements.length === 2) {
      const site = this.matchLowLevelCall(statement.tuple);
      if (!site) return undefined;
      const lowered = this.lower(site);
      if (!lowered) return undefined;
      const values = [lowered.success, lowered.retval];
      statement.elements.forEach((element, index) => {
        if (element.skip) return;
        if (element.existing) {
          const target = new IdentifierNode(element.name!);
          target.location = statement.location;
          const assign = new AssignNode(target, values[index]!());
          assign.location = statement.location;
          lowered.stmts.push(assign);
          return;
        }
        const definition = new VariableDefinitionNode(element.type!, [], element.name!, values[index]!());
        definition.location = statement.location;
        lowered.stmts.push(definition);
      });
      return lowered.stmts;
    }
    // `return target.call(payload);`
    if (statement instanceof ReturnNode && statement.expressions.length === 1) {
      const site = this.matchLowLevelCall(statement.expressions[0]);
      if (!site) return undefined;
      const lowered = this.lower(site);
      if (!lowered) return undefined;
      const returned = new ReturnNode([lowered.success(), lowered.retval()]);
      returned.location = statement.location;
      return [...lowered.stmts, returned];
    }
    // `target.call(payload);`
    if (statement instanceof LowLevelCallStatementNode) {
      if (statement.callMode !== 'call' && statement.callMode !== 'staticcall') return undefined;
      if (!this.callCarriesNoValue(statement.callOptions)) return undefined;
      const lowered = this.lower({
        target: statement.targetExpression, payload: statement.data, mode: statement.callMode,
      }, true);
      return lowered?.stmts;
    }
    return undefined;
  }

  private matchLowLevelCall(expression: ExpressionNode | undefined): LowLevelSite | undefined {
    if (expression instanceof MethodCallNode
      && (expression.methodName === 'call' || expression.methodName === 'staticcall')
      && expression.parameters.length === 1 && this.callCarriesNoValue(expression.callOptions)) {
      // An interface handle as the receiver already names the callee, so the payload's interface is not the method
      // the spelling denotes; leave that form to its own lowering.
      if (expression.object instanceof FunctionCallNode
        && this.declaredInterfaces.has(expression.object.identifier.name)) {
        return undefined;
      }
      return { target: expression.object, payload: expression.parameters[0]!, mode: expression.methodName };
    }
    if (expression instanceof LowLevelCallNode
      && (expression.callMode === 'call' || expression.callMode === 'staticcall')
      && this.callCarriesNoValue(expression.callOptions)) {
      return { target: expression.targetExpression, payload: expression.data, mode: expression.callMode };
    }
    // A simple identifier receiver parses as a namespaced call (`target.call(payload)`), not a MethodCall.
    if (expression instanceof FunctionCallNode && this.callCarriesNoValue(expression.callOptions)
      && expression.parameters.length === 1) {
      const name = expression.identifier.name;
      const dot = name.lastIndexOf('.');
      const method = dot < 0 ? undefined : name.slice(dot + 1);
      const receiver = dot < 0 ? undefined : name.slice(0, dot);
      if ((method === 'call' || method === 'staticcall') && receiver !== undefined && !receiver.includes('.')) {
        // `this.<fn>(..)` is a self-invocation, and an interface handle already names its own callee.
        if (receiver === 'this' || this.declaredInterfaces.has(receiver)) return undefined;
        const target = new IdentifierNode(receiver);
        target.location = expression.identifier.location;
        return { target, payload: expression.parameters[0]!, mode: method };
      }
    }
    return undefined;
  }

  private lower(site: LowLevelSite, discardResult = false): {
    stmts: StatementNode[]; success: () => ExpressionNode; retval: () => ExpressionNode;
  } | undefined {
    const named = this.resolveNamedCall(site.payload, site.target);
    if (!named) return undefined;
    // A fallback route returns nothing the caller reads: the run's return data is the empty bytes.
    const fn = named.fallback === undefined
      ? this.findFunction(named.interfaceName, named.functionName)
      : new InterfaceFunctionNode(named.functionName, [], []);
    if (!fn) return undefined;

    const loc = site.target.location;
    const receiver = new FunctionCallNode(new IdentifierNode(named.interfaceName), [site.target]);
    receiver.location = loc;
    const typedCall = new MethodCallNode(receiver, named.functionName, named.args);
    typedCall.location = loc;
    typedCall.lowLevelRoute = { mode: site.mode, ...(named.fallback === undefined ? {} : { fallback: named.fallback }) };

    const success = (): ExpressionNode => {
      const literal = new BoolLiteralNode(true);
      literal.location = loc;
      return literal;
    };
    const emptyBytes = (): ExpressionNode => {
      const empty = new HexLiteralNode(new Uint8Array(0));
      empty.type = new BytesType();
      empty.location = loc;
      return empty;
    };

    const stmts: StatementNode[] = [];
    let retval: () => ExpressionNode = emptyBytes;
    if (discardResult || fn.returnTypes.length === 0) {
      const statement = new MethodCallStatementNode(typedCall);
      statement.location = loc;
      stmts.push(statement);
    } else {
      const uid = this.counter++;
      const names = fn.returnTypes.map((_, index) => `${PREFIX}${uid}_${index}`);
      if (fn.returnTypes.length === 1) {
        const definition = new VariableDefinitionNode(fn.returnTypes[0]!, [], names[0]!, typedCall);
        definition.location = loc;
        stmts.push(definition);
      } else {
        const tuple = new TupleAssignmentNode(
          names.map((name, index) => ({ name, type: fn.returnTypes[index] })), typedCall,
        );
        tuple.location = loc;
        stmts.push(tuple);
      }
      retval = (): ExpressionNode => {
        const reads = names.map((name) => {
          const read = new IdentifierNode(name);
          read.location = loc;
          return read;
        });
        const encoded = new AbiEncodeNode(reads);
        encoded.location = loc;
        encoded.type = new BytesType();
        return encoded;
      };
    }
    return { stmts, success, retval };
  }

  private resolveNamedCall(payload: ExpressionNode, target: ExpressionNode): NamedCall | undefined {
    if (payload instanceof IdentifierNode) {
      // Locals may name each other - an inlined body's parameter is assigned the caller's local, which is itself
      // bound to the payload - so a name already being resolved is not followed again.
      if (this.resolving.has(payload.name)) return undefined;
      const bound = this.boundPayload(payload.name);
      if (!bound) return undefined;
      this.resolving.add(payload.name);
      try {
        const named = this.resolveNamedCall(bound, target);
        // The bound declaration keeps its own argument nodes, so the typed call reads independent copies.
        return named && { ...named, args: named.args.map((arg) => cloneNode(arg)) };
      } finally {
        this.resolving.delete(payload.name);
      }
    }
    if (payload instanceof AbiEncodeCallNode) {
      if (payload.interfaceName === 'this') return undefined;
      const interfaceName = this.resolveReceiverInterface(payload.interfaceName);
      if (interfaceName === undefined) return undefined;
      return { interfaceName, functionName: payload.functionName, args: payload.parameters };
    }
    if (payload instanceof AbiEncodeWithSelectorNode) {
      const selector = payload.selector;
      if (!(selector instanceof FieldAccessNode) || selector.name !== 'selector') return undefined;
      const declaration = selector.expression;
      if (!(declaration instanceof FieldAccessNode) || !(declaration.expression instanceof IdentifierNode)) {
        return undefined;
      }
      const interfaceName = this.resolveReceiverInterface(declaration.expression.name);
      if (interfaceName === undefined) return undefined;
      return { interfaceName, functionName: declaration.name, args: payload.parameters };
    }
    if (payload instanceof AbiEncodeWithSignatureNode && payload.signature instanceof StringLiteralNode) {
      return this.resolveSignatureCall(payload.signature.value, payload.parameters, target);
    }
    return undefined;
  }

  /**
   * The call a signature payload names through the target's own type, or undefined when it names none this pass
   * can serve.
   *
   * The payload's selector is the hash of the signature exactly as written, as the EVM's is, so the method it names
   * is the one whose canonical signature is that string. When no method of the target has the selector, the
   * target's fallback runs: a contract the unit declares must have one that returns nothing, and an interface is
   * taken at its word that its implementation does. Such a call carries no arguments here. A name the unit declares
   * anywhere may be a method or a getter the target answers through a base this pass does not see, so only a name
   * declared nowhere is routed to the fallback.
   */
  private resolveSignatureCall(
    signature: string, args: ExpressionNode[], target: ExpressionNode,
  ): NamedCall | undefined {
    const interfaceName = this.targetInterface(target);
    if (interfaceName === undefined) return undefined;
    const functions = this.interfaceFunctions(interfaceName);
    const canonical = (fn: InterfaceFunctionNode): string =>
      computeFunctionSignature(fn.name, fn.parameters.map((parameter) => parameter.type.toString()));
    const named = functions.find((fn) => canonical(fn) === signature);
    if (named !== undefined) {
      // The typed call resolves its method by name, so an overloaded name is not one it can pick.
      if (functions.filter((fn) => fn.name === named.name).length !== 1) return undefined;
      if (named.parameters.length !== args.length) return undefined;
      return { interfaceName, functionName: named.name, args };
    }
    if (args.length > 0 || this.declaredNames.has(signature.split('(')[0]!)) return undefined;
    const contract = this.contracts.get(interfaceName);
    if (contract !== undefined
      && (contract.fallbackDef === undefined || contract.fallbackDef.returnTypes.length > 0)) return undefined;
    const selector = this.evmCompat ? computeEvmFunctionSelector(signature) : computeFunctionSelector(signature);
    const answered = functions.some((fn) =>
      computeFunctionSelector(canonical(fn)).every((byte, index) => byte === selector[index]));
    if (answered) return undefined;
    return { interfaceName, functionName: FALLBACK_ENTRY, args, fallback: { selector } };
  }

  /** The interface a call's target is typed as, through the address casts around it, or undefined. */
  private targetInterface(target: ExpressionNode): string | undefined {
    let inner = target;
    while (inner instanceof CastNode) inner = inner.expression;
    if (inner instanceof FunctionCallNode && inner.parameters.length === 1
      && this.interfaces.has(inner.identifier.name)) return inner.identifier.name;
    return inner instanceof IdentifierNode ? this.resolveReceiverInterface(inner.name) : undefined;
  }

  /** Every function of an interface, its parents' included. */
  private interfaceFunctions(interfaceName: string): InterfaceFunctionNode[] {
    const seen = new Set<string>();
    const functions: InterfaceFunctionNode[] = [];
    const collect = (name: string): void => {
      const iface = this.interfaces.get(name);
      if (iface === undefined || seen.has(name)) return;
      seen.add(name);
      functions.push(...iface.functions);
      for (const parent of iface.parents) collect(parent);
    };
    collect(interfaceName);
    return functions;
  }

  /**
   * The interface a payload's receiver names, or undefined when it names nothing this pass can type.
   *
   * The receiver is either the interface itself (`abi.encodeCall(IERC20.transfer, ..)`) or a variable of that
   * interface's type (`abi.encodeCall(token.transfer, ..)`). A variable is resolved through its declaration - a
   * parameter, a local, or a state variable - since the payload carries no type of its own.
   */
  private resolveReceiverInterface(receiver: string): string | undefined {
    if (this.interfaces.has(receiver)) return receiver;
    const lookup = (type: Type | undefined): string | undefined => type instanceof AddressType
      && type.interfaceName !== undefined && this.interfaces.has(type.interfaceName)
      ? type.interfaceName : undefined;
    for (let index = this.declaredTypes.length - 1; index >= 0; index -= 1) {
      const scope = this.declaredTypes[index]!;
      if (scope.has(receiver)) return lookup(scope.get(receiver));
    }
    return lookup(this.stateVariableTypes.get(receiver));
  }

  private findFunction(interfaceName: string, functionName: string): InterfaceFunctionNode | undefined {
    const seen = new Set<string>();
    const search = (name: string): InterfaceFunctionNode | undefined => {
      if (seen.has(name)) return undefined;
      seen.add(name);
      const iface = this.interfaces.get(name);
      if (!iface) return undefined;
      const own = iface.functions.find((fn) => fn.name === functionName);
      if (own) return own;
      for (const parent of iface.parents) {
        const inherited = search(parent);
        if (inherited) return inherited;
      }
      return undefined;
    };
    return search(interfaceName);
  }
}

/** A contract as a call target, typed as the semantic pass types it: by its entry points. */
function contractInterface(contract: ContractNode): InterfaceNode {
  const functions = contract.functions.filter((fn) => fn.isEntryPoint).map((fn) => new InterfaceFunctionNode(
    fn.name, fn.parameters.map((parameter) => new ParameterNode(parameter.type, parameter.name)), fn.returnTypes,
  ));
  return new InterfaceNode(contract.name, [], [], functions);
}
