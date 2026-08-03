import { hexToBin } from '@bitauth/libauth';
import { encodeInt } from './data.js';
import { hash256 } from './hash.js';
import { Op, type Script, scriptToBytecode } from './script.js';

export interface Layer3VerifierProgram {
  verifyFunctionId: number;
  inputCount: number;
  inputs: readonly { name: string; type: string }[];
  functions: readonly { id: number; name: string; bytecode: string }[];
}

/** Commitment domain for one genesis-deployed composition-verifier instance. */
export const LAYER3_VERIFIER_COMMITMENT_DOMAIN = new Uint8Array([0x4c, 0x33, 0x56, 0x31]); // L3V1

/** Stable per-instance commitment. Instances share one covenant address but remain independently discoverable. */
export const layer3VerifierCommitment = (instance: number): Uint8Array => {
  if (!Number.isSafeInteger(instance) || instance < 0 || instance > 0xffff) {
    throw new Error('Layer-3 verifier instance must be an unsigned 16-bit integer');
  }
  return Uint8Array.from([
    ...LAYER3_VERIFIER_COMMITMENT_DOMAIN,
    instance & 0xff,
    (instance >>> 8) & 0xff,
  ]);
};

/**
 * Category-branded, self-preserving Layer-3 verifier covenant.
 *
 * The global transcript verifier is deliberately added to this covenant rather than to participant masters;
 * these preservation checks are the stable deployment and recreation boundary. The mutable NFT commitment
 * identifies one of N independently spendable verifier instances deployed with the contract.
 */
export function buildLayer3VerifierCovenantScript(program: Layer3VerifierProgram): Script {
  const verify = program.functions.find((fn) => fn.id === program.verifyFunctionId);
  if (!verify) throw new Error('Layer-3 verifier program omits its verify function');
  if (!Number.isSafeInteger(program.inputCount) || program.inputCount < 1) {
    throw new Error('Layer-3 verifier program has an invalid input count');
  }
  if (program.inputs.length !== program.inputCount) {
    throw new Error('Layer-3 verifier program input metadata does not match its input count');
  }
  if (new Set(program.functions.map((fn) => fn.id)).size !== program.functions.length) {
    throw new Error('Layer-3 verifier program contains duplicate function identifiers');
  }
  const script: Script = [
    // BCH-2026 covered-bytecode density reserve belongs in the deployed verifier, never in each master.
    // The branch is unreachable and performs no data manipulation at runtime.
    Op.OP_0,
    Op.OP_IF,
    new Uint8Array(512),
    Op.OP_ENDIF,
    // Unlocking stack: <carrier> <verify arguments...>. The verifier consumes only its arguments, leaving the
    // carrier. Never park it on the altstack: compiled verifier frames use that stack internally.
    ...program.functions.flatMap((fn): Script => [
      hexToBin(fn.bytecode), encodeInt(BigInt(fn.id)), Op.OP_DEFINE,
    ]),
    encodeInt(BigInt(verify.id)),
    Op.OP_INVOKE,

    // The specialized verifier returns bindingDigest || expectedCarrierHash. Authenticate the carrier without
    // parsing it, then retain only bindingDigest for the recreated NFT commitment.
    Op.OP_SIZE,
    encodeInt(64n),
    Op.OP_NUMEQUALVERIFY,
    encodeInt(32n),
    Op.OP_SPLIT,
    Op.OP_ROT,
    Op.OP_SHA256,
    Op.OP_EQUALVERIFY,
    Op.OP_INPUTINDEX,
    Op.OP_UTXOTOKENCOMMITMENT,
    encodeInt(6n),
    Op.OP_SPLIT,
    Op.OP_DROP,
    Op.OP_DUP,
    encodeInt(4n),
    Op.OP_SPLIT,
    Op.OP_DROP,
    LAYER3_VERIFIER_COMMITMENT_DOMAIN,
    Op.OP_EQUALVERIFY,
    Op.OP_SWAP,
    Op.OP_CAT,
    Op.OP_TOALTSTACK,

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
  if (byteLength > 10_000) {
    throw new Error(`Layer-3 verifier covenant is ${byteLength} bytes; BCH permits at most 10000`);
  }
  return script;
}

export const layer3VerifierCovenantBytecode = (program: Layer3VerifierProgram): Uint8Array =>
  scriptToBytecode(buildLayer3VerifierCovenantScript(program));

export const layer3VerifierCovenantHex = (program: Layer3VerifierProgram): string =>
  Array.from(layer3VerifierCovenantBytecode(program), (byte) => byte.toString(16).padStart(2, '0')).join('');

/** Artifact-fixed P2SH32 lock; the NFT category supplies deployment-specific branding. */
export const layer3VerifierLockingBytecode = (program: Layer3VerifierProgram): Uint8Array =>
  Uint8Array.from([0xaa, 0x20, ...hash256(layer3VerifierCovenantBytecode(program)), 0x87]);
