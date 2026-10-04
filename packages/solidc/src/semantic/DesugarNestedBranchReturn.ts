import {
  FunctionDefinitionNode, BlockNode, StatementNode, Node, WhileNode, DoWhileNode, BranchNode,
  ReturnNode, RevertNode, VariableDefinitionNode, AssignNode, IdentifierNode, BoolLiteralNode,
  UnaryOpNode, SourceFileNode, ContractNode, ConsoleStatementNode, SwitchNode, TryCatchNode,
  MappingAccessNode, ArrayAccessNode,
  FunctionCallNode, MethodCallNode, LowLevelCallNode, LowLevelCallStatementNode, FunctionModifier,
  UncheckedNode, EmitStatementNode,
} from '../ast/AST.js';
import { ArrayType, PrimitiveType } from '@solidcash/utils';
import { UnaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';
import { inlineKey } from './inlineOverloadGuard.js';

/**
 * Desugars a MAY-return branch arm (a return nested under further conditions, with fall-through) in an
 * internal/private function into a flag + gated tail + single terminal return. EarlyReturnTransformation
 * only linearizes arms that ALWAYS return (it nests the following statements into an else); an arm that
 * returns on some inner path and falls through otherwise has no jump-free linearization without a flag -
 * codegen's branch merge then read a stack the returning path had already consumed:
 *
 *   function g(..) returns (T) { if (a) { if (b) { return X; } } rest... }
 *   ->
 *   function g(..) returns (T) { bool __bretflag = false; T __bretval_0;
 *     if (a) { if (b) { __bretval_0 = X; __bretflag = true; } }
 *     if (!__bretflag) { rest... }   // every original return stashes + sets the flag
 *     return __bretval_0; }
 *
 * Runs after NamedReturnTransformation (implicit named-return tails are explicit by then, so the appended
 * terminal return cannot clobber a fall-off path) and before semantic analysis (the new locals resolve
 * normally). Loop subtrees are untouched - DesugarReturnInLoop already rewrote returns inside loops.
 */
const FLAG = '__internal__bretflag';
const VAL = (k: number): string => `__internal__bretval_${k}`;

/** The back-references a body walk skips: they point outside the syntactic subtree. */
const LINK_KEYS = new Set(['type', 'symbolTable', 'location', 'definition', 'symbol', 'resolvedFunction',
  'functionReference', 'referencedContract', 'collection', 'stateVariable']);

/** Visits every node of `node`'s syntactic subtree once: a lowering can share a subtree between two parents. */
function walkSyntax(node: Node | undefined, visit: (node: Node) => void, seen = new Set<Node>()): void {
  if (!node || seen.has(node)) return;
  seen.add(node);
  visit(node);
  for (const key of Object.keys(node)) {
    if (LINK_KEYS.has(key)) continue;
    const value = (node as unknown as Record<string, unknown>)[key];
    if (value instanceof Node) walkSyntax(value, visit, seen);
    else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walkSyntax(item, visit, seen);
  }
}

/** What a unit's bodies call by name and which of its functions emit, by `<name>/<arity>` key. */
interface CallFacts {
  /** The functions some body calls by name. */
  readonly called: ReadonlySet<string>;
  /**
   * The functions that emit an event, in their own body or through a function they call by name: a called helper
   * that emits is inlined into its caller, so the caller emits once it is.
   */
  readonly emitting: ReadonlySet<string>;
}

/** The call facts of `functions`, the calls of `entries` (a constructor, a fallback, a receive) among them. */
function callFacts(
  functions: readonly FunctionDefinitionNode[], entries: readonly (FunctionDefinitionNode | undefined)[],
): CallFacts {
  const called = new Set<string>();
  const emitting = new Set<string>();
  const calls = new Map<string, Set<string>>();
  const scan = (fn: FunctionDefinitionNode, key?: string): void => {
    const own = (key === undefined ? undefined : calls.get(key)) ?? new Set<string>();
    if (key !== undefined) calls.set(key, own);
    walkSyntax(fn.body, (node) => {
      if (node instanceof EmitStatementNode && key !== undefined) emitting.add(key);
      if (!(node instanceof FunctionCallNode)) return;
      const callee = inlineKey(node.identifier.name, node.parameters.length);
      own.add(callee);
      called.add(callee);
    });
  };
  for (const fn of functions) scan(fn, inlineKey(fn.name, fn.parameters.length));
  for (const fn of entries) if (fn) scan(fn);
  for (let grown = true; grown;) {
    grown = false;
    for (const [key, callees] of calls) {
      if (emitting.has(key) || ![...callees].some((callee) => emitting.has(callee))) continue;
      emitting.add(key);
      grown = true;
    }
  }
  return { called, emitting };
}

/** A source `return` of one value. */
const returnsOneValue = (statement: StatementNode | undefined): boolean =>
  statement instanceof ReturnNode && !statement.isYulReturn && statement.expressions.length === 1;

/**
 * Whether a one-value function ends `if (c) return a; return b;`, which InlineReturningStateHelpers makes
 * `return c ? a : b;` itself (`normalizeSimpleEarlyReturn`).
 */
function endsInSimpleEarlyReturn(fn: FunctionDefinitionNode): boolean {
  const statements = fn.body?.statements ?? [];
  const branch = statements[statements.length - 2];
  return fn.returnTypes.length === 1 && branch instanceof BranchNode && !branch.elseBlock
    && returnsOneValue(statements[statements.length - 1])
    && branch.ifBlock.statements?.length === 1 && returnsOneValue(branch.ifBlock.statements[0]);
}

export default class DesugarNestedBranchReturn extends AstTraversal {
  private retCount = 0;
  private collectionNames = new Set<string>();
  private freeFunctions: FunctionDefinitionNode[] = [];
  /** The call facts of the unit being visited: its contract's functions and the file's free functions. */
  private calls: CallFacts = { called: new Set(), emitting: new Set() };

  constructor(private readonly normalizePureMemoryHelpers = false) {
    super();
  }

  visitSourceFile(node: SourceFileNode): Node {
    this.freeFunctions = node.freeFunctions;
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    node.importedContracts = node.importedContracts.map((c) => this.visit(c) as ContractNode);
    if (node.contract) this.calls = this.callFactsOf(node.contract);
    node.freeFunctions = node.freeFunctions.map((f) => this.visit(f) as FunctionDefinitionNode);
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.collectionNames = new Set(node.collections.map((collection) => collection.name));
    this.calls = this.callFactsOf(node);
    node.functions = node.functions.map((f) => this.visit(f) as FunctionDefinitionNode);
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (!node.body || node.returnTypes.length === 0) return node;
    // Entry points normally have the non-corrupting blob-stash return path. A returning entry point which owns
    // an external call is also eligible for internal source calls, however, and must be reduced to one tail
    // return so InlineReturningStateHelpers can splice those internal calls into their caller. Its dispatched
    // definition remains intact.
    const covenantRewrite = this.needsReturningCovenantRewrite(node.body);
    const pureMemoryRewrite = this.normalizePureMemoryHelpers && !node.isEntryPoint
      && node.returnNames.length === 0
      && node.modifiers.includes(FunctionModifier.PURE)
      && node.parameters.some((parameter) => parameter.type instanceof ArrayType
        && parameter.modifier.includes('memory'))
      && this.countReturns(node.body) > 1
      && !this.hasReturnInsideUnsupportedControl(node.body);
    if (this.normalizePureMemoryHelpers) {
      if (!pureMemoryRewrite) return node;
    } else {
      if (node.isEntryPoint && !covenantRewrite) return node;
      if (!this.needsFlagRewrite(node.body) && !this.needsReturningStateRewrite(node.body)
        && !this.needsReturningEventRewrite(node) && !covenantRewrite) return node;
    }

    this.retCount = node.returnTypes.length;
    const decls: StatementNode[] = [new VariableDefinitionNode(PrimitiveType.BOOL, [], FLAG, new BoolLiteralNode(false))];
    for (let k = 0; k < node.returnTypes.length; k++) {
      decls.push(new VariableDefinitionNode(node.returnTypes[k], [], VAL(k)));
    }
    const [stmts] = this.rewriteList(node.body.statements ?? []);
    const rets: IdentifierNode[] = [];
    for (let k = 0; k < this.retCount; k++) rets.push(new IdentifierNode(VAL(k)));
    node.body.statements = [...decls, ...stmts, new ReturnNode(rets)];
    for (const statement of node.body.statements) this.stampMissingLocations(statement, node.location);
    return node;
  }

  private countReturns(node: Node | undefined): number {
    if (!node) return 0;
    let count = node instanceof ReturnNode ? 1 : 0;
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location' || key === 'definition'
        || key === 'symbol' || key === 'resolvedFunction' || key === 'functionReference'
        || key === 'referencedContract' || key === 'collection' || key === 'stateVariable') continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (value instanceof Node) count += this.countReturns(value);
      else if (Array.isArray(value)) {
        for (const item of value) if (item instanceof Node) count += this.countReturns(item);
      }
    }
    return count;
  }

  private hasReturnInsideUnsupportedControl(node: Node | undefined, unsupported = false): boolean {
    if (!node) return false;
    if (node instanceof ReturnNode) return unsupported;
    // Loop exits require DesugarReturnInLoop's break/flag protocol. Do not append a synthetic tail return when an
    // original return would survive inside a loop in this earlier kernel-only pass.
    const nestedUnsupported = unsupported || node instanceof WhileNode || node instanceof DoWhileNode;
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location' || key === 'definition'
        || key === 'symbol' || key === 'resolvedFunction' || key === 'functionReference'
        || key === 'referencedContract' || key === 'collection' || key === 'stateVariable') continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (value instanceof Node
        && this.hasReturnInsideUnsupportedControl(value, nestedUnsupported)) return true;
      if (Array.isArray(value) && value.some((item) =>
        item instanceof Node && this.hasReturnInsideUnsupportedControl(item, nestedUnsupported))) return true;
    }
    return false;
  }

  private stampMissingLocations(root: Node, location: Node['location']): void {
    const seen = new WeakSet<Node>();
    const walk = (node: Node): void => {
      if (seen.has(node)) return;
      seen.add(node);
      if (!node.location) node.location = location;
      for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
        const value = (node as unknown as Record<string, unknown>)[key];
        if (value instanceof Node) walk(value);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
      }
    };
    walk(root);
  }

  // Entry-slot layouts belong to dispatched functions. An internal helper that touches a collection and has
  // multiple returns cannot remain a subroutine: InlineReturningStateHelpers can inline it once those returns
  // have been reduced to this pass's single flag-backed tail return. Keep this narrowly scoped to declared
  // collections; unrelated branching helpers retain their established lowering.
  private needsReturningStateRewrite(body: BlockNode): boolean {
    let returns = 0;
    let touchesCollection = false;
    const walk = (node: Node | undefined): void => {
      if (!node) return;
      if (node instanceof ReturnNode) returns += 1;
      if (node instanceof MappingAccessNode && this.collectionNames.has(node.name)) touchesCollection = true;
      if (node instanceof ArrayAccessNode && node.array instanceof IdentifierNode
        && this.collectionNames.has(node.array.name)) touchesCollection = true;
      for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
        const value = (node as unknown as Record<string, unknown>)[key];
        if (value instanceof Node) walk(value);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
      }
    };
    walk(body);
    return returns > 1 && touchesCollection;
  }

  private callFactsOf(contract: ContractNode): CallFacts {
    return callFacts([...contract.functions, ...this.freeFunctions],
      [contract.constructorDef, contract.fallbackDef, contract.receiveDef]);
  }

  // An event is settled in the entry point's frame: behind OP_INVOKE a value-returning helper's event would be
  // dropped at its exit, which code generation refuses (X118). InlineReturningStateHelpers inlines a helper that
  // emits, itself or through a helper it calls, once its returns are this pass's single tail return. A helper no
  // body calls by name, or one ending in the early return that pass linearizes itself, keeps its lowering.
  private needsReturningEventRewrite(node: FunctionDefinitionNode): boolean {
    const returns = this.countReturns(node.body);
    const key = inlineKey(node.name, node.parameters.length);
    if (returns < 2 || !this.calls.called.has(key) || (returns === 2 && endsInSimpleEarlyReturn(node))) return false;
    let emits = false;
    walkSyntax(node.body, (child) => {
      if (child instanceof EmitStatementNode) emits = true;
      if (child instanceof FunctionCallNode
        && this.calls.emitting.has(inlineKey(child.identifier.name, child.parameters.length))) emits = true;
    });
    return emits;
  }

  // External/low-level calls inject BCH co-spend witness parameters only into dispatched entry frames. A
  // multi-return helper containing one cannot remain behind OP_INVOKE when another function calls it internally;
  // normalize its returns here so the returning-helper inliner can move the complete call graph into that caller.
  private needsReturningCovenantRewrite(body: BlockNode): boolean {
    let returns = 0;
    let ownsCall = false;
    const walk = (node: Node | undefined): void => {
      if (!node) return;
      if (node instanceof ReturnNode) returns += 1;
      if (node instanceof MethodCallNode || node instanceof LowLevelCallNode
        || node instanceof LowLevelCallStatementNode) ownsCall = true;
      if (node instanceof FunctionCallNode) {
        const name = node.identifier.name;
        if (name.includes('.') && !name.startsWith('super.')) ownsCall = true;
      }
      for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
        const value = (node as unknown as Record<string, unknown>)[key];
        if (value instanceof Node) walk(value);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
      }
    };
    walk(body);
    return returns > 1 && ownsCall;
  }

  // Trigger: some branch arm contains a (non-loop) return but does not END on a terminal statement on
  // every inner path - the fall-through-after-return class the else-nesting transformation cannot handle.
  private needsFlagRewrite(node: Node | undefined): boolean {
    if (!node) return false;
    if (node instanceof WhileNode || node instanceof DoWhileNode || node instanceof SwitchNode) return false;
    if (node instanceof BranchNode) {
      for (const arm of [node.ifBlock, node.elseBlock]) {
        if (!arm) continue;
        if (this.containsReturn(arm) && !this.endsTerminal(arm)) return true;
        if (this.needsFlagRewrite(arm)) return true;
      }
      return false;
    }
    if (node instanceof TryCatchNode) return this.needsFlagRewrite(node.tryBlock);
    if (node instanceof BlockNode) return (node.statements ?? []).some((s) => this.needsFlagRewrite(s));
    return false;
  }

  private containsReturn(node: Node | undefined): boolean {
    if (!node) return false;
    if (node instanceof ReturnNode) return true;
    if (node instanceof WhileNode || node instanceof DoWhileNode || node instanceof SwitchNode) return false;
    if (node instanceof BranchNode) {
      return this.containsReturn(node.ifBlock) || this.containsReturn(node.elseBlock);
    }
    if (node instanceof TryCatchNode) return this.containsReturn(node.tryBlock);
    if (node instanceof BlockNode) return (node.statements ?? []).some((s) => this.containsReturn(s));
    return false;
  }

  // Whether a block always exits (return or revert) on every path through its final statement.
  private endsTerminal(block: BlockNode): boolean {
    const stmts = (block.statements ?? []).filter((s) => !(s instanceof ConsoleStatementNode));
    if (stmts.length === 0) return false;
    const last = stmts[stmts.length - 1];
    if (last instanceof ReturnNode || last instanceof RevertNode) return true;
    if (last instanceof BranchNode) {
      return !!last.elseBlock && this.endsTerminal(last.ifBlock) && this.endsTerminal(last.elseBlock);
    }
    if (last instanceof BlockNode) return this.endsTerminal(last);
    return false;
  }

  // Returns [rewritten statements, whether a return was rewritten below (the flag may be set at runtime)].
  private rewriteList(stmts: StatementNode[]): [StatementNode[], boolean] {
    const out: StatementNode[] = [];
    let had = false;
    for (let i = 0; i < stmts.length; i++) {
      const s = stmts[i];
      if (s instanceof ReturnNode && s.expressions.length === this.retCount) {
        for (let k = 0; k < s.expressions.length; k++) {
          out.push(new AssignNode(new IdentifierNode(VAL(k)), s.expressions[k]));
        }
        out.push(new AssignNode(new IdentifierNode(FLAG), new BoolLiteralNode(true)));
        // Statements after an unconditional return are unreachable; drop them.
        return [out, true];
      }
      if (s instanceof WhileNode || s instanceof DoWhileNode) {
        out.push(s); // loop returns are handled by DesugarReturnInLoop at the ordinary lowering boundary
        continue;
      }
      let mayReturn = false;
      if (s instanceof BranchNode) {
        const [ifs, ifHad] = this.rewriteList(s.ifBlock.statements ?? []);
        s.ifBlock.statements = ifs;
        let elHad = false;
        if (s.elseBlock) {
          const [els, e] = this.rewriteList(s.elseBlock.statements ?? []);
          s.elseBlock.statements = els; elHad = e;
        }
        mayReturn = ifHad || elHad;
      } else if (s instanceof TryCatchNode) {
        const [ts, tHad] = this.rewriteList(s.tryBlock.statements ?? []);
        s.tryBlock.statements = ts;
        let catchHad = false;
        for (const clause of s.catchClauses) {
          const [cs, cHad] = this.rewriteList(clause.block.statements ?? []);
          clause.block.statements = cs;
          catchHad ||= cHad;
        }
        mayReturn = tHad || catchHad;
      } else if (s instanceof SwitchNode) {
        let switchHad = false;
        for (const switchCase of s.cases) {
          const [caseStatements, caseHad] = this.rewriteList(switchCase.body.statements ?? []);
          switchCase.body.statements = caseStatements;
          switchHad ||= caseHad;
        }
        if (s.defaultCase) {
          const [defaultStatements, defaultHad] = this.rewriteList(s.defaultCase.statements ?? []);
          s.defaultCase.statements = defaultStatements;
          switchHad ||= defaultHad;
        }
        mayReturn = switchHad;
      } else if (s instanceof UncheckedNode) {
        const [uncheckedStatements, uncheckedHad] = this.rewriteList(s.block.statements ?? []);
        s.block.statements = uncheckedStatements;
        mayReturn = uncheckedHad;
      } else if (s instanceof BlockNode) {
        const [bs, bHad] = this.rewriteList(s.statements ?? []);
        s.statements = bs;
        mayReturn = bHad;
      }
      out.push(s);
      if (mayReturn) {
        had = true;
        const rest = stmts.slice(i + 1);
        if (rest.length > 0) {
          const [gated] = this.rewriteList(rest);
          out.push(new BranchNode(
            new UnaryOpNode(UnaryOperator.NOT, new IdentifierNode(FLAG)),
            new BlockNode(gated),
          ));
          return [out, true];
        }
      }
    }
    return [out, had];
  }
}
