import {
  AssignNode, BinaryOpNode, BlockNode, BoolLiteralNode, BranchNode, ContractNode,
  DoWhileNode, FunctionCallNode, FunctionDefinitionNode, IdentifierNode, Node, ReturnNode,
  SourceFileNode, StatementNode, VariableDefinitionNode, WhileNode, IntLiteralNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { BinaryOperator } from '../ast/Operator.js';
import { PrimitiveType } from '@solidcash/utils';

/**
 * Lower a conservative single-result tail-recursive helper to an ordinary loop before helper inlining:
 *
 *   function step(T x) returns (T r) { if (done) r = value; else r = step(next); }
 *
 * becomes, schematically:
 *
 *   function step(T x) returns (T r) {
 *     bool repeat = true;
 *     while (repeat) { repeat = false; if (done) r = value; else { T t = next; x = t; repeat = true; } }
 *   }
 *
 * This matters for BCH external-call helpers. Once such a helper is cloned into an entry point, its outgoing
 * calls belong to that entry's physical covenant layout (including loop-indexed groups); invoking the original
 * recursive subroutine would incorrectly re-enter a separately inferred layout. Tail lowering keeps every
 * eventual call in the one caller-owned frame while preserving dynamic recursion depth as loop iterations.
 *
 * The gate is intentionally narrow: exactly one named return, every self-call is the whole RHS assigned to that
 * return (or the whole return expression), and it is tail-positioned through enclosing blocks/branches. Calls in
 * conditions, loops, arguments, or before later statements are left untouched.
 */
export default class LowerTailRecursion extends AstTraversal {
  private counter = 0;

  visitSourceFile(node: SourceFileNode): Node {
    node.freeFunctions = node.freeFunctions.map((fn) => this.visit(fn) as FunctionDefinitionNode);
    node.contract = this.visit(node.contract) as ContractNode;
    node.importedContracts = node.importedContracts.map((contract) => this.visit(contract) as ContractNode);
    return node;
  }

  visitContract(node: ContractNode): Node {
    node.functions = node.functions.map((fn) => this.visit(fn) as FunctionDefinitionNode);
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (!node.body || node.returnNames.length !== 1) return node;
    const returnName = node.returnNames[0];
    const selfCalls = this.countSelfCalls(node.body, node.name);
    if (selfCalls === 0 || !this.selfCallsHaveArity(node.body, node.name, node.parameters.length)
      || this.hasNonRecursiveReturn(node.body, node.name)
      || !this.validTailBlock(node.body, node.name, returnName)) return node;

    const frame = this.counter++;
    const iterationName = `__tail_iteration_${frame}`;
    const repeatName = `__tail_repeat_${frame}`;
    const transformed = this.transformBlock(node.body, node, returnName, iterationName, repeatName);
    const clearRepeat = this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(repeatName), node.location),
      this.stamp(new BoolLiteralNode(false), node.location),
    ), node.location);
    transformed.statements = [clearRepeat, ...(transformed.statements ?? [])];
    const loop = this.stamp(new WhileNode(
      this.stamp(new IdentifierNode(repeatName), node.location), transformed,
    ), node.location);
    const iteration = this.stamp(new VariableDefinitionNode(
      PrimitiveType.BIGINT, [], iterationName, this.stamp(new IntLiteralNode(0n), node.location),
    ), node.location);
    const repeat = this.stamp(new VariableDefinitionNode(
      PrimitiveType.BOOL, [], repeatName, this.stamp(new BoolLiteralNode(true), node.location),
    ), node.location);
    node.body = this.stamp(new BlockNode([iteration, repeat, loop]), node.location);
    return node;
  }

  private isSelfCall(node: Node | undefined, name: string): node is FunctionCallNode {
    return node instanceof FunctionCallNode && node.identifier.name === name;
  }

  private countSelfCalls(node: Node, name: string): number {
    let count = this.isSelfCall(node, name) ? 1 : 0;
    for (const [key, child] of Object.entries(node)) {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location'].includes(key)) continue;
      if (child instanceof Node) count += this.countSelfCalls(child, name);
      else if (Array.isArray(child)) {
        for (const item of child) if (item instanceof Node) count += this.countSelfCalls(item, name);
      }
    }
    return count;
  }

  private selfCallsHaveArity(node: Node, name: string, arity: number): boolean {
    if (this.isSelfCall(node, name) && node.parameters.length !== arity) return false;
    return Object.entries(node).every(([key, child]) => {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location'].includes(key)) return true;
      if (child instanceof Node) return this.selfCallsHaveArity(child, name, arity);
      return !Array.isArray(child) || child.every((item) =>
        !(item instanceof Node) || this.selfCallsHaveArity(item, name, arity));
    });
  }

  private hasNonRecursiveReturn(node: Node, name: string): boolean {
    if (node instanceof ReturnNode) {
      return node.expressions.length !== 1 || !this.isSelfCall(node.expressions[0], name);
    }
    return Object.entries(node).some(([key, child]) => {
      if (['resolvedFunction', 'definition', 'symbolTable', 'location'].includes(key)) return false;
      if (child instanceof Node) return this.hasNonRecursiveReturn(child, name);
      return Array.isArray(child) && child.some((item) =>
        item instanceof Node && this.hasNonRecursiveReturn(item, name));
    });
  }

  private validTailBlock(block: BlockNode, name: string, returnName: string): boolean {
    const statements = block.statements ?? [];
    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index];
      const calls = this.countSelfCalls(statement, name);
      if (calls === 0) continue;
      if (index !== statements.length - 1 || !this.validTailStatement(statement, name, returnName)) return false;
    }
    return true;
  }

  private validTailStatement(statement: StatementNode, name: string, returnName: string): boolean {
    if (statement instanceof AssignNode) {
      return statement.identifier.name === returnName && this.isSelfCall(statement.expression, name);
    }
    if (statement instanceof ReturnNode) {
      return statement.expressions.length === 1 && this.isSelfCall(statement.expressions[0], name);
    }
    if (statement instanceof BranchNode) {
      if (this.countSelfCalls(statement.condition, name) > 0) return false;
      return this.validTailBlock(statement.ifBlock, name, returnName)
        && (!statement.elseBlock || this.validTailBlock(statement.elseBlock, name, returnName));
    }
    if (statement instanceof BlockNode) return this.validTailBlock(statement, name, returnName);
    // A recursive call nested in an existing loop has different break/continue ownership and is not lowered.
    if (statement instanceof WhileNode || statement instanceof DoWhileNode) return false;
    return false;
  }

  private transformBlock(
    block: BlockNode, fn: FunctionDefinitionNode, returnName: string, iterationName: string, repeatName: string,
  ): BlockNode {
    block.statements = (block.statements ?? []).flatMap((statement) =>
      this.transformStatement(statement, fn, returnName, iterationName, repeatName));
    return block;
  }

  private transformStatement(
    statement: StatementNode, fn: FunctionDefinitionNode, returnName: string,
    iterationName: string, repeatName: string,
  ): StatementNode[] {
    if (statement instanceof AssignNode && statement.identifier.name === returnName
      && this.isSelfCall(statement.expression, fn.name)) {
      return this.recur(statement.expression, fn, iterationName, repeatName, statement.location);
    }
    if (statement instanceof ReturnNode) {
      if (statement.expressions.length === 1 && this.isSelfCall(statement.expressions[0], fn.name)) {
        return this.recur(statement.expressions[0], fn, iterationName, repeatName, statement.location);
      }
      return [statement];
    }
    if (statement instanceof BranchNode) {
      statement.ifBlock = this.transformBlock(statement.ifBlock, fn, returnName, iterationName, repeatName);
      if (statement.elseBlock) {
        statement.elseBlock = this.transformBlock(
          statement.elseBlock, fn, returnName, iterationName, repeatName,
        );
      }
    } else if (statement instanceof BlockNode) {
      return [this.transformBlock(statement, fn, returnName, iterationName, repeatName)];
    }
    return [statement];
  }

  private recur(
    call: FunctionCallNode, fn: FunctionDefinitionNode, iterationName: string,
    repeatName: string, location: Node['location'],
  ): StatementNode[] {
    const frame = this.counter++;
    const temps = fn.parameters.map((parameter, index) => {
      const name = `__tail_${frame}_${parameter.name}`;
      return this.stamp(new VariableDefinitionNode(parameter.type, [], name, call.parameters[index]), location);
    });
    const assignments = fn.parameters.map((parameter, index) => this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(parameter.name), location),
      this.stamp(new IdentifierNode(temps[index].name), location),
    ), location));
    const nextIteration = this.stamp(new BinaryOpNode(
      this.stamp(new IdentifierNode(iterationName), location), BinaryOperator.PLUS,
      this.stamp(new IntLiteralNode(1n), location),
    ), location);
    const increment = this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(iterationName), location), nextIteration,
    ), location);
    const repeat = this.stamp(new AssignNode(
      this.stamp(new IdentifierNode(repeatName), location), this.stamp(new BoolLiteralNode(true), location),
    ), location);
    return [...temps, ...assignments, increment, repeat];
  }

  private stamp<T extends Node>(node: T, location: Node['location']): T {
    node.location = location;
    return node;
  }
}
