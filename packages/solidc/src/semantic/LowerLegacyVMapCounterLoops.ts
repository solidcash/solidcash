import {
  ArrayAccessNode, ArrayAssignNode, AssignNode, BinaryOpNode, ContractNode, ExpressionNode,
  FunctionDefinitionNode, IdentifierNode, MappingDeleteNode, Node, ParameterNode, SourceFileNode, WhileNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { BinaryOperator } from '../ast/Operator.js';
import { ArrayType, IntType } from '@solidcash/utils';

const PREFIX = '__internal__vmapCounterPerm_';

/**
 * Preserve the deliberately narrow direct-compile lowering independently of kernel row-loop admission. It
 * supports only `for (int i = 0; i < n; i++) m[i] = f(i)`: its physical counter remains unchanged while the one
 * mapping key/value pair is evaluated through an SDK-supplied slot-order permutation.
 */
export default class LowerLegacyVMapCounterLoops extends AstTraversal {
  private collections = new Set<string>();
  private serial = 0;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.collections = new Set(node.collections.filter((collection) => collection.sorted)
      .map((collection) => collection.name));
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const added: ParameterNode[] = [];
    const lower = (candidate: Node): void => {
      if (candidate instanceof WhileNode) {
        const condition = candidate.condition;
        const statements = candidate.block.statements ?? [];
        const logical = condition instanceof BinaryOpNode && condition.operator === BinaryOperator.LT
          && condition.left instanceof IdentifierNode && condition.right instanceof IdentifierNode
          ? condition.left.name : undefined;
        const count = condition instanceof BinaryOpNode && condition.right instanceof IdentifierNode
          ? condition.right.name : undefined;
        const writes = statements.filter((statement) =>
          statement instanceof ArrayAssignNode || statement instanceof MappingDeleteNode) as
          Array<ArrayAssignNode | MappingDeleteNode>;
        let update: AssignNode | undefined;
        const findUpdate = (descendant: Node): void => {
          if (descendant instanceof AssignNode && descendant.identifier.name === logical) {
            update = descendant;
            return;
          }
          for (const key of Object.keys(descendant)) {
            if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type' || update) continue;
            const value = (descendant as unknown as Record<string, unknown>)[key];
            if (value instanceof Node) findUpdate(value);
            else if (Array.isArray(value)) for (const element of value) {
              if (element instanceof Node) findUpdate(element);
            }
          }
        };
        for (const statement of statements) {
          if (!(statement instanceof ArrayAssignNode) && !(statement instanceof MappingDeleteNode)) {
            findUpdate(statement);
          }
        }
        const canonicalUpdate = logical && update?.identifier.name === logical;
        const writeKey = writes[0] instanceof ArrayAssignNode ? writes[0].index : writes[0]?.keys[0];
        if (logical && count && writes.length === 1 && statements.length === 2 && canonicalUpdate
          && this.collections.has(writes[0].name) && writeKey instanceof IdentifierNode
          && writeKey.name === logical) {
          const hidden = `${PREFIX}${count}_${this.serial++}`;
          const physical = (): IdentifierNode => {
            const identifier = new IdentifierNode(logical);
            identifier.location = candidate.location;
            return identifier;
          };
          const permutationRead = (): ArrayAccessNode => {
            const array = new IdentifierNode(hidden);
            array.location = candidate.location;
            const read = new ArrayAccessNode(array, physical());
            read.location = candidate.location;
            return read;
          };
          const replace = (descendant: Node): Node => {
            if (descendant instanceof IdentifierNode && descendant.name === logical) return permutationRead();
            for (const key of Object.keys(descendant)) {
              if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
              const value = (descendant as unknown as Record<string, unknown>)[key];
              if (value instanceof Node) {
                (descendant as unknown as Record<string, unknown>)[key] = replace(value);
              } else if (Array.isArray(value)) {
                (descendant as unknown as Record<string, unknown>)[key] = value.map((element) =>
                  element instanceof Node ? replace(element) : element);
              }
            }
            return descendant;
          };
          const write = writes[0];
          if (write instanceof ArrayAssignNode) {
            write.index = permutationRead();
            write.value = replace(write.value) as ExpressionNode;
          } else {
            write.keys[0] = permutationRead();
          }
          const parameter = new ParameterNode(new ArrayType(new IntType(true, 256)), hidden);
          parameter.location = node.location;
          added.push(parameter);
        }
      }
      for (const key of Object.keys(candidate)) {
        if (key === 'location' || key === 'definition' || key === 'symbol' || key === 'type') continue;
        const value = (candidate as unknown as Record<string, unknown>)[key];
        if (value instanceof Node) lower(value);
        else if (Array.isArray(value)) for (const element of value) if (element instanceof Node) lower(element);
      }
    };
    lower(node.body);
    node.parameters.push(...added);
    return node;
  }
}
