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
  CollectionIterationNode,
  RequireNode,
  BoolLiteralNode,
  FunctionCallNode,
  FieldAccessNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { walkInvocationAst } from '../analysis/InvocationAnalysis.js';
import { UnsupportedReturnError } from '../Errors.js';
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
    refuseHaltingCalls(node);
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
    // receive() and fallback() are dispatched like any entry point, so a return of theirs that is not already their
    // last statement is nested too. Their other bodies keep the lowering they had.
    if (node.fallbackDef && firstUnconfinedReturn(node.fallbackDef.body.statements ?? [])) {
      node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    }
    if (node.receiveDef && firstUnconfinedReturn(node.receiveDef.body.statements ?? [])) {
      node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    }
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
    refuseUnconfinedReturns(node);
    return node;
  }
}

/**
 * Refuses a function with a return that statements of it still run after. Code generation emits no jump: a void
 * `return;` emits nothing and a valued one leaves its values, so such a return would not end its path.
 */
export function refuseUnconfinedReturns(fn: FunctionDefinitionNode): void {
  const unconfined = firstUnconfinedReturn(fn.body?.statements ?? []);
  if (unconfined) {
    throw new UnsupportedReturnError(unconfined, `statements of '${fn.name}' after this return would still run`);
  }
}

/** True when a function the transformation visits has a return that statements of it still run after. */
export function holdsUnconfinedReturn(ast: SourceFileNode): boolean {
  const { contract } = ast;
  return [...ast.freeFunctions, contract.constructorDef, ...contract.functions, contract.fallbackDef,
    contract.receiveDef].some((fn) => fn?.body !== undefined && !!firstUnconfinedReturn(fn.body.statements ?? []));
}

/**
 * Refuses a call an assembly return in its callee would not end. `return(ptr, size)` and `stop()` halt the whole call
 * on the EVM, the internal functions it runs through included, but a function called as a subroutine only returns,
 * and its caller runs on. So a function holding one is called only where the halt ends no more than that function:
 * by an external `this.f()` call, whose own frame is all it ends, or by a message-bus route, whose dispatches are
 * frames of their own. One inlined into its caller is no call: its halt is the caller's return.
 */
export function refuseHaltingCalls(ast: SourceFileNode): void {
  const { contract } = ast;
  const functions = [...ast.freeFunctions, contract.constructorDef, ...contract.functions, contract.fallbackDef,
    contract.receiveDef].filter((fn): fn is FunctionDefinitionNode => fn?.body !== undefined);
  const halting = new Map(functions.filter((fn) => holdsAssemblyReturn(fn.body.statements ?? []))
    .map((fn) => [`${fn.name}/${fn.parameters.length}`, fn]));
  if (halting.size === 0) return;
  const names = new Set([...halting.values()].map((fn) => fn.name));
  const refuse = (node: Node, statements: string, callee: string): never => {
    throw new UnsupportedReturnError(node, `${statements} would still run: the assembly return in '${callee}' halts `
      + `the whole call, not only '${callee}'`);
  };
  for (const caller of functions) {
    if (caller.messageBusRoute) continue;
    // A call's own identifier, and a member read like `f.selector`, are no function value.
    const named = new Set<Node>();
    walkInvocationAst(caller.body, (node) => {
      if (node instanceof FunctionCallNode) {
        named.add(node.identifier);
        const callee = halting.get(`${node.identifier.name}/${node.parameters.length}`);
        if (callee && !node.fromThisCall) refuse(node, `statements of '${caller.name}' after this call`, callee.name);
      } else if (node instanceof FieldAccessNode) {
        named.add(node.expression);
      } else if (node instanceof IdentifierNode && !named.has(node) && names.has(node.name)) {
        refuse(node, 'statements after a call through this function value', node.name);
      }
    });
  }
}

/** True when `statements` hold an assembly return in a list they run. */
export function holdsAssemblyReturn(statements: StatementNode[]): boolean {
  return statements.some((statement) => (statement instanceof ReturnNode && statement.isYulReturn)
    || nestedStatementLists(statement).some(holdsAssemblyReturn));
}

