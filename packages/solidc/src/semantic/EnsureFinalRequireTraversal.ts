import {
  ContractNode,
  ParameterNode,
  FunctionDefinitionNode,
  FunctionModifier,
  RequireNode,
  StatementNode,
  TimeOpNode,
  BranchNode,
  ConsoleStatementNode,
  TryCatchNode,
  DoWhileNode,
  WhileNode,
  CollectionIterationNode,
  StateAssignNode,
  DeleteStateNode,
  MappingAssignNode,
  MappingFieldAssignNode,
  MappingDeleteNode,
  EmitStatementNode,
  TransferStatementNode,
  AddressTransferStatementNode,
  TokenContainerMethodStatementNode,
  LowLevelCallStatementNode,
  ReturnNode,
  SourceFileNode,
  Node,
  RevertNode,
  AssertNode,
  UncheckedNode,
  SwitchNode,
  StateArrayPushNode,
  StateArrayPopNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
  SelfdestructStatementNode,
  BlockNode,
  FunctionCallNode,
  InstantiationNode,
  ExternalFunctionCallNode,
  FunctionCallStatementNode,
  AssemblyStatementNode,
} from '../ast/AST.js';
import { YulFunctionCallNode, YulNode } from '../ast/YulAST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { bareReturnIsUnguarded } from './EarlyReturnTransformation.js';
import { hasAuthorizingSignatureGuard, hasUnconditionalAuthorizingSignatureGuard, keyIsCallerChosen } from './SymbolTableTraversal.js';
import {
  EmptyFunctionError, FinalRequireStatementError, MissingReturnError, ReturnInExternalFunctionError,
  UnauthenticatedSelfdestructError, UnauthorizedLifecycleError,
} from '../Errors.js';

export default class EnsureFinalRequireTraversal extends AstTraversal {
  private isStatefulContract: boolean = false;
  private neverReturn = new Set<string>();

  constructor(
    private enforceFinalRequire: boolean = true,
    private allowUnsafeOperations: boolean = false,
    private lifecycleAuthorization: boolean = true,
  ) {
    super();
  }

  visitSourceFile(node: SourceFileNode): Node {
    this.neverReturn = collectNeverReturnNames(node.freeFunctions);
    for (const func of node.freeFunctions) {
      this.visitFunctionDefinition(func);
    }
    node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): ContractNode {
    const hasStatefulOperations = (node as ContractNode & { hasStatefulOperations?: boolean })
      .hasStatefulOperations;
    this.isStatefulContract = node.stateVariables.length > 0
      || node.collections.length > 0
      || node.eventDefinitions.length > 0
      || node.deploysWithValue
      // A zero-state factory is still stateful: its inferred/explicit deploy entry point emits a child genesis
      // block and receives the generated deploy covenant even though the parent has no data NFT of its own.
      || node.functions.some((func) => func.modifiers.includes(FunctionModifier.DEPLOY))
      // Zero-storage routers are likewise stateful execution participants: typed calls, transfers, and other
      // transaction effects are verified by generated covenants even though no parent data NFT exists.
      || (hasStatefulOperations
        ?? node.functions.some((func) => containsStatefulOperation(func.body?.statements)))
      || node.functions.some((func) => func.modifiers.includes(FunctionModifier.SELFDESTRUCT));

    node.parameters = this.visitList(node.parameters) as ParameterNode[];
    if (node.constructorDef) {
      node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    }
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];

    if (node.fallbackDef) {
      node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    }
    if (node.receiveDef) {
      node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    }

