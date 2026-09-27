import { binToHex } from '@bitauth/libauth';
import { BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX } from '@solidcash/utils';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import { addressToLockScript } from '../utils.js';
import { canOwnTransportedContinuationSlot, type ComputedValueChunkSpanClaim } from './compose-recipes.js';

export interface TransportedContinuationOutput {
  offset: number;
  categoryId: string;
  commitment: string;
  lockingBytecode: Uint8Array;
}

/** Graph-authorized transport replaces provisional geometry only for the exact resources it materializes. */
export function transportedContinuationSpanClaims(
  provisional: readonly ComputedValueChunkSpanClaim[],
  transported: readonly ComputedValueChunkSpanClaim[],
): ComputedValueChunkSpanClaim[] {
  const resources = new Set(transported.map((claim) => claim.resourceIdentity));
  resources.delete(undefined);
  return [...provisional.filter((claim) => !resources.has(claim.resourceIdentity)), ...transported];
}

/** Materialize authenticated graph productions in their compiler-reserved local trailing slots. */
export function materializeTransportedContinuations(
  builder: { inputs: readonly UnlockableUtxo[]; outputs: Output[] },
  trailingOffsets: readonly number[],
  chunks: readonly TransportedContinuationOutput[],
): void {
  const reserved = new Set(trailingOffsets);
  for (const chunk of chunks) {
    if (!reserved.has(chunk.offset)
      || !canOwnTransportedContinuationSlot(builder.inputs[chunk.offset], chunk)) {
      throw new Error('messageBus: transported continuation output does not own a balanced trailing slot');
    }
  }
  for (const chunk of chunks) {
    builder.outputs[chunk.offset] = {
      to: chunk.lockingBytecode,
      amount: builder.inputs[chunk.offset]!.satoshis,
      token: {
        category: chunk.categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: chunk.commitment },
      },
    };
  }
  // An isolated builder may already have appended this exact root before the graph reserved its final band.
  // Publishing it again leaves two identity-scan matches per chunk. Move those provisional outputs back to
  // balanced padding, without compacting coordinates or touching another resource, predecessor, or owner.
  const destinations = new Set(chunks.map((chunk) => chunk.offset));
  const identity = (category: string, lock: Uint8Array, commitment: string): string =>
    JSON.stringify([category.toLowerCase(), binToHex(lock), commitment.toLowerCase()]);
  const published = new Set(chunks.map((chunk) => identity(
    chunk.categoryId, chunk.lockingBytecode, chunk.commitment,
  )));
  for (const offset of reserved) {
    if (destinations.has(offset)) continue;
    const input = builder.inputs[offset];
    const output = builder.outputs[offset];
    if (!input || input.token !== undefined
      || binToHex(input.unlocker.generateLockingBytecode()) !== BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX
      || output?.token?.amount !== 0n || output.token.nft?.capability !== 'mutable') continue;
    const lock = output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to);
    if (!published.has(identity(output.token.category, lock, output.token.nft.commitment))) continue;
    builder.outputs[offset] = { to: Uint8Array.of(0x51), amount: input.satoshis };
  }
}
