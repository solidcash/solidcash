import { compileString } from 'solidc';
import { describe, expect, it, vi } from 'vitest';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider } from '../test-util.js';

describe('state array index normalization', () => {
  it('accepts ABI-compatible decimal strings while retaining bounds checks', async () => {
    const artifact = compileString(`pragma solidcash ^0.14.0;
      contract Sequence() {
        int[] records;
        function preserve() public { require(true); }
      }
    `, { forceStateful: true, suppressWarnings: true });
    const contract = new StatefulContract('00'.repeat(32), artifact, createTestProvider());
    vi.spyOn(contract, 'getState').mockResolvedValue({ records: [11n, 22n] });
    const records = contract.state.records as unknown as (index: string | bigint | number) => Promise<bigint>;

    await expect(records('0')).resolves.toBe(11n);
    await expect(records('1')).resolves.toBe(22n);
    await expect(records('1.0')).rejects.toThrow(/out of bounds/);
    await expect(records('9007199254740992')).rejects.toThrow(/out of bounds/);
    await expect(records(-1n)).rejects.toThrow(/out of bounds/);
  });
});
