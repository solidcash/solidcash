/**
 * phase-boundary extract: STB class-body extract — in-block writer return reassert and return-witness binding.
 */

import type { AbiFunction } from '@solidcash/utils';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { resolveExternalResultEncoding } from './solidityAbi.js';
import { hasEquivalentMutableNftOutput } from './mutable-output-reassert.js';
import { returnEventNftCommitment } from './return-event-nft-commitment.js';
import { parseCallRecord } from './call-record.js';
import {
  relocateChangeAfterOccupancy,
  writerBlockOccupancyEnd,
} from './persist-predecessor-layout.js';
import {
  isDisposableAlignmentPad,
  isViewReturnTailOutput,
} from './value-chunk-band-helpers.js';
import {
  canonicalWriterReturnCommitment,
  groupOwnsInBlockReturnEvent,
  tokenWriterReturnIndex,
} from './value-chunk-geometry.js';

export type InBlockWriterPendingReturn = {
  categoryId: string;
  commitment: Uint8Array;
  identity: string;
  provisional?: boolean;
};

export interface InBlockWriterReturnHost {
  readonly allInputs: UnlockableUtxo[];
  readonly externalCallUtxoGroups: ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly pendingReturnEventOutputs: readonly InBlockWriterPendingReturn[];
  findMintingInputIndex(categoryId: string): number;
  getChunkableValueWriteBand(): { start: number; end: number; nNew: number } | undefined;
  tokenWriterOccupancy(
    tokenMaster: number,
    outputs?: ReadonlyArray<{ token?: { nft?: { commitment?: string } } }>,
  ): Set<number>;
  syncBuilderUnlockers(builder: TransactionBuilder): void;
  /** The digest of the call a direct return record answers; none for a routed one. */
  callRecordDigest?(identity: string): Uint8Array | undefined;
}

/**
 * The in-block FakeToken return is OP_TRUE + none-cap at master+returnSlot.
 * JobEvents change-relocation used to splice a leftover p2sh32 onto that
 * index (3-wide band → output 31). Restore the witnessed return without
 * shifting later view tails: swap with a disposable pad after occupancy.
 */
export function reassertInBlockWriterReturns(
  host: InBlockWriterReturnHost,
  builder: TransactionBuilder,
): void {
  const occupancyEnd = writerBlockOccupancyEnd(
    host.externalCallUtxoGroups,
    (categoryId) => host.findMintingInputIndex(categoryId),
  );
  for (const [groupIdx, group] of host.externalCallUtxoGroups.entries()) {
    if (!groupOwnsInBlockReturnEvent(host.externalCallUtxoGroups, groupIdx)) continue;
    const physical = host.externalCallUtxoGroups[group.sharedGroupIndex ?? groupIdx];
    const master = host.findMintingInputIndex(physical.categoryId);
    const returnSlot = physical.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
    if (master < 0 || returnSlot === undefined) continue;
    const band = host.getChunkableValueWriteBand();
    const outputIndex = tokenWriterReturnIndex(
      master, physical.blockLayout, band,
      host.tokenWriterOccupancy(master, builder.outputs),
    );
    bindWriterReturnWitness(host, groupIdx, outputIndex, builder);
    const occupant = builder.outputs[outputIndex];
    const identity = `external-call:${group.fusedReturnGroupIndex ?? groupIdx}`;
    const pending = host.pendingReturnEventOutputs.find((event) =>
      event.identity === identity || event.identity === `${identity}:0`);
    const writerAbi = selectWriterReturnAbi(group, physical);
    const writerReturnsBool = writerAbi?.outputs?.length === 1 && writerAbi.outputs[0].type === 'bool';
    const writerArtifact = physical.logicalArtifact ?? physical.externalContract?.inner?.artifact;
    const evmBool = writerReturnsBool && writerArtifact !== undefined
      && resolveExternalResultEncoding(
        writerAbi.resultEncoding,
        writerArtifact,
        writerAbi.outputs!.map((output) => output.type),
        `function '${writerAbi.name}' result`,
      ) === 'evm-abi-v1';
    const digest = host.callRecordDigest?.(identity);
    // The slot may already hold this call's record; its result is the bytes past the record's digest and form.
    const occupantHex = String(occupant?.token?.nft?.commitment ?? '');
    const occupantRecord = digest !== undefined && occupantHex !== '' ? parseCallRecord(hexToBin(occupantHex)) : undefined;
    const commitment = returnEventNftCommitment(hexToBin(canonicalWriterReturnCommitment({
      pendingHex: pending && pending.commitment.length > 0
        ? binToHex(pending.commitment)
        : occupantRecord?.raw !== undefined ? binToHex(occupantRecord.raw) : occupantHex,
      writesState: writerAbi?.writesState === true,
      evmBool,
      returnsBool: writerReturnsBool,
    })), digest);
    if (isViewReturnTailOutput({
      to: occupant?.to instanceof Uint8Array ? occupant.to : undefined,
      token: occupant?.token,
    }) && occupant?.token?.category === physical.categoryId
      && String(occupant.token?.nft?.commitment ?? '').toLowerCase() === commitment) {
      continue;
    }
    const returnOutput: Output = {
      to: Uint8Array.of(0x51),
      amount: 800n,
      token: {
        amount: 0n,
        category: physical.categoryId,
        nft: { capability: 'none', commitment },
      },
    };
    if (occupant && !isDisposableAlignmentPad({
      to: occupant.to instanceof Uint8Array ? occupant.to : undefined,
      token: occupant.token,
    }) && !isViewReturnTailOutput({
      to: occupant.to instanceof Uint8Array ? occupant.to : undefined,
      token: occupant.token,
    }) && !hasEquivalentMutableNftOutput(builder.outputs, outputIndex)) {
      let dest = Math.max(occupancyEnd, outputIndex + 1);
      while (dest < builder.outputs.length && builder.outputs[dest]?.token) dest += 1;
      if (dest < builder.outputs.length && isDisposableAlignmentPad({
        to: builder.outputs[dest]?.to instanceof Uint8Array
          ? builder.outputs[dest]!.to as Uint8Array : undefined,
        token: builder.outputs[dest]?.token,
      })) {
        builder.outputs[dest] = occupant;
      } else {
        relocateChangeAfterOccupancy(builder.outputs, occupant, dest, occupancyEnd);
      }
    }
    while (outputIndex >= builder.outputs.length) {
      builder.addOutput({ to: Uint8Array.of(0x51), amount: 800n });
    }
    builder.outputs[outputIndex] = returnOutput;
    group.returnOutputIndex = outputIndex;
  }
}

