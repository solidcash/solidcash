import {
  FunctionDefinitionNode,
  ReturnNode,
  StatementNode,
  BranchNode,
  BlockNode,
  ConsoleStatementNode,
  TryCatchNode,
  SwitchNode,
  Node,
  ContractNode,
  ParameterNode,
  SourceFileNode,
  RevertNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Transforms early return statements into nested if-else structures.
 * Bitcoin Script has no GOTO/JUMP, so we rewrite:
 *
 * ```
 * if (cond) { return x; }
 * return y;
 * ```
 * Into:
 * ```
 * if (cond) { return x; } else { return y; }
 * ```
 *
 * This pass runs after semantic analysis and before code generation.
 * It only transforms functions that have return types (internal/public).
 */
export default class EarlyReturnTransformation extends AstTraversal {
  visitSourceFile(node: SourceFileNode): Node {
    for (let i = 0; i < node.freeFunctions.length; i++) {
      node.freeFunctions[i] = this.visit(node.freeFunctions[i]) as FunctionDefinitionNode;
    }
    node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    node.parameters = this.visitList(node.parameters) as ParameterNode[];
    if (node.constructorDef) {
      node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    }
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    // Functions with return types always get early-return nesting. Internal (non-entry) void
    // functions need it too: a void `return;` in a subroutine must reach tail position so codegen
    // can treat it as a no-op (see visitReturn). Entry-point void functions keep prior handling.
    if (node.returnTypes.length === 0 && node.isEntryPoint) {
      return super.visitFunctionDefinition(node);
    }

    node.parameters = this.visitList(node.parameters) as ParameterNode[];

    // Transform the body statements to nest early returns
    if (node.body.statements) {
      node.body.statements = transformStatements(node.body.statements);
    }

    node.body = this.visit(node.body) as BlockNode;
    return node;
  }
}

/**
 * Transform a list of statements so that any early return causes all
 * subsequent statements to become the else-branch of a conditional.
 *
 * Algorithm: scan from end to start. If a statement is a `return`,
 * and there are statements after it, those have already been nested.
 * If a statement is an `if` with a `return` in the if-branch, wrap
 * remaining statements as the else-branch.
 */
function transformStatements(statements: StatementNode[]): StatementNode[] {
  // Filter out console statements for analysis (they don't affect control flow)
  // but keep them in the output
  if (statements.length <= 1) return statements;

  // Process from the end: find early returns and nest them
  const result = nestEarlyReturns(statements);
  return result;
}

function nestEarlyReturns(statements: StatementNode[]): StatementNode[] {
  const result: StatementNode[] = [];

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const remaining = statements.slice(i + 1);

    // Skip console statements - just pass them through
    if (stmt instanceof ConsoleStatementNode) {
      result.push(stmt);
      continue;
    }

    // If this is a return statement and there are remaining statements,
    // the remaining statements are unreachable (already validated by semantic analysis)
    if (stmt instanceof ReturnNode) {
      result.push(stmt);
      // Remaining statements after a return are unreachable, skip them
      break;
    }

    // Revert is also a terminal statement (unconditional failure)
    if (stmt instanceof RevertNode) {
      result.push(stmt);
      break;
    }

    // If this is an if/else branch where the if-block ends with return
    if (stmt instanceof BranchNode && remaining.length > 0) {
      const ifReturns = blockEndsWithReturn(stmt.ifBlock);

      if (ifReturns) {
        // Transform: if (cond) { ...return; } remaining...
        // Into: if (cond) { ...return; } else { remaining... }

        // First recursively transform the if block
        const transformedIfStatements = stmt.ifBlock.statements
          ? nestEarlyReturns(stmt.ifBlock.statements)
          : [];
        const transformedIfBlock = new BlockNode(transformedIfStatements);
        transformedIfBlock.location = stmt.ifBlock.location;
        transformedIfBlock.symbolTable = stmt.ifBlock.symbolTable;

        // Combine existing else-block statements with remaining statements
        const elseStatements: StatementNode[] = [];
        if (stmt.elseBlock?.statements) {
          elseStatements.push(...stmt.elseBlock.statements);
        }
        elseStatements.push(...remaining);

        // Recursively transform the combined else-block
        const transformedElseStatements = nestEarlyReturns(elseStatements);
        const elseBlock = new BlockNode(transformedElseStatements);
        elseBlock.location = stmt.elseBlock?.location ?? stmt.location;
        elseBlock.symbolTable = stmt.elseBlock?.symbolTable;

        const newBranch = new BranchNode(stmt.condition, transformedIfBlock, elseBlock);
        newBranch.location = stmt.location;
        newBranch.branchOps = stmt.branchOps;
        result.push(newBranch);
        break; // All remaining statements have been consumed
      }

      // If the else-block returns but not the if-block, handle similarly
      if (stmt.elseBlock && blockEndsWithReturn(stmt.elseBlock) && remaining.length > 0) {
        const transformedElseStatements = stmt.elseBlock.statements
          ? nestEarlyReturns(stmt.elseBlock.statements)
          : [];
        const transformedElseBlock = new BlockNode(transformedElseStatements);
        transformedElseBlock.location = stmt.elseBlock.location;
        transformedElseBlock.symbolTable = stmt.elseBlock.symbolTable;

        // Remaining statements go after the if-block
        const ifStatements: StatementNode[] = [];
        if (stmt.ifBlock.statements) {
          ifStatements.push(...stmt.ifBlock.statements);
        }
        ifStatements.push(...remaining);

        const transformedIfStatements = nestEarlyReturns(ifStatements);
        const ifBlock = new BlockNode(transformedIfStatements);
        ifBlock.location = stmt.ifBlock.location;
        ifBlock.symbolTable = stmt.ifBlock.symbolTable;

        const newBranch = new BranchNode(stmt.condition, ifBlock, transformedElseBlock);
        newBranch.location = stmt.location;
        newBranch.branchOps = stmt.branchOps;
        result.push(newBranch);
        break;
      }
    }

    // Recurse into try/catch (only try block matters for returns)
    if (stmt instanceof TryCatchNode) {
      if (stmt.tryBlock.statements) {
        stmt.tryBlock.statements = nestEarlyReturns(stmt.tryBlock.statements);
      }
      result.push(stmt);
      continue;
    }

    // Recurse into switch cases
    if (stmt instanceof SwitchNode) {
      for (const c of stmt.cases) {
        if (c.body.statements) {
          c.body.statements = nestEarlyReturns(c.body.statements);
        }
      }
      if (stmt.defaultCase?.statements) {
        stmt.defaultCase.statements = nestEarlyReturns(stmt.defaultCase.statements);
      }
      result.push(stmt);
      continue;
    }

    // Recursively transform branches that don't cause early return
    if (stmt instanceof BranchNode) {
      const transformedIf = stmt.ifBlock.statements
        ? new BlockNode(nestEarlyReturns(stmt.ifBlock.statements))
        : stmt.ifBlock;
      transformedIf.location = stmt.ifBlock.location;
      transformedIf.symbolTable = stmt.ifBlock.symbolTable;

      let transformedElse: BlockNode | undefined;
      if (stmt.elseBlock) {
        transformedElse = stmt.elseBlock.statements
          ? new BlockNode(nestEarlyReturns(stmt.elseBlock.statements))
          : stmt.elseBlock;
        transformedElse.location = stmt.elseBlock.location;
        transformedElse.symbolTable = stmt.elseBlock.symbolTable;
      }

      const newBranch = new BranchNode(stmt.condition, transformedIf, transformedElse);
      newBranch.location = stmt.location;
      newBranch.branchOps = stmt.branchOps;
      result.push(newBranch);
      continue;
    }

    result.push(stmt);
  }

  return result;
}

function blockEndsWithReturn(block: BlockNode): boolean {
  if (!block.statements || block.statements.length === 0) return false;

  const nonLogStatements = block.statements.filter((s) => !(s instanceof ConsoleStatementNode));
  if (nonLogStatements.length === 0) return false;

  const last = nonLogStatements[nonLogStatements.length - 1];
  if (last instanceof ReturnNode) return true;
  if (last instanceof RevertNode) return true;

  if (last instanceof BranchNode) {
    const ifReturns = blockEndsWithReturn(last.ifBlock);
    const elseReturns = last.elseBlock ? blockEndsWithReturn(last.elseBlock) : false;
    return ifReturns && elseReturns;
  }

  if (last instanceof TryCatchNode) {
    return blockEndsWithReturn(last.tryBlock);
  }

  if (last instanceof SwitchNode) {
    const casesReturn = last.cases.every((c) => blockEndsWithReturn(c.body));
    const defaultReturns = last.defaultCase ? blockEndsWithReturn(last.defaultCase) : false;
    return casesReturn && defaultReturns;
  }

  return false;
}
