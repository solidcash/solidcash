import AstTraversal from '../ast/AstTraversal.js';
import {
  BlockNode, FunctionCallNode, FunctionDefinitionNode, IdentifierNode, MethodCallStatementNode, Node,
} from '../ast/AST.js';
import type { FramedCreateSite } from './LowerFramedCreate2Address.js';

/**
 * Folds a creator's `initialize` call on the child it just created into the child's genesis.
 *
 * The creating frame cannot run the child's frame: the child's masters are outputs of this transaction, and a framed
 * frame runs on a master it spends. The call's effects are instead part of the child's genesis state, which a builder
 * derives (`deriveFramedGenesis`'s initializer pass). This pass:
 *
 * - copies the call's published argument sources onto the create site (`composition.creates[].foldedCall`), so a
 *   builder can evaluate them over the creating entry's own arguments;
 * - removes the call's external-call slot, so the creator's body records no call to the child;
 * - removes the call statement, so the creator's program never emits it.
 *
 * It runs after semantic analysis, which is what publishes the argument sources, and before code generation.
 */
export default class FoldFramedCreate2Initializer extends AstTraversal {
  /** The statements this pass drops from their blocks. */
  private readonly dropped = new Set<MethodCallStatementNode>();

  public constructor(private readonly creates: readonly FramedCreateSite[]) {
    super();
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const slots = node.externalCalls ?? [];
    if (slots.length > 0 && node.body !== undefined) {
      // Resolve every folded statement before the body is visited, so `visitBlock` can drop it.
      const droppedSlots = new Set<(typeof slots)[number]>();
      for (const statement of statementsOf(node.body)) {
        if (!(statement instanceof MethodCallStatementNode)) continue;
        const mark = this.markOf(statement);
        if (mark === undefined) continue;
        const slot = slots.find((candidate) => candidate.functionName === mark.functionName
          && candidate.interfaceName === mark.interfaceName && candidate.addressParam === mark.targetLocal);
        if (slot === undefined) continue;
        mark.site.foldedCall = {
          interfaceName: slot.interfaceName,
          functionName: slot.functionName,
          argumentSources: [...(slot.argSources ?? [])] as unknown as readonly import('@solidcash/utils').ArgSource[],
        };
        this.dropped.add(statement);
        droppedSlots.add(slot);
      }
      if (droppedSlots.size > 0) {
        node.externalCalls = slots.filter((slot) => !droppedSlots.has(slot));
      }
    }
    return super.visitFunctionDefinition(node);
  }

  visitBlock(node: BlockNode): Node {
    const visited = super.visitBlock(node) as BlockNode;
    if (this.dropped.size > 0 && visited.statements !== undefined) {
      visited.statements = visited.statements.filter(
        (statement) => !this.dropped.has(statement as MethodCallStatementNode),
      );
    }
    return visited;
  }

  /** The pattern a call must have to be the folded initializer, and the site it belongs to. */
  private markOf(statement: MethodCallStatementNode): {
    readonly site: FramedCreateSite;
    readonly interfaceName: string;
    readonly functionName: string;
    readonly targetLocal: string;
  } | undefined {
    const call = statement.call;
    const object = call.object;
    if (call.methodName === undefined || !(object instanceof FunctionCallNode)
      || !(object.identifier instanceof IdentifierNode)
      || object.parameters.length !== 1 || !(object.parameters[0] instanceof IdentifierNode)) {
      return undefined;
    }
    const interfaceName = object.identifier.name;
    const targetLocal = object.parameters[0].name;
    const site = this.creates.find((candidate) => candidate.initializer?.interfaceName === interfaceName
      && candidate.initializer.functionName === call.methodName
      && candidate.initializer.targetLocal === targetLocal);
    return site === undefined ? undefined : { site, interfaceName, functionName: call.methodName, targetLocal };
  }
}

/** Every statement under `root`, depth first. */
function statementsOf(root: Node): readonly Node[] {
  const found: Node[] = [];
  const walk = (value: unknown, seen: Set<object>): void => {
    if (value === null || typeof value !== 'object' || seen.has(value as object)) return;
    if (value instanceof Node) {
      seen.add(value as object);
      const statements = (value as unknown as { statements?: readonly Node[] }).statements;
      if (Array.isArray(statements)) found.push(...statements);
    }
    for (const item of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(item)) for (const child of item) walk(child, seen);
      else walk(item, seen);
    }
  };
  walk(root, new Set());
  return found;
}
