import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { probeRequireMessage } from '../../src/stateful/StatefulContract.js';

const artifact = {
  abi: [{ name: 'read', selector: '01020304', inputs: [] }],
  debug: {
    functionDebug: {
      '01020304': {
        requires: [{ ip: 7, message: 'index out of bounds' }],
      },
    },
  },
} as unknown as Artifact;

const outlinedArtifact = {
  abi: [
    { name: 'create', selector: '11111111', inputs: [] },
    { name: 'update', selector: '22222222', inputs: [] },
  ],
  debug: {
    functionDebug: {
      '11111111': { requires: [{ ip: 100, message: 'entry-point reason' }] },
      '22222222': { requires: [{ ip: 200, message: 'another entry-point reason' }] },
    },
    invokeDebug: {
      '7': {
        bytecode: '517569',
        requires: [{ ip: 16, message: 'outlined helper reason' }],
      },
    },
  },
} as unknown as Artifact;

describe('probeRequireMessage', () => {
  it('maps the VM error step after VERIFY to the invoked function requirement', () => {
    expect(probeRequireMessage([artifact], '01020304', 8)).toBe('index out of bounds');
  });

  it('does not guess from another function selector', () => {
    expect(probeRequireMessage([artifact], 'ffffffff', 8)).toBeUndefined();
  });

  it('attributes a generated route only when its logical functions have one unique reason', () => {
    expect(probeRequireMessage([artifact], 'ffffffff', 3000, ['read']))
      .toBe('index out of bounds');
    const ambiguous = structuredClone(artifact) as Artifact;
    ambiguous.debug!.functionDebug!['01020304'].requires.push({
      ip: 9,
      message: 'another reason',
    } as never);
    expect(probeRequireMessage([ambiguous], 'ffffffff', 3000, ['read'])).toBeUndefined();
  });

  it('uses the exact active outlined body rather than entry-point instruction coordinates', () => {
    expect(probeRequireMessage(
      [outlinedArtifact], '11111111', 17, ['create', 'update'], '517569',
    )).toBe('outlined helper reason');
  });

  it('does not guess when byte-identical outlined bodies disagree at the failing instruction', () => {
    const ambiguous = structuredClone(outlinedArtifact) as Artifact;
    ambiguous.debug!.invokeDebug!['8'] = {
      bytecode: '517569',
      requires: [{ ip: 16, message: 'different outlined reason' }],
    } as never;
    expect(probeRequireMessage(
      [ambiguous], '11111111', 17, ['create'], '517569',
    )).toBeUndefined();
  });
});