/** The statement lists a statement runs its statements in: arms, blocks, a try block, cases and a loop's body. */
export function nestedStatementLists(statement: StatementNode): StatementNode[][] {
  if (statement instanceof BranchNode) {
    return [statement.ifBlock.statements ?? [], statement.elseBlock?.statements ?? []];
  }
  if (statement instanceof BlockNode) return [statement.statements ?? []];
  if (statement instanceof UncheckedNode) return [statement.block.statements ?? []];
  // A catch clause is not emitted: a failed call fails the transaction.
  if (statement instanceof TryCatchNode) return [statement.tryBlock.statements ?? []];
  if (statement instanceof SwitchNode) {
    return [...statement.cases.map((c) => c.body.statements ?? []), statement.defaultCase?.statements ?? []];
  }
  if (statement instanceof WhileNode || statement instanceof DoWhileNode) return [statement.block.statements ?? []];
  if (statement instanceof CollectionIterationNode) return [statement.body.statements ?? []];
  return [];
}

/** True when a statement is a return or holds one in a list it runs. */
export function holdsReturn(statement: StatementNode): boolean {
  return statement instanceof ReturnNode
    || nestedStatementLists(statement).some((statements) => statements.some(holdsReturn));
}

/**
 * The first return of `statements` that statements of the function still run after, if any. `statements` ends the
 * function when `last` is set; a return ends it only as the last statement of a list that does, and never in a loop.
 */
export function firstUnconfinedReturn(statements: StatementNode[], last = true): ReturnNode | undefined {
  const lastIndex = statements.findLastIndex((statement) => !(statement instanceof ConsoleStatementNode));
  for (const [index, statement] of statements.entries()) {
    const ends = last && index >= lastIndex;
    if (statement instanceof ReturnNode) {
      // An assembly `return(ptr, size)` counts as well: it halts the call, but code generation emits no jump for it.
      if (!ends) return statement;
      continue;
    }
    const loop = statement instanceof WhileNode || statement instanceof DoWhileNode
      || statement instanceof CollectionIterationNode;
    for (const nested of nestedStatementLists(statement)) {
      const unconfined = firstUnconfinedReturn(nested, ends && !loop);
      if (unconfined) return unconfined;
    }
  }
  return undefined;
}

/**
 * True when nestEarlyReturns leaves no statement of `statements` to run after a return. It nests the statements
 * after a branch into the branch's other arm only when one arm ends in a return, and drops those after a statement
 * that returns on every path. After any other statement that holds a return they stay where they are, and it does
 * not enter a loop at all.
 */
export function nestsReturnsToTail(statements: StatementNode[]): boolean {
  for (const [index, statement] of statements.entries()) {
    if (statement instanceof ReturnNode || statement instanceof RevertNode) return true;
    if (statement instanceof BranchNode && index + 1 < statements.length) {
      const remaining = statements.slice(index + 1);
      if (blockEndsWithReturn(statement.ifBlock)) {
        return nestsReturnsToTail(statement.ifBlock.statements ?? [])
          && nestsReturnsToTail([...(statement.elseBlock?.statements ?? []), ...remaining]);
      }
      if (statement.elseBlock && blockEndsWithReturn(statement.elseBlock)) {
        return nestsReturnsToTail(statement.elseBlock.statements ?? [])
          && nestsReturnsToTail([...(statement.ifBlock.statements ?? []), ...remaining]);
      }
    }
    if (!holdsReturn(statement)) continue;
    const container = statement instanceof BranchNode || statement instanceof UncheckedNode
      || statement instanceof TryCatchNode || statement instanceof SwitchNode || statement instanceof BlockNode;
    // One that ends every path drops what follows it; after any other, what follows runs after its return.
    const followed = statements.slice(index + 1).some((next) => !(next instanceof ConsoleStatementNode));
    if (!container || (followed && !endsEveryPath(statement))) return false;
    return nestedStatementLists(statement).every(nestsReturnsToTail);
  }
  return true;
}

class CanonicalizeScalarReturns extends AstTraversal {
  constructor(private readonly name: string) { super(); }

  visitReturn(node: ReturnNode): Node {
    // An assembly `return(ptr, size)` halts with raw bytes; it is not a value of the function's result.
    if (node.isYulReturn) return node;
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
      // A container that ends every path ends the list: what follows it is unreachable.
      if (endsEveryPath(stmt)) break;
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
      if (endsEveryPath(stmt)) break;
      continue;
    }

