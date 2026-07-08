import {
  ContractNode,
  FunctionDefinitionNode,
  SourceFileNode,
  Node,
  StatementNode,
  BlockNode,
  FunctionCallStatementNode,
  FunctionCallNode,
  VariableDefinitionNode,
  IdentifierNode,
  ExpressionNode,
  MethodCallNode,
  CastNode,
  UnaryOpNode,
  NullaryOpNode,
  TupleAssignmentNode,
  ReturnNode,
  LowLevelCallStatementNode,
  AssignNode,
  BoolLiteralNode,
  HexLiteralNode,
  StringLiteralNode,
  AbiEncodeWithSignatureNode,
} from '../ast/AST.js';
import { AddressType, BytesType } from '@solidcash/utils';
import { UnaryOperator, NullaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Lowers `address(this).call(payload)` (a self low-level call) into a plain internal call BEFORE the inline
 * passes, so a state-touching callee is inlined into the entry point like any other internal call:
 *
 * - `abi.encodeWithSignature("f(...)", args)` payload naming an own function -> direct call `f(args)`.
 * - Any other payload -> `__fallback(payload)` (the EVM's raw-calldata route); the fallback's declared bytes
 *   input receives the payload, its return value becomes the low-level retval.
 * - success is constant true: on BCH an internal call aborts the whole tx on failure instead of reverting,
 *   so a false success is unobservable.
 *
 * Rewritten sites: `(bool s, bytes r) = address(this).call(p);` (slots may be declarations, existing
 * lvalues, or empty), `return address(this).call(p);`, and the bare statement form. A fallback whose body
 * reads msg.data directly is NOT lowered (msg.data inside the callee would need payload substitution).
 */
const PREFIX = '__selfcall_ret_';

export default class LowerSelfLowLevelCalls extends AstTraversal {
  private contract: ContractNode | undefined;
  private counter = 0;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.contract = node;
    const bodies = [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef];
    for (const fn of bodies) {
      if (fn?.body) fn.body = this.visit(fn.body) as BlockNode;
    }
    return node;
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const visited = this.visit(stmt) as StatementNode; // recurse (branches, loops, nested blocks)
      const rewritten = this.rewriteStatement(visited);
      if (rewritten) out.push(...rewritten);
      else out.push(visited);
    }
    node.statements = out;
    return node;
  }

  // `address(this)` / `payable(this)` as built by the AstBuilder: a Cast to address over the own locking
  // bytecode (`this` = tx.inputs[this.activeInputIndex].lockingBytecode).
  private isSelfAddressExpr(expr: Node | undefined): boolean {
    if (!(expr instanceof CastNode) || !(expr.type instanceof AddressType)) return false;
    const inner = expr.expression;
    return inner instanceof UnaryOpNode && inner.operator === UnaryOperator.INPUT_LOCKING_BYTECODE
      && inner.expression instanceof NullaryOpNode && inner.expression.operator === NullaryOperator.INPUT_INDEX;
  }

  private matchSelfCall(expr: Node | undefined): MethodCallNode | undefined {
    if (!(expr instanceof MethodCallNode) || expr.methodName !== 'call' || expr.parameters.length !== 1) {
      return undefined;
    }
    return this.isSelfAddressExpr(expr.object) ? expr : undefined;
  }

  private bodyReadsMsgData(fn: FunctionDefinitionNode): boolean {
    let found = false;
    this.walk(fn.body, (n) => {
      if (n instanceof NullaryOpNode && n.operator === NullaryOperator.MSG_DATA) found = true;
    });
    return found;
  }

  private walk(node: Node | undefined, visit: (n: Node) => void): void {
    if (!node) return;
    visit(node);
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) this.walk(v, visit);
      else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) this.walk(it, visit);
    }
  }

  // Resolve the self-call into the synthesized internal call + value factories, or undefined when it cannot
  // be lowered (no fallback for a raw payload, or a fallback that reads msg.data directly).
  private lower(call: MethodCallNode): {
    stmts: StatementNode[]; success: () => ExpressionNode; retval: () => ExpressionNode;
  } | undefined {
    const loc = call.location;
    const payload = call.parameters[0];
    let target: FunctionDefinitionNode | undefined;
    let args: ExpressionNode[] = [];
    if (payload instanceof AbiEncodeWithSignatureNode && payload.signature instanceof StringLiteralNode) {
      const fnName = payload.signature.value.split('(')[0];
      const matches = (this.contract?.functions ?? []).filter((f) => f.name === fnName);
      if (matches.length === 1) {
        target = matches[0];
        args = payload.parameters;
      }
    }
    if (!target) {
      const fb = this.contract?.fallbackDef;
      if (!fb || this.bodyReadsMsgData(fb)) return undefined;
      target = fb;
      args = fb.parameters.length > 0 ? [payload] : [];
    }
    const id = new IdentifierNode(target.name);
    id.location = loc;
    const callee = new FunctionCallNode(id, args);
    callee.fromThisCall = true;
    callee.location = loc;
    const stmts: StatementNode[] = [];
    let retval: () => ExpressionNode;
    if (target.isFallback && target.returnTypes.length === 1) {
      const tmpName = `${PREFIX}${this.counter++}`;
      const def = new VariableDefinitionNode(target.returnTypes[0], [], tmpName, callee);
      def.location = loc;
      stmts.push(def);
      retval = () => {
        const read = new IdentifierNode(tmpName);
        read.location = loc;
        return read;
      };
    } else {
      const stmt = new FunctionCallStatementNode(callee);
      stmt.location = loc;
      stmts.push(stmt);
      retval = () => {
        const empty = new HexLiteralNode(new Uint8Array(0));
        empty.type = new BytesType();
        empty.location = loc;
        return empty;
      };
    }
    const success = (): ExpressionNode => {
      const t = new BoolLiteralNode(true);
      t.location = loc;
      return t;
    };
    return { stmts, success, retval };
  }

  private rewriteStatement(stmt: StatementNode): StatementNode[] | undefined {
    // `(bool s, bytes r) = address(this).call(p);`
    if (stmt instanceof TupleAssignmentNode && !stmt.tupleExpressions && stmt.elements.length === 2) {
      const call = this.matchSelfCall(stmt.tuple);
      if (!call) return undefined;
      const lowered = this.lower(call);
      if (!lowered) return undefined;
      const { stmts, success, retval } = lowered;
      const values = [success, retval];
      stmt.elements.forEach((el, i) => {
        if (el.skip) return;
        if (el.existing) {
          const targetId = new IdentifierNode(el.name!);
          targetId.location = stmt.location;
          const assign = new AssignNode(targetId, values[i]());
          assign.location = stmt.location;
          stmts.push(assign);
          return;
        }
        const def = new VariableDefinitionNode(el.type!, [], el.name!, values[i]());
        def.location = stmt.location;
        stmts.push(def);
      });
      return stmts;
    }
    // `return address(this).call(p);`
    if (stmt instanceof ReturnNode && stmt.expressions.length === 1) {
      const call = this.matchSelfCall(stmt.expressions[0]);
      if (!call) return undefined;
      const lowered = this.lower(call);
      if (!lowered) return undefined;
      const { stmts, success, retval } = lowered;
      const ret = new ReturnNode([success(), retval()]);
      ret.location = stmt.location;
      return [...stmts, ret];
    }
    // `address(this).call(p);`
    if (stmt instanceof LowLevelCallStatementNode && stmt.callMode === 'call'
      && this.isSelfAddressExpr(stmt.targetExpression)) {
      const call = new MethodCallNode(stmt.targetExpression, 'call', [stmt.data]);
      call.location = stmt.location;
      const lowered = this.lower(call);
      if (!lowered) return undefined;
      return lowered.stmts;
    }
    return undefined;
  }
}
