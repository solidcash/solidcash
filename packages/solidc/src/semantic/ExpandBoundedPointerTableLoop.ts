import {
  Node,
  SourceFileNode,
  ContractNode,
  FunctionDefinitionNode,
  BlockNode,
  StatementNode,
  WhileNode,
  VariableDefinitionNode,
  IntLiteralNode,
  IdentifierNode,
  BinaryOpNode,
  BranchNode,
  RequireNode,
  AssignNode,
  ArrayAssignNode,
  ArrayPushNode,
  ArrayPopNode,
  ArrayDeleteNode,
  DeleteLocalNode,
  MappingAssignNode,
  MappingFieldAssignNode,
  MappingDeleteNode,
  StateAssignNode,
  TupleAssignmentNode,
  FunctionCallNode,
  StateArrayPushNode,
  StateArrayPopNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
  BreakNode,
  ContinueNode,
  ReturnNode,
  IndirectCallNode,
  MethodCallNode,
  ExpressionNode,
} from '../ast/AST.js';
import { BinaryOperator } from '../ast/Operator.js';
import { cloneNode } from '../ast/clone.js';
import AstTraversal from '../ast/AstTraversal.js';
import {
  MAXIMUM_POINTER_TABLE_BOUND, PointerTableBoundError, PointerTableExpansionMap, ProvenLoopCeilingMap,
  recordPointerTableExpansion, recordProvenLoopCeiling,
} from './PointerTableBound.js';

/** Structural signature of an expression, used to match a guard subject against a loop bound expression. */
function signatureOf(node: Node | undefined): string {
  if (!node) return '_';
  const parts: string[] = [node.constructor.name];
  for (const key of Object.keys(node).sort()) {
    if (key === 'location') continue;
    const value = (node as unknown as Record<string, unknown>)[key];
    if (value instanceof Node) parts.push(`${key}=${signatureOf(value)}`);
    else if (Array.isArray(value)) {
      parts.push(`${key}=[${value.map((item) => item instanceof Node ? signatureOf(item) : String(item)).join(',')}]`);
    } else if (typeof value === 'bigint' || typeof value === 'string'
      || typeof value === 'number' || typeof value === 'boolean') {
      parts.push(`${key}=${String(value)}`);
    }
  }
  return `(${parts.join(' ')})`;
}

/** Every identifier named anywhere inside an expression. Used to reject a bound the loop body can move. */
function identifiersOf(node: Node | undefined, into: Set<string> = new Set()): Set<string> {
  if (!node) return into;
  if (node instanceof IdentifierNode) into.add(node.name);
  for (const key of Object.keys(node)) {
    if (key === 'location') continue;
    const value = (node as unknown as Record<string, unknown>)[key];
    if (value instanceof Node) identifiersOf(value, into);
    else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) identifiersOf(item, into);
  }
  return into;
}

/**
 * Count the DISTINCT nodes matching `predicate`.
 *
 * Identity matters: a statement wrapper can reference the same expression through two fields (a method-call
 * statement keeps both `call` and the post-analysis `expression`), so a naive walk counts one source callsite
 * twice and every count derived from it - a dispatch cardinality, a per-row ceiling - is silently doubled.
 */