    if (node.functions.length === 0 && !node.fallbackDef && !node.receiveDef && !node.isAbstract) {
      // State-publishing contract: no spending path. Allowed, but warn that it is unspendable.
      console.log(
        `Warning: contract '${node.name}' has no functions; it compiles to an unspendable locking script. `
        + 'Funds sent to it cannot be recovered and the output just bloats the UTXO set. '
        + 'This is only useful for publishing immutable state on-chain.',
      );
    }

    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): FunctionDefinitionNode {
    // Abstract functions have no body - skip validation
    if (node.isAbstract) return node;

    node.parameters = this.visitList(node.parameters) as ParameterNode[];
    node.body = this.visit(node.body);

    if (node.body.statements === undefined || node.body.statements.length === 0) {
      // Constructors are allowed to have empty bodies (e.g. when only invoking parent constructors)
      if (node.name === '__construct') return node;
      throw new EmptyFunctionError(node);
    }

    // The selfdestruct value pins protect HOW MUCH reaches the destination, not WHO it is. Reject a
    // caller-controlled destination unless the function is authenticated (see helper).
    checkUnauthenticatedSelfdestruct(node, this.allowUnsafeOperations);

    // An upgrade swaps in caller-supplied bytecode and a deploy emits a child from caller-supplied arguments;
    // either must authenticate against a key the caller cannot choose or it is a permissionless takeover.
    // The rule holds in message-bus builds too: a route does not add a trusted key the source omitted.
    checkLifecycleAuthorization(node, this.allowUnsafeOperations, this.lifecycleAuthorization);

    const visibility = node.visibility;
    const hasReturnTypes = node.returnTypes.length > 0;

    // Internal/private/free functions with return types: validate return on all paths
    if ((visibility === 'internal' || visibility === 'private' || node.isFreeFunction) && hasReturnTypes) {
      if (!allPathsReturn(node.body.statements, this.neverReturn)) {
        throw new MissingReturnError(node);
      }
      return node;
    }

    // Internal/private/free void functions: no final require needed
    if (visibility === 'internal' || visibility === 'private' || node.isFreeFunction) {
      return node;
    }

    // A bare `return;` (void early exit) in an entry-point function is permitted: EarlyReturnTransformation
    // (which runs later) nests it to a tail no-op, so codegen handles it. A `return value;` in a function
    // without return types is still invalid (nothing to return).
    if (!hasReturnTypes && containsReturn(node.body.statements)) {
      throw new ReturnInExternalFunctionError(findFirstReturn(node.body.statements)!);
    }

    // Entry-point functions with return types: the function body can end with return
    // (the code generator adds covenant verification automatically after return value encoding)
    if ((visibility === 'public' || visibility === 'external') && hasReturnTypes) {
      // A split mutating entry publishes its result from the facet input. Its root input only authenticates and
      // executes that delegate; it deliberately retains the logical return ABI/layout without fabricating a
      // second stack value or return-event output. Only the compiler can set this marker.
      if (node.splitDelegateReturnForwarder) return node;
      if (!allPathsReturn(node.body.statements, this.neverReturn)) {
        throw new MissingReturnError(node);
      }
      return node;
    }

    // For external/public entry-point functions: keep existing behavior
    // Stateful functions with state writes or emits get auto-covenant EQUALVERIFY at the end,
    // so they satisfy the final-require check.
    // Exception: selfdestruct functions skip ALL covenant code generation, so stateful ops
    // alone provide no security. Selfdestruct functions MUST have explicit require().
    const isSelfdestruct = node.modifiers.includes(FunctionModifier.SELFDESTRUCT);
    const hasStateWrites = this.isStatefulContract
      && !isSelfdestruct
      && containsStatefulOperation(node.body.statements);

    if (!hasStateWrites) {
      // selfdestruct functions skip all covenant codegen, so a missing require() means any caller can trigger
      // the destruction. Keep that a hard error regardless of enforceFinalRequire (the general no-verification
      // path is only a warning by default). The selfdestruct statement itself does not authorize the destruction.
      // Message-bus/kernel routes classify a lifecycle handler as ineligible instead of rejecting it, so there the
      // selfdestruct statement is terminal and the classifier runs.
      ensureFinalStatementIsRequire(
        node.body.statements,
        this.enforceFinalRequire || (isSelfdestruct && !this.allowUnsafeOperations),
        !isSelfdestruct || !this.lifecycleAuthorization,
      );
    }

    return node;
  }
}

/**
 * Cheap-admission fail-fast: returning free/library helpers whose source already has an uncovered path
 * (OZ Address.verifyCallResultFromTarget's `_revert` arm) throw here instead of after journal/memory
 * lowering. Public-only rungs prune those helpers first, so they do not refuse. Helpers that only become
 * covered after later lowering are not cheap-admission; the full EnsureFinalRequire pass still runs.
 */
