/**
 * phase-boundary extract: SCID identity reassert, minting-master placement, materialized return matching.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { addressToLockScript } from '../utils.js';
import { isScidIdentityCommitment } from './logical-identity.js';
import { returnEventNftCommitment } from './return-event-nft-commitment.js';
import { commitmentHexOf } from './stb-output-utils.js';
import {
  isDisposableAlignmentPad,
  isViewReturnTailOutput,
} from './value-chunk-band-helpers.js';

/**
 * The covenant counts outputs at the value-chunk redeem lock and EQUALVERIFYs
 * nNew. Extra same-lock occupants past the planned band fail that pin.
 */
export function stripSurplusValueChunkLocks(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { nft?: { capability?: string } };
  }>,
  band: { start: number; nNew: number },
  chunkLock: Uint8Array,
  consumed?: Array<{
    token?: { nft?: { capability?: string } };
    unlocker?: { generateLockingBytecode: () => Uint8Array };
  }>,
): number {
  if (chunkLock.length !== 35 || chunkLock[0] !== 0xaa || band.nNew <= 0) return 0;
  const wanted = binToHex(chunkLock);
  const end = band.start + band.nNew;
  let stripped = 0;
  for (let index = 0; index < outputs.length; index++) {
    if (index >= band.start && index < end) continue;
    const lock = outputs[index]?.to instanceof Uint8Array ? outputs[index]!.to as Uint8Array : undefined;
    if (!lock || lock.length !== 35 || binToHex(lock) !== wanted) continue;
    if (outputs[index]?.token?.nft?.capability === 'minting') continue;
    // A still-spent persist predecessor is a 1:1 conservation twin, not a surplus
    // write. Destroying it leaves a mutable hole (input 20 / output OP_TRUE).
    const spent = consumed?.[index];
    const spentLock = spent?.unlocker?.generateLockingBytecode();
    if (spent?.token?.nft?.capability === 'mutable'
      && (!spentLock || (spentLock.length === 35 && binToHex(spentLock) === wanted))) {
      continue;
    }
    outputs[index] = { to: Uint8Array.of(0x51), amount: outputs[index]?.amount && outputs[index]!.amount! > 0n
      ? outputs[index]!.amount : 1000n };
    stripped += 1;
  }
  return stripped;
}

/** Recreate every consumed SCID v1 identity NFT. Prefer a same-lock pad, then a
 * token-free disposable output (not a view tail). Never skip: dropping the NFT
 * makes the next non-zero msg.sender call unsatisfiable. Do not overwrite
 * minting/mutable occupants, reserved occupancy (impl trailing / jobEvents /
 * writer returns), or append past an OP_RETURN value-chunk suffix. */
