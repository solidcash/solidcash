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
    // Library functions live here as namespaced free functions (Lib.find); they are OP_INVOKE subroutines
    // with the same broken raw-return-in-loop cleanup as contract-internal functions, so desugar them too.
    node.freeFunctions = node.freeFunctions.map((f) => this.visit(f) as FunctionDefinitionNode);
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
    // Entry-points AND internal/private functions both need this: an in-loop raw return NIPs locals below the
    // value and corrupts the loop's balanced OP_BEGIN/OP_UNTIL stack. (The old entry-point "blob-stash" path was
    // broken - a public `for/while (..) { if (c) return X; }` crashed at runtime.) Desugaring to a flag + break +
    // post-loop return moves the return OUT of the loop, where EarlyReturnTransformation nests it normally.
    if (!this.hasReturnInLoop(node.body, false)) return node;

    this.retCount = node.returnTypes.length;
    const decls: StatementNode[] = [new VariableDefinitionNode(PrimitiveType.BOOL, [], FLAG, new BoolLiteralNode(false))];
    for (let k = 0; k < node.returnTypes.length; k++) {
      decls.push(new VariableDefinitionNode(node.returnTypes[k], [], VAL(k)));
    }
    decls.forEach((d) => this.stampLoc(d, node.location));
    const [stmts] = this.transformStatements(node.body.statements ?? [], 0);
    node.body.statements = [...decls, ...stmts];
    return node;
  }

  // Stamp a synthesized node subtree with a source location (only where missing - existing sub-expressions keep
  // theirs). Entry points read node.location.start (source maps) where internal functions don't, so an unstamped
  // synthesized node crashed the compiler on public functions. Pre-semantic pass = no resolvedFunction cycles;
  // a visited guard backstops any residual cycle.
  private stampLoc<T extends Node>(node: T, loc: Node['location']): T {
    const visited = new WeakSet<Node>();
    const walk = (n: Node | undefined): void => {
      if (!n || visited.has(n)) return;
      visited.add(n);
      if (!n.location) n.location = loc;
      for (const key of Object.keys(n)) {
        if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) walk(v);
        else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) walk(it);
      }
    };
    walk(node);
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
          out.push(this.stampLoc(new AssignNode(new IdentifierNode(VAL(k)), s.expressions[k]), s.location));
        }
        out.push(this.stampLoc(new AssignNode(new IdentifierNode(FLAG), new BoolLiteralNode(true)), s.location));
        out.push(this.stampLoc(new BreakNode(), s.location));
        had = true;
      } else if (s instanceof WhileNode || s instanceof DoWhileNode) {
        const [inner, innerHad] = this.transformStatements(s.block.statements ?? [], loopDepth + 1);
        s.block.statements = inner;
        out.push(s);
        if (innerHad) { out.push(this.stampLoc(this.propagation(loopDepth), s.location)); had = true; }
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
