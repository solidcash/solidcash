import {
  SourceFileNode,
  StatementNode,
  DoWhileNode,
  WhileNode,
  BranchNode,
  BlockNode,
  BreakNode,
  ContinueNode,
  TryCatchNode,
  VariableDefinitionNode,
  AssignNode,
  IdentifierNode,
  BoolLiteralNode,
  UnaryOpNode,
  BinaryOpNode,
  ExpressionNode,
  FunctionDefinitionNode,
} from '../ast/AST.js';
import { PrimitiveType } from '@solidcash/utils';
import { UnaryOperator, BinaryOperator } from '../ast/Operator.js';
import { BreakOutsideLoopError, ContinueOutsideLoopError } from '../Errors.js';
import { Location } from '../ast/Location.js';

let breakFlagCounter = 0;

/**
 * Transforms break/continue statements into flag-based if-else structures.
 * Runs before semantic analysis so all downstream passes see normal AST.
 *
 * Break example:
 *   while (cond) { A; if (x) break; B; }
 *   ->
 *   bool csBreak0 = false;
 *   while (cond && !csBreak0) { A; if (x) { csBreak0 = true; } else { B; } }
 *
 * Continue example:
 *   while (cond) { A; if (x) continue; B; }
 *   ->
 *   while (cond) { A; if (x) { } else { B; } }
 */
export default function expandBreakContinue(ast: SourceFileNode): SourceFileNode {
  breakFlagCounter = 0;

  for (const func of ast.freeFunctions) {
    transformFunctionBody(func);
  }

  if (ast.contract.constructorDef) {
    transformFunctionBody(ast.contract.constructorDef);
  }

  for (const func of ast.contract.functions) {
    transformFunctionBody(func);
  }

  return ast;
}

function transformFunctionBody(func: FunctionDefinitionNode): void {
  if (!func.body.statements) return;
  func.body.statements = transformStatementList(func.body.statements, false);
}

/**
 * Recursively scan a statement list and transform any loops containing break/continue.
 */
function transformStatementList(
  statements: StatementNode[],
  insideLoop: boolean,
): StatementNode[] {
  const result: StatementNode[] = [];

  for (const stmt of statements) {
    if (stmt instanceof BreakNode) {
      if (!insideLoop) throw new BreakOutsideLoopError(stmt);
      // Bare break/continue at function level within a loop is handled by the loop transformer
      // This case is for stray break at function top level
      throw new BreakOutsideLoopError(stmt);
    }
    if (stmt instanceof ContinueNode) {
      if (!insideLoop) throw new ContinueOutsideLoopError(stmt);
      throw new ContinueOutsideLoopError(stmt);
    }

    if (stmt instanceof DoWhileNode) {
      result.push(
        ...transformDoWhileLoop(stmt),
      );
    } else if (stmt instanceof WhileNode) {
      result.push(
        ...transformWhileLoop(stmt),
      );
    } else if (stmt instanceof BranchNode) {
      // Recurse into branch blocks (but break/continue outside loops is an error)
      const newIf = cloneBranch(stmt);
      if (newIf.ifBlock.statements) {
        newIf.ifBlock.statements = transformStatementList(newIf.ifBlock.statements, insideLoop);
      }
      if (newIf.elseBlock?.statements) {
        newIf.elseBlock.statements = transformStatementList(newIf.elseBlock.statements, insideLoop);
      }
      result.push(newIf);
    } else if (stmt instanceof TryCatchNode) {
      // Recurse into try block
      if (stmt.tryBlock.statements) {
        stmt.tryBlock.statements = transformStatementList(stmt.tryBlock.statements, insideLoop);
      }
      // Recurse into catch blocks
      for (const clause of stmt.catchClauses) {
        if (clause.block.statements) {
          clause.block.statements = transformStatementList(clause.block.statements, insideLoop);
        }
      }
      result.push(stmt);
    } else if (stmt instanceof BlockNode && Array.isArray(stmt.statements)) {
      // BlockNode - recurse
      const block = stmt as BlockNode;
      if (block.statements) {
        block.statements = transformStatementList(block.statements, insideLoop);
      }
      result.push(block);
    } else {
      result.push(stmt);
    }
  }

  return result;
}

