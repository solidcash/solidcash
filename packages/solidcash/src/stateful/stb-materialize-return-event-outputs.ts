/**
 * phase-boundary extract: STB build-phase extract — deferred delegate + primary/external return event materialization.
 */

import type { FunctionBlockLayout } from '@solidcash/utils';
import type { Output, UnlockableUtxo, Utxo } from '../interfaces.js';
import { calculateDust } from '../utils.js';
import { BALANCED_SLOT_SATOSHIS } from './balancedBlocks.js';
import { isInsertBandDustToken } from './mutable-output-reassert.js';
import { cloneToken } from './stb-output-utils.js';
import { returnEventNftCommitment } from './return-event-nft-commitment.js';

export type ReturnEventRecord = {
  categoryId: string;
  commitment: Uint8Array;
  identity: string;
  provisional?: boolean;
};

export interface MaterializeReturnEventOutputsHost {
  readonly allInputs: readonly UnlockableUtxo[];
  readonly blockLayout?: FunctionBlockLayout;
  readonly categoryId: string;
  readonly plannedReturnOutputIndex: number;
  readonly delegateEntriesAfterLowLevel: boolean;
  readonly pendingReturnEventOutputs: readonly ReturnEventRecord[];
  /** Chained or dynamic-loop keccak side-cars follow the complete fixed block (from blockSize). */
  readonly keccakSideCarsFollowBlock?: boolean;
  builtReturnEventOutputIndices: Map<string, number>;
  tailReturnEventOutputs(): readonly ReturnEventRecord[];
  addReturnOutput(builder: { addOutput(output: Output): unknown }, identity: string, output: Output): void;
  /** The digest of the call a direct return record answers; none for a routed one. */
  callRecordDigest?(identity: string): Uint8Array | undefined;
}

/**
 * Place deferred delegate returns, primary/external return-event NFTs (absolute unlocker indices or
 * append), and empty return placeholders for view probes.
 */
