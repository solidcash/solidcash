import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
import { encodeInt } from './data.js';
import { hash256 } from './hash.js';
import { Op, type Script, scriptToBytecode } from './script.js';

export interface MessageBusVerifierProgram {
  verifyFunctionId: number;
  inputCount: number;
  inputs: readonly { name: string; type: string }[];
  functions: readonly { id: number; name: string; bytecode: string }[];
  /** Compatibility metadata published by replacement-style verifier artifacts. */
  results?: readonly { type: string }[];
  /** Selector-derived participant lifecycle authority encoded in the verifier's two-byte result suffix. */
  lifecycle?: true;
  /** @deprecated Read support for artifacts emitted before lifecycle authority was generalized to merge. */
  splitLifecycle?: true;
  /** V5: read the one authenticated envelope from the root compiler-route input, not this unlocking stack. */
  envelopeTransport?: 'root-route' | 'proxy-forward';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Validate verifier-program JSON before it is allowed to determine a covenant address. */
export function assertMessageBusVerifierProgram(program: unknown): asserts program is MessageBusVerifierProgram {
  if (!isRecord(program)) throw new Error('message bus verifier program must be an object');
  const { verifyFunctionId, inputCount, inputs, results, functions, envelopeTransport } = program;
  if (!Number.isSafeInteger(verifyFunctionId)
    || !Number.isSafeInteger(inputCount) || typeof inputCount !== 'number' || inputCount < 1
    || !Array.isArray(inputs) || inputs.length !== inputCount
    || !inputs.every((input) => isRecord(input)
      && typeof input.name === 'string' && input.name.length > 0
      && typeof input.type === 'string' && input.type.length > 0)
    || (results !== undefined && (!Array.isArray(results) || results.length !== 3
      || !results.every((result) => isRecord(result) && result.type === 'bytes32')))
    || (envelopeTransport !== undefined && envelopeTransport !== 'root-route'
      && envelopeTransport !== 'proxy-forward')
    || !Array.isArray(functions) || functions.length === 0
    || !functions.every((fn) => isRecord(fn)
      && Number.isSafeInteger(fn.id)
      && typeof fn.name === 'string' && fn.name.length > 0
      && typeof fn.bytecode === 'string' && fn.bytecode.length > 0
      && /^[0-9a-f]*$/i.test(fn.bytecode) && fn.bytecode.length % 2 === 0)) {
    throw new Error('message bus verifier program has an invalid replacement shape');
  }
  const ids = functions.map((fn) => fn.id as number);
  const names = functions.map((fn) => fn.name as string);
  const canonicalInputs = [
    ['activeInputIndex', 'bigint'], ['expectedLocalRows', 'bigint'], ['localBatch', 'bytes'],
  ];
  const canonicalUpgradeInputs = [
    ['__internal__upgradeBytecode', 'bytes'], ['__internal__upgradeStateSuffix', 'bytes'],
  ];
  const canonicalGraphInputs = [
    ['suppliedFixedSize', 'bigint'], ['suppliedBlockSize', 'bigint'], ['suppliedEmissions', 'bytes'],
    ['suppliedCallers', 'bytes'], ['suppliedSettlementBoundary', 'bigint'],
    ['suppliedCompletionPositions', 'bytes'], ['suppliedSettlementTable', 'bytes'],
  ];
  const metadataInputs = inputs as { name: string; type: string }[];
  const expectedInputs = inputCount === 3 ? canonicalInputs
    : inputCount === 5 ? [...canonicalInputs, ...canonicalUpgradeInputs]
      : inputCount === 10 ? [...canonicalInputs, ...canonicalGraphInputs]
        : inputCount === 12 ? [...canonicalInputs, ...canonicalUpgradeInputs, ...canonicalGraphInputs]
          : undefined;
  if (new Set(ids).size !== ids.length || new Set(names).size !== names.length
    || expectedInputs === undefined
    || !expectedInputs.every(([name, type], index) =>
      metadataInputs[index].name === name && metadataInputs[index].type === type)
    || !ids.includes(verifyFunctionId as number)
    || functions.find((fn) => fn.id === verifyFunctionId)?.name !== '__message_bus_verify_atomic') {
    throw new Error('message bus verifier program has an invalid replacement function table');
  }
}

/** The specialized verifier cannot fit within BCH's consensus script-size limit. */
export class MessageBusVerifierCapacityError extends Error {
  constructor(byteLength: number, maximumInputBytes = 10_000) {
    super(`message bus verifier covenant is ${byteLength} bytes; active consensus permits at most ${maximumInputBytes}`);
    this.name = this.constructor.name;
  }
}

/** Commitment domain for one genesis-deployed composition-verifier instance. */
export const MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN = new Uint8Array([0x4c, 0x33, 0x56, 0x31]); // L3V1
/** Domain separation for the replacement master/verifier binding preimage. */
export const MESSAGE_BUS_BINDING_DOMAIN = new Uint8Array([0x4c, 0x33, 0x42, 0x31]); // L3B1
/** Six-byte instance prefix plus manifest and binding digests. */
export const MESSAGE_BUS_VERIFIER_RECURRENT_COMMITMENT_BYTES = 70;

/** Stable per-instance commitment. Instances share one covenant address but remain independently discoverable. */
export const messageBusVerifierCommitment = (instance: number): Uint8Array => {
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
export function buildMessageBusVerifierCovenantScript(
  program: MessageBusVerifierProgram, maximumInputBytes = 10_000,
): Script {
  assertMessageBusVerifierProgram(program);
  const verify = program.functions.find((fn) => fn.id === program.verifyFunctionId);
  if (!verify) throw new Error('message bus verifier program omits its verify function');
  if (!Number.isSafeInteger(program.inputCount) || program.inputCount < 1) {
    throw new Error('message bus verifier program has an invalid input count');
  }
  if (program.inputs.length !== program.inputCount) {
    throw new Error('message bus verifier program input metadata does not match its input count');
  }
  if (new Set(program.functions.map((fn) => fn.id)).size !== program.functions.length) {
    throw new Error('message bus verifier program contains duplicate function identifiers');
  }
  const rootRouteEnvelope = program.envelopeTransport === 'root-route'
    || program.envelopeTransport === 'proxy-forward';
  const script: Script = [
    // The SDK calculates one covered-bytecode density reserve after encoding the real arguments, padding each
    // verifier to a common byte floor. Dropping an unlocking push is substantially cheaper than embedding
    // unreachable bytes in every redeemed covenant script.
    Op.OP_DROP,
    // Legacy unlocking stack: <messageEnvelope> <verify arguments...>. V5 has only the arguments: the compiled
    // program loads and authenticates the one root-route envelope. Never park the legacy envelope on the altstack:
    // compiled verifier frames use that stack internally.
    ...program.functions.flatMap((fn): Script => [
      hexToBin(fn.bytecode), encodeInt(BigInt(fn.id)), Op.OP_DEFINE,
    ]),
    encodeInt(BigInt(verify.id)),
    Op.OP_INVOKE,

    ...(program.lifecycle === true || program.splitLifecycle === true ? [
      // V5 returns bindingDigest || uint16 lifecycle code; legacy also carries envelopeHash. In both formats,
      // zero selects an ordinary row, split uses its positive count, and merge uses its negative count.
      ...(rootRouteEnvelope
        ? [encodeInt(32n), Op.OP_SPLIT, Op.OP_SIZE, encodeInt(2n), Op.OP_NUMEQUALVERIFY, Op.OP_TOALTSTACK]
        : [encodeInt(32n), Op.OP_SPLIT, encodeInt(32n), Op.OP_SPLIT,
          Op.OP_SIZE, encodeInt(2n), Op.OP_NUMEQUALVERIFY,
          Op.OP_TOALTSTACK, Op.OP_ROT, Op.OP_SHA256, Op.OP_EQUALVERIFY]),
      Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCOMMITMENT, encodeInt(6n), Op.OP_SPLIT, Op.OP_DROP,
      Op.OP_DUP, encodeInt(4n), Op.OP_SPLIT, Op.OP_DROP,
      MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN, Op.OP_EQUALVERIFY,
      Op.OP_SWAP, Op.OP_CAT, Op.OP_FROMALTSTACK, Op.OP_CAT, Op.OP_TOALTSTACK,
    ] : [
      // Legacy ordinary programs retain their exact 64-byte result and covenant bytecode. V5 instead checks
      // that the root-carrier program returned precisely one 32-byte binding digest.
      ...(rootRouteEnvelope
        ? [Op.OP_SIZE, encodeInt(32n), Op.OP_NUMEQUALVERIFY]
        : [encodeInt(32n), Op.OP_SPLIT, Op.OP_ROT, Op.OP_SHA256, Op.OP_EQUALVERIFY]),
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

export const messageBusVerifierCovenantBytecode = (
  program: MessageBusVerifierProgram, maximumInputBytes = 10_000,
): Uint8Array => scriptToBytecode(buildMessageBusVerifierCovenantScript(program, maximumInputBytes));

export const messageBusVerifierCovenantHex = (program: MessageBusVerifierProgram): string =>
  Array.from(messageBusVerifierCovenantBytecode(program), (byte) => byte.toString(16).padStart(2, '0')).join('');

/** Artifact-fixed P2SH32 lock; the NFT category supplies deployment-specific branding. */
export const messageBusVerifierLockingBytecode = (
  program: MessageBusVerifierProgram, maximumInputBytes = 10_000,
): Uint8Array => Uint8Array.from([
  0xaa, 0x20, ...hash256(messageBusVerifierCovenantBytecode(program, maximumInputBytes)), 0x87,
]);
