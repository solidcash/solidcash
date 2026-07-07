import {
  FunctionDefinitionNode, BlockNode, StatementNode, Node, WhileNode, DoWhileNode, BranchNode,
  ReturnNode, RevertNode, VariableDefinitionNode, AssignNode, IdentifierNode, BoolLiteralNode,
  UnaryOpNode, SourceFileNode, ContractNode, ConsoleStatementNode, SwitchNode, TryCatchNode,
} from '../ast/AST.js';
import { PrimitiveType } from '@solidcash/utils';
import { UnaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Desugars a MAY-return branch arm (a return nested under further conditions, with fall-through) in an
 * internal/private function into a flag + gated tail + single terminal return. EarlyReturnTransformation
 * only linearizes arms that ALWAYS return (it nests the following statements into an else); an arm that
 * returns on some inner path and falls through otherwise has no jump-free linearization without a flag -
 * codegen's branch merge then read a stack the returning path had already consumed:
 *
 *   function g(..) returns (T) { if (a) { if (b) { return X; } } rest... }
 *   ->
 *   function g(..) returns (T) { bool __bretflag = false; T __bretval_0;
 *     if (a) { if (b) { __bretval_0 = X; __bretflag = true; } }
 *     if (!__bretflag) { rest... }   // every original return stashes + sets the flag
 *     return __bretval_0; }
 *
 * Runs after NamedReturnTransformation (implicit named-return tails are explicit by then, so the appended
 * terminal return cannot clobber a fall-off path) and before semantic analysis (the new locals resolve
 * normally). Loop subtrees are untouched - DesugarReturnInLoop already rewrote returns inside loops.
 */
const FLAG = '__internal__bretflag';
const VAL = (k: number): string => `__internal__bretval_${k}`;

export default class DesugarNestedBranchReturn extends AstTraversal {
  private retCount = 0;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    node.importedContracts = node.importedContracts.map((c) => this.visit(c) as ContractNode);
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
    // Entry points have the non-corrupting blob-stash return path; only internal/private raw returns break.
    if (node.isEntryPoint) return node;
    if (!this.needsFlagRewrite(node.body)) return node;

    this.retCount = node.returnTypes.length;
    const decls: StatementNode[] = [new VariableDefinitionNode(PrimitiveType.BOOL, [], FLAG, new BoolLiteralNode(false))];
    for (let k = 0; k < node.returnTypes.length; k++) {
      decls.push(new VariableDefinitionNode(node.returnTypes[k], [], VAL(k)));
    }
    const [stmts] = this.rewriteList(node.body.statements ?? []);
    const rets: IdentifierNode[] = [];
    for (let k = 0; k < this.retCount; k++) rets.push(new IdentifierNode(VAL(k)));
    node.body.statements = [...decls, ...stmts, new ReturnNode(rets)];
    return node;
  }

  // Trigger: some branch arm contains a (non-loop) return but does not END on a terminal statement on
  // every inner path - the fall-through-after-return class the else-nesting transformation cannot handle.
  private needsFlagRewrite(node: Node | undefined): boolean {
    if (!node) return false;
    if (node instanceof WhileNode || node instanceof DoWhileNode || node instanceof SwitchNode) return false;
    if (node instanceof BranchNode) {
      for (const arm of [node.ifBlock, node.elseBlock]) {
        if (!arm) continue;
        if (this.containsReturn(arm) && !this.endsTerminal(arm)) return true;
        if (this.needsFlagRewrite(arm)) return true;
      }
      return false;
    }
    if (node instanceof TryCatchNode) return this.needsFlagRewrite(node.tryBlock);
    if (node instanceof BlockNode) return (node.statements ?? []).some((s) => this.needsFlagRewrite(s));
    return false;
  }

  private containsReturn(node: Node | undefined): boolean {
    if (!node) return false;
    if (node instanceof ReturnNode) return true;
    if (node instanceof WhileNode || node instanceof DoWhileNode || node instanceof SwitchNode) return false;
    if (node instanceof BranchNode) {
      return this.containsReturn(node.ifBlock) || this.containsReturn(node.elseBlock);
    }
    if (node instanceof TryCatchNode) return this.containsReturn(node.tryBlock);
    if (node instanceof BlockNode) return (node.statements ?? []).some((s) => this.containsReturn(s));
    return false;
  }

  // Whether a block always exits (return or revert) on every path through its final statement.
  private endsTerminal(block: BlockNode): boolean {
    const stmts = (block.statements ?? []).filter((s) => !(s instanceof ConsoleStatementNode));
    if (stmts.length === 0) return false;
    const last = stmts[stmts.length - 1];
    if (last instanceof ReturnNode || last instanceof RevertNode) return true;
    if (last instanceof BranchNode) {
      return !!last.elseBlock && this.endsTerminal(last.ifBlock) && this.endsTerminal(last.elseBlock);
    }
    if (last instanceof BlockNode) return this.endsTerminal(last);
    return false;
  }

  // Returns [rewritten statements, whether a return was rewritten below (the flag may be set at runtime)].
  private rewriteList(stmts: StatementNode[]): [StatementNode[], boolean] {
    const out: StatementNode[] = [];
    let had = false;
    for (let i = 0; i < stmts.length; i++) {
      const s = stmts[i];
      if (s instanceof ReturnNode && s.expressions.length === this.retCount) {
        for (let k = 0; k < s.expressions.length; k++) {
          out.push(new AssignNode(new IdentifierNode(VAL(k)), s.expressions[k]));
        }
        out.push(new AssignNode(new IdentifierNode(FLAG), new BoolLiteralNode(true)));
        // Statements after an unconditional return are unreachable; drop them.
        return [out, true];
      }
      if (s instanceof WhileNode || s instanceof DoWhileNode || s instanceof SwitchNode) {
        out.push(s); // loop returns were already rewritten by DesugarReturnInLoop; switch is out of scope
        continue;
      }
      let mayReturn = false;
      if (s instanceof BranchNode) {
        const [ifs, ifHad] = this.rewriteList(s.ifBlock.statements ?? []);
        s.ifBlock.statements = ifs;
        let elHad = false;
        if (s.elseBlock) {
          const [els, e] = this.rewriteList(s.elseBlock.statements ?? []);
          s.elseBlock.statements = els; elHad = e;
        }
        mayReturn = ifHad || elHad;
      } else if (s instanceof TryCatchNode) {
        const [ts, tHad] = this.rewriteList(s.tryBlock.statements ?? []);
        s.tryBlock.statements = ts;
        mayReturn = tHad;
      } else if (s instanceof BlockNode) {
        const [bs, bHad] = this.rewriteList(s.statements ?? []);
        s.statements = bs;
        mayReturn = bHad;
      }
      out.push(s);
      if (mayReturn) {
        had = true;
        const rest = stmts.slice(i + 1);
        if (rest.length > 0) {
          const [gated] = this.rewriteList(rest);
          out.push(new BranchNode(
            new UnaryOpNode(UnaryOperator.NOT, new IdentifierNode(FLAG)),
            new BlockNode(gated),
          ));
          return [out, true];
        }
      }
    }
    return [out, had];
  }
}