// --- Do-While Loop -------------------------------------------------------

function transformDoWhileLoop(loop: DoWhileNode): StatementNode[] {
  if (!loop.block.statements) return [loop];

  const hasBreak = containsBreakOrContinue(loop.block.statements, 'break');
  const hasContinue = containsBreakOrContinue(loop.block.statements, 'continue');

  if (!hasBreak && !hasContinue) {
    // Still recurse into nested loops
    loop.block.statements = transformStatementList(loop.block.statements, true);
    return [loop];
  }

  const breakFlagName = hasBreak ? `csBreak${breakFlagCounter++}` : undefined;
  const loc = loop.location;

  // Separate for-loop update statements from body
  const updateCount = loop.forLoopUpdateCount;
  const regularStmts = updateCount > 0
    ? loop.block.statements.slice(0, -updateCount)
    : loop.block.statements;
  const updateStmts = updateCount > 0
    ? loop.block.statements.slice(-updateCount)
    : [];

  // Transform the regular body statements
  const transformedBody = nestBreakContinue(regularStmts, breakFlagName);

  // Build the new body
  const newBodyStmts: StatementNode[] = [...transformedBody];

  // For for-loops, guard the update with !breakFlag
  if (updateStmts.length > 0) {
    if (breakFlagName) {
      const guard = createNot(createIdentifier(breakFlagName, loc), loc);
      const guardedBlock = new BlockNode(updateStmts);
      guardedBlock.location = loc;
      const guardedBranch = new BranchNode(guard, guardedBlock);
      guardedBranch.location = loc;
      newBodyStmts.push(guardedBranch);
    } else {
      newBodyStmts.push(...updateStmts);
    }
  }

  const newBlock = new BlockNode(newBodyStmts);
  newBlock.location = loop.block.location;

  // Modify condition to include !breakFlag
  let newCondition = loop.condition;
  if (breakFlagName) {
    const notFlag = createNot(createIdentifier(breakFlagName, loc), loc);
    newCondition = createAnd(loop.condition, notFlag, loc);
  }

  const newLoop = new DoWhileNode(newCondition, newBlock);
  newLoop.forLoopUpdateCount = loop.forLoopUpdateCount;
  newLoop.location = loop.location;

  // If break is used, prepend the flag variable declaration
  const result: StatementNode[] = [];
  if (breakFlagName) {
    result.push(createBoolVarDef(breakFlagName, false, loc));
  }
  result.push(newLoop);
  return result;
}

// --- While Loop ----------------------------------------------------------

function transformWhileLoop(loop: WhileNode): StatementNode[] {
  if (!loop.block.statements) return [loop];

  const hasBreak = containsBreakOrContinue(loop.block.statements, 'break');
  const hasContinue = containsBreakOrContinue(loop.block.statements, 'continue');

  if (!hasBreak && !hasContinue) {
    loop.block.statements = transformStatementList(loop.block.statements, true);
    return [loop];
  }

  const breakFlagName = hasBreak ? `csBreak${breakFlagCounter++}` : undefined;
  const loc = loop.location;

  // Separate for-loop update statements from body so `continue` still runs the update
  const updateCount = loop.forLoopUpdateCount;
  const regularStmts = updateCount > 0
    ? loop.block.statements.slice(0, -updateCount)
    : loop.block.statements;
  const updateStmts = updateCount > 0
    ? loop.block.statements.slice(-updateCount)
    : [];

  const transformedBody = nestBreakContinue(regularStmts, breakFlagName);

  const newBodyStmts: StatementNode[] = [...transformedBody];

  // For for-loops, guard the update with !breakFlag so `break` skips it
  if (updateStmts.length > 0) {
    if (breakFlagName) {
      const guard = createNot(createIdentifier(breakFlagName, loc), loc);
      const guardedBlock = new BlockNode(updateStmts);
      guardedBlock.location = loc;
      const guardedBranch = new BranchNode(guard, guardedBlock);
      guardedBranch.location = loc;
      newBodyStmts.push(guardedBranch);
    } else {
      newBodyStmts.push(...updateStmts);
    }
  }

  const newBlock = new BlockNode(newBodyStmts);
  newBlock.location = loop.block.location;

  let newCondition = loop.condition;
  if (breakFlagName) {
    const notFlag = createNot(createIdentifier(breakFlagName, loc), loc);
    newCondition = createAnd(loop.condition, notFlag, loc);
  }

  const newLoop = new WhileNode(newCondition, newBlock);
  newLoop.forLoopUpdateCount = loop.forLoopUpdateCount;
  newLoop.location = loop.location;

  const result: StatementNode[] = [];
  if (breakFlagName) {
    result.push(createBoolVarDef(breakFlagName, false, loc));
  }
  result.push(newLoop);
  return result;
}

