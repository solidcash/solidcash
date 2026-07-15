import {
  CastNode,
  ExpressionNode,
  FunctionCallNode,
  InterfaceNode,
  Node,
  SourceFileNode,
} from '../ast/AST.js';
import { ValueType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * `T.wrap(x)` / `T.unwrap(x)` where T is an IMPORTED user-defined value type. The AstBuilder desugars these to
 * identity casts when T is declared in the SAME file (it is in the file's `typeDefMap`), but an IMPORTED T is
 * unknown at parse time, so the call survives as a dangling namespaced `FunctionCallNode` (`identifier.name` =
 * `T.wrap`) and later fails "Undefined reference to symbol T.wrap".
 *
 * Now that imports are merged (`node.typeDefinitions` carries the imported UDVTs), rewrite it into the same cast the
 * AstBuilder emits: a UDVT is identity at runtime over its underlying type, so `unwrap` is a cast to the underlying
 * type and `wrap` is a cast to the underlying type then to the UDVT. Runs pre-semantic, after imports merge.
 *
 * The driver is PRB-math (UD2x18 / UD60x18 / SD59x18): its `ud2x18(uint64)` converter and `UD2x18 constant`
 * initializers use `UD2x18.wrap` across files, reached transitively via Sablier.
 */
export default class RedesugarImportedUdvtWrap extends AstTraversal {
  private udvts: Map<string, ValueType> = new Map();

  visitSourceFile(node: SourceFileNode): Node {
    this.udvts = new Map();
    for (const td of node.typeDefinitions ?? []) this.udvts.set(td.name, td.valueType);
    for (const iface of (node.interfaceDefinitions ?? []) as InterfaceNode[]) {
      for (const td of iface.typeDefinitions ?? []) this.udvts.set(td.name, td.valueType);
    }
    if (this.udvts.size === 0) return node; // no UDVT in scope - nothing a `T.wrap` could bind to
    return super.visitSourceFile(node);
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    node.parameters = this.visitList(node.parameters) as ExpressionNode[];
    const name = node.identifier.name;
    const dot = name.lastIndexOf('.');
    if (dot <= 0 || node.parameters.length !== 1) return node;
    const udvt = this.udvts.get(name.slice(0, dot));
    const method = name.slice(dot + 1);
    if (!udvt || (method !== 'wrap' && method !== 'unwrap')) return node;

    const arg = node.parameters[0];
    // unwrap(x): cast the UDVT-typed value to its underlying type. wrap(x): cast the underlying value to the UDVT
    // (the underlying cast first, matching the AstBuilder, so a literal arg is coerced to the underlying type).
    if (method === 'unwrap') {
      const cast = new CastNode(udvt.underlyingType, arg, false);
      cast.location = node.location;
      return cast;
    }
    const toUnderlying = new CastNode(udvt.underlyingType, arg, false);
    toUnderlying.location = node.location;
    const cast = new CastNode(udvt, toUnderlying, false);
    cast.location = node.location;
    return cast;
  }
}