export function reassertScidIdentityOutputs(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { category?: string; amount?: bigint; nft?: { capability?: string; commitment?: string } };
  }>,
  inputs: Array<{
    satoshis?: bigint;
    token?: { category?: string; amount?: bigint; nft?: { capability?: string; commitment?: string } };
    unlocker?: { generateLockingBytecode: () => Uint8Array };
  }>,
  reservedIndices: ReadonlySet<number> = new Set(),
): number {
  const lockHex = (to?: Uint8Array | string): string => {
    if (!to) return '';
    return typeof to === 'string' ? binToHex(addressToLockScript(to)) : binToHex(to);
  };
  const isViewTail = (output: (typeof outputs)[number] | undefined): boolean => {
    if (!output) return false;
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    return !!lock && lock.length === 1 && lock[0] === 0x51 && output.token?.nft?.capability === 'none';
  };
  const isReservedInputIndex = (index: number): boolean => reservedIndices.has(index)
    || inputs[index]?.token?.nft?.capability === 'mutable'
    || inputs[index]?.token?.nft?.capability === 'minting';
  const isReserved = (output: (typeof outputs)[number] | undefined, index?: number): boolean => {
    // A token-free output can still be the consumed side of a mutable resource.
    // Placing an identity here turns its authenticated DELETE into a tokenful
    // output, which the message-bus verifier correctly refuses.
    if (index !== undefined && isReservedInputIndex(index)) return true;
    if (!output) return false;
    if (isViewTail(output)) return true;
    // Identity restoration may only claim token-free pads. In particular, an
    // immutable SCID restored earlier in this same loop is already an owner;
    // treating only minting/mutable NFTs as reserved lets a later identity
    // silently overwrite it.
    return output.token !== undefined;
  };
  let repaired = 0;
  for (let index = 0; index < inputs.length; index++) {
    const input = inputs[index];
    const commitment = input.token?.nft?.commitment;
    if (input.token?.nft?.capability !== 'none' || !isScidIdentityCommitment(commitment)) continue;
    const category = input.token.category;
    const lock = input.unlocker?.generateLockingBytecode();
    if (!lock) continue;
    const wanted = binToHex(lock);
    // A matching replica in a compiler-owned suffix is not preserved: the later chunk/event materializer will
    // overwrite that coordinate. Relocate it now to an unreserved pad instead of treating mere presence as proof
    // of a durable 1:1 identity output.
    const already = outputs.some((output, outputIndex) => !isReservedInputIndex(outputIndex)
      && output?.token?.nft?.capability === 'none'
      && output.token.category === category
      && output.token.nft.commitment === commitment
      && lockHex(output.to) === wanted);
    if (already) continue;
    // A compiler-authenticated output-bytecode repair can reveal that an SCID was provisionally placed on a
    // coordinate owned by another covenant resource. Relocating that identity must also vacate the malformed
    // replica; otherwise token conservation sees two copies and a later conservation pass can reclaim the same
    // authenticated coordinate. Preserve the repaired locking bytecode and satoshi value while releasing only
    // the misplaced immutable token.
    for (let outputIndex = 0; outputIndex < outputs.length; outputIndex++) {
      const output = outputs[outputIndex];
      if (output?.token?.nft?.capability !== 'none'
        || output.token.category !== category
        || output.token.nft.commitment !== commitment) continue;
      outputs[outputIndex] = {
        to: output.to,
        amount: output.amount,
      };
    }
    let target = -1;
    for (let outputIndex = outputs.length - 1; outputIndex >= 0; outputIndex--) {
      const output = outputs[outputIndex];
      if (lockHex(output?.to) !== wanted) continue;
      if (isReservedInputIndex(outputIndex)) continue;
      const outputToken = output?.token;
      const replaceableIdentityPad = outputToken !== undefined
        && outputToken.category === category
        && outputToken.nft?.capability === 'none'
        && String(outputToken.nft.commitment ?? '').toLowerCase() === '53434944';
      if (isReserved(output, outputIndex) && !replaceableIdentityPad) continue;
      target = outputIndex;
      break;
    }
    if (target < 0) {
      for (let outputIndex = outputs.length - 1; outputIndex >= 0; outputIndex--) {
        if (isReserved(outputs[outputIndex], outputIndex)) continue;
        const lockBytes = outputs[outputIndex]?.to instanceof Uint8Array
          ? outputs[outputIndex]!.to as Uint8Array : undefined;
        if (lockBytes?.length === 1 && lockBytes[0] === 0x6a) continue;
        target = outputIndex;
        break;
      }
    }
    if (target < 0) {
      const suffix = outputs.findIndex((output) => {
        const lockBytes = output?.to instanceof Uint8Array ? output.to : undefined;
        return !!lockBytes && lockBytes.length === 1 && lockBytes[0] === 0x6a;
      });
      target = suffix >= 0 ? suffix : outputs.length;
      outputs.splice(target, 0, { to: lock, amount: 1000n });
    }
    const existing = outputs[target];
    if (existing && !existing.token && (existing.amount ?? 0n) > 50_000n) {
      // The replacement may be inside a compiler-owned block. A local insertion would shift every
      // later entry, event and continuation coordinate; keep funder change after those fixed outputs.
      // Keep only terminal OP_RETURN markers at the end; an interior marker is a fixed output too.
      let suffix = outputs.length;
      while (suffix > 0) {
        const output = outputs[suffix - 1];
        const bytes = output.to instanceof Uint8Array ? output.to : undefined;
        if (bytes?.length !== 1 || bytes[0] !== 0x6a) break;
        suffix -= 1;
      }
      outputs.splice(suffix, 0, {
        ...existing, amount: (existing.amount ?? 0n) - (input.satoshis ?? 1200n),
      });
    }
    outputs[target] = {
      to: lock,
      amount: input.satoshis ?? 1200n,
      token: {
        category,
        amount: 0n,
        nft: { capability: 'none', commitment },
      },
    };
    repaired += 1;
  }
  return repaired;
}

export function stripSurplusMintingOutputs(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { category?: string; nft?: { capability?: string } };
  }>,
  inputs: Array<{ token?: { category?: string; nft?: { capability?: string } } }>,
  mintingCategory: string,
  masterIndex: number,
): number {
  let stripped = 0;
  for (let index = 0; index < outputs.length; index++) {
    if (index === masterIndex) continue;
    const output = outputs[index];
    if (output?.token?.nft?.capability !== 'minting' || output.token.category !== mintingCategory) {
      continue;
    }
    const input = inputs[index];
    if (input?.token?.nft?.capability === 'minting' && input.token.category === mintingCategory) {
      continue;
    }
    outputs[index] = { to: Uint8Array.of(0x51), amount: 1000n };
    stripped += 1;
  }
  return stripped;
}

