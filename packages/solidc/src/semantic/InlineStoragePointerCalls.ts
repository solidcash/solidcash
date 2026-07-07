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
  AssignNode,
  StateAssignNode,
  MappingAssignNode,
  StateArrayAssignNode,
  MappingFieldAssignNode,
  ReturnNode,
  FunctionCallNode,
  ConsoleStatementNode,
} from '../ast/AST.js';
import { StructType, MappingType } from '@solidcash/utils';
import { Modifier } from '../ast/Globals.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { substituteInFunction } from './InheritanceExpansionTransformation.js';
import { collectAmbiguousInlineKeys, inlineKey } from './inlineOverloadGuard.js';
import { AmbiguousInlineOverloadError } from '../Errors.js';

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
  // H8: <name>/<arity> keys that more than one overload shares - inlining one by that key is ambiguous.
  private ambiguousInlineKeys: Set<string> = new Set();
  private inlinedFns: Set<string> = new Set();
  private collectionNames: Set<string> = new Set();
  private freeFns: FunctionDefinitionNode[] = [];
  private counter = 0;
  // Value-returning functions with a single `return <expr>` body and a storage-pointer param: inlined in
  // EXPRESSION position (they have no standalone value representation). exprStack guards against recursion.
  private exprInlinableFns: Map<string, FunctionDefinitionNode> = new Map();
  private exprStack: string[] = [];

  visitSourceFile(node: SourceFileNode): Node {
    this.freeFns = node.freeFunctions ?? [];
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    // A struct-storage-pointer library fn is inlined at every call site and cannot stand alone (its `map__field`
    // accesses are dangling until renamed to the caller's `<arg>__field`), so drop the inlined ones.
    node.freeFunctions = (node.freeFunctions ?? []).filter((f) => !this.inlinedFns.has(f.name));
    // A `using Lib for T` directive whose library functions were ALL inlined-and-dropped is vestigial: the
    // method calls it routed were desugared to `Lib.f(recv, ..)` at parse and then inlined. Drop it so the
    // semantic using-for check does not fail on the now-empty library. Only drop when the library was actually
    // inlined here (a genuinely-undefined library, with no functions ever, must still raise its error). (The
    // check reads the CONTRACT node's copy of the directives, so filter that one.)
    if (node.contract?.usingForDirectives?.length) {
      const remaining = [...node.freeFunctions, ...node.contract.functions].map((f) => f.name);
      const inlined = [...this.inlinedFns];
      node.contract.usingForDirectives = node.contract.usingForDirectives.filter((d) => {
        if (!d.libraryName) return true;
        const prefix = `${d.libraryName}.`;
        const stillHas = remaining.some((nm) => nm.startsWith(prefix));
        const wasInlined = inlined.some((nm) => nm.startsWith(prefix));
        return stillHas || !wasInlined;
      });
    }
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.funcByName = new Map();
    for (const fn of [...node.functions, ...this.freeFns]) this.funcByName.set(fn.name, fn);
    this.ambiguousInlineKeys = collectAmbiguousInlineKeys([...node.functions, ...this.freeFns]);
    this.collectionNames = new Set(node.collections.map((c) => c.name));

    this.inlinedFns = new Set();
    for (const fn of node.functions) {
      if (fn.body && fn.returnTypes.length === 0
        && (this.hasStoragePointerParam(fn) || (this.isInternalHelper(fn) && this.readsEntry(fn)))) {
        this.inlinedFns.add(fn.name);
      }
    }
    // Library free-functions (`Lib.fn`) taking a STRUCT storage pointer are inlined too, but ONLY struct ones:
    // array/mapping storage-pointer library fns (the `using Lib for T[]` path) have their own machinery a broad
    // inlining would wrongly intercept. Scoping to StructType keeps that path intact (SBE-23).
    for (const fn of this.freeFns) {
      if (fn.body && fn.returnTypes.length === 0 && this.hasStructStoragePointerParam(fn)) {
        this.inlinedFns.add(fn.name);
      }
    }
    // Value-returning single-`return` storage-pointer functions (contract or library, e.g. a `using L for
    // mapping` helper `at(mapping storage a, uint i) returns (uint) { return a[i]; }`) are inlined in expression
    // position: the call is replaced by the substituted return expression (`m.at(k)` -> `L.at(m, k)` -> `m[k]`).
    this.exprInlinableFns = new Map();
    for (const fn of [...node.functions, ...this.freeFns]) {
      if (this.isSingleReturnStoragePointerFn(fn)) this.exprInlinableFns.set(fn.name, fn);
    }
    if (this.inlinedFns.size === 0 && this.exprInlinableFns.size === 0) return node;

    // Inline calls in every function body AND the constructor/fallback/receive - a constructor calling an
    // inherited `_mint`-style entry-reading helper is the common ERC20 pattern, and the helper is dropped below.
    for (const fn of [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef]) {
      if (fn?.body) fn.body.statements = this.inlineStatements(fn.body.statements ?? [], [fn.name]);
    }
    // Expression-position inlining of value-returning storage-pointer calls (after the void statement inlining;
    // the two function sets are disjoint - void vs value-returning). Traverse via the visitor so a call in any
    // expression slot (`return f(..)`, `x = f(..)`, `f(..)[k]`) is replaced.
    if (this.exprInlinableFns.size > 0) {
      for (const fn of [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef]) {
        if (fn?.body) { this.exprStack = []; fn.body = this.visit(fn.body) as BlockNode; }
      }
      for (const name of this.exprInlinableFns.keys()) this.inlinedFns.add(name);
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

  private hasStructStoragePointerParam(fn: FunctionDefinitionNode): boolean {
    return fn.parameters.some((p) => p.modifier.includes(Modifier.STORAGE) && p.type instanceof StructType);
  }

  // A value-returning function whose body is a single `return <expr>;` and that takes a storage-pointer param.
  // Such a function has no standalone value representation (the storage param is a compile-time reference), so
  // its calls are inlined by substituting the return expression at the call site.
  private isSingleReturnStoragePointerFn(fn: FunctionDefinitionNode): boolean {
    if (!fn.body || fn.returnTypes.length === 0) return false;
    // Non-standalone: takes a storage-pointer param OR returns a storage pointer (a mapping) - the returned
    // pointer has no runtime value, so `mapping(..) storage m = get()` must inline to the underlying mapping.
    if (!this.hasStoragePointerParam(fn) && !fn.returnTypes.some((t) => t instanceof MappingType)) return false;
    const stmts = (fn.body.statements ?? []).filter((s) => !(s instanceof ConsoleStatementNode));
    return stmts.length === 1 && stmts[0] instanceof ReturnNode && stmts[0].expressions.length === 1;
  }

  // Replace a call to a value-returning storage-pointer function with its (substituted) return expression.
  visitFunctionCall(node: FunctionCallNode): Node {
    const visited = super.visitFunctionCall(node) as FunctionCallNode; // recurse into args (nested inlinable calls)
    const callee = this.exprInlinableFns.get(visited.identifier.name);
    if (callee && !this.exprStack.includes(callee.name)
      && visited.parameters.length === callee.parameters.length) {
      if (this.ambiguousInlineKeys.has(inlineKey(callee.name, callee.parameters.length))) {
        throw new AmbiguousInlineOverloadError(node, callee.name, callee.parameters.length);
      }
      this.exprStack.push(callee.name);
      const replacement = this.buildInlinedReturnExpr(callee, visited.parameters as ExpressionNode[]);
      this.exprStack.pop();
      if (replacement) return this.visit(replacement); // re-visit for nested inlinable calls in the return expr
    }
    return visited;
  }

  // Clone the callee, bind params to the call args (a bare-identifier arg renames the param; any other arg is
  // substituted by expression), then return the substituted single-return expression.
  private buildInlinedReturnExpr(
    callee: FunctionDefinitionNode, args: ExpressionNode[],
  ): ExpressionNode | undefined {
    const cloned = cloneNode(callee) as FunctionDefinitionNode;
    const rename = new Map<string, string>();
    const subs = new Map<string, ExpressionNode>();
    callee.parameters.forEach((p, i) => {
      const arg = args[i];
      if (arg instanceof IdentifierNode) rename.set(p.name, arg.name);
      else subs.set(p.name, cloneNode(arg) as ExpressionNode);
    });
    this.applyRename(cloned.body, rename);
    substituteInFunction(cloned, subs);
    const stmts = (cloned.body.statements ?? []).filter((s) => !(s instanceof ConsoleStatementNode));
    const ret = stmts[stmts.length - 1];
    if (!(ret instanceof ReturnNode) || ret.expressions.length !== 1) return undefined;
    return ret.expressions[0];
  }

  // Whether `name` is the target of a direct assignment anywhere in the body (so it cannot be safely aliased to
  // the caller's argument variable). Postfix/compound ops desugar to AssignNode before this pass.
  private isReassigned(body: Node | undefined, name: string): boolean {
    let found = false;
    this.walk(body, (n) => {
      if (!found && n instanceof AssignNode && n.identifier.name === name) found = true;
    });
    return found;
  }

  // H7: whether `name` is the target of ANY write in the body - a local reassignment (AssignNode) OR a state /
  // mapping / array write (StateAssign / MappingAssign / StateArrayAssign / MappingFieldAssign). Solidity value
  // params are copies; aliasing a value arg to `name` when the body mutates `name` (e.g. a helper that does
  // `this.accIndex = ...; snapshot[me] = bal + accIndex;`) makes the param read the POST-mutation value. Used to
  // fall back to a fresh temp (snapshot) instead of aliasing.
  private isWritten(body: Node | undefined, name: string): boolean {
    let found = false;
    this.walk(body, (n) => {
      if (found) return;
      if (n instanceof AssignNode && n.identifier.name === name) found = true;
      else if ((n instanceof StateAssignNode || n instanceof MappingAssignNode
        || n instanceof StateArrayAssignNode || n instanceof MappingFieldAssignNode)
        && n.name === name) found = true;
    });
    return found;
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
        if (callee && this.inlinedFns.has(name) && !stack.includes(name)
          && stmt.call.parameters.length === callee.parameters.length) {
          if (this.ambiguousInlineKeys.has(inlineKey(name, stmt.call.parameters.length))) {
            throw new AmbiguousInlineOverloadError(stmt.call, name, stmt.call.parameters.length);
          }
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
    const inlinedArg = new Set<string>();
    callee.parameters.forEach((p, i) => {
      const arg = args[i];
      if (p.modifier.includes(Modifier.STORAGE)) {
        // A bare state-var argument is aliased by NAME (covers reads and writes, incl. mapping-assign
        // targets whose container is a string field); a complex access path is substituted by expression.
        if (arg instanceof IdentifierNode) rename.set(p.name, arg.name);
        else subs.set(p.name, cloneNode(arg) as ExpressionNode);
      } else if (arg instanceof IdentifierNode && !this.isReassigned(callee.body, p.name)
        && !this.isWritten(callee.body, arg.name)) {
        // Substitute a simple identifier value arg by NAME (no local binding). A mapping key that is a caller
        // PARAMETER thus stays a parameter in the inlined body, so the SDK resolves it directly from call args;
        // a local binding (`__sp0_k = k`) would make the key an opaque expression the SDK cannot locate on the
        // read side. Guarded on the param not being reassigned in the callee AND the arg name not being written
        // (state/local) in the callee - else the alias would break value-copy semantics (H7).
        rename.set(p.name, arg.name);
        inlinedArg.add(p.name);
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
      if (p.modifier.includes(Modifier.STORAGE) || inlinedArg.has(p.name)) return;
      const def = new VariableDefinitionNode(p.type, [], rename.get(p.name)!, cloneNode(args[i]) as never);
      def.location = args[i].location ?? callee.location;
      bindings.push(def);
    });
    const inlined = this.inlineStatements(cloned.body.statements ?? [], [...stack, callee.name]);
    return [...bindings, ...inlined];
  }

  private applyRename(root: Node, map: Map<string, string>): void {
    // Rename `x` (exact), `x.f` (dotted member), and `x__f` (a struct storage pointer's flattened state field,
    // e.g. `map__values` -> `<arg>__values`) so the inlined body targets the caller's flattened collections.
    const rn = (name: string): string => {
      const dot = name.indexOf('.');
      if (dot > 0 && map.has(name.slice(0, dot))) return map.get(name.slice(0, dot))! + name.slice(dot);
      const us = name.indexOf('__');
      if (us > 0 && map.has(name.slice(0, us))) return map.get(name.slice(0, us))! + name.slice(us);
      return map.get(name) ?? name;
    };
    this.walk(root, (n) => {
      if (n instanceof IdentifierNode) {
        n.name = rn(n.name);
      } else {
        const nm = (n as unknown as { name?: unknown }).name;
        if (typeof nm === 'string') (n as unknown as { name: string }).name = rn(nm);
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
