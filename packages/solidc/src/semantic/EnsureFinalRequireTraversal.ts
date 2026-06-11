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
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { EmptyContractError, EmptyFunctionError, FinalRequireStatementError, MissingReturnError, ReturnInExternalFunctionError } from '../Errors.js';

export default class EnsureFinalRequireTraversal extends AstTraversal {
  private isStatefulContract: boolean = false;

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
      || node.eventDefinitions.length > 0;

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
      throw new EmptyContractError(node);
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

    // Validate that return statements aren't used in functions without return types
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
      ensureFinalStatementIsRequire(node.body.statements);
    }

    return node;
  }
}

function ensureFinalStatementIsRequire(statements: StatementNode[] = []): void {
  const statementsWithoutLogs = statements.filter((statement) => !(statement instanceof ConsoleStatementNode));
  const finalStatement = statementsWithoutLogs[statementsWithoutLogs.length - 1];

  if (!finalStatement) return;

  // If the final statement is a branch node, both branches need to end with a require().
  // An if-without-else is allowed if there's a preceding unconditional require (all paths validated).
  // When there's no prior require, we emit a warning: the else path bypasses all require() checks.
  // The code generator adds OP_1 when the final opcode is OP_ENDIF, so stack correctness is handled.
  if (finalStatement instanceof BranchNode) {
    if (!finalStatement.elseBlock) {
      const priorStatements = statementsWithoutLogs.slice(0, -1);
      if (!hasPriorUnconditionalRequire(priorStatements)) {
        throw new FinalRequireStatementError(finalStatement);
      }
      return;
    }
    ensureFinalStatementIsRequire(finalStatement.ifBlock.statements);
    ensureFinalStatementIsRequire(finalStatement.elseBlock.statements);
    return;
  }

  // If the final statement is a try/catch, check both the try block and all catch clauses
  if (finalStatement instanceof TryCatchNode) {
    ensureFinalStatementIsRequire(finalStatement.tryBlock.statements);
    for (const clause of finalStatement.catchClauses) {
      ensureFinalStatementIsRequire(clause.block.statements);
    }
    return;
  }

  // A loop ending a function must contain at least one require() in its body,
  // ensuring every iteration performs validation. The require() need not be the
  // last statement since Bitcoin Script executes all statements in the loop body
  // sequentially - the require() is always reached on each iteration.
  if (finalStatement instanceof DoWhileNode || finalStatement instanceof WhileNode) {
    if (!containsRequire(finalStatement.block.statements)) {
      throw new FinalRequireStatementError(finalStatement);
    }
    return;
  }

  if (finalStatement instanceof CollectionIterationNode) {
    if (!containsRequire(finalStatement.body.statements)) {
      throw new FinalRequireStatementError(finalStatement);
    }
    return;
  }

  // Unchecked blocks are transparent - check their inner statements
  if (finalStatement instanceof UncheckedNode) {
    ensureFinalStatementIsRequire(finalStatement.block.statements);
    return;
  }

  // Switch statements - check each case and default.
  // A switch without a default case is allowed if there's a preceding unconditional require.
  // Otherwise we emit a warning: unmatched values would bypass all require() checks.
  if (finalStatement instanceof SwitchNode) {
    if (!finalStatement.defaultCase) {
      const priorStatements = statementsWithoutLogs.slice(0, -1);
      if (!hasPriorUnconditionalRequire(priorStatements)) {
        throw new FinalRequireStatementError(finalStatement);
      }
      return;
    }
    for (const c of finalStatement.cases) {
      ensureFinalStatementIsRequire(c.body.statements);
    }
    ensureFinalStatementIsRequire(finalStatement.defaultCase.statements);
    return;
  }

  // The final statement needs to be a require(), assert(), or revert
  if (!(finalStatement instanceof RequireNode || finalStatement instanceof TimeOpNode
    || finalStatement instanceof RevertNode || finalStatement instanceof AssertNode)) {
    throw new FinalRequireStatementError(finalStatement);
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
    const tryReturns = allPathsReturn(finalStatement.tryBlock.statements);
    const catchesReturn = finalStatement.catchClauses.every(
      (clause) => allPathsReturn(clause.block.statements),
    );
    return tryReturns && catchesReturn;
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

function containsReturn(statements: StatementNode[] = []): boolean {
  for (const s of statements) {
    if (s instanceof ReturnNode) return true;
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

function findFirstReturn(statements: StatementNode[] = []): ReturnNode | undefined {
  for (const s of statements) {
    if (s instanceof ReturnNode) return s;
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

function containsStatefulOperation(statements: StatementNode[] = []): boolean {
  for (const s of statements) {
    if (isStatefulOp(s)) return true;
    if (s instanceof BranchNode) {
      if (containsStatefulOperation(s.ifBlock.statements)) return true;
      if (s.elseBlock && containsStatefulOperation(s.elseBlock.statements)) return true;
    }
    if (s instanceof TryCatchNode) {
      if (containsStatefulOperation(s.tryBlock.statements)) return true;
      for (const clause of s.catchClauses) {
        if (containsStatefulOperation(clause.block.statements)) return true;
      }
    }
    if (s instanceof DoWhileNode || s instanceof WhileNode) {
      if (containsStatefulOperation(s.block.statements)) return true;
    }
    if (s instanceof CollectionIterationNode) {
      if (containsStatefulOperation(s.body.statements)) return true;
    }
    if (s instanceof UncheckedNode) {
      if (containsStatefulOperation(s.block.statements)) return true;
    }
    if (s instanceof SwitchNode) {
      for (const c of s.cases) {
        if (containsStatefulOperation(c.body.statements)) return true;
      }
      if (s.defaultCase && containsStatefulOperation(s.defaultCase.statements)) return true;
    }
  }
  return false;
}
