import type { Artifact } from '@solidcash/utils';

/** True when this artifact's bytecode decodes external returns as EVM ABI words. */
export function artifactUsesSolidityAbi(artifact: Pick<Artifact, 'compiler'>): boolean {
  // Only the explicit compiler switch is authoritative. A `pragma solidity` source marker is not:
  // generateArtifact used to omit `solidityImportCompat` from published options, and those builds
  // decode a bool return as pushdata `0x51` (emitPushdataDecodeLastField). Inferring EVM framing
  // from the pragma then precomputes 32-byte `00…01`, which fails `EQUAL 0x51` at the caller.
  return artifact.compiler?.options?.evmCompat === true
    || artifact.compiler?.options?.solidityImportCompat === true;
}
