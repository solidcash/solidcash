import type { FunctionBlockLayout, StateLayout } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { Output } from '../../src/interfaces.js';
import {
  materializeOwnerEventNftOutputs,
  type MaterializeOwnerEventNftOutputsHost,
} from '../../src/stateful/stb-materialize-owner-event-nft-outputs.js';

const eventSignature = 'Touched()';

const materialize = (blockLayout?: FunctionBlockLayout): Output[] => {
  const outputs: Output[] = [];
  const host: MaterializeOwnerEventNftOutputsHost = {
    pendingEventEmits: [],
    eventDefinitions: [],
    stateLayout: {} as StateLayout,
    pendingEventPlaceholders: [{ emitIndex: 0, eventSignature }],
    eventRawCommitments: new Map([[0, 'cafe']]),
    blockLayout,
    categoryId: '00'.repeat(32),
    eventNftLockingBytecodes: new Map([[eventSignature, Uint8Array.of(0x51)]]),
  };
  materializeOwnerEventNftOutputs(host, {
    outputs,
    addOutput(output) { outputs.push(output); },
  });
  return outputs;
};

describe('owner event NFT output layout', () => {
  it('preserves indexed, legacy, and unreserved event placement', () => {
    const indexed = materialize({
      blockSize: 5,
      slots: [
        { kind: 'event', slotIndex: 1, offset: 2 },
        { kind: 'event', slotIndex: 0, offset: 4 },
      ],
    });
    expect(indexed[4].token?.nft?.commitment).toBe('cafe');
    expect(indexed[2].token).toBeUndefined();

    const legacy = materialize({
      blockSize: 5,
      slots: [
        { kind: 'event', offset: 4 },
        { kind: 'event', offset: 2 },
      ],
    });
    expect(legacy[2].token?.nft?.commitment).toBe('cafe');
    expect(legacy[4].token).toBeUndefined();

    const unreserved = materialize();
    expect(unreserved).toHaveLength(1);
    expect(unreserved[0].token?.nft?.commitment).toBe('cafe');
  });
});