/**
 * Keep the unlocking witnesses and the materialized return output on one coordinate.
 * Input assembly can relocate a token block after the caller first encoded its
 * return index; refresh every exact carrier of that logical writer without moving
 * unrelated view returns which merely share the same physical token group.
 */
export function bindWriterReturnWitness(
  host: InBlockWriterReturnHost,
  writerGroupIndex: number,
  outputIndex: number,
  builder: TransactionBuilder,
): void {
  const writer = host.externalCallUtxoGroups[writerGroupIndex];
  if (!writer) return;
  const physicalIndex = writer.sharedGroupIndex ?? writerGroupIndex;
  const physical = host.externalCallUtxoGroups[physicalIndex];
  if (!physical) return;
  // The writer publishes at the participant's in-block slot. When the physical owner is a view whose own result
  // is a tail, that slot is not the owner's: its `returnOutputIndex` and the witnesses naming it keep its tail.
  const physicalOwnsInBlock = physicalIndex === writerGroupIndex
    || groupOwnsInBlockReturnEvent(host.externalCallUtxoGroups, physicalIndex);
  const changed = writer.returnOutputIndex !== outputIndex
    || (physicalOwnsInBlock && physical.returnOutputIndex !== outputIndex);
  if (!changed) return;

  writer.returnOutputIndex = outputIndex;
  if (physicalOwnsInBlock) physical.returnOutputIndex = outputIndex;
  physical.refreshInternalArgs?.(
    { __internal__returnOutputIdx: BigInt(outputIndex) },
    { shiftPredOut: false },
  );

  const witnessOwners = new Set(physicalOwnsInBlock ? [physicalIndex, writerGroupIndex] : [writerGroupIndex]);
  const carriers = [...host.externalCallUtxoGroups, ...host.lowLevelCallUtxoGroups];
  for (const carrier of carriers) {
    if (!carrier.returnWitnessGroups || !carrier.refreshInternalArgs) continue;
    const updates: Record<string, bigint> = {};
    for (const [name, owner] of Object.entries(carrier.returnWitnessGroups)) {
      if (!witnessOwners.has(owner)) continue;
      if (carrier.internalArgs?.[name] === BigInt(outputIndex)) continue;
      updates[name] = BigInt(outputIndex);
    }
    if (Object.keys(updates).length > 0) carrier.refreshInternalArgs(updates, { shiftPredOut: false });
  }

  // refreshInternalArgs replaces group-owned UTXO objects. Mirror those replacements into the already
  // flattened input list, then update this build's TransactionBuilder in place.
  for (const carrier of new Set([physical, ...carriers])) {
    const master = carrier.masterUtxo as UnlockableUtxo | undefined;
    if (!master?.unlocker) continue;
    const index = host.allInputs.findIndex((input) => input.txid.toLowerCase() === master.txid.toLowerCase()
      && input.vout === master.vout);
    if (index >= 0) host.allInputs[index] = master;
  }
  host.syncBuilderUnlockers(builder);
}

/**
 * ABI entry that describes the in-block return slot's value. That slot is published by the WRITER alias on the
 * shared participant (`approve`/`transferFrom`: `writesState`, `outputs: [bool]`), not by the participant's
 * physical owner (`balanceOf` is a `uint256` view that never writes). Resolving the owner's entry published the
 * empty bool `00` for a successful writer, so a SafeERC20-style caller observed a false approval and refused. The
 * owner's entry is the fallback only, for an alias that carries no ABI entry of its own.
 */
export function selectWriterReturnAbi<
  T extends {
    compilerRoute?: { abiFunction?: AbiFunction };
    externalContract?: { inner?: { artifact?: { abi?: readonly AbiFunction[] } } };
    functionName?: string;
    logicalFunctionName?: string;
  },
>(group: T, owner: T): AbiFunction | undefined {
  const abiOf = (candidate: T): readonly AbiFunction[] =>
    candidate.externalContract?.inner?.artifact?.abi ?? [];
  const named = (candidate: T): AbiFunction | undefined =>
    abiOf(candidate).find((fn) => fn.name === (candidate.functionName ?? candidate.logicalFunctionName));
  return group.compilerRoute?.abiFunction ?? named(group)
    ?? owner.compilerRoute?.abiFunction ?? named(owner);
}
