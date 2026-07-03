import { sha256, utf8ToBin } from '@bitauth/libauth';
import { BytesType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import {
  Node, FunctionCallNode, ExpressionNode, StringLiteralNode, HexLiteralNode,
} from '../ast/AST.js';

// Fold `keccak256(<literal>)` / `sha256(<literal>)` (a single string/hex literal arg) to a compile-time
// bytes32 constant, so it works as a `bytes32 constant` initializer (role ids `keccak256("MINTER_ROLE")`,
// EIP-712 domain separators, EVM storage slots `keccak256("...")`). BCH has no native keccak, so under
// solidityImportCompat keccak256 is folded with sha256 (the doc's slot rule) - a warned, internally-consistent
// substitution (sound for slots + roles compared within the contract; not byte-identical to Ethereum for
// cross-chain values). Plain sha256 folds byte-identically. Runs pre-semantic so the result is a literal.
export default class FoldHashLiterals extends AstTraversal {
  private warned = false;

  constructor(private readonly solidityImportCompat = false) {
    super();
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    const name = node.identifier.name;
    // keccak256 only folds under compat (native solidcash keeps real keccak via the runtime library); sha256
    // always folds (byte-identical).
    const foldable = name === 'sha256' || (name === 'keccak256' && this.solidityImportCompat);
    if (foldable && node.parameters.length === 1) {
      const bytes = FoldHashLiterals.literalBytes(node.parameters[0]);
      if (bytes) {
        if (name === 'keccak256' && !this.warned) {
          this.warned = true;
          console.log('Warning: keccak256(<constant>) is folded with sha256 on BCH (no native keccak); the '
            + '32-byte result differs from Ethereum keccak256. Sound for internal use (storage slots, role ids '
            + 'compared only within this contract); do not rely on cross-chain byte-identity.');
        }
        const lit = new HexLiteralNode(sha256.hash(bytes));
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
