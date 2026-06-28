import {
  ContractNode,
  FunctionDefinitionNode,
  SourceFileNode,
  Node,
  StatementNode,
  BlockNode,
  FunctionCallStatementNode,
  VariableDefinitionNode,
  IdentifierNode,
  ExpressionNode,
  BranchNode,
  WhileNode,
  DoWhileNode,
  UncheckedNode,
  MappingAccessNode,
  ArrayAccessNode,
} from '../ast/AST.js';
import { Modifier } from '../ast/Globals.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { substituteInFunction } from './InheritanceExpansionTransformation.js';

/**
 * Inlines internal calls to void functions that take `storage` reference parameters
 * (`mapping(...) storage`, `T[] storage`, `StructType storage`). In Solidity a storage parameter is a
 * compile-time reference to the caller's state, not a value; it has no on-stack representation, so the
 * callee cannot compile as an OP_INVOKE subroutine. Inlining at the call site, with each storage
 * parameter substituted by its argument's access path, reduces it to direct state access in the caller.
 *
 * ```
 * function f() public { _set(map, k, v); }
 * function _set(mapping(address => uint) storage m, address k, uint v) internal { m[k] = v; }
 * ->
 * function f() public { address __sp0_k = k; uint __sp0_v = v; map[__sp0_k] = __sp0_v; }
 * ```
 *
 * Runs before semantic analysis so the substituted accesses collect entry slots normally. Value
 * parameters and locals are alpha-renamed per call site; storage parameters are substituted. The
 * original storage-parameter function is removed (it cannot stand alone as a subroutine).
 *
 * ALSO inlines void internal/private functions that READ a state entry (a mapping/collection element, incl.
 * the read half of a compound write `m[k] += v`). Entry-access input slots live only in an entry-point's
 * block layout, so such a function cannot compile as an OP_INVOKE subroutine ("Block layout not available");
 * inlining moves the read into the entry-point caller's layout. This is what makes a Solidity `_mint`-style
 * private helper that touches a mapping work.
 */
const PREFIX = '__sp';

export default class InlineStoragePointerCalls extends AstTraversal {
  private funcByName: Map<string, FunctionDefinitionNode> = new Map();
  private inlinedFns: Set<string> = new Set();
  private collectionNames: Set<string> = new Set();
  private counter = 0;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.funcByName = new Map();
    for (const fn of node.functions) this.funcByName.set(fn.name, fn);
    this.collectionNames = new Set(node.collections.map((c) => c.name));

    this.inlinedFns = new Set();
    for (const fn of node.functions) {
      if (fn.body && fn.returnTypes.length === 0
        && (this.hasStoragePointerParam(fn) || (this.isInternalHelper(fn) && this.readsEntry(fn)))) {
        this.inlinedFns.add(fn.name);
      }
    }
    if (this.inlinedFns.size === 0) return node;

