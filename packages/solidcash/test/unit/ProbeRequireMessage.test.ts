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
});