export function rejectFreeFunctionMissingReturns(ast: SourceFileNode): void {
  const neverReturn = collectNeverReturnNames(ast.freeFunctions ?? []);
  for (const fn of ast.freeFunctions ?? []) {
    if (fn.isAbstract || !fn.body || fn.returnTypes.length === 0) continue;
    if (!allPathsReturn(fn.body.statements, neverReturn)) throw new MissingReturnError(fn);
  }
}

/**
 * Whether a function with return types can still fall off its end, judged the way this pass judges it once the
 * program is lowered. Inline assembly does not count as terminating here: LowerInlineAssembly turns a Yul `revert`
 * into `require(false)` before this pass runs, and that is no terminator to it. NamedReturnTransformation's
 * fall-through default asks this which functions it has to complete. `freeFunctions` supply the helpers that never
 * return, as they do for the pass itself.
 */
export function fallsOffEndCheck(freeFunctions: FunctionDefinitionNode[]): (fn: FunctionDefinitionNode) => boolean {
  const neverReturn = collectNeverReturnNames(freeFunctions, false);
  return (fn) => !allPathsReturn(fn.body?.statements, neverReturn, false);
}

// A path with no verification (no require/assert/revert/timeop) and no state change compiles as
// unconditionally-spendable (codegen ends it with OP_1). This is a hard error by default; callers must
// explicitly disable enforceFinalRequire to permit it, in which case the compiler still emits a warning.
function warnOrThrowUnverified(node: Node, strict: boolean): void {
  if (strict) throw new FinalRequireStatementError(node);
  const line = node.location?.start?.line;
  console.log(`Warning: a spending path${line ? ` near line ${line}` : ''} performs no require()/verification `
    + 'and changes no state; it compiles as an unconditionally-spendable path. Add a require() to constrain it.');
}

// selfdestruct(addr) value-pins the freed balance to outputs[0] == addr, but addr is whatever the covenant
// reads. If addr is caller-controlled (a function parameter) AND the function has no signature check, ANY
// caller can pass their own address and take the balance. The two safe forms - authenticate the function, or
// take the destination from contract state / a constant - are admitted. Caller-controlled unauthenticated
// destinations are rejected by default; the explicit unsafe compiler option retains a warning-only escape.
//
// SEC-16: "has a signature check" is not the question - a signature check authenticates only the holder of the
// KEY it checks, so `require(checkSig(s, pk))` with a caller-supplied `pk` authorizes nobody and must not
// silence this. Reuse SEC-12's hasAuthorizingSignatureGuard, which credits a guard only when the key is one
// the caller cannot choose (constructor input, state variable, literal, contract const).
function checkUnauthenticatedSelfdestruct(node: FunctionDefinitionNode, allowUnsafe: boolean): void {
  const selfdestructs = (node.body.statements ?? [])
    .filter((s): s is SelfdestructStatementNode => s instanceof SelfdestructStatementNode);
  if (selfdestructs.length === 0) return;

  if (hasAuthorizingSignatureGuard(node, 'selfdestruct')) return;

  for (const sd of selfdestructs) {
    if (!keyIsCallerChosen(sd.recipient, node)) continue; // destination is from state / a constant - safe

    if (!allowUnsafe) throw new UnauthenticatedSelfdestructError(sd, node.name);

    const line = sd.location?.start?.line;
    console.log(`Warning: selfdestruct in '${node.name}'${line ? ` at line ${line}` : ''} sends the freed `
      + 'balance to a caller-supplied address with no signature check; any caller could redirect it to '
      + 'themselves. Authenticate it (e.g. require(checkSig(s, owner))) or take the destination from contract '
      + 'state / a constant (selfdestruct(this.beneficiary)). See packages/solidc/docs/selfdestruct.md.');
    return; // one warning per function is enough
  }
}

/**
 * Lifecycle entries change what the contract IS rather than one state field: `upgrade` replaces its bytecode with
 * a caller-supplied witness, `deploy` emits a child genesis from caller-supplied arguments, and `split`/`merge`
 * fork/consolidate its NFT threads. Each skips the ordinary final-require rule because its covenant verifies the
 * transition output/topology, not who triggered it, so a body without a trusted-key signature check is a
 * permissionless takeover or topology manipulation. Require an unconditional trusted-key check by default; the
 * explicit unsafe compiler option retains a warning-only escape (mirroring selfdestruct).
 */
