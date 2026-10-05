import { afterEach, describe, expect, it, vi } from 'vitest';
import { traceBroadcast } from '../../src/tx-trace.js';

describe('traceBroadcast', () => {
  afterEach(() => {
    delete process.env.SOLIDCASH_TX_TRACE;
    vi.restoreAllMocks();
  });

  it('prints the broadcast when the trace is on and stays quiet when it is off', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const inputs = [{ satoshis: 10_000n }];
    const outputs = [{ amount: 9_000n }];
    const encoded = [{ unlockingBytecode: new Uint8Array(25) }];
    traceBroadcast(inputs, outputs, encoded, 120);
    expect(error).not.toHaveBeenCalled();
    process.env.SOLIDCASH_TX_TRACE = '1';
    traceBroadcast(inputs, outputs, encoded, 120);
    const line = String(error.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toEqual({
      trace: 'tx',
      bytes: 120,
      inputs: 1,
      outputs: 1,
      fee: '1000',
      largestUnlock: 25,
    });
  });
});
