import {
  FunctionDefinitionNode, VariableDefinitionNode, AssignNode, IdentifierNode, Node,
  WhileNode, DoWhileNode, CollectionIterationNode, BranchNode,
} from '../ast/AST.js';
import { Type } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

/** `__fnelem_3`, `__fnelem_r3`, `__fnelemsel_3`, `__fnelemsel_r3`: the fn-ptr lowering's element companions. */
const POINTER_TABLE_LOCAL = /^__fnelem(sel)?_r?\d+$/;

/**
 * Hoists the DECLARATION of a function-pointer element and its runtime-selector companion out of a branch, so a
 * conditionally reached pointer-table row still reaches the function epilogue.
 *
 * A bounded pointer table expands to one guarded row per admitted occurrence: `if (2 < n) { table[2](v); }`. The
 * fn-ptr lowering then hoists `address __fnelem_2 = table[2];` and `bytes4 __fnelemsel_2 = ...` immediately
 * before the call, which is inside the branch, and `emitExternalCallVerification` later fails with "Expected
 * variable '__fnelemsel_2' does not exist on the stack".
 *
 * Only the declaration moves: the element and selector READS stay inside the branch, so a row beyond the runtime
 * table length is never read. When the branch is not taken the function-top local holds its zero default and the
 * direct co-spend check fails closed, which is the established conditional-external-call behavior shared with
 * CaptureBranchExternalCallTargets. Loop-declared and multiply-declared names are left untouched: those belong to
 * the per-iteration loop dispatch, not to a single captured value.
 */
export default class HoistPointerTableBranchLocals extends AstTraversal {
  override visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (!node.body?.statements) return node;
    const topNames = new Set(node.body.statements
      .filter((statement) => statement instanceof VariableDefinitionNode)
      .map((statement) => (statement as VariableDefinitionNode).name));

    const declarations = new Map<string, number>();
    const loopDeclared = new Set<string>();
    const branchDeclared = new Set<string>();
    const scan = (value: unknown, loopDepth: number, branchDepth: number): void => {
      if (!value || typeof value !== 'object') return;
      if (value instanceof VariableDefinitionNode && POINTER_TABLE_LOCAL.test(value.name)) {
        declarations.set(value.name, (declarations.get(value.name) ?? 0) + 1);
        if (loopDepth > 0) loopDeclared.add(value.name);
        if (branchDepth > 0) branchDeclared.add(value.name);
      }
      const nextLoop = (value instanceof WhileNode || value instanceof DoWhileNode
        || value instanceof CollectionIterationNode) ? loopDepth + 1 : loopDepth;
      const nextBranch = value instanceof BranchNode ? branchDepth + 1 : branchDepth;
      for (const key of Object.keys(value as object)) {
        if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
        const child = (value as Record<string, unknown>)[key];
        if (Array.isArray(child)) child.forEach((item) => scan(item, nextLoop, nextBranch));
        else if (child && typeof child === 'object') scan(child, nextLoop, nextBranch);
      }
    };
    scan(node.body, 0, 0);

    const hoist = new Set([...branchDeclared].filter((name) =>
      !topNames.has(name) && !loopDeclared.has(name) && declarations.get(name) === 1));
    if (hoist.size === 0) return node;

    const hoistedTypes = new Map<string, Type>();
    const replace = (current: Node): void => {
      for (const key of Object.keys(current as object)) {
        if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
        const child = (current as unknown as Record<string, unknown>)[key];
        if (Array.isArray(child)) {
          for (let index = 0; index < child.length; index += 1) {
            const item = child[index];
            if (item instanceof VariableDefinitionNode && hoist.has(item.name) && item.expression) {
              hoistedTypes.set(item.name, item.type);
              const identifier = new IdentifierNode(item.name);
              identifier.location = item.location;
              const assign = new AssignNode(identifier, item.expression);
              assign.location = item.location;
              child[index] = assign;
            } else if (item instanceof Node) replace(item);
          }
        } else if (child instanceof Node) replace(child);
      }
    };
    replace(node.body);
    if (hoistedTypes.size === 0) return node;

    const declared = [...hoistedTypes.entries()].map(([name, type]) => {
      const definition = new VariableDefinitionNode(type, [], name);
      definition.location = node.location;
      return definition;
    });
    node.body.statements = [...declared, ...node.body.statements];
    return node;
  }
}