function checkLifecycleAuthorization(node: FunctionDefinitionNode, allowUnsafe: boolean, enabled: boolean): void {
  if (!enabled) return;
  const isUpgrade = node.modifiers.includes(FunctionModifier.UPGRADE);
  const isDeploy = node.modifiers.includes(FunctionModifier.DEPLOY);
  const isSplit = node.modifiers.includes(FunctionModifier.SPLIT);
  const isMerge = node.modifiers.includes(FunctionModifier.MERGE);
  if (!isUpgrade && !isDeploy && !isSplit && !isMerge) return;

  if (hasUnconditionalAuthorizingSignatureGuard(node)) return;

  const kind = isUpgrade ? 'upgrade' : isDeploy ? 'deploy' : isSplit ? 'split' : 'merge';
  if (!allowUnsafe) throw new UnauthorizedLifecycleError(node, node.name, kind);

  const line = node.location?.start?.line;
  console.log(`Warning: ${kind} in '${node.name}'${line ? ` at line ${line}` : ''} has no trusted-key signature `
    + 'check; any caller can change the contract\'s lifecycle without authorization. Add require(checkSig(s, '
    + 'owner)) with a key the caller cannot choose.');
}

function ensureFinalStatementIsRequire(
  statements: StatementNode[] = [], strict = false, selfdestructIsTerminal = true,
): void {
  const statementsWithoutLogs = statements.filter((statement) => !(statement instanceof ConsoleStatementNode));
  const finalStatement = statementsWithoutLogs[statementsWithoutLogs.length - 1];

  if (!finalStatement) return;

  // A bare return before the only require ends that path with success. The later require does not gate it.
  if (bareReturnIsUnguarded(statementsWithoutLogs)) {
    const returning = statementsWithoutLogs.find((statement) => statement instanceof ReturnNode
      || statement instanceof BranchNode) ?? finalStatement;
    warnOrThrowUnverified(returning, strict);
    return;
  }

  // An unconditional require/assert/revert/timeop anywhere in this scope gates the whole path (codegen
  // appends OP_1 after trailing statements), so the path is verified even when it doesn't END in a require
  // - e.g. Solidity's `require(authorized); _mint(...)`. Generalizes the if-without-else case.
  if (hasPriorUnconditionalRequire(statementsWithoutLogs)) return;

  // If the final statement is a branch node, both branches need to end with a require().
  // An if-without-else without a preceding unconditional require leaves the else path unverified.
  if (finalStatement instanceof BranchNode) {
    if (!finalStatement.elseBlock) {
      warnOrThrowUnverified(finalStatement, strict);
      return;
    }
    ensureFinalStatementIsRequire(finalStatement.ifBlock.statements, strict);
    ensureFinalStatementIsRequire(finalStatement.elseBlock.statements, strict);
    return;
  }

  // If the final statement is a try/catch, check both the try block and all catch clauses
  if (finalStatement instanceof TryCatchNode) {
    ensureFinalStatementIsRequire(finalStatement.tryBlock.statements, strict);
    for (const clause of finalStatement.catchClauses) {
      ensureFinalStatementIsRequire(clause.block.statements, strict);
    }
    return;
  }

  // A loop ending a function must perform validation on EVERY iteration. A require inside a conditional branch of
  // the loop body is only reached on some iterations, so it does not gate the whole path. Accept an unconditional
  // require at the loop-body top level (or in a transparent unchecked block), or a final statement that gates every
  // path (if/else, switch-with-default, try/catch whose arms all validate). An if-without-else stays rejected.
  if (finalStatement instanceof DoWhileNode || finalStatement instanceof WhileNode) {
    if (!loopBodyValidatesEveryIteration(finalStatement.block.statements)) {
      warnOrThrowUnverified(finalStatement, strict);
    }
    return;
  }

  if (finalStatement instanceof CollectionIterationNode) {
    if (!loopBodyValidatesEveryIteration(finalStatement.body.statements)) {
      warnOrThrowUnverified(finalStatement, strict);
    }
    return;
  }

  // Unchecked blocks are transparent - check their inner statements
  if (finalStatement instanceof UncheckedNode) {
    ensureFinalStatementIsRequire(finalStatement.block.statements, strict);
    return;
  }

  // Switch statements - check each case and default.
  // A switch without a default case (and no preceding unconditional require) leaves unmatched values unverified.
  if (finalStatement instanceof SwitchNode) {
    if (!finalStatement.defaultCase) {
      warnOrThrowUnverified(finalStatement, strict);
      return;
    }
    for (const c of finalStatement.cases) {
      ensureFinalStatementIsRequire(c.body.statements, strict);
    }
    ensureFinalStatementIsRequire(finalStatement.defaultCase.statements, strict);
    return;
  }

  // The final statement needs to be a require(), assert(), revert, or selfdestruct. selfdestruct halts the
  // contract (a terminal like revert), so it ends a path validly; the caller-controlled-destination risk is
  // surfaced separately by warnUnauthenticatedSelfdestruct. For a selfdestruct ENTRY itself, the selfdestruct
  // statement does not authorize the destruction (selfdestructIsTerminal is false), so an explicit require is
  // required above.
  if (!(finalStatement instanceof RequireNode || finalStatement instanceof TimeOpNode
    || finalStatement instanceof RevertNode || finalStatement instanceof AssertNode
    || (selfdestructIsTerminal && finalStatement instanceof SelfdestructStatementNode))) {
    warnOrThrowUnverified(finalStatement, strict);
  }
}

