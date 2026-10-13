import { HexLiteralNode, IntLiteralNode, StringLiteralNode, type ExpressionNode } from '../ast/AST.js';

/**
 * The value stored by `b[i] = v` on `bytes`, which is rebuilt as `b[0:i] ++ v ++ b[i+1:]`. A literal `0` or a
 * one-byte string has no byte width of its own (a numeric zero is empty in Script), so give it the one byte Solidity
 * converts it to; every other value is returned unchanged.
 */
export function byteElementValue(value: ExpressionNode): ExpressionNode {
  let bytes: Uint8Array | undefined;
  if (value instanceof IntLiteralNode && value.value === 0n) {
    bytes = new Uint8Array(1);
  } else if (value instanceof StringLiteralNode) {
    const encoded = value.solidityBytes ?? new TextEncoder().encode(value.value);
    if (encoded.length === 1) bytes = encoded;
  }
  if (!bytes) return value;
  const byte = new HexLiteralNode(bytes);
  byte.location = value.location;
  return byte;
}
