import AstTraversal from '../ast/AstTraversal.js';
import {
  BlockNode, type ExpressionNode, FunctionCallNode, FunctionDefinitionNode, IdentifierNode, MethodCallStatementNode,
  Node, NullaryOpNode,
} from '../ast/AST.js';
import { NullaryOperator } from '../ast/Operator.js';
import { SolidcDiagnosticError } from '../Errors.js';
import { emitCompilerWarning } from '../warnings.js';
import type { FramedChildGenesisReplay } from '../framed/child-genesis-replay.js';
import type { FramedCreateSite } from './LowerFramedCreate2Address.js';

/**
 * The genesis a creating body replays for the child it creates by name, given the initializer it folds (its name and
 * the creator's argument expressions). Supplied by the compile, which holds the child's declaration.
 */
export type FramedGenesisReplayer = (
  contractName: string,
  initializer?: { readonly functionName: string; readonly args: readonly ExpressionNode[] },
) => FramedChildGenesisReplay;

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
 * - removes the call statement, so the creator's program never emits it;
 * - gives each `create2` of a child the compile unit holds the genesis its creating body replays (constructor, then
 *   the folded initializer over the creator's arguments), which code generation requires the transaction to mint.
 *
 * It runs after semantic analysis, which is what publishes the argument sources, and before code generation.
 */
export default class FoldFramedCreate2Initializer extends AstTraversal {
  /** The statements this pass drops from their blocks. */
  private readonly dropped = new Set<MethodCallStatementNode>();

  public constructor(
    private readonly creates: readonly FramedCreateSite[],
    private readonly replay?: FramedGenesisReplayer,
  ) {
    super();
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const slots = node.externalCalls ?? [];
    // The initializers this body folds, with the creator's argument expressions, for the genesis each creation replays.
    const folded: { readonly contractName?: string; readonly functionName: string; readonly args: ExpressionNode[] }[] = [];
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
        folded.push({
          ...(mark.site.contractName === undefined ? {} : { contractName: mark.site.contractName }),
          functionName: mark.functionName,
          args: [...statement.call.parameters],
        });
        this.dropped.add(statement);
        droppedSlots.add(slot);
      }
      if (droppedSlots.size > 0) {
        node.externalCalls = slots.filter((slot) => !droppedSlots.has(slot));
      }
    }
    if (this.replay !== undefined && node.body !== undefined) this.replayCreations(node, folded);
    return super.visitFunctionDefinition(node);
  }

  /**
   * Gives each `create2` in `node` of a child the compile unit holds the genesis its body replays. A creation from a
   * code value (`codeStateVariable`) has no child to replay; code generation refuses it.
   */
  private replayCreations(
    node: FunctionDefinitionNode,
    folded: readonly { readonly contractName?: string; readonly functionName: string; readonly args: ExpressionNode[] }[],
  ): void {
    const creations = childAddressesOf(node.body!);
    for (const creation of creations) {
      const contractName = creation.framedCreation?.contractName;
      if (contractName === undefined) {
        emitCompilerWarning(`Warning: '${node.name}' creates a child from the code value `
          + `'${creation.framedCreation?.codeStateVariable ?? 'unknown'}', which names no contract this unit holds: its `
          + 'creating body cannot replay the child\'s genesis, so every such creation is refused on chain '
          + '(docs/framed/CREATE2_IDENTITY.md, "The genesis replay")');
        continue;
      }
      const initializers = folded.filter((candidate) => candidate.contractName === contractName);
      const twins = creations.filter((other) => other.framedCreation?.contractName === contractName);
      if (initializers.length > 1 || (initializers.length === 1 && twins.length > 1)) {
        throw new SolidcDiagnosticError(
          'FRAMED_CODEGEN_UNAVAILABLE',
          `'${node.name}' creates "${contractName}" more than once and initializes it, so which genesis each creation `
          + 'replays is ambiguous',
          { requested: 'framed', reason: 'create2-genesis-replay', contract: contractName },
        );
      }
      creation.framedGenesis = this.replay!(contractName, initializers[0] === undefined ? undefined : {
        functionName: initializers[0].functionName, args: initializers[0].args,
      });
    }
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

/** Every framed `create2` value under `root`. */
function childAddressesOf(root: Node): NullaryOpNode[] {
  const found: NullaryOpNode[] = [];
  const seen = new Set<object>();
  const walk = (value: unknown): void => {
    if (value === null || typeof value !== 'object' || seen.has(value as object)) return;
    seen.add(value as object);
    if (value instanceof NullaryOpNode && value.operator === NullaryOperator.CHILD_ADDRESS) found.push(value);
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!(value instanceof Node)) return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'definition' || key === 'referencedContract' || key === 'resolvedFunction' || key === 'type'
        || key === 'location' || key === 'symbolTable' || key === 'functionReference') continue;
      walk(child);
    }
  };
  walk(root);
  return found;
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
