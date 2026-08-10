import {
  FunctionDefinitionNode,
  ReturnNode,
  StatementNode,
  BranchNode,
  BlockNode,
  ConsoleStatementNode,
  TryCatchNode,
  SwitchNode,
  UncheckedNode,
  Node,
  ContractNode,
  ParameterNode,
  SourceFileNode,
  RevertNode,
  VariableDefinitionNode,
  AssignNode,
  IdentifierNode,
  WhileNode,
  DoWhileNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { computeBranchOps } from './branchOps.js';

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
  private returnCounter = 0;

  constructor(private readonly canonicalizeScalarReturns = false) { super(); }

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
    // All functions get early-return nesting so every `return`/`return x` reaches tail position: codegen treats
    // a void tail `return;` as a no-op and a valued tail return as the result. Entry-point void functions are
    // included (a `return;` guard, e.g. an inlined library `remove`), whose bare returns EnsureFinalRequire
    // permits now that they are always nested to a tail no-op here.
    node.parameters = this.visitList(node.parameters) as ParameterNode[];

    // Transform the body statements to nest early returns
    if (node.body.statements) {
      node.body.statements = transformStatements(node.body.statements);
      if (this.canonicalizeScalarReturns && node.returnTypes.length === 1) {
        const returns = collectReturns(node.body);
        // A bare `return;` in a scalar named-return function means "return the current named value" and has no
        // expression to beta-reduce. Leave that function in the already-structured form; constructing an assign
        // from expressions[0] would create an invalid AST (FlashloanStrategyMock's inherited/modifier-expanded
        // corpus exposes this Solidity 0.6 shape).
        if (returns.length > 1 && returns.every((ret) => ret.expressions.length === 1)
          && !containsReturnInConditionalContainer(node.body)) {
          const name = `__earlyret_${this.returnCounter++}`;
          const decl = new VariableDefinitionNode(node.returnTypes[0], [], name);
          decl.location = node.location;
          node.body = node.body.accept(new CanonicalizeScalarReturns(name)) as BlockNode;
          const tailId = new IdentifierNode(name); tailId.location = node.location;
          const tail = new ReturnNode([tailId]); tail.location = node.location;
          node.body.statements = [decl, ...(node.body.statements ?? []), tail];
        }
      }
    }

    node.body = this.visit(node.body) as BlockNode;
    return node;
  }
}

class CanonicalizeScalarReturns extends AstTraversal {
  constructor(private readonly name: string) { super(); }

  visitReturn(node: ReturnNode): Node {
    const id = new IdentifierNode(this.name); id.location = node.location;
    const assign = new AssignNode(id, node.expressions[0]); assign.location = node.location;
    return assign;
  }
}

function collectReturns(node: Node): ReturnNode[] {
  const out: ReturnNode[] = [];
  const walk = (current: Node): void => {
    if (current instanceof ReturnNode) out.push(current);
    for (const [key, value] of Object.entries(current)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      if (value instanceof Node) walk(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
    }
  };
  walk(node);
  return out;
}

// Early-return nesting deliberately does not convert control flow that exits a loop/try/switch. Replacing such a
// return with an assignment would continue executing that container, so leave those functions in their existing
// fail-closed subroutine form.
function containsReturnInConditionalContainer(node: Node): boolean {
  let unsafe = false;
  const walk = (current: Node, conditional: boolean): void => {
    if (current instanceof ReturnNode && conditional) { unsafe = true; return; }
    const nested = conditional || current instanceof WhileNode || current instanceof DoWhileNode
      || current instanceof TryCatchNode || current instanceof SwitchNode;
    for (const [key, value] of Object.entries(current)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      if (value instanceof Node) walk(value, nested);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item, nested);
    }
  };
  walk(node, false);
  return unsafe;
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
  // Nothing to nest for an empty body. A SINGLE statement is NOT skippable: it may be a container (an
  // `unchecked { if (c) return a; return b; }` block, a branch, a switch) whose INNER early returns still need
  // nesting - nestEarlyReturns recurses into those. (The old `<= 1` guard skipped a lone `unchecked` block, so an
  // early return inside it reached codegen un-nested and desynced the fall-through stack - OZ Math.tryAdd.)
  if (statements.length === 0) return statements;

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
        // Recompute: the guard's following statements were just nested into elseBlock, so the original
        // branchOps (which predates the move) would miss any state write/transfer/emit now in the else.
        newBranch.branchOps = computeBranchOps(transformedIfBlock, elseBlock);
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
        newBranch.branchOps = computeBranchOps(ifBlock, transformedElseBlock);
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

    // Recurse into an `unchecked` block: an early return INSIDE it (e.g. OZ Math.tryAdd
    // `unchecked { uint c = a + b; if (c < a) return (false, 0); return (true, c); }`) must be nested into
    // if/else here, else codegen's visitBranch desyncs the fall-through stack (a returning branch with no else
    // leaves the tracker at the early-return stack, losing the block's locals). The block keeps unchecked
    // arithmetic semantics; only its inner control flow is rewritten.
    if (stmt instanceof UncheckedNode) {
      if (stmt.block.statements) {
        stmt.block.statements = nestEarlyReturns(stmt.block.statements);
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
      newBranch.branchOps = computeBranchOps(transformedIf, transformedElse);
      result.push(newBranch);
      continue;
    }

    result.push(stmt);
  }

  return result;
}

export function blockEndsWithReturn(block: BlockNode): boolean {
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

  if (last instanceof UncheckedNode) {
    return blockEndsWithReturn(last.block);
  }

  if (last instanceof SwitchNode) {
    const casesReturn = last.cases.every((c) => blockEndsWithReturn(c.body));
    const defaultReturns = last.defaultCase ? blockEndsWithReturn(last.defaultCase) : false;
    return casesReturn && defaultReturns;
  }

  return false;
}
