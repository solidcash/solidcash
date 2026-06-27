import { ArrayType, BytesType, PrimitiveType, StructType, Type } from '@solidcash/utils';
import {
  BoolLiteralNode,
  ExpressionNode,
  FunctionCallNode,
  HexLiteralNode,
  IdentifierNode,
  IntLiteralNode,
  NewArrayNode,
  StringLiteralNode,
} from './AST.js';
import { Location } from './Location.js';

// Build the zero-value expression for a type (bool->false, string->"", bytesN->zeros,
// struct->default-initialized, everything else numeric->0). Shared by the symbol-table
// (struct named-arg defaults) and the named-return desugar.
export function createDefaultValueExpression(type: Type, location: Location): ExpressionNode {
  let node: ExpressionNode;
  if (type === PrimitiveType.BOOL) {
    node = new BoolLiteralNode(false);
  } else if (type === PrimitiveType.STRING) {
    node = new StringLiteralNode('', '"');
  } else if (type instanceof BytesType && type.bound !== undefined) {
    node = new HexLiteralNode(new Uint8Array(type.bound));
  } else if (type instanceof StructType) {
    const identifier = new IdentifierNode(type.name);
    identifier.location = location;
    node = new FunctionCallNode(identifier, type.fields.map((f) => createDefaultValueExpression(f.type, location)));
  } else if (type instanceof ArrayType) {
    // Array default: a zero-length array `new T[](0)` (bounded T[N] gets N zero-init elements).
    const size = new IntLiteralNode(BigInt(type.bound ?? 0));
    size.location = location;
    node = new NewArrayNode(type.elementType, size);
  } else {
    // int, bytes (unbounded), and all other numeric types default to 0
    node = new IntLiteralNode(0n);
  }
  node.location = location;
  return node;
}
