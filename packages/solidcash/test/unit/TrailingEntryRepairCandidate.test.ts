import { describe, expect, it } from 'vitest';
import { isTrailingEntryRepairCandidate } from '../../src/message-bus/preflight.js';

const entryLock = 'aa20abcd87';
const base = {
  slotKind: 'trailing',
  inputHasToken: false,
  outputCapability: 'mutable',
  outputCategory: 'CAFE',
  outputTokenAmount: 0n,
  blockCategory: 'cafe',
  outputLockingBytecode: entryLock.toUpperCase(),
  entryLockingBytecodes: new Set([entryLock]),
};

describe('trailing entry repair ownership', () => {
  it('admits a token-free trailing reservation at a declared entry lock', () => {
    expect(isTrailingEntryRepairCandidate(base)).toBe(true);
  });

  it('rejects unrelated trailing resources and occupied inputs', () => {
    expect(isTrailingEntryRepairCandidate({ ...base, outputLockingBytecode: 'aa20ffff87' })).toBe(false);
    expect(isTrailingEntryRepairCandidate({ ...base, inputHasToken: true })).toBe(false);
    expect(isTrailingEntryRepairCandidate({ ...base, slotKind: 'event' })).toBe(false);
  });
});
