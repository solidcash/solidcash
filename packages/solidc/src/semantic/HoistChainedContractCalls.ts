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
  TernaryOpNode,
  WhileNode,
  DoWhileNode,
} from '../ast/AST.js';
import {
  AddressType, ArrayType, MappingType, Type,
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

  visitMethodCall(node: MethodCallNode): Node {
    const visited = super.visitMethodCall(node) as MethodCallNode; // hoist nested receivers first
    const obj = visited.object;
    if (obj instanceof FunctionCallNode && obj.identifier.name.includes('.') && !visited.callOptions) {
      const ret = this.getterReturnType(obj);
      if (ret instanceof AddressType && ret.interfaceName) {
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

  // The contract/interface type a namespaced getter call `A.member(...)` returns: A's declared type -> its
  // contract's `member` -> that member's type, unwrapping array/mapping levels (a Solidity array/mapping getter
  // returns the element/value). Undefined if A is not a contract receiver or the member is unknown.
  private getterReturnType(call: FunctionCallNode): Type | undefined {
    const name = call.identifier.name;
    const dot = name.indexOf('.');
    const recv = name.slice(0, dot);
    const member = name.slice(dot + 1);
    const recvType = this.receiverTypes.get(recv);
    if (!(recvType instanceof AddressType) || !recvType.interfaceName) return undefined;
    let t = this.members.get(recvType.interfaceName)?.get(member);
    while (t instanceof ArrayType || t instanceof MappingType) {
      t = t instanceof ArrayType ? t.elementType : t.valueType;
    }
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
