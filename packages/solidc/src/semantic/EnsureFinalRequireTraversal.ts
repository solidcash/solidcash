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
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { hasAuthorizingSignatureGuard, keyIsCallerChosen } from './SymbolTableTraversal.js';
import {
  EmptyFunctionError, FinalRequireStatementError, MissingReturnError, ReturnInExternalFunctionError,
  UnauthenticatedSelfdestructError,
} from '../Errors.js';

export default class EnsureFinalRequireTraversal extends AstTraversal {
  private isStatefulContract: boolean = false;

  constructor(
    private enforceFinalRequire: boolean = true,
    private allowUnsafeOperations: boolean = false,
  ) {
    super();
  }

  visitSourceFile(node: SourceFileNode): Node {
    for (const func of node.freeFunctions) {
      this.visitFunctionDefinition(func);
    }
    node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): ContractNode {
    this.isStatefulContract = node.stateVariables.length > 0
      || node.collections.length > 0
      || node.eventDefinitions.length > 0
      || node.deploysWithValue
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

    const visibility = node.visibility;
    const hasReturnTypes = node.returnTypes.length > 0;

    // Internal/private/free functions with return types: validate return on all paths
    if ((visibility === 'internal' || visibility === 'private' || node.isFreeFunction) && hasReturnTypes) {
      if (!allPathsReturn(node.body.statements)) {
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
      if (!allPathsReturn(node.body.statements)) {
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
      // path is only a warning by default).
      ensureFinalStatementIsRequire(node.body.statements, this.enforceFinalRequire || isSelfdestruct);
    }

    return node;
  }
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

  if (hasAuthorizingSignatureGuard(node)) return;

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

function ensureFinalStatementIsRequire(statements: StatementNode[] = [], strict = false): void {
  const statementsWithoutLogs = statements.filter((statement) => !(statement instanceof ConsoleStatementNode));
  const finalStatement = statementsWithoutLogs[statementsWithoutLogs.length - 1];

  if (!finalStatement) return;

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

  // A loop ending a function must contain at least one require() in its body,
  // ensuring every iteration performs validation. The require() need not be the
  // last statement since Bitcoin Script executes all statements in the loop body
  // sequentially - the require() is always reached on each iteration.
  if (finalStatement instanceof DoWhileNode || finalStatement instanceof WhileNode) {
    if (!containsRequire(finalStatement.block.statements)) {
      warnOrThrowUnverified(finalStatement, strict);
    }
    return;
  }

  if (finalStatement instanceof CollectionIterationNode) {
    if (!containsRequire(finalStatement.body.statements)) {
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
  // surfaced separately by warnUnauthenticatedSelfdestruct.
  if (!(finalStatement instanceof RequireNode || finalStatement instanceof TimeOpNode
    || finalStatement instanceof RevertNode || finalStatement instanceof AssertNode
    || finalStatement instanceof SelfdestructStatementNode)) {
    warnOrThrowUnverified(finalStatement, strict);
  }
}

/**
 * Check if a list of statements contains at least one unconditional require/assert/revert/timeop.
 * "Unconditional" means it appears directly in the statement list (not nested inside
 * if/else/loop), guaranteeing it executes on every code path through this scope.
 */
function hasPriorUnconditionalRequire(statements: StatementNode[]): boolean {
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

function containsRequire(statements: StatementNode[] = []): boolean {
  for (const s of statements) {
    if (s instanceof RequireNode || s instanceof TimeOpNode
      || s instanceof RevertNode || s instanceof AssertNode) return true;
    if (s instanceof BranchNode) {
      if (containsRequire(s.ifBlock.statements)) return true;
      if (s.elseBlock && containsRequire(s.elseBlock.statements)) return true;
    }
    if (s instanceof TryCatchNode) {
      if (containsRequire(s.tryBlock.statements)) return true;
      for (const clause of s.catchClauses) {
        if (containsRequire(clause.block.statements)) return true;
      }
    }
    if (s instanceof DoWhileNode || s instanceof WhileNode) {
      if (containsRequire(s.block.statements)) return true;
    }
    if (s instanceof CollectionIterationNode) {
      if (containsRequire(s.body.statements)) return true;
    }
    if (s instanceof UncheckedNode) {
      if (containsRequire(s.block.statements)) return true;
    }
    if (s instanceof SwitchNode) {
      for (const c of s.cases) {
        if (containsRequire(c.body.statements)) return true;
      }
      if (s.defaultCase && containsRequire(s.defaultCase.statements)) return true;
    }
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

function allPathsReturn(statements: StatementNode[] = []): boolean {
  const statementsWithoutLogs = statements.filter((s) => !(s instanceof ConsoleStatementNode));
  if (statementsWithoutLogs.length === 0) return false;

  const finalStatement = statementsWithoutLogs[statementsWithoutLogs.length - 1];

  if (finalStatement instanceof ReturnNode) return true;
  if (finalStatement instanceof RevertNode) return true;

  if (finalStatement instanceof BranchNode) {
    const ifReturns = allPathsReturn(finalStatement.ifBlock.statements);
    const elseReturns = finalStatement.elseBlock
      ? allPathsReturn(finalStatement.elseBlock.statements)
      : false;
    return ifReturns && elseReturns;
  }

  if (finalStatement instanceof TryCatchNode) {
    // BCH script failure is fatal, so catch clauses are dead code (SymbolTableTraversal emits the corresponding
    // compatibility warning and codegen compiles only the try path). A successful try is therefore the only
    // continuing path whose return behavior matters; a failed try never falls through this function.
    return allPathsReturn(finalStatement.tryBlock.statements);
  }

  if (finalStatement instanceof UncheckedNode) {
    return allPathsReturn(finalStatement.block.statements ?? []);
  }

  if (finalStatement instanceof SwitchNode) {
    if (!finalStatement.defaultCase) return false;
    const casesReturn = finalStatement.cases.every((c) => allPathsReturn(c.body.statements));
    const defaultReturns = allPathsReturn(finalStatement.defaultCase.statements);
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
  if (node instanceof FunctionCallNode && node.resolvedFunction && !seenFunctions.has(node.resolvedFunction)) {
    seenFunctions.add(node.resolvedFunction);
    if (containsStatefulOperation(node.resolvedFunction.body?.statements, seenFunctions)) return true;
  }
  for (const [key, value] of Object.entries(node)) {
    if (STATEFUL_CALL_WALK_SKIP.has(key)) continue;
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
