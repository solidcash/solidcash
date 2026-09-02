import {
  Node,
  BlockNode,
  BranchNode,
  SwitchNode,
  TryCatchNode,
  TransferStatementNode,
  AddressTransferStatementNode,
  AddressSendExpressionNode,
  LowLevelCallStatementNode,
  MethodCallStatementNode,
  EmitStatementNode,
  TokenContainerMethodStatementNode,
  StateAssignNode,
  DeleteStateNode,
  MappingAssignNode,
  MappingDeleteNode,
  StateArrayPushNode,
  StateArrayPopNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
  InstantiationNode,
  BranchOps,
  ReturnNode,
  RevertNode,
  IntLiteralNode,
  ExpressionNode,
  IdentifierNode,
  VariableDefinitionNode,
  ConstantDefinitionNode,
  CastNode,
  UnaryOpNode,
} from '../ast/AST.js';
import { UnaryOperator } from '../ast/Operator.js';

// Restricted (pre-allocated) operation counts for one block: writes/transfers/emits that a branch must reserve
// stack slots for before its condition, so a conditionally-taken write still reaches the function epilogue.
export interface OpCounts {
  transfers: number;
  emits: number;
  tokenContainerTransfers: number;
  stateWriteKeys: Set<string>;    // "nftIndex:fieldIndex"
  mappingWriteSlots: Set<number>;
  mappingDeleteSlots: Set<number>;
}

function emptyCounts(): OpCounts {
  return {
    transfers: 0,
    emits: 0,
    tokenContainerTransfers: 0,
    stateWriteKeys: new Set<string>(),
    mappingWriteSlots: new Set<number>(),
    mappingDeleteSlots: new Set<number>(),
  };
}

/**
 * Whether an expression is a compile-time zero for transaction-topology purposes.
 *
 * Inlining deliberately preserves value-parameter copies as compiler-owned SSA aliases (`__rh*`/`__inl*`).
 * Following only those aliases (plus actual constants) recognizes an imported helper called with zero without
 * assuming that an ordinary user local still equals its initializer after later assignments.
 */
export function isStaticallyZeroCallValue(
  value: ExpressionNode | undefined, seen: Set<ExpressionNode> = new Set<ExpressionNode>(),
): boolean {
  if (!value || seen.has(value)) return false;
  seen.add(value);
  if (value instanceof IntLiteralNode) return value.value === 0n;
  if (value instanceof CastNode) return isStaticallyZeroCallValue(value.expression, seen);
  if (value instanceof UnaryOpNode && value.operator === UnaryOperator.NEGATE) {
    return isStaticallyZeroCallValue(value.expression, seen);
  }
  if (!(value instanceof IdentifierNode)) return false;
  const definition = value.definition?.definition;
  if (definition instanceof ConstantDefinitionNode) {
    return isStaticallyZeroCallValue(definition.expression, seen);
  }
  if (definition instanceof VariableDefinitionNode
      && /^__(?:rh|inl)/.test(definition.name) && definition.expression) {
    return isStaticallyZeroCallValue(definition.expression, seen);
  }
  return false;
}

/** A statically-zero `{value:}` is transactionally identical to omitting the value option. */
export function hasEffectiveCallValue(value: ExpressionNode | undefined): value is ExpressionNode {
  return value !== undefined && !isStaticallyZeroCallValue(value);
}

export function countBranchOps(block: BlockNode): OpCounts {
  const result = emptyCounts();
  countBranchOpsRecursive(block, result);
  return result;
}

/** Whether every execution of this block exits before reaching the enclosing function epilogue. */
function blockTerminates(block: BlockNode | undefined): boolean {
  const last = block?.statements?.at(-1);
  if (last instanceof ReturnNode || last instanceof RevertNode) return true;
  return last instanceof BranchNode
    && blockTerminates(last.ifBlock)
    && last.elseBlock !== undefined
    && blockTerminates(last.elseBlock);
}

function isValueTransferNode(node: Node): boolean {
  return node instanceof TransferStatementNode || node instanceof AddressTransferStatementNode
    || node instanceof AddressSendExpressionNode
    || (node instanceof LowLevelCallStatementNode && hasEffectiveCallValue(node.callOptions?.value))
    || (node instanceof MethodCallStatementNode && hasEffectiveCallValue(node.call.callOptions?.value))
    // `new C{value: x}()` transfers x from the contract's satoshi container to the child - a value transfer.
    || (node instanceof InstantiationNode && hasEffectiveCallValue(node.callOptions?.value));
}

