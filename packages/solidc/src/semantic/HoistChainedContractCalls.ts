import {
  ContractNode,
  InterfaceNode,
  SourceFileNode,
  Node,
  StatementNode,
  BlockNode,
  VariableDefinitionNode,
  IdentifierNode,
  MethodCallNode,
  MethodCallStatementNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  ExpressionNode,
  FieldAccessNode,
  ArrayAccessNode,
  MappingAccessNode,
  TupleIndexOpNode,
  TernaryOpNode,
  WhileNode,
  DoWhileNode,
} from '../ast/AST.js';
import {
  AddressType, ArrayType, MappingType, StructType, Type,
} from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Hoists a chained call on a contract-returning getter `A.g().m(args)` into
 * `IReturn __chaincall_N = A.g(); __chaincall_N.m(args)`, so the getter is a normal external call whose
 * (integrity-bound) return is stored in a typed local, and `.m()` dispatches on that local via the audited
 * interface-local path. The explicit two-statement form already compiles, so this is a pure desugar (sound by
 * reduction: `A.g()`'s co-spent callee attests its return, which then pins the second call's co-spend).
 *
 * `A.g()` is a namespaced getter/function call whose receiver `A` is a contract/interface-typed state var, param,
 * or a previously-hoisted temp, and whose member `g` returns a contract/interface (a public state var, an array/
 * mapping element, or a function's single return). A non-contract return (e.g. `A.count()` -> uint) is left
 * alone. Multi-level chains fold because each hoisted temp is registered as a receiver for the next level.
 *
 * Runs before SynthesizeExternalAddressLocals, so the hoisted `A.g()` gets the state-var `__extaddr_` treatment
 * and `__chaincall_N.m()` resolves like any interface-typed local. Conditional positions (ternary branch, loop
 * condition, short-circuit right operand) are not descended into - a call there keeps its original shape.
 */
const PREFIX = '__chaincall_';

// The element/value type of an array/mapping (a Solidity array/mapping getter returns it), else undefined.
function elementOf(t: Type | undefined): Type | undefined {
  if (t instanceof ArrayType) return t.elementType;
  if (t instanceof MappingType) return t.valueType;
  return undefined;
}

export default class HoistChainedContractCalls extends AstTraversal {
  private counter = 0;
  private hoists: StatementNode[] = [];
  // typeName -> (memberName -> declared type): public state vars, collections, and single-return functions, so
  // `A.member()` resolves the type A.member returns.
  private members: Map<string, Map<string, Type>> = new Map();
  private stateReceiverTypes: Map<string, Type> = new Map(); // current contract's state var types
  private receiverTypes: Map<string, Type> = new Map();      // + current function's params + hoisted temps

  visitSourceFile(node: SourceFileNode): Node {
    this.members = new Map();
    const contracts = [node.contract, ...node.importedContracts].filter(Boolean) as ContractNode[];
    for (const c of contracts) this.indexMembers(c.name, c.stateVariables, c.collections, c.functions);
    for (const i of node.interfaceDefinitions as InterfaceNode[]) {
      this.indexMembers(i.name, i.stateVariables, i.collections, i.functions);
    }
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    node.importedContracts = node.importedContracts.map((c) => this.visit(c) as ContractNode);
    return node;
  }

  private indexMembers(
    name: string,
    stateVars: { name: string; type: Type }[],
    collections: { name: string; type: Type }[],
    functions: { name: string; returnTypes: Type[] }[],
  ): void {
    const m = this.members.get(name) ?? new Map<string, Type>();
    for (const sv of stateVars) m.set(sv.name, sv.type);
    for (const coll of collections) m.set(coll.name, coll.type);
    for (const fn of functions) if (fn.returnTypes.length === 1) m.set(fn.name, fn.returnTypes[0]);
    this.members.set(name, m);
  }

  visitContract(node: ContractNode): Node {
    this.stateReceiverTypes = new Map();
    for (const sv of node.stateVariables) this.stateReceiverTypes.set(sv.name, sv.type);
    for (const coll of node.collections) this.stateReceiverTypes.set(coll.name, coll.type);
    const bodies = [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef];
    for (const fn of bodies) {
      if (!fn?.body) continue;
      this.receiverTypes = new Map(this.stateReceiverTypes);
      for (const p of fn.parameters) this.receiverTypes.set(p.name, p.type);
      fn.body = this.visit(fn.body) as BlockNode;
    }
    return node;
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const saved = this.hoists;
      this.hoists = [];
      const visited = this.visit(stmt) as StatementNode;
      out.push(...this.hoists, visited);
      this.hoists = saved;
    }
    node.statements = out;
    return node;
  }

  // Track a contract/interface-typed local (`Market market = markets[i];`) as a receiver, so a chained getter
  // on it (`market.eventContract()...`) resolves. Declarations are visited in order, so the local is registered
  // before the statements that use it.
  visitVariableDefinition(node: VariableDefinitionNode): Node {
    const visited = super.visitVariableDefinition(node) as VariableDefinitionNode;
    if (visited.type instanceof AddressType && visited.type.interfaceName) {
      this.receiverTypes.set(visited.name, visited.type);
    }
    return visited;
  }

  visitMethodCall(node: MethodCallNode): Node {
    const visited = super.visitMethodCall(node) as MethodCallNode; // hoist nested receivers first
    const obj = visited.object;
    // Hoist when the receiver is itself a CALL returning a contract - `A.g()` (namespaced getter/function) or
    // `arr[i].g()` / `s.f.g()` (a getter on a computed base). The chained `.method()` then dispatches on the
    // typed temp via the audited interface-local path (byte-identical to the explicit `T t = <call>; t.m()`).
    if (!visited.callOptions) {
      const ret = this.callReturnsContract(obj);
      if (ret) {
        const tmpName = `${PREFIX}${this.counter++}`;
        const def = new VariableDefinitionNode(ret, [], tmpName, obj);
        def.location = obj.location;
        this.hoists.push(def);
        this.receiverTypes.set(tmpName, ret); // a further `.m()` in a longer chain resolves against the temp
        const id = new IdentifierNode(`${tmpName}.${visited.methodName}`);
        id.location = visited.location;
        const call = new FunctionCallNode(id, visited.parameters as ExpressionNode[]);
        if (visited.fieldNames) call.fieldNames = visited.fieldNames;
        call.location = visited.location;
        return call;
      }
    }
    return visited;
  }

  // The contract/interface type `obj` returns IF it is a getter/function call whose result is a contract, else
  // undefined: `A.g()` (namespaced FunctionCall) or `<expr>.g()` (a MethodCall getter on a computed base).
  private callReturnsContract(obj: ExpressionNode): AddressType | undefined {
    let ret: Type | undefined;
    if (obj instanceof FunctionCallNode && obj.identifier.name.includes('.')) {
      const dot = obj.identifier.name.indexOf('.');
      ret = this.member(this.receiverType(new IdentifierNode(obj.identifier.name.slice(0, dot))),
        obj.identifier.name.slice(dot + 1));
    } else if (obj instanceof MethodCallNode) {
      ret = this.member(this.receiverType(obj.object), obj.methodName);
    }
    return ret instanceof AddressType && ret.interfaceName ? ret : undefined;
  }

  // The declared type of a receiver expression: a state var / param / local / hoisted temp, a struct field, an
  // array/mapping element, or a contract member reached through any of these. Undefined if not resolvable to a
  // known type here (mirrors resolveLowLevelReceiverType; the general shape these getter-chain edge cases share).
  private receiverType(expr: ExpressionNode): Type | undefined {
    if (expr instanceof IdentifierNode) return this.receiverTypes.get(expr.name);
    if (expr instanceof ArrayAccessNode) return elementOf(this.receiverType(expr.array));
    if (expr instanceof TupleIndexOpNode) return elementOf(this.receiverType(expr.tuple));
    if (expr instanceof MappingAccessNode) return elementOf(this.receiverTypes.get(expr.name));
    if (expr instanceof FieldAccessNode) {
      const base = this.receiverType(expr.expression);
      if (base instanceof StructType) return base.fields.find((f) => f.name === expr.name)?.type;
      if (base instanceof AddressType && base.interfaceName) return this.member(base, expr.name);
      return undefined;
    }
    if (expr instanceof FunctionCallNode) {
      // `Concrete(address).publicMapping(key)` uses a contract cast as the receiver. Treat the cast as that
      // imported contract type so the public collection getter can be hoisted before a chained call on its
      // interface-valued result (`MasterChefV2(a).lpToken(pid).balanceOf(a)`).
      if (!expr.identifier.name.includes('.') && expr.parameters.length === 1 && this.members.has(expr.identifier.name)) {
        return new AddressType(false, expr.identifier.name);
      }
      return this.callReturnsContract(expr);
    }
    if (expr instanceof MethodCallNode) return this.callReturnsContract(expr);
    return undefined;
  }

  // The type of `type.member` (a public var, or an array/mapping getter's element/value), for a contract receiver.
  private member(type: Type | undefined, memberName: string): Type | undefined {
    if (!(type instanceof AddressType) || !type.interfaceName) return undefined;
    let t = this.members.get(type.interfaceName)?.get(memberName);
    while (t instanceof ArrayType || t instanceof MappingType) t = elementOf(t);
    return t;
  }

  // A hoisted call replaces its MethodCallNode with a FunctionCallNode; re-wrap the statement to match.
  visitMethodCallStatement(node: MethodCallStatementNode): Node {
    const result = this.visit(node.call);
    if (result instanceof FunctionCallNode) {
      const stmt = new FunctionCallStatementNode(result);
      stmt.location = node.location;
      return stmt;
    }
    node.call = result as MethodCallNode;
    return node;
  }

  // Genuinely conditional / repeated positions: a ternary branch or loop body must keep its call in place (a
  // ternary picks one branch; a loop repeats). Short-circuit `&&`/`||` operands are NOT guarded: on BCH the
  // external calls in an expression are co-spent structurally (not runtime-short-circuited), so hoisting the
  // getter receiver to a preceding statement is consistent - the `.method()` result still drives the `&&`.
  visitTernaryOp(node: TernaryOpNode): Node {
    node.condition = this.visit(node.condition);
    return node;
  }

  visitWhile(node: WhileNode): Node {
    node.block = this.visit(node.block) as StatementNode;
    return node;
  }

  visitDoWhile(node: DoWhileNode): Node {
    node.block = this.visit(node.block) as StatementNode;
    return node;
  }
}