/**
 * Check if a list of statements contains at least one unconditional require/assert/revert/timeop.
 * "Unconditional" means it appears directly in the statement list (not nested inside
 * if/else/loop), guaranteeing it executes on every code path through this scope.
 */
function hasPriorUnconditionalRequire(statements: StatementNode[] = []): boolean {
  for (const s of statements) {
    if (s instanceof RequireNode || s instanceof TimeOpNode
      || s instanceof RevertNode || s instanceof AssertNode) return true;
    // An unchecked block is transparent - check inner statements
    if (s instanceof UncheckedNode) {
      if (hasPriorUnconditionalRequire(s.block.statements ?? [])) return true;
    }
  }
  return false;
}

/**
 * Whether a terminal loop body validates on every iteration. True when any top-level statement gates every path:
 * a require/assert/revert/timeop/selfdestruct, an if/else, a switch-with-default, or a try/catch whose arms all
 * do. An if-without-else - a require reached only on some iterations (finding F3) - stays false.
 */
function loopBodyValidatesEveryIteration(statements: StatementNode[] = []): boolean {
  for (const s of statements) {
    if (s instanceof ConsoleStatementNode) continue;
    if (everyPathValidates(s)) return true;
  }
  return false;
}

function everyPathValidates(statement: StatementNode): boolean {
  if (statement instanceof RequireNode || statement instanceof TimeOpNode
    || statement instanceof RevertNode || statement instanceof AssertNode
    || statement instanceof SelfdestructStatementNode) return true;
  if (statement instanceof UncheckedNode) {
    return loopBodyValidatesEveryIteration(statement.block.statements ?? []);
  }
  if (statement instanceof BranchNode) {
    return statement.elseBlock !== undefined
      && loopBodyValidatesEveryIteration(statement.ifBlock.statements ?? [])
      && loopBodyValidatesEveryIteration(statement.elseBlock.statements ?? []);
  }
  if (statement instanceof SwitchNode) {
    if (!statement.defaultCase) return false;
    return statement.cases.every((c) => loopBodyValidatesEveryIteration(c.body.statements ?? []))
      && loopBodyValidatesEveryIteration(statement.defaultCase.statements ?? []);
  }
  if (statement instanceof TryCatchNode) {
    return loopBodyValidatesEveryIteration(statement.tryBlock.statements ?? [])
      && statement.catchClauses.every((clause) => loopBodyValidatesEveryIteration(clause.block.statements ?? []));
  }
  if (statement instanceof DoWhileNode || statement instanceof WhileNode) {
    return loopBodyValidatesEveryIteration(statement.block.statements ?? []);
  }
  if (statement instanceof CollectionIterationNode) {
    return loopBodyValidatesEveryIteration(statement.body.statements ?? []);
  }
  return false;
}