// Min and max value-transfers on any single execution path through `node`. Branch/switch arms are MUTUALLY
// EXCLUSIVE (only one runs), so they contribute max(arms) to the max and min(arms) to the min - NOT their sum;
// sequential statements sum. This pins how many transfer slots to pre-allocate (max) and which are conditional
// (min < max => may not execute). A plain count sums nested/else-if arms, over-allocating slots AND mis-marking a
// conditional transfer as always-happening. Flat if/else has no nested branch, so min===max===count (unchanged).
export function isDirectOwnerTransferNode(node: Node): boolean {
  return node instanceof TransferStatementNode || node instanceof AddressTransferStatementNode
    || node instanceof AddressSendExpressionNode;
}

export function countTransfersMinMax(
  node: Node, isTransfer: (candidate: Node) => boolean = isValueTransferNode,
): { min: number; max: number } {
  if (node instanceof BranchNode) {
    const i = countTransfersMinMax(node.ifBlock, isTransfer);
    const e = node.elseBlock ? countTransfersMinMax(node.elseBlock, isTransfer) : { min: 0, max: 0 };
    return { min: Math.min(i.min, e.min), max: Math.max(i.max, e.max) };
  }
  if (node instanceof SwitchNode) {
    const arms = node.cases.map((c) => countTransfersMinMax(c.body, isTransfer));
    if (node.defaultCase) arms.push(countTransfersMinMax(node.defaultCase, isTransfer));
    // No default: the value may match no case, so a path with zero transfers exists (min 0).
    const min = node.defaultCase && arms.length > 0 ? Math.min(...arms.map((a) => a.min)) : 0;
    const max = arms.length > 0 ? Math.max(...arms.map((a) => a.max)) : 0;
    return { min, max };
  }
  if (node instanceof TryCatchNode) return countTransfersMinMax(node.tryBlock, isTransfer);
  const self = isTransfer(node) ? 1 : 0;
  let min = self;
  let max = self;
  const children: Node[] = [];
  const anyNode = node as unknown as {
    statements?: unknown; body?: unknown; block?: unknown; expression?: unknown;
  };
  if (Array.isArray(anyNode.statements)) children.push(...(anyNode.statements as Node[]));
  if (anyNode.body) children.push(anyNode.body as Node);
  if (anyNode.block) children.push(anyNode.block as Node);
  // A var-def / expression-statement initializer may BE a `new C{value:}()` (a value transfer).
  if (anyNode.expression instanceof Node) children.push(anyNode.expression);
  for (const child of children) {
    const c = countTransfersMinMax(child, isTransfer);
    min += c.min;
    max += c.max;
  }
  return { min, max };
}

function countBranchOpsRecursive(node: Node, result: OpCounts): void {
  if (node instanceof TransferStatementNode || node instanceof AddressTransferStatementNode
    || node instanceof AddressSendExpressionNode) {
    result.transfers++;
    return;
  }
  // {value: X} call option creates an implicit transfer
  if (node instanceof LowLevelCallStatementNode && hasEffectiveCallValue(node.callOptions?.value)) {
    result.transfers++;
    // Don't return - we still need to recurse into child nodes
  }
  if (node instanceof MethodCallStatementNode && hasEffectiveCallValue(node.call.callOptions?.value)) {
    result.transfers++;
  }
  // `new C{value: x}()` transfers x from the contract's satoshi container to the child.
  if (node instanceof InstantiationNode && hasEffectiveCallValue(node.callOptions?.value)) {
    result.transfers++;
  }
  if (node instanceof EmitStatementNode) {
    result.emits++;
    return;
  }
  if (node instanceof TokenContainerMethodStatementNode) {
    result.tokenContainerTransfers++;
    return;
  }
  if (node instanceof StateAssignNode && node.stateVariable) {
    result.stateWriteKeys.add(`${node.stateVariable.nftIndex}:${node.stateVariable.fieldIndex}`);
    return;
  }
  if (node instanceof DeleteStateNode && node.stateVariable) {
    result.stateWriteKeys.add(`${node.stateVariable.nftIndex}:${node.stateVariable.fieldIndex}`);
    return;
  }
  if (node instanceof MappingAssignNode) {
    if (node.entrySlotIndex >= 0) result.mappingWriteSlots.add(node.entrySlotIndex);
    return;
  }
  if (node instanceof MappingDeleteNode) {
    if (node.entrySlotIndex >= 0) result.mappingDeleteSlots.add(node.entrySlotIndex);
    return;
  }
  if ((node instanceof StateArrayPushNode || node instanceof StateArrayPopNode
    || node instanceof StateArrayAssignNode || node instanceof StateArrayDeleteNode)
    && node.stateVariable) {
    result.stateWriteKeys.add(`${node.stateVariable.nftIndex}:${node.stateVariable.fieldIndex}`);
    return;
  }
  // For nested branches, recurse into both arms
  if (node instanceof BranchNode) {
    countBranchOpsRecursive(node.ifBlock, result);
    if (node.elseBlock) countBranchOpsRecursive(node.elseBlock, result);
    return;
  }
  // For try/catch, only recurse into try block (catch is dead code)
  if (node instanceof TryCatchNode) {
    countBranchOpsRecursive(node.tryBlock, result);
    return;
  }
  // For switch, recurse into all cases and default
  if (node instanceof SwitchNode) {
    for (const c of node.cases) {
      countBranchOpsRecursive(c.body, result);
    }
    if (node.defaultCase) countBranchOpsRecursive(node.defaultCase, result);
    return;
  }
  // Generic recursion
  if ('statements' in node && Array.isArray((node as any).statements)) {
    for (const stmt of (node as any).statements) {
      countBranchOpsRecursive(stmt, result);
    }
  }
  if ('body' in node && (node as any).body) {
    countBranchOpsRecursive((node as any).body, result);
  }
  if ('block' in node && (node as any).block) {
    countBranchOpsRecursive((node as any).block, result);
  }
  // A var-def / expression-statement initializer may BE a `new C{value:}()` (a value transfer).
  if ('expression' in node && (node as any).expression instanceof Node) {
    countBranchOpsRecursive((node as any).expression, result);
  }
}

