import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import {
  canMaterializeRepairedValueChunk,
  canApplyRepairedNftCommitment,
  isFixedStateRepairSlot,
  isForwardOutputOnlyRepairSlot,
  isForwardStateRepairCoordinate,
  isRepairableNftOutput,
  isScidPlaceholderCommitment,
} from '../../src/stateful/computed-output-repair.js';

describe('isFixedStateRepairSlot', () => {
  it('recognizes explicit data UTXOs and mutable physical lineage', () => {
    expect(isFixedStateRepairSlot({
      explicitlyOwned: true, inputCapability: 'none', preservesNftIdentity: false,
    })).toBe(true);
    expect(isFixedStateRepairSlot({
      explicitlyOwned: false, inputCapability: 'mutable', preservesNftIdentity: false,
    })).toBe(true);
    expect(isFixedStateRepairSlot({
      explicitlyOwned: false, inputCapability: 'none', preservesNftIdentity: true,
    })).toBe(true);
  });

  it('does not reserve output-only coordinates from unrelated inputs', () => {
    expect(isFixedStateRepairSlot({
      explicitlyOwned: false, inputCapability: 'minting', preservesNftIdentity: false,
    })).toBe(false);
    expect(isFixedStateRepairSlot({
      explicitlyOwned: false, inputCapability: undefined, preservesNftIdentity: false,
    })).toBe(false);
  });

});

describe('isForwardOutputOnlyRepairSlot', () => {
  it('allows unowned forward coordinates', () => {
    expect(isForwardOutputOnlyRepairSlot({
      inputIndex: 15,
      outputIndex: 19,
      fixedStateSlot: false,
    })).toBe(true);
  });

  it('does not infer events onto predecessors or fixed state', () => {
    expect(isForwardOutputOnlyRepairSlot({
      inputIndex: 15,
      outputIndex: 14,
      fixedStateSlot: false,
    })).toBe(false);
    expect(isForwardOutputOnlyRepairSlot({
      inputIndex: 15,
      outputIndex: 19,
      fixedStateSlot: true,
    })).toBe(false);
  });
});

describe('isForwardStateRepairCoordinate', () => {
  it('allows physical state updates in the forward band only', () => {
    expect(isForwardStateRepairCoordinate({ inputIndex: 26, outputIndex: 28 })).toBe(true);
    expect(isForwardStateRepairCoordinate({ inputIndex: 26, outputIndex: 25 })).toBe(false);
  });
});

describe('canMaterializeRepairedValueChunk', () => {
  const chunkLock = hexToBin(`aa20${'11'.repeat(32)}87`);
  const chunk = hexToBin('0000616263');

  it('allows an authenticated value chunk to claim an unowned alignment pad', () => {
    expect(canMaterializeRepairedValueChunk({
      fixedStateSlot: false,
      currentHasToken: false,
      currentLockingBytecode: Uint8Array.of(0x51),
      proposedLockingBytecode: chunkLock,
      proposedCommitment: chunk,
      categoryId: '22'.repeat(32),
    })).toBe(true);
  });

  it('protects physical state, existing tokens, and payment outputs', () => {
    const base = {
      fixedStateSlot: false,
      currentHasToken: false,
      currentLockingBytecode: Uint8Array.of(0x51),
      proposedLockingBytecode: chunkLock,
      proposedCommitment: chunk,
      categoryId: '22'.repeat(32),
    };
    expect(canMaterializeRepairedValueChunk({ ...base, fixedStateSlot: true })).toBe(false);
    expect(canMaterializeRepairedValueChunk({ ...base, currentHasToken: true })).toBe(false);
    expect(canMaterializeRepairedValueChunk({
      ...base, currentLockingBytecode: hexToBin(`76a914${'33'.repeat(20)}88ac`),
    })).toBe(false);
  });
});

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

  it('writes an observed event commitment onto a none-cap SCID stub', () => {
    expect(isScidPlaceholderCommitment('53434944')).toBe(true);
    expect(canApplyRepairedNftCommitment({
      capability: 'none',
      currentCommitmentHex: '53434944',
      proposed: event,
      hasLockingBytecode: false,
      fixedStateSlot: false,
    })).toBe('apply-commit');
  });

  it('does not overwrite a real SCID v1 identity', () => {
    expect(canApplyRepairedNftCommitment({
      capability: 'none',
      currentCommitmentHex: '5343494401aa20deadbeef',
      proposed: event,
      hasLockingBytecode: false,
      fixedStateSlot: false,
    })).toBe('skip');
  });

  it('does not collapse a 128-byte-plus mutable entry to an empty node', () => {
    const emptyNode = new Uint8Array(128);
    expect(canApplyRepairedNftCommitment({
      capability: 'mutable',
      currentCommitmentHex: 'ab'.repeat(129),
      proposed: emptyNode,
      hasLockingBytecode: false,
      fixedStateSlot: false,
    })).toBe('skip');
  });

  it('applies a short authenticated update only to physical mutable state', () => {
    const proposed = hexToBin('005252');
    expect(canApplyRepairedNftCommitment({
      capability: 'mutable',
      currentCommitmentHex: '005151',
      proposed,
      hasLockingBytecode: false,
      fixedStateSlot: true,
    })).toBe('apply-commit');
    expect(canApplyRepairedNftCommitment({
      capability: 'mutable',
      currentCommitmentHex: '005151',
      proposed,
      hasLockingBytecode: false,
      fixedStateSlot: false,
    })).toBe('skip');
  });

  it('applies a sub-three-byte scalar update only to physical mutable state', () => {
    const proposed = hexToBin('0164');
    expect(canApplyRepairedNftCommitment({
      capability: 'mutable',
      currentCommitmentHex: '00',
      proposed,
      hasLockingBytecode: false,
      fixedStateSlot: true,
    })).toBe('apply-commit');
    expect(canApplyRepairedNftCommitment({
      capability: 'mutable',
      currentCommitmentHex: '00',
      proposed,
      hasLockingBytecode: false,
      fixedStateSlot: false,
    })).toBe('skip');
  });
});
