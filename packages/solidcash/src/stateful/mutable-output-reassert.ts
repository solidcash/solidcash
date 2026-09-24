/**
 * phase-boundary extract: Mutable/output reassert + OP_RETURN / view-tail relocation helpers.
 * (phase-boundary extract from StatefulTransactionBuilder.ts).
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import { isScidIdentityCommitment } from './logical-identity.js';
import {
  cloneToken,
  commitmentHexOf,
  outputMatchesLock,
} from './stb-output-utils.js';
import {
  isDisposableAlignmentPad,
  isViewReturnTailOutput,
} from './value-chunk-band-helpers.js';
import {
  assignedTailEnd,
  findViewTailDestinations,
} from './physical-return-layout.js';

/**
 * Synthetic OP_TRUE outputs (view/loop tails, empty placeholders) are never a
 * collection entry covenant. After the tail band they are valid PredOut
 * destinations even when the commitment is EVM-true `51` rather than empty.
 */
export function isPredOutReusableHole(output: {
  to?: Uint8Array | string;
  token?: { nft?: { capability?: string; commitment?: Uint8Array | string } };
} | undefined): boolean {
  if (!output) return false;
  const lock = output.to instanceof Uint8Array ? output.to : undefined;
  if (!lock || lock.length !== 1 || lock[0] !== 0x51) return false;
  return (output.token?.nft?.capability ?? 'none') === 'none';
}

/**
 * Restore sorted-batch predecessor outputs to the coordinates declared by the
 * participant's compiler plan. Return-tail packing can leave an older clone at
 * a later coordinate; move that exact clone rather than minting a duplicate.
 * An unrelated token owner is never overwritten without an authenticated clone
 * proving which output belongs at the declared coordinate.
 */
export function reassertBatchPredecessorOutputsAtDeclaredSlots(
  outputs: Output[],
  masterIndex: number,
  categoryId: string,
  predecessors: ReadonlyArray<{
    outputBlockSlot: number;
    lockingBytecode: Uint8Array;
    commitment: string;
  }>,
  replaceDeclaredOwner = false,
): number {
  if (masterIndex < 0) return 0;
  let changed = 0;
  const samePredecessor = (output: Output | undefined, predecessor: (typeof predecessors)[number]): boolean => {
    if (!output || output.token?.category !== categoryId
      || output.token.nft?.capability !== 'mutable'
      || commitmentHexOf(output.token.nft.commitment) !== predecessor.commitment.toLowerCase()) return false;
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    return lock !== undefined && lock.length === predecessor.lockingBytecode.length
      && lock.every((byte, offset) => byte === predecessor.lockingBytecode[offset]);
  };
  const sameDeclaredOwner = (
    output: Output | undefined, predecessor: (typeof predecessors)[number],
  ): boolean => {
    if (!output || output.token?.category !== categoryId
      || output.token.nft?.capability !== 'mutable'
      || (!replaceDeclaredOwner
        && !/^(?:00)+$/.test(commitmentHexOf(output.token.nft.commitment)))) return false;
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    return lock !== undefined && lock.length === predecessor.lockingBytecode.length
      && lock.every((byte, offset) => byte === predecessor.lockingBytecode[offset]);
  };

  const sameCategoryForeignCollection = (
    output: Output | undefined, predecessor: (typeof predecessors)[number],
  ): boolean => {
    if (!output || output.token?.category !== categoryId
      || output.token.nft?.capability !== 'mutable') return false;
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    if (!lock || lock.length !== predecessor.lockingBytecode.length) return true;
    return lock.some((byte, offset) => byte !== predecessor.lockingBytecode[offset]);
  };

  for (const predecessor of predecessors) {
    if (!Number.isInteger(predecessor.outputBlockSlot) || predecessor.outputBlockSlot < 0) continue;
    const destination = masterIndex + predecessor.outputBlockSlot;
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_TOKEN_INSERT === '1' && destination < masterIndex + 2) {
      console.error('predout-destination-before-new-slot', {
        masterIndex, slot: predecessor.outputBlockSlot, destination, categoryId: categoryId.slice(0, 16),
      });
    }
    while (destination >= outputs.length) {
      outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
    }
    if (samePredecessor(outputs[destination], predecessor)) continue;
    const source = outputs.findIndex((output, index) => (
      index !== destination && samePredecessor(output, predecessor)
    ));
    const occupant = outputs[destination];
    // FakeToken.transferFrom: balances P' and allowances share a category. A later
    // same-category collection can occupy the planned PredOut slot with the wrong entry
    // lock; displace that foreign-collection occupant rather than skipping the repair.
    const foreignCollectionOccupant = sameCategoryForeignCollection(occupant, predecessor);
    if (source < 0 && occupant?.token && !isPredOutReusableHole(occupant)
      && !sameDeclaredOwner(occupant, predecessor)
      && !foreignCollectionOccupant) continue;

    const replacement = source >= 0 ? outputs[source] : {
      to: predecessor.lockingBytecode,
      amount: occupant?.amount && occupant.amount > 0n ? occupant.amount : 1000n,
      token: {
        amount: 0n,
        category: categoryId,
        nft: { capability: 'mutable' as const, commitment: predecessor.commitment },
      },
    };
    let displaceTo = -1;
    if (source < 0 && foreignCollectionOccupant) {
      // Never park a displaced same-category entry before the minting master (post two:
      // FakeToken approve PredOut displaced balances UPDATE onto pad @12).
      displaceTo = outputs.findIndex((output, index) => (
        index !== destination && index > masterIndex && (
          isPredOutReusableHole(output)
          || (output.to instanceof Uint8Array && output.to.length === 1 && output.to[0] === 0x51
            && !output.token)
        )
      ));
      if (displaceTo < 0) {
        displaceTo = outputs.length;
        outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
      }
      outputs[displaceTo] = occupant!;
    }
    outputs[destination] = replacement;
    if (source >= 0) {
      outputs[source] = {
        to: Uint8Array.of(0x51),
        amount: replacement.amount && replacement.amount > 0n ? replacement.amount : 1000n,
      };
    }
    changed += 1;
  }
  return changed;
}