// Assemble the BranchOps for an if/else pair, or undefined when neither arm has a restricted operation. Used by
// SymbolTableTraversal (initial computation) and EarlyReturnTransformation (recompute after nesting rewrites the
// arms, e.g. a `return;`/`revert` guard whose following statements become the else block).
export function computeBranchOps(ifBlock: BlockNode, elseBlock?: BlockNode): BranchOps | undefined {
  const ifCounts = countBranchOps(ifBlock);
  const elseCounts = elseBlock ? countBranchOps(elseBlock) : emptyCounts();

  const hasOps = ifCounts.transfers > 0 || ifCounts.emits > 0 || ifCounts.tokenContainerTransfers > 0
    || ifCounts.stateWriteKeys.size > 0 || ifCounts.mappingWriteSlots.size > 0
    || ifCounts.mappingDeleteSlots.size > 0
    || elseCounts.transfers > 0 || elseCounts.emits > 0 || elseCounts.tokenContainerTransfers > 0
    || elseCounts.stateWriteKeys.size > 0 || elseCounts.mappingWriteSlots.size > 0
    || elseCounts.mappingDeleteSlots.size > 0;

  if (!hasOps) return undefined;

  // Transfers use the min/max path model (mutually-exclusive branch arms don't sum), so nested/else-if value
  // transfers pre-allocate the right slot count and mark conditional transfers correctly. Emits/token-container
  // keep the existing per-arm count (their nested-branch handling is unchanged here).
  const ifT = countTransfersMinMax(ifBlock);
  const elseT = elseBlock ? countTransfersMinMax(elseBlock) : { min: 0, max: 0 };
  const ifTerminates = blockTerminates(ifBlock);
  const elseTerminates = blockTerminates(elseBlock);
  const reachableMin = (ifValue: number, elseValue: number): number => {
    if (ifTerminates && !elseTerminates) return elseValue;
    if (elseTerminates && !ifTerminates) return ifValue;
    return Math.min(ifValue, elseValue);
  };

  return {
    stateWriteKeys: new Set<string>([...ifCounts.stateWriteKeys, ...elseCounts.stateWriteKeys]),
    mappingWriteSlots: new Set<number>([...ifCounts.mappingWriteSlots, ...elseCounts.mappingWriteSlots]),
    mappingDeleteSlots: new Set<number>([...ifCounts.mappingDeleteSlots, ...elseCounts.mappingDeleteSlots]),
    transferCount: Math.max(ifT.max, elseT.max),
    minTransferCount: reachableMin(ifT.min, elseT.min),
    ifTransferCount: ifT.max,
    emitCount: Math.max(ifCounts.emits, elseCounts.emits),
    minEmitCount: reachableMin(ifCounts.emits, elseCounts.emits),
    ifEmitCount: ifCounts.emits,
    tokenContainerTransferCount: Math.max(ifCounts.tokenContainerTransfers, elseCounts.tokenContainerTransfers),
    minTokenContainerTransferCount: reachableMin(
      ifCounts.tokenContainerTransfers, elseCounts.tokenContainerTransfers,
    ),
    ifTokenContainerTransferCount: ifCounts.tokenContainerTransfers,
  };
}
