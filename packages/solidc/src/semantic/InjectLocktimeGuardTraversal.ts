import { PrimitiveType } from '@solidcash/utils';
import {
  BlockNode,
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
  StatementNode,
  TimeOpNode,
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
    const statements = node.statements;
    if (!statements || statements.length === 0) return node;
    const previous = this.hasTimeCheckOnPath;

    // A check covers a read when every path through the read reaches it: an earlier check, or a later one with no
    // early exit (return/break/continue) from the read's statement up to the check (SEM-6).
    const checks = statements.flatMap((s, i) => (isLocktimeCheck(s) ? [i] : []));
    const exits = statements.map(holdsEarlyExit);
    node.statements = statements.map((statement, i) => {
      this.hasTimeCheckOnPath = previous || checks.some((j) => j < i || !exits.slice(i, j).includes(true));
      return this.visit(statement) as StatementNode;
    });
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

// Whether a statement can leave its enclosing block early: any return, or a break/continue outside its own loops.
function holdsEarlyExit(statement: StatementNode): boolean {
  const finder = new EarlyExitFinder();
  finder.visit(statement);
  return finder.found;
}

class EarlyExitFinder extends AstTraversal {
  found = false;
  private loopDepth = 0;

  visitReturn(node: ReturnNode): Node {
    this.found = true;
    return node;
  }

  visitBreak(node: BreakNode): Node {
    if (this.loopDepth === 0) this.found = true;
    return node;
  }

  visitContinue(node: ContinueNode): Node {
    if (this.loopDepth === 0) this.found = true;
    return node;
  }

  visitWhile(node: WhileNode): Node {
    return this.inLoop(() => super.visitWhile(node));
  }

  visitDoWhile(node: DoWhileNode): Node {
    return this.inLoop(() => super.visitDoWhile(node));
  }

  visitCollectionIteration(node: CollectionIterationNode): Node {
    return this.inLoop(() => super.visitCollectionIteration(node));
  }

  private inLoop(visit: () => Node): Node {
    this.loopDepth += 1;
    const result = visit();
    this.loopDepth -= 1;
    return result;
  }
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
