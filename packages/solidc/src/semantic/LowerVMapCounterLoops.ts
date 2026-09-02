import {
  ArrayAccessNode, ArrayAssignNode, ArrayDeleteNode, AssignNode, BinaryOpNode, BreakNode, ContinueNode,
  ContractNode, DoWhileNode, ExpressionNode,
  FunctionDefinitionNode, IdentifierNode, MappingAssignNode, MappingDeleteNode, Node, ParameterNode,
  SourceFileNode, WhileNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { BinaryOperator } from '../ast/Operator.js';
import { ArrayType, IntType } from '@solidcash/utils';

export const VMAP_COUNTER_PERM_PREFIX = '__internal__vmapCounterPerm_';
const PREFIX = VMAP_COUNTER_PERM_PREFIX;

/**
 * Lower the deliberately narrow, order-independent vmap counter loop
 *   for (int i=0; i<n; i++) { m[i] = f(i); I(dest).r(i); }
 * to execute logical indices through an SDK-supplied slot-order permutation. The physical loop counter and its
 * update remain untouched; the mapping write's index/value and other uses of `i` in the body (except the
 * increment) are rewritten to perm[i]. This lets the active vmap upsert-loop covenant process hash slots in
 * ascending order while keeping a paired typed call / transfer on the same logical key.
 * `continue`/`break` still skip the rewrite: a permutation of 0..n-1 is not a skip-set.
 */
export default class LowerVMapCounterLoops extends AstTraversal {
  private collections = new Set<string>();
  private serial = 0;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.collections = new Set(node.collections.filter((c) => c.sorted).map((c) => c.name));
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const added: ParameterNode[] = [];
    const isWrite = (s: Node): s is ArrayAssignNode | ArrayDeleteNode | MappingAssignNode | MappingDeleteNode =>
      s instanceof ArrayAssignNode || s instanceof ArrayDeleteNode
      || s instanceof MappingAssignNode || s instanceof MappingDeleteNode;
    const writeKeyOf = (write: ArrayAssignNode | ArrayDeleteNode | MappingAssignNode | MappingDeleteNode):
    ExpressionNode =>
      write instanceof ArrayAssignNode || write instanceof ArrayDeleteNode ? write.index : write.keys[0];
    const hasJump = (x: Node): boolean => {
      if (x instanceof ContinueNode || x instanceof BreakNode) return true;
      for (const key of Object.keys(x)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
        const v = (x as unknown as Record<string, unknown>)[key];
        if (v instanceof Node && hasJump(v)) return true;
        if (Array.isArray(v) && v.some((e) => e instanceof Node && hasJump(e))) return true;
      }
      return false;
    };
    const tryLower = (condition: ExpressionNode, block: Node, location: typeof node.location): void => {
      const stmts = ('statements' in block && Array.isArray((block as { statements?: Node[] }).statements))
        ? (block as { statements: Node[] }).statements : [];
      const logical = condition instanceof BinaryOpNode && condition.operator === BinaryOperator.LT
        && condition.left instanceof IdentifierNode && condition.right instanceof IdentifierNode
        ? condition.left.name : undefined;
      const count = condition instanceof BinaryOpNode && condition.right instanceof IdentifierNode
        ? condition.right.name : undefined;
      const writes = stmts.filter(isWrite);
      let update: AssignNode | undefined;
      const findUpdate = (x: Node): void => {
        if (x instanceof AssignNode && x.identifier.name === logical) { update = x; return; }
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type' || update) continue;
          const v = (x as unknown as Record<string, unknown>)[key];
          if (v instanceof Node) findUpdate(v);
          else if (Array.isArray(v)) for (const e of v) if (e instanceof Node) findUpdate(e);
        }
      };
      for (const s of stmts) if (!isWrite(s)) findUpdate(s);
      const canonicalUpdate = logical && update?.identifier.name === logical;
      const keyed = writes.filter((write) => {
        const key = writeKeyOf(write);
        return this.collections.has(write.name) && key instanceof IdentifierNode && key.name === logical;
      });
      if (!logical || !count || !canonicalUpdate || keyed.length === 0 || keyed.length !== writes.length
        || hasJump(block)) return;
      const hidden = `${PREFIX}${count}_${this.serial++}`;
      const physical = (): IdentifierNode => {
        const id = new IdentifierNode(logical); id.location = location; return id;
      };
      const permRead = (): ArrayAccessNode => {
        const a = new IdentifierNode(hidden); a.location = location;
        const r = new ArrayAccessNode(a, physical()); r.location = location; return r;
      };
      const replace = (x: Node): Node => {
        if (x instanceof IdentifierNode && x.name === logical) return permRead();
        for (const key of Object.keys(x)) {
          if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
          const v = (x as unknown as Record<string, unknown>)[key];
          if (v instanceof Node) (x as unknown as Record<string, unknown>)[key] = replace(v);
          else if (Array.isArray(v)) {
            (x as unknown as Record<string, unknown>)[key] = v.map((e) => e instanceof Node ? replace(e) : e);
          }
        }
        return x;
      };
      const writeSet = new Set<Node>(keyed);
      for (const write of keyed) {
        if (write instanceof ArrayAssignNode) {
          write.index = permRead();
          write.value = replace(write.value) as ExpressionNode;
        } else if (write instanceof ArrayDeleteNode) {
          write.index = permRead();
        } else if (write instanceof MappingAssignNode) {
          write.keys[0] = permRead();
          write.expression = replace(write.expression) as ExpressionNode;
        } else {
          write.keys[0] = permRead();
        }
      }
      for (const statement of stmts) {
        if (writeSet.has(statement)) continue;
        if (statement instanceof AssignNode && statement.identifier.name === logical) continue;
        replace(statement);
      }
      const p = new ParameterNode(new ArrayType(new IntType(true, 256)), hidden);
      p.location = node.location;
      added.push(p);
    };
    const lower = (n: Node): void => {
      if (n instanceof WhileNode || n instanceof DoWhileNode) tryLower(n.condition, n.block, n.location);
      for (const key of Object.keys(n)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) lower(v);
        else if (Array.isArray(v)) for (const e of v) if (e instanceof Node) lower(e);
      }
    };
    lower(node.body);
    node.parameters.push(...added);
    return node;
  }
}
