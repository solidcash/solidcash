import {
  FunctionDefinitionNode, BlockNode, StatementNode, Node, WhileNode, DoWhileNode, BranchNode,
  ReturnNode, BreakNode, VariableDefinitionNode, AssignNode, IdentifierNode, BoolLiteralNode,
  SourceFileNode, ContractNode,
} from '../ast/AST.js';
import { PrimitiveType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Desugars a `return` inside a loop into a flag + break + post-loop return. An internal/private solidcash
 * function cleans up its stack at a raw `return` (NIPs locals below the value), which corrupts a loop's balanced
 * OP_BEGIN/OP_UNTIL stack when the return is inside the loop - only entry-point functions have a non-corrupting
 * return-in-loop path (the blob-stash in GTT.visitReturn). This rewrite reuses the standard, tested break / if /
 * return-outside-loop codegen instead:
 *
 *   function f() returns (T) { ...; for (..) { if (c) return X; } ...; }
 *   ->
 *   function f() returns (T) { bool __retflag = false; T __retval_0;
 *     ...; while (..) { if (c) { __retval_0 = X; __retflag = true; break; } }
 *     if (__retflag) { return __retval_0; } ...; }
 *
 * A `return` in a NESTED loop breaks outward (each enclosing loop gets an `if (__retflag) break;` after the
 * inner loop) until the outermost loop, after which the stashed value is returned. Runs before break/continue
 * expansion (so the injected `break`s are lowered) and before semantic analysis (so the new locals resolve).
 */
const FLAG = '__internal__retflag';
const VAL = (k: number): string => `__internal__retval_${k}`;

export default class DesugarReturnInLoop extends AstTraversal {
  private retCount = 0;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    node.importedContracts = node.importedContracts.map((c) => this.visit(c) as ContractNode);
    return node;
  }

  visitContract(node: ContractNode): Node {
    node.functions = node.functions.map((f) => this.visit(f) as FunctionDefinitionNode);
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (!node.body || node.returnTypes.length === 0) return node;
    // Entry-points already have a non-corrupting path; only internal/private hit the broken raw cleanup.
    if (node.isEntryPoint) return node;
    if (!this.hasReturnInLoop(node.body, false)) return node;

    this.retCount = node.returnTypes.length;
    const decls: StatementNode[] = [new VariableDefinitionNode(PrimitiveType.BOOL, [], FLAG, new BoolLiteralNode(false))];
    for (let k = 0; k < node.returnTypes.length; k++) {
      decls.push(new VariableDefinitionNode(node.returnTypes[k], [], VAL(k)));
    }
    const [stmts] = this.transformStatements(node.body.statements ?? [], 0);
    node.body.statements = [...decls, ...stmts];
    return node;
  }

  private hasReturnInLoop(node: Node | undefined, inLoop: boolean): boolean {
    if (!node) return false;
    if (node instanceof ReturnNode) return inLoop;
    if (node instanceof WhileNode || node instanceof DoWhileNode) return this.hasReturnInLoop(node.block, true);
    if (node instanceof BranchNode) {
      return this.hasReturnInLoop(node.ifBlock, inLoop) || this.hasReturnInLoop(node.elseBlock, inLoop);
    }
    if (node instanceof BlockNode) return (node.statements ?? []).some((s) => this.hasReturnInLoop(s, inLoop));
    return false;
  }

  // Returns [transformed statements, whether a return-in-loop was rewritten below (the flag may be set)].
  private transformStatements(stmts: StatementNode[], loopDepth: number): [StatementNode[], boolean] {
    const out: StatementNode[] = [];
    let had = false;
    for (const s of stmts) {
      // A 1:1 return inside a loop -> stash the values + set the flag + break the loop.
      if (s instanceof ReturnNode && loopDepth > 0 && s.expressions.length === this.retCount) {
        // Splice the stash+flag+break directly into the statement list (not wrapped in a block) so the injected
        // `break` is recognised as in-loop by break/continue expansion.
        for (let k = 0; k < s.expressions.length; k++) {
          out.push(new AssignNode(new IdentifierNode(VAL(k)), s.expressions[k]));
        }
        out.push(new AssignNode(new IdentifierNode(FLAG), new BoolLiteralNode(true)));
        out.push(new BreakNode());
        had = true;
      } else if (s instanceof WhileNode || s instanceof DoWhileNode) {
        const [inner, innerHad] = this.transformStatements(s.block.statements ?? [], loopDepth + 1);
        s.block.statements = inner;
        out.push(s);
        if (innerHad) { out.push(this.propagation(loopDepth)); had = true; }
      } else if (s instanceof BranchNode) {
        const [ifs, ifHad] = this.transformStatements(s.ifBlock.statements ?? [], loopDepth);
        s.ifBlock.statements = ifs;
        let elHad = false;
        if (s.elseBlock) {
          const [els, e] = this.transformStatements(s.elseBlock.statements ?? [], loopDepth);
          s.elseBlock.statements = els; elHad = e;
        }
        out.push(s);
        had = had || ifHad || elHad;
      } else if (s instanceof BlockNode) {
        const [inner, innerHad] = this.transformStatements(s.statements ?? [], loopDepth);
        s.statements = inner;
        out.push(s);
        had = had || innerHad;
      } else {
        out.push(s);
      }
    }
    return [out, had];
  }

  // After a loop whose body set the flag: an enclosing loop breaks outward; the outermost returns the value.
  private propagation(loopDepth: number): StatementNode {
    if (loopDepth > 0) return new BranchNode(new IdentifierNode(FLAG), new BlockNode([new BreakNode()]));
    const rets: IdentifierNode[] = [];
    for (let k = 0; k < this.retCount; k++) rets.push(new IdentifierNode(VAL(k)));
    return new BranchNode(new IdentifierNode(FLAG), new BlockNode([new ReturnNode(rets)]));
  }
}
