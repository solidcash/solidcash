import {
  ContractNode,
  SourceFileNode,
  InterfaceNode,
  Node,
  ExpressionNode,
  StatementNode,
  VariableDefinitionNode,
  IdentifierNode,
  FunctionCallNode,
  MethodCallNode,
  BlockNode,
  AssignNode,
  FunctionDefinitionNode,
  WhileNode,
  DoWhileNode,
  CollectionIterationNode,
  TupleAssignmentNode,
} from '../ast/AST.js';
import { AddressType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Makes an external-call target that is a contract/interface-typed LOCAL declared inside a non-loop nested block
 * (a branch) survive to the function epilogue, where the external-call co-spend verification runs.
 *
 * The verification (emitExternalCallVerification) picks the target address off the stack by the call's address
 * variable name. A local declared inside an `if`-branch is popped when the branch closes, so at the epilogue it
 * is gone -> "Expected variable '<x>' does not exist on the stack". This blocks e.g. a `restricted` modifier
 * (`if (msg.sender == owner) _;`) wrapping `Migrations u = Migrations(a); u.setCompleted(..)`.
 *
 * Fix: for `T u = INIT;` in a branch (T a known contract/interface type), synthesize a function-top local
 * `T __extcap_N_u;`, capture `__extcap_N_u = u;` right after the declaration, and rewrite the external-call
 * receiver `u.m()` -> `__extcap_N_u.m()`. The epilogue then reads the function-top capture (always on the stack).
 * This is byte-equivalent to the already-supported inline branch form `if (cond) IFoo(a).m()` (verified once,
 * unconditionally, against a function-scope value; if the branch is not taken the capture holds its zero default
 * and the co-spend check fails closed - the established conditional-external-call behavior).
 *
 * LOOP bodies are excluded: a per-iteration target needs the array-element loop dispatch (loopArrayVar), not a
 * single captured value. Function-top-level locals already survive, so they are left untouched.
 */
const PREFIX = '__extcap_';

export default class CaptureBranchExternalCallTargets extends AstTraversal {
  private typeNames: Set<string> = new Set();     // interface + contract names usable as a callee type
  private topDecls: VariableDefinitionNode[] = []; // function-top capture declarations to prepend
  private counter = 0;
  private renames: Map<string, string> = new Map(); // captured local name -> function-top capture name (in scope)
  private loopDepth = 0;
  private inNestedBlock = false;                   // is the block currently being visited nested (not fn-top)?

  visitSourceFile(node: SourceFileNode): Node {
    this.typeNames = new Set();
    for (const iface of node.interfaceDefinitions as InterfaceNode[]) this.typeNames.add(iface.name);
    for (const c of node.importedContracts as ContractNode[]) this.typeNames.add(c.name);
    if (node.contract) this.typeNames.add(node.contract.name);
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    if (this.typeNames.size === 0) return node;
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.fallbackDef) node.fallbackDef = this.visitFunctionDefinition(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visitFunctionDefinition(node.receiveDef) as FunctionDefinitionNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (!node.body) return node;
    this.topDecls = [];
    this.counter = 0;
    this.renames = new Map();
    this.loopDepth = 0;
    this.inNestedBlock = false; // the function body block is the top scope
    node.body = this.visit(node.body) as BlockNode;
    if (this.topDecls.length > 0) {
      node.body.statements = [...this.topDecls, ...(node.body.statements ?? [])];
    }
    return node;
  }

  visitBlock(node: BlockNode): Node {
    const nested = this.inNestedBlock; // whether THIS block's direct locals are branch-scoped
    const savedRenames = new Map(this.renames);
    const savedInNested = this.inNestedBlock;
    this.inNestedBlock = true; // any block nested within this one is nested regardless
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const scopedTupleAddress = stmt instanceof TupleAssignmentNode && stmt.elements.some((element) =>
        element.name && !element.existing && element.type instanceof AddressType
        && (nested || /^(__rh|__inl)/.test(element.name)));
      if (stmt instanceof TupleAssignmentNode && scopedTupleAddress && this.loopDepth === 0) {
        out.push(this.visit(stmt) as StatementNode);
        for (const element of stmt.elements) {
          if (!element.name || element.existing || !(element.type instanceof AddressType)
            || (!nested && !/^(__rh|__inl)/.test(element.name))) continue;
          const capName = `${PREFIX}${this.counter++}_${element.name}`;
          const decl = new VariableDefinitionNode(
            new AddressType(element.type.payable, element.type.interfaceName), [], capName, undefined,
          );
          decl.location = stmt.location;
          this.topDecls.push(decl);
          const read = new IdentifierNode(element.name); read.location = stmt.location;
          const capId = new IdentifierNode(capName); capId.location = stmt.location;
          const assign = new AssignNode(capId, read); assign.location = stmt.location;
          out.push(assign);
          this.renames.set(element.name, capName);
        }
        continue;
      }
      const iface = this.captureInterfaceOf(stmt);
      if (iface && nested && this.loopDepth === 0) {
        const def = stmt as VariableDefinitionNode;
        out.push(this.visit(def) as StatementNode); // rename receivers inside the initializer (rare)
        const capName = `${PREFIX}${this.counter++}_${def.name}`;
        const decl = new VariableDefinitionNode(new AddressType(false, iface), [], capName, undefined);
        decl.location = def.location;
        this.topDecls.push(decl);
        const read = new IdentifierNode(def.name); read.location = def.location;
        const capId = new IdentifierNode(capName); capId.location = def.location;
        const assign = new AssignNode(capId, read); assign.location = def.location;
        out.push(assign);
        this.renames.set(def.name, capName);
      } else {
        out.push(this.visit(stmt) as StatementNode);
      }
    }
    node.statements = out;
    this.inNestedBlock = savedInNested;
    this.renames = savedRenames;
    return node;
  }

  visitDoWhile(node: DoWhileNode): Node {
    this.loopDepth += 1; const r = super.visitDoWhile(node); this.loopDepth -= 1; return r;
  }

  visitWhile(node: WhileNode): Node {
    this.loopDepth += 1; const r = super.visitWhile(node); this.loopDepth -= 1; return r;
  }

  visitCollectionIteration(node: CollectionIterationNode): Node {
    this.loopDepth += 1; const r = super.visitCollectionIteration(node); this.loopDepth -= 1; return r;
  }

  // Some earlier lowering passes have already materialized an
  // ExternalFunctionCallNode, so rewriting only the parser-level dotted
  // FunctionCall/MethodCall spellings misses its addressExpression. Rename
  // every subsequent read of the captured SSA local in the nested scope. The
  // synthesized `capture = original` assignment is appended after visiting
  // the declaration and is therefore intentionally not traversed here.
  visitIdentifier(node: IdentifierNode): Node {
    const replacement = this.renames.get(node.name);
    if (replacement) node.name = replacement;
    return node;
  }

  // `u.method(..)` (no call options) is a dotted FunctionCall `u.method`; rewrite the receiver to the capture.
  visitFunctionCall(node: FunctionCallNode): Node {
    const name = node.identifier.name;
    const dot = name.indexOf('.');
    if (dot > 0 && this.renames.has(name.slice(0, dot))) {
      const loc = node.identifier.location;
      node.identifier = new IdentifierNode(`${this.renames.get(name.slice(0, dot))!}.${name.slice(dot + 1)}`);
      node.identifier.location = loc;
    }
    node.parameters = this.visitList(node.parameters) as ExpressionNode[];
    return node;
  }

  // `u.method{value:}(..)` (call-option form) is a MethodCall on an identifier object; rewrite the object.
  visitMethodCall(node: MethodCallNode): Node {
    if (node.object instanceof IdentifierNode && this.renames.has(node.object.name)) {
      const loc = node.object.location;
      node.object = new IdentifierNode(this.renames.get(node.object.name)!);
      node.object.location = loc;
    } else {
      node.object = this.visit(node.object) as ExpressionNode;
    }
    node.parameters = this.visitList(node.parameters) as ExpressionNode[];
    if (node.callOptions?.value) node.callOptions.value = this.visit(node.callOptions.value) as ExpressionNode;
    if (node.callOptions?.gas) node.callOptions.gas = this.visit(node.callOptions.gas) as ExpressionNode;
    return node;
  }

  // The callee type name of a contract/interface-typed local declaration (`T u = ..`), else undefined. A bare
  // `address`/`address payable` local (no interfaceName) is NOT a callee handle and is left alone.
  private captureInterfaceOf(stmt: StatementNode): string | undefined {
    if (!(stmt instanceof VariableDefinitionNode)) return undefined;
    const t = stmt.type;
    if (t instanceof AddressType && t.interfaceName && this.typeNames.has(t.interfaceName)) return t.interfaceName;
    return undefined;
  }
}