export function materializeReturnEventOutputs(
  host: MaterializeReturnEventOutputsHost,
  builder: {
    outputs: Output[];
    addOutput(output: Output): unknown;
  },
  deferredDelegateReturnEvents: readonly ReturnEventRecord[],
): void {
  const recordCommitment = (re: { commitment: Uint8Array; identity: string }): string => (
    returnEventNftCommitment(re.commitment, host.callRecordDigest?.(re.identity))
  );
  // X56. The delegate return channel, deferred from the facet-preservation block above so the co-spent
  // implementation's own event outputs keep the position its covenant resolves for them.
  for (const re of deferredDelegateReturnEvents) {
    host.addReturnOutput(builder, re.identity, {
      to: new Uint8Array([0x51]),
      amount: 800n,
      token: {
        amount: 0n,
        category: re.categoryId,
        nft: { capability: 'none', commitment: recordCommitment(re) },
      },
    });
  }

  // Create return event outputs (from cross-contract calls with return values). X13: a callee whose full block
  // carries a returnEvent slot already emitted its own return event inside that block above.
  // Primary/view returns must land on __internal__returnOutputIdx (often an in-block funder index).
  // Appending them leaves OUTPUTTOKENCATEGORY[returnIdx] empty (getEvents master+4 at 7 → 32 SPLIT).
  const placedPrimaryReturnIndices = new Set<number>();
  const placeReturnAtAbsoluteIndex = (absIndex: number, re: {
    categoryId: string; commitment: Uint8Array; identity: string;
  }): void => {
    while (builder.outputs.length < absIndex) {
      builder.addOutput({ to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS });
    }
    const output: Output = {
      to: new Uint8Array([0x51]),
      amount: 800n,
      token: {
        amount: 0n,
        category: re.categoryId,
        nft: { capability: 'none', commitment: recordCommitment(re) },
      },
    };
    output.amount = BigInt(Math.max(Number(output.amount), calculateDust(output)));
    if (builder.outputs.length === absIndex) builder.addOutput(output);
    else builder.outputs[absIndex] = output;
    host.builtReturnEventOutputIndices.set(re.identity, absIndex);
    placedPrimaryReturnIndices.add(absIndex);
  };
  const unlockerReturnIndices = (): number[] => {
    // An explicit placement is authoritative for this builder. During atomic composition the unlocker already
    // carries the final aggregate coordinate, while the isolated participant builder owns a local coordinate;
    // scanning both would materialize a second empty return slot and pad the participant to the aggregate base.
    if (host.plannedReturnOutputIndex >= 0) return [host.plannedReturnOutputIndex];
    const indices: number[] = [];
    for (const input of host.allInputs) {
      if (!('unlocker' in input) || !input.unlocker) continue;
      const unlocker = input.unlocker as {
        abiFunction?: { inputs?: ReadonlyArray<{ name: string }> };
        params?: readonly unknown[];
      };
      const inputs = unlocker.abiFunction?.inputs;
      const params = unlocker.params;
      if (!inputs || !params) continue;
      const pos = inputs.findIndex((param) => param.name === '__internal__returnOutputIdx');
      if (pos < 0 || pos >= params.length) continue;
      const raw = params[pos];
      const value = typeof raw === 'bigint' ? Number(raw)
        : typeof raw === 'number' ? raw
          : typeof raw === 'string' && raw !== '' ? Number(raw) : Number.NaN;
      if (Number.isInteger(value) && value >= 0 && !indices.includes(value)) indices.push(value);
    }
    return indices;
  };
  const primaryReturns = (host.delegateEntriesAfterLowLevel ? [] : host.tailReturnEventOutputs())
    .filter((re) => !re.identity.startsWith('external-call:'));
  const externalReturns = (host.delegateEntriesAfterLowLevel ? [] : host.tailReturnEventOutputs())
    .filter((re) => re.identity.startsWith('external-call:'));
  for (const re of primaryReturns) {
    const absIndices = unlockerReturnIndices();
    if (absIndices.length > 0) {
      placeReturnAtAbsoluteIndex(absIndices[0]!, re);
      continue;
    }
    const returnSlot = host.blockLayout?.slots.find((slot) => slot.kind === 'returnEvent');
    let placed = false;
    if (returnSlot) {
      for (let master = 0; master < host.allInputs.length; master++) {
        if (host.allInputs[master]?.token?.nft?.capability !== 'minting') continue;
        const absIndex = master + returnSlot.offset;
        const funder = host.allInputs[absIndex];
        if (!funder || funder.token) continue;
        placeReturnAtAbsoluteIndex(absIndex, re);
        placed = true;
        break;
      }
    }
    if (placed) continue;
    host.addReturnOutput(builder, re.identity, {
      to: new Uint8Array([0x51]),
      amount: 800n,
      token: {
        amount: 0n,
        category: re.categoryId,
        nft: { capability: 'none', commitment: recordCommitment(re) },
      },
    });
  }
  for (const re of externalReturns) {
    host.addReturnOutput(builder, re.identity, {
      to: new Uint8Array([0x51]), // OP_TRUE
      amount: 800n,
      token: {
        amount: 0n,
        category: re.categoryId,
        nft: { capability: 'none', commitment: recordCommitment(re) },
      },
    });
  }
  // Materialize empty return placeholders when emitReturn seeded no commitment yet, but an unlocker
  // still points at a concrete returnOutputIdx (view probes / getEvents).
  // Gap pads must mirror insert-band dust inputs (none-cap at INPUTINDEX+3/+5);
  // a bare OP_TRUE there makes OUTPUTTOKENCATEGORY empty and OP_SPLIT 32 fails closed.
  const padBalancedSlot = (slotIndex: number): Output => {
    const occupant = host.allInputs[slotIndex];
    if (occupant?.unlocker && isInsertBandDustToken(occupant.token, host.categoryId)) {
      return {
        to: Uint8Array.of(0x51),
        amount: BigInt(Math.max(Number(BALANCED_SLOT_SATOSHIS), Number(occupant.satoshis))),
        token: cloneToken(occupant.token as Utxo['token']),
      };
    }
    if (occupant?.unlocker && !occupant.token) {
      return {
        to: occupant.unlocker.generateLockingBytecode(),
        amount: occupant.satoshis,
      };
    }
    return { to: Uint8Array.of(0x51), amount: BALANCED_SLOT_SATOSHIS };
  };
  for (const absIndex of unlockerReturnIndices()) {
    if (placedPrimaryReturnIndices.has(absIndex)) continue;
    while (builder.outputs.length < absIndex) {
      builder.addOutput(padBalancedSlot(builder.outputs.length));
    }
    if (builder.outputs.length === absIndex) {
      builder.addOutput(padBalancedSlot(absIndex));
    } else if (!builder.outputs[absIndex]) {
      builder.outputs[absIndex] = padBalancedSlot(absIndex);
    } else if (
      !builder.outputs[absIndex]?.token
      && isInsertBandDustToken(host.allInputs[absIndex]?.token, host.categoryId)
    ) {
      builder.outputs[absIndex] = {
        ...padBalancedSlot(absIndex),
        amount: builder.outputs[absIndex]?.amount ?? BALANCED_SLOT_SATOSHIS,
      };
    }
    placedPrimaryReturnIndices.add(absIndex);
  }
  if (!host.delegateEntriesAfterLowLevel
    && ((host.blockLayout?.trailingCapacity ?? 0) > 0 || host.keccakSideCarsFollowBlock === true)
    && host.blockLayout?.slots.some((slot) => slot.kind === 'returnEvent')
    && host.pendingReturnEventOutputs.length === 0
    && placedPrimaryReturnIndices.size === 0) {
    // A balanced block, or one keccak side-cars follow, cannot collapse an inactive return slot: doing so
    // shifts the bounded trailing region (or the chain's or loop's side-cars) one position left.
    builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
  }
}
