import {
  AbiEncodeCallNode,
  AbiEncodeNode,
  AbiEncodeWithSelectorNode,
  AssignNode,
  BlockNode,
  BoolLiteralNode,
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
  MethodCallNode,
  MethodCallStatementNode,
  Node,
  ReturnNode,
  SourceFileNode,
  StatementNode,
  TupleAssignmentNode,
  VariableDefinitionNode,
} from '../ast/AST.js';
import { BytesType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/** Temporary holding a typed call's return values while the low-level `(success, returndata)` pair is rebuilt. */
const PREFIX = '__staticcall_ret_';

/** One interface method a low-level payload names statically. */
interface NamedCall {
  readonly interfaceName: string;
  readonly functionName: string;
  readonly args: ExpressionNode[];
}

/** A low-level call site whose payload names an interface method, with the value the callee is addressed by. */
interface LowLevelSite {
  readonly target: ExpressionNode;
  readonly payload: ExpressionNode;
}

/**
 * Rewrites a low-level call whose payload names an interface method into the typed call it denotes.
 *
 * `address(t).call(abi.encodeCall(I.f, (args)))` and `address(t).call(abi.encodeWithSelector(I.f.selector, args))`
 * both denote `I(address(t)).f(args)`. The rewrite emits that typed call and rebuilds the low-level result from it:
 * a reached call on BCH either aborts the transaction or succeeds, so the success bit is the constant true, and
 * the return data is the ABI encoding of the typed call's own return values. The typed call is the one the
 * convention already compiles, so the site publishes the same call record, argument digest and callee reference as
 * the spelled-out typed call.
 *
 * A payload the compiler cannot name statically - a selector computed at run time, an interface it does not know -
 * is left alone, so the call keeps its own low-level refusal.
 *
 * A payload held in a local (`bytes data = abi.encodeCall(I.f, (args)); addr.call(data)`) denotes the same call when
 * the enclosing block bound that local, earlier in source order and without a later reassignment, to exactly one
 * such abi-encode expression. The lookup is flow-local and block-scoped; every other local stays opaque.
 */
export default class LowerStaticLowLevelCalls extends AstTraversal {
  private interfaces = new Map<string, InterfaceNode>();
  private counter = 0;
  /** The locals currently being followed, so a chain that names itself stops instead of recursing. */
  private resolving = new Set<string>();
  // One map per lexical block, innermost last. A name present here shadows any outer binding; a value that is not
  // an abi-encode node marks a local that was bound to something else (or reassigned), so the lookup stops there.
  private payloadScopes: Map<string, ExpressionNode | undefined>[] = [];

  visitSourceFile(node: SourceFileNode): Node {
    this.interfaces = new Map(node.interfaceDefinitions.map((iface) => [iface.name, iface]));
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    node.freeFunctions = this.visitList(node.freeFunctions) as FunctionDefinitionNode[];
    return node;
  }

  visitContract(node: ContractNode): Node {
    const bodies = [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef];
    for (const fn of bodies) {
      if (!fn?.body) continue;
      fn.body = this.visit(fn.body) as BlockNode;
    }
    return node;
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    this.payloadScopes.push(new Map());
    for (const statement of node.statements ?? []) {
      const visited = this.visit(statement) as StatementNode;
      const rewritten = this.rewriteStatement(visited);
      if (rewritten) out.push(...rewritten);
      else out.push(visited);
      this.recordPayloadBinding(visited);
    }
    this.payloadScopes.pop();
    node.statements = out;
    return node;
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

  /**
   * The payload a value carries on, or undefined when it names nothing this pass can follow.
   *
   * A local may be filled from another local rather than from the abi-encode expression directly: an inlined body
   * declares its parameter and assigns the caller's argument to it, so the chain is followed name by name.
   */
  private carriedPayload(value: ExpressionNode | undefined): ExpressionNode | undefined {
    if (value instanceof AbiEncodeCallNode || value instanceof AbiEncodeWithSelectorNode) return value;
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
      if (statement.callOptions) return undefined;
      const lowered = this.lower({ target: statement.targetExpression, payload: statement.data }, true);
      return lowered?.stmts;
    }
    return undefined;
  }

  private matchLowLevelCall(expression: ExpressionNode | undefined): LowLevelSite | undefined {
    if (expression instanceof MethodCallNode
      && (expression.methodName === 'call' || expression.methodName === 'staticcall')
      && expression.parameters.length === 1 && !expression.callOptions) {
      // An interface handle as the receiver already names the callee, so the payload's interface is not the method
      // the spelling denotes; leave that form to its own lowering.
      if (expression.object instanceof FunctionCallNode && this.interfaces.has(expression.object.identifier.name)) {
        return undefined;
      }
      return { target: expression.object, payload: expression.parameters[0]! };
    }
    if (expression instanceof LowLevelCallNode
      && (expression.callMode === 'call' || expression.callMode === 'staticcall') && !expression.callOptions) {
      return { target: expression.targetExpression, payload: expression.data };
    }
    // A simple identifier receiver parses as a namespaced call (`target.call(payload)`), not a MethodCall.
    if (expression instanceof FunctionCallNode && !expression.callOptions
      && expression.parameters.length === 1) {
      const name = expression.identifier.name;
      const dot = name.lastIndexOf('.');
      const method = dot < 0 ? undefined : name.slice(dot + 1);
      const receiver = dot < 0 ? undefined : name.slice(0, dot);
      if ((method === 'call' || method === 'staticcall') && receiver !== undefined && !receiver.includes('.')) {
        // `this.<fn>(..)` is a self-invocation, and an interface handle already names its own callee.
        if (receiver === 'this' || this.interfaces.has(receiver)) return undefined;
        const target = new IdentifierNode(receiver);
        target.location = expression.identifier.location;
        return { target, payload: expression.parameters[0]! };
      }
    }
    return undefined;
  }

  private lower(site: LowLevelSite, discardResult = false): {
    stmts: StatementNode[]; success: () => ExpressionNode; retval: () => ExpressionNode;
  } | undefined {
    const named = this.resolveNamedCall(site.payload);
    if (!named) return undefined;
    const fn = this.findFunction(named.interfaceName, named.functionName);
    if (!fn) return undefined;

    const loc = site.target.location;
    const receiver = new FunctionCallNode(new IdentifierNode(named.interfaceName), [site.target]);
    receiver.location = loc;
    const typedCall = new MethodCallNode(receiver, named.functionName, named.args);
    typedCall.location = loc;

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

  private resolveNamedCall(payload: ExpressionNode): NamedCall | undefined {
    if (payload instanceof IdentifierNode) {
      // Locals may name each other - an inlined body's parameter is assigned the caller's local, which is itself
      // bound to the payload - so a name already being resolved is not followed again.
      if (this.resolving.has(payload.name)) return undefined;
      const bound = this.boundPayload(payload.name);
      if (!bound) return undefined;
      this.resolving.add(payload.name);
      try {
        const named = this.resolveNamedCall(bound);
        // The bound declaration keeps its own argument nodes, so the typed call reads independent copies.
        return named && { ...named, args: named.args.map((arg) => cloneNode(arg)) };
      } finally {
        this.resolving.delete(payload.name);
      }
    }
    if (payload instanceof AbiEncodeCallNode) {
      if (payload.interfaceName === 'this' || !this.interfaces.has(payload.interfaceName)) return undefined;
      return { interfaceName: payload.interfaceName, functionName: payload.functionName, args: payload.parameters };
    }
    if (payload instanceof AbiEncodeWithSelectorNode) {
      const selector = payload.selector;
      if (!(selector instanceof FieldAccessNode) || selector.name !== 'selector') return undefined;
      const declaration = selector.expression;
      if (!(declaration instanceof FieldAccessNode) || !(declaration.expression instanceof IdentifierNode)) {
        return undefined;
      }
      const interfaceName = declaration.expression.name;
      if (!this.interfaces.has(interfaceName)) return undefined;
      return { interfaceName, functionName: declaration.name, args: payload.parameters };
    }
    return undefined;
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
