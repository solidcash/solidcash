import { Op } from '@solidcash/utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { evaluateFaithfulProbeTrace } from '../../src/stateful/faithful-probe-trace.js';

describe('faithful trace diagnostic cost', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it.each([undefined, '257'])('does not rescan complete programs for span setting %s', (setting) => {
    vi.stubEnv('SOLIDC_DEBUG_SPAN_INSTRUCTIONS', setting);
    const provider = new MockNetworkProvider();
    const program = {
      inputIndex: 0,
      sourceOutputs: [{
        lockingBytecode: Uint8Array.from([...new Array(256).fill(Op.OP_NOP), Op.OP_1]),
        valueSatoshis: 1000n,
      }],
      transaction: {
        version: 2, locktime: 0,
        inputs: [{
          outpointIndex: 0, outpointTransactionHash: new Uint8Array(32),
          sequenceNumber: 0xffffffff, unlockingBytecode: new Uint8Array(),
        }],
        outputs: [{ lockingBytecode: Uint8Array.of(Op.OP_1), valueSatoshis: 900n }],
      },
    };
    const mapsByInstructions = new Map<unknown, number>();
    const originalMap = Array.prototype.map;
    const mapSpy = vi.spyOn(Array.prototype, 'map').mockImplementation(function countedMap<T, U>(
      this: T[], callback: (value: T, index: number, array: T[]) => U, thisArg?: unknown,
    ): U[] {
      if (this.length === 257 && (this[0] as { opcode?: number })?.opcode === Op.OP_NOP) {
        mapsByInstructions.set(this, (mapsByInstructions.get(this) ?? 0) + 1);
      }
      return originalMap.call(this, callback, thisArg) as U[];
    });
    let trace: ReturnType<typeof evaluateFaithfulProbeTrace>;
    try {
      trace = evaluateFaithfulProbeTrace(provider, program);
    } finally {
      mapSpy.mockRestore();
    }
    const terminal = trace.at(-1)!;
    expect(terminal.error).toBeUndefined();
    expect(terminal.instructions).toHaveLength(257);
    expect(mapsByInstructions.get(terminal.instructions) ?? 0).toBe(0);
    expect(trace).toEqual(createVirtualMachineBch2026ForProvider(provider).debug(program));
  });
});
