/**
 * phase-boundary extract: STB build-phase extract — materialize owner event NFT outputs at layout offsets.
 */

import { binToHex, hexToBin, isHex } from '@bitauth/libauth';
import {
  encodePushdataValue,
  type EventDefinitionAbi,
  type FunctionBlockLayout,
  type StateLayout,
  type StateValue,
} from '@solidcash/utils';
import type { Output } from '../interfaces.js';
import { addressToLockScript } from '../utils.js';
import { assignBalancedOutputAtOffset } from './writer-event-delegate-layout.js';

export type PendingEventEmit = {
  eventSignature: string;
  args: StateValue[];
};

export type PendingEventPlaceholder = {
  emitIndex: number;
  eventSignature: string;
};

export interface MaterializeOwnerEventNftOutputsHost {
  readonly pendingEventEmits: readonly PendingEventEmit[];
  readonly eventDefinitions: readonly EventDefinitionAbi[];
  readonly stateLayout: StateLayout;
  readonly pendingEventPlaceholders: readonly PendingEventPlaceholder[];
  readonly eventRawCommitments: ReadonlyMap<number, string>;
  readonly blockLayout?: FunctionBlockLayout;
  readonly categoryId: string;
  readonly eventNftLockingBytecodes: ReadonlyMap<string, Uint8Array>;
}

/**
 * Merge manual emitEvent() encodings with placeholders/raw commitments and place each reserved
 * event slot at its layout offset (or append when the offset is already occupied).
 */
