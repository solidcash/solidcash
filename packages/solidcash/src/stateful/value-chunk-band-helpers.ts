/**
 * phase-boundary extract: Value-chunk band placement / hole fill / OTC equal-verify helpers.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import { binToHex } from '@bitauth/libauth';
import { buildValueChunkCommitment } from '@solidcash/utils';
import { isEmptyValueChunkCommitment } from './value-chunk-persist.js';
import { relocateChangeAfterOccupancy } from './persist-predecessor-layout.js';

/**
 * Write value-chunk NFTs onto `[band.start, band.start+n)`. Skips reserved
 * slots (view tails, minting) so 16/17 stay put.
 */
export function placeValueChunksOnBand(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { amount?: bigint; category?: string; nft?: { capability?: string; commitment?: string } };
  }>,
  band: { start: number; nNew: number },
  chunks: ReadonlyArray<{ commitment: string; lockingBytecode: Uint8Array; categoryId?: string }>,
  reserved: ReadonlySet<number> = new Set(),
  occupancyEnd = -1,
  suffixStart?: number,
): number {
  let written = 0;
  for (const [offset, chunk] of chunks.entries()) {
    if (offset >= band.nNew) break;
    const index = band.start + offset;
    if (reserved.has(index)) continue;
    const next = {
      to: chunk.lockingBytecode,
      amount: 1200n,
      token: {
        amount: 0n,
        category: chunk.categoryId ?? '',
        nft: { capability: 'mutable' as const, commitment: chunk.commitment },
      },
    };
    while (outputs.length < index) {
      outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
    }
    const existing = outputs[index];
    if (existing && !existing.token && (existing.amount ?? 0n) > 50_000n) {
      const leftover = (existing.amount ?? 0n) - 1200n;
      relocateChangeAfterOccupancy(
        outputs, { ...existing, amount: leftover }, band.start + band.nNew, occupancyEnd, suffixStart,
      );
    }
    if (outputs.length === index) outputs.push(next);
    else outputs[index] = next;
    written += 1;
  }
  return written;
}

export function isP2sh32LockScript(lock: Uint8Array | string | undefined): lock is Uint8Array {
  if (!(lock instanceof Uint8Array) || lock.length !== 35) return false;
  return lock[0] === 0xaa && lock[1] === 0x20 && lock[34] === 0x87;
}

/** Select the reconstructed P2SH32 operand opposite an introspected current output locking bytecode. */
export function selectExpectedP2sh32OutputLock(
  current: Uint8Array,
  left: Uint8Array | undefined,
  right: Uint8Array | undefined,
): Uint8Array | undefined {
  if (!left || !right) return undefined;
  const currentHex = binToHex(current);
  if (binToHex(left) === currentHex && isP2sh32LockScript(right)) return right;
  if (binToHex(right) === currentHex && isP2sh32LockScript(left)) return left;
  return undefined;
}

export type ValueChunkTraceObservation =
  | { kind: 'lockingBytecode'; outputIndex: number; lockingBytecode: Uint8Array }
  | { kind: 'commitment'; outputIndex: number; commitment: string };

/**
 * Select commitment checks owned by one compiler-described value-chunk run.
 * Lock and commitment checks are paired by occurrence for each output, so a
 * different covenant inspecting the same coordinate cannot donate its payload.
 */
export function selectValueChunkCommitmentObservations(
  observations: readonly ValueChunkTraceObservation[],
  authority: { outputBase: number; outputCount: number; lockingBytecode: Uint8Array } | null,
): Map<number, string> {
  const selected = new Map<number, string>();
  if (!authority || authority.outputBase < 0 || authority.outputCount <= 0
    || !isP2sh32LockScript(authority.lockingBytecode)) return selected;
  const expectedLock = binToHex(authority.lockingBytecode);
  const pendingLocks = new Map<number, Uint8Array[]>();
  for (const observation of observations) {
    if (observation.outputIndex < authority.outputBase
      || observation.outputIndex >= authority.outputBase + authority.outputCount) continue;
    if (observation.kind === 'lockingBytecode') {
      const pending = pendingLocks.get(observation.outputIndex) ?? [];
      pending.push(observation.lockingBytecode);
      pendingLocks.set(observation.outputIndex, pending);
      continue;
    }
    const pending = pendingLocks.get(observation.outputIndex);
    const pairedLock = pending?.shift();
    if (!pairedLock || binToHex(pairedLock) !== expectedLock) continue;
    selected.set(observation.outputIndex, observation.commitment);
  }
  return selected;
}

/**
 * Occupancy: every slot in `[band.start, band.start+nNew)` must be a value-chunk
 * continuation NFT. A shorter derived run must not leave a token-free hole;
 * derivation overwrites the placeholder with the authenticated commitment.
 */