export function shouldInsertMintingMaster(
  existing: {
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { category?: string; amount?: bigint; nft?: { capability?: string } };
  } | undefined,
  mintingCategory: string,
): boolean {
  if (!existing) return true;
  if (existing.token?.nft?.capability === 'minting' && existing.token.category === mintingCategory) {
    return false;
  }
  if (existing.token?.category === mintingCategory) return true;
  const lock = existing.to instanceof Uint8Array ? existing.to : undefined;
  return !!lock && lock.length === 1 && lock[0] === 0x51;
}

export function placeMintingMasterPreservingTail<T extends {
  to?: Uint8Array | string;
  amount?: bigint;
  token?: { category?: string; amount?: bigint; nft?: { capability?: string } };
}>(
  outputs: T[],
  masterIndex: number,
  minting: T,
  options: { blockWidth: number; tailStart: number; suffixStart: number },
): boolean {
  const mintingToken = minting.token as { category?: string; nft?: { capability?: string } } | undefined;
  const existing = outputs[masterIndex];
  if (existing?.token?.nft?.capability === 'minting'
    && existing.token.category === (mintingToken?.category ?? '')) {
    outputs[masterIndex] = minting;
    return false;
  }
  if (!shouldInsertMintingMaster(existing, mintingToken?.category ?? '')) {
    return false;
  }
  outputs.splice(masterIndex, 0, minting);
  const dropFrom = masterIndex + Math.max(1, options.blockWidth);
  const dropTo = Math.min(options.tailStart + 1, options.suffixStart);
  for (let index = dropFrom; index < dropTo && index < outputs.length; index++) {
    if (!isDisposableAlignmentPad(outputs[index])) continue;
    outputs.splice(index, 1);
    return true;
  }
  return true;
}

export type MaterializedReturnExpectation = {
  groupIndex: number;
  categoryId: string;
  commitment: Uint8Array | string;
  /** The digest of the call a direct return record answers; none for a routed one. */
  digest?: Uint8Array;
  currentIndex?: number;
  builtIndex?: number;
};

/**
 * Bind logical return witnesses to matching outputs in the materialized transaction.
 * Existing valid bindings win; unresolved returns use distinct matching outputs in
 * physical order. This makes final output content authoritative without depending
 * on contract names or provisional input/output-count symmetry.
 */
export function matchMaterializedReturnOutputs(
  outputs: ReadonlyArray<{
    to?: Uint8Array | string;
    token?: {
      category?: string;
      nft?: { capability?: string; commitment?: Uint8Array | string };
    };
  }>,
  expectations: ReadonlyArray<MaterializedReturnExpectation>,
): Map<number, number> {
  const assigned = new Map<number, number>();
  const reserved = new Set<number>();
  const matches = (index: number, expected: MaterializedReturnExpectation): boolean => {
    const output = outputs[index];
    if (!isViewReturnTailOutput(output)) return false;
    if (output.token?.category?.toLowerCase() !== expected.categoryId.toLowerCase()) return false;
    const raw = typeof expected.commitment === 'string'
      ? hexToBin(commitmentHexOf(expected.commitment)) : expected.commitment;
    const wanted = raw.length === 0 ? '0101' : returnEventNftCommitment(raw, expected.digest);
    return commitmentHexOf(output.token.nft?.commitment).toLowerCase() === wanted;
  };

  for (const expected of expectations) {
    const preferred = [expected.currentIndex, expected.builtIndex]
      .filter((index): index is number => index !== undefined && index >= 0);
    const index = preferred.find((candidate) => !reserved.has(candidate) && matches(candidate, expected));
    if (index === undefined) continue;
    assigned.set(expected.groupIndex, index);
    reserved.add(index);
  }

  for (const expected of expectations) {
    if (assigned.has(expected.groupIndex)) continue;
    const index = outputs.findIndex((_, candidate) => (
      !reserved.has(candidate) && matches(candidate, expected)
    ));
    if (index < 0) continue;
    assigned.set(expected.groupIndex, index);
    reserved.add(index);
  }
  return assigned;
}

/** A same-index nested mutable may overwrite a stray event, pad, or stale P. */
export function shouldOverwriteForSameIndexTwin(existing: {
  to?: Uint8Array | string;
  token?: { category?: string; nft?: { capability?: string; commitment?: Uint8Array | string } };
} | undefined, twinLock: Uint8Array, twinCategory: string, twinCommitment?: string): boolean {
  if (!existing) return true;
  const lock = existing.to instanceof Uint8Array ? existing.to : undefined;
  if (existing.token?.nft?.capability === 'mutable'
    && existing.token.category === twinCategory
    && lock
    && lock.length === twinLock.length
    && lock.every((byte, offset) => byte === twinLock[offset])) {
    if (twinCommitment === undefined) return false;
    return commitmentHexOf(existing.token.nft.commitment as Uint8Array | string | undefined)
      !== twinCommitment;
  }
  if (isDisposableAlignmentPad(existing)) return true;
  return existing.token?.nft?.capability === 'none';
}