export function materializeOwnerEventNftOutputs(
  host: MaterializeOwnerEventNftOutputsHost,
  builder: { outputs: Output[]; addOutput(output: Output): unknown },
): void {
  const eventOutputEntries: Array<{ eventSignature: string; commitment: string }> = [];

  // Manual emitEvent() calls (existing encoding logic)
  for (let ei = 0; ei < host.pendingEventEmits.length; ei++) {
    const eventEmit = host.pendingEventEmits[ei];
    const eventDef = host.eventDefinitions.find((e) => e.signature === eventEmit.eventSignature);
    if (!eventDef) {
      throw new Error(`Unknown event: ${eventEmit.eventSignature}`);
    }

    const encodedParts: Uint8Array[] = [];
    for (let i = 0; i < eventDef.parameters.length; i++) {
      let value = eventEmit.args[i];
      const type = eventDef.parameters[i].type;
      if (typeof value === 'string') {
        if (type === 'string') {
          value = new TextEncoder().encode(value);
        } else if (type === 'address' && value.includes(':')) {
          value = addressToLockScript(value);
        } else if (type === 'address' && /^(0x)?0*$/i.test(value)) {
          value = new Uint8Array(0);
        } else if (type === 'address' && /^0x[0-9a-fA-F]*$/.test(value)) {
          value = hexToBin(value.slice(2));
        } else if (/^0x[0-9a-fA-F]*$/.test(value)) {
          // SDK callers commonly supply pubkeys, hashes, and fixed bytes in ethers-style `0x` form. `isHex`
          // intentionally accepts canonical bare hex only, so normalize the transport prefix before encoding
          // event arguments rather than rejecting an otherwise valid bytes value.
          value = hexToBin(value.slice(2));
        } else if (!isHex(value)) {
          throw new Error(`Invalid event argument at index ${i}: expected a hex string, got '${value}'`);
        } else {
          value = hexToBin(value);
        }
      }
      encodedParts.push(encodePushdataValue(value, type, host.stateLayout.structs));
    }

    const totalLength = encodedParts.reduce((sum, p) => sum + p.length, 0);
    const commitmentBytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of encodedParts) {
      commitmentBytes.set(part, offset);
      offset += part.length;
    }

    eventOutputEntries[ei] = { eventSignature: eventEmit.eventSignature, commitment: binToHex(commitmentBytes) };
  }

  // Placeholders and raw commitments (from auto-derivation)
  for (const placeholder of host.pendingEventPlaceholders) {
    const idx = placeholder.emitIndex;
    if (eventOutputEntries[idx]) continue; // manual emitEvent() takes precedence
    const rawCommitment = host.eventRawCommitments.get(idx);
    eventOutputEntries[idx] = {
      eventSignature: placeholder.eventSignature,
      commitment: rawCommitment ?? '',
    };
  }

  const reservedEventSlots = host.blockLayout?.slots.filter((slot) => slot.kind === 'event').length
    ?? eventOutputEntries.length;
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_EVENT_STAGE === '1') {
    // Event placeholders are the only authority for how many event outputs this build must carry, so report the
    // merge inputs whenever the caller asks why a covenant's own event slot is missing from the materialized frame.
    console.error('event-materialize', JSON.stringify({
      category: host.categoryId.slice(0, 12),
      blockSize: host.blockLayout?.blockSize,
      placeholders: host.pendingEventPlaceholders,
      rawCommitments: [...host.eventRawCommitments.entries()].map(([index, commit]) => `${index}:${commit.length}`),
      entries: eventOutputEntries.map((entry, index) => (
        entry === undefined ? undefined : `${index}:${entry.eventSignature}:${entry.commitment.length}`)),
      reservedEventSlots,
      cursor: builder.outputs.length,
      eventSlots: host.blockLayout?.slots.filter((slot) => slot.kind === 'event'),
    }));
  }
  for (let eventSlot = 0; eventSlot < reservedEventSlots; eventSlot += 1) {
    // The emitting covenant resolves its own event NFT at `masterInputIndex + slotOffset`, so an event output
    // belongs at the layout offset of its slot - not at whatever index the build cursor happens to hold. The two
    // only agree when nothing but the owner's block was materialized before this loop; a nested participant
    // block, a funding pad or a derived chunk in front of the band leaves the cursor past the offset, and simply
    // appending then puts the NFT where the covenant will never look (the slot keeps its neutral pad, whose empty
    // commitment fails the event check).
    const eventSlots = (host.blockLayout?.slots ?? []).filter((candidate) => candidate.kind === 'event');
    // A published event slot names the emit ordinal in `slotIndex`; a layout predating that field is read in
    // offset order. Mixing the two would let an unindexed slot answer for an ordinal it does not own.
    const indexedSlot = eventSlots.find((candidate) => candidate.slotIndex === eventSlot);
    const orderedSlot = eventSlots.every((candidate) => candidate.slotIndex === undefined)
      ? eventSlots.slice().sort((left, right) => left.offset - right.offset)[eventSlot] : undefined;
    const slotOffset = indexedSlot?.offset ?? orderedSlot?.offset;
    const placeEventOutput = (output: Output): void => {
      if (slotOffset === undefined) {
        builder.addOutput(output);
        return;
      }
      while (builder.outputs.length < slotOffset) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
      }
      const occupant = builder.outputs[slotOffset];
      // Only a neutral (tokenless) pad may be displaced. An authenticated resource already sitting at the offset
      // is not this event's to overwrite; appending keeps it addressable and leaves the mismatch to the covenant.
      if (occupant !== undefined && occupant.token !== undefined) {
        builder.addOutput(output);
        return;
      }
      assignBalancedOutputAtOffset(builder.outputs, slotOffset, output);
    };
    const eo = eventOutputEntries[eventSlot];
    if (!eo) {
      // A graph route reserves a fixed event frame. Keep every inactive site as a balanced plain output so a
      // later participant cannot slide into the gap; the route covenant separately excludes an own-category
      // NFT here, and the atomic callManifest lists only active immutable event outputs.
      placeEventOutput({ to: Uint8Array.of(0x51), amount: 1000n });
      continue;
    }
    const lockingBytecode = host.eventNftLockingBytecodes.get(eo.eventSignature);
    if (!lockingBytecode) {
      throw new Error(`No locking bytecode provided for event: ${eo.eventSignature}`);
    }

    placeEventOutput({
      to: lockingBytecode,
      amount: 1200n,
      token: {
        amount: 0n,
        category: host.categoryId,
        nft: {
          capability: 'none',
          commitment: eo.commitment,
        },
      },
    });
  }
}
