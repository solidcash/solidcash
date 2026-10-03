import { PrimitiveType } from '@solidcash/utils';
import {
  AssignNode,
  BlockNode,
  BoolLiteralNode,
  BranchNode,
  BreakNode,
  CollectionIterationNode,
  DoWhileNode,
  ExpressionNode,
  FunctionDefinitionNode,
  IdentifierNode,
  Node,
  ReturnNode,
  SourceFileNode,
  StatementNode,
  SwitchNode,
  TryCatchNode,
  TupleAssignmentNode,
  UnaryOpNode,
  UncheckedNode,
  VariableDefinitionNode,
  WhileNode,
} from '../ast/AST.js';
import { UnaryOperator } from '../ast/Operator.js';
import { UnsupportedReturnError } from '../Errors.js';
import {
  firstUnconfinedReturn, holdsReturn, nestedStatementLists, nestsReturnsToTail,
} from './EarlyReturnTransformation.js';
import { fixedForMaximum } from './FixedForLoop.js';

/**
 * Lowers the returns EarlyReturnTransformation cannot end a path at into a flag. Code generation has no jump: a void
 * `return;` emits nothing and a valued one leaves its values, so a return ends its path only when no statement runs
 * after it. The transformation nests the statements after a branch into its other arm when an arm ends in a return.
 * A return under a further condition, or in a block, an unchecked block, a try or a switch, keeps the statements
 * after it, as does the return the loop lowering leaves after a loop in such a place:
 *
 *   if (a) { if (b) return; } x = 1;
 *   ->
 *   bool __internal__exitflag = false;
 *   if (a) { if (b) { __internal__exitflag = true; } }
 *   if (!__internal__exitflag) { x = 1; }
 *
 * A function that returns values stashes them and returns them once, at its end. Every function, fallback, receive
 * and constructor is lowered, and only one whose returns the transformation leaves statements after: the others keep
 * the lowering they had. Runs after the named-return and nested-branch desugarings, and again once the other
 * lowerings have run, both before semantic analysis so the new locals resolve.
 */
const FLAG = '__internal__exitflag';
const VALUE = '__internal__exitval';

/** The prefix of the flag a modifier region's returns set (ModifierExpansionTransformation names each region's). */
export const REGION_FLAG = '__modifier_exit_';

/** True when `name` is a flag lowerReturns sets for a return: a function's own, or a modifier region's. */
export function isReturnFlag(name: string): boolean {
  return name.startsWith(FLAG) || name.startsWith(REGION_FLAG);
}

/** What a lowered return does instead of leaving: where its values go, and the flag that gates what follows it. */
export interface ReturnExit {
  /** The local a return sets; every statement after the return on its path is gated on it. */
  readonly flag: string;
  /** The statements that keep a return's values, run ahead of setting the flag. */
  readonly values: (ret: ReturnNode) => StatementNode[];
  /** Whether a return inside a loop leaves it by a `break` this lowering adds. One is refused otherwise. */
  readonly breaks: boolean;
}

/** `statements` with each return turned into `exit`, and every statement after one on its path gated on the flag. */
export function lowerReturns(statements: StatementNode[], exit: ReturnExit): StatementNode[] {
  return lowerList(statements, exit, 0);
}

/** The assignments that keep a return's values in `names`: one per value, or the tuple a forwarded call returns. */
export function stashReturnValues(
  ret: ReturnNode, names: readonly string[], owner: string, parallel = false,
): StatementNode[] {
  const located = <T extends Node>(node: T): T => Object.assign(node, { location: ret.location });
  const targets = names.map((name) => ({ name, existing: true }));
  const { expressions } = ret;
  if (expressions.length === names.length && (names.length === 1 || !parallel)) {
    return expressions.map((value, k) => located(new AssignNode(located(new IdentifierNode(names[k])), value)));
  }
  // Named results a return reads from, as `return (b, a);` does, are all read before any is written.
  if (expressions.length === names.length) {
    return [located(new TupleAssignmentNode(targets, undefined as unknown as ExpressionNode, true, expressions))];
  }
  if (expressions.length === 1 && names.length > 1) {
    return [located(new TupleAssignmentNode(targets, expressions[0], true))];
  }
  throw new UnsupportedReturnError(ret, `'${owner}' returns ${names.length} values and this return gives `
    + `${expressions.length}`);
}

/**
 * Lowers the returns of every function whose returns EarlyReturnTransformation leaves statements after. A return
 * in a loop is lowered to a break before this runs, so one still there is refused by name, or left to that
 * transformation's own refusal when `lenient` is set.
 */
export default function confineReturns(ast: SourceFileNode, lenient = false): SourceFileNode {
  const confine = (fn: FunctionDefinitionNode | undefined): void => {
    if (fn) confineFunction(fn, lenient);
  };
  for (const contract of [ast.contract, ...ast.importedContracts]) {
    [contract.constructorDef, ...contract.functions, contract.fallbackDef, contract.receiveDef].forEach(confine);
  }
  ast.freeFunctions.forEach(confine);
  return ast;
}

/** True when a loop among `statements`, at any depth, holds a return. */
function returnInLoop(statements: StatementNode[]): boolean {
  return statements.some((statement) => (statement instanceof WhileNode || statement instanceof DoWhileNode
    || statement instanceof CollectionIterationNode ? holdsReturn(statement)
    : nestedStatementLists(statement).some(returnInLoop)));
}

