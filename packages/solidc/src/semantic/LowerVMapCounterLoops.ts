import {
  ArrayAccessNode, ArrayAssignNode, AssignNode, BinaryOpNode, ContractNode, ExpressionNode,
  FunctionDefinitionNode, IdentifierNode, MappingDeleteNode, Node, ParameterNode, SourceFileNode, WhileNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { BinaryOperator } from '../ast/Operator.js';
import { ArrayType, IntType } from '@solidcash/utils';

const PREFIX = '__internal__vmapCounterPerm_';

/**
 * Lower the deliberately narrow, order-independent vmap counter loop
 *   for (int i=0; i<n; i++) m[i] = f(i)
 * to execute logical indices through an SDK-supplied slot-order permutation. The physical loop counter and its
 * update remain untouched; only the single mapping write's index/value are rewritten to perm[i]. This lets the
 * active vmap upsert-loop covenant process hash slots in ascending order without reordering any other side effect.
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
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const added: ParameterNode[] = [];
    const lower = (n: Node): void => {
      if (n instanceof WhileNode) {
        const condition = n.condition;
        const stmts = n.block.statements ?? [];
        const logical = condition instanceof BinaryOpNode && condition.operator === BinaryOperator.LT
          && condition.left instanceof IdentifierNode && condition.right instanceof IdentifierNode
          ? condition.left.name : undefined;
        const count = condition instanceof BinaryOpNode && condition.right instanceof IdentifierNode
          ? condition.right.name : undefined;
        const writes = stmts.filter((s) => s instanceof ArrayAssignNode || s instanceof MappingDeleteNode) as
          Array<ArrayAssignNode | MappingDeleteNode>;
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
        for (const s of stmts) if (!(s instanceof ArrayAssignNode) && !(s instanceof MappingDeleteNode)) findUpdate(s);
        const canonicalUpdate = logical && update?.identifier.name === logical;
        const writeKey = writes[0] instanceof ArrayAssignNode ? writes[0].index : writes[0]?.keys[0];
        if (logical && count && writes.length === 1 && stmts.length === 2 && canonicalUpdate
          && this.collections.has(writes[0].name) && writeKey instanceof IdentifierNode
          && writeKey.name === logical) {
          const hidden = `${PREFIX}${count}_${this.serial++}`;
          const physical = (): IdentifierNode => {
            const id = new IdentifierNode(logical); id.location = n.location; return id;
          };
          const permRead = (): ArrayAccessNode => {
            const a = new IdentifierNode(hidden); a.location = n.location;
            const r = new ArrayAccessNode(a, physical()); r.location = n.location; return r;
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
          const write = writes[0];
          if (write instanceof ArrayAssignNode) {
            write.index = permRead();
            write.value = replace(write.value) as ExpressionNode;
          } else {
            write.keys[0] = permRead();
          }
          const p = new ParameterNode(new ArrayType(new IntType(true, 256)), hidden);
          p.location = node.location;
          added.push(p);
        }
      }
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
