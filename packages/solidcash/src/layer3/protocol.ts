import { Layer3DiagnosticError } from './diagnostics.js';

/** Immutable artifacts retain at most the current and immediately previous bus protocol. */
export const MAX_BATCH_PROTOCOLS_PER_ARTIFACT = 2;

export const normalizeProtocolVersions = (versions: readonly number[], participant?: number): number[] => {
  const normalized = [...new Set(versions)].sort((a, b) => a - b);
  if (normalized.length === 0 || normalized.length > MAX_BATCH_PROTOCOLS_PER_ARTIFACT) {
    throw new Layer3DiagnosticError(
      'L3_PROTOCOL_METADATA_MALFORMED',
      `artifacts must retain between 1 and ${MAX_BATCH_PROTOCOLS_PER_ARTIFACT} protocol versions`,
      { metadataField: 'invocationAnalysis.protocolVersions', actual: versions, expected: '1..2 entries', participant },
    );
  }
  if (normalized.some((version) => !Number.isInteger(version) || version < 1 || version > 255)) {
    throw new Layer3DiagnosticError(
      'L3_PROTOCOL_METADATA_MALFORMED',
      'protocol versions must be integer bytes in [1, 255]',
      { metadataField: 'invocationAnalysis.protocolVersions', actual: versions, expected: 'integer bytes [1,255]', participant },
    );
  }
  return normalized;
};

/** Select the highest mutually supported immutable protocol version. */
export const negotiateProtocolVersion = (
  participants: readonly (readonly number[])[],
): number => {
  if (participants.length === 0) throw new Error('layer3: protocol negotiation requires participants');
  const supported = participants.map((versions, participant) => normalizeProtocolVersions(versions, participant));
  const common = supported[0].filter((version) =>
    supported.slice(1).every((versions) => versions.includes(version)));
  if (common.length === 0) {
    throw new Layer3DiagnosticError(
      'L3_PROTOCOL_VERSION_UNSUPPORTED',
      'participant protocol versions have no intersection',
      { metadataField: 'invocationAnalysis.protocolVersions', actual: supported, expected: 'non-empty intersection' },
    );
  }
  return common[common.length - 1];
};

export const protocolVersionHex = (version: number): string =>
  normalizeProtocolVersions([version])[0].toString(16).padStart(2, '0');