function confineFunction(fn: FunctionDefinitionNode, lenient: boolean): void {
  const statements = fn.body?.statements;
  if (!statements || nestsReturnsToTail(statements) || (lenient && returnInLoop(statements))) return;
  // A storage pointer is not stashed: the stash is declared unassigned, so a path that falls through would return a
  // pointer to nothing. Such a function keeps EarlyReturnTransformation's refusal of statements after a return.
  if (fn.returnModifiers.some((modifiers) => modifiers?.includes('storage'))) return;
  const located = <T extends Node>(node: T): T => Object.assign(node, { location: node.location ?? fn.location });
  // The second run names its locals apart, as a function both runs lower declares the first run's already.
  const late = lenient ? '_late' : '';
  const values = fn.returnTypes.map((_, k) => `${VALUE}${late}_${k}`);
  const flag = located(new VariableDefinitionNode(
    PrimitiveType.BOOL, [], `${FLAG}${late}`, located(new BoolLiteralNode(false)),
  ));
  flag.allowUnused = true;
  const stashes = fn.returnTypes.map((type, k) => located(new VariableDefinitionNode(type, [], values[k])));
  const lowered = lowerReturns(statements, {
    flag: flag.name,
    values: (ret) => (ret.expressions.length === 0 && values.length === 0 ? []
      : stashReturnValues(ret, values, fn.name)),
    breaks: false,
  });
  const result = values.map((name) => located(new IdentifierNode(name)));
  fn.body.statements = [flag, ...stashes, ...lowered, ...(values.length > 0 ? [located(new ReturnNode(result))] : [])];
}

function lowerList(statements: StatementNode[], exit: ReturnExit, loops: number): StatementNode[] {
  const lowered: StatementNode[] = [];
  for (const [index, statement] of statements.entries()) {
    // An assembly `return(ptr, size)` halts the call with raw bytes, not the function's values: nothing after it runs.
    if (statement instanceof ReturnNode && statement.isYulReturn) {
      lowered.push(statement);
      return lowered;
    }
    if (statement instanceof ReturnNode) {
      lowered.push(...exit.values(statement), setFlag(exit.flag, statement));
      // Outside a loop nothing after a return runs. Inside one, the break lowering skips the rest of the body.
      if (loops === 0) return lowered;
      lowered.push(locatedAt(new BreakNode(), statement));
      continue;
    }
    if (!holdsReturn(statement)) {
      lowered.push(statement);
      continue;
    }
    // The bound of a canonical for loop is read before its body changes, as the loop-return lowering reads it.
    const bound = statement instanceof WhileNode ? fixedForMaximum(statements[index - 1], statement) : undefined;
    lowerNested(statement, exit, loops);
    if (statement instanceof WhileNode && bound !== undefined) statement.compilerAuthenticatedMaximumIterations = bound;
    lowered.push(statement);
    if (loops > 0) {
      // A break in an arm or a block leaves the loop this list belongs to; one in a nested loop leaves only that.
      if (statement instanceof WhileNode || statement instanceof DoWhileNode) {
        const leave = locatedAt(new BlockNode([locatedAt(new BreakNode(), statement)]), statement);
        lowered.push(locatedAt(new BranchNode(readFlag(exit.flag, statement), leave), statement));
      }
      continue;
    }
    const rest = statements.slice(index + 1);
    if (rest.length > 0) {
      const notSet = locatedAt(new UnaryOpNode(UnaryOperator.NOT, readFlag(exit.flag, statement)), statement);
      const gated = locatedAt(new BlockNode(lowerList(rest, exit, 0)), statement);
      lowered.push(locatedAt(new BranchNode(notSet, gated), statement));
    }
    return lowered;
  }
  return lowered;
}

function lowerNested(statement: StatementNode, exit: ReturnExit, loops: number): void {
  const lower = (block: BlockNode | undefined, depth = loops): void => {
    if (block) block.statements = lowerList(block.statements ?? [], exit, depth);
  };
  if (statement instanceof BranchNode) {
    lower(statement.ifBlock);
    lower(statement.elseBlock);
  } else if (statement instanceof BlockNode) {
    lower(statement);
  } else if ((statement instanceof WhileNode || statement instanceof DoWhileNode) && exit.breaks) {
    lower(statement.block, loops + 1);
  } else if (statement instanceof UncheckedNode && loops === 0) {
    lower(statement.block);
  } else if (statement instanceof TryCatchNode && loops === 0) {
    lower(statement.tryBlock);
  } else if (statement instanceof SwitchNode && loops === 0) {
    statement.cases.forEach((switchCase) => lower(switchCase.body));
    lower(statement.defaultCase);
  } else {
    // The break lowering reaches a break through branches and blocks only, and a collection iteration has none.
    const ret = firstUnconfinedReturn([statement], false) ?? statement;
    throw new UnsupportedReturnError(ret, loops > 0
      ? 'a return inside an unchecked block, a try or a switch in a loop cannot leave the loop'
      : 'a return inside this loop cannot leave it');
  }
}

function locatedAt<T extends Node>(node: T, origin: Node): T {
  node.location = origin.location;
  return node;
}

function readFlag(flag: string, origin: Node): IdentifierNode {
  return locatedAt(new IdentifierNode(flag), origin);
}

function setFlag(flag: string, origin: Node): AssignNode {
  return locatedAt(new AssignNode(readFlag(flag, origin), locatedAt(new BoolLiteralNode(true), origin)), origin);
}
