import { AbiFunction, AbiInput, Artifact, Op, bytecodeToScript, decodeInt, formatBitAuthScript } from '@solidcash/utils';
import { HashType, LibauthTokenDetails, SignatureAlgorithm, TokenDetails, VmTarget } from '../interfaces.js';
import { hexToBin, binToHex, isHex, decodeCashAddress, Input, assertSuccess, decodeAuthenticationInstructions, AuthenticationInstructionPush } from '@bitauth/libauth';
import { EncodedFunctionArgument, isSignatureTemplateArray } from '../Argument.js';
import { zip } from '../utils.js';
import SignatureTemplate from '../SignatureTemplate.js';
import { Contract } from '../Contract.js';

export const DEFAULT_VM_TARGET = VmTarget.BCH_2026_05;

export const getLockScriptName = (contract: Contract): string => {
  const result = decodeCashAddress(contract.address);
  if (typeof result === 'string') throw new Error(result);

  return `${contract.artifact.contractName}_${binToHex(result.payload)}_lock`;
};

export const getUnlockScriptName = (contract: Contract, abiFunction: AbiFunction, inputIndex: number): string => {
  return `${contract.artifact.contractName}_${abiFunction.name}_input${inputIndex}_unlock`;
};

export const getSignatureAlgorithmName = (signatureAlgorithm: SignatureAlgorithm): string => {
  const signatureAlgorithmNames = {
    [SignatureAlgorithm.SCHNORR]: 'schnorr_signature',
    [SignatureAlgorithm.ECDSA]: 'ecdsa_signature',
  };

  return signatureAlgorithmNames[signatureAlgorithm];
};

export const getHashTypeName = (hashType: HashType): string => {
  const hashtypeNames = {
    [HashType.SIGHASH_ALL]: 'all_outputs',
    [HashType.SIGHASH_ALL | HashType.SIGHASH_ANYONECANPAY]: 'all_outputs_single_input',
    [HashType.SIGHASH_ALL | HashType.SIGHASH_UTXOS]: 'all_outputs_all_utxos',
    [HashType.SIGHASH_ALL | HashType.SIGHASH_ANYONECANPAY | HashType.SIGHASH_UTXOS]: 'all_outputs_single_input_INVALID_all_utxos',
    [HashType.SIGHASH_SINGLE]: 'corresponding_output',
    [HashType.SIGHASH_SINGLE | HashType.SIGHASH_ANYONECANPAY]: 'corresponding_output_single_input',
    [HashType.SIGHASH_SINGLE | HashType.SIGHASH_UTXOS]: 'corresponding_output_all_utxos',
    [HashType.SIGHASH_SINGLE | HashType.SIGHASH_ANYONECANPAY | HashType.SIGHASH_UTXOS]: 'corresponding_output_single_input_INVALID_all_utxos',
    [HashType.SIGHASH_NONE]: 'no_outputs',
    [HashType.SIGHASH_NONE | HashType.SIGHASH_ANYONECANPAY]: 'no_outputs_single_input',
    [HashType.SIGHASH_NONE | HashType.SIGHASH_UTXOS]: 'no_outputs_all_utxos',
    [HashType.SIGHASH_NONE | HashType.SIGHASH_ANYONECANPAY | HashType.SIGHASH_UTXOS]: 'no_outputs_single_input_INVALID_all_utxos',
  };

  return hashtypeNames[hashType];
};

export const addHexPrefixExceptEmpty = (value: string): string => {
  return value.length > 0 ? `0x${value}` : '';
};

export const formatParametersForDebugging = (
  types: readonly AbiInput[], args: EncodedFunctionArgument[], variablePrefix: string = '',
): string => {
  if (types.length === 0) return '// none';

  // We reverse the arguments because the order of the arguments in the bytecode is reversed
  const typesAndArguments = zip(types, args).reverse();

  return typesAndArguments.map(([input, arg]) => {
    const varName = variablePrefix + input.name;
    if (arg instanceof SignatureTemplate) {
      const signatureAlgorithmName = getSignatureAlgorithmName(arg.getSignatureAlgorithm());
      const hashtypeName = getHashTypeName(arg.getHashType(false));
      return `<${varName}.${signatureAlgorithmName}.${hashtypeName}> // ${input.type}`;
    }
    if (isSignatureTemplateArray(arg)) return `<${varName}> // ${input.type} (finalized signatures)`;

    const typeStr = input.type === 'bytes' ? `bytes${arg.length}` : input.type;

    // we output these values as pushdata, comment will contain the type and the value of the variable
    // e.g. <timeout> // int = <0xa08601>
    return `<${varName}> // ${typeStr} = <${`0x${binToHex(arg)}`}>`;
  }).join('\n');
};