export function fillValueChunkBandHoles(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: { amount?: bigint; category?: string; nft?: { capability?: string; commitment?: string } };
  }>,
  band: { start: number; nNew: number },
  sibling: { lockingBytecode: Uint8Array; categoryId?: string },
  reserved: ReadonlySet<number> = new Set(),
  suffixStart?: number,
  occupancyEnd = -1,
): number {
  if (!isP2sh32LockScript(sibling.lockingBytecode) || band.nNew <= 0) return 0;
  let filled = 0;
  const width = Math.min(band.nNew, 32);
  for (let offset = 0; offset < width; offset++) {
    const index = band.start + offset;
    if (suffixStart !== undefined && index >= suffixStart) break;
    if (reserved.has(index)) continue;
    const existing = outputs[index];
    const existingLock = existing?.to instanceof Uint8Array ? existing.to : undefined;
    if (existing?.token?.nft?.capability === 'minting') continue;
    if (existing?.token?.nft?.capability === 'mutable' && isP2sh32LockScript(existingLock)
      && !isEmptyValueChunkCommitment(String(existing.token.nft.commitment ?? ''))) continue;
    if (existing && !isOverwritableValueChunkOccupant(existing) && existing.token) continue;
    // A large token-free P2PKH in the band is change, not a pad. Relocate it
    // after the suffix so filling slot 25 does not dump leftover sats to fee.
    let placeholderAmount = existing?.amount && existing.amount > 0n ? existing.amount : 1000n;
    if (existing && !existing.token && (existing.amount ?? 0n) > 50_000n) {
      placeholderAmount = 1000n;
      const relocated = { ...existing, amount: (existing.amount ?? 0n) - placeholderAmount };
      relocateChangeAfterOccupancy(
        outputs, relocated, Math.min(outputs.length, band.start + width), occupancyEnd, suffixStart,
      );
    }
    const next = {
      to: sibling.lockingBytecode,
      amount: placeholderAmount,
      token: {
        amount: 0n,
        category: sibling.categoryId ?? existing?.token?.category ?? '',
        nft: {
          capability: 'mutable' as const,
          commitment: buildValueChunkCommitment(offset, Uint8Array.of(0)),
        },
      },
    };
    while (outputs.length < index) {
      outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
    }
    if (outputs.length === index) outputs.push(next);
    else outputs[index] = next;
    filled += 1;
  }
  return filled;
}

/** View tails / token-free pads that derived value chunks must replace. */
export function isOverwritableValueChunkOccupant(output: {
  to?: Uint8Array | string;
  token?: { nft?: { capability?: string; commitment?: Uint8Array | string } };
} | undefined): boolean {
  if (!output) return true;
  if (isViewReturnTailOutput(output)) return true;
  if (isDisposableAlignmentPad(output)) return true;
  if (!output.token) return true;
  return false;
}

/** Same K-rotate as `_swapMintingOffValueChunkBand` (at least 4, at least band overlap). */
export function mintingSwapShift(start: number, chunkBase: number, nNew: number): number {
  return Math.max(4, Math.max(1, chunkBase + nNew - start));
}

/** Slot-index prefix plus an all-zero payload — surplus empty value-chunk. */
export function expectedFromOtcEqualVerify(
  below: Uint8Array,
  top: Uint8Array,
  observedActual?: string,
): Uint8Array {
  const belowHex = binToHex(below);
  const topHex = binToHex(top);
  if (observedActual !== undefined && belowHex === observedActual && topHex !== observedActual) {
    return top;
  }
  return below;
}

/** Real covenant expected bytes win over an empty split/fill placeholder. */
export function preferChunkCommitment(existing: string | undefined, incoming: string): string {
  const incomingEmpty = !incoming || incoming === '00' || isEmptyValueChunkCommitment(incoming);
  const existingEmpty = !existing || existing === '00' || isEmptyValueChunkCommitment(existing);
  if (incomingEmpty && !existingEmpty) return existing!;
  if (existingEmpty && !incomingEmpty) return incoming;
  return incoming;
}

/**
 * OP_TRUE + none-cap is a view/loop return witness. Nested events and identity
 * tags must displace it, not overwrite: same-category is not enough to treat it
 * as an empty event hole.
 */
export function isViewReturnTailOutput(output: {
  to?: Uint8Array | string;
  token?: { nft?: { capability?: string; commitment?: Uint8Array | string } };
} | undefined): boolean {
  if (!output?.token || output.token.nft?.capability !== 'none') return false;
  const lock = output.to instanceof Uint8Array
    ? output.to
    : typeof output.to === 'string' ? undefined : output.to;
  return !!lock && lock.length === 1 && lock[0] === 0x51;
}

export function isDisposableAlignmentPad(output: {
  to?: Uint8Array | string;
  token?: unknown;
} | undefined): boolean {
  if (!output || output.token) return false;
  const lock = output.to instanceof Uint8Array ? output.to : undefined;
  if (!lock) return false;
  if (lock.length === 1 && lock[0] === 0x51) return true;
  return lock.length === 25
    && lock[0] === 0x76 && lock[1] === 0xa9 && lock[2] === 0x14
    && lock[23] === 0x88 && lock[24] === 0xac;
}
