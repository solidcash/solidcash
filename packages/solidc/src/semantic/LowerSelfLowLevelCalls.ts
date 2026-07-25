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
  AbiEncodeWithSelectorNode,
  AbiEncodeCallNode,
  AbiEncodeNode,
  FieldAccessNode,
  StateAccessNode,
} from '../ast/AST.js';
import { AddressType, BytesType, ValueType } from '@solidcash/utils';
import { UnaryOperator, NullaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

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
    if (!(expr instanceof MethodCallNode)
      || (expr.methodName !== 'call' && expr.methodName !== 'staticcall')
      || expr.parameters.length !== 1) {
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
  // be lowered (no fallback for a raw payload, or an unloweable msg.data-reading fallback shape).
  private lower(call: MethodCallNode): {
    stmts: StatementNode[]; success: () => ExpressionNode; retval: () => ExpressionNode;
  } | undefined {
    const loc = call.location;
    const payload = call.parameters[0];
    const emptyBytes = (): ExpressionNode => {
      const empty = new HexLiteralNode(new Uint8Array(0));
      empty.type = new BytesType();
      empty.location = loc;
      return empty;
    };
    const success = (): ExpressionNode => {
      const t = new BoolLiteralNode(true);
      t.location = loc;
      return t;
    };
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
    // `abi.encodeWithSelector(this.f.selector, args)`: the selector is still unfolded pre-semantic -
    // structurally FieldAccess('selector', StateAccess(f)) - so the target resolves by name.
    if (!target && payload instanceof AbiEncodeWithSelectorNode
      && payload.selector instanceof FieldAccessNode && payload.selector.name === 'selector'
      && payload.selector.expression instanceof StateAccessNode) {
      const fnName = payload.selector.expression.name;
      const matches = (this.contract?.functions ?? []).filter((f) => f.name === fnName);
      if (matches.length === 1) {
        target = matches[0];
        args = payload.parameters;
      }
    }
    if (!target && payload instanceof AbiEncodeCallNode) {
      const matches = (this.contract?.functions ?? []).filter((f) => f.name === payload.functionName);
      if (matches.length === 1) {
        target = matches[0];
        args = payload.parameters;
      }
    }
    if (!target) {
      const fb = this.contract?.fallbackDef;
      if (!fb) return undefined;
      if (this.bodyReadsMsgData(fb)) return this.inlineMsgDataFallback(fb, payload, loc, success, emptyBytes);
      target = fb;
      args = fb.parameters.length > 0 ? [payload] : [];
    }
    // A selector/signature payload is ABI-decoded by the callee. UDVTs use their underlying ABI type, so a raw
    // `int(-5)` argument targeting `MyInt` must be re-wrapped when reducing the self-call to a typed direct call.
    // abi.encodeCall already enforces the nominal source type and needs no repair.
    if (!(payload instanceof AbiEncodeCallNode)) {
      args = args.map((arg, i) => {
        const expected = target!.parameters[i]?.type;
        if (!(expected instanceof ValueType)) return arg;
        if (arg instanceof CastNode && arg.type instanceof ValueType
          && arg.type.toString() === expected.toString()) return arg;
        const cast = new CastNode(expected, arg, false);
        cast.location = arg.location ?? loc;
        return cast;
      });
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
    } else if (!target.isFallback && target.returnTypes.length > 0) {
      // Value-returning static dispatch: capture the returns, retval = abi.encode(them) so the caller's
      // abi.decode(ret, (...)) roundtrips.
      const uid = this.counter++;
      const tmpNames = target.returnTypes.map((_, i) => `${PREFIX}${uid}_v${i}`);
      if (tmpNames.length === 1) {
        const def = new VariableDefinitionNode(target.returnTypes[0], [], tmpNames[0], callee);
        def.location = loc;
        stmts.push(def);
      } else {
        const tup = new TupleAssignmentNode(
          tmpNames.map((nm, i) => ({ name: nm, type: target!.returnTypes[i] })), callee,
        );
        tup.location = loc;
        stmts.push(tup);
      }
      retval = () => {
        const reads = tmpNames.map((nm) => {
          const r = new IdentifierNode(nm);
          r.location = loc;
          return r;
        });
        const enc = new AbiEncodeNode(reads);
        enc.location = loc;
        return enc;
      };
    } else {
      const stmt = new FunctionCallStatementNode(callee);
      stmt.location = loc;
      stmts.push(stmt);
      retval = emptyBytes;
    }
    return { stmts, success, retval };
  }

  // A fallback whose body reads msg.data inlines AT the call site with msg.data (and a declared bytes input
  // param, when present) substituted by the payload - the EVM's "callee sees the call's data" semantics.
  // Restricted to bodies with no early return (at most one trailing ReturnNode); locals are alpha-renamed.
  private inlineMsgDataFallback(
    fb: FunctionDefinitionNode, payload: ExpressionNode, loc: typeof fb.location,
    success: () => ExpressionNode, emptyBytes: () => ExpressionNode,
  ): { stmts: StatementNode[]; success: () => ExpressionNode; retval: () => ExpressionNode } | undefined {
    let returns = 0;
    this.walk(fb.body, (n) => { if (n instanceof ReturnNode) returns += 1; });
    const bodyStmts = fb.body?.statements ?? [];
    const last = bodyStmts[bodyStmts.length - 1];
    if (returns > 1 || (returns === 1 && !(last instanceof ReturnNode))) return undefined;

    const uid = this.counter++;
    const dataName = `__selffb_${uid}_data`;
    const stmts: StatementNode[] = [];
    const dataDef = new VariableDefinitionNode(new BytesType(), [], dataName, payload);
    dataDef.location = loc;
    dataDef.allowUnused = true;
    stmts.push(dataDef);

    const cloned = cloneNode(fb.body!) as BlockNode;
    // Alpha-rename the fallback's locals and its declared input param; the param reads become payload reads.
    const rename = new Map<string, string>();
    for (const p of fb.parameters) rename.set(p.name, dataName);
    this.walk(cloned, (n) => {
      if (n instanceof VariableDefinitionNode && !rename.has(n.name)) {
        rename.set(n.name, `__selffb_${uid}_${n.name}`);
      }
    });
    this.walk(cloned, (n) => {
      if (n instanceof VariableDefinitionNode && rename.has(n.name)) n.name = rename.get(n.name)!;
      else if (n instanceof IdentifierNode && rename.has(n.name)) n.name = rename.get(n.name)!;
    });
    this.replaceMsgData(cloned, dataName);

    const clonedStmts = [...(cloned.statements ?? [])];
    let retval: () => ExpressionNode = emptyBytes;
    if (returns === 1) {
      const ret = clonedStmts.pop() as ReturnNode;
      if (ret.expressions.length === 1 && fb.returnTypes.length === 1) {
        const retName = `${PREFIX}${uid}`;
        const retDef = new VariableDefinitionNode(fb.returnTypes[0], [], retName, ret.expressions[0]);
        retDef.location = loc;
        clonedStmts.push(retDef);
        retval = () => {
          const r = new IdentifierNode(retName);
          r.location = loc;
          return r;
        };
      }
    }
    stmts.push(...clonedStmts);
    return { stmts, success, retval };
  }

  // Replace every msg.data read in the subtree with a read of the payload temp (node substitution, so it
  // rewrites the field/array slot holding the NullaryOp).
  private replaceMsgData(node: Node, dataName: string): void {
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof NullaryOpNode && v.operator === NullaryOperator.MSG_DATA) {
        const read = new IdentifierNode(dataName);
        read.location = v.location;
        (node as unknown as Record<string, unknown>)[key] = read;
      } else if (v instanceof Node) {
        this.replaceMsgData(v, dataName);
      } else if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i += 1) {
          const it = v[i];
          if (it instanceof NullaryOpNode && it.operator === NullaryOperator.MSG_DATA) {
            const read = new IdentifierNode(dataName);
            read.location = it.location;
            v[i] = read;
          } else if (it instanceof Node) {
            this.replaceMsgData(it, dataName);
          }
        }
      }
    }
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