    for (const fn of node.functions) {
      if (fn.body) fn.body.statements = this.inlineStatements(fn.body.statements ?? [], [fn.name]);
    }
    // A storage parameter has no value representation, and a subroutine cannot read a state entry (the
    // entry-access input slots live only in an entry-point's block layout); so the original cannot stand
    // alone as a subroutine. Every call was inlined above, so drop it.
    node.functions = node.functions.filter((fn) => !this.inlinedFns.has(fn.name));
    return node;
  }

  private hasStoragePointerParam(fn: FunctionDefinitionNode): boolean {
    return fn.parameters.some((p) => p.modifier.includes(Modifier.STORAGE));
  }

  private isInternalHelper(fn: FunctionDefinitionNode): boolean {
    return fn.isFreeFunction || fn.visibility === 'private' || fn.visibility === 'internal';
  }

  // A function reads a state entry if it reads a mapping/collection element - a MappingAccess, or a bare
  // ArrayAccess on a collection name (incl. the read half of a compound write `m[k] += v`). Such a read needs
  // an entry-access input slot, which only an entry-point's block layout provides, so a private function
  // doing it cannot be an OP_INVOKE subroutine and is inlined.
  private readsEntry(fn: FunctionDefinitionNode): boolean {
    let found = false;
    this.walk(fn.body, (n) => {
      if (found) return;
      if (n instanceof MappingAccessNode && this.collectionNames.has(n.name)) found = true;
      else if (n instanceof ArrayAccessNode && n.array instanceof IdentifierNode
        && this.collectionNames.has(n.array.name)) found = true;
    });
    return found;
  }

  // Rewrite a statement list, replacing eligible storage-pointer-call statements with the inlined body.
  private inlineStatements(stmts: StatementNode[], stack: string[]): StatementNode[] {
    const out: StatementNode[] = [];
    for (const stmt of stmts) {
      this.recurseNestedBlocks(stmt, stack);
      if (stmt instanceof FunctionCallStatementNode) {
        const name = stmt.call.identifier.name;
        const callee = this.funcByName.get(name);
        if (!name.includes('.') && callee && this.inlinedFns.has(name) && !stack.includes(name)
          && stmt.call.parameters.length === callee.parameters.length) {
          out.push(...this.inlineCall(callee, stmt.call.parameters, stack));
          continue;
        }
      }
      out.push(stmt);
    }
    return out;
  }

  private recurseNestedBlocks(stmt: StatementNode, stack: string[]): void {
    const inline = (b: BlockNode | undefined): void => {
      if (b) b.statements = this.inlineStatements(b.statements ?? [], stack);
    };
    if (stmt instanceof BranchNode) {
      inline(stmt.ifBlock);
      inline(stmt.elseBlock);
    } else if (stmt instanceof WhileNode || stmt instanceof DoWhileNode) {
      inline(stmt.block);
    } else if (stmt instanceof UncheckedNode) {
      inline(stmt.block);
    } else if (stmt instanceof BlockNode) {
      inline(stmt);
    }
  }

  // Produce [value-param-binding decls..., renamed+substituted body...] for one inlined call site.
  private inlineCall(callee: FunctionDefinitionNode, args: Node[], stack: string[]): StatementNode[] {
    const n = this.counter++;
    const cloned = cloneNode(callee) as FunctionDefinitionNode;

    const rename = new Map<string, string>();
    const subs = new Map<string, ExpressionNode>();
    callee.parameters.forEach((p, i) => {
      if (p.modifier.includes(Modifier.STORAGE)) {
        // A bare state-var argument is aliased by NAME (covers reads and writes, incl. mapping-assign
        // targets whose container is a string field); a complex access path is substituted by expression.
        const arg = args[i];
        if (arg instanceof IdentifierNode) rename.set(p.name, arg.name);
        else subs.set(p.name, cloneNode(arg) as ExpressionNode);
      } else {
        rename.set(p.name, `${PREFIX}${n}_${p.name}`);
      }
    });
    this.walk(cloned.body, (node) => {
      if (node instanceof VariableDefinitionNode && !rename.has(node.name) && !subs.has(node.name)) {
        rename.set(node.name, `${PREFIX}${n}_${node.name}`);
      }
    });
    // Rename value params/locals first (storage-param refs are untouched), then substitute storage
    // params with their (un-renamed) argument expressions.
    this.applyRename(cloned.body, rename);
    substituteInFunction(cloned, subs);

    const bindings: StatementNode[] = [];
    callee.parameters.forEach((p, i) => {
      if (p.modifier.includes(Modifier.STORAGE)) return;
      const def = new VariableDefinitionNode(p.type, [], rename.get(p.name)!, cloneNode(args[i]) as never);
      def.location = args[i].location ?? callee.location;
      bindings.push(def);
    });
    const inlined = this.inlineStatements(cloned.body.statements ?? [], [...stack, callee.name]);
    return [...bindings, ...inlined];
  }

  private applyRename(root: Node, map: Map<string, string>): void {
    this.walk(root, (n) => {
      if (n instanceof IdentifierNode) {
        const dot = n.name.indexOf('.');
        if (dot > 0) {
          const head = n.name.slice(0, dot);
          if (map.has(head)) n.name = map.get(head)! + n.name.slice(dot);
        } else if (map.has(n.name)) {
          n.name = map.get(n.name)!;
        }
      } else {
        const nm = (n as unknown as { name?: unknown }).name;
        if (typeof nm === 'string' && map.has(nm)) (n as unknown as { name: string }).name = map.get(nm)!;
      }
    });
  }

  // Pre-order walk over child Nodes (and Node arrays); skips Type/symbol-table fields.
  private walk(node: Node | undefined, visit: (n: Node) => void): void {
    if (!node) return;
    visit(node);
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) this.walk(v, visit);
      else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) this.walk(it, visit);
    }
  }
}