function countNodes(nodes: Node[], predicate: (node: Node) => boolean): number {
  let found = 0;
  const seen = new Set<Node>();
  const walk = (node: Node): void => {
    if (!node || seen.has(node)) return;
    seen.add(node);
    if (predicate(node)) found += 1;
    for (const key of Object.keys(node)) {
      if (key === 'location') continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (value instanceof Node) walk(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
    }
  };
  for (const node of nodes) walk(node);
  return found;
}

function anyNode(nodes: Node[], predicate: (node: Node) => boolean): boolean {
  return countNodes(nodes, predicate) > 0;
}

/** Names whose value or length a statement list can change. A proven bound may not depend on one of these. */
export function mutatedNames(nodes: Node[]): Set<string> {
  const names = new Set<string>();
  const record = (node: Node): boolean => {
    if (node instanceof AssignNode && node.identifier instanceof IdentifierNode) names.add(node.identifier.name);
    // A tuple assignment writes every non-skip slot. `(n, m) = (m, n)` is a real write to `n` that survives to
    // codegen, so a bound depending on `n` is only as good as the guard that ran BEFORE the swap.
    if (node instanceof TupleAssignmentNode) {
      for (const element of node.elements) if (!element.skip && element.name) names.add(element.name);
    }
    if (node instanceof DeleteLocalNode && node.identifier instanceof IdentifierNode) {
      names.add(node.identifier.name);
    }
    // Local AND state array/mapping mutations both carry the touched name; `this.table.push(x)` is a
    // StateArrayPushNode, so match on the shape rather than on one node class.
    if (node instanceof ArrayPushNode || node instanceof ArrayPopNode
      || node instanceof ArrayAssignNode || node instanceof ArrayDeleteNode
      || node instanceof MappingAssignNode || node instanceof MappingFieldAssignNode
      || node instanceof MappingDeleteNode
      || node instanceof StateArrayPushNode || node instanceof StateArrayPopNode
      || node instanceof StateArrayAssignNode || node instanceof StateArrayDeleteNode
      || node instanceof StateAssignNode) {
      const named = (node as unknown as { name?: unknown }).name;
      if (typeof named === 'string') names.add(named);
    }
    return false;
  };
  anyNode(nodes, record);
  return names;
}

/**
 * Expands a RUNTIME-SIZED function-pointer table loop into a compiler-bounded, guarded sequence, and rejects
 * every pointer-table loop whose reached-occurrence count the compiler cannot bound.
 *
 * `for (int i = 0; i < n; i = i + 1) { table[i](v); }` guarded by a dominating `require(n <= K)` becomes
 * `if (0 < n) { table[0](v); } ... if (K-1 < n) { table[K-1](v); }`. The number of REACHED rows is still the
 * runtime `n`; only the ceiling is compile-time. Each reached row keeps a compile-time-constant table index, so
 * its target and selector are read from one canonical persisted slot and authenticated as an ordinary graph
 * callsite. The source `require` remains in the emitted covenant, so a runtime table longer than the published
 * bound fails on-chain rather than silently executing a truncated prefix.
 *
 * Fixed literal trip counts are handled earlier by UnrollFixedBoundEntryLoop; this pass only sees the loops that
 * pass could not enumerate. It runs only for message-bus controller compilation, so direct (non-graph) lowering
 * is unchanged.
 */
export default class ExpandBoundedPointerTableLoop extends AstTraversal {
  // Signature of a bound expression -> the largest value a dominating require lets it take.
  private provenBounds = new Map<string, bigint>();
  private currentFunction = '';
  // Every name the CURRENT function can write, INCLUDING through the contract functions it calls. A bound may
  // not depend on one: the guard proves a ceiling at the point it runs, and a later write - before the loop,
  // inside it, or inside a callee - would silently invalidate that proof. Computed on first use: only a
  // function that actually holds a pointer-table loop ever consults it, and building it walks whole bodies.
  private functionMutations?: Set<string>;
  private currentFunctionNode?: FunctionDefinitionNode;
  // Contract functions visible to internal calls, so mutation and bound provenance can be followed into them.
  private contractFunctions = new Map<string, FunctionDefinitionNode>();
  // Per-function direct mutations, shared across the callers that reach them.
  private mutationCache = new Map<FunctionDefinitionNode, Set<string>>();
  // Declared interface names, so an ordinary `IFoo(addr).m()` in a loop is told apart from any other method call.
  private interfaceNames = new Set<string>();

  constructor(
    private readonly expansions?: PointerTableExpansionMap,
    private readonly ceilings?: ProvenLoopCeilingMap,
  ) {
    super();
  }

  visitSourceFile(node: SourceFileNode): Node {
    for (const declared of node.interfaceDefinitions) this.interfaceNames.add(declared.name);
    for (const imported of node.importedContracts) this.interfaceNames.add(imported.name);
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    node.importedContracts = node.importedContracts.map((contract) => this.visit(contract) as ContractNode);
    node.freeFunctions = node.freeFunctions.map((fn) => this.visit(fn) as FunctionDefinitionNode);
    return node;
  }

  visitContract(node: ContractNode): Node {
    const previous = this.contractFunctions;
    this.contractFunctions = new Map(node.functions.map((fn) => [fn.name, fn]));
    if (node.constructorDef) this.contractFunctions.set(node.constructorDef.name, node.constructorDef);
    const result = super.visitContract(node);
    this.contractFunctions = previous;
    return result;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const previous = this.provenBounds;
    const previousName = this.currentFunction;
    const previousMutations = this.functionMutations;
    const previousNode = this.currentFunctionNode;
    this.provenBounds = new Map();
    this.currentFunction = node.name;
    this.currentFunctionNode = node;
    this.functionMutations = undefined;
    node.body = this.visit(node.body) as BlockNode;
    this.provenBounds = previous;
    this.currentFunction = previousName;
    this.functionMutations = previousMutations;
    this.currentFunctionNode = previousNode;
    return node;
  }

  /** Contract functions this node can call, by name. Only names the contract defines are followed. */
  private calledFunctions(node: Node | undefined): string[] {
    const called: string[] = [];
    const walk = (candidate: Node | undefined): void => {
      if (!candidate) return;
      if (candidate instanceof FunctionCallNode && this.contractFunctions.has(candidate.identifier.name)) {
        called.push(candidate.identifier.name);
      }
      for (const key of Object.keys(candidate)) {
        if (key === 'location' || key === 'resolvedFunction') continue;
        const value = (candidate as unknown as Record<string, unknown>)[key];
        if (value instanceof Node) walk(value);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
      }
    };
    walk(node);
    return called;
  }

  /**
   * Names `fn` can write, following internal calls transitively. Without this a bound is escapable by moving the
   * write one call deep - `bump(extra)` pushing to the very table the bound reads - which the identical inline
   * write is correctly refused for.
   */
  private reachableMutations(fn: FunctionDefinitionNode): Set<string> {
    const names = new Set<string>();
    const seen = new Set<FunctionDefinitionNode>();
    const walk = (current: FunctionDefinitionNode | undefined): void => {
      if (!current?.body || seen.has(current)) return;
      seen.add(current);
      let direct = this.mutationCache.get(current);
      if (!direct) {
        direct = mutatedNames([current.body]);
        this.mutationCache.set(current, direct);
      }
      for (const name of direct) names.add(name);
      for (const callee of this.calledFunctions(current.body)) walk(this.contractFunctions.get(callee));
    };
    walk(fn);
    return names;
  }

  /** The current function's reachable mutations, built once and only when a pointer-table loop needs them. */
  private currentMutations(): Set<string> {
    if (!this.functionMutations) {
      this.functionMutations = this.currentFunctionNode
        ? this.reachableMutations(this.currentFunctionNode) : new Set<string>();
    }
    return this.functionMutations;
  }

  /**
   * Every name a bound expression's VALUE can depend on. A bare identifier chain contributes its own names; a
   * call contributes every name its callee body mentions, transitively. Without the call leg a bound read
   * through a getter - `require(rows() <= 3)` where `rows()` returns `handlers.length` - hides its dependency on
   * a table the same function pushes to.
   */
  private boundDependencies(expression: Node | undefined): Set<string> {
    const names = identifiersOf(expression);
    const seen = new Set<FunctionDefinitionNode>();
    const queue = this.calledFunctions(expression);
    while (queue.length > 0) {
      const callee = this.contractFunctions.get(queue.pop()!);
      if (!callee?.body || seen.has(callee)) continue;
      seen.add(callee);
      identifiersOf(callee.body, names);
      queue.push(...this.calledFunctions(callee.body));
    }
    return names;
  }

  visitBlock(node: BlockNode): Node {
    const outer = this.provenBounds;
    this.provenBounds = new Map(outer);
    const out: StatementNode[] = [];
    const statements = node.statements ?? [];
    for (let index = 0; index < statements.length; index++) {
      const statement = statements[index];
      if (statement instanceof RequireNode) this.recordGuard(statement.expression);
      if (statement instanceof VariableDefinitionNode && statement.isLoopVariable
        && index + 1 < statements.length && statements[index + 1] instanceof WhileNode
        && (statements[index + 1] as WhileNode).forLoopUpdateCount > 0) {
        const loop = statements[index + 1] as WhileNode;
        const expanded = this.tryExpand(statement, loop);
        if (expanded) {
          out.push(...expanded);
          index += 1;
          continue;
        }
      }
      out.push(this.visit(statement) as StatementNode);
    }
    node.statements = out;
    this.provenBounds = outer;
    return node;
  }

  /** Record `require(expr <= K)` style ceilings, including the conjuncts of a top-level `&&` chain. */
  private recordGuard(expression: ExpressionNode | undefined): void {
    if (!(expression instanceof BinaryOpNode)) return;
    if (expression.operator === BinaryOperator.AND) {
      this.recordGuard(expression.left);
      this.recordGuard(expression.right);
      return;
    }
    const { left, right, operator } = expression;
    const subject = right instanceof IntLiteralNode ? left : left instanceof IntLiteralNode ? right : undefined;
    const literal = right instanceof IntLiteralNode ? right : left instanceof IntLiteralNode ? left : undefined;
    if (!subject || !literal || subject === literal) return;
    const subjectIsLeft = subject === left;
    let ceiling: bigint | undefined;
    if (operator === BinaryOperator.LE) ceiling = subjectIsLeft ? literal.value : undefined;
    else if (operator === BinaryOperator.LT) ceiling = subjectIsLeft ? literal.value - 1n : undefined;
    else if (operator === BinaryOperator.GE) ceiling = subjectIsLeft ? undefined : literal.value;
    else if (operator === BinaryOperator.GT) ceiling = subjectIsLeft ? undefined : literal.value - 1n;
    if (ceiling === undefined) return;
    const key = signatureOf(subject);
    const existing = this.provenBounds.get(key);
    if (existing === undefined || ceiling < existing) this.provenBounds.set(key, ceiling);
  }

  /**
   * Publish a ceiling for a loop this pass leaves ROLLED because it holds ordinary interface calls rather than
   * a pointer dispatch.
   *
   * Nothing about the emitted program changes: the covenant still loops and still emits one row per executed
   * iteration. What changes is that the ceiling the source already proves - a dominating
   * `require(bound <= K)` over the trip count - reaches the artifact, so a consumer choosing a row count has a
   * compiler-proven number to check it against instead of only the global transcript ceiling. A shape whose
   * bound cannot be proven records nothing and stays exactly as unbounded as it was.
   */
  private recordRolledLoopCeiling(
    initializer: VariableDefinitionNode, loop: WhileNode, bodyStatements: StatementNode[],
  ): void {
    if (!this.ceilings) return;
    const calls = countNodes(bodyStatements, (node) => node instanceof MethodCallNode
      && node.selectorArrayVar === undefined
      && node.object instanceof FunctionCallNode
      && this.interfaceNames.has(node.object.identifier.name));
    if (calls === 0) return;
    const count = this.provenTripCount(initializer, loop, bodyStatements, 'decline');
    if (count === undefined) return;
    for (let index = 0; index < calls; index += 1) {
      recordProvenLoopCeiling(this.ceilings, this.currentFunction, Number(count));
    }
  }

  /**
   * The compiler-proven ceiling on a loop's trip count, or undefined when no ceiling is proven.
   *
   * `onFailure: 'throw'` is the pointer-table contract - every unbounded shape must be refused with one stable
   * diagnostic - while `'decline'` is used where the loop is admitted either way and only the published bound
   * is at stake. The two modes share one proof so a bound can never be published on weaker evidence than the
   * expansion demands.
   */
  private provenTripCount(
    initializer: VariableDefinitionNode, loop: WhileNode, bodyStatements: StatementNode[],
    onFailure: 'throw' | 'decline',
  ): bigint | undefined {
    const decline = (node: Node, detail: string): undefined => {
      if (onFailure === 'throw') throw new PointerTableBoundError(node, detail);
      return undefined;
    };
    const variable = initializer.name;
    if (!(initializer.expression instanceof IntLiteralNode)) {
      return decline(initializer, 'the loop initializer is not an integer literal');
    }
    const start = initializer.expression.value;

    const condition = loop.condition;
    if (!(condition instanceof BinaryOpNode)
      || ![BinaryOperator.LT, BinaryOperator.LE].includes(condition.operator)
      || !(condition.left instanceof IdentifierNode && condition.left.name === variable)) {
      return decline(loop, `the loop condition must be '${variable} < bound' or '${variable} <= bound'`);
    }
    const boundExpression = condition.right;
    const inclusive = condition.operator === BinaryOperator.LE;

    const all = loop.block.statements ?? [];
    const step = this.stepOf(all.slice(all.length - loop.forLoopUpdateCount), variable);
    if (step === undefined || step <= 0n) {
      return decline(loop, `the loop update must be '${variable} = ${variable} + literal'`);
    }
    if (anyNode(bodyStatements, (node) => node instanceof BreakNode
      || node instanceof ContinueNode || node instanceof ReturnNode)) {
      return decline(loop, 'the loop body uses break, continue or return');
    }

    const maximum = this.provenBounds.get(signatureOf(boundExpression));
    if (maximum === undefined) {
      return decline(
        loop,
        'add a dominating require that bounds the trip count by an integer literal, '
        + "for example 'require(table.length <= 4);'",
      );
    }
    const mutations = this.currentMutations();
    for (const name of this.boundDependencies(boundExpression)) {
      if (mutations.has(name)) {
        return decline(loop, `this function can change '${name}', which the bound depends on`);
      }
    }

    const span = maximum - start;
    let count = 0n;
    if (span >= 0n) count = inclusive ? span / step + 1n : (span + step - 1n) / step;
    if (count < 0n) count = 0n;
    if (count > BigInt(MAXIMUM_POINTER_TABLE_BOUND)) {
      return decline(
        loop,
        `the proven bound of ${count} reached rows exceeds the maximum of ${MAXIMUM_POINTER_TABLE_BOUND}`,
      );
    }
    return count;
  }

  private tryExpand(
    initializer: VariableDefinitionNode, loop: WhileNode,
  ): StatementNode[] | undefined {
    const updateCount = loop.forLoopUpdateCount;
    const all = loop.block.statements ?? [];
    if (updateCount >= all.length) return undefined;
    const bodyStatements = all.slice(0, all.length - updateCount);
    const dispatches = countNodes(bodyStatements, (node) => node instanceof IndirectCallNode
      || (node instanceof MethodCallNode && node.selectorArrayVar !== undefined));
    if (dispatches === 0) {
      this.recordRolledLoopCeiling(initializer, loop, bodyStatements);
      return undefined;
    }
    if (dispatches > 1) {
      throw new PointerTableBoundError(
        loop, `the loop body holds ${dispatches} pointer dispatches; exactly one is admitted`,
      );
    }

    const variable = initializer.name;
    const count = this.provenTripCount(initializer, loop, bodyStatements, 'throw')!;
    const start = (initializer.expression as IntLiteralNode).value;
    const condition = loop.condition as BinaryOpNode;
    const step = this.stepOf(all.slice(all.length - updateCount), variable)!;

    const expanded: StatementNode[] = [];
    for (let index = 0n; index < count; index += 1n) {
      const value = start + index * step;
      const guard = cloneNode(condition) as BinaryOpNode;
      this.substitute(guard, variable, value);
      const iteration = bodyStatements.map((statement) => {
        const copy = cloneNode(statement);
        this.substitute(copy, variable, value);
        return copy;
      });
      const inner = new BlockNode(iteration);
      inner.location = loop.block.location;
      const branch = new BranchNode(guard, inner);
      branch.location = loop.location;
      expanded.push(this.visit(branch) as StatementNode);
    }
    recordPointerTableExpansion(
      this.expansions, this.currentFunction, { count: Number(count), guarded: true },
    );
    return expanded;
  }

  private stepOf(update: StatementNode[], variable: string): bigint | undefined {
    if (update.length !== 1) return undefined;
    const statement = update[0];
    if (!(statement instanceof AssignNode)) return undefined;
    if (!(statement.identifier instanceof IdentifierNode && statement.identifier.name === variable)) return undefined;
    const expression = statement.expression;
    if (!(expression instanceof BinaryOpNode && expression.operator === BinaryOperator.PLUS)) return undefined;
    if (expression.left instanceof IdentifierNode && expression.left.name === variable
      && expression.right instanceof IntLiteralNode) return expression.right.value;
    if (expression.right instanceof IdentifierNode && expression.right.name === variable
      && expression.left instanceof IntLiteralNode) return expression.left.value;
    return undefined;
  }

  private substitute(node: Node, variable: string, value: bigint): void {
    const replacement = (candidate: unknown): Node | undefined => {
      if (candidate instanceof IdentifierNode && candidate.name === variable) {
        const literal = new IntLiteralNode(value);
        literal.location = candidate.location;
        return literal;
      }
      return undefined;
    };
    for (const key of Object.keys(node)) {
      if (key === 'location') continue;
      const child = (node as unknown as Record<string, unknown>)[key];
      const replaced = replacement(child);
      if (replaced) {
        (node as unknown as Record<string, unknown>)[key] = replaced;
      } else if (child instanceof Node) {
        this.substitute(child, variable, value);
      } else if (Array.isArray(child)) {
        for (let index = 0; index < child.length; index++) {
          const item = replacement(child[index]);
          if (item) child[index] = item;
          else if (child[index] instanceof Node) this.substitute(child[index], variable, value);
        }
      }
    }
  }
}
