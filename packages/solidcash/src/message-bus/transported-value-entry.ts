import { binToHex, hexToBin } from '@bitauth/libauth';
import { encodeChunkableValueTail, VALUE_HEAD_SIZE } from '@solidcash/utils';
import { decodeEntryCommitment, encodeEntryCommitment } from '../stateful/SortedList.js';

export interface TransportedValueEntryRecipe {
  currentCommitmentHex: string;
  keySlotHex: string;
  value: Uint8Array;
}

/** Materialize the entry header paired with compiler-authenticated continuation chunks. */
export function materializeTransportedValueEntryCommitment(
  recipe: TransportedValueEntryRecipe,
): string | undefined {
  if (recipe.value.length <= VALUE_HEAD_SIZE
    || !/^(?:[0-9a-fA-F]{2}){32}$/.test(recipe.keySlotHex)
    || !/^(?:[0-9a-fA-F]{2}){64,128}$/.test(recipe.currentCommitmentHex)) return undefined;
  const current = decodeEntryCommitment(hexToBin(recipe.currentCommitmentHex));
  if (binToHex(current.slot) !== recipe.keySlotHex.toLowerCase()) return undefined;
  return binToHex(encodeEntryCommitment(
    current.slot,
    current.nextKey,
    encodeChunkableValueTail(recipe.value),
  ));
}
