import { hexToBin } from '@bitauth/libauth';
import { encodeInt } from './data.js';
import { hash256 } from './hash.js';
import { Op, scriptToBytecode } from './script.js';
/** The specialized verifier cannot fit within BCH's consensus script-size limit. */
export class MessageBusVerifierCapacityError extends Error {
    constructor(byteLength, maximumInputBytes = 10_000) {
        super(`message bus verifier covenant is ${byteLength} bytes; active consensus permits at most ${maximumInputBytes}`);
        this.name = this.constructor.name;
    }
}
/** Commitment domain for one genesis-deployed composition-verifier instance. */
export const MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN = new Uint8Array([0x4c, 0x33, 0x56, 0x31]); // L3V1
/** Stable per-instance commitment. Instances share one covenant address but remain independently discoverable. */
export const messageBusVerifierCommitment = (instance) => {
    if (!Number.isSafeInteger(instance) || instance < 0 || instance > 0xffff) {
        throw new Error('message bus verifier instance must be an unsigned 16-bit integer');
    }
    return Uint8Array.from([
        ...MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN,
        instance & 0xff,
        (instance >>> 8) & 0xff,
    ]);
};
/**
 * Category-branded, self-preserving message bus verifier covenant.
 *
 * The global callManifest verifier is deliberately added to this covenant rather than to participant masters;
 * these preservation checks are the stable deployment and recreation boundary. The mutable NFT commitment
 * identifies one of N independently spendable verifier instances deployed with the contract.
 */
export function buildMessageBusVerifierCovenantScript(program, maximumInputBytes = 10_000) {
    const verify = program.functions.find((fn) => fn.id === program.verifyFunctionId);
    if (!verify)
        throw new Error('message bus verifier program omits its verify function');
    if (!Number.isSafeInteger(program.inputCount) || program.inputCount < 1) {
        throw new Error('message bus verifier program has an invalid input count');
    }
    if (program.inputs.length !== program.inputCount) {
        throw new Error('message bus verifier program input metadata does not match its input count');
    }
    if (new Set(program.functions.map((fn) => fn.id)).size !== program.functions.length) {
        throw new Error('message bus verifier program contains duplicate function identifiers');
    }
    const script = [
        // The SDK calculates one covered-bytecode density reserve after encoding the real arguments, padding each
        // verifier to a common byte floor. Dropping an unlocking push is substantially cheaper than embedding
        // unreachable bytes in every redeemed covenant script.
        Op.OP_DROP,
        // Unlocking stack: <messageEnvelope> <verify arguments...>. The verifier consumes only its arguments, leaving the
        // messageEnvelope. Never park it on the altstack: compiled verifier frames use that stack internally.
        ...program.functions.flatMap((fn) => [
            hexToBin(fn.bytecode), encodeInt(BigInt(fn.id)), Op.OP_DEFINE,
        ]),
        encodeInt(BigInt(verify.id)),
        Op.OP_INVOKE,
        ...(program.lifecycle === true || program.splitLifecycle === true ? [
            // Lifecycle-capable verifiers return bindingDigest || envelopeHash || uint16 lifecycle code. Zero selects
            // an ordinary row, split uses its positive count, and merge uses its negative count.
            encodeInt(32n), Op.OP_SPLIT, encodeInt(32n), Op.OP_SPLIT,
            Op.OP_SIZE, encodeInt(2n), Op.OP_NUMEQUALVERIFY,
            Op.OP_TOALTSTACK, Op.OP_ROT, Op.OP_SHA256, Op.OP_EQUALVERIFY,
            Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT, encodeInt(6n), Op.OP_SPLIT, Op.OP_DROP,
            Op.OP_DUP, encodeInt(4n), Op.OP_SPLIT, Op.OP_DROP,
            MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN, Op.OP_EQUALVERIFY,
            Op.OP_SWAP, Op.OP_CAT, Op.OP_FROMALTSTACK, Op.OP_CAT, Op.OP_TOALTSTACK,
        ] : [
            // Ordinary verifier programs retain the original exact 64-byte result and covenant bytecode. Keeping the
            // split-count transport out of this path preserves both deployed compatibility and operation-cost density.
            encodeInt(32n), Op.OP_SPLIT,
            Op.OP_ROT, Op.OP_SHA256, Op.OP_EQUALVERIFY,
            Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT, encodeInt(6n), Op.OP_SPLIT, Op.OP_DROP,
            Op.OP_DUP, encodeInt(4n), Op.OP_SPLIT, Op.OP_DROP,
            MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN, Op.OP_EQUALVERIFY,
            Op.OP_SWAP, Op.OP_CAT, Op.OP_TOALTSTACK,
        ]),
        // Require a mutable NFT, then preserve its deployment category exactly.
        Op.OP_INPUTINDEX,
        Op.OP_UTXOTOKENCATEGORY,
        Op.OP_DUP,
        encodeInt(32n),
        Op.OP_SPLIT,
        Op.OP_1,
        Op.OP_EQUALVERIFY,
        Op.OP_DROP,
        Op.OP_INPUTINDEX,
        Op.OP_OUTPUTTOKENCATEGORY,
        Op.OP_EQUALVERIFY,
        // Recreate the fixed covenant and economic payload at the active input's output index.
        Op.OP_INPUTINDEX,
        Op.OP_UTXOBYTECODE,
        Op.OP_INPUTINDEX,
        Op.OP_OUTPUTBYTECODE,
        Op.OP_EQUALVERIFY,
        Op.OP_FROMALTSTACK,
        Op.OP_INPUTINDEX,
        Op.OP_OUTPUTTOKENCOMMITMENT,
        Op.OP_EQUALVERIFY,
        Op.OP_INPUTINDEX,
        Op.OP_UTXOTOKENAMOUNT,
        Op.OP_INPUTINDEX,
        Op.OP_OUTPUTTOKENAMOUNT,
        Op.OP_NUMEQUALVERIFY,
        Op.OP_INPUTINDEX,
        Op.OP_UTXOVALUE,
        Op.OP_INPUTINDEX,
        Op.OP_OUTPUTVALUE,
        Op.OP_NUMEQUAL,
    ];
    const byteLength = scriptToBytecode(script).length;
    if (byteLength > maximumInputBytes) {
        throw new MessageBusVerifierCapacityError(byteLength, maximumInputBytes);
    }
    return script;
}
export const messageBusVerifierCovenantBytecode = (program, maximumInputBytes = 10_000) => scriptToBytecode(buildMessageBusVerifierCovenantScript(program, maximumInputBytes));
export const messageBusVerifierCovenantHex = (program) => Array.from(messageBusVerifierCovenantBytecode(program), (byte) => byte.toString(16).padStart(2, '0')).join('');
/** Artifact-fixed P2SH32 lock; the NFT category supplies deployment-specific branding. */
export const messageBusVerifierLockingBytecode = (program, maximumInputBytes = 10_000) => Uint8Array.from([
    0xaa, 0x20, ...hash256(messageBusVerifierCovenantBytecode(program, maximumInputBytes)), 0x87,
]);
//# sourceMappingURL=message-bus-verifier.js.map