/** Immutable artifacts retain at most the current and immediately previous bus protocol. */
export const MAX_BATCH_PROTOCOLS_PER_ARTIFACT = 2;

export const normalizeProtocolVersions = (versions: readonly number[]): number[] => {
  const normalized = [...new Set(versions)].sort((a, b) => a - b);
  if (normalized.length === 0 || normalized.length > MAX_BATCH_PROTOCOLS_PER_ARTIFACT) {
    throw new Error(
      `layer3: artifacts must retain between 1 and ${MAX_BATCH_PROTOCOLS_PER_ARTIFACT} protocol versions`,
    );
  }
  if (normalized.some((version) => !Number.isInteger(version) || version < 1 || version > 255)) {
    throw new Error('layer3: protocol versions must be integer bytes in [1, 255]');
  }
  return normalized;
};

/** Select the highest mutually supported immutable protocol version. */
export const negotiateProtocolVersion = (
  participants: readonly (readonly number[])[],
): number => {
  if (participants.length === 0) throw new Error('layer3: protocol negotiation requires participants');
  const supported = participants.map(normalizeProtocolVersions);
  const common = supported[0].filter((version) =>
    supported.slice(1).every((versions) => versions.includes(version)));
  if (common.length === 0) throw new Error('layer3: participant protocol versions have no intersection');
  return common[common.length - 1];
};

export const protocolVersionHex = (version: number): string =>
  normalizeProtocolVersions([version])[0].toString(16).padStart(2, '0');
