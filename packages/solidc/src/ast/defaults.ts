import {
  AddressType, ArrayType, BytesType, EnumType, PrimitiveType, StructType, Type, ValueType,
} from '@solidcash/utils';
import {
  BoolLiteralNode,
  CastNode,
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
  } else if (type instanceof BytesType) {
    // bytesN -> N zero bytes; unbounded `bytes` -> empty bytes (0x), NOT int 0 (which mismatches a `bytes` return).
    node = new HexLiteralNode(new Uint8Array(type.bound ?? 0));
  } else if (type instanceof StructType) {
    const identifier = new IdentifierNode(type.name);
    identifier.location = location;
    node = new FunctionCallNode(identifier, type.fields.map((f) => createDefaultValueExpression(f.type, location)));
  } else if (type instanceof ArrayType) {
    // Array default: a zero-length array `new T[](0)` (bounded T[N] gets N zero-init elements).
    const size = new IntLiteralNode(BigInt(type.bound ?? 0));
    size.location = location;
    node = new NewArrayNode(type.elementType, size);
  } else if (type instanceof AddressType || type instanceof EnumType) {
    // address / enum have no int-0 literal of their own type: `0` is typed int and does not implicitly cast to
    // address (and reads confusingly for enums). Wrap in a cast to the target type, mirroring `address(0)` /
    // `E(0)` written by hand - the cast carries the type so a fall-through `return <defaults>` type-checks.
    const zero = new IntLiteralNode(0n);
    zero.location = location;
    node = new CastNode(type, zero, false);
  } else if (type instanceof ValueType) {
    // A user-defined value type wraps its underlying type; default to the underlying default wrapped in the
    // UDVT (an identity cast). The inner value is typed as the exact underlying type so the wrap cast (which
    // requires source == underlying) type-checks, and a fall-through `return <default>` compiles.
    const inner = createDefaultValueExpression(type.underlyingType, location);
    inner.type = type.underlyingType;
    node = new CastNode(type, inner, false);
  } else {
    // int, bytes (unbounded), and all other numeric types default to 0
    node = new IntLiteralNode(0n);
  }
  node.location = location;
  return node;
}