export const getInvokeBodyLockScriptName = (contractName: string, id: string): string => {
  const safeId = id.startsWith('-') ? `negative_${id.slice(1)}` : id;
  return `${contractName}_invoke_${safeId}_body_lock`;
};

export const getDefinedFunctionBodyLockScriptName = (contractName: string, selector: string): string =>
  `${contractName}_define_${selector}_body_lock`;

export const formatBytecodeForDebugging = (artifact: Artifact): string => {
  if (!artifact.debug) {
    return artifact.bytecode
      .split(' ')
      .map((asmElement) => (isHex(asmElement) ? `<0x${asmElement}>` : asmElement))
      .join('\n');
  }

  const script = bytecodeToScript(hexToBin(artifact.debug.bytecode));
  const replacements = new Map<number, string>();
  const invokeDebug = artifact.debug.invokeDebug ?? {};
  for (let index = 2; index < script.length; index += 1) {
    if (script[index] !== Op.OP_DEFINE || !(script[index - 2] instanceof Uint8Array)) continue;
    const encodedId = script[index - 1];
    const numericId = encodedId instanceof Uint8Array
      ? decodeInt(encodedId)
      : encodedId === Op.OP_1NEGATE
        ? -1n
        : encodedId >= Op.OP_1 && encodedId <= Op.OP_16
          ? BigInt(encodedId - Op.OP_1 + 1)
          : undefined;
    if (numericId === undefined) continue;
    const id = numericId.toString();
    const selector = encodedId instanceof Uint8Array ? binToHex(encodedId) : '';
    const body = script[index - 2] as Uint8Array;
    const bodyHex = binToHex(body);
    if (invokeDebug[id]?.bytecode === bodyHex) {
      replacements.set(index - 2, `<${getInvokeBodyLockScriptName(artifact.contractName, id)}>`);
    } else if (artifact.functionBodies?.[selector] === bodyHex) {
      replacements.set(index - 2, `<${getDefinedFunctionBodyLockScriptName(artifact.contractName, selector)}>`);
    }
  }

  return formatBitAuthScript(
    script,
    artifact.debug.sourceMap,
    artifact.source,
    replacements,
  );
};

export const serialiseTokenDetails = (
  token?: TokenDetails | LibauthTokenDetails,
): LibauthTemplateTokenDetails | undefined => {
  if (!token) return undefined;

  return {
    amount: token.amount.toString(),
    category: token.category instanceof Uint8Array ? binToHex(token.category) : token.category,
    nft: token.nft ? {
      capability: token.nft.capability,
      commitment: token.nft.commitment instanceof Uint8Array ? binToHex(token.nft.commitment) : token.nft.commitment,
    } : undefined,
  };
};

interface LibauthTemplateTokenDetails {
  amount: string;
  category: string;
  nft?: {
    capability: 'none' | 'mutable' | 'minting';
    commitment: string;
  };
}

export const formatFunctionBodyForDebugging = (artifact: Artifact, selectorHex: string): string => {
  const functionBody = artifact.functionBodies![selectorHex];
  const functionDebug = artifact.debug!.functionDebug![selectorHex];
  return formatBitAuthScript(
    bytecodeToScript(hexToBin(functionBody)),
    functionDebug.sourceMap,
    artifact.source,
  );
};

export const formatInvokeBodyForDebugging = (artifact: Artifact, functionId: string): string => {
  const invokeDebug = (artifact.debug as NonNullable<Artifact['debug']> & {
    invokeDebug?: Record<string, { bytecode: string; sourceMap: string }>;
  }).invokeDebug?.[functionId];
  if (!invokeDebug) throw new Error(`No OP_INVOKE debug information for function id ${functionId}`);
  return formatBitAuthScript(
    bytecodeToScript(hexToBin(invokeDebug.bytecode)),
    invokeDebug.sourceMap,
    artifact.source,
  );
};

export const getBodyLockScriptName = (contract: Contract, abiFunction: AbiFunction): string =>
  `${contract.artifact.contractName}_${abiFunction.name}_body_lock`;

export const getBodyUnlockScriptName = (contract: Contract, abiFunction: AbiFunction, inputIndex: number): string =>
  `${contract.artifact.contractName}_${abiFunction.name}_body_input${inputIndex}_unlock`;

export const getSignatureAndPubkeyFromP2PKHInput = (
  libauthInput: Input,
): { signature: Uint8Array; publicKey: Uint8Array } => {
  const inputData = (assertSuccess(
    decodeAuthenticationInstructions(libauthInput.unlockingBytecode))
  ) as AuthenticationInstructionPush[];
  const signature = inputData[0].data;
  const publicKey = inputData[1].data;

  return { signature, publicKey };
};
