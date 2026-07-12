import {
  Node,
  SourceFileNode,
  ContractNode,
  InterfaceNode,
  FunctionDefinitionNode,
  VariableDefinitionNode,
  InstantiationNode,
  BlockNode,
  StatementNode,
  FunctionCallNode,
  FieldAccessNode,
  IdentifierNode,
  ExpressionNode,
} from '../ast/AST.js';
import { AddressType, FunctionType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * A CONTRACT-typed value's method accessed as a FN-PTR value (not called): `o.method` / `(new C()).method`.
 * Solidity allows a contract instance's external method as a `function(..) external` value; on BCH the recognised
 * form is the interface-cast member `C(o).method` (the shape the fn-ptr passes + arg-split match). So rewrite:
 *
 *   o.method            (o : C, a contract-typed local)   ->   C(o).method
 *   (new C()).method                                      ->   C __cmN = new C(); C(__cmN).method
 *
 * The inline-`new` case hoists a named deploy local so the deploy fold still recognises the child. Runs FIRST,
 * before SplitExternalCallFnPtrArgs / the fn-ptr lowerings, so the produced `C(x).method` flows through them. A
 * bare `o.publicVar` (external state read) is untouched - only a name that is a METHOD of the contract rewrites.
 */
export default class DesugarContractMemberFnPtr extends AstTraversal {
  private methodsByType = new Map<string, Set<string>>(); // contract/interface name -> its method names
  private localContract = new Map<string, string>();       // local var name -> its contract type name
  private hoists: StatementNode[] = [];
  private counter = 0;

  visitSourceFile(node: SourceFileNode): Node {
    this.methodsByType = new Map();
    const record = (name: string, fns: { name: string }[]): void => {
      this.methodsByType.set(name, new Set(fns.map((f) => f.name)));
    };
    for (const iface of node.interfaceDefinitions as InterfaceNode[]) record(iface.name, iface.functions);
    for (const c of node.importedContracts as ContractNode[]) record(c.name, c.functions);
    if (node.contract) record(node.contract.name, node.contract.functions);
    node.importedContracts = this.visitList(node.importedContracts) as ContractNode[];
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    for (const f of [node.constructorDef, ...node.functions, node.fallbackDef, node.receiveDef]) {
      if (f?.body) { this.localContract = new Map(); f.body = this.visit(f.body) as BlockNode; }
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

  // Track a contract-typed local: `C o = new C()` (identifier of the instantiation) or `C o = <C-typed value>`.
  visitVariableDefinition(node: VariableDefinitionNode): Node {
    // A fn-ptr LOCAL alias (`function() external p = (new C()).m`) is a compile-time alias
    // DesugarExternalFunctionPointers resolves in place - leave its RHS untouched (rewriting it to a hoisted
    // cast would break the byte-identical alias fold). Only ARG / STATE-STORE positions need the cast form.
    if (node.type instanceof FunctionType && (node.type as FunctionType).isExternal) return node;
    if (node.expression instanceof InstantiationNode
      && node.expression.identifier instanceof IdentifierNode
      && this.methodsByType.has(node.expression.identifier.name)) {
      this.localContract.set(node.name, node.expression.identifier.name);
    }
    return super.visitVariableDefinition(node);
  }

  visitFieldAccess(node: FieldAccessNode): Node {
    const base = node.expression;
    // `(new C()).method` -> hoist `C __cmN = new C();` then `C(__cmN).method`.
    if (base instanceof InstantiationNode && base.identifier instanceof IdentifierNode
      && this.methodsByType.get(base.identifier.name)?.has(node.name)) {
      const cName = base.identifier.name;
      const local = `__cm_${this.counter++}`;
      const def = new VariableDefinitionNode(new AddressType(false, cName), [], local, base);
      def.location = node.location;
      this.hoists.push(def);
      return this.castMember(cName, this.id(local, node), node.name, node);
    }
    // `o.method` where o is a contract-typed local and method is one of its methods -> `C(o).method`.
    if (base instanceof IdentifierNode) {
      const cName = this.localContract.get(base.name);
      if (cName && this.methodsByType.get(cName)?.has(node.name)) {
        return this.castMember(cName, this.id(base.name, node), node.name, node);
      }
    }
    return super.visitFieldAccess(node);
  }

  // Build `C(addr).method`.
  private castMember(cName: string, addr: ExpressionNode, method: string, at: Node): FieldAccessNode {
    const cId = new IdentifierNode(cName); cId.location = at.location;
    const cast = new FunctionCallNode(cId, [addr]); cast.location = at.location;
    const member = new FieldAccessNode(cast, method); member.location = at.location;
    return member;
  }

  private id(name: string, at: Node): IdentifierNode {
    const n = new IdentifierNode(name); n.location = at.location; return n;
  }
}