// --- Core Nesting Logic -------------------------------------------------

/**
 * Process a statement list, nesting remaining statements into else-blocks
 * when break/continue is encountered (following the EarlyReturnTransformation pattern).
 */
function nestBreakContinue(
  statements: StatementNode[],
  breakFlagName: string | undefined,
): StatementNode[] {
  const result: StatementNode[] = [];

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const remaining = statements.slice(i + 1);

    // Bare break
    if (stmt instanceof BreakNode) {
      if (breakFlagName) {
        result.push(createAssign(breakFlagName, true, stmt.location));
      }
      break; // remaining statements are dead code
    }

    // Bare continue
    if (stmt instanceof ContinueNode) {
      break; // skip remaining statements (loop re-evaluates condition)
    }

    // Branch with break/continue (handles last-statement branches too, remaining may be empty)
    if (stmt instanceof BranchNode) {
      const ifHasBreak = blockContainsBreakContinue(stmt.ifBlock, 'break');
      const ifHasContinue = blockContainsBreakContinue(stmt.ifBlock, 'continue');

      if (ifHasBreak || ifHasContinue) {
        // Transform: if (cond) { ...break/continue; } else { E; } remaining...
        // Into: if (cond) { ...expanded; } else { E; remaining...; }
        const transformedIfStmts = nestBreakContinue(stmt.ifBlock.statements ?? [], breakFlagName);
        const transformedIfBlock = new BlockNode(transformedIfStmts);
        transformedIfBlock.location = stmt.ifBlock.location;

        const elseStatements: StatementNode[] = [];
        if (stmt.elseBlock?.statements) {
          elseStatements.push(...stmt.elseBlock.statements);
        }
        elseStatements.push(...remaining);

        const transformedElseStmts = nestBreakContinue(elseStatements, breakFlagName);
        const elseBlock = new BlockNode(transformedElseStmts);
        elseBlock.location = stmt.elseBlock?.location ?? stmt.location;

        const newBranch = new BranchNode(stmt.condition, transformedIfBlock, elseBlock);
        newBranch.location = stmt.location;
        result.push(newBranch);
        break; // remaining consumed
      }

      // Check else-block too
      const elseHasBreak = stmt.elseBlock ? blockContainsBreakContinue(stmt.elseBlock, 'break') : false;
      const elseHasContinue = stmt.elseBlock ? blockContainsBreakContinue(stmt.elseBlock, 'continue') : false;

      if (elseHasBreak || elseHasContinue) {
        const transformedElseStmts = nestBreakContinue(stmt.elseBlock!.statements ?? [], breakFlagName);
        const transformedElseBlock = new BlockNode(transformedElseStmts);
        transformedElseBlock.location = stmt.elseBlock!.location;

        // Remaining goes into the if-block (which doesn't break/continue)
        const ifStatements: StatementNode[] = [];
        if (stmt.ifBlock.statements) {
          ifStatements.push(...stmt.ifBlock.statements);
        }
        ifStatements.push(...remaining);

        const transformedIfStmts = nestBreakContinue(ifStatements, breakFlagName);
        const ifBlock = new BlockNode(transformedIfStmts);
        ifBlock.location = stmt.ifBlock.location;

        const newBranch = new BranchNode(stmt.condition, ifBlock, transformedElseBlock);
        newBranch.location = stmt.location;
        result.push(newBranch);
        break; // remaining consumed
      }
    }

    // Nested loops - recurse but break/continue inside them don't affect this loop
    if (stmt instanceof DoWhileNode) {
      result.push(...transformDoWhileLoop(stmt));
      continue;
    }
    if (stmt instanceof WhileNode) {
      result.push(...transformWhileLoop(stmt));
      continue;
    }

    // Recurse into branches that don't contain break/continue at this level
    if (stmt instanceof BranchNode) {
      const newBranch = cloneBranch(stmt);
      if (newBranch.ifBlock.statements) {
        newBranch.ifBlock.statements = transformStatementList(newBranch.ifBlock.statements, true);
      }
      if (newBranch.elseBlock?.statements) {
        newBranch.elseBlock.statements = transformStatementList(newBranch.elseBlock.statements, true);
      }
      result.push(newBranch);
      continue;
    }

    result.push(stmt);
  }

  return result;
}

