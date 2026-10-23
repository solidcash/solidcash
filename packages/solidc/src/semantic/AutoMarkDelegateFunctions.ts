import {
  type Ast, FunctionDefinitionNode, FunctionModifier, Node, ContractNode,
  LowLevelCallNode, LowLevelCallStatementNode,
  TransferStatementNode, AddressTransferStatementNode, TokenContainerMethodStatementNode,
  AssignNode, VariableDefinitionNode, TupleAssignmentNode, StatementNode, BlockNode, BranchNode,
  TryCatchNode, DoWhileNode, WhileNode, CollectionIterationNode, UncheckedNode, SwitchNode,
  ArrayAssignNode, ArrayDeleteNode, ArrayPushNode, ArrayPopNode, EmitStatementNode,
} from '../ast/AST.js';
import { containsStatefulOperation } from './EnsureFinalRequireTraversal.js';

/**
 * Marks the functions that CAN act as a proxy implementation with FunctionModifier.DELEGATE, so `delegate` is
 * never written in source (Solidity has no such keyword: an implementation contract is an ordinary contract,
 * and the proxy decides at runtime).
 *
 * On BCH the mode cannot be decided at runtime - a delegate function writes a CO-SPENT proxy's state instead of
 * its own, which is different locking bytecode. So the compiler emits the contract twice: the standalone
 * artifact, and (when this pass marks anything) a delegate variant carried as artifact.delegateArtifact. The
 * SDK picks the variant when the contract is used behind a proxy.
 *
 * Mirrors the auto-marking already done for state-touching `library` declarations in AstBuilder.
 */

// Modifiers that make inferred delegate mode meaningless or unsound. They simply make the function ineligible;
// the ordinary standalone form remains valid.
const INELIGIBLE_MODIFIERS = [
  FunctionModifier.PURE, FunctionModifier.VIEW, FunctionModifier.INTERNAL, FunctionModifier.PRIVATE,
  FunctionModifier.UNSAFE, FunctionModifier.UPGRADE, FunctionModifier.DEPLOY, FunctionModifier.SELFDESTRUCT,
  FunctionModifier.SPLIT, FunctionModifier.MERGE, FunctionModifier.DELEGATE,
];

function walk(node: Node | undefined, seen: Set<Node>, hit: (n: Node) => boolean): boolean {
  if (!node || seen.has(node)) return false;
  seen.add(node);
  if (hit(node)) return true;
  for (const v of Object.values(node)) {
    if (v instanceof Node) {
      if (walk(v, seen, hit)) return true;
    } else if (Array.isArray(v)) {
      for (const e of v) if (e instanceof Node && walk(e, seen, hit)) return true;
    }
  }
  return false;
}
/**
 * A function only benefits from delegate mode if it touches state the proxy owns - that is what gets delegated.
 * Uses the shared definition (state writes, emits, low-level calls); an emit is included because the event NFT
 * lands in the PROXY's block, so it does need retargeting.
 *
 * Typed external calls are deliberately NOT counted. They cannot be seen here anyway (ExternalFunctionCallNode
 * is built inside SymbolTableTraversal, which runs after this pass), and they do not need to be: an external
 * call mutates the CALLEE's state, never the proxy's, so it has nothing to delegate.
 */