function isStatefulOp(s: StatementNode): boolean {
  return s instanceof StateAssignNode || s instanceof DeleteStateNode || s instanceof MappingAssignNode
    || s instanceof MappingFieldAssignNode || s instanceof MappingDeleteNode || s instanceof EmitStatementNode
    || s instanceof TransferStatementNode || s instanceof AddressTransferStatementNode
    || s instanceof TokenContainerMethodStatementNode || s instanceof LowLevelCallStatementNode
    || s instanceof StateArrayPushNode || s instanceof StateArrayPopNode
    || s instanceof StateArrayAssignNode || s instanceof StateArrayDeleteNode;
}

function yulContainsRevert(node: unknown, seen = new WeakSet<object>()): boolean {
  if (!node || typeof node !== 'object' || seen.has(node as object)) return false;
  seen.add(node as object);
  if (node instanceof YulFunctionCallNode && node.name === 'revert') return true;
  if (node instanceof YulNode) {
    for (const value of Object.values(node)) {
      if (Array.isArray(value) && value.some((item) => yulContainsRevert(item, seen))) return true;
      if (value && typeof value === 'object' && yulContainsRevert(value, seen)) return true;
    }
  }
  return false;
}

function callNeverReturns(name: string, neverReturn: Set<string>): boolean {
  const simple = name.split('.').pop() ?? name;
  return neverReturn.has(name) || neverReturn.has(simple) || simple === '_revert';
}

function isTerminatingStatement(
  statement: StatementNode, neverReturn: Set<string>, assemblyTerminates = true,
): boolean {
  if (statement instanceof ReturnNode || statement instanceof RevertNode) return true;
  if (statement instanceof AssemblyStatementNode && assemblyTerminates) {
    if (/\brevert\b/i.test(statement.assemblyBody)) return true;
    if (statement.yulBlock && yulContainsRevert(statement.yulBlock)) return true;
  }
  if (statement instanceof FunctionCallStatementNode) {
    return callNeverReturns(statement.call.identifier.name, neverReturn);
  }
  if (statement instanceof BranchNode) {
    return allPathsTerminate(statement.ifBlock.statements, neverReturn, assemblyTerminates)
      && (statement.elseBlock !== undefined
        && allPathsTerminate(statement.elseBlock.statements, neverReturn, assemblyTerminates));
  }
  if (statement instanceof UncheckedNode) {
    return allPathsTerminate(statement.block.statements ?? [], neverReturn, assemblyTerminates);
  }
  if (statement instanceof BlockNode) {
    return allPathsTerminate(statement.statements ?? [], neverReturn, assemblyTerminates);
  }
  if (statement instanceof SwitchNode) {
    if (!statement.defaultCase) return false;
    return statement.cases.every((c) => allPathsTerminate(c.body.statements, neverReturn, assemblyTerminates))
      && allPathsTerminate(statement.defaultCase.statements, neverReturn, assemblyTerminates);
  }
  return false;
}

function allPathsTerminate(
  statements: StatementNode[] = [], neverReturn: Set<string> = new Set(), assemblyTerminates = true,
): boolean {
  const statementsWithoutLogs = statements.filter((s) => !(s instanceof ConsoleStatementNode));
  if (statementsWithoutLogs.length === 0) return false;
  const last = statementsWithoutLogs[statementsWithoutLogs.length - 1];
  return isTerminatingStatement(last, neverReturn, assemblyTerminates);
}

function collectNeverReturnNames(functions: FunctionDefinitionNode[], assemblyTerminates = true): Set<string> {
  const neverReturn = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const fn of functions) {
      if (!fn.body || neverReturn.has(fn.name)) continue;
      if (allPathsTerminate(fn.body.statements, neverReturn, assemblyTerminates)) {
        neverReturn.add(fn.name);
        const simple = fn.name.split('.').pop();
        if (simple) neverReturn.add(simple);
        grew = true;
      }
    }
  }
  return neverReturn;
}