/** True when `to` is a bare OP_RETURN (jobs-suffix separator). */
export function isOpReturnLockingBytecode(to?: Uint8Array | string): boolean {
  if (to instanceof Uint8Array) return to.length === 1 && to[0] === 0x6a;
  if (typeof to === 'string') {
    const hex = to.startsWith('0x') ? to.slice(2) : to;
    return hex.toLowerCase() === '6a';
  }
  return false;
}

/**
 * Packer ranks can land a view return on the jobs OP_RETURN separator slot
 * (current 0x6a, or the reserved suffixStart index before materialize writes
 * 0x6a). Prefer an already-unlocked view/disposable pad (planned, then current,
 * then the pad immediately before the separator). Never host after OP_RETURN:
 * reverse-indexed jobs chunks require the separator to be the unique trailer
 * (`TXOUTPUTCOUNT - 1 - nNew`). Returns undefined when no safe host exists —
 * caller may insert one before the jobs suffix.
 */
export function redirectViewTailOffOpReturn(parts: {
  placedIndex: number;
  plannedIndex?: number;
  returnIndex?: number;
  suffixStart?: number;
  outputs: ReadonlyArray<{
    to?: Uint8Array | string;
    token?: { nft?: { capability?: string; commitment?: Uint8Array | string } };
  }>;
}): number | undefined {
  const { placedIndex, outputs } = parts;
  if (placedIndex < 0 || placedIndex >= outputs.length) return placedIndex;
  const isSeparatorSlot = isOpReturnLockingBytecode(outputs[placedIndex]?.to)
    || (parts.suffixStart !== undefined && placedIndex === parts.suffixStart);
  if (!isSeparatorSlot) return placedIndex;
  const usable = (index: number | undefined): index is number => {
    if (index === undefined || index < 0 || index >= outputs.length) return false;
    if (isOpReturnLockingBytecode(outputs[index]?.to)) return false;
    if (parts.suffixStart !== undefined && index === parts.suffixStart) return false;
    // Anything at/after the live OP_RETURN is past the reverse-index trailer.
    const liveOpReturn = outputs.findIndex((output) => isOpReturnLockingBytecode(output?.to));
    if (liveOpReturn >= 0 && index >= liveOpReturn) return false;
    return isViewReturnTailOutput(outputs[index])
      || isDisposableAlignmentPad(outputs[index]);
  };
  for (const candidate of [parts.plannedIndex, parts.returnIndex, placedIndex - 1]) {
    if (usable(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Move every output after the jobs OP_RETURN in front of the jobs chunk run so
 * the separator is the unique trailer for `TXOUTPUTCOUNT - 1 - nNew`.
 *
 * Only contiguous outputs that match `jobsLock` immediately before the separator
 * count as the jobs run. A planned count without matching locks would splice
 * pads into the contract block (e.g. output 6) and strip their tokens.
 */
export function movePostOpReturnBeforeJobsSuffix<T extends {
  to?: Uint8Array | string;
  token?: { nft?: { capability?: string } };
}>(outputs: T[], jobsLock?: Uint8Array): number {
  const opReturn = outputs.findIndex((output) => isOpReturnLockingBytecode(output?.to));
  if (opReturn < 0 || opReturn === outputs.length - 1) return 0;
  const wanted = jobsLock && jobsLock.length === 35 && jobsLock[0] === 0xaa
    ? binToHex(jobsLock) : undefined;
  let jobsBefore = 0;
  if (wanted) {
    for (let index = opReturn - 1; index >= 0; index -= 1) {
      const lock = outputs[index]?.to instanceof Uint8Array
        ? outputs[index]!.to as Uint8Array : undefined;
      if (!lock || lock.length !== 35 || binToHex(lock) !== wanted
        || outputs[index]?.token?.nft?.capability !== 'mutable') break;
      jobsBefore += 1;
    }
  }
  const trailing = outputs.splice(opReturn + 1);
  if (trailing.length === 0) return 0;
  // No matched jobs yet: park pads immediately before OP_RETURN (not deep in the block).
  const insertAt = Math.max(0, opReturn - jobsBefore);
  outputs.splice(insertAt, 0, ...trailing);
  return trailing.length;
}

/**
 * Final-layout repair: build() may append a reverse-indexed resource run, then late
 * derived outputs, then OP_RETURN — so TXOUTPUTCOUNT-1-nNew lands on the late outputs.
 * Lift the early resource run to sit immediately before the trailer.
 * Probe builds must not call this (late-before-jobs during derivation hung).
 */
export function moveLateOutputsBeforeReverseSuffix<T extends {
  to?: Uint8Array | string;
  token?: { nft?: { capability?: string }; category?: string };
}>(
  outputs: T[],
  suffixLock: Uint8Array,
  suffixCount: number,
): number {
  if (suffixCount <= 0 || suffixLock.length !== 35 || suffixLock[0] !== 0xaa) return 0;
  if (outputs.length < suffixCount + 2) return 0;
  const trailer = outputs.length - 1;
  // Reverse-index math needs a dedicated trailer; OP_RETURN is the marketplace separator.
  if (!isOpReturnLockingBytecode(outputs[trailer]?.to)) return 0;
  const wanted = binToHex(suffixLock);
  const windowStart = trailer - suffixCount;
  if (windowStart < 0) return 0;
  const isSuffixResource = (output: T | undefined): boolean => {
    const lock = output?.to instanceof Uint8Array ? output.to : undefined;
    return !!lock && lock.length === 35 && binToHex(lock) === wanted
      && output?.token?.nft?.capability === 'mutable';
  };
  // Already correct: reverse window is contiguous jobs.
  if (Array.from({ length: suffixCount }, (_, offset) => isSuffixResource(outputs[windowStart + offset]))
    .every(Boolean)) {
    return 0;
  }
  // Find the resource run that starts before the required reverse window. The run
  // may already overlap the window by one or more slots; only a late foreign output
  // prevents it from being the canonical contiguous suffix.
  let earlyRunStart = -1;
  for (let index = 0; index < windowStart; index += 1) {
    if (!isSuffixResource(outputs[index])) continue;
    let run = 0;
    while (index + run < trailer && isSuffixResource(outputs[index + run])) run += 1;
    if (run >= suffixCount) {
      earlyRunStart = index;
      break;
    }
    index += Math.max(0, run - 1);
  }
  if (earlyRunStart < 0) return 0;
  const earlyRun = outputs.splice(earlyRunStart, suffixCount);
  // Trailer shifted left; insert the resource run immediately before it.
  outputs.splice(outputs.length - 1, 0, ...earlyRun);
  return suffixCount;
}

/** Whether a mutable NFT output is duplicated exactly at another index. */
export function hasEquivalentMutableNftOutput(
  outputs: ReadonlyArray<{
    to?: Uint8Array | string;
    token?: {
      category?: string;
      nft?: { capability?: string; commitment?: Uint8Array | string };
    };
  }>,
  candidateIndex: number,
): boolean {
  const candidate = outputs[candidateIndex];
  const candidateLock = candidate?.to instanceof Uint8Array ? candidate.to : undefined;
  if (!candidateLock || candidate?.token?.nft?.capability !== 'mutable') return false;
  const candidateCommitment = commitmentHexOf(candidate.token.nft.commitment);
  return outputs.some((output, index) => {
    if (index === candidateIndex || output.token?.nft?.capability !== 'mutable') return false;
    if (output.token.category !== candidate.token?.category) return false;
    if (commitmentHexOf(output.token.nft.commitment) !== candidateCommitment) return false;
    const lock = output.to instanceof Uint8Array ? output.to : undefined;
    return lock !== undefined && lock.length === candidateLock.length
      && lock.every((byte, offset) => byte === candidateLock[offset]);
  });
}

/**
 * Remove exact mutable copies that were displaced after their canonical
 * same-index output while that output was still being derived.
 */
export function stripRelocatedMutableDuplicates(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: {
      category?: string;
      nft?: { capability?: string; commitment?: Uint8Array | string };
    };
  }>,
  inputs: ReadonlyArray<{
    token?: { category?: string; nft?: { capability?: string } };
    unlocker?: { generateLockingBytecode: () => Uint8Array };
  }>,
  scanStart: number,
  protectedIndices: ReadonlySet<number> = new Set(),
): number {
  if (scanStart < 0) return 0;
  const canonicalByIdentity = new Map<string, Set<number>>();
  for (const [canonicalIndex, input] of inputs.entries()) {
    const output = outputs[canonicalIndex];
    const inputLock = input.unlocker?.generateLockingBytecode();
    const outputLock = output?.to instanceof Uint8Array ? output.to : undefined;
    if (!inputLock || !outputLock || input.token?.nft?.capability !== 'mutable'
      || output.token?.nft?.capability !== 'mutable'
      || input.token.category !== output.token.category
      || inputLock.length !== outputLock.length
      || !inputLock.every((byte, offset) => byte === outputLock[offset])) continue;
    const identity = `${output.token.category ?? ''}:${binToHex(outputLock)}:`
      + commitmentHexOf(output.token.nft.commitment);
    const canonicalIndices = canonicalByIdentity.get(identity) ?? new Set<number>();
    canonicalIndices.add(canonicalIndex);
    canonicalByIdentity.set(identity, canonicalIndices);
  }
  let stripped = 0;
  for (let index = scanStart; index < outputs.length; index++) {
    // A cold sorted-map insert has two compiler-owned outputs: the new node at
    // the fixed entry slot and the rewritten predecessor at a trailing slot.
    // During fixed-point discovery their provisional commitments can briefly
    // be identical. Both coordinates must survive so the next VM pass can
    // authenticate their distinct final commitments.
    if (protectedIndices.has(index)) continue;
    const candidate = outputs[index];
    const candidateLock = candidate?.to instanceof Uint8Array ? candidate.to : undefined;
    if (!candidateLock || candidate.token?.nft?.capability !== 'mutable') continue;
    const identity = `${candidate.token.category ?? ''}:${binToHex(candidateLock)}:`
      + commitmentHexOf(candidate.token.nft.commitment);
    const canonicalIndices = canonicalByIdentity.get(identity);
    if (canonicalIndices === undefined || canonicalIndices.has(index)) continue;
    outputs[index] = {
      to: Uint8Array.of(0x51),
      amount: candidate.amount && candidate.amount > 0n ? candidate.amount : 1000n,
    };
    stripped += 1;
  }
  return stripped;
}

/**
 * Restore explicitly read-only mutable inputs to the output coordinate authenticated by their covenant.
 *
 * Collection iteration can relocate these twins while composing later participant bands. Prefer swapping an
 * exact relocated twin back into place, preserving the displaced output and transaction width. If no twin
 * survives, synthesize one only over a disposable alignment pad; a conflicting owned output remains visible to
 * preflight rather than being silently discarded.
 */
/**
 * Insert-band dust pads (`asTokenPad` in `_buildInputs`): none-cap + 32 zero bytes.
 * Prefer the contract category so UTXOTOKENCATEGORY at INPUTINDEX+3 EQUALVERIFYs;
 * keep recognizing the legacy foreign `01…` category for older probes.
 */
export function isInsertBandDustToken(
  token: {
    category?: string;
    nft?: { capability?: string; commitment?: Uint8Array | string };
  } | undefined,
  categoryId?: string,
): boolean {
  if (token?.nft?.capability !== 'none') return false;
  const commitment = commitmentHexOf(token.nft.commitment);
  if (!(commitment.length === 64 && /^0+$/.test(commitment))) return false;
  if (token.category === `01${'0'.repeat(62)}`) return true;
  return categoryId !== undefined && token.category === categoryId;
}

/**
 * Insert-band funder pads carry none-cap dust so INPUTINDEX+3/+5 stay tokenful and
 * OP_SPLIT 32 cannot see an empty OUTPUTTOKENCATEGORY. Gap fillers and return
 * placeholders may leave a bare OP_TRUE there; restore only that dust twin.
 */
export function reassertNoneCapFunderTwins(
  outputs: Output[],
  inputs: ReadonlyArray<UnlockableUtxo>,
): number {
  let restored = 0;
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    if (!input?.unlocker || !isInsertBandDustToken(input.token, input.token?.category)) continue;
    while (outputs.length <= index) {
      outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
    }
    const output = outputs[index];
    if (isInsertBandDustToken(output?.token, input.token?.category)) continue;
    if (output?.token?.nft?.capability === 'mutable'
      || output?.token?.nft?.capability === 'minting') continue;
    // A real authenticated none-cap return (non-dust) already owns the slot.
    if (output?.token?.nft?.capability === 'none' && !isInsertBandDustToken(output.token)) continue;
    if (output?.token && !isDisposableAlignmentPad(output)) continue;
    outputs[index] = {
      to: Uint8Array.of(0x51),
      amount: BigInt(Math.max(1000, Number(input.satoshis))),
      token: cloneToken(input.token),
    };
    restored += 1;
  }
  return restored;
}

export function reassertReadOnlyMutableOneToOnes(
  outputs: Output[],
  inputs: ReadonlyArray<Pick<UnlockableUtxo, 'txid' | 'vout'>>,
  readOnlyInputs: ReadonlyArray<UnlockableUtxo>,
): number {
  const inputIndices = new Map(inputs.map((input, index) => (
    [`${input.txid.toLowerCase()}:${input.vout}`, index]
  )));
  const matches = (output: Output | undefined, input: UnlockableUtxo, lock: Uint8Array): boolean => {
    if (!output || output.amount !== input.satoshis || output.token?.category !== input.token?.category
      || output.token?.amount !== input.token?.amount
      || output.token?.nft?.capability !== input.token?.nft?.capability
      || commitmentHexOf(output.token?.nft?.commitment)
        !== commitmentHexOf(input.token?.nft?.commitment)) return false;
    return outputMatchesLock(output, lock);
  };
  let restored = 0;
  for (const input of readOnlyInputs) {
    if (!input.unlocker || input.token?.nft?.capability !== 'mutable') continue;
    const index = inputIndices.get(`${input.txid.toLowerCase()}:${input.vout}`);
    if (index === undefined) continue;
    while (outputs.length <= index) outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
    const lock = input.unlocker.generateLockingBytecode();
    if (matches(outputs[index], input, lock)) continue;
    const relocated = outputs.findIndex((output, candidate) => (
      candidate !== index && matches(output, input, lock)
    ));
    if (relocated >= 0) {
      const displaced = outputs[index];
      outputs[index] = outputs[relocated];
      outputs[relocated] = displaced ?? { to: Uint8Array.of(0x51), amount: 1000n };
      restored += 1;
      continue;
    }
    if (!isDisposableAlignmentPad(outputs[index])) continue;
    outputs[index] = {
      to: lock,
      amount: input.satoshis,
      token: cloneToken(input.token),
    };
    restored += 1;
  }
  return restored;
}

/**
 * Reassert the redeem-script identity of a compiler-declared mutable slot while
 * retaining the commitment computed for this transaction. Slot coordinates are
 * owned by the participant layout; a later materializer may update the value,
 * but it must not replace the entry covenant which authenticates that value.
 */
export function reassertDeclaredMutableSlotLock(
  output: {
    to?: Uint8Array | string;
    token?: { category?: string; nft?: { capability?: string; commitment?: Uint8Array | string } };
  } | undefined,
  input: {
    token?: { category?: string; nft?: { capability?: string } };
    unlocker?: { generateLockingBytecode: () => Uint8Array };
  } | undefined,
): boolean {
  if (!output || !input?.unlocker
    || input.token?.nft?.capability !== 'mutable'
    || output.token?.nft?.capability !== 'mutable'
    || output.token.category !== input.token.category) return false;
  const expected = input.unlocker.generateLockingBytecode();
  const current = output.to instanceof Uint8Array ? output.to : undefined;
  if (current?.length === expected.length
    && current.every((byte, offset) => byte === expected[offset])) return false;
  output.to = expected;
  return true;
}

/**
 * Burn mutable chunks from a replaced collection once its complete authoritative
 * run has been materialized elsewhere. Dynamic chunk identity is the category
 * plus collection covenant; commitments are values within that collection.
 */
export function clearMutableCollectionOutputsOutsideAuthoritativeRun(
  outputs: Array<{
    to?: Uint8Array | string;
    amount?: bigint;
    token?: {
      category?: string;
      nft?: { capability?: string; commitment?: Uint8Array | string };
    };
  }>,
  authoritativeOutputIndices: ReadonlySet<number>,
): number {
  const authoritativeCollections = new Set<string>();
  for (const index of authoritativeOutputIndices) {
    const output = outputs[index];
    const lock = output?.to instanceof Uint8Array ? output.to : undefined;
    if (!lock || output.token?.nft?.capability !== 'mutable') continue;
    authoritativeCollections.add(`${output.token.category ?? ''}:${binToHex(lock)}`);
  }
  let cleared = 0;
  for (let index = 0; index < outputs.length; index++) {
    if (authoritativeOutputIndices.has(index)) continue;
    const output = outputs[index];
    const lock = output?.to instanceof Uint8Array ? output.to : undefined;
    if (!lock || output?.token?.nft?.capability !== 'mutable') continue;
    const collection = `${output.token.category ?? ''}:${binToHex(lock)}`;
    if (!authoritativeCollections.has(collection)) continue;
    outputs[index] = {
      to: Uint8Array.of(0x51),
      amount: output.amount && output.amount > 0n ? output.amount : 1000n,
    };
    cleared += 1;
  }
  return cleared;
}
