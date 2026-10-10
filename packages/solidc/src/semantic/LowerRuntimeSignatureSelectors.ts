import { BytesType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import {
  type Node, AbiEncodeWithSelectorNode, AbiEncodeWithSignatureNode, CastNode,
  FunctionCallNode, IdentifierNode, StringLiteralNode,
} from '../ast/AST.js';

/**
 * Solidity's `abi.encodeWithSignature(sig, args)` hashes the signature string it is HANDED, so a signature built at
 * runtime (a bare parameter, or `string.concat(...)`) is legal. Under `evmCompat` a literal signature folds to a
 * compile-time keccak selector in the symbol pass; a non-literal one lowers here, before any function-body survey,
 * to
 *
 *     abi.encodeWithSelector(bytes4(keccak256(bytes(<sig>))), args)
 *
 * so the existing keccak256 compute-and-commit side-car supplies the digest exactly as for a source-level
 * `keccak256` (the SDK co-spends it and resolves the runtime preimage the same way), and the standard EVM encoder
 * then frames the arguments. A native compile is untouched and stays on its codegen path, which hashes the runtime
 * string with `OP_SHA256` and needs no side-car.
 */
export default class LowerRuntimeSignatureSelectors extends AstTraversal {
  visitAbiEncodeWithSignature(node: AbiEncodeWithSignatureNode): Node {
    super.visitAbiEncodeWithSignature(node);
    if (node.signature instanceof StringLiteralNode) return node;
    const asBytes = new CastNode(new BytesType(), node.signature, false);
    asBytes.location = node.location;
    const hash = new FunctionCallNode(new IdentifierNode('keccak256'), [asBytes]);
    hash.location = node.location;
    const selector = new CastNode(new BytesType(4), hash, false);
    selector.location = node.location;
    const encoded = new AbiEncodeWithSelectorNode(selector, node.parameters);
    encoded.location = node.location;
    encoded.type = node.type;
    return encoded;
  }
}