function allPathsReturn(
  statements: StatementNode[] = [], neverReturn: Set<string> = new Set(), assemblyTerminates = true,
): boolean {
  const statementsWithoutLogs = statements.filter((s) => !(s instanceof ConsoleStatementNode));
  if (statementsWithoutLogs.length === 0) return false;

  // Once a top-level statement terminates on every path, everything after it is unreachable and cannot turn a
  // returning function into a fall-through function. In particular, journal lowering may insert flushes before
  // `return` while leaving an author-written dead require after it for the later dead-code transform to remove.
  // Validate the reachable prefix rather than choosing the syntactically final statement unconditionally.
  const firstTerminal = statementsWithoutLogs.findIndex((statement) =>
    isTerminatingStatement(statement, neverReturn, assemblyTerminates));
  if (firstTerminal >= 0 && firstTerminal < statementsWithoutLogs.length - 1) return true;

  const finalStatement = statementsWithoutLogs[statementsWithoutLogs.length - 1];

  if (finalStatement instanceof ReturnNode) return true;
  if (isTerminatingStatement(finalStatement, neverReturn, assemblyTerminates)) return true;

  if (finalStatement instanceof BranchNode) {
    const ifReturns = allPathsReturn(finalStatement.ifBlock.statements, neverReturn, assemblyTerminates);
    const elseReturns = finalStatement.elseBlock
      ? allPathsReturn(finalStatement.elseBlock.statements, neverReturn, assemblyTerminates)
      : false;
    return ifReturns && elseReturns;
  }

  if (finalStatement instanceof TryCatchNode) {
    // BCH script failure is fatal, so catch clauses are dead code (SymbolTableTraversal emits the corresponding
    // compatibility warning and codegen compiles only the try path). A successful try is therefore the only
    // continuing path whose return behavior matters; a failed try never falls through this function.
    return allPathsReturn(finalStatement.tryBlock.statements, neverReturn, assemblyTerminates);
  }

  if (finalStatement instanceof UncheckedNode) {
    return allPathsReturn(finalStatement.block.statements ?? [], neverReturn, assemblyTerminates);
  }

  if (finalStatement instanceof BlockNode) {
    return allPathsReturn(finalStatement.statements ?? [], neverReturn, assemblyTerminates);
  }

  if (finalStatement instanceof SwitchNode) {
    if (!finalStatement.defaultCase) return false;
    const casesReturn = finalStatement.cases
      .every((c) => allPathsReturn(c.body.statements, neverReturn, assemblyTerminates));
    const defaultReturns = allPathsReturn(finalStatement.defaultCase.statements, neverReturn, assemblyTerminates);
    return casesReturn && defaultReturns;
  }

  return false;
}

// Whether any VALUED return (`return x;`) appears - invalid in a function without return types. A bare
// `return;` (void early exit) is allowed and ignored here.
function containsReturn(statements: StatementNode[] = []): boolean {
  for (const s of statements) {
    if (s instanceof ReturnNode && s.expressions.length > 0 && !s.isYulReturn) return true;
    if (s instanceof BranchNode) {
      if (containsReturn(s.ifBlock.statements)) return true;
      if (s.elseBlock && containsReturn(s.elseBlock.statements)) return true;
    }
    if (s instanceof TryCatchNode) {
      if (containsReturn(s.tryBlock.statements)) return true;
      for (const clause of s.catchClauses) {
        if (containsReturn(clause.block.statements)) return true;
      }
    }
    if (s instanceof DoWhileNode || s instanceof WhileNode) {
      if (containsReturn(s.block.statements)) return true;
    }
    if (s instanceof CollectionIterationNode) {
      if (containsReturn(s.body.statements)) return true;
    }
    if (s instanceof UncheckedNode) {
      if (containsReturn(s.block.statements)) return true;
    }
    if (s instanceof SwitchNode) {
      for (const c of s.cases) {
        if (containsReturn(c.body.statements)) return true;
      }
      if (s.defaultCase && containsReturn(s.defaultCase.statements)) return true;
    }
  }
  return false;
}

// The first VALUED return (`return x;`), for error location. Bare `return;` is skipped.
function findFirstReturn(statements: StatementNode[] = []): ReturnNode | undefined {
  for (const s of statements) {
    if (s instanceof ReturnNode && s.expressions.length > 0 && !s.isYulReturn) return s;
    if (s instanceof BranchNode) {
      const found = findFirstReturn(s.ifBlock.statements)
        || (s.elseBlock ? findFirstReturn(s.elseBlock.statements) : undefined);
      if (found) return found;
    }
    if (s instanceof TryCatchNode) {
      const found = findFirstReturn(s.tryBlock.statements);
      if (found) return found;
      for (const clause of s.catchClauses) {
        const found2 = findFirstReturn(clause.block.statements);
        if (found2) return found2;
      }
    }
    if (s instanceof DoWhileNode || s instanceof WhileNode) {
      const found = findFirstReturn(s.block.statements);
      if (found) return found;
    }
    if (s instanceof CollectionIterationNode) {
      const found = findFirstReturn(s.body.statements);
      if (found) return found;
    }
    if (s instanceof UncheckedNode) {
      const found = findFirstReturn(s.block.statements);
      if (found) return found;
    }
    if (s instanceof SwitchNode) {
      for (const c of s.cases) {
        const found = findFirstReturn(c.body.statements);
        if (found) return found;
      }
      if (s.defaultCase) {
        const found = findFirstReturn(s.defaultCase.statements);
        if (found) return found;
      }
    }
  }
  return undefined;
}

