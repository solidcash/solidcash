import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { Op } from '@solidcash/utils';
import {
  canMaterializeRepairedValueChunk,
  canApplyRepairedNftCommitment,
  followsMutableNftOutputGuard,
  isActiveVmControlBranch,
  isFixedStateRepairSlot,
  isForwardOutputOnlyRepairSlot,
  isForwardStateRepairCoordinate,
  isOwnedStateRepairCoordinate,
  isRepairableNftOutput,
  isScidPlaceholderCommitment,
} from '../../src/stateful/computed-output-repair.js';

describe('isActiveVmControlBranch', () => {
  it('rejects observer candidates from untaken branches', () => {
    expect(isActiveVmControlBranch([])).toBe(true);
    expect(isActiveVmControlBranch([true, true])).toBe(true);
    expect(isActiveVmControlBranch([true, false, true])).toBe(false);
  });
});

describe('followsMutableNftOutputGuard', () => {
  it('recognizes only the compiler-authenticated mutable capability sequence', () => {
    const prefix = [{ opcode: Op.OP_EQUALVERIFY }];
    const mutable = [
      { opcode: Op.OP_DUP },
      { opcode: Op.OP_OUTPUTTOKENCATEGORY },
      { opcode: Op.OP_DUP },
      { opcode: 1, data: Uint8Array.of(32) },
      { opcode: Op.OP_SPLIT },
      { opcode: Op.OP_NIP },
      { opcode: Op.OP_1 },
      { opcode: Op.OP_EQUALVERIFY },
    ];
    expect(followsMutableNftOutputGuard([...prefix, ...mutable], 0)).toBe(true);
    expect(followsMutableNftOutputGuard([
      ...prefix,
      ...mutable.map((instruction, index) => index === 6 ? { opcode: Op.OP_2 } : instruction),
    ], 0)).toBe(false);
    expect(followsMutableNftOutputGuard([
      ...prefix,
      ...mutable.map((instruction, index) => index === 1 ? { opcode: Op.OP_OUTPUTVALUE } : instruction),
    ], 0)).toBe(false);
  });
});

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

describe('isOwnedStateRepairCoordinate', () => {
  it('allows an authenticated delegate to repair its earlier fixed proxy state', () => {
    expect(isOwnedStateRepairCoordinate({
      inputIndex: 3, outputIndex: 1, delegateOwnedFixedState: true,
    })).toBe(true);
  });

  it('keeps unrelated predecessor outputs protected', () => {
    expect(isOwnedStateRepairCoordinate({
      inputIndex: 3, outputIndex: 1, delegateOwnedFixedState: false,
    })).toBe(false);
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

  it('leaves an explicit fixed-state override for final covenant refusal', () => {
    const proposed = hexToBin('0164');
    expect(canApplyRepairedNftCommitment({
      capability: 'mutable',
      currentCommitmentHex: '02e70300',
      proposed,
      hasLockingBytecode: false,
      fixedStateSlot: true,
      explicitOverride: true,
    })).toBe('skip');
    expect(canApplyRepairedNftCommitment({
      capability: 'mutable',
      currentCommitmentHex: '00',
      proposed,
      hasLockingBytecode: false,
      fixedStateSlot: true,
    })).toBe('apply-commit');
  });

  it('uses an advertised larger ceiling only for authenticated physical state', () => {
    const proposed = new Uint8Array(246).fill(0xab);
    expect(canApplyRepairedNftCommitment({
      capability: 'mutable',
      currentCommitmentHex: 'cd'.repeat(248),
      proposed,
      hasLockingBytecode: false,
      fixedStateSlot: true,
      maximumCommitmentBytes: 256,
    })).toBe('apply-commit');
    expect(canApplyRepairedNftCommitment({
      capability: 'mutable',
      currentCommitmentHex: 'cd'.repeat(248),
      proposed,
      hasLockingBytecode: false,
      fixedStateSlot: false,
    })).toBe('skip');
  });

  it('allows a short exact update at an authenticated mutable chunk slot', () => {
    expect(canApplyRepairedNftCommitment({
      capability: 'mutable',
      currentCommitmentHex: '52080000000000000000',
      proposed: hexToBin('5206000000000000'),
      hasLockingBytecode: false,
      fixedStateSlot: false,
      authenticatedMutableSlot: true,
    })).toBe('apply-commit');
  });

  it('uses the active provider commitment ceiling for authenticated resource updates', () => {
    const proposed = new Uint8Array(381).fill(0x42);
    const candidate = {
      capability: 'mutable',
      currentCommitmentHex: '00'.repeat(64),
      proposed,
      hasLockingBytecode: false,
      fixedStateSlot: false,
    } as const;
    expect(canApplyRepairedNftCommitment(candidate)).toBe('skip');
    expect(canApplyRepairedNftCommitment({
      ...candidate,
      maximumCommitmentBytes: 10_000,
    })).toBe('apply-commit');
  });
});