function hasBareStateWrite(fn: FunctionDefinitionNode, stateNames: ReadonlySet<string>): boolean {
  if (stateNames.size === 0) return false;
  // Auto-marking runs before SymbolTableTraversal rewrites an unqualified Solidity `value = next` to
  // StateAssignNode, and a bare single-key `m[k] = v` to MappingAssignNode. Resolve only these narrow bare
  // shapes here, respecting parameter/local shadowing; the normal semantic pass remains the authority for the
  // compiled write itself.
  const scan = (statements: readonly StatementNode[] | undefined, locals: Set<string>): boolean => {
    for (const statement of statements ?? []) {
      if (statement instanceof VariableDefinitionNode) {
        locals.add(statement.name);
      } else if (statement instanceof TupleAssignmentNode) {
        for (const element of statement.elements) {
          if (element.name && element.type && !element.existing) locals.add(element.name);
        }
      } else if (statement instanceof AssignNode) {
        if (stateNames.has(statement.identifier.name) && !locals.has(statement.identifier.name)) return true;
      } else if (statement instanceof ArrayAssignNode || statement instanceof ArrayDeleteNode
        || statement instanceof ArrayPushNode || statement instanceof ArrayPopNode) {
        // Bare `m[k] = v`, `delete m[k]`, `a.push(v)`: their `this.` spellings are stateful operations already.
        if (stateNames.has(statement.name) && !locals.has(statement.name)) return true;
      } else if (statement instanceof BlockNode) {
        if (scan(statement.statements, statement.scoped ? new Set(locals) : locals)) return true;
      } else if (statement instanceof BranchNode) {
        if (scan(statement.ifBlock.statements, new Set(locals))
          || scan(statement.elseBlock?.statements, new Set(locals))) return true;
      } else if (statement instanceof TryCatchNode) {
        const tryLocals = new Set(locals);
        for (const parameter of statement.returnParameters ?? []) tryLocals.add(parameter.name);
        if (scan(statement.tryBlock.statements, tryLocals)) return true;
        for (const clause of statement.catchClauses) {
          const catchLocals = new Set(locals);
          for (const parameter of clause.parameters ?? []) catchLocals.add(parameter.name);
          if (scan(clause.block.statements, catchLocals)) return true;
        }
      } else if (statement instanceof DoWhileNode || statement instanceof WhileNode) {
        if (scan(statement.block.statements, new Set(locals))) return true;
      } else if (statement instanceof CollectionIterationNode) {
        const iterationLocals = new Set(locals);
        if (statement.keyName) iterationLocals.add(statement.keyName);
        if (statement.valueName) iterationLocals.add(statement.valueName);
        if (scan(statement.body.statements, iterationLocals)) return true;
      } else if (statement instanceof UncheckedNode) {
        if (scan(statement.block.statements, new Set(locals))) return true;
      } else if (statement instanceof SwitchNode) {
        for (const branch of statement.cases) {
          if (scan(branch.body.statements, new Set(locals))) return true;
        }
        if (scan(statement.defaultCase?.statements, new Set(locals))) return true;
      }
    }
    return false;
  };
  return scan(fn.body?.statements, new Set([
    ...fn.parameters.map((parameter) => parameter.name), ...fn.returnNames,
  ]));
}

function touchesProxyState(fn: FunctionDefinitionNode, stateNames: ReadonlySet<string>): boolean {
  return containsStatefulOperation(fn.body?.statements) || hasBareStateWrite(fn, stateNames);
}

function bodyHasUnsupportedOperation(fn: FunctionDefinitionNode): boolean {
  return walk(fn.body, new Set(), (n) => n instanceof TransferStatementNode
    || n instanceof AddressTransferStatementNode
    || n instanceof TokenContainerMethodStatementNode);
}

/** Every name mentioned anywhere in the body, used to find the internal helpers a function reaches. */
function referencedNames(fn: FunctionDefinitionNode): Set<string> {
  const names = new Set<string>();
  walk(fn.body, new Set(), (n) => {
    const candidate = n as unknown as { name?: unknown; methodName?: unknown; identifier?: { name?: unknown } };
    if (typeof candidate.name === 'string') names.add(candidate.name);
    if (typeof candidate.methodName === 'string') names.add(candidate.methodName);
    if (typeof candidate.identifier?.name === 'string') names.add(candidate.identifier.name);
    return false; // visit everything; never short-circuit
  });
  return names;
}

/**
 * The function plus every helper it can reach, transitively. Both disqualifying checks run over this rather
 * than the entry body alone: an entry point whose own body is clean can still be un-delegatable because of what
 * a helper does. Name matching is deliberately coarse (a name that merely collides with a function walks one
 * extra body); an over-match only costs a delegate build, an under-match ships a broken one.
 */
function reachableFrom(
  fn: FunctionDefinitionNode, callables: readonly FunctionDefinitionNode[],
): FunctionDefinitionNode[] {
  const visited = new Set<FunctionDefinitionNode>();
  const queue: FunctionDefinitionNode[] = [fn];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const names = referencedNames(current);
    for (const callee of callables) {
      if (!visited.has(callee) && names.has(callee.name)) queue.push(callee);
    }
  }
  return [...visited];
}

