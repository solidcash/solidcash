import { sha256, utf8ToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { BytesType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import {
  Node, FunctionCallNode, ExpressionNode, StringLiteralNode, HexLiteralNode,
} from '../ast/AST.js';

// Fold `keccak256(<literal>)` / `sha256(<literal>)` (a single string/hex literal arg) to a compile-time bytes32
// constant, so it works as a `bytes32 constant` initializer (role ids `keccak256("MINTER_ROLE")`, EIP-712 domain
// separators, EVM storage slots `keccak256("...")`). Both fold byte-identically to their real hash - keccak256 to
// REAL keccak256 (matching the runtime keccak library and Ethereum), sha256 to sha256. Runs pre-semantic so the
// result is a literal. (Runtime keccak256 of a dynamic value uses the keccak side-car library; this only folds
// literal constants.)
export default class FoldHashLiterals extends AstTraversal {
  visitFunctionCall(node: FunctionCallNode): Node {
    const name = node.identifier.name;
    if ((name === 'sha256' || name === 'keccak256') && node.parameters.length === 1) {
      const bytes = FoldHashLiterals.literalBytes(node.parameters[0]);
      if (bytes) {
        const digest = name === 'keccak256' ? keccak_256(bytes) : sha256.hash(bytes);
        const lit = new HexLiteralNode(Uint8Array.from(digest));
        lit.type = new BytesType(32);
        lit.location = node.location;
        return lit;
      }
    }
    return super.visitFunctionCall(node);
  }

  private static literalBytes(expr: ExpressionNode): Uint8Array | undefined {
    if (expr instanceof StringLiteralNode) return utf8ToBin(expr.value);
    if (expr instanceof HexLiteralNode) return expr.value;
    return undefined;
  }
}
