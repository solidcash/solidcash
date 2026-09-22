import type { Artifact, ExternalResultEncoding } from '@solidcash/utils';

/** True when this artifact's bytecode decodes external returns as EVM ABI words. */
export function artifactUsesSolidityAbi(artifact: Pick<Artifact, 'compiler'>): boolean {
  // Only the explicit compiler switch is authoritative. A `pragma solidity` source marker is not:
  // generateArtifact used to omit `solidityImportCompat` from published options, and those builds
  // decode a bool return as pushdata `0x51` (emitPushdataDecodeLastField). Inferring EVM framing
  // from the pragma then precomputes 32-byte `00…01`, which fails `EQUAL 0x51` at the caller.
  return artifact.compiler?.options?.evmCompat === true
    || artifact.compiler?.options?.solidityImportCompat === true;
}

const LEGACY_EVM_WORD_TYPE = /^(?:u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|bigint|bool|address(?: payable)?|bytes(?:[1-9]|[12][0-9]|3[0-2])|u?fixed(?:\d+x\d+)?)$/;

/**
 * Resolve an authenticated typed-result representation. Fresh artifacts publish this tuple-wide fact. Legacy
 * native artifacts are unambiguously compact; legacy Solidity artifacts are inferred only for one-word scalar
 * tuples, because dynamic/composite schemas had multiple historical representations and must fail closed.
 */
export function resolveExternalResultEncoding(
  published: ExternalResultEncoding | undefined,
  artifact: Pick<Artifact, 'compiler' | 'contractName' | 'enums'>,
  types: readonly string[],
  context = 'external result',
): ExternalResultEncoding {
  if (published !== undefined) return published;
  if (!artifactUsesSolidityAbi(artifact)) return 'compact-pushdata-v1';
  const enumNames = new Set((artifact.enums ?? []).map((entry) => entry.name));
  if (types.every((type) => LEGACY_EVM_WORD_TYPE.test(type) || enumNames.has(type))) return 'evm-abi-v1';
  throw new Error(
    `${context} in Solidity-compatible artifact '${artifact.contractName}' has no authenticated resultEncoding; `
    + 'recompile the artifact before consuming dynamic or composite results',
  );
}
