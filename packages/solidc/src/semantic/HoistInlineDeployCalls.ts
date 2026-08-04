import {
  ContractNode,
  SourceFileNode,
  Node,
  StatementNode,
  BlockNode,
  VariableDefinitionNode,
  IdentifierNode,
  MethodCallNode,
  MethodCallStatementNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  FunctionDefinitionNode,
  ExpressionNode,
  InstantiationNode,
  TernaryOpNode,
  WhileNode,
  DoWhileNode,
  BinaryOpNode,
  ArrayPushNode,
  StateArrayPushNode,
  CastNode,
} from '../ast/AST.js';
import { AddressType } from '@solidcash/utils';
import { BinaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Hoists an inline deploy-receiver method call `(new C()).m(args)` / `new C().i()` into
 * `C __newcall_N = new C(); __newcall_N.m(args)`, so the existing deploy-then-call fold machinery
 * (which tracks NAMED deploy locals) applies unchanged - including the value-returning getter folds
 * (`return new C().i();`). Call options (`new C{value: v}()`) ride along on the hoisted instantiation.
 *
 * A deploy mints a child, so hoisting out of a conditionally-evaluated position would change effects;
 * ternary branches, loop conditions, and short-circuit right operands are not descended into (such a
 * call keeps its original - unsupported - shape and error).
 */
const PREFIX = '__newcall_';

export default class HoistInlineDeployCalls extends AstTraversal {
  private counter = 0;
  private hoists: StatementNode[] = [];

  visitSourceFile(node: SourceFileNode): Node {
    node.freeFunctions = this.visitList(node.freeFunctions) as FunctionDefinitionNode[];
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (node.body) node.body = this.visit(node.body) as BlockNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    const bodies = [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef];
    for (const fn of bodies) {
      if (fn?.body) fn.body = this.visit(fn.body) as BlockNode;
    }
    return node;
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const saved = this.hoists;
      this.hoists = [];
      const visited = this.visit(stmt) as StatementNode;
      out.push(...this.hoists, visited);
      this.hoists = saved;
    }
    node.statements = out;
    return node;
  }

  visitMethodCall(node: MethodCallNode): Node {
    const visited = super.visitMethodCall(node) as MethodCallNode; // hoist nested receivers first
    if (visited.object instanceof InstantiationNode) {
      const inst = visited.object;
      const tmpName = `${PREFIX}${this.counter++}`;
      const contractName = inst.identifier.name;
      const def = new VariableDefinitionNode(new AddressType(false, contractName), [], tmpName, inst);
      def.location = inst.location;
      this.hoists.push(def);
      // The no-option call becomes the NAMESPACED FunctionCall form (`__newcall_N.m(args)`) - the shape the
      // deploy-then-call FOLD route handles; a call-option form stays a MethodCall (not folded in v1).
      if (!visited.callOptions) {
        const id = new IdentifierNode(`${tmpName}.${visited.methodName}`);
        id.location = visited.location;
        const call = new FunctionCallNode(id, visited.parameters as ExpressionNode[]);
        if (visited.fieldNames) call.fieldNames = visited.fieldNames;
        call.location = visited.location;
        return call;
      }
      const read = new IdentifierNode(tmpName);
      read.location = inst.location;
      visited.object = read;
    }
    return visited;
  }

  // A deploy used directly as a state-array push value leaves its pending covenant stack items between the
  // array blob and the encoded element. Hoist the deploy to a local first, exactly as the inline-call case:
  // `a.push(new C())` -> `C __newcall_N = new C(); a.push(__newcall_N)`. Casts and one-argument struct
  // constructors preserve the same eager evaluation order and cover `a.push(address(new C()))` /
  // `rows.push(S(address(new C())))`.
  visitArrayPush(node: ArrayPushNode): Node {
    node.value = this.hoistPushDeploy(node.value);
    return super.visitArrayPush(node);
  }

  visitStateArrayPush(node: StateArrayPushNode): Node {
    node.value = this.hoistPushDeploy(node.value);
    return super.visitStateArrayPush(node);
  }

  private hoistPushDeploy(expr: ExpressionNode): ExpressionNode {
    if (expr instanceof InstantiationNode) {
      const tmpName = `${PREFIX}${this.counter++}`;
      const contractName = expr.identifier.name;
      const def = new VariableDefinitionNode(new AddressType(false, contractName), [], tmpName, expr);
      def.location = expr.location;
      this.hoists.push(def);
      const id = new IdentifierNode(tmpName);
      id.location = expr.location;
      return id;
    }
    if (expr instanceof CastNode) {
      expr.expression = this.hoistPushDeploy(expr.expression);
      return expr;
    }
    if (expr instanceof FunctionCallNode && expr.parameters.length === 1) {
      expr.parameters[0] = this.hoistPushDeploy(expr.parameters[0] as ExpressionNode);
      return expr;
    }
    return expr;
  }

  // A hoisted call replaces its MethodCallNode with a FunctionCallNode; re-wrap the statement to match.
  visitMethodCallStatement(node: MethodCallStatementNode): Node {
    const result = this.visit(node.call);
    if (result instanceof FunctionCallNode) {
      const stmt = new FunctionCallStatementNode(result);
      stmt.location = node.location;
      return stmt;
    }
    node.call = result as MethodCallNode;
    return node;
  }

  // Conditionally-evaluated positions must not have deploys hoisted out of them (a deploy mints a child).
  visitTernaryOp(node: TernaryOpNode): Node {
    node.condition = this.visit(node.condition);
    return node;
  }

  visitWhile(node: WhileNode): Node {
    node.block = this.visit(node.block) as StatementNode;
    return node;
  }

  visitDoWhile(node: DoWhileNode): Node {
    node.block = this.visit(node.block) as StatementNode;
    return node;
  }

  visitBinaryOp(node: BinaryOpNode): Node {
    node.left = this.visit(node.left);
    if (node.operator !== BinaryOperator.AND && node.operator !== BinaryOperator.OR) {
      node.right = this.visit(node.right);
    }
    return node;
  }
}