/**
 * Value transfers and token-container operations do not execute in delegate mode: the delegate input fails its
 * covenant (OP_VERIFY). This is a pre-existing limitation of the delegate codegen, reproducible with the
 * hand-written `delegate` modifier, and it poisons the whole function - a state write PLUS a transfer fails too.
 * Disqualify them so the failure is `asDelegate()` throwing at build time rather than an opaque script failure
 * at broadcast. Revisit when delegate-mode value preservation is fixed.
 */
function hasUnsupportedDelegateOperation(
  fn: FunctionDefinitionNode, callables: readonly FunctionDefinitionNode[],
): boolean {
  return reachableFrom(fn, callables).some(bodyHasUnsupportedOperation);
}

function bodyHasDelegatecall(fn: FunctionDefinitionNode): boolean {
  return walk(fn.body, new Set(), (n) => (
    n instanceof LowLevelCallNode || n instanceof LowLevelCallStatementNode
  ) && n.callMode === 'delegatecall'
    && !(n instanceof LowLevelCallStatementNode && n.synthesizedFromLibraryCall));
}

/**
 * A delegate function may not itself issue a delegatecall: that path skips every state covenant AND
 * emitDelegateSelfPreservation, leaving the contract unprotected.
 *
 * Follows helpers for the same reason the unsupported-operation check does. A delegatecall inside an internal
 * helper does not compile today (the injected delegate-index parameter is not threaded to the call site), so
 * this is currently unreachable - but if that is ever fixed, a body-local check would silently become
 * fail-open, which is the one direction this gate must never fail.
 */
function hasDelegatecall(
  fn: FunctionDefinitionNode, callables: readonly FunctionDefinitionNode[],
): boolean {
  return reachableFrom(fn, callables).some(bodyHasDelegatecall);
}

export function isDelegateEligible(
  fn: FunctionDefinitionNode, callables: readonly FunctionDefinitionNode[] = [],
  stateNames: ReadonlySet<string> = new Set(),
): boolean {
  if (!fn.isEntryPoint || fn.isFreeFunction) return false;
  // A delegate impl is reached through the proxy's own fallback dispatch, never through its own.
  if (fn.isFallback || fn.isReceive) return false;
  if (fn.modifiers.some((m) => INELIGIBLE_MODIFIERS.includes(m))) return false;
  // Corpus-compatible lowering may leave internal helpers intact until after this pass. State reached through
  // that closure belongs to the proxy just as state touched directly by the entry point does.
  if (!reachableFrom(fn, callables).some((candidate) => touchesProxyState(candidate, stateNames))) return false;
  if (hasUnsupportedDelegateOperation(fn, callables)) return false;
  if (hasDelegatecall(fn, callables)) return false;
  return true;
}

// An emitted event declared outside the contract (file level, library) is absent from its eventDefinitions but
// makes it stateful all the same, as in SymbolTableTraversal's statefulness survey.
function emitsEvent(contract: ContractNode): boolean {
  const seen = new Set<Node>();
  return [contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions]
    .some((fn) => walk(fn?.body, seen, (node) => node instanceof EmitStatementNode));
}

function isStateful(contract: ContractNode, forceStateful: boolean): boolean {
  return contract.stateVariables.length > 0 || contract.collections.length > 0
    || contract.eventDefinitions.length > 0 || contract.usesBlockhash || forceStateful || emitsEvent(contract);
}

/**
 * Push DELEGATE onto every eligible function of the primary contract. Returns the number marked; 0 means this
 * contract cannot serve as a proxy implementation and no delegate variant should be compiled for it.
 */
export default function autoMarkDelegateFunctions(ast: Ast, forceStateful = false): number {
  const contract = ast.contract;
  if (!contract || !isStateful(contract, forceStateful)) return 0;

  // Contract methods plus file-level free functions: either can host a helper that transfers.
  const callables = [...contract.functions, ...(ast.freeFunctions ?? [])];
  const stateNames = new Set([
    ...contract.stateVariables.map((state) => state.name),
    ...contract.collections.map((collection) => collection.name),
  ]);

  let marked = 0;
  for (const fn of contract.functions) {
    if (!isDelegateEligible(fn, callables, stateNames)) continue;
    fn.modifiers.push(FunctionModifier.DELEGATE);
    marked += 1;
  }
  return marked;
}