// --- Helpers -------------------------------------------------------------

function containsBreakOrContinue(
  statements: StatementNode[],
  kind: 'break' | 'continue',
): boolean {
  for (const s of statements) {
    if (kind === 'break' && s instanceof BreakNode) return true;
    if (kind === 'continue' && s instanceof ContinueNode) return true;
    if (s instanceof BranchNode) {
      if (blockContainsBreakContinue(s.ifBlock, kind)) return true;
      if (s.elseBlock && blockContainsBreakContinue(s.elseBlock, kind)) return true;
    }
    if (s instanceof TryCatchNode) {
      // Only check try block - catch blocks are dead code
      if (blockContainsBreakContinue(s.tryBlock, kind)) return true;
    }
    // Don't recurse into nested loops - their break/continue is scoped to them
  }
  return false;
}

function blockContainsBreakContinue(
  block: BlockNode,
  kind: 'break' | 'continue',
): boolean {
  if (!block.statements) return false;
  return containsBreakOrContinue(block.statements, kind);
}

function cloneBranch(node: BranchNode): BranchNode {
  const newBranch = new BranchNode(node.condition, node.ifBlock, node.elseBlock);
  newBranch.location = node.location;
  newBranch.branchOps = node.branchOps;
  return newBranch;
}

function createIdentifier(name: string, loc: Location): IdentifierNode {
  const node = new IdentifierNode(name);
  node.location = loc;
  return node;
}

function createBoolLiteral(value: boolean, loc: Location): BoolLiteralNode {
  const node = new BoolLiteralNode(value);
  node.location = loc;
  return node;
}

function createNot(expr: ExpressionNode, loc: Location): UnaryOpNode {
  const node = new UnaryOpNode(UnaryOperator.NOT, expr);
  node.location = loc;
  return node;
}

function createAnd(left: ExpressionNode, right: ExpressionNode, loc: Location): BinaryOpNode {
  const node = new BinaryOpNode(left, BinaryOperator.AND, right);
  node.location = loc;
  return node;
}

function createBoolVarDef(name: string, value: boolean, loc: Location): VariableDefinitionNode {
  const node = new VariableDefinitionNode(
    PrimitiveType.BOOL,
    [],
    name,
    createBoolLiteral(value, loc),
  );
  node.location = loc;
  return node;
}

function createAssign(name: string, value: boolean, loc: Location): AssignNode {
  const node = new AssignNode(
    createIdentifier(name, loc),
    createBoolLiteral(value, loc),
  );
  node.location = loc;
  return node;
}
