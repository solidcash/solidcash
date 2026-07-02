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
  BranchOps,
} from '../ast/AST.js';

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

export function countBranchOps(block: BlockNode): OpCounts {
  const result = emptyCounts();
  countBranchOpsRecursive(block, result);
  return result;
}

function countBranchOpsRecursive(node: Node, result: OpCounts): void {
  if (node instanceof TransferStatementNode || node instanceof AddressTransferStatementNode
    || node instanceof AddressSendExpressionNode) {
    result.transfers++;
    return;
  }
  // {value: X} call option creates an implicit transfer
  if (node instanceof LowLevelCallStatementNode && node.callOptions?.value) {
    result.transfers++;
    // Don't return - we still need to recurse into child nodes
  }
  if (node instanceof MethodCallStatementNode && node.call.callOptions?.value) {
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

  return {
    stateWriteKeys: new Set<string>([...ifCounts.stateWriteKeys, ...elseCounts.stateWriteKeys]),
    mappingWriteSlots: new Set<number>([...ifCounts.mappingWriteSlots, ...elseCounts.mappingWriteSlots]),
    mappingDeleteSlots: new Set<number>([...ifCounts.mappingDeleteSlots, ...elseCounts.mappingDeleteSlots]),
    transferCount: Math.max(ifCounts.transfers, elseCounts.transfers),
    minTransferCount: Math.min(ifCounts.transfers, elseCounts.transfers),
    ifTransferCount: ifCounts.transfers,
    emitCount: Math.max(ifCounts.emits, elseCounts.emits),
    minEmitCount: Math.min(ifCounts.emits, elseCounts.emits),
    ifEmitCount: ifCounts.emits,
    tokenContainerTransferCount: Math.max(ifCounts.tokenContainerTransfers, elseCounts.tokenContainerTransfers),
    minTokenContainerTransferCount: Math.min(ifCounts.tokenContainerTransfers, elseCounts.tokenContainerTransfers),
    ifTokenContainerTransferCount: ifCounts.tokenContainerTransfers,
  };
}
