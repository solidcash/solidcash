import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import {
  canApplyRepairedNftCommitment,
  isRepairableNftOutput,
  isScidPlaceholderCommitment,
} from '../../src/stateful/computed-output-repair.js';

describe('isRepairableNftOutput', () => {
  it('accepts mutable and event (none) commitments up to the provider ceiling', () => {
    expect(isRepairableNftOutput('mutable', 128, 128)).toBe(true);
    expect(isRepairableNftOutput('none', 188, 1_000_000)).toBe(true);
    expect(isRepairableNftOutput('none', 188, 128)).toBe(false);
  });

  it('rejects minting outputs and undersized commitments', () => {
    expect(isRepairableNftOutput('minting', 64, 128)).toBe(false);
    expect(isRepairableNftOutput('mutable', 2, 128)).toBe(false);
    expect(isRepairableNftOutput(undefined, 64, 128)).toBe(false);
  });
});

describe('canApplyRepairedNftCommitment', () => {
  const event = hexToBin('005e1976a91471782e8159265ed94bd35b8e699c08f53a6f38c688ac0000');

  it('writes a JobEvent OTC onto a none-cap SCID stub', () => {
    expect(isScidPlaceholderCommitment('53434944')).toBe(true);
    expect(canApplyRepairedNftCommitment({
      capability: 'none',
      currentCommitmentHex: '53434944',
      proposed: event,
      hasLockingBytecode: false,
    })).toBe('apply-commit');
  });

  it('does not overwrite a real SCID v1 identity', () => {
    expect(canApplyRepairedNftCommitment({
      capability: 'none',
      currentCommitmentHex: '5343494401aa20deadbeef',
      proposed: event,
      hasLockingBytecode: false,
    })).toBe('skip');
  });

  it('does not collapse a 128-byte-plus mutable entry to an empty node', () => {
    const emptyNode = new Uint8Array(128);
    expect(canApplyRepairedNftCommitment({
      capability: 'mutable',
      currentCommitmentHex: 'ab'.repeat(129),
      proposed: emptyNode,
      hasLockingBytecode: false,
    })).toBe('skip');
  });
});
