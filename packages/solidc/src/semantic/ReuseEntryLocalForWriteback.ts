import { MappingType, StructType, type Type } from '@solidcash/utils';
import {
  Node,
  SourceFileNode,
  ContractNode,
  BlockNode,
  FunctionDefinitionNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { rewriteStatements, type WritebackMapping } from './ReuseEntryLocalForWritebackRewrite.js';

/**
 * Reuse an entry-read local for a whole-struct write-back:
 *
 *   Escrow e = escrows[id];
 *   e.split = a; e.consensus = b;
 *   escrows[id].split = e.split; escrows[id].consensus = e.consensus; escrows[id].claimed = 1;
 *     -> Escrow e = escrows[id]; e.split = a; e.consensus = b;
 *        escrows[id] = Escrow(e.participant, e.releaser, e.amount, e.split, e.consensus, 1);
 *
 * `CoalesceMappingEntryFieldWrites` already folds the field-write run into one whole-struct write, but it reads
 * the entry AGAIN into a fresh snapshot for the untouched fields. When the entry was already read into a local
 * `e`, that local still holds the same snapshot (the write-back run writes every field `e` was modified in), so
 * the fresh read is redundant. This pass runs BEFORE CoalesceMappingEntryFieldWrites and pre-empts an eligible run
 * with a whole-struct write whose untouched fields come from `e`.
 *
 * Conservative gates (fail closed = keep the original statements): a straight-line region only (no control flow),
 * `e` is never whole-reassigned or passed to a call, no write to the entry before the run, and every field of `e`
 * modified in that region is written by the run (so untouched fields still equal storage).
 *
 * The rewrite itself is the pure `rewriteStatements` unit in `ReuseEntryLocalForWritebackRewrite.ts`; this class
 * only collects the sorted struct-mapping table and dispatches each block to it.
 */
export default class ReuseEntryLocalForWriteback extends AstTraversal {
  private mappings = new Map<string, WritebackMapping>();

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.mappings = new Map();
    for (const col of node.collections) {
      if (!col.sorted || !(col.type instanceof MappingType)) continue;
      let vt: Type = col.type;
      let keyCount = 0;
      while (vt instanceof MappingType) { keyCount += 1; vt = vt.valueType; }
      if (vt instanceof StructType) this.mappings.set(col.name, { keyCount, struct: vt });
    }
    if (this.mappings.size === 0) return node;
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    return super.visitFunctionDefinition(node);
  }

  visitBlock(node: BlockNode): Node {
    if (node.statements) {
      node.statements = rewriteStatements(node.statements, this.mappings).rewritten;
    }
    return super.visitBlock(node);
  }
}
