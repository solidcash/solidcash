import { PrimitiveType } from '@solidcash/utils';
import {
  BlockNode,
  BranchNode,
  BreakNode,
  CollectionIterationNode,
  ContinueNode,
  ContractNode,
  DoWhileNode,
  FunctionDefinitionNode,
  IntLiteralNode,
  Node,
  NullaryOpNode,
  ReturnNode,
  RevertNode,
  SwitchNode,
  TimeOpNode,
  UncheckedNode,
  WhileNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { TimeOp } from '../ast/Globals.js';
import { Location } from '../ast/Location.js';
import { NullaryOperator } from '../ast/Operator.js';

// Per BCH consensus, `tx.locktime` is only protocol-enforced if at least one input has a non-final sequence number
// If a require(tx.time >= ...) check or a require(this.age >= ...) with a compile-time int literal below 2^31 is
// present, then `tx.locktime` is protocol-enforced. If no such check is present, then we add a
// synthetic require(tx.time >= tx.locktime) check.
export default class InjectLocktimeGuardTraversal extends AstTraversal {
  private hasTimeCheckOnPath = false;
  private functionNeedsGuard = false;

  // MD3: the base visitContract visits only the constructor + regular functions, so a fallback (the default
  // dispatch branch) or receive that reads tx.locktime never received the synthetic guard - a time-lock bypass.
  // Route them through visitFunctionDefinition too.
  visitContract(node: ContractNode): Node {
    super.visitContract(node);
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    this.hasTimeCheckOnPath = false;
    this.functionNeedsGuard = false;

    super.visitFunctionDefinition(node);

    if (this.functionNeedsGuard) {
      node.body.statements = [createLocktimeGuard(node), ...(node.body.statements ?? [])];
    }
    return node;
  }

  visitBlock(node: BlockNode): Node {
    const previous = this.hasTimeCheckOnPath;

    // A later check still covers an earlier `tx.locktime` read, but only when every path actually reaches it.
    // A check after `return` used to suppress the guard for a read that executed and then left.
    if (blockHasCoveringLocktimeCheck(node.statements)) {
      this.hasTimeCheckOnPath = true;
    }
    super.visitBlock(node);
    this.hasTimeCheckOnPath = previous;
    return node;
  }

  visitNullaryOp(node: NullaryOpNode): Node {
    if (node.operator === NullaryOperator.LOCKTIME && !this.hasTimeCheckOnPath) {
      this.functionNeedsGuard = true;
    }
    return node;
  }
}

// Note that `require(tx.time >= ...)` checks are always sufficient to enforce the non-finality of the spending input,
// while `require(this.age >= ...)` checks are only sufficient when the operand is a compile-time int literal below 2^31.
function isLocktimeCheck(statement: Node): boolean {
  if (statement instanceof TimeOpNode) {
    if (statement.timeOp === TimeOp.CHECK_LOCKTIME) return true;
    if (statement.timeOp === TimeOp.CHECK_SEQUENCE) {
      return statement.expression instanceof IntLiteralNode && statement.expression.value < 2_147_483_648;
    }
  }
  return false;
}

/** A check counts only when no earlier statement can leave the block before it runs. */
function blockHasCoveringLocktimeCheck(statements: Node[] | undefined): boolean {
  if (!statements) return false;
  for (const statement of statements) {
    if (isLocktimeCheck(statement)) return true;
    if (skipsRestOfBlock(statement)) return false;
  }
  return false;
}

function skipsRestOfBlock(statement: Node): boolean {
  if (statement instanceof ReturnNode || statement instanceof RevertNode
    || statement instanceof BreakNode || statement instanceof ContinueNode) return true;
  if (statement instanceof BranchNode) {
    if (blockSkipsRest(statement.ifBlock)) return true;
    return statement.elseBlock !== undefined && blockSkipsRest(statement.elseBlock);
  }
  if (statement instanceof UncheckedNode || statement instanceof BlockNode) {
    const block = statement instanceof UncheckedNode ? statement.block : statement;
    return blockSkipsRest(block);
  }
  // `break` leaves the loop and still runs the statements after it. `return` does not.
  if (statement instanceof WhileNode || statement instanceof DoWhileNode) return blockCanReturn(statement.block);
  if (statement instanceof CollectionIterationNode) return blockCanReturn(statement.body);
  if (statement instanceof SwitchNode) {
    if (statement.cases.some((item) => blockCanReturn(item.body))) return true;
    return statement.defaultCase !== undefined && blockCanReturn(statement.defaultCase);
  }
  return false;
}

function blockSkipsRest(block: BlockNode): boolean {
  for (const statement of block.statements ?? []) {
    if (skipsRestOfBlock(statement)) return true;
  }
  return false;
}

function blockCanReturn(block: BlockNode): boolean {
  for (const statement of block.statements ?? []) {
    if (statement instanceof ReturnNode || statement instanceof RevertNode) return true;
    if (statement instanceof BranchNode) {
      if (blockCanReturn(statement.ifBlock)) return true;
      if (statement.elseBlock && blockCanReturn(statement.elseBlock)) return true;
    } else if (statement instanceof WhileNode || statement instanceof DoWhileNode) {
      if (blockCanReturn(statement.block)) return true;
    } else if (statement instanceof UncheckedNode || statement instanceof BlockNode) {
      const block = statement instanceof UncheckedNode ? statement.block : statement;
      if (blockCanReturn(block)) return true;
    } else if (statement instanceof CollectionIterationNode) {
      if (blockCanReturn(statement.body)) return true;
    } else if (statement instanceof SwitchNode) {
      if (statement.cases.some((item) => blockCanReturn(item.body))) return true;
      if (statement.defaultCase && blockCanReturn(statement.defaultCase)) return true;
    }
  }
  return false;
}

function createLocktimeGuard(funcNode: FunctionDefinitionNode): TimeOpNode {
  const guardLocation = new Location(funcNode.body.location.start, funcNode.body.location.start);

  const expression = new NullaryOpNode(NullaryOperator.LOCKTIME);
  expression.type = PrimitiveType.BIGINT;
  expression.location = guardLocation;

  const message = 'Using tx.locktime requires a non-final sequence number on the spending input';
  const guard = new TimeOpNode(TimeOp.CHECK_LOCKTIME, expression, message);
  guard.location = guardLocation;
  guard.isGuard = true;
  return guard;
}