    // A lowered assembly block can hide a conditional return (`{ if c { return } }`) from the branch rule
    // above. Statements after that block still run, so nest them into the block and let the same rule place
    // them on the arm that does not return.
    if (stmt instanceof BlockNode && holdsReturn(stmt) && remaining.length > 0) {
      const nested = nestEarlyReturns([...(stmt.statements ?? []), ...remaining]);
      const block = new BlockNode(nested);
      block.location = stmt.location;
      block.symbolTable = stmt.symbolTable;
      result.push(block);
      break;
    }

    // Recurse into a block holding a return, as a lowering that keeps a write-back beside its return builds one
    // (`{ flush; return; }` in a branch arm, which therefore ends in a return too).
    if (stmt instanceof BlockNode && holdsReturn(stmt)) {
      stmt.statements = nestEarlyReturns(stmt.statements ?? []);
      result.push(stmt);
      if (endsEveryPath(stmt)) break;
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
      if (endsEveryPath(stmt)) break;
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
      if (endsEveryPath(newBranch)) break;
      continue;
    }

    result.push(stmt);
  }

  return result;
}

export function blockEndsWithReturn(block: BlockNode, failing = false): boolean {
  if (!block.statements || block.statements.length === 0) return false;

  const nonLogStatements = block.statements.filter((s) => !(s instanceof ConsoleStatementNode));
  if (nonLogStatements.length === 0) return false;

  return endsWithReturn(nonLogStatements[nonLogStatements.length - 1], failing);
}

/**
 * True when a statement returns or reverts on every path through it. With `failing`, a `require(false)` ends its
 * path too: the script fails there, as it does at the one an assembly `revert` or `invalid()` lowers to.
 */
function endsWithReturn(last: StatementNode, failing = false): boolean {
  if (last instanceof ReturnNode) return true;
  if (last instanceof RevertNode) return true;
  if (failing && last instanceof RequireNode && last.expression instanceof BoolLiteralNode && !last.expression.value) {
    return true;
  }

  if (last instanceof BranchNode) {
    const ifReturns = blockEndsWithReturn(last.ifBlock, failing);
    const elseReturns = last.elseBlock ? blockEndsWithReturn(last.elseBlock, failing) : false;
    return ifReturns && elseReturns;
  }

  if (last instanceof TryCatchNode) {
    return blockEndsWithReturn(last.tryBlock, failing);
  }

  if (last instanceof UncheckedNode) {
    return blockEndsWithReturn(last.block, failing);
  }

  if (last instanceof BlockNode) {
    return blockEndsWithReturn(last, failing);
  }

  // A switch is read without `failing`: code generation takes the stack its first case leaves as the one after it.
  if (last instanceof SwitchNode) {
    const casesReturn = last.cases.every((c) => blockEndsWithReturn(c.body));
    const defaultReturns = last.defaultCase ? blockEndsWithReturn(last.defaultCase) : false;
    return casesReturn && defaultReturns;
  }

  return false;
}

/**
 * True when nothing after a statement runs: it returns or reverts on every path, or it holds a return and every
 * path through it returns or fails (an assembly `switch` whose `revert` arm is a `require(false)` beside a return).
 */
function endsEveryPath(statement: StatementNode): boolean {
  return endsWithReturn(statement) || (holdsReturn(statement) && endsWithReturn(statement, true));
}

/**
 * Keep a void helper's `return;` local when its body is spliced into another function. With `keepYulReturns`, an
 * assembly return stays: it halts the whole call, as it does on the EVM, so it is the caller's return.
 */
export function normalizeVoidInlineReturns(fn: FunctionDefinitionNode, keepYulReturns = false): void {
  fn.accept(new EarlyReturnTransformation());
  const stripReturns = (block: BlockNode): void => {
    const kept: StatementNode[] = [];
    for (const statement of block.statements ?? []) {
      if (statement instanceof ReturnNode && !(keepYulReturns && statement.isYulReturn)) continue;
      if (statement instanceof BranchNode) {
        stripReturns(statement.ifBlock);
        if (statement.elseBlock) stripReturns(statement.elseBlock);
      } else if (statement instanceof BlockNode) stripReturns(statement);
      else if (statement instanceof UncheckedNode) stripReturns(statement.block);
      kept.push(statement);
    }
    block.statements = kept;
  };
  stripReturns(fn.body);
}
