import {
  Node, SourceFileNode, ContractNode, FunctionDefinitionNode, ExpressionNode,
  VariableDefinitionNode, ArrayAssignNode, AssignNode, IdentifierNode, SliceNode, BinaryOpNode, UnaryOpNode,
  IntLiteralNode,
} from '../ast/AST.js';
import { BytesType } from '@solidcash/utils';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import { cloneNode } from '../ast/clone.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Value-copies a LOCAL `bytes` element write `b[i] = v` that LowerMemoryModel did NOT convert to a __yulmem
 * pointer byte-splice. The AstBuilder leaves such writes as a raw ArrayAssignNode (rather than eagerly rebuilding
 * the whole blob) so LowerMemoryModel can lower the convertible ones to a single in-place byte splice; this pass
 * then rebuilds the rest, matching the original value-copy semantics:
 *
 *   b[i] = v   ->   b = b[0:i] ++ v ++ b[i+1:b.length]
 *
 * Runs AFTER LowerMemoryModel: a converted bytes buffer's decl is now `uint` (a pointer) and its writes are
 * already byte-splices, so it is neither collected here nor left as an ArrayAssignNode. Only a fallen-back
 * (still `bytes`-typed) local or param survives to be rebuilt. State bytes and compound `op=` writes keep the
 * AstBuilder's direct rebuild and never reach here.
 */
export default class DesugarLocalBytesElementWrite extends AstTraversal {
  private bytesLocals = new Set<string>();

  visitSourceFile(node: SourceFileNode): Node {
    node.importedContracts = this.visitList(node.importedContracts) as ContractNode[];
    node.freeFunctions = this.visitList(node.freeFunctions) as FunctionDefinitionNode[];
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const saved = this.bytesLocals;
    this.bytesLocals = new Set();
    for (const p of node.parameters) if (this.isDynBytes(p.type)) this.bytesLocals.add(p.name);
    this.collectBytesDecls(node.body);
    const result = super.visitFunctionDefinition(node);
    this.bytesLocals = saved;
    return result;
  }

  private isDynBytes(t: unknown): boolean {
    return t instanceof BytesType && t.bound === undefined;
  }

  private collectBytesDecls(n: Node | undefined): void {
    if (!n) return;
    if (n instanceof VariableDefinitionNode && this.isDynBytes(n.type)) this.bytesLocals.add(n.name);
    for (const key of Object.keys(n)) {
      const val = (n as unknown as Record<string, unknown>)[key];
      if (val instanceof Node) this.collectBytesDecls(val);
      else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) this.collectBytesDecls(v);
    }
  }

  // `b[i] = v` on a fallen-back bytes local -> `b = b[0:i] ++ v ++ b[i+1:b.length]`.
  visitArrayAssign(node: ArrayAssignNode): Node {
    if (!this.bytesLocals.has(node.name)) return super.visitArrayAssign(node);
    const at = <T extends Node>(x: T): T => { x.location = node.location; return x; };
    const read = (): IdentifierNode => at(new IdentifierNode(node.name));
    const idx = (): ExpressionNode => cloneNode(node.index) as ExpressionNode;
    const value = this.visit(node.value) as ExpressionNode;
    const len = at(new UnaryOpNode(UnaryOperator.SIZE, read()));
    const prefix = at(new SliceNode(read(), at(new IntLiteralNode(0n)), idx()));
    const iPlus1 = at(new BinaryOpNode(idx(), BinaryOperator.PLUS, at(new IntLiteralNode(1n))));
    const suffix = at(new SliceNode(read(), iPlus1, len));
    const cat = at(new BinaryOpNode(at(new BinaryOpNode(prefix, BinaryOperator.PLUS, value)),
      BinaryOperator.PLUS, suffix));
    const assign = at(new AssignNode(read(), cat));
    assign.isReferenceDataWrite = true;
    return assign;
  }
}
