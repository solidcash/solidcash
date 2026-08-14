/**
 * Whether a probe-observed NFT output may replace the builder's current commitment.
 * Event NFTs use capability `none` and can exceed the 40/128-byte relay default when the
 * mock provider advertises a higher `maximumNftCommitmentBytes`.
 */
export function isRepairableNftOutput(
  capability: string | undefined,
  commitmentBytes: number,
  maxCommitmentBytes: number,
): boolean {
  if (capability !== 'mutable' && capability !== 'none') return false;
  return commitmentBytes >= 3 && commitmentBytes <= maxCommitmentBytes;
}
