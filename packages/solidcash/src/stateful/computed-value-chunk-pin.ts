import { VALUE_CHUNK_INDEX_SIZE, VALUE_CHUNK_SIZE } from '@solidcash/utils';

const encodedChunkIndex = (commitment: Uint8Array): number | undefined => {
  if (commitment.length < VALUE_CHUNK_INDEX_SIZE + 1
    || commitment.length > VALUE_CHUNK_INDEX_SIZE + VALUE_CHUNK_SIZE) return undefined;
  const index = commitment[0] + 256 * commitment[1];
  return index < 32 ? index : undefined;
};

/** Validate the `uint16-le index || non-empty chunk data` encoding. This is not an ownership proof: another
 * resource commitment can satisfy the same byte-level shape, so callers must also authenticate the compiler pin. */
export function isValidComputedValueChunkCommitmentEncoding(commitment: string): boolean {
  if (!/^[0-9a-f]+$/i.test(commitment) || commitment.length % 2 !== 0) return false;
  const bytes = Uint8Array.from(commitment.match(/../g)!.map((byte) => Number.parseInt(byte, 16)));
  return encodedChunkIndex(bytes) !== undefined;
}