const STATEFUL_CALL_WALK_SKIP = new Set([
  'location', 'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
  'referencedContract', 'stateVariable', 'collection',
]);

/** Follow resolved internal/self calls so an entry point is not mistaken for an unverified no-op when its
 * state covenant is supplied by a helper. Cross-reference fields are skipped to keep the AST walk finite. */
function containsStatefulCall(
  node: Node, seenFunctions: Set<FunctionDefinitionNode>, seenNodes: Set<Node> = new Set(),
): boolean {
  if (seenNodes.has(node)) return false;
  seenNodes.add(node);
  // A stateful `new Child(...)` emits and covenant-pins a child genesis block even when it is nested in a
  // variable declaration rather than represented as a statement of its own. In particular, this is the only
  // stateful operation in an implied-deploy function on a zero-state parent.
  if (node instanceof InstantiationNode && node.isStatefulDeploy) return true;
  // Typed external calls are authenticated by the generated co-spend/identity covenant. They commonly sit
  // inside a loop as MethodCallStatementNode -> ExternalFunctionCallNode, so looking only at statement classes
  // misclassifies an otherwise verified entry point as an unguarded no-op.
  if (node instanceof ExternalFunctionCallNode) return true;
  if (node instanceof FunctionCallNode && node.resolvedFunction && !seenFunctions.has(node.resolvedFunction)) {
    seenFunctions.add(node.resolvedFunction);
    if (containsStatefulOperation(node.resolvedFunction.body?.statements, seenFunctions)) return true;
  }
  for (const key in node) {
    if (STATEFUL_CALL_WALK_SKIP.has(key)) continue;
    const value = node[key as keyof Node];
    if (value instanceof Node && containsStatefulCall(value, seenFunctions, seenNodes)) return true;
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child instanceof Node && containsStatefulCall(child, seenFunctions, seenNodes)) return true;
      }
    }
  }
  return false;
}

export function containsStatefulOperation(
  statements: StatementNode[] = [], seenFunctions: Set<FunctionDefinitionNode> = new Set(),
): boolean {
  for (const s of statements) {
    if (isStatefulOp(s)) return true;
    if (containsStatefulCall(s, seenFunctions)) return true;
    if (s instanceof BlockNode && containsStatefulOperation(s.statements, seenFunctions)) return true;
    if (s instanceof BranchNode) {
      if (containsStatefulOperation(s.ifBlock.statements, seenFunctions)) return true;
      if (s.elseBlock && containsStatefulOperation(s.elseBlock.statements, seenFunctions)) return true;
    }
    if (s instanceof TryCatchNode) {
      if (containsStatefulOperation(s.tryBlock.statements, seenFunctions)) return true;
      for (const clause of s.catchClauses) {
        if (containsStatefulOperation(clause.block.statements, seenFunctions)) return true;
      }
    }
    if (s instanceof DoWhileNode || s instanceof WhileNode) {
      if (containsStatefulOperation(s.block.statements, seenFunctions)) return true;
    }
    if (s instanceof CollectionIterationNode) {
      if (containsStatefulOperation(s.body.statements, seenFunctions)) return true;
    }
    if (s instanceof UncheckedNode) {
      if (containsStatefulOperation(s.block.statements, seenFunctions)) return true;
    }
    if (s instanceof SwitchNode) {
      for (const c of s.cases) {
        if (containsStatefulOperation(c.body.statements, seenFunctions)) return true;
      }
      if (s.defaultCase && containsStatefulOperation(s.defaultCase.statements, seenFunctions)) return true;
    }
  }
  return false;
}
